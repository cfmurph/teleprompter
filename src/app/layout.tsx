import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { StoreHydration } from "@/components/StoreHydration";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Teleprompter — Flow",
  description: "Professional teleprompter with real-time collaboration",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased dark`}
    >
      <body className="min-h-full bg-background text-foreground">
        <StoreHydration />
        {children}
      </body>
    </html>
  );
}
