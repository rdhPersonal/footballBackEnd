import { Client } from 'pg';
import { spawn, ChildProcess } from 'child_process';
import * as net from 'net';
import {
  fetchTeams,
  fetchTeamRoster,
  fetchPlayerGamelog,
  delay,
  type EspnPlayer,
  type EspnPlayerGamelog,
} from '../src/shared/external-api/client';

const LOCAL_PORT = 15432;
const SEASONS = [2023, 2024, 2025];
const API_DELAY_MS = 300;

// NFL team conference/division mapping
const TEAM_INFO: Record<string, { conference: string; division: string }> = {
  ARI: { conference: 'NFC', division: 'West' },
  ATL: { conference: 'NFC', division: 'South' },
  BAL: { conference: 'AFC', division: 'North' },
  BUF: { conference: 'AFC', division: 'East' },
  CAR: { conference: 'NFC', division: 'South' },
  CHI: { conference: 'NFC', division: 'North' },
  CIN: { conference: 'AFC', division: 'North' },
  CLE: { conference: 'AFC', division: 'North' },
  DAL: { conference: 'NFC', division: 'East' },
  DEN: { conference: 'AFC', division: 'West' },
  DET: { conference: 'NFC', division: 'North' },
  GB:  { conference: 'NFC', division: 'North' },
  HOU: { conference: 'AFC', division: 'South' },
  IND: { conference: 'AFC', division: 'South' },
  JAX: { conference: 'AFC', division: 'South' },
  KC:  { conference: 'AFC', division: 'West' },
  LAC: { conference: 'AFC', division: 'West' },
  LAR: { conference: 'NFC', division: 'West' },
  LV:  { conference: 'AFC', division: 'West' },
  MIA: { conference: 'AFC', division: 'East' },
  MIN: { conference: 'NFC', division: 'North' },
  NE:  { conference: 'AFC', division: 'East' },
  NO:  { conference: 'NFC', division: 'South' },
  NYG: { conference: 'NFC', division: 'East' },
  NYJ: { conference: 'AFC', division: 'East' },
  PHI: { conference: 'NFC', division: 'East' },
  PIT: { conference: 'AFC', division: 'North' },
  SEA: { conference: 'NFC', division: 'West' },
  SF:  { conference: 'NFC', division: 'West' },
  TB:  { conference: 'NFC', division: 'South' },
  TEN: { conference: 'AFC', division: 'South' },
  WSH: { conference: 'NFC', division: 'East' },
};

interface Config {
  bastionIp: string;
  bastionKeyPath: string;
  rdsHost: string;
  dbPassword: string;
  dbName: string;
  dbUser: string;
}

function getConfig(): Config {
  const bastionIp = process.env.BASTION_IP;
  const rdsHost = process.env.RDS_HOST;
  const dbPassword = process.env.DB_PASSWORD;

  if (!bastionIp || !rdsHost || !dbPassword) {
    console.error('Required: BASTION_IP, RDS_HOST, DB_PASSWORD');
    process.exit(1);
  }

  return {
    bastionIp,
    bastionKeyPath: process.env.BASTION_KEY || `${process.env.HOME}/.ssh/football-bastion.pem`,
    rdsHost,
    dbPassword,
    dbName: process.env.DB_NAME || 'football',
    dbUser: process.env.DB_USER || 'footballadmin',
  };
}

async function waitForPort(port: number, timeoutMs = 15000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      await new Promise<void>((resolve, reject) => {
        const sock = net.createConnection({ port, host: '127.0.0.1' }, () => {
          sock.destroy();
          resolve();
        });
        sock.on('error', reject);
      });
      return;
    } catch {
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  throw new Error(`Timed out waiting for port ${port}`);
}

function startTunnel(config: Config): ChildProcess {
  console.log(`Opening SSH tunnel via ${config.bastionIp}...`);
  const tunnel = spawn('ssh', [
    '-i', config.bastionKeyPath,
    '-o', 'StrictHostKeyChecking=accept-new',
    '-N',
    '-L', `${LOCAL_PORT}:${config.rdsHost}:5432`,
    `ec2-user@${config.bastionIp}`,
  ], { stdio: 'pipe' });
  tunnel.stderr?.on('data', (d: Buffer) => {
    const msg = d.toString().trim();
    if (msg) console.error(`  [tunnel] ${msg}`);
  });
  return tunnel;
}

