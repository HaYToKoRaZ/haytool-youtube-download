using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Net;
using System.Text;
using System.Threading;
using System.Windows.Forms;
using Microsoft.Win32;

namespace HaYTooLTray
{
    public class Program : ApplicationContext
    {
        private NotifyIcon trayIcon;
        private Process nodeProcess;

        private StringBuilder consoleBuffer = new StringBuilder();
        private Form logForm;
        private RichTextBox logTextBox;
        private object bufferLock = new object();
        public Form syncForm;

        /// <summary>
        /// Uygulamanın tepsisiz (Tray simgesi olmadan) silent modda çalışıp çalışmayacağını belirtir.
        /// </summary>
        public static bool IsSilentMode = false;

        // Dil senkronizasyonu için sınıf düzeyinde menü öğeleri
        private MenuItem openUiItem;
        private MenuItem openAppBrowserItem;
        private MenuItem pasteDownloadItem;
        private MenuItem shortcutsMenu;
        private MenuItem libraryShortcut;
        private MenuItem queueShortcut;
        private MenuItem downloadedShortcut;
        private MenuItem channelsShortcut;
        private MenuItem settingsShortcut;
        private MenuItem settingsItem;
        private MenuItem checkChannelsItem;
        private MenuItem altSpeedItem;
        private MenuItem bootItem;
        private MenuItem discordRpcItem;
        private MenuItem restartItem;
        private MenuItem showConsoleItem;
        private MenuItem exitItem;

        [System.Runtime.InteropServices.DllImport("user32.dll", CharSet = System.Runtime.InteropServices.CharSet.Auto)]
        private static extern uint RegisterWindowMessage(string lpString);
        public static readonly uint WM_TASKBARCREATED = RegisterWindowMessage("TaskbarCreated");

        public class SyncMessageForm : Form
        {
            private Program programRef;
            public SyncMessageForm(Program program)
            {
                programRef = program;
            }

            protected override void WndProc(ref Message m)
            {
                if (m.Msg == Program.WM_TASKBARCREATED)
                {
                    if (programRef != null)
                    {
                        programRef.RefreshTrayIcon();
                    }
                }
                base.WndProc(ref m);
            }
        }

        [System.Runtime.InteropServices.DllImport("kernel32.dll")]
        private static extern bool AttachConsole(int dwProcessId);
        private const int ATTACH_PARENT_PROCESS = -1;

        [System.Runtime.InteropServices.DllImport("kernel32.dll")]
        private static extern bool FreeConsole();

        [System.Runtime.InteropServices.DllImport("kernel32.dll")]
        private static extern IntPtr GetStdHandle(int nStdHandle);
        private const int STD_OUTPUT_HANDLE = -11;
        private const int STD_ERROR_HANDLE = -12;

        [System.Runtime.InteropServices.DllImport("user32.dll")]
        private static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, uint dwExtraInfo);
        private const byte VK_RETURN = 0x0D;
        private const uint KEYEVENTF_KEYUP = 0x0002;

        [System.Runtime.InteropServices.DllImport("kernel32.dll", CharSet = System.Runtime.InteropServices.CharSet.Unicode)]
        private static extern IntPtr CreateJobObject(IntPtr lpJobAttributes, string lpName);

        [System.Runtime.InteropServices.DllImport("kernel32.dll")]
        private static extern bool SetInformationJobObject(IntPtr hJob, int infoType, IntPtr lpJobObjectInfo, uint cbJobObjectInfoLength);

        [System.Runtime.InteropServices.DllImport("kernel32.dll")]
        private static extern bool AssignProcessToJobObject(IntPtr hJob, IntPtr hProcess);

        [System.Runtime.InteropServices.DllImport("kernel32.dll")]
        private static extern bool CloseHandle(IntPtr hObject);

        private enum JobObjectInfoType
        {
            ExtendedLimitInformation = 9
        }

        [System.Runtime.InteropServices.StructLayout(System.Runtime.InteropServices.LayoutKind.Sequential)]
        private struct JOBOBJECT_BASIC_LIMIT_INFORMATION
        {
            public Int64 PerProcessUserTimeLimit;
            public Int64 PerJobUserTimeLimit;
            public UInt32 LimitFlags;
            public UIntPtr MinimumWorkingSetSize;
            public UIntPtr MaximumWorkingSetSize;
            public UInt32 ActiveProcessLimit;
            public UIntPtr Affinity;
            public UInt32 PriorityClass;
            public UInt32 SchedulingClass;
        }

        [System.Runtime.InteropServices.StructLayout(System.Runtime.InteropServices.LayoutKind.Sequential)]
        private struct IO_COUNTERS
        {
            public UInt64 ReadOperationCount;
            public UInt64 WriteOperationCount;
            public UInt64 OtherOperationCount;
            public UInt64 ReadTransferCount;
            public UInt64 WriteTransferCount;
            public UInt64 OtherTransferCount;
        }

        [System.Runtime.InteropServices.StructLayout(System.Runtime.InteropServices.LayoutKind.Sequential)]
        private struct JOBOBJECT_EXTENDED_LIMIT_INFORMATION
        {
            public JOBOBJECT_BASIC_LIMIT_INFORMATION BasicLimitInformation;
            public IO_COUNTERS IoCounters;
            public UIntPtr ProcessMemoryLimit;
            public UIntPtr JobMemoryLimit;
            public UIntPtr PeakProcessMemoryUsed;
            public UIntPtr PeakJobMemoryUsed;
        }

        private const uint JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE = 0x00002000;
        private IntPtr jobHandle = IntPtr.Zero;

