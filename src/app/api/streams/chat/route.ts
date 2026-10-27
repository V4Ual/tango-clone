import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { MediasoupService } from "@/lib/mediasoup";

export interface LiveChatMessage {
  id: string;
  streamId: string;
  senderId: string;
  senderUsername: string;
  senderAvatarUrl?: string | null;
  text: string;
  badge: "creator" | "top_gifter" | "viewer" | "system";
  timestamp: number;
}

// Global in-memory chat cache (last 50 messages per room)
const globalForChat = globalThis as unknown as {
  chatHistoryMap?: Map<string, LiveChatMessage[]>;
  pinnedMessageMap?: Map<string, string | null>;
};

if (!globalForChat.chatHistoryMap) {
  globalForChat.chatHistoryMap = new Map();
}
if (!globalForChat.pinnedMessageMap) {
  globalForChat.pinnedMessageMap = new Map();
}

export async function POST(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized. Please sign in to chat." }, { status: 401 });
    }

    const { roomName, streamId, text, action, pinnedText } = await request.json();
    if (!roomName) {
      return NextResponse.json({ error: "Missing roomName" }, { status: 400 });
    }

    // Handle Broadcaster Pin Action
    if (action === "PIN") {
      const stream = await prisma.liveStream.findUnique({
        where: { roomName },
        select: { broadcasterId: true },
      });

      if (!stream || stream.broadcasterId !== user.id) {
        return NextResponse.json({ error: "Only the broadcaster can pin messages" }, { status: 403 });
      }

      const pinContent = pinnedText ? String(pinnedText).trim().slice(0, 150) : null;
      globalForChat.pinnedMessageMap!.set(roomName, pinContent);

      MediasoupService.broadcastEvent(roomName, {
        type: "PIN_MESSAGE",
        pinnedText: pinContent,
      });

      return NextResponse.json({ success: true, pinnedText: pinContent });
    }

    // Standard Chat Message
    if (!text || typeof text !== "string" || !text.trim()) {
      return NextResponse.json({ error: "Message cannot be empty" }, { status: 400 });
    }

    const stream = await prisma.liveStream.findUnique({
      where: { roomName },
      select: { id: true, broadcasterId: true },
    });

    if (!stream) {
      return NextResponse.json({ error: "Stream not found" }, { status: 404 });
    }

    const isCreator = stream.broadcasterId === user.id;

    // Check if user has gifted in this stream
    let isTopGifter = false;
    if (!isCreator) {
      const giftTotal = await prisma.giftTransaction.aggregate({
        where: { liveStreamId: stream.id, senderId: user.id },
        _sum: { totalCoinAmount: true },
      });
      isTopGifter = (giftTotal._sum.totalCoinAmount ?? 0) > 0;
    }

    const chatMessage: LiveChatMessage = {
      id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      streamId: stream.id,
      senderId: user.id,
      senderUsername: user.username,
      senderAvatarUrl: user.avatarUrl,
      text: text.trim().slice(0, 250),
      badge: isCreator ? "creator" : isTopGifter ? "top_gifter" : "viewer",
      timestamp: Date.now(),
    };

    // Buffer in chat history
    let history = globalForChat.chatHistoryMap!.get(roomName);
    if (!history) {
      history = [];
      globalForChat.chatHistoryMap!.set(roomName, history);
    }
    history.push(chatMessage);
    if (history.length > 50) {
      history.shift();
    }

    // Broadcast in real-time
    MediasoupService.broadcastEvent(roomName, {
      type: "CHAT_MESSAGE",
      message: chatMessage,
    });

    return NextResponse.json({ success: true, message: chatMessage });
  } catch (err: any) {
    console.error("Live chat error:", err);
    return NextResponse.json({ error: err.message || "Failed to send message" }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const roomName = searchParams.get("roomName");
    if (!roomName) {
      return NextResponse.json({ error: "Missing roomName" }, { status: 400 });
    }

    const messages = globalForChat.chatHistoryMap?.get(roomName) || [];
    const pinnedText = globalForChat.pinnedMessageMap?.get(roomName) || null;

    return NextResponse.json({
      messages,
      pinnedText,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
