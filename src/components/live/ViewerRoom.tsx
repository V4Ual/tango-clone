"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Radio,
  ArrowLeft,
  Sparkles,
  Volume2,
  VolumeX,
  RefreshCw,
  Heart,
  Eye,
  VideoOff,
  MicOff,
  Flame,
  Share2,
  Monitor,
  Maximize2,
  Sliders,
  Check,
  ChevronDown,
} from "lucide-react";
import confetti from "canvas-confetti";
import { useAuth } from "@/components/auth/AuthContext";
import { TangoGiftSidebar } from "@/components/gifts/TangoGiftSidebar";
import { GiftItem } from "@/components/gifts/GiftTray";
import { JanusViewerSession } from "@/lib/janus-client";
import { getJanusRoomId } from "@/lib/janus-admin";
import { LiveChat } from "./LiveChat";
import { AudienceModal } from "./AudienceModal";

interface ViewerRoomProps {
  streamId: string;
  roomName: string;
  title: string;
  broadcaster: {
    id: string;
    username: string;
    avatarUrl: string | null;
  };
  initialStatus?: string;
}

interface ActiveGiftAnim {
  id: string;
  senderName: string;
  giftName: string;
  giftAsset: string;
  coins: number;
}

interface FloatingHeartItem {
  id: number;
  left: number;
  color: string;
}

const HEART_COLORS = ["#FF007A", "#FF2E93", "#FFD700", "#7928CA", "#00F0FF"];

