using System;

public class CPHInline
{
    public bool Execute()
    {
        int intensity = GetIntArg("vibrateIntensity", GetInt("ps_pendingVibrateIntensity", GetIntArg("intensity", 1)));
        int duration = GetIntArg("vibrateDuration", GetInt("ps_pendingVibrateDuration", 1));
        int op = GetIntArg("vibrateOp", GetInt("ps_pendingVibrateOp", 1));
        int mode = GetIntArg("vibrateMode", GetInt("ps_pendingVibrateMode", 0));
        int shocker = GetIntArg("vibrateShocker", GetInt("ps_pendingVibrateShocker", 0));

        CPH.SetArgument("intensity", intensity);
        CPH.SetArgument("duration", duration);
        CPH.SetArgument("op", op);
        CPH.SetArgument("mode", mode);
        CPH.SetArgument("shocker", shocker);
        CPH.SetArgument("log", "PRE-SHOCK VIBRATE");
        CPH.SetGlobalVar("ps_nextPiShockPreset", "vibrate", true);

        CPH.LogInfo("[PiShock Args] Applied vibrate handoff. intensity=" + intensity + " duration=" + duration + " op=" + op + " mode=" + mode + " shocker=" + shocker);
        return true;
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
}
