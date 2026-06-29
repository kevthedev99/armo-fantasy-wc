"use client";

import { useState } from "react";
import { formatKickoffPST } from "@/lib/format-pst";
import {
  formatPickSummary,
  getKnockoutBasePoints,
  normalizeGroupScore,
  SCORING,
  validateKnockoutPick,
} from "@/lib/scoring";
import {
  isVirtualMatchId,
  parseVirtualMatchSlot,
} from "@/lib/bracket-slot-picks";
import { buildBracketSlotPick } from "@/lib/bracket-slot-picks";
import type { BracketSlotPick, BracketSlotRoundId, Match, Pick, PickWinner } from "@/lib/types";
import {
  KnockoutPickFields,
  outcomeModeFromPick,
  type KnockoutOutcomeMode,
} from "@/components/KnockoutPickFields";

interface BracketPickPanelProps {
  match: Match;
  pick?: Pick;
  slotPick?: BracketSlotPick;
  userId?: string;
  locked: boolean;
  onClose: () => void;
  onSaved: (pick: Pick) => void;
  onSlotSaved: (slotPick: BracketSlotPick) => void | Promise<void>;
  /** When provided, shows a "Save & Next" button that advances after saving. */
  onAdvanceToNext?: () => boolean;
  /** Label of the next round, when "Save & Next" would cross into a new round. */
  nextRoundLabel?: string | null;
}

function BracketPickForm({
  match,
  pick,
  slotPick,
  userId,
  locked,
  onClose,
  onSaved,
  onSlotSaved,
  onAdvanceToNext,
  nextRoundLabel,
}: BracketPickPanelProps) {
  const existing = pick ?? slotPick;
  const [pickedWinner, setPickedWinner] = useState<PickWinner>(
    existing?.picked_winner ?? "home"
  );
  const [homeScore, setHomeScore] = useState(
    existing?.home_score_pred != null ? String(existing.home_score_pred) : "0"
  );
  const [awayScore, setAwayScore] = useState(
    existing?.away_score_pred != null ? String(existing.away_score_pred) : "0"
  );
  const [outcomeMode, setOutcomeMode] = useState<KnockoutOutcomeMode>(
    outcomeModeFromPick(existing)
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const points = getKnockoutBasePoints(match.round);
  const predictsPenalties = outcomeMode === "penalties";

  async function savePick(advanceAfter: boolean = false) {
    if (locked) return;

    const homeScorePred = predictsPenalties
      ? null
      : normalizeGroupScore(homeScore);
    const awayScorePred = predictsPenalties
      ? null
      : normalizeGroupScore(awayScore);

    const scoreError = validateKnockoutPick(
      pickedWinner,
      homeScorePred ?? 0,
      awayScorePred ?? 0,
      predictsPenalties
    );
    if (scoreError) {
      setError(scoreError);
      return;
    }

    setSaving(true);
    setError(null);

    const virtualSlot = parseVirtualMatchSlot(match.id);

    if (virtualSlot) {
      if (!userId) {
        setSaving(false);
        setError("Sign in to save bracket picks.");
        return;
      }

      try {
        await onSlotSaved(
          buildBracketSlotPick(
            userId,
            virtualSlot.roundId as BracketSlotRoundId,
            virtualSlot.slotIndex,
            match,
            pickedWinner,
            homeScorePred,
            awayScorePred,
            predictsPenalties
          )
        );
        if (advanceAfter && onAdvanceToNext && onAdvanceToNext()) {
          return;
        }
        onClose();
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to save bracket pick."
        );
      } finally {
        setSaving(false);
      }
      return;
    }

    const res = await fetch("/api/picks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        matchId: match.id,
        pickedWinner,
        homeScorePred,
        awayScorePred,
        predictsPenalties,
      }),
    });

    const data = await res.json();
    setSaving(false);

    if (!res.ok) {
      setError(data.error ?? "Failed to save pick.");
      return;
    }

    onSaved(data.pick);
    if (advanceAfter && onAdvanceToNext && onAdvanceToNext()) {
      return;
    }
    onClose();
  }

  const previewPick = {
    ...pick,
    ...slotPick,
    picked_winner: pickedWinner,
    home_score_pred: predictsPenalties ? null : normalizeGroupScore(homeScore),
    away_score_pred: predictsPenalties ? null : normalizeGroupScore(awayScore),
    predicts_penalties: predictsPenalties,
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
          {isVirtualMatchId(match.id)
            ? "Bracket path · "
            : `${formatKickoffPST(match.kickoff_at)} · `}
          {predictsPenalties
            ? `+${points} winner · +${SCORING.knockout.penaltiesWinnerBonus} if pens`
            : `+${points} winner · +5 exact`}
        </p>
      </div>

      <div className="p-5">
        {locked ? (
          <div className="text-center">
            {pick || slotPick ? (
              <p className="rounded-xl bg-gray-100 px-4 py-3 text-sm font-bold text-gray-800">
                {formatPickSummary(match, previewPick)}
              </p>
            ) : (
              <p className="text-sm text-amber-800">
                No pick saved — this match already started.
              </p>
            )}
            <p className="mt-3 text-xs text-gray-500">
              Locked — picks cannot be changed after kickoff.
            </p>
          </div>
        ) : (
          <>
            <KnockoutPickFields
              match={match}
              outcomeMode={outcomeMode}
              onOutcomeModeChange={setOutcomeMode}
              pickedWinner={pickedWinner}
              onPickedWinnerChange={setPickedWinner}
              homeScore={homeScore}
              awayScore={awayScore}
              onHomeScoreChange={setHomeScore}
              onAwayScoreChange={setAwayScore}
            />

            {error && (
              <p className="mb-3 text-center text-xs text-red-600">{error}</p>
            )}

            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={() => savePick(false)}
                disabled={saving}
                className={`flex-1 rounded-xl bg-[#FF007A] py-3 text-sm font-black uppercase tracking-wide text-white transition hover:opacity-90 disabled:opacity-50 ${
                  onAdvanceToNext ? "" : "w-full"
                }`}
              >
                {saving ? "Saving…" : pick || slotPick ? "Update Pick" : "Save Pick"}
              </button>
              {onAdvanceToNext && (
                <button
                  type="button"
                  onClick={() => savePick(true)}
                  disabled={saving}
                  className={`flex-1 rounded-xl py-3 text-sm font-black uppercase tracking-wide text-white transition hover:opacity-90 disabled:opacity-50 ${
                    nextRoundLabel
                      ? "bg-gradient-to-r from-[#0056b3] to-[#FF007A] shadow"
                      : "bg-[#0056b3]"
                  }`}
                >
                  {nextRoundLabel ? `Next: ${nextRoundLabel} →` : "Save & Next →"}
                </button>
              )}
            </div>

            {(pick || slotPick) && (
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
