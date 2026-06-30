import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MatchPickDistributionView } from "@/components/MatchPickDistributionView";
import { WorldCupLogo } from "@/components/WorldCupLogo";
import { fetchMatchPickDistribution } from "@/lib/match-pick-distribution";
import { verifyMatchShareToken } from "@/lib/match-share-token";
import { createServiceClient } from "@/lib/supabase/server";

type ShareMatchPageProps = {
  params: Promise<{ matchId: string }>;
  searchParams: Promise<{ token?: string }>;
};

export const metadata: Metadata = {
  title: "Match picks — Armo Fantasy World Cup",
  robots: { index: false, follow: false },
};

export default async function ShareMatchPage({
  params,
  searchParams,
}: ShareMatchPageProps) {
  const { matchId: matchIdRaw } = await params;
  const { token } = await searchParams;
  const matchId = Number(matchIdRaw);

  if (!Number.isFinite(matchId) || !verifyMatchShareToken(matchId, token)) {
    notFound();
  }

  const supabase = createServiceClient();
  const distribution = await fetchMatchPickDistribution(supabase, matchId);
  if (!distribution) {
    notFound();
  }

  return (
    <div className="min-h-full bg-black">
      <header className="border-b border-gray-800 px-4 py-4 md:px-8">
        <WorldCupLogo />
      </header>
      <MatchPickDistributionView distribution={distribution} />
    </div>
  );
}
