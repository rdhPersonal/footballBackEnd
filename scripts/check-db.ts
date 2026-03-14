import { Client } from 'pg';
import { spawn } from 'child_process';
import * as net from 'net';

const LOCAL_PORT = 15432;

async function waitForPort(port: number): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < 15000) {
    try {
      await new Promise<void>((resolve, reject) => {
        const sock = net.createConnection({ port, host: '127.0.0.1' }, () => { sock.destroy(); resolve(); });
        sock.on('error', reject);
      });
      return;
    } catch { await new Promise((r) => setTimeout(r, 500)); }
  }
  throw new Error('Timed out waiting for tunnel');
}

async function main() {
  const bastionIp = process.env.BASTION_IP;
  const rdsHost = process.env.RDS_HOST;
  const dbPassword = process.env.DB_PASSWORD;

  if (!bastionIp || !rdsHost || !dbPassword) {
    const missing = ['BASTION_IP', 'RDS_HOST', 'DB_PASSWORD'].filter((k) => !process.env[k]);
    console.error(`Missing required environment variables: ${missing.join(', ')}`);
    console.error('See .cursor/rules/terraform-and-scripts.mdc for how to set these.');
    process.exit(1);
  }

  const tunnel = spawn('ssh', [
    '-i', `${process.env.HOME}/.ssh/football-bastion.pem`,
    '-o', 'StrictHostKeyChecking=accept-new', '-N',
    '-L', `${LOCAL_PORT}:${rdsHost}:5432`,
    `ec2-user@${bastionIp}`,
  ], { stdio: 'pipe' });

  try {
    await waitForPort(LOCAL_PORT);
    const db = new Client({
      host: '127.0.0.1', port: LOCAL_PORT,
      database: 'football', user: 'footballadmin',
      password: dbPassword, ssl: { rejectUnauthorized: false },
    });
    await db.connect();

    const tables = await db.query(
      "SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename",
    );
    console.log('Tables:', tables.rows.map((r: { tablename: string }) => r.tablename).join(', '));

    const counts = await db.query(`
      SELECT
        (SELECT COUNT(*) FROM nfl_teams) AS nfl_teams,
        (SELECT COUNT(*) FROM players) AS players,
        (SELECT COUNT(*) FROM team_rosters) AS team_rosters,
        (SELECT COUNT(*) FROM passing_stats) AS passing_stats,
        (SELECT COUNT(*) FROM rushing_stats) AS rushing_stats,
        (SELECT COUNT(*) FROM receiving_stats) AS receiving_stats,
        (SELECT COUNT(*) FROM kicking_stats) AS kicking_stats,
        (SELECT COUNT(*) FROM scoring_configs) AS scoring_configs
    `);
    console.log('\nRow counts:');
    for (const [table, count] of Object.entries(counts.rows[0] as Record<string, string>)) {
      console.log(`  ${table}: ${count}`);
    }

    const configs = await db.query('SELECT id, name, reception_pts FROM scoring_configs ORDER BY id');
    console.log('\nScoring configs:');
    for (const row of configs.rows) {
      console.log(`  ${row.id}. ${row.name} (reception_pts: ${row.reception_pts})`);
    }

    const migrations = await db.query('SELECT filename, applied_at FROM schema_migrations ORDER BY filename');
    console.log('\nApplied migrations:');
    for (const row of migrations.rows) {
      console.log(`  ${row.filename} (${row.applied_at})`);
    }

    await db.end();
  } finally {
    tunnel.kill();
  }
}

main().catch((err) => { console.error(err.message); process.exit(1); });