async function upsertTeams(db: Client, teams: Array<{ abbr: string; name: string }>, season: number) {
  for (const team of teams) {
    const info = TEAM_INFO[team.abbr] || { conference: '?', division: '?' };
    await db.query(
      `INSERT INTO nfl_teams (abbr, name, conference, division, season)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (abbr, season) DO UPDATE SET name = $2, conference = $3, division = $4`,
      [team.abbr, team.name, info.conference, info.division, season],
    );
  }
}

async function upsertPlayer(db: Client, player: EspnPlayer): Promise<string> {
  const dob = player.dateOfBirth ? player.dateOfBirth.split('T')[0] : null;

  const result = await db.query(
    `INSERT INTO players (external_id, name, position, photo_url, date_of_birth, college, height_inches, weight_lbs)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (external_id) DO UPDATE SET
       name = EXCLUDED.name,
       position = EXCLUDED.position,
       photo_url = EXCLUDED.photo_url,
       date_of_birth = COALESCE(EXCLUDED.date_of_birth, players.date_of_birth),
       college = COALESCE(EXCLUDED.college, players.college),
       height_inches = COALESCE(EXCLUDED.height_inches, players.height_inches),
       weight_lbs = COALESCE(EXCLUDED.weight_lbs, players.weight_lbs),
       updated_at = NOW()
     RETURNING id`,
    [
      player.espnId,
      player.fullName,
      player.positionAbbr,
      player.headshotUrl || null,
      dob,
      player.college || null,
      player.heightInches || null,
      player.weightLbs || null,
    ],
  );

  return result.rows[0].id;
}

async function upsertRosterStint(
  db: Client,
  playerId: string,
  teamAbbr: string,
  season: number,
  weekStart: number,
  weekEnd: number | null,
) {
  await db.query(
    `INSERT INTO team_rosters (player_id, team_abbr, season, week_start, week_end, roster_status, transaction_type)
     VALUES ($1, $2, $3, $4, $5, 'active', 'signed')
     ON CONFLICT (player_id, season, week_start) DO UPDATE SET
       team_abbr = EXCLUDED.team_abbr,
       week_end = EXCLUDED.week_end`,
    [playerId, teamAbbr, season, weekStart, weekEnd],
  );
}

async function upsertGameStats(
  db: Client,
  playerId: string,
  teamAbbr: string,
  season: number,
  week: number,
  statDetails: Record<string, string>,
) {
  await db.query(
    `INSERT INTO player_stats (player_id, team_abbr, season, week, games_played, total_points, stat_details)
     VALUES ($1, $2, $3, $4, 1, 0, $5)
     ON CONFLICT (player_id, season, week) DO UPDATE SET
       team_abbr = EXCLUDED.team_abbr,
       stat_details = EXCLUDED.stat_details,
       updated_at = NOW()`,
    [playerId, teamAbbr, season, week, JSON.stringify(statDetails)],
  );
}

