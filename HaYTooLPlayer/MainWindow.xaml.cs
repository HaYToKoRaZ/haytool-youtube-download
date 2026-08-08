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
        private System.Windows.Threading.DispatcherTimer backendMonitorTimer;

        public MainWindow()
        {
            InitializeComponent();
            this.WindowState = WindowState.Maximized;
            InitializeAsync();
            StartBackendMonitor();
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
                    if (!string.IsNullOrEmpty(path) && path.StartsWith("/"))
                    {
                        this.Dispatcher.Invoke(() =>
                        {
                            if (this.WindowState == WindowState.Minimized)
                            {
                                this.WindowState = WindowState.Normal;
                            }
                            this.Activate();
                            this.Topmost = true;
                            this.Topmost = false;

                            if (webView != null && webView.CoreWebView2 != null)
                            {
                                // Oynatıcı zaten açık durumdayken çift tıklanırsa (varsayılan /downlist tetiklenirse) 
                                // sayfa değiştirilmez, sadece pencere öne getirilir (video kesilmez).
                                if (path == "/downlist")
                                {
                                    return;
                                }

                                string url = GetAppUrl().TrimEnd('/') + path;
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
                string userDataFolder = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "HaYTooLPlayer_Main");
                var options = new Microsoft.Web.WebView2.Core.CoreWebView2EnvironmentOptions("--disable-web-security --autoplay-policy=no-user-gesture-required");
                var env = await Microsoft.Web.WebView2.Core.CoreWebView2Environment.CreateAsync(null, userDataFolder, options);

                // WebView2 Başlat
                await webView.EnsureCoreWebView2Async(env);

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

                // Sunucu URL'sine Yönlendir
                string url = GetAppUrl();

                // Komut satırı argümanı (örn: /settings veya /downlist) varsa URL'ye ekle
                string[] args = Environment.GetCommandLineArgs();
                if (args.Length > 1)
                {
                    string pathArg = args[1].Trim();
                    if (pathArg.StartsWith("/"))
                    {
                        url = url.TrimEnd('/') + pathArg;
                    }
                }

                webView.CoreWebView2.Navigate(url);
            }
            catch (Exception ex)
            {
                MessageBox.Show("WebView2 arayüzü başlatılamadı: " + ex.Message, "Hata", MessageBoxButton.OK, MessageBoxImage.Error);
            }
        }

        private string GetAppUrl()
        {
            string port = "4141";
            try
            {
                string iniPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "configwin.ini");
                if (File.Exists(iniPath))
                {
                    foreach (var line in File.ReadLines(iniPath))
                    {
                        if (line.Trim().ToLower().StartsWith("port="))
                        {
                            port = line.Split('=')[1].Trim();
                            break;
                        }
                    }
                }
            }
            catch {}
            return "http://localhost:" + port;
        }

        /// <summary>
        /// HaYTooL YT Downloader.exe (Tepsi/Backend) uygulamasının açık olup olmadığını kontrol eder.
        /// Açık değilse, uygulamanın kurulu olduğu dizindeki yürütülebilir dosyayı çalıştırır.
        /// </summary>
        private void EnsureBackendRunning()
        {
            try
            {
                Process[] trayProcesses = Process.GetProcessesByName("HaYTooL YT Downloader");
                if (trayProcesses.Length == 0)
                {
                    string binDir = AppDomain.CurrentDomain.BaseDirectory.TrimEnd(Path.DirectorySeparatorChar);
                    string appRootDir = Path.GetDirectoryName(binDir) ?? binDir;
                    string trayPath = Path.Combine(appRootDir, "HaYTooL YT Downloader.exe");
                    if (File.Exists(trayPath))
                    {
                        ProcessStartInfo trayPsi = new ProcessStartInfo(trayPath);
                        trayPsi.WorkingDirectory = appRootDir;
                        trayPsi.UseShellExecute = true;
                        Process.Start(trayPsi);
                        // Backend sunucusunun (Node.js) ayağa kalkması için biraz bekle
                        System.Threading.Thread.Sleep(1500);
                    }
                }
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine("Backend baslatilamadi: " + ex.Message);
            }
        }

        /// <summary>
        /// Arka plan sunucusunun (HaYTooL YT Downloader) açık olup olmadığını kontrol eder.
        /// Sunucu kapatılmışsa oyuncuyu (WPF penceresini) otomatik olarak kapatır.
        /// </summary>
        private void StartBackendMonitor()
        {
            backendMonitorTimer = new System.Windows.Threading.DispatcherTimer();
            backendMonitorTimer.Interval = TimeSpan.FromSeconds(2);
            backendMonitorTimer.Tick += (sender, e) =>
            {
                try
                {
                    Process[] trayProcesses = Process.GetProcessesByName("HaYTooL YT Downloader");
                    if (trayProcesses.Length == 0)
                    {
                        backendMonitorTimer.Stop();
                        this.Close();
                    }
                }
                catch {}
            };
            backendMonitorTimer.Start();
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
            SetWindowAppId("HaYTooL.MainWindow");

            HwndSource source = HwndSource.FromHwnd(new WindowInteropHelper(this).Handle);
            source.AddHook(new HwndSourceHook(WndProc));
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

        private WindowStyle _webPrevWindowStyle = WindowStyle.SingleBorderWindow;
        private WindowState _webPrevWindowState = WindowState.Normal;
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

                    this.WindowState = WindowState.Normal; // Önce Normal'e çek ki maksimize geçişi tetiklensin
                    this.WindowStyle = WindowStyle.None;
                    this.ResizeMode = ResizeMode.NoResize;
                    this.Topmost = true;
                    this.WindowState = WindowState.Maximized;
                }
                else
                {
                    // Normal Moduna Dön
                    this.WindowStyle = _webPrevWindowStyle;
                    this.WindowState = WindowState.Normal; // Önce normal yapıp sonra orijinal state'i uygula
                    this.ResizeMode = _webPrevResizeMode;
                    this.Topmost = _webPrevTopmost;
                    this.WindowState = _webPrevWindowState;
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

                    // Eğer yönlenilmeye çalışılan sunucu localhost/backend sunucumuz değilse
                    if (targetUri.Host != appUri.Host || targetUri.Port != appUri.Port)
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
                    // URL ayrıştırma veya açma hatası durumunda varsayılan tarayıcıya yönlendir
                    try
                    {
                        e.Cancel = true;
                        ProcessStartInfo psi = new ProcessStartInfo(uri);
                        psi.UseShellExecute = true;
                        Process.Start(psi);
                    }
                    catch {}
                }
            }
        }

        // Türkçe Açıklama: Target="_blank" şeklinde yeni pencerede açılmak istenen dış linkleri engeller ve varsayılan tarayıcıya yönlendirir.
        private void CoreWebView2_NewWindowRequested(object sender, Microsoft.Web.WebView2.Core.CoreWebView2NewWindowRequestedEventArgs e)
        {
            e.Handled = true;
            try
            {
                string uri = e.Uri;
                if (!string.IsNullOrEmpty(uri))
                {
                    ProcessStartInfo psi = new ProcessStartInfo(uri);
                    psi.UseShellExecute = true;
                    Process.Start(psi);
                }
            }
            catch {}
        }
    }
}