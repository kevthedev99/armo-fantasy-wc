import {
  getActualWinnerSide,
  isExactScorePick,
  isMatchDecidedByPenalties,
  isMatchFinished,
  pickPredictsPenalties,
} from "@/lib/scoring";
import type { Match, PickWinner } from "@/lib/types";
import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchAllPages } from "@/lib/supabase/paginate";

export type MatchPickDetails = {
  correctWinner: string[];
  correctScore: string[];
  correctPenaltiesPick: string[];
};

export type MatchPickInput = {
  picked_winner: PickWinner;
  home_score_pred: number | null;
  away_score_pred: number | null;
  predicts_penalties?: boolean;
  winning_goal_minute_pred?: number | null;
  displayName: string;
};

function isExactScoreForDetails(
  match: Match,
  pick: MatchPickInput
): boolean {
  return isExactScorePick(match, {
    home_score_pred: pick.home_score_pred,
    away_score_pred: pick.away_score_pred,
    predicts_penalties: pickPredictsPenalties(pick),
  });
}

function matchResolvedViaPenalties(match: Match): boolean {
  return (
    isMatchDecidedByPenalties(match.status) ||
    (match.pen_home_score !== null && match.pen_away_score !== null)
  );
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
    return { correctWinner: [], correctScore: [], correctPenaltiesPick: [] };
  }

  const winner = getActualWinnerSide(match);
  if (!winner) {
    return { correctWinner: [], correctScore: [], correctPenaltiesPick: [] };
  }

  const correctWinner = picks
    .filter((pick) => pick.picked_winner === winner)
    .map((pick) => pick.displayName)
    .sort((a, b) => a.localeCompare(b));

  const correctScore = picks
    .filter((pick) => isExactScoreForDetails(match, pick))
    .map((pick) => pick.displayName)
    .sort((a, b) => a.localeCompare(b));

  const correctPenaltiesPick = matchResolvedViaPenalties(match)
    ? picks
        .filter(
          (pick) =>
            pickPredictsPenalties(pick) && pick.picked_winner === winner
        )
        .map((pick) => pick.displayName)
        .sort((a, b) => a.localeCompare(b))
    : [];

  return { correctWinner, correctScore, correctPenaltiesPick };
}

export function formatPickerList(names: string[]): string {
  return names.length > 0 ? names.join(", ") : "N/A";
}

type PickWithProfileRow = {
  match_id: number;
  picked_winner: PickWinner;
  home_score_pred: number | null;
  away_score_pred: number | null;
  predicts_penalties?: boolean;
  winning_goal_minute_pred?: number | null;
  profiles:
    | { display_name: string; username: string }
    | { display_name: string; username: string }[];
};

/** Paginate picks+profiles so we don't miss rows past the 1000-row cap. */
export async function fetchAllPicksWithProfiles(
  supabase: SupabaseClient
): Promise<PickWithProfileRow[]> {
  return fetchAllPages<PickWithProfileRow>((from, to) =>
    supabase
      .from("picks")
      .select(
        "match_id, picked_winner, home_score_pred, away_score_pred, predicts_penalties, winning_goal_minute_pred, profiles!inner(display_name, username)"
      )
      .order("match_id", { ascending: true })
      .order("user_id", { ascending: true })
      .range(from, to)
  );
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
      predicts_penalties: pick.predicts_penalties,
      winning_goal_minute_pred: pick.winning_goal_minute_pred,
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
