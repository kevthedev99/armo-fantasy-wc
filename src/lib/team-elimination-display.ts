import {
  buildKnockoutMatchMap,
  isTeamEliminatedForUser,
} from "@/lib/bracket-chaining";
import { getActualWinnerSide, isMatchFinished } from "@/lib/scoring";
import type { Match, Pick as UserPick } from "@/lib/types";

export type KnockoutMatchForElimination = Pick<
  Match,
  | "stage"
  | "status"
  | "kickoff_at"
  | "home_team_id"
  | "away_team_id"
  | "home_score"
  | "away_score"
  | "pen_home_score"
  | "pen_away_score"
>;

export type TeamEliminationChecker = (
  teamId: number,
  beforeKickoff: string
) => boolean;

/** Far-future cutoff so all finished earlier knockouts count (placeholder slots). */
export const BRACKET_PLACEHOLDER_KICKOFF = "2099-12-31T23:59:59.999Z";

/** True when this side lost a finished knockout fixture. */
export function isKnockoutSideLost(
  match: KnockoutMatchForElimination,
  side: "home" | "away"
): boolean {
  if (match.stage !== "knockout" || !isMatchFinished(match.status)) {
    return false;
  }
  const winner = getActualWinnerSide(match);
  if (!winner || winner === "draw") return false;
  return side !== winner;
}

export function createTeamEliminationChecker(
  picks: UserPick[],
  matches: Match[]
): TeamEliminationChecker {
  const picksByMatchId = new Map<number, UserPick>();
  for (const p of picks) {
    picksByMatchId.set(p.match_id, p);
  }
  const matchesById = buildKnockoutMatchMap(matches);

  return (teamId, beforeKickoff) =>
    isTeamEliminatedForUser(
      teamId,
      beforeKickoff,
      picksByMatchId,
      matchesById
    );
}

/** Cross out bracket-dead teams or the loser of a finished knockout match. */
export function isMatchSideEliminated(
  match: KnockoutMatchForElimination,
  side: "home" | "away",
  check: TeamEliminationChecker | undefined
): boolean {
  if (match.stage !== "knockout") return false;
  if (isKnockoutSideLost(match, side)) return true;
  if (!check) return false;
  const teamId = side === "home" ? match.home_team_id : match.away_team_id;
  return check(teamId, match.kickoff_at);
}
