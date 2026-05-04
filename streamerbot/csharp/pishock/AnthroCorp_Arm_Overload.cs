using System;

public class CPHInline
{
    public bool Execute()
    {
        int pool = GetInt("ps_chargePool", 0);

        if (pool < 75)
        {
            CPH.SetGlobalVar("ps_relayMode", "overload-denied", true);
            CPH.SetArgument("relayMode", "overload-denied");

            CPH.SendMessage(
                "🟢 ANTHRO-CORP: Overload denied. Capacitor charge is only " +
                pool +
                "%. Minimum required: 75%.",
                true
            );
            return true;
        }

        bool alreadyArmed = GetBool("ps_overloadArmed", false);

        if (alreadyArmed)
        {
            CPH.SetGlobalVar("ps_relayMode", "overload-armed", true);
            CPH.SetArgument("relayMode", "overload-armed");

            CPH.SendMessage(
                "🔴 ANTHRO-CORP: Overload already armed for next discharge.",
                true
            );
            return true;
        }

        CPH.SetGlobalVar("ps_overloadArmed", true, true);
        CPH.SetGlobalVar("ps_relayMode", "overload-armed", true);
        CPH.SetArgument("relayMode", "overload-armed");

        CPH.SendMessage(
            "🔴 ANTHRO-CORP OVERLOAD AUTHORIZATION ACCEPTED: Safety limiter disengaged for the next discharge.",
            true
        );

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
