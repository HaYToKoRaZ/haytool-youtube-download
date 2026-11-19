using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;
using System.IO;
using System.Net;
using System.Net.Http;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using System.Threading;
using System.Threading.Tasks;
using System.Windows.Forms;
using Microsoft.Win32;

namespace HaYTooLPlayer
{
    public class TrayManager : IDisposable
    {
        private static readonly HttpClient _httpClient = new HttpClient
        {
            Timeout = TimeSpan.FromSeconds(8)
        };

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
        private ContextMenuStrip? _contextMenu;
        private ToolStripMenuItem? _openUiItem;
        private ToolStripMenuItem? _youtubeLoginItem;
        private ToolStripMenuItem? _pasteDownloadItem;
        private ToolStripMenuItem? _shortcutsMenu;
        private ToolStripMenuItem? _settingsItem;
        private ToolStripMenuItem? _checkChannelsItem;
        private ToolStripMenuItem? _altSpeedItem;
        private ToolStripMenuItem? _deferMergeItem;
        private ToolStripMenuItem? _bootItem;
        private ToolStripMenuItem? _discordRpcItem;
        private ToolStripMenuItem? _showConsoleItem;
        private ToolStripMenuItem? _restartItem;
        private ToolStripMenuItem? _exitItem;

        private readonly ConsoleWindowController _console;

        public TrayManager(MainWindow mainWindow)
        {
            _mainWindow = mainWindow;
            _console = new ConsoleWindowController(
                _httpClient,
                GetAppPort,
                () => _currentLang,
                GetThemeSetting,
                () => _nodeProcess != null && !_nodeProcess.HasExited,
                SendCommandToNode,
                ExitApplication
            );
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

                _contextMenu = new ContextMenuStrip();
                ContextMenuStrip menu = _contextMenu;
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

                _deferMergeItem = new ToolStripMenuItem("Oyun Modu (Birleştirmeyi Ertele)", null, ToggleDeferMerge);
                _deferMergeItem.Checked = GetIniBoolSetting("deferMerge");

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
                menu.Items.Add(_deferMergeItem);
                menu.Items.Add(_bootItem);
                menu.Items.Add(_discordRpcItem);
                menu.Items.Add(new ToolStripSeparator());
                menu.Items.Add(_restartItem);
                menu.Items.Add(_showConsoleItem);

                menu.Items.Add(_exitItem);

                // Menü her açıldığında onay işaretlerini ve temayı anında güncelle
                menu.Opening += (s, e) =>
                {
                    ApplyThemeToContextMenu();
                    if (_altSpeedItem != null) _altSpeedItem.Checked = GetIniBoolSetting("useAlternativeSpeed");
                    if (_deferMergeItem != null) _deferMergeItem.Checked = GetIniBoolSetting("deferMerge");
                    if (_bootItem != null) _bootItem.Checked = GetStartOnBootSetting();
                    if (_discordRpcItem != null) _discordRpcItem.Checked = GetIniBoolSetting("discordRpcEnabled");
                };

                _trayIcon.ContextMenuStrip = menu;

                _currentLang = GetLanguageSetting();
                ApplyLanguage(_currentLang);
                ApplyThemeToContextMenu();

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
                EnsureTrayVisible();
                bool wasUnloaded = _mainWindow.RestoreUiIfUnloaded(path);
                _mainWindow.BringWindowToFront(path);

                // Eğer varsayılan /downlist tetiklenmişse, path boşsa veya arayüz uyku modundan yeni uyandırıldıysa tekrar NavigatePath çağırma!
                if (wasUnloaded || string.IsNullOrEmpty(path) || path == "/downlist" || path == "/")
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
                if (IsPortResponding(port))
                {
                    // Harici backend zaten ayakta: SSE ve /api/logs?raw=1 üzerinden bağlan
                    _console.StartDetachedLogSyncIfNeeded();
                    return;
                }

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
                        _console.AppendLog(e.Data);
                    }
                };

                _nodeProcess.ErrorDataReceived += (s, e) =>
                {
                    if (e.Data != null)
                    {
                        _console.AppendLog("[HATA] " + e.Data);
                    }
                };

                _nodeProcess.Start();
                _nodeProcess.BeginOutputReadLine();
                _nodeProcess.BeginErrorReadLine();
                _console.AppendLog("[TRAY] Backend sunucu süreci başlatıldı.");
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

        [System.Runtime.InteropServices.DllImport("kernel32.dll", SetLastError = true)]
        private static extern uint SetThreadExecutionState(uint esFlags);

        private const uint ES_CONTINUOUS = 0x80000000;
        private const uint ES_SYSTEM_REQUIRED = 0x00000001;
        private bool _sleepBlocked = false;

