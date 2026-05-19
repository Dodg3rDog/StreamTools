using System;

public class CPHInline
{
    public bool Execute()
    {
        int intensity = GetIntArg("shockIntensity", GetInt("ps_pendingShockIntensity", GetIntArg("intensity", 1)));
        int duration = GetIntArg("shockDuration", GetInt("ps_pendingShockDuration", GetIntArg("duration", 1)));
        int op = GetIntArg("shockOp", GetInt("ps_pendingShockOp", 0));
        int mode = GetIntArg("shockMode", GetInt("ps_pendingShockMode", 0));
        int shocker = GetIntArg("shockShocker", GetInt("ps_pendingShockShocker", 0));
        string log = GetStringArg("shockLog", GetString("ps_pendingShockLog", GetStringArg("log", "PRESSURE EVENT")));

        CPH.SetArgument("intensity", intensity);
        CPH.SetArgument("duration", duration);
        CPH.SetArgument("op", op);
        CPH.SetArgument("mode", mode);
        CPH.SetArgument("shocker", shocker);
        CPH.SetArgument("log", log);
        CPH.SetGlobalVar("ps_nextPiShockPreset", "shock", true);

        CPH.LogInfo("[PiShock Args] Applied shock handoff. intensity=" + intensity + " duration=" + duration + " op=" + op + " mode=" + mode + " shocker=" + shocker + " log=" + log);
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

    private string GetString(string name, string fallback)
    {
        try
        {
            string value = CPH.GetGlobalVar<string>(name, true);
            return string.IsNullOrWhiteSpace(value) ? fallback : value;
        }
        catch { return fallback; }
    }

    private string GetStringArg(string name, string fallback)
    {
        try
        {
            string value;
            if (CPH.TryGetArg(name, out value))
                return string.IsNullOrWhiteSpace(value) ? fallback : value;

            return fallback;
        }
        catch { return fallback; }
    }
}
