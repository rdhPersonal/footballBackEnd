import { Client } from 'pg';
import { spawn, ChildProcess } from 'child_process';
import * as net from 'net';
import {
  fetchTeams,
  fetchTeamRoster,
  fetchPlayerGamelog,
  delay,
  type EspnPlayer,
} from '../src/shared/external-api/client';
import { deriveRosterStintsFromGames } from '../src/shared/roster-stints';

const LOCAL_PORT = 15432;
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

interface CliArgs {
  season: number;
  weekStart: number;
  weekEnd: number;
  clean: boolean;
}

function printUsage() {
  console.log(`
Usage: tsx scripts/load-season.ts --season <year> [options]

Options:
  --season <year>           Season to load (default: 2023)
  --week <n>                Load a single week (shorthand for --week-start N --week-end N)
  --week-start <n>          Start of week range (default: 1)
  --week-end <n>            End of week range (default: 18 with --full-season, 4 otherwise)
  --full-season             Load all 18 weeks
  --clean                   Delete existing data in the target range before loading

Examples:
  # Load 2023 weeks 1-4 (default)
  tsx scripts/load-season.ts

  # Load a single week
  tsx scripts/load-season.ts --season 2024 --week 5

  # Load weeks 5-8
  tsx scripts/load-season.ts --season 2023 --week-start 5 --week-end 8

  # Load full season
  tsx scripts/load-season.ts --season 2023 --full-season

  # Clean and reload week 3
  tsx scripts/load-season.ts --season 2023 --week 3 --clean
`);
}

function parseArgs(): CliArgs {
  const args = process.argv.slice(2);
  let season = 2023;
  let week: number | undefined;
  let weekStart: number | undefined;
  let weekEnd: number | undefined;
  let fullSeason = false;
  let clean = false;

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--season':
        season = parseInt(args[++i], 10);
        break;
      case '--week':
        week = parseInt(args[++i], 10);
        break;
      case '--week-start':
        weekStart = parseInt(args[++i], 10);
        break;
      case '--week-end':
        weekEnd = parseInt(args[++i], 10);
        break;
      case '--full-season':
        fullSeason = true;
        break;
      case '--clean':
        clean = true;
        break;
      case '--help':
        printUsage();
        process.exit(0);
        break;
      default:
        console.error(`Unknown argument: ${args[i]}`);
        printUsage();
        process.exit(1);
    }
  }

  if (week !== undefined) {
    if (weekStart !== undefined || weekEnd !== undefined || fullSeason) {
      console.error('Cannot use --week together with --week-start/--week-end/--full-season');
      process.exit(1);
    }
    weekStart = week;
    weekEnd = week;
  }

  if (fullSeason) {
    weekStart = 1;
    weekEnd = 18;
  }

  const resolvedStart = weekStart ?? 1;
  const resolvedEnd = weekEnd ?? (fullSeason ? 18 : 4);

  if (Number.isNaN(season) || season < 2000 || season > 2100) {
    console.error('Invalid season');
    process.exit(1);
  }
  if (Number.isNaN(resolvedStart) || resolvedStart < 1 || resolvedStart > 18) {
    console.error('Invalid week-start (must be 1-18)');
    process.exit(1);
  }
  if (Number.isNaN(resolvedEnd) || resolvedEnd < resolvedStart || resolvedEnd > 18) {
    console.error('Invalid week-end (must be >= week-start and <= 18)');
    process.exit(1);
  }

  return { season, weekStart: resolvedStart, weekEnd: resolvedEnd, clean };
}

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

async function cleanSeasonData(db: Client, season: number, weekStart: number, weekEnd: number) {
  console.log(`Cleaning existing data for season ${season}, weeks ${weekStart}-${weekEnd}...`);

  const statsResult = await db.query(
    'DELETE FROM player_stats WHERE season = $1 AND week >= $2 AND week <= $3',
    [season, weekStart, weekEnd],
  );
  console.log(`  Deleted ${statsResult.rowCount} player_stats rows`);

  const rostersResult = await db.query(
    'DELETE FROM team_rosters WHERE season = $1 AND week_start >= $2 AND week_start <= $3',
    [season, weekStart, weekEnd],
  );
  console.log(`  Deleted ${rostersResult.rowCount} team_rosters rows`);
}

