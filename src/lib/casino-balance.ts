import { CASINO_TIMEZONE, DAILY_FREE_PLAY, getCasinoDay } from "@/lib/casino-day";
import { createServiceClient } from "@/lib/supabase/server";

export interface CasinoBalanceState {
  balance: number;
  lastResetDate: string;
  resetAtMidnight: boolean;
}

export async function getOrResetCasinoBalance(
  userId: string
): Promise<CasinoBalanceState> {
  const service = createServiceClient();
  const today = getCasinoDay();

  const { data: existing } = await service
    .from("casino_balances")
    .select("balance, last_reset_date")
    .eq("user_id", userId)
    .maybeSingle();

  if (!existing) {
    const { data: created, error } = await service
      .from("casino_balances")
      .insert({
        user_id: userId,
        balance: DAILY_FREE_PLAY,
        last_reset_date: today,
      })
      .select("balance, last_reset_date")
      .single();

    if (error || !created) {
      throw new Error(error?.message ?? "Could not create casino balance.");
    }

    return {
      balance: created.balance,
      lastResetDate: created.last_reset_date,
      resetAtMidnight: false,
    };
  }

  if (existing.last_reset_date < today) {
    const { data: updated, error } = await service
      .from("casino_balances")
      .update({
        balance: DAILY_FREE_PLAY,
        last_reset_date: today,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId)
      .select("balance, last_reset_date")
      .single();

    if (error || !updated) {
      throw new Error(error?.message ?? "Could not reset casino balance.");
    }

    return {
      balance: updated.balance,
      lastResetDate: updated.last_reset_date,
      resetAtMidnight: true,
    };
  }

  return {
    balance: existing.balance,
    lastResetDate: existing.last_reset_date,
    resetAtMidnight: false,
  };
}

export async function updateCasinoBalance(
  userId: string,
  newBalance: number,
  lastResetDate: string
): Promise<number> {
  const service = createServiceClient();
  const { data, error } = await service
    .from("casino_balances")
    .update({
      balance: newBalance,
      last_reset_date: lastResetDate,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId)
    .select("balance")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Could not update balance.");
  }

  return data.balance;
}

export { CASINO_TIMEZONE, DAILY_FREE_PLAY };
