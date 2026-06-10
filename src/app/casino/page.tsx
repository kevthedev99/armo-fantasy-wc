import { Nav } from "@/components/Nav";
import { RoulettePage } from "@/components/RoulettePage";
import {
  DAILY_FREE_PLAY,
  formatCountdown,
  msUntilNextCasinoReset,
} from "@/lib/casino-day";
import { getOrResetCasinoBalance } from "@/lib/casino-balance";
import { createClient } from "@/lib/supabase/server";

export default async function CasinoPage() {
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

  let initialBalance = {
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
      // Table may not exist yet — client poll will surface errors.
    }
  }

  return (
    <div className="min-h-screen bg-black">
      <Nav username={profile?.username} />
      <div className="border-b border-[#FFD700]/20 bg-gradient-to-b from-[#0d2818]/40 to-black">
        <RoulettePage initialBalance={initialBalance} />
      </div>
    </div>
  );
}
