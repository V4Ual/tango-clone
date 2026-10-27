"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/AuthContext";
import { Radio, Video, Gift, Coins, Sparkles, ArrowRight, ShieldCheck, Heart, Flame } from "lucide-react";

export default function HomePage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) {
      router.push("/live");
    }
  }, [user, loading, router]);

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-4 py-16 sm:px-6 relative overflow-hidden">
      {/* Background ambient lighting */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[650px] h-[380px] bg-gradient-to-tr from-[#FF007A]/25 via-[#7928CA]/20 to-[#00F0FF]/15 rounded-full blur-[110px] pointer-events-none" />

      {/* Hero Badge */}
      <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-wider bg-white/5 border border-white/10 text-[#FF2E93] mb-6 backdrop-blur-md shadow-lg">
        <Flame className="w-3.5 h-3.5 fill-[#FF2E93] animate-pulse" />
        <span>Tango Live Broadcasting & Virtual Gifts</span>
      </div>

      {/* Main Title */}
      <h1 className="text-4xl sm:text-6xl md:text-7xl font-black text-center tracking-tight text-white max-w-4xl leading-[1.08] mb-6">
        Broadcast Live. <br />
        <span className="bg-gradient-to-r from-[#FF007A] via-[#FF2E93] to-amber-300 bg-clip-text text-transparent">
          Earn Virtual Gifts.
        </span>
      </h1>

      <p className="text-base sm:text-lg text-zinc-400 text-center max-w-2xl mb-10 leading-relaxed font-medium">
        Experience interactive live streaming powered by high-speed Janus WebRTC. Connect with viewers, showcase your talents, and send real-time gifts with celebratory effects.
      </p>

      {/* Call to action buttons */}
      <div className="flex flex-col sm:flex-row items-center gap-4 w-full max-w-md justify-center mb-16">
        <Link
          href="/live"
          className="w-full sm:w-auto px-8 py-3.5 rounded-2xl font-black text-sm text-white tango-gradient-btn transition-all hover:scale-105 active:scale-95 flex items-center justify-center gap-2 shadow-xl shadow-[#FF007A]/30"
        >
          <Radio className="w-5 h-5" />
          <span>Explore Live Streams</span>
        </Link>
        <Link
          href="/register"
          className="w-full sm:w-auto px-8 py-3.5 rounded-2xl font-bold text-sm text-zinc-200 bg-white/5 hover:bg-white/10 border border-white/10 transition-all hover:scale-105 flex items-center justify-center gap-2"
        >
          <Sparkles className="w-4 h-4 text-amber-400" />
          <span>Get 1,000 Free Coins</span>
        </Link>
      </div>

      {/* Feature Highlight Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl w-full">
        <div className="p-6 rounded-3xl tango-panel border border-white/10">
          <div className="w-12 h-12 rounded-2xl bg-[#FF007A]/15 border border-[#FF007A]/30 flex items-center justify-center text-[#FF2E93] mb-4 shadow-lg shadow-[#FF007A]/20">
            <Video className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-black text-white mb-2">Janus WebRTC SFU</h3>
          <p className="text-xs text-zinc-400 leading-relaxed">
            Ultra-fast C-based Janus Gateway delivers broadcast video with sub-second latency and zero plugin installations.
          </p>
        </div>

        <div className="p-6 rounded-3xl tango-panel border border-white/10">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 mb-4 shadow-lg shadow-amber-500/20">
            <Coins className="w-6 h-6 fill-amber-400" />
          </div>
          <h3 className="text-lg font-black text-white mb-2">Atomic Coin Wallet</h3>
          <p className="text-xs text-zinc-400 leading-relaxed">
            Every user starts with 1,000 test coins in PostgreSQL. Coin deductions are guaranteed atomic with zero double-spending.
          </p>
        </div>

        <div className="p-6 rounded-3xl tango-panel border border-white/10">
          <div className="w-12 h-12 rounded-2xl bg-[#7928CA]/20 border border-[#7928CA]/40 flex items-center justify-center text-[#A855F7] mb-4 shadow-lg shadow-[#7928CA]/20">
            <Gift className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-black text-white mb-2">Tango Animated Gifts</h3>
          <p className="text-xs text-zinc-400 leading-relaxed">
            Send Hearts, Roses, Stars, and Diamonds. Connected audiences see live animations and celebratory confetti.
          </p>
        </div>
      </div>
    </div>
  );
}
