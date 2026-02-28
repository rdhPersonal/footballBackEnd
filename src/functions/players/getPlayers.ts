import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { getPool } from '../../shared/db';
import { searchPlayers } from '../../shared/db/queries/playerQueries';
import { success, badRequest } from '../../shared/middleware/response';
import { withErrorHandler } from '../../shared/middleware/errorHandler';
import { parseIntParam, ValidationError } from '../../shared/middleware/validation';

async function handle(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  const params = event.queryStringParameters || {};

  const position = params.position;
  const team = params.team;
  const search = params.search;

  let season: number | undefined;
  let limit: number;
  let offset: number;

  try {
    season = parseIntParam(params.season, 'season', { min: 2000, max: 2100 });
    limit = parseIntParam(params.limit, 'limit', { min: 1, max: 200, defaultValue: 50 })!;
    offset = parseIntParam(params.offset, 'offset', { min: 0, max: 100000, defaultValue: 0 })!;
  } catch (err) {
    if (err instanceof ValidationError) return badRequest(err.message);
    throw err;
  }

  if (position && !['QB', 'RB', 'WR', 'TE', 'K', 'DEF'].includes(position.toUpperCase())) {
    return badRequest('Invalid position. Must be one of: QB, RB, WR, TE, K, DEF');
  }

  const pool = getPool();
  const players = await searchPlayers(pool, { position, team, season, search, limit, offset });

  return success({ players, count: players.length, limit, offset });
}

export const handler = withErrorHandler(handle);
