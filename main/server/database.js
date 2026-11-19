// Türkçe Açıklama: Yerleşik node:sqlite (haytool.db) koordinasyon, şifreleme, kilit (mutex) ve INI/Disk modülleri re-export katmanı.
import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import {
  configIniPath,
  channelsIniPath,
  categoriesIniPath,
  dataRootDir
} from './config.js';
import { broadcastHistoryUpdate } from './services/sse.js';
import {
  getSqliteDbPath,
  closeSqliteConnection,
  ensureSqliteInitialized,
  loadFullDbFromSqlite,
  saveFullDbToSqlite,
  upsertHistoryItemInSqlite,
  upsertDeletedVideoInSqlite,
  backupSqliteDatabase
} from './db/sqliteStore.js';
import {
  registerIniSyncDeps,
  syncWithIni,
  saveSettingsToIni,
  saveChannelsToIni,
  saveCategoriesToIni
} from './db/iniSync.js';
import {
  registerDiskSyncDeps,
  buildVideoFilesMap,
  syncDbWithDisk,
  findVideoFileInDownloadDir,
  createHistoryItem,
  isShortDuration
} from './db/diskSync.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const appRootDir = path.resolve(__dirname, '..');
const isAppImage = process.env.APPIMAGE;

export const dbPath = path.join(dataRootDir, 'haytool.db');
export const defaultDownloadDir = path.join(os.homedir(), 'Downloads', 'HaYTooLYouTubeAutoDownloads');

/**
 * İşletim sisteminin dilini algılayıp uygulamanın desteklediği dillerden birine eşler.
 * İlk kurulumda varsayılan arayüz dili olarak kullanılır.
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
    customTitlebar: false,
    shortsMigrationDone: true,
    cookieDefaultMigrationDone: true,
    channelIntervalInMinutes: true,
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
    scanRemoteStatusOnStartup: true,
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
    preventSleepOnDownload: true,
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
    volumeStep: 5,
    historyShowLive: true,
    historyShowUpcoming: false,
    ttsVoiceId: '',
    ttsSpeed: 1,
    ttsVoicesDir: '',
    downloadedUserOrder: []
  },
  deletedVideos: []
};

const SENSITIVE_SETTING_KEYS = ['githubToken', 'geminiApiKey', 'groqApiKey', 'openAiApiKey', 'deepseekApiKey'];

let cachedDb = null;
let cachedDataDirPath = '';
let lastSqliteMtime = 0;
let lastWalMtime = 0;
let lastConfigIniMtime = 0;
let lastChannelsIniMtime = 0;
let lastCategoriesIniMtime = 0;
let lastCacheCheckTime = 0;
const DB_CACHE_TTL_MS = 1500;

function getStatMtime(filePath) {
  try {
    return fs.existsSync(filePath) ? fs.statSync(filePath).mtimeMs : 0;
  } catch (_) {
    return 0;
  }
}

/**
 * Bellek içi db önbelleğini geçersiz kılar, bir sonraki readDb doğrudan SQLite + INI'den okur.
 */
export function invalidateDbCache() {
  lastCacheCheckTime = 0;
  cachedDb = null;
  cachedDataDirPath = '';
}

