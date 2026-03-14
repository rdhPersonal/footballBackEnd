import { describe, it, expect, beforeAll } from 'vitest';
import { getAuthToken, apiGet } from './helpers';

interface PlayersResponse {
  players: Array<{
    id: string;
    externalId: string;
    name: string;
    position: string;
    photoUrl: string | null;
    currentTeamAbbr: string | null;
    rosterStatus: string | null;
  }>;
  totalCount: number;
  count: number;
  limit: number;
  offset: number;
}

interface PlayerResponse {
  id: string;
  externalId: string;
  name: string;
  position: string;
  photoUrl: string | null;
  currentTeamAbbr: string | null;
  rosterStatus: string | null;
}

interface TypedStatEntry {
  season: number;
  week: number;
  teamAbbr: string;
}

interface StatsResponse {
  playerId: string;
  passing: Array<TypedStatEntry & { attempts: number; completions: number; yards: number; touchdowns: number }>;
  rushing: Array<TypedStatEntry & { attempts: number; yards: number; touchdowns: number }>;
  receiving: Array<TypedStatEntry & { targets: number; receptions: number; yards: number; touchdowns: number }>;
  kicking: Array<TypedStatEntry & { fgMade: number; xpMade: number; points: number }>;
}

interface RosterHistoryResponse {
  playerId: string;
  rosterHistory: Array<{
    teamAbbr: string;
    season: number;
    weekStart: number;
    weekEnd: number | null;
    rosterStatus: string;
    transactionType: string;
  }>;
  count: number;
}

let token: string;

beforeAll(() => {
  token = getAuthToken();
});

describe('Authentication', () => {
  it('rejects requests without a token', async () => {
    const res = await apiGet('/players?limit=1');
    expect(res.status).toBe(401);
  });

  it('rejects requests with an invalid token', async () => {
    const res = await apiGet('/players?limit=1', 'invalid-token-value');
    expect(res.status).toBe(401);
  });
});

describe('GET /players', () => {
  it('returns a list of players', async () => {
    const res = await apiGet<PlayersResponse>('/players?limit=5', token);
    expect(res.status).toBe(200);
    expect(res.data.players).toBeInstanceOf(Array);
    expect(res.data.players.length).toBeGreaterThan(0);
    expect(res.data.players.length).toBeLessThanOrEqual(5);
    expect(res.data.count).toBe(res.data.players.length);
    expect(res.data.totalCount).toBeGreaterThanOrEqual(res.data.count);
    expect(res.data.limit).toBe(5);
    expect(res.data.offset).toBe(0);
  });

  it('respects limit and offset parameters', async () => {
    const page1 = await apiGet<PlayersResponse>('/players?limit=3&offset=0', token);
    const page2 = await apiGet<PlayersResponse>('/players?limit=3&offset=3', token);

    expect(page1.status).toBe(200);
    expect(page2.status).toBe(200);

    const page1Ids = page1.data.players.map((p) => p.id);
    const page2Ids = page2.data.players.map((p) => p.id);

    for (const id of page2Ids) {
      expect(page1Ids).not.toContain(id);
    }
  });

  it('filters by position', async () => {
    const res = await apiGet<PlayersResponse>('/players?position=QB&limit=10', token);
    expect(res.status).toBe(200);
    expect(res.data.players.length).toBeGreaterThan(0);
    for (const player of res.data.players) {
      expect(player.position).toBe('QB');
    }
  });

  it('filters by team', async () => {
    const res = await apiGet<PlayersResponse>('/players?team=KC&limit=10', token);
    expect(res.status).toBe(200);
    expect(res.data.players.length).toBeGreaterThan(0);
  });

  it('searches by name', async () => {
    const res = await apiGet<PlayersResponse>('/players?search=Mahomes&limit=5', token);
    expect(res.status).toBe(200);
    expect(res.data.players.length).toBeGreaterThan(0);
    const names = res.data.players.map((p) => p.name.toLowerCase());
    expect(names.some((n) => n.includes('mahomes'))).toBe(true);
  });

  it('rejects invalid position', async () => {
    const res = await apiGet<{ error: string }>('/players?position=INVALID', token);
    expect(res.status).toBe(400);
    expect(res.data.error).toContain('Invalid position');
  });

  it('rejects invalid limit', async () => {
    const res = await apiGet<{ error: string }>('/players?limit=abc', token);
    expect(res.status).toBe(400);
  });

  it('returns each player with camelCase fields and current team', async () => {
    const res = await apiGet<PlayersResponse>('/players?limit=1', token);
    expect(res.status).toBe(200);
    const player = res.data.players[0];
    expect(player).toHaveProperty('id');
    expect(player).toHaveProperty('externalId');
    expect(player).toHaveProperty('name');
    expect(player).toHaveProperty('position');
    expect(player).toHaveProperty('photoUrl');
    expect(player).toHaveProperty('currentTeamAbbr');
    expect(player).toHaveProperty('rosterStatus');
    expect(player).not.toHaveProperty('external_id');
    expect(player).not.toHaveProperty('photo_url');
  });
});

