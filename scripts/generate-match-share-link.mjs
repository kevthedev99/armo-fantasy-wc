import fs from "fs";
import path from "path";
import { createHmac } from "crypto";
import { createClient } from "@supabase/supabase-js";

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
  ) {
    v = v.slice(1, -1);
  }
  process.env[t.slice(0, eq).trim()] = v;
}

function createToken(matchId, secret) {
  return createHmac("sha256", secret)
    .update(`match-share:${matchId}`)
    .digest("base64url")
    .slice(0, 24);
}

const secret = process.env.SHARE_LINK_SECRET ?? process.env.CRON_SECRET;
if (!secret) {
  console.error("Set SHARE_LINK_SECRET or CRON_SECRET in .env.local");
  process.exit(1);
}

const searchArg = process.argv.slice(2).join(" ").trim();
if (!searchArg) {
  console.error("Usage: node scripts/generate-match-share-link.mjs <matchId|team names>");
  process.exit(1);
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

let matchId = Number(searchArg);
let matchLabel = searchArg;

if (Number.isNaN(matchId)) {
  const terms = searchArg.toLowerCase().split(/\s+/);
  const { data: matches } = await supabase
    .from("matches")
    .select("id, home_team_name, away_team_name")
    .order("kickoff_at", { ascending: true });
  const match = (matches ?? []).find((m) => {
    const label = `${m.home_team_name} ${m.away_team_name}`.toLowerCase();
    return terms.every((t) => label.includes(t));
  });
  if (!match) {
    console.error("Match not found for:", searchArg);
    process.exit(1);
  }
  matchId = match.id;
  matchLabel = `${match.home_team_name} vs ${match.away_team_name}`;
}

const token = createToken(matchId, secret);
const baseUrl =
  process.env.NEXT_PUBLIC_APP_URL ??
  (process.env.VERCEL_URL?.startsWith("http")
    ? process.env.VERCEL_URL
    : process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "http://localhost:3000");

const url = `${baseUrl.replace(/\/$/, "")}/share/match/${matchId}?token=${encodeURIComponent(token)}`;

console.log(JSON.stringify({ matchId, match: matchLabel, token, url }, null, 2));
