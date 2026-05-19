using System;
using System.IO;
using System.Net;
using System.Text;

public class CPHInline
{
    public bool Execute()
    {
        // Debug
        CPH.SetGlobalVar("ps_debug", true, true);

        // Current live state
        CPH.SetGlobalVar("ps_chargePool", 0, true);
        CPH.SetGlobalVar("ps_currentCharge", 0, true);
        CPH.SetGlobalVar("ps_storedCharge", 0, true);
        CPH.SetGlobalVar("ps_normalChargeCap", 20, true);
        CPH.SetGlobalVar("ps_overloadChargeCap", 30, true);
        CPH.SetGlobalVar("ps_pressureGauge", 0, true);
        CPH.SetGlobalVar("ps_maxPressureGauge", 100, true);
        CPH.SetGlobalVar("ps_hypeTrainLevel", 0, true);
        CPH.SetGlobalVar("ps_hypeTrainActive", false, true);
        CPH.SetGlobalVar("ps_overloadArmed", false, true);
        CPH.SetGlobalVar("ps_overloadActive", false, true);
        CPH.SetGlobalVar("ps_overloadVenting", false, true);
        CPH.SetGlobalVar("ps_overloadVentRequested", false, true);
        CPH.SetGlobalVar("ps_overloadUntilUtc", "", true);
        CPH.SetGlobalVar("ps_missCount", 0, true);
        CPH.SetGlobalVar("ps_cooldownUntilUtc", "", true);
        CPH.SetGlobalVar("ps_cooldownSeconds", 0, true);
        CPH.SetGlobalVar("ps_cooldownRemaining", 0, true);
        CPH.SetGlobalVar("ps_eventCountdownUntilUtc", "", true);
        CPH.SetGlobalVar("ps_eventCountdownTotal", 0, true);
        CPH.SetGlobalVar("ps_eventCountdownRemaining", 0, true);
        CPH.SetGlobalVar("ps_pendingVentMode", "", true);
        CPH.SetGlobalVar("ps_pendingVentTargetPressure", 0, true);
        CPH.SetGlobalVar("ps_pendingVentUntilUtc", "", true);
        CPH.SetGlobalVar("ps_lastChancePercent", 0, true);
        CPH.SetGlobalVar("ps_lastRoll", 0, true);
        CPH.SetGlobalVar("ps_lastPressureBefore", 0, true);
        CPH.SetGlobalVar("ps_lastPressureAfter", 0, true);
        CPH.SetGlobalVar("ps_lastPressureGain", 0, true);
        CPH.SetGlobalVar("ps_lastPressureVented", 0, true);
        CPH.SetGlobalVar("ps_lastChargeGain", 0, true);
        CPH.SetGlobalVar("ps_lastSmallCheerCurrentRoll", 0, true);
        CPH.SetGlobalVar("ps_lastSmallCheerCurrentHit", false, true);
        CPH.SetGlobalVar("ps_smallCheerBitsLedger", 0, true);
        CPH.SetGlobalVar("ps_lastRawEventBits", 0, true);
        CPH.SetGlobalVar("ps_lastSmallCheerLedgerBefore", 0, true);
        CPH.SetGlobalVar("ps_lastSmallCheerLedgerAfter", 0, true);
        CPH.SetGlobalVar("ps_lastSmallCheerLedgerReleasedBits", 0, true);
        CPH.SetGlobalVar("ps_lastEventType", "reset", true);
        CPH.SetGlobalVar("ps_lastEventValueBits", 0, true);
        CPH.SetGlobalVar("ps_lastEventMessage", "Containment status reset.", true);
        CPH.SetGlobalVar("ps_lastTickerMessage", "", true);
        CPH.SetGlobalVar("ps_lastPooledCheerMessageTier", 0, true);
        CPH.SetGlobalVar("ps_lastViewerName", "", true);
        CPH.SetGlobalVar("ps_lastViewerImageUrl", "", true);
        CPH.SetGlobalVar("ps_lastViewerShownAtUtc", "", true);
        CPH.SetGlobalVar("ps_lastViewerEventType", "", true);
        CPH.SetGlobalVar("ps_lastViewerEventValueBits", 0, true);
        int statusSequence = GetNextStatusSequence();
        CPH.SetGlobalVar("ps_statusSequence", statusSequence, true);

        // Last discharge state
        CPH.SetGlobalVar("ps_lastPoolBefore", 0, true);
        CPH.SetGlobalVar("ps_lastPoolAfter", 0, true);
        CPH.SetGlobalVar("ps_lastBaseIntensity", 0, true);
        CPH.SetGlobalVar("ps_lastHypeBonus", 0, true);
        CPH.SetGlobalVar("ps_lastRandomSurge", 0, true);
        CPH.SetGlobalVar("ps_lastFinalIntensity", 0, true);
        CPH.SetGlobalVar("ps_lastOverloadUsed", false, true);
        CPH.SetGlobalVar("ps_lastChargeSpent", 0, true);
        CPH.SetGlobalVar("ps_shouldVibrateBeforeShock", false, true);
        CPH.SetGlobalVar("ps_pendingVibrateIntensity", 0, true);
        CPH.SetGlobalVar("ps_pendingVibrateDuration", 0, true);
        CPH.SetGlobalVar("ps_pendingVibrateOp", 1, true);
        CPH.SetGlobalVar("ps_pendingVibrateMode", 0, true);
        CPH.SetGlobalVar("ps_pendingVibrateShocker", 0, true);
        CPH.SetGlobalVar("ps_pendingShockIntensity", 0, true);
        CPH.SetGlobalVar("ps_pendingShockDuration", 0, true);
        CPH.SetGlobalVar("ps_pendingShockOp", 0, true);
        CPH.SetGlobalVar("ps_pendingShockMode", 0, true);
        CPH.SetGlobalVar("ps_pendingShockShocker", 0, true);
        CPH.SetGlobalVar("ps_pendingShockLog", "", true);
        CPH.SetGlobalVar("ps_nextPiShockPreset", "", true);
        CPH.SetGlobalVar("ps_shouldDischarge", false, true);
        CPH.SetGlobalVar("ps_shouldDischargeFlag", 0, true);
        CPH.SetGlobalVar("ps_shouldDischargeText", "false", true);
        CPH.SetGlobalVar("ps_shouldStartOverloadVent", false, true);
        CPH.SetGlobalVar("ps_shouldStartOverloadVentFlag", 0, true);
        CPH.SetGlobalVar("ps_relayMode", "reset", true);

        // Arguments for immediate relay update
        CPH.SetArgument("chargePool", 0);
        CPH.SetArgument("currentVoltage", 0);
        CPH.SetArgument("storedVoltage", 0);
        CPH.SetArgument("normalVoltageCap", 20);
        CPH.SetArgument("overloadVoltageCap", 30);
        CPH.SetArgument("hypeLevel", 0);
        CPH.SetArgument("overloadArmed", false);
        CPH.SetArgument("overloadActive", false);
        CPH.SetArgument("overloadVenting", false);
        CPH.SetArgument("lastIntensity", 0);
        CPH.SetArgument("relayMode", "reset");
        CPH.SetArgument("pressureGauge", 0);
        CPH.SetArgument("maxPressureGauge", 100);
        CPH.SetArgument("chancePercent", 0);
        CPH.SetArgument("lastRoll", 0);
        CPH.SetArgument("missCount", 0);
        CPH.SetArgument("cooldownRemaining", 0);
        CPH.SetArgument("cooldownTotal", 0);
        CPH.SetArgument("cooldownUntilUtc", "");
        CPH.SetArgument("overloadRemaining", 0);
        CPH.SetArgument("overloadUntilUtc", "");
        CPH.SetArgument("eventCountdownRemaining", 0);
        CPH.SetArgument("eventCountdownTotal", 0);
        CPH.SetArgument("eventCountdownUntilUtc", "");
        CPH.SetArgument("currentViewerName", "");
        CPH.SetArgument("currentViewerImageUrl", "");
        CPH.SetArgument("eventType", "reset");
        CPH.SetArgument("eventValueBits", 0);
        CPH.SetArgument("eventMessage", "Containment status reset.");
        CPH.SetArgument("tickerMessage", "");
        CPH.SetArgument("pooledCheerMessageTier", 0);
        CPH.SetArgument("shouldDischarge", false);
        CPH.SetArgument("shouldDischargeFlag", 0);
        CPH.SetArgument("shouldDischargeText", "false");
        CPH.SetArgument("shouldVentDischarge", false);
        CPH.SetArgument("shouldVentDischargeFlag", 0);
        CPH.SetArgument("shouldVentDischargeText", "false");
        CPH.SetArgument("shouldVibrateBeforeShock", false);
        CPH.SetArgument("shouldVibrateBeforeShockFlag", 0);
        CPH.SetArgument("shouldContinueVenting", false);
        CPH.SetArgument("shouldStartOverloadVent", false);
        CPH.SetArgument("shouldStartOverloadVentFlag", 0);
        CPH.SetArgument("ventTargetPressure", 0);
        CPH.SetArgument("pressureBefore", 0);
        CPH.SetArgument("intensity", 0);
        CPH.SetArgument("duration", 0);
        CPH.SetArgument("vibrateIntensity", 0);
        CPH.SetArgument("vibrateDuration", 0);
        CPH.SetArgument("vibrateOp", 1);
        CPH.SetArgument("vibrateMode", 0);
        CPH.SetArgument("vibrateShocker", 0);
        CPH.SetArgument("shockIntensity", 0);
        CPH.SetArgument("shockDuration", 0);
        CPH.SetArgument("shockOp", 0);
        CPH.SetArgument("shockMode", 0);
        CPH.SetArgument("shockShocker", 0);
        CPH.SetArgument("log", "RESET");
        CPH.SetArgument("statusSequence", statusSequence);

        PostStatusUpdate(statusSequence);

        CPH.LogInfo("[PiShock Reset] Anthro-Corp containment status reset to zero.");

        return true;
    }

