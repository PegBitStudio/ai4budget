import Link from "next/link";
import DemoLoginButton from "@/components/landing/DemoLoginButton";
import HeroVisual from "@/components/landing/HeroVisual";

export const dynamic = "force-dynamic";

const CAPABILITIES = [
  {
    title: "It reads your bank alerts",
    body: "Paste the debit alerts already sitting in your messages — GTBank, Zenith, Access, Kuda, Opay. Any format. It extracts every transaction and files each one.",
  },
  {
    title: "It tells you what changed",
    body: "Not just what you spent, but what crept up. Dining up 27% since June. Subscriptions quietly ₦7,050 a month heavier than they were.",
  },
  {
    title: "It prices spending in what it costs you",
    body: "Not “you spent ₦285,000”. A phone purchase that put your savings goal three months further away. Figures you can act on.",
  },
];

/** Real output from the demo account, not illustrative copy. */
const DEMO_FIGURES = [
  { label: "Earned in August", value: "₦535,000", tone: "positive" as const },
  { label: "Actually spent", value: "₦753,200", tone: "negative" as const },
  { label: "Over budget in", value: "6 of 10", tone: "warning" as const },
];

const FIGURE_TONES = {
  positive: "text-positive-100",
  negative: "text-negative-100",
  warning: "text-warning-100",
} as const;

