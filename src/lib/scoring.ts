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
    "Round of 32": 2,
    "Round of 16": 4,
    "8th Finals": 2,
    "Quarter-finals": 8,
    "Semi-finals": 16,
    "3rd Place Final": 8,
    "Third place": 8,
    Final: 32,
    correctWinnerDefault: 4,
    winningGoalMinuteBonus: 3,
    winningGoalMinuteTolerance: 5,
  },
  lockSecondsBeforeKickoff: 60,
} as const;

export function getKnockoutBasePoints(round: string): number {
  const map = SCORING.knockout as Record<string, number>;
  return map[round] ?? SCORING.knockout.correctWinnerDefault;
}

export function isMatchLocked(kickoffAt: string, now = new Date()): boolean {
  const kickoff = new Date(kickoffAt).getTime();
  const lockAt = kickoff - SCORING.lockSecondsBeforeKickoff * 1000;
  return now.getTime() >= lockAt;
}

export function isMatchFinished(status: string): boolean {
  return ["FT", "AET", "PEN"].includes(status);
}

function actualWinner(
  homeScore: number,
  awayScore: number
): PickWinner {
  if (homeScore > awayScore) return "home";
  if (awayScore > homeScore) return "away";
  return "draw";
}

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
      if (
        pick.winning_goal_minute_pred !== null &&
        match.winning_goal_minute !== null &&
        Math.abs(
          pick.winning_goal_minute_pred - match.winning_goal_minute
        ) <= SCORING.knockout.winningGoalMinuteTolerance
      ) {
        points += SCORING.knockout.winningGoalMinuteBonus;
      }
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
