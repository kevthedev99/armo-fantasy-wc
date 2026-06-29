export function EliminationMark({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-red-100 text-[10px] font-black leading-none text-red-600 ring-1 ring-red-300 sm:h-[18px] sm:w-[18px] sm:text-[11px] ${className}`}
      title="Eliminated from your bracket"
      aria-label="Eliminated from your bracket"
    >
      ✕
    </span>
  );
}

interface EliminatedTeamNameProps {
  name: string;
  eliminated?: boolean;
  className?: string;
  /** When true, mark appears after the name (away side in score rows). */
  markAfter?: boolean;
}

export function EliminatedTeamName({
  name,
  eliminated = false,
  className = "",
  markAfter = false,
}: EliminatedTeamNameProps) {
  if (!eliminated) {
    return <span className={className}>{name}</span>;
  }

  const text = (
    <span
      className={`min-w-0 truncate line-through decoration-red-400/80 ${
        markAfter ? "text-right" : ""
      }`}
    >
      {name}
    </span>
  );

  return (
    <span
      className={`inline-flex min-w-0 max-w-full items-center gap-1 opacity-70 ${
        markAfter ? "flex-row-reverse" : ""
      } ${className}`}
    >
      <EliminationMark />
      {text}
    </span>
  );
}
