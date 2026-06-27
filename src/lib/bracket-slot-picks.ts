import type { BracketRoundColumn } from "@/lib/knockout-bracket-layout";
import { KNOCKOUT_ROUND_COLUMNS } from "@/lib/knockout-bracket-layout";
import type { BracketSlotPick, Match, Pick as UserPick, PickWinner } from "@/lib/types";

const VIRTUAL_MATCH_ID_BASE: Record<string, number> = {
  r16: 1000,
  qf: 2000,
  sf: 3000,
  final: 4000,
  third: 5000,
};

export function getVirtualMatchId(roundId: string, slotIndex: number): number {
  const base = VIRTUAL_MATCH_ID_BASE[roundId];
  if (base == null) return -(9000 + slotIndex);
  return -(base + slotIndex);
}

export function parseVirtualMatchSlot(
  matchId: number
): { roundId: string; slotIndex: number } | null {
  if (matchId >= 0) return null;
  const abs = Math.abs(matchId);
  for (const [roundId, base] of Object.entries(VIRTUAL_MATCH_ID_BASE)) {
    const slotIndex = abs - base;
    if (slotIndex >= 0 && slotIndex < 100) {
      return { roundId, slotIndex };
    }
  }
  return null;
}

export function isVirtualMatchId(matchId: number): boolean {
  return matchId < 0;
}

/** All Ro32 slot indices that feed this bracket slot (must be synced to pick ahead). */
export function getRo32FeederSlotIndices(
  roundId: string,
  slotIndex: number
): number[] {
  if (roundId === "ro32") return [slotIndex];

  const slotsPerRo32Block =
    roundId === "r16"
      ? 2
      : roundId === "qf"
        ? 4
        : roundId === "sf"
          ? 8
          : roundId === "final" || roundId === "third"
            ? 16
            : 0;

  const start = slotIndex * slotsPerRo32Block;
  return Array.from({ length: slotsPerRo32Block }, (_, i) => start + i);
}

export function areRo32FeedersSynced(
  roundId: string,
  slotIndex: number,
  ro32MatchesBySlot: (Match | undefined)[]
): boolean {
  if (roundId === "ro32") return !!ro32MatchesBySlot[slotIndex];
  return getRo32FeederSlotIndices(roundId, slotIndex).every(
    (index) => ro32MatchesBySlot[index] !== undefined
  );
}

export function getColumnById(columnId: string): BracketRoundColumn | undefined {
  return KNOCKOUT_ROUND_COLUMNS.find((column) => column.id === columnId);
}

export function buildVirtualMatch(
  column: BracketRoundColumn,
  slotIndex: number,
  home: { id: number; name: string; logo: string | null },
  away: { id: number; name: string; logo: string | null }
): Match {
  return {
    id: getVirtualMatchId(column.id, slotIndex),
    round: column.apiRounds[0],
    group_name: null,
    stage: "knockout",
    home_team_id: home.id,
    home_team_name: home.name,
    home_team_logo: home.logo,
    away_team_id: away.id,
    away_team_name: away.name,
    away_team_logo: away.logo,
    kickoff_at: "2099-01-01T00:00:00.000Z",
    status: "NS",
    home_score: null,
    away_score: null,
    pen_home_score: null,
    pen_away_score: null,
    winning_goal_minute: null,
    match_events: [],
  };
}

export function bracketSlotPickKey(roundId: string, slotIndex: number): string {
  return `${roundId}:${slotIndex}`;
}

export function slotPickToDisplayPick(
  slotPick: BracketSlotPick,
  match: Match
): UserPick {
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

/** Map slot-pick winner/scores onto a synced match (teams may be swapped). */
export function mapSlotPickToMatch(
  slotPick: Pick<
    BracketSlotPick,
    | "home_team_id"
    | "away_team_id"
    | "picked_winner"
    | "home_score_pred"
    | "away_score_pred"
    | "predicts_penalties"
  >,
  match: Match
): {
  picked_winner: PickWinner;
  home_score_pred: number | null;
  away_score_pred: number | null;
  predicts_penalties: boolean;
} {
  const sameOrder =
    slotPick.home_team_id === match.home_team_id &&
    slotPick.away_team_id === match.away_team_id;

  if (sameOrder) {
    return {
      picked_winner: slotPick.picked_winner,
      home_score_pred: slotPick.home_score_pred,
      away_score_pred: slotPick.away_score_pred,
      predicts_penalties: slotPick.predicts_penalties,
    };
  }

  let pickedWinner = slotPick.picked_winner;
  if (pickedWinner === "home") pickedWinner = "away";
  else if (pickedWinner === "away") pickedWinner = "home";

  return {
    picked_winner: pickedWinner,
    home_score_pred: slotPick.away_score_pred,
    away_score_pred: slotPick.home_score_pred,
    predicts_penalties: slotPick.predicts_penalties,
  };
}