export default function LandingPage() {
  return (
    <div className="relative min-h-screen overflow-x-hidden bg-ink-50">
      {/* Page ground. A flat neutral reads as an unstyled document; these two
          layers give the hero something to sit on without adding colour that
          would compete with the figures. */}
      <div
        aria-hidden="true"
        className="animate-wash-a pointer-events-none absolute inset-x-[-10%] top-[-10%] h-[46rem] bg-[radial-gradient(45%_45%_at_70%_20%,rgba(14,124,102,0.14),transparent_70%)]"
      />
      <div
        aria-hidden="true"
        className="animate-wash-b hero-wash-neutral pointer-events-none absolute inset-x-[-10%] top-[-10%] h-[46rem]"
      />
      <div
        aria-hidden="true"
        className="hero-grid pointer-events-none absolute inset-x-0 top-0 h-[42rem]"
      />

      <header className="sticky top-0 z-40 border-b border-ink-200/60 bg-ink-50/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3.5 sm:px-8">
          <div className="flex items-center gap-2.5">
            <span className="grid size-8 place-items-center rounded-md bg-ink-900 text-body font-semibold text-paper">
              K
            </span>
            <span className="text-title text-ink-900">KoboPilot</span>
          </div>
          <Link
            href="/login"
            className="rounded-md px-3 py-2 text-body font-medium text-ink-600 transition-colors duration-[--duration-fast] hover:bg-ink-100 hover:text-ink-900"
          >
            Sign in
          </Link>
        </div>
      </header>

      <main className="relative mx-auto max-w-6xl px-5 pb-24 sm:px-8">
        {/* Hero — copy and product, side by side. A single left-aligned column
            on a wide screen leaves half the page empty and reads as a draft. */}
        <section className="grid items-center gap-14 pt-14 sm:pt-20 lg:grid-cols-[minmax(0,1fr)_auto] lg:gap-12 xl:gap-16">
          <div className="animate-rise min-w-0">
            <p className="inline-flex items-center gap-2 rounded-full border border-ink-200 bg-paper/80 px-3 py-1 text-eyebrow uppercase text-ink-600 shadow-card">
              <span aria-hidden="true" className="size-1.5 rounded-full bg-jade-600" />
              Personal finance, in Naira
            </p>

            <h1 className="mt-5 text-[2.75rem] font-semibold leading-[1.03] tracking-[-0.035em] text-ink-950 [text-wrap:balance] sm:text-5xl xl:text-6xl">
              You earned well this month.{" "}
              <span className="text-ink-500">So where did it all go?</span>
            </h1>

            <p className="mt-6 max-w-lg text-lg leading-relaxed text-ink-600 [text-wrap:pretty]">
              KoboPilot reads your spending, sorts it, finds what is quietly
              growing, and tells you in plain language what to do about it.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <DemoLoginButton />
              <Link
                href="/signup"
                className="inline-flex min-h-11 items-center justify-center rounded-md border border-ink-200 bg-paper px-5 text-body font-medium text-ink-800 shadow-card transition-colors duration-[--duration-fast] hover:border-ink-300 hover:bg-ink-50"
              >
                Create your own account
              </Link>
            </div>
            <p className="mt-3.5 text-label text-ink-500">
              The demo account holds three months of real-shaped spending. No
              signup needed.
            </p>
          </div>

          <div className="flex min-w-0 justify-center lg:justify-end lg:pb-8">
            <HeroVisual />
          </div>
        </section>

        {/* Proof, in the product's own figures */}
        <section
          className="surface-deep mt-24 overflow-hidden rounded-xl border border-ink-800 bg-ink-950 shadow-overlay"
          aria-label="What the demo account shows"
        >
          <div className="border-b border-ink-800 px-6 py-4 sm:px-8">
            <p className="text-eyebrow uppercase text-ink-400">
              What the demo account shows
            </p>
          </div>

          <div className="grid gap-px bg-ink-800 sm:grid-cols-3">
            {DEMO_FIGURES.map((figure) => (
              <div key={figure.label} className="bg-ink-950 px-6 py-6 sm:px-8">
                <p className="text-eyebrow uppercase text-ink-400">
                  {figure.label}
                </p>
                {/* Colour carries the same meaning here as everywhere else in
                    the product: green in, red out, amber approaching trouble. */}
                <p
                  className={`mt-2 text-[2rem] font-semibold leading-none tracking-[-0.025em] tnum ${FIGURE_TONES[figure.tone]}`}
                >
                  {figure.value}
                </p>
              </div>
            ))}
          </div>

          <figure className="border-t border-ink-800 px-6 py-7 sm:px-8">
            <blockquote className="max-w-2xl border-l-2 border-jade-500 pl-4 text-base leading-relaxed text-ink-200">
              “This month you earned ₦535,000 but spent ₦753,200, leaving you
              ₦218,200 short. Your biggest areas were Shopping, Housing and
              Groceries — and Shopping alone is ₦280,500 past its plan.”
            </blockquote>
            <figcaption className="mt-3 pl-4 text-eyebrow uppercase text-ink-500">
              Actual output from the demo account
            </figcaption>
          </figure>
        </section>

        {/* Capabilities */}
        <section className="mt-24" aria-labelledby="capabilities">
          <h2
            id="capabilities"
            className="max-w-2xl text-3xl font-semibold tracking-[-0.025em] text-ink-950 [text-wrap:balance] sm:text-4xl"
          >
            Built for how money actually moves here
          </h2>
          <div className="stagger mt-8 grid gap-4 md:grid-cols-3">
            {CAPABILITIES.map((capability, i) => (
              <div
                key={capability.title}
                className="lift rounded-lg border border-ink-200 bg-paper p-6 shadow-card"
              >
                <span className="grid size-8 place-items-center rounded-md bg-ink-900 text-label font-semibold tnum text-paper">
                  {i + 1}
                </span>
                <h3 className="mt-4 text-title text-ink-900">
                  {capability.title}
                </h3>
                <p className="mt-2 text-body leading-relaxed text-ink-600">
                  {capability.body}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Closing call to action */}
        <section className="mt-20 rounded-xl border border-ink-200 bg-paper px-6 py-10 text-center shadow-card sm:px-10">
          <h2 className="text-2xl font-semibold tracking-[-0.02em] text-ink-950 [text-wrap:balance] sm:text-3xl">
            Find out where yours went.
          </h2>
          <p className="mx-auto mt-3 max-w-md text-body leading-relaxed text-ink-600">
            Open the demo account and look around, or start with your own
            figures. Both take about a minute.
          </p>
          <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <DemoLoginButton />
            <Link
              href="/signup"
              className="inline-flex min-h-11 items-center justify-center rounded-md border border-ink-200 bg-paper px-5 text-body font-medium text-ink-800 transition-colors duration-[--duration-fast] hover:border-ink-300 hover:bg-ink-50"
            >
              Create your own account
            </Link>
          </div>
        </section>

        <section className="mt-12 rounded-lg border border-ink-200 bg-paper p-5">
          <p className="text-body leading-relaxed text-ink-600">
            <strong className="font-medium text-ink-900">
              A note on advice.
            </strong>{" "}
            KoboPilot offers general budgeting support based on the figures you
            give it. It is not professional financial or investment advice.
          </p>
        </section>
      </main>
    </div>
  );
}
