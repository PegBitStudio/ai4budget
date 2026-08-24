"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const PAGE_TITLES: Record<string, string> = {
  "/": "Dashboard",
  "/budget": "Budget",
  "/analysis": "Analysis",
  "/qa": "AI Chat",
  "/savings": "Savings",
  "/settings": "Settings",
  "/transactions": "Transactions",
};

export default function TopHeader() {
  const pathname = usePathname();
  const title = PAGE_TITLES[pathname] ?? "AI4Budget";

  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-sm border-b border-gray-100">
      <div className="flex items-center justify-between h-14 px-4 sm:px-6 max-w-5xl mx-auto">
        {/* Left: App branding / page title */}
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="flex items-center gap-2 min-h-[44px] min-w-[44px]"
            aria-label="Go to dashboard"
          >
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-700 to-blue-500 flex items-center justify-center shadow-sm">
              <span className="text-white font-bold text-sm">$</span>
            </div>
          </Link>
          <h1 className="text-lg font-semibold text-gray-900 truncate">
            {title}
          </h1>
        </div>

        {/* Right: profile/settings */}
        <div className="flex items-center gap-1">
          <Link
            href="/settings"
            className="flex items-center justify-center min-h-[44px] min-w-[44px] rounded-lg text-gray-500 hover:text-blue-600 hover:bg-gray-50 transition-colors"
            aria-label="Settings"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
              <path fillRule="evenodd" d="M18.685 19.097A9.723 9.723 0 0 0 21.75 12c0-5.385-4.365-9.75-9.75-9.75S2.25 6.615 2.25 12a9.723 9.723 0 0 0 3.065 7.097A9.716 9.716 0 0 0 12 21.75a9.716 9.716 0 0 0 6.685-2.653Zm-12.54-1.285A7.486 7.486 0 0 1 12 15a7.486 7.486 0 0 1 5.855 2.812A8.224 8.224 0 0 1 12 20.25a8.224 8.224 0 0 1-5.855-2.438ZM15.75 9a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z" clipRule="evenodd" />
            </svg>
          </Link>
        </div>
      </div>
    </header>
  );
}
