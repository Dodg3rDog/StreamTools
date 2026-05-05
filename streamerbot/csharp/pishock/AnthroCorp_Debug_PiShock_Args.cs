using System;

public class CPHInline
{
    public bool Execute()
    {
        int intensity = GetIntArg("intensity", -1);
        int duration = GetIntArg("duration", -1);
        int op = GetIntArg("op", -1);
        int mode = GetIntArg("mode", -1);
        int shocker = GetIntArg("shocker", -1);
        string log = GetStringArg("log", "");

        CPH.LogInfo(
            "[PiShock Args] intensity=" + intensity +
            " duration=" + duration +
            " op=" + op +
            " mode=" + mode +
            " shocker=" + shocker +
            " log=" + log
        );

        if (intensity < 1)
            CPH.LogError("[PiShock Args] Missing or invalid intensity. PiShock V2 will not send a valid shock.");

        if (duration < 1)
            CPH.LogError("[PiShock Args] Missing or invalid duration. PiShock V2 will not send a valid shock.");

        if (op < 0)
            CPH.LogError("[PiShock Args] Missing op. Expected 0 for shock.");

        if (mode < 0)
            CPH.LogError("[PiShock Args] Missing mode. Expected 0 for single/default shocker.");

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
