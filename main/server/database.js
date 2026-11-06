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
  writeIni,
  dataRootDir,
  isValidFileContent,
  atomicWriteFileSyncWithFlush,
  atomicWriteFileAsyncWithFlush,
  rotateValidBackupsSync,
  readAndHealFileSync
} from './config.js';
import { getVideoResolution } from './services/paths.js';
import { isInsideFakap } from './services/fakapPaths.js';
import { addTerminalLog, broadcast, broadcastHistoryUpdate } from './services/sse.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const appRootDir = path.resolve(__dirname, '..');
const isAppImage = process.env.APPIMAGE;

export const dbPath = path.join(dataRootDir, 'db.json');
export const defaultDownloadDir = path.join(os.homedir(), 'Downloads', 'HaYTooLYouTubeAutoDownloads');

/**
 * İşletim sisteminin dilini algılayıp uygulamanın desteklediği dillerden birine eşler.
 * İlk kurulumda (db.json yokken) varsayılan arayüz dili olarak kullanılır.
 * Desteklenmeyen sistem dillerinde 'en' döner.
 *
 * @returns {string} 'tr' | 'en' | 'es' | 'de' | 'pt' | 'ar' | 'ru'
 */
export function detectSystemLang() {
  const supported = ['tr', 'en', 'es', 'de', 'pt', 'ar', 'ru'];
  try {
    const candidates = [
      Intl.DateTimeFormat().resolvedOptions().locale,
      process.env.LC_ALL,
      process.env.LC_MESSAGES,
      process.env.LANG,
      process.env.LANGUAGE
    ];
    for (const raw of candidates) {
      if (!raw || typeof raw !== 'string') continue;
      const code = raw.toLowerCase().split(/[-_.:@]/)[0];
      if (supported.includes(code)) return code;
    }
  } catch (e) {}
  return 'en';
}

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
    quality: 'best',
    channelCheckInterval: 30,
    autoDownload: true,
    showShorts: false,
    rssLimit: 15,
    autoDeleteDays: 0,
    autoDeleteMaxCount: 0,
    autoDeleteRequireConfirmation: true,
    theme: 'dark',
    shortsMigrationDone: true,
    cookieDefaultMigrationDone: true,
    downloadSpeedLimit: 0,
    useAlternativeSpeed: false,
    deferMerge: false,
    alternativeSpeedLimit: 3000,
    port: 4141,
    playerPreference: 'system',
    playerType: 'plyr',
    subtitleColor: '#ffffff',
    subtitleOpacity: '0.7',
    subtitleSize: '26px',
    lang: detectSystemLang(),
    preferredAudioLang: 'tr',
    isPaused: false,
    showNotifications: true,
    autoOpenBrowser: true,
    historyLimitPerChannel: 30,
    mergeType: 'single',
    hardwareAcceleration: 'auto',
    writeThumbnail: false,
    playSounds: true,
    shortsDurationLimit: 180,
    sponsorBlockEnabled: false,
    discordRpcEnabled: false,
    doubleClickAction: 'player',
    tempDirType: 'system',
    useTempDownloadStaging: false,
    durationFetchMethod: 'auto',
    ytdlpRunMode: 'exe',
    liveStreamHandling: 'instant_retry',
    liveStreamRetryInterval: 30,
    pythonCmd: os.platform() === 'win32' ? 'python' : 'python3',
    maxConcurrentDownloads: 1,
    hideOnDelete: true,
    markWatchedOnDelete: true,
    autoSyncWatchtime: true,
    autoSyncLocalWatchtime: true,
    autoDiskSync: true,
    periodicDiskSyncInterval: '360',
    autoCookieRefresh: true,
    cookieRefreshInterval: 30,
    checkChannelsOnStartup: false,
    checkYtdlpOnStartup: false,
    ytdlpStartupTarget: 'nightly',
    enableAltThumbnailsHover: true,
    githubToken: '',
    githubGistId: '',
    autoSyncGist: false,
    channelScanMode: 'fast',
    weatherEnabled: true,
    weatherCity: 'Derince',
    weatherLatitude: 40.75694,
    weatherLongitude: 29.81472,
    weatherUnit: 'celsius',
    queueViewMode: 'table',
    networkRetryIntervalSeconds: 120,
    fakapEnabled: true,
    fakapPath: '',
    fakapQuality: '360',
    fakapRetentionDays: 'never',
    aiProvider: 'auto',
    geminiApiKey: '',
    groqApiKey: '',
    deepseekApiKey: '',
    openAiApiKey: '',
    lmStudioPort: 1234,
    lmStudioModel: '',
    ggufModelPath: '',
    ggufModelsDir: '',
    ggufGpuMode: true,
    unloadUiOnHide: true,
    playerGpuMode: 'gpu',
    historyShowLive: true,
    historyShowUpcoming: false,
    ttsVoiceId: '',
    ttsSpeed: 1,
    ttsVoicesDir: ''
  },
  deletedVideos: []
};

let cachedDb = null;
let lastDbJsonMtime = 0;
let lastConfigIniMtime = 0;
let lastChannelsIniMtime = 0;
let lastCategoriesIniMtime = 0;
let lastCacheCheckTime = 0;
const DB_CACHE_TTL_MS = 1500;

/**
 * Bellek içi db önbelleğini geçersiz kılar, bir sonraki readDb doğrudan diskten okur.
 */
export function invalidateDbCache() {
  lastCacheCheckTime = 0;
  cachedDb = null;
}

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
 * Kanal denetleme sıklığı birim göçü yardımcıları (saniye -> dakika).
 * Geçerli aralık 5-1440 dakikadır.
 */
function toIntervalMinutes(v) {
  const n = parseInt(v, 10);
  if (!n || n < 0) return 30;
  return Math.min(1440, Math.max(5, Math.round(n / 60)));
}

function migrateIniChannelInterval() {
  try {
    if (!fs.existsSync(configIniPath)) return;
    const raw = fs.readFileSync(configIniPath, 'utf-8');
    const re = /^(\s*channelCheckInterval\s*=\s*)(\d+)/m;
    if (!re.test(raw)) return;
    fs.writeFileSync(configIniPath, raw.replace(re, (m, p, n) => p + toIntervalMinutes(n)), 'utf-8');
  } catch (e) {}
}

/**
 * Veritabanını (db.json) dosyadan okur, eksik alanları varsayılanlarla doldurur,
 * INI dosyalarıyla eşitler ve RAM önbelleğini yönetir.
 * 
 * @returns {object} Güncel veritabanı nesnesi
 */
