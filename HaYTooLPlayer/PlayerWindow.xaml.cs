using System;
using System.IO;
using System.Runtime.InteropServices;
using System.Windows;

namespace HaYTooLPlayer
{
    [ComVisible(true)]
    public class PlayerWindowBridge
    {
        private readonly PlayerWindow _window;
        public PlayerWindowBridge(PlayerWindow window)
        {
            _window = window;
        }

        public void close()
        {
            _window.Dispatcher.Invoke(() =>
            {
                _window.Close();
            });
        }

        public double getResumeTime(string videoId)
        {
            try
            {
                string appData = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "HaYTooLPlayer");
                string jsonPath = Path.Combine(appData, "resume.json");
                if (File.Exists(jsonPath))
                {
                    string json = File.ReadAllText(jsonPath);
                    string searchKey = "\"" + videoId + "\":";
                    int idx = json.IndexOf(searchKey);
                    if (idx != -1)
                    {
                        int valStart = idx + searchKey.Length;
                        int commaIdx = json.IndexOf(",", valStart);
                        int braceIdx = json.IndexOf("}", valStart);
                        int endIdx = commaIdx != -1 ? Math.Min(commaIdx, braceIdx) : braceIdx;
                        string valStr = json.Substring(valStart, endIdx - valStart).Trim();
                        if (double.TryParse(valStr, System.Globalization.NumberStyles.Any, System.Globalization.CultureInfo.InvariantCulture, out double result))
                        {
                            return result;
                        }
                    }
                }
            }
            catch {}
            return 0;
        }

