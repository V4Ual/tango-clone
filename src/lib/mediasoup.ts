import * as mediasoup from "mediasoup";
import { types as msTypes } from "mediasoup";
import path from "path";
import fs from "fs";

// Standard media codecs supported by modern WebRTC browsers
const MEDIA_CODECS: msTypes.RtpCodecCapability[] = [
  {
    kind: "audio",
    mimeType: "audio/opus",
    clockRate: 48000,
    channels: 2,
    preferredPayloadType: 100,
  },
  {
    kind: "video",
    mimeType: "video/VP8",
    clockRate: 90000,
    parameters: {
      "x-google-start-bitrate": 1000,
    },
    preferredPayloadType: 101,
  },
];

interface RoomState {
  roomName: string;
  router: msTypes.Router;
  transports: Map<string, msTypes.WebRtcTransport>;
  producers: Map<"video" | "audio", msTypes.Producer>;
  consumers: Map<string, msTypes.Consumer>;
  listeners: Set<(data: any) => void>;
  viewerCount: number;
  camEnabled?: boolean;
  micEnabled?: boolean;
}

const globalForMediasoup = globalThis as unknown as {
  mediasoupWorker?: msTypes.Worker;
  mediasoupRooms?: Map<string, RoomState>;
};

if (!globalForMediasoup.mediasoupRooms) {
  globalForMediasoup.mediasoupRooms = new Map();
}

function getWorkerPath(): string | undefined {
  const exePath = path.resolve(
    process.cwd(),
    "node_modules/mediasoup/worker/out/Release/mediasoup-worker.exe"
  );
  if (fs.existsSync(exePath)) {
    return exePath;
  }
  const defaultPath = path.resolve(
    process.cwd(),
    "node_modules/mediasoup/worker/out/Release/mediasoup-worker"
  );
  if (fs.existsSync(defaultPath)) {
    return defaultPath;
  }
  return undefined;
}

export class MediasoupService {
  private static async getWorker(): Promise<msTypes.Worker> {
    if (!globalForMediasoup.mediasoupWorker || globalForMediasoup.mediasoupWorker.closed) {
      const workerPath = getWorkerPath();
      if (workerPath) {
        process.env.MEDIASOUP_WORKER_BIN = workerPath;
      }

      globalForMediasoup.mediasoupWorker = await mediasoup.createWorker({
        workerBin: workerPath,
        rtcMinPort: 20000,
        rtcMaxPort: 20500,
        logLevel: "warn",
      });

      globalForMediasoup.mediasoupWorker.on("died", () => {
        console.error("Mediasoup worker died, will recreate on next request");
        delete globalForMediasoup.mediasoupWorker;
      });
    }

    return globalForMediasoup.mediasoupWorker;
  }

  static async getOrCreateRoom(roomName: string): Promise<RoomState> {
    const rooms = globalForMediasoup.mediasoupRooms!;
    let room = rooms.get(roomName);

    if (!room || !room.router || room.router.closed) {
      const worker = await this.getWorker();
      const router = await worker.createRouter({ mediaCodecs: MEDIA_CODECS });

      if (room) {
        room.router = router;
      } else {
        room = {
          roomName,
          router,
          transports: new Map(),
          producers: new Map(),
          consumers: new Map(),
          listeners: new Set(),
          viewerCount: 0,
        };
        rooms.set(roomName, room);
      }
    }

    return room;
  }

  static async getRouterRtpCapabilities(roomName: string) {
    const room = await this.getOrCreateRoom(roomName);
    return room.router.rtpCapabilities;
  }

  static async createWebRtcTransport(roomName: string) {
    const room = await this.getOrCreateRoom(roomName);

    // Listen on 0.0.0.0 (all interfaces) and advertise 127.0.0.1 for local browser WebRTC
    const transport = await room.router.createWebRtcTransport({
      listenIps: [
        {
          ip: "0.0.0.0",
          announcedIp: "127.0.0.1",
        },
      ],
      enableUdp: true,
      enableTcp: true,
      preferUdp: true,
      initialAvailableOutgoingBitrate: 1000000,
    });

    room.transports.set(transport.id, transport);

    transport.on("dtlsstatechange", (dtlsState) => {
      if (dtlsState === "closed" || dtlsState === "failed") {
        transport.close();
        room.transports.delete(transport.id);
      }
    });

    transport.on("@close", () => {
      room.transports.delete(transport.id);
    });

    return {
      id: transport.id,
      iceParameters: transport.iceParameters,
      iceCandidates: transport.iceCandidates,
      dtlsParameters: transport.dtlsParameters,
    };
  }

  static async connectTransport(
    roomName: string,
    transportId: string,
    dtlsParameters: msTypes.DtlsParameters
  ) {
    const room = await this.getOrCreateRoom(roomName);
    const transport = room.transports.get(transportId);

    if (!transport) {
      throw new Error(`Transport ${transportId} not found`);
    }

    await transport.connect({ dtlsParameters });
    return { connected: true };
  }

  static async produce(
    roomName: string,
    transportId: string,
    kind: "audio" | "video",
    rtpParameters: msTypes.RtpParameters
  ) {
    const room = await this.getOrCreateRoom(roomName);
    const transport = room.transports.get(transportId);

    if (!transport) {
      throw new Error(`Transport ${transportId} not found`);
    }

    // Close any previous producer of this kind in the room
    const existingProducer = room.producers.get(kind);
    if (existingProducer && !existingProducer.closed) {
      existingProducer.close();
    }

    const producer = await transport.produce({ kind, rtpParameters });
    room.producers.set(kind, producer);

    producer.on("transportclose", () => {
      producer.close();
      room.producers.delete(kind);
    });

    producer.on("@close", () => {
      room.producers.delete(kind);
    });

    // Notify all active viewers in the room that a new track is available
    this.broadcastEvent(roomName, {
      type: "NEW_PRODUCER",
      kind,
      producerId: producer.id,
    });

    return { id: producer.id, kind: producer.kind };
  }

