import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const getDatabaseConnectionConfig = vi.fn();
const getDatabaseConnectionCacheTtlMs = vi.fn();
const createdPools: MockPool[] = [];

class MockPool {
  config: unknown;
  end = vi.fn();

  constructor(config: unknown) {
    this.config = config;
    createdPools.push(this);
  }
}

vi.mock('pg', () => ({
  Pool: MockPool,
}));

vi.mock('../../src/shared/db/runtime-config', () => ({
  getDatabaseConnectionConfig,
  getDatabaseConnectionCacheTtlMs,
}));

describe('getPool', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-15T19:00:00Z'));
    vi.resetModules();
    getDatabaseConnectionConfig.mockReset();
    getDatabaseConnectionCacheTtlMs.mockReset();
    createdPools.splice(0, createdPools.length);
    getDatabaseConnectionCacheTtlMs.mockReturnValue(1_000);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('reuses the pool within the TTL and rotates it after the TTL expires', async () => {
    getDatabaseConnectionConfig
      .mockResolvedValueOnce({
        host: 'db.example.com',
        port: 5432,
        database: 'football',
        user: 'footballadmin',
        password: 'password-one',
        ssl: { rejectUnauthorized: false },
      })
      .mockResolvedValueOnce({
        host: 'db.example.com',
        port: 5432,
        database: 'football',
        user: 'footballadmin',
        password: 'password-two',
        ssl: { rejectUnauthorized: false },
      });

    const { getPool } = await import('../../src/shared/db/client');

    const firstPool = await getPool();
    const secondPool = await getPool();

    expect(firstPool).toBe(secondPool);
    expect(createdPools).toHaveLength(1);

    vi.setSystemTime(new Date('2026-03-15T19:00:02Z'));

    const rotatedPool = await getPool();

    expect(rotatedPool).not.toBe(firstPool);
    expect(createdPools).toHaveLength(2);
    expect(createdPools[0]?.end).toHaveBeenCalledTimes(1);
  });
});
