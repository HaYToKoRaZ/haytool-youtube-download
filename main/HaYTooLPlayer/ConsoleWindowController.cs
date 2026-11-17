using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Net.Http;
using System.Runtime.InteropServices;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using System.Threading;
using System.Threading.Tasks;
using System.Windows.Forms;

namespace HaYTooLPlayer
{
    /// <summary>
    /// Tepsi konsol penceresi UI yaşam döngüsü, canlı HUD telemetrisi,
    /// SSE terminal_raw senkronizasyonu, renkli log tamponu ve komut geçmişini yönetir.
    /// </summary>
    internal sealed class ConsoleWindowController : IDisposable
    {
        private sealed class ConsoleLogEntry
        {
            public string Category = "SYSTEM";
            public string Level = "info";
            public string Text = "";
        }

        [DllImport("user32.dll")]
        private static extern IntPtr SendMessage(IntPtr hWnd, int msg, IntPtr wParam, IntPtr lParam);
        private const int WM_SETREDRAW = 0x000B;

        private const int MaxConsoleEntries = 3000;
        private static readonly Regex _inlineTokenRegex = new Regex(
            @"(\b\d+\/\d+\b)|(""[^""]+"")|((?<=->\s)[45]\d{2}\b)|((?<=->\s)[23]\d{2}\b)|(\(\d+ms\)|\b\d+(?:\.\d+)?\s*(?:MB/s|KB/s|GiB/s|MiB/s|KiB/s|GB|MB)\b)|(https?://[^\s\)]+)|(✔\s*(?:Hazır|Ready)|\b(?:Açık|AÇILDI|On)\b)|(✘\s*(?:Eksik|Missing)|⏳\s*(?:Kontrol ediliyor|Checking)|\b(?:Kapalı|KAPATILDI|DURAKLATILDI|Off)\b)",
            RegexOptions.Compiled
        );

        private readonly HttpClient _httpClient;
        private readonly Func<int> _getPort;
        private readonly Func<string> _getLanguage;
        private readonly Func<string> _getTheme;
        private readonly Func<bool> _isManagedNodeRunning;
        private readonly Action<string> _sendCommand;
        private readonly Action _onExitRequested;

        private readonly List<ConsoleLogEntry> _consoleEntries = new List<ConsoleLogEntry>();
        private readonly object _bufferLock = new object();
        private readonly List<string> _cmdHistory = new List<string>();
        private int _cmdHistoryIndex = -1;

        private string _activeFilterCategory = "ALL";
        private string _searchQuery = "";
        private bool _autoScroll = true;
        private string? _latestLogsDir;
        private CancellationTokenSource? _sseCts;
        private volatile bool _isDetachedLogStreamActive = false;
        private volatile bool _hasHydratedDetachedLogs = false;

        private Form? _logForm;
        private RichTextBox? _logTextBox;
        private Font? _boldConsoleFont;
        private Label? _cmdLabel;
        private Button? _sendButton;
        private Button? _clearButton;
        private Button? _openLogButton;
        private System.Windows.Forms.Timer? _consoleStatsTimer;
        private Label? _hudStatusLabel;
        private Label? _hudVersionLabel;
        private Label? _hudUptimeLabel;
        private Label? _hudRamLabel;
        private Label? _hudQueueLabel;
        private Label? _hudCookieLabel;
        private TextBox? _searchTextBox;
        private Button? _autoScrollButton;
        private readonly List<(string Key, Button Btn)> _filterButtons = new List<(string Key, Button Btn)>();

        public bool IsDetachedLogStreamActive => _isDetachedLogStreamActive;

        public ConsoleWindowController(
            HttpClient httpClient,
            Func<int> getPort,
            Func<string> getLanguage,
            Func<string> getTheme,
            Func<bool> isManagedNodeRunning,
            Action<string> sendCommand,
            Action onExitRequested)
        {
            _httpClient = httpClient;
            _getPort = getPort;
            _getLanguage = getLanguage;
            _getTheme = getTheme;
            _isManagedNodeRunning = isManagedNodeRunning;
            _sendCommand = sendCommand;
            _onExitRequested = onExitRequested;
        }

        public void StartDetachedLogSyncIfNeeded()
        {
            if (_isManagedNodeRunning()) return;
            if (_sseCts != null && !_sseCts.IsCancellationRequested) return;

            _sseCts = new CancellationTokenSource();
            var ct = _sseCts.Token;

            Task.Run(async () =>
            {
                int port = _getPort();
                if (!_hasHydratedDetachedLogs)
                {
                    await HydrateRawLogsFromServerAsync(port, ct);
                }

                while (!ct.IsCancellationRequested)
                {
                    if (_isManagedNodeRunning())
                    {
                        _isDetachedLogStreamActive = false;
                        break;
                    }

                    try
                    {
                        using var sseClient = new HttpClient { Timeout = Timeout.InfiniteTimeSpan };
                        using var req = new HttpRequestMessage(HttpMethod.Get, $"http://127.0.0.1:{port}/api/events");
                        using var resp = await sseClient.SendAsync(req, HttpCompletionOption.ResponseHeadersRead, ct);
                        resp.EnsureSuccessStatusCode();
                        _isDetachedLogStreamActive = true;

                        using var stream = await resp.Content.ReadAsStreamAsync(ct);
                        using var reader = new StreamReader(stream, Encoding.UTF8);

                        string currentEvent = "";
                        var dataBuf = new StringBuilder();
                        while (!ct.IsCancellationRequested)
                        {
                            string? line = await reader.ReadLineAsync();
                            if (line == null) break;

                            if (line.Length == 0)
                            {
                                if (currentEvent == "terminal_raw" && dataBuf.Length > 0)
                                {
                                    AppendRawSsePayload(dataBuf.ToString());
                                }
                                currentEvent = "";
                                dataBuf.Clear();
                                continue;
                            }

                            if (line.StartsWith("event:", StringComparison.Ordinal))
                            {
                                currentEvent = line.Substring(6).Trim();
                            }
                            else if (line.StartsWith("data:", StringComparison.Ordinal))
                            {
                                if (dataBuf.Length > 0) dataBuf.Append('\n');
                                dataBuf.Append(line.Substring(5).TrimStart());
                            }
                        }
                    }
                    catch (OperationCanceledException)
                    {
                        break;
                    }
                    catch
                    {
                        _isDetachedLogStreamActive = false;
                        try { await Task.Delay(2500, ct); } catch { break; }
                    }
                }
                _isDetachedLogStreamActive = false;
            }, ct);
        }

        private async Task HydrateRawLogsFromServerAsync(int port, CancellationToken ct)
        {
            try
            {
                using var resp = await _httpClient.GetAsync($"http://127.0.0.1:{port}/api/logs?raw=1", ct);
                if (!resp.IsSuccessStatusCode) return;
                string json = await resp.Content.ReadAsStringAsync(ct);
                using var doc = JsonDocument.Parse(json);
                if (doc.RootElement.ValueKind != JsonValueKind.Array) return;

                _hasHydratedDetachedLogs = true;
                foreach (var item in doc.RootElement.EnumerateArray())
                {
                    AppendRawLogElement(item);
                }
            }
            catch { }
        }

        private void AppendRawSsePayload(string json)
        {
            try
            {
                using var doc = JsonDocument.Parse(json);
                AppendRawLogElement(doc.RootElement);
            }
            catch { }
        }

