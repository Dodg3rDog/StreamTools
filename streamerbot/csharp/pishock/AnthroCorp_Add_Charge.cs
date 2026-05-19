using System;
using System.IO;
using System.Net;
using System.Text;

public class CPHInline
{
    private const int NormalChargeCap = 20;
    private const int OverloadChargeCap = 30;
    private const int StoredChargeCap = 99;

    public bool Execute()
    {
        int addPressure = GetIntArg("addPressure", -1);
        if (addPressure < 0) addPressure = GetIntArg("pressure", -1);
        int addCharge = GetIntArg("addCharge", -1);

        if (addPressure >= 0)
            AddPressure(addPressure);
        else
            AddCharge(addCharge < 0 ? 1 : addCharge);

        return true;
    }

    private void AddPressure(int addPressure)
    {
        addPressure = Math.Max(0, Math.Min(150, addPressure));
        int maxPressure = GetInt("ps_maxPressureGauge", 100);
        maxPressure = Math.Max(100, Math.Min(150, maxPressure));

        int pressure = GetInt("ps_pressureGauge", 0);
        int oldPressure = pressure;
        pressure = Math.Min(maxPressure, pressure + addPressure);
        int actualGain = pressure - oldPressure;

        CPH.SetGlobalVar("ps_pressureGauge", pressure, true);
        CPH.SetGlobalVar("ps_maxPressureGauge", maxPressure, true);
        CPH.SetGlobalVar("ps_lastPressureBefore", oldPressure, true);
        CPH.SetGlobalVar("ps_lastPressureAfter", pressure, true);
        CPH.SetGlobalVar("ps_lastPressureGain", actualGain, true);
        CPH.SetGlobalVar("ps_lastEventType", "manual-pressure", true);
        CPH.SetGlobalVar("ps_lastEventValueBits", actualGain * 10, true);
        string eventMessage = "Manual pressure adjustment applied.";
        int statusSequence = GetNextStatusSequence();
        CPH.SetGlobalVar("ps_lastEventMessage", eventMessage, true);
        CPH.SetGlobalVar("ps_statusSequence", statusSequence, true);
        CPH.SetGlobalVar("ps_relayMode", "charge", true);

        CPH.SetArgument("relayMode", "charge");
        CPH.SetArgument("pressureGauge", pressure);
        CPH.SetArgument("maxPressureGauge", maxPressure);
        CPH.SetArgument("eventType", "manual-pressure");
        CPH.SetArgument("eventValueBits", actualGain * 10);
        CPH.SetArgument("eventMessage", eventMessage);
        CPH.SetArgument("statusSequence", statusSequence);

        PostStatusUpdate(
            pressure,
            maxPressure,
            GetInt("ps_currentCharge", GetInt("ps_chargePool", 0)),
            GetInt("ps_storedCharge", 0),
            eventMessage,
            "manual-pressure",
            actualGain * 10,
            "charge",
            statusSequence
        );

        CPH.LogInfo("[PiShock Pressure] Manual pressure=" + oldPressure + "->" + pressure + " Add=" + addPressure + " Max=" + maxPressure);
    }

