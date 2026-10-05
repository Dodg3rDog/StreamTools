const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const path = require("path");

require("dotenv").config({
  path: path.join(__dirname, "../.env")
});

const healthRoutes = require("./routes/health");
const timerRoutes = require("./routes/timers");
const pishockRoutes = require("./routes/pishock");
const discordRoutes = require("./routes/discord");
const commissionDocsRoutes = require("./routes/commission-docs");
const pointsRoutes = require("./routes/points");
const overlayRoutes = require("./routes/overlays");
const drawingSlotMachineRoutes = require("./routes/drawing-slot-machine");
const codeBreakProtocolRoutes = require("./routes/chat-games-code-break-protocol");
const emoteSyncProtocolRoutes = require("./routes/chat-games-emote-sync-protocol");
const { startDiscordBot } = require("./services/discordBot");
const { startTelegramBot } = require("./services/telegramBot");

const app = express();

const PORT = process.env.PORT || 3030;
const HOST = process.env.HOST || "0.0.0.0";

app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginOpenerPolicy: false
  })
);
app.use(cors());
app.use(express.json());
// OAuth callback codes must never appear in HTTP access logs.
app.use(morgan("dev", {skip: req => req.path === '/api/chatsona/oauth/callback'}));

// Static widget files
app.use(express.static(path.join(__dirname, "../public")));

app.use("/", healthRoutes);
app.use("/api", healthRoutes);
app.use("/api/timers", timerRoutes);
app.use("/api/pishock", pishockRoutes);
app.use("/api/discord", discordRoutes);
app.use("/api/commission-docs", commissionDocsRoutes);
app.use("/api/points", pointsRoutes);
app.use("/api/overlays", overlayRoutes);
app.use(require("./routes/viewer-pages"));
app.use("/api/twitch", require("./routes/twitch-intake"));
app.use("/api/chatsona", require("./routes/chatsona"));
app.use("/api/custom-chat", require("./routes/custom-chat"));
app.use("/api/drawing-slot-machine", drawingSlotMachineRoutes);
app.use("/api/chat-games/code-break-protocol", codeBreakProtocolRoutes);
app.use("/api/chat-games/emote-sync-protocol", emoteSyncProtocolRoutes);

const server = app.listen(PORT, HOST, () => {
  console.log(`StreamTools server running at http://${HOST}:${PORT}`);
});

startDiscordBot().catch((error) => {
  console.error("[Discord Bot] Startup failed:", error);
});

startTelegramBot().catch((error) => {
  console.error("[Telegram Bot] Startup failed:", error);
});

// Stop accepting requests, drain existing responses, then release integrations.
app.locals.restartServer = () => {
  server.close(() => process.exit(75));
  setTimeout(() => process.exit(75), 5000).unref();
};
