import { isMatchFinished, isMatchInProgress, isMatchDecidedByPenalties, isMatchLocked } from "@/lib/scoring";
import type { Match } from "@/lib/types";

export type MatchBucket = "live" | "upcoming" | "finished";

export function getMatchBucket(
  match: Match,
  now = new Date()
): MatchBucket {
  if (isMatchFinished(match.status)) return "finished";
  if (isMatchInProgress(match.status)) return "live";
  if (isMatchLocked(match, now) && !isMatchFinished(match.status)) {
    return "live";
  }
  return "upcoming";
}

const STATUS_LABELS: Record<string, string> = {
  NS: "Scheduled",
  TBD: "TBD",
  "1H": "1st Half",
  HT: "Half Time",
  "2H": "2nd Half",
  ET: "Extra Time",
  BT: "Break",
  P: "Penalties",
  LIVE: "Live",
  INT: "Interrupted",
  SUSP: "Suspended",
  FT: "Full Time",
  AET: "After ET",
  PEN: "Penalties",
  AWD: "Awarded",
  WO: "Walkover",
};

export function getStatusLabel(status: string): string {
  return STATUS_LABELS[status] ?? status;
}

export function isLiveBucket(bucket: MatchBucket): boolean {
  return bucket === "live";
}

export function formatScore(match: Match): string {
  const home = match.home_score ?? 0;
  const away = match.away_score ?? 0;
  const base = `${home} – ${away}`;

  if (match.pen_home_score !== null && match.pen_away_score !== null) {
    return `${base} (${match.pen_home_score}–${match.pen_away_score} pens)`;
  }

  return base;
}

/** Regulation/AET score only (no shootout suffix). */
export function formatRegulationScore(match: Match): string {
  const home = match.home_score ?? 0;
  const away = match.away_score ?? 0;
  return `${home} – ${away}`;
}

export function formatPenaltyShootoutScore(match: Match): string | null {
  if (match.pen_home_score === null || match.pen_away_score === null) {
    return null;
  }
  return `${match.pen_home_score}–${match.pen_away_score} pens`;
}

export function matchEndedInPenalties(match: Match): boolean {
  return (
    isMatchDecidedByPenalties(match.status) ||
    (match.pen_home_score !== null && match.pen_away_score !== null)
  );
}

/** Leading side for live/finished display (includes in-progress shootouts). */
export function getMatchLeaderSide(
  match: Pick<
    Match,
    "home_score" | "away_score" | "pen_home_score" | "pen_away_score"
  >
): "home" | "away" | null {
  if (match.home_score === null || match.away_score === null) return null;
  if (match.home_score !== match.away_score) {
    return match.home_score > match.away_score ? "home" : "away";
  }
  if (match.pen_home_score !== null && match.pen_away_score !== null) {
    if (match.pen_home_score > match.pen_away_score) return "home";
    if (match.pen_away_score > match.pen_home_score) return "away";
  }
  return null;
}

export function getPSTDateKey(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Los_Angeles",
  }).format(new Date(iso));
}

export function formatPSTDateHeader(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(new Date(iso));
}

export function formatPSTTime(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(iso));
}
