using System;
using System.Runtime.InteropServices;
using System.Windows;
using System.Windows.Interop;

namespace HaYTooLPlayer
{
    /// <summary>
    /// Türkçe Açıklama: Windows Shell ve Win32 pencere entegrasyonu için yardımcı sınıf.
    /// Görev çubuğunda pencerelerin doğru gruplanması veya ayrılması için AppUserModelID ataması yapar.
    /// </summary>
    public static class WindowHelper
    {
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

        /// <summary>
        /// Belirtilen pencereye Windows AppUserModelID değerini atar.
        /// </summary>
        /// <param name="window">Hedef WPF penceresi</param>
        /// <param name="appId">Uygulama kimlik dizesi (örn. HaYTooL.MainWindow)</param>
        public static void SetWindowAppId(Window window, string appId)
        {
            if (window == null) return;
            try
            {
                var helper = new WindowInteropHelper(window);
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

        #region Fullscreen Win32 Helpers

        [StructLayout(LayoutKind.Sequential)]
        public struct POINT
        {
            public int X;
            public int Y;
        }

        [StructLayout(LayoutKind.Sequential)]
        public struct RECT
        {
            public int left;
            public int top;
            public int right;
            public int bottom;
        }

        [StructLayout(LayoutKind.Sequential)]
        public struct WINDOWPLACEMENT
        {
            public int length;
            public int flags;
            public int showCmd;
            public POINT ptMinPosition;
            public POINT ptMaxPosition;
            public RECT rcNormalPosition;
        }

        [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Auto)]
        public struct MONITORINFO
        {
            public int cbSize;
            public RECT rcMonitor;
            public RECT rcWork;
            public uint dwFlags;
        }

        private const int GWL_STYLE = -16;
        private const int WS_CAPTION = 0x00C00000;
        private const int WS_THICKFRAME = 0x00040000;

        private const uint MONITOR_DEFAULTTONEAREST = 0x00000002;
        private const uint SWP_NOSIZE = 0x0001;
        private const uint SWP_NOMOVE = 0x0002;
        private const uint SWP_NOZORDER = 0x0004;
        private const uint SWP_NOACTIVATE = 0x0010;
        private const uint SWP_FRAMECHANGED = 0x0020;
        private const uint SWP_SHOWWINDOW = 0x0040;
        private const uint SWP_NOOWNERZORDER = 0x0200;

        private static readonly IntPtr HWND_TOP = IntPtr.Zero;
        private static readonly IntPtr HWND_TOPMOST = new IntPtr(-1);
        private static readonly IntPtr HWND_NOTOPMOST = new IntPtr(-2);

        [DllImport("user32.dll")]
        private static extern IntPtr MonitorFromWindow(IntPtr hwnd, uint dwFlags);

        [DllImport("user32.dll", SetLastError = true)]
        private static extern bool GetMonitorInfo(IntPtr hMonitor, ref MONITORINFO lpmi);

        [DllImport("user32.dll", SetLastError = true)]
        private static extern bool GetWindowPlacement(IntPtr hWnd, ref WINDOWPLACEMENT lpwndpl);

        [DllImport("user32.dll", SetLastError = true)]
        private static extern bool SetWindowPlacement(IntPtr hWnd, [In] ref WINDOWPLACEMENT lpwndpl);

        [DllImport("user32.dll", SetLastError = true)]
        private static extern int GetWindowLong(IntPtr hWnd, int nIndex);

        [DllImport("user32.dll", SetLastError = true)]
        private static extern int SetWindowLong(IntPtr hWnd, int nIndex, int dwNewLong);

        [DllImport("user32.dll", SetLastError = true)]
        private static extern bool SetWindowPos(IntPtr hWnd, IntPtr hWndInsertAfter, int X, int Y, int cx, int cy, uint uFlags);

        public class FullScreenState
        {
            public bool IsFullScreen { get; set; } = false;
            public WINDOWPLACEMENT WindowPlacement = new WINDOWPLACEMENT();
            public int WindowStyleFlags = 0;
            public bool Topmost = false;
            public WindowStyle WpfWindowStyle = WindowStyle.SingleBorderWindow;
            public ResizeMode WpfResizeMode = ResizeMode.CanResize;
            public WindowState WpfWindowState = WindowState.Maximized;
        }

        /// <summary>
        /// Türkçe Açıklama: Pencereyi ara bir 'Normal' durumuna düşürüp küçültmeden, doğrudan aktif monitörün
        /// tam ekran sınırlarına kesintisiz (0 ms, sıfır sıçrama ve küçülme) olarak geçirir.
        /// </summary>
        public static void EnterFullScreen(Window window, FullScreenState state)
        {
            if (window == null || state.IsFullScreen) return;

            try
            {
                var helper = new WindowInteropHelper(window);
                IntPtr hwnd = helper.Handle;
                if (hwnd == IntPtr.Zero) return;

                // 1. Mevcut WPF ve Win32 pencere durumunu kaydet
                state.Topmost = window.Topmost;
                state.WpfWindowStyle = window.WindowStyle;
                state.WpfResizeMode = window.ResizeMode;
                state.WpfWindowState = window.WindowState;

                state.WindowPlacement = new WINDOWPLACEMENT();
                state.WindowPlacement.length = Marshal.SizeOf<WINDOWPLACEMENT>();
                GetWindowPlacement(hwnd, ref state.WindowPlacement);
                state.WindowStyleFlags = GetWindowLong(hwnd, GWL_STYLE);

                // 2. Aktif monitörün ekran sınırlarını al
                IntPtr hMonitor = MonitorFromWindow(hwnd, MONITOR_DEFAULTTONEAREST);
                MONITORINFO mi = new MONITORINFO();
                mi.cbSize = Marshal.SizeOf<MONITORINFO>();
                if (!GetMonitorInfo(hMonitor, ref mi)) return;

                // 3. Pencere kenarlık ve başlık çubuğu stillerini kaldır
                int newStyle = state.WindowStyleFlags & ~(WS_CAPTION | WS_THICKFRAME);
                SetWindowLong(hwnd, GWL_STYLE, newStyle);

                // 4. WPF özelliklerini senkronize et
                window.Topmost = true;

                // 5. Pencereyi tek bir atomik Win32 çağrısıyla tam ekran yap (Görev çubuğu dahil üstte kaplar)
                int x = mi.rcMonitor.left;
                int y = mi.rcMonitor.top;
                int width = mi.rcMonitor.right - mi.rcMonitor.left;
                int height = mi.rcMonitor.bottom - mi.rcMonitor.top;

                SetWindowPos(hwnd, HWND_TOPMOST, x, y, width, height,
                    SWP_NOOWNERZORDER | SWP_FRAMECHANGED | SWP_SHOWWINDOW);

                state.IsFullScreen = true;
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"[WindowHelper] EnterFullScreen error: {ex.Message}");
            }
        }

