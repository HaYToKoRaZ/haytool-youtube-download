using System;
using System.Diagnostics;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;
using System.IO;
using System.Net;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading;
using System.Windows.Forms;
using Microsoft.Win32;

namespace HaYTooLPlayer
{
    public class TrayManager : IDisposable
    {
        private readonly MainWindow _mainWindow;
        private NotifyIcon? _trayIcon;
        private Icon? _defaultTrayIcon;
        private Icon? _normalTrayIcon;
        private Icon? _glowingTrayIcon;
        private System.Windows.Forms.Timer? _downloadMonitorTimer;

        private bool _isGlowState = false;
        private bool _isDownloadingActive = false;
        private bool _isQueryingStatus = false;
        private Process? _nodeProcess;
        private string _currentLang = "tr";

        // Menü Öğeleri
        private ToolStripMenuItem? _openUiItem;
        private ToolStripMenuItem? _youtubeLoginItem;
        private ToolStripMenuItem? _pasteDownloadItem;
        private ToolStripMenuItem? _shortcutsMenu;
        private ToolStripMenuItem? _settingsItem;
        private ToolStripMenuItem? _checkChannelsItem;
        private ToolStripMenuItem? _altSpeedItem;
        private ToolStripMenuItem? _bootItem;
        private ToolStripMenuItem? _discordRpcItem;
        private ToolStripMenuItem? _showConsoleItem;
        private ToolStripMenuItem? _restartItem;
        private ToolStripMenuItem? _exitItem;

        // Konsol Penceresi ve Bellek Tamponu
        private readonly StringBuilder _consoleBuffer = new StringBuilder();
        private readonly object _bufferLock = new object();
        private Form? _logForm;
        private RichTextBox? _logTextBox;
        private Label? _cmdLabel;
        private Button? _sendButton;
        private Button? _clearButton;
        private Button? _openLogButton;

        public TrayManager(MainWindow mainWindow)
        {
            _mainWindow = mainWindow;
            InitTray();
            StartNode();
        }

        private void InitTray()
        {
            try
            {
                _trayIcon = new NotifyIcon();
                _trayIcon.Text = "Multimedia HaYTooL";

                string iconPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "icon.ico");
                if (File.Exists(iconPath))
                {
                    try { _defaultTrayIcon = new Icon(iconPath); }
                    catch { _defaultTrayIcon = SystemIcons.Application; }
                }
                else
                {
                    _defaultTrayIcon = SystemIcons.Application;
                }

                _trayIcon.Icon = _defaultTrayIcon;
                bool isSilent = IsSilentMode();
                _trayIcon.Visible = !isSilent;

                // Çift tıklayınca kullanıcının seçtiği ortamı aç (WPF Oynatıcı, Edge App Modu veya Sistem Tarayıcısı)
                _trayIcon.DoubleClick += (s, e) => ExecutePreferredOpenAction("/downlist");

                ContextMenuStrip menu = new ContextMenuStrip();
                _openUiItem = new ToolStripMenuItem("Arayüzü Aç", null, (s, e) => ExecutePreferredOpenAction("/downlist"));
                _youtubeLoginItem = new ToolStripMenuItem("YouTube'da Oturum Aç", null, (s, e) => _mainWindow.OpenYouTubeCookieWindow("https://accounts.google.com/ServiceLogin?service=youtube&continue=https%3A%2F%2Fwww.youtube.com", false));
                _checkChannelsItem = new ToolStripMenuItem("Kanalları Denetle", null, TriggerCheckChannels);
                _pasteDownloadItem = new ToolStripMenuItem("Panodan İndir", null, PasteAndDownload);

                _shortcutsMenu = new ToolStripMenuItem("Sekmelere Git");
                _shortcutsMenu.DropDownItems.Add(new ToolStripMenuItem("Kütüphane", null, (s, e) => ExecutePreferredOpenAction("/home")));
                _shortcutsMenu.DropDownItems.Add(new ToolStripMenuItem("İndirme Sırası", null, (s, e) => ExecutePreferredOpenAction("/download")));
                _shortcutsMenu.DropDownItems.Add(new ToolStripMenuItem("İndirilenler", null, (s, e) => ExecutePreferredOpenAction("/downlist")));
                _shortcutsMenu.DropDownItems.Add(new ToolStripMenuItem("Kanallar", null, (s, e) => ExecutePreferredOpenAction("/channels")));
                _shortcutsMenu.DropDownItems.Add(new ToolStripMenuItem("Ayarlar", null, (s, e) => ExecutePreferredOpenAction("/settings")));

                _settingsItem = new ToolStripMenuItem("Ayarlar", null, (s, e) => ExecutePreferredOpenAction("/settings"));

                _altSpeedItem = new ToolStripMenuItem("Alternatif Hız Sınırı (Turtle)", null, ToggleAlternativeSpeed);
                _altSpeedItem.Checked = GetIniBoolSetting("useAlternativeSpeed");

                _bootItem = new ToolStripMenuItem("Sistem Başlangıcında Çalıştır", null, (s, e) =>
                {
                    bool cur = GetStartOnBootSetting();
                    SetStartOnBoot(!cur);
                    if (_bootItem != null) _bootItem.Checked = !cur;
                });
                _bootItem.Checked = GetStartOnBootSetting();

                _discordRpcItem = new ToolStripMenuItem("Discord Durumu", null, ToggleDiscordRpc);
                _discordRpcItem.Checked = GetIniBoolSetting("discordRpcEnabled");

                _restartItem = new ToolStripMenuItem("Sunucuyu Yeniden Başlat", null, (s, e) => RestartNode());
                _showConsoleItem = new ToolStripMenuItem("Konsol Çıktısını Göster", null, (s, e) => ShowConsoleWindow());
                _exitItem = new ToolStripMenuItem("Çıkış", null, (s, e) => ExitApplication());

                menu.Items.Add(_openUiItem);
                menu.Items.Add(_youtubeLoginItem);
                menu.Items.Add(_settingsItem);
                menu.Items.Add(_checkChannelsItem);
                menu.Items.Add(_pasteDownloadItem);
                menu.Items.Add(_shortcutsMenu);
                menu.Items.Add(_altSpeedItem);
                menu.Items.Add(_bootItem);
                menu.Items.Add(_discordRpcItem);
                menu.Items.Add(new ToolStripSeparator());
                menu.Items.Add(_restartItem);
                menu.Items.Add(_showConsoleItem);
                menu.Items.Add(new ToolStripSeparator());
                menu.Items.Add(_exitItem);

                // Menü her açıldığında onay işaretlerini güncel INI ve Kayıt Defteri durumuna göre yenile
                menu.Opening += (s, e) =>
                {
                    if (_altSpeedItem != null) _altSpeedItem.Checked = GetIniBoolSetting("useAlternativeSpeed");
                    if (_bootItem != null) _bootItem.Checked = GetStartOnBootSetting();
                    if (_discordRpcItem != null) _discordRpcItem.Checked = GetIniBoolSetting("discordRpcEnabled");
                };

                _trayIcon.ContextMenuStrip = menu;

                _currentLang = GetLanguageSetting();
                ApplyLanguage(_currentLang);

                StartDownloadMonitor();
            }
            catch (Exception ex)
            {
                Debug.WriteLine("[TrayManager] Init error: " + ex.Message);
            }
        }

