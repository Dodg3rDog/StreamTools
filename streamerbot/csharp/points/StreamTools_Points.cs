using System;
using System.IO;
using System.Net;
using System.Text;

public class CPHInline
{
    // Configure this Execute C# Code action with the name:
    // StreamTools Points
    //
    // This helper only reads/writes the persistent point ledger and sets
    // arguments for Streamer.bot If/Else branching. Redeem actions decide
    // when to play the reward, send a response, and deduct the cost.

    private const string DefaultPointVarName = "points";
    private const string DefaultPointDisplayName = "point";
    private const string DefaultStreamToolsBaseUrl = "http://127.0.0.1:3030";

    public bool Execute()
    {
        string operation = NormalizeKey(GetStringArg("pointOperation", GetStringArg("operation", "check")));

        if (operation == "settings" || operation == "pointsettings")
            return GetStringArg("pointSettingsMode", "get").Equals("set", StringComparison.OrdinalIgnoreCase)
                ? SetPointSettings()
                : GetPointSettings();
        if (operation == "add" || operation == "award")
            return AddPoints();
        if (operation == "set")
            return SetPoints();
        if (operation == "get" || operation == "balance")
            return GetPoints();
        if (operation == "spend" || operation == "deduct" || operation == "charge")
            return SpendPoints();

        return CheckPoints();
    }

    public bool GetPointSettings()
    {
        string varName = GetPointVarName();
        string pointName = GetPointDisplayName();

        SetPointSettingsArgs(varName, pointName);
        PostPointSnapshot("", varName, 0, 0, 0, 0, true, "", "settings");
        CPH.LogInfo("[StreamTools Points] Settings VarName=" + varName + " Name=" + pointName);
        return true;
    }

    public bool SetPointSettings()
    {
        string varName = SanitizeVarName(GetStringArg("pointVarName", GetStringArg("st_pointVarName", GetPointVarName())));
        string pointName = GetStringArg("pointName", GetStringArg("pointDisplayName", GetPointDisplayName())).Trim();

        if (string.IsNullOrWhiteSpace(varName))
            varName = DefaultPointVarName;
        if (string.IsNullOrWhiteSpace(pointName))
            pointName = DefaultPointDisplayName;

        CPH.SetGlobalVar("st_pointVarName", varName, true);
        CPH.SetGlobalVar("st_pointDisplayName", pointName, true);

        SetPointSettingsArgs(varName, pointName);
        PostPointSnapshot("", varName, 0, 0, 0, 0, true, "", "settings");
        CPH.LogInfo("[StreamTools Points] Settings saved VarName=" + varName + " Name=" + pointName);
        return true;
    }

    public bool CheckPoints()
    {
        string userKey = ResolvePointUserKey();
        string varName = GetPointVarName();
        int cost = ResolveCost();
        int balance = string.IsNullOrWhiteSpace(userKey) ? 0 : GetUserPointBalance(userKey, varName);
        bool approved = !string.IsNullOrWhiteSpace(userKey) && balance >= cost;

        SetPointArgs(userKey, varName, balance, balance, cost, 0, approved, approved ? "" : "insufficient-points");
        CPH.LogInfo("[StreamTools Points] Check User=" + userKey + " Balance=" + balance + " Cost=" + cost + " Approved=" + approved);
        return true;
    }

    public bool SpendPoints()
    {
        string userKey = ResolvePointUserKey();
        string varName = GetPointVarName();
        int cost = ResolveCost();

        if (string.IsNullOrWhiteSpace(userKey))
        {
            SetPointArgs("", varName, 0, 0, cost, 0, false, "missing-user");
            CPH.LogError("[StreamTools Points] SpendPoints requires a user key.");
            return false;
        }

        int before = GetUserPointBalance(userKey, varName);
        if (before < cost)
        {
            SetPointArgs(userKey, varName, before, before, cost, 0, false, "insufficient-points");
            CPH.LogInfo("[StreamTools Points] Spend denied User=" + userKey + " Balance=" + before + " Cost=" + cost);
            return true;
        }

        int after = Math.Max(0, before - cost);
        SetUserPointBalance(userKey, varName, after);
        SetPointArgs(userKey, varName, before, after, cost, -cost, true, "");
        CPH.LogInfo("[StreamTools Points] Spent User=" + userKey + " Balance=" + before + " -> " + after + " Cost=" + cost);
        return true;
    }

