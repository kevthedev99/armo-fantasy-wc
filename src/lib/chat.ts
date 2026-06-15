/** Beta chat — messages older than this are deleted on each read/write. */
export const CHAT_TTL_MS = 30 * 60 * 1000;

export const CHAT_MAX_LENGTH = 200;

export const CHAT_POLL_MS = 3_000;

export type ChatMessage = {
  id: string;
  username: string;
  body: string;
  created_at: string;
};

const PROFANITY = [
  "asshole",
  "bastard",
  "bitch",
  "bullshit",
  "cock",
  "crap",
  "cunt",
  "damn",
  "dick",
  "fag",
  "fuck",
  "fucking",
  "motherfucker",
  "nigger",
  "nigga",
  "piss",
  "pussy",
  "shit",
  "slut",
  "twat",
  "whore",
] as const;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Strip @ (no mentions) and mask profanity. */
export function sanitizeChatBody(raw: string): string {
  let text = raw.replace(/@/g, "").replace(/\s+/g, " ").trim();

  for (const word of PROFANITY) {
    const pattern = new RegExp(`\\b${escapeRegExp(word)}\\b`, "gi");
    text = text.replace(pattern, "*".repeat(word.length));
  }

  return text;
}

export function chatCutoffIso(now = Date.now()): string {
  return new Date(now - CHAT_TTL_MS).toISOString();
}
