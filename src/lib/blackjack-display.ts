import { handValue, type Card } from "@/lib/blackjack";

export const sleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

export interface TableDisplay {
  playerHand: Card[];
  dealerHand: Card[];
  showDealerHole: boolean;
  playerTotal: number;
  dealerTotal: number | null;
}

export type CardAnimKey = string | null;

/** Standard deal: player, dealer, player, dealer hole. */
export async function animateInitialDeal(
  player: Card[],
  dealer: Card[],
  onStep: (display: TableDisplay, animKey: CardAnimKey) => void
): Promise<void> {
  const base: TableDisplay = {
    playerHand: [],
    dealerHand: [],
    showDealerHole: false,
    playerTotal: 0,
    dealerTotal: null,
  };

  onStep(base, null);
  await sleep(150);

  onStep(
    {
      ...base,
      playerHand: [player[0]],
      playerTotal: handValue([player[0]]),
    },
    "p-0"
  );
  await sleep(520);

  onStep(
    {
      playerHand: [player[0]],
      dealerHand: [dealer[0]],
      showDealerHole: false,
      playerTotal: handValue([player[0]]),
      dealerTotal: null,
    },
    "d-0"
  );
  await sleep(520);

  onStep(
    {
      playerHand: player.slice(0, 2),
      dealerHand: [dealer[0]],
      showDealerHole: false,
      playerTotal: handValue(player.slice(0, 2)),
      dealerTotal: null,
    },
    "p-1"
  );
  await sleep(520);

  onStep(
    {
      playerHand: player.slice(0, 2),
      dealerHand: [dealer[0]],
      showDealerHole: true,
      playerTotal: handValue(player.slice(0, 2)),
      dealerTotal: null,
    },
    "d-hole"
  );
  await sleep(420);
}

export async function animateDealerReveal(
  player: Card[],
  dealer: Card[],
  onStep: (display: TableDisplay, animKey: CardAnimKey) => void
): Promise<void> {
  onStep(
    {
      playerHand: player,
      dealerHand: dealer.slice(0, 2),
      showDealerHole: false,
      playerTotal: handValue(player),
      dealerTotal: handValue(dealer.slice(0, 2)),
    },
    "d-1"
  );
  await sleep(620);

  for (let i = 2; i < dealer.length; i++) {
    onStep(
      {
        playerHand: player,
        dealerHand: dealer.slice(0, i + 1),
        showDealerHole: false,
        playerTotal: handValue(player),
        dealerTotal: handValue(dealer.slice(0, i + 1)),
      },
      `d-${i}`
    );
    await sleep(520);
  }
}

export function displayFromView(
  playerHand: Card[],
  dealerHand: Card[],
  dealerHidden: boolean,
  playerTotal: number,
  dealerTotal: number | null
): TableDisplay {
  return {
    playerHand,
    dealerHand: dealerHidden ? dealerHand.slice(0, 1) : dealerHand,
    showDealerHole: dealerHidden && dealerHand.length > 0,
    playerTotal,
    dealerTotal,
  };
}
