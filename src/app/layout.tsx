import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#1e40af",
};

export const metadata: Metadata = {
  title: "AI Budgeting Assistant",
  description: "AI-powered personal budgeting assistant",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Budget AI",
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
        <main className="flex-1">{children}</main>
        <footer className="px-4 py-3 text-center text-gray-500 text-base">
          <p>
            This app provides general budgeting support and does not constitute
            professional financial, investment, tax, or legal advice.
          </p>
        </footer>
      </body>
    </html>
  );
}
