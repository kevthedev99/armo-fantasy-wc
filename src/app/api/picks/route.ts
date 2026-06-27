import { NextResponse } from "next/server";
import { isPickLocked } from "@/lib/knockout-bracket";
import { createClient } from "@/lib/supabase/server";
import {
  normalizeGroupScore,
  validateKnockoutPickScores,
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
  const { matchId, pickedWinner, homeScorePred, awayScorePred } = body as {
    matchId?: number;
    pickedWinner?: PickWinner;
    homeScorePred?: number | null;
    awayScorePred?: number | null;
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
    const knockoutMessage =
      match.stage === "knockout"
        ? "Knockout bracket is locked — Round of 32 has started. You cannot add or change knockout picks."
        : "Picks are locked — this match has started. You cannot add or change a pick.";

    return NextResponse.json({ error: knockoutMessage }, { status: 403 });
  }

  const resolvedHome = normalizeGroupScore(homeScorePred);
  const resolvedAway = normalizeGroupScore(awayScorePred);

  const scoreError =
    match.stage === "knockout"
      ? validateKnockoutPickScores(pickedWinner, resolvedHome, resolvedAway)
      : validatePickScores(pickedWinner, resolvedHome, resolvedAway);
  if (scoreError) {
    return NextResponse.json({ error: scoreError }, { status: 400 });
  }

  const pickRow = {
    user_id: user.id,
    match_id: matchId,
    picked_winner: pickedWinner,
    home_score_pred: resolvedHome,
    away_score_pred: resolvedAway,
    winning_goal_minute_pred: null,
    updated_at: new Date().toISOString(),
  };

  const { data: existing } = await supabase
    .from("picks")
    .select("id")
    .eq("user_id", user.id)
    .eq("match_id", matchId)
    .maybeSingle();

  let result;
  if (existing) {
    result = await supabase
      .from("picks")
      .update(pickRow)
      .eq("id", existing.id)
      .select()
      .single();
  } else {
    result = await supabase.from("picks").insert(pickRow).select().single();
  }

  if (result.error) {
    return NextResponse.json({ error: result.error.message }, { status: 500 });
  }

  return NextResponse.json({ pick: result.data });
}
