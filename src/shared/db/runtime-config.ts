import { DescribeDBInstancesCommand, RDSClient } from '@aws-sdk/client-rds';
import { GetSecretValueCommand, SecretsManagerClient } from '@aws-sdk/client-secrets-manager';

type DbSecretPayload = {
  username?: string;
  password?: string;
  host?: string;
  port?: number | string;
  dbname?: string;
};

type DbInstanceMetadata = {
  secretArn?: string;
  host?: string;
  port?: number;
  dbname?: string;
  username?: string;
};

export type DatabaseConnectionConfig = {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  ssl: { rejectUnauthorized: false };
};

const secretsClient = new SecretsManagerClient({});
const rdsClient = new RDSClient({});

let dbInstanceMetadataPromise: Promise<DbInstanceMetadata | null> | null = null;
let dbSecretPromise: Promise<DbSecretPayload | null> | null = null;

async function getDbInstanceMetadata(): Promise<DbInstanceMetadata | null> {
  const dbInstanceIdentifier = process.env.DB_INSTANCE_IDENTIFIER;
  if (!dbInstanceIdentifier) return null;

  if (!dbInstanceMetadataPromise) {
    dbInstanceMetadataPromise = loadDbInstanceMetadata(dbInstanceIdentifier).catch((error) => {
      dbInstanceMetadataPromise = null;
      throw error;
    });
  }

  return dbInstanceMetadataPromise;
}

async function getDbSecretId(): Promise<string | null> {
  const secretArn = process.env.DB_SECRET_ARN;
  if (secretArn) return secretArn;

  const metadata = await getDbInstanceMetadata();
  return metadata?.secretArn ?? null;
}

async function loadDbInstanceMetadata(dbInstanceIdentifier: string): Promise<DbInstanceMetadata> {
  const response = await rdsClient.send(
    new DescribeDBInstancesCommand({ DBInstanceIdentifier: dbInstanceIdentifier }),
  );

  const dbInstance = response.DBInstances?.[0];
  if (!dbInstance) {
    throw new Error(`DB instance ${dbInstanceIdentifier} was not found`);
  }

  const secretArn = dbInstance.MasterUserSecret?.SecretArn;
  if (!secretArn) {
    throw new Error(`DB instance ${dbInstanceIdentifier} does not have a managed master user secret`);
  }

  return {
    secretArn,
    host: dbInstance.Endpoint?.Address,
    port: dbInstance.Endpoint?.Port,
    dbname: dbInstance.DBName ?? undefined,
    username: dbInstance.MasterUsername ?? undefined,
  };
}

async function getDbSecret(): Promise<DbSecretPayload | null> {
  const secretId = await getDbSecretId();
  if (!secretId) return null;

  if (!dbSecretPromise) {
    dbSecretPromise = loadDbSecret(secretId).catch((error) => {
      dbSecretPromise = null;
      throw error;
    });
  }

  return dbSecretPromise;
}

async function loadDbSecret(secretId: string): Promise<DbSecretPayload> {
  const response = await secretsClient.send(
    new GetSecretValueCommand({ SecretId: secretId }),
  );

  if (!response.SecretString) {
    throw new Error(`Secret ${secretId} does not contain a SecretString payload`);
  }

  return JSON.parse(response.SecretString) as DbSecretPayload;
}

export async function getDatabaseConnectionConfig(
  overrides: Partial<Omit<DatabaseConnectionConfig, 'ssl'>> = {},
): Promise<DatabaseConnectionConfig> {
  const metadata = await getDbInstanceMetadata();
  const secret = await getDbSecret();

  const host = overrides.host ?? process.env.DB_HOST ?? secret?.host ?? metadata?.host;
  const port = overrides.port
    ?? parseInt(process.env.DB_PORT || String(secret?.port ?? metadata?.port ?? '5432'), 10);
  const database = overrides.database ?? process.env.DB_NAME ?? secret?.dbname ?? metadata?.dbname ?? 'football';
  const user = overrides.user ?? process.env.DB_USER ?? secret?.username ?? metadata?.username;
  const password = overrides.password ?? process.env.DB_PASSWORD ?? secret?.password;

  if (!host || !user || !password || Number.isNaN(port)) {
    throw new Error(
      'Database configuration is incomplete. Set DB_SECRET_ARN or DB_INSTANCE_IDENTIFIER for AWS-managed credentials, or provide DB_HOST, DB_USER, and DB_PASSWORD explicitly.',
    );
  }

  return {
    host,
    port,
    database,
    user,
    password,
    ssl: { rejectUnauthorized: false },
  };
}