let dbLockPromise = Promise.resolve();
/**
 * Veritabanı yazma işlemleri için sıralı kilit (mutex) mekanizmasını yönetir.
 * Eş zamanlı birden fazla yazma isteğinin çakışmasını önler.
 * Otomatik 30 saniyelik zaman aşımı korumasıyla kilitlenmelerin (deadlock) önüne geçer.
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

  let timeoutId;
  const timeoutPromise = new Promise(resolve => {
    timeoutId = setTimeout(resolve, 30000);
    if (timeoutId.unref) timeoutId.unref();
  });
  await Promise.race([currentLock, timeoutPromise]);
  clearTimeout(timeoutId);
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

    icoBuffer.writeUInt16LE(0, 0);
    icoBuffer.writeUInt16LE(1, 2);
    icoBuffer.writeUInt16LE(1, 4);

    icoBuffer.writeUInt8(0, 6);
    icoBuffer.writeUInt8(0, 7);
    icoBuffer.writeUInt8(0, 8);
    icoBuffer.writeUInt8(0, 9);
    icoBuffer.writeUInt16LE(1, 10);
    icoBuffer.writeUInt16LE(32, 12);
    icoBuffer.writeUInt32LE(pngBuffer.length, 14);
    icoBuffer.writeUInt32LE(22, 18);

    pngBuffer.copy(icoBuffer, 22);

    fs.writeFileSync(icoPath, icoBuffer);
    console.log('icon.ico dosyası başarıyla oluşturuldu.');
  } catch (err) {
    console.error('icon.ico oluşturulurken Error occurred:', err.message);
  }
}

/**
 * Kanal denetleme sıklığı birim göçü yardımcıları (saniye -> dakika).
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
 * Veritabanını haytool.db (node:sqlite) üzerinden okur, ilk çalışmada boşsa varsayılan şemayı başlatır,
 * eksik alanları varsayılanlarla doldurur, INI dosyalarıyla eşitler ve RAM önbelleğini yönetir.
 *
 * @returns {object} Güncel veritabanı nesnesi
 */
export function readDb() {
  try {
    const activeSqlitePath = getSqliteDbPath();
    if (cachedDb && cachedDataDirPath !== activeSqlitePath) {
      invalidateDbCache();
    }

    const now = Date.now();
    if (cachedDb && (now - lastCacheCheckTime < DB_CACHE_TTL_MS)) {
      return cachedDb;
    }

    const sqliteMtime = getStatMtime(activeSqlitePath);
    const walMtime = getStatMtime(`${activeSqlitePath}-wal`);
    const configIniMtime = getStatMtime(configIniPath);
    const channelsIniMtime = getStatMtime(channelsIniPath);
    const categoriesIniMtime = getStatMtime(categoriesIniPath);

    if (
      cachedDb &&
      sqliteMtime === lastSqliteMtime &&
      walMtime === lastWalMtime &&
      configIniMtime === lastConfigIniMtime &&
      channelsIniMtime === lastChannelsIniMtime &&
      categoriesIniMtime === lastCategoriesIniMtime
    ) {
      lastCacheCheckTime = now;
      return cachedDb;
    }

    ensureSqliteInitialized({
      defaultDb,
      prepareDbForDisk
    });

    const parsed = loadFullDbFromSqlite(defaultDb, decryptSecret, SENSITIVE_SETTING_KEYS);
    let channelIntervalMigrated = false;

    const db = {
      ...defaultDb,
      ...parsed,
      settings: {
        ...defaultDb.settings,
        ...(parsed.settings || {})
      }
    };

    if (db.settings.checkInterval !== undefined) {
      if (db.settings.channelCheckInterval === undefined || db.settings.channelCheckInterval === 60) {
        if (db.settings.checkInterval !== 5) {
          db.settings.channelCheckInterval = db.settings.checkInterval * 60;
        }
      }
      delete db.settings.checkInterval;
    }

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

    syncWithIni(db);

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

    if (!db.settings.shortsMigrationDone) {
      if (db.channels && db.channels.length > 0) {
        db.channels.forEach(channel => {
          channel.downloadShorts = false;
        });
      }
      db.settings.shortsMigrationDone = true;
      writeDb(db);
    }

    if (!db.settings.cookieDefaultMigrationDone) {
      db.settings.cookieDefaultMigrationDone = true;
      writeDb(db);
      saveSettingsToIni(db);
    }

    cachedDb = db;
    cachedDataDirPath = activeSqlitePath;
    lastCacheCheckTime = now;
    lastSqliteMtime = getStatMtime(activeSqlitePath);
    lastWalMtime = getStatMtime(`${activeSqlitePath}-wal`);
    lastConfigIniMtime = getStatMtime(configIniPath);
    lastChannelsIniMtime = getStatMtime(channelsIniPath);
    lastCategoriesIniMtime = getStatMtime(categoriesIniPath);

    return db;
  } catch (err) {
    console.error('Veritabanı okuma hatası:', err);
    return defaultDb;
  }
}

