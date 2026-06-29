"use client";

import { useRouter } from "next/navigation";

export type BracketInspectorOption = {
  id: string;
  username: string;
  display_name: string;
};

interface BracketInspectorBarProps {
  profiles: BracketInspectorOption[];
  activeUserId: string;
  selfUsername: string;
}

export function BracketInspectorBar({
  profiles,
  activeUserId,
  selfUsername,
}: BracketInspectorBarProps) {
  const router = useRouter();

  const sorted = [...profiles].sort((a, b) =>
    a.display_name.localeCompare(b.display_name, undefined, {
      sensitivity: "base",
    })
  );

  return (
    <div className="border-b border-[#FFD700]/30 bg-gradient-to-r from-[#1a1400] to-[#0a1628] px-4 py-3 sm:px-6">
      <div className="mx-auto flex max-w-7xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs font-bold uppercase tracking-wider text-[#FFD700]">
          Bracket inspector
        </p>
        <label className="flex min-w-0 flex-col gap-1 sm:max-w-md sm:flex-1 sm:flex-row sm:items-center sm:gap-3">
          <span className="shrink-0 text-[10px] font-bold uppercase tracking-wide text-gray-400">
            View player
          </span>
          <select
            value={activeUserId}
            onChange={(e) => {
              const next = sorted.find((p) => p.id === e.target.value);
              if (!next) return;
              const href =
                next.username.toLowerCase() === selfUsername.toLowerCase()
                  ? "/bracket"
                  : `/bracket?user=${encodeURIComponent(next.username)}`;
              router.push(href);
            }}
            className="w-full min-w-0 rounded-lg border border-[#FFD700]/40 bg-black/60 px-3 py-2 text-sm font-bold text-white outline-none focus:border-[#FFD700]"
          >
            {sorted.map((profile) => (
              <option key={profile.id} value={profile.id}>
                {profile.display_name} (@{profile.username})
              </option>
            ))}
          </select>
        </label>
      </div>
    </div>
  );
}