        private void AppendRawLogElement(JsonElement el)
        {
            if (el.ValueKind != JsonValueKind.Object) return;
            string msg = el.TryGetProperty("message", out var mProp) && mProp.ValueKind == JsonValueKind.String
                ? (mProp.GetString() ?? "")
                : "";
            if (string.IsNullOrWhiteSpace(msg)) return;

            string type = el.TryGetProperty("type", out var tProp) && tProp.ValueKind == JsonValueKind.String
                ? (tProp.GetString() ?? "log")
                : "log";

            string tsPrefix = "";
            if (el.TryGetProperty("timestamp", out var tsProp) && tsProp.ValueKind == JsonValueKind.String)
            {
                string? tsRaw = tsProp.GetString();
                if (!string.IsNullOrEmpty(tsRaw) && DateTimeOffset.TryParse(tsRaw, out var dto))
                {
                    tsPrefix = dto.ToLocalTime().ToString("[HH:mm:ss] ");
                }
            }
            if (string.IsNullOrEmpty(tsPrefix)) tsPrefix = DateTime.Now.ToString("[HH:mm:ss] ");

            string clean = Regex.Replace(msg, @"\x1b\[[0-9;]*m", "").TrimEnd();
            if (type == "error" && !clean.Contains("[HATA]") && !clean.Contains("[ERROR]"))
            {
                clean = "[HATA] " + clean;
            }
            else if (type == "warn" && !clean.Contains("[UYARI]") && !clean.Contains("[WARN"))
            {
                clean = "[UYARI] " + clean;
            }

            if (!Regex.IsMatch(clean, @"^\[\d{2}:\d{2}:\d{2}\]"))
            {
                clean = tsPrefix + clean;
            }

            AppendLog(clean);
        }

        private static (string Category, string Level) ClassifyLogEntry(string text)
        {
            string level = "info";
            if (text.Contains("[HATA]") || text.Contains("[ERROR]") || text.Contains("[RSS HATA]") || text.Contains("[RSS ERROR]") || text.Contains("[Channel Check ERROR]") || text.Contains("[Download Error]") || text.Contains("[yt-dlp Error]") || Regex.IsMatch(text, @"->\s*5\d{2}\b"))
            {
                level = "error";
            }
            else if (text.Contains("[WARN]") || text.Contains("[WARNING]") || text.Contains("[UYARI]") || text.Contains("[Channel Check WARN]") || text.Contains("[yt-dlp Uyarı]") || text.Contains("[yt-dlp Warn]") || text.Contains("[403 Koruması]") || text.Contains("[403 Protection]") || Regex.IsMatch(text, @"->\s*4\d{2}\b"))
            {
                level = "warning";
            }
            else if (text.Contains("[SUCCESS]") || text.Contains("[DOWNLOAD OK]") || text.Contains("[İndirme Başarılı]") || text.Contains("[Download Success]") || text.Contains("TAMAMLANDI:") || text.Contains("İndirme SUCCESSFUL"))
            {
                level = "success";
            }

            string category = "SYSTEM";
            if (text.Contains("[DOWNLOAD") || text.Contains("[Download") || text.Contains("[İNDİRME]") || text.Contains("[İndirme") || text.Contains("[yt-dlp") || text.Contains("[Kuyruk") || text.Contains("[Queue") || text.Contains("[FFMPEG]") || text.Contains("[Birleştirme Kuyruğu]") || text.Contains("[Merge Queue]") || text.Contains("[403 Koruması]") || text.Contains("[403 Protection]") || text.Contains("[Oyun Modu]") || text.Contains("[Game Mode]"))
            {
                category = "DOWNLOAD";
            }
            else if (text.Contains("[RSS") || text.Contains("[Channel Check"))
            {
                category = "RSS";
            }
            else if (text.Contains("[WEBSTREAM]"))
            {
                category = "WEBSTREAM";
            }
            else if (text.Contains("[IPTV]"))
            {
                category = "IPTV";
            }
            else if (text.Contains("[API]") || text.Contains("[CLIENT"))
            {
                category = "API_CLIENT";
            }

            return (category, level);
        }

        private bool MatchesFilter(ConsoleLogEntry entry)
        {
            if (_activeFilterCategory == "ERR_WARN")
            {
                if (entry.Level != "error" && entry.Level != "warning") return false;
            }
            else if (_activeFilterCategory != "ALL" && entry.Category != _activeFilterCategory)
            {
                return false;
            }

            if (!string.IsNullOrWhiteSpace(_searchQuery))
            {
                if (entry.Text.IndexOf(_searchQuery, StringComparison.OrdinalIgnoreCase) < 0) return false;
            }

            return true;
        }

        public void AppendLog(string text)
        {
            if (string.IsNullOrEmpty(text)) return;

            string cleanedBlock = Regex.Replace(text, @"\x1b\[[0-9;]*m", "");
            if (cleanedBlock.TrimStart().StartsWith("[TRAY_CMD]", StringComparison.Ordinal)) return;

            string[] rawLines = cleanedBlock.Split(new[] { "\r\n", "\n", "\r" }, StringSplitOptions.None);
            var (blockCategory, blockLevel) = ClassifyLogEntry(cleanedBlock);
            string fallbackTs = DateTime.Now.ToString("[HH:mm:ss] ");

            var addedEntries = new List<ConsoleLogEntry>();
            lock (_bufferLock)
            {
                for (int i = 0; i < rawLines.Length; i++)
                {
                    string rawLine = rawLines[i];
                    if (string.IsNullOrWhiteSpace(rawLine)) continue;

                    string lineText;
                    if (i == 0)
                    {
                        lineText = Regex.IsMatch(rawLine, @"^\[\d{2}:\d{2}:\d{2}\]")
                            ? rawLine
                            : fallbackTs + rawLine;
                    }
                    else
                    {
                        lineText = Regex.IsMatch(rawLine, @"^\[\d{2}:\d{2}:\d{2}\]")
                            ? rawLine
                            : "           " + rawLine;
                    }

                    var (lineCat, lineLvl) = i == 0 ? (blockCategory, blockLevel) : ClassifyLogEntry(rawLine);
                    var entry = new ConsoleLogEntry
                    {
                        Category = i > 0 && lineCat == "SYSTEM" ? blockCategory : lineCat,
                        Level = i > 0 && lineLvl == "info" ? blockLevel : lineLvl,
                        Text = lineText + "\r\n"
                    };
                    _consoleEntries.Add(entry);
                    addedEntries.Add(entry);
                }

                if (_consoleEntries.Count > MaxConsoleEntries)
                {
                    _consoleEntries.RemoveRange(0, _consoleEntries.Count - MaxConsoleEntries);
                }
            }

            if (addedEntries.Count > 0 && _logForm != null && !_logForm.IsDisposed && _logTextBox != null && !_logTextBox.IsDisposed)
            {
                try
                {
                    _logTextBox.BeginInvoke(new Action(() =>
                    {
                        if (_logTextBox == null || _logTextBox.IsDisposed) return;
                        bool appendedAny = false;
                        foreach (var entry in addedEntries)
                        {
                            if (!MatchesFilter(entry)) continue;
                            AppendColoredText(_logTextBox, entry.Text);
                            appendedAny = true;
                        }
                        if (appendedAny && _autoScroll)
                        {
                            _logTextBox.SelectionStart = _logTextBox.TextLength;
                            _logTextBox.ScrollToCaret();
                        }
                    }));
                }
                catch {}
            }
        }

        private void RebuildConsoleView()
        {
            if (_logTextBox == null || _logTextBox.IsDisposed) return;

            List<ConsoleLogEntry> snapshot;
            lock (_bufferLock)
            {
                snapshot = new List<ConsoleLogEntry>(_consoleEntries.Count);
                foreach (var entry in _consoleEntries)
                {
                    if (MatchesFilter(entry)) snapshot.Add(entry);
                }
            }

            int startIdx = snapshot.Count > 1800 ? snapshot.Count - 1800 : 0;

            try
            {
                SendMessage(_logTextBox.Handle, WM_SETREDRAW, IntPtr.Zero, IntPtr.Zero);
                _logTextBox.Clear();
                for (int i = startIdx; i < snapshot.Count; i++)
                {
                    AppendColoredText(_logTextBox, snapshot[i].Text);
                }
                if (_autoScroll)
                {
                    _logTextBox.SelectionStart = _logTextBox.TextLength;
                    _logTextBox.ScrollToCaret();
                }
            }
            catch {}
            finally
            {
                try
                {
                    SendMessage(_logTextBox.Handle, WM_SETREDRAW, (IntPtr)1, IntPtr.Zero);
                    _logTextBox.Invalidate();
                }
                catch {}
            }
        }

