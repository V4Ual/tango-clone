import { NextResponse } from "next/server";
import { GiftService } from "@/services/gift.service";

export async function GET() {
  try {
    const gifts = await GiftService.getAvailableGifts();
    return NextResponse.json({ gifts });
  } catch (error) {
    console.error("Error fetching gifts:", error);
    return NextResponse.json({ error: "Failed to fetch gift catalog" }, { status: 500 });
  }
}
