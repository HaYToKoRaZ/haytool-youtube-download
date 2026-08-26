<p align="center">
  <img src="public/logo.png" alt="HaYTooL Logo" width="120" style="border-radius: 20px; box-shadow: 0 8px 16px rgba(0,0,0,0.3);"/>
</p>

# <p align="center">📥 HaYTooL - Personal YouTube Library & Automation System (v9.8.11)</p>

<p align="center">
  <b>Reclaim Your Feed: An Advanced, Portable, and Zero-Dependency YouTube Automation System</b><br/>
  <i>Algoritma Dayatmalarından Kurtulun: Gelişmiş, Taşınabilir ve Otomatik YouTube Takip & İndirme Sistemi</i>
</p>

<p align="center">
  <a href="#-english-version"><b>🇬🇧 English Version</b></a> | <a href="#-türkçe-versiyon"><b>🇹🇷 Türkçe Versiyon</b></a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Platform-Windows%20%7C%20Linux%20%7C%20macOS-blue?style=for-the-badge&logo=windows" alt="Platform Support" />
  <img src="https://img.shields.io/badge/Version-v9.8.11-purple?style=for-the-badge&logo=git" alt="Version" />
  <img src="https://img.shields.io/badge/License-MIT-green?style=for-the-badge" alt="License" />
  <img src="https://img.shields.io/github/downloads/HaYToKoRaZ/haytool-youtube-download/latest/total?style=for-the-badge&color=blueviolet" alt="GitHub Downloads (latest release)" />
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Vanilla_JS-ES6+-yellow?style=flat-square&logo=javascript" alt="JavaScript" />
  <img src="https://img.shields.io/badge/Node.js-Gömülü_/_Portable-green?style=flat-square&logo=node.js" alt="Node.js" />
  <img src="https://img.shields.io/badge/yt--dlp-Pre--packaged-red?style=flat-square&logo=youtube" alt="yt-dlp" />
  <img src="https://img.shields.io/badge/FFmpeg-Included-orange?style=flat-square" alt="FFmpeg" />
</p>

---
---

# 🇬🇧 English Version

## 🎯 Core Philosophy

YouTube's recommendation algorithms are designed to maximize watch time by pushing distracting, addictive, and unwanted content to your feed. **HaYTooL** is built to break this cycle. 
Instead of logging into YouTube and exposing your data to ads and algorithmic traps, **HaYTooL** acts as your private offline library. You define the exact channels you want to follow. The system continuously runs in the background, monitors their RSS feeds, and automatically downloads new videos as soon as they are uploaded. You watch your chosen content locally, 100% ad-free, offline, and entirely on your own terms.

---

<p align="center">
  <b>📸 Application Screenshots</b>
</p>
<p align="center">
  <img src="screenshots/en-libry.png" width="48%" alt="Library (Home) Page" />
  <img src="screenshots/en-downlist.png" width="48%" alt="Inline Player & Downloaded Page" />
</p>
<p align="center">
  <img src="screenshots/en-queue.png" width="31%" alt="Download Queue" />
  <img src="screenshots/en-channels.png" width="31%" alt="Followed Channels" />
  <img src="screenshots/en-setting.png" width="31%" alt="Settings Panel" />
</p>

---

## 🚀 Key Features

