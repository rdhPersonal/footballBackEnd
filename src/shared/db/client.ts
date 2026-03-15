import { Pool } from 'pg';
import { getDatabaseConnectionConfig } from './runtime-config';

let poolPromise: Promise<Pool> | null = null;

export async function getPool(): Promise<Pool> {
  if (!poolPromise) {
    poolPromise = createPool().catch((error) => {
      poolPromise = null;
      throw error;
    });
  }

  return poolPromise;
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
