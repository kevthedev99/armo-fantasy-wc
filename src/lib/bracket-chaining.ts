import { getActualWinnerSide, isMatchFinished } from "@/lib/scoring";
import type { Match, Pick as UserPick } from "@/lib/types";

export type ChainingMatch = {
  id: number;
  stage: Match["stage"];
  kickoff_at: string;
  status: string;
  home_team_id: number;
  away_team_id: number;
  home_score: number | null;
  away_score: number | null;
  pen_home_score: number | null;
  pen_away_score: number | null;
};

/** Team the user picked to win this match. */
export function getPickedTeamId(
  match: Pick<Match, "home_team_id" | "away_team_id">,
  pick: UserPick
): number | null {
  if (pick.picked_winner === "home") return match.home_team_id;
  if (pick.picked_winner === "away") return match.away_team_id;
  return null;
}

/** Winning team from the final recorded score (including penalty shootouts). */
export function getActualWinnerTeamId(
  match: Pick<
    Match,
    | "home_team_id"
    | "away_team_id"
    | "home_score"
    | "away_score"
    | "pen_home_score"
    | "pen_away_score"
    | "status"
  >
): number | null {
  const side = getActualWinnerSide(match);
  if (side === "home") return match.home_team_id;
  if (side === "away") return match.away_team_id;
  return null;
}

/**
 * Sleeper-style: a team is dead if the user picked that team to win an earlier
 * knockout match and that team did not actually win it.
 */
export function isTeamEliminatedForUser(
  teamId: number,
  beforeKickoff: string,
  picksByMatchId: Map<number, UserPick>,
  matchesById: Map<number, ChainingMatch>
): boolean {
  const cutoff = new Date(beforeKickoff).getTime();

  for (const [matchId, pick] of picksByMatchId) {
    const earlier = matchesById.get(matchId);
    if (!earlier || earlier.stage !== "knockout") continue;
    if (new Date(earlier.kickoff_at).getTime() >= cutoff) continue;
    if (!isMatchFinished(earlier.status)) continue;
    if (getPickedTeamId(earlier, pick) !== teamId) continue;

    const actualWinner = getActualWinnerTeamId(earlier);
    if (actualWinner !== teamId) return true;
  }

  return false;
}

/** True when the picked team is still alive on the user's bracket. */
export function canScoreKnockoutPick(
  match: ChainingMatch,
  pick: UserPick,
  picksByMatchId: Map<number, UserPick>,
  matchesById: Map<number, ChainingMatch>
): boolean {
  const pickedTeamId = getPickedTeamId(match, pick);
  if (pickedTeamId === null) return false;

  return !isTeamEliminatedForUser(
    pickedTeamId,
    match.kickoff_at,
    picksByMatchId,
    matchesById
  );
}

export function buildKnockoutMatchMap(
  matches: ChainingMatch[]
): Map<number, ChainingMatch> {
  return new Map(
    matches.filter((m) => m.stage === "knockout").map((m) => [m.id, m])
  );
}

/** Rescore finished knockouts at or after a trigger game (team eliminations). */
export function getKnockoutMatchIdsToRescore(
  finishedMatchIds: number[],
  knockoutMatches: ChainingMatch[]
): Set<number> {
  const ids = new Set<number>(finishedMatchIds);

  for (const finishedId of finishedMatchIds) {
    const trigger = knockoutMatches.find((m) => m.id === finishedId);
    if (!trigger) continue;

    const triggerMs = new Date(trigger.kickoff_at).getTime();
    for (const m of knockoutMatches) {
      if (
        isMatchFinished(m.status) &&
        new Date(m.kickoff_at).getTime() >= triggerMs
      ) {
        ids.add(m.id);
      }
    }
  }

  return ids;
}