describe('GET /players/{id}', () => {
  let playerId: string;

  beforeAll(async () => {
    const res = await apiGet<PlayersResponse>('/players?position=QB&limit=1', token);
    playerId = res.data.players[0].id;
  });

  it('returns a single player by ID', async () => {
    const res = await apiGet<PlayerResponse>(`/players/${playerId}`, token);
    expect(res.status).toBe(200);
    expect(res.data.id).toBe(playerId);
    expect(res.data.name).toBeTruthy();
    expect(res.data.position).toBeTruthy();
  });

  it('includes current team info', async () => {
    const res = await apiGet<PlayerResponse>(`/players/${playerId}`, token);
    expect(res.status).toBe(200);
    expect(res.data).toHaveProperty('currentTeamAbbr');
    expect(res.data).toHaveProperty('rosterStatus');
  });

  it('returns expected fields for the player', async () => {
    const res = await apiGet<PlayerResponse>(`/players/${playerId}`, token);
    expect(res.status).toBe(200);
    expect(res.data).toHaveProperty('externalId');
    expect(res.data).toHaveProperty('photoUrl');
  });

  it('returns 404 for a non-existent player ID', async () => {
    const fakeId = '00000000-0000-0000-0000-000000000000';
    const res = await apiGet(`/players/${fakeId}`, token);
    expect(res.status).toBe(404);
  });
});

describe('GET /players/{id}/stats', () => {
  let playerId: string;

  beforeAll(async () => {
    const res = await apiGet<PlayersResponse>('/players?position=QB&search=Mahomes&limit=1', token);
    playerId = res.data.players[0].id;
  });

  it('returns typed stats for a QB', async () => {
    const res = await apiGet<StatsResponse>(`/players/${playerId}/stats`, token);
    expect(res.status).toBe(200);
    expect(res.data.playerId).toBe(playerId);
    expect(res.data.passing).toBeInstanceOf(Array);
    expect(res.data.passing.length).toBeGreaterThan(0);
  });

  it('filters stats by season', async () => {
    const res = await apiGet<StatsResponse>(`/players/${playerId}/stats?season=2023`, token);
    expect(res.status).toBe(200);
    for (const stat of res.data.passing) {
      expect(stat.season).toBe(2023);
    }
  });

  it('filters stats by week', async () => {
    const res = await apiGet<StatsResponse>(`/players/${playerId}/stats?season=2023&week=1`, token);
    expect(res.status).toBe(200);
    for (const stat of res.data.passing) {
      expect(stat.season).toBe(2023);
      expect(stat.week).toBe(1);
    }
  });

  it('returns strongly typed passing fields', async () => {
    const res = await apiGet<StatsResponse>(`/players/${playerId}/stats?season=2023&week=1`, token);
    expect(res.status).toBe(200);
    if (res.data.passing.length > 0) {
      const stat = res.data.passing[0];
      expect(stat.teamAbbr).toBeTruthy();
      expect(stat.attempts).toBeGreaterThan(0);
      expect(stat.completions).toBeGreaterThanOrEqual(0);
      expect(typeof stat.yards).toBe('number');
    }
  });

  it('returns empty stats for a non-existent season', async () => {
    const res = await apiGet<StatsResponse>(`/players/${playerId}/stats?season=2000`, token);
    expect(res.status).toBe(200);
    expect(res.data.passing).toHaveLength(0);
  });
});

