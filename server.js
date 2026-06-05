/**
 * HaYTooL YouTube Downloader - Sunucu Giriş Noktası
 * 
 * Bu yazılım YouTube kanallarını otomatik izler ve yeni videoları indirir.
 * Yapımcı: HaYTo
 * Destek ve İletişim: korazhayto@gmail.com
 * Lisans: MIT
 */

import express from 'express';
import fs from 'fs';
import path from 'path';
import { spawn, exec, execSync, execFileSync } from 'child_process';
import https from 'https';
import http from 'http';
import os from 'os';
import { Readable } from 'stream';
import Parser from 'rss-parser';
import open from 'open';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Konsol çıktılarını otomatik olarak zaman damgalı ve renkli yapmak için console.log/error override edilir
const originalLog = console.log;
const originalError = console.error;

// Log klasörü ve dosyası oluşturma
const logsDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Eski ve artık kullanılmayan server_tray.log dosyasını temizle
const trayLogPath = path.join(logsDir, 'server_tray.log');
if (fs.existsSync(trayLogPath)) {
  try {
    fs.unlinkSync(trayLogPath);
  } catch (e) {}
}

// Tarih ve saat formatlı log dosyası ismi
const logTime = new Date();
const pad = (n) => String(n).padStart(2, '0');
const logFileName = `${logTime.getFullYear()}-${pad(logTime.getMonth() + 1)}-${pad(logTime.getDate())}_${pad(logTime.getHours())}-${pad(logTime.getMinutes())}-${pad(logTime.getSeconds())}.log`;
const logFilePath = path.join(logsDir, logFileName);

/**
 * Log dosyasına temizlenmiş (ANSI kodlarından arındırılmış) bir mesaj yazar.
 * 
 * @param {string} line Log dosyasına yazılacak ham mesaj satırı
 */
function writeToLogFile(line) {
  try {
    const cleanLine = line.replace(/\x1b\[[0-9;]*m/g, '');
    fs.appendFileSync(logFilePath, cleanLine + '\n', 'utf-8');
  } catch (err) {
    originalError('Log dosyasına yazılırken hata oluştu:', err);
  }
}

// Türkçe Açıklama: Konsola yazdırılacak olan herhangi bir tipteki argümanı (nesne, hata, null vb.) okunabilir düz metin formatına çevirir.
/**
 * Konsola yazdırılacak parametreyi uygun metin formatına dönüştürür.
 * Nesneleri ve Hata (Error) nesnelerini okunabilir hale getirir.
 * 
 * @param {*} arg Biçimlendirilecek argüman
 * @returns {string} Biçimlendirilmiş metin çıktısı
 */
function formatArg(arg) {
  if (arg instanceof Error) {
    return arg.stack || arg.message;
  }
  if (arg === null) return 'null';
  if (arg === undefined) return 'undefined';
  if (typeof arg === 'object') {
    try {
      return JSON.stringify(arg);
    } catch (e) {
      return '[Object]';
    }
  }
  return arg;
}

// Türkçe Açıklama: CMD konsol çıktısı renklendirme, kategori zenginleştirme ve [HH:mm:ss] formatında gri zaman damgası ekleme logic'i.
console.log = function(...args) {
  const msg = args.map(formatArg).join(' ');
  
  // C# Tray uygulamasının gönderdiği komut sinyallerini olduğu gibi ham olarak çıkar (renklendirme/zaman damgası ekleme)
  if (msg.startsWith('[TRAY_CMD]')) {
    originalLog(msg);
    return;
  }

  const timestamp = new Date().toLocaleString('tr-TR');
  const now = new Date();
  const timeStr = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
  
  let color = '\x1b[37m'; // White
  let prefix = '[SYSTEM]';
  
  const upperMsg = msg.toUpperCase();
  
  if (upperMsg.includes('[RSS]') || upperMsg.includes('RSS FAILED') || upperMsg.includes('NEXT CHANNEL') || upperMsg.includes('FEED')) {
    color = '\x1b[94m'; // Bright Blue
    prefix = '[RSS]';
  } else if (upperMsg.includes('[QUEUE]') || upperMsg.includes('QUEUE PAUSED') || upperMsg.includes('QUEUE RESUMED')) {
    color = '\x1b[34m'; // Standard Blue
    prefix = '[QUEUE]';
  } else if (upperMsg.includes('STARTING DOWNLOAD') || upperMsg.includes('COMMAND: YT-DLP')) {
    color = '\x1b[96m'; // Bright Cyan
    prefix = '[DOWNLOAD]';
  } else if (upperMsg.includes('[SETTINGS]') || upperMsg.includes('[SYNC]') || upperMsg.includes('[MIGRATION]') || upperMsg.includes('[READDB]') || upperMsg.includes('CONFIG') || upperMsg.includes('DATABASE') || upperMsg.includes('SETTINGS') || upperMsg.includes('SPEED LIMIT CHANGED') || upperMsg.includes('FOLDER ICON') || upperMsg.includes('SUCCESSFULLY CREATED')) {
    color = '\x1b[95m'; // Bright Magenta
    prefix = '[SETTINGS]';
  } else if (upperMsg.includes('DOWNLOAD COMPLETED') || upperMsg.includes('COMPLETED') || upperMsg.includes('SUCCESSFULLY CREATED') || upperMsg.includes('SUCCESSFULLY INSTALLED') || upperMsg.includes('SUCCESSFULLY UPDATED') || upperMsg.includes('SUCCESSFULLY MOVED') || upperMsg.includes('SUCCESSFULLY RESOLVED')) {
    color = '\x1b[92m'; // Bright Green
    prefix = '[SUCCESS]';
  } else if (upperMsg.includes('SERVER') || upperMsg.includes('LISTEN') || upperMsg.includes('PORT') || upperMsg.includes('API')) {
    color = '\x1b[36m'; // Standard Cyan
    prefix = '[SERVER]';
  } else if (upperMsg.includes('WARNING') || upperMsg.includes('PAUSED') || upperMsg.includes('LOCKED') || upperMsg.includes('ALREADY EXISTS')) {
    color = '\x1b[93m'; // Bright Yellow
    prefix = '[WARNING]';
  } else if (upperMsg.includes('ERROR') || upperMsg.includes('FAIL') || upperMsg.includes('FAILED') || upperMsg.includes('CANCEL')) {
    color = '\x1b[91m'; // Bright Red
    prefix = '[ERROR]';
  } else if (upperMsg.includes('[YT-DLP]')) {
    color = '\x1b[90m'; // Bright Black / Gray
    prefix = '[YT-DLP]';
  } else if (upperMsg.includes('RESOLVING MISSING INFO') || upperMsg.includes('ADDRESS TO RESOLVE') || upperMsg.includes('VIDEO URL DETECTED') || upperMsg.includes('FETCHVIDEODURATION') || upperMsg.includes('SHORT VIDEO DETECTED') || upperMsg.includes('UPCOMING VIDEO DETECTED') || upperMsg.includes('LIVE VIDEO DETECTED')) {
    color = '\x1b[35m'; // Standard Magenta / Purple
    prefix = '[ANALYSIS]';
  }
  
  // Eğer temizlenmiş mesaj zaten bu prefix'i içeriyorsa çift yazılmaması için temizliyoruz
  let cleanMsg = msg;
  const prefixNoBrackets = prefix.slice(1, -1);
  if (cleanMsg.startsWith(prefix)) {
    cleanMsg = cleanMsg.substring(prefix.length).trim();
  } else if (cleanMsg.startsWith(`[${prefixNoBrackets.toLowerCase()}]`)) {
    cleanMsg = cleanMsg.substring(prefix.length).trim();
  } else if (cleanMsg.startsWith(`[${prefixNoBrackets}]`)) {
    cleanMsg = cleanMsg.substring(prefix.length).trim();
  }
  
  originalLog(`\x1b[90m[${timeStr}]\x1b[0m ${color}${prefix} ${cleanMsg}\x1b[0m`);
  writeToLogFile(`[${timestamp}] ${prefix} ${cleanMsg}`);
};

console.error = function(...args) {
  const timestamp = new Date().toLocaleString('tr-TR');
  const now = new Date();
  const timeStr = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
  const msg = args.map(formatArg).join(' ');
  
  originalError(`\x1b[90m[${timeStr}]\x1b[0m \x1b[91m[ERROR] ${msg}\x1b[0m`);
  writeToLogFile(`[${timestamp}] [ERROR] ${msg}`);
};

const app = express();
// YouTube RSS isteklerinde bot engellemesine takılmamak için tarayıcı başlıklarıyla rss-parser nesnesi oluşturuyoruz
const parser = new Parser({
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7'
  }
});

app.use(express.json());
app.use(express.static('public'));

// Veritabanı, Yapılandırma ve indirme yolları tanımları
const dbPath = path.join(__dirname, 'db.json');
const configIniName = os.platform() === 'win32' ? 'configwin.ini' : 'configunix.ini';
const configIniPath = path.join(__dirname, configIniName);
const channelsIniPath = path.join(__dirname, 'channels.ini');
const ytdlpPath = path.join(__dirname, 'yt-dlp', os.platform() === 'win32' ? 'yt-dlp.exe' : 'yt-dlp');
const defaultDownloadDir = path.join(__dirname, 'download');

// Determing port from config.ini early
let PORT = 4141;
try {
  if (fs.existsSync(configIniPath)) {
    const iniContent = fs.readFileSync(configIniPath, 'utf-8');
    const lines = iniContent.split(/\r?\n/);
    let inSettings = false;
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.toLowerCase() === '[settings]') {
        inSettings = true;
        continue;
      }
      if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
        inSettings = false;
        continue;
      }
      if (inSettings) {
        const equalsIdx = trimmed.indexOf('=');
        if (equalsIdx !== -1) {
          const key = trimmed.slice(0, equalsIdx).trim().toLowerCase();
          const val = trimmed.slice(equalsIdx + 1).trim();
          if (key === 'port') {
            PORT = parseInt(val, 10) || 4141;
            break;
          }
        }
      }
    }
  }
} catch (e) {
  console.error(`Error reading port from ${configIniName}:`, e.message);
}

// Varsayılan veritabanı ayarları
const defaultDb = {
  channels: [],
  history: [],
  settings: {
    downloadPath: defaultDownloadDir, // Güvenlik amaçlı F: yerine proje içi dizin varsayılanı kullanılıyor
    browser: 'none',
    quality: 'best',
    channelCheckInterval: 5,
    autoDownload: true,
    showShorts: false,
    rssLimit: 15,
    autoDeleteDays: 0,
    theme: 'dark',
    shortsMigrationDone: true,
    cookieDefaultMigrationDone: true,
    downloadSpeedLimit: 0,
    useAlternativeSpeed: false,
    alternativeSpeedLimit: 501,
    port: 4141,
    playerPreference: 'system',
    playerType: 'plyr',
    lang: 'tr',
    isPaused: false,
    showNotifications: true,
    autoOpenBrowser: true,
    historyLimitPerChannel: 30,
    mergeType: 'single',
    writeThumbnail: false,
    playSounds: true,
    shortsDurationLimit: 180
  }
};

// Türkçe Açıklama: Etkin indirme hız sınırını belirler. Eğer alternatif hız sınırı aktif ise alternatif sınırı, değilse normal sınırı döner.
/**
 * Etkin indirme hız sınırını belirler.
 * 
 * @param {object} settings Ayarlar nesnesi
 * @returns {number} Etkin hız sınırı (KB/s)
 */
function getEffectiveSpeedLimit(settings) {
  if (settings.useAlternativeSpeed) {
    return settings.alternativeSpeedLimit || 0;
  }
  return settings.downloadSpeedLimit || 0;
}

// Türkçe Açıklama: Belirtilen INI dosya yolundaki içeriği okuyup JavaScript nesnesi (bölümler ve anahtar-değer çiftleri halinde) olarak ayrıştırır.
/**
 * Belirtilen INI dosyasını okuyup JavaScript nesnesi (JSON) olarak ayrıştırır.
 * Açıklama satırlarını (; veya #) ve boşlukları göz ardı eder.
 * 
 * @param {string} filePath INI dosyasının tam yolu
 * @returns {object} Ayrıştırılmış INI verisi (anahtar-değer çiftleri)
 */
function parseIni(filePath) {
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

// Türkçe Açıklama: Bir nesne içinde büyük/küçük harf duyarsız (case-insensitive) olarak anahtar araması yapar.
/**
 * Bir nesne içinde büyük/küçük harf duyarsız olarak anahtar araması yapar.
 * 
 * @param {object} obj Arama yapılacak nesne
 * @param {string} targetKey Aranacak anahtar ismi (Case-insensitive)
 * @returns {*} Bulunan değer veya undefined
 */
function getCaseInsensitiveKey(obj, targetKey) {
  if (!obj) return undefined;
  const targetLower = targetKey.toLowerCase();
  const foundKey = Object.keys(obj).find(k => k.toLowerCase() === targetLower);
  return foundKey ? obj[foundKey] : undefined;
}

// Türkçe Açıklama: Bölüm ve anahtar-değer yapısındaki JavaScript nesnesini standart INI dosyası biçiminde diske kaydeder.
/**
 * Bir veri nesnesini INI formatında belirtilen dosyaya yazar.
 * 
 * @param {string} filePath Yazılacak INI dosyasının yolu
 * @param {object} data Yazılacak veri nesnesi (Bölümler ve anahtar-değerler)
 */
const settingComments = {
  downloadPath: '# İndirme Klasörü / Download Directory\n# Varsayılan: download (Uygulama klasörü içindeki download dizini)\n# Default: download (Download directory inside the application folder)',
  browser: '# Çerez Çekilecek Tarayıcı / Browser to Import Cookies From\n# Seçenekler: none, chrome, firefox, edge, msedge vb.\n# Options: none, chrome, firefox, edge, msedge, etc.',
  quality: '# Video İndirme Kalitesi / Video Download Quality\n# Seçenekler: best, 1080p, 720p, 480p, 360p vb.\n# Options: best, 1080p, 720p, 480p, 360p, etc.',
  channelCheckInterval: '# Kanal Kontrol Sıklığı (Saniye) / Channel Check Interval (Seconds)\n# Kanalların ne sıklıkla taranacağını belirler.\n# Determines how frequently channels are scanned.',
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
  autoOpenBrowser: '# Başlangıçta Tarayıcıyı Aç / Auto Open Browser on Startup\n# Seçenekler: true (etkin), false (devre dışı)\n# Options: true (enabled), false (disabled)'
};

function writeIni(filePath, data) {
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
  fs.writeFileSync(filePath, content, 'utf-8');
}

// Türkçe Açıklama: Klasör simgesi olarak kullanılacak olan standart PNG formatındaki resmi Windows uyumlu ICO (ikon) dosyasına dönüştürür.
/**
 * Belirtilen PNG resmini Windows uyumlu bir ICO dosyasına dönüştürür.
 * 
 * @param {string} pngPath Kaynak PNG dosya yolu
 * @param {string} icoPath Hedef ICO dosya yolu
 */
function convertPngToIco(pngPath, icoPath) {
  try {
    if (!fs.existsSync(pngPath)) return;
    const pngBuffer = fs.readFileSync(pngPath);
    const icoBuffer = Buffer.alloc(22 + pngBuffer.length);
    
    // Header
    icoBuffer.writeUInt16LE(0, 0); // Reserved
    icoBuffer.writeUInt16LE(1, 2); // Type (1 = Icon)
    icoBuffer.writeUInt16LE(1, 4); // Count (1 image)
    
    // Directory Entry (256x256 pixel boyutuna göre)
    icoBuffer.writeUInt8(0, 6); // Genişlik (0 = 256)
    icoBuffer.writeUInt8(0, 7); // Yükseklik (0 = 256)
    icoBuffer.writeUInt8(0, 8); // Renk Paleti (0)
    icoBuffer.writeUInt8(0, 9); // Reserved (0)
    icoBuffer.writeUInt16LE(1, 10); // Color planes (1)
    icoBuffer.writeUInt16LE(32, 12); // Bits per pixel (32 bpp)
    icoBuffer.writeUInt32LE(pngBuffer.length, 14); // Dosya boyutu
    icoBuffer.writeUInt32LE(22, 18); // Resim verisi başlangıç konumu
    
    // PNG verisini kopyala
    pngBuffer.copy(icoBuffer, 22);
    
    fs.writeFileSync(icoPath, icoBuffer);
    console.log('icon.ico dosyası başarıyla oluşturuldu.');
  } catch (err) {
    console.error('icon.ico oluşturulurken Error occurred:', err.message);
  }
}

/**
 * Verilen URL'yi doğrudan çekmeyi dener. Hata veya HTTP >= 400 durumunda,
 * tanımlı proxy listesini sırayla kullanarak içeriği çekmeye çalışır.
 * 
 * @param {string} targetUrl Çekilmek istenen orijinal URL
 * @returns {Promise<string>} Yanıt içeriği
 */
function fetchWithProxyWaterfall(targetUrl) {
  const proxies = [
    url => url,
    url => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
    url => `https://corsproxy.io/?${encodeURIComponent(url)}`,
    url => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`
  ];

  return new Promise((resolve, reject) => {
    let index = 0;

    function tryNext() {
      if (index >= proxies.length) {
        return reject(new Error(`Orijinal ve proxy sunucuları üzerinden ${targetUrl} adresi çekilemedi.`));
      }

      const activeUrl = proxies[index](targetUrl);
      const isDirect = index === 0;

      console.log(`[Waterfall] Istek gonderiliyor (Index: ${index}, Direct: ${isDirect}): ${activeUrl}`);
      
      let urlObj;
      try {
        urlObj = new URL(activeUrl);
      } catch (e) {
        console.log(`[Waterfall] Gecersiz URL formati (Index: ${index}): ${activeUrl}`);
        index++;
        tryNext();
        return;
      }

      function performRequest(requestUrl, redirectCount = 0) {
        if (redirectCount > 5) {
          console.log(`[Waterfall] Cok fazla yonlendirme (Index: ${index})`);
          index++;
          tryNext();
          return;
        }

        const reqOptions = {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
          }
        };

        const currentUrlObj = new URL(requestUrl);
        const currentGetter = currentUrlObj.protocol === 'https:' ? https : http;

        currentGetter.get(currentUrlObj, reqOptions, (res) => {
          if (res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 307 || res.statusCode === 308) {
            let location = res.headers.location;
            if (location) {
              if (!location.startsWith('http')) {
                location = currentUrlObj.origin + location;
              }
              performRequest(location, redirectCount + 1);
              return;
            }
          }

          if (res.statusCode !== 200) {
            console.log(`[Waterfall] Hata kodu (Index: ${index}): HTTP ${res.statusCode}`);
            index++;
            tryNext();
            return;
          }

          let data = '';
          res.on('data', chunk => { data += chunk; });
          res.on('end', () => {
            resolve(data);
          });
        }).on('error', (err) => {
          console.log(`[Waterfall] Istek hatasi (Index: ${index}): ${err.message}`);
          index++;
          tryNext();
        });
      }

      performRequest(activeUrl);
    }

    tryNext();
  });
}

/**
 * Belirtilen URL'deki kanal logosunu yerel diskteki kanal klasörüne kaydeder.
 * 
 * @param {string} url Profil resmi uzak URL'si
 * @param {string} channelName Kanal ismi
 * @returns {Promise<string>} Yerel dosya yolu veya hata durumunda boş dize
 */
// Türkçe Açıklama: Kanal logosunu uzak sunucudan indirip kanal klasörüne kaydeder.
function downloadChannelAvatar(url, channelName) {
  return new Promise((resolve) => {
    if (!url || !channelName) return resolve('');
    const db = readDb();
    const channelDir = path.join(db.settings.downloadPath, channelName);
    const destPath = path.join(channelDir, 'avatar.jpg');

    if (!fs.existsSync(channelDir)) {
      try {
        fs.mkdirSync(channelDir, { recursive: true });
      } catch (err) {
        console.error('Kanal klasörü could not be createdı:', err.message);
        return resolve('');
      }
    }

    const proxies = [
      u => u,
      u => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
      u => `https://corsproxy.io/?${encodeURIComponent(u)}`,
      u => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(u)}`
    ];

    let index = 0;

    function tryDownload() {
      if (index >= proxies.length) {
        console.log(`[Kanal] Kanal logosu hicbir yontemle indirilemedi: ${channelName}`);
        return resolve('');
      }

      const activeUrl = proxies[index](url);

      let urlObj;
      try {
        urlObj = new URL(activeUrl);
      } catch (e) {
        index++;
        tryDownload();
        return;
      }

      const getter = urlObj.protocol === 'https:' ? https : http;

      getter.get(urlObj, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      }, (res) => {
        if (res.statusCode !== 200) {
          index++;
          tryDownload();
          return;
        }

        const fileStream = fs.createWriteStream(destPath);
        res.pipe(fileStream);
        fileStream.on('finish', () => {
          fileStream.close();
          console.log(`[AYAR] Kanal logosu indirildi: ${channelName} -> avatar.jpg (Yontem Index: ${index})`);
          setFolderIcon(channelDir, destPath);
          resolve(destPath);
        });
        fileStream.on('error', (err) => {
          fileStream.close();
          fs.unlink(destPath, () => {});
          index++;
          tryDownload();
        });
      }).on('error', () => {
        index++;
        tryDownload();
      });
    }

    tryDownload();
  });
}

/**
 * Windows'ta bir klasörün simgesini (ikonunu) kanal logosu yapacak şekilde ayarlar.
 * 
 * @param {string} folderPath Hedef klasör yolu
 * @param {string} imagePath Kaynak resim yolu (.jpg veya .png)
 */
// Türkçe Açıklama: Windows'ta desktop.ini ve gizli avatar.ico dosyası oluşturarak klasör simgesini kanal logosu yapar.
function setFolderIcon(folderPath, imagePath) {
  if (os.platform() !== 'win32') return;
  try {
    const iniPath = path.join(folderPath, 'desktop.ini');
    const icoPath = path.join(folderPath, 'avatar.ico');
    
    // Var olan eski öznitelikleri senkron olarak kaldır
    if (fs.existsSync(iniPath)) {
      try {
        execSync(`attrib -h -s "${iniPath}"`);
        fs.unlinkSync(iniPath);
      } catch (e) {}
    }
    if (fs.existsSync(icoPath)) {
      try {
        execSync(`attrib -h -s "${icoPath}"`);
        fs.unlinkSync(icoPath);
      } catch (e) {}
    }

    // Resmi okuyup ICO dosyasına dönüştür
    const imgBuffer = fs.readFileSync(imagePath);
    const icoBuffer = Buffer.alloc(22 + imgBuffer.length);
    
    icoBuffer.writeUInt16LE(0, 0); // Reserved
    icoBuffer.writeUInt16LE(1, 2); // Type (1 = Icon)
    icoBuffer.writeUInt16LE(1, 4); // Count (1 image)
    icoBuffer.writeUInt8(0, 6); // Width
    icoBuffer.writeUInt8(0, 7); // Height
    icoBuffer.writeUInt8(0, 8); // Color count
    icoBuffer.writeUInt8(0, 9); // Reserved
    icoBuffer.writeUInt16LE(1, 10); // Color planes
    icoBuffer.writeUInt16LE(32, 12); // Bits per pixel
    icoBuffer.writeUInt32LE(imgBuffer.length, 14); // Image size
    icoBuffer.writeUInt32LE(22, 18); // Image offset
    imgBuffer.copy(icoBuffer, 22);
    
    fs.writeFileSync(icoPath, icoBuffer);

    // desktop.ini içeriğini yaz
    const iniContent = `[.ShellClassInfo]\r\nIconResource=avatar.ico,0\r\n[ViewState]\r\nFolderType=Videos\r\n`;
    fs.writeFileSync(iniPath, iniContent, { encoding: 'utf-8' });

    // Öznitelikleri ayarla (Klasör için ReadOnly, dosyalar için Hidden ve System)
    execSync(`attrib +r "${folderPath}"`);
    execSync(`attrib +h +s "${iniPath}"`);
    execSync(`attrib +h "${icoPath}"`);
    
    console.log(`[AYAR] Klasör simgesi successfully updated: ${folderPath}`);
  } catch (err) {
    console.error('Klasör simgesi ayarlanırken Error occurred:', err.message);
  }
}


/**
 * INI yapılandırma dosyalarındaki (configwin.ini/configunix.ini, channels.ini) verileri okur
 * ve ana veritabanı (db.json) nesnesi ile senkronize eder.
 * 
 * @param {object} db Senkronize edilecek veritabanı nesnesi
 */
function syncWithIni(db) {
  // icon.ico kontrolü
  const pngPath = path.join(__dirname, 'public', 'logo.png');
  const icoPath = path.join(__dirname, 'icon.ico');
  if (!fs.existsSync(icoPath) && fs.existsSync(pngPath)) {
    convertPngToIco(pngPath, icoPath);
  }

  // Eski tekil config.ini dosyasından yeni işletim sistemine özel yapılandırmaya göç
  const oldConfigIniPath = path.join(__dirname, 'config.ini');
  if (fs.existsSync(oldConfigIniPath) && !fs.existsSync(configIniPath)) {
    console.log(`[Migration] Eski config.ini tespit edildi, ${configIniName} dosyasına taşınıyor...`);
    try {
      fs.renameSync(oldConfigIniPath, configIniPath);
      console.log(`[Migration] config.ini başarıyla ${configIniName} olarak yeniden adlandırıldı.`);
    } catch (e) {
      console.error('[Migration] Eski config.ini taşınırken Error occurred:', e.message);
    }
  }

  // Typo kurtarma ve migrasyon (config.inilş -> config.ini ve channels.ini)
  const configIniTypoPath = path.join(__dirname, 'config.inilş');
  let migratedSettings = null;
  let migratedChannels = null;
  if (fs.existsSync(configIniTypoPath)) {
    console.log('[Migration] Errorlı isimlendirilmiş config.inilş tespit edildi. Göç işlemi başlatılıyor...');
    try {
      const typoData = parseIni(configIniTypoPath);
      migratedSettings = getCaseInsensitiveKey(typoData, 'Settings');
      migratedChannels = getCaseInsensitiveKey(typoData, 'Channels');
      fs.unlinkSync(configIniTypoPath); // Göç sonrası sil
      console.log('[Migration] config.inilş başarıyla taşındı ve deleted.');
    } catch (e) {
      console.error('[Migration] Error:', e.message);
    }
  }

  // 1. config.ini (Ayarlar) Eşitlemesi
  if (!fs.existsSync(configIniPath)) {
    console.log(`[Sync] ${configIniName} not foundı. Mevcut ayarlarla oluşturuluyor.`);
    saveSettingsToIni(db);
  } else {
    const iniData = parseIni(configIniPath);
    const settingsSection = getCaseInsensitiveKey(iniData, 'Settings') || iniData;
    if (settingsSection) {
      const downloadPath = getCaseInsensitiveKey(settingsSection, 'downloadPath');
      if (downloadPath !== undefined) db.settings.downloadPath = downloadPath;

      const browser = getCaseInsensitiveKey(settingsSection, 'browser');
      if (browser !== undefined) db.settings.browser = browser;

      const quality = getCaseInsensitiveKey(settingsSection, 'quality');
      if (quality !== undefined) db.settings.quality = quality;

      const channelCheckInterval = getCaseInsensitiveKey(settingsSection, 'channelCheckInterval');
      if (channelCheckInterval !== undefined) {
        db.settings.channelCheckInterval = parseInt(channelCheckInterval, 10) || 60;
      }

      const autoDownload = getCaseInsensitiveKey(settingsSection, 'autoDownload');
      if (autoDownload !== undefined) {
        db.settings.autoDownload = autoDownload === 'true';
      }

      const mergeType = getCaseInsensitiveKey(settingsSection, 'mergeType');
      if (mergeType !== undefined) db.settings.mergeType = mergeType;

      const writeThumbnail = getCaseInsensitiveKey(settingsSection, 'writeThumbnail');
      if (writeThumbnail !== undefined) {
        db.settings.writeThumbnail = writeThumbnail === 'true';
      }

      const showShorts = getCaseInsensitiveKey(settingsSection, 'showShorts');
      if (showShorts !== undefined) {
        db.settings.showShorts = showShorts === 'true';
      }

      const rssLimit = getCaseInsensitiveKey(settingsSection, 'rssLimit');
      if (rssLimit !== undefined) {
        db.settings.rssLimit = parseInt(rssLimit, 10) || 5;
      }

      const autoDeleteDays = getCaseInsensitiveKey(settingsSection, 'autoDeleteDays');
      if (autoDeleteDays !== undefined) {
        db.settings.autoDeleteDays = parseInt(autoDeleteDays, 10) || 0;
      }

      const downloadSpeedLimit = getCaseInsensitiveKey(settingsSection, 'downloadSpeedLimit');
      if (downloadSpeedLimit !== undefined) {
        db.settings.downloadSpeedLimit = parseInt(downloadSpeedLimit, 10) || 0;
      }

      const useAlternativeSpeed = getCaseInsensitiveKey(settingsSection, 'useAlternativeSpeed');
      if (useAlternativeSpeed !== undefined) {
        db.settings.useAlternativeSpeed = useAlternativeSpeed === 'true';
      }

      const alternativeSpeedLimit = getCaseInsensitiveKey(settingsSection, 'alternativeSpeedLimit');
      if (alternativeSpeedLimit !== undefined) {
        db.settings.alternativeSpeedLimit = parseInt(alternativeSpeedLimit, 10) || 500;
      }

      const theme = getCaseInsensitiveKey(settingsSection, 'theme');
      if (theme !== undefined) db.settings.theme = theme;

      const port = getCaseInsensitiveKey(settingsSection, 'port');
      if (port !== undefined) {
        db.settings.port = parseInt(port, 10) || 4141;
      }

      const playerPreference = getCaseInsensitiveKey(settingsSection, 'playerPreference');
      if (playerPreference !== undefined) {
        db.settings.playerPreference = playerPreference; // 'system' or 'embedded'
      }

      const playerType = getCaseInsensitiveKey(settingsSection, 'playerType');
      if (playerType !== undefined) {
        db.settings.playerType = playerType; // 'plyr', 'artplayer', 'html5'
      }

      const playSounds = getCaseInsensitiveKey(settingsSection, 'playSounds');
      if (playSounds !== undefined) {
        db.settings.playSounds = playSounds !== 'false';
      }

      const lang = getCaseInsensitiveKey(settingsSection, 'lang');
      if (lang !== undefined) db.settings.lang = lang;

      const isPaused = getCaseInsensitiveKey(settingsSection, 'isPaused');
      if (isPaused !== undefined) {
        db.settings.isPaused = isPaused === 'true';
      }

      const showNotifications = getCaseInsensitiveKey(settingsSection, 'showNotifications');
      if (showNotifications !== undefined) {
        db.settings.showNotifications = showNotifications !== 'false';
      }

      const autoOpenBrowser = getCaseInsensitiveKey(settingsSection, 'autoOpenBrowser');
      if (autoOpenBrowser !== undefined) {
        db.settings.autoOpenBrowser = autoOpenBrowser !== 'false';
      }
    }
  }

  // Göçten gelen ayarlar varsa ez ve kaydet
  if (migratedSettings) {
    db.settings = { ...db.settings, ...migratedSettings };
    saveSettingsToIni(db);
  }

  // 2. channels.ini (Kanallar) Eşitlemesi
  let channelsData = null;
  if (migratedChannels) {
    channelsData = migratedChannels;
  } else if (fs.existsSync(channelsIniPath)) {
    const parsedChannels = parseIni(channelsIniPath);
    channelsData = getCaseInsensitiveKey(parsedChannels, 'Channels') || parsedChannels;
  }

  if (channelsData) {
    const updatedChannels = [];
    for (const id in channelsData) {
      const value = channelsData[id];
      const parts = value.split('|').map(s => s.trim());
      
      let downloadShorts = false;
      let quality = 'default';
      let addedAt = new Date().toISOString();
      let handleOrUrl = '';
      let name = id;
      let avatar = '';
      let shortsDurationLimit = 180;

      if (parts.length >= 7) {
        shortsDurationLimit = parseInt(parts[parts.length - 1], 10) || 180;
        avatar = parts[parts.length - 2];
        downloadShorts = parts[parts.length - 3] === 'true';
        quality = parts[parts.length - 4];
        addedAt = parts[parts.length - 5];
        handleOrUrl = parts[parts.length - 6];
        name = parts.slice(0, parts.length - 6).join(' | ');
      } else if (parts.length === 6) {
        avatar = parts[parts.length - 1];
        downloadShorts = parts[parts.length - 2] === 'true';
        quality = parts[parts.length - 3];
        addedAt = parts[parts.length - 4];
        handleOrUrl = parts[parts.length - 5];
        name = parts.slice(0, parts.length - 5).join(' | ');
      } else if (parts.length === 5) {
        downloadShorts = parts[parts.length - 1] === 'true';
        quality = parts[parts.length - 2];
        addedAt = parts[parts.length - 3];
        handleOrUrl = parts[parts.length - 4];
        name = parts.slice(0, parts.length - 4).join(' | ');
      } else if (parts.length === 4) {
        quality = parts[3];
        addedAt = parts[2];
        handleOrUrl = parts[1];
        name = parts[0];
      } else if (parts.length === 3) {
        addedAt = parts[2];
        handleOrUrl = parts[1];
        name = parts[0];
      } else if (parts.length === 2) {
        handleOrUrl = parts[1];
        name = parts[0];
      } else if (parts.length === 1) {
        name = parts[0];
      }
      
      if (!handleOrUrl) handleOrUrl = `@${name.replace(/\s+/g, '')}`;
      
      const existingChannel = db.channels.find(c => c.id === id);
      const dbAvatar = existingChannel ? (existingChannel.avatar || '') : '';
      const finalAvatar = avatar || dbAvatar;
      const finalShortsLimit = existingChannel ? (existingChannel.shortsDurationLimit || shortsDurationLimit) : shortsDurationLimit;
      
      updatedChannels.push({ id, name, handle: handleOrUrl, addedAt, quality, downloadShorts, avatar: finalAvatar, shortsDurationLimit: finalShortsLimit });
    }
    db.channels = updatedChannels;
  } else {
    if (!fs.existsSync(channelsIniPath)) {
      saveChannelsToIni(db);
    }
  }

  // Göç edilen verileri hemen diske ve yeni INI dosyalarına yaz
  if (migratedSettings || migratedChannels) {
    console.log('[Migration] Göç edilen veriler veritabanına kaydediliyor...');
    writeDb(db);
  }
}

/**
 * Veritabanı nesnesindeki mevcut ayarları işletim sistemine özel yapılandırma dosyasına kaydeder.
 * 
 * @param {object} db Kaydedilecek veritabanı nesnesi
 */
function saveSettingsToIni(db) {
  const iniData = { Settings: {} };
  
  iniData.Settings.downloadPath = db.settings.downloadPath;
  iniData.Settings.browser = db.settings.browser;
  iniData.Settings.quality = db.settings.quality;
  iniData.Settings.channelCheckInterval = (db.settings.channelCheckInterval !== undefined ? db.settings.channelCheckInterval : 5).toString();
  iniData.Settings.autoDownload = db.settings.autoDownload.toString();
  iniData.Settings.mergeType = (db.settings.mergeType || 'merge').toString();
  iniData.Settings.writeThumbnail = (db.settings.writeThumbnail !== false).toString();
  iniData.Settings.showShorts = (db.settings.showShorts !== false).toString();
  iniData.Settings.rssLimit = (db.settings.rssLimit !== undefined ? db.settings.rssLimit : 15).toString();
  iniData.Settings.autoDeleteDays = (db.settings.autoDeleteDays || 0).toString();
  iniData.Settings.theme = (db.settings.theme || 'dark').toString();
  iniData.Settings.downloadSpeedLimit = (db.settings.downloadSpeedLimit || 0).toString();
  iniData.Settings.useAlternativeSpeed = (db.settings.useAlternativeSpeed === true).toString();
  iniData.Settings.alternativeSpeedLimit = (db.settings.alternativeSpeedLimit !== undefined ? db.settings.alternativeSpeedLimit : 501).toString();
  iniData.Settings.port = (db.settings.port || 4141).toString();
  iniData.Settings.playerPreference = (db.settings.playerPreference || 'system').toString();
  iniData.Settings.playerType = (db.settings.playerType || 'plyr').toString();
  iniData.Settings.playSounds = (db.settings.playSounds !== false).toString();
  iniData.Settings.lang = (db.settings.lang || 'tr').toString();
  iniData.Settings.isPaused = (db.settings.isPaused === true).toString();
  iniData.Settings.showNotifications = (db.settings.showNotifications !== false).toString();
  iniData.Settings.autoOpenBrowser = (db.settings.autoOpenBrowser !== false).toString();

  writeIni(configIniPath, iniData);
}

// Türkçe Açıklama: Veritabanındaki kanalları alfabetik sıraya koyarak 'channels.ini' dosyasına standart biçimde yazar.
/**
 * Veritabanı nesnesindeki kanalları alfabetik olarak sıralayıp 'channels.ini' dosyasına yazar.
 * 
 * @param {object} db Kaydedilecek veritabanı nesnesi
 */
function saveChannelsToIni(db) {
  const iniData = { Channels: {} };
  
  // Kanalları Türkçe duyarlı olacak şekilde ismine göre alfabetik sırala
  const sortedChannels = [...db.channels].sort((a, b) => 
    (a.name || '').localeCompare(b.name || '', 'tr', { sensitivity: 'base' })
  );
  
  for (const channel of sortedChannels) {
    let channelUrl = channel.handle;
    if (channelUrl && !channelUrl.startsWith('http')) {
      channelUrl = channelUrl.startsWith('@') 
        ? `https://www.youtube.com/${channelUrl}`
        : `https://www.youtube.com/channel/${channel.id}`;
    } else if (!channelUrl) {
      channelUrl = `https://www.youtube.com/channel/${channel.id}`;
    }
    iniData.Channels[channel.id] = `${channel.name} | ${channelUrl} | ${channel.addedAt} | ${channel.quality || 'default'} | ${channel.downloadShorts !== false} | ${channel.avatar || ''} | ${channel.shortsDurationLimit || 180}`;
  }
  writeIni(channelsIniPath, iniData);
}

