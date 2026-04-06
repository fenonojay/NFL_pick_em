export type RuleMode = "WINNER_NO_REPEAT" | "LOSER";
export type PickType = "REGULAR" | "PLAYOFF";

export interface Season {
  id: string;
  name: string;
  year: number;
  rule_mode: RuleMode;
  is_active: boolean;
}

export interface Team {
  id: string;
  abbreviation: string;
  name: string;
}

export interface Week {
  id: string;
  season_id: string;
  week_number: number;
  is_playoff: boolean;
  lock_at: string;
}

export interface Game {
  id: string;
  week_id: string;
  home_team_id: string;
  away_team_id: string;
  kickoff_at: string;
  winner_team_id: string | null;
}
