"use client";

import {
  WHEEL_SEGMENT_ANGLE,
  WHEEL_SLOTS,
  formatRouletteValue,
  getRouletteColor,
} from "@/lib/roulette";

const COLOR_FILL = {
  red: "#c41e3a",
  black: "#1a1a1a",
  green: "#0d5c2e",
};

interface RouletteWheelProps {
  rotation: number;
  animating: boolean;
  onSpinEnd?: () => void;
}

export function RouletteWheel({
  rotation,
  animating,
  onSpinEnd,
}: RouletteWheelProps) {
  function handleTransitionEnd() {
    if (animating) {
      onSpinEnd?.();
    }
  }

  return (
    <div className="relative mx-auto aspect-square w-full max-w-[320px] sm:max-w-[380px]">
      <div className="absolute inset-0 rounded-full bg-gradient-to-br from-[#FFD700] via-[#b8860b] to-[#FFD700] p-2 shadow-[0_0_40px_rgba(255,215,0,0.35)]">
        <div className="relative h-full w-full rounded-full bg-[#2a1810] p-1">
          <div className="absolute top-0 left-1/2 z-20 -translate-x-1/2 -translate-y-1">
            <div className="h-0 w-0 border-x-[10px] border-t-[18px] border-x-transparent border-t-[#FFD700] drop-shadow-md" />
          </div>

          <svg
            viewBox="0 0 200 200"
            className="h-full w-full"
            style={{
              transform: `rotate(${rotation}deg)`,
              transition: animating
                ? "transform 4.5s cubic-bezier(0.15, 0.85, 0.2, 1)"
                : "none",
            }}
            onTransitionEnd={handleTransitionEnd}
          >
            <circle cx="100" cy="100" r="98" fill="#1a1208" />
            {WHEEL_SLOTS.map((value, i) => {
              const startAngle = i * WHEEL_SEGMENT_ANGLE - 90;
              const endAngle = startAngle + WHEEL_SEGMENT_ANGLE;
              const color = getRouletteColor(value);
              const startRad = (startAngle * Math.PI) / 180;
              const endRad = (endAngle * Math.PI) / 180;
              const x1 = 100 + 96 * Math.cos(startRad);
              const y1 = 100 + 96 * Math.sin(startRad);
              const x2 = 100 + 96 * Math.cos(endRad);
              const y2 = 100 + 96 * Math.sin(endRad);
              const largeArc = WHEEL_SEGMENT_ANGLE > 180 ? 1 : 0;
              const midAngle = startAngle + WHEEL_SEGMENT_ANGLE / 2;
              const midRad = (midAngle * Math.PI) / 180;
              const labelX = 100 + 72 * Math.cos(midRad);
              const labelY = 100 + 72 * Math.sin(midRad);
              const label = formatRouletteValue(value);
              const fontSize = label.length > 2 ? 5.5 : 7;

              return (
                <g key={`${value}-${i}`}>
                  <path
                    d={`M 100 100 L ${x1} ${y1} A 96 96 0 ${largeArc} 1 ${x2} ${y2} Z`}
                    fill={COLOR_FILL[color]}
                    stroke="#FFD700"
                    strokeWidth="0.3"
                  />
                  <text
                    x={labelX}
                    y={labelY}
                    fill="white"
                    fontSize={fontSize}
                    fontWeight="bold"
                    textAnchor="middle"
                    dominantBaseline="middle"
                    transform={`rotate(${midAngle + 90}, ${labelX}, ${labelY})`}
                  >
                    {label}
                  </text>
                </g>
              );
            })}
            <circle
              cx="100"
              cy="100"
              r="22"
              fill="#0d2818"
              stroke="#FFD700"
              strokeWidth="1.5"
            />
            <text
              x="100"
              y="100"
              fill="#FFD700"
              fontSize="8"
              fontWeight="bold"
              textAnchor="middle"
              dominantBaseline="middle"
            >
              WC26
            </text>
          </svg>
        </div>
      </div>
    </div>
  );
}