/**
 * Veritabanını (db.json) dosyadan okur, eksik alanları varsayılanlarla doldurur,
 * INI dosyalarıyla eşitler ve diskte silinmiş dosyaları kontrol eder.
 * 
 * @returns {object} Güncel veritabanı nesnesi
 */
function readDb() {
  try {
    let db = defaultDb;
    if (fs.existsSync(dbPath)) {
      const data = fs.readFileSync(dbPath, 'utf8');
      const parsed = JSON.parse(data);
      db = {
        ...defaultDb,
        ...parsed,
        settings: {
          ...defaultDb.settings,
          ...(parsed.settings || {})
        }
      };

      // Eski kontrol sıklığı ve bekleme süresi ayarlarını temizle
      if (db.settings.checkInterval !== undefined) {
        if (db.settings.channelCheckInterval === undefined || db.settings.channelCheckInterval === 60) {
          if (db.settings.checkInterval !== 5) {
            db.settings.channelCheckInterval = db.settings.checkInterval * 60;
          }
        }
        delete db.settings.checkInterval;
      }
      if (db.settings.rssDelay !== undefined) {
        delete db.settings.rssDelay;
      }
    } else {
      fs.writeFileSync(dbPath, JSON.stringify(defaultDb, null, 2), 'utf8');
    }
    
    // config.ini ve channels.ini dosyasından eşitleme yap
    syncWithIni(db);

    // Shorts indirme ayarı migrasyonu (Mevcut tüm kanalların Shorts ayarlarını otomatik false yapar)
    if (!db.settings.shortsMigrationDone) {
      if (db.channels && db.channels.length > 0) {
        db.channels.forEach(channel => {
          channel.downloadShorts = false;
        });
      }
      db.settings.shortsMigrationDone = true;
      writeDb(db);
    }

    // Çerez varsayılanı migrasyonu (Chrome varsayılanını 'none' (çerez kullanma) olarak günceller)
    if (!db.settings.cookieDefaultMigrationDone) {
      if (db.settings.browser === 'chrome') {
        db.settings.browser = 'none';
      }
      db.settings.cookieDefaultMigrationDone = true;
      writeDb(db);
      saveSettingsToIni(db);
    }
    
    return db;
  } catch (err) {
    console.error('Veritabanı okuma hatası:', err);
    return defaultDb;
  }
}

/**
 * Disk üzerindeki dosyaları veritabanıyla senkronize eder (dosya varlığı, boyutu ve otomatik onarım).
 * Bu işlem yoğun disk I/O ve klasör tarama gerektirdiğinden arka plan görevine dönüştürülmüştür.
 */
function syncDbWithDisk() {
  try {
    // Disk işlemlerinde readDb()'nin sadece raw okumasını yapıyoruz
    let db = defaultDb;
    if (fs.existsSync(dbPath)) {
      try {
        db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
      } catch (e) {
        return;
      }
    } else {
      return;
    }

    let dbUpdated = false;
    if (db.history && db.history.length > 0) {
      const initialLength = db.history.length;
      const newHistory = [];
      
      for (const item of db.history) {
        if (item.status === 'completed') {
          let exists = item.filePath && fs.existsSync(item.filePath);
          if (!exists) {
            const foundPath = findVideoFileInDownloadDir(item.id, db.settings.downloadPath || defaultDownloadDir);
            if (foundPath) {
              item.filePath = foundPath;
              exists = true;
              dbUpdated = true;
              console.log(`[Disk Sync] Video dosyası yeni konumda tespit edildi: ${item.title} -> ${foundPath}`);
            }
          }
          if (exists) {
            if (item.fileMissing) {
              item.fileMissing = false;
              dbUpdated = true;
            }
            try {
              const stats = fs.statSync(item.filePath);
              const sizeInBytes = stats.size;
              let calculatedSize = '';
              if (sizeInBytes >= 1024 * 1024 * 1024) {
                calculatedSize = Math.round(sizeInBytes / (1024 * 1024 * 1024)) + ' GB';
              } else {
                calculatedSize = Math.round(sizeInBytes / (1024 * 1024)) + ' MB';
              }
              if (item.fileSize !== calculatedSize) {
                item.fileSize = calculatedSize;
                dbUpdated = true;
              }
            } catch (err) {
              console.error(`Size read errorı: ${item.title}`, err.message);
            }
            newHistory.push(item);
          } else {
            // File does NOT exist on disk!
            const isTracked = db.channels && db.channels.some(c => c.id === item.channelId);
            if (isTracked) {
              if (!item.fileMissing) {
                item.fileMissing = true;
                dbUpdated = true;
                console.log(`[Disk Sync] Video dosyası diskte not foundı: ${item.title}`);
              }
              newHistory.push(item);
            } else {
              dbUpdated = true;
              console.log(`[Disk Sync] Untracked video file missing from disk, removing from history: ${item.title}`);
            }
          }
        } else if (item.status === 'ignored' || item.status === 'failed') {
          const foundPath = findVideoFileInDownloadDir(item.id, db.settings.downloadPath || defaultDownloadDir);
          if (foundPath) {
            item.status = 'completed';
            item.filePath = foundPath;
            item.fileMissing = false;
            dbUpdated = true;
            console.log(`[Disk Sync] Ignored/Failed video diskte bulundu, 'completed' olarak geri yüklendi: ${item.title} -> ${foundPath}`);
            
            try {
              const stats = fs.statSync(foundPath);
              const sizeInBytes = stats.size;
              let calculatedSize = '';
              if (sizeInBytes >= 1024 * 1024 * 1024) {
                calculatedSize = Math.round(sizeInBytes / (1024 * 1024 * 1024)) + ' GB';
              } else {
                calculatedSize = Math.round(sizeInBytes / (1024 * 1024)) + ' MB';
              }
              item.fileSize = calculatedSize;
            } catch (err) {
              console.error(`Size read errorı: ${item.title}`, err.message);
            }
          }
          newHistory.push(item);
        } else {
          newHistory.push(item);
        }
      }
      
      if (newHistory.length !== initialLength) {
        db.history = newHistory;
        dbUpdated = true;
      }
    }

    if (dbUpdated) {
      fs.writeFileSync(dbPath, JSON.stringify(db, null, 2), 'utf8');
      broadcast('db_update', db);
    }
  } catch (err) {
    console.error('Disk senkronizasyon hatası:', err);
  }
}

// Türkçe Açıklama: JavaScript veritabanı nesnesini 'db.json' dosyasına yazar ve eş zamanlı olarak configwin.ini/configunix.ini ile channels.ini dosyalarını günceller.
/**
 * Veritabanı nesnesini 'db.json' dosyasına yazar ve INI dosyalarını günceller.
 * 
 * @param {object} data Yazılacak veritabanı nesnesi
 */
function writeDb(data) {
  try {
    fs.writeFileSync(dbPath, JSON.stringify(data, null, 2), 'utf8');
    saveSettingsToIni(data); // configwin.ini / configunix.ini dosyasına yaz
    saveChannelsToIni(data); // channels.ini dosyasına yaz
  } catch (err) {
    console.error('Veritabanı yazma hatası:', err);
  }
}

// CLI (Command Line Interface) Desteği
if (process.argv.length > 2) {
  const cliArgs = process.argv.slice(2);
  const cliCmd = cliArgs[0].toLowerCase();
  const cliVal = cliArgs[1] ? cliArgs[1].trim() : '';

  const db = readDb();

  if (cliCmd === 'ton') {
    db.settings.useAlternativeSpeed = true;
    writeDb(db);
    console.log(`Alternative speed limit (Turtle) ENABLED. Limit: ${getEffectiveSpeedLimit(db.settings)} KB/s`);
    process.exit(0);
  } else if (cliCmd === 'toff') {
    db.settings.useAlternativeSpeed = false;
    writeDb(db);
    console.log(`Alternative speed limit (Turtle) DISABLED. Limit: ${getEffectiveSpeedLimit(db.settings)} KB/s`);
    process.exit(0);
  } else if (cliCmd === 'status') {
    const effective = getEffectiveSpeedLimit(db.settings);
    const altStatus = db.settings.useAlternativeSpeed ? 'Active' : 'Inactive';
    console.log(`Status:
- Normal Speed Limit: ${db.settings.downloadSpeedLimit} KB/s
- Alternative Speed Limit: ${db.settings.alternativeSpeedLimit} KB/s
- Alternative Speed (Turtle) Active: ${altStatus}
- Effective Speed Limit: ${effective} KB/s`);
    process.exit(0);
  } else if (cliCmd === 'pd') {
    if (!cliVal) {
      console.error('Error: Invalid link. Example: haytool pd https://www.youtube.com/watch?v=dQw4w9WgXcQ');
      process.exit(1);
    }

    const targetUrl = cliArgs[1]; // Get original URL
    const youtubeRegex = /(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/))([^?&"'>\s]{11})/;
    const match = targetUrl.match(youtubeRegex);
    if (!match) {
      console.error('Error: Invalid YouTube video URL.');
      process.exit(1);
    }
    const videoId = match[1];

    // Try posting to active server
    const postData = JSON.stringify({ url: targetUrl });
    const reqOptions = {
      hostname: 'localhost',
      port: PORT,
      path: '/api/download-video',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = http.request(reqOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const resJson = JSON.parse(data);
          if (resJson.success) {
            console.log(`[Success] Video added to queue successfully (Active Server). ID: ${videoId}`);
            process.exit(0);
          } else {
            console.error(`Error: ${resJson.error || 'Failed to trigger download.'}`);
            process.exit(1);
          }
        } catch (e) {
          fallbackWriteToDb(videoId, targetUrl);
        }
      });
    });

    req.on('error', (e) => {
      fallbackWriteToDb(videoId, targetUrl);
    });

    req.write(postData);
    req.end();

    function fallbackWriteToDb(vid, url) {
      try {
        const localDbData = readDb();
        const alreadyInQueue = localDbData.queue && localDbData.queue.some(item => item.id === vid);
        const alreadyInHistory = localDbData.history && localDbData.history.some(item => item.id === vid);
        if (alreadyInQueue || alreadyInHistory) {
          console.log(`[Info] Video already in queue or history. ID: ${vid}`);
          process.exit(0);
        }

        if (!localDbData.queue) localDbData.queue = [];
        localDbData.queue.push({
          id: vid,
          title: 'Unknown Video (CLI)',
          channelId: 'manual',
          channelName: 'Manual Download (CLI)',
          url: url,
          publishedAt: ''
        });
        localDbData.history.push({
          id: vid,
          title: 'Unknown Video (CLI)',
          channelId: 'manual',
          channelName: 'Manual Download (CLI)',
          url: url,
          status: 'waiting',
          progress: 0,
          speed: '0 KB/s',
          size: '0 MB',
          eta: '00:00:00',
          downloadedAt: new Date().toISOString()
        });
        writeDb(localDbData);
        console.log(`[Success] Video added to database successfully (Server idle, will download on start). ID: ${vid}`);
        process.exit(0);
      } catch (err) {
        console.error('Error: Failed to write to database:', err.message);
        process.exit(1);
      }
    }
  } else {
    console.log(`
[HaYTooL CLI Help]
  Usage: haytool <command> [value]

  Commands:
  ton                                  (Alternative speed limit (Turtle) ENABLED)
  toff                                 (Alternative speed limit (Turtle) DISABLED)
  status                               (Show current speed limits and status)
  pd <youtube-url>                     (Add video to download queue)

  Examples:
  haytool ton
  haytool toff
  haytool status
  haytool pd https://www.youtube.com/watch?v=dQw4w9WgXcQ
    `);
    process.exit(0);
  }
}

// Türkçe Açıklama: Veritabanı geçmişindeki (history) belirli bir videonun durum, ilerleme hızı veya indirme yüzdesi gibi alanlarını günceller.
/**
 * Geçmişteki (history) belirli bir video kaydını günceller.
 * 
 * @param {string} videoId Güncellenecek videonun ID'si
 * @param {object} updates Yapılacak güncellemeler (alanlar ve yeni değerler)
 */
function updateHistoryItem(videoId, updates) {
  const db = readDb();
  const index = db.history.findIndex(h => h.id === videoId);
  if (index !== -1) {
    db.history[index] = { ...db.history[index], ...updates };
    writeDb(db);
  }
}

// Türkçe Açıklama: İndirmeleri gerçekleştiren yt-dlp.exe motorunun varlığını kontrol eder, eğer diskte bulunamazsa resmi sunucusundan otomatik olarak indirip kurar.
/**
 * yt-dlp motorunun varlığını kontrol eder, yoksa işletim sistemine uygun sürümünü indirir.
 * 
 * @returns {Promise<string>} Kurulan yt-dlp motorunun dosya yolu
 */
function ensureYtdlp() {
  return new Promise((resolve, reject) => {
    const filename = os.platform() === 'win32' ? 'yt-dlp.exe' : 'yt-dlp';
    if (fs.existsSync(ytdlpPath)) {
      console.log(`${filename} zaten mevcut.`);
      return resolve(ytdlpPath);
    }
    const err = new Error(`${filename} bulunamadı! Otomatik indirme iptal edildi. Lütfen yt-dlp/ klasörü altına ${filename} dosyasını ekleyin.`);
    console.error(err.message);
    broadcast('status_log', { message: err.message, type: 'error' });
    reject(err);
  });
}

// Türkçe Açıklama: İndirme durumlarına göre Windows işletim sistemine ait ses tiplerini (uyarı, onay vb.) ses kartı üzerinden çalar.
/**
 * Windows sistem bildirim seslerini çalar (İndirme başlama, başarı veya hata durumlarında).
 * 
 * @param {string} type Ses tipi ('start', 'success', 'error' veya 'notification')
 */
