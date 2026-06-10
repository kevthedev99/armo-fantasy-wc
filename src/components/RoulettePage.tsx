"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { RouletteWheel, rotationForWheelIndex } from "@/components/RouletteWheel";
import {
  TABLE_NUMBERS,
  formatRouletteValue,
  getRouletteColor,
  type RouletteBet,
  type RouletteValue,
} from "@/lib/roulette";

const CHIP_PRESETS = [5, 10, 25, 50, 100];

export interface BalanceState {
  balance: number;
  canPlay: boolean;
  resetIn: string;
  dailyAllowance: number;
}

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
  balance: number;
  canPlay: boolean;
}

function betLabel(bet: RouletteBet): string {
  if (bet.type === "straight") return `#${formatRouletteValue(bet.value)}`;
  if (bet.type === "dozen") return `${bet.dozen === 1 ? "1st" : bet.dozen === 2 ? "2nd" : "3rd"} 12`;
  return bet.type.toUpperCase();
}

function numberCellClass(value: number, selected: boolean): string {
  const color = getRouletteColor(value);
  const base =
    color === "red"
      ? "bg-[#c41e3a] hover:bg-[#d42a46]"
      : "bg-[#1a1a1a] hover:bg-[#2a2a2a]";
  return `${base} ${selected ? "ring-2 ring-[#FFD700] ring-offset-1 ring-offset-[#0d2818]" : ""}`;
}

