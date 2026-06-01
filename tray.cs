using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
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

        [STAThread]
        public static void Main()
        {
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            Application.Run(new Program());
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
            contextMenu.MenuItems.Add("Yeniden Başlat", RestartNode);
            contextMenu.MenuItems.Add("Konsol Çıktısını Göster", ShowConsoleWindow);
            contextMenu.MenuItems.Add("-"); // Ayırıcı çizgi
            contextMenu.MenuItems.Add("Çıkış", ExitApp);

            trayIcon.ContextMenu = contextMenu;
            trayIcon.Visible = true;

            // Node Sunucusunu Başlat
            StartNode();

            // Kapatma eventlerini yakala
            Application.ApplicationExit += (s, e) => CleanUp();
        }

        // Türkçe Açıklama: Node.js sunucusunu arka planda, konsol penceresi olmadan (gizli) başlatır.
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

        // Türkçe Açıklama: Varsayılan tarayıcıda uygulamanın web arayüzünü açar.
        private void OpenWebPage(object sender, EventArgs e)
        {
            try
            {
                Process.Start("http://localhost:3000");
            }
            catch (Exception ex)
            {
                MessageBox.Show("Tarayıcı açılamadı: " + ex.Message);
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

        // Türkçe Açıklama: Node.js konsol çıktısını gerçek zamanlı gösteren log penceresini açar.
        private void ShowConsoleWindow(object sender, EventArgs e)
        {
            if (logForm != null && !logForm.IsDisposed)
            {
                logForm.Focus();
                return;
            }

            logForm = new Form();
            logForm.Text = "HaYTool - Terminal Çıktısı";
            logForm.Size = new Size(700, 450);
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

            logTextBox = new TextBox();
            logTextBox.Multiline = true;
            logTextBox.ReadOnly = true;
            logTextBox.ScrollBars = ScrollBars.Vertical;
            logTextBox.Dock = DockStyle.Fill;
            logTextBox.BackColor = Color.FromArgb(15, 14, 32);
            logTextBox.ForeColor = Color.FromArgb(220, 220, 220);
            logTextBox.Font = new Font("Consolas", 10);

            lock (bufferLock)
            {
                logTextBox.Text = consoleBuffer.ToString();
            }

            // En alta kaydır
            logTextBox.SelectionStart = logTextBox.Text.Length;
            logTextBox.ScrollToCaret();

            logForm.Controls.Add(logTextBox);
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