        /// <summary>
        /// Aktif indirme varken Windows uyku/hazırda bekletmeyi engeller (ekran kapanabilir).
        /// Yalnızca durum değiştiğinde çağrılır. SetThreadExecutionState iş parçacığı bazlı olduğundan
        /// her zaman UI iş parçacığından (Dispatcher) çağrılmalıdır.
        /// </summary>
        private void UpdateSleepPrevention(bool shouldBlock)
        {
            if (shouldBlock == _sleepBlocked) return;
            try
            {
                SetThreadExecutionState(shouldBlock ? (ES_CONTINUOUS | ES_SYSTEM_REQUIRED) : ES_CONTINUOUS);
                _sleepBlocked = shouldBlock;
            }
            catch { }
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
                    _ = Task.Run(async () =>
                    {
                        try
                        {
                            string url = GetAppUrl("/api/downloader/active-status");
                            using var cts = new CancellationTokenSource(TimeSpan.FromMilliseconds(1500));
                            string json = await _httpClient.GetStringAsync(url, cts.Token).ConfigureAwait(false);
                            var matchActive = Regex.Match(json, "\"activeDownloads\"\\s*:\\s*(\\d+)");
                            int active = 0;
                            if (matchActive.Success) int.TryParse(matchActive.Groups[1].Value, out active);
                            var matchDownloading = Regex.Match(json, "\"isDownloading\"\\s*:\\s*(true|false)");
                            bool downloading = matchDownloading.Success && matchDownloading.Groups[1].Value == "true";
                            var matchPrevent = Regex.Match(json, "\"preventSleep\"\\s*:\\s*(true|false)");
                            bool preventSleep = !matchPrevent.Success || matchPrevent.Groups[1].Value == "true";

                            _mainWindow.Dispatcher.Invoke(() =>
                            {
                                _isDownloadingActive = downloading || active > 0;
                                UpdateSleepPrevention((downloading || active > 0) && preventSleep);
                            });
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

        private void PostTrayApiFireAndForget(string endpoint, string? jsonBody = null)
        {
            _ = Task.Run(async () =>
            {
                try
                {
                    string url = GetAppUrl(endpoint);
                    using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(5));
                    using HttpContent? content = jsonBody != null
                        ? new StringContent(jsonBody, Encoding.UTF8, "application/json")
                        : null;
                    using var resp = await _httpClient.PostAsync(url, content, cts.Token).ConfigureAwait(false);
                }
                catch {}
            });
        }

        private void TriggerCheckChannels(object? sender, EventArgs e)
        {
            PostTrayApiFireAndForget("/api/history/sync", "{\"source\":\"tray\"}");
        }

        public void PasteAndDownloadCommand(bool openQueueWindow = false, bool silentOnError = false)
        {
            try
            {
                if (Clipboard.ContainsText())
                {
                    string text = Clipboard.GetText().Trim();
                    if (text.StartsWith("http://", StringComparison.OrdinalIgnoreCase) || text.StartsWith("https://", StringComparison.OrdinalIgnoreCase))
                    {
                        SendCommandToNode("pd " + text);
                        if (openQueueWindow)
                        {
                            ShowMainWindow("/download");
                        }
                    }
                    else if (!silentOnError)
                    {
                        System.Windows.MessageBox.Show("Panodaki metin geçerli bir bağlantı (http/https) değil:\n" + text, "Geçersiz Bağlantı", System.Windows.MessageBoxButton.OK, System.Windows.MessageBoxImage.Warning);
                    }
                }
                else if (!silentOnError)
                {
                    System.Windows.MessageBox.Show("Pano boş veya metin içermiyor.", "Pano Boş", System.Windows.MessageBoxButton.OK, System.Windows.MessageBoxImage.Information);
                }
            }
            catch (Exception ex)
            {
                if (!silentOnError)
                {
                    System.Windows.MessageBox.Show("Hata: " + ex.Message, "Pano Hatası", System.Windows.MessageBoxButton.OK, System.Windows.MessageBoxImage.Error);
                }
            }
        }

        private void PasteAndDownload(object? sender, EventArgs e)
        {
            PasteAndDownloadCommand(openQueueWindow: true, silentOnError: false);
        }

        private void ToggleAlternativeSpeed(object? sender, EventArgs e)
        {
            if (_altSpeedItem != null)
            {
                _altSpeedItem.Checked = !_altSpeedItem.Checked;
            }
            PostTrayApiFireAndForget("/api/settings/toggle-alt-speed");
        }

        private void ToggleDeferMerge(object? sender, EventArgs e)
        {
            if (_deferMergeItem != null)
            {
                _deferMergeItem.Checked = !_deferMergeItem.Checked;
            }
            PostTrayApiFireAndForget("/api/settings/toggle-defer-merge");
        }

        private void ToggleDiscordRpc(object? sender, EventArgs e)
        {
            if (_discordRpcItem != null)
            {
                _discordRpcItem.Checked = !_discordRpcItem.Checked;
            }
            PostTrayApiFireAndForget("/api/settings/toggle-discord-rpc");
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
                    var connectTask = client.ConnectAsync("127.0.0.1", port);
                    _ = connectTask.ContinueWith(t => _ = t.Exception, System.Threading.Tasks.TaskContinuationOptions.OnlyOnFaulted);
                    return connectTask.Wait(350) && client.Connected;
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

            return true; // Varsayılan: true
        }

        public static string GetDoubleClickActionSetting()
        {
            // configwin.ini kontrol et
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

            return "player"; // Varsayılan: player
        }

        public static string GetThemeSetting()
        {
            // configwin.ini kontrol et
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
                            if (string.Equals(key, "theme", StringComparison.OrdinalIgnoreCase))
                            {
                                return val.ToLowerInvariant();
                            }
                        }
                    }
                }
            }
            catch {}

