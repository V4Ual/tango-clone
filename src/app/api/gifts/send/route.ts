import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { GiftService } from "@/services/gift.service";
import { sendGiftSchema } from "@/lib/validation";

export async function POST(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized. Please log in to send gifts." }, { status: 401 });
    }

    const body = await request.json();
    const validatedData = sendGiftSchema.safeParse(body);

    if (!validatedData.success) {
      return NextResponse.json(
        { error: "Validation failed", details: validatedData.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { streamId, giftId, quantity } = validatedData.data;

    const result = await GiftService.sendGift({
      senderId: user.id,
      streamId,
      giftId,
      quantity,
    });

    return NextResponse.json({
      message: `Successfully sent ${quantity}x ${result.gift.name}!`,
      remainingBalance: result.remainingBalance,
      giftEvent: result.giftEvent,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to send gift";
    console.error("Gift send error:", error);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
