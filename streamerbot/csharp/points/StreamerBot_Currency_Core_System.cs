using System;
using System.Collections.Generic;
using System.IO;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using System.Linq;
using System.Net;
using System.Text;

public class CPHInline
{
    private const string DefaultPointVarName = "points";
    private const string DefaultPointDisplayName = "point";
    private const string DefaultStreamToolsBaseUrl = "http://127.0.0.1:3030";

    //VERSION CHECKING
    public void Init()
    {
        string url = "https://terrierdarts.co.uk/versions/core.json";
        string content;
        int installed = 5;
        using (WebClient client = new WebClient())
        {
            content = client.DownloadString(url);
        //client.Dispose(); This is a new line ive just added
        }

        bool check = int.TryParse(content, out int latest);
        if (check && latest > installed)
        {
            CPH.ShowToastNotification("PRODUCT OUT OF DATE", "CORE SYSTEM HAS HAD AN UPDATE", "Check The Log Search '[UDT]' for more info", "noIcon");
            CPH.LogInfo("[UDT] Core System Needs updating visit https://extensions.streamer.bot/docs?topic=49 to get the latest code");
        }
    }

    public bool Execute()
    {
        string operation = NormalizeKey(GetStringArg("pointOperation", GetStringArg("operation", "check")));

        if (operation == "settings" || operation == "pointsettings")
            return GetStringArg("pointSettingsMode", "get").Equals("set", StringComparison.OrdinalIgnoreCase)
                ? SetPointSettings()
                : GetPointSettings();
        if (operation == "add" || operation == "award")
            return AddPointsDiscord();
        if (operation == "set")
            return SetPointsDiscord();
        if (operation == "get" || operation == "balance")
            return GetPointsDiscord();
        if (operation == "spend" || operation == "deduct" || operation == "charge")
            return SpendPointsDiscord();

        return CheckPointsDiscord();
    }

    public bool GetPointSettings()
    {
        string varName = GetPointVarName();
        string pointName = GetPointDisplayName();

        SetPointSettingsArgs(varName, pointName);
        PostPointSnapshot("", varName, 0, 0, 0, 0, true, "", "settings");
        CPH.LogInfo("[Points Admin] [Settings] VarName=" + varName + " Name=" + pointName);
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
        CPH.LogInfo("[Points Admin] [Settings] Saved VarName=" + varName + " Name=" + pointName);
        return true;
    }

    public bool SetPointsTwitch()
    {
        //Pull in info!
        CPH.TryGetArg("targetUserId", out string userId);
        CPH.TryGetArg("targetUser", out string user);
        CPH.TryGetArg("user", out string addedBy);
        long? amountToSet = GetPointsFromRawInput("input0");
        if(amountToSet == null)
        {
            return false;
        }
        //Set Points
        CPH.SetTwitchUserVarById(userId, "points", amountToSet, true);
        //Set Args For Output Message
        CPH.SetArgument("points", amountToSet);
        CPH.SetArgument("addedBy", addedBy);
        CPH.SetArgument("addedTo", user);
        CPH.LogInfo($"[Points Admin] [Set Points] Twitch - Set {user}({userId}) by {addedBy} => {amountToSet}");
        return true;
    }

    public bool AddPointsTwitch()
    {
        //Pull in info!
        CPH.TryGetArg("targetUserId", out string userId);
        CPH.TryGetArg("targetUser", out string user);
        CPH.TryGetArg("user", out string addedBy);
        long? amountToAdd = GetPointsFromRawInput("input0");
        //Add Points
        long? currentPoints = 0;
        currentPoints = GetUserPoints(userId,user,"twitch");
        if(currentPoints != null && amountToAdd != null)
        {
            long? newPoints = currentPoints + amountToAdd;
            CPH.SetTwitchUserVarById(userId, "points", newPoints, true);
            //Set Args For Output Message
            CPH.SetArgument("newPoints", newPoints);
            CPH.SetArgument("oldPoints", currentPoints);
            CPH.SetArgument("pointsAdded", amountToAdd);
            CPH.SetArgument("addedBy", addedBy);
            CPH.SetArgument("addedTo", user);
            CPH.LogInfo($"[Points Admin] [Add Points] Twitch - Added To {user} by {addedBy} => {currentPoints} + {amountToAdd} = {newPoints}");
        }else{

            return false;
        }

        return true;
    }

