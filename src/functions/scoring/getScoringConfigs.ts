import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { getPool } from '../../shared/db';
import { getScoringConfigs } from '../../shared/db/queries/scoringQueries';
import { success } from '../../shared/middleware/response';
import { withErrorHandler } from '../../shared/middleware/errorHandler';

async function handle(_event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  const pool = getPool();
  const configs = await getScoringConfigs(pool);

  return success({
    configs: configs.map((c) => ({
      id: c.id,
      name: c.name,
      description: c.description,
      passingYardPts: parseFloat(c.passing_yard_pts),
      passingTdPts: parseFloat(c.passing_td_pts),
      interceptionPts: parseFloat(c.interception_pts),
      sackPts: parseFloat(c.sack_pts),
      rushingYardPts: parseFloat(c.rushing_yard_pts),
      rushingTdPts: parseFloat(c.rushing_td_pts),
      receivingYardPts: parseFloat(c.receiving_yard_pts),
      receivingTdPts: parseFloat(c.receiving_td_pts),
      receptionPts: parseFloat(c.reception_pts),
      fumbleLostPts: parseFloat(c.fumble_lost_pts),
      fgMadePts: parseFloat(c.fg_made_pts),
      xpMadePts: parseFloat(c.xp_made_pts),
    })),
  });
}

export const handler = withErrorHandler(handle);
