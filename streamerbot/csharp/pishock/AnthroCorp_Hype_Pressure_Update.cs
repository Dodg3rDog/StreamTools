using System;

public class CPHInline
{
    public bool Execute()
    {
        int level = 0;

        if (!CPH.TryGetArg("level", out level))
        {
            if (!CPH.TryGetArg("hypeTrainLevel", out level))
            {
                CPH.LogError("[PiShock Hype] Missing required argument: level or hypeTrainLevel");
                return false;
            }
        }

        level = Math.Max(0, Math.Min(10, level));

        CPH.SetGlobalVar("ps_hypeTrainLevel", level, true);
        CPH.SetGlobalVar("ps_hypeTrainActive", level > 0, true);
        CPH.SetGlobalVar("ps_relayMode", "hype", true);
        CPH.SetArgument("relayMode", "hype");

        CPH.SendMessage(
            "⚠️ ANTHRO-CORP CORE PRESSURE RISING: Hype Train Level " +
            level +
            " detected. +" +
            level +
            " discharge intensity.",
            true
        );

        return true;
    }
}
