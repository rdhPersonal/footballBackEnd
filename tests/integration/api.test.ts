import { describe, it, expect, beforeAll } from 'vitest';
import { getAuthToken, apiGet } from './helpers';

interface PlayersResponse {
  players: Array<{
    id: string;
    external_id: string;
    name: string;
    position: string;
    photo_url: string | null;
  }>;
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

interface StatsResponse {
  playerId: string;
  stats: Array<{
    season: number;
    week: number;
    teamAbbr: string;
    gamesPlayed: number;
    totalPoints: number;
    statDetails: Record<string, unknown>;
  }>;
  count: number;
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

  it('returns each player with expected fields', async () => {
    const res = await apiGet<PlayersResponse>('/players?limit=1', token);
    expect(res.status).toBe(200);
    const player = res.data.players[0];
    expect(player).toHaveProperty('id');
    expect(player).toHaveProperty('external_id');
    expect(player).toHaveProperty('name');
    expect(player).toHaveProperty('position');
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

  it('returns stats for a player', async () => {
    const res = await apiGet<StatsResponse>(`/players/${playerId}/stats`, token);
    expect(res.status).toBe(200);
    expect(res.data.playerId).toBe(playerId);
    expect(res.data.stats).toBeInstanceOf(Array);
    expect(res.data.stats.length).toBeGreaterThan(0);
  });

  it('filters stats by season', async () => {
    const res = await apiGet<StatsResponse>(`/players/${playerId}/stats?season=2023`, token);
    expect(res.status).toBe(200);
    for (const stat of res.data.stats) {
      expect(stat.season).toBe(2023);
    }
  });

  it('filters stats by week', async () => {
    const res = await apiGet<StatsResponse>(`/players/${playerId}/stats?season=2023&week=1`, token);
    expect(res.status).toBe(200);
    for (const stat of res.data.stats) {
      expect(stat.season).toBe(2023);
      expect(stat.week).toBe(1);
    }
  });

  it('returns stat details in each stat entry', async () => {
    const res = await apiGet<StatsResponse>(`/players/${playerId}/stats?season=2023&week=1`, token);
    expect(res.status).toBe(200);
    if (res.data.stats.length > 0) {
      const stat = res.data.stats[0];
      expect(stat.statDetails).toBeDefined();
      expect(typeof stat.statDetails).toBe('object');
      expect(stat.teamAbbr).toBeTruthy();
      expect(stat.gamesPlayed).toBe(1);
    }
  });

  it('returns empty stats for a non-existent season', async () => {
    const res = await apiGet<StatsResponse>(`/players/${playerId}/stats?season=2000`, token);
    expect(res.status).toBe(200);
    expect(res.data.stats).toHaveLength(0);
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

describe('2023 Season Data Integrity (Weeks 1-4)', () => {
  it('has player stats for 2023 season', async () => {
    const res = await apiGet<PlayersResponse>('/players?position=QB&search=Mahomes&limit=1', token);
    expect(res.status).toBe(200);
    const playerId = res.data.players[0].id;

    const statsRes = await apiGet<StatsResponse>(`/players/${playerId}/stats?season=2023`, token);
    expect(statsRes.status).toBe(200);

    const weeks = statsRes.data.stats.map((s) => s.week);
    expect(weeks).toContain(1);
    expect(weeks).toContain(2);
    expect(weeks).toContain(3);
    expect(weeks).toContain(4);
  });

  it('has QB stats with passing fields for week 1', async () => {
    const res = await apiGet<PlayersResponse>('/players?position=QB&search=Mahomes&limit=1', token);
    const playerId = res.data.players[0].id;

    const statsRes = await apiGet<StatsResponse>(`/players/${playerId}/stats?season=2023&week=1`, token);
    expect(statsRes.status).toBe(200);
    expect(statsRes.data.stats.length).toBe(1);

    const details = statsRes.data.stats[0].statDetails;
    const detailKeys = Object.keys(details);
    expect(detailKeys.length).toBeGreaterThan(0);
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
