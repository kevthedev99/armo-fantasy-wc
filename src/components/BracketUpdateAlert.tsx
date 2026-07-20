"use client";

import { toBlob } from "html-to-image";
import { useEffect, useRef, useState } from "react";
import type { Profile } from "@/lib/types";

export type LeaderboardEntry = Pick<
  Profile,
  "id" | "username" | "display_name" | "avatar_color" | "total_points" | "total_wins"
>;

function Avatar({
  name,
  color,
  size,
}: {
  name: string;
  color: string;
  size: "sm" | "md" | "lg";
}) {
  const box =
    size === "lg"
      ? "h-14 w-14 text-xl sm:h-16 sm:w-16 sm:text-2xl"
      : size === "md"
        ? "h-11 w-11 text-base sm:h-12 sm:w-12"
        : "h-8 w-8 text-xs";

  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-full font-black text-white shadow-md ring-2 ring-white/80 ${box}`}
      style={{ backgroundColor: color }}
    >
      {name.charAt(0).toUpperCase()}
    </span>
  );
}

function PodiumPlace({
  entry,
  rank,
  place,
}: {
  entry: LeaderboardEntry | undefined;
  rank: 1 | 2 | 3;
  place: "left" | "center" | "right";
}) {
  const heights =
    rank === 1
      ? "h-28 sm:h-36"
      : rank === 2
        ? "h-20 sm:h-28"
        : "h-16 sm:h-24";
  const colors =
    rank === 1
      ? "from-[#FFD700] via-[#ffe566] to-[#c9a000] text-[#3d3200]"
      : rank === 2
        ? "from-gray-200 via-gray-100 to-gray-400 text-gray-700"
        : "from-[#cd7f32] via-[#e0a060] to-[#8b5a2b] text-[#3d2410]";
  const delay =
    place === "center" ? "0.15s" : place === "left" ? "0.35s" : "0.5s";
  const label =
    rank === 1 ? "Champion" : rank === 2 ? "2nd Place" : "3rd Place";

  return (
    <div
      className={`podium-rise flex w-[31%] flex-col items-center ${
        rank === 1 ? "z-10" : "z-0"
      }`}
      style={{ animationDelay: delay }}
    >
      {entry ? (
        <>
          <Avatar
            name={entry.display_name}
            color={entry.avatar_color}
            size={rank === 1 ? "lg" : "md"}
          />
          <p
            className={`mt-1.5 max-w-full truncate text-center font-black text-white ${
              rank === 1 ? "text-sm sm:text-base" : "text-xs sm:text-sm"
            }`}
          >
            {entry.display_name}
          </p>
          <p className="text-[10px] font-bold text-[#FFD700] sm:text-xs">
            {entry.total_points} pts
          </p>
        </>
      ) : (
        <p className="text-xs text-white/50">—</p>
      )}
      <div
        className={`mt-2 flex w-full flex-col items-center justify-end rounded-t-xl bg-gradient-to-b ${colors} ${heights} shadow-lg`}
      >
        <p className="font-display text-3xl leading-none sm:text-4xl">{rank}</p>
        <p className="mb-2 mt-0.5 text-[9px] font-bold uppercase tracking-wider sm:text-[10px]">
          {label}
        </p>
      </div>
    </div>
  );
}

/** Shown once per site visit — Top 10 celebration with save-to-image. */
export function BracketUpdateAlert({
  topTen,
}: {
  topTen: LeaderboardEntry[];
}) {
  const [open, setOpen] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const captureRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  if (!open) return null;

  const first = topTen[0];
  const second = topTen[1];
  const third = topTen[2];
  const rest = topTen.slice(3, 10);

  async function saveLeaderboardImage() {
    if (!captureRef.current || saving) return;
    setSaving(true);
    setSaveMessage(null);

    try {
      const blob = await toBlob(captureRef.current, {
        cacheBust: true,
        pixelRatio: 2,
        backgroundColor: "#0a1628",
      });
      if (!blob) throw new Error("Could not render image.");

      const file = new File([blob], "armo-wc-top-10.png", {
        type: "image/png",
      });

      const canShareFile =
        typeof navigator !== "undefined" &&
        typeof navigator.share === "function" &&
        (!navigator.canShare || navigator.canShare({ files: [file] }));

      if (canShareFile) {
        try {
          await navigator.share({
            files: [file],
            title: "Armo Fantasy WC Top 10",
            text: "Final Top 10 leaderboard",
          });
          setSaveMessage("Shared — save to Photos from the share sheet.");
          setSaving(false);
          return;
        } catch (err) {
          if (err instanceof Error && err.name === "AbortError") {
            setSaving(false);
            return;
          }
        }
      }

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "armo-wc-top-10.png";
      link.click();
      URL.revokeObjectURL(url);
      setSaveMessage("Image downloaded — check your Photos or Downloads.");
    } catch {
      setSaveMessage("Couldn't save image. Try a screenshot instead.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center p-3 sm:p-6"
      style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="bracket-update-alert-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/80"
        aria-label="Close alert"
        onClick={() => setOpen(false)}
      />
      <div className="relative flex max-h-[min(94dvh,820px)] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-[#FFD700]/50 bg-[#0a1628] shadow-2xl">
        <div className="shrink-0 border-b border-[#FFD700]/25 bg-gradient-to-r from-[#0a1628] via-[#0056b3] to-[#FF007A] px-4 py-3 text-center sm:px-5 sm:py-4">
          <p className="text-[9px] font-bold uppercase tracking-[0.35em] text-[#FFD700] sm:text-[10px]">
            Season Complete
          </p>
          <h2
            id="bracket-update-alert-title"
            className="final-alert-title font-display mt-1 text-2xl uppercase tracking-wide sm:mt-1.5 sm:text-4xl"
          >
            Top 10 Champions
          </h2>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <div
            ref={captureRef}
            className="bg-[#0a1628] px-3 pb-4 pt-3 sm:px-5 sm:pb-5 sm:pt-4"
          >
            <p className="mb-3 text-center text-[11px] font-medium leading-snug text-white/70 sm:text-sm">
              Congratulations to the podium — and everyone in the Top 10.
            </p>

            <div className="podium-stage mb-4 flex items-end justify-center gap-1.5 rounded-2xl border border-white/10 bg-gradient-to-b from-[#12203a] to-[#0a1628] px-2 pt-4 sm:gap-2 sm:px-3 sm:pt-5">
              <PodiumPlace entry={second} rank={2} place="left" />
              <PodiumPlace entry={first} rank={1} place="center" />
              <PodiumPlace entry={third} rank={3} place="right" />
            </div>

            {rest.length > 0 && (
              <div className="overflow-hidden rounded-xl border border-white/10 bg-black/30">
                <p className="border-b border-white/10 px-3 py-2 text-[10px] font-bold uppercase tracking-[0.2em] text-[#FFD700]">
                  Ranks 4–10
                </p>
                <ul className="divide-y divide-white/5">
                  {rest.map((entry, index) => {
                    const rank = index + 4;
                    return (
                      <li
                        key={entry.id}
                        className="flex items-center gap-2.5 px-3 py-2"
                      >
                        <span className="w-5 shrink-0 text-center text-xs font-black text-white/50">
                          {rank}
                        </span>
                        <Avatar
                          name={entry.display_name}
                          color={entry.avatar_color}
                          size="sm"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-bold text-white">
                            {entry.display_name}
                          </p>
                          <p className="text-[10px] text-white/45">
                            @{entry.username} · {entry.total_wins} wins
                          </p>
                        </div>
                        <span className="shrink-0 text-sm font-black text-[#FFD700]">
                          {entry.total_points}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

            <p className="mt-3 text-center text-[9px] font-bold uppercase tracking-[0.25em] text-white/35">
              Armo Fantasy World Cup 2026
            </p>
          </div>
        </div>

        <div className="shrink-0 space-y-2 border-t border-white/10 bg-[#0a1628] px-3 py-2.5 sm:px-5 sm:py-3">
          {saveMessage && (
            <p className="text-center text-[11px] text-[#FFD700]/90">
              {saveMessage}
            </p>
          )}
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={saveLeaderboardImage}
              disabled={saving || topTen.length === 0}
              className="min-h-11 flex-1 rounded-full border border-[#FFD700]/60 bg-[#FFD700]/15 px-4 py-3 text-sm font-bold uppercase tracking-wide text-[#FFD700] transition hover:bg-[#FFD700]/25 disabled:opacity-50"
            >
              {saving ? "Preparing…" : "Save to Photos"}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="min-h-11 flex-1 rounded-full bg-[#FF007A] px-4 py-3 text-sm font-bold uppercase tracking-wide text-white shadow-lg transition hover:opacity-90"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