async function backfill() {
  const config = getConfig();
  const tunnel = startTunnel(config);

  try {
    await waitForPort(LOCAL_PORT);
    console.log('SSH tunnel established.\n');

    const db = new Client({
      host: '127.0.0.1',
      port: LOCAL_PORT,
      database: config.dbName,
      user: config.dbUser,
      password: config.dbPassword,
      ssl: { rejectUnauthorized: false },
    });
    await db.connect();
    console.log('Connected to database.\n');

    // Step 1: Fetch all NFL teams
    console.log('=== Step 1: Fetching NFL teams ===');
    const espnTeams = await fetchTeams();
    console.log(`Found ${espnTeams.length} teams.`);

    // Insert teams for each season
    const teamData = espnTeams.map((t) => ({ abbr: t.abbreviation, name: t.displayName }));
    for (const season of SEASONS) {
      await upsertTeams(db, teamData, season);
    }
    console.log(`Teams inserted for seasons: ${SEASONS.join(', ')}\n`);

    // Step 2: Fetch rosters and discover players
    console.log('=== Step 2: Fetching rosters and player data ===');
    const allPlayers = new Map<string, { player: EspnPlayer; dbId: string; teamAbbr: string }>();

    for (const team of espnTeams) {
      process.stdout.write(`  ${team.abbreviation}: fetching roster... `);
      await delay(API_DELAY_MS);

      try {
        const roster = await fetchTeamRoster(team.espnId);
        let count = 0;

        for (const player of roster) {
          if (!allPlayers.has(player.espnId)) {
            const dbId = await upsertPlayer(db, player);
            allPlayers.set(player.espnId, {
              player,
              dbId,
              teamAbbr: team.abbreviation,
            });
            count++;
          }
        }

        console.log(`${roster.length} players (${count} new)`);
      } catch (err) {
        console.log(`ERROR: ${err instanceof Error ? err.message : err}`);
      }
    }

    console.log(`\nTotal unique players discovered: ${allPlayers.size}\n`);

    // Step 3: Fetch gamelogs and build roster stints + stats
    console.log('=== Step 3: Fetching gamelogs for all players ===');

    // Filter to skill positions for gamelogs (QB, RB, WR, TE, K)
    const skillPlayers = [...allPlayers.values()].filter((p) =>
      ['QB', 'RB', 'WR', 'TE', 'K'].includes(p.player.positionAbbr),
    );
    console.log(`Fetching gamelogs for ${skillPlayers.length} skill-position players across ${SEASONS.length} seasons.\n`);

    let processed = 0;
    let statsInserted = 0;

    for (const { player, dbId, teamAbbr } of skillPlayers) {
      processed++;
      if (processed % 50 === 0 || processed === skillPlayers.length) {
        console.log(`  Progress: ${processed}/${skillPlayers.length} players (${statsInserted} stat rows inserted)`);
      }

      for (const season of SEASONS) {
        await delay(API_DELAY_MS);

        try {
          const gamelog = await fetchPlayerGamelog(player.espnId, season);
          if (!gamelog || gamelog.games.length === 0) continue;

          // Sort games by week
          const sortedGames = [...gamelog.games].sort((a, b) => a.week - b.week);
          const firstWeek = sortedGames[0].week;
          const lastWeek = sortedGames[sortedGames.length - 1].week;

          // Create a roster stint for this season
          await upsertRosterStint(db, dbId, teamAbbr, season, firstWeek, lastWeek);

          // Insert per-game stats
          for (const game of sortedGames) {
            await upsertGameStats(db, dbId, teamAbbr, season, game.week, game.stats);
            statsInserted++;
          }
        } catch {
          // Skip players whose gamelogs fail (e.g., rookies without data for older seasons)
        }
      }
    }

    console.log(`\nBackfill complete!`);
    console.log(`  Players: ${allPlayers.size}`);
    console.log(`  Stat rows: ${statsInserted}`);
    console.log(`  Seasons: ${SEASONS.join(', ')}`);

    // Verify counts
    const teamCount = await db.query('SELECT COUNT(*) FROM nfl_teams');
    const playerCount = await db.query('SELECT COUNT(*) FROM players');
    const rosterCount = await db.query('SELECT COUNT(*) FROM team_rosters');
    const statsCount = await db.query('SELECT COUNT(*) FROM player_stats');

    console.log(`\nDatabase totals:`);
    console.log(`  nfl_teams:    ${teamCount.rows[0].count}`);
    console.log(`  players:      ${playerCount.rows[0].count}`);
    console.log(`  team_rosters: ${rosterCount.rows[0].count}`);
    console.log(`  player_stats: ${statsCount.rows[0].count}`);

    await db.end();
  } finally {
    tunnel.kill();
  }
}

backfill().catch((err) => {
  console.error('\nBackfill failed:', err.message);
  process.exit(1);
});
