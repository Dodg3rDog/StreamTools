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
            string apiBaseUrl = GetString("st_apiBaseUrl", "http://127.0.0.1:3055");
            string bearerToken = GetString("st_bearerToken", "");

            if (string.IsNullOrWhiteSpace(bearerToken))
            {
                CPH.LogError("[PiShock Relay] Missing Streamer.bot global: st_bearerToken");
                return false;
            }

            int chargePool = GetIntArgOrGlobal("chargePool", "ps_chargePool", 0);
            int pressureGauge = GetIntArgOrGlobal("pressureGauge", "ps_pressureGauge", chargePool);
            int maxPressureGauge = GetIntArgOrGlobal("maxPressureGauge", "ps_maxPressureGauge", 100);
            int hypeLevel = GetIntArgOrGlobal("hypeLevel", "ps_hypeTrainLevel", 0);
            bool overloadArmed = GetBoolArgOrGlobal("overloadArmed", "ps_overloadArmed", false);
            bool overloadActive = GetBoolArgOrGlobal("overloadActive", "ps_overloadActive", false);
            bool overloadVenting = GetBoolArgOrGlobal("overloadVenting", "ps_overloadVenting", false);
            int currentVoltage = GetIntArgOrGlobal("currentVoltage", "ps_currentCharge", GetInt("ps_lastFinalIntensity", 0));
            int storedVoltage = GetIntArgOrGlobal("storedVoltage", "ps_storedCharge", 0);
            int normalVoltageCap = GetIntArgOrGlobal("normalVoltageCap", "ps_normalChargeCap", 10);
            int overloadVoltageCap = GetIntArgOrGlobal("overloadVoltageCap", "ps_overloadChargeCap", 15);
            int lastIntensity = GetIntArgOrGlobal("lastIntensity", "ps_lastFinalIntensity", 0);
            int chancePercent = GetIntArgOrGlobal("chancePercent", "ps_lastChancePercent", 0);
            int missCount = GetIntArgOrGlobal("missCount", "ps_missCount", 0);
            int cooldownTotal = GetIntArgOrGlobal("cooldownTotal", "ps_cooldownSeconds", 0);
            string cooldownUntilUtc = GetStringArgOrGlobal("cooldownUntilUtc", "ps_cooldownUntilUtc", "");
            DateTime cooldownUntil = ParseDate(cooldownUntilUtc, DateTime.MinValue);
            int cooldownRemaining = 0;
            if (cooldownUntil != DateTime.MinValue && DateTime.UtcNow < cooldownUntil)
            {
                cooldownRemaining = (int)Math.Ceiling((cooldownUntil - DateTime.UtcNow).TotalSeconds);
                CPH.SetGlobalVar("ps_cooldownRemaining", cooldownRemaining, true);
            }
            else if (cooldownUntil != DateTime.MinValue)
            {
                cooldownTotal = 0;
                cooldownUntilUtc = "";
                CPH.SetGlobalVar("ps_cooldownUntilUtc", "", true);
                CPH.SetGlobalVar("ps_cooldownSeconds", 0, true);
                CPH.SetGlobalVar("ps_cooldownRemaining", 0, true);
            }
            string overloadUntilUtc = GetStringArgOrGlobal("overloadUntilUtc", "ps_overloadUntilUtc", "");
            DateTime overloadUntil = ParseDate(overloadUntilUtc, DateTime.MinValue);
            int overloadRemaining = 0;
            if (overloadUntil != DateTime.MinValue && DateTime.UtcNow < overloadUntil)
                overloadRemaining = (int)Math.Ceiling((overloadUntil - DateTime.UtcNow).TotalSeconds);
            string currentViewerName = GetStringArgOrGlobal("currentViewerName", "ps_lastViewerName", "");
            string currentViewerImageUrl = GetStringArgOrGlobal("currentViewerImageUrl", "ps_lastViewerImageUrl", "");
            string eventMessage = GetStringArgOrGlobal("eventMessage", "ps_lastEventMessage", "");
            string eventType = GetStringArgOrGlobal("eventType", "ps_lastEventType", "");
            int eventValueBits = GetIntArgOrGlobal("eventValueBits", "ps_lastEventValueBits", 0);
            int statusSequence = GetIntArgOrGlobal("statusSequence", "ps_statusSequence", 0);

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
                + "\"currentVoltage\":" + currentVoltage + ","
                + "\"storedVoltage\":" + storedVoltage + ","
                + "\"normalVoltageCap\":" + normalVoltageCap + ","
                + "\"overloadVoltageCap\":" + overloadVoltageCap + ","
                + "\"lastIntensity\":" + lastIntensity + ","
                + "\"chancePercent\":" + chancePercent + ","
                + "\"missCount\":" + missCount + ","
                + "\"cooldownRemaining\":" + cooldownRemaining + ","
                + "\"cooldownTotal\":" + cooldownTotal + ","
                + "\"cooldownUntilUtc\":\"" + EscapeJson(cooldownUntilUtc) + "\","
                + "\"overloadRemaining\":" + overloadRemaining + ","
                + "\"overloadUntilUtc\":\"" + EscapeJson(overloadUntilUtc) + "\","
                + "\"currentViewerName\":\"" + EscapeJson(currentViewerName) + "\","
                + "\"currentViewerImageUrl\":\"" + EscapeJson(currentViewerImageUrl) + "\","
                + "\"eventMessage\":\"" + EscapeJson(eventMessage) + "\","
                + "\"eventType\":\"" + EscapeJson(eventType) + "\","
                + "\"eventValueBits\":" + eventValueBits + ","
                + "\"statusSequence\":" + statusSequence + ","
                + "\"mode\":\"" + EscapeJson(mode) + "\""
                + "}";

            CPH.LogInfo(
                "[PiShock Relay] Sending status update. Mode=" + mode +
                " Pressure=" + pressureGauge +
                " Current=" + currentVoltage +
                " Stored=" + storedVoltage +
                " Event=" + eventType +
                " Bits=" + eventValueBits +
                " Sequence=" + statusSequence
            );

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

    private DateTime GetDate(string name, DateTime fallback)
    {
        try
        {
            string value = CPH.GetGlobalVar<string>(name, true);
            DateTime parsed;
            return DateTime.TryParse(value, out parsed) ? parsed.ToUniversalTime() : fallback;
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

    private int GetIntArgOrGlobal(string argName, string globalName, int fallback)
    {
        try
        {
            int value;
            if (CPH.TryGetArg(argName, out value))
                return value;

            string text;
            if (CPH.TryGetArg(argName, out text))
            {
                int parsed;
                if (int.TryParse(text, out parsed))
                    return parsed;

                double parsedDouble;
                if (double.TryParse(text, out parsedDouble))
                    return (int)Math.Round(parsedDouble);
            }
        }
        catch { }

        return GetInt(globalName, fallback);
    }

    private bool GetBoolArgOrGlobal(string argName, string globalName, bool fallback)
    {
        try
        {
            bool value;
            if (CPH.TryGetArg(argName, out value))
                return value;

            string text;
            if (CPH.TryGetArg(argName, out text))
            {
                text = (text ?? "").Trim();
                return text.Equals("true", StringComparison.OrdinalIgnoreCase) ||
                    text.Equals("yes", StringComparison.OrdinalIgnoreCase) ||
                    text == "1";
            }
        }
        catch { }

        return GetBool(globalName, fallback);
    }

    private string GetStringArgOrGlobal(string argName, string globalName, string fallback)
    {
        try
        {
            string value;
            if (CPH.TryGetArg(argName, out value))
                return value ?? "";
        }
        catch { }

        return GetString(globalName, fallback);
    }

    private DateTime ParseDate(string value, DateTime fallback)
    {
        try
        {
            DateTime parsed;
            return DateTime.TryParse(value, out parsed) ? parsed.ToUniversalTime() : fallback;
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
