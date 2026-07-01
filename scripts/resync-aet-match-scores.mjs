/**
 * Re-fetch finished AET/PEN matches from API-Football and fix stored scores,
 * then rescore all picks on updated fixtures.
 *
 * Usage: node scripts/resync-aet-match-scores.mjs [matchId ...]
 */
import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";
import { parseMatchScoresFromFixture } from "../src/lib/api-football.ts";
import { scoreFinishedMatchPicks } from "../src/lib/score-finished-picks.ts";

const envPath = path.join(process.cwd(), ".env.local");
const env = fs.readFileSync(envPath, "utf8");
for (const line of env.split(/\r?\n/)) {
  const t = line.trim();
  if (!t || t.startsWith("#")) continue;
  const eq = t.indexOf("=");
  if (eq === -1) continue;
  let v = t.slice(eq + 1).trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'")))
    v = v.slice(1, -1);
  process.env[t.slice(0, eq).trim()] = v;
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

const key = process.env.API_FOOTBALL_KEY;
const argIds = process.argv.slice(2).map(Number).filter(Boolean);

let matches;
if (argIds.length) {
  const { data } = await supabase
    .from("matches")
    .select("id, home_team_name, away_team_name, status, home_score, away_score")
    .in("id", argIds);
  matches = data ?? [];
} else {
  const { data } = await supabase
    .from("matches")
    .select("id, home_team_name, away_team_name, status, home_score, away_score")
    .eq("status", "AET");
  matches = data ?? [];
}

const updatedIds = [];

for (const match of matches) {
  const res = await fetch(
    `https://v3.football.api-sports.io/fixtures?id=${match.id}`,
    { headers: { "x-apisports-key": key } }
  );
  const json = await res.json();
  const f = json.response?.[0];
  if (!f) {
    console.warn("No API fixture:", match.id);
    continue;
  }

  const parsed = parseMatchScoresFromFixture(f);
  const same =
    match.home_score === parsed.homeScore &&
    match.away_score === parsed.awayScore;

  if (same) {
    console.log(`OK ${match.home_team_name} vs ${match.away_team_name}: ${parsed.homeScore}-${parsed.awayScore}`);
    continue;
  }

  const { error } = await supabase
    .from("matches")
    .update({
      home_score: parsed.homeScore,
      away_score: parsed.awayScore,
      pen_home_score: parsed.penHomeScore,
      pen_away_score: parsed.penAwayScore,
      status: f.fixture.status.short,
    })
    .eq("id", match.id);

  console.log(
    `${error ? "FAIL" : "FIXED"} ${match.home_team_name} vs ${match.away_team_name}: ${match.home_score}-${match.away_score} -> ${parsed.homeScore}-${parsed.awayScore}`
  );
  if (!error) updatedIds.push(match.id);
}

if (updatedIds.length) {
  const { picksScored, affectedUserIds } = await scoreFinishedMatchPicks(
    supabase,
    updatedIds
  );
  console.log(`Rescored ${picksScored} picks for ${affectedUserIds.size} users.`);

  for (const userId of affectedUserIds) {
    const { data: picks } = await supabase
      .from("picks")
      .select("points_earned")
      .eq("user_id", userId);
    const total = (picks ?? []).reduce((s, p) => s + (p.points_earned ?? 0), 0);
    const wins = (picks ?? []).filter((p) => (p.points_earned ?? 0) > 0).length;
    await supabase
      .from("profiles")
      .update({ total_points: total, total_wins: wins })
      .eq("id", userId);
  }
  console.log("Updated profile totals.");
}
