using System;
using System.IO;
using System.Net;
using System.Text;

public class CPHInline
{
    // Configure this Execute C# Code action with the name:
    // Discord Send Message
    //
    // Use it after a Discord trigger action. Set discordMessageText (or
    // message/text/responseMessage) before running this action.

    private const string DefaultStreamToolsBaseUrl = "http://127.0.0.1:3030";

    public bool Execute()
    {
        string channelId = GetStringArg("discordChannelId", GetStringArg("channelId", ""));
        string replyToMessageId = GetStringArg("replyToMessageId", GetStringArg("discordMessageId", ""));
        string message = GetStringArg(
            "discordMessageText",
            GetStringArg(
                "responseMessage",
                GetStringArg(
                    "message",
                    GetStringArg("text", GetStringArg("pointsResponseMessage", ""))
                )
            )
        );

        if (string.IsNullOrWhiteSpace(channelId))
        {
            CPH.LogError("[Discord Send Message] Missing discordChannelId/channelId.");
            SetResultArgs(false, "Missing discordChannelId/channelId");
            return false;
        }

        if (string.IsNullOrWhiteSpace(message))
        {
            CPH.LogError("[Discord Send Message] Missing discordMessageText/message/text.");
            SetResultArgs(false, "Missing message text");
            return false;
        }

        string bearerToken = GetStringGlobal("st_bearerToken", "");
        if (string.IsNullOrWhiteSpace(bearerToken))
        {
            CPH.LogError("[Discord Send Message] Missing Streamer.bot global st_bearerToken.");
            SetResultArgs(false, "Missing st_bearerToken");
            return false;
        }

        string apiBaseUrl = GetStringGlobal("st_apiBaseUrl", DefaultStreamToolsBaseUrl);
        string json =
            "{"
            + "\"channelId\":\"" + EscapeJson(channelId) + "\","
            + "\"replyToMessageId\":\"" + EscapeJson(replyToMessageId) + "\","
            + "\"message\":\"" + EscapeJson(message) + "\""
            + "}";

        try
        {
            var request = (HttpWebRequest)WebRequest.Create(NormalizeBaseUrl(apiBaseUrl) + "/api/discord/send-message");
            request.Method = "POST";
            request.ContentType = "application/json";
            request.Timeout = 5000;
            request.ReadWriteTimeout = 5000;
            request.Headers["Authorization"] = "Bearer " + bearerToken;

            byte[] data = Encoding.UTF8.GetBytes(json);
            request.ContentLength = data.Length;

            using (Stream stream = request.GetRequestStream())
            {
                stream.Write(data, 0, data.Length);
            }

            using (var response = (HttpWebResponse)request.GetResponse())
            {
                CPH.LogInfo("[Discord Send Message] Sent message to channel " + channelId + ". Status=" + response.StatusCode);
            }

            SetResultArgs(true, "");
            return true;
        }
        catch (Exception ex)
        {
            CPH.LogError("[Discord Send Message] Failed: " + ex.Message);
            SetResultArgs(false, ex.Message);
            return false;
        }
    }

    private void SetResultArgs(bool ok, string error)
    {
        CPH.SetArgument("discordSendOk", ok);
        CPH.SetArgument("discordSendOkFlag", ok ? 1 : 0);
        CPH.SetArgument("discordSendError", error);
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

    private string EscapeJson(string value)
    {
        return (value ?? "")
            .Replace("\\", "\\\\")
            .Replace("\"", "\\\"")
            .Replace("\r", "\\r")
            .Replace("\n", "\\n");
    }
}
