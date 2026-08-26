import Link from "next/link";
import DemoLoginButton from "@/components/landing/DemoLoginButton";

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
  { label: "Earned in August", value: "₦535,000", tone: "neutral" as const },
  { label: "Actually spent", value: "₦745,400", tone: "negative" as const },
  { label: "Over budget in", value: "7 of 10", tone: "negative" as const },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-ink-50">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5 sm:px-8">
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
      </header>

      <main className="mx-auto max-w-6xl px-5 pb-24 sm:px-8">
        {/* Hero */}
        <section className="pt-12 sm:pt-20">
          <p className="text-eyebrow uppercase text-ink-500">
            Personal finance, in Naira
          </p>
          <h1 className="mt-3 max-w-3xl text-4xl font-semibold leading-[1.05] tracking-[-0.03em] text-ink-950 sm:text-5xl lg:text-6xl">
            You earned well this month.
            <br />
            <span className="text-ink-400">So where did it all go?</span>
          </h1>
          <p className="mt-6 max-w-xl text-base leading-relaxed text-ink-600">
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
          <p className="mt-3 text-label text-ink-500">
            The demo account holds three months of real-shaped spending. No
            signup needed.
          </p>
        </section>

        {/* Proof, in the product's own figures */}
        <section
          className="mt-16 overflow-hidden rounded-xl border border-ink-800 bg-ink-950"
          aria-label="What the demo account shows"
        >
          <div className="border-b border-ink-800 px-6 py-4 sm:px-8">
            <p className="text-eyebrow uppercase text-ink-400">
              What the demo account shows
            </p>
          </div>

          <div className="grid gap-px bg-ink-800 sm:grid-cols-3">
            {DEMO_FIGURES.map((figure) => (
              <div key={figure.label} className="bg-ink-950 px-6 py-5 sm:px-8">
                <p className="text-eyebrow uppercase text-ink-400">
                  {figure.label}
                </p>
                <p
                  className={`mt-2 text-figure tnum ${
                    figure.tone === "negative"
                      ? "text-negative-100"
                      : "text-paper"
                  }`}
                >
                  {figure.value}
                </p>
              </div>
            ))}
          </div>

          <figure className="border-t border-ink-800 px-6 py-6 sm:px-8">
            <blockquote className="max-w-2xl border-l-2 border-jade-500 pl-4 text-base leading-relaxed text-ink-200">
              “This month you earned ₦535,000 but spent ₦745,400, leaving you
              ₦210,400 short. Your biggest areas were Shopping, Housing and
              Groceries — and Shopping alone is ₦280,500 past its plan.”
            </blockquote>
            <figcaption className="mt-3 pl-4 text-eyebrow uppercase text-ink-500">
              Actual output from the demo account
            </figcaption>
          </figure>
        </section>

        {/* Capabilities */}
        <section className="mt-16" aria-labelledby="capabilities">
          <h2
            id="capabilities"
            className="text-2xl font-semibold tracking-[-0.02em] text-ink-950"
          >
            Built for how money actually moves here
          </h2>
          <div className="mt-6 grid gap-px overflow-hidden rounded-lg border border-ink-200 bg-ink-200 md:grid-cols-3">
            {CAPABILITIES.map((capability) => (
              <div key={capability.title} className="bg-paper p-6">
                <h3 className="text-title text-ink-900">{capability.title}</h3>
                <p className="mt-2 text-body text-ink-600">{capability.body}</p>
              </div>
            ))}
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
