using System;

public class CPHInline
{
    // ---------------------------------------------------------------------
    // ADJUSTMENTS
    // ---------------------------------------------------------------------
    private const int NormalMaxPressure = 100;
    private const int OverloadSafePressure = 30;
    private const int FlushSafePressure = 0;

    public bool Execute()
    {
        int pressure = GetVentTargetPressure();
        bool isFlush = pressure <= FlushSafePressure;
        string relayMode = isFlush ? "flush" : "recovery";
        string eventType = isFlush ? "flush" : "recovery";
        string eventMessage = isFlush
            ? "Manual flush complete. Pressure fully vented to 0%."
            : "All systems returned to normal operating parameters. Charging resumed.";

        CPH.SetGlobalVar("ps_pressureGauge", pressure, true);
        CPH.SetGlobalVar("ps_chargePool", pressure, true);
        CPH.SetGlobalVar("ps_maxPressureGauge", NormalMaxPressure, true);
        CPH.SetGlobalVar("ps_overloadArmed", false, true);
        CPH.SetGlobalVar("ps_overloadActive", false, true);
        CPH.SetGlobalVar("ps_overloadVenting", false, true);
        CPH.SetGlobalVar("ps_overloadVentRequested", false, true);
        CPH.SetGlobalVar("ps_overloadUntilUtc", "", true);
        CPH.SetGlobalVar("ps_cooldownUntilUtc", "", true);
        CPH.SetGlobalVar("ps_cooldownSeconds", 0, true);
        CPH.SetGlobalVar("ps_cooldownRemaining", 0, true);
        CPH.SetGlobalVar("ps_lastEventType", eventType, true);
        CPH.SetGlobalVar("ps_lastEventValueBits", 0, true);
        CPH.SetGlobalVar("ps_lastEventMessage", eventMessage, true);
        CPH.SetGlobalVar("ps_relayMode", relayMode, true);

        CPH.SetArgument("relayMode", relayMode);
        CPH.SetArgument("pressureGauge", pressure);
        CPH.SetArgument("maxPressureGauge", NormalMaxPressure);
        CPH.SetArgument("overloadActive", false);
        CPH.SetArgument("overloadVenting", false);

        CPH.LogInfo("[PiShock Vent] Complete. Mode=" + relayMode + " Pressure=" + pressure + "% Max=" + NormalMaxPressure + "%");
        return true;
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
