import Link from "next/link";
import DemoLoginButton from "@/components/landing/DemoLoginButton";

export const dynamic = "force-dynamic";

const FEATURES = [
  {
    title: "It sorts your spending for you",
    body: "Type “Bolt ride to work” and it files itself under Transport. Correct it once and every future one is filed your way.",
  },
  {
    title: "It tells you what changed",
    body: "Not just what you spent — what crept up. Dining is up 27% since June. Your subscriptions quietly grew by ₦7,050 a month.",
  },
  {
    title: "It answers in plain English",
    body: "“Why am I over budget?” “What should I cut first?” Ask the way you'd ask a friend who happens to have read every line of your statement.",
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5 sm:px-8">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-indigo-800 shadow-lg shadow-violet-300/40">
            <span className="text-sm font-bold text-white">✦</span>
          </div>
          <span className="text-base font-semibold tracking-tight text-slate-900">
            Budget AI
          </span>
        </div>
        <Link
          href="/login"
          className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-600 transition-colors hover:bg-white hover:text-violet-700"
        >
          Sign in
        </Link>
      </header>

      {/* Hero */}
      <main className="mx-auto max-w-6xl px-5 pb-20 sm:px-8">
        <section className="pt-10 sm:pt-16">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-violet-700">
            Personal finance, in Naira
          </p>
          <h1 className="mt-4 max-w-3xl text-4xl font-semibold leading-[1.08] tracking-tight text-slate-900 sm:text-5xl md:text-6xl">
            You earned well this month.
            <br />
            <span className="text-violet-700">So where did it all go?</span>
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-slate-600">
            Budget AI reads your spending, sorts it, spots what is quietly
            growing, and tells you in plain language what to do about it.
          </p>

          <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
            <DemoLoginButton />
            <Link
              href="/signup"
              className="inline-flex min-h-[52px] items-center justify-center rounded-2xl border border-slate-200 bg-white px-6 text-base font-semibold text-slate-700 shadow-sm transition-colors hover:border-violet-200 hover:text-violet-700"
            >
              Create your own account
            </Link>
          </div>
          <p className="mt-3 text-sm text-slate-500">
            The demo account is preloaded with three months of real-shaped
            spending — no signup needed.
          </p>
        </section>

        {/* The story, told with numbers */}
        <section
          className="mt-16 overflow-hidden rounded-[2rem] bg-[#27235b] px-6 py-8 text-white shadow-[0_24px_60px_rgba(49,46,129,0.22)] sm:px-10 sm:py-10"
          aria-label="Example insight"
        >
          <p className="text-sm font-medium text-violet-200">
            What the demo account looks like
          </p>
          <div className="mt-6 grid gap-6 sm:grid-cols-3">
            <Figure label="Earned in August" value="₦535,000" tone="calm" />
            <Figure label="Actually spent" value="₦757,750" tone="alarm" />
            <Figure label="Over budget in" value="7 of 10 categories" tone="alarm" />
          </div>
          <p className="mt-8 max-w-2xl border-l-2 border-emerald-300 pl-4 text-base leading-relaxed text-violet-50">
            “This month you earned ₦535,000 but spent ₦757,750, leaving you
            ₦222,750 short. Your biggest areas were Shopping, Housing and
            Groceries — and Shopping alone is ₦280,500 past its plan.”
          </p>
          <p className="mt-2 pl-4 text-xs uppercase tracking-[0.14em] text-violet-300">
            Actual output from the demo account
          </p>
        </section>

        {/* Features */}
        <section className="mt-16" aria-labelledby="features-heading">
          <h2
            id="features-heading"
            className="text-2xl font-semibold tracking-tight text-slate-900"
          >
            Built for how money actually moves here
          </h2>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {FEATURES.map((feature) => (
              <div
                key={feature.title}
                className="rounded-[1.5rem] border border-white bg-white p-6 shadow-sm"
              >
                <h3 className="text-base font-semibold text-slate-900">
                  {feature.title}
                </h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  {feature.body}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-14 rounded-[1.5rem] border border-amber-200 bg-amber-50 p-5">
          <p className="text-sm leading-6 text-amber-900">
            <strong className="font-semibold">A note on advice.</strong> Budget
            AI offers general budgeting support based on the figures you give
            it. It is not professional financial or investment advice.
          </p>
        </section>
      </main>
    </div>
  );
}

function Figure({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "calm" | "alarm";
}) {
  return (
    <div className="rounded-2xl border border-white/15 bg-white/10 px-5 py-4 backdrop-blur-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-violet-200">
        {label}
      </p>
      <p
        className={`mt-1.5 text-2xl font-semibold tracking-tight ${
          tone === "alarm" ? "text-rose-200" : "text-emerald-200"
        }`}
      >
        {value}
      </p>
    </div>
  );
}
