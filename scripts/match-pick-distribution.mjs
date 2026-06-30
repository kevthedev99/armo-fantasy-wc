import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";
import { fetchAllPages } from "./lib/supabase-paginate.mjs";

const envPath = path.join(process.cwd(), ".env.local");
const env = fs.readFileSync(envPath, "utf8");
for (const line of env.split(/\r?\n/)) {
  const t = line.trim();
  if (!t || t.startsWith("#")) continue;
  const eq = t.indexOf("=");
  if (eq === -1) continue;
  let v = t.slice(eq + 1).trim();
  if (
    (v.startsWith('"') && v.endsWith('"')) ||
    (v.startsWith("'") && v.endsWith("'"))
  )
    v = v.slice(1, -1);
  process.env[t.slice(0, eq).trim()] = v;
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

const searchArg = process.argv.slice(2).join(" ").trim();
let matchId = Number(searchArg);

let match;
if (searchArg && !Number.isNaN(matchId)) {
  const { data } = await supabase
    .from("matches")
    .select("*")
    .eq("id", matchId)
    .single();
  match = data;
} else {
  const terms = (searchArg || "Netherlands Morocco").toLowerCase().split(/\s+/);
  const { data: allMatches } = await supabase
    .from("matches")
    .select("*")
    .order("kickoff_at", { ascending: true });
  match = (allMatches ?? []).find((m) => {
    const label = `${m.home_team_name} ${m.away_team_name}`.toLowerCase();
    return terms.every((t) => label.includes(t));
  });
}

if (!match) {
  console.error("Match not found");
  process.exit(1);
}

const picks = await fetchAllPages((from, to) =>
  supabase
    .from("picks")
    .select(
      "picked_winner, home_score_pred, away_score_pred, predicts_penalties"
    )
    .eq("match_id", match.id)
    .order("user_id", { ascending: true })
    .range(from, to)
);

const total = picks.length;
const homeName = match.home_team_name;
const awayName = match.away_team_name;

function winnerLabel(side) {
  if (side === "home") return `${homeName} win`;
  if (side === "away") return `${awayName} win`;
  return "Draw";
}

function scoreKey(p) {
  if (p.predicts_penalties) {
    return `${winnerLabel(p.picked_winner)} (penalties)`;
  }
  if (p.home_score_pred != null && p.away_score_pred != null) {
    return `${p.home_score_pred}-${p.away_score_pred}`;
  }
  return winnerLabel(p.picked_winner);
}

const winnerCounts = new Map();
const scoreCounts = new Map();

for (const p of picks) {
  const w = p.picked_winner;
  winnerCounts.set(w, (winnerCounts.get(w) ?? 0) + 1);
  const key = scoreKey(p);
  scoreCounts.set(key, (scoreCounts.get(key) ?? 0) + 1);
}

function topEntries(map, n = 5) {
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([label, count]) => ({
      label,
      count,
      pct: total ? ((count / total) * 100).toFixed(1) + "%" : "0%",
    }));
}

const actual =
  match.home_score != null && match.away_score != null
    ? `${match.home_score}-${match.away_score}`
    : null;

console.log(
  JSON.stringify(
    {
      matchId: match.id,
      match: `${homeName} vs ${awayName}`,
      kickoff: match.kickoff_at,
      status: match.status,
      stage: match.stage,
      round: match.round,
      actualScore: actual,
      totalPickers: total,
      winnerBreakdown: topEntries(winnerCounts, 10).map(({ label, count, pct }) => ({
        winner: winnerLabel(label),
        side: label,
        count,
        pct,
      })),
      topScoreLines: topEntries(scoreCounts, 5),
      allScoreLines: topEntries(scoreCounts, 100),
    },
    null,
    2
  )
);
