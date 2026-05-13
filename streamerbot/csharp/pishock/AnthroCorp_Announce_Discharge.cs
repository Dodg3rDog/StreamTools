using System;

public class CPHInline
{
    public bool Execute()
    {
        int pressureBefore = GetInt("ps_lastPressureBefore", GetInt("ps_lastPoolBefore", 0));
        int pressureAfter = GetInt("ps_lastPressureAfter", GetInt("ps_lastPoolAfter", 0));
        int pressureGain = GetInt("ps_lastPressureGain", 0);
        int chargeGain = GetInt("ps_lastChargeGain", 0);
        int finalIntensity = GetInt("ps_lastFinalIntensity", 0);
        int pressureVented = GetInt("ps_lastPressureVented", Math.Max(0, pressureBefore - pressureAfter));
        int chargeBefore = GetInt("ps_lastPoolBefore", 0);
        int chargeAfter = GetInt("ps_lastPoolAfter", 0);
        int storedCharge = GetInt("ps_storedCharge", 0);
        int chancePercent = GetInt("ps_lastChancePercent", 0);
        int roll = GetInt("ps_lastRoll", 0);
        int cooldownSeconds = GetInt("ps_cooldownSeconds", 0);
        string relayMode = GetString("ps_relayMode", "discharge");
        string eventType = GetString("ps_lastEventType", "event");
        int eventValueBits = GetInt("ps_lastEventValueBits", 0);
        bool overloadUsed = GetBool("ps_lastOverloadUsed", false);

        string mode = overloadUsed || relayMode == "venting"
            ? "OVERLOAD VENT DISCHARGE"
            : "CONTAINMENT DISCHARGE";

        string msg =
            mode + " CONFIRMED | " +
            "Event: " + eventType + " (" + eventValueBits + " bits) | " +
            "Pressure: " + pressureBefore + "% -> " + pressureAfter + "%";

        if (pressureGain > 0)
            msg += " (+" + pressureGain + "% gained)";

        msg +=
            " | Output: intensity " + finalIntensity +
            " | Charge: " + chargeBefore + "c -> " + chargeAfter + "c";

        if (chargeGain > 0 || storedCharge > 0)
            msg += " (+" + chargeGain + "c, stored " + storedCharge + "s)";

        msg +=
            " | Vented: " + pressureVented + "%";

        if (chancePercent > 0 || roll > 0)
            msg += " | Chance: " + chancePercent + "% Roll: " + roll;

        if (cooldownSeconds > 0)
            msg += " | Cooldown: " + cooldownSeconds + "s";

        msg += ".";

        //CPH.SendMessage(msg, false);
        CPH.LogInfo("[Anthro-Corp] " + msg);

        return true;
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
}
