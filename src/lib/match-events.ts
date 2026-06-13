import type { MatchEvent } from "./types";

export type ApiFootballEvent = {
  time: { elapsed: number; extra: number | null };
  team: { id: number; name: string };
  player: { id: number | null; name: string | null };
  type: string;
  detail: string;
};

export function formatEventMinute(event: Pick<MatchEvent, "minute" | "extraMinute">): string {
  if (event.extraMinute && event.extraMinute > 0) {
    return `${event.minute}+${event.extraMinute}'`;
  }
  return `${event.minute}'`;
}

export function eventKey(event: ApiFootballEvent): string {
  const extra = event.time.extra ?? 0;
  const playerId = event.player.id ?? event.player.name ?? "unknown";
  return `${event.type}-${event.team.id}-${playerId}-${event.time.elapsed}-${extra}-${event.detail}`;
}

export function parseFixtureEvents(
  raw: ApiFootballEvent[],
  homeTeamId: number
): MatchEvent[] {
  return raw
    .filter(
      (event) =>
        (event.type === "Goal" && event.detail !== "Missed Penalty") ||
        (event.type === "Card" && event.detail === "Red Card")
    )
    .map((event) => ({
      id: eventKey(event),
      type: event.type === "Goal" ? "goal" : "red_card",
      minute: event.time.elapsed,
      extraMinute: event.time.extra,
      playerName: event.player.name ?? "Unknown",
      teamId: event.team.id,
      side: event.team.id === homeTeamId ? "home" : "away",
      detail: event.detail,
    }));
}

export function findNewEvents(
  previous: MatchEvent[] | null | undefined,
  current: MatchEvent[]
): MatchEvent[] {
  const seen = new Set((previous ?? []).map((event) => event.id));
  return current.filter((event) => !seen.has(event.id));
}

export function shouldBootstrapEvents(
  previous: MatchEvent[] | null | undefined,
  current: MatchEvent[]
): boolean {
  return (!previous || previous.length === 0) && current.length > 0;
}

export function goalsForSide(events: MatchEvent[], side: "home" | "away"): MatchEvent[] {
  return events.filter((event) => event.type === "goal" && event.side === side);
}

export function redCardsForSide(
  events: MatchEvent[],
  side: "home" | "away"
): MatchEvent[] {
  return events.filter((event) => event.type === "red_card" && event.side === side);
}

export function redCardCount(events: MatchEvent[], side: "home" | "away"): number {
  return redCardsForSide(events, side).length;
}
