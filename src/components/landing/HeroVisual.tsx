import { categoryColor } from "@/config/categories";

/**
 * The product, on the landing page.
 *
 * A bright card on the dark hero, rather than the dark card on a light page it
 * used to be — the block behind it is now the dark surface, and two dark
 * surfaces stacked read as mud. Built from the design tokens rather than pasted
 * in as a screenshot, so it stays sharp at any resolution and cannot drift out
 * of date with the system it is advertising.
 *
 * It shows the three things KoboPilot does, in the order it does them: the
 * money position, the transactions sorted into categories, and the sentence the
 * assistant writes about them. Every figure is real demo-account output.
 *
 * It renders inside `.surface-deep`, so the ink scale here is the light one in
 * both themes — `bg-paper` is white on the hero whichever theme you are in.
 */

const ROWS = [
  { description: "Slot — replacement phone", category: "Shopping", amount: "285,000" },
  { description: "Jollof and Co. delivery", category: "Dining", amount: "20,250" },
  { description: "Mile 12 market", category: "Groceries", amount: "11,000" },
  { description: "EKEDC prepaid top-up", category: "Utilities", amount: "11,700" },
];

export default function HeroVisual() {
  return (
    <div className="relative w-full max-w-[24rem] xl:max-w-[26rem]">
      {/* The glow the card sits in. Without it the card is pasted onto the hero
          rather than lit by the same room. */}
      <div
        aria-hidden="true"
        className="animate-drift pointer-events-none absolute -inset-10 rounded-[2.5rem] bg-[radial-gradient(55%_50%_at_50%_40%,rgba(20,149,123,0.38),transparent_72%)] blur-3xl"
      />

      <div className="animate-rise relative overflow-hidden rounded-xl border border-ink-200 bg-paper shadow-overlay">
        {/* Statement head */}
        <div className="flex items-center justify-between border-b border-ink-100 px-5 py-3.5">
          <p className="text-eyebrow uppercase text-ink-500">August</p>
          <span className="inline-flex items-center gap-1.5 text-eyebrow uppercase text-jade-700">
            <span aria-hidden="true" className="size-1.5 rounded-full bg-jade-600" />
            Live
          </span>
        </div>

        {/* The position */}
        <div className="px-5 pt-5">
          <p className="text-eyebrow uppercase text-ink-500">
            Left after spending
          </p>
          <p className="mt-1.5 text-[2.75rem] font-semibold leading-none tracking-[-0.03em] tnum text-negative-600">
            −₦218,200
          </p>

          {/* Earned against spent, to scale: the bar is why the figure above is
              negative, not decoration. */}
          <div className="mt-5 flex gap-1" aria-hidden="true">
            <div className="animate-grow h-1.5 flex-[535] rounded-full bg-positive-600" />
            <div
              className="animate-grow h-1.5 flex-[753] rounded-full bg-negative-600"
              style={{ animationDelay: "120ms" }}
            />
          </div>
          <div className="mt-2.5 flex justify-between text-label tnum">
            <span className="text-ink-500">
              In <span className="font-medium text-ink-900">₦535,000</span>
            </span>
            <span className="text-ink-500">
              Out <span className="font-medium text-ink-900">₦753,200</span>
            </span>
          </div>
        </div>

        {/* Sorted, with the classifier's own colours */}
        <ul className="stagger mt-5 border-t border-ink-100">
          {ROWS.map((row) => (
            <li
              key={row.description}
              className="flex items-center gap-3 border-b border-ink-100 px-5 py-2.5 last:border-b-0"
            >
              <span
                aria-hidden="true"
                className="size-2 shrink-0 rounded-full"
                style={{ backgroundColor: categoryColor(row.category) }}
              />
              <span className="min-w-0 flex-1 truncate text-label text-ink-900">
                {row.description}
              </span>
              <span className="shrink-0 text-label text-ink-500">
                {row.category}
              </span>
              <span className="w-20 shrink-0 text-right text-label tnum text-ink-800">
                −₦{row.amount}
              </span>
            </li>
          ))}
        </ul>
      </div>

      {/* The assistant's read, on its own surface so the two are clearly the
          product speaking about its own figures. */}
      <div
        className="animate-rise relative z-10 -mt-5 ml-6 rounded-lg border border-jade-100 bg-jade-50 p-4 shadow-overlay lg:mr-[-2rem]"
        style={{ animationDelay: "220ms" }}
      >
        <p className="flex items-center gap-1.5 text-eyebrow uppercase text-jade-700">
          <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" className="size-3">
            <path d="M8 0l1.8 5.2L15 7l-5.2 1.8L8 14l-1.8-5.2L1 7l5.2-1.8L8 0z" />
          </svg>
          What KoboPilot noticed
        </p>
        <p className="mt-2 text-body leading-relaxed text-ink-800">
          Shopping alone is{" "}
          <span className="font-medium tnum text-ink-950">₦280,500</span> past
          its plan — and that phone put your laptop goal{" "}
          <span className="font-medium text-ink-950">three months</span> further
          away.
        </p>
      </div>
    </div>
  );
}
