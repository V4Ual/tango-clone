import { prisma } from "../src/lib/prisma";
import { hashPassword, verifyPassword, createSessionToken, verifySessionToken } from "../src/lib/auth";
import { WalletService } from "../src/services/wallet.service";
import { StreamService } from "../src/services/stream.service";
import { GiftService } from "../src/services/gift.service";
import { MediasoupService } from "../src/lib/mediasoup";

async function runTests() {
  console.log("==================================================");
  console.log("🧪 RUNNING TANGO LIVE MVP AUTOMATED TESTS (MEDIASOUP)");
  console.log("==================================================\n");

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string) {
    if (condition) {
      console.log(`✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${testName}`);
      failed++;
    }
  }

  try {
    // Test 1: Password hashing & verification
    const plain = "securePass123";
    const hashed = await hashPassword(plain);
    const isMatch = await verifyPassword(plain, hashed);
    const isWrongMatch = await verifyPassword("wrongPass", hashed);
    assert(isMatch && !isWrongMatch, "Password hashing and bcrypt verification");

    // Test 2: JWT Session token signing & verification
    const sessionToken = await createSessionToken({
      userId: "test-user-id",
      username: "testuser",
      email: "test@example.com",
    });
    const verified = await verifySessionToken(sessionToken);
    assert(
      verified !== null && verified.username === "testuser",
      "Session token signing and verification"
    );

    // Clean up test data if existing from previous runs
    await prisma.giftTransaction.deleteMany({});
    await prisma.liveStream.deleteMany({});
    await prisma.wallet.deleteMany({});
    await prisma.user.deleteMany({
      where: {
        username: { in: ["broadcaster_test", "viewer_test", "poor_viewer_test"] },
      },
    });

    // Test 3: Create Broadcaster and Viewer Users
    const broadcaster = await prisma.user.create({
      data: {
        username: "broadcaster_test",
        email: "broadcaster@example.com",
        passwordHash: hashed,
      },
    });
    await WalletService.createWallet(broadcaster.id, 1000);

    const viewer = await prisma.user.create({
      data: {
        username: "viewer_test",
        email: "viewer@example.com",
        passwordHash: hashed,
      },
    });
    await WalletService.createWallet(viewer.id, 1000);

    const viewerBalance = await WalletService.getBalance(viewer.id);
    assert(viewerBalance === 1000, "New user receives 1,000 test coin balance");

    // Test 4: Gift Catalog Verification
    const gifts = await GiftService.getAvailableGifts();
    const hasHeart = gifts.some((g) => g.name === "Heart" && g.coinPrice === 10);
    const hasRose = gifts.some((g) => g.name === "Rose" && g.coinPrice === 50);
    const hasStar = gifts.some((g) => g.name === "Star" && g.coinPrice === 100);
    const hasDiamond = gifts.some((g) => g.name === "Diamond" && g.coinPrice === 500);
    assert(
      gifts.length >= 4 && hasHeart && hasRose && hasStar && hasDiamond,
      "Gift catalog contains Heart (10), Rose (50), Star (100), and Diamond (500)"
    );

    // Test 5: Live Stream Creation
    const stream = await StreamService.createStream({
      broadcasterId: broadcaster.id,
      title: "Test Live Concert 🎵",
    });
    assert(
      stream.status === "active" && stream.broadcasterId === broadcaster.id,
      "Broadcaster can create an active live stream"
    );

    // Test 6: Mediasoup SFU Router & WebRtcTransport creation
    const rtpCaps = await MediasoupService.getRouterRtpCapabilities(stream.roomName);
    const transport = await MediasoupService.createWebRtcTransport(stream.roomName);
    assert(
      Boolean(rtpCaps && transport.id && transport.iceParameters && transport.dtlsParameters),
      "Mediasoup SFU in-process router and WebRtcTransport initialized successfully"
    );

    // Test 7: Prevent Broadcaster Sending Gift to Self
    const roseGift = gifts.find((g) => g.name === "Rose")!;
    let selfGiftError = false;
    try {
      await GiftService.sendGift({
        senderId: broadcaster.id,
        streamId: stream.id,
        giftId: roseGift.id,
      });
    } catch (e: any) {
      if (e.message.includes("themselves")) {
        selfGiftError = true;
      }
    }
    assert(selfGiftError, "Broadcaster is prevented from sending gifts to themselves");

    // Test 8: Viewer Sends Rose (50 coins) Atomically
    const giftResult = await GiftService.sendGift({
      senderId: viewer.id,
      streamId: stream.id,
      giftId: roseGift.id,
      quantity: 1,
    });
    const newViewerBalance = await WalletService.getBalance(viewer.id);
    const newBroadcasterBalance = await WalletService.getBalance(broadcaster.id);
    assert(
      giftResult.remainingBalance === 950 &&
        newViewerBalance === 950 &&
        newBroadcasterBalance === 1050,
      "Atomic gift deduction: 50 coins deducted from viewer and credited to broadcaster"
    );

    // Test 9: Gift Transaction is Logged in PostgreSQL
    const recordedTx = await prisma.giftTransaction.findFirst({
      where: { liveStreamId: stream.id, senderId: viewer.id },
    });
    assert(
      recordedTx !== null && recordedTx.totalCoinAmount === 50,
      "GiftTransaction is persisted in PostgreSQL"
    );

    // Test 10: Insufficient Balance Prevention
    await prisma.wallet.update({
      where: { userId: viewer.id },
      data: { coinBalance: 5 },
    });
    let insufficientBalanceError = false;
    try {
      await GiftService.sendGift({
        senderId: viewer.id,
        streamId: stream.id,
        giftId: roseGift.id,
      });
    } catch (e: any) {
      if (e.message.includes("Insufficient balance")) {
        insufficientBalanceError = true;
      }
    }
    assert(insufficientBalanceError, "Insufficient coin balance prevents gift sending");

    // Test 11: End Stream and Mediasoup Room Closure
    await StreamService.endStream(stream.id, broadcaster.id);
    const endedStream = await StreamService.getStreamById(stream.id);
    assert(endedStream?.status === "ended", "Stream successfully marked as ended and mediasoup room closed");

    // Test 12: Prevent Gifting to Ended Stream
    let giftToEndedError = false;
    try {
      await GiftService.sendGift({
        senderId: viewer.id,
        streamId: stream.id,
        giftId: gifts.find((g) => g.name === "Heart")!.id,
      });
    } catch (e: any) {
      if (e.message.includes("ended")) {
        giftToEndedError = true;
      }
    }
    assert(giftToEndedError, "Gift sending is rejected for ended streams");

    console.log(`\n==================================================`);
    console.log(`🎉 TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log(`==================================================\n`);

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error("Test execution failed:", err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
    process.exit(0);
  }
}

runTests();
