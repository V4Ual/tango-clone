import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { WalletService } from "@/services/wallet.service";

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const coinBalance = await WalletService.getBalance(user.id);
    return NextResponse.json({
      coinBalance,
      userId: user.id,
    });
  } catch (error) {
    console.error("Wallet fetch error:", error);
    return NextResponse.json({ error: "Failed to fetch wallet" }, { status: 500 });
  }
}
