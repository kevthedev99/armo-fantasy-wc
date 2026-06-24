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
const balanceArg = process.argv[3];

if (!username || balanceArg === undefined) {
  console.error("Usage: node scripts/set-casino-balance.mjs <username> <balance>");
  process.exit(1);
}

const balance = Number(balanceArg);
if (!Number.isFinite(balance) || balance < 0) {
  console.error("Balance must be a non-negative number");
  process.exit(1);
}

const { data: profile, error: lookupError } = await supabase
  .from("profiles")
  .select("id, username, display_name")
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

const { data: existing } = await supabase
  .from("casino_balances")
  .select("balance")
  .eq("user_id", profile.id)
  .maybeSingle();

const nowIso = new Date().toISOString();
const payload = {
  user_id: profile.id,
  balance,
  busted_at: null,
  updated_at: nowIso,
};

const { error: upsertError } = await supabase
  .from("casino_balances")
  .upsert(payload, { onConflict: "user_id" });

if (upsertError) {
  console.error("Update failed:", upsertError.message);
  process.exit(1);
}

const previous = existing?.balance ?? "none";
console.log(
  `Updated ${profile.username} casino balance: ${previous} -> ${balance} (roulette + blackjack)`
);
