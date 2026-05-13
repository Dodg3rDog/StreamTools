using System;

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
        CPH.SetGlobalVar("ps_lastChancePercent", 0, true);
        CPH.SetGlobalVar("ps_lastRoll", 0, true);
        CPH.SetGlobalVar("ps_lastPressureBefore", 0, true);
        CPH.SetGlobalVar("ps_lastPressureAfter", 0, true);
        CPH.SetGlobalVar("ps_lastPressureGain", 0, true);
        CPH.SetGlobalVar("ps_lastPressureVented", 0, true);
        CPH.SetGlobalVar("ps_lastChargeGain", 0, true);
        CPH.SetGlobalVar("ps_lastEventType", "reset", true);
        CPH.SetGlobalVar("ps_lastEventValueBits", 0, true);
        CPH.SetGlobalVar("ps_lastEventMessage", "Containment status reset.", true);
        CPH.SetGlobalVar("ps_lastViewerName", "", true);
        CPH.SetGlobalVar("ps_lastViewerImageUrl", "", true);
        CPH.SetGlobalVar("ps_lastViewerShownAtUtc", "", true);
        CPH.SetGlobalVar("ps_lastViewerEventType", "", true);
        CPH.SetGlobalVar("ps_lastViewerEventValueBits", 0, true);
        int statusSequence = GetInt("ps_statusSequence", 0) + 1;
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
        CPH.SetGlobalVar("ps_relayMode", "reset", true);

        // Arguments for immediate relay update
        CPH.SetArgument("chargePool", 0);
        CPH.SetArgument("currentVoltage", 0);
        CPH.SetArgument("storedVoltage", 0);
        CPH.SetArgument("normalVoltageCap", 10);
        CPH.SetArgument("overloadVoltageCap", 15);
        CPH.SetArgument("hypeLevel", 0);
        CPH.SetArgument("overloadArmed", false);
        CPH.SetArgument("lastIntensity", 0);
        CPH.SetArgument("relayMode", "reset");
        CPH.SetArgument("pressureGauge", 0);
        CPH.SetArgument("maxPressureGauge", 100);
        CPH.SetArgument("chancePercent", 0);
        CPH.SetArgument("missCount", 0);
        CPH.SetArgument("cooldownRemaining", 0);
        CPH.SetArgument("cooldownTotal", 0);
        CPH.SetArgument("currentViewerName", "");
        CPH.SetArgument("currentViewerImageUrl", "");
        CPH.SetArgument("eventType", "reset");
        CPH.SetArgument("eventValueBits", 0);
        CPH.SetArgument("eventMessage", "Containment status reset.");
        CPH.SetArgument("statusSequence", statusSequence);

        CPH.LogInfo("[PiShock Reset] Anthro-Corp containment status reset to zero.");

        return true;
    }

    private int GetInt(string name, int fallback)
    {
        try { return CPH.GetGlobalVar<int>(name, true); }
        catch { return fallback; }
    }
}
