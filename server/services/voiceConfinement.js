const fs = require("fs");
const { DEFAULT_PHRASES, settingsStore } = require("./voiceConfinementSettings");
const path = require("path");
const { PermissionFlagsBits } = require("discord.js");

const dataDir = path.join(__dirname, "../data/discord");
const statePath = path.join(dataDir, "voice-confinement.json");
const restoreRetryMs = 5 * 60 * 1000;

let discordClient = null;
let stateCache = null;
const releaseTimers = new Map();
const confinementPromises = new Map();
const pendingEatContexts = new Map();
const releasePromises = new Map();

function startVoiceConfinement(client) {
  const config = getConfig();

  if (!config.enabled) {
    console.log("[Voice Confinement] Disabled.");
    return;
  }

  discordClient = client;

  if (!config.channelId || !config.roleId) {
    console.warn("[Voice Confinement] Enabled, but the watched channel or confinement role is missing.");
    return;
  }

  validateConfiguration(config).catch((error) => {
    console.warn("[Voice Confinement] Configuration validation failed:", error.message);
  });

  const records = Object.values(loadState().records);
  records.forEach((record) => scheduleRelease(record));

  console.log(
    "[Voice Confinement] Enabled. Channel=" + config.channelId
      + " Duration=" + Math.round(config.durationMs / 1000) + "s"
      + " SuspendedRoles=" + config.suspendedRoleIds.length
      + " ExemptRoles=" + config.exemptRoleIds.length
      + " ActiveRecords=" + records.length
  );
}

async function handleVoiceConfinementStateUpdate(oldState, newState) {
  const config = getConfig();

  if (!config.enabled || !newState?.member || newState.member.user?.bot) {
    return false;
  }

  if (newState.channelId !== config.channelId || oldState?.channelId === config.channelId) {
    return false;
  }

  const key = recordKey(newState.guild.id, newState.member.id);
  const pendingContext = pendingEatContexts.get(key);
  const context = pendingContext
    ? {
        ...pendingContext,
        originalChannelId: pendingContext.originalChannelId || oldState?.channelId || ""
      }
    : {
        source: "voice-entry",
        originalChannelId: oldState?.channelId || ""
      };

  try {
    await beginConfinement(newState.member, context);
  } catch (error) {
    await writeLog(
      "Confinement failed for " + memberLabel(newState.member) + ": " + error.message,
      "error"
    );
  }

  return true;
}

async function handleVoiceConfinementMessage(message) {
  const config = getConfig();

  if (!config.enabled || !message?.guild || message.author?.bot) {
    return false;
  }

  const prefix = process.env.DISCORD_COMMAND_PREFIX || "!";
  const commandPattern = new RegExp("^" + escapeRegex(prefix) + "(eat|vomit|release)(?:\\s+|$)", "i");
  const commandMatch = String(message.content || "").trim().match(commandPattern);

  if (!commandMatch) {
    return false;
  }

  if (commandMatch[1].toLowerCase() !== "eat") {
    await handleIssuerReleaseCommand(message, config, prefix);
    return true;
  }

  await handleEatCommand(message, config, prefix);
  return true;
}

async function handleEatCommand(message, config, prefix) {
  const issuer = message.member;
  const issuerName = getMemberName(issuer, "Someone");
  const targets = await getMentionedMembers(message);
  const durationOverride = parseDurationOverride(message.content);

  if (!issuer?.voice?.channelId) {
    await replyToCommand(message, formatRandomPhrase(config.phrases.unable, {
      issuer: issuerName,
      target: targets.length ? joinNames(targets.map((target) => getMemberName(target))) : "anyone",
      reason: "you must be in a voice channel to use " + prefix + "eat"
    }));
    return;
  }

  if (targets.length === 0) {
    await replyToCommand(message, formatRandomPhrase(config.phrases.unable, {
      issuer: issuerName,
      target: "anyone",
      reason: "no target was mentioned"
    }));
    return;
  }

  if (durationOverride.error) {
    await replyToCommand(message, formatRandomPhrase(config.phrases.unable, {
      issuer: issuerName,
      target: joinNames(targets.map((target) => getMemberName(target))),
      reason: durationOverride.error
    }));
    return;
  }

  const destination = message.guild.channels.cache.get(config.channelId)
    || await message.guild.channels.fetch(config.channelId).catch(() => null);

  if (!destination?.isVoiceBased?.()) {
    await replyToCommand(message, formatRandomPhrase(config.phrases.unable, {
      issuer: issuerName,
      target: joinNames(targets.map((target) => getMemberName(target))),
      reason: "the Tummy~Time voice channel is unavailable"
    }));
    await writeLog("The !eat command could not run because the confinement voice channel is unavailable.", "error");
    return;
  }

  const responses = [];
  for (const target of targets) {
    responses.push(await eatTarget(message, issuer, target, destination, config, durationOverride.durationMs));
  }

  if (responses.length > 0) {
    await replyToCommand(message, responses.join("\n"));
  }
}

