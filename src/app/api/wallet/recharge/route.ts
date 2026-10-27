import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { amount } = await request.json();
    const refillAmount = typeof amount === "number" && amount > 0 ? Math.min(amount, 5000) : 1000;

    const wallet = await prisma.wallet.update({
      where: { userId: user.id },
      data: {
        coinBalance: {
          increment: refillAmount,
        },
      },
    });

    return NextResponse.json({
      success: true,
      coinBalance: wallet.coinBalance,
      added: refillAmount,
    });
  } catch (err: any) {
    console.error("Wallet recharge error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
