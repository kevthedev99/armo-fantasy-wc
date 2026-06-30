import { format } from "date-fns";
import type { MatchPickDistribution } from "@/lib/match-pick-distribution";

type MatchPickDistributionViewProps = {
  distribution: MatchPickDistribution;
};

function DistributionBar({
  label,
  count,
  pct,
  maxCount,
}: {
  label: string;
  count: number;
  pct: number;
  maxCount: number;
}) {
  const width = maxCount > 0 ? Math.max(4, (count / maxCount) * 100) : 0;

  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="font-medium text-white">{label}</span>
        <span className="shrink-0 text-gray-400">
          {count} ({pct}%)
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-gray-800">
        <div
          className="h-full rounded-full bg-[#FF007A]"
          style={{ width: `${width}%` }}
        />
      </div>
    </div>
  );
}

export function MatchPickDistributionView({
  distribution,
  compact = false,
}: MatchPickDistributionViewProps & { compact?: boolean }) {
  const kickoff = format(new Date(distribution.kickoff), "EEE MMM d, h:mm a");
  const maxWinner = Math.max(
    ...distribution.winnerBreakdown.map((row) => row.count),
    1
  );
  const maxScore = Math.max(
    ...distribution.topScoreLines.map((row) => row.count),
    1
  );

  return (
    <div className={compact ? "px-2 py-4" : "mx-auto max-w-2xl px-4 py-8 md:px-8"}>
      {!compact && (
        <>
          <p className="text-xs font-bold uppercase tracking-widest text-[#FF007A]">
            Private crowd wisdom
          </p>
          <h1 className="mt-2 font-display text-4xl uppercase leading-none text-white">
            {distribution.homeTeam} vs {distribution.awayTeam}
          </h1>
          <p className="mt-2 text-sm text-gray-400">
            {distribution.round} · {kickoff} UTC · {distribution.status}
            {distribution.actualScore ? ` · Final ${distribution.actualScore}` : ""}
          </p>
        </>
      )}
      <p className={compact ? "text-sm text-gray-400" : "mt-4 text-sm text-gray-300"}>
        {distribution.totalPickers} pick{distribution.totalPickers === 1 ? "" : "s"}{" "}
        submitted. Individual pickers are not shown.
      </p>

      <section className="mt-8 space-y-4">
        <h2 className="text-xs font-bold uppercase tracking-widest text-gray-500">
          Predicted winner
        </h2>
        {distribution.winnerBreakdown.map((row) => (
          <DistributionBar
            key={row.side}
            label={row.winner}
            count={row.count}
            pct={row.pct}
            maxCount={maxWinner}
          />
        ))}
      </section>

      <section className="mt-10 space-y-4">
        <h2 className="text-xs font-bold uppercase tracking-widest text-gray-500">
          Score lines
        </h2>
        {distribution.topScoreLines.length === 0 ? (
          <p className="text-sm text-gray-400">No picks yet.</p>
        ) : (
          distribution.topScoreLines.map((row) => (
            <DistributionBar
              key={row.label}
              label={row.label}
              count={row.count}
              pct={row.pct}
              maxCount={maxScore}
            />
          ))
        )}
      </section>
    </div>
  );
}