        private void AppendColoredText(RichTextBox box, string text)
        {
            if (box == null || box.IsDisposed || string.IsNullOrEmpty(text)) return;

            string timestampPart = "";
            string bodyPart = text;

            var match = Regex.Match(text, @"^(\[\d{2}:\d{2}:\d{2}\]\s*)(.*)$", RegexOptions.Singleline);
            if (match.Success)
            {
                timestampPart = match.Groups[1].Value;
                bodyPart = match.Groups[2].Value;
            }

            Color bodyColor = Color.FromArgb(222, 226, 236);

            if (bodyPart.Contains("[HATA]") || bodyPart.Contains("[ERROR]") || bodyPart.Contains("[RSS HATA]") || bodyPart.Contains("[RSS ERROR]") || bodyPart.Contains("[Channel Check ERROR]") || bodyPart.Contains("[Download Error]") || bodyPart.Contains("[yt-dlp Error]"))
            {
                bodyColor = Color.FromArgb(255, 105, 105);
            }
            else if (bodyPart.Contains("[WARN]") || bodyPart.Contains("[WARNING]") || bodyPart.Contains("[UYARI]") || bodyPart.Contains("[Channel Check WARN]") || bodyPart.Contains("[yt-dlp Uyarı]") || bodyPart.Contains("[yt-dlp Warn]") || bodyPart.Contains("WARNING"))
            {
                bodyColor = Color.FromArgb(255, 190, 90);
            }
            else if (bodyPart.Contains("[SUCCESS]") || bodyPart.Contains("[İndirme Başarılı]") || bodyPart.Contains("[Download Success]") || bodyPart.Contains("[DOWNLOAD OK]") || bodyPart.Contains("İndirme Tamamlandı") || bodyPart.Contains("TAMAMLANDI:") || bodyPart.Contains("İndirme SUCCESSFUL"))
            {
                bodyColor = Color.FromArgb(105, 230, 155);
            }
            else if (bodyPart.Contains("[WEBSTREAM]"))
            {
                bodyColor = Color.FromArgb(90, 215, 255);
            }
            else if (bodyPart.Contains("[FFMPEG]") || bodyPart.Contains("[Birleştirme Kuyruğu]") || bodyPart.Contains("[Merge Queue]"))
            {
                bodyColor = Color.FromArgb(245, 165, 255);
            }
            else if (bodyPart.Contains("[CLIENT"))
            {
                bodyColor = Color.FromArgb(255, 145, 120);
            }
            else if (bodyPart.Contains("[FAKAP]"))
            {
                bodyColor = Color.FromArgb(190, 175, 255);
            }
            else if (bodyPart.Contains("[Çerez Sağlık]") || bodyPart.Contains("[Cookie Health]") || bodyPart.Contains("[COOKIE]"))
            {
                bodyColor = Color.FromArgb(255, 200, 110);
            }
            else if (bodyPart.Contains("[NET]"))
            {
                bodyColor = Color.FromArgb(130, 225, 205);
            }
            else if (bodyPart.Contains("[Console]") || bodyPart.Contains("[Sistem Açılışı]") || bodyPart.Contains("[Startup]") || bodyPart.Contains("[Server]") || bodyPart.Contains("[Güncelleme]") || bodyPart.Contains("[Update]") || bodyPart.Contains("[Motor]") || bodyPart.Contains("[Engine]") || bodyPart.Contains("[Disk Sync]") || bodyPart.Contains("[Ayarlar]") || bodyPart.Contains("[Settings]") || bodyPart.Contains("[Channel Check]"))
            {
                bodyColor = Color.FromArgb(150, 225, 140);
            }
            else if (bodyPart.Contains("▶ MULTIMEDIA HaYTooL"))
            {
                bodyColor = Color.FromArgb(125, 211, 252);
            }
            else if (bodyPart.TrimStart().StartsWith("╔") || bodyPart.TrimStart().StartsWith("╠") || bodyPart.TrimStart().StartsWith("╚") || bodyPart.TrimStart().StartsWith("║"))
            {
                bodyColor = Color.FromArgb(203, 213, 225);
            }
            else if (bodyPart.Contains("[INFO]"))
            {
                bodyColor = Color.FromArgb(115, 185, 255);
            }
            else if (bodyPart.Contains("[API]"))
            {
                bodyColor = Color.FromArgb(110, 165, 255);
            }
            else if (bodyPart.Contains("[RSS Fallback]"))
            {
                bodyColor = Color.FromArgb(205, 135, 255);
            }
            else if (bodyPart.Contains("[RSS]") || bodyPart.Contains("[RSS Parallel]"))
            {
                if (bodyPart.Contains("Manuel tetikleme")) bodyColor = Color.FromArgb(255, 140, 0);
                else if (bodyPart.Contains("Sunucu başlangıcı")) bodyColor = Color.FromArgb(186, 85, 211);
                else bodyColor = Color.FromArgb(225, 145, 255);
            }
            else if (bodyPart.Contains("[403 Koruması]") || bodyPart.Contains("[403 Protection]") || bodyPart.Contains("[Kuyruk Auto-Retry]") || bodyPart.Contains("[Queue Auto-Retry]") || bodyPart.Contains("[İndirme Fallback]") || bodyPart.Contains("[Download Fallback]"))
            {
                bodyColor = Color.FromArgb(255, 185, 0);
            }
            else if (bodyPart.Contains("[CANLI]") || bodyPart.Contains("[CANLI YAYIN]") || bodyPart.Contains("[LIVE]") || bodyPart.Contains("[LIVE STREAM]"))
            {
                bodyColor = Color.FromArgb(0, 255, 200);
            }
            else if (bodyPart.Contains("[DOWNLOAD]") || bodyPart.Contains("[İNDİRME]") || bodyPart.Contains("[Kuyruk]") || bodyPart.Contains("[Queue]") || bodyPart.Contains("[yt-dlp]"))
            {
                bodyColor = Color.FromArgb(0, 225, 255);
            }
            else if (bodyPart.Contains("[KOMUT]") || bodyPart.Contains("[CMD]") || bodyPart.Contains("Komut:"))
            {
                bodyColor = Color.FromArgb(245, 200, 50);
            }
            else if (bodyPart.Contains("[DATABASE]"))
            {
                bodyColor = Color.FromArgb(255, 255, 0);
            }
            else if (bodyPart.Contains("[IPTV]"))
            {
                bodyColor = Color.FromArgb(100, 149, 237);
            }
            else if (bodyPart.Contains("[SYSTEM]") || bodyPart.Contains("[Sistem]") || bodyPart.Contains("[System]") || bodyPart.Contains("[TRAY]"))
            {
                bodyColor = Color.FromArgb(50, 205, 50);
            }
            else if (bodyPart.Contains("[TRAY_CMD]") || bodyPart.Contains("[GİRDİ]") || bodyPart.Contains("[INPUT]"))
            {
                bodyColor = Color.FromArgb(255, 215, 105);
            }

            if (!string.IsNullOrEmpty(timestampPart))
            {
                Color timestampColor = Color.FromArgb(155, 165, 200);
                box.SelectionStart = box.TextLength;
                box.SelectionLength = 0;
                box.SelectionColor = timestampColor;
                box.SelectionFont = box.Font;
                box.AppendText(timestampPart);
            }

            Font defaultFont = box.Font;
            if (_boldConsoleFont == null || _boldConsoleFont.FontFamily.Name != defaultFont.FontFamily.Name)
            {
                try { _boldConsoleFont?.Dispose(); } catch {}
                try { _boldConsoleFont = new Font(defaultFont, FontStyle.Bold); } catch { _boldConsoleFont = defaultFont; }
            }
            Font boldFont = _boldConsoleFont ?? defaultFont;

            Color counterColor = Color.FromArgb(255, 215, 0);
            Color nameColor = Color.FromArgb(0, 240, 255);
            Color httpErrColor = Color.FromArgb(255, 95, 95);
            Color httpOkColor = Color.FromArgb(85, 230, 145);
            Color metricColor = Color.FromArgb(255, 195, 110);
            Color urlColor = Color.FromArgb(120, 180, 255);
            Color boxBorderColor = Color.FromArgb(167, 139, 250);
            Color warnStatusColor = Color.FromArgb(251, 191, 36);

            string trimmedStart = bodyPart.TrimStart();
            if (trimmedStart.StartsWith("╔") || trimmedStart.StartsWith("╠") || trimmedStart.StartsWith("╚") || trimmedStart.StartsWith("║"))
            {
                int leadSpaces = bodyPart.Length - trimmedStart.Length;
                if (leadSpaces > 0)
                {
                    box.SelectionStart = box.TextLength;
                    box.SelectionLength = 0;
                    box.SelectionColor = bodyColor;
                    box.SelectionFont = defaultFont;
                    box.AppendText(bodyPart.Substring(0, leadSpaces));
                }

                if (trimmedStart.StartsWith("║"))
                {
                    box.SelectionStart = box.TextLength;
                    box.SelectionLength = 0;
                    box.SelectionColor = boxBorderColor;
                    box.SelectionFont = boldFont;
                    box.AppendText("║");
                    bodyPart = trimmedStart.Substring(1);
                }
                else
                {
                    box.SelectionStart = box.TextLength;
                    box.SelectionLength = 0;
                    box.SelectionColor = boxBorderColor;
                    box.SelectionFont = boldFont;
                    box.AppendText(trimmedStart);
                    box.SelectionColor = box.ForeColor;
                    box.SelectionFont = defaultFont;
                    return;
                }
            }

            int lastIndex = 0;

            foreach (Match m in _inlineTokenRegex.Matches(bodyPart))
            {
                if (m.Index > lastIndex)
                {
                    string normalSegment = bodyPart.Substring(lastIndex, m.Index - lastIndex);
                    box.SelectionStart = box.TextLength;
                    box.SelectionLength = 0;
                    box.SelectionColor = bodyColor;
                    box.SelectionFont = defaultFont;
                    box.AppendText(normalSegment);
                }

                if (m.Groups[1].Success)
                {
                    box.SelectionStart = box.TextLength;
                    box.SelectionLength = 0;
                    box.SelectionColor = counterColor;
                    box.SelectionFont = boldFont;
                    box.AppendText(m.Value);
                }
                else if (m.Groups[2].Success)
                {
                    box.SelectionStart = box.TextLength;
                    box.SelectionLength = 0;
                    box.SelectionColor = bodyColor;
                    box.SelectionFont = defaultFont;
                    box.AppendText("\"");

                    string innerName = m.Value.Substring(1, m.Value.Length - 2);
                    box.SelectionStart = box.TextLength;
                    box.SelectionLength = 0;
                    box.SelectionColor = nameColor;
                    box.SelectionFont = boldFont;
                    box.AppendText(innerName);

                    box.SelectionStart = box.TextLength;
                    box.SelectionLength = 0;
                    box.SelectionColor = bodyColor;
                    box.SelectionFont = defaultFont;
                    box.AppendText("\"");
                }
                else if (m.Groups[3].Success)
                {
                    box.SelectionStart = box.TextLength;
                    box.SelectionLength = 0;
                    box.SelectionColor = httpErrColor;
                    box.SelectionFont = boldFont;
                    box.AppendText(m.Value);
                }
                else if (m.Groups[4].Success)
                {
                    box.SelectionStart = box.TextLength;
                    box.SelectionLength = 0;
                    box.SelectionColor = httpOkColor;
                    box.SelectionFont = boldFont;
                    box.AppendText(m.Value);
                }
                else if (m.Groups[5].Success)
                {
                    box.SelectionStart = box.TextLength;
                    box.SelectionLength = 0;
                    box.SelectionColor = metricColor;
                    box.SelectionFont = boldFont;
                    box.AppendText(m.Value);
                }
                else if (m.Groups[6].Success)
                {
                    box.SelectionStart = box.TextLength;
                    box.SelectionLength = 0;
                    box.SelectionColor = urlColor;
                    box.SelectionFont = defaultFont;
                    box.AppendText(m.Value);
                }
                else if (m.Groups[7].Success)
                {
                    box.SelectionStart = box.TextLength;
                    box.SelectionLength = 0;
                    box.SelectionColor = httpOkColor;
                    box.SelectionFont = boldFont;
                    box.AppendText(m.Value);
                }
                else if (m.Groups[8].Success)
                {
                    box.SelectionStart = box.TextLength;
                    box.SelectionLength = 0;
                    box.SelectionColor = m.Value.StartsWith("✘") ? httpErrColor : warnStatusColor;
                    box.SelectionFont = boldFont;
                    box.AppendText(m.Value);
                }

                lastIndex = m.Index + m.Length;
            }

            if (lastIndex < bodyPart.Length)
            {
                string remaining = bodyPart.Substring(lastIndex);
                box.SelectionStart = box.TextLength;
                box.SelectionLength = 0;
                box.SelectionColor = bodyColor;
                box.SelectionFont = defaultFont;
                box.AppendText(remaining);
            }

            box.SelectionColor = box.ForeColor;
            box.SelectionFont = defaultFont;
        }

