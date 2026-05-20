using System;
using System.IO;
using System.Net;
using System.Text;

public class CPHInline
{
    private static readonly Random Rng = new Random();
    private int pooledCheerMessageTier = 0;

    // ---------------------------------------------------------------------
    // ADJUSTMENTS
    // ---------------------------------------------------------------------
    private const int NormalMaxPressure = 100;
    private const int OverloadMaxPressure = 150;
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
        "A suspicious envelope contained 50 bits.",
        "Chat pooled enough bits for a pressure bump.",
        "Maintenance swept 50 bits from under the console.",
        "Donation pool threshold reached.",
        "The couch cushions have yielded tribute.",
        "Employee morale fund released 50 bits.",
        "Bits from multiple departments were consolidated.",
        "Chat assembled a 50 bit bundle.",
        "Containment petty cash approved a small boost.",
        "Found bits were logged as pressure support.",
        "The intern counted the loose bits correctly.",
        "Chat passed the collection hat around.",
        "A tiny pile of bits became operational.",
        "Lost-and-found released 50 bits.",
        "Breakroom tip jar reached trigger value.",
        "Micro-cheers combined into one pressure packet.",
        "The bit ledger crossed its minimum threshold.",
        "Chat scraped together enough bits.",
        "A small anonymous pool entered the system.",
        "Relay accounting accepted the tiny bit stack.",
        "Pocket change was converted into pressure.",
        "The vending machine paid its dues.",
        "Five tens, ten fives, or fifty ones. Accounting accepts it.",
        "Small cheer ledger discharged one packet.",
        "Bits from the floor grates were recovered.",
        "Chat bundled the small stuff into something useful.",
        "The collection tray clicked over to 50 bits.",
        "A minor funding event has been approved.",
        "Containment received a compact donation packet.",
        "The budget committee blinked and approved 50 bits.",
        "Someone labeled this envelope 'probably safe'.",
        "The pressure fund found spare change.",
        "Tiny cheers formed a committee.",
        "A small-bit coalition has entered the chat.",
        "The relay accepted a pooled cheer packet.",
        "Office chair archaeology recovered 50 bits.",
        "Chat's loose bits passed inspection.",
        "The ledger coughed up a usable packet.",
        "Pressure support arrived in small denominations.",
        "A group contribution reached minimum viable chaos.",
        "The bit jar made a satisfying clink.",
        "Pooled bits were notarized by Anthro-Corp accounting.",
        "A rare golden paperclip was exchanged for 50 bits.",
        "Containment lottery ticket paid out exactly 50 bits."
    };

    public bool Execute()
    {
        DateTime now = DateTime.UtcNow;

        string eventType = GetStringArg("eventType", "cheer");
        int subEventCount = IsSubEvent(eventType) ? GetSubEventCount() : 0;
        int eventBits = GetEventBits(eventType);
        int rawEventBits = eventBits;
        string viewerNameFromEvent = ResolveViewerName();
        int smallCheerLedgerBefore = GetInt("ps_smallCheerBitsLedger", 0);
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

        int hypeLevel = GetInt("ps_hypeTrainLevel", 0);
        bool hypeActive = GetBool("ps_hypeTrainActive", hypeLevel > 0);
        if (!hypeActive)
            hypeLevel = 0;

        bool overloadActive = GetBool("ps_overloadActive", false);
        bool overloadVenting = GetBool("ps_overloadVenting", false);
        bool overloadArmed = GetBool("ps_overloadArmed", false);
        DateTime overloadUntil = GetDate("ps_overloadUntilUtc", DateTime.MinValue);
        string overloadUntilUtc = GetString("ps_overloadUntilUtc", "");
        bool overloadTimerExpired = overloadActive &&
            overloadUntil != DateTime.MinValue &&
            now >= overloadUntil;
        bool overloadExpiredIntoNormal = overloadTimerExpired;
        if (overloadExpiredIntoNormal)
        {
            overloadActive = false;
            overloadArmed = false;
            overloadUntilUtc = "";
        }

        int maxPressure = overloadActive ? OverloadMaxPressure : NormalMaxPressure;
        int pressureBefore = GetInt("ps_pressureGauge", 0);
        int pressureGain = CalculatePressureGain(eventType, eventBits);
        if (hypeLevel > 0 && pressureGain > 0)
            pressureGain = Clamp(pressureGain + (hypeLevel * HypePressureBonusPerLevel), 0, MaximumPressureGain);

        int pressureAfterCharge = Clamp(pressureBefore + pressureGain, 0, maxPressure);
        int chargeCap = overloadActive || overloadArmed ? OverloadChargeCap : NormalChargeCap;
        int currentChargeBefore = GetInt("ps_currentCharge", GetInt("ps_chargePool", 0));
        int storedChargeBefore = GetInt("ps_storedCharge", 0);
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

        DateTime cooldownUntil = GetDate("ps_cooldownUntilUtc", DateTime.MinValue);
        bool inCooldown = now < cooldownUntil;
        int cooldownRemaining = inCooldown ? (int)Math.Ceiling((cooldownUntil - now).TotalSeconds) : 0;
        if (!inCooldown && cooldownUntil != DateTime.MinValue)
        {
            cooldownUntil = DateTime.MinValue;
            inCooldown = false;
            cooldownRemaining = 0;
        }

        int chancePercent = 0;

        int missCount = GetInt("ps_missCount", 0);
        bool normalPressureThreshold = !overloadActive && pressureAfterCharge >= NormalMaxPressure;
        bool overloadPressureThreshold = overloadActive && pressureAfterCharge >= OverloadMaxPressure;
        bool pressureGuaranteed = !inCooldown && !overloadVenting && (normalPressureThreshold || overloadPressureThreshold);
        int roll = 0;
        bool pressureDischarge = pressureGuaranteed;
        bool shouldDischarge = pressureDischarge && currentChargeAfterGain > 0;
        bool shouldStartOverloadVent = false;

        int finalIntensity = 0;
        int pressureAfterEvent = pressureAfterCharge;
        int currentChargeAfterEvent = currentChargeAfterGain;
        int storedChargeAfterEvent = storedChargeAfterGain;
        int cooldownSeconds = inCooldown ? GetInt("ps_cooldownSeconds", 0) : 0;
        string relayMode = "charge";
        string eventMessage = "Pressure event logged";
        pooledCheerMessageTier = 0;
        string tickerMessage = BuildTickerMessage(eventType, viewerNameFromEvent, rawEventBits, eventBits, smallCheerLedgerBefore, smallCheerLedgerAfter, smallCheerLedgerReleasedBits);

        if (overloadVenting)
        {
            relayMode = "venting";
            eventMessage = "Venting sequence already in progress";
        }
        else if (inCooldown)
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
            relayMode = shouldDischarge
                ? (overloadActive ? "overload-discharge" : "discharge")
                : "discharge-empty";
            eventMessage = !shouldDischarge
                ? "Pressure threshold reached with no active current. Pressure vented without PiShock output"
                : overloadActive
                ? "Overload pressure threshold reached. Impulse event authorized"
                : "Pressure threshold reached. Impulse event authorized";
        }
        else if (overloadActive)
        {
            shouldStartOverloadVent = overloadTimerExpired;
            if (shouldStartOverloadVent)
            {
                overloadVenting = true;
                cooldownUntil = DateTime.MinValue;
                cooldownRemaining = 0;
                relayMode = "venting";
                eventMessage = overloadTimerExpired
                    ? "Overload timer expired. Venting sequence requested"
                    : "Overload venting sequence requested";
            }
            else
            {
                relayMode = "overload";
                eventMessage = "Overload containment charging";
            }
        }
        else if (overloadRequired)
        {
            relayMode = "overload-required";
            eventMessage = "OVERLOAD REQUIRED. Extra current stored for later capacity.";
        }

        if (ShouldUpdateCenterViewer(eventType, rawEventBits, pooledCheerRelease))
            UpdateViewerDisplay(now, eventType, rawEventBits);

        string currentViewerName = pooledCheerRelease
            ? "Employee Donation Pool"
            : viewerNameFromEvent;
        if (string.IsNullOrWhiteSpace(currentViewerName))
            currentViewerName = GetString("ps_lastViewerName", "");

        string currentViewerImageUrl = pooledCheerRelease
            ? ""
            : ResolveViewerImageUrl();
        if (string.IsNullOrWhiteSpace(currentViewerImageUrl) && string.IsNullOrWhiteSpace(currentViewerName))
            currentViewerImageUrl = GetString("ps_lastViewerImageUrl", "");

        if (pooledCheerRelease)
            currentViewerImageUrl = "";

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
        CPH.SetGlobalVar("ps_lastChancePercent", chancePercent, true);
        CPH.SetGlobalVar("ps_lastRoll", roll, true);
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
        CPH.SetGlobalVar("ps_overloadVenting", overloadVenting, true);
        CPH.SetGlobalVar("ps_overloadVentRequested", shouldStartOverloadVent, true);
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
        CPH.SetGlobalVar("ps_shouldStartOverloadVent", shouldStartOverloadVent, true);
        CPH.SetGlobalVar("ps_shouldStartOverloadVentFlag", shouldStartOverloadVent ? 1 : 0, true);
        CPH.SetGlobalVar("ps_statusSequence", statusSequence, true);

        CPH.SetArgument("shouldDischarge", shouldDischarge);
        CPH.SetArgument("shouldDischargeFlag", shouldDischarge ? 1 : 0);
        CPH.SetArgument("shouldDischargeText", shouldDischarge ? "true" : "false");
        CPH.SetArgument("shouldVibrateBeforeShock", shouldDischarge);
        CPH.SetArgument("shouldVibrateBeforeShockFlag", shouldDischarge ? 1 : 0);
        CPH.SetArgument("shouldStartOverloadVent", shouldStartOverloadVent);
        CPH.SetArgument("shouldStartOverloadVentFlag", shouldStartOverloadVent ? 1 : 0);
        CPH.SetArgument("relayMode", relayMode);
        CPH.SetArgument("mode", relayMode);
        CPH.SetArgument("chargePool", currentChargeAfterEvent);
        CPH.SetArgument("currentVoltage", currentChargeAfterEvent);
        CPH.SetArgument("storedVoltage", storedChargeAfterEvent);
        CPH.SetArgument("normalVoltageCap", NormalChargeCap);
        CPH.SetArgument("overloadVoltageCap", OverloadChargeCap);
        CPH.SetArgument("pressureGauge", pressureAfterEvent);
        CPH.SetArgument("maxPressureGauge", maxPressure);
        CPH.SetArgument("hypeLevel", hypeLevel);
        CPH.SetArgument("overloadArmed", overloadArmed);
        CPH.SetArgument("overloadActive", overloadActive);
        CPH.SetArgument("overloadVenting", overloadVenting);
        CPH.SetArgument("lastIntensity", finalIntensity);
        CPH.SetArgument("chancePercent", chancePercent);
        CPH.SetArgument("missCount", missCount);
        CPH.SetArgument("cooldownTotal", cooldownSeconds);
        CPH.SetArgument("cooldownRemaining", cooldownRemaining);
        CPH.SetArgument("cooldownUntilUtc", cooldownUntilUtc);
        CPH.SetArgument("overloadUntilUtc", overloadUntilUtc);
        CPH.SetArgument("currentViewerName", currentViewerName);
        CPH.SetArgument("currentViewerImageUrl", currentViewerImageUrl);
        CPH.SetArgument("eventType", eventType);
        CPH.SetArgument("eventValueBits", eventBits);
        CPH.SetArgument("eventMessage", eventMessage);
        CPH.SetArgument("tickerMessage", tickerMessage);
        CPH.SetArgument("pooledCheerMessageTier", pooledCheerMessageTier);
        CPH.SetArgument("statusSequence", statusSequence);

        if (shouldDischarge)
        {
            SetPendingPiShockArgs(finalIntensity, ShockDurationSeconds, "PRESSURE EVENT");
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
            CPH.SetArgument("intensity", finalIntensity);
            CPH.SetArgument("duration", ShockDurationSeconds);
            CPH.SetArgument("op", 0);
            CPH.SetArgument("mode", 0);
            CPH.SetArgument("shocker", 0);
            CPH.SetArgument("log", "PRESSURE EVENT");
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
            chancePercent,
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
            relayMode,
            statusSequence
        );

        CPH.LogInfo(
            "[PiShock Pressure] Event=" + eventType +
            " Bits=" + eventBits +
            " RawBits=" + rawEventBits +
            " SubCount=" + subEventCount +
            " SmallCheerLedger=" + smallCheerLedgerBefore + "->" + smallCheerLedgerAfter +
            " SmallCheerLedgerReleased=" + smallCheerLedgerReleasedBits +
            " Pressure=" + pressureBefore + "->" + pressureAfterEvent +
            " Charge=" + currentChargeBefore + "->" + currentChargeAfterEvent +
            " Stored=" + storedChargeBefore + "->" + storedChargeAfterEvent +
            " SmallCheerCurrentRoll=" + smallCheerCurrentRoll +
            " SmallCheerCurrentHit=" + smallCheerCurrentHit +
            " Chance=" + chancePercent +
            " Roll=" + roll +
            " Misses=" + missCount +
            " PressureGuaranteed=" + pressureGuaranteed +
            " Discharge=" + shouldDischarge +
            " DischargeFlag=" + (shouldDischarge ? 1 : 0) +
            " Cooldown=" + inCooldown +
            " CooldownRemaining=" + cooldownRemaining +
            " OverloadExpiredIntoNormal=" + overloadExpiredIntoNormal +
            " RelayMode=" + relayMode
        );

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
        int eventValueBits,
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
            + "\"cooldownRemaining\":" + cooldownRemaining + ","
            + "\"cooldownTotal\":" + cooldownTotal + ","
            + "\"cooldownUntilUtc\":\"" + EscapeJson(cooldownUntilUtc) + "\","
            + "\"overloadRemaining\":0,"
            + "\"overloadUntilUtc\":\"" + EscapeJson(overloadUntilUtc) + "\","
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
                CPH.LogInfo("[PiShock Pressure] Direct status POST sent: " + response.StatusCode + " Sequence=" + statusSequence);
            }
        }
        catch (Exception ex)
        {
            CPH.LogError("[PiShock Pressure] Direct status POST failed: " + ex.ToString());
        }
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

    private string BuildTickerMessage(
        string eventType,
        string viewerName,
        int rawEventBits,
        int effectiveEventBits,
        int ledgerBefore,
        int ledgerAfter,
        int ledgerReleasedBits)
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
        int roll = Rng.Next(1, 101);
        pooledCheerMessageTier = roll >= 98 ? 2 : roll >= 90 ? 1 : 0;
        int start = pooledCheerMessageTier == 2 ? 46 : pooledCheerMessageTier == 1 ? 36 : 0;
        int endExclusive = pooledCheerMessageTier == 2 ? PooledCheerMessages.Length : pooledCheerMessageTier == 1 ? 46 : 36;
        return PooledCheerMessages[Rng.Next(start, endExclusive)];
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
            "totalGiftSubs",
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
        DateTime lastShownAt = GetDate(cooldownKey, DateTime.MinValue);

        if (lastShownAt != DateTime.MinValue &&
            (now - lastShownAt).TotalSeconds < ViewerDisplayCooldownSeconds)
        {
            return;
        }

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
        if (string.IsNullOrWhiteSpace(imageUrl))
            imageUrl = LookupTwitchProfileImageUrl();

        return imageUrl;
    }

    private string LookupTwitchProfileImageUrl()
    {
        string userLogin = ResolveViewerLogin();
        if (string.IsNullOrWhiteSpace(userLogin))
            return "";

        try
        {
            var userInfo = CPH.TwitchGetExtendedUserInfoByLogin(userLogin);
            return userInfo == null ? "" : (userInfo.ProfileImageUrl ?? "");
        }
        catch (Exception ex)
        {
            CPH.LogInfo("[PiShock Pressure] Twitch profile image lookup skipped for " + userLogin + ": " + ex.Message);
            return "";
        }
    }

    private string ResolveViewerLogin()
    {
        string userLogin = GetStringArg("userName", "");
        if (string.IsNullOrWhiteSpace(userLogin))
            userLogin = GetStringArg("userLogin", GetStringArg("login", GetStringArg("targetUserName", "")));
        if (string.IsNullOrWhiteSpace(userLogin))
            userLogin = GetStringArg("displayName", GetStringArg("user", ""));

        return userLogin;
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

    private DateTime GetDate(string name, DateTime fallback)
    {
        try
        {
            string value = CPH.GetGlobalVar<string>(name, true);
            DateTime parsed;
            return DateTime.TryParse(value, out parsed) ? parsed.ToUniversalTime() : fallback;
        }
        catch { return fallback; }
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

        return string.IsNullOrWhiteSpace(output) ? "unknown" : output;
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
