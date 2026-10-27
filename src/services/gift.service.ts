import { prisma } from "@/lib/prisma";
import { MediasoupService } from "@/lib/mediasoup";

export class GiftService {
  static async getAvailableGifts() {
    let gifts = await prisma.gift.findMany({
      where: { isActive: true },
      orderBy: { coinPrice: "asc" },
    });

    if (gifts.length < 10) {
      const TANGO_GIFTS = [
        { name: "Heart", coinPrice: 8, assetUrl: "❤️" },
        { name: "Strawberry", coinPrice: 59, assetUrl: "🍓" },
        { name: "Kiss Lips", coinPrice: 79, assetUrl: "💋" },
        { name: "Rose", coinPrice: 99, assetUrl: "🌹" },
        { name: "Teddy Bear", coinPrice: 89, assetUrl: "🧸" },
        { name: "Party GIF", coinPrice: 99, assetUrl: "🎬" },
        { name: "Sports Car", coinPrice: 129, assetUrl: "🏎️" },
        { name: "Bunny", coinPrice: 229, assetUrl: "🐰" },
        { name: "Camera", coinPrice: 79, assetUrl: "📹" },
        { name: "Big Kiss", coinPrice: 129, assetUrl: "😘" },
        { name: "Twin Hearts", coinPrice: 199, assetUrl: "💕" },
        { name: "Champagne", coinPrice: 299, assetUrl: "🍾" },
        { name: "Crystal Ball", coinPrice: 89, assetUrl: "🔮" },
        { name: "Gift Box", coinPrice: 399, assetUrl: "🎁" },
        { name: "Money Wings", coinPrice: 799, assetUrl: "💸" },
        { name: "Pearl Shell", coinPrice: 999, assetUrl: "🦪" },
        { name: "Heart Lock", coinPrice: 499, assetUrl: "🔒" },
        { name: "Flower Basket", coinPrice: 1499, assetUrl: "🧺" },
        { name: "Luxury Bouquet", coinPrice: 2999, assetUrl: "💐" },
        { name: "Golden Lion", coinPrice: 5999, assetUrl: "🦁" },
        { name: "Fire", coinPrice: 99, assetUrl: "🔥" },
        { name: "Sparkles", coinPrice: 199, assetUrl: "✨" },
        { name: "Red Lips", coinPrice: 279, assetUrl: "💄" },
        { name: "Rose Stem", coinPrice: 359, assetUrl: "🥀" },
        { name: "Golden Key", coinPrice: 799, assetUrl: "🗝️" },
        { name: "Money Stack", coinPrice: 999, assetUrl: "💰" },
        { name: "Golden Trophy", coinPrice: 3999, assetUrl: "🏆" },
      ];

      for (const g of TANGO_GIFTS) {
        await prisma.gift.upsert({
          where: { name: g.name },
          update: { coinPrice: g.coinPrice, assetUrl: g.assetUrl, isActive: true },
          create: { name: g.name, coinPrice: g.coinPrice, assetUrl: g.assetUrl, isActive: true },
        }).catch(() => {});
      }

      gifts = await prisma.gift.findMany({
        where: { isActive: true },
        orderBy: { coinPrice: "asc" },
      });
    }

    return gifts;
  }

