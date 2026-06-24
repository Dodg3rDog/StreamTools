using System;
using System.IO;
using System.Net;
using System.Text;

public class CPHInline
{
    // Configure this Execute C# Code sub-action with the name:
    // AnthroCorp_PiShock_Controller
    //
    // This is the master AnthroCorp state/widget controller. It intentionally
    // does not call other AnthroCorp Streamer.bot actions by name; public
    // methods are entry points for trigger wiring.

    private static readonly Random Rng = new Random();
    private int pooledCheerMessageTier = 0;

    private const int NormalMaxPressure = 100;
    private const int OverloadMaxPressure = 150;
    private const int OverloadDurationSeconds = 30;
    private const int NormalChargeCap = 20;
    private const int OverloadChargeCap = 30;
    private const int StoredChargeCap = 99;
    private const int MaximumPressureGain = 150;
    private const int GiftSubEquivalentBits = 700;
    private const int SmallCheerLedgerThresholdBits = 50;
    private const int HypePressureBonusPerLevel = 5;
    private const int SmallCheerCurrentChancePercent = 15;
    private const int CooldownMinSeconds = 10;
    private const int CooldownMaxSeconds = 30;
    private const int ViewerDisplayCooldownSeconds = 10;
    private const int CenterViewerMinimumBits = 500;
    private const int ShockDurationSeconds = 1;
    private const int DefaultCountdownSeconds = 5;
    private const int PendingVentGraceMinutes = 10;
    private const int FlushSafePressure = 0;
    private const int ManualFlushResultBufferMilliseconds = 250;

    private static readonly ChargeTier[] ChargeTable = new ChargeTier[]
    {
        new ChargeTier(1, 99, 0),
        new ChargeTier(100, 699, 0),
        new ChargeTier(700, 3499, 2),
        new ChargeTier(3500, int.MaxValue, 4)
    };

    private static readonly string[] PooledCheerMessages = new string[]
    {
        "Employee donation pool reached 50 bits.",
        "Chat found 50 bits between the seats.",
        "Breakroom coin jar contributed 50 bits.",
        "Loose change recovered from the capacitor bay.",
        "Payroll rounding error credited 50 bits.",
        "Snack machine refund rerouted to containment.",
        "Chat pooled enough bits for a pressure bump.",
        "Donation pool threshold reached.",
        "Small cheer ledger discharged one packet.",
        "Chat bundled the small stuff into something useful."
    };

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
        DateTime now = DateTime.UtcNow;

        string eventType = GetStringArg("eventType", "cheer");
        int subEventCount = IsSubEvent(eventType) ? GetSubEventCount() : 0;
        int eventBits = GetEventBits(eventType);
        int rawEventBits = eventBits;
        string viewerNameFromEvent = ResolveViewerName();
        int smallCheerLedgerBefore = GetIntGlobal("ps_smallCheerBitsLedger", 0);
        int smallCheerLedgerAfter = smallCheerLedgerBefore;
        int smallCheerLedgerReleasedBits = 0;

        if (IsSmallCheerLedgerEligible(eventType, eventBits))
        {
            int ledgerTotal = smallCheerLedgerBefore + eventBits;
            smallCheerLedgerReleasedBits = (ledgerTotal / SmallCheerLedgerThresholdBits) * SmallCheerLedgerThresholdBits;
            smallCheerLedgerAfter = ledgerTotal % SmallCheerLedgerThresholdBits;
            eventBits = smallCheerLedgerReleasedBits;
        }

        bool pooledCheerRelease = smallCheerLedgerReleasedBits > 0;
        int hypeLevel = GetIntGlobal("ps_hypeTrainLevel", 0);
        bool hypeActive = GetBoolGlobal("ps_hypeTrainActive", hypeLevel > 0);
        if (!hypeActive)
            hypeLevel = 0;

        bool overloadActive = GetBoolGlobal("ps_overloadActive", false);
        bool overloadArmed = GetBoolGlobal("ps_overloadArmed", false);
        bool overloadVenting = GetBoolGlobal("ps_overloadVenting", false);
        string overloadUntilUtc = GetStringGlobal("ps_overloadUntilUtc", "");

        if (overloadVenting)
        {
            overloadVenting = false;
            CPH.SetGlobalVar("ps_overloadVenting", false, true);
            CPH.SetGlobalVar("ps_overloadVentRequested", false, true);
            CPH.LogInfo("[AnthroCorp Controller] Cleared stale legacy overload venting flag during pressure event.");
        }

        if (overloadActive && IsExpired(overloadUntilUtc))
        {
            overloadActive = false;
            overloadArmed = false;
            overloadUntilUtc = "";
            ClearOverloadState();
        }

        int maxPressure = overloadActive ? OverloadMaxPressure : NormalMaxPressure;
        int pressureBefore = GetIntGlobal("ps_pressureGauge", 0);
        int pressureGain = CalculatePressureGain(eventType, eventBits);
        if (hypeLevel > 0 && pressureGain > 0)
            pressureGain = Clamp(pressureGain + (hypeLevel * HypePressureBonusPerLevel), 0, MaximumPressureGain);

        int pressureAfterCharge = Clamp(pressureBefore + pressureGain, 0, maxPressure);
        int chargeCap = overloadActive || overloadArmed ? OverloadChargeCap : NormalChargeCap;
        int currentChargeBefore = GetIntGlobal("ps_currentCharge", GetIntGlobal("ps_chargePool", 0));
        int storedChargeBefore = GetIntGlobal("ps_storedCharge", 0);
        if (currentChargeBefore > chargeCap)
        {
            int overflowCharge = currentChargeBefore - chargeCap;
            currentChargeBefore = chargeCap;
            storedChargeBefore = Clamp(storedChargeBefore + overflowCharge, 0, StoredChargeCap);
        }

