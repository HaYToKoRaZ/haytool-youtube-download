using System;
using System.IO;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Windows;
using System.Windows.Interop;
using Microsoft.Web.WebView2.Core;

namespace HaYTooLPlayer
{
    public partial class MainWindow : Window
    {
        private System.Windows.Threading.DispatcherTimer cookieKeepaliveTimer;
        private bool isSilentCookieRefresh = false;

        public MainWindow()
        {
            InitializeComponent();

            string debugLogFile = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "wv2_debug.log");
            this.Closed += (s, e) => { try { File.AppendAllText(debugLogFile, $"[{DateTime.Now}] Window.Closed fired!\n"); } catch {} };
            AppDomain.CurrentDomain.ProcessExit += (s, e) => { try { File.AppendAllText(debugLogFile, $"[{DateTime.Now}] ProcessExit fired!\n"); } catch {} };

            string[] args = Environment.GetCommandLineArgs();
            foreach (var arg in args)
            {
                if (arg.Equals("--silent-cookie-refresh", StringComparison.OrdinalIgnoreCase) || arg.Equals("REFRESH_COOKIES", StringComparison.OrdinalIgnoreCase))
                {
                    isSilentCookieRefresh = true;
                    break;
                }
            }

            try { File.AppendAllText(debugLogFile, $"[{DateTime.Now}] Ctor: isSilent={isSilentCookieRefresh}, Args={string.Join(" ", args)}\n"); } catch {}

            if (isSilentCookieRefresh)
            {
                this.ShowInTaskbar = false;
                this.Visibility = Visibility.Hidden;
                this.Width = 0;
                this.Height = 0;
                this.WindowStyle = WindowStyle.None;

                // Emniyet zaman aşımı: En geç 15 saniye içinde sessiz çerez yenileme süreci sonlandırılmalıdır
                var silentTimeoutTimer = new System.Windows.Threading.DispatcherTimer();
                silentTimeoutTimer.Interval = TimeSpan.FromSeconds(15);
                silentTimeoutTimer.Tick += (s, e) =>
                {
                    silentTimeoutTimer.Stop();
                    try { File.AppendAllText(debugLogFile, $"[{DateTime.Now}] SilentTimeoutTimer fired, shutting down.\n"); } catch {}
                    try { Application.Current.Shutdown(); } catch { }
                };
                silentTimeoutTimer.Start();
            }
            else
            {
                this.WindowState = WindowState.Maximized;
                StartCookieKeepaliveTimer();
                this.Closing += (s, e) => { SyncYouTubeCookiesToFileAsync(); };
            }

            InitializeAsync();
        }

        private void StartCookieKeepaliveTimer()
        {
            try
            {
                cookieKeepaliveTimer = new System.Windows.Threading.DispatcherTimer();
                cookieKeepaliveTimer.Interval = TimeSpan.FromMinutes(15);
                cookieKeepaliveTimer.Tick += (s, e) =>
                {
                    SyncYouTubeCookiesToFileAsync();
                };
                cookieKeepaliveTimer.Start();
            }
            catch {}
        }

        private const int WM_COPYDATA = 0x004A;

        [StructLayout(LayoutKind.Sequential)]
        public struct COPYDATASTRUCT
        {
            public IntPtr dwData;
            public int cbData;
            [MarshalAs(UnmanagedType.LPWStr)]
            public string lpData;
        }

        private IntPtr WndProc(IntPtr hwnd, int msg, IntPtr wParam, IntPtr lParam, ref bool handled)
        {
            if (msg == WM_COPYDATA)
            {
                try
                {
                    COPYDATASTRUCT cds = (COPYDATASTRUCT)Marshal.PtrToStructure(lParam, typeof(COPYDATASTRUCT));
                    string path = cds.lpData;
                    if (!string.IsNullOrEmpty(path))
                    {
                        this.Dispatcher.Invoke(() =>
                        {
                            if (path == "REFRESH_COOKIES" || path == "--silent-cookie-refresh")
                            {
                                SyncYouTubeCookiesToFileAsync();
                                return;
                            }

                            if (this.WindowState == WindowState.Minimized || this.WindowState == WindowState.Normal)
                            {
                                this.WindowState = WindowState.Maximized;
                            }
                            this.Activate();

                            if (webView != null && webView.CoreWebView2 != null)
                            {
                                if (path == "LOGOUT" || path == "/logout" || path == "/logout-youtube")
                                {
                                    ClearYouTubeSessionAsync();
                                    return;
                                }

                                // Oynatıcı zaten açık durumdayken çift tıklanırsa (varsayılan /downlist tetiklenirse) 
                                // sayfa değiştirilmez, sadece pencere öne getirilir (video kesilmez).
                                if (path == "/downlist")
                                {
                                    return;
                                }

                                // Tepsi veya Ayarlar'dan "YouTube'da Oturum Aç" tıklandığında ana pencere video/indirme 
                                // sayfasında kalsın, oturum sayfası doğrudan minimal oturum penceresinde açılsın
                                if (path.Contains("accounts.google.com") || path.Contains("youtube.com"))
                                {
                                    OpenYouTubeCookieWindow(path, isBackgroundStartup: false);
                                    return;
                                }

                                string url;
                                if (path.StartsWith("http://", StringComparison.OrdinalIgnoreCase) || path.StartsWith("https://", StringComparison.OrdinalIgnoreCase))
                                {
                                    url = path;
                                }
                                else
                                {
                                    url = GetAppUrl().TrimEnd('/') + (path.StartsWith("/") ? path : "/" + path);
                                }

                                webView.CoreWebView2.Navigate(url);
                            }
                        });
                    }
                }
                catch {}
                handled = true;
            }
            return IntPtr.Zero;
        }

