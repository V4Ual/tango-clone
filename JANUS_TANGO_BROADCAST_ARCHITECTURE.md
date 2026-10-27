# Janus WebRTC Server Architecture for Tango-Style Live Broadcasting

## 1. Executive Summary
This document specifies the architecture and implementation for deploying and utilizing **Janus WebRTC Gateway** (via Docker) to power the 1-to-many live streaming pipeline inspired by **Tango Live**.

In Tango Live, a single broadcaster streams high-definition video and audio to thousands of concurrent viewers with sub-second latency, accompanied by real-time virtual gifting, interactive animations, and wallet transactions.

---

## 2. Why Janus WebRTC Gateway for Tango-Style Broadcasting?

| Feature | Mediasoup / LiveKit | Janus WebRTC Gateway (VideoRoom Plugin) |
|---------|---------------------|-----------------------------------------|
| **Architecture** | Node.js / Go wrapper SFU | Ultra-fast native **C** SFU engine |
| **Broadcasting Model** | Multi-transport SFU | Dedicated 1-to-N **VideoRoom** publisher & subscriber feed model |
| **Browser Integration** | Large specialized client library | Pure standard **WebSockets (`ws://`)** + native browser `RTCPeerConnection` |
| **Resource Efficiency** | Heavy Node.js event-loop dependencies | Extremely lightweight memory & multi-threaded CPU handling |
| **Local Deployment** | OS binary build dependencies | Clean, isolated **Docker container** running on Linux/WSL2 |

---

## 3. System Architecture Diagram

```
+--------------------------------------------------------------------------------+
|                             TANGO BROADCAST PLATFORM                           |
+--------------------------------------------------------------------------------+

        +-----------------------+                 +---------------------+
        |  BROADCASTER (Studio) |                 |   VIEWER (Audience) |
        |  Camera / Virtual Cam |                 |   Video + Gift Tray |
        +-----------+-----------+                 +----------+----------+
                    |                                        |
       WebRTC SDP   | WebSocket:8188            WebSocket:8188| WebRTC SDP
      Offer/Answer  | Feed Publish               Feed Subscribe| Offer/Answer
                    v                                        v
        +---------------------------------------------------------------+
        |                 JANUS GATEWAY (Docker: 8188/8088)             |
        |              Plugin: janus.plugin.videoroom                   |
        |                                                               |
        |   - Room 10001: Broadcaster Feed                              |
        |   - SFU forwards RTP/RTCP packets to all subscribed viewers   |
        +-------------------------------+-------------------------------+
                                        ^
                                        | HTTP REST (Room create/destroy)
                                        v
        +---------------------------------------------------------------+
        |             NEXT.JS APPLICATION BACKEND (Port 3000)           |
        |                                                               |
        |   - LiveStream Lifecycle Management                           |
        |   - Real-time Server-Sent Events (SSE) for Gifts              |
        |   - Atomic PostgreSQL Wallet & Coin Deductions                |
        +-------------------------------+-------------------------------+
                                        |
                                        v
        +---------------------------------------------------------------+
        |              LOCAL POSTGRESQL DATABASE (Port 5432)            |
        |      Models: User, Wallet, LiveStream, Gift, GiftTransaction  |
        +---------------------------------------------------------------+
```

---

## 4. Janus VideoRoom Protocol Flow

### A. Broadcaster (Publisher)
1. Broadcaster connects to Janus WebSocket: `ws://localhost:8188/`.
2. Creates session: `{ "janus": "create", "transaction": "tx-1" }`.
3. Attaches to VideoRoom plugin: `{ "janus": "attach", "plugin": "janus.plugin.videoroom" }`.
4. Creates / joins room as publisher:
   ```json
   {
     "janus": "message",
     "body": {
       "request": "join",
       "ptype": "publisher",
       "room": 1001,
       "id": 1,
       "display": "@broadcaster_username"
     }
   }
   ```
5. Broadcaster creates WebRTC SDP Offer (`RTCPeerConnection.createOffer`) and publishes:
   ```json
   {
     "janus": "message",
     "body": { "request": "publish", "audio": true, "video": true },
     "jsep": { "type": "offer", "sdp": "..." }
   }
   ```
6. Janus returns SDP Answer (`jsep`), broadcaster sets remote description. Video is now live!

### B. Viewer (Subscriber)
1. Viewer connects to Janus WebSocket: `ws://localhost:8188/`.
2. Attaches to `janus.plugin.videoroom`.
3. Joins room as subscriber targeting broadcaster's feed:
   ```json
   {
     "janus": "message",
     "body": {
       "request": "join",
       "ptype": "subscriber",
       "room": 1001,
       "feed": 1
     }
   }
   ```
4. Janus responds with WebRTC SDP Offer.
5. Viewer creates SDP Answer (`RTCPeerConnection.createAnswer`) and sends:
   ```json
   {
     "janus": "message",
     "body": { "request": "start" },
     "jsep": { "type": "answer", "sdp": "..." }
   }
   ```
6. WebRTC media streams instantly to the viewer's `<video>` tag with sub-second latency!

---

## 5. Deployment Specification
- **Docker Image**: `canyan/janus-gateway:latest`
- **Exposed Ports**:
  - `8088`: Janus HTTP REST API
  - `8188`: Janus WebSockets API
  - `10000-10100/udp`: RTP/RTCP WebRTC media ports
- **Configuration**: `docker-compose.yml`
