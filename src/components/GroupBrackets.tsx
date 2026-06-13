import type { GroupBracket } from "@/lib/types";

function TeamLogo({ src, name }: { src: string; name: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={name}
      className="h-5 w-5 shrink-0 object-contain sm:h-6 sm:w-6"
    />
  );
}

function FormDots({ form }: { form: string | null }) {
  if (!form) return <span className="text-gray-300">—</span>;

  return (
    <span className="inline-flex gap-0.5">
      {form.split("").map((result, i) => (
        <span
          key={`${result}-${i}`}
          className={`inline-block h-2 w-2 rounded-full sm:h-2.5 sm:w-2.5 ${
            result === "W"
              ? "bg-green-500"
              : result === "D"
                ? "bg-gray-400"
                : "bg-red-500"
          }`}
          title={result === "W" ? "Win" : result === "D" ? "Draw" : "Loss"}
        />
      ))}
    </span>
  );
}

function GroupTable({ group }: { group: GroupBracket }) {
  return (
    <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-100 bg-[#0056b3] px-3 py-2.5 sm:px-4">
        <h3 className="text-xs font-black uppercase tracking-widest text-white">
          {group.name}
        </h3>
      </div>

      <div className="hidden sm:block">
        <div className="grid grid-cols-[28px_1fr_36px_52px_36px_36px] gap-1 border-b border-gray-100 bg-gray-50 px-3 py-2 text-[10px] font-bold uppercase tracking-wide text-gray-500">
          <span>#</span>
          <span>Team</span>
          <span className="text-center">P</span>
          <span className="text-center">W-D-L</span>
          <span className="text-center">GD</span>
          <span className="text-right">Pts</span>
        </div>
        {group.teams.map((team) => (
          <div
            key={team.teamId}
            className={`grid grid-cols-[28px_1fr_36px_52px_36px_36px] items-center gap-1 border-b border-gray-50 px-3 py-2 last:border-b-0 ${
              team.rank <= 2 ? "bg-blue-50/40" : ""
            }`}
          >
            <span className="text-xs font-bold text-gray-500">{team.rank}</span>
            <div className="flex min-w-0 items-center gap-2">
              <TeamLogo src={team.logo} name={team.name} />
              <span className="truncate text-sm font-semibold text-gray-900">
                {team.name}
              </span>
            </div>
            <span className="text-center text-xs text-gray-600">{team.played}</span>
            <span className="text-center text-xs text-gray-600">
              {team.win}-{team.draw}-{team.lose}
            </span>
            <span
              className={`text-center text-xs font-semibold ${
                team.goalsDiff > 0
                  ? "text-green-600"
                  : team.goalsDiff < 0
                    ? "text-red-600"
                    : "text-gray-600"
              }`}
            >
              {team.goalsDiff > 0 ? `+${team.goalsDiff}` : team.goalsDiff}
            </span>
            <span className="text-right text-sm font-black text-[#0056b3]">
              {team.points}
            </span>
          </div>
        ))}
      </div>

      <div className="divide-y divide-gray-100 sm:hidden">
        {group.teams.map((team) => (
          <div
            key={team.teamId}
            className={`flex items-center gap-2 px-3 py-2.5 ${
              team.rank <= 2 ? "bg-blue-50/40" : ""
            }`}
          >
            <span className="w-4 shrink-0 text-xs font-bold text-gray-500">
              {team.rank}
            </span>
            <TeamLogo src={team.logo} name={team.name} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-gray-900">
                {team.name}
              </p>
              <p className="text-[10px] text-gray-500">
                {team.played} played · {team.win}-{team.draw}-{team.lose} · GD{" "}
                {team.goalsDiff > 0 ? `+${team.goalsDiff}` : team.goalsDiff}
              </p>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-sm font-black text-[#0056b3]">{team.points}</p>
              <div className="mt-0.5 flex justify-end">
                <FormDots form={team.form} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

interface GroupBracketsProps {
  groups: GroupBracket[];
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
}

export function GroupBrackets({
  groups,
  loading = false,
  error = null,
  onRetry,
}: GroupBracketsProps) {
  if (loading) {
    return (
      <p className="py-12 text-center text-sm text-gray-500">
        Loading group standings…
      </p>
    );
  }

  if (groups.length === 0) {
    return (
      <div className="space-y-3 py-12 text-center">
        <p className="text-sm text-gray-500">
          {error ?? "Group standings are not available right now."}
        </p>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="rounded-full bg-[#0056b3] px-4 py-2 text-xs font-bold uppercase tracking-wide text-white"
          >
            Retry
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-gray-500">
        Top two in each group advance. Tables update from API-Football standings.
      </p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {groups.map((group) => (
          <GroupTable key={group.name} group={group} />
        ))}
      </div>
    </div>
  );
}