    public bool SetPointsYouTube()
    {
        string id;
        long? amountToSet = GetPointsFromRawInput("input0");
        if(amountToSet == null)
        {
            return false;
        }
        string varName = "points";
        bool persisted = true;
        CPH.TryGetArg("usersFound",out int usersFound);
        CPH.TryGetArg("targetUserName", out string target);
        for (int i = 0; i < usersFound; i++)
        {
            CPH.TryGetArg($"targetFoundUserId{i}", out id);
            //Get and Add Points
            CPH.SetYouTubeUserVarById(id, varName, amountToSet, persisted);
            //Log Info
            CPH.LogInfo($"[Points Admin] [Set Points] YouTube - {target}/{id} => {amountToSet}");
            //Set Arguments
            CPH.SetArgument("target", target);
            CPH.SetArgument("points", amountToSet);
			//Send Message
			//CPH.SendYouTubeMessage($"{target} has been set to {pointsToAdd}");
        }

        return true;
    }
    public bool AddPointsYouTube()
    {
        string id;
        long? pointsToAdd = GetPointsFromRawInput("input0");
        if(pointsToAdd == null)
        {
            return false;
        }
        string varName = "points";
        bool persisted = true;
        CPH.TryGetArg("usersFound",out int usersFound);
        CPH.TryGetArg("targetUserName",out string target);
        int failCount = 0;
        long? newPoints = 0; 
        for (int i = 0; i < usersFound ; i++)
        {
        	CPH.TryGetArg($"targetFoundUserId{i}", out id);
        	//Get and Add Points
            long? points = GetUserPoints(id,target,"youtube",varName);
            if(points != null)
            {
                newPoints = pointsToAdd + points;
                CPH.SetYouTubeUserVarById(id, varName,newPoints, persisted);
                //Log Info
                CPH.LogInfo($"[Points Admin] [Add Points] YouTube - {target}/{id} => {points} + {pointsToAdd} = {newPoints}");

            }else{
                failCount +=1;
            }
        }
        if(failCount==usersFound)
        {
            CPH.LogError($"[Points Admin] [Add Points] YouTube - All found users had non numeric points values. Stopping action.");
        }else{
            //Set Arguments
            CPH.SetArgument("target", target);
            CPH.SetArgument("pointsToAdd",pointsToAdd);
            CPH.SetArgument("newPoints", newPoints);
        }
        return failCount<usersFound;
    }

    public bool SetPointsTrovo()
    {
        //Pull in info!
        CPH.TryGetArg("targetUserId", out string userId);
        CPH.TryGetArg("targetUser", out string user);
        CPH.TryGetArg("user", out string addedBy);
        long? amountToSet = GetPointsFromRawInput("input0");
        if(amountToSet == null)
        {
            return false;
        }
        //Add Points
        CPH.SetTrovoUserVar(user, "points", amountToSet, true);
        //Set Args For Output Message
        CPH.SetArgument("points", amountToSet);
        CPH.SetArgument("addedBy", addedBy);
        CPH.SetArgument("addedTo", user);
        CPH.LogInfo($"[Points Admin] [Add Points] Trovo - Set To {user} by {addedBy} => {amountToSet}");
        return true;
    }
    public bool AddPointsTrovo()
    {
        //Pull in info!
        CPH.TryGetArg("targetUserId", out string userId);
        CPH.TryGetArg("targetUser", out string user);
        CPH.TryGetArg("user", out string addedBy);
        long? amountToAdd = GetPointsFromRawInput("input0");
        
        //Add Points
        long? currentPoints = GetUserPoints(userId,user,"trovo");
        if(currentPoints != null && amountToAdd != null)
        {
            long? newPoints = currentPoints + amountToAdd;
            CPH.SetTrovoUserVar(user, "points", newPoints, true);
            //Set Args For Output Message
            CPH.SetArgument("newPoints", newPoints);
            CPH.SetArgument("oldPoints", currentPoints);
            CPH.SetArgument("pointsAdded", amountToAdd);
            CPH.SetArgument("addedBy", addedBy);
            CPH.SetArgument("addedTo", user);
            CPH.LogInfo($"[Points Admin] [Add Points] Trovo - Added To {user} by {addedBy} => {currentPoints} + {amountToAdd} = {newPoints}");
        }else{
            return false;
        }
        return true;
    }