        /// <summary>
        /// Türkçe Açıklama: Tam ekrandan çıkarken önceki boyutu (Maximized veya Normal) hiçbir sıçrama olmadan
        /// birebir eski haline geri yükler.
        /// </summary>
        public static void ExitFullScreen(Window window, FullScreenState state)
        {
            if (window == null || !state.IsFullScreen) return;

            try
            {
                var helper = new WindowInteropHelper(window);
                IntPtr hwnd = helper.Handle;
                if (hwnd == IntPtr.Zero) return;

                // 1. Orijinal Win32 stilini geri yükle
                SetWindowLong(hwnd, GWL_STYLE, state.WindowStyleFlags);

                // 2. Orijinal yerleşimi (Maximized veya Normal boyutunu) uygula
                SetWindowPlacement(hwnd, ref state.WindowPlacement);

                // 3. Çerçeveyi ve Topmost durumunu güncelle
                IntPtr zOrder = state.Topmost ? HWND_TOPMOST : HWND_NOTOPMOST;
                SetWindowPos(hwnd, zOrder, 0, 0, 0, 0,
                    SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE | SWP_NOOWNERZORDER | SWP_FRAMECHANGED);

                // 4. WPF durumunu senkronize et
                window.Topmost = state.Topmost;
                window.ResizeMode = state.WpfResizeMode;
                window.WindowStyle = state.WpfWindowStyle;
                window.WindowState = state.WpfWindowState;

                state.IsFullScreen = false;
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"[WindowHelper] ExitFullScreen error: {ex.Message}");
            }
        }

        #endregion
    }
}