        private async Task FetchAndRenderConsoleStatsAsync()
        {
            if (_logForm == null || _logForm.IsDisposed) return;
            try
            {
                int port = _getPort();
                using var resp = await _httpClient.GetAsync($"http://127.0.0.1:{port}/api/system/console-stats");
                if (!resp.IsSuccessStatusCode) throw new HttpRequestException("HTTP " + (int)resp.StatusCode);

                string json = await resp.Content.ReadAsStringAsync();
                using var doc = JsonDocument.Parse(json);
                var root = doc.RootElement;

                bool isEn = !string.Equals(_getLanguage(), "tr", StringComparison.OrdinalIgnoreCase);
                string ver = root.TryGetProperty("version", out var vP) ? (vP.GetString() ?? "?") : "?";
                int upSec = root.TryGetProperty("uptimeSec", out var uP) && uP.TryGetInt32(out int uV) ? uV : 0;
                int memMb = root.TryGetProperty("memoryMb", out var mP) && mP.TryGetInt32(out int mV) ? mV : 0;
                int queueCount = root.TryGetProperty("queueCount", out var qP) && qP.TryGetInt32(out int qV) ? qV : 0;
                int activeCount = root.TryGetProperty("activeCount", out var acP) && acP.TryGetInt32(out int acV) ? acV : 0;
                int waitingCount = root.TryGetProperty("waitingCount", out var wcP) && wcP.TryGetInt32(out int wcV) ? wcV : queueCount;
                int mergeCount = root.TryGetProperty("pendingMergeCount", out var mgP) && mgP.TryGetInt32(out int mgV) ? mgV : 0;
                bool isPaused = root.TryGetProperty("isPaused", out var pP) && pP.ValueKind == JsonValueKind.True;
                string activeId = root.TryGetProperty("activeVideoId", out var aP) && aP.ValueKind == JsonValueKind.String ? (aP.GetString() ?? "") : "";
                string activeSpeed = root.TryGetProperty("activeSpeed", out var sP) && sP.ValueKind == JsonValueKind.String ? (sP.GetString() ?? "") : "";
                int activeProg = 0;
                if (root.TryGetProperty("activeProgress", out var prP))
                {
                    if (prP.TryGetInt32(out int prI)) activeProg = prI;
                    else if (prP.TryGetDouble(out double prD)) activeProg = (int)Math.Round(prD);
                }
                if (activeCount == 0 && !string.IsNullOrEmpty(activeId)) activeCount = 1;
                string logsDir = root.TryGetProperty("logsDir", out var ldP) && ldP.ValueKind == JsonValueKind.String ? (ldP.GetString() ?? "") : "";
                if (!string.IsNullOrEmpty(logsDir)) _latestLogsDir = logsDir;

                string cookieText = isEn ? "🍪 Cookie: Untested" : "🍪 Çerez: Test edilmedi";
                Color cookieColor = Color.FromArgb(148, 163, 184);
                if (root.TryGetProperty("cookieHealthy", out var cP))
                {
                    if (cP.ValueKind == JsonValueKind.True)
                    {
                        cookieText = isEn ? "🍪 Cookie: Healthy" : "🍪 Çerez: Sağlıklı";
                        cookieColor = Color.FromArgb(34, 197, 94);
                    }
                    else if (cP.ValueKind == JsonValueKind.False)
                    {
                        cookieText = isEn ? "🍪 Cookie: Expired" : "🍪 Çerez: Yenileme Gerekli";
                        cookieColor = Color.FromArgb(239, 68, 68);
                    }
                }

                var ts = TimeSpan.FromSeconds(Math.Max(0, upSec));
                string upFmt = $"{(int)ts.TotalHours:D2}:{ts.Minutes:D2}:{ts.Seconds:D2}";

                string speedPart = string.IsNullOrEmpty(activeSpeed) ? "" : " · " + activeSpeed;
                string queueSummary = activeCount > 0
                    ? (isEn
                        ? $"⬇ Downloading ({activeCount}): {activeProg}%{speedPart} | Waiting: {waitingCount} | Merge: {mergeCount}"
                        : $"⬇ İndiriliyor ({activeCount}): %{activeProg}{speedPart} | Bekleyen: {waitingCount} | Birleştirme: {mergeCount}")
                    : (isPaused
                        ? (isEn ? $"⏸ Paused | Waiting: {waitingCount} | Merge: {mergeCount}" : $"⏸ Duraklatıldı | Bekleyen: {waitingCount} | Birleştirme: {mergeCount}")
                        : (waitingCount > 0
                            ? (isEn ? $"⏳ Queued: {waitingCount} | Merge: {mergeCount}" : $"⏳ Kuyrukta: {waitingCount} | Birleştirme: {mergeCount}")
                            : (isEn ? $"⬇ Idle | Queue: 0 | Merge: {mergeCount}" : $"⬇ Hazır | Kuyruk: 0 | Birleştirme: {mergeCount}")));

                if (_logForm == null || _logForm.IsDisposed) return;
                _logForm.BeginInvoke(new Action(() =>
                {
                    if (_logForm == null || _logForm.IsDisposed) return;
                    if (_hudStatusLabel != null)
                    {
                        _hudStatusLabel.Text = isEn ? $"● Online :{port}" : $"● Çevrimiçi :{port}";
                        _hudStatusLabel.ForeColor = Color.FromArgb(34, 197, 94);
                    }
                    if (_hudVersionLabel != null) _hudVersionLabel.Text = $"v{ver}";
                    if (_hudUptimeLabel != null) _hudUptimeLabel.Text = $"⏱ {upFmt}";
                    if (_hudRamLabel != null) _hudRamLabel.Text = $"🧠 RAM: {memMb} MB";
                    if (_hudQueueLabel != null) _hudQueueLabel.Text = queueSummary;
                    if (_hudCookieLabel != null)
                    {
                        _hudCookieLabel.Text = cookieText;
                        _hudCookieLabel.ForeColor = cookieColor;
                    }
                }));
            }
            catch
            {
                if (_logForm == null || _logForm.IsDisposed) return;
                try
                {
                    bool isEn = !string.Equals(_getLanguage(), "tr", StringComparison.OrdinalIgnoreCase);
                    _logForm.BeginInvoke(new Action(() =>
                    {
                        if (_hudStatusLabel != null && !_logForm.IsDisposed)
                        {
                            _hudStatusLabel.Text = isEn ? "● Offline / Connecting" : "● Çevrimdışı / Bağlanıyor";
                            _hudStatusLabel.ForeColor = Color.FromArgb(245, 158, 11);
                        }
                    }));
                }
                catch {}
            }
        }