        public void EnsureTrayVisible()
        {
            try
            {
                if (_trayIcon != null && !_trayIcon.Visible)
                {
                    _trayIcon.Visible = true;
                }
            }
            catch {}
        }

        public void ShowMainWindow(string? path = null)
        {
            _mainWindow.Dispatcher.Invoke(() =>
            {
                if (!_mainWindow.IsVisible)
                {
                    _mainWindow.Show();
                }
                if (_mainWindow.WindowState == System.Windows.WindowState.Minimized)
                {
                    _mainWindow.WindowState = System.Windows.WindowState.Maximized;
                }
                _mainWindow.Activate();
                _mainWindow.Focus();

                // Eğer varsayılan /downlist tetiklenmişse veya path boşsa, oynatılan videoyu ve mevcut sayfayı kesmemek için ASLA reload yapma!
                if (string.IsNullOrEmpty(path) || path == "/downlist" || path == "/")
                {
                    return;
                }

                _mainWindow.NavigatePath(path);
            });
        }

        public void StartNode()
        {
            try
            {
                if (_nodeProcess != null && !_nodeProcess.HasExited) return;

                int port = GetAppPort();
                if (IsPortResponding(port)) return; // Zaten çalışıyor

                string backendPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "bin", "Multimedia HaYTooL Backend.exe");
                ProcessStartInfo psi;

                if (File.Exists(backendPath))
                {
                    psi = new ProcessStartInfo(backendPath, "server.js");
                }
                else
                {
                    psi = new ProcessStartInfo("node", "server.js");
                }

                psi.CreateNoWindow = true;
                psi.UseShellExecute = false;
                psi.WindowStyle = ProcessWindowStyle.Hidden;
                psi.WorkingDirectory = AppDomain.CurrentDomain.BaseDirectory;
                psi.EnvironmentVariables["HAYTOOL_MANAGED_BY_TRAY"] = "1";
                psi.StandardOutputEncoding = Encoding.UTF8;
                psi.StandardErrorEncoding = Encoding.UTF8;
                psi.RedirectStandardOutput = true;
                psi.RedirectStandardError = true;
                psi.RedirectStandardInput = true;

                _nodeProcess = new Process();
                _nodeProcess.StartInfo = psi;

                _nodeProcess.OutputDataReceived += (s, e) =>
                {
                    if (e.Data != null)
                    {
                        AppendLog(e.Data);
                    }
                };

                _nodeProcess.ErrorDataReceived += (s, e) =>
                {
                    if (e.Data != null)
                    {
                        AppendLog("[HATA] " + e.Data);
                    }
                };

                _nodeProcess.Start();
                _nodeProcess.BeginOutputReadLine();
                _nodeProcess.BeginErrorReadLine();
                AppendLog("[TRAY] Backend sunucu süreci başlatıldı.");
            }
            catch (Exception ex)
            {
                Debug.WriteLine("[TrayManager] StartNode error: " + ex.Message);
            }
        }

        public void KillNode()
        {
            try
            {
                if (_nodeProcess != null && !_nodeProcess.HasExited)
                {
                    _nodeProcess.Kill();
                    _nodeProcess.WaitForExit(1000);
                    _nodeProcess.Dispose();
                    _nodeProcess = null;
                }
            }
            catch {}
        }

        private void RestartNode()
        {
            KillNode();
            Thread.Sleep(500);
            StartNode();
        }

        public void ExitApplication()
        {
            try
            {
                Dispose();
                KillNode();
                System.Windows.Application.Current?.Dispatcher?.Invoke(() =>
                {
                    System.Windows.Application.Current.Shutdown();
                });
            }
            catch
            {
                Environment.Exit(0);
            }
        }

        private void StartDownloadMonitor()
        {
            _downloadMonitorTimer = new System.Windows.Forms.Timer();
            _downloadMonitorTimer.Interval = 900;
            _downloadMonitorTimer.Tick += (s, e) =>
            {
                AnimateTrayPulse();
                if (!_isQueryingStatus)
                {
                    _isQueryingStatus = true;
                    ThreadPool.QueueUserWorkItem(state =>
                    {
                        try
                        {
                            string url = GetAppUrl("/api/downloader/active-status");
                            HttpWebRequest request = (HttpWebRequest)WebRequest.Create(url);
                            request.Timeout = 1500;
                            request.Method = "GET";
                            using (WebResponse response = request.GetResponse())
                            using (Stream stream = response.GetResponseStream())
                            using (StreamReader reader = new StreamReader(stream, Encoding.UTF8))
                            {
                                string json = reader.ReadToEnd();
                                var matchActive = Regex.Match(json, "\"activeDownloads\"\\s*:\\s*(\\d+)");
                                int active = 0;
                                if (matchActive.Success) int.TryParse(matchActive.Groups[1].Value, out active);
                                var matchDownloading = Regex.Match(json, "\"isDownloading\"\\s*:\\s*(true|false)");
                                bool downloading = matchDownloading.Success && matchDownloading.Groups[1].Value == "true";

                                _mainWindow.Dispatcher.Invoke(() =>
                                {
                                    _isDownloadingActive = downloading || active > 0;
                                });
                            }
                        }
                        catch {}
                        finally
                        {
                            _isQueryingStatus = false;
                        }
                    });
                }
            };
            _downloadMonitorTimer.Start();
        }

        private void AnimateTrayPulse()
        {
            if (_trayIcon == null) return;
            if (_isDownloadingActive)
            {
                if (_normalTrayIcon == null) _normalTrayIcon = CreateRenderedIcon(_defaultTrayIcon ?? _trayIcon.Icon, false);
                if (_glowingTrayIcon == null) _glowingTrayIcon = CreateRenderedIcon(_defaultTrayIcon ?? _trayIcon.Icon, true);

                _isGlowState = !_isGlowState;
                Icon? target = _isGlowState ? (_glowingTrayIcon ?? _defaultTrayIcon) : (_normalTrayIcon ?? _defaultTrayIcon);
                if (target != null) _trayIcon.Icon = target;
            }
            else
            {
                if (_isGlowState)
                {
                    _isGlowState = false;
                    Icon fallback = _defaultTrayIcon ?? SystemIcons.Application;
                    if (_trayIcon.Icon != fallback) _trayIcon.Icon = fallback;
                }
            }
        }

        private Icon? CreateRenderedIcon(Icon? baseIcon, bool withGlow)
        {
            if (baseIcon == null) return null;
            try
            {
                int size = 32;
                using (Bitmap bmp = new Bitmap(size, size, PixelFormat.Format32bppArgb))
                {
                    using (Graphics g = Graphics.FromImage(bmp))
                    {
                        g.SmoothingMode = SmoothingMode.AntiAlias;
                        g.InterpolationMode = InterpolationMode.HighQualityBicubic;

                        if (withGlow)
                        {
                            using (GraphicsPath path = new GraphicsPath())
                            {
                                path.AddEllipse(1, 1, size - 3, size - 3);
                                using (Pen glowOuter = new Pen(Color.FromArgb(230, 0, 220, 255), 3f))
                                {
                                    g.DrawPath(glowOuter, path);
                                }
                                using (Pen glowInner = new Pen(Color.FromArgb(240, 255, 255, 255), 1.5f))
                                {
                                    g.DrawPath(glowInner, path);
                                }
                            }
                        }

                        int padding = withGlow ? 3 : 2;
                        g.DrawIcon(baseIcon, new Rectangle(padding, padding, size - (padding * 2), size - (padding * 2)));
                    }
                    return Icon.FromHandle(bmp.GetHicon());
                }
            }
            catch
            {
                return baseIcon;
            }
        }

        private void TriggerCheckChannels(object? sender, EventArgs e)
        {
            ThreadPool.QueueUserWorkItem(state =>
            {
                try
                {
                    string url = GetAppUrl("/api/history/sync");
                    HttpWebRequest request = (HttpWebRequest)WebRequest.Create(url);
                    request.Method = "POST";
                    request.ContentType = "application/json";
                    byte[] body = Encoding.UTF8.GetBytes("{\"source\":\"tray\"}");
                    request.ContentLength = body.Length;
                    using (Stream stream = request.GetRequestStream()) stream.Write(body, 0, body.Length);
                    using (WebResponse response = request.GetResponse()) {}
                }
                catch {}
            });
        }

        private void PasteAndDownload(object? sender, EventArgs e)
        {
            try
            {
                if (Clipboard.ContainsText())
                {
                    string text = Clipboard.GetText().Trim();
                    if (text.Contains("youtube.com/") || text.Contains("youtu.be/"))
                    {
                        if (_nodeProcess != null && !_nodeProcess.HasExited)
                        {
                            _nodeProcess.StandardInput.WriteLine("pd " + text);
                        }
                        ShowMainWindow("/download");
                    }
                    else
                    {
                        System.Windows.MessageBox.Show("Panodaki metin geçerli bir YouTube bağlantısı değil:\n" + text, "Geçersiz Bağlantı", System.Windows.MessageBoxButton.OK, System.Windows.MessageBoxImage.Warning);
                    }
                }
                else
                {
                    System.Windows.MessageBox.Show("Pano boş veya metin içermiyor.", "Pano Boş", System.Windows.MessageBoxButton.OK, System.Windows.MessageBoxImage.Information);
                }
            }
            catch (Exception ex)
            {
                System.Windows.MessageBox.Show("Hata: " + ex.Message, "Pano Hatası", System.Windows.MessageBoxButton.OK, System.Windows.MessageBoxImage.Error);
            }
        }

        private void ToggleAlternativeSpeed(object? sender, EventArgs e)
        {
            if (_altSpeedItem != null)
            {
                _altSpeedItem.Checked = !_altSpeedItem.Checked;
            }

            ThreadPool.QueueUserWorkItem(state =>
            {
                try
                {
                    string url = GetAppUrl("/api/settings/toggle-alt-speed");
                    HttpWebRequest request = (HttpWebRequest)WebRequest.Create(url);
                    request.Method = "POST";
                    request.ContentLength = 0;
                    using (WebResponse response = request.GetResponse()) {}
                }
                catch {}
            });
        }

        private void ToggleDiscordRpc(object? sender, EventArgs e)
        {
            if (_discordRpcItem != null)
            {
                _discordRpcItem.Checked = !_discordRpcItem.Checked;
            }

            ThreadPool.QueueUserWorkItem(state =>
            {
                try
                {
                    string url = GetAppUrl("/api/settings/toggle-discord-rpc");
                    HttpWebRequest request = (HttpWebRequest)WebRequest.Create(url);
                    request.Method = "POST";
                    request.ContentLength = 0;
                    using (WebResponse response = request.GetResponse()) {}
                }
                catch {}
            });
        }

        private bool GetIniBoolSetting(string targetKey, bool defaultValue = false)
        {
            string iniPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "configwin.ini");
            if (File.Exists(iniPath))
            {
                try
                {
                    string[] lines = File.ReadAllLines(iniPath);
                    foreach (string line in lines)
                    {
                        string trimmed = line.Trim();
                        int equalsIdx = trimmed.IndexOf('=');
                        if (equalsIdx != -1)
                        {
                            string key = trimmed.Substring(0, equalsIdx).Trim();
                            string val = trimmed.Substring(equalsIdx + 1).Trim();
                            if (string.Equals(key, targetKey, StringComparison.OrdinalIgnoreCase))
                            {
                                return string.Equals(val, "true", StringComparison.OrdinalIgnoreCase);
                            }
                        }
                    }
                }
                catch {}
            }
            return defaultValue;
        }

        private bool GetStartOnBootSetting()
        {
            try
            {
                using (RegistryKey? rk = Registry.CurrentUser.OpenSubKey(@"SOFTWARE\Microsoft\Windows\CurrentVersion\Run", false))
                {
                    return rk?.GetValue("Multimedia HaYTooL") != null;
                }
            }
            catch { return false; }
        }

        private void SetStartOnBoot(bool start)
        {
            try
            {
                using (RegistryKey? rk = Registry.CurrentUser.OpenSubKey(@"SOFTWARE\Microsoft\Windows\CurrentVersion\Run", true))
                {
                    if (rk != null)
                    {
                        if (start)
                        {
                            string exePath = Process.GetCurrentProcess().MainModule?.FileName ?? "";
                            if (!string.IsNullOrEmpty(exePath)) rk.SetValue("Multimedia HaYTooL", "\"" + exePath + "\"");
                        }
                        else
                        {
                            rk.DeleteValue("Multimedia HaYTooL", false);
                        }
                    }
                }
            }
            catch {}
        }

        private int GetAppPort()
        {
            int port = 4141;
            try
            {
                string iniPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "configwin.ini");
                if (File.Exists(iniPath))
                {
                    foreach (var line in File.ReadAllLines(iniPath))
                    {
                        var trimmed = line.Trim();
                        if (trimmed.StartsWith(";") || trimmed.StartsWith("#")) continue;
                        if (trimmed.ToLower().StartsWith("port"))
                        {
                            var parts = trimmed.Split('=');
                            if (parts.Length > 1 && parts[0].Trim().Equals("port", StringComparison.OrdinalIgnoreCase))
                            {
                                int.TryParse(parts[1].Trim(), out port);
                                break;
                            }
                        }
                    }
                }
            }
            catch {}
            return port;
        }

        private bool IsPortResponding(int port)
        {
            try
            {
                using (var client = new System.Net.Sockets.TcpClient())
                {
                    var result = client.BeginConnect("127.0.0.1", port, null, null);
                    bool ok = result.AsyncWaitHandle.WaitOne(350);
                    if (!ok) return false;
                    client.EndConnect(result);
                    return true;
                }
            }
            catch { return false; }
        }

        public string GetAppUrl(string path = "")
        {
            int port = GetAppPort();
            string cleanPath = string.IsNullOrEmpty(path) ? "" : (path.StartsWith("/") ? path : "/" + path);
            return $"http://localhost:{port}{cleanPath}";
        }

        public void ExecutePreferredOpenAction(string subPath = "/downlist")
        {
            string action = GetDoubleClickActionSetting();
            string url = GetAppUrl(subPath);

            switch (action)
            {
                case "embedded":
                    try
                    {
                        Process.Start(new ProcessStartInfo
                        {
                            FileName = "msedge",
                            Arguments = $"--app=\"{url}\"",
                            UseShellExecute = true
                        });
                    }
                    catch
                    {
                        try
                        {
                            Process.Start(new ProcessStartInfo { FileName = url, UseShellExecute = true });
                        }
                        catch {}
                    }
                    break;

                case "system":
                    try
                    {
                        Process.Start(new ProcessStartInfo { FileName = url, UseShellExecute = true });
                    }
                    catch {}
                    break;

                case "player":
                default:
                    ShowMainWindow(subPath);
                    break;
            }
        }

        public static bool IsSilentMode(string[]? args = null)
        {
            try
            {
                args ??= Environment.GetCommandLineArgs();
                return args != null && args.Any(a =>
                    a.Equals("silent", StringComparison.OrdinalIgnoreCase) ||
                    a.Equals("--silent", StringComparison.OrdinalIgnoreCase) ||
                    a.Equals("/silent", StringComparison.OrdinalIgnoreCase) ||
                    a.Equals("-silent", StringComparison.OrdinalIgnoreCase) ||
                    a.Equals("--headless", StringComparison.OrdinalIgnoreCase) ||
                    a.Equals("/headless", StringComparison.OrdinalIgnoreCase));
            }
            catch
            {
                return false;
            }
        }

        public static bool GetAutoOpenBrowserSetting()
        {
            // 1. configwin.ini kontrol et
            try
            {
                string iniPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "configwin.ini");
                if (File.Exists(iniPath))
                {
                    string[] lines = File.ReadAllLines(iniPath);
                    foreach (string line in lines)
                    {
                        string trimmed = line.Trim();
                        int equalsIdx = trimmed.IndexOf('=');
                        if (equalsIdx != -1)
                        {
                            string key = trimmed.Substring(0, equalsIdx).Trim();
                            string val = trimmed.Substring(equalsIdx + 1).Trim();
                            if (string.Equals(key, "autoOpenBrowser", StringComparison.OrdinalIgnoreCase))
                            {
                                return !string.Equals(val, "false", StringComparison.OrdinalIgnoreCase);
                            }
                        }
                    }
                }
            }
            catch {}

            // 2. db.json kontrol et
            try
            {
                string dbPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "db.json");
                if (File.Exists(dbPath))
                {
                    string content = File.ReadAllText(dbPath, Encoding.UTF8);
                    var match = Regex.Match(content, "\"autoOpenBrowser\"\\s*:\\s*(false|true)", RegexOptions.IgnoreCase);
                    if (match.Success)
                    {
                        return bool.Parse(match.Groups[1].Value);
                    }
                }
            }
            catch {}

            return true; // Varsayılan: true
        }

        public static string GetDoubleClickActionSetting()
        {
            // 1. configwin.ini kontrol et
            try
            {
                string iniPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "configwin.ini");
                if (File.Exists(iniPath))
                {
                    string[] lines = File.ReadAllLines(iniPath);
                    foreach (string line in lines)
                    {
                        string trimmed = line.Trim();
                        int equalsIdx = trimmed.IndexOf('=');
                        if (equalsIdx != -1)
                        {
                            string key = trimmed.Substring(0, equalsIdx).Trim();
                            string val = trimmed.Substring(equalsIdx + 1).Trim();
                            if (string.Equals(key, "doubleClickAction", StringComparison.OrdinalIgnoreCase))
                            {
                                return val.ToLowerInvariant();
                            }
                        }
                    }
                }
            }
            catch {}

            // 2. db.json kontrol et
            try
            {
                string dbPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "db.json");
                if (File.Exists(dbPath))
                {
                    string content = File.ReadAllText(dbPath, Encoding.UTF8);
                    var match = Regex.Match(content, "\"doubleClickAction\"\\s*:\\s*\"([^\"]+)\"", RegexOptions.IgnoreCase);
                    if (match.Success)
                    {
                        return match.Groups[1].Value.ToLowerInvariant();
                    }
                }
            }
            catch {}

            return "player"; // Varsayılan: player
        }

        private string GetLanguageSetting()
        {
            try
            {
                string dbPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "db.json");
                if (File.Exists(dbPath))
                {
                    string content = File.ReadAllText(dbPath, Encoding.UTF8);
                    var match = Regex.Match(content, "\"lang\"\\s*:\\s*\"([^\"]+)\"");
                    if (match.Success) return match.Groups[1].Value.ToLower();
                }
            }
            catch {}
            return "tr";
        }

        private void ApplyLanguage(string lang)
        {
            if (_openUiItem == null) return;
            if (lang == "en")
            {
                _openUiItem.Text = "Open UI";
                if (_youtubeLoginItem != null) _youtubeLoginItem.Text = "Sign In to YouTube";
                if (_checkChannelsItem != null) _checkChannelsItem.Text = "Check Channels";
                if (_pasteDownloadItem != null) _pasteDownloadItem.Text = "Paste & Download";
                if (_shortcutsMenu != null) _shortcutsMenu.Text = "Go to Tabs";
                if (_settingsItem != null) _settingsItem.Text = "Settings";
                if (_altSpeedItem != null) _altSpeedItem.Text = "Alternative Speed Limit (Turtle)";
                if (_bootItem != null) _bootItem.Text = "Run on Windows Startup";
                if (_discordRpcItem != null) _discordRpcItem.Text = "Discord Status";
                if (_showConsoleItem != null) _showConsoleItem.Text = "Show Console Output";
                if (_restartItem != null) _restartItem.Text = "Restart Server";
                if (_exitItem != null) _exitItem.Text = "Exit";
            }
            else
            {
                _openUiItem.Text = "Arayüzü Aç";
                if (_youtubeLoginItem != null) _youtubeLoginItem.Text = "YouTube'da Oturum Aç";
                if (_checkChannelsItem != null) _checkChannelsItem.Text = "Kanalları Denetle";
                if (_pasteDownloadItem != null) _pasteDownloadItem.Text = "Panodan İndir";
                if (_shortcutsMenu != null) _shortcutsMenu.Text = "Sekmelere Git";
                if (_settingsItem != null) _settingsItem.Text = "Ayarlar";
                if (_altSpeedItem != null) _altSpeedItem.Text = "Alternatif Hız Sınırı (Turtle)";
                if (_bootItem != null) _bootItem.Text = "Sistem Başlangıcında Çalıştır";
                if (_discordRpcItem != null) _discordRpcItem.Text = "Discord Durumu";
                if (_showConsoleItem != null) _showConsoleItem.Text = "Konsol Çıktısını Göster";
                if (_restartItem != null) _restartItem.Text = "Sunucuyu Yeniden Başlat";
                if (_exitItem != null) _exitItem.Text = "Çıkış";
            }
        }

        public void SendCommandToNode(string command)
        {
            try
            {
                if (_nodeProcess != null && !_nodeProcess.HasExited)
                {
                    _nodeProcess.StandardInput.WriteLine(command);
                    AppendLog("[GİRDİ] > " + command);
                }
            }
            catch (Exception ex)
            {
                AppendLog("[HATA] Komut iletilemedi: " + ex.Message);
            }
        }

        private void AppendLog(string text)
        {
            if (string.IsNullOrEmpty(text)) return;

            text = Regex.Replace(text, @"\x1b\[[0-9;]*m", "");

            if (!Regex.IsMatch(text, @"^\[\d{2}:\d{2}:\d{2}\]"))
            {
                text = DateTime.Now.ToString("[HH:mm:ss] ") + text;
            }

            string formattedText = text + "\r\n";

            lock (_bufferLock)
            {
                _consoleBuffer.Append(formattedText);
                if (_consoleBuffer.Length > 100000)
                {
                    _consoleBuffer.Remove(0, 50000);
                }
            }

            if (_logForm != null && !_logForm.IsDisposed && _logTextBox != null && !_logTextBox.IsDisposed)
            {
                try
                {
                    _logTextBox.BeginInvoke(new Action(() =>
                    {
                        AppendColoredText(_logTextBox, formattedText);
                        _logTextBox.SelectionStart = _logTextBox.TextLength;
                        _logTextBox.ScrollToCaret();
                    }));
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

            Color bodyColor = Color.FromArgb(220, 220, 220);

            if (bodyPart.Contains("[RSS]"))
            {
                if (bodyPart.Contains("Manuel tetikleme")) bodyColor = Color.FromArgb(255, 140, 0);
                else if (bodyPart.Contains("Sunucu başlangıcı")) bodyColor = Color.FromArgb(186, 85, 211);
                else bodyColor = Color.FromArgb(255, 0, 255);
            }
            else if (bodyPart.Contains("[403 Koruması]") || bodyPart.Contains("[Kuyruk Auto-Retry]") || bodyPart.Contains("[İndirme Fallback]"))
            {
                bodyColor = Color.FromArgb(255, 185, 0);
            }
            else if (bodyPart.Contains("[İndirme Başarılı]") || bodyPart.Contains("[DOWNLOAD OK]") || bodyPart.Contains("İndirme Tamamlandı"))
            {
                bodyColor = Color.FromArgb(46, 204, 113);
            }
            else if (bodyPart.Contains("[CANLI]") || bodyPart.Contains("[CANLI YAYIN]"))
            {
                bodyColor = Color.FromArgb(0, 255, 200);
            }
            else if (bodyPart.Contains("[DOWNLOAD]") || bodyPart.Contains("[İNDİRME]"))
            {
                bodyColor = Color.FromArgb(0, 225, 255);
            }
            else if (bodyPart.Contains("[KOMUT]") || bodyPart.Contains("Komut:"))
            {
                bodyColor = Color.FromArgb(245, 200, 50);
            }
            else if (bodyPart.Contains("[yt-dlp Uyarı]") || bodyPart.Contains("WARNING"))
            {
                bodyColor = Color.FromArgb(255, 160, 50);
            }
            else if (bodyPart.Contains("[DATABASE]"))
            {
                bodyColor = Color.FromArgb(255, 255, 0);
            }
            else if (bodyPart.Contains("[IPTV]"))
            {
                bodyColor = Color.FromArgb(100, 149, 237);
            }
            else if (bodyPart.Contains("[SYSTEM]") || bodyPart.Contains("[TRAY]"))
            {
                bodyColor = Color.FromArgb(50, 205, 50);
            }
            else if (bodyPart.Contains("[HATA]") || bodyPart.Contains("[ERROR]"))
            {
                bodyColor = Color.FromArgb(255, 60, 60);
            }

            if (!string.IsNullOrEmpty(timestampPart))
            {
                Color timestampColor = Color.FromArgb(170, 175, 210);
                box.SelectionStart = box.TextLength;
                box.SelectionLength = 0;
                box.SelectionColor = timestampColor;
                box.SelectionFont = box.Font;
                box.AppendText(timestampPart);
            }

            Font defaultFont = box.Font;
            Font boldFont = defaultFont;
            try { boldFont = new Font(box.Font, FontStyle.Bold); } catch { boldFont = defaultFont; }

            Color counterColor = Color.FromArgb(255, 215, 0);
            Color nameColor = Color.FromArgb(0, 240, 255);

            var regex = new Regex(@"(\b\d+\/\d+\b)|(""[^""]+"")");
            int lastIndex = 0;

            foreach (Match m in regex.Matches(bodyPart))
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

        private void ShowConsoleWindow()
        {
            if (_logForm != null && !_logForm.IsDisposed)
            {
                _logForm.Focus();
                return;
            }

            _logForm = new Form();
            _logForm.Text = _currentLang == "en" ? "Multimedia HaYTooL - Console Output" : "Multimedia HaYTooL - Terminal Çıktısı";
            _logForm.Size = new Size(950, 600);
            _logForm.StartPosition = FormStartPosition.CenterScreen;

            string iconPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "icon.ico");
            if (File.Exists(iconPath))
            {
                try { _logForm.Icon = new Icon(iconPath); } catch {}
            }

            TableLayoutPanel mainLayout = new TableLayoutPanel();
            mainLayout.Dock = DockStyle.Fill;
            mainLayout.RowCount = 2;
            mainLayout.RowStyles.Add(new RowStyle(SizeType.Percent, 100F));
            mainLayout.RowStyles.Add(new RowStyle(SizeType.Absolute, 55F));

            _logTextBox = new RichTextBox();
            _logTextBox.ReadOnly = true;
            _logTextBox.Dock = DockStyle.Fill;
            _logTextBox.BackColor = Color.FromArgb(15, 14, 32);
            _logTextBox.ForeColor = Color.FromArgb(220, 220, 220);
            _logTextBox.Font = new Font("Consolas", 12f);

            lock (_bufferLock)
            {
                string[] lines = _consoleBuffer.ToString().Split(new[] { "\r\n", "\r", "\n" }, StringSplitOptions.None);
                foreach (var line in lines)
                {
                    if (string.IsNullOrEmpty(line)) continue;
                    AppendColoredText(_logTextBox, line + "\r\n");
                }
            }

            _logTextBox.SelectionStart = _logTextBox.TextLength;
            _logTextBox.ScrollToCaret();

            mainLayout.Controls.Add(_logTextBox, 0, 0);

            Panel commandPanel = new Panel();
            commandPanel.Dock = DockStyle.Fill;
            commandPanel.BackColor = Color.FromArgb(25, 24, 45);
            commandPanel.Padding = new Padding(10);

            _cmdLabel = new Label();
            _cmdLabel.Text = _currentLang == "en" ? "Command:" : "Komut:";
            _cmdLabel.ForeColor = Color.White;
            _cmdLabel.Font = new Font("Segoe UI", 10f, FontStyle.Bold);
            _cmdLabel.AutoSize = true;
            _cmdLabel.Location = new Point(10, 17);

            ComboBox commandComboBox = new ComboBox();
            commandComboBox.Font = new Font("Consolas", 11f);
            commandComboBox.BackColor = Color.FromArgb(35, 34, 55);
            commandComboBox.ForeColor = Color.White;
            commandComboBox.Location = new Point(70, 14);
            commandComboBox.Size = new Size(660, 26);
            commandComboBox.Anchor = AnchorStyles.Left | AnchorStyles.Right | AnchorStyles.Top;
            commandComboBox.Items.AddRange(new string[] {
                "help",
                "status",
                "ton",
                "toff",
                "toggle",
                "speed",
                "altspeed",
                "pd",
                "clear"
            });

            _sendButton = new Button();
            _sendButton.Text = _currentLang == "en" ? "Send" : "Gönder";
            _sendButton.Font = new Font("Segoe UI", 9f, FontStyle.Bold);
            _sendButton.BackColor = Color.FromArgb(40, 180, 99);
            _sendButton.ForeColor = Color.White;
            _sendButton.FlatStyle = FlatStyle.Flat;
            _sendButton.FlatAppearance.BorderSize = 0;
            _sendButton.Location = new Point(575, 13);
            _sendButton.Size = new Size(80, 28);
            _sendButton.Anchor = AnchorStyles.Right | AnchorStyles.Top;

            _clearButton = new Button();
            _clearButton.Text = _currentLang == "en" ? "Clear" : "Temizle";
            _clearButton.Font = new Font("Segoe UI", 9f, FontStyle.Bold);
            _clearButton.BackColor = Color.FromArgb(230, 126, 34);
            _clearButton.ForeColor = Color.White;
            _clearButton.FlatStyle = FlatStyle.Flat;
            _clearButton.FlatAppearance.BorderSize = 0;
            _clearButton.Location = new Point(660, 13);
            _clearButton.Size = new Size(80, 28);
            _clearButton.Anchor = AnchorStyles.Right | AnchorStyles.Top;

            _clearButton.Click += (s, ev) =>
            {
                lock (_bufferLock) { _consoleBuffer.Length = 0; }
                _logTextBox.Clear();
            };

            _openLogButton = new Button();
            _openLogButton.Text = _currentLang == "en" ? "Open" : "Aç";
            _openLogButton.Font = new Font("Segoe UI", 9f, FontStyle.Bold);
            _openLogButton.BackColor = Color.FromArgb(41, 128, 185);
            _openLogButton.ForeColor = Color.White;
            _openLogButton.FlatStyle = FlatStyle.Flat;
            _openLogButton.FlatAppearance.BorderSize = 0;
            _openLogButton.Location = new Point(745, 13);
            _openLogButton.Size = new Size(80, 28);
            _openLogButton.Anchor = AnchorStyles.Right | AnchorStyles.Top;

            _openLogButton.Click += (s, ev) =>
            {
                string logsDir = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "logs");
                if (Directory.Exists(logsDir))
                {
                    Process.Start(new ProcessStartInfo("explorer.exe", logsDir) { UseShellExecute = true });
                }
                else
                {
                    System.Windows.Forms.MessageBox.Show("Log klasörü bulunamadı.", "Bilgi", MessageBoxButtons.OK, MessageBoxIcon.Information);
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
                        string lower = cmd.ToLowerInvariant();
                        if (lower == "clear")
                        {
                            lock (_bufferLock) { _consoleBuffer.Length = 0; }
                            _logTextBox.Clear();
                        }
                        else if (lower == "exit" || lower == "quit" || lower == "stop")
                        {
                            ExitApplication();
                            return;
                        }
                        else
                        {
                            SendCommandToNode(cmd);
                        }
                        commandComboBox.Text = "";
                    }
                }
            };

            _sendButton.Click += (s, ev) =>
            {
                string cmd = commandComboBox.Text.Trim();
                if (!string.IsNullOrEmpty(cmd))
                {
                    string lower = cmd.ToLowerInvariant();
                    if (lower == "clear")
                    {
                        lock (_bufferLock) { _consoleBuffer.Length = 0; }
                        _logTextBox.Clear();
                    }
                    else if (lower == "exit" || lower == "quit" || lower == "stop")
                    {
                        ExitApplication();
                        return;
                    }
                    else
                    {
                        SendCommandToNode(cmd);
                    }
                    commandComboBox.Text = "";
                    commandComboBox.Focus();
                }
            };

            commandPanel.Controls.Add(_cmdLabel);
            commandPanel.Controls.Add(commandComboBox);
            commandPanel.Controls.Add(_sendButton);
            commandPanel.Controls.Add(_clearButton);
            commandPanel.Controls.Add(_openLogButton);

            mainLayout.Controls.Add(commandPanel, 0, 1);
            _logForm.Controls.Add(mainLayout);
            _logForm.Show();
        }

        public void Dispose()
        {
            if (_downloadMonitorTimer != null)
            {
                _downloadMonitorTimer.Stop();
                _downloadMonitorTimer.Dispose();
                _downloadMonitorTimer = null;
            }
            if (_trayIcon != null)
            {
                _trayIcon.Visible = false;
                _trayIcon.Dispose();
                _trayIcon = null;
            }
            if (_defaultTrayIcon != null) _defaultTrayIcon.Dispose();
            if (_normalTrayIcon != null) _normalTrayIcon.Dispose();
            if (_glowingTrayIcon != null) _glowingTrayIcon.Dispose();
        }
    }
}
