// Türkçe Açıklama: db.json dosya tabanlı veritabanı okuma, yazma, kilitleme (mutex) ve ayar dosyalarıyla senkronizasyon modülü.
import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import { 
  configIniName,
  configIniPath, 
  channelsIniPath, 
  categoriesIniPath,
  parseIni, 
  getCaseInsensitiveKey, 
  writeIni 
} from './config.js';
import { getVideoResolution } from './services/paths.js';
import { addTerminalLog, broadcast } from './services/sse.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

export const dbPath = path.join(rootDir, 'db.json');
export const defaultDownloadDir = path.join(os.homedir(), 'Downloads', 'HaYTooLYouTubeAutoDownloads');

// Makineye özel AES-256 şifreleme tohumu ve anahtarı
const machineSeed = `${os.hostname()}|${os.userInfo().username}|${os.homedir()}`;
const machineSecretKey = crypto.createHash('sha256').update(machineSeed).digest();

/**
 * Hassas metin verilerini (ör. GitHub Token) AES-256-CBC ile makineye bağlı şifreler.
 */
export function encryptSecret(text) {
  if (!text || typeof text !== 'string' || text.startsWith('enc:v1:')) return text;
  try {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', machineSecretKey, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return 'enc:v1:' + iv.toString('hex') + ':' + encrypted;
  } catch (e) {
    return text;
  }
}

/**
 * Şifrelenmiş hassas metin verilerini makine anahtarı ile çözer.
 */
export function decryptSecret(text) {
  if (!text || typeof text !== 'string' || !text.startsWith('enc:v1:')) return text;
  try {
    const parts = text.split(':');
    if (parts.length < 4) return '';
    const iv = Buffer.from(parts[2], 'hex');
    const encryptedText = parts[3];
    const decipher = crypto.createDecipheriv('aes-256-cbc', machineSecretKey, iv);
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (e) {
    return '';
  }
}

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
      autoDownload: false,
      categoryId: 1
    },
    {
      id: "UCVdO0zhBHfXrySANXptVfmg",
      name: "HaYTo KoRaZ",
      handle: "https://www.youtube.com/@HaYToKoRaZ",
      addedAt: "2026-08-14T10:40:00.000Z",
      quality: "default",
      downloadShorts: false,
      avatar: "https://yt3.googleusercontent.com/ytc/AIdro_mLZttJRj6uGybFVyHjGTaeXnEuY8-Q3RDkLDuwXneJ5dqc=s900-c-k-c0x00ffffff-no-rj",
      shortsDurationLimit: 180,
      autoDownload: false,
      categoryId: 1
    }
  ],
  history: [],
  categories: [
    { id: 1, name: "Genel" },
    { id: 2, name: "Oyun" },
    { id: 3, name: "Eğitim" },
    { id: 4, name: "Müzik" },
    { id: 5, name: "Teknoloji" },
    { id: 6, name: "Spor" },
    { id: 7, name: "Sinema & Film" },
    { id: 8, name: "Haberler & Siyaset" },
    { id: 9, name: "Eğlence" },
    { id: 10, name: "Bilim" },
    { id: 11, name: "Gezi & Yaşam" },
    { id: 12, name: "Komedi" },
    { id: 13, name: "Belgesel" },
    { id: 14, name: "Anime & Çizgi Film" },
    { id: 15, name: "Finans & Ekonomi" },
    { id: 16, name: "League of Legends" },
    { id: 17, name: "Podcast" }
  ],
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
    preferredAudioLang: 'tr',
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
    doubleClickAction: 'system',
    tempDirType: 'system',
    durationFetchMethod: 'auto',
    ytdlpRunMode: 'exe',
    liveStreamHandling: 'instant_retry',
    liveStreamRetryInterval: 30,
    pythonCmd: os.platform() === 'win32' ? 'python' : 'python3',
    maxConcurrentDownloads: 1,
    hideOnDelete: true,
    markWatchedOnDelete: true,
    autoSyncWatchtime: true,
    autoDiskSync: true,
    checkChannelsOnStartup: false,
    enableAltThumbnailsHover: true,
    githubToken: '',
    githubGistId: '',
    autoSyncGist: false,
    channelScanMode: 'fast',
    weatherEnabled: true,
    weatherCity: 'İstanbul',
    weatherLatitude: 41.0082,
    weatherLongitude: 28.9784,
    weatherUnit: 'celsius',
    queueViewMode: 'table'
  }
};