    public bool SetPointsDiscord()
    {
        string userKey = ResolveDiscordPointUserKey();
        string varName = GetPointVarName();
        string user = GetStringArg("discordUserName", GetStringArg("user", userKey));
        long? amountToSet = GetPointsAmount();
        if (string.IsNullOrWhiteSpace(userKey) || amountToSet == null)
        {
            SetDiscordPointArgs(userKey, varName, 0, 0, amountToSet ?? 0, 0, false, "missing-user-or-amount");
            return false;
        }

        long before = GetDiscordUserPoints(userKey, varName);
        SetDiscordUserPoints(userKey, amountToSet.Value, varName);
        SetDiscordPointArgs(userKey, varName, before, amountToSet.Value, 0, amountToSet.Value - before, true, "");
        CPH.SetArgument("points", amountToSet.Value);
        CPH.SetArgument("addedTo", user);
        CPH.LogInfo($"[Points Admin] [Set Points] Discord - Set {user}({userKey}) => {amountToSet}");
        return true;
    }

    public bool AddPointsDiscord()
    {
        string userKey = ResolveDiscordPointUserKey();
        string varName = GetPointVarName();
        string user = GetStringArg("discordUserName", GetStringArg("user", userKey));
        long? amountToAdd = GetPointsAmount();
        if (string.IsNullOrWhiteSpace(userKey) || amountToAdd == null || amountToAdd == 0)
        {
            SetDiscordPointArgs(userKey, varName, 0, 0, 0, amountToAdd ?? 0, false, "missing-user-or-amount");
            return false;
        }

        long before = GetDiscordUserPoints(userKey, varName);
        long after = Math.Max(0, before + amountToAdd.Value);
        SetDiscordUserPoints(userKey, after, varName);
        SetDiscordPointArgs(userKey, varName, before, after, 0, amountToAdd.Value, true, "");
        CPH.SetArgument("newPoints", after);
        CPH.SetArgument("oldPoints", before);
        CPH.SetArgument("pointsAdded", amountToAdd.Value);
        CPH.SetArgument("addedTo", user);
        CPH.LogInfo($"[Points Admin] [Add Points] Discord - Added To {user}({userKey}) => {before} + {amountToAdd} = {after}");
        return true;
    }

    public bool CheckPointsDiscord()
    {
        string userKey = ResolveDiscordPointUserKey();
        string varName = GetPointVarName();
        long cost = GetPointCost();
        long balance = string.IsNullOrWhiteSpace(userKey) ? 0 : GetDiscordUserPoints(userKey, varName);
        bool approved = !string.IsNullOrWhiteSpace(userKey) && balance >= cost;

        SetDiscordPointArgs(userKey, varName, balance, balance, cost, 0, approved, approved ? "" : "insufficient-points");
        CPH.LogInfo($"[Points Admin] [Check Points] Discord - User={userKey} Balance={balance} Cost={cost} Approved={approved}");
        return true;
    }

    public bool GetPointsDiscord()
    {
        string userKey = ResolveDiscordPointUserKey();
        string varName = GetPointVarName();
        if (string.IsNullOrWhiteSpace(userKey))
        {
            SetDiscordPointArgs("", varName, 0, 0, 0, 0, false, "missing-user");
            return false;
        }

        long balance = GetDiscordUserPoints(userKey, varName);
        SetDiscordPointArgs(userKey, varName, balance, balance, 0, 0, true, "");
        CPH.LogInfo($"[Points Admin] [Get Points] Discord - User={userKey} Balance={balance}");
        return true;
    }

