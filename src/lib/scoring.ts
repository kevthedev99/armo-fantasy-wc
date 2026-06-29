import type { Match, Pick as UserPick, PickWinner } from "./types";
import {
  buildKnockoutMatchMap,
  canScoreKnockoutPick,
  type ChainingMatch,
} from "./bracket-chaining";
import { pickPredictsPenalties } from "./pick-storage";

export type ScorePickContext = {
  knockoutMatches: ChainingMatch[];
  picksByMatchId: Map<number, UserPick>;
};

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
    "Round of 16": 6,
    "8th Finals": 4,
    "Quarter-finals": 8,
    "Semi-finals": 16,
    "3rd Place Final": 8,
    "Third place": 8,
    Final: 24,
    correctWinnerDefault: 4,
    /** Add-on when a penalties pick names the shootout winner. */
    penaltiesWinnerBonus: 5,
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

export function isMatchDecidedByPenalties(status: string): boolean {
  return status === "PEN";
}

export { pickPredictsPenalties, PENALTIES_PICK_SENTINEL } from "./pick-storage";

export function getActualWinnerSide(match: {
  home_score: number | null;
  away_score: number | null;
  pen_home_score: number | null;
  pen_away_score: number | null;
  status: string;
}): PickWinner | null {
  if (
    match.home_score === null ||
    match.away_score === null ||
    !isMatchFinished(match.status)
  ) {
    return null;
  }

  if (match.status === "PEN") {
    const penHome = match.pen_home_score;
    const penAway = match.pen_away_score;
    if (penHome !== null && penAway !== null) {
      if (penHome > penAway) return "home";
      if (penAway > penHome) return "away";
    }
  }

  return actualWinner(match.home_score, match.away_score);
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

/** Kickoff + buffer — regular time and stoppage should be done; still not FT in DB. */
const STALE_IN_PROGRESS_MS = 110 * 60 * 1000;

/** DB still shows in-progress (or locked-not-finished) long after kickoff — re-fetch by id. */
export function isStaleInProgressMatch(
  match: { status: string; kickoff_at: string },
  now = new Date()
): boolean {
  if (isMatchFinished(match.status)) return false;
  const elapsed = now.getTime() - new Date(match.kickoff_at).getTime();
  if (elapsed < STALE_IN_PROGRESS_MS) return false;
  return isMatchInProgress(match.status) || isMatchLocked(match, now);
}

/** Re-fetch by fixture id during sync — live games plus stuck post-whistle rows. */
export function getSyncRefreshFixtureIds(
  matches: { id: number; status: string; kickoff_at: string }[]
): number[] {
  const ids = new Set<number>();
  for (const match of matches) {
    if (isMatchInProgress(match.status) || isStaleInProgressMatch(match)) {
      ids.add(match.id);
    }
  }
  return [...ids];
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
 * Final score after 90+extra time (before a shootout). Knockout "full time"
 * picks use this — a predicted 2-1 matches the same 2-1 whether status is FT or AET.
 */
export function getMatchResultScores(
  match: Pick<Match, "status" | "home_score" | "away_score">
): { home: number; away: number } | null {
  if (!isMatchFinished(match.status)) return null;
  if (match.home_score === null || match.away_score === null) return null;
  return { home: match.home_score, away: match.away_score };
}

/** Exact score for group or knockout (not penalties-only picks). */
export function isExactScorePick(
  match: Match,
  pick: Pick<UserPick, "home_score_pred" | "away_score_pred" | "predicts_penalties">
): boolean {
  if (pickPredictsPenalties(pick)) return false;
  const result = getMatchResultScores(match);
  if (!result) return false;
  if (pick.home_score_pred === null || pick.away_score_pred === null) {
    return false;
  }
  return (
    pick.home_score_pred === result.home &&
    pick.away_score_pred === result.away
  );
}

/**
 * Score a single saved pick against a finished match.
 * No pick row for a match means 0 points — nothing is scored or invented.
 */
export function scorePick(
  match: Match,
  pick: UserPick,
  context?: ScorePickContext
): number {
  if (
    match.home_score === null ||
    match.away_score === null ||
    !isMatchFinished(match.status)
  ) {
    return 0;
  }

  if (match.stage === "knockout" && context) {
    const matchesById = buildKnockoutMatchMap(context.knockoutMatches);
    if (
      !canScoreKnockoutPick(
        match,
        pick,
        context.picksByMatchId,
        matchesById
      )
    ) {
      return 0;
    }
  }

  const winner = getActualWinnerSide(match);
  if (!winner) return 0;

  if (match.stage === "knockout" && pickPredictsPenalties(pick)) {
    // Wrong winner = 0 points either way.
    if (pick.picked_winner !== winner) return 0;

    // Right winner — always award the round's base points. The +5 exact-score
    // bonus is unavailable on penalties picks (no score predicted), and the
    // penalties-winner bonus only applies when the match actually went to pens.
    let points = getKnockoutBasePoints(match.round);
    if (isMatchDecidedByPenalties(match.status)) {
      points += SCORING.knockout.penaltiesWinnerBonus;
    }
    return points;
  }

  let points = 0;

  if (pick.picked_winner === winner) {
    if (match.stage === "group") {
      points += SCORING.group.correctWinner;
      if (isExactScorePick(match, pick)) {
        points += SCORING.group.exactScoreBonus;
      }
    } else {
      points += getKnockoutBasePoints(match.round);
      if (isExactScorePick(match, pick)) {
        points += SCORING.group.exactScoreBonus;
      }
    }
  }

  return points;
}

export function formatPickSummary(
  match: Match,
  pick: UserPick | undefined
): string | null {
  if (!pick) return null;

  if (pickPredictsPenalties(pick)) {
    const team =
      pick.picked_winner === "home"
        ? match.home_team_name
        : pick.picked_winner === "away"
          ? match.away_team_name
          : null;
    if (team) return `${team.toUpperCase()} ON PENS`;
  }

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

export function validateKnockoutPick(
  pickedWinner: PickWinner,
  homeScore: number,
  awayScore: number,
  predictsPenalties: boolean
): string | null {
  if (predictsPenalties) {
    if (pickedWinner === "draw") {
      return "Choose who wins on penalties.";
    }
    return null;
  }
  return validateKnockoutPickScores(pickedWinner, homeScore, awayScore);
}

export function validateKnockoutPickScores(
  pickedWinner: PickWinner,
  homeScore: number,
  awayScore: number
): string | null {
  if (pickedWinner === "draw") {
    return "Knockout picks must choose a winner — no ties.";
  }
  return validatePickScores(pickedWinner, homeScore, awayScore);
}

/** Leaderboard totals from scored picks only — missed matches contribute nothing. */
export function aggregateProfileStats(
  picks: UserPick[]
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

function pickIsWin(pick: UserPick | undefined): boolean {
  return !!pick && pick.is_scored && pick.points_earned > 0;
}

/**
 * Signed streak from most recent finished matches backward.
 * Positive = consecutive wins (W2 → 2), negative = consecutive losses (L2 → -2).
 * A missed pick counts as a loss.
 */
export function computeCurrentStreak(
  finishedMatches: Match[],
  picks: UserPick[]
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
