// Türkçe Açıklama: Uygulama dili Türkçe ('tr') dışında bir dil seçildiğinde sunucu konsol çıktılarını,
// terminal günlüklerini ve CLI yanıtlarını dinamik değerleri ('"Başlık"', süreler, URL'ler) koruyarak İngilizceye çevirir.
import { configIniPath, parseIni } from '../config.js';

let currentLang = 'tr';

try {
  const cfg = parseIni(configIniPath);
  const sec = (cfg && (cfg.Settings || cfg)) || {};
  const iniLang = sec.lang || sec.language;
  if (typeof iniLang === 'string' && iniLang.trim()) {
    currentLang = iniLang.trim().toLowerCase();
  }
} catch {
  // Yapılandırma henüz yoksa varsayılan 'tr' korunur
}

/**
 * Aktif konsol çeviri dilini günceller.
 * @param {string} lang - Dil kodu ('tr', 'en', 'de', vb.)
 */
export function setConsoleLang(lang) {
  if (typeof lang === 'string' && lang.trim()) {
    currentLang = lang.trim().toLowerCase();
  }
}

/**
 * Geçerli konsol dil kodunu döner.
 * @returns {string}
 */
export function getConsoleLang() {
  return currentLang;
}

/**
 * Türkçe dışındaki herhangi bir dilde konsolun İngilizce çalışıp çalışmayacağını döner.
 * @returns {boolean}
 */
export function isEnglishConsole() {
  return currentLang !== 'tr';
}

// Köşeli parantez etiket eşlemeleri (uzun/özel etiketler önce)
const TAG_REPLACEMENTS = [
  ['[Kanal Kontrolü UYARI]', '[Channel Check WARN]'],
  ['[Kanal Kontrolü Hata]', '[Channel Check ERROR]'],
  ['[Kanal Kontrolü]', '[Channel Check]'],
  ['[RSS Paralel]', '[RSS Parallel]'],
  ['[RSS Fallback]', '[RSS Fallback]'],
  ['[RSS HATA]', '[RSS ERROR]'],
  ['[Shorts Filtresi]', '[Shorts Filter]'],
  ['[İndirme Başarılı]', '[Download Success]'],
  ['[İndirme Hatası]', '[Download Error]'],
  ['[İndirme Fallback]', '[Download Fallback]'],
  ['[İNDİRME]', '[DOWNLOAD]'],
  ['[Uzak Durum]', '[Remote Status]'],
  ['[Birleştirme Kuyruğu]', '[Merge Queue]'],
  ['[Kuyruk Auto-Retry]', '[Queue Auto-Retry]'],
  ['[Kuyruk]', '[Queue]'],
  ['[403 Koruması]', '[403 Protection]'],
  ['[Oyun Modu]', '[Game Mode]'],
  ['[Sistem Açılışı]', '[Startup]'],
  ['[Sistem]', '[System]'],
  ['[Ayarlar]', '[Settings]'],
  ['[Güncelleme]', '[Update]'],
  ['[Motor]', '[Engine]'],
  ['[Çerez Sağlık]', '[Cookie Health]'],
  ['[CANLI YAYIN]', '[LIVE STREAM]'],
  ['[CANLI]', '[LIVE]'],
  ['[Oto-Silme Onaylandı]', '[Auto-Delete Confirmed]'],
  ['[Oto-Silme Ertelendi]', '[Auto-Delete Postponed]'],
  ['[Oto-Silme]', '[Auto-Delete]'],
  ['[Silinen Videolar]', '[Deleted Videos]'],
  ['[Silme Uyarı]', '[Delete Warn]'],
  ['[Silme]', '[Delete]'],
  ['[Tekrar İndir]', '[Redownload]'],
  ['[Log Temizleyici]', '[Log Cleaner]'],
  ['[API] [YAVAŞ]', '[API] [SLOW]'],
  ['[Yakalanmamış Promise Hatası]', '[Unhandled Promise Rejection]'],
  ['[Yakalanmamış İstisna]', '[Uncaught Exception]'],
  ['[Yakalanmamış promise:', '[Unhandled promise:'],
  ['[yt-dlp Uyarı]', '[yt-dlp Warn]'],
  ['[HATA]', '[ERROR]'],
  ['[UYARI]', '[WARN]'],
  ['[GİRDİ]', '[INPUT]'],
  ['[KOMUT]', '[CMD]'],
  ['[Abone & Avatar', '[Subs & Avatar'],
  ['[Kanal Logosu', '[Channel Logo'],
  ['[Abone Sayısı', '[Subscribers']
];

