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
    private const int NormalMaxPressure = 100;
    private const int OverloadMaxPressure = 150;
    private const int NormalChargeCap = 10;
    private const int OverloadChargeCap = 15;
    private const int StoredChargeCap = 99;
    private const int BitsPerPressurePoint = 10;
    private const int MaximumPressureGain = 150;
    private const int GiftSubEquivalentBits = 700;
    private const int HypePressureBonusPerLevel = 5;
    private const int CooldownMinSeconds = 10;
    private const int CooldownMaxSeconds = 30;
    private const int ViewerDisplayCooldownSeconds = 10;
    private const int ShockDurationSeconds = 1;

    private static readonly ChargeTier[] ChargeTable = new ChargeTier[]
    {
        new ChargeTier(1, 99, 0),
        new ChargeTier(100, 499, 0),
        new ChargeTier(500, 999, 1),
        new ChargeTier(1000, int.MaxValue, 2)
    };

    public bool Execute()
    {
        DateTime now = DateTime.UtcNow;

        string eventType = GetStringArg("eventType", "cheer");
        int eventBits = GetEventBits(eventType);
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
        int pressureGain = CalculatePressureGain(eventBits);
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

        int chargeGain = CalculateChargeGain(eventBits);
        if (hypeLevel > 0 && chargeGain > 0)
            chargeGain += Math.Min(2, hypeLevel / 5);

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

        UpdateViewerDisplay(now, eventType, eventBits);
        string currentViewerName = ResolveViewerName();
        if (string.IsNullOrWhiteSpace(currentViewerName))
            currentViewerName = GetString("ps_lastViewerName", "");

        string currentViewerImageUrl = ResolveViewerImageUrl();
        if (string.IsNullOrWhiteSpace(currentViewerImageUrl))
            currentViewerImageUrl = GetString("ps_lastViewerImageUrl", "");

        string cooldownUntilUtc = cooldownUntil == DateTime.MinValue ? "" : cooldownUntil.ToString("o");
        int statusSequence = GetInt("ps_statusSequence", 0) + 1;

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
        CPH.SetGlobalVar("ps_statusSequence", statusSequence, true);

        CPH.SetArgument("shouldDischarge", shouldDischarge);
        CPH.SetArgument("shouldStartOverloadVent", shouldStartOverloadVent);
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
        CPH.SetArgument("statusSequence", statusSequence);

        if (shouldDischarge)
        {
            CPH.SetArgument("intensity", finalIntensity);
            CPH.SetArgument("duration", ShockDurationSeconds);
            CPH.SetArgument("op", 0);
            CPH.SetArgument("mode", 0);
            CPH.SetArgument("shocker", 0);
            CPH.SetArgument("log", "PRESSURE EVENT");
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
            eventType,
            eventBits,
            relayMode,
            statusSequence
        );

        CPH.LogInfo(
            "[PiShock Pressure] Event=" + eventType +
            " Bits=" + eventBits +
            " Pressure=" + pressureBefore + "->" + pressureAfterEvent +
            " Charge=" + currentChargeBefore + "->" + currentChargeAfterEvent +
            " Stored=" + storedChargeBefore + "->" + storedChargeAfterEvent +
            " Chance=" + chancePercent +
            " Roll=" + roll +
            " Misses=" + missCount +
            " PressureGuaranteed=" + pressureGuaranteed +
            " Discharge=" + shouldDischarge +
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

        string normalized = (eventType ?? "").ToLowerInvariant();
        bool isSubEvent = normalized.Contains("sub") ||
            GetBoolArg("isSub", false) ||
            GetBoolArg("isGiftSub", false);

        if (isSubEvent)
        {
            int count = Math.Max(1, GetIntArg("giftSubCount", GetIntArg("subCount", 1)));
            return GiftSubEquivalentBits * count;
        }

        return Math.Max(0, bits);
    }

    private int CalculatePressureGain(int eventBits)
    {
        if (eventBits <= 0) return 0;

        int gain = eventBits / BitsPerPressurePoint;
        return Clamp(gain, 0, MaximumPressureGain);
    }

    private int CalculateChargeGain(int eventBits)
    {
        for (int i = 0; i < ChargeTable.Length; i++)
        {
            if (eventBits >= ChargeTable[i].MinBits && eventBits <= ChargeTable[i].MaxBits)
                return ChargeTable[i].ChargeGain;
        }

        return 0;
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

        return imageUrl;
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
