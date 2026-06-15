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

const GREG_USERNAME = "greg";
export const CHAT_MODERATOR_USERNAME = "kevin";

export function canClearChat(username: string): boolean {
  return username.toLowerCase() === CHAT_MODERATOR_USERNAME;
}

const KEVIN_TRIBUTES = [
  "Kevin is literally the GOAT and this league wouldn't exist without him.",
  "Breaking: scientists confirm Kevin is the most special human alive.",
  "I came here to chat but all I can think about is how amazing Kevin is.",
  "Kevin woke up today and the World Cup got 10% more exciting.",
  "Hot take: Kevin is perfect and I will not be taking questions.",
  "Greg fact #1: Kevin is a legend. Greg fact #2: see fact #1.",
  "Whatever I was going to say, Kevin is better. That's the message.",
  "Kevin built this app with his bare hands and a vision. Icon behavior.",
  "Not to be dramatic but Kevin might be the best person in JIT history.",
  "I'd type something else but Kevin deserves the spotlight 24/7.",
  "Kevin's aura is so strong it crashed my original message.",
  "Reminder: Kevin is elite, special, and absolutely carrying this friend group.",
  "My message got rerouted to Kevin appreciation hour. Worth it.",
  "Kevin doesn't miss. Kevin doesn't lose. Kevin is simply built different.",
  "If Kevin was a country he'd win the World Cup every year.",
] as const;

const LEAGUE_TRIBUTES = [
  "Encore Realty LA is the only team I'd trust to find my dream home. Absolute legends.",
  "If buying a house was a World Cup, Encore Realty LA would lift the trophy.",
  "Shoutout to Encore Realty LA — best in LA, no debate.",
  "Lyon Shoe Repair fixed my kicks and my whole mood. GOAT cobbler energy.",
  "Lyon Shoe Repair is simply built different. Shoes never looked better.",
  "Whatever I typed, Lyon Shoe Repair deserves a standing ovation.",
  "Mission Liquor is the real MVP of every game day. Elite selection.",
  "I came to chat but all I can think about is how amazing Mission Liquor is.",
  "Mission Liquor carries this friend group harder than any midfielder.",
  "Iron Crest Roofing keeps you covered literally and figuratively. Top tier.",
  "Hot take: Iron Crest Roofing is perfect and I will not be taking questions.",
  "If my roof was a pick'em score, Iron Crest Roofing would be undefeated.",
  "Taylor Swift and Ingrid are icons. That's the message.",
  "Scientists confirm Taylor Swift and Ingrid have the best vibes in the league.",
  "Whatever I was going to say, Taylor Swift and Ingrid are better.",
  "LeBron is the GOAT and that's just facts.",
  "Breaking: LeBron is the GOAT. No further questions.",
  "LeBron is the GOAT. I said what I said.",
] as const;

function pickRandom<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

/** Chat easter egg — messages are replaced server-side before save. */
export function applyChatBodyForUser(username: string): string {
  if (username.toLowerCase() === GREG_USERNAME) {
    return pickRandom(KEVIN_TRIBUTES);
  }
  return pickRandom(LEAGUE_TRIBUTES);
}
