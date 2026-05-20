using System;

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
    private const string ArmOverloadAction = "AnthroCorp_Arm_Overload";
    private const string CompleteVentingAction = "AnthroCorp_Complete_Venting";
    private const string PrepareVentStepAction = "AnthroCorp_Prepare_Vent_Step";
    private const string PrepareDischargeAction = "AnthroCorp_Prepare_Discharge";
    private const string HypeUpdateAction = "AnthroCorp_Hype_Pressure_Update";
    private const string HypeEndAction = "AnthroCorp_Hype_Train_End";
    private const string RiftCountdownAction = "AnthroCorp_Rift_Stabilizer_Countdown";
    private const string ApplyVibrateAction = "AnthroCorp_Apply_PiShock_Vibrate_Args";
    private const string ApplyShockAction = "AnthroCorp_Apply_PiShock_Shock_Args";
    private const string DebugArgsAction = "AnthroCorp_Debug_PiShock_Args";
    private const string AnnounceDischargeAction = "AnthroCorp_Announce_Discharge";
    private const string RelayStatusAction = "Anthro-Corp_Relay_Status_Update";

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
        bool armed = ExecuteAnthroMethod(ArmOverloadAction, "Execute");
        LogOverloadSnapshot();

        if (armed && !GetBoolGlobal("ps_overloadActive", false))
        {
            CPH.LogError("[AnthroCorp Controller] " + ArmOverloadAction + ".Execute returned true, but ps_overloadActive is still false. Check that the Streamer.bot Execute C# Code named " + ArmOverloadAction + " contains the current overload script.");
        }

        return armed;
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
        return ExecuteAnthroMethod(PrepareDischargeAction, "Execute");
    }

    public bool ApplyPiShockVibrateArgs()
    {
        return ExecuteAnthroMethod(ApplyVibrateAction, "Execute");
    }

    public bool ApplyPiShockShockArgs()
    {
        return ExecuteAnthroMethod(ApplyShockAction, "Execute");
    }

    public bool DebugPiShockArgs()
    {
        return ExecuteAnthroMethod(DebugArgsAction, "Execute");
    }

    public bool AnnounceDischarge()
    {
        return ExecuteAnthroMethod(AnnounceDischargeAction, "Execute");
    }

    public bool RefreshWidgetStatus()
    {
        if (ExecuteAnthroMethod(RelayStatusAction, "Execute"))
            return true;

        return ExecuteAnthroMethod("AnthroCorp_Relay_Status_Update", "Execute");
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
}
