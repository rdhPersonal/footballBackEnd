import type { EspnGameStat } from './external-api/client';

export type DerivedStint = {
  teamAbbr: string;
  weekStart: number;
  weekEnd: number;
  rosterStatus: 'active' | 'practice_squad';
  transactionType: 'signed' | 'traded' | 'promoted' | 'demoted';
};

export function deriveRosterStintsFromGames(games: EspnGameStat[], fallbackTeamAbbr: string): DerivedStint[] {
  if (games.length === 0) return [];

  const normalized = games
    .map((g) => ({
      ...g,
      teamAbbr: g.teamAbbr || fallbackTeamAbbr || 'UNK',
    }))
    .sort((a, b) => a.week - b.week);

  const stints: DerivedStint[] = [];
  let prev: DerivedStint | null = null;

  for (const game of normalized) {
    if (!prev) {
      prev = {
        teamAbbr: game.teamAbbr,
        weekStart: game.week,
        weekEnd: game.week,
        rosterStatus: 'active',
        transactionType: 'signed',
      };
      stints.push(prev);
      continue;
    }

    const sameTeam: boolean = prev.teamAbbr === game.teamAbbr;
    const contiguous: boolean = game.week === prev.weekEnd + 1;

    if (sameTeam && contiguous) {
      prev.weekEnd = game.week;
      continue;
    }

    const gapStart = prev.weekEnd + 1;
    const gapEnd = game.week - 1;
    if (sameTeam && gapStart <= gapEnd) {
      stints.push({
        teamAbbr: game.teamAbbr,
        weekStart: gapStart,
        weekEnd: gapEnd,
        rosterStatus: 'practice_squad',
        transactionType: 'demoted',
      });
    }

    prev = {
      teamAbbr: game.teamAbbr,
      weekStart: game.week,
      weekEnd: game.week,
      rosterStatus: 'active',
      transactionType: sameTeam ? 'promoted' : 'traded',
    };
    stints.push(prev);
  }

  return stints;
}
