import { NextResponse } from "next/server";
import {
  CASINO_TIMEZONE,
  DAILY_FREE_PLAY,
  formatCountdown,
  msUntilNextCasinoReset,
} from "@/lib/casino-day";
import { getOrResetCasinoBalance } from "@/lib/casino-balance";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  try {
    const state = await getOrResetCasinoBalance(user.id);
    const msUntilReset = msUntilNextCasinoReset();

    return NextResponse.json({
      balance: state.balance,
      dailyAllowance: DAILY_FREE_PLAY,
      canPlay: state.balance > 0,
      resetIn: formatCountdown(msUntilReset),
      resetInMs: msUntilReset,
      timezone: CASINO_TIMEZONE,
      justReset: state.resetAtMidnight,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
