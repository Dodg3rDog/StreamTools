using System;

public class CPHInline
{
    public bool Execute()
    {
        int addCharge;
        if (!CPH.TryGetArg("addCharge", out addCharge))
            addCharge = 5;

        addCharge = Math.Max(0, Math.Min(100, addCharge));

        int pool = GetInt("ps_chargePool", 0);
        int oldPool = pool;

        pool = Math.Min(100, pool + addCharge);

        CPH.SetGlobalVar("ps_chargePool", pool, true);
        CPH.SetGlobalVar("ps_relayMode", "charge", true);
        CPH.SetArgument("relayMode", "charge");

        //CPH.SendMessage("🧪 ANTHRO-CORP CAPACITOR CHARGED: +" + addCharge + "%. Charge pool: " + oldPool + "% → " + pool + "%.", true);
        CPH.LogInfo("[PiShock Charge] ChargePool=" + oldPool + "->" + pool + " Add=" + addCharge);

        return true;
    }

    private int GetInt(string name, int fallback)
    {
        try { return CPH.GetGlobalVar<int>(name, true); }
        catch { return fallback; }
    }
}
