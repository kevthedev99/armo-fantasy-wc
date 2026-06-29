import { NextResponse } from "next/server";
import {
  deleteBracketSlotPickRow,
  fetchBracketSlotPicksForUser,
  isBracketSlotPicksTableError,
  parseBracketSlotPickInput,
  rowToBracketSlotPick,
  upsertBracketSlotPickRow,
} from "@/lib/bracket-slot-pick-db";
import { isBracketSlotPickLocked } from "@/lib/migrate-bracket-slot-picks";
import { buildVirtualMatch, getColumnById } from "@/lib/bracket-slot-picks";
import { validateStrictBracketSlotPickForUser } from "@/lib/validate-bracket-pick";
import type { BracketSlotRoundId, Match } from "@/lib/types";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const { picks, tableMissing } = await fetchBracketSlotPicksForUser(
    supabase,
    user.id
  );

  return NextResponse.json({ picks, tableMissing });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const input = parseBracketSlotPickInput(await request.json());
  if (!input) {
    return NextResponse.json({ error: "Invalid bracket pick data." }, { status: 400 });
  }

  const { data: allMatches } = await supabase
    .from("matches")
    .select("stage, round, kickoff_at, status, home_team_id, away_team_id, home_team_name, away_team_name, home_team_logo, away_team_logo");

  if (isBracketSlotPickLocked(input, (allMatches ?? []) as Match[])) {
    return NextResponse.json(
      {
        error:
          "This match has started or finished — your pick is locked and cannot be changed.",
      },
      { status: 403 }
    );
  }

  const column = getColumnById(input.round_id);
  if (!column) {
    return NextResponse.json({ error: "Invalid round." }, { status: 400 });
  }

  function teamPreview(teamId: number) {
    for (const m of allMatches ?? []) {
      if (m.home_team_id === teamId) {
        return {
          id: teamId,
          name: m.home_team_name as string,
          logo: m.home_team_logo as string | null,
        };
      }
      if (m.away_team_id === teamId) {
        return {
          id: teamId,
          name: m.away_team_name as string,
          logo: m.away_team_logo as string | null,
        };
      }
    }
    return { id: teamId, name: `Team ${teamId}`, logo: null };
  }

  const virtualMatch = buildVirtualMatch(
    column,
    input.slot_index,
    teamPreview(input.home_team_id),
    teamPreview(input.away_team_id)
  );

  const bracketError = await validateStrictBracketSlotPickForUser(
    supabase,
    user.id,
    input.round_id,
    input.slot_index,
    virtualMatch,
    input.picked_winner,
    (allMatches ?? []) as Match[]
  );
  if (bracketError) {
    return NextResponse.json({ error: bracketError }, { status: 400 });
  }

  const { data, error } = await upsertBracketSlotPickRow(
    supabase,
    user.id,
    input
  );

  if (error) {
    if (isBracketSlotPicksTableError(error.message)) {
      return NextResponse.json(
        {
          error: "Could not save bracket pick right now. Please try again.",
          tableMissing: true,
        },
        { status: 503 }
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ pick: rowToBracketSlotPick(data) });
}

export async function DELETE(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const url = new URL(request.url);
  const roundId = url.searchParams.get("roundId") as BracketSlotRoundId | null;
  const slotIndex = Number(url.searchParams.get("slotIndex"));

  if (
    !roundId ||
    !["r16", "qf", "sf", "final", "third"].includes(roundId) ||
    !Number.isInteger(slotIndex)
  ) {
    return NextResponse.json({ error: "Invalid slot." }, { status: 400 });
  }

  const { data: allMatches } = await supabase
    .from("matches")
    .select("stage, round, kickoff_at, status, home_team_id, away_team_id, home_team_name, away_team_name, home_team_logo, away_team_logo");

  if (
    isBracketSlotPickLocked(
      { round_id: roundId, slot_index: slotIndex },
      (allMatches ?? []) as Match[]
    )
  ) {
    return NextResponse.json(
      {
        error:
          "This match has started or finished — your pick is locked and cannot be changed.",
      },
      { status: 403 }
    );
  }

  const { error } = await deleteBracketSlotPickRow(
    supabase,
    user.id,
    roundId,
    slotIndex
  );

  if (error) {
    if (isBracketSlotPicksTableError(error.message)) {
      return NextResponse.json({ tableMissing: true }, { status: 503 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
