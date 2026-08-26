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
complete and accurate. **The record already exists. Nothing reads it.**

## Who it is for

Salaried Nigerians and families managing a monthly income in Naira — the people
Case Study 1 describes as earning regularly and still struggling to see where it
goes. Built for how money moves here: Bolt, Shoprite, EKEDC, MTN, Mile 12 market,
rent paid in one lump. Naira is the default, but nothing is hardcoded to one
currency — an account picks from eight at signup and every screen follows.

## How AI is used

Four places, each chosen because the app could not do it otherwise:

1. **Reading bank alerts.** Paste raw SMS from any bank, in any format, mixed
   together. The model extracts each transaction, strips account numbers, and
   ignores OTPs and marketing. No regex survives a dozen bank formats — this is
   what makes the product usable at all.
2. **Categorising spending** — the *third* tier of a classifier that tries your
   own corrections first, then ~170 Nigerian merchant keywords across nine
   category rules, then the model. Correct a category once and the rule sticks.
3. **Plain-language summaries** of the month, which the brief asks for explicitly.
4. **Answering questions** in natural language — simple lookups answered in about
   a second without calling the model at all.

**Everything numerical is deterministic, tested code.** Budgets, alerts,
anomalies, trends, recurring-charge detection, savings targets, goal impact and
month-end forecasts are pure functions in `src/lib/`, covered by **600 tests**.
The model narrates and extracts; **it never computes a figure the user is
shown.** An LLM doing arithmetic on someone's salary is how you ship an app that
confidently reports the wrong number.

Nothing the model returns is trusted either. Parsed rows are re-validated,
checked for plausibility, matched for duplicates, and shown for confirmation.
**Nothing the AI reads is saved without the user seeing it first.**

## What makes it different

Most budgeting tools stop at the figure. The brief's own criticism is that they
*"present figures without explaining what actions should be taken."*

**It prices spending in what it costs you.** Not *"you spent ₦285,000"* but
*"that is about 3 months further from your savings goal, at the ₦90,000 a month
you are putting aside."* Same data; the second one is a decision.

**It warns before the month ends.** A forecast projects where each category
lands — *"Dining is already ₦37,050 past its ₦30,000 plan; at this rate it
finishes around ₦79,944."* It is deliberately reluctant: on the demo it projects
five categories and **refuses the sixth**, because one ₦285,000 phone dominates
that category and a rate read from it would be a lie.

**It surfaces what is invisible by construction.** Recurring charges never look
unusual, so nobody notices them — **₦463,800 a month across 18 charges, ₦25,858
more than they used to be.** Over a year that costs more than the one-off
purchase anyone would agonise over.

All of it gathers into one ranked feed behind a bell in the app frame, so a
warning is not something you have to go looking for.

## Responsible use

The brief requires budgeting support that does not present itself as
professional financial or investment advice. That is honoured in wording — at
signup, in settings, on every report, and in the model's prompt — and **enforced
in code**.

An investment question never reaches the model: it is intercepted and answered
with a fixed refusal, because the one answer that must not vary with sampling
temperature is the one about the limits of the product. It declines, says a
licensed adviser is the right place for that question, then answers the part it
legitimately can — what is actually spare this month. Matching is on the *ask*,
not the noun, so *"how much did I spend on my pension"* is still answered.

## Tools used

Next.js 14 (App Router), TypeScript, Tailwind CSS v4 · Supabase (Postgres, Auth,
row-level security on all six tables) · OpenAI `gpt-4o-mini` · Chart.js · Zod ·
Vitest (600 tests) · deployed on Vercel. Built with Claude Code as a pair.

## What I would build next

1. **Read alerts from the Android notification tray**, so even the pasting goes.
2. **Alerts that arrive when the app is closed** — everything is computed on read
   today, which is accurate but silent.
3. **Shared household budgets.** Most Nigerian household money is managed by more
   than one person, and personal finance tools uniformly ignore this.
4. **Cancel-this actions on recurring charges**, turning the autopilot list from
   a report into a tool.

---

*KoboPilot offers general budgeting support based on the figures you give it. It
is not professional financial or investment advice, and says so in-app.*

*Figures above are the product's own output on the demo account (92 transactions,
June–August 2026), verified 26 August 2026.*
