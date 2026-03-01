import { describe, it, expect } from 'vitest';
import { deriveRosterStintsFromGames, type DerivedStint } from '../../src/shared/roster-stints';
import type { EspnGameStat } from '../../src/shared/external-api/client';

function makeGame(week: number, teamAbbr: string, eventId?: string): EspnGameStat {
  return {
    eventId: eventId ?? `evt-${week}`,
    week,
    teamAbbr,
    stats: { passingYards: '200' },
  };
}

describe('deriveRosterStintsFromGames', () => {
  it('returns empty array for no games', () => {
    expect(deriveRosterStintsFromGames([], 'KC')).toEqual([]);
  });

  it('creates a single stint for one game', () => {
    const games = [makeGame(1, 'KC')];
    const stints = deriveRosterStintsFromGames(games, 'KC');
    expect(stints).toHaveLength(1);
    expect(stints[0]).toEqual<DerivedStint>({
      teamAbbr: 'KC',
      weekStart: 1,
      weekEnd: 1,
      rosterStatus: 'active',
      transactionType: 'signed',
    });
  });

  it('extends a stint for consecutive weeks on same team', () => {
    const games = [makeGame(1, 'KC'), makeGame(2, 'KC'), makeGame(3, 'KC'), makeGame(4, 'KC')];
    const stints = deriveRosterStintsFromGames(games, 'KC');
    expect(stints).toHaveLength(1);
    expect(stints[0].weekStart).toBe(1);
    expect(stints[0].weekEnd).toBe(4);
    expect(stints[0].rosterStatus).toBe('active');
  });

  it('handles a mid-season team change (trade)', () => {
    const games = [
      makeGame(1, 'BUF'),
      makeGame(2, 'BUF'),
      makeGame(3, 'KC'),
      makeGame(4, 'KC'),
    ];
    const stints = deriveRosterStintsFromGames(games, 'BUF');
    expect(stints).toHaveLength(2);
    expect(stints[0]).toMatchObject({ teamAbbr: 'BUF', weekStart: 1, weekEnd: 2, transactionType: 'signed' });
    expect(stints[1]).toMatchObject({ teamAbbr: 'KC', weekStart: 3, weekEnd: 4, transactionType: 'traded' });
  });

  it('infers practice squad stint for a gap on the same team', () => {
    const games = [
      makeGame(1, 'KC'),
      makeGame(2, 'KC'),
      makeGame(5, 'KC'),
    ];
    const stints = deriveRosterStintsFromGames(games, 'KC');

    expect(stints).toHaveLength(3);
    expect(stints[0]).toMatchObject({ teamAbbr: 'KC', weekStart: 1, weekEnd: 2, rosterStatus: 'active' });
    expect(stints[1]).toMatchObject({
      teamAbbr: 'KC',
      weekStart: 3,
      weekEnd: 4,
      rosterStatus: 'practice_squad',
      transactionType: 'demoted',
    });
    expect(stints[2]).toMatchObject({
      teamAbbr: 'KC',
      weekStart: 5,
      weekEnd: 5,
      rosterStatus: 'active',
      transactionType: 'promoted',
    });
  });

  it('uses fallback team abbreviation when game has empty teamAbbr', () => {
    const games = [makeGame(1, ''), makeGame(2, '')];
    const stints = deriveRosterStintsFromGames(games, 'DAL');
    expect(stints).toHaveLength(1);
    expect(stints[0].teamAbbr).toBe('DAL');
  });

  it('falls back to UNK when both game and fallback are empty', () => {
    const games = [makeGame(1, '')];
    const stints = deriveRosterStintsFromGames(games, '');
    expect(stints).toHaveLength(1);
    expect(stints[0].teamAbbr).toBe('UNK');
  });

  it('handles out-of-order games by sorting them', () => {
    const games = [makeGame(4, 'KC'), makeGame(1, 'KC'), makeGame(3, 'KC'), makeGame(2, 'KC')];
    const stints = deriveRosterStintsFromGames(games, 'KC');
    expect(stints).toHaveLength(1);
    expect(stints[0]).toMatchObject({ weekStart: 1, weekEnd: 4 });
  });

  it('handles trade followed by gap on new team', () => {
    const games = [
      makeGame(1, 'BUF'),
      makeGame(3, 'KC'),
      makeGame(5, 'KC'),
    ];
    const stints = deriveRosterStintsFromGames(games, 'BUF');
    expect(stints).toHaveLength(4);
    expect(stints[0]).toMatchObject({ teamAbbr: 'BUF', weekStart: 1, weekEnd: 1 });
    expect(stints[1]).toMatchObject({ teamAbbr: 'KC', weekStart: 3, weekEnd: 3, transactionType: 'traded' });
    expect(stints[2]).toMatchObject({ teamAbbr: 'KC', weekStart: 4, weekEnd: 4, rosterStatus: 'practice_squad' });
    expect(stints[3]).toMatchObject({ teamAbbr: 'KC', weekStart: 5, weekEnd: 5, transactionType: 'promoted' });
  });

  it('handles multiple team changes', () => {
    const games = [
      makeGame(1, 'ARI'),
      makeGame(2, 'BAL'),
      makeGame(3, 'CHI'),
    ];
    const stints = deriveRosterStintsFromGames(games, 'ARI');
    expect(stints).toHaveLength(3);
    expect(stints[0]).toMatchObject({ teamAbbr: 'ARI', transactionType: 'signed' });
    expect(stints[1]).toMatchObject({ teamAbbr: 'BAL', transactionType: 'traded' });
    expect(stints[2]).toMatchObject({ teamAbbr: 'CHI', transactionType: 'traded' });
  });
});
