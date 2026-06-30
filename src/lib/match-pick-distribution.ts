import { fetchAllPages } from "@/lib/supabase/paginate";
import type { Match, PickWinner } from "@/lib/types";
import type { SupabaseClient } from "@supabase/supabase-js";

export type DistributionEntry = {
  label: string;
  count: number;
  pct: number;
};

export type MatchPickDistribution = {
  matchId: number;
  homeTeam: string;
  awayTeam: string;
  kickoff: string;
  status: string;
  stage: string;
  round: string;
  actualScore: string | null;
  totalPickers: number;
  mostPickedScoreLine: DistributionEntry | null;
  winnerBreakdown: Array<{
    winner: string;
    side: PickWinner;
    count: number;
    pct: number;
  }>;
  topScoreLines: DistributionEntry[];
};

type RawPick = {
  picked_winner: PickWinner;
  home_score_pred: number | null;
  away_score_pred: number | null;
  predicts_penalties: boolean;
};

function winnerLabel(
  side: PickWinner,
  homeTeam: string,
  awayTeam: string
): string {
  if (side === "home") return `${homeTeam} win`;
  if (side === "away") return `${awayTeam} win`;
  return "Draw";
}

function scoreKey(
  pick: RawPick,
  homeTeam: string,
  awayTeam: string
): string {
  if (pick.predicts_penalties) {
    return `${winnerLabel(pick.picked_winner, homeTeam, awayTeam)} (penalties)`;
  }
  if (pick.home_score_pred != null && pick.away_score_pred != null) {
    return `${pick.home_score_pred}-${pick.away_score_pred}`;
  }
  return winnerLabel(pick.picked_winner, homeTeam, awayTeam);
}

function toPct(count: number, total: number): number {
  if (!total) return 0;
  return Math.round((count / total) * 1000) / 10;
}

function topEntries(map: Map<string, number>, total: number, limit: number) {
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([label, count]) => ({
      label,
      count,
      pct: toPct(count, total),
    }));
}

export function aggregateMatchPickDistribution(
  match: Match,
  picks: RawPick[]
): MatchPickDistribution {
  const total = picks.length;
  const homeTeam = match.home_team_name;
  const awayTeam = match.away_team_name;

  const winnerCounts = new Map<PickWinner, number>();
  const scoreCounts = new Map<string, number>();

  for (const pick of picks) {
    winnerCounts.set(
      pick.picked_winner,
      (winnerCounts.get(pick.picked_winner) ?? 0) + 1
    );
    const key = scoreKey(pick, homeTeam, awayTeam);
    scoreCounts.set(key, (scoreCounts.get(key) ?? 0) + 1);
  }

  const actualScore =
    match.home_score != null && match.away_score != null
      ? `${match.home_score}-${match.away_score}`
      : null;

  const topScoreLines = topEntries(scoreCounts, total, 10);

  return {
    matchId: match.id,
    homeTeam,
    awayTeam,
    kickoff: match.kickoff_at,
    status: match.status,
    stage: match.stage,
    round: match.round,
    actualScore,
    totalPickers: total,
    mostPickedScoreLine: topScoreLines[0] ?? null,
    winnerBreakdown: [...winnerCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([side, count]) => ({
        side,
        winner: winnerLabel(side, homeTeam, awayTeam),
        count,
        pct: toPct(count, total),
      })),
    topScoreLines,
  };
}

export async function fetchMatchPickDistribution(
  supabase: SupabaseClient,
  matchId: number
): Promise<MatchPickDistribution | null> {
  const { data: match, error: matchError } = await supabase
    .from("matches")
    .select("*")
    .eq("id", matchId)
    .single();

  if (matchError || !match) return null;

  const picks = await fetchAllPages<RawPick>((from, to) =>
    supabase
      .from("picks")
      .select(
        "picked_winner, home_score_pred, away_score_pred, predicts_penalties"
      )
      .eq("match_id", matchId)
      .order("user_id", { ascending: true })
      .range(from, to)
  );

  return aggregateMatchPickDistribution(match as Match, picks);
}

type RawPickWithMatchId = RawPick & { match_id: number };

export async function fetchAllMatchPickDistributions(
  supabase: SupabaseClient
): Promise<MatchPickDistribution[]> {
  const matches = await fetchAllPages<Match>((from, to) =>
    supabase
      .from("matches")
      .select("*")
      .order("kickoff_at", { ascending: true })
      .range(from, to)
  );

  const picks = await fetchAllPages<RawPickWithMatchId>((from, to) =>
    supabase
      .from("picks")
      .select(
        "match_id, picked_winner, home_score_pred, away_score_pred, predicts_penalties"
      )
      .order("match_id", { ascending: true })
      .order("user_id", { ascending: true })
      .range(from, to)
  );

  const picksByMatch = new Map<number, RawPick[]>();
  for (const pick of picks) {
    const { match_id, ...rest } = pick;
    const list = picksByMatch.get(match_id) ?? [];
    list.push(rest);
    picksByMatch.set(match_id, list);
  }

  return matches.map((match) =>
    aggregateMatchPickDistribution(match, picksByMatch.get(match.id) ?? [])
  );
}
