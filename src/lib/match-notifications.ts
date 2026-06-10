import {
  postDiscordFullTime,
  postDiscordGoal,
} from "@/lib/discord";
import { getStatusLabel } from "@/lib/match-status";
import { isMatchFinished, isMatchInProgress } from "@/lib/scoring";
import type { Match } from "@/lib/types";

type ScoreSnapshot = {
  home_score: number | null;
  away_score: number | null;
  status: string;
};

function score(n: number | null | undefined): number {
  return n ?? 0;
}

/** Detect home/away goal events when the score increases. */
export function detectGoalEvents(
  oldMatch: ScoreSnapshot | null,
  newHome: number | null,
  newAway: number | null
): ("home" | "away")[] {
  if (!oldMatch) return [];

  const oldHome = score(oldMatch.home_score);
  const oldAway = score(oldMatch.away_score);
  const nextHome = score(newHome);
  const nextAway = score(newAway);

  const events: ("home" | "away")[] = [];
  for (let i = oldHome; i < nextHome; i++) events.push("home");
  for (let i = oldAway; i < nextAway; i++) events.push("away");
  return events;
}

export function shouldNotifyFullTime(
  oldMatch: ScoreSnapshot | null,
  newStatus: string
): boolean {
  if (!isMatchFinished(newStatus)) return false;
  if (!oldMatch) return false;
  return !isMatchFinished(oldMatch.status);
}

export async function notifyGoalEvents(params: {
  oldMatch: ScoreSnapshot | null;
  homeTeam: string;
  awayTeam: string;
  homeScore: number | null;
  awayScore: number | null;
  status: string;
  groupOrRound?: string | null;
}): Promise<number> {
  const { oldMatch, homeTeam, awayTeam, homeScore, awayScore, status } =
    params;

  if (!oldMatch) return 0;
  if (!isMatchInProgress(status) && !isMatchFinished(status)) return 0;
  if (isMatchFinished(oldMatch.status)) return 0;

  const events = detectGoalEvents(oldMatch, homeScore, awayScore);
  const statusLabel = getStatusLabel(status);
  let sent = 0;

  for (const team of events) {
    const ok = await postDiscordGoal({
      scorerName: team === "home" ? homeTeam : awayTeam,
      homeTeam,
      awayTeam,
      homeScore: score(homeScore),
      awayScore: score(awayScore),
      statusLabel,
      groupOrRound: params.groupOrRound,
    });
    if (ok) sent++;
  }

  return sent;
}

export async function notifyFullTime(
  match: Pick<
    Match,
    | "home_team_name"
    | "away_team_name"
    | "home_score"
    | "away_score"
    | "group_name"
    | "round"
  >
): Promise<boolean> {
  return postDiscordFullTime({
    homeTeam: match.home_team_name,
    awayTeam: match.away_team_name,
    homeScore: score(match.home_score),
    awayScore: score(match.away_score),
    groupOrRound: match.group_name ?? match.round,
  });
}
