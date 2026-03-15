import type {
  PlayerDto,
  Position,
  RosterStatus,
  TransactionType,
  PassingStatsDto,
  RushingStatsDto,
  ReceivingStatsDto,
  KickingStatsDto,
  ScoringConfigDto,
  TeamDto,
} from './api-contract';

export type { Position, RosterStatus, TransactionType };

export interface Player extends Omit<PlayerDto, 'currentTeamAbbr' | 'rosterStatus'> {
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

export interface PassingStats extends PassingStatsDto {
  playerId: string;
  eventId?: string;
}

export interface RushingStats extends RushingStatsDto {
  playerId: string;
  eventId?: string;
}

export interface ReceivingStats extends ReceivingStatsDto {
  playerId: string;
  eventId?: string;
}

export interface KickingStats extends KickingStatsDto {
  playerId: string;
  eventId?: string;
}

export interface PlayerGameStats {
  passing?: PassingStats;
  rushing?: RushingStats;
  receiving?: ReceivingStats;
  kicking?: KickingStats;
}

export type ScoringConfig = ScoringConfigDto;

export type NflTeam = TeamDto;
