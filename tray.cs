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
        private TextBox logTextBox;
        private object bufferLock = new object();
        private Form syncForm;

        // Dil senkronizasyonu için sınıf düzeyinde menü öğeleri
        private MenuItem openUiItem;
        private MenuItem pasteDownloadItem;
        private MenuItem shortcutsMenu;
        private MenuItem libraryShortcut;
        private MenuItem queueShortcut;
        private MenuItem downloadedShortcut;
        private MenuItem channelsShortcut;
        private MenuItem settingsShortcut;
        private MenuItem altSpeedItem;
        private MenuItem bootItem;
        private MenuItem restartItem;
        private MenuItem showConsoleItem;
        private MenuItem openLogFolderItem;
        private MenuItem exitItem;

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

        [STAThread]
        public static void Main(string[] args)
        {
            if (args.Length > 0)
            {
                // CLI Modu - Ebeveyn konsoluna bağlan ve Node sunucusuna argümanları aktar
                AttachConsole(ATTACH_PARENT_PROCESS);
                RunCli(args);
                return;
            }

            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            Application.Run(new Program());
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
            // Güvenli asenkron UI çağrıları için senkronizasyon formunu hazırla
            syncForm = new Form();
            IntPtr forcedHandle = syncForm.Handle; // Handle oluşturulmasını zorunlu kıl

            // Logs dizinini oluştur
            if (!Directory.Exists("logs"))
            {
                Directory.CreateDirectory("logs");
            }

            // Tray İkonunu Hazırla
            trayIcon = new NotifyIcon();
            trayIcon.Text = "HaYTooL YouTube Downloader";
            
            // icon.ico dosyasını yükle
            if (File.Exists("icon.ico"))
            {
                try
                {
                    trayIcon.Icon = new Icon("icon.ico");
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

            // Sınıf düzeyindeki menü elemanlarını oluştur
            openUiItem = new MenuItem("Arayüzü Aç", OpenWebPage);
            pasteDownloadItem = new MenuItem("Panodan İndir", PasteAndDownload);

            shortcutsMenu = new MenuItem("Sekmelere Git");
            libraryShortcut = new MenuItem("Kütüphane", (s, e) => OpenUrl("/home"));
            queueShortcut = new MenuItem("İndirme Sırası", (s, e) => OpenUrl("/download"));
            downloadedShortcut = new MenuItem("İndirilenler", (s, e) => OpenUrl("/downlist"));
            channelsShortcut = new MenuItem("Kanallar", (s, e) => OpenUrl("/channels"));
            settingsShortcut = new MenuItem("Ayarlar", (s, e) => OpenUrl("/settings"));
            
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

            restartItem = new MenuItem("Yeniden Başlat", RestartNode);
            showConsoleItem = new MenuItem("Konsol Çıktısını Göster", ShowConsoleWindow);
            openLogFolderItem = new MenuItem("Log Klasörünü Aç", OpenLogFolder);
            exitItem = new MenuItem("Çıkış", ExitApp);

            // Sağ tık menüsünü oluştur
            ContextMenu contextMenu = new ContextMenu();
            contextMenu.MenuItems.Add(openUiItem);
            contextMenu.MenuItems.Add(pasteDownloadItem);
            contextMenu.MenuItems.Add(shortcutsMenu);
            contextMenu.MenuItems.Add(altSpeedItem);
            contextMenu.MenuItems.Add(bootItem);
            contextMenu.MenuItems.Add("-"); // Ayırıcı çizgi
            contextMenu.MenuItems.Add(restartItem);
            contextMenu.MenuItems.Add(showConsoleItem);
            contextMenu.MenuItems.Add(openLogFolderItem);
            contextMenu.MenuItems.Add("-"); // Ayırıcı çizgi
            contextMenu.MenuItems.Add(exitItem);

            // Başlangıç dil ayarını yükle
            string initialLang = GetLanguageSetting();
            ApplyLanguage(initialLang);

            // Menü her açıldığında ayarı okuyarak işareti güncelliyoruz
            contextMenu.Popup += (s, e) => {
                altSpeedItem.Checked = GetUseAlternativeSpeedSetting();
                bootItem.Checked = GetStartOnBootSetting();
            };

            trayIcon.ContextMenu = contextMenu;
            trayIcon.Visible = true;

            // Node Sunucusunu Başlat
            StartNode();

            // Kapatma eventlerini yakala
            Application.ApplicationExit += (s, e) => CleanUp();
        }

        // Türkçe Açıklama: configwin.ini dosyasından port değerini dinamik olarak okuyarak localhost adresini döner.
        private string GetAppUrl(string relativePath = "")
        {
            int port = 3000;
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

        // Türkçe Açıklama: Node.js sunucusunu arka planda, konsol penceresi olmadan (gizli) başlatır. Stdin komut gönderme desteği eklendi.
        private void StartNode()
        {
            try
            {
                if (nodeProcess != null && !nodeProcess.HasExited)
                {
                    return;
                }

                // Bağımlılık kontrolü (node_modules klasörü yoksa indir)
                string nodeModulesPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "node_modules");
                if (!Directory.Exists(nodeModulesPath))
                {
                    Form installForm = new Form();
                    installForm.Text = "HaYTool - İlk Kurulum";
                    installForm.Size = new Size(500, 180);
                    installForm.StartPosition = FormStartPosition.CenterScreen;
                    installForm.FormBorderStyle = FormBorderStyle.FixedDialog;
                    installForm.MaximizeBox = false;
                    installForm.MinimizeBox = false;
                    if (File.Exists("icon.ico"))
                    {
                        try { installForm.Icon = new Icon("icon.ico"); } catch {}
                    }

                    Label label = new Label();
                    label.Text = "Uygulama ilk kez çalıştırılıyor. Bağımlılıklar indiriliyor (npm install)...\nLütfen bekleyin, bu işlem internet hızınıza bağlı olarak birkaç dakika sürebilir.";
                    label.Size = new Size(460, 60);
                    label.Location = new Point(20, 25);
                    label.Font = new Font("Segoe UI", 9.5F, FontStyle.Regular);
                    installForm.Controls.Add(label);

                    ProgressBar progressBar = new ProgressBar();
                    progressBar.Style = ProgressBarStyle.Marquee;
                    progressBar.Size = new Size(440, 23);
                    progressBar.Location = new Point(20, 90);
                    installForm.Controls.Add(progressBar);

                    // npm install işlemini ayrı bir thread'de çalıştıralım
                    bool success = false;
                    string installError = "";

                    Thread thread = new Thread(() => {
                        try
                        {
                            ProcessStartInfo npmPsi = new ProcessStartInfo("cmd.exe", "/c npm install");
                            npmPsi.CreateNoWindow = true;
                            npmPsi.UseShellExecute = false;
                            npmPsi.RedirectStandardError = false;
                            npmPsi.RedirectStandardOutput = false;
                            npmPsi.WorkingDirectory = AppDomain.CurrentDomain.BaseDirectory;

                            using (Process npmProc = Process.Start(npmPsi))
                            {
                                npmProc.WaitForExit();
                                if (npmProc.ExitCode == 0)
                                {
                                    success = true;
                                }
                                else
                                {
                                    installError = "npm çıkış kodu: " + npmProc.ExitCode;
                                }
                            }
                        }
                        catch (Exception ex)
                        {
                            installError = ex.Message;
                        }

                        // Formu kapat
                        try
                        {
                            if (installForm.IsHandleCreated)
                            {
                                installForm.BeginInvoke(new Action(() => installForm.Close()));
                            }
                            else
                            {
                                installForm.Load += (s, e) => installForm.Close();
                            }
                        }
                        catch {}
                    });

                    installForm.Load += (s, e) => thread.Start();
                    installForm.ShowDialog();

                    if (!success)
                    {
                        MessageBox.Show("Bağımlılıklar yüklenemedi. Lütfen internet bağlantınızı kontrol edin veya manuel olarak 'npm install' komutunu çalıştırın.\nHata: " + installError, "Kurulum Hatası", MessageBoxButtons.OK, MessageBoxIcon.Error);
                        ExitApp(null, null);
                        return;
                    }
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
                psi.RedirectStandardOutput = true;
                psi.RedirectStandardError = true;
                psi.RedirectStandardInput = true; // Stdin yönlendirmesi aktif
                psi.StandardOutputEncoding = Encoding.UTF8;
                psi.StandardErrorEncoding = Encoding.UTF8;
                psi.WorkingDirectory = AppDomain.CurrentDomain.BaseDirectory;

                nodeProcess = new Process();
                nodeProcess.StartInfo = psi;
                
                nodeProcess.OutputDataReceived += (s, e) => {
                    if (e.Data != null) 
                    {
                        if (e.Data.StartsWith("[TRAY_CMD] lang="))
                        {
                            string newLang = e.Data.Substring("[TRAY_CMD] lang=".Length).Trim();
                            if (syncForm != null && syncForm.IsHandleCreated)
                            {
                                syncForm.BeginInvoke(new Action(() => {
                                    ApplyLanguage(newLang);
                                }));
                            }
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

                nodeProcess.Start();
                nodeProcess.BeginOutputReadLine();
                nodeProcess.BeginErrorReadLine();
                
                AppendLog("[TRAY] Node.js sunucu süreci başlatıldı.");
            }
            catch (Exception ex)
            {
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
                        logTextBox.AppendText(formattedText);
                    }));
                }
                catch {}
            }
        }

        // Türkçe Açıklama: Varsayılan tarayıcıda uygulamanın indirilenler sayfasını açar.
        private void OpenWebPage(object sender, EventArgs e)
        {
            OpenUrl("/downlist");
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

            logTextBox = new TextBox();
            logTextBox.Multiline = true;
            logTextBox.ReadOnly = true;
            logTextBox.ScrollBars = ScrollBars.Vertical;
            logTextBox.Dock = DockStyle.Fill;
            logTextBox.BackColor = Color.FromArgb(15, 14, 32);
            logTextBox.ForeColor = Color.FromArgb(220, 220, 220);
            logTextBox.Font = new Font("Consolas", 12f);

            lock (bufferLock)
            {
                logTextBox.Text = consoleBuffer.ToString();
            }

            // En alta kaydır
            logTextBox.SelectionStart = logTextBox.Text.Length;
            logTextBox.ScrollToCaret();

            mainLayout.Controls.Add(logTextBox, 0, 0);

            // Alt komut giriş paneli
            Panel commandPanel = new Panel();
            commandPanel.Dock = DockStyle.Fill;
            commandPanel.BackColor = Color.FromArgb(25, 24, 45);
            commandPanel.Padding = new Padding(10);

            Label cmdLabel = new Label();
            cmdLabel.Text = "Konsol Komutu:";
            cmdLabel.ForeColor = Color.White;
            cmdLabel.Font = new Font("Segoe UI", 10f, FontStyle.Bold);
            cmdLabel.AutoSize = true;
            cmdLabel.Location = new Point(10, 17);

            TextBox commandTextBox = new TextBox();
            commandTextBox.Font = new Font("Consolas", 11f);
            commandTextBox.BackColor = Color.FromArgb(35, 34, 55);
            commandTextBox.ForeColor = Color.White;
            commandTextBox.Location = new Point(125, 14);
            commandTextBox.Size = new Size(680, 26);
            commandTextBox.Anchor = AnchorStyles.Left | AnchorStyles.Right | AnchorStyles.Top;

            Button sendButton = new Button();
            sendButton.Text = "Gönder";
            sendButton.Font = new Font("Segoe UI", 9f, FontStyle.Bold);
            sendButton.BackColor = Color.FromArgb(40, 180, 99);
            sendButton.ForeColor = Color.White;
            sendButton.FlatStyle = FlatStyle.Flat;
            sendButton.FlatAppearance.BorderSize = 0;
            sendButton.Location = new Point(815, 13);
            sendButton.Size = new Size(100, 28);
            sendButton.Anchor = AnchorStyles.Right | AnchorStyles.Top;

            // Yeniden boyutlandırma olayı
            commandPanel.Resize += (s, ev) => {
                commandTextBox.Width = commandPanel.Width - 250;
                sendButton.Left = commandPanel.Width - 115;
            };

            // Enter tuşu ile gönderim
            commandTextBox.KeyDown += (s, ev) => {
                if (ev.KeyCode == Keys.Enter)
                {
                    ev.SuppressKeyPress = true; // Bip sesini kapat
                    string cmd = commandTextBox.Text.Trim();
                    if (!string.IsNullOrEmpty(cmd))
                    {
                        SendCommandToNode(cmd);
                        commandTextBox.Clear();
                    }
                }
            };

            sendButton.Click += (s, ev) => {
                string cmd = commandTextBox.Text.Trim();
                if (!string.IsNullOrEmpty(cmd))
                {
                    SendCommandToNode(cmd);
                    commandTextBox.Clear();
                    commandTextBox.Focus();
                }
            };

            commandPanel.Controls.Add(cmdLabel);
            commandPanel.Controls.Add(commandTextBox);
            commandPanel.Controls.Add(sendButton);

            mainLayout.Controls.Add(commandPanel, 0, 1);

            logForm.Controls.Add(mainLayout);
            logForm.Show();
        }

        private void OpenLogFolder(object sender, EventArgs e)
        {
            try
            {
                string logPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "logs");
                if (!Directory.Exists(logPath))
                {
                    Directory.CreateDirectory(logPath);
                }
                Process.Start("explorer.exe", "\"" + logPath + "\"");
            }
            catch (Exception ex)
            {
                MessageBox.Show("Log klasörü açılamadı: " + ex.Message, "Hata", MessageBoxButtons.OK, MessageBoxIcon.Error);
            }
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
                openUiItem.Text = "Open Interface";
                pasteDownloadItem.Text = "Paste & Download";
                shortcutsMenu.Text = "Go to Tabs";
                libraryShortcut.Text = "Library";
                queueShortcut.Text = "Download Queue";
                downloadedShortcut.Text = "Downloads";
                channelsShortcut.Text = "Channels";
                settingsShortcut.Text = "Settings";
                altSpeedItem.Text = "Alternative Speed Limit (Turtle)";
                bootItem.Text = "Run on System Startup";
                restartItem.Text = "Restart Server";
                showConsoleItem.Text = "Show Console Output";
                openLogFolderItem.Text = "Open Log Folder";
                exitItem.Text = "Exit";
                trayIcon.Text = "HaYTooL YouTube Downloader";
            }
            else if (lang == "es")
            {
                openUiItem.Text = "Abrir Interfaz";
                pasteDownloadItem.Text = "Pegar y Descargar";
                shortcutsMenu.Text = "Ir a Pestañas";
                libraryShortcut.Text = "Biblioteca";
                queueShortcut.Text = "Cola de Descargas";
                downloadedShortcut.Text = "Descargas";
                channelsShortcut.Text = "Canales";
                settingsShortcut.Text = "Configuración";
                altSpeedItem.Text = "Límite de Velocidad Alternativo (Turtle)";
                bootItem.Text = "Ejecutar al Inicio del Sistema";
                restartItem.Text = "Reiniciar Servidor";
                showConsoleItem.Text = "Mostrar Salida de Consola";
                openLogFolderItem.Text = "Abrir carpeta de logs";
                exitItem.Text = "Salir";
                trayIcon.Text = "HaYTooL YouTube Downloader";
            }
            else if (lang == "de")
            {
                openUiItem.Text = "Benutzeroberfläche öffnen";
                pasteDownloadItem.Text = "Einfügen & Herunterladen";
                shortcutsMenu.Text = "Gehe zu Tabs";
                libraryShortcut.Text = "Bibliothek";
                queueShortcut.Text = "Download-Warteschlange";
                downloadedShortcut.Text = "Downloads";
                channelsShortcut.Text = "Kanäle";
                settingsShortcut.Text = "Einstellungen";
                altSpeedItem.Text = "Alternative Geschwindigkeitsbegrenzung (Turtle)";
                bootItem.Text = "Beim Systemstart ausführen";
                restartItem.Text = "Server neu starten";
                showConsoleItem.Text = "Konsolenausgabe anzeigen";
                openLogFolderItem.Text = "Log-Ordner öffnen";
                exitItem.Text = "Beenden";
                trayIcon.Text = "HaYTooL YouTube Downloader";
            }
            else if (lang == "pt")
            {
                openUiItem.Text = "Abrir Interface";
                pasteDownloadItem.Text = "Colar & Baixar";
                shortcutsMenu.Text = "Ir para Abas";
                libraryShortcut.Text = "Biblioteca";
                queueShortcut.Text = "Fila de Downloads";
                downloadedShortcut.Text = "Downloads";
                channelsShortcut.Text = "Canais";
                settingsShortcut.Text = "Configurações";
                altSpeedItem.Text = "Limite de Velocidade Alternativo (Turtle)";
                bootItem.Text = "Executar na Inicialização do Sistema";
                restartItem.Text = "Reiniciar Servidor";
                showConsoleItem.Text = "Mostrar Saída do Console";
                openLogFolderItem.Text = "Abrir pasta de logs";
                exitItem.Text = "Sair";
                trayIcon.Text = "HaYTooL YouTube Downloader";
            }
            else if (lang == "ar")
            {
                openUiItem.Text = "فتح الواجهة";
                pasteDownloadItem.Text = "اللصق والتنزيل";
                shortcutsMenu.Text = "الانتقال إلى التبويبات";
                libraryShortcut.Text = "المكتبة";
                queueShortcut.Text = "قائمة الانتظار";
                downloadedShortcut.Text = "التنزيلات";
                channelsShortcut.Text = "القنوات";
                settingsShortcut.Text = "الإعدادات";
                altSpeedItem.Text = "حد السرعة البديل (السلحفاة)";
                bootItem.Text = "التشغيل عند بدء تشغيل النظام";
                restartItem.Text = "إعادة تشغيل الخادم";
                showConsoleItem.Text = "عرض مخرجات وحدة التحكم";
                openLogFolderItem.Text = "فتح مجلد السجلات";
                exitItem.Text = "خروج";
                trayIcon.Text = "HaYTooL YouTube Downloader";
            }
            else if (lang == "ru")
            {
                openUiItem.Text = "Открыть интерфейс";
                pasteDownloadItem.Text = "Вставить и скачать";
                shortcutsMenu.Text = "Перейти к вкладкам";
                libraryShortcut.Text = "Библиотека";
                queueShortcut.Text = "Очередь загрузки";
                downloadedShortcut.Text = "Загрузки";
                channelsShortcut.Text = "Каналы";
                settingsShortcut.Text = "Настройки";
                altSpeedItem.Text = "Альтернативный лимит скорости (Черепаха)";
                bootItem.Text = "Запускать при старте системы";
                restartItem.Text = "Перезапустить сервер";
                showConsoleItem.Text = "Показать вывод консоли";
                openLogFolderItem.Text = "Открыть папку с логами";
                exitItem.Text = "Выход";
                trayIcon.Text = "HaYTooL YouTube Downloader";
            }
            else // Varsayılan Türkçe (tr)
            {
                openUiItem.Text = "Arayüzü Aç";
                pasteDownloadItem.Text = "Panodan İndir";
                shortcutsMenu.Text = "Sekmelere Git";
                libraryShortcut.Text = "Kütüphane";
                queueShortcut.Text = "İndirme Sırası";
                downloadedShortcut.Text = "İndirilenler";
                channelsShortcut.Text = "Kanallar";
                settingsShortcut.Text = "Ayarlar";
                altSpeedItem.Text = "Alternatif Hız Sınırı (Turtle)";
                bootItem.Text = "Sistem Başlangıcında Çalıştır";
                restartItem.Text = "Yeniden Başlat";
                showConsoleItem.Text = "Konsol Çıktısını Göster";
                openLogFolderItem.Text = "Log Klasörünü Aç";
                exitItem.Text = "Çıkış";
                trayIcon.Text = "HaYTooL YouTube Downloader";
            }
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
    }
}
