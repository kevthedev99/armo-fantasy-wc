"use client";

import { useEffect, useState } from "react";
import { CasinoBalanceBar } from "@/components/CasinoBalanceBar";
import { PlayingCard } from "@/components/PlayingCard";
import type { BlackjackClientView, Card } from "@/lib/blackjack";
import {
  animateDealerReveal,
  animateInitialDeal,
  displayFromView,
  sleep,
  type CardAnimKey,
  type TableDisplay,
} from "@/lib/blackjack-display";
import { handValue } from "@/lib/blackjack";
import type { BalanceState } from "@/lib/casino-types";

const CHIP_PRESETS = [5, 10, 25, 50, 100];

interface BlackjackPageProps {
  initialBalance: BalanceState;
  initialView: BlackjackClientView;
}

interface ApiResponse extends BlackjackClientView {
  balance: number;
  canPlay: boolean;
  fullPlayerHand: Card[];
  fullDealerHand: Card[];
}

function cardAnim(
  animKey: CardAnimKey,
  id: string,
  type: "deal" | "flip" = "deal"
): "deal" | "flip" | false {
  if (animKey === id) return type;
  return false;
}

export function BlackjackPage({
  initialBalance,
  initialView,
}: BlackjackPageProps) {
  const [balanceState, setBalanceState] = useState<BalanceState>(initialBalance);
  const [chipAmount, setChipAmount] = useState(25);
  const [customChip, setCustomChip] = useState("");
  const [view, setView] = useState<BlackjackClientView>(initialView);
  const [display, setDisplay] = useState<TableDisplay>(() =>
    displayFromView(
      initialView.playerHand,
      initialView.dealerHand,
      initialView.dealerHidden,
      initialView.playerTotal,
      initialView.dealerTotal
    )
  );
  const [animKey, setAnimKey] = useState<CardAnimKey>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeAmount =
    customChip !== "" ? Math.max(0, parseInt(customChip, 10) || 0) : chipAmount;

  useEffect(() => {
    const interval = setInterval(() => {
      void fetch("/api/casino/balance")
        .then((r) => r.json())
        .then((data) => {
          if (data.balance !== undefined) {
            setBalanceState((prev) => ({
              ...prev,
              balance: data.balance,
              canPlay: data.canPlay,
              resetIn: data.resetIn,
            }));
          }
        });
    }, 60_000);
    return () => clearInterval(interval);
  }, []);

  function applyStep(next: TableDisplay, key: CardAnimKey) {
    setDisplay(next);
    setAnimKey(key);
  }

  async function act(action: string, amount?: number) {
    setLoading(true);
    setError(null);

    const res = await fetch("/api/casino/blackjack", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, amount }),
    });

    const data = (await res.json()) as ApiResponse & { error?: string };

    if (!res.ok) {
      setLoading(false);
      setError(data.error ?? "Action failed.");
      return;
    }

    setBalanceState((prev) => ({
      ...prev,
      balance: data.balance,
      canPlay: data.canPlay,
    }));

    const player = data.fullPlayerHand;
    const dealer = data.fullDealerHand;
    const roundOver = data.status !== "playing";

    setIsAnimating(true);

    if (action === "deal") {
      await animateInitialDeal(player, dealer, applyStep);
      if (roundOver) {
        await animateDealerReveal(player, dealer, applyStep);
      }
    } else if (action === "hit") {
      const prevCount = display.playerHand.length;
      applyStep(
        {
          ...display,
          playerHand: player,
          playerTotal: handValue(player),
        },
        `p-${prevCount}`
      );
      await sleep(420);
      if (roundOver && data.status !== "bust") {
        await animateDealerReveal(player, dealer, applyStep);
      }
    } else if (action === "double") {
      applyStep(
        {
          ...display,
          playerHand: player,
          playerTotal: handValue(player),
        },
        `p-${player.length - 1}`
      );
      await sleep(420);
      await animateDealerReveal(player, dealer, applyStep);
    } else if (action === "stand") {
      await animateDealerReveal(player, dealer, applyStep);
    }

    setAnimKey(null);
    setIsAnimating(false);
    setLoading(false);
    setView(data);
    setDisplay(
      displayFromView(
        data.playerHand,
        data.dealerHand,
        data.dealerHidden,
        data.playerTotal,
        data.dealerTotal
      )
    );
  }

  const roundOver = view.status !== "playing" && view.playerHand.length > 0;
  const showBetting = view.canDeal && !loading && !isAnimating;
  const controlsDisabled = loading || isAnimating;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-8 text-center">
        <p className="text-xs font-bold tracking-[0.35em] text-[#FFD700]">
          SIDE LOUNGE
        </p>
        <h1 className="font-display mt-1 text-5xl text-white">BLACKJACK</h1>
        <p className="mt-2 text-sm text-gray-400">
          Free play only — not connected to your pick&apos;em standings.
        </p>
      </div>

      <CasinoBalanceBar balanceState={balanceState} />

      <div className="rounded-2xl border border-[#FFD700]/30 bg-gradient-to-b from-[#0d5c2e] to-[#0a4522] p-6 shadow-inner">
        <p className="mb-4 text-center text-[10px] font-bold uppercase tracking-[0.3em] text-[#FFD700]/70">
          Dealer
          {display.dealerTotal !== null && (
            <span className="ml-2 text-white">({display.dealerTotal})</span>
          )}
        </p>
        <div className="mb-10 flex min-h-[7rem] flex-wrap justify-center gap-2">
          {display.dealerHand.map((card, i) => (
            <PlayingCard
              key={`d-${i}-${card.rank}-${card.suit}`}
              card={card}
              animate={cardAnim(animKey, `d-${i}`, i === 1 ? "flip" : "deal")}
            />
          ))}
          {display.showDealerHole && (
            <PlayingCard
              key="d-hole"
              hidden
              animate={cardAnim(animKey, "d-hole", "deal")}
            />
          )}
          {display.dealerHand.length === 0 && !display.showDealerHole && (
            <p className="text-sm text-white/40">Waiting for deal…</p>
          )}
        </div>

        <div className="my-4 border-t border-white/10" />

        <p className="mb-4 text-center text-[10px] font-bold uppercase tracking-[0.3em] text-[#FFD700]/70">
          You
          {display.playerHand.length > 0 && (
            <span className="ml-2 text-white">({display.playerTotal})</span>
          )}
        </p>
        <div className="flex min-h-[7rem] flex-wrap justify-center gap-2">
          {display.playerHand.map((card, i) => (
            <PlayingCard
              key={`p-${i}-${card.rank}-${card.suit}`}
              card={card}
              animate={cardAnim(animKey, `p-${i}`)}
            />
          ))}
        </div>

        {view.message && !isAnimating && (
          <p
            className={`mt-6 text-center text-sm font-bold ${
              view.status === "win" || view.status === "blackjack"
                ? "text-[#32CD32]"
                : view.status === "push"
                  ? "text-[#FFD700]"
                  : view.status === "lose" || view.status === "bust"
                    ? "text-[#FF007A]"
                    : "text-white"
            }`}
          >
            {view.message}
            {view.bet > 0 && roundOver && (
              <span className="block text-xs font-normal text-gray-300">
                Wager: ${view.doubled ? view.bet * 2 : view.bet}
              </span>
            )}
          </p>
        )}
      </div>

      {showBetting && (
        <div className="mt-6 rounded-xl border border-white/10 bg-white/5 p-4">
          <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-gray-400">
            Bet amount
          </p>
          <div className="flex flex-wrap gap-2">
            {CHIP_PRESETS.map((n) => (
              <button
                key={n}
                type="button"
                disabled={!balanceState.canPlay}
                onClick={() => {
                  setChipAmount(n);
                  setCustomChip("");
                }}
                className={`rounded-full px-4 py-1.5 text-sm font-bold transition ${
                  chipAmount === n && customChip === ""
                    ? "bg-[#FFD700] text-black"
                    : "bg-black/50 text-white hover:bg-black/70"
                } disabled:opacity-40`}
              >
                ${n}
              </button>
            ))}
            <input
              type="number"
              min={1}
              placeholder="Custom"
              disabled={!balanceState.canPlay}
              value={customChip}
              onChange={(e) => setCustomChip(e.target.value)}
              className="w-20 rounded-full border border-white/10 bg-black/50 px-3 py-1.5 text-center text-sm text-white outline-none focus:border-[#FFD700]"
            />
          </div>
        </div>
      )}

      <div className="mt-6 flex flex-wrap justify-center gap-3">
        {view.canDeal && !isAnimating && (
          <button
            type="button"
            disabled={controlsDisabled || !balanceState.canPlay || activeAmount < 1}
            onClick={() => act("deal", activeAmount)}
            className="rounded-full bg-gradient-to-r from-[#FF007A] to-[#d4006a] px-8 py-3 text-sm font-black uppercase tracking-widest text-white shadow-[0_4px_24px_rgba(255,0,122,0.4)] transition hover:scale-[1.02] disabled:opacity-40"
          >
            {roundOver ? "Deal Again" : "Deal"}
          </button>
        )}
        {view.canHit && !isAnimating && (
          <button
            type="button"
            disabled={controlsDisabled}
            onClick={() => act("hit")}
            className="rounded-full bg-[#0056b3] px-6 py-3 text-sm font-black uppercase tracking-widest text-white hover:bg-[#0066cc] disabled:opacity-40"
          >
            Hit
          </button>
        )}
        {view.canStand && !isAnimating && (
          <button
            type="button"
            disabled={controlsDisabled}
            onClick={() => act("stand")}
            className="rounded-full border border-white/30 bg-black/40 px-6 py-3 text-sm font-black uppercase tracking-widest text-white hover:bg-black/60 disabled:opacity-40"
          >
            Stand
          </button>
        )}
        {view.canDouble && !isAnimating && (
          <button
            type="button"
            disabled={controlsDisabled}
            onClick={() => act("double")}
            className="rounded-full bg-[#FFD700] px-6 py-3 text-sm font-black uppercase tracking-widest text-black hover:bg-[#ffe44d] disabled:opacity-40"
          >
            Double
          </button>
        )}
      </div>

      {error && (
        <p className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-center text-sm text-red-300">
          {error}
        </p>
      )}

      {!balanceState.canPlay && (
        <p className="mt-4 rounded-lg border border-[#FF007A]/30 bg-[#FF007A]/10 px-3 py-2 text-center text-sm text-[#FF007A]">
          You&apos;re out of chips! Fresh ${balanceState.dailyAllowance} drops at
          midnight Eastern.
        </p>
      )}

      <div className="mt-10 rounded-xl border border-white/10 bg-white/[0.03] p-6">
        <h2 className="font-display text-2xl tracking-wide text-[#FFD700]">
          HOW TO PLAY
        </h2>
        <p className="mt-2 text-xs text-gray-500">
          Play-money side lounge — does not affect pick&apos;em scores or the $25
          buy-in pool.
        </p>
        <ul className="mt-4 space-y-2 text-sm text-gray-300">
          <li>
            <span className="font-bold text-white">Goal:</span> Beat the dealer
            without going over 21.
          </li>
          <li>
            <span className="font-bold text-white">Card values:</span> Number
            cards = face value. Face cards = 10. Aces = 1 or 11 (whichever helps
            you).
          </li>
          <li>
            <span className="font-bold text-white">Blackjack:</span> Ace + 10-value
            card on your first two cards pays{" "}
            <span className="text-[#FFD700]">3:2</span>.
          </li>
          <li>
            <span className="font-bold text-white">Hit:</span> Take another card.
          </li>
          <li>
            <span className="font-bold text-white">Stand:</span> Keep your hand —
            dealer plays.
          </li>
          <li>
            <span className="font-bold text-white">Double down:</span> Double your
            bet, take exactly one more card, then stand.
          </li>
          <li>
            <span className="font-bold text-white">Dealer:</span> Must hit on 16
            or less, stand on 17 or more.
          </li>
          <li>
            <span className="font-bold text-white">Win:</span> Pays 1:1. Push =
            tie, bet returned.
          </li>
          <li>
            <span className="font-bold text-white">Chips:</span> $
            {balanceState.dailyAllowance} free play per day, shared with Roulette.
            Resets at midnight Eastern.
          </li>
        </ul>
      </div>

      <p className="mt-6 text-center text-[10px] uppercase tracking-wider text-gray-600">
        Play money only · No real gambling
      </p>
    </div>
  );
}
