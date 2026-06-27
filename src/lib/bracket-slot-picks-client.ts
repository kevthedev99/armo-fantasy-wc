import type { BracketSlotPick } from "@/lib/types";

export async function fetchRemoteBracketSlotPicks(): Promise<BracketSlotPick[]> {
  const res = await fetch("/api/bracket-slot-picks", { cache: "no-store" });
  if (res.status === 401) return [];

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body.error ?? "Failed to load bracket picks.");
  }

  return body.picks ?? [];
}

export async function saveRemoteBracketSlotPick(
  pick: BracketSlotPick
): Promise<BracketSlotPick> {
  const res = await fetch("/api/bracket-slot-picks", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      round_id: pick.round_id,
      slot_index: pick.slot_index,
      home_team_id: pick.home_team_id,
      away_team_id: pick.away_team_id,
      pickedWinner: pick.picked_winner,
      homeScorePred: pick.home_score_pred,
      awayScorePred: pick.away_score_pred,
      predictsPenalties: pick.predicts_penalties,
    }),
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body.error ?? "Failed to save bracket pick.");
  }

  return body.pick as BracketSlotPick;
}

export async function deleteRemoteBracketSlotPick(
  roundId: BracketSlotPick["round_id"],
  slotIndex: number
): Promise<void> {
  const params = new URLSearchParams({
    roundId,
    slotIndex: String(slotIndex),
  });
  const res = await fetch(`/api/bracket-slot-picks?${params}`, {
    method: "DELETE",
  });
  if (!res.ok && res.status !== 404) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? "Failed to delete bracket slot pick.");
  }
}
