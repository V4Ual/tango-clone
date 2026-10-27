/**
 * Janus WebRTC Gateway Client for Tango-Style Broadcasting
 * Communicates with Janus via WebSocket on port 8188 using the VideoRoom plugin.
 */

export interface JanusPublisherOptions {
  wsUrl?: string;
  room: number;
  displayName: string;
  stream: MediaStream;
  onJoined?: (id: number) => void;
  onError?: (error: any) => void;
  onStreamEnded?: () => void;
}

export interface JanusSubscriberOptions {
  wsUrl?: string;
  room: number;
  feedId: number;
  onRemoteStream: (stream: MediaStream) => void;
  onError?: (error: any) => void;
}

function randomTx(): string {
  return Math.random().toString(36).substring(2, 14);
}

export class JanusBroadcasterSession {
  private ws: WebSocket | null = null;
  private sessionId: number | null = null;
  private handleId: number | null = null;
  private pc: RTCPeerConnection | null = null;
  private keepAliveTimer: any = null;
  private isDestroyed = false;
  private options: JanusPublisherOptions;
  private transactions = new Map<string, (res: any) => void>();

  constructor(options: JanusPublisherOptions) {
    this.options = {
      wsUrl: "ws://localhost:8188",
      ...options,
    };
  }

  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const ws = new WebSocket(this.options.wsUrl || "ws://localhost:8188", "janus-protocol");
        this.ws = ws;

        ws.onopen = async () => {
          try {
            // 1. Create session
            const sessionRes = await this.sendRequest({ janus: "create" });
            this.sessionId = sessionRes.data.id;

            // Start keep-alive
            this.keepAliveTimer = setInterval(() => {
              if (this.ws?.readyState === WebSocket.OPEN && this.sessionId) {
                this.sendRequest({ janus: "keepalive" }).catch(() => {});
              }
            }, 25000);

            // 2. Attach to VideoRoom plugin
            const attachRes = await this.sendRequest({
              janus: "attach",
              plugin: "janus.plugin.videoroom",
              opaque_id: `videoroom-${Date.now()}`,
            });
            this.handleId = attachRes.data.id;

            // 3. Create or Join room as publisher
            await this.joinOrCreateRoom();

            // 4. Publish stream via WebRTC RTCPeerConnection
            await this.publishLocalStream();

            resolve();
          } catch (err) {
            reject(err);
          }
        };

        ws.onmessage = (event) => {
          this.handleMessage(JSON.parse(event.data));
        };

        ws.onerror = (err) => {
          console.error("Janus WebSocket error:", err);
          if (this.options.onError) this.options.onError(err);
          reject(err);
        };

