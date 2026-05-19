using System;
using System.IO;
using System.Net;
using System.Text;

public class CPHInline
{
    // ---------------------------------------------------------------------
    // ADJUSTMENTS
    // ---------------------------------------------------------------------
    private const int NormalMaxPressure = 100;
    private const int OverloadSafePressure = 30;
    private const int FlushSafePressure = 0;
    private const int NormalChargeCap = 20;
    private const int OverloadChargeCap = 30;
    private const int StoredChargeCap = 99;

    public bool Execute()
    {
        int pressure = GetVentTargetPressure();
        bool isFlush = pressure <= FlushSafePressure;
        string relayMode = isFlush ? "flush" : "recovery";
        string eventType = isFlush ? "flush" : "recovery";
        string eventMessage = isFlush
            ? "Manual flush complete. Pressure fully vented to 0%."
            : "All systems returned to normal operating parameters. Charging resumed.";
        int currentCharge = GetInt("ps_currentCharge", GetInt("ps_chargePool", 0));
        int storedCharge = GetInt("ps_storedCharge", 0);
        int overflowCharge = Math.Max(0, currentCharge - NormalChargeCap);
        currentCharge = Math.Min(currentCharge, NormalChargeCap);
        storedCharge = Math.Min(StoredChargeCap, storedCharge + overflowCharge);
        int refill = Math.Min(storedCharge, Math.Max(0, NormalChargeCap - currentCharge));
        currentCharge += refill;
        storedCharge -= refill;

        CPH.SetGlobalVar("ps_pressureGauge", pressure, true);
        CPH.SetGlobalVar("ps_currentCharge", currentCharge, true);
        CPH.SetGlobalVar("ps_storedCharge", storedCharge, true);
        CPH.SetGlobalVar("ps_chargePool", currentCharge, true);
        CPH.SetGlobalVar("ps_maxPressureGauge", NormalMaxPressure, true);
        CPH.SetGlobalVar("ps_overloadArmed", false, true);
        CPH.SetGlobalVar("ps_overloadActive", false, true);
        CPH.SetGlobalVar("ps_overloadVenting", false, true);
        CPH.SetGlobalVar("ps_overloadVentRequested", false, true);
        CPH.SetGlobalVar("ps_overloadUntilUtc", "", true);
        CPH.SetGlobalVar("ps_cooldownUntilUtc", "", true);
        CPH.SetGlobalVar("ps_cooldownSeconds", 0, true);
        CPH.SetGlobalVar("ps_cooldownRemaining", 0, true);
        CPH.SetGlobalVar("ps_lastEventType", eventType, true);
        CPH.SetGlobalVar("ps_lastEventValueBits", 0, true);
        CPH.SetGlobalVar("ps_lastEventMessage", eventMessage, true);
        CPH.SetGlobalVar("ps_lastTickerMessage", "", true);
        CPH.SetGlobalVar("ps_eventCountdownUntilUtc", "", true);
        CPH.SetGlobalVar("ps_eventCountdownTotal", 0, true);
        CPH.SetGlobalVar("ps_eventCountdownRemaining", 0, true);
        CPH.SetGlobalVar("ps_pendingVentMode", "", true);
        CPH.SetGlobalVar("ps_pendingVentTargetPressure", 0, true);
        CPH.SetGlobalVar("ps_pendingVentUntilUtc", "", true);
        int statusSequence = GetNextStatusSequence();
        CPH.SetGlobalVar("ps_statusSequence", statusSequence, true);
        CPH.SetGlobalVar("ps_relayMode", relayMode, true);

        CPH.SetArgument("relayMode", relayMode);
        CPH.SetArgument("pressureGauge", pressure);
        CPH.SetArgument("chargePool", currentCharge);
        CPH.SetArgument("maxPressureGauge", NormalMaxPressure);
        CPH.SetArgument("currentVoltage", currentCharge);
        CPH.SetArgument("storedVoltage", storedCharge);
        CPH.SetArgument("normalVoltageCap", NormalChargeCap);
        CPH.SetArgument("overloadVoltageCap", OverloadChargeCap);
        CPH.SetArgument("overloadArmed", false);
        CPH.SetArgument("overloadActive", false);
        CPH.SetArgument("overloadVenting", false);
        CPH.SetArgument("overloadUntilUtc", "");
        CPH.SetArgument("eventType", eventType);
        CPH.SetArgument("eventValueBits", 0);
        CPH.SetArgument("eventMessage", eventMessage);
        CPH.SetArgument("tickerMessage", "");
        CPH.SetArgument("eventCountdownRemaining", 0);
        CPH.SetArgument("eventCountdownTotal", 0);
        CPH.SetArgument("eventCountdownUntilUtc", "");
        CPH.SetArgument("statusSequence", statusSequence);

        PostStatusUpdate(
            pressure,
            NormalMaxPressure,
            GetInt("ps_hypeTrainLevel", 0),
            false,
            false,
            false,
            currentCharge,
            storedCharge,
            NormalChargeCap,
            OverloadChargeCap,
            GetInt("ps_lastFinalIntensity", 0),
            GetInt("ps_lastChancePercent", 0),
            GetInt("ps_missCount", 0),
            eventMessage,
            "",
            eventType,
            relayMode,
            statusSequence
        );

        CPH.LogInfo("[PiShock Vent] Complete. Mode=" + relayMode + " Pressure=" + pressure + "% Max=" + NormalMaxPressure + "%");
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
        string eventMessage,
        string tickerMessage,
        string eventType,
        string mode,
        int statusSequence)
    {
        string apiBaseUrl = GetString("st_apiBaseUrl", "http://127.0.0.1:3055");
        string bearerToken = GetString("st_bearerToken", "");

        if (string.IsNullOrWhiteSpace(bearerToken))
        {
            CPH.LogError("[PiShock Vent] Missing Streamer.bot global: st_bearerToken. Skipping direct status POST.");
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
            + "\"cooldownRemaining\":0,"
            + "\"cooldownTotal\":0,"
            + "\"cooldownUntilUtc\":\"\","
            + "\"overloadRemaining\":0,"
            + "\"overloadUntilUtc\":\"\","
            + "\"eventCountdownRemaining\":0,"
            + "\"eventCountdownTotal\":0,"
            + "\"eventCountdownUntilUtc\":\"\","
            + "\"currentViewerName\":\"" + EscapeJson(GetString("ps_lastViewerName", "")) + "\","
            + "\"currentViewerImageUrl\":\"" + EscapeJson(GetString("ps_lastViewerImageUrl", "")) + "\","
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
                CPH.LogInfo("[PiShock Vent] Complete direct status POST sent: " + response.StatusCode + " Sequence=" + statusSequence);
            }
        }
        catch (Exception ex)
        {
            CPH.LogError("[PiShock Vent] Complete direct status POST failed: " + ex.ToString());
        }
    }

    private int GetVentTargetPressure()
    {
        int target = GetIntArg("ventTargetPressure", -1);
        if (target >= 0)
            return Clamp(target, FlushSafePressure, OverloadSafePressure);

        string ventMode = GetStringArg("ventMode", "");
        bool flush = GetBoolArg("flush", false) ||
            ventMode.Equals("flush", StringComparison.OrdinalIgnoreCase) ||
            ventMode.Equals("manual-flush", StringComparison.OrdinalIgnoreCase);
        if (flush)
            return FlushSafePressure;

        if (IsPendingManualFlush())
        {
            int pendingTarget = GetInt("ps_pendingVentTargetPressure", FlushSafePressure);
            return Clamp(pendingTarget, FlushSafePressure, OverloadSafePressure);
        }

        return OverloadSafePressure;
    }

    private bool IsPendingManualFlush()
    {
        string pendingMode = GetString("ps_pendingVentMode", "");
        if (!pendingMode.Equals("flush", StringComparison.OrdinalIgnoreCase) &&
            !pendingMode.Equals("manual-flush", StringComparison.OrdinalIgnoreCase))
            return false;

        string pendingUntilUtc = GetString("ps_pendingVentUntilUtc", "");
        DateTime pendingUntil;
        if (DateTime.TryParse(pendingUntilUtc, out pendingUntil))
            return DateTime.UtcNow <= pendingUntil.ToUniversalTime();

        return false;
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

    private string GetString(string name, string fallback)
    {
        try
        {
            string value = CPH.GetGlobalVar<string>(name, true);
            return string.IsNullOrWhiteSpace(value) ? fallback : value;
        }
        catch { return fallback; }
    }

    private int GetNextStatusSequence()
    {
        int nextGlobalSequence = GetInt("ps_statusSequence", 0) + 1;
        int timeSequence = (int)Math.Floor((DateTime.UtcNow - new DateTime(1970, 1, 1)).TotalSeconds);
        return Math.Max(nextGlobalSequence, timeSequence);
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

    private bool GetBoolArg(string name, bool fallback)
    {
        try
        {
            bool value;
            if (CPH.TryGetArg(name, out value))
                return value;

            string text;
            if (CPH.TryGetArg(name, out text))
            {
                text = (text ?? "").Trim();
                return text.Equals("true", StringComparison.OrdinalIgnoreCase) ||
                    text.Equals("yes", StringComparison.OrdinalIgnoreCase) ||
                    text == "1";
            }

            return fallback;
        }
        catch { return fallback; }
    }

    private int Clamp(int value, int min, int max)
    {
        return Math.Min(Math.Max(value, min), max);
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
