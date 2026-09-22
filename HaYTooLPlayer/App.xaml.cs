using System;
using System.Configuration;
using System.Data;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Runtime.InteropServices;
using System.Threading;
using System.Threading.Tasks;
using System.Windows;

namespace HaYTooLPlayer;

/// <summary>
/// Interaction logic for App.xaml
/// </summary>
public partial class App : Application
{
    [DllImport("user32.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool SetForegroundWindow(IntPtr hWnd);

    [DllImport("user32.dll")]
    private static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);

    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    private static extern IntPtr SendMessage(IntPtr hWnd, uint Msg, IntPtr wParam, ref COPYDATASTRUCT lParam);

    [DllImport("user32.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool IsIconic(IntPtr hWnd);

    private const int SW_RESTORE = 9;
    private const int SW_SHOW = 5;
    private const int WM_COPYDATA = 0x004A;

    [StructLayout(LayoutKind.Sequential)]
    public struct COPYDATASTRUCT
    {
        public IntPtr dwData;
        public int cbData;
        [MarshalAs(UnmanagedType.LPWStr)]
        public string lpData;
    }

    private static Mutex? _instanceMutex;

    protected override void OnStartup(StartupEventArgs e)
    {
        // 1. Single Instance Denetimi: Zaten açık bir oynatıcı varsa ikinci kopya başlatılmaz
        bool createdNew;
        _instanceMutex = new Mutex(true, "HaYTooLPlayer_SingleInstance_Mutex", out createdNew);

        if (!createdNew)
        {
            try
            {
                Process current = Process.GetCurrentProcess();
                Process[] processes = Process.GetProcessesByName(current.ProcessName);
                Process? existing = processes.FirstOrDefault(p => p.Id != current.Id && p.MainWindowHandle != IntPtr.Zero);

                if (existing != null)
                {
                    IntPtr hWnd = existing.MainWindowHandle;
                    string path = (e.Args != null && e.Args.Length > 0) ? e.Args[0] : "/downlist";
                    bool isSilent = path == "REFRESH_COOKIES" || path == "--silent-cookie-refresh";

                    if (!isSilent)
                    {
                        if (IsIconic(hWnd))
                        {
                            ShowWindow(hWnd, SW_RESTORE);
                        }
                        else
                        {
                            ShowWindow(hWnd, SW_SHOW);
                        }
                        SetForegroundWindow(hWnd);
                    }

                    COPYDATASTRUCT cds;
                    cds.dwData = IntPtr.Zero;
                    cds.lpData = path;
                    cds.cbData = (path.Length + 1) * 2;
                    SendMessage(hWnd, WM_COPYDATA, IntPtr.Zero, ref cds);
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
