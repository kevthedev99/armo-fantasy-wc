"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CasinoBalanceBar } from "@/components/CasinoBalanceBar";
import { CasinoWinPopup } from "@/components/CasinoWinPopup";
import { RouletteWheel } from "@/components/RouletteWheel";
import { getNextWheelRotation } from "@/lib/roulette";
import type { BalanceState } from "@/lib/casino-types";
import {
  TABLE_NUMBERS,
  formatRouletteValue,
  getRouletteColor,
  rouletteBetKey,
  type RouletteBet,
  type RoulettePlacedBet,
  type RouletteValue,
} from "@/lib/roulette";

const CHIP_PRESETS = [5, 10, 25, 50, 100];

interface RoulettePageProps {
  initialBalance: BalanceState;
}

interface SpinResult {
  result: RouletteValue;
  resultLabel: string;
  color: "red" | "black" | "green";
  wheelIndex: number;
  won: boolean;
  profit: number;
  payout: number;
  totalWager: number;
  balance: number;
  canPlay: boolean;
}

function betLabel(bet: RouletteBet): string {
  if (bet.type === "straight") return `#${formatRouletteValue(bet.value)}`;
  if (bet.type === "dozen")
    return `${bet.dozen === 1 ? "1st" : bet.dozen === 2 ? "2nd" : "3rd"} 12`;
  return bet.type.toUpperCase();
}

function numberCellClass(value: number, selected: boolean): string {
  const color = getRouletteColor(value);
  const base =
    color === "red"
      ? "bg-[#c41e3a] hover:bg-[#d42a46]"
      : "bg-[#1a1a1a] hover:bg-[#2a2a2a]";
  return `${base} ${selected ? "ring-2 ring-[#FFD700] ring-offset-2 ring-offset-[#0d2818]" : ""}`;
}

function ChipBadge({ amount }: { amount: number }) {
  return (
    <span className="absolute -right-1 -top-1 z-10 flex h-6 min-w-6 items-center justify-center rounded-full border-2 border-[#0d2818] bg-[#FFD700] px-1 text-[10px] font-black text-black shadow-md">
      ${amount}
    </span>
  );
}

