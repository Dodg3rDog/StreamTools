using System;

public class CPHInline
{
    public bool Execute()
    {
        string preset = GetString("ps_nextPiShockPreset", "");
        bool vibratePreset = preset.Equals("vibrate", StringComparison.OrdinalIgnoreCase);
        bool shockPreset = preset.Equals("shock", StringComparison.OrdinalIgnoreCase);
        int intensity = GetIntArg("intensity", vibratePreset
            ? GetInt("ps_pendingVibrateIntensity", -1)
            : shockPreset ? GetInt("ps_pendingShockIntensity", -1) : -1);
        int duration = GetIntArg("duration", vibratePreset
            ? GetInt("ps_pendingVibrateDuration", -1)
            : shockPreset ? GetInt("ps_pendingShockDuration", -1) : -1);
        int op = GetIntArg("op", vibratePreset
            ? GetInt("ps_pendingVibrateOp", -1)
            : shockPreset ? GetInt("ps_pendingShockOp", -1) : -1);
        int mode = GetIntArg("mode", vibratePreset
            ? GetInt("ps_pendingVibrateMode", -1)
            : shockPreset ? GetInt("ps_pendingShockMode", -1) : -1);
        int shocker = GetIntArg("shocker", vibratePreset
            ? GetInt("ps_pendingVibrateShocker", -1)
            : shockPreset ? GetInt("ps_pendingShockShocker", -1) : -1);
        int vibrateIntensity = GetIntArg("vibrateIntensity", GetInt("ps_pendingVibrateIntensity", -1));
        int vibrateDuration = GetIntArg("vibrateDuration", GetInt("ps_pendingVibrateDuration", -1));
        int vibrateOp = GetIntArg("vibrateOp", GetInt("ps_pendingVibrateOp", -1));
        int shockIntensity = GetIntArg("shockIntensity", GetInt("ps_pendingShockIntensity", -1));
        int shockDuration = GetIntArg("shockDuration", GetInt("ps_pendingShockDuration", -1));
        int shockOp = GetIntArg("shockOp", GetInt("ps_pendingShockOp", -1));
        string log = GetStringArg("log", shockPreset ? GetString("ps_pendingShockLog", "") : "");

        CPH.LogInfo(
            "[PiShock Args] preset=" + preset +
            " intensity=" + intensity +
            " duration=" + duration +
            " op=" + op +
            " mode=" + mode +
            " shocker=" + shocker +
            " log=" + log +
            " | vibrateIntensity=" + vibrateIntensity +
            " vibrateDuration=" + vibrateDuration +
            " vibrateOp=" + vibrateOp +
            " | shockIntensity=" + shockIntensity +
            " shockDuration=" + shockDuration +
            " shockOp=" + shockOp
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