    public bool SpendPointsDiscord()
    {
        string userKey = ResolveDiscordPointUserKey();
        string varName = GetPointVarName();
        long cost = GetPointCost();
        if (string.IsNullOrWhiteSpace(userKey))
        {
            SetDiscordPointArgs("", varName, 0, 0, cost, 0, false, "missing-user");
            return false;
        }

        long before = GetDiscordUserPoints(userKey, varName);
        if (before < cost)
        {
            SetDiscordPointArgs(userKey, varName, before, before, cost, 0, false, "insufficient-points");
            CPH.LogInfo($"[Points Admin] [Spend Points] Discord denied - User={userKey} Balance={before} Cost={cost}");
            return true;
        }

        long after = Math.Max(0, before - cost);
        SetDiscordUserPoints(userKey, after, varName);
        SetDiscordPointArgs(userKey, varName, before, after, cost, -cost, true, "");
        CPH.LogInfo($"[Points Admin] [Spend Points] Discord - User={userKey} Balance={before} -> {after} Cost={cost}");
        return true;
    }

    public bool ResetAllUserPoints()
    {
        CPH.UnsetAllUsersVar("points", true);
        CPH.LogInfo("[Points Admin] [Points Resetter] Points have been reset");
        return true;
    }
    public bool AddWatchPoints()
    {
        CPH.TryGetArg("pointsGivenPerTick", out long pointsToAdd);
        CPH.TryGetArg("isLive", out bool live);
        CPH.TryGetArg("eventSource", out string platform);
        //List<Dictionary<string,object>> users = null;
        //CPH.TryGetArg("users", out List<Dictionary<string,object>> users);
        List<Dictionary<string,object>> users = (List<Dictionary<string,object>>)args["users"];
        //CPH.LogInfo(platform +" "+ users.Count);
        CPH.LogInfo($"[Points Admin] [Present Viewers] WARN Starting Present Viewers from {platform}");
        long? points;
        string userId;
        if (live)
        {
        	
			for (int i = 0; i < users.Count; i++)
            {
                // Read in current points and add 1
                userId = users[i]["id"].ToString();
                string userName = users[i]["userName"].ToString();
                //CPH.LogInfo($"[Points Admin] [Present Viewers] {currentuser}/{userName}");
                
                points = GetUserPoints(userId, userName, platform);
                if(points != null)
                {
                    points += pointsToAdd;
                    SetUserPoints(userId, platform, points);
                }
            }
        }

        CPH.LogInfo($"[Points Admin] [Present Viewers] WARN Ended Present Viewers from {platform}");
        return true;
    }
    
    public long? GetUserPoints(string userId,string userName,string platform,string varName = "points")
    {
        long? points = null;
        try{
            switch(platform)
            {
                case "twitch":
                    points = CPH.GetTwitchUserVarById<long?>(userId, "points", true) ?? 0;
                    break;
                case "youtube":
                    points = CPH.GetYouTubeUserVarById<long?>(userId, "points", true) ?? 0;
                    break;
                case "trovo":
                    points = CPH.GetTrovoUserVarById<long?>(userId, "points", true) ?? 0;
                    break;
                case "discord":
                    points = GetDiscordUserPoints(userId, varName);
                    break;
            }
        }catch(Exception e)
        {
            CPH.LogError($"[Points Admin] [Present Viewers] Error getting points value for {platform} user {userName}({userId})");
        }
        return points;
    }
    
    public void SetUserPoints(string userId, string platform, long? points)
    {
        if(points != null)
        {
            switch(platform)
            {
                case "twitch":
                    CPH.SetTwitchUserVarById(userId, "points", points, true);
                    break;
                case "youtube":
                    CPH.SetYouTubeUserVarById(userId, "points", points, true);
                    break;
                case "trovo":
                    CPH.SetTrovoUserVarById(userId, "points", points, true);
                    break;
                case "discord":
                    SetDiscordUserPoints(userId, points.Value);
                    break;
            }
        }
    }