  static async sendGift({
    senderId,
    streamId,
    giftId,
    quantity = 1,
  }: {
    senderId: string;
    streamId: string;
    giftId: string;
    quantity?: number;
  }) {
    if (quantity <= 0) {
      throw new Error("Quantity must be greater than zero");
    }

    // 1. Verify stream exists and is active
    const stream = await prisma.liveStream.findUnique({
      where: { id: streamId },
      include: { broadcaster: true },
    });

    if (!stream) {
      throw new Error("Stream not found");
    }

    if (stream.status !== "active") {
      throw new Error("Cannot send gifts to an ended stream");
    }

    // 2. Prevent sending gifts to self
    if (stream.broadcasterId === senderId) {
      throw new Error("Broadcasters cannot send gifts to themselves");
    }

    // 3. Find gift details
    const gift = await prisma.gift.findUnique({
      where: { id: giftId },
    });

    if (!gift || !gift.isActive) {
      throw new Error("Gift not found or inactive");
    }

    const totalCoinAmount = gift.coinPrice * quantity;

    // 4. Perform atomic database transaction
    const result = await prisma.$transaction(async (tx) => {
      // Find sender wallet with fresh query
      const senderWallet = await tx.wallet.findUnique({
        where: { userId: senderId },
      });

      if (!senderWallet || senderWallet.coinBalance < totalCoinAmount) {
        throw new Error(
          `Insufficient balance. You need ${totalCoinAmount} coins, but have ${
            senderWallet?.coinBalance ?? 0
          } coins.`
        );
      }

      // Deduct coins from sender wallet (atomic update condition)
      const updatedSenderWallet = await tx.wallet.update({
        where: { userId: senderId },
        data: {
          coinBalance: {
            decrement: totalCoinAmount,
          },
        },
      });

      if (updatedSenderWallet.coinBalance < 0) {
        throw new Error("Insufficient balance (concurrent transaction prevented negative balance)");
      }

      // Credit broadcaster wallet
      await tx.wallet.upsert({
        where: { userId: stream.broadcasterId },
        create: {
          userId: stream.broadcasterId,
          coinBalance: 1000 + totalCoinAmount,
        },
        update: {
          coinBalance: {
            increment: totalCoinAmount,
          },
        },
      });

      // Sender details for transaction record and broadcast
      const sender = await tx.user.findUnique({
        where: { id: senderId },
        select: { id: true, username: true, avatarUrl: true },
      });

      // Record GiftTransaction
      const transaction = await tx.giftTransaction.create({
        data: {
          senderId,
          broadcasterId: stream.broadcasterId,
          liveStreamId: streamId,
          giftId,
          quantity,
          unitCoinPrice: gift.coinPrice,
          totalCoinAmount,
        },
      });

      return {
        transaction,
        remainingBalance: updatedSenderWallet.coinBalance,
        sender,
      };
    });

    // 5. Publish real-time LiveKit data message to the room after transaction succeeds
    const giftEvent = {
      type: "GIFT_SENT",
      streamId,
      roomName: stream.roomName,
      gift: {
        id: gift.id,
        name: gift.name,
        coinPrice: gift.coinPrice,
        assetUrl: gift.assetUrl,
      },
      sender: {
        id: result.sender?.id,
        username: result.sender?.username,
        avatarUrl: result.sender?.avatarUrl,
      },
      quantity,
      totalCoinAmount,
      timestamp: new Date().toISOString(),
    };

    MediasoupService.broadcastEvent(stream.roomName, giftEvent);

    return {
      ...result,
      gift,
      giftEvent,
    };
  }

  static async getStreamGiftTotal(streamId: string): Promise<number> {
    const aggregate = await prisma.giftTransaction.aggregate({
      where: { liveStreamId: streamId },
      _sum: {
        totalCoinAmount: true,
      },
    });

    return aggregate._sum.totalCoinAmount ?? 0;
  }

  static async getTopContributors(streamId: string, limit = 10) {
    const transactions = await prisma.giftTransaction.groupBy({
      by: ["senderId"],
      where: { liveStreamId: streamId },
      _sum: {
        totalCoinAmount: true,
      },
      orderBy: {
        _sum: {
          totalCoinAmount: "desc",
        },
      },
      take: limit,
    });

    const userIds = transactions.map((t) => t.senderId);
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, username: true, avatarUrl: true },
    });
    const userMap = new Map(users.map((u) => [u.id, u]));

    return transactions.map((t, index) => {
      const u = userMap.get(t.senderId);
      return {
        userId: t.senderId,
        username: u?.username || "Viewer",
        avatarUrl: u?.avatarUrl || null,
        totalCoins: t._sum.totalCoinAmount ?? 0,
        rank: index + 1,
      };
    });
  }
}
