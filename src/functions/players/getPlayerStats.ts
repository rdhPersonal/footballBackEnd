import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { getPool } from '../../shared/db';
import { getPlayerStats } from '../../shared/db/queries/statsQueries';
import { success, badRequest } from '../../shared/middleware/response';
import { withErrorHandler } from '../../shared/middleware/errorHandler';

async function handle(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  const playerId = event.pathParameters?.id;
  if (!playerId) return badRequest('Player ID is required');

  const params = event.queryStringParameters || {};
  const season = params.season ? parseInt(params.season, 10) : undefined;
  const week = params.week ? parseInt(params.week, 10) : undefined;

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
