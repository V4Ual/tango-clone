import { NextResponse } from "next/server";
import { MediasoupService } from "@/lib/mediasoup";
import { getSessionUser } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { roomName, transportId, dtlsParameters } = await request.json();
    if (!roomName || !transportId || !dtlsParameters) {
      return NextResponse.json({ error: "Missing required parameters" }, { status: 400 });
    }

    const result = await MediasoupService.connectTransport(
      roomName,
      transportId,
      dtlsParameters
    );
    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Connect transport error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
