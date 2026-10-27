import { NextResponse } from "next/server";
import { MediasoupService } from "@/lib/mediasoup";
import { prisma } from "@/lib/prisma";

// Global in-memory status store to ensure status persists across page refreshes and route invocations
const globalForStatus = globalThis as unknown as {
  streamStatusMap?: Map<string, { camEnabled: boolean; micEnabled: boolean; updatedAt: number }>;
};

if (!globalForStatus.streamStatusMap) {
  globalForStatus.streamStatusMap = new Map();
}

export async function POST(request: Request) {
  try {
    const { roomName, camEnabled, micEnabled } = await request.json();
    if (!roomName) {
      return NextResponse.json({ error: "Missing roomName" }, { status: 400 });
    }

    const currentCam = camEnabled !== undefined ? Boolean(camEnabled) : true;
    const currentMic = micEnabled !== undefined ? Boolean(micEnabled) : true;

    // Save in persistent global status registry
    globalForStatus.streamStatusMap!.set(roomName, {
      camEnabled: currentCam,
      micEnabled: currentMic,
      updatedAt: Date.now(),
    });

    // Also broadcast to all active SSE subscribers
    MediasoupService.broadcastEvent(roomName, {
      type: "STREAM_STATUS",
      camEnabled: currentCam,
      micEnabled: currentMic,
    });

    return NextResponse.json({
      success: true,
      camEnabled: currentCam,
      micEnabled: currentMic,
    });
  } catch (err: any) {
    console.error("Stream status broadcast error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const roomName = searchParams.get("roomName");
    if (!roomName) {
      return NextResponse.json({ error: "Missing roomName" }, { status: 400 });
    }

    // Check database stream status
    let isStreamEnded = false;
    try {
      const stream = await prisma.liveStream.findFirst({
        where: { roomName },
        select: { status: true },
      });
      if (stream && stream.status === "ended") {
        isStreamEnded = true;
      }
    } catch {
      // Ignore DB query errors gracefully
    }

    if (isStreamEnded) {
      return NextResponse.json({
        isEnded: true,
        isLive: false,
        status: "ended",
        camEnabled: false,
        micEnabled: false,
      });
    }

    // Check persistent global status registry first
    const savedStatus = globalForStatus.streamStatusMap?.get(roomName);
    if (savedStatus) {
      return NextResponse.json({
        isEnded: false,
        isLive: true,
        camEnabled: savedStatus.camEnabled,
        micEnabled: savedStatus.micEnabled,
      });
    }

    // Fallback to room state
    const globalForMediasoup = globalThis as any;
    const room = globalForMediasoup.mediasoupRooms?.get(roomName);
    return NextResponse.json({
      isEnded: false,
      isLive: Boolean(room && room.viewerCount > 0),
      camEnabled: room?.camEnabled ?? true,
      micEnabled: room?.micEnabled ?? true,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
