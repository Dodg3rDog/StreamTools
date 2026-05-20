using System;
using System.IO;
using System.Net;
using System.Text;

public class CPHInline
{
    // Configure this Execute C# Code sub-action with the name:
    // AnthroCorp_PiShock_Controller
    //
    // Streamer.bot docs require public bool no-argument methods for
    // Execute C# Method discovery. This controller keeps trigger wiring thin
    // while reusing the already-tested AnthroCorp action scripts inline.

    private const string PressureEventAction = "AnthroCorp_Process_Pressure_Event";
    private const string ResetAction = "AnthroCorp_Setup_Reset";
    private const string PrepareVentStepAction = "AnthroCorp_Prepare_Vent_Step";
    private const string HypeUpdateAction = "AnthroCorp_Hype_Pressure_Update";
    private const string HypeEndAction = "AnthroCorp_Hype_Train_End";
    private const string RiftCountdownAction = "AnthroCorp_Rift_Stabilizer_Countdown";
    private const int OverloadMaxPressure = 150;
    private const int OverloadDurationSeconds = 30;
    private const int NormalChargeCap = 20;
    private const int OverloadChargeCap = 30;
    private const int StoredChargeCap = 99;

    public bool Execute()
    {
        string operation = GetStringArg("acOperation", GetStringArg("operation", ""));
        operation = NormalizeKey(operation);

        if (operation == "pressure" || operation == "contribution" || operation == "event")
            return ProcessContributionEvent();
        if (operation == "hype" || operation == "hypeupdate" || operation == "hypestart" || operation == "hypelevelup")
            return UpdateHypeTrain();
        if (operation == "hypeend")
            return EndHypeTrain();
        if (operation == "reset")
            return ResetState();
        if (operation == "armoverload" || operation == "overload")
            return ArmOverload();
        if (operation == "preparevent" || operation == "ventstep")
            return RejectLegacyVentOperation("PrepareVentStep");
        if (operation == "completevent" || operation == "completeventing")
            return RejectLegacyVentOperation("CompleteVenting");
        if (operation == "riftcountdown" || operation == "manualflushcountdown")
            return StartManualFlushCountdown();
        if (operation == "manualflush" || operation == "manualflushresult" || operation == "flushresult")
            return RunManualFlushResult();
        if (operation == "refresh" || operation == "status" || operation == "widgetstatus")
            return RefreshWidgetStatus();

        CPH.LogInfo("[AnthroCorp Controller] No acOperation supplied; defaulting to contribution pressure event.");
        return ProcessContributionEvent();
    }

    public bool ProcessContributionEvent()
    {
        NormalizeContributionArgs();
        return ExecuteAnthroMethod(PressureEventAction, "Execute");
    }

    public bool UpdateHypeTrain()
    {
        NormalizeHypeTrainArgs(false);
        return ExecuteAnthroMethod(HypeUpdateAction, "Execute");
    }

    public bool EndHypeTrain()
    {
        NormalizeHypeTrainArgs(true);
        return ExecuteAnthroMethod(HypeEndAction, "Execute");
    }

    public bool ResetState()
    {
        return ExecuteAnthroMethod(ResetAction, "Execute");
    }

