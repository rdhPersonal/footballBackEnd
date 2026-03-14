const ESPN_BASE = 'https://site.api.espn.com';
const ESPN_V2 = `${ESPN_BASE}/apis/site/v2/sports/football/nfl`;
const ESPN_V3 = `${ESPN_BASE}/apis/common/v3/sports/football/nfl`;

const POSITION_MAP: Record<string, string> = {
  'Quarterback': 'QB',
  'Running Back': 'RB',
  'Wide Receiver': 'WR',
  'Tight End': 'TE',
  'Place Kicker': 'K',
  'Kicker': 'K',
  'Punter': 'P',
  'Defensive End': 'DEF',
  'Defensive Tackle': 'DEF',
  'Linebacker': 'DEF',
  'Cornerback': 'DEF',
  'Safety': 'DEF',
  'Free Safety': 'DEF',
  'Strong Safety': 'DEF',
  'Outside Linebacker': 'DEF',
  'Middle Linebacker': 'DEF',
  'Inside Linebacker': 'DEF',
  'Nose Tackle': 'DEF',
};

export interface EspnTeam {
  espnId: string;
  abbreviation: string;
  displayName: string;
  shortDisplayName: string;
}

export interface EspnPlayer {
  espnId: string;
  fullName: string;
  position: string;
  positionAbbr: string;
  teamAbbr: string;
  dateOfBirth?: string;
  heightInches?: number;
  weightLbs?: number;
  college?: string;
  headshotUrl?: string;
}

export interface EspnGameStat {
  eventId: string;
  week: number;
  teamAbbr: string;
  stats: Record<string, string>;
}

export interface EspnPlayerGamelog {
  espnId: string;
  season: number;
  labels: string[];
  names: string[];
  games: EspnGameStat[];
  totals: string[];
}

async function fetchJson(url: string): Promise<unknown> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`ESPN API error: ${response.status} ${response.statusText} for ${url}`);
  }
  return response.json();
}

function mapPosition(positionName: string, abbreviation?: string): string {
  const mapped = POSITION_MAP[positionName];
  if (mapped) return mapped;
  if (abbreviation && ['QB', 'RB', 'WR', 'TE', 'K', 'P'].includes(abbreviation)) {
    return abbreviation;
  }
  return abbreviation || 'DEF';
}

export async function fetchTeams(): Promise<EspnTeam[]> {
  const data = await fetchJson(`${ESPN_V2}/teams?limit=40`) as {
    sports: Array<{ leagues: Array<{ teams: Array<{ team: Record<string, string> }> }> }>;
  };

  const teams = data.sports?.[0]?.leagues?.[0]?.teams ?? [];

  return teams.map((t) => ({
    espnId: t.team.id,
    abbreviation: t.team.abbreviation,
    displayName: t.team.displayName,
    shortDisplayName: t.team.shortDisplayName,
  }));
}

export async function fetchTeamRoster(teamEspnId: string, season?: number): Promise<EspnPlayer[]> {
  const url = season
    ? `${ESPN_V2}/teams/${teamEspnId}/roster?season=${season}`
    : `${ESPN_V2}/teams/${teamEspnId}/roster`;
  const data = await fetchJson(url) as {
    athletes: Array<{
      items: Array<Record<string, unknown>>;
    }>;
    team?: { abbreviation?: string };
  };

  const teamAbbr = (data.team as Record<string, string>)?.abbreviation ?? '';
  const players: EspnPlayer[] = [];

  for (const group of data.athletes ?? []) {
    for (const p of group.items ?? []) {
      const pos = p.position as Record<string, unknown> | undefined;
      const posName = (pos?.displayName as string) ?? '';
      const posAbbr = (pos?.abbreviation as string) ?? '';
      const college = p.college as Record<string, string> | undefined;

      players.push({
        espnId: String(p.id),
        fullName: (p.fullName as string) ?? (p.displayName as string) ?? '',
        position: posName,
        positionAbbr: mapPosition(posName, posAbbr),
        teamAbbr,
        dateOfBirth: (p.dateOfBirth as string) ?? undefined,
        heightInches: typeof p.height === 'number' ? Math.round(p.height) : undefined,
        weightLbs: typeof p.weight === 'number' ? Math.round(p.weight) : undefined,
        college: college?.name,
        headshotUrl: p.headshot
          ? (p.headshot as Record<string, string>).href
          : `https://a.espncdn.com/i/headshots/nfl/players/full/${p.id}.png`,
      });
    }
  }

  return players;
}

