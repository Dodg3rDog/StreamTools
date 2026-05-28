const fs = require("fs");
const path = require("path");

const dataDir = path.join(__dirname, "../data/discord");
const relayChannelsPath = path.join(dataDir, "relay-channels.json");

let runtimeChannelIds = null;

function getRelayChannelIds() {
  return Array.from(new Set([
    ...getEnvChannelIds(),
    ...getRuntimeChannelIds()
  ]));
}

function isRelayChannelAllowed(channelId) {
  const channelIds = getRelayChannelIds();

  if (channelIds.length === 0) {
    return true;
  }

  return channelIds.includes(String(channelId || ""));
}

function addRelayChannel(channelId) {
  const normalizedChannelId = String(channelId || "").trim();
  if (!normalizedChannelId) {
    return getRelayChannelIds();
  }

  const channelIds = getRuntimeChannelIds();
  if (!channelIds.includes(normalizedChannelId)) {
    channelIds.push(normalizedChannelId);
    saveRuntimeChannelIds(channelIds);
  }

  return getRelayChannelIds();
}

function removeRelayChannel(channelId) {
  const normalizedChannelId = String(channelId || "").trim();
  if (!normalizedChannelId) {
    return getRelayChannelIds();
  }

  const channelIds = getRuntimeChannelIds().filter((id) => id !== normalizedChannelId);
  saveRuntimeChannelIds(channelIds);

  return getRelayChannelIds();
}

function getEnvChannelIds() {
  return parseCsv(process.env.DISCORD_RELAY_CHANNEL_IDS || "");
}

function getRuntimeChannelIds() {
  if (runtimeChannelIds) {
    return runtimeChannelIds;
  }

  try {
    const data = JSON.parse(fs.readFileSync(relayChannelsPath, "utf8"));
    runtimeChannelIds = Array.isArray(data.channelIds)
      ? data.channelIds.map(String).filter(Boolean)
      : [];
  } catch {
    runtimeChannelIds = [];
  }

  return runtimeChannelIds;
}

function saveRuntimeChannelIds(channelIds) {
  runtimeChannelIds = Array.from(new Set(channelIds.map(String).filter(Boolean)));

  fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(
    relayChannelsPath,
    JSON.stringify({
      channelIds: runtimeChannelIds,
      updatedAt: new Date().toISOString()
    }, null, 2),
    "utf8"
  );
}

function parseCsv(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

module.exports = {
  addRelayChannel,
  getRelayChannelIds,
  isRelayChannelAllowed,
  removeRelayChannel
};
