using System;

public class CPHInline
{
    public bool Execute()
    {
        bool active = GetBool("ps_hypeTrainActive", false);

        if (active)
        {
            Debug("Cooling skipped. Hype Train active.");
            return true;
        }

        int level = GetInt("ps_hypeTrainLevel", 0);

        if (level <= 0)
        {
            Debug("Cooling skipped. Core pressure already zero.");
            return true;
        }

        int oldLevel = level;
        level = Math.Max(0, level - 1);

        CPH.SetGlobalVar("ps_hypeTrainLevel", level, true);
        CPH.SetGlobalVar("ps_relayMode", "cooling", true);
        CPH.SetArgument("relayMode", "cooling");

        CPH.SendMessage(
            "🧯 ANTHRO-CORP COOLING CYCLE: Core pressure reduced from Level " +
            oldLevel +
            " to Level " +
            level +
            ".",
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

    private void Debug(string msg)
    {
        if (GetBool("ps_debug", false))
            CPH.LogInfo("[PiShock Debug] " + msg);
    }
}
