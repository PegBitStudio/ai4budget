# KoboPilot — written summary

**AI BuildFest 2026** · Track 3, *AI for Everyday Life* · Case Study 1, *AI Budgeting Assistant*

**Live:** [ai4budget.vercel.app](https://ai4budget.vercel.app) — click *"Explore the demo account"* (no signup)
**Code:** [github.com/PegBitStudio/ai4budget](https://github.com/PegBitStudio/ai4budget)

---

## The problem

Nigerians who earn well still cannot say where their money went — not from
carelessness, but because recording it is the work. Nobody types their expenses
into an app for more than a fortnight, so the discipline collapses and the month
ends in a shrug.

Yet every one of those transactions already produced a bank alert sitting unread
in their messages. GTBank, Zenith, Access, Kuda, Opay — hundreds of them,
complete and accurate. The record already exists. Nothing reads it.

## Who it is for

Salaried Nigerians and families managing a monthly income in Naira — the people
Case Study 1 describes as earning regularly and still struggling to see where it
goes. Built specifically for how money moves here: Bolt, Chowdeck, Shoprite,
EKEDC, MTN, Mile 12 market, and rent paid in one annual lump.

## How AI is used

AI is used in four places, each chosen because the app could not do it otherwise:

1. **Reading bank alerts.** Paste raw SMS from any bank, in any format, mixed
   together. The model extracts each transaction, strips account numbers, and
   ignores OTPs and marketing. No regex survives a dozen bank formats — this is
   what makes the product usable at all.
2. **Categorising spending** — the third tier of a classifier that tries your own
   past corrections first, then ~170 built-in Nigerian merchant patterns, and only
   then the model.
3. **Plain-language summaries** of the month, which the brief asks for explicitly.
4. **Answering questions** about your own data in natural language.

**Everything numerical is deterministic, tested code.** Budgets, alerts,
anomalies, trends, recurring-charge detection, savings targets and goal impact
are pure functions in `src/lib/`, covered by 476 tests. The model narrates and
extracts; it never computes a figure the user is shown. For a money product that
line matters — and it makes the arithmetic verifiable.

Nothing the model returns is trusted. Parsed rows are re-validated, checked for
plausibility, matched against existing transactions for duplicates, and shown for
confirmation. **Nothing the AI reads is saved without the user seeing it first.**

## What makes it different

Most budgeting tools stop at the figure. The brief's own criticism is that they
"present figures without explaining what actions should be taken."

KoboPilot prices spending in what it costs you. Not *"you spent ₦285,000"* but
*"that is about 3 months further from your savings goal, at the ₦90,000 a month
you are putting aside."* Same data, but the second one is a decision.

It also surfaces what is invisible by construction: recurring charges never look
unusual, so nobody notices them. On the demo account that is **₦456,000 a month
leaving on autopilot across 18 charges — ₦20,658 more than it used to be**, which
over a year costs more than the one-off purchase a user would agonise over.

## Tools used

Next.js 14 (App Router), TypeScript, Tailwind CSS v4 · Supabase (Postgres, Auth,
row-level security on all six tables) · OpenAI `gpt-4o-mini` · Chart.js · Zod ·
Vitest (476 tests) · deployed on Vercel. Built with Claude Code as a pair.

## What I would build next

1. **Read alerts directly from the Android notification tray**, so even the
   pasting disappears.
2. **Shared household budgets.** Most Nigerian household money is managed by more
   than one person, and personal finance tools uniformly ignore this.
3. **Cancel-this actions on recurring charges**, turning the autopilot list from a
   report into a tool.
4. **Forecasting** — *"at this rate you will be ₦32,000 over by month end"* — the
   data is already in place.

---

*KoboPilot offers general budgeting support based on the figures you give it. It
is not professional financial or investment advice, and says so in-app.*