export async function fetchPlayerGamelog(
  espnPlayerId: string,
  season: number,
): Promise<EspnPlayerGamelog | null> {
  let data: Record<string, unknown>;
  try {
    data = (await fetchJson(
      `${ESPN_V3}/athletes/${espnPlayerId}/gamelog?season=${season}`,
    )) as Record<string, unknown>;
  } catch {
    return null;
  }

  const labels = (data.labels as string[]) ?? [];
  const names = (data.names as string[]) ?? [];

  const eventsMap = (data.events ?? {}) as Record<
    string,
    {
      week?: number;
      opponent?: { abbreviation?: string };
      team?: { abbreviation?: string };
    }
  >;

  const seasonTypes = (data.seasonTypes ?? []) as Array<{
    displayName?: string;
    categories?: Array<{
      events?: Array<{ eventId: string; stats: string[] }>;
      totals?: string[];
    }>;
  }>;

  const regularSeason = seasonTypes.find((st) =>
    (st.displayName ?? '').includes('Regular'),
  );

  if (!regularSeason?.categories?.length) {
    return null;
  }

  const category = regularSeason.categories[0];
  const gameEvents = category.events ?? [];
  const totals = category.totals ?? [];

  const games: EspnGameStat[] = [];

  for (const ge of gameEvents) {
    const eventInfo = eventsMap[ge.eventId];
    const week = eventInfo?.week;
    if (week == null) continue;
    const teamAbbr = eventInfo?.team?.abbreviation ?? '';

    const stats: Record<string, string> = {};
    for (let i = 0; i < names.length && i < ge.stats.length; i++) {
      stats[names[i]] = ge.stats[i];
    }

    games.push({ eventId: ge.eventId, week, teamAbbr, stats });
  }

  return {
    espnId: espnPlayerId,
    season,
    labels,
    names,
    games,
    totals,
  };
}

export interface BoxscorePlayer {
  espnId: string;
  displayName: string;
  teamAbbr: string;
  headshotUrl?: string;
}

/**
 * Fetch all players who appeared in a game's boxscore.
 * Used to discover historical players who aren't on current rosters.
 */
export async function fetchGameSummaryPlayers(eventId: string): Promise<BoxscorePlayer[]> {
  let data: Record<string, unknown>;
  try {
    data = (await fetchJson(`${ESPN_V2}/summary?event=${eventId}`)) as Record<string, unknown>;
  } catch {
    return [];
  }

  const boxscore = data.boxscore as { players?: Array<Record<string, unknown>> } | undefined;
  if (!boxscore?.players) return [];

  const seen = new Set<string>();
  const result: BoxscorePlayer[] = [];

  for (const teamGroup of boxscore.players) {
    const teamAbbr = (teamGroup.team as Record<string, string>)?.abbreviation ?? '';
    const statGroups = (teamGroup.statistics ?? []) as Array<{
      athletes?: Array<{ athlete: Record<string, unknown> }>;
    }>;

    for (const sg of statGroups) {
      for (const entry of sg.athletes ?? []) {
        const a = entry.athlete;
        const id = String(a.id ?? '');
        if (!id || seen.has(id)) continue;
        seen.add(id);

        const headshot = a.headshot as Record<string, string> | undefined;
        result.push({
          espnId: id,
          displayName: (a.displayName as string) ?? '',
          teamAbbr,
          headshotUrl: headshot?.href ?? `https://a.espncdn.com/i/headshots/nfl/players/full/${id}.png`,
        });
      }
    }
  }

  return result;
}

const ESPN_CORE = 'https://sports.core.api.espn.com/v2/sports/football/leagues/nfl';

/**
 * Fetch full player profile from the ESPN core API.
 * Returns enough data to populate the players table.
 */
export async function fetchPlayerProfile(espnPlayerId: string): Promise<EspnPlayer | null> {
  let data: Record<string, unknown>;
  try {
    data = (await fetchJson(`${ESPN_CORE}/athletes/${espnPlayerId}`)) as Record<string, unknown>;
  } catch {
    return null;
  }

  const pos = data.position as Record<string, string> | undefined;
  const posName = pos?.displayName ?? '';
  const posAbbr = pos?.abbreviation ?? '';

  return {
    espnId: String(data.id ?? espnPlayerId),
    fullName: (data.fullName as string) ?? (data.displayName as string) ?? '',
    position: posName,
    positionAbbr: mapPosition(posName, posAbbr),
    teamAbbr: '',
    dateOfBirth: (data.dateOfBirth as string) ?? undefined,
    heightInches: typeof data.height === 'number' ? Math.round(data.height) : undefined,
    weightLbs: typeof data.weight === 'number' ? Math.round(data.weight) : undefined,
    // TODO: ESPN core API does include college info under data.college.name for many players.
    // The roster endpoint (fetchTeamRoster) already populates this field. Left undefined here
    // because historical-discovery players can be backfilled from a separate profile fetch if needed.
    college: undefined,
    headshotUrl: typeof data.headshot === 'object' && data.headshot
      ? (data.headshot as Record<string, string>).href
      : `https://a.espncdn.com/i/headshots/nfl/players/full/${espnPlayerId}.png`,
  };
}

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
