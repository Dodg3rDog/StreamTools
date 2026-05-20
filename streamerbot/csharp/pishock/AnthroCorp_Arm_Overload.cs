using System;
using System.IO;
using System.Net;
using System.Text;

public class CPHInline
{
    // ---------------------------------------------------------------------
    // ADJUSTMENTS
    // ---------------------------------------------------------------------
    private const int OverloadMaxPressure = 150;
    private const int OverloadDurationSeconds = 30;
    private const int NormalChargeCap = 20;
    private const int OverloadChargeCap = 30;
    private const int StoredChargeCap = 99;

    public bool Execute()
    {
        bool overloadActive = GetBool("ps_overloadActive", false);
        bool overloadVenting = GetBool("ps_overloadVenting", false);
        string existingOverloadUntilUtc = GetString("ps_overloadUntilUtc", "");

        if (overloadActive && IsExpired(existingOverloadUntilUtc))
        {
            overloadActive = false;
            overloadVenting = false;
            CPH.SetGlobalVar("ps_overloadArmed", false, true);
            CPH.SetGlobalVar("ps_overloadActive", false, true);
            CPH.SetGlobalVar("ps_overloadVenting", false, true);
            CPH.SetGlobalVar("ps_overloadVentRequested", false, true);
            CPH.SetGlobalVar("ps_overloadUntilUtc", "", true);
            CPH.SetGlobalVar("ps_maxPressureGauge", 100, true);
        }

        if (overloadVenting)
        {
            overloadVenting = false;
            CPH.SetGlobalVar("ps_overloadVenting", false, true);
            CPH.SetGlobalVar("ps_overloadVentRequested", false, true);
            CPH.LogInfo("[PiShock Overload] Cleared stale legacy overload venting flag before arming.");
        }

        if (overloadActive)
        {
            SetRelay("overload-armed", "Overload protocol already active. Red-zone pressure remains authorized.");
            CPH.LogInfo("[PiShock Overload] Already active.");
            return true;
        }

        DateTime until = DateTime.UtcNow.AddSeconds(OverloadDurationSeconds);
        int pressure = GetInt("ps_pressureGauge", 0);
        int currentCharge = GetInt("ps_currentCharge", GetInt("ps_chargePool", 0));
        int storedCharge = GetInt("ps_storedCharge", 0);
        int overflowCharge = Math.Max(0, currentCharge - OverloadChargeCap);
        currentCharge = Math.Min(currentCharge, OverloadChargeCap);
        storedCharge = Math.Min(StoredChargeCap, storedCharge + overflowCharge);

        int refill = Math.Min(storedCharge, Math.Max(0, OverloadChargeCap - currentCharge));
        currentCharge += refill;
        storedCharge -= refill;

        CPH.SetGlobalVar("ps_overloadArmed", true, true);
        CPH.SetGlobalVar("ps_overloadActive", true, true);
        CPH.SetGlobalVar("ps_overloadVenting", false, true);
        CPH.SetGlobalVar("ps_overloadVentRequested", false, true);
        CPH.SetGlobalVar("ps_overloadUntilUtc", until.ToString("o"), true);
        CPH.SetGlobalVar("ps_maxPressureGauge", OverloadMaxPressure, true);
        CPH.SetGlobalVar("ps_currentCharge", currentCharge, true);
        CPH.SetGlobalVar("ps_storedCharge", storedCharge, true);
        CPH.SetGlobalVar("ps_chargePool", currentCharge, true);
        CPH.SetGlobalVar("ps_normalChargeCap", NormalChargeCap, true);
        CPH.SetGlobalVar("ps_overloadChargeCap", OverloadChargeCap, true);
        CPH.SetGlobalVar("ps_cooldownUntilUtc", "", true);
        CPH.SetGlobalVar("ps_cooldownSeconds", 0, true);
        CPH.SetGlobalVar("ps_cooldownRemaining", 0, true);
        CPH.SetGlobalVar("ps_lastEventType", "overload", true);
        CPH.SetGlobalVar("ps_lastEventValueBits", 0, true);
        string eventMessage = "Overload protocol active. Red-zone pressure authorized for " + OverloadDurationSeconds + " seconds.";
        int statusSequence = GetNextStatusSequence();
        CPH.SetGlobalVar("ps_lastEventMessage", eventMessage, true);
        CPH.SetGlobalVar("ps_statusSequence", statusSequence, true);
        CPH.SetGlobalVar("ps_relayMode", "overload-armed", true);

        CPH.SetArgument("relayMode", "overload-armed");
        CPH.SetArgument("pressureGauge", pressure);
        CPH.SetArgument("maxPressureGauge", OverloadMaxPressure);
        CPH.SetArgument("chargePool", currentCharge);
        CPH.SetArgument("currentVoltage", currentCharge);
        CPH.SetArgument("storedVoltage", storedCharge);
        CPH.SetArgument("normalVoltageCap", NormalChargeCap);
        CPH.SetArgument("overloadVoltageCap", OverloadChargeCap);
        CPH.SetArgument("overloadActive", true);
        CPH.SetArgument("overloadVenting", false);
        CPH.SetArgument("overloadArmed", true);
        CPH.SetArgument("overloadUntilUtc", until.ToString("o"));
        CPH.SetArgument("overloadRemaining", OverloadDurationSeconds);
        CPH.SetArgument("eventType", "overload");
        CPH.SetArgument("eventValueBits", 0);
        CPH.SetArgument("eventMessage", eventMessage);
        CPH.SetArgument("tickerMessage", "");
        CPH.SetArgument("statusSequence", statusSequence);

        PostStatusUpdate(
            pressure,
            OverloadMaxPressure,
            true,
            true,
            false,
            currentCharge,
            storedCharge,
            0,
            0,
            eventMessage,
            "",
            "overload",
            "overload-armed",
            until.ToString("o"),
            OverloadDurationSeconds,
            statusSequence
        );

        CPH.LogInfo("[PiShock Overload] Active until " + until.ToString("o") + ". Pressure=" + pressure + "% Max=" + OverloadMaxPressure + "% Charge=" + currentCharge + " Stored=" + storedCharge);
        return true;
    }

