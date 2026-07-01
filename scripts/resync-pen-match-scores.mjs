import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";

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

function nullableScorePair(home, away) {
  if (home == null || away == null) return null;
  return { home, away };
}

function pickPreShootoutRegulationScore(f) {
  const candidates = [
    nullableScorePair(f.goals.home, f.goals.away),
    nullableScorePair(f.score.fulltime?.home, f.score.fulltime?.away),
    nullableScorePair(f.score.extratime?.home, f.score.extratime?.away),
  ].filter(Boolean);

  if (!candidates.length) return null;
  const nonZero = candidates.find((pair) => pair.home !== 0 || pair.away !== 0);
  return nonZero ?? candidates[0];
}

function parseMatchScoresFromFixture(f) {
  const status = f.fixture.status.short;
  const penHome = f.score.penalty?.home ?? null;
  const penAway = f.score.penalty?.away ?? null;
  const decidedByPens =
    status === "PEN" || status === "P" || (penHome != null && penAway != null);

  let homeScore = null;
  let awayScore = null;
  if (decidedByPens) {
    const pre = pickPreShootoutRegulationScore(f);
    homeScore = pre?.home ?? null;
    awayScore = pre?.away ?? null;
  } else {
    const extratime = nullableScorePair(
      f.score.extratime?.home,
      f.score.extratime?.away
    );
    const goals = nullableScorePair(f.goals.home, f.goals.away);
    const fulltime = nullableScorePair(
      f.score.fulltime?.home,
      f.score.fulltime?.away
    );
    homeScore = extratime?.home ?? goals?.home ?? fulltime?.home ?? null;
    awayScore = extratime?.away ?? goals?.away ?? fulltime?.away ?? null;
  }

  if (decidedByPens && penHome != null && penAway != null) {
    return { homeScore, awayScore, penHomeScore: penHome, penAwayScore: penAway };
  }
  return { homeScore, awayScore, penHomeScore: null, penAwayScore: null };
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

const { data: matches } = await supabase
  .from("matches")
  .select("id, home_team_name, away_team_name, status")
  .in("status", ["PEN", "P"]);

const key = process.env.API_FOOTBALL_KEY;
const updates = [];

for (const match of matches ?? []) {
  const res = await fetch(
    `https://v3.football.api-sports.io/fixtures?id=${match.id}`,
    { headers: { "x-apisports-key": key } }
  );
  const json = await res.json();
  const f = json.response?.[0];
  if (!f) continue;

  const parsed = parseMatchScoresFromFixture(f);
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

  updates.push({
    match: `${match.home_team_name} vs ${match.away_team_name}`,
    score: `${parsed.homeScore}-${parsed.awayScore}`,
    pens:
      parsed.penHomeScore != null
        ? `${parsed.penHomeScore}-${parsed.penAwayScore}`
        : null,
    ok: !error,
    error: error?.message,
  });
}

console.log(JSON.stringify(updates, null, 2));
