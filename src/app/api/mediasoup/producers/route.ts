import { NextResponse } from "next/server";
import { MediasoupService } from "@/lib/mediasoup";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const roomName = searchParams.get("roomName");

    if (!roomName) {
      return NextResponse.json({ error: "Missing roomName" }, { status: 400 });
    }

    const producers = await MediasoupService.getRoomProducers(roomName);
    return NextResponse.json({ producers });
  } catch (error: any) {
    console.error("Get producers error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
