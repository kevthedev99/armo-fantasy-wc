"use client";

import { useMemo } from "react";
import {
  createTeamEliminationChecker,
  type TeamEliminationChecker,
} from "@/lib/team-elimination-display";
import type { Match, Pick } from "@/lib/types";

export function useTeamElimination(
  picks: Pick[],
  matches: Match[]
): TeamEliminationChecker {
  return useMemo(
    () => createTeamEliminationChecker(picks, matches),
    [picks, matches]
  );
}
