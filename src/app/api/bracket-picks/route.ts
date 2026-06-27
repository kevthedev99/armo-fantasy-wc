import { NextResponse } from "next/server";
import {
  areRo32FeedersSynced,
  getColumnById,
  mapSlotPickToMatch,
} from "@/lib/bracket-slot-picks";
import { isKnockoutBracketLocked } from "@/lib/knockout-bracket";
import { groupKnockoutMatches } from "@/lib/knockout-bracket-layout";
import { getRo32MatchesBySlot } from "@/lib/migrate-bracket-slot-picks";
import { createClient } from "@/lib/supabase/server";
import { upsertPickRow } from "@/lib/pick-storage";
import {
  normalizeGroupScore,
  validateKnockoutPick,
} from "@/lib/scoring";
import type { BracketSlotRoundId, PickWinner } from "@/lib/types";

const ALLOWED_ROUNDS = new Set<BracketSlotRoundId>([
  "r16",
  "qf",
  "sf",
  "final",
  "third",
]);

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
    roundId,
    slotIndex,
    homeTeamId,
    awayTeamId,
    pickedWinner,
    homeScorePred,
    awayScorePred,
    predictsPenalties,
  } = body as {
    roundId?: BracketSlotRoundId;
    slotIndex?: number;
    homeTeamId?: number;
    awayTeamId?: number;
    pickedWinner?: PickWinner;
    homeScorePred?: number | null;
    awayScorePred?: number | null;
    predictsPenalties?: boolean;
  };

  if (
    !roundId ||
    !ALLOWED_ROUNDS.has(roundId) ||
    slotIndex == null ||
    slotIndex < 0 ||
    !homeTeamId ||
    !awayTeamId ||
    !pickedWinner
  ) {
    return NextResponse.json({ error: "Missing bracket pick data." }, { status: 400 });
  }

  const column = getColumnById(roundId);
  if (!column || slotIndex >= column.expectedSlots) {
    return NextResponse.json({ error: "Invalid bracket slot." }, { status: 400 });
  }

  const { data: allMatches } = await supabase.from("matches").select("*");
  const matches = allMatches ?? [];

  if (isKnockoutBracketLocked(matches)) {
    return NextResponse.json(
      {
        error:
          "Knockout bracket is locked — Round of 32 has started. You cannot add or change knockout picks.",
      },
      { status: 403 }
    );
  }

  const ro32MatchesBySlot = getRo32MatchesBySlot(matches);
  if (!areRo32FeedersSynced(roundId, slotIndex, ro32MatchesBySlot)) {
    return NextResponse.json(
      {
        error:
          "This slot is not ready yet — wait for the Round of 32 fixtures on this side of the bracket to sync.",
      },
      { status: 403 }
    );
  }

  const grouped = groupKnockoutMatches(matches);
  const syncedMatch = grouped.get(roundId)?.[slotIndex];
  const predicts_penalties = !!predictsPenalties;

  const resolvedHome = predicts_penalties
    ? null
    : normalizeGroupScore(homeScorePred);
  const resolvedAway = predicts_penalties
    ? null
    : normalizeGroupScore(awayScorePred);

  const scoreError = validateKnockoutPick(
    pickedWinner,
    resolvedHome ?? 0,
    resolvedAway ?? 0,
    predicts_penalties
  );
  if (scoreError) {
    return NextResponse.json({ error: scoreError }, { status: 400 });
  }

  if (syncedMatch) {
    const teamsMatch =
      (homeTeamId === syncedMatch.home_team_id &&
        awayTeamId === syncedMatch.away_team_id) ||
      (homeTeamId === syncedMatch.away_team_id &&
        awayTeamId === syncedMatch.home_team_id);

    if (!teamsMatch) {
      return NextResponse.json(
        { error: "Synced match teams do not match this bracket slot." },
        { status: 400 }
      );
    }

    const mapped = mapSlotPickToMatch(
      {
        home_team_id: homeTeamId,
        away_team_id: awayTeamId,
        picked_winner: pickedWinner,
        home_score_pred: resolvedHome,
        away_score_pred: resolvedAway,
        predicts_penalties,
      },
      syncedMatch
    );

    const pickRow: {
      user_id: string;
      match_id: number;
      picked_winner: string;
      home_score_pred: number | null;
      away_score_pred: number | null;
      winning_goal_minute_pred: null;
      updated_at: string;
      predicts_penalties?: boolean;
    } = {
      user_id: user.id,
      match_id: syncedMatch.id,
      picked_winner: mapped.picked_winner,
      home_score_pred: mapped.home_score_pred,
      away_score_pred: mapped.away_score_pred,
      winning_goal_minute_pred: null,
      updated_at: new Date().toISOString(),
    };

    if (mapped.predicts_penalties) {
      pickRow.predicts_penalties = true;
    }

    const { data: existing } = await supabase
      .from("picks")
      .select("id")
      .eq("user_id", user.id)
      .eq("match_id", syncedMatch.id)
      .maybeSingle();

    let pick;
    if (existing) {
      const result = await upsertPickRow(supabase, existing.id, pickRow);
      if (result.error) {
        return NextResponse.json({ error: result.error.message }, { status: 500 });
      }
      pick = result.data;
    } else {
      const result = await upsertPickRow(supabase, undefined, pickRow);
      if (result.error) {
        return NextResponse.json({ error: result.error.message }, { status: 500 });
      }
      pick = result.data;
    }

    await supabase
      .from("bracket_slot_picks")
      .delete()
      .eq("user_id", user.id)
      .eq("round_id", roundId)
      .eq("slot_index", slotIndex);

    return NextResponse.json({ kind: "match", pick });
  }

  const slotRow = {
    user_id: user.id,
    round_id: roundId,
    slot_index: slotIndex,
    home_team_id: homeTeamId,
    away_team_id: awayTeamId,
    picked_winner: pickedWinner,
    home_score_pred: resolvedHome,
    away_score_pred: resolvedAway,
    predicts_penalties,
    updated_at: new Date().toISOString(),
  };

  const { data: existingSlot } = await supabase
    .from("bracket_slot_picks")
    .select("id")
    .eq("user_id", user.id)
    .eq("round_id", roundId)
    .eq("slot_index", slotIndex)
    .maybeSingle();

  let slotPick;
  if (existingSlot) {
    const { data, error } = await supabase
      .from("bracket_slot_picks")
      .update(slotRow)
      .eq("id", existingSlot.id)
      .select()
      .single();
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    slotPick = data;
  } else {
    const { data, error } = await supabase
      .from("bracket_slot_picks")
      .insert(slotRow)
      .select()
      .single();
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    slotPick = data;
  }

  return NextResponse.json({ kind: "slot", slotPick });
}
