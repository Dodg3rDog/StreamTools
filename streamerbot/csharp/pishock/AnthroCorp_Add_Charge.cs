using System;

public class CPHInline
{
    private const int NormalChargeCap = 10;
    private const int OverloadChargeCap = 15;
    private const int StoredChargeCap = 99;

    public bool Execute()
    {
        int addPressure = GetIntArg("addPressure", -1);
        if (addPressure < 0) addPressure = GetIntArg("pressure", -1);
        int addCharge = GetIntArg("addCharge", -1);

        if (addPressure >= 0)
            AddPressure(addPressure);
        else
            AddCharge(addCharge < 0 ? 1 : addCharge);

        return true;
    }

    private void AddPressure(int addPressure)
    {
        addPressure = Math.Max(0, Math.Min(150, addPressure));
        int maxPressure = GetInt("ps_maxPressureGauge", 100);
        maxPressure = Math.Max(100, Math.Min(150, maxPressure));

        int pressure = GetInt("ps_pressureGauge", 0);
        int oldPressure = pressure;
        pressure = Math.Min(maxPressure, pressure + addPressure);
        int actualGain = pressure - oldPressure;

        CPH.SetGlobalVar("ps_pressureGauge", pressure, true);
        CPH.SetGlobalVar("ps_maxPressureGauge", maxPressure, true);
        CPH.SetGlobalVar("ps_lastPressureBefore", oldPressure, true);
        CPH.SetGlobalVar("ps_lastPressureAfter", pressure, true);
        CPH.SetGlobalVar("ps_lastPressureGain", actualGain, true);
        CPH.SetGlobalVar("ps_lastEventType", "manual-pressure", true);
        CPH.SetGlobalVar("ps_lastEventValueBits", actualGain * 10, true);
        CPH.SetGlobalVar("ps_lastEventMessage", "Manual pressure adjustment applied.", true);
        CPH.SetGlobalVar("ps_relayMode", "charge", true);

        CPH.SetArgument("relayMode", "charge");
        CPH.SetArgument("pressureGauge", pressure);
        CPH.SetArgument("maxPressureGauge", maxPressure);

        CPH.LogInfo("[PiShock Pressure] Manual pressure=" + oldPressure + "->" + pressure + " Add=" + addPressure + " Max=" + maxPressure);
    }

    private void AddCharge(int addCharge)
    {
        addCharge = Math.Max(0, Math.Min(StoredChargeCap, addCharge));
        bool overloadActive = GetBool("ps_overloadActive", false) || GetBool("ps_overloadArmed", false);
        int cap = overloadActive ? OverloadChargeCap : NormalChargeCap;
        int current = GetInt("ps_currentCharge", GetInt("ps_chargePool", 0));
        int stored = GetInt("ps_storedCharge", 0);
        if (current > cap)
        {
            int overflow = current - cap;
            current = cap;
            stored = Math.Min(StoredChargeCap, stored + overflow);
        }

        int oldCurrent = current;
        int oldStored = stored;
        int space = Math.Max(0, cap - current);

        current = Math.Min(cap, current + Math.Min(space, addCharge));
        stored = Math.Min(StoredChargeCap, stored + Math.Max(0, addCharge - space));

        CPH.SetGlobalVar("ps_currentCharge", current, true);
        CPH.SetGlobalVar("ps_storedCharge", stored, true);
        CPH.SetGlobalVar("ps_chargePool", current, true);
        CPH.SetGlobalVar("ps_lastChargeGain", addCharge, true);
        CPH.SetGlobalVar("ps_lastEventType", "manual-charge", true);
        CPH.SetGlobalVar("ps_lastEventValueBits", 0, true);
        CPH.SetGlobalVar("ps_lastEventMessage", "Manual intensity charge adjustment applied.", true);
        CPH.SetGlobalVar("ps_relayMode", "charge", true);

        CPH.SetArgument("relayMode", "charge");
        CPH.SetArgument("chargePool", current);
        CPH.SetArgument("currentVoltage", current);
        CPH.SetArgument("storedVoltage", stored);
        CPH.SetArgument("normalVoltageCap", NormalChargeCap);
        CPH.SetArgument("overloadVoltageCap", OverloadChargeCap);

        CPH.LogInfo("[PiShock Charge] Manual charge=" + oldCurrent + "c/" + oldStored + "s -> " + current + "c/" + stored + "s Add=" + addCharge);
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
}
