import type {
  PassingStats,
  RushingStats,
  ReceivingStats,
  KickingStats,
  PlayerGameStats,
} from './types/player';

function toInt(val: string | undefined): number {
  if (!val) return 0;
  const n = parseInt(val, 10);
  return Number.isNaN(n) ? 0 : n;
}

function toFloat(val: string | undefined): number | undefined {
  if (!val || val === '-') return undefined;
  const n = parseFloat(val);
  return Number.isNaN(n) ? undefined : n;
}

/**
 * Parse a compound "made-attempted" value like "3-5" into [made, attempted].
 */
function parseMadeAttempted(val: string | undefined): [number, number] {
  if (!val) return [0, 0];
  const parts = val.split('-');
  if (parts.length !== 2) return [0, 0];
  return [toInt(parts[0]), toInt(parts[1])];
}

/**
 * Detect whether an ESPN gamelog stat set represents kicking stats
 * (as opposed to skill-position rushing/receiving stats).
 */
export function isKickingStatNames(names: string[]): boolean {
  return names.some((n) => n.startsWith('fieldGoals') || n === 'extraPointsMade');
}

interface StatMap {
  [key: string]: string;
}

function buildStatMap(names: string[], values: string[]): StatMap {
  const map: StatMap = {};
  for (let i = 0; i < names.length && i < values.length; i++) {
    map[names[i]] = values[i];
  }
  return map;
}

function parsePassingFromMap(m: StatMap): Omit<PassingStats, 'playerId' | 'season' | 'week' | 'teamAbbr' | 'eventId'> | null {
  if (m.passingAttempts === undefined && m.completions === undefined) return null;
  const attempts = toInt(m.passingAttempts);
  const completions = toInt(m.completions);
  if (attempts === 0 && completions === 0) return null;
  return {
    attempts,
    completions,
    yards: toInt(m.passingYards),
    touchdowns: toInt(m.passingTouchdowns),
    interceptions: toInt(m.interceptions),
    sacks: toInt(m.sacks),
    longest: toInt(m.longPassing),
    qbRating: toFloat(m.QBRating) ?? null,
    adjQbr: toFloat(m.adjQBR) ?? null,
  };
}

function parseRushingFromMap(m: StatMap): Omit<RushingStats, 'playerId' | 'season' | 'week' | 'teamAbbr' | 'eventId'> | null {
  if (m.rushingAttempts === undefined) return null;
  const attempts = toInt(m.rushingAttempts);
  if (attempts === 0) return null;
  return {
    attempts,
    yards: toInt(m.rushingYards),
    touchdowns: toInt(m.rushingTouchdowns),
    longest: toInt(m.longRushing),
    fumbles: toInt(m.fumbles),
    fumblesLost: toInt(m.fumblesLost),
  };
}

function parseReceivingFromMap(m: StatMap): Omit<ReceivingStats, 'playerId' | 'season' | 'week' | 'teamAbbr' | 'eventId'> | null {
  if (m.receivingTargets === undefined && m.receptions === undefined) return null;
  const targets = toInt(m.receivingTargets);
  const receptions = toInt(m.receptions);
  if (targets === 0 && receptions === 0) return null;
  return {
    targets,
    receptions,
    yards: toInt(m.receivingYards),
    touchdowns: toInt(m.receivingTouchdowns),
    longest: toInt(m.longReception),
  };
}

function parseKickingFromMap(m: StatMap): Omit<KickingStats, 'playerId' | 'season' | 'week' | 'teamAbbr' | 'eventId'> | null {
  // ESPN returns FG and XP stats as pre-combined "made-attempted" strings (e.g. "3-5").
  // The key names below are what the gamelog API returns as of 2026. If ESPN ever splits
  // these into separate keys, isKickingStatNames() would still match but parseMadeAttempted()
  // would receive undefined and silently return [0, 0]. Monitor if kicker stats look wrong.
  const fgKey = 'fieldGoalsMade-fieldGoalAttempts';
  const xpKey = 'extraPointsMade-extraPointAttempts';
  if (m[fgKey] === undefined && m.extraPointsMade === undefined) return null;

  const [fgMade, fgAttempted] = parseMadeAttempted(m[fgKey]);
  let xpMade: number, xpAttempted: number;
  if (m[xpKey] !== undefined) {
    [xpMade, xpAttempted] = parseMadeAttempted(m[xpKey]);
  } else {
    xpMade = toInt(m.extraPointsMade);
    xpAttempted = toInt(m.extraPointAttempts);
  }

  return {
    fgMade,
    fgAttempted,
    fgLong: toInt(m.longFieldGoalMade),
    fgPct: toFloat(m.fieldGoalPct) ?? null,
    xpMade,
    xpAttempted,
    points: toInt(m.totalKickingPoints),
  };
}

/**
 * Parse a single game's ESPN stat values into strongly typed stat objects.
 * Returns only the categories where the player actually recorded stats.
 */
export function parseGameStats(
  names: string[],
  values: string[],
  context: { playerId: string; season: number; week: number; teamAbbr: string; eventId?: string },
): PlayerGameStats {
  const m = buildStatMap(names, values);
  const result: PlayerGameStats = {};
  const base = {
    playerId: context.playerId,
    season: context.season,
    week: context.week,
    teamAbbr: context.teamAbbr,
    eventId: context.eventId,
  };

  if (isKickingStatNames(names)) {
    const kicking = parseKickingFromMap(m);
    if (kicking) result.kicking = { ...base, ...kicking };
    return result;
  }

  const passing = parsePassingFromMap(m);
  if (passing) result.passing = { ...base, ...passing };

  const rushing = parseRushingFromMap(m);
  if (rushing) result.rushing = { ...base, ...rushing };

  const receiving = parseReceivingFromMap(m);
  if (receiving) result.receiving = { ...base, ...receiving };

  return result;
}
