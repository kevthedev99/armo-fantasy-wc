import Link from "next/link";
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
          Pick every World Cup match, climb the leaderboard, and take the pot.
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
              Winner Takes All
            </p>
            <p className="mt-4 text-sm leading-relaxed text-gray-400">
              Everyone puts in $25. One player tops the standings when the
              tournament ends — that player wins the full pot. Tiebreaker: most
              total wins, then highest point total.
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
                Make picks for every match before kickoff. Picks lock{" "}
                <strong className="text-white">
                  {SCORING.lockSecondsBeforeKickoff} seconds
                </strong>{" "}
                before the match starts.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="mt-0.5 font-black text-[#FFD700]">03</span>
              <span>
                <strong className="text-white">Group stage</strong> picks open
                from day one. Pick the winner (or tie) plus both scores.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="mt-0.5 font-black text-[#FFD700]">04</span>
              <span>
                <strong className="text-white">Knockout</strong> picks unlock
                automatically once every group stage match is finished.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="mt-0.5 font-black text-[#FFD700]">05</span>
              <span>
                Check the standings anytime. Last place gets the{" "}
                <strong className="text-amber-400">Wooden Spoon</strong>.
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
              <div className="mt-2 flex items-center justify-between rounded-lg border border-[#32CD32]/30 bg-[#32CD32]/5 px-4 py-3">
                <span className="text-sm text-gray-300">
                  Winning goal minute (±
                  {SCORING.knockout.winningGoalMinuteTolerance} min)
                </span>
                <span className="font-black text-[#32CD32]">
                  +{SCORING.knockout.winningGoalMinuteBonus} pts
                </span>
              </div>
              <p className="text-xs text-gray-500">
                Deeper rounds are worth more — like March Madness. Pick the
                winner plus when the winning goal was scored for a bonus.
              </p>
            </div>
          </section>
        </div>

        <section className="rounded-2xl border border-gray-800 bg-[#111] px-6 py-6">
          <h2 className="text-lg font-black uppercase tracking-wide text-white">
            Good to Know
          </h2>
          <div className="mt-4 grid gap-3 text-sm text-gray-400 md:grid-cols-2">
            <p>• You can update picks anytime before they lock.</p>
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
