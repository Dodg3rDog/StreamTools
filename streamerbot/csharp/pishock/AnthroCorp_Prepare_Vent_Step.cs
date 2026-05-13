using System;

public class CPHInline
{
    private static readonly Random Rng = new Random();

    // ---------------------------------------------------------------------
    // ADJUSTMENTS
    // ---------------------------------------------------------------------
    private const int OverloadSafePressure = 30;
    private const int FlushSafePressure = 0;
    private const int PressureVentPerShock = 10;
    private const int ShockDurationSeconds = 1;
    private const int NormalChargeCap = 10;
    private const int OverloadChargeCap = 15;
    private const int StoredChargeCap = 99;

    public bool Execute()
    {
        int pressureBefore = GetInt("ps_pressureGauge", 0);
        int targetPressure = GetVentTargetPressure();
        bool isFlush = targetPressure <= FlushSafePressure;
        string relayMode = isFlush ? "flush" : "venting";
        string logMode = isFlush ? "MANUAL FLUSH" : "OVERLOAD VENT";

        if (isFlush)
            return PrepareRegularFlush(pressureBefore);

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
        CPH.SetGlobalVar("ps_lastFinalIntensity", intensity, true);
        CPH.SetGlobalVar("ps_lastPressureVented", pressureBefore - pressureAfter, true);
        CPH.SetGlobalVar("ps_lastChargeSpent", 0, true);
        CPH.SetGlobalVar("ps_lastPoolBefore", GetInt("ps_currentCharge", GetInt("ps_chargePool", 0)), true);
        CPH.SetGlobalVar("ps_lastPoolAfter", GetInt("ps_currentCharge", GetInt("ps_chargePool", 0)), true);
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

    private bool PrepareRegularFlush(int pressureBefore)
    {
        bool overloadActive = GetBool("ps_overloadActive", false) || GetBool("ps_overloadArmed", false);
        int cap = overloadActive ? OverloadChargeCap : NormalChargeCap;
        int currentBefore = GetInt("ps_currentCharge", GetInt("ps_chargePool", 0));
        int storedBefore = GetInt("ps_storedCharge", 0);
        if (currentBefore > cap)
        {
            int overflow = currentBefore - cap;
            currentBefore = cap;
            storedBefore = Math.Min(StoredChargeCap, storedBefore + overflow);
        }

        int riskChance = Clamp(pressureBefore, 0, 100);
        int roll = riskChance > 0 ? Rng.Next(1, 101) : 0;
        bool shouldDischarge = currentBefore > 0 && (pressureBefore >= 100 || (riskChance > 0 && roll <= riskChance));
        int currentLoss = currentBefore <= 0 ? 0 : Rng.Next(0, currentBefore + 1);

        if (shouldDischarge)
            currentLoss = currentBefore;

        int currentAfter = Math.Max(0, currentBefore - currentLoss);
        int storedAfter = storedBefore;
        int refill = Math.Min(storedAfter, Math.Max(0, cap - currentAfter));
        currentAfter += refill;
        storedAfter -= refill;

        int intensity = shouldDischarge ? Clamp(currentBefore, 1, cap) : 0;
        string relayMode = shouldDischarge ? "vent-discharge" : "flush";
        string eventMessage = shouldDischarge
            ? "Regular vent triggered a discharge. Pressure flushed to 0%."
            : "Regular vent complete. Pressure flushed to 0%.";

        CPH.SetGlobalVar("ps_pressureGauge", 0, true);
        CPH.SetGlobalVar("ps_currentCharge", currentAfter, true);
        CPH.SetGlobalVar("ps_storedCharge", storedAfter, true);
        CPH.SetGlobalVar("ps_chargePool", currentAfter, true);
        CPH.SetGlobalVar("ps_overloadVenting", false, true);
        CPH.SetGlobalVar("ps_lastChancePercent", riskChance, true);
        CPH.SetGlobalVar("ps_lastRoll", roll, true);
        CPH.SetGlobalVar("ps_lastPressureBefore", pressureBefore, true);
        CPH.SetGlobalVar("ps_lastPressureAfter", 0, true);
        CPH.SetGlobalVar("ps_lastPressureGain", 0, true);
        CPH.SetGlobalVar("ps_lastPressureVented", pressureBefore, true);
        CPH.SetGlobalVar("ps_lastFinalIntensity", intensity, true);
        CPH.SetGlobalVar("ps_lastChargeSpent", currentLoss, true);
        CPH.SetGlobalVar("ps_lastPoolBefore", currentBefore, true);
        CPH.SetGlobalVar("ps_lastPoolAfter", currentAfter, true);
        CPH.SetGlobalVar("ps_lastOverloadUsed", overloadActive, true);
        CPH.SetGlobalVar("ps_lastEventType", "vent", true);
        CPH.SetGlobalVar("ps_lastEventValueBits", 0, true);
        CPH.SetGlobalVar("ps_lastEventMessage", eventMessage, true);
        CPH.SetGlobalVar("ps_relayMode", relayMode, true);

        CPH.SetArgument("shouldVentDischarge", shouldDischarge);
        CPH.SetArgument("shouldContinueVenting", false);
        CPH.SetArgument("ventTargetPressure", 0);
        CPH.SetArgument("pressureBefore", pressureBefore);
        CPH.SetArgument("pressureGauge", 0);
        CPH.SetArgument("currentVoltage", currentAfter);
        CPH.SetArgument("storedVoltage", storedAfter);
        CPH.SetArgument("normalVoltageCap", NormalChargeCap);
        CPH.SetArgument("overloadVoltageCap", OverloadChargeCap);
        CPH.SetArgument("relayMode", relayMode);

        if (shouldDischarge)
        {
            CPH.SetArgument("intensity", intensity);
            CPH.SetArgument("duration", ShockDurationSeconds);
            CPH.SetArgument("op", 0);
            CPH.SetArgument("mode", 0);
            CPH.SetArgument("shocker", 0);
            CPH.SetArgument("log", "REGULAR VENT");
        }

        CPH.LogInfo("[PiShock Vent] Regular flush Pressure=" + pressureBefore + "->0 Current=" + currentBefore + "->" + currentAfter + " Stored=" + storedBefore + "->" + storedAfter + " Chance=" + riskChance + " Roll=" + roll + " Discharge=" + shouldDischarge);
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

    private bool GetBool(string name, bool fallback)
    {
        try { return CPH.GetGlobalVar<bool>(name, true); }
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
