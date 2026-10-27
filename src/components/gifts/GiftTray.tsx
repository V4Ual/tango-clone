"use client";

import React, { useState, useEffect } from "react";
import { Coins, Send, Loader2, Sparkles, AlertCircle, Heart, Plus } from "lucide-react";
import { useAuth } from "@/components/auth/AuthContext";

export interface GiftItem {
  id: string;
  name: string;
  coinPrice: number;
  assetUrl: string;
}

interface GiftTrayProps {
  streamId: string;
  broadcasterId: string;
  onGiftSentSuccess: (gift: GiftItem, quantity: number, newBalance: number) => void;
  onSendHeart?: () => void;
}

export function GiftTray({
  streamId,
  broadcasterId,
  onGiftSentSuccess,
  onSendHeart,
}: GiftTrayProps) {
  const { user, updateCoins } = useAuth();
  const [gifts, setGifts] = useState<GiftItem[]>([]);
  const [selectedGiftId, setSelectedGiftId] = useState<string | null>(null);
  const [loadingGifts, setLoadingGifts] = useState(true);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  // Fetch gift catalog from /api/gifts
  useEffect(() => {
    async function loadGifts() {
      try {
        const res = await fetch("/api/gifts");
        if (res.ok) {
          const data = await res.json();
          setGifts(data.gifts || []);
          if (data.gifts?.length > 0) {
            setSelectedGiftId(data.gifts[0].id);
          }
        }
      } catch (err) {
        console.error("Failed to load gifts:", err);
      } finally {
        setLoadingGifts(false);
      }
    }
    loadGifts();
  }, []);

  const selectedGift = gifts.find((g) => g.id === selectedGiftId);

  const handleSendGift = async () => {
    if (!selectedGift || !user) return;

    if (user.id === broadcasterId) {
      setMessage({ text: "You cannot send gifts to yourself", type: "error" });
      return;
    }

    if (user.coinBalance < selectedGift.coinPrice) {
      setMessage({
        text: `Insufficient coins! Need ${selectedGift.coinPrice} coins.`,
        type: "error",
      });
      return;
    }

    setMessage(null);
    setSending(true);

    try {
      const res = await fetch("/api/gifts/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          streamId,
          giftId: selectedGift.id,
          quantity: 1,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setMessage({ text: data.error || "Failed to send gift", type: "error" });
        return;
      }

      // Update auth context coin balance
      updateCoins(data.remainingBalance);

      setMessage({ text: `Sent ${selectedGift.name}! 🎉`, type: "success" });
      onGiftSentSuccess(selectedGift, 1, data.remainingBalance);

      setTimeout(() => {
        setMessage(null);
      }, 3000);
    } catch {
      setMessage({ text: "Network error sending gift", type: "error" });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="w-full bg-[#08090d]/95 border-t border-white/10 p-3 sm:p-4 backdrop-blur-2xl">
      {/* Tray Header: Coin Balance & Status Message */}
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-1.5">
          <Sparkles className="w-4 h-4 text-[#FF2E93]" />
          <span className="text-[11px] font-black uppercase tracking-wider text-zinc-300">
            Tango Gift Tray
          </span>
        </div>

        {user && (
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-bold shadow-inner">
            <Coins className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
            <span>{user.coinBalance.toLocaleString()} Coins</span>
          </div>
        )}
      </div>

      {/* Status Alert */}
      {message && (
        <div
          className={`mb-2.5 p-2 rounded-xl text-xs flex items-center gap-2 ${
            message.type === "success"
              ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
              : "bg-[#FF007A]/20 text-[#FF2E93] border border-[#FF007A]/30"
          }`}
        >
          {message.type === "error" && <AlertCircle className="w-3.5 h-3.5 shrink-0" />}
          <span>{message.text}</span>
        </div>
      )}

      {/* Gift Catalog Cards */}
      {loadingGifts ? (
        <div className="flex gap-3 justify-center py-4">
          <Loader2 className="w-6 h-6 animate-spin text-[#FF007A]" />
        </div>
      ) : (
        <div className="grid grid-cols-4 gap-2 sm:gap-3 mb-3">
          {gifts.map((gift) => {
            const isSelected = gift.id === selectedGiftId;
            return (
              <button
                key={gift.id}
                type="button"
                onClick={() => setSelectedGiftId(gift.id)}
                className={`flex flex-col items-center justify-center p-2 rounded-2xl border transition-all cursor-pointer relative ${
                  isSelected
                    ? "bg-[#FF007A]/20 border-[#FF007A] shadow-[0_0_20px_rgba(255,0,122,0.4)] scale-105"
                    : "bg-white/[0.03] border-white/5 hover:border-white/20 hover:bg-white/[0.07]"
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={gift.assetUrl}
                  alt={gift.name}
                  className="w-10 h-10 sm:w-12 sm:h-12 object-contain mb-1 transition-transform hover:scale-110"
                />
                <span className="text-[11px] font-bold text-white line-clamp-1">{gift.name}</span>
                <div className="flex items-center gap-1 text-[10px] font-extrabold text-amber-400 mt-0.5">
                  <Coins className="w-3 h-3 fill-amber-400" />
                  <span>{gift.coinPrice}</span>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Action Row: Floating Heart + Send Gift Button */}
      <div className="flex items-center justify-between gap-3">
        {onSendHeart && (
          <button
            onClick={onSendHeart}
            className="p-2.5 rounded-2xl bg-rose-500/20 hover:bg-rose-500/30 text-[#FF2E93] border border-rose-500/30 transition-all hover:scale-110 active:scale-95 cursor-pointer flex items-center justify-center shadow-lg"
            title="Send Heart Reaction"
          >
            <Heart className="w-5 h-5 fill-[#FF2E93]" />
          </button>
        )}

        <button
          onClick={handleSendGift}
          disabled={sending || !selectedGift || !user || user.id === broadcasterId}
          className="flex-1 py-2.5 px-6 rounded-2xl font-black text-xs text-white tango-gradient-btn transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-40 cursor-pointer flex items-center justify-center gap-2"
        >
          {sending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <>
              <Send className="w-3.5 h-3.5" />
              <span>
                Send {selectedGift?.name || "Gift"} ({selectedGift?.coinPrice || 0} Coins)
              </span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
