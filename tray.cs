using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Net;
using System.Text;
using System.Threading;
using System.Windows.Forms;

namespace HaYToolTray
{
    public class Program : ApplicationContext
    {
        private NotifyIcon trayIcon;
        private Process nodeProcess;
        private string logFilePath = "logs/server_tray.log";
        private StringBuilder consoleBuffer = new StringBuilder();
        private Form logForm;
        private TextBox logTextBox;
        private object bufferLock = new object();

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

                ProcessStartInfo psi = new ProcessStartInfo("node", argString.ToString());
                psi.CreateNoWindow = true;
                psi.UseShellExecute = false;
                psi.RedirectStandardOutput = true;
                psi.RedirectStandardError = true;
                psi.StandardOutputEncoding = Encoding.UTF8;
                psi.StandardErrorEncoding = Encoding.UTF8;
                psi.WorkingDirectory = AppDomain.CurrentDomain.BaseDirectory;

                using (Process proc = Process.Start(psi))
                {
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
            // Logs dizinini oluştur
            if (!Directory.Exists("logs"))
            {
                Directory.CreateDirectory("logs");
            }

            // Tray İkonunu Hazırla
            trayIcon = new NotifyIcon();
            trayIcon.Text = "HaYTool Youtube Download";
            
            // Logo.ico dosyasını yükle
            if (File.Exists("logo.ico"))
            {
                try
                {
                    trayIcon.Icon = new Icon("logo.ico");
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

            // Sağ tık menüsünü oluştur
            ContextMenu contextMenu = new ContextMenu();
            contextMenu.MenuItems.Add("Arayüzü Aç", OpenWebPage);
            contextMenu.MenuItems.Add("Panodan İndir (Paste & Download)", PasteAndDownload);

            // Türkçe Açıklama: Sekmeler için doğrudan hızlı açılış bağlantıları (menü öğeleri)
            MenuItem shortcutsMenu = new MenuItem("Sekmelere Git");
            shortcutsMenu.MenuItems.Add("Kütüphane", (s, e) => OpenUrl("/home"));
            shortcutsMenu.MenuItems.Add("İndirme Sırası", (s, e) => OpenUrl("/download"));
            shortcutsMenu.MenuItems.Add("İndirilenler", (s, e) => OpenUrl("/downlist"));
            shortcutsMenu.MenuItems.Add("Kanallar", (s, e) => OpenUrl("/channels"));
            shortcutsMenu.MenuItems.Add("Ayarlar", (s, e) => OpenUrl("/settings"));
            contextMenu.MenuItems.Add(shortcutsMenu);

            // Alternatif Hız Sınırı (Turtle) Toggle menü öğesi
            MenuItem altSpeedItem = new MenuItem("Alternatif Hız Sınırı (Turtle)");
            altSpeedItem.Click += ToggleAlternativeSpeed;
            contextMenu.MenuItems.Add(altSpeedItem);

            contextMenu.MenuItems.Add("-"); // Ayırıcı çizgi
            contextMenu.MenuItems.Add("Yeniden Başlat", RestartNode);
            contextMenu.MenuItems.Add("Konsol Çıktısını Göster", ShowConsoleWindow);
            contextMenu.MenuItems.Add("-"); // Ayırıcı çizgi
            contextMenu.MenuItems.Add("Çıkış", ExitApp);

            // Menü her açıldığında ayarı okuyarak işareti güncelliyoruz
            contextMenu.Popup += (s, e) => {
                altSpeedItem.Checked = GetUseAlternativeSpeedSetting();
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

                ProcessStartInfo psi = new ProcessStartInfo("node", "server.js");
                psi.CreateNoWindow = true;
                psi.UseShellExecute = false;
                psi.RedirectStandardOutput = true;
                psi.RedirectStandardError = true;
                psi.RedirectStandardInput = true; // Stdin yönlendirmesi aktif
                psi.StandardOutputEncoding = Encoding.UTF8;
                psi.StandardErrorEncoding = Encoding.UTF8;
                psi.WorkingDirectory = AppDomain.CurrentDomain.BaseDirectory;

                nodeProcess = new Process();
                nodeProcess.StartInfo = psi;
                
                nodeProcess.OutputDataReceived += (s, e) => {
                    if (e.Data != null) AppendLog(e.Data);
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

        // Türkçe Açıklama: Gelen konsol çıktılarını yerel log dosyasına yazar ve bellek tamponuna ekler.
        private void AppendLog(string text)
        {
            string formattedText = string.Format("[{0}] {1}\r\n", DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss"), text);
            
            // Dosyaya yaz
            try
            {
                File.AppendAllText(logFilePath, formattedText);
            }
            catch {}

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
            
            // Logo.ico dosyasını forma da ekle
            if (File.Exists("logo.ico"))
            {
                try
                {
                    logForm.Icon = new Icon("logo.ico");
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
        }

        // Türkçe Açıklama: Uygulamadan tamamen çıkış yapar.
        private void ExitApp(object sender, EventArgs e)
        {
            CleanUp();
            Environment.Exit(0);
        }
    }
}
