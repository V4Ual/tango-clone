import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { StreamService } from "@/services/stream.service";
import { createStreamSchema } from "@/lib/validation";

export async function GET() {
  try {
    const streams = await StreamService.getActiveStreams();
    return NextResponse.json({ streams });
  } catch (error) {
    console.error("Error fetching streams:", error);
    return NextResponse.json({ error: "Failed to fetch active streams" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const validatedData = createStreamSchema.safeParse(body);

    if (!validatedData.success) {
      return NextResponse.json(
        { error: "Validation failed", details: validatedData.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const stream = await StreamService.createStream({
      broadcasterId: user.id,
      title: validatedData.data.title,
    });

    return NextResponse.json({ stream }, { status: 201 });
  } catch (error) {
    console.error("Error creating stream:", error);
    return NextResponse.json({ error: "Failed to create stream" }, { status: 500 });
  }
}
