import { NextResponse } from "next/server";
import {
  deleteBracketSlotPickRow,
  fetchBracketSlotPicksForUser,
  isBracketSlotPicksTableError,
  parseBracketSlotPickInput,
  rowToBracketSlotPick,
  upsertBracketSlotPickRow,
} from "@/lib/bracket-slot-pick-db";
import { isKnockoutBracketLocked } from "@/lib/knockout-bracket";
import type { BracketSlotRoundId } from "@/lib/types";
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
    .select("stage, round, kickoff_at, status");

  if (isKnockoutBracketLocked(allMatches ?? [])) {
    return NextResponse.json(
      {
        error:
          "Knockout bracket is locked — the deadline has passed. You cannot add or change bracket picks.",
      },
      { status: 403 }
    );
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
