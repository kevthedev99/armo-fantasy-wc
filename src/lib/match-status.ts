import { isMatchFinished, isMatchInProgress, isMatchLocked } from "@/lib/scoring";
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
  return `${home} – ${away}`;
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
    timeZoneName: "short",
  }).format(new Date(iso));
}