    public bool AddPoints()
    {
        string userKey = ResolvePointUserKey();
        string varName = GetPointVarName();
        int amount = GetIntArg("points", GetIntArg("amount", 0));

        if (string.IsNullOrWhiteSpace(userKey) || amount == 0)
        {
            SetPointArgs(userKey, varName, 0, 0, 0, amount, false, "missing-user-or-amount");
            CPH.LogError("[StreamTools Points] AddPoints requires a user key and a non-zero amount.");
            return false;
        }

        int before = GetUserPointBalance(userKey, varName);
        int after = Math.Max(0, before + amount);
        SetUserPointBalance(userKey, varName, after);
        SetPointArgs(userKey, varName, before, after, 0, amount, true, "");
        CPH.LogInfo("[StreamTools Points] Added User=" + userKey + " Balance=" + before + " -> " + after + " Amount=" + amount);
        return true;
    }

    public bool SetPoints()
    {
        string userKey = ResolvePointUserKey();
        string varName = GetPointVarName();
        int points = Math.Max(0, GetIntArg("points", GetIntArg("amount", 0)));

        if (string.IsNullOrWhiteSpace(userKey))
        {
            SetPointArgs("", varName, 0, 0, 0, 0, false, "missing-user");
            CPH.LogError("[StreamTools Points] SetPoints requires a user key.");
            return false;
        }

        int before = GetUserPointBalance(userKey, varName);
        SetUserPointBalance(userKey, varName, points);
        SetPointArgs(userKey, varName, before, points, 0, points - before, true, "");
        CPH.LogInfo("[StreamTools Points] Set User=" + userKey + " Balance=" + before + " -> " + points);
        return true;
    }

    public bool GetPoints()
    {
        string userKey = ResolvePointUserKey();
        string varName = GetPointVarName();

        if (string.IsNullOrWhiteSpace(userKey))
        {
            SetPointArgs("", varName, 0, 0, 0, 0, false, "missing-user");
            CPH.LogError("[StreamTools Points] GetPoints requires a user key.");
            return false;
        }

        int balance = GetUserPointBalance(userKey, varName);
        SetPointArgs(userKey, varName, balance, balance, 0, 0, true, "");
        CPH.LogInfo("[StreamTools Points] Balance User=" + userKey + " Balance=" + balance);
        return true;
    }

    private int ResolveCost()
    {
        return Math.Max(0,
            GetIntArg("pointCost",
                GetIntArg("redeemCost",
                    GetIntArg("discordRedeemPointCost", 0))));
    }

    private string ResolvePointUserKey()
    {
        string directKey = GetStringArg("pointUserKey", "");
        if (!string.IsNullOrWhiteSpace(directKey))
            return directKey.Trim();

        string userName = GetStringArg("userName", "");
        if (!string.IsNullOrWhiteSpace(userName))
            return userName.Trim();

        string discordUserId = GetStringArg("discordUserId", "");
        if (!string.IsNullOrWhiteSpace(discordUserId))
            return "discord:" + discordUserId.Trim();

        string user = GetStringArg("user", GetStringArg("displayName", ""));
        return user.Trim();
    }

    private string GetPointVarName()
    {
        return SanitizeVarName(GetStringGlobal("st_pointVarName", DefaultPointVarName));
    }

    private string GetPointDisplayName()
    {
        return GetStringGlobal("st_pointDisplayName", DefaultPointDisplayName);
    }

