import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import ServiceWorkerCleanup from "@/components/ServiceWorkerCleanup";
import { THEME_BOOT_SCRIPT } from "@/lib/theme";

// A friendlier geometric than Inter — rounder bowls, more open apertures —
// while still holding up at display sizes. Variable, so the weight range costs
// one file. `display: swap` keeps first paint from waiting on it.
const sans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-sans",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  // Matches each theme's page ground, so the browser chrome on mobile does
  // not sit in the wrong colour against the app.
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f8f7" },
    { media: "(prefers-color-scheme: dark)", color: "#0c0f10" },
  ],
};

const title = "KoboPilot — AI Budgeting Assistant";
const description = "Your AI co-pilot for spending, budgeting and saving in Naira";

export const metadata: Metadata = {
  // Required for the file-convention OG image (opengraph-image.tsx) to resolve
  // to an absolute URL — without it, link previews on WhatsApp and Instagram
  // silently fail to load an image at all. Override with NEXT_PUBLIC_SITE_URL
  // if this ever moves off the current Vercel URL.
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://kobopilot.vercel.app"
  ),
  title,
  description,
  openGraph: {
    title,
    description,
    siteName: "KoboPilot",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "KoboPilot",
  },
  icons: {
    apple: "/apple-touch-icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // The boot script writes data-theme before React sees the document, so the
    // server-rendered markup and the first client render disagree by design.
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          // Blocking and inline on purpose: a theme applied after paint is a
          // white flash on every navigation for anyone using dark.
          dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }}
        />
      </head>
      <body className={`${sans.className} min-h-screen flex flex-col`}>
        <ServiceWorkerCleanup />
        {children}
      </body>
    </html>
  );
}
