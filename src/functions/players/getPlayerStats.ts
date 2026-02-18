import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { getPool } from '../../shared/db';
import { getPlayerStats } from '../../shared/db/queries/statsQueries';
import { success, badRequest } from '../../shared/middleware/response';
import { withErrorHandler } from '../../shared/middleware/errorHandler';
import { parseIntParam, ValidationError } from '../../shared/middleware/validation';

async function handle(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  const playerId = event.pathParameters?.id;
  if (!playerId) return badRequest('Player ID is required');

  const params = event.queryStringParameters || {};

  let season: number | undefined;
  let week: number | undefined;

  try {
    season = parseIntParam(params.season, 'season', { min: 2000, max: 2100 });
    week = parseIntParam(params.week, 'week', { min: 0, max: 18 });
  } catch (err) {
    if (err instanceof ValidationError) return badRequest(err.message);
    throw err;
  }

  const pool = getPool();
  const stats = await getPlayerStats(pool, { playerId, season, week });

  return success({
    playerId,
    stats: stats.map((s) => ({
      season: s.season,
      week: s.week,
      teamAbbr: s.team_abbr,
      gamesPlayed: s.games_played,
      totalPoints: s.total_points,
      projectedPoints: s.projected_points,
      statDetails: s.stat_details,
    })),
    count: stats.length,
  });
}

export const handler = withErrorHandler(handle);
