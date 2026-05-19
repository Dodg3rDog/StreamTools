using System;
using System.IO;
using System.Net;
using System.Text;

public class CPHInline
{
    private const int DefaultCountdownSeconds = 5;
    private const int PendingVentGraceMinutes = 10;
    private const int FlushSafePressure = 0;

    public bool Execute()
    {
        int countdownSeconds = Math.Max(1, GetIntArg("countdownSeconds", DefaultCountdownSeconds));
        DateTime until = DateTime.UtcNow.AddSeconds(countdownSeconds);
        DateTime pendingUntil = until.AddMinutes(PendingVentGraceMinutes);
        int pressure = GetInt("ps_pressureGauge", 0);
        int current = GetInt("ps_currentCharge", GetInt("ps_chargePool", 0));
        int stored = GetInt("ps_storedCharge", 0);
        int maxPressure = GetInt("ps_maxPressureGauge", 100);
        string viewerName = ResolveViewerName();
        if (string.IsNullOrWhiteSpace(viewerName))
            viewerName = "Employee";

        string message = viewerName + " initiated System Vent. System venting in " + countdownSeconds + " seconds.";
        string ticker = "⚠️ " + viewerName + " INITIATED SYSTEM VENT // SYSTEM VENTING IN " + countdownSeconds + " SEC // STAND CLEAR ⚠️";
        int statusSequence = GetNextStatusSequence();

        CPH.SetGlobalVar("ps_eventCountdownTotal", countdownSeconds, true);
        CPH.SetGlobalVar("ps_eventCountdownRemaining", countdownSeconds, true);
        CPH.SetGlobalVar("ps_eventCountdownUntilUtc", until.ToString("o"), true);
        CPH.SetGlobalVar("ps_pendingVentMode", "manual-flush", true);
        CPH.SetGlobalVar("ps_pendingVentTargetPressure", FlushSafePressure, true);
        CPH.SetGlobalVar("ps_pendingVentUntilUtc", pendingUntil.ToString("o"), true);
        CPH.SetGlobalVar("ps_lastEventType", "rift-stabilizer", true);
        CPH.SetGlobalVar("ps_lastEventValueBits", 0, true);
        CPH.SetGlobalVar("ps_lastEventMessage", message, true);
        CPH.SetGlobalVar("ps_lastTickerMessage", ticker, true);
        CPH.SetGlobalVar("ps_lastViewerName", viewerName, true);
        CPH.SetGlobalVar("ps_relayMode", "rift-stabilizer", true);
        CPH.SetGlobalVar("ps_statusSequence", statusSequence, true);

        CPH.SetArgument("relayMode", "rift-stabilizer");
        CPH.SetArgument("pressureGauge", pressure);
        CPH.SetArgument("maxPressureGauge", maxPressure);
        CPH.SetArgument("chargePool", current);
        CPH.SetArgument("currentVoltage", current);
        CPH.SetArgument("storedVoltage", stored);
        CPH.SetArgument("eventType", "rift-stabilizer");
        CPH.SetArgument("eventValueBits", 0);
        CPH.SetArgument("eventMessage", message);
        CPH.SetArgument("tickerMessage", ticker);
        CPH.SetArgument("currentViewerName", viewerName);
        CPH.SetArgument("currentViewerImageUrl", "");
        CPH.SetArgument("eventCountdownRemaining", countdownSeconds);
        CPH.SetArgument("eventCountdownTotal", countdownSeconds);
        CPH.SetArgument("eventCountdownUntilUtc", until.ToString("o"));
        CPH.SetArgument("ventMode", "manual-flush");
        CPH.SetArgument("ventTargetPressure", FlushSafePressure);
        CPH.SetArgument("statusSequence", statusSequence);

        PostStatusUpdate(
            pressure,
            maxPressure,
            GetInt("ps_hypeTrainLevel", 0),
            GetBool("ps_overloadArmed", false),
            GetBool("ps_overloadActive", false),
            GetBool("ps_overloadVenting", false),
            current,
            stored,
            GetInt("ps_normalChargeCap", 20),
            GetInt("ps_overloadChargeCap", 30),
            GetInt("ps_lastFinalIntensity", 0),
            GetInt("ps_lastChancePercent", 0),
            GetInt("ps_missCount", 0),
            0,
            0,
            "",
            GetString("ps_overloadUntilUtc", ""),
            viewerName,
            "",
            message,
            ticker,
            "rift-stabilizer",
            countdownSeconds,
            countdownSeconds,
            until.ToString("o"),
            "rift-stabilizer",
            statusSequence
        );

        CPH.LogInfo("[PiShock Rift] Stabilizer engaged. Flush countdown=" + countdownSeconds + "s Pressure=" + pressure + " Current=" + current + " Stored=" + stored);
        return true;
    }

    private void PostStatusUpdate(
        int pressureGauge,
        int maxPressureGauge,
        int hypeLevel,
        bool overloadArmed,
        bool overloadActive,
        bool overloadVenting,
        int currentVoltage,
        int storedVoltage,
        int normalVoltageCap,
        int overloadVoltageCap,
        int lastIntensity,
        int chancePercent,
        int missCount,
        int cooldownRemaining,
        int cooldownTotal,
        string cooldownUntilUtc,
        string overloadUntilUtc,
        string currentViewerName,
        string currentViewerImageUrl,
        string eventMessage,
        string tickerMessage,
        string eventType,
        int eventCountdownRemaining,
        int eventCountdownTotal,
        string eventCountdownUntilUtc,
        string mode,
        int statusSequence)
    {
        string apiBaseUrl = GetString("st_apiBaseUrl", "http://127.0.0.1:3055");
        string bearerToken = GetString("st_bearerToken", "");

        if (string.IsNullOrWhiteSpace(bearerToken))
        {
            CPH.LogError("[PiShock Rift] Missing Streamer.bot global: st_bearerToken. Skipping direct status POST.");
            return;
        }

        string json =
            "{"
            + "\"chargePool\":" + currentVoltage + ","
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
            + "\"overloadRemaining\":0,"
            + "\"overloadUntilUtc\":\"" + EscapeJson(overloadUntilUtc) + "\","
            + "\"eventCountdownRemaining\":" + eventCountdownRemaining + ","
            + "\"eventCountdownTotal\":" + eventCountdownTotal + ","
            + "\"eventCountdownUntilUtc\":\"" + EscapeJson(eventCountdownUntilUtc) + "\","
            + "\"currentViewerName\":\"" + EscapeJson(currentViewerName) + "\","
            + "\"currentViewerImageUrl\":\"" + EscapeJson(currentViewerImageUrl) + "\","
            + "\"eventMessage\":\"" + EscapeJson(eventMessage) + "\","
            + "\"tickerMessage\":\"" + EscapeJson(tickerMessage) + "\","
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
                CPH.LogInfo("[PiShock Rift] Direct status POST sent: " + response.StatusCode + " Sequence=" + statusSequence);
            }
        }
        catch (Exception ex)
        {
            CPH.LogError("[PiShock Rift] Direct status POST failed: " + ex.ToString());
        }
    }

    private int GetIntArg(string name, int fallback)
    {
        try
        {
            int value;
            return CPH.TryGetArg(name, out value) ? value : fallback;
        }
        catch { return fallback; }
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

    private string ResolveViewerName()
    {
        string viewerName = GetStringArg("viewerName", "");
        if (string.IsNullOrWhiteSpace(viewerName))
            viewerName = GetStringArg("displayName", GetStringArg("userName", GetStringArg("user", "")));

        return viewerName;
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
