import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "LinkedIn Triage — On-Demand Messaging Dashboard",
  description:
    "Zero-retention LinkedIn messaging triage dashboard. Automatically classify and respond to inbound messages using AI-powered categorization. No data stored.",
  keywords: [
    "LinkedIn",
    "messaging",
    "triage",
    "AI",
    "automation",
    "zero-retention",
  ],
  robots: "noindex, nofollow",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} antialiased`}>{children}</body>
    </html>
  );
}
