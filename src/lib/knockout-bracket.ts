import { isMatchFinished, isMatchLocked } from "@/lib/scoring";
import type { Match } from "@/lib/types";

export const ROUND_OF_32_ROUNDS = new Set(["Round of 32", "8th Finals"]);

/** Official knockout bracket lock — 11:59 PM Pacific, June 29, 2026. */
export const ROUND_OF_32_LOCK_DATE = "2026-06-29";

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

/** @deprecated Use ROUND_OF_32_LOCK_DATE */
export const ROUND_OF_32_START_DATE = ROUND_OF_32_LOCK_DATE;

/** 11:59 PM Pacific on lock date — entire knockout bracket locks. */
export function getCanonicalRoundOf32LockAt(): Date {
  return new Date(`${ROUND_OF_32_LOCK_DATE}T23:59:59.999-07:00`);
}

/** @deprecated Use getCanonicalRoundOf32LockAt */
export function getCanonicalRoundOf32Start(): Date {
  return getCanonicalRoundOf32LockAt();
}

/** User-facing label, e.g. "Sunday, June 28, 2026". */
export function formatRoundOf32StartLabel(): string {
  return ROUND_OF_32_LABEL_FORMATTER.format(getCanonicalRoundOf32LockAt());
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

/** Bracket deadline — official lock time (extended; not tied to first Ro32 kickoff). */
export function getRoundOf32LockAt(
  matches?: Pick<Match, "stage" | "round" | "kickoff_at">[]
): Date {
  void matches;
  return getCanonicalRoundOf32LockAt();
}

/** @deprecated Use getRoundOf32LockAt for timing and formatRoundOf32StartLabel for copy. */
export function resolveRoundOf32Kickoff(
  matches: Pick<Match, "stage" | "round" | "kickoff_at">[]
): Date {
  return getRoundOf32LockAt(matches);
}

export function formatRoundOf32Deadline(deadline: Date): string {
  const formatted = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(deadline);
  return `${formatted} Pacific`;
}

/** Every group-stage fixture in the DB has finished. */
export function isGroupStageComplete(
  matches: Pick<Match, "stage" | "status">[],
  settings?: { group_stage_complete?: boolean } | null
): boolean {
  if (settings?.group_stage_complete) return true;

  const group = matches.filter((m) => m.stage === "group");
  if (group.length === 0) return false;

  return group.every((m) => isMatchFinished(m.status));
}

/**
 * Knockout bracket challenge is live — players fill confirmed slots as groups finish.
 * Does not require the entire group stage to be complete.
 */
export function isKnockoutChallengeActive(
  matches: Pick<Match, "stage" | "status">[],
  settings?: {
    knockout_unlocked?: boolean;
    group_stage_complete?: boolean;
  } | null
): boolean {
  if (settings?.knockout_unlocked || settings?.group_stage_complete) {
    return true;
  }

  if (matches.some((m) => m.stage === "knockout")) {
    return true;
  }

  return matches.some(
    (m) => m.stage === "group" && isMatchFinished(m.status)
  );
}

/**
 * NCAA-style bracket lock: entire bracket closes at 11:59 PM Pacific on lock date.
 * Individual Ro32 kickoffs do not close the bracket early.
 */
export function isKnockoutBracketLocked(
  matches: Pick<Match, "stage" | "round" | "kickoff_at" | "status">[],
  now = new Date()
): boolean {
  return now.getTime() >= getRoundOf32LockAt(matches).getTime();
}

/** Bracket picks allowed until the official Pacific deadline. */
export function isKnockoutBracketOpen(
  matches: Pick<Match, "stage" | "round" | "kickoff_at" | "status">[],
  now = new Date()
): boolean {
  return !isKnockoutBracketLocked(matches, now);
}

export function isPickLocked(
  match: Pick<Match, "stage" | "round" | "kickoff_at" | "status">,
  allMatches: Pick<Match, "stage" | "round" | "kickoff_at" | "status">[],
  now = new Date()
): boolean {
  if (match.stage === "knockout") {
    if (isKnockoutBracketLocked(allMatches, now)) return true;
    return isMatchLocked(match, now);
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
    return "Locked — knockout bracket closed. The deadline has passed.";
  }

  if (isMatchFinished(match.status)) {
    return "Locked — match finished. Final score recorded.";
  }
  if (isMatchLocked(match)) {
    return "Locked — match has started.";
  }
  return "";
}
