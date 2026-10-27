"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/components/auth/AuthContext";
import {
  Coins,
  Radio,
  Sparkles,
  Gift,
  Calendar,
  LogOut,
  Video,
  Loader2,
  AlertCircle,
  Crown,
  Flame,
  Award,
  Wallet,
  ArrowUpRight,
  Plus,
  Share2,
} from "lucide-react";

interface ProfileData {
  id: string;
  username: string;
  avatarUrl: string | null;
  createdAt: string;
  coinBalance: number;
  totalBroadcasts: number;
  totalGiftsSent: number;
  totalGiftsReceived: number;
  totalCoinsEarned: number;
  totalCoinsSpent: number;
  isSelf: boolean;
}

const PROFILE_TABS = [
  { id: "wallet", label: "💰 Coin Wallet", icon: Wallet },
  { id: "trophies", label: "🎁 Gifts Showcase", icon: Gift },
  { id: "stats", label: "📊 Broadcast Activity", icon: Radio },
];

function ProfileContent() {
  const params = useParams();
  const router = useRouter();
  const username = params?.username as string;
  const { user, logout, updateCoins } = useAuth();

  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("wallet");
  const [recharging, setRecharging] = useState(false);

  useEffect(() => {
    if (!username) return;

    async function loadProfile() {
      try {
        setLoading(true);
        const res = await fetch(`/api/profile/${username}`);
        const data = await res.json();

        if (!res.ok) {
          setError(data.error || "Profile not found");
          return;
        }

        setProfile(data.user);
      } catch {
        setError("Failed to load user profile");
      } finally {
        setLoading(false);
      }
    }

    loadProfile();
  }, [username]);

  const handleQuickRefill = async (amount: number) => {
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
        if (profile) {
          setProfile({ ...profile, coinBalance: data.coinBalance });
        }
      }
    } catch (e) {
      console.warn("Refill error:", e);
    } finally {
      setRecharging(false);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <Loader2 className="w-10 h-10 animate-spin text-[#FF007A]" />
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="max-w-md w-full p-8 rounded-3xl tango-panel text-center border border-white/10">
          <AlertCircle className="w-12 h-12 text-[#FF2E93] mx-auto mb-3" />
          <h2 className="text-xl font-bold text-white mb-2">Profile Not Found</h2>
          <p className="text-zinc-400 text-sm mb-6">{error || "User does not exist"}</p>
          <Link
            href="/live"
            className="inline-flex px-5 py-2.5 rounded-xl text-sm font-semibold tango-gradient-btn text-white"
          >
            Explore Live Streams
          </Link>
        </div>
      </div>
    );
  }

  const joinDate = new Date(profile.createdAt).toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });

  return (
    <div className="flex-1 max-w-5xl w-full mx-auto p-4 sm:p-8">
      {/* Tango Profile Banner & Header Card */}
      <div className="relative rounded-3xl tango-panel border border-white/10 shadow-2xl overflow-hidden mb-8">
        {/* Banner Graphic Backdrop */}
        <div className="h-32 sm:h-44 w-full bg-gradient-to-r from-[#FF007A] via-[#7928CA] to-[#00F0FF] opacity-90 relative">
          <div className="absolute inset-0 bg-gradient-to-t from-[#08090d] via-transparent to-transparent" />
        </div>

        {/* User Profile Info Row */}
        <div className="px-6 sm:px-8 pb-6 sm:pb-8 relative z-10 -mt-16 sm:-mt-20">
          <div className="flex flex-col sm:flex-row items-center sm:items-end justify-between gap-6">
            <div className="flex flex-col sm:flex-row items-center sm:items-end gap-5 text-center sm:text-left">
              {/* Avatar with Tango Live VIP Ring */}
              <div className="relative p-1 rounded-full tango-live-ring shadow-2xl">
                {profile.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={profile.avatarUrl}
                    alt={profile.username}
                    className="w-24 h-24 sm:w-32 sm:h-32 rounded-full border-4 border-black object-cover bg-zinc-900"
                  />
                ) : (
                  <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-full bg-gradient-to-tr from-[#FF007A] to-[#7928CA] flex items-center justify-center text-4xl sm:text-5xl font-black text-white border-4 border-black shadow-2xl">
                    {profile.username.charAt(0).toUpperCase()}
                  </div>
                )}
                <span className="absolute bottom-1 right-1 p-1.5 rounded-full bg-amber-400 text-black shadow-lg" title="VIP Level 1">
                  <Crown className="w-4 h-4 fill-black" />
                </span>
              </div>

              {/* Username & Joined Tag */}
              <div className="mb-2">
                <div className="flex items-center justify-center sm:justify-start gap-2">
                  <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                    @{profile.username}
                  </h1>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-500/20 text-[#FF2E93] border border-rose-500/30">
                    Creator
                  </span>
                </div>
                <div className="flex items-center justify-center sm:justify-start gap-2 mt-1 text-xs text-zinc-400">
                  <Calendar className="w-3.5 h-3.5" />
                  <span>Member since {joinDate}</span>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            {profile.isSelf && (
              <div className="flex items-center gap-3">
                <Link
                  href="/go-live"
                  className="flex items-center gap-2 px-5 py-2.5 rounded-2xl text-xs font-black text-white tango-gradient-btn transition-all hover:scale-105 active:scale-95"
                >
                  <Video className="w-4 h-4" />
                  <span>Go Live</span>
                </Link>
                <button
                  onClick={() => logout()}
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-2xl text-xs font-bold bg-white/5 hover:bg-rose-500/20 hover:text-rose-400 text-zinc-300 border border-white/10 transition-colors cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Logout</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Profile Navigation Tabs */}
      <div className="flex items-center gap-3 border-b border-white/10 pb-4 mb-8 overflow-x-auto no-scrollbar">
        {PROFILE_TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl text-xs font-black transition-all cursor-pointer whitespace-nowrap ${
                isActive
                  ? "bg-gradient-to-r from-[#FF007A] to-[#FF2E93] text-white shadow-lg shadow-[#FF007A]/30 scale-105"
                  : "bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-zinc-200 border border-white/5"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab 1: Coin Wallet & Recharge (Tango Style) */}
      {activeTab === "wallet" && (
        <div className="space-y-6 animate-gift-pop">
          {/* Main Balance Card */}
          <div className="p-6 sm:p-8 rounded-3xl bg-gradient-to-br from-amber-500/15 via-zinc-900/80 to-[#12131d] border border-amber-500/30 shadow-2xl relative overflow-hidden">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shadow-xl">
                  <Coins className="w-8 h-8 fill-amber-400" />
                </div>
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-amber-300/80">
                    Tango Coin Balance
                  </span>
                  <p className="text-3xl sm:text-4xl font-black text-amber-400">
                    {profile.coinBalance.toLocaleString()}{" "}
                    <span className="text-sm font-semibold text-amber-200/80">Coins</span>
                  </p>
                </div>
              </div>

              {profile.isSelf && (
                <div className="flex items-center gap-2">
                  {[500, 1000, 2500].map((amt) => (
                    <button
                      key={amt}
                      onClick={() => handleQuickRefill(amt)}
                      disabled={recharging}
                      className="px-3.5 py-2 rounded-xl text-xs font-black bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 transition-all cursor-pointer hover:scale-105"
                    >
                      +{amt} Coins
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Wallet Financial Overview */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-5 rounded-3xl tango-panel border border-white/10">
              <span className="text-xs text-zinc-400 font-semibold">Coins Earned from Gifts</span>
              <p className="text-2xl font-black text-emerald-400 mt-1">
                +{profile.totalCoinsEarned.toLocaleString()}
              </p>
              <span className="text-[10px] text-zinc-500">Live audience tips</span>
            </div>

            <div className="p-5 rounded-3xl tango-panel border border-white/10">
              <span className="text-xs text-zinc-400 font-semibold">Coins Spent on Gifts</span>
              <p className="text-2xl font-black text-rose-400 mt-1">
                -{profile.totalCoinsSpent.toLocaleString()}
              </p>
              <span className="text-[10px] text-zinc-500">Creator support</span>
            </div>

            <div className="p-5 rounded-3xl tango-panel border border-white/10">
              <span className="text-xs text-zinc-400 font-semibold">Estimated Cashout Value</span>
              <p className="text-2xl font-black text-amber-400 mt-1">
                ${((profile.totalCoinsEarned * 0.01)).toFixed(2)} USD
              </p>
              <span className="text-[10px] text-zinc-500">Phase 2 creator monetization</span>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Gifts Showcase */}
      {activeTab === "trophies" && (
        <div className="space-y-6 animate-gift-pop">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-5 rounded-3xl tango-panel border border-white/10 text-center flex flex-col items-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/gifts/heart.svg" alt="Heart" className="w-14 h-14 mb-2 animate-bounce" />
              <h3 className="font-extrabold text-white text-sm">Heart</h3>
              <p className="text-xs text-rose-400 font-bold mt-1">10 Coins</p>
              <span className="mt-2 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-white/5 text-zinc-400">
                Level 1 Gift
              </span>
            </div>

            <div className="p-5 rounded-3xl tango-panel border border-white/10 text-center flex flex-col items-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/gifts/rose.svg" alt="Rose" className="w-14 h-14 mb-2 animate-bounce" />
              <h3 className="font-extrabold text-white text-sm">Rose</h3>
              <p className="text-xs text-rose-400 font-bold mt-1">50 Coins</p>
              <span className="mt-2 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-white/5 text-zinc-400">
                Level 2 Gift
              </span>
            </div>

            <div className="p-5 rounded-3xl tango-panel border border-white/10 text-center flex flex-col items-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/gifts/star.svg" alt="Star" className="w-14 h-14 mb-2 animate-bounce" />
              <h3 className="font-extrabold text-white text-sm">Star</h3>
              <p className="text-xs text-amber-400 font-bold mt-1">100 Coins</p>
              <span className="mt-2 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400">
                Level 3 Gift
              </span>
            </div>

            <div className="p-5 rounded-3xl tango-panel border border-white/10 text-center flex flex-col items-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/gifts/diamond.svg" alt="Diamond" className="w-14 h-14 mb-2 animate-bounce" />
              <h3 className="font-extrabold text-white text-sm">Diamond</h3>
              <p className="text-xs text-cyan-400 font-bold mt-1">500 Coins</p>
              <span className="mt-2 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-cyan-500/10 text-cyan-400">
                VIP Diamond
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Broadcast Activity */}
      {activeTab === "stats" && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 animate-gift-pop">
          <div className="p-6 rounded-3xl tango-panel border border-white/10 text-center">
            <Radio className="w-6 h-6 text-[#FF2E93] mx-auto mb-2" />
            <p className="text-3xl font-black text-white">{profile.totalBroadcasts}</p>
            <span className="text-xs text-zinc-400 font-bold">Total Broadcasts</span>
          </div>

          <div className="p-6 rounded-3xl tango-panel border border-white/10 text-center">
            <Gift className="w-6 h-6 text-[#FF007A] mx-auto mb-2" />
            <p className="text-3xl font-black text-white">{profile.totalGiftsReceived}</p>
            <span className="text-xs text-zinc-400 font-bold">Gifts Received</span>
          </div>

          <div className="p-6 rounded-3xl tango-panel border border-white/10 text-center">
            <Sparkles className="w-6 h-6 text-purple-400 mx-auto mb-2" />
            <p className="text-3xl font-black text-white">{profile.totalGiftsSent}</p>
            <span className="text-xs text-zinc-400 font-bold">Gifts Given</span>
          </div>

          <div className="p-6 rounded-3xl tango-panel border border-white/10 text-center">
            <Coins className="w-6 h-6 text-amber-400 mx-auto mb-2 fill-amber-400" />
            <p className="text-3xl font-black text-amber-400">
              {profile.totalCoinsEarned.toLocaleString()}
            </p>
            <span className="text-xs text-zinc-400 font-bold">Total Coins Won</span>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ProfilePage() {
  return (
    <React.Suspense
      fallback={
        <div className="flex-1 flex items-center justify-center p-8">
          <Loader2 className="w-10 h-10 animate-spin text-[#FF007A]" />
        </div>
      }
    >
      <ProfileContent />
    </React.Suspense>
  );
}
