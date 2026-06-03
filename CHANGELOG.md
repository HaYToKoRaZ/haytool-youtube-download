# Changelog - Sürüm Günlüğü

Bu dosyada, HaYTool Youtube Download uygulamasında yapılan geliştirmeler, hata düzeltmeleri ve optimizasyonlar sürüm bazlı olarak listelenmektedir.

---

## [4.11.1] - 2026-06-03

### Düzeltilen Hatalar & İyileştirmeler
- **C# Sağ Tık Menüsü Güncellemeleri:** Sağ tık menüsüne "Log Klasörünü Aç" ("Open Log Folder") seçeneği eklendi. Türkçe arayüzdeki "Panodan İndir (Paste & Download)" seçeneği "Panodan İndir" olarak sadeleştirildi. Tüm diller için sağ tık çevirileri entegre edildi.
- **İngilizce Konsol Çıktıları:** Sunucu konsolundaki logların ve hata mesajlarının tamamı global standartlara uygun olacak şekilde İngilizce'ye çevrildi.
- **Yerel Bayrak İkonları:** Dil seçenekleri menüsündeki bayrakların çevrimdışı (offline) modda da sorunsuz gözükmesi için flagcdn CDN yerine yerel olarak sunulan görsel dosyaları (`public/flags/`) entegre edildi.
- **Hata Düzeltmeleri:** CLI yardım çıktısı yazdırılırken oluşan SyntaxError giderildi.

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