    private int GetUserPointBalance(string userKey, string varName)
    {
        try
        {
            object cph = CPH;
            System.Reflection.MethodInfo method = FindCphMethod("GetUserVar", 3, true);
            if (method == null)
                return 0;

            object value = method.MakeGenericMethod(typeof(int)).Invoke(cph, new object[] { userKey, varName, true });
            int parsed;
            return int.TryParse(Convert.ToString(value), out parsed) ? Math.Max(0, parsed) : 0;
        }
        catch { return 0; }
    }

    private void SetUserPointBalance(string userKey, string varName, int balance)
    {
        try
        {
            object cph = CPH;
            System.Reflection.MethodInfo method = FindCphMethod("SetUserVar", 4, false);
            if (method != null)
            {
                method.Invoke(cph, new object[] { userKey, varName, Math.Max(0, balance), true });
                return;
            }

            method = FindCphMethod("SetUserVar", 4, true);
            if (method != null)
            {
                method.MakeGenericMethod(typeof(int)).Invoke(cph, new object[] { userKey, varName, Math.Max(0, balance), true });
                return;
            }

            CPH.LogError("[StreamTools Points] Could not find a compatible SetUserVar method.");
        }
        catch (Exception ex)
        {
            CPH.LogError("[StreamTools Points] Failed to persist point balance for " + userKey + ": " + ex.Message);
        }
    }

    private System.Reflection.MethodInfo FindCphMethod(string name, int parameterCount, bool mustBeGeneric)
    {
        object cph = CPH;
        System.Reflection.MethodInfo[] methods = cph.GetType().GetMethods();

        for (int i = 0; i < methods.Length; i++)
        {
            System.Reflection.MethodInfo method = methods[i];
            if (method.Name != name)
                continue;

            if (method.GetParameters().Length != parameterCount)
                continue;

            if (method.IsGenericMethodDefinition != mustBeGeneric)
                continue;

            return method;
        }

        return null;
    }

    private void SetPointArgs(string userKey, string varName, int before, int after, int cost, int delta, bool approved, string reason)
    {
        int shortfall = approved ? 0 : Math.Max(0, cost - before);
        string pointName = GetPointDisplayName();
        string message = approved
            ? "You have " + after + " " + pointName + "s."
            : "You do not have enough " + pointName + "s. Balance: " + before + ". Cost: " + cost + ".";

        SetPointSettingsArgs(varName, pointName);
        CPH.SetArgument("pointUserKey", userKey);
        CPH.SetArgument("pointsApproved", approved);
        CPH.SetArgument("pointsApprovedFlag", approved ? 1 : 0);
        CPH.SetArgument("pointsApprovedText", approved ? "true" : "false");
        CPH.SetArgument("pointsBalanceBefore", before);
        CPH.SetArgument("pointsBalance", after);
        CPH.SetArgument("pointsBalanceAfter", after);
        CPH.SetArgument("pointsCost", cost);
        CPH.SetArgument("pointsDelta", delta);
        CPH.SetArgument("pointsShortfall", shortfall);
        CPH.SetArgument("pointsDeniedReason", reason);
        CPH.SetArgument("pointsResponseMessage", message);
        CPH.SetArgument(varName, after);

        PostPointSnapshot(userKey, varName, before, after, cost, delta, approved, reason, "points");
    }

    private void SetPointSettingsArgs(string varName, string pointName)
    {
        CPH.SetArgument("pointVarName", varName);
        CPH.SetArgument("pointName", pointName);
        CPH.SetArgument("pointDisplayName", pointName);
        CPH.SetArgument("st_pointVarName", varName);
        CPH.SetArgument("st_pointDisplayName", pointName);
    }