        private ContextMenuStrip BuildQuickCmdMenu(ComboBox commandComboBox, Action<string> sendAction)
        {
            bool isEn = !string.Equals(_getLanguage(), "tr", StringComparison.OrdinalIgnoreCase);
            ContextMenuStrip qMenu = new ContextMenuStrip();
            string theme = _getTheme();
            bool isDark = !string.Equals(theme, "light", StringComparison.OrdinalIgnoreCase);
            qMenu.Renderer = new HaYTooLMenuRenderer(isDark);

            void AddPreset(string title, string cmd, string desc, bool autoExecute = true)
            {
                var item = new ToolStripMenuItem(title);
                item.ToolTipText = desc;
                item.Click += (s, e) =>
                {
                    commandComboBox.Text = cmd;
                    if (autoExecute)
                    {
                        sendAction(cmd);
                        commandComboBox.Text = "";
                    }
                    else
                    {
                        commandComboBox.Focus();
                        commandComboBox.SelectionStart = cmd.Length;
                    }
                };
                qMenu.Items.Add(item);
            }

            AddPreset(isEn ? "📊 status   (Server & Queue Status)" : "📊 status   (Durum ve Hız Özeti)", "status", isEn ? "Shows download queue, speed limits & Turtle state" : "İndirme kuyruğunu, hız limitlerini ve kaplumbağa modunu listeler");
            AddPreset(isEn ? "🩺 diag     (System Diagnostics)" : "🩺 diag     (Sistem Tanı Raporu)", "diag", isEn ? "Shows uptime, RAM, FFmpeg, yt-dlp, cookie health & disk space" : "Çalışma süresi, RAM, FFmpeg/yt-dlp, çerez sağlığı ve disk bilgisini gösterir");
            AddPreset(isEn ? "📋 queue    (Active & Waiting Queue)" : "📋 queue    (Kuyruk ve Birleştirme Listesi)", "queue", isEn ? "Lists active downloads, waiting items and deferred merges" : "Aktif indirmeleri, bekleyen kuyruğu ve birleştirme bekleyenleri listeler");
            AddPreset(isEn ? "🚨 errors   (Recent Errors & Warnings)" : "🚨 errors   (Son Hata ve Uyarılar)", "errors 15", isEn ? "Lists last 15 errors and warnings recorded this session" : "Bu oturumda kaydedilen son 15 hata ve uyarıyı listeler");
            AddPreset(isEn ? "📡 verbose  (Toggle Full API Logs)" : "📡 verbose  (Detaylı API Logu Aç/Kapat)", "verbose", isEn ? "Toggles logging of all HTTP polling API requests" : "Tüm HTTP yoklama API isteklerinin konsola yazılmasını açıp kapatır");

            qMenu.Items.Add(new ToolStripSeparator());

            AddPreset(isEn ? "⏸️ pause    (Pause Download Queue)" : "⏸️ pause    (Kuyruğu Duraklat)", "pause", isEn ? "Pauses all downloads safely" : "İndirmeleri güvenle beklemeye alır");
            AddPreset(isEn ? "▶️ resume   (Resume Download Queue)" : "▶️ resume   (Kuyruğu Devam Ettir)", "resume", isEn ? "Resumes paused download queue" : "Duraklatılan indirmeleri devam ettirir");
            AddPreset(isEn ? "📥 pd       (Download Video Link...)" : "📥 pd       (Video Linki İndir...)", "pd https://www.youtube.com/watch?v=", isEn ? "Inserts pd template into box for you to paste URL" : "Kutuya link şablonu yazar, linkinizi yapıştırıp gönderebilirsiniz", autoExecute: false);

            qMenu.Items.Add(new ToolStripSeparator());

            AddPreset(isEn ? "🔄 toggle   (Toggle Turtle Speed Mode)" : "🔄 toggle   (Kaplumbağa Modu Aç/Kapat)", "toggle", isEn ? "Switches between normal and alternative speed limits" : "Normal ve alternatif hız profili arasında geçiş yapar");
            AddPreset(isEn ? "🐢 ton      (Enable Turtle Speed)" : "🐢 ton      (Kaplumbağa Hızını Aç)", "ton", isEn ? "Enables alternative speed limit" : "Alternatif hız profilini aktif hale getirir");
            AddPreset(isEn ? "⚡ toff     (Disable Turtle Speed)" : "⚡ toff     (Kaplumbağa Hızını Kapat)", "toff", isEn ? "Disables turtle speed, returns to normal limit" : "Normal hız limitine döner");
            AddPreset(isEn ? "🚀 speed    (Set Normal Speed...)" : "🚀 speed    (Normal Hız Sınırı...)", "speed 2500", isEn ? "Sets download speed limit in KB/s (e.g. speed 2500 or speed off)" : "Normal indirme hızını KB/s olarak ayarlar (örn: speed 2500 veya speed off)", autoExecute: false);
            AddPreset(isEn ? "🐌 altspeed (Set Turtle Speed...)" : "🐌 altspeed (Kaplumbağa Hız Sınırı...)", "altspeed 500", isEn ? "Sets alternative speed limit in KB/s (e.g. altspeed 500)" : "Kaplumbağa hız profilini KB/s olarak ayarlar (örn: altspeed 500)", autoExecute: false);

            qMenu.Items.Add(new ToolStripSeparator());

            AddPreset(isEn ? "🔍 check    (Scan Followed Channels)" : "🔍 check    (Kanalları RSS ile Tara)", "check", isEn ? "Instantly scans channels for newly uploaded videos" : "Takip edilen kanalları yeni videolar için anında tarar");
            AddPreset(isEn ? "💾 backup   (Take Instant Backup)" : "💾 backup   (Sistem Yedeği Al)", "backup", isEn ? "Takes immediate database and configuration backup" : "Anlık veritabanı ve ayar yedeği oluşturur");
            AddPreset(isEn ? "🧹 fakap    (Run Fakap Maintenance)" : "🧹 fakap    (Fakap Yedeklerini Temizle)", "fakap", isEn ? "Cleans up expired Fakap backups according to retention days" : "Süresi dolan otomatik yedekleri temizler");

            qMenu.Items.Add(new ToolStripSeparator());

            AddPreset(isEn ? "❓ help     (List All CLI Commands)" : "❓ help     (Tüm Komutları Konsola Yaz)", "help", isEn ? "Displays complete guide of all available commands" : "Tüm kullanılabilir komutları konsolda gösterir");
            AddPreset(isEn ? "🧹 clear    (Clear Terminal Screen)" : "🧹 clear    (Terminal Ekranını Temizle)", "clear", isEn ? "Clears output logs from current window" : "Terminal penceresindeki yazıları temizler");
            AddPreset(isEn ? "🛑 stop     (Safely Terminate App)" : "🛑 stop     (Uygulamayı Güvenle Kapat)", "stop", isEn ? "Shuts down server and closes application" : "Sunucuyu ve uygulamayı güvenle kapatır");

            return qMenu;
        }

