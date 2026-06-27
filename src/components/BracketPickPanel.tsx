"use client";

import { useState } from "react";
import { formatKickoffPST } from "@/lib/format-pst";
import {
  formatPickSummary,
  getKnockoutBasePoints,
  normalizeGroupScore,
  validateKnockoutPickScores,
} from "@/lib/scoring";
import type { Match, Pick, PickWinner } from "@/lib/types";

interface BracketPickPanelProps {
  match: Match;
  pick?: Pick;
  locked: boolean;
  onClose: () => void;
  onSaved: (pick: Pick) => void;
}

function BracketPickForm({
  match,
  pick,
  locked,
  onClose,
  onSaved,
}: BracketPickPanelProps) {
  const [pickedWinner, setPickedWinner] = useState<PickWinner>(
    pick?.picked_winner ?? "home"
  );
  const [homeScore, setHomeScore] = useState(
    pick?.home_score_pred != null ? String(pick.home_score_pred) : "0"
  );
  const [awayScore, setAwayScore] = useState(
    pick?.away_score_pred != null ? String(pick.away_score_pred) : "0"
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const points = getKnockoutBasePoints(match.round);

  async function savePick() {
    if (locked) return;

    const resolvedHome = normalizeGroupScore(homeScore);
    const resolvedAway = normalizeGroupScore(awayScore);
    const scoreError = validateKnockoutPickScores(
      pickedWinner,
      resolvedHome,
      resolvedAway
    );
    if (scoreError) {
      setError(scoreError);
      return;
    }

    setSaving(true);
    setError(null);

    const res = await fetch("/api/picks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        matchId: match.id,
        pickedWinner,
        homeScorePred: resolvedHome,
        awayScorePred: resolvedAway,
      }),
    });

    const data = await res.json();
    setSaving(false);

    if (!res.ok) {
      setError(data.error ?? "Failed to save pick.");
      return;
    }

    onSaved(data.pick);
    onClose();
  }

  const previewPick = {
    ...pick,
    picked_winner: pickedWinner,
    home_score_pred: normalizeGroupScore(homeScore),
    away_score_pred: normalizeGroupScore(awayScore),
  } as Pick;

  return (
    <>
      <div className="sticky top-0 z-10 border-b border-gray-100 bg-gradient-to-r from-[#0a1628] to-[#0056b3] px-5 py-4 text-white">
        <p className="text-[10px] font-bold uppercase tracking-widest text-[#FFD700]">
          {match.round}
        </p>
        <h2 id="bracket-pick-title" className="mt-1 text-lg font-black uppercase">
          {match.home_team_name} vs {match.away_team_name}
        </h2>
        <p className="mt-1 text-xs text-white/70">
          {formatKickoffPST(match.kickoff_at)} · +{points} winner · +5 exact
        </p>
      </div>

      <div className="p-5">
        {locked ? (
          <div className="text-center">
            {pick ? (
              <p className="rounded-xl bg-gray-100 px-4 py-3 text-sm font-bold text-gray-800">
                {formatPickSummary(match, pick)}
              </p>
            ) : (
              <p className="text-sm text-amber-800">
                Bracket locked — no pick saved for this match.
              </p>
            )}
            <p className="mt-3 text-xs text-gray-500">
              Knockout bracket closed when Round of 32 started.
            </p>
          </div>
        ) : (
          <>
            <div className="mb-4 grid grid-cols-2 gap-2">
              {(
                [
                  ["home", match.home_team_name],
                  ["away", match.away_team_name],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setPickedWinner(value)}
                  className={`rounded-xl border px-2 py-3 text-xs font-bold uppercase transition ${
                    pickedWinner === value
                      ? "border-[#0056b3] bg-[#0056b3] text-white"
                      : "border-gray-200 bg-gray-50 text-gray-800 hover:border-[#0056b3]"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="mb-4 flex items-center justify-center gap-3">
              <input
                type="number"
                min={0}
                max={20}
                value={homeScore}
                onChange={(e) => setHomeScore(e.target.value)}
                className="w-16 rounded-lg border border-gray-300 px-2 py-2 text-center text-lg font-bold"
              />
              <span className="text-xl font-black text-gray-300">—</span>
              <input
                type="number"
                min={0}
                max={20}
                value={awayScore}
                onChange={(e) => setAwayScore(e.target.value)}
                className="w-16 rounded-lg border border-gray-300 px-2 py-2 text-center text-lg font-bold"
              />
            </div>

            {error && (
              <p className="mb-3 text-center text-xs text-red-600">{error}</p>
            )}

            <button
              type="button"
              onClick={savePick}
              disabled={saving}
              className="w-full rounded-xl bg-[#FF007A] py-3 text-sm font-black uppercase tracking-wide text-white transition hover:opacity-90 disabled:opacity-50"
            >
              {saving ? "Saving…" : pick ? "Update Pick" : "Save Pick"}
            </button>

            {pick && (
              <p className="mt-3 text-center text-xs text-gray-500">
                Current: {formatPickSummary(match, previewPick)}
              </p>
            )}
          </>
        )}

        <button
          type="button"
          onClick={onClose}
          className="mt-4 w-full rounded-xl border border-gray-200 py-2.5 text-sm font-bold uppercase text-gray-600 hover:bg-gray-50"
        >
          Close
        </button>
      </div>
    </>
  );
}

export function BracketPickPanel(props: BracketPickPanelProps) {
  const { match, onClose } = props;

  return (
    <div
      className="fixed inset-0 z-[110] flex items-end justify-center sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="bracket-pick-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/70"
        aria-label="Close pick panel"
        onClick={onClose}
      />
      <div className="relative max-h-[92vh] w-full overflow-y-auto rounded-t-2xl border border-[#FF007A]/30 bg-white shadow-2xl sm:max-w-md sm:rounded-2xl">
        <BracketPickForm key={match.id} {...props} />
      </div>
    </div>
  );
}
