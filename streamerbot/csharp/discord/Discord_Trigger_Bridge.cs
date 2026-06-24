using System;
using System.Collections.Generic;
using System.IO;
using System.Net;

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
    private const string DefaultStreamToolsBaseUrl = "http://127.0.0.1:3030";
    private const string FallbackStreamToolsBaseUrl = "http://127.0.0.1:3055";

    public void Init()
    {
        int count = RegisterTriggersFromStreamTools();

        if (count <= 0)
            count = RegisterFallbackTriggers();

        CPH.LogInfo("[Discord Trigger Bridge] Custom Discord triggers registered. Count=" + count);
    }

    public bool Execute()
    {
        Dictionary<string, object> eventArgs = BuildDiscordArgs();
        ApplyDiscordUserArgs(eventArgs);
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

    private int RegisterTriggersFromStreamTools()
    {
        string[] urls = GetTriggerDefinitionUrls();

        for (int i = 0; i < urls.Length; i++)
        {
            string url = urls[i];
            if (string.IsNullOrWhiteSpace(url))
                continue;

            try
            {
                string body = DownloadText(url);
                int count = RegisterTriggerLines(body);

                if (count > 0)
                {
                    CPH.LogInfo("[Discord Trigger Bridge] Loaded trigger definitions from " + url);
                    return count;
                }

                CPH.LogError("[Discord Trigger Bridge] Trigger definition response was empty or invalid from " + url);
            }
            catch (Exception ex)
            {
                CPH.LogError("[Discord Trigger Bridge] Failed to fetch trigger definitions from " + url + ": " + ex.Message);
            }
        }

        return 0;
    }

    private string[] GetTriggerDefinitionUrls()
    {
        List<string> urls = new List<string>();

        string explicitUrl = GetStringGlobal("st_discordTriggersUrl", "");
        if (!string.IsNullOrWhiteSpace(explicitUrl))
            AddUniqueUrl(urls, explicitUrl);

        string configuredBaseUrl = GetStringGlobal("st_apiBaseUrl", "");
        if (!string.IsNullOrWhiteSpace(configuredBaseUrl))
            AddUniqueUrl(urls, NormalizeBaseUrl(configuredBaseUrl) + "/api/discord/triggers.txt");

        AddUniqueUrl(urls, NormalizeBaseUrl(DefaultStreamToolsBaseUrl) + "/api/discord/triggers.txt");
        AddUniqueUrl(urls, NormalizeBaseUrl(FallbackStreamToolsBaseUrl) + "/api/discord/triggers.txt");

        return urls.ToArray();
    }

    private void AddUniqueUrl(List<string> urls, string url)
    {
        string normalized = (url ?? "").Trim();
        if (string.IsNullOrWhiteSpace(normalized))
            return;

        for (int i = 0; i < urls.Count; i++)
        {
            if (urls[i].Equals(normalized, StringComparison.OrdinalIgnoreCase))
                return;
        }

        urls.Add(normalized);
    }

    private string DownloadText(string url)
    {
        var request = (HttpWebRequest)WebRequest.Create(url);
        request.Method = "GET";
        request.Timeout = 3000;
        request.ReadWriteTimeout = 3000;

        using (var response = (HttpWebResponse)request.GetResponse())
        using (var stream = response.GetResponseStream())
        using (var reader = new StreamReader(stream))
        {
            return reader.ReadToEnd();
        }
    }

    private int RegisterTriggerLines(string body)
    {
        int count = 0;
        string[] lines = (body ?? "").Split(new string[] { "\r\n", "\n" }, StringSplitOptions.RemoveEmptyEntries);

        for (int i = 0; i < lines.Length; i++)
        {
            string line = lines[i].Trim();
            if (string.IsNullOrWhiteSpace(line))
                continue;

            string[] parts = line.Split(new char[] { '|' }, 2);
            if (parts.Length != 2)
                continue;

            string triggerName = parts[0].Trim();
            string eventName = parts[1].Trim();

            if (string.IsNullOrWhiteSpace(triggerName) || string.IsNullOrWhiteSpace(eventName))
                continue;

            RegisterDiscordTrigger(triggerName, eventName);
            count++;
        }

        return count;
    }

    private int RegisterFallbackTriggers()
    {
        RegisterDiscordTrigger("Discord Redeem", RedeemEvent);
        RegisterDiscordTrigger("Discord Chat Message", MessageEvent);
        RegisterDiscordTrigger("Discord Command", CommandEvent);

        return 3;
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
        AddArg(eventArgs, "discordRedeemPointCost");
        AddArg(eventArgs, "discordRedeemRequiresInput");
        AddArg(eventArgs, "discordRedeemInput");
        AddArg(eventArgs, "discordRedeemInputLabel");
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

    private void ApplyDiscordUserArgs(Dictionary<string, object> eventArgs)
    {
        string discordUserId = GetStringFromDictionary(eventArgs, "discordUserId", "");
        string discordUserName = GetStringFromDictionary(eventArgs, "discordUserName", "");
        string pointUserKey = !string.IsNullOrWhiteSpace(discordUserId)
            ? "discord:" + discordUserId
            : "discord-name:" + NormalizeEventKey(discordUserName);

        eventArgs["pointUserKey"] = pointUserKey;
        eventArgs["userName"] = pointUserKey;
        eventArgs["user"] = discordUserName;
        eventArgs["displayName"] = discordUserName;
        eventArgs["userId"] = discordUserId;
        eventArgs["platform"] = "discord";
        eventArgs["userType"] = "discord";
    }

    private void AddArg(Dictionary<string, object> eventArgs, string name)
    {
        object value;
        if (args.TryGetValue(name, out value))
            eventArgs[name] = value;
    }

    private string GetStringFromDictionary(Dictionary<string, object> values, string name, string fallback)
    {
        object value;
        if (values.TryGetValue(name, out value) && value != null)
        {
            string text = Convert.ToString(value);
            return string.IsNullOrWhiteSpace(text) ? fallback : text;
        }

        return fallback;
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

    private string GetStringGlobal(string name, string fallback)
    {
        try
        {
            string value = CPH.GetGlobalVar<string>(name, true);
            return string.IsNullOrWhiteSpace(value) ? fallback : value;
        }
        catch { return fallback; }
    }

    private string NormalizeBaseUrl(string url)
    {
        return (url ?? "").Trim().TrimEnd('/');
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
