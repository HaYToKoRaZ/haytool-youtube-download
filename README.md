# HaYTooL YouTube Downloader (v4.11.0)

[![Platform Support](https://img.shields.io/badge/platform-Windows%20%7C%20Linux%20%7C%20macOS-blue.svg)](#)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Version](https://img.shields.io/badge/version-v4.11.0-purple.svg)](#)

A premium, lightweight, and cross-platform automation software that automatically monitors YouTube channels via RSS feeds and downloads new videos in the background. Built entirely in vanilla JavaScript, CSS, and HTML5.

---

## 🚀 Key Features

* **Zero-Dependency Startup:** No need to run `npm install` or download external binaries. The repository comes fully pre-packaged with all required libraries (`node_modules/`), `yt-dlp` (`yt-dlp/`), and `ffmpeg` (`ffmpeg/`) binaries for immediate out-of-the-box use.
* **Automated Channel Tracking:** Continuously monitors channels for new videos using RSS feeds and fallback `yt-dlp` mechanisms.
* **Smart Queue Manager:** Downloads videos sequentially, prevents conflicts, and automatically resumes interrupted downloads on startup.
* **Alternative Speed Limits (qBittorrent-Style Turtle Toggle):** Toggle between a normal speed limit profile and an alternative (turtle) speed profile. Extremely useful for saving bandwidth during active usage.
* **System Tray Integration (`HaYTooL YT Downloader.exe`):** Windows version starts the Node server silently in the background (no black CMD window) with a system tray icon. Right-clicking provides direct navigation to pages (/home, /download, /downlist, /channels, /settings), toggles the alternative speed limit, restarts the server, or exits.
* **Interactive Terminal Console:** C# Tray Log/Terminal window includes an interactive input field at the bottom. You can pipe control commands directly to Node's standard input (`speed <val>`, `altspeed <val>`, `toggle`, `status`).
* **Log Auto-Cleanup:** Automatically deletes log files older than 7 days from the `logs/` directory at startup to keep the project clean.
* **Floating Non-Blocking Player:** Embedded Plyr modal has no screen-blocking backdrop, allowing you to browse/scroll other tabs while watching. Clicking a new video instantly plays it in the player.
* **100% Offline Access:** Lucide, Plyr JS, and Plyr CSS libraries are served locally, ensuring the UI works fully without an active internet connection.
* **Dual-Boot Loss Protection:** Detects if completed files are missing on disk and flags them as `fileMissing: true` without changing history records to `ignored`. Auto-heals records on startup if files reappear.

---

## 🛠️ Installation & Running

Since all dependencies (`node_modules/`, `yt-dlp`, `ffmpeg`) are already pre-packaged in the repository, you can run the application immediately after downloading.

### Windows:
Double-click `HaYTooL YT Downloader.exe` in the root folder. It starts the application silently in the system tray and automatically opens the web interface.
To run in standard terminal mode:
```bash
npm start
```

### Linux / macOS (Unix):
1. **Make Launcher Executable:**
   ```bash
   chmod +x baslat.sh
   ```
2. **Start the Application:**
   ```bash
   ./baslat.sh
   ```

Access the dashboard at [http://localhost:3000](http://localhost:3000) (default port can be changed in Settings).

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

You can manage speed limits, start downloads, and view application status directly using `HaYTooL YT Downloader.exe` from the command line, or through the Interactive Terminal Console in the Windows tray app:

### CLI Command Examples:
Run these commands from your terminal in the project directory (Windows uses `HaYTooL YT Downloader.exe`, Unix uses `node server.js`):

* **Check Status:**
  * Windows: `.\bin\HaYTool-Backend.exe server.js status`
  * Unix: `node server.js status`
  * *Output shows normal limit, alternative limit, turtle mode status, and active limit.*
* **Download Video (Paste & Download):**
  * Windows: `.\bin\HaYTool-Backend.exe server.js pd https://www.youtube.com/watch?v=dQw4w9WgXcQ`
  * *Instantly queues and starts downloading the specified video.*
* **Set Normal Speed Limit:**
  * Windows: `.\bin\HaYTool-Backend.exe server.js speed 2500` (Sets speed limit to 2500 KB/s)
  * Unix: `node server.js speed 1500` (Sets speed limit to 1500 KB/s)
* **Disable/Enable Normal Limit:**
  * Windows: `.\bin\HaYTool-Backend.exe server.js speed off` (Removes limits, makes it unlimited)
  * Windows: `.\bin\HaYTool-Backend.exe server.js speed on` (Restores last active limit)
* **Set Alternative Speed Limit Value:**
  * Windows: `.\bin\HaYTool-Backend.exe server.js altspeed 500` (Sets alternative limit to 500 KB/s)
* **Turtle Mode Direct Safe Controls (Definite State Change):**
  * Windows: `.\bin\HaYTool-Backend.exe server.js turtleon` (Forces turtle mode active)
  * Windows: `.\bin\HaYTool-Backend.exe server.js turtleoff` (Forces turtle mode inactive)
* **Alternative Speed Profile Status Toggle/Change:**
  * Windows: `.\bin\HaYTool-Backend.exe server.js toggle` (Toggles alternative speed mode status)

### Console Commands (from the Tray App window):
Type these commands in the textbox at the bottom of the "Konsol Çıktısını Göster" window and press Enter (no prefix needed):
* `status` - Shows current status.
* `speed 2500` - Sets normal limit to 2500 KB/s.
* `speed on` / `speed off` - Enables or disables limit.
* `turtleon` / `turtleoff` - Definitely enables or disables turtle mode.
* `altspeed 500` - Sets alternative limit to 500 KB/s.
* `altspeed on` / `altspeed off` - Forces alternative speed profile.
* `toggle` - Toggles alternative speed profile.

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

# TR - HaYTooL YouTube Downloader (v4.11.0)

YouTube kanallarını otomatik olarak izleyen ve bu kanallara yüklenen yeni videoları arka planda otomatik olarak indiren şık, hafif ve kararlı bir otomasyon sistemidir. Tamamen vanilla JavaScript, CSS ve HTML5 standartlarıyla geliştirilmiştir.

---

## 🚀 Öne Çıkan Özellikler

* **Sıfır Bağımlılık (Zero-Dependency):** `npm install` çalıştırmanıza veya harici binary dosyaları indirmenize gerek yoktur. Depo, tüm gerekli kütüphaneler (`node_modules/`), `yt-dlp` (`yt-dlp/`) ve `ffmpeg` (`ffmpeg/`) binary dosyaları ile önceden paketlenmiş olarak gelir; hemen çalıştırabilirsiniz.
* **Otomatik Kanal İzleme:** RSS akışları veya yedek `yt-dlp` flat-playlist mekanizması ile kanalların yeni videolarını sürekli denetler.
* **Akıllı İndirme Kuyruğu:** Videoları sırayla indirir, çakışmaları engeller ve sunucu başlangıcında yarım kalan indirmeleri otomatik olarak kaldığı yerden sürdürür.
* **Alternatif Hız Profili (qBittorrent Tarzı Kaplumbağa):** Normal indirme hızı sınırı ile alternatif (kaplumbağa) indirme hız profili arasında geçiş yapabilirsiniz. Aktif internet kullanımı sırasında bant genişliğinden tasarruf etmek için idealdir.
* **Sistem Tepsisi Entegrasyonu (`HaYTooL YT Downloader.exe`):** Windows işletim sisteminde Node sunucusunu tamamen arka planda sessizce (siyah CMD penceresi olmadan) başlatır. Sağ tıklayarak sekmelere doğrudan gidebilir (/home, /download, /downlist, /channels, /settings), alternatif hız sınırını açıp kapatabilir, sistemi yeniden başlatabilir veya kapatabilirsiniz.
* **İnteraktif Terminal Konsolu:** Sistem tepsisindeki "Konsol Çıktısını Göster" penceresine eklenen komut giriş paneli sayesinde, doğrudan Node.js standart girdisine (`process.stdin`) komut gönderebilirsiniz. Desteklenen komutlar: `speed <değer>`, `altspeed <değer>`, `toggle`, `status`.
* **Otomatik Log Temizleme:** Sunucu her başlatıldığında `logs/` klasöründeki 7 günden eski log dosyalarını otomatik olarak temizler.
* **Kompakt ve Gömülü Video Oynatıcı:** Arka planı kapatmayan yüzen (floating) video oynatıcı ile sayfada gezinirken veya diğer videolara göz atarken izlemeye devam edebilirsiniz.
* **%100 Çevrimdışı Kullanım:** Lucide, Plyr JS ve CSS dosyaları yerel olarak sunulur; internet bağlantısı olmadığında dahi arayüz ve oynatıcı sorunsuz çalışır.
* **Çift Önyükleme (Dual-Boot) Dosya Koruma Sistemi:** Tamamlanmış videolar diskte bulunamadığında geçmiş kaydını bozmadan `fileMissing: true` bayrağı tanımlar. Dosya tekrar bulunduğunda otomatik onarır.

---

## 🛠️ Kurulum ve Çalıştırma

Tüm bağımlılıklar (`node_modules/`, `yt-dlp`, `ffmpeg`) halihazırda depo içerisinde mevcut olduğundan, indirdikten sonra doğrudan çalıştırabilirsiniz.

### Windows:
Kök dizindeki `HaYTooL YT Downloader.exe` dosyasına çift tıklayın. Sistem tepsisinde arka planda sessizce başlayacak ve web arayüzünü otomatik açacaktır.
Konsol modunda çalıştırmak için:
```bash
npm start
```

### Linux / macOS (Unix):
1. **Çalıştırma İzni Verin:**
   ```bash
   chmod +x baslat.sh
   ```
2. **Uygulamayı Başlatın:**
   ```bash
   ./baslat.sh
   ```

Arayüze varsayılan olarak [http://localhost:3000](http://localhost:3000) adresinden erişebilirsiniz.

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

Uygulamanın hız limitlerini, indirmelerini ve durum bilgisini doğrudan terminalden `HaYTooL YT Downloader.exe` yardımıyla (CLI) veya Windows tepsi uygulamasının İnteraktif Konsol penceresinden yönetebilirsiniz:

### CLI Komut Örnekleri:
Proje dizininde terminalden çalıştırabileceğiniz komutlar (Windows için `bin\HaYTool-Backend.exe server.js` kullanabilirsiniz, Linux/macOS için `node server.js` kullanabilirsiniz):

* **Durum Bilgisi Sorgulama:**
  * Windows: `.\bin\HaYTool-Backend.exe server.js status`
  * Unix: `node server.js status`
  * *Çıktıda normal limit, alternatif limit, kaplumbağa modu durumu ve etkin hız sınırı gösterilir.*
* **Video İndirme (Paste & Download):**
  * Windows: `.\bin\HaYTool-Backend.exe server.js pd https://www.youtube.com/watch?v=dQw4w9WgXcQ`
  * *Belirtilen videoyu hemen kuyruğa ekler ve indirmeyi başlatır.*
* **Normal Hız Sınırı Belirleme:**
  * Windows: `.\bin\HaYTool-Backend.exe server.js speed 2500` (Hız limitini 2500 KB/s yapar)
  * Unix: `node server.js speed 1500` (Hız limitini 1500 KB/s yapar)
* **Normal Hız Sınırını Açma/Kapatma:**
  * Windows: `.\bin\HaYTool-Backend.exe server.js speed off` (Limit kapatılır - sınırsız indirme)
  * Windows: `.\bin\HaYTool-Backend.exe server.js speed on` (Limit son aktif değerine açılır)
* **Alternatif Hız Değeri Belirleme:**
  * Windows: `.\bin\HaYTool-Backend.exe server.js altspeed 500` (Alternatif hızı 500 KB/s yapar)
* **Kaplumbağa Modu Kesin Durum Komutları (Güvenli):**
  * Windows: `.\bin\HaYTool-Backend.exe server.js turtleon` (Kaplumbağa modunu kesin etkinleştirir)
  * Windows: `.\bin\HaYTool-Backend.exe server.js turtleoff` (Kaplumbağa modunu kesin kapatır)
* **Alternatif Hız Profil Durumu Toggle / Değiştirme:**
  * Windows: `.\bin\HaYTool-Backend.exe server.js toggle` (Mevcut kaplumbağa modunu tersine çevirir)

### Konsol Komutları (Tray Log Ekranından):
Tepsi simgesinden "Konsol Çıktısını Göster" dediğinizde açılan pencerenin altındaki metin kutusuna komut yazıp Enter'a basabilirsiniz (başında `HaYTooL YT Downloader.exe` veya `node` olmadan doğrudan):
* `status` - Durum bilgisini anlık loglar.
* `speed 2500` - Normal hızı 2500 KB/s olarak ayarlar.
* `speed on` / `speed off` - Hız limitini açar veya kapatır.
* `turtleon` / `turtleoff` - Kaplumbağa modunu kesin olarak açar veya kapatır.
* `altspeed 500` - Alternatif hız sınırını 500 KB/s olarak ayarlar.
* `altspeed on` / `altspeed off` - Alternatif hız modunu kesin olarak açar veya kapatır.
* `toggle` - Alternatif hız sınır profilini tersine çevirir (toggle).

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
