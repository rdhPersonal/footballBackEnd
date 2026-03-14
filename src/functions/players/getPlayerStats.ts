import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { getPool } from '../../shared/db';
import {
  getPassingStats,
  getRushingStats,
  getReceivingStats,
  getKickingStats,
} from '../../shared/db/queries/statsQueries';
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
  const queryParams = { playerId, season, week };

  const [passing, rushing, receiving, kicking] = await Promise.all([
    getPassingStats(pool, queryParams),
    getRushingStats(pool, queryParams),
    getReceivingStats(pool, queryParams),
    getKickingStats(pool, queryParams),
  ]);

  return success({
    playerId,
    passing: passing.map((s) => ({
      season: s.season,
      week: s.week,
      teamAbbr: s.team_abbr,
      attempts: s.attempts,
      completions: s.completions,
      yards: s.yards,
      touchdowns: s.touchdowns,
      interceptions: s.interceptions,
      sacks: s.sacks,
      longest: s.longest,
      qbRating: s.qb_rating ? parseFloat(s.qb_rating) : null,
      adjQbr: s.adj_qbr ? parseFloat(s.adj_qbr) : null,
    })),
    rushing: rushing.map((s) => ({
      season: s.season,
      week: s.week,
      teamAbbr: s.team_abbr,
      attempts: s.attempts,
      yards: s.yards,
      touchdowns: s.touchdowns,
      longest: s.longest,
      fumbles: s.fumbles,
      fumblesLost: s.fumbles_lost,
    })),
    receiving: receiving.map((s) => ({
      season: s.season,
      week: s.week,
      teamAbbr: s.team_abbr,
      targets: s.targets,
      receptions: s.receptions,
      yards: s.yards,
      touchdowns: s.touchdowns,
      longest: s.longest,
    })),
    kicking: kicking.map((s) => ({
      season: s.season,
      week: s.week,
      teamAbbr: s.team_abbr,
      fgMade: s.fg_made,
      fgAttempted: s.fg_attempted,
      fgLong: s.fg_long,
      fgPct: s.fg_pct ? parseFloat(s.fg_pct) : null,
      xpMade: s.xp_made,
      xpAttempted: s.xp_attempted,
      points: s.points,
    })),
  });
}

export const handler = withErrorHandler(handle);
