using System;
using System.Net;
using System.Text;
using System.IO;

public class CPHInline
{
    public bool Execute()
    {
        try
        {
            string apiBaseUrl = GetString("st_apiBaseUrl", "http://127.0.0.1:3054");
            string bearerToken = GetString("st_bearerToken", "");

            if (string.IsNullOrWhiteSpace(bearerToken))
            {
                CPH.LogError("[PiShock Relay] Missing Streamer.bot global: st_bearerToken");
                return false;
            }

            int chargePool = GetInt("ps_chargePool", 0);
            int pressureGauge = GetInt("ps_pressureGauge", chargePool);
            int maxPressureGauge = GetInt("ps_maxPressureGauge", 100);
            int hypeLevel = GetInt("ps_hypeTrainLevel", 0);
            bool overloadArmed = GetBool("ps_overloadArmed", false);
            bool overloadActive = GetBool("ps_overloadActive", false);
            bool overloadVenting = GetBool("ps_overloadVenting", false);
            int lastIntensity = GetInt("ps_lastFinalIntensity", 0);
            int chancePercent = GetInt("ps_lastChancePercent", 0);
            int missCount = GetInt("ps_missCount", 0);
            int cooldownRemaining = GetInt("ps_cooldownRemaining", 0);
            int cooldownTotal = GetInt("ps_cooldownSeconds", 0);
            string currentViewerName = GetString("ps_lastViewerName", "");
            string currentViewerImageUrl = GetString("ps_lastViewerImageUrl", "");
            string eventMessage = GetString("ps_lastEventMessage", "");
            string eventType = GetString("ps_lastEventType", "");
            int eventValueBits = GetInt("ps_lastEventValueBits", 0);

            string mode = GetArgString("relayMode", "");

            if (string.IsNullOrWhiteSpace(mode))
                mode = GetString("ps_relayMode", "idle");

            mode = NormalizeMode(mode);

            string json =
                "{"
                + "\"chargePool\":" + chargePool + ","
                + "\"pressureGauge\":" + pressureGauge + ","
                + "\"maxPressureGauge\":" + maxPressureGauge + ","
                + "\"hypeLevel\":" + hypeLevel + ","
                + "\"overloadArmed\":" + overloadArmed.ToString().ToLower() + ","
                + "\"overloadActive\":" + overloadActive.ToString().ToLower() + ","
                + "\"overloadVenting\":" + overloadVenting.ToString().ToLower() + ","
                + "\"lastIntensity\":" + lastIntensity + ","
                + "\"chancePercent\":" + chancePercent + ","
                + "\"missCount\":" + missCount + ","
                + "\"cooldownRemaining\":" + cooldownRemaining + ","
                + "\"cooldownTotal\":" + cooldownTotal + ","
                + "\"currentViewerName\":\"" + EscapeJson(currentViewerName) + "\","
                + "\"currentViewerImageUrl\":\"" + EscapeJson(currentViewerImageUrl) + "\","
                + "\"eventMessage\":\"" + EscapeJson(eventMessage) + "\","
                + "\"eventType\":\"" + EscapeJson(eventType) + "\","
                + "\"eventValueBits\":" + eventValueBits + ","
                + "\"mode\":\"" + EscapeJson(mode) + "\""
                + "}";

            CPH.LogInfo("[PiShock Relay] Sending status update. Mode=" + mode);

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
                CPH.LogInfo("[PiShock Relay] POST sent: " + response.StatusCode);
            }

            CPH.SetGlobalVar("ps_relayMode", "idle", true);

            return true;
        }
        catch (Exception ex)
        {
            CPH.LogError("[PiShock Relay] POST failed: " + ex.ToString());
            return false;
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

    private string GetString(string name, string fallback)
    {
        try
        {
            string value = CPH.GetGlobalVar<string>(name, true);
            return string.IsNullOrWhiteSpace(value) ? fallback : value;
        }
        catch { return fallback; }
    }

    private string GetArgString(string name, string fallback)
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

    private string NormalizeBaseUrl(string url)
    {
        return (url ?? "").Trim().TrimEnd('/');
    }

    private string NormalizeMode(string mode)
    {
        string normalized = (mode ?? "").Trim();

        if (string.IsNullOrWhiteSpace(normalized) ||
            normalized == "0" ||
            normalized.Equals("none", StringComparison.OrdinalIgnoreCase))
        {
            return "idle";
        }

        return normalized.ToLowerInvariant();
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
