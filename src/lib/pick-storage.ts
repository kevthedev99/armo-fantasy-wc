import type { SupabaseClient } from "@supabase/supabase-js";

/** Stored when `predicts_penalties` column is not migrated yet. */
export const PENALTIES_PICK_SENTINEL = 9999;

export function pickPredictsPenalties(pick: {
  predicts_penalties?: boolean;
  winning_goal_minute_pred?: number | null;
}): boolean {
  return (
    !!pick.predicts_penalties ||
    pick.winning_goal_minute_pred === PENALTIES_PICK_SENTINEL
  );
}

function isPredictsPenaltiesColumnError(message: string): boolean {
  return message.toLowerCase().includes("predicts_penalties");
}

type PickRow = {
  user_id: string;
  match_id: number;
  picked_winner: string;
  home_score_pred: number | null;
  away_score_pred: number | null;
  winning_goal_minute_pred: number | null;
  updated_at: string;
  /** Knockout penalties picks only — omitted for group stage and regulation knockout. */
  predicts_penalties?: boolean;
};

function toLegacyPickRow(row: PickRow): Omit<PickRow, "predicts_penalties"> {
  const { predicts_penalties, ...rest } = row;
  if (!predicts_penalties) {
    return {
      ...rest,
      winning_goal_minute_pred: null,
    };
  }
  return {
    ...rest,
    winning_goal_minute_pred: PENALTIES_PICK_SENTINEL,
  };
}

/** Upsert a pick; falls back if Supabase has not run migration 012 yet. */
export async function upsertPickRow(
  supabase: SupabaseClient,
  existingId: string | undefined,
  pickRow: PickRow
) {
  if (existingId) {
    const result = await supabase
      .from("picks")
      .update(pickRow)
      .eq("id", existingId)
      .select()
      .single();

    if (!result.error) return result;

    if (isPredictsPenaltiesColumnError(result.error.message)) {
      return supabase
        .from("picks")
        .update(toLegacyPickRow(pickRow))
        .eq("id", existingId)
        .select()
        .single();
    }

    return result;
  }

  const result = await supabase.from("picks").insert(pickRow).select().single();

  if (!result.error) return result;

  if (isPredictsPenaltiesColumnError(result.error.message)) {
    return supabase
      .from("picks")
      .insert(toLegacyPickRow(pickRow))
      .select()
      .single();
  }

  return result;
}
