import { execSync } from 'child_process';

const API_URL = process.env.API_URL || 'https://z8y6zlxrmc.execute-api.us-west-2.amazonaws.com';
const COGNITO_CLIENT_ID = process.env.COGNITO_CLIENT_ID || '12hi070g8mrjkefh1pciv624om';
const COGNITO_USERNAME = process.env.COGNITO_USERNAME || 'testuser@football.dev';
const COGNITO_PASSWORD = process.env.COGNITO_PASSWORD || 'TestPass123!';
const AWS_REGION = process.env.AWS_REGION || 'us-west-2';

let cachedToken: string | null = null;

export function getApiUrl(): string {
  return API_URL;
}

export function getAuthToken(): string {
  if (cachedToken) return cachedToken;

  try {
    const result = execSync(
      `aws cognito-idp initiate-auth ` +
      `--client-id ${COGNITO_CLIENT_ID} ` +
      `--auth-flow USER_PASSWORD_AUTH ` +
      `--auth-parameters USERNAME=${COGNITO_USERNAME},PASSWORD='${COGNITO_PASSWORD}' ` +
      `--region ${AWS_REGION} ` +
      `--query 'AuthenticationResult.IdToken' ` +
      `--output text`,
      { encoding: 'utf-8', timeout: 15_000 },
    ).trim();

    if (!result || result === 'None') {
      throw new Error('Empty token returned');
    }

    cachedToken = result;
    return cachedToken;
  } catch (err) {
    throw new Error(
      `Failed to get Cognito token. Ensure AWS CLI is configured and credentials are valid.\n` +
      `Original error: ${err instanceof Error ? err.message : err}`,
    );
  }
}

export interface ApiResponse<T = unknown> {
  status: number;
  data: T;
}

export async function apiGet<T = unknown>(path: string, token?: string): Promise<ApiResponse<T>> {
  const url = `${API_URL}${path}`;
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
