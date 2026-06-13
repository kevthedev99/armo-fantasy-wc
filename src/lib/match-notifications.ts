import {
  postDiscordFullTime,
  postDiscordGoal,
  postDiscordRedCard,
} from "@/lib/discord";
import { formatEventMinute } from "@/lib/match-events";
import { getStatusLabel } from "@/lib/match-status";
import { isMatchFinished, isMatchInProgress } from "@/lib/scoring";
import type { Match, MatchEvent } from "@/lib/types";

type ScoreSnapshot = {
  home_score: number | null;
  away_score: number | null;
  status: string;
  match_events?: MatchEvent[] | null;
};

function score(n: number | null | undefined): number {
  return n ?? 0;
}

export function shouldNotifyFullTime(
  oldMatch: ScoreSnapshot | null,
  newStatus: string
): boolean {
  if (!isMatchFinished(newStatus)) return false;
  if (!oldMatch) return false;
  return !isMatchFinished(oldMatch.status);
}

export async function notifyMatchEvents(params: {
  oldMatch: ScoreSnapshot | null;
  homeTeam: string;
  awayTeam: string;
  homeScore: number | null;
  awayScore: number | null;
  status: string;
  groupOrRound?: string | null;
  newEvents: MatchEvent[];
  bootstrap: boolean;
}): Promise<number> {
  const {
    oldMatch,
    homeTeam,
    awayTeam,
    homeScore,
    awayScore,
    status,
    newEvents,
    bootstrap,
  } = params;

  if (!oldMatch || bootstrap) return 0;
  if (!isMatchInProgress(status) && !isMatchFinished(status)) return 0;
  if (isMatchFinished(oldMatch.status) && isMatchFinished(status)) return 0;

  const statusLabel = getStatusLabel(status);
  let sent = 0;

  for (const event of newEvents) {
    if (event.type === "goal") {
      const minute = formatEventMinute(event);
      const ownGoal = event.detail.toLowerCase().includes("own");
      const ok = await postDiscordGoal({
        scorerName: event.playerName,
        minute,
        ownGoal,
        homeTeam,
        awayTeam,
        homeScore: score(homeScore),
        awayScore: score(awayScore),
        statusLabel,
        groupOrRound: params.groupOrRound,
      });
      if (ok) sent++;
    }

    if (event.type === "red_card") {
      const ok = await postDiscordRedCard({
        playerName: event.playerName,
        teamName: event.side === "home" ? homeTeam : awayTeam,
        minute: formatEventMinute(event),
        homeTeam,
        awayTeam,
        homeScore: score(homeScore),
        awayScore: score(awayScore),
        statusLabel,
        groupOrRound: params.groupOrRound,
      });
      if (ok) sent++;
    }
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
