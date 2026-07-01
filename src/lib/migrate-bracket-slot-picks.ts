import {
  deleteBracketSlotPickRow,
  isBracketSlotPicksTableError,
  rowToBracketSlotPick,
} from "@/lib/bracket-slot-pick-db";
import { groupKnockoutMatches } from "@/lib/knockout-bracket-layout";
import { resolveSlotPickForSyncedMatch } from "@/lib/bracket-slot-picks";
import { isPickLocked } from "@/lib/knockout-bracket";
import { upsertPickRow } from "@/lib/pick-storage";
import type { BracketSlotPick, Match } from "@/lib/types";
import { fetchAllTableRows } from "@/lib/supabase/paginate";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Later-round slot picks lock once that fixture is synced and has kicked off. */
export function isBracketSlotPickLocked(
  slotPick: Pick<BracketSlotPick, "round_id" | "slot_index">,
  matches: Match[]
): boolean {
  const match = getSyncedMatchForSlotPick(
    matches,
    slotPick as BracketSlotPick
  );
  if (!match) return false;
  return isPickLocked(match, matches);
}

export function getSyncedMatchForSlotPick(
  matches: Match[],
  slotPick: BracketSlotPick
): Match | undefined {
  const grouped = groupKnockoutMatches(matches);
  return grouped.get(slotPick.round_id)?.[slotPick.slot_index];
}

export function slotPickToPickPayload(
  slotPick: BracketSlotPick,
  match: Match
) {
  const mapped = resolveSlotPickForSyncedMatch(slotPick, match);
  if (!mapped) return null;

  return {
    matchId: match.id,
    pickedWinner: mapped.picked_winner,
    homeScorePred: mapped.home_score_pred,
    awayScorePred: mapped.away_score_pred,
    predictsPenalties: mapped.predicts_penalties,
  };
}

/** Move bracket slot picks onto real synced fixtures (server/cron). */
export async function migrateSyncedBracketSlotPicks(
  supabase: SupabaseClient,
  matches: Match[]
): Promise<{ migrated: number }> {
  let rows: unknown[];
  try {
    rows = await fetchAllTableRows(
      supabase,
      "bracket_slot_picks",
      "*",
      "user_id"
    );
  } catch (error) {
    const message =
      error && typeof error === "object" && "message" in error
        ? String((error as { message: string }).message)
        : String(error);
    if (isBracketSlotPicksTableError(message)) {
      return { migrated: 0 };
    }
    throw error;
  }

  let migrated = 0;

  for (const row of rows) {
    const slotPick = rowToBracketSlotPick(
      row as Parameters<typeof rowToBracketSlotPick>[0]
    );
    const match = getSyncedMatchForSlotPick(matches, slotPick);
    if (!match) continue;

    const mapped = resolveSlotPickForSyncedMatch(slotPick, match);
    if (!mapped) continue;
    const { data: existing } = await supabase
      .from("picks")
      .select("id")
      .eq("user_id", slotPick.user_id)
      .eq("match_id", match.id)
      .maybeSingle();

    const pickRow = {
      user_id: slotPick.user_id,
      match_id: match.id,
      picked_winner: mapped.picked_winner,
      home_score_pred: mapped.home_score_pred,
      away_score_pred: mapped.away_score_pred,
      predicts_penalties: mapped.predicts_penalties,
      winning_goal_minute_pred: null as number | null,
      updated_at: new Date().toISOString(),
    };

    const result = await upsertPickRow(supabase, existing?.id, pickRow);
    if (result.error) {
      console.error(
        `Failed to migrate bracket slot pick ${slotPick.round_id}:${slotPick.slot_index}:`,
        result.error
      );
      continue;
    }

    const { error: deleteError } = await deleteBracketSlotPickRow(
      supabase,
      slotPick.user_id,
      slotPick.round_id,
      slotPick.slot_index
    );

    if (deleteError) {
      console.error(
        `Failed to remove migrated bracket slot pick ${slotPick.round_id}:${slotPick.slot_index}:`,
        deleteError
      );
      continue;
    }

    migrated++;
  }

  return { migrated };
}
