# Demo video script — KoboPilot

**Limit: 3 minutes.** This runs to about 2:50, which leaves room to breathe.

Judges score *Presentation & Storytelling* at 15%, and it is the only criterion
entirely within your control on the day. The single rule: **show the product
doing something, do not describe the product.**

---

## Before you record

- [ ] Open **ai4budget.vercel.app** in a **private window** — no stale service
      worker, no logged-in session, and it proves the demo path works cold
- [ ] Run `node scripts/seed-demo.mjs` so the demo account is clean and current
- [ ] Have the alert text below **already copied to your clipboard**
- [ ] Close every other tab. Hide bookmarks. Full screen.
- [ ] Do one silent dry run — the paste step takes ~6 seconds and you need to
      know what that silence feels like
- [ ] Record at 1440×900 or wider so the sidebar is visible

**Paste buffer** (copy this before you start):

```
GTBank Alert
Txn: NGN6,200.00
Acc: ****4471
Desc: POS/WEB PURCHASE/CHOWDECK LAGOS
Date: 24-AUG-2026

Debit Alert
Amount: NGN 15,000.00
Description: TOTAL FILLING STATION LEKKI
Date & Time: 23-Aug-2026 07:41:02

Zenith Bank
Amt: NGN 3,500.00 DR
Desc: BOLT RIDE
Date: 22/08/2026

You sent ₦18,400.00 to JUMIA NIGERIA on 21 Aug 2026.

Opay: You received ₦25,000.00 from ADEBAYO T. on 20 Aug 2026.

Dear customer, your transaction OTP is 771204. Never share this code.
```

That buffer is deliberate: five banks, five formats, one credit, and an OTP that
must be ignored. Verified against production — it returns exactly five
transactions in about four seconds.

---

## 0:00 – 0:25 · The problem

> *[Landing page]*
>
> "Every month, millions of Nigerians earn well and still can't say where the
> money went.
>
> Not because they're careless. Because recording it is the work — and nobody
> types their expenses into an app for more than two weeks.
>
> But every one of those transactions already sent them a bank alert. Hundreds
> of them, sitting in their messages, completely unused."

> *[Click "Explore the demo account"]*
>
> "This is KoboPilot. It reads them."

**Note:** don't say "I built an AI budgeting app." Every entry is an AI app. Lead
with the problem, and let the product be the answer.

---

## 0:25 – 1:15 · The hook — paste your alerts

> *[Transactions → "Import your spending" → paste the buffer → "Read these alerts"]*
>
> "These are five alerts from five different banks. Different formats, mixed
> together — exactly how they arrive."

> *[While it reads — ~6 seconds. Don't fill the silence with filler; say this:]*
>
> "It's reading each one now."

> *[Review table appears]*
>
> "Five transactions. It stripped the account numbers. It worked out that the
> Opay one was money coming *in*, not going out. And it ignored the OTP —
> that's not a transaction.
>
> Every one is already categorised. Chowdeck is Dining. Total is Transport.
>
> And nothing is saved yet. It's showing me first."

> *[Click "Add 5 transactions"]*

**This is your strongest 50 seconds.** Do not rush it. If one thing lands with
the judges, it is watching unstructured mess become a categorised month.

---

## 1:15 – 2:05 · The insight — what it found

> *[Insights page]*
>
> "Now the part that's actually hard."

> *[Point at the anomaly]*
>
> "One unusual transaction this month — a phone, at 18 times my usual Shopping
> spend. Not my rent, not my gym membership. Those repeat every month, so
> they're not surprises."

> *[Point at the goal-impact line]*
>
> "And here's the line I care about most. It doesn't just say I spent ₦285,000.
> It says that's **three months further from my savings goal**, at the rate I'm
> actually saving.
>
> That's a number I can make a decision with."

> *[Scroll to Money on autopilot]*
>
> "And this — ₦456,000 a month leaving on autopilot across 18 recurring charges.
> ₦20,000 a month more than it used to be. Nobody notices ₦20,000 a month. Over
> a year it costs the same as the phone I'd agonise over."

---

## 2:05 – 2:35 · Ask it anything

> *[Assistant page — click the starter chip "What should I cut first?"]*
>
> "And I can just ask."

> *[Answer appears]*
>
> "It answers against my actual numbers — in Naira, with the categories that are
> genuinely over, and what to do about each one."

---

## 2:35 – 2:50 · Close

> *[Back to Overview]*
>
> "Everything you saw came from pasted bank alerts.
>
> The AI reads them and explains them. Every figure on this screen — the
> budgets, the alerts, the savings maths — is computed, tested code. The model
> never invents a number.
>
> KoboPilot. Built for AI BuildFest 2026."

---

## What to cut if you run long

In this order:
1. The Assistant section (2:05–2:35) — the paste and the insight are stronger
2. The autopilot card — keep the goal-impact line, it's the memorable one
3. Trim the opening to two sentences

**Never cut the paste demo.** That is the entry.

---

## Things that will cost you marks

- **Reading the UI aloud.** "Here's the dashboard, here are the cards." Judges
  can see it. Say what it *means*.
- **Apologising.** No "this is just a prototype", no "I didn't have time to".
- **Dead air during the parse.** Say one sentence, then let it land.
- **Talking about the stack.** Nobody scores you for Next.js. The written
  summary covers tools; the video is for the product.
- **Starting with your name and the track number.** Start with the problem.