describe('GET /players/{id}/roster-history', () => {
  let playerId: string;

  beforeAll(async () => {
    const res = await apiGet<PlayersResponse>('/players?position=QB&search=Mahomes&limit=1', token);
    playerId = res.data.players[0].id;
  });

  it('returns roster history for a player', async () => {
    const res = await apiGet<RosterHistoryResponse>(`/players/${playerId}/roster-history`, token);
    expect(res.status).toBe(200);
    expect(res.data.playerId).toBe(playerId);
    expect(res.data.rosterHistory).toBeInstanceOf(Array);
    expect(res.data.rosterHistory.length).toBeGreaterThan(0);
  });

  it('returns roster entries with expected fields', async () => {
    const res = await apiGet<RosterHistoryResponse>(`/players/${playerId}/roster-history`, token);
    expect(res.status).toBe(200);
    const entry = res.data.rosterHistory[0];
    expect(entry).toHaveProperty('teamAbbr');
    expect(entry).toHaveProperty('season');
    expect(entry).toHaveProperty('weekStart');
    expect(entry).toHaveProperty('weekEnd');
    expect(entry).toHaveProperty('rosterStatus');
    expect(entry).toHaveProperty('transactionType');
  });

  it('has roster entries sorted by season desc, week desc', async () => {
    const res = await apiGet<RosterHistoryResponse>(`/players/${playerId}/roster-history`, token);
    expect(res.status).toBe(200);
    const history = res.data.rosterHistory;
    for (let i = 1; i < history.length; i++) {
      const prev = history[i - 1];
      const curr = history[i];
      const prevKey = prev.season * 100 + prev.weekStart;
      const currKey = curr.season * 100 + curr.weekStart;
      expect(prevKey).toBeGreaterThanOrEqual(currKey);
    }
  });
});

describe('GET /teams', () => {
  it('returns a list of NFL teams', async () => {
    const res = await apiGet<{ teams: Array<{ abbr: string; name: string; conference: string; division: string }>; count: number }>('/teams', token);
    expect(res.status).toBe(200);
    expect(res.data.teams).toBeInstanceOf(Array);
    expect(res.data.teams.length).toBe(32);
    expect(res.data.count).toBe(32);
  });

  it('returns teams with expected fields', async () => {
    const res = await apiGet<{ teams: Array<{ abbr: string; name: string; conference: string; division: string; byeWeek: number | null; season: number }> }>('/teams', token);
    expect(res.status).toBe(200);
    const team = res.data.teams[0];
    expect(team).toHaveProperty('abbr');
    expect(team).toHaveProperty('name');
    expect(team).toHaveProperty('conference');
    expect(team).toHaveProperty('division');
    expect(team).toHaveProperty('season');
  });

  it('filters teams by season', async () => {
    const res = await apiGet<{ teams: Array<{ season: number }> }>('/teams?season=2023', token);
    expect(res.status).toBe(200);
    for (const team of res.data.teams) {
      expect(team.season).toBe(2023);
    }
  });

  it('includes Kansas City', async () => {
    const res = await apiGet<{ teams: Array<{ abbr: string; name: string }> }>('/teams', token);
    expect(res.status).toBe(200);
    const kc = res.data.teams.find((t) => t.abbr === 'KC');
    expect(kc).toBeDefined();
  });
});

describe('GET /seasons', () => {
  it('returns season summaries', async () => {
    const res = await apiGet<{ seasons: Array<{ season: number; playerCount: number; minWeek: number; maxWeek: number; statCounts: { passing: number; rushing: number; receiving: number; kicking: number } }> }>('/seasons', token);
    expect(res.status).toBe(200);
    expect(res.data.seasons).toBeInstanceOf(Array);
    expect(res.data.seasons.length).toBeGreaterThan(0);
  });

  it('includes 2023 season with stat counts', async () => {
    const res = await apiGet<{ seasons: Array<{ season: number; playerCount: number; minWeek: number; maxWeek: number; statCounts: { passing: number; rushing: number; receiving: number; kicking: number } }> }>('/seasons', token);
    expect(res.status).toBe(200);
    const s2023 = res.data.seasons.find((s) => s.season === 2023);
    expect(s2023).toBeDefined();
    expect(s2023!.playerCount).toBeGreaterThan(0);
    expect(s2023!.statCounts.passing).toBeGreaterThan(0);
    expect(s2023!.statCounts.rushing).toBeGreaterThan(0);
    expect(s2023!.statCounts.receiving).toBeGreaterThan(0);
    expect(s2023!.statCounts.kicking).toBeGreaterThan(0);
  });
});

describe('GET /scoring-configs', () => {
  it('returns scoring configurations', async () => {
    const res = await apiGet<{ configs: Array<{ id: number; name: string; receptionPts: number }> }>('/scoring-configs', token);
    expect(res.status).toBe(200);
    expect(res.data.configs).toBeInstanceOf(Array);
    expect(res.data.configs.length).toBe(3);
  });

  it('includes Standard, Half-PPR, and PPR', async () => {
    const res = await apiGet<{ configs: Array<{ name: string }> }>('/scoring-configs', token);
    expect(res.status).toBe(200);
    const names = res.data.configs.map((c) => c.name);
    expect(names).toContain('Standard');
    expect(names).toContain('Half-PPR');
    expect(names).toContain('PPR');
  });

  it('returns configs with expected scoring fields', async () => {
    const res = await apiGet<{ configs: Array<{ passingYardPts: number; rushingTdPts: number; receptionPts: number; fgMadePts: number }> }>('/scoring-configs', token);
    expect(res.status).toBe(200);
    const config = res.data.configs[0];
    expect(config).toHaveProperty('passingYardPts');
    expect(config).toHaveProperty('rushingTdPts');
    expect(config).toHaveProperty('receptionPts');
    expect(config).toHaveProperty('fgMadePts');
  });
});