export function RoulettePage({ initialBalance }: RoulettePageProps) {
  const [balanceState, setBalanceState] = useState<BalanceState>(initialBalance);
  const [chipAmount, setChipAmount] = useState(25);
  const [customChip, setCustomChip] = useState("");
  const [selectedBet, setSelectedBet] = useState<RouletteBet | null>(null);
  const [spinning, setSpinning] = useState(false);
  const [wheelRotation, setWheelRotation] = useState(0);
  const [wheelAnimating, setWheelAnimating] = useState(false);
  const [lastResult, setLastResult] = useState<SpinResult | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<SpinResult[]>([]);
  const pendingResult = useRef<SpinResult | null>(null);

  const activeAmount =
    customChip !== "" ? Math.max(0, parseInt(customChip, 10) || 0) : chipAmount;

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

  async function handleSpin() {
    if (!selectedBet || spinning || !balanceState.canPlay) return;
    if (activeAmount < 1) {
      setError("Pick a chip amount of at least $1.");
      return;
    }

    setError(null);
    setMessage(null);
    setSpinning(true);
    setLastResult(null);

    const res = await fetch("/api/casino/spin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount: activeAmount, bet: selectedBet }),
    });

    const data = await res.json();

    if (!res.ok) {
      setSpinning(false);
      setError(data.error ?? "Spin failed.");
      return;
    }

    pendingResult.current = data;
    setLastResult(data);
    setWheelRotation((r) => r + rotationForWheelIndex(data.wheelIndex));
    setWheelAnimating(true);
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
      pendingResult.current = null;
    }
  }

  const disabled = spinning || !balanceState.canPlay;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      {/* Header */}
      <div className="mb-8 text-center">
        <p className="text-xs font-bold tracking-[0.35em] text-[#FFD700]">
          SIDE LOUNGE
        </p>
        <h1 className="font-display mt-1 text-5xl text-white">ROULETTE</h1>
        <p className="mt-2 text-sm text-gray-400">
          Free play only — not connected to your pick&apos;em standings.
        </p>
      </div>

      {/* Balance bar */}
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
            <span className="text-white">${balanceState.dailyAllowance}</span>{" "}
            free play daily
          </p>
          {!balanceState.canPlay && (
            <p className="mt-1 text-[#FF007A]">
              Resets in {balanceState.resetIn} (midnight ET)
            </p>
          )}
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        {/* Wheel */}
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

        {/* Betting table */}
        <div className="space-y-4">
          {/* Chip selector */}
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
                max={500}
                placeholder="Custom"
                disabled={disabled}
                value={customChip}
                onChange={(e) => setCustomChip(e.target.value)}
                className="w-20 rounded-full border border-white/10 bg-black/50 px-3 py-1.5 text-center text-sm text-white outline-none focus:border-[#FFD700]"
              />
            </div>
          </div>

          {/* Outside bets */}
          <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-6">
            {(
              [
                { type: "red" as const, label: "Red", className: "bg-[#c41e3a]" },
                { type: "black" as const, label: "Black", className: "bg-[#1a1a1a]" },
                { type: "even" as const, label: "Even", className: "bg-[#0d2818]" },
                { type: "odd" as const, label: "Odd", className: "bg-[#0d2818]" },
                { type: "low" as const, label: "1–18", className: "bg-[#0d2818]" },
                { type: "high" as const, label: "19–36", className: "bg-[#0d2818]" },
              ] as const
            ).map((b) => (
              <button
                key={b.type}
                type="button"
                disabled={disabled}
                onClick={() => setSelectedBet({ type: b.type })}
                className={`rounded-lg py-2 text-xs font-bold uppercase text-white transition hover:brightness-110 disabled:opacity-40 ${b.className} ${
                  selectedBet?.type === b.type
                    ? "ring-2 ring-[#FFD700]"
                    : ""
                }`}
              >
                {b.label}
              </button>
            ))}
          </div>

          {/* Dozens */}
          <div className="grid grid-cols-3 gap-1.5">
            {([1, 2, 3] as const).map((d) => (
              <button
                key={d}
                type="button"
                disabled={disabled}
                onClick={() => setSelectedBet({ type: "dozen", dozen: d })}
                className={`rounded-lg bg-[#0056b3] py-2 text-xs font-bold text-white hover:bg-[#0066cc] disabled:opacity-40 ${
                  selectedBet?.type === "dozen" && selectedBet.dozen === d
                    ? "ring-2 ring-[#FFD700]"
                    : ""
                }`}
              >
                {d === 1 ? "1st 12" : d === 2 ? "2nd 12" : "3rd 12"}
              </button>
            ))}
          </div>

          {/* Number grid */}
          <div className="overflow-x-auto rounded-xl border-2 border-[#FFD700]/40 bg-[#0d2818] p-2">
            <div className="flex min-w-[280px] gap-1">
              <div className="flex w-10 shrink-0 flex-col gap-1">
                {(["0", "00"] as const).map((z) => {
                  const val: RouletteValue = z === "0" ? 0 : "00";
                  const selected =
                    selectedBet?.type === "straight" &&
                    selectedBet.value === val;
                  return (
                    <button
                      key={z}
                      type="button"
                      disabled={disabled}
                      onClick={() =>
                        setSelectedBet({ type: "straight", value: val })
                      }
                      className={`flex-1 rounded bg-[#0d5c2e] text-xs font-bold text-white hover:bg-[#117a3d] disabled:opacity-40 ${
                        selected ? "ring-2 ring-[#FFD700]" : ""
                      }`}
                    >
                      {z}
                    </button>
                  );
                })}
              </div>
              <div className="flex flex-1 flex-col gap-1">
                {TABLE_NUMBERS.map((row, ri) => (
                  <div key={ri} className="flex flex-1 gap-1">
                    {row.map((n) => (
                      <button
                        key={n}
                        type="button"
                        disabled={disabled}
                        onClick={() =>
                          setSelectedBet({ type: "straight", value: n })
                        }
                        className={`flex-1 rounded py-2 text-xs font-bold text-white disabled:opacity-40 ${numberCellClass(
                          n,
                          selectedBet?.type === "straight" &&
                            selectedBet.value === n
                        )}`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Selected bet + spin */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-gray-400">
              {selectedBet ? (
                <>
                  Betting{" "}
                  <span className="font-bold text-[#FFD700]">
                    ${activeAmount}
                  </span>{" "}
                  on{" "}
                  <span className="font-bold text-white">
                    {betLabel(selectedBet)}
                  </span>
                </>
              ) : (
                "Tap a bet on the table"
              )}
            </p>
            <button
              type="button"
              disabled={disabled || !selectedBet || activeAmount < 1}
              onClick={handleSpin}
              className="rounded-full bg-gradient-to-r from-[#FF007A] to-[#d4006a] px-8 py-3 text-sm font-black uppercase tracking-widest text-white shadow-[0_4px_24px_rgba(255,0,122,0.4)] transition hover:scale-[1.02] disabled:opacity-40 disabled:hover:scale-100"
            >
              {spinning ? "Spinning…" : "Spin"}
            </button>
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

      {/* History */}
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
