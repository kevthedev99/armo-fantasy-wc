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

const FINISHED = ["FT", "AET", "PEN", "AWD", "WO"];

const { data: finishedMatches } = await supabase
  .from("matches")
  .select("id, home_team_name, away_team_name, status, kickoff_at")
  .in("status", FINISHED)
  .order("kickoff_at", { ascending: false });

const finishedIds = (finishedMatches ?? []).map((m) => m.id);

const { data: unscoredOnFinished } = await supabase
  .from("picks")
  .select("id, match_id, user_id, is_scored, points_earned")
  .eq("is_scored", false)
  .in("match_id", finishedIds);

const byMatch = new Map();
for (const p of unscoredOnFinished ?? []) {
  byMatch.set(p.match_id, (byMatch.get(p.match_id) ?? 0) + 1);
}

console.log(
  JSON.stringify(
    {
      finishedMatchCount: finishedIds.length,
      unscoredPicksOnFinished: unscoredOnFinished?.length ?? 0,
      byMatch: [...byMatch.entries()]
        .map(([id, count]) => {
          const m = finishedMatches?.find((x) => x.id === id);
          return {
            match: m ? `${m.home_team_name} vs ${m.away_team_name}` : id,
            kickoff: m?.kickoff_at,
            unscoredPicks: count,
          };
        })
        .slice(0, 20),
    },
    null,
    2
  )
);
