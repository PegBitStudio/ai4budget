export const THEME_KEY = "kobopilot-theme";

export type ThemeChoice = "light" | "dark" | "system";

export const THEME_CHOICES: ThemeChoice[] = ["light", "dark", "system"];

export function isThemeChoice(value: unknown): value is ThemeChoice {
  return value === "light" || value === "dark" || value === "system";
}

/**
 * Runs in the document head, before the first paint.
 *
 * It has to be inline and blocking: read the stored choice after paint and the
 * page flashes white before turning dark, which is worse than not offering the
 * theme at all. Kept to a string of plain ES5 with no imports, because it runs
 * before any bundle has loaded.
 *
 * It resolves "system" here rather than in CSS so the stylesheet needs one
 * `[data-theme="dark"]` block instead of that block plus a media query saying
 * the same thing — two places to keep in step is one too many.
 */
export const THEME_BOOT_SCRIPT = `
(function () {
  try {
    var stored = localStorage.getItem('${THEME_KEY}');
    var choice = stored === 'light' || stored === 'dark' ? stored : 'system';
    var mq = window.matchMedia('(prefers-color-scheme: dark)');
    var apply = function () {
      var resolved = choice === 'system' ? (mq.matches ? 'dark' : 'light') : choice;
      document.documentElement.setAttribute('data-theme', resolved);
    };
    apply();
    if (mq.addEventListener) {
      mq.addEventListener('change', function () {
        if (choice === 'system') apply();
      });
    }
  } catch (e) {
    document.documentElement.setAttribute('data-theme', 'light');
  }
})();
`;

/** Reads the stored choice. Safe to call before hydration finishes. */
export function readThemeChoice(): ThemeChoice {
  if (typeof window === "undefined") return "system";
  try {
    const stored = window.localStorage.getItem(THEME_KEY);
    return isThemeChoice(stored) ? stored : "system";
  } catch {
    return "system";
  }
}

/** Stores the choice and applies it immediately. */
export function applyThemeChoice(choice: ThemeChoice): void {
  if (typeof window === "undefined") return;

  try {
    if (choice === "system") {
      window.localStorage.removeItem(THEME_KEY);
    } else {
      window.localStorage.setItem(THEME_KEY, choice);
    }
  } catch {
    // A blocked storage API should still let the theme change for this visit.
  }

  const resolved =
    choice === "system"
      ? window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light"
      : choice;

  document.documentElement.setAttribute("data-theme", resolved);
}

/** What is actually on screen right now, whatever the stored choice says. */
export function resolvedTheme(): "light" | "dark" {
  if (typeof document === "undefined") return "light";
  return document.documentElement.getAttribute("data-theme") === "dark"
    ? "dark"
    : "light";
}