            return "dark"; // Varsayılan: dark
        }


        /// <summary>
        /// Menü öğeleri için temaya duyarlı 16x16 vektörel simge üretir.
        /// </summary>
        private static Bitmap CreateMenuIcon(string iconType, bool isDark)
        {
            Bitmap bmp = new Bitmap(16, 16);
            using (Graphics g = Graphics.FromImage(bmp))
            {
                g.SmoothingMode = System.Drawing.Drawing2D.SmoothingMode.AntiAlias;
                g.PixelOffsetMode = System.Drawing.Drawing2D.PixelOffsetMode.HighQuality;
                Color primary = isDark ? Color.FromArgb(244, 244, 245) : Color.FromArgb(24, 24, 27);
                Color accent = Color.FromArgb(59, 130, 246);
                Color red = Color.FromArgb(239, 68, 68);
                Color green = Color.FromArgb(34, 197, 94);
                Color orange = Color.FromArgb(249, 115, 22);

                using (Pen pen = new Pen(primary, 1.5f))
                using (Pen accentPen = new Pen(accent, 1.5f))
                using (Pen redPen = new Pen(red, 1.5f))
                using (Pen greenPen = new Pen(green, 1.5f))
                using (Pen orangePen = new Pen(orange, 1.5f))
                using (Brush brush = new SolidBrush(primary))
                using (Brush redBrush = new SolidBrush(red))
                using (Brush greenBrush = new SolidBrush(green))
                using (Brush accentBrush = new SolidBrush(accent))
                {
                    switch (iconType)
                    {
                        case "ui": // Pencere / UI
                            g.DrawRectangle(pen, 2, 3, 12, 10);
                            g.DrawLine(pen, 2, 6, 14, 6);
                            break;
                        case "youtube": // YouTube oynatma üçgeni
                            g.DrawRoundedRectangle(redPen, new Rectangle(1, 3, 14, 10), new Size(3, 3));
                            Point[] playPoints = { new Point(6, 6), new Point(6, 10), new Point(11, 8) };
                            g.FillPolygon(redBrush, playPoints);
                            break;
                        case "check": // Yenile / Döngü
                            g.DrawArc(accentPen, 2, 2, 12, 12, 45, 270);
                            g.FillPolygon(accentBrush, new Point[] { new Point(13, 2), new Point(13, 7), new Point(9, 5) });
                            break;
                        case "paste": // Pano / İndir
                            g.DrawRectangle(pen, 3, 4, 10, 10);
                            g.DrawRectangle(accentPen, 5, 2, 6, 3);
                            g.DrawLine(greenPen, 8, 7, 8, 12);
                            g.DrawLine(greenPen, 6, 10, 8, 12);
                            g.DrawLine(greenPen, 10, 10, 8, 12);
                            break;
                        case "shortcuts": // Sekmeler / Liste
                            g.DrawLine(pen, 2, 4, 14, 4);
                            g.DrawLine(pen, 2, 8, 14, 8);
                            g.DrawLine(pen, 2, 12, 14, 12);
                            break;
                        case "settings": // Dişli / Çark
                            g.DrawEllipse(accentPen, 5, 5, 6, 6);
                            g.DrawEllipse(pen, 2, 2, 12, 12);
                            break;
                        case "speed": // Kaplumbağa / Hız
                            g.DrawArc(orangePen, 2, 4, 12, 8, 180, 180);
                            g.DrawLine(pen, 8, 8, 11, 5);
                            break;
                        case "gamemode": // Oyun Kolu / Katmanlar
                            g.DrawRoundedRectangle(accentPen, new Rectangle(2, 4, 12, 8), new Size(3, 3));
                            g.DrawLine(pen, 5, 6, 5, 10);
                            g.DrawLine(pen, 3, 8, 7, 8);
                            g.FillEllipse(greenBrush, 10, 6, 2, 2);
                            break;
                        case "boot": // Güç / Başlangıç
                            g.DrawArc(pen, 3, 3, 10, 10, 30, 300);
                            g.DrawLine(accentPen, 8, 1, 8, 7);
                            break;
                        case "discord": // Sohbet / Oyun
                            g.DrawRoundedRectangle(pen, new Rectangle(2, 4, 12, 8), new Size(2, 2));
                            g.FillEllipse(accentBrush, 5, 6, 2, 2);
                            g.FillEllipse(accentBrush, 9, 6, 2, 2);
                            break;
                        case "restart": // Yeniden Başlat
                            g.DrawArc(orangePen, 2, 2, 12, 12, 0, 315);
                            g.FillPolygon(new SolidBrush(orange), new Point[] { new Point(14, 4), new Point(14, 9), new Point(9, 7) });
                            break;
                        case "console": // Terminal / Komut Satırı
                            g.DrawRectangle(pen, 1, 3, 14, 10);
                            g.DrawLine(greenPen, 3, 6, 5, 8);
                            g.DrawLine(greenPen, 5, 8, 3, 10);
                            g.DrawLine(greenPen, 7, 10, 11, 10);
                            break;
                        case "exit": // Çıkış / Kapat
                            g.DrawLine(redPen, 4, 4, 12, 12);
                            g.DrawLine(redPen, 12, 4, 4, 12);
                            break;
                        default:
                            g.DrawRectangle(pen, 3, 3, 10, 10);
                            break;
                    }
                }
            }
            return bmp;
        }

        public void ApplyThemeToContextMenu()
        {
            try
            {
                string theme = GetThemeSetting();
                bool isDark = !string.Equals(theme, "light", StringComparison.OrdinalIgnoreCase);

                var renderer = new HaYTooLMenuRenderer(isDark);
                if (_contextMenu != null)
                {
                    _contextMenu.Renderer = renderer;
                    ApplyThemeToItems(_contextMenu.Items, isDark);
                }
                if (_shortcutsMenu != null && _shortcutsMenu.DropDown != null)
                {
                    _shortcutsMenu.DropDown.Renderer = renderer;
                    ApplyThemeToItems(_shortcutsMenu.DropDownItems, isDark);
                }

                // Menü öğelerine temaya uyumlu ikonları bağla
                if (_openUiItem != null) _openUiItem.Image = CreateMenuIcon("ui", isDark);
                if (_youtubeLoginItem != null) _youtubeLoginItem.Image = CreateMenuIcon("youtube", isDark);
                if (_settingsItem != null) _settingsItem.Image = CreateMenuIcon("settings", isDark);
                if (_checkChannelsItem != null) _checkChannelsItem.Image = CreateMenuIcon("check", isDark);
                if (_pasteDownloadItem != null) _pasteDownloadItem.Image = CreateMenuIcon("paste", isDark);
                if (_shortcutsMenu != null) _shortcutsMenu.Image = CreateMenuIcon("shortcuts", isDark);
                if (_altSpeedItem != null) _altSpeedItem.Image = CreateMenuIcon("speed", isDark);
                if (_deferMergeItem != null) _deferMergeItem.Image = CreateMenuIcon("gamemode", isDark);
                if (_bootItem != null) _bootItem.Image = CreateMenuIcon("boot", isDark);
                if (_discordRpcItem != null) _discordRpcItem.Image = CreateMenuIcon("discord", isDark);
                if (_restartItem != null) _restartItem.Image = CreateMenuIcon("restart", isDark);
                if (_showConsoleItem != null) _showConsoleItem.Image = CreateMenuIcon("console", isDark);
                if (_exitItem != null) _exitItem.Image = CreateMenuIcon("exit", isDark);
            }
            catch {}
        }

        private void ApplyThemeToItems(ToolStripItemCollection items, bool isDark)
        {
            Color textCol = isDark ? Color.FromArgb(244, 244, 245) : Color.FromArgb(24, 24, 27);
            Font itemFont = new Font("Segoe UI", 9.25f, FontStyle.Regular);

            foreach (ToolStripItem item in items)
            {
                if (item is ToolStripSeparator sep)
                {
                    sep.ForeColor = isDark ? Color.FromArgb(39, 39, 42) : Color.FromArgb(228, 228, 231);
                }
                else
                {
                    item.ForeColor = textCol;
                    item.Font = itemFont;
                    if (item is ToolStripMenuItem menuItem && menuItem.HasDropDownItems)
                    {
                        ApplyThemeToItems(menuItem.DropDownItems, isDark);
                    }
                }
            }
        }

        private string GetLanguageSetting()
        {
            // 1. configwin.ini kontrol et
            try
            {
                string iniPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "configwin.ini");
                if (File.Exists(iniPath))
                {
                    foreach (string line in File.ReadAllLines(iniPath))
                    {
                        int eq = line.IndexOf('=');
                        if (eq != -1 && string.Equals(line.Substring(0, eq).Trim(), "lang", StringComparison.OrdinalIgnoreCase))
                        {
                            string val = line.Substring(eq + 1).Trim().ToLowerInvariant();
                            if (!string.IsNullOrEmpty(val)) return val;
                        }
                    }
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
                if (_deferMergeItem != null) _deferMergeItem.Text = "Game Mode (Defer FFmpeg Merge)";
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
                if (_deferMergeItem != null) _deferMergeItem.Text = "Oyun Modu (Birleştirmeyi Ertele)";
                if (_bootItem != null) _bootItem.Text = "Sistem Başlangıcında Çalıştır";
                if (_discordRpcItem != null) _discordRpcItem.Text = "Discord Durumu";
                if (_showConsoleItem != null) _showConsoleItem.Text = "Konsol Çıktısını Göster";
                if (_restartItem != null) _restartItem.Text = "Sunucuyu Yeniden Başlat";
                if (_exitItem != null) _exitItem.Text = "Çıkış";
            }

            UpdateTaskbarJumpList(lang);
        }

        private string EnsureJumpListIconFile(string dirPath, string iconType, string fallbackExePath)
        {
            try
            {
                Directory.CreateDirectory(dirPath);
                string icoPath = Path.Combine(dirPath, $"jl_{iconType}.ico");
                const int size = 32;
                using (Bitmap bmp = new Bitmap(size, size, PixelFormat.Format32bppArgb))
                {
                    using (Graphics g = Graphics.FromImage(bmp))
                    {
                        g.SmoothingMode = SmoothingMode.AntiAlias;
                        g.InterpolationMode = InterpolationMode.HighQualityBicubic;
                        g.Clear(Color.Transparent);
                        g.ScaleTransform(2f, 2f);
                        using (Bitmap src = CreateMenuIcon(iconType, true))
                        {
                            g.DrawImage(src, 0, 0, 16, 16);
                        }
                    }

                    // Standart sıkıştırmasız 32-bit ARGB Win32 DIB ICO formatı (Windows 10/11 Explorer ile %100 uyumlu)
                    int xorSize = size * size * 4;
                    int andStride = ((size + 31) / 32) * 4;
                    int andSize = andStride * size;
                    uint imageBytesLen = (uint)(40 + xorSize + andSize);

                    using (FileStream fs = new FileStream(icoPath, FileMode.Create, FileAccess.Write, FileShare.Read))
                    using (BinaryWriter bw = new BinaryWriter(fs))
                    {
                        // ICONDIR (6 byte)
                        bw.Write((ushort)0);
                        bw.Write((ushort)1);
                        bw.Write((ushort)1);
                        // ICONDIRENTRY (16 byte)
                        bw.Write((byte)size);
                        bw.Write((byte)size);
                        bw.Write((byte)0);
                        bw.Write((byte)0);
                        bw.Write((ushort)1);
                        bw.Write((ushort)32);
                        bw.Write(imageBytesLen);
                        bw.Write((uint)22);
                        // BITMAPINFOHEADER (40 byte)
                        bw.Write((uint)40);
                        bw.Write((int)size);
                        bw.Write((int)(size * 2)); // XOR + AND height
                        bw.Write((ushort)1);
                        bw.Write((ushort)32);
                        bw.Write((uint)0); // BI_RGB
                        bw.Write((uint)(xorSize + andSize));
                        bw.Write((int)0);
                        bw.Write((int)0);
                        bw.Write((uint)0);
                        bw.Write((uint)0);

                        // Bottom-up BGRA piksel verisi
                        for (int y = size - 1; y >= 0; y--)
                        {
                            for (int x = 0; x < size; x++)
                            {
                                Color c = bmp.GetPixel(x, y);
                                bw.Write(c.B);
                                bw.Write(c.G);
                                bw.Write(c.R);
                                bw.Write(c.A);
                            }
                        }
                        // AND maskesi (tümü 0 — alfa kanalı kullanılır)
                        bw.Write(new byte[andSize]);
                    }
                }
                return icoPath;
            }
            catch
            {
                return fallbackExePath;
            }
        }

        public void RefreshTaskbarJumpList()
        {
            UpdateTaskbarJumpList(_currentLang ?? GetLanguageSetting());
        }

        public void UpdateTaskbarJumpList(string lang)
        {
            try
            {
                System.Windows.Application? app = System.Windows.Application.Current;
                if (app == null) return;

                app.Dispatcher.BeginInvoke(System.Windows.Threading.DispatcherPriority.ApplicationIdle, new Action(() =>
                {
                    string dbgLog = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "wv2_debug.log");
                    try
                    {
                        string exePath = Environment.ProcessPath ?? Process.GetCurrentProcess().MainModule?.FileName ?? "";
                        if (string.IsNullOrEmpty(exePath) || !File.Exists(exePath))
                        {
                            try { File.AppendAllText(dbgLog, $"[{DateTime.Now}] [JumpList] Skipped: exePath not found ('{exePath}')\n"); } catch {}
                            return;
                        }

                        string workDir = Path.GetDirectoryName(exePath) ?? AppDomain.CurrentDomain.BaseDirectory;
                        dbgLog = Path.Combine(workDir, "wv2_debug.log");
                        // Temp klasörü başlangıçta temizlendiği için kalıcı bin/icons dizinini kullan
                        string iconDir = Path.Combine(workDir, "bin", "icons");
                        bool isEn = string.Equals(lang, "en", StringComparison.OrdinalIgnoreCase);

                        string icoUi = EnsureJumpListIconFile(iconDir, "ui", exePath);
                        string icoPaste = EnsureJumpListIconFile(iconDir, "paste", exePath);
                        string icoCheck = EnsureJumpListIconFile(iconDir, "check", exePath);
                        string icoGame = EnsureJumpListIconFile(iconDir, "gamemode", exePath);
                        string icoSpeed = EnsureJumpListIconFile(iconDir, "speed", exePath);
                        string icoSettings = EnsureJumpListIconFile(iconDir, "settings", exePath);
                        string icoQueue = EnsureJumpListIconFile(iconDir, "shortcuts", exePath);
                        string icoMerge = EnsureJumpListIconFile(iconDir, "youtube", exePath);

                        var jumpList = new System.Windows.Shell.JumpList
                        {
                            ShowFrequentCategory = false,
                            ShowRecentCategory = false
                        };

                        jumpList.JumpItemsRejected += (s, rejArgs) =>
                        {
                            try
                            {
                                for (int i = 0; i < rejArgs.RejectedItems.Count; i++)
                                {
                                    var rItem = rejArgs.RejectedItems[i] as System.Windows.Shell.JumpTask;
                                    var reason = rejArgs.RejectionReasons[i];
                                    File.AppendAllText(dbgLog, $"[{DateTime.Now}] [JumpList REJECTED] Title='{rItem?.Title}' Args='{rItem?.Arguments}' Reason={reason}\n");
                                }
                            }
                            catch {}
                        };

                        // CustomCategory = null bırakılarak doğrudan standart Windows "Görevler (Tasks)" grubuna eklenir.
                        // Böylece Windows "Son açılan öğeleri göster (Start_TrackDocs)" kapalı olsa dahi %100 görünür.
                        System.Windows.Shell.JumpTask MakeTask(string title, string desc, string args, string iconFile)
                        {
                            return new System.Windows.Shell.JumpTask
                            {
                                Title = title,
                                Description = desc,
                                ApplicationPath = exePath,
                                Arguments = args,
                                WorkingDirectory = workDir,
                                IconResourcePath = iconFile,
                                IconResourceIndex = 0
                            };
                        }

                        jumpList.JumpItems.Add(MakeTask(
                            isEn ? "Open Library" : "Kütüphaneyi Aç",
                            isEn ? "Open main video library" : "Ana video kütüphanesini açar",
                            "/home", icoUi));

                        jumpList.JumpItems.Add(MakeTask(
                            isEn ? "Download Queue" : "İndirme Kuyruğu",
                            isEn ? "View active downloads and pending merges" : "Aktif indirmeleri ve bekleyen birleştirmeleri gösterir",
                            "/download", icoQueue));

                        jumpList.JumpItems.Add(MakeTask(
                            isEn ? "Download Clipboard URL" : "Panodaki Linki İndir",
                            isEn ? "Add copied video URL directly to queue" : "Kopyalanan video bağlantısını doğrudan kuyruğa ekler",
                            "paste", icoPaste));

                        jumpList.JumpItems.Add(MakeTask(
                            isEn ? "Scan Channels Now" : "Kanalları Şimdi Tara",
                            isEn ? "Check followed channels for new videos" : "Takip edilen kanallarda yeni video taraması başlatır",
                            "check", icoCheck));

                        // Görsel ayırıcı çizgi (Tasks grubu içinde standart Win32 ayırıcı)
                        jumpList.JumpItems.Add(new System.Windows.Shell.JumpTask());

                        jumpList.JumpItems.Add(MakeTask(
                            isEn ? "Toggle Game Mode (Defer Merge)" : "Oyun Modu Aç / Kapat (Birleştirmeyi Ertele)",
                            isEn ? "Download at full speed with zero FFmpeg load while gaming" : "Oyundayken sıfır FFmpeg yüküyle indirir; kapatınca sırayla birleştirir",
                            "game", icoGame));

                        jumpList.JumpItems.Add(MakeTask(
                            isEn ? "Start Pending Merges" : "Bekleyen Birleştirmeleri Başlat",
                            isEn ? "Sequentially merge deferred videos now" : "Kuyrukta bekleyen ham videoları sırayla birleştirir",
                            "merge", icoMerge));

                        jumpList.JumpItems.Add(MakeTask(
                            isEn ? "Toggle Turtle Speed Limit" : "Kaplumbağa Hız Modu Aç / Kapat",
                            isEn ? "Switch between normal and alternative download speed" : "Normal ve alternatif indirme hız sınırı arasında geçiş yapar",
                            "toggle", icoSpeed));

                        jumpList.JumpItems.Add(MakeTask(
                            isEn ? "Pause / Resume Queue" : "Kuyruğu Duraklat / Devam Ettir",
                            isEn ? "Pause or resume active downloads" : "Aktif indirme kuyruğunu duraklatır veya devam ettirir",
                            "pd", icoQueue));

                        jumpList.JumpItems.Add(new System.Windows.Shell.JumpTask());

                        jumpList.JumpItems.Add(MakeTask(
                            isEn ? "Settings" : "Ayarlar",
                            isEn ? "Open application settings" : "Uygulama ayarlarını açar",
                            "/settings", icoSettings));

                        int beforeCount = jumpList.JumpItems.Count;
                        System.Windows.Shell.JumpList.SetJumpList(app, jumpList);
                        jumpList.Apply();
                        try { File.AppendAllText(dbgLog, $"[{DateTime.Now}] [JumpList] Applied {jumpList.JumpItems.Count}/{beforeCount} tasks successfully for '{exePath}'.\n"); } catch {}
                    }
                    catch (Exception ex)
                    {
                        try { File.AppendAllText(dbgLog, $"[{DateTime.Now}] [JumpList ERROR] {ex}\n"); } catch {}
                    }
                }));
            }
            catch {}
        }

        private static readonly string[] KnownCliCatalog = new[]
        {
            "status", "info", "durum",
            "diag", "health", "sistem",
            "queue", "kuyruk",
            "errors", "hatalar",
            "verbose", "log-api",
            "gton", "gtoff",
            "gameon", "gameoff", "game",
            "merge", "merge-pause",
            "pause", "duraklat",
            "resume", "devam",
            "ton", "toff", "toggle", "turtle",
            "speed", "altspeed",
            "pd", "paste", "pano",
            "check", "scan", "tara",
            "backup", "yedek",
            "fakap", "fakap-run",
            "play", "oynat",
            "open", "show", "hide", "tray",
            "stop", "exit", "clear", "help"
        };

        private static readonly HashSet<string> KnownUiRoutes = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
        {
            "/", "/index.html", "/home", "/download", "/downlist", "/queue",
            "/downloaded", "/channels", "/settings", "/iptv", "/downloader",
            "/tools", "/webstream", "/watch", "/logout", "/logout-youtube",
            "/tools/compare", "/tools/deleted", "/tools/categories",
            "/tools/ape", "/tools/subscriptions", "/tools/bulk-delete", "/tools/remote-status"
        };

        public static bool IsKnownUiOrLaunchArg(string rawArgs)
        {
            if (string.IsNullOrWhiteSpace(rawArgs)) return true;
            string trimmed = rawArgs.Trim();
            string lower = trimmed.ToLowerInvariant();
            string noPrefix = lower.TrimStart('-', '/');

            if (KnownUiRoutes.Contains(trimmed)) return true;
            if (lower.StartsWith("http://") || lower.StartsWith("https://") ||
                lower.StartsWith("haytool://") || lower.StartsWith("haytool:") ||
                lower.StartsWith("/play/"))
            {
                return true;
            }

            switch (noPrefix)
            {
                case "silent":
                case "headless":
                case "silent-cookie-refresh":
                case "refresh_cookies":
                case "logout":
                case "tray-only":
                case "minimized":
                case "exit":
                case "stop":
                case "quit":
                case "kill":
                case "close":
                case "hide":
                case "min":
                case "minimize":
                case "show":
                case "open":
                case "gui":
                case "tray":
                    return true;
                default:
                    return false;
            }
        }

        private static int ComputeLevenshteinDistance(string a, string b)
        {
            int m = a.Length;
            int n = b.Length;
            if (m == 0) return n;
            if (n == 0) return m;
            int[] prev = new int[n + 1];
            int[] curr = new int[n + 1];
            for (int j = 0; j <= n; j++) prev[j] = j;
            for (int i = 1; i <= m; i++)
            {
                curr[0] = i;
                for (int j = 1; j <= n; j++)
                {
                    int cost = a[i - 1] == b[j - 1] ? 0 : 1;
                    curr[j] = Math.Min(Math.Min(prev[j] + 1, curr[j - 1] + 1), prev[j - 1] + cost);
                }
                (prev, curr) = (curr, prev);
            }
            return prev[n];
        }

        public static string BuildUnknownCliCommandMessage(string rawCmd)
        {
            string trimmed = (rawCmd ?? "").Trim();
            string first = string.IsNullOrWhiteSpace(trimmed)
                ? ""
                : trimmed.Split(new[] { ' ', '\t' }, StringSplitOptions.RemoveEmptyEntries)[0].ToLowerInvariant().TrimStart('-', '/');

            int maxDist = first.Length <= 3 ? 1 : (first.Length <= 6 ? 2 : 3);
            var suggestions = KnownCliCatalog
                .Where(c => !string.Equals(c, first, StringComparison.OrdinalIgnoreCase))
                .Select(c =>
                {
                    int dist = ComputeLevenshteinDistance(first, c);
                    bool isPrefix = c.StartsWith(first, StringComparison.OrdinalIgnoreCase) || (first.Length >= 3 && first.StartsWith(c, StringComparison.OrdinalIgnoreCase));
                    return (Candidate: c, Dist: dist, Score: isPrefix ? Math.Min(dist, 1) - 0.25 : dist, Match: dist <= maxDist || isPrefix);
                })
                .Where(x => x.Match)
                .OrderBy(x => x.Score)
                .ThenBy(x => x.Dist)
                .ThenBy(x => x.Candidate, StringComparer.OrdinalIgnoreCase)
                .Take(3)
                .Select(x => x.Candidate)
                .ToList();

            bool isEn = string.Equals(MainWindow.ReadIniSetting("lang", "tr"), "en", StringComparison.OrdinalIgnoreCase);
            if (suggestions.Count > 0)
            {
                string joined = string.Join(", ", suggestions);
                return isEn
                    ? $"[Console] Unknown command: \"{first}\". Did you mean: {joined}? Type \"help\" or \"?\" for the command reference."
                    : $"[Console] Bilinmeyen komut: \"{first}\". Bunu mu demek istediniz: {joined}? Komut rehberi için \"help\" veya \"?\" yazabilirsiniz.";
            }

            return isEn
                ? $"[Console] Unknown command: \"{first}\". Type \"help\" or \"?\" for the command reference."
                : $"[Console] Bilinmeyen komut: \"{first}\". Komut rehberi için \"help\" veya \"?\" yazabilirsiniz.";
        }

        public static bool IsHeadlessCliCommand(string rawCmd)
        {
            if (string.IsNullOrWhiteSpace(rawCmd)) return false;
            string trimmed = rawCmd.Trim();
            string first = trimmed.Split(new[] { ' ', '\t' }, StringSplitOptions.RemoveEmptyEntries)[0].ToLowerInvariant().TrimStart('-', '/');
            switch (first)
            {
                case "pd":
                case "paste":
                case "pano":
                case "clipboard":
                case "status":
                case "info":
                case "durum":
                case "diag":
                case "health":
                case "sistem":
                case "queue":
                case "kuyruk":
                case "errors":
                case "hatalar":
                case "verbose":
                case "log-api":
                case "play":
                case "oynat":
                case "clear":
                case "ton":
                case "turtleon":
                case "turtleac":
                case "turtle-on":
                case "toff":
                case "turtleoff":
                case "turtlekapat":
                case "turtle-off":
                case "toggle":
                case "turtle":
                case "turtle-toggle":
                case "speed":
                case "altspeed":
                case "game":
                case "gamemode":
                case "game-mode":
                case "gameon":
                case "game-on":
                case "gameoff":
                case "game-off":
                case "gton":
                case "gt-on":
                case "gameton":
                case "game-ton":
                case "gtoff":
                case "gt-off":
                case "gametoff":
                case "game-toff":
                case "gametoggle":
                case "game-toggle":
                case "oyun":
                case "oyunac":
                case "oyun-ac":
                case "oyunkapat":
                case "oyun-kapat":
                case "oyuntoggle":
                case "defer-on":
                case "deferon":
                case "defer-off":
                case "deferoff":
                case "defer-merge":
                case "defermerge":
                case "merge":
                case "merge-all":
                case "merge-pause":
                case "birlestir":
                case "birlestir-duraklat":
                case "pause":
                case "duraklat":
                case "pause-all":
                case "resume":
                case "devam":
                case "resume-all":
                case "check":
                case "scan":
                case "tara":
                case "backup":
                case "yedek":
                case "fakap":
                case "fakap-run":
                case "help":
                case "?":
                case "komutlar":
                    return true;
                default:
                    return false;
            }
        }

        public static bool TrySendHttpCliCommandStatic(string command, out string responseMessage)
        {
            return TrySendHttpCliCommandStatic(command, out responseMessage, out _);
        }

        public static bool TrySendHttpCliCommandStatic(string command, out string responseMessage, out bool commandOk)
        {
            responseMessage = "";
            commandOk = false;
            try
            {
                string portStr = MainWindow.ReadIniSetting("port", "4141");
                if (!int.TryParse(portStr, out int port) || port <= 0) port = 4141;
                string url = $"http://127.0.0.1:{port}/api/cli/exec";
                string payload = JsonSerializer.Serialize(new { command });
                using var request = new HttpRequestMessage(HttpMethod.Post, url)
                {
                    Content = new StringContent(payload, Encoding.UTF8, "application/json")
                };
                using var resp = _httpClient.Send(request);
                resp.EnsureSuccessStatusCode();
                string json = resp.Content.ReadAsStringAsync().GetAwaiter().GetResult();
                using var doc = JsonDocument.Parse(json);
                if (doc.RootElement.TryGetProperty("ok", out var okProp) && (okProp.ValueKind == JsonValueKind.True || okProp.ValueKind == JsonValueKind.False))
                {
                    commandOk = okProp.GetBoolean();
                }
                else
                {
                    commandOk = true;
                }
                if (doc.RootElement.TryGetProperty("message", out var msgProp) && msgProp.ValueKind == JsonValueKind.String)
                {
                    responseMessage = msgProp.GetString() ?? "";
                }
                return true;
            }
            catch
            {
                return false;
            }
        }

        public void SendCommandToNode(string command)
        {
            try
            {
                string trimmed = (command ?? "").Trim();
                string first = string.IsNullOrWhiteSpace(trimmed)
                    ? ""
                    : trimmed.Split(new[] { ' ', '\t' }, StringSplitOptions.RemoveEmptyEntries)[0].ToLowerInvariant().TrimStart('-', '/');

                if (first == "open" || first == "show" || first == "gui")
                {
                    _console.AppendLog("[GİRDİ] > " + trimmed);
                    _mainWindow.Dispatcher.Invoke(() => _mainWindow.BringWindowToFront());
                    _console.AppendLog("[Console] Pencere öne getiriliyor.");
                    return;
                }
                if (first == "hide" || first == "min" || first == "minimize")
                {
                    _console.AppendLog("[GİRDİ] > " + trimmed);
                    _mainWindow.Dispatcher.Invoke(() =>
                    {
                        EnsureTrayVisible();
                        _ = _mainWindow.HideToTrayAsync();
                    });
                    _console.AppendLog("[Console] Pencere sistem tepsisine gizleniyor.");
                    return;
                }
                if (first == "tray")
                {
                    _console.AppendLog("[GİRDİ] > " + trimmed);
                    _mainWindow.Dispatcher.Invoke(() => EnsureTrayVisible());
                    _console.AppendLog("[Console] Sistem tepsisi simgesi görünür yapıldı.");
                    return;
                }

                if (_nodeProcess != null && !_nodeProcess.HasExited)
                {
                    _nodeProcess.StandardInput.WriteLine(command);
                    _console.AppendLog("[GİRDİ] > " + command);
                    return;
                }

                _console.AppendLog("[GİRDİ] > " + command);
                // Backend ayrı süreç olarak çalışıyorsa HTTP /api/cli/exec üzerinden ilet
                ThreadPool.QueueUserWorkItem(_ =>
                {
                    bool sent = TrySendHttpCliCommandStatic(command, out string msg, out bool _);
                    // SSE aktifse sunucu çıktısı terminal_raw olayından gelecektir; aksi halde doğrudan ekle
                    if ((!sent || !_console.IsDetachedLogStreamActive) && !string.IsNullOrEmpty(msg))
                    {
                        _console.AppendLog(msg);
                    }
                });
            }
            catch (Exception ex)
            {
                _console.AppendLog("[HATA] Komut iletilemedi: " + ex.Message);
            }
        }

        private void ShowConsoleWindow() => _console.Show();

        public void Dispose()
        {
            UpdateSleepPrevention(false);
            _console.Dispose();
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

    public class HaYTooLColorTable : ProfessionalColorTable
    {
        private readonly bool _isDark;

        public HaYTooLColorTable(bool isDark)
        {
            _isDark = isDark;
        }

        public override Color ToolStripDropDownBackground => _isDark ? Color.FromArgb(24, 24, 27) : Color.FromArgb(255, 255, 255);
        public override Color ImageMarginGradientBegin => _isDark ? Color.FromArgb(24, 24, 27) : Color.FromArgb(255, 255, 255);
        public override Color ImageMarginGradientMiddle => _isDark ? Color.FromArgb(24, 24, 27) : Color.FromArgb(255, 255, 255);
        public override Color ImageMarginGradientEnd => _isDark ? Color.FromArgb(24, 24, 27) : Color.FromArgb(255, 255, 255);

        public override Color MenuBorder => _isDark ? Color.FromArgb(63, 63, 70) : Color.FromArgb(228, 228, 231);
        public override Color MenuItemBorder => _isDark ? Color.FromArgb(63, 63, 70) : Color.FromArgb(228, 228, 231);

        public override Color MenuItemSelected => _isDark ? Color.FromArgb(39, 39, 42) : Color.FromArgb(244, 244, 245);
        public override Color MenuItemSelectedGradientBegin => _isDark ? Color.FromArgb(39, 39, 42) : Color.FromArgb(244, 244, 245);
        public override Color MenuItemSelectedGradientEnd => _isDark ? Color.FromArgb(39, 39, 42) : Color.FromArgb(244, 244, 245);

        public override Color MenuItemPressedGradientBegin => _isDark ? Color.FromArgb(59, 130, 246) : Color.FromArgb(37, 99, 235);
        public override Color MenuItemPressedGradientEnd => _isDark ? Color.FromArgb(59, 130, 246) : Color.FromArgb(37, 99, 235);

        public override Color CheckBackground => _isDark ? Color.FromArgb(39, 39, 42) : Color.FromArgb(244, 244, 245);
        public override Color CheckSelectedBackground => _isDark ? Color.FromArgb(59, 130, 246) : Color.FromArgb(37, 99, 235);
        public override Color CheckPressedBackground => _isDark ? Color.FromArgb(59, 130, 246) : Color.FromArgb(37, 99, 235);

        public override Color SeparatorDark => _isDark ? Color.FromArgb(39, 39, 42) : Color.FromArgb(228, 228, 231);
        public override Color SeparatorLight => _isDark ? Color.FromArgb(24, 24, 27) : Color.FromArgb(255, 255, 255);
    }

    public class HaYTooLMenuRenderer : ToolStripProfessionalRenderer
    {
        private readonly bool _isDark;

        public HaYTooLMenuRenderer(bool isDark) : base(new HaYTooLColorTable(isDark))
        {
            _isDark = isDark;
            this.RoundedEdges = false;
        }

        protected override void OnRenderItemText(ToolStripItemTextRenderEventArgs e)
        {
            if (e.Item.Enabled)
            {
                e.TextColor = _isDark ? Color.FromArgb(244, 244, 245) : Color.FromArgb(24, 24, 27);
            }
            else
            {
                e.TextColor = _isDark ? Color.FromArgb(113, 113, 122) : Color.FromArgb(161, 161, 170);
            }
            base.OnRenderItemText(e);
        }

        protected override void OnRenderArrow(ToolStripArrowRenderEventArgs e)
        {
            e.ArrowColor = _isDark ? Color.FromArgb(212, 212, 216) : Color.FromArgb(82, 82, 91);
            base.OnRenderArrow(e);
        }

        protected override void OnRenderItemCheck(ToolStripItemImageRenderEventArgs e)
        {
            Rectangle rect = new Rectangle(4, 4, e.Item.Height - 8, e.Item.Height - 8);
            using (SolidBrush b = new SolidBrush(_isDark ? Color.FromArgb(59, 130, 246) : Color.FromArgb(37, 99, 235)))
            {
                e.Graphics.FillRectangle(b, rect);
            }
            using (Pen pen = new Pen(Color.White, 2f))
            {
                e.Graphics.DrawLines(pen, new Point[] {
                    new Point(rect.Left + 3, rect.Top + rect.Height / 2),
                    new Point(rect.Left + rect.Width / 2 - 1, rect.Bottom - 4),
                    new Point(rect.Right - 3, rect.Top + 3)
                });
            }
        }
    }
}