// Kalıp tabanlı cümle çevirileri (dinamik kanal/video adları, süre ve sayılar korunur)
const PHRASE_RULES = [
  // RSS & Shorts & Canlı Yayın
  [
    /("[^"]+") kanalında Shorts indirme kapalı \(([^)]+)\)\. Atlandı: ("[^"]+")/g,
    'Shorts disabled for channel $1 ($2). Skipped: $3'
  ],
  [
    /("[^"]+") kanalında Shorts indirme kapalı \(([^)]+)\), videoya dönüşen yayın atlandı: ("[^"]+")/g,
    'Shorts disabled for channel $1 ($2), skipped converted stream: $3'
  ],
  [
    /("[^"]+") kanalında otomatik indirme kapalı, videoya dönüşen yayın atlandı: ("[^"]+")/g,
    'Auto-download disabled for channel $1, skipped converted stream: $2'
  ],
  [
    /("[^"]+") kanalında otomatik indirme kapalı\. Atlandı: ("[^"]+")/g,
    'Auto-download disabled for channel $1. Skipped: $2'
  ],
  [
    /("[^"]+") kanalında canlı yayın\/prömiyer kullanıcı ayarı gereği atlandı: ("[^"]+")/g,
    'Live stream/premiere skipped per user settings on channel $1: $2'
  ],
  [
    /("[^"]+") kanalında canlı yayın tespit edildi, VOD kaydına dönüşmesi bekleniyor: ("[^"]+")/g,
    'Live stream detected on $1, deferring until VOD conversion: $2'
  ],
  [
    /("[^"]+") kanalında yaklaşan prömiyer\/yayın tespit edildi, yayın bitene kadar takip ediliyor: ("[^"]+")/g,
    'Upcoming premiere/stream detected on $1, tracking until broadcast finishes: $2'
  ],
  [
    /("[^"]+") kanalında yaklaşan yayın tespit edildi, yayın bitene kadar takip ediliyor: ("[^"]+")/g,
    'Upcoming broadcast detected on $1, tracking until finished: $2'
  ],
  [
    /("[^"]+") kanalında canlı yayın tespit edildi, anında indirme kuyruğuna alınıyor: ("[^"]+")/g,
    'Live stream detected on $1, queueing for instant download: $2'
  ],
  [
    /("[^"]+") kanalında aktif canlı yayın tespit edildi, anında indirme kuyruğuna alınıyor: ("[^"]+")/g,
    'Active live stream detected on $1, queueing for instant download: $2'
  ],
  [
    /("[^"]+") kanalında video süresi henüz çözülmedi ve Shorts kapalı\. Süre analizi bekleniyor: ("[^"]+")/g,
    'Duration unresolved and Shorts disabled on $1. Awaiting duration check: $2'
  ],
  [
    /("[^"]+") kanalında tarihi geçmiş eski video tespit edildi, kuyruğa alınmadı: ("[^"]+")/g,
    'Historical video skipped on $1: $2'
  ],
  [
    /("[^"]+") kanalında yaklaşan yayın CANLI olarak başladı: ("[^"]+")/g,
    'Upcoming stream is now LIVE on $1: $2'
  ],
  [
    /("[^"]+") kanalında canlı\/yaklaşan yayın normal videoya dönüştü \(([^)]+)\): ("[^"]+")/g,
    'Live/upcoming broadcast converted to VOD ($2) on $1: $3'
  ],
  [
    /("[^"]+") yeni video süre detayı çekilemedi \(([^)]+)\):/g,
    'Failed to fetch new video duration details on $1 ($2):'
  ],
  [
    /("[^"]+") yeni video süre bilgisi alınamadı \(([^)]+)\):/g,
    'Failed to fetch new video duration info on $1 ($2):'
  ],
  [
    /("[^"]+") canlı\/yaklaşan yayın durumu kontrol edilemedi \(([^)]+)\):/g,
    'Failed to check live/upcoming status on $1 ($2):'
  ],
  [/(\d+) kanal için ⚡ Hızlı Tarama başlatılıyor\.\.\./g, 'Starting ⚡ Fast Scan for $1 channels...'],
  [/Kanallar kontrol ediliyor\.\.\. \((\d+)\/(\d+) - %(\d+)\)/g, 'Checking channels... ($1/$2 - $3%)'],
  [
    /Hızlı Tarama tamamlandı: (\d+) kanal ([\d.]+) saniyede kontrol edildi\. (\d+) yeni video bulundu\./g,
    'Fast Scan completed: $1 channels checked in $2s. $3 new videos found.'
  ],
  [/Tüm kanallar denetleniyor \(([^)]+)\)\.\.\./g, 'Checking all channels ($1)...'],
  [/Tüm kanallar denetleniyor \(Kaynak: ([^)]+)\)\.\.\./g, 'Checking all channels (Source: $1)...'],
  [/Yeni video keşfedildi ve kuyruğa ekleniyor:/g, 'New video discovered and queued:'],
  [/Yeni video keşfedildi \(([^)]+)\):/g, 'New video discovered ($1):'],
  [/Yeni video keşfedildi:/g, 'New video discovered:'],
  [/Yaklaşan\/Canlı yayın videoya dönüştü:/g, 'Live/upcoming stream converted to video:'],
  [/Yaklaşan\/Canlı yayın artık normal video halinde yayında:/g, 'Live/upcoming stream is now available as VOD:'],
  [/yayını CANLI olarak başladı!/g, 'broadcast is now LIVE!'],
  [/Kuyruğa alındı:/g, 'Queued:'],
  [/Süre filtresinden geçti, kuyruğa alındı:/g, 'Passed duration filter, queued:'],
  [/yt-dlp yedek süre tespiti başarılı:/g, 'yt-dlp fallback duration resolved:'],
  [/yt-dlp yedek süre tespiti de başarısız:/g, 'yt-dlp fallback duration also failed:'],
  [/yt-dlp yedek süre tespiti:/g, 'yt-dlp fallback duration:'],
  [/Bekleyen süre analizleri tamamlandı\. Ertelenen kanal taraması \(([^)]+)\) otomatik başlatılıyor\.\.\./g, 'Pending duration checks finished. Resuming deferred channel check ($1)...'],
  [/Süresi çözümlenmemiş videolar bulunduğu için kanal taraması ertelendi \(YouTube ban koruması\)\. Eksik süreler analiz ediliyor\.\.\./g, 'Channel scan deferred due to unresolved video durations (ban protection). Analyzing...'],
  [/Aktif video indirmesi veya dönüştürme devam ettiği için kanal taraması ertelendi \(YouTube ban koruması\)\./g, 'Channel scan deferred while active download/conversion is running (ban protection).'],
  [/Kanal bilgisi \(abone\/avatar\) güncellemesi devam ettiği için video RSS taraması ertelendi \(Kaynak: ([^)]+)\)\./g, 'Channel scan deferred while channel metadata update is active (Source: $1).'],
  [/Zaten devam eden bir RSS taraması var \(Kaynak: ([^)]+)\)\. Yeni istek atlandı\./g, 'RSS scan already in progress (Source: $1). Skipped duplicate trigger.'],
  [/Önceki RSS taraması zaman aşımına uğradığı için kilit sıfırlandı\./g, 'Previous RSS scan timed out; lock reset.'],
  [/beklemedeki yaklaşan\/canlı yayın denetleniyor\.\.\./g, 'pending upcoming/live streams being checked...'],
  [/yayını gizli\/üyelere özel veya silinmiş olduğu için takipten çıkarıldı\./g, 'removed from tracking (private/members-only/deleted).'],
  [/için XML denemesi başarısız/g, 'XML feed attempt failed'],
  [/yt-dlp yedeğine geçiliyor\.\.\./g, 'falling back to yt-dlp...'],
  [/taranamadı/g, 'scan failed'],
  [/atlandı/g, 'skipped'],

  // Sistem açılışı, veritabanı, güncelleme, disk, IPTV
  [/Sunucu başarıyla başlatıldı\. Adres:/g, 'Server started successfully. URL:'],
  [/Otomatik indirme klasörü:/g, 'Download directory:'],
  [/yt-dlp\.exe doğrulandı ve hazır\./g, 'yt-dlp.exe verified and ready.'],
  [/yt-dlp doğrulandı ve hazır\./g, 'yt-dlp verified and ready.'],
  [/yt-dlp motoru güncel/g, 'yt-dlp engine is up to date'],
  [/yt-dlp motor güncellemesi denetleniyor/g, 'Checking yt-dlp engine updates'],
  [/yt-dlp kontrolü başarısız oldu:/g, 'yt-dlp check failed:'],
  [/Yazılım güncel:/g, 'Software is up to date:'],
  [/Yeni sürüm mevcut:/g, 'New version available:'],
  [/GitHub API hız sınırı aşıldı, kontrol ertelendi\./g, 'GitHub API rate limit reached, check deferred.'],
  [/Standart giriş kapandı \(stdin close\)\. Backend sonlandırılıyor\.\.\./g, 'Standard input closed (stdin close). Terminating backend...'],
  [/Standart giriş sona erdi \(stdin end\)\. Backend sonlandırılıyor\.\.\./g, 'Standard input ended (stdin end). Terminating backend...'],
  [/sinyali alındı, sunucu nazikçe kapatılıyor\.\.\./g, 'signal received, shutting down gracefully...'],
  [/HTTP sunucu bağlantıları kapatıldı\./g, 'HTTP server connections closed.'],
  [/Zaman aşımı: Sunucu zorla kapatılıyor\./g, 'Timeout: Forcing server shutdown.'],
  [/Önceki oturumdan kalan (\d+) adet işlem düzeltildi \('waiting' durumuna alındı\)\./g, 'Recovered $1 interrupted item(s) from previous session (moved to waiting).'],
  [/Önceki oturumda yarıda kalan (\d+) adet birleştirme işi 'Birleştirme Bekliyor' durumuna geri alındı\./g, 'Recovered $1 interrupted merge job(s) back to pending_merge.'],
  [/Sunucu başlangıcında (\d+) adet yarım kalan\/bekleyen indirme kuyruğa yeniden eklendi\./g, 'Re-queued $1 pending/interrupted download(s) on startup.'],
  [/7 günden eski (\d+) adet log dosyası silindi\./g, 'Deleted $1 log file(s) older than 7 days.'],
  [/kanal önbellekten başarıyla yüklendi\./g, 'channel(s) loaded from cache.'],
  [/Otomatik tarayıcı açılışı devre dışı bırakıldı\. Lütfen ([^\s]+) adresine el ile gidin\./g, 'Auto-open browser disabled. Please navigate manually to $1.'],

  // Kuyruk / İndirme / Konsol Komutları
  [/CLI komutu ile indirme kuyruğu duraklatıldı\./g, 'Download queue paused via CLI.'],
  [/CLI komutu ile indirme kuyruğu devam ettiriliyor\./g, 'Download queue resumed via CLI.'],
  [/İndirme sırası duraklatıldı\./g, 'Download queue paused.'],
  [/İndirme sırası devam ettiriliyor\./g, 'Download queue resumed.'],
  [/Kapatma komutu alındı\. Sunucu sonlandırılıyor\.\.\./g, 'Shutdown command received. Stopping server...'],
  [/Ayrıntılı API HTTP günlüğü AÇILDI\./g, 'Verbose API HTTP logging ENABLED.'],
  [/Ayrıntılı API HTTP günlüğü KAPATILDI\./g, 'Verbose API HTTP logging DISABLED.'],
  [/Bu oturumda henüz hata veya uyarı kaydedilmedi\./g, 'No errors or warnings recorded in this session yet.'],
  [/Son (\d+) Hata \/ Uyarı \(Toplam hafıza: (\d+)\):/g, 'Last $1 Errors / Warnings (Total buffered: $2):'],
  [/Sistem Tanı Raporu:/g, 'System Diagnostics Report:'],
  [/Sürüm & Port/g, 'Version & Port'],
  [/Çalışma & RAM/g, 'Uptime & RAM'],
  [/Araçlar\s*:/g, 'Tools          :'],
  [/Çerez & API/g, 'Cookie & API'],
  [/Dizin & Disk/g, 'Paths & Disk'],
  [/Oturum Logu/g, 'Session Log'],
  [/Henüz test edilmedi/g, 'Not tested yet'],
  [/Sağlıklı/g, 'Healthy'],
  [/Geçersiz \/ Yenileme Gerekli/g, 'Invalid / Refresh Needed'],
  [/Bilinmiyor/g, 'Unknown'],
  [/GB boş/g, 'GB free'],
  [/Hazır/g, 'Ready'],
  [/Eksik/g, 'Missing'],
  [/Kuyruk Özeti \(Aktif: (\d+) \| Bekleyen: (\d+) \| Birleştirme: (\d+) \| Durum: ([^)]+)\)/g, 'Queue Summary (Active: $1 | Waiting: $2 | Merge: $3 | State: $4)'],
  [/\[AKTİF\]/g, '[ACTIVE]'],
  [/Sistem Durumu:/g, 'System Status:'],
  [/İndirme Kuyruğu:/g, 'Download Queue:'],
  [/Aktif İndirme:/g, 'Active Download:'],
  [/Oyun Modu \(Ertelenmiş FFmpeg\):/g, 'Game Mode (Deferred FFmpeg):'],
  [/Normal Hız Limiti:/g, 'Normal Speed Limit:'],
  [/Alternatif Hız Limiti:/g, 'Alternative Speed Limit:'],
  [/Alternatif Hız \(Turtle\):/g, 'Turtle Speed Mode:'],
  [/Geçerli Hız Limiti:/g, 'Effective Speed Limit:'],
  [/Fakap Otomatik Yedek:/g, 'Fakap Auto Backup:'],
  [/Otomatik İndirme:/g, 'Auto Download:'],
  [/Bekleyen: (\d+)/g, 'Waiting: $1'],
  [/Bekleyen Birleştirme: (\d+)/g, 'Pending Merges: $1'],
  [/Limitsiz/g, 'Unlimited'],
  [/Boşta \(Yok\)/g, 'Idle (None)'],
  [/İndiriliyor \(/g, 'Downloading ('],
  [/AÇIK \(Birleştirme Erteleniyor\)/g, 'ON (Deferred Merge)'],
  [/KAPALI \(Otomatik Birleştirme\)/g, 'OFF (Auto Merge)'],
  [/Kullanılabilir CLI & Konsol Komutları:/g, 'Available CLI & Console Commands:'],
  [/Bilinmeyen komut:/g, 'Unknown command:'],
  [/Bunu mu demek istediniz:/g, 'Did you mean:'],
  [/Komut rehberi için "help" veya "\?" yazabilirsiniz\./g, 'Type "help" or "?" for the command reference.'],
  [/Hata: "([^"]+)" komutu için geçersiz parametre:/g, 'Error: Invalid argument for "$1":'],
  [/Geçerli kullanım:/g, 'Valid usage:'],
  [/Hata: Geçerli bir pozitif tam sayı girmelisiniz\./g, 'Error: Please enter a valid positive integer.'],
  [/Hata: Geçerli bir sayı girmelisiniz\./g, 'Error: Please enter a valid number.'],
  [/Pencere öne getiriliyor\./g, 'Bringing window to front.'],
  [/Pencere sistem tepsisine gizleniyor\./g, 'Minimizing window to system tray.'],
  [/Sistem tepsisi simgesi görünür yapıldı\./g, 'System tray icon ensured visible.'],
  [/İşlenmeyen sunucu hatası:/g, 'Unhandled server error:'],
  // Uzak Durum Tarayıcı (YouTube)
  [/İndirilmiş YouTube videoları taranıyor \(Toplam: (\d+)\)\.\.\./g, 'Scanning downloaded YouTube videos (Total: $1)...'],
  [/Taranacak uygun indirilmiş YouTube videosu bulunamadı\./g, 'No eligible downloaded YouTube videos found to scan.'],
  [/Değişiklik tespit edildi: ("[^"]+") -> ([A-Z_]+)(.*)/g, 'Status change detected: $1 -> $2$3'],
  [/Tarama kullanıcı tarafından iptal ediliyor\.\.\./g, 'Scan cancellation requested by user...'],
  [/Tarama iptal edildi \((\d+)\/(\d+) kontrol edildi, (\d+) değişiklik\)\./g, 'Scan cancelled ($1/$2 checked, $3 changes).'],
  [/Tarama tamamlandı: (\d+) video kontrol edildi, (\d+) değişiklik \(Silinen: (\d+), Liste Dışı: (\d+), Gizli: (\d+), Üyelere Özel: (\d+)\)\./g, 'Scan completed: $1 videos checked, $2 changes (Deleted: $3, Unlisted: $4, Private: $5, Members-only: $6).'],
  [/Tarama sırasında hata:/g, 'Error during scan:']
];

/**
 * Verilen konsol metnini aktif dile göre (Türkçe dışı dillerde İngilizce) çevirir.
 * Dinamik verileri (video/kanal adları, ID'ler, URL'ler, dosya yolları) korur.
 *
 * @param {string} text - Çevrilecek konsol satırı
 * @returns {string}
 */
export function translateConsoleLog(text) {
  if (typeof text !== 'string' || !text) return text;

  const trayLangMatch = text.match(/\[TRAY_CMD\]\s*lang=([a-zA-Z_-]+)/i);
  if (trayLangMatch) {
    setConsoleLang(trayLangMatch[1]);
    return text;
  }
  if (text.includes('[TRAY_CMD]')) {
    return text;
  }

  if (!isEnglishConsole()) {
    return text;
  }

  let out = text;
  for (const [trTag, enTag] of TAG_REPLACEMENTS) {
    if (out.includes(trTag)) {
      out = out.split(trTag).join(enTag);
    }
  }
  for (const [pattern, replacement] of PHRASE_RULES) {
    out = out.replace(pattern, replacement);
  }
  return out;
}
