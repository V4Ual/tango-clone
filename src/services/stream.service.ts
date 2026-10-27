import { prisma } from "@/lib/prisma";
import crypto from "crypto";
import { MediasoupService } from "@/lib/mediasoup";

export class StreamService {
  static async createStream({
    broadcasterId,
    title,
  }: {
    broadcasterId: string;
    title: string;
  }) {
    // End any previously hanging active stream for this broadcaster
    await prisma.liveStream.updateMany({
      where: {
        broadcasterId,
        status: "active",
      },
      data: {
        status: "ended",
        endedAt: new Date(),
      },
    });

    const roomName = `room-${broadcasterId.slice(0, 8)}-${crypto.randomBytes(4).toString("hex")}`;

    const stream = await prisma.liveStream.create({
      data: {
        broadcasterId,
        title,
        roomName,
        status: "active",
        startedAt: new Date(),
      },
      include: {
        broadcaster: {
          select: {
            id: true,
            username: true,
            avatarUrl: true,
          },
        },
      },
    });

    return stream;
  }

  static async getActiveStreams() {
    return prisma.liveStream.findMany({
      where: { status: "active" },
      orderBy: { startedAt: "desc" },
      include: {
        broadcaster: {
          select: {
            id: true,
            username: true,
            avatarUrl: true,
          },
        },
        _count: {
          select: {
            giftTransactions: true,
          },
        },
      },
    });
  }

  static async getStreamById(id: string) {
    return prisma.liveStream.findUnique({
      where: { id },
      include: {
        broadcaster: {
          select: {
            id: true,
            username: true,
            avatarUrl: true,
          },
        },
      },
    });
  }

  static async endStream(streamId: string, broadcasterId: string) {
    const stream = await prisma.liveStream.findUnique({
      where: { id: streamId },
    });

    if (!stream) {
      throw new Error("Stream not found");
    }

    if (stream.broadcasterId !== broadcasterId) {
      throw new Error("Unauthorized to end this stream");
    }

    MediasoupService.closeRoom(stream.roomName);

    return prisma.liveStream.update({
      where: { id: streamId },
      data: {
        status: "ended",
        endedAt: new Date(),
      },
    });
  }
}
