// Türkçe Açıklama: INI yapılandırma dosyalarını okuma, yazma ve ayrıştırma işlemlerini gerçekleştiren yardımcı modül.
import os from 'os';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

export const configIniName = os.platform() === 'win32' ? 'configwin.ini' : 'configunix.ini';
export const configIniPath = path.join(rootDir, configIniName);
export const channelsIniPath = path.join(rootDir, 'channels.ini');
export const categoriesIniPath = path.join(rootDir, 'categories.ini');

/**
 * Belirtilen INI dosyasını okuyup JavaScript nesnesi (JSON) olarak ayrıştırır.
 * Açıklama satırlarını (; veya #) ve boşlukları göz ardı eder.
 * 
 * @param {string} filePath INI dosyasının tam yolu
 * @returns {object} Ayrıştırılmış INI verisi (anahtar-değer çiftleri)
 */
export function parseIni(filePath) {
  if (!fs.existsSync(filePath)) return {};
  let content = fs.readFileSync(filePath, 'utf-8');
  content = content.replace(/^\uFEFF/, ''); // UTF-8 BOM temizle
  
  const result = {};
  let currentSection = null;
  
  const lines = content.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith(';') || trimmed.startsWith('#')) continue;
    
    const sectionMatch = trimmed.match(/^\[(.*)\]$/);
    if (sectionMatch) {
      currentSection = sectionMatch[1].trim();
      result[currentSection] = result[currentSection] || {};
      continue;
    }
    
    const equalsIdx = trimmed.indexOf('=');
    if (equalsIdx !== -1) {
      const key = trimmed.slice(0, equalsIdx).trim();
      let val = trimmed.slice(equalsIdx + 1).trim();
      
      // Satır sonu açıklamalarını (; veya #) temizle
      const commentIdx = val.indexOf(';');
      const hashIdx = val.indexOf('#');
      let splitIdx = -1;
      if (commentIdx !== -1 && hashIdx !== -1) {
        splitIdx = Math.min(commentIdx, hashIdx);
      } else if (commentIdx !== -1) {
        splitIdx = commentIdx;
      } else if (hashIdx !== -1) {
        splitIdx = hashIdx;
      }
      
      if (splitIdx !== -1) {
        val = val.slice(0, splitIdx).trim();
      }
      
      if (currentSection) {
        result[currentSection][key] = val;
      } else {
        result[key] = val;
      }
    }
  }
  return result;
}

/**
 * Bir nesne içinde büyük/küçük harf duyarsız olarak anahtar araması yapar.
 * 
 * @param {object} obj Arama yapılacak nesne
 * @param {string} targetKey Aranacak anahtar ismi (Case-insensitive)
 * @returns {*} Bulunan değer veya undefined
 */
export function getCaseInsensitiveKey(obj, targetKey) {
  if (!obj) return undefined;
  const targetLower = targetKey.toLowerCase();
  const foundKey = Object.keys(obj).find(k => k.toLowerCase() === targetLower);
  return foundKey ? obj[foundKey] : undefined;
}