  static async consume(
    roomName: string,
    transportId: string,
    producerId: string,
    rtpCapabilities: msTypes.RtpCapabilities
  ) {
    const room = await this.getOrCreateRoom(roomName);
    const transport = room.transports.get(transportId);

    if (!transport) {
      throw new Error(`Transport ${transportId} not found`);
    }

    if (!room.router.canConsume({ producerId, rtpCapabilities })) {
      throw new Error(`Router cannot consume producer ${producerId}`);
    }

    const consumer = await transport.consume({
      producerId,
      rtpCapabilities,
      paused: false,
    });

    room.consumers.set(consumer.id, consumer);

    if (consumer.kind === "video") {
      // Promptly request keyframes from broadcaster so viewer decodes video immediately
      setTimeout(() => {
        if (!consumer.closed) {
          consumer.requestKeyFrame().catch(() => {});
        }
      }, 200);
      setTimeout(() => {
        if (!consumer.closed) {
          consumer.requestKeyFrame().catch(() => {});
        }
      }, 1000);
    }

    consumer.on("transportclose", () => {
      consumer.close();
      room.consumers.delete(consumer.id);
    });

    consumer.on("producerclose", () => {
      consumer.close();
      room.consumers.delete(consumer.id);
    });

    return {
      id: consumer.id,
      producerId,
      kind: consumer.kind,
      rtpParameters: consumer.rtpParameters,
    };
  }

  static async getRoomProducers(roomName: string) {
    const room = await this.getOrCreateRoom(roomName);
    const list: { id: string; kind: "video" | "audio" }[] = [];

    const videoProducer = room.producers.get("video");
    if (videoProducer && !videoProducer.closed) {
      list.push({ id: videoProducer.id, kind: "video" });
    }

    const audioProducer = room.producers.get("audio");
    if (audioProducer && !audioProducer.closed) {
      list.push({ id: audioProducer.id, kind: "audio" });
    }

    return list;
  }

  static async requestKeyFrame(roomName: string, consumerId?: string) {
    const room = globalForMediasoup.mediasoupRooms?.get(roomName);
    if (!room) return;

    if (consumerId) {
      const consumer = room.consumers.get(consumerId);
      if (consumer && consumer.kind === "video" && !consumer.closed) {
        await consumer.requestKeyFrame().catch(() => {});
      }
    } else {
      for (const consumer of room.consumers.values()) {
        if (consumer.kind === "video" && !consumer.closed) {
          await consumer.requestKeyFrame().catch(() => {});
        }
      }
    }
  }

  static subscribeToRoomEvents(
    roomName: string,
    listener: (data: any) => void
  ): () => void {
    const rooms = globalForMediasoup.mediasoupRooms!;
    let room = rooms.get(roomName);
    if (!room) {
      // Lazy prepare room listeners
      room = {
        roomName,
        router: null as any,
        transports: new Map(),
        producers: new Map(),
        consumers: new Map(),
        listeners: new Set(),
        viewerCount: 0,
      };
      rooms.set(roomName, room);
    }

    room.listeners.add(listener);
    room.viewerCount++;
    this.broadcastEvent(roomName, { type: "VIEWER_COUNT", count: room.viewerCount });

    // Immediately notify new subscriber of current camera/mic status if set
    if (room.camEnabled !== undefined || room.micEnabled !== undefined) {
      try {
        listener({
          type: "STREAM_STATUS",
          camEnabled: room.camEnabled ?? true,
          micEnabled: room.micEnabled ?? true,
        });
      } catch {}
    }

    return () => {
      const r = rooms.get(roomName);
      if (r) {
        r.listeners.delete(listener);
        r.viewerCount = Math.max(0, r.viewerCount - 1);
        this.broadcastEvent(roomName, { type: "VIEWER_COUNT", count: r.viewerCount });
      }
    };
  }

  static broadcastEvent(roomName: string, eventData: any) {
    const rooms = globalForMediasoup.mediasoupRooms!;
    let room = rooms.get(roomName);
    if (!room) {
      room = {
        roomName,
        router: null as any,
        transports: new Map(),
        producers: new Map(),
        consumers: new Map(),
        listeners: new Set(),
        viewerCount: 0,
      };
      rooms.set(roomName, room);
    }

    if (eventData.type === "STREAM_STATUS") {
      if (eventData.camEnabled !== undefined) room.camEnabled = eventData.camEnabled;
      if (eventData.micEnabled !== undefined) room.micEnabled = eventData.micEnabled;
    }

    for (const listener of room.listeners) {
      try {
        listener(eventData);
      } catch (err) {
        console.error("Error dispatching event to listener:", err);
      }
    }
  }

  static getRoomViewerCount(roomName: string): number {
    const room = globalForMediasoup.mediasoupRooms?.get(roomName);
    return room ? room.viewerCount : 0;
  }

  static closeRoom(roomName: string) {
    const room = globalForMediasoup.mediasoupRooms?.get(roomName);
    if (room) {
      this.broadcastEvent(roomName, { type: "STREAM_ENDED" });
      if (room.router && !room.router.closed) {
        room.router.close();
      }
      globalForMediasoup.mediasoupRooms?.delete(roomName);
    }
  }
}