    private void AddCharge(int addCharge)
    {
        addCharge = Math.Max(0, Math.Min(StoredChargeCap, addCharge));
        bool overloadActive = GetBool("ps_overloadActive", false) || GetBool("ps_overloadArmed", false);
        int cap = overloadActive ? OverloadChargeCap : NormalChargeCap;
        int current = GetInt("ps_currentCharge", GetInt("ps_chargePool", 0));
        int stored = GetInt("ps_storedCharge", 0);
        if (current > cap)
        {
            int overflow = current - cap;
            current = cap;
            stored = Math.Min(StoredChargeCap, stored + overflow);
        }

        int oldCurrent = current;
        int oldStored = stored;
        int space = Math.Max(0, cap - current);

        current = Math.Min(cap, current + Math.Min(space, addCharge));
        stored = Math.Min(StoredChargeCap, stored + Math.Max(0, addCharge - space));

        CPH.SetGlobalVar("ps_currentCharge", current, true);
        CPH.SetGlobalVar("ps_storedCharge", stored, true);
        CPH.SetGlobalVar("ps_chargePool", current, true);
        CPH.SetGlobalVar("ps_lastChargeGain", addCharge, true);
        CPH.SetGlobalVar("ps_lastEventType", "manual-charge", true);
        CPH.SetGlobalVar("ps_lastEventValueBits", 0, true);
        string eventMessage = "Manual intensity charge adjustment applied.";
        int statusSequence = GetNextStatusSequence();
        CPH.SetGlobalVar("ps_lastEventMessage", eventMessage, true);
        CPH.SetGlobalVar("ps_statusSequence", statusSequence, true);
        CPH.SetGlobalVar("ps_relayMode", "charge", true);

        CPH.SetArgument("relayMode", "charge");
        CPH.SetArgument("chargePool", current);
        CPH.SetArgument("currentVoltage", current);
        CPH.SetArgument("storedVoltage", stored);
        CPH.SetArgument("normalVoltageCap", NormalChargeCap);
        CPH.SetArgument("overloadVoltageCap", OverloadChargeCap);
        CPH.SetArgument("eventType", "manual-charge");
        CPH.SetArgument("eventValueBits", 0);
        CPH.SetArgument("eventMessage", eventMessage);
        CPH.SetArgument("statusSequence", statusSequence);

        PostStatusUpdate(
            GetInt("ps_pressureGauge", 0),
            GetInt("ps_maxPressureGauge", overloadActive ? 150 : 100),
            current,
            stored,
            eventMessage,
            "manual-charge",
            0,
            "charge",
            statusSequence
        );

        CPH.LogInfo("[PiShock Charge] Manual charge=" + oldCurrent + "c/" + oldStored + "s -> " + current + "c/" + stored + "s Add=" + addCharge);
    }

    private void PostStatusUpdate(
        int pressureGauge,
        int maxPressureGauge,
        int currentVoltage,
        int storedVoltage,
        string eventMessage,
        string eventType,
        int eventValueBits,
        string mode,
        int statusSequence)
    {
        string apiBaseUrl = GetString("st_apiBaseUrl", "http://127.0.0.1:3055");
        string bearerToken = GetString("st_bearerToken", "");

        if (string.IsNullOrWhiteSpace(bearerToken))
        {
            CPH.LogError("[PiShock Charge] Missing Streamer.bot global: st_bearerToken. Skipping direct status POST.");
            return;
        }

        string json =
            "{"
            + "\"chargePool\":" + currentVoltage + ","
            + "\"pressureGauge\":" + pressureGauge + ","
            + "\"maxPressureGauge\":" + maxPressureGauge + ","
            + "\"hypeLevel\":" + GetInt("ps_hypeTrainLevel", 0) + ","
            + "\"overloadArmed\":" + GetBool("ps_overloadArmed", false).ToString().ToLower() + ","
            + "\"overloadActive\":" + GetBool("ps_overloadActive", false).ToString().ToLower() + ","
            + "\"overloadVenting\":" + GetBool("ps_overloadVenting", false).ToString().ToLower() + ","
            + "\"currentVoltage\":" + currentVoltage + ","
            + "\"storedVoltage\":" + storedVoltage + ","
            + "\"normalVoltageCap\":" + NormalChargeCap + ","
            + "\"overloadVoltageCap\":" + OverloadChargeCap + ","
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
            + "\"eventValueBits\":" + eventValueBits + ","
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
                CPH.LogInfo("[PiShock Charge] Direct status POST sent: " + response.StatusCode + " Sequence=" + statusSequence + " Mode=" + mode);
            }
        }
        catch (Exception ex)
        {
            CPH.LogError("[PiShock Charge] Direct status POST failed: " + ex.ToString());
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
