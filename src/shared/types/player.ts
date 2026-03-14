export type Position = 'QB' | 'RB' | 'WR' | 'TE' | 'K' | 'P' | 'DEF';

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

// ----- Strongly typed stat interfaces -----

export interface PassingStats {
  playerId: string;
  season: number;
  week: number;
  teamAbbr: string;
  eventId?: string;
  attempts: number;
  completions: number;
  yards: number;
  touchdowns: number;
  interceptions: number;
  sacks: number;
  longest: number;
  qbRating?: number;
  adjQbr?: number;
}

export interface RushingStats {
  playerId: string;
  season: number;
  week: number;
  teamAbbr: string;
  eventId?: string;
  attempts: number;
  yards: number;
  touchdowns: number;
  longest: number;
  fumbles: number;
  fumblesLost: number;
}

export interface ReceivingStats {
  playerId: string;
  season: number;
  week: number;
  teamAbbr: string;
  eventId?: string;
  targets: number;
  receptions: number;
  yards: number;
  touchdowns: number;
  longest: number;
}

export interface KickingStats {
  playerId: string;
  season: number;
  week: number;
  teamAbbr: string;
  eventId?: string;
  fgMade: number;
  fgAttempted: number;
  fgLong: number;
  fgPct?: number;
  xpMade: number;
  xpAttempted: number;
  points: number;
}

export interface PlayerGameStats {
  passing?: PassingStats;
  rushing?: RushingStats;
  receiving?: ReceivingStats;
  kicking?: KickingStats;
}

export interface ScoringConfig {
  id: number;
  name: string;
  description?: string;
  passingYardPts: number;
  passingTdPts: number;
  interceptionPts: number;
  sackPts: number;
  rushingYardPts: number;
  rushingTdPts: number;
  receivingYardPts: number;
  receivingTdPts: number;
  receptionPts: number;
  fumbleLostPts: number;
  fgMadePts: number;
  xpMadePts: number;
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
