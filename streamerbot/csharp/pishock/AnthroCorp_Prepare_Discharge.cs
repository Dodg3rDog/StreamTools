using System;

public class CPHInline
{
    private const int ShockDurationSeconds = 1;
    private const int NormalChargeCap = 10;
    private const int OverloadChargeCap = 15;
    private const int StoredChargeCap = 99;

    public bool Execute()
    {
        bool overloadUsed = GetBool("ps_overloadActive", false) || GetBool("ps_overloadVenting", false);
        int cap = overloadUsed ? OverloadChargeCap : NormalChargeCap;
        int pressureBefore = GetIntArg("pressureGauge", GetInt("ps_pressureGauge", 0));
        int currentBefore = GetInt("ps_currentCharge", GetInt("ps_chargePool", 0));
        int storedBefore = GetInt("ps_storedCharge", 0);
        if (currentBefore > cap)
        {
            int overflow = currentBefore - cap;
            currentBefore = cap;
            storedBefore = Math.Min(StoredChargeCap, storedBefore + overflow);
        }

        int finalIntensity = Clamp(GetIntArg("intensity", currentBefore), 1, cap);
        bool ventPressure = GetBoolArg("ventPressure", GetBoolArg("spendPressure", false));
        bool consumeCharge = GetBoolArg("consumeCharge", GetBoolArg("spendCharge", false));
        int pressureAfter = ventPressure
            ? 0
            : pressureBefore;
        int currentAfter = currentBefore;
        int storedAfter = storedBefore;
        if (consumeCharge)
        {
            int promoted = Math.Min(storedBefore, cap);
            currentAfter = promoted;
            storedAfter = Math.Max(0, storedBefore - promoted);
        }
        string relayMode = overloadUsed ? "overload" : "discharge";

        CPH.SetArgument("intensity", finalIntensity);
        CPH.SetArgument("duration", ShockDurationSeconds);
        CPH.SetArgument("op", 0);
        CPH.SetArgument("mode", 0);
        CPH.SetArgument("shocker", 0);
        CPH.SetArgument("log", overloadUsed ? "OVERLOAD PRESSURE EVENT" : "PRESSURE EVENT");
        CPH.SetArgument("relayMode", relayMode);

        if (ventPressure)
        {
            CPH.SetGlobalVar("ps_pressureGauge", pressureAfter, true);
        }

        if (consumeCharge)
        {
            CPH.SetGlobalVar("ps_currentCharge", currentAfter, true);
            CPH.SetGlobalVar("ps_storedCharge", storedAfter, true);
            CPH.SetGlobalVar("ps_chargePool", currentAfter, true);
        }

        CPH.SetGlobalVar("ps_lastPressureBefore", pressureBefore, true);
        CPH.SetGlobalVar("ps_lastPressureAfter", pressureAfter, true);
        CPH.SetGlobalVar("ps_lastPressureGain", 0, true);
        CPH.SetGlobalVar("ps_lastPressureVented", pressureBefore - pressureAfter, true);
        CPH.SetGlobalVar("ps_lastPoolBefore", currentBefore, true);
        CPH.SetGlobalVar("ps_lastPoolAfter", currentAfter, true);
        CPH.SetGlobalVar("ps_lastFinalIntensity", finalIntensity, true);
        CPH.SetGlobalVar("ps_lastChargeSpent", consumeCharge ? finalIntensity : 0, true);
        CPH.SetGlobalVar("ps_lastOverloadUsed", overloadUsed, true);
        CPH.SetGlobalVar("ps_relayMode", relayMode, true);

        CPH.LogInfo("[PiShock Pressure] Prepared manual discharge Intensity=" + finalIntensity + " Pressure=" + pressureBefore + "->" + pressureAfter + " Charge=" + currentBefore + "->" + currentAfter + " Stored=" + storedBefore + "->" + storedAfter + " VentPressure=" + ventPressure + " ConsumeCharge=" + consumeCharge);

        return true;
    }

    private int Clamp(int value, int min, int max)
    {
        return Math.Min(Math.Max(value, min), max);
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
}