/**
 * JavaScript veritabanı nesnesini SQLite (haytool.db) içine yazar ve eş zamanlı olarak config dosyalarına yansıtır.
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
 * RAM içindeki veritabanı nesnesinin hassas ayar alanlarını orijinal nesneyi mutasyona uğratmadan şifreler.
 *
 * @param {object} data - Serileştirilecek ham veritabanı nesnesi
 * @returns {object} Diske yazılmaya hazır kopya
 */
function prepareDbForDisk(data) {
  if (!data || typeof data !== 'object') return data;
  if (!data.settings || typeof data.settings !== 'object') return data;
  const clonedSettings = { ...data.settings };
  for (const f of SENSITIVE_SETTING_KEYS) {
    if (clonedSettings[f]) {
      clonedSettings[f] = encryptSecret(clonedSettings[f]);
    }
  }
  return { ...data, settings: clonedSettings };
}

/**
 * Kilit almadan SQLite + INI yazan iç fonksiyon. Yalnızca kilit elde tutuluyorken çağrılmalıdır.
 */
async function writeDbUnlocked(data) {
  try {
    const activeSqlitePath = getSqliteDbPath();
    cachedDb = data;
    cachedDataDirPath = activeSqlitePath;
    lastCacheCheckTime = Date.now();

    ensureSqliteInitialized({
      defaultDb,
      prepareDbForDisk
    });

    saveFullDbToSqlite(data, prepareDbForDisk);

    lastSqliteMtime = getStatMtime(activeSqlitePath);
    lastWalMtime = getStatMtime(`${activeSqlitePath}-wal`);

    await saveSettingsToIni(data);
    await saveChannelsToIni(data);
    await saveCategoriesToIni(data);
    lastConfigIniMtime = getStatMtime(configIniPath);
    lastChannelsIniMtime = getStatMtime(channelsIniPath);
    lastCategoriesIniMtime = getStatMtime(categoriesIniPath);
  } catch (err) {
    console.error('Veritabanı yazma hatası:', err);
  }
}

/**
 * Kilit altında oku-değiştir-yaz yapar. Mutator veritabanı nesnesini yerinde değiştirir.
 *
 * @param {(db: object) => any} mutator
 * @returns {Promise<any>}
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

/**
 * Silme işlemleri için optimize edilmiş hızlı DB yazma fonksiyonu (INI senkronizasyonunu atlar).
 *
 * @param {object} data Yazılacak veritabanı nesnesi
 * @returns {Promise<void>}
 */
export async function writeDbFast(data) {
  try {
    const activeSqlitePath = getSqliteDbPath();
    cachedDb = data;
    cachedDataDirPath = activeSqlitePath;
    lastCacheCheckTime = Date.now();

    ensureSqliteInitialized({
      defaultDb,
      prepareDbForDisk
    });

    saveFullDbToSqlite(data, prepareDbForDisk);

    lastSqliteMtime = getStatMtime(activeSqlitePath);
    lastWalMtime = getStatMtime(`${activeSqlitePath}-wal`);
    console.log('[writeDbFast] SQLite DB başarıyla yazıldı (hızlı yol, INI atlandı).');
  } catch (err) {
    console.error('[writeDbFast] Veritabanı hızlı yazma hatası:', err);
    try {
      await writeDb(data);
    } catch (fallbackErr) {
      console.error('[writeDbFast] Fallback writeDb de başarısız:', fallbackErr);
    }
  }
}

// Koordinatör bağımlılıklarını INI ve Disk alt modüllerine kaydet
registerIniSyncDeps({ writeDb, convertPngToIco, defaultDownloadDir });
registerDiskSyncDeps({ readDb, writeDb, defaultDownloadDir });

export {
  syncWithIni,
  saveSettingsToIni,
  saveChannelsToIni,
  saveCategoriesToIni,
  buildVideoFilesMap,
  syncDbWithDisk,
  findVideoFileInDownloadDir,
  createHistoryItem,
  isShortDuration,
  getSqliteDbPath,
  backupSqliteDatabase,
  closeSqliteConnection
};

