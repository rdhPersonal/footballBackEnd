import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { error } from './response';

type ApiHandler = (event: APIGatewayProxyEventV2) => Promise<APIGatewayProxyResultV2>;

export function withErrorHandler(handler: ApiHandler): ApiHandler {
  return async (event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> => {
    try {
      return await handler(event);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Internal server error';
      console.error('Lambda error:', err);
      return error(message, 500);
    }
  };
}