async function eatTarget(message, issuer, target, destination, config, durationMs) {
  const issuerName = getMemberName(issuer, "Someone");
  const targetName = getMemberName(target, "someone");
  const unable = (reason) => formatRandomPhrase(config.phrases.unable, {
    issuer: issuerName,
    target: targetName,
    reason
  });

  if (target.id === issuer.id) {
    return unable("they tried to swallow themselves");
  }

  if (!target.voice?.channelId || target.voice.channelId !== issuer.voice.channelId) {
    return unable("they are not in the same voice channel");
  }

  const exemption = getExemptionReason(target, config);
  if (exemption) {
    await writeLog(
      memberLabel(issuer) + " attempted to confine " + memberLabel(target) + ", but the target was exempt (" + exemption + ").",
      "warning"
    );
    return unable(exemption);
  }

  const key = recordKey(message.guild.id, target.id);
  if (loadState().records[key]) {
    return unable("they are already being digested");
  }

  const sourceChannelId = target.voice.channelId;
  pendingEatContexts.set(key, {
    source: "eat",
    issuerId: issuer.id,
    issuerName,
    originalChannelId: sourceChannelId,
    responseChannelId: message.channelId || message.channel?.id || "",
    durationMs
  });

  try {
    await target.voice.setChannel(destination, "Howler !eat command issued by " + issuer.id);
    const result = await beginConfinement(target, pendingEatContexts.get(key));

    if (!result.ok) {
      throw new Error(result.reason || "confinement did not start");
    }

    const appliedDurationMs = getRecordDurationMs(result.record);
    await sendConfinementNotifications(target, destination, issuerName, appliedDurationMs);

    return formatRandomPhrase(config.phrases.eaten, {
      issuer: issuerName,
      target: targetName,
      channel: "<#" + destination.id + ">",
      duration: formatDuration(appliedDurationMs)
    });
  } catch (error) {
    if (target.voice?.channelId === config.channelId && sourceChannelId) {
      await target.voice.setChannel(sourceChannelId, "Voice confinement failed; returning member").catch(() => null);
    }

    await writeLog(
      "The !eat command failed for " + memberLabel(target) + ": " + error.message,
      "error"
    );
    return unable("something went wrong and staff have been notified");
  } finally {
    pendingEatContexts.delete(key);
  }
}

async function handleIssuerReleaseCommand(message, config, prefix) {
  const issuer = message.member;
  const issuerId = issuer?.id || message.author?.id || "";
  const records = Object.values(loadState().records).filter((record) =>
    record.guildId === message.guild.id && record.issuerId === issuerId
  );

  if (records.length === 0) {
    await replyToCommand(message, "You do not currently have anyone to release.");
    return;
  }

  const pendingNames = [];
  const failedNames = [];
  for (const record of records) {
    record.responseChannelId = message.channelId || message.channel?.id || record.responseChannelId || "";
    saveState();
    clearTimeout(releaseTimers.get(recordKey(record.guildId, record.userId)));
    releaseTimers.delete(recordKey(record.guildId, record.userId));

    try {
      const result = await releaseConfinement(record.guildId, record.userId);
      if (result?.pending) pendingNames.push(record.userName || record.userId);
    } catch (error) {
      failedNames.push(record.userName || record.userId);
      const current = loadState().records[recordKey(record.guildId, record.userId)];
      if (current) scheduleRelease(current);
      await writeLog(
        "The " + prefix + "release command failed for " + (record.userName || record.userId) + ": " + error.message,
        "error"
      );
    }
  }

  if (pendingNames.length > 0 || failedNames.length > 0) {
    const messages = [];
    if (pendingNames.length > 0) messages.push("Role restoration is still pending for " + joinNames(pendingNames) + ". Howler will retry.");
    if (failedNames.length > 0) messages.push("Howler could not release " + joinNames(failedNames) + ". Staff have been notified.");
    await replyToCommand(message, messages.join("\n"));
  }
}

