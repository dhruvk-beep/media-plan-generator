import type { Metadata } from "next";
import { Outfit } from "next/font/google";
import { SessionProvider } from "next-auth/react";
import "./globals.css";

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Media Plan Generator — Hovers",
  description: "Internal media planning tool for Hovers Performance Marketing",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${outfit.variable} h-full antialiased dark`}>
      <body className="min-h-full flex flex-col font-[var(--font-outfit)] bg-[#0a0a0a]">
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  );
}
