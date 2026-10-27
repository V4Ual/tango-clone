"use client";

import React, { useState, useEffect } from "react";
import { X, Trophy, Users, Coins, Sparkles, Crown, Medal } from "lucide-react";

export interface TopContributor {
  userId: string;
  username: string;
  avatarUrl: string | null;
  totalCoins: number;
  rank: number;
}

interface AudienceModalProps {
  isOpen: boolean;
  onClose: () => void;
  streamId: string;
  roomName: string;
  viewerCount: number;
}

export function AudienceModal({
  isOpen,
  onClose,
  streamId,
  roomName,
  viewerCount,
}: AudienceModalProps) {
  const [activeTab, setActiveTab] = useState<"contributors" | "viewers">("contributors");
  const [contributors, setContributors] = useState<TopContributor[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    const fetchAudienceData = async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/streams/${streamId}/viewers`);
        if (res.ok) {
          const data = await res.json();
          if (data.topContributors) {
            setContributors(data.topContributors);
          }
        }
      } catch (err) {
        console.error("Failed to fetch audience data:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchAudienceData();
  }, [isOpen, streamId]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-gift-pop">
      <div 
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-md bg-[#0d0e15] border border-white/15 rounded-3xl p-5 shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-[#FF007A] to-[#FF2E93] flex items-center justify-center text-white shadow-lg shadow-[#FF007A]/25">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-white">Live Audience</h3>
              <div className="flex items-center gap-1.5 text-xs text-zinc-400">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>{viewerCount} watching right now</span>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full bg-white/5 hover:bg-white/15 text-zinc-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 p-1 my-4 rounded-2xl bg-white/5 border border-white/10">
          <button
            onClick={() => setActiveTab("contributors")}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
              activeTab === "contributors"
                ? "bg-gradient-to-r from-[#FF007A] to-[#FF2E93] text-white shadow-md shadow-[#FF007A]/30"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            <Trophy className="w-3.5 h-3.5" />
            <span>Top Contributors</span>
          </button>

          <button
            onClick={() => setActiveTab("viewers")}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
              activeTab === "viewers"
                ? "bg-gradient-to-r from-[#FF007A] to-[#FF2E93] text-white shadow-md shadow-[#FF007A]/30"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Audience ({viewerCount})</span>
          </button>
        </div>

        {/* Tab Contents */}
        <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 min-h-[220px]">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="w-8 h-8 border-3 border-[#FF007A] border-t-transparent rounded-full animate-spin mb-2" />
              <p className="text-xs text-zinc-400">Loading ranking...</p>
            </div>
          ) : activeTab === "contributors" ? (
            contributors.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center px-4">
                <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 mb-3">
                  <Sparkles className="w-6 h-6 animate-pulse" />
                </div>
                <p className="text-sm font-bold text-white mb-1">No Gifts Sent Yet</p>
                <p className="text-xs text-zinc-400 max-w-xs">
                  Send a Heart, Rose, or Diamond gift to claim the #1 spot on the leaderboard!
                </p>
              </div>
            ) : (
              contributors.map((user) => (
                <div
                  key={user.userId}
                  className="flex items-center justify-between p-3 rounded-2xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/5 transition-all"
                >
                  <div className="flex items-center gap-3">
                    {/* Rank Medal */}
                    <div className="w-6 flex items-center justify-center">
                      {user.rank === 1 ? (
                        <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-amber-400 to-yellow-200 text-black font-black text-xs flex items-center justify-center shadow-md">
                          1
                        </div>
                      ) : user.rank === 2 ? (
                        <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-zinc-300 to-zinc-100 text-black font-black text-xs flex items-center justify-center shadow-md">
                          2
                        </div>
                      ) : user.rank === 3 ? (
                        <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-amber-700 to-amber-500 text-white font-black text-xs flex items-center justify-center shadow-md">
                          3
                        </div>
                      ) : (
                        <span className="text-xs font-bold text-zinc-500">#{user.rank}</span>
                      )}
                    </div>

                    {/* Avatar with rank glow */}
                    <div className="relative">
                      {user.avatarUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={user.avatarUrl}
                          alt={user.username}
                          className="w-10 h-10 rounded-full object-cover border border-white/10"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-[#FF007A] to-[#7928CA] flex items-center justify-center text-sm font-black text-white">
                          {user.username.charAt(0).toUpperCase()}
                        </div>
                      )}
                      {user.rank === 1 && (
                        <div className="absolute -top-1.5 -right-1 text-amber-400">
                          <Crown className="w-4 h-4" />
                        </div>
                      )}
                    </div>

                    <div>
                      <p className="text-xs font-black text-white flex items-center gap-1.5">
                        <span>@{user.username}</span>
                        {user.rank === 1 && (
                          <span className="px-1.5 py-0.5 rounded-full text-[9px] font-black bg-amber-400 text-black uppercase">
                            VIP #1
                          </span>
                        )}
                      </p>
                      <p className="text-[10px] text-zinc-400">Contributor</p>
                    </div>
                  </div>

                  {/* Coin Count */}
                  <div className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-amber-400/10 border border-amber-400/20 text-amber-300 text-xs font-black">
                    <Coins className="w-3.5 h-3.5" />
                    <span>{user.totalCoins.toLocaleString()}</span>
                  </div>
                </div>
              ))
            )
          ) : (
            <div className="space-y-2">
              <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-[#FF007A] to-[#FF2E93] flex items-center justify-center text-xs font-black text-white">
                    U
                  </div>
                  <div>
                    <p className="text-xs font-black text-white">Live Viewers</p>
                    <p className="text-[10px] text-zinc-400">{viewerCount} connected</p>
                  </div>
                </div>
                <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                  Active
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Top Viewers Avatar Bubbles Row for the Header
export function TopContributorsBubbleRow({
  streamId,
  onClick,
}: {
  streamId: string;
  onClick: () => void;
}) {
  const [topThree, setTopThree] = useState<TopContributor[]>([]);

  useEffect(() => {
    const fetchTop = async () => {
      try {
        const res = await fetch(`/api/streams/${streamId}/viewers`);
        if (res.ok) {
          const data = await res.json();
          if (data.topContributors) {
            setTopThree(data.topContributors.slice(0, 3));
          }
        }
      } catch {}
    };

    fetchTop();
    const interval = setInterval(fetchTop, 10000);
    return () => clearInterval(interval);
  }, [streamId]);

  if (topThree.length === 0) return null;

  return (
    <button
      onClick={onClick}
      className="flex items-center -space-x-2 hover:scale-105 transition-transform cursor-pointer px-1 py-0.5 rounded-full bg-black/40 border border-white/10"
      title="View Top Contributors"
    >
      {topThree.map((user) => (
        <div
          key={user.userId}
          className={`relative w-6 h-6 rounded-full overflow-hidden border-2 shadow-sm ${
            user.rank === 1
              ? "border-amber-400 z-30"
              : user.rank === 2
              ? "border-zinc-300 z-20"
              : "border-amber-700 z-10"
          }`}
        >
          {user.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={user.avatarUrl} alt={user.username} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-[#FF007A] flex items-center justify-center text-[9px] font-black text-white">
              {user.username.charAt(0).toUpperCase()}
            </div>
          )}
        </div>
      ))}
    </button>
  );
}
