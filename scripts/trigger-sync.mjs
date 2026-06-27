import fs from "fs";
import path from "path";

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

const secret = process.env.CRON_SECRET;
if (!secret) {
  console.error("CRON_SECRET missing from .env.local");
  process.exit(1);
}

const baseUrl = process.argv[2] ?? "https://armowc26.xyz";
const full = process.argv.includes("--full") ? "?full=1" : "";
const force = process.argv.includes("--force") ? (full ? "&force=1" : "?force=1") : "";

const res = await fetch(`${baseUrl}/api/cron/sync-matches${full}${force}`, {
  headers: { Authorization: `Bearer ${secret}` },
});

const text = await res.text();
let body;
try {
  body = JSON.parse(text);
} catch {
  body = text;
}

console.log(JSON.stringify({ status: res.status, ok: res.ok, body }, null, 2));
process.exit(res.ok ? 0 : 1);
