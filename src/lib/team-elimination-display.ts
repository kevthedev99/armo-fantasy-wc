import {
  buildKnockoutMatchMap,
  isTeamEliminatedForUser,
} from "@/lib/bracket-chaining";
import type { Match, Pick as UserPick } from "@/lib/types";

export type TeamEliminationChecker = (
  teamId: number,
  beforeKickoff: string
) => boolean;

/** Far-future cutoff so all finished earlier knockouts count (placeholder slots). */
export const BRACKET_PLACEHOLDER_KICKOFF = "2099-12-31T23:59:59.999Z";

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

export function isMatchSideEliminated(
  match: Pick<Match, "stage" | "kickoff_at" | "home_team_id" | "away_team_id">,
  side: "home" | "away",
  check: TeamEliminationChecker | undefined
): boolean {
  if (!check || match.stage !== "knockout") return false;
  const teamId = side === "home" ? match.home_team_id : match.away_team_id;
  return check(teamId, match.kickoff_at);
}
