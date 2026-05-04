using System;

public class CPHInline
{
    private static readonly Random Rng = new Random();

    // ---------------------------------------------------------------------
    // ADJUSTMENTS
    // ---------------------------------------------------------------------
    private const int NormalMaxPressure = 100;
    private const int OverloadMaxPressure = 150;
    private const int SafePressure = 30;
    private const int PressurePer100Bits = 5;
    private const int MinimumPressureGain = 5;
    private const int MaximumPressureGain = 50;
    private const int PressureVentPerShock = 10;
    private const int GiftSubEquivalentBits = 700;
    private const int PityMissLimit = 5;
    private const int HypeChancePerLevel = 5;
    private const int CooldownMinSeconds = 30;
    private const int CooldownMaxSeconds = 90;
    private const int ViewerDisplayCooldownSeconds = 10;
    private const int ShockDurationSeconds = 1;

    private static readonly ChanceTier[] ChanceTable = new ChanceTier[]
    {
        new ChanceTier(1, 99, 0),
        new ChanceTier(100, 299, 10),
        new ChanceTier(300, 499, 15),
        new ChanceTier(500, 699, 20),
        new ChanceTier(700, 999, 25),
        new ChanceTier(1000, 1499, 35),
        new ChanceTier(1500, int.MaxValue, 50)
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

        int maxPressure = overloadActive ? OverloadMaxPressure : NormalMaxPressure;
        int pressureBefore = GetInt("ps_pressureGauge", GetInt("ps_chargePool", 0));
        int pressureGain = CalculatePressureGain(eventBits);
        int pressureAfterCharge = Clamp(pressureBefore + pressureGain, 0, maxPressure);

        DateTime cooldownUntil = GetDate("ps_cooldownUntilUtc", DateTime.MinValue);
        bool inCooldown = now < cooldownUntil;
        int cooldownRemaining = inCooldown ? (int)Math.Ceiling((cooldownUntil - now).TotalSeconds) : 0;

        int baseChance = GetBaseChance(eventBits);
        int hypeBonus = Clamp(hypeLevel * HypeChancePerLevel, 0, 100);
        int chancePercent = Clamp(baseChance + hypeBonus, 0, 100);

        int missCount = GetInt("ps_missCount", 0);
        bool eligibleForRoll = eventBits >= 100 && !inCooldown && !overloadActive && !overloadVenting;
        bool pityGuaranteed = eligibleForRoll && missCount >= PityMissLimit;
        int roll = eligibleForRoll ? Rng.Next(1, 101) : 0;
        bool shouldDischarge = eligibleForRoll && (pityGuaranteed || roll <= chancePercent);

        int finalIntensity = 0;
        int pressureAfterEvent = pressureAfterCharge;
        int cooldownSeconds = 0;
        string relayMode = "charge";
        string eventMessage = "Pressure event logged";

        if (overloadVenting)
        {
            relayMode = "venting";
            eventMessage = "Venting sequence already in progress";
        }
        else if (overloadActive)
        {
            relayMode = "overload";
            eventMessage = "Overload containment charging";
        }
        else if (inCooldown)
        {
            relayMode = "cooldown";
            eventMessage = "Safety lockout active. Pressure banked";
        }
        else if (shouldDischarge)
        {
            finalIntensity = PressureToIntensity(pressureAfterCharge);
            pressureAfterEvent = Math.Max(0, pressureAfterCharge - PressureVentPerShock);
            cooldownSeconds = Rng.Next(CooldownMinSeconds, CooldownMaxSeconds + 1);
            cooldownUntil = now.AddSeconds(cooldownSeconds);
            cooldownRemaining = cooldownSeconds;
            missCount = 0;
            relayMode = "discharge";
            eventMessage = pityGuaranteed ? "Pity threshold reached. Impulse event authorized" : "Impulse event authorized";
        }
        else if (eligibleForRoll)
        {
            missCount = Math.Min(PityMissLimit, missCount + 1);
            relayMode = "charge";
            eventMessage = "Random gate denied. Pressure retained";
        }

        UpdateViewerDisplay(now, eventType, eventBits);

        CPH.SetGlobalVar("ps_pressureGauge", pressureAfterEvent, true);
        CPH.SetGlobalVar("ps_chargePool", pressureAfterEvent, true);
        CPH.SetGlobalVar("ps_maxPressureGauge", maxPressure, true);
        CPH.SetGlobalVar("ps_missCount", missCount, true);
        CPH.SetGlobalVar("ps_lastChancePercent", chancePercent, true);
        CPH.SetGlobalVar("ps_lastRoll", roll, true);
        CPH.SetGlobalVar("ps_lastPressureBefore", pressureBefore, true);
        CPH.SetGlobalVar("ps_lastPressureAfter", pressureAfterEvent, true);
        CPH.SetGlobalVar("ps_lastPressureGain", pressureGain, true);
        CPH.SetGlobalVar("ps_lastFinalIntensity", finalIntensity, true);
        CPH.SetGlobalVar("ps_lastChargeSpent", shouldDischarge ? PressureVentPerShock : 0, true);
        CPH.SetGlobalVar("ps_lastPoolBefore", pressureBefore, true);
        CPH.SetGlobalVar("ps_lastPoolAfter", pressureAfterEvent, true);
        CPH.SetGlobalVar("ps_lastOverloadUsed", false, true);
        CPH.SetGlobalVar("ps_cooldownSeconds", cooldownSeconds, true);
        CPH.SetGlobalVar("ps_cooldownRemaining", cooldownRemaining, true);
        CPH.SetGlobalVar("ps_cooldownUntilUtc", cooldownUntil == DateTime.MinValue ? "" : cooldownUntil.ToString("o"), true);
        CPH.SetGlobalVar("ps_relayMode", relayMode, true);
        CPH.SetGlobalVar("ps_lastEventType", eventType, true);
        CPH.SetGlobalVar("ps_lastEventValueBits", eventBits, true);
        CPH.SetGlobalVar("ps_lastEventMessage", eventMessage, true);

        CPH.SetArgument("shouldDischarge", shouldDischarge);
        CPH.SetArgument("relayMode", relayMode);
        CPH.SetArgument("pressureGauge", pressureAfterEvent);
        CPH.SetArgument("maxPressureGauge", maxPressure);
        CPH.SetArgument("chancePercent", chancePercent);
        CPH.SetArgument("missCount", missCount);
        CPH.SetArgument("cooldownRemaining", cooldownRemaining);
        CPH.SetArgument("eventMessage", eventMessage);

        if (shouldDischarge)
        {
            CPH.SetArgument("intensity", finalIntensity);
            CPH.SetArgument("duration", ShockDurationSeconds);
            CPH.SetArgument("op", 0);
            CPH.SetArgument("mode", 0);
            CPH.SetArgument("log", "PRESSURE EVENT");
        }

        CPH.LogInfo(
            "[PiShock Pressure] Event=" + eventType +
            " Bits=" + eventBits +
            " Pressure=" + pressureBefore + "->" + pressureAfterEvent +
            " Chance=" + chancePercent +
            " Roll=" + roll +
            " Misses=" + missCount +
            " Discharge=" + shouldDischarge
        );

        return true;
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

        int gain = (int)Math.Ceiling(eventBits / 100.0) * PressurePer100Bits;
        return Clamp(gain, MinimumPressureGain, MaximumPressureGain);
    }