function playSystemSound(type = 'notification') {
  const db = readDb();
  if (db.settings && db.settings.playSounds === false) return;
  if (os.platform() !== 'win32') return;
  let soundCmd = '[System.Media.SystemSounds]::Asterisk.Play()';
  if (type === 'start') {
    soundCmd = '[System.Media.SystemSounds]::Asterisk.Play()';
  } else if (type === 'success') {
    soundCmd = '[System.Media.SystemSounds]::Question.Play()';
  } else if (type === 'error') {
    soundCmd = '[System.Media.SystemSounds]::Hand.Play()';
  }
  
  exec(`powershell -c "${soundCmd}"`, (err) => {
    if (err) console.error('Sistem sesi çalınamadı:', err.message);
  });
}

// Türkçe Açıklama: Windows işletim sisteminde PowerShell -EncodedCommand (Base64) kullanarak güvenli, tırnak işaretlerinden arındırılmış masaüstü bildirim balonu gösterir.
/**
 * Windows isletim sisteminde masaustu bildirim balonu (Toast/Tray Balloon) gosterir.
 * 
 * @param {string} title Bildirim basligi
 * @param {string} message Bildirim aciklamasi
 */
function showWindowsNotification(title, message) {
  const db = readDb();
  if (db.settings && db.settings.showNotifications === false) return;
  if (os.platform() !== 'win32') return;

  // Türkçe Açıklama: Bildirim başlığı ve mesajındaki kıvrık tırnakları düz tırnakla değiştiriyoruz. Sonrasında tek tırnakları PowerShell tek tırnaklı dize formatına uygun şekilde çift tek tırnakla kaçırıyoruz.
  const cleanTitle = title.replace(/[’‘]/g, "'").replace(/[“”]/g, '"');
  const cleanMessage = message.replace(/[’‘]/g, "'").replace(/[“”]/g, '"');

  const escapedTitle = cleanTitle.replace(/'/g, "''");
  const escapedMessage = cleanMessage.replace(/'/g, "''");

  const iconPath = path.resolve(__dirname, 'icon.ico').replace(/\\/g, '\\\\');

  const psScript = `
    [void] [System.Reflection.Assembly]::LoadWithPartialName('System.Windows.Forms');
    [void] [System.Reflection.Assembly]::LoadWithPartialName('System.Drawing');
    $notification = New-Object System.Windows.Forms.NotifyIcon;
    if (Test-Path '${iconPath}') {
      $notification.Icon = New-Object System.Drawing.Icon('${iconPath}');
    } else {
      $notification.Icon = [System.Drawing.SystemIcons]::Information;
    }
    $notification.BalloonTipTitle = '${escapedTitle}';
    $notification.BalloonTipText = '${escapedMessage}';
    $notification.Visible = $true;
    $notification.ShowBalloonTip(5000);
  `;

  // Türkçe Açıklama: PowerShell'in -EncodedCommand parametresi için betiği UTF-16LE biçiminde Base64 olarak kodlayıp çağırıyoruz. Bu sayede tüm özel karakter ve tırnak sorunlarını kökten çözüyoruz.
  const base64Script = Buffer.from(psScript, 'utf16le').toString('base64');

  exec(`powershell -NoProfile -NonInteractive -EncodedCommand ${base64Script}`, (err) => {
    if (err) console.error('Windows masaüstü bildirimi gönderilemedi:', err.message);
  });
}

/**
 * Sistemdeki FFmpeg yürütülebilir dosyasının konumunu işletim sistemine göre belirler.
 * 
 * @returns {string} FFmpeg dosya yolu
 */
function getFfmpegPath() {
  const ext = os.platform() === 'win32' ? '.exe' : '';
  const pathInSubfolder = path.resolve(`./ffmpeg/ffmpeg${ext}`);
  if (fs.existsSync(pathInSubfolder)) return pathInSubfolder;
  return path.resolve(`./ffmpeg${ext}`);
}

let isFfmpegWorkingCached = null;
function testFfmpegSync() {
  if (isFfmpegWorkingCached !== null) return isFfmpegWorkingCached;
  const ffmpegPath = getFfmpegPath();
  if (!fs.existsSync(ffmpegPath)) {
    isFfmpegWorkingCached = false;
    return false;
  }
  try {
    execFileSync(ffmpegPath, ['-version'], { stdio: 'ignore', timeout: 2000 });
    isFfmpegWorkingCached = true;
    return true;
  } catch (err) {
    console.error("FFmpeg test error details:", err.message || err);
    isFfmpegWorkingCached = false;
    return false;
  }
}

// FFmpeg (Ses/Video Birleştirici) Otomatik İndirici
let isFfmpegDownloading = false;
function ensureFfmpeg() {
  const ffmpegPath = getFfmpegPath();
  if (fs.existsSync(ffmpegPath)) return Promise.resolve(ffmpegPath);
  
  const err = new Error('FFmpeg bulunamadı! Otomatik indirme iptal edildi. Lütfen ffmpeg/ klasörü altına ffmpeg.exe ve ffprobe.exe dosyalarını ekleyin.');
  console.error(err.message);
  broadcast('status_log', { message: err.message, type: 'error' });
  return Promise.reject(err);
}

// Türkçe Açıklama: ISO 8601 biçimindeki zaman/süre metnini (PT1H20M15S gibi) okunabilir saat-dakika-saniye (1:20:15) formatına dönüştürür.
/**
 * ISO 8601 formatındaki süreyi okunabilir 'SS:DD:SN' veya 'DD:SN' formatına çevirir.
 * 
 * @param {string} iso ISO 8601 süre verisi (Örn: PT20M53S)
 * @returns {string} Okunabilir süre (Örn: 20:53)
 */
function parseIsoDuration(iso) {
  const hours = iso.match(/(\d+)H/)?.[1] || '';
  const minutes = iso.match(/(\d+)M/)?.[1] || '0';
  const seconds = iso.match(/(\d+)S/)?.[1] || '0';
  
  const minPad = minutes.padStart(2, '0');
  const secPad = seconds.padStart(2, '0');
  
  if (hours) {
    return `${hours}:${minPad}:${secPad}`;
  }
  return `${minutes}:${secPad}`;
}

// Türkçe Açıklama: Biçimlendirilmiş süre metnini inceleyerek videonun 3 dakika (180 saniye) veya daha kısa bir YouTube Short videosu olup olmadığını belirler.
/**
 * Süreye bakarak videonun YouTube Short olup olmadığını belirler (180 saniye veya daha az).
 * 
 * @param {string} durationStr Biçimlendirilmiş süre metni (Örn: 2:30)
 * @returns {boolean} Video Short ise true
 */
function isShortDuration(durationStr, limit = 180) {
  if (!durationStr) return false;
  
  const parts = durationStr.split(':').map(Number);
  let totalSeconds = 0;
  
  if (parts.length === 1) {
    totalSeconds = parts[0];
  } else if (parts.length === 2) {
    totalSeconds = (parts[0] * 60) + parts[1];
  } else if (parts.length === 3) {
    totalSeconds = (parts[0] * 3600) + (parts[1] * 60) + parts[2];
  }
  
  return totalSeconds <= limit;
}

// Türkçe Açıklama: YouTube watch sayfasını HTTP üzerinden çekip regex kullanarak video süresi, başlığı, yayınlanma tarihi ve yükleyen kanal bilgilerini ayıklar.
/**
 * Belirtilen videonun süresini, yüklenme tarihini, kanal ID'sini ve başlığını YouTube'dan çeker.
 * 
 * @param {string} videoId Çekilecek videonun YouTube ID'si
 * @returns {Promise<object>} Videonun süre, tarih, başlık ve kanal detayları
 */
function fetchVideoDuration(videoId) {
  return new Promise((resolve) => {
    const db = readDb();
    const langHeader = db.settings.lang === 'en' ? 'en-US,en;q=0.9' : 'tr-TR,tr;q=0.9';
    const maxRedirects = 5;
    let redirectCount = 0;
    let isShortRedirect = false;

    function getRequest(url) {
      if (redirectCount > maxRedirects) {
        console.log(`[fetchVideoDuration] Too many redirects for ${videoId}`);
        return resolve({ duration: '', publishedAt: '' });
      }

      https.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept-Language': langHeader
        }
      }, (res) => {
        // Handle redirect status codes: 301, 302, 303, 307, 308
        if ([301, 302, 303, 307, 308].includes(res.statusCode)) {
          let location = res.headers.location;
          if (location) {
            if (location.startsWith('/')) {
              location = 'https://www.youtube.com' + location;
            }
            
            if (location.includes('/shorts/')) {
              console.log(`[fetchVideoDuration] Short video detected via redirect to Shorts URL for video ID: ${videoId}`);
              isShortRedirect = true;
              redirectCount++;
              getShortsDuration(location);
              return;
            }

            redirectCount++;
            getRequest(location);
            return;
          }
        }

        if (res.statusCode !== 200) {
          console.log(`[fetchVideoDuration] Non-200 response (${res.statusCode}) for ${url}`);
          return resolve({ duration: isShortRedirect ? '0:59' : '', publishedAt: '' });
        }

        parseHtmlAndResolve(res);
      }).on('error', (err) => {
        console.error(`[fetchVideoDuration] Connection error for ${url}:`, err.message);
        resolve({ duration: isShortRedirect ? '0:59' : '', publishedAt: '' });
      });
    }

    function getShortsDuration(shortsUrl) {
      https.get(shortsUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept-Language': langHeader
        }
      }, (res) => {
        if (res.statusCode !== 200) {
          return resolve({ duration: '0:59', publishedAt: '' });
        }
        parseHtmlAndResolve(res, '0:59');
      }).on('error', () => {
        resolve({ duration: '0:59', publishedAt: '' });
      });
    }

    function parseHtmlAndResolve(res, fallbackVal = '') {
      let html = '';
      res.on('data', chunk => { html += chunk; });
      res.on('end', () => {
        // HTML Karakter kodlarını çözümler (örneğin &amp; -> &)
        function decodeHtmlEntities(str) {
          if (!str) return '';
          return str
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
            .replace(/&apos;/g, "'")
            .replace(/&#039;/g, "'");
        }

        // Kanal ID'sini çıkar
        let channelId = html.match(/"externalChannelId"\s*:\s*"(UC[a-zA-Z0-9_-]{22})"/)?.[1] ||
                        html.match(/"channelId"\s*:\s*"(UC[a-zA-Z0-9_-]{22})"/)?.[1] ||
                        html.match(/\/channel\/(UC[a-zA-Z0-9_-]{22})/)?.[1];

        // Kanal İsmini çıkar
        let channelName = html.match(/<link itemprop="name" content="([^"]+)"/)?.[1] ||
                          html.match(/"author"\s*:\s*"([^"]+)"/)?.[1];
        if (channelName) {
          channelName = decodeHtmlEntities(channelName.replace(' - YouTube', '').trim());
        }

        // Video Başlığını çıkar
        let title = html.match(/<meta itemprop="name" content="([^"]+)"/)?.[1] ||
                    html.match(/<meta property="og:title" content="([^"]+)"/)?.[1];
        if (title) {
          title = decodeHtmlEntities(title.replace(' - YouTube', '').trim());
        }

        // Video yayınlanma tarihini meta etiketlerinden ve json şablonlarından çek
        let publishedAt = '';
        const dateMatch = html.match(/<meta itemprop="datePublished" content="([^"]+)"/) ||
                          html.match(/<meta itemprop="uploadDate" content="([^"]+)"/) ||
                          html.match(/<meta property="og:video:release_date" content="([^"]+)"/);
        if (dateMatch) {
          try {
            publishedAt = new Date(dateMatch[1]).toISOString();
          } catch(e) {}
        }
        if (!publishedAt) {
          const jsonLdMatch = html.match(/"datePublished"\s*:\s*"([^"]+)"/) ||
                              html.match(/"uploadDate"\s*:\s*"([^"]+)"/) ||
                              html.match(/"publishDate"\s*:\s*"([^"]+)"/);
          if (jsonLdMatch) {
            try {
              publishedAt = new Date(jsonLdMatch[1]).toISOString();
            } catch(e) {}
          }
        }

        // Check if upcoming/premiere
        const isUpcoming = html.includes('"isUpcoming":true') || html.includes('upcomingEventData');
        if (isUpcoming) {
          console.log(`[fetchVideoDuration] Upcoming video detected for ID: ${videoId}`);
          return resolve({ duration: 'upcoming', publishedAt, title, channelId, channelName });
        }

        // Türkçe Açıklama: Canlı yayın tespiti yapılarak süre alanı 'live' olarak ayarlanıyor.
        const isLive = html.includes('"isLive":true') || html.includes('"isLiveNow":true') || html.includes('yt-live-player') || html.includes('LIVE_STREAMING');
        if (isLive) {
          console.log(`[fetchVideoDuration] Live video detected for ID: ${videoId}`);
          return resolve({ duration: 'live', publishedAt, title, channelId, channelName });
        }

        const match = html.match(/<meta itemprop="duration" content="([^"]+)"/);
        let duration = '';
        if (match) {
          duration = parseIsoDuration(match[1]);
        } else {
          const durationMatch = html.match(/"approxDurationMs"\s*:\s*"(\d+)"/);
          if (durationMatch) {
            const ms = parseInt(durationMatch[1], 10);
            const totalSec = Math.floor(ms / 1000);
            const h = Math.floor(totalSec / 3600);
            const m = Math.floor((totalSec % 3600) / 60);
            const s = totalSec % 60;
            const sP = s.toString().padStart(2, '0');
            if (h > 0) {
              const mP = m.toString().padStart(2, '0');
              duration = `${h}:${mP}:${sP}`;
            } else {
              duration = `${m}:${sP}`;
            }
          }
        }

        if (duration) {
          if (isShortRedirect) {
            const parts = duration.split(':').map(Number);
            let totalSeconds = 0;
            if (parts.length === 1) {
              totalSeconds = parts[0];
            } else if (parts.length === 2) {
              totalSeconds = (parts[0] * 60) + parts[1];
            } else if (parts.length === 3) {
              totalSeconds = (parts[0] * 3600) + (parts[1] * 60) + parts[2];
            }
            if (totalSeconds > 180) {
              return resolve({ duration: '0:59', publishedAt, title, channelId, channelName });
            }
          }
          resolve({ duration, publishedAt, title, channelId, channelName });
        } else {
          resolve({ duration: isShortRedirect ? '0:59' : fallbackVal, publishedAt, title, channelId, channelName });
        }
      });
    }

    getRequest(`https://www.youtube.com/watch?v=${videoId}`);
  });
}

// Türkçe Açıklama: Ana indirme klasörü altında aranan video ID'sini içeren indirilen asıl video dosyasını (resim ve meta dosyaları hariç tutarak) bulur.
/**
 * Klasörde belirtilen video ID'sini dosya isminde barındıran video dosyasını dinamik olarak arar ve bulur.
 * 
 * @param {string} videoId Video ID'si
 * @param {string} downloadPath İndirme klasör yolu
 * @returns {string|null} Bulunan dosyanın tam yolu veya null
 */
function findVideoFileInDownloadDir(videoId, downloadPath) {
  try {
    if (!fs.existsSync(downloadPath)) return null;
    const targetPattern = `[${videoId}]`;

    function searchDir(dir) {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (entry.name.startsWith('.')) continue; // Skip hidden folders
          const result = searchDir(fullPath);
          if (result) return result;
        } else {
          if (entry.name.includes(targetPattern)) {
            const ext = path.extname(entry.name).toLowerCase();
            // Skip thumbnails and metadata
            if (!['.jpg', '.jpeg', '.webp', '.png', '.json', '.temp', '.part', '.ytdl'].includes(ext)) {
              return fullPath;
            }
          }
        }
      }
      return null;
    }

    return searchDir(downloadPath);
  } catch (e) {
    console.error(`Error searching recursively for video ${videoId} in ${downloadPath}:`, e.message);
  }
  return null;
}

// Türkçe Açıklama: YouTube URL'sini doğrular, gerekirse YouTube'dan video başlığı ve kanal adı gibi bilgileri çeker ve indirme kuyruğuna ekler.
/**
 * Verilen video URL'sini çözümleyip indirme kuyruğuna ekler.
 * 
 * @param {string} urlText YouTube video URL'si
 * @returns {Promise<string>} Video ID'si
 */
async function addVideoToQueueByUrl(urlText) {
  const youtubeRegex = /(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/))([^?&"'>\s]{11})/;
  const match = urlText.match(youtubeRegex);
  if (!match) {
    throw new Error('Geçersiz YouTube video linki.');
  }
  const videoId = match[1];

  let title = '';
  let channelName = '';
  let channelId = '';

  try {
    console.log(`[Manual Download] Fetching video details from from YouTube: ${videoId}`);
    const details = await fetchVideoDuration(videoId);
    if (details) {
      if (details.title) title = details.title;
      if (details.channelName) channelName = details.channelName;
      if (details.channelId) channelId = details.channelId;
    }
  } catch (err) {
    console.error(`[Manual Download] details while fetching Error occurred:`, err.message);
  }

  downloadQueue.add({
    id: videoId,
    title: title || 'Bilinmeyen Video',
    channelId: channelId || 'manual',
    channelName: channelName || 'Manuel İndirme',
    url: `https://www.youtube.com/watch?v=${videoId}`,
    publishedAt: ''
  });

  resolveMissingDurations();
  return videoId;
}

let isResolvingDurations = false;
// Türkçe Açıklama: Veritabanındaki süresi veya yüklenme tarihi eksik olan geçmiş videoların eksik bilgilerini arka planda YouTube watch sayfasından çözümler.
/**
 * Veritabanındaki süresi veya yayınlanma tarihi eksik olan videoların detaylarını arka planda tamamlar.
 */
async function resolveMissingDurations() {
  if (isResolvingDurations) return;
  isResolvingDurations = true;
  
  const db = readDb();
  let updated = false;

  for (const item of db.history) {
    const needsDuration = !item.duration;
    const needsPublishDate = !item.publishedAt;
    if (needsDuration || needsPublishDate) {
      console.log(`Eksik bilgiler çözümleniyor: ${item.title}`);
      try {
        const result = await fetchVideoDuration(item.id);
        let itemUpdated = false;
        if (result) {
          if (result.duration && needsDuration) {
            item.duration = result.duration;
            itemUpdated = true;
          }
          if (result.publishedAt) {
            item.publishedAt = result.publishedAt;
            itemUpdated = true;
          }
          if (result.title && item.title !== result.title) {
            item.title = result.title;
            itemUpdated = true;
          }
          if (result.channelName && item.channelName !== result.channelName) {
            item.channelName = result.channelName;
            itemUpdated = true;
          }
          
          // Türkçe Açıklama: Süre veya yayın tarihi çözülemediğinde sonsuz döngüyü önlemek için deneme sayısı artırılır. 3 başarısız denemeden sonra '-' olarak işaretlenir.
          if ((!result.duration && needsDuration) || (!result.publishedAt && needsPublishDate)) {
            item.resolveAttempts = (item.resolveAttempts || 0) + 1;
            if (item.resolveAttempts >= 3) {
              if (needsDuration) item.duration = '-';
              if (needsPublishDate) item.publishedAt = '-';
            }
            itemUpdated = true;
          }
        } else {
          item.resolveAttempts = (item.resolveAttempts || 0) + 1;
          if (item.resolveAttempts >= 3) {
            if (needsDuration) item.duration = '-';
            if (needsPublishDate) item.publishedAt = '-';
          }
          itemUpdated = true;
        }

        if (itemUpdated) {
          updated = true;
          // İstekleri hafif aralıklarla atarak YouTube engellerini önle
          await new Promise(r => setTimeout(r, 200));
        }
      } catch (e) {
        console.error(`Süre alınamadı: ${item.id}`, e.message);
        item.resolveAttempts = (item.resolveAttempts || 0) + 1;
        if (item.resolveAttempts >= 3) {
          if (needsDuration) item.duration = '-';
          if (needsPublishDate) item.publishedAt = '-';
        }
        updated = true;
      }
    }
  }

  if (updated) {
    writeDb(db);
    broadcast('db_update', db);
  }
  isResolvingDurations = false;
}

/**
 * Belirtilen günden daha eski olan indirilmiş videoları yerel diskten ve geçmişten otomatik olarak temizler.
 */
function autoDeleteOldVideos() {
  const db = readDb();
  const autoDeleteDays = db.settings.autoDeleteDays || 0;
  if (autoDeleteDays <= 0) return;

  const thresholdMs = autoDeleteDays * 24 * 60 * 60 * 1000;
  const now = Date.now();
  let updated = false;

  for (const item of db.history) {
    if (item.status === 'completed' && item.filePath) {
      if (fs.existsSync(item.filePath)) {
        try {
          const stats = fs.statSync(item.filePath);
          const fileTime = stats.birthtimeMs || stats.mtimeMs || stats.ctimeMs;
          const ageMs = now - fileTime;

          if (ageMs > thresholdMs) {
            console.log(`[Auto-Delete] Video süresi doldu, siliniyor: ${item.title}`);
            // Dosyayı sil
            fs.unlinkSync(item.filePath);
            
            // Kapak resmini sil
            const ext = path.extname(item.filePath);
            const thumbJpg = item.filePath.replace(ext, '.jpg');
            const thumbWebp = item.filePath.replace(ext, '.webp');
            if (fs.existsSync(thumbJpg)) fs.unlinkSync(thumbJpg);
            if (fs.existsSync(thumbWebp)) fs.unlinkSync(thumbWebp);

            item.status = 'ignored';
            item.filePath = '';
            item.fileSize = '';
            updated = true;
            addTerminalLog(`[Oto-Silme] ${autoDeleteDays} older than 7 days olan "${item.title}" videosu diskten otomatik olarak deleted.`, 'info');
          }
        } catch (err) {
          console.error(`[Auto-Delete] Dosya silme hatası (${item.title}):`, err.message);
        }
      } else {
        item.status = 'ignored';
        item.filePath = '';
        item.fileSize = '';
        updated = true;
      }
    }
  }

  if (updated) {
    writeDb(db);
    broadcast('db_update', db);
  }
}

// Türkçe Açıklama: YouTube bağlantısı, kullanıcı adı veya video linkini çözümleyerek kanal ID'si, isim, avatar ve handle değerlerini bulur.
/**
 * Girilen YouTube kanal linki, kullanıcı adı veya video linkini çözümleyerek kanal ID'si, kanal ismini, logosunu ve handle adını bulur.
 * 
 * @param {string} input YouTube kanal/kullanıcı/video bağlantısı veya kullanıcı adı
 * @returns {Promise<object>} Çözümlenen kanal bilgileri (id, name, avatar, handle)
 */
// Türkçe Açıklama: YouTube bağlantısı, kullanıcı adı veya video linkini çözümleyerek kanal ID'si, isim, avatar ve handle değerlerini bulur.
/**
 * Girilen YouTube kanal linki, kullanıcı adı veya video linkini çözümleyerek kanal ID'si, kanal ismini, logosunu ve handle adını bulur.
 * 
 * @param {string} input YouTube kanal/kullanıcı/video bağlantısı veya kullanıcı adı
 * @returns {Promise<object>} Çözümlenen kanal bilgileri (id, name, avatar, handle)
 */
async function resolveChannelId(input) {
  // Türkçe Açıklama: Girdiyi URL decode ederek Nevşin Mengü gibi Türkçe ve özel karakter içeren kanalların düzgün çözümlenmesini sağlıyoruz.
  const decodedInput = decodeURIComponent(input.trim());
  
  let targetUrl = decodedInput;
  let isVideoUrl = false;

  // Eğer doğrudan kanal ID'si verilmişse (örn. UCv6jcPwFujuTIwFQ11jt1Yw)
  // Türkçe Açıklama: Doğrudan kanal ID'si girildiğinde de kanal sayfasını ziyaret edip isim, handle ve logoyu çözümlüyoruz.
  if (/^UC[a-zA-Z0-9_-]{22}$/.test(decodedInput)) {
    targetUrl = `https://www.youtube.com/channel/${decodedInput}`;
  } else {
    // Video URL'si tespiti ve video ID çıkarımı
    const videoMatch = decodedInput.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/))([^?&"'>\s]{11})/);
    if (videoMatch) {
      const videoId = videoMatch[1];
      targetUrl = `https://www.youtube.com/watch?v=${videoId}`;
      isVideoUrl = true;
      console.log(`Video URL'si tespit edildi. Video ID: ${videoId}`);
    } else if (!decodedInput.startsWith('http')) {
      // Sadece handle girildiyse (örn. @BarisOzcan)
      if (decodedInput.startsWith('@')) {
        targetUrl = `https://www.youtube.com/${decodedInput}`;
      } else {
        targetUrl = `https://www.youtube.com/@${decodedInput}`;
      }
    }
  }

  console.log(`Çözümlenecek adres: ${targetUrl}`);
  
  let fallbackChannelId = null;
  const directIdMatch = targetUrl.match(/\/channel\/(UC[a-zA-Z0-9_-]{22})/);
  if (directIdMatch) {
    fallbackChannelId = directIdMatch[1];
  } else if (/^UC[a-zA-Z0-9_-]{22}$/.test(decodedInput)) {
    fallbackChannelId = decodedInput;
  }

  async function tryRssFallback(channelId) {
    try {
      console.log(`[RSS Fallback] ${channelId} için RSS XML çekilmeye çalışılıyor...`);
      const xml = await fetchWithProxyWaterfall(`https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`);
      
      // Extract title/name from feed
      const titleMatch = xml.match(/<title>([^<]+)<\/title>/);
      let channelName = titleMatch ? titleMatch[1].replace(' - YouTube', '').trim() : `Kanal ${channelId}`;
      const authorMatch = xml.match(/<author>\s*<name>([^<]+)<\/name>/);
      if (authorMatch) {
        channelName = authorMatch[1].trim();
      }

      // Try to fetch avatar using yt-dlp with cookies if configured
      let avatarUrl = '';
      try {
        const db = readDb();
        const args = [];
        args.push('--js-runtimes', `node:${process.execPath}`);
        if (db.settings.browser && db.settings.browser !== 'none') {
          const browserName = db.settings.browser === 'msedge' ? 'edge' : db.settings.browser;
          args.push('--cookies-from-browser', browserName);
        }
        args.push('--dump-json', '--playlist-items', '0', `https://www.youtube.com/channel/${channelId}`);
        
        const spawnOptions = process.platform === 'win32' ? { windowsVerbatimArguments: false, windowsHide: true } : {};
        
        const ytdlpOutput = await new Promise((resDl, rejDl) => {
          const proc = spawn(ytdlpPath, args, spawnOptions);
          let out = '';
          let err = '';
          proc.stdout.on('data', (d) => { out += d.toString(); });
          proc.stderr.on('data', (d) => { err += d.toString(); });
          proc.on('close', (code) => {
            if (code !== 0) return rejDl(new Error(`Exit code ${code}. Stderr: ${err}`));
            resDl(out);
          });
        });

        const parsedData = JSON.parse(ytdlpOutput);
        if (parsedData.thumbnails && parsedData.thumbnails.length > 0) {
          const sortedThumbs = [...parsedData.thumbnails].sort((a, b) => (b.width || 0) - (a.width || 0));
          avatarUrl = sortedThumbs[0].url || '';
        }
      } catch (avatarErr) {
        console.log(`[RSS Fallback] yt-dlp ile logo çekilemedi: ${avatarErr.message}`);
      }

      return {
        id: channelId,
        name: channelName,
        avatar: avatarUrl
      };
    } catch (err) {
      console.log(`[RSS Fallback] RSS XML de başarısız oldu: ${err.message}. Varsayılan isimle ekleniyor.`);
      return {
        id: channelId,
        name: `Kanal ${channelId}`,
        avatar: ''
      };
    }
  }

  try {
    const html = await fetchWithProxyWaterfall(targetUrl);
    let channelId = null;
    let channelName = null;

    if (isVideoUrl) {
      channelId = html.match(/"externalChannelId"\s*:\s*"(UC[a-zA-Z0-9_-]{22})"/)?.[1] ||
                  html.match(/"channelId"\s*:\s*"(UC[a-zA-Z0-9_-]{22})"/)?.[1] ||
                  html.match(/\/channel\/(UC[a-zA-Z0-9_-]{22})/)?.[1];
      
      channelName = html.match(/<link itemprop="name" content="([^"]+)"/)?.[1] ||
                    html.match(/"author"\s*:\s*"([^"]+)"/)?.[1];
    } else {
      channelId = html.match(/<meta itemprop="channelId" content="(UC[a-zA-Z0-9_-]{22})"/)?.[1] ||
                  html.match(/<link rel="canonical" href="[^"]*youtube\.com\/channel\/(UC[a-zA-Z0-9_-]{22})"/)?.[1] ||
                  html.match(/youtube\.com\/feeds\/videos\.xml\?channel_id=(UC[a-zA-Z0-9_-]{22})/)?.[1] ||
                  html.match(/"browseId"\s*:\s*"(UC[a-zA-Z0-9_-]{22})"/)?.[1] ||
                  html.match(/"channelId"\s*:\s*"(UC[a-zA-Z0-9_-]{22})"/)?.[1] ||
                  html.match(/\/channel\/(UC[a-zA-Z0-9_-]{22})/)?.[1];
      
      const ogTitleMatch = html.match(/<meta property="og:title" content="([^"]+)"/);
      const titleMatch = html.match(/<title>([^<]+)<\/title>/);
      channelName = ogTitleMatch?.[1] || titleMatch?.[1];
    }

    if (channelName) {
      channelName = channelName.replace(' - YouTube', '').trim();
    }

    // Stable avatar resolving (prioritizing og:image / image_src)
    let avatarUrl = '';
    const ogImageMatch = html.match(/<meta property="og:image" content="([^"]+)"/);
    const linkImageMatch = html.match(/<link rel="image_src" href="([^"]+)"/);
    if (ogImageMatch) {
      avatarUrl = ogImageMatch[1];
    } else if (linkImageMatch) {
      avatarUrl = linkImageMatch[1];
    } else {
      const avatarMatch = html.match(/"avatarViewModel"\s*:\s*\{\s*"image"\s*:\s*\{\s*"sources"\s*:\s*\[\s*\{\s*"url"\s*:\s*"([^"]+)"/);
      avatarUrl = avatarMatch ? avatarMatch[1] : '';
    }

    const vanityMatch = html.match(/"vanityChannelUrl"\s*:\s*"https?:\/\/www\.youtube\.com\/(@[^"]+)"/);
    const handleVal = vanityMatch ? vanityMatch[1] : '';

    if (channelId) {
      console.log(`[Scraper] Kanal ID bulundu: ${channelId}. Gerçek kanal adını doğrulamak için RSS beslemesi sorgulanıyor...`);
      try {
        const rssInfo = await tryRssFallback(channelId);
        console.log(`[Scraper] RSS ile doğrulanan Kanal: ${rssInfo.name} (ID: ${channelId})`);
        return {
          id: channelId,
          name: rssInfo.name || channelName || `Kanal ${channelId}`,
          avatar: avatarUrl || rssInfo.avatar || '',
          handle: handleVal || ''
        };
      } catch (err) {
        console.log(`[Scraper] RSS sorgusu başarısız oldu, kazınan verilerle devam ediliyor: ${err.message}`);
        return {
          id: channelId,
          name: channelName || `Kanal ${channelId}`,
          avatar: avatarUrl || '',
          handle: handleVal || ''
        };
      }
    } else {
      if (fallbackChannelId) {
        return await tryRssFallback(fallbackChannelId);
      }
      throw new Error('Kanal ID veya kanal adı tespit edilemedi. Lütfen adresi kontrol edin.');
    }
  } catch (err) {
    if (fallbackChannelId) {
      return await tryRssFallback(fallbackChannelId);
    }
    throw err;
  }
}

