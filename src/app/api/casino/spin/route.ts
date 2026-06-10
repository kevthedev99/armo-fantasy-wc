import { NextResponse } from "next/server";
import { getCasinoDay } from "@/lib/casino-day";
import {
  getOrResetCasinoBalance,
  updateCasinoBalance,
} from "@/lib/casino-balance";
import {
  evaluateRouletteBet,
  formatRouletteValue,
  spinRoulette,
  validateBetAmount,
  validateRouletteBet,
  type RouletteBet,
} from "@/lib/roulette";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const body = await request.json();
  const { amount, bet } = body as { amount?: number; bet?: RouletteBet };

  if (!amount || !bet) {
    return NextResponse.json({ error: "Bet amount and type required." }, { status: 400 });
  }

  const betError = validateRouletteBet(bet);
  if (betError) {
    return NextResponse.json({ error: betError }, { status: 400 });
  }

  try {
    const state = await getOrResetCasinoBalance(user.id);
    const amountError = validateBetAmount(amount, state.balance);
    if (amountError) {
      return NextResponse.json({ error: amountError }, { status: 400 });
    }

    if (state.balance <= 0) {
      return NextResponse.json(
        { error: "You're out of chips. Come back at midnight for $500 free play." },
        { status: 403 }
      );
    }

    const spin = spinRoulette();
    const { won, payout } = evaluateRouletteBet(bet, spin.value, amount);
    const newBalance = state.balance - amount + payout;

    const balance = await updateCasinoBalance(
      user.id,
      newBalance,
      getCasinoDay()
    );

    return NextResponse.json({
      result: spin.value,
      resultLabel: formatRouletteValue(spin.value),
      color: spin.color,
      wheelIndex: spin.wheelIndex,
      won,
      profit: won ? payout - amount : -amount,
      payout,
      balance,
      canPlay: balance > 0,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
