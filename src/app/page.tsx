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
  positive: "text-positive-600",
  negative: "text-negative-600",
  warning: "text-warning-600",
} as const;

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-paper">
      {/* ---------------------------------------------------------------------
          Hero — a full-bleed dark block, not a light page with a dark card on
          it. The colour runs edge to edge and the content is what is
          constrained, which is what makes the top of the page read as a
          deliberate surface rather than a section that happens to be dark.
          --------------------------------------------------------------------- */}
      <section className="surface-deep relative overflow-hidden bg-ink-950">
        {/* Ambient light, on two periods that never fall into step. */}
        <div
          aria-hidden="true"
          className="animate-wash-a pointer-events-none absolute inset-x-[-15%] top-[-25%] h-[52rem] bg-[radial-gradient(42%_45%_at_72%_35%,rgba(20,149,123,0.30),transparent_70%)]"
        />
        <div
          aria-hidden="true"
          className="animate-wash-b pointer-events-none absolute inset-x-[-15%] top-[-20%] h-[52rem] bg-[radial-gradient(38%_42%_at_20%_18%,rgba(80,110,140,0.20),transparent_70%)]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 [background-image:linear-gradient(to_right,rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.04)_1px,transparent_1px)] [background-size:64px_64px] [mask-image:radial-gradient(75%_65%_at_50%_10%,#000,transparent)]"
        />

        <header className="relative mx-auto flex max-w-6xl xl:max-w-7xl items-center justify-between px-5 py-5 sm:px-8">
          <div className="flex items-center gap-2.5">
            <span className="grid size-8 place-items-center rounded-md bg-paper text-body font-semibold text-ink-950">
              K
            </span>
            <span className="text-title text-paper">KoboPilot</span>
          </div>
          <Link
            href="/login"
            className="rounded-md px-3.5 py-2 text-body font-medium text-ink-300 transition-colors duration-[--duration-fast] hover:bg-paper/10 hover:text-paper"
          >
            Sign in
          </Link>
        </header>

        <div className="relative mx-auto grid max-w-6xl xl:max-w-7xl items-center gap-14 px-5 pb-24 pt-10 sm:px-8 sm:pt-16 lg:grid-cols-[minmax(0,1fr)_auto] lg:gap-12 lg:pb-28 xl:gap-16">
          <div className="animate-rise min-w-0">
            <p className="inline-flex items-center gap-2 rounded-full border border-paper/15 bg-paper/5 px-3.5 py-1.5 text-eyebrow uppercase text-ink-300 backdrop-blur-sm">
              <span aria-hidden="true" className="size-1.5 rounded-full bg-jade-500" />
              {/* Built here, not limited to here. The local knowledge is the
                  moat; the currency range is evidence it was engineered rather
                  than hardcoded. */}
              Built for Nigeria · Works in 8 currencies
            </p>

            {/* Sized against the column it actually sits in, which is not the
                same as the viewport: at `lg` the product card moves alongside
                and the text column *narrows*, so the type steps back down
                before opening up again at `xl` where the shell widens. Three
                lines at every width. Tracking tightens as the size goes up, or
                the words drift apart at display scale. */}
            <h1 className="mt-6 text-[2.5rem] font-semibold leading-[1.02] tracking-[-0.03em] text-paper [text-wrap:balance] sm:text-[3.25rem] lg:text-[3.5rem] xl:text-[5.25rem] xl:tracking-[-0.024em]">
              You earned well this month.{" "}
              <span className="text-ink-500">So where did it all go?</span>
            </h1>

            <p className="mt-7 max-w-lg text-lg leading-relaxed text-ink-300 [text-wrap:pretty]">
              KoboPilot reads your spending, sorts it, finds what is quietly
              growing, and tells you in plain language what to do about it.
            </p>

            <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
              <DemoLoginButton tone="paper" />
              <Link
                href="/signup"
                className="inline-flex min-h-11 items-center justify-center rounded-md border border-paper/20 px-5 text-body font-medium text-paper transition-colors duration-[--duration-fast] hover:border-paper/35 hover:bg-paper/10"
              >
                Create your own account
              </Link>
            </div>
            <p className="mt-4 text-label text-ink-400">
              The demo account holds three months of real-shaped spending. No
              signup needed.
            </p>
          </div>

          <div className="flex min-w-0 justify-center lg:justify-end">
            <HeroVisual />
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------------
          Proof, in the product's own figures. Light, so the page breathes after
          the hero instead of running two dark blocks together.
          --------------------------------------------------------------------- */}
      <section
        className="border-b border-ink-100 bg-ink-50"
        aria-label="What the demo account shows"
      >
        <div className="mx-auto max-w-6xl xl:max-w-7xl px-5 py-20 sm:px-8 lg:py-24">
          <p className="text-eyebrow uppercase text-ink-500">
            What the demo account shows
          </p>

          <div className="stagger mt-8 grid gap-4 sm:grid-cols-3">
            {DEMO_FIGURES.map((figure) => (
              <div
                key={figure.label}
                className="rounded-lg border border-ink-200 bg-paper px-6 py-6 shadow-card"
              >
                <p className="text-eyebrow uppercase text-ink-500">
                  {figure.label}
                </p>
                {/* Colour carries the same meaning here as everywhere else in
                    the product: green in, red out, amber approaching trouble. */}
                <p
                  className={`mt-2.5 text-[2.25rem] font-semibold leading-none tracking-[-0.028em] tnum ${FIGURE_TONES[figure.tone]}`}
                >
                  {figure.value}
                </p>
              </div>
            ))}
          </div>

          <figure className="mt-8 rounded-lg border border-ink-200 bg-paper p-6 shadow-card sm:p-8">
            <blockquote className="max-w-2xl border-l-2 border-jade-500 pl-5 text-lg leading-relaxed text-ink-800 [text-wrap:pretty]">
              “This month you earned ₦535,000 but spent ₦753,200, leaving you
              ₦218,200 short. Your biggest areas were Shopping, Housing and
              Groceries — and Shopping alone is ₦280,500 past its plan.”
            </blockquote>
            <figcaption className="mt-4 pl-5 text-eyebrow uppercase text-ink-500">
              Actual output from the demo account
            </figcaption>
          </figure>
        </div>
      </section>

      {/* Capabilities */}
      <section className="bg-paper" aria-labelledby="capabilities">
        <div className="mx-auto max-w-6xl xl:max-w-7xl px-5 py-20 sm:px-8 lg:py-24">
          <h2
            id="capabilities"
            className="max-w-2xl text-[2rem] font-semibold leading-[1.1] tracking-[-0.028em] text-ink-950 [text-wrap:balance] sm:text-[2.75rem]"
          >
            Built for how money actually moves here
          </h2>

          <div className="stagger mt-10 grid gap-4 md:grid-cols-3">
            {CAPABILITIES.map((capability, i) => (
              <div
                key={capability.title}
                className="lift rounded-lg border border-ink-200 bg-paper p-6 shadow-card"
              >
                <span className="grid size-9 place-items-center rounded-md bg-ink-900 text-label font-semibold tnum text-paper">
                  {i + 1}
                </span>
                <h3 className="mt-5 text-title text-ink-900">
                  {capability.title}
                </h3>
                <p className="mt-2 text-body leading-relaxed text-ink-600">
                  {capability.body}
                </p>
              </div>
            ))}
          </div>

          {/* The reach, stated after the local knowledge rather than instead of
              it. The bank-alert parsing is what nothing else here does; the
              currency range is what proves it was built properly. */}
          <p className="mt-8 max-w-3xl text-body leading-relaxed text-ink-600 [text-wrap:pretty]">
            <strong className="font-medium text-ink-900">
              Naira by default — and eight currencies in all.
            </strong>{" "}
            Dollars, euros, pounds, cedis, shillings, rand and Canadian dollars,
            chosen when you sign up. The categories, the budgets, the forecasts
            and the assistant all follow whichever you pick, because none of it
            was written against a hardcoded currency.
          </p>
        </div>
      </section>

      {/* Closing call to action, bookending the hero */}
      <section className="surface-deep relative overflow-hidden bg-ink-950">
        <div
          aria-hidden="true"
          className="animate-wash-b pointer-events-none absolute inset-x-[-15%] top-[-40%] h-[40rem] bg-[radial-gradient(40%_50%_at_50%_60%,rgba(20,149,123,0.22),transparent_70%)]"
        />
        <div className="relative mx-auto max-w-6xl xl:max-w-7xl px-5 py-20 text-center sm:px-8 lg:py-24">
          <h2 className="mx-auto max-w-2xl text-[2rem] font-semibold leading-[1.08] tracking-[-0.028em] text-paper [text-wrap:balance] sm:text-[2.75rem]">
            Find out where yours went.
          </h2>
          <p className="mx-auto mt-4 max-w-md text-lg leading-relaxed text-ink-300">
            Open the demo account and look around, or start with your own
            figures. Both take about a minute.
          </p>
          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <DemoLoginButton tone="paper" />
            <Link
              href="/signup"
              className="inline-flex min-h-11 items-center justify-center rounded-md border border-paper/20 px-5 text-body font-medium text-paper transition-colors duration-[--duration-fast] hover:border-paper/35 hover:bg-paper/10"
            >
              Create your own account
            </Link>
          </div>
        </div>
      </section>

      <footer className="bg-paper">
        <div className="mx-auto max-w-6xl xl:max-w-7xl px-5 py-10 sm:px-8">
          <p className="max-w-3xl text-body leading-relaxed text-ink-500">
            <strong className="font-medium text-ink-800">
              A note on advice.
            </strong>{" "}
            KoboPilot offers general budgeting support based on the figures you
            give it. It is not professional financial or investment advice.
          </p>
        </div>
      </footer>
    </div>
  );
}
