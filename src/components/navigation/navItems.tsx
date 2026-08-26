import * as React from "react";

export interface NavItem {
  href: string;
  label: string;
  /** Shorter label for the mobile bar, where width is scarce. */
  shortLabel?: string;
  icon: React.ReactNode;
  /** Kept out of the mobile bar, which holds five at most before it crowds. */
  desktopOnly?: boolean;
}

/**
 * One source of truth for navigation, shared by the sidebar and the mobile bar.
 *
 * Icons are drawn at a consistent 1.5px stroke on a 24px grid so they sit
 * together as a set rather than as seven separately-chosen glyphs.
 */
const iconProps = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  className: "size-5 shrink-0",
  "aria-hidden": true,
};

export const NAV_ITEMS: NavItem[] = [
  {
    href: "/dashboard",
    label: "Overview",
    icon: (
      <svg {...iconProps}>
        <path d="M3 13h6V3H3zM15 21h6V11h-6zM3 21h6v-4H3zM15 7h6V3h-6z" />
      </svg>
    ),
  },
  {
    href: "/transactions",
    label: "Transactions",
    shortLabel: "Activity",
    icon: (
      <svg {...iconProps}>
        <path d="M3 7h13l-3-3M21 17H8l3 3" />
      </svg>
    ),
  },
  {
    href: "/budget",
    label: "Budget",
    icon: (
      <svg {...iconProps}>
        <path d="M4 5h16v14H4zM4 10h16M9 10v9" />
      </svg>
    ),
  },
  {
    href: "/analysis",
    label: "Insights",
    icon: (
      <svg {...iconProps}>
        <path d="M4 19V5M4 19h16M8 15l3.5-4L15 14l4.5-6" />
      </svg>
    ),
  },
  {
    href: "/savings",
    label: "Goals",
    icon: (
      <svg {...iconProps}>
        <circle cx="12" cy="12" r="8" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    ),
  },
  {
    href: "/qa",
    label: "Assistant",
    shortLabel: "Ask",
    icon: (
      <svg {...iconProps}>
        <path d="M21 12a8 8 0 1 1-3.2-6.4M12 8v4M12 16h.01" />
      </svg>
    ),
  },
  {
    href: "/reports",
    label: "Reports",
    // Desktop only: a printable month is not something anyone assembles on a
    // phone, and the bottom bar is already at the number of items it can hold.
    desktopOnly: true,
    icon: (
      <svg {...iconProps}>
        <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
        <path d="M14 3v5h5M9 13h6M9 17h4" />
      </svg>
    ),
  },
  {
    href: "/settings",
    label: "Settings",
    desktopOnly: true,
    icon: (
      <svg {...iconProps}>
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.9 1.2 2 2 0 1 1-4 0 1.7 1.7 0 0 0-2.9-1.2l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.7 1.7 0 0 0 4.6 15a2 2 0 1 1 0-4 1.7 1.7 0 0 0 1.2-2.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.7 1.7 0 0 0 11.5 4a2 2 0 1 1 4 0 1.7 1.7 0 0 0 2.9 1.2l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0 1.2 2.9 2 2 0 1 1 0 4 1.7 1.7 0 0 0-1.5 1.1z" />
      </svg>
    ),
  },
];

/** Titles for the contextual page header, keyed by route. */
export const PAGE_META: Record<
  string,
  { title: string; description?: string }
> = {
  "/dashboard": {
    title: "Overview",
    description: "Where your money went this month, and what it means.",
  },
  "/transactions": {
    title: "Transactions",
    description: "Everything recorded, sorted automatically.",
  },
  "/budget": {
    title: "Budget",
    description: "What you planned against what you actually spent.",
  },
  "/analysis": {
    title: "Insights",
    description: "Unusual spending, rising costs and money on autopilot.",
  },
  "/savings": {
    title: "Goals",
    description: "What you are saving for, and whether you will get there.",
  },
  "/qa": {
    title: "Assistant",
    description: "Ask about your money in plain English.",
  },
  "/reports": {
    title: "Reports",
    description: "A month, written out.",
  },
  "/settings": {
    title: "Settings",
    description: "Your account, commitments and data.",
  },
};

export function isActive(pathname: string, href: string): boolean {
  return href === "/dashboard"
    ? pathname === "/dashboard"
    : pathname.startsWith(href);
}
