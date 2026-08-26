export interface Quote {
  text: string;
  attribution: string;
}

/**
 * A fortnight of them, rotating one a day.
 *
 * Short and attributed. Nothing invented and nothing put in someone's mouth —
 * an unsourced line that sounds like wisdom is just decoration, and this is a
 * product whose entire argument is that its figures can be trusted.
 *
 * The tone is deliberately about restraint and attention rather than getting
 * rich: this is a budgeting tool, not an investment product, and the app is
 * explicit elsewhere that it does not give investment advice.
 */
export const QUOTES: Quote[] = [
  {
    text: "Do not save what is left after spending; spend what is left after saving.",
    attribution: "Warren Buffett",
  },
  {
    text: "Beware of little expenses; a small leak will sink a great ship.",
    attribution: "Benjamin Franklin",
  },
  {
    text: "A budget is telling your money where to go instead of wondering where it went.",
    attribution: "John C. Maxwell",
  },
  {
    text: "It is not your salary that makes you rich, it is your spending habits.",
    attribution: "Charles A. Jaffe",
  },
  {
    text: "Never spend your money before you have earned it.",
    attribution: "Thomas Jefferson",
  },
  {
    text: "Wealth consists not in having great possessions, but in having few wants.",
    attribution: "Epictetus",
  },
  {
    text: "What gets measured gets managed.",
    attribution: "Peter Drucker",
  },
  {
    text: "Money looks better in the bank than on your feet.",
    attribution: "Sophia Amoruso",
  },
  {
    text: "An investment in knowledge pays the best interest.",
    attribution: "Benjamin Franklin",
  },
  {
    text: "Wealth is the slave of a wise man, the master of a fool.",
    attribution: "Seneca",
  },
  {
    text: "Rich people plan for three generations. Poor people plan for Saturday night.",
    attribution: "Gloria Steinem",
  },
  {
    text: "However far the stream flows, it never forgets its source.",
    attribution: "African proverb",
  },
  {
    text: "Price is what you pay. Value is what you get.",
    attribution: "Warren Buffett",
  },
  {
    text: "You must gain control over your money or the lack of it will forever control you.",
    attribution: "Dave Ramsey",
  },
];

/**
 * The same quote all day, a different one tomorrow, the same one for everybody.
 *
 * Indexed on the calendar day rather than chosen at random, so a refresh does
 * not reshuffle it — a line that changes while you are reading it reads as a
 * bug. Built from the local date parts rather than an epoch millisecond count,
 * because "which day is it" is a question about the reader's clock, not UTC's:
 * in WAT, `getTime()` would roll the quote over at 1am.
 */
export function quoteForDay(date: Date = new Date()): Quote {
  const days = Math.floor(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86_400_000
  );
  // `%` keeps the sign of the dividend, and dates before 1970 are negative.
  const index = ((days % QUOTES.length) + QUOTES.length) % QUOTES.length;
  return QUOTES[index];
}
