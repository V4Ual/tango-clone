import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/components/auth/AuthContext";
import { Navbar } from "@/components/layout/Navbar";
import { Suspense } from "react";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "TangoLive — Live Video Broadcasting & Virtual Gifts",
  description: "Next-generation social live broadcasting platform with real-time WebRTC and virtual gift animations.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full dark`}
    >
      <body className="min-h-full flex flex-col bg-[#090a10] text-zinc-100 antialiased selection:bg-rose-500 selection:text-white">
        <AuthProvider>
          <Suspense fallback={<p>Loading search…</p>}>

            <Navbar />
            <main className="flex-1 flex flex-col">{children}</main>
          </Suspense>
        </AuthProvider>
      </body>
    </html>
  );
}
