"use client";

import { useEffect, useRef, useState } from "react";

const BUY_IN = 25;

function formatPot(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(amount);
}

interface PotDisplayProps {
  playerCount: number;
}

export function PotDisplay({ playerCount }: PotDisplayProps) {
  const targetPot = playerCount * BUY_IN;
  const [displayPot, setDisplayPot] = useState(0);
  const [pulse, setPulse] = useState(false);
  const fromRef = useRef(0);

  useEffect(() => {
    const from = fromRef.current;
    const to = targetPot;
    if (from === to) return;

    const duration = 1400;
    const start = performance.now();
    let frame = 0;

    const tick = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayPot(Math.round(from + (to - from) * eased));

      if (progress < 1) {
        frame = requestAnimationFrame(tick);
      } else {
        fromRef.current = to;
        if (from !== to) {
          setPulse(true);
          window.setTimeout(() => setPulse(false), 700);
        }
      }
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [targetPot]);

  return (
    <p
      className={`pot-display mt-6 text-7xl font-black md:text-9xl ${
        pulse ? "pot-pulse" : ""
      }`}
      aria-label={`Prize pool ${formatPot(targetPot)} from ${playerCount} players`}
    >
      {formatPot(displayPot)}
    </p>
  );
}
