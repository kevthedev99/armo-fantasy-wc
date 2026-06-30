"use client";

import { format } from "date-fns";
import { useMemo, useState } from "react";
import type { MatchPickDistribution } from "@/lib/match-pick-distribution";
import { MatchPickDistributionView } from "@/components/MatchPickDistributionView";
import { getPSTDateKey, formatPSTDateHeader } from "@/lib/match-status";

type AllPicksDistributionViewProps = {
  distributions: MatchPickDistribution[];
};

function MatchSummaryRow({
  distribution,
  expanded,
  onToggle,
}: {
  distribution: MatchPickDistribution;
  expanded: boolean;
  onToggle: () => void;
}) {
  const kickoff = format(new Date(distribution.kickoff), "h:mm a");
  const top = distribution.mostPickedScoreLine;

  return (
    <article className="border-b border-gray-800 last:border-b-0">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-gray-900/60 sm:px-6"
      >
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-white">
            {distribution.homeTeam} vs {distribution.awayTeam}
          </p>
          <p className="mt-0.5 text-xs text-gray-500">
            {distribution.round} · {kickoff} PST
            {distribution.actualScore ? ` · Final ${distribution.actualScore}` : ""}
          </p>
        </div>
        <div className="shrink-0 text-right">
          {distribution.totalPickers === 0 ? (
            <p className="text-sm text-gray-500">No picks</p>
          ) : top ? (
            <>
              <p className="text-sm font-semibold text-[#FF007A]">{top.label}</p>
              <p className="text-xs text-gray-400">
                {top.count} ({top.pct}%)
              </p>
            </>
          ) : null}
        </div>
        <span className="mt-1 shrink-0 text-xs text-gray-500" aria-hidden>
          {expanded ? "▲" : "▼"}
        </span>
      </button>
      {expanded && (
        <div className="border-t border-gray-800 bg-gray-950/40 px-2 pb-4 sm:px-4">
          <MatchPickDistributionView distribution={distribution} compact />
        </div>
      )}
    </article>
  );
}

export function AllPicksDistributionView({
  distributions,
}: AllPicksDistributionViewProps) {
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const grouped = useMemo(() => {
    const map = new Map<string, MatchPickDistribution[]>();
    for (const distribution of distributions) {
      const key = getPSTDateKey(distribution.kickoff);
      const list = map.get(key) ?? [];
      list.push(distribution);
      map.set(key, list);
    }
    return [...map.entries()];
  }, [distributions]);

  const withPicks = distributions.filter((d) => d.totalPickers > 0).length;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 md:px-8">
      <p className="text-xs font-bold uppercase tracking-widest text-[#FF007A]">
        Private crowd wisdom
      </p>
      <h1 className="mt-2 font-display text-4xl uppercase leading-none text-white">
        All match picks
      </h1>
      <p className="mt-4 text-sm text-gray-300">
        {withPicks} of {distributions.length} matches have picks. Tap a match for
        the full breakdown. Individual pickers are not shown.
      </p>

      <div className="mt-8 space-y-8">
        {grouped.map(([dateKey, dayMatches]) => (
          <section key={dateKey}>
            <h2 className="mb-2 px-4 text-xs font-bold uppercase tracking-widest text-gray-500 sm:px-6">
              {formatPSTDateHeader(dayMatches[0].kickoff)}
            </h2>
            <div className="overflow-hidden rounded-xl border border-gray-800 bg-black">
              {dayMatches.map((distribution) => (
                <MatchSummaryRow
                  key={distribution.matchId}
                  distribution={distribution}
                  expanded={expandedId === distribution.matchId}
                  onToggle={() =>
                    setExpandedId((current) =>
                      current === distribution.matchId ? null : distribution.matchId
                    )
                  }
                />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
