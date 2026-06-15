/** Starting chip stack when a player joins or recovers from a bust. */
export const DAILY_FREE_PLAY = 500;

/** Wait time after balance hits $0 before chips return. */
export const BUST_RESET_MS = 60 * 60 * 1000;

export function msUntilBustReset(bustedAt: string | null, now = Date.now()): number {
  if (!bustedAt) return BUST_RESET_MS;
  const readyAt = new Date(bustedAt).getTime() + BUST_RESET_MS;
  return Math.max(0, readyAt - now);
}

export function formatCountdown(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${h}h ${m}m ${s}s`;
}
