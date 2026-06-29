import {
  getActualWinnerTeamId,
  getPickedTeamId,
} from "@/lib/bracket-chaining";
import { bracketSlotPickKey } from "@/lib/bracket-slot-picks";
import {
  getFeederPair,
  getFeederRoundId,
} from "@/lib/knockout-bracket-feeders";
import {
  groupKnockoutMatches,
  KNOCKOUT_ROUND_COLUMNS,
} from "@/lib/knockout-bracket-layout";
import { isMatchFinished } from "@/lib/scoring";
import type {
  BracketSlotPick,
  Match,
  Pick as UserPick,
  PickWinner,
} from "@/lib/types";

export type BracketSlotChainingStatus = "pending" | "free" | "forced" | "bust";

export type BracketSlotChaining = {
  status: BracketSlotChainingStatus;
  /** Team the user must pick when status is "forced". */
  forcedTeamId?: number;
};

type FeederOutcome =
  | { kind: "pending" }
  | { kind: "bust" }
  | { kind: "wrong" }
  | { kind: "correct"; teamId: number };

export type BracketChainingContext = {
  grouped: Map<string, Match[]>;
  pickMap: Map<number, UserPick>;
  slotPickMap: Map<string, BracketSlotPick>;
};

const LATER_ROUNDS = ["r16", "qf", "sf", "final", "third"] as const;

export function bracketSlotKey(roundId: string, slotIndex: number): string {
  return `${roundId}:${slotIndex}`;
}

export function buildBracketChainingContext(
  matches: Match[],
  picks: UserPick[],
  slotPicks: BracketSlotPick[] = []
): BracketChainingContext {
  return {
    grouped: groupKnockoutMatches(matches),
    pickMap: new Map(picks.map((pick) => [pick.match_id, pick])),
    slotPickMap: new Map(
      slotPicks.map((pick) => [
        bracketSlotPickKey(pick.round_id, pick.slot_index),
        pick,
      ])
    ),
  };
}

export function computeAllBracketSlotChaining(
  ctx: BracketChainingContext
): Map<string, BracketSlotChaining> {
  const cache = new Map<string, BracketSlotChaining>();

  for (const roundId of LATER_ROUNDS) {
    const column = KNOCKOUT_ROUND_COLUMNS.find((c) => c.id === roundId);
    if (!column) continue;

    for (let slotIndex = 0; slotIndex < column.expectedSlots; slotIndex++) {
      cache.set(
        bracketSlotKey(roundId, slotIndex),
        computeSlotChaining(roundId, slotIndex, ctx, cache)
      );
    }
  }

  return cache;
}

function computeSlotChaining(
  roundId: string,
  slotIndex: number,
  ctx: BracketChainingContext,
  cache: Map<string, BracketSlotChaining>
): BracketSlotChaining {
  const pair = getFeederPair(roundId, slotIndex);
  const feederRoundId = getFeederRoundId(roundId);
  if (!pair || !feederRoundId) {
    return { status: "free" };
  }

  const homeOutcome = evaluateFeederOutcome(
    feederRoundId,
    pair[0],
    roundId === "third",
    ctx,
    cache
  );
  const awayOutcome = evaluateFeederOutcome(
    feederRoundId,
    pair[1],
    roundId === "third",
    ctx,
    cache
  );

  if (homeOutcome.kind === "pending" || awayOutcome.kind === "pending") {
    return { status: "pending" };
  }

  const homeSurvivor =
    homeOutcome.kind === "correct" ? homeOutcome.teamId : null;
  const awaySurvivor =
    awayOutcome.kind === "correct" ? awayOutcome.teamId : null;

  if (!homeSurvivor && !awaySurvivor) {
    return { status: "bust" };
  }

  if (homeSurvivor && awaySurvivor) {
    return { status: "free" };
  }

  return {
    status: "forced",
    forcedTeamId: homeSurvivor ?? awaySurvivor!,
  };
}

function evaluateFeederOutcome(
  feederRoundId: string,
  feederSlotIndex: number,
  useLosers: boolean,
  ctx: BracketChainingContext,
  cache: Map<string, BracketSlotChaining>
): FeederOutcome {
  if (feederRoundId !== "ro32") {
    const feederState = cache.get(bracketSlotKey(feederRoundId, feederSlotIndex));
    if (feederState?.status === "bust") {
      return { kind: "bust" };
    }
  }

  const match = ctx.grouped.get(feederRoundId)?.[feederSlotIndex];
  if (!match || !isMatchFinished(match.status)) {
    return { kind: "pending" };
  }

  const pick = getUserPickForSlot(
    feederRoundId,
    feederSlotIndex,
    match,
    ctx
  );
  if (!pick) {
    return { kind: "wrong" };
  }

  if (useLosers) {
    const predictedLoserId = getPredictedLoserTeamId(match, pick);
    const actualWinnerId = getActualWinnerTeamId(match);
    if (predictedLoserId === null || actualWinnerId === null) {
      return { kind: "wrong" };
    }
    const actualLoserId =
      actualWinnerId === match.home_team_id
        ? match.away_team_id
        : match.home_team_id;
    if (predictedLoserId === actualLoserId) {
      return { kind: "correct", teamId: actualLoserId };
    }
    return { kind: "wrong" };
  }

  const pickedTeamId = getPickedTeamId(match, pick);
  const actualWinnerId = getActualWinnerTeamId(match);
  if (
    pickedTeamId !== null &&
    actualWinnerId !== null &&
    pickedTeamId === actualWinnerId
  ) {
    return { kind: "correct", teamId: pickedTeamId };
  }

  return { kind: "wrong" };
}

