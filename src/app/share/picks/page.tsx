import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AllPicksDistributionView } from "@/components/AllPicksDistributionView";
import { WorldCupLogo } from "@/components/WorldCupLogo";
import { fetchAllMatchPickDistributions } from "@/lib/match-pick-distribution";
import { verifyPicksShareToken } from "@/lib/match-share-token";
import { createServiceClient } from "@/lib/supabase/server";

type SharePicksPageProps = {
  searchParams: Promise<{ token?: string }>;
};

export const metadata: Metadata = {
  title: "All match picks — Armo Fantasy World Cup",
  robots: { index: false, follow: false },
};

export default async function SharePicksPage({ searchParams }: SharePicksPageProps) {
  const { token } = await searchParams;

  if (!verifyPicksShareToken(token)) {
    notFound();
  }

  const supabase = createServiceClient();
  const distributions = await fetchAllMatchPickDistributions(supabase);

  return (
    <div className="min-h-full bg-black">
      <header className="border-b border-gray-800 px-4 py-4 md:px-8">
        <WorldCupLogo />
      </header>
      <AllPicksDistributionView distributions={distributions} />
    </div>
  );
}
