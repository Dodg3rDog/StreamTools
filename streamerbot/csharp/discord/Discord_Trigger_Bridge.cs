using System;
using System.Collections.Generic;

public class CPHInline
{
    // Configure this Execute C# Code action with the name:
    // Discord Trigger Bridge
    //
    // Enable "Precompile on Application start" for this action so Init()
    // registers the custom triggers whenever Streamer.bot starts.

    private const string RedeemEvent = "streamtools.discord.redeem";
    private const string MessageEvent = "streamtools.discord.message";
    private const string CommandEvent = "streamtools.discord.command";

    public void Init()
    {
        RegisterDiscordTrigger("Discord Redeem", RedeemEvent);
        RegisterDiscordTrigger("Discord Chat Message", MessageEvent);
        RegisterDiscordTrigger("Discord Command", CommandEvent);

        RegisterDiscordTrigger("Discord Redeem: Ask Question", RedeemEvent + ".ask_question");
        RegisterDiscordTrigger("Discord Redeem: Join Queue", RedeemEvent + ".join_queue");
        RegisterDiscordTrigger("Discord Redeem: Trigger Howl", RedeemEvent + ".trigger_howl");
        RegisterDiscordTrigger("Discord Redeem: Summon HR", RedeemEvent + ".summon_hr");
        RegisterDiscordTrigger("Discord Redeem: Make It Sus", RedeemEvent + ".make_it_sus");
        RegisterDiscordTrigger("Discord Redeem: Change Overlay Color", RedeemEvent + ".change_overlay_color");

        CPH.LogInfo("[Discord Trigger Bridge] Custom Discord triggers registered.");
    }

    public bool Execute()
    {
        Dictionary<string, object> eventArgs = BuildDiscordArgs();
        string eventType = GetStringArg("discordEventType", "");

        if (eventType.Equals("redeem", StringComparison.OrdinalIgnoreCase))
        {
            TriggerCodeEvent(RedeemEvent, eventArgs);

            string redeemId = NormalizeEventKey(GetStringArg("discordRedeemId", ""));
            if (!string.IsNullOrWhiteSpace(redeemId))
                TriggerCodeEvent(RedeemEvent + "." + redeemId, eventArgs);

            return true;
        }

        if (eventType.Equals("command", StringComparison.OrdinalIgnoreCase))
        {
            TriggerCodeEvent(CommandEvent, eventArgs);

            string command = NormalizeEventKey(GetStringArg("discordCommand", ""));
            if (!string.IsNullOrWhiteSpace(command))
                TriggerCodeEvent(CommandEvent + "." + command, eventArgs);

            return true;
        }

        TriggerCodeEvent(MessageEvent, eventArgs);
        return true;
    }

    private void RegisterDiscordTrigger(string triggerName, string eventName)
    {
        try
        {
            CPH.RegisterCustomTrigger(triggerName, eventName, new string[] { "StreamTools", "Discord" });
        }
        catch (Exception ex)
        {
            CPH.LogError("[Discord Trigger Bridge] Failed to register trigger " + triggerName + ": " + ex.Message);
        }
    }

    private void TriggerCodeEvent(string eventName, Dictionary<string, object> eventArgs)
    {
        try
        {
            CPH.TriggerCodeEvent(eventName, eventArgs);
            CPH.LogInfo("[Discord Trigger Bridge] Triggered " + eventName);
        }
        catch (Exception ex)
        {
            CPH.LogError("[Discord Trigger Bridge] Failed to trigger " + eventName + ": " + ex.Message);
        }
    }

    private Dictionary<string, object> BuildDiscordArgs()
    {
        Dictionary<string, object> eventArgs = new Dictionary<string, object>();

        AddArg(eventArgs, "discordEventType");
        AddArg(eventArgs, "discordRedeemId");
        AddArg(eventArgs, "discordRedeemLabel");
        AddArg(eventArgs, "discordRedeemStyle");
        AddArg(eventArgs, "discordUserName");
        AddArg(eventArgs, "discordUserId");
        AddArg(eventArgs, "discordGuildId");
        AddArg(eventArgs, "discordChannelId");
        AddArg(eventArgs, "discordMessageId");
        AddArg(eventArgs, "discordMessage");
        AddArg(eventArgs, "discordHasMedia");
        AddArg(eventArgs, "discordAttachmentCount");
        AddArg(eventArgs, "discordStickerCount");
        AddArg(eventArgs, "discordEmbedCount");
        AddArg(eventArgs, "discordMediaTypes");
        AddArg(eventArgs, "discordIsCommand");
        AddArg(eventArgs, "discordCommand");
        AddArg(eventArgs, "discordCommandArgs");
        AddArg(eventArgs, "discordTimestamp");
        AddArg(eventArgs, "discordRawPayload");

        return eventArgs;
    }

    private void AddArg(Dictionary<string, object> eventArgs, string name)
    {
        object value;
        if (args.TryGetValue(name, out value))
            eventArgs[name] = value;
    }

    private string GetStringArg(string name, string fallback)
    {
        try
        {
            string value;
            if (CPH.TryGetArg(name, out value))
                return string.IsNullOrWhiteSpace(value) ? fallback : value;

            return fallback;
        }
        catch { return fallback; }
    }

    private string NormalizeEventKey(string value)
    {
        string input = (value ?? "").Trim().ToLowerInvariant();
        string output = "";

        for (int i = 0; i < input.Length; i++)
        {
            char c = input[i];
            if ((c >= 'a' && c <= 'z') || (c >= '0' && c <= '9') || c == '_')
                output += c;
        }

        return output;
    }
}
