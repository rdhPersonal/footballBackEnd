import { Client } from 'pg';
import { spawn, ChildProcess } from 'child_process';
import * as net from 'net';
import {
  fetchTeams,
  fetchTeamRoster,
  fetchPlayerGamelog,
  delay,
  type EspnPlayer,
  type EspnGameStat,
} from '../src/shared/external-api/client';
import { getAdminDbConfig, type AdminDbConfig } from './lib/db-admin-config';

const LOCAL_PORT = 15432;
const SEASONS = [2023, 2024, 2025];
const API_DELAY_MS = 300;

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

function startTunnel(config: AdminDbConfig): ChildProcess {
  console.log(`Opening SSH tunnel via ${config.bastionIp}...`);
  const tunnel = spawn('ssh', [
    '-i', config.bastionKeyPath,
    '-o', 'StrictHostKeyChecking=accept-new',
    '-N',
    '-L', `${LOCAL_PORT}:${config.rdsHost}:${config.rdsPort}`,
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
  rosterStatus: string,
  transactionType: string,
) {
  await db.query(
    `INSERT INTO team_rosters (player_id, team_abbr, season, week_start, week_end, roster_status, transaction_type)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (player_id, season, week_start) DO UPDATE SET
       team_abbr = EXCLUDED.team_abbr,
       week_end = GREATEST(team_rosters.week_end, EXCLUDED.week_end),
       roster_status = EXCLUDED.roster_status,
       transaction_type = EXCLUDED.transaction_type`,
    [playerId, teamAbbr, season, weekStart, weekEnd, rosterStatus, transactionType],
  );
}

type DerivedStint = {
  teamAbbr: string;
  weekStart: number;
  weekEnd: number;
  rosterStatus: 'active' | 'practice_squad';
  transactionType:
    | 'signed'
    | 'traded'
    | 'promoted'
    | 'demoted';
};

function deriveRosterStintsFromGames(games: EspnGameStat[], fallbackTeamAbbr: string): DerivedStint[] {
  if (games.length === 0) return [];

  const normalized = games
    .map((g) => ({
      ...g,
      teamAbbr: g.teamAbbr || fallbackTeamAbbr || 'UNK',
    }))
    .sort((a, b) => a.week - b.week);

  const stints: DerivedStint[] = [];
  let prev: DerivedStint | null = null;

  for (const game of normalized) {
    if (!prev) {
      prev = {
        teamAbbr: game.teamAbbr,
        weekStart: game.week,
        weekEnd: game.week,
        rosterStatus: 'active',
        transactionType: 'signed',
      };
      stints.push(prev);
      continue;
    }

    const sameTeam: boolean = prev.teamAbbr === game.teamAbbr;
    const contiguous: boolean = game.week === prev.weekEnd + 1;

    if (sameTeam && contiguous) {
      prev.weekEnd = game.week;
      continue;
    }

    const gapStart = prev.weekEnd + 1;
    const gapEnd = game.week - 1;
    if (sameTeam && gapStart <= gapEnd) {
      stints.push({
        teamAbbr: game.teamAbbr,
        weekStart: gapStart,
        weekEnd: gapEnd,
        rosterStatus: 'practice_squad',
        transactionType: 'demoted',
      });
    }

    prev = {
      teamAbbr: game.teamAbbr,
      weekStart: game.week,
      weekEnd: game.week,
      rosterStatus: 'active',
      transactionType: sameTeam ? 'promoted' : 'traded',
    };
    stints.push(prev);
  }

  return stints;
}

async function upsertGameStats(
  db: Client,
  playerId: string,
  teamAbbr: string,
  season: number,
  week: number,
  eventId: string,
  statDetails: Record<string, string>,
) {
  await db.query(
    `INSERT INTO player_stats (player_id, team_abbr, season, week, event_id, games_played, total_points, stat_details)
     VALUES ($1, $2, $3, $4, $5, 1, 0, $6)
     ON CONFLICT (player_id, season, week) DO UPDATE SET
       team_abbr = EXCLUDED.team_abbr,
       event_id = EXCLUDED.event_id,
       stat_details = EXCLUDED.stat_details,
       updated_at = NOW()`,
    [playerId, teamAbbr, season, week, eventId, JSON.stringify(statDetails)],
  );
}

async function backfill() {
  const config = await getAdminDbConfig();
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

    const teamData = espnTeams.map((t) => ({ abbr: t.abbreviation, name: t.displayName }));
    for (const season of SEASONS) {
      await upsertTeams(db, teamData, season);
    }
    console.log(`Teams inserted for seasons: ${SEASONS.join(', ')}\n`);

    // Step 2: Fetch rosters per season and discover players with per-season team attribution.
    // Fetching per-season rosters ensures historical team associations are captured correctly
    // (e.g. a player traded from BUF to KC mid-2024 shows up on BUF's 2023 roster).
    console.log('=== Step 2: Fetching per-season rosters and player data ===');

    const playerIndex = new Map<string, { player: EspnPlayer; dbId: string }>();
    const playerTeamsBySeason = new Map<string, Map<number, string>>();

    for (const season of SEASONS) {
      console.log(`  Season ${season}:`);
      for (const team of espnTeams) {
        process.stdout.write(`    ${team.abbreviation}: `);
        await delay(API_DELAY_MS);

        try {
          const roster = await fetchTeamRoster(team.espnId, season);
          let newCount = 0;

          for (const player of roster) {
            if (!playerIndex.has(player.espnId)) {
              const dbId = await upsertPlayer(db, player);
              playerIndex.set(player.espnId, { player, dbId });
              newCount++;
            }

            if (!playerTeamsBySeason.has(player.espnId)) {
              playerTeamsBySeason.set(player.espnId, new Map());
            }
            playerTeamsBySeason.get(player.espnId)!.set(season, team.abbreviation);
          }

          console.log(`${roster.length} players (${newCount} new)`);
        } catch (err) {
          console.log(`ERROR: ${err instanceof Error ? err.message : err}`);
        }
      }
    }

    console.log(`\nTotal unique players discovered: ${playerIndex.size}\n`);

    // Step 3: Fetch gamelogs and build roster stints + stats
    console.log('=== Step 3: Fetching gamelogs for all players ===');

    const skillPlayers = [...playerIndex.values()].filter((p) =>
      ['QB', 'RB', 'WR', 'TE', 'K'].includes(p.player.positionAbbr),
    );
    console.log(`Fetching gamelogs for ${skillPlayers.length} skill-position players across ${SEASONS.length} seasons.\n`);

    let processed = 0;
    let statsInserted = 0;
    const failures: Array<{ player: string; espnId: string; season: number; error: string }> = [];

    for (const { player, dbId } of skillPlayers) {
      processed++;
      if (processed % 50 === 0 || processed === skillPlayers.length) {
        console.log(`  Progress: ${processed}/${skillPlayers.length} players (${statsInserted} stat rows inserted, ${failures.length} failures)`);
      }

      const seasonTeams = playerTeamsBySeason.get(player.espnId) ?? new Map<number, string>();

      for (const season of SEASONS) {
        await delay(API_DELAY_MS);

        // Resolve team for this season: prefer per-season roster, fall back to latest known
        const teamAbbr = seasonTeams.get(season)
          ?? seasonTeams.get(Math.max(...seasonTeams.keys()))
          ?? 'UNK';

        try {
          const gamelog = await fetchPlayerGamelog(player.espnId, season);
          if (!gamelog || gamelog.games.length === 0) continue;

          const sortedGames = [...gamelog.games].sort((a, b) => a.week - b.week);
          const derivedStints = deriveRosterStintsFromGames(sortedGames, teamAbbr);

          // Wrap roster + stats writes for this player-season in a transaction
          await db.query('BEGIN');
          try {
            // Replace stints for this player-season so reruns converge deterministically.
            await db.query(
              'DELETE FROM team_rosters WHERE player_id = $1 AND season = $2',
              [dbId, season],
            );

            for (const stint of derivedStints) {
              await upsertRosterStint(
                db,
                dbId,
                stint.teamAbbr,
                season,
                stint.weekStart,
                stint.weekEnd,
                stint.rosterStatus,
                stint.transactionType,
              );
            }

            for (const game of sortedGames) {
              const gameTeam = game.teamAbbr || teamAbbr || 'UNK';
              await upsertGameStats(db, dbId, gameTeam, season, game.week, game.eventId, game.stats);
              statsInserted++;
            }

            await db.query('COMMIT');
          } catch (txErr) {
            await db.query('ROLLBACK');
            throw txErr;
          }
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : String(err);
          failures.push({
            player: player.fullName,
            espnId: player.espnId,
            season,
            error: errorMsg,
          });
          console.error(`  [WARN] Failed: ${player.fullName} (${player.espnId}) season ${season}: ${errorMsg}`);
        }
      }
    }

    console.log(`\nBackfill complete!`);
    console.log(`  Players: ${playerIndex.size}`);
    console.log(`  Stat rows: ${statsInserted}`);
    console.log(`  Seasons: ${SEASONS.join(', ')}`);

    if (failures.length > 0) {
      console.warn(`\n${failures.length} failure(s) during backfill:`);
      for (const f of failures) {
        console.warn(`  - ${f.player} (${f.espnId}) season ${f.season}: ${f.error}`);
      }
    }

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