export const settingComments = {
  downloadPath: '# İndirme Klasörü / Download Directory\n# Açıklama: İndirilen video ve müziklerin kaydedileceği fiziksel dizin yolu.\n# Description: Physical directory path where downloaded video and audio files are saved.\n# Seçenekler / Options: Geçerli klasör yolu / Any valid folder path\n# Varsayılan / Default: download',

  browser: '# Çerez Çekilecek Tarayıcı / Browser to Import Cookies From\n# Açıklama: YouTube oturumu ve üyelere özel içeriklerin indirilmesi için çerezlerin okunacağı web tarayıcısı.\n# Description: Web browser to import session cookies from for YouTube login and member-only videos.\n# Seçenekler / Options: none, chrome, firefox, edge, msedge, brave, opera, vivaldi\n# Varsayılan / Default: none',

  quality: '# Video İndirme Kalitesi / Video Download Quality\n# Açıklama: İndirilecek videolar için hedeflenen maksimum çözünürlük kalitesi.\n# Description: Target maximum video resolution quality for downloads.\n# Seçenekler / Options: best, 2160p, 1440p, 1080p, 720p, 480p, 360p, audio_only\n# Varsayılan / Default: best',

  channelCheckInterval: '# Tüm Kanalları Otomatik Denetleme Sıklığı (Saniye) / All Channels Automatic Check Interval (Seconds)\n# Açıklama: Takip edilen tüm kanalların arka planda otomatik taranma sıklığı.\n# Description: Frequency in seconds for automatically scanning all tracked channels in background.\n# Seçenekler / Options: Sayısal değer (Saniye / Seconds, örn: 300, 600, 1500, 1800)\n# Varsayılan / Default: 1800',

  autoDownload: '# Yeni Videoları Otomatik İndir / Auto-download New Videos\n# Açıklama: Takip edilen kanallarda yeni video yayınlandığında indirme kuyruğuna otomatik ekler.\n# Description: Automatically enqueues newly published videos for download from tracked channels.\n# Seçenekler / Options: true (etkin / enabled), false (devre dışı / disabled)\n# Varsayılan / Default: true',

  mergeType: '# Ses ve Video Birleştirme Biçimi / Video Merge Type\n# Açıklama: İndirilen video ve ses akışlarının nasıl birleştirileceğini belirler.\n# Description: Determines how downloaded video and audio streams should be merged.\n# Seçenekler / Options: merge (FFmpeg ile birleştir / Merge with FFmpeg), video (Sadece video / Video only), audio (Sadece ses / Audio only)\n# Varsayılan / Default: merge',

  writeThumbnail: '# Önizleme Resmini İndir / Download Video Thumbnail\n# Açıklama: Video kapak görselini yerel video dosyasına gömer veya yanına kaydeder.\n# Description: Embeds or saves thumbnail image alongside the downloaded video file.\n# Seçenekler / Options: true (etkin / enabled), false (devre dışı / disabled)\n# Varsayılan / Default: true',

  showShorts: '# Kütüphanede Shorts Göster / Show Shorts in Library\n# Açıklama: Kütüphane listesinde YouTube Shorts videolarının gösterilip gösterilmeyeceği.\n# Description: Whether YouTube Shorts videos are displayed in the library list.\n# Seçenekler / Options: true (etkin / enabled), false (devre dışı / disabled)\n# Varsayılan / Default: false',

  rssLimit: '# RSS Denetleme Limiti / RSS Scan Limit\n# Açıklama: Kanal başına taranacak ve listelenecek maksimum son video sayısı.\n# Description: Maximum number of recent videos to scan and retrieve per channel.\n# Seçenekler / Options: Sayısal limit (örn: 5, 10, 15, 30)\n# Varsayılan / Default: 15',

  autoDeleteDays: '# Otomatik Dosya Silme Gün Sınırı / Auto-delete Video Files After Days\n# Açıklama: Belirtilen gün sayısından eski videoların yerel diskten otomatik silinmesi (0 = silme kapalı).\n# Description: Automatically deletes local video files older than specified days (0 = disabled).\n# Seçenekler / Options: 0 (devre dışı / disabled) veya pozitif gün sayısı (örn: 7, 14, 30)\n# Varsayılan / Default: 0',

  theme: '# Arayüz Teması / UI Theme\n# Açıklama: Web kullanıcı arayüzü renk teması.\n# Description: Color theme for the web user interface.\n# Seçenekler / Options: dark (Koyu), light (Açık)\n# Varsayılan / Default: dark',

  downloadSpeedLimit: '# Standart İndirme Hız Sınırı (KB/s) / Standard Download Speed Limit (KB/s)\n# Açıklama: Normal indirmelerde uygulanacak maksimum bant genişliği sınırı (0 = sınırsız).\n# Description: Maximum bandwidth limit applied during normal downloads (0 = unlimited).\n# Seçenekler / Options: 0 (sınırsız / unlimited) veya KB/s cinsinden sayı (örn: 1024, 2048, 5120)\n# Varsayılan / Default: 0',

  useAlternativeSpeed: '# Alternatif Hız Sınırını (Kaplumbağa Modu) Kullan / Use Alternative Speed Limit (Turtle Mode)\n# Açıklama: Bant genişliğini korumak için ikincil hız sınırını etkinleştirir.\n# Description: Enables secondary speed limit to conserve network bandwidth.\n# Seçenekler / Options: true (etkin / enabled), false (devre dışı / disabled)\n# Varsayılan / Default: false',

  alternativeSpeedLimit: '# Alternatif Hız Sınırı Değeri (KB/s) / Alternative Speed Limit Value (KB/s)\n# Açıklama: Kaplumbağa modu (Turtle) aktifken geçerli olacak indirme hız sınırı.\n# Description: Download speed limit applied when turtle mode is active.\n# Seçenekler / Options: KB/s cinsinden sayı (örn: 501, 1000, 3000)\n# Varsayılan / Default: 3000',

  port: '# Uygulama Bağlantı Noktası (Port) / Application Web Port\n# Açıklama: Web arayüzü ve yerel API için dinlenen yerel TCP portu.\n# Description: Local TCP port listened for the web interface and local REST API.\n# Seçenekler / Options: 1024 - 65535 arası geçerli port numarası (örn: 4141, 5000, 8080)\n# Varsayılan / Default: 4141',

  playerPreference: '# Video Oynatıcı Tercihi / Video Player Preference\n# Açıklama: Videoların hangi oynatıcı mekanizmasıyla açılacağı.\n# Description: Preferred playback mechanism for opening videos.\n# Seçenekler / Options: system (İşletim sistemi varsayılanı / System default), embedded (Web gömülü oynatıcı / Embedded player)\n# Varsayılan / Default: system',

  playerType: '# Gömülü Oynatıcı Türü / Embedded Player Type\n# Açıklama: Web arayüzü içinde gömülü oynatma seçildiğinde kullanılacak oynatıcı kütüphanesi.\n# Description: Video player engine used when embedded playback is selected.\n# Seçenekler / Options: plyr, artplayer, html5\n# Varsayılan / Default: plyr',

  subtitleColor: '# Altyazı Yazı Rengi / Subtitle Font Color\n# Açıklama: Gömülü video oynatıcıdaki altyazıların metin rengi HEX kodu.\n# Description: HEX color code for subtitle text in the embedded video player.\n# Seçenekler / Options: HEX renk kodu (örn: #ffffff, #ffff00, #00ffcc)\n# Varsayılan / Default: #ffffff',

  subtitleOpacity: '# Altyazı Arka Plan Opaklığı / Subtitle Background Opacity\n# Açıklama: Gömülü video oynatıcıdaki altyazı arka plan kutusu şeffaflığı.\n# Description: Background box opacity for subtitles in the embedded video player.\n# Seçenekler / Options: 0.0 (Tam şeffaf / Fully transparent) ile 1.0 (Tam opak / Fully opaque) arası\n# Varsayılan / Default: 0.0',

  subtitleSize: '# Altyazı Yazı Boyutu / Subtitle Font Size\n# Açıklama: Gömülü video oynatıcıdaki altyazı font büyüklüğü.\n# Description: Font size of subtitles in the embedded video player.\n# Seçenekler / Options: CSS piksel boyutu (örn: 18px, 22px, 26px, 32px)\n# Varsayılan / Default: 26px',

  playSounds: '# Sistem Sesleri / Play System Sounds\n# Açıklama: İndirme tamamlandığında veya hata oluştuğunda sesli bildirim çalar.\n# Description: Plays audible chime when download completes or error occurs.\n# Seçenekler / Options: true (etkin / enabled), false (devre dışı / disabled)\n# Varsayılan / Default: true',

  lang: '# Uygulama Dili / Application Language\n# Açıklama: Kullanıcı arayüzü ve bildirimlerin gösterileceği sistem dili.\n# Description: System language for user interface, notifications and metadata.\n# Seçenekler / Options: tr, en, es, de, pt, ru, ar\n# Varsayılan / Default: en',

  isPaused: '# Otomatik Kontrol Duraklatıldı mı / Is Automatic Checking Paused\n# Açıklama: Tüm arka plan kanal tarama ve otomatik indirme süreçlerini geçici durdurur.\n# Description: Temporarily pauses all background channel scanning and auto-downloading.\n# Seçenekler / Options: true (duraklatıldı / paused), false (çalışıyor / active)\n# Varsayılan / Default: false',

  showNotifications: '# Masaüstü Bildirimleri / Desktop Notifications\n# Açıklama: İndirmeler tamamlandığında işletim sistemi masaüstü bildirim baloncuğu gösterir.\n# Description: Displays desktop toast notifications when downloads complete.\n# Seçenekler / Options: true (etkin / enabled), false (devre dışı / disabled)\n# Varsayılan / Default: false',

  autoOpenBrowser: '# Başlangıçta Tarayıcıyı Otomatik Aç / Auto Open Browser on Startup\n# Açıklama: Uygulama açıldığında web arayüzünü varsayılan tarayıcıda otomatik başlatır.\n# Description: Automatically launches web interface in default browser on startup.\n# Seçenekler / Options: true (etkin / enabled), false (devre dışı / disabled)\n# Varsayılan / Default: false',

  sponsorBlockEnabled: '# SponsorBlock Entegrasyonu / SponsorBlock Integration\n# Açıklama: Gömülü oynatıcıda sponsor, introlar ve ara bölümleri otomatik atlar.\n# Description: Automatically skips sponsors, intros, and non-music sections in embedded player.\n# Seçenekler / Options: true (etkin / enabled), false (devre dışı / disabled)\n# Varsayılan / Default: true',

  discordRpcEnabled: '# Discord Rich Presence Durumu / Discord Rich Presence\n# Açıklama: Oynatılan veya indirilen videoyu Discord profilinizde etkinlik olarak gösterir.\n# Description: Displays currently playing or downloading media on your Discord profile.\n# Seçenekler / Options: true (etkin / enabled), false (devre dışı / disabled)\n# Varsayılan / Default: true',

  doubleClickAction: '# Video Kartı Çift Tıklama Eylemi / Video Card Double Click Action\n# Açıklama: Kütüphanede video kartına çift tıklandığında yapılacak varsayılan işlem.\n# Description: Default action performed when double-clicking a video card in library.\n# Seçenekler / Options: player (Oynatıcıyı aç / Open player), system (Sistem oynatıcıda aç / System player), folder (Klasörde göster / Show in folder)\n# Varsayılan / Default: player',

  historyDurationFilter: '# Kütüphane Süre Filtresi Varsayılanı / Library Duration Filter Default\n# Açıklama: Kütüphane sekmesi açılışında geçerli olan süre filtresi aralığı.\n# Description: Default duration filter range applied in the library view.\n# Seçenekler / Options: off (Tümü / All), short (0-4 dk / Shorts & Kısalar), medium (4-20 dk / Orta), long (20+ dk / Uzun)\n# Varsayılan / Default: off',

  enableAltThumbnailsHover: '# Fare Üzerine Geldiğinde Alternatif Kapak Döngüsü / Hover Alternative Thumbnail Cycle\n# Açıklama: Video kartı üzerine fare ile gelindiğinde alternatif kareleri animasyonlu gösterir.\n# Description: Animates storyboard/alternate preview frames when hovering over video cards.\n# Seçenekler / Options: true (etkin / enabled), false (devre dışı / disabled)\n# Varsayılan / Default: true',

  weatherEnabled: '# Hava Durumu Widget\'ı / Weather Widget\n# Açıklama: Web arayüzü üst barda anlık hava durumu ve sıcaklık bilgisini gösterir.\n# Description: Displays live weather forecast and temperature in the top bar.\n# Seçenekler / Options: true (etkin / enabled), false (devre dışı / disabled)\n# Varsayılan / Default: true',

  weatherCity: '# Hava Durumu Şehri / Weather City Name\n# Açıklama: Hava durumu verisinin çekileceği varsayılan şehir veya ilçe adı.\n# Description: Default city or district name for weather data.\n# Seçenekler / Options: Metin değeri (örn: Derince, İstanbul, Ankara, London, Berlin)\n# Varsayılan / Default: Derince',

  weatherLatitude: '# Hava Durumu Enlemi / Weather Latitude\n# Açıklama: Hava durumu API\'si için hassas enlem koordinatı.\n# Description: Precise latitude coordinate for weather forecast API.\n# Seçenekler / Options: Ondalık sayı koordinat (örn: 40.75694, 41.0082)\n# Varsayılan / Default: 40.75694',

  weatherLongitude: '# Hava Durumu Boylamı / Weather Longitude\n# Açıklama: Hava durumu API\'si için hassas boylam koordinatı.\n# Description: Precise longitude coordinate for weather forecast API.\n# Seçenekler / Options: Ondalık sayı koordinat (örn: 29.81472, 28.9784)\n# Varsayılan / Default: 29.81472',

  weatherUnit: '# Sıcaklık Birimi / Temperature Unit\n# Açıklama: Hava durumu sıcaklık gösterge birimi.\n# Description: Temperature display unit for weather widget.\n# Seçenekler / Options: celsius (°C / Santigrat), fahrenheit (°F / Fahrenhayt)\n# Varsayılan / Default: celsius',

  queueViewMode: '# Kuyruk Sekmesi Görünüm Modu / Queue Tab View Mode\n# Açıklama: İndirme kuyruğunun tablo veya kart ızgarası olarak yerleşim düzeni.\n# Description: Layout format of the download queue: table grid or cards.\n# Seçenekler / Options: table (Tablo görünümü / Table view), cards (Kart görünümü / Cards view)\n# Varsayılan / Default: table',

  markWatchedOnDelete: '# Dosya Silindiğinde İzlendi İşaretle / Mark as Watched on Delete\n# Açıklama: İndirilen video yerel diskten silindiğinde kütüphanede otomatik İzlendi olarak işaretler.\n# Description: Automatically marks video as watched in library when local file is deleted.\n# Seçenekler / Options: true (etkin / enabled), false (devre dışı / disabled)\n# Varsayılan / Default: true',

  autoSyncWatchtime: '# İzleme Süresi Senkronizasyonu / Watchtime Synchronization\n# Açıklama: Gömülü oynatıcıda video izlendiğinde süreyi yerel veritabanına otomatik kaydeder.\n# Description: Automatically syncs playback progress and watchtime to local database.\n# Seçenekler / Options: true (etkin / enabled), false (devre dışı / disabled)\n# Varsayılan / Default: true',

  autoDiskSync: '# Otomatik Disk Senkronizasyonu / Automatic Disk Sync\n# Açıklama: Açılışta yerel diskteki indirme klasörü ile veritabanını eşitleyerek silinmiş dosyaları günceller.\n# Description: Reconciles local download directory with database on startup for deleted files.\n# Seçenekler / Options: true (etkin / enabled), false (devre dışı / disabled)\n# Varsayılan / Default: true',

  channelScanMode: '# Kanal Tarama Modu / Channel Scan Mode\n# Açıklama: Kanalların taranma yöntemi (XML RSS ile yıldırım hızında veya yt-dlp ile klasik).\n# Description: Channel scanning method (lightning fast with XML RSS or classic with yt-dlp).\n# Seçenekler / Options: fast (⚡ Hızlı / XML RSS), classic (🐢 Klasik / yt-dlp)\n# Varsayılan / Default: fast',

  checkChannelsOnStartup: '# Başlangıçta Kanalları Otomatik Tara / Check Channels on Startup\n# Açıklama: Sunucu ilk açıldığında tüm takip edilen kanalları otomatik denetler.\n# Description: Automatically triggers a full channel scan on application startup.\n# Seçenekler / Options: true (etkin / enabled), false (devre dışı / disabled)\n# Varsayılan / Default: false',

  maxConcurrentDownloads: '# Eş Zamanlı İndirme Sayısı / Maximum Concurrent Downloads\n# Açıklama: Aynı anda paralel olarak indirilecek maksimum video sayısı.\n# Description: Maximum number of videos downloading in parallel simultaneously.\n# Seçenekler / Options: Sayısal değer (örn: 1, 2, 3, 5)\n# Varsayılan / Default: 1',

  liveStreamHandling: '# Canlı Yayın & Prömiyer Davranışı / Live Stream & Premiere Handling\n# Açıklama: Yaklaşan veya canlı yayınlanan videoların nasıl işleneceğini belirler.\n# Description: How upcoming premieres and live streams should be handled.\n# Seçenekler / Options: instant_retry (Anında dene / Instant retry), vod_only (VOD dönüşünce indir / Download upon VOD conversion), ignore_live (Göz ardı et / Ignore live)\n# Varsayılan / Default: instant_retry',

  liveStreamRetryInterval: '# Canlı Yayın Denetleme Sıklığı (Dakika) / Live Stream Retry Interval (Minutes)\n# Açıklama: Canlı/yaklaşan yayınların VOD videoya dönüşümünü kontrol etme aralığı.\n# Description: Check interval in minutes for live/upcoming stream VOD completion.\n# Seçenekler / Options: Sayısal değer (Dakika / Minutes, örn: 15, 30, 60)\n# Varsayılan / Default: 30',

  durationFetchMethod: '# Video Süresi Çözümleme Yöntemi / Video Duration Fetch Method\n# Açıklama: Süresi eksik videoların süresini çekme motoru.\n# Description: Engine used to resolve missing video durations.\n# Seçenekler / Options: auto (Otomatik / YouTube HTML & yt-dlp yedeği), ytdlp (Doğrudan yt-dlp), waterfall (Proxy Şelalesi)\n# Varsayılan / Default: auto',

  tempDirType: '# Geçici Dosya Klasörü Türü / Temporary Directory Type\n# Açıklama: İndirme sırasında parçaların ve FFmpeg işlemlerinin tutulacağı geçici klasör.\n# Description: Temp folder location for download parts and FFmpeg processing.\n# Seçenekler / Options: system (İşletim sistemi varsayılanı), local (Uygulama içi yerel temp)\n# Varsayılan / Default: system',

  ytdlpRunMode: '# yt-dlp Çalıştırma Modu / yt-dlp Execution Mode\n# Açıklama: yt-dlp ikili dosyasının nasıl yürütüleceği.\n# Description: How the yt-dlp binary is executed.\n# Seçenekler / Options: exe (Doğrudan derlenmiş EXE), python (Python yorumlayıcısı ile)\n# Varsayılan / Default: exe',

  shortsDurationLimit: '# Shorts Maksimum Süre Sınırı (Saniye) / Shorts Maximum Duration Limit (Seconds)\n# Açıklama: Kısa video (Shorts) kabul edilecek maksimum süre sınırı.\n# Description: Maximum duration threshold in seconds to consider a video as Shorts.\n# Seçenekler / Options: Sayısal değer (Saniye / Seconds, örn: 60, 90, 180, 240)\n# Varsayılan / Default: 180',

  historyLimitPerChannel: '# Kanal Başına Geçmiş Sınırı / History Limit Per Channel\n# Açıklama: Kütüphanede kanal başına saklanacak maksimum geçmiş video kayıt sayısı.\n# Description: Maximum number of history video records preserved per channel.\n# Seçenekler / Options: Sayısal değer (örn: 30, 50, 100, 200)\n# Varsayılan / Default: 30',

  hideOnDelete: '# Silinen Videoları Kütüphanede Gizle / Hide Deleted Videos in Library\n# Açıklama: Fiziksel dosyası silinen videoları kütüphane listesinde otomatik gizler.\n# Description: Hides video card from library list when local file is deleted.\n# Seçenekler / Options: true (etkin / enabled), false (devre dışı / disabled)\n# Varsayılan / Default: true',

  githubToken: '# GitHub Kişisel Erişim Anahtarı / GitHub Personal Access Token\n# Açıklama: GitHub Gist senkronizasyonu için şifrelenmiş kişisel erişim anahtarı.\n# Description: Encrypted personal access token for GitHub Gist synchronization.\n# Seçenekler / Options: GitHub PAT dizesi (ghp_...)\n# Varsayılan / Default: Boş / Empty',

  githubGistId: '# GitHub Gist Kimliği / GitHub Gist ID\n# Açıklama: Ayarlar, kanallar ve geçmiş yedeklerinin yüklendiği Gist ID.\n# Description: Gist ID where settings, channels, and history backups are synced.\n# Seçenekler / Options: 32 karakterlik Gist hash kimliği\n# Varsayılan / Default: Boş / Empty',

  autoSyncGist: '# Otomatik Gist Senkronizasyonu / Automatic Gist Sync\n# Açıklama: Değişiklik yapıldığında veritabanını GitHub Gist\'e otomatik yükler.\n# Description: Automatically uploads database backups to GitHub Gist upon changes.\n# Seçenekler / Options: true (etkin / enabled), false (devre dışı / disabled)\n# Varsayılan / Default: false'
};

