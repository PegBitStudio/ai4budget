import Link from "next/link";
import AuthAside from "@/components/auth/AuthAside";

/**
 * Sign in and sign up, split.
 *
 * Form on the left where the work is, the product's own figures on the right.
 * The panel collapses below `lg` rather than stacking — on a phone, scrolling
 * past a decorative panel to reach a password field is worse than not having
 * the panel at all.
 */
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="grid min-h-screen bg-ink-50 lg:grid-cols-2">
      <div className="flex min-w-0 flex-col px-5 py-8 sm:px-8">
        {/* On the wide layout the mark lives on the dark panel, so it is not
            repeated here. */}
        <Link
          href="/"
          className="inline-flex items-center gap-2.5 self-start rounded-md lg:hidden"
        >
          <span className="grid size-8 place-items-center rounded-md bg-ink-900 text-body font-semibold text-paper">
            K
          </span>
          <span className="text-title text-ink-900">KoboPilot</span>
        </Link>

        <div className="animate-rise flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-sm">{children}</div>
        </div>

        <p className="text-center text-label text-ink-500">
          <Link
            href="/"
            className="rounded-xs underline-offset-2 transition-colors duration-[--duration-fast] hover:text-ink-800 hover:underline"
          >
            Back to home
          </Link>
        </p>
      </div>

      <AuthAside />
    </div>
  );
}
