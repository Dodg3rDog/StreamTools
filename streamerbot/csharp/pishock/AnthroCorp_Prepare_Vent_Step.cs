using System;
using System.IO;
using System.Net;
using System.Text;

public class CPHInline
{
    private static readonly Random Rng = new Random();

    // ---------------------------------------------------------------------
    // ADJUSTMENTS
    // ---------------------------------------------------------------------
    private const int OverloadSafePressure = 30;
    private const int FlushSafePressure = 0;
    private const int PressureVentPerShock = 10;
    private const int ShockDurationSeconds = 1;
    private const int NormalChargeCap = 20;
    private const int OverloadChargeCap = 30;
    private const int StoredChargeCap = 99;

    public bool Execute()
    {
        int pressureBefore = GetInt("ps_pressureGauge", 0);
        int targetPressure = GetVentTargetPressure();
        bool isFlush = targetPressure <= FlushSafePressure;
        string relayMode = isFlush ? "flush" : "venting";
        string logMode = isFlush ? "MANUAL FLUSH" : "OVERLOAD VENT";

        if (isFlush)
            return PrepareRegularFlush(pressureBefore);

        if (pressureBefore <= targetPressure)
        {
            int statusSequence = GetNextStatusSequence();
            ClearPendingPiShockArgs();
            CPH.SetArgument("shouldVentDischarge", false);
            CPH.SetArgument("shouldVentDischargeFlag", 0);
            CPH.SetArgument("shouldVentDischargeText", "false");
            CPH.SetArgument("shouldVibrateBeforeShock", false);
            CPH.SetArgument("shouldVibrateBeforeShockFlag", 0);
            CPH.SetArgument("shouldContinueVenting", false);
            CPH.SetArgument("ventTargetPressure", targetPressure);
            CPH.SetGlobalVar("ps_lastEventType", relayMode, true);
            CPH.SetGlobalVar("ps_lastEventValueBits", 0, true);
            CPH.SetGlobalVar("ps_lastEventMessage", "Venting skipped. Pressure already at target " + targetPressure + "%.", true);
            CPH.SetGlobalVar("ps_relayMode", isFlush ? "flush" : "recovery", true);
            CPH.SetGlobalVar("ps_statusSequence", statusSequence, true);
            CPH.SetArgument("relayMode", isFlush ? "flush" : "recovery");
            CPH.SetArgument("pressureGauge", pressureBefore);
            CPH.SetArgument("currentVoltage", GetInt("ps_currentCharge", GetInt("ps_chargePool", 0)));
            CPH.SetArgument("storedVoltage", GetInt("ps_storedCharge", 0));
            CPH.SetArgument("chargePool", GetInt("ps_currentCharge", GetInt("ps_chargePool", 0)));
            CPH.SetArgument("eventType", relayMode);
            CPH.SetArgument("eventValueBits", 0);
            CPH.SetArgument("eventMessage", "Venting skipped. Pressure already at target " + targetPressure + "%.");
            CPH.SetArgument("tickerMessage", "");
            CPH.SetArgument("statusSequence", statusSequence);
            PostStatusUpdate(
                pressureBefore,
                GetInt("ps_maxPressureGauge", 100),
                GetBool("ps_overloadArmed", false),
                GetBool("ps_overloadActive", false),
                GetBool("ps_overloadVenting", false),
                GetInt("ps_currentCharge", GetInt("ps_chargePool", 0)),
                GetInt("ps_storedCharge", 0),
                NormalChargeCap,
                OverloadChargeCap,
                0,
                GetInt("ps_lastChancePercent", 0),
                "Venting skipped. Pressure already at target " + targetPressure + "%.",
                "",
                relayMode,
                isFlush ? "flush" : "recovery",
                statusSequence
            );
            CPH.LogInfo("[PiShock Vent] Skipped. Pressure=" + pressureBefore + "% Target=" + targetPressure + "%");
            return true;
        }

        int intensity = PressureToIntensity(pressureBefore);
        int pressureAfter = Math.Max(targetPressure, pressureBefore - PressureVentPerShock);
        bool shouldContinue = pressureAfter > targetPressure;
        int currentCharge = GetInt("ps_currentCharge", GetInt("ps_chargePool", 0));
        int storedCharge = GetInt("ps_storedCharge", 0);
        int ventStatusSequence = GetNextStatusSequence();

        CPH.SetGlobalVar("ps_overloadVenting", !isFlush, true);
        CPH.SetGlobalVar("ps_pressureGauge", pressureAfter, true);
        CPH.SetGlobalVar("ps_lastFinalIntensity", intensity, true);
        CPH.SetGlobalVar("ps_lastPressureVented", pressureBefore - pressureAfter, true);
        CPH.SetGlobalVar("ps_lastChargeSpent", 0, true);
        CPH.SetGlobalVar("ps_lastPoolBefore", currentCharge, true);
        CPH.SetGlobalVar("ps_lastPoolAfter", currentCharge, true);
        CPH.SetGlobalVar("ps_lastOverloadUsed", !isFlush, true);
        CPH.SetGlobalVar("ps_lastEventType", relayMode, true);
        CPH.SetGlobalVar("ps_lastEventValueBits", 0, true);
        CPH.SetGlobalVar("ps_lastEventMessage", logMode + " prepared at intensity " + intensity + ". Pressure " + pressureBefore + "% -> " + pressureAfter + "%. Target " + targetPressure + "%.", true);
        CPH.SetGlobalVar("ps_relayMode", relayMode, true);
        CPH.SetGlobalVar("ps_statusSequence", ventStatusSequence, true);

        CPH.SetArgument("shouldVentDischarge", true);
        CPH.SetArgument("shouldVentDischargeFlag", 1);
        CPH.SetArgument("shouldVentDischargeText", "true");
        CPH.SetArgument("shouldVibrateBeforeShock", true);
        CPH.SetArgument("shouldVibrateBeforeShockFlag", 1);
        CPH.SetArgument("shouldContinueVenting", shouldContinue);
        CPH.SetArgument("ventTargetPressure", targetPressure);
        CPH.SetArgument("pressureBefore", pressureBefore);
        CPH.SetArgument("pressureGauge", pressureAfter);
        CPH.SetArgument("chargePool", currentCharge);
        CPH.SetArgument("currentVoltage", currentCharge);
        CPH.SetArgument("storedVoltage", storedCharge);
        CPH.SetArgument("normalVoltageCap", NormalChargeCap);
        CPH.SetArgument("overloadVoltageCap", OverloadChargeCap);
        CPH.SetArgument("intensity", intensity);
        CPH.SetArgument("lastIntensity", intensity);
        CPH.SetArgument("duration", ShockDurationSeconds);
        CPH.SetArgument("op", 0);
        CPH.SetArgument("mode", 0);
        CPH.SetArgument("shocker", 0);
        CPH.SetArgument("vibrateIntensity", intensity);
        CPH.SetArgument("vibrateDuration", 1);
        CPH.SetArgument("vibrateOp", 1);
        CPH.SetArgument("vibrateMode", 0);
        CPH.SetArgument("vibrateShocker", 0);
        CPH.SetArgument("shockIntensity", intensity);
        CPH.SetArgument("shockDuration", ShockDurationSeconds);
        CPH.SetArgument("shockOp", 0);
        CPH.SetArgument("shockMode", 0);
        CPH.SetArgument("shockShocker", 0);
        SetPendingPiShockArgs(intensity, ShockDurationSeconds, logMode);
        CPH.SetArgument("log", logMode);
        CPH.SetArgument("relayMode", relayMode);
        CPH.SetArgument("eventType", relayMode);
        CPH.SetArgument("eventValueBits", 0);
        CPH.SetArgument("eventMessage", logMode + " prepared at intensity " + intensity + ". Pressure " + pressureBefore + "% -> " + pressureAfter + "%. Target " + targetPressure + "%.");
        CPH.SetArgument("tickerMessage", "");
        CPH.SetArgument("statusSequence", ventStatusSequence);
        PostStatusUpdate(
            pressureAfter,
            GetInt("ps_maxPressureGauge", 150),
            GetBool("ps_overloadArmed", false),
            GetBool("ps_overloadActive", false),
            true,
            currentCharge,
            storedCharge,
            NormalChargeCap,
            OverloadChargeCap,
            intensity,
            GetInt("ps_lastChancePercent", 0),
            logMode + " prepared at intensity " + intensity + ". Pressure " + pressureBefore + "% -> " + pressureAfter + "%. Target " + targetPressure + "%.",
            "",
            relayMode,
            relayMode,
            ventStatusSequence
        );

        CPH.LogInfo("[PiShock Vent] Prepared mode=" + relayMode + " intensity=" + intensity + " Pressure=" + pressureBefore + "->" + pressureAfter + " Target=" + targetPressure + " Continue=" + shouldContinue);
        return true;
    }