function getPredictedLoserTeamId(
  match: Pick<Match, "home_team_id" | "away_team_id">,
  pick: UserPick
): number | null {
  if (pick.picked_winner === "home") return match.away_team_id;
  if (pick.picked_winner === "away") return match.home_team_id;
  return null;
}

function getUserPickForSlot(
  roundId: string,
  slotIndex: number,
  match: Match,
  ctx: BracketChainingContext
): UserPick | null {
  const direct = ctx.pickMap.get(match.id);
  if (direct) return direct;

  const slotPick = ctx.slotPickMap.get(bracketSlotKey(roundId, slotIndex));
  if (!slotPick) return null;

  return {
    id: slotPick.id,
    user_id: slotPick.user_id,
    match_id: match.id,
    picked_winner: slotPick.picked_winner,
    home_score_pred: slotPick.home_score_pred,
    away_score_pred: slotPick.away_score_pred,
    predicts_penalties: slotPick.predicts_penalties,
    winning_goal_minute_pred: null,
    points_earned: 0,
    is_scored: false,
  };
}

export function findMatchBracketSlot(
  match: Match,
  grouped: Map<string, Match[]>
): { roundId: string; slotIndex: number } | null {
  for (const column of KNOCKOUT_ROUND_COLUMNS) {
    const slots = grouped.get(column.id) ?? [];
    const slotIndex = slots.findIndex((slot) => slot?.id === match.id);
    if (slotIndex >= 0) {
      return { roundId: column.id, slotIndex };
    }
  }
  return null;
}

export function getSlotChainingForMatch(
  match: Match,
  ctx: BracketChainingContext,
  cache?: Map<string, BracketSlotChaining>
): BracketSlotChaining | null {
  const slot = findMatchBracketSlot(match, ctx.grouped);
  if (!slot || slot.roundId === "ro32") return null;

  const map = cache ?? computeAllBracketSlotChaining(ctx);
  return map.get(bracketSlotKey(slot.roundId, slot.slotIndex)) ?? null;
}

export function resolveForcedWinnerSide(
  match: Pick<Match, "home_team_id" | "away_team_id">,
  chaining: BracketSlotChaining
): PickWinner | null {
  if (chaining.status !== "forced" || chaining.forcedTeamId == null) {
    return null;
  }
  if (match.home_team_id === chaining.forcedTeamId) return "home";
  if (match.away_team_id === chaining.forcedTeamId) return "away";
  return null;
}

/** NCAA-style: bust slots score 0; forced slots require the chained survivor. */
export function isValidStrictBracketPick(
  match: Match,
  pickedWinner: PickWinner,
  ctx: BracketChainingContext,
  cache?: Map<string, BracketSlotChaining>
): boolean {
  if (match.stage !== "knockout") return true;

  const slot = findMatchBracketSlot(match, ctx.grouped);
  if (!slot || slot.roundId === "ro32") {
    return true;
  }

  const chaining =
    cache?.get(bracketSlotKey(slot.roundId, slot.slotIndex)) ??
    getSlotChainingForMatch(match, ctx, cache);

  if (!chaining) return true;

  if (chaining.status === "bust") {
    return false;
  }

  if (chaining.status === "forced") {
    const forcedSide = resolveForcedWinnerSide(match, chaining);
    return forcedSide !== null && pickedWinner === forcedSide;
  }

  return true;
}

export function getLockedWinnerForSlot(
  roundId: string,
  slotIndex: number,
  match: Pick<Match, "home_team_id" | "away_team_id">,
  chaining: BracketSlotChaining | undefined
): PickWinner | null {
  if (!chaining) return null;
  if (chaining.status === "bust") return null;
  if (chaining.status === "forced") {
    return resolveForcedWinnerSide(match, chaining);
  }
  return null;
}

export function isSlotPickable(
  chaining: BracketSlotChaining | undefined,
  locked: boolean
): boolean {
  if (locked) return false;
  if (!chaining) return true;
  return chaining.status === "free" || chaining.status === "forced";
}
