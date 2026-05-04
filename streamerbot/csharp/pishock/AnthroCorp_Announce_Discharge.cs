using System;

public class CPHInline
{
    public bool Execute()
    {
        int poolBefore = GetInt("ps_lastPoolBefore", 0);
        int poolAfter = GetInt("ps_lastPoolAfter", 0);
        int baseIntensity = GetInt("ps_lastBaseIntensity", 0);
        int hypeBonus = GetInt("ps_lastHypeBonus", 0);
        int randomSurge = GetInt("ps_lastRandomSurge", 0);
        int finalIntensity = GetInt("ps_lastFinalIntensity", 0);
        int chargeSpent = GetInt("ps_lastChargeSpent", 0);
        bool overloadUsed = GetBool("ps_lastOverloadUsed", false);

        string mode = overloadUsed ? "🔴 OVERLOAD DISCHARGE" : "⚠️ CONTAINMENT DISCHARGE";

        string msg =
            mode + " CONFIRMED | " +
            "Output: " + baseIntensity + " base + " + hypeBonus + " pressure + " + randomSurge + " instability = " + finalIntensity + " intensity | " +
            "Charge spent: " + chargeSpent + "% | " +
            "Capacitor: " + poolBefore + "% → " + poolAfter + "%.";

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
}