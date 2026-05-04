using System;

public class CPHInline
{
    public bool Execute()
    {
        int level = GetInt("ps_hypeTrainLevel", 0);

        CPH.SetGlobalVar("ps_hypeTrainActive", false, true);
        CPH.SetGlobalVar("ps_hypeTrainLevel", 0, true);
        CPH.SetGlobalVar("ps_relayMode", "hype-ended", true);
        CPH.SetArgument("relayMode", "hype-ended");

        CPH.SendMessage(
            "🟡 ANTHRO-CORP: Hype Train ended. Core pressure holding at Level " +
            level +
            ". Cooling cycle pending.",
            true
        );

        return true;
    }

    private int GetInt(string name, int fallback)
    {
        try { return CPH.GetGlobalVar<int>(name, true); }
        catch { return fallback; }
    }
}