    private void SetRelay(string mode, string message)
    {
        int statusSequence = GetNextStatusSequence();
        CPH.SetGlobalVar("ps_relayMode", mode, true);
        CPH.SetGlobalVar("ps_lastEventType", "overload", true);
        CPH.SetGlobalVar("ps_lastEventValueBits", 0, true);
        CPH.SetGlobalVar("ps_lastEventMessage", message, true);
        CPH.SetGlobalVar("ps_statusSequence", statusSequence, true);
        CPH.SetArgument("relayMode", mode);
        CPH.SetArgument("eventType", "overload");
        CPH.SetArgument("eventValueBits", 0);
        CPH.SetArgument("eventMessage", message);
        CPH.SetArgument("statusSequence", statusSequence);

        string overloadUntilUtc = GetString("ps_overloadUntilUtc", "");
        PostStatusUpdate(
            GetInt("ps_pressureGauge", 0),
            GetInt("ps_maxPressureGauge", 100),
            GetBool("ps_overloadArmed", false),
            GetBool("ps_overloadActive", false),
            GetBool("ps_overloadVenting", false),
            GetInt("ps_currentCharge", GetInt("ps_chargePool", 0)),
            GetInt("ps_storedCharge", 0),
            GetInt("ps_lastFinalIntensity", 0),
            GetInt("ps_lastChancePercent", 0),
            message,
            "",
            "overload",
            mode,
            overloadUntilUtc,
            GetRemainingSeconds(overloadUntilUtc),
            statusSequence
        );
    }

    private void PostStatusUpdate(
        int pressureGauge,
        int maxPressureGauge,
        bool overloadArmed,
        bool overloadActive,
        bool overloadVenting,
        int currentVoltage,
        int storedVoltage,
        int lastIntensity,
        int chancePercent,
        string eventMessage,
        string tickerMessage,
        string eventType,
        string mode,
        string overloadUntilUtc,
        int overloadRemaining,
        int statusSequence)
    {
        string apiBaseUrl = GetString("st_apiBaseUrl", "http://127.0.0.1:3055");
        string bearerToken = GetString("st_bearerToken", "");

        if (string.IsNullOrWhiteSpace(bearerToken))
        {
            CPH.LogError("[PiShock Overload] Missing Streamer.bot global: st_bearerToken. Skipping direct status POST.");
            return;
        }

        string json =
            "{"
            + "\"chargePool\":" + currentVoltage + ","
            + "\"pressureGauge\":" + pressureGauge + ","
            + "\"maxPressureGauge\":" + maxPressureGauge + ","
            + "\"hypeLevel\":" + GetInt("ps_hypeTrainLevel", 0) + ","
            + "\"overloadArmed\":" + overloadArmed.ToString().ToLower() + ","
            + "\"overloadActive\":" + overloadActive.ToString().ToLower() + ","
            + "\"overloadVenting\":" + overloadVenting.ToString().ToLower() + ","
            + "\"currentVoltage\":" + currentVoltage + ","
            + "\"storedVoltage\":" + storedVoltage + ","
            + "\"normalVoltageCap\":" + NormalChargeCap + ","
            + "\"overloadVoltageCap\":" + OverloadChargeCap + ","
            + "\"lastIntensity\":" + lastIntensity + ","
            + "\"chancePercent\":" + chancePercent + ","
            + "\"missCount\":" + GetInt("ps_missCount", 0) + ","
            + "\"cooldownRemaining\":0,"
            + "\"cooldownTotal\":0,"
            + "\"cooldownUntilUtc\":\"\","
            + "\"overloadRemaining\":" + overloadRemaining + ","
            + "\"overloadUntilUtc\":\"" + EscapeJson(overloadUntilUtc) + "\","
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
                CPH.LogInfo("[PiShock Overload] Direct status POST sent: " + response.StatusCode + " Sequence=" + statusSequence + " Mode=" + mode);
            }
        }
        catch (Exception ex)
        {
            CPH.LogError("[PiShock Overload] Direct status POST failed: " + ex.ToString());
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

    private int GetRemainingSeconds(string untilUtc)
    {
        DateTime until;
        if (DateTime.TryParse(untilUtc, out until))
        {
            DateTime utc = until.ToUniversalTime();
            if (DateTime.UtcNow < utc)
                return (int)Math.Ceiling((utc - DateTime.UtcNow).TotalSeconds);
        }

        return 0;
    }

    private bool IsExpired(string untilUtc)
    {
        DateTime until;
        if (DateTime.TryParse(untilUtc, out until))
            return DateTime.UtcNow >= until.ToUniversalTime();

        return false;
    }

    private int GetNextStatusSequence()
    {
        int nextGlobalSequence = GetInt("ps_statusSequence", 0) + 1;
        int timeSequence = (int)Math.Floor((DateTime.UtcNow - new DateTime(1970, 1, 1)).TotalSeconds);
        return Math.Max(nextGlobalSequence, timeSequence);
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
