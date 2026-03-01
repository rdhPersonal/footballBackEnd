import { describe, it, expect, vi } from 'vitest';
import { withErrorHandler } from '../../src/shared/middleware/errorHandler';
import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';

function fakeEvent(overrides: Partial<APIGatewayProxyEventV2> = {}): APIGatewayProxyEventV2 {
  return {
    version: '2.0',
    routeKey: 'GET /players',
    rawPath: '/players',
    rawQueryString: '',
    headers: {},
    requestContext: {
      accountId: '123',
      apiId: 'test',
      domainName: 'test',
      domainPrefix: 'test',
      http: { method: 'GET', path: '/players', protocol: 'HTTP/1.1', sourceIp: '127.0.0.1', userAgent: 'test' },
      requestId: 'req-1',
      routeKey: 'GET /players',
      stage: '$default',
      time: '01/Jan/2024:00:00:00 +0000',
      timeEpoch: 0,
    },
    isBase64Encoded: false,
    ...overrides,
  };
}

describe('withErrorHandler', () => {
  it('passes through a successful response', async () => {
    const handler = withErrorHandler(async () => ({
      statusCode: 200,
      body: JSON.stringify({ ok: true }),
    }));

    const result = await handler(fakeEvent(), {} as never) as APIGatewayProxyResultV2;
    expect((result as { statusCode: number }).statusCode).toBe(200);
  });

  it('catches thrown errors and returns 500', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const handler = withErrorHandler(async () => {
      throw new Error('DB connection failed');
    });

    const result = await handler(fakeEvent(), {} as never) as { statusCode: number; body: string };
    expect(result.statusCode).toBe(500);
    expect(JSON.parse(result.body)).toEqual({ error: 'DB connection failed' });

    consoleSpy.mockRestore();
  });

  it('handles non-Error throws gracefully', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const handler = withErrorHandler(async () => {
      throw 'string error';
    });

    const result = await handler(fakeEvent(), {} as never) as { statusCode: number; body: string };
    expect(result.statusCode).toBe(500);
    expect(JSON.parse(result.body)).toEqual({ error: 'Internal server error' });

    consoleSpy.mockRestore();
  });
});
