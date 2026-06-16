import { isMatchFinished } from "@/lib/scoring";
import type { Match, PickWinner } from "@/lib/types";
import type { SupabaseClient } from "@supabase/supabase-js";

/** PostgREST default max rows per request. */
const PICKS_PAGE_SIZE = 1000;

export type MatchPickDetails = {
  correctWinner: string[];
  correctScore: string[];
};

export type MatchPickInput = {
  picked_winner: PickWinner;
  home_score_pred: number | null;
  away_score_pred: number | null;
  displayName: string;
};

function actualWinner(homeScore: number, awayScore: number): PickWinner {
  if (homeScore > awayScore) return "home";
  if (awayScore > homeScore) return "away";
  return "draw";
}

export function getMatchPickDetails(
  match: Match,
  picks: MatchPickInput[]
): MatchPickDetails {
  if (
    !isMatchFinished(match.status) ||
    match.home_score === null ||
    match.away_score === null
  ) {
    return { correctWinner: [], correctScore: [] };
  }

  const home = match.home_score;
  const away = match.away_score;
  const winner = actualWinner(home, away);

  const correctWinner = picks
    .filter((pick) => pick.picked_winner === winner)
    .map((pick) => pick.displayName)
    .sort((a, b) => a.localeCompare(b));

  const correctScore =
    match.stage === "group"
      ? picks
          .filter(
            (pick) =>
              pick.home_score_pred === home && pick.away_score_pred === away
          )
          .map((pick) => pick.displayName)
          .sort((a, b) => a.localeCompare(b))
      : [];

  return { correctWinner, correctScore };
}

export function formatPickerList(names: string[]): string {
  return names.length > 0 ? names.join(", ") : "N/A";
}

type PickWithProfileRow = {
  match_id: number;
  picked_winner: PickWinner;
  home_score_pred: number | null;
  away_score_pred: number | null;
  profiles:
    | { display_name: string; username: string }
    | { display_name: string; username: string }[];
};

/** Paginate picks+profiles so we don't miss rows past the 1000-row cap. */
export async function fetchAllPicksWithProfiles(
  supabase: SupabaseClient
): Promise<PickWithProfileRow[]> {
  const all: PickWithProfileRow[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from("picks")
      .select(
        "match_id, picked_winner, home_score_pred, away_score_pred, profiles!inner(display_name, username)"
      )
      .order("match_id", { ascending: true })
      .order("user_id", { ascending: true })
      .range(from, from + PICKS_PAGE_SIZE - 1);

    if (error) throw error;
    if (!data?.length) break;

    all.push(...(data as PickWithProfileRow[]));
    if (data.length < PICKS_PAGE_SIZE) break;
    from += PICKS_PAGE_SIZE;
  }

  return all;
}

function profileFromRow(
  profiles: PickWithProfileRow["profiles"]
): { display_name: string; username: string } {
  return Array.isArray(profiles) ? profiles[0] : profiles;
}

export function buildPickDetailsByMatchId(
  matches: Match[],
  picks: PickWithProfileRow[]
): Record<number, MatchPickDetails> {
  const picksByMatch = new Map<number, MatchPickInput[]>();

  for (const pick of picks) {
    const profile = profileFromRow(pick.profiles);
    const list = picksByMatch.get(pick.match_id) ?? [];
    list.push({
      picked_winner: pick.picked_winner,
      home_score_pred: pick.home_score_pred,
      away_score_pred: pick.away_score_pred,
      displayName: profile.display_name || profile.username,
    });
    picksByMatch.set(pick.match_id, list);
  }

  const details: Record<number, MatchPickDetails> = {};
  for (const match of matches) {
    if (!isMatchFinished(match.status)) continue;
    details[match.id] = getMatchPickDetails(
      match,
      picksByMatch.get(match.id) ?? []
    );
  }

  return details;
}
