using System;

public class CPHInline
{
    private static readonly Random Rng = new Random();

    public bool Execute()
    {
        int duration = 1;

        int normalMaxIntensity = 20;
        int overloadMaxIntensity = 25;

        int lowChargeThreshold = 25;
        int normalChargeCost = 5;
        int overloadChargeCost = 10;

        int pool = GetInt("ps_chargePool", 0);
        int hypeLevel = GetInt("ps_hypeTrainLevel", 0);
        bool overloadArmed = GetBool("ps_overloadArmed", false);
        bool spendCharge = GetBoolArg("spendCharge", false) ||
            GetBoolArg("consumeCharge", false) ||
            GetBoolArg("secondaryShock", false);

        int poolBefore = pool;
        int baseIntensity = 0;
        int randomSurge = 0;
        int finalIntensity = 0;
        int chargeSpent = 0;
        bool overloadUsed = false;

        // Low charge weak shock mode
        if (pool < lowChargeThreshold)
        {
            finalIntensity = Rng.Next(1, 4);
            randomSurge = finalIntensity;
        }
        else
        {
            baseIntensity = Math.Max(5, pool / 5); // 25% = 5, 100% = 20

            randomSurge = Rng.Next(0, 3);

            int cap = spendCharge && overloadArmed ? overloadMaxIntensity : normalMaxIntensity;

            finalIntensity = baseIntensity + hypeLevel + randomSurge;
            finalIntensity = Math.Min(cap, finalIntensity);

            if (spendCharge)
            {
                chargeSpent = overloadArmed ? overloadChargeCost : normalChargeCost;
                pool = Math.Max(0, pool - chargeSpent);

                overloadUsed = overloadArmed;

                if (overloadArmed)
                    CPH.SetGlobalVar("ps_overloadArmed", false, true);

                CPH.SetGlobalVar("ps_chargePool", pool, true);
            }
        }

        // Hand off to PiShock action
        finalIntensity = Math.Max(1, finalIntensity);
        CPH.SetArgument("intensity", finalIntensity);
        CPH.SetArgument("duration", duration);
        CPH.SetArgument("op", 0);
        CPH.SetArgument("mode", 0);
        CPH.SetArgument("log", overloadUsed ? "OVERLOAD" : "STANDARD");
        CPH.SetArgument("relayMode", overloadUsed ? "overload" : "discharge");

        // Store result for announcement action
        CPH.SetGlobalVar("ps_lastPoolBefore", poolBefore, true);
        CPH.SetGlobalVar("ps_lastPoolAfter", pool, true);
        CPH.SetGlobalVar("ps_lastBaseIntensity", baseIntensity, true);
        CPH.SetGlobalVar("ps_lastHypeBonus", hypeLevel, true);
        CPH.SetGlobalVar("ps_lastRandomSurge", randomSurge, true);
        CPH.SetGlobalVar("ps_lastFinalIntensity", finalIntensity, true);
        CPH.SetGlobalVar("ps_lastChargeSpent", chargeSpent, true);
        CPH.SetGlobalVar("ps_lastOverloadUsed", overloadUsed, true);
        CPH.SetGlobalVar("ps_relayMode", overloadUsed ? "overload" : "discharge", true);

        CPH.LogInfo("[PiShock Debug] Prepared shock Intensity=" + finalIntensity + " Pool=" + poolBefore + "→" + pool + " SpendCharge=" + spendCharge);

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
