import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { GiftService } from "@/services/gift.service";
import { MediasoupService } from "@/lib/mediasoup";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ streamId: string }> }
) {
  try {
    const { streamId } = await params;
    const stream = await prisma.liveStream.findUnique({
      where: { id: streamId },
      select: { id: true, roomName: true, broadcasterId: true },
    });

    if (!stream) {
      return NextResponse.json({ error: "Stream not found" }, { status: 404 });
    }

    const topContributors = await GiftService.getTopContributors(streamId, 10);
    const viewerCount = MediasoupService.getRoomViewerCount(stream.roomName);

    return NextResponse.json({
      viewerCount: Math.max(1, viewerCount),
      topContributors,
    });
  } catch (error: any) {
    console.error("Error fetching viewers:", error);
    return NextResponse.json({ error: "Failed to fetch stream audience" }, { status: 500 });
  }
}