    public bool ArmOverload()
    {
        bool overloadActive = GetBoolGlobal("ps_overloadActive", false);
        bool overloadVenting = GetBoolGlobal("ps_overloadVenting", false);
        string existingOverloadUntilUtc = GetStringGlobal("ps_overloadUntilUtc", "");

        if (overloadActive && IsExpired(existingOverloadUntilUtc))
        {
            overloadActive = false;
            overloadVenting = false;
            ClearOverloadState();
        }

        if (overloadVenting)
        {
            overloadVenting = false;
            CPH.SetGlobalVar("ps_overloadVenting", false, true);
            CPH.SetGlobalVar("ps_overloadVentRequested", false, true);
            CPH.LogInfo("[AnthroCorp Controller] Cleared stale legacy overload venting flag before arming.");
        }

        int pressure = GetIntGlobal("ps_pressureGauge", 0);
        int currentCharge = GetIntGlobal("ps_currentCharge", GetIntGlobal("ps_chargePool", 0));
        int storedCharge = GetIntGlobal("ps_storedCharge", 0);

        if (overloadActive)
        {
            string message = "Overload protocol already active. Red-zone pressure remains authorized.";
            int statusSequence = GetNextStatusSequence();
            int remaining = GetRemainingSeconds(existingOverloadUntilUtc);

            CPH.SetGlobalVar("ps_relayMode", "overload-armed", true);
            CPH.SetGlobalVar("ps_lastEventType", "overload", true);
            CPH.SetGlobalVar("ps_lastEventValueBits", 0, true);
            CPH.SetGlobalVar("ps_lastEventMessage", message, true);
            CPH.SetGlobalVar("ps_statusSequence", statusSequence, true);

            SetOverloadArguments(pressure, GetIntGlobal("ps_maxPressureGauge", OverloadMaxPressure), currentCharge, storedCharge, true, existingOverloadUntilUtc, remaining, message, statusSequence);
            PostOverloadStatusUpdate(pressure, GetIntGlobal("ps_maxPressureGauge", OverloadMaxPressure), true, true, false, currentCharge, storedCharge, GetIntGlobal("ps_lastFinalIntensity", 0), GetIntGlobal("ps_lastChancePercent", 0), message, "", "overload", "overload-armed", existingOverloadUntilUtc, remaining, statusSequence);

            LogOverloadSnapshot();
            CPH.LogInfo("[AnthroCorp Controller] Overload already active; refreshed widget status.");
            return true;
        }

        int overflowCharge = Math.Max(0, currentCharge - OverloadChargeCap);
        currentCharge = Math.Min(currentCharge, OverloadChargeCap);
        storedCharge = Math.Min(StoredChargeCap, storedCharge + overflowCharge);

        int refill = Math.Min(storedCharge, Math.Max(0, OverloadChargeCap - currentCharge));
        currentCharge += refill;
        storedCharge -= refill;

        DateTime until = DateTime.UtcNow.AddSeconds(OverloadDurationSeconds);
        string overloadUntilUtc = until.ToString("o");
        string eventMessage = "Overload protocol active. Red-zone pressure authorized for " + OverloadDurationSeconds + " seconds.";
        int nextStatusSequence = GetNextStatusSequence();

        CPH.SetGlobalVar("ps_overloadArmed", true, true);
        CPH.SetGlobalVar("ps_overloadActive", true, true);
        CPH.SetGlobalVar("ps_overloadVenting", false, true);
        CPH.SetGlobalVar("ps_overloadVentRequested", false, true);
        CPH.SetGlobalVar("ps_overloadUntilUtc", overloadUntilUtc, true);
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
        CPH.SetGlobalVar("ps_lastEventMessage", eventMessage, true);
        CPH.SetGlobalVar("ps_statusSequence", nextStatusSequence, true);
        CPH.SetGlobalVar("ps_relayMode", "overload-armed", true);

        SetOverloadArguments(pressure, OverloadMaxPressure, currentCharge, storedCharge, true, overloadUntilUtc, OverloadDurationSeconds, eventMessage, nextStatusSequence);
        PostOverloadStatusUpdate(pressure, OverloadMaxPressure, true, true, false, currentCharge, storedCharge, 0, 0, eventMessage, "", "overload", "overload-armed", overloadUntilUtc, OverloadDurationSeconds, nextStatusSequence);

        LogOverloadSnapshot();
        CPH.LogInfo("[AnthroCorp Controller] Overload armed directly until " + overloadUntilUtc + ". Pressure=" + pressure + "% Max=" + OverloadMaxPressure + "% Charge=" + currentCharge + " Stored=" + storedCharge);
        return true;
    }

    public bool StartManualFlushCountdown()
    {
        CPH.SetArgument("ventMode", "manual-flush");
        CPH.SetArgument("ventTargetPressure", 0);
        return ExecuteAnthroMethod(RiftCountdownAction, "Execute");
    }

    public bool PrepareVentStep()
    {
        return RejectLegacyVentOperation("PrepareVentStep");
    }

    public bool RunManualFlushResult()
    {
        CPH.SetArgument("ventMode", "manual-flush");
        CPH.SetArgument("ventTargetPressure", 0);

        bool prepared = ExecuteAnthroMethod(PrepareVentStepAction, "Execute");

        CPH.SetGlobalVar("ps_pendingVentMode", "", true);
        CPH.SetGlobalVar("ps_pendingVentTargetPressure", 0, true);
        CPH.SetGlobalVar("ps_pendingVentUntilUtc", "", true);

        return prepared;
    }

