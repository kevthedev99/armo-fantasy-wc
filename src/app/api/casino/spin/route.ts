import { NextResponse } from "next/server";
import {
  DAILY_FREE_PLAY,
  getOrResetCasinoBalance,
  toBalanceState,
  updateCasinoBalance,
} from "@/lib/casino-balance";
import {
  evaluateRouletteBets,
  formatRouletteValue,
  rouletteBetKey,
  spinRoulette,
  validateRouletteBets,
  type RouletteBet,
  type RoulettePlacedBet,
} from "@/lib/roulette";
import { createClient } from "@/lib/supabase/server";

function normalizeBets(body: {
  amount?: number;
  bet?: RouletteBet;
  bets?: RoulettePlacedBet[];
}): RoulettePlacedBet[] | null {
  if (Array.isArray(body.bets) && body.bets.length > 0) {
    return body.bets;
  }
  if (body.amount && body.bet) {
    return [{ amount: body.amount, bet: body.bet }];
  }
  return null;
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const body = await request.json();
  const bets = normalizeBets(body);

  if (!bets) {
    return NextResponse.json({ error: "At least one bet is required." }, {
      status: 400,
    });
  }

  try {
    const state = await getOrResetCasinoBalance(user.id);

    if (state.balance <= 0) {
      const meta = toBalanceState(state);
      return NextResponse.json(
        {
          error: `You're out of chips. $${DAILY_FREE_PLAY} returns in ${meta.resetIn}.`,
        },
        { status: 403 }
      );
    }

    const betsError = validateRouletteBets(bets, state.balance);
    if (betsError) {
      return NextResponse.json({ error: betsError }, { status: 400 });
    }

    const spin = spinRoulette();
    const { totalWager, totalPayout, outcomes } = evaluateRouletteBets(
      bets,
      spin.value
    );
    const newBalance = state.balance - totalWager + totalPayout;

    const balance = await updateCasinoBalance(user.id, newBalance);

    const winningOutcomes = outcomes.filter((o) => o.won);

    return NextResponse.json({
      result: spin.value,
      resultLabel: formatRouletteValue(spin.value),
      color: spin.color,
      wheelIndex: spin.wheelIndex,
      won: winningOutcomes.length > 0,
      profit: totalPayout - totalWager,
      payout: totalPayout,
      totalWager,
      outcomes: outcomes.map((o) => ({
        betKey: rouletteBetKey(o.bet),
        amount: o.amount,
        won: o.won,
        payout: o.payout,
      })),
      balance,
      canPlay: balance > 0,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