// SSE Bağlantıları
let clients = [];
/**
 * Sunucu tarafındaki olayları (SSE) bağlı olan tüm istemci tarayıcılara iletir.
 * 
 * @param {string} event Olay ismi (Örn: 'db_update', 'progress')
 * @param {*} data Gönderilecek olay verisi
 */
function broadcast(event, data) {
  let dataToSend = data;
  clients.forEach(client => {
    client.write(`event: ${event}\ndata: ${JSON.stringify(dataToSend)}\n\n`);
  });
}

// Terminal Günlükleri (In-Memory Buffer)
let terminalLogs = [];
const MAX_LOGS = 300;

/**
 * Terminal çıktılarını in-memory log buffer'ına ekler ve istemciye anlık yayınlar.
 * 
 * @param {string} message Günlük mesajı
 * @param {string} type Günlük kategorisi ('info', 'success', 'warning', 'error')
 */
function addTerminalLog(message, type = 'info') {
  const trimmed = message.trim();
  if (!trimmed) return;
  
  const timestamp = new Date().toISOString();
  const logItem = { timestamp, message: trimmed, type };
  
  terminalLogs.push(logItem);
  if (terminalLogs.length > MAX_LOGS) {
    terminalLogs.shift();
  }
  
  broadcast('terminal_log', logItem);
}

// İndirme Kuyruğu
class DownloadQueue {
  constructor() {
    this.queue = [];
    this.activeDownloads = 0;
    this.maxConcurrent = 1;
    this.activeProcess = null;
    this.activeVideoId = null;
    this.isPaused = false; // Kuyruğun duraklatılma durumu
  }

  add(video) {
    if (this.queue.some(item => item.id === video.id)) return;

    const db = readDb();
    
    // Klasör oluşturulmasını sağla
    if (!fs.existsSync(db.settings.downloadPath)) {
      try {
        fs.mkdirSync(db.settings.downloadPath, { recursive: true });
      } catch (err) {
        console.error('İndirme klasörü could not be createdı:', err);
      }
    }

    let historyItem = db.history.find(h => h.id === video.id);
    if (!historyItem) {
      historyItem = {
        id: video.id,
        title: video.title,
        channelId: video.channelId,
        channelName: video.channelName,
        downloadedAt: new Date().toISOString(),
        publishedAt: video.publishedAt || new Date().toISOString(),
        status: 'waiting',
        progress: 0,
        speed: '',
        eta: '',
        fileSize: '',
        filePath: ''
      };
      db.history.push(historyItem);
      writeDb(db);
    } else {
      historyItem.status = 'waiting';
      historyItem.progress = 0;
      historyItem.speed = '';
      historyItem.eta = '';
      historyItem.downloadedAt = new Date().toISOString();
      if (video.publishedAt) {
        historyItem.publishedAt = video.publishedAt;
      }
      writeDb(db);
    }

    this.queue.push(video);
    broadcast('db_update', readDb());
    this.process();
  }

  process() {
    if (this.isPaused) {
      console.log('[Kuyruk] Queue pausedı. Bir sonraki indirme pending.');
      return;
    }

    // Türkçe Açıklama: Emniyet kontrolü - Aktif bir indirme süreci yoksa ancak sayaç sıfırlanmamışsa otomatik olarak düzelt.
    if (!this.activeProcess && this.activeDownloads > 0) {
      console.log(`[Kuyruk Safety] No active process foundı fakat activeDownloads counter resetıyor.`);
      this.activeDownloads = 0;
      this.activeVideoId = null;
    }

    if (this.activeDownloads >= this.maxConcurrent || this.queue.length === 0) return;

    const nextVideo = this.queue.shift();
    this.activeDownloads++;
    this.download(nextVideo);
  }

  // Türkçe Açıklama: Kuyruktan alınan videonun indirme sürecini yt-dlp ile başlatır, ilerleme ve hata loglarını yönetir.
  /**
   * Belirtilen videoyu yt-dlp kullanarak bilgisayara indirir ve durumunu günceller.
   * 
   * @param {object} video İndirilecek video nesnesi
   * @returns {Promise<void>}
   */
  async download(video) {
    try {
      await ensureYtdlp();
    } catch (err) {
      updateHistoryItem(video.id, {
        status: 'failed',
        error: 'yt-dlp motoru yüklenemedi.'
      });
      this.activeDownloads--;
      broadcast('db_update', readDb());
      this.process();
      return;
    }

    const db = readDb();
    const settings = db.settings;

    updateHistoryItem(video.id, { status: 'downloading', progress: 0 });
    broadcast('db_update', readDb());
    playSystemSound('start');
    addTerminalLog(`[Kuyruk] "${video.title}" videosu for download process startedı.`, 'info');
    showWindowsNotification(
      settings.lang === 'en' ? 'Download Started' : 'İndirme Başlatıldı',
      settings.lang === 'en' ? `"${video.title}" download process has started.` : `"${video.title}" videosunun indirme işlemi başladı.`
    );

    // Kanal alt klasörünü oluştur
    const channelFolder = path.join(settings.downloadPath, video.channelName);
    if (!fs.existsSync(channelFolder)) {
      try {
        fs.mkdirSync(channelFolder, { recursive: true });
      } catch (err) {
        console.error('Kanal klasörü could not be createdı:', err);
      }
    }

    // yt-dlp parametreleri
    // Windows dosya sistemi için geçersiz karakterleri temizlemek adına şablon kullanıyoruz ve sonuna [ID] ekliyoruz.
    const outputTemplate = path.join(channelFolder, `${video.channelName} - %(title)s [${video.id}].%(ext)s`);
    
    const args = [
      video.url,
      '--no-playlist',
      '--no-mtime',
      '--js-runtimes', `node:${process.execPath}`,
      '-o', outputTemplate,
      '--newline' // Progress bar'ın anlık okunması için yeni satır çıkışı
    ];

    // Dil seçeneğine göre YouTube altyazı/başlık dil argümanını ekle
    if (settings.lang) {
      args.push('--extractor-args', `youtube:lang=${settings.lang}`);
    }

    // Türkçe Açıklama: Hız sınırı parametresi KB/s (K) olarak yt-dlp'ye iletiliyor.
    const effectiveSpeed = getEffectiveSpeedLimit(settings);
    if (effectiveSpeed && effectiveSpeed > 0) {
      args.push('--limit-rate', `${effectiveSpeed}K`);
    }

    // Premium Çerezlerini Ekleme
    if (settings.browser && settings.browser !== 'none') {
      const browserName = settings.browser === 'msedge' ? 'edge' : settings.browser;
      args.push('--cookies-from-browser', browserName);
    }

    // Kanala özel kaliteyi kontrol et, yoksa varsayılan ayarı kullan
    const channelConfig = db.channels.find(c => c.id === video.channelId);
    const videoQuality = (channelConfig && channelConfig.quality && channelConfig.quality !== 'default') 
      ? channelConfig.quality 
      : settings.quality;

    const hasWorkingFfmpeg = testFfmpegSync();
    let actualMergeType = settings.mergeType || 'single';

    if (actualMergeType === 'merge' && !hasWorkingFfmpeg) {
      actualMergeType = 'single';
      console.log(`[Warning] FFmpeg is not found or not working. Falling back to 'single' download mode.\n`);
      addTerminalLog(`[Warning] FFmpeg not found or not working. Falling back to single file download (best pre-merged quality).`, 'warning');
    }

    // Çözünürlük ve Birleştirme Ayarı
    if (actualMergeType === 'single') {
      // Tek dosya (ffmpeg gerekmez)
      if (videoQuality === '1080p') {
        args.push('-f', 'best[height<=1080]/best');
      } else if (videoQuality === '720p') {
        args.push('-f', 'best[height<=720]/best');
      } else {
        args.push('-f', 'best');
      }
    } else if (actualMergeType === 'separate') {
      // Ayrı ses ve video dosyası (ffmpeg gerekmez)
      if (videoQuality === '1080p') {
        args.push('-f', 'bestvideo[height<=1080],bestaudio');
      } else if (videoQuality === '720p') {
        args.push('-f', 'bestvideo[height<=720],bestaudio');
      } else {
        args.push('-f', 'bestvideo,bestaudio');
      }
    } else {
      // merge (Otomatik Birleştir - ffmpeg gerektirir)
      if (videoQuality === '1080p') {
        args.push('-f', 'bestvideo[height<=1080]+bestaudio/best[height<=1080]/best');
      } else if (videoQuality === '720p') {
        args.push('-f', 'bestvideo[height<=720]+bestaudio/best[height<=720]/best');
      } else {
        args.push('-f', 'bestvideo+bestaudio/best');
      }
      args.push('--merge-output-format', 'mp4');
    }

    // Kapak Resmi İndirme Ayarı
    if (settings.writeThumbnail) {
      args.push('--write-thumbnail');
      if (hasWorkingFfmpeg) {
        args.push('--convert-thumbnails', 'jpg');
      }
    }

    // Eğer yerel dizinde veya subfolder'da ffmpeg.exe varsa yt-dlp'ye bunun konumunu bildir
    if (hasWorkingFfmpeg) {
      args.push('--ffmpeg-location', path.dirname(getFfmpegPath()));
    }

    console.log(`İndirme başlatılıyor: ${video.title}`);
    console.log(`Komut: yt-dlp ${args.join(' ')}`);

    // Türkçe Açıklama: Windows'ta penceresiz, Unix'te süreç grubu halinde (detached) ve girdi (stdin) kilitlenmelerini önlemek için ignore stdio ile başlatırız.
    const spawnOptions = process.platform === 'win32' 
      ? { stdio: ['ignore', 'pipe', 'pipe'] } 
      : { stdio: ['ignore', 'pipe', 'pipe'], detached: true };
    const downloadProc = spawn(ytdlpPath, args, spawnOptions);
    this.activeProcess = downloadProc;
    this.activeVideoId = video.id;

    downloadProc.stdout.on('data', (data) => {
      const output = data.toString();
      
      // Her satırı terminal loguna aktar (Yüzde barı spami hariç)
      const lines = output.split(/\r?\n/);
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed) {
          const isProgressSpam = trimmed.includes('[download]') && trimmed.includes('%') && (trimmed.includes('at') || trimmed.includes('ETA'));
          if (!isProgressSpam) {
            let logType = 'info';
            if (trimmed.startsWith('[download]')) logType = 'success';
            else if (trimmed.startsWith('[ffmpeg]') || trimmed.startsWith('[Merger]')) logType = 'warning';
            addTerminalLog(`[yt-dlp] ${trimmed}`, logType);
          }
        }
      }
      
      // Örnek yt-dlp çıktısı: [download]  12.5% of  150.00MiB at  10.23MiB/s ETA 00:15
      const progressMatch = output.match(/\[download\]\s+(\d+\.\d+)%\s+of\s+([^\s]+)\s+at\s+([^\s]+)\s+ETA\s+([^\s]+)/);
      if (progressMatch) {
        const percent = parseFloat(progressMatch[1]);
        const size = progressMatch[2];
        const speed = progressMatch[3];
        const eta = progressMatch[4];

        updateHistoryItem(video.id, {
          progress: percent,
          fileSize: size,
          speed: speed,
          eta: eta
        });

        broadcast('progress', {
          id: video.id,
          progress: percent,
          speed: speed,
          eta: eta,
          fileSize: size
        });
      }
    });

    let errorOutput = '';
    let stderrBuffer = '';

    // Türkçe Açıklama: Gelen stderr satırını analiz edip hata, uyarı veya filtreleme kararı verir.
    /**
     * Stderr satırını ayrıştırır, filtreler ve terminal loguna ekler.
     * 
     * @param {string} line Çözümlenecek stderr satırı
     */
    function handleStderrLine(line) {
      const trimmed = line.trim();
      if (!trimmed) return;

      const lowerTrimmed = trimmed.toLowerCase();
      const isFfmpegProgress = lowerTrimmed.startsWith('frame=') || (lowerTrimmed.includes('fps=') && lowerTrimmed.includes('size=') && lowerTrimmed.includes('time='));
      const isFfmpegOpening = lowerTrimmed.includes('opening \'http') || /\[[a-z0-9]+ @ [0-9a-fx]+\] opening/i.test(trimmed);
      const isFfmpegInfo = lowerTrimmed.includes('last message repeated') ||
                           lowerTrimmed.startsWith('input #') ||
                           lowerTrimmed.startsWith('duration:') ||
                           lowerTrimmed.startsWith('program ') ||
                           lowerTrimmed.startsWith('metadata:') ||
                           lowerTrimmed.includes('variant_bitrate') ||
                           lowerTrimmed.includes('stream #') ||
                           lowerTrimmed.includes('stream mapping:') ||
                           lowerTrimmed.startsWith('output #') ||
                           lowerTrimmed.includes('encoder') ||
                           lowerTrimmed.includes('press [q] to stop');
      // Türkçe Açıklama: HLS/Premiere yayınlarında geçici ağ/bağlantı hatası/keep-alive ve tekrar deneme mesajlarını filtreleyip kırmızı hata olmalarını engelliyoruz.
      const isFfmpegConnection = /^\[[a-z0-9#_/.-]+ @ 0x?[0-9a-f]+\]/i.test(trimmed) && (
        lowerTrimmed.includes('cannot reuse') ||
        lowerTrimmed.includes('keepalive') ||
        lowerTrimmed.includes('retry') ||
        lowerTrimmed.includes('http connection')
      );

      // Türkçe Açıklama: Canlı yayın indirmelerinde ffmpeg'in bastığı zararsız skip (ad cuepoint atlama) uyarılarını log kirliliği yaratmaması için filtreliyoruz.
      const isFfmpegSkip = /^\[[a-z0-9#_/.-]+ @ 0x?[0-9a-f]+\]/i.test(trimmed) && (
        lowerTrimmed.includes('skip') ||
        lowerTrimmed.includes('daterange') ||
        lowerTrimmed.includes('#ext-x-')
      );

      if (isFfmpegProgress || isFfmpegOpening || isFfmpegInfo || isFfmpegConnection || isFfmpegSkip) {
        // Türkçe Açıklama: FFmpeg'in ilerleme, açılış, bağlantı durumu ve skip logları CMD konsolunda gürültü yapmaması için es geçiliyor.
        return;
      }

      const isWarning = trimmed.toLowerCase().includes('warning:') || trimmed.toLowerCase().includes('uyari:');
      if (isWarning) {
        console.log(`yt-dlp uyarı satırı: ${trimmed}`);
        addTerminalLog(`[yt-dlp Uyarı] ${trimmed}`, 'warning');
      } else {
        console.error(`yt-dlp error lineı: ${trimmed}`);
        addTerminalLog(`[yt-dlp Error] ${trimmed}`, 'error');
      }
    }

    downloadProc.stderr.on('data', (data) => {
      const output = data.toString();
      errorOutput += output;
      stderrBuffer += output;
      
      const lines = stderrBuffer.split(/\r?\n/);
      stderrBuffer = lines.pop(); // Türkçe Açıklama: Yarım kalmış satırı bir sonraki chunk için tamponda (buffer) tutuyoruz.
      
      for (const line of lines) {
        handleStderrLine(line);
      }
    });

    downloadProc.stderr.on('end', () => {
      if (stderrBuffer) {
        handleStderrLine(stderrBuffer);
      }
    });

    downloadProc.on('close', (code) => {
      // Eğer bu işlem kullanıcı tarafından iptal edilip zaten temizlendiyse es geç
      if (this.activeVideoId !== video.id) {
        return;
      }

      this.activeDownloads--;
      this.activeProcess = null;
      this.activeVideoId = null;

      const db = readDb();
      const currentItem = db.history.find(h => h.id === video.id);
      const isCancelled = currentItem && currentItem.error === 'Kullanıcı tarafından iptal edildi.';

      if (isCancelled) {
        broadcast('status_log', { message: `İndirme iptal edildi: ${video.title}`, type: 'info' });
        addTerminalLog(`[Kuyruk] İndirme kullanıcı tarafından cancelled: "${video.title}"`, 'warning');
        broadcast('db_update', readDb());
        this.process();
        return;
      }

      if (code === 0) {
        // İndirme başarılı
        let actualPath = '';
        let resolvedTitle = video.title;
        try {
          const channelFolder = path.join(settings.downloadPath, video.channelName);
          const files = fs.readdirSync(channelFolder);
          const match = files.find(f => {
            if (!f.includes(`[${video.id}]`)) return false;
            const ext = path.extname(f).toLowerCase();
            return !['.jpg', '.jpeg', '.webp', '.png', '.json', '.temp', '.part', '.ytdl'].includes(ext);
          });
          if (match) {
            actualPath = path.join(channelFolder, match);
            const baseName = path.basename(match, path.extname(match)); // e.g. "Channel - Title [ID]"
            const idPattern = ` [${video.id}]`;
            if (baseName.endsWith(idPattern)) {
              const withoutId = baseName.substring(0, baseName.length - idPattern.length); // "Channel - Title"
              const prefix = `${video.channelName} - `;
              if (withoutId.startsWith(prefix)) {
                resolvedTitle = withoutId.substring(prefix.length);
              } else {
                const dashIdx = withoutId.indexOf(' - ');
                if (dashIdx !== -1) {
                  resolvedTitle = withoutId.substring(dashIdx + 3);
                } else {
                  resolvedTitle = withoutId;
                }
              }
            }
          } else {
            actualPath = path.join(channelFolder, `${video.channelName} - ${video.title} [${video.id}].mp4`);
          }
        } catch (e) {
          actualPath = path.join(settings.downloadPath, video.channelName, `${video.channelName} - ${video.title} [${video.id}].mp4`);
        }

        // Türkçe Açıklama: Disk üzerindeki gerçek dosya boyutunu okur ve formatlar.
        let calculatedSize = '';
        try {
          if (fs.existsSync(actualPath)) {
            const stats = fs.statSync(actualPath);
            const sizeInBytes = stats.size;
            if (sizeInBytes >= 1024 * 1024 * 1024) {
              calculatedSize = Math.round(sizeInBytes / (1024 * 1024 * 1024)) + ' GB';
            } else {
              calculatedSize = Math.round(sizeInBytes / (1024 * 1024)) + ' MB';
            }
          }
        } catch (err) {
          console.error(`Size read errorı: ${resolvedTitle}`, err.message);
        }

        updateHistoryItem(video.id, {
          status: 'completed',
          progress: 100,
          filePath: actualPath,
          title: resolvedTitle,
          speed: '',
          eta: '',
          fileSize: calculatedSize
        });
        console.log(`İndirme completedı: ${resolvedTitle}`);
        broadcast('status_log', { message: `İndirme tamamlandı: ${resolvedTitle}`, type: 'success' });
        addTerminalLog(`[Kuyruk] İndirme SUCCESSFUL: "${resolvedTitle}" -> Dosya Yol: ${actualPath}`, 'success');
        playSystemSound('success');
        showWindowsNotification(
          settings.lang === 'en' ? 'Download Completed' : 'İndirme Tamamlandı',
          settings.lang === 'en' ? `"${resolvedTitle}" downloaded successfully.` : `"${resolvedTitle}" videosu başarıyla indirildi.`
        );
      } else {
        // İndirme başarısız
        // Eğer çerez erişim hatası varsa loga özel not ekle
        let userFriendlyError = errorOutput.trim();
        if (userFriendlyError.includes('Could not copy Chrome cookie database') || userFriendlyError.includes('Could not copy Edge cookie database')) {
          userFriendlyError = `Tarayıcı çerez dosyası kilitli! Edge tarayıcınız arka planda çalışmaya devam ediyor olabilir. Lütfen tarayıcınızı tamamen kapatıp (Görev Yöneticisi'nden kapatabilirsiniz) tekrar deneyin veya Ayarlar sekmesinden çerez seçeneğini 'Çerez Kullanma (Sadece Açık Videolar)' olarak ayarlayın.`;
        } else if (userFriendlyError.includes('Could not find browser') || userFriendlyError.includes('cookie')) {
          userFriendlyError = `Tarayıcı çerezleri okunamadı. Lütfen ayarlarınızdan çerez aldığınız tarayıcıyı (${settings.browser.toUpperCase()}) kapatıp tekrar deneyin veya tarayıcı profilinizin doğru olduğundan emin olun.`;
        }

        updateHistoryItem(video.id, {
          status: 'failed',
          progress: 0,
          speed: '',
          eta: '',
          error: userFriendlyError || `Hata Kodu: ${code}`
        });
        console.error(`İndirme Failed: ${video.title} - Kod: ${code}`);
        broadcast('status_log', { message: `İndirme başarısız: ${video.title}`, type: 'error' });
        addTerminalLog(`[Kuyruk] İndirme FAILED: "${video.title}" - Error: ${userFriendlyError || `Error Code: ${code}`}`, 'error');
        playSystemSound('error');
        showWindowsNotification(
          settings.lang === 'en' ? 'Download Failed' : 'İndirme Başarısız',
          settings.lang === 'en' ? `"${video.title}" download failed.` : `"${video.title}" videosunun indirilmesi başarısız oldu.`
        );
      }

      broadcast('db_update', readDb());
      resolveMissingDurations(); // Arka planda süreleri çözmeyi tetikle
      this.process(); // Sonraki videoya geç
    });
  }
}

