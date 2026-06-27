import type { BracketSlotPick, BracketSlotRoundId, PickWinner } from "@/lib/types";
import type { SupabaseClient } from "@supabase/supabase-js";

const VALID_ROUNDS = new Set<BracketSlotRoundId>([
  "r16",
  "qf",
  "sf",
  "final",
  "third",
]);

type BracketSlotPickRow = {
  id: string;
  user_id: string;
  round_id: BracketSlotRoundId;
  slot_index: number;
  home_team_id: number;
  away_team_id: number;
  picked_winner: PickWinner;
  home_score_pred: number | null;
  away_score_pred: number | null;
  predicts_penalties: boolean;
  created_at?: string;
  updated_at?: string;
};

export function isBracketSlotPicksTableError(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes("bracket_slot_picks") &&
    (lower.includes("schema cache") ||
      lower.includes("does not exist") ||
      lower.includes("could not find"))
  );
}

export function rowToBracketSlotPick(row: BracketSlotPickRow): BracketSlotPick {
  return {
    id: row.id,
    user_id: row.user_id,
    round_id: row.round_id,
    slot_index: row.slot_index,
    home_team_id: row.home_team_id,
    away_team_id: row.away_team_id,
    picked_winner: row.picked_winner,
    home_score_pred: row.home_score_pred,
    away_score_pred: row.away_score_pred,
    predicts_penalties: row.predicts_penalties,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export async function fetchBracketSlotPicksForUser(
  supabase: SupabaseClient,
  userId: string
): Promise<{ picks: BracketSlotPick[]; tableMissing: boolean }> {
  const { data, error } = await supabase
    .from("bracket_slot_picks")
    .select("*")
    .eq("user_id", userId)
    .order("round_id")
    .order("slot_index");

  if (error) {
    if (isBracketSlotPicksTableError(error.message)) {
      return { picks: [], tableMissing: true };
    }
    throw error;
  }

  return {
    picks: (data ?? []).map((row) =>
      rowToBracketSlotPick(row as BracketSlotPickRow)
    ),
    tableMissing: false,
  };
}

export type UpsertBracketSlotPickInput = {
  round_id: BracketSlotRoundId;
  slot_index: number;
  home_team_id: number;
  away_team_id: number;
  picked_winner: PickWinner;
  home_score_pred: number | null;
  away_score_pred: number | null;
  predicts_penalties: boolean;
};

export function parseBracketSlotPickInput(
  body: unknown
): UpsertBracketSlotPickInput | null {
  if (!body || typeof body !== "object") return null;
  const value = body as Record<string, unknown>;
  const round_id = value.round_id;
  if (typeof round_id !== "string" || !VALID_ROUNDS.has(round_id as BracketSlotRoundId)) {
    return null;
  }

  const slot_index = Number(value.slot_index);
  if (!Number.isInteger(slot_index) || slot_index < 0) return null;

  const picked_winner = value.pickedWinner ?? value.picked_winner;
  if (picked_winner !== "home" && picked_winner !== "away" && picked_winner !== "draw") {
    return null;
  }

  const home_team_id = Number(value.home_team_id ?? value.homeTeamId);
  const away_team_id = Number(value.away_team_id ?? value.awayTeamId);
  if (!Number.isInteger(home_team_id) || !Number.isInteger(away_team_id)) {
    return null;
  }

  return {
    round_id: round_id as BracketSlotRoundId,
    slot_index,
    home_team_id,
    away_team_id,
    picked_winner,
    home_score_pred:
      value.homeScorePred === null || value.homeScorePred === undefined
        ? value.home_score_pred === null || value.home_score_pred === undefined
          ? null
          : Number(value.home_score_pred)
        : Number(value.homeScorePred),
    away_score_pred:
      value.awayScorePred === null || value.awayScorePred === undefined
        ? value.away_score_pred === null || value.away_score_pred === undefined
          ? null
          : Number(value.away_score_pred)
        : Number(value.awayScorePred),
    predicts_penalties: !!value.predictsPenalties || !!value.predicts_penalties,
  };
}

export async function upsertBracketSlotPickRow(
  supabase: SupabaseClient,
  userId: string,
  input: UpsertBracketSlotPickInput
) {
  const now = new Date().toISOString();
  return supabase
    .from("bracket_slot_picks")
    .upsert(
      {
        user_id: userId,
        round_id: input.round_id,
        slot_index: input.slot_index,
        home_team_id: input.home_team_id,
        away_team_id: input.away_team_id,
        picked_winner: input.picked_winner,
        home_score_pred: input.home_score_pred,
        away_score_pred: input.away_score_pred,
        predicts_penalties: input.predicts_penalties,
        updated_at: now,
      },
      { onConflict: "user_id,round_id,slot_index" }
    )
    .select()
    .single();
}

export async function deleteBracketSlotPickRow(
  supabase: SupabaseClient,
  userId: string,
  roundId: BracketSlotRoundId,
  slotIndex: number
) {
  return supabase
    .from("bracket_slot_picks")
    .delete()
    .eq("user_id", userId)
    .eq("round_id", roundId)
    .eq("slot_index", slotIndex);
}
