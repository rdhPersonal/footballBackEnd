import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import type { GetTeamsResponse } from '@football/api-contract';
import { getPool } from '../../shared/db';
import { getTeams } from '../../shared/db/queries/teamQueries';
import { success, badRequest } from '../../shared/middleware/response';
import { withErrorHandler } from '../../shared/middleware/errorHandler';
import { parseIntParam, ValidationError } from '../../shared/middleware/validation';

async function handle(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  const params = event.queryStringParameters || {};

  let season: number | undefined;
  try {
    season = parseIntParam(params.season, 'season', { min: 2000, max: 2100 });
  } catch (err) {
    if (err instanceof ValidationError) return badRequest(err.message);
    throw err;
  }

  const pool = getPool();
  const teams = await getTeams(pool, { season });

  const body = {
    teams: teams.map((t) => ({
      id: t.id,
      abbr: t.abbr,
      name: t.name,
      conference: t.conference,
      division: t.division,
      byeWeek: t.bye_week,
      season: t.season,
    })),
    count: teams.length,
  } satisfies GetTeamsResponse;

  return success(body);
}

export const handler = withErrorHandler(handle);
