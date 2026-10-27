/**
 * Janus Admin & Room Management Service
 * Communicates with Janus HTTP REST API on port 8088.
 */

const JANUS_HTTP_URL = process.env.JANUS_HTTP_URL || "http://localhost:8088/janus";

export function getJanusRoomId(streamId: string): number {
  let hash = 0;
  for (let i = 0; i < streamId.length; i++) {
    hash = (hash << 5) - hash + streamId.charCodeAt(i);
    hash |= 0;
  }
  return (Math.abs(hash) % 900000) + 10000;
}

export class JanusAdminService {
  static async checkHealth(): Promise<boolean> {
    try {
      const res = await fetch(`${JANUS_HTTP_URL}/info`, { method: "GET" });
      return res.ok;
    } catch {
      return false;
    }
  }

  static async createRoom(roomId: number, description: string): Promise<boolean> {
    try {
      // 1. Create a session
      const sessRes = await fetch(JANUS_HTTP_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          janus: "create",
          transaction: Math.random().toString(36).substring(2, 10),
        }),
      });
      const sessData = await sessRes.json();
      const sessionId = sessData.data?.id;
      if (!sessionId) return false;

      // 2. Attach to VideoRoom plugin
      const attachRes = await fetch(`${JANUS_HTTP_URL}/${sessionId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          janus: "attach",
          plugin: "janus.plugin.videoroom",
          transaction: Math.random().toString(36).substring(2, 10),
        }),
      });
      const attachData = await attachRes.json();
      const handleId = attachData.data?.id;
      if (!handleId) return false;

      // 3. Create room
      await fetch(`${JANUS_HTTP_URL}/${sessionId}/${handleId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          janus: "message",
          transaction: Math.random().toString(36).substring(2, 10),
          body: {
            request: "create",
            room: roomId,
            description,
            publishers: 6,
            bitrate: 1500000,
            fir_freq: 1,
            videocodec: "vp8",
            audiocodec: "opus",
          },
        }),
      });

      // Cleanup handle & session
      fetch(`${JANUS_HTTP_URL}/${sessionId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          janus: "destroy",
          transaction: Math.random().toString(36).substring(2, 10),
        }),
      }).catch(() => {});

      return true;
    } catch (e) {
      console.warn("Janus create room notice:", e);
      return false;
    }
  }
}