        public void saveResumeTime(string videoId, double time)
        {
            try
            {
                string appData = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "HaYTooLPlayer");
                if (!Directory.Exists(appData)) Directory.CreateDirectory(appData);
                string jsonPath = Path.Combine(appData, "resume.json");

                System.Collections.Generic.Dictionary<string, double> resumeData = new System.Collections.Generic.Dictionary<string, double>();
                if (File.Exists(jsonPath))
                {
                    try
                    {
                        string json = File.ReadAllText(jsonPath);
                        int index = 0;
                        while ((index = json.IndexOf("\"", index)) != -1)
                        {
                            int keyEnd = json.IndexOf("\"", index + 1);
                            if (keyEnd == -1) break;
                            string key = json.Substring(index + 1, keyEnd - index - 1);
                            int colon = json.IndexOf(":", keyEnd);
                            if (colon == -1) break;
                            int comma = json.IndexOf(",", colon);
                            int brace = json.IndexOf("}", colon);
                            int valEnd = comma != -1 ? Math.Min(comma, brace) : brace;
                            if (valEnd == -1) break;
                            string valStr = json.Substring(colon + 1, valEnd - colon - 1).Trim();
                            if (double.TryParse(valStr, System.Globalization.NumberStyles.Any, System.Globalization.CultureInfo.InvariantCulture, out double val))
                            {
                                resumeData[key] = val;
                            }
                            index = valEnd;
                        }
                    }
                    catch {}
                }

                if (time <= 0)
                {
                    if (resumeData.ContainsKey(videoId)) resumeData.Remove(videoId);
                }
                else
                {
                    resumeData[videoId] = time;
                }

                var sb = new System.Text.StringBuilder();
                sb.Append("{");
                bool first = true;
                foreach (var kvp in resumeData)
                {
                    if (!first) sb.Append(",");
                    first = false;
                    sb.AppendFormat(System.Globalization.CultureInfo.InvariantCulture, "\"{0}\":{1}", kvp.Key, kvp.Value);
                }
                sb.Append("}");
                File.WriteAllText(jsonPath, sb.ToString());
            }
            catch {}
        }
    }

    public partial class PlayerWindow : Window
    {
        private readonly string _filePath;
        private readonly string _title;
        private readonly string _channelName;
        private readonly string _publishDate;
        private readonly string _videoId;
        private readonly string _serverUrl;

        public PlayerWindow(string filePath, string title, string channelName, string publishDate, string videoId, string serverUrl)
        {
            InitializeComponent();
            _filePath = filePath;
            _title = title;
            _channelName = channelName;
            _publishDate = publishDate;
            _videoId = videoId;
            _serverUrl = serverUrl;

            // Pencere başlığını ayarla: Video Adı - Kanal Adı - Yüklenme Tarihi
            string formattedTitle = title;
            if (!string.IsNullOrEmpty(channelName)) formattedTitle += " - " + channelName;
            if (!string.IsNullOrEmpty(publishDate)) formattedTitle += " - " + publishDate;
            this.Title = formattedTitle;

            InitializeAsync();
        }

        private async void InitializeAsync()
        {
            try
            {
                // CoreWebView2Environment ile CORS'u devre dışı bırak ve otomatik oynatma politikasını bypass et
                string userDataFolder = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "HaYTooLPlayer");
                var options = new Microsoft.Web.WebView2.Core.CoreWebView2EnvironmentOptions("--disable-web-security --autoplay-policy=no-user-gesture-required");
                var env = await Microsoft.Web.WebView2.Core.CoreWebView2Environment.CreateAsync(null, userDataFolder, options);

                // WebView2 Başlat
                await playerWebView.EnsureCoreWebView2Async(env);

                // Tarayıcı ayarlarını yapılandır
                playerWebView.CoreWebView2.Settings.AreDefaultContextMenusEnabled = false;
                playerWebView.CoreWebView2.Settings.AreDevToolsEnabled = false;
                playerWebView.CoreWebView2.Settings.IsStatusBarEnabled = false;

                // Tam ekran isteklerini dinle ve C# penceresini tam ekran yap
                playerWebView.CoreWebView2.ContainsFullScreenElementChanged += CoreWebView2_ContainsFullScreenElementChanged;

                // Kısayollar ve pencere kapatma için C# Köprüsünü (Bridge) kaydet
                playerWebView.CoreWebView2.AddHostObjectToScript("windowBridge", new PlayerWindowBridge(this));

                // Video dizinindeki VTT ve SRT altyazı dosyalarını tara ve Data URI formatında yükle (CORS kısıtlamalarını aşmak için)
                string videoDir = Path.GetDirectoryName(_filePath) ?? "";
                string filenameWithoutExt = Path.GetFileNameWithoutExtension(_filePath);
                string trackTags = "";

                if (Directory.Exists(videoDir))
                {
                    string[] files = Directory.GetFiles(videoDir, filenameWithoutExt + ".*");
                    foreach (string file in files)
                    {
                        string ext = Path.GetExtension(file).ToLower();
                        if (ext == ".vtt" || ext == ".srt")
                        {
                            string part = Path.GetFileNameWithoutExtension(file);
                            string langCode = "tr";
                            if (part.Contains("."))
                            {
                                langCode = part.Substring(part.LastIndexOf('.') + 1);
                            }
                            string label = langCode.ToUpper();
                            if (langCode == "tr") label = "Türkçe (TR)";
                            else if (langCode == "en") label = "English (EN)";

                            try
                            {
                                string vttContent = "";
                                if (ext == ".srt")
                                {
                                    // SRT formatını VTT'ye çevir (Zaman damgası virgüllerini noktalara çevir)
                                    string srtContent = File.ReadAllText(file, System.Text.Encoding.UTF8);
                                    vttContent = "WEBVTT\r\n\r\n" + System.Text.RegularExpressions.Regex.Replace(
                                        srtContent, 
                                        @"(\d{2}:\d{2}:\d{2}),(\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}),(\d{3})", 
                                        "$1.$2 --> $3.$4"
                                    );
                                }
                                else
                                {
                                    vttContent = File.ReadAllText(file, System.Text.Encoding.UTF8);
                                }

                                string base64 = Convert.ToBase64String(System.Text.Encoding.UTF8.GetBytes(vttContent));
                                string subUri = "data:text/vtt;base64," + base64;

                                trackTags += $"<track kind=\"subtitles\" label=\"{label}\" srclang=\"{langCode}\" src=\"{subUri}\"{(langCode == "tr" ? " default" : "")}>\n";
                            }
                            catch (Exception ex)
                            {
                                System.Diagnostics.Debug.WriteLine("Altyazı okuma hatası: " + ex.Message);
                            }
                        }
                    }
                }

                // C# local disk okuması (Çevrimdışı/Yerel desteği için)
                string localDesc = "";
                try
                {
                    string descFile = Path.ChangeExtension(_filePath, ".description");
                    if (File.Exists(descFile))
                    {
                        localDesc = File.ReadAllText(descFile, System.Text.Encoding.UTF8);
                    }
                }
                catch {}

                string localDescBase64 = Convert.ToBase64String(System.Text.Encoding.UTF8.GetBytes(localDesc));

                // Plyr ve video dosyası yolları
                string appRootDir = Path.GetDirectoryName(AppDomain.CurrentDomain.BaseDirectory.TrimEnd(Path.DirectorySeparatorChar)) ?? "";
                string plyrCssUri = new Uri(Path.Combine(appRootDir, "public", "plyr.css")).AbsoluteUri;
                string plyrJsUri = new Uri(Path.Combine(appRootDir, "public", "plyr.min.js")).AbsoluteUri;
                string videoUri = new Uri(_filePath).AbsoluteUri;

                // Plyr player şablonu oluştur
                string htmlContent = $@"
<!DOCTYPE html>
<html>
<head>
    <meta charset=""utf-8"">
    <link rel=""stylesheet"" href=""{plyrCssUri}"">
    <style>
        body, html {{
            margin: 0; padding: 0; width: 100%; height: 100%;
            background-color: black; overflow: hidden;
            font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            color: #f4f4f5;
        }}
        #app-container {{
            display: flex;
            width: 100%;
            height: 100%;
        }}
        #video-container {{
            flex-grow: 1;
            height: 100%;
            background-color: black;
            display: flex;
            justify-content: center;
            align-items: center;
            position: relative;
        }}
        .plyr {{
            width: 100% !important; height: 100% !important;
        }}
        .plyr__video-wrapper {{
            background-color: black !important;
        }}
        
        /* Sidebar Styling */
        .sidebar {{
            width: 320px;
            min-width: 320px;
            max-width: 320px;
            height: 100%;
            background: #111113;
            border-left: 1px solid rgba(255, 255, 255, 0.08);
            display: flex;
            flex-direction: column;
            transition: margin-right 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }}
        .sidebar.hidden {{
            margin-right: -320px;
        }}
        
        .sidebar-header {{
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 10px 15px;
            border-bottom: 1px solid rgba(255, 255, 255, 0.08);
            background: #161619;
        }}
        .tab-buttons {{
            display: flex;
            gap: 10px;
        }}
        .tab-btn {{
            background: transparent;
            color: #a1a1aa;
            border: none;
            padding: 6px 12px;
            font-size: 13px;
            font-weight: 600;
            cursor: pointer;
            border-radius: 4px;
            transition: all 0.2s;
        }}
        .tab-btn.active {{
            background: rgba(255, 255, 255, 0.08);
            color: #f4f4f5;
        }}
        .tab-btn:hover {{
            color: #f4f4f5;
        }}
        .close-sidebar-btn {{
            background: transparent;
            border: none;
            color: #a1a1aa;
            font-size: 20px;
            cursor: pointer;
            padding: 0 5px;
        }}
        .close-sidebar-btn:hover {{
            color: white;
        }}
        
        .sidebar-body {{
            flex-grow: 1;
            overflow: hidden;
            position: relative;
        }}
        .tab-content {{
            display: none;
            width: 100%;
            height: 100%;
            box-sizing: border-box;
        }}
        .tab-content.active {{
            display: flex;
            flex-direction: column;
        }}
        .scrollable-content {{
            flex-grow: 1;
            overflow-y: auto;
            padding: 15px;
            font-size: 13px;
            line-height: 1.5;
            color: #e4e4e7;
            white-space: pre-wrap;
        }}
        
        .custom-control-bar {{
            position: absolute;
            top: 15px;
            right: 15px;
            z-index: 1000;
            display: flex;
            gap: 10px;
            background: rgba(15, 15, 15, 0.7);
            backdrop-filter: blur(10px);
            -webkit-backdrop-filter: blur(10px);
            padding: 8px 12px;
            border-radius: 10px;
            border: 1px solid rgba(255, 255, 255, 0.1);
            transition: opacity 0.3s ease, transform 0.3s ease;
            opacity: 0.3;
        }}
        .custom-control-bar:hover {{
            opacity: 1.0;
        }}
        .custom-btn {{
            background: rgba(255, 255, 255, 0.08);
            color: #f4f4f5;
            border: none;
            padding: 6px 12px;
            border-radius: 6px;
            font-size: 13px;
            font-weight: 500;
            cursor: pointer;
            display: flex;
            align-items: center;
            gap: 6px;
            transition: background 0.2s ease, transform 0.1s ease;
            font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }}
        .custom-btn:hover {{
            background: rgba(255, 255, 255, 0.18);
        }}
        .custom-btn.active {{
            background: rgba(0, 179, 255, 0.2);
            color: #38bdf8;
            border: 1px solid rgba(0, 179, 255, 0.4);
        }}
        .custom-btn:active {{
            transform: scale(0.96);
        }}
        .custom-btn svg {{
            flex-shrink: 0;
        }}
        .custom-btn.danger {{
            background: rgba(239, 68, 68, 0.2);
            color: #fca5a5;
        }}
        .custom-btn.danger:hover {{
            background: rgba(239, 68, 68, 0.35);
            color: #fee2e2;
        }}
        
        /* Comments list styling */
        .comment-item {{
            margin-bottom: 10px;
            padding: 10px 12px;
            background: rgba(255, 255, 255, 0.02);
            border-radius: 8px;
            border: 1px solid rgba(255, 255, 255, 0.04);
        }}
        .comment-header {{
            display: flex;
            align-items: center;
            gap: 8px;
            margin-bottom: 4px;
        }}
        .comment-avatar {{
            width: 24px;
            height: 24px;
            border-radius: 50%;
            background: #27272a;
        }}
        .comment-author {{
            font-weight: 600;
            font-size: 12px;
            color: #f4f4f5;
        }}
        .comment-time {{
            font-size: 10px;
            color: #71717a;
        }}
        .comment-text {{
            font-size: 12px;
            color: #d4d4d8;
        }}
        .comment-likes {{
            font-size: 11px;
            display: flex;
            align-items: center;
            gap: 4px;
        }}

        /* OSD Styling */
        #osd-overlay {{
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%) scale(0.85);
            background: rgba(15, 15, 15, 0.85);
            backdrop-filter: blur(10px);
            -webkit-backdrop-filter: blur(10px);
            color: #f4f4f5;
            padding: 16px 28px;
            border-radius: 12px;
            font-size: 20px;
            font-weight: 600;
            z-index: 2000;
            pointer-events: none;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 10px;
            border: 1px solid rgba(255, 255, 255, 0.15);
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
            transition: opacity 0.15s ease, transform 0.15s cubic-bezier(0.175, 0.885, 0.32, 1.275);
            opacity: 0;
        }}
        #osd-overlay.osd-visible {{
            opacity: 1;
            transform: translate(-50%, -50%) scale(1);
        }}
    </style>
