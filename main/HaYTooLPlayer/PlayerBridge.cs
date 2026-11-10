using System;
using System.Runtime.InteropServices;
using System.Windows;
using System.Windows.Interop;

namespace HaYTooLPlayer
{
    [ComVisible(true)]
    public class PlayerBridge
    {
        private readonly MainWindow _mainWindow;

        [DllImport("user32.dll")]
        public static extern bool ReleaseCapture();

        [DllImport("user32.dll")]
        public static extern IntPtr SendMessage(IntPtr hWnd, int Msg, IntPtr wParam, IntPtr lParam);

        private const int WM_NCLBUTTONDOWN = 0xA1;
        private const int HTCAPTION = 0x2;

        public PlayerBridge(MainWindow mainWindow)
        {
            _mainWindow = mainWindow;
        }

        // JavaScript'ten çağrılacak metod. 
        // JavaScript call: chrome.webview.hostObjects.playerBridge.play(filePath, title, channelName, publishDate, videoId)
        public void play(string filePath, string title, string channelName, string publishDate, string videoId)
        {
            _mainWindow.Dispatcher.Invoke(() =>
            {
                _mainWindow.PlayVideoNative(filePath, title, channelName, publishDate, videoId);
            });
        }

        // JavaScript'ten dosya kopyalama: chrome.webview.hostObjects.playerBridge.copyFileToClipboard(filePath)
        public bool copyFileToClipboard(string filePath)
        {
            try
            {
                if (System.IO.File.Exists(filePath))
                {
                    _mainWindow.Dispatcher.Invoke(() =>
                    {
                        var files = new System.Collections.Specialized.StringCollection();
                        files.Add(filePath);
                        System.Windows.Clipboard.SetFileDropList(files);
                    });
                    return true;
                }
            }
            catch { }
            return false;
        }

        public void minimizeWindow()
        {
            _mainWindow.Dispatcher.Invoke(() =>
            {
                _mainWindow.WindowState = WindowState.Minimized;
            });
        }

        public void toggleMaximizeWindow()
        {
            _mainWindow.Dispatcher.Invoke(() =>
            {
                _mainWindow.WindowState = (_mainWindow.WindowState == WindowState.Maximized)
                    ? WindowState.Normal
                    : WindowState.Maximized;
            });
        }

        public void closeWindow()
        {
            _mainWindow.Dispatcher.Invoke(() =>
            {
                _mainWindow.Close();
            });
        }

        public void dragWindow()
        {
            _mainWindow.Dispatcher.Invoke(() =>
            {
                try
                {
                    var helper = new WindowInteropHelper(_mainWindow);
                    ReleaseCapture();
                    SendMessage(helper.Handle, WM_NCLBUTTONDOWN, (IntPtr)HTCAPTION, IntPtr.Zero);
                }
                catch
                {
                    try { _mainWindow.DragMove(); } catch {}
                }
            });
        }

        public void setCustomTitlebar(bool enable)
        {
            _mainWindow.Dispatcher.Invoke(() =>
            {
                _mainWindow.ApplyCustomTitlebar(enable);
            });
        }

        public bool isWindowMaximized()
        {
            bool isMax = false;
            _mainWindow.Dispatcher.Invoke(() =>
            {
                isMax = (_mainWindow.WindowState == WindowState.Maximized);
            });
            return isMax;
        }

        public void syncCookies()
        {
            _mainWindow.Dispatcher.Invoke(async () =>
            {
                await _mainWindow.SyncYouTubeCookiesToFileAsync();
            });
        }
    }
}
