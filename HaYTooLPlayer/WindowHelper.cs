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
    }
}
