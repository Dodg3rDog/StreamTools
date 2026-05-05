using System;

public class CPHInline
{
    // ---------------------------------------------------------------------
    // ADJUSTMENTS
    // ---------------------------------------------------------------------
    private const int OverloadSafePressure = 30;
    private const int FlushSafePressure = 0;
    private const int PressureVentPerShock = 10;
    private const int ShockDurationSeconds = 1;

    public bool Execute()
    {
        int pressureBefore = GetInt("ps_pressureGauge", GetInt("ps_chargePool", 0));
        int targetPressure = GetVentTargetPressure();
        bool isFlush = targetPressure <= FlushSafePressure;
        string relayMode = isFlush ? "flush" : "venting";
        string logMode = isFlush ? "MANUAL FLUSH" : "OVERLOAD VENT";

        if (pressureBefore <= targetPressure)
        {
            CPH.SetArgument("shouldVentDischarge", false);
            CPH.SetArgument("shouldContinueVenting", false);
            CPH.SetArgument("ventTargetPressure", targetPressure);
            CPH.SetGlobalVar("ps_lastEventType", relayMode, true);
            CPH.SetGlobalVar("ps_lastEventValueBits", 0, true);
            CPH.SetGlobalVar("ps_lastEventMessage", "Venting skipped. Pressure already at target " + targetPressure + "%.", true);
            CPH.SetGlobalVar("ps_relayMode", isFlush ? "flush" : "recovery", true);
            CPH.SetArgument("relayMode", isFlush ? "flush" : "recovery");
            CPH.LogInfo("[PiShock Vent] Skipped. Pressure=" + pressureBefore + "% Target=" + targetPressure + "%");
            return true;
        }

        int intensity = PressureToIntensity(pressureBefore);
        int pressureAfter = Math.Max(targetPressure, pressureBefore - PressureVentPerShock);
        bool shouldContinue = pressureAfter > targetPressure;

        CPH.SetGlobalVar("ps_overloadVenting", !isFlush, true);
        CPH.SetGlobalVar("ps_pressureGauge", pressureAfter, true);
        CPH.SetGlobalVar("ps_chargePool", pressureAfter, true);
        CPH.SetGlobalVar("ps_lastFinalIntensity", intensity, true);
        CPH.SetGlobalVar("ps_lastChargeSpent", pressureBefore - pressureAfter, true);
        CPH.SetGlobalVar("ps_lastPoolBefore", pressureBefore, true);
        CPH.SetGlobalVar("ps_lastPoolAfter", pressureAfter, true);
        CPH.SetGlobalVar("ps_lastOverloadUsed", !isFlush, true);
        CPH.SetGlobalVar("ps_lastEventType", relayMode, true);
        CPH.SetGlobalVar("ps_lastEventValueBits", 0, true);
        CPH.SetGlobalVar("ps_lastEventMessage", logMode + " prepared at intensity " + intensity + ". Pressure " + pressureBefore + "% -> " + pressureAfter + "%. Target " + targetPressure + "%.", true);
        CPH.SetGlobalVar("ps_relayMode", relayMode, true);

        CPH.SetArgument("shouldVentDischarge", true);
        CPH.SetArgument("shouldContinueVenting", shouldContinue);
        CPH.SetArgument("ventTargetPressure", targetPressure);
        CPH.SetArgument("pressureBefore", pressureBefore);
        CPH.SetArgument("pressureGauge", pressureAfter);
        CPH.SetArgument("intensity", intensity);
        CPH.SetArgument("duration", ShockDurationSeconds);
        CPH.SetArgument("op", 0);
        CPH.SetArgument("mode", 0);
        CPH.SetArgument("shocker", 0);
        CPH.SetArgument("log", logMode);
        CPH.SetArgument("relayMode", relayMode);

        CPH.LogInfo("[PiShock Vent] Prepared mode=" + relayMode + " intensity=" + intensity + " Pressure=" + pressureBefore + "->" + pressureAfter + " Target=" + targetPressure + " Continue=" + shouldContinue);
        return true;
    }

    private int PressureToIntensity(int pressure)
    {
        return Math.Min(Math.Max((int)Math.Ceiling(pressure / 10.0), 1), 15);
    }

    private int GetInt(string name, int fallback)
    {
        try { return CPH.GetGlobalVar<int>(name, true); }
        catch { return fallback; }
    }

    private int GetVentTargetPressure()
    {
        int target = GetIntArg("ventTargetPressure", -1);
        if (target >= 0)
            return Clamp(target, FlushSafePressure, OverloadSafePressure);

        string ventMode = GetStringArg("ventMode", "");
        bool flush = GetBoolArg("flush", false) ||
            ventMode.Equals("flush", StringComparison.OrdinalIgnoreCase) ||
            ventMode.Equals("manual-flush", StringComparison.OrdinalIgnoreCase);

        return flush ? FlushSafePressure : OverloadSafePressure;
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

    private bool GetBoolArg(string name, bool fallback)
    {
        try
        {
            bool value;
            if (CPH.TryGetArg(name, out value))
                return value;

            string text;
            if (CPH.TryGetArg(name, out text))
            {
                text = (text ?? "").Trim();
                return text.Equals("true", StringComparison.OrdinalIgnoreCase) ||
                    text.Equals("yes", StringComparison.OrdinalIgnoreCase) ||
                    text == "1";
            }

            return fallback;
        }
        catch { return fallback; }
    }

    private int Clamp(int value, int min, int max)
    {
        return Math.Min(Math.Max(value, min), max);
    }
}
