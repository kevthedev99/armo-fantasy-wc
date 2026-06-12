export interface BalanceState {
  balance: number;
  canPlay: boolean;
  resetIn: string;
  resetInMs: number;
  dailyAllowance: number;
}

export interface CasinoLeaderboardRow {
  rank: number;
  userId: string;
  username: string;
  displayName: string;
  avatarColor: string;
  balance: number;
}