    public bool CompleteVenting()
    {
        return RejectLegacyVentOperation("CompleteVenting");
    }

    public bool PrepareManualDischarge()
    {
        CPH.LogError("[AnthroCorp Controller] PrepareManualDischarge is a legacy/test helper and is not part of the current master-script wiring.");
        return false;
    }

    public bool ApplyPiShockVibrateArgs()
    {
        int intensity = GetIntArg("vibrateIntensity", GetIntGlobal("ps_pendingVibrateIntensity", GetIntArg("intensity", 1)));
        int duration = GetIntArg("vibrateDuration", GetIntGlobal("ps_pendingVibrateDuration", 1));
        int op = GetIntArg("vibrateOp", GetIntGlobal("ps_pendingVibrateOp", 1));
        int mode = GetIntArg("vibrateMode", GetIntGlobal("ps_pendingVibrateMode", 0));
        int shocker = GetIntArg("vibrateShocker", GetIntGlobal("ps_pendingVibrateShocker", 0));

        CPH.SetArgument("intensity", intensity);
        CPH.SetArgument("duration", duration);
        CPH.SetArgument("op", op);
        CPH.SetArgument("mode", mode);
        CPH.SetArgument("shocker", shocker);
        CPH.SetArgument("log", "PRE-SHOCK VIBRATE");
        CPH.SetGlobalVar("ps_nextPiShockPreset", "vibrate", true);

        CPH.LogInfo("[AnthroCorp Controller] Applied vibrate handoff. intensity=" + intensity + " duration=" + duration + " op=" + op + " mode=" + mode + " shocker=" + shocker);
        return true;
    }

    public bool ApplyPiShockShockArgs()
    {
        int intensity = GetIntArg("shockIntensity", GetIntGlobal("ps_pendingShockIntensity", GetIntArg("intensity", 1)));
        int duration = GetIntArg("shockDuration", GetIntGlobal("ps_pendingShockDuration", GetIntArg("duration", 1)));
        int op = GetIntArg("shockOp", GetIntGlobal("ps_pendingShockOp", 0));
        int mode = GetIntArg("shockMode", GetIntGlobal("ps_pendingShockMode", 0));
        int shocker = GetIntArg("shockShocker", GetIntGlobal("ps_pendingShockShocker", 0));
        string log = GetStringArg("shockLog", GetStringGlobal("ps_pendingShockLog", GetStringArg("log", "PRESSURE EVENT")));

        CPH.SetArgument("intensity", intensity);
        CPH.SetArgument("duration", duration);
        CPH.SetArgument("op", op);
        CPH.SetArgument("mode", mode);
        CPH.SetArgument("shocker", shocker);
        CPH.SetArgument("log", log);
        CPH.SetGlobalVar("ps_nextPiShockPreset", "shock", true);

        CPH.LogInfo("[AnthroCorp Controller] Applied shock handoff. intensity=" + intensity + " duration=" + duration + " op=" + op + " mode=" + mode + " shocker=" + shocker + " log=" + log);
        return true;
    }

    public bool DebugPiShockArgs()
    {
        string preset = GetStringGlobal("ps_nextPiShockPreset", "");
        bool vibratePreset = preset.Equals("vibrate", StringComparison.OrdinalIgnoreCase);
        bool shockPreset = preset.Equals("shock", StringComparison.OrdinalIgnoreCase);
        int intensity = GetIntArg("intensity", vibratePreset
            ? GetIntGlobal("ps_pendingVibrateIntensity", -1)
            : shockPreset ? GetIntGlobal("ps_pendingShockIntensity", -1) : -1);
        int duration = GetIntArg("duration", vibratePreset
            ? GetIntGlobal("ps_pendingVibrateDuration", -1)
            : shockPreset ? GetIntGlobal("ps_pendingShockDuration", -1) : -1);
        int op = GetIntArg("op", vibratePreset
            ? GetIntGlobal("ps_pendingVibrateOp", -1)
            : shockPreset ? GetIntGlobal("ps_pendingShockOp", -1) : -1);
        int mode = GetIntArg("mode", vibratePreset
            ? GetIntGlobal("ps_pendingVibrateMode", -1)
            : shockPreset ? GetIntGlobal("ps_pendingShockMode", -1) : -1);
        int shocker = GetIntArg("shocker", vibratePreset
            ? GetIntGlobal("ps_pendingVibrateShocker", -1)
            : shockPreset ? GetIntGlobal("ps_pendingShockShocker", -1) : -1);

        CPH.LogInfo(
            "[AnthroCorp Controller Args] preset=" + preset +
            " intensity=" + intensity +
            " duration=" + duration +
            " op=" + op +
            " mode=" + mode +
            " shocker=" + shocker
        );

        if (intensity < 1)
            CPH.LogError("[AnthroCorp Controller Args] Missing or invalid intensity. PiShock V2 will not send a valid shock.");

        if (duration < 1)
            CPH.LogError("[AnthroCorp Controller Args] Missing or invalid duration. PiShock V2 will not send a valid shock.");

        if (op < 0)
            CPH.LogError("[AnthroCorp Controller Args] Missing op. Expected 0 for shock or 1 for vibrate.");

        if (mode < 0)
            CPH.LogError("[AnthroCorp Controller Args] Missing mode. Expected 0 for single/default shocker.");

        return true;
    }

