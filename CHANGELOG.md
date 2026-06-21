# Changelog - Release History / Sürüm Günlüğü

This file contains version-based details of improvements, bug fixes, and optimizations made in the HaYTool Youtube Download application.
Bu dosyada, HaYTool Youtube Download uygulamasında yapılan geliştirmeler, hata düzeltmeleri ve optimizasyonlar sürüm bazlı olarak listelenmektedir.

## [5.3.7] - 2026-06-21

### New Features & Improvements / Yeni Özellikler & İyileştirmeler
- **Floating Player Drag/Resize Memory & Orientation Logic / Modal Oynatıcı Boyut & Konum Hafızası:**
  - Added resizable corner handles (`makeElementResizable`) to the floating modal player (`#player-modal`).
  - Implemented separate layout coordinates and dimension storage for standard (landscape) and portrait (Shorts) orientations in `localStorage` to resolve resolution mismatch.
  - Automatically resets coordinates and sizes to default stylesheets (placed at bottom-right based on actual aspect ratio) when opening a video type without stored preferences.
  - Properly managed sizes during minimize/maximize transition to prevent coordinate styling clashes.
  
  - Ufak video oynatıcı modalının (`#player-modal`) köşelerinden (corners) yeniden boyutlandırılabilmesini sağlayan resize tutamaçları (`makeElementResizable`) entegre edildi.
  - Normal (yatay) ve Shorts (dikey) videolar arasındaki çözünürlük/oran uyuşmazlığını gidermek amacıyla koordinat ve boyut verilerinin her video yönelim türüne göre (`localStorage` üzerinde ayrı anahtarlarla) kaydedilmesi sağlandı.
  - Kayıtlı veri olmadığında oynatıcının videonun doğal oranına (aspect ratio) göre otomatik şekil alıp sağ altta açılması sağlandı.
  - Simge durumuna küçültme ve büyütme geçişlerinde özel koordinatların çakışmaması sağlandı.

- **Autoplay Transient HUD Overlay & Player Integration / Otomatik Geçiş Ortada Bildirim & Oynatıcı Geçişi:**
  - Added an Autoplay toggle button (`#inline-btn-autoplay-toggle`) below the player, saving preferences to `localStorage`.
  - Hooked into the `ended` events of Plyr, ArtPlayer, and HTML5 players to automatically fetch and play the next video in the sidebar playlist.
  - Designed a transient, large glassmorphism HUD overlay in the center of the video player when toggling Autoplay, replacing the small bottom-right toast message.
  
  - Oynatıcı eylem barına "Otomatik Geçiş" (Autoplay) butonu eklendi ve seçimin `localStorage`'da saklanması sağlandı.
  - Plyr, ArtPlayer ve HTML5 oynatıcılarının `ended` olaylarına bağlanarak video bittiğinde otomatik sonraki videonun oynatılması sağlandı.
  - Autoplay açılıp kapatıldığında sağ alttaki küçük toast yerine, video oynatıcının tam ortasında şık ve büyük bir geçici katman (transient overlay) şeklinde durum bildirimi eklendi.

- **Light Theme Compatibility / Açık Tema Uyumsuzluklarının Giderilmesi:**
  - Standardized `.modal-content`, `.modal-header h3`, `.modal-close-btn:hover` and `.player-modal-content` elements using theme CSS variables instead of hardcoded dark-blue values. Modals now adapt beautifully to both light and dark themes.
  - Made the transient overlay cards, volume HUD, subtitle translation overlay, and standard toasts light-theme-aware with transparent white backgrounds and dark text.
  
  - Genel modal yapısı, silme onay modalı (`#delete-modal`), çeviri ve oynatıcı modallarındaki hardcoded koyu mavi/beyaz renkler kaldırılarak CSS değişkenlerine bağlandı; modallar açık temada beyaz arka plan ve koyu metin renklerine kavuşturuldu.
  - Geçici katman bildirimleri, ses göstergesi (Volume HUD), altyazı çeviri perdesi ve standart toast bildirimleri açık temada yarı saydam beyaz cam arka plan ve koyu metinlerle temaya tam uyumlu hale getirildi.