* **Background Subscription Automation:** Periodically checks your followed channels via RSS feeds. Downloads new videos automatically the second they are uploaded, creating an offline, local cache of your subscription box.
* **Algorithmic Liberation:** No distraction, no "Up Next" traps, and no algorithmic rabbit holes. You only see the videos published by the creators you specifically subscribed to.
* **100% Ad-Free Local Playback:** Plays downloaded videos locally inside a custom dashboard using premium players (Artplayer, Plyr, or HTML5) with full seeking, speed control, and orientation-aware resizing.
* **SponsorBlock Integration:** Automatically skips sponsor segments, intros, outros, and subscription reminders. Includes a session-based shield toggle button under the player and dimmed segments on the timeline.
* **Advanced Subtitles & Translation:** Automatically grabs English/Turkish subtitles. Features a translation utility supporting 11 target languages with a visual loading overlay, along with customizable subtitle styling (12 colors, 12 background opacities, 13 font sizes).
* **YouTube-Style Split Playlist View:** The "Downloads" tab features a dual-column layout. Watch the active video on the left while browsing your other downloads in a sidebar playlist on the right, supporting autoplay (sequential video playback) and status HUD overlays.
* **Per-Channel Download Rules:** Customize download preferences for each channel individually: toggle auto-download, set duration filters, and allow/restrict downloading vertical YouTube Shorts.
* **Windows System Tray & Interactive Terminal Console:** Runs silently in the background with a Windows Tray Icon. Right-click to navigate, toggle speed limits, or control Discord activity. The console window features a command input field piping stdin controls directly (`ton`, `toff`, `status`, `pd <link>`).
* **Single-Instance Mutex Lock:** Prevents running multiple application processes. Launching a second instance prompts an alert, opens the active dashboard in your browser, and exits.
* **Discord Rich Presence (RPC):** Integrates directly with Discord using Windows Named Pipe IPC to display the watched video's channel name on the `details` line and the video title as the `state`. Can be toggled in settings and tray.
* **Dual-Boot isolated Configs:** Isolates OS-specific parameters (`configwin.ini` / `configunix.ini`). Prevents file loss on dual-boot setups; missing files are flagged as `fileMissing: true` and automatically restored if they reappear without breaking DB history.
* **Zero-Dependency Startup:** Pre-packaged with `node_modules/`, `yt-dlp/`, and `ffmpeg/`. Works fully out of the box without external setups.
* **APE Tool (Mark as Watched):** Paste any video or channel link to instantly mark videos as watched/hidden in your library and sync them to your real YouTube watch history. Works for followed channels, previously downloaded channels, and even completely foreign channels (fetches the last N videos and marks them in the background, 1-200 adjustable).
* **YouTube Watch History Sync:** While watching locally, your playback position is periodically synced to your actual YouTube watch history (30s interval + on pause/close). Deleting a video with "also mark as watched" uses the real video duration, so YouTube shows it as fully watched — not just appended to history.
* **WebView2 Built-in Cookie System:** Session cookies are captured from the built-in WebView2 player window — no browser extensions or third-party cookie files needed. Use "Sign in to YouTube" from the tray or Settings to log in securely inside the app; cookies are kept alive with automatic background refresh.

---

## 🛠️ Installation & Running

Since all dependencies (`node_modules/`, `yt-dlp`, `ffmpeg`) are already pre-packaged in the repository, you can run the application immediately after downloading.

### ![Windows](https://img.shields.io/badge/-Windows-0078D6?style=flat-square&logo=windows&logoColor=white)
* **Double-click Launch:**
  Double-click `HaYTooL YT Downloader.exe` in the root folder to start the application silently in the system tray and open the dashboard in your browser.
* **Native Desktop & Media Player Window:**
  Double-click `HaYTooL-Player Beta.exe` to open the application in a dedicated native window (bypassing Chrome/Edge). Playing any downloaded video inside this window opens our integrated high-performance Plyr player to watch files directly from disk (zero-stream lag) with local subtitle base64 auto-loading, double-click fullscreen, mouse wheel volume control, and resume-playback memory.
* **Command Line Launch:**
  ```cmd
  "HaYTooL YT Downloader.exe"
  ```

### ![Linux](https://img.shields.io/badge/-Linux-FCC624?style=flat-square&logo=linux&logoColor=black) / ![macOS](https://img.shields.io/badge/-macOS-aaaaaa?style=flat-square&logo=apple&logoColor=white) (Unix)
1. **Make Launcher Executable:**
   ```bash
   chmod +x baslat.sh
   ```
2. **Start the Application:**
   ```bash
   ./baslat.sh
   ```

