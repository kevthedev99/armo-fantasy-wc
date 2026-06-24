import Link from "next/link";
import { formatRoundOf32StartLabel } from "@/lib/knockout-bracket";
import { SCORING } from "@/lib/scoring";

const KNOCKOUT_ROUNDS = [
  { round: "Round of 32", points: SCORING.knockout["Round of 32"] },
  { round: "Round of 16", points: SCORING.knockout["Round of 16"] },
  { round: "Quarter-finals", points: SCORING.knockout["Quarter-finals"] },
  { round: "Semi-finals", points: SCORING.knockout["Semi-finals"] },
  { round: "Third Place", points: SCORING.knockout["3rd Place Final"] },
  { round: "Final", points: SCORING.knockout.Final },
];

export function RulesPage() {
  const roundOf32Start = formatRoundOf32StartLabel();

  return (
    <div className="min-h-screen bg-black text-white">
      <header className="border-b border-gray-800 bg-gradient-to-b from-[#0a1628] to-black px-6 py-12 text-center md:px-8">
        <p className="text-xs font-bold uppercase tracking-[0.35em] text-[#FFD700]">
          Armo Fantasy World Cup 2026
        </p>
        <h1 className="mt-3 text-4xl font-black uppercase tracking-tight md:text-6xl">
          League Rules
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-sm text-gray-400 md:text-base">
          Pick every World Cup match, climb the leaderboard, and compete for the
          top 3 payouts.
        </p>
      </header>

      <div className="mx-auto max-w-4xl space-y-6 px-4 py-10 md:px-8">
        <section className="overflow-hidden rounded-2xl border border-[#FFD700]/30 bg-gradient-to-br from-[#1a1400] to-black">
          <div className="border-b border-[#FFD700]/20 bg-[#FFD700]/10 px-6 py-4">
            <h2 className="text-lg font-black uppercase tracking-wide text-[#FFD700]">
              The Stakes
            </h2>
          </div>
          <div className="px-6 py-6">
            <p className="text-3xl font-black uppercase text-white md:text-4xl">
              $25 Buy-In
            </p>
            <p className="mt-2 text-xl font-bold text-[#32CD32]">
              Top 3 Split the Pot
            </p>
            <p className="mt-4 text-sm leading-relaxed text-gray-400">
              Everyone puts in $25. When the tournament ends, the top three on
              the standings split the full prize pool. Tiebreaker: most total
              wins, then highest point total.
            </p>
            <div className="mt-6 space-y-3">
              <div className="flex items-center justify-between rounded-lg border border-[#FFD700]/30 bg-black/50 px-4 py-3">
                <span className="text-sm font-bold text-[#FFD700]">
                  👑 1st Place
                </span>
                <span className="font-black text-white">80% of pot</span>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-gray-600 bg-black/50 px-4 py-3">
                <span className="text-sm font-bold text-gray-200">
                  🥈 2nd Place
                </span>
                <span className="font-black text-white">15% of pot</span>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-[#cd7f32]/40 bg-black/50 px-4 py-3">
                <span className="text-sm font-bold text-[#cd7f32]">
                  🥉 3rd Place
                </span>
                <span className="font-black text-white">5% of pot</span>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-[#32CD32]/30 bg-[#111]">
          <div className="border-b border-[#32CD32]/20 bg-[#32CD32]/10 px-6 py-4">
            <h2 className="text-lg font-black uppercase tracking-wide text-[#32CD32]">
              How to Pay
            </h2>
          </div>
          <div className="space-y-4 px-6 py-6 text-sm leading-relaxed text-gray-300">
            <p>
              Send your <strong className="text-white">$25 buy-in</strong> via{" "}
              <strong className="text-white">Zelle</strong> to:
            </p>
            <p className="rounded-xl border border-[#32CD32]/30 bg-black/50 px-5 py-4 text-center">
              <span className="block text-xs font-bold uppercase tracking-widest text-gray-500">
                Zelle to
              </span>
              <span className="mt-1 block text-2xl font-black tracking-wide text-white">
                626-487-8011
              </span>
            </p>
            <p>
              Include your <strong className="text-white">username</strong> in
              the Zelle memo so we know it&apos;s you. You must pay to be
              eligible for prizes — picks still require an account and invite
              code <strong className="text-white">WC26</strong>.
            </p>
          </div>
        </section>

        <section className="rounded-2xl border border-gray-800 bg-[#111]">
          <div className="border-b border-gray-800 px-6 py-4">
            <h2 className="text-lg font-black uppercase tracking-wide text-[#FF007A]">
              How to Play
            </h2>
          </div>
          <ul className="space-y-4 px-6 py-6 text-sm leading-relaxed text-gray-300">
            <li className="flex gap-3">
              <span className="mt-0.5 font-black text-[#FFD700]">01</span>
              <span>
                Sign up with a username, password, and invite code{" "}
                <strong className="text-white">WC26</strong>.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="mt-0.5 font-black text-[#FFD700]">02</span>
              <span>
                <strong className="text-white">Group stage</strong>: pick the
                winner (or tie) plus both scores before each match kicks off.
                You can change picks anytime until that match{" "}
                <strong className="text-white">actually starts</strong>.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="mt-0.5 font-black text-[#FFD700]">03</span>
              <span>
                <strong className="text-white">Knockout bracket</strong> unlocks
                once every group stage match is finished — like NCAA March
                Madness, you must submit{" "}
                <strong className="text-white">all knockout picks</strong>{" "}
                before the <strong className="text-white">Round of 32</strong>{" "}
                begins on{" "}
                <strong className="text-white">{roundOf32Start}</strong>. When
                the first Round of 32 match kicks off, your entire knockout
                bracket locks permanently.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="mt-0.5 font-black text-[#FFD700]">04</span>
              <span>
                Pick the winner plus both scores for every knockout match.
                Correct winner earns round points (see below); exact score adds
                a <strong className="text-white">+5 bonus</strong>, same as
                group stage.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="mt-0.5 font-black text-[#FFD700]">05</span>
              <span>
                Check the standings anytime. Last place gets the{" "}
                <strong className="text-amber-400">Last Place</strong> badge.
              </span>
            </li>
          </ul>
        </section>

        <div className="grid gap-6 md:grid-cols-2">
          <section className="rounded-2xl border border-gray-800 bg-[#111]">
            <div className="border-b border-gray-800 bg-[#0056b3]/20 px-6 py-4">
              <h2 className="text-lg font-black uppercase tracking-wide text-[#5b9bd5]">
                Group Stage Scoring
              </h2>
            </div>
            <div className="space-y-3 px-6 py-6">
              <div className="flex items-center justify-between rounded-lg bg-black/50 px-4 py-3">
                <span className="text-sm text-gray-300">Correct winner or tie</span>
                <span className="font-black text-[#FFD700]">
                  +{SCORING.group.correctWinner} pt
                </span>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-black/50 px-4 py-3">
                <span className="text-sm text-gray-300">Exact score bonus</span>
                <span className="font-black text-[#32CD32]">
                  +{SCORING.group.exactScoreBonus} pts
                </span>
              </div>
              <p className="text-xs text-gray-500">
                Your predicted scores must match your chosen winner (e.g. if you
                pick Mexico to win, Mexico&apos;s score must be higher).
              </p>
            </div>
          </section>

          <section className="rounded-2xl border border-gray-800 bg-[#111]">
            <div className="border-b border-gray-800 bg-[#FF007A]/10 px-6 py-4">
              <h2 className="text-lg font-black uppercase tracking-wide text-[#FF007A]">
                Knockout Scoring
              </h2>
            </div>
            <div className="space-y-2 px-6 py-6">
              {KNOCKOUT_ROUNDS.map(({ round, points }) => (
                <div
                  key={round}
                  className="flex items-center justify-between rounded-lg bg-black/50 px-4 py-2.5"
                >
                  <span className="text-sm text-gray-300">{round}</span>
                  <span className="font-black text-white">+{points} pts</span>
                </div>
              ))}
              <div className="flex items-center justify-between rounded-lg bg-black/50 px-4 py-3">
                <span className="text-sm text-gray-300">Exact score bonus</span>
                <span className="font-black text-[#32CD32]">
                  +{SCORING.group.exactScoreBonus} pts
                </span>
              </div>
              <p className="text-xs text-gray-500">
                Pick winner and score for every knockout match. Deeper rounds pay
                more for the correct winner; nail the exact score for +5 more.
                <strong className="text-gray-300">
                  {" "}
                  Sleeper-style chaining: if a team you picked to win loses,
                  that team is crossed out — but other teams you picked can
                  still score in later rounds.
                </strong>{" "}
                Fill your full bracket before Round of 32 starts — then it locks.
              </p>
            </div>
          </section>
        </div>

        <section className="rounded-2xl border border-[#FF007A]/30 bg-[#111]">
          <div className="border-b border-[#FF007A]/20 bg-[#FF007A]/10 px-6 py-4">
            <h2 className="text-lg font-black uppercase tracking-wide text-[#FF007A]">
              Knockout Bracket (March Madness Style)
            </h2>
          </div>
          <ul className="space-y-3 px-6 py-6 text-sm leading-relaxed text-gray-300">
            <li>
              • After the group stage ends, the knockout tab opens for everyone
              at the same time.
            </li>
            <li>
              • You fill out your entire bracket — Round of 32 through the Final
              — before <strong className="text-white">{roundOf32Start}</strong>.
            </li>
            <li>
              • Unlike group stage picks (which lock match-by-match),{" "}
              <strong className="text-white">all knockout picks lock together</strong>{" "}
              when Round of 32 starts. No edits after that, even for later
              rounds.
            </li>
            <li>
              • Missed knockout picks stay at 0 points. There is no late entry
              once the bracket closes.
            </li>
            <li>
              • <strong className="text-white">Team chaining (Sleeper-style):</strong>{" "}
              if you pick a team to win and they lose, that team is crossed out
              in your bracket — you earn 0 on later games where you picked them.
              Teams you picked correctly can still score in later rounds, even
              if you had the wrong opponent in that slot.
            </li>
            <li>
              • Round of 32 starts <strong className="text-white">{roundOf32Start}</strong>{" "}
              (Pacific). The Picks page popup will remind you before the bracket
              locks.
            </li>
          </ul>
        </section>

        <section className="rounded-2xl border border-gray-800 bg-[#111] px-6 py-6">
          <h2 className="text-lg font-black uppercase tracking-wide text-white">
            Good to Know
          </h2>
          <div className="mt-4 grid gap-3 text-sm text-gray-400 md:grid-cols-2">
            <p>
              • Each player&apos;s picks are saved to their own account only.
            </p>
            <p>• Group picks lock individually when each match kicks off.</p>
            <p>
              • Knockout picks all lock when Round of 32 starts on{" "}
              {roundOf32Start} — fill the full bracket before then.
            </p>
            <p>• Points are calculated automatically after each match ends.</p>
            <p>• Streak tracks consecutive correct picks.</p>
            <p>• Friends-only league — invite code required to join.</p>
          </div>
        </section>

        <div className="flex flex-wrap justify-center gap-4 pt-4">
          <Link
            href="/picks"
            className="rounded-full bg-[#FF007A] px-8 py-3 text-sm font-bold uppercase tracking-wide text-white transition hover:opacity-90"
          >
            Make Your Picks
          </Link>
          <Link
            href="/"
            className="rounded-full bg-[#32CD32] px-8 py-3 text-sm font-bold uppercase tracking-wide text-black transition hover:opacity-90"
          >
            View Standings
          </Link>
        </div>
      </div>
    </div>
  );
}