- **Single-Instance Protection (C# Launcher) / Tekil Örnek Koruması:**
  - Added a system-level `Mutex` lock check in the C# tray application (`tray.cs`) to prevent multiple launcher processes.
  - When a second instance of `HaYTooL YT Downloader.exe` is launched, it automatically shows a message stating that the app is already running, reads the active port from `configwin.ini`, opens the user's browser to the dashboard, and exits cleanly.
  - Recompiled the C# binary using `csc.exe` with embedded icon and GUI configuration.
  
  - C# tepsi (tray) uygulamasında (`tray.cs`) birden fazla başlatıcı sürecini engelleyecek Mutex yapısı kuruldu.
  - İkinci exe açılmaya çalışıldığında uygulamanın zaten çalıştığını belirtip `configwin.ini` portunu okuyarak tarayıcıda arayüz sekmesini açması ve ikinci süreci sonlandırması sağlandı.
  - C# kodu derlenerek `HaYTooL YT Downloader.exe` dosyası güncellendi.

## [5.3.6] - 2026-06-21

### New Features & Improvements / Yeni Özellikler & İyileştirmeler
- **Parallel Downloading & Merging / Paralel İndirme ve Birleştirme:**
  - Refactored `DownloadQueue` to support multiple concurrent background processes (active processes managed via a Map).
  - When a video completes downloading and enters the FFmpeg merging/post-processing phase (detected via stdout matching `[Merger]`, `[ffmpeg]`, or 100% progress), the active network slot is freed (`this.activeDownloads--`) and the next download in the queue starts immediately.
  - Video status transitions to `merging` and updates the database in real-time.
  
  - `DownloadQueue` yapısı, arka planda birden fazla eşzamanlı işlemi (Map tabanlı aktif süreç yönetimi ile) destekleyecek şekilde baştan tasarlandı.
  - Bir video indirmeyi bitirip FFmpeg birleştirme/dönüştürme (merge) aşamasına geçtiğinde (`[Merger]`, `[ffmpeg]` veya %100 ilerleme çıktısıyla algılanır), ağ indirme slotu hemen boşaltılır (`this.activeDownloads--`) ve kuyruktaki sıradaki videonun indirilmesi hemen başlar.
  - Video durumu `merging` olarak güncellenir ve arayüze gerçek zamanlı yansıtılır.

- **Queue UI Revamp & Video Thumbnails / Kuyruk Sekmesi Yenilikleri ve Küçük Resimler:**
  - Redesigned the queue item template to render YouTube video thumbnails (`https://i.ytimg.com/vi/<id>/mqdefault.jpg`) for a richer look.
  - Added a dedicated "Merging (FFmpeg)..." status indicator with a spinning loader animation at the top of the queue list for videos currently being merged.
  - Disabled drag-and-drop ordering for merging videos as their order is locked during processing.
  - Translated all new status states (`status_merging`) across all 7 supported application languages (TR, EN, ES, DE, PT, AR, RU).
  
  - Daha zengin bir görünüm için kuyruktaki her videonun yanına YouTube küçük resmi (thumbnail) gösterimi eklendi.
  - Birleştirme aşamasındaki videolar için kuyruk listesinin en üstünde dönen bir çark (spinner) ve "Birleştiriliyor (FFmpeg)..." durum göstergesi içeren özel kart tasarımı yapıldı.
  - Dönüştürme/birleştirme aşamasındaki videoların sırası kilitlendiğinden sürükle-bırak özelliği bu öğeler için devre dışı bırakıldı.
  - Yeni durum etiketleri (`status_merging`) desteklenen tüm 7 uygulama diline (TR, EN, ES, DE, PT, AR, RU) entegre edildi.

- **Instant Video Seeking / Anlık Video İleri/Geri Sarma:**
  - Refactored the `/api/video-stream` endpoint to use Express's native `res.sendFile(path.resolve(fileToPlay))` method.
  - This allows the browser to natively and efficiently handle HTTP Range requests (HTTP 206) at the C++ level, completely resolving the slow seeking/buffering issues inside embedded video players.
  
  - `/api/video-stream` endpoint'i, Express'in yerleşik ve son derece optimize çalışan `res.sendFile` metoduna geçirildi.
  - Bu sayede tarayıcının HTTP Range isteklerini (HTTP 206) C++ seviyesinde yerel ve önbellekli yönetmesi sağlanarak, gömülü oynatıcılardaki ileri/geri sarma (seek) yavaşlığı ve takılma sorunları tamamen giderildi.

- **Version Bump / Sürüm Güncellemesi:**
  - Version bumped to `v5.3.6` across the project, including package.json, README.md, index pages, settings, and server greeting banner.
  
  - Uygulama genel sürümü `v5.3.6` olarak güncellendi, package.json, README.md, index.html ve server.js dosyalarındaki versiyon bilgileri güncellendi.

## [5.3.5] - 2026-06-20

### New Features & Improvements / Yeni Özellikler & İyileştirmeler
- **Video Description & Timestamps Integration / Video Açıklaması ve Zaman Damgası Entegrasyonu:**
  - Added `--write-description` to yt-dlp arguments, allowing video descriptions to be downloaded as `.description` files inside the video directory.
  - Implemented `/api/video/:videoId/description` GET endpoint to dynamically read and stream the downloaded `.description` text file.
  - Added `#inline-btn-description` toggle button on the player controls and `#inline-player-description-container` sidebar panel to display the description.
  - Automatically parses time durations (`hh:mm:ss` / `mm:ss`) inside the description into clickable hyperlink anchors that trigger seek actions on ArtPlayer, Plyr, and HTML5 players.
  - Integrated cleanup commands in `autoDeleteOldVideos` and deletion endpoints to automatically sweep `.description` files along with video tracks.

  - Video dizinine açıklamaların `.description` dosyası olarak kaydedilmesi için yt-dlp argümanlarına `--write-description` parametresi eklendi.
  - İndirilen `.description` metin dosyasını dinamik olarak okuyup sunan `/api/video/:videoId/description` GET endpoint'i oluşturuldu.
  - Oynatıcı kontrollerine `#inline-btn-description` (Açıklama Göster) butonu ve arayüze açıklama metnini gösterecek dikey kaydırılabilir `#inline-player-description-container` paneli eklendi.
  - Açıklama metnindeki zaman damgaları (`hh:mm:ss` / `mm:ss`) otomatik olarak algılanıp ArtPlayer, Plyr ve HTML5 oynatıcılarında süreye atlama (seek) eylemini tetikleyen tıklanabilir bağlantılara dönüştürüldü.
  - Video silme ve otomatik temizleme (`autoDeleteOldVideos`) logic'ine, videolarla birlikte `.description` ve altyazı dosyalarının da sistemden silinmesini sağlayan temizleme komutları entegre edildi.

- **Fixed Description File Matching Bug / Açıklama Dosyası Eşleşme Hatası Düzeltildi:**
  - Resolved the bug where the newly introduced `.description` files were mistakenly matched as the main video file instead of `.mp4`/`.webm`, causing playback failures (`NotSupportedError`). Added `.description` to the video file exclusion lists on the server.

  - Yeni eklenen `.description` dosyalarının, `.mp4`/`.webm` yerine ana video dosyası gibi eşleşmesine ve oynatma hatalarına (`NotSupportedError`) yol açan hata giderildi. Sunucu üzerindeki video dosyası filtreleme listelerine `.description` uzantısı eklendi.

- **UI Language Synchronization / Arayüz Dil Senkronizasyonu:**
  - Added translations for `tab_iptv`, `inline_btn_description`, and `inline_description_title` tags across all supported application languages.
  - Hooked language change events to dynamically update translations for the IPTV tab menu and the player description button/panel text on runtime.

  - Desteklenen tüm uygulama dillerine `tab_iptv`, `inline_btn_description` ve `inline_description_title` etiketlerinin çevirileri eklendi.
  - Dil değişim olayları (language change) IPTV tab menüsü, oynatıcı açıklama butonu ve panel başlığı metinlerini anlık olarak güncelleyecek şekilde dil mantığına bağlandı.

- **Version Bump / Sürüm Güncellemesi:**
  - Version bumped to `v5.3.5` across the project, including package.json, README.md, index pages, settings, and server greeting banner.

  - Uygulama genel sürümü `v5.3.5` olarak güncellendi, package.json, README.md, index.html ve server.js dosyalarındaki versiyon bilgileri güncellendi.

## [5.3.4] - 2026-06-20

### New Features & Improvements / Yeni Özellikler & İyileştirmeler
- **IPTV Sports Mode & Layout Enhancements / IPTV Spor Modu ve Yerleşim Geliştirmeleri:**
  - Added seamless fullscreen scaling for Slot 1 and automatic centering of video players.
  - Implemented stream swapping (URL/name swap) between Slot 0 and Slot 1, keeping player sizes and custom resize states intact.
  - Slot 1 auto-unmutes and Slot 2 (PiP overlay) auto-mutes upon swapping to prevent audio clutter.
  - Added overlay controls for mute/unmute and swap directly on video slots.
  - Added hotkey support ('s'/'S'/'y'/'Y') to quickly swap screens in Sports Mode.
  - Custom drag and resize states now persist properly.

  - Slot 1 için kesintisiz tam ekran ölçeklendirme ve video oynatıcıların otomatik ortalanması eklendi.
  - Slot 0 ve Slot 1 arasında oynatıcı boyutlarını ve özel boyutlandırma durumlarını bozmayan kanal/isim yer değiştirme (swap) özelliği eklendi.
  - Ses karmaşasını önlemek için yer değiştirme sonrasında Slot 1 sesi otomatik açılırken Slot 2 (PiP) sesi otomatik olarak kısılır.
  - Video slotlarının üzerine doğrudan sessize alma ve yer değiştirme butonları eklendi.
  - Spor Modundayken hızlıca ekranları yer değiştirmek için klavye kısayolu ('s'/'S'/'y'/'Y') desteği eklendi.
  - Özel sürükleme ve yeniden boyutlandırma konumlarının kaybolmadan korunması sağlandı.

- **UI & Navigation Refinements / Arayüz ve Navigasyon İyileştirmeleri:**
  - Removed "HaYTooL YouTube Downloader" text from the header bar, keeping only the logo and version badge.
  - Added IPTV navigation tab to the header. Re-ordered navigation tabs as: Logo/Version/Kütüphane/İndirilenler/IPTV/Kuyruk/Kanallar/PD/Ayarlar.
  - Shrinked view mode buttons on the IPTV panel for a cleaner look.
  - Truncated category filter names to 40 characters maximum to prevent layout distortion.
  - Removed GitHub update confirmation dialog for a smoother user experience.

  - Başlık barından "HaYTooL YouTube Downloader" metni kaldırılarak sadece logo ve versiyon rozeti bırakıldı.
  - Başlık menüsüne IPTV sekmesi eklendi. Navigasyon sırası şu şekilde düzenlendi: Logo/Version/Kütüphane/İndirilenler/IPTV/Kuyruk/Kanallar/PD/Ayarlar.
  - Daha temiz bir görünüm için IPTV panelindeki görünüm modu butonları küçültüldü.
  - Tasarımın bozulmasını önlemek için kategori filtre isimleri maksimum 40 karakter ile sınırlandırıldı.
  - Daha akıcı bir kullanıcı deneyimi için GitHub güncelleme onay kutusu kaldırıldı.

- **Version Bump / Sürüm Güncellemesi:**
  - Version bumped to `v5.3.4` across the project, including package.json, README.md, index pages, settings, and server greeting banner.

  - Uygulama genel sürümü `v5.3.4` olarak güncellendi, package.json, README.md, index.html ve server.js dosyalarındaki versiyon bilgileri güncellendi.

## [5.1.0] - 2026-06-18

### Bug Fixes & Improvements / Hata Düzeltmeleri & İyileştirmeler
- **Vertical Video Zooming Fix / Dikey Video Yakınlaşma Hatası Düzeltildi:**
  Fixed the issue where playing vertical (Shorts) videos inside the embedded inline player in the downloaded tab resulted in cropped and zoomed playback. Added custom layout and CSS rules to maintain correct 9:16 aspect ratio while preventing cropping.

  İndirilenler sekmesindeki yerleşik video oynatıcıda dikey (Shorts) videolar oynatılırken yaşanan kırpılma ve yakınlaşma (zoom) hatası giderildi. Videonun 9:16 en-boy oranını koruyarak düzgün ve kırpılmadan gösterilmesi için özel stil ve yerleşim kuralları eklendi.
- **Default Channel Auto-Download Disabled / Varsayılan Kanal Otomatik İndirmesi Kapatıldı:**
  Disabled the auto-download setting for the default channel "TeknoSeyir" by default on initial launch. This prevents downloads from starting immediately when a new user runs the app.

  İlk kurulumda varsayılan olarak gelen "TeknoSeyir" kanalının otomatik indirme seçeneği kapatıldı. Böylece kullanıcının yazılımı ilk açtığında habersizce indirmelerin başlaması engellenmiş oldu.
- **Upcoming/Live Video Label Localization / Yakında/Canlı Video Etiketi Yerelleştirmesi:**
  Translated the "upcoming" and "live" video duration/status labels in the library card to respect the application language (Turkish/English).

  Kütüphane kartında yayınlanacak olan (planlanmış) ve canlı yayındaki videoların "upcoming" ve "live" olan İngilizce etiketleri, seçilen uygulama diline göre (Türkçe ise "Yakında" / "Canlı") yerelleştirildi.
- **Version Upgrade / Sürüm Güncellemesi:**
  Version bumped to `v5.1.0` across the project, including package.json, README.md, index pages, settings, and server greeting banner.

  Uygulama genel sürümü `v5.1.0` olarak güncellendi, package.json, README.md, index.html ve server.js dosyalarındaki versiyon bilgileri güncellendi.

## [5.0.0] - 2026-06-18

### New Features & Improvements / Yeni Özellikler & İyileştirmeler
- **GitHub Automatic Update Notification / GitHub Otomatik Güncelleme Bildirimi:**
  Added a background GitHub update checker that runs at server startup and every 12 hours. Shows a sleek, animated, and dismissible glassmorphism toast notification at the bottom-right corner of the screen when a newer release is published, plus an "Update Available" badge in the Settings panel linking to the GitHub releases page.
  Sunucu başlangıcında ve her 12 saatte bir arka planda en güncel GitHub Releases API sürümünü denetleyen ve yeni bir sürüm çıktığında arayüzün sağ alt köşesinde glassmorphism tarzında, animasyonlu ve kapatılabilir bir güncelleme uyarısı gösteren yeni sistem eklendi. Ayrıca Ayarlar sekmesindeki sürüm numarasının yanına "Güncelleme Var" rozeti eklendi.
- **Version Upgrade / Sürüm Güncellemesi:**
  Version bumped to `v5.0.0` across the project, including package.json, README.md, index pages, settings, and server greeting banner.
  Uygulama genel sürümü `v5.0.0` olarak güncellendi, package.json, README.md, index.html ve server.js dosyalarındaki versiyon bilgileri güncellendi.

## [4.29.0] - 2026-06-18

### Bug Fixes & Improvements / Hata Düzeltmeleri & İyileştirmeler
- **FFmpeg Installation Timeout Fix / FFmpeg Kurulum Zaman Aşımı Hatası Giderildi:**
  Fixed intermittent validation timeout failures (`ETIMEDOUT`) during initial FFmpeg extraction caused by Windows Defender / antivirus scanning new binary executables. Increased validation timeout in `testFfmpegSync()` from 2 seconds to **10 seconds**, and implemented a **5-second delay followed by an automatic retry** (with a 5-second timeout) if a timeout occurs.
  İlk FFmpeg kurulumu/çıkarma işleminden sonra Windows Defender / Antivirüs programlarının yeni binary dosyalarını taramasından kaynaklanan 2 saniyelik zaman aşımı (`ETIMEDOUT`) hataları giderildi. `testFfmpegSync()` fonksiyonundaki doğrulama zaman aşımı süresi **10 saniyeye** çıkarıldı. Ayrıca zaman aşımı hatası alındığında antivirüs taramasının tamamlanabilmesi için **5 saniye beklenip otomatik bir kez yeniden deneme (retry)** mekanizması eklendi.
- **Version Upgrade / Sürüm Güncellemesi:**
  Version bumped to `v4.29.0` across the project, including package.json, README.md, index pages, settings, and server greeting banner.
  Uygulama genel sürümü `v4.29.0` olarak güncellendi, package.json, README.md, index.html ve server.js dosyalarındaki versiyon bilgileri güncellendi.

## [4.28.0] - 2026-06-18

### Yeni Özellikler & İyileştirmeler / New Features & Improvements
- **Taşınabilir Sürüm Paketleyici İyileştirmesi (db.json Hariç Tutulması) / Portable Release Packager Refinement (db.json Exclusion):** Taşınabilir zip paketleme betiği (`releases-maker.ps1`) güncellenerek kişisel indirme geçmişinizi ve takip edilen kanallar listesini barındıran `db.json` dosyasının dağıtılan zip arşivlerine yanlışlıkla dahil edilmesi engellendi. Bu sayede, yeni sürümler sıfır veritabanı dosyalarıyla başlayarak temiz bir kurulum sağlar. / Updated the portable release packager script (`releases-maker.ps1`) to automatically exclude the local database file (`db.json`) from being compiled into distribution zip archives. Ensures clean installations without local history files.
- **Sürüm Güncellemesi / Version Upgrade:** Uygulama genel sürümü `v4.28.0` olarak güncellendi, package.json, README.md, index.html ve server.js dosyalarındaki versiyon bilgileri güncellendi. / Version bumped to `v4.28.0` across the project, including package.json, README.md, index pages, settings, and server greeting banner.

## [4.27.0] - 2026-06-18

### Yeni Özellikler & İyileştirmeler / New Features & Improvements
- **Varsayılan İndirme Klasörü Konumu (Sistem Downloads Klasörü) / Default Download Location (System Downloads Folder):** Temiz kurulumlarda veya INI ayarları bulunmadığında, varsayılan indirme konumu proje klasöründeki `/download` dizininden sistemin genel Downloads (İndirilenler) dizininin altındaki `HaYTooLYouTubeAutoDownloads` konumuna taşındı (örn. `C:\Users\<Username>\Downloads\HaYTooLYouTubeAutoDownloads`). Klasör açılışta yoksa sistem tarafından otomatik olarak oluşturulacaktır. / Changed the default fallback download path from the local `/download` folder inside the project directory to the user's system Downloads folder, under a dedicated subdirectory named `HaYTooLYouTubeAutoDownloads`. The folder is dynamically resolved using the user's home directory and created automatically on startup if missing.
- **Sürüm Güncellemesi / Version Upgrade:** Uygulama genel sürümü `v4.27.0` olarak güncellendi, package.json, README.md, index.html ve server.js dosyalarındaki versiyon bilgileri güncellendi. / Version bumped to `v4.27.0` across the project, including package.json, README.md, index pages, settings, and server greeting banner.

## [4.26.0] - 2026-06-18

### Yeni Özellikler & İyileştirmeler / New Features & Improvements
- **İlk Çalışmada Varsayılan Kanal (TeknoSeyir) / Default Channel on First Run (TeknoSeyir):** Uygulamanın veritabanı bulunmadığı ilk kurulum/çalışma anında, takip edilen kanallar listesinin boş gelmesi yerine varsayılan olarak "TeknoSeyir" kanalı yüklü gelecek şekilde `defaultDb` şablonu güncellendi. Kanalın avatar, kanal adresi, otomatik indirme ve süre limitleri gibi bilgileri önceden tanımlı olarak gelir. / Updated the default database template (`defaultDb`) so that when the application is launched for the first time without a pre-existing `db.json` database, the followed channels list is pre-populated with the "TeknoSeyir" channel. Configures its avatar, YouTube handle, auto-download setting, and defaults out-of-the-box.
- **Sürüm Güncellemesi / Version Upgrade:** Uygulama genel sürümü `v4.26.0` olarak güncellendi, package.json, README.md, index.html ve server.js dosyalarındaki versiyon bilgileri güncellendi. / Version bumped to `v4.26.0` across the project, including package.json, README.md, index pages, settings, and server greeting banner.

## [4.25.0] - 2026-06-18

### Yeni Özellikler & İyileştirmeler / New Features & Improvements
- **Çalışma Dizini ve İkon Düzeltmesi (Sistem Başlangıcı) / Working Directory & Icon Resolution (System Startup):** C# Tray uygulamasının (`HaYTooL YT Downloader.exe`) Windows başlangıcında (`Run` Registry anahtarı) tetiklendiğinde çalışma dizininin `C:\Windows\System32` olarak belirlenmesinden kaynaklanan `icon.ico` ve `configwin.ini` dosyalarını bulamama hatası giderildi. Çalışma dizini program başlangıcında dinamik olarak uygulamanın kendi klasörüne sabitlendi. / Fixed the startup registry launch issue where Windows set the working directory to `C:\Windows\System32`, causing relative assets like `icon.ico` and `configwin.ini` to fail loading. Now, the application sets its current directory to the executable's directory at launch.
- **Kendi Tarayıcısında Aç Seçeneği (Edge App Modu) / Open in Own Browser (Edge App Mode):** Tepsi sağ tık menüsüne gömülü tarayıcı deneyimi sunan "Kendi Tarayıcısında Aç" (Open in App Window) seçeneği eklendi. Bu seçenek, Microsoft Edge'i `--app` parametresi ile bağımsız, chromeless (adres çubuğu ve sekmeleri olmayan) bir pencere modunda açarak yerleşik bir masaüstü uygulaması görünümü sağlar. Tepsi ikonuna çift tıklama eylemi ise varsayılan sistem tarayıcısını açmaya devam eder. / Added "Open in Own Browser" option to the tray right-click menu, launching MS Edge in `--app` mode for a dedicated chromeless window experience, mimicking a standalone desktop app. Double-clicking the tray icon continues to open the default system browser.
- **Dil Çevirileri ve Sadeleştirmeler / Localization Updates & Refinements:** "Kendi Tarayıcısında Aç" seçeneği tr, en, es, de, pt, ru ve ar dillerinde yerelleştirildi. Ayrıca Türkçe menüdeki "Panodan İndir (Paste & Download)" seçeneği "Panodan İndir" olarak sadeleştirildi. / Localized the "Open in Own Browser" text across all supported languages. Simplified the Turkish menu item "Panodan İndir (Paste & Download)" to simply "Panodan İndir".
- **Sürüm Güncellemesi / Version Upgrade:** Uygulama genel sürümü `v4.25.0` olarak güncellendi, package.json, README.md, index.html ve server.js dosyalarındaki versiyon bilgileri güncellendi. / Version bumped to `v4.25.0` across the project, including package.json, README.md, index pages, settings, and server greeting banner.

## [4.24.0] - 2026-06-18

### Yeni Özellikler & İyileştirmeler / New Features & Improvements
- **Kütüphane Filtre Düzeni ve Tasarım Düzeltmeleri / Library Filter Bar & Styling Refinements:** Tarih filtreleri için kullanılan select dropdown yapısı, butonla seçimin daha hızlı olması nedeniyle tekrar eski butonlu tasarıma geri döndürüldü. Tarih butonları (`btn-filter`) son derece kompakt hale getirilerek tüm filtre barının tek satıra sığması sağlandı. / Reverted the quick date filters back to the button layout from the select dropdown based on usability preferences, making them ultra-compact to ensure they neatly fit on a single line.
- **İndirilenler Çalma Listesi Dinamik Yükseklik / Downloads Playlist Dynamic Height:** İndirilenler sekmesindeki sağ tarafta yer alan çalma listesi sidebarı (`.inline-player-sidebar` ve `.downloaded-playlist-grid`), içindeki video adedine göre otomatik olarak uzayacak şekilde (scrollsuz/limitsiz) dinamik yüksekliğe kavuşturuldu. / Adjusted the downloaded playlist sidebar to dynamically expand to fit the total number of videos without internal scrolling or fixed max-height limitations.
- **Sürüm Güncellemesi / Version Upgrade:** Uygulama genel sürümü `v4.24.0` olarak güncellendi, package.json, README.md, index.html ve server.js dosyalarındaki versiyon bilgileri güncellendi. / Version bumped to `v4.24.0` across the project, including package.json, README.md, index pages, settings, and server greeting banner.

## [4.23.0] - 2026-06-18

### Yeni Özellikler & İyileştirmeler / New Features & Improvements
- **Kanal Özelinde Otomatik İndirme Ayarı / Per-Channel Auto-Download Toggle:** Takip edilen kanalların listesinde her kanala özel otomatik video indirme seçeneği eklendi. Yeni eklenen kanallarda varsayılan olarak otomatik indirme (`autoDownload: true`) açık olacak şekilde yapılandırıldı. Bu sayede tüm otomasyon açıkken belirli kanalların otomatik indirmesi kapatılabilir. / Added a select dropdown next to each followed channel to toggle auto-downloads on a per-channel basis. Newly added channels default to having auto-download enabled. Enables selective auto-downloading even when global auto-downloads are active.
- **SponsorBlock Anlık Kapatma Butonu / SponsorBlock Temporary Skip Toggle:** Video oynatıcısının altındaki eylem barına SponsorBlock atlamasını anlık olarak kapatıp açan dinamik bir kalkan (`shield` / `shield-off`) butonu eklendi. Butona tıklanarak geçerli video oynatım oturumu için sponsor atlamaları geçici olarak devre dışı bırakılabilir ve timeline üzerindeki sponsor şeritleri soluklaştırılır. / Integrated a dynamic shield button under the video player to temporarily pause or enable SponsorBlock segment skipping for the current video. Diminshes timeline sponsor segments visibility when disabled.
- **Ses Seviyesi & SponsorBlock Görsel Bildirimleri / Volume & SponsorBlock Transient HUD Overlays:** Mouse scroll tekerleğiyle ses değiştirildiğinde ve SponsorBlock kalkan butonuna tıklandığında, oynatıcı üzerinde yarım saniyede sönen şık cam tasarımlı (glassmorphic) görsel bildirim katmanları (HUD) eklendi. / Introduced sleek, transient glassmorphic HUD overlays on the player to show volume level changes (when using the scroll wheel) and SponsorBlock status notifications when toggled.
- **Kütüphane Otomatik İndirme Filtresi / Library Auto-Download Disabled Filter:** Kütüphane tabına, sadece otomatik indirmesi devre dışı bırakılmış kanalların videolarını listelemek amacıyla "Sadece Otomatik İndirme Kapalı" filtresi (`history-only-no-auto-download`) eklendi. / Added an "Only Auto-Download Disabled" filter checkbox on the Library tab to display only the videos belonging to channels that have auto-downloads disabled.
- **Tekil & Senkronize Oynatıcı Yönetimi / Single Synchronized Player Management:** Arayüzdeki yerleşik ve modal oynatıcıların çift ses çalmasını engellemek için tüm oynatıcılar senkronize hale getirildi. Bir sekmedeki video duraklatıldığında diğer sekmeye geçince kendiliğinden başlamayacak; modal veya yerleşik yeni bir video açıldığında arka plandaki tüm video/ses oynatımları ve iframeler tamamen durdurulup yok edilecektir. / Overhauled player lifecycle management to prevent dual audio playback. If a video is paused, switching tabs will keep the player paused instead of autoplaying. Opening a new video (inline or floating) instantly pauses, stops, and destroys all other active media and iframe elements.
- **Dil Çevirileri Entegrasyonu / Multi-Language Translation Updates:** Yeni eklenen özellikler, seçenek başlıkları, tooltipler, HUD başlıkları ve durum etiketleri tr, en, es, de, pt, ru ve ar dil dosyalarına eksiksiz şekilde entegre edildi. / Fully integrated translation keys and localizations for the new toggles, options, tooltips, HUD labels, and state descriptions across all 7 supported languages.
- **Sürüm Güncellemesi / Version Upgrade:** Uygulama genel sürümü `v4.23.0` olarak güncellendi, README ve anasayfa/ayarlar menüsü versiyon etiketleri güncellendi. / Version bumped to `v4.23.0` across the project, including README, index pages, server greeting banner, and settings.

## [4.22.0] - 2026-06-16

### Yeni Özellikler & İyileştirmeler / New Features & Improvements
- **Gelişmiş Altyazı Çeviri Modalı & Yükleme Ekranı / Advanced Subtitle Translation Modal & Loading Overlay:** Altyazı çeviri butonu (`inline-btn-translate-sub`) tamamlanmış videolarda her zaman görünür olacak şekilde güncellendi. Butona tıklandığında kaynak altyazı dosyası (örn: `.en`, `.es` vb.) ile hedef dilin (TR, EN, ES, DE, PT, AR, RU, FR, IT, JA, ZH) seçilmesini sağlayan şık bir modal açılır. Çeviri esnasında donmayı veya çalışmama hissini önlemek için oynatıcı alanında dönen spinner ve seçilen dile göre yerelleştirilmiş durum overlay katmanı gösterilir. Backend dinamik kaynak/hedef çevirisini destekleyecek şekilde güncellendi. / Updated the subtitle translation button to be always visible on completed videos. Clicking it opens a modal allowing the user to select the source subtitle track and the target language (supporting 11 languages). Displays a localized visual loading overlay with a spinning loader and descriptive text during the API translation process. Backend updated to support generic source/target language parameters.
- **İkon Arayüzü / Icon-Only Action Buttons:** Video altındaki "YouTube'da Aç", "Sistem Oynatıcısında Aç", "Klasör Aç" ve "Yorumları Göster" butonlarındaki metin etiketleri silinerek sadece modern ikonlar bırakıldı. İlgili açıklamalar tooltip (`title`) olarak dile göre dinamik atanır. YouTube logosu kırmızı (`#ff0000`) yapıldı. / Removed text labels from the player action buttons to show icons only. Dynamic tooltips are assigned based on language. YouTube icon is now styled with its native red (#ff0000) fill.
- **Zengin Altyazı Seçenekleri / Rich Subtitle Options:** Altyazı rengi (12 adet renk seçeneği: Mavi, Turuncu, Mor, Siyah, Gri, Açık Sarı dahil), altyazı saydamlığı (%0'dan %100'e 12 farklı seçenek) ve altyazı yazı boyutu (12px'ten 40px'e 13 farklı seçenek) seçenekleri en az 12 adet seçeneğe yükseltildi. / Expanded subtitle options to offer at least 12 choices for each control: 12 colors, 12 opacity percentages, and 13 font sizes, synchronized across both inline selects and ArtPlayer settings.
- **Dil Çevirileri Revizyonu / Translation Quality Polish:** Uygulama dillerinde (tr, en, es, de, pt, ru, ar) yeni altyazı renk, saydamlık ve boyut değerlerinin, butonların ve tooltiplerin çevirileri eksiksiz şekilde senkronize edildi. / Fully audited and updated translations for all 7 languages (TR, EN, ES, DE, PT, AR, RU) to cover newly added controls, color names, opacities, and sizes.
- **Sürüm Güncellemesi / Version Upgrade:** Uygulama genel sürümü `v4.22.0` yapıldı, README ve anasayfa/ayarlar güncellendi. / Version bumped to `v4.22.0` across README, index pages, server greeting banner, and settings.

## [4.21.0] - 2026-06-16

### Yeni Özellikler & İyileştirmeler / New Features & Improvements
- **Yorum Avatar ve Tasarım İyileştirmesi / Comment Avatar & Bubble Polish:** Yorum bölümündeki büyük ve uyumsuz avatarlar küçültüldü ve yorum balonları modern, şık ve görsel açıdan kusursuz bir tasarıma kavuşturuldu. / Shrank and redesigned comment avatars and bubble layouts in the comments panel to look visually consistent, clean, and premium.
- **Oynatıcı İçi Gelişmiş Ayarlar / Inline Player Advanced Controls:** Yerleşik oynatıcı alt kontrol barına; Altyazı Rengi seçici, Altyazı Arka Plan Saydamlığı (%0 ile %100 arası) seçici, Altyazı Yazı Boyutu seçici ve tamamlanmış videoları diskten silip sıfırdan indirilmek üzere kuyruğa alan "Tekrar İndir" (Redownload) butonu eklendi. / Integrated inline controls directly into the player action bar: Subtitle Color dropdown, Subtitle Background Opacity selection, Subtitle Font Size selector, and a "Redownload" button which deletes existing files and re-queues the video.
- **ArtPlayer Kısayol Düzeltmesi / ArtPlayer Shortcut Resolution:** ArtPlayer gömülü oynatıcıda Space (oynat/durdur) ve yön tuşları gibi klavye kısayollarının çift tetiklenip çakışması `hotkey: false` ayarı ile giderildi. / Resolved double-toggle keyboard shortcut conflicts (like Space and arrow keys) in ArtPlayer by setting `hotkey: false` and cleanly delegating to global handlers.
- **İndirilenler Sıralama ve Shorts Filtreleri / Downloads Sorting & Shorts Filters:** Sağ taraftaki çalma listesi sidebarı "İndirilenler" (Downloads) olarak adlandırıldı. Kanal adının yanına dosya boyutu ve yüklenme tarihi eklendi. Üst kısımdaki açılır filtre menüleri yerine yan yana hızlı sıralama butonları (Tarih ve Boyut yön oklarıyla) ile "Shorts Göster" seçeneği konuldu ve bu ayarların anlık olarak çift yönlü senkronize çalışması sağlandı. / Renamed the sidebar playlist header to "Downloads", showing file size and publication date next to the channel name. Replaced dropdown selectors with side-by-side quick sort buttons (Date/Size toggles) and a Shorts checkbox, enabling instant bi-directional sorting and filtering.

## [4.20.0] - 2026-06-16

### Yeni Özellikler & İyileştirmeler / New Features & Improvements
- **Altyazı Özelleştirmeleri / Subtitle Color Customization:** ArtPlayer, Plyr ve HTML5 video oynatıcılarına altyazı renk seçeneği (Altyazı Rengi) eklendi. Hem genel ayarlar sekmesinde hem de ArtPlayer içi ayar menüsünde (YouTube benzeri çark menüsü) altyazı rengi değiştirilebiliyor. / Added subtitle color selection (Subtitle Color) to ArtPlayer, Plyr, and HTML5 players. Subtitle colors can be configured via both the global Settings tab and directly within the ArtPlayer settings menu.
- **Eşzamanlılık Koruması / Database Concurrency Protection:** Eşzamanlı (asenkron) veritabanı yazma çakışmalarını (DB Lock) engellemek amacıyla asenkron kilit (Mutex) mekanizması entegre edildi. / Integrated an asynchronous DB lock mutex to serialize write operations and prevent concurrency database locks.
- **Güvenlik İyileştirmeleri / Path Traversal Security:** Klasör açma endpoint'inde (`/api/open-folder`) path traversal zafiyetlerine karşı güvenli yol denetimi ve doğrulama eklendi. / Secured the folder opening endpoint (`/api/open-folder`) against path traversal attacks using path validation.
- **Kanal Logo & Arayüz Sadeleştirmeleri / Metadata Cleanups:** İndirilenler sekmesindeki video kartlarında ve inline oynatıcıda kanal adı yanında duran tv ikonu kaldırıldı. / Removed the TV icon next to the channel name in both downloaded cards and the inline player view.

## [4.19.0] - 2026-06-15

### Yeni Özellikler & İyileştirmeler / New Features & Improvements
- **Çoklu Dil Altyazı Desteği / Multi-language Subtitles Support:** Video indirilirken Türkçe ve İngilizce altyazı dosyalarının (`.tr.srt` ve `.en.srt`) otomatik olarak indirilmesi ve video dosyasıyla aynı klasörde aynı isimle kaydedilmesi sağlandı. / Enabled automatic downloading of Turkish and English subtitles (`.tr.srt` and `.en.srt`) alongside videos. They are saved in the same directory using matching file names.
- **Akıllı Silme Mekanizması / Smart Subtitle Deletion:** Arayüzden bir video diskten silindiğinde, o videoya ait `.tr.srt`, `.en.srt` veya diğer tüm altyazı uzantıları otomatik olarak algılanıp video dosyasıyla birlikte temizlenir. / Implemented smart cleanup which automatically deletes associated `.tr.srt`, `.en.srt`, and other subtitle formats when a video is deleted via the interface.
- **Oynatıcılarda Dinamik Altyazı Menüsü & CC Butonu / Dynamic Subtitles Menu & CC Button in Players:** ArtPlayer, Plyr ve HTML5 oynatıcılarına dinamik altyazı dili seçme menüsü ve CC açma/kapatma butonları entegre edildi. Altyazılar stream edilerek oynatıcılara WebVTT biçiminde dinamik sunulmaktadır. / Integrated a dynamic subtitles selection menu and CC toggles into ArtPlayer, Plyr, and HTML5 players. Subtitles are dynamically converted to WebVTT format and streamed to the players.
- **Hata Dayanıklılığı ve Varlık Doğrulama / Error Resilience & Video Verification:** Altyazı indirme aşamasında oluşabilecek ağ veya 429 rate limit hataları yt-dlp indirme sürecini durdurmasın diye `--ignore-errors` eklenerek video indirme kararlılığı sağlandı. İndirme sonrasında video dosyasının diskteki varlığı doğrulanıp dosya yoksa durum başarısız olarak işaretlenir. / Added `--ignore-errors` to yt-dlp arguments to prevent subtitle rate-limit errors (e.g. 429) from aborting the video download. Added file existence checks to ensure successful video compilation on disk before marking downloads as completed.
- **Arayüz Odaklı Otomatik Yukarı Kaydırma / Automatic Scroll-to-Top:** İndirilenler sekmesindeki videoya tıklandığında veya sekmeler arasında geçiş yapıldığında, sayfanın dikey kaydırma konumu otomatik olarak en üste kaydırılarak video oynatıcının ekrana tam oturması sağlandı. / Added auto-scroll to top when clicking downloaded video items or switching tabs, ensuring the inline player starts fully visible in the viewport.

## [4.18.0] - 2026-06-15

### Yeni Özellikler & İyileştirmeler / New Features & Improvements
- **Windows Job Objects Entegrasyonu / Windows Job Objects Integration:** C# tepsi uygulaması (`tray.cs`) ve backend sürecine Windows Job Objects eklendi. Bu sayede tray kapatıldığında, çöktüğünde veya sonlandırıldığında, arka plandaki tüm backend ve alt süreçler (yt-dlp, ffmpeg) Windows tarafından yetim kalmadan otomatik temizlenir. / Integrated Windows Job Objects into the tray wrapper (`tray.cs`) to ensure the Node backend and all child processes (yt-dlp, ffmpeg) are automatically terminated by Windows if the parent tray application exits, crashes, or is killed.
- **YouTube Tarzı Bölünmüş Yerleşik Oynatıcı / YouTube-Style Split Inline Player:** İndirilenler sekmesinde video oynatılırken floating modal yerine, YouTube benzeri dikey iki sütunlu bir yerleşik oynatıcı düzeni devreye girer. Sol üstte aktif oynatıcı, sağında/altında indirilmiş diğer videoların çalma listesi sidebarı listelenir. / Implemented a YouTube-style split two-column layout for the Downloaded Videos tab. Clicking a downloaded video plays it in an inline player on the left, with other downloaded videos listed in a sidebar playlist on the right.
- **Dinamik Çalma Listesi & Filtre Entegrasyonları / Dynamic Playlist & Sidebar Filters:** Oynatma listesi sidebar'ının üst kısmına Tarih ve Boyut bazlı sıralama, Kanal Filtreleme ve Shorts videolarını göster/gizle seçenekleri eklendi. Bu filtreler ana listedeki filtrelerle çift yönlü senkronize çalışmaktadır. / Added Sorting (date/size), Channel Filter, and Shorts visibility toggle controls directly on top of the playlist sidebar. These filters sync bi-directionally with the main downloaded list filter parameters.
- **Klasör Aç Butonu ve Yerleşim İyileştirmeleri / Folder Button & Sizing Adjustments:** İndirilenler sekmesi üstündeki başlık ve açıklama metinleri kaldırılarak oynatıcının en üste sığması sağlandı. "İndirilenler Klasörünü Aç" butonu ise üst bar (topbar) içerisine ufak bir klasör simgesi olarak taşındı. Oynatıcının en-boy oranı 16:9 olarak sabitlenerek geniş ekranlardaki sağ-sol siyah barlar tamamen giderildi. / Removed downloaded tab headers to align player to the very top. Relocated the "Open Downloads Folder" button to the topbar as a clean icon-only button. Fixed player aspect ratio to strictly preserve 16:9 layout, preventing pillarbox/letterbox black bars on wider monitors.
- **Yerleşik Oynatıcı Klavye Kısayolları / Keyboard Shortcuts for Inline Player:** Gömülü oynatıcı klavye kısayollarının (Space ile durdur/oynat, yön tuşlarıyla sarma vb.) yerleşik oynatıcıda da çalışması sağlandı. / Enabled global player keyboard shortcuts (Space for play/pause, Arrow keys for seek, F for fullscreen, etc.) for the inline player layout.

## [4.17.0] - 2026-06-05

### Yeni Özellikler & İyileştirmeler / New Features & Improvements
- **SponsorBlock Oynatıcı Entegrasyonu / SponsorBlock Player Integration:** Ayarlar sekmesine yeni eklenen "SponsorBlock (Oynatıcı)" seçeneği sayesinde, yerel video dosyalarına dokunulmadan gömülü oynatıcıda (Plyr, ArtPlayer, HTML5) izleme esnasında sponsorlu ve reklam kısımları otomatik atlatılır. / Integrated SponsorBlock natively into the web player modal. A toggle button in the Settings menu lets you automatically skip sponsored segments and self-promotions in real-time for Plyr, ArtPlayer, and HTML5 players, without modifying the underlying downloaded files.
- **ArtPlayer Sponsor İşaretçileri / ArtPlayer Highlight Marks:** ArtPlayer seçili olduğunda atlatılacak sponsorlu kısımlar video ilerleme çubuğu (timeline) üzerinde görsel olarak işaretlenir. / When using ArtPlayer, skip segments are visually marked on the progress timeline.
- **Oynatıcı Sponsor Durum Çubuğu / Player Sponsor Status Bar:** Oynatıcı modalının başlığı altında, videodaki aktif sponsor segmentlerini ve atlanacak alanların sayısını gösteren küçük bir durum çubuğu eklendi. / Added a subtle status bar under the player title to display detected sponsor segments and skipping states.

## [4.16.0] - 2026-06-05

### Yeni Özellikler & İyileştirmeler / New Features & Improvements
- **Veritabanı RAM Önbelleklemesi / Database RAM Caching:** `db.json`, `configwin.ini` ve `channels.ini` dosyalarının son değişiklik tarihleri (`mtimeMs`) denetlenerek, disk üzerinde değişiklik olmadığında verinin doğrudan RAM önbelleğinden dönülmesi sağlandı. Disk I/O ve JSON ayrıştırma işlem yükü büyük oranda azaltıldı. / Implemented an in-memory cache for the database. The server now checks the modification time of the database and INI files, bypassing disk reads and parsing if they haven't changed.
- **Log Dosyası Rotasyonu / Log Rotation:** Aktif log dosyası boyutu `10MB` limitini aştığında, dosya otomatik olarak `.log.bak` şeklinde yedeklenip yeni bir temiz log dosyasına geçilerek disk doluluğu kontrol altına alındı. / Added automatic log file rotation. When the current log file size exceeds 10MB, it is backed up to `.log.bak` and a fresh log file is created.
- **Yerel Ağ Güvenlik Sınırlandırması / Localhost Network Binding:** Express sunucusunun ağ dinleme arabirimi `127.0.0.1` (localhost) olarak sınırlandırıldı. Dış ağlardan gelebilecek yetkisiz indirme paneli erişimleri engellendi. / Bound the Express server listener exclusively to `127.0.0.1` (localhost) to prevent unauthorized remote access to the downloader dashboard from the local network.

## [4.15.0] - 2026-06-05

### Yeni Özellikler & İyileştirmeler / New Features & Improvements
- **Kütüphane Hızlı Tarih Filtreleri / Library Quick Date Filters:** Kütüphane sekmesinde kanal filtreleri ve Shorts gösterimiyle aynı satırda yer alan hızlı süzme butonları ("Bugün", "Dün", "Son 2/3/4/5 Gün") eklendi. Filtreler tüm dil paketlerinde dinamik çalışmaktadır. / Added quick-filter buttons to the Library tab, aligned on the same row as the channel selector and shorts toggle, to dynamically filter videos by Today, Yesterday, or the Last 2/3/4/5 Days.
- **Seçici Dosya Boyutu Gösterimi / Selective File Size Display:** İndirilmemiş videoların altında gösterilen "Boyut: -- MB" etiketi gizlenerek liste temizliği sağlandı. İndirilmiş (tamamlanmış) videolarda boyut gösterimi aynen devam etmektedir. / Hidden the "Size: -- MB" label under undownloaded videos to declutter the list, while keeping it active for completed downloads.
- **Dinamik Kanal Logoları / Dynamic Channel Avatars:** Kütüphane ve İndirilenler sekmelerinde kanal isminin solundaki tv simgesi, dairesel ve renkli kanal profil avatar resmiyle değiştirildi. Logo bulunamadığında otomatik olarak tv simgesine geri dönen akıllı fallback mekanizması eklendi. / Replaced the tv icon next to channel names in video cards with circular, dynamic channel avatars served locally, falling back automatically to the TV icon if loading fails.

### Düzeltilen Hatalar / Fixed Bugs
- **İndirilmemiş Videolarda Silme Butonunun Gizlenmesi / Hiding Trash Icon on Undownloaded Videos:** Kütüphane sekmesinde indirilmemiş (tamamlanmamış) videoların üzerinde yer alan gereksiz çöp kutusu (silme) butonu gizlendi. Silme butonu artık yalnızca indirilmiş/tamamlanmış videolar için gösterilmektedir. / Hidden the unnecessary trash can (delete) icon for undownloaded videos in the Library tab. The delete button is now only shown for completed downloads.
- **Gömülü Oynatıcı Başlığının Korunması / Preserving Embedded Player Title:** Video oynatılırken filtreler arasında gezildiğinde veya dil güncellendiğinde, oynatıcı modalının başlığındaki video adının sıfırlanarak "Gömülü Video Oynatıcı" yazması engellendi. / Fixed a bug where switching library filters or updating language while a video is playing would reset the embedded player modal's title from the active video name back to generic "Embedded Video Player".


## [4.14.0] - 2026-06-05

### Yeni Özellikler & İyileştirmeler / New Features & Improvements
- **Kompakt Ayarlar Tasarımı / Compact Settings Layout:** Ayarlar sayfası dikey ve yatay boşlukları, form kontrollerinin paddingleri daraltılarak 2 sütunlu şık ve kompakt bir grid düzenine kavuşturuldu. / Redesigned the settings page into a clean, compact 2-column grid layout, reducing padding, margins, and form control sizes to fit nicely on a single screen page.
- **Kütüphane Filtrelemesi & Feed Temizliği / Library Filtering & Feed Cleanup:** Kütüphane geçmişinde ("Library" tab) sadece takip edilen kanalların videolarının gösterilmesi sağlandı. PD veya tekil link yapıştırma yoluyla indirilen takip dışı kanal videoları ise sadece "İndirilenler" (Downloaded) sekmesinde görünecek, böylece kütüphane geçmişinin şişmesi önlenecektir. / Filtered the Library feed to only display videos belonging to followed channels. Videos downloaded from untracked channels (via PD or direct links) are now displayed exclusively in the "Downloaded" tab to prevent Library feed bloat.
- **Plyr Player Mor Tema Rengi / Purple Plyr Theme Color:** Gömülü video oynatıcı (Plyr) kontrollerindeki ses seviyesi ve video ilerleme durum çubuğu rengi, uygulamanın ana mor rengine (`var(--primary)`) uyarlandı. / Overrode the default blue color of the Plyr player progress and volume bars to match the app's primary purple theme color.

### Düzeltilen Hatalar / Fixed Bugs
- **FFmpeg Otomatik Kurulum Kararlılığı / FFmpeg Auto Extraction Stability:** FFmpeg arşivden çıkarma sürecinde `tar` komutunun hata ve kapatma olaylarının çakışarak Powershell fallback sürecini çift tetiklemesi giderildi. Powershell hata kısıtlamaları güçlendirildi ve indirilen ZIP dosyaları için asgari boyut denetimi eklendi. / Fixed multiple subprocess triggers and promise race conditions caused by overlapping `tar` error and close events during extraction. Enhanced PowerShell error-action boundary checks and implemented zip file size verification.
- **Backend Exe Otomatik Kapatılması / Backend Process Auto-Termination:** Standart girdi (`stdin`) üzerinde `close` ve `end` olayları dinlenerek ana Tray uygulaması kapatıldığında `HaYTool-Backend.exe` sürecinin arkada yetim (orphaned) kalarak açık kalması önlendi. / Added stdin close and end listeners to automatically shut down the `HaYTool-Backend.exe` subprocess when the parent Tray wrapper application is closed.

## [4.13.3] - 2026-06-05

### Yeni Özellikler & İyileştirmeler / New Features & Improvements
- **Canlı Yayın Erteleme / Live Stream Postponing:** Aktif canlı yayınların yayın devam ederken indirilmeye çalışılması engellendi. Durumları kütüphanede `live` olarak işaretlenir ve periyodik RSS kontrollerinde yayın bittiği (normal video süresi aldığı) algılandığında otomatik olarak kuyruğa alınır. / Prevented downloading active live streams while they are still running. Their status is marked as `live` in the library, and once the stream ends (acquiring a normal duration) during periodic RSS checks, they are automatically queued for download.
- **configwin.ini İki Dilli Açıklamaları / Bilingual Comments in configwin.ini:** Yapılandırma dosyasındaki her ayarın üzerine ne işe yaradığını ve seçeneklerini açıklayan Türkçe ve İngilizce yorum satırları (#) eklendi. / Added bilingual (TR/EN) comment lines (#) explaining the function and valid options of each setting in the configuration file.
- **CLI ve Konsol Komut Sadeleştirmesi / CLI and Stdin Command Simplification:** Terminal ve Tray konsol komutları sadeleştirilerek tekilleştirildi ve çıktıları tamamen İngilizce yapıldı. Komutlar: `ton` (alternatif hız etkin), `toff` (alternatif hız pasif), `status` (sistem durumu), `pd <link>` (panodan/linkten indir) ve `clear` (konsolu temizle). / Simplified terminal and tray console commands, eliminating redundant aliases, and fully localized logs/outputs to English. Supported commands: `ton`, `toff`, `status`, `pd <link>`, and `clear`.
- **Tray.cs ComboBox Güncellemesi / Tray.cs ComboBox Sync:** C# Tray uygulamasındaki konsol komut listesi yeni sadeleştirilmiş CLI komutları ile senkronize edildi. / Aligned the predefined commands list dropdown inside the C# Tray console window with the new simplified CLI layout.

## [4.13.2] - 2026-06-04

### Yeni Özellikler & İyileştirmeler / New Features & Improvements
- **Çoklu Dil Port Çakışması Uyarısı / Multi-language Port Conflict Warning:** Port dolu olduğunda (`EADDRINUSE`) C# Tray uygulaması, veritabanından güncel dil seçimini okuyarak kullanıcının dilinde (`tr`, `en`, `es`, `de`, `pt`, `ru`, `ar`) net bir uyarı ekranı (`MessageBox`) göstermekte ve uygulamayı güvenle sonlandırmaktadır. / If the port is in use, the C# Tray application reads the active language setting to display a localized warning popup (`MessageBox`) and exits safely.
- **Dil Dropdown Seçeneklerinin Alfabetik Sıralanması / Alphabetical Language Dropdown Sorting:** Ayarlar sayfasındaki dil seçimi dropdown listesindeki diller, visual olarak göründükleri isimlerine göre dinamik olarak alfabetik sırada sıralanmaktadır. / The options in the language selector dropdown inside settings are now sorted alphabetically by their display text on page load.
- **Güncellenmiş Varsayılan Uygulama Ayarları / Updated Default Application Settings:** Sıfır kurulumda veya eksik yapılandırma dosyalarında, uygulamanın otomatik oluşturacağı ayarlar kullanıcının güncel ayarlarıyla (Varsayılan port 4141, RSS limiti 15, alternatif hız limiti 501, kontrol sıklığı 5 saniye vb.) eşitlendi. Ancak her sistemde çalışabilmesi için varsayılan indirme klasörü uygulama içi `download` olarak belirlendi. / The default application settings used on fresh installations or when config files are missing are now aligned with the user's settings (port 4141, RSS limit 15, check interval 5s, alternate speed limit 501, etc.), while keeping the default download path to a system-safe `"download"` folder relative to the workspace.

## [4.13.1] - 2026-06-04

### Düzeltilen Hatalar / Fixed Bugs
- **RSS Video ve Yayın Kaybolma Çözümü / RSS Video and Stream Missing Fix:** `yt-dlp` aracının flat-playlist modunda video/yayın tarihlerini boş döndürmesinden kaynaklanan, bu nedenle videoların ve canlı yayınların hatalı sıralanıp denetleme limiti (`rssLimit`) dışında kalarak kütüphanede gözükmemesi hatası giderildi. Artık ilk önce kanalın XML RSS akışındaki tarihler çekilerek `yt-dlp` çıktılarıyla eşleştirilmekte ve doğru tarih sıralamasıyla limit dahilinde taranmaktadır. / Fixed video and live stream missing/omission issues on watchlists caused by `yt-dlp` flat-playlist mode returning empty timestamps. The backend now fetches XML RSS feed dates first to map and sort combined videos and stream entries chronologically before applying limits.

## [4.13.0] - 2026-06-04

### Yeni Özellikler / New Features
- **Canlı Yayın Geçmişleri / Completed Live Streams:** yt-dlp taramalarına `/streams` sekmesi eklenerek tamamlanmış canlı yayın geçmişlerinin otomatik taranması ve indirilmesi sağlandı. / Added support for completed live streams by scanning both `/videos` and `/streams` tabs in yt-dlp.
- **Kanal Shorts Sınır Seçenekleri / Channel Shorts Limit Options:** Kanallara özel Shorts süre limiti seçenekleri 2/3/4/5/10/15 dakika gibi geniş bir yelpazeye çıkarıldı. / Expanded per-channel Shorts duration limits with options for 2, 3, 4, 5, 10, and 15 minutes.
- **Genişletilmiş Ayarlar Arayüzü / Responsive Settings Page:** Ayarlar tabı genişletilerek sağ taraftaki boşluk kaldırıldı ve alan tam ekran verimliliğiyle kullanıldı. / Widen settings page to fit container width, removing empty right side layout space.
- **Windows Bildirim Simge Desteği / Notification Custom Icon:** Video tamamlama bildirimlerine jenerik Windows simgesi yerine uygulamanın kendi simgesi (`icon.ico`) yerleştirildi. / Custom `icon.ico` is now loaded on native Windows toast balloon notifications.
- **Arka Plan Kanal Tarama / Background Sync:** "Şimdi Kanalları Yenile" butonu arka planda asenkron çalışacak şekilde güncellendi, böylece arayüzün donması engellendi. / The channel check sync route runs asynchronously in the background to prevent page hangs.

### Düzeltilen Hatalar & Temizlik / Fixed Bugs & Cleanups
- **Mind Vorteks & Geo-block Çözümü:** Bölgesel engelli kanalların eklenmesi ve taranmasındaki geo-block hataları, RSS XML yedek akışından gerçek kanal adını çözebilen fallback mekanizması ve hata izolasyonuyla kalıcı olarak çözüldü. / Fixed geo-blocking issues on restricted channels by introducing automatic fallback name resolution via RSS feed XML and isolating first-start scans.
- **Ölü Kod Temizliği / Dead Code Removal:** Arayüzde kullanılmayan eski global Shorts limit değişkenleri ve ayarlar yan menü CSS kuralları temizlenerek kod kalitesi optimize edildi. / Removed unused global Shorts limit logic and settings tab sidebar style properties.

---

## [4.12.1] - 2026-06-04

### Düzeltilen Hatalar / Fixed Bugs
- **İndirme Klasörü Seçimi / Folder Selection:** Windows PowerShell `-STA` (Single Threaded Apartment) uyumsuzluğu giderildi; "Klasör Seç" butonu artık çökmeden veya "Bağlantı Hatası" vermeden sorunsuz çalışıyor. / Fixed `.NET` `FolderBrowserDialog` crash in background Node.js process by forcing powershell `-STA` parameter.
- **Varsayılan Çerez Tercihi / Default Cookie Preference:** "Google Chrome" olan varsayılan çerez tercihi "Çerez Kullanma (none)" olarak değiştirildi ve mevcut kullancılar için otomatik olarak taşındı. / Default cookie option updated to "none" instead of "chrome" and automatically migrated for existing users.

---

## [4.12.0] - 2026-06-04

### Düzeltilen Hatalar / Fixed Bugs
- **CLI Sözdizimi Hatası Giderildi (SyntaxError: missing ) after argument list):** `server.js` satır 1157'deki `else` bloğunda, bilinmeyen bir komut girildiğinde gösterilen yardım metni yanlışlıkla `console.log(`` template literal'inin başlangıç karakteri atlanmış şekilde yazılmıştı. Bu durum Node.js'in `turtleon / turtleac / turtle-on` ifadesini aritmetik bölme/çıkarma işlemi olarak yorumlamasına yol açıyor ve uygulama hiç başlamıyor olmasına neden oluyordu. Template literal açılış backtick'i eklendi, CLI yardım metni tüm komutları kapsayacak şekilde genişletildi.
- **Fixed CLI SyntaxError (missing ) after argument list):** In `server.js` at line 1157, the help text displayed when an unknown command was entered inside the `else` block was mistakenly written without the opening backtick of a `console.log(\`` template literal. This caused Node.js to interpret `turtleon / turtleac / turtle-on` as arithmetic division/subtraction, crashing on startup before any server functionality could run. The opening backtick has been added and the CLI help text expanded to list all supported commands.

---

## [4.11.0] - 2026-06-03


### Yeni Özellikler & İyileştirmeler
- **HaYTooL YouTube Downloader Yeniden Markalama:** Uygulama adı tüm platformlarda, README'de ve dökümantasyonlarda "HaYTooL YouTube Downloader" olarak güncellendi.
- **Dosya ve Klasör Yapısı Düzenlemesi:** `yt-dlp` executable ve jenerik unix sürümleri dağınıklığı önlemek adına bağımsız `yt-dlp/` klasörüne taşındı. `ffmpeg` klasöründeki gereksiz `ffplay.exe` ve lisans/dokümantasyon dosyaları temizlenerek büyük oranda alan tasarrufu sağlandı.
- **Genişletilmiş Dil Desteği (Localization):** Mevcut dillere İspanyolca (`es`), Almanca (`de`), Portekizce (`pt`) ve Arapça (`ar`) dil paketleri eklendi. Dil menüsüne ülke bayrakları entegre edildi. İngilizce dilindeki bağlantı durumu ("Connection: Active") dil hatası giderildi.
- **Dinamik Sağ Tık Dil Senkronizasyonu:** Sistem tepsisi veya Windows sağ tık menüsündeki tetikleyiciler, uygulama içi dil değiştirildiğinde anlık olarak seçilen dille senkronize edilmektedir (yeniden başlatma gerektirmez).
- **Kanal Başına Geçmiş Videosu Sınırı:** Kütüphane arayüzünün ve veri tabanı bağlantılarının performansını artırmak amacıyla Ayarlar sayfasına "Kanal Başına" listeleme limiti (20, 50, 100 vb.) seçeneği getirildi.
- **Yedekleme ve Veri Yönetimi (Import/Export):** Takip edilen kanalların listesi artık standart JSON formatında (`channels_backup.json`) dışarı aktarılabilecek veya üzerine yazma/ekleme seçenekleriyle geri yüklenebilecek.
- **Log Sistemi Optimizasyonu:** `logs` klasöründeki dosya kalabalığı giderilerek tekil log dosyasına (`YYYY-MM-DD_HH-mm-ss.log`) düşürüldü. İnteraktif terminal konsolu arayüzündeki zaman damgası damgaları temizlenerek daha sade ve okunabilir konsol akışı sağlandı.
- **Yeni İkon ve Temizlik:** Projedeki eski `logo.ico` dosyası tamamen silindi, yeni tasarım `icon.ico` ana ikon olarak gömüldü ve C# tray wrapper `HaYTooL YT Downloader.exe` olarak derlendi.

---

## [4.10.0] - 2026-06-02

### Yeni Özellikler & İyileştirmeler
- **Taşınabilir Backend Motoru Entegrasyonu:** Sunucu ve CLI eylemleri artık sistemin jenerik `node` kurulumu yerine `bin\haytool-backend.exe` olarak özelleştirilmiş, gizli pencere modunda (`WindowStyle.Hidden`) çalışan standalone backend motoru üzerinden yürütülmektedir.
- **Sistem Başlangıcında Çalıştır (Start on Boot):** Tepsi sağ tık menüsüne Windows Registry (`HKCU\Software\Microsoft\Windows\CurrentVersion\Run`) ile entegre çalışan başlangıç ayarı eklendi. Varsayılan olarak kapalıdır.
- **Zaman/Tarih Gösterimi Karakter Sınırı Optimizasyonu:** Video kartlarında geçen gün sayısı gösterimleri Türkçe'de (Bugün, Dün, Xg) ve İngilizce'de (Today, Yest., Xd) formatlarında en fazla 3-5 karakteri kesinlikle aşmayacak şekilde optimize edildi.
- **Tam İngilizce Dil Yerelleştirmesi:** Ayarlar sayfasında Türkçe kalan tüm `<small>` açıklamaları, select `<option>` seçenekleri ve CLI bilgi kutusu dile göre tamamen dinamikleştirildi.
- **GitHub Link Entegrasyonu:** Üst panel ve Ayarlar sayfasındaki versiyon numarası (`v4.10.0`) tıklanabilir link haline getirilerek projenin resmi GitHub sayfasına bağlandı.

---

## [4.9.0] - 2026-06-02

### Yeni Özellikler & İyileştirmeler
- **Paste & Download Sekme Otomasyonu:** Üst paneldeki "PD" butonuyla veya C# tepsi sağ tık menüsündeki "Panodan İndir (Paste & Download)" seçeneğiyle indirme başlatıldığında, tarayıcının otomatik olarak "Kuyruk" sekmesine geçmesi sağlandı. Tarayıcı zaten açıksa, SSE (`switch_tab` olayı) üzerinden sayfa yenilenmeden geçiş tetiklenir.
- **Video Kartlarında Yüklenme Zamanı Bilgisi:** İndirilen/geçmişteki videoların altındaki boşluğa, videonun kaç gün önce yüklendiği bilgisi ("Bugün", "Dün", "X gün önce") eklendi. Dil seçeneğine bağlı olarak İngilizce dilinde de otomatik biçimlendirilir.
- **RTX Spark Log Temizliği & Çözümleme Düzeltmesi:** Loglarda sürekli `Eksik bilgiler çözümleniyor` mesajı basarak log kirliliğine neden olan yayın tarihi (`publishedAt`) çözümlenememe hatası düzeltildi. Süresi veya yayın tarihi çözümlenemeyen videolara 3 başarısız deneme sınırı konulup, tarih `'-'` yapılarak döngü durdurulmaktadır.
- **hayto pd CLI Desteği:** `hayto.bat` veya `hayto.ps1` aracılığıyla `hayto pd <link>` komutuyla kolayca indirme başlatma desteği sağlandı.

---

## [4.8.1] - 2026-06-02

### Düzeltilen Hatalar & İyileştirmeler
- **CLI Çıktı Karakter Kodlaması (UTF-8):** `HaYTool.exe` CLI arayüzünün çıktı yönlendirmesi UTF-8 olarak güncellendi. Bu sayede `[SİSTEM] Durum` çıktısındaki `SĞ-STEM` veya `S-STEM` gibi Türkçe karakter bozulmaları giderildi.
- **CLI İstemi Geri Dönüşü (Prompt Release):** Windows terminalinde `HaYTool.exe` CLI komutu girildikten sonra komut satırının takılı kalması ve Enter tuşuna basma gereksinimi giderildi. Program sonlandığında `FreeConsole()` ile konsoldan ayrılma ve Win32 `keybd_event` ile otomatik `ENTER` tuşu simülasyonu tetiklenerek kontrol terminale anında devredilmektedir.
- **Kılavuz Düzenlemeleri:** `README.md` dosyasındaki CLI komut örnekleri, `haytool status`, `haytool speed 2500` gibi tam ve yazılabilir komut formatında baştan aşağı düzenlendi.

---

## [4.8.0] - 2026-05-30

### Yeni Özellikler
- **Alternatif Hız Sınırı (Turtle Mode):** qBittorrent benzeri iki farklı hız profili desteği eklendi. Normal indirme hızı ve kaplumbağa simgesi ile gösterilen alternatif hız limiti bağımsız olarak kontrol edilebilmektedir.
- **Ayarlar Sayfası Debounceli Otomatik Kaydetme:** Manuel kaydet butonu kaldırılarak, yapılan tüm ayar değişikliklerinin 500ms debounce ile anlık asenkron kaydedilmesi sağlandı.
- **Sistem Tepsisi Sekme Kısayolları:** Tepsi menüsüne doğrudan Kütüphane, İndirme Sırası, İndirilenler, Kanallar ve Ayarlar sekmelerine geçiş sağlayan kısayollar eklendi.
- **İnteraktif Konsol Paneli:** Sistem tepsisi konsol penceresine stdin üzerinden sunucuya komut gönderme paneli entegre edildi.
- **Sistem Tepsisi Alternatif Hız Toggle:** Sistem tepsisi sağ tık menüsüne hız sınırını değiştiren işaretlenebilir buton eklendi.

### Optimizasyonlar & Temizlik
- **Log Otomatik Temizliği:** Sunucu her başladığında 7 günden eski günlük `.log` dosyalarını otomatik olarak temizleyen temizlik işleyicisi entegre edildi.
- **Görsel Varlıkların Güncellenmesi:** Uygulama logosu ve sistem tepsisi simgesi yeni tasarımlarla güncellendi. Artık kullanılmayan `Baslat.bat` temizlendi.
- **CLI Desteği:** `HaYTool.exe` ve `server.js` üzerinden terminal yardımıyla anlık durum kontrolü ve limit ataması özelliği eklendi.
