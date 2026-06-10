"use client";

import { useEffect } from "react";
import type { BlackjackClientView } from "@/lib/blackjack";

interface CasinoWinPopupProps {
  amount: number;
  subtitle?: string;
  onClose: () => void;
}

export function getBlackjackWinProfit(view: BlackjackClientView): number | null {
  if (view.status !== "win" && view.status !== "blackjack") return null;
  const wager = view.doubled ? view.bet * 2 : view.bet;
  if (wager <= 0) return null;
  if (view.status === "blackjack") {
    return Math.floor(wager * 2.5) - wager;
  }
  return wager;
}

export function CasinoWinPopup({
  amount,
  subtitle,
  onClose,
}: CasinoWinPopupProps) {
  useEffect(() => {
    const timer = window.setTimeout(onClose, 2600);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div
      className="casino-win-backdrop fixed inset-0 z-50 flex items-center justify-center p-4"
      role="status"
      aria-live="polite"
      onClick={onClose}
    >
      <div
        className="casino-win-card relative w-full max-w-sm overflow-hidden rounded-2xl border-2 border-[#FFD700] bg-gradient-to-b from-[#1a1a1a] to-black px-8 py-10 text-center shadow-[0_0_60px_rgba(255,215,0,0.35)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="casino-win-sparkle pointer-events-none absolute inset-0" aria-hidden />
        <p className="relative text-xs font-black uppercase tracking-[0.4em] text-[#FFD700]">
          You won!
        </p>
        <p className="relative mt-3 font-display text-6xl leading-none text-[#32CD32] md:text-7xl">
          +${amount}
        </p>
        {subtitle && (
          <p className="relative mt-4 text-sm text-gray-400">{subtitle}</p>
        )}
      </div>
    </div>
  );
}
