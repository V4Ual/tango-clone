import { NextResponse } from "next/server";
import { MediasoupService } from "@/lib/mediasoup";

export async function POST(request: Request) {
  try {
    const { roomName, consumerId } = await request.json();
    if (!roomName) {
      return NextResponse.json({ error: "Missing roomName" }, { status: 400 });
    }

    await MediasoupService.requestKeyFrame(roomName, consumerId);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Request keyframe error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
