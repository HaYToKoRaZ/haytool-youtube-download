// Türkçe Açıklama: db.json dosya tabanlı veritabanı okuma, yazma, kilitleme (mutex) ve ayar dosyalarıyla senkronizasyon modülü.
import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import { 
  configIniName,
  configIniPath, 
  channelsIniPath, 
  parseIni, 
  getCaseInsensitiveKey, 
  writeIni 
} from './config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

export const dbPath = path.join(rootDir, 'db.json');
export const defaultDownloadDir = path.join(os.homedir(), 'Downloads', 'HaYTooLYouTubeAutoDownloads');

export const defaultDb = {
  channels: [
    {
      id: "UCFIHrIGT0MBMRHzQtmzOWlQ",
      name: "TeknoSeyir",
      handle: "https://www.youtube.com/@TeknoSeyir",
      addedAt: "2026-05-25T19:36:08.981Z",
      quality: "default",
      downloadShorts: false,
      avatar: "https://yt3.googleusercontent.com/ytc/AIdro_l9oJrladQXLtLvzwQm5ScW-GUUq9tvVgnOc-0DGTKPv6o=s900-c-k-c0x00ffffff-no-rj",
      shortsDurationLimit: 180,
      autoDownload: false
    }
  ],
  history: [],
  settings: {
    downloadPath: defaultDownloadDir,
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
    subtitleColor: '#ffffff',
    subtitleOpacity: '0.7',
    subtitleSize: '26px',
    lang: 'tr',
    isPaused: false,
    showNotifications: true,
    autoOpenBrowser: true,
    historyLimitPerChannel: 30,
    mergeType: 'single',
    writeThumbnail: false,
    playSounds: true,
    shortsDurationLimit: 180,
    sponsorBlockEnabled: false,
    discordRpcEnabled: false,
    doubleClickAction: 'system'
  }
};

let cachedDb = null;
let lastDbJsonMtime = 0;
let lastConfigIniMtime = 0;
let lastChannelsIniMtime = 0;

let dbLockPromise = Promise.resolve();
export async function acquireDbLock() {
  let release;
  const nextLock = new Promise(resolve => {
    release = resolve;
  });
  const currentLock = dbLockPromise;
  dbLockPromise = nextLock;
  await currentLock;
  return release;
}

/**
 * Belirtilen PNG resmini Windows uyumlu bir ICO dosyasına dönüştürür.
 * 
 * @param {string} pngPath Kaynak PNG dosya yolu
 * @param {string} icoPath Hedef ICO dosya yolu
 */
