import { toClientView } from "@/lib/blackjack";
import { DAILY_FREE_PLAY } from "@/lib/casino-day";
import {
  getBlackjackState,
  getCasinoLeaderboard,
  getOrResetCasinoBalance,
  toBalanceState,
} from "@/lib/casino-balance";
import type { BalanceState, CasinoLeaderboardRow } from "@/lib/casino-types";
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
    resetIn: "",
    resetInMs: 0,
    dailyAllowance: DAILY_FREE_PLAY,
  };

  let leaderboard: CasinoLeaderboardRow[] = [];

  if (user) {
    try {
      const state = await getOrResetCasinoBalance(user.id);
      initialBalance = toBalanceState(state);
      leaderboard = await getCasinoLeaderboard(10);
    } catch {
      // Table may not exist yet.
    }
  }

  return { profile, initialBalance, userId: user?.id ?? null, leaderboard };
}

export async function loadBlackjackPageData() {
  const { profile, initialBalance, userId, leaderboard } =
    await loadCasinoPageData();
  let initialView = toClientView(null, initialBalance.balance);

  if (userId) {
    try {
      const hand = await getBlackjackState(userId);
      initialView = toClientView(hand, initialBalance.balance);
    } catch {
      // Table may not exist yet.
    }
  }

  return { profile, initialBalance, initialView, userId, leaderboard };
}
