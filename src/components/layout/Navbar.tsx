"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/components/auth/AuthContext";
import {
  Flame,
  Video,
  Coins,
  User as UserIcon,
  LogOut,
  Sparkles,
  Plus,
  Radio,
  Layers,
  Crown,
} from "lucide-react";

export function Navbar() {
  const pathname = usePathname();
  const { user, loading, logout, updateCoins } = useAuth();
  const [recharging, setRecharging] = useState(false);
  const [showRechargeModal, setShowRechargeModal] = useState(false);

  // Quick 1-click test coin recharge for MVP testing
  const handleRechargeCoins = async (amount: number) => {
    if (!user) return;
    setRecharging(true);
    try {
      const res = await fetch("/api/wallet/recharge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount }),
      });
      if (res.ok) {
        const data = await res.json();
        updateCoins(data.coinBalance);
        setShowRechargeModal(false);
      }
    } catch (e) {
      console.warn("Recharge notice:", e);
    } finally {
      setRecharging(false);
    }
  };

  const isLiveActive = pathname?.startsWith("/live");
  const isStudioActive = pathname?.startsWith("/go-live");
  const isProfileActive = pathname?.startsWith("/profile");

  // In live broadcast watch room, hide global navbar so the stream is full-screen like Tango
  if (pathname?.startsWith("/live/") && pathname !== "/live") {
    return null;
  }

  return (
    <>
      <header className="sticky top-0 z-50 w-full border-b border-white/10 bg-[#08090d]/85 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          {/* Brand Logo - Tango Live Signature Flame */}
          <Link href="/live" className="flex items-center gap-2.5 group">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#FF007A] via-[#FF2E93] to-[#7928CA] p-[2px] shadow-lg shadow-[#FF007A]/25 group-hover:scale-105 transition-transform">
              <div className="w-full h-full bg-[#0d0e15] rounded-[14px] flex items-center justify-center">
                <Flame className="w-5 h-5 text-[#FF2E93] fill-[#FF2E93] animate-pulse" />
              </div>
            </div>
            <div className="flex flex-col">
              <span className="font-black text-xl tracking-tight bg-gradient-to-r from-white via-rose-100 to-[#FF2E93] bg-clip-text text-transparent">
                TANGO<span className="text-[#FF007A]">LIVE</span>
              </span>
              <span className="text-[9px] font-bold tracking-widest uppercase text-zinc-500 -mt-1">
                Janus WebRTC SFU
              </span>
            </div>
          </Link>

          {/* Center Navigation Links: Distinct Streams vs Studio vs Profile */}
          <nav className="hidden md:flex items-center gap-1.5 p-1 rounded-2xl bg-white/[0.03] border border-white/10">
            <Link
              href="/live"
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${isLiveActive && !isStudioActive
                  ? "bg-gradient-to-r from-[#FF007A] to-[#FF2E93] text-white shadow-md shadow-[#FF007A]/30"
                  : "text-zinc-400 hover:text-white hover:bg-white/5"
                }`}
            >
              <Radio className="w-3.5 h-3.5" />
              <span>Explore Live</span>
            </Link>

            <Link
              href="/go-live"
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${isStudioActive
                  ? "bg-gradient-to-r from-[#FF007A] to-[#FF2E93] text-white shadow-md shadow-[#FF007A]/30"
                  : "text-zinc-400 hover:text-white hover:bg-white/5"
                }`}
            >
              <Video className="w-3.5 h-3.5" />
              <span>Manage Stream</span>
            </Link>

            {user && (
              <Link
                href={`/profile/${user.username}`}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${isProfileActive
                    ? "bg-gradient-to-r from-[#FF007A] to-[#FF2E93] text-white shadow-md shadow-[#FF007A]/30"
                    : "text-zinc-400 hover:text-white hover:bg-white/5"
                  }`}
              >
                <UserIcon className="w-3.5 h-3.5" />
                <span>My Profile</span>
              </Link>
            )}
          </nav>

          {/* Right Action Bar: Coins, Go Live & Profile */}
          <div className="flex items-center gap-3">
            {!loading && user ? (
              <>
                {/* Coin Balance Badge with 1-click test refill */}
                <button
                  onClick={() => setShowRechargeModal(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 font-extrabold text-xs transition-all cursor-pointer shadow-inner"
                  title="Click to refill test coins"
                >
                  <Coins className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                  <span>{user.coinBalance.toLocaleString()}</span>
                  <Plus className="w-3 h-3 text-amber-400 ml-0.5" />
                </button>

                {/* Go Live Studio CTA */}
                <Link
                  href="/go-live"
                  className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-white tango-gradient-btn transition-all hover:scale-105 active:scale-95"
                >
                  <Video className="w-4 h-4" />
                  <span>Go Live</span>
                </Link>

                {/* User Avatar & Menu */}
                <Link
                  href={`/profile/${user.username}`}
                  className="flex items-center gap-2 p-1 pl-2 pr-3 rounded-full hover:bg-white/10 transition-colors border border-white/10"
                  title="My Profile"
                >
                  {user.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={user.avatarUrl}
                      alt={user.username}
                      className="w-7 h-7 rounded-full bg-zinc-800 object-cover border border-[#FF007A]/50"
                    />
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-[#FF007A] to-[#7928CA] flex items-center justify-center text-xs font-bold text-white">
                      {user.username.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <span className="text-xs font-bold text-zinc-200 hidden md:inline">
                    @{user.username}
                  </span>
                </Link>

                {/* Logout */}
                <button
                  onClick={() => logout()}
                  className="p-2 text-zinc-400 hover:text-rose-400 rounded-xl hover:bg-white/5 transition-colors cursor-pointer"
                  title="Log out"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </>
            ) : !loading ? (
              <div className="flex items-center gap-2">
                <Link
                  href="/login"
                  className="text-xs font-bold text-zinc-300 hover:text-white px-3.5 py-2 rounded-xl hover:bg-white/10 transition-colors"
                >
                  Sign In
                </Link>
                <Link
                  href="/register"
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white tango-gradient-btn transition-all hover:scale-105"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Get 1,000 Coins</span>
                </Link>
              </div>
            ) : null}
          </div>
        </div>
      </header>

      {/* Quick Test Coin Recharge Modal */}
      {showRechargeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4">
          <div className="max-w-sm w-full tango-panel p-6 rounded-3xl border border-white/15 shadow-2xl relative animate-gift-pop">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center mx-auto mb-3 text-amber-400">
              <Coins className="w-6 h-6 fill-amber-400" />
            </div>
            <h3 className="text-lg font-black text-center text-white mb-1">Tango Coin Wallet</h3>
            <p className="text-xs text-zinc-400 text-center mb-5">
              Refill your test coins to send Heart, Rose, Star, and Diamond virtual gifts!
            </p>

            <div className="grid grid-cols-3 gap-2.5 mb-5">
              {[500, 1000, 2500].map((amt) => (
                <button
                  key={amt}
                  onClick={() => handleRechargeCoins(amt)}
                  disabled={recharging}
                  className="flex flex-col items-center justify-center p-3 rounded-2xl bg-white/5 hover:bg-amber-500/20 border border-white/10 hover:border-amber-500/40 text-white transition-all cursor-pointer group"
                >
                  <Coins className="w-5 h-5 text-amber-400 fill-amber-400 mb-1 group-hover:scale-110 transition-transform" />
                  <span className="text-xs font-black">+{amt}</span>
                  <span className="text-[10px] text-zinc-500">Free Test</span>
                </button>
              ))}
            </div>

            <button
              onClick={() => setShowRechargeModal(false)}
              className="w-full py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white font-bold text-xs transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
}
