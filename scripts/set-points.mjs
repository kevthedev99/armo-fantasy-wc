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

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error("Missing Supabase env vars");
  process.exit(1);
}

const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const username = process.argv[2];
const pointsArg = process.argv[3];

if (!username || pointsArg === undefined) {
  console.error("Usage: node scripts/set-points.mjs <username> <points>");
  process.exit(1);
}

const points = Number(pointsArg);
if (!Number.isFinite(points)) {
  console.error("Points must be a number");
  process.exit(1);
}

const { data: profile, error: lookupError } = await supabase
  .from("profiles")
  .select("id, username, display_name, total_points")
  .eq("username", username.toLowerCase())
  .maybeSingle();

if (lookupError) {
  console.error("Lookup failed:", lookupError.message);
  process.exit(1);
}

if (!profile) {
  console.error("User not found:", username);
  process.exit(1);
}

const { error: updateError } = await supabase
  .from("profiles")
  .update({ total_points: points })
  .eq("id", profile.id);

if (updateError) {
  console.error("Update failed:", updateError.message);
  process.exit(1);
}

console.log(
  `Updated ${profile.username}: ${profile.total_points} -> ${points}`
);
