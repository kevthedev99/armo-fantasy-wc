interface RankChangeBadgeProps {
  change: number;
  className?: string;
}

export function RankChangeBadge({ change, className = "" }: RankChangeBadgeProps) {
  if (change === 0) return null;

  const movedUp = change > 0;
  const label = `${movedUp ? "Up" : "Down"} ${Math.abs(change)} spot${
    Math.abs(change) === 1 ? "" : "s"
  }`;

  return (
    <span
      className={`inline-flex items-center gap-0.5 text-xs font-bold ${
        movedUp ? "text-[#32CD32]" : "text-red-500"
      } ${className}`}
      title={label}
      aria-label={label}
    >
      <span aria-hidden>{movedUp ? "↑" : "↓"}</span>
      <span>{Math.abs(change)}</span>
    </span>
  );
}
