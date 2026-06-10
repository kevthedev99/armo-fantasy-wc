import { toClientView } from "@/lib/blackjack";
import {
  DAILY_FREE_PLAY,
  formatCountdown,
  msUntilNextCasinoReset,
} from "@/lib/casino-day";
import {
  getBlackjackState,
  getOrResetCasinoBalance,
} from "@/lib/casino-balance";
import type { BalanceState } from "@/lib/casino-types";
import { createClient } from "@/lib/supabase/server";

export async function loadCasinoPageData() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = user
    ? await supabase
        .from("profiles")
        .select("username")
        .eq("id", user.id)
        .single()
    : { data: null };

  let initialBalance: BalanceState = {
    balance: DAILY_FREE_PLAY,
    canPlay: true,
    resetIn: formatCountdown(msUntilNextCasinoReset()),
    dailyAllowance: DAILY_FREE_PLAY,
  };

  if (user) {
    try {
      const state = await getOrResetCasinoBalance(user.id);
      initialBalance = {
        balance: state.balance,
        canPlay: state.balance > 0,
        resetIn: formatCountdown(msUntilNextCasinoReset()),
        dailyAllowance: DAILY_FREE_PLAY,
      };
    } catch {
      // Table may not exist yet.
    }
  }

  return { profile, initialBalance, userId: user?.id ?? null };
}

export async function loadBlackjackPageData() {
  const { profile, initialBalance, userId } = await loadCasinoPageData();
  let initialView = toClientView(null, initialBalance.balance);

  if (userId) {
    try {
      const hand = await getBlackjackState(userId);
      initialView = toClientView(hand, initialBalance.balance);
    } catch {
      // Table may not exist yet.
    }
  }

  return { profile, initialBalance, initialView };
}