    private void PostStatusUpdate(int statusSequence)
    {
        string apiBaseUrl = GetString("st_apiBaseUrl", "http://127.0.0.1:3055");
        string bearerToken = GetString("st_bearerToken", "");

        if (string.IsNullOrWhiteSpace(bearerToken))
        {
            CPH.LogError("[PiShock Reset] Missing Streamer.bot global: st_bearerToken. Skipping direct status POST.");
            return;
        }

        string json =
            "{"
            + "\"chargePool\":0,"
            + "\"pressureGauge\":0,"
            + "\"maxPressureGauge\":100,"
            + "\"hypeLevel\":0,"
            + "\"overloadArmed\":false,"
            + "\"overloadActive\":false,"
            + "\"overloadVenting\":false,"
            + "\"currentVoltage\":0,"
            + "\"storedVoltage\":0,"
            + "\"normalVoltageCap\":20,"
            + "\"overloadVoltageCap\":30,"
            + "\"lastIntensity\":0,"
            + "\"chancePercent\":0,"
            + "\"missCount\":0,"
            + "\"cooldownRemaining\":0,"
            + "\"cooldownTotal\":0,"
            + "\"cooldownUntilUtc\":\"\","
            + "\"overloadRemaining\":0,"
            + "\"overloadUntilUtc\":\"\","
            + "\"eventCountdownRemaining\":0,"
            + "\"eventCountdownTotal\":0,"
            + "\"eventCountdownUntilUtc\":\"\","
            + "\"currentViewerName\":\"\","
            + "\"currentViewerImageUrl\":\"\","
            + "\"eventMessage\":\"" + EscapeJson("Containment status reset.") + "\","
            + "\"tickerMessage\":\"\","
            + "\"eventType\":\"reset\","
            + "\"eventValueBits\":0,"
            + "\"statusSequence\":" + statusSequence + ","
            + "\"mode\":\"reset\""
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
                CPH.LogInfo("[PiShock Reset] Direct status POST sent: " + response.StatusCode + " Sequence=" + statusSequence);
            }
        }
        catch (Exception ex)
        {
            CPH.LogError("[PiShock Reset] Direct status POST failed: " + ex.ToString());
        }
    }

    private int GetInt(string name, int fallback)
    {
        try { return CPH.GetGlobalVar<int>(name, true); }
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
}
