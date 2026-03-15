import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import type { GetPlayerScoresResponse } from '@football/api-contract';
import { getPool } from '../../shared/db';
import { getScoringConfigByName, getPlayerWeeklyScores } from '../../shared/db/queries/scoringQueries';
import { success, badRequest, notFound } from '../../shared/middleware/response';
import { withErrorHandler } from '../../shared/middleware/errorHandler';
import { parseIntParam, ValidationError } from '../../shared/middleware/validation';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function handle(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  const playerId = event.pathParameters?.id;
  if (!playerId) return badRequest('Player ID is required');
  if (!UUID_RE.test(playerId)) return badRequest('Player ID must be a valid UUID');

  const params = event.queryStringParameters || {};

  let season: number | undefined;
  try {
    season = parseIntParam(params.season, 'season', { min: 2000, max: 2100 });
  } catch (err) {
    if (err instanceof ValidationError) return badRequest(err.message);
    throw err;
  }
  if (!season) return badRequest('season query parameter is required');

  const scoringFormat = params.scoring || 'Standard';

  const pool = getPool();
  const config = await getScoringConfigByName(pool, scoringFormat);
  if (!config) return notFound(`Scoring config '${scoringFormat}' not found`);

  const scores = await getPlayerWeeklyScores(pool, {
    playerId,
    season,
    configId: config.id,
  });

  const totalPoints = scores.reduce((sum, s) => sum + parseFloat(s.points), 0);

  const body = {
    playerId,
    season,
    scoringFormat: config.name,
    totalPoints: Math.round(totalPoints * 100) / 100,
    weeks: scores.map((s) => ({
      week: s.week,
      teamAbbr: s.team_abbr,
      points: parseFloat(s.points),
    })),
  } satisfies GetPlayerScoresResponse;

  return success(body);
}

export const handler = withErrorHandler(handle);
