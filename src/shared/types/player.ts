export type Position = 'QB' | 'RB' | 'WR' | 'TE' | 'K' | 'DEF';

export type RosterStatus =
  | 'active'
  | 'practice_squad'
  | 'injured_reserve'
  | 'suspended'
  | 'pup';

export type TransactionType =
  | 'drafted'
  | 'signed'
  | 'traded'
  | 'claimed'
  | 'promoted'
  | 'demoted'
  | 'activated'
  | 'released';

export interface Player {
  id: string;
  externalId: string;
  name: string;
  position: Position;
  photoUrl?: string;
  dateOfBirth?: string;
  college?: string;
  heightInches?: number;
  weightLbs?: number;
  createdAt: string;
  updatedAt: string;
}

export interface TeamRoster {
  id: number;
  playerId: string;
  teamAbbr: string;
  season: number;
  weekStart: number;
  weekEnd?: number;
  rosterStatus: RosterStatus;
  transactionType: TransactionType;
  createdAt: string;
}

export interface PlayerStats {
  id: number;
  playerId: string;
  teamAbbr: string;
  season: number;
  week: number;
  gamesPlayed: number;
  totalPoints: number;
  projectedPoints?: number;
  statDetails: Record<string, number>;
  createdAt: string;
  updatedAt: string;
}

export interface NflTeam {
  id: number;
  abbr: string;
  name: string;
  conference: string;
  division: string;
  byeWeek?: number;
  season: number;
}
