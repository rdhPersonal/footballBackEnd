import { execSync, spawn, ChildProcess } from 'child_process';
import { Client } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import * as net from 'net';

const MIGRATIONS_DIR = path.join('src', 'migrations');
const LOCAL_PORT = 15432;

interface Config {
  bastionIp: string;
  bastionKeyPath: string;
  rdsHost: string;
  rdsPort: number;
  dbName: string;
  dbUser: string;
  dbPassword: string;
}

function getConfig(): Config {
  const bastionIp = process.env.BASTION_IP;
  const rdsHost = process.env.RDS_HOST;
  const dbPassword = process.env.DB_PASSWORD;

  if (!bastionIp || !rdsHost || !dbPassword) {
    console.error('Required environment variables:');
    console.error('  BASTION_IP   - Public IP of the bastion host');
    console.error('  RDS_HOST     - RDS endpoint hostname');
    console.error('  DB_PASSWORD  - Database password');
    console.error('');
    console.error('Optional:');
    console.error('  BASTION_KEY  - Path to SSH key (default: ~/.ssh/football-bastion.pem)');
    console.error('  DB_NAME      - Database name (default: football)');
    console.error('  DB_USER      - Database user (default: footballadmin)');
    console.error('  RDS_PORT     - RDS port (default: 5432)');
    process.exit(1);
  }

  return {
    bastionIp,
    bastionKeyPath: process.env.BASTION_KEY || path.join(process.env.HOME || '~', '.ssh', 'football-bastion.pem'),
    rdsHost,
    rdsPort: parseInt(process.env.RDS_PORT || '5432', 10),
    dbName: process.env.DB_NAME || 'football',
    dbUser: process.env.DB_USER || 'footballadmin',
    dbPassword,
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
  throw new Error(`Timed out waiting for port ${port} to be available`);
}

function startTunnel(config: Config): ChildProcess {
  console.log(`Opening SSH tunnel: localhost:${LOCAL_PORT} -> ${config.rdsHost}:${config.rdsPort} via ${config.bastionIp}`);

  const tunnel = spawn('ssh', [
    '-i', config.bastionKeyPath,
    '-o', 'StrictHostKeyChecking=accept-new',
    '-N',
    '-L', `${LOCAL_PORT}:${config.rdsHost}:${config.rdsPort}`,
    `ec2-user@${config.bastionIp}`,
  ], { stdio: 'pipe' });

  tunnel.stderr?.on('data', (data: Buffer) => {
    const msg = data.toString().trim();
    if (msg) console.error(`  [tunnel] ${msg}`);
  });

  return tunnel;
}

function getMigrationFiles(): string[] {
  if (!fs.existsSync(MIGRATIONS_DIR)) {
    console.error(`Migrations directory not found: ${MIGRATIONS_DIR}`);
    process.exit(1);
  }

  return fs.readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .map((f) => path.join(MIGRATIONS_DIR, f));
}

async function ensureMigrationsTable(client: Client): Promise<void> {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename    TEXT        PRIMARY KEY,
      applied_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

async function getAppliedMigrations(client: Client): Promise<Set<string>> {
  const result = await client.query('SELECT filename FROM schema_migrations');
  return new Set(result.rows.map((r: { filename: string }) => r.filename));
}

async function runMigrations() {
  const config = getConfig();
  const migrationFiles = getMigrationFiles();

  if (migrationFiles.length === 0) {
    console.log('No migration files found.');
    return;
  }

  console.log(`Found ${migrationFiles.length} migration(s):`);
  migrationFiles.forEach((f) => console.log(`  - ${path.basename(f)}`));
  console.log('');

  const tunnel = startTunnel(config);

  try {
    await waitForPort(LOCAL_PORT);
    console.log('SSH tunnel established.\n');

    const client = new Client({
      host: '127.0.0.1',
      port: LOCAL_PORT,
      database: config.dbName,
      user: config.dbUser,
      password: config.dbPassword,
      connectionTimeoutMillis: 10_000,
      ssl: { rejectUnauthorized: false },
    });

    await client.connect();
    console.log(`Connected to ${config.dbName} on ${config.rdsHost}\n`);

    await ensureMigrationsTable(client);
    const applied = await getAppliedMigrations(client);

    let appliedCount = 0;
    let skippedCount = 0;

    for (const file of migrationFiles) {
      const filename = path.basename(file);

      if (applied.has(filename)) {
        console.log(`Skipping ${filename} (already applied)`);
        skippedCount++;
        continue;
      }

      const sql = fs.readFileSync(file, 'utf-8');
      console.log(`Running ${filename}...`);

      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query(
          'INSERT INTO schema_migrations (filename) VALUES ($1)',
          [filename],
        );
        await client.query('COMMIT');
        console.log(`  ✓ ${filename} applied`);
        appliedCount++;
      } catch (err) {
        await client.query('ROLLBACK');
        throw new Error(`Migration ${filename} failed: ${err instanceof Error ? err.message : err}`);
      }
    }

    console.log(`\nMigrations complete: ${appliedCount} applied, ${skippedCount} skipped.`);
    await client.end();
  } finally {
    tunnel.kill();
  }
}

runMigrations().catch((err) => {
  console.error('\nMigration failed:', err.message);
  process.exit(1);
});
