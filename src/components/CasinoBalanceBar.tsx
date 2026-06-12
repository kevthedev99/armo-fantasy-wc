import type { BalanceState } from "@/lib/casino-types";

interface CasinoBalanceBarProps {
  balanceState: BalanceState;
}

export function CasinoBalanceBar({ balanceState }: CasinoBalanceBarProps) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#FFD700]/30 bg-[#0d2818]/80 px-4 py-3 sm:mb-6 sm:gap-4 sm:px-5 sm:py-4">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
          Your chips
        </p>
        <p className="font-display text-3xl text-[#FFD700] sm:text-4xl">
          ${balanceState.balance.toLocaleString()}
        </p>
      </div>
      <div className="text-right text-xs text-gray-400 sm:text-sm">
        <p>
          <span className="text-white">${balanceState.dailyAllowance}</span> refill
          after bust
        </p>
        <p className="text-xs text-gray-500">
          Chips carry over while you&apos;re above $0
        </p>
        {!balanceState.canPlay && balanceState.resetIn && (
          <p className="mt-1 text-[#FF007A]">
            ${balanceState.dailyAllowance} returns in {balanceState.resetIn}
          </p>
        )}
      </div>
    </div>
  );
}
