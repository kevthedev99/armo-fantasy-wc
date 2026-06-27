import type {
  BracketSlotPick,
  BracketSlotRoundId,
  Match,
  PickWinner,
} from "@/lib/types";

const STORAGE_PREFIX = "armo-bracket-slot-picks";

function storageKey(userId: string): string {
  return `${STORAGE_PREFIX}:${userId}`;
}

export function loadBracketSlotPicks(userId: string): BracketSlotPick[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(storageKey(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as BracketSlotPick[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveBracketSlotPicks(
  userId: string,
  slotPicks: BracketSlotPick[]
): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(storageKey(userId), JSON.stringify(slotPicks));
}

export function upsertBracketSlotPick(
  userId: string,
  slotPick: BracketSlotPick
): BracketSlotPick[] {
  const existing = loadBracketSlotPicks(userId);
  const index = existing.findIndex(
    (pick) =>
      pick.round_id === slotPick.round_id &&
      pick.slot_index === slotPick.slot_index
  );
  const next =
    index >= 0
      ? existing.map((pick, i) => (i === index ? slotPick : pick))
      : [...existing, slotPick];
  saveBracketSlotPicks(userId, next);
  return next;
}

export function removeBracketSlotPick(
  userId: string,
  roundId: BracketSlotRoundId,
  slotIndex: number
): BracketSlotPick[] {
  const next = loadBracketSlotPicks(userId).filter(
    (pick) => !(pick.round_id === roundId && pick.slot_index === slotIndex)
  );
  saveBracketSlotPicks(userId, next);
  return next;
}

export function buildBracketSlotPick(
  userId: string,
  roundId: BracketSlotRoundId,
  slotIndex: number,
  match: Match,
  pickedWinner: PickWinner,
  homeScorePred: number | null,
  awayScorePred: number | null,
  predictsPenalties: boolean
): BracketSlotPick {
  return {
    id: `${roundId}:${slotIndex}`,
    user_id: userId,
    round_id: roundId,
    slot_index: slotIndex,
    home_team_id: match.home_team_id,
    away_team_id: match.away_team_id,
    picked_winner: pickedWinner,
    home_score_pred: homeScorePred,
    away_score_pred: awayScorePred,
    predicts_penalties: predictsPenalties,
    updated_at: new Date().toISOString(),
  };
}
