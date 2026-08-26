# KoboPilot

**Your AI co-pilot for spending, budgeting and saving in Naira.**

🔗 **[ai4budget.vercel.app](https://ai4budget.vercel.app)** — click **"Explore the demo account"**. No signup, no setup: it opens an account preloaded with three months of real-shaped Lagos household spending.

Built for **10Alytics AI BuildFest 2026** · Track 3, *AI for Everyday Life* · Case Study 1, *AI Budgeting Assistant*.

---

## The problem

Nigerians who earn well still cannot say where their money went.

Not because they are careless — because recording it is the work. Nobody types
their expenses into an app for more than a fortnight. So the month ends, the
money is gone, and the explanation is a shrug.

Meanwhile every one of those transactions already generated a bank alert sitting
in their messages. GTBank, Zenith, Access, Kuda, Opay. Hundreds of them. Complete,
accurate, and completely unused.

KoboPilot reads them.

---

## What it does

**Paste your bank alerts. Get your month.**
Any bank, any format, mixed together. The assistant extracts each transaction,
strips account numbers, ignores the OTPs and marketing messages, categorises
everything, and shows it for review. Nothing is saved until you confirm.

**It files spending on its own.**
"Bolt ride to work" becomes Transport without being asked. Correct it once and
that merchant is filed your way forever — the correction is stored as a rule that
outranks both the built-in patterns and the model.

**It finds what you would not.**
Not just what you spent — what *changed*. Which charges quietly crept up. What
₦456,000 a month of recurring payments actually consists of.

**It prices spending in what it costs you.**
Not "you spent ₦285,000." *"That is about 3 months further from your savings
goal, at the ₦90,000 a month you are putting aside."* The brief's complaint about
existing tools is that they present figures without explaining what to do. A
figure is an abstraction; a delay to something you are saving for is a decision.

**It answers questions in plain English.**
"Why am I over budget?" "What should I cut first?" Asked the way you would ask a
friend who happened to have read every line of your statement.

---

## Where the AI is, and where it deliberately is not

AI is used where it does something the app could not do without it, and nowhere
else. Four places:

| Feature | What the model does | Why it earns its place |
|---|---|---|
| **Bank-alert parsing** | Reads unstructured SMS from any bank into structured transactions | No regex survives contact with a dozen bank formats. This is the feature that makes the product usable at all. |
| **Categorisation** | Third tier of a three-tier classifier | Tried only after your own corrections and ~170 built-in merchant and keyword patterns miss — so it is cheap, fast and rarely needed |
| **Plain-language summary** | Turns the month's figures into a paragraph | Plain language is the brief's explicit ask |
| **Question answering** | Answers against your real data | Natural-language access to your own finances |

**What is not AI:** every number. Budgets, alerts, anomalies, trends, recurring
detection, savings maths and goal impact are all deterministic, unit-tested
functions in `src/lib/`. The model narrates and extracts. It never computes a
figure you are shown.

That line matters for a money product. It is also why the arithmetic is testable
— 476 tests, most of them against those engines.

### The model is never trusted

Everything the model returns passes through validation before it can reach the
database. `src/lib/alertParser.ts` re-derives amounts and dates itself, rejects
implausible values, and flags likely duplicates against existing transactions.
Parsed rows are shown for confirmation — **nothing the AI reads is ever saved
without you seeing it first**.

---

## Built with

- **Next.js 14** (App Router) · **TypeScript** · **Tailwind CSS v4**
- **Supabase** — Postgres, Auth, and row-level security on all six tables
- **OpenAI `gpt-4o-mini`** — extraction, classification, summary, Q&A
- **Chart.js** · **Zod** · **Vitest** (476 tests)
- Deployed on **Vercel**

---

## Running it locally

```bash
git clone https://github.com/PegBitStudio/ai4budget.git
cd ai4budget
npm install
cp .env.local.example .env.local   # then fill in the values below
npm run dev
```

You will need a Supabase project and an OpenAI key:

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-side only — used by the seed script |
| `OPENAI_API_KEY` | Extraction, classification, summary, Q&A |
| `DEMO_EMAIL` / `DEMO_PASSWORD` | Backs the one-click demo button |

Apply the schema in `supabase/migrations/001_initial_schema.sql`, then seed a
demo account with three months of transactions, a budget, a savings goal and
recurring commitments:

```bash
node scripts/seed-demo.mjs
```

The script is idempotent and dates everything relative to the day it runs, so the
demo always shows a current month.

```bash
npm test          # 476 tests
npm run build     # production build
```

---

## How it is put together

```
src/
├── lib/                  Business logic — pure, deterministic, unit-tested
│   ├── alertParser       Validation around the bank-alert model output
│   ├── classifier        Three tiers: your corrections → rules → model
│   ├── budgetEngine      Allocation, normalisation across periods
│   ├── spendingAnalyser  Anomalies, trends, recurring charges
│   ├── alertEngine       Budget alerts, derived on read
│   ├── savingsAdvisor    Targets, alternatives, goal impact
│   └── llmClient         The only file that talks to OpenAI
├── app/api/              14 route handlers
├── components/           UI, grouped by domain
└── app/(dashboard)/      The authenticated application
```

Two decisions worth calling out, because both were bugs first:

**Alerts are derived on read, not written on insert.** They were originally
stored when a transaction was saved, which meant anyone who logged transactions
*before* setting a budget — the natural order — never got an alert at all.

**Anomaly detection uses a median and ignores recurring charges.** Against a mean,
one ₦285,000 phone dragged the Shopping baseline high enough to hide itself, and
a gym membership charged identically every month was reported as "unusual". On
the demo account the detector went from five findings, four of them false, to
exactly one — the phone.

---

## What I would build next

1. **Read alerts straight from the notification tray** on Android, so even the
   pasting disappears.
2. **Shared household budgets** — most Nigerian household money is managed by
   more than one person, and every personal finance tool ignores this.
3. **Cancel-this actions on recurring charges**, turning the autopilot list from
   a report into a tool.
4. **Forecasting** — "at this rate you will be ₦32,000 over by month end" — the
   data is already there.

---

## A note on advice

KoboPilot offers general budgeting support based on the figures you give it. It
is not professional financial or investment advice, and it says so in-app.
