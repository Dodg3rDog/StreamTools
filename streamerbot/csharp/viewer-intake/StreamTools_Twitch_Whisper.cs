using System;
using System.IO;
using System.Net;
using System.Text;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

public class CPHInline
{
    // Action name: StreamTools Twitch Whisper
    // Triggers: Twitch > Chat > Bot Whispers, and Twitch > Chat > Message.
    // Commands are checked here; unrelated messages are ignored.
    public bool Execute()
    {
        string reply = Arg("whisperText");
        string target = Arg("whisperUser");
        if (!String.IsNullOrEmpty(reply) && !String.IsNullOrEmpty(target))
        {
            CPH.SendWhisper(target, reply, true);
            return true;
        }
        string message = Arg("message");
        if (String.IsNullOrWhiteSpace(message)) message = Arg("rawInput");
        string command = message.Trim().ToLowerInvariant();
        if (command != "!chatsona" && command != "!commission" && command != "!commissions") return true;
        string login = Arg("userName");
        if (String.IsNullOrEmpty(login)) login = Arg("user");
        if (login.Equals("dodg3r_bot", StringComparison.OrdinalIgnoreCase)) return true;
        string token = CPH.GetGlobalVar<string>("st_bearerToken", true);
        string api = CPH.GetGlobalVar<string>("st_apiBaseUrl", true);
        if (String.IsNullOrEmpty(api)) api = "http://192.168.1.131:3030";
        if (String.IsNullOrEmpty(token)) { CPH.LogError("[Viewer intake] Missing st_bearerToken global."); return false; }
        try
        {
            var request = (HttpWebRequest)WebRequest.Create(api.TrimEnd('/') + "/api/twitch/command");
            request.Method = "POST"; request.ContentType = "application/json";
            request.Headers["Authorization"] = "Bearer " + token;
            request.Timeout = 10000;
            var bytes = Encoding.UTF8.GetBytes(JsonConvert.SerializeObject(new { message = command, userId = Arg("userId"), userName = login }));
            using (var stream = request.GetRequestStream()) stream.Write(bytes, 0, bytes.Length);
            using (var response = request.GetResponse())
            using (var reader = new StreamReader(response.GetResponseStream()))
            {
                var result = JObject.Parse(reader.ReadToEnd());
                string text = (string)result["reply"];
                if (!String.IsNullOrEmpty(text)) CPH.SendWhisper(login, text, true);
            }
            return true;
        }
        catch { CPH.LogError("[Viewer intake] Request failed. Check StreamTools connectivity and authentication."); return false; }
    }
    private string Arg(string name) { object value; return CPH.TryGetArg(name, out value) && value != null ? value.ToString() : ""; }
}
