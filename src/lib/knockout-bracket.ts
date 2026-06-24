import { format } from "date-fns";
import { isMatchFinished, isMatchLocked } from "@/lib/scoring";
import type { Match } from "@/lib/types";

export const ROUND_OF_32_ROUNDS = new Set(["Round of 32", "8th Finals"]);

export function isRoundOf32Match(match: { round: string }): boolean {
  return ROUND_OF_32_ROUNDS.has(match.round);
}

/** Earliest kickoff among loaded Round of 32 fixtures. */
export function getRoundOf32Kickoff(
  matches: Pick<Match, "stage" | "round" | "kickoff_at">[]
): Date | null {
  const ro32 = matches.filter(
    (m) => m.stage === "knockout" && isRoundOf32Match(m)
  );
  if (ro32.length === 0) return null;

  const earliest = Math.min(
    ...ro32.map((m) => new Date(m.kickoff_at).getTime())
  );
  return new Date(earliest);
}

export function formatRoundOf32Deadline(kickoff: Date): string {
  return format(kickoff, "EEEE, MMMM d, yyyy 'at' h:mm a");
}

/**
 * NCAA-style bracket lock: every knockout pick locks once Round of 32 starts.
 * Group-stage picks still lock per match at kickoff.
 */
export function isKnockoutBracketLocked(
  matches: Pick<Match, "stage" | "round" | "kickoff_at" | "status">[],
  now = new Date()
): boolean {
  const ro32 = matches.filter(
    (m) => m.stage === "knockout" && isRoundOf32Match(m)
  );
  if (ro32.length === 0) return false;
  return ro32.some((m) => isMatchLocked(m, now));
}

export function isPickLocked(
  match: Pick<Match, "stage" | "round" | "kickoff_at" | "status">,
  allMatches: Pick<Match, "stage" | "round" | "kickoff_at" | "status">[],
  now = new Date()
): boolean {
  if (match.stage === "knockout") {
    return isKnockoutBracketLocked(allMatches, now);
  }
  return isMatchLocked(match, now);
}

export function getPickLockMessage(
  match: Pick<Match, "stage" | "round" | "kickoff_at" | "status">,
  allMatches: Pick<Match, "stage" | "round" | "kickoff_at" | "status">[]
): string {
  if (
    match.stage === "knockout" &&
    isKnockoutBracketLocked(allMatches)
  ) {
    return "Locked — knockout bracket closed. Round of 32 has started.";
  }

  if (isMatchFinished(match.status)) {
    return "Locked — match finished. Final score recorded.";
  }
  if (isMatchLocked(match)) {
    return "Locked — match has started.";
  }
  return "";
}
