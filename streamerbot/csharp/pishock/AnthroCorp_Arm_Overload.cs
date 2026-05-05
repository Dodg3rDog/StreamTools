using System;

public class CPHInline
{
    // ---------------------------------------------------------------------
    // ADJUSTMENTS
    // ---------------------------------------------------------------------
    private const int OverloadMaxPressure = 150;
    private const int OverloadDurationMinutes = 5;

    public bool Execute()
    {
        bool overloadActive = GetBool("ps_overloadActive", false);
        bool overloadVenting = GetBool("ps_overloadVenting", false);

        if (overloadVenting)
        {
            SetRelay("overload-denied", "Overload denied. Venting sequence already in progress.");
            CPH.LogInfo("[PiShock Overload] Denied. Venting already in progress.");
            return true;
        }

        if (overloadActive)
        {
            SetRelay("overload-armed", "Overload protocol already active. Red-zone pressure remains authorized.");
            CPH.LogInfo("[PiShock Overload] Already active.");
            return true;
        }

        DateTime until = DateTime.UtcNow.AddMinutes(OverloadDurationMinutes);
        int pressure = GetInt("ps_pressureGauge", GetInt("ps_chargePool", 0));

        CPH.SetGlobalVar("ps_overloadArmed", true, true);
        CPH.SetGlobalVar("ps_overloadActive", true, true);
        CPH.SetGlobalVar("ps_overloadVenting", false, true);
        CPH.SetGlobalVar("ps_overloadVentRequested", false, true);
        CPH.SetGlobalVar("ps_overloadUntilUtc", until.ToString("o"), true);
        CPH.SetGlobalVar("ps_maxPressureGauge", OverloadMaxPressure, true);
        CPH.SetGlobalVar("ps_cooldownUntilUtc", "", true);
        CPH.SetGlobalVar("ps_cooldownSeconds", 0, true);
        CPH.SetGlobalVar("ps_cooldownRemaining", 0, true);
        CPH.SetGlobalVar("ps_lastEventType", "overload", true);
        CPH.SetGlobalVar("ps_lastEventValueBits", 0, true);
        CPH.SetGlobalVar("ps_lastEventMessage", "Overload protocol active. Red-zone pressure authorized for " + OverloadDurationMinutes + " minutes.", true);
        CPH.SetGlobalVar("ps_relayMode", "overload-armed", true);

        CPH.SetArgument("relayMode", "overload-armed");
        CPH.SetArgument("pressureGauge", pressure);
        CPH.SetArgument("maxPressureGauge", OverloadMaxPressure);
        CPH.SetArgument("overloadActive", true);
        CPH.SetArgument("overloadVenting", false);

        CPH.LogInfo("[PiShock Overload] Active until " + until.ToString("o") + ". Pressure=" + pressure + "% Max=" + OverloadMaxPressure + "%");
        return true;
    }

    private void SetRelay(string mode, string message)
    {
        CPH.SetGlobalVar("ps_relayMode", mode, true);
        CPH.SetGlobalVar("ps_lastEventType", "overload", true);
        CPH.SetGlobalVar("ps_lastEventValueBits", 0, true);
        CPH.SetGlobalVar("ps_lastEventMessage", message, true);
        CPH.SetArgument("relayMode", mode);
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
