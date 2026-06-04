<p align="center">
  <img src="public/logo.png" alt="HaYTooL Logo" width="120" style="border-radius: 20px; box-shadow: 0 8px 16px rgba(0,0,0,0.3);"/>
</p>

# <p align="center">📥 HaYTooL YouTube Downloader (v4.13.3)</p>

<p align="center">
  <b>Gelişmiş, Taşınabilir ve Sıfır Kurulumlu YouTube Otomasyon & İndirme Sistemi</b><br/>
  <i>Advanced, Portable, and Zero-Dependency YouTube Automation & Downloader System</i>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Platform-Windows%20%7C%20Linux%20%7C%20macOS-blue?style=for-the-badge&logo=windows" alt="Platform Support" />
  <img src="https://img.shields.io/badge/Version-v4.13.3-purple?style=for-the-badge&logo=git" alt="Version" />
  <img src="https://img.shields.io/badge/License-MIT-green?style=for-the-badge" alt="License" />
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Vanilla_JS-ES6+-yellow?style=flat-square&logo=javascript" alt="JavaScript" />
  <img src="https://img.shields.io/badge/Node.js-Gömülü_/_Portable-green?style=flat-square&logo=node.js" alt="Node.js" />
  <img src="https://img.shields.io/badge/yt--dlp-Pre--packaged-red?style=flat-square&logo=youtube" alt="yt-dlp" />
  <img src="https://img.shields.io/badge/FFmpeg-Included-orange?style=flat-square" alt="FFmpeg" />
</p>

---

A premium, lightweight, and cross-platform automation software that automatically monitors YouTube channels via RSS feeds and downloads new videos in the background. Built entirely in vanilla JavaScript, CSS, and HTML5.

---

## 🚀 Key Features

* **Zero-Dependency Startup:** No need to run `npm install` or download external binaries. The repository comes fully pre-packaged with all required libraries (`node_modules/`) and `yt-dlp` (`yt-dlp/`). If `ffmpeg` is missing in `ffmpeg/`, the software automatically falls back to single-stream download mode (which does not require FFmpeg), and works fully out of the box. To enable high-quality separate video & audio stream merging (1080p+), simply drop `ffmpeg.exe` and `ffprobe.exe` into the `ffmpeg/` folder.
* **Automated Channel Tracking:** Continuously monitors channels for new videos using RSS feeds and fallback `yt-dlp` mechanisms.
* **Smart Queue Manager:** Downloads videos sequentially, prevents conflicts, and automatically resumes interrupted downloads on startup.
* **Alternative Speed Limits (qBittorrent-Style Turtle Toggle):** Toggle between a normal speed limit profile and an alternative (turtle) speed profile. Extremely useful for saving bandwidth during active usage.
* **System Tray Integration (`HaYTooL YT Downloader.exe`):** Windows version starts the Node server silently in the background (no black CMD window) with a system tray icon. Right-clicking provides direct navigation to pages (/home, /download, /downlist, /channels, /settings), toggles the alternative speed limit, restarts the server, or exits.
* **Interactive Terminal Console:** C# Tray Log/Terminal window includes an interactive input field at the bottom. You can pipe control commands directly to Node's standard input (`ton`, `toff`, `status`, `pd <link>`).
* **Log Auto-Cleanup:** Automatically deletes log files older than 7 days from the `logs/` directory at startup to keep the project clean.
* **Floating Non-Blocking Player:** Embedded Plyr modal has no screen-blocking backdrop, allowing you to browse/scroll other tabs while watching. Clicking a new video instantly plays it in the player.
* **100% Offline Access:** Lucide, Plyr JS, and Plyr CSS libraries are served locally, ensuring the UI works fully without an active internet connection.
* **Dual-Boot Loss Protection:** Detects if completed files are missing on disk and flags them as `fileMissing: true` without changing history records to `ignored`. Auto-heals records on startup if files reappear.

---

## 🛠️ Installation & Running

Since all dependencies (`node_modules/`, `yt-dlp`, `ffmpeg`) are already pre-packaged in the repository, you can run the application immediately after downloading.

### Windows:
Double-click `HaYTooL YT Downloader.exe` in the root folder. It starts the application silently in the system tray and automatically opens the web interface.

### Linux / macOS (Unix):
1. **Make Launcher Executable:**
   ```bash
   chmod +x baslat.sh
   ```