    public bool AnnounceDischarge()
    {
        int pressureBefore = GetIntGlobal("ps_lastPressureBefore", GetIntGlobal("ps_lastPoolBefore", 0));
        int pressureAfter = GetIntGlobal("ps_lastPressureAfter", GetIntGlobal("ps_lastPoolAfter", 0));
        int pressureGain = GetIntGlobal("ps_lastPressureGain", 0);
        int chargeGain = GetIntGlobal("ps_lastChargeGain", 0);
        int finalIntensity = GetIntGlobal("ps_lastFinalIntensity", 0);
        int pressureVented = GetIntGlobal("ps_lastPressureVented", Math.Max(0, pressureBefore - pressureAfter));
        int chargeBefore = GetIntGlobal("ps_lastPoolBefore", 0);
        int chargeAfter = GetIntGlobal("ps_lastPoolAfter", 0);
        int storedCharge = GetIntGlobal("ps_storedCharge", 0);
        int chancePercent = GetIntGlobal("ps_lastChancePercent", 0);
        int roll = GetIntGlobal("ps_lastRoll", 0);
        int cooldownSeconds = GetIntGlobal("ps_cooldownSeconds", 0);
        string relayMode = GetStringGlobal("ps_relayMode", "discharge");
        string eventType = GetStringGlobal("ps_lastEventType", "event");
        int eventValueBits = GetIntGlobal("ps_lastEventValueBits", 0);
        bool overloadUsed = GetBoolGlobal("ps_lastOverloadUsed", false);

        string displayMode = overloadUsed || relayMode == "venting"
            ? "OVERLOAD VENT DISCHARGE"
            : "CONTAINMENT DISCHARGE";

        string msg =
            displayMode + " CONFIRMED | " +
            "Event: " + eventType + " (" + eventValueBits + " bits) | " +
            "Pressure: " + pressureBefore + "% -> " + pressureAfter + "%";

        if (pressureGain > 0)
            msg += " (+" + pressureGain + "% gained)";

        msg +=
            " | Output: intensity " + finalIntensity +
            " | Charge: " + chargeBefore + "c -> " + chargeAfter + "c";

        if (chargeGain > 0 || storedCharge > 0)
            msg += " (+" + chargeGain + "c, stored " + storedCharge + "s)";

        msg += " | Vented: " + pressureVented + "%";

        if (chancePercent > 0 || roll > 0)
            msg += " | Chance: " + chancePercent + "% Roll: " + roll;

        if (cooldownSeconds > 0)
            msg += " | Cooldown: " + cooldownSeconds + "s";

        msg += ".";

        CPH.LogInfo("[Anthro-Corp] " + msg);
        return true;
    }

    public bool RefreshWidgetStatus()
    {
        CPH.LogError("[AnthroCorp Controller] RefreshWidgetStatus no longer calls relay status bridge scripts. Current status-changing controller methods post directly.");
        return false;
    }

    private void ClearOverloadState()
    {
        CPH.SetGlobalVar("ps_overloadArmed", false, true);
        CPH.SetGlobalVar("ps_overloadActive", false, true);
        CPH.SetGlobalVar("ps_overloadVenting", false, true);
        CPH.SetGlobalVar("ps_overloadVentRequested", false, true);
        CPH.SetGlobalVar("ps_overloadUntilUtc", "", true);
        CPH.SetGlobalVar("ps_maxPressureGauge", 100, true);
    }

