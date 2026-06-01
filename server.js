/**
 * HaYTool Youtube Download - Sunucu Giriş Noktası
 * 
 * Bu yazılım YouTube kanallarını otomatik izler ve yeni videoları indirir.
 * Yapımcı: HaYTo
 * Destek ve İletişim: korazhayto@gmail.com
 * Lisans: MIT
 */

import express from 'express';
import fs from 'fs';
import path from 'path';
import { spawn, exec, execSync } from 'child_process';
import https from 'https';
import os from 'os';
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
  const timestamp = new Date().toLocaleString('tr-TR');
  const now = new Date();
  const timeStr = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
  const msg = args.map(formatArg).join(' ');
  
  let color = '\x1b[37m'; // White
  let prefix = '[SİSTEM]';
  
  const upperMsg = msg.toUpperCase();
  
  if (upperMsg.includes('[RSS]') || upperMsg.includes('RSS ALINAMADI') || upperMsg.includes('SI RADAKİ KANAL') || upperMsg.includes('FEED')) {
    color = '\x1b[94m'; // Bright Blue
    prefix = '[RSS]';
  } else if (upperMsg.includes('[KUYRUK]') || upperMsg.includes('KUYRUK DURAKLATILDI') || upperMsg.includes('KUYRUK DEVAM ETTİRİLDİ')) {
    color = '\x1b[34m'; // Standard Blue
    prefix = '[KUYRUK]';
  } else if (upperMsg.includes('İNDİRME BAŞLATILIYOR') || upperMsg.includes('KOMUT: YT-DLP')) {
    color = '\x1b[96m'; // Bright Cyan
    prefix = '[İNDİRME]';
  } else if (upperMsg.includes('[AYAR]') || upperMsg.includes('[SYNC]') || upperMsg.includes('[MIGRATION]') || upperMsg.includes('[READDB]') || upperMsg.includes('CONFIG.INI') || upperMsg.includes('VERİTABAN') || upperMsg.includes('AYARLAR') || upperMsg.includes('HIZ SINIRI DEĞİŞTİ') || upperMsg.includes('KLASÖR SİMGESİ') || upperMsg.includes('DOSYASI BAŞARIYLA OLUŞTURULDU')) {
    color = '\x1b[95m'; // Bright Magenta
    prefix = '[AYARLAR]';
  } else if (upperMsg.includes('İNDİRME TAMAMLANDI') || upperMsg.includes('TAMAMLANDI') || upperMsg.includes('BAŞARIYLA OLUŞTURULDU') || upperMsg.includes('BAŞARIYLA KURULDU') || upperMsg.includes('BAŞARIYLA GÜNCELLE') || upperMsg.includes('BAŞARIYLA TAŞINDI') || upperMsg.includes('BAŞARIYLA ÇÖZÜMLENDİ')) {
    color = '\x1b[92m'; // Bright Green
    prefix = '[BAŞARILI]';
  } else if (upperMsg.includes('SUNUCU') || upperMsg.includes('LISTEN') || upperMsg.includes('PORT') || upperMsg.includes('API')) {
    color = '\x1b[36m'; // Standard Cyan
    prefix = '[SUNUCU]';
  } else if (upperMsg.includes('UYARI') || upperMsg.includes('WARNING') || upperMsg.includes('DURAKLATILDI') || upperMsg.includes('PAUSED') || upperMsg.includes('KİLİTLİ') || upperMsg.includes('ZATEN MEVCUT')) {
    color = '\x1b[93m'; // Bright Yellow
    prefix = '[UYARI]';
  } else if (upperMsg.includes('HATA') || upperMsg.includes('FAIL') || upperMsg.includes('ERROR') || upperMsg.includes('BAŞARISIZ') || upperMsg.includes('İPTAL')) {
    color = '\x1b[91m'; // Bright Red
    prefix = '[HATA]';
  } else if (upperMsg.includes('[YT-DLP]')) {
    color = '\x1b[90m'; // Bright Black / Gray
    prefix = '[YT-DLP]';
  } else if (upperMsg.includes('EKSİK BİLGİLER ÇÖZÜMLENİYOR') || upperMsg.includes('ÇÖZÜMLENECEK ADRES') || upperMsg.includes('VİDEO URL\'Sİ TESPİT EDİLDİ') || upperMsg.includes('FETCHVIDEODURATION') || upperMsg.includes('SHORT VIDEO DETECTED') || upperMsg.includes('UPCOMING VIDEO DETECTED') || upperMsg.includes('LIVE VIDEO DETECTED')) {
    color = '\x1b[35m'; // Standard Magenta / Purple
    prefix = '[ANALİZ]';
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
  
  originalError(`\x1b[90m[${timeStr}]\x1b[0m \x1b[91m[HATA] ${msg}\x1b[0m`);
  writeToLogFile(`[${timestamp}] [HATA] ${msg}`);
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
const ytdlpPath = path.join(__dirname, os.platform() === 'win32' ? 'yt-dlp.exe' : 'yt-dlp');
const defaultDownloadDir = path.join(os.homedir(), 'Downloads', 'YouTubeAutoDownloads');

// Determing port from config.ini early
let PORT = 3000;
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
            PORT = parseInt(val, 10) || 3000;
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
    downloadPath: defaultDownloadDir,
    browser: 'chrome', // chrome, edge, firefox, brave, opera, none
    quality: 'best',   // best, 1080p, 720p
    channelCheckInterval: 60, // kanallar arası denetim sıklığı (saniye, varsayılan 60)
    autoDownload: true,
    showShorts: false, // varsayılan olarak Shorts videolarını kütüphanede gösterme
    rssLimit: 5,       // varsayılan 5
    autoDeleteDays: 0, // varsayılan 0
    theme: 'dark',
    shortsMigrationDone: false,
    downloadSpeedLimit: 0,
    port: 3000,
    playerPreference: 'system',
    lang: 'tr',
    isPaused: false, // İndirme kuyruğunun duraklatılma durumu
    showNotifications: true, // Windows masaüstü bildirimlerinin gösterilme durumu
    autoOpenBrowser: true // Başlangıçta tarayıcıda localhost sayfasını otomatik açma durumu
  }
};

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
function writeIni(filePath, data) {
  let content = '; HaYTool Youtube Download Yapilandirma Dosyasi\n';
  content += '; Bu dosya arayuzdeki Ayarlar veya Kanallar degistikce otomatik guncellenir.\n\n';
  for (const section in data) {
    content += `[${section}]\n`;
    for (const key in data[section]) {
      content += `${key} = ${data[section][key]}\n`;
    }
    content += '\n';
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
    console.log('logo.ico dosyası başarıyla oluşturuldu.');
  } catch (err) {
    console.error('logo.ico oluşturulurken hata oluştu:', err.message);
  }
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
        console.error('Kanal klasörü oluşturulamadı:', err.message);
        return resolve('');
      }
    }

    https.get(url, (res) => {
      if (res.statusCode !== 200) {
        return resolve('');
      }
      const fileStream = fs.createWriteStream(destPath);
      res.pipe(fileStream);
      fileStream.on('finish', () => {
        fileStream.close();
        console.log(`[AYAR] Kanal logosu indirildi: ${channelName} -> avatar.jpg`);
        
        // Kanal klasörü için klasör ikonu ayarlama işlevini tetikle
        setFolderIcon(channelDir, destPath);
        
        resolve(destPath);
      });
      fileStream.on('error', (err) => {
        fs.unlink(destPath, () => {});
        resolve('');
      });
    }).on('error', () => {
      resolve('');
    });
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
    
    console.log(`[AYAR] Klasör simgesi başarıyla güncellendi: ${folderPath}`);
  } catch (err) {
    console.error('Klasör simgesi ayarlanırken hata oluştu:', err.message);
  }
}