export function RoulettePage({ initialBalance }: RoulettePageProps) {
  const [balanceState, setBalanceState] = useState<BalanceState>(initialBalance);
  const [chipAmount, setChipAmount] = useState(25);
  const [customChip, setCustomChip] = useState("");
  const [placedBets, setPlacedBets] = useState<RoulettePlacedBet[]>([]);
  const [spinning, setSpinning] = useState(false);
  const [wheelRotation, setWheelRotation] = useState(0);
  const [wheelAnimating, setWheelAnimating] = useState(false);
  const [lastResult, setLastResult] = useState<SpinResult | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<SpinResult[]>([]);
  const [winPopup, setWinPopup] = useState<{
    amount: number;
    subtitle?: string;
  } | null>(null);
  const pendingResult = useRef<SpinResult | null>(null);

  const activeAmount =
    customChip !== "" ? Math.max(0, parseInt(customChip, 10) || 0) : chipAmount;

  const totalWager = useMemo(
    () => placedBets.reduce((sum, b) => sum + b.amount, 0),
    [placedBets]
  );

  const betAmountByKey = useMemo(() => {
    const map = new Map<string, number>();
    for (const { bet, amount } of placedBets) {
      map.set(rouletteBetKey(bet), amount);
    }
    return map;
  }, [placedBets]);

  const loadBalance = useCallback(async () => {
    const res = await fetch("/api/casino/balance");
    const data = await res.json();
    if (res.ok) {
      setBalanceState({
        balance: data.balance,
        canPlay: data.canPlay,
        resetIn: data.resetIn,
        dailyAllowance: data.dailyAllowance,
      });
    }
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      void loadBalance();
    }, 60_000);
    return () => clearInterval(interval);
  }, [loadBalance]);

  function toggleBet(bet: RouletteBet) {
    const key = rouletteBetKey(bet);
    setPlacedBets((current) => {
      const existing = current.find((b) => rouletteBetKey(b.bet) === key);
      if (existing) {
        return current.filter((b) => rouletteBetKey(b.bet) !== key);
      }
      return [...current, { bet, amount: activeAmount }];
    });
    setError(null);
  }

  function isBetSelected(bet: RouletteBet): boolean {
    return betAmountByKey.has(rouletteBetKey(bet));
  }

  function getPlacedAmount(bet: RouletteBet): number | undefined {
    return betAmountByKey.get(rouletteBetKey(bet));
  }

  function clearBets() {
    setPlacedBets([]);
    setError(null);
  }

  async function handleSpin() {
    if (placedBets.length === 0 || spinning || !balanceState.canPlay) return;
    if (activeAmount < 1) {
      setError("Pick a chip amount of at least $1.");
      return;
    }
    if (totalWager > balanceState.balance) {
      setError("Not enough chips for those bets.");
      return;
    }

    setError(null);
    setMessage(null);
    setSpinning(true);
    setLastResult(null);

    const res = await fetch("/api/casino/spin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bets: placedBets }),
    });

    const data = await res.json();

    if (!res.ok) {
      setSpinning(false);
      setError(data.error ?? "Spin failed.");
      return;
    }

    pendingResult.current = data;
    setLastResult(data);
    setWheelRotation((r) => getNextWheelRotation(r, data.wheelIndex));
    setWheelAnimating(true);
    setPlacedBets([]);
    setBalanceState((prev) => ({
      ...prev,
      balance: data.balance,
      canPlay: data.canPlay,
    }));
  }

  function handleSpinEnd() {
    setSpinning(false);
    setWheelAnimating(false);
    const result = pendingResult.current;
    if (result) {
      setHistory((h) => [result, ...h].slice(0, 8));
      setMessage(
        result.won
          ? `Winner! +$${result.profit} on ${result.resultLabel}`
          : `Ball landed on ${result.resultLabel}. Better luck next spin.`
      );
      if (result.won && result.profit > 0) {
        setWinPopup({
          amount: result.profit,
          subtitle: `Landed on ${result.resultLabel}`,
        });
      }
      pendingResult.current = null;
    }
  }

  const disabled = spinning || !balanceState.canPlay;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      {winPopup && (
        <CasinoWinPopup
          amount={winPopup.amount}
          subtitle={winPopup.subtitle}
          onClose={() => setWinPopup(null)}
        />
      )}
      <div className="mb-8 text-center">
        <p className="text-xs font-bold tracking-[0.35em] text-[#FFD700]">
          SIDE LOUNGE
        </p>
        <h1 className="font-display mt-1 text-5xl text-white">ROULETTE</h1>
        <p className="mt-2 text-sm text-gray-400">
          Free play only — not connected to your pick&apos;em standings. Tap
          multiple spots, then spin.
        </p>
      </div>

      <CasinoBalanceBar balanceState={balanceState} />

      <div className="grid gap-8 xl:grid-cols-[360px_1fr]">
        <div className="flex flex-col items-center gap-4">
          <RouletteWheel
            rotation={wheelRotation}
            animating={wheelAnimating}
            onSpinEnd={handleSpinEnd}
          />

          {lastResult && !spinning && (
            <div
              className={`rounded-full px-6 py-2 text-center text-lg font-black uppercase tracking-wider ${
                lastResult.color === "red"
                  ? "bg-[#c41e3a] text-white"
                  : lastResult.color === "black"
                    ? "bg-[#1a1a1a] text-white ring-1 ring-white/20"
                    : "bg-[#0d5c2e] text-[#FFD700]"
              }`}
            >
              {lastResult.resultLabel}
            </div>
          )}

          {message && (
            <p
              className={`text-center text-sm font-bold ${
                lastResult?.won ? "text-[#32CD32]" : "text-gray-400"
              }`}
            >
              {message}
            </p>
          )}
        </div>

        <div className="space-y-5">
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-gray-400">
              Chip value
            </p>
            <div className="flex flex-wrap gap-2">
              {CHIP_PRESETS.map((n) => (
                <button
                  key={n}
                  type="button"
                  disabled={disabled}
                  onClick={() => {
                    setChipAmount(n);
                    setCustomChip("");
                  }}
                  className={`rounded-full px-4 py-2 text-sm font-bold transition ${
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
                max={500}
                placeholder="Custom"
                disabled={disabled}
                value={customChip}
                onChange={(e) => setCustomChip(e.target.value)}
                className="w-24 rounded-full border border-white/10 bg-black/50 px-3 py-2 text-center text-sm text-white outline-none focus:border-[#FFD700]"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
            {(
              [
                { type: "red" as const, label: "Red", className: "bg-[#c41e3a]" },
                { type: "black" as const, label: "Black", className: "bg-[#1a1a1a]" },
                { type: "even" as const, label: "Even", className: "bg-[#0d2818]" },
                { type: "odd" as const, label: "Odd", className: "bg-[#0d2818]" },
                { type: "low" as const, label: "1–18", className: "bg-[#0d2818]" },
                { type: "high" as const, label: "19–36", className: "bg-[#0d2818]" },
              ] as const
            ).map((b) => {
              const bet: RouletteBet = { type: b.type };
              const amount = getPlacedAmount(bet);
              return (
                <button
                  key={b.type}
                  type="button"
                  disabled={disabled}
                  onClick={() => toggleBet(bet)}
                  className={`relative rounded-lg py-3 text-sm font-bold uppercase text-white transition hover:brightness-110 disabled:opacity-40 ${b.className} ${
                    isBetSelected(bet) ? "ring-2 ring-[#FFD700]" : ""
                  }`}
                >
                  {b.label}
                  {amount != null && (
                    <span className="mt-1 block text-[10px] text-[#FFD700]">
                      ${amount}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="grid grid-cols-3 gap-2">
            {([1, 2, 3] as const).map((d) => {
              const bet: RouletteBet = { type: "dozen", dozen: d };
              const amount = getPlacedAmount(bet);
              return (
                <button
                  key={d}
                  type="button"
                  disabled={disabled}
                  onClick={() => toggleBet(bet)}
                  className={`relative rounded-lg bg-[#0056b3] py-3 text-sm font-bold text-white hover:bg-[#0066cc] disabled:opacity-40 ${
                    isBetSelected(bet) ? "ring-2 ring-[#FFD700]" : ""
                  }`}
                >
                  {d === 1 ? "1st 12" : d === 2 ? "2nd 12" : "3rd 12"}
                  {amount != null && (
                    <span className="mt-1 block text-[10px] text-[#FFD700]">
                      ${amount}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="overflow-x-auto rounded-xl border-2 border-[#FFD700]/50 bg-[#0d2818] p-3 md:p-4">
            <div className="flex min-w-[560px] gap-2">
              <div className="flex w-16 shrink-0 flex-col gap-2">
                {(["0", "00"] as const).map((z) => {
                  const val: RouletteValue = z === "0" ? 0 : "00";
                  const bet: RouletteBet = { type: "straight", value: val };
                  const amount = getPlacedAmount(bet);
                  return (
                    <button
                      key={z}
                      type="button"
                      disabled={disabled}
                      onClick={() => toggleBet(bet)}
                      className={`relative flex-1 rounded-lg bg-[#0d5c2e] py-4 text-base font-bold text-white hover:bg-[#117a3d] disabled:opacity-40 ${
                        isBetSelected(bet) ? "ring-2 ring-[#FFD700]" : ""
                      }`}
                    >
                      {z}
                      {amount != null && <ChipBadge amount={amount} />}
                    </button>
                  );
                })}
              </div>
              <div className="flex flex-1 flex-col gap-2">
                {TABLE_NUMBERS.map((row, ri) => (
                  <div key={ri} className="flex flex-1 gap-2">
                    {row.map((n) => {
                      const bet: RouletteBet = { type: "straight", value: n };
                      const amount = getPlacedAmount(bet);
                      return (
                        <button
                          key={n}
                          type="button"
                          disabled={disabled}
                          onClick={() => toggleBet(bet)}
                          className={`relative flex-1 rounded-lg py-3 text-sm font-bold text-white md:py-4 md:text-base disabled:opacity-40 ${numberCellClass(
                            n,
                            isBetSelected(bet)
                          )}`}
                        >
                          {n}
                          {amount != null && <ChipBadge amount={amount} />}
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm text-gray-400">
              {placedBets.length > 0 ? (
                <>
                  <span className="font-bold text-[#FFD700]">
                    {placedBets.length} bet{placedBets.length !== 1 ? "s" : ""}
                  </span>{" "}
                  · Total wager{" "}
                  <span className="font-bold text-white">${totalWager}</span>
                  <span className="mt-1 block text-xs text-gray-500">
                    {placedBets.map((b) => `${betLabel(b.bet)} $${b.amount}`).join(" · ")}
                  </span>
                </>
              ) : (
                "Tap bets on the table — multiple allowed"
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {placedBets.length > 0 && (
                <button
                  type="button"
                  disabled={disabled}
                  onClick={clearBets}
                  className="rounded-full border border-white/20 px-5 py-3 text-xs font-bold uppercase tracking-wide text-gray-300 transition hover:bg-white/5 disabled:opacity-40"
                >
                  Clear bets
                </button>
              )}
              <button
                type="button"
                disabled={
                  disabled || placedBets.length === 0 || totalWager < 1
                }
                onClick={handleSpin}
                className="rounded-full bg-gradient-to-r from-[#FF007A] to-[#d4006a] px-8 py-3 text-sm font-black uppercase tracking-widest text-white shadow-[0_4px_24px_rgba(255,0,122,0.4)] transition hover:scale-[1.02] disabled:opacity-40 disabled:hover:scale-100"
              >
                {spinning ? "Spinning…" : "Spin"}
              </button>
            </div>
          </div>

          {error && (
            <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-center text-sm text-red-300">
              {error}
            </p>
          )}

          {!balanceState.canPlay && (
            <p className="rounded-lg border border-[#FF007A]/30 bg-[#FF007A]/10 px-3 py-2 text-center text-sm text-[#FF007A]">
              You&apos;re busted! Fresh ${balanceState.dailyAllowance} chips drop
              at midnight Eastern.
            </p>
          )}
        </div>
      </div>

      {history.length > 0 && (
        <div className="mt-10">
          <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-gray-500">
            Recent spins
          </p>
          <div className="flex flex-wrap gap-2">
            {history.map((h, i) => (
              <span
                key={i}
                className={`rounded-full px-3 py-1 text-xs font-bold ${
                  h.color === "red"
                    ? "bg-[#c41e3a] text-white"
                    : h.color === "black"
                      ? "bg-[#1a1a1a] text-white"
                      : "bg-[#0d5c2e] text-[#FFD700]"
                }`}
              >
                {h.resultLabel}
                {h.won ? " ✓" : ""}
              </span>
            ))}
          </div>
        </div>
      )}

      <p className="mt-8 text-center text-[10px] uppercase tracking-wider text-gray-600">
        Play money only · No real gambling · For fun between matches
      </p>
    </div>
  );
}
