export type RouletteValue = number | "00";

export type RouletteColor = "red" | "black" | "green";

export type RouletteBet =
  | { type: "straight"; value: RouletteValue }
  | { type: "red" | "black" | "odd" | "even" | "low" | "high" }
  | { type: "dozen"; dozen: 1 | 2 | 3 };

export const WHEEL_SEGMENT_COUNT = 38;
export const WHEEL_SEGMENT_ANGLE = 360 / WHEEL_SEGMENT_COUNT;
/** Fixed pointer at top of wheel (12 o'clock). */
export const WHEEL_POINTER_DEG = -90;

/** American wheel order (clockwise). */
export const WHEEL_SLOTS: RouletteValue[] = [
  0, 28, 9, 26, 30, 11, 7, 20, 32, 17, 5, 22, 34, 15, 3, 24, 36, 13, 1, "00",
  27, 10, 25, 29, 12, 8, 19, 31, 18, 6, 21, 33, 16, 4, 23, 35, 14, 2,
];

const RED_NUMBERS = new Set([
  1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36,
]);

export function formatRouletteValue(value: RouletteValue): string {
  return value === "00" ? "00" : String(value);
}

export function getRouletteColor(value: RouletteValue): RouletteColor {
  if (value === 0 || value === "00") return "green";
  return RED_NUMBERS.has(value) ? "red" : "black";
}

export function isEvenMoneyWinner(
  bet: Exclude<RouletteBet, { type: "straight" } | { type: "dozen" }>,
  value: RouletteValue
): boolean {
  if (value === 0 || value === "00") return false;
  const n = value as number;
  switch (bet.type) {
    case "red":
      return RED_NUMBERS.has(n);
    case "black":
      return !RED_NUMBERS.has(n);
    case "odd":
      return n % 2 === 1;
    case "even":
      return n % 2 === 0;
    case "low":
      return n >= 1 && n <= 18;
    case "high":
      return n >= 19 && n <= 36;
    default:
      return false;
  }
}

export function getDozen(value: RouletteValue): 1 | 2 | 3 | null {
  if (value === 0 || value === "00") return null;
  if (value <= 12) return 1;
  if (value <= 24) return 2;
  return 3;
}

export function evaluateRouletteBet(
  bet: RouletteBet,
  result: RouletteValue,
  amount: number
): { won: boolean; payout: number } {
  let won = false;
  let multiplier = 0;

  if (bet.type === "straight") {
    won = bet.value === result;
    multiplier = 35;
  } else if (bet.type === "dozen") {
    const dozen = getDozen(result);
    won = dozen === bet.dozen;
    multiplier = 2;
  } else {
    won = isEvenMoneyWinner(bet, result);
    multiplier = 1;
  }

  return {
    won,
    payout: won ? amount * (multiplier + 1) : 0,
  };
}

export function spinRoulette(): {
  value: RouletteValue;
  wheelIndex: number;
  color: RouletteColor;
} {
  const wheelIndex = Math.floor(Math.random() * WHEEL_SLOTS.length);
  const value = WHEEL_SLOTS[wheelIndex];
  return { value, wheelIndex, color: getRouletteColor(value) };
}

export function validateBetAmount(
  amount: number,
  balance: number
): string | null {
  if (!Number.isInteger(amount) || amount < 1) {
    return "Minimum bet is $1.";
  }
  if (amount > balance) {
    return "Not enough chips for that bet.";
  }
  return null;
}

export interface RoulettePlacedBet {
  bet: RouletteBet;
  amount: number;
}

export function rouletteBetKey(bet: RouletteBet): string {
  if (bet.type === "straight") return `straight:${bet.value}`;
  if (bet.type === "dozen") return `dozen:${bet.dozen}`;
  return bet.type;
}

export function evaluateRouletteBets(
  bets: RoulettePlacedBet[],
  result: RouletteValue
): {
  totalWager: number;
  totalPayout: number;
  outcomes: {
    bet: RouletteBet;
    amount: number;
    won: boolean;
    payout: number;
  }[];
} {
  let totalWager = 0;
  let totalPayout = 0;
  const outcomes = bets.map(({ bet, amount }) => {
    totalWager += amount;
    const { won, payout } = evaluateRouletteBet(bet, result, amount);
    totalPayout += payout;
    return { bet, amount, won, payout };
  });
  return { totalWager, totalPayout, outcomes };
}

export function validateRouletteBets(
  bets: RoulettePlacedBet[],
  balance: number
): string | null {
  if (!Array.isArray(bets) || bets.length === 0) {
    return "Place at least one bet.";
  }
  if (bets.length > 20) {
    return "Maximum 20 bets per spin.";
  }

  let totalWager = 0;
  const seen = new Set<string>();

  for (const { bet, amount } of bets) {
    const betError = validateRouletteBet(bet);
    if (betError) return betError;

    const amountError = validateBetAmount(amount, balance);
    if (amountError) return amountError;

    const key = rouletteBetKey(bet);
    if (seen.has(key)) {
      return "Duplicate bet on the same spot.";
    }
    seen.add(key);
    totalWager += amount;
  }

  if (totalWager > balance) {
    return "Not enough chips for those bets.";
  }

  return null;
}

export function validateRouletteBet(bet: RouletteBet): string | null {
  if (bet.type === "straight") {
    if (bet.value === "00") return null;
    if (typeof bet.value === "number" && bet.value >= 0 && bet.value <= 36) {
      return null;
    }
    return "Invalid number.";
  }
  if (bet.type === "dozen") {
    if (bet.dozen >= 1 && bet.dozen <= 3) return null;
    return "Invalid dozen.";
  }
  return null;
}

/** Compute the next cumulative wheel rotation so `wheelIndex` lands under the pointer. */
export function getNextWheelRotation(
  currentRotation: number,
  wheelIndex: number
): number {
  const extraSpins = 5 + Math.floor(Math.random() * 3);
  const midAngle =
    wheelIndex * WHEEL_SEGMENT_ANGLE +
    WHEEL_POINTER_DEG +
    WHEEL_SEGMENT_ANGLE / 2;
  const targetMod =
    (((WHEEL_POINTER_DEG - midAngle) % 360) + 360) % 360;
  const currentMod = (((currentRotation % 360) + 360) % 360);
  let delta = targetMod - currentMod;
  if (delta <= 0) delta += 360;
  return currentRotation + extraSpins * 360 + delta;
}

/** Table layout: 3 rows × 12 columns for numbers 1–36. */
export const TABLE_NUMBERS: number[][] = [
  [3, 6, 9, 12, 15, 18, 21, 24, 27, 30, 33, 36],
  [2, 5, 8, 11, 14, 17, 20, 23, 26, 29, 32, 35],
  [1, 4, 7, 10, 13, 16, 19, 22, 25, 28, 31, 34],
];