export function ViewerRoom({
  streamId,
  roomName,
  title,
  broadcaster,
  initialStatus,
}: ViewerRoomProps) {
  const router = useRouter();
  const { user } = useAuth();
  const videoRef = useRef<HTMLVideoElement>(null);
  const janusViewerRef = useRef<JanusViewerSession | null>(null);
  const isBroadcasterCamOffRef = useRef<boolean | null>(null);

  const [viewerCount, setViewerCount] = useState(1);
  const [showAudienceModal, setShowAudienceModal] = useState(false);
  const [connecting, setConnecting] = useState(initialStatus !== "ended");
  const [hasVideoTrack, setHasVideoTrack] = useState(false);
  const [streamEnded, setStreamEnded] = useState(initialStatus === "ended");
  const [isOffline, setIsOffline] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Audio Management state
  const [muted, setMuted] = useState(true);

  // Broadcaster Media Status
  const [broadcasterCamOff, setBroadcasterCamOff] = useState(false);
  const [broadcasterMicMuted, setBroadcasterMicMuted] = useState(false);

  // Camera Aspect Ratio and Fit Management
  type AspectRatioMode = "auto" | "16:9" | "9:16" | "4:3" | "fill";
  type FitMode = "contain" | "cover";

  const [aspectRatioMode, setAspectRatioMode] = useState<AspectRatioMode>("auto");
  const [fitMode, setFitMode] = useState<FitMode>("contain");
  const [detectedRatio, setDetectedRatio] = useState<"16:9" | "9:16">("16:9");
  const [videoResolution, setVideoResolution] = useState<{ width: number; height: number } | null>(null);
  const [showRatioMenu, setShowRatioMenu] = useState(false);

  // Auto-close ratio menu on click outside
  useEffect(() => {
    if (!showRatioMenu) return;
    const handleClickOutside = () => setShowRatioMenu(false);
    window.addEventListener("click", handleClickOutside);
    return () => window.removeEventListener("click", handleClickOutside);
  }, [showRatioMenu]);

  // Video metadata and dimensions listener for auto ratio detection
  const handleVideoMetadataLoaded = useCallback(() => {
    if (videoRef.current) {
      const w = videoRef.current.videoWidth;
      const h = videoRef.current.videoHeight;
      if (w && h) {
        setVideoResolution({ width: w, height: h });
        setDetectedRatio(w >= h ? "16:9" : "9:16");
      }
      videoRef.current.play().catch(() => {});
    }
  }, []);

  const [activeGiftAnim, setActiveGiftAnim] = useState<ActiveGiftAnim | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [floatingHearts, setFloatingHearts] = useState<FloatingHeartItem[]>([]);
  const [isFollowing, setIsFollowing] = useState(false);
  const [battleTimeSeconds, setBattleTimeSeconds] = useState(26);

  // Tango PK match countdown timer
  useEffect(() => {
    const timer = setInterval(() => {
      setBattleTimeSeconds((prev) => (prev > 0 ? prev - 1 : 120));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const triggerConfetti = useCallback(() => {
    confetti({
      particleCount: 80,
      spread: 85,
      origin: { y: 0.6 },
      colors: ["#FF007A", "#FF2E93", "#FFD700", "#7928CA", "#00F0FF"],
    });
  }, []);

  const handleIncomingGift = useCallback(
    (giftData: any) => {
      const anim: ActiveGiftAnim = {
        id: `${Date.now()}-${Math.random()}`,
        senderName: giftData.sender?.username || "A viewer",
        giftName: giftData.gift?.name || "Gift",
        giftAsset: giftData.gift?.assetUrl || "/gifts/heart.svg",
        coins: giftData.totalCoinAmount || 10,
      };

      setActiveGiftAnim(anim);
      triggerConfetti();

      setTimeout(() => {
        setActiveGiftAnim((curr) => (curr?.id === anim.id ? null : curr));
      }, 4000);
    },
    [triggerConfetti]
  );

  const handleIncomingGiftRef = useRef(handleIncomingGift);
  handleIncomingGiftRef.current = handleIncomingGift;

  // Spawn floating heart
  const spawnHeart = useCallback(() => {
    const newHeart: FloatingHeartItem = {
      id: Date.now() + Math.random(),
      left: 70 + Math.random() * 20, // bottom right
      color: HEART_COLORS[Math.floor(Math.random() * HEART_COLORS.length)],
    };
    setFloatingHearts((prev) => [...prev.slice(-12), newHeart]);
    setTimeout(() => {
      setFloatingHearts((prev) => prev.filter((h) => h.id !== newHeart.id));
    }, 2400);
  }, []);

  // Initialize Janus Viewer Subscriber Session
  useEffect(() => {
    let isMounted = true;
    let eventSource: EventSource | null = null;
    let retryTimeout: any = null;
    let pollInterval: any = null;
    let attempts = 0;
    let sessionStarted = false;

    if (streamEnded) return;

    function cleanupJanus() {
      if (janusViewerRef.current) {
        janusViewerRef.current.destroy();
        janusViewerRef.current = null;
      }
    }

    async function checkStatus() {
      try {
        const statusRes = await fetch(`/api/streams/status?roomName=${encodeURIComponent(roomName)}`);
        if (statusRes.ok) {
          const status = await statusRes.json();
          if (!isMounted) return false;
          if (status.isEnded || status.status === "ended") {
            setStreamEnded(true);
            setIsOffline(false);
            setConnecting(false);
            cleanupJanus();
            return false;
          }
          const isCamOff = status.camEnabled === false;
          isBroadcasterCamOffRef.current = isCamOff;
          setBroadcasterCamOff(isCamOff);
          if (status.micEnabled !== undefined) {
            setBroadcasterMicMuted(!status.micEnabled);
          }
          return true;
        }
      } catch {
        // Quiet warning, streamer may be starting
      }
      return true;
    }

    function handleFailure() {
      if (!isMounted) return;
      cleanupJanus();
      sessionStarted = false;
      attempts++;

      if (attempts >= 3) {
        // Broadcaster is offline or disconnected
        setIsOffline(true);
        setConnecting(false);
        // Start relaxed low-frequency polling (every 10s) without aggressive retries
        if (!pollInterval) {
          pollInterval = setInterval(async () => {
            if (!isMounted) return;
            const canProceed = await checkStatus();
            if (canProceed && !hasVideoTrack) {
              initJanusViewer();
            }
          }, 10000);
        }
      } else {
        // Soft retry with progressive backoff
        setConnecting(true);
        const delay = attempts === 1 ? 2000 : 3500;
        retryTimeout = setTimeout(() => {
          if (isMounted && !hasVideoTrack) {
            initJanusViewer();
          }
        }, delay);
      }
    }

    async function initJanusViewer() {
      if (!isMounted) return;

      if (retryTimeout) {
        clearTimeout(retryTimeout);
        retryTimeout = null;
      }
      cleanupJanus();
      sessionStarted = false;

      // 1. Fetch authoritative broadcaster status
      const canProceed = await checkStatus();
      if (!canProceed || !isMounted) return;

      try {
        setConnecting(true);
        const numericRoom = getJanusRoomId(streamId);

        // 2. Setup Janus Viewer Subscriber
        const janusSession = new JanusViewerSession({
          wsUrl: `ws://${window.location.hostname}:8188`,
          room: numericRoom,
          feedId: 1,
          onRemoteStream: (remoteStream) => {
            if (!isMounted) return;
            attempts = 0;
            setIsOffline(false);
            if (pollInterval) {
              clearInterval(pollInterval);
              pollInterval = null;
            }

            if (videoRef.current) {
              videoRef.current.srcObject = remoteStream;
              if (!isBroadcasterCamOffRef.current) {
                videoRef.current.play().catch(() => { });
              }
            }

            // Track mute/unmute events from broadcaster camera and mic
            const videoTracks = remoteStream.getVideoTracks();
            if (videoTracks.length > 0) {
              videoTracks[0].onmute = () => {
                if (isMounted) {
                  isBroadcasterCamOffRef.current = true;
                  setBroadcasterCamOff(true);
                }
              };
              videoTracks[0].onunmute = () => {
                // IMPORTANT: Never override if broadcaster explicitly turned camera off
                if (isMounted && isBroadcasterCamOffRef.current !== true) {
                  setBroadcasterCamOff(false);
                }
              };
            }
            const audioTracks = remoteStream.getAudioTracks();
            if (audioTracks.length > 0) {
              audioTracks[0].onmute = () => {
                if (isMounted) setBroadcasterMicMuted(true);
              };
              audioTracks[0].onunmute = () => {
                if (isMounted) setBroadcasterMicMuted(false);
              };
            }

            setHasVideoTrack(true);
            setConnecting(false);
            setError(null);
          },
          onError: () => {
            // Only trigger failure handler if session was already established
            if (!isMounted || !sessionStarted) return;
            handleFailure();
          },
        });

        janusViewerRef.current = janusSession;
        await janusSession.start();
        sessionStarted = true;

        if (isMounted) {
          setConnecting(false);
          setError(null);
        }
      } catch (err: any) {
        if (!isMounted) return;
        console.warn("Janus viewer connection attempt notice (streamer may be offline):", err?.message || err);
        handleFailure();
      }
    }

    // Connect to SSE events for real-time gifts, viewer count, and broadcast status
    try {
      eventSource = new EventSource(`/api/mediasoup/events?roomName=${encodeURIComponent(roomName)}`);
      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === "GIFT_SENT") {
            handleIncomingGiftRef.current(data);
          } else if (data.type === "VIEWER_COUNT") {
            setViewerCount(data.count || 1);
          } else if (data.type === "STREAM_STATUS") {
            if (data.camEnabled !== undefined) {
              const isOff = !data.camEnabled;
              isBroadcasterCamOffRef.current = isOff;
              setBroadcasterCamOff(isOff);
            }
            if (data.micEnabled !== undefined) {
              setBroadcasterMicMuted(!data.micEnabled);
            }
          } else if (data.type === "STREAM_ENDED") {
            setStreamEnded(true);
            setIsOffline(false);
            cleanupJanus();
          }
        } catch (err) {
          console.error("SSE message parse error:", err);
        }
      };
    } catch { }

    initJanusViewer();

    return () => {
      isMounted = false;
      if (retryTimeout) clearTimeout(retryTimeout);
      if (pollInterval) clearInterval(pollInterval);
      if (eventSource) eventSource.close();
      cleanupJanus();
    };
  }, [streamId, roomName, streamEnded]);

  // Audio Management Handlers
  const toggleMute = () => {
    const nextMuted = !muted;
    setMuted(nextMuted);
    if (videoRef.current) {
      videoRef.current.muted = nextMuted;
    }
  };

  const handleSyncVideo = async () => {
    setSyncing(true);
    setIsOffline(false);
    setConnecting(true);
    setError(null);

    if (janusViewerRef.current) {
      janusViewerRef.current.destroy();
      janusViewerRef.current = null;
    }

    try {
      const statusRes = await fetch(`/api/streams/status?roomName=${encodeURIComponent(roomName)}`);
      if (statusRes.ok) {
        const status = await statusRes.json();
        if (status.isEnded || status.status === "ended") {
          setStreamEnded(true);
          setSyncing(false);
          setConnecting(false);
          return;
        }
      }

      const numericRoom = getJanusRoomId(streamId);
      const session = new JanusViewerSession({
        wsUrl: `ws://${window.location.hostname}:8188`,
        room: numericRoom,
        feedId: 1,
        onRemoteStream: (stream) => {
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            if (!isBroadcasterCamOffRef.current) {
              videoRef.current.play().catch(() => { });
            }
          }
          setHasVideoTrack(true);
          setIsOffline(false);
          setConnecting(false);
        },
      });
      janusViewerRef.current = session;
      await session.start();
      setIsOffline(false);
      setConnecting(false);
    } catch (err) {
      console.warn("Sync video notice (streamer may be offline):", err);
      setIsOffline(true);
      setConnecting(false);
    } finally {
      setTimeout(() => setSyncing(false), 600);
    }
  };

  const handleGiftSentLocally = (gift: GiftItem, quantity: number) => {
    handleIncomingGift({
      sender: { username: "You" },
      gift,
      totalCoinAmount: gift.coinPrice * quantity,
    });
    spawnHeart();
  };

  if (streamEnded) {
    return (
      <div className="w-full h-screen bg-[#07080d] flex items-center justify-center p-6">
        <div className="max-w-md w-full p-8 rounded-3xl tango-panel text-center border border-white/10 shadow-2xl">
          <div className="w-16 h-16 rounded-3xl bg-zinc-800 flex items-center justify-center mx-auto mb-4 text-zinc-400">
            <Radio className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-black text-white mb-2">Broadcast Ended</h2>
          <p className="text-zinc-400 text-sm mb-6">
            @{broadcaster.username} has wrapped up this live broadcast. Explore other live creators!
          </p>
          <button
            onClick={() => router.push("/live")}
            className="w-full py-3 rounded-2xl font-black text-white tango-gradient-btn transition-all cursor-pointer"
          >
            Browse Other Streams
          </button>
        </div>
      </div>
    );
  }

  const effectiveRatio = aspectRatioMode === "auto" ? detectedRatio : aspectRatioMode;
  const containerRatioClass =
    aspectRatioMode === "fill"
      ? "w-full h-full max-w-6xl"
      : effectiveRatio === "16:9"
      ? "aspect-[16/9] w-full max-w-4xl max-h-[calc(100vh-90px)]"
      : effectiveRatio === "9:16"
      ? "aspect-[9/16] h-full max-h-[calc(100vh-90px)]"
      : effectiveRatio === "4:3"
      ? "aspect-[4/3] w-full max-w-3xl max-h-[calc(100vh-90px)]"
      : "aspect-[16/9] w-full max-w-4xl max-h-[calc(100vh-90px)]";

  return (
    <div className="w-full h-full bg-[#07080d] flex flex-col overflow-hidden text-white select-none">
      {/* 1. Tango Live Top Bar (Edge-to-Edge matching Tango Web View) */}
      <header className="w-full h-14 bg-[#0a0b12] border-b border-white/10 px-3 sm:px-5 flex items-center justify-between z-40 shrink-0">
        {/* Left: Back button & Tango Brand Logo */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/live")}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer border border-white/10"
            title="Leave Stream"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>

          <div
            onClick={() => router.push("/live")}
            className="flex items-center gap-1.5 cursor-pointer group"
          >
            <div className="w-7 h-7 rounded-xl bg-gradient-to-tr from-[#FF007A] to-[#FF2E93] flex items-center justify-center shadow-md group-hover:scale-105 transition-transform">
              <Flame className="w-4 h-4 text-white fill-white" />
            </div>
            <span className="font-black text-lg tracking-tight text-white font-sans lowercase">
              tango
            </span>
          </div>
        </div>

        {/* Center: Tango Live PK Battle Match Bar (Signature Tango Feature) */}
        <div className="flex items-center gap-2 max-w-sm sm:max-w-md w-full justify-center">
          {/* Broadcaster Avatar & Score */}
          <div className="flex items-center gap-1.5">
            <div className="w-8 h-8 rounded-full p-[1.5px] bg-[#FF007A] shadow-md">
              {broadcaster.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={broadcaster.avatarUrl}
                  alt={broadcaster.username}
                  className="w-full h-full rounded-full object-cover"
                />
              ) : (
                <div className="w-full h-full rounded-full bg-zinc-800 flex items-center justify-center text-[10px] font-black text-white">
                  {broadcaster.username.charAt(0).toUpperCase()}
                </div>
              )}
            </div>
            <span className="text-[11px] font-black text-amber-400 bg-black/75 px-2 py-0.5 rounded-full border border-amber-400/30 flex items-center gap-1 shadow">
              <span>🪙</span>
              <span>0</span>
            </span>
          </div>

          {/* Dynamic Score Beam & Match Countdown */}
          <div className="flex-1 max-w-[130px] sm:max-w-[170px] flex flex-col items-center gap-0.5">
            <div className="w-full h-2 rounded-full bg-zinc-900 border border-white/10 overflow-hidden relative flex shadow-inner">
              <div
                className="h-full bg-gradient-to-r from-amber-400 to-amber-500 rounded-l-full transition-all duration-300"
                style={{ width: "35%" }}
              />
              <div
                className="h-full bg-gradient-to-r from-rose-500 to-[#FF007A] rounded-r-full transition-all duration-300"
                style={{ width: "65%" }}
              />
            </div>
            <span className="text-[10px] font-black bg-rose-600 text-white px-2 py-0.2 rounded-full tracking-wider shadow">
              00:{String(battleTimeSeconds).padStart(2, "0")}
            </span>
          </div>

          {/* Opponent Challenger Avatar & Score */}
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-black text-amber-400 bg-black/75 px-2 py-0.5 rounded-full border border-amber-400/30 flex items-center gap-1 shadow">
              <span>🪙</span>
              <span>8</span>
            </span>
            <div className="relative">
              <div className="w-8 h-8 rounded-full p-[1.5px] bg-amber-400 shadow-md">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80"
                  alt="Challenger"
                  className="w-full h-full rounded-full object-cover"
                />
              </div>
              <span className="absolute -top-1.5 -right-1.5 text-xs drop-shadow">🏆</span>
            </div>
          </div>
        </div>

        {/* Right Actions: Camera Ratio Manager, Viewers, Mute, Refresh, Share */}
        <div className="flex items-center gap-2">
          {/* Camera View & Aspect Ratio Manager Menu */}
          <div className="relative">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowRatioMenu((prev) => !prev);
              }}
              className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer border ${
                showRatioMenu
                  ? "bg-gradient-to-r from-[#FF007A] to-[#FF2E93] border-[#FF2E93] text-white shadow-[0_0_15px_rgba(255,0,122,0.5)]"
                  : "bg-white/10 hover:bg-white/15 text-white border-white/10"
              }`}
              title="Camera View & Ratio Manager"
            >
              <Monitor className="w-3.5 h-3.5 text-pink-400" />
              <span className="hidden sm:inline uppercase text-[10px] tracking-wider">
                {aspectRatioMode === "auto" ? `Auto (${detectedRatio})` : aspectRatioMode}
              </span>
              <ChevronDown className={`w-3 h-3 text-zinc-300 transition-transform ${showRatioMenu ? "rotate-180" : ""}`} />
            </button>

            {showRatioMenu && (
              <div
                onClick={(e) => e.stopPropagation()}
                className="absolute right-0 top-full mt-2 w-64 rounded-2xl bg-[#0e0f17]/95 border border-white/15 backdrop-blur-xl shadow-2xl p-3.5 z-50 flex flex-col gap-3 animate-gift-pop text-white"
              >
                <div className="flex items-center justify-between border-b border-white/10 pb-2">
                  <span className="text-xs font-black text-white flex items-center gap-1.5">
                    <Sliders className="w-3.5 h-3.5 text-[#FF2E93]" />
                    Camera & Ratio
                  </span>
                  {videoResolution ? (
                    <span className="text-[10px] text-amber-400 font-mono bg-amber-400/10 px-1.5 py-0.5 rounded border border-amber-400/20">
                      {videoResolution.width}×{videoResolution.height}
                    </span>
                  ) : (
                    <span className="text-[10px] text-zinc-400">Auto Detecting</span>
                  )}
                </div>

                {/* Aspect Ratio Options */}
                <div>
                  <label className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider block mb-1.5">
                    Aspect Ratio
                  </label>
                  <div className="grid grid-cols-2 gap-1.5 text-xs">
                    {[
                      { id: "auto", label: `Auto (${detectedRatio})` },
                      { id: "16:9", label: "16:9 Landscape" },
                      { id: "9:16", label: "9:16 Portrait" },
                      { id: "4:3", label: "4:3 Standard" },
                      { id: "fill", label: "Full Stage" },
                    ].map((opt) => (
                      <button
                        key={opt.id}
                        onClick={() => setAspectRatioMode(opt.id as any)}
                        className={`px-2.5 py-1.5 rounded-xl font-bold text-[11px] text-left flex items-center justify-between transition-all cursor-pointer ${
                          aspectRatioMode === opt.id
                            ? "bg-[#FF007A] text-white shadow-md"
                            : "bg-white/5 hover:bg-white/10 text-zinc-300"
                        } ${opt.id === "fill" ? "col-span-2" : ""}`}
                      >
                        <span>{opt.label}</span>
                        {aspectRatioMode === opt.id && <Check className="w-3 h-3 text-white" />}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Camera Fit Mode */}
                <div className="border-t border-white/10 pt-2.5">
                  <label className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider block mb-1.5">
                    Camera Framing (Crop vs Fit)
                  </label>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      onClick={() => setFitMode("contain")}
                      className={`px-2.5 py-1.5 rounded-xl font-bold text-[11px] flex items-center justify-center gap-1 transition-all cursor-pointer ${
                        fitMode === "contain"
                          ? "bg-white/20 text-white border border-white/30 shadow"
                          : "bg-white/5 hover:bg-white/10 text-zinc-400"
                      }`}
                      title="Shows the entire camera picture with no cropping"
                    >
                      <span>Fit (No Crop)</span>
                      {fitMode === "contain" && <Check className="w-3 h-3 text-emerald-400" />}
                    </button>
                    <button
                      onClick={() => setFitMode("cover")}
                      className={`px-2.5 py-1.5 rounded-xl font-bold text-[11px] flex items-center justify-center gap-1 transition-all cursor-pointer ${
                        fitMode === "cover"
                          ? "bg-white/20 text-white border border-white/30 shadow"
                          : "bg-white/5 hover:bg-white/10 text-zinc-400"
                      }`}
                      title="Fills the container, cropping if ratios differ"
                    >
                      <span>Fill & Zoom</span>
                      {fitMode === "cover" && <Check className="w-3 h-3 text-emerald-400" />}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Viewer count pill */}
          <button
            onClick={() => setShowAudienceModal(true)}
            className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-white/10 hover:bg-white/15 text-white transition-all cursor-pointer border border-white/10"
            title="View Audience"
          >
            <Eye className="w-3.5 h-3.5 text-zinc-300" />
            <span>{viewerCount}</span>
          </button>

          {/* Mute button */}
          <button
            onClick={toggleMute}
            className={`p-2 rounded-full border transition-all cursor-pointer ${muted
              ? "bg-rose-500/80 border-rose-500 text-white animate-pulse"
              : "bg-white/10 border-white/10 hover:bg-white/20 text-white"
              }`}
            title={muted ? "Unmute Sound" : "Mute Sound"}
          >
            {muted ? <VolumeX className="w-4 h-4 text-white" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
          </button>

          {/* Refresh / Sync video */}
          <button
            onClick={handleSyncVideo}
            disabled={syncing}
            className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-all cursor-pointer border border-white/10"
            title="Refresh Video Feed"
          >
            <RefreshCw className={`w-4 h-4 ${syncing ? "animate-spin text-[#FF2E93]" : ""}`} />
          </button>

          {/* Share */}
          <button
            onClick={() => {
              if (navigator.share) {
                navigator.share({ title, url: window.location.href }).catch(() => { });
              }
            }}
            className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-all cursor-pointer border border-white/10"
            title="Share Broadcast"
          >
            <Share2 className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* 2. Main Live Body Split (Stage on Left/Center + Tango Gift Sidebar on Right) */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Main Live Stage */}
        <main className="flex-1 relative h-full bg-[#07080d] overflow-hidden flex items-center justify-center p-2 sm:p-4">
          {/* Ambient Video Glow Backdrop */}
          <div className="absolute inset-0 bg-gradient-to-b from-[#141525]/40 via-[#07080d] to-[#040508] pointer-events-none" />

          {/* Video Container Stage */}
          <div className="relative h-full max-h-[calc(100vh-80px)] w-full flex items-center justify-center">
            {/* Main Video Stream Frame with Dynamic Aspect Ratio */}
            <div
              onClick={() => {
                if (muted) toggleMute();
              }}
              className={`relative ${containerRatioClass} max-w-full bg-black rounded-2xl overflow-hidden shadow-2xl border border-white/15 flex items-center justify-center cursor-pointer group transition-all duration-300`}
            >
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted={muted}
                onLoadedMetadata={handleVideoMetadataLoaded}
                onResize={handleVideoMetadataLoaded}
                className={`w-full h-full ${
                  fitMode === "cover" ? "object-cover" : "object-contain"
                } transition-opacity duration-300 ${broadcasterCamOff ? "opacity-0 pointer-events-none" : "opacity-100"
                  }`}
              />

              {/* Quick Aspect Ratio Switcher Badge on Video */}
              <div
                onClick={(e) => e.stopPropagation()}
                className="absolute top-4 right-4 z-20 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/60 hover:bg-black/80 backdrop-blur-md border border-white/10 text-white text-[10px] font-bold opacity-75 hover:opacity-100 transition-all cursor-pointer shadow-lg"
                title="Click to toggle Aspect Ratio & Fit Mode"
              >
                <button
                  onClick={() => setAspectRatioMode((prev) => (prev === "16:9" ? "9:16" : prev === "9:16" ? "auto" : "16:9"))}
                  className="flex items-center gap-1 hover:text-[#FF2E93] cursor-pointer"
                >
                  <Maximize2 className="w-3 h-3 text-[#FF2E93]" />
                  <span>{effectiveRatio}</span>
                </button>
                <span className="text-white/20">|</span>
                <button
                  onClick={() => setFitMode((prev) => (prev === "contain" ? "cover" : "contain"))}
                  className="hover:text-amber-400 cursor-pointer uppercase text-[9px]"
                  title="Toggle Contain (No Crop) / Cover (Fill)"
                >
                  {fitMode}
                </button>
              </div>

              {/* Broadcaster Paused Camera Notice */}
              {broadcasterCamOff && (
                <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-[#08090d]/95 backdrop-blur-md p-6 text-center animate-gift-pop">
                  <div className="relative mb-3">
                    <div className="p-1 rounded-full tango-live-ring shadow-[0_0_35px_rgba(255,0,122,0.6)]">
                      {broadcaster.avatarUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={broadcaster.avatarUrl}
                          alt={broadcaster.username}
                          className="w-18 h-18 rounded-full object-cover border-2 border-black"
                        />
                      ) : (
                        <div className="w-18 h-18 rounded-full bg-gradient-to-tr from-[#FF007A] to-[#7928CA] flex items-center justify-center text-xl font-black text-white border-2 border-black">
                          {broadcaster.username.charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>
                    <div className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-zinc-900 border border-white/20 flex items-center justify-center text-[#FF2E93] shadow-md">
                      <VideoOff className="w-3.5 h-3.5" />
                    </div>
                  </div>

                  <p className="text-base font-black text-white">Camera Paused</p>
                  <p className="text-xs text-zinc-400 max-w-xs mt-1 mb-3">
                    @{broadcaster.username} turned off camera. Live voice and chat active!
                  </p>

                  <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md">
                    {broadcasterMicMuted ? (
                      <>
                        <MicOff className="w-3.5 h-3.5 text-rose-400" />
                        <span className="text-xs font-bold text-zinc-400">Broadcaster Muted</span>
                      </>
                    ) : (
                      <>
                        <div className="flex items-end gap-1 h-3.5">
                          <span className="w-1 bg-[#FF007A] rounded-full animate-bounce h-2" />
                          <span className="w-1 bg-[#FF2E93] rounded-full animate-bounce h-3.5" />
                          <span className="w-1 bg-[#00F0FF] rounded-full animate-bounce h-3" />
                        </div>
                        <span className="text-xs font-bold text-[#FF2E93]">Live Voice</span>
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* Unmute prompt */}
              {hasVideoTrack && muted && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleMute();
                  }}
                  className="absolute top-16 z-30 flex items-center gap-2 px-4 py-2 rounded-full bg-black/85 hover:bg-black text-white text-xs font-black backdrop-blur-md border border-white/20 cursor-pointer shadow-2xl animate-pulse hover:scale-105 transition-all"
                >
                  <VolumeX className="w-4 h-4 text-[#FF2E93]" />
                  <span>Tap to Unmute Sound 🔊</span>
                </button>
              )}

              {/* Offline Overlay */}
              {isOffline ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-950/90 p-6 text-center z-20 backdrop-blur-sm animate-gift-pop">
                  <div className="relative mb-3">
                    <div className="p-1 rounded-full border-2 border-zinc-700 shadow-xl">
                      {broadcaster.avatarUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={broadcaster.avatarUrl}
                          alt={broadcaster.username}
                          className="w-16 h-16 rounded-full object-cover grayscale opacity-80"
                        />
                      ) : (
                        <div className="w-16 h-16 rounded-full bg-zinc-800 flex items-center justify-center text-xl font-black text-zinc-400">
                          {broadcaster.username.charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>
                    <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 px-2 py-0.2 rounded-full text-[9px] font-black bg-zinc-800 border border-zinc-600 text-zinc-300 uppercase tracking-wider">
                      Offline
                    </span>
                  </div>

                  <p className="text-base font-black text-white mb-1">@{broadcaster.username} is Offline</p>
                  <p className="text-[11px] text-zinc-400 max-w-xs mb-4">
                    Streamer has not started broadcasting yet or has disconnected. We&apos;ll auto-reconnect!
                  </p>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleSyncVideo}
                      disabled={syncing}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-[#FF007A] to-[#FF2E93] text-white text-xs font-black cursor-pointer shadow-lg hover:scale-105 transition-all"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${syncing ? "animate-spin" : ""}`} />
                      <span>{syncing ? "Checking..." : "Check if Live"}</span>
                    </button>
                    <button
                      onClick={() => router.push("/live")}
                      className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-zinc-200 text-xs font-bold border border-white/10 cursor-pointer"
                    >
                      Browse
                    </button>
                  </div>
                </div>
              ) : connecting ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/75 backdrop-blur-sm z-20">
                  <div className="w-10 h-10 border-4 border-[#FF007A] border-t-transparent rounded-full animate-spin mb-3" />
                  <p className="text-sm font-bold text-white">Connecting to @{broadcaster.username}&apos;s stream...</p>
                  <p className="text-[11px] text-zinc-400 mt-1">Establishing real-time connection</p>
                </div>
              ) : !hasVideoTrack ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-950/85 p-6 text-center z-10">
                  <div className="w-14 h-14 rounded-2xl bg-[#FF007A]/15 border border-[#FF007A]/30 flex items-center justify-center text-[#FF2E93] mb-3 animate-pulse">
                    <Radio className="w-7 h-7" />
                  </div>
                  <p className="text-sm font-black text-white mb-1">Waiting for @{broadcaster.username}&apos;s Video</p>
                  <p className="text-[11px] text-zinc-400 max-w-xs mb-3">
                    Stream will play as soon as broadcaster sends video frames.
                  </p>
                  <button
                    onClick={handleSyncVideo}
                    disabled={syncing}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold border border-white/10 cursor-pointer transition-all"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${syncing ? "animate-spin text-[#FF2E93]" : ""}`} />
                    <span>{syncing ? "Syncing..." : "Sync Stream"}</span>
                  </button>
                </div>
              ) : null}

              {/* Bottom-Center Broadcaster Pill (Tango Signature) */}
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/75 backdrop-blur-md border border-white/15 shadow-2xl">
                <div className="w-7 h-7 rounded-full p-[1px] bg-[#FF007A]">
                  {broadcaster.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={broadcaster.avatarUrl}
                      alt={broadcaster.username}
                      className="w-full h-full rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full rounded-full bg-zinc-800 flex items-center justify-center text-[10px] font-bold text-white">
                      {broadcaster.username.charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>
                <div className="flex flex-col">
                  <span className="text-xs font-black text-white">@{broadcaster.username}</span>
                  <span className="text-[10px] text-amber-400 font-bold flex items-center gap-0.5">
                    💎 4,730,404
                  </span>
                </div>
                <button
                  onClick={() => setIsFollowing(!isFollowing)}
                  className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs cursor-pointer shadow-md transition-all ${isFollowing
                    ? "bg-zinc-700 text-emerald-400"
                    : "bg-[#FF007A] hover:bg-[#FF2E93] text-white hover:scale-110"
                    }`}
                  title={isFollowing ? "Following" : "Follow Broadcaster"}
                >
                  {isFollowing ? "✓" : "+"}
                </button>
              </div>

              {/* Top-Left Goal Widget (Tango Collection in Progress) */}
              <div className="absolute top-4 left-4 z-20 flex flex-col gap-1.5 p-2.5 rounded-2xl bg-black/65 backdrop-blur-md border border-white/10 text-white max-w-[170px] pointer-events-none">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[9px] text-zinc-400 font-bold uppercase tracking-wider">
                      Collection in progress
                    </p>
                    <div className="flex items-center gap-1 mt-0.5">
                      <span className="text-sm">🌹</span>
                      <span className="text-[11px] font-black text-amber-400">1,599</span>
                    </div>
                  </div>
                  <span className="text-[9px] font-black text-zinc-400">1/4</span>
                </div>
                <div className="w-full bg-white/10 h-1.5 rounded-full overflow-hidden">
                  <div className="bg-amber-400 h-full rounded-full" style={{ width: "25%" }} />
                </div>
                <div>
                  <div className="flex items-center justify-between text-[9px] font-bold text-zinc-300">
                    <span>Today</span>
                    <span className="text-amber-400">🪙 5,032 / 11,000</span>
                  </div>
                  <div className="w-full bg-white/10 h-1.5 rounded-full overflow-hidden mt-0.5">
                    <div
                      className="bg-gradient-to-r from-amber-400 to-[#FF007A] h-full rounded-full"
                      style={{ width: "46%" }}
                    />
                  </div>
                </div>
              </div>

              {/* Floating Hearts Reaction Layer */}
              {floatingHearts.map((heart) => (
                <div
                  key={heart.id}
                  style={{ left: `${heart.left}%` }}
                  className="absolute bottom-16 z-30 pointer-events-none animate-float-heart"
                >
                  <Heart className="w-7 h-7 drop-shadow-lg" style={{ color: heart.color, fill: heart.color }} />
                </div>
              ))}

              {/* Bottom-Left Live Chat Dock Overlay (Anchored to Video Stream) */}
              <LiveChat
                roomName={roomName}
                streamId={streamId}
                isBroadcaster={false}
                currentUser={user}
                bottomClass="bottom-3"
              />
            </div>
          </div>

          {/* Real-time Big Gift Animation Overlay */}
          {activeGiftAnim && (
            <div className="absolute top-1/3 inset-x-0 flex items-center justify-center z-40 pointer-events-none">
              <div className="animate-gift-pop flex items-center gap-4 px-6 py-4 rounded-3xl bg-black/90 border-2 border-[#FF007A] shadow-[0_0_60px_rgba(255,0,122,0.8)] backdrop-blur-xl">
                <span className="text-5xl animate-bounce">
                  {activeGiftAnim.giftAsset}
                </span>
                <div>
                  <div className="flex items-center gap-1 text-[#FF2E93] text-xs font-black uppercase tracking-wider">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Virtual Gift Sent!</span>
                  </div>
                  <p className="text-white font-black text-xl">{activeGiftAnim.senderName}</p>
                  <p className="text-amber-400 text-sm font-bold">
                    Sent a {activeGiftAnim.giftName} (+{activeGiftAnim.coins} coins)
                  </p>
                </div>
              </div>
            </div>
          )}
        </main>

        {/* 3. Right Sidebar: Dedicated Tango Gift & Wallet Panel (Exactly like Image 2!) */}
        <TangoGiftSidebar
          streamId={streamId}
          broadcasterId={broadcaster.id}
          onGiftSentSuccess={handleGiftSentLocally}
          onSendHeart={spawnHeart}
        />
      </div>

      {/* Live Audience Modal */}
      <AudienceModal
        isOpen={showAudienceModal}
        onClose={() => setShowAudienceModal(false)}
        streamId={streamId}
        roomName={roomName}
        viewerCount={viewerCount}
      />
    </div>
  );
}