const downloadQueue = new DownloadQueue();
try {
  const initDb = readDb();
  downloadQueue.isPaused = !!initDb.settings.isPaused;
} catch (e) {
  downloadQueue.isPaused = false;
}

// RSS kontrol döngüsünün aynı anda birden fazla kez çalışmasını engelleyen kilit değişkeni
let isRssChecking = false;

/**
 * YouTube kanalının en son videolarını flat-playlist modunda json olarak çeker.
 * 
 * @param {string} channelId YouTube kanal kimliği (ID)
 * @param {number} limit Alınacak maksimum video sayısı
 * @returns {Promise<object>} Video listesini içeren nesne
 */
function fetchChannelVideosYtdlp(channelId, limit) {
  return new Promise(async (resolve, reject) => {
    const db = readDb();
    const settings = db.settings || {};
    
    // Türkçe Açıklama: yt-dlp flat-playlist modunda video tarihlerini döndürmediği için öncelikle XML RSS akışından tarihleri alıyoruz.
    const dateMap = new Map();
    try {
      const feedUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;
      const xmlData = await fetchWithProxyWaterfall(feedUrl);
      const xmlFeed = await parser.parseString(xmlData);
      if (xmlFeed && xmlFeed.items) {
        for (const item of xmlFeed.items) {
          const videoId = item.link?.match(/v=([^&]+)/)?.[1] || item.id?.replace('yt:video:', '');
          const isoDate = item.isoDate || item.pubDate;
          if (videoId && isoDate) {
            dateMap.set(videoId, isoDate);
          }
        }
      }
    } catch (rssErr) {
      console.log(`[RSS] [XML Tarih Eşleme] ${channelId} için XML RSS tarihleri okunamadı:`, rssErr.message);
    }

    const args = [];
    
    args.push('--js-runtimes', `node:${process.execPath}`);
    
    if (settings.browser && settings.browser !== 'none') {
      const browserName = settings.browser === 'msedge' ? 'edge' : settings.browser;
      args.push('--cookies-from-browser', browserName);
    }
    
    args.push('--ignore-errors', '--flat-playlist', '--playlist-end', limit.toString(), '--dump-json');
    args.push(
      `https://www.youtube.com/channel/${channelId}/videos`,
      `https://www.youtube.com/channel/${channelId}/streams`
    );
    
    const spawnOptions = process.platform === 'win32' ? { windowsVerbatimArguments: false, windowsHide: true } : {};
    const proc = spawn(ytdlpPath, args, spawnOptions);
    
    let stdout = '';
    let stderr = '';
    
    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    
    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    proc.on('close', (code) => {
      const items = [];
      const lines = stdout.split('\n');
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const video = JSON.parse(line.trim());
          if (video && video.id) {
            let isoDate = '';
            
            // 1. XML RSS feed'den eşleşen tarihi bul
            if (dateMap.has(video.id)) {
              isoDate = dateMap.get(video.id);
            }
            // 2. Geçmiş veritabanından eşleşen tarihi bul
            if (!isoDate && db.history) {
              const histMatch = db.history.find(h => h.id === video.id);
              if (histMatch && histMatch.publishedAt) {
                isoDate = histMatch.publishedAt;
              }
            }
            // 3. Klasik yt-dlp alanlarından dene (boş olmaları muhtemel)
            if (!isoDate) {
              if (video.timestamp) {
                isoDate = new Date(video.timestamp * 1000).toISOString();
              } else if (video.upload_date) {
                const yr = video.upload_date.slice(0, 4);
                const mo = video.upload_date.slice(4, 6);
                const dy = video.upload_date.slice(6, 8);
                isoDate = new Date(`${yr}-${mo}-${dy}T00:00:00.000Z`).toISOString();
              }
            }
            
            items.push({
              title: video.title || 'Video',
              link: `https://www.youtube.com/watch?v=${video.id}`,
              id: `yt:video:${video.id}`,
              isoDate: isoDate
            });
          }
        } catch (e) {
          // Satır ayrıştırma hatası yoksayılabilir
        }
      }

      // Türkçe Açıklama: Hata kodu alınmış olsa bile eğer en az bir video başarıyla ayrıştırılabildiyse 
      // işlemi başarısız saymıyor, elde edilen videoları döndürüyoruz. Hiç video bulunamadıysa hata fırlatıyoruz.
      if (code !== 0 && items.length === 0) {
        return reject(new Error(`yt-dlp exited with code ${code}. Stderr: ${stderr}`));
      }
      
      // Tarihe göre yeniden eskiye sıralama (en yeni en üstte)
      items.sort((a, b) => new Date(b.isoDate || 0).getTime() - new Date(a.isoDate || 0).getTime());
      
      resolve({ items });
    });
  });
}

// Türkçe Açıklama: Yeni keşfedilen bir video için başlangıç geçmiş (history) kaydını oluşturur. 
// Eğer video dosyası diskte zaten varsa durumunu 'completed' yapar ve boyutunu/yolunu ekler.
/**
 * Yeni bir video kaydı için geçmiş nesnesi oluşturur. Diskte dosya varsa 'completed' olarak işaretler.
 * 
 * @param {string} videoId Video ID'si
 * @param {string} title Video başlığı
 * @param {string} channelId Kanal ID'si
 * @param {string} channelName Kanal adı
 * @param {string} publishedAt Yayınlanma tarihi
 * @param {string} duration Video süresi
 * @param {object} settings Sunucu ayarları nesnesi
 * @returns {object} Oluşturulan geçmiş kaydı nesnesi
 */
function createHistoryItem(videoId, title, channelId, channelName, publishedAt, duration, settings) {
  const downloadPath = settings.downloadPath || defaultDownloadDir;
  const foundPath = findVideoFileInDownloadDir(videoId, downloadPath);
  
  let status = 'ignored';
  let filePath = '';
  let fileSize = '';
  let progress = 0;
  
  if (foundPath) {
    status = 'completed';
    filePath = foundPath;
    progress = 100;
    try {
      const stats = fs.statSync(foundPath);
      const sizeInBytes = stats.size;
      if (sizeInBytes >= 1024 * 1024 * 1024) {
        fileSize = Math.round(sizeInBytes / (1024 * 1024 * 1024)) + ' GB';
      } else {
        fileSize = Math.round(sizeInBytes / (1024 * 1024)) + ' MB';
      }
    } catch (err) {}
  }
  
  return {
    id: videoId,
    title: title,
    channelId: channelId,
    channelName: channelName,
    downloadedAt: new Date().toISOString(),
    publishedAt: publishedAt || new Date().toISOString(),
    status: status,
    progress: progress,
    fileSize: fileSize,
    filePath: filePath,
    duration: duration || ''
  };
}

/**
 * Belirtilen kanalın RSS akışını kontrol eder ve yeni videolar varsa kuyruğa ekler.
 * 
 * @param {object} channel RSS akışı denetlenecek kanal nesnesi
 * @param {boolean} isFirstStart Kanalın ilk kez eklenip eklenmediği bilgisi (İlk eklemede eski videolar indirilmez)
 * @returns {Promise<void>}
 */
async function checkSingleChannelRss(channel, isFirstStart = false) {
  try {
    const db = readDb();
    const rssLimit = db.settings.rssLimit || 5;
    let feed = null;

    console.log(`[RSS] ${channel.name} denetleniyor (yt-dlp)...`);
    addTerminalLog(`[RSS] ${channel.name} yt-dlp ile denetleniyor...`, 'info');
    try {
      feed = await fetchChannelVideosYtdlp(channel.id, rssLimit);
    } catch (ytdlpErr) {
      console.log(`[RSS] ${channel.name} için yt-dlp taraması başarısız oldu (${ytdlpErr.message}). Standart RSS XML yedek mekanizması başlatılıyor...`);
      addTerminalLog(`[RSS] ${channel.name} yt-dlp hatası aldı (${ytdlpErr.message}). Standart RSS XML ile denetleniyor...`, 'info');
      try {
        const feedUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${channel.id}`;
        const xmlData = await fetchWithProxyWaterfall(feedUrl);
        feed = await parser.parseString(xmlData);
      } catch (rssErr) {
        console.error(`[RSS] [HATA] ${channel.name} RSS XML ile de denetlenemedi:`, rssErr.message);
      }
    }

    if (feed && feed.items) {
      // Tarihlerine göre yeniden eskiye sıralama (en yeni en üstte)
      feed.items.sort((a, b) => {
        const dateA = new Date(a.isoDate || a.pubDate || 0).getTime();
        const dateB = new Date(b.isoDate || b.pubDate || 0).getTime();
        return dateB - dateA;
      });
      
      const itemsToCheck = feed.items.slice(0, rssLimit);
      const reversedItems = [...itemsToCheck].reverse();

      for (const item of reversedItems) {
        // Video ID'sini linkten çıkar
        const videoId = item.link.match(/v=([^&]+)/)?.[1] || item.id.replace('yt:video:', '');
        
        // Geçmişte bu video kayıtlı mı kontrol et
        const existingHistory = db.history.find(h => h.id === videoId);
        const isAlreadyProcessed = !!existingHistory;

        if (isAlreadyProcessed) {
          // Video zaten kayıtlı, ama durumu 'upcoming' veya 'live' ise kontrol et
          if (existingHistory.status === 'upcoming' || existingHistory.duration === 'upcoming' || existingHistory.status === 'live' || existingHistory.duration === 'live') {
            try {
              const result = await fetchVideoDuration(videoId);
              if (result && result.duration && result.duration !== 'upcoming' && result.duration !== 'live') {
                console.log(`[RSS] Upcoming/live video is now published/completed: ${item.title}`);
                addTerminalLog(`[RSS] Yaklaşan/Canlı yayın artık normal video halinde yayında: "${item.title}" (${channel.name})`, 'info');
                
                existingHistory.duration = result.duration;
                if (result.publishedAt) {
                  existingHistory.publishedAt = result.publishedAt;
                }
                
                if (db.settings.autoDownload) {
                  const channelConfig = db.channels.find(c => c.id === channel.id);
                  const downloadShorts = channelConfig ? channelConfig.downloadShorts !== false : true;
                  const shortsLimit = (channelConfig && channelConfig.shortsDurationLimit !== undefined) ? channelConfig.shortsDurationLimit : 180;
                  
                  let shouldDownload = true;
                  if (!downloadShorts && isShortDuration(result.duration, shortsLimit)) {
                    shouldDownload = false;
                    existingHistory.status = 'ignored';
                    console.log(`Short video detected and channel doesn't allow shorts. Ignoring: ${item.title}`);
                  }
                  
                  if (shouldDownload) {
                    existingHistory.status = 'waiting';
                    writeDb(db);
                    downloadQueue.add({
                      id: videoId,
                      title: item.title,
                      channelId: channel.id,
                      channelName: channel.name,
                      url: item.link,
                      publishedAt: existingHistory.publishedAt
                    });
                  } else {
                    writeDb(db);
                  }
                } else {
                  existingHistory.status = 'ignored';
                  writeDb(db);
                }
              }
            } catch (e) {
              console.error(`Error checking upcoming/live video status for ${videoId}:`, e.message);
            }
          }
        } else {
          // Yayınlanma tarihi kontrolü - Kanal eklenme tarihinden eski ise tarihi geçmiş videodur
          const publishDateStr = item.isoDate || item.pubDate;
          let isHistoricalVideo = false;
          if (publishDateStr && channel.addedAt) {
            const pubTime = new Date(publishDateStr).getTime();
            const addedTime = new Date(channel.addedAt).getTime();
            if (pubTime < addedTime - 60000) { // 1 dakika tolerans
              isHistoricalVideo = true;
            }
          }

          if (isFirstStart || isHistoricalVideo) {
            // Sunucu ilk başladığında, kanal yeni eklendiğinde veya eski videolarda (feed'de doğrudan eski gözükenler)
            // otomatik indirme yapmayıp geçmişe 'ignored' (veya diskte varsa 'completed') olarak kaydediyoruz.
            db.history.push(createHistoryItem(
              videoId,
              item.title,
              channel.id,
              channel.name,
              publishDateStr,
              '',
              db.settings
            ));
            writeDb(db);
          } else {
            // Detayları çözerek hem süre hem de gerçek yüklenme tarihini netleştirelim
            let duration = '';
            let actualPublishDate = publishDateStr || '';
            let resolvedTitle = item.title;
            let resolvedChannelName = channel.name;
            
            try {
              const result = await fetchVideoDuration(videoId);
              if (result) {
                duration = result.duration || '';
                if (result.publishedAt) {
                  actualPublishDate = result.publishedAt;
                }
                if (result.title) {
                  resolvedTitle = result.title;
                }
                if (result.channelName) {
                  resolvedChannelName = result.channelName;
                }
              }
            } catch (e) {
              console.error(`Error checking duration for new video:`, e.message);
            }

            // Gerçek yayınlanma tarihine göre tarihi geçmiş video (historical) kontrolünü tekrar yap
            let isHistoricalVideoReal = false;
            if (actualPublishDate && channel.addedAt) {
              const pubTime = new Date(actualPublishDate).getTime();
              const addedTime = new Date(channel.addedAt).getTime();
              if (pubTime < addedTime - 60000) {
                isHistoricalVideoReal = true;
              }
            } else {
              // Eğer gerçek yayınlanma tarihi çözülemediyse, eski/belirsiz kabul edip indirme
              isHistoricalVideoReal = true;
            }

            if (isHistoricalVideoReal) {
              // Gerçek tarihi kanal eklenme tarihinden eski, indirmeyip geçmişe 'ignored' (veya diskte varsa 'completed') olarak kaydediyoruz.
              db.history.push(createHistoryItem(
                videoId,
                resolvedTitle,
                channel.id,
                channel.name,
                actualPublishDate,
                duration,
                db.settings
              ));
              writeDb(db);
            } else if (duration === 'upcoming') {
              console.log(`[RSS] Upcoming/premiere video detected: ${resolvedTitle}`);
              addTerminalLog(`[RSS] Yaklaşan/Prömiyer video tespit edildi (İndirme ertelendi): "${resolvedTitle}" (${resolvedChannelName})`, 'info');
              
              db.history.push({
                id: videoId,
                title: resolvedTitle,
                channelId: channel.id,
                channelName: resolvedChannelName,
                downloadedAt: new Date().toISOString(),
                publishedAt: actualPublishDate,
                status: 'upcoming',
                progress: 0,
                fileSize: '',
                filePath: '',
                duration: 'upcoming'
              });
              writeDb(db);
            } else if (duration === 'live') {
              console.log(`[RSS] Active live stream detected (download postponed): ${resolvedTitle}`);
              addTerminalLog(`[RSS] Aktif canlı yayın algılandı (yayın bitene kadar indirme ertelendi): "${resolvedTitle}" (${resolvedChannelName})`, 'info');
              
              db.history.push({
                id: videoId,
                title: resolvedTitle,
                channelId: channel.id,
                channelName: resolvedChannelName,
                downloadedAt: new Date().toISOString(),
                publishedAt: actualPublishDate,
                status: 'live',
                progress: 0,
                fileSize: '',
                filePath: '',
                duration: 'live'
              });
              writeDb(db);
            } else if (db.settings.autoDownload) {
              const channelConfig = db.channels.find(c => c.id === channel.id);
              const downloadShorts = channelConfig ? channelConfig.downloadShorts !== false : true;
              const shortsLimit = (channelConfig && channelConfig.shortsDurationLimit !== undefined) ? channelConfig.shortsDurationLimit : 180;

              let shouldDownload = true;
              if (!downloadShorts && isShortDuration(duration, shortsLimit)) {
                shouldDownload = false;
                console.log(`Short video detected and channel doesn't allow shorts. Ignoring: ${resolvedTitle}`);
                addTerminalLog(`[RSS] Shorts videosu algılandı ve kanal ayarı gereği indirilmeyip göz ardı edildi: "${resolvedTitle}" (${resolvedChannelName})`, 'info');
              }

              if (shouldDownload) {
                // Türkçe Açıklama: Yeni video algılandı ama diskte zaten mevcutsa indirmeyip durumu 'completed' yapıyoruz.
                const foundPath = findVideoFileInDownloadDir(videoId, db.settings.downloadPath || defaultDownloadDir);
                if (foundPath) {
                  console.log(`Yeni video algılandı ama diskte zaten mevcut. Kuyruğa eklenmiyor: ${resolvedTitle}`);
                  db.history.push(createHistoryItem(
                    videoId,
                    resolvedTitle,
                    channel.id,
                    channel.name,
                    actualPublishDate,
                    duration,
                    db.settings
                  ));
                  writeDb(db);
                } else {
                  console.log(`Yeni video algılandı! queue ekleniyor: ${resolvedTitle}`);
                  broadcast('status_log', { message: `Yeni video yüklendi: ${resolvedChannelName} - ${resolvedTitle}`, type: 'info' });
                  addTerminalLog(`[RSS] Yeni video tespit edildi: "${resolvedTitle}" (${resolvedChannelName}) -> queue ekleniyor.`, 'info');
                  
                  downloadQueue.add({
                    id: videoId,
                    title: resolvedTitle,
                    channelId: channel.id,
                    channelName: resolvedChannelName,
                    url: item.link,
                    publishedAt: actualPublishDate
                  });

                  if (duration) {
                    updateHistoryItem(videoId, { duration });
                  }
                }
              } else {
                db.history.push(createHistoryItem(
                  videoId,
                  resolvedTitle,
                  channel.id,
                  channel.name,
                  actualPublishDate,
                  duration,
                  db.settings
                ));
                writeDb(db);
              }
            } else {
              db.history.push(createHistoryItem(
                videoId,
                resolvedTitle,
                channel.id,
                channel.name,
                actualPublishDate,
                duration,
                db.settings
              ));
              writeDb(db);
            }
          }
        }
      }
    }
  } catch (err) {
    console.error(`${channel.name} error occurred while checkingştu:`, err);
  }
}

let currentChannelIndex = 0;

// Türkçe Açıklama: İzlenen kanallar listesindeki kanalları sırayla (alfabetik olarak) gezer ve RSS kontrol döngüsünü yürütür.
/**
 * Sıradaki kanalı alfabetik olarak bulup RSS kontrolünü gerçekleştirir.
 */
async function checkNextChannelRss() {
  if (isRssChecking) {
    console.log('[RSS] Bir önceki kanal RSS kontrolü henüz tamamlanmadı, yeni tarama atlandı.');
    return;
  }
  isRssChecking = true;
  try {
    const db = readDb();
    if (db.channels.length === 0) {
      console.log('İzlenen kanal bulunmuyor.');
      return;
    }

    // Kanalları alfabetik sırala
    const sortedChannels = [...db.channels].sort((a, b) => 
      (a.name || '').localeCompare(b.name || '', 'tr', { sensitivity: 'base' })
    );

    // Endeks sınır dışı kalmışsa sıfırla
    if (currentChannelIndex >= sortedChannels.length) {
      currentChannelIndex = 0;
    }

    const channel = sortedChannels[currentChannelIndex];
    const checkMsg = `[RSS] Checking channel ${currentChannelIndex + 1} out of ${sortedChannels.length}: "${channel.name}"`;
    console.log(checkMsg);
    addTerminalLog(checkMsg, 'info');

    await checkSingleChannelRss(channel, false);

    // Bir sonraki kanala geç
    currentChannelIndex = (currentChannelIndex + 1) % sortedChannels.length;



    // Süreleri arka planda çözmeye başla
    resolveMissingDurations();
  } finally {
    isRssChecking = false;
  }
}

let checkIntervalTimer = null;
/**
 * RSS video kontrol döngüsünü yapılandırmadaki saniye sıklığına göre zamanlayıcı olarak başlatır.
 */
function startIntervalTimer() {
  if (checkIntervalTimer) clearInterval(checkIntervalTimer);
  const db = readDb();
  const seconds = db.settings.channelCheckInterval || 60;
  const ms = seconds * 1000;
  console.log(`RSS kanal kontrol döngüsü startedı. Sıklık: 1 kanal / ${seconds} saniye.`);
  
  checkIntervalTimer = setInterval(() => {
    checkNextChannelRss();
  }, ms);
}

// Türkçe Açıklama: API rotalarını dış ağlardan gelen isteklere karşı koruyan, yalnızca localhost üzerindeki talepleri kabul eden güvenlik middleware'i.
/**
 * Sadece localhost (127.0.0.1, ::1) üzerinden gelen isteklere izin veren güvenlik ara yazılımı.
 */
function localhostOnly(req, res, next) {
  const ip = req.ip || req.connection.remoteAddress;
  const isLocal = ip === '127.0.0.1' || 
                  ip === '::1' || 
                  ip === '::ffff:127.0.0.1' || 
                  req.hostname === 'localhost' || 
                  req.hostname === '127.0.0.1';
                  
  if (!isLocal) {
    console.warn(`[Güvenlik] Yetkisiz harici istek engellendi! IP: ${ip}, Yol: ${req.originalUrl}`);
    return res.status(403).json({ error: 'Güvenlik Nedeniyle Erişim Engellendi. Sadece localhost üzerinden erişim sağlanabilir.' });
  }
  next();
}

// Türkçe Açıklama: yt-dlp.exe yardımıyla belirtilen tarayıcının çerez veritabanına erişimi test ederek çerezlerin aktif ve kilitlenmemiş olup olmadığını doğrular.
/**
 * Seçilen tarayıcı çerezlerinin okunabilirliğini ve geçerliliğini test eder.
 */
function testCookiesValidity(browser) {
  return new Promise((resolve) => {
    if (!browser || browser === 'none') {
      return resolve({ success: true, message: 'Tarayıcı çerezleri kullanılmıyor.' });
    }
    
    // Basit bir arama simülasyonu kullanarak çerez okumayı dener
    const browserName = browser === 'msedge' ? 'edge' : browser;
    const args = [
      '--cookies-from-browser', browserName,
      '--simulate',
      '--js-runtimes', `node:${process.execPath}`,
      'ytsearch1:test cookie liveness'
    ];
    
    console.log(`[Çerez Testi] yt-dlp çerez testi başlatılıyor: ${browserName}`);
    const proc = spawn(ytdlpPath, args);
    let errorOutput = '';
    
    proc.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });
    
    // 8 saniye sonra zaman aşımı koruması
    const timer = setTimeout(() => {
      proc.kill();
      resolve({ success: false, error: 'Zaman aşımı: Tarayıcı çerez veritabanı kilitli veya yanıt vermiyor. Lütfen tarayıcınızı tamamen kapatıp tekrar deneyin.' });
    }, 8000);
    
    proc.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0) {
        resolve({ success: true, message: 'Çerezler başarıyla okundu ve doğrulandı.' });
      } else {
        let userFriendlyError = errorOutput.trim();
        if (userFriendlyError.includes('Could not copy Chrome cookie database') || userFriendlyError.includes('Could not copy Edge cookie database')) {
          userFriendlyError = 'Tarayıcı çerez veritabanı kilitli! Tarayıcınız açık olabilir, lütfen kapatıp tekrar deneyin.';
        } else if (userFriendlyError.includes('Could not find browser')) {
          userFriendlyError = `Belirtilen tarayıcı bulunamadı veya profil dizini eksik: ${browser.toUpperCase()}`;
        } else {
          userFriendlyError = `Çerez doğrulama hatası (Kod: ${code}): ${userFriendlyError.slice(0, 150)}`;
        }
        resolve({ success: false, error: userFriendlyError });
      }
    });
  });
}

// --- API UÇ NOKTALARI (ENDPOINTS) ---

/**
 * İndirme kuyruğunu duraklatır.
 * Aktif indirmeyi iptal edip kuyruğun en başına (waiting olarak) ekler.
 * 
 * @param {object} req Express istek nesnesi
 * @param {object} res Express yanıt nesnesi
 */
app.post('/api/queue/pause', localhostOnly, (req, res) => {
  downloadQueue.isPaused = true;
  
  const db = readDb();
  db.settings.isPaused = true;
  writeDb(db);
  
  console.log('[Kuyruk] by user request Queue pausedı.');
  addTerminalLog('[Kuyruk] İndirme sırası pausedı.', 'warning');
  
  // Aktif indirme varsa, durdurup kuyruğun başına ekleyelim
  if (downloadQueue.activeProcess && downloadQueue.activeVideoId) {
    const videoId = downloadQueue.activeVideoId;
    const historyItem = db.history.find(h => h.id === videoId);
    
    if (historyItem) {
      console.log(`[Kuyruk] Aktif indirme stopped and returned to queue: ${historyItem.title}`);
      addTerminalLog(`[Kuyruk] Aktif indirme stopped and returned to queue: "${historyItem.title}"`, 'info');
      
      // Video bilgilerini kuyruğun en başına ekle (unshift)
      downloadQueue.queue.unshift({
        id: videoId,
        title: historyItem.title,
        channelId: historyItem.channelId,
        channelName: historyItem.channelName,
        url: `https://www.youtube.com/watch?v=${videoId}`,
        publishedAt: historyItem.publishedAt || ''
      });
      
      // Veritabanında durumunu 'waiting' yap (kalan süre ve hızları sıfırla)
      updateHistoryItem(videoId, {
        status: 'waiting',
        progress: historyItem.progress || 0, // Kaldığı yüzdeyi koru
        speed: '',
        eta: ''
      });
      
      // Süreci taskkill ile öldür
      const proc = downloadQueue.activeProcess;
      const pid = proc.pid;
      
      downloadQueue.activeProcess = null;
      downloadQueue.activeVideoId = null;
      if (downloadQueue.activeDownloads > 0) {
        downloadQueue.activeDownloads--;
      }
      
      exec(`taskkill /F /T /PID ${pid}`, (err) => {
        try {
          proc.kill('SIGKILL');
        } catch (e) {}
      });
    }
  }
  
  broadcast('db_update', readDb());
  res.json({ success: true, isPaused: true });
});

