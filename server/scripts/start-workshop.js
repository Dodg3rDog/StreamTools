// ------------------------------------------------------------
// Workshop Server Startup
// ------------------------------------------------------------
// Starts StreamTools on a local-only workshop port so testing does
// not collide with the live web server address.

process.env.HOST = process.env.HOST || "127.0.0.1";
process.env.PORT = process.env.PORT || "3055";

console.log("[Workshop] Starting StreamTools workshop server");
console.log(`[Workshop] PiShock widget: http://${process.env.HOST}:${process.env.PORT}/widgets/pishock-status/`);
console.log(`[Workshop] Drawing slot widget: http://${process.env.HOST}:${process.env.PORT}/widgets/drawing-slot-machine/`);
console.log(`[Workshop] Code Break Protocol: http://${process.env.HOST}:${process.env.PORT}/widgets/chat-games/apps/code-break-protocol/`);
console.log(`[Workshop] Emote Sync Protocol: http://${process.env.HOST}:${process.env.PORT}/widgets/chat-games/apps/emote-sync-protocol/`);
console.log(`[Workshop] Health: http://${process.env.HOST}:${process.env.PORT}/health`);

require("../server");