        ws.onclose = () => {
          if (!this.isDestroyed && this.options.onStreamEnded) {
            this.options.onStreamEnded();
          }
        };
      } catch (e) {
        reject(e);
      }
    });
  }

  private sendRequest(payload: any): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        return reject(new Error("WebSocket not open"));
      }

      const tx = randomTx();
      payload.transaction = tx;
      if (this.sessionId && !payload.session_id && payload.janus !== "create") {
        payload.session_id = this.sessionId;
      }
      if (this.handleId && !payload.handle_id && payload.janus !== "create" && payload.janus !== "attach") {
        payload.handle_id = this.handleId;
      }

      this.transactions.set(tx, (response) => {
        if (response.janus === "error") {
          reject(new Error(response.error?.reason || "Janus request failed"));
        } else {
          resolve(response);
        }
      });

      this.ws.send(JSON.stringify(payload));
    });
  }

  private async joinOrCreateRoom() {
    // Try to create room first (ignore if it already exists)
    try {
      await this.sendRequest({
        janus: "message",
        body: {
          request: "create",
          room: this.options.room,
          publishers: 6,
          description: "Live Stream Room",
          bitrate: 1500000,
          fir_freq: 1,
          videocodec: "vp8",
          audiocodec: "opus",
        },
      });
    } catch {
      // Room already exists, safe to proceed
    }

    // Join room as publisher
    const joinRes = await this.sendRequest({
      janus: "message",
      body: {
        request: "join",
        ptype: "publisher",
        room: this.options.room,
        id: 1,
        display: this.options.displayName,
      },
    });

    if (this.options.onJoined) {
      this.options.onJoined(1);
    }

    return joinRes;
  }

  private async publishLocalStream() {
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });
    this.pc = pc;

    this.options.stream.getTracks().forEach((track) => {
      pc.addTrack(track, this.options.stream);
    });

    pc.onicecandidate = (event) => {
      this.sendRequest({
        janus: "trickle",
        candidate: event.candidate ? event.candidate : { completed: true },
      }).catch(() => {});
    };

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    const publishRes = await this.sendRequest({
      janus: "message",
      body: {
        request: "publish",
        audio: true,
        video: true,
      },
      jsep: {
        type: offer.type,
        sdp: offer.sdp,
      },
    });

    // In Janus, the JSEP answer comes back either in publish response or via an event
    if (publishRes.jsep) {
      await pc.setRemoteDescription(new RTCSessionDescription(publishRes.jsep));
    }
  }

  private async handleMessage(msg: any) {
    if (msg.transaction && this.transactions.has(msg.transaction)) {
      const cb = this.transactions.get(msg.transaction)!;
      this.transactions.delete(msg.transaction);
      cb(msg);
    }

    // Handle asynchronous JSEP answers from Janus
    if (msg.jsep && this.pc) {
      await this.pc.setRemoteDescription(new RTCSessionDescription(msg.jsep));
    }
  }

  async setAudioEnabled(enabled: boolean) {
    if (this.pc) {
      this.pc.getSenders().forEach((sender) => {
        if (sender.track?.kind === "audio") {
          sender.track.enabled = enabled;
        }
      });
    }
    if (this.ws && this.handleId) {
      await this.sendRequest({
        janus: "message",
        body: {
          request: "configure",
          audio: enabled,
        },
      }).catch((e) => console.warn("Janus audio configure notice:", e));
    }
  }

  async setVideoEnabled(enabled: boolean) {
    if (this.pc) {
      this.pc.getSenders().forEach((sender) => {
        if (sender.track?.kind === "video") {
          sender.track.enabled = enabled;
        }
      });
    }
    if (this.ws && this.handleId) {
      await this.sendRequest({
        janus: "message",
        body: {
          request: "configure",
          video: enabled,
        },
      }).catch((e) => console.warn("Janus video configure notice:", e));
    }
  }

  async replaceVideoTrack(newTrack: MediaStreamTrack) {
    if (!this.pc) return;
    const sender = this.pc.getSenders().find((s) => s.track?.kind === "video");
    if (sender) {
      await sender.replaceTrack(newTrack);
    }
  }

  destroy() {
    this.isDestroyed = true;
    if (this.keepAliveTimer) clearInterval(this.keepAliveTimer);
    if (this.pc) this.pc.close();
    if (this.ws) {
      this.sendRequest({
        janus: "message",
        body: { request: "unpublish" },
      }).catch(() => {});
      setTimeout(() => this.ws?.close(), 200);
    }
  }
}

export class JanusViewerSession {
  private ws: WebSocket | null = null;
  private sessionId: number | null = null;
  private handleId: number | null = null;
  private pc: RTCPeerConnection | null = null;
  private keepAliveTimer: any = null;
  private isDestroyed = false;
  private options: JanusSubscriberOptions;
  private transactions = new Map<string, (res: any) => void>();
  private remoteStream = new MediaStream();

  constructor(options: JanusSubscriberOptions) {
    this.options = {
      wsUrl: "ws://localhost:8188",
      ...options,
    };
  }

  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const ws = new WebSocket(this.options.wsUrl || "ws://localhost:8188", "janus-protocol");
        this.ws = ws;

