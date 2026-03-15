import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const sendRds = vi.fn();
const sendSecrets = vi.fn();

vi.mock('@aws-sdk/client-rds', () => ({
  RDSClient: class {
    send = sendRds;
  },
  DescribeDBInstancesCommand: class {
    input: unknown;

    constructor(input: unknown) {
      this.input = input;
    }
  },
}));

vi.mock('@aws-sdk/client-secrets-manager', () => ({
  SecretsManagerClient: class {
    send = sendSecrets;
  },
  GetSecretValueCommand: class {
    input: unknown;

    constructor(input: unknown) {
      this.input = input;
    }
  },
}));

const originalEnv = { ...process.env };

describe('getDatabaseConnectionConfig', () => {
  beforeEach(() => {
    vi.resetModules();
    sendRds.mockReset();
    sendSecrets.mockReset();
    process.env = { ...originalEnv };
    delete process.env.DB_HOST;
    delete process.env.DB_PORT;
    delete process.env.DB_NAME;
    delete process.env.DB_USER;
    delete process.env.DB_PASSWORD;
    delete process.env.DB_SECRET_ARN;
    delete process.env.DB_INSTANCE_IDENTIFIER;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('falls back to RDS instance metadata when the managed secret only contains username and password', async () => {
    process.env.DB_INSTANCE_IDENTIFIER = 'football-backend-dev-db';

    sendRds.mockResolvedValue({
      DBInstances: [
        {
          DBName: 'football',
          MasterUsername: 'footballadmin',
          Endpoint: {
            Address: 'football-backend-dev-db.cwrqrc8xrxdy.us-west-2.rds.amazonaws.com',
            Port: 5432,
          },
          MasterUserSecret: {
            SecretArn: 'arn:aws:secretsmanager:us-west-2:123456789012:secret:example',
          },
        },
      ],
    });

    sendSecrets.mockResolvedValue({
      SecretString: JSON.stringify({
        username: 'footballadmin',
        password: 'super-secret',
      }),
    });

    const { getDatabaseConnectionConfig } = await import('../../src/shared/db/runtime-config');

    await expect(getDatabaseConnectionConfig()).resolves.toEqual({
      host: 'football-backend-dev-db.cwrqrc8xrxdy.us-west-2.rds.amazonaws.com',
      port: 5432,
      database: 'football',
      user: 'footballadmin',
      password: 'super-secret',
      ssl: { rejectUnauthorized: false },
    });
  });
});
