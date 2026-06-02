# Changelog - Sürüm Günlüğü

Bu dosyada, HaYTool Youtube Download uygulamasında yapılan geliştirmeler, hata düzeltmeleri ve optimizasyonlar sürüm bazlı olarak listelenmektedir.

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