        int chargeGain = CalculateChargeGain(eventType, eventBits);
        int smallCheerCurrentRoll = 0;
        bool smallCheerCurrentHit = false;
        if (IsSmallCheerCurrentEligible(eventType, eventBits))
        {
            smallCheerCurrentRoll = Rng.Next(1, 101);
            smallCheerCurrentHit = smallCheerCurrentRoll <= SmallCheerCurrentChancePercent;
            if (smallCheerCurrentHit)
                chargeGain += 2;
        }

        if (hypeLevel > 0 && chargeGain > 0)
            chargeGain += CalculateHypeChargeBonus(hypeLevel);

        int chargeSpace = Math.Max(0, chargeCap - currentChargeBefore);
        int currentChargeAfterGain = Clamp(currentChargeBefore + Math.Min(chargeGain, chargeSpace), 0, chargeCap);
        int storedChargeAfterGain = Clamp(storedChargeBefore + Math.Max(0, chargeGain - chargeSpace), 0, StoredChargeCap);
        bool overloadRequired = chargeGain > chargeSpace && !overloadActive && !overloadArmed;

        DateTime cooldownUntil = GetDateGlobal("ps_cooldownUntilUtc", DateTime.MinValue);
        bool inCooldown = now < cooldownUntil;
        int cooldownRemaining = inCooldown ? (int)Math.Ceiling((cooldownUntil - now).TotalSeconds) : 0;
        if (!inCooldown)
        {
            cooldownUntil = DateTime.MinValue;
            cooldownRemaining = 0;
        }

        int missCount = GetIntGlobal("ps_missCount", 0);
        bool normalPressureThreshold = !overloadActive && pressureAfterCharge >= NormalMaxPressure;
        bool overloadPressureThreshold = overloadActive && pressureAfterCharge >= OverloadMaxPressure;
        bool pressureDischarge = !inCooldown && !overloadVenting && (normalPressureThreshold || overloadPressureThreshold);
        bool shouldDischarge = pressureDischarge && currentChargeAfterGain > 0;

        int finalIntensity = 0;
        int pressureAfterEvent = pressureAfterCharge;
        int currentChargeAfterEvent = currentChargeAfterGain;
        int storedChargeAfterEvent = storedChargeAfterGain;
        int cooldownSeconds = inCooldown ? GetIntGlobal("ps_cooldownSeconds", 0) : 0;
        string relayMode = "charge";
        string eventMessage = "Pressure event logged";
        pooledCheerMessageTier = 0;
        string tickerMessage = BuildTickerMessage(eventType, viewerNameFromEvent, rawEventBits, eventBits, smallCheerLedgerBefore, smallCheerLedgerAfter, smallCheerLedgerReleasedBits);

        if (inCooldown)
        {
            relayMode = "cooldown";
            eventMessage = "Safety lockout active. Pressure banked";
        }
        else if (pressureDischarge)
        {
            finalIntensity = shouldDischarge ? Clamp(currentChargeAfterGain, 1, chargeCap) : 0;
            pressureAfterEvent = 0;
            int promotedCharge = Math.Min(storedChargeAfterGain, chargeCap);
            currentChargeAfterEvent = promotedCharge;
            storedChargeAfterEvent = Math.Max(0, storedChargeAfterGain - promotedCharge);
            cooldownSeconds = Rng.Next(CooldownMinSeconds, CooldownMaxSeconds + 1);
            cooldownUntil = now.AddSeconds(cooldownSeconds);
            cooldownRemaining = cooldownSeconds;
            missCount = 0;
            relayMode = shouldDischarge ? (overloadActive ? "overload-discharge" : "discharge") : "discharge-empty";
            eventMessage = !shouldDischarge
                ? "Pressure threshold reached with no active current. Pressure vented without PiShock output"
                : overloadActive
                ? "Overload pressure threshold reached. Impulse event authorized"
                : "Pressure threshold reached. Impulse event authorized";
        }
        else if (overloadActive)
        {
            relayMode = "overload";
            eventMessage = "Overload containment charging";
        }
        else if (overloadRequired)
        {
            relayMode = "overload-required";
            eventMessage = "OVERLOAD REQUIRED. Extra current stored for later capacity.";
        }

        if (ShouldUpdateCenterViewer(eventType, rawEventBits, pooledCheerRelease))
            UpdateViewerDisplay(now, eventType, rawEventBits);

        string currentViewerName = pooledCheerRelease ? "Employee Donation Pool" : viewerNameFromEvent;
        if (string.IsNullOrWhiteSpace(currentViewerName))
            currentViewerName = GetStringGlobal("ps_lastViewerName", "");

        string currentViewerImageUrl = pooledCheerRelease ? "" : ResolveViewerImageUrl();
        if (string.IsNullOrWhiteSpace(currentViewerImageUrl) && string.IsNullOrWhiteSpace(currentViewerName))
            currentViewerImageUrl = GetStringGlobal("ps_lastViewerImageUrl", "");

        string cooldownUntilUtc = cooldownUntil == DateTime.MinValue ? "" : cooldownUntil.ToString("o");
        int statusSequence = GetNextStatusSequence();

