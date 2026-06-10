export const RANKS = [
  "A",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "10",
  "J",
  "Q",
  "K",
] as const;

export const SUITS = ["hearts", "diamonds", "clubs", "spades"] as const;

export type Rank = (typeof RANKS)[number];
export type Suit = (typeof SUITS)[number];

export interface Card {
  rank: Rank;
  suit: Suit;
}

export type HandResult =
  | "playing"
  | "blackjack"
  | "win"
  | "lose"
  | "push"
  | "bust";

export interface BlackjackState {
  bet: number;
  doubled: boolean;
  deck: Card[];
  playerHand: Card[];
  dealerHand: Card[];
  status: HandResult;
  message: string;
}

export interface BlackjackClientView {
  bet: number;
  doubled: boolean;
  playerHand: Card[];
  dealerHand: Card[];
  dealerHidden: boolean;
  playerTotal: number;
  dealerTotal: number | null;
  status: HandResult;
  message: string;
  canHit: boolean;
  canStand: boolean;
  canDouble: boolean;
  canDeal: boolean;
}

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function createShoe(decks = 4): Card[] {
  const cards: Card[] = [];
  for (let d = 0; d < decks; d++) {
    for (const suit of SUITS) {
      for (const rank of RANKS) {
        cards.push({ rank, suit });
      }
    }
  }
  return shuffle(cards);
}

export function handValue(hand: Card[]): number {
  let total = 0;
  let aces = 0;
  for (const card of hand) {
    if (card.rank === "A") {
      aces++;
      total += 11;
    } else if (card.rank === "K" || card.rank === "Q" || card.rank === "J") {
      total += 10;
    } else {
      total += Number(card.rank);
    }
  }
  while (total > 21 && aces > 0) {
    total -= 10;
    aces--;
  }
  return total;
}

export function isBlackjack(hand: Card[]): boolean {
  return hand.length === 2 && handValue(hand) === 21;
}

function drawCard(state: BlackjackState): Card {
  const card = state.deck.pop();
  if (!card) {
    state.deck = createShoe();
    return state.deck.pop()!;
  }
  return card;
}

function dealerShouldHit(hand: Card[]): boolean {
  return handValue(hand) < 17;
}

function totalWager(state: BlackjackState): number {
  return state.doubled ? state.bet * 2 : state.bet;
}

function payoutForResult(
  state: BlackjackState,
  result: Exclude<HandResult, "playing">
): number {
  const wager = totalWager(state);
  switch (result) {
    case "blackjack":
      return Math.floor(wager * 2.5);
    case "win":
      return wager * 2;
    case "push":
      return wager;
    default:
      return 0;
  }
}

function finishHand(
  state: BlackjackState,
  result: Exclude<HandResult, "playing">,
  message: string
): BlackjackState {
  return {
    ...state,
    status: result,
    message,
  };
}

function playDealer(state: BlackjackState): BlackjackState {
  const next = { ...state, dealerHand: [...state.dealerHand] };
  while (dealerShouldHit(next.dealerHand)) {
    next.dealerHand.push(drawCard(next));
  }
  return next;
}

function resolveAfterStand(state: BlackjackState): BlackjackState {
  const afterDealer = playDealer(state);
  const playerTotal = handValue(afterDealer.playerHand);
  const dealerTotal = handValue(afterDealer.dealerHand);

  if (dealerTotal > 21) {
    return finishHand(
      afterDealer,
      "win",
      `Dealer busts with ${dealerTotal}. You win!`
    );
  }
  if (playerTotal > dealerTotal) {
    return finishHand(
      afterDealer,
      "win",
      `${playerTotal} beats ${dealerTotal}. You win!`
    );
  }
  if (playerTotal < dealerTotal) {
    return finishHand(
      afterDealer,
      "lose",
      `Dealer ${dealerTotal} beats your ${playerTotal}.`
    );
  }
  return finishHand(afterDealer, "push", `Push at ${playerTotal}.`);
}