/**
 * Duraklatılmış indirme kuyruğunu devam ettirir.
 * 
 * @param {object} req Express istek nesnesi
 * @param {object} res Express yanıt nesnesi
 */
app.post('/api/queue/resume', localhostOnly, (req, res) => {
  downloadQueue.isPaused = false;
  
  const db = readDb();
  db.settings.isPaused = false;
  writeDb(db);
  
  console.log('[Kuyruk] by user request kuyruk resumed.');
  addTerminalLog('[Kuyruk] İndirme sırası resumed.', 'success');
  
  broadcast('db_update', readDb());
  downloadQueue.process(); // Sıradaki indirmeyi tetikle
  res.json({ success: true, isPaused: false });
});

/**
 * İndirme kuyruğunu sürükle-bırak sıralamasına göre yeniden sıralar.
 * 
 * @param {object} req Express istek nesnesi
 * @param {object} res Express yanıt nesnesi
 */
app.post('/api/queue/reorder', localhostOnly, (req, res) => {
  const { ids } = req.body;
  if (!ids || !Array.isArray(ids)) {
    return res.status(400).json({ error: 'Geçersiz veri formatı. ID listesi gereklidir.' });
  }
  
  console.log('[Kuyruk] Drag-and-drop kuyruk reorder request receivedği alındı.');
  
  // 1. downloadQueue.queue dizisini yeni ID sıralamasına göre yeniden düzenle
  const reorderedQueue = [];
  for (const id of ids) {
    const item = downloadQueue.queue.find(x => x.id === id);
    if (item) {
      reorderedQueue.push(item);
    }
  }
  // Eksik kalan veya kuyrukta olan diğer öğeleri listenin sonuna ekle (güvenlik önlemi)
  for (const item of downloadQueue.queue) {
    if (!reorderedQueue.some(x => x.id === item.id)) {
      reorderedQueue.push(item);
    }
  }
  downloadQueue.queue = reorderedQueue;
  
  // 2. db.history veritabanında 'waiting' olan videoları yeni sıraya göre kaydet (Persist)
  const db = readDb();
  const waitingItems = db.history.filter(h => h.status === 'waiting');
  const otherItems = db.history.filter(h => h.status !== 'waiting');
  
  // Bekleyen videoları downloadQueue.queue içindeki sırasına göre sırala
  waitingItems.sort((a, b) => {
    const indexA = downloadQueue.queue.findIndex(x => x.id === a.id);
    const indexB = downloadQueue.queue.findIndex(x => x.id === b.id);
    // Eğer listede yoksa sonlara at
    const valA = indexA === -1 ? 999999 : indexA;
    const valB = indexB === -1 ? 999999 : indexB;
    return valA - valB;
  });
  
  db.history = [...otherItems, ...waitingItems];
  writeDb(db);
  
  addTerminalLog('[Kuyruk] İndirme sırası reordered.', 'info');
  broadcast('db_update', db);
  res.json({ success: true });
});

// Real-time Event Stream
app.get('/api/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  clients.push(res);
  
  // Bağlantı sağlandığında güncel veritabanını gönder
  res.write(`event: db_update\ndata: ${JSON.stringify(readDb())}\n\n`);

  req.on('close', () => {
    clients = clients.filter(c => c !== res);
  });
});

// Veritabanını getir
app.get('/api/db', (req, res) => {
  res.json(readDb());
});

// Çerez Test Etme Rotası
app.get('/api/test-cookies', localhostOnly, async (req, res) => {
  const db = readDb();
  const result = await testCookiesValidity(db.settings.browser);
  res.json(result);
});

// Terminal log geçmişini getir
app.get('/api/logs', (req, res) => {
  res.json(terminalLogs);
});

// Ayarları kaydet
app.post('/api/settings', (req, res) => {
  const db = readDb();
  const oldSpeedLimit = getEffectiveSpeedLimit(db.settings);

  if (req.body.downloadSpeedLimit !== undefined) {
    req.body.downloadSpeedLimit = parseInt(req.body.downloadSpeedLimit, 10) || 0;
  }
  if (req.body.alternativeSpeedLimit !== undefined) {
    req.body.alternativeSpeedLimit = parseInt(req.body.alternativeSpeedLimit, 10) || 500;
  }
  if (req.body.useAlternativeSpeed !== undefined) {
    req.body.useAlternativeSpeed = req.body.useAlternativeSpeed === true || req.body.useAlternativeSpeed === 'true';
  }

  db.settings = { ...db.settings, ...req.body };
  const newSpeedLimit = getEffectiveSpeedLimit(db.settings);
  const speedLimitChanged = newSpeedLimit !== oldSpeedLimit;

  if (req.body.lang) {
    console.log(`[TRAY_CMD] lang=${req.body.lang}`);
  }

  writeDb(db);
  startIntervalTimer(); // Süre değiştiyse zamanlayıcıyı güncelle
  broadcast('db_update', db);

  // Arka planda veritabanı ile disk senkronizasyonunu tetikle (örn. indirme klasörü değiştiyse)
  setTimeout(() => {
    syncDbWithDisk();
  }, 100);

  // Türkçe Açıklama: Aktif indirme varken hız sınırı değiştirilirse, indirme sürecini sonlandırıp yeni sınırla sıranın başına ekleyerek yeniden başlatıyoruz.
  if (speedLimitChanged && downloadQueue.activeProcess && downloadQueue.activeVideoId) {
    const videoId = downloadQueue.activeVideoId;
    const historyItem = db.history.find(h => h.id === videoId);
    if (historyItem) {
      console.log(`[Ayarlar] Hız sınırı changed (${oldSpeedLimit} -> ${newSpeedLimit}). Aktif indirme with the new speed limitı ile is restartingılıyor: ${historyItem.title}`);
      addTerminalLog(`[Ayarlar] Hız sınırı changed. Aktif indirme with the new speed limitı ile is restartingılıyor: "${historyItem.title}"`, 'info');
      
      // Sıranın en başına ekle (unshift)
      downloadQueue.queue.unshift({
        id: videoId,
        title: historyItem.title,
        channelId: historyItem.channelId,
        channelName: historyItem.channelName,
        url: `https://www.youtube.com/watch?v=${videoId}`,
        publishedAt: historyItem.publishedAt || ''
      });
      
      // Durumunu bekleme olarak güncelle (kalan hız ve süreleri sıfırla, kaldığı yüzdeyi koru)
      updateHistoryItem(videoId, {
        status: 'waiting',
        progress: historyItem.progress || 0,
        speed: '',
        eta: ''
      });
      
      const proc = downloadQueue.activeProcess;
      const pid = proc.pid;
      
      // close handler'ının tetiklenmesini önlemek için aktif süreç referanslarını öncesinde temizle
      downloadQueue.activeProcess = null;
      downloadQueue.activeVideoId = null;
      if (downloadQueue.activeDownloads > 0) {
        downloadQueue.activeDownloads--;
      }
      
      // Süreci taskkill ile kapat
      exec(`taskkill /F /T /PID ${pid}`, (err) => {
        try {
          proc.kill('SIGKILL');
        } catch (e) {}
        
        // Süreç tamamen kapandıktan 1 saniye sonra kuyruğu tekrar tetikle
        setTimeout(() => {
          downloadQueue.process();
        }, 1000);
      });
    }
  }

  // Eğer indirme yöntemi "merge" (Birleştir) seçildiyse ve ffmpeg yoksa arka planda indir
  if (db.settings.mergeType === 'merge' && !fs.existsSync(getFfmpegPath())) {
    ensureFfmpeg().catch(e => console.error('FFmpeg auto download errorı:', e.message));
  }

  res.json({ success: true, settings: db.settings });
});

// FFmpeg İndirme Durumu ve API Rotaları
let ffmpegDownloadState = { status: 'idle', progress: 0, error: null };

async function downloadFfmpegAsync() {
  if (ffmpegDownloadState.status === 'downloading' || ffmpegDownloadState.status === 'extracting') {
    return;
  }
  
  ffmpegDownloadState = { status: 'downloading', progress: 0, error: null };
  broadcast('ffmpeg_download', ffmpegDownloadState);
  
  const ffmpegDir = path.resolve('./ffmpeg');
  if (!fs.existsSync(ffmpegDir)) {
    fs.mkdirSync(ffmpegDir, { recursive: true });
  }
  
  const platform = os.platform();
  let platformKey = '';
  if (platform === 'win32') platformKey = 'windows-64';
  else if (platform === 'linux') platformKey = 'linux-64';
  else if (platform === 'darwin') platformKey = 'osx-64';
  else {
    ffmpegDownloadState = { status: 'failed', progress: 0, error: 'Unsupported operating system: ' + platform };
    broadcast('ffmpeg_download', ffmpegDownloadState);
    return;
  }
  
  // Varsayılan FFmpeg indirme bağlantıları (ffbinaries v6.1)
  let urls = {
    'windows-64': {
      ffmpeg: 'https://github.com/ffbinaries/ffbinaries-prebuilt/releases/download/v6.1/ffmpeg-6.1-win-64.zip',
      ffprobe: 'https://github.com/ffbinaries/ffbinaries-prebuilt/releases/download/v6.1/ffprobe-6.1-win-64.zip'
    },
    'linux-64': {
      ffmpeg: 'https://github.com/ffbinaries/ffbinaries-prebuilt/releases/download/v6.1/ffmpeg-6.1-linux-64.zip',
      ffprobe: 'https://github.com/ffbinaries/ffbinaries-prebuilt/releases/download/v6.1/ffprobe-6.1-linux-64.zip'
    },
    'osx-64': {
      ffmpeg: 'https://github.com/ffbinaries/ffbinaries-prebuilt/releases/download/v6.1/ffmpeg-6.1-macos-64.zip',
      ffprobe: 'https://github.com/ffbinaries/ffbinaries-prebuilt/releases/download/v6.1/ffprobe-6.1-macos-64.zip'
    }
  }[platformKey];
  
  try {
    // API üzerinden dinamik en son sürümü çekmeyi dene (5 sn zaman aşımı)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    const apiRes = await fetch('https://ffbinaries.com/api/v1/version/latest', { signal: controller.signal });
    clearTimeout(timeoutId);
    if (apiRes.ok) {
      const apiData = await apiRes.json();
      if (apiData && apiData.bin && apiData.bin[platformKey]) {
        urls = apiData.bin[platformKey];
      }
    }
  } catch (apiErr) {
    console.warn('[FFmpeg] ffbinaries API dynamic URLs could not be fetched, using fallbacks:', apiErr.message);
  }
  
  const ffmpegZip = path.join(ffmpegDir, 'ffmpeg_temp.zip');
  const ffprobeZip = path.join(ffmpegDir, 'ffprobe_temp.zip');
  
  const downloadHelper = async (url, dest, startPercent, endPercent) => {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
    const totalBytes = parseInt(res.headers.get('content-length'), 10) || 0;
    
    const fileStream = fs.createWriteStream(dest);
    const nodeStream = Readable.fromWeb(res.body);
    let downloadedBytes = 0;
    
    nodeStream.on('data', (chunk) => {
      downloadedBytes += chunk.length;
      if (totalBytes > 0) {
        const fileProgress = downloadedBytes / totalBytes;
        const totalProgress = startPercent + fileProgress * (endPercent - startPercent);
        ffmpegDownloadState.progress = Math.round(totalProgress);
        broadcast('ffmpeg_download', ffmpegDownloadState);
      }
    });
    
    nodeStream.pipe(fileStream);
    
    await new Promise((resolve, reject) => {
      fileStream.on('finish', resolve);
      fileStream.on('error', reject);
      nodeStream.on('error', reject);
    });
  };
  
  try {
    // 1. FFmpeg İndiriliyor
    console.log(`[FFmpeg] Downloading FFmpeg from ${urls.ffmpeg}...`);
    await downloadHelper(urls.ffmpeg, ffmpegZip, 0, 45);
    
    // 2. FFprobe İndiriliyor
    console.log(`[FFmpeg] Downloading FFprobe from ${urls.ffprobe}...`);
    await downloadHelper(urls.ffprobe, ffprobeZip, 45, 90);
    
    // 3. Arşivden Çıkarma İşlemi
    ffmpegDownloadState.status = 'extracting';
    ffmpegDownloadState.progress = 90;
    broadcast('ffmpeg_download', ffmpegDownloadState);
    
    // ZIP Dosya boyutlarını kontrol et (Bozuk indirmeleri yakala)
    const checkZipSize = (filePath) => {
      if (!fs.existsSync(filePath)) {
        throw new Error(`Downloaded file not found: ${filePath}`);
      }
      const stats = fs.statSync(filePath);
      if (stats.size < 1024 * 1024) {
        throw new Error(`Downloaded file is corrupt or too small (${stats.size} bytes): ${filePath}`);
      }
    };
    checkZipSize(ffmpegZip);
    checkZipSize(ffprobeZip);
    
    console.log('[FFmpeg] Extracting zip files...');
    
    const extractHelper = (zipPath, destDir) => {
      return new Promise((resolve, reject) => {
        let completed = false;
        let fallbackTriggered = false;
        
        const triggerFallback = (reasonErr) => {
          if (fallbackTriggered || completed) return;
          fallbackTriggered = true;
          console.log(`[FFmpeg] Tar extraction not available or failed for ${path.basename(zipPath)}. Running fallback. Reason: ${reasonErr.message}`);
          
          if (platform === 'win32') {
            const ps = spawn('powershell', [
              '-NoProfile',
              '-NonInteractive',
              '-Command',
              `$ErrorActionPreference = 'Stop'; Expand-Archive -LiteralPath "${zipPath}" -DestinationPath "${destDir}" -Force`
            ]);
            ps.on('close', (psCode) => {
              if (completed) return;
              completed = true;
              if (psCode === 0) resolve();
              else reject(new Error(`Powershell fallback extraction failed with code ${psCode}`));
            });
            ps.on('error', (psErr) => {
              if (completed) return;
              completed = true;
              reject(new Error(`Powershell execution failed: ${psErr.message}`));
            });
          } else {
            const uz = spawn('unzip', ['-o', zipPath, '-d', destDir]);
            uz.on('close', (uzCode) => {
              if (completed) return;
              completed = true;
              if (uzCode === 0) resolve();
              else reject(new Error(`Unzip fallback failed with code ${uzCode}`));
            });
            uz.on('error', (uzErr) => {
              if (completed) return;
              completed = true;
              reject(new Error(`Unzip execution failed: ${uzErr.message}`));
            });
          }
        };
        
        // Tar ile çıkartmayı dene
        const tar = spawn('tar', ['-xf', zipPath, '-C', destDir]);
        
        tar.on('close', (code) => {
          if (completed || fallbackTriggered) return;
          if (code === 0) {
            completed = true;
            resolve();
          } else {
            triggerFallback(new Error(`tar exited with code ${code}`));
          }
        });
        
        tar.on('error', (err) => {
          if (completed || fallbackTriggered) return;
          triggerFallback(err);
        });
      });
    };
    
    await extractHelper(ffmpegZip, ffmpegDir);
    await extractHelper(ffprobeZip, ffmpegDir);
    
    if (platform !== 'win32') {
      // Unix çalıştırma izinleri
      try {
        fs.chmodSync(path.join(ffmpegDir, 'ffmpeg'), 0o755);
        fs.chmodSync(path.join(ffmpegDir, 'ffprobe'), 0o755);
      } catch (chmodErr) {
        console.warn('[FFmpeg] Failed to set execute permissions on binaries:', chmodErr.message);
      }
    }
    
    // Geçici dosyaları sil
    try {
      if (fs.existsSync(ffmpegZip)) fs.unlinkSync(ffmpegZip);
      if (fs.existsSync(ffprobeZip)) fs.unlinkSync(ffprobeZip);
    } catch (e) {}
    
    // FFmpeg önbelleğini sıfırla ve yeniden doğrula
    isFfmpegWorkingCached = null;
    const testResult = testFfmpegSync();
    
    if (testResult) {
      ffmpegDownloadState.status = 'completed';
      ffmpegDownloadState.progress = 100;
      ffmpegDownloadState.error = null;
      console.log('[FFmpeg] Installation completed successfully.');
      broadcast('ffmpeg_download', ffmpegDownloadState);
      broadcast('status_log', { message: 'FFmpeg automatically installed and activated.', type: 'success' });
    } else {
      throw new Error('FFmpeg check test failed after extraction.');
    }
  } catch (err) {
    console.error('[FFmpeg] Installation process failed:', err);
    try {
      if (fs.existsSync(ffmpegZip)) fs.unlinkSync(ffmpegZip);
      if (fs.existsSync(ffprobeZip)) fs.unlinkSync(ffprobeZip);
    } catch (e) {}
    
    ffmpegDownloadState.status = 'failed';
    ffmpegDownloadState.error = err.message || 'Extraction failed';
    broadcast('ffmpeg_download', ffmpegDownloadState);
  }
}

// FFmpeg kurulum durumu sorgulama
app.get('/api/ffmpeg/status', (req, res) => {
  const isFfmpegWorking = testFfmpegSync();
  res.json({
    installed: isFfmpegWorking,
    status: ffmpegDownloadState.status,
    progress: ffmpegDownloadState.progress,
    error: ffmpegDownloadState.error
  });
});

// FFmpeg indirmeyi tetikleme
app.post('/api/ffmpeg/download', (req, res) => {
  if (ffmpegDownloadState.status === 'downloading' || ffmpegDownloadState.status === 'extracting') {
    return res.json({ success: true, message: 'İndirme işlemi zaten arka planda devam ediyor.', state: ffmpegDownloadState });
  }
  
  // Asenkron olarak başlat
  downloadFfmpegAsync().catch(err => console.error('[FFmpeg Download Route] Error:', err));
  
  res.json({ success: true, message: 'İndirme işlemi başlatıldı.', state: ffmpegDownloadState });
});

// Kanalları yedek olarak dışarı aktar (Export)
app.get('/api/channels/export', (req, res) => {
  try {
    const db = readDb();
    const backupData = {
      channels: db.channels || [],
      backupDate: new Date().toISOString(),
      branding: "HaYTooL YouTube Downloader"
    };
    res.setHeader('Content-disposition', 'attachment; filename=channels_backup.json');
    res.setHeader('Content-type', 'application/json');
    res.send(JSON.stringify(backupData, null, 2));
  } catch (err) {
    console.error('Yedek dışarı aktarılamadı:', err);
    res.status(500).json({ error: 'Yedek dışarı aktarılamadı.' });
  }
});

// Yedekten kanalları içeri aktar (Import)
app.post('/api/channels/import', (req, res) => {
  try {
    const { overwrite, channels } = req.body;
    if (!Array.isArray(channels)) {
      return res.status(400).json({ error: 'Geçersiz yedek dosyası içeriği.' });
    }

    const db = readDb();
    let addedCount = 0;
    let updatedCount = 0;

    if (overwrite === true || overwrite === 'true') {
      db.channels = [];
    }

    channels.forEach(ch => {
      if (!ch.id || !ch.name) return;
      
      const existingIdx = db.channels.findIndex(c => c.id === ch.id);
      if (existingIdx !== -1) {
        db.channels[existingIdx] = { ...db.channels[existingIdx], ...ch };
        updatedCount++;
      } else {
        db.channels.push(ch);
        addedCount++;
      }
    });

    writeDb(db);
    broadcast('db_update', db);
    
    // Disk sync tetikle
    setTimeout(() => {
      syncDbWithDisk();
    }, 100);

    res.json({ success: true, added: addedCount, updated: updatedCount });
  } catch (err) {
    console.error('Yedek içeri aktarılamadı:', err);
    res.status(500).json({ error: 'Yedek içeri aktarılamadı.' });
  }
});

// Alternatif Hız Sınırını Aç/Kapat
app.post('/api/settings/toggle-alt-speed', (req, res) => {
  const db = readDb();
  const oldSpeedLimit = getEffectiveSpeedLimit(db.settings);
  
  db.settings.useAlternativeSpeed = !db.settings.useAlternativeSpeed;
  
  const newSpeedLimit = getEffectiveSpeedLimit(db.settings);
  const speedLimitChanged = newSpeedLimit !== oldSpeedLimit;
  
  writeDb(db);
  broadcast('db_update', db);
  
  // Hız sınırı değiştiyse ve aktif indirme varsa yeniden başlat
  if (speedLimitChanged && downloadQueue.activeProcess && downloadQueue.activeVideoId) {
    const videoId = downloadQueue.activeVideoId;
    const historyItem = db.history.find(h => h.id === videoId);
    if (historyItem) {
      console.log(`[Ayarlar] Hız sınırı alternatif geçişi ile changed (${oldSpeedLimit} -> ${newSpeedLimit}). Aktif indirme with the new speed limitı ile is restartingılıyor: ${historyItem.title}`);
      addTerminalLog(`[Ayarlar] Hız sınırı alternatif geçişi ile changed. Aktif indirme with the new speed limitı ile is restartingılıyor: "${historyItem.title}"`, 'info');
      
      downloadQueue.queue.unshift({
        id: videoId,
        title: historyItem.title,
        channelId: historyItem.channelId,
        channelName: historyItem.channelName,
        url: `https://www.youtube.com/watch?v=${videoId}`,
        publishedAt: historyItem.publishedAt || ''
      });
      
      updateHistoryItem(videoId, {
        status: 'waiting',
        progress: historyItem.progress || 0,
        speed: '',
        eta: ''
      });
      
      const proc = downloadQueue.activeProcess;
      const pid = proc.pid;
      
      downloadQueue.activeProcess = null;
      downloadQueue.activeVideoId = null;
      if (downloadQueue.activeDownloads > 0) {
        downloadQueue.activeDownloads--;
      }
      
      exec(`taskkill /F /T /PID ${pid}`, (err) => {
        try {
          proc.kill('SIGKILL');
        } catch (e) {}
        
        setTimeout(() => {
          downloadQueue.process();
        }, 1000);
      });
    }
  }
  
  res.json({ success: true, settings: db.settings });
});

// Kanal Ekle
app.post('/api/channels', async (req, res) => {
  const { input, name, handle, avatar, downloadShorts } = req.body;
  if (!input) return res.status(400).json({ error: 'Kanal adı veya adresi boş olamaz.' });

  try {
    let channelInfo;
    const db = readDb();

    // Türkçe Açıklama: Eğer kanal adı, handle ve avatar frontend'den gelmişse ve girdi bir kanal ID'si ise, YouTube sayfasına fazladan istek atmadan doğrudan bu verilerle devam ediyoruz.
    if (name && handle && /^UC[a-zA-Z0-9_-]{22}$/.test(input)) {
      channelInfo = {
        id: input,
        name: name,
        avatar: avatar || '',
        handle: handle
      };
    } else {
      channelInfo = await resolveChannelId(input);
    }

    // Zaten ekli mi kontrol et
    if (db.channels.some(c => c.id === channelInfo.id)) {
      return res.status(400).json({ error: 'Bu kanal zaten takip listesinde.' });
    }

    // Türkçe Açıklama: Girdiden veya çözümlenen verilerden handle ifadesini ayıklıyoruz.
    let extractedHandle = channelInfo.handle || '';
    if (!extractedHandle) {
      const decodedInput = decodeURIComponent(input);
      const handleMatch = decodedInput.match(/@([^/?\s]+)/);
      if (handleMatch) {
        extractedHandle = `@${handleMatch[1]}`;
      } else {
        extractedHandle = decodedInput.startsWith('@') ? decodedInput : `@${channelInfo.name.replace(/\s+/g, '')}`;
      }
    }

    const newChannel = {
      id: channelInfo.id,
      name: channelInfo.name,
      handle: extractedHandle,
      addedAt: new Date().toISOString(),
      quality: 'default',
      downloadShorts: downloadShorts === true || downloadShorts === 'true',
      avatar: channelInfo.avatar || '',
      shortsDurationLimit: 180
    };
    // Türkçe Açıklama: Önce kanalı listeye ekliyoruz ve veri tabanını kaydediyoruz ki RSS taraması sırasında veri tabanı çakışması veya üzerine yazma (overwrite) hatası oluşmasın.
    db.channels.push(newChannel);
    writeDb(db);

    // Türkçe Açıklama: Kanal eklendikten sonra profil resmi yerel klasöre indirilir.
    if (channelInfo.avatar) {
      try {
        await downloadChannelAvatar(channelInfo.avatar, channelInfo.name);
      } catch (avatarErr) {
        console.error(`[Kanal] Avatar indirme hatası:`, avatarErr.message);
      }
    }

    // Türkçe Açıklama: Kanal veri tabanına eklendikten sonra ilk RSS taramasını yapıp videolarını geçmişe 'ignored' olarak kaydediyoruz.
    try {
      await checkSingleChannelRss(newChannel, true);
    } catch (rssErr) {
      console.error(`[Kanal] İlk RSS taraması başarısız oldu:`, rssErr.message);
      addTerminalLog(`[Kanal] "${newChannel.name}" için ilk taramada hata oluştu: ${rssErr.message}.`, 'warning');
    }

    // Türkçe Açıklama: RSS taraması sonrasında güncellenen veritabanını (geçmiş videoları içeren halini) diskten okuyup arayüze yayınlıyoruz.
    const finalDb = readDb();
    broadcast('db_update', finalDb);
    broadcast('status_log', { message: `${channelInfo.name} kanalı başarıyla eklendi.`, type: 'success' });
    addTerminalLog(`[Kanal] Kanal takip listesine eklendi: "${channelInfo.name}" (ID: ${channelInfo.id})`, 'success');

    res.json({ success: true, channel: channelInfo });
  } catch (err) {
    addTerminalLog(`[Kanal] Kanal ekleme hatası (Giriş: "${input}") - Error: ${err.message}`, 'error');
    res.status(500).json({ error: err.message || 'Kanal eklenemedi.' });
  }
});