        CPH.SetGlobalVar("ps_pressureGauge", pressureAfterEvent, true);
        CPH.SetGlobalVar("ps_chargePool", currentChargeAfterEvent, true);
        CPH.SetGlobalVar("ps_currentCharge", currentChargeAfterEvent, true);
        CPH.SetGlobalVar("ps_storedCharge", storedChargeAfterEvent, true);
        CPH.SetGlobalVar("ps_normalChargeCap", NormalChargeCap, true);
        CPH.SetGlobalVar("ps_overloadChargeCap", OverloadChargeCap, true);
        CPH.SetGlobalVar("ps_maxPressureGauge", maxPressure, true);
        CPH.SetGlobalVar("ps_missCount", missCount, true);
        CPH.SetGlobalVar("ps_lastChancePercent", 0, true);
        CPH.SetGlobalVar("ps_lastRoll", 0, true);
        CPH.SetGlobalVar("ps_lastPressureBefore", pressureBefore, true);
        CPH.SetGlobalVar("ps_lastPressureAfter", pressureAfterEvent, true);
        CPH.SetGlobalVar("ps_lastPressureGain", pressureGain, true);
        CPH.SetGlobalVar("ps_lastPressureVented", pressureDischarge ? pressureAfterCharge : 0, true);
        CPH.SetGlobalVar("ps_lastChargeGain", chargeGain, true);
        CPH.SetGlobalVar("ps_lastSmallCheerCurrentRoll", smallCheerCurrentRoll, true);
        CPH.SetGlobalVar("ps_lastSmallCheerCurrentHit", smallCheerCurrentHit, true);
        CPH.SetGlobalVar("ps_smallCheerBitsLedger", smallCheerLedgerAfter, true);
        CPH.SetGlobalVar("ps_lastRawEventBits", rawEventBits, true);
        CPH.SetGlobalVar("ps_lastSmallCheerLedgerBefore", smallCheerLedgerBefore, true);
        CPH.SetGlobalVar("ps_lastSmallCheerLedgerAfter", smallCheerLedgerAfter, true);
        CPH.SetGlobalVar("ps_lastSmallCheerLedgerReleasedBits", smallCheerLedgerReleasedBits, true);
        CPH.SetGlobalVar("ps_lastBaseIntensity", currentChargeAfterGain, true);
        CPH.SetGlobalVar("ps_lastHypeBonus", hypeLevel, true);
        CPH.SetGlobalVar("ps_lastRandomSurge", 0, true);
        CPH.SetGlobalVar("ps_lastFinalIntensity", finalIntensity, true);
        CPH.SetGlobalVar("ps_lastChargeSpent", shouldDischarge ? finalIntensity : 0, true);
        CPH.SetGlobalVar("ps_lastPoolBefore", currentChargeBefore, true);
        CPH.SetGlobalVar("ps_lastPoolAfter", currentChargeAfterEvent, true);
        CPH.SetGlobalVar("ps_lastOverloadUsed", shouldDischarge && overloadActive, true);
        CPH.SetGlobalVar("ps_cooldownSeconds", cooldownSeconds, true);
        CPH.SetGlobalVar("ps_cooldownRemaining", cooldownRemaining, true);
        CPH.SetGlobalVar("ps_cooldownUntilUtc", cooldownUntilUtc, true);
        CPH.SetGlobalVar("ps_overloadArmed", overloadArmed, true);
        CPH.SetGlobalVar("ps_overloadActive", overloadActive, true);
        CPH.SetGlobalVar("ps_overloadUntilUtc", overloadUntilUtc, true);
        CPH.SetGlobalVar("ps_relayMode", relayMode, true);
        CPH.SetGlobalVar("ps_lastEventType", eventType, true);
        CPH.SetGlobalVar("ps_lastEventValueBits", eventBits, true);
        CPH.SetGlobalVar("ps_lastEventMessage", eventMessage, true);
        CPH.SetGlobalVar("ps_lastTickerMessage", tickerMessage, true);
        CPH.SetGlobalVar("ps_lastPooledCheerMessageTier", pooledCheerMessageTier, true);
        CPH.SetGlobalVar("ps_shouldDischarge", shouldDischarge, true);
        CPH.SetGlobalVar("ps_shouldDischargeFlag", shouldDischarge ? 1 : 0, true);
        CPH.SetGlobalVar("ps_shouldDischargeText", shouldDischarge ? "true" : "false", true);
        CPH.SetGlobalVar("ps_statusSequence", statusSequence, true);

        SetPressureArguments(
            shouldDischarge,
            relayMode,
            currentChargeAfterEvent,
            storedChargeAfterEvent,
            pressureAfterEvent,
            maxPressure,
            hypeLevel,
            overloadArmed,
            overloadActive,
            overloadVenting,
            finalIntensity,
            missCount,
            cooldownSeconds,
            cooldownRemaining,
            cooldownUntilUtc,
            overloadUntilUtc,
            currentViewerName,
            currentViewerImageUrl,
            eventType,
            eventBits,
            eventMessage,
            tickerMessage,
            statusSequence
        );

        if (shouldDischarge)
            SetPendingPiShockArgs(finalIntensity, ShockDurationSeconds, "PRESSURE EVENT");
        else
            ClearPendingPiShockArgs();

        PostStatusUpdate(
            pressureAfterEvent,
            maxPressure,
            hypeLevel,
            overloadArmed,
            overloadActive,
            overloadVenting,
            currentChargeAfterEvent,
            storedChargeAfterEvent,
            NormalChargeCap,
            OverloadChargeCap,
            finalIntensity,
            0,
            missCount,
            cooldownRemaining,
            cooldownSeconds,
            cooldownUntilUtc,
            overloadUntilUtc,
            currentViewerName,
            currentViewerImageUrl,
            eventMessage,
            tickerMessage,
            eventType,
            eventBits,
            0,
            0,
            "",
            relayMode,
            statusSequence
        );

