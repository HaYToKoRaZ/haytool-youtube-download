using System;
using System.Configuration;
using System.Data;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using System.Windows;

namespace HaYTooLPlayer;

/// <summary>
/// Interaction logic for App.xaml
/// </summary>
public partial class App : System.Windows.Application
{
    [DllImport("user32.dll", SetLastError = true, CharSet = CharSet.Unicode)]
    private static extern IntPtr SendMessageTimeout(IntPtr hWnd, uint Msg, IntPtr wParam, ref COPYDATASTRUCT lParam, uint fuFlags, uint uTimeout, out IntPtr lpdwResult);

    [DllImport("user32.dll", SetLastError = true, CharSet = CharSet.Unicode)]
    private static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int maxCount);

    [DllImport("user32.dll", SetLastError = true)]
    private static extern int GetWindowTextLength(IntPtr hWnd);

    private const uint SMTO_ABORTIFHUNG = 0x0002;
    private const uint ACTIVATION_MESSAGE_TIMEOUT_MS = 3000;
    private const int WM_COPYDATA = 0x004A;

    [StructLayout(LayoutKind.Sequential)]
    public struct COPYDATASTRUCT
    {
        public IntPtr dwData;
        public int cbData;
        [MarshalAs(UnmanagedType.LPWStr)]
        public string lpData;
    }

    private delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);
    [DllImport("user32.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool EnumWindows(EnumWindowsProc lpEnumFunc, IntPtr lParam);

    [DllImport("user32.dll", SetLastError = true)]
    private static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);

    private static IntPtr FindMainWindowForProcess(Process proc)
    {
        IntPtr found = IntPtr.Zero;
        try
        {
            EnumWindows((hWnd, lParam) =>
            {
                GetWindowThreadProcessId(hWnd, out uint pid);
                if (pid == proc.Id)
                {
                    int titleLength = GetWindowTextLength(hWnd);
                    if (titleLength > 0)
                    {
                        var title = new StringBuilder(titleLength + 1);
                        GetWindowText(hWnd, title, title.Capacity);
                        if (title.ToString().Equals("Multimedia HaYTooL - Player", StringComparison.Ordinal))
                        {
                            found = hWnd;
                            return false;
                        }
                    }
                }
                return true;
            }, IntPtr.Zero);
        }
        catch {}
        return found;
    }

    private static Mutex? _instanceMutex;
    public static MainWindow? RootWindow;

    protected override void OnStartup(StartupEventArgs e)
    {
        string dbgPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "wv2_debug.log");
        try { File.AppendAllText(dbgPath, $"[{DateTime.Now}] >>> OnStartup ENTER: Args='{(e.Args != null ? string.Join(" ", e.Args) : "")}'\n"); } catch {}

        string rawArgs = (e.Args != null && e.Args.Length > 0) ? string.Join(" ", e.Args).Trim() : "/downlist";
        string checkLower = rawArgs.ToLowerInvariant();
        bool isExitReq = checkLower == "exit" || checkLower == "stop" || checkLower == "quit" || checkLower == "kill" || checkLower == "close" || checkLower == "--exit" || checkLower == "--stop" || checkLower == "/exit" || checkLower == "/stop";

        // 1. Single Instance Denetimi: Zaten açık bir oynatıcı varsa ikinci kopya başlatılmaz
        bool createdNew;
        _instanceMutex = new Mutex(true, "HaYTooLPlayer_SingleInstance_Mutex", out createdNew);
        try { File.AppendAllText(dbgPath, $"[{DateTime.Now}] >>> Mutex createdNew={createdNew}, isExitReq={isExitReq}\n"); } catch {}

        // Eğer uygulama zaten çalışmıyorken kapatma komutu çağrıldıysa hiçbir şey başlatmadan çık
        if (createdNew && isExitReq)
        {
            try { _instanceMutex.ReleaseMutex(); } catch {}
            Environment.Exit(0);
            return;
        }

        if (!createdNew)
        {
            try
            {
                try { File.AppendAllText(dbgPath, $"[{DateTime.Now}] Second instance started with args: '{rawArgs}'\n"); } catch {}

                Process current = Process.GetCurrentProcess();
                Process[] processes = Process.GetProcessesByName(current.ProcessName);
                Process? existing = processes.FirstOrDefault(p => p.Id != current.Id);

                if (existing != null)
                {
                    IntPtr hWnd = IntPtr.Zero;
                    for (int attempt = 0; attempt < 15 && hWnd == IntPtr.Zero; attempt++)
                    {
                        hWnd = FindMainWindowForProcess(existing);
                        if (hWnd == IntPtr.Zero) Thread.Sleep(100);
                    }
                    try { File.AppendAllText(dbgPath, $"[{DateTime.Now}] Target PID: {existing.Id}, Target HWND: {hWnd}\n"); } catch {}

                    string fullArgs = rawArgs;

                    if (hWnd != IntPtr.Zero)
                    {
                        COPYDATASTRUCT cds;
                        cds.dwData = IntPtr.Zero;
                        cds.lpData = fullArgs;
                        cds.cbData = (fullArgs.Length + 1) * 2;
                        IntPtr sendResult = SendMessageTimeout(hWnd, WM_COPYDATA, IntPtr.Zero, ref cds, SMTO_ABORTIFHUNG, ACTIVATION_MESSAGE_TIMEOUT_MS, out _);
                        if (sendResult == IntPtr.Zero)
                        {
                            int error = Marshal.GetLastWin32Error();
                            try { File.AppendAllText(dbgPath, $"[{DateTime.Now}] WM_COPYDATA delivery failed: Win32Error={error}\n"); } catch {}
                        }
                    }
                    else
                    {
                        try { File.AppendAllText(dbgPath, $"[{DateTime.Now}] Main window not found for PID {existing.Id}; activation was not delivered.\n"); } catch {}
                    }
                }

                // Eğer kapatma komutuysa, mesaj iletildikten sonra tüm backend veya kalan haytool süreçlerini garantiye al
                if (isExitReq)
                {
                    try
                    {
                        foreach (var p in processes.Where(p => p.Id != current.Id))
                        {
                            if (!p.HasExited && !p.WaitForExit(5000)) p.Kill();
                        }
                    }
                    catch {}
                    try
                    {
                        foreach (var processName in new[] { "Multimedia HaYTooL Backend", "HaYTool-Backend" })
                        {
                            foreach (var bp in Process.GetProcessesByName(processName))
                            {
                                if (!bp.HasExited) bp.Kill();
                            }
                        }
                    }
                    catch {}
                }
            }
            catch {}

            // İkinci kopyayı derhal sonlandır
            Environment.Exit(0);
            return;
        }

        base.OnStartup(e);
        string logPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "wv2_debug.log");
        try { File.AppendAllText(logPath, $"[{DateTime.Now}] App.OnStartup fired.\n"); } catch {}

        AppDomain.CurrentDomain.UnhandledException += (s, args) =>
        {
            try { File.AppendAllText(logPath, $"[{DateTime.Now}] [CRASH AppDomain] {args.ExceptionObject}\n"); } catch {}
        };

        DispatcherUnhandledException += (s, args) =>
        {
            try { File.AppendAllText(logPath, $"[{DateTime.Now}] [CRASH Dispatcher] {args.Exception}\n"); } catch {}
        };

        TaskScheduler.UnobservedTaskException += (s, args) =>
        {
            try { File.AppendAllText(logPath, $"[{DateTime.Now}] [CRASH Task] {args.Exception}\n"); } catch {}
        };

        RootWindow = new MainWindow();
        MainWindow mainWindow = RootWindow;
        this.MainWindow = mainWindow;

        bool isSilent = TrayManager.IsSilentMode(e.Args);
        bool silentCookieMode = e.Args != null && e.Args.Any(a => a.Equals("--silent-cookie-refresh", StringComparison.OrdinalIgnoreCase) || a.Equals("REFRESH_COOKIES", StringComparison.OrdinalIgnoreCase));
        bool isTrayOnly = e.Args != null && e.Args.Any(a => a.Equals("--tray-only", StringComparison.OrdinalIgnoreCase) || a.Equals("--minimized", StringComparison.OrdinalIgnoreCase) || a.Equals("/minimized", StringComparison.OrdinalIgnoreCase));

        // Kullanıcı ayarlarında "Tarayıcıyı Otomatik Aç" (autoOpenBrowser) açık mı denetle
        bool autoOpen = TrayManager.GetAutoOpenBrowserSetting();

        if (!isSilent && !silentCookieMode && !isTrayOnly && autoOpen)
        {
            mainWindow.OpenInitialUI();
        }
        else
        {
            // Sessiz veya arka planda çalışırken WPF penceresini ve mesaj döngüsünü tamamen başlatıp gizli tut
            mainWindow.Opacity = 0;
            mainWindow.ShowInTaskbar = false;
            mainWindow.Show();
            mainWindow.Hide();
            mainWindow.Opacity = 1;
            mainWindow.ShowInTaskbar = true;
        }
    }

    protected override void OnExit(ExitEventArgs e)
    {
        if (_instanceMutex != null)
        {
            try { _instanceMutex.ReleaseMutex(); } catch {}
            _instanceMutex.Dispose();
            _instanceMutex = null;
        }

        string logPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "wv2_debug.log");
        try { File.AppendAllText(logPath, $"[{DateTime.Now}] App.OnExit fired! ExitCode={e.ApplicationExitCode}\n"); } catch {}
        base.OnExit(e);
    }
}
