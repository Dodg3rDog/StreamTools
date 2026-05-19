using System;
using System.IO;
using System.Net;
using System.Text;

public class CPHInline
{
    private const int ShockDurationSeconds = 1;
    private const int NormalChargeCap = 20;
    private const int OverloadChargeCap = 30;
    private const int StoredChargeCap = 99;

    public bool Execute()
    {
        bool overloadUsed = GetBool("ps_overloadActive", false) || GetBool("ps_overloadVenting", false);
        int cap = overloadUsed ? OverloadChargeCap : NormalChargeCap;
        int pressureBefore = GetIntArg("pressureGauge", GetInt("ps_pressureGauge", 0));
        int currentBefore = GetInt("ps_currentCharge", GetInt("ps_chargePool", 0));
        int storedBefore = GetInt("ps_storedCharge", 0);
        if (currentBefore > cap)
        {
            int overflow = currentBefore - cap;
            currentBefore = cap;
            storedBefore = Math.Min(StoredChargeCap, storedBefore + overflow);
        }

        int finalIntensity = Clamp(GetIntArg("intensity", currentBefore), 1, cap);
        bool ventPressure = GetBoolArg("ventPressure", GetBoolArg("spendPressure", false));
        bool consumeCharge = GetBoolArg("consumeCharge", GetBoolArg("spendCharge", false));
        int pressureAfter = ventPressure
            ? 0
            : pressureBefore;
        int currentAfter = currentBefore;
        int storedAfter = storedBefore;
        if (consumeCharge)
        {
            int promoted = Math.Min(storedBefore, cap);
            currentAfter = promoted;
            storedAfter = Math.Max(0, storedBefore - promoted);
        }
        string relayMode = overloadUsed ? "overload" : "discharge";
        string eventType = "manual-discharge";
        string eventMessage = "Manual discharge prepared at intensity " + finalIntensity + ".";
        string shockLog = overloadUsed ? "OVERLOAD PRESSURE EVENT" : "PRESSURE EVENT";
        int statusSequence = GetNextStatusSequence();

        SetPendingPiShockArgs(finalIntensity, ShockDurationSeconds, shockLog);
        CPH.SetArgument("intensity", finalIntensity);
        CPH.SetArgument("duration", ShockDurationSeconds);
        CPH.SetArgument("op", 0);
        CPH.SetArgument("mode", 0);
        CPH.SetArgument("shocker", 0);
        CPH.SetArgument("shouldDischarge", true);
        CPH.SetArgument("shouldDischargeFlag", 1);
        CPH.SetArgument("shouldDischargeText", "true");
        CPH.SetArgument("shouldVibrateBeforeShock", true);
        CPH.SetArgument("shouldVibrateBeforeShockFlag", 1);
        CPH.SetArgument("vibrateIntensity", finalIntensity);
        CPH.SetArgument("vibrateDuration", 1);
        CPH.SetArgument("vibrateOp", 1);
        CPH.SetArgument("vibrateMode", 0);
        CPH.SetArgument("vibrateShocker", 0);
        CPH.SetArgument("shockIntensity", finalIntensity);
        CPH.SetArgument("shockDuration", ShockDurationSeconds);
        CPH.SetArgument("shockOp", 0);
        CPH.SetArgument("shockMode", 0);
        CPH.SetArgument("shockShocker", 0);
        CPH.SetArgument("log", shockLog);
        CPH.SetArgument("relayMode", relayMode);
        CPH.SetArgument("pressureGauge", pressureAfter);
        CPH.SetArgument("chargePool", currentAfter);
        CPH.SetArgument("currentVoltage", currentAfter);
        CPH.SetArgument("storedVoltage", storedAfter);
        CPH.SetArgument("lastIntensity", finalIntensity);
        CPH.SetArgument("eventType", eventType);
        CPH.SetArgument("eventValueBits", 0);
        CPH.SetArgument("eventMessage", eventMessage);
        CPH.SetArgument("statusSequence", statusSequence);

        if (ventPressure)
        {
            CPH.SetGlobalVar("ps_pressureGauge", pressureAfter, true);
        }

        if (consumeCharge)
        {
            CPH.SetGlobalVar("ps_currentCharge", currentAfter, true);
            CPH.SetGlobalVar("ps_storedCharge", storedAfter, true);
            CPH.SetGlobalVar("ps_chargePool", currentAfter, true);
        }

        CPH.SetGlobalVar("ps_lastPressureBefore", pressureBefore, true);
        CPH.SetGlobalVar("ps_lastPressureAfter", pressureAfter, true);
        CPH.SetGlobalVar("ps_lastPressureGain", 0, true);
        CPH.SetGlobalVar("ps_lastPressureVented", pressureBefore - pressureAfter, true);
        CPH.SetGlobalVar("ps_lastPoolBefore", currentBefore, true);
        CPH.SetGlobalVar("ps_lastPoolAfter", currentAfter, true);
        CPH.SetGlobalVar("ps_lastFinalIntensity", finalIntensity, true);
        CPH.SetGlobalVar("ps_lastChargeSpent", consumeCharge ? finalIntensity : 0, true);
        CPH.SetGlobalVar("ps_lastOverloadUsed", overloadUsed, true);
        CPH.SetGlobalVar("ps_lastEventType", eventType, true);
        CPH.SetGlobalVar("ps_lastEventValueBits", 0, true);
        CPH.SetGlobalVar("ps_lastEventMessage", eventMessage, true);
        CPH.SetGlobalVar("ps_statusSequence", statusSequence, true);
        CPH.SetGlobalVar("ps_relayMode", relayMode, true);

        PostStatusUpdate(
            pressureAfter,
            GetInt("ps_maxPressureGauge", overloadUsed ? 150 : 100),
            GetInt("ps_hypeTrainLevel", 0),
            GetBool("ps_overloadArmed", false),
            GetBool("ps_overloadActive", false),
            GetBool("ps_overloadVenting", false),
            currentAfter,
            storedAfter,
            NormalChargeCap,
            OverloadChargeCap,
            finalIntensity,
            GetInt("ps_lastChancePercent", 0),
            GetInt("ps_missCount", 0),
            eventMessage,
            "",
            eventType,
            relayMode,
            statusSequence
        );

        CPH.LogInfo("[PiShock Pressure] Prepared manual discharge Intensity=" + finalIntensity + " Pressure=" + pressureBefore + "->" + pressureAfter + " Charge=" + currentBefore + "->" + currentAfter + " Stored=" + storedBefore + "->" + storedAfter + " VentPressure=" + ventPressure + " ConsumeCharge=" + consumeCharge);

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
            CPH.LogError("[PiShock Pressure] Missing Streamer.bot global: st_bearerToken. Skipping direct status POST.");
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
                CPH.LogInfo("[PiShock Pressure] Manual discharge direct status POST sent: " + response.StatusCode + " Sequence=" + statusSequence);
            }
        }
        catch (Exception ex)
        {
            CPH.LogError("[PiShock Pressure] Manual discharge direct status POST failed: " + ex.ToString());
        }
    }

    private int Clamp(int value, int min, int max)
    {
        return Math.Min(Math.Max(value, min), max);
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

    private void SetPendingPiShockArgs(int intensity, int duration, string log)
    {
        CPH.SetGlobalVar("ps_shouldVibrateBeforeShock", true, true);
        CPH.SetGlobalVar("ps_pendingVibrateIntensity", intensity, true);
        CPH.SetGlobalVar("ps_pendingVibrateDuration", 1, true);
        CPH.SetGlobalVar("ps_pendingVibrateOp", 1, true);
        CPH.SetGlobalVar("ps_pendingVibrateMode", 0, true);
        CPH.SetGlobalVar("ps_pendingVibrateShocker", 0, true);
        CPH.SetGlobalVar("ps_pendingShockIntensity", intensity, true);
        CPH.SetGlobalVar("ps_pendingShockDuration", duration, true);
        CPH.SetGlobalVar("ps_pendingShockOp", 0, true);
        CPH.SetGlobalVar("ps_pendingShockMode", 0, true);
        CPH.SetGlobalVar("ps_pendingShockShocker", 0, true);
        CPH.SetGlobalVar("ps_pendingShockLog", log, true);
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
