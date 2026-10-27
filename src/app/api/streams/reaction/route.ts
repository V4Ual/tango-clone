import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { MediasoupService } from "@/lib/mediasoup";

const ALLOWED_EMOJIS = ["❤️", "🔥", "🎉", "👏", "💎", "😍", "⭐", "🚀"];

export async function POST(request: Request) {
  try {
    const user = await getSessionUser();
    const { roomName, emoji } = await request.json();

    if (!roomName || !emoji || !ALLOWED_EMOJIS.includes(emoji)) {
      return NextResponse.json({ error: "Invalid reaction request" }, { status: 400 });
    }

    const username = user?.username || "A viewer";

    MediasoupService.broadcastEvent(roomName, {
      type: "QUICK_REACTION",
      emoji,
      username,
      id: `${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
