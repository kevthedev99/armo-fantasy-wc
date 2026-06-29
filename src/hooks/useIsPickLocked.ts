"use client";

import { useEffect, useState } from "react";
import { isPickLocked } from "@/lib/knockout-bracket";
import type { Match } from "@/lib/types";

/** Re-evaluates pick lock on an interval and at kickoff. */
export function useIsPickLocked(match: Match, allMatches: Match[]): boolean {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const tick = () => setNow(new Date());
    const interval = setInterval(tick, 15_000);
    const timers: ReturnType<typeof setTimeout>[] = [];

    const kickoffMs = new Date(match.kickoff_at).getTime();
    const msUntilKickoff = kickoffMs - Date.now();
    if (msUntilKickoff > 0 && msUntilKickoff < 24 * 60 * 60 * 1000) {
      timers.push(setTimeout(tick, msUntilKickoff + 500));
    }

    return () => {
      clearInterval(interval);
      timers.forEach(clearTimeout);
    };
  }, [match.kickoff_at, match.status, match.stage, allMatches]);

  return isPickLocked(match, allMatches, now);
}
