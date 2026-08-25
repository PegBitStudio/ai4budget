import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import ServiceWorkerCleanup from "@/components/ServiceWorkerCleanup";

const inter = Inter({ subsets: ["latin"] });

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#1e40af",
};

const title = "KoboPilot — AI Budgeting Assistant";
const description = "Your AI co-pilot for spending, budgeting and saving in Naira";

export const metadata: Metadata = {
  // Required for the file-convention OG image (opengraph-image.tsx) to resolve
  // to an absolute URL — without it, link previews on WhatsApp and Instagram
  // silently fail to load an image at all. Override with NEXT_PUBLIC_SITE_URL
  // if this ever moves off the current Vercel URL.
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://ai4budget.vercel.app"
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
    <html lang="en">
      <body className={`${inter.className} min-h-screen flex flex-col`}>
        <ServiceWorkerCleanup />
        {children}
      </body>
    </html>
  );
}
