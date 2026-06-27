import { format } from "date-fns";
import { isMatchFinished, isMatchLocked } from "@/lib/scoring";
import type { Match } from "@/lib/types";

export const ROUND_OF_32_ROUNDS = new Set(["Round of 32", "8th Finals"]);

/** Official Round of 32 start date (Pacific). */
export const ROUND_OF_32_START_DATE = "2026-06-28";

const ROUND_OF_32_LABEL_FORMATTER = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/Los_Angeles",
  weekday: "long",
  month: "long",
  day: "numeric",
  year: "numeric",
});

export function isRoundOf32Match(match: { round: string }): boolean {
  return ROUND_OF_32_ROUNDS.has(match.round);
}

/** API-Football round names → user-facing knockout round label. */
export function normalizeKnockoutRoundLabel(round: string): string {
  if (round === "8th Finals") return "Round of 32";
  if (round === "3rd Place Final" || round === "Third place") return "Third Place";
  return round;
}

/** Badge copy for a day/group of matches, e.g. "Knockout Stage - Round of 32". */
export function getKnockoutStageBadgeLabel(
  matches: Pick<Match, "stage" | "round">[]
): string | null {
  const knockout = matches.filter((m) => m.stage === "knockout");
  if (knockout.length === 0) return null;

  const rounds = [
    ...new Set(knockout.map((m) => normalizeKnockoutRoundLabel(m.round))),
  ];
  if (rounds.length === 1) {
    return `Knockout Stage - ${rounds[0]}`;
  }
  return "Knockout Stage";
}

/** 10:00 AM Pacific June 28, 2026 — bracket deadline if fixtures are not synced. */
export function getCanonicalRoundOf32Start(): Date {
  return new Date(`${ROUND_OF_32_START_DATE}T10:00:00-07:00`);
}

/** User-facing label, e.g. "Sunday, June 28, 2026". */
export function formatRoundOf32StartLabel(): string {
  return ROUND_OF_32_LABEL_FORMATTER.format(getCanonicalRoundOf32Start());
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

/** When the knockout bracket locks — synced first Ro32 kickoff or June 28, 2026. */
export function getRoundOf32LockAt(
  matches: Pick<Match, "stage" | "round" | "kickoff_at">[]
): Date {
  return getRoundOf32Kickoff(matches) ?? getCanonicalRoundOf32Start();
}

/** @deprecated Use getRoundOf32LockAt for timing and formatRoundOf32StartLabel for copy. */
export function resolveRoundOf32Kickoff(
  matches: Pick<Match, "stage" | "round" | "kickoff_at">[]
): Date {
  return getRoundOf32LockAt(matches);
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
  if (ro32.length > 0) {
    return ro32.some((m) => isMatchLocked(m, now));
  }
  return now.getTime() >= getCanonicalRoundOf32Start().getTime();
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