    public bool SendPlatformMessage()
    {
        CPH.TryGetArg("userType", out string platformString);
        if (string.IsNullOrWhiteSpace(platformString))
            platformString = GetStringArg("platform", "");
        CPH.TryGetArg("bot", out bool bot);
        CPH.TryGetArg("message", out string message);

        if (string.Equals(platformString, "discord", StringComparison.OrdinalIgnoreCase))
            return SendDiscordMessage(message);

        Enum.TryParse(platformString, true, out Platform platform);
        switch (platform)
        {
            case Platform.Twitch:
                CPH.SendMessage(message, bot);
                break;
            case Platform.YouTube:
                CPH.SendYouTubeMessage(message, bot);
                break;
            case Platform.Trovo:
                CPH.SendTrovoMessage(message, bot);
                break;
        }

        return true;
    }

    private bool SendDiscordMessage(string message)
    {
        string channelId = GetStringArg("discordChannelId", GetStringArg("channelId", ""));
        string replyToMessageId = GetStringArg("replyToMessageId", GetStringArg("discordMessageId", ""));

        if (string.IsNullOrWhiteSpace(channelId))
        {
            CPH.LogError("[Points Admin] [Send Platform Message] Discord missing discordChannelId/channelId.");
            CPH.SetArgument("discordSendOk", false);
            CPH.SetArgument("discordSendError", "Missing discordChannelId/channelId");
            return false;
        }

        if (string.IsNullOrWhiteSpace(message))
            message = GetStringArg("discordMessageText", GetStringArg("responseMessage", GetStringArg("pointsResponseMessage", "")));

        if (string.IsNullOrWhiteSpace(message))
        {
            CPH.LogError("[Points Admin] [Send Platform Message] Discord missing message.");
            CPH.SetArgument("discordSendOk", false);
            CPH.SetArgument("discordSendError", "Missing message");
            return false;
        }

        string bearerToken = GetStringGlobal("st_bearerToken", "");
        if (string.IsNullOrWhiteSpace(bearerToken))
        {
            CPH.LogError("[Points Admin] [Send Platform Message] Discord missing Streamer.bot global st_bearerToken.");
            CPH.SetArgument("discordSendOk", false);
            CPH.SetArgument("discordSendError", "Missing st_bearerToken");
            return false;
        }

        string apiBaseUrl = GetStringGlobal("st_apiBaseUrl", "http://127.0.0.1:3030");
        string json =
            "{"
            + "\"channelId\":\"" + EscapeJson(channelId) + "\","
            + "\"replyToMessageId\":\"" + EscapeJson(replyToMessageId) + "\","
            + "\"message\":\"" + EscapeJson(message) + "\""
            + "}";

        try
        {
            var request = (HttpWebRequest)WebRequest.Create(NormalizeBaseUrl(apiBaseUrl) + "/api/discord/send-message");
            request.Method = "POST";
            request.ContentType = "application/json";
            request.Timeout = 5000;
            request.ReadWriteTimeout = 5000;
            request.Headers["Authorization"] = "Bearer " + bearerToken;

            byte[] data = Encoding.UTF8.GetBytes(json);
            request.ContentLength = data.Length;

            using (Stream stream = request.GetRequestStream())
            {
                stream.Write(data, 0, data.Length);
            }

            using (var response = (HttpWebResponse)request.GetResponse())
            {
                CPH.LogInfo("[Points Admin] [Send Platform Message] Discord sent message to channel " + channelId + ". Status=" + response.StatusCode);
            }

            CPH.SetArgument("discordSendOk", true);
            CPH.SetArgument("discordSendError", "");
            return true;
        }
        catch (Exception ex)
        {
            CPH.LogError("[Points Admin] [Send Platform Message] Discord failed: " + ex.Message);
            CPH.SetArgument("discordSendOk", false);
            CPH.SetArgument("discordSendError", ex.Message);
            return false;
        }
    }

    public long? GetPointsFromRawInput(string argName)
    {
        CPH.TryGetArg(argName, out string argOut);
        if(!Int64.TryParse(argOut, out long result))
        {
            CPH.LogError($"[Points Admin] Error parsing {argName} argument into numeric long.");
            return null;
        }
        return result;
    }

    private string ResolveDiscordPointUserKey()
    {
        string directKey = GetStringArg("pointUserKey", "");
        if (!string.IsNullOrWhiteSpace(directKey))
            return directKey.Trim();

        string discordUserId = GetStringArg("discordUserId", "");
        if (!string.IsNullOrWhiteSpace(discordUserId))
            return "discord:" + discordUserId.Trim();

        string userName = GetStringArg("userName", "");
        if (!string.IsNullOrWhiteSpace(userName))
            return userName.Trim();

        string user = GetStringArg("user", GetStringArg("displayName", ""));
        return user.Trim();
    }

    private long GetDiscordUserPoints(string userKey, string varName = "points")
    {
        try
        {
            object cph = CPH;
            System.Reflection.MethodInfo method = FindCphMethod("GetUserVar", 3, true);
            if (method == null)
                return 0;

            object value = method.MakeGenericMethod(typeof(long)).Invoke(cph, new object[] { userKey, varName, true });
            long parsed;
            return Int64.TryParse(Convert.ToString(value), out parsed) ? Math.Max(0, parsed) : 0;
        }
        catch
        {
            return 0;
        }
    }

    private void SetDiscordUserPoints(string userKey, long points, string varName = "points")
    {
        try
        {
            object cph = CPH;
            System.Reflection.MethodInfo method = FindCphMethod("SetUserVar", 4, false);
            if (method != null)
            {
                method.Invoke(cph, new object[] { userKey, varName, Math.Max(0, points), true });
                return;
            }

            method = FindCphMethod("SetUserVar", 4, true);
            if (method != null)
            {
                method.MakeGenericMethod(typeof(long)).Invoke(cph, new object[] { userKey, varName, Math.Max(0, points), true });
                return;
            }

            CPH.LogError("[Points Admin] [Discord] Could not find compatible SetUserVar method.");
        }
        catch (Exception ex)
        {
            CPH.LogError($"[Points Admin] [Discord] Failed to persist points for {userKey}: {ex.Message}");
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
            if (mustBeGeneric && !method.IsGenericMethodDefinition)
                continue;
            if (!mustBeGeneric && method.IsGenericMethodDefinition)
                continue;

            return method;
        }

        return null;
    }

    private long? GetPointsAmount()
    {
        string text = GetStringArg("points", GetStringArg("amount", ""));
        if (string.IsNullOrWhiteSpace(text))
            return GetPointsFromRawInput("input0");

        long parsed;
        if (Int64.TryParse(text, out parsed))
            return parsed;

        CPH.LogError("[Points Admin] Error parsing points/amount argument into numeric long.");
        return null;
    }

    private long GetPointCost()
    {
        return Math.Max(0,
            GetLongArg("pointCost",
                GetLongArg("redeemCost",
                    GetLongArg("discordRedeemPointCost",
                        GetLongArg("points", 0)))));
    }

    private void SetDiscordPointArgs(string userKey, string varName, long before, long after, long cost, long delta, bool approved, string reason)
    {
        string pointName = GetPointDisplayName();
        string displayName = GetStringArg("discordUserName", GetStringArg("user", GetStringArg("displayName", userKey)));
        string redeemLabel = GetStringArg("discordRedeemLabel", "that");
        string responseMessage = reason == "insufficient-points"
            ? displayName + " You don't have enough " + pointName + "s to redeem " + redeemLabel + ", you only have " + before + " " + pointName + "s."
            : "";

        SetPointSettingsArgs(varName, pointName);
        CPH.SetArgument("pointUserKey", userKey);
        CPH.SetArgument("pointsApproved", approved);
        CPH.SetArgument("pointsBalance", after);
        CPH.SetArgument("pointsBalanceBefore", before);
        CPH.SetArgument("pointsBalanceAfter", after);
        CPH.SetArgument("pointsCost", cost);
        CPH.SetArgument("pointsDelta", delta);
        CPH.SetArgument("pointsFailureReason", reason);
        CPH.SetArgument("pointsDeniedReason", reason);
        CPH.SetArgument("pointsShortfall", approved ? 0 : Math.Max(0, cost - before));
        CPH.SetArgument("pointsResponseMessage", responseMessage);
        CPH.SetArgument("points", after);
        CPH.SetArgument(varName, after);

        PostPointSnapshot(userKey, varName, before, after, cost, delta, approved, reason, "points");
    }

