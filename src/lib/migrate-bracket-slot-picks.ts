import type { SupabaseClient } from "@supabase/supabase-js";
import {
  bracketSlotPickKey,
  mapSlotPickToMatch,
} from "@/lib/bracket-slot-picks";
import {
  groupKnockoutMatches,
  KNOCKOUT_ROUND_COLUMNS,
} from "@/lib/knockout-bracket-layout";
import type { BracketSlotPick, Match } from "@/lib/types";

/** Copy bracket slot picks onto synced matches when teams align. */
export async function migrateBracketSlotPicks(
  supabase: SupabaseClient,
  userId: string,
  matches: Match[]
): Promise<void> {
  const { data: slotPicks } = await supabase
    .from("bracket_slot_picks")
    .select("*")
    .eq("user_id", userId);

  if (!slotPicks?.length) return;

  const grouped = groupKnockoutMatches(matches);

  for (const slotPick of slotPicks as BracketSlotPick[]) {
    const roundMatches = grouped.get(slotPick.round_id) ?? [];
    const match = roundMatches[slotPick.slot_index];
    if (!match) continue;

    const teamsMatch =
      (slotPick.home_team_id === match.home_team_id &&
        slotPick.away_team_id === match.away_team_id) ||
      (slotPick.home_team_id === match.away_team_id &&
        slotPick.away_team_id === match.home_team_id);

    if (!teamsMatch) continue;

    const mapped = mapSlotPickToMatch(slotPick, match);
    const pickRow = {
      user_id: userId,
      match_id: match.id,
      picked_winner: mapped.picked_winner,
      home_score_pred: mapped.home_score_pred,
      away_score_pred: mapped.away_score_pred,
      predicts_penalties: mapped.predicts_penalties,
      winning_goal_minute_pred: null,
      updated_at: new Date().toISOString(),
    };

    const { data: existing } = await supabase
      .from("picks")
      .select("id")
      .eq("user_id", userId)
      .eq("match_id", match.id)
      .maybeSingle();

    if (existing) {
      await supabase.from("picks").update(pickRow).eq("id", existing.id);
    } else {
      await supabase.from("picks").insert(pickRow);
    }

    await supabase
      .from("bracket_slot_picks")
      .delete()
      .eq("id", slotPick.id);
  }
}

export function buildSlotPickMap(
  slotPicks: BracketSlotPick[]
): Map<string, BracketSlotPick> {
  return new Map(
    slotPicks.map((pick) => [
      bracketSlotPickKey(pick.round_id, pick.slot_index),
      pick,
    ])
  );
}

export function getRo32MatchesBySlot(matches: Match[]): (Match | undefined)[] {
  const grouped = groupKnockoutMatches(matches);
  const ro32 = grouped.get("ro32") ?? [];
  const slotCount = KNOCKOUT_ROUND_COLUMNS[0].expectedSlots;
  return Array.from({ length: slotCount }, (_, index) => ro32[index]);
}
