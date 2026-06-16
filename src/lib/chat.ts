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

const NEGATIVE_WORDS = [
  "awful",
  "bad",
  "cringe",
  "disgusting",
  "dumb",
  "dumbass",
  "garbage",
  "hate",
  "horrible",
  "idiot",
  "lame",
  "moron",
  "pathetic",
  "suck",
  "sucks",
  "sucked",
  "stupid",
  "terrible",
  "trash",
  "useless",
  "worthless",
  "worst",
] as const;

function containsWord(text: string, word: string): boolean {
  const pattern = new RegExp(`\\b${escapeRegExp(word)}\\b`, "i");
  return pattern.test(text);
}

function containsProfanity(text: string): boolean {
  return PROFANITY.some((word) => containsWord(text, word));
}

function containsNegativeLanguage(text: string): boolean {
  return NEGATIVE_WORDS.some((word) => containsWord(text, word));
}

/** True when the message should be replaced with a troll tribute. */
export function shouldTrollRewrite(text: string): boolean {
  return containsProfanity(text) || containsNegativeLanguage(text);
}

/** Strip @ (no mentions) and normalize whitespace. */
export function sanitizeChatBody(raw: string): string {
  return raw.replace(/@/g, "").replace(/\s+/g, " ").trim();
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
  "LeBron is the GOAT and that's just facts.",
  "Breaking: LeBron is the GOAT. No further questions.",
  "LeBron is the GOAT. I said what I said.",
] as const;

function pickRandom<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

function pickTrollTribute(username: string): string {
  if (username.toLowerCase() === GREG_USERNAME) {
    return pickRandom(KEVIN_TRIBUTES);
  }
  return pickRandom(LEAGUE_TRIBUTES);
}

/** Pass through casual chat; troll rewrite only for profanity or negative language. */
export function applyChatBodyForUser(username: string, body: string): string {
  if (shouldTrollRewrite(body)) {
    return pickTrollTribute(username);
  }
  return body;
}
