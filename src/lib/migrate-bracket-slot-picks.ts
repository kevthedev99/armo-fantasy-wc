import type { BracketSlotPick, Match } from "@/lib/types";
import { groupKnockoutMatches } from "@/lib/knockout-bracket-layout";
import { mapSlotPickToMatch } from "@/lib/bracket-slot-picks";

export function getSyncedMatchForSlotPick(
  matches: Match[],
  slotPick: BracketSlotPick
): Match | undefined {
  const grouped = groupKnockoutMatches(matches);
  const match = grouped.get(slotPick.round_id)?.[slotPick.slot_index];
  if (!match) return undefined;

  const teamsMatch =
    (slotPick.home_team_id === match.home_team_id &&
      slotPick.away_team_id === match.away_team_id) ||
    (slotPick.home_team_id === match.away_team_id &&
      slotPick.away_team_id === match.home_team_id);

  return teamsMatch ? match : undefined;
}

export function slotPickToPickPayload(
  slotPick: BracketSlotPick,
  match: Match
) {
  const mapped = mapSlotPickToMatch(slotPick, match);
  return {
    matchId: match.id,
    pickedWinner: mapped.picked_winner,
    homeScorePred: mapped.home_score_pred,
    awayScorePred: mapped.away_score_pred,
    predictsPenalties: mapped.predicts_penalties,
  };
}