        public void Show()
        {
            if (_logForm != null && !_logForm.IsDisposed)
            {
                if (_logForm.WindowState == FormWindowState.Minimized)
                {
                    _logForm.WindowState = FormWindowState.Normal;
                }
                _logForm.Focus();
                return;
            }

            StartDetachedLogSyncIfNeeded();

            string theme = _getTheme();
            bool isDark = !string.Equals(theme, "light", StringComparison.OrdinalIgnoreCase);
            bool isEn = !string.Equals(_getLanguage(), "tr", StringComparison.OrdinalIgnoreCase);

            Color formBg = isDark ? Color.FromArgb(16, 17, 24) : Color.FromArgb(241, 243, 248);
            Color barBg = isDark ? Color.FromArgb(24, 26, 38) : Color.FromArgb(232, 235, 243);
            Color hudBg = isDark ? Color.FromArgb(20, 22, 32) : Color.FromArgb(224, 228, 238);
            Color hudFg = isDark ? Color.FromArgb(215, 222, 238) : Color.FromArgb(30, 36, 48);
            Color pillBg = isDark ? Color.FromArgb(36, 39, 56) : Color.FromArgb(212, 217, 230);
            Color pillFg = isDark ? Color.FromArgb(220, 225, 240) : Color.FromArgb(30, 36, 48);
            Color pillActiveBg = Color.FromArgb(124, 58, 237);

            _logForm = new Form();
            _logForm.Text = isEn ? "Multimedia HaYTooL - Terminal Output & Console" : "Multimedia HaYTooL - Terminal Çıktısı & Konsol";
            _logForm.Size = new Size(1120, 700);
            _logForm.MinimumSize = new Size(880, 520);
            _logForm.StartPosition = FormStartPosition.CenterScreen;
            _logForm.BackColor = formBg;

            string iconPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "icon.ico");
            if (File.Exists(iconPath))
            {
                try { _logForm.Icon = new Icon(iconPath); } catch {}
            }

            TableLayoutPanel mainLayout = new TableLayoutPanel();
            mainLayout.Dock = DockStyle.Fill;
            mainLayout.RowCount = 4;
            mainLayout.RowStyles.Add(new RowStyle(SizeType.Absolute, 36F));
            mainLayout.RowStyles.Add(new RowStyle(SizeType.Absolute, 42F));
            mainLayout.RowStyles.Add(new RowStyle(SizeType.Percent, 100F));
            mainLayout.RowStyles.Add(new RowStyle(SizeType.Absolute, 54F));

            FlowLayoutPanel hudPanel = new FlowLayoutPanel();
            hudPanel.Dock = DockStyle.Fill;
            hudPanel.BackColor = hudBg;
            hudPanel.Padding = new Padding(10, 8, 10, 4);
            hudPanel.WrapContents = false;

            Label MakeHudLabel(string txt, Color fg, bool bold = false)
            {
                return new Label
                {
                    Text = txt,
                    ForeColor = fg,
                    Font = new Font("Segoe UI", 9f, bold ? FontStyle.Bold : FontStyle.Regular),
                    AutoSize = true,
                    Margin = new Padding(0, 0, 16, 0)
                };
            }

            _hudStatusLabel = MakeHudLabel(isEn ? "● Connecting..." : "● Bağlanıyor...", Color.FromArgb(245, 158, 11), true);
            _hudVersionLabel = MakeHudLabel("v--", hudFg, true);
            _hudUptimeLabel = MakeHudLabel("⏱ --:--:--", hudFg);
            _hudRamLabel = MakeHudLabel("🧠 RAM: -- MB", hudFg);
            _hudQueueLabel = MakeHudLabel(isEn ? "⬇ Queue: --" : "⬇ Kuyruk: --", hudFg);
            _hudCookieLabel = MakeHudLabel(isEn ? "🍪 Cookie: --" : "🍪 Çerez: --", hudFg);

            hudPanel.Controls.Add(_hudStatusLabel);
            hudPanel.Controls.Add(_hudVersionLabel);
            hudPanel.Controls.Add(_hudUptimeLabel);
            hudPanel.Controls.Add(_hudRamLabel);
            hudPanel.Controls.Add(_hudQueueLabel);
            hudPanel.Controls.Add(_hudCookieLabel);

            Panel filterBar = new Panel();
            filterBar.Dock = DockStyle.Fill;
            filterBar.BackColor = barBg;
            filterBar.Padding = new Padding(10, 7, 10, 7);

            FlowLayoutPanel filterPills = new FlowLayoutPanel();
            filterPills.Dock = DockStyle.Left;
            filterPills.AutoSize = true;
            filterPills.WrapContents = false;
            filterPills.BackColor = Color.Transparent;

            _filterButtons.Clear();
            var categories = new (string Key, string Label)[]
            {
                ("ALL", isEn ? "All" : "Tümü"),
                ("ERR_WARN", isEn ? "Errors/Warn" : "Hata/Uyarı"),
                ("DOWNLOAD", isEn ? "Download" : "İndirme"),
                ("RSS", "RSS"),
                ("WEBSTREAM", "WebStream"),
                ("IPTV", "IPTV"),
                ("API_CLIENT", isEn ? "API/Client" : "API/Client"),
                ("SYSTEM", isEn ? "System" : "Sistem")
            };

