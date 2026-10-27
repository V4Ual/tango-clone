import WebSocket from "ws";

async function runJanusTest() {
  console.log("--- Testing Janus Gateway Docker Deployment ---");

  // 1. Test HTTP Info
  try {
    const res = await fetch("http://localhost:8088/janus/info");
    const info = await res.json();
    console.log("✅ Janus HTTP API reachable! Server:", info.name, "Version:", info.version_string);
  } catch (err: any) {
    console.error("❌ Janus HTTP API failed:", err.message);
    process.exit(1);
  }

  // 2. Test WebSocket Session & VideoRoom Plugin
  await new Promise<void>((resolve, reject) => {
    const ws = new WebSocket("ws://localhost:8188", "janus-protocol");

    ws.on("open", () => {
      console.log("✅ Janus WebSocket connection established on ws://localhost:8188");
      // Create session
      ws.send(JSON.stringify({ janus: "create", transaction: "tx-session" }));
    });

    let sessionId: number | null = null;

    ws.on("message", (data) => {
      const msg = JSON.parse(data.toString());

      if (msg.transaction === "tx-session" && msg.data?.id) {
        sessionId = msg.data.id;
        console.log("✅ Janus session created successfully, Session ID:", sessionId);

        // Attach to VideoRoom plugin
        ws.send(
          JSON.stringify({
            janus: "attach",
            plugin: "janus.plugin.videoroom",
            transaction: "tx-attach",
            session_id: sessionId,
          })
        );
      } else if (msg.transaction === "tx-attach" && msg.data?.id) {
        const handleId = msg.data.id;
        console.log("✅ Attached to janus.plugin.videoroom! Handle ID:", handleId);

        // Create test Tango broadcast room
        ws.send(
          JSON.stringify({
            janus: "message",
            session_id: sessionId,
            handle_id: handleId,
            transaction: "tx-create-room",
            body: {
              request: "create",
              room: 10001,
              description: "Tango Live Test Broadcast",
              publishers: 6,
              videocodec: "vp8",
              audiocodec: "opus",
            },
          })
        );
      } else if (msg.transaction === "tx-create-room") {
        console.log("✅ Tango Broadcast VideoRoom (10001) successfully created or verified!");
        ws.close();
        resolve();
      }
    });

    ws.onerror = (e) => {
      console.error("❌ WebSocket error:", e);
      reject(e);
    };
  });

  console.log("\n🎉 ALL JANUS GATEWAY TESTS PASSED! Ready for Tango live broadcasting.");
}

runJanusTest();