    private void SetOverloadArguments(
        int pressure,
        int maxPressure,
        int currentCharge,
        int storedCharge,
        bool active,
        string overloadUntilUtc,
        int overloadRemaining,
        string eventMessage,
        int statusSequence)
    {
        CPH.SetArgument("relayMode", "overload-armed");
        CPH.SetArgument("pressureGauge", pressure);
        CPH.SetArgument("maxPressureGauge", maxPressure);
        CPH.SetArgument("chargePool", currentCharge);
        CPH.SetArgument("currentVoltage", currentCharge);
        CPH.SetArgument("storedVoltage", storedCharge);
        CPH.SetArgument("normalVoltageCap", NormalChargeCap);
        CPH.SetArgument("overloadVoltageCap", OverloadChargeCap);
        CPH.SetArgument("overloadActive", active);
        CPH.SetArgument("overloadVenting", false);
        CPH.SetArgument("overloadArmed", active);
        CPH.SetArgument("overloadUntilUtc", overloadUntilUtc);
        CPH.SetArgument("overloadRemaining", overloadRemaining);
        CPH.SetArgument("eventType", "overload");
        CPH.SetArgument("eventValueBits", 0);
        CPH.SetArgument("eventMessage", eventMessage);
        CPH.SetArgument("tickerMessage", "");
        CPH.SetArgument("statusSequence", statusSequence);
    }