        ws.onopen = async () => {
          try {
            // 1. Create session
            const sessionRes = await this.sendRequest({ janus: "create" });
            this.sessionId = sessionRes.data.id;

            // Start keep-alive
            this.keepAliveTimer = setInterval(() => {
              if (this.ws?.readyState === WebSocket.OPEN && this.sessionId) {
                this.sendRequest({ janus: "keepalive" }).catch(() => {});
              }
            }, 25000);

            // 2. Attach to VideoRoom plugin
            const attachRes = await this.sendRequest({
              janus: "attach",
              plugin: "janus.plugin.videoroom",
              opaque_id: `viewer-${Date.now()}`,
            });
            this.handleId = attachRes.data.id;

            // 3. Setup RTCPeerConnection
            this.setupPeerConnection();

            // 4. Join room as subscriber to the feed
            await this.sendRequest({
              janus: "message",
              body: {
                request: "join",
                ptype: "subscriber",
                room: this.options.room,
                feed: this.options.feedId,
              },
            });

            resolve();
          } catch (err) {
            reject(err);
          }
        };

        ws.onmessage = (event) => {
          this.handleMessage(JSON.parse(event.data));
        };

        ws.onerror = (err) => {
          if (this.isDestroyed) return;
          console.warn("Janus viewer notice (streamer may be offline):", err);
          if (this.options.onError) this.options.onError(err);
          reject(err);
        };

        ws.onclose = () => {
          if (this.isDestroyed) return;
          if (this.options.onError) this.options.onError(new Error("Janus connection closed"));
        };
      } catch (e) {
        reject(e);
      }
    });
  }

  private setupPeerConnection() {
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });
    this.pc = pc;

    pc.ontrack = (event) => {
      this.remoteStream.addTrack(event.track);
      this.options.onRemoteStream(this.remoteStream);
    };

    pc.onicecandidate = (event) => {
      this.sendRequest({
        janus: "trickle",
        candidate: event.candidate ? event.candidate : { completed: true },
      }).catch(() => {});
    };
  }

  private sendRequest(payload: any): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        return reject(new Error("WebSocket not open"));
      }

      const tx = randomTx();
      payload.transaction = tx;
      if (this.sessionId && !payload.session_id && payload.janus !== "create") {
        payload.session_id = this.sessionId;
      }
      if (this.handleId && !payload.handle_id && payload.janus !== "create" && payload.janus !== "attach") {
        payload.handle_id = this.handleId;
      }

      this.transactions.set(tx, (response) => {
        if (response.janus === "error") {
          reject(new Error(response.error?.reason || "Janus request failed"));
        } else {
          resolve(response);
        }
      });

      this.ws.send(JSON.stringify(payload));
    });
  }

  private async handleMessage(msg: any) {
    if (msg.transaction && this.transactions.has(msg.transaction)) {
      const cb = this.transactions.get(msg.transaction)!;
      this.transactions.delete(msg.transaction);
      cb(msg);
    }

    // Janus sends WebRTC SDP Offer to the subscriber
    if (msg.jsep && msg.jsep.type === "offer" && this.pc) {
      await this.pc.setRemoteDescription(new RTCSessionDescription(msg.jsep));
      const answer = await this.pc.createAnswer();
      await this.pc.setLocalDescription(answer);

      // Send Answer back to Janus to start receiving stream
      await this.sendRequest({
        janus: "message",
        body: { request: "start", room: this.options.room },
        jsep: {
          type: answer.type,
          sdp: answer.sdp,
        },
      });
    }
  }

  destroy() {
    this.isDestroyed = true;
    if (this.keepAliveTimer) {
      clearInterval(this.keepAliveTimer);
      this.keepAliveTimer = null;
    }
    if (this.pc) {
      try {
        this.pc.close();
      } catch {}
      this.pc = null;
    }
    if (this.ws) {
      const ws = this.ws;
      this.ws = null;
      ws.onopen = null;
      ws.onmessage = null;
      ws.onerror = null;
      ws.onclose = null;
      try {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ janus: "message", body: { request: "leave" }, transaction: "leave" }));
        }
      } catch {}
      try {
        ws.close();
      } catch {}
    }
  }
}
