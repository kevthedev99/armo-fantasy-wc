const PST_FORMATTER = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/Los_Angeles",
  weekday: "short",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
  timeZoneName: "short",
});

/** Format an ISO timestamp for display in Pacific time (PST/PDT). */
export function formatKickoffPST(iso: string): string {
  const parts = PST_FORMATTER.formatToParts(new Date(iso));
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? "";

  const weekday = get("weekday");
  const month = get("month");
  const day = get("day");
  const hour = get("hour");
  const minute = get("minute");
  const dayPeriod = get("dayPeriod");
  const tz = get("timeZoneName");

  return `${weekday} ${month} ${day} · ${hour}:${minute} ${dayPeriod} ${tz}`;
}
