import { Client } from 'pg';
import { spawn, ChildProcess } from 'child_process';
import * as net from 'net';

const LOCAL_PORT = 15432;
const STAT_TABLES = ['passing_stats', 'rushing_stats', 'receiving_stats', 'kicking_stats'] as const;

interface CliArgs {
  season: number;
  weekStart: number | null;
  weekEnd: number | null;
  includeTeams: boolean;
  includePlayers: boolean;
  dryRun: boolean;
}

function printUsage() {
  console.log(`
Usage: tsx scripts/clear-season.ts --season <year> [options]

Options:
  --season <year>           Season to clear (required)
  --week <n>                Clear a single week
  --week-start <n>          Start of week range to clear
  --week-end <n>            End of week range to clear
  --include-teams           Also delete nfl_teams rows for this season
  --include-players         Also delete orphaned players (no remaining stats or rosters)
  --dry-run                 Show what would be deleted without actually deleting

Examples:
  # Preview what clearing the full 2023 season would do
  tsx scripts/clear-season.ts --season 2023 --dry-run

  # Clear all stats and rosters for 2023
  tsx scripts/clear-season.ts --season 2023

  # Clear just week 5
  tsx scripts/clear-season.ts --season 2023 --week 5

  # Clear weeks 5-8
  tsx scripts/clear-season.ts --season 2023 --week-start 5 --week-end 8

  # Clear everything including team rows and orphaned players
  tsx scripts/clear-season.ts --season 2023 --include-teams --include-players
`);
}

