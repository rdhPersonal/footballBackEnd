import { getDatabaseConnectionConfig } from '../../src/shared/db/runtime-config';

export interface AdminDbConfig {
  bastionIp: string;
  bastionKeyPath: string;
  rdsHost: string;
  rdsPort: number;
  dbName: string;
  dbUser: string;
  dbPassword: string;
}

export async function getAdminDbConfig(): Promise<AdminDbConfig> {
  const bastionIp = process.env.BASTION_IP;

  if (!bastionIp) {
    console.error('Required environment variables:');
    console.error('  BASTION_IP   - Public IP of the bastion host');
    console.error('');
    console.error('Database credentials can come from either of these sources:');
    console.error('  DB_INSTANCE_IDENTIFIER - RDS instance identifier for managed secret lookup');
    console.error('  DB_SECRET_ARN          - Secrets Manager ARN for the RDS master secret');
    console.error('  DB_PASSWORD            - Raw database password (legacy/manual fallback)');
    process.exit(1);
  }

  const connection = await getDatabaseConnectionConfig({
    host: process.env.RDS_HOST,
    port: process.env.RDS_PORT ? parseInt(process.env.RDS_PORT, 10) : undefined,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
  });

  return {
    bastionIp,
    bastionKeyPath: process.env.BASTION_KEY || `${process.env.HOME}/.ssh/football-bastion.pem`,
    rdsHost: connection.host,
    rdsPort: connection.port,
    dbName: connection.database,
    dbUser: connection.user,
    dbPassword: connection.password,
  };
}
