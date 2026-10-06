using System;
using System.Runtime.InteropServices;
using System.Windows;

namespace HaYTooLPlayer
{
    [ComVisible(true)]
    public class PlayerBridge
    {
        private readonly MainWindow _mainWindow;

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
    }
}