        private async void InitializeAsync()
        {
            // Arka plan sunucusunun açık olduğundan emin ol
            EnsureBackendRunning();

            try
            {
                // CoreWebView2Environment ile CORS'u devre dışı bırak ve otomatik oynatmayı bypass et
                string profileName = isSilentCookieRefresh ? "HaYTooLPlayer_Silent" : "HaYTooLPlayer_Main";
                string userDataFolder = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), profileName);
                var options = new Microsoft.Web.WebView2.Core.CoreWebView2EnvironmentOptions("--disable-web-security --autoplay-policy=no-user-gesture-required");
                var env = await Microsoft.Web.WebView2.Core.CoreWebView2Environment.CreateAsync(null, userDataFolder, options);

                // WebView2 Başlat
                await webView.EnsureCoreWebView2Async(env);
                webView.CoreWebView2.Settings.AreDevToolsEnabled = true;

                string debugLogFile = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "wv2_debug.log");
                try { File.AppendAllText(debugLogFile, $"[{DateTime.Now}] WebView2 Initialized.\n"); } catch {}

                // JavaScript Konsol Logları ve Sayfa Hatalarını Yakala
                await webView.CoreWebView2.AddScriptToExecuteOnDocumentCreatedAsync(@"
                    (function() {
                        const sendLog = (type, msg) => {
                            try {
                                if (window.chrome && window.chrome.webview) {
                                    window.chrome.webview.postMessage({ type, msg });
                                }
                            } catch(e) {}
                        };
                        const origLog = console.log;
                        const origErr = console.error;
                        const origWarn = console.warn;
                        console.log = function(...args) {
                            origLog.apply(console, args);
                            sendLog('log', args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' '));
                        };
                        console.error = function(...args) {
                            origErr.apply(console, args);
                            sendLog('error', args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' '));
                        };
                        console.warn = function(...args) {
                            origWarn.apply(console, args);
                            sendLog('warn', args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' '));
                        };
                        window.addEventListener('error', function(e) {
                            sendLog('uncaught_error', e.message + ' at ' + e.filename + ':' + e.lineno);
                        });
                        window.addEventListener('unhandledrejection', function(e) {
                            sendLog('unhandled_rejection', String(e.reason));
                        });
                    })();
                ");

                webView.CoreWebView2.WebMessageReceived += (s, e) =>
                {
                    try
                    {
                        string rawMsg = e.TryGetWebMessageAsString();
                        File.AppendAllText(debugLogFile, $"[{DateTime.Now}] [JS_LOG] {rawMsg}\n");
                    }
                    catch {}
                };

                // JavaScript Köprüsünü (Bridge) Kaydet
                webView.CoreWebView2.AddHostObjectToScript("playerBridge", new PlayerBridge(this));

                // Tüm yerel sürücüleri (C:\, D:\ vb.) WebView2 sanal ana bilgisayarına eşle (Güvenlik engellerini aşmak için)
                try
                {
                    foreach (string drive in Directory.GetLogicalDrives())
                    {
                        try
                        {
                            string driveLetter = drive.Substring(0, 1).ToLower();
                            webView.CoreWebView2.SetVirtualHostNameToFolderMapping(
                                $"haytool-{driveLetter}.local",
                                drive,
                                CoreWebView2HostResourceAccessKind.Allow
                            );
                        }
                        catch {}
                    }
                }
                catch {}

                // Tam ekran taleplerini dinle
                webView.CoreWebView2.ContainsFullScreenElementChanged += WebCoreWebView2_ContainsFullScreenElementChanged;

                // Dış bağlantıları varsayılan tarayıcıda açmak için dinleyiciler
                webView.CoreWebView2.NavigationStarting += CoreWebView2_NavigationStarting;
                webView.CoreWebView2.NewWindowRequested += CoreWebView2_NewWindowRequested;

                // Sayfa yükleme tamamlandı olayı
                webView.CoreWebView2.NavigationCompleted += (s, e) =>
                {
                    try
                    {
                        File.AppendAllText(debugLogFile, $"[{DateTime.Now}] NavCompleted: Success={e.IsSuccess}\n");
                    }
                    catch {}

                    if (isSilentCookieRefresh)
                    {
                        System.Threading.Tasks.Task.Run(async () =>
                        {
                            await System.Threading.Tasks.Task.Delay(2000);
                            await this.Dispatcher.InvokeAsync(() => SyncYouTubeCookiesToFileAsync());
                            await System.Threading.Tasks.Task.Delay(1500);
                            this.Dispatcher.Invoke(() => Application.Current.Shutdown());
                        });
                    }
                    else
                    {
                        // Normal arayüz açılışında UI thread'i kilitlemeden arka planda çerezleri kontrol et
                        System.Threading.Tasks.Task.Run(async () =>
                        {
                            await System.Threading.Tasks.Task.Delay(4000);
                            this.Dispatcher.Invoke(() => SyncYouTubeCookiesToFileAsync());
                        });

                        // Kullanıcı talebi: Açılışta arka planda gizlice YouTube oturumunu aç ve çerezleri al
                        if (!_hasStartupCookieWindowShown)
                        {
                            _hasStartupCookieWindowShown = true;
                            this.Dispatcher.InvokeAsync(() => OpenYouTubeCookieWindow(null, isBackgroundStartup: true));
                        }
                    }
                };

                // Eğer sessiz arka plan çerez yenileme modundaysak, YouTube ana sayfasına yönlendir.
                // Sayfa yüklenince NavigationCompleted tetiklenir → taze oturum çerezleri cookies.txt'e yazılır → uygulama kapanır.
                if (isSilentCookieRefresh)
                {
                    webView.CoreWebView2.Navigate("https://www.youtube.com");
                    return;
                }

                // Sunucu URL'sine Yönlendir (Varsayılan olarak İndirilenler sekmesinde aç)
                string url = GetAppUrl().TrimEnd('/') + "/downlist";

                // Komut satırı argümanı (örn: tam URL, /settings veya /downlist) varsa yönlendir
                string[] args = Environment.GetCommandLineArgs();
                string initialLoginUrl = null;
                if (args.Length > 1)
                {
                    string pathArg = args[1].Trim();
                    if (pathArg.Contains("accounts.google.com") || pathArg.Contains("youtube.com"))
                    {
                        // Tepsi menüsünden "YouTube'da Oturum Aç" argümanı ile başlatıldıysa
                        // Ana pencere /downlist olarak kalır, oturum küçük pencerede açılır
                        initialLoginUrl = pathArg;
                    }
                    else if (pathArg.StartsWith("http://", StringComparison.OrdinalIgnoreCase) || pathArg.StartsWith("https://", StringComparison.OrdinalIgnoreCase))
                    {
                        url = pathArg;
                    }
                    else if (pathArg.StartsWith("/"))
                    {
                        url = url.TrimEnd('/') + pathArg;
                    }
                }

                // Backend sunucusunun hazır olmasını bekle (race condition ve bağlantı reddi hatalarını engeller)
                await WaitForBackendReadyAsync(GetAppUrl(), 15);

                webView.CoreWebView2.Navigate(url);

                if (!string.IsNullOrEmpty(initialLoginUrl))
                {
                    _hasStartupCookieWindowShown = true;
                    OpenYouTubeCookieWindow(initialLoginUrl, isBackgroundStartup: false);
                }
            }
            catch (Exception ex)
            {
                MessageBox.Show("WebView2 arayüzü başlatılamadı: " + ex.Message, "Hata", MessageBoxButton.OK, MessageBoxImage.Error);
            }
        }

        private async System.Threading.Tasks.Task<bool> WaitForBackendReadyAsync(string baseUrl, int maxWaitSeconds = 15)
        {
            try
            {
                using (var client = new System.Net.Http.HttpClient())
                {
                    client.Timeout = TimeSpan.FromMilliseconds(600);
                    string testUrl = baseUrl.TrimEnd('/') + "/api/version";
                    DateTime startTime = DateTime.Now;

                    while ((DateTime.Now - startTime).TotalSeconds < maxWaitSeconds)
                    {
                        try
                        {
                            var response = await client.GetAsync(testUrl);
                            if (response.IsSuccessStatusCode)
                            {
                                return true;
                            }
                        }
                        catch
                        {
                            // Backend henüz dinlemede değil veya açılıyor, bekle ve tekrar dene
                        }
                        await System.Threading.Tasks.Task.Delay(250);
                    }
                }
            }
            catch {}
            return false;
        }

        private string GetAppUrl()
        {
            string port = "4141";
            try
            {
                string baseDir = AppDomain.CurrentDomain.BaseDirectory.TrimEnd(Path.DirectorySeparatorChar);
                string parentDir = Path.GetDirectoryName(baseDir) ?? baseDir;

                string iniPath = Path.Combine(baseDir, "configwin.ini");
                if (!File.Exists(iniPath))
                {
                    iniPath = Path.Combine(parentDir, "configwin.ini");
                }

                if (File.Exists(iniPath))
                {
                    foreach (var line in File.ReadLines(iniPath))
                    {
                        var trimmed = line.Trim();
                        if (trimmed.StartsWith(";") || trimmed.StartsWith("#")) continue;
                        if (trimmed.ToLower().StartsWith("port"))
                        {
                            var parts = trimmed.Split('=');
                            if (parts.Length > 1 && parts[0].Trim().Equals("port", StringComparison.OrdinalIgnoreCase))
                            {
                                string p = parts[1].Trim();
                                if (!string.IsNullOrEmpty(p)) port = p;
                                break;
                            }
                        }
                    }
                }
            }
            catch {}
            return "http://127.0.0.1:" + port;
        }

        /// <summary>
        /// Backend sunucusunun (Node.js) açık olup olmadığını kontrol eder.
        /// Sunucu portu zaten yanıt veriyorsa hiçbir harici işlem başlatmaz.
        /// Sunucu kapalıysa ve tepsi uygulaması çalışmıyorsa HaYTooL YT Downloader.exe başlatır.
        /// </summary>
        private void EnsureBackendRunning()
        {
            try
            {
                string appUrl = GetAppUrl();
                Uri u = new Uri(appUrl);
                int port = u.Port;

                // Port zaten dinleniyorsa backend ayaktadır, hiçbir harici işlem başlatma!
                if (IsPortResponding(port))
                {
                    return;
                }

                Process[] trayProcesses = Process.GetProcessesByName("Multimedia HaYTooL");
                if (trayProcesses.Length == 0) trayProcesses = Process.GetProcessesByName("HaYTooL YT Downloader");

                if (trayProcesses.Length == 0)
                {
                    string binDir = AppDomain.CurrentDomain.BaseDirectory.TrimEnd(Path.DirectorySeparatorChar);
                    string appRootDir = Path.GetDirectoryName(binDir) ?? binDir;
                    string trayPath = Path.Combine(appRootDir, "Multimedia HaYTooL.exe");
                    if (!File.Exists(trayPath)) trayPath = Path.Combine(appRootDir, "HaYTooL YT Downloader.exe");

                    if (File.Exists(trayPath))
                    {
                        ProcessStartInfo trayPsi = new ProcessStartInfo(trayPath);
                        trayPsi.WorkingDirectory = appRootDir;
                        trayPsi.UseShellExecute = true;
                        Process.Start(trayPsi);
                    }
                }
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine("Backend baslatilamadi: " + ex.Message);
            }
        }

        private static bool IsPortResponding(int port)
        {
            try
            {
                using (var client = new System.Net.Sockets.TcpClient())
                {
                    var result = client.BeginConnect("127.0.0.1", port, null, null);
                    bool success = result.AsyncWaitHandle.WaitOne(300);
                    if (!success) return false;
                    client.EndConnect(result);
                    return true;
                }
            }
            catch
            {
                return false;
            }
        }



        public void PlayVideoNative(string filePath, string title, string channelName, string publishDate, string videoId)
        {
            try
            {
                // Slash işaretlerini Windows uyumlu yap
                string normalizedPath = filePath.Replace('/', Path.DirectorySeparatorChar);

                // Eğer path göreceli (relative) ise, uygulamanın kurulu olduğu kök klasörle birleştir
                if (!Path.IsPathRooted(normalizedPath))
                {
                    string binDir = AppDomain.CurrentDomain.BaseDirectory.TrimEnd(Path.DirectorySeparatorChar);
                    string appRootDir = Path.GetDirectoryName(binDir) ?? binDir;
                    normalizedPath = Path.Combine(appRootDir, normalizedPath);
                }

                if (string.IsNullOrEmpty(normalizedPath) || !File.Exists(normalizedPath))
                {
                    MessageBox.Show("Video dosyası yerel diskte bulunamadı: " + normalizedPath, "Hata", MessageBoxButton.OK, MessageBoxImage.Warning);
                    return;
                }

                // Oynatıcı Penceresini Aç
                string serverUrl = GetAppUrl();
                PlayerWindow player = new PlayerWindow(normalizedPath, title, channelName, publishDate, videoId, serverUrl);
                player.Show();
            }
            catch (Exception ex)
            {
                MessageBox.Show("Video oynatılamadı: " + ex.Message, "Hata", MessageBoxButton.OK, MessageBoxImage.Error);
            }
        }

        protected override void OnSourceInitialized(EventArgs e)
        {
            base.OnSourceInitialized(e);
            WindowHelper.SetWindowAppId(this, "HaYTooL.MainWindow");

            HwndSource source = HwndSource.FromHwnd(new WindowInteropHelper(this).Handle);
            source.AddHook(new HwndSourceHook(WndProc));
        }

        private WindowStyle _webPrevWindowStyle = WindowStyle.SingleBorderWindow;
        private WindowState _webPrevWindowState = WindowState.Maximized;
        private ResizeMode _webPrevResizeMode = ResizeMode.CanResize;
        private bool _webPrevTopmost = false;

        private void WebCoreWebView2_ContainsFullScreenElementChanged(object sender, object e)
        {
            var webView = sender as Microsoft.Web.WebView2.Core.CoreWebView2;
            if (webView == null) return;

            this.Dispatcher.Invoke(() =>
            {
                if (webView.ContainsFullScreenElement)
                {
                    // Tam Ekran Moduna Geç
                    _webPrevWindowStyle = this.WindowStyle;
                    _webPrevWindowState = this.WindowState;
                    _webPrevResizeMode = this.ResizeMode;
                    _webPrevTopmost = this.Topmost;

                    if (this.WindowState != WindowState.Maximized)
                    {
                        this.WindowState = WindowState.Normal;
                    }
                    this.WindowStyle = WindowStyle.None;
                    this.ResizeMode = ResizeMode.NoResize;
                    this.Topmost = true;
                    this.WindowState = WindowState.Maximized;
                }
                else
                {
                    // Normal / Önceki Pencere Moduna Dön
                    this.Topmost = _webPrevTopmost;
                    this.WindowStyle = _webPrevWindowStyle;
                    this.ResizeMode = _webPrevResizeMode;
                    this.WindowState = _webPrevWindowState == WindowState.Normal ? WindowState.Normal : WindowState.Maximized;
                }
            });
        }

        // Türkçe Açıklama: Dış link navigasyon isteklerini yakalar, iptal eder ve varsayılan tarayıcıda açar.
        private void CoreWebView2_NavigationStarting(object sender, Microsoft.Web.WebView2.Core.CoreWebView2NavigationStartingEventArgs e)
        {
            string uri = e.Uri;
            if (string.IsNullOrEmpty(uri)) return;

            // Sadece HTTP/HTTPS bağlantılarını filtrele
            if (uri.StartsWith("http://", StringComparison.OrdinalIgnoreCase) || uri.StartsWith("https://", StringComparison.OrdinalIgnoreCase))
            {
                string appUrl = GetAppUrl();
                try
                {
                    Uri appUri = new Uri(appUrl);
                    Uri targetUri = new Uri(uri);

                    // haytool-X.local adresleri SetVirtualHostNameToFolderMapping ile eşlenmiş
                    // sanal sürücü kaynaklarıdır (video, thumbnail vb.). Bunlar WebView2 içi kaynak
                    // olduğundan dış tarayıcıya yönlendirilmemelidir.
                    bool isVirtualDrive = targetUri.Host.StartsWith("haytool-", StringComparison.OrdinalIgnoreCase)
                                       && targetUri.Host.EndsWith(".local", StringComparison.OrdinalIgnoreCase);

                    // YouTube ve Google oturum açma sayfaları dahili profilde çerez oluşturması için WebView2 içinde kalmalıdır
                    bool isAuthDomain = targetUri.Host.EndsWith("youtube.com", StringComparison.OrdinalIgnoreCase)
                                     || targetUri.Host.EndsWith("google.com", StringComparison.OrdinalIgnoreCase)
                                     || targetUri.Host.EndsWith("gstatic.com", StringComparison.OrdinalIgnoreCase)
                                     || targetUri.Host.EndsWith("googleusercontent.com", StringComparison.OrdinalIgnoreCase);

                    bool isLocalApp = (targetUri.Host.Equals("localhost", StringComparison.OrdinalIgnoreCase) || targetUri.Host.Equals("127.0.0.1", StringComparison.OrdinalIgnoreCase)) && targetUri.Port == appUri.Port;

                    // Eğer dahili sanal sürücü değilse, oturum sayfası değilse
                    // ve localhost/backend sunucumuz da değilse dış tarayıcıya aç
                    if (!isVirtualDrive && !isAuthDomain && !isLocalApp)
                    {
                        // Navigasyonu iptal et
                        e.Cancel = true;

                        // Varsayılan tarayıcıda aç
                        ProcessStartInfo psi = new ProcessStartInfo(uri);
                        psi.UseShellExecute = true;
                        Process.Start(psi);
                    }
                }
                catch (Exception)
                {
                    // URL ayrıştırma veya açma hatası durumunda navigasyonu bozma
                }
            }
        }

        // Türkçe Açıklama: Target="_blank" şeklinde yeni pencerede açılmak istenen dış linkleri engeller ve varsayılan tarayıcıya yönlendirir.
        private void CoreWebView2_NewWindowRequested(object sender, Microsoft.Web.WebView2.Core.CoreWebView2NewWindowRequestedEventArgs e)
        {
            try
            {
                string uri = e.Uri;
                if (!string.IsNullOrEmpty(uri))
                {
                    Uri targetUri = new Uri(uri);
                    bool isAuthDomain = targetUri.Host.EndsWith("youtube.com", StringComparison.OrdinalIgnoreCase)
                                     || targetUri.Host.EndsWith("google.com", StringComparison.OrdinalIgnoreCase)
                                     || targetUri.Host.EndsWith("gstatic.com", StringComparison.OrdinalIgnoreCase)
                                     || targetUri.Host.EndsWith("googleusercontent.com", StringComparison.OrdinalIgnoreCase);

                    if (!isAuthDomain)
                    {
                        e.Handled = true;
                        ProcessStartInfo psi = new ProcessStartInfo(uri);
                        psi.UseShellExecute = true;
                        Process.Start(psi);
                    }
                }
            }
            catch {}
        }

        // Türkçe Açıklama: WebView2 içindeki YouTube oturum çerezlerini Netscape cookies.txt formatında kök dizine yazar.
        public async System.Threading.Tasks.Task SyncYouTubeCookiesToFileAsync()
        {
            try
            {
                if (webView == null || webView.CoreWebView2 == null) return;

                // 1. Yalnızca YouTube sayfasındayken taze token keepalive pingi at
                try
                {
                    string currentUrl = await webView.CoreWebView2.ExecuteScriptAsync("window.location.hostname");
                    if (currentUrl != null && currentUrl.Contains("youtube.com"))
                    {
                        await webView.CoreWebView2.ExecuteScriptAsync("fetch('https://www.youtube.com/generate_204', {credentials: 'include', mode: 'no-cors'}).catch(()=>{})");
                    }
                }
                catch {}

                var cookieManager = webView.CoreWebView2.CookieManager;
                var cookies = await cookieManager.GetCookiesAsync("https://www.youtube.com");
                if (cookies == null || cookies.Count == 0) return;

                string baseDir = AppDomain.CurrentDomain.BaseDirectory;
                string rootDir = Directory.Exists(Path.Combine(baseDir, "public")) ? baseDir : (Directory.GetParent(baseDir)?.FullName ?? baseDir);

                bool hasLoginInfo = false;
                System.Text.StringBuilder sb = new System.Text.StringBuilder();
                sb.AppendLine("# Netscape HTTP Cookie File");
                sb.AppendLine("# https://curl.haxx.se/rfc/cookie_spec.html");
                sb.AppendLine("# This file was generated by HaYTooL Player Native Bridge.");
                sb.AppendLine();

                foreach (var c in cookies)
                {
                    string domain = c.Domain;
                    string includeSubdomains = domain.StartsWith(".") ? "TRUE" : "FALSE";
                    string path = string.IsNullOrEmpty(c.Path) ? "/" : c.Path;
                    string secure = c.IsSecure ? "TRUE" : "FALSE";
                    long expires = 2147483647;
                    if (c.Expires > DateTime.MinValue && c.Expires < DateTime.MaxValue)
                    {
                        try
                        {
                            expires = (long)(c.Expires - new DateTime(1970, 1, 1, 0, 0, 0, DateTimeKind.Utc)).TotalSeconds;
                            if (expires <= 0) expires = 2147483647;
                        }
                        catch {}
                    }

                    sb.AppendLine(string.Format("{0}\t{1}\t{2}\t{3}\t{4}\t{5}\t{6}",
                        domain, includeSubdomains, path, secure, expires, c.Name, c.Value));

                    if (c.Name == "LOGIN_INFO" || c.Name == "__Secure-1PSID" || c.Name == "__Secure-3PSID" || c.Name == "SAPISID" || c.Name == "SID" || c.Name == "__Secure-3PAPISID" || c.Name == "__Secure-1PAPISID")
                    {
                        hasLoginInfo = true;
                    }
                }

                if (hasLoginInfo)
                {
                    var utf8NoBom = new System.Text.UTF8Encoding(false);
                    string cookieText = sb.ToString();
                    System.Threading.Tasks.Task.Run(() =>
                    {
                        try { File.WriteAllText(Path.Combine(rootDir, "cookies.txt"), cookieText, utf8NoBom); } catch {}
                        try { File.WriteAllText(Path.Combine(baseDir, "cookies.txt"), cookieText, utf8NoBom); } catch {}
                    });
                }
            }
            catch {}
        }

        // Türkçe Açıklama: WebView2 içindeki tüm Google ve YouTube çerezlerini siler, oturumu sıfırlar.
        public async void ClearYouTubeSessionAsync()
        {
            try
            {
                if (webView != null && webView.CoreWebView2 != null)
                {
                    var cookieManager = webView.CoreWebView2.CookieManager;
                    
                    var ytCookies = await cookieManager.GetCookiesAsync("https://www.youtube.com");
                    if (ytCookies != null)
                    {
                        foreach (var c in ytCookies)
                        {
                            cookieManager.DeleteCookie(c);
                        }
                    }

                    var gCookies = await cookieManager.GetCookiesAsync("https://accounts.google.com");
                    if (gCookies != null)
                    {
                        foreach (var c in gCookies)
                        {
                            cookieManager.DeleteCookie(c);
                        }
                    }

                    var googleRootCookies = await cookieManager.GetCookiesAsync("https://google.com");
                    if (googleRootCookies != null)
                    {
                        foreach (var c in googleRootCookies)
                        {
                            cookieManager.DeleteCookie(c);
                        }
                    }
                }

                string baseDir = AppDomain.CurrentDomain.BaseDirectory;
                string rootDir = Directory.Exists(Path.Combine(baseDir, "public")) ? baseDir : (Directory.GetParent(baseDir)?.FullName ?? baseDir);

                try { if (File.Exists(Path.Combine(rootDir, "cookies.txt"))) File.Delete(Path.Combine(rootDir, "cookies.txt")); } catch {}
                try { if (File.Exists(Path.Combine(baseDir, "cookies.txt"))) File.Delete(Path.Combine(baseDir, "cookies.txt")); } catch {}
            }
            catch {}
        }

        private static bool _hasStartupCookieWindowShown = false;
        private static Window _cookieWindowInstance = null;

        // Türkçe Açıklama: YouTube oturum & çerez penceresini ana oynatıcı ile AYNI profil (HaYTooLPlayer_Main) altında açar.
        // Açılışta arka planda gizli (Opacity=0, ekran dışında) açılır, çerezleri alır ve 30 sn sonra otomatik kapanır.
        // Tepsi menüsünden veya manuel çağrıldığında ekranda görünür şekilde öne getirilir.
        private void OpenYouTubeCookieWindow(string targetUrl = null, bool isBackgroundStartup = false)
        {
            string finalUrl = string.IsNullOrEmpty(targetUrl)
                ? "https://accounts.google.com/ServiceLogin?service=youtube&continue=https%3A%2F%2Fwww.youtube.com"
                : targetUrl;

            try
            {
                // Eğer pencere zaten açıksa
                if (_cookieWindowInstance != null && _cookieWindowInstance.IsLoaded)
                {
                    // Manuel istek geldiyse (kullanıcı tıkladıysa), gizli pencereyi merkeze al ve görünür yap
                    if (!isBackgroundStartup)
                    {
                        _cookieWindowInstance.Width = 620;
                        _cookieWindowInstance.Height = 650;
                        _cookieWindowInstance.Left = (SystemParameters.PrimaryScreenWidth - 620) / 2;
                        _cookieWindowInstance.Top = (SystemParameters.PrimaryScreenHeight - 650) / 2;
                        _cookieWindowInstance.WindowStyle = WindowStyle.SingleBorderWindow;
                        _cookieWindowInstance.ShowInTaskbar = true;
                        _cookieWindowInstance.Opacity = 1;
                        if (_cookieWindowInstance.WindowState == WindowState.Minimized)
                        {
                            _cookieWindowInstance.WindowState = WindowState.Normal;
                        }
                        _cookieWindowInstance.Activate();
                        _cookieWindowInstance.Focus();
                    }
                    return;
                }

                var cookieWin = new Window
                {
                    Title = "HaYTooL - YouTube Oturum & Çerez (İşiniz bitince kapatabilirsiniz)",
                    WindowStartupLocation = isBackgroundStartup ? WindowStartupLocation.Manual : WindowStartupLocation.CenterScreen,
                    Width = isBackgroundStartup ? 1 : 620,
                    Height = isBackgroundStartup ? 1 : 650,
                    Left = isBackgroundStartup ? -3000 : (SystemParameters.PrimaryScreenWidth - 620) / 2,
                    Top = isBackgroundStartup ? -3000 : (SystemParameters.PrimaryScreenHeight - 650) / 2,
                    WindowStyle = isBackgroundStartup ? WindowStyle.None : WindowStyle.SingleBorderWindow,
                    ShowInTaskbar = !isBackgroundStartup,
                    Opacity = isBackgroundStartup ? 0 : 1,
                    ShowActivated = !isBackgroundStartup,
                    Background = new System.Windows.Media.SolidColorBrush(System.Windows.Media.Color.FromRgb(24, 24, 27)),
                    Topmost = false
                };
                _cookieWindowInstance = cookieWin;

                var wv = new Microsoft.Web.WebView2.Wpf.WebView2();
                cookieWin.Content = wv;

                cookieWin.Loaded += async (s, e) =>
                {
                    try
                    {
                        // Kritik: Ana oynatıcının CoreWebView2Environment örneğini paylaş!
                        // Böylece %LOCALAPPDATA%\HaYTooLPlayer_Main içerisindeki kayıtlı Google/YouTube 
                        // oturumu, kullanıcı adı, şifresi ve çerezleri eksiksiz paylaşılır.
                        if (webView != null && webView.CoreWebView2 != null && webView.CoreWebView2.Environment != null)
                        {
                            await wv.EnsureCoreWebView2Async(webView.CoreWebView2.Environment);
                        }
                        else
                        {
                            string profileName = "HaYTooLPlayer_Main";
                            string userDataFolder = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), profileName);
                            var options = new Microsoft.Web.WebView2.Core.CoreWebView2EnvironmentOptions("--disable-web-security --autoplay-policy=no-user-gesture-required");
                            var env = await CoreWebView2Environment.CreateAsync(null, userDataFolder, options);
                            await wv.EnsureCoreWebView2Async(env);
                        }

                        wv.CoreWebView2.NavigationCompleted += (navSender, navArgs) =>
                        {
                            // Sayfa yüklendiğinde çerezleri diske senkronize et
                            if (navArgs.IsSuccess)
                            {
                                System.Threading.Tasks.Task.Run(async () =>
                                {
                                    await System.Threading.Tasks.Task.Delay(2000);
                                    await this.Dispatcher.InvokeAsync(() => SyncYouTubeCookiesToFileAsync());
                                });
                            }
                        };

                        wv.CoreWebView2.Navigate(finalUrl);
                    }
                    catch (Exception ex)
                    {
                        if (!isBackgroundStartup)
                        {
                            MessageBox.Show("YouTube oturum penceresi yüklenemedi: " + ex.Message);
                        }
                    }
                };

                // Açılışta otomatik başlatıldıysa 30 saniye sonra pencereyi otomatik kapat
                if (isBackgroundStartup)
                {
                    System.Threading.Tasks.Task.Run(async () =>
                    {
                        await System.Threading.Tasks.Task.Delay(30000);
                        await this.Dispatcher.InvokeAsync(async () =>
                        {
                            try
                            {
                                // Eğer pencere hala arka plan modundaysa (kullanıcı manuel öne getirmemişse) kapat
                                if (cookieWin != null && cookieWin.IsLoaded && cookieWin.Opacity == 0)
                                {
                                    await SyncYouTubeCookiesToFileAsync();
                                    cookieWin.Close();
                                }
                            }
                            catch {}
                        });
                    });
                }

                // Pencere kapandığında taze çerezleri cookies.txt dosyasına yaz
                cookieWin.Closed += (s, e) =>
                {
                    _cookieWindowInstance = null;
                    try
                    {
                        SyncYouTubeCookiesToFileAsync();
                    }
                    catch {}
                };

                cookieWin.Show();
            }
            catch {}
        }
    }
}