# HaYTool Youtube Download (v4.8.0)

[![Platform Support](https://img.shields.io/badge/platform-Windows%20%7C%20Linux%20%7C%20macOS-blue.svg)](#)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Version](https://img.shields.io/badge/version-v4.8.0-purple.svg)](#)

A premium, lightweight, and cross-platform automation software that automatically monitors YouTube channels via RSS feeds and downloads new videos in the background. Built entirely in vanilla JavaScript, CSS, and HTML5.

---

## 🚀 Key Features

* **Automated Channel Tracking:** Continuously monitors channels for new videos using RSS feeds and fallback `yt-dlp` mechanisms.
* **Smart Queue Manager:** Downloads videos sequentially, prevents conflicts, and automatically resumes interrupted downloads on startup.
* **Alternative Speed Limits (qBittorrent-Style Turtle Toggle):** Toggle between a normal speed limit profile and an alternative (turtle) speed profile. Extremely useful for saving bandwidth during active usage.
* **System Tray Integration (`HaYTool.exe`):** Windows version starts the Node server silently in the background (no black CMD window) with a system tray icon. Right-clicking provides direct navigation to pages (/home, /download, /downlist, /channels, /settings), toggles the alternative speed limit, restarts the server, or exits.
* **Interactive Terminal Console:** C# Tray Log/Terminal window includes an interactive input field at the bottom. You can pipe control commands directly to Node's standard input (`speed <val>`, `altspeed <val>`, `toggle`, `status`).
* **Log Auto-Cleanup:** Automatically deletes log files older than 7 days from the `logs/` directory at startup to keep the project clean.
* **Floating Non-Blocking Player:** Embedded Plyr modal has no screen-blocking backdrop, allowing you to browse/scroll other tabs while watching. Clicking a new video instantly plays it in the player.
* **100% Offline Access:** Lucide, Plyr JS, and Plyr CSS libraries are served locally, ensuring the UI works fully without an active internet connection.
* **Dual-Boot Loss Protection:** Detects if completed files are missing on disk and flags them as `fileMissing: true` without changing history records to `ignored`. Auto-heals records on startup if files reappear.
* **Zero Dependency Setup:** Automatically detects, downloads, and configures the latest binary dependencies (`yt-dlp` and `ffmpeg`) in the background on first run.

---

## 🛠️ Installation & Running

### Windows:
1. **Install Dependencies:**
   ```bash
   npm install
   ```
2. **Start the Application:**
   Double-click `HaYTool.exe` in the root folder. It starts the application silently in the system tray and automatically opens the web interface.
   To run in standard terminal mode:
   ```bash
   npm start
   ```

### Linux / macOS (Unix):
1. **Install Dependencies:**
   ```bash
   npm install
   ```
2. **Make Launcher Executable:**
   ```bash
   chmod +x baslat.sh
   ```
3. **Start the Application:**
   ```bash
   ./baslat.sh
   ```

Access the dashboard at [http://localhost:3000](http://localhost:3000) (default port can be changed in Settings).

---

## 💻 CLI & Console Commands

You can manage speed limits, start downloads, and view application status directly using `hayto`, `haytool`, or `HaYTool.exe` from the command line, or through the Interactive Terminal Console in the Windows tray app:

### CLI Commands:
Run these commands from your terminal in the project directory (use `hayto` or `haytool` on Windows, or `node server.js` on Linux/macOS):

* **Check Status:**
  * `hayto status` (or `haytool status`)
* **Download Video (Paste & Download):**
  * `hayto pd https://www.youtube.com/watch?v=dQw4w9WgXcQ` (Starts download for the link)
  * `haytool pd https://www.youtube.com/watch?v=dQw4w9WgXcQ` (Starts download for the link)
* **Set Normal Speed Limit:**
  * `hayto speed 2500` (Sets speed limit to 2500 KB/s)
  * `hayto limit 1500` (Sets speed limit to 1500 KB/s)
* **Disable/Enable Normal Limit:**
  * `hayto speed off` (Disables limit, makes it unlimited)
  * `hayto speed on` (Enables limit, restores the last active limit)
  * `hayto speed ac` (Enables limit)
  * `hayto speed kapat` (Disables limit)
* **Set Alternative Speed Limit Value:**
  * `hayto altspeed 500` (Sets alternative limit to 500 KB/s)
  * `hayto turtle 500` (Sets alternative limit to 500 KB/s)
* **Turtle Mode Direct Safe Controls (Definite State Change):**
  * `hayto turtleon` (Definitely enables turtle mode)
  * `hayto turtleoff` (Definitely disables turtle mode)
  * `hayto turtleac` (Definitely enables turtle mode)
  * `hayto turtlekapat` (Definitely disables turtle mode)
* **Alternative Speed Profile Status Toggle/Change:**
  * `hayto toggle` (Toggles alternative speed mode status)
  * `hayto altspeed on` (Forces alternative speed profile active)
  * `hayto altspeed off` (Forces alternative speed profile inactive)

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

If you encounter any issues or want to send feedback, feel free to reach out:
📧 **korazhayto@gmail.com**

*Developer & Designer:* **HaYTo**

---

<br>
<br>

# TR - HaYTool Youtube Download (v4.8.0)

YouTube kanallarını otomatik olarak izleyen ve bu kanallara yüklenen yeni videoları arka planda otomatik olarak indiren şık, hafif ve kararlı bir otomasyon sistemidir. Tamamen vanilla JavaScript, CSS ve HTML5 standartlarıyla geliştirilmiştir.

---

## 🚀 Öne Çıkan Özellikler

* **Otomatik Kanal İzleme:** RSS akışları veya yedek `yt-dlp` flat-playlist mekanizması ile kanalların yeni videolarını sürekli denetler.
* **Akıllı İndirme Kuyruğu:** Videoları sırayla indirir, çakışmaları engeller ve sunucu başlangıcında yarım kalan indirmeleri otomatik olarak kaldığı yerden sürdürür.
* **Alternatif Hız Profili (qBittorrent Tarzı Kaplumbağa):** Normal indirme hızı sınırı ile alternatif (kaplumbağa) indirme hız profili arasında geçiş yapabilirsiniz. Aktif internet kullanımı sırasında bant genişliğinden tasarruf etmek için idealdir.
* **Sistem Tepsisi Entegrasyonu (`HaYTool.exe`):** Windows işletim sisteminde Node sunucusunu tamamen arka planda sessizce (siyah CMD penceresi olmadan) başlatır. Sağ tıklayarak sekmelere doğrudan gidebilir (/home, /download, /downlist, /channels, /settings), alternatif hız sınırını açıp kapatabilir, sistemi yeniden başlatabilir veya kapatabilirsiniz.
* **İnteraktif Terminal Konsolu:** Sistem tepsisindeki "Konsol Çıktısını Göster" penceresine eklenen komut giriş paneli sayesinde, doğrudan Node.js standart girdisine (`process.stdin`) komut gönderebilirsiniz. Desteklenen komutlar: `speed <değer>`, `altspeed <değer>`, `toggle`, `status`.
* **Otomatik Log Temizleme:** Sunucu her başlatıldığında `logs/` klasöründeki 7 günden eski log dosyalarını otomatik olarak temizler.
* **Kompakt ve Gömülü Video Oynatıcı:** Arka planı kapatmayan yüzen (floating) video oynatıcı ile sayfada gezinirken veya diğer videolara göz atarken izlemeye devam edebilirsiniz.
* **%100 Çevrimdışı Kullanım:** Lucide, Plyr JS ve CSS dosyaları yerel olarak sunulur; internet bağlantısı olmadığında dahi arayüz ve oynatıcı sorunsuz çalışır.
* **Çift Önyükleme (Dual-Boot) Dosya Koruma Sistemi:** Tamamlanmış videolar diskte bulunamadığında geçmiş kaydını bozmadan `fileMissing: true` bayrağı tanımlar. Dosya tekrar bulunduğunda otomatik onarır.
* **Otomatik Bağımlılık Yönetimi:** İlgili harici araçlar (`yt-dlp` ve `ffmpeg`) eksikse sistem başlangıcında arka planda otomatik olarak indirilir ve kurulur.

---

## 🛠️ Kurulum ve Çalıştırma

### Windows:
1. **Bağımlılıkları Yükleyin:**
   ```bash
   npm install
   ```
2. **Uygulamayı Başlatın:**
   Kök dizindeki `HaYTool.exe` dosyasına çift tıklayın. Sistem tepsisinde arka planda sessizce başlayacak ve web arayüzünü otomatik açacaktır.
   Konsol modunda çalıştırmak için:
   ```bash
   npm start
   ```

### Linux / macOS (Unix):
1. **Bağımlılıkları Yükleyin:**
   ```bash
   npm install
   ```
2. **Çalıştırma İzni Verin:**
   ```bash
   chmod +x baslat.sh
   ```
3. **Uygulamayı Başlatın:**
   ```bash
   ./baslat.sh
   ```

Arayüze varsayılan olarak [http://localhost:3000](http://localhost:3000) adresinden erişebilirsiniz.

---

## 💻 CLI ve Konsol Komutları

Uygulamanın hız limitlerini, indirmelerini ve durum bilgisini doğrudan terminalden `hayto`, `haytool` veya `HaYTool.exe` yardımıyla (CLI) veya Windows tepsi uygulamasının İnteraktif Konsol penceresinden yönetebilirsiniz:

### CLI Komutları:
Proje dizininde terminalden çalıştırabileceğiniz komutlar (Windows için `hayto` veya `haytool` kullanabilirsiniz, Linux/macOS için `node server.js` kullanabilirsiniz):

* **Durum Bilgisi Sorgulama:**
  * `hayto status` (veya `haytool status`)
* **Video İndirme (Paste & Download):**
  * `hayto pd https://www.youtube.com/watch?v=dQw4w9WgXcQ` (Belirtilen videoyu hemen kuyruğa ekler ve indirmeyi başlatır)
  * `haytool pd https://www.youtube.com/watch?v=dQw4w9WgXcQ` (Belirtilen videoyu hemen kuyruğa ekler ve indirmeyi başlatır)
* **Normal Hız Sınırı Belirleme:**
  * `hayto speed 2500` (Hız limitini 2500 KB/s yapar)
  * `hayto limit 1500` (Hız limitini 1500 KB/s yapar)
* **Normal Hız Sınırını Açma/Kapatma:**
  * `hayto speed off` (Limit kapatılır - sınırsız indirme)
  * `hayto speed on` (Limit son aktif değerine açılır)
  * `hayto speed ac` (Limit açılır)
  * `hayto speed kapat` (Limit kapatılır)
* **Alternatif Hız Değeri Belirleme:**
  * `hayto altspeed 500` (Alternatif hız limitini 500 KB/s yapar)
  * `hayto turtle 500` (Alternatif hız limitini 500 KB/s yapar)
* **Kaplumbağa Modu Kesin Durum Komutları (Güvenli):**
  * `hayto turtleon` (Kaplumbağa modunu kesin olarak etkinleştirir)
  * `hayto turtleoff` (Kaplumbağa modunu kesin olarak devre dışı bırakır)
  * `hayto turtleac` (Kaplumbağa modunu kesin olarak etkinleştirir)
  * `hayto turtlekapat` (Kaplumbağa modunu kesin olarak devre dışı bırakır)
* **Alternatif Hız Profil Durumu Toggle / Değiştirme:**
  * `hayto toggle` (Mevcut kaplumbağa modunu tersine çevirir)
  * `hayto altspeed on` (Alternatif hız profilini kesin açar)
  * `hayto altspeed off` (Alternatif hız profilini kesin kapatır)

### Konsol Komutları (Tray Log Ekranından):
Tepsi simgesinden "Konsol Çıktısını Göster" dediğinizde açılan pencerenin altındaki metin kutusuna komut yazıp Enter'a basabilirsiniz (başında `HaYTool.exe` veya `node` olmadan doğrudan):
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

Herhangi bir hata bildirimi veya geri bildirim için iletişim adresi:
📧 **korazhayto@gmail.com**

*Geliştirici & Tasarımcı:* **HaYTo**
