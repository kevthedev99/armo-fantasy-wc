export type PickWinner = "home" | "away" | "draw";

export type MatchStage = "group" | "knockout";

export interface Profile {
  id: string;
  username: string;
  display_name: string;
  avatar_color: string;
  total_points: number;
  total_wins: number;
  current_streak: number;
  created_at: string;
}

export interface Match {
  id: number;
  round: string;
  group_name: string | null;
  stage: MatchStage;
  home_team_id: number;
  home_team_name: string;
  home_team_logo: string | null;
  away_team_id: number;
  away_team_name: string;
  away_team_logo: string | null;
  kickoff_at: string;
  status: string;
  home_score: number | null;
  away_score: number | null;
  winning_goal_minute: number | null;
}

export interface Pick {
  id: string;
  user_id: string;
  match_id: number;
  picked_winner: PickWinner;
  home_score_pred: number | null;
  away_score_pred: number | null;
  winning_goal_minute_pred: number | null;
  points_earned: number;
  is_scored: boolean;
}

export interface AppSettings {
  knockout_unlocked: boolean;
  group_stage_complete: boolean;
  last_sync_at: string | null;
}

export interface NewsItem {
  id: string;
  content: string;
  created_at: string;
}

export interface ApiFootballFixture {
  fixture: {
    id: number;
    date: string;
    status: { short: string };
  };
  league: { round: string };
  teams: {
    home: { id: number; name: string; logo: string };
    away: { id: number; name: string; logo: string };
  };
  goals: { home: number | null; away: number | null };
  score: {
    halftime: { home: number | null; away: number | null };
    fulltime: { home: number | null; away: number | null };
  };
}
