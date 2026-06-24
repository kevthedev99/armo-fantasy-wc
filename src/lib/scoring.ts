import type { Match, Pick, PickWinner } from "./types";

/**
 * Point values — edit here when you send your custom scoring rules.
 * Knockout rounds scale like March Madness: deeper rounds = more points.
 */
export const SCORING = {
  group: {
    correctWinner: 1,
    exactScoreBonus: 5,
  },
  knockout: {
    "Round of 32": 4,
    "Round of 16": 8,
    "8th Finals": 4,
    "Quarter-finals": 8,
    "Semi-finals": 16,
    "3rd Place Final": 8,
    "Third place": 8,
    Final: 32,
    correctWinnerDefault: 4,
  },
} as const;

/** API-Football statuses where the match has not kicked off yet. */
const NOT_STARTED_STATUSES = new Set(["NS", "TBD"]);

export function getKnockoutBasePoints(round: string): number {
  const map = SCORING.knockout as Record<string, number>;
  return map[round] ?? SCORING.knockout.correctWinnerDefault;
}

export function isMatchFinished(status: string): boolean {
  return ["FT", "AET", "PEN", "AWD", "WO"].includes(status);
}

export function isMatchInProgress(status: string): boolean {
  return ["1H", "HT", "2H", "ET", "BT", "P", "LIVE", "INT", "SUSP"].includes(
    status
  );
}

/** Picks lock once the match has kicked off or the API reports it as started/finished. */
export function isMatchLocked(
  match: { status: string; kickoff_at: string },
  now = new Date()
): boolean {
  if (!NOT_STARTED_STATUSES.has(match.status)) return true;
  return now.getTime() >= new Date(match.kickoff_at).getTime();
}

export function getMatchLockMessage(
  match: { status: string; kickoff_at: string }
): string {
  if (isMatchFinished(match.status)) {
    return "Locked — match finished. Final score recorded.";
  }
  if (isMatchInProgress(match.status)) {
    return "Locked — match in progress.";
  }
  if (isMatchLocked(match)) {
    return "Locked — match has started.";
  }
  return "";
}

function actualWinner(
  homeScore: number,
  awayScore: number
): PickWinner {
  if (homeScore > awayScore) return "home";
  if (awayScore > homeScore) return "away";
  return "draw";
}

/**
 * Score a single saved pick against a finished match.
 * No pick row for a match means 0 points — nothing is scored or invented.
 */
export function scorePick(match: Match, pick: Pick): number {
  if (
    match.home_score === null ||
    match.away_score === null ||
    !isMatchFinished(match.status)
  ) {
    return 0;
  }

  const home = match.home_score;
  const away = match.away_score;
  const winner = actualWinner(home, away);
  let points = 0;

  if (pick.picked_winner === winner) {
    if (match.stage === "group") {
      points += SCORING.group.correctWinner;
      if (
        pick.home_score_pred === home &&
        pick.away_score_pred === away
      ) {
        points += SCORING.group.exactScoreBonus;
      }
    } else {
      points += getKnockoutBasePoints(match.round);
    }
  }

  return points;
}

export function formatPickSummary(
  match: Match,
  pick: Pick | undefined
): string | null {
  if (!pick) return null;

  const winnerLabel =
    pick.picked_winner === "home"
      ? match.home_team_name.toUpperCase()
      : pick.picked_winner === "away"
        ? match.away_team_name.toUpperCase()
        : "TIE";

  if (
    pick.home_score_pred !== null &&
    pick.away_score_pred !== null
  ) {
    return `${winnerLabel} ${pick.home_score_pred}-${pick.away_score_pred}`;
  }

  return winnerLabel;
}

/** Empty or missing score inputs default to 0 on save. */
export function normalizeGroupScore(
  value: string | number | null | undefined
): number {
  if (value === null || value === undefined || value === "") return 0;
  const n = typeof value === "string" ? parseInt(value, 10) : value;
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

export function validatePickScores(
  pickedWinner: PickWinner,
  homeScore: number,
  awayScore: number
): string | null {
  if (homeScore < 0 || awayScore < 0) return "Scores cannot be negative.";
  if (homeScore > 20 || awayScore > 20) return "Scores look too high.";

  if (pickedWinner === "draw" && homeScore !== awayScore) {
    return "Tie picks need equal scores.";
  }
  if (pickedWinner === "home" && homeScore <= awayScore) {
    return "Home winner needs a higher home score.";
  }
  if (pickedWinner === "away" && awayScore <= homeScore) {
    return "Away winner needs a higher away score.";
  }

  return null;
}

/** Leaderboard totals from scored picks only — missed matches contribute nothing. */
export function aggregateProfileStats(
  picks: Pick[]
): { total_points: number; total_wins: number } {
  let total_points = 0;
  let total_wins = 0;

  for (const pick of picks) {
    if (!pick.is_scored) continue;
    total_points += pick.points_earned;
    if (pick.points_earned > 0) total_wins++;
  }

  return { total_points, total_wins };
}

function pickIsWin(pick: Pick | undefined): boolean {
  return !!pick && pick.is_scored && pick.points_earned > 0;
}

/**
 * Signed streak from most recent finished matches backward.
 * Positive = consecutive wins (W2 → 2), negative = consecutive losses (L2 → -2).
 * A missed pick counts as a loss.
 */
export function computeCurrentStreak(
  finishedMatches: Match[],
  picks: Pick[]
): number {
  const pickByMatch = new Map(picks.map((p) => [p.match_id, p]));
  const sorted = [...finishedMatches].sort(
    (a, b) =>
      new Date(b.kickoff_at).getTime() - new Date(a.kickoff_at).getTime()
  );

  if (sorted.length === 0) return 0;

  let streakKind: "win" | "loss" | null = null;
  let count = 0;

  for (const match of sorted) {
    const won = pickIsWin(pickByMatch.get(match.id));
    const result = won ? "win" : "loss";

    if (streakKind === null) {
      streakKind = result;
      count = 1;
      continue;
    }

    if (result === streakKind) {
      count++;
    } else {
      break;
    }
  }

  if (!streakKind || count === 0) return 0;
  return streakKind === "win" ? count : -count;
}

/** W2 / L2 for standings; em dash when no finished matches yet. */
export function formatStreak(streak: number): string {
  if (streak > 0) return `W${streak}`;
  if (streak < 0) return `L${Math.abs(streak)}`;
  return "—";
}
