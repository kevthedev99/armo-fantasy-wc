import type { BlackjackState } from "@/lib/blackjack";
import {
  BUST_RESET_MS,
  DAILY_FREE_PLAY,
  formatCountdown,
  msUntilBustReset,
} from "@/lib/casino-day";
import type { BalanceState } from "@/lib/casino-types";
import { createServiceClient } from "@/lib/supabase/server";

export interface CasinoBalanceState {
  balance: number;
  bustedAt: string | null;
  justReset: boolean;
}

type BalanceRow = {
  balance: number;
  busted_at: string | null;
};

function bustReady(bustedAt: string, now = Date.now()): boolean {
  return new Date(bustedAt).getTime() + BUST_RESET_MS <= now;
}

export function toBalanceState(state: CasinoBalanceState): BalanceState {
  const canPlay = state.balance > 0;
  return {
    balance: state.balance,
    canPlay,
    resetIn: canPlay ? "" : formatCountdown(msUntilBustReset(state.bustedAt)),
    resetInMs: canPlay ? 0 : msUntilBustReset(state.bustedAt),
    dailyAllowance: DAILY_FREE_PLAY,
  };
}

export async function getOrResetCasinoBalance(
  userId: string
): Promise<CasinoBalanceState> {
  const service = createServiceClient();
  const nowIso = new Date().toISOString();

  const { data: existing } = await service
    .from("casino_balances")
    .select("balance, busted_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (!existing) {
    const { data: created, error } = await service
      .from("casino_balances")
      .insert({
        user_id: userId,
        balance: DAILY_FREE_PLAY,
        busted_at: null,
      })
      .select("balance, busted_at")
      .single();

    if (error || !created) {
      throw new Error(error?.message ?? "Could not create casino balance.");
    }

    return {
      balance: created.balance,
      bustedAt: created.busted_at,
      justReset: false,
    };
  }

  const row = existing as BalanceRow;

  if (row.balance > 0) {
    return {
      balance: row.balance,
      bustedAt: row.busted_at,
      justReset: false,
    };
  }

  let bustedAt = row.busted_at;

  if (!bustedAt) {
    const { data: stamped, error } = await service
      .from("casino_balances")
      .update({ busted_at: nowIso, updated_at: nowIso })
      .eq("user_id", userId)
      .select("balance, busted_at")
      .single();

    if (error || !stamped) {
      throw new Error(error?.message ?? "Could not stamp bust time.");
    }

    bustedAt = stamped.busted_at;
  }

  if (bustedAt && bustReady(bustedAt)) {
    const { data: refreshed, error } = await service
      .from("casino_balances")
      .update({
        balance: DAILY_FREE_PLAY,
        busted_at: null,
        updated_at: nowIso,
      })
      .eq("user_id", userId)
      .select("balance, busted_at")
      .single();

    if (error || !refreshed) {
      throw new Error(error?.message ?? "Could not reset casino balance.");
    }

    return {
      balance: refreshed.balance,
      bustedAt: refreshed.busted_at,
      justReset: true,
    };
  }

  return {
    balance: 0,
    bustedAt,
    justReset: false,
  };
}

export async function updateCasinoBalance(
  userId: string,
  newBalance: number
): Promise<number> {
  const service = createServiceClient();
  const nowIso = new Date().toISOString();
  const { data, error } = await service
    .from("casino_balances")
    .update({
      balance: newBalance,
      busted_at: newBalance <= 0 ? nowIso : null,
      updated_at: nowIso,
    })
    .eq("user_id", userId)
    .select("balance")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Could not update balance.");
  }

  return data.balance;
}

export async function getBlackjackState(
  userId: string
): Promise<BlackjackState | null> {
  const service = createServiceClient();
  const { data } = await service
    .from("casino_balances")
    .select("blackjack_state")
    .eq("user_id", userId)
    .maybeSingle();

  return (data?.blackjack_state as BlackjackState | null) ?? null;
}

export async function saveCasinoSession(
  userId: string,
  balance: number,
  blackjackState: BlackjackState | null
): Promise<number> {
  const service = createServiceClient();
  const nowIso = new Date().toISOString();
  const { data, error } = await service
    .from("casino_balances")
    .update({
      balance,
      busted_at: balance <= 0 ? nowIso : null,
      blackjack_state: blackjackState,
      updated_at: nowIso,
    })
    .eq("user_id", userId)
    .select("balance")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Could not save casino session.");
  }

  return data.balance;
}

export interface CasinoLeaderboardEntry {
  rank: number;
  userId: string;
  username: string;
  displayName: string;
  avatarColor: string;
  balance: number;
}

export async function getCasinoLeaderboard(
  limit = 10
): Promise<CasinoLeaderboardEntry[]> {
  const service = createServiceClient();
  const { data, error } = await service
    .from("casino_balances")
    .select(
      "balance, user_id, profiles!inner(username, display_name, avatar_color)"
    )
    .order("balance", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((row, index) => {
    const profile = row.profiles as unknown as {
      username: string;
      display_name: string;
      avatar_color: string;
    };
    return {
      rank: index + 1,
      userId: row.user_id as string,
      username: profile.username,
      displayName: profile.display_name,
      avatarColor: profile.avatar_color,
      balance: row.balance as number,
    };
  });
}

export { DAILY_FREE_PLAY };
