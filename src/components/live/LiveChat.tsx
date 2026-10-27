"use client";

import React, { useState, useEffect, useRef } from "react";
import { Send, Pin, Sparkles, Crown, ArrowDown, Heart, Flame } from "lucide-react";
import { LiveChatMessage } from "@/app/api/streams/chat/route";

interface FloatingEmoji {
  id: string;
  emoji: string;
  left: number;
}

interface LiveChatProps {
  roomName: string;
  streamId: string;
  isBroadcaster?: boolean;
  bottomClass?: string;
  currentUser?: {
    id: string;
    username: string;
    avatarUrl?: string | null;
  } | null;
}

const QUICK_EMOJIS = ["❤️", "🔥", "🎉", "👏", "💎", "😍"];

export function LiveChat({
  roomName,
  streamId,
  isBroadcaster = false,
  bottomClass = "bottom-4",
  currentUser,
}: LiveChatProps) {
  const [messages, setMessages] = useState<LiveChatMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const [pinnedText, setPinnedText] = useState<string | null>(null);
  const [showPinModal, setShowPinModal] = useState(false);
  const [pinInput, setPinInput] = useState("");
  const [floatingEmojis, setFloatingEmojis] = useState<FloatingEmoji[]>([]);
  const [isScrolledUp, setIsScrolledUp] = useState(false);
  const [sending, setSending] = useState(false);

  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom if not actively scrolled up
  const scrollToBottom = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
    }
    setIsScrolledUp(false);
  };

  const handleScroll = () => {
    if (!scrollContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 40;
    setIsScrolledUp(!isAtBottom);
  };

  // Trigger floating reaction burst
  const triggerEmojiBurst = (emoji: string) => {
    const burstCount = 4;
    const newItems: FloatingEmoji[] = [];
    for (let i = 0; i < burstCount; i++) {
      newItems.push({
        id: `${Date.now()}-${Math.random()}`,
        emoji,
        left: 75 + Math.random() * 18,
      });
    }

    setFloatingEmojis((prev) => [...prev.slice(-20), ...newItems]);

    setTimeout(() => {
      setFloatingEmojis((prev) => prev.filter((item) => !newItems.some((n) => n.id === item.id)));
    }, 2200);
  };

  // Send quick reaction
  const sendReaction = async (emoji: string) => {
    triggerEmojiBurst(emoji);
    try {
      await fetch("/api/streams/reaction", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomName, emoji }),
      });
    } catch { }
  };

  // Send message
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const text = inputText.trim();
    if (!text || sending) return;

    setSending(true);
    setInputText("");

    try {
      const res = await fetch("/api/streams/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomName,
          streamId,
          text,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        console.warn("Chat error:", err.error);
      }
    } catch (err) {
      console.error("Failed to send message:", err);
    } finally {
      setSending(false);
    }
  };

  // Pin message action for broadcaster
  const handleSavePin = async () => {
    try {
      const res = await fetch("/api/streams/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomName,
          streamId,
          action: "PIN",
          pinnedText: pinInput,
        }),
      });
      if (res.ok) {
        setPinnedText(pinInput || null);
        setShowPinModal(false);
      }
    } catch (err) {
      console.error("Failed to pin message:", err);
    }
  };

  // Fetch initial chat messages and pinned banner
  useEffect(() => {
    fetch(`/api/streams/chat?roomName=${encodeURIComponent(roomName)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) {
          if (data.messages) setMessages(data.messages);
          if (data.pinnedText) {
            setPinnedText(data.pinnedText);
            setPinInput(data.pinnedText);
          }
        }
      })
      .catch(() => { });
  }, [roomName]);

  // Connect to SSE for real-time messages & reactions
  useEffect(() => {
    const eventSource = new EventSource(`/api/mediasoup/events?roomName=${encodeURIComponent(roomName)}`);

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === "CHAT_MESSAGE" && data.message) {
          setMessages((prev) => [...prev.slice(-60), data.message]);
          // If at bottom, auto scroll
          setTimeout(scrollToBottom, 50);
        } else if (data.type === "QUICK_REACTION" && data.emoji) {
          triggerEmojiBurst(data.emoji);
        } else if (data.type === "PIN_MESSAGE") {
          setPinnedText(data.pinnedText || null);
        } else if (data.type === "GIFT_SENT") {
          // Add system gift announcement to chat
          const giftMsg: LiveChatMessage = {
            id: `gift-${Date.now()}-${Math.random()}`,
            streamId,
            senderId: data.sender?.id || "anon",
            senderUsername: data.sender?.username || "A viewer",
            text: `sent ${data.gift?.name || "a gift"} (+${data.totalCoinAmount || 10} coins) 🎁`,
            badge: "system",
            timestamp: Date.now(),
          };
          setMessages((prev) => [...prev.slice(-60), giftMsg]);
          setTimeout(scrollToBottom, 50);
        }
      } catch (err) {
        console.error("SSE chat parse error:", err);
      }
    };

    return () => {
      eventSource.close();
    };
  }, [roomName, streamId]);

  return (
    <>
      {/* Floating Emojis Reaction Layer */}
      {floatingEmojis.map((item) => (
        <div
          key={item.id}
          style={{ left: `${item.left}%` }}
          className="absolute bottom-28 z-40 pointer-events-none animate-float-heart text-2xl select-none"
        >
          {item.emoji}
        </div>
      ))}

      {/* Tango Live Chat Dock Overlay */}
      <div className={`absolute ${bottomClass} left-4 z-30 w-full max-w-[320px] sm:max-w-[360px] flex flex-col justify-end pointer-events-none`}>
        {/* Pinned Announcement Banner */}
        {pinnedText && (
          <div className="mb-2 p-2.5 rounded-2xl bg-black/75 border border-amber-400/40 backdrop-blur-md shadow-lg pointer-events-auto flex items-start gap-2 animate-gift-pop">
            <div className="p-1 rounded-lg bg-amber-400/20 text-amber-300">
              <Pin className="w-3.5 h-3.5" />
            </div>
            <div className="flex-1 text-xs">
              <span className="font-black text-amber-300 mr-1.5 uppercase text-[10px] tracking-wider">
                Pinned Goal
              </span>
              <p className="text-white font-medium line-clamp-2">{pinnedText}</p>
            </div>
            {isBroadcaster && (
              <button
                onClick={() => setShowPinModal(true)}
                className="text-[10px] font-bold text-zinc-400 hover:text-white"
              >
                Edit
              </button>
            )}
          </div>
        )}

        {/* Scrollable Messages Stream */}
        <div
          ref={scrollContainerRef}
          onScroll={handleScroll}
          className="max-h-48 overflow-y-auto space-y-1.5 pointer-events-auto pr-1 no-scrollbar scroll-smooth flex flex-col"
        >
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`px-3 py-1.5 rounded-2xl text-xs backdrop-blur-md inline-block max-w-[95%] animate-gift-pop shadow-md w-fit  ${msg.badge === "creator"
                ? "bg-gradient-to-r from-amber-500/85 to-yellow-600/85 border border-amber-300/40 text-black font-semibold"
                : msg.badge === "system"
                  ? "bg-gradient-to-r from-[#FF007A]/80 to-[#7928CA]/80 border border-white/20 text-white font-bold"
                  : msg.badge === "top_gifter"
                    ? "bg-black/70 border border-[#00F0FF]/30 text-white"
                    : "bg-black/60 border border-white/10 text-white"
                }`}
            >
              <div className="flex items-center gap-1.5 flex-wrap">
                {msg.badge === "creator" ? (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded-full bg-black text-amber-300 text-[10px] font-black uppercase">
                    <Crown className="w-3 h-3" />
                    Creator
                  </span>
                ) : msg.badge === "top_gifter" ? (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded-full bg-[#00F0FF]/20 text-[#00F0FF] text-[10px] font-black uppercase">
                    <Sparkles className="w-3 h-3" />
                    VIP
                  </span>
                ) : null}

                <span
                  className={`font-black ${msg.badge === "creator"
                    ? "text-black"
                    : msg.badge === "system"
                      ? "text-white"
                      : "text-[#FF2E93]"
                    }`}
                >
                  @{msg.senderUsername}:
                </span>

                <span
                  className={`${msg.badge === "creator"
                    ? "text-black font-medium"
                    : "text-zinc-100 font-normal"
                    }`}
                >
                  {msg.text}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* New Messages Floating Indicator */}
        {isScrolledUp && (
          <button
            onClick={scrollToBottom}
            className="self-center mt-1 flex items-center gap-1 px-3 py-1 rounded-full bg-[#FF007A] text-white text-[11px] font-black shadow-lg pointer-events-auto animate-bounce cursor-pointer"
          >
            <ArrowDown className="w-3 h-3" />
            <span>New messages below</span>
          </button>
        )}

        {/* Quick Reaction Bar */}
        <div className="flex items-center gap-1.5 mt-2 pointer-events-auto">
          {QUICK_EMOJIS.map((emoji) => (
            <button
              key={emoji}
              onClick={() => sendReaction(emoji)}
              className="w-8 h-8 rounded-full bg-black/65 hover:bg-black/90 border border-white/15 backdrop-blur-md flex items-center justify-center text-sm shadow-md hover:scale-125 active:scale-95 transition-all cursor-pointer"
              title={`React ${emoji}`}
            >
              {emoji}
            </button>
          ))}
          {isBroadcaster && !pinnedText && (
            <button
              onClick={() => setShowPinModal(true)}
              className="px-2.5 py-1 rounded-full bg-amber-400/20 hover:bg-amber-400/30 border border-amber-400/40 text-amber-300 text-[10px] font-black flex items-center gap-1 cursor-pointer"
            >
              <Pin className="w-3 h-3" />
              <span>Pin Goal</span>
            </button>
          )}
        </div>

        {/* Chat Input Pill */}
        <form onSubmit={handleSendMessage} className="mt-2 flex items-center gap-1.5 pointer-events-auto">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder={currentUser ? "Say something in chat..." : "Sign in to chat..."}
            disabled={!currentUser}
            maxLength={200}
            className="flex-1 px-3.5 py-2 rounded-2xl bg-black/75 border border-white/20 text-white placeholder-zinc-400 text-xs focus:outline-none focus:border-[#FF007A] backdrop-blur-md transition-all disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!currentUser || !inputText.trim() || sending}
            className="p-2 rounded-2xl bg-gradient-to-r from-[#FF007A] to-[#FF2E93] hover:from-[#FF2E93] hover:to-[#FF007A] text-white disabled:opacity-40 transition-all cursor-pointer shadow-lg shadow-[#FF007A]/25"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>

      {/* Broadcaster Pin Goal Modal */}
      {showPinModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-gift-pop">
          <div className="w-full max-w-sm bg-[#0d0e15] border border-white/20 rounded-3xl p-5 shadow-2xl">
            <h3 className="text-base font-black text-white mb-2 flex items-center gap-2">
              <Pin className="w-4 h-4 text-amber-400" />
              <span>Pin Live Goal / Announcement</span>
            </h3>
            <p className="text-xs text-zinc-400 mb-4">
              This message will be pinned to the top of the chat dock for all viewers.
            </p>
            <textarea
              value={pinInput}
              onChange={(e) => setPinInput(e.target.value)}
              placeholder="e.g., Goal: 5,000 coins for celebratory live DJ set! 🎉"
              rows={3}
              maxLength={150}
              className="w-full p-3 rounded-2xl bg-black/60 border border-white/15 text-white text-xs focus:outline-none focus:border-amber-400 resize-none mb-4"
            />
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setShowPinModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-zinc-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleSavePin}
                className="px-4 py-2 rounded-xl text-xs font-black bg-gradient-to-r from-amber-400 to-yellow-500 text-black shadow-lg"
              >
                Save Pin
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