/**
 * INI yapılandırma dosyalarındaki (configwin.ini/configunix.ini, channels.ini) verileri okur
 * ve ana veritabanı (db.json) nesnesi ile senkronize eder.
 * 
 * @param {object} db Senkronize edilecek veritabanı nesnesi
 */
function syncWithIni(db) {
  // logo.ico kontrolü
  const pngPath = path.join(__dirname, 'public', 'logo.png');
  const icoPath = path.join(__dirname, 'logo.ico');
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
      console.error('[Migration] Eski config.ini taşınırken hata oluştu:', e.message);
    }
  }

  // Typo kurtarma ve migrasyon (config.inilş -> config.ini ve channels.ini)
  const configIniTypoPath = path.join(__dirname, 'config.inilş');
  let migratedSettings = null;
  let migratedChannels = null;
  if (fs.existsSync(configIniTypoPath)) {
    console.log('[Migration] Hatalı isimlendirilmiş config.inilş tespit edildi. Göç işlemi başlatılıyor...');
    try {
      const typoData = parseIni(configIniTypoPath);
      migratedSettings = getCaseInsensitiveKey(typoData, 'Settings');
      migratedChannels = getCaseInsensitiveKey(typoData, 'Channels');
      fs.unlinkSync(configIniTypoPath); // Göç sonrası sil
      console.log('[Migration] config.inilş başarıyla taşındı ve silindi.');
    } catch (e) {
      console.error('[Migration] Hata:', e.message);
    }
  }

  // 1. config.ini (Ayarlar) Eşitlemesi
  if (!fs.existsSync(configIniPath)) {
    console.log(`[Sync] ${configIniName} bulunamadı. Mevcut ayarlarla oluşturuluyor.`);
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

      const theme = getCaseInsensitiveKey(settingsSection, 'theme');
      if (theme !== undefined) db.settings.theme = theme;

      const port = getCaseInsensitiveKey(settingsSection, 'port');
      if (port !== undefined) {
        db.settings.port = parseInt(port, 10) || 3000;
      }

      const playerPreference = getCaseInsensitiveKey(settingsSection, 'playerPreference');
      if (playerPreference !== undefined) {
        db.settings.playerPreference = playerPreference; // 'system' or 'embedded'
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

      if (parts.length >= 6) {
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
      
      updatedChannels.push({ id, name, handle: handleOrUrl, addedAt, quality, downloadShorts, avatar: finalAvatar });
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
  iniData.Settings.channelCheckInterval = (db.settings.channelCheckInterval || 60).toString();
  iniData.Settings.autoDownload = db.settings.autoDownload.toString();
  iniData.Settings.mergeType = (db.settings.mergeType || 'single').toString();
  iniData.Settings.writeThumbnail = (db.settings.writeThumbnail !== false).toString();
  iniData.Settings.showShorts = (db.settings.showShorts !== false).toString();
  iniData.Settings.rssLimit = (db.settings.rssLimit || 5).toString();
  iniData.Settings.autoDeleteDays = (db.settings.autoDeleteDays || 0).toString();
  iniData.Settings.theme = (db.settings.theme || 'dark').toString();
  iniData.Settings.downloadSpeedLimit = (db.settings.downloadSpeedLimit || 0).toString();
  iniData.Settings.port = (db.settings.port || 3000).toString();
  iniData.Settings.playerPreference = (db.settings.playerPreference || 'system').toString();
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
    iniData.Channels[channel.id] = `${channel.name} | ${channelUrl} | ${channel.addedAt} | ${channel.quality || 'default'} | ${channel.downloadShorts !== false} | ${channel.avatar || ''}`;
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
    
    // Diskten el ile silinen veya başka platformda olan dosyaları kontrol et ve veritabanını güncelle
    let dbUpdated = false;
    if (db.history && db.history.length > 0) {
      for (const item of db.history) {
        if (item.status === 'completed') {
          let exists = item.filePath && fs.existsSync(item.filePath);
          if (!exists) {
            // Klasörde video ID'sini içeren dosyayı dinamik bulmayı dene (örn. downloadPath değiştiyse veya dosya taşındıysa)
            const foundPath = findVideoFileInDownloadDir(item.id, db.settings.downloadPath);
            if (foundPath) {
              item.filePath = foundPath;
              exists = true;
              dbUpdated = true;
              console.log(`[ReadDB] Video dosyası yeni konumda tespit edildi: ${item.title} -> ${foundPath}`);
            }
          }
          if (exists) {
            if (item.fileMissing) {
              item.fileMissing = false;
              dbUpdated = true;
            }
            // Türkçe Açıklama: Disk üzerindeki gerçek dosya boyutunu okur ve veritabanını günceller.
            try {
              const stats = fs.statSync(item.filePath);
              const sizeInBytes = stats.size;
              let calculatedSize = '';
              if (sizeInBytes >= 1024 * 1024 * 1024) {
                calculatedSize = (sizeInBytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
              } else {
                calculatedSize = (sizeInBytes / (1024 * 1024)).toFixed(2) + ' MB';
              }
              if (item.fileSize !== calculatedSize) {
                item.fileSize = calculatedSize;
                dbUpdated = true;
              }
            } catch (err) {
              console.error(`Boyut okuma hatası: ${item.title}`, err.message);
            }
          } else {
            // Türkçe Açıklama: Dosya diskte bulunamadı. Veriyi kaybetmemek (dual boot vb.) için silmiyoruz, sadece fileMissing = true yapıyoruz.
            if (!item.fileMissing) {
              item.fileMissing = true;
              dbUpdated = true;
              console.log(`[ReadDB] Video dosyası diskte bulunamadı (geçici olabilir): ${item.title}`);
            }
          }
        } else if (item.status === 'ignored' || item.status === 'failed') {
          // Türkçe Açıklama: Otomatik Onarma (Healing) - Eğer ignored/failed durumundaki video diskte fiziksel olarak mevcutsa, durumunu tamamlandı olarak geri yükle.
          const foundPath = findVideoFileInDownloadDir(item.id, db.settings.downloadPath);
          if (foundPath) {
            item.status = 'completed';
            item.filePath = foundPath;
            item.fileMissing = false;
            dbUpdated = true;
            console.log(`[ReadDB] Ignored/Failed video diskte bulundu, 'completed' olarak geri yüklendi: ${item.title} -> ${foundPath}`);
            
            // Boyutunu da hesapla
            try {
              const stats = fs.statSync(foundPath);
              const sizeInBytes = stats.size;
              let calculatedSize = '';
              if (sizeInBytes >= 1024 * 1024 * 1024) {
                calculatedSize = (sizeInBytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
              } else {
                calculatedSize = (sizeInBytes / (1024 * 1024)).toFixed(2) + ' MB';
              }
              item.fileSize = calculatedSize;
            } catch (err) {
              console.error(`Boyut okuma hatası: ${item.title}`, err.message);
            }
          }
        }
      }
    }

    if (dbUpdated) {
      fs.writeFileSync(dbPath, JSON.stringify(db, null, 2), 'utf8');
    }
    
    return db;
  } catch (err) {
    console.error('Veritabanı okuma hatası:', err);
    return defaultDb;
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

    console.log(`${filename} bulunamadı. Resmi kaynaktan indiriliyor...`);
    broadcast('status_log', { message: `${filename} bulunamadı, indiriliyor... Lütfen bekleyin.`, type: 'info' });

    const downloadUrl = os.platform() === 'win32'
      ? 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe'
      : 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp';
    
    function download(url) {
      https.get(url, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302) {
          // Yönlendirmeyi takip et
          download(res.headers.location);
          return;
        }

        if (res.statusCode !== 200) {
          const err = new Error(`İndirme başarısız: HTTP ${res.statusCode}`);
          broadcast('status_log', { message: `yt-dlp indirme hatası: ${err.message}`, type: 'error' });
          reject(err);
          return;
        }

        const fileStream = fs.createWriteStream(ytdlpPath);
        res.pipe(fileStream);

        fileStream.on('finish', () => {
          fileStream.close();
          console.log('yt-dlp.exe başarıyla indirildi.');
          broadcast('status_log', { message: 'yt-dlp.exe başarıyla kuruldu!', type: 'success' });
          resolve(ytdlpPath);
        });

        fileStream.on('error', (err) => {
          fs.unlink(ytdlpPath, () => {});
          broadcast('status_log', { message: `yt-dlp dosyaya yazma hatası: ${err.message}`, type: 'error' });
          reject(err);
        });
      }).on('error', (err) => {
        broadcast('status_log', { message: `Bağlantı hatası: ${err.message}`, type: 'error' });
        reject(err);
      });
    }

    download(downloadUrl);
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

  // Türkçe Açıklama: Bildirim başlığı ve mesajındaki tek tırnakları PowerShell tek tırnaklı dize formatına uygun şekilde çift tek tırnakla kaçırıyoruz.
  const escapedTitle = title.replace(/'/g, "''");
  const escapedMessage = message.replace(/'/g, "''");

  const psScript = `
    [void] [System.Reflection.Assembly]::LoadWithPartialName('System.Windows.Forms');
    $notification = New-Object System.Windows.Forms.NotifyIcon;
    $notification.Icon = [System.Drawing.SystemIcons]::Information;
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

// FFmpeg (Ses/Video Birleştirici) Otomatik İndirici
let isFfmpegDownloading = false;
function ensureFfmpeg() {
  const ffmpegPath = getFfmpegPath();
  if (fs.existsSync(ffmpegPath)) return Promise.resolve(ffmpegPath);
  
  if (isFfmpegDownloading) return Promise.reject(new Error('FFmpeg zaten indiriliyor.'));
  isFfmpegDownloading = true;
  
  console.log('FFmpeg bulunamadı. İnternetten indiriliyor...');
  broadcast('status_log', { message: 'Yüksek kaliteli indirmeler için FFmpeg (Ses/Video Birleştirici) arka planda indiriliyor... Lütfen bekleyin.', type: 'info' });
  
  return new Promise((resolve, reject) => {
    const psCommand = [
      `$ErrorActionPreference = 'Stop'`,
      `[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12`,
      `Remove-Item -Path 'ffmpeg.zip' -ErrorAction SilentlyContinue`,
      `Remove-Item -Recurse -Force 'ffmpeg_temp' -ErrorAction SilentlyContinue`,
      `Invoke-WebRequest -Uri 'https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip' -OutFile 'ffmpeg.zip'`,
      `Expand-Archive -Path 'ffmpeg.zip' -DestinationPath 'ffmpeg_temp'`,
      `New-Item -ItemType Directory -Force -Path 'ffmpeg' | Out-Null`,
      `Get-ChildItem -Path 'ffmpeg_temp' -Recurse -Filter 'ffmpeg.exe' | Copy-Item -Destination 'ffmpeg'`,
      `Get-ChildItem -Path 'ffmpeg_temp' -Recurse -Filter 'ffprobe.exe' | Copy-Item -Destination 'ffmpeg'`,
      `Remove-Item -Recurse -Force 'ffmpeg_temp', 'ffmpeg.zip'`
    ].join('; ');
    
    exec(`powershell -Command "${psCommand}"`, (error, stdout, stderr) => {
      isFfmpegDownloading = false;
      if (error) {
        console.error('FFmpeg indirme hatası:', error, stderr);
        broadcast('status_log', { message: `FFmpeg kurulumu başarısız: ${error.message}`, type: 'error' });
        reject(error);
      } else {
        console.log('FFmpeg başarıyla kuruldu.');
        broadcast('status_log', { message: 'FFmpeg başarıyla kuruldu! Artık tek parça yüksek çözünürlüklü (1080p, 4K vb.) videolar indirebilirsiniz.', type: 'success' });
        resolve(getFfmpegPath());
      }
    });
  });
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
function isShortDuration(durationStr) {
  if (!durationStr) return false;
  const parts = durationStr.split(':').map(Number);
  
  if (parts.length === 1) {
    return parts[0] <= 180;
  } else if (parts.length === 2) {
    const minutes = parts[0];
    const seconds = parts[1];
    const totalSeconds = (minutes * 60) + seconds;
    return totalSeconds <= 180;
  }
  return false;
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
          if (result.publishedAt && needsPublishDate) {
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
          
          // Türkçe Açıklama: Süre çözülemediğinde sonsuz döngüyü önlemek için deneme sayısı artırılır. 3 başarısız denemeden sonra '-' olarak işaretlenir.
          if (!result.duration && needsDuration) {
            item.resolveAttempts = (item.resolveAttempts || 0) + 1;
            if (item.resolveAttempts >= 3) {
              item.duration = '-';
            }
            itemUpdated = true;
          }
        } else {
          item.resolveAttempts = (item.resolveAttempts || 0) + 1;
          if (item.resolveAttempts >= 3) {
            item.duration = '-';
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
          item.duration = '-';
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
            addTerminalLog(`[Oto-Silme] ${autoDeleteDays} günden eski olan "${item.title}" videosu diskten otomatik olarak silindi.`, 'info');
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
  
  return new Promise((resolve, reject) => {
    const db = readDb();
    const langHeader = db.settings.lang === 'en' ? 'en-US,en;q=0.9' : 'tr-TR,tr;q=0.9';

    function fetchUrl(currentUrl, redirectCount = 0) {
      if (redirectCount > 5) {
        return reject(new Error('Çok fazla yönlendirme algılandı.'));
      }

      // Türkçe Açıklama: currentUrl içindeki Türkçe karakterler için new URL ile otomatik IDN ve pathname kodlamasını sağlıyoruz.
      let urlObj;
      try {
        urlObj = new URL(currentUrl);
      } catch (e) {
        return reject(new Error('Geçersiz URL formatı.'));
      }

      https.get(urlObj, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept-Language': langHeader
        }
      }, (res) => {
        // Yönlendirmeleri (301, 302, 307, 308) takip et
        if (res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 307 || res.statusCode === 308) {
          let location = res.headers.location;
          if (!location.startsWith('http')) {
            location = urlObj.origin + location;
          }
          fetchUrl(location, redirectCount + 1);
          return;
        }

        if (res.statusCode !== 200) {
          return reject(new Error(`YouTube sunucu hatası: HTTP ${res.statusCode}`));
        }

        let html = '';
        res.on('data', chunk => { html += chunk; });
        res.on('end', () => {
          let channelId = null;
          let channelName = null;

          if (isVideoUrl) {
            // Video sayfasından yükleyici kanal bilgilerini çıkar
            channelId = html.match(/"externalChannelId"\s*:\s*"(UC[a-zA-Z0-9_-]{22})"/)?.[1] ||
                        html.match(/"channelId"\s*:\s*"(UC[a-zA-Z0-9_-]{22})"/)?.[1] ||
                        html.match(/\/channel\/(UC[a-zA-Z0-9_-]{22})/)?.[1];
            
            channelName = html.match(/<link itemprop="name" content="([^"]+)"/)?.[1] ||
                          html.match(/"author"\s*:\s*"([^"]+)"/)?.[1];
          } else {
            // Türkçe Açıklama: Kanal ID tespit ederken ilk önce sayfanın ana kanal ID meta etiketlerine öncelik veriyoruz, böylece sayfada önerilen başka kanalların ID'lerinin eşleşmesini engelliyoruz.
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

          // Kanal profil resmini html içindeki avatarViewModel nesnesinden çöz
          const avatarMatch = html.match(/"avatarViewModel"\s*:\s*\{\s*"image"\s*:\s*\{\s*"sources"\s*:\s*\[\s*\{\s*"url"\s*:\s*"([^"]+)"/);
          const avatarUrl = avatarMatch ? avatarMatch[1] : '';

          // Türkçe Açıklama: Kanalın handle adını vanityChannelUrl üzerinden çözümlüyoruz.
          const vanityMatch = html.match(/"vanityChannelUrl"\s*:\s*"https?:\/\/www\.youtube\.com\/(@[^"]+)"/);
          const handleVal = vanityMatch ? vanityMatch[1] : '';

          if (channelId && channelName) {
            console.log(`Başarıyla çözümlendi: Kanal: ${channelName} (ID: ${channelId})`);
            resolve({ id: channelId, name: channelName, avatar: avatarUrl, handle: handleVal });
          } else {
            reject(new Error('Kanal ID veya kanal adı tespit edilemedi. Lütfen adresi kontrol edin.'));
          }
        });
      }).on('error', (err) => {
        reject(err);
      });
    }

    fetchUrl(targetUrl);
  });
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
  clients.forEach(client => {
    client.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
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
        console.error('İndirme klasörü oluşturulamadı:', err);
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
      console.log('[Kuyruk] Kuyruk duraklatıldı. Bir sonraki indirme bekletiliyor.');
      return;
    }

    // Türkçe Açıklama: Emniyet kontrolü - Aktif bir indirme süreci yoksa ancak sayaç sıfırlanmamışsa otomatik olarak düzelt.
    if (!this.activeProcess && this.activeDownloads > 0) {
      console.log(`[Kuyruk Emniyeti] Aktif süreç bulunamadı fakat activeDownloads = ${this.activeDownloads}. Sayaç sıfırlanıyor.`);
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
    addTerminalLog(`[Kuyruk] "${video.title}" videosu için indirme işlemi başlatıldı.`, 'info');
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
        console.error('Kanal klasörü oluşturulamadı:', err);
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
    if (settings.downloadSpeedLimit && settings.downloadSpeedLimit > 0) {
      args.push('--limit-rate', `${settings.downloadSpeedLimit}K`);
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

    // Çözünürlük ve Birleştirme Ayarı
    if (settings.mergeType === 'single') {
      // Tek dosya (ffmpeg gerekmez)
      if (videoQuality === '1080p') {
        args.push('-f', 'best[height<=1080]/best');
      } else if (videoQuality === '720p') {
        args.push('-f', 'best[height<=720]/best');
      } else {
        args.push('-f', 'best');
      }
    } else if (settings.mergeType === 'separate') {
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
    }

    // Kapak Resmi İndirme Ayarı
    if (settings.writeThumbnail) {
      args.push('--write-thumbnail');
      if (fs.existsSync(getFfmpegPath())) {
        args.push('--convert-thumbnails', 'jpg');
      }
    }

    // Eğer yerel dizinde veya subfolder'da ffmpeg.exe varsa yt-dlp'ye bunun konumunu bildir
    if (fs.existsSync(getFfmpegPath())) {
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

      if (isFfmpegProgress || isFfmpegOpening || isFfmpegInfo || isFfmpegConnection) {
        // Türkçe Açıklama: FFmpeg'in ilerleme, açılış ve bağlantı durumu logları CMD konsolunda gürültü yapmaması için es geçiliyor.
        return;
      }

      const isWarning = trimmed.toLowerCase().includes('warning:') || trimmed.toLowerCase().includes('uyari:');
      if (isWarning) {
        console.log(`yt-dlp uyarı satırı: ${trimmed}`);
        addTerminalLog(`[yt-dlp Uyarı] ${trimmed}`, 'warning');
      } else {
        console.error(`yt-dlp hata satırı: ${trimmed}`);
        addTerminalLog(`[yt-dlp Hata] ${trimmed}`, 'error');
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
        addTerminalLog(`[Kuyruk] İndirme kullanıcı tarafından iptal edildi: "${video.title}"`, 'warning');
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
              calculatedSize = (sizeInBytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
            } else {
              calculatedSize = (sizeInBytes / (1024 * 1024)).toFixed(2) + ' MB';
            }
          }
        } catch (err) {
          console.error(`Boyut okuma hatası: ${resolvedTitle}`, err.message);
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
        console.log(`İndirme tamamlandı: ${resolvedTitle}`);
        broadcast('status_log', { message: `İndirme tamamlandı: ${resolvedTitle}`, type: 'success' });
        addTerminalLog(`[Kuyruk] İndirme BAŞARILI: "${resolvedTitle}" -> Dosya Yol: ${actualPath}`, 'success');
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
        console.error(`İndirme başarısız: ${video.title} - Kod: ${code}`);
        broadcast('status_log', { message: `İndirme başarısız: ${video.title}`, type: 'error' });
        addTerminalLog(`[Kuyruk] İndirme BAŞARISIZ: "${video.title}" - Hata: ${userFriendlyError || `Hata Kodu: ${code}`}`, 'error');
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
  return new Promise((resolve, reject) => {
    const nodePathEscaped = process.execPath.replace(/\\/g, '/');
    const cmd = `"${ytdlpPath}" --js-runtimes "node:${nodePathEscaped}" --flat-playlist --playlist-end ${limit} --dump-json "https://www.youtube.com/channel/${channelId}"`;
    exec(cmd, (err, stdout, stderr) => {
      if (err) {
        return reject(err);
      }
      
      const items = [];
      const lines = stdout.split('\n');
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const video = JSON.parse(line.trim());
          if (video && video.id) {
            // Yükleme tarihi için yt-dlp flat-playlist çıktısındaki timestamp veya upload_date alanlarını ayrıştır
            let isoDate = '';
            if (video.timestamp) {
              isoDate = new Date(video.timestamp * 1000).toISOString();
            } else if (video.upload_date) {
              const yr = video.upload_date.slice(0, 4);
              const mo = video.upload_date.slice(4, 6);
              const dy = video.upload_date.slice(6, 8);
              isoDate = new Date(`${yr}-${mo}-${dy}T00:00:00.000Z`).toISOString();
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
      
      resolve({ items });
    });
  });
}

/**
 * Takip edilen tüm kanalların RSS akışlarını veya yt-dlp yedek planını kullanarak yeni video denetlemesini gerçekleştirir.
 * 
 * @param {boolean} isFirstStart Sunucunun veya kanalın ilk kez eklenip eklenmediği bilgisi (İlk eklemede eski videolar indirilmez)
 */
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
    const feedUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${channel.id}`;
    let feed = null;

    try {
      feed = await parser.parseURL(feedUrl);
    } catch (rssErr) {
      console.log(`[RSS] ${channel.name} için RSS alınamadı (${rssErr.message}). yt-dlp yedek mekanizması başlatılıyor...`);
      addTerminalLog(`[RSS] ${channel.name} RSS hatası aldı (${rssErr.message}). yt-dlp ile denetleniyor...`, 'info');
      try {
        feed = await fetchChannelVideosYtdlp(channel.id, rssLimit);
      } catch (ytdlpErr) {
        console.error(`[RSS] [HATA] ${channel.name} yt-dlp ile de denetlenemedi:`, ytdlpErr.message);
      }
    }

    if (feed && feed.items) {
      console.log(`Kanal denetleniyor: ${channel.name} (${feed.items.length} video)`);
      
      const itemsToCheck = feed.items.slice(0, rssLimit);
      const reversedItems = [...itemsToCheck].reverse();

      for (const item of reversedItems) {
        // Video ID'sini linkten çıkar
        const videoId = item.link.match(/v=([^&]+)/)?.[1] || item.id.replace('yt:video:', '');
        
        // Geçmişte bu video kayıtlı mı kontrol et
        const existingHistory = db.history.find(h => h.id === videoId);
        const isAlreadyProcessed = !!existingHistory;

        if (isAlreadyProcessed) {
          // Video zaten kayıtlı, ama durumu 'upcoming' ise kontrol et
          if (existingHistory.status === 'upcoming' || existingHistory.duration === 'upcoming') {
            try {
              const result = await fetchVideoDuration(videoId);
              if (result && result.duration && result.duration !== 'upcoming') {
                console.log(`[RSS] Upcoming video is now published: ${item.title}`);
                addTerminalLog(`[RSS] Yaklaşan/Prömiyer video artık yayında: "${item.title}" (${channel.name})`, 'info');
                
                existingHistory.duration = result.duration;
                if (result.publishedAt) {
                  existingHistory.publishedAt = result.publishedAt;
                }
                
                if (db.settings.autoDownload) {
                  const channelConfig = db.channels.find(c => c.id === channel.id);
                  const downloadShorts = channelConfig ? channelConfig.downloadShorts !== false : true;
                  
                  let shouldDownload = true;
                  if (!downloadShorts && isShortDuration(result.duration)) {
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
              console.error(`Error checking upcoming video status for ${videoId}:`, e.message);
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
            // otomatik indirme yapmayıp geçmişe 'ignored' olarak kaydediyoruz.
            db.history.push({
              id: videoId,
              title: item.title,
              channelId: channel.id,
              channelName: channel.name,
              downloadedAt: new Date().toISOString(),
              publishedAt: publishDateStr || new Date().toISOString(),
              status: 'ignored',
              progress: 0,
              fileSize: '',
              filePath: ''
            });
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
              // Gerçek tarihi kanal eklenme tarihinden eski, indirmeyip geçmişe 'ignored' olarak kaydediyoruz.
              db.history.push({
                id: videoId,
                title: resolvedTitle,
                channelId: channel.id,
                channelName: resolvedChannelName,
                downloadedAt: new Date().toISOString(),
                publishedAt: actualPublishDate,
                status: 'ignored',
                progress: 0,
                fileSize: '',
                filePath: '',
                duration: duration
              });
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
            } else if (db.settings.autoDownload) {
              const channelConfig = db.channels.find(c => c.id === channel.id);
              const downloadShorts = channelConfig ? channelConfig.downloadShorts !== false : true;

              let shouldDownload = true;
              if (!downloadShorts && isShortDuration(duration)) {
                shouldDownload = false;
                console.log(`Short video detected and channel doesn't allow shorts. Ignoring: ${resolvedTitle}`);
                addTerminalLog(`[RSS] Shorts videosu algılandı ve kanal ayarı gereği indirilmeyip göz ardı edildi: "${resolvedTitle}" (${resolvedChannelName})`, 'info');
              }

              if (shouldDownload) {
                console.log(`Yeni video algılandı! Kuyruğa ekleniyor: ${resolvedTitle}`);
                broadcast('status_log', { message: `Yeni video yüklendi: ${resolvedChannelName} - ${resolvedTitle}`, type: 'info' });
                addTerminalLog(`[RSS] Yeni video tespit edildi: "${resolvedTitle}" (${resolvedChannelName}) -> Kuyruğa ekleniyor.`, 'info');
                
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
              } else {
                db.history.push({
                  id: videoId,
                  title: resolvedTitle,
                  channelId: channel.id,
                  channelName: resolvedChannelName,
                  downloadedAt: new Date().toISOString(),
                  publishedAt: actualPublishDate,
                  status: 'ignored',
                  progress: 0,
                  fileSize: '',
                  filePath: '',
                  duration: duration
                });
                writeDb(db);
              }
            } else {
              db.history.push({
                id: videoId,
                title: resolvedTitle,
                channelId: channel.id,
                channelName: resolvedChannelName,
                downloadedAt: new Date().toISOString(),
                publishedAt: actualPublishDate,
                status: 'ignored',
                progress: 0,
                fileSize: '',
                filePath: '',
                duration: duration
              });
              writeDb(db);
            }
          }
        }
      }
    }
  } catch (err) {
    console.error(`${channel.name} kontrol edilirken hata oluştu:`, err);
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
    console.log(`[RSS] Sıradaki kanal denetleniyor (${currentChannelIndex + 1}/${sortedChannels.length}): ${channel.name}`);
    addTerminalLog(`[RSS] Sıradaki kanal denetleniyor: "${channel.name}"`, 'info');

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
  console.log(`RSS kanal kontrol döngüsü başlatıldı. Sıklık: 1 kanal / ${seconds} saniye.`);
  
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
  
  console.log('[Kuyruk] Kullanıcı isteğiyle kuyruk duraklatıldı.');
  addTerminalLog('[Kuyruk] İndirme sırası duraklatıldı.', 'warning');
  
  // Aktif indirme varsa, durdurup kuyruğun başına ekleyelim
  if (downloadQueue.activeProcess && downloadQueue.activeVideoId) {
    const videoId = downloadQueue.activeVideoId;
    const historyItem = db.history.find(h => h.id === videoId);
    
    if (historyItem) {
      console.log(`[Kuyruk] Aktif indirme durdurulup sıraya geri ekleniyor: ${historyItem.title}`);
      addTerminalLog(`[Kuyruk] Aktif indirme durdurulup sıraya geri ekleniyor: "${historyItem.title}"`, 'info');
      
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
  
  console.log('[Kuyruk] Kullanıcı isteğiyle kuyruk devam ettirildi.');
  addTerminalLog('[Kuyruk] İndirme sırası devam ettirildi.', 'success');
  
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
  
  console.log('[Kuyruk] Sürükle-bırak kuyruk yeniden sıralama isteği alındı.');
  
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
  
  addTerminalLog('[Kuyruk] İndirme sırası yeniden düzenlendi.', 'info');
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
  const oldSpeedLimit = db.settings.downloadSpeedLimit;
  const newSpeedLimit = req.body.downloadSpeedLimit !== undefined ? parseInt(req.body.downloadSpeedLimit, 10) : undefined;
  const speedLimitChanged = newSpeedLimit !== undefined && newSpeedLimit !== oldSpeedLimit;

  db.settings = { ...db.settings, ...req.body };
  writeDb(db);
  startIntervalTimer(); // Süre değiştiyse zamanlayıcıyı güncelle
  broadcast('db_update', db);

  // Türkçe Açıklama: Aktif indirme varken hız sınırı değiştirilirse, indirme sürecini sonlandırıp yeni sınırla sıranın başına ekleyerek yeniden başlatıyoruz.
  if (speedLimitChanged && downloadQueue.activeProcess && downloadQueue.activeVideoId) {
    const videoId = downloadQueue.activeVideoId;
    const historyItem = db.history.find(h => h.id === videoId);
    if (historyItem) {
      console.log(`[Ayarlar] Hız sınırı değişti (${oldSpeedLimit} -> ${newSpeedLimit}). Aktif indirme yeni hız sınırı ile yeniden başlatılıyor: ${historyItem.title}`);
      addTerminalLog(`[Ayarlar] Hız sınırı değişti. Aktif indirme yeni hız sınırı ile yeniden başlatılıyor: "${historyItem.title}"`, 'info');
      
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
    ensureFfmpeg().catch(e => console.error('FFmpeg otomatik indirme hatası:', e.message));
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
      avatar: channelInfo.avatar || ''
    };
    db.channels.push(newChannel);

    writeDb(db);
    
    // Türkçe Açıklama: Kanal eklendikten sonra profil resmi yerel klasöre indirilir.
    if (channelInfo.avatar) {
      await downloadChannelAvatar(channelInfo.avatar, channelInfo.name);
    }

    broadcast('db_update', db);
    broadcast('status_log', { message: `${channelInfo.name} kanalı başarıyla eklendi.`, type: 'success' });
    addTerminalLog(`[Kanal] Kanal takip listesine eklendi: "${channelInfo.name}" (ID: ${channelInfo.id})`, 'success');
    
    // Kanalın geçmiş videolarını "ignored" olarak işaretle ki hepsi birden inmesin
    await checkSingleChannelRss(newChannel, true);

    res.json({ success: true, channel: channelInfo });
  } catch (err) {
    addTerminalLog(`[Kanal] Kanal ekleme hatası (Giriş: "${input}") - Hata: ${err.message}`, 'error');
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
  addTerminalLog(`[Kanal] Kanal takipten çıkarıldı: "${channel.name}" (ID: ${id})`, 'warning');
  res.json({ success: true });
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
      
    addTerminalLog(`[Kanal] Kanal logosu güncelleniyor: "${channel.name}"`, 'info');
    const info = await resolveChannelId(channelUrl);
    if (info && info.avatar) {
      channel.avatar = info.avatar;
      
      // Türkçe Açıklama: Logo güncellendiğinde yerel avatar dosyasını ve klasör simgesini güncelleriz.
      await downloadChannelAvatar(info.avatar, channel.name);
      
      writeDb(db);
      broadcast('db_update', db);
      broadcast('status_log', { message: `${channel.name} kanal logosu güncellendi.`, type: 'success' });
      addTerminalLog(`[Kanal] Kanal logosu başarıyla güncellendi: "${channel.name}"`, 'success');
      return res.json({ success: true, avatar: info.avatar });
    } else {
      throw new Error('Profil resmi bulunamadı.');
    }
  } catch (err) {
    addTerminalLog(`[Kanal] Kanal logosu güncellenemedi: "${channel.name}" - Hata: ${err.message}`, 'error');
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

  addTerminalLog('[Kanal] Toplu kanal logosu güncellemesi başlatıldı...', 'info');
  console.log('[Kanal] Toplu kanal logosu güncellemesi başlatıldı...');
  
  let updatedCount = 0;
  let failedCount = 0;

  for (const channel of db.channels) {
    try {
      const channelUrl = channel.handle && channel.handle.startsWith('http') 
        ? channel.handle 
        : `https://www.youtube.com/${channel.handle && channel.handle.startsWith('@') ? channel.handle : '@' + channel.name.replace(/\s+/g, '')}`;
        
      console.log(`[Kanal] Logo güncelleniyor: ${channel.name}`);
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
      console.error(`[Kanal] Logo güncelleme hatası (${channel.name}):`, e.message);
      failedCount++;
    }
  }

  writeDb(db);
  broadcast('db_update', db);
  broadcast('status_log', { message: `Toplu logo güncelleme tamamlandı. Başarılı: ${updatedCount}, Başarısız: ${failedCount}`, type: 'success' });
  addTerminalLog(`[Kanal] Toplu logo güncelleme tamamlandı. Başarılı: ${updatedCount}, Başarısız: ${failedCount}`, 'success');

  res.json({ success: true, updatedCount, failedCount });
});

// Manuel Video İndirmeyi Başlat (Kuyruğa yeni video ekler ve eksik süre/tarih çözücüyü tetikler)
app.post('/api/download-video', async (req, res) => {
  const { videoId } = req.body;
  let { title, channelName, channelId } = req.body;
  if (!videoId) return res.status(400).json({ error: 'Video ID gereklidir.' });
  if (!/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
    return res.status(400).json({ error: 'Geçersiz Video ID formatı.' });
  }

  // Eğer kanal ismi veya başlık eksikse (örneğin PD butonu ile link yapıştırıldığında), YouTube'dan detayları çek
  if (!channelName || !title) {
    try {
      console.log(`[Manuel İndirme] Video detayları YouTube'dan çekiliyor: ${videoId}`);
      const details = await fetchVideoDuration(videoId);
      if (details) {
        if (details.title) title = details.title;
        if (details.channelName) channelName = details.channelName;
        if (details.channelId) channelId = details.channelId;
      }
    } catch (err) {
      console.error(`[Manuel İndirme] Detaylar çekilirken hata oluştu:`, err.message);
    }
  }

  downloadQueue.add({
    id: videoId,
    title: title || 'Bilinmeyen Video',
    channelId: channelId || 'manual',
    channelName: channelName || 'Manuel İndirme',
    url: `https://www.youtube.com/watch?v=${videoId}`,
    publishedAt: '' // Boş bırakarak arka plandaki çözücünün gerçek yayınlanma tarihini YouTube'dan çekmesini sağlarız
  });

  resolveMissingDurations();

  res.json({ success: true, message: 'İndirme kuyruğuna eklendi.' });
});

// Şimdi Kontrol Et (Manuel RSS tetikleme) - Tüm kanalları sırayla 1 saniye aralıklarla denetler
app.post('/api/sync', async (req, res) => {
  try {
    const db = readDb();
    if (db.channels.length === 0) {
      return res.json({ success: true, message: 'İzlenen kanal bulunmuyor.' });
    }
    
    addTerminalLog('[RSS] Manuel tetikleme: Tüm kanallar sırayla denetleniyor...', 'info');
    
    for (const channel of db.channels) {
      await checkSingleChannelRss(channel, false);
      await new Promise(r => setTimeout(r, 1000));
    }
    


    // Süreleri arka planda çözmeye başla
    resolveMissingDurations();
    
    res.json({ success: true, message: 'Tüm kanallar başarıyla denetlendi.' });
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
    console.error(`[Play Video Hatası] Video kaydı geçmişte bulunamadı. ID: ${videoId}`);
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
    console.error(`[Play Video Hatası] ${errorMsg}`);
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
    res.sendFile(fileToPlay);
  } else {
    console.error(`[Stream Hatası] Dosya bulunamadı. ID: ${videoId}`);
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
  
  console.log(`\n--- SİLME İŞLEMİ BAŞLATILDI ---`);
  console.log(`Tarih/Saat: ${new Date().toLocaleString('tr-TR')}`);
  console.log(`Hedef Video ID: ${id}`);
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

        console.log(`Silme işlemi için taranan klasörler:`, foldersToSearch);
        
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
                    console.log(`BAŞARI: Dosya silindi: ${file}`);
                    deletedAny = true;
                  } catch (e) {
                    console.error(`HATA: Dosya silinemedi: ${file}`);
                    console.error(`Hata Detayı: ${e.code} - ${e.message}`);
                    failedToDelete.push(`${file} (${e.message})`);
                  }
                }
              }
            }
          }
        }

        if (failedToDelete.length > 0) {
          const errorMsg = `Video dosyası silinemedi (Dosya kilitli veya açık olabilir): ${failedToDelete.join(', ')}`;
          console.error(`[SİLME HATASI] ${errorMsg}`);
          console.log(`--- SİLME İŞLEMİ BAŞARISIZ ---\n`);
          return res.status(500).json({ error: errorMsg });
        }
        if (deletedAny) {
          broadcast('status_log', { message: `İlgili video dosyaları bilgisayarınızdan silindi: ${item.title}`, type: 'info' });
        } else {
          console.log(`BİLGİ: Aranan klasörlerde '${targetPattern}' içeren herhangi bir dosya bulunamadı (Zaten silinmiş olabilir).`);
        }
      } catch (err) {
        console.error(`[SİLME HATASI] Genel hata: ${err.message}`);
        console.log(`--- SİLME İŞLEMİ BAŞARISIZ ---\n`);
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
    console.log(`BAŞARI: Video geçmiş kaydı veritabanından silindi.`);
    console.log(`--- SİLME İŞLEMİ TAMAMLANDI ---\n`);
    res.json({ success: true });
  } else {
    console.error(`HATA: ID '${id}' olan video kaydı veritabanında bulunamadı.`);
    console.log(`--- SİLME İŞLEMİ BAŞARISIZ ---\n`);
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
    console.error('[Kanal Arama Hatası]:', err.message);
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
    console.error('[Disk Alan Hatası]:', e.message);
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

// Klasör Seçim Diyaloğu (Windows Native)
app.post('/api/select-folder', localhostOnly, (req, res) => {
  const psCommand = `powershell -NoProfile -Command "(New-Object -ComObject Shell.Application).BrowseForFolder(0, 'Lütfen İndirme Klasörünü Seçin', 0, 17).Self.Path"`;
  
  exec(psCommand, (err, stdout, stderr) => {
    if (err) {
      console.error('Folder selection error:', err.message);
      return res.status(500).json({ error: 'Klasör seçim penceresi açılamadı.' });
    }
    const selectedPath = stdout.trim();
    if (selectedPath) {
      res.json({ success: true, path: selectedPath });
    } else {
      res.json({ success: false, message: 'Klasör seçilmedi.' });
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
    console.log('yt-dlp.exe güncellemesi denetleniyor...');
    addTerminalLog('[Sistem] yt-dlp.exe motor güncellemesi denetleniyor...', 'info');
    exec(`"${ytdlpPath}" -U`, (err, stdout, stderr) => {
      if (err) {
        console.error('yt-dlp güncelleme hatası:', err.message);
        addTerminalLog(`[Sistem] yt-dlp güncelleme başarısız: ${err.message}`, 'warning');
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
          console.log(`Kanal logosu çözümlendi: ${channel.name} -> ${info.avatar}`);
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

// Sunucu Başlatıldığında
app.listen(PORT, async () => {
  console.log(`
  ====================================================
   _    _         __     __ _______  ___   ___   _      
  | |  | |  __ _  \\ \\   / /|__   __|/ _ \\ / _ \\ | |     
  | |__| | / _\` |  \\ \\_/ /    | |  | (_) | (_) || |     
  |  __  || (_| |   \\   /     | |   \\___/ \\___/ | |     
  | |  | | \\__,_|    | |      | |               | |____ 
  |_|  |_|           |_|      |_|               |______|

             -- Premium Otomasyonu --
             Versiyon: v4.6
             Yapımcı: HaYTo
  ====================================================
  `);
  console.log(`Sunucu http://localhost:${PORT} portunda çalışıyor.`);
  
  // İndirme klasörünü kontrol et, yoksa oluştur
  const db = readDb();
  
  // Türkçe Açıklama: Önceki hatalı kanal eklemelerinden kalmış, ismi ve ID'si aynı olan bozuk kanalları otomatik temizliyoruz.
  const originalCount = db.channels.length;
  db.channels = db.channels.filter(c => c.name !== c.id);
  if (db.channels.length !== originalCount) {
    console.log(`[AYARLAR] İsmi ve ID'si aynı olan ${originalCount - db.channels.length} bozuk kanal veritabanından temizlendi.`);
    writeDb(db);
  }

  addTerminalLog(`[Sistem] Sunucu başarıyla başlatıldı. Adres: http://localhost:${PORT}`, 'success');
  addTerminalLog(`[Sistem] Otomatik indirme klasörü: "${db.settings.downloadPath}"`, 'info');
  
  if (!fs.existsSync(db.settings.downloadPath)) {
    try {
      fs.mkdirSync(db.settings.downloadPath, { recursive: true });
    } catch (err) {}
  }

  // Başlangıçta yt-dlp kontrolünü ve güncellemesini yap
  try {
    await ensureYtdlp();
    updateYtdlp(); // Güncellemeyi arka planda başlat
  } catch (e) {
    console.error('yt-dlp kurulumu başlatılamadı:', e.message);
  }

  // Başlangıçta ffmpeg kontrolünü yap (eğer merge seçildiyse ve ffmpeg yoksa)
  if (db.settings.mergeType === 'merge' && !fs.existsSync(getFfmpegPath())) {
    ensureFfmpeg().catch(e => console.error('FFmpeg otomatik indirme hatası:', e.message));
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
      console.log(`[Sistem] Sunucu başlangıcında ${queuedCount} adet yarım kalan/bekleyen indirme kuyruğa yeniden eklendi.`);
      addTerminalLog(`[Sistem] Sunucu başlangıcında ${queuedCount} adet yarım kalan/bekleyen indirme kuyruğa yeniden eklendi.`, 'info');
    }
  }, 4000);

  // Tarayıcıda uygulamayı otomatik aç (Eğer ayar aktifse)
  const currentDbState = readDb();
  if (currentDbState.settings.autoOpenBrowser !== false) {
    try {
      await open(`http://localhost:${PORT}`);
    } catch (e) {
      console.log('Tarayıcı otomatik açılamadı, lütfen http://localhost:3000 adresine manuel gidin.');
    }
  } else {
    console.log('Otomatik tarayıcı açılışı devre dışı bırakıldı. Lütfen http://localhost:3000 adresine el ile gidin.');
  }
});