// Kanal Sil
app.delete('/api/channels/:id', (req, res) => {
  const { id } = req.params;
  if (!/^UC[a-zA-Z0-9_-]{22}$/.test(id)) {
    return res.status(400).json({ error: 'Geçersiz Kanal ID formatı.' });
  }
  const db = readDb();
  const channel = db.channels.find(c => c.id === id);
  
  if (!channel) return res.status(404).json({ error: 'Kanal bulunamadı.' });

  db.channels = db.channels.filter(c => c.id !== id);
  // Kanal silindiğinde onun geçmiş kayıtlarını da temizlemek isteyebiliriz:
  db.history = db.history.filter(h => h.channelId !== id);

  writeDb(db);
  broadcast('db_update', db);
  broadcast('status_log', { message: `${channel.name} kanalı takipten çıkarıldı.`, type: 'info' });
  addTerminalLog(`[Kanal] Kanal removed from watchlistı: "${channel.name}" (ID: ${id})`, 'warning');
  res.json({ success: true });
});

// Tek bir kanalı manuel tara
app.post('/api/channels/:id/sync', async (req, res) => {
  const { id } = req.params;
  if (!/^UC[a-zA-Z0-9_-]{22}$/.test(id)) {
    return res.status(400).json({ error: 'Geçersiz Kanal ID formatı.' });
  }
  try {
    const db = readDb();
    const channel = db.channels.find(c => c.id === id);
    if (!channel) return res.status(404).json({ error: 'Kanal bulunamadı.' });
    
    addTerminalLog(`[RSS] Tekil manuel tetikleme: "${channel.name}" denetleniyor...`, 'info');
    await checkSingleChannelRss(channel, false);
    resolveMissingDurations();
    
    addTerminalLog(`[RSS] Tekil manuel tetikleme: "${channel.name}" denetimi tamamlandı.`, 'success');
    broadcast('status_log', { message: `"${channel.name}" kanalı başarıyla denetlendi.`, type: 'success' });
    res.json({ success: true, message: 'Kanal başarıyla denetlendi.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Kanala özel kalite ayarla
app.post('/api/channels/:id/quality', (req, res) => {
  const { id } = req.params;
  if (!/^UC[a-zA-Z0-9_-]{22}$/.test(id)) {
    return res.status(400).json({ error: 'Geçersiz Kanal ID formatı.' });
  }
  const { quality } = req.body; // 'default', 'best', '1080p', '720p'
  const db = readDb();
  const channel = db.channels.find(c => c.id === id);
  if (!channel) return res.status(404).json({ error: 'Kanal bulunamadı.' });

  channel.quality = quality;
  writeDb(db);
  broadcast('db_update', db);
  res.json({ success: true });
});

// Kanala özel Shorts indirme ayarını değiştir
app.post('/api/channels/:id/shorts', (req, res) => {
  const { id } = req.params;
  if (!/^UC[a-zA-Z0-9_-]{22}$/.test(id)) {
    return res.status(400).json({ error: 'Geçersiz Kanal ID formatı.' });
  }
  const { downloadShorts } = req.body; // boolean
  const db = readDb();
  const channel = db.channels.find(c => c.id === id);
  if (!channel) return res.status(404).json({ error: 'Kanal bulunamadı.' });

  channel.downloadShorts = downloadShorts === true || downloadShorts === 'true';
  writeDb(db);
  broadcast('db_update', db);
  res.json({ success: true });
});

// Kanala özel Shorts limit süresini değiştir
app.post('/api/channels/:id/shorts-limit', (req, res) => {
  const { id } = req.params;
  if (!/^UC[a-zA-Z0-9_-]{22}$/.test(id)) {
    return res.status(400).json({ error: 'Geçersiz Kanal ID formatı.' });
  }
  const { limit } = req.body; // number
  const limitNum = parseInt(limit, 10);
  if (isNaN(limitNum) || limitNum < 0) {
    return res.status(400).json({ error: 'Geçersiz süre limiti.' });
  }
  const db = readDb();
  const channel = db.channels.find(c => c.id === id);
  if (!channel) return res.status(404).json({ error: 'Kanal bulunamadı.' });

  channel.shortsDurationLimit = limitNum;
  writeDb(db);
  broadcast('db_update', db);
  res.json({ success: true });
});

// Kanal logosunu YouTube'dan yeniden çözümle ve güncelle
app.post('/api/channels/:id/update-avatar', async (req, res) => {
  const { id } = req.params;
  if (!/^UC[a-zA-Z0-9_-]{22}$/.test(id)) {
    return res.status(400).json({ error: 'Geçersiz Kanal ID formatı.' });
  }
  const db = readDb();
  const channel = db.channels.find(c => c.id === id);
  if (!channel) return res.status(404).json({ error: 'Kanal bulunamadı.' });

  try {
    const channelUrl = channel.handle && channel.handle.startsWith('http') 
      ? channel.handle 
      : `https://www.youtube.com/${channel.handle && channel.handle.startsWith('@') ? channel.handle : '@' + channel.name.replace(/\s+/g, '')}`;
      
    addTerminalLog(`[Kanal] Kanal logo is being updated: "${channel.name}"`, 'info');
    const info = await resolveChannelId(channelUrl);
    if (info && info.avatar) {
      channel.avatar = info.avatar;
      
      // Türkçe Açıklama: Logo güncellendiğinde yerel avatar dosyasını ve klasör simgesini güncelleriz.
      await downloadChannelAvatar(info.avatar, channel.name);
      
      writeDb(db);
      broadcast('db_update', db);
      broadcast('status_log', { message: `${channel.name} kanal logosu güncellendi.`, type: 'success' });
      addTerminalLog(`[Kanal] Kanal logosu successfully updated: "${channel.name}"`, 'success');
      return res.json({ success: true, avatar: info.avatar });
    } else {
      throw new Error('Profil resmi bulunamadı.');
    }
  } catch (err) {
    addTerminalLog(`[Kanal] Kanal logosu failed to update: "${channel.name}" - Error: ${err.message}`, 'error');
    res.status(500).json({ error: err.message || 'Logo güncellenemedi.' });
  }
});

// Kanalın yerel profil resmini (avatar.jpg) sunan API
// Türkçe Açıklama: Kanal logosu yerel diskte varsa gönderir, yoksa YouTube üzerindeki orijinal URL'ye yönlendirir.
app.get('/api/channels/:id/avatar', (req, res) => {
  const { id } = req.params;
  const db = readDb();
  const channel = db.channels.find(c => c.id === id);
  if (!channel) return res.status(404).send('Kanal bulunamadı.');
  
  const avatarPath = path.join(db.settings.downloadPath, channel.name, 'avatar.jpg');
  if (fs.existsSync(avatarPath)) {
    return res.sendFile(avatarPath);
  }
  
  if (channel.avatar) {
    return res.redirect(channel.avatar);
  }
  
  res.status(404).send('Avatar bulunamadı.');
});

// Tüm kanalların logolarını YouTube'dan yeniden çözümle, güncelle ve yerel diske indir
// Türkçe Açıklama: İzlenen tüm kanalların profil resimlerini YouTube'dan günceller ve yerel klasörlerine indirip klasör simgesi yapar.
app.post('/api/channels/update-all-avatars', localhostOnly, async (req, res) => {
  const db = readDb();
  if (db.channels.length === 0) {
    return res.json({ success: true, message: 'İzlenen kanal bulunmuyor.' });
  }

  addTerminalLog('[Kanal] Batch channel logosu update startedı...', 'info');
  console.log('[Kanal] Batch channel logosu update startedı...');
  
  let updatedCount = 0;
  let failedCount = 0;

  for (const channel of db.channels) {
    try {
      const channelUrl = channel.handle && channel.handle.startsWith('http') 
        ? channel.handle 
        : `https://www.youtube.com/${channel.handle && channel.handle.startsWith('@') ? channel.handle : '@' + channel.name.replace(/\s+/g, '')}`;
        
      console.log(`[Kanal] Logo is being updated: ${channel.name}`);
      const info = await resolveChannelId(channelUrl);
      if (info && info.avatar) {
        channel.avatar = info.avatar;
        await downloadChannelAvatar(info.avatar, channel.name);
        updatedCount++;
      } else {
        failedCount++;
      }
      // Bot engellemesini önlemek için 500ms bekletiyoruz
      await new Promise(r => setTimeout(r, 500));
    } catch (e) {
      console.error(`[Kanal] Logo update errorı (${channel.name}):`, e.message);
      failedCount++;
    }
  }

  writeDb(db);
  broadcast('db_update', db);
  broadcast('status_log', { message: `Toplu logo güncelleme tamamlandı. Başarılı: ${updatedCount}, Başarısız: ${failedCount}`, type: 'success' });
  addTerminalLog(`[Kanal] Batch logo güncelleme completedı. Successı: ${updatedCount}, Failed: ${failedCount}`, 'success');

  res.json({ success: true, updatedCount, failedCount });
});

// Manuel Video İndirmeyi Başlat (Kuyruğa yeni video ekler ve eksik süre/tarih çözücüyü tetikler)
app.post('/api/download-video', async (req, res) => {
  const { videoId, url } = req.body;
  let { title, channelName, channelId } = req.body;

  let targetVideoId = videoId;

  if (!targetVideoId && url) {
    const youtubeRegex = /(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/))([^?&"'>\s]{11})/;
    const match = url.match(youtubeRegex);
    if (match) {
      targetVideoId = match[1];
    }
  }

  if (!targetVideoId) return res.status(400).json({ error: 'Video ID veya URL gereklidir.' });
  if (!/^[a-zA-Z0-9_-]{11}$/.test(targetVideoId)) {
    return res.status(400).json({ error: 'Geçersiz Video ID veya URL formatı.' });
  }

  // Eğer kanal ismi veya başlık eksikse (örneğin PD butonu ile link yapıştırıldığında), YouTube'dan detayları çek
  if (!channelName || !title) {
    try {
      console.log(`[Manual Download] Fetching video details from from YouTube: ${targetVideoId}`);
      const details = await fetchVideoDuration(targetVideoId);
      if (details) {
        if (details.title) title = details.title;
        if (details.channelName) channelName = details.channelName;
        if (details.channelId) channelId = details.channelId;
      }
    } catch (err) {
      console.error(`[Manual Download] details while fetching Error occurred:`, err.message);
    }
  }

  downloadQueue.add({
    id: targetVideoId,
    title: title || 'Bilinmeyen Video',
    channelId: channelId || 'manual',
    channelName: channelName || 'Manuel İndirme',
    url: `https://www.youtube.com/watch?v=${targetVideoId}`,
    publishedAt: '' // Boş bırakarak arka plandaki çözücünün gerçek yayınlanma tarihini YouTube'dan çekmesini sağlarız
  });

  resolveMissingDurations();

  res.json({ success: true, message: 'İndirme kuyruğuna eklendi.', videoId: targetVideoId });
});

// Update Library Metadata (File size for completed, trigger missing duration resolution)
app.post('/api/library/update-metadata', localhostOnly, (req, res) => {
  try {
    const db = readDb();
    const type = req.body.type;
    let updated = false;
    let count = 0;

    if (type === 'downloaded') {
      db.history.forEach(item => {
        if (item.status === 'completed') {
          if (item.duration === '-') item.duration = '';
          if (item.publishedAt === '-') item.publishedAt = '';
          item.resolveAttempts = 0;
          updated = true;

          if (item.filePath && fs.existsSync(item.filePath)) {
            count++;
            try {
              const stats = fs.statSync(item.filePath);
              const sizeMB = (stats.size / (1024 * 1024)).toFixed(2) + ' MB';
              if (item.fileSize !== sizeMB) {
                item.fileSize = sizeMB;
                updated = true;
              }
            } catch (err) {}
          }
        }
      });
      if (updated) {
        writeDb(db);
        broadcast('db_update', db);
      }
      resolveMissingDurations('completed');
    } else {
      db.history.forEach(item => {
        if (item.status !== 'completed') {
          if (item.duration === '-') item.duration = '';
          if (item.publishedAt === '-') item.publishedAt = '';
          item.resolveAttempts = 0;
          updated = true;
          count++;
        }
      });
      if (updated) {
        writeDb(db);
        broadcast('db_update', db);
      }
      resolveMissingDurations('not_completed');
    }

    res.json({ success: true, count, message: 'Metadata update triggered successfully.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Şimdi Kontrol Et (Manuel RSS tetikleme) - Tüm kanalları sırayla arka planda denetler
/**
 * Tüm kanalların RSS taranmasını tetikler ve arka planda çalıştırarak hemen yanıt döner.
 * 
 * @param {object} req Express istek nesnesi
 * @param {object} res Express yanıt nesnesi
 */
app.post('/api/sync', (req, res) => {
  try {
    const db = readDb();
    if (db.channels.length === 0) {
      return res.json({ success: true, message: 'İzlenen kanal bulunmuyor.' });
    }
    
    addTerminalLog('[RSS] Manuel tetikleme: Tüm kanallar sırayla denetleniyor...', 'info');
    
    // Arka planda kanalları sırayla denetle
    (async () => {
      try {
        for (const channel of db.channels) {
          await checkSingleChannelRss(channel, false);
          await new Promise(r => setTimeout(r, 1000));
        }
        
        resolveMissingDurations();
        addTerminalLog('[RSS] Manuel tetikleme: Tüm kanalların denetimi tamamlandı.', 'success');
        broadcast('status_log', { message: 'Tüm kanalların denetimi tamamlandı.', type: 'success' });
      } catch (err) {
        addTerminalLog(`[RSS] [HATA] Manuel tetikleme sırasında hata oluştu: ${err.message}`, 'error');
      }
    })();
    
    res.json({ success: true, message: 'Kanal denetimi arka planda başlatıldı.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Videoyu yerel medya oynatıcıda aç
app.post('/api/play-video', localhostOnly, (req, res) => {
  const { videoId } = req.body;
  if (!videoId || !/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
    return res.status(400).json({ error: 'Geçersiz veya eksik Video ID.' });
  }
  const db = readDb();
  const item = db.history.find(h => h.id === videoId);
  
  if (!item) {
    console.error(`[Play Video Errorsı] Video kaydı geçmişte not foundı. ID: ${videoId}`);
    return res.status(404).json({ error: 'Video kaydı bulunamadı.' });
  }

  let fileToPlay = item.filePath;
  if (!fileToPlay || !fs.existsSync(fileToPlay)) {
    fileToPlay = findVideoFileInDownloadDir(videoId, db.settings.downloadPath);
  }

  if (fileToPlay && fs.existsSync(fileToPlay)) {
    console.log(`[Oynat] Dosya oynatılıyor: ${fileToPlay}`);
    open(fileToPlay);
    res.json({ success: true });
  } else {
    const errorMsg = `Video dosyası bulunamadı. Aranan Konum: ${fileToPlay || path.join(db.settings.downloadPath, `*[${videoId}]*`)}`;
    console.error(`[Play Video Errorsı] ${errorMsg}`);
    res.status(404).json({ error: errorMsg });
  }
});

// Gömülü Oynatıcı için Video Akışı (Stream)
app.get('/api/video-stream', (req, res) => {
  const { videoId } = req.query;
  if (!videoId) return res.status(400).send('Video ID is required');
  if (!/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
    return res.status(400).send('Invalid Video ID format');
  }

  const db = readDb();
  const item = db.history.find(h => h.id === videoId);
  let fileToPlay = item ? item.filePath : null;

  if (!fileToPlay || !fs.existsSync(fileToPlay)) {
    fileToPlay = findVideoFileInDownloadDir(videoId, db.settings.downloadPath);
  }

  if (fileToPlay && fs.existsSync(fileToPlay)) {
    console.log(`[Stream] Video akıtılıyor: ${fileToPlay}`);
    
    // Türkçe Açıklama: Gelişmiş seek/ilerletme desteği için Range isteklerini manuel olarak işleyip okuma akışı (read stream) ile sunar.
    const stat = fs.statSync(fileToPlay);
    const fileSize = stat.size;
    const range = req.headers.range;
    const ext = path.extname(fileToPlay).toLowerCase();
    const contentType = ext === '.webm' ? 'video/webm' : 'video/mp4';

    if (range) {
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      
      if (start >= fileSize) {
        res.status(416).set('Content-Range', `bytes */${fileSize}`).send();
        return;
      }

      // Türkçe Açıklama: Tarayıcının talep ettiği aralığı (range) tam olarak sunar. maxChunk gibi suni sınırlandırmalar yavaşlığa ve takılmaya sebep olduğu için kaldırılmıştır.
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunksize = (end - start) + 1;
      const file = fs.createReadStream(fileToPlay, { start, end });
      const head = {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize,
        'Content-Type': contentType,
      };
      res.writeHead(206, head);
      file.pipe(res);

      // Bağlantı kesildiğinde veya ileri sarıldığında eski okuma akışı yok edilir.
      req.on('close', () => {
        file.destroy();
      });
    } else {
      const head = {
        'Content-Length': fileSize,
        'Content-Type': contentType,
      };
      res.writeHead(200, head);
      const file = fs.createReadStream(fileToPlay);
      file.pipe(res);

      req.on('close', () => {
        file.destroy();
      });
    }
  } else {
    console.error(`[Stream Errorsı] File not foundı. ID: ${videoId}`);
    res.status(404).send('Video dosyası bulunamadı.');
  }
});

// Video geçmişini sil ve isteğe bağlı olarak dosyasını kaldır
app.delete('/api/history/:id', (req, res) => {
  const { id } = req.params;
  if (!/^[a-zA-Z0-9_-]{11}$/.test(id)) {
    return res.status(400).json({ error: 'Geçersiz Video ID formatı.' });
  }
  const deleteFile = req.query.deleteFile === 'true';
  
  console.log(`\n--- DELETE PROCESS STARTED ---`);
  console.log(`Tarih/Saat: ${new Date().toLocaleString('tr-TR')}`);
  console.log(`Target Video ID: ${id}`);
  console.log(`Bilgisayardan dosya silinsin mi: ${deleteFile}`);

  const db = readDb();
  const itemIndex = db.history.findIndex(h => h.id === id);

  if (itemIndex !== -1) {
    const item = db.history[itemIndex];
    console.log(`Video Adı: ${item.title}`);
    console.log(`Kanal: ${item.channelName}`);
    console.log(`Kayıtlı Yol: ${item.filePath}`);
    
    if (deleteFile) {
      try {
        const folder = db.settings.downloadPath;
        const foldersToSearch = [folder];
        if (item.channelName) {
          foldersToSearch.push(path.join(folder, item.channelName));
        }

        console.log(`Silme işlemi için tSearching foldersörler:`, foldersToSearch);
        
        let deletedAny = false;
        let failedToDelete = [];
        const targetPattern = `[${id}]`;

        for (const fld of foldersToSearch) {
          if (fs.existsSync(fld)) {
            const files = fs.readdirSync(fld);
            for (const file of files) {
              if (file.includes(targetPattern)) {
                const fullPath = path.join(fld, file);
                console.log(`Eşleşen dosya bulundu: ${file} (${fld}). Silinmeye çalışılıyor...`);
                if (fs.existsSync(fullPath)) {
                  try {
                    fs.unlinkSync(fullPath);
                    console.log(`BAŞARI: Dosya deleted: ${file}`);
                    deletedAny = true;
                  } catch (e) {
                    console.error(`HATA: Dosya silinemedi: ${file}`);
                    console.error(`Error Detailı: ${e.code} - ${e.message}`);
                    failedToDelete.push(`${file} (${e.message})`);
                  }
                }
              }
            }
          }
        }

        if (failedToDelete.length > 0) {
          const errorMsg = `Video dosyası silinemedi (Dosya kilitli veya açık olabilir): ${failedToDelete.join(', ')}`;
          console.error(`[DELETE ERROR] ${errorMsg}`);
          console.log(`--- SİLME İŞLEMİ FAILED ---\n`);
          return res.status(500).json({ error: errorMsg });
        }
        if (deletedAny) {
          broadcast('status_log', { message: `İlgili video dosyaları bilgisayarınızdan silindi: ${item.title}`, type: 'info' });
        } else {
          console.log(`BİLGİ: Searching foldersörlerde '${targetPattern}' içeren herhangi bir File not foundı (already deletedş olabilir).`);
        }
      } catch (err) {
        console.error(`[DELETE ERROR] Genel hata: ${err.message}`);
        console.log(`--- SİLME İŞLEMİ FAILED ---\n`);
        return res.status(500).json({ error: `Dosya silme hatası: ${err.message}` });
      }
    }

    db.history.splice(itemIndex, 1);

    // Silinen videoyu 'ignored' olarak geri ekle ki RSS yeni video sanarak tekrar indirmesin
    db.history.push({
      id: item.id,
      title: item.title,
      channelId: item.channelId,
      channelName: item.channelName,
      downloadedAt: new Date().toISOString(),
      publishedAt: item.publishedAt || '',
      status: 'ignored',
      progress: 0,
      fileSize: '',
      filePath: '',
      speed: '',
      eta: '',
      duration: item.duration || ''
    });
    console.log(`BİLGİ: Video '${item.title}' RSS'in tekrar indirmemesi için 'ignored' olarak işaretlendi.`);

    writeDb(db);
    broadcast('db_update', db);
    broadcast('status_log', { message: `Video geçmişten temizlendi: ${item.title}`, type: 'success' });
    console.log(`BAŞARI: Video history record from databaseından deleted.`);
    console.log(`--- SİLME İŞLEMİ completedI ---\n`);
    res.json({ success: true });
  } else {
    console.error(`HATA: ID '${id}' video record in databaseında not foundı.`);
    console.log(`--- SİLME İŞLEMİ FAILED ---\n`);
    res.status(404).json({ error: 'Video kaydı bulunamadı.' });
  }
});

// Türkçe Açıklama: YouTube üzerinden kanal arama API ucu.
app.get('/api/channels/search', async (req, res) => {
  const { q } = req.query;
  if (!q) {
    return res.status(400).json({ error: 'Arama sorgusu boş olamaz.' });
  }
  try {
    const results = await searchChannelsOnYoutube(q);
    res.json(results);
  } catch (err) {
    console.error('[Channel Search Errorsı]:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Disk boş alan bilgisini getiren API
app.get('/api/disk-space', (req, res) => {
  const db = readDb();
  const folder = db.settings.downloadPath;
  
  try {
    if (!fs.existsSync(folder)) {
      fs.mkdirSync(folder, { recursive: true });
    }
    const stats = fs.statfsSync(folder);
    const freeBytes = stats.bfree * stats.bsize;
    const totalBytes = stats.blocks * stats.bsize;
    
    // Türkçe Açıklama: Ana indirme klasörünün toplam boyutunu bayt cinsinden hesaplıyoruz.
    const folderSizeBytes = getDirSize(folder);
    
    // Windows için sürücü harfini bulmayı dene
    const absPath = path.resolve(folder);
    const driveLetterMatch = absPath.match(/^([a-zA-Z]):/);
    const driveLetter = driveLetterMatch ? driveLetterMatch[1].toUpperCase() : '';

    return res.json({
      success: true,
      freeBytes,
      totalBytes,
      folderSizeBytes,
      driveLetter
    });
  } catch (e) {
    console.error('[Disk Space Errorsı]:', e.message);
    res.json({ success: false, error: e.message });
  }
});

// YouTube linkini tarayıcıda aç
app.post('/api/open-youtube', (req, res) => {
  const { videoId } = req.body;
  if (!videoId) return res.status(400).json({ error: 'Video ID gereklidir.' });
  const url = `https://www.youtube.com/watch?v=${videoId}`;
  open(url);
  res.json({ success: true, url });
});

app.post('/api/cancel-all-queued', localhostOnly, (req, res) => {
  const db = readDb();
  let cancelledCount = 0;
  
  db.history.forEach(item => {
    if (item.status === 'waiting') {
      item.status = 'ignored';
      item.error = 'Kullanıcı tarafından iptal edildi.';
      
      const qIndex = downloadQueue.queue.indexOf(item.id);
      if (qIndex !== -1) {
        downloadQueue.queue.splice(qIndex, 1);
      }
      cancelledCount++;
    }
  });

  if (cancelledCount > 0) {
    writeDb(db);
    addTerminalLog(`[Kuyruk] by user request kuyruktaki ${cancelledCount} video cancelled.`, 'warning');
    broadcast('db_update', db);
  }

  res.json({ success: true, count: cancelledCount });
});

// Aktif İndirmeyi veya Sıradaki İndirmeyi İptal Et (Aktif veya kuyruktaki indirmeyi durdurur ve temizler)
app.post('/api/cancel-download', localhostOnly, (req, res) => {
  const { videoId } = req.body;
  if (!videoId) return res.status(400).json({ error: 'Video ID gereklidir.' });
  if (!/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
    return res.status(400).json({ error: 'Geçersiz Video ID formatı.' });
  }

  // 1. Durum: Aktif İndirme İptal Ediliyor
  if (downloadQueue.activeProcess && downloadQueue.activeVideoId === videoId) {
    console.log(`Aktif indirme iptal ediliyor: ${videoId}`);
    
    // Veritabanını güncelle
    updateHistoryItem(videoId, {
      status: 'ignored', // Tekrar indirilebilir olması için 'ignored' yapıyoruz
      progress: 0,
      speed: '',
      eta: '',
      error: 'Kullanıcı tarafından iptal edildi.'
    });

    const proc = downloadQueue.activeProcess;
    const pid = proc.pid;

    // Kuyruk durumunu hemen temizle (close eventini beklemeden)
    downloadQueue.activeProcess = null;
    downloadQueue.activeVideoId = null;
    if (downloadQueue.activeDownloads > 0) {
      downloadQueue.activeDownloads--;
    }

    if (pid) {
      if (process.platform === 'win32') {
        // Windows'ta tüm alt süreçleri (yt-dlp, ffmpeg vb.) öldürmek için taskkill kullanalım
        exec(`taskkill /F /T /PID ${pid}`, (err) => {
          try {
            proc.kill('SIGKILL');
          } catch (e) {}
        });
      } else {
        // Unix/Linux'ta detached olarak başlatılmış tüm alt süreçleri (process group) öldür
        try {
          process.kill(-pid, 'SIGKILL');
        } catch (e) {
          try {
            proc.kill('SIGKILL');
          } catch (err2) {}
        }
      }
    }

    broadcast('status_log', { message: 'Aktif indirme iptal edildi.', type: 'info' });
    broadcast('db_update', readDb());

    // Bir sonraki videoyu indirmeye başla
    downloadQueue.process();

    return res.json({ success: true });
  }

  // 2. Durum: Sıradaki (Kuyruktaki) İndirme İptal Ediliyor
  const queueIndex = downloadQueue.queue.findIndex(item => item.id === videoId);
  if (queueIndex !== -1) {
    console.log(`Sıradaki indirme kuyruktan kaldırılıyor: ${videoId}`);
    downloadQueue.queue.splice(queueIndex, 1);

    // Veritabanını güncelle
    updateHistoryItem(videoId, {
      status: 'ignored',
      progress: 0,
      speed: '',
      eta: '',
      error: 'Kuyruktan kaldırıldı (kullanıcı iptal etti).'
    });

    broadcast('status_log', { message: 'Video indirme kuyruğundan çıkarıldı.', type: 'info' });
    broadcast('db_update', readDb());
    return res.json({ success: true });
  }

  // 3. Durum: Kuyrukta veya aktif süreç değil ama veritabanında 'waiting' veya 'downloading' durumunda kalmış (zombi) olabilir
  const db = readDb();
  const historyItem = db.history.find(h => h.id === videoId);
  if (historyItem && (historyItem.status === 'waiting' || historyItem.status === 'downloading')) {
    updateHistoryItem(videoId, {
      status: 'ignored',
      progress: 0,
      speed: '',
      eta: '',
      error: 'İptal edildi.'
    });

    // Eğer bu video yanlışlıkla aktif süreç olarak görünüyorsa ama activeDownloads 0'dan büyükse, onu da sıfırlayalım/azaltalım
    if (downloadQueue.activeVideoId === videoId) {
      downloadQueue.activeProcess = null;
      downloadQueue.activeVideoId = null;
      if (downloadQueue.activeDownloads > 0) {
        downloadQueue.activeDownloads--;
      }
    }

    broadcast('status_log', { message: 'Video indirme iptal edildi ve durumu temizlendi.', type: 'info' });
    broadcast('db_update', readDb());

    // Bir sonraki videoyu indirmeye çalış
    downloadQueue.process();
    return res.json({ success: true });
  }

  res.status(400).json({ error: 'İptal edilebilecek aktif veya bekleyen bir indirme bulunamadı.' });
});

// Tüm Kuyruğu ve Aktif İndirmeyi İptal Et
app.post('/api/cancel-all-downloads', localhostOnly, (req, res) => {
  // 1. Kuyruktaki her şeyi temizle
  const videosInQueue = downloadQueue.queue.map(item => item.id);
  downloadQueue.queue = [];
  videosInQueue.forEach(vid => {
    updateHistoryItem(vid, { status: 'ignored', progress: 0, speed: '', eta: '', error: 'Kullanıcı tarafından iptal edildi (Tümü).' });
  });

  // 2. Aktif olanı öldür
  if (downloadQueue.activeProcess) {
    const activeId = downloadQueue.activeVideoId;
    updateHistoryItem(activeId, { status: 'ignored', progress: 0, speed: '', eta: '', error: 'Kullanıcı tarafından iptal edildi (Tümü).' });
    
    const proc = downloadQueue.activeProcess;
    const pid = proc.pid;
    
    downloadQueue.activeProcess = null;
    downloadQueue.activeVideoId = null;
    if (downloadQueue.activeDownloads > 0) {
      downloadQueue.activeDownloads--;
    }

    if (pid) {
      if (process.platform === 'win32') {
        exec(`taskkill /F /T /PID ${pid}`, () => { try { proc.kill('SIGKILL'); } catch(e){} });
      } else {
        try { process.kill(-pid, 'SIGKILL'); } catch(e) { try { proc.kill('SIGKILL'); } catch(e){} }
      }
    }
  }

  // 3. Veritabanında waiting veya downloading kalmış zombileri temizle
  const db = readDb();
  let updated = false;
  db.history.forEach(h => {
    if (h.status === 'waiting' || h.status === 'downloading') {
      h.status = 'ignored';
      h.error = 'Kullanıcı tarafından iptal edildi (Tümü).';
      h.progress = 0;
      h.speed = '';
      h.eta = '';
      updated = true;
    }
  });
  if (updated) {
    writeDb(db);
  }

  broadcast('status_log', { message: 'Tüm indirmeler iptal edildi.', type: 'info' });
  broadcast('db_update', readDb());
  res.json({ success: true });
});

// Klasör Seçim Diyaloğu (Windows Native)
app.post('/api/select-folder', localhostOnly, (req, res) => {
  const db = readDb();
  const currentPath = db.settings.downloadPath || '';
  const escapedPath = currentPath.replace(/'/g, "''");
  
  const psCommand = `powershell -NoProfile -STA -Command "Add-Type -AssemblyName System.Windows.Forms; $dialog = New-Object System.Windows.Forms.FolderBrowserDialog; $dialog.Description = 'Please select a download folder'; $dialog.SelectedPath = '${escapedPath}'; $dialog.ShowNewFolderButton = $true; $form = New-Object System.Windows.Forms.Form; $form.TopMost = $true; $form.Opacity = 0; $form.Show(); $form.Activate(); $result = $dialog.ShowDialog($form); $form.Close(); if ($result -eq 'OK') { Write-Output $dialog.SelectedPath } else { Write-Output 'CANCEL' }"`;
  
  exec(psCommand, (err, stdout, stderr) => {
    if (err) {
      console.error('Folder selection error:', err.message || stderr);
      return res.status(500).json({ error: 'Klasör seçim penceresi açılamadı.' });
    }
    const selectedPath = stdout.trim();
    if (selectedPath && selectedPath !== 'CANCEL') {
      res.json({ success: true, path: selectedPath });
    } else {
      res.json({ success: false, message: 'Klasör seçimi iptal edildi.' });
    }
  });
});

// İndirme Klasörünü Aç (Kanal adı gönderilirse o kanalın klasörünü açar, aksi halde genel indirme dizinini açar)
app.post('/api/open-folder', localhostOnly, (req, res) => {
  const db = readDb();
  let folder = db.settings.downloadPath;
  
  const { channelName } = req.body || {};
  if (channelName && typeof channelName === 'string') {
    const channelFolder = path.join(folder, channelName);
    if (fs.existsSync(channelFolder)) {
      folder = channelFolder;
    }
  }

  if (!fs.existsSync(folder)) {
    try {
      fs.mkdirSync(folder, { recursive: true });
    } catch (err) {
      return res.status(500).json({ error: 'Klasör oluşturulamadı.' });
    }
  }

  // Windows'ta klasör aç
  open(folder);
  res.json({ success: true });
});

/**
 * yt-dlp.exe motorunu resmi komutu üzerinden güncellemeye zorlar ve güncelliğini denetler.
 * 
 * @returns {Promise<void>}
 */
function updateYtdlp() {
  return new Promise((resolve) => {
    console.log('yt-dlp.exe update denetleniyor...');
    addTerminalLog('[Sistem] yt-dlp.exe motor update denetleniyor...', 'info');
    exec(`"${ytdlpPath}" -U`, (err, stdout, stderr) => {
      if (err) {
        console.error('yt-dlp update errorı:', err.message);
        addTerminalLog(`[Sistem] yt-dlp güncelleme Failed: ${err.message}`, 'warning');
      } else {
        const output = stdout.trim();
        console.log('yt-dlp güncelleme çıktısı:', output);
        if (output.includes('is up to date')) {
          addTerminalLog('[Sistem] yt-dlp motoru güncel.', 'success');
        } else {
          addTerminalLog(`[Sistem] yt-dlp motoru güncellendi: ${output}`, 'success');
        }
      }
      resolve();
    });
  });
}

// Türkçe Açıklama: Belirtilen klasör yolunun altındaki tüm dosyaların boyutlarını recursive (öz yinelemeli) olarak toplayıp toplam boyutu hesaplar.
/**
 * Belirtilen dizinin ve alt dizinlerinin toplam boyutunu bayt cinsinden hesaplar.
 * 
 * @param {string} dirPath Hesaplanacak dizin yolu
 * @returns {number} Toplam boyut (bayt)
 */
function getDirSize(dirPath) {
  let totalSize = 0;
  try {
    const files = fs.readdirSync(dirPath);
    for (const file of files) {
      const filePath = path.join(dirPath, file);
      const stat = fs.statSync(filePath);
      if (stat.isDirectory()) {
        totalSize += getDirSize(filePath);
      } else {
        totalSize += stat.size;
      }
    }
  } catch (e) {
    // Erişim kısıtlaması olan veya silinmiş dosya/klasör hatalarını yutuyoruz
  }
  return totalSize;
}

/**
 * YouTube üzerinden kanalları arar ve sonuçları döner.
 * 
 * @param {string} query Arama sorgusu
 * @returns {Promise<Array>} Arama sonuçları listesi
 */
function searchChannelsOnYoutube(query) {
  const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}&sp=EgIQAg%3D%3D`;
  return new Promise((resolve, reject) => {
    https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7'
      }
    }, (res) => {
      if (res.statusCode !== 200) {
        return reject(new Error(`YouTube sunucu hatası: HTTP ${res.statusCode}`));
      }

      let html = '';
      res.on('data', chunk => { html += chunk; });
      res.on('end', () => {
        try {
          const match = html.match(/ytInitialData\s*=\s*({.+?})\s*(?:<\/script>|;)/);
          if (!match) {
            return resolve([]);
          }

          const data = JSON.parse(match[1]);
          const results = [];

          const contents = data.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents?.[0]?.itemSectionRenderer?.contents || [];

          for (const item of contents) {
            if (item.channelRenderer) {
              const r = item.channelRenderer;
              const channelId = r.channelId;
              const title = r.title?.simpleText || r.title?.runs?.[0]?.text;
              
              let handleName = '';
              const navEndpoint = r.navigationEndpoint?.commandMetadata?.webCommandMetadata?.url;
              if (navEndpoint && navEndpoint.includes('/@')) {
                handleName = decodeURIComponent(navEndpoint.replace('/', ''));
              } else {
                handleName = `@${channelId}`;
              }

              const avatarSources = r.thumbnail?.thumbnails || [];
              const avatar = avatarSources[avatarSources.length - 1]?.url || '';

              const subscriberCount = r.subscriberCountText?.simpleText || '';

              results.push({
                id: channelId,
                name: title,
                handle: handleName,
                avatar: avatar.startsWith('//') ? 'https:' + avatar : avatar,
                subscribers: subscriberCount
              });
            }
          }
          resolve(results);
        } catch (err) {
          reject(err);
        }
      });
    }).on('error', reject);
  });
}

// Türkçe Açıklama: Veritabanında logo adresi (avatar) bulunmayan kanalların logolarını YouTube sayfalarından çekip günceller.
/**
 * Kanallar listesindeki logosu eksik olan kanalların logolarını arka planda YouTube'dan çözümler.
 */
async function resolveMissingChannelAvatars() {
  const db = readDb();
  let updated = false;
  for (const channel of db.channels) {
    if (!channel.avatar) {
      console.log(`Eksik kanal logosu çözümleniyor: ${channel.name}`);
      try {
        const channelUrl = channel.handle && channel.handle.startsWith('http') 
          ? channel.handle 
          : `https://www.youtube.com/${channel.handle && channel.handle.startsWith('@') ? channel.handle : '@' + channel.name.replace(/\s+/g, '')}`;
          
        const info = await resolveChannelId(channelUrl);
        if (info && info.avatar) {
          channel.avatar = info.avatar;
          updated = true;
          console.log(`Kanal logosu çresolved: ${channel.name} -> ${info.avatar}`);
          // İstekler arası 1 saniye bekleme
          await new Promise(r => setTimeout(r, 1000));
        }
      } catch (e) {
        console.error(`Kanal logosu alınamadı: ${channel.name}`, e.message);
      }
    }
  }
  if (updated) {
    writeDb(db);
    broadcast('db_update', db);
  }
}

// Türkçe Açıklama: SPA yönlendirmeleri için (tarayıcı yenilendiğinde) index.html dosyasını sunuyoruz.
app.get(['/home', '/download', '/downlist', '/channels', '/settings'], (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Sunucu Başlatıldığında (Sadece CLI modu dışında)
if (process.argv.length <= 2) {
  const server = app.listen(PORT, async () => {
    cleanOldLogs(); // 7 günden eski logları temizle

    const db = readDb();
    
    // C# Tray uygulamasının dilini senkronize etmesi için komut gönder
    console.log(`[TRAY_CMD] lang=${db.settings.lang || 'tr'}`);

    console.log(`
    ====================================================
     _    _         __     __ _______  ___   ___   _      
    | |  | |  __ _  \\ \\   / /|__   __|/ _ \\ / _ \\ | |     
    | |__| | / _\` |  \\ \\_/ /    | |  | (_) | (_) || |     
    |  __  || (_| |   \\   /     | |   \\___/ \\___/ | |     
    | |  | | \\__,_|    | |      | |               | |____ 
    |_|  |_|           |_|      |_|               |______|

               -- Premium Otomasyonu --
               Versiyon: v4.13.3
               Yapımcı: HaYTo
    ====================================================
    `);
    console.log(`Sunucu http://localhost:${PORT} portunda çalışıyor.`);
    
    // İndirme klasörünü kontrol et, yoksa oluştur

    // Arka planda veritabanı ile disk senkronizasyonunu (auto-healing, dosya boyutu kontrolü vb.) başlat
    setTimeout(() => {
      syncDbWithDisk();
    }, 1000);

    // Her 5 dakikada bir disk senkronizasyonunu arka planda tekrarla
    setInterval(syncDbWithDisk, 5 * 60 * 1000);
    
    // Türkçe Açıklama: Önceki hatalı kanal eklemelerinden kalmış, ismi ve ID'si aynı olan bozuk kanalları otomatik temizliyoruz.
    const originalCount = db.channels.length;
    db.channels = db.channels.filter(c => c.name !== c.id);
    if (db.channels.length !== originalCount) {
      console.log(`[AYARLAR] İsmi and ID'si aynı olan ${originalCount - db.channels.length} corrupt channels from database cleaned.`);
      writeDb(db);
    }

    addTerminalLog(`[Sistem] Sunucu başarıyla startedı. Adres: http://localhost:${PORT}`, 'success');
    addTerminalLog(`[Sistem] Auto download folderörü: "${db.settings.downloadPath}"`, 'info');
    
    if (!fs.existsSync(db.settings.downloadPath)) {
      try {
        fs.mkdirSync(db.settings.downloadPath, { recursive: true });
      } catch (err) {}
    }

    // Başlangıçta yt-dlp kontrolünü yap
    try {
      await ensureYtdlp();
      // updateYtdlp(); // Otomatik güncelleme iptal edildi
    } catch (e) {
      console.error('yt-dlp kontrolü Failed:', e.message);
    }

    // Başlangıçta ffmpeg kontrolünü yap (eğer merge seçildiyse ve ffmpeg yoksa)
    if (db.settings.mergeType === 'merge' && !fs.existsSync(getFfmpegPath())) {
      ensureFfmpeg().catch(e => console.error('FFmpeg auto download errorı:', e.message));
    }

    // Zamanlayıcıyı başlat
    startIntervalTimer();

    // İlk açılışta mevcut kanalların denetimini sırayla başlat
    setTimeout(() => {
      checkNextChannelRss();
    }, 3000);

    // Sunucu başlangıcında ve 1 saatte bir otomatik silme kontrolünü çalıştır
    setTimeout(() => {
      autoDeleteOldVideos();
    }, 8000);
    setInterval(autoDeleteOldVideos, 60 * 60 * 1000);

    // Başlangıçta eksik kanal logolarını arka planda tamamla (Devre dışı bırakıldı - Kullanıcı isteğiyle buton üzerinden manuel yapılacak)
    // setTimeout(() => {
    //   resolveMissingChannelAvatars();
    // }, 10000);

    // Eksik video sürelerini arka planda çöz
    setTimeout(() => {
      resolveMissingDurations();
    }, 6000);

    // Sunucu başladığında veritabanında 'waiting' veya yarım kalan 'downloading' durumundaki videoları kuyruğa yeniden ekle
    setTimeout(() => {
      const currentDb = readDb();
      let queuedCount = 0;
      currentDb.history.forEach(item => {
        if (item.status === 'waiting' || item.status === 'downloading') {
          downloadQueue.add({
            id: item.id,
            title: item.title,
            channelId: item.channelId,
            channelName: item.channelName,
            url: `https://www.youtube.com/watch?v=${item.id}`,
            publishedAt: item.publishedAt || ''
          });
          queuedCount++;
        }
      });
      if (queuedCount > 0) {
        console.log(`[Sistem] Sunucu başlangıcında ${queuedCount} adet yarım kalan/bekleyen indirme queue yeniden eklendi.`);
        addTerminalLog(`[Sistem] Sunucu başlangıcında ${queuedCount} adet yarım kalan/bekleyen indirme queue yeniden eklendi.`, 'info');
      }
    }, 4000);

    // Tarayıcıda uygulamayı otomatik aç (Eğer ayar aktifse)
    const currentDbState = readDb();
    if (currentDbState.settings.autoOpenBrowser !== false) {
      try {
        await open(`http://localhost:${PORT}`);
      } catch (e) {
        console.log(`Tarayıcı otomatik açılamadı, lütfen http://localhost:${PORT} adresine manuel gidin.`);
      }
    } else {
      console.log(`Otomatik tarayıcı açılışı devre dışı bırakıldı. Lütfen http://localhost:${PORT} adresine el ile gidin.`);
    }
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      let dbLang = 'tr';
      try {
        const db = readDb();
        dbLang = db.settings.lang || 'tr';
      } catch (e) {}

      if (dbLang === 'en') {
        console.error(`\n[ERROR] Port ${PORT} is already in use by another application or process!`);
        console.error(`Please close other background server processes or change the 'port' setting in configwin.ini.\n`);
      } else if (dbLang === 'es') {
        console.error(`\n[ERROR] ¡El puerto ${PORT} ya está siendo utilizado por otra aplicación o proceso!`);
        console.error(`Cierre otros procesos del servidor en segundo plano o cambie el puerto en configwin.ini.\n`);
      } else if (dbLang === 'de') {
        console.error(`\n[FEHLER] Port ${PORT} wird bereits von einer anderen Anwendung oder einem anderen Prozess verwendet!`);
        console.error(`Bitte schließen Sie andere Hintergrundserver-Prozesse oder ändern Sie den Port in configwin.ini.\n`);
      } else if (dbLang === 'pt') {
        console.error(`\n[ERRO] A porta ${PORT} já está em uso por outro aplicativo ou processo!`);
        console.error(`Feche outros processos do servidor em segundo plano ou altere a porta no configwin.ini.\n`);
      } else if (dbLang === 'ar') {
        console.error(`\n[خطأ] المنفذ ${PORT} مستخدم بالفعل بواسطة تطبيق أو عملية أخرى!`);
        console.error(`يرجى إغلاق عمليات الخادم الخلفية الأخرى أو تغيير المنفذ في configwin.ini.\n`);
      } else { // default to 'tr'
        console.error(`\n[HATA] Port ${PORT} başka bir uygulama veya süreç tarafından kullanılıyor!`);
        console.error(`Lütfen arka plandaki diğer sunucu süreçlerini kapatın veya configwin.ini dosyasından 'port' ayarını değiştirin.\n`);
      }
      process.exit(1);
    } else {
      console.error('Sunucu başlatılırken hata oluştu:', err.message);
      process.exit(1);
    }
  });
}

// Türkçe Açıklama: 7 günden eski log dosyalarını logs klasöründen temizler.
/**
 * 7 günden eski log dosyalarını logs klasöründen temizler.
 */
function cleanOldLogs() {
  try {
    if (!fs.existsSync(logsDir)) return;
    const files = fs.readdirSync(logsDir);
    const now = Date.now();
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    
    let deletedCount = 0;
    for (const file of files) {
      if (file.endsWith('.log')) {
        const filePath = path.join(logsDir, file);
        const stats = fs.statSync(filePath);
        if (now - stats.mtimeMs > sevenDaysMs) {
          fs.unlinkSync(filePath);
          deletedCount++;
        }
      }
    }
    if (deletedCount > 0) {
      console.log(`[Log Cleanup] 7 older than 7 days ${deletedCount} adet log dosyası deleted.`);
    }
  } catch (err) {
    console.error('[Log Cleanup] Log dosyaları temizlenirken Error occurred:', err.message);
  }
}

// Türkçe Açıklama: Standart giriş (stdin) üzerinden gelen komutları dinler ve işler.
process.stdin.setEncoding('utf8');

// Standart giriş kapandığında veya bittiğinde backend sürecini sonlandır (Tray kapatıldığında çalışır)
process.stdin.on('close', () => {
  console.log('[SYSTEM] Standart giriş kapandı (stdin close). Backend sonlandırılıyor...');
  process.exit(0);
});
process.stdin.on('end', () => {
  console.log('[SYSTEM] Standart giriş sona erdi (stdin end). Backend sonlandırılıyor...');
  process.exit(0);
});

process.stdin.on('data', (data) => {
  const line = data.toString().trim();
  if (!line) return;

  const parts = line.split(' ');
  const command = parts[0].toLowerCase();
  const args = parts.slice(1);

  if (command === 'help' || command === '?') {
    console.log('[Console] Available commands:\n' +
                '  - status (Shows application speed and queue status)\n' +
                '  - ton (Activates alternative speed limit (Turtle))\n' +
                '  - toff (Deactivates alternative speed limit (Turtle))\n' +
                '  - pd <link> (Adds video to queue by URL)\n' +
                '  - clear (Clears the terminal screen)');
    return;
  }

  const db = readDb();

  if (command === 'ton') {
    const oldLimit = getEffectiveSpeedLimit(db.settings);
    db.settings.useAlternativeSpeed = true;
    const newLimit = getEffectiveSpeedLimit(db.settings);
    const speedLimitChanged = oldLimit !== newLimit;
    writeDb(db);
    broadcast('db_update', db);
    addTerminalLog(`[Console] Alternative speed limit (Turtle) ENABLED.`, 'info');
    console.log(`[Console] Alternative speed limit (Turtle) ENABLED. Limit: ${newLimit} KB/s`);
    if (speedLimitChanged && downloadQueue.activeProcess && downloadQueue.activeVideoId) {
      restartActiveDownloadWithNewLimit(db, oldLimit, newLimit);
    }
  } else if (command === 'toff') {
    const oldLimit = getEffectiveSpeedLimit(db.settings);
    db.settings.useAlternativeSpeed = false;
    const newLimit = getEffectiveSpeedLimit(db.settings);
    const speedLimitChanged = oldLimit !== newLimit;
    writeDb(db);
    broadcast('db_update', db);
    addTerminalLog(`[Console] Alternative speed limit (Turtle) DISABLED.`, 'info');
    console.log(`[Console] Alternative speed limit (Turtle) DISABLED. Limit: ${newLimit} KB/s`);
    if (speedLimitChanged && downloadQueue.activeProcess && downloadQueue.activeVideoId) {
      restartActiveDownloadWithNewLimit(db, oldLimit, newLimit);
    }
  } else if (command === 'status') {
    const effective = getEffectiveSpeedLimit(db.settings);
    const altStatus = db.settings.useAlternativeSpeed ? 'Active' : 'Inactive';
    console.log(`[Console] Status:
      - Normal Speed Limit: ${db.settings.downloadSpeedLimit} KB/s
      - Alternative Speed Limit: ${db.settings.alternativeSpeedLimit} KB/s
      - Alternative Speed (Turtle) Active: ${altStatus}
      - Effective Speed Limit: ${effective} KB/s
      - Active Download: ${downloadQueue.activeVideoId ? 'Yes' : 'No'}`);
  } else if (command === 'pd') {
    const link = args[0];
    if (!link) {
      console.log('[Console] Error: You must specify a YouTube video link. Example: pd https://www.youtube.com/watch?v=dQw4w9WgXcQ');
      return;
    }
    addVideoToQueueByUrl(link)
      .then(vid => {
        addTerminalLog(`[Console] Video added to queue successfully. ID: ${vid}`, 'success');
        console.log(`[Console] Video added to queue successfully. ID: ${vid}`);
      })
      .catch(err => {
        addTerminalLog(`[Console] Error: ${err.message}`, 'error');
        console.log(`[Console] Error: ${err.message}`);
      });
  } else {
    console.log('[Console] Unknown command. Available commands: ton, toff, pd <video-link>, status, clear, help');
  }
});

// Türkçe Açıklama: Aktif indirmeyi yeni hız sınırı ile yeniden başlatır.
function restartActiveDownloadWithNewLimit(db, oldSpeedLimit, newSpeedLimit) {
  const videoId = downloadQueue.activeVideoId;
  const historyItem = db.history.find(h => h.id === videoId);
  if (historyItem) {
    console.log(`[Ayarlar] Hız sınırı changed (${oldSpeedLimit} -> ${newSpeedLimit}). Aktif indirme with the new speed limitı ile is restartingılıyor: ${historyItem.title}`);
    addTerminalLog(`[Ayarlar] Hız sınırı changed. Aktif indirme with the new speed limitı ile is restartingılıyor: "${historyItem.title}"`, 'info');
    
    downloadQueue.queue.unshift({
      id: videoId,
      title: historyItem.title,
      channelId: historyItem.channelId,
      channelName: historyItem.channelName,
      url: `https://www.youtube.com/watch?v=${videoId}`,
      publishedAt: historyItem.publishedAt || ''
    });
    
    updateHistoryItem(videoId, {
      status: 'waiting',
      progress: historyItem.progress || 0,
      speed: '',
      eta: ''
    });
    
    const proc = downloadQueue.activeProcess;
    const pid = proc.pid;
    
    downloadQueue.activeProcess = null;
    downloadQueue.activeVideoId = null;
    if (downloadQueue.activeDownloads > 0) {
      downloadQueue.activeDownloads--;
    }
    
    exec(`taskkill /F /T /PID ${pid}`, (err) => {
      try {
        proc.kill('SIGKILL');
      } catch (e) {}
      
      setTimeout(() => {
        downloadQueue.process();
      }, 1000);
    });
  }
}
