import { NextResponse } from "next/server";
import { MediasoupService } from "@/lib/mediasoup";
import { getSessionUser } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { roomName, transportId, producerId, rtpCapabilities } = await request.json();
    if (!roomName || !transportId || !producerId || !rtpCapabilities) {
      return NextResponse.json({ error: "Missing required parameters" }, { status: 400 });
    }

    const consumer = await MediasoupService.consume(
      roomName,
      transportId,
      producerId,
      rtpCapabilities
    );

    return NextResponse.json(consumer);
  } catch (error: any) {
    console.error("Consume track error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