</head>
<body>
    <div id=""app-container"">
        <div id=""video-container"">
            <div id=""osd-overlay""></div>
            <div class=""custom-control-bar"">
                <button onclick=""toggleSidebar()"" id=""btn-toggle-sidebar"" class=""custom-btn"">
                    <svg viewBox=""0 0 24 24"" width=""16"" height=""16"" fill=""currentColor""><path d=""M21 4H3c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm-11 14H3V6h7v12zm11 0h-9V6h9v12z""/></svg>
                    Detaylar (Açıklama & Yorumlar)
                </button>
                <button onclick=""translateSubtitle()"" id=""btn-translate-sub"" class=""custom-btn"">
                    <svg viewBox=""0 0 24 24"" width=""16"" height=""16"" fill=""currentColor""><path d=""M12.87 15.07l-2.54-2.51.03-.03c1.74-1.94 2.98-4.17 3.71-6.53H17V4h-7V2H8v2H1v1.99h11.17C11.5 7.92 10.44 9.75 9 11.35 8.07 10.32 7.3 9.19 6.69 8h-2c.73 1.63 1.73 3.17 2.98 4.56l-5.09 5.02L4 19l5-5 3.11 3.11.76-2.04zM18.5 10h-2L12 22h2l1.12-3h4.75L21 22h2l-4.5-12zm-2.62 7l1.62-4.33L19.12 17h-3.24z""/></svg>
                    Altyazıyı Çevir
                </button>
                <button onclick=""deleteAndClose()"" id=""btn-delete-video"" class=""custom-btn danger"">
                    <svg viewBox=""0 0 24 24"" width=""16"" height=""16"" fill=""currentColor""><path d=""M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z""/></svg>
                    Sil ve Kapat
                </button>
            </div>

            <video id=""player"" playsinline controls autoplay style=""width: 100%; height: 100%;"">
                <source src=""{videoUri}"" type=""video/mp4"">
                {trackTags}
            </video>
        </div>
        <div id=""details-sidebar"" class=""sidebar hidden"">
            <div class=""sidebar-header"">
                <div class=""tab-buttons"">
                    <button onclick=""switchTab('desc')"" id=""tab-desc"" class=""tab-btn active"">Açıklama</button>
                    <button onclick=""switchTab('comments')"" id=""tab-comments"" class=""tab-btn"">Yorumlar</button>
                </div>
                <button onclick=""toggleSidebar()"" class=""close-sidebar-btn"">&times;</button>
            </div>
            <div class=""sidebar-body"">
                <div id=""content-desc"" class=""tab-content active"">
                    <div style=""padding: 15px; border-bottom: 1px solid rgba(255, 255, 255, 0.06);"">
                        <h4 id=""video-title-sidebar"" style=""margin: 0 0 8px 0; font-size: 14px; line-height: 1.4;""></h4>
                        <div id=""video-channel-sidebar"" style=""color: #38bdf8; font-weight: 600; font-size: 13px;""></div>
                        <div id=""video-date-sidebar"" style=""font-size: 11px; color: #71717a; margin-top: 4px;""></div>
                    </div>
                    <div id=""description-text"" class=""scrollable-content"">Yükleniyor...</div>
                </div>
                <div id=""content-comments"" class=""tab-content"">
                    <div id=""comments-list"" class=""scrollable-content"">Yükleniyor...</div>
                </div>
            </div>
        </div>
    </div>
    <script src=""{plyrJsUri}""></script>
    <script>
        const videoId = ""{_videoId}"";
        const SERVER_URL = ""{_serverUrl}"";

        let detailsLoaded = false;
        let osdTimeout = null;

        function escapeHtml(text) {{
            const div = document.createElement('div');
            div.innerText = text || '';
            return div.innerHTML;
        }}

        function linkifyTimestamps(text) {{
            return text.replace(/\b(?:(\d{{1,2}}):)?(\d{{1,2}}):(\d{{2}})\b/g, (match) => {{
                const parts = match.split(':').map(Number);
                let seconds = 0;
                if (parts.length === 2) {{
                    seconds = parts[0] * 60 + parts[1];
                }} else if (parts.length === 3) {{
                    seconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
                }}
                return `<span class=""timestamp-link"" data-time=""${{seconds}}"" style=""color: #38bdf8; cursor: pointer; text-decoration: underline; font-weight: 500;"">${{match}}</span>`;
            }});
        }}

        // Click listener for description timestamps
        document.getElementById('description-text').addEventListener('click', (e) => {{
            const link = e.target.closest('.timestamp-link');
            if (link && player) {{
                const secs = parseFloat(link.getAttribute('data-time'));
                player.currentTime = secs;
                showOSD('🔍 Konum: ' + link.innerText);
                player.play().catch(() => {{}});
            }}
        }});

        function getBridge() {{
            return new Promise((resolve) => {{
                const check = () => {{
                    if (window.chrome && window.chrome.webview && window.chrome.webview.hostObjects && window.chrome.webview.hostObjects.windowBridge) {{
                        resolve(window.chrome.webview.hostObjects.windowBridge);
                    }} else {{
                        setTimeout(check, 10);
                    }}
                }};
                check();
            }});
        }}

        // OSD Bildirimi Göster
        function showOSD(htmlContent) {{
            const osd = document.getElementById('osd-overlay');
            osd.innerHTML = htmlContent;
            osd.classList.add('osd-visible');
            
            if (osdTimeout) {{
                clearTimeout(osdTimeout);
            }}
            
            osdTimeout = setTimeout(() => {{
                osd.classList.remove('osd-visible');
            }}, 800);
        }}

        function toggleSidebar() {{
            const sidebar = document.getElementById('details-sidebar');
            const btn = document.getElementById('btn-toggle-sidebar');
            const isHidden = sidebar.classList.toggle('hidden');
            
            if (isHidden) {{
                btn.classList.remove('active');
            }} else {{
                btn.classList.add('active');
                if (!detailsLoaded) {{
                    loadDetails();
                }}
            }}
        }}

        async function loadDetails() {{
            detailsLoaded = true;
            
            // Set header info
            document.getElementById('video-title-sidebar').innerText = ""{_title}"";
            document.getElementById('video-channel-sidebar').innerText = ""{_channelName}"";
            document.getElementById('video-date-sidebar').innerText = ""{_publishDate}"";
            
            // Load description
            try {{
                const localDesc = decodeURIComponent(escape(atob(""{localDescBase64}"")));
                if (localDesc.trim()) {{
                    document.getElementById('description-text').innerHTML = linkifyTimestamps(escapeHtml(localDesc));
                }} else {{
                    const descRes = await fetch(SERVER_URL + '/api/video/' + videoId + '/description');
                    const descData = await descRes.json();
                    if (descData.success && descData.description) {{
                        document.getElementById('description-text').innerHTML = linkifyTimestamps(escapeHtml(descData.description));
                    }} else {{
                        document.getElementById('description-text').innerText = ""Bu videonun açıklaması bulunmuyor."";
                    }}
                }}
            }} catch (err) {{
                // Fallback to fetch if local base64 decoding fails (e.g. empty or invalid character)
                try {{
                    const descRes = await fetch(SERVER_URL + '/api/video/' + videoId + '/description');
                    const descData = await descRes.json();
                    if (descData.success && descData.description) {{
                        document.getElementById('description-text').innerHTML = linkifyTimestamps(escapeHtml(descData.description));
                    }} else {{
                        document.getElementById('description-text').innerText = ""Bu videonun açıklaması bulunmuyor."";
                    }}
                }} catch (fetchErr) {{
                    document.getElementById('description-text').innerText = ""Açıklama yüklenemedi: "" + fetchErr.message;
                }}
            }}
            
            // Load comments
            try {{
                const commRes = await fetch(SERVER_URL + '/api/video/' + videoId + '/comments');
                const commData = await commRes.json();
                if (commData.success && commData.comments && commData.comments.length > 0) {{
                    let html = '';
                    commData.comments.forEach(c => {{
                        html += `
                            <div class=""comment-item"">
                                <div class=""comment-header"">
                                    <img class=""comment-avatar"" src=""${{c.authorAvatar}}"" onerror=""this.src='data:image/svg+xml;utf8,<svg xmlns=\\'http://www.w3.org/2000/svg\\' viewBox=\\'0 0 24 24\\' fill=\\'%23a1a1aa\\'><path d=\\'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z\\'/></svg>'"">
                                    <span class=""comment-author"">${{c.author}}</span>
                                    <span class=""comment-time"">${{c.publishedTime}}</span>
                                </div>
                                <div class=""comment-text"">${{c.text}}</div>
                                ` + (c.likeCount ? `<div class=""comment-likes""><svg viewBox=""0 0 24 24"" width=""12"" height=""12"" fill=""currentColor""><path d=""M1 21h4V9H1v12zm22-11c0-1.1-.9-2-2-2h-6.31l.95-4.57.03-.32c0-.41-.17-.79-.44-1.06L14.17 1 7.59 7.59C7.22 7.95 7 8.45 7 9v10c0 1.1.9 2 2 2h9c.83 0 1.54-.5 1.84-1.22l3.02-7.05c.09-.23.14-.47.14-.73v-2z""/></svg> ${{c.likeCount}}</div>` : '') + `
                            </div>
                        `;
                    }});
                    document.getElementById('comments-list').innerHTML = html;
                }} else {{
                    document.getElementById('comments-list').innerText = ""Bu video için henüz yorum bulunmuyor veya yüklenemedi."";
                }}
            }} catch (err) {{
                document.getElementById('comments-list').innerText = ""Yorumlar yüklenemedi: "" + err.message;
            }}
        }}

        function switchTab(tab) {{
            document.getElementById('tab-desc').classList.remove('active');
            document.getElementById('tab-comments').classList.remove('active');
            document.getElementById('content-desc').classList.remove('active');
            document.getElementById('content-comments').classList.remove('active');
            
            if (tab === 'desc') {{
                document.getElementById('tab-desc').classList.add('active');
                document.getElementById('content-desc').classList.add('active');
            }} else {{
                document.getElementById('tab-comments').classList.add('active');
                document.getElementById('content-comments').classList.add('active');
            }}
        }}

        // Altyazıyı Çevir
        async function translateSubtitle() {{
            const btn = document.getElementById('btn-translate-sub');
            if (btn.disabled) return;
            
            btn.disabled = true;
            btn.innerHTML = 'Çevriliyor...';
            
            try {{
                const res = await fetch(SERVER_URL + '/api/video/' + videoId + '/translate-subtitle', {{
                    method: 'POST',
                    headers: {{ 'Content-Type': 'application/json' }},
                    body: JSON.stringify({{ fromLang: 'en', toLang: 'tr' }})
                }});
                const data = await res.json();
                if (data.success) {{
                    // Pozisyonu kaydet ve sayfayı yenile
                    const curTime = player.currentTime;
                    const resumeData = JSON.parse(localStorage.getItem('haytool_playback_resume') || '{{}}');
                    resumeData[videoId] = curTime;
                    localStorage.setItem('haytool_playback_resume', JSON.stringify(resumeData));
                    
                    window.location.reload();
                }} else {{
                    alert('Çeviri başarısız oldu: ' + (data.error || 'Bilinmeyen hata'));
                    btn.disabled = false;
                    btn.innerHTML = 'Altyazıyı Çevir';
                }}
            }} catch (err) {{
                alert('Bağlantı hatası: ' + err.message);
                btn.disabled = false;
                btn.innerHTML = 'Altyazıyı Çevir';
            }}
        }}

        // Videoyu Sil ve Kapat
        async function deleteAndClose() {{
            if (confirm('Bu videoyu kütüphaneden ve diskten kalıcı olarak silip kapatmak istiyor musunuz?')) {{
                try {{
                    player.pause();
                    const res = await fetch(SERVER_URL + '/api/history/' + videoId + '?deleteFile=true', {{
                        method: 'DELETE'
                    }});
                    const data = await res.json();
                    if (data.success) {{
                        const bridge = await getBridge();
                        bridge.close();
                    }} else {{
                        alert('Silme hatası: ' + (data.error || 'Bilinmeyen hata'));
                    }}
                }} catch (err) {{
                    alert('Bağlantı hatası: ' + err.message);
                }}
            }}
        }}

        let player;
        let seeked = false;

        async function triggerPlayback() {{
            const p = player;
            if (!p || seeked) return;
            seeked = true;

            try {{
                const bridge = await getBridge();
                const startSeconds = await bridge.getResumeTime(videoId);
                if (startSeconds > 2) {{
                    p.currentTime = startSeconds;
                }}
            }} catch (err) {{
                console.error('Resume load error:', err);
            }}
            
            // Otomatik oynatmayı başlat
            setTimeout(() => {{
                p.play().catch(err => {{
                    // Tarayıcı politikası otomatik oynatmayı engellerse ilk tıklamada oynat
                    document.addEventListener('click', () => {{
                        p.play();
                    }}, {{ once: true }});
                }});
            }}, 150);
        }}

        async function onPlayerReady(event) {{
            const p = event.detail.plyr || player;
            if (!p) return;
            // OSD bildirim kutusunu tam ekranda da görünebilmesi için Plyr kapsayıcısının içine taşı
            p.elements.container.appendChild(document.getElementById('osd-overlay'));

            // Eğer video zaten canplay durumuna ulaşmışsa doğrudan başlat
            if (element.readyState >= 2) {{
                triggerPlayback();
            }} else {{
                // Değilse canplay olayını bekle
                player.on('canplay', triggerPlayback);
            }}
        }}

        const element = document.getElementById('player');
        element.addEventListener('ready', onPlayerReady);

        player = new Plyr(element, {{
            autoplay: true,
            captions: {{ active: true, update: true, language: 'auto' }},
            keyboard: {{ global: false }}
        }});
        
        // Oynatma süresi değiştikçe kaldığı yeri kaydet
        player.on('timeupdate', async () => {{
            const currentTime = player.currentTime;
            const duration = player.duration || 0;
            if (currentTime > 2 && duration > 10 && (duration - currentTime) > 5) {{
                try {{
                    const bridge = await getBridge();
                    await bridge.saveResumeTime(videoId, currentTime);
                }} catch (err) {{}}
            }} else if (duration > 0 && (duration - currentTime) <= 5) {{
                try {{
                    const bridge = await getBridge();
                    await bridge.saveResumeTime(videoId, 0);
                }} catch (err) {{}}
            }}
        }});
        
        // Çift tıklama ile tam ekranı değiştir
        document.body.addEventListener('dblclick', (e) => {{
            if (e.target.closest('.plyr__controls')) return;
            player.fullscreen.toggle();
        }});

        // Klavye kısayolları
        window.addEventListener('keydown', (e) => {{
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) {{
                return;
            }}

            if (e.code === 'Space' || e.code === 'KeyK') {{
                e.preventDefault();
                player.togglePlay();
                setTimeout(() => {{
                    showOSD(player.paused ? '⏸ Durduruldu' : '▶ Oynatılıyor');
                }}, 50);
            }}
            else if (e.code === 'KeyF') {{
                e.preventDefault();
                const nextFS = !player.fullscreen.active;
                player.fullscreen.toggle();
                showOSD(nextFS ? '📺 Tam Ekran' : '📺 Pencere Modu');
            }}
            else if (e.code === 'KeyC') {{
                e.preventDefault();
                const nextCaptions = !player.captions.active;
                player.toggleCaptions();
                showOSD(nextCaptions ? '💬 Altyazı: AÇIK' : '❌ Altyazı: KAPALI');
            }}
            else if (e.code === 'KeyM') {{
                e.preventDefault();
                const nextMute = !player.muted;
                player.muted = nextMute;
                showOSD(nextMute ? '🔇 Sessiz' : '🔊 Ses Açık');
            }}
            else if (e.code === 'ArrowLeft') {{
                e.preventDefault();
                player.rewind(5);
                showOSD('⏪ -5sn');
            }}
            else if (e.code === 'ArrowRight') {{
                e.preventDefault();
                player.forward(5);
                showOSD('⏩ +5sn');
            }}
            else if (e.code === 'KeyJ') {{
                e.preventDefault();
                player.rewind(10);
                showOSD('⏪ -10sn');
            }}
            else if (e.code === 'KeyL') {{
                e.preventDefault();
                player.forward(10);
                showOSD('⏩ +10sn');
            }}
            else if (e.code === 'ArrowUp') {{
                e.preventDefault();
                player.volume = Math.min(1.0, player.volume + 0.01);
                showOSD('🔊 %' + Math.round(player.volume * 100));
            }}
            else if (e.code === 'ArrowDown') {{
                e.preventDefault();
                player.volume = Math.max(0.0, player.volume - 0.01);
                showOSD('🔉 %' + Math.round(player.volume * 100));
            }}
            else if (e.code === 'Home') {{
                e.preventDefault();
                player.currentTime = 0;
                showOSD('⏮ Başa Dönüldü');
            }}
            else if (e.code === 'End') {{
                e.preventDefault();
                player.currentTime = player.duration || 0;
                showOSD('⏭ Sona Gidildi');
            }}
            else if (e.code === 'Period' && e.shiftKey) {{
                e.preventDefault();
                const speeds = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];
                let idx = speeds.indexOf(player.speed);
                if (idx < speeds.length - 1) {{
                    player.speed = speeds[idx + 1];
                    showOSD('⚡ Hız: ' + player.speed + 'x');
                }}
            }}
            else if (e.code === 'Comma' && e.shiftKey) {{
                e.preventDefault();
                const speeds = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];
                let idx = speeds.indexOf(player.speed);
                if (idx > 0) {{
                    player.speed = speeds[idx - 1];
                    showOSD('⚡ Hız: ' + player.speed + 'x');
                }}
            }}
            else if (e.code >= 'Digit0' && e.code <= 'Digit9') {{
                e.preventDefault();
                const pct = parseInt(e.code.replace('Digit', '')) * 10;
                player.currentTime = (player.duration || 0) * (pct / 100);
                showOSD('🔍 Konum: %' + pct);
            }}
            else if (e.code === 'Escape') {{
                if (!player.fullscreen.active) {{
                    e.preventDefault();
                    getBridge().then(bridge => bridge.close());
                }}
            }}
        }});

        // Mouse tekerleği ile ses seviyesini ayarla (Mouse Wheel Volume Control)
        window.addEventListener('wheel', (e) => {{
            e.preventDefault();
            let currentVolume = player.volume;
            if (e.deltaY < 0) {{
                player.volume = Math.min(1.0, currentVolume + 0.01);
            }} else {{
                player.volume = Math.max(0.0, currentVolume - 0.01);
            }}
            showOSD((player.volume > 0 ? '🔊' : '🔇') + ' %' + Math.round(player.volume * 100));
        }}, {{ passive: false }});
    </script>