/**
 * Bir veri nesnesini INI formatında belirtilen dosyaya yazar.
 * 
 * @param {string} filePath Yazılacak INI dosyasının yolu
 * @param {object} data Yazılacak veri nesnesi (Bölümler ve anahtar-değerler)
 */
export function writeIni(filePath, data) {
  const isSettingsFile = filePath.includes('configwin.ini') || filePath.includes('configunix.ini');
  let content = '; ================================================================================\n';
  content += '; HaYTooL YouTube Downloader Yapılandırma Dosyası / Configuration File\n';
  content += '; Bu dosya web arayüzündeki ayarlar veya kanallar değiştikçe otomatik güncellenir.\n';
  content += '; This file is updated automatically when Settings or Channels change.\n';
  if (isSettingsFile) {
    content += '; --------------------------------------------------------------------------------\n';
    content += '; VARSAYILAN AYARLAR REFERANS BİLGİLENDİRMESİ / DEFAULT SETTINGS REFERENCE:\n';
    content += '; • downloadPath: download (Uygulama indirme klasörü / Default download folder)\n';
    content += '; • browser: none (Çerez çekilecek tarayıcı / Cookies browser)\n';
    content += '; • quality: best (Video kalitesi / Video quality)\n';
    content += '; • channelCheckInterval: 1800 (Otomatik tarama sıklığı / Scan interval in seconds [30 dk])\n';
    content += '; • autoDownload: true (Otomatik video indirme / Auto-download new videos)\n';
    content += '; • mergeType: merge (FFmpeg ile birleştir / Merge audio+video)\n';
    content += '; • writeThumbnail: true (Kapak resmi kaydet / Save thumbnail)\n';
    content += '; • showShorts: false (Kütüphanede shorts göster / Show shorts in library)\n';
    content += '; • rssLimit: 15 (RSS tarama limiti / RSS fetch limit)\n';
    content += '; • autoDeleteDays: 0 (Otomatik silme gün sınırı [0=Kapalı] / Auto-delete days [0=Off])\n';
    content += '; • theme: dark (Arayüz teması / UI theme)\n';
    content += '; • downloadSpeedLimit: 0 (Standart hız sınırı [0=Sınırsız] / Speed limit [0=Unlimited])\n';
    content += '; • useAlternativeSpeed: false (Kaplumbağa modu / Turtle mode)\n';
    content += '; • alternativeSpeedLimit: 3000 (Kaplumbağa hız sınırı KB/s / Turtle speed limit KB/s)\n';
    content += '; • port: 4141 (Web arayüz portu / Web interface port)\n';
    content += '; • playerPreference: system (Oynatıcı tercihi / Player preference)\n';
    content += '; • playerType: plyr (Gömülü oynatıcı türü / Embedded player type)\n';
    content += '; • subtitleColor: #ffffff (Altyazı rengi / Subtitle font color)\n';
    content += '; • subtitleOpacity: 0.0 (Altyazı kutu opaklığı / Subtitle background opacity)\n';
    content += '; • subtitleSize: 26px (Altyazı boyutu / Subtitle font size)\n';
    content += '; • playSounds: true (Sistem sesleri / System sounds)\n';
    content += '; • lang: en (Uygulama dili / Application language)\n';
    content += '; • isPaused: false (Taramalar duraklatıldı mı / Is checking paused)\n';
    content += '; • showNotifications: false (Masaüstü bildirimleri / Desktop notifications)\n';
    content += '; • autoOpenBrowser: false (Açılışta tarayıcıyı aç / Auto open browser)\n';
    content += '; • sponsorBlockEnabled: true (SponsorBlock entegrasyonu / SponsorBlock integration)\n';
    content += '; • discordRpcEnabled: true (Discord Rich Presence durumu / Discord RPC)\n';
    content += '; • doubleClickAction: player (Çift tıklama eylemi / Double-click action)\n';
    content += '; • historyDurationFilter: off (Kütüphane süre filtresi / Library duration filter)\n';
    content += '; • enableAltThumbnailsHover: true (Kapak animasyonu / Hover alt thumbnails)\n';
    content += '; • weatherEnabled: true (Hava durumu widgetı / Weather widget)\n';
    content += '; • weatherCity: Derince (Hava durumu şehri / Weather city)\n';
    content += '; • weatherLatitude: 40.75694 (Hava durumu enlemi / Weather latitude)\n';
    content += '; • weatherLongitude: 29.81472 (Hava durumu boylamı / Weather longitude)\n';
    content += '; • weatherUnit: celsius (Sıcaklık birimi / Temperature unit)\n';
    content += '; • queueViewMode: table (Kuyruk görünüm modu / Queue view mode)\n';
    content += '; • markWatchedOnDelete: true (Silinen videoyu izlendi yap / Mark watched on delete)\n';
    content += '; • autoSyncWatchtime: true (İzleme süresi senkronu / Auto sync watchtime)\n';
    content += '; • autoDiskSync: true (Açılışta otomatik disk senkronu / Auto disk sync on startup)\n';
  }
  content += '; ================================================================================\n\n';
  
  for (const section in data) {
    content += `[${section}]\n`;
    for (const key in data[section]) {
      if (isSettingsFile && settingComments[key]) {
        content += settingComments[key] + '\n';
      }
      content += `${key} = ${data[section][key]}\n\n`;
    }
  }
  const tempPath = `${filePath}.tmp`;
  fs.writeFileSync(tempPath, content, 'utf-8');
  fs.renameSync(tempPath, filePath);
}
