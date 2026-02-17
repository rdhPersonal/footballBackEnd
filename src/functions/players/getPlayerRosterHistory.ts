import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { getPool } from '../../shared/db';
import { getPlayerRosterHistory } from '../../shared/db/queries/rosterQueries';
import { success, badRequest } from '../../shared/middleware/response';
import { withErrorHandler } from '../../shared/middleware/errorHandler';

async function handle(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  const playerId = event.pathParameters?.id;
  if (!playerId) return badRequest('Player ID is required');

  const pool = getPool();
  const history = await getPlayerRosterHistory(pool, playerId);

  return success({
    playerId,
    rosterHistory: history.map((h) => ({
      teamAbbr: h.team_abbr,
      season: h.season,
      weekStart: h.week_start,
      weekEnd: h.week_end,
      rosterStatus: h.roster_status,
      transactionType: h.transaction_type,
    })),
    count: history.length,
  });
}

export const handler = withErrorHandler(handle);