async function loadSeason() {
  const cliArgs = parseArgs();
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
    console.log(`Loading season ${cliArgs.season}, weeks ${cliArgs.weekStart}-${cliArgs.weekEnd}`);
    console.log(`Clean mode: ${cliArgs.clean ? 'YES' : 'NO'}\n`);

    if (cliArgs.clean) {
      await cleanSeasonData(db, cliArgs.season, cliArgs.weekStart, cliArgs.weekEnd);
      console.log();
    }

    console.log('=== Step 1: Fetching NFL teams ===');
    const espnTeams = await fetchTeams();
    console.log(`Found ${espnTeams.length} teams.`);

    const teamData = espnTeams.map((t) => ({ abbr: t.abbreviation, name: t.displayName }));
    await upsertTeams(db, teamData, cliArgs.season);
    console.log(`Teams upserted for season ${cliArgs.season}\n`);

    console.log('=== Step 2: Fetching rosters and discovering players ===');
    const playerIndex = new Map<string, { player: EspnPlayer; dbId: string }>();
    const playerTeams = new Map<string, string>();

    for (const team of espnTeams) {
      process.stdout.write(`  ${team.abbreviation}: `);
      await delay(API_DELAY_MS);

      try {
        const roster = await fetchTeamRoster(team.espnId, cliArgs.season);
        let newCount = 0;

        for (const player of roster) {
          if (!playerIndex.has(player.espnId)) {
            const dbId = await upsertPlayer(db, player);
            playerIndex.set(player.espnId, { player, dbId });
            newCount++;
          }
          playerTeams.set(player.espnId, team.abbreviation);
        }

        console.log(`${roster.length} players (${newCount} new)`);
      } catch (err) {
        console.log(`ERROR: ${err instanceof Error ? err.message : err}`);
      }
    }

    console.log(`\nTotal unique players discovered: ${playerIndex.size}\n`);

    console.log('=== Step 3: Fetching gamelogs (filtered to specified weeks) ===');
    const skillPlayers = [...playerIndex.values()].filter((p) =>
      ['QB', 'RB', 'WR', 'TE', 'K'].includes(p.player.positionAbbr),
    );
    console.log(`Processing ${skillPlayers.length} skill-position players for weeks ${cliArgs.weekStart}-${cliArgs.weekEnd}.\n`);

    let processed = 0;
    let statsInserted = 0;
    const failures: Array<{ player: string; espnId: string; error: string }> = [];

    for (const { player, dbId } of skillPlayers) {
      processed++;
      if (processed % 50 === 0 || processed === skillPlayers.length) {
        console.log(`  Progress: ${processed}/${skillPlayers.length} players (${statsInserted} stat rows, ${failures.length} failures)`);
      }

      const teamAbbr = playerTeams.get(player.espnId) ?? 'UNK';

      await delay(API_DELAY_MS);

      try {
        const gamelog = await fetchPlayerGamelog(player.espnId, cliArgs.season);
        if (!gamelog || gamelog.games.length === 0) continue;

        const filteredGames = gamelog.games
          .filter((g) => g.week >= cliArgs.weekStart && g.week <= cliArgs.weekEnd)
          .sort((a, b) => a.week - b.week);

        if (filteredGames.length === 0) continue;

        const derivedStints = deriveRosterStintsFromGames(filteredGames, teamAbbr);

        await db.query('BEGIN');
        try {
          for (const stint of derivedStints) {
            await db.query(
              `INSERT INTO team_rosters (player_id, team_abbr, season, week_start, week_end, roster_status, transaction_type)
               VALUES ($1, $2, $3, $4, $5, $6, $7)
               ON CONFLICT (player_id, season, week_start) DO UPDATE SET
                 team_abbr = EXCLUDED.team_abbr,
                 week_end = GREATEST(team_rosters.week_end, EXCLUDED.week_end),
                 roster_status = EXCLUDED.roster_status,
                 transaction_type = EXCLUDED.transaction_type`,
              [dbId, stint.teamAbbr, cliArgs.season, stint.weekStart, stint.weekEnd, stint.rosterStatus, stint.transactionType],
            );
          }

          for (const game of filteredGames) {
            const gameTeam = game.teamAbbr || teamAbbr || 'UNK';
            await db.query(
              `INSERT INTO player_stats (player_id, team_abbr, season, week, event_id, games_played, total_points, stat_details)
               VALUES ($1, $2, $3, $4, $5, 1, 0, $6)
               ON CONFLICT (player_id, season, week) DO UPDATE SET
                 team_abbr = EXCLUDED.team_abbr,
                 event_id = EXCLUDED.event_id,
                 stat_details = EXCLUDED.stat_details,
                 updated_at = NOW()`,
              [dbId, gameTeam, cliArgs.season, game.week, game.eventId, JSON.stringify(game.stats)],
            );
            statsInserted++;
          }

          await db.query('COMMIT');
        } catch (txErr) {
          await db.query('ROLLBACK');
          throw txErr;
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        failures.push({ player: player.fullName, espnId: player.espnId, error: errorMsg });
        console.error(`  [WARN] Failed: ${player.fullName} (${player.espnId}): ${errorMsg}`);
      }
    }

    console.log(`\nLoad complete!`);
    console.log(`  Season: ${cliArgs.season}`);
    console.log(`  Weeks: ${cliArgs.weekStart}-${cliArgs.weekEnd}`);
    console.log(`  Players discovered: ${playerIndex.size}`);
    console.log(`  Stat rows inserted: ${statsInserted}`);

    if (failures.length > 0) {
      console.warn(`\n${failures.length} failure(s):`);
      for (const f of failures) {
        console.warn(`  - ${f.player} (${f.espnId}): ${f.error}`);
      }
    }

    const teamCount = await db.query('SELECT COUNT(*) FROM nfl_teams WHERE season = $1', [cliArgs.season]);
    const statsCount = await db.query(
      'SELECT COUNT(*) FROM player_stats WHERE season = $1 AND week >= $2 AND week <= $3',
      [cliArgs.season, cliArgs.weekStart, cliArgs.weekEnd],
    );
    const rosterCount = await db.query(
      'SELECT COUNT(*) FROM team_rosters WHERE season = $1 AND week_start >= $2 AND week_start <= $3',
      [cliArgs.season, cliArgs.weekStart, cliArgs.weekEnd],
    );
    const playerCount = await db.query('SELECT COUNT(*) FROM players');

    console.log(`\nDatabase totals (for loaded range):`);
    console.log(`  nfl_teams (${cliArgs.season}):  ${teamCount.rows[0].count}`);
    console.log(`  players (all):                   ${playerCount.rows[0].count}`);
    console.log(`  team_rosters (weeks ${cliArgs.weekStart}-${cliArgs.weekEnd}): ${rosterCount.rows[0].count}`);
    console.log(`  player_stats (weeks ${cliArgs.weekStart}-${cliArgs.weekEnd}): ${statsCount.rows[0].count}`);

    await db.end();
  } finally {
    tunnel.kill();
  }
}

loadSeason().catch((err) => {
  console.error('\nLoad failed:', err.message);
  process.exit(1);
});
