# Demo video script — KoboPilot

**Limit: 3 minutes.** This version targets about 2:15 written, on purpose —
your last take ran 3:24 against a script estimated at 2:50, a ~20% overrun in
delivery. Read this one a little brisker than feels natural, and it should
land around 2:30–2:45 with real margin to spare.

Judges score *Presentation & Storytelling* at 15%, and it is the only criterion
entirely within your control on the day. The single rule: **show the product
doing something, do not describe the product.**

---

## Before you record

- [ ] Open **kobopilot.vercel.app** in a **private window** — no stale service
      worker, no logged-in session, and it proves the demo path works cold
- [ ] Run `node scripts/seed-demo.mjs` so the demo account is clean and current
- [ ] Have the alert text below **already copied to your clipboard**
- [ ] Close every other tab. Hide bookmarks. Full screen.
- [ ] Do one silent dry run, timed. If it runs past 2:45, cut before you
      record for real — don't find out live.
- [ ] Don't improvise beyond this script — every claim and figure in it was
      verified against the live app today. Anything ad-libbed hasn't been
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

## 0:00 – 0:10 · Open

> *[Landing page → click "Explore the demo account"]*
>
> "KoboPilot turns your bank alerts into a budget you never had to type in
> yourself."

**No preamble.** No name, no track number, no "the problem is." One sentence,
then click.

---

## 0:10 – 0:25 · Overview

> *[Dashboard]*
>
> "A month, already read and sorted. Over ₦750,000 spent against ₦535,000
> earned — and it already told me Shopping is the problem."

---

## 0:25 – 1:05 · The hook — paste your alerts

> *[Transactions → "Import your spending" → paste the buffer → "Read these alerts"]*
>
> "Five alerts, five banks — exactly how they arrive."

> *[While it reads — ~5 seconds. One sentence, then silence:]*
>
> "Reading them now."

> *[Review table appears]*
>
> "Numbers stripped, everything categorised, nothing saved yet."

> *[Click "Add 5 transactions"]*

**Still the strongest 40 seconds in the video.** Don't rush the paste itself —
trim words elsewhere, not here.

---

## 1:05 – 1:25 · Budget

> *[Budget page]*
>
> "The budget is fully mine to edit — change one category and only that one
> moves. Shopping's already ₦300,500 against a ₦20,000 plan."

---

## 1:25 – 1:45 · Insights

> *[Insights page, point at the anomaly]*
>
> "It catches what I'd miss myself — this purchase is 18 times my usual
> Shopping spend, and it's put my savings goal three months further away."

---

## 1:45 – 2:05 · Ask it anything

> *[Assistant page → click the starter chip "What should I cut first?"]*
>
> "And I can just ask."

> *[Answer appears]*
>
> "Same numbers, in plain English."

---

## 2:05 – 2:15 · Close

> "Every figure here is computed, tested code. The AI only reads it back to
> you. KoboPilot."

---

## What to cut if you run long

In this order:
1. The Insights beat (1:25–1:45) — Budget already showed the over-plan number
2. Trim the Overview line to just the two figures, drop "already told me..."
3. The Assistant beat — keep it only if you're still under 2:30 without it

**Never cut the paste demo.** That is the entry.

---

## Things that will cost you marks

- **Reading the UI aloud.** "Here's the dashboard, here are the cards." Judges
  can see it. Say what it *means*.
- **Apologising.** No "this is just a prototype", no "I didn't have time to".
- **Dead air during the parse.** Say one sentence, then let it land.
- **Talking about the stack.** Nobody scores you for Next.js. The written
  summary covers tools; the video is for the product.
- **Starting with your name and the track number.** Start with the product.
- **Reading slower than your dry run.** That's exactly how the last take ran
  34 seconds long. Match your dry-run pace, not a more "presentational" one.