function beginConfinement(member, context = {}) {
  const key = recordKey(member.guild.id, member.id);
  const existingPromise = confinementPromises.get(key);

  if (existingPromise) {
    return existingPromise;
  }

  const promise = applyConfinement(member, context)
    .finally(() => confinementPromises.delete(key));

  confinementPromises.set(key, promise);
  return promise;
}

async function applyConfinement(member, context) {
  const config = getConfig();
  const key = recordKey(member.guild.id, member.id);
  const state = loadState();

  if (state.records[key]) {
    return { ok: true, alreadyActive: true, record: state.records[key] };
  }

  const exemption = getExemptionReason(member, config);
  if (exemption) {
    await writeLog(
      "Skipped confinement for " + memberLabel(member) + " (" + exemption + ").",
      "warning"
    );
    return { ok: false, exempt: true, reason: exemption };
  }

  const confinementRole = member.guild.roles.cache.get(config.roleId)
    || await member.guild.roles.fetch(config.roleId).catch(() => null);

  if (!confinementRole || confinementRole.managed || !confinementRole.editable) {
    throw new Error("the confinement role is missing or above Howler in the role hierarchy");
  }

  const rolesToRemove = config.suspendedRoleIds
    .map((roleId) => member.roles.cache.get(roleId))
    .filter(Boolean);
  const unmanageableRoles = rolesToRemove.filter((role) => role.managed || !role.editable);

  if (unmanageableRoles.length > 0) {
    throw new Error(
      "Howler cannot remove configured role(s): "
        + unmanageableRoles.map((role) => role.name + " (" + role.id + ")").join(", ")
    );
  }

  const now = Date.now();
  const durationMs = Number.isFinite(context.durationMs)
    ? clampNumber(context.durationMs, 1000, 24 * 60 * 60 * 1000)
    : config.durationMs;
  const record = {
    guildId: member.guild.id,
    userId: member.id,
    userName: member.displayName || member.user?.username || "",
    channelId: config.channelId,
    originalChannelId: context.originalChannelId || "",
    confinementRoleId: config.roleId,
    originalRoleIds: member.roles.cache
      .filter((role) => role.id !== member.guild.id)
      .map((role) => role.id),
    removedRoleIds: rolesToRemove.map((role) => role.id),
    startedAt: now,
    releaseAt: now + durationMs,
    durationSeconds: Math.round(durationMs / 1000),
    source: context.source || "voice-entry",
    issuerId: context.issuerId || "",
    issuerName: context.issuerName || "",
    responseChannelId: context.responseChannelId || "",
    status: "applying",
    restoreAttempts: 0
  };

  state.records[key] = record;
  saveState();

  let confinementRoleAdded = false;

  try {
    if (!member.roles.cache.has(config.roleId)) {
      await member.roles.add(config.roleId, "Voice confinement started");
      confinementRoleAdded = true;
    }

    if (record.removedRoleIds.length > 0) {
      await member.roles.remove(record.removedRoleIds, "Temporarily suspended for voice confinement");
    }

    record.status = "active";
    saveState();
    scheduleRelease(record);

    const removedText = rolesToRemove.length > 0
      ? rolesToRemove.map((role) => role.name + " (" + role.id + ")").join(", ")
      : "none";

    await writeLog(
      "Confinement started for " + memberLabel(member)
        + ". Source: " + record.source
        + ". Removed roles: " + removedText
        + ". Release: <t:" + Math.floor(record.releaseAt / 1000) + ":F>.",
      "start"
    );

    return { ok: true, record };
  } catch (error) {
    if (record.removedRoleIds.length > 0) {
      await member.roles.add(record.removedRoleIds, "Rolling back failed voice confinement").catch(() => null);
    }

    if (confinementRoleAdded) {
      await member.roles.remove(config.roleId, "Rolling back failed voice confinement").catch(() => null);
    }

    delete state.records[key];
    saveState();
    throw error;
  }
}

