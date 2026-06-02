# Changelog - Sürüm Günlüğü

Bu dosyada, HaYTool Youtube Download uygulamasında yapılan geliştirmeler, hata düzeltmeleri ve optimizasyonlar sürüm bazlı olarak listelenmektedir.

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
