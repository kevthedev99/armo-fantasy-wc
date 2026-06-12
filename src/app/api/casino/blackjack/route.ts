import { NextResponse } from "next/server";
import {
  dealHand,
  doubleDown,
  getPayout,
  hit,
  stand,
  toClientView,
} from "@/lib/blackjack";
import {
  getBlackjackState,
  getOrResetCasinoBalance,
  saveCasinoSession,
  toBalanceState,
} from "@/lib/casino-balance";
import { validateBetAmount } from "@/lib/roulette";
import { createClient } from "@/lib/supabase/server";

type BlackjackAction = "deal" | "hit" | "stand" | "double";

function respondWithHand(
  balanceState: Awaited<ReturnType<typeof getOrResetCasinoBalance>>,
  hand: Parameters<typeof toClientView>[0]
) {
  const balance = balanceState.balance;
  const view = toClientView(hand, balance);
  const meta = toBalanceState(balanceState);
  return NextResponse.json({
    ...view,
    ...meta,
    fullPlayerHand: hand?.playerHand ?? [],
    fullDealerHand: hand?.dealerHand ?? [],
  });
}

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  try {
    const balanceState = await getOrResetCasinoBalance(user.id);
    const hand = await getBlackjackState(user.id);
    return respondWithHand(balanceState, hand);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
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
  const { action, amount } = body as {
    action?: BlackjackAction;
    amount?: number;
  };

  if (!action) {
    return NextResponse.json({ error: "Action required." }, { status: 400 });
  }

  try {
    const balanceState = await getOrResetCasinoBalance(user.id);
    let balance = balanceState.balance;
    let hand = await getBlackjackState(user.id);

    if (action === "deal") {
      if (hand?.status === "playing") {
        return NextResponse.json(
          { error: "Finish your current hand first." },
          { status: 400 }
        );
      }
      if (!amount) {
        return NextResponse.json({ error: "Bet amount required." }, { status: 400 });
      }

      const amountError = validateBetAmount(amount, balance);
      if (amountError) {
        return NextResponse.json({ error: amountError }, { status: 400 });
      }

      balance -= amount;
      hand = dealHand(amount);

      if (hand.status !== "playing") {
        balance += getPayout(hand);
        await saveCasinoSession(user.id, balance, null);
        const nextState = await getOrResetCasinoBalance(user.id);
        return respondWithHand(nextState, hand);
      }

      await saveCasinoSession(user.id, balance, hand);
      const nextState = await getOrResetCasinoBalance(user.id);
      return respondWithHand(nextState, hand);
    }

    if (!hand || hand.status !== "playing") {
      return NextResponse.json({ error: "No active hand." }, { status: 400 });
    }

    if (action === "double") {
      if (hand.playerHand.length !== 2 || hand.doubled) {
        return NextResponse.json({ error: "Cannot double down now." }, { status: 400 });
      }
      const amountError = validateBetAmount(hand.bet, balance);
      if (amountError) {
        return NextResponse.json({ error: "Not enough chips to double." }, { status: 400 });
      }
      balance -= hand.bet;
      hand = doubleDown(hand);
    } else if (action === "hit") {
      hand = hit(hand);
    } else if (action === "stand") {
      hand = stand(hand);
    } else {
      return NextResponse.json({ error: "Invalid action." }, { status: 400 });
    }

    if (hand.status !== "playing") {
      balance += getPayout(hand);
      await saveCasinoSession(user.id, balance, null);
      const nextState = await getOrResetCasinoBalance(user.id);
      return respondWithHand(nextState, hand);
    }

    await saveCasinoSession(user.id, balance, hand);
    const nextState = await getOrResetCasinoBalance(user.id);
    return respondWithHand(nextState, hand);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