function scheduleRelease(record) {
  const key = recordKey(record.guildId, record.userId);
  const existingTimer = releaseTimers.get(key);

  if (existingTimer) {
    clearTimeout(existingTimer);
  }

  const delay = record.status === "restore_failed"
    ? Math.max(Number(record.nextRetryAt || Date.now()) - Date.now(), 1000)
    : Math.max(record.releaseAt - Date.now(), 1000);
  const timer = setTimeout(() => {
    releaseTimers.delete(key);
    releaseConfinement(record.guildId, record.userId).catch((error) => {
      console.error("[Voice Confinement] Release failed:", error);
    });
  }, delay);

  timer.unref?.();
  releaseTimers.set(key, timer);
}

function releaseConfinement(guildId, userId) {
  const key = recordKey(guildId, userId);
  if (releasePromises.has(key)) return releasePromises.get(key);
  const pending = Promise.resolve().then(() => performReleaseConfinement(guildId, userId))
    .finally(() => releasePromises.delete(key));
  releasePromises.set(key, pending);
  return pending;
}

async function performReleaseConfinement(guildId, userId) {
  const key = recordKey(guildId, userId);
  const state = loadState();
  const record = state.records[key];

  if (!record) {
    return { pending: false, missing: true };
  }

  if (!discordClient?.isReady?.()) {
    return { pending: true, offline: true };
  }

  const guild = discordClient.guilds.cache.get(guildId)
    || await discordClient.guilds.fetch(guildId).catch(() => null);
  const member = guild
    ? await guild.members.fetch(userId).catch(() => null)
    : null;

  if (!guild) {
    delete state.records[key];
    saveState();
    await writeLog("Removed an expired confinement record because guild " + guildId + " is no longer available.", "warning");
    return { pending: false, missing: true, outcome: "permanent", announced: false };
  }

  if (!member) {
    delete state.records[key];
    saveState();
    const announced = await sendReleaseAnnouncement(guild, record, null, "permanent");
    await writeLog("Removed an expired confinement record because member " + userId + " is no longer available.", "warning");
    return { pending: false, missing: true, outcome: "permanent", announced };
  }

  let voiceReleaseOutcome = record.voiceReleaseOutcome || "";
  let voiceReleaseDescription = record.voiceReleaseDescription || "";
  let voiceReleaseError = null;
  if (!voiceReleaseOutcome) {
    if (member.voice?.channelId === record.channelId) {
      const originalChannel = record.originalChannelId
        ? guild.channels.cache.get(record.originalChannelId)
          || await guild.channels.fetch(record.originalChannelId).catch(() => null)
        : null;

      if (originalChannel?.isVoiceBased?.() && originalChannel.id !== record.channelId) {
        try {
          await member.voice.setChannel(originalChannel, "Voice confinement period completed");
          voiceReleaseOutcome = "returned";
          voiceReleaseDescription = "Returned to <#" + originalChannel.id + ">.";
        } catch (error) {
          voiceReleaseError = "Return to the original channel failed: " + error.message;
        }
      } else {
        voiceReleaseError = record.originalChannelId
          ? "The original voice channel is no longer available."
          : "No original voice channel was recorded.";
      }

      if (voiceReleaseError) {
        try {
          await member.voice.disconnect("Voice confinement completed; original channel unavailable");
          voiceReleaseOutcome = "permanent";
          voiceReleaseDescription = "Disconnected because returning to the original channel was not possible.";
        } catch (error) {
          voiceReleaseError += " Fallback disconnect failed: " + error.message;
          voiceReleaseOutcome = "permanent";
          voiceReleaseDescription = "Could not move or disconnect the member.";
        }
      }
    } else if (record.status === "restore_failed" && member.voice?.channelId === record.originalChannelId) {
      voiceReleaseOutcome = "returned";
      voiceReleaseDescription = "The member had already been returned to <#" + record.originalChannelId + ">.";
    } else {
      voiceReleaseOutcome = "permanent";
      voiceReleaseDescription = "The member was no longer in the confinement channel.";
    }

    record.voiceReleaseOutcome = voiceReleaseOutcome;
    record.voiceReleaseDescription = voiceReleaseDescription;
    saveState();
  }

  await guild.roles.fetch().catch(() => null);
  const restoreFailures = [];
  const deletedRoles = [];

  for (const roleId of record.removedRoleIds || []) {
    const role = guild.roles.cache.get(roleId);

    if (!role) {
      deletedRoles.push(roleId);
      continue;
    }

    if (member.roles.cache.has(roleId)) {
      continue;
    }

    if (role.managed || !role.editable) {
      restoreFailures.push(roleId);
      continue;
    }

    try {
      await member.roles.add(roleId, "Restoring role after voice confinement");
    } catch {
      restoreFailures.push(roleId);
    }
  }

  let confinementRoleRemovalFailed = false;
  if (member.roles.cache.has(record.confinementRoleId)) {
    const confinementRole = guild.roles.cache.get(record.confinementRoleId);

    if (!confinementRole || confinementRole.managed || !confinementRole.editable) {
      confinementRoleRemovalFailed = true;
    } else {
      try {
        await member.roles.remove(record.confinementRoleId, "Voice confinement period completed");
      } catch {
        confinementRoleRemovalFailed = true;
      }
    }
  }

  if (restoreFailures.length === 0 && !confinementRoleRemovalFailed) {
    delete state.records[key];
    saveState();
    const announced = await sendReleaseAnnouncement(guild, record, member, voiceReleaseOutcome);
    await writeLog(
      "Confinement released for " + memberLabel(member)
        + ". Restored roles: " + ((record.removedRoleIds || []).length - deletedRoles.length)
        + ". Voice action: " + voiceReleaseDescription
        + (voiceReleaseError ? " " + voiceReleaseError : ""),
      voiceReleaseError ? "warning" : "release"
    );
    return { pending: false, outcome: voiceReleaseOutcome, announced };
  }

  record.removedRoleIds = restoreFailures;
  record.status = "restore_failed";
  record.restoreAttempts = Number(record.restoreAttempts || 0) + 1;
  record.nextRetryAt = Date.now() + restoreRetryMs;
  saveState();
  scheduleRelease(record);

  await writeLog(
    "Confinement release needs attention for " + memberLabel(member)
      + ". Roles still pending: " + (restoreFailures.join(", ") || "none")
      + ". Confinement role removal failed: " + confinementRoleRemovalFailed
      + ". Voice action: " + voiceReleaseDescription
      + (voiceReleaseError ? " " + voiceReleaseError : ""),
    "error"
  );
  return { pending: true, outcome: voiceReleaseOutcome, announced: false };
}

