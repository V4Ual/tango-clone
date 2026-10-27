import { NextResponse } from "next/server";
import { MediasoupService } from "@/lib/mediasoup";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { roomName, transportId, kind, rtpParameters } = await request.json();
    if (!roomName || !transportId || !kind || !rtpParameters) {
      return NextResponse.json({ error: "Missing required parameters" }, { status: 400 });
    }

    // Verify user is the broadcaster of this room
    const stream = await prisma.liveStream.findUnique({
      where: { roomName },
    });

    if (!stream || stream.broadcasterId !== user.id) {
      return NextResponse.json({ error: "Only the broadcaster can publish tracks" }, { status: 403 });
    }

    const producer = await MediasoupService.produce(
      roomName,
      transportId,
      kind,
      rtpParameters
    );

    return NextResponse.json(producer);
  } catch (error: any) {
    console.error("Produce track error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