    private int GetBaseChance(int eventBits)
    {
        for (int i = 0; i < ChanceTable.Length; i++)
        {
            if (eventBits >= ChanceTable[i].MinBits && eventBits <= ChanceTable[i].MaxBits)
                return ChanceTable[i].ChancePercent;
        }

        return 0;
    }

    private int PressureToIntensity(int pressure)
    {
        return Clamp((int)Math.Ceiling(pressure / 10.0), 1, 15);
    }

    private void UpdateViewerDisplay(DateTime now, string eventType, int eventBits)
    {
        string viewerName = GetStringArg("viewerName", "");
        if (string.IsNullOrWhiteSpace(viewerName))
            viewerName = GetStringArg("displayName", GetStringArg("userName", ""));

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

        string imageUrl = GetStringArg("viewerImageUrl", "");
        if (string.IsNullOrWhiteSpace(imageUrl))
            imageUrl = GetStringArg("profileImageUrl", GetStringArg("userProfileImageUrl", ""));

        CPH.SetGlobalVar("ps_lastViewerName", viewerName, true);
        CPH.SetGlobalVar("ps_lastViewerImageUrl", imageUrl, true);
        CPH.SetGlobalVar("ps_lastViewerShownAtUtc", now.ToString("o"), true);
        CPH.SetGlobalVar("ps_lastViewerEventType", eventType, true);
        CPH.SetGlobalVar("ps_lastViewerEventValueBits", eventBits, true);
        CPH.SetGlobalVar(cooldownKey, now.ToString("o"), true);
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

    private class ChanceTier
    {
        public int MinBits { get; private set; }
        public int MaxBits { get; private set; }
        public int ChancePercent { get; private set; }

        public ChanceTier(int minBits, int maxBits, int chancePercent)
        {
            MinBits = minBits;
            MaxBits = maxBits;
            ChancePercent = chancePercent;
        }
    }
}
