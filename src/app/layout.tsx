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

export const metadata: Metadata = {
  title: "KoboPilot — AI Budgeting Assistant",
  description: "Your AI co-pilot for spending, budgeting and saving in Naira",
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
