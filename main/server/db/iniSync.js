// Türkçe Açıklama: Veritabanı ile configwin.ini / configunix.ini, channels.ini ve categories.ini dosyaları arasındaki çift yönlü senkronizasyon modülü.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  dataRootDir,
  configIniName,
  configIniPath,
  channelsIniPath,
  categoriesIniPath,
  parseIni,
  writeIni,
  getCaseInsensitiveKey,
  rotateValidBackupsSync
} from '../config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const appRootDir = path.resolve(__dirname, '..', '..');

let _deps = {
  writeDb: null,
  convertPngToIco: null,
  defaultDownloadDir: path.join(appRootDir, 'downloads')
};

/**
 * database.js tarafından sağlanan koordinatör bağımlılıklarını kaydeder (döngüsel import önleme).
 * @param {object} deps
 */
export function registerIniSyncDeps(deps) {
  _deps = { ..._deps, ...deps };
}

/**
 * INI dosyalarından (categories.ini, config*.ini, channels.ini) okunan ayar ve kanalları
 * bellek/SQLite veritabanı nesnesiyle senkronize eder.
 *
 * @param {object} db
 */
export function syncWithIni(db) {
  // icon.ico kontrolü
  const pngPath = path.join(appRootDir, 'public', 'logo.png');
  const icoPath = path.join(appRootDir, 'icon.ico');
  if (!fs.existsSync(icoPath) && fs.existsSync(pngPath) && _deps.convertPngToIco) {
    _deps.convertPngToIco(pngPath, icoPath);
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
      fs.unlinkSync(configIniTypoPath);
      console.log('[Migration] config.inilş başarıyla taşındı ve silindi.');
    } catch (e) {
      console.error('[Migration] Error:', e.message);
    }
  }

  // 1. config*.ini (Ayarlar) Eşitlemesi — parseIni bozuk dosyayı otomatik olarak .bak1/.bak2/.bak3'ten onarır
  const iniData = parseIni(configIniPath);
  const settingsSection = getCaseInsensitiveKey(iniData, 'Settings') || iniData;
  if (!settingsSection || Object.keys(settingsSection).length === 0) {
    console.log(`[Sync] ${configIniName} bulunamadı veya boş. Mevcut ayarlarla oluşturuluyor.`);
    saveSettingsToIni(db);
  } else {
    const downloadPath = getCaseInsensitiveKey(settingsSection, 'downloadPath');
    if (downloadPath !== undefined && downloadPath.trim() !== '') {
      db.settings.downloadPath = downloadPath.trim();
    } else if (!db.settings.downloadPath) {
      db.settings.downloadPath = _deps.defaultDownloadDir;
    }

    const quality = getCaseInsensitiveKey(settingsSection, 'quality');
    if (quality !== undefined) db.settings.quality = quality;

    const channelCheckInterval = getCaseInsensitiveKey(settingsSection, 'channelCheckInterval');
    if (channelCheckInterval !== undefined) {
      db.settings.channelCheckInterval = parseInt(channelCheckInterval, 10) || 30;
    }

    const autoDownload = getCaseInsensitiveKey(settingsSection, 'autoDownload');
    if (autoDownload !== undefined) db.settings.autoDownload = autoDownload === 'true';

    const mergeType = getCaseInsensitiveKey(settingsSection, 'mergeType');
    if (mergeType !== undefined) db.settings.mergeType = mergeType;

    const hardwareAcceleration = getCaseInsensitiveKey(settingsSection, 'hardwareAcceleration');
    if (hardwareAcceleration !== undefined) db.settings.hardwareAcceleration = hardwareAcceleration;

    const writeThumbnail = getCaseInsensitiveKey(settingsSection, 'writeThumbnail');
    if (writeThumbnail !== undefined) db.settings.writeThumbnail = writeThumbnail === 'true';

    const showShorts = getCaseInsensitiveKey(settingsSection, 'showShorts');
    if (showShorts !== undefined) db.settings.showShorts = showShorts === 'true';

    const rssLimit = getCaseInsensitiveKey(settingsSection, 'rssLimit');
    if (rssLimit !== undefined) db.settings.rssLimit = parseInt(rssLimit, 10) || 5;

    const autoDeleteDays = getCaseInsensitiveKey(settingsSection, 'autoDeleteDays');
    if (autoDeleteDays !== undefined) db.settings.autoDeleteDays = parseInt(autoDeleteDays, 10) || 0;

    const autoDeleteMaxCount = getCaseInsensitiveKey(settingsSection, 'autoDeleteMaxCount');
    if (autoDeleteMaxCount !== undefined) db.settings.autoDeleteMaxCount = parseInt(autoDeleteMaxCount, 10) || 0;

    const autoDeleteRequireConfirmation = getCaseInsensitiveKey(settingsSection, 'autoDeleteRequireConfirmation');
    if (autoDeleteRequireConfirmation !== undefined) {
      db.settings.autoDeleteRequireConfirmation = autoDeleteRequireConfirmation === true || autoDeleteRequireConfirmation === 'true';
    }

    const downloadSpeedLimit = getCaseInsensitiveKey(settingsSection, 'downloadSpeedLimit');
    if (downloadSpeedLimit !== undefined) db.settings.downloadSpeedLimit = parseInt(downloadSpeedLimit, 10) || 0;

    const useAlternativeSpeed = getCaseInsensitiveKey(settingsSection, 'useAlternativeSpeed');
    if (useAlternativeSpeed !== undefined) db.settings.useAlternativeSpeed = useAlternativeSpeed === 'true';

    const deferMerge = getCaseInsensitiveKey(settingsSection, 'deferMerge');
    if (deferMerge !== undefined) db.settings.deferMerge = deferMerge === 'true';

    const alternativeSpeedLimit = getCaseInsensitiveKey(settingsSection, 'alternativeSpeedLimit');
    if (alternativeSpeedLimit !== undefined) db.settings.alternativeSpeedLimit = parseInt(alternativeSpeedLimit, 10) || 500;

    const theme = getCaseInsensitiveKey(settingsSection, 'theme');
    if (theme !== undefined) db.settings.theme = theme;

    const customTitlebar = getCaseInsensitiveKey(settingsSection, 'customTitlebar');
    if (customTitlebar !== undefined) db.settings.customTitlebar = customTitlebar === 'true';

    const port = getCaseInsensitiveKey(settingsSection, 'port');
    if (port !== undefined) db.settings.port = parseInt(port, 10) || 4141;

    const playerPreference = getCaseInsensitiveKey(settingsSection, 'playerPreference');
    if (playerPreference !== undefined) db.settings.playerPreference = playerPreference;

    const playerType = getCaseInsensitiveKey(settingsSection, 'playerType');
    if (playerType !== undefined) db.settings.playerType = playerType;

    const subtitleColor = getCaseInsensitiveKey(settingsSection, 'subtitleColor');
    if (subtitleColor !== undefined) db.settings.subtitleColor = subtitleColor;

    const subtitleOpacity = getCaseInsensitiveKey(settingsSection, 'subtitleOpacity');
    if (subtitleOpacity !== undefined) db.settings.subtitleOpacity = subtitleOpacity;

    const subtitleSize = getCaseInsensitiveKey(settingsSection, 'subtitleSize');
    if (subtitleSize !== undefined) db.settings.subtitleSize = subtitleSize;

    const playSounds = getCaseInsensitiveKey(settingsSection, 'playSounds');
    if (playSounds !== undefined) db.settings.playSounds = playSounds !== 'false';

    const lang = getCaseInsensitiveKey(settingsSection, 'lang');
    if (lang !== undefined) db.settings.lang = lang;

    const isPaused = getCaseInsensitiveKey(settingsSection, 'isPaused');
    if (isPaused !== undefined) db.settings.isPaused = isPaused === 'true';

    const showNotifications = getCaseInsensitiveKey(settingsSection, 'showNotifications');
    if (showNotifications !== undefined) db.settings.showNotifications = showNotifications !== 'false';

    const autoOpenBrowser = getCaseInsensitiveKey(settingsSection, 'autoOpenBrowser');
    if (autoOpenBrowser !== undefined) db.settings.autoOpenBrowser = autoOpenBrowser !== 'false';

    const checkChannelsOnStartup = getCaseInsensitiveKey(settingsSection, 'checkChannelsOnStartup');
    if (checkChannelsOnStartup !== undefined) db.settings.checkChannelsOnStartup = checkChannelsOnStartup === 'true';

    const scanRemoteStatusOnStartup = getCaseInsensitiveKey(settingsSection, 'scanRemoteStatusOnStartup');
    if (scanRemoteStatusOnStartup !== undefined) db.settings.scanRemoteStatusOnStartup = scanRemoteStatusOnStartup !== 'false';

    const checkYtdlpOnStartup = getCaseInsensitiveKey(settingsSection, 'checkYtdlpOnStartup');
    if (checkYtdlpOnStartup !== undefined) db.settings.checkYtdlpOnStartup = checkYtdlpOnStartup === 'true';

    const ytdlpStartupTarget = getCaseInsensitiveKey(settingsSection, 'ytdlpStartupTarget');
    if (ytdlpStartupTarget !== undefined && ytdlpStartupTarget.trim()) {
      db.settings.ytdlpStartupTarget = ytdlpStartupTarget.trim();
    }

    const sponsorBlockEnabled = getCaseInsensitiveKey(settingsSection, 'sponsorBlockEnabled');
    if (sponsorBlockEnabled !== undefined) db.settings.sponsorBlockEnabled = sponsorBlockEnabled === 'true';

    const networkRetryIntervalSeconds = getCaseInsensitiveKey(settingsSection, 'networkRetryIntervalSeconds');
    if (networkRetryIntervalSeconds !== undefined) {
      db.settings.networkRetryIntervalSeconds = parseInt(networkRetryIntervalSeconds, 10) || 120;
    }

    const preventSleepOnDownload = getCaseInsensitiveKey(settingsSection, 'preventSleepOnDownload');
    if (preventSleepOnDownload !== undefined) db.settings.preventSleepOnDownload = preventSleepOnDownload === 'true';

    const discordRpcEnabled = getCaseInsensitiveKey(settingsSection, 'discordRpcEnabled');
    if (discordRpcEnabled !== undefined) db.settings.discordRpcEnabled = discordRpcEnabled === 'true';

    const doubleClickAction = getCaseInsensitiveKey(settingsSection, 'doubleClickAction');
    if (doubleClickAction !== undefined) db.settings.doubleClickAction = doubleClickAction;

    const useTempDownloadStaging = getCaseInsensitiveKey(settingsSection, 'useTempDownloadStaging');
    if (useTempDownloadStaging !== undefined) db.settings.useTempDownloadStaging = useTempDownloadStaging === 'true';

    const historyDurationFilter = getCaseInsensitiveKey(settingsSection, 'historyDurationFilter');
    if (historyDurationFilter !== undefined) db.settings.historyDurationFilter = historyDurationFilter;

    const enableAltThumbnailsHover = getCaseInsensitiveKey(settingsSection, 'enableAltThumbnailsHover');
    if (enableAltThumbnailsHover !== undefined) db.settings.enableAltThumbnailsHover = enableAltThumbnailsHover !== 'false';

    const markWatchedOnDelete = getCaseInsensitiveKey(settingsSection, 'markWatchedOnDelete');
    if (markWatchedOnDelete !== undefined) db.settings.markWatchedOnDelete = markWatchedOnDelete !== 'false';

    const autoSyncWatchtime = getCaseInsensitiveKey(settingsSection, 'autoSyncWatchtime');
    if (autoSyncWatchtime !== undefined) db.settings.autoSyncWatchtime = autoSyncWatchtime !== 'false';

    const autoSyncLocalWatchtime = getCaseInsensitiveKey(settingsSection, 'autoSyncLocalWatchtime');
    if (autoSyncLocalWatchtime !== undefined) db.settings.autoSyncLocalWatchtime = autoSyncLocalWatchtime !== 'false';

    const autoDiskSync = getCaseInsensitiveKey(settingsSection, 'autoDiskSync');
    if (autoDiskSync !== undefined) db.settings.autoDiskSync = autoDiskSync !== 'false';

    const periodicDiskSyncInterval = getCaseInsensitiveKey(settingsSection, 'periodicDiskSyncInterval');
    if (periodicDiskSyncInterval !== undefined) db.settings.periodicDiskSyncInterval = periodicDiskSyncInterval;

    const autoCookieRefresh = getCaseInsensitiveKey(settingsSection, 'autoCookieRefresh');
    if (autoCookieRefresh !== undefined) db.settings.autoCookieRefresh = autoCookieRefresh !== 'false';

    const cookieRefreshInterval = getCaseInsensitiveKey(settingsSection, 'cookieRefreshInterval');
    if (cookieRefreshInterval !== undefined) {
      db.settings.cookieRefreshInterval = parseInt(cookieRefreshInterval, 10) || 30;
    }

    const weatherEnabled = getCaseInsensitiveKey(settingsSection, 'weatherEnabled');
    if (weatherEnabled !== undefined) db.settings.weatherEnabled = weatherEnabled !== 'false';

    const weatherCity = getCaseInsensitiveKey(settingsSection, 'weatherCity');
    if (weatherCity !== undefined) db.settings.weatherCity = weatherCity;

    const weatherLatitude = getCaseInsensitiveKey(settingsSection, 'weatherLatitude');
    if (weatherLatitude !== undefined) db.settings.weatherLatitude = parseFloat(weatherLatitude) || 40.75694;

    const weatherLongitude = getCaseInsensitiveKey(settingsSection, 'weatherLongitude');
    if (weatherLongitude !== undefined) db.settings.weatherLongitude = parseFloat(weatherLongitude) || 29.81472;

    const weatherUnit = getCaseInsensitiveKey(settingsSection, 'weatherUnit');
    if (weatherUnit !== undefined) db.settings.weatherUnit = weatherUnit;

    const queueViewMode = getCaseInsensitiveKey(settingsSection, 'queueViewMode');
    if (queueViewMode !== undefined) db.settings.queueViewMode = queueViewMode;

    const historyViewMode = getCaseInsensitiveKey(settingsSection, 'historyViewMode');
    if (historyViewMode !== undefined) db.settings.historyViewMode = historyViewMode;

    const downloadedViewMode = getCaseInsensitiveKey(settingsSection, 'downloadedViewMode');
    if (downloadedViewMode !== undefined) db.settings.downloadedViewMode = downloadedViewMode;

    const downloadedSortMode = getCaseInsensitiveKey(settingsSection, 'downloadedSortMode');
    if (downloadedSortMode !== undefined) db.settings.downloadedSortMode = downloadedSortMode;

    const historySortMode = getCaseInsensitiveKey(settingsSection, 'historySortMode');
    if (historySortMode !== undefined) db.settings.historySortMode = historySortMode;

    const historyShowLive = getCaseInsensitiveKey(settingsSection, 'historyShowLive');
    if (historyShowLive !== undefined) db.settings.historyShowLive = historyShowLive !== 'false';

    const historyShowUpcoming = getCaseInsensitiveKey(settingsSection, 'historyShowUpcoming');
    if (historyShowUpcoming !== undefined) db.settings.historyShowUpcoming = historyShowUpcoming === 'true';

    const historyOnlyNoAutoDownload = getCaseInsensitiveKey(settingsSection, 'historyOnlyNoAutoDownload');
    if (historyOnlyNoAutoDownload !== undefined) db.settings.historyOnlyNoAutoDownload = historyOnlyNoAutoDownload === 'true';

    const historyOnlyNotDownloaded = getCaseInsensitiveKey(settingsSection, 'historyOnlyNotDownloaded');
    if (historyOnlyNotDownloaded !== undefined) db.settings.historyOnlyNotDownloaded = historyOnlyNotDownloaded === 'true';

    const historyOnlyLiveProcessing = getCaseInsensitiveKey(settingsSection, 'historyOnlyLiveProcessing');
    if (historyOnlyLiveProcessing !== undefined) db.settings.historyOnlyLiveProcessing = historyOnlyLiveProcessing === 'true';

    const historyShowMembers = getCaseInsensitiveKey(settingsSection, 'historyShowMembers');
    if (historyShowMembers !== undefined) db.settings.historyShowMembers = historyShowMembers !== 'false';

    const historyShowHidden = getCaseInsensitiveKey(settingsSection, 'historyShowHidden');
    if (historyShowHidden !== undefined) db.settings.historyShowHidden = historyShowHidden === 'true';

    // Fakap ayarları
    const fakapEnabled = getCaseInsensitiveKey(settingsSection, 'fakapEnabled');
    if (fakapEnabled !== undefined) db.settings.fakapEnabled = fakapEnabled !== 'false';

    const fakapPath = getCaseInsensitiveKey(settingsSection, 'fakapPath');
    if (fakapPath !== undefined) db.settings.fakapPath = String(fakapPath || '').trim();

    const fakapQuality = getCaseInsensitiveKey(settingsSection, 'fakapQuality');
    if (fakapQuality !== undefined && ['144', '240', '360'].includes(String(fakapQuality).replace(/p$/i, ''))) {
      db.settings.fakapQuality = String(fakapQuality).replace(/p$/i, '');
    }

    const fakapRetentionDays = getCaseInsensitiveKey(settingsSection, 'fakapRetentionDays');
    if (fakapRetentionDays !== undefined) db.settings.fakapRetentionDays = String(fakapRetentionDays);

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

    const volumeStep = getCaseInsensitiveKey(settingsSection, 'volumeStep');
    if (volumeStep !== undefined) {
      const parsedVolStep = parseInt(volumeStep, 10);
      if (!isNaN(parsedVolStep) && parsedVolStep >= 1 && parsedVolStep <= 25) {
        db.settings.volumeStep = parsedVolStep;
      }
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

  if (!db.settings.queueViewMode) {
    db.settings.queueViewMode = 'table';
  }

  if (migratedSettings) {
    db.settings = { ...db.settings, ...migratedSettings };
    saveSettingsToIni(db);
  }

  // 2. channels.ini (Kanallar) Eşitlemesi
  let channelsData = null;
  if (migratedChannels) {
    channelsData = migratedChannels;
  } else {
    const parsedChannels = parseIni(channelsIniPath);
    channelsData = getCaseInsensitiveKey(parsedChannels, 'Channels') || parsedChannels;
    if (!channelsData || Object.keys(channelsData).length === 0) {
      if (db.channels && db.channels.length > 0) {
        console.warn(`[Uyarı] channels.ini boş/bulunamadı fakat veritabanında ${db.channels.length} kanal var. channels.ini koruma amacıyla yeniden yazılıyor.`);
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
      let fakapValue = null;
      if (parts.length >= 13) {
        fakapValue = parts[parts.length - 1];
        autoDeleteMaxCount = parts[parts.length - 2];
        autoDeleteDays = parts[parts.length - 3];
        subscriberCountFromIni = parts[parts.length - 4];
        const catPart = parts[parts.length - 5];
        categoryIds = catPart.includes(',') ? catPart.split(',').map(x => parseInt(x.trim(), 10) || 1) : [parseInt(catPart, 10) || 1];
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
        categoryIds = catPart.includes(',') ? catPart.split(',').map(x => parseInt(x.trim(), 10) || 1) : [parseInt(catPart, 10) || 1];
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
        categoryIds = catPart.includes(',') ? catPart.split(',').map(x => parseInt(x.trim(), 10) || 1) : [parseInt(catPart, 10) || 1];
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
        categoryIds = catPart.includes(',') ? catPart.split(',').map(x => parseInt(x.trim(), 10) || 1) : [parseInt(catPart, 10) || 1];
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
        categoryIds = catPart.includes(',') ? catPart.split(',').map(x => parseInt(x.trim(), 10) || 1) : [parseInt(catPart, 10) || 1];
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

  if ((migratedSettings || migratedChannels) && _deps.writeDb) {
    console.log('[Migration] Göç edilen veriler veritabanına kaydediliyor...');
    _deps.writeDb(db);
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
  iniData.Settings.customTitlebar = (db.settings.customTitlebar === true).toString();
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
  iniData.Settings.scanRemoteStatusOnStartup = (db.settings.scanRemoteStatusOnStartup !== false).toString();
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
  iniData.Settings.preventSleepOnDownload = (db.settings.preventSleepOnDownload !== false).toString();
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
  iniData.Settings.volumeStep = (db.settings.volumeStep !== undefined ? db.settings.volumeStep : 5).toString();
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
    try { oldContent = await fs.promises.readFile(channelsIniPath, 'utf-8'); } catch (e) {}
  }

  await writeIni(channelsIniPath, iniData);

  let newContent = '';
  if (fs.existsSync(channelsIniPath)) {
    try { newContent = await fs.promises.readFile(channelsIniPath, 'utf-8'); } catch (e) {}
  }

  if (oldContent !== newContent && oldContent.trim().length > 0) {
    import('../routes/gist.js').then(m => m.triggerAutoGistSync()).catch(() => {});
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
