import { Pool } from 'pg';
import { getDatabaseConnectionCacheTtlMs, getDatabaseConnectionConfig } from './runtime-config';

type PoolCacheEntry = {
  expiresAt: number;
  value: Promise<Pool>;
};

let poolCache: PoolCacheEntry | null = null;

export async function getPool(): Promise<Pool> {
  if (!poolCache || Date.now() >= poolCache.expiresAt) {
    const previousPool = poolCache?.value ?? null;
    const nextPool = createPool()
      .then((pool) => {
        if (previousPool) {
          void previousPool.then((stalePool) => stalePool.end()).catch(() => {});
        }

        return pool;
      })
      .catch((error) => {
        if (poolCache?.value === nextPool) {
          poolCache = null;
        }

        throw error;
      });

    poolCache = {
      expiresAt: Date.now() + getDatabaseConnectionCacheTtlMs(),
      value: nextPool,
    };
  }

  return poolCache.value;
}

async function createPool(): Promise<Pool> {
  const config = await getDatabaseConnectionConfig();

  return new Pool({
    ...config,
    max: 5,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
  });
}