function checkImmediateBlackjacks(state: BlackjackState): BlackjackState | null {
  const playerBJ = isBlackjack(state.playerHand);
  const dealerBJ = isBlackjack(state.dealerHand);

  if (playerBJ && dealerBJ) {
    return finishHand(state, "push", "Both have blackjack — push.");
  }
  if (playerBJ) {
    return finishHand(state, "blackjack", "Blackjack! Pays 3:2.");
  }
  if (dealerBJ) {
    return finishHand(state, "lose", "Dealer has blackjack.");
  }
  return null;
}

export function dealHand(bet: number): BlackjackState {
  const deck = createShoe();
  const state: BlackjackState = {
    bet,
    doubled: false,
    deck,
    playerHand: [deck.pop()!, deck.pop()!],
    dealerHand: [deck.pop()!, deck.pop()!],
    status: "playing",
    message: "Your move — hit or stand?",
  };

  const immediate = checkImmediateBlackjacks(state);
  return immediate ?? state;
}

export function hit(state: BlackjackState): BlackjackState {
  if (state.status !== "playing") return state;

  const next: BlackjackState = {
    ...state,
    playerHand: [...state.playerHand, drawCard(state)],
  };

  const total = handValue(next.playerHand);
  if (total > 21) {
    return finishHand(next, "bust", `Busted with ${total}.`);
  }
  if (total === 21) {
    return resolveAfterStand({ ...next, message: "21 — standing." });
  }
  return { ...next, message: `You have ${total}. Hit or stand?` };
}

export function stand(state: BlackjackState): BlackjackState {
  if (state.status !== "playing") return state;
  return resolveAfterStand({ ...state, message: "Standing." });
}

export function doubleDown(state: BlackjackState): BlackjackState {
  if (state.status !== "playing" || state.playerHand.length !== 2) {
    return state;
  }

  const next: BlackjackState = {
    ...state,
    doubled: true,
    playerHand: [...state.playerHand, drawCard(state)],
  };

  const total = handValue(next.playerHand);
  if (total > 21) {
    return finishHand(next, "bust", `Doubled down and busted with ${total}.`);
  }
  return resolveAfterStand({ ...next, message: "Doubled down — dealer reveals." });
}

export function getPayout(state: BlackjackState): number {
  if (state.status === "playing") return 0;
  return payoutForResult(state, state.status);
}

export function toClientView(
  state: BlackjackState | null,
  balance: number
): BlackjackClientView {
  if (!state) {
    return {
      bet: 0,
      doubled: false,
      playerHand: [],
      dealerHand: [],
      dealerHidden: false,
      playerTotal: 0,
      dealerTotal: null,
      status: "playing",
      message: "Place your bet and deal.",
      canHit: false,
      canStand: false,
      canDouble: false,
      canDeal: balance > 0,
    };
  }

  const finished = state.status !== "playing";
  const playerTotal = handValue(state.playerHand);
  const dealerTotal = finished ? handValue(state.dealerHand) : null;

  return {
    bet: state.bet,
    doubled: state.doubled,
    playerHand: state.playerHand,
    dealerHand: finished ? state.dealerHand : [state.dealerHand[0]],
    dealerHidden: !finished,
    playerTotal,
    dealerTotal,
    status: state.status,
    message: state.message,
    canHit: state.status === "playing" && playerTotal < 21,
    canStand: state.status === "playing",
    canDouble:
      state.status === "playing" &&
      !state.doubled &&
      state.playerHand.length === 2 &&
      balance >= state.bet,
    canDeal: finished && balance > 0,
  };
}

export function formatCard(card: Card): string {
  const suitIcon =
    card.suit === "hearts"
      ? "♥"
      : card.suit === "diamonds"
        ? "♦"
        : card.suit === "clubs"
          ? "♣"
          : "♠";
  return `${card.rank}${suitIcon}`;
}

export function isRedSuit(suit: Suit): boolean {
  return suit === "hearts" || suit === "diamonds";
}