    private string SanitizeVarName(string value)
    {
        string input = (value ?? "").Trim();
        string output = "";

        for (int i = 0; i < input.Length; i++)
        {
            char c = input[i];
            if ((c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || (c >= '0' && c <= '9') || c == '_')
                output += c;
        }

        return string.IsNullOrWhiteSpace(output) ? DefaultPointVarName : output;
    }

    private void PostPointSnapshot(string userKey, string varName, int before, int after, int cost, int delta, bool approved, string reason, string snapshotType)
    {
        string requestId = GetStringArg("streamToolsRequestId", "");
        if (string.IsNullOrWhiteSpace(requestId))
            return;

        string bearerToken = GetStringGlobal("st_bearerToken", "");
        if (string.IsNullOrWhiteSpace(bearerToken))
        {
            CPH.LogError("[StreamTools Points] Missing Streamer.bot global st_bearerToken. Cannot post admin callback.");
            return;
        }

        string apiBaseUrl = GetStringGlobal("st_apiBaseUrl", DefaultStreamToolsBaseUrl);
        string pointName = GetPointDisplayName();
        string json =
            "{"
            + "\"requestId\":\"" + EscapeJson(requestId) + "\","
            + "\"type\":\"" + EscapeJson(snapshotType) + "\","
            + "\"pointUserKey\":\"" + EscapeJson(userKey) + "\","
            + "\"pointVarName\":\"" + EscapeJson(varName) + "\","
            + "\"pointName\":\"" + EscapeJson(pointName) + "\","
            + "\"pointsApproved\":" + approved.ToString().ToLower() + ","
            + "\"pointsBalanceBefore\":" + before + ","
            + "\"pointsBalance\":" + after + ","
            + "\"pointsBalanceAfter\":" + after + ","
            + "\"pointsCost\":" + cost + ","
            + "\"pointsDelta\":" + delta + ","
            + "\"pointsShortfall\":" + (approved ? 0 : Math.Max(0, cost - before)) + ","
            + "\"pointsDeniedReason\":\"" + EscapeJson(reason) + "\","
            + "\"receivedAt\":\"" + EscapeJson(DateTime.UtcNow.ToString("o")) + "\""
            + "}";

        try
        {
            var request = (HttpWebRequest)WebRequest.Create(NormalizeBaseUrl(apiBaseUrl) + "/api/points/callback");
            request.Method = "POST";
            request.ContentType = "application/json";
            request.Timeout = 3000;
            request.ReadWriteTimeout = 3000;
            request.Headers["Authorization"] = "Bearer " + bearerToken;

            byte[] data = Encoding.UTF8.GetBytes(json);
            request.ContentLength = data.Length;

            using (Stream stream = request.GetRequestStream())
            {
                stream.Write(data, 0, data.Length);
            }

            using (var response = (HttpWebResponse)request.GetResponse()) { }
        }
        catch (Exception ex)
        {
            CPH.LogError("[StreamTools Points] Failed to post admin callback: " + ex.Message);
        }
    }

    private string NormalizeBaseUrl(string url)
    {
        return (url ?? "").Trim().TrimEnd('/');
    }

    private string EscapeJson(string value)
    {
        return (value ?? "")
            .Replace("\\", "\\\\")
            .Replace("\"", "\\\"")
            .Replace("\r", "\\r")
            .Replace("\n", "\\n");
    }

    private int GetIntArg(string name, int fallback)
    {
        try
        {
            int value;
            if (CPH.TryGetArg(name, out value))
                return value;

            string text;
            if (CPH.TryGetArg(name, out text))
            {
                int parsed;
                if (int.TryParse((text ?? "").Trim(), out parsed))
                    return parsed;
            }

            return fallback;
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

    private string GetStringGlobal(string name, string fallback)
    {
        try
        {
            string value = CPH.GetGlobalVar<string>(name, true);
            return string.IsNullOrWhiteSpace(value) ? fallback : value;
        }
        catch { return fallback; }
    }

    private string NormalizeKey(string value)
    {
        string input = (value ?? "").Trim().ToLowerInvariant();
        string output = "";

        for (int i = 0; i < input.Length; i++)
        {
            char c = input[i];
            if ((c >= 'a' && c <= 'z') || (c >= '0' && c <= '9'))
                output += c;
        }

        return output;
    }
}