export function convertPngToIco(pngPath, icoPath) {
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
 * Veritabanını (db.json) dosyadan okur, eksik alanları varsayılanlarla doldurur,
 * INI dosyalarıyla eşitler ve RAM önbelleğini yönetir.
 * 
 * @returns {object} Güncel veritabanı nesnesi
 */
export function readDb() {
  try {
    let dbJsonMtime = 0;
    if (fs.existsSync(dbPath)) {
      dbJsonMtime = fs.statSync(dbPath).mtimeMs;
    }
    
    let configIniMtime = 0;
    if (fs.existsSync(configIniPath)) {
      configIniMtime = fs.statSync(configIniPath).mtimeMs;
    }
    
    let channelsIniMtime = 0;
    if (fs.existsSync(channelsIniPath)) {
      channelsIniMtime = fs.statSync(channelsIniPath).mtimeMs;
    }

    // Disk üzerindeki dosyalar değişmediyse, doğrudan RAM önbelleğindeki veriyi dön
    if (cachedDb && 
        dbJsonMtime === lastDbJsonMtime && 
        configIniMtime === lastConfigIniMtime && 
        channelsIniMtime === lastChannelsIniMtime) {
      return cachedDb;
    }

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
      dbJsonMtime = fs.statSync(dbPath).mtimeMs;
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

    // Çerez varsayılanı migrasyonu (Chrome varsayılanını 'none' olarak günceller)
    if (!db.settings.cookieDefaultMigrationDone) {
      if (db.settings.browser === 'chrome') {
        db.settings.browser = 'none';
      }
      db.settings.cookieDefaultMigrationDone = true;
      writeDb(db);
      saveSettingsToIni(db);
    }

    // RAM Önbelleği güncelle
    cachedDb = db;
    lastDbJsonMtime = dbJsonMtime;
    if (fs.existsSync(configIniPath)) {
      lastConfigIniMtime = fs.statSync(configIniPath).mtimeMs;
    }
    if (fs.existsSync(channelsIniPath)) {
      lastChannelsIniMtime = fs.statSync(channelsIniPath).mtimeMs;
    }
    
    return db;
  } catch (err) {
    console.error('Veritabanı okuma hatası:', err);
    return defaultDb;
  }
}

/**
 * JavaScript veritabanı nesnesini 'db.json' dosyasına yazar ve eş zamanlı olarak config dosyalarına yansıtır.
 * 
 * @param {object} data Yazılacak veritabanı nesnesi
 */
export function writeDb(data) {
  try {
    // RAM önbelleği hemen güncelleyelim ki gecikme olmasın
    cachedDb = data;
    
    // Diske yazarken manual indirmeleri (yani standalone downloader videolarını) db.history listesinden çıkarıyoruz
    const dataCopy = JSON.parse(JSON.stringify(data));
    if (dataCopy.history) {
      dataCopy.history = dataCopy.history.filter(h => h.channelId !== 'manual' && h.isStandalone !== true);
    }
    
    const dbString = JSON.stringify(dataCopy, null, 2);
    const tempDbPath = dbPath + '.tmp';
    fs.writeFileSync(tempDbPath, dbString, 'utf8');
    fs.renameSync(tempDbPath, dbPath);
    lastDbJsonMtime = fs.statSync(dbPath).mtimeMs;
    
    // Eş zamanlı olarak config.ini ve channels.ini dosyalarını güncelle
    saveSettingsToIni(data);
    saveChannelsToIni(data);
  } catch (err) {
    console.error('Veritabanı yazma hatası:', err);
  }
}

/**
 * INI yapılandırma dosyalarındaki verileri okur ve ana veritabanı (db.json) nesnesi ile senkronize eder.
 * 
 * @param {object} db Senkronize edilecek veritabanı nesnesi
 */
export function syncWithIni(db) {
  // icon.ico kontrolü
  const pngPath = path.join(rootDir, 'public', 'logo.png');
  const icoPath = path.join(rootDir, 'icon.ico');
  if (!fs.existsSync(icoPath) && fs.existsSync(pngPath)) {
    convertPngToIco(pngPath, icoPath);
  }

  // Eski tekil config.ini dosyasından yeni işletim sistemine özel yapılandırmaya göç
  const oldConfigIniPath = path.join(rootDir, 'config.ini');
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
  const configIniTypoPath = path.join(rootDir, 'config.inilş');
  let migratedSettings = null;
  let migratedChannels = null;
  if (fs.existsSync(configIniTypoPath)) {
    console.log('[Migration] Errorli isimlendirilmiş config.inilş tespit edildi. Göç işlemi başlatılıyor...');
    try {
      const typoData = parseIni(configIniTypoPath);
      migratedSettings = getCaseInsensitiveKey(typoData, 'Settings');
      migratedChannels = getCaseInsensitiveKey(typoData, 'Channels');
      fs.unlinkSync(configIniTypoPath); // Göç sonrası sil
      console.log('[Migration] config.inilş başarıyla taşındı ve silindi.');
    } catch (e) {
      console.error('[Migration] Error:', e.message);
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
        db.settings.playerPreference = playerPreference;
      }

      const playerType = getCaseInsensitiveKey(settingsSection, 'playerType');
      if (playerType !== undefined) {
        db.settings.playerType = playerType;
      }

      const subtitleColor = getCaseInsensitiveKey(settingsSection, 'subtitleColor');
      if (subtitleColor !== undefined) {
        db.settings.subtitleColor = subtitleColor;
      }

      const subtitleOpacity = getCaseInsensitiveKey(settingsSection, 'subtitleOpacity');
      if (subtitleOpacity !== undefined) {
        db.settings.subtitleOpacity = subtitleOpacity;
      }

      const subtitleSize = getCaseInsensitiveKey(settingsSection, 'subtitleSize');
      if (subtitleSize !== undefined) {
        db.settings.subtitleSize = subtitleSize;
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

      const sponsorBlockEnabled = getCaseInsensitiveKey(settingsSection, 'sponsorBlockEnabled');
      if (sponsorBlockEnabled !== undefined) {
        db.settings.sponsorBlockEnabled = sponsorBlockEnabled === 'true';
      }

      const discordRpcEnabled = getCaseInsensitiveKey(settingsSection, 'discordRpcEnabled');
      if (discordRpcEnabled !== undefined) {
        db.settings.discordRpcEnabled = discordRpcEnabled === 'true';
      }

      const doubleClickAction = getCaseInsensitiveKey(settingsSection, 'doubleClickAction');
      if (doubleClickAction !== undefined) {
        db.settings.doubleClickAction = doubleClickAction;
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
      let autoDownload = true;

      if (parts.length >= 8) {
        autoDownload = parts[parts.length - 1] === 'true';
        shortsDurationLimit = parseInt(parts[parts.length - 2], 10) || 180;
        avatar = parts[parts.length - 3];
        downloadShorts = parts[parts.length - 4] === 'true';
        quality = parts[parts.length - 5];
        addedAt = parts[parts.length - 6];
        handleOrUrl = parts[parts.length - 7];
        name = parts.slice(0, parts.length - 7).join(' | ');
      } else if (parts.length === 7) {
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
      const finalAutoDownload = existingChannel && existingChannel.autoDownload !== undefined ? existingChannel.autoDownload : autoDownload;
      
      updatedChannels.push({ id, name, handle: handleOrUrl, addedAt, quality, downloadShorts, avatar: finalAvatar, shortsDurationLimit: finalShortsLimit, autoDownload: finalAutoDownload });
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
export function saveSettingsToIni(db) {
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
  iniData.Settings.subtitleColor = (db.settings.subtitleColor || '#ffffff').toString();
  iniData.Settings.subtitleOpacity = (db.settings.subtitleOpacity || '0.7').toString();
  iniData.Settings.subtitleSize = (db.settings.subtitleSize || '26px').toString();
  iniData.Settings.playSounds = (db.settings.playSounds !== false).toString();
  iniData.Settings.lang = (db.settings.lang || 'tr').toString();
  iniData.Settings.isPaused = (db.settings.isPaused === true).toString();
  iniData.Settings.showNotifications = (db.settings.showNotifications !== false).toString();
  iniData.Settings.autoOpenBrowser = (db.settings.autoOpenBrowser !== false).toString();
  iniData.Settings.sponsorBlockEnabled = (db.settings.sponsorBlockEnabled === true).toString();
  iniData.Settings.discordRpcEnabled = (db.settings.discordRpcEnabled === true).toString();
  iniData.Settings.doubleClickAction = (db.settings.doubleClickAction || 'system').toString();

  writeIni(configIniPath, iniData);
}

/**
 * Veritabanı nesnesindeki kanalları alfabetik olarak sıralayıp 'channels.ini' dosyasına yazar.
 * 
 * @param {object} db Kaydedilecek veritabanı nesnesi
 */
export function saveChannelsToIni(db) {
  const iniData = { Channels: {} };
  
  const sortedChannels = [...db.channels].sort((a, b) => 
    (a.name || '').localeCompare(b.name || '', 'tr', { sensitivity: 'base' })
  );
  
  for (const channel of sortedChannels) {
    let channelUrl = channel.handle;
    if (channelUrl && !channelUrl.startsWith('http')) {
      if (channelUrl.startsWith('@')) {
        channelUrl = `https://www.youtube.com/${channelUrl}`;
      } else {
        channelUrl = `https://www.youtube.com/channel/${channel.id}`;
      }
    } else if (!channelUrl) {
      channelUrl = `https://www.youtube.com/channel/${channel.id}`;
    }
    const info = [
      channel.name || '',
      channelUrl || '',
      channel.addedAt || '',
      channel.quality || 'default',
      (channel.downloadShorts !== false).toString(),
      channel.avatar || '',
      (channel.shortsDurationLimit || 180).toString(),
      (channel.autoDownload !== false).toString()
    ].join(' | ');
    iniData.Channels[channel.id] = info;
  }
  writeIni(channelsIniPath, iniData);
}

/**
 * Belirtilen klasörü tarayarak video dosyalarının ID'lerine göre bir eşleme (Map) döndürür.
 */
export function buildVideoFilesMap(downloadPath) {
  const map = new Map();
  try {
    if (!fs.existsSync(downloadPath)) return map;
    
    function scanDir(dir) {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (entry.name.startsWith('.')) continue; // Gizli klasörleri atla
          scanDir(fullPath);
        } else {
          const ext = path.extname(entry.name).toLowerCase();
          if (!['.jpg', '.jpeg', '.webp', '.png', '.json', '.temp', '.part', '.ytdl', '.srt', '.vtt', '.description'].includes(ext)) {
            const bracketMatch = entry.name.match(/\[([a-zA-Z0-9_-]{11})\]/);
            if (bracketMatch) {
              const videoId = bracketMatch[1];
              map.set(videoId, fullPath);
            }
          }
        }
      }
    }
    scanDir(downloadPath);
  } catch (e) {
    console.error(`[Disk Sync] Klasör taranırken hata oluştu: ${downloadPath}`, e.message);
  }
  return map;
}

/**
 * Disk üzerindeki dosyaları veritabanıyla senkronize eder.
 */
export function syncDbWithDisk() {
  try {
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
      
      const downloadPath = db.settings.downloadPath || defaultDownloadDir;
      const diskMap = buildVideoFilesMap(downloadPath);

      for (const item of db.history) {
        if (item.status === 'downloaded') {
          const hasDiskFile = diskMap.has(item.id);
          if (hasDiskFile) {
            const diskFile = diskMap.get(item.id);
            try {
              const stats = fs.statSync(diskFile);
              const sizeInMB = (stats.size / (1024 * 1024)).toFixed(2) + ' MB';
              
              if (item.filePath !== diskFile || item.fileSize !== sizeInMB) {
                item.filePath = diskFile;
                item.fileSize = sizeInMB;
                dbUpdated = true;
              }
              newHistory.push(item);
            } catch (err) {
              // Dosya okunamıyorsa kaydetme
              dbUpdated = true;
            }
          } else {
            // Diskten silinmişse durumunu değiştir
            item.status = 'failed';
            item.progress = 0;
            item.speed = '';
            item.eta = '';
            item.error = db.settings.lang === 'en' ? 'File deleted from disk.' : 'Dosya diskten silinmiş.';
            newHistory.push(item);
            dbUpdated = true;
          }
        } else {
          newHistory.push(item);
        }
      }

      if (dbUpdated) {
        db.history = newHistory;
        writeDb(db);
      }
    }
  } catch (err) {
    console.error('[Disk Sync Error]', err.message);
  }
}

export function findVideoFileInDownloadDir(videoId, downloadPath) {
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
            // Skip thumbnails, subtitles and metadata
            if (!['.jpg', '.jpeg', '.webp', '.png', '.json', '.temp', '.part', '.ytdl', '.srt', '.vtt', '.description'].includes(ext)) {
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

export function createHistoryItem(videoId, title, channelId, channelName, publishedAt, duration, settings) {
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
    } catch (err) {
      // Kasıtlı sessiz: Dosya boyutu okunamasa da işlem devam etsin
    }
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

export function isShortDuration(durationStr, limit = 180) {
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

export function updateHistoryItem(videoId, updates) {
  const db = readDb();
  const index = db.history.findIndex(h => h.id === videoId);
  if (index !== -1) {
    db.history[index] = { ...db.history[index], ...updates };
    writeDb(db);
  }
}

// Türkçe Açıklama: Veritabanı üzerinde CRUD (Ekleme, Okuma, Güncelleme, Silme) işlemlerini soyutlayan ORM sınıfı.
/**
 * Veritabanı dosyası üzerinde CRUD işlemlerini yürüten ve yöneten ORM sınıfı.
 */
export class DatabaseORM {
  constructor(dbPath) {
    this.dbPath = dbPath;
  }

  /**
   * Veritabanı nesnesini bellekten veya diskten okur.
   * @returns {object}
   */
  read() {
    return readDb();
  }

  /**
   * Veritabanı nesnesini diske yazar.
   * @param {object} data 
   * @returns {void}
   */
  write(data) {
    return writeDb(data);
  }

  /**
   * Belirtilen koleksiyonda arama koşuluna uyan ilk nesneyi bulur.
   * @param {string} collection 
   * @param {function} predicate 
   * @returns {*}
   */
  find(collection, predicate) {
    const data = this.read();
    return (data[collection] || []).find(predicate);
  }

  /**
   * Belirtilen koleksiyonda ID ile arama yapar.
   * @param {string} collection 
   * @param {string} id 
   * @returns {*}
   */
  findById(collection, id) {
    const data = this.read();
    return (data[collection] || []).find(item => item.id === id);
  }

  /**
   * Koleksiyona yeni bir nesne ekler veya mevcut nesneyi günceller.
   * @param {string} collection 
   * @param {object} item 
   * @returns {object}
   */
  save(collection, item) {
    const data = this.read();
    data[collection] = data[collection] || [];
    const index = data[collection].findIndex(i => i.id === item.id);
    if (index !== -1) {
      data[collection][index] = { ...data[collection][index], ...item };
    } else {
      data[collection].push(item);
    }
    this.write(data);
    return item;
  }

  /**
   * Koleksiyondan belirtilen ID'ye sahip nesneyi siler.
   * @param {string} collection 
   * @param {string} id 
   * @returns {boolean}
   */
  delete(collection, id) {
    const data = this.read();
    data[collection] = data[collection] || [];
    const initialLength = data[collection].length;
    data[collection] = data[collection].filter(item => item.id !== id);
    const deleted = data[collection].length < initialLength;
    if (deleted) {
      this.write(data);
    }
    return deleted;
  }

  /**
   * Belirtilen ID'ye sahip nesneye değişiklikleri uygular.
   * @param {string} collection 
   * @param {string} id 
   * @param {object} changes 
   * @returns {object|null}
   */
  update(collection, id, changes) {
    const data = this.read();
    data[collection] = data[collection] || [];
    const item = data[collection].find(i => i.id === id);
    if (item) {
      Object.assign(item, changes);
      this.write(data);
      return item;
    }
    return null;
  }
}

export const db = new DatabaseORM(dbPath);