let cachedDb = null;
let lastDbJsonMtime = 0;
let lastConfigIniMtime = 0;
let lastChannelsIniMtime = 0;
let lastCategoriesIniMtime = 0;

let dbLockPromise = Promise.resolve();
/**
 * Veritabanı yazma işlemleri için sıralı kilit (mutex) mekanizmasını yönetir.
 * Eş zamanlı birden fazla yazma isteğinin çakışmasını önler.
 * Otomatik 30 saniyelik zaman aşımı korumasıyla kilitlenmelerin (deadlock) önüne geçer.
 * Kullanım: `const release = await acquireDbLock();` → işlem → `release()`
 *
 * @returns {Promise<Function>} Kilidi serbest bırakan `release` fonksiyonu
 */
export async function acquireDbLock() {
  let release;
  const nextLock = new Promise(resolve => {
    release = resolve;
  });
  const currentLock = dbLockPromise;
  dbLockPromise = nextLock;

  const timeoutPromise = new Promise(resolve => setTimeout(resolve, 30000));
  await Promise.race([currentLock, timeoutPromise]);
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

    let categoriesIniMtime = 0;
    if (fs.existsSync(categoriesIniPath)) {
      categoriesIniMtime = fs.statSync(categoriesIniPath).mtimeMs;
    }

    // Disk üzerindeki dosyalar değişmediyse, doğrudan RAM önbelleğindeki veriyi dön
    if (cachedDb && 
        dbJsonMtime === lastDbJsonMtime && 
        configIniMtime === lastConfigIniMtime && 
        channelsIniMtime === lastChannelsIniMtime &&
        categoriesIniMtime === lastCategoriesIniMtime) {
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

      // Şifrelenmiş githubToken varsa RAM'e yüklerken çöz
      if (db.settings && db.settings.githubToken) {
        db.settings.githubToken = decryptSecret(db.settings.githubToken);
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
    if (fs.existsSync(categoriesIniPath)) {
      lastCategoriesIniMtime = fs.statSync(categoriesIniPath).mtimeMs;
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
    
    // Otomatik rolling yedek (db.json.bak)
    if (fs.existsSync(dbPath)) {
      try {
        const stats = fs.statSync(dbPath);
        if (stats.size > 0) {
          fs.copyFileSync(dbPath, dbPath + '.bak');
        }
      } catch (bakErr) {
        // Sessizce geç
      }
    }

    // Disk için kopyasını al ve hassas verileri (githubToken) AES-256 ile şifrele
    const dataToSave = JSON.parse(JSON.stringify(data));
    if (dataToSave.settings && dataToSave.settings.githubToken) {
      dataToSave.settings.githubToken = encryptSecret(dataToSave.settings.githubToken);
    }

    const dbString = JSON.stringify(dataToSave, null, 2);
    const tempDbPath = `${dbPath}.${Date.now()}.${Math.random().toString(36).slice(2, 7)}.tmp`;
    fs.writeFileSync(tempDbPath, dbString, 'utf8');
    
    let renamed = false;
    for (let i = 0; i < 5; i++) {
      try {
        fs.renameSync(tempDbPath, dbPath);
        renamed = true;
        break;
      } catch (renameErr) {
        if (i === 4) {
          // Son çare olarak doğrudan writeFileSync yap
          fs.writeFileSync(dbPath, dbString, 'utf8');
          try { fs.unlinkSync(tempDbPath); } catch (e) {}
          renamed = true;
        } else {
          // Kısa bir bekleme (synchronous busy wait)
          const waitTill = Date.now() + 20;
          while (Date.now() < waitTill) {}
        }
      }
    }

    try {
      lastDbJsonMtime = fs.statSync(dbPath).mtimeMs;
    } catch (e) {}
    
    // Eş zamanlı olarak config.ini ve channels.ini dosyalarını güncelle
    saveSettingsToIni(data);
    saveChannelsToIni(data);
    saveCategoriesToIni(data);
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

  // 1. categories.ini (Kategoriler) Eşitlemesi
  let categoriesData = null;
  if (fs.existsSync(categoriesIniPath)) {
    const parsedCategories = parseIni(categoriesIniPath);
    categoriesData = getCaseInsensitiveKey(parsedCategories, 'Categories') || parsedCategories;
  }

  if (categoriesData) {
    const updatedCategories = [];
    for (const id in categoriesData) {
      updatedCategories.push({
        id: parseInt(id, 10),
        name: categoriesData[id]
      });
    }

    const defaultCategories = [
      { id: 1, name: "Genel" },
      { id: 2, name: "Oyun" },
      { id: 3, name: "Eğitim" },
      { id: 4, name: "Müzik" },
      { id: 5, name: "Teknoloji" },
      { id: 6, name: "Spor" },
      { id: 7, name: "Sinema & Film" },
      { id: 8, name: "Haberler & Siyaset" },
      { id: 9, name: "Eğlence" },
      { id: 10, name: "Bilim" },
      { id: 11, name: "Gezi & Yaşam" },
      { id: 12, name: "Komedi" },
      { id: 13, name: "Belgesel" },
      { id: 14, name: "Anime & Çizgi Film" },
      { id: 15, name: "Finans & Ekonomi" },
      { id: 16, name: "League of Legends" },
      { id: 17, name: "Podcast" }
    ];

    let hasNewDefault = false;
    defaultCategories.forEach(defCat => {
      const exists = updatedCategories.some(c => c.id === defCat.id);
      if (!exists) {
        updatedCategories.push(defCat);
        hasNewDefault = true;
      }
    });

    db.categories = updatedCategories.length > 0 ? updatedCategories : defaultCategories;
    if (hasNewDefault) {
      saveCategoriesToIni(db);
    }
  } else {
    if (!fs.existsSync(categoriesIniPath)) {
      saveCategoriesToIni(db);
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

      const historyDurationFilter = getCaseInsensitiveKey(settingsSection, 'historyDurationFilter');
      if (historyDurationFilter !== undefined) {
        db.settings.historyDurationFilter = historyDurationFilter;
      }

      const enableAltThumbnailsHover = getCaseInsensitiveKey(settingsSection, 'enableAltThumbnailsHover');
      if (enableAltThumbnailsHover !== undefined) {
        db.settings.enableAltThumbnailsHover = enableAltThumbnailsHover !== 'false';
      }

      const markWatchedOnDelete = getCaseInsensitiveKey(settingsSection, 'markWatchedOnDelete');
      if (markWatchedOnDelete !== undefined) {
        db.settings.markWatchedOnDelete = markWatchedOnDelete !== 'false';
      }

      const autoSyncWatchtime = getCaseInsensitiveKey(settingsSection, 'autoSyncWatchtime');
      if (autoSyncWatchtime !== undefined) {
        db.settings.autoSyncWatchtime = autoSyncWatchtime !== 'false';
      }

      const autoDiskSync = getCaseInsensitiveKey(settingsSection, 'autoDiskSync');
      if (autoDiskSync !== undefined) {
        db.settings.autoDiskSync = autoDiskSync !== 'false';
      }

      const weatherEnabled = getCaseInsensitiveKey(settingsSection, 'weatherEnabled');
      if (weatherEnabled !== undefined) {
        db.settings.weatherEnabled = weatherEnabled !== 'false';
      }

      const weatherCity = getCaseInsensitiveKey(settingsSection, 'weatherCity');
      if (weatherCity !== undefined) {
        db.settings.weatherCity = weatherCity;
      }

      const weatherLatitude = getCaseInsensitiveKey(settingsSection, 'weatherLatitude');
      if (weatherLatitude !== undefined) {
        db.settings.weatherLatitude = parseFloat(weatherLatitude) || 41.0082;
      }

      const weatherLongitude = getCaseInsensitiveKey(settingsSection, 'weatherLongitude');
      if (weatherLongitude !== undefined) {
        db.settings.weatherLongitude = parseFloat(weatherLongitude) || 28.9784;
      }

      const weatherUnit = getCaseInsensitiveKey(settingsSection, 'weatherUnit');
      if (weatherUnit !== undefined) {
        db.settings.weatherUnit = weatherUnit;
      }

      const queueViewMode = getCaseInsensitiveKey(settingsSection, 'queueViewMode');
      if (queueViewMode !== undefined) {
        db.settings.queueViewMode = queueViewMode;
      }
    }
  }

  if (!db.settings.queueViewMode) {
    db.settings.queueViewMode = 'table';
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
    let rawContent = '';
    try {
      rawContent = fs.readFileSync(channelsIniPath, 'utf-8').trim();
    } catch (e) {
      console.error('[Hata] channels.ini okunamadı:', e);
    }

    if (!rawContent) {
      console.warn('[Uyarı] channels.ini boş (0 byte) tespit edildi! Otomatik kurtarma devreye giriyor...');
      if (db.channels && db.channels.length > 0) {
        console.log(`[Kurtarma] db.json içindeki ${db.channels.length} adet kanal channels.ini dosyasına yeniden yazılıyor...`);
        saveChannelsToIni(db);
        channelsData = null;
      } else if (fs.existsSync(channelsIniPath + '.bak')) {
        try {
          const bakContent = fs.readFileSync(channelsIniPath + '.bak', 'utf-8').trim();
          if (bakContent) {
            console.log('[Kurtarma] channels.ini.bak yedeğinden geri yükleniyor...');
            fs.writeFileSync(channelsIniPath, bakContent, 'utf-8');
            const parsedChannels = parseIni(channelsIniPath);
            channelsData = getCaseInsensitiveKey(parsedChannels, 'Channels') || parsedChannels;
          }
        } catch (bakErr) {
          console.error('[Hata] channels.ini.bak okuma hatası:', bakErr);
        }
      }
    } else {
      const parsedChannels = parseIni(channelsIniPath);
      channelsData = getCaseInsensitiveKey(parsedChannels, 'Channels') || parsedChannels;
      if (channelsData && Object.keys(channelsData).length === 0 && db.channels && db.channels.length > 0) {
        console.warn('[Uyarı] channels.ini içinde kanal bulunamadı fakat db.json dolu. channels.ini koruma amacıyla yeniden yazılıyor.');
        saveChannelsToIni(db);
        channelsData = null;
      }
    }
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
      let categoryId = 1;
      let categoryIds = [1];

      let subscriberCountFromIni = '?';
      if (parts.length >= 10) {
        subscriberCountFromIni = parts[parts.length - 1];
        const catPart = parts[parts.length - 2];
        if (catPart.includes(',')) {
          categoryIds = catPart.split(',').map(x => parseInt(x.trim(), 10) || 1);
        } else {
          categoryIds = [parseInt(catPart, 10) || 1];
        }
        categoryId = categoryIds[0] || 1;
        autoDownload = parts[parts.length - 3] === 'true';
        shortsDurationLimit = parseInt(parts[parts.length - 4], 10) || 180;
        avatar = parts[parts.length - 5];
        downloadShorts = parts[parts.length - 6] === 'true';
        quality = parts[parts.length - 7];
        addedAt = parts[parts.length - 8];
        handleOrUrl = parts[parts.length - 9];
        name = parts.slice(0, parts.length - 9).join(' | ');
      } else if (parts.length === 9) {
        const catPart = parts[parts.length - 1];
        if (catPart.includes(',')) {
          categoryIds = catPart.split(',').map(x => parseInt(x.trim(), 10) || 1);
        } else {
          categoryIds = [parseInt(catPart, 10) || 1];
        }
        categoryId = categoryIds[0] || 1;
        autoDownload = parts[parts.length - 2] === 'true';
        shortsDurationLimit = parseInt(parts[parts.length - 3], 10) || 180;
        avatar = parts[parts.length - 4];
        downloadShorts = parts[parts.length - 5] === 'true';
        quality = parts[parts.length - 6];
        addedAt = parts[parts.length - 7];
        handleOrUrl = parts[parts.length - 8];
        name = parts.slice(0, parts.length - 8).join(' | ');
      } else if (parts.length === 8) {
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
      const dbSubCount = existingChannel ? existingChannel.subscriberCount : '';
      const finalSubscriberCount = (dbSubCount && dbSubCount !== '?')
        ? dbSubCount 
        : ((subscriberCountFromIni && subscriberCountFromIni !== '?') ? subscriberCountFromIni : '?');
      const finalShortsLimit = existingChannel ? (existingChannel.shortsDurationLimit || shortsDurationLimit) : shortsDurationLimit;
      const finalAutoDownload = existingChannel && existingChannel.autoDownload !== undefined ? existingChannel.autoDownload : autoDownload;
      const finalCategoryId = existingChannel && existingChannel.categoryId !== undefined ? existingChannel.categoryId : categoryId;
      const finalCategoryIds = existingChannel && existingChannel.categoryIds !== undefined 
         ? existingChannel.categoryIds 
         : (existingChannel && existingChannel.categoryId ? [existingChannel.categoryId] : categoryIds);
       
       updatedChannels.push({ 
         id, 
         name, 
         handle: handleOrUrl, 
         addedAt, 
         quality, 
         downloadShorts, 
         avatar: finalAvatar, 
         subscriberCount: finalSubscriberCount,
         shortsDurationLimit: finalShortsLimit, 
         autoDownload: finalAutoDownload, 
         categoryId: finalCategoryId,
         categoryIds: finalCategoryIds 
       });
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
  iniData.Settings.historyDurationFilter = (db.settings.historyDurationFilter || 'off').toString();
  iniData.Settings.enableAltThumbnailsHover = (db.settings.enableAltThumbnailsHover !== false).toString();
  iniData.Settings.weatherEnabled = (db.settings.weatherEnabled !== false).toString();
  iniData.Settings.weatherCity = (db.settings.weatherCity || 'İstanbul').toString();
  iniData.Settings.weatherLatitude = (db.settings.weatherLatitude !== undefined ? db.settings.weatherLatitude : 41.0082).toString();
  iniData.Settings.weatherLongitude = (db.settings.weatherLongitude !== undefined ? db.settings.weatherLongitude : 28.9784).toString();
  iniData.Settings.weatherUnit = (db.settings.weatherUnit || 'celsius').toString();
  iniData.Settings.queueViewMode = (db.settings.queueViewMode || 'table').toString();
  iniData.Settings.markWatchedOnDelete = (db.settings.markWatchedOnDelete !== false).toString();
  iniData.Settings.autoSyncWatchtime = (db.settings.autoSyncWatchtime !== false).toString();
  iniData.Settings.autoDiskSync = (db.settings.autoDiskSync !== false).toString();

  writeIni(configIniPath, iniData);
}

/**
 * Veritabanı nesnesindeki kanalları alfabetik olarak sıralayıp 'channels.ini' dosyasına yazar.
 * 
 * @param {object} db Kaydedilecek veritabanı nesnesi
 */
export function saveChannelsToIni(db) {
  if (!db || !Array.isArray(db.channels)) return;

  // Otomatik .bak koruma yedeği
  if (fs.existsSync(channelsIniPath)) {
    try {
      const stats = fs.statSync(channelsIniPath);
      if (stats.size > 0) {
        fs.copyFileSync(channelsIniPath, channelsIniPath + '.bak');
      }
    } catch (e) {}
  }

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
      (channel.autoDownload !== false).toString(),
      (channel.categoryIds && channel.categoryIds.length > 0 
        ? channel.categoryIds.join(',') 
        : (channel.categoryId !== undefined ? channel.categoryId : 1).toString()).toString(),
      channel.subscriberCount || '?'
    ].join(' | ');
    iniData.Channels[channel.id] = info;
  }
  let oldContent = '';
  if (fs.existsSync(channelsIniPath)) {
    try { oldContent = fs.readFileSync(channelsIniPath, 'utf-8'); } catch(e) {}
  }

  writeIni(channelsIniPath, iniData);

  let newContent = '';
  if (fs.existsSync(channelsIniPath)) {
    try { newContent = fs.readFileSync(channelsIniPath, 'utf-8'); } catch(e) {}
  }

  // Sadece kanal listesi gerçekten değiştiğinde (ekleme/çıkarma/ayar) Gist yedeğini tetikle
  if (oldContent !== newContent && oldContent.trim().length > 0) {
    import('./routes/gist.js').then(m => m.triggerAutoGistSync()).catch(() => {});
  }
}

/**
 * Veritabanı nesnesindeki kategorileri 'categories.ini' dosyasına yazar.
 * 
 * @param {object} db Kaydedilecek veritabanı nesnesi
 */
export function saveCategoriesToIni(db) {
  const iniData = { Categories: {} };
  
  const categoriesList = db.categories || [{ id: 1, name: 'Genel' }];
  const sortedCategories = [...categoriesList].sort((a, b) => a.id - b.id);
  
  for (const cat of sortedCategories) {
    iniData.Categories[cat.id.toString()] = cat.name || '';
  }
  writeIni(categoriesIniPath, iniData);
}

/**
 * Belirtilen klasörü tarayarak video dosyalarının ID'lerine göre bir eşleme (Map) döndürür.
 * Sistem klasörlerini ($RECYCLE.BIN, System Volume Information vb.) atlar ve maksimum derinlik sınırı koyar.
 */
export function buildVideoFilesMap(downloadPath) {
  const map = new Map();
  try {
    if (!fs.existsSync(downloadPath)) return map;
    
    const ignoredFolders = ['$recycle.bin', 'system volume information', '.git', 'node_modules', 'temp', '0nogithub', 'scratch', 'backup'];

    function scanDir(dir, depth = 0) {
      if (depth > 3) return; // Maksimum 3 derinlik sınırı
      const folderName = path.basename(dir).toLowerCase();
      if (ignoredFolders.includes(folderName) || folderName.startsWith('.')) return;

      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          const entryLower = entry.name.toLowerCase();
          if (ignoredFolders.includes(entryLower) || entryLower.startsWith('.')) continue;
          scanDir(fullPath, depth + 1);
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
    scanDir(downloadPath, 0);
  } catch (e) {
    console.error(`[Disk Sync] Klasör taranırken hata oluştu: ${downloadPath}`, e.message);
  }
  return map;
}

/**
 * Disk üzerindeki dosyaları veritabanıyla senkronize eder.
 * Aktif bir indirme veya FFmpeg birleştirme varsa diski yormamak için işlemi erteler.
 * 
 * @param {boolean} [forceManual=false] - Ayar kapalı olsa bile manuel olarak çalıştırmaya zorla
 * @returns {Promise<object>} Senkronizasyon sonuçları
 */
export async function syncDbWithDisk(forceManual = false) {
  try {
    const db = readDb();
    if (!forceManual && db.settings && db.settings.autoDiskSync === false) {
      return { success: true, skipped: true, message: 'Otomatik disk senkronizasyonu ayarlardan devre dışı bırakılmış.' };
    }

    const { downloadQueue } = await import('./services/downloader.js');
    if (downloadQueue && (downloadQueue.activeDownloads > 0 || (downloadQueue.activeProcesses && downloadQueue.activeProcesses.size > 0))) {
      console.log('[Disk Sync] Aktif indirme/birleştirme işlemi olduğu için disk senkronizasyonu ertelendi.');
      addTerminalLog('[Disk Sync] Aktif indirme/birleştirme işlemi olduğu için disk senkronizasyonu ertelendi.', 'warn');
      return { success: false, busy: true, message: 'Aktif indirme/birleştirme işlemi olduğu için disk senkronizasyonu ertelendi.' };
    }

    return performDiskSync();
  } catch (err) {
    console.error('[Disk Sync Error]', err.message);
    addTerminalLog(`[Disk Sync Error] ${err.message}`, 'error');
    return { success: false, error: err.message };
  }
}

function performDiskSync() {
  try {
    let db = defaultDb;
    if (fs.existsSync(dbPath)) {
      try {
        db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
      } catch (e) {
        return { success: false, error: 'db.json okunamadı' };
      }
    } else {
      return { success: false, error: 'db.json mevcut değil' };
    }

    console.log('[Disk Sync] Disk senkronizasyonu ve video doğrulama başlatıldı...');
    addTerminalLog('[Disk Sync] Disk senkronizasyonu ve video doğrulama başlatıldı...', 'info');

    let dbUpdated = false;
    let totalVerified = 0;
    let updatedCount = 0;

    if (db.history && db.history.length > 0) {
      const newHistory = [];
      const downloadPath = db.settings.downloadPath || defaultDownloadDir;
      const diskMap = buildVideoFilesMap(downloadPath);

      for (const item of db.history) {
        if (item.status === 'completed' || item.status === 'downloaded') {
          let diskFile = diskMap.get(item.id);
          if (!diskFile && item.filePath && fs.existsSync(item.filePath)) {
            diskFile = item.filePath;
          }

          if (diskFile && fs.existsSync(diskFile)) {
            totalVerified++;
            try {
              if (item.filePath !== diskFile) {
                item.filePath = diskFile;
                dbUpdated = true;
                updatedCount++;
              }

              if (item.fileMissing === true) {
                delete item.fileMissing;
                dbUpdated = true;
                updatedCount++;
              }

              if (!item.actualQuality) {
                const res = getVideoResolution(diskFile);
                if (res) {
                  item.actualQuality = res;
                  dbUpdated = true;
                  updatedCount++;
                }
              }
              newHistory.push(item);
            } catch (err) {
              newHistory.push(item);
            }
          } else {
            // Dosya diskte bulunamadı ama geçmişi koru (fileMissing)
            if (item.fileMissing !== true) {
              item.fileMissing = true;
              dbUpdated = true;
              updatedCount++;
            }
            newHistory.push(item);
          }
        } else {
          newHistory.push(item);
        }
      }

      if (dbUpdated) {
        db.history = newHistory;
        writeDb(db);
        broadcast('db_update', db);
      }
    }

    const summaryMsg = `Disk senkronizasyonu tamamlandı: ${totalVerified} video doğrulandı, ${updatedCount} kayıt güncellendi.`;
    console.log(`[Disk Sync] ${summaryMsg}`);
    addTerminalLog(`[Disk Sync] ${summaryMsg}`, 'success');
    broadcast('status_log', { message: summaryMsg, type: 'success' });

    return {
      success: true,
      totalVerified,
      updatedCount,
      message: summaryMsg
    };
  } catch (err) {
    console.error('[Disk Sync Performance Error]', err.message);
    addTerminalLog(`[Disk Sync Error] ${err.message}`, 'error');
    return { success: false, error: err.message };
  }
}

/**
 * İndirme klasörü altındaki tüm alt dizinlerde verilen video ID'sine sahip
 * dosyayı özyinelemeli (recursive) olarak arar. Sistem klasörlerini ve derin yolları atlar.
 *
 * @param {string} videoId - Aranacak YouTube video ID'si (11 karakter)
 * @param {string} downloadPath - Taranacak kök indirme dizini
 * @returns {string|null} Bulunan dosyanın tam yolu veya bulunamazsa null
 */
export function findVideoFileInDownloadDir(videoId, downloadPath) {
  try {
    if (!fs.existsSync(downloadPath)) return null;
    const targetPattern = `[${videoId}]`;
    const ignoredFolders = ['$recycle.bin', 'system volume information', '.git', 'node_modules', 'temp', '0nogithub', 'scratch', 'backup'];

    function searchDir(dir, depth = 0) {
      if (depth > 3) return null; // Maksimum 3 derinlik sınırı
      const folderName = path.basename(dir).toLowerCase();
      if (ignoredFolders.includes(folderName) || folderName.startsWith('.')) return null;

      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          const entryLower = entry.name.toLowerCase();
          if (ignoredFolders.includes(entryLower) || entryLower.startsWith('.')) continue;
          const result = searchDir(fullPath, depth + 1);
          if (result) return result;
        } else {
          if (entry.name.includes(targetPattern)) {
            const ext = path.extname(entry.name).toLowerCase();
            if (!['.jpg', '.jpeg', '.webp', '.png', '.json', '.temp', '.part', '.ytdl', '.srt', '.vtt', '.description'].includes(ext)) {
              return fullPath;
            }
          }
        }
      }
      return null;
    }

    return searchDir(downloadPath, 0);
  } catch (e) {
    console.error(`Error searching recursively for video ${videoId} in ${downloadPath}:`, e.message);
  }
  return null;
}

/**
 * Yeni bir video geçmişi (history) kaydı oluşturur.
 * İndirme klasöründe dosya mevcutsa `completed`, değilse `ignored` durumu atanır.
 * Dosya varsa boyutu otomatik hesaplanır.
 *
 * @param {string} videoId - YouTube video ID'si
 * @param {string} title - Video başlığı
 * @param {string} channelId - Kanal ID'si
 * @param {string} channelName - Kanal adı
 * @param {string} publishedAt - Yayınlanma tarihi (ISO 8601)
 * @param {string} duration - Video süresi (örn. '12:34')
 * @param {object} settings - Uygulama ayarları (downloadPath dahil)
 * @returns {object} Oluşturulan history kaydı nesnesi
 */
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

/**
 * Verilen süre dizesini (örn. '1:23' veya '0:45') saniyeye çevirerek
 * belirtilen limite eşit ya da daha kısa olup olmadığını kontrol eder.
 * YouTube Shorts filtrelemesinde kullanılır.
 *
 * @param {string} durationStr - 'SS', 'DD:SS' veya 'SS:DD:SS' formatında süre
 * @param {number} [limit=180] - Karşılaştırma yapılacak saniye cinsinden üst sınır
 * @returns {boolean} Süre limiti aşmıyorsa true, aşıyorsa false
 */
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

/**
 * Veritabanındaki belirtilen video kaydını kısmi olarak günceller.
 * Yalnızca `updates` nesnesinde verilen alanlar değiştirilir, diğerleri korunur.
 *
 * @param {string} videoId - Güncellenecek videonun YouTube ID'si
 * @param {object} updates - Uygulanacak kısmi güncelleme alanları (örn. `{ status: 'completed', progress: 100 }`)
 * @returns {void}
 */
export function updateHistoryItem(videoId, updates) {
  const db = readDb();
  const index = db.history.findIndex(h => h.id === videoId);
  if (index !== -1) {
    if (updates && updates.error && typeof updates.error === 'string' && updates.error.length > 2000) {
      updates.error = updates.error.slice(-2000);
    }
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

