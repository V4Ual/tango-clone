# PRD & Problem Diagnostic Matrix (PDM): Live Stream Video Pipeline

## 1. Executive Summary & Problem Statement
When attempting to stream or watch live broadcasts, the video element remains blank/black or fails to initialize ("stream video can't show"). This document details the exact root causes discovered across device capture, Mediasoup SFU routing, WebRTC ICE connectivity, and browser video rendering, followed by the architectural mitigation plan.

---

## 2. Root Cause Analysis (Problem Diagnostic Matrix)

| # | Issue Identified | Component | Technical Root Cause | Impact | Severity |
|---|-------------------|-----------|----------------------|--------|----------|
| **1** | `TypeError: Cannot read properties of null (reading 'closed')` | Server SFU (`src/lib/mediasoup.ts`) | When a client connects to SSE (`/api/mediasoup/events`) before the router initializes, `subscribeToRoomEvents` creates a room shell with `router: null`. Subsequent calls to `getOrCreateRoom()` evaluate `room.router.closed`, throwing an uncaught TypeError and failing with HTTP 500. | All `/api/mediasoup/router-capabilities` and transport routes crash with 500 when viewer connects first. | **CRITICAL** |
| **2** | Hardware Device Fatal Lockout | Broadcaster (`BroadcasterRoom.tsx`) | `navigator.mediaDevices.getUserMedia({ video: true, audio: true })` throws a fatal `NotFoundError` or `NotAllowedError` if the host machine lacks a microphone, webcam, or if permissions are blocked. | Broadcaster stream crashes immediately without rendering local preview or creating WebRTC tracks. | **HIGH** |
| **3** | WebRTC Binding & Interface Isolation | Mediasoup SFU (`src/lib/mediasoup.ts`) | `createWebRtcTransport` bound solely to `ip: "127.0.0.1"`. In multi-homed or IPv6 localhost environments (`[::1]`), UDP/TCP packets sent by browsers to other interfaces or ports are rejected. | ICE candidate pairing fails or stalls on loopback on Windows. | **HIGH** |
| **4** | Video Consumer Keyframe Starvation | SFU & Viewer (`src/lib/mediasoup.ts`, `ViewerRoom.tsx`) | WebRTC VP8 video requires an initial intra-frame (I-frame / Keyframe) before the decoder can render frames. If the consumer connects while only inter-frames (P-frames) are flying, the `<video>` element remains black indefinitely. | Viewer connects to room, receives track, but video stays pitch black until broadcaster sends a random keyframe. | **HIGH** |
| **5** | Browser Autoplay Policy Block | HTML5 `<video>` tag | Modern browsers (Chrome, Edge, Safari) prohibit unmuted media from automatically playing unless the user interacted with the document. | `videoRef.current.play()` rejects with `NotAllowedError: play() failed because the user didn't interact with the document first`. | **MEDIUM** |
| **6** | Lack of Dynamic Video Source Fallback | Broadcaster Studio | No capability to switch to a Virtual Studio Camera / Canvas Stream when testing or when physical camera is occupied by another application. | Broadcaster cannot preview or test the live pipeline without physical hardware. | **MEDIUM** |

---

## 3. Architecture & Functional Requirements

### Requirement 1: Robust Room Lifecycle & Null Router Guard
- Modify `MediasoupService.getOrCreateRoom()` to check `if (!room || !room.router || room.router.closed)`.
- In `subscribeToRoomEvents()`, properly handle lazy-room creation and ensure router initialization never throws on `null`.

### Requirement 2: Resilient Device Capture with Virtual Studio Fallback
- Broadcaster `getUserMedia` pipeline:
  1. Try full capture: `video: true, audio: true`.
  2. If microphone fails (common on desktop PCs), fall back to `video: true, audio: false`.
  3. If webcam fails or is unavailable, seamlessly spin up a high-quality **Virtual Studio Stream** (HTML5 Canvas 30fps with animated live visualizer + Web Audio synthesized tone) so the stream is ALWAYS broadcasting real, functional WebRTC video tracks.
  4. Provide a UI toggle: **[Webcam / Studio Canvas]** so users can switch seamlessly at any time.

### Requirement 3: Multi-interface WebRTC Binding on Windows
- Update `createWebRtcTransport` in `MediasoupService` to bind to `ip: "0.0.0.0"` with `announcedIp: "127.0.0.1"`.
- Ensure both UDP and TCP passive candidates are enabled for 100% reliable local ICE connectivity.

### Requirement 4: Proactive Video Keyframe Delivery
- Upon creating a video consumer in `MediasoupService.consume()`, immediately dispatch `consumer.requestKeyFrame()`.
- Add an endpoint `/api/mediasoup/request-keyframe` and trigger it in `ViewerRoom` as soon as the video track binds to `<video>`.

### Requirement 5: Guaranteed Autoplay & Video Element Binding
- Viewer `<video>` element configured with `autoPlay`, `playsInline`, and `muted={true}` by default.
- Prominent floating unmute pill button to let viewers activate sound with 1 click.
- Explicit `onloadedmetadata` event handler on `<video>` to trigger `.play()` reliably.

---

## 4. Verification & Acceptance Criteria
1. Broadcaster preview displays video immediately upon loading `/go-live` (either physical webcam or virtual studio canvas).
2. Broadcaster can toggle between physical camera and virtual studio canvas.
3. Mediasoup transport initializes without any 500 errors regardless of whether broadcaster or viewer joins first.
4. Viewer at `/live/[streamId]` immediately receives live video playback with low latency (<500ms).
5. Virtual gifts and coin transactions continue to trigger real-time animations over the live video.
