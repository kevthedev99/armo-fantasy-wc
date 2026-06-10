import type { BalanceState } from "@/lib/casino-types";

interface CasinoBalanceBarProps {
  balanceState: BalanceState;
}

export function CasinoBalanceBar({ balanceState }: CasinoBalanceBarProps) {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-[#FFD700]/30 bg-[#0d2818]/80 px-5 py-4">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
          Your chips
        </p>
        <p className="font-display text-4xl text-[#FFD700]">
          ${balanceState.balance.toLocaleString()}
        </p>
      </div>
      <div className="text-right text-sm text-gray-400">
        <p>
          <span className="text-white">${balanceState.dailyAllowance}</span> free
          play daily
        </p>
        <p className="text-xs text-gray-500">Shared across Roulette & Blackjack</p>
        {!balanceState.canPlay && (
          <p className="mt-1 text-[#FF007A]">
            Resets in {balanceState.resetIn} (midnight ET)
          </p>
        )}
      </div>
    </div>
  );
}