    private bool PrepareRegularFlush(int pressureBefore)
    {
        bool overloadActive = GetBool("ps_overloadActive", false) || GetBool("ps_overloadArmed", false);
        int cap = overloadActive ? OverloadChargeCap : NormalChargeCap;
        int currentBefore = GetInt("ps_currentCharge", GetInt("ps_chargePool", 0));
        int storedBefore = GetInt("ps_storedCharge", 0);
        if (currentBefore > cap)
        {
            int overflow = currentBefore - cap;
            currentBefore = cap;
            storedBefore = Math.Min(StoredChargeCap, storedBefore + overflow);
        }

        int riskChance = Clamp(pressureBefore, 0, 100);
        int roll = riskChance > 0 ? Rng.Next(1, 101) : 0;
        bool shouldDischarge = currentBefore > 0 && (pressureBefore >= 100 || (riskChance > 0 && roll <= riskChance));
        int currentLoss = currentBefore;
        int currentAfter = 0;
        int storedAfter = storedBefore;

        int intensity = shouldDischarge ? Clamp(currentBefore, 1, cap) : 0;
        string relayMode = shouldDischarge ? "vent-discharge" : "flush";
        string eventMessage = shouldDischarge
            ? "Warning. Warning. Impulse imminent. Emergency discharge initiated."
            : "Discharge averted. All systems returning to normal.";
        string tickerMessage = shouldDischarge
            ? "WARNING // WARNING // IMPULSE IMMINENT // EMERGENCY DISCHARGE INITIATED"
            : "DISCHARGE AVERTED // ALL SYSTEMS RETURNING TO NORMAL";
        int statusSequence = GetNextStatusSequence();

        CPH.SetGlobalVar("ps_pressureGauge", 0, true);
        CPH.SetGlobalVar("ps_currentCharge", currentAfter, true);
        CPH.SetGlobalVar("ps_storedCharge", storedAfter, true);
        CPH.SetGlobalVar("ps_chargePool", currentAfter, true);
        CPH.SetGlobalVar("ps_maxPressureGauge", 100, true);
        CPH.SetGlobalVar("ps_overloadArmed", false, true);
        CPH.SetGlobalVar("ps_overloadActive", false, true);
        CPH.SetGlobalVar("ps_overloadVenting", false, true);
        CPH.SetGlobalVar("ps_overloadVentRequested", false, true);
        CPH.SetGlobalVar("ps_overloadUntilUtc", "", true);
        CPH.SetGlobalVar("ps_lastChancePercent", riskChance, true);
        CPH.SetGlobalVar("ps_lastRoll", roll, true);
        CPH.SetGlobalVar("ps_lastPressureBefore", pressureBefore, true);
        CPH.SetGlobalVar("ps_lastPressureAfter", 0, true);
        CPH.SetGlobalVar("ps_lastPressureGain", 0, true);
        CPH.SetGlobalVar("ps_lastPressureVented", pressureBefore, true);
        CPH.SetGlobalVar("ps_lastFinalIntensity", intensity, true);
        CPH.SetGlobalVar("ps_lastChargeSpent", currentLoss, true);
        CPH.SetGlobalVar("ps_lastPoolBefore", currentBefore, true);
        CPH.SetGlobalVar("ps_lastPoolAfter", currentAfter, true);
        CPH.SetGlobalVar("ps_lastOverloadUsed", overloadActive, true);
        CPH.SetGlobalVar("ps_lastEventType", "vent", true);
        CPH.SetGlobalVar("ps_lastEventValueBits", 0, true);
        CPH.SetGlobalVar("ps_lastEventMessage", eventMessage, true);
        CPH.SetGlobalVar("ps_lastTickerMessage", tickerMessage, true);
        CPH.SetGlobalVar("ps_eventCountdownUntilUtc", "", true);
        CPH.SetGlobalVar("ps_eventCountdownTotal", 0, true);
        CPH.SetGlobalVar("ps_eventCountdownRemaining", 0, true);
        CPH.SetGlobalVar("ps_relayMode", relayMode, true);
        CPH.SetGlobalVar("ps_statusSequence", statusSequence, true);

        CPH.SetArgument("shouldVentDischarge", shouldDischarge);
        CPH.SetArgument("shouldVentDischargeFlag", shouldDischarge ? 1 : 0);
        CPH.SetArgument("shouldVentDischargeText", shouldDischarge ? "true" : "false");
        CPH.SetArgument("shouldVibrateBeforeShock", shouldDischarge);
        CPH.SetArgument("shouldVibrateBeforeShockFlag", shouldDischarge ? 1 : 0);
        CPH.SetArgument("shouldContinueVenting", false);
        CPH.SetArgument("ventTargetPressure", 0);
        CPH.SetArgument("pressureBefore", pressureBefore);
        CPH.SetArgument("pressureGauge", 0);
        CPH.SetArgument("chargePool", currentAfter);
        CPH.SetArgument("currentVoltage", currentAfter);
        CPH.SetArgument("storedVoltage", storedAfter);
        CPH.SetArgument("normalVoltageCap", NormalChargeCap);
        CPH.SetArgument("overloadVoltageCap", OverloadChargeCap);
        CPH.SetArgument("chancePercent", riskChance);
        CPH.SetArgument("lastRoll", roll);
        CPH.SetArgument("lastIntensity", intensity);
        CPH.SetArgument("eventType", "vent");
        CPH.SetArgument("eventValueBits", 0);
        CPH.SetArgument("eventMessage", eventMessage);
        CPH.SetArgument("tickerMessage", tickerMessage);
        CPH.SetArgument("eventCountdownRemaining", 0);
        CPH.SetArgument("eventCountdownTotal", 0);
        CPH.SetArgument("eventCountdownUntilUtc", "");
        CPH.SetArgument("relayMode", relayMode);
        CPH.SetArgument("statusSequence", statusSequence);
        PostStatusUpdate(
            0,
            100,
            false,
            false,
            false,
            currentAfter,
            storedAfter,
            NormalChargeCap,
            OverloadChargeCap,
            intensity,
            riskChance,
            eventMessage,
            tickerMessage,
            "vent",
            relayMode,
            statusSequence
        );

        if (shouldDischarge)
        {
            SetPendingPiShockArgs(intensity, ShockDurationSeconds, "REGULAR VENT");
            CPH.SetArgument("vibrateIntensity", intensity);
            CPH.SetArgument("vibrateDuration", 1);
            CPH.SetArgument("vibrateOp", 1);
            CPH.SetArgument("vibrateMode", 0);
            CPH.SetArgument("vibrateShocker", 0);
            CPH.SetArgument("shockIntensity", intensity);
            CPH.SetArgument("shockDuration", ShockDurationSeconds);
            CPH.SetArgument("shockOp", 0);
            CPH.SetArgument("shockMode", 0);
            CPH.SetArgument("shockShocker", 0);
            CPH.SetArgument("intensity", intensity);
            CPH.SetArgument("duration", ShockDurationSeconds);
            CPH.SetArgument("op", 0);
            CPH.SetArgument("mode", 0);
            CPH.SetArgument("shocker", 0);
            CPH.SetArgument("log", "REGULAR VENT");
        }
        else
        {
            ClearPendingPiShockArgs();
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
        }

        CPH.LogInfo("[PiShock Vent] Regular flush Pressure=" + pressureBefore + "->0 Current=" + currentBefore + "->" + currentAfter + " Stored=" + storedBefore + "->" + storedAfter + " Chance=" + riskChance + " Roll=" + roll + " Discharge=" + shouldDischarge);
        return true;
    }

