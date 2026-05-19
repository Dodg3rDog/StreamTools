using System;
using System.IO;
using System.Net;
using System.Text;

public class CPHInline
{
    public bool Execute()
    {
        bool active = GetBool("ps_hypeTrainActive", false);

        if (active)
        {
            Debug("Cooling skipped. Hype Train active.");
            return true;
        }

        int level = GetInt("ps_hypeTrainLevel", 0);

        if (level <= 0)
        {
            Debug("Cooling skipped. Core pressure already zero.");
            return true;
        }

        int oldLevel = level;
        level = Math.Max(0, level - 1);
        string eventMessage = "Cooling cycle reduced Hype Train core pressure from Level " + oldLevel + " to Level " + level + ".";
        int statusSequence = GetNextStatusSequence();

        CPH.SetGlobalVar("ps_hypeTrainLevel", level, true);
        CPH.SetGlobalVar("ps_hypeTrainActive", level > 0, true);
        CPH.SetGlobalVar("ps_lastEventType", "hype-cooling", true);
        CPH.SetGlobalVar("ps_lastEventValueBits", 0, true);
        CPH.SetGlobalVar("ps_lastEventMessage", eventMessage, true);
        CPH.SetGlobalVar("ps_statusSequence", statusSequence, true);
        CPH.SetGlobalVar("ps_relayMode", "cooling", true);
        CPH.SetArgument("relayMode", "cooling");
        CPH.SetArgument("hypeLevel", level);
        CPH.SetArgument("eventType", "hype-cooling");
        CPH.SetArgument("eventValueBits", 0);
        CPH.SetArgument("eventMessage", eventMessage);
        CPH.SetArgument("statusSequence", statusSequence);

        PostStatusUpdate(level, eventMessage, "hype-cooling", "cooling", statusSequence);

        CPH.SendMessage(
            "🧯 ANTHRO-CORP COOLING CYCLE: Core pressure reduced from Level " +
            oldLevel +
            " to Level " +
            level +
            ".",
            true
        );

        return true;
    }

    private void PostStatusUpdate(int hypeLevel, string eventMessage, string eventType, string mode, int statusSequence)
    {
        string apiBaseUrl = GetString("st_apiBaseUrl", "http://127.0.0.1:3055");
        string bearerToken = GetString("st_bearerToken", "");

        if (string.IsNullOrWhiteSpace(bearerToken))
        {
            CPH.LogError("[PiShock Hype] Missing Streamer.bot global: st_bearerToken. Skipping direct status POST.");
            return;
        }

        int current = GetInt("ps_currentCharge", GetInt("ps_chargePool", 0));
        string json =
            "{"
            + "\"chargePool\":" + current + ","
            + "\"pressureGauge\":" + GetInt("ps_pressureGauge", 0) + ","
            + "\"maxPressureGauge\":" + GetInt("ps_maxPressureGauge", 100) + ","
            + "\"hypeLevel\":" + hypeLevel + ","
            + "\"overloadArmed\":" + GetBool("ps_overloadArmed", false).ToString().ToLower() + ","
            + "\"overloadActive\":" + GetBool("ps_overloadActive", false).ToString().ToLower() + ","
            + "\"overloadVenting\":" + GetBool("ps_overloadVenting", false).ToString().ToLower() + ","
            + "\"currentVoltage\":" + current + ","
            + "\"storedVoltage\":" + GetInt("ps_storedCharge", 0) + ","
            + "\"normalVoltageCap\":" + GetInt("ps_normalChargeCap", 20) + ","
            + "\"overloadVoltageCap\":" + GetInt("ps_overloadChargeCap", 30) + ","
            + "\"lastIntensity\":" + GetInt("ps_lastFinalIntensity", 0) + ","
            + "\"chancePercent\":" + GetInt("ps_lastChancePercent", 0) + ","
            + "\"missCount\":" + GetInt("ps_missCount", 0) + ","
            + "\"cooldownRemaining\":" + GetInt("ps_cooldownRemaining", 0) + ","
            + "\"cooldownTotal\":" + GetInt("ps_cooldownSeconds", 0) + ","
            + "\"cooldownUntilUtc\":\"" + EscapeJson(GetString("ps_cooldownUntilUtc", "")) + "\","
            + "\"overloadRemaining\":0,"
            + "\"overloadUntilUtc\":\"" + EscapeJson(GetString("ps_overloadUntilUtc", "")) + "\","
            + "\"eventCountdownRemaining\":" + GetInt("ps_eventCountdownRemaining", 0) + ","
            + "\"eventCountdownTotal\":" + GetInt("ps_eventCountdownTotal", 0) + ","
            + "\"eventCountdownUntilUtc\":\"" + EscapeJson(GetString("ps_eventCountdownUntilUtc", "")) + "\","
            + "\"currentViewerName\":\"" + EscapeJson(GetString("ps_lastViewerName", "")) + "\","
            + "\"currentViewerImageUrl\":\"" + EscapeJson(GetString("ps_lastViewerImageUrl", "")) + "\","
            + "\"eventMessage\":\"" + EscapeJson(eventMessage) + "\","
            + "\"tickerMessage\":\"\","
            + "\"eventType\":\"" + EscapeJson(eventType) + "\","
            + "\"eventValueBits\":0,"
            + "\"statusSequence\":" + statusSequence + ","
            + "\"mode\":\"" + EscapeJson(mode) + "\""
            + "}";

        try
        {
            var request = (HttpWebRequest)WebRequest.Create(NormalizeBaseUrl(apiBaseUrl) + "/api/pishock/status");
            request.Method = "POST";
            request.ContentType = "application/json";
            request.Timeout = 3000;
            request.ReadWriteTimeout = 3000;
            request.Headers["Authorization"] = "Bearer " + bearerToken;

            byte[] data = Encoding.UTF8.GetBytes(json);
            request.ContentLength = data.Length;

            using (Stream stream = request.GetRequestStream())
            {
                stream.Write(data, 0, data.Length);
            }

            using (var response = (HttpWebResponse)request.GetResponse())
            {
                CPH.LogInfo("[PiShock Hype] Cooling direct status POST sent: " + response.StatusCode + " Sequence=" + statusSequence);
            }
        }
        catch (Exception ex)
        {
            CPH.LogError("[PiShock Hype] Cooling direct status POST failed: " + ex.ToString());
        }
    }

    private int GetInt(string name, int fallback)
    {
        try { return CPH.GetGlobalVar<int>(name, true); }
        catch { return fallback; }
    }

    private bool GetBool(string name, bool fallback)
    {
        try { return CPH.GetGlobalVar<bool>(name, true); }
        catch { return fallback; }
    }

    private int GetNextStatusSequence()
    {
        int nextGlobalSequence = GetInt("ps_statusSequence", 0) + 1;
        int timeSequence = (int)Math.Floor((DateTime.UtcNow - new DateTime(1970, 1, 1)).TotalSeconds);
        return Math.Max(nextGlobalSequence, timeSequence);
    }

    private string GetString(string name, string fallback)
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

    private void Debug(string msg)
    {
        if (GetBool("ps_debug", false))
            CPH.LogInfo("[PiShock Debug] " + msg);
    }
}
