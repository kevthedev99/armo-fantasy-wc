import Link from "next/link";

export function Hero() {
  return (
    <section className="bg-black px-6 py-16 text-center">
      <p className="mb-2 text-sm font-bold tracking-[0.3em] text-[#FFD700]">
        ARMO FANTASY
      </p>
      <h1 className="text-5xl font-black uppercase leading-none tracking-tight text-white md:text-7xl">
        <span className="text-[#FFD700]">26</span>{" "}
        <span className="text-white">PICK&apos;EM</span>
      </h1>
      <h2 className="mt-2 text-3xl font-black uppercase text-[#FF007A] md:text-5xl">
        World Cup League
      </h2>
      <p className="mt-6 text-7xl font-black text-white md:text-9xl">2026</p>
      <p className="mt-4 text-sm font-semibold uppercase tracking-widest text-[#FFD700] md:text-base">
        $25 Buy-In, Winner Takes All
      </p>
      <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
        <Link
          href="/picks"
          className="rounded-full bg-[#FF007A] px-8 py-3 text-sm font-bold uppercase tracking-wide text-white transition hover:opacity-90"
        >
          Make Your Picks
        </Link>
        <Link
          href="/#standings"
          className="rounded-full bg-[#32CD32] px-8 py-3 text-sm font-bold uppercase tracking-wide text-black transition hover:opacity-90"
        >
          View Standings
        </Link>
        <Link
          href="/rules"
          className="rounded-full border-2 border-[#FFD700] bg-transparent px-8 py-3 text-sm font-bold uppercase tracking-wide text-[#FFD700] transition hover:bg-[#FFD700]/10"
        >
          Rules
        </Link>
      </div>
    </section>
  );
}
