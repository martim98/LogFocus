import Link from "next/link";

export default function AboutPage() {
  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-8 px-4 py-8 sm:px-6 lg:px-8">
      <section className="panel rounded-[28px] p-8">
        <p className="text-sm uppercase tracking-[0.25em] text-[rgb(var(--muted))]">About</p>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight">A timer-first workspace that stays calm.</h1>
        <p className="mt-4 max-w-3xl text-base leading-7 text-[rgb(var(--muted))]">
          LogFocus is built around one principle: planning, focusing, and reflecting should happen in a single
          place without turning into a heavy productivity dashboard. The timer leads. Projects and session logging stay
          on their own page, and history stays close enough to be useful without crowding the first screen.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/" className="rounded-full bg-[rgb(var(--accent-strong))] px-5 py-3 text-sm font-medium text-white">
            Open today&apos;s workspace
          </Link>
          <Link
            href="/history"
            className="rounded-full border border-[rgb(var(--line))] px-5 py-3 text-sm font-medium text-[rgb(var(--text))]"
          >
            View history
          </Link>
        </div>
      </section>
    </main>
  );
}
