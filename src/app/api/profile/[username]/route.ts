import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ username: string }> }
) {
  try {
    const { username } = await params;
    const currentUser = await getSessionUser();

    const user = await prisma.user.findFirst({
      where: {
        username: { equals: username, mode: "insensitive" },
      },
      select: {
        id: true,
        username: true,
        avatarUrl: true,
        createdAt: true,
        wallet: {
          select: {
            coinBalance: true,
          },
        },
        _count: {
          select: {
            streams: true,
            sentTransactions: true,
            receivedTransactions: true,
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Aggregate total coins received from gifts
    const receivedAggregate = await prisma.giftTransaction.aggregate({
      where: { broadcasterId: user.id },
      _sum: { totalCoinAmount: true },
    });

    // Aggregate total coins spent on gifts
    const sentAggregate = await prisma.giftTransaction.aggregate({
      where: { senderId: user.id },
      _sum: { totalCoinAmount: true },
    });

    return NextResponse.json({
      user: {
        id: user.id,
        username: user.username,
        avatarUrl: user.avatarUrl,
        createdAt: user.createdAt,
        coinBalance: user.wallet?.coinBalance ?? 0,
        totalBroadcasts: user._count.streams,
        totalGiftsSent: user._count.sentTransactions,
        totalGiftsReceived: user._count.receivedTransactions,
        totalCoinsEarned: receivedAggregate._sum.totalCoinAmount ?? 0,
        totalCoinsSpent: sentAggregate._sum.totalCoinAmount ?? 0,
        isSelf: currentUser?.id === user.id,
      },
    });
  } catch (error) {
    console.error("Profile fetch error:", error);
    return NextResponse.json({ error: "Failed to fetch profile" }, { status: 500 });
  }
}