</body>
</html>";

                // Geçici dosyaya yaz ve yükle
                string tempHtmlPath = Path.Combine(Path.GetTempPath(), "haytool_plyr_player.html");
                File.WriteAllText(tempHtmlPath, htmlContent, System.Text.Encoding.UTF8);

                playerWebView.CoreWebView2.Navigate(new Uri(tempHtmlPath).AbsoluteUri);
            }
            catch (Exception ex)
            {
                MessageBox.Show("Oynatıcı başlatılamadı: " + ex.Message, "Hata", MessageBoxButton.OK, MessageBoxImage.Error);
            }
        }

        private WindowStyle _prevWindowStyle;
        private WindowState _prevWindowState;
        private ResizeMode _prevResizeMode;

        private void CoreWebView2_ContainsFullScreenElementChanged(object sender, object e)
        {
            var webView = sender as Microsoft.Web.WebView2.Core.CoreWebView2;
            if (webView == null) return;

            this.Dispatcher.Invoke(() =>
            {
                if (webView.ContainsFullScreenElement)
                {
                    // Tam Ekran Moduna Geç
                    _prevWindowStyle = this.WindowStyle;
                    _prevWindowState = this.WindowState;
                    _prevResizeMode = this.ResizeMode;

                    this.WindowState = WindowState.Normal; // Önce Normal'e çek ki maksimize geçişi tetiklensin
                    this.WindowStyle = WindowStyle.None;
                    this.ResizeMode = ResizeMode.NoResize;
                    this.Topmost = true;
                    this.WindowState = WindowState.Maximized;
                }
                else
                {
                    // Normal Pencere Moduna Geri Dön
                    this.WindowStyle = _prevWindowStyle;
                    this.WindowState = WindowState.Normal; // Önce normal yapıp sonra orijinal state'i uygula
                    this.ResizeMode = _prevResizeMode;
                    this.Topmost = false;
                    this.WindowState = _prevWindowState;
                }
            });
        }

        protected override void OnSourceInitialized(EventArgs e)
        {
            base.OnSourceInitialized(e);
            SetWindowAppId("HaYTooL.PlayerWindow");
        }

        private void SetWindowAppId(string appId)
        {
            try
            {
                var helper = new System.Windows.Interop.WindowInteropHelper(this);
                IntPtr hwnd = helper.Handle;
                if (hwnd != IntPtr.Zero)
                {
                    Guid guid = PropertyStoreGuid;
                    PropertyKey key = AppIdPropertyKey;
                    int hr = SHGetPropertyStoreForWindow(hwnd, ref guid, out IPropertyStore store);
                    if (hr == 0 && store != null)
                    {
                        PropVariant pv = new PropVariant();
                        pv.vt = 31; // VT_LPWSTR
                        pv.pointerVal = Marshal.StringToCoTaskMemUni(appId);
                        try
                        {
                            store.SetValue(ref key, ref pv);
                            store.Commit();
                        }
                        finally
                        {
                            if (pv.pointerVal != IntPtr.Zero)
                            {
                                Marshal.FreeCoTaskMem(pv.pointerVal);
                            }
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine("AppUserModelID error: " + ex.Message);
            }
        }

        private static readonly Guid PropertyStoreGuid = new Guid("886d8eeb-8cf2-4446-8d02-cdba1dbdcf99");
        private static readonly PropertyKey AppIdPropertyKey = new PropertyKey(new Guid("9F4C6855-A179-4F11-AE92-7B3617215555"), 5);

        [DllImport("shell32.dll", SetLastError = true)]
        private static extern int SHGetPropertyStoreForWindow(IntPtr hwnd, ref Guid iid, [MarshalAs(UnmanagedType.Interface)] out IPropertyStore propertyStore);

        [ComImport, Guid("886d8eeb-8cf2-4446-8d02-cdba1dbdcf99"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
        private interface IPropertyStore
        {
            [PreserveSig]
            int GetCount(out uint propertyCount);
            [PreserveSig]
            int GetAt(uint propertyIndex, out PropertyKey key);
            [PreserveSig]
            int GetValue(ref PropertyKey key, ref PropVariant pv);
            [PreserveSig]
            int SetValue(ref PropertyKey key, ref PropVariant pv);
            [PreserveSig]
            int Commit();
        }

        [StructLayout(LayoutKind.Sequential)]
        private struct PropertyKey
        {
            public Guid fmtid;
            public uint pid;

            public PropertyKey(Guid guid, uint id)
            {
                fmtid = guid;
                pid = id;
            }
        }

        [StructLayout(LayoutKind.Explicit)]
        private struct PropVariant
        {
            [FieldOffset(0)]
            public ushort vt;
            [FieldOffset(8)]
            public IntPtr pointerVal;
        }

        protected override void OnClosed(EventArgs e)
        {
            try
            {
                playerWebView.Dispose();
            }
            catch {}
            base.OnClosed(e);
        }
    }
}
