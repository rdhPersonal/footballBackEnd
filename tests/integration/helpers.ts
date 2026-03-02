import { execFileSync } from 'child_process';

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Required environment variable ${name} is not set. ` +
      `Set it before running integration tests.`,
    );
  }
  return value;
}

const AWS_REGION = process.env.AWS_REGION || 'us-west-2';

let cachedToken: string | null = null;

export function getApiUrl(): string {
  return requireEnv('API_URL');
}

export function getAuthToken(): string {
  if (cachedToken) return cachedToken;

  const clientId = requireEnv('COGNITO_CLIENT_ID');
  const username = requireEnv('COGNITO_USERNAME');
  const password = requireEnv('COGNITO_PASSWORD');

  try {
    const result = execFileSync('aws', [
      'cognito-idp', 'initiate-auth',
      '--client-id', clientId,
      '--auth-flow', 'USER_PASSWORD_AUTH',
      '--auth-parameters', `USERNAME=${username},PASSWORD=${password}`,
      '--region', AWS_REGION,
      '--query', 'AuthenticationResult.IdToken',
      '--output', 'text',
    ], { encoding: 'utf-8', timeout: 15_000 }).trim();

    if (!result || result === 'None') {
      throw new Error('Empty token returned');
    }

    cachedToken = result;
    return cachedToken;
  } catch (err) {
    throw new Error(
      `Failed to get Cognito token. Ensure AWS CLI is configured and ` +
      `COGNITO_CLIENT_ID, COGNITO_USERNAME, COGNITO_PASSWORD env vars are set.\n` +
      `Original error: ${err instanceof Error ? err.message : err}`,
    );
  }
}

export interface ApiResponse<T = unknown> {
  status: number;
  data: T;
}

export async function apiGet<T = unknown>(path: string, token?: string): Promise<ApiResponse<T>> {
  const url = `${getApiUrl()}${path}`;
  const headers: Record<string, string> = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(url, { headers });
  const text = await response.text();

  let data: T;
  try {
    data = JSON.parse(text);
  } catch {
    data = text as unknown as T;
  }

  return { status: response.status, data };
}