function parseArgs(): CliArgs {
  const args = process.argv.slice(2);
  let season: number | undefined;
  let week: number | undefined;
  let weekStart: number | undefined;
  let weekEnd: number | undefined;
  let includeTeams = false;
  let includePlayers = false;
  let dryRun = false;

  if (args.length === 0) {
    printUsage();
    process.exit(0);
  }

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
      case '--include-teams':
        includeTeams = true;
        break;
      case '--include-players':
        includePlayers = true;
        break;
      case '--dry-run':
        dryRun = true;
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

  if (!season || Number.isNaN(season) || season < 2000 || season > 2100) {
    console.error('--season is required and must be a valid year (2000-2100)');
    process.exit(1);
  }

  if (week !== undefined) {
    if (weekStart !== undefined || weekEnd !== undefined) {
      console.error('Cannot use --week together with --week-start/--week-end');
      process.exit(1);
    }
    weekStart = week;
    weekEnd = week;
  }

  if (weekStart !== undefined && weekEnd === undefined) weekEnd = weekStart;
  if (weekEnd !== undefined && weekStart === undefined) weekStart = weekEnd;

  if (weekStart !== undefined && (Number.isNaN(weekStart) || weekStart < 1 || weekStart > 18)) {
    console.error('Week start must be 1-18');
    process.exit(1);
  }
  if (weekEnd !== undefined && (Number.isNaN(weekEnd) || weekEnd < weekStart! || weekEnd > 18)) {
    console.error('Week end must be >= week start and <= 18');
    process.exit(1);
  }

  return {
    season,
    weekStart: weekStart ?? null,
    weekEnd: weekEnd ?? null,
    includeTeams,
    includePlayers,
    dryRun,
  };
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
    console.error('Required env vars: BASTION_IP, RDS_HOST, DB_PASSWORD');
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

function weekLabel(args: CliArgs): string {
  if (args.weekStart === null) return 'all weeks';
  if (args.weekStart === args.weekEnd) return `week ${args.weekStart}`;
  return `weeks ${args.weekStart}-${args.weekEnd}`;
}

async function previewCounts(db: Client, args: CliArgs) {
  const weekFilter = args.weekStart !== null;

  const statCounts: Record<string, number> = {};
  for (const table of STAT_TABLES) {
    const result = await db.query(
      weekFilter
        ? `SELECT COUNT(*) FROM ${table} WHERE season = $1 AND week >= $2 AND week <= $3`
        : `SELECT COUNT(*) FROM ${table} WHERE season = $1`,
      weekFilter ? [args.season, args.weekStart, args.weekEnd] : [args.season],
    );
    statCounts[table] = parseInt(result.rows[0].count, 10);
  }

  const rosterCount = await db.query(
    weekFilter
      ? 'SELECT COUNT(*) FROM team_rosters WHERE season = $1 AND week_start <= $3 AND COALESCE(week_end, 18) >= $2'
      : 'SELECT COUNT(*) FROM team_rosters WHERE season = $1',
    weekFilter ? [args.season, args.weekStart, args.weekEnd] : [args.season],
  );

  let teamCount = { rows: [{ count: '0' }] };
  if (args.includeTeams) {
    teamCount = await db.query('SELECT COUNT(*) FROM nfl_teams WHERE season = $1', [args.season]);
  }

  let orphanCount = { rows: [{ count: '0' }] };
  if (args.includePlayers) {
    const statExistsClauses = STAT_TABLES
      .map((t) => `NOT EXISTS (SELECT 1 FROM ${t} s WHERE s.player_id = p.id)`)
      .join(' AND ');
    orphanCount = await db.query(`
      SELECT COUNT(*) FROM players p
      WHERE ${statExistsClauses}
        AND NOT EXISTS (SELECT 1 FROM team_rosters tr WHERE tr.player_id = p.id)
    `);
  }

  return {
    statCounts,
    rosters: parseInt(rosterCount.rows[0].count, 10),
    teams: parseInt(teamCount.rows[0].count, 10),
    orphanedPlayers: parseInt(orphanCount.rows[0].count, 10),
  };
}

async function clearSeason() {
  const args = parseArgs();
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

    const scope = `season ${args.season}, ${weekLabel(args)}`;
    console.log(`Target: ${scope}`);
    if (args.includeTeams) console.log('  + nfl_teams rows for this season');
    if (args.includePlayers) console.log('  + orphaned players (no remaining stats or rosters)');
    console.log();

    const counts = await previewCounts(db, args);
    console.log('Rows to be deleted:');
    for (const [table, ct] of Object.entries(counts.statCounts)) {
      console.log(`  ${table}: ${ct}`);
    }
    console.log(`  team_rosters:  ${counts.rosters}`);
    if (args.includeTeams) console.log(`  nfl_teams:     ${counts.teams}`);
    if (args.includePlayers) console.log(`  players (orphaned): ${counts.orphanedPlayers}`);

    const totalStats = Object.values(counts.statCounts).reduce((a, b) => a + b, 0);
    const total = totalStats + counts.rosters + counts.teams + counts.orphanedPlayers;
    if (total === 0) {
      console.log('\nNothing to delete.');
      await db.end();
      return;
    }

    if (args.dryRun) {
      console.log('\n[DRY RUN] No data was deleted.');
      await db.end();
      return;
    }

    console.log('\nDeleting...');
    const weekFilter = args.weekStart !== null;

    await db.query('BEGIN');
    try {
      for (const table of STAT_TABLES) {
        const result = await db.query(
          weekFilter
            ? `DELETE FROM ${table} WHERE season = $1 AND week >= $2 AND week <= $3`
            : `DELETE FROM ${table} WHERE season = $1`,
          weekFilter ? [args.season, args.weekStart, args.weekEnd] : [args.season],
        );
        console.log(`  ${table}: ${result.rowCount} deleted`);
      }

      const rostersResult = await db.query(
        weekFilter
          ? 'DELETE FROM team_rosters WHERE season = $1 AND week_start <= $3 AND COALESCE(week_end, 18) >= $2'
          : 'DELETE FROM team_rosters WHERE season = $1',
        weekFilter ? [args.season, args.weekStart, args.weekEnd] : [args.season],
      );
      console.log(`  team_rosters:  ${rostersResult.rowCount} deleted`);

      if (args.includeTeams) {
        const teamsResult = await db.query(
          'DELETE FROM nfl_teams WHERE season = $1',
          [args.season],
        );
        console.log(`  nfl_teams:     ${teamsResult.rowCount} deleted`);
      }

      if (args.includePlayers) {
        const statExistsClauses = STAT_TABLES
          .map((t) => `NOT EXISTS (SELECT 1 FROM ${t} s WHERE s.player_id = p.id)`)
          .join(' AND ');
        const playersResult = await db.query(`
          DELETE FROM players p
          WHERE ${statExistsClauses}
            AND NOT EXISTS (SELECT 1 FROM team_rosters tr WHERE tr.player_id = p.id)
        `);
        console.log(`  players:       ${playersResult.rowCount} orphans deleted`);
      }

      await db.query('COMMIT');
    } catch (err) {
      await db.query('ROLLBACK');
      throw err;
    }

    console.log('\nDone.');

    const remaining = await db.query(`
      SELECT
        (SELECT COUNT(*) FROM nfl_teams) AS teams,
        (SELECT COUNT(*) FROM players) AS players,
        (SELECT COUNT(*) FROM team_rosters) AS rosters,
        (SELECT COUNT(*) FROM passing_stats) AS passing,
        (SELECT COUNT(*) FROM rushing_stats) AS rushing,
        (SELECT COUNT(*) FROM receiving_stats) AS receiving,
        (SELECT COUNT(*) FROM kicking_stats) AS kicking
    `);
    const r = remaining.rows[0];
    console.log(`\nRemaining in database:`);
    console.log(`  nfl_teams:       ${r.teams}`);
    console.log(`  players:         ${r.players}`);
    console.log(`  team_rosters:    ${r.rosters}`);
    console.log(`  passing_stats:   ${r.passing}`);
    console.log(`  rushing_stats:   ${r.rushing}`);
    console.log(`  receiving_stats: ${r.receiving}`);
    console.log(`  kicking_stats:   ${r.kicking}`);

    await db.end();
  } finally {
    tunnel.kill();
  }
}

clearSeason().catch((err) => {
  console.error('\nClear failed:', err.message);
  process.exit(1);
});
