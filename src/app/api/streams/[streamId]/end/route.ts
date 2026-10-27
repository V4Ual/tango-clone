import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { StreamService } from "@/services/stream.service";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ streamId: string }> }
) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { streamId } = await params;
    const updatedStream = await StreamService.endStream(streamId, user.id);

    return NextResponse.json({
      message: "Stream ended successfully",
      stream: updatedStream,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to end stream";
    console.error("Error ending stream:", error);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
