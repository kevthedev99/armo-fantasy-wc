import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";

const envPath = path.join(process.cwd(), ".env.local");
const env = fs.readFileSync(envPath, "utf8");

for (const line of env.split(/\r?\n/)) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const eq = trimmed.indexOf("=");
  if (eq === -1) continue;
  const key = trimmed.slice(0, eq).trim();
  let value = trimmed.slice(eq + 1).trim();
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }
  process.env[key] = value;
}

const FINISHED = new Set(["FT", "AET", "PEN", "AWD", "WO"]);
const LIVE = new Set(["1H", "HT", "2H", "ET", "BT", "P", "LIVE", "INT", "SUSP"]);
const STALE_MS = 110 * 60 * 1000;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

const { data: matches, error } = await supabase
  .from("matches")
  .select("id, home_team_name, away_team_name, status, kickoff_at")
  .order("kickoff_at", { ascending: true });

if (error) {
  console.error(error);
  process.exit(1);
}

const now = Date.now();
const stale = (matches ?? []).filter((m) => {
  if (FINISHED.has(m.status)) return false;
  if (now - new Date(m.kickoff_at).getTime() < STALE_MS) return false;
  return LIVE.has(m.status) || now >= new Date(m.kickoff_at).getTime();
});

if (stale.length === 0) {
  console.log("No stale in-progress matches.");
  process.exit(0);
}

const key = process.env.API_FOOTBALL_KEY;
let updated = 0;

for (const match of stale) {
  const url = new URL("https://v3.football.api-sports.io/fixtures");
  url.searchParams.set("id", String(match.id));

  const res = await fetch(url, {
    headers: { "x-apisports-key": key },
    cache: "no-store",
  });
  const json = await res.json();
  const f = json.response?.[0];
  if (!f) {
    console.log(`Missing API fixture ${match.id}`);
    continue;
  }

  const status = f.fixture.status.short;
  const homeScore = f.goals.home;
  const awayScore = f.goals.away;

  const { error: upsertError } = await supabase
    .from("matches")
    .update({
      status,
      home_score: homeScore,
      away_score: awayScore,
      updated_at: new Date().toISOString(),
    })
    .eq("id", match.id);

  if (upsertError) {
    console.error(match.id, upsertError);
    continue;
  }

  updated++;
  console.log(
    `${match.home_team_name} vs ${match.away_team_name}: ${match.status} -> ${status} (${homeScore}-${awayScore})`
  );
}

console.log(`Updated ${updated} match(es).`);
