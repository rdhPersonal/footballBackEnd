import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { getPool } from '../../shared/db';
import { getPlayerById } from '../../shared/db/queries/playerQueries';
import { success, notFound, badRequest } from '../../shared/middleware/response';
import { withErrorHandler } from '../../shared/middleware/errorHandler';

async function handle(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  const id = event.pathParameters?.id;
  if (!id) return badRequest('Player ID is required');

  const pool = getPool();
  const player = await getPlayerById(pool, id);

  if (!player) return notFound('Player not found');

  return success({
    id: player.id,
    externalId: player.external_id,
    name: player.name,
    position: player.position,
    photoUrl: player.photo_url,
    dateOfBirth: player.date_of_birth,
    college: player.college,
    heightInches: player.height_inches,
    weightLbs: player.weight_lbs,
    currentTeamAbbr: player.current_team_abbr,
    rosterStatus: player.roster_status,
  });
}

export const handler = withErrorHandler(handle);
