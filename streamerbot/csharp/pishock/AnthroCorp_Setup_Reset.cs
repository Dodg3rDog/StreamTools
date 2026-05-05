using System;

public class CPHInline
{
    public bool Execute()
    {
        // Debug
        CPH.SetGlobalVar("ps_debug", true, true);

        // Current live state
        CPH.SetGlobalVar("ps_chargePool", 0, true);
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
        CPH.SetGlobalVar("ps_lastViewerName", "", true);
        CPH.SetGlobalVar("ps_lastViewerImageUrl", "", true);
        CPH.SetGlobalVar("ps_lastViewerShownAtUtc", "", true);

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
        CPH.SetArgument("hypeLevel", 0);
        CPH.SetArgument("overloadArmed", false);
        CPH.SetArgument("lastIntensity", 0);
        CPH.SetArgument("relayMode", "reset");

        CPH.LogInfo("[PiShock Reset] Anthro-Corp containment status reset to zero.");

        return true;
    }
}
