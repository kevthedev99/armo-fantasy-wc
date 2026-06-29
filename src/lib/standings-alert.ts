export const STANDINGS_ALERT_EVENT = "standings-alert:open";

export function openStandingsAlert(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(STANDINGS_ALERT_EVENT));
  }
}