    private void PostOverloadStatusUpdate(
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
        string apiBaseUrl = GetStringGlobal("st_apiBaseUrl", "http://127.0.0.1:3055");
        string bearerToken = GetStringGlobal("st_bearerToken", "");

        if (string.IsNullOrWhiteSpace(bearerToken))
        {
            CPH.LogError("[AnthroCorp Controller] Missing Streamer.bot global: st_bearerToken. Skipping direct overload status POST.");
            return;
        }

        string json =
            "{"
            + "\"chargePool\":" + currentVoltage + ","
            + "\"pressureGauge\":" + pressureGauge + ","
            + "\"maxPressureGauge\":" + maxPressureGauge + ","
            + "\"hypeLevel\":" + GetIntGlobal("ps_hypeTrainLevel", 0) + ","
            + "\"overloadArmed\":" + overloadArmed.ToString().ToLower() + ","
            + "\"overloadActive\":" + overloadActive.ToString().ToLower() + ","
            + "\"overloadVenting\":" + overloadVenting.ToString().ToLower() + ","
            + "\"currentVoltage\":" + currentVoltage + ","
            + "\"storedVoltage\":" + storedVoltage + ","
            + "\"normalVoltageCap\":" + NormalChargeCap + ","
            + "\"overloadVoltageCap\":" + OverloadChargeCap + ","
            + "\"lastIntensity\":" + lastIntensity + ","
            + "\"chancePercent\":" + chancePercent + ","
            + "\"missCount\":" + GetIntGlobal("ps_missCount", 0) + ","
            + "\"cooldownRemaining\":0,"
            + "\"cooldownTotal\":0,"
            + "\"cooldownUntilUtc\":\"\","
            + "\"overloadRemaining\":" + overloadRemaining + ","
            + "\"overloadUntilUtc\":\"" + EscapeJson(overloadUntilUtc) + "\","
            + "\"eventCountdownRemaining\":0,"
            + "\"eventCountdownTotal\":0,"
            + "\"eventCountdownUntilUtc\":\"\","
            + "\"currentViewerName\":\"" + EscapeJson(GetStringGlobal("ps_lastViewerName", "")) + "\","
            + "\"currentViewerImageUrl\":\"" + EscapeJson(GetStringGlobal("ps_lastViewerImageUrl", "")) + "\","
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
                CPH.LogInfo("[AnthroCorp Controller] Direct overload status POST sent: " + response.StatusCode + " Sequence=" + statusSequence + " Mode=" + mode);
            }
        }
        catch (Exception ex)
        {
            CPH.LogError("[AnthroCorp Controller] Direct overload status POST failed: " + ex.ToString());
        }
    }

    private bool RejectLegacyVentOperation(string methodName)
    {
        CPH.LogError("[AnthroCorp Controller] " + methodName + " is legacy incremental vent wiring and is blocked in the current flow. For overload redeem, call ArmOverload only. For manual flush, call StartManualFlushCountdown, wait for the countdown, then call RunManualFlushResult.");
        return false;
    }

    private void NormalizeContributionArgs()
    {
        string eventType = GetStringArg("eventType", "");
        string normalizedType = NormalizeEventType(eventType);

        int cheerBits = GetFirstPositiveIntArg("bits", "cheerBits", "amount");
        int giftCount = GetFirstPositiveIntArg(
            "giftSubCount",
            "gifts",
            "subBombCount",
            "total",
            "totalGifts",
            "giftSubAmount",
            "giftedSubCount",
            "giftedSubs",
            "subGiftCount",
            "giftAmount",
            "gifts",
            "totalGiftSubs",
            "totalSubsGifted",
            "totalSubs",
            "count",
            "amount",
            "quantity"
        );
        int subCount = GetFirstPositiveIntArg("subCount");

        bool fromGiftBomb = GetBoolArg("fromGiftBomb", false) ||
            GetBoolArg("gifted", false) ||
            giftCount > 1 ||
            HasAnyArg("gifts", "subBombCount", "giftSubCount", "totalGifts");

        if (string.IsNullOrWhiteSpace(normalizedType))
        {
            if (fromGiftBomb || HasAnyArg("recipientUser", "recipientUserName", "recipientId"))
                normalizedType = "gift-sub";
            else if (GetBoolArg("isSub", false) || GetBoolArg("isGiftSub", false) || HasAnyArg("tier", "cumulative", "monthStreak", "multiMonthDuration"))
                normalizedType = "sub";
            else if (cheerBits > 0)
                normalizedType = "cheer";
            else
                normalizedType = "cheer";
        }

        if (normalizedType == "gift-sub")
        {
            if (giftCount <= 0)
                giftCount = Math.Max(1, subCount);
            CPH.SetArgument("giftSubCount", giftCount);
            CPH.SetArgument("subCount", giftCount);
        }
        else if (normalizedType == "sub" || normalizedType == "resub")
        {
            CPH.SetArgument("subCount", Math.Max(1, subCount));
        }
        else
        {
            CPH.SetArgument("bits", Math.Max(0, cheerBits));
        }

        CPH.SetArgument("eventType", normalizedType);
        SetFirstAvailableStringArg("displayName", "user", "userName", "user", "displayName", "recipientUser", "sender");
        SetFirstAvailableStringArg("userName", "userName", "userLogin", "login", "recipientUserName", "sender", "username");
        SetFirstAvailableStringArg("profileImageUrl", "userProfileImageUrl", "profileImageUrl", "profileImageURL", "avatar", "profileImage", "userProfileImage");

        CPH.SetArgument("isSub", normalizedType == "sub" || normalizedType == "resub" || normalizedType == "gift-sub");
        CPH.SetArgument("isGiftSub", normalizedType == "gift-sub");

        CPH.LogInfo("[AnthroCorp Controller] Contribution normalized EventType=" + normalizedType + " Bits=" + cheerBits + " GiftCount=" + giftCount + " SubCount=" + subCount);
    }

    private void NormalizeHypeTrainArgs(bool ending)
    {
        int level = ending ? 0 : GetFirstPositiveIntArg("level", "hypeTrainLevel", "currentLevel");
        CPH.SetArgument("level", level);
        CPH.SetArgument("hypeTrainLevel", level);

        string expiresAt = GetStringArg("expiresAt", "");
        if (!string.IsNullOrWhiteSpace(expiresAt))
            CPH.SetArgument("hypeTrainExpiresAt", expiresAt);

        int duration = GetFirstPositiveIntArg("duration", "hypeTrainDuration");
        if (duration > 0)
            CPH.SetArgument("duration", duration);

        CPH.LogInfo("[AnthroCorp Controller] Hype normalized Level=" + level + " Ending=" + ending);
    }

    private string NormalizeEventType(string eventType)
    {
        string normalized = NormalizeKey(eventType);
        if (normalized == "cheer" || normalized == "bits")
            return "cheer";
        if (normalized == "giftbomb" || normalized == "twitchgiftbomb" || normalized == "communitygift" || normalized == "communitygiftpurchase")
            return "gift-sub";
        if (normalized == "giftsub" || normalized == "giftsubscription" || normalized == "subgift")
            return "gift-sub";
        if (normalized == "subscription" || normalized == "sub")
            return "sub";
        if (normalized == "resubscription" || normalized == "resub")
            return "resub";

        return eventType;
    }

    private bool ExecuteAnthroMethod(string actionName, string methodName)
    {
        try
        {
            CPH.LogInfo("[AnthroCorp Controller] Executing " + actionName + "." + methodName);
            bool executed = CPH.ExecuteMethod(actionName, methodName);
            CPH.LogInfo("[AnthroCorp Controller] ExecuteMethod result for " + actionName + "." + methodName + " = " + executed);
            return executed;
        }
        catch (Exception ex)
        {
            CPH.LogError("[AnthroCorp Controller] Failed to execute " + actionName + "." + methodName + ": " + ex.ToString());
            return false;
        }
    }

    private void LogOverloadSnapshot()
    {
        CPH.LogInfo(
            "[AnthroCorp Controller] Overload snapshot Armed=" + GetBoolGlobal("ps_overloadArmed", false) +
            " Active=" + GetBoolGlobal("ps_overloadActive", false) +
            " Venting=" + GetBoolGlobal("ps_overloadVenting", false) +
            " MaxPressure=" + GetIntGlobal("ps_maxPressureGauge", 100) +
            " Until=" + GetStringGlobal("ps_overloadUntilUtc", "") +
            " RelayMode=" + GetStringGlobal("ps_relayMode", "")
        );
    }

    private void SetFirstAvailableStringArg(string targetName, params string[] sourceNames)
    {
        string existing = GetStringArg(targetName, "");
        if (!string.IsNullOrWhiteSpace(existing))
            return;

        for (int i = 0; i < sourceNames.Length; i++)
        {
            string value = GetStringArg(sourceNames[i], "");
            if (!string.IsNullOrWhiteSpace(value))
            {
                CPH.SetArgument(targetName, value);
                return;
            }
        }
    }

    private bool HasAnyArg(params string[] names)
    {
        for (int i = 0; i < names.Length; i++)
        {
            string text;
            if (CPH.TryGetArg(names[i], out text))
                return true;

            int number;
            if (CPH.TryGetArg(names[i], out number))
                return true;

            bool flag;
            if (CPH.TryGetArg(names[i], out flag))
                return true;
        }

        return false;
    }

    private int GetFirstPositiveIntArg(params string[] names)
    {
        for (int i = 0; i < names.Length; i++)
        {
            int value = GetPositiveIntArg(names[i]);
            if (value > 0)
                return value;
        }

        return 0;
    }

    private int GetPositiveIntArg(string name)
    {
        try
        {
            int value;
            if (CPH.TryGetArg(name, out value) && value > 0)
                return value;

            string text;
            if (CPH.TryGetArg(name, out text))
            {
                int parsed;
                if (int.TryParse((text ?? "").Trim(), out parsed) && parsed > 0)
                    return parsed;
            }
        }
        catch { }

        return 0;
    }

    private int GetIntArg(string name, int fallback)
    {
        try
        {
            int value;
            if (CPH.TryGetArg(name, out value))
                return value;

            string text;
            if (CPH.TryGetArg(name, out text))
            {
                int parsed;
                if (int.TryParse((text ?? "").Trim(), out parsed))
                    return parsed;
            }

            return fallback;
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

    private int GetIntGlobal(string name, int fallback)
    {
        try { return CPH.GetGlobalVar<int>(name, true); }
        catch { return fallback; }
    }

    private bool GetBoolGlobal(string name, bool fallback)
    {
        try { return CPH.GetGlobalVar<bool>(name, true); }
        catch { return fallback; }
    }

    private string GetStringGlobal(string name, string fallback)
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
        int nextGlobalSequence = GetIntGlobal("ps_statusSequence", 0) + 1;
        int timeSequence = (int)Math.Floor((DateTime.UtcNow - new DateTime(1970, 1, 1)).TotalSeconds);
        return Math.Max(nextGlobalSequence, timeSequence);
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

    private string NormalizeKey(string value)
    {
        string normalized = (value ?? "").Trim().ToLowerInvariant();
        string output = "";

        for (int i = 0; i < normalized.Length; i++)
        {
            char c = normalized[i];
            if ((c >= 'a' && c <= 'z') || (c >= '0' && c <= '9'))
                output += c;
        }

        return output;
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
