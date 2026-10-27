"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  PhoneOff,
  Users,
  Coins,
  Sparkles,
  AlertCircle,
  Radio,
  MonitorPlay,
  Camera,
  Server,
  Eye,
  Volume2,
  VolumeX,
  Maximize2,
} from "lucide-react";
import confetti from "canvas-confetti";
import { useAuth } from "@/components/auth/AuthContext";
import { JanusBroadcasterSession } from "@/lib/janus-client";
import { getJanusRoomId } from "@/lib/janus-admin";
import { LiveChat } from "./LiveChat";
import { AudienceModal, TopContributorsBubbleRow } from "./AudienceModal";

interface BroadcasterRoomProps {
  streamId: string;
  roomName: string;
  title: string;
  onStreamEnded: () => void;
}

interface IncomingGift {
  id: string;
  senderName: string;
  giftName: string;
  giftAsset: string;
  coins: number;
}

// Generate animated Virtual Studio Stream for testing or when physical webcam/mic is not available
function createVirtualStudioStream(title: string): MediaStream {
  const canvas = document.createElement("canvas");
  canvas.width = 1280;
  canvas.height = 720;
  const ctx = canvas.getContext("2d")!;

  let frame = 0;
  let isRunning = true;
  let isCamActive = true;

  const draw = () => {
    if (!isRunning) return;
    frame++;

    if (!isCamActive) {
      // Solid camera paused frame
      ctx.fillStyle = "#08090d";
      ctx.fillRect(0, 0, 1280, 720);

      ctx.save();
      ctx.fillStyle = "rgba(255, 0, 122, 0.15)";
      ctx.beginPath();
      ctx.arc(640, 360, 120, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 44px system-ui, -apple-system, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("CAMERA PAUSED", 640, 350);

      ctx.fillStyle = "#a1a1aa";
      ctx.font = "20px system-ui, -apple-system, sans-serif";
      ctx.fillText("Creator temporarily turned off video", 640, 400);
      ctx.restore();

      requestAnimationFrame(draw);
      return;
    }

    // Dynamic gradient backdrop
    const grad = ctx.createLinearGradient(0, 0, 1280, 720);
    const shift = (Math.sin(frame * 0.02) + 1) / 2;
    grad.addColorStop(0, `hsl(${330 + shift * 30}, 85%, 12%)`);
    grad.addColorStop(0.5, `hsl(${270 + shift * 35}, 80%, 16%)`);
    grad.addColorStop(1, `hsl(${190 + shift * 45}, 85%, 12%)`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 1280, 720);

    // Dynamic glowing ring
    ctx.save();
    ctx.shadowBlur = 40;
    ctx.shadowColor = "#FF007A";
    ctx.strokeStyle = "rgba(255, 0, 122, 0.5)";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(640, 360, 160 + Math.sin(frame * 0.05) * 16, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    // Equalizer audio visualizer bars
    ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
    const barCount = 22;
    const barWidth = 14;
    const spacing = 12;
    const startX = 640 - (barCount * (barWidth + spacing)) / 2;
    for (let i = 0; i < barCount; i++) {
      const height = Math.abs(Math.sin(frame * 0.08 + i * 0.35)) * 95 + 15;
      const x = startX + i * (barWidth + spacing);
      const y = 360 - height / 2;
      ctx.fillRect(x, y, barWidth, height);
    }

    // Header label
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 40px system-ui, -apple-system, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("TANGO CREATOR STUDIO", 640, 190);

    ctx.fillStyle = "#FF2E93";
    ctx.font = "bold 24px system-ui, -apple-system, sans-serif";
    ctx.fillText(title || "Live Broadcast", 640, 240);

    // Status pill
    ctx.fillStyle = "#FF007A";
    ctx.beginPath();
    ctx.roundRect(545, 520, 190, 38, 19);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 15px system-ui, -apple-system, sans-serif";
    ctx.fillText("● JANUS LIVE SFU", 640, 545);

    requestAnimationFrame(draw);
  };

  requestAnimationFrame(draw);

  const stream = canvas.captureStream(30);

  // Soft Web Audio synthesizer track
  try {
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    gain.gain.value = 0.001;
    osc.frequency.value = 440;
    const dst = audioCtx.createMediaStreamDestination();
    osc.connect(gain);
    gain.connect(dst);
    osc.start();
    const audioTrack = dst.stream.getAudioTracks()[0];
    if (audioTrack) {
      stream.addTrack(audioTrack);
    }
  } catch (e) {
    console.warn("Synthetic audio note:", e);
  }

  (stream as any)._cleanup = () => {
    isRunning = false;
  };

  (stream as any).setCamActive = (active: boolean) => {
    isCamActive = active;
  };

  return stream;
}

export function BroadcasterRoom({
  streamId,
  roomName,
  title,
  onStreamEnded,
}: BroadcasterRoomProps) {
  const { user } = useAuth();
  const videoRef = useRef<HTMLVideoElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const janusSessionRef = useRef<JanusBroadcasterSession | null>(null);

  const [micEnabled, setMicEnabled] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      const saved = sessionStorage.getItem(`broadcaster_mic_${streamId}`);
      if (saved !== null) return saved === "true";
    }
    return true;
  });

  const [camEnabled, setCamEnabled] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      const saved = sessionStorage.getItem(`broadcaster_cam_${streamId}`);
      if (saved !== null) return saved === "true";
    }
    return true;
  });

  const [viewerCount, setViewerCount] = useState(0);
  const [showAudienceModal, setShowAudienceModal] = useState(false);
  const [sessionGiftsTotal, setSessionGiftsTotal] = useState(0);
  const [recentGifts, setRecentGifts] = useState<IncomingGift[]>([]);
  const [activeGiftAnimation, setActiveGiftAnimation] = useState<IncomingGift | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ending, setEnding] = useState(false);
  const [isVirtualCam, setIsVirtualCam] = useState(false);
  const [secondsLive, setSecondsLive] = useState(0);
  const [fitMode, setFitMode] = useState<"contain" | "cover">("contain");

  // Live timer
  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsLive((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatDuration = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  // Trigger celebratory confetti when a gift arrives
  const triggerConfetti = useCallback(() => {
    confetti({
      particleCount: 60,
      spread: 70,
      origin: { y: 0.6 },
      colors: ["#FF007A", "#FF2E93", "#FFD700", "#7928CA", "#00F0FF"],
    });
  }, []);

  // Poll stream gift total as reliable backup
  useEffect(() => {
    const pollGiftTotal = async () => {
      try {
        const res = await fetch(`/api/streams/${streamId}`);
        if (res.ok) {
          const data = await res.json();
          if (data.stream?.totalGiftCoins !== undefined) {
            setSessionGiftsTotal(data.stream.totalGiftCoins);
          }
        }
      } catch (err) {
        console.error("Failed to poll gift total:", err);
      }
    };

    pollGiftTotal();
    const interval = setInterval(pollGiftTotal, 5000);
    return () => clearInterval(interval);
  }, [streamId]);

  // Handle incoming gift event (from SSE)
  const handleGiftEvent = useCallback(
    (eventData: any) => {
      if (eventData.type === "GIFT_SENT") {
        const giftItem: IncomingGift = {
          id: `${Date.now()}-${Math.random()}`,
          senderName: eventData.sender?.username || "A viewer",
          giftName: eventData.gift?.name || "Gift",
          giftAsset: eventData.gift?.assetUrl || "/gifts/heart.svg",
          coins: eventData.totalCoinAmount || 10,
        };

        setSessionGiftsTotal((prev) => prev + giftItem.coins);
        setRecentGifts((prev) => [giftItem, ...prev.slice(0, 4)]);
        setActiveGiftAnimation(giftItem);
        triggerConfetti();

        setTimeout(() => {
          setActiveGiftAnimation((curr) => (curr?.id === giftItem.id ? null : curr));
        }, 4000);
      }
    },
    [triggerConfetti]
  );

  const handleGiftEventRef = useRef(handleGiftEvent);
  handleGiftEventRef.current = handleGiftEvent;

  // Initialize Media Devices & Connect to Janus Gateway
  useEffect(() => {
    let isMounted = true;
    let eventSource: EventSource | null = null;

    async function initJanusBroadcaster() {
      try {
        let stream: MediaStream | null = null;
        let virtualActive = false;

        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { width: { ideal: 1280 }, height: { ideal: 720 } },
            audio: true,
          });
        } catch (mediaErr: any) {
          console.warn("Full getUserMedia failed, attempting video-only:", mediaErr);
          try {
            stream = await navigator.mediaDevices.getUserMedia({
              video: { width: { ideal: 1280 }, height: { ideal: 720 } },
              audio: false,
            });
          } catch (videoErr: any) {
            console.warn("Webcam not available, launching Virtual Studio Stream:", videoErr);
            stream = createVirtualStudioStream(title);
            virtualActive = true;
          }
        }

        // Apply initial camera/microphone enabled state (preserving state across refreshes)
        const initialCam = typeof window !== "undefined" && sessionStorage.getItem(`broadcaster_cam_${streamId}`) === "false" ? false : camEnabled;
        const initialMic = typeof window !== "undefined" && sessionStorage.getItem(`broadcaster_mic_${streamId}`) === "false" ? false : micEnabled;

        if (!initialCam) {
          stream.getVideoTracks().forEach((track) => {
            track.enabled = false;
          });
          if ((stream as any).setCamActive) {
            (stream as any).setCamActive(false);
          }
        }
        if (!initialMic) {
          stream.getAudioTracks().forEach((track) => {
            track.enabled = false;
          });
        }

        localStreamRef.current = stream;
        if (isMounted) {
          setIsVirtualCam(virtualActive);
          setCamEnabled(initialCam);
          setMicEnabled(initialMic);
        }

        if (videoRef.current && isMounted && stream) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch((err) => console.warn("Local camera preview play error:", err));
        }

        // Connect to Janus Gateway VideoRoom
        const numericRoom = getJanusRoomId(streamId);
        const janusSession = new JanusBroadcasterSession({
          wsUrl: `ws://${window.location.hostname}:8188`,
          room: numericRoom,
          displayName: title || "Broadcaster",
          stream,
          onJoined: () => {
            if (isMounted) {
              setError(null);
            }
          },
          onError: (err) => {
            if (isMounted) {
              console.error("Janus broadcaster error:", err);
              setError(err.message || "Janus WebRTC gateway notice");
            }
          },
          onStreamEnded: () => {
            if (isMounted) onStreamEnded();
          },
        });

        janusSessionRef.current = janusSession;
        await janusSession.start();

        // Apply media states to Janus session
        if (!initialCam) {
          await janusSession.setVideoEnabled(false);
        }
        if (!initialMic) {
          await janusSession.setAudioEnabled(false);
        }

        // Broadcast current status to all viewers so new/refreshing viewers get the right status
        fetch("/api/streams/status", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            roomName,
            camEnabled: initialCam,
            micEnabled: initialMic,
          }),
        }).catch(() => {});

        // Subscribe to real-time events via Server-Sent Events (SSE) for gifts
        eventSource = new EventSource(`/api/mediasoup/events?roomName=${encodeURIComponent(roomName)}`);
        eventSource.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === "GIFT_SENT") {
              handleGiftEventRef.current(data);
            } else if (data.type === "VIEWER_COUNT") {
              setViewerCount(data.count || 0);
            }
          } catch (err) {
            console.error("SSE parse error:", err);
          }
        };

        if (isMounted) {
          setError(null);
        }
      } catch (err: any) {
        if (!isMounted) return;
        console.error("Janus initialization error:", err);
        setError(err.message || "Failed to initialize Janus broadcaster");
      }
    }

    initJanusBroadcaster();

    return () => {
      isMounted = false;
      if (eventSource) {
        eventSource.close();
      }
      if (localStreamRef.current) {
        if ((localStreamRef.current as any)._cleanup) {
          (localStreamRef.current as any)._cleanup();
        }
        localStreamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (janusSessionRef.current) {
        janusSessionRef.current.destroy();
      }
    };
  }, [streamId, roomName, title, onStreamEnded]);

  // Toggle Video Source between Physical Webcam and Virtual Studio Cam
  const toggleVideoSource = async () => {
    try {
      let newStream: MediaStream;
      if (isVirtualCam) {
        newStream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 } },
        });
        setIsVirtualCam(false);
      } else {
        newStream = createVirtualStudioStream(title);
        setIsVirtualCam(true);
      }

      // Cleanup old stream
      if (localStreamRef.current) {
        if ((localStreamRef.current as any)._cleanup) {
          (localStreamRef.current as any)._cleanup();
        }
        localStreamRef.current.getVideoTracks().forEach((t) => t.stop());
      }

      localStreamRef.current = newStream;
      if (videoRef.current) {
        videoRef.current.srcObject = newStream;
        videoRef.current.play().catch(() => {});
      }

      // Hot-swap track in Janus PeerConnection
      const newVideoTrack = newStream.getVideoTracks()[0];
      if (newVideoTrack && janusSessionRef.current) {
        await janusSessionRef.current.replaceVideoTrack(newVideoTrack);
      }
    } catch (err: any) {
      console.warn("Toggle video source notice:", err);
      setError(`Cannot switch source: ${err.message || "Device unavailable"}`);
    }
  };

  // Toggle Microphone (Audio On/Off)
  const toggleMic = async () => {
    const nextState = !micEnabled;
    setMicEnabled(nextState);
    if (typeof window !== "undefined") {
      sessionStorage.setItem(`broadcaster_mic_${streamId}`, String(nextState));
    }

    // 1. Update client-side local tracks
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach((track) => {
        track.enabled = nextState;
      });
    }

    // 2. Update Janus SFU forwarding state & RTCPeerConnection sender
    if (janusSessionRef.current) {
      await janusSessionRef.current.setAudioEnabled(nextState);
    }

    // 3. Broadcast real-time status event to all viewers in the room
    fetch("/api/streams/status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        roomName,
        camEnabled,
        micEnabled: nextState,
      }),
    }).catch(() => {});
  };

  // Toggle Camera (Video On/Off)
  const toggleCam = async () => {
    const nextState = !camEnabled;
    setCamEnabled(nextState);
    if (typeof window !== "undefined") {
      sessionStorage.setItem(`broadcaster_cam_${streamId}`, String(nextState));
    }

    // 1. Update client-side local tracks
    if (localStreamRef.current) {
      localStreamRef.current.getVideoTracks().forEach((track) => {
        track.enabled = nextState;
      });
      if ((localStreamRef.current as any).setCamActive) {
        (localStreamRef.current as any).setCamActive(nextState);
      }
    }

    // 2. Update Janus SFU forwarding state & RTCPeerConnection sender
    if (janusSessionRef.current) {
      await janusSessionRef.current.setVideoEnabled(nextState);
    }

    // 3. Broadcast real-time status event to all viewers in the room
    fetch("/api/streams/status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        roomName,
        camEnabled: nextState,
        micEnabled,
      }),
    }).catch(() => {});
  };

  // End Broadcast
  const handleEndBroadcast = async () => {
    if (!confirm("Are you sure you want to end your live broadcast?")) return;
    setEnding(true);

    try {
      await fetch(`/api/streams/${streamId}/end`, { method: "POST" });
      if (janusSessionRef.current) {
        janusSessionRef.current.destroy();
      }
      onStreamEnded();
    } catch (err) {
      console.error("Error ending stream:", err);
      onStreamEnded();
    }
  };

  return (
    <div className="relative w-full max-w-4xl mx-auto h-[88vh] max-h-[900px] bg-black rounded-3xl overflow-hidden shadow-2xl border border-white/10 flex flex-col justify-between">
      {/* Video Display Area */}
      <div className="relative flex-1 bg-black flex items-center justify-center overflow-hidden">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={`w-full h-full ${
            fitMode === "cover" ? "object-cover" : "object-contain"
          } transition-opacity duration-300 ${
            camEnabled ? "opacity-100" : "opacity-0"
          }`}
        />

        {/* Quick Framing / Fit Toggle */}
        <button
          onClick={() => setFitMode((prev) => (prev === "contain" ? "cover" : "contain"))}
          className="absolute top-4 right-4 z-20 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/60 hover:bg-black/80 backdrop-blur-md border border-white/10 text-white text-[10px] font-bold opacity-75 hover:opacity-100 transition-all cursor-pointer shadow-lg"
          title="Toggle camera framing: Fit (no crop) vs Fill (crop)"
        >
          <Maximize2 className="w-3 h-3 text-[#FF2E93]" />
          <span className="uppercase text-[9px]">{fitMode === "contain" ? "Fit (No Crop)" : "Fill (Crop)"}</span>
        </button>

        {/* Camera Off Placeholder Overlay */}
        {!camEnabled && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-[#090a10]/95 text-zinc-400 p-6 text-center animate-gift-pop">
            <div className="w-16 h-16 rounded-3xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-[#FF2E93] mb-3 animate-pulse shadow-xl">
              <VideoOff className="w-8 h-8" />
            </div>
            <p className="text-base font-black text-white mb-1">Camera is Turned Off</p>
            <p className="text-xs text-zinc-400 max-w-xs mb-4">
              Your video stream is currently paused. Viewers see a paused status.
            </p>
            <button
              onClick={toggleCam}
              className="px-5 py-2.5 rounded-2xl text-xs font-black text-white tango-gradient-btn transition-all cursor-pointer shadow-lg hover:scale-105"
            >
              Turn Camera Back On
            </button>
          </div>
        )}

        {/* Mic Muted Badge in Video Area */}
        {!micEnabled && (
          <div className="absolute top-20 right-4 z-20 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-rose-600/90 text-white text-xs font-bold shadow-lg animate-pulse">
            <MicOff className="w-3.5 h-3.5" />
            <span>Microphone Muted</span>
          </div>
        )}
      </div>

      {/* Top Overlay Header: Studio Performance Dashboard */}
      <div className="absolute top-0 inset-x-0 p-3 sm:p-5 bg-gradient-to-b from-black/85 via-black/40 to-transparent flex items-start justify-between z-30 pointer-events-none">
        <div className="flex flex-col gap-1.5 pointer-events-auto">
          <div className="flex items-center gap-2">
            {/* Live Indicator + Timer */}
            <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-gradient-to-r from-[#FF007A] to-[#FF2E93] text-white shadow-lg animate-pulse">
              <Radio className="w-3.5 h-3.5" />
              <span>LIVE {formatDuration(secondsLive)}</span>
            </span>

            {/* Top Contributors Avatar Bubbles */}
            <TopContributorsBubbleRow
              streamId={streamId}
              onClick={() => setShowAudienceModal(true)}
            />

            {/* Viewer Count */}
            <button
              onClick={() => setShowAudienceModal(true)}
              className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-black/60 hover:bg-black/85 border border-white/10 backdrop-blur-md text-white cursor-pointer hover:scale-105 transition-all shadow-md"
              title="View Live Audience & Top Contributors"
            >
              <Eye className="w-3.5 h-3.5 text-zinc-300" />
              <span>{viewerCount} Viewers</span>
            </button>

            {/* Janus Server Badge */}
            <div className="hidden sm:flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">
              <Server className="w-3 h-3 text-blue-400" />
              <span>Janus SFU</span>
            </div>

            {/* Camera Source Switcher */}
            <button
              onClick={toggleVideoSource}
              className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/30 transition-all cursor-pointer pointer-events-auto"
              title="Click to switch between Webcam & Virtual Studio Cam"
            >
              {isVirtualCam ? (
                <>
                  <MonitorPlay className="w-3 h-3 text-emerald-400" />
                  <span>Virtual Studio Feed</span>
                </>
              ) : (
                <>
                  <Camera className="w-3 h-3 text-emerald-400" />
                  <span>Webcam</span>
                </>
              )}
            </button>
          </div>
          <h2 className="text-base font-black text-white drop-shadow-md line-clamp-1 mt-0.5">
            {title}
          </h2>
        </div>

        {/* Total Gift Coins Earned in Session */}
        <button
          onClick={() => setShowAudienceModal(true)}
          className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 font-black text-xs sm:text-sm backdrop-blur-md shadow-lg pointer-events-auto cursor-pointer transition-all hover:scale-105"
          title="View Top Contributors Leaderboard"
        >
          <Coins className="w-4 h-4 text-amber-400 fill-amber-400" />
          <span>+{sessionGiftsTotal.toLocaleString()} Coins</span>
        </button>
      </div>

      {/* Notice / Warning banner if any */}
      {error && (
        <div className="absolute top-20 inset-x-4 z-40 p-2.5 rounded-2xl bg-amber-500/20 border border-amber-500/30 text-amber-200 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>{error}</span>
          </div>
        </div>
      )}

      {/* Floating Animated Gift Banner in Live Stream */}
      {activeGiftAnimation && (
        <div className="absolute top-1/3 inset-x-0 flex items-center justify-center z-40 pointer-events-none">
          <div className="animate-gift-pop flex items-center gap-4 px-6 py-4 rounded-3xl bg-black/90 border-2 border-[#FF007A] shadow-[0_0_60px_rgba(255,0,122,0.8)] backdrop-blur-xl">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={activeGiftAnimation.giftAsset}
              alt={activeGiftAnimation.giftName}
              className="w-16 h-16 object-contain animate-bounce"
            />
            <div>
              <div className="flex items-center gap-1 text-[#FF2E93] text-xs font-black uppercase tracking-wider">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Gift Received!</span>
              </div>
              <p className="text-white font-black text-xl">
                {activeGiftAnimation.senderName}
              </p>
              <p className="text-amber-400 text-sm font-bold">
                Sent a {activeGiftAnimation.giftName} (+{activeGiftAnimation.coins} coins)
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Real-time Tango Live Chat Stream, Reactions & Broadcaster Moderation */}
      <LiveChat
        roomName={roomName}
        streamId={streamId}
        isBroadcaster={true}
        bottomClass="bottom-24"
        currentUser={user}
      />

      {/* Bottom Broadcaster Control Bar with Live Indicators */}
      <div className="absolute bottom-0 inset-x-0 p-4 sm:p-5 bg-gradient-to-t from-black/95 via-black/60 to-transparent flex items-center justify-between z-30">
        <div className="flex items-center gap-3">
          {/* Mute/Unmute Mic Toggle */}
          <button
            onClick={toggleMic}
            className={`flex items-center gap-2 px-4 py-3 rounded-2xl backdrop-blur-md transition-all cursor-pointer font-bold text-xs ${
              micEnabled
                ? "bg-white/10 hover:bg-white/20 text-white border border-white/10 shadow-lg"
                : "bg-rose-600 hover:bg-rose-700 text-white shadow-lg shadow-rose-600/30 scale-105"
            }`}
            title={micEnabled ? "Click to Mute Microphone" : "Click to Unmute Microphone"}
          >
            {micEnabled ? (
              <>
                <Mic className="w-4 h-4 text-emerald-400" />
                <span className="hidden sm:inline">Mic On</span>
              </>
            ) : (
              <>
                <MicOff className="w-4 h-4 text-white" />
                <span>Mic Muted</span>
              </>
            )}
          </button>

          {/* Enable/Disable Camera Toggle */}
          <button
            onClick={toggleCam}
            className={`flex items-center gap-2 px-4 py-3 rounded-2xl backdrop-blur-md transition-all cursor-pointer font-bold text-xs ${
              camEnabled
                ? "bg-white/10 hover:bg-white/20 text-white border border-white/10 shadow-lg"
                : "bg-rose-600 hover:bg-rose-700 text-white shadow-lg shadow-rose-600/30 scale-105"
            }`}
            title={camEnabled ? "Click to Turn Off Camera" : "Click to Turn On Camera"}
          >
            {camEnabled ? (
              <>
                <Video className="w-4 h-4 text-emerald-400" />
                <span className="hidden sm:inline">Cam On</span>
              </>
            ) : (
              <>
                <VideoOff className="w-4 h-4 text-white" />
                <span>Cam Off</span>
              </>
            )}
          </button>

          {/* Switch Source Button */}
          <button
            onClick={toggleVideoSource}
            className="flex items-center gap-2 px-3.5 py-3 rounded-2xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold border border-white/10 backdrop-blur-md transition-all cursor-pointer"
            title="Switch Video Source"
          >
            {isVirtualCam ? (
              <>
                <Camera className="w-4 h-4 text-[#FF2E93]" />
                <span className="hidden sm:inline">Use Webcam</span>
              </>
            ) : (
              <>
                <MonitorPlay className="w-4 h-4 text-emerald-400" />
                <span className="hidden sm:inline">Studio Canvas</span>
              </>
            )}
          </button>
        </div>

        {/* End Stream Button */}
        <button
          onClick={handleEndBroadcast}
          disabled={ending}
          className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white font-black text-xs sm:text-sm shadow-xl shadow-rose-600/30 transition-all hover:scale-105 active:scale-95 cursor-pointer disabled:opacity-50"
        >
          <PhoneOff className="w-4 h-4" />
          <span>{ending ? "Wrapping up..." : "End Broadcast"}</span>
        </button>
      </div>

      {/* Live Audience & Top Contributors Modal */}
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