        CPH.LogInfo(
            "[AnthroCorp Controller] Pressure Event=" + eventType +
            " Bits=" + eventBits +
            " RawBits=" + rawEventBits +
            " SubCount=" + subEventCount +
            " Pressure=" + pressureBefore + "->" + pressureAfterEvent +
            " Charge=" + currentChargeBefore + "->" + currentChargeAfterEvent +
            " Stored=" + storedChargeBefore + "->" + storedChargeAfterEvent +
            " Discharge=" + shouldDischarge +
            " Mode=" + relayMode
        );

        return true;
    }

    public bool UpdateHypeTrain()
    {
        NormalizeHypeTrainArgs(false);
        int level = Clamp(GetIntArg("level", GetIntArg("hypeTrainLevel", 0)), 0, 10);
        string eventMessage = "Hype Train Level " + level + " detected. Pressure and current routing amplified.";
        int statusSequence = GetNextStatusSequence();

        CPH.SetGlobalVar("ps_hypeTrainLevel", level, true);
        CPH.SetGlobalVar("ps_hypeTrainActive", level > 0, true);
        CPH.SetGlobalVar("ps_lastEventType", "hype", true);
        CPH.SetGlobalVar("ps_lastEventValueBits", 0, true);
        CPH.SetGlobalVar("ps_lastEventMessage", eventMessage, true);
        CPH.SetGlobalVar("ps_statusSequence", statusSequence, true);
        CPH.SetGlobalVar("ps_relayMode", "hype", true);

        CPH.SetArgument("relayMode", "hype");
        CPH.SetArgument("hypeLevel", level);
        CPH.SetArgument("eventType", "hype");
        CPH.SetArgument("eventValueBits", 0);
        CPH.SetArgument("eventMessage", eventMessage);
        CPH.SetArgument("statusSequence", statusSequence);

        PostCurrentStatus(eventMessage, "", "hype", 0, "hype", statusSequence);
        CPH.SendMessage("ANTHRO-CORP CORE PRESSURE RISING: Hype Train Level " + level + " detected. Pressure and current routing amplified.", true);
        return true;
    }

    public bool EndHypeTrain()
    {
        NormalizeHypeTrainArgs(true);
        int level = GetIntGlobal("ps_hypeTrainLevel", 0);
        string eventMessage = "Hype Train ended. Core pressure holding at Level " + level + ". Cooling cycle pending.";
        int statusSequence = GetNextStatusSequence();

        CPH.SetGlobalVar("ps_hypeTrainActive", false, true);
        CPH.SetGlobalVar("ps_hypeTrainLevel", 0, true);
        CPH.SetGlobalVar("ps_lastEventType", "hype-ended", true);
        CPH.SetGlobalVar("ps_lastEventValueBits", 0, true);
        CPH.SetGlobalVar("ps_lastEventMessage", eventMessage, true);
        CPH.SetGlobalVar("ps_statusSequence", statusSequence, true);
        CPH.SetGlobalVar("ps_relayMode", "hype-ended", true);

        CPH.SetArgument("relayMode", "hype-ended");
        CPH.SetArgument("hypeLevel", 0);
        CPH.SetArgument("eventType", "hype-ended");
        CPH.SetArgument("eventValueBits", 0);
        CPH.SetArgument("eventMessage", eventMessage);
        CPH.SetArgument("statusSequence", statusSequence);

        PostCurrentStatus(eventMessage, "", "hype-ended", 0, "hype-ended", statusSequence);
        CPH.SendMessage("ANTHRO-CORP: Hype Train ended. Core pressure holding at Level " + level + ". Cooling cycle pending.", true);
        return true;
    }

    public bool ResetState()
    {
        int statusSequence = GetNextStatusSequence();

        CPH.SetGlobalVar("ps_debug", true, true);
        CPH.SetGlobalVar("ps_chargePool", 0, true);
        CPH.SetGlobalVar("ps_currentCharge", 0, true);
        CPH.SetGlobalVar("ps_storedCharge", 0, true);
        CPH.SetGlobalVar("ps_normalChargeCap", NormalChargeCap, true);
        CPH.SetGlobalVar("ps_overloadChargeCap", OverloadChargeCap, true);
        CPH.SetGlobalVar("ps_pressureGauge", 0, true);
        CPH.SetGlobalVar("ps_maxPressureGauge", NormalMaxPressure, true);
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
        CPH.SetGlobalVar("ps_smallCheerBitsLedger", 0, true);
        CPH.SetGlobalVar("ps_lastRawEventBits", 0, true);
        CPH.SetGlobalVar("ps_lastEventType", "reset", true);
        CPH.SetGlobalVar("ps_lastEventValueBits", 0, true);
        CPH.SetGlobalVar("ps_lastEventMessage", "Containment status reset.", true);
        CPH.SetGlobalVar("ps_lastTickerMessage", "", true);
        CPH.SetGlobalVar("ps_lastViewerName", "", true);
        CPH.SetGlobalVar("ps_lastViewerImageUrl", "", true);
        CPH.SetGlobalVar("ps_lastPoolBefore", 0, true);
        CPH.SetGlobalVar("ps_lastPoolAfter", 0, true);
        CPH.SetGlobalVar("ps_lastBaseIntensity", 0, true);
        CPH.SetGlobalVar("ps_lastHypeBonus", 0, true);
        CPH.SetGlobalVar("ps_lastRandomSurge", 0, true);
        CPH.SetGlobalVar("ps_lastFinalIntensity", 0, true);
        CPH.SetGlobalVar("ps_lastOverloadUsed", false, true);
        CPH.SetGlobalVar("ps_lastChargeSpent", 0, true);
        CPH.SetGlobalVar("ps_shouldDischarge", false, true);
        CPH.SetGlobalVar("ps_shouldDischargeFlag", 0, true);
        CPH.SetGlobalVar("ps_shouldDischargeText", "false", true);
        CPH.SetGlobalVar("ps_relayMode", "reset", true);
        CPH.SetGlobalVar("ps_statusSequence", statusSequence, true);
        ClearPendingPiShockArgs();

        SetPressureArguments(false, "reset", 0, 0, 0, NormalMaxPressure, 0, false, false, false, 0, 0, 0, 0, "", "", "", "", "reset", 0, "Containment status reset.", "", statusSequence);
        PostStatusUpdate(0, NormalMaxPressure, 0, false, false, false, 0, 0, NormalChargeCap, OverloadChargeCap, 0, 0, 0, 0, 0, "", "", "", "", "Containment status reset.", "", "reset", 0, 0, 0, "", "reset", statusSequence);
        CPH.LogInfo("[AnthroCorp Controller] Anthro-Corp containment status reset to zero.");
        return true;
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
        int countdownSeconds = Math.Max(1, GetIntArg("countdownSeconds", DefaultCountdownSeconds));
        DateTime until = DateTime.UtcNow.AddSeconds(countdownSeconds);
        DateTime pendingUntil = until.AddMinutes(PendingVentGraceMinutes);
        int pressure = GetIntGlobal("ps_pressureGauge", 0);
        int current = GetIntGlobal("ps_currentCharge", GetIntGlobal("ps_chargePool", 0));
        int stored = GetIntGlobal("ps_storedCharge", 0);
        int maxPressure = GetIntGlobal("ps_maxPressureGauge", NormalMaxPressure);
        string viewerName = ResolveViewerName();
        if (string.IsNullOrWhiteSpace(viewerName))
            viewerName = "Employee";

        string message = viewerName + " initiated System Vent. System venting in " + countdownSeconds + " seconds.";
        string ticker = "WARNING // " + viewerName + " INITIATED SYSTEM VENT // SYSTEM VENTING IN " + countdownSeconds + " SEC // STAND CLEAR";
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
        CPH.SetArgument("ventTargetPressure", 0);
        CPH.SetArgument("statusSequence", statusSequence);

        PostStatusUpdate(
            pressure,
            maxPressure,
            GetIntGlobal("ps_hypeTrainLevel", 0),
            GetBoolGlobal("ps_overloadArmed", false),
            GetBoolGlobal("ps_overloadActive", false),
            GetBoolGlobal("ps_overloadVenting", false),
            current,
            stored,
            NormalChargeCap,
            OverloadChargeCap,
            GetIntGlobal("ps_lastFinalIntensity", 0),
            GetIntGlobal("ps_lastChancePercent", 0),
            GetIntGlobal("ps_missCount", 0),
            0,
            0,
            "",
            GetStringGlobal("ps_overloadUntilUtc", ""),
            viewerName,
            "",
            message,
            ticker,
            "rift-stabilizer",
            0,
            countdownSeconds,
            countdownSeconds,
            until.ToString("o"),
            "rift-stabilizer",
            statusSequence
        );

        CPH.LogInfo("[AnthroCorp Controller] Stabilizer engaged. Flush countdown=" + countdownSeconds + "s Pressure=" + pressure + " Current=" + current + " Stored=" + stored);
        return true;
    }

    public bool PrepareVentStep()
    {
        return RejectLegacyVentOperation("PrepareVentStep");
    }

    public bool RunManualFlushResult()
    {
        WaitForPendingManualFlushCountdown();

        CPH.SetArgument("ventMode", "manual-flush");
        CPH.SetArgument("ventTargetPressure", 0);

        int pressureBefore = GetIntGlobal("ps_pressureGauge", 0);
        bool overloadActive = GetBoolGlobal("ps_overloadActive", false) || GetBoolGlobal("ps_overloadArmed", false);
        int cap = overloadActive ? OverloadChargeCap : NormalChargeCap;
        int currentBefore = GetIntGlobal("ps_currentCharge", GetIntGlobal("ps_chargePool", 0));
        int storedBefore = GetIntGlobal("ps_storedCharge", 0);
        if (currentBefore > cap)
        {
            int overflow = currentBefore - cap;
            currentBefore = cap;
            storedBefore = Math.Min(StoredChargeCap, storedBefore + overflow);
        }

        int riskChance = Clamp(pressureBefore, 0, 100);
        int roll = riskChance > 0 ? Rng.Next(1, 101) : 0;
        bool shouldDischarge = currentBefore > 0 && (pressureBefore >= 100 || (riskChance > 0 && roll <= riskChance));
        int currentAfter = 0;
        int storedAfter = 0;
        int totalChargeCleared = currentBefore + storedBefore;
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
        CPH.SetGlobalVar("ps_maxPressureGauge", NormalMaxPressure, true);
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
        CPH.SetGlobalVar("ps_lastChargeSpent", totalChargeCleared, true);
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

        PostStatusUpdate(
            0,
            NormalMaxPressure,
            GetIntGlobal("ps_hypeTrainLevel", 0),
            false,
            false,
            false,
            currentAfter,
            storedAfter,
            NormalChargeCap,
            OverloadChargeCap,
            intensity,
            riskChance,
            GetIntGlobal("ps_missCount", 0),
            0,
            0,
            "",
            "",
            "",
            "",
            eventMessage,
            tickerMessage,
            "vent",
            0,
            0,
            0,
            "",
            relayMode,
            statusSequence
        );

        CPH.SetGlobalVar("ps_pendingVentMode", "", true);
        CPH.SetGlobalVar("ps_pendingVentTargetPressure", 0, true);
        CPH.SetGlobalVar("ps_pendingVentUntilUtc", "", true);

        CPH.LogInfo("[AnthroCorp Controller] Manual flush Pressure=" + pressureBefore + "->0 Current=" + currentBefore + "->" + currentAfter + " Stored=" + storedBefore + "->" + storedAfter + " Chance=" + riskChance + " Roll=" + roll + " Discharge=" + shouldDischarge);
        return true;
    }

    private void WaitForPendingManualFlushCountdown()
    {
        DateTime countdownUntil = GetDateGlobal("ps_eventCountdownUntilUtc", DateTime.MinValue);
        if (countdownUntil == DateTime.MinValue)
            return;

        int waitMilliseconds = (int)Math.Ceiling((countdownUntil - DateTime.UtcNow).TotalMilliseconds) + ManualFlushResultBufferMilliseconds;
        if (waitMilliseconds <= 0)
            return;

        waitMilliseconds = Math.Min(waitMilliseconds, 60000);
        CPH.LogInfo("[AnthroCorp Controller] Manual flush result waiting " + waitMilliseconds + "ms for countdown animation handoff.");
        System.Threading.Thread.Sleep(waitMilliseconds);
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
        int statusSequence = GetNextStatusSequence();
        string eventMessage = GetStringGlobal("ps_lastEventMessage", "Status refreshed.");
        string tickerMessage = GetStringGlobal("ps_lastTickerMessage", "");
        string eventType = GetStringGlobal("ps_lastEventType", "status");
        int eventValueBits = GetIntGlobal("ps_lastEventValueBits", 0);
        string mode = GetStringGlobal("ps_relayMode", "status");

        CPH.SetGlobalVar("ps_statusSequence", statusSequence, true);
        CPH.SetArgument("statusSequence", statusSequence);
        CPH.SetArgument("relayMode", mode);
        CPH.SetArgument("mode", mode);

        PostCurrentStatus(eventMessage, tickerMessage, eventType, eventValueBits, mode, statusSequence);
        CPH.LogInfo("[AnthroCorp Controller] Widget status refreshed directly. Mode=" + mode + " Sequence=" + statusSequence);
        return true;
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

    private void PostCurrentStatus(string eventMessage, string tickerMessage, string eventType, int eventValueBits, string mode, int statusSequence)
    {
        int current = GetIntGlobal("ps_currentCharge", GetIntGlobal("ps_chargePool", 0));
        PostStatusUpdate(
            GetIntGlobal("ps_pressureGauge", 0),
            GetIntGlobal("ps_maxPressureGauge", NormalMaxPressure),
            GetIntGlobal("ps_hypeTrainLevel", 0),
            GetBoolGlobal("ps_overloadArmed", false),
            GetBoolGlobal("ps_overloadActive", false),
            GetBoolGlobal("ps_overloadVenting", false),
            current,
            GetIntGlobal("ps_storedCharge", 0),
            GetIntGlobal("ps_normalChargeCap", NormalChargeCap),
            GetIntGlobal("ps_overloadChargeCap", OverloadChargeCap),
            GetIntGlobal("ps_lastFinalIntensity", 0),
            GetIntGlobal("ps_lastChancePercent", 0),
            GetIntGlobal("ps_missCount", 0),
            GetIntGlobal("ps_cooldownRemaining", 0),
            GetIntGlobal("ps_cooldownSeconds", 0),
            GetStringGlobal("ps_cooldownUntilUtc", ""),
            GetStringGlobal("ps_overloadUntilUtc", ""),
            GetStringGlobal("ps_lastViewerName", ""),
            GetStringGlobal("ps_lastViewerImageUrl", ""),
            eventMessage,
            tickerMessage,
            eventType,
            eventValueBits,
            GetIntGlobal("ps_eventCountdownRemaining", 0),
            GetIntGlobal("ps_eventCountdownTotal", 0),
            GetStringGlobal("ps_eventCountdownUntilUtc", ""),
            mode,
            statusSequence
        );
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
        int eventValueBits,
        int eventCountdownRemaining,
        int eventCountdownTotal,
        string eventCountdownUntilUtc,
        string mode,
        int statusSequence)
    {
        string apiBaseUrl = GetStringGlobal("st_apiBaseUrl", "http://127.0.0.1:3055");
        string bearerToken = GetStringGlobal("st_bearerToken", "");

        if (string.IsNullOrWhiteSpace(bearerToken))
        {
            CPH.LogError("[AnthroCorp Controller] Missing Streamer.bot global: st_bearerToken. Skipping direct status POST.");
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
            + "\"overloadRemaining\":" + GetRemainingSeconds(overloadUntilUtc) + ","
            + "\"overloadUntilUtc\":\"" + EscapeJson(overloadUntilUtc) + "\","
            + "\"eventCountdownRemaining\":" + eventCountdownRemaining + ","
            + "\"eventCountdownTotal\":" + eventCountdownTotal + ","
            + "\"eventCountdownUntilUtc\":\"" + EscapeJson(eventCountdownUntilUtc) + "\","
            + "\"currentViewerName\":\"" + EscapeJson(currentViewerName) + "\","
            + "\"currentViewerImageUrl\":\"" + EscapeJson(currentViewerImageUrl) + "\","
            + "\"eventMessage\":\"" + EscapeJson(eventMessage) + "\","
            + "\"tickerMessage\":\"" + EscapeJson(tickerMessage) + "\","
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
                CPH.LogInfo("[AnthroCorp Controller] Direct status POST sent: " + response.StatusCode + " Sequence=" + statusSequence + " Mode=" + mode);
            }
        }
        catch (Exception ex)
        {
            CPH.LogError("[AnthroCorp Controller] Direct status POST failed: " + ex.ToString());
        }
    }

    private void SetPressureArguments(
        bool shouldDischarge,
        string relayMode,
        int currentVoltage,
        int storedVoltage,
        int pressureGauge,
        int maxPressureGauge,
        int hypeLevel,
        bool overloadArmed,
        bool overloadActive,
        bool overloadVenting,
        int finalIntensity,
        int missCount,
        int cooldownSeconds,
        int cooldownRemaining,
        string cooldownUntilUtc,
        string overloadUntilUtc,
        string currentViewerName,
        string currentViewerImageUrl,
        string eventType,
        int eventValueBits,
        string eventMessage,
        string tickerMessage,
        int statusSequence)
    {
        CPH.SetArgument("shouldDischarge", shouldDischarge);
        CPH.SetArgument("shouldDischargeFlag", shouldDischarge ? 1 : 0);
        CPH.SetArgument("shouldDischargeText", shouldDischarge ? "true" : "false");
        CPH.SetArgument("shouldVibrateBeforeShock", shouldDischarge);
        CPH.SetArgument("shouldVibrateBeforeShockFlag", shouldDischarge ? 1 : 0);
        CPH.SetArgument("relayMode", relayMode);
        CPH.SetArgument("mode", relayMode);
        CPH.SetArgument("chargePool", currentVoltage);
        CPH.SetArgument("currentVoltage", currentVoltage);
        CPH.SetArgument("storedVoltage", storedVoltage);
        CPH.SetArgument("normalVoltageCap", NormalChargeCap);
        CPH.SetArgument("overloadVoltageCap", OverloadChargeCap);
        CPH.SetArgument("pressureGauge", pressureGauge);
        CPH.SetArgument("maxPressureGauge", maxPressureGauge);
        CPH.SetArgument("hypeLevel", hypeLevel);
        CPH.SetArgument("overloadArmed", overloadArmed);
        CPH.SetArgument("overloadActive", overloadActive);
        CPH.SetArgument("overloadVenting", overloadVenting);
        CPH.SetArgument("lastIntensity", finalIntensity);
        CPH.SetArgument("chancePercent", 0);
        CPH.SetArgument("missCount", missCount);
        CPH.SetArgument("cooldownTotal", cooldownSeconds);
        CPH.SetArgument("cooldownRemaining", cooldownRemaining);
        CPH.SetArgument("cooldownUntilUtc", cooldownUntilUtc);
        CPH.SetArgument("overloadUntilUtc", overloadUntilUtc);
        CPH.SetArgument("currentViewerName", currentViewerName);
        CPH.SetArgument("currentViewerImageUrl", currentViewerImageUrl);
        CPH.SetArgument("eventType", eventType);
        CPH.SetArgument("eventValueBits", eventValueBits);
        CPH.SetArgument("eventMessage", eventMessage);
        CPH.SetArgument("tickerMessage", tickerMessage);
        CPH.SetArgument("pooledCheerMessageTier", pooledCheerMessageTier);
        CPH.SetArgument("statusSequence", statusSequence);
    }

    private int GetEventBits(string eventType)
    {
        int bits = GetIntArg("bits", -1);
        if (bits < 0) bits = GetIntArg("cheerBits", -1);
        if (bits < 0) bits = GetIntArg("amount", -1);

        if (IsSubEvent(eventType))
            return GiftSubEquivalentBits * GetSubEventCount();

        return Math.Max(0, bits);
    }

    private int CalculatePressureGain(string eventType, int eventBits)
    {
        if (IsSubEvent(eventType))
            return Clamp(20 * GetSubEventCount(), 0, MaximumPressureGain);

        if (eventBits >= 5250) return 150;
        if (eventBits >= 3500) return 100;
        if (eventBits >= 1750) return 50;
        if (eventBits >= 700) return 20;
        if (eventBits >= 350) return 10;
        if (eventBits >= 50) return 3;

        return 0;
    }

    private int CalculateChargeGain(string eventType, int eventBits)
    {
        if (IsSubEvent(eventType))
            return GetSubEventCount() * 2;

        for (int i = 0; i < ChargeTable.Length; i++)
        {
            if (eventBits >= ChargeTable[i].MinBits && eventBits <= ChargeTable[i].MaxBits)
                return ChargeTable[i].ChargeGain;
        }

        return 0;
    }

    private int CalculateHypeChargeBonus(int hypeLevel)
    {
        if (hypeLevel >= 10) return 6;
        if (hypeLevel >= 5) return 4;
        if (hypeLevel >= 1) return 2;
        return 0;
    }

    private bool IsSmallCheerCurrentEligible(string eventType, int eventBits)
    {
        return !IsSubEvent(eventType) && eventBits >= 50 && eventBits < 700;
    }

    private bool IsSmallCheerLedgerEligible(string eventType, int eventBits)
    {
        return !IsSubEvent(eventType) && eventBits > 0 && eventBits < SmallCheerLedgerThresholdBits;
    }

    private bool ShouldUpdateCenterViewer(string eventType, int rawEventBits, bool pooledCheerRelease)
    {
        if (pooledCheerRelease)
            return false;

        return IsSubEvent(eventType) || rawEventBits >= CenterViewerMinimumBits;
    }

    private string BuildTickerMessage(string eventType, string viewerName, int rawEventBits, int effectiveEventBits, int ledgerBefore, int ledgerAfter, int ledgerReleasedBits)
    {
        viewerName = string.IsNullOrWhiteSpace(viewerName) ? "A chatter" : viewerName;

        if (ledgerReleasedBits > 0)
            return PickPooledCheerMessage() + " // Ledger " + ledgerBefore + " + " + rawEventBits + " -> " + ledgerReleasedBits + " bit packet, " + ledgerAfter + " carried forward.";

        if (IsSmallCheerLedgerEligible(eventType, rawEventBits))
            return viewerName + " added " + rawEventBits + " bits to the employee donation pool. Ledger " + ledgerBefore + " -> " + ledgerAfter + " / " + SmallCheerLedgerThresholdBits + ".";

        if (!IsSubEvent(eventType) && rawEventBits > 0)
            return viewerName + " cheered " + rawEventBits + " bits. Pressure event value " + effectiveEventBits + " bits.";

        if (IsSubEvent(eventType))
        {
            int count = GetSubEventCount();
            return viewerName + " contributed " + count + " sub" + (count == 1 ? "" : "s") + " to containment pressure.";
        }

        return "";
    }

    private string PickPooledCheerMessage()
    {
        pooledCheerMessageTier = Rng.Next(1, 101) >= 90 ? 1 : 0;
        return PooledCheerMessages[Rng.Next(0, PooledCheerMessages.Length)];
    }

    private bool IsSubEvent(string eventType)
    {
        string normalized = (eventType ?? "").ToLowerInvariant();
        return normalized.Contains("sub") ||
            GetBoolArg("isSub", false) ||
            GetBoolArg("isGiftSub", false);
    }

    private int GetSubEventCount()
    {
        int count = GetFirstPositiveIntArg(
            "giftSubCount",
            "giftSubAmount",
            "giftSubTotal",
            "giftedSubCount",
            "giftedSubs",
            "subGiftCount",
            "subGiftAmount",
            "subGiftTotal",
            "giftCount",
            "giftAmount",
            "gifts",
            "subBombCount",
            "total",
            "totalGifts",
            "totalGiftSubs",
            "totalSubsGifted",
            "totalSubs",
            "recipientCount",
            "count",
            "amount",
            "subCount",
            "quantity"
        );

        return Math.Max(1, count);
    }

    private void UpdateViewerDisplay(DateTime now, string eventType, int eventBits)
    {
        string viewerName = ResolveViewerName();
        if (string.IsNullOrWhiteSpace(viewerName))
            return;

        string viewerKey = NormalizeKey(viewerName);
        string cooldownKey = "ps_viewerDisplayCooldown_" + viewerKey;
        DateTime lastShownAt = GetDateGlobal(cooldownKey, DateTime.MinValue);

        if (lastShownAt != DateTime.MinValue && (now - lastShownAt).TotalSeconds < ViewerDisplayCooldownSeconds)
            return;

        string imageUrl = ResolveViewerImageUrl();

        CPH.SetGlobalVar("ps_lastViewerName", viewerName, true);
        CPH.SetGlobalVar("ps_lastViewerImageUrl", imageUrl, true);
        CPH.SetGlobalVar("ps_lastViewerShownAtUtc", now.ToString("o"), true);
        CPH.SetGlobalVar("ps_lastViewerEventType", eventType, true);
        CPH.SetGlobalVar("ps_lastViewerEventValueBits", eventBits, true);
        CPH.SetGlobalVar(cooldownKey, now.ToString("o"), true);
    }

    private string ResolveViewerName()
    {
        string viewerName = GetStringArg("viewerName", "");
        if (string.IsNullOrWhiteSpace(viewerName))
            viewerName = GetStringArg("displayName", GetStringArg("userName", GetStringArg("user", "")));

        return viewerName;
    }

    private string ResolveViewerImageUrl()
    {
        string imageUrl = GetStringArg("viewerImageUrl", "");
        if (string.IsNullOrWhiteSpace(imageUrl))
            imageUrl = GetStringArg("profileImageUrl", GetStringArg("profileImageURL", GetStringArg("userProfileImageUrl", "")));
        if (string.IsNullOrWhiteSpace(imageUrl))
            imageUrl = GetStringArg("targetUserProfileImageUrl", GetStringArg("userProfileImage", GetStringArg("profileImage", GetStringArg("avatar", ""))));

        return imageUrl;
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

    private DateTime GetDateGlobal(string name, DateTime fallback)
    {
        try
        {
            string value = CPH.GetGlobalVar<string>(name, true);
            DateTime parsed;
            return DateTime.TryParse(value, out parsed) ? parsed.ToUniversalTime() : fallback;
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

    private int Clamp(int value, int min, int max)
    {
        return Math.Min(Math.Max(value, min), max);
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

    private class ChargeTier
    {
        public int MinBits { get; private set; }
        public int MaxBits { get; private set; }
        public int ChargeGain { get; private set; }

        public ChargeTier(int minBits, int maxBits, int chargeGain)
        {
            MinBits = minBits;
            MaxBits = maxBits;
            ChargeGain = chargeGain;
        }
    }
}
