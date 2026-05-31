# HaYTool Youtube Download (v4.4)

[![Platform Support](https://img.shields.io/badge/platform-Windows%20%7C%20Linux%20%7C%20macOS-blue.svg)](#)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Version](https://img.shields.io/badge/version-v4.4-purple.svg)](#)

A premium, lightweight, and cross-platform automation software that automatically monitors YouTube channels via RSS feeds and downloads new videos in the background. Built entirely in vanilla JavaScript, CSS, and HTML5.

---

## 🚀 Key Features

* **Automated Channel Tracking:** Continuously monitors channels for new videos using RSS feeds and fallback `yt-dlp` mechanisms.
* **Smart Queue Manager:** Downloads videos sequentially, prevents conflicts, and automatically resumes interrupted downloads on startup.
* **Single-Line Status Badges:** System status badges (quality, disk space, premium cookie test status, and connection) stay on a single line even on small screens.
* **Advanced Settings Panel:** Configure all system options across 4 clear vertical tabs: General, Download & Quality, Automation & RSS, and Cookie & Notification.
* **Embedded & System Player:** Watch downloaded videos using the embedded HTML5 player (Plyr) with progress memory, volume control via scroll wheel, or open them in your system's default media player (VLC, MPV, etc.).
* **Shorts Filtering:** Easily toggle the visibility of YouTube Shorts in your library or configure channel-specific settings to auto-download or ignore Shorts.
* **"PD" (Paste & Download):** Quick-paste any YouTube video link from your clipboard to analyze and add it directly to the download queue.
* **Zero Dependency Setup:** Automatically detects, downloads, and configures the latest binary dependencies (`yt-dlp` and `ffmpeg`) in the background on first run.

---

## 🛠️ Installation & Running

### Windows:
1. **Install Dependencies:**
   ```bash
   npm install
   ```
2. **Start the Application:**
   Double-click `Baslat.bat` in the root folder, or run:
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

## 📂 Configuration Files (Dual-Boot Support)

The software dynamically isolates configuration parameters based on the host OS, making it safe to use the same directory in dual-boot environments (e.g., Windows & CachyOS):

* **`configwin.ini`:** Windows-specific parameters (download paths, ports, etc.).
* **`configunix.ini`:** Linux/Unix-specific parameters.
* **`channels.ini`:** Shared channel lists and individual download settings.
* **`db.json`:** Shared database containing download history and queue state. This prevents duplicate downloads across different operating systems.

---

## 📞 Support & Feedback

If you encounter any issues or want to send feedback, feel free to reach out:
📧 **korazhayto@gmail.com**

*Developer & Designer:* **HaYTo**

---

<br>
<br>

# TR - HaYTool Youtube Download (v4.4)

YouTube kanallarını otomatik olarak izleyen ve bu kanallara yüklenen yeni videoları arka planda otomatik olarak indiren şık, hafif ve kararlı bir otomasyon sistemidir. Tamamen vanilla JavaScript, CSS ve HTML5 standartlarıyla geliştirilmiştir.

---

## 🚀 Öne Çıkan Özellikler

* **Otomatik Kanal İzleme:** RSS akışları veya yedek `yt-dlp` flat-playlist mekanizması ile kanalların yeni videolarını sürekli denetler.
* **Akıllı İndirme Kuyruğu:** Videoları sırayla indirir, çakışmaları engeller ve sunucu başlangıcında yarım kalan indirmeleri otomatik olarak kaldığı yerden sürdürür.
* **Tek Satır Durum Göstergeleri:** Kalite, çerez, disk alanı ve bağlantı gibi sistem durum rozetleri ekran daralsa dahi çift satıra kaymaz.
* **Gelişmiş Ayarlar Paneli:** Tüm yapılandırmalar dikey menülü 4 kolay kategoriye (Genel Ayarlar, İndirme ve Kalite, Otomasyon & RSS, Çerez & Bildirim) ayrılmıştır.
* **Gömülü ve Sistem Oynatıcısı:** Videoları tarayıcıda kaldığı yeri hatırlayan Plyr oynatıcıda (tekerlek ile ses ayarı destekli) veya bilgisayarınızın varsayılan oynatıcısında (VLC, KMPlayer vb.) tek tıkla izleyin.
* **Shorts Desteği:** Shorts videolarını filtreleyebilir, kütüphanede dikey tasarımda listeleyebilir ve kanala özel indirme kuralları belirleyebilirsiniz.
* **"PD" (Yapıştır & İndir):** Panodaki veya girilen herhangi bir YouTube video bağlantısını anında analiz edip indirme sırasına ekler.
* **Otomatik Bağımlılık Yönetimi:** `yt-dlp` ve `ffmpeg` gibi harici araçlar eksikse sistem başlangıcında arka planda otomatik olarak indirilir ve kurulur.

---

## 🛠️ Kurulum ve Çalıştırma

### Windows:
1. **Bağımlılıkları Yükleyin:**
   ```bash
   npm install
   ```
2. **Uygulamayı Başlatın:**
   Kök dizindeki `Baslat.bat` dosyasına çift tıklayarak veya terminalden:
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

## 📂 Yapılandırma Dosyaları (Çift Önyükleme Desteği)

Yazılım, Windows ve Linux (örn. CachyOS) gibi çift önyüklemeli (dual-boot) sistemlerde aynı klasörden çalıştırıldığında yapılandırma çakışmalarını (indirme klasörü konumu vb.) engellemek için ayarları işletim sistemine göre dinamik olarak ayırır:

* **`configwin.ini`:** Windows işletim sisteminde çalışırken kullanılan ayarlar dosyasıdır.
* **`configunix.ini`:** Linux/macOS işletim sistemlerinde çalışırken kullanılan ayarlar dosyasıdır.
* **`channels.ini`:** İzlenen kanalların listesini ve kanala özel ayarları ortak tutar.
* **`db.json`:** İndirme geçmişi ve kuyruk verilerini tutan hafif yerel veritabanıdır. Her iki işletim sisteminde de ortak kullanıldığı için mükerrer (çift) indirmeyi engeller.

---

## 📞 Destek ve Geri Bildirim

Herhangi bir hata bildirimi veya geri bildirim için iletişim adresi:
📧 **korazhayto@gmail.com**

*Geliştirici & Tasarımcı:* **HaYTo**