            Action updateFilterPillStyles = () =>
            {
                foreach (var (key, btn) in _filterButtons)
                {
                    bool active = key == _activeFilterCategory;
                    btn.BackColor = active ? pillActiveBg : pillBg;
                    btn.ForeColor = active ? Color.White : pillFg;
                }
            };

            foreach (var (key, label) in categories)
            {
                Button fBtn = new Button
                {
                    Text = label,
                    AutoSize = true,
                    Height = 26,
                    Padding = new Padding(6, 0, 6, 0),
                    Margin = new Padding(0, 0, 5, 0),
                    FlatStyle = FlatStyle.Flat,
                    Font = new Font("Segoe UI", 8.5f, FontStyle.Bold),
                    Cursor = Cursors.Hand
                };
                fBtn.FlatAppearance.BorderSize = 0;
                fBtn.Click += (s, ev) =>
                {
                    _activeFilterCategory = key;
                    updateFilterPillStyles();
                    RebuildConsoleView();
                };
                _filterButtons.Add((key, fBtn));
                filterPills.Controls.Add(fBtn);
            }
            updateFilterPillStyles();

            FlowLayoutPanel rightTools = new FlowLayoutPanel();
            rightTools.Dock = DockStyle.Right;
            rightTools.AutoSize = true;
            rightTools.WrapContents = false;
            rightTools.BackColor = Color.Transparent;

            _searchTextBox = new TextBox
            {
                Width = 170,
                Height = 26,
                Font = new Font("Segoe UI", 9f),
                BackColor = isDark ? Color.FromArgb(32, 34, 48) : Color.White,
                ForeColor = isDark ? Color.White : Color.FromArgb(24, 24, 27),
                PlaceholderText = isEn ? "Filter logs..." : "Loglarda ara...",
                Text = _searchQuery,
                Margin = new Padding(0, 1, 6, 0)
            };
            _searchTextBox.TextChanged += (s, ev) =>
            {
                _searchQuery = _searchTextBox.Text.Trim();
                RebuildConsoleView();
            };

            Button MakeToolBtn(string txt, Color bg)
            {
                var b = new Button
                {
                    Text = txt,
                    AutoSize = true,
                    Height = 26,
                    Padding = new Padding(6, 0, 6, 0),
                    Margin = new Padding(0, 0, 5, 0),
                    FlatStyle = FlatStyle.Flat,
                    BackColor = bg,
                    ForeColor = Color.White,
                    Font = new Font("Segoe UI", 8.5f, FontStyle.Bold),
                    Cursor = Cursors.Hand
                };
                b.FlatAppearance.BorderSize = 0;
                return b;
            }

            _autoScrollButton = MakeToolBtn(
                _autoScroll ? (isEn ? "⬇ Follow" : "⬇ Takip") : (isEn ? "⏸ Paused" : "⏸ Duraklatıldı"),
                _autoScroll ? Color.FromArgb(16, 185, 129) : Color.FromArgb(245, 158, 11)
            );
            _autoScrollButton.Click += (s, ev) =>
            {
                _autoScroll = !_autoScroll;
                _autoScrollButton.Text = _autoScroll ? (isEn ? "⬇ Follow" : "⬇ Takip") : (isEn ? "⏸ Paused" : "⏸ Duraklatıldı");
                _autoScrollButton.BackColor = _autoScroll ? Color.FromArgb(16, 185, 129) : Color.FromArgb(245, 158, 11);
                if (_autoScroll && _logTextBox != null && !_logTextBox.IsDisposed)
                {
                    _logTextBox.SelectionStart = _logTextBox.TextLength;
                    _logTextBox.ScrollToCaret();
                }
            };

            Button copyButton = MakeToolBtn(isEn ? "📋 Copy" : "📋 Kopyala", Color.FromArgb(59, 130, 246));
            copyButton.Click += (s, ev) =>
            {
                if (_logTextBox == null || _logTextBox.IsDisposed) return;
                string toCopy = !string.IsNullOrEmpty(_logTextBox.SelectedText) ? _logTextBox.SelectedText : _logTextBox.Text;
                if (!string.IsNullOrEmpty(toCopy))
                {
                    try { Clipboard.SetText(toCopy); } catch {}
                }
            };

            Button exportButton = MakeToolBtn(isEn ? "💾 Export" : "💾 Dışa Aktar", Color.FromArgb(99, 102, 241));
            exportButton.Click += (s, ev) =>
            {
                using var sfd = new SaveFileDialog
                {
                    Filter = "Log Dosyası (*.log)|*.log|Metin Dosyası (*.txt)|*.txt",
                    FileName = $"haytool_console_{DateTime.Now:yyyyMMdd_HHmmss}.log"
                };
                if (sfd.ShowDialog() == DialogResult.OK)
                {
                    var sb = new StringBuilder();
                    lock (_bufferLock)
                    {
                        foreach (var entry in _consoleEntries)
                        {
                            if (MatchesFilter(entry)) sb.Append(entry.Text);
                        }
                    }
                    File.WriteAllText(sfd.FileName, sb.ToString(), Encoding.UTF8);
                }
            };

            rightTools.Controls.Add(_searchTextBox);
            rightTools.Controls.Add(_autoScrollButton);
            rightTools.Controls.Add(copyButton);
            rightTools.Controls.Add(exportButton);

            filterBar.Controls.Add(filterPills);
            filterBar.Controls.Add(rightTools);

            _logTextBox = new RichTextBox();
            _logTextBox.ReadOnly = true;
            _logTextBox.Dock = DockStyle.Fill;
            _logTextBox.BackColor = Color.FromArgb(10, 11, 18);
            _logTextBox.ForeColor = Color.FromArgb(236, 238, 244);
            _logTextBox.Font = new Font("Consolas", 11f);
            _logTextBox.BorderStyle = BorderStyle.None;
            _logTextBox.DetectUrls = false;

            RebuildConsoleView();

            Panel commandPanel = new Panel();
            commandPanel.Dock = DockStyle.Fill;
            commandPanel.BackColor = barBg;
            commandPanel.Padding = new Padding(10);

            _cmdLabel = new Label();
            _cmdLabel.Text = isEn ? "Command:" : "Komut:";
            _cmdLabel.ForeColor = isDark ? Color.FromArgb(240, 240, 240) : Color.FromArgb(24, 24, 27);
            _cmdLabel.Font = new Font("Segoe UI", 9.5f, FontStyle.Bold);
            _cmdLabel.AutoSize = true;
            _cmdLabel.Location = new Point(10, 17);

            ComboBox commandComboBox = new ComboBox();
            commandComboBox.Font = new Font("Consolas", 10.5f);
            commandComboBox.BackColor = isDark ? Color.FromArgb(32, 34, 48) : Color.White;
            commandComboBox.ForeColor = isDark ? Color.White : Color.FromArgb(24, 24, 27);
            commandComboBox.Location = new Point(78, 13);
            commandComboBox.Size = new Size(commandPanel.ClientSize.Width - 525, 26);
            commandComboBox.Anchor = AnchorStyles.Left | AnchorStyles.Right | AnchorStyles.Top;
            commandComboBox.Items.AddRange(new string[] {
                "diag", "queue", "errors 15", "verbose on", "verbose off", "help", "status", "pause", "resume", "ton", "toff", "toggle", "speed", "altspeed", "pd", "check", "backup", "fakap", "clear", "stop"
            });

            Action<string> executeCmd = (cmd) =>
            {
                if (string.IsNullOrWhiteSpace(cmd)) return;
                string trimmed = cmd.Trim();
                if (_cmdHistory.Count == 0 || _cmdHistory[_cmdHistory.Count - 1] != trimmed)
                {
                    _cmdHistory.Add(trimmed);
                    if (_cmdHistory.Count > 50) _cmdHistory.RemoveAt(0);
                }
                _cmdHistoryIndex = _cmdHistory.Count;

                string lower = trimmed.ToLowerInvariant();
                if (lower == "clear")
                {
                    lock (_bufferLock) { _consoleEntries.Clear(); }
                    _logTextBox?.Clear();
                }
                else if (lower == "exit" || lower == "quit" || lower == "stop")
                {
                    _onExitRequested();
                }
                else
                {
                    _sendCommand(trimmed);
                }
            };