    private string GetPointVarName()
    {
        return SanitizeVarName(GetStringGlobal("st_pointVarName", DefaultPointVarName));
    }

    private string GetPointDisplayName()
    {
        return GetStringGlobal("st_pointDisplayName", DefaultPointDisplayName);
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

    private void PostPointSnapshot(string userKey, string varName, long before, long after, long cost, long delta, bool approved, string reason, string snapshotType)
    {
        string requestId = GetStringArg("streamToolsRequestId", "");
        if (string.IsNullOrWhiteSpace(requestId))
            return;

        string bearerToken = GetStringGlobal("st_bearerToken", "");
        if (string.IsNullOrWhiteSpace(bearerToken))
        {
            CPH.LogError("[Points Admin] Missing Streamer.bot global st_bearerToken. Cannot post admin callback.");
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
            CPH.LogError("[Points Admin] Failed to post admin callback: " + ex.Message);
        }
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

    private long GetLongArg(string name, long fallback)
    {
        try
        {
            long value;
            if (CPH.TryGetArg(name, out value))
                return value;

            int intValue;
            if (CPH.TryGetArg(name, out intValue))
                return intValue;

            string text;
            if (CPH.TryGetArg(name, out text))
            {
                long parsed;
                if (Int64.TryParse((text ?? "").Trim(), out parsed))
                    return parsed;
            }

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

    public bool GetYouTubeTarget()
    {
        //Direct check if input0 is numeric at all if not cancel action
        long? input0 = GetPointsFromRawInput("input0");
        if(input0 == null)
        {
            return false;
        }
        //This is pulling in the Info Given
        CPH.TryGetArg("rawInput", out string rawInput);
        CPH.TryGetArg("inputsTaken", out long inputsToRemove);
        //This removes the '@' symbol if one was given
        //string atSignRemoved = rawInput.Replace("@", string.Empty);
        //This Removes Inputs we dont need
        string textRemove = "";
        for (int i = 0; i < inputsToRemove; i++)
        {
            CPH.TryGetArg("input" + i, out string moreInput);
            textRemove += moreInput;
        }

        //This now works out the username we are trying to find
        string youtubeUserName = rawInput.Remove(0, textRemove.Length + ((int)inputsToRemove + 1 - 1));
        if(youtubeUserName[0] == '@')
        {
            youtubeUserName = youtubeUserName.Remove(0,1);
        }
        //Sets the Argument
        CPH.SetArgument("targetUserName", youtubeUserName);
        //Logs the Info
        CPH.LogInfo($"[Points Admin] [Add Points] YouTube - Text Removed: {textRemove} => User To Hande: {youtubeUserName} ");
        //Creates a New List for the found users to go into.
        List<Tuple<string, string>> userList = new List<Tuple<string, string>>();
        //This pulls all the users who have Points
        List<UserVariableValue<string>> userPointsList = CPH.GetYouTubeUsersVar<string>("points", true);
        //This then goes through each one and works out if we have a match.
        foreach (UserVariableValue<string> userValue in userPointsList)
        {
            string username = userValue.UserLogin;
            if (youtubeUserName.ToLower() == username.ToLower())
            {
                //check wether the value is valid for long
                if(Int64.TryParse(userValue.Value, out _))
                {
                    userList.Add(new Tuple<string, string>(username, userValue.UserId));
                    CPH.LogInfo($"[Points Admin] YouTube - {username} with the ID  of {userValue.UserId} has been found");
                }else{
                    CPH.LogError($"[Points Admin] YouTube - {username} with the ID  of {userValue.UserId} has a not numeric points value. Needs to be fixed.");
                }

            }
        }

        //This Goes through list and sets arguments.
        int d = 0;
        foreach (Tuple<string, string> users in userList)
        {
            CPH.SetArgument("targetFoundUserName" + d, users.Item1);
            CPH.SetArgument("targetFoundUserId" + d, users.Item2);
            d+=1;
        }

        //This Just saves the count and logs info!
        CPH.SetArgument("usersFound", userList.Count);
        CPH.LogInfo($"[Points Admin] [Add Points] YouTube - {userList.Count} users have been found!");
        return true;
    }
}