async function sendReleaseAnnouncement(guild, record, member, outcome) {
  if (record.source !== "eat" || !record.issuerId || !record.responseChannelId) {
    return false;
  }

  const channel = guild.channels.cache.get(record.responseChannelId)
    || await guild.channels.fetch(record.responseChannelId).catch(() => null);

  if (!channel?.isTextBased?.()) {
    return false;
  }

  const config = getConfig();
  const phraseList = outcome === "returned" ? config.phrases.released : config.phrases.permanent;
  const content = formatRandomPhrase(phraseList, {
    issuer: record.issuerName || "Someone",
    target: getMemberName(member, record.userName || "someone"),
    channel: record.originalChannelId ? "<#" + record.originalChannelId + ">" : "their original voice chat",
    duration: formatDuration(getRecordDurationMs(record))
  });

  try {
    await channel.send({ content: content.slice(0, 2000), allowedMentions: { parse: [] } });
    return true;
  } catch (error) {
    console.warn("[Voice Confinement] Failed to send release phrase:", error.message);
    return false;
  }
}

async function sendConfinementNotifications(target, destination, issuerName, durationMs) {
  const content = "Hey <@" + target.id + ">, " + issuerName
    + " ate you. You will be in Tummy~Time for " + formatDuration(durationMs) + ".";
  const payload = {
    content,
    allowedMentions: { parse: [], users: [target.id] }
  };
  const deliveries = await Promise.allSettled([
    typeof target.send === "function"
      ? target.send(payload)
      : Promise.reject(new Error("the member cannot receive direct messages")),
    typeof destination.send === "function"
      ? destination.send(payload)
      : Promise.reject(new Error("the Tummy~Time channel does not support messages"))
  ]);
  const failures = [];

  if (deliveries[0].status === "rejected") {
    failures.push("DM: " + deliveries[0].reason.message);
  }

  if (deliveries[1].status === "rejected") {
    failures.push("voice chat: " + deliveries[1].reason.message);
  }

  if (failures.length > 0) {
    await writeLog(
      "Confinement notification delivery was incomplete for " + memberLabel(target)
        + ". " + failures.join("; "),
      "warning"
    );
  }
}