Access the dashboard at [http://localhost:4141](http://localhost:4141) *(default port can be changed in Settings)*.

---

## 🎹 Keyboard Shortcuts

When the video player is focused, you can control playback using standard shortcuts:

* **`Space`** or **`k` / `K`**: Toggle play and pause
* **`f` / `F`**: Toggle full screen
* **`m` / `M`**: Toggle mute
* **`Arrow Right`**: Skip forward 5 seconds
* **`Arrow Left`**: Skip backward 5 seconds
* **`l` / `L`**: Skip forward 10 seconds
* **`j` / `J`**: Skip backward 10 seconds
* **`Arrow Up`**: Increase volume by 5%
* **`Arrow Down`**: Decrease volume by 5%
* **`Home`**: Jump to the beginning of the video
* **`End`**: Jump to the end of the video
* **`>`** or **`Shift + .`**: Increase playback speed (up to 2x)
* **`<`** or **`Shift + ,`**: Decrease playback speed
* **`0` to `9`**: Seek to a specific percentage (e.g., 5 jumps to 50%)

---

## 💻 CLI & Console Commands

You can manage speed profiles and queue downloads directly through the CLI or via the Console Input at the bottom of the Tray Log window:

* `status` - Shows current speed limits, active downloads, and queue info.
* `ton` - Enables alternative speed limit (Turtle Mode).
* `toff` - Disables alternative speed limit (Turtle Mode).
* `pd <youtube-url>` - Instantly adds the specified video to the download queue.
* `clear` - Clears the terminal screen.
* `help` - Shows the list of available commands.

**CLI Example:**
You can call the executable directly from the terminal or command prompt to download a video:
```bash
"HaYTooL YT Downloader.exe" pd youtubelinki
```

---

## 📂 Configuration Files

* **`configwin.ini`:** Windows-specific parameters (download path, port, alternative speed toggle).
* **`configunix.ini`:** Linux/macOS-specific parameters.
* **`channels.ini`:** Monitored channels list and their download rules.
* **`db.json`:** Lightweight local database storing download history, queue state, and metadata.

---

## 📞 Support & Feedback

* **Email:** `korazhayto@gmail.com`
* **X (Twitter):** [HaYTo](https://x.com/HaYTo)
* **GitHub:** [haytool-youtube-download](https://github.com/HaYToKoRaZ/haytool-youtube-download)

*Developer & Designer:* **HaYTo**

---
---

# 🇹🇷 Türkçe Versiyon

## 🎯 Temel Felsefe

YouTube'un öneri algoritmaları, dikkatinizi dağıtmak, sizi platformda bağımlı kılmak ve istemediğiniz içerikleri önünüze çıkarmak üzerine tasarlanmıştır. **HaYTooL** bu dayatmayı yıkmak için geliştirildi.
YouTube'a girip reklam tuzağına ve algoritma önerilerine maruz kalmak yerine, **HaYTooL** size özel bağımsız bir kütüphane sunar. Sadece takip etmek istediğiniz kanalları belirlersiniz; sistem arka planda bu kanalları sürekli tarayarak yeni yüklenen videoları otomatik olarak yerel diskinize indirir. Size sadece kendi kütüphanenizden, reklamsız, çevrimdışı ve özgürce izlemek kalır.

---

<p align="center">
  <b>📸 Uygulama Ekran Görüntüleri</b>
</p>
<p align="center">
  <img src="screenshots/tr-kutuphane.png" width="48%" alt="Kütüphane (Ana Sayfa)" />
  <img src="screenshots/tr-indirilenler.png" width="48%" alt="Yerleşik Oynatıcı ve İndirilenler" />
</p>
<p align="center">
  <img src="screenshots/tr-kuyruk.png" width="31%" alt="İndirme Sırası" />
  <img src="screenshots/tr-kanallar.png" width="31%" alt="Takip Edilen Kanallar" />
  <img src="screenshots/tr-ayarlar.png" width="31%" alt="Ayarlar Paneli" />
</p>

---

## 🚀 Öne Çıkan Özellikler

* **Arka Planda Otomatik Kanal İzleme:** Takip listenizdeki kanalları RSS akışlarıyla sürekli denetler. Yeni bir video yüklenir yüklenmez arka planda otomatik olarak indirerek yerel abonelik kutunuzu oluşturur.
* **Algoritma Dayatmasından Kurtuluş:** Öneri algoritmaları, "Sıradaki Video" tuzakları ve dikkat dağıtıcı alakasız içerikler yok. Yalnızca takip etmek için kendi eklediğiniz yayıncıların videolarını görürsünüz.
* **%100 Reklamsız Yerel Oynatım:** İndirilen videoları arayüzdeki gelişmiş oynatıcılar (Artplayer, Plyr, HTML5) üzerinden sıfır gecikme, HTTP 206 Range desteği ve reklamsız olarak yerel diskinizden oynatır.
* **SponsorBlock Entegrasyonu:** Video içindeki sponsorlu alanları, intro/outro bölümlerini ve abonelik hatırlatıcılarını otomatik atlar. Oynatıcı altındaki kalkan (shield) butonuyla geçici olarak kapatılabilir.
* **Gelişmiş Altyazı ve Otomatik Çeviri:** İngilizce/Türkçe altyazıları otomatik indirir. Yerleşik çevirici modülüyle altyazıları 11 dile anlık çevirebilir ve altyazı rengini (12 renk), arka plan opaklığını (12 düzey), yazı boyutunu (13 seçenek) özelleştirebilirsiniz.
* **YouTube Tarzı Bölünmüş Çalma Listesi:** İndirilenler sekmesi iki sütunlu yerleşim sunar. Solda aktif video oynatılırken sağda indirilmiş diğer videoların çalma listesi listelenir; otomatik sonraki videoya geçiş (autoplay) ve ortada beliren cam tasarımlı durum HUD'ları desteklenir.
* **Kanala Özel İndirme Kuralları:** Her kanala özel ayarlar sunar: otomatik indirmeyi açıp kapatabilir, dikey Shorts videolarının indirilip indirilmeyeceğini belirleyebilirsiniz.
* **Windows Tepsi Uygulaması & İnteraktif Konsol:** Arka planda sessizce çalışır. Sağ tık menüsüyle hız profillerini, Discord durumunu yönetebilirsiniz. Konsol ekranındaki komut paneli üzerinden sunucuya doğrudan `ton`, `toff`, `status`, `pd <link>` komutları gönderebilirsiniz.
* **Tekil Örnek (Mutex) Koruması:** Uygulamanın birden fazla kez açılmasını engeller. İkinci kez açmaya çalıştığınızda çalışmakta olan portu tespit edip tarayıcıda arayüzü açar ve kendini kapatır.
* **Discord Durumu (Rich Presence) Entegrasyonu:** Windows Named Pipe IPC aracılığıyla izlediğiniz videonun kanal adını `details` satırında, video başlığını ise `state` satırında göstererek Discord profilinizde etkinlik olarak yansıtır.
* **Çift Önyükleme (Dual-Boot) Dosya Koruması:** Windows ve Linux üzerinde ayrı ayar dosyaları (`configwin.ini` / `configunix.ini`) tutar. Diskten silinen dosyaları geçmişten silmeden `fileMissing: true` işaretler ve dosya geri geldiğinde geçmişi bozmadan otomatik onarır.
* **Sıfır Bağımlılık (Zero-Dependency):** Gerekli tüm Node.js modülleri, `yt-dlp` ve `ffmpeg` binary dosyaları depo içinde hazır gelir. Hiçbir harici kuruluma gerek duymadan çift tıklamayla çalışır.
* **APE Aracı (İzlendi Olarak İşaretleme):** Herhangi bir video veya kanal linkini yapıştırarak videoları kütüphanenizde izlendi/gizlendi olarak anında işaretleyin ve gerçek YouTube izleme geçmişinizle eşitleyin. Takip ettiğiniz kanallar, daha önce indirdiğiniz kanallar ve hatta tamamen yabancı kanallar için çalışır (kanalın son N videosu arka planda çekilip işaretlenir, 1-200 arası ayarlanabilir).
* **YouTube İzleme Geçmişi Senkronu:** Videoları yerel oynatıcıda izlerken oynatma konumunuz gerçek YouTube izleme geçmişinize periyodik olarak eşitlenir (30 sn'de bir + durdurma/kapatmada). "YouTube'da da izlendi olarak işaretle" ile silinen videolar gerçek süreleri kullanılarak YouTube'da tamamen izlenmiş olarak gösterilir — yalnızca geçmişe eklenmez.
* **WebView2 Yerleşik Çerez Sistemi:** Oturum çerezleri yerleşik WebView2 oynatıcı penceresinden alınır — tarayıcı eklentisi veya harici çerez dosyası gerekmez. Tepsi veya Ayarlar'daki "YouTube'da Oturum Aç" ile uygulama içinde güvenle oturum açabilirsiniz; çerezler arka planda otomatik yenilemeyle canlı tutulur.

---

## 🛠️ Kurulum ve Çalıştırma

Tüm bağımlılıklar depo içerisinde hazır geldiğinden, indirdikten sonra doğrudan çalıştırabilirsiniz.

### ![Windows](https://img.shields.io/badge/-Windows-0078D6?style=flat-square&logo=windows&logoColor=white)
* **Çift Tıklama ile Başlatma:**
  Kök dizindeki `HaYTooL YT Downloader.exe` dosyasına çift tıklayarak uygulamayı arka planda başlatabilir ve arayüzü tarayıcınızda açabilirsiniz.
* **Komut Satırı ile Başlatma:**
  ```cmd
  "HaYTooL YT Downloader.exe"
  ```

### ![Linux](https://img.shields.io/badge/-Linux-FCC624?style=flat-square&logo=linux&logoColor=black) / ![macOS](https://img.shields.io/badge/-macOS-aaaaaa?style=flat-square&logo=apple&logoColor=white) (Unix)
1. **Çalıştırma İzni Verin:**
   ```bash
   chmod +x baslat.sh
   ```
2. **Uygulamayı Başlatın:**
   ```bash
   ./baslat.sh
   ```

Arayüze varsayılan olarak [http://localhost:4141](http://localhost:4141) adresinden erişebilirsiniz *(varsayılan port Ayarlar'dan değiştirilebilir)*.

---

## 🎹 Oynatıcı Klavye Kısayolları

Oynatıcı aktifken, aşağıdaki kısayollar ile oynatımı kontrol edebilirsiniz:

* **`Space` (Boşluk)** veya **`k` / `K`**: Oynat - Duraklat
* **`f` / `F`**: Tam ekran modunu aç - kapat
* **`m` / `M`**: Sesi aç - kapat
* **`Yön Tuşu Sağ`**: 5 saniye ileri sar
* **`Yön Tuşu Sol`**: 5 saniye geri sar
* **`l` / `L`**: 10 saniye ileri sar
* **`j` / `J`**: 10 saniye geri sar
* **`Yön Tuşu Yukarı`**: Sesi %5 artır
* **`Yön Tuşu Aşağı`**: Sesi %5 azalt
* **`Home`**: Videonun en başına git
* **`End`**: Videonun en sonuna git
* **`>`** veya **`Shift + .`**: Oynatma hızını artırır (en fazla 2x)
* **`<`** veya **`Shift + ,`**: Oynatma hızını azaltır
* **`0` - `9`**: Videonun belirli bir yüzdesine atlar (Örn: 5 tuşu videonun %50'sine atlar)

---

## 💻 Komut Satırı Kontrolleri

Hız sınırlarını ve indirmeleri terminalden veya Tepsi uygulamasının Konsol giriş satırından yönetebilirsiniz:

* `status` - Hız limitlerini ve aktif kuyruk durumunu gösterir.
* `ton` - Alternatif hız sınırını (Kaplumbağa Modu) etkinleştirir.
* `toff` - Alternatif hız sınırını devre dışı bırakır.
* `pd <youtube-url>` - Belirtilen YouTube videosunu hemen indirme kuyruğuna ekler.
* `clear` - Konsol log ekranını temizler.
* `help` - Kullanılabilir komut listesini gösterir.

**CLI Kullanım Örneği:**
Windows Terminal veya Komut İstemi (CMD) üzerinden indirme komutunu doğrudan tetikleyebilirsiniz:
```bash
"HaYTooL YT Downloader.exe" pd youtubelinki
```

---

## 📂 Yapılandırma Dosyaları

* **`configwin.ini`:** Windows işletim sisteminde çalışırken kullanılan ayarlar (indirme yolu, port, alternatif hız durumu).
* **`configunix.ini`:** Linux/macOS işletim sistemlerinde çalışırken kullanılan ayarlar.
* **`channels.ini`:** Takip edilen kanalların listesi ve indirme kuralları.
* **`db.json`:** İndirme geçmişi, kuyruk ve veritabanı şablonunu barındıran yerel veritabanı dosyası.

---

## 📞 Destek ve İletişim

* **E-posta:** `korazhayto@gmail.com`
* **X (Twitter):** [HaYTo](https://x.com/HaYTo)
* **GitHub:** [haytool-youtube-download](https://github.com/HaYToKoRaZ/haytool-youtube-download)

*Geliştirici & Tasarımcı:* **HaYTo**
