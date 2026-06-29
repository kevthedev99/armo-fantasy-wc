import { NextResponse } from "next/server";
import { isPickLocked } from "@/lib/knockout-bracket";
import { createClient } from "@/lib/supabase/server";
import { upsertPickRow } from "@/lib/pick-storage";
import {
  normalizeGroupScore,
  validateKnockoutPick,
  validatePickScores,
} from "@/lib/scoring";
import type { PickWinner } from "@/lib/types";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const body = await request.json();
  const {
    matchId,
    pickedWinner,
    homeScorePred,
    awayScorePred,
    predictsPenalties,
  } = body as {
    matchId?: number;
    pickedWinner?: PickWinner;
    homeScorePred?: number | null;
    awayScorePred?: number | null;
    predictsPenalties?: boolean;
  };

  if (!matchId || !pickedWinner) {
    return NextResponse.json({ error: "Missing pick data." }, { status: 400 });
  }

  const { data: match, error: matchError } = await supabase
    .from("matches")
    .select("*")
    .eq("id", matchId)
    .single();

  if (matchError || !match) {
    return NextResponse.json({ error: "Match not found." }, { status: 404 });
  }

  const { data: allMatches } = await supabase
    .from("matches")
    .select("stage, round, kickoff_at, status");

  if (isPickLocked(match, allMatches ?? [])) {
    return NextResponse.json(
      {
        error:
          "Picks are locked — this match has started. You cannot add or change a pick.",
      },
      { status: 403 }
    );
  }

  const predicts_penalties =
    match.stage === "knockout" && !!predictsPenalties;

  const resolvedHome = predicts_penalties
    ? null
    : normalizeGroupScore(homeScorePred);
  const resolvedAway = predicts_penalties
    ? null
    : normalizeGroupScore(awayScorePred);

  const scoreError =
    match.stage === "knockout"
      ? validateKnockoutPick(
          pickedWinner,
          resolvedHome ?? 0,
          resolvedAway ?? 0,
          predicts_penalties
        )
      : validatePickScores(
          pickedWinner,
          resolvedHome ?? 0,
          resolvedAway ?? 0
        );
  if (scoreError) {
    return NextResponse.json({ error: scoreError }, { status: 400 });
  }

  const pickRow: {
    user_id: string;
    match_id: number;
    picked_winner: PickWinner;
    home_score_pred: number | null;
    away_score_pred: number | null;
    winning_goal_minute_pred: null;
    updated_at: string;
    predicts_penalties?: boolean;
  } = {
    user_id: user.id,
    match_id: matchId,
    picked_winner: pickedWinner,
    home_score_pred: resolvedHome,
    away_score_pred: resolvedAway,
    winning_goal_minute_pred: null,
    updated_at: new Date().toISOString(),
  };

  if (predicts_penalties) {
    pickRow.predicts_penalties = true;
  }

  const { data: existing } = await supabase
    .from("picks")
    .select("id")
    .eq("user_id", user.id)
    .eq("match_id", matchId)
    .maybeSingle();

  let result;
  if (existing) {
    result = await upsertPickRow(supabase, existing.id, pickRow);
  } else {
    result = await upsertPickRow(supabase, undefined, pickRow);
  }

  if (result.error) {
    return NextResponse.json({ error: result.error.message }, { status: 500 });
  }

  return NextResponse.json({ pick: result.data });
}