function getExemptionReason(member, config = getConfig()) {
  if (!member) {
    return "member unavailable";
  }

  if (member.user?.bot) {
    return "bot account";
  }

  if (member.id === member.guild.ownerId) {
    return "server owner";
  }

  if (member.permissions?.has?.(PermissionFlagsBits.Administrator)) {
    return "administrator";
  }

  if (member.roles?.cache?.some?.((role) => config.exemptRoleIds.includes(role.id))) {
    return "exempt role";
  }

  if (!member.manageable) {
    return "member is above Howler in the role hierarchy";
  }

  return "";
}

async function validateConfiguration(config) {
  if (!discordClient?.isReady?.()) {
    return;
  }

  const guildId = process.env.DISCORD_GUILD_ID || "";
  const guild = discordClient.guilds.cache.get(guildId)
    || await discordClient.guilds.fetch(guildId);
  const botMember = guild.members.me || await guild.members.fetchMe();
  const missingPermissions = [];

  if (!botMember.permissions.has(PermissionFlagsBits.ManageRoles)) {
    missingPermissions.push("Manage Roles");
  }

  if (!botMember.permissions.has(PermissionFlagsBits.MoveMembers)) {
    missingPermissions.push("Move Members");
  }

  if (missingPermissions.length > 0) {
    await writeLog("Howler is missing required permission(s): " + missingPermissions.join(", ") + ".", "error");
  }

  const configuredRoleIds = [config.roleId, ...config.suspendedRoleIds, ...config.exemptRoleIds];
  const missingRoleIds = configuredRoleIds.filter((roleId) => !guild.roles.cache.has(roleId));

  if (missingRoleIds.length > 0) {
    await writeLog("Voice confinement references missing role IDs: " + missingRoleIds.join(", ") + ".", "warning");
  }

  const watchedChannel = guild.channels.cache.get(config.channelId)
    || await guild.channels.fetch(config.channelId).catch(() => null);

  if (!watchedChannel?.isVoiceBased?.()) {
    await writeLog("The configured confinement channel is missing or is not voice based.", "error");
    return;
  }

  const channelPermissions = watchedChannel.permissionsFor?.(botMember);
  const missingChannelPermissions = [];

  if (channelPermissions && !channelPermissions.has(PermissionFlagsBits.ViewChannel)) {
    missingChannelPermissions.push("View Channel");
  }

  if (channelPermissions && !channelPermissions.has(PermissionFlagsBits.SendMessages)) {
    missingChannelPermissions.push("Send Messages");
  }

  if (missingChannelPermissions.length > 0) {
    await writeLog(
      "Howler is missing Tummy~Time channel permission(s): " + missingChannelPermissions.join(", ") + ".",
      "error"
    );
  }
}

async function writeLog(text, level = "info") {
  const line = "[Voice Confinement] " + text;

  if (level === "error") {
    console.error(line);
  } else if (level === "warning") {
    console.warn(line);
  } else {
    console.log(line);
  }

  const channelId = getConfig().logChannelId;
  if (!channelId || !discordClient?.isReady?.()) {
    return;
  }

  const channel = discordClient.channels.cache.get(channelId)
    || await discordClient.channels.fetch(channelId).catch(() => null);

  if (!channel?.isTextBased?.()) {
    return;
  }

  await channel.send({
    content: String(text || "").slice(0, 2000),
    allowedMentions: { parse: [] }
  }).catch((error) => {
    console.warn("[Voice Confinement] Failed to write Discord log:", error.message);
  });
}

async function replyToCommand(message, content) {
  await message.reply({
    content: String(content || "").slice(0, 2000),
    allowedMentions: {
      parse: [],
      repliedUser: false
    }
  });
}

