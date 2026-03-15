import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import type { GetSeasonsResponse } from '@football/api-contract';
import { getPool } from '../../shared/db';
import { getSeasonsSummary } from '../../shared/db/queries/metaQueries';
import { success } from '../../shared/middleware/response';
import { withErrorHandler } from '../../shared/middleware/errorHandler';

async function handle(_event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  const pool = getPool();
  const seasons = await getSeasonsSummary(pool);

  const body = {
    seasons: seasons.map((s) => ({
      season: s.season,
      playerCount: parseInt(String(s.player_count), 10),
      minWeek: s.min_week,
      maxWeek: s.max_week,
      statCounts: {
        passing: parseInt(String(s.passing_rows), 10),
        rushing: parseInt(String(s.rushing_rows), 10),
        receiving: parseInt(String(s.receiving_rows), 10),
        kicking: parseInt(String(s.kicking_rows), 10),
      },
    })),
  } satisfies GetSeasonsResponse;

  return success(body);
}

export const handler = withErrorHandler(handle);
