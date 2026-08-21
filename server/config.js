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
  downloadPath: '# İndirme Klasörü / Download Directory\n# Varsayılan: download (Uygulama klasörü içindeki download dizini)\n# Default: download (Download directory inside the application folder)',
  browser: '# Çerez Çekilecek Tarayıcı / Browser to Import Cookies From\n# Seçenekler: none, chrome, firefox, edge, msedge vb.\n# Options: none, chrome, firefox, edge, msedge, etc.',
  quality: '# Video İndirme Kalitesi / Video Download Quality\n# Seçenekler: best, 1080p, 720p, 480p, 360p vb.\n# Options: best, 1080p, 720p, 480p, 360p, etc.',
  channelCheckInterval: '# Tüm Kanalları Otomatik Denetleme Sıklığı (Saniye) / All Channels Automatic Check Interval (Seconds)\n# Tüm kanalların topluca ne sıklıkla taranacağını belirler.\n# Determines how frequently all channels are scanned together.',
  autoDownload: '# Yeni Videoları Otomatik İndir / Auto-download New Videos\n# Seçenekler: true (etkin), false (devre dışı)\n# Options: true (enabled), false (disabled)',
  mergeType: '# Ses ve Video Birleştirme Biçimi / Video Merge Type\n# Seçenekler: merge (FFmpeg ile birleştir), video (Sadece video), audio (Sadece ses)\n# Options: merge (Merge with FFmpeg), video (Video only), audio (Audio only)',
  writeThumbnail: '# Önizleme Resmini İndir / Download Video Thumbnail\n# Seçenekler: true (etkin), false (devre dışı)\n# Options: true (enabled), false (disabled)',
  showShorts: '# Kütüphanede Shorts Göster / Show Shorts in Library\n# Seçenekler: true (etkin), false (devre dışı)\n# Options: true (enabled), false (disabled)',
  rssLimit: '# RSS Denetleme Limiti / RSS Scan Limit\n# Kanal başına taranacak maksimum video sayısı.\n# Maximum number of videos to scan per channel.',
  autoDeleteDays: '# Otomatik Dosya Silme Gün Sınırı / Auto-delete Video Files After Days\n# 0 = Silme devre dışı.\n# 0 = Deletion disabled.',
  theme: '# Arayüz Teması / UI Theme\n# Seçenekler: dark, light\n# Options: dark, light',
  downloadSpeedLimit: '# İndirme Hız Sınırı (KB/s) / Download Speed Limit (KB/s)\n# 0 = Sınırsız.\n# 0 = Unlimited.',
  useAlternativeSpeed: '# Alternatif Hız Sınırını (Turtle) Kullan / Use Alternative Speed Limit (Turtle)\n# Seçenekler: true (etkin), false (devre dışı)\n# Options: true (enabled), false (disabled)',
  alternativeSpeedLimit: '# Alternatif Hız Sınırı Değeri (KB/s) / Alternative Speed Limit Value (KB/s)\n# Varsayılan: 501 KB/s\n# Default: 501 KB/s',
  port: '# Uygulama Bağlantı Noktası (Port) / Application Port\n# Varsayılan: 4141\n# Default: 4141',
  playerPreference: '# Video Oynatıcı Tercihi / Video Player Preference\n# Seçenekler: system (Sistem varsayılanı), embedded (Gömülü oynatıcı)\n# Options: system (System default), embedded (Embedded player)',
  playerType: '# Gömülü Oynatıcı Türü / Embedded Player Type\n# Seçenekler: plyr, artplayer, html5\n# Options: plyr, artplayer, html5',
  playSounds: '# Sistem Sesleri / Play System Sounds\n# Seçenekler: true (etkin), false (devre dışı)\n# Options: true (enabled), false (disabled)',
  lang: '# Uygulama Dili / Application Language\n# Seçenekler: tr, en, es, de, pt, ru, ar\n# Options: tr, en, es, de, pt, ru, ar',
  isPaused: '# Otomatik Kontrol Duraklatıldı mı / Is Automatic Checking Paused\n# Seçenekler: true (etkin), false (devre dışı)\n# Options: true (enabled), false (disabled)',
  showNotifications: '# Windows Bildirimlerini Göster / Show Windows Notifications\n# Seçenekler: true (etkin), false (devre dışı)\n# Options: true (enabled), false (disabled)',
  autoOpenBrowser: '# Başlangıçta Tarayıcıyı Aç / Auto Open Browser on Startup\n# Seçenekler: true (etkin), false (devre dışı)\n# Options: true (enabled), false (disabled)',
  enableAltThumbnailsHover: '# Fare Üzerine Geldiğinde Alternatif Kapak Döngüsü / Hover Alternative Thumbnail Cycle\n# Seçenekler: true (etkin), false (devre dışı)\n# Options: true (enabled), false (disabled)',
  subtitleColor: '# Altyazı Rengi / Subtitle Text Color\n# Varsayılan: #ffffff\n# Default: #ffffff',
  subtitleOpacity: '# Altyazı Arka Plan Saydamlığı / Subtitle Background Opacity\n# Değer aralığı: 0.0 - 1.0 (0 = Tamamen Saydam, 1 = Katı)\n# Range: 0.0 - 1.0 (0 = Fully Transparent, 1 = Solid)',
  subtitleSize: '# Altyazı Yazı Boyutu / Subtitle Font Size\n# Varsayılan: 26px\n# Default: 26px',
  sponsorBlockEnabled: '# SponsorBlock Entegrasyonu / SponsorBlock Integration\n# Seçenekler: true (etkin), false (devre dışı)\n# Options: true (enabled), false (disabled)',
  discordRpcEnabled: '# Discord Zengin Varlık (RPC) Durumu / Discord Rich Presence (RPC)\n# Seçenekler: true (etkin), false (devre dışı)\n# Options: true (enabled), false (disabled)',
  doubleClickAction: '# Çift Tıklama Eylemi / Double Click Action\n# Seçenekler: system (Sistem Oynatıcı), player (Gömülü Oynatıcı), folder (Klasörü Aç)\n# Options: system (System Player), player (Embedded Player), folder (Open Folder)',
  historyDurationFilter: '# Kütüphane Süre Filtresi / Library Duration Filter\n# Seçenekler: off (Kapalı), 1, 2, 3, 4, 5, 10, 15, 20, 25, 30 (Dakika)\n# Options: off (Disabled), 1, 2, 3, 4, 5, 10, 15, 20, 25, 30 (Minutes)',
  historyViewMode: '# Kütüphane Sekmesi Görünüm Modu / Library Tab View Mode\n# Seçenekler: grid (Kartlar), list (Sade Liste)\n# Options: grid (Cards), list (Compact List)',
  downloadedViewMode: '# İndirilenler Sekmesi Görünüm Modu / Downloaded Tab View Mode\n# Seçenekler: grid (Kartlar), list (Sade Liste)\n# Options: grid (Cards), list (Compact List)',
  weatherEnabled: '# Hava Durumu Göstergesi / Weather Indicator\n# Seçenekler: true (etkin), false (devre dışı)\n# Options: true (enabled), false (disabled)',
  weatherCity: '# Hava Durumu Şehri / Weather City\n# Varsayılan: İstanbul\n# Default: Istanbul',
  weatherLatitude: '# Hava Durumu Enlemi / Weather Latitude\n# Varsayılan: 41.0082\n# Default: 41.0082',
  weatherLongitude: '# Hava Durumu Boylamı / Weather Longitude\n# Varsayılan: 28.9784\n# Default: 28.9784',
  weatherUnit: '# Sıcaklık Birimi / Temperature Unit\n# Seçenekler: celsius (°C), fahrenheit (°F)\n# Options: celsius (°C), fahrenheit (°F)',
  queueViewMode: '# Kuyruk Sekmesi Görünüm Modu / Queue Tab View Mode\n# Seçenekler: table (tablo), cards (kartlar)\n# Options: table, cards',
  markWatchedOnDelete: '# Video Silindiğinde İzlenmiş Olarak İşaretle (APE) / Mark as Watched on Delete (APE)\n# Seçenekler: true (etkin), false (devre dışı)\n# Options: true (enabled), false (disabled)',
  autoSyncWatchtime: '# YouTube İzleme Geçmişini Otomatik Senkronize Et / Auto-sync YouTube Watch History\n# Seçenekler: true (etkin), false (devre dışı)\n# Options: true (enabled), false (disabled)',
  autoDiskSync: '# İndirme Klasörünü Disk İle Otomatik Eşitle / Auto-sync Download Directory With Disk\n# Seçenekler: true (etkin), false (devre dışı)\n# Options: true (enabled), false (disabled)'
};

/**
 * Bir veri nesnesini INI formatında belirtilen dosyaya yazar.
 * 
 * @param {string} filePath Yazılacak INI dosyasının yolu
 * @param {object} data Yazılacak veri nesnesi (Bölümler ve anahtar-değerler)
 */
export function writeIni(filePath, data) {
  let content = '; HaYTooL YouTube Downloader Yapilandirma Dosyasi / Configuration File\n';
  content += '; Bu dosya arayuzdeki Ayarlar veya Kanallar degistikce otomatik guncellenir.\n';
  content += '; This file is updated automatically when Settings or Channels change.\n\n';
  
  const isSettingsFile = filePath.includes('configwin.ini') || filePath.includes('configunix.ini');
  
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
