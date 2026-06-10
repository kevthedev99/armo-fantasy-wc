import { formatCard, isRedSuit, type Card } from "@/lib/blackjack";

interface PlayingCardProps {
  card?: Card;
  hidden?: boolean;
  animate?: "deal" | "flip" | false;
}

export function PlayingCard({ card, hidden, animate = false }: PlayingCardProps) {
  const animClass =
    animate === "deal"
      ? "card-deal-in"
      : animate === "flip"
        ? "card-flip-reveal"
        : "";

  if (hidden || !card) {
    return (
      <div
        className={`flex h-24 w-16 shrink-0 items-center justify-center rounded-lg border-2 border-[#FFD700]/50 bg-gradient-to-br from-[#0056b3] to-[#003366] shadow-lg sm:h-28 sm:w-20 ${animClass}`}
      >
        <span className="text-2xl text-[#FFD700]/80">🂠</span>
      </div>
    );
  }

  const red = isRedSuit(card.suit);

  return (
    <div
      className={`flex h-24 w-16 shrink-0 flex-col justify-between rounded-lg border border-white/20 bg-white p-2 shadow-lg sm:h-28 sm:w-20 ${animClass}`}
    >
      <span
        className={`text-sm font-black leading-none ${red ? "text-[#c41e3a]" : "text-black"}`}
      >
        {card.rank}
      </span>
      <span
        className={`text-center text-xl ${red ? "text-[#c41e3a]" : "text-black"}`}
      >
        {formatCard(card).slice(-1)}
      </span>
      <span
        className={`rotate-180 self-end text-sm font-black leading-none ${red ? "text-[#c41e3a]" : "text-black"}`}
      >
        {card.rank}
      </span>
    </div>
  );
}
