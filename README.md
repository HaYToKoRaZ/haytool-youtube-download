# HaYTool Youtube Download

Bu yazılım, YouTube kanallarını otomatik olarak izleyen ve bu kanallara yüklenen yeni videoları arka planda otomatik olarak indiren şık, hafif ve kararlı bir otomasyon sistemidir.

Yazılımın tasarımı, işleyişi ve tüm yapısı **HaYTo** imzasını taşımaktadır.

---

## 🚀 Özellikler

* **Otomatik Kanal İzleme:** RSS akışları veya yedek `yt-dlp` flat-playlist mekanizması ile kanalların yeni videolarını sürekli denetler.
* **Akıllı İndirme Kuyruğu:** Videoları sırayla indirir, çakışmaları engeller ve sunucu başlangıcında yarım kalan indirmeleri otomatik olarak kaldırıldığı yerden sürdürür.
* **Kompakt ve Sade Navigasyon:** Üst bar menü başlıkları tek satıra sığacak şekilde optimize edilmiştir (**Kütüphane**, **Kuyruk**, **İndirilenler**, **Kanallar**, **Ayarlar**).
* **Tek Satır Durum Rozetleri:** Video kalitesi, boş alan göstergesi, premium çerez durumu ve bağlantı gibi sistem durum rozetleri ekran daralsa dahi çift satıra kaymaz.
* **Gelişmiş Kategorize Edilmiş Ayarlar:** Tüm sistem yapılandırmaları 4 kolay kategoriye (Genel Ayarlar, İndirme ve Kalite, Otomasyon & RSS, Çerez & Bildirim) ayrılmış dikey menülü panel üzerinden yönetilir.
* **Hızlı Geri Bildirim:** Ayarlar menüsünün sol alt tarafındaki tek tıkla e-posta uygulamasını açan geri bildirim butonu ile hızlıca geliştiriciye (`korazhayto@gmail.com`) ulaşabilirsiniz.
* **Gömülü ve Sistem Oynatıcısı:** Videoları dilerseniz tarayıcı üzerinden gömülü oynatıcıda (Plyr), dilerseniz de işletim sisteminizin varsayılan medya oynatıcısında (VLC, KMPlayer vb.) tek tıkla açın.
* **Mouse Tekerleği ile Ses Ayarı:** Gömülü oynatıcıda mouse tekerleğiyle ses seviyesini %1 hassasiyetle kontrol edebilirsiniz.
* **Akıllı Kaldığı Yeri Hatırlama:** Bir videoyu izlerken kapattığınızda, oynatıcı sonraki açılışta nerede kaldığınızı hatırlar.
* **Shorts Desteği:** Shorts videolarını isteğe göre filtreleyebilir, kütüphanede ayrı bir dikey tasarımda görüntüleyebilirsiniz. Kanala özel Shorts indirme seçeneği mevcuttur.
* **"PD" (Yapıştır & İndir):** Panodaki veya girilen herhangi bir YouTube video bağlantısını anında analiz edip indirme sırasına ekler.
* **Otomatik Bağımlılık Yönetimi:** `yt-dlp.exe` ve `ffmpeg` gibi harici araçlar eksikse sistem başlangıcında arka planda otomatik olarak indirilir ve kurulur.
* **Hafif ve Vanilla Yapı:** Harici ağır kütüphanelere bağımlı olmaksızın, tamamen saf (vanilla) JavaScript, CSS ve HTML5 standartlarıyla geliştirilmiştir.

---

## 🛠️ Kurulum ve Çalıştırma

### Windows:
1. **Bağımlılıkları Yükleyin:**
   ```bash
   npm install
   ```
2. **Uygulamayı Başlatın:**
   Proje kök dizinindeki `Baslat.bat` dosyasına çift tıklayarak veya terminalden aşağıdaki komutla başlatabilirsiniz:
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
* **`configunix.ini`:** Linux, macOS veya diğer Unix tabanlı işletim sistemlerinde çalışırken kullanılan ayarlar dosyasıdır.
* **`channels.ini`:** İzlenen kanalların listesini, eklenme tarihlerini ve kanala özel indirme kalitesi ile Shorts ayarlarını ortak tutar.
* **`db.json`:** İndirme geçmişi, aktif durumlar ve diğer dinamik verileri tutan hafif yerel veritabanıdır. Her iki işletim sisteminde de ortak kullanıldığı için mükerrer (çift) indirme yapılması engellenir.

---

## 📞 Destek ve Hata Raporlama

Uygulamayla ilgili herhangi bir hata durumunda, geri bildirimde bulunmak veya destek almak için resmi iletişim adresi:

📧 **korazhayto@gmail.com**

---
*Geliştirici & Tasarımcı: **HaYTo***
*Sürüm: **v4.4***
