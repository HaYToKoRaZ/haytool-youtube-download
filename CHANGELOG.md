# Changelog - Sürüm Günlüğü

Bu dosyada, HaYTool Youtube Download uygulamasında yapılan geliştirmeler, hata düzeltmeleri ve optimizasyonlar sürüm bazlı olarak listelenmektedir.

---

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