    private void PostStatusUpdate(
        int pressureGauge,
        int maxPressureGauge,
        bool overloadArmed,
        bool overloadActive,
        bool overloadVenting,
        int currentVoltage,
        int storedVoltage,
        int normalVoltageCap,
        int overloadVoltageCap,
        int lastIntensity,
        int chancePercent,
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
            + "\"hypeLevel\":" + GetInt("ps_hypeTrainLevel", 0) + ","
            + "\"overloadArmed\":" + overloadArmed.ToString().ToLower() + ","
            + "\"overloadActive\":" + overloadActive.ToString().ToLower() + ","
            + "\"overloadVenting\":" + overloadVenting.ToString().ToLower() + ","
            + "\"currentVoltage\":" + currentVoltage + ","
            + "\"storedVoltage\":" + storedVoltage + ","
            + "\"normalVoltageCap\":" + normalVoltageCap + ","
            + "\"overloadVoltageCap\":" + overloadVoltageCap + ","
            + "\"lastIntensity\":" + lastIntensity + ","
            + "\"chancePercent\":" + chancePercent + ","
            + "\"missCount\":" + GetInt("ps_missCount", 0) + ","
            + "\"cooldownRemaining\":0,"
            + "\"cooldownTotal\":0,"
            + "\"cooldownUntilUtc\":\"\","
            + "\"overloadRemaining\":0,"
            + "\"overloadUntilUtc\":\"" + EscapeJson(GetString("ps_overloadUntilUtc", "")) + "\","
            + "\"eventCountdownRemaining\":0,"
            + "\"eventCountdownTotal\":0,"
            + "\"eventCountdownUntilUtc\":\"\","
            + "\"currentViewerName\":\"\","
            + "\"currentViewerImageUrl\":\"\","
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
                CPH.LogInfo("[PiShock Vent] Direct status POST sent: " + response.StatusCode + " Sequence=" + statusSequence + " Mode=" + mode);
            }
        }
        catch (Exception ex)
        {
            CPH.LogError("[PiShock Vent] Direct status POST failed: " + ex.ToString());
        }
    }

    private int PressureToIntensity(int pressure)
    {
        return Math.Min(Math.Max((int)Math.Ceiling(pressure / 10.0), 1), 15);
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

    private void ClearPendingPiShockArgs()
    {
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

    private int GetNextStatusSequence()
    {
        int nextGlobalSequence = GetInt("ps_statusSequence", 0) + 1;
        int timeSequence = (int)Math.Floor((DateTime.UtcNow - new DateTime(1970, 1, 1)).TotalSeconds);
        return Math.Max(nextGlobalSequence, timeSequence);
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
