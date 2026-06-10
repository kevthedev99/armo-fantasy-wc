"use client";

import { useEffect, useState } from "react";
import { isMatchLocked } from "@/lib/scoring";

/** Re-evaluates lock state on an interval and at kickoff so open pages lock on time. */
export function useIsMatchLocked(match: {
  status: string;
  kickoff_at: string;
}): boolean {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const tick = () => setNow(new Date());
    const interval = setInterval(tick, 15_000);

    const kickoffMs = new Date(match.kickoff_at).getTime();
    const msUntilKickoff = kickoffMs - Date.now();
    let kickoffTimer: ReturnType<typeof setTimeout> | undefined;

    if (msUntilKickoff > 0 && msUntilKickoff < 24 * 60 * 60 * 1000) {
      kickoffTimer = setTimeout(tick, msUntilKickoff + 500);
    }

    return () => {
      clearInterval(interval);
      if (kickoffTimer) clearTimeout(kickoffTimer);
    };
  }, [match.kickoff_at, match.status]);

  return isMatchLocked(match, now);
}
