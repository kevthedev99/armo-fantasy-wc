/** Daily free-play reset at midnight Eastern (World Cup host timezone). */
export const CASINO_TIMEZONE = "America/New_York";
export const DAILY_FREE_PLAY = 500;

export function getCasinoDay(date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: CASINO_TIMEZONE,
  }).format(date);
}

export function msUntilNextCasinoReset(date = new Date()): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: CASINO_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const get = (type: string) =>
    Number(parts.find((p) => p.type === type)?.value ?? 0);

  const h = get("hour");
  const min = get("minute");
  const s = get("second");

  const elapsedToday = ((h * 60 + min) * 60 + s) * 1000;
  const msInDay = 24 * 60 * 60 * 1000;
  return msInDay - elapsedToday;
}

export function formatCountdown(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${h}h ${m}m ${s}s`;
}
