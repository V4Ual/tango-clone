import { NextResponse } from "next/server";
import { MediasoupService } from "@/lib/mediasoup";
import { getSessionUser } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { roomName } = await request.json();
    if (!roomName) {
      return NextResponse.json({ error: "Missing roomName" }, { status: 400 });
    }

    const transportOptions = await MediasoupService.createWebRtcTransport(roomName);
    return NextResponse.json(transportOptions);
  } catch (error: any) {
    console.error("Create transport error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