function getConfig() {
  const saved = settingsStore.load();
  return {
    enabled: parseBoolean(process.env.ENABLE_VOICE_CONFINEMENT, false),
    channelId: String(process.env.VOICE_CONFINEMENT_CHANNEL_ID || "").trim(),
    roleId: String(process.env.VOICE_CONFINEMENT_ROLE_ID || "").trim(),
    suspendedRoleIds: parseCsv(process.env.VOICE_CONFINEMENT_SUSPENDED_ROLE_IDS),
    exemptRoleIds: saved?.exemptRoleIds ?? parseCsv(process.env.VOICE_CONFINEMENT_EXEMPT_ROLE_IDS),
    durationMs: (saved?.durationSeconds ?? clampNumber(process.env.VOICE_CONFINEMENT_DURATION_SECONDS || 300, 30, 86400)) * 1000,
    phrases: saved?.phrases ?? cloneDefaultPhrases(),
    logChannelId: String(process.env.VOICE_CONFINEMENT_LOG_CHANNEL_ID || "").trim()
  };
}

function loadState() {
  if (stateCache) {
    return stateCache;
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(statePath, "utf8"));
    stateCache = parsed && typeof parsed.records === "object"
      ? parsed
      : { records: {} };
  } catch {
    stateCache = { records: {} };
  }

  return stateCache;
}

function saveState() {
  fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(statePath, JSON.stringify(loadState(), null, 2), "utf8");
}

function recordKey(guildId, userId) {
  return String(guildId || "") + ":" + String(userId || "");
}

function memberLabel(member) {
  const name = getMemberName(member, "Unknown user");
  return name + " (" + (member?.id || "unknown") + ")";
}

function getMemberName(member, fallback = "someone") {
  return member?.displayName || member?.user?.globalName || member?.user?.username || fallback;
}

async function getMentionedMembers(message) {
  const members = [];
  const seen = new Set();

  for (const member of message.mentions?.members?.values?.() || []) {
    if (member?.id && !seen.has(member.id)) {
      seen.add(member.id);
      members.push(member);
    }
  }

  for (const user of message.mentions?.users?.values?.() || []) {
    if (!user?.id || seen.has(user.id)) continue;
    const member = await message.guild.members.fetch(user.id).catch(() => null);
    if (member) {
      seen.add(member.id);
      members.push(member);
    }
  }

  return members;
}

function joinNames(names) {
  const values = names.filter(Boolean);
  if (values.length <= 1) return values[0] || "someone";
  if (values.length === 2) return values[0] + " and " + values[1];
  return values.slice(0, -1).join(", ") + ", and " + values[values.length - 1];
}

function parseDurationOverride(content) {
  const tokens = String(content || "").trim().split(/\s+/).slice(1);
  const durationTokens = tokens.filter((token) => /^\d+[sm]$/i.test(token));
  const invalidDurationToken = tokens.find((token) => /^\d+(?:\.\d+)?[a-z]+$/i.test(token) && !/^\d+[sm]$/i.test(token));

  if (invalidDurationToken) {
    return { durationMs: null, error: "the duration must be a whole number followed by s or m, such as 60s or 1m" };
  }

  if (durationTokens.length > 1) {
    return { durationMs: null, error: "only one duration can be used per command" };
  }

  if (durationTokens.length === 0) {
    return { durationMs: null, error: "" };
  }

  const match = durationTokens[0].match(/^(\d+)([sm])$/i);
  const amount = Number(match[1]);
  const seconds = amount * (match[2].toLowerCase() === "m" ? 60 : 1);

  if (!Number.isSafeInteger(seconds) || seconds < 1 || seconds > 86400) {
    return { durationMs: null, error: "the duration must be between 1s and 1440m (24 hours)" };
  }

  return { durationMs: seconds * 1000, error: "" };
}

function getRecordDurationMs(record) {
  const storedSeconds = Number(record?.durationSeconds);
  if (Number.isFinite(storedSeconds) && storedSeconds > 0) {
    return storedSeconds * 1000;
  }

  return Math.max(Number(record?.releaseAt || 0) - Number(record?.startedAt || 0), 0);
}

function formatDuration(durationMs) {
  const seconds = Math.max(Math.round(Number(durationMs || 0) / 1000), 0);
  if (seconds > 0 && seconds % 60 === 0) {
    const minutes = seconds / 60;
    return minutes + (minutes === 1 ? " minute" : " minutes");
  }

  return seconds + (seconds === 1 ? " second" : " seconds");
}

