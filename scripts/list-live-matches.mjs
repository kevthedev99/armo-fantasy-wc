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

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

const LIVE_STATUSES = ["1H", "HT", "2H", "ET", "BT", "P", "LIVE", "INT", "SUSP"];
const FINISHED = new Set(["FT", "AET", "PEN", "AWD", "WO"]);

const { data, error } = await supabase
  .from("matches")
  .select(
    "id, home_team_name, away_team_name, status, home_score, away_score, kickoff_at"
  )
  .order("kickoff_at", { ascending: true });

if (error) {
  console.error(error);
  process.exit(1);
}

const now = Date.now();
const liveBucket = (data ?? []).filter((m) => {
  if (FINISHED.has(m.status)) return false;
  if (LIVE_STATUSES.includes(m.status)) return true;
  return now >= new Date(m.kickoff_at).getTime();
});

console.log(
  JSON.stringify(
    liveBucket.map((m) => ({
      id: m.id,
      match: `${m.home_team_name} vs ${m.away_team_name}`,
      status: m.status,
      score: `${m.home_score ?? "-"}-${m.away_score ?? "-"}`,
      kickoff_at: m.kickoff_at,
      minsSinceKickoff: Math.round(
        (now - new Date(m.kickoff_at).getTime()) / 60_000
      ),
    })),
    null,
    2
  )
);
