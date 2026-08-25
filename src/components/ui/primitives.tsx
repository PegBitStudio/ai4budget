import * as React from "react";
import Link from "next/link";

/**
 * The shared vocabulary every screen is built from.
 *
 * These exist so the design language is enforced by the component rather than
 * by remembering to type the right utility classes. When a page needs a
 * surface, a heading or a figure, it reaches for one of these instead of
 * inventing a new combination of borders and radii.
 */

export function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

// --- Surface ---------------------------------------------------------------

/**
 * The standard panel. Hairline border, near-flat, minimal radius — the visual
 * default of a serious financial interface. Shadow is reserved for things that
 * genuinely sit above the page.
 */
export function Card({
  className,
  children,
  as: Tag = "div",
  ...rest
}: React.HTMLAttributes<HTMLElement> & { as?: "div" | "section" | "article" }) {
  return (
    <Tag
      className={cx(
        "rounded-lg border border-ink-200 bg-paper shadow-card",
        className
      )}
      {...rest}
    >
      {children}
    </Tag>
  );
}

export function CardHeader({
  title,
  description,
  action,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cx(
        "flex items-start justify-between gap-4 border-b border-ink-100 px-5 py-4",
        className
      )}
    >
      <div className="min-w-0">
        <h2 className="text-title text-ink-900">{title}</h2>
        {description && (
          <p className="mt-0.5 text-label text-ink-500">{description}</p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

// --- Page scaffolding ------------------------------------------------------

/**
 * Contextual page header. Every authenticated screen opens the same way, which
 * is most of what makes a set of pages feel like one product.
 */
export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4 pb-6">
      <div className="min-w-0">
        {eyebrow && (
          <p className="text-eyebrow uppercase text-ink-500">{eyebrow}</p>
        )}
        <h1 className="mt-1.5 text-display text-ink-950">{title}</h1>
        {description && (
          <p className="mt-2 max-w-2xl text-body text-ink-600">{description}</p>
        )}
      </div>
      {actions && (
        <div className="flex shrink-0 items-center gap-2">{actions}</div>
      )}
    </header>
  );
}

export function Section({
  title,
  description,
  action,
  children,
  className,
}: {
  title?: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cx("mt-8 first:mt-0", className)}>
      {(title || action) && (
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            {title && <h2 className="text-title text-ink-900">{title}</h2>}
            {description && (
              <p className="mt-0.5 text-label text-ink-500">{description}</p>
            )}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

// --- Controls --------------------------------------------------------------

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  // Ink, not a hue. A saturated primary on every screen is what makes an
  // interface read as a template.
  primary:
    "bg-ink-900 text-paper hover:bg-ink-800 active:bg-ink-950 disabled:bg-ink-300",
  secondary:
    "border border-ink-200 bg-paper text-ink-800 hover:border-ink-300 hover:bg-ink-50 disabled:text-ink-400",
  ghost: "text-ink-600 hover:bg-ink-100 hover:text-ink-900",
  danger:
    "bg-negative-600 text-paper hover:bg-negative-700 disabled:bg-ink-300",
};

export function Button({
  variant = "secondary",
  size = "md",
  className,
  children,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: "sm" | "md";
}) {
  return (
    <button
      className={cx(
        "inline-flex items-center justify-center gap-2 rounded-md font-medium",
        "transition-colors duration-[--duration-fast]",
        "disabled:cursor-not-allowed",
        size === "sm"
          ? "min-h-8 px-3 text-label"
          : "min-h-10 px-4 text-body font-medium",
        BUTTON_VARIANTS[variant],
        className
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

/**
 * A link that carries button styling. Kept separate rather than giving Button
 * an `asChild` escape hatch — a link should stay a real anchor so it keeps
 * middle-click, open-in-new-tab and the right semantics for assistive tech.
 */
export function LinkButton({
  href,
  variant = "secondary",
  size = "md",
  className,
  children,
}: {
  href: string;
  variant?: ButtonVariant;
  size?: "sm" | "md";
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cx(
        "inline-flex items-center justify-center gap-2 rounded-md font-medium",
        "transition-colors duration-[--duration-fast]",
        size === "sm"
          ? "min-h-8 px-3 text-label"
          : "min-h-10 px-4 text-body font-medium",
        BUTTON_VARIANTS[variant],
        className
      )}
    >
      {children}
    </Link>
  );
}

// --- Status ----------------------------------------------------------------

type Tone = "neutral" | "positive" | "negative" | "warning" | "ai";

const BADGE_TONES: Record<Tone, string> = {
  neutral: "bg-ink-100 text-ink-700",
  positive: "bg-positive-50 text-positive-700",
  negative: "bg-negative-50 text-negative-700",
  warning: "bg-warning-50 text-warning-700",
  ai: "bg-jade-50 text-jade-700",
};

export function Badge({
  tone = "neutral",
  children,
  className,
}: {
  tone?: Tone;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 rounded-xs px-1.5 py-0.5 text-eyebrow uppercase",
        BADGE_TONES[tone],
        className
      )}
    >
      {children}
    </span>
  );
}

/**
 * A change against a previous period. Direction is carried by colour and by an
 * arrow, so it survives being read without colour.
 */
export function Delta({
  value,
  suffix = "",
  invert = false,
  className,
}: {
  value: number | null;
  suffix?: string;
  /** For spending, an increase is bad — flip which direction reads positive. */
  invert?: boolean;
  className?: string;
}) {
  if (value === null || !Number.isFinite(value)) {
    return null;
  }

  const rising = value > 0;
  const flat = Math.round(Math.abs(value)) === 0;
  const good = invert ? !rising : rising;

  const tone = flat
    ? "text-ink-500"
    : good
      ? "text-positive-600"
      : "text-negative-600";

  return (
    <span className={cx("inline-flex items-center gap-1 tnum", tone, className)}>
      <span aria-hidden="true">{flat ? "–" : rising ? "▲" : "▼"}</span>
      {Math.abs(Math.round(value))}
      {suffix}
    </span>
  );
}

// --- Empty state -----------------------------------------------------------

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center rounded-lg border border-dashed border-ink-200 px-6 py-12 text-center">
      <p className="text-title text-ink-900">{title}</p>
      <p className="mt-1.5 max-w-sm text-body text-ink-500">{description}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx("skeleton", className)} aria-hidden="true" />;
}