function formatRandomPhrase(phrases, values = {}) {
  const list = Array.isArray(phrases) && phrases.length > 0 ? phrases : ["{issuer}: {target}"];
  const template = list[Math.floor(Math.random() * list.length)] || list[0];
  return String(template).replace(/\{(issuer|target|targets|channel|reason|count|duration)\}/gi, (match, key) => {
    const value = values[key.toLowerCase()];
    return value == null || value === "" ? match : String(value);
  });
}

function cloneDefaultPhrases() {
  return Object.fromEntries(
    Object.entries(DEFAULT_PHRASES).map(([key, phrases]) => [key, [...phrases]])
  );
}

function parseCsv(value) {
  return Array.from(new Set(
    String(value || "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean)
  ));
}

function parseBoolean(value, fallback) {
  if (value == null || value === "") {
    return fallback;
  }

  return ["1", "true", "yes", "on"].includes(String(value).toLowerCase());
}

function clampNumber(value, min, max) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return min;
  }

  return Math.min(Math.max(number, min), max);
}

function escapeRegex(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getVoiceConfinementStatus() {
  const config = getConfig();
  const guild = discordClient?.guilds?.cache?.get(process.env.DISCORD_GUILD_ID || "");
  const channel = id => ({ id, name: guild?.channels?.cache?.get(id)?.name || id || "Not configured" });
  const role = id => ({ id, name: guild?.roles?.cache?.get(id)?.name || id || "Not configured" });
  return {
    enabled: config.enabled,
    ready: Boolean(discordClient?.isReady?.()),
    command: (process.env.DISCORD_COMMAND_PREFIX || "!") + "eat @user [duration]",
    releaseCommands: [
      (process.env.DISCORD_COMMAND_PREFIX || "!") + "vomit",
      (process.env.DISCORD_COMMAND_PREFIX || "!") + "release"
    ],
    durationSeconds: config.durationMs / 1000,
    channel: channel(config.channelId),
    confinementRole: role(config.roleId),
    logChannel: channel(config.logChannelId),
    suspendedRoles: config.suspendedRoleIds.map(role),
    exemptRoles: config.exemptRoleIds.map(role),
    phrases: config.phrases,
    availableRoles: [...(guild?.roles?.cache?.values() || [])].filter(role => role.id !== guild.id).map(role => ({ id: role.id, name: role.name })).sort((a, b) => a.name.localeCompare(b.name)),
    records: Object.values(loadState().records).map(record => ({
      guildId: record.guildId, userId: record.userId, userName: record.userName,
      status: record.status, releaseAt: record.releaseAt, nextRetryAt: record.nextRetryAt,
      durationSeconds: Math.round(getRecordDurationMs(record) / 1000),
      restoreAttempts: record.restoreAttempts || 0,
      issuerName: record.issuerName || "",
      originalChannel: channel(record.originalChannelId),
      removedRoles: (record.removedRoleIds || []).map(role),
      busy: confinementPromises.has(recordKey(record.guildId, record.userId)) || releasePromises.has(recordKey(record.guildId, record.userId))
    }))
  };
}

async function releaseVoiceConfinementFromAdmin(guildId, userId) {
  const key = recordKey(guildId, userId);
  if (!discordClient?.isReady?.()) throw new Error("Howler is not connected to Discord.");
  if (confinementPromises.has(key)) throw new Error("Confinement is still being applied. Refresh and try again.");
  if (!loadState().records[key]) throw new Error("This confinement record is no longer active.");
  clearTimeout(releaseTimers.get(key));
  releaseTimers.delete(key);
  try {
    await releaseConfinement(guildId, userId);
  } catch (error) {
    const record = loadState().records[key];
    if (record) scheduleRelease(record);
    throw error;
  }
  return { pending: Boolean(loadState().records[key]), status: getVoiceConfinementStatus() };
}

module.exports = {
  getVoiceConfinementStatus,
  releaseVoiceConfinementFromAdmin,
  handleVoiceConfinementMessage,
  handleVoiceConfinementStateUpdate,
  startVoiceConfinement
};
