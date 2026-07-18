"use client";

import { useMemo } from "react";
import {
  buildBracketChainingContext,
  computeAllBracketSlotChaining,
  getSlotChainingForMatch,
} from "@/lib/bracket-slot-chaining";
import type { BracketSlotPick, Match, Pick } from "@/lib/types";

/** Match IDs whose NCAA bracket path is bust (both feeder picks wrong). */
export function useBustedMatchIds(
  picks: Pick[],
  matches: Match[],
  slotPicks: BracketSlotPick[] = []
): Set<number> {
  return useMemo(() => {
    const ctx = buildBracketChainingContext(matches, picks, slotPicks);
    const cache = computeAllBracketSlotChaining(ctx);
    const busted = new Set<number>();

    for (const match of matches) {
      if (match.stage !== "knockout") continue;
      const chaining = getSlotChainingForMatch(match, ctx, cache);
      if (chaining?.status === "bust") {
        busted.add(match.id);
      }
    }

    return busted;
  }, [picks, matches, slotPicks]);
}
