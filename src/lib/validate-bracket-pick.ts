import {
  bracketSlotKey,
  buildBracketChainingContext,
  computeAllBracketSlotChaining,
  findMatchBracketSlot,
  isValidStrictBracketPick,
} from "@/lib/bracket-slot-chaining";
import { rowToBracketSlotPick } from "@/lib/bracket-slot-pick-db";
import type { Match, PickWinner } from "@/lib/types";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Server-side NCAA bracket pick validation. Returns an error message or null. */
export async function validateStrictBracketPickForUser(
  supabase: SupabaseClient,
  userId: string,
  match: Match,
  pickedWinner: PickWinner,
  allMatches: Match[]
): Promise<string | null> {
  if (match.stage !== "knockout") return null;

  const { data: picks } = await supabase
    .from("picks")
    .select("*")
    .eq("user_id", userId);

  let slotPicks: ReturnType<typeof rowToBracketSlotPick>[] = [];
  const { data: slotPickRows, error: slotError } = await supabase
    .from("bracket_slot_picks")
    .select("*")
    .eq("user_id", userId);

  if (!slotError && slotPickRows) {
    slotPicks = slotPickRows.map((row) =>
      rowToBracketSlotPick(
        row as Parameters<typeof rowToBracketSlotPick>[0]
      )
    );
  }

  const ctx = buildBracketChainingContext(allMatches, picks ?? [], slotPicks);
  const cache = computeAllBracketSlotChaining(ctx);

  if (isValidStrictBracketPick(match, pickedWinner, ctx, cache)) {
    return null;
  }

  const bracketSlot = findMatchBracketSlot(match, ctx.grouped);
  if (bracketSlot) {
    const chaining = cache.get(
      bracketSlotKey(bracketSlot.roundId, bracketSlot.slotIndex)
    );
    if (chaining?.status === "bust") {
      return "This bracket path is bust — both feeder picks were wrong, so this slot cannot score.";
    }
    if (chaining?.status === "forced") {
      return "Your bracket locks the winner for this match — you can change the score but not the winner.";
    }
  }

  return "This pick is not allowed on your bracket path.";
}

/** Validate a bracket slot pick before the real fixture syncs. */
export async function validateStrictBracketSlotPickForUser(
  supabase: SupabaseClient,
  userId: string,
  roundId: string,
  slotIndex: number,
  match: Match,
  pickedWinner: PickWinner,
  allMatches: Match[]
): Promise<string | null> {
  const { data: picks } = await supabase
    .from("picks")
    .select("*")
    .eq("user_id", userId);

  let slotPicks: ReturnType<typeof rowToBracketSlotPick>[] = [];
  const { data: slotPickRows, error: slotError } = await supabase
    .from("bracket_slot_picks")
    .select("*")
    .eq("user_id", userId);

  if (!slotError && slotPickRows) {
    slotPicks = slotPickRows.map((row) =>
      rowToBracketSlotPick(
        row as Parameters<typeof rowToBracketSlotPick>[0]
      )
    );
  }

  const ctx = buildBracketChainingContext(allMatches, picks ?? [], slotPicks);
  const cache = computeAllBracketSlotChaining(ctx);
  const chaining = cache.get(bracketSlotKey(roundId, slotIndex));

  if (chaining?.status === "bust") {
    return "This bracket path is bust — both feeder picks were wrong.";
  }

  if (chaining?.status === "pending") {
    return "This slot unlocks once both feeder matches finish.";
  }

  if (chaining?.status === "forced") {
    const forcedSide =
      match.home_team_id === chaining.forcedTeamId
        ? "home"
        : match.away_team_id === chaining.forcedTeamId
          ? "away"
          : null;
    if (forcedSide !== pickedWinner) {
      return "Your bracket locks the winner for this match — you can change the score but not the winner.";
    }
  }

  return null;
}