export function readDb() {
  try {
    const now = Date.now();
    // Bellek önbelleği geçerliyse (1500ms TTL) disk stat kontrollerini atlayarak doğrudan dön
    if (cachedDb && (now - lastCacheCheckTime < DB_CACHE_TTL_MS)) {
      return cachedDb;
    }

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
      lastCacheCheckTime = now;
      return cachedDb;
    }

    let db = defaultDb;
    let channelIntervalMigrated = false;
    const rawDbData = readAndHealFileSync(dbPath, 'json');
    if (rawDbData) {
      const parsed = JSON.parse(rawDbData.replace(/^\uFEFF/, ''));
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
      // Kanal denetleme sıklığı birim göçü (saniye -> dakika), tek seferlik
      if (!db.settings.channelIntervalInMinutes) {
        const hadValue = parsed.settings && (parsed.settings.channelCheckInterval !== undefined || parsed.settings.checkInterval !== undefined);
        if (hadValue) {
          db.settings.channelCheckInterval = toIntervalMinutes(db.settings.channelCheckInterval);
          migrateIniChannelInterval();
        }
        db.settings.channelIntervalInMinutes = true;
        channelIntervalMigrated = true;
      }
      if (db.settings.rssDelay !== undefined) {
        delete db.settings.rssDelay;
      }

      // Şifrelenmiş hassas anahtarlar (Token/API Keys) varsa RAM'e yüklerken çöz
      if (db.settings) {
        const sensitiveFields = ['githubToken', 'geminiApiKey', 'groqApiKey', 'openAiApiKey', 'deepseekApiKey'];
        for (const f of sensitiveFields) {
          if (db.settings[f]) {
            db.settings[f] = decryptSecret(db.settings[f]);
          }
        }
      }
    } else {
      atomicWriteFileSyncWithFlush(dbPath, JSON.stringify(defaultDb, null, 2));
      dbJsonMtime = fs.statSync(dbPath).mtimeMs;
    }
    
    // config.ini ve channels.ini dosyasından eşitleme yap
    syncWithIni(db);

    // Kanal denetleme sıklığı güvenlik sınırı (5-1440 dk); eski saniye değeri kalmışsa dakikaya çevir
    if (!db.settings.channelIntervalInMinutes) {
      db.settings.channelIntervalInMinutes = true;
      channelIntervalMigrated = true;
    }
    {
      let civ = parseInt(db.settings.channelCheckInterval, 10) || 30;
      if (civ > 1440) civ = Math.round(civ / 60);
      civ = Math.min(1440, Math.max(5, civ));
      if (civ !== db.settings.channelCheckInterval) channelIntervalMigrated = true;
      db.settings.channelCheckInterval = civ;
    }
    if (channelIntervalMigrated) {
      writeDb(db);
    }

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

    // Çerez varsayılanı migrasyonu kaldırıldı: tarayıcı çerez sistemi (browser ayarı) tamamen kullanımdan kaldırıldı
    if (!db.settings.cookieDefaultMigrationDone) {
      db.settings.cookieDefaultMigrationDone = true;
      writeDb(db);
      saveSettingsToIni(db);
    }

    // RAM Önbelleği güncelle
    cachedDb = db;
    lastCacheCheckTime = now;
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
export async function writeDb(data) {
  const release = await acquireDbLock();
  try {
    await writeDbUnlocked(data);
  } finally {
    release();
  }
}

/**
 * Türkçe Açıklama: Ani veri sıfırlanmasına (kanal veya geçmiş listesinin yanlışlıkla 0'lanmasına) karşı
 * ezilmeden hemen önce mevcut sağlam db.json dosyasını db.json.emergency.bak olarak koruma altına alır.
 */
function guardAgainstMassWipeSync(targetDbPath, incomingData) {
  try {
    if (!fs.existsSync(targetDbPath)) return;
    const raw = fs.readFileSync(targetDbPath, 'utf-8');
    if (!isValidFileContent(raw, 'json')) return;
    const existing = JSON.parse(raw.replace(/^\uFEFF/, ''));
    const prevChannels = Array.isArray(existing.channels) ? existing.channels.length : 0;
    const prevHistory = Array.isArray(existing.history) ? existing.history.length : 0;
    const nextChannels = Array.isArray(incomingData?.channels) ? incomingData.channels.length : 0;
    const nextHistory = Array.isArray(incomingData?.history) ? incomingData.history.length : 0;

    if ((prevChannels >= 3 && nextChannels === 0) || (prevHistory >= 10 && nextHistory === 0)) {
      const emergencyPath = `${targetDbPath}.emergency.bak`;
      fs.copyFileSync(targetDbPath, emergencyPath);
      console.warn(`[Sanity Guard] ⚠️ Ani veri azalması tespit edildi (Kanallar: ${prevChannels}->${nextChannels}, Geçmiş: ${prevHistory}->${nextHistory}). Acil durum yedeği alındı: ${path.basename(emergencyPath)}`);
    }
  } catch (_) {}
}

/**
 * Kilit almadan yazan iç fonksiyon. Yalnızca kilit zaten elde tutuluyorken
 * (writeDb veya updateDb içinden) çağrılmalıdır; aksi halde kilit çakışır.
 */
async function writeDbUnlocked(data) {
  try {
    // RAM önbelleği hemen güncelleyelim ki gecikme olmasın
    cachedDb = data;
    lastCacheCheckTime = Date.now();
    
    // Ani sıfırlanma kilidi + Doğrulamalı 3 kademeli döner yedek (bak1, bak2, bak3, .bak)
    guardAgainstMassWipeSync(dbPath, data);
    rotateValidBackupsSync(dbPath, 'json');

    // Disk için kopyasını al ve hassas verileri (githubToken, API Keys) AES-256 ile şifrele
    const dataToSave = JSON.parse(JSON.stringify(data));
    if (dataToSave.settings) {
      const sensitiveFields = ['githubToken', 'geminiApiKey', 'groqApiKey', 'openAiApiKey', 'deepseekApiKey'];
      for (const f of sensitiveFields) {
        if (dataToSave.settings[f]) {
          dataToSave.settings[f] = encryptSecret(dataToSave.settings[f]);
        }
      }
    }

    const dbString = JSON.stringify(dataToSave);
    await atomicWriteFileAsyncWithFlush(dbPath, dbString);

    try {
      const stats = await fs.promises.stat(dbPath);
      lastDbJsonMtime = stats.mtimeMs;
    } catch (e) {}
    
    // Eş zamanlı olarak config.ini ve channels.ini dosyalarını güncelle
    await saveSettingsToIni(data);
    await saveChannelsToIni(data);
    await saveCategoriesToIni(data);
  } catch (err) {
    console.error('Veritabanı yazma hatası:', err);
  }
}

/**
 * Kilit altında oku-değiştir-yaz yapar. Mutator veritabanı nesnesini yerinde değiştirir.
 * Kilit zaten alındığı için içeride writeDb() ÇAĞRILMAMALIDIR (kilit çakışır).
 *
 * @param {(db: object) => any} mutator
 * @returns {Promise<any>} mutator'ın dönüş değeri
 */
export async function updateDb(mutator) {
  const release = await acquireDbLock();
  try {
    const db = readDb();
    const result = await mutator(db);
    await writeDbUnlocked(db);
    return result;
  } finally {
    release();
  }
}

// Son hızlı yedek zaman damgası (writeDbFast için seyrek .bak kontrolü)
let lastFastBackupMs = 0;
const FAST_BACKUP_INTERVAL_MS = 5 * 60 * 1000; // 5 dakikada bir .bak al

/**
 * Silme işlemleri için optimize edilmiş hızlı DB yazma fonksiyonu.
 * Farklar: .bak yedek alma (5 dk'dan az geçmişse atlanır) ve INI senkronizasyonu yapılmaz.
 * Settings veya kanal değişikliklerinde bu fonksiyonu KULLANMA; writeDb() kullan.
 *
 * @param {object} data Yazılacak veritabanı nesnesi
 * @returns {Promise<void>}
 */
export async function writeDbFast(data) {
  try {
    // RAM önbelleği hemen güncelle
    cachedDb = data;
    lastCacheCheckTime = Date.now();

    // Ani sıfırlanma kilidi + Seyrek doğrulamalı 3 kademeli yedek: son 5 dakikada alınmamışsa al
    guardAgainstMassWipeSync(dbPath, data);
    const now = Date.now();
    if (now - lastFastBackupMs > FAST_BACKUP_INTERVAL_MS) {
      rotateValidBackupsSync(dbPath, 'json');
      lastFastBackupMs = now;
    }

    // Disk kopyasını hazırla, hassas veriyi (Token ve AI API Keys) şifrele
    const dataToSave = JSON.parse(JSON.stringify(data));
    if (dataToSave.settings) {
      const sensitiveFields = ['githubToken', 'geminiApiKey', 'groqApiKey', 'openAiApiKey', 'deepseekApiKey'];
      for (const f of sensitiveFields) {
        if (dataToSave.settings[f]) {
          dataToSave.settings[f] = encryptSecret(dataToSave.settings[f]);
        }
      }
    }

    const dbString = JSON.stringify(dataToSave);
    await atomicWriteFileAsyncWithFlush(dbPath, dbString);

    try {
      lastDbJsonMtime = fs.statSync(dbPath).mtimeMs;
    } catch (e) {}

    // NOT: INI senkronizasyonu kasıtlı olarak atlanıyor.
    // Silme işlemi settings/channels değiştirmez; INI tutarlılığı bozulmaz.
    console.log(`[writeDbFast] DB başarıyla yazıldı (hızlı yol, INI atlandı).`);
  } catch (err) {
    console.error('[writeDbFast] Veritabanı hızlı yazma hatası:', err);
    // Fallback: senkron yolu dene
    try {
      writeDb(data);
    } catch (fallbackErr) {
      console.error('[writeDbFast] Fallback writeDb de başarısız:', fallbackErr);
    }
  }
}

/**
 * INI yapılandırma dosyalarındaki verileri okur ve ana veritabanı (db.json) nesnesi ile senkronize eder.
 * 
 * @param {object} db Senkronize edilecek veritabanı nesnesi
 */
export function syncWithIni(db) {
  // icon.ico kontrolü
  const pngPath = path.join(appRootDir, 'public', 'logo.png');
  const icoPath = path.join(appRootDir, 'icon.ico');
  if (!fs.existsSync(icoPath) && fs.existsSync(pngPath)) {
    convertPngToIco(pngPath, icoPath);
  }

  // Eski tekil config.ini dosyasından yeni işletim sistemine özel yapılandırmaya göç
  const oldConfigIniPath = path.join(dataRootDir, 'config.ini');
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
  const configIniTypoPath = path.join(dataRootDir, 'config.inilş');
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

  // 1. config.ini (Ayarlar) Eşitlemesi — parseIni bozuk dosyayı otomatik olarak .bak1/.bak2/.bak3'ten onarır
  const iniData = parseIni(configIniPath);
  const settingsSection = getCaseInsensitiveKey(iniData, 'Settings') || iniData;
  if (!settingsSection || Object.keys(settingsSection).length === 0) {
    console.log(`[Sync] ${configIniName} bulunamadı veya boş. Mevcut ayarlarla oluşturuluyor.`);
    saveSettingsToIni(db);
  } else {
    if (settingsSection) {
      const downloadPath = getCaseInsensitiveKey(settingsSection, 'downloadPath');
      if (downloadPath !== undefined && downloadPath.trim() !== '') {
        db.settings.downloadPath = downloadPath.trim();
      } else if (!db.settings.downloadPath) {
        db.settings.downloadPath = defaultDownloadDir;
      }

      const quality = getCaseInsensitiveKey(settingsSection, 'quality');
      if (quality !== undefined) db.settings.quality = quality;

      const channelCheckInterval = getCaseInsensitiveKey(settingsSection, 'channelCheckInterval');
      if (channelCheckInterval !== undefined) {
        db.settings.channelCheckInterval = parseInt(channelCheckInterval, 10) || 30;
      }

      const autoDownload = getCaseInsensitiveKey(settingsSection, 'autoDownload');
      if (autoDownload !== undefined) {
        db.settings.autoDownload = autoDownload === 'true';
      }

      const mergeType = getCaseInsensitiveKey(settingsSection, 'mergeType');
      if (mergeType !== undefined) db.settings.mergeType = mergeType;

      const hardwareAcceleration = getCaseInsensitiveKey(settingsSection, 'hardwareAcceleration');
      if (hardwareAcceleration !== undefined) db.settings.hardwareAcceleration = hardwareAcceleration;

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

      const autoDeleteMaxCount = getCaseInsensitiveKey(settingsSection, 'autoDeleteMaxCount');
      if (autoDeleteMaxCount !== undefined) {
        db.settings.autoDeleteMaxCount = parseInt(autoDeleteMaxCount, 10) || 0;
      }

      const autoDeleteRequireConfirmation = getCaseInsensitiveKey(settingsSection, 'autoDeleteRequireConfirmation');
      if (autoDeleteRequireConfirmation !== undefined) {
        db.settings.autoDeleteRequireConfirmation = autoDeleteRequireConfirmation === true || autoDeleteRequireConfirmation === 'true';
      }

      const downloadSpeedLimit = getCaseInsensitiveKey(settingsSection, 'downloadSpeedLimit');
      if (downloadSpeedLimit !== undefined) {
        db.settings.downloadSpeedLimit = parseInt(downloadSpeedLimit, 10) || 0;
      }

      const useAlternativeSpeed = getCaseInsensitiveKey(settingsSection, 'useAlternativeSpeed');
      if (useAlternativeSpeed !== undefined) {
        db.settings.useAlternativeSpeed = useAlternativeSpeed === 'true';
      }

      const deferMerge = getCaseInsensitiveKey(settingsSection, 'deferMerge');
      if (deferMerge !== undefined) {
        db.settings.deferMerge = deferMerge === 'true';
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

      const checkChannelsOnStartup = getCaseInsensitiveKey(settingsSection, 'checkChannelsOnStartup');
      if (checkChannelsOnStartup !== undefined) {
        db.settings.checkChannelsOnStartup = checkChannelsOnStartup === 'true';
      }

      const checkYtdlpOnStartup = getCaseInsensitiveKey(settingsSection, 'checkYtdlpOnStartup');
      if (checkYtdlpOnStartup !== undefined) {
        db.settings.checkYtdlpOnStartup = checkYtdlpOnStartup === 'true';
      }

      const ytdlpStartupTarget = getCaseInsensitiveKey(settingsSection, 'ytdlpStartupTarget');
      if (ytdlpStartupTarget !== undefined && ytdlpStartupTarget.trim()) {
        db.settings.ytdlpStartupTarget = ytdlpStartupTarget.trim();
      }

      const sponsorBlockEnabled = getCaseInsensitiveKey(settingsSection, 'sponsorBlockEnabled');
      if (sponsorBlockEnabled !== undefined) {
        db.settings.sponsorBlockEnabled = sponsorBlockEnabled === 'true';
      }

      const networkRetryIntervalSeconds = getCaseInsensitiveKey(settingsSection, 'networkRetryIntervalSeconds');
      if (networkRetryIntervalSeconds !== undefined) {
        db.settings.networkRetryIntervalSeconds = parseInt(networkRetryIntervalSeconds, 10) || 120;
      }

      const discordRpcEnabled = getCaseInsensitiveKey(settingsSection, 'discordRpcEnabled');
      if (discordRpcEnabled !== undefined) {
        db.settings.discordRpcEnabled = discordRpcEnabled === 'true';
      }

      const doubleClickAction = getCaseInsensitiveKey(settingsSection, 'doubleClickAction');
      if (doubleClickAction !== undefined) {
        db.settings.doubleClickAction = doubleClickAction;
      }

      const useTempDownloadStaging = getCaseInsensitiveKey(settingsSection, 'useTempDownloadStaging');
      if (useTempDownloadStaging !== undefined) {
        db.settings.useTempDownloadStaging = useTempDownloadStaging === 'true';
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

      const autoSyncLocalWatchtime = getCaseInsensitiveKey(settingsSection, 'autoSyncLocalWatchtime');
      if (autoSyncLocalWatchtime !== undefined) {
        db.settings.autoSyncLocalWatchtime = autoSyncLocalWatchtime !== 'false';
      }

      const autoDiskSync = getCaseInsensitiveKey(settingsSection, 'autoDiskSync');
      if (autoDiskSync !== undefined) {
        db.settings.autoDiskSync = autoDiskSync !== 'false';
      }

      const periodicDiskSyncInterval = getCaseInsensitiveKey(settingsSection, 'periodicDiskSyncInterval');
      if (periodicDiskSyncInterval !== undefined) {
        db.settings.periodicDiskSyncInterval = periodicDiskSyncInterval;
      }

      const autoCookieRefresh = getCaseInsensitiveKey(settingsSection, 'autoCookieRefresh');
      if (autoCookieRefresh !== undefined) {
        db.settings.autoCookieRefresh = autoCookieRefresh !== 'false';
      }

      const cookieRefreshInterval = getCaseInsensitiveKey(settingsSection, 'cookieRefreshInterval');
      if (cookieRefreshInterval !== undefined) {
        db.settings.cookieRefreshInterval = parseInt(cookieRefreshInterval, 10) || 30;
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
        db.settings.weatherLatitude = parseFloat(weatherLatitude) || 40.75694;
      }

      const weatherLongitude = getCaseInsensitiveKey(settingsSection, 'weatherLongitude');
      if (weatherLongitude !== undefined) {
        db.settings.weatherLongitude = parseFloat(weatherLongitude) || 29.81472;
      }

      const weatherUnit = getCaseInsensitiveKey(settingsSection, 'weatherUnit');
      if (weatherUnit !== undefined) {
        db.settings.weatherUnit = weatherUnit;
      }

      const queueViewMode = getCaseInsensitiveKey(settingsSection, 'queueViewMode');
      if (queueViewMode !== undefined) {
        db.settings.queueViewMode = queueViewMode;
      }

      const historyViewMode = getCaseInsensitiveKey(settingsSection, 'historyViewMode');
      if (historyViewMode !== undefined) {
        db.settings.historyViewMode = historyViewMode;
      }

      const downloadedViewMode = getCaseInsensitiveKey(settingsSection, 'downloadedViewMode');
      if (downloadedViewMode !== undefined) {
        db.settings.downloadedViewMode = downloadedViewMode;
      }

      const downloadedSortMode = getCaseInsensitiveKey(settingsSection, 'downloadedSortMode');
      if (downloadedSortMode !== undefined) {
        db.settings.downloadedSortMode = downloadedSortMode;
      }

      const historySortMode = getCaseInsensitiveKey(settingsSection, 'historySortMode');
      if (historySortMode !== undefined) {
        db.settings.historySortMode = historySortMode;
      }

      // Kütüphane hızlı filtre durumları (çipler) configwin.ini'den yüklenir
      const historyShowLive = getCaseInsensitiveKey(settingsSection, 'historyShowLive');
      if (historyShowLive !== undefined) {
        db.settings.historyShowLive = historyShowLive !== 'false';
      }
      const historyShowUpcoming = getCaseInsensitiveKey(settingsSection, 'historyShowUpcoming');
      if (historyShowUpcoming !== undefined) {
        db.settings.historyShowUpcoming = historyShowUpcoming === 'true';
      }
      const historyOnlyNoAutoDownload = getCaseInsensitiveKey(settingsSection, 'historyOnlyNoAutoDownload');
      if (historyOnlyNoAutoDownload !== undefined) {
        db.settings.historyOnlyNoAutoDownload = historyOnlyNoAutoDownload === 'true';
      }
      const historyOnlyNotDownloaded = getCaseInsensitiveKey(settingsSection, 'historyOnlyNotDownloaded');
      if (historyOnlyNotDownloaded !== undefined) {
        db.settings.historyOnlyNotDownloaded = historyOnlyNotDownloaded === 'true';
      }
      const historyOnlyLiveProcessing = getCaseInsensitiveKey(settingsSection, 'historyOnlyLiveProcessing');
      if (historyOnlyLiveProcessing !== undefined) {
        db.settings.historyOnlyLiveProcessing = historyOnlyLiveProcessing === 'true';
      }
      const historyShowMembers = getCaseInsensitiveKey(settingsSection, 'historyShowMembers');
      if (historyShowMembers !== undefined) {
        db.settings.historyShowMembers = historyShowMembers !== 'false';
      }
      const historyShowHidden = getCaseInsensitiveKey(settingsSection, 'historyShowHidden');
      if (historyShowHidden !== undefined) {
        db.settings.historyShowHidden = historyShowHidden === 'true';
      }

      // Fakap (Otomatik Yedek) ayarları configwin.ini'den yüklenir
      const fakapEnabled = getCaseInsensitiveKey(settingsSection, 'fakapEnabled');
      if (fakapEnabled !== undefined) {
        db.settings.fakapEnabled = fakapEnabled !== 'false';
      }
      const fakapPath = getCaseInsensitiveKey(settingsSection, 'fakapPath');
      if (fakapPath !== undefined) {
        db.settings.fakapPath = String(fakapPath || '').trim();
      }
      const fakapQuality = getCaseInsensitiveKey(settingsSection, 'fakapQuality');
      if (fakapQuality !== undefined && ['144', '240', '360'].includes(String(fakapQuality).replace(/p$/i, ''))) {
        db.settings.fakapQuality = String(fakapQuality).replace(/p$/i, '');
      }
      const fakapRetentionDays = getCaseInsensitiveKey(settingsSection, 'fakapRetentionDays');
      if (fakapRetentionDays !== undefined) {
        db.settings.fakapRetentionDays = String(fakapRetentionDays);
      }

      const preferredAudioLang = getCaseInsensitiveKey(settingsSection, 'preferredAudioLang');
      if (preferredAudioLang !== undefined) db.settings.preferredAudioLang = String(preferredAudioLang).trim();

      const historyLimitPerChannel = getCaseInsensitiveKey(settingsSection, 'historyLimitPerChannel');
      if (historyLimitPerChannel !== undefined) db.settings.historyLimitPerChannel = parseInt(historyLimitPerChannel, 10) || 30;

      const shortsDurationLimit = getCaseInsensitiveKey(settingsSection, 'shortsDurationLimit');
      if (shortsDurationLimit !== undefined) db.settings.shortsDurationLimit = parseInt(shortsDurationLimit, 10) || 180;

      const tempDirType = getCaseInsensitiveKey(settingsSection, 'tempDirType');
      if (tempDirType !== undefined) db.settings.tempDirType = tempDirType;

      const durationFetchMethod = getCaseInsensitiveKey(settingsSection, 'durationFetchMethod');
      if (durationFetchMethod !== undefined) db.settings.durationFetchMethod = durationFetchMethod;

      const ytdlpRunMode = getCaseInsensitiveKey(settingsSection, 'ytdlpRunMode');
      if (ytdlpRunMode !== undefined) db.settings.ytdlpRunMode = ytdlpRunMode;

      const liveStreamHandling = getCaseInsensitiveKey(settingsSection, 'liveStreamHandling');
      if (liveStreamHandling !== undefined) db.settings.liveStreamHandling = liveStreamHandling;

      const liveStreamRetryInterval = getCaseInsensitiveKey(settingsSection, 'liveStreamRetryInterval');
      if (liveStreamRetryInterval !== undefined) db.settings.liveStreamRetryInterval = parseInt(liveStreamRetryInterval, 10) || 30;

      const pythonCmd = getCaseInsensitiveKey(settingsSection, 'pythonCmd');
      if (pythonCmd !== undefined) db.settings.pythonCmd = pythonCmd;

      const maxConcurrentDownloads = getCaseInsensitiveKey(settingsSection, 'maxConcurrentDownloads');
      if (maxConcurrentDownloads !== undefined) db.settings.maxConcurrentDownloads = parseInt(maxConcurrentDownloads, 10) || 1;

      const hideOnDelete = getCaseInsensitiveKey(settingsSection, 'hideOnDelete');
      if (hideOnDelete !== undefined) db.settings.hideOnDelete = hideOnDelete !== 'false';

      const channelScanMode = getCaseInsensitiveKey(settingsSection, 'channelScanMode');
      if (channelScanMode !== undefined) db.settings.channelScanMode = channelScanMode;

      const aiProvider = getCaseInsensitiveKey(settingsSection, 'aiProvider');
      if (aiProvider !== undefined) db.settings.aiProvider = aiProvider;

      const lmStudioPort = getCaseInsensitiveKey(settingsSection, 'lmStudioPort');
      if (lmStudioPort !== undefined) db.settings.lmStudioPort = parseInt(lmStudioPort, 10) || 1234;

      const lmStudioModel = getCaseInsensitiveKey(settingsSection, 'lmStudioModel');
      if (lmStudioModel !== undefined) db.settings.lmStudioModel = String(lmStudioModel).trim();

      const ggufModelPath = getCaseInsensitiveKey(settingsSection, 'ggufModelPath');
      if (ggufModelPath !== undefined) db.settings.ggufModelPath = String(ggufModelPath).trim();

      const ggufModelsDir = getCaseInsensitiveKey(settingsSection, 'ggufModelsDir');
      if (ggufModelsDir !== undefined) db.settings.ggufModelsDir = String(ggufModelsDir).trim();

      const ggufGpuMode = getCaseInsensitiveKey(settingsSection, 'ggufGpuMode');
      if (ggufGpuMode !== undefined) db.settings.ggufGpuMode = ggufGpuMode !== 'false';

      const unloadUiOnHide = getCaseInsensitiveKey(settingsSection, 'unloadUiOnHide');
      if (unloadUiOnHide !== undefined) db.settings.unloadUiOnHide = unloadUiOnHide !== 'false';

      const playerGpuMode = getCaseInsensitiveKey(settingsSection, 'playerGpuMode');
      if (playerGpuMode !== undefined && ['gpu', 'cpu'].includes(String(playerGpuMode).trim().toLowerCase())) {
        db.settings.playerGpuMode = String(playerGpuMode).trim().toLowerCase();
      }

      const ttsVoiceId = getCaseInsensitiveKey(settingsSection, 'ttsVoiceId');
      if (ttsVoiceId !== undefined) db.settings.ttsVoiceId = String(ttsVoiceId).trim();

      const ttsSpeed = getCaseInsensitiveKey(settingsSection, 'ttsSpeed');
      if (ttsSpeed !== undefined) db.settings.ttsSpeed = parseFloat(ttsSpeed) || 1;

      const ttsVoicesDir = getCaseInsensitiveKey(settingsSection, 'ttsVoicesDir');
      if (ttsVoicesDir !== undefined) db.settings.ttsVoicesDir = String(ttsVoicesDir).trim();

      const githubGistId = getCaseInsensitiveKey(settingsSection, 'githubGistId');
      if (githubGistId !== undefined) db.settings.githubGistId = String(githubGistId).trim();

      const autoSyncGist = getCaseInsensitiveKey(settingsSection, 'autoSyncGist');
      if (autoSyncGist !== undefined) db.settings.autoSyncGist = autoSyncGist === 'true';
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

  // 2. channels.ini (Kanallar) Eşitlemesi — parseIni bozuk dosyayı otomatik olarak .bak1/.bak2/.bak3'ten onarır
  let channelsData = null;
  if (migratedChannels) {
    channelsData = migratedChannels;
  } else {
    const parsedChannels = parseIni(channelsIniPath);
    channelsData = getCaseInsensitiveKey(parsedChannels, 'Channels') || parsedChannels;
    if (!channelsData || Object.keys(channelsData).length === 0) {
      if (db.channels && db.channels.length > 0) {
        console.warn(`[Uyarı] channels.ini boş/bulunamadı fakat db.json içinde ${db.channels.length} kanal var. channels.ini koruma amacıyla yeniden yazılıyor.`);
        saveChannelsToIni(db);
      }
      channelsData = null;
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
      let autoDeleteDays = 'never';
      let autoDeleteMaxCount = 'none';
      // Fakap (13. alan): kapalıysa 'false', açıksa açılış zaman damgası (ISO) veya 'true'.
      // null => eski formatta yok, mevcut db.fakap durumu korunur.
      let fakapValue = null;
      if (parts.length >= 13) {
        fakapValue = parts[parts.length - 1];
        autoDeleteMaxCount = parts[parts.length - 2];
        autoDeleteDays = parts[parts.length - 3];
        subscriberCountFromIni = parts[parts.length - 4];
        const catPart = parts[parts.length - 5];
        if (catPart.includes(',')) {
          categoryIds = catPart.split(',').map(x => parseInt(x.trim(), 10) || 1);
        } else {
          categoryIds = [parseInt(catPart, 10) || 1];
        }
        categoryId = categoryIds[0] || 1;
        autoDownload = parts[parts.length - 6] === 'true';
        shortsDurationLimit = parseInt(parts[parts.length - 7], 10) || 180;
        avatar = parts[parts.length - 8];
        downloadShorts = parts[parts.length - 9] === 'true';
        quality = parts[parts.length - 10];
        addedAt = parts[parts.length - 11];
        handleOrUrl = parts[parts.length - 12];
        name = parts.slice(0, parts.length - 12).join(' | ');
      } else if (parts.length === 12) {
        autoDeleteMaxCount = parts[parts.length - 1];
        autoDeleteDays = parts[parts.length - 2];
        subscriberCountFromIni = parts[parts.length - 3];
        const catPart = parts[parts.length - 4];
        if (catPart.includes(',')) {
          categoryIds = catPart.split(',').map(x => parseInt(x.trim(), 10) || 1);
        } else {
          categoryIds = [parseInt(catPart, 10) || 1];
        }
        categoryId = categoryIds[0] || 1;
        autoDownload = parts[parts.length - 5] === 'true';
        shortsDurationLimit = parseInt(parts[parts.length - 6], 10) || 180;
        avatar = parts[parts.length - 7];
        downloadShorts = parts[parts.length - 8] === 'true';
        quality = parts[parts.length - 9];
        addedAt = parts[parts.length - 10];
        handleOrUrl = parts[parts.length - 11];
        name = parts.slice(0, parts.length - 11).join(' | ');
      } else if (parts.length === 11) {
        autoDeleteDays = parts[parts.length - 1];
        subscriberCountFromIni = parts[parts.length - 2];
        const catPart = parts[parts.length - 3];
        if (catPart.includes(',')) {
          categoryIds = catPart.split(',').map(x => parseInt(x.trim(), 10) || 1);
        } else {
          categoryIds = [parseInt(catPart, 10) || 1];
        }
        categoryId = categoryIds[0] || 1;
        autoDownload = parts[parts.length - 4] === 'true';
        shortsDurationLimit = parseInt(parts[parts.length - 5], 10) || 180;
        avatar = parts[parts.length - 6];
        downloadShorts = parts[parts.length - 7] === 'true';
        quality = parts[parts.length - 8];
        addedAt = parts[parts.length - 9];
        handleOrUrl = parts[parts.length - 10];
        name = parts.slice(0, parts.length - 10).join(' | ');
      } else if (parts.length === 10) {
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
      const isAvatarValid = (url) => url && typeof url === 'string' && (url.startsWith('http') || url.startsWith('/') || url.startsWith('data:'));
      const dbAvatar = existingChannel ? (existingChannel.avatar || '') : '';
      const finalAvatar = isAvatarValid(avatar) ? avatar : (isAvatarValid(dbAvatar) ? dbAvatar : '');
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
       
      const finalAutoDeleteDays = existingChannel && existingChannel.autoDeleteDays !== undefined 
         ? existingChannel.autoDeleteDays 
         : autoDeleteDays;
       
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
         categoryIds: finalCategoryIds,
         autoDeleteDays: finalAutoDeleteDays,
          autoDeleteMaxCount: (existingChannel && existingChannel.autoDeleteMaxCount !== undefined) ? existingChannel.autoDeleteMaxCount : autoDeleteMaxCount,
          fakap: fakapValue
       });
    }
    db.channels = updatedChannels;

    // Fakap durumu artık channels.ini içindeki 13. alandan (tek doğru kaynak) yeniden kurulur.
    // Alan eski dosyalarda yoksa (null) mevcut db.fakap korunur ve bir sonraki yazımda ini'ye eklenir.
    const prevFakap = db.fakap || { channelIds: [], enabledAt: {} };
    const prevIds = Array.isArray(prevFakap.channelIds) ? prevFakap.channelIds : [];
    const prevStamps = (prevFakap.enabledAt && typeof prevFakap.enabledAt === 'object') ? prevFakap.enabledAt : {};
    const fakapIds = [];
    const fakapStamps = {};
    for (const ch of updatedChannels) {
      const fv = ch.fakap;
      if (fv === null || fv === undefined) {
        if (prevIds.includes(ch.id)) {
          fakapIds.push(ch.id);
          if (prevStamps[ch.id]) fakapStamps[ch.id] = prevStamps[ch.id];
        }
      } else if (fv !== 'false' && fv !== '0' && fv !== '') {
        fakapIds.push(ch.id);
        if (fv !== 'true' && fv !== '1') fakapStamps[ch.id] = fv;
      }
    }
    db.fakap = db.fakap || {};
    db.fakap.channelIds = fakapIds;
    db.fakap.enabledAt = fakapStamps;
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
export async function saveSettingsToIni(db) {
  const iniData = { Settings: {} };
  
  iniData.Settings.downloadPath = db.settings.downloadPath;
  iniData.Settings.quality = db.settings.quality;
  iniData.Settings.channelCheckInterval = (db.settings.channelCheckInterval !== undefined ? db.settings.channelCheckInterval : 30).toString();
  iniData.Settings.autoDownload = db.settings.autoDownload.toString();
  iniData.Settings.mergeType = (db.settings.mergeType || 'merge').toString();
  iniData.Settings.hardwareAcceleration = (db.settings.hardwareAcceleration || 'auto').toString();
  iniData.Settings.writeThumbnail = (db.settings.writeThumbnail !== false).toString();
  iniData.Settings.showShorts = (db.settings.showShorts !== false).toString();
  iniData.Settings.rssLimit = (db.settings.rssLimit !== undefined ? db.settings.rssLimit : 15).toString();
  iniData.Settings.autoDeleteDays = (db.settings.autoDeleteDays || 0).toString();
  iniData.Settings.autoDeleteMaxCount = (db.settings.autoDeleteMaxCount || 0).toString();
  iniData.Settings.autoDeleteRequireConfirmation = (db.settings.autoDeleteRequireConfirmation !== false).toString();
  iniData.Settings.theme = (db.settings.theme || 'dark').toString();
  iniData.Settings.downloadSpeedLimit = (db.settings.downloadSpeedLimit || 0).toString();
  iniData.Settings.useAlternativeSpeed = (db.settings.useAlternativeSpeed === true).toString();
  iniData.Settings.deferMerge = (db.settings.deferMerge === true).toString();
  iniData.Settings.alternativeSpeedLimit = (db.settings.alternativeSpeedLimit !== undefined ? db.settings.alternativeSpeedLimit : 3000).toString();
  iniData.Settings.port = (db.settings.port || 4141).toString();
  iniData.Settings.playerPreference = (db.settings.playerPreference || 'system').toString();
  iniData.Settings.playerType = (db.settings.playerType || 'plyr').toString();
  iniData.Settings.subtitleColor = (db.settings.subtitleColor || '#ffffff').toString();
  iniData.Settings.subtitleOpacity = (db.settings.subtitleOpacity !== undefined ? db.settings.subtitleOpacity : '0.7').toString();
  iniData.Settings.subtitleSize = (db.settings.subtitleSize || '26px').toString();
  iniData.Settings.playSounds = (db.settings.playSounds !== false).toString();
  iniData.Settings.lang = (db.settings.lang || 'en').toString();
  iniData.Settings.isPaused = (db.settings.isPaused === true).toString();
  iniData.Settings.showNotifications = (db.settings.showNotifications !== false).toString();
  iniData.Settings.autoOpenBrowser = (db.settings.autoOpenBrowser !== false).toString();
  iniData.Settings.checkChannelsOnStartup = (db.settings.checkChannelsOnStartup === true).toString();
  iniData.Settings.checkYtdlpOnStartup = (db.settings.checkYtdlpOnStartup === true).toString();
  iniData.Settings.ytdlpStartupTarget = (db.settings.ytdlpStartupTarget || 'nightly').toString();
  iniData.Settings.sponsorBlockEnabled = (db.settings.sponsorBlockEnabled === true).toString();
  iniData.Settings.discordRpcEnabled = (db.settings.discordRpcEnabled === true).toString();
  iniData.Settings.doubleClickAction = (db.settings.doubleClickAction || 'player').toString();
  iniData.Settings.useTempDownloadStaging = (db.settings.useTempDownloadStaging === true).toString();
  iniData.Settings.historyDurationFilter = (db.settings.historyDurationFilter || 'off').toString();
  iniData.Settings.enableAltThumbnailsHover = (db.settings.enableAltThumbnailsHover !== false).toString();
  iniData.Settings.weatherEnabled = (db.settings.weatherEnabled !== false).toString();
  iniData.Settings.weatherCity = (db.settings.weatherCity || 'Derince').toString();
  iniData.Settings.weatherLatitude = (db.settings.weatherLatitude !== undefined ? db.settings.weatherLatitude : 40.75694).toString();
  iniData.Settings.weatherLongitude = (db.settings.weatherLongitude !== undefined ? db.settings.weatherLongitude : 29.81472).toString();
  iniData.Settings.weatherUnit = (db.settings.weatherUnit || 'celsius').toString();
  iniData.Settings.queueViewMode = (db.settings.queueViewMode || 'table').toString();
  iniData.Settings.historyViewMode = (db.settings.historyViewMode || 'grid').toString();
  iniData.Settings.downloadedViewMode = (db.settings.downloadedViewMode || 'grid').toString();
  iniData.Settings.downloadedSortMode = (db.settings.downloadedSortMode || 'date-desc').toString();
  iniData.Settings.historySortMode = (db.settings.historySortMode || 'date-desc').toString();
  iniData.Settings.historyShowLive = (db.settings.historyShowLive !== false).toString();
  iniData.Settings.historyShowUpcoming = (db.settings.historyShowUpcoming === true).toString();
  iniData.Settings.historyOnlyNoAutoDownload = (db.settings.historyOnlyNoAutoDownload === true).toString();
  iniData.Settings.historyOnlyNotDownloaded = (db.settings.historyOnlyNotDownloaded === true).toString();
  iniData.Settings.historyOnlyLiveProcessing = (db.settings.historyOnlyLiveProcessing === true).toString();
  iniData.Settings.historyShowMembers = (db.settings.historyShowMembers !== false).toString();
  iniData.Settings.historyShowHidden = (db.settings.historyShowHidden === true).toString();
  iniData.Settings.markWatchedOnDelete = (db.settings.markWatchedOnDelete !== false).toString();
  iniData.Settings.autoSyncWatchtime = (db.settings.autoSyncWatchtime !== false).toString();
  iniData.Settings.autoSyncLocalWatchtime = (db.settings.autoSyncLocalWatchtime !== false).toString();
  iniData.Settings.autoDiskSync = (db.settings.autoDiskSync !== false).toString();
  iniData.Settings.periodicDiskSyncInterval = (db.settings.periodicDiskSyncInterval || '360').toString();
  iniData.Settings.autoCookieRefresh = (db.settings.autoCookieRefresh !== false).toString();
  iniData.Settings.cookieRefreshInterval = (db.settings.cookieRefreshInterval !== undefined ? db.settings.cookieRefreshInterval : 30).toString();
  iniData.Settings.networkRetryIntervalSeconds = (db.settings.networkRetryIntervalSeconds !== undefined ? db.settings.networkRetryIntervalSeconds : 120).toString();
  iniData.Settings.fakapEnabled = (db.settings.fakapEnabled !== false).toString();
  iniData.Settings.fakapPath = (db.settings.fakapPath || '').toString();
  iniData.Settings.fakapQuality = (db.settings.fakapQuality || '360').toString();
  iniData.Settings.fakapRetentionDays = (db.settings.fakapRetentionDays || 'never').toString();
  iniData.Settings.preferredAudioLang = (db.settings.preferredAudioLang || 'auto').toString();
  iniData.Settings.historyLimitPerChannel = (db.settings.historyLimitPerChannel || 30).toString();
  iniData.Settings.shortsDurationLimit = (db.settings.shortsDurationLimit || 180).toString();
  iniData.Settings.tempDirType = (db.settings.tempDirType || 'system').toString();
  iniData.Settings.durationFetchMethod = (db.settings.durationFetchMethod || 'auto').toString();
  iniData.Settings.ytdlpRunMode = (db.settings.ytdlpRunMode || 'exe').toString();
  iniData.Settings.liveStreamHandling = (db.settings.liveStreamHandling || 'instant_retry').toString();
  iniData.Settings.liveStreamRetryInterval = (db.settings.liveStreamRetryInterval || 30).toString();
  iniData.Settings.pythonCmd = (db.settings.pythonCmd || 'python').toString();
  iniData.Settings.maxConcurrentDownloads = (db.settings.maxConcurrentDownloads || 1).toString();
  iniData.Settings.hideOnDelete = (db.settings.hideOnDelete !== false).toString();
  iniData.Settings.channelScanMode = (db.settings.channelScanMode || 'fast').toString();
  iniData.Settings.aiProvider = (db.settings.aiProvider || 'auto').toString();
  iniData.Settings.lmStudioPort = (db.settings.lmStudioPort || 1234).toString();
  iniData.Settings.lmStudioModel = (db.settings.lmStudioModel || '').toString();
  iniData.Settings.ggufModelPath = (db.settings.ggufModelPath || '').toString();
  iniData.Settings.ggufModelsDir = (db.settings.ggufModelsDir || '').toString();
  iniData.Settings.ggufGpuMode = (db.settings.ggufGpuMode !== false).toString();
  iniData.Settings.unloadUiOnHide = (db.settings.unloadUiOnHide !== false).toString();
  iniData.Settings.playerGpuMode = (db.settings.playerGpuMode || 'gpu').toString();
  iniData.Settings.ttsVoiceId = (db.settings.ttsVoiceId || '').toString();
  iniData.Settings.ttsSpeed = (db.settings.ttsSpeed !== undefined ? db.settings.ttsSpeed : 1).toString();
  iniData.Settings.ttsVoicesDir = (db.settings.ttsVoicesDir || '').toString();
  iniData.Settings.githubGistId = (db.settings.githubGistId || '').toString();
  iniData.Settings.autoSyncGist = (db.settings.autoSyncGist === true).toString();

  await writeIni(configIniPath, iniData);
}

/**
 * Veritabanı nesnesindeki kanalları alfabetik olarak sıralayıp 'channels.ini' dosyasına yazar.
 * 
 * @param {object} db Kaydedilecek veritabanı nesnesi
 */
export async function saveChannelsToIni(db) {
  if (!db || !Array.isArray(db.channels)) return;

  // Doğrulamalı 3 kademeli .bak koruma yedeği
  rotateValidBackupsSync(channelsIniPath, 'ini');

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
    const fakapIds = Array.isArray(db.fakap?.channelIds) ? db.fakap.channelIds : [];
    const fakapStamp = db.fakap?.enabledAt?.[channel.id];
    const fakapValue = fakapIds.includes(channel.id) ? (fakapStamp || 'true') : 'false';
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
      channel.subscriberCount || '?',
      (channel.autoDeleteDays !== undefined ? channel.autoDeleteDays : 'never').toString(),
      (channel.autoDeleteMaxCount !== undefined ? channel.autoDeleteMaxCount : 'none').toString(),
      fakapValue
    ].join(' | ');
    iniData.Channels[channel.id] = info;
  }
  let oldContent = '';
  if (fs.existsSync(channelsIniPath)) {
    try { oldContent = await fs.promises.readFile(channelsIniPath, 'utf-8'); } catch(e) {}
  }

  await writeIni(channelsIniPath, iniData);

  let newContent = '';
  if (fs.existsSync(channelsIniPath)) {
    try { newContent = await fs.promises.readFile(channelsIniPath, 'utf-8'); } catch(e) {}
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
export async function saveCategoriesToIni(db) {
  const iniData = { Categories: {} };
  
  const categoriesList = db.categories || [{ id: 1, name: 'Genel' }];
  const sortedCategories = [...categoriesList].sort((a, b) => a.id - b.id);
  
  for (const cat of sortedCategories) {
    iniData.Categories[cat.id.toString()] = cat.name || '';
  }
  await writeIni(categoriesIniPath, iniData);
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
          if (isInsideFakap(fullPath)) continue; // Fakap yedek klasörü ana kütüphane taramasından dışlanır
          scanDir(fullPath, depth + 1);
        } else {
          const ext = path.extname(entry.name).toLowerCase();
          if (!['.jpg', '.jpeg', '.webp', '.png', '.json', '.temp', '.part', '.ytdl', '.srt', '.vtt', '.description'].includes(ext)) {
            const bracketMatch = entry.name.match(/\[([a-zA-Z0-9_-]{11,64})\]/);
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
/**
 * Diskteki video dosyaları ile veritabanını senkronize eder.
 * @param {boolean} forceManual - Kullanıcı tarafından manuel mi tetiklendi?
 * @param {string|boolean} syncMode - 'fast' (yalnızca varlık), 'smart' (yalnızca çözünürlüğü eksikler), 'full' (tüm videoları FFprobe ile zorla oku)
 */
export async function syncDbWithDisk(forceManual = false, syncMode = 'fast') {
  try {
    // Geriye dönük boolean uyumluluğu (deep true ise 'smart' veya 'full')
    let mode = 'fast';
    if (syncMode === true || syncMode === 'smart') {
      mode = 'smart';
    } else if (syncMode === 'full') {
      mode = 'full';
    } else {
      mode = 'fast';
    }

    const db = readDb();
    if (!forceManual && db.settings && db.settings.autoDiskSync === false) {
      return { success: true, skipped: true, message: 'Otomatik disk senkronizasyonu ayarlardan devre dışı bırakılmış.' };
    }

    const { downloadQueue } = await import('./services/downloader.js');
    const { mergeQueue } = await import('./services/mergeQueue.js');
    if ((downloadQueue && (downloadQueue.activeDownloads > 0 || (downloadQueue.activeProcesses && downloadQueue.activeProcesses.size > 0))) || (mergeQueue && mergeQueue.activeJob)) {
      console.log('[Disk Sync] Aktif indirme/birleştirme işlemi olduğu için disk senkronizasyonu ertelendi.');
      if (forceManual) {
        addTerminalLog('[Disk Sync] Aktif indirme/birleştirme işlemi olduğu için disk senkronizasyonu ertelendi.', 'warn');
      }
      return { success: false, busy: true, message: 'Aktif indirme/birleştirme işlemi olduğu için disk senkronizasyonu ertelendi.' };
    }

    return performDiskSync(forceManual, mode);
  } catch (err) {
    console.error('[Disk Sync Error]', err.message);
    addTerminalLog(`[Disk Sync Error] ${err.message}`, 'error');
    return { success: false, error: err.message };
  }
}

function performDiskSync(forceManual = false, mode = 'fast') {
  try {
    if (!fs.existsSync(dbPath)) {
      return { success: false, error: 'db.json mevcut değil' };
    }
    const db = readDb();
    if (!db || !db.settings) {
      return { success: false, error: 'db.json okunamadı' };
    }

    if (forceManual) {
      let startMsg = '[Disk Sync] Hızlı disk senkronizasyonu ve varlık denetimi başlatıldı...';
      if (mode === 'full') {
        startMsg = '[Disk Sync] Tam medya analizi başlatıldı (Tüm videolar FFprobe ile taranıyor)...';
      } else if (mode === 'smart') {
        startMsg = '[Disk Sync] Akıllı medya analizi başlatıldı (Yalnızca çözünürlüğü eksik videolar taranıyor)...';
      }
      addTerminalLog(startMsg, 'info');
    }

    let dbUpdated = false;
    let totalVerified = 0;
    let updatedCount = 0;

    if (db.history && db.history.length > 0) {
      const newHistory = [];
      const downloadPath = db.settings.downloadPath || defaultDownloadDir;
      const diskMap = buildVideoFilesMap(downloadPath);

      for (const item of db.history) {
        // Fakap kayıtları kendi bağımsız klasöründe ve fakapService temizliğinde yönetilir; ana disk senkronizasyonundan muaf tutulur
        if (item.isFakap || String(item.id || '').startsWith('fakap_')) {
          newHistory.push(item);
          continue;
        }
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

              // Dosya boyutunu kontrol et (fs.statSync - MFT / RAM'den çok hızlı okunur)
              let fileSizeBytes = 0;
              try {
                const stat = fs.statSync(diskFile);
                fileSizeBytes = stat.size || 0;
              } catch (stErr) {
                fileSizeBytes = 0;
              }

              // 0 Byte dosya tespiti (Chkdsk temizliği veya kesintide içi boşalan dosyalar)
              if (fileSizeBytes === 0) {
                if (item.fileCorrupted !== true || item.fileMissing !== true) {
                  item.fileCorrupted = true;
                  item.fileMissing = true;
                  item.fileSize = '0 MB';
                  dbUpdated = true;
                  updatedCount++;
                }
              } else {
                // Dosya boyutu dolu; formatlı boyutu güncelle
                let formattedSize = '';
                if (fileSizeBytes >= 1024 * 1024 * 1024) {
                  formattedSize = Math.round(fileSizeBytes / (1024 * 1024 * 1024)) + ' GB';
                } else {
                  formattedSize = Math.round(fileSizeBytes / (1024 * 1024)) + ' MB';
                }

                if (formattedSize && item.fileSize !== formattedSize) {
                  item.fileSize = formattedSize;
                  dbUpdated = true;
                  updatedCount++;
                }

                // Önceden missing veya corrupted kaldıysa temizle (kullanıcı dosyayı yenilediyse)
                if (item.fileMissing === true && item.fileCorrupted !== true) {
                  delete item.fileMissing;
                  dbUpdated = true;
                  updatedCount++;
                }
              }

              // FFprobe çalıştırma kararı:
              // mode === 'full' -> Kayıtlı olsa da olmasa da diski baştan oku
              // mode === 'smart' -> Sadece actualQuality boş veya eksik ise oku
              const shouldProbe = (mode === 'full') || (mode === 'smart' && (!item.actualQuality || item.actualQuality === ''));
              if (shouldProbe && fileSizeBytes > 0) {
                const res = getVideoResolution(diskFile);
                if (res) {
                  if (item.actualQuality !== res) {
                    item.actualQuality = res;
                    dbUpdated = true;
                    updatedCount++;
                  }
                  if (item.fileCorrupted === true) {
                    delete item.fileCorrupted;
                    delete item.fileMissing;
                    dbUpdated = true;
                    updatedCount++;
                  }
                } else {
                  // FFprobe geçerli bir akış okuyamadı (moov atom / invalid data hasarı)
                  if (item.fileCorrupted !== true) {
                    item.fileCorrupted = true;
                    item.fileMissing = true;
                    dbUpdated = true;
                    updatedCount++;
                  }
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
        const freshDb = readDb();
        freshDb.history = newHistory;
        writeDb(freshDb);
        broadcast('db_update', freshDb);
      }
    }

    let modeLabel = 'Hızlı Mod';
    if (mode === 'full') modeLabel = 'Tam FFprobe Modu';
    else if (mode === 'smart') modeLabel = 'Akıllı FFprobe Modu';

    const summaryMsg = `Disk senkronizasyonu tamamlandı (${modeLabel}): ${totalVerified} video doğrulandı, ${updatedCount} kayıt güncellendi.`;
    
    // Manuel tetiklendiğinde veya arka planda dosya güncellendiğinde logla & bildirim gönder
    if (forceManual || updatedCount > 0) {
      addTerminalLog(`[Disk Sync] ${summaryMsg}`, 'success');
      broadcast('status_log', { message: summaryMsg, type: 'success' });
    } else {
      console.log(`[Disk Sync] ${summaryMsg}`);
    }

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
          if (isInsideFakap(fullPath)) continue; // Fakap yedek klasörü dışlanır
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
    publishedAt: publishedAt || '',
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
// Türkçe Açıklama: Yüksek frekanslı ilerleme güncellemelerinde (progress) disk yazımını 1 saniyede bir toplar.
// persist:false güncellemeler bellek önbelleğine yazılır; diske toplu olarak zamanlanır.
let dbWritePending = false;
let dbWriteTimer = null;

function scheduleDbWrite() {
  if (dbWritePending) return;
  dbWritePending = true;
  dbWriteTimer = setTimeout(() => {
    dbWritePending = false;
    try {
      if (cachedDb) writeDb(cachedDb);
    } catch (e) {}
  }, 1000);
}

/**
 * Geçmiş kaydını günceller; varsayılan olarak diske de yazar.
 * 
 * @param {string} videoId - YouTube Video ID
 * @param {object} updates - Güncellenecek alanlar
 * @param {object} [options] - Seçenekler
 * @param {boolean} [options.persist=true] - false ise disk yazımı 1 sn'de bir toplu yapılır (ilerleme güncellemeleri için)
 */
export function updateHistoryItem(videoId, updates, options = {}) {
  const db = readDb();
  const index = db.history.findIndex(h => h.id === videoId);
  if (index !== -1) {
    if (updates && updates.error && typeof updates.error === 'string' && updates.error.length > 2000) {
      updates.error = updates.error.slice(-2000);
    }
    db.history[index] = { ...db.history[index], ...updates };
    // Hedefli bildirim: tüm veritabanı yerine yalnızca güncellenen kaydı istemcilere ilet
    broadcastHistoryUpdate(videoId, updates);
    if (options.persist === false) {
      // İlerleme güncellemesi: bellek önbelleği güncel; disk yazımı toplu zamanlanır
      scheduleDbWrite();
    } else {
      writeDb(db);
    }
  }
}

/**
 * Otomatik veya manuel silinen videoları son 100 kayıt sınırıyla db.deletedVideos listesine ekler.
 * 
 * @param {object} item - Silinen video nesnesi
 * @param {'auto'|'manual'} deleteReason - Silinme nedeni
 * @param {object} [targetDb] - Eğer bir işlem içinde db zaten yüklenmişse doğrudan o nesneye ekler
 * @returns {void}
 */
export function recordDeletedVideo(item, deleteReason = 'manual', targetDb = null) {
  if (!item || !item.id) return;
  const db = targetDb || readDb();
  if (!Array.isArray(db.deletedVideos)) {
    db.deletedVideos = [];
  }

  // Aynı ID varsa listeden çıkar (en başa en güncel silinme olarak eklenecek)
  db.deletedVideos = db.deletedVideos.filter(d => d.id !== item.id);

  const deletedRecord = {
    id: item.id,
    title: item.title || item.id,
    channelId: item.channelId || '',
    channelName: item.channelName || '',
    downloadedAt: item.downloadedAt || '',
    publishedAt: item.publishedAt || '',
    deletedAt: new Date().toISOString(),
    deleteReason: deleteReason, // 'auto' veya 'manual'
    fileSize: item.fileSize || '',
    filePath: item.filePath || '',
    duration: item.duration || '',
    thumbnail: `/api/video/${item.id}/thumbnail`
  };

  db.deletedVideos.unshift(deletedRecord);

  // Son 100 video sınırı
  if (db.deletedVideos.length > 100) {
    db.deletedVideos = db.deletedVideos.slice(0, 100);
  }

  if (!targetDb) {
    writeDb(db);
  }
}




