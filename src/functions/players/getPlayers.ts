import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { getPool } from '../../shared/db';
import { searchPlayers } from '../../shared/db/queries/playerQueries';
import { success, badRequest } from '../../shared/middleware/response';
import { withErrorHandler } from '../../shared/middleware/errorHandler';

async function handle(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  const params = event.queryStringParameters || {};

  const position = params.position;
  const team = params.team;
  const season = params.season ? parseInt(params.season, 10) : undefined;
  const search = params.search;
  const limit = params.limit ? parseInt(params.limit, 10) : 50;
  const offset = params.offset ? parseInt(params.offset, 10) : 0;

  if (position && !['QB', 'RB', 'WR', 'TE', 'K', 'DEF'].includes(position.toUpperCase())) {
    return badRequest('Invalid position. Must be one of: QB, RB, WR, TE, K, DEF');
  }

  const pool = getPool();
  const players = await searchPlayers(pool, { position, team, season, search, limit, offset });

  return success({ players, count: players.length, limit, offset });
}

export const handler = withErrorHandler(handle);
