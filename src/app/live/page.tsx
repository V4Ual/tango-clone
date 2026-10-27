"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  Radio,
  Users,
  Video,
  RefreshCw,
  Flame,
  Sparkles,
  Coins,
  Crown,
  Eye,
  Activity,
} from "lucide-react";

interface StreamItem {
  id: string;
  roomName: string;
  title: string;
  status: string;
  startedAt: string;
  broadcaster: {
    id: string;
    username: string;
    avatarUrl: string | null;
  };
  _count?: {
    giftTransactions: number;
  };
}

const CATEGORIES = [
  { id: "all", label: "🔥 All Live" },
  { id: "popular", label: "💎 Top Earners" },
  { id: "chat", label: "💬 Chit-Chat" },
  { id: "music", label: "🎵 Music & Chill" },
  { id: "talent", label: "⭐ Talent Showcase" },
];

export default function LiveBrowsePage() {
  const [streams, setStreams] = useState<StreamItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeCategory, setActiveCategory] = useState("all");

  const fetchStreams = useCallback(async () => {
    try {
      const res = await fetch("/api/streams", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setStreams(data.streams || []);
      }
    } catch (err) {
      console.error("Failed to fetch streams:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchStreams();
    const interval = setInterval(fetchStreams, 7000);
    return () => clearInterval(interval);
  }, [fetchStreams]);

  return (
    <div className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8">
      {/* Tango Hero Banner */}
      <div className="relative rounded-3xl overflow-hidden p-6 sm:p-8 mb-8 border border-white/10 bg-gradient-to-r from-[#180a1c] via-[#100d1c] to-[#0d0f1a] shadow-2xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-[#FF007A]/15 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="max-w-xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-[#FF007A]/15 text-[#FF2E93] border border-[#FF007A]/30 mb-3">
              <Flame className="w-3.5 h-3.5 fill-[#FF2E93]" />
              <span>Tango Live Broadcasting</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight leading-tight">
              Watch Creators, Cheer Live & Send Virtual Gifts
            </h1>
            <p className="text-zinc-400 text-sm mt-2">
              Join interactive live broadcasts powered by ultra-low-latency Janus WebRTC. Connect with your favorite creators and send animated gifts in real time!
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => {
                setRefreshing(true);
                fetchStreams();
              }}
              disabled={refreshing}
              className="flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold text-zinc-300 hover:text-white bg-white/5 border border-white/10 hover:bg-white/10 transition-all cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin text-[#FF2E93]" : ""}`} />
              <span>Refresh</span>
            </button>

            <Link
              href="/go-live"
              className="flex items-center gap-2 px-5 py-2.5 rounded-2xl text-xs font-black text-white tango-gradient-btn transition-all hover:scale-105 active:scale-95"
            >
              <Video className="w-4 h-4" />
              <span>Start Your Broadcast</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Category Filter Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-4 mb-6 no-scrollbar">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setActiveCategory(cat.id)}
            className={`px-4 py-2 rounded-2xl text-xs font-black whitespace-nowrap transition-all cursor-pointer ${
              activeCategory === cat.id
                ? "bg-gradient-to-r from-[#FF007A] to-[#FF2E93] text-white shadow-lg shadow-[#FF007A]/30 scale-105"
                : "bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-zinc-200 border border-white/5"
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Streams Feed Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-[#FF2E93]" />
          <h2 className="text-lg font-black text-white">Active Live Streams</h2>
          <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-white/10 text-zinc-300">
            {streams.length} Live
          </span>
        </div>
      </div>

      {/* Stream Cards Grid */}
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 sm:gap-6">
          {[1, 2, 3, 4, 5].map((n) => (
            <div
              key={n}
              className="aspect-[3/4] rounded-3xl bg-zinc-900/40 border border-white/5 animate-pulse"
            />
          ))}
        </div>
      ) : streams.length === 0 ? (
        /* Empty State */
        <div className="flex flex-col items-center justify-center p-12 text-center rounded-3xl tango-panel border border-white/10 max-w-lg mx-auto my-12">
          <div className="w-16 h-16 rounded-3xl bg-[#FF007A]/15 border border-[#FF007A]/30 flex items-center justify-center mb-4 text-[#FF2E93] shadow-lg shadow-[#FF007A]/20">
            <Radio className="w-8 h-8 animate-pulse" />
          </div>
          <h3 className="text-xl font-black text-white mb-2">No Active Broadcasts</h3>
          <p className="text-zinc-400 text-xs mb-6 max-w-xs">
            The stage is waiting for you! Go live now to stream with Janus WebRTC and earn gifts from your viewers.
          </p>
          <Link
            href="/go-live"
            className="flex items-center gap-2 px-6 py-3 rounded-2xl text-xs font-black text-white tango-gradient-btn transition-all hover:scale-105"
          >
            <Video className="w-4 h-4" />
            <span>Go Live Now</span>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 sm:gap-5">
          {streams.map((stream) => (
            <Link
              key={stream.id}
              href={`/live/${stream.id}`}
              className="group flex flex-col rounded-3xl overflow-hidden tango-glass-card border border-white/10 hover:border-[#FF007A]/60 transition-all duration-300 hover:scale-[1.03] shadow-xl hover:shadow-[#FF007A]/20 relative"
            >
              {/* 3:4 Vertical Card */}
              <div className="relative aspect-[3/4] w-full bg-gradient-to-b from-[#181926] to-[#0c0d14] flex items-center justify-center overflow-hidden">
                {/* Background lighting */}
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-transparent z-10" />

                {/* Avatar with glowing Tango ring */}
                <div className="relative z-10 p-[3px] rounded-full tango-live-ring shadow-xl group-hover:scale-110 transition-transform duration-500">
                  {stream.broadcaster.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={stream.broadcaster.avatarUrl}
                      alt={stream.broadcaster.username}
                      className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-zinc-900 object-cover border-2 border-black"
                    />
                  ) : (
                    <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-[#12131e] flex items-center justify-center text-2xl font-black text-white border-2 border-black">
                      {stream.broadcaster.username.charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>

                {/* Top Left: Glowing LIVE badge */}
                <div className="absolute top-2.5 left-2.5 z-20 flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black bg-gradient-to-r from-[#FF007A] to-[#FF2E93] text-white shadow-lg">
                  <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                  <span>LIVE</span>
                </div>

                {/* Top Right: Gifts Received Tag */}
                {stream._count && stream._count.giftTransactions > 0 && (
                  <div className="absolute top-2.5 right-2.5 z-20 flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 backdrop-blur-md">
                    <Sparkles className="w-3 h-3 text-amber-400" />
                    <span>{stream._count.giftTransactions}</span>
                  </div>
                )}

                {/* Bottom Overlay: Title & Creator Handle */}
                <div className="absolute bottom-3 left-3 right-3 z-20">
                  <h3 className="font-extrabold text-white text-sm line-clamp-1 group-hover:text-[#FF2E93] transition-colors drop-shadow-md">
                    {stream.title}
                  </h3>
                  <div className="flex items-center justify-between gap-1 mt-1">
                    <span className="text-[11px] text-zinc-300 font-semibold truncate">
                      @{stream.broadcaster.username}
                    </span>
                    <span className="flex items-center gap-1 text-[10px] text-zinc-400 shrink-0">
                      <Eye className="w-3 h-3 text-zinc-400" />
                      <span>Live</span>
                    </span>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
