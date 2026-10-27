# 🎥 TangoLive — Live Video Broadcasting with Virtual Gifts (Mediasoup SFU)

A full-stack, real-time social live-streaming platform inspired by Tango Live. Built with Next.js App Router, PostgreSQL, Prisma, in-process **Mediasoup WebRTC SFU**, and Tailwind CSS.

---

## 🌟 Key Features

1. **User Authentication & Test Wallets**
   - User registration & login with password hashing via `bcryptjs`.
   - Secure HTTP-only JWT sessions.
   - Every registered user automatically receives **1,000 test coins** in their PostgreSQL wallet.
   - Profile page (`/profile/[username]`) with broadcast history, wallet balance, and gift statistics.

2. **In-Process Mediasoup WebRTC SFU (No External Server Needed)**
   - Media router and WebRTC transports run directly in-process via `mediasoup` and `mediasoup-client`.
   - Broadcaster produces Opus audio and VP8 video tracks directly to the SFU.
   - Viewers consume audio/video streams in real time with sub-second latency.
   - Real-time room events (gifts, viewer count, tracks) dispatached through Server-Sent Events (SSE).

3. **Broadcaster Studio (`/go-live`)**
   - Enter stream title and start live broadcast.
   - Live camera and microphone capture with local preview.
   - Controls: Mute/unmute microphone, enable/disable camera.
   - Real-time viewer count and session coin earnings tracker.
   - End broadcast button marking status as `ended` in PostgreSQL.

4. **Viewer Room (`/live/[streamId]`)**
   - Real-time WebRTC audio & video consumption.
   - Broadcaster profile badge and viewer counter.
   - Interactive Gift Tray with live balance indicator.

5. **Atomic Virtual Gifts System**
   - Predefined catalog:
     - 💖 **Heart**: 10 Coins
     - 🌹 **Rose**: 50 Coins
     - ⭐ **Star**: 100 Coins
     - 💎 **Diamond**: 500 Coins
   - **Atomic PostgreSQL Transactions**:
     - Strict balance verification.
     - Atomic coin deduction from viewer wallet and credit to broadcaster.
     - Prevention of negative balances, self-gifting, and gifting to ended streams.
     - Transaction records persisted in `GiftTransaction` table.
   - **Screen Visuals**:
     - Real-time gift pop animations with sender name and gift icon.
     - Celebratory confetti bursts for all room participants.

---

## 🛠️ Tech Stack

- **Framework**: Next.js 16 (App Router), React 19, TypeScript
- **Styling**: Tailwind CSS, Lucide Icons, Glassmorphic dark UI
- **Database**: PostgreSQL (Local Server on port 5432)
- **ORM**: Prisma 6
- **WebRTC SFU**: `mediasoup` (Server) & `mediasoup-client` (Browser)
- **Real-Time Signaling**: Server-Sent Events (SSE)
- **Validation**: Zod
- **Animations**: `canvas-confetti`, custom CSS animations

---

## 🚀 Setup & Running Instructions

### 1. Database Sync & Seeding
```bash
# Push Prisma schema to local PostgreSQL
npm run db:push

# Seed the 4 predefined gifts (Heart, Rose, Star, Diamond)
npm run db:seed
```

### 2. Run Automated Test Suite
```bash
npm run test:mvp
```

### 3. Start Next.js Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000).

---

## 👥 Testing with Two Browser Sessions

1. **Broadcaster Tab:**
   - Register at [http://localhost:3000/register](http://localhost:3000/register) as `streamer1`.
   - Go to `/go-live`, allow camera & mic, enter title, click **"Go Live Now"**.
2. **Viewer Tab (Incognito Window):**
   - Register at [http://localhost:3000/register](http://localhost:3000/register) as `viewer1`.
   - On `/live`, click `streamer1`'s live broadcast card.
   - In the gift tray, select **Rose (50 coins)** or **Diamond (500 coins)** and click **"Send Gift"**.
   - Watch the instant coin deduction, screen gift pop, and confetti across both tabs!
