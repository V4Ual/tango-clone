"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/AuthContext";
import { BroadcasterRoom } from "@/components/live/BroadcasterRoom";
import {
  Video,
  Sparkles,
  AlertCircle,
  Camera,
  Mic,
  ShieldAlert,
  CheckCircle2,
  Flame,
  Settings,
  Layers,
  Radio,
  Sliders,
  Target,
} from "lucide-react";
import Link from "next/link";

const STREAM_TAGS = [
  "Music & Vocals 🎸",
  "Just Chatting 💬",
  "Gaming & Fun 🎮",
  "Dance & Energy 💃",
  "Q&A Session 🎙️",
];

export default function GoLivePage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [title, setTitle] = useState("");
  const [selectedTag, setSelectedTag] = useState(STREAM_TAGS[0]);
  const [targetGoal, setTargetGoal] = useState("500");
  const [isLive, setIsLive] = useState(false);
  const [streamData, setStreamData] = useState<{
    id: string;
    roomName: string;
  } | null>(null);

  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [permissionsGranted, setPermissionsGranted] = useState<boolean | null>(null);

  const previewVideoRef = useRef<HTMLVideoElement>(null);
  const previewStreamRef = useRef<MediaStream | null>(null);

  // Request preview camera & microphone stream on mount
  useEffect(() => {
    let stream: MediaStream | null = null;
    async function setupPreview() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        previewStreamRef.current = stream;
        if (previewVideoRef.current) {
          previewVideoRef.current.srcObject = stream;
        }
        setPermissionsGranted(true);
      } catch (err) {
        console.warn("Camera/mic permission notice:", err);
        setPermissionsGranted(false);
      }
    }

    if (!isLive) {
      setupPreview();
    }

    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [isLive]);

  const handleStartBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalTitle = title.trim() || `${selectedTag} with @${user?.username || "creator"}`;

    setError(null);
    setStarting(true);

    try {
      const streamRes = await fetch("/api/streams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: finalTitle }),
      });

      const streamResult = await streamRes.json();
      if (!streamRes.ok) {
        setError(streamResult.error || "Failed to start stream");
        setStarting(false);
        return;
      }

      const stream = streamResult.stream;

      // Stop pre-live preview stream so BroadcasterRoom can take over cleanly
      if (previewStreamRef.current) {
        previewStreamRef.current.getTracks().forEach((track) => track.stop());
      }

      setStreamData({
        id: stream.id,
        roomName: stream.roomName,
      });

      setIsLive(true);
    } catch {
      setError("An unexpected error occurred while starting broadcast");
    } finally {
      setStarting(false);
    }
  };

  if (authLoading) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-10 h-10 border-4 border-[#FF007A] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="max-w-md w-full p-8 rounded-3xl tango-panel text-center border border-white/10 shadow-2xl">
          <div className="w-16 h-16 rounded-2xl bg-[#FF007A]/10 border border-[#FF007A]/30 flex items-center justify-center mx-auto mb-4 text-[#FF2E93]">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Creator Login Required</h2>
          <p className="text-zinc-400 text-sm mb-6">
            Sign in to access your Tango Creator Studio, broadcast live with Janus, and receive virtual gifts!
          </p>
          <div className="flex gap-3 justify-center">
            <Link
              href="/login"
              className="px-5 py-2.5 rounded-xl font-semibold text-sm bg-zinc-800 hover:bg-zinc-700 text-white"
            >
              Sign In
            </Link>
            <Link
              href="/register"
              className="px-5 py-2.5 rounded-xl font-semibold text-sm tango-gradient-btn text-white"
            >
              Register Account
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Active Broadcaster Screen
  if (isLive && streamData) {
    return (
      <div className="flex-1 p-3 sm:p-6 flex flex-col justify-center">
        <BroadcasterRoom
          streamId={streamData.id}
          roomName={streamData.roomName}
          title={title || selectedTag}
          onStreamEnded={() => {
            setIsLive(false);
            router.push(`/profile/${user.username}`);
          }}
        />
      </div>
    );
  }

  // Pre-live Studio Setup Screen
  return (
    <div className="flex-1 max-w-5xl w-full mx-auto p-4 sm:p-6 flex flex-col justify-center">
      <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start tango-panel p-6 sm:p-8 rounded-3xl border border-white/10 shadow-2xl">
        {/* Left (5 cols): Camera Live Preview with Tango Badges */}
        <div className="md:col-span-5 flex flex-col gap-3">
          <div className="relative aspect-[3/4] w-full bg-black rounded-3xl overflow-hidden border border-white/15 shadow-2xl flex flex-col items-center justify-center">
            <video
              ref={previewVideoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />

            {permissionsGranted === false && (
              <div className="absolute inset-0 bg-black/85 flex flex-col items-center justify-center p-6 text-center text-zinc-300">
                <Camera className="w-12 h-12 text-[#FF2E93] mb-2" />
                <p className="font-bold text-white text-sm mb-1">Camera & Mic Restricted</p>
                <p className="text-xs text-zinc-400">
                  Allow permissions or switch to Virtual Studio Cam when live.
                </p>
              </div>
            )}

            {/* Top Status */}
            <div className="absolute top-3 inset-x-3 flex items-center justify-between z-20">
              <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-black bg-black/60 text-white backdrop-blur-md border border-white/10">
                <Radio className="w-3 h-3 text-[#FF2E93] animate-pulse" />
                <span>STUDIO PREVIEW</span>
              </span>
              <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-[#FF007A]/20 text-[#FF2E93] border border-[#FF007A]/30">
                Janus Ready
              </span>
            </div>

            {/* Bottom Controls Preview */}
            <div className="absolute bottom-3 inset-x-3 flex items-center justify-between px-3.5 py-2 rounded-2xl bg-black/70 backdrop-blur-md text-xs text-zinc-300 border border-white/10">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[11px] font-semibold text-white">Video Ready</span>
              </div>
              <div className="flex items-center gap-2.5">
                <Camera className="w-3.5 h-3.5 text-zinc-300" />
                <Mic className="w-3.5 h-3.5 text-zinc-300" />
              </div>
            </div>
          </div>
        </div>

        {/* Right (7 cols): Stream Details & Studio Settings */}
        <div className="md:col-span-7 flex flex-col justify-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-[#FF007A]/15 text-[#FF2E93] border border-[#FF007A]/30 mb-3 w-fit">
            <Flame className="w-3.5 h-3.5 fill-[#FF2E93]" />
            <span>Manage Broadcast Studio</span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight mb-2">
            Configure Your Live Stream
          </h1>
          <p className="text-zinc-400 text-xs sm:text-sm mb-6">
            Set your broadcast title and category. Viewers can send you Heart (10), Rose (50), Star (100), and Diamond (500) gifts during your show!
          </p>

          {error && (
            <div className="mb-4 p-3 rounded-2xl bg-[#FF007A]/15 border border-[#FF007A]/30 text-rose-200 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-[#FF2E93]" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleStartBroadcast} className="space-y-4">
            {/* Stream Title */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1.5">
                Stream Title
              </label>
              <input
                type="text"
                required
                maxLength={80}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Acoustic Jam & Live Chill 🎵"
                className="w-full px-4 py-3 rounded-2xl bg-zinc-900/90 border border-white/10 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-[#FF007A] transition-all text-sm font-semibold"
              />
            </div>

            {/* Quick Category Picker */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1.5">
                Category
              </label>
              <div className="flex flex-wrap gap-2">
                {STREAM_TAGS.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => setSelectedTag(tag)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      selectedTag === tag
                        ? "bg-[#FF007A] text-white shadow-md shadow-[#FF007A]/30"
                        : "bg-white/5 hover:bg-white/10 text-zinc-400 border border-white/5"
                    }`}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>

            {/* Target Coin Goal */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1.5">
                Session Coin Goal
              </label>
              <div className="flex items-center gap-2">
                {["250", "500", "1000", "2500"].map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => setTargetGoal(g)}
                    className={`flex-1 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                      targetGoal === g
                        ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                        : "bg-white/5 text-zinc-400 border border-white/5 hover:bg-white/10"
                    }`}
                  >
                    {g} Coins
                  </button>
                ))}
              </div>
            </div>

            {/* Perks checklist */}
            <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/5 space-y-2 text-[11px] text-zinc-400">
              <div className="flex items-center gap-2 text-zinc-300 font-semibold">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>Instant Janus WebRTC connection with sub-second stream latency</span>
              </div>
              <div className="flex items-center gap-2 text-zinc-300 font-semibold">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>Virtual Studio Camera fallback if hardware webcam is unavailable</span>
              </div>
            </div>

            {/* Go Live CTA */}
            <button
              type="submit"
              disabled={starting}
              className="w-full py-3.5 px-6 rounded-2xl font-black text-sm text-white tango-gradient-btn transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
            >
              <Video className="w-4 h-4" />
              <span>{starting ? "Launching Janus Broadcast..." : "Launch Live Stream"}</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
