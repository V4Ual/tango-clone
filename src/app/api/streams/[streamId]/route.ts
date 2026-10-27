import { NextResponse } from "next/server";
import { StreamService } from "@/services/stream.service";
import { GiftService } from "@/services/gift.service";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ streamId: string }> }
) {
  try {
    const { streamId } = await params;
    const stream = await StreamService.getStreamById(streamId);

    if (!stream) {
      return NextResponse.json({ error: "Stream not found" }, { status: 404 });
    }

    const totalGiftCoins = await GiftService.getStreamGiftTotal(streamId);

    return NextResponse.json({
      stream: {
        ...stream,
        totalGiftCoins,
      },
    });
  } catch (error) {
    console.error("Error fetching stream:", error);
    return NextResponse.json({ error: "Failed to fetch stream details" }, { status: 500 });
  }
}