            Button quickCmdButton = new Button();
            quickCmdButton.Text = isEn ? "⚡ Presets ▾" : "⚡ Hızlı Komutlar ▾";
            quickCmdButton.Font = new Font("Segoe UI", 9f, FontStyle.Bold);
            quickCmdButton.BackColor = Color.FromArgb(124, 58, 237);
            quickCmdButton.ForeColor = Color.White;
            quickCmdButton.FlatStyle = FlatStyle.Flat;
            quickCmdButton.FlatAppearance.BorderSize = 0;
            quickCmdButton.Location = new Point(commandPanel.ClientSize.Width - 435, 12);
            quickCmdButton.Size = new Size(140, 28);
            quickCmdButton.Anchor = AnchorStyles.Right | AnchorStyles.Top;
            quickCmdButton.Cursor = Cursors.Hand;

            ContextMenuStrip quickMenu = BuildQuickCmdMenu(commandComboBox, executeCmd);
            quickCmdButton.Click += (s, ev) =>
            {
                quickMenu.Show(quickCmdButton, new Point(0, quickCmdButton.Height + 2));
            };

            _sendButton = new Button();
            _sendButton.Text = isEn ? "Send" : "Gönder";
            _sendButton.Font = new Font("Segoe UI", 9f, FontStyle.Bold);
            _sendButton.BackColor = Color.FromArgb(16, 185, 129);
            _sendButton.ForeColor = Color.White;
            _sendButton.FlatStyle = FlatStyle.Flat;
            _sendButton.FlatAppearance.BorderSize = 0;
            _sendButton.Location = new Point(commandPanel.ClientSize.Width - 285, 12);
            _sendButton.Size = new Size(85, 28);
            _sendButton.Anchor = AnchorStyles.Right | AnchorStyles.Top;
            _sendButton.Cursor = Cursors.Hand;

            _clearButton = new Button();
            _clearButton.Text = isEn ? "Clear" : "Temizle";
            _clearButton.Font = new Font("Segoe UI", 9f, FontStyle.Bold);
            _clearButton.BackColor = Color.FromArgb(245, 158, 11);
            _clearButton.ForeColor = Color.White;
            _clearButton.FlatStyle = FlatStyle.Flat;
            _clearButton.FlatAppearance.BorderSize = 0;
            _clearButton.Location = new Point(commandPanel.ClientSize.Width - 190, 12);
            _clearButton.Size = new Size(85, 28);
            _clearButton.Anchor = AnchorStyles.Right | AnchorStyles.Top;
            _clearButton.Cursor = Cursors.Hand;

            _clearButton.Click += (s, ev) =>
            {
                lock (_bufferLock) { _consoleEntries.Clear(); }
                _logTextBox?.Clear();
            };

            _openLogButton = new Button();
            _openLogButton.Text = isEn ? "Logs" : "Loglar";
            _openLogButton.Font = new Font("Segoe UI", 9f, FontStyle.Bold);
            _openLogButton.BackColor = Color.FromArgb(14, 165, 233);
            _openLogButton.ForeColor = Color.White;
            _openLogButton.FlatStyle = FlatStyle.Flat;
            _openLogButton.FlatAppearance.BorderSize = 0;
            _openLogButton.Location = new Point(commandPanel.ClientSize.Width - 95, 12);
            _openLogButton.Size = new Size(85, 28);
            _openLogButton.Anchor = AnchorStyles.Right | AnchorStyles.Top;
            _openLogButton.Cursor = Cursors.Hand;

            _openLogButton.Click += (s, ev) =>
            {
                string targetLogsDir = (!string.IsNullOrEmpty(_latestLogsDir) && Directory.Exists(_latestLogsDir))
                    ? _latestLogsDir
                    : Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "logs");

                if (Directory.Exists(targetLogsDir))
                {
                    Process.Start(new ProcessStartInfo("explorer.exe", targetLogsDir) { UseShellExecute = true });
                }
                else
                {
                    MessageBox.Show(
                        isEn ? "Logs folder could not be found." : "Log klasörü bulunamadı.",
                        isEn ? "Info" : "Bilgi",
                        MessageBoxButtons.OK,
                        MessageBoxIcon.Information
                    );
                }
            };

            commandComboBox.KeyDown += (s, ev) =>
            {
                if (ev.KeyCode == Keys.Enter)
                {
                    ev.SuppressKeyPress = true;
                    string cmd = commandComboBox.Text.Trim();
                    if (!string.IsNullOrEmpty(cmd))
                    {
                        executeCmd(cmd);
                        commandComboBox.Text = "";
                    }
                }
                else if (ev.KeyCode == Keys.Up && !commandComboBox.DroppedDown && _cmdHistory.Count > 0)
                {
                    ev.SuppressKeyPress = true;
                    if (_cmdHistoryIndex < 0 || _cmdHistoryIndex > _cmdHistory.Count) _cmdHistoryIndex = _cmdHistory.Count;
                    if (_cmdHistoryIndex > 0) _cmdHistoryIndex--;
                    commandComboBox.Text = _cmdHistory[_cmdHistoryIndex];
                    commandComboBox.SelectionStart = commandComboBox.Text.Length;
                }
                else if (ev.KeyCode == Keys.Down && !commandComboBox.DroppedDown && _cmdHistory.Count > 0)
                {
                    ev.SuppressKeyPress = true;
                    if (_cmdHistoryIndex < _cmdHistory.Count - 1)
                    {
                        _cmdHistoryIndex++;
                        commandComboBox.Text = _cmdHistory[_cmdHistoryIndex];
                        commandComboBox.SelectionStart = commandComboBox.Text.Length;
                    }
                    else
                    {
                        _cmdHistoryIndex = _cmdHistory.Count;
                        commandComboBox.Text = "";
                    }
                }
            };

            _sendButton.Click += (s, ev) =>
            {
                string cmd = commandComboBox.Text.Trim();
                if (!string.IsNullOrEmpty(cmd))
                {
                    executeCmd(cmd);
                    commandComboBox.Text = "";
                    commandComboBox.Focus();
                }
            };

            commandPanel.Controls.Add(_cmdLabel);
            commandPanel.Controls.Add(commandComboBox);
            commandPanel.Controls.Add(quickCmdButton);
            commandPanel.Controls.Add(_sendButton);
            commandPanel.Controls.Add(_clearButton);
            commandPanel.Controls.Add(_openLogButton);

            mainLayout.Controls.Add(hudPanel, 0, 0);
            mainLayout.Controls.Add(filterBar, 0, 1);
            mainLayout.Controls.Add(_logTextBox, 0, 2);
            mainLayout.Controls.Add(commandPanel, 0, 3);

            _consoleStatsTimer = new System.Windows.Forms.Timer { Interval = 2500 };
            _consoleStatsTimer.Tick += async (s, ev) => await FetchAndRenderConsoleStatsAsync();
            _consoleStatsTimer.Start();

            _logForm.FormClosed += (s, ev) =>
            {
                if (_consoleStatsTimer != null)
                {
                    _consoleStatsTimer.Stop();
                    _consoleStatsTimer.Dispose();
                    _consoleStatsTimer = null;
                }
            };

            _logForm.Controls.Add(mainLayout);
            _logForm.Show();
            _ = FetchAndRenderConsoleStatsAsync();
        }

        public void Dispose()
        {
            try { _sseCts?.Cancel(); _sseCts?.Dispose(); _sseCts = null; } catch {}
            if (_consoleStatsTimer != null)
            {
                _consoleStatsTimer.Stop();
                _consoleStatsTimer.Dispose();
                _consoleStatsTimer = null;
            }
            try { _boldConsoleFont?.Dispose(); _boldConsoleFont = null; } catch {}
        }
    }
}