        [STAThread]
        public static void Main(string[] args)
        {
            try { Directory.SetCurrentDirectory(AppDomain.CurrentDomain.BaseDirectory); } catch {}

            Application.ThreadException += (sender, e) => {
                File.WriteAllText(Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "crash.txt"), "ThreadException:\n" + e.Exception.ToString());
            };
            AppDomain.CurrentDomain.UnhandledException += (sender, e) => {
                File.WriteAllText(Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "crash.txt"), "UnhandledException:\n" + e.ExceptionObject.ToString());
            };

            try
            {
                if (args.Length > 0)
                {
                    if (args.Length == 1 && string.Equals(args[0], "silent", StringComparison.OrdinalIgnoreCase))
                    {
                        IsSilentMode = true;
                    }
                    else
                    {
                        // CLI Modu - Ebeveyn konsoluna bağlan ve Node sunucusuna argümanları aktar
                        AttachConsole(ATTACH_PARENT_PROCESS);
                        RunCli(args);
                        return;
                    }
                }

                bool createdNew;
                using (System.Threading.Mutex mutex = new System.Threading.Mutex(true, "Local\\HaYTooLYTDownloaderSingleInstanceMutexV8", out createdNew))
                {
                    if (!createdNew)
                    {
                        File.WriteAllText(Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "mutex_lock.txt"), "Mutex zaten kilitli! Program calisiyor.");
                        // Zaten çalışıyor!
                        int port = 4141;
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
                                        if (string.Equals(key, "port", StringComparison.OrdinalIgnoreCase))
                                        {
                                            int parsedPort;
                                            if (int.TryParse(val, out parsedPort))
                                            {
                                                port = parsedPort;
                                                break;
                                            }
                                        }
                                    }
                                }
                            }
                            catch {}
                        }
                        
                        string url = "http://localhost:" + port + "/downlist";
                        
                        MessageBox.Show("HaYTooL YouTube Downloader zaten çalışıyor!\nArayüz tarayıcınızda açılıyor.", 
                                        "Bilgi", 
                                        MessageBoxButtons.OK, 
                                        MessageBoxIcon.Information);
                        
                        try
                        {
                            Process.Start(url);
                        }
                        catch {}
                        
                        return;
                    }

                    File.WriteAllText(Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "mutex_lock.txt"), "Mutex basariyla olusturuldu. Program baslatiliyor.");
                    if (IsSilentMode)
                    {
                        try
                        {
                            Directory.SetCurrentDirectory(AppDomain.CurrentDomain.BaseDirectory);
                            string backendPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "bin", "HaYTool-Backend.exe");
                            ProcessStartInfo psi = new ProcessStartInfo(backendPath, "server.js");
                            psi.CreateNoWindow = true;
                            psi.UseShellExecute = false;
                            psi.WorkingDirectory = AppDomain.CurrentDomain.BaseDirectory;
                            
                            Process p = Process.Start(psi);
                            if (p != null)
                            {
                                p.WaitForExit();
                            }
                        }
                        catch (Exception ex)
                        {
                            File.WriteAllText(Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "silent_backend_error.txt"), ex.ToString());
                        }
                    }
                    else
                    {
                        Application.EnableVisualStyles();
                        Application.SetCompatibleTextRenderingDefault(false);
                        Program app = new Program();
                        File.WriteAllText(Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "mutex_lock.txt"), "Program nesnesi basariyla olusturuldu!");
                        Application.Run(app);
                    }
                }
            }
            catch (Exception ex)
            {
                try { File.WriteAllText(Path.Combine(Path.GetTempPath(), "haytool_main_crash.txt"), ex.ToString()); } catch {}
            }
        }

        private static void RunCli(string[] args)
        {
            try
            {
                // Konsol çıktı kodlamasını Türkçe karakterler için UTF-8 olarak ayarla
                try { Console.OutputEncoding = Encoding.UTF8; } catch {}

                // Standart çıktı akışlarını ebeveyn konsoluna yönlendirilecek şekilde ata
                IntPtr stdOutHandle = GetStdHandle(STD_OUTPUT_HANDLE);
                if (stdOutHandle != IntPtr.Zero && stdOutHandle != new IntPtr(-1))
                {
                    var safeHandle = new Microsoft.Win32.SafeHandles.SafeFileHandle(stdOutHandle, true);
                    var fileStream = new FileStream(safeHandle, FileAccess.Write);
                    var writer = new StreamWriter(fileStream, Encoding.UTF8) { AutoFlush = true };
                    Console.SetOut(writer);
                }

                IntPtr stdErrHandle = GetStdHandle(STD_ERROR_HANDLE);
                if (stdErrHandle != IntPtr.Zero && stdErrHandle != new IntPtr(-1))
                {
                    var safeHandle = new Microsoft.Win32.SafeHandles.SafeFileHandle(stdErrHandle, true);
                    var fileStream = new FileStream(safeHandle, FileAccess.Write);
                    var writer = new StreamWriter(fileStream, Encoding.UTF8) { AutoFlush = true };
                    Console.SetError(writer);
                }

                StringBuilder argString = new StringBuilder();
                argString.Append("server.js");
                foreach (string arg in args)
                {
                    argString.Append(" ");
                    argString.Append(EscapeArgument(arg));
                }

                string backendPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "bin", "HaYTool-Backend.exe");
                if (!File.Exists(backendPath))
                {
                    Console.Error.WriteLine("Hata: Taşınabilir backend motoru bulunamadı: bin\\HaYTool-Backend.exe");
                    return;
                }

                ProcessStartInfo psi = new ProcessStartInfo(backendPath, argString.ToString());
                psi.CreateNoWindow = true;
                psi.UseShellExecute = false;
                psi.WindowStyle = ProcessWindowStyle.Hidden;
                psi.RedirectStandardOutput = true;
                psi.RedirectStandardError = true;
                psi.StandardOutputEncoding = Encoding.UTF8;
                psi.StandardErrorEncoding = Encoding.UTF8;
                psi.WorkingDirectory = AppDomain.CurrentDomain.BaseDirectory;

                using (Process proc = new Process())
                {
                    proc.StartInfo = psi;
                    proc.OutputDataReceived += (s, e) => {
                        if (e.Data != null) Console.WriteLine(e.Data);
                    };
                    proc.ErrorDataReceived += (s, e) => {
                        if (e.Data != null) Console.Error.WriteLine(e.Data);
                    };
                    proc.Start();
                    proc.BeginOutputReadLine();
                    proc.BeginErrorReadLine();
                    proc.WaitForExit();
                }

                // Ebeveyn konsoldan ayrıl ve bir adet ENTER tuşu göndererek prompt satırının temizce geri gelmesini sağla
                FreeConsole();
                keybd_event(VK_RETURN, 0, 0, 0); // Key down
                keybd_event(VK_RETURN, 0, KEYEVENTF_KEYUP, 0); // Key up
            }
            catch (Exception ex)
            {
                Console.Error.WriteLine("CLI Hata: " + ex.Message);
            }
        }

        private static string EscapeArgument(string arg)
        {
            if (arg.Contains(" ") || arg.Contains("\""))
            {
                return "\"" + arg.Replace("\"", "\\\"") + "\"";
            }
            return arg;
        }

        // Türkçe Açıklama: Sistem Tepsisi (Tray) uygulamasını başlatır, simgeyi ve sağ tık menüsünü hazırlar.
        public Program()
        {
            try
            {
                try { Directory.SetCurrentDirectory(AppDomain.CurrentDomain.BaseDirectory); } catch {}

            // Job Object oluştur
            try
            {
                jobHandle = CreateJobObject(IntPtr.Zero, null);
                if (jobHandle != IntPtr.Zero)
                {
                    JOBOBJECT_BASIC_LIMIT_INFORMATION basicLimits = new JOBOBJECT_BASIC_LIMIT_INFORMATION();
                    basicLimits.LimitFlags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;

                    JOBOBJECT_EXTENDED_LIMIT_INFORMATION extendedLimits = new JOBOBJECT_EXTENDED_LIMIT_INFORMATION();
                    extendedLimits.BasicLimitInformation = basicLimits;

                    int size = System.Runtime.InteropServices.Marshal.SizeOf(extendedLimits);
                    IntPtr extendedLimitsPtr = System.Runtime.InteropServices.Marshal.AllocHGlobal(size);
                    try
                    {
                        System.Runtime.InteropServices.Marshal.StructureToPtr(extendedLimits, extendedLimitsPtr, false);
                        if (!SetInformationJobObject(jobHandle, (int)JobObjectInfoType.ExtendedLimitInformation, extendedLimitsPtr, (uint)size))
                        {
                            AppendLog("[TRAY ERROR] Job Object limitleri ayarlanamadı.");
                        }
                    }
                    finally
                    {
                        System.Runtime.InteropServices.Marshal.FreeHGlobal(extendedLimitsPtr);
                    }
                }
            }
            catch (Exception ex)
            {
                AppendLog("[TRAY ERROR] Job Object oluşturulurken hata: " + ex.Message);
            }

            // Güvenli asenkron UI çağrıları ve TaskbarCreated takibi için senkronizasyon formunu hazırla
            syncForm = new SyncMessageForm(this);
            IntPtr forcedHandle = syncForm.Handle; // Handle oluşturulmasını zorunlu kıl

            // Logs dizinini oluştur
            if (!Directory.Exists("logs"))
            {
                Directory.CreateDirectory("logs");
            }

            // Tray İkonunu Hazırla (Sadece silent mod dışındaysa)
            if (!IsSilentMode)
            {
                trayIcon = new NotifyIcon();
                trayIcon.Text = "HaYTooL YouTube Downloader";
                
                // Mutlak dosya yolu ile icon.ico dosyasını yükle (Startup kaynaklı yol hatalarını önler)
                string iconPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "icon.ico");
                if (File.Exists(iconPath))
                {
                    try
                    {
                        trayIcon.Icon = new Icon(iconPath);
                    }
                    catch
                    {
                        trayIcon.Icon = SystemIcons.Application;
                    }
                }
                else
                {
                    trayIcon.Icon = SystemIcons.Application;
                }

                // Çift tıklama olayını bağla
                trayIcon.DoubleClick += OpenWebPage;
            }

            // Sınıf düzeyindeki menü elemanlarını oluştur
            openUiItem = new MenuItem("Arayüzü Aç", OpenWebPage);
            openAppBrowserItem = new MenuItem("Kendi Tarayıcısında Aç", OpenWebAppInOwnBrowser);
            checkChannelsItem = new MenuItem("Kanalları Denetle", TriggerCheckChannels);
            pasteDownloadItem = new MenuItem("Panodan İndir", PasteAndDownload);

            shortcutsMenu = new MenuItem("Sekmelere Git");
            libraryShortcut = new MenuItem("Kütüphane", (s, e) => OpenUrl("/home"));
            queueShortcut = new MenuItem("İndirme Sırası", (s, e) => OpenUrl("/download"));
            downloadedShortcut = new MenuItem("İndirilenler", (s, e) => OpenUrl("/downlist"));
            channelsShortcut = new MenuItem("Kanallar", (s, e) => OpenUrl("/channels"));
            settingsShortcut = new MenuItem("Ayarlar", (s, e) => OpenUrl("/settings"));
            settingsItem = new MenuItem("Ayarlar", OpenSettingsPage);
            
            shortcutsMenu.MenuItems.Add(libraryShortcut);
            shortcutsMenu.MenuItems.Add(queueShortcut);
            shortcutsMenu.MenuItems.Add(downloadedShortcut);
            shortcutsMenu.MenuItems.Add(channelsShortcut);
            shortcutsMenu.MenuItems.Add(settingsShortcut);

            altSpeedItem = new MenuItem("Alternatif Hız Sınırı (Turtle)");
            altSpeedItem.Click += ToggleAlternativeSpeed;

            bootItem = new MenuItem("Sistem Başlangıcında Çalıştır");
            bootItem.Click += (s, e) => {
                bool current = GetStartOnBootSetting();
                SetStartOnBoot(!current);
                bootItem.Checked = !current;
            };

            discordRpcItem = new MenuItem("Discord Durumu");
            discordRpcItem.Click += ToggleDiscordRpc;

            restartItem = new MenuItem("Yeniden Başlat", RestartNode);
            showConsoleItem = new MenuItem("Konsol Çıktısını Göster", ShowConsoleWindow);
            exitItem = new MenuItem("Çıkış", ExitApp);

            // Sağ tık menüsünü oluştur
            ContextMenu contextMenu = new ContextMenu();
            contextMenu.MenuItems.Add(openAppBrowserItem);
            contextMenu.MenuItems.Add(settingsItem);
            contextMenu.MenuItems.Add(checkChannelsItem);
            contextMenu.MenuItems.Add(pasteDownloadItem);
            contextMenu.MenuItems.Add(altSpeedItem);
            contextMenu.MenuItems.Add(bootItem);
            contextMenu.MenuItems.Add(discordRpcItem);
            contextMenu.MenuItems.Add("-"); // Ayırıcı çizgi
            contextMenu.MenuItems.Add(restartItem);
            contextMenu.MenuItems.Add(showConsoleItem);
            contextMenu.MenuItems.Add("-"); // Ayırıcı çizgi
            contextMenu.MenuItems.Add(exitItem);

            // Başlangıç dil ayarını yükle
            string initialLang = GetLanguageSetting();
            ApplyLanguage(initialLang);

            // Menü her açıldığında ayarı okuyarak işareti güncelliyoruz
            contextMenu.Popup += (s, e) => {
                altSpeedItem.Checked = GetUseAlternativeSpeedSetting();
                bootItem.Checked = GetStartOnBootSetting();
                discordRpcItem.Checked = GetDiscordRpcSetting();
            };

            if (trayIcon != null)
            {
                trayIcon.ContextMenu = contextMenu;
                trayIcon.Visible = !IsSilentMode;
            }

            // Node Sunucusunu Başlat
            StartNode();

            // Kapatma eventlerini yakala
            Application.ApplicationExit += (s, e) => CleanUp();
            }
            catch (Exception ex)
            {
                try { File.WriteAllText(Path.Combine(Path.GetTempPath(), "haytool_constructor_crash.txt"), ex.ToString()); } catch {}
                throw;
            }
        }

        // Türkçe Açıklama: configwin.ini dosyasından port değerini dinamik olarak okuyarak localhost adresini döner.
        private string GetAppUrl(string relativePath = "")
        {
            int port = 4141;
            string iniPath = "configwin.ini";
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
                            if (string.Equals(key, "port", StringComparison.OrdinalIgnoreCase))
                            {
                                int parsedPort;
                                if (int.TryParse(val, out parsedPort))
                                {
                                    port = parsedPort;
                                    break;
                                }
                            }
                        }
                    }
                }
                catch {}
            }
            return "http://localhost:" + port + relativePath;
        }

        // Türkçe Açıklama: configwin.ini dosyasındaki discordRpcEnabled ayar değerini kontrol eder.
        private bool GetDiscordRpcSetting()
        {
            string iniPath = "configwin.ini";
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
                            if (string.Equals(key, "discordRpcEnabled", StringComparison.OrdinalIgnoreCase))
                            {
                                return string.Equals(val, "true", StringComparison.OrdinalIgnoreCase);
                            }
                        }
                    }
                }
                catch {}
            }
            return false;
        }

        // Türkçe Açıklama: Discord Rich Presence geçişini asenkron olarak tetikler.
        private void ToggleDiscordRpc(object sender, EventArgs e)
        {
            ThreadPool.QueueUserWorkItem(state => {
                try
                {
                    string url = GetAppUrl("/api/settings/toggle-discord-rpc");
                    HttpWebRequest request = (HttpWebRequest)WebRequest.Create(url);
                    request.Method = "POST";
                    request.ContentLength = 0;
                    using (WebResponse response = request.GetResponse())
                    {
                        // Başarılı geçiş
                    }
                }
                catch (Exception ex)
                {
                    if (logForm != null)
                    {
                        logForm.BeginInvoke(new Action(() => {
                            MessageBox.Show("Discord status toggle failed:\n" + ex.Message, "Error", MessageBoxButtons.OK, MessageBoxIcon.Error);
                        }));
                    }
                }
            });
        }

        // Türkçe Açıklama: configwin.ini dosyasındaki useAlternativeSpeed ayar değerini kontrol eder.
        private bool GetUseAlternativeSpeedSetting()
        {
            string iniPath = "configwin.ini";
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
                            if (string.Equals(key, "useAlternativeSpeed", StringComparison.OrdinalIgnoreCase))
                            {
                                return string.Equals(val, "true", StringComparison.OrdinalIgnoreCase);
                            }
                        }
                    }
                }
                catch {}
            }
            return false;
        }

        // Türkçe Açıklama: Windows Görev Çubuğu (Explorer) veya başlangıç durumunda tepsi simgesini yeniler.
        public void RefreshTrayIcon()
        {
            try
            {
                if (trayIcon != null && !IsSilentMode)
                {
                    trayIcon.Visible = false;
                    trayIcon.Visible = true;
                }
            }
            catch {}
        }

        // Türkçe Açıklama: Tüm kanalların RSS akışlarını kontrol eden API isteğini arka planda tetikler.
        private void TriggerCheckChannels(object sender, EventArgs e)
        {
            ThreadPool.QueueUserWorkItem(state => {
                try
                {
                    string url = GetAppUrl("/api/history/sync");
                    HttpWebRequest request = (HttpWebRequest)WebRequest.Create(url);
                    request.Method = "POST";
                    request.ContentType = "application/json";
                    byte[] body = Encoding.UTF8.GetBytes("{\"source\":\"tray\"}");
                    request.ContentLength = body.Length;
                    using (Stream stream = request.GetRequestStream())
                    {
                        stream.Write(body, 0, body.Length);
                    }
                    using (WebResponse response = request.GetResponse())
                    {
                        // Başarılı istek
                    }
                    AppendLog("[TRAY] Tüm kanallar için denetim tetiklendi (Kaynak: Tray).");
                }
                catch (Exception ex)
                {
                    AppendLog("[TRAY ERROR] Kanalları denetleme isteği başarısız: " + ex.Message);
                }
            });
        }

        // Türkçe Açıklama: Alternatif hız sınırı geçişini asenkron olarak tetikler.
        private void ToggleAlternativeSpeed(object sender, EventArgs e)
        {
            ThreadPool.QueueUserWorkItem(state => {
                try
                {
                    string url = GetAppUrl("/api/settings/toggle-alt-speed");
                    HttpWebRequest request = (HttpWebRequest)WebRequest.Create(url);
                    request.Method = "POST";
                    request.ContentLength = 0;
                    using (WebResponse response = request.GetResponse())
                    {
                        // Başarılı geçiş
                    }
                }
                catch (Exception ex)
                {
                    if (logForm != null)
                    {
                        logForm.BeginInvoke(new Action(() => {
                            MessageBox.Show("Alternatif hız sınırı geçişi başarısız oldu:\n" + ex.Message, "Hata", MessageBoxButtons.OK, MessageBoxIcon.Error);
                        }));
                    }
                }
            });
        }

        // Türkçe Açıklama: Belirli bir alt adresi tarayıcıda açar.
        private void OpenUrl(string path)
        {
            try
            {
                Process.Start(GetAppUrl(path));
            }
            catch (Exception ex)
            {
                MessageBox.Show("Tarayıcı açılamadı: " + ex.Message);
            }
        }

        // Türkçe Açıklama: Kendi gömülü/uygulama tarayıcısında (Edge App Modu) indirilenler sayfasını açar.
        private void OpenWebAppInOwnBrowser(object sender, EventArgs e)
        {
            OpenUrlInOwnBrowser("/downlist");
        }

        // Türkçe Açıklama: Belirli bir alt adresi Microsoft Edge uygulama modunda (--app) açar.
        private void OpenUrlInOwnBrowser(string path)
        {
            try
            {
                string url = GetAppUrl(path);
                ProcessStartInfo psi = new ProcessStartInfo("msedge.exe", "--app=" + url);
                psi.UseShellExecute = true;
                Process.Start(psi);
            }
            catch (Exception)
            {
                try
                {
                    // Edge bulunamazsa varsayılan tarayıcı ile açmayı dene
                    Process.Start(GetAppUrl(path));
                }
                catch (Exception ex)
                {
                    MessageBox.Show("Tarayıcı açılamadı: " + ex.Message);
                }
            }
        }

        // Türkçe Açıklama: Node.js sunucusunu arka planda, konsol penceresi olmadan (gizli) başlatır. Stdin komut gönderme desteği eklendi.
        private void StartNode()
        {
            try
            {
                if (nodeProcess != null && !nodeProcess.HasExited)
                {
                    return;
                }

                // Port kontrolü (EADDRINUSE önleme)
                int port = 4141;
                string iniPath = "configwin.ini";
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
                                if (string.Equals(key, "port", StringComparison.OrdinalIgnoreCase))
                                {
                                    int parsedPort;
                                    if (int.TryParse(val, out parsedPort))
                                    {
                                        port = parsedPort;
                                        break;
                                    }
                                }
                            }
                        }
                    }
                    catch {}
                }

                bool portOk = false;
                try
                {
                    System.Net.Sockets.TcpListener listener = new System.Net.Sockets.TcpListener(System.Net.IPAddress.Any, port);
                    listener.Start();
                    listener.Stop();
                    portOk = true;
                }
                catch (Exception ex)
                {
                    File.WriteAllText(Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "port_debug.txt"), ex.ToString());
                    string confirmTitle = "Port Çakışması";
                    string confirmMsg = "Port " + port + " başka bir uygulama veya süreç tarafından kullanılıyor!\n\nBu portu kullanan arka plan sürecini sonlandırıp HaYTooL'u yeniden başlatmayı denemek ister misiniz?";
                    string lang = GetLanguageSetting();

                    if (lang == "en")
                    {
                        confirmTitle = "Port Conflict";
                        confirmMsg = "Port " + port + " is already in use by another application or process!\n\nDo you want to terminate the process using this port and retry starting HaYTooL?";
                    }
                    else if (lang == "es")
                    {
                        confirmTitle = "Conflicto de Puerto";
                        confirmMsg = "¡El puerto " + port + " ya está siendo utilizado por otra aplicación!\n\n¿Desea finalizar el proceso que utiliza este puerto y reiniciar HaYTooL?";
                    }
                    else if (lang == "de")
                    {
                        confirmTitle = "Port-Konflikt";
                        confirmMsg = "Port " + port + " wird bereits von einer anderen Anwendung verwendet!\n\nMöchten Sie den Prozess, der diesen Port verwendet, beenden und HaYTooL neu starten?";
                    }
                    else if (lang == "pt")
                    {
                        confirmTitle = "Conflito de Porta";
                        confirmMsg = "A porta " + port + " já está em uso por outro aplicativo!\n\nDeseja encerrar o processo que usa esta porta e reiniciar o HaYTooL?";
                    }
                    else if (lang == "ar")
                    {
                        confirmTitle = "تعارض المنفذ";
                        confirmMsg = "المنفذ " + port + " مستخدم بالفعل بواسطة تطبيق آخر!\n\nهل تريد إنهاء العملية التي تستخدم هذا المنفذ وإعادة تشغيل HaYTooL؟";
                    }
                    else if (lang == "ru")
                    {
                        confirmTitle = "Конфликт портов";
                        confirmMsg = "Порт " + port + " уже используется другим приложением!\n\nХотите завершить процесс, использующий этот порт, и перезапустить HaYTooL?";
                    }

                    DialogResult result = MessageBox.Show(confirmMsg, confirmTitle, MessageBoxButtons.YesNo, MessageBoxIcon.Warning);
                    if (result == DialogResult.Yes)
                    {
                        if (KillProcessOnPort(port))
                        {
                            portOk = true;
                        }
                        else
                        {
                            string errTitle = "Hata";
                            string errMsg = "Port " + port + " serbest bırakılamadı. Lütfen o süreci el ile kapatın.";
                            if (lang == "en") { errTitle = "Error"; errMsg = "Port " + port + " could not be freed. Please close the process manually."; }
                            else if (lang == "es") { errTitle = "Error"; errMsg = "El puerto " + port + " no se pudo liberar. Cierre el proceso manualmente."; }
                            else if (lang == "de") { errTitle = "Fehler"; errMsg = "Port " + port + " konnte nicht freigegeben werden. Bitte schließen Sie den Prozess manuell."; }
                            else if (lang == "pt") { errTitle = "Erro"; errMsg = "A porta " + port + " não pôde ser liberada. Feche o processo manualmente."; }
                            else if (lang == "ar") { errTitle = "خطأ"; errMsg = "تعذر تحرير المنفذ " + port + ". يرجى إغلاق العملية يدويًا."; }
                            else if (lang == "ru") { errTitle = "Ошибка"; errMsg = "Не удалось освободить порт " + port + ". Пожалуйста, закройте процесс вручную."; }

                            MessageBox.Show(errMsg, errTitle, MessageBoxButtons.OK, MessageBoxIcon.Error);
                        }
                    }
                }

                if (!portOk)
                {
                    File.WriteAllText(Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "port_debug.txt"), "portOk is false. Exiting.");
                    ShowPortInUseWarning(port);
                    ExitApp(null, null);
                    return;
                }

                // Bağımlılık kontrolü (Kaldırıldı - Artık proje git'ten node_modules ile iniyor)
                string nodeModulesPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "node_modules");
                if (!Directory.Exists(nodeModulesPath))
                {
                    MessageBox.Show("Node modülleri bulunamadı. Lütfen eksik dosya indirmediğinizden emin olun.", "Hata", MessageBoxButtons.OK, MessageBoxIcon.Error);
                    ExitApp(null, null);
                    return;
                }

                string backendPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "bin", "HaYTool-Backend.exe");
                if (!File.Exists(backendPath))
                {
                    MessageBox.Show("Taşınabilir backend motoru bulunamadı: bin\\HaYTool-Backend.exe", "Hata", MessageBoxButtons.OK, MessageBoxIcon.Error);
                    ExitApp(null, null);
                    return;
                }

                ProcessStartInfo psi = new ProcessStartInfo(backendPath, "server.js");
                psi.CreateNoWindow = true;
                psi.UseShellExecute = false;
                psi.WindowStyle = ProcessWindowStyle.Hidden;
                psi.RedirectStandardOutput = !IsSilentMode;
                psi.RedirectStandardError = !IsSilentMode;
                psi.RedirectStandardInput = !IsSilentMode; // Stdin yönlendirmesi aktif
                if (!IsSilentMode)
                {
                    psi.StandardOutputEncoding = Encoding.UTF8;
                    psi.StandardErrorEncoding = Encoding.UTF8;
                }
                psi.WorkingDirectory = AppDomain.CurrentDomain.BaseDirectory;

                nodeProcess = new Process();
                nodeProcess.StartInfo = psi;
                
                if (!IsSilentMode)
                {
                    nodeProcess.OutputDataReceived += (s, e) => {
                        if (e.Data != null) 
                        {
                            if (e.Data.StartsWith("[TRAY_CMD] lang="))
                            {
                                string newLang = e.Data.Substring("[TRAY_CMD] lang=".Length).Trim();
                                if (syncForm != null && syncForm.IsHandleCreated)
                                {
                                    if (syncForm.InvokeRequired)
                                    {
                                        try
                                        {
                                            syncForm.BeginInvoke(new Action(() => {
                                                ApplyLanguage(newLang);
                                            }));
                                        }
                                        catch
                                        {
                                            ApplyLanguage(newLang);
                                        }
                                    }
                                    else
                                    {
                                        ApplyLanguage(newLang);
                                    }
                                }
                                else
                                {
                                    ApplyLanguage(newLang);
                                }
                            }
                            else if (e.Data.StartsWith("[TRAY_CMD] play_sound="))
                            {
                                string soundType = e.Data.Substring("[TRAY_CMD] play_sound=".Length).Trim();
                                System.Threading.Thread soundThread = new System.Threading.Thread(() => {
                                    try
                                    {
                                        if (soundType == "success")
                                        {
                                            System.Console.Beep(1046, 120);
                                        }
                                        else if (soundType == "error")
                                        {
                                            System.Console.Beep(330, 200);
                                        }
                                    }
                                    catch {}
                                });
                                soundThread.IsBackground = true;
                                soundThread.Start();
                            }
                            else
                            {
                                AppendLog(e.Data);
                            }
                        }
                    };

                    nodeProcess.ErrorDataReceived += (s, e) => {
                        if (e.Data != null) AppendLog("[HATA] " + e.Data);
                    };
                }

                nodeProcess.Start();

                // Job Object'e süreci dahil et
                if (jobHandle != IntPtr.Zero && nodeProcess != null && !nodeProcess.HasExited)
                {
                    try
                    {
                        AssignProcessToJobObject(jobHandle, nodeProcess.Handle);
                    }
                    catch (Exception ex)
                    {
                        AppendLog("[TRAY ERROR] Süreç Job Object'e atanamadı: " + ex.Message);
                    }
                }

                if (!IsSilentMode)
                {
                    nodeProcess.BeginOutputReadLine();
                    nodeProcess.BeginErrorReadLine();
                    AppendLog("[TRAY] Node.js sunucu süreci başlatıldı.");
                }
            }
            catch (Exception ex)
            {
                try { File.WriteAllText(Path.Combine(Path.GetTempPath(), "haytool_backend_start_crash.txt"), ex.ToString()); } catch {}
                MessageBox.Show("Node.js başlatılamadı. Lütfen Node.js'in yüklü ve PATH değişkenine ekli olduğundan emin olun.\nHata: " + ex.Message, "Hata", MessageBoxButtons.OK, MessageBoxIcon.Error);
                ExitApp(null, null);
            }
        }

        // Türkçe Açıklama: Sunucuya stdin üzerinden komut gönderir.
        private void SendCommandToNode(string command)
        {
            try
            {
                if (nodeProcess != null && !nodeProcess.HasExited)
                {
                    nodeProcess.StandardInput.WriteLine(command);
                    AppendLog("[TRAY INPUT] > " + command);
                }
            }
            catch (Exception ex)
            {
                AppendLog("[TRAY ERROR] Komut gönderilemedi: " + ex.Message);
            }
        }

        /// <summary>
        /// RichTextBox metin kutusuna, log satırındaki etiketlere göre renklendirilmiş metin ekler.
        /// </summary>
        /// <param name="box">Hedef RichTextBox nesnesi</param>
        /// <param name="text">Eklenecek satır metni</param>
        private void AppendColoredText(RichTextBox box, string text)
        {
            if (box == null || box.IsDisposed) return;

            // Varsayılan açık gri
            Color color = Color.FromArgb(220, 220, 220); 

            if (text.Contains("[RSS]"))
            {
                if (text.Contains("Manuel tetikleme"))
                {
                    color = Color.FromArgb(255, 140, 0); // Koyu Turuncu (Orange/Gold)
                }
                else if (text.Contains("Sunucu başlangıcı"))
                {
                    color = Color.FromArgb(186, 85, 211); // Açık Mor / Eflatun (Medium Orchid/Violet)
                }
                else
                {
                    color = Color.FromArgb(255, 0, 255); // Pembe (Magenta)
                }
            }
            else if (text.Contains("[RSS Fallback]"))
            {
                color = Color.FromArgb(255, 128, 255); // Açık Pembe (Light Magenta)
            }
            else if (text.Contains("[DOWNLOAD]") || text.Contains("[İNDİRME]") || text.Contains("İndirme başlatılıyor"))
            {
                color = Color.FromArgb(0, 225, 255); // Canlı Açık Mavi / Cyan
            }
            else if (text.Contains("[KOMUT]") || text.Contains("Komut:"))
            {
                color = Color.FromArgb(245, 200, 50); // Parlak Altın Sarısı (Gold/Yellow)
            }
            else if (text.Contains("[yt-dlp Uyarı]") || text.Contains("uyarı satırı") || text.Contains("WARNING") || text.Contains("Too Many Requests"))
            {
                color = Color.FromArgb(255, 160, 50); // Tatlı Turuncu (Orange/Coral)
            }
            else if (text.Contains("[yt-dlp]"))
            {
                color = Color.FromArgb(186, 85, 211); // Açık Mor / Eflatun (Medium Orchid)
            }
            else if (text.Contains("[DATABASE]"))
            {
                color = Color.FromArgb(255, 255, 0); // Sarı (Yellow)
            }
            else if (text.Contains("[IPTV]"))
            {
                color = Color.FromArgb(100, 149, 237); // Açık Mavi (Cornflower Blue)
            }
            else if (text.Contains("[SYSTEM]") || text.Contains("[Sistem]"))
            {
                color = Color.FromArgb(50, 205, 50); // Yeşil (Lime Green)
            }
            else if (text.Contains("[API]"))
            {
                color = Color.FromArgb(30, 144, 255); // Mavi (Dodger Blue)
            }
            else if (text.Contains("[HATA]") || text.Contains("[ERROR]") || text.Contains("[Hata]") || text.Contains("[Error]"))
            {
                color = Color.FromArgb(255, 60, 60); // Kırmızı (Red)
            }

            box.SelectionStart = box.TextLength;
            box.SelectionLength = 0;
            box.SelectionColor = color;
            box.AppendText(text);
            box.SelectionColor = box.ForeColor; // Rengi varsayılana sıfırla
        }

        // Türkçe Açıklama: Gelen konsol çıktılarını bellek tamponuna ekler ve arayüze tarihsiz şekilde yansıtır.
        private void AppendLog(string text)
        {
            if (text == null) return;

            // ANSI kodlarını temizle
            text = System.Text.RegularExpressions.Regex.Replace(text, @"\x1b\[[0-9;]*m", "");
            
            // Satır başındaki [HH:mm:ss] zaman damgasını temizle (Örn: [01:08:03] -> "")
            text = System.Text.RegularExpressions.Regex.Replace(text, @"^\[\d{2}:\d{2}:\d{2}\]\s*", "");

            string formattedText = text + "\r\n";
            
            // Buffer'a ve Form'a yaz
            lock (bufferLock)
            {
                consoleBuffer.Append(formattedText);
                // 500 satırdan fazlasını temizle
                if (consoleBuffer.Length > 100000)
                {
                    consoleBuffer.Remove(0, 50000);
                }
            }

            // Log penceresi açıksa anlık güncelle
            if (logForm != null && !logForm.IsDisposed && logTextBox != null && !logTextBox.IsDisposed)
            {
                try
                {
                    logTextBox.BeginInvoke(new Action(() => {
                        AppendColoredText(logTextBox, formattedText);
                        logTextBox.SelectionStart = logTextBox.TextLength;
                        logTextBox.ScrollToCaret();
                    }));
                }
                catch {}
            }
        }

        private string GetDoubleClickActionSetting()
        {
            string iniPath = "configwin.ini";
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
                            if (string.Equals(key, "doubleClickAction", StringComparison.OrdinalIgnoreCase))
                            {
                                return val;
                            }
                        }
                    }
                }
                catch {}
            }
            return "system";
        }

        // Türkçe Açıklama: Varsayılan tarayıcıda veya gömülü Edge App modunda uygulamanın indirilenler sayfasını açar.
        private void OpenWebPage(object sender, EventArgs e)
        {
            string action = GetDoubleClickActionSetting();
            if (string.Equals(action, "player", StringComparison.OrdinalIgnoreCase))
            {
                OpenInPlayer("/downlist");
            }
            else if (string.Equals(action, "embedded", StringComparison.OrdinalIgnoreCase))
            {
                OpenUrlInOwnBrowser("/downlist");
            }
            else
            {
                OpenUrl("/downlist");
            }
        }

        // Türkçe Açıklama: Varsayılan tarayıcıda veya gömülü Edge App modunda uygulamanın ayarlar sayfasını açar.
        private void OpenSettingsPage(object sender, EventArgs e)
        {
            string action = GetDoubleClickActionSetting();
            if (string.Equals(action, "player", StringComparison.OrdinalIgnoreCase))
            {
                OpenInPlayer("/settings");
            }
            else if (string.Equals(action, "embedded", StringComparison.OrdinalIgnoreCase))
            {
                OpenUrlInOwnBrowser("/settings");
            }
            else
            {
                OpenUrl("/settings");
            }
        }

        // Türkçe Açıklama: HaYTooL-Player Beta.exe uygulamasını belirtilen alt sayfa argümanıyla başlatır.
        private void OpenInPlayer(string path)
        {
            try
            {
                string playerPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "HaYTooL-Player Beta.exe");
                if (File.Exists(playerPath))
                {
                    ProcessStartInfo psi = new ProcessStartInfo(playerPath, path);
                    psi.UseShellExecute = true;
                    Process.Start(psi);
                }
                else
                {
                    MessageBox.Show("HaYTooL-Player Beta.exe bulunamadı: " + playerPath, "Hata", MessageBoxButtons.OK, MessageBoxIcon.Error);
                }
            }
            catch (Exception ex)
            {
                MessageBox.Show("Oynatıcı başlatılamadı: " + ex.Message, "Hata", MessageBoxButtons.OK, MessageBoxIcon.Error);
            }
        }

        // Türkçe Açıklama: Panodaki YouTube bağlantısını okur, Node.js sunucusuna indirme komutunu gönderir ve İndirme Sırası sekmesini açar.
        private void PasteAndDownload(object sender, EventArgs e)
        {
            if (Clipboard.ContainsText())
            {
                string text = Clipboard.GetText().Trim();
                if (text.Contains("youtube.com/") || text.Contains("youtu.be/"))
                {
                    SendCommandToNode("pd " + text);
                    OpenUrl("/download");
                }
                else
                {
                    MessageBox.Show("Panodaki metin geçerli bir YouTube bağlantısı değil:\n" + text, "Geçersiz Bağlantı", MessageBoxButtons.OK, MessageBoxIcon.Warning);
                }
            }
            else
            {
                MessageBox.Show("Pano boş veya metin içermiyor.", "Pano Boş", MessageBoxButtons.OK, MessageBoxIcon.Information);
            }
        }

        // Türkçe Açıklama: Çalışmakta olan Node.js sunucusunu kapatır ve temiz bir şekilde yeniden başlatır.
        private void RestartNode(object sender, EventArgs e)
        {
            AppendLog("[TRAY] Sunucu yeniden başlatılıyor...");
            KillNode();
            Thread.Sleep(1000);
            StartNode();
            AppendLog("[TRAY] Sunucu yeniden başlatıldı.");
        }

        // Türkçe Açıklama: Node.js konsol çıktısını gerçek zamanlı gösteren ve komut gönderme paneli içeren log penceresini açar.
        private void ShowConsoleWindow(object sender, EventArgs e)
        {
            if (logForm != null && !logForm.IsDisposed)
            {
                logForm.Focus();
                return;
            }

            logForm = new Form();
            logForm.Text = "HaYTool - Terminal Çıktısı";
            logForm.Size = new Size(950, 600);
            logForm.StartPosition = FormStartPosition.CenterScreen;
            
            // icon.ico dosyasını forma da ekle
            if (File.Exists("icon.ico"))
            {
                try
                {
                    logForm.Icon = new Icon("icon.ico");
                }
                catch {}
            }

            // Ana düzen (dikey panel yerleşimi)
            TableLayoutPanel mainLayout = new TableLayoutPanel();
            mainLayout.Dock = DockStyle.Fill;
            mainLayout.RowCount = 2;
            mainLayout.RowStyles.Add(new RowStyle(SizeType.Percent, 100F));
            mainLayout.RowStyles.Add(new RowStyle(SizeType.Absolute, 55F));

            logTextBox = new RichTextBox();
            logTextBox.ReadOnly = true;
            logTextBox.Dock = DockStyle.Fill;
            logTextBox.BackColor = Color.FromArgb(15, 14, 32);
            logTextBox.ForeColor = Color.FromArgb(220, 220, 220);
            logTextBox.Font = new Font("Consolas", 12f);

            lock (bufferLock)
            {
                string[] lines = consoleBuffer.ToString().Split(new[] { "\r\n", "\r", "\n" }, StringSplitOptions.None);
                foreach (var line in lines)
                {
                    if (string.IsNullOrEmpty(line)) continue;
                    AppendColoredText(logTextBox, line + "\r\n");
                }
            }

            // En alta kaydır
            logTextBox.SelectionStart = logTextBox.TextLength;
            logTextBox.ScrollToCaret();

            mainLayout.Controls.Add(logTextBox, 0, 0);

            // Alt komut giriş paneli
            Panel commandPanel = new Panel();
            commandPanel.Dock = DockStyle.Fill;
            commandPanel.BackColor = Color.FromArgb(25, 24, 45);
            commandPanel.Padding = new Padding(10);

            Label cmdLabel = new Label();
            cmdLabel.Text = "Komut:";
            cmdLabel.ForeColor = Color.White;
            cmdLabel.Font = new Font("Segoe UI", 10f, FontStyle.Bold);
            cmdLabel.AutoSize = true;
            cmdLabel.Location = new Point(10, 17);

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
                "pd",
                "clear"
            });

            Button sendButton = new Button();
            sendButton.Text = "Gönder";
            sendButton.Font = new Font("Segoe UI", 9f, FontStyle.Bold);
            sendButton.BackColor = Color.FromArgb(40, 180, 99);
            sendButton.ForeColor = Color.White;
            sendButton.FlatStyle = FlatStyle.Flat;
            sendButton.FlatAppearance.BorderSize = 0;
            sendButton.Location = new Point(745, 13);
            sendButton.Size = new Size(80, 28);
            sendButton.Anchor = AnchorStyles.Right | AnchorStyles.Top;

            Button openLogButton = new Button();
            openLogButton.Text = "Aç";
            openLogButton.Font = new Font("Segoe UI", 9f, FontStyle.Bold);
            openLogButton.BackColor = Color.FromArgb(41, 128, 185);
            openLogButton.ForeColor = Color.White;
            openLogButton.FlatStyle = FlatStyle.Flat;
            openLogButton.FlatAppearance.BorderSize = 0;
            openLogButton.Location = new Point(835, 13);
            openLogButton.Size = new Size(80, 28);
            openLogButton.Anchor = AnchorStyles.Right | AnchorStyles.Top;

            openLogButton.Click += (s, ev) => {
                string logsDir = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "logs");
                if (Directory.Exists(logsDir)) {
                    Process.Start("explorer.exe", logsDir);
                } else {
                    MessageBox.Show("Log klasörü bulunamadı.", "Bilgi", MessageBoxButtons.OK, MessageBoxIcon.Information);
                }
            };

            // Yeniden boyutlandırma olayı
            commandPanel.Resize += (s, ev) => {
                commandComboBox.Width = commandPanel.Width - 250;
                sendButton.Left = commandPanel.Width - 170;
                openLogButton.Left = commandPanel.Width - 85;
            };

            // Enter tuşu ile gönderim
            commandComboBox.KeyDown += (s, ev) => {
                if (ev.KeyCode == Keys.Enter)
                {
                    ev.SuppressKeyPress = true; // Bip sesini kapat
                    string cmd = commandComboBox.Text.Trim();
                    if (!string.IsNullOrEmpty(cmd))
                    {
                        if (cmd.ToLower() == "clear") {
                            lock (bufferLock) {
                                consoleBuffer.Length = 0;
                            }
                            logTextBox.Clear();
                        } else {
                            SendCommandToNode(cmd);
                        }
                        commandComboBox.Text = "";
                    }
                }
            };

            sendButton.Click += (s, ev) => {
                string cmd = commandComboBox.Text.Trim();
                if (!string.IsNullOrEmpty(cmd))
                {
                    if (cmd.ToLower() == "clear") {
                        lock (bufferLock) {
                            consoleBuffer.Length = 0;
                        }
                        logTextBox.Clear();
                    } else {
                        SendCommandToNode(cmd);
                    }
                    commandComboBox.Text = "";
                    commandComboBox.Focus();
                }
            };

            commandPanel.Controls.Add(cmdLabel);
            commandPanel.Controls.Add(commandComboBox);
            commandPanel.Controls.Add(sendButton);
            commandPanel.Controls.Add(openLogButton);

            mainLayout.Controls.Add(commandPanel, 0, 1);

            logForm.Controls.Add(mainLayout);
            logForm.Show();
        }

        // Türkçe Açıklama: Arka planda çalışan Node.js alt sürecini sonlandırır.
        private void KillNode()
        {
            try
            {
                if (nodeProcess != null && !nodeProcess.HasExited)
                {
                    nodeProcess.Kill();
                }
            }
            catch {}
        }

        // Türkçe Açıklama: Sistem tepsisi simgesini ve alt süreçleri temizler.
        private void CleanUp()
        {
            KillNode();
            if (jobHandle != IntPtr.Zero)
            {
                CloseHandle(jobHandle);
                jobHandle = IntPtr.Zero;
            }
            if (trayIcon != null)
            {
                trayIcon.Visible = false;
                trayIcon.Dispose();
            }
            if (syncForm != null)
            {
                syncForm.Dispose();
            }
        }

        // Türkçe Açıklama: Uygulamadan tamamen çıkış yapar.
        private void ExitApp(object sender, EventArgs e)
        {
            CleanUp();
            Environment.Exit(0);
        }

        // Türkçe Açıklama: Sistem başlangıcında çalıştırma Registry ayarını kaydeder veya siler.
        private void SetStartOnBoot(bool start)
        {
            try
            {
                RegistryKey rk = Registry.CurrentUser.OpenSubKey(@"SOFTWARE\Microsoft\Windows\CurrentVersion\Run", true);
                if (start)
                {
                    rk.SetValue("HaYTooL", "\"" + Application.ExecutablePath + "\"");
                }
                else
                {
                    rk.DeleteValue("HaYTooL", false);
                }
            }
            catch (Exception ex)
            {
                MessageBox.Show("Başlangıç ayarı güncellenemedi: " + ex.Message, "Hata", MessageBoxButtons.OK, MessageBoxIcon.Error);
            }
        }

        // Türkçe Açıklama: Uygulamanın sistem başlangıcında çalıştırılmak üzere kayıtlı olup olmadığını denetler.
        private bool GetStartOnBootSetting()
        {
            try
            {
                RegistryKey rk = Registry.CurrentUser.OpenSubKey(@"SOFTWARE\Microsoft\Windows\CurrentVersion\Run", false);
                return rk.GetValue("HaYTooL") != null;
            }
            catch
            {
                return false;
            }
        }

        // Türkçe Açıklama: Arayüz dil ayarlarına göre C# Tray uygulamasındaki menü elemanlarını dinamik olarak yerelleştirir.
        private void ApplyLanguage(string lang)
        {
            if (string.IsNullOrEmpty(lang)) lang = "tr";
            lang = lang.ToLower();

            if (lang == "en")
            {
                openAppBrowserItem.Text = "Open in App Window";
                openUiItem.Text = "Open Interface";
                checkChannelsItem.Text = "Check Channels";
                pasteDownloadItem.Text = "Paste & Download";
                shortcutsMenu.Text = "Go to Tabs";
                libraryShortcut.Text = "Library";
                queueShortcut.Text = "Download Queue";
                downloadedShortcut.Text = "Downloads";
                channelsShortcut.Text = "Channels";
                settingsShortcut.Text = "Settings";
                settingsItem.Text = "Settings";
                altSpeedItem.Text = "Alternative Speed Limit (Turtle)";
                bootItem.Text = "Run on System Startup";
                discordRpcItem.Text = "Discord Status";
                restartItem.Text = "Restart Server";
                showConsoleItem.Text = "Show Console Output";
                exitItem.Text = "Exit";
            }
            else if (lang == "es")
            {
                openAppBrowserItem.Text = "Abrir en ventana de app";
                openUiItem.Text = "Abrir Interfaz";
                checkChannelsItem.Text = "Comprobar canales";
                pasteDownloadItem.Text = "Pegar y Descargar";
                shortcutsMenu.Text = "Ir a Pestañas";
                libraryShortcut.Text = "Biblioteca";
                queueShortcut.Text = "Cola de Descargas";
                downloadedShortcut.Text = "Descargas";
                channelsShortcut.Text = "Canales";
                settingsShortcut.Text = "Configuración";
                settingsItem.Text = "Configuración";
                altSpeedItem.Text = "Límite de Velocidad Alternativo (Turtle)";
                bootItem.Text = "Ejecutar al Inicio del Sistema";
                discordRpcItem.Text = "Estado de Discord";
                restartItem.Text = "Reiniciar Servidor";
                showConsoleItem.Text = "Mostrar Salida de Consola";
                exitItem.Text = "Salir";
            }
            else if (lang == "de")
            {
                openAppBrowserItem.Text = "Im App-Fenster öffnen";
                openUiItem.Text = "Benutzeroberfläche öffnen";
                checkChannelsItem.Text = "Kanäle prüfen";
                pasteDownloadItem.Text = "Einfügen & Herunterladen";
                shortcutsMenu.Text = "Gehe zu Tabs";
                libraryShortcut.Text = "Bibliothek";
                queueShortcut.Text = "Download-Warteschlange";
                downloadedShortcut.Text = "Downloads";
                channelsShortcut.Text = "Kanäle";
                settingsShortcut.Text = "Einstellungen";
                settingsItem.Text = "Einstellungen";
                altSpeedItem.Text = "Alternative Geschwindigkeitsbegrenzung (Turtle)";
                bootItem.Text = "Beim Systemstart ausführen";
                discordRpcItem.Text = "Discord-Status";
                restartItem.Text = "Server neu starten";
                showConsoleItem.Text = "Konsolenausgabe anzeigen";
                exitItem.Text = "Beenden";
            }
            else if (lang == "pt")
            {
                openAppBrowserItem.Text = "Abrir na janela do app";
                openUiItem.Text = "Abrir Interface";
                checkChannelsItem.Text = "Verificar canais";
                pasteDownloadItem.Text = "Colar & Baixar";
                shortcutsMenu.Text = "Ir para Abas";
                libraryShortcut.Text = "Biblioteca";
                queueShortcut.Text = "Fila de Downloads";
                downloadedShortcut.Text = "Downloads";
                channelsShortcut.Text = "Canais";
                settingsShortcut.Text = "Configurações";
                settingsItem.Text = "Configurações";
                altSpeedItem.Text = "Limite de Velocidade Alternativo (Turtle)";
                bootItem.Text = "Executar na Inicialização do Sistema";
                discordRpcItem.Text = "Estado do Discord";
                restartItem.Text = "Reiniciar Servidor";
                showConsoleItem.Text = "Mostrar Saída do Console";
                exitItem.Text = "Sair";
            }
            else if (lang == "ar")
            {
                openAppBrowserItem.Text = "الفتح في نافذة التطبيق";
                openUiItem.Text = "فتح الواجهة";
                checkChannelsItem.Text = "التحقق من القنوات";
                pasteDownloadItem.Text = "اللصق والتنزيل";
                shortcutsMenu.Text = "الانتقال إلى التبويبات";
                libraryShortcut.Text = "المكتبة";
                queueShortcut.Text = "قائمة الانتظار";
                downloadedShortcut.Text = "التنزيلات";
                channelsShortcut.Text = "القنوات";
                settingsShortcut.Text = "الإعدادات";
                settingsItem.Text = "الإعدادات";
                altSpeedItem.Text = "حد السرعة البديل (السلحفاة)";
                bootItem.Text = "التشغيل عند بدء تشغيل النظام";
                discordRpcItem.Text = "حالة ديسكورد";
                restartItem.Text = "إعادة تشغيل الخادم";
                showConsoleItem.Text = "عرض مخرجات وحدة التحكم";
                exitItem.Text = "خروج";
            }
            else if (lang == "ru")
            {
                openAppBrowserItem.Text = "Открыть в окне приложения";
                openUiItem.Text = "Открыть интерфейс";
                checkChannelsItem.Text = "Проверить каналы";
                pasteDownloadItem.Text = "Вставить и скачать";
                shortcutsMenu.Text = "Перейти к вкладкам";
                libraryShortcut.Text = "Библиотека";
                queueShortcut.Text = "Очередь загрузки";
                downloadedShortcut.Text = "Загрузки";
                channelsShortcut.Text = "Каналы";
                settingsShortcut.Text = "Настройки";
                settingsItem.Text = "Настройки";
                altSpeedItem.Text = "Альтернативный лимит скорости (Черепаха)";
                bootItem.Text = "Запускать при старте системы";
                discordRpcItem.Text = "Статус Discord";
                restartItem.Text = "Перезапустить сервер";
                showConsoleItem.Text = "Показать вывод консоли";
                exitItem.Text = "Выход";
            }
            else // Varsayılan Türkçe (tr)
            {
                openAppBrowserItem.Text = "Kendi Tarayıcısında Aç";
                openUiItem.Text = "Arayüzü Aç";
                checkChannelsItem.Text = "Kanalları Denetle";
                pasteDownloadItem.Text = "Panodan İndir";
                shortcutsMenu.Text = "Sekmelere Git";
                libraryShortcut.Text = "Kütüphane";
                queueShortcut.Text = "İndirme Sırası";
                downloadedShortcut.Text = "İndirilenler";
                channelsShortcut.Text = "Kanallar";
                settingsShortcut.Text = "Ayarlar";
                settingsItem.Text = "Ayarlar";
                altSpeedItem.Text = "Alternatif Hız Sınırı (Turtle)";
                bootItem.Text = "Sistem Başlangıcında Çalıştır";
                discordRpcItem.Text = "Discord Durumu";
                restartItem.Text = "Yeniden Başlat";
                showConsoleItem.Text = "Konsol Çıktısını Göster";
                exitItem.Text = "Çıkış";
            }

            if (trayIcon != null)
            {
                trayIcon.Text = "HaYTooL YouTube Downloader";
            }
        }

        private bool portWarningShown = false;
        // Türkçe Açıklama: Port doluluğunda (EADDRINUSE) seçili dile göre MessageBox uyarısı gösterir.
        private void ShowPortInUseWarning(int port)
        {
            if (portWarningShown) return;
            portWarningShown = true;

            string lang = GetLanguageSetting();
            string title = "Hata";
            string msg = "Port " + port + " başka bir uygulama veya süreç tarafından kullanılıyor!\nLütfen arka plandaki diğer sunucu süreçlerini kapatın veya configwin.ini dosyasından 'port' ayarını değiştirin.";

            if (lang == "en")
            {
                title = "Error";
                msg = "Port " + port + " is already in use by another application or process!\nPlease close other background server processes or change the 'port' setting in configwin.ini.";
            }
            else if (lang == "es")
            {
                title = "Error";
                msg = "¡El puerto " + port + " ya está siendo utilizado por otra aplicación o proceso!\nCierre otros procesos del servidor en segundo plano o cambie el puerto en configwin.ini.";
            }
            else if (lang == "de")
            {
                title = "Fehler";
                msg = "Port " + port + " wird bereits von einer anderen Anwendung oder einem anderen Prozess verwendet!\nBitte schließen Sie andere Hintergrundserver-Prozesse oder ändern Sie den Port in configwin.ini.";
            }
            else if (lang == "pt")
            {
                title = "Erro";
                msg = "A porta " + port + " já está em uso por outro aplicativo ou processo!\nFeche outros processos do servidor em segundo plano ou altere a porta no configwin.ini.";
            }
            else if (lang == "ar")
            {
                title = "خطأ";
                msg = "المنفذ " + port + " مستخدم بالفعل بواسطة تطبيق أو عملية أخرى!\nيرجى إغلاق عمليات الخادم الخلفية الأخرى أو تغيير المنفذ في configwin.ini.";
            }
            else if (lang == "ru")
            {
                title = "Ошибка";
                msg = "Порт " + port + " уже используется другим приложением или процессом!\nПожалуйста, закройте другие фоновые процессы сервера или измените настройку 'port' в configwin.ini.";
            }

            MessageBox.Show(msg, title, MessageBoxButtons.OK, MessageBoxIcon.Error);
        }

        // Türkçe Açıklama: configwin.ini dosyasından güncel arayüz dil seçimini okur.
        private string GetLanguageSetting()
        {
            string iniPath = "configwin.ini";
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
                            if (string.Equals(key, "lang", StringComparison.OrdinalIgnoreCase))
                            {
                                return val;
                            }
                        }
                    }
                }
                catch {}
            }
            return "tr";
        }

        // Türkçe Açıklama: Belirtilen portu kullanan TCP sürecini netstat ve taskkill aracılığıyla sonlandırır.
        private bool KillProcessOnPort(int port)
        {
            try
            {
                ProcessStartInfo psi = new ProcessStartInfo("cmd.exe");
                psi.Arguments = "/c \"for /f \\\"tokens=5\\\" %a in ('netstat -aon ^| findstr /r /c:\":" + port + " *LISTENING\"') do taskkill /F /PID %a\"";
                psi.CreateNoWindow = true;
                psi.UseShellExecute = false;
                psi.RedirectStandardOutput = true;
                psi.RedirectStandardError = true;
                
                using (Process p = Process.Start(psi))
                {
                    p.WaitForExit(3000);
                    
                    // Portun gerçekten boşalıp boşalmadığını doğrula
                    try
                    {
                        System.Net.Sockets.TcpListener listener = new System.Net.Sockets.TcpListener(System.Net.IPAddress.Any, port);
                        listener.Start();
                        listener.Stop();
                        return true;
                    }
                    catch (Exception)
                    {
                        return false;
                    }
                }
            }
            catch (Exception)
            {
                return false;
            }
        }
    }
}