2. **Start the Application:**
   ```bash
   ./baslat.sh
   ```

Access the dashboard at [http://localhost:4141](http://localhost:4141) (default port can be changed in Settings).

---

## 🎹 Embedded Video Player Keyboard Shortcuts

When the embedded video player modal is open, you can use standard YouTube keyboard shortcuts to control playback:

* **`Space`** or **`k` / `K`**: Toggle play and pause (e.g. Pause a video instantly).
* **`f` / `F`**: Toggle full screen mode.
* **`m` / `M`**: Toggle mute/unmute audio.
* **`Arrow Right`**: Skip forward 5 seconds.
* **`Arrow Left`**: Skip backward 5 seconds.
* **`l` / `L`**: Skip forward 10 seconds.
* **`j` / `J`**: Skip backward 10 seconds.
* **`Arrow Up`**: Increase volume by 5%.
* **`Arrow Down`**: Decrease volume by 5%.
* **`Home`**: Jump to the beginning of the video.
* **`End`**: Jump to the end of the video.
* **`>`** or **`Shift + .`**: Increase playback speed (Cycles through: 0.5x, 0.75x, 1x, 1.25x, 1.5x, 1.75x, 2x).
* **`<`** or **`Shift + ,`**: Decrease playback speed.
* **`0` to `9`** (Number keys): Seek to a specific percentage of the video duration (e.g. `5` jumps to 50% of the video).

---

## 💻 CLI & Console Commands

You can manage speed profiles, start downloads, and view application status directly using the backend executable from the command line, or through the Interactive Terminal Console in the Windows tray app:

### CLI Command Examples:
Run these commands from your terminal in the project directory:
* **Check Status:**
  * Windows: `"HaYTooL YT Downloader.exe" status`
  * Unix: `node server.js status`
* **Download Video (Paste & Download):**
  * Windows: `"HaYTooL YT Downloader.exe" pd https://www.youtube.com/watch?v=dQw4w9WgXcQ`
  * Unix: `node server.js pd https://www.youtube.com/watch?v=dQw4w9WgXcQ`
* **Enable Alternative Speed (Turtle Mode):**
  * Windows: `"HaYTooL YT Downloader.exe" ton`
  * Unix: `node server.js ton`
* **Disable Alternative Speed (Turtle Mode):**
  * Windows: `"HaYTooL YT Downloader.exe" toff`
  * Unix: `node server.js toff`

### Console Commands (from the Tray App window):
Type these commands in the textbox at the bottom of the "Show Console Output" window and press Enter (no prefix needed):
* `status` - Shows current speed limits and queue status in English.
* `ton` - Enables alternative speed limit (Turtle Mode).
* `toff` - Disables alternative speed limit (Turtle Mode).
* `pd <youtube-url>` - Queues the specified video for download.
* `clear` - Clears the terminal screen.
* `help` - Shows available commands list.

---

## 📂 Configuration Files (Dual-Boot Support)

The software dynamically isolates configuration parameters based on the host OS, making it safe to use the same directory in dual-boot environments (e.g., Windows & Linux):

* **`configwin.ini`:** Windows-specific parameters (download paths, ports, useAlternativeSpeed, alternativeSpeedLimit, etc.).
* **`configunix.ini`:** Linux/Unix-specific parameters.
* **`channels.ini`:** Shared channel lists and individual download settings.
* **`db.json`:** Shared database containing download history and queue state.

---

## 📞 Support & Feedback

📧 **korazhayto@gmail.com**

*Developer & Designer:* **HaYTo**

---
---

# <p align="center">🇹🇷 TR - HaYTooL YouTube Downloader (v4.13.3)</p>

YouTube kanallarını otomatik olarak izleyen ve bu kanallara yüklenen yeni videoları arka planda otomatik olarak indiren şık, hafif ve kararlı bir otomasyon sistemidir. Tamamen vanilla JavaScript, CSS ve HTML5 standartlarıyla geliştirilmiştir.

---

## 🚀 Öne Çıkan Özellikler

* **Sıfır Bağımlılık (Zero-Dependency):** `npm install` çalıştırmanıza veya harici binary dosyaları indirmenize gerek yoktur. Depo, tüm gerekli kütüphaneler (`node_modules/`) ve `yt-dlp` (`yt-dlp/`) ile önceden paketlenmiş olarak gelir; hemen çalıştırabilirsiniz. Eğer `ffmpeg` klasöründe `ffmpeg.exe` bulunamazsa, yazılım otomatik olarak birleştirmesiz tekil dosya indirme moduna (FFmpeg gerektirmez) geçer ve sıfır hata ile çalışmaya devam eder. En yüksek kalitede (1080p+) ses/video birleştirmeyi etkinleştirmek için `ffmpeg/` klasörüne `ffmpeg.exe` ve `ffprobe.exe` dosyalarını eklemeniz yeterlidir.
* **Otomatik Kanal İzleme:** RSS akışları veya yedek `yt-dlp` flat-playlist mekanizması ile kanalların yeni videolarını sürekli denetler.
* **Akıllı İndirme Kuyruğu:** Videoları sırayla indirir, çakışmaları engeller ve sunucu başlangıcında yarım kalan indirmeleri otomatik olarak kaldığı yerden sürdürür.
* **Alternatif Hız Profili (qBittorrent Tarzı Kaplumbağa):** Normal indirme hızı sınırı ile alternatif (kaplumbağa) indirme hız profili arasında geçiş yapabilirsiniz. Aktif internet kullanımı sırasında bant genişliğinden tasarruf etmek için idealdir.
* **Sistem Tepsisi Entegrasyonu (`HaYTooL YT Downloader.exe`):** Windows işletim sisteminde Node sunucusunu tamamen arka planda sessizce (siyah CMD penceresi olmadan) başlatır. Sağ tıklayarak sekmelere doğrudan gidebilir (/home, /download, /downlist, /channels, /settings), alternatif hız sınırını açıp kapatabilir, sistemi yeniden başlatabilir veya kapatabilirsiniz.
* **İnteraktif Terminal Konsolu:** Sistem tepsisindeki "Konsol Çıktısını Göster" penceresine eklenen komut giriş paneli sayesinde, doğrudan Node.js standart girdisine (`process.stdin`) komut gönderebilirsiniz. Desteklenen komutlar: `ton`, `toff`, `status`, `pd <link>`.
* **Otomatik Log Temizleme:** Sunucu her başlatıldığında `logs/` klasöründeki 7 günden eski log dosyalarını otomatik olarak temizler.
* **Kompakt ve Gömülü Video Oynatıcı:** Arka planı kapatmayan yüzen (floating) video oynatıcı ile sayfada gezinirken veya diğer videolara göz atarken izlemeye devam edebilirsiniz.
* **%100 Çevrimdışı Kullanım:** Lucide, Plyr JS ve CSS dosyaları yerel olarak sunulur; internet bağlantısı olmadığında dahi arayüz ve oynatıcı sorunsuz çalışır.
* **Çift Önyükleme (Dual-Boot) Dosya Koruma Sistemi:** Tamamlanmış videolar diskte bulunamadığında geçmiş kaydını bozmadan `fileMissing: true` bayrağı tanımlar. Dosya tekrar bulunduğunda otomatik onarır.

---

## 🛠️ Kurulum ve Çalıştırma

Tüm bağımlılıklar (`node_modules/`, `yt-dlp`, `ffmpeg`) halihazırda depo içerisinde mevcut olduğundan, indirdikten sonra doğrudan çalıştırabilirsiniz.

### Windows:
Kök dizindeki `HaYTooL YT Downloader.exe` dosyasına çift tıklayın. Sistem tepsisinde arka planda sessizce başlayacak ve web arayüzünü otomatik açacaktır.

### Linux / macOS (Unix):
1. **Çalıştırma İzni Verin:**
   ```bash
   chmod +x baslat.sh
   ```
2. **Uygulamayı Başlatın:**
   ```bash
   ./baslat.sh
   ```

Arayüze varsayılan olarak [http://localhost:4141](http://localhost:4141) adresinden erişebilirsiniz (varsayılan port Ayarlar'dan değiştirilebilir).

---

## 🎹 Gömülü Video Oynatıcı Klavye Kısayolları

Gömülü video oynatıcı açıkken, oynatımı kontrol etmek için standart YouTube klavye kısayollarını kullanabilirsiniz:

* **`Space` (Boşluk)** veya **`k` / `K`**: Oynat / Duraklat (Örn: Videoyu anında durdurur).
* **`f` / `F`**: Tam ekran moduna geç / çık.
* **`m` / `M`**: Sesi kapat / aç.
* **`Yön Tuşu Sağ`**: 5 saniye ileri sar.
* **`Yön Tuşu Sol`**: 5 saniye geri sar.
* **`l` / `L`**: 10 saniye ileri sar.
* **`j` / `J`**: 10 saniye geri sar.
* **`Yön Tuşu Yukarı`**: Sesi %5 artır.
* **`Yön Tuşu Aşağı`**: Sesi %5 azalt.
* **`Home`**: Videonun en başına git.
* **`End`**: Videonun en sonuna git.
* **`>`** veya **`Shift + .`**: Oynatma hızını artırır (Döngüsel: 0.5x, 0.75x, 1x, 1.25x, 1.5x, 1.75x, 2x).
* **`<`** veya **`Shift + ,`**: Oynatma hızını azaltır.
* **`0` - `9`** (Sayı tuşları): Videonun belirli bir yüzdesine atlar (Örn: `5` tuşu videonun %50'sine atlar).

---

## 💻 CLI ve Konsol Komutları

Uygulamanın hız limitlerini, indirmelerini ve durum bilgisini doğrudan terminalden veya Windows tepsi uygulamasının İnteraktif Konsol penceresinden yönetebilirsiniz:

### CLI Komut Örnekleri:
Proje dizininde terminalden çalıştırabileceğiniz komutlar (Windows için "HaYTooL YT Downloader.exe" kullanabilirsiniz, Linux/macOS için node server.js kullanabilirsiniz):
* **Durum Bilgisi Sorgulama:**
  * Windows: `"HaYTooL YT Downloader.exe" status`
  * Unix: `node server.js status`
* **Video İndirme (Paste & Download):**
  * Windows: `"HaYTooL YT Downloader.exe" pd https://www.youtube.com/watch?v=dQw4w9WgXcQ`
  * Unix: `node server.js pd https://www.youtube.com/watch?v=dQw4w9WgXcQ`
* **Alternatif Hızı Etkinleştir (Turtle Mode):**
  * Windows: `"HaYTooL YT Downloader.exe" ton`
  * Unix: `node server.js ton`
* **Alternatif Hızı Devre Dışı Bırak (Turtle Mode):**
  * Windows: `"HaYTooL YT Downloader.exe" toff`
  * Unix: `node server.js toff`

### Konsol Komutları (Tray Log Ekranından):
Tepsi simgesinden "Konsol Çıktısını Göster" dediğinizde açılan pencerenin altındaki metin kutusuna komut yazıp Enter'a basabilirsiniz (başında `HaYTooL YT Downloader.exe` veya `node` olmadan doğrudan):
* `status` - Durum bilgisini anlık İngilizce olarak loglar.
* `ton` - Alternatif hız sınırını (Turtle Mode) etkinleştirir.
* `toff` - Alternatif hız sınırını (Turtle Mode) devre dışı bırakır.
* `pd <youtube-url>` - Belirtilen videoyu hemen kuyruğa ekler.
* `clear` - Konsol ekranını temizler.
* `help` - Kullanılabilir komut listesini gösterir.

---

## 📂 Yapılandırma Dosyaları (Çift Önyükleme Desteği)

Yazılım, Windows ve Linux gibi çift önyüklemeli (dual-boot) sistemlerde aynı klasörden çalıştırıldığında yapılandırma çakışmalarını engellemek için ayarları işletim sistemine göre dinamik olarak ayırır:

* **`configwin.ini`:** Windows işletim sisteminde çalışırken kullanılan ayarlar dosyasıdır (hız limitleri, alternatif hız durumu, port ve indirme yolu).
* **`configunix.ini`:** Linux/macOS işletim sistemlerinde çalışırken kullanılan ayarlar dosyasıdır.
* **`channels.ini`:** İzlenen kanalların listesini ve kanala özel ayarları ortak tutar.
* **`db.json`:** İndirme geçmişi ve kuyruk verilerini tutan hafif yerel veritabanıdır.

---

## 📞 Destek ve Geri Bildirim

📧 **korazhayto@gmail.com**

*Geliştirici & Tasarımcı:* **HaYTo**
