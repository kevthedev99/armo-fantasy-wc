import type { BracketSlotPick } from "@/lib/types";
import {
  loadBracketSlotPicks,
  saveBracketSlotPicks,
} from "@/lib/bracket-slot-picks-storage";

function slotKey(pick: Pick<BracketSlotPick, "round_id" | "slot_index">): string {
  return `${pick.round_id}:${pick.slot_index}`;
}

export function mergeBracketSlotPicks(
  ...lists: BracketSlotPick[][]
): BracketSlotPick[] {
  const byKey = new Map<string, BracketSlotPick>();
  for (const list of lists) {
    for (const pick of list) {
      byKey.set(slotKey(pick), pick);
    }
  }
  return [...byKey.values()];
}

export async function fetchRemoteBracketSlotPicks(): Promise<{
  picks: BracketSlotPick[];
  tableMissing: boolean;
}> {
  const res = await fetch("/api/bracket-slot-picks", { cache: "no-store" });
  if (res.status === 401) {
    return { picks: [], tableMissing: false };
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    if (body.tableMissing) {
      return { picks: [], tableMissing: true };
    }
    throw new Error(body.error ?? "Failed to load bracket picks.");
  }
  const body = await res.json();
  return {
    picks: body.picks ?? [],
    tableMissing: !!body.tableMissing,
  };
}

export async function saveRemoteBracketSlotPick(
  pick: BracketSlotPick
): Promise<{ pick: BracketSlotPick; tableMissing: boolean }> {
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
  if (body.tableMissing || res.status === 503) {
    return { pick, tableMissing: true };
  }
  if (!res.ok) {
    throw new Error(body.error ?? "Failed to save bracket pick.");
  }

  return { pick: body.pick as BracketSlotPick, tableMissing: false };
}

/** Upload this browser's local bracket picks to the account, then clear local copy. */
export async function migrateLocalBracketSlotPicksToServer(
  userId: string
): Promise<BracketSlotPick[]> {
  const local = loadBracketSlotPicks(userId);
  if (!local.length) return [];

  const uploaded: BracketSlotPick[] = [];
  let tableMissing = false;

  for (const pick of local) {
    const result = await saveRemoteBracketSlotPick(pick);
    if (result.tableMissing) {
      tableMissing = true;
      break;
    }
    uploaded.push(result.pick);
  }

  if (tableMissing) {
    return local;
  }

  saveBracketSlotPicks(userId, []);
  const remote = await fetchRemoteBracketSlotPicks();
  return mergeBracketSlotPicks(uploaded, remote.picks);
}
