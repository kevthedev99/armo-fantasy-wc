import {
  postDiscordKickoff,
  postDiscordFullTime,
  postDiscordGoal,
  postDiscordPenaltyGoal,
  postDiscordRedCard,
} from "@/lib/discord";
import { formatEventMinute } from "@/lib/match-events";
import { getStatusLabel } from "@/lib/match-status";
import { isMatchFinished, isMatchInProgress } from "@/lib/scoring";
import type { Match, MatchEvent } from "@/lib/types";

type ScoreSnapshot = {
  home_score: number | null;
  away_score: number | null;
  pen_home_score?: number | null;
  pen_away_score?: number | null;
  status: string;
  match_events?: MatchEvent[] | null;
};

function score(n: number | null | undefined): number {
  return n ?? 0;
}

function inPenaltyShootout(status: string): boolean {
  return status === "P" || status === "PEN";
}

export function shouldNotifyFullTime(
  oldMatch: ScoreSnapshot | null,
  newStatus: string
): boolean {
  if (!isMatchFinished(newStatus)) return false;
  if (!oldMatch) return false;
  return !isMatchFinished(oldMatch.status);
}

export function shouldNotifyKickoff(
  oldMatch: ScoreSnapshot | null,
  newStatus: string
): boolean {
  if (!isMatchInProgress(newStatus)) return false;
  if (!oldMatch) return false;
  return (
    !isMatchInProgress(oldMatch.status) && !isMatchFinished(oldMatch.status)
  );
}

export async function notifyMatchEvents(params: {
  oldMatch: ScoreSnapshot | null;
  homeTeam: string;
  awayTeam: string;
  homeScore: number | null;
  awayScore: number | null;
  penHomeScore?: number | null;
  penAwayScore?: number | null;
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
    penHomeScore,
    penAwayScore,
    status,
    newEvents,
    bootstrap,
  } = params;

  if (bootstrap) return 0;
  if (
    !oldMatch &&
    !isMatchInProgress(status) &&
    !isMatchFinished(status)
  ) {
    return 0;
  }
  if (!isMatchInProgress(status) && !isMatchFinished(status)) return 0;
  if (
    oldMatch &&
    isMatchFinished(oldMatch.status) &&
    isMatchFinished(status)
  ) {
    return 0;
  }

  const statusLabel = getStatusLabel(status);
  const penHome = score(penHomeScore);
  const penAway = score(penAwayScore);
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

    if (event.type === "penalty_goal") {
      const ok = await postDiscordPenaltyGoal({
        scorerName: event.playerName,
        minute: formatEventMinute(event),
        homeTeam,
        awayTeam,
        homeScore: score(homeScore),
        awayScore: score(awayScore),
        penHomeScore: penHome,
        penAwayScore: penAway,
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

  if (inPenaltyShootout(status) && oldMatch) {
    sent += await notifyPenaltyShootoutScoreDelta({
      oldMatch,
      homeTeam,
      awayTeam,
      homeScore,
      awayScore,
      penHomeScore: penHome,
      penAwayScore: penAway,
      statusLabel,
      groupOrRound: params.groupOrRound,
      newEvents,
    });
  }

  return sent;
}

async function notifyPenaltyShootoutScoreDelta(params: {
  oldMatch: ScoreSnapshot;
  homeTeam: string;
  awayTeam: string;
  homeScore: number | null;
  awayScore: number | null;
  penHomeScore: number;
  penAwayScore: number;
  statusLabel: string;
  groupOrRound?: string | null;
  newEvents: MatchEvent[];
}): Promise<number> {
  const oldPenHome = params.oldMatch.pen_home_score ?? 0;
  const oldPenAway = params.oldMatch.pen_away_score ?? 0;
  const homeDelta = params.penHomeScore - oldPenHome;
  const awayDelta = params.penAwayScore - oldPenAway;

  if (homeDelta <= 0 && awayDelta <= 0) return 0;

  const eventHomeGoals = params.newEvents.filter(
    (event) => event.type === "penalty_goal" && event.side === "home"
  ).length;
  const eventAwayGoals = params.newEvents.filter(
    (event) => event.type === "penalty_goal" && event.side === "away"
  ).length;

  let sent = 0;

  for (let i = eventHomeGoals; i < homeDelta; i++) {
    const ok = await postDiscordPenaltyGoal({
      scorerName: params.homeTeam,
      homeTeam: params.homeTeam,
      awayTeam: params.awayTeam,
      homeScore: score(params.homeScore),
      awayScore: score(params.awayScore),
      penHomeScore: params.penHomeScore,
      penAwayScore: params.penAwayScore,
      statusLabel: params.statusLabel,
      groupOrRound: params.groupOrRound,
    });
    if (ok) sent++;
  }

  for (let i = eventAwayGoals; i < awayDelta; i++) {
    const ok = await postDiscordPenaltyGoal({
      scorerName: params.awayTeam,
      homeTeam: params.homeTeam,
      awayTeam: params.awayTeam,
      homeScore: score(params.homeScore),
      awayScore: score(params.awayScore),
      penHomeScore: params.penHomeScore,
      penAwayScore: params.penAwayScore,
      statusLabel: params.statusLabel,
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
    | "pen_home_score"
    | "pen_away_score"
    | "group_name"
    | "round"
  >
): Promise<boolean> {
  return postDiscordFullTime({
    homeTeam: match.home_team_name,
    awayTeam: match.away_team_name,
    homeScore: score(match.home_score),
    awayScore: score(match.away_score),
    penHomeScore: match.pen_home_score,
    penAwayScore: match.pen_away_score,
    groupOrRound: match.group_name ?? match.round,
  });
}

export async function notifyKickoff(
  match: Pick<Match, "home_team_name" | "away_team_name" | "group_name" | "round">,
  status: string
): Promise<boolean> {
  return postDiscordKickoff({
    homeTeam: match.home_team_name,
    awayTeam: match.away_team_name,
    statusLabel: getStatusLabel(status),
    groupOrRound: match.group_name ?? match.round,
  });
}
