import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  isMatchLocked,
  normalizeGroupScore,
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

  if (match.stage === "knockout") {
    const { data: settings } = await supabase
      .from("app_settings")
      .select("knockout_unlocked")
      .eq("id", 1)
      .single();

    if (!settings?.knockout_unlocked) {
      return NextResponse.json(
        { error: "Knockout picks unlock after the group stage ends." },
        { status: 403 }
      );
    }
  }

  if (isMatchLocked(match)) {
    return NextResponse.json(
      { error: "Picks are locked — this match has already started or finished." },
      { status: 403 }
    );
  }

  let resolvedHome = homeScorePred;
  let resolvedAway = awayScorePred;

  if (match.stage === "group") {
    resolvedHome = normalizeGroupScore(homeScorePred);
    resolvedAway = normalizeGroupScore(awayScorePred);

    const scoreError = validatePickScores(
      pickedWinner,
      resolvedHome,
      resolvedAway
    );
    if (scoreError) {
      return NextResponse.json({ error: scoreError }, { status: 400 });
    }
  }

  const pickRow = {
    user_id: user.id,
    match_id: matchId,
    picked_winner: pickedWinner,
    home_score_pred: match.stage === "group" ? resolvedHome : null,
    away_score_pred: match.stage === "group" ? resolvedAway : null,
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
