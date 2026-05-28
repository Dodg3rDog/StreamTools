const path = require("path");
const { REST, Routes, SlashCommandBuilder } = require("discord.js");

require("dotenv").config({
  path: path.join(__dirname, "../.env")
});

const token = process.env.DISCORD_TOKEN;
const clientId = process.env.DISCORD_CLIENT_ID;
const guildId = process.env.DISCORD_GUILD_ID;

if (!token || !clientId || !guildId) {
  console.error("[Discord Redeem Bot] Missing DISCORD_TOKEN, DISCORD_CLIENT_ID, or DISCORD_GUILD_ID.");
  process.exit(1);
}

const commands = [
  new SlashCommandBuilder()
    .setName("redeems")
    .setDescription("Post the Night Howlers redeem board.")
    .toJSON()
];

const rest = new REST({ version: "10" }).setToken(token);

async function registerCommands() {
  console.log("[Discord Redeem Bot] Registering guild slash commands...");

  await rest.put(
    Routes.applicationGuildCommands(clientId, guildId),
    { body: commands }
  );

  console.log("[Discord Redeem Bot] Registered /redeems.");
}

registerCommands().catch((error) => {
  console.error("[Discord Redeem Bot] Failed to register commands:", error);
  process.exit(1);
});
