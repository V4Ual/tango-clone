"use client";

import React, { useEffect, useState, Suspense } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/AuthContext";
import { ViewerRoom } from "@/components/live/ViewerRoom";
import { Loader2, AlertCircle, ArrowLeft, ShieldAlert } from "lucide-react";
import Link from "next/link";

interface StreamDetails {
  id: string;
  roomName: string;
  title: string;
  status: string;
  broadcaster: {
    id: string;
    username: string;
    avatarUrl: string | null;
  };
}

function WatchLiveContent() {
  const params = useParams();
  const router = useRouter();
  const streamId = params?.streamId as string;
  const { user, loading: authLoading } = useAuth();

  const [stream, setStream] = useState<StreamDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!streamId) return;

    async function loadStream() {
      try {
        setLoading(true);
        setError(null);

        const streamRes = await fetch(`/api/streams/${streamId}`);
        const streamData = await streamRes.json();

        if (!streamRes.ok) {
          setError(streamData.error || "Broadcast not found");
          setLoading(false);
          return;
        }

        setStream(streamData.stream);
      } catch (err) {
        console.error("Error loading stream:", err);
        setError("Failed to connect to stream");
      } finally {
        setLoading(false);
      }
    }

    if (!authLoading) {
      loadStream();
    }
  }, [streamId, authLoading]);

  if (authLoading || loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8">
        <Loader2 className="w-10 h-10 animate-spin text-rose-500 mb-3" />
        <p className="text-zinc-400 text-sm">Joining live room...</p>
      </div>
    );
  }

  // PRD Section 3.A: Unauthenticated users must log in before joining broadcast / sending gifts
  if (!user) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="max-w-md w-full p-8 rounded-3xl glass-panel text-center border border-white/10 shadow-2xl">
          <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mx-auto mb-4 text-rose-500">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Log In to Watch & Gift</h2>
          <p className="text-zinc-400 text-sm mb-6">
            Sign in to watch @{stream?.broadcaster.username || "creator"}&apos;s live stream, participate, and send gifts!
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
              className="px-5 py-2.5 rounded-xl font-semibold text-sm bg-rose-500 hover:bg-rose-600 text-white"
            >
              Register & Get Coins
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (error || !stream) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="max-w-md w-full p-8 rounded-3xl glass-panel text-center border border-white/10 shadow-2xl">
          <AlertCircle className="w-12 h-12 text-rose-500 mx-auto mb-3" />
          <h2 className="text-xl font-bold text-white mb-2">Unable to Load Stream</h2>
          <p className="text-zinc-400 text-sm mb-6">{error || "Stream not available"}</p>
          <button
            onClick={() => router.push("/live")}
            className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl font-semibold text-sm bg-zinc-800 hover:bg-zinc-700 text-white cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Return to Streams</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-40 overflow-hidden bg-[#07080d] flex flex-col">
      <ViewerRoom
        streamId={stream.id}
        roomName={stream.roomName}
        title={stream.title}
        broadcaster={stream.broadcaster}
        initialStatus={stream.status}
      />
    </div>
  );
}

export default function WatchLivePage() {
  return (
    <Suspense
      fallback={
        <div className="flex-1 flex flex-col items-center justify-center p-8">
          <Loader2 className="w-10 h-10 animate-spin text-rose-500 mb-3" />
          <p className="text-zinc-400 text-sm">Loading live room...</p>
        </div>
      }
    >
      <WatchLiveContent />
    </Suspense>
  );
}