// Yüksek frekanslı ilerleme güncellemelerinde (persist:false) yalnızca değişen satırları 1 saniyede bir SQLite'a yazar
const pendingHistoryIds = new Set();
let historyPersistTimer = null;

function scheduleHistoryRowFlush() {
  if (historyPersistTimer) return;
  historyPersistTimer = setTimeout(() => {
    historyPersistTimer = null;
    try {
      if (!cachedDb || !Array.isArray(cachedDb.history)) return;
      const ids = Array.from(pendingHistoryIds);
      pendingHistoryIds.clear();
      for (const id of ids) {
        const item = cachedDb.history.find(h => h.id === id);
        if (item) upsertHistoryItemInSqlite(item);
      }
      const activeSqlitePath = getSqliteDbPath();
      lastSqliteMtime = getStatMtime(activeSqlitePath);
      lastWalMtime = getStatMtime(`${activeSqlitePath}-wal`);
    } catch (e) {}
  }, 1000);
}

/**
 * Geçmiş kaydını günceller; kalıcı güncellemede yalnızca ilgili SQLite satırını indeksli UPDATE eder (<1ms).
 *
 * @param {string} videoId - YouTube Video ID
 * @param {object} updates - Güncellenecek alanlar
 * @param {object} [options] - Seçenekler
 * @param {boolean} [options.persist=true] - false ise disk yazımı 1 sn'de bir toplu yapılır
 */
export function updateHistoryItem(videoId, updates, options = {}) {
  const db = readDb();
  const index = db.history.findIndex(h => h.id === videoId);
  if (index !== -1) {
    if (updates && updates.error && typeof updates.error === 'string' && updates.error.length > 2000) {
      updates.error = updates.error.slice(-2000);
    }
    db.history[index] = { ...db.history[index], ...updates };
    broadcastHistoryUpdate(videoId, updates);
    if (options.persist === false) {
      pendingHistoryIds.add(videoId);
      scheduleHistoryRowFlush();
    } else {
      upsertHistoryItemInSqlite(db.history[index]);
      const activeSqlitePath = getSqliteDbPath();
      lastSqliteMtime = getStatMtime(activeSqlitePath);
      lastWalMtime = getStatMtime(`${activeSqlitePath}-wal`);
    }
  }
}

/**
 * Otomatik veya manuel silinen videoları son 100 kayıt sınırıyla db.deletedVideos listesine ekler.
 *
 * @param {object} item - Silinen video nesnesi
 * @param {'auto'|'manual'} [deleteReason='manual'] - Silinme nedeni
 * @param {object} [targetDb] - İşlem içinde db zaten yüklenmişse doğrudan o nesneye ekler
 * @returns {void}
 */
export function recordDeletedVideo(item, deleteReason = 'manual', targetDb = null) {
  if (!item || !item.id) return;
  const db = targetDb || readDb();
  if (!Array.isArray(db.deletedVideos)) {
    db.deletedVideos = [];
  }

  db.deletedVideos = db.deletedVideos.filter(d => d.id !== item.id);

  const deletedRecord = {
    id: item.id,
    title: item.title || item.id,
    channelId: item.channelId || '',
    channelName: item.channelName || '',
    downloadedAt: item.downloadedAt || '',
    publishedAt: item.publishedAt || '',
    deletedAt: new Date().toISOString(),
    deleteReason: deleteReason,
    fileSize: item.fileSize || '',
    filePath: item.filePath || '',
    duration: item.duration || '',
    thumbnail: `/api/video/${item.id}/thumbnail`
  };

  db.deletedVideos.unshift(deletedRecord);

  if (db.deletedVideos.length > 100) {
    db.deletedVideos = db.deletedVideos.slice(0, 100);
  }

  if (!targetDb) {
    upsertDeletedVideoInSqlite(deletedRecord);
    const activeSqlitePath = getSqliteDbPath();
    lastSqliteMtime = getStatMtime(activeSqlitePath);
    lastWalMtime = getStatMtime(`${activeSqlitePath}-wal`);
  }
}