describe('GET /players/{id}/scores', () => {
  let playerId: string;

  beforeAll(async () => {
    const res = await apiGet<PlayersResponse>('/players?position=QB&search=Mahomes&limit=1', token);
    playerId = res.data.players[0].id;
  });

  it('returns fantasy scores for a player-season', async () => {
    const res = await apiGet<{ playerId: string; season: number; scoringFormat: string; totalPoints: number; weeks: Array<{ week: number; points: number }> }>(`/players/${playerId}/scores?season=2023`, token);
    expect(res.status).toBe(200);
    expect(res.data.playerId).toBe(playerId);
    expect(res.data.season).toBe(2023);
    expect(res.data.scoringFormat).toBe('Standard');
    expect(res.data.totalPoints).toBeGreaterThan(0);
    expect(res.data.weeks.length).toBeGreaterThan(0);
  });

  it('supports different scoring formats', async () => {
    const [standard, ppr] = await Promise.all([
      apiGet<{ totalPoints: number }>(`/players/${playerId}/scores?season=2023&scoring=Standard`, token),
      apiGet<{ totalPoints: number }>(`/players/${playerId}/scores?season=2023&scoring=PPR`, token),
    ]);
    expect(standard.status).toBe(200);
    expect(ppr.status).toBe(200);
    expect(typeof standard.data.totalPoints).toBe('number');
    expect(typeof ppr.data.totalPoints).toBe('number');
  });

  it('requires season parameter', async () => {
    const res = await apiGet<{ error: string }>(`/players/${playerId}/scores`, token);
    expect(res.status).toBe(400);
  });

  it('returns 404 for unknown scoring config', async () => {
    const res = await apiGet<{ error: string }>(`/players/${playerId}/scores?season=2023&scoring=Nonexistent`, token);
    expect(res.status).toBe(404);
  });
});

describe('2023 Season Data Integrity (Weeks 1-4)', () => {
  it('has passing stats for 2023 season', async () => {
    const res = await apiGet<PlayersResponse>('/players?position=QB&search=Mahomes&limit=1', token);
    expect(res.status).toBe(200);
    const playerId = res.data.players[0].id;

    const statsRes = await apiGet<StatsResponse>(`/players/${playerId}/stats?season=2023`, token);
    expect(statsRes.status).toBe(200);

    const weeks = statsRes.data.passing.map((s) => s.week);
    expect(weeks).toContain(1);
    expect(weeks).toContain(2);
    expect(weeks).toContain(3);
    expect(weeks).toContain(4);
  });

  it('has strongly typed QB passing stats for week 1', async () => {
    const res = await apiGet<PlayersResponse>('/players?position=QB&search=Mahomes&limit=1', token);
    const playerId = res.data.players[0].id;

    const statsRes = await apiGet<StatsResponse>(`/players/${playerId}/stats?season=2023&week=1`, token);
    expect(statsRes.status).toBe(200);
    expect(statsRes.data.passing.length).toBe(1);

    const stat = statsRes.data.passing[0];
    expect(stat.attempts).toBeGreaterThan(0);
    expect(stat.completions).toBeGreaterThan(0);
    expect(typeof stat.yards).toBe('number');
    expect(typeof stat.touchdowns).toBe('number');
  });

  it('has Kansas City QBs on the KC roster', async () => {
    const playersRes = await apiGet<PlayersResponse>('/players?position=QB&team=KC&limit=5', token);
    expect(playersRes.status).toBe(200);
    expect(playersRes.data.players.length).toBeGreaterThan(0);

    const mahomes = playersRes.data.players.find(
      (p) => p.name.toLowerCase().includes('mahomes'),
    );
    expect(mahomes).toBeDefined();
  });

  it('returns multiple positions for a full team roster', async () => {
    const positions = ['QB', 'RB', 'WR', 'TE', 'K'];
    const positionCounts: Record<string, number> = {};

    for (const pos of positions) {
      const res = await apiGet<PlayersResponse>(`/players?position=${pos}&team=KC&limit=20`, token);
      positionCounts[pos] = res.data.count;
    }

    expect(positionCounts['QB']).toBeGreaterThan(0);
    expect(positionCounts['RB']).toBeGreaterThan(0);
    expect(positionCounts['WR']).toBeGreaterThan(0);
    expect(positionCounts['TE']).toBeGreaterThan(0);
  });
});
