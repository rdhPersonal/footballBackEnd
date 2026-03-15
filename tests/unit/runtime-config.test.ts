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
const loadSubject = () => import('../../src/shared/db/runtime-config');

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

    const { getDatabaseConnectionConfig } = await loadSubject();

    await expect(getDatabaseConnectionConfig()).resolves.toEqual({
      host: 'football-backend-dev-db.cwrqrc8xrxdy.us-west-2.rds.amazonaws.com',
      port: 5432,
      database: 'football',
      user: 'footballadmin',
      password: 'super-secret',
      ssl: { rejectUnauthorized: false },
    });
  });

  it('uses direct environment variables when no managed secret configuration is present', async () => {
    process.env.DB_HOST = '127.0.0.1';
    process.env.DB_PORT = '5432';
    process.env.DB_NAME = 'football';
    process.env.DB_USER = 'footballadmin';
    process.env.DB_PASSWORD = 'local-password';

    const { getDatabaseConnectionConfig } = await loadSubject();

    await expect(getDatabaseConnectionConfig()).resolves.toEqual({
      host: '127.0.0.1',
      port: 5432,
      database: 'football',
      user: 'footballadmin',
      password: 'local-password',
      ssl: { rejectUnauthorized: false },
    });

    expect(sendRds).not.toHaveBeenCalled();
    expect(sendSecrets).not.toHaveBeenCalled();
  });

  it('supports the DB_SECRET_ARN path without describing the DB instance', async () => {
    process.env.DB_SECRET_ARN = 'arn:aws:secretsmanager:us-west-2:123456789012:secret:example';

    sendSecrets.mockResolvedValue({
      SecretString: JSON.stringify({
        host: 'db.example.com',
        port: 5432,
        dbname: 'football',
        username: 'footballadmin',
        password: 'super-secret',
      }),
    });

    const { getDatabaseConnectionConfig } = await loadSubject();

    await expect(getDatabaseConnectionConfig()).resolves.toEqual({
      host: 'db.example.com',
      port: 5432,
      database: 'football',
      user: 'footballadmin',
      password: 'super-secret',
      ssl: { rejectUnauthorized: false },
    });

    expect(sendRds).not.toHaveBeenCalled();
  });

  it('throws a descriptive error when the DB instance cannot be found', async () => {
    process.env.DB_INSTANCE_IDENTIFIER = 'missing-db';
    sendRds.mockResolvedValue({ DBInstances: [] });

    const { getDatabaseConnectionConfig } = await loadSubject();

    await expect(getDatabaseConnectionConfig()).rejects.toThrow(
      'DB instance missing-db was not found',
    );
  });

  it('throws a descriptive error when the secret payload is malformed JSON', async () => {
    process.env.DB_SECRET_ARN = 'arn:aws:secretsmanager:us-west-2:123456789012:secret:broken';
    sendSecrets.mockResolvedValue({ SecretString: 'not-json' });

    const { getDatabaseConnectionConfig } = await loadSubject();

    await expect(getDatabaseConnectionConfig()).rejects.toThrow(
      'Secret arn:aws:secretsmanager:us-west-2:123456789012:secret:broken does not contain valid JSON',
    );
  });

  it('propagates secret fetch failures', async () => {
    process.env.DB_SECRET_ARN = 'arn:aws:secretsmanager:us-west-2:123456789012:secret:offline';
    sendSecrets.mockRejectedValue(new Error('Secrets Manager unavailable'));

    const { getDatabaseConnectionConfig } = await loadSubject();

    await expect(getDatabaseConnectionConfig()).rejects.toThrow('Secrets Manager unavailable');
  });
});
