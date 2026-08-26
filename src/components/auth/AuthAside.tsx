import { quoteForDay } from "@/lib/quotes";

/**
 * The panel beside the sign-in form.
 *
 * The chart is the demo account's own three months, not an invented shape — two
 * paths that run close together and then separate hard in August. That gap is
 * the entire reason the product exists, so it is worth showing before anyone
 * has signed in, and it earns the quote sitting under it.
 */

type Month = { label: string; in: number; out: number };

/** Real totals from the demo account. */
const MONTHS: Month[] = [
  { label: "Jun", in: 450_000, out: 400_500 },
  { label: "Jul", in: 510_000, out: 431_400 },
  { label: "Aug", in: 535_000, out: 753_200 },
];

// Chart geometry, in the SVG's own units.
const W = 320;
const H = 150;
const PAD_X = 12;
const PAD_Y = 14;

const MAX = Math.max(...MONTHS.flatMap((m) => [m.in, m.out]));

const x = (i: number) =>
  PAD_X + (i * (W - PAD_X * 2)) / (MONTHS.length - 1);
const y = (value: number) =>
  H - PAD_Y - (value / MAX) * (H - PAD_Y * 2);

/**
 * A smooth path through the points. Catmull-Rom converted to cubic béziers,
 * so the curve actually passes through every month rather than being pulled
 * off its own data the way a naive bézier would.
 */
function smoothPath(values: number[]): string {
  const pts = values.map((v, i) => [x(i), y(v)] as const);
  let d = `M ${pts[0][0]} ${pts[0][1]}`;

  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;

    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;

    d += ` C ${c1x} ${c1y}, ${c2x} ${c2y}, ${p2[0]} ${p2[1]}`;
  }

  return d;
}

const IN_PATH = smoothPath(MONTHS.map((m) => m.in));
const OUT_PATH = smoothPath(MONTHS.map((m) => m.out));

/** The band between the two lines, closed so it can be filled. */
const GAP_PATH = `${IN_PATH} L ${x(MONTHS.length - 1)} ${y(MONTHS[MONTHS.length - 1].out)} ${smoothPath(
  [...MONTHS].reverse().map((m) => m.out)
)
  .replace(/^M [\d.]+ [\d.]+/, "")
  .trim()} Z`;

export default function AuthAside() {
  const quote = quoteForDay();

  return (
    <aside className="surface-deep relative hidden overflow-hidden rounded-xl bg-ink-950 lg:flex lg:flex-col lg:justify-between">
      {/* Ambient light. Two washes on different periods, so the panel is never
          quite the same twice and never resolves into a loop you can see. */}
      <div
        aria-hidden="true"
        className="animate-wash-a pointer-events-none absolute -inset-1/4 bg-[radial-gradient(45%_45%_at_35%_25%,rgba(14,124,102,0.30),transparent_70%)] blur-3xl"
      />
      <div
        aria-hidden="true"
        className="animate-wash-b pointer-events-none absolute -inset-1/4 bg-[radial-gradient(40%_40%_at_70%_70%,rgba(180,35,24,0.18),transparent_70%)] blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 [background-image:linear-gradient(to_right,rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.035)_1px,transparent_1px)] [background-size:56px_56px] [mask-image:radial-gradient(80%_70%_at_50%_40%,#000,transparent)]"
      />

      <div className="relative flex items-center gap-2.5 px-10 pt-10">
        <span className="grid size-8 place-items-center rounded-md bg-paper text-body font-semibold text-ink-950">
          K
        </span>
        <span className="text-title text-paper">KoboPilot</span>
      </div>

      <div className="relative px-10">
        <p className="text-eyebrow uppercase text-ink-400">
          The demo account, June to August
        </p>

        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="mt-5 w-full max-w-sm"
          role="img"
          aria-label="Money in stayed near ₦500,000 a month while money out rose from ₦400,500 in June to ₦753,200 in August."
        >
          {/* The gap between earning and spending — the thing the product is
              for. Red once it opens, because by August it is a shortfall. */}
          <path d={GAP_PATH} fill="rgba(180,35,24,0.22)" />

          <path
            d={IN_PATH}
            pathLength={1}
            fill="none"
            stroke="var(--color-positive-600)"
            strokeWidth={2}
            strokeLinecap="round"
            className="animate-draw"
          />
          <path
            d={OUT_PATH}
            pathLength={1}
            fill="none"
            stroke="var(--color-negative-600)"
            strokeWidth={2}
            strokeLinecap="round"
            className="animate-draw"
            style={{ animationDelay: "180ms" }}
          />

          {MONTHS.map((m, i) => (
            <g key={m.label}>
              <circle cx={x(i)} cy={y(m.in)} r={3} fill="var(--color-positive-600)" />
              <circle cx={x(i)} cy={y(m.out)} r={3} fill="var(--color-negative-600)" />
            </g>
          ))}
        </svg>

        <div className="mt-3 flex max-w-sm justify-between text-eyebrow uppercase text-ink-500">
          {MONTHS.map((m) => (
            <span key={m.label}>{m.label}</span>
          ))}
        </div>

        <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-label">
          <span className="inline-flex items-center gap-2 text-ink-300">
            <span aria-hidden="true" className="h-0.5 w-4 rounded-full bg-positive-600" />
            Money in
          </span>
          <span className="inline-flex items-center gap-2 text-ink-300">
            <span aria-hidden="true" className="h-0.5 w-4 rounded-full bg-negative-600" />
            Money out
          </span>
        </div>
      </div>

      {/* The same rotation the app uses, so the two never contradict each
          other on the same day. Resolved on the server, which is safe here —
          this is a server component, so there is no client render to disagree
          with it. */}
      <figure className="relative px-10 pb-10">
        <blockquote className="max-w-sm border-l-2 border-jade-500 pl-5 text-xl leading-snug tracking-[-0.015em] text-paper [text-wrap:balance]">
          “{quote.text}”
        </blockquote>
        <figcaption className="mt-3 pl-5 text-eyebrow uppercase text-ink-400">
          {quote.attribution}
        </figcaption>
      </figure>
    </aside>
  );
}
