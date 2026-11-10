export function togglePasswordVisibility(inputId, iconId) {
  const input = document.getElementById(inputId);
  const icon = document.getElementById(iconId);
  if (!input) return;
  if (input.type === 'password') {
    input.type = 'text';
    if (icon) icon.setAttribute('data-lucide', 'eye-off');
  } else {
    input.type = 'password';
    if (icon) icon.setAttribute('data-lucide', 'eye');
  }
  if (window.lucide && typeof window.lucide.createIcons === 'function') {
    window.lucide.createIcons();
  }
}
window.togglePasswordVisibility = togglePasswordVisibility;

export function onAiProviderChange() {
  if (typeof window.resetSummaryState === 'function') {
    window.resetSummaryState();
  }
  triggerAutoSave(true);
}
window.onAiProviderChange = onAiProviderChange;

/**
 * Ayarlar, Tema, Sistem Yedekleme ve GitHub Gist Modülü (settings.js)
 * 
 * Yapımcı: HaYTo
 * Açıklama: Tema yönetimi, ayarlar formu otomatik kaydetme, alt sekme geçişleri,
 *            sistem yedekleme/geri yükleme ve GitHub Gist senkronizasyon işlevleri.
 * Bağımlılıklar: app.js getState() fonksiyonu ile localDb, currentLang, translations erişimi sağlanır.
 */

import { translations } from '../utils/i18n.js';
import { initSettingsSearch } from './settingsSearch.js';
import { showToast } from '../components/toast.js';

let _getState = null;

export function initSettings(getState) {
  _getState = getState;
}

const localDb = new Proxy({}, {
  get(target, prop) {
    const db = (_getState?.().localDb) || window.localDb || { history: [], channels: [], settings: {}, categories: [] };
    return db[prop];
  },
  set(target, prop, value) {
    const db = (_getState?.().localDb) || window.localDb || {};
    db[prop] = value;
    return true;
  }
});

let currentLang = 'tr';

// ==========================================
// Tema Yönetimi
// ==========================================

export function applyTheme(themeName) {
  if (!themeName) themeName = 'dark';
  document.body.classList.remove('light-theme', 'matrix-theme', 'discord-theme', 'youtube-theme');
  if (themeName !== 'dark') {
    document.body.classList.add(themeName + '-theme');
  }
  localStorage.setItem('haytool_theme', themeName);

  if (window.localDb) {
    if (!window.localDb.settings) window.localDb.settings = {};
    window.localDb.settings.theme = themeName;
  }

  // Ayarlar sekmesindeki dropdown seçimini senkronize et
  const settingsTheme = document.getElementById('settings-theme');
  if (settingsTheme && settingsTheme.value !== themeName) {
    settingsTheme.value = themeName;
  }

  document.querySelectorAll('.theme-btn').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-theme') === themeName);
  });

  // Header hızlı tema butonu ve ikonu: tek kaynak theme.js içindeki updateThemeToggleUI'dır
  if (typeof window.updateThemeToggleUI === 'function') {
    window.updateThemeToggleUI(themeName);
    return;
  }
  const quickThemeBtn = document.getElementById('quick-theme-toggle-btn') || document.getElementById('btn-header-theme-toggle');
  const quickThemeIcon = document.getElementById('quick-theme-icon') || (quickThemeBtn ? quickThemeBtn.querySelector('i') : null);

  const themeIconMap = {
    dark: 'moon',
    light: 'sun',
    matrix: 'terminal',
    discord: 'message-square',
    youtube: 'play'
  };

  const themeNameMapTr = {
    dark: 'Koyu Tema',
    light: 'Açık Tema',
    matrix: 'Matrix Siber Yeşil',
    discord: 'Discord Koyu Blurple',
    youtube: 'YouTube Koyu Kırmızı'
  };

  const themeNameMapEn = {
    dark: 'Dark Theme',
    light: 'Light Theme',
    matrix: 'Matrix Cyber Green',
    discord: 'Discord Dark Blurple',
    youtube: 'YouTube Dark Red'
  };

  const isEn = (window.localDb?.settings?.lang === 'en');
  const label = isEn ? (themeNameMapEn[themeName] || themeName) : (themeNameMapTr[themeName] || themeName);

  if (quickThemeBtn) {
    quickThemeBtn.setAttribute('title', isEn ? `Theme: ${label} (Click to switch)` : `Tema: ${label} (Değiştirmek için tıkla)`);
  }

  if (quickThemeIcon) {
    quickThemeIcon.setAttribute('data-lucide', themeIconMap[themeName] || 'palette');
    if (typeof lucide !== 'undefined' && lucide.createIcons) {
      lucide.createIcons();
    }
  }
}
window.applyTheme = applyTheme;

export async function toggleQuickTheme() {
  const current = localStorage.getItem('haytool_theme') || window.localDb?.settings?.theme || 'dark';
  const themes = ['dark', 'light', 'matrix', 'discord', 'youtube'];
  const currentIndex = themes.indexOf(current);
  const next = themes[(currentIndex + 1) % themes.length] || 'dark';
  
  applyTheme(next);

  if (window.localDb) {
    if (!window.localDb.settings) window.localDb.settings = {};
    window.localDb.settings.theme = next;
  }

  try {
    await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...(window.localDb?.settings || {}), theme: next })
    });
    const isEn = (window.localDb?.settings?.lang === 'en');
    const themeNameMapTr = {
      dark: 'Koyu Tema',
      light: 'Açık Tema',
      matrix: 'Matrix Siber Yeşil',
      discord: 'Discord Koyu Blurple',
      youtube: 'YouTube Koyu Kırmızı'
    };
    const themeNameMapEn = {
      dark: 'Dark Theme',
      light: 'Light Theme',
      matrix: 'Matrix Cyber Green',
      discord: 'Discord Dark Blurple',
      youtube: 'YouTube Dark Red'
    };
    const toastLabel = isEn ? themeNameMapEn[next] : themeNameMapTr[next];
    if (typeof showToast === 'function') {
      showToast(isEn ? `Theme: ${toastLabel}` : `Tema: ${toastLabel}`, 'info');
    }
  } catch (err) {
    console.error('toggleQuickTheme error:', err);
  }
}
window.toggleQuickTheme = toggleQuickTheme;

export function initSettingsThemeListener() {
  const settingsTheme = document.getElementById('settings-theme');
  if (settingsTheme && !settingsTheme.dataset.themeListenerBound) {
    settingsTheme.dataset.themeListenerBound = 'true';
    settingsTheme.addEventListener('change', async () => {
      const newTheme = settingsTheme.value;
      applyTheme(newTheme);
      if (window.localDb) {
        if (!window.localDb.settings) window.localDb.settings = {};
        window.localDb.settings.theme = newTheme;
      }
      try {
        await fetch('/api/settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...(window.localDb?.settings || {}), theme: newTheme })
        });
        const isEn = (window.localDb?.settings?.lang === 'en');
        if (typeof showToast === 'function') {
          showToast(isEn ? 'Theme updated.' : 'Tema güncellendi.', 'success');
        }
      } catch (err) {
        console.error('Theme save error:', err);
      }
    });
  }
}
window.initSettingsThemeListener = initSettingsThemeListener;

// ==========================================
// Ayarlar Otomatik Kaydetme (Auto-Save) & Klasör İşlemleri
// ==========================================

let autoSaveTimer = null;

export function togglePythonSettingsVisibility() {
  const runModeSelect = document.getElementById('settings-ytdlp-run-mode');
  const pythonContainer = document.getElementById('python-settings-container');
  if (!runModeSelect || !pythonContainer) return;
  if (runModeSelect.value === 'python') {
    pythonContainer.classList.remove('hidden');
  } else {
    pythonContainer.classList.add('hidden');
  }
}
window.togglePythonSettingsVisibility = togglePythonSettingsVisibility;

export function triggerAutoSave(immediate = false) {
  if (!window._settingsFormPopulated || !localDb?.settings || Object.keys(localDb.settings).length === 0) {
    return;
  }
  if (autoSaveTimer) {
    clearTimeout(autoSaveTimer);
    autoSaveTimer = null;
  }
  if (immediate) {
    performAutoSave();
  } else {
    autoSaveTimer = setTimeout(performAutoSave, 500);
  }
}
window.triggerAutoSave = triggerAutoSave;

export async function performAutoSave() {
  if (!window._settingsFormPopulated || !localDb?.settings || Object.keys(localDb.settings).length === 0) {
    return;
  }
  const settingsForm = document.getElementById('settings-form');
  if (!settingsForm) return;

  const settingsDownloadPath = document.getElementById('settings-download-path');
  const settingsQuality = document.getElementById('settings-quality');
  const settingsChannelCheckInterval = document.getElementById('settings-channelcheckinterval');
  const settingsAutoDownload = document.getElementById('settings-autodownload');
  const settingsShortsDurationLimit = document.getElementById('settings-shortsdurationlimit');
  const settingsPortInput = document.getElementById('settings-port');
  const port = (settingsPortInput && settingsPortInput.value && settingsPortInput.value.trim() !== '') 
    ? (parseInt(settingsPortInput.value, 10) || (localDb.settings?.port || 4141)) 
    : (localDb.settings?.port || 4141);
  const oldPort = (localDb.settings && localDb.settings.port !== undefined && localDb.settings.port !== null) 
    ? (parseInt(localDb.settings.port, 10) || 4141) 
    : (settingsPortInput ? (parseInt(settingsPortInput.defaultValue, 10) || 4141) : 4141);
  const oldPlayerGpuMode = (localDb.settings && localDb.settings.playerGpuMode) || 'gpu';

  const rawDownloadPath = settingsDownloadPath ? settingsDownloadPath.value.trim() : '';
  const effectiveDownloadPath = rawDownloadPath || (localDb.settings?.downloadPath || '');

  const settings = {
    downloadPath: effectiveDownloadPath,
    tempDirType: document.getElementById('settings-temp-dir-type') ? document.getElementById('settings-temp-dir-type').value : 'system',
    useTempDownloadStaging: document.getElementById('settings-use-temp-staging') ? document.getElementById('settings-use-temp-staging').checked : false,
    durationFetchMethod: document.getElementById('settings-duration-fetch-method') ? document.getElementById('settings-duration-fetch-method').value : 'auto',
    ytdlpRunMode: document.getElementById('settings-ytdlp-run-mode') ? document.getElementById('settings-ytdlp-run-mode').value : 'exe',
    pythonCmd: document.getElementById('settings-python-cmd') ? document.getElementById('settings-python-cmd').value : 'python',
    quality: settingsQuality ? settingsQuality.value : (localDb.settings?.quality || 'best'),
    channelCheckInterval: (() => { const prev = parseInt(localDb.settings?.channelCheckInterval, 10) || 30; const v = settingsChannelCheckInterval ? parseInt(settingsChannelCheckInterval.value, 10) : NaN; return Number.isFinite(v) ? Math.max(5, Math.min(v, 1440)) : prev; })(),
    autoDownload: settingsAutoDownload ? settingsAutoDownload.checked : false,
    mergeType: document.getElementById('settings-mergetype') ? document.getElementById('settings-mergetype').value : 'single',
    hardwareAcceleration: document.getElementById('settings-hwaccel') ? document.getElementById('settings-hwaccel').value : 'auto',
    deferMerge: document.getElementById('settings-defer-merge') ? document.getElementById('settings-defer-merge').checked : Boolean(localDb.settings?.deferMerge),
    writeThumbnail: document.getElementById('settings-writethumbnail') ? document.getElementById('settings-writethumbnail').checked : true,
    showShorts: document.getElementById('settings-showshorts') ? document.getElementById('settings-showshorts').checked : true,
    hideOnDelete: document.getElementById('settings-hideondelete') ? document.getElementById('settings-hideondelete').checked : false,
    theme: document.getElementById('settings-theme') ? document.getElementById('settings-theme').value : 'dark',
    autoDeleteDays: document.getElementById('settings-autodelete') ? (parseInt(document.getElementById('settings-autodelete').value, 10) || 0) : 0,
    autoDeleteMaxCount: document.getElementById('settings-autodelete-max-count') ? (parseInt(document.getElementById('settings-autodelete-max-count').value, 10) || 0) : 0,
    autoDeleteRequireConfirmation: document.getElementById('settings-autodelete-require-confirmation') ? document.getElementById('settings-autodelete-require-confirmation').checked : (localDb.settings?.autoDeleteRequireConfirmation !== false),
    rssLimit: document.getElementById('settings-rsslimit') ? (parseInt(document.getElementById('settings-rsslimit').value, 10) || 5) : 5,
    liveStreamHandling: document.getElementById('settings-livestreamhandling') ? document.getElementById('settings-livestreamhandling').value : 'instant_retry',
    liveStreamRetryInterval: document.getElementById('settings-livestreamretryinterval') ? (parseInt(document.getElementById('settings-livestreamretryinterval').value, 10) || 30) : 30,
    downloadSpeedLimit: document.getElementById('settings-speedlimit') ? (parseInt(document.getElementById('settings-speedlimit').value, 10) || 0) : 0,
    networkRetryIntervalSeconds: document.getElementById('settings-network-retry-interval') ? (parseInt(document.getElementById('settings-network-retry-interval').value, 10) || 120) : 120,
    alternativeSpeedLimit: document.getElementById('settings-altspeedlimit') ? (parseInt(document.getElementById('settings-altspeedlimit').value, 10) || 500) : 500,
    port: port,
    playerType: 'plyr',
    subtitleColor: document.getElementById('settings-subtitle-color') ? document.getElementById('settings-subtitle-color').value : '#ffff00',
    subtitleOpacity: localDb.settings?.subtitleOpacity || '0.7',
    subtitleSize: localDb.settings?.subtitleSize || '26px',
    sponsorBlockEnabled: document.getElementById('settings-sponsorblock') ? document.getElementById('settings-sponsorblock').checked : false,
    playSounds: document.getElementById('settings-playsounds') ? document.getElementById('settings-playsounds').checked : true,
    soundDownloadComplete: document.getElementById('settings-sound-download') ? document.getElementById('settings-sound-download').value : (localDb.settings?.soundDownloadComplete || 'chime'),
    notifyDownloadStartToast: document.getElementById('settings-notify-dl-start-toast') ? document.getElementById('settings-notify-dl-start-toast').checked : (localDb.settings?.notifyDownloadStartToast !== false),
    notifyDownloadStartSound: document.getElementById('settings-notify-dl-start-sound') ? document.getElementById('settings-notify-dl-start-sound').checked : (localDb.settings?.notifyDownloadStartSound !== false),
    notifyDownloadCompleteToast: document.getElementById('settings-notify-dl-complete-toast') ? document.getElementById('settings-notify-dl-complete-toast').checked : (localDb.settings?.notifyDownloadCompleteToast !== false),
    notifyDownloadCompleteSound: document.getElementById('settings-notify-dl-complete-sound') ? document.getElementById('settings-notify-dl-complete-sound').checked : (localDb.settings?.notifyDownloadCompleteSound !== false),
    autoSyncWatchtime: document.getElementById('settings-autosync-watchtime') ? document.getElementById('settings-autosync-watchtime').checked : (localDb.settings?.autoSyncWatchtime !== false),
    autoSyncLocalWatchtime: document.getElementById('settings-autosync-local-watchtime') ? document.getElementById('settings-autosync-local-watchtime').checked : (localDb.settings?.autoSyncLocalWatchtime !== false),
    autoDiskSync: document.getElementById('settings-auto-disk-sync') ? document.getElementById('settings-auto-disk-sync').checked : (localDb.settings?.autoDiskSync !== false),
    periodicDiskSyncInterval: document.getElementById('settings-periodic-disk-sync-interval') ? document.getElementById('settings-periodic-disk-sync-interval').value : (localDb.settings?.periodicDiskSyncInterval || '360'),
    autoCookieRefresh: document.getElementById('settings-auto-cookie-refresh') ? document.getElementById('settings-auto-cookie-refresh').checked : (localDb.settings?.autoCookieRefresh !== false),
    cookieRefreshInterval: document.getElementById('settings-cookie-refresh-interval') ? (parseInt(document.getElementById('settings-cookie-refresh-interval').value, 10) || 30) : (localDb.settings?.cookieRefreshInterval !== undefined ? localDb.settings.cookieRefreshInterval : 30),
    showNotifications: document.getElementById('settings-shownotifications') ? document.getElementById('settings-shownotifications').checked : true,
    autoOpenBrowser: document.getElementById('settings-autoopenbrowser') ? document.getElementById('settings-autoopenbrowser').checked : true,
    customTitlebar: document.getElementById('settings-custom-titlebar') ? document.getElementById('settings-custom-titlebar').checked : !!localDb.settings?.customTitlebar,
    unloadUiOnHide: document.getElementById('settings-unload-ui-on-hide') ? document.getElementById('settings-unload-ui-on-hide').checked : (localDb.settings?.unloadUiOnHide !== false),
    playerGpuMode: document.getElementById('settings-player-gpu-mode') ? document.getElementById('settings-player-gpu-mode').value : (localDb.settings?.playerGpuMode || 'gpu'),
    checkChannelsOnStartup: document.getElementById('settings-checkonstartup') ? document.getElementById('settings-checkonstartup').checked : false,
    checkYtdlpOnStartup: document.getElementById('settings-check-ytdlp-on-startup') ? document.getElementById('settings-check-ytdlp-on-startup').checked : false,
    ytdlpStartupTarget: document.getElementById('ytdlp-target-select') ? document.getElementById('ytdlp-target-select').value : (localDb.settings?.ytdlpStartupTarget || 'nightly'),
    discordRpcEnabled: document.getElementById('settings-discordrpc') ? document.getElementById('settings-discordrpc').checked : false,
    preventSleepOnDownload: document.getElementById('settings-prevent-sleep') ? document.getElementById('settings-prevent-sleep').checked : true,
    enableAltThumbnailsHover: document.getElementById('settings-alt-thumbnails-hover') ? document.getElementById('settings-alt-thumbnails-hover').checked : true,
    lang: document.getElementById('settings-lang') ? document.getElementById('settings-lang').value : 'tr',
    preferredAudioLang: document.getElementById('settings-preferredaudiolang') ? document.getElementById('settings-preferredaudiolang').value : 'auto',
    doubleClickAction: document.getElementById('settings-doubleclickaction') ? document.getElementById('settings-doubleclickaction').value : 'player',
    historyLimitPerChannel: document.getElementById('settings-history-limit') ? (parseInt(document.getElementById('settings-history-limit').value, 10) || 30) : 30,
    shortsDurationLimit: settingsShortsDurationLimit ? (parseInt(settingsShortsDurationLimit.value, 10) || 180) : (localDb.settings?.shortsDurationLimit || 180),
      geminiApiKey: (document.getElementById('gemini-api-key-input') && document.getElementById('gemini-api-key-input').value.trim()) || (localDb.settings && localDb.settings.geminiApiKey) || '',
      groqApiKey: (document.getElementById('groq-api-key-input') && document.getElementById('groq-api-key-input').value.trim()) || (localDb.settings && localDb.settings.groqApiKey) || '',
      deepseekApiKey: (document.getElementById('deepseek-api-key-input') && document.getElementById('deepseek-api-key-input').value.trim()) || (localDb.settings && localDb.settings.deepseekApiKey) || '',
      openAiApiKey: (document.getElementById('openai-api-key-input') && document.getElementById('openai-api-key-input').value.trim()) || (localDb.settings && localDb.settings.openAiApiKey) || '',
      lmStudioPort: (document.getElementById('settings-lmstudio-port') && parseInt(document.getElementById('settings-lmstudio-port').value, 10)) || (localDb.settings && localDb.settings.lmStudioPort) || 1234,
      lmStudioModel: (document.getElementById('settings-lmstudio-model') && document.getElementById('settings-lmstudio-model').value.trim()) || (localDb.settings && localDb.settings.lmStudioModel) || '',
      ggufModelPath: (document.getElementById('settings-gguf-model-path') && document.getElementById('settings-gguf-model-path').value.trim()) || (localDb.settings && localDb.settings.ggufModelPath) || '',
      ggufModelsDir: (document.getElementById('settings-gguf-models-dir') && document.getElementById('settings-gguf-models-dir').value.trim()) || (localDb.settings && localDb.settings.ggufModelsDir) || '',
      ggufGpuMode: !!(document.getElementById('settings-gguf-gpu-mode') && document.getElementById('settings-gguf-gpu-mode').checked),
      ttsVoiceId: (localDb.settings && localDb.settings.ttsVoiceId) || '',
      ttsSpeed: parseFloat((document.getElementById('settings-tts-speed') && document.getElementById('settings-tts-speed').value) || '1') || 1,
      ttsVoicesDir: String((document.getElementById('settings-tts-voices-dir') && document.getElementById('settings-tts-voices-dir').value) || '').trim(),
      aiProvider: (document.getElementById('settings-ai-provider') && document.getElementById('settings-ai-provider').value) || (localDb.settings && localDb.settings.aiProvider) || 'auto',
    githubToken: (document.getElementById('gist-token-input') && document.getElementById('gist-token-input').value.trim()) || (localDb.settings && localDb.settings.githubToken) || '',
    githubGistId: (document.getElementById('gist-id-input') && document.getElementById('gist-id-input').value.trim()) || (localDb.settings && localDb.settings.githubGistId) || '',
    autoSyncGist: document.getElementById('gist-auto-sync-checkbox') ? document.getElementById('gist-auto-sync-checkbox').checked : (localDb.settings?.autoSyncGist || false),
    channelScanMode: 'fast',
    weatherEnabled: document.getElementById('settings-weatherenabled') ? document.getElementById('settings-weatherenabled').checked : (localDb.settings?.weatherEnabled !== false),
    weatherCity: (document.getElementById('settings-weathercity') && document.getElementById('settings-weathercity').value.trim()) || localDb.settings?.weatherCity || 'Derince',
    weatherUnit: document.getElementById('settings-weatherunit') ? document.getElementById('settings-weatherunit').value : (localDb.settings?.weatherUnit || 'celsius'),
    weatherLatitude: (() => { const el = document.getElementById('settings-weatherlatitude'); const v = el ? parseFloat(el.value) : NaN; return Number.isFinite(v) ? v : (localDb.settings?.weatherLatitude ?? 40.75694); })(),
    weatherLongitude: (() => { const el = document.getElementById('settings-weatherlongitude'); const v = el ? parseFloat(el.value) : NaN; return Number.isFinite(v) ? v : (localDb.settings?.weatherLongitude ?? 29.81472); })(),
    fakapEnabled: document.getElementById('settings-fakap-enabled') ? document.getElementById('settings-fakap-enabled').checked : (localDb.settings?.fakapEnabled !== false),
    fakapPath: (document.getElementById('fakap-path-input') && document.getElementById('fakap-path-input').value.trim()) || (localDb.settings && localDb.settings.fakapPath) || '',
    fakapQuality: (document.getElementById('fakap-quality-select') && document.getElementById('fakap-quality-select').value) || (localDb.settings && localDb.settings.fakapQuality) || '360',
    fakapRetentionDays: (document.getElementById('fakap-retention-select') && document.getElementById('fakap-retention-select').value) || (localDb.settings && localDb.settings.fakapRetentionDays) || 'never'
  };

  const statusSpan = document.getElementById('settings-status');
  if (statusSpan) {
    const isEn = localDb.settings && localDb.settings.lang === 'en';
    statusSpan.innerHTML = `<i data-lucide="loader" class="pulse-animation" style="width:16px; height:16px; margin-right:4px;"></i><span>${isEn ? 'Saving changes...' : 'Ayarlar kaydediliyor...'}</span>`;
    if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
  }

  try {
    const res = await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings)
    });
    const data = await res.json();
    if (data.success) {
      if (localDb.settings) {
        Object.assign(localDb.settings, settings);
      }
      const isEn = localDb.settings && localDb.settings.lang === 'en';
      if (statusSpan) {
        statusSpan.innerHTML = `<i data-lucide="check-circle" style="width:16px; height:16px; margin-right:4px; color:var(--success-color);"></i><span style="color:var(--success-color);">${isEn ? 'All changes saved.' : 'Tüm değişiklikler kaydedildi.'}</span>`;
        if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
      }
      showToast(isEn ? 'Settings saved successfully' : 'Ayarlar başarıyla kaydedildi', 'success');
      if (settingsPortInput && oldPort && port !== oldPort) {
        showToast(isEn ? 'Port changed. Please restart the app to apply.' : 'Port değiştirildi. Yeni portun aktif olması için uygulamayı yeniden başlatın.', 'warning');
      }
      if (settings.playerGpuMode && settings.playerGpuMode !== oldPlayerGpuMode) {
        const t = translations[localDb.settings?.lang || 'tr'] || translations.tr;
        showToast(t.toast_player_gpu_restart || (isEn ? 'Video player hardware acceleration changed. Restart the app to apply.' : 'Video oynatıcı donanım hızlandırma modu değiştirildi. Etkinleşmesi için uygulamayı yeniden başlatın.'), 'warning');
      }
      if (typeof window.updateDiskSpace === 'function') window.updateDiskSpace();
      if (typeof window.updateWeatherBadge === 'function') window.updateWeatherBadge(true);
    }
  } catch (err) {
    console.error('Otomatik kaydetme hatası:', err);
    if (statusSpan) {
      const isEn = localDb.settings && localDb.settings.lang === 'en';
      statusSpan.innerHTML = `<i data-lucide="alert-circle" style="width:16px; height:16px; margin-right:4px; color:var(--danger-color);"></i><span style="color:var(--danger-color);">${isEn ? 'Save error!' : 'Kaydedilemedi!'}</span>`;
      if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
    }
  }
}
window.performAutoSave = performAutoSave;

// Türkçe Açıklama: Sunucuya istek göndererek, indirilen videoların bulunduğu klasörü Windows Dosya Gezgini'nde otomatik olarak açar.
/**
 * Sunucuya istek atarak indirme klasörünü (varsa kanal klasörünü) Windows Gezgini'nde açar.
 * 
 * @param {string} channelName Açılacak kanal klasörünün ismi
 */
export async function openFolder(channelName) {
  if (typeof channelName !== 'string') {
    channelName = '';
  }
  try {
    const res = await fetch('/api/open-folder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channelName })
    });
    const data = await res.json();
    if (!data.success) {
      showToast(data.error || 'Klasör açılamadı.', 'error');
    }
  } catch (err) {
    showToast('Sunucu ile iletişim hatası.', 'error');
  }
}
window.openFolder = openFolder;

// ==========================================
// GGUF Model Klasörü: Otomatik .gguf Tarama ve Model Seçimi
// ==========================================

/**
 * Seçilen klasördeki .gguf modellerini sunucudan taratıp ayarlardaki model listesini doldurur.
 * @param {string} dir - Taranacak klasör (boşsa kayıtlı ggufModelsDir kullanılır)
 * @param {boolean} [silent=false] - true ise hata toast'ı gösterilmez (sessiz açılış taraması)
 */
export async function refreshGgufModelList(dir, silent = false) {
  const wrap = document.getElementById('settings-gguf-model-list-wrap');
  const select = document.getElementById('settings-gguf-model-select');
  const hint = document.getElementById('gguf-model-scan-hint');
  const dirInput = document.getElementById('settings-gguf-models-dir');
  const pathInput = document.getElementById('settings-gguf-model-path');
  if (!wrap || !select) return;

  const t = translations[localDb.settings?.lang || 'tr'] || translations.tr;
  let targetDir = (typeof dir === 'string' && dir.trim()) ? dir.trim() : ((dirInput && dirInput.value.trim()) || (localDb.settings?.ggufModelsDir || ''));
  if (!targetDir && localDb.settings?.ggufModelPath) {
    targetDir = localDb.settings.ggufModelPath.replace(/[\\/][^\\/]*$/, '');
  }
  if (dirInput && targetDir && !dirInput.value) {
    dirInput.value = targetDir;
  }

  try {
    const res = await fetch(`/api/gguf/models?dir=${encodeURIComponent(targetDir)}`);
    const data = await res.json();
    if (!data.success) {
      wrap.style.display = 'none';
      if (!silent) showToast(data.error || t.settings_gguf_no_models || 'Model klasörü bulunamadı.', 'warning');
      return;
    }

    const savedPath = (pathInput && pathInput.value.trim()) || localDb.settings?.ggufModelPath || '';
    select.innerHTML = '';
    let savedFound = false;
    (data.models || []).forEach(m => {
      const opt = document.createElement('option');
      opt.value = m.path;
      const sizeStr = m.sizeMB >= 1024
        ? (m.sizeMB / 1024).toFixed(1) + ' GB'
        : (m.sizeMB > 0 ? m.sizeMB + ' MB' : '');
      opt.textContent = sizeStr ? `[${sizeStr}] ${m.name}` : m.name;
      opt.title = m.path;
      if (m.path === savedPath) { opt.selected = true; savedFound = true; }
      select.appendChild(opt);
    });

    wrap.style.display = 'block';
    if (hint) {
      if ((data.models || []).length === 0) {
        hint.textContent = t.settings_gguf_no_models || 'Bu klasörde .gguf model bulunamadı.';
        hint.style.color = 'var(--text-muted)';
      } else if (savedPath && !savedFound) {
        hint.textContent = `${data.models.length} ${t.settings_gguf_models_found || 'model bulundu'}`;
        hint.style.color = '#f59e0b';
      } else {
        hint.textContent = `${data.models.length} ${t.settings_gguf_models_found || 'model bulundu'}`;
        hint.style.color = '#60a5fa';
      }
    }

    if ((data.models || []).length > 0) {
      if (!savedFound || !savedPath) {
        select.selectedIndex = 0;
        onSettingsGgufModelSelect(data.models[0].path);
      }
    } else {
      select.innerHTML = '<option value="">—</option>';
    }
  } catch (err) {
    console.warn('[GGUF Model Scan Warn]:', err);
    if (!silent) showToast('Model taraması sırasında bağlantı hatası.', 'error');
  }
}
window.refreshGgufModelList = refreshGgufModelList;

/**
 * Windows klasör seçim diyaloğunu açıp seçilen klasörü ggufModelsDir olarak kaydeder ve tarama başlatır.
 */
export async function selectGgufFolder() {
  const isEn = localDb.settings?.lang === 'en';
  showToast(isEn ? 'Opening folder selection window, please wait...' : 'Klasör seçim penceresi açılıyor, lütfen bekleyin...', 'info');
  const dirInput = document.getElementById('settings-gguf-models-dir');
  const savedModelPath = localDb.settings?.ggufModelPath || '';
  const startPath = (dirInput && dirInput.value.trim()) || (localDb.settings?.ggufModelsDir || '').trim() || (savedModelPath ? savedModelPath.replace(/[\\/][^\\/]*$/, '') : '');

  try {
    const res = await fetch('/api/select-folder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ startPath })
    });
    const data = await res.json();
    if (data.success && data.path) {
      if (dirInput) dirInput.value = data.path;
      if (localDb.settings) localDb.settings.ggufModelsDir = data.path;
      await refreshGgufModelList(data.path);
      triggerAutoSave(true);
      showToast(isEn ? `Model folder selected: ${data.path}` : `Model klasörü seçildi: ${data.path}`, 'success');
    } else if (data.message) {
      showToast(data.message, 'warning');
    }
  } catch (err) {
    showToast(isEn ? 'Connection error while selecting folder.' : 'Klasör seçilirken bir bağlantı hatası oluştu.', 'error');
  }
}
window.selectGgufFolder = selectGgufFolder;

/**
 * Ayarlardaki model listesinden seçim yapıldığında tam yolu yazıp otomatik kaydeder.
 * @param {string} fullPath - Seçilen .gguf dosyasının tam yolu
 */
export function onSettingsGgufModelSelect(fullPath) {
  if (!fullPath) return;
  const pathInput = document.getElementById('settings-gguf-model-path');
  if (pathInput) pathInput.value = fullPath;
  if (localDb.settings) localDb.settings.ggufModelPath = fullPath;
  triggerAutoSave(true);
}
window.onSettingsGgufModelSelect = onSettingsGgufModelSelect;

/**
 * Ayarlar formundaki input olaylarını ve klasör işlem butonlarını bağlar.
 */
// Kanal denetleme sıklığı 5 dk altındaysa açıklama satırını sarı uyarıya çevirir.
export function updateChannelIntervalWarning() {
  const input = document.getElementById('settings-channelcheckinterval');
  const desc = document.getElementById('desc-channel-check-interval');
  if (!input || !desc) return;
  const v = parseInt(input.value, 10);
  const low = input.value !== '' && Number.isFinite(v) && v < 5;
  desc.style.color = low ? '#f59e0b' : '';
  desc.style.fontWeight = low ? '600' : '';
}
window.updateChannelIntervalWarning = updateChannelIntervalWarning;

export function initSettingsFormListeners() {
  const settingsForm = document.getElementById('settings-form');
  if (settingsForm && !settingsForm.dataset.settingsFormInit) {
    settingsForm.dataset.settingsFormInit = 'true';
    settingsForm.addEventListener('submit', (e) => {
      e.preventDefault();
      triggerAutoSave(true);
    });

    const inputs = settingsForm.querySelectorAll('input, select, textarea');
    inputs.forEach(input => {
      if (input.hasAttribute('data-no-autosave')) return; // örn. ayar arama kutusu
      if (input.type === 'checkbox' || input.tagName.toLowerCase() === 'select') {
        input.addEventListener('change', () => triggerAutoSave(true));
      } else if (input.id === 'settings-weathercity') {
        input.addEventListener('change', () => triggerAutoSave(true));
        input.addEventListener('blur', () => {
          setTimeout(() => triggerAutoSave(true), 200);
        });
      } else {
        input.addEventListener('input', () => triggerAutoSave(false));
        input.addEventListener('change', () => triggerAutoSave(true));
        input.addEventListener('blur', () => triggerAutoSave(true));
      }
    });
  }

  const syncNowBtn = document.getElementById('sync-now-btn');
  if (syncNowBtn && !syncNowBtn.dataset.settingsInit) {
    syncNowBtn.dataset.settingsInit = 'true';
    syncNowBtn.addEventListener('click', async () => {
      syncNowBtn.disabled = true;
      const isEn = localDb.settings && localDb.settings.lang === 'en';
      showToast(isEn ? 'Scanning all channels in the background...' : 'Tüm kanallar arka planda taranıyor...', 'info');
      
      try {
        const res = await fetch('/api/sync', { method: 'POST' });
        const data = await res.json();
        if (data.success) {
          showToast(isEn ? 'Channel scan started in the background.' : 'Kanal denetimi arka planda başlatıldı.', 'success');
        } else {
          showToast(data.error || (isEn ? 'Error occurred.' : 'Hata oluştu.'), 'error');
        }
      } catch (err) {
        showToast(isEn ? 'Connection error.' : 'Bağlantı hatası.', 'error');
      } finally {
        syncNowBtn.disabled = false;
      }
    });
  }

  const openFolderBtn = document.getElementById('open-folder-btn');
  if (openFolderBtn && !openFolderBtn.dataset.settingsInit) {
    openFolderBtn.dataset.settingsInit = 'true';
    openFolderBtn.addEventListener('click', openFolder);
  }

  const selectFolderBtn = document.getElementById('select-folder-btn');
  const settingsDownloadPath = document.getElementById('settings-download-path');
  if (selectFolderBtn && !selectFolderBtn.dataset.settingsInit) {
    selectFolderBtn.dataset.settingsInit = 'true';
    selectFolderBtn.addEventListener('click', async () => {
      showToast('Klasör seçim penceresi açılıyor, lütfen bekleyin...', 'info');
      try {
        const res = await fetch('/api/select-folder', { method: 'POST' });
        const data = await res.json();
        if (data.success && data.path) {
          if (settingsDownloadPath) settingsDownloadPath.value = data.path;
          showToast(`Yeni indirme dizini seçildi: ${data.path}`, 'success');
          triggerAutoSave(true);
        } else if (data.message) {
          showToast(data.message, 'warning');
        }
      } catch (err) {
        showToast('Klasör seçilirken bir bağlantı hatası oluştu.', 'error');
      }
    });
  }

  const testFolderBtn = document.getElementById('test-folder-btn');
  if (testFolderBtn && !testFolderBtn.dataset.settingsInit) {
    testFolderBtn.dataset.settingsInit = 'true';
    testFolderBtn.addEventListener('click', async () => {
      const folder = settingsDownloadPath ? settingsDownloadPath.value.trim() : '';
      if (!folder) return showToast('Klasör yolu boş bırakılamaz.', 'error');
      
      try {
        const res = await fetch('/api/open-folder', { method: 'POST' });
        const data = await res.json();
        if (data.success) {
          showToast('Klasör yolu geçerli ve başarıyla açıldı!', 'success');
        } else {
          showToast(data.error || 'Klasör açılamadı.', 'error');
        }
      } catch (err) {
        showToast('Test hatası.', 'error');
      }
    });
  }

  // GGUF model klasörü butonları ve model listesi
  const ggufDirInput = document.getElementById('settings-gguf-models-dir');
  if (ggufDirInput && !ggufDirInput.dataset.settingsInit) {
    ggufDirInput.dataset.settingsInit = 'true';
    let dirTimer = null;
    ggufDirInput.addEventListener('input', (e) => {
      const val = e.target.value.trim();
      clearTimeout(dirTimer);
      dirTimer = setTimeout(() => {
        if (val) {
          if (localDb.settings) localDb.settings.ggufModelsDir = val;
          refreshGgufModelList(val);
        }
      }, 400);
    });
  }

  const ggufPathInput = document.getElementById('settings-gguf-model-path');
  if (ggufPathInput && !ggufPathInput.dataset.guardInit) {
    ggufPathInput.dataset.guardInit = 'true';
    ggufPathInput.addEventListener('change', (e) => {
      const val = e.target.value.trim();
      // Eğer kullanıcı sonu .gguf olmayan bir klasör yapıştırdıysa otomatik klasör alanına taşı:
      if (val && !val.toLowerCase().endsWith('.gguf')) {
        const dirEl = document.getElementById('settings-gguf-models-dir');
        if (dirEl) dirEl.value = val;
        if (localDb.settings) localDb.settings.ggufModelsDir = val;
        refreshGgufModelList(val);
      }
    });
  }

  const ggufBrowseBtn = document.getElementById('btn-select-gguf-dir');
  if (ggufBrowseBtn && !ggufBrowseBtn.dataset.settingsInit) {
    ggufBrowseBtn.dataset.settingsInit = 'true';
    ggufBrowseBtn.addEventListener('click', selectGgufFolder);
  }

  const ggufRescanBtn = document.getElementById('btn-rescan-gguf');
  if (ggufRescanBtn && !ggufRescanBtn.dataset.settingsInit) {
    ggufRescanBtn.dataset.settingsInit = 'true';
    ggufRescanBtn.addEventListener('click', () => {
      const dirVal = (document.getElementById('settings-gguf-models-dir')?.value.trim()) || localDb.settings?.ggufModelsDir || '';
      refreshGgufModelList(dirVal);
    });
  }

  // CPU / GPU (Vulkan) tercihi değişince motor durum çubuğu ve indirme butonu tercih güncellenir
  const ggufGpuModeCheckbox = document.getElementById('settings-gguf-gpu-mode');
  if (ggufGpuModeCheckbox && !ggufGpuModeCheckbox.dataset.settingsInit) {
    ggufGpuModeCheckbox.dataset.settingsInit = 'true';
    ggufGpuModeCheckbox.addEventListener('change', () => checkLlamaEngineStatusInUI());
  }

  // Sesli okuma hızı kaydırıcısı: etiketi canlı güncelle (kayıt formun otomatik listener'ınca yapılır)
  const ttsSpeedRange = document.getElementById('settings-tts-speed');
  if (ttsSpeedRange && !ttsSpeedRange.dataset.settingsInit) {
    ttsSpeedRange.dataset.settingsInit = 'true';
    ttsSpeedRange.addEventListener('input', () => updateTtsSpeedLabel());
  }

  const ggufModelSelect = document.getElementById('settings-gguf-model-select');
  if (ggufModelSelect && !ggufModelSelect.dataset.settingsInit) {
    ggufModelSelect.dataset.settingsInit = 'true';
    ggufModelSelect.addEventListener('change', () => onSettingsGgufModelSelect(ggufModelSelect.value));
  }

  const intervalInput = document.getElementById('settings-channelcheckinterval');
  if (intervalInput && !intervalInput.dataset.warnInit) {
    intervalInput.dataset.warnInit = 'true';
    intervalInput.addEventListener('input', updateChannelIntervalWarning);
    updateChannelIntervalWarning();
  }

  // Alt sekmeleri bağla
  initSettingsSubtabs();
}
window.addEventListener('beforeunload', () => {
  if (autoSaveTimer) {
    clearTimeout(autoSaveTimer);
    autoSaveTimer = null;
    performAutoSave();
  }
});

window.initSettingsFormListeners = initSettingsFormListeners;

// ==========================================
// Ayarlar Alt Sekmeleri (Subtabs)
// ==========================================

export function switchSettingsSubtab(targetSubtab) {
  const subtabButtons = document.querySelectorAll('.settings-subtab-btn');
  const subtabPanels = document.querySelectorAll('.settings-subtab-panel');
  const container = document.getElementById('settings-layout-container');

  if (!targetSubtab) targetSubtab = 'all';

  subtabButtons.forEach(b => {
    const isActive = (b.getAttribute('data-subtab') === targetSubtab);
    b.classList.toggle('active', isActive);
    b.setAttribute('aria-selected', isActive ? 'true' : 'false');
  });

  if (container) {
    if (targetSubtab === 'all') {
      container.classList.add('view-all');
      container.classList.remove('view-single');
    } else {
      container.classList.remove('view-all');
      container.classList.add('view-single');
    }
  }

  subtabPanels.forEach(p => {
    const shouldShow = (targetSubtab === 'all' || p.id === 'settings-subtab-' + targetSubtab);
    p.classList.toggle('active', shouldShow);
    p.style.display = shouldShow ? 'block' : 'none';
  });

  try {
    localStorage.setItem('haytool_settings_subtab', targetSubtab);
  } catch (e) {}

  if (typeof lucide !== 'undefined' && lucide.createIcons) {
    lucide.createIcons();
  }
}
window.switchSettingsSubtab = switchSettingsSubtab;

export function initSettingsSubtabs() {
  const subtabButtons = document.querySelectorAll('.settings-subtab-btn');
  const subtabPanels = document.querySelectorAll('.settings-subtab-panel');

  if (!subtabButtons.length || !subtabPanels.length) return;

  subtabButtons.forEach(btn => {
    if (btn.dataset.subtabBound) return;
    btn.dataset.subtabBound = 'true';
    btn.addEventListener('click', () => {
      const targetSubtab = btn.getAttribute('data-subtab') || 'all';
      switchSettingsSubtab(targetSubtab);
    });
  });

  // Sayfa ilk açıldığında veya kayıtlı sekme varsa aktifleştir (Test modunda daima "all")
  let savedSubtab = 'all';
  if (typeof navigator !== 'undefined' && !navigator.webdriver) {
    try {
      const stored = localStorage.getItem('haytool_settings_subtab');
      if (stored && (stored === 'all' || document.getElementById('settings-subtab-' + stored))) savedSubtab = stored;
    } catch (e) {}
  }
  switchSettingsSubtab(savedSubtab);
  initSettingsSearch();
}
window.initSettingsSubtabs = initSettingsSubtabs;

// ==========================================
// Sistem Yedekleme & Geri Yükleme (backupManager.js modülüne delege edilmiştir)
// ==========================================
export {
  createSystemBackup,
  loadSystemBackupsList,
  restoreSystemBackup,
  downloadSystemBackup,
  deleteSystemBackup,
  triggerUploadBackupFile,
  uploadBackupFile
} from './backupManager.js';
// ==========================================
// GitHub Gist Senkronizasyon İşlevleri
// ==========================================

export function toggleGistTokenVisibility() {
  const input = document.getElementById('gist-token-input');
  const icon = document.getElementById('gist-token-eye-icon');
  if (!input) return;

  if (input.type === 'password') {
    input.type = 'text';
    if (icon) icon.setAttribute('data-lucide', 'eye-off');
  } else {
    input.type = 'password';
    if (icon) icon.setAttribute('data-lucide', 'eye');
  }
  try { if (typeof lucide !== 'undefined') lucide.createIcons(); } catch (e) {}
}
window.toggleGistTokenVisibility = toggleGistTokenVisibility;

export async function testGistToken() {
  const input = document.getElementById('gist-token-input');
  const token = input ? input.value.trim() : '';
  const isEn = localDb.settings?.lang === 'en';

  if (!token) {
    showToast(isEn ? 'Please enter a GitHub Token.' : 'Lütfen bir GitHub Token girin.', 'error');
    return;
  }

  try {
    showToast(isEn ? 'Verifying GitHub Token...' : 'GitHub Token doğrulanıyor...', 'info');
    const res = await fetch('/api/gist/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token })
    });
    const data = await res.json();

    if (data.success) {
      if (data.warning) {
        showToast(data.warning, 'warning');
      } else {
        showToast(isEn ? `Token verified! Connected as: ${data.username}` : `Token doğrulandı! Bağlanan kullanıcı: ${data.username}`, 'success');
      }
    } else {
      showToast(data.error || (isEn ? 'Token verification failed.' : 'Token doğrulaması başarısız.'), 'error');
    }
  } catch (err) {
    showToast(isEn ? 'Connection error.' : 'Bağlantı hatası.', 'error');
  }
}
window.testGistToken = testGistToken;

export async function pushGistChannels() {
  const tokenInput = document.getElementById('gist-token-input');
  const idInput = document.getElementById('gist-id-input');
  const autoSyncCheckbox = document.getElementById('gist-auto-sync-checkbox');

  let token = tokenInput && tokenInput.value ? tokenInput.value.trim() : '';
  if (!token && localDb.settings?.githubToken) token = localDb.settings.githubToken;
  let gistId = idInput && idInput.value ? idInput.value.trim() : '';
  if (!gistId && localDb.settings?.githubGistId) gistId = localDb.settings.githubGistId;
  const autoSync = autoSyncCheckbox ? autoSyncCheckbox.checked : false;
  const isEn = localDb.settings?.lang === 'en';

  if (!token) {
    showToast(isEn ? 'GitHub Token missing. Please enter a new token.' : 'GitHub Token bulunamadı. Lütfen yeni bir token girin veya Token\'ı Sil\'e basıp tekrar kaydedin.', 'error');
    return;
  }

  try {
    showToast(isEn ? 'Uploading system data to GitHub Gist...' : 'Sistem verileri GitHub Gist üzerine aktarılıyor...', 'info');
    const res = await fetch('/api/gist/push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, gistId, autoSync })
    });
    const data = await res.json();

    if (data.success) {
      if (idInput && data.gistId) idInput.value = data.gistId;
      if (localDb.settings) {
        localDb.settings.githubToken = token;
        localDb.settings.githubGistId = data.gistId || gistId;
        localDb.settings.autoSyncGist = autoSync;
      }
      populateGistFields();
      triggerAutoSave(true);
      showToast(isEn ? 'System data uploaded to GitHub Gist successfully!' : 'Sistem verileri başarıyla GitHub Gist üzerine yüklendi!', 'success');
    } else {
      let errMsg = data.error || (isEn ? 'Push failed.' : 'Gist yüklemesi başarısız.');
      if (errMsg.toLowerCase().includes('bad credentials') || errMsg.includes('401')) {
        errMsg = isEn ? 'Invalid or revoked GitHub Token. Please delete and save a new token.' : 'GitHub Token\'ı geçersiz veya iptal edilmiş. Lütfen "Token\'ı Sil"e basıp yeni bir token kaydedin.';
      }
      showToast(errMsg, 'error');
    }
  } catch (err) {
    showToast(isEn ? 'Connection error.' : 'Bağlantı hatası.', 'error');
  }
}
window.pushGistChannels = pushGistChannels;

export async function pullGistChannels() {
  const tokenInput = document.getElementById('gist-token-input');
  const idInput = document.getElementById('gist-id-input');

  let token = tokenInput && tokenInput.value ? tokenInput.value.trim() : '';
  if (!token && localDb.settings?.githubToken) token = localDb.settings.githubToken;
  let gistId = idInput && idInput.value ? idInput.value.trim() : '';
  if (!gistId && localDb.settings?.githubGistId) gistId = localDb.settings.githubGistId;
  const isEn = localDb.settings?.lang === 'en';

  if (!token || !gistId) {
    showToast(isEn ? 'Please enter both GitHub Token and Gist ID.' : 'Lütfen hem GitHub Token hem de Gist ID girin.', 'error');
    return;
  }

  try {
    showToast(isEn ? 'Downloading system data from GitHub Gist...' : 'Sistem verileri GitHub Gist üzerinden indiriliyor...', 'info');
    const res = await fetch('/api/gist/pull', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, gistId })
    });
    const data = await res.json();

    if (data.success) {
      if (localDb.settings) {
        localDb.settings.githubToken = token;
        localDb.settings.githubGistId = gistId;
      }
      populateGistFields();
      triggerAutoSave(true);
      showToast(isEn ? 'System data pulled from Gist successfully!' : 'Sistem verileri Gist üzerinden başarıyla yüklendi!', 'success');
      setTimeout(() => window.location.reload(), 1200);
    } else {
      let errMsg = data.error || (isEn ? 'Pull failed.' : 'Gist indirmesi başarısız.');
      if (errMsg.toLowerCase().includes('bad credentials') || errMsg.includes('401')) {
        errMsg = isEn ? 'Invalid or revoked GitHub Token. Please delete and save a new token.' : 'GitHub Token\'ı geçersiz veya iptal edilmiş. Lütfen "Token\'ı Sil"e basıp yeni bir token kaydedin.';
      }
      showToast(errMsg, 'error');
    }
  } catch (err) {
    showToast(isEn ? 'Connection error.' : 'Bağlantı hatası.', 'error');
  }
}
window.pullGistChannels = pullGistChannels;

// Türkçe Açıklama: GitHub kişisel erişim tokenı (PAT) alma sayfasını açıklamaya anlık tarih-saat ekleyerek yeni sekmede açar.
export function openGetGistTokenPage() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const dateStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}`;
  const desc = encodeURIComponent(`HaYTooL-YT-Downloader (${dateStr})`);
  const url = `https://github.com/settings/tokens/new?scopes=gist&description=${desc}`;
  window.open(url, '_blank');
}
window.openGetGistTokenPage = openGetGistTokenPage;

export function toggleAutoSyncGist(checked) {
  if (localDb.settings) {
    localDb.settings.autoSyncGist = checked;
  }
}
window.toggleAutoSyncGist = toggleAutoSyncGist;

export function toggleGeminiKeyVisibility() {
  const input = document.getElementById('gemini-api-key-input');
  const icon = document.getElementById('gemini-key-eye-icon');
  if (!input) return;
  if (input.type === 'password') {
    input.type = 'text';
    if (icon) icon.setAttribute('data-lucide', 'eye-off');
  } else {
    input.type = 'password';
    if (icon) icon.setAttribute('data-lucide', 'eye');
  }
  if (window.lucide && typeof window.lucide.createIcons === 'function') {
    window.lucide.createIcons();
  }
}
window.toggleGeminiKeyVisibility = toggleGeminiKeyVisibility;

export function populateGistFields() {
  const geminiInput = document.getElementById('gemini-api-key-input');
  if (geminiInput && localDb.settings?.geminiApiKey) {
    geminiInput.value = localDb.settings.geminiApiKey;
  }
  const groqInput = document.getElementById('groq-api-key-input');
  if (groqInput && localDb.settings?.groqApiKey) {
    groqInput.value = localDb.settings.groqApiKey;
  }
  const deepseekInput = document.getElementById('deepseek-api-key-input');
  if (deepseekInput && localDb.settings?.deepseekApiKey) {
    deepseekInput.value = localDb.settings.deepseekApiKey;
  }
  const lmPortInput = document.getElementById('settings-lmstudio-port');
  if (lmPortInput) {
    lmPortInput.value = localDb.settings?.lmStudioPort || 1234;
  }
  const lmModelInput = document.getElementById('settings-lmstudio-model');
  if (lmModelInput && localDb.settings?.lmStudioModel) {
    lmModelInput.value = localDb.settings.lmStudioModel;
  }
  const ggufDirInput = document.getElementById('settings-gguf-models-dir');
  if (ggufDirInput && localDb.settings?.ggufModelsDir) {
    ggufDirInput.value = localDb.settings.ggufModelsDir;
  }
  const ggufPathInput = document.getElementById('settings-gguf-model-path');
  if (ggufPathInput && localDb.settings?.ggufModelPath) {
    ggufPathInput.value = localDb.settings.ggufModelPath;
  }
  if (localDb.settings?.ggufModelsDir || localDb.settings?.ggufModelPath) {
    refreshGgufModelList(localDb.settings.ggufModelsDir || '', true);
  }
  const ggufGpuModeInput = document.getElementById('settings-gguf-gpu-mode');
  if (ggufGpuModeInput) {
    ggufGpuModeInput.checked = localDb.settings?.ggufGpuMode === true;
  }
  const ttsSpeedInput = document.getElementById('settings-tts-speed');
  if (ttsSpeedInput) {
    const savedSpeed = Number(localDb.settings?.ttsSpeed);
    ttsSpeedInput.value = (savedSpeed >= 0.7 && savedSpeed <= 1.5) ? String(savedSpeed) : '1';
    updateTtsSpeedLabel();
  }
  const ttsDirInput = document.getElementById('settings-tts-voices-dir');
  if (ttsDirInput) {
    ttsDirInput.value = localDb.settings?.ttsVoicesDir || '';
  }
  checkLlamaEngineStatusInUI();
  checkTtsStatusInUI();
  checkProtocolStatus();
  checkCliPathStatus();
  const openaiInput = document.getElementById('openai-api-key-input');
  if (openaiInput && localDb.settings?.openAiApiKey) {
    openaiInput.value = localDb.settings.openAiApiKey;
  }
  const providerSelect = document.getElementById('settings-ai-provider');
  if (providerSelect && localDb.settings?.aiProvider) {
    providerSelect.value = localDb.settings.aiProvider;
  }

  if (!localDb.settings) return;
  const tokenInput = document.getElementById('gist-token-input');
  const idInput = document.getElementById('gist-id-input');
  const autoSyncCheckbox = document.getElementById('gist-auto-sync-checkbox');
  const linkContainer = document.getElementById('gist-online-link-container');
  const linkEl = document.getElementById('gist-online-link');

  const unregState = document.getElementById('gist-unregistered-state');
  const regState = document.getElementById('gist-registered-state');
  const hasSavedToken = !!(localDb.settings.githubToken && localDb.settings.githubToken.trim());

  if (unregState && regState) {
    if (hasSavedToken) {
      unregState.style.display = 'none';
      regState.style.display = 'block';
    } else {
      unregState.style.display = 'block';
      regState.style.display = 'none';
    }
  }

  if (tokenInput && localDb.settings.githubToken !== undefined) {
    if (document.activeElement !== tokenInput) {
      tokenInput.value = localDb.settings.githubToken || '';
    }
  }
  if (idInput && localDb.settings.githubGistId !== undefined) {
    if (document.activeElement !== idInput) {
      idInput.value = localDb.settings.githubGistId || '';
    }
  }
  if (autoSyncCheckbox && localDb.settings.autoSyncGist !== undefined) {
    if (document.activeElement !== autoSyncCheckbox) {
      autoSyncCheckbox.checked = !!localDb.settings.autoSyncGist;
    }
  }

  const gistId = (idInput && idInput.value ? idInput.value.trim() : '') || (localDb.settings && localDb.settings.githubGistId) || '';
  if (linkContainer && linkEl) {
    if (gistId) {
      linkEl.href = 'https://gist.github.com/' + gistId;
      linkContainer.style.display = 'block';
    } else {
      linkContainer.style.display = 'none';
    }
  }
}
window.populateGistFields = populateGistFields;

export async function saveGistToken() {
  const tokenInput = document.getElementById('gist-token-input');
  const idInput = document.getElementById('gist-id-input');
  const token = tokenInput ? tokenInput.value.trim() : '';
  const gistId = idInput ? idInput.value.trim() : '';
  const isEn = localDb.settings?.lang === 'en';

  if (!token) {
    showToast(isEn ? 'Please enter a GitHub Token.' : 'Lütfen geçerli bir GitHub Token girin.', 'error');
    return;
  }

  showToast(isEn ? 'Verifying token...' : 'Token doğrulanıyor...', 'info');

  try {
    const res = await fetch('/api/gist/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token })
    });
    const data = await res.json();

    if (data.success) {
      if (localDb.settings) {
        localDb.settings.githubToken = token;
        localDb.settings.githubGistId = gistId;
      }
      populateGistFields();
      triggerAutoSave(true);
      const username = data.username || data.user || '';
      showToast(isEn ? `Token verified and saved! Account: @${username}` : `Token başarıyla doğrulandı ve kaydedildi! Kullanıcı: @${username}`, 'success');
    } else {
      showToast(data.error || (isEn ? 'Token is invalid.' : 'Token geçersiz.'), 'error');
    }
  } catch (err) {
    showToast(isEn ? 'Connection error.' : 'Bağlantı hatası.', 'error');
  }
}
window.saveGistToken = saveGistToken;

export async function deleteGistToken() {
  const isEn = localDb.settings?.lang === 'en';
  if (!confirm(isEn ? 'Are you sure you want to remove your GitHub Token credentials from this device?' : 'GitHub Token ve bağlantı bilgilerinizi bu bilgisayardan silmek istediğinize emin misiniz?')) return;

  if (localDb.settings) {
    localDb.settings.githubToken = '';
    localDb.settings.githubGistId = '';
  }

  const tokenInput = document.getElementById('gist-token-input');
  const idInput = document.getElementById('gist-id-input');
  if (tokenInput) tokenInput.value = '';
  if (idInput) idInput.value = '';

  populateGistFields();
  triggerAutoSave(true);
  showToast(isEn ? 'GitHub Token removed.' : 'GitHub Token ve bağlantı bilgileri silindi.', 'info');
}
window.deleteGistToken = deleteGistToken;

// ==========================================
// YouTube Oturum ve Çerez Durumu
// ==========================================

export async function checkYouTubeAuthStatus() {
  const badgeEl = document.getElementById('cookie-status-badge');
  const topbarCookieBadge = document.getElementById('badge-cookie');
  const topbarCookieIndicator = document.getElementById('cookie-test-indicator');

  const currentLang = localStorage.getItem('haytool_user_lang') || 'tr';
  const t = translations[currentLang] || translations.tr;

  try {
    const res = await fetch('/api/youtube-auth-status');
    const data = await res.json();
    const isAuthActive = data.success && data.activeSource && data.activeSource !== 'none';

    if (isAuthActive) {
      if (badgeEl) {
        badgeEl.style.background = 'rgba(34, 197, 94, 0.15)';
        badgeEl.style.color = '#22c55e';
        badgeEl.style.border = '1px solid rgba(34, 197, 94, 0.3)';
        badgeEl.innerHTML = `<i data-lucide="shield-check" style="width: 12px; height: 12px;"></i> <span>${t.cookie_status_active || 'Oturum Aktif (Bot Koruması Devre Dışı)'}</span>`;
      }

      if (topbarCookieBadge) {
        topbarCookieBadge.title = t.topbar_cookie_active || 'YouTube Oturumu Aktif (4K/1080p ve Bot Koruması Devrede)';
      }
      if (topbarCookieIndicator) {
        topbarCookieIndicator.style.backgroundColor = '#22c55e';
        topbarCookieIndicator.style.boxShadow = '0 0 6px rgba(34, 197, 94, 0.8)';
        topbarCookieIndicator.title = t.topbar_cookie_verified || 'YouTube Oturumu Doğrulandı';
      }
    } else {
      if (badgeEl) {
        badgeEl.style.background = 'rgba(239, 68, 68, 0.15)';
        badgeEl.style.color = '#ef4444';
        badgeEl.style.border = '1px solid rgba(239, 68, 68, 0.3)';
        badgeEl.innerHTML = `<i data-lucide="shield-alert" style="width: 12px; height: 12px;"></i> <span>${t.cookie_status_anon || 'Oturum Açılmamış (Anonim Mod)'}</span>`;
      }

      if (topbarCookieBadge) {
        topbarCookieBadge.title = t.topbar_cookie_inactive || 'YouTube Oturumu Açılmamış (Anonim Mod - 360p veya Bot Riski)';
      }
      if (topbarCookieIndicator) {
        topbarCookieIndicator.style.backgroundColor = '#ef4444';
        topbarCookieIndicator.style.boxShadow = 'none';
        topbarCookieIndicator.title = t.topbar_cookie_missing || 'YouTube Oturumu Bulunamadı';
      }
    }
    if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
  } catch (e) {
    console.error('YouTube auth status error:', e);
  }
}
window.checkYouTubeAuthStatus = checkYouTubeAuthStatus;

export async function testCookies() {
  const currentLang = localStorage.getItem('haytool_user_lang') || 'tr';
  showToast(currentLang === 'en' ? 'Verifying YouTube cookies...' : 'YouTube çerezleri doğrulanıyor...', 'info');

  try {
    // Masaüstü uygulamasındaysak WebView2 bellek çerezlerini anında diske senkronize et
    if (window.chrome?.webview?.hostObjects?.playerBridge?.syncCookies) {
      try {
        window.chrome.webview.hostObjects.playerBridge.syncCookies();
        await new Promise(r => setTimeout(r, 600));
      } catch (err) {}
    }

    const res = await fetch('/api/test-cookies');
    const data = await res.json();
    if (data.success) {
      showToast(data.message || 'Çerezler başarıyla doğrulandı.', 'success');
    } else {
      showToast(data.error || 'Çerez doğrulama başarısız.', 'warning');
    }
    await checkYouTubeAuthStatus();
  } catch (e) {
    showToast('Sunucu ile iletişim hatası.', 'error');
  }
}
window.testCookies = testCookies;

export async function logoutYouTube() {
  const currentLang = localStorage.getItem('haytool_user_lang') || 'tr';
  const t = translations[currentLang] || translations.tr;

  const confirmMsg = t.logout_youtube_confirm || 'YouTube oturumunu kapatmak ve yerel çerezleri temizlemek istediğinizden emin misiniz?';
  if (!confirm(confirmMsg)) return;

  showToast(currentLang === 'en' ? 'Signing out of YouTube...' : 'YouTube oturumu kapatılıyor...', 'info');

  try {
    const res = await fetch('/api/logout-youtube', { method: 'POST' });
    const data = await res.json();
    if (data.success) {
      showToast(t.logout_youtube_success || 'YouTube oturumu başarıyla kapatıldı.', 'success');
    } else {
      showToast(data.error || 'Oturum kapatılırken hata oluştu.', 'error');
    }
    checkYouTubeAuthStatus();
  } catch (e) {
    showToast('Sunucu ile iletişim hatası.', 'error');
  }
}
window.logoutYouTube = logoutYouTube;

export async function openYouTubeLogin() {
  const currentLang = localStorage.getItem('haytool_user_lang') || 'tr';
  const loginUrl = 'https://accounts.google.com/ServiceLogin?service=youtube&continue=https%3A%2F%2Fwww.youtube.com';

  // WebView2 içinde mi kontrol et (HaYTooL Player içinde çalışıyor muyuz?)
  const isWebView2 = typeof window.chrome !== 'undefined' && typeof window.chrome.webview !== 'undefined';

  if (isWebView2) {
    // Player içindeyiz: mevcut WebView2 penceresini YouTube login'e yönlendir.
    // NavigationCompleted → SyncYouTubeCookiesToFileAsync → cookies.txt güncellenir.
    showToast(currentLang === 'en' ? 'Redirecting to YouTube login...' : 'YouTube giriş sayfasına yönlendiriliyor...', 'info');
    window.location.href = loginUrl;
  } else {
    // Normal tarayıcıda: API aracılığıyla dahili player aç
    showToast(currentLang === 'en' ? 'Opening YouTube login window...' : 'YouTube oturum açma sayfası açılıyor...', 'info');
    try {
      await fetch('/api/open-youtube-login', { method: 'POST' });
    } catch (e) {}
  }
}
window.openYouTubeLogin = openYouTubeLogin;

// YouTube oturum ve çerez buton dinleyicilerini bağla
if (typeof document !== 'undefined') {
  const setupSettingsListeners = () => {
    const btnYtLogin = document.getElementById('btn-open-yt-login');
    if (btnYtLogin && !btnYtLogin.dataset.settingsInit) {
      btnYtLogin.dataset.settingsInit = 'true';
      btnYtLogin.addEventListener('click', openYouTubeLogin);
    }

    const btnTestCookies = document.getElementById('btn-test-cookies-live');
    if (btnTestCookies && !btnTestCookies.dataset.settingsInit) {
      btnTestCookies.dataset.settingsInit = 'true';
      btnTestCookies.addEventListener('click', testCookies);
    }

    const btnLogoutYt = document.getElementById('btn-logout-youtube');
    if (btnLogoutYt && !btnLogoutYt.dataset.settingsInit) {
      btnLogoutYt.dataset.settingsInit = 'true';
      btnLogoutYt.addEventListener('click', logoutYouTube);
    }

    const btnOpenTemp = document.getElementById('open-temp-folder-btn');
    if (btnOpenTemp && !btnOpenTemp.dataset.settingsInit) {
      btnOpenTemp.dataset.settingsInit = 'true';
      btnOpenTemp.addEventListener('click', openTempFolder);
    }

    initSettingsFormListeners();
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupSettingsListeners);
  } else {
    setupSettingsListeners();
  }
}

// Türkçe Açıklama: Aktif Temp klasörünü sistem dosya gezgininde açar.
/**
 * Aktif geçici dosyalar (Temp) klasörünü dosya gezgininde açar.
 */
export async function openTempFolder() {
  const currentLang = localStorage.getItem('haytool_user_lang') || 'tr';
  const isEn = currentLang === 'en';
  try {
    const res = await fetch('/api/settings/open-temp', { method: 'POST' });
    const data = await res.json();
    if (data.success) {
      showToast(isEn ? 'Temp folder opened.' : 'Temp klasörü açıldı.', 'success');
    } else {
      showToast(data.error || (isEn ? 'Failed to open temp folder.' : 'Temp klasörü açılamadı.'), 'error');
    }
  } catch (err) {
    showToast(`Hata: ${err.message}`, 'error');
  }
}
window.openTempFolder = openTempFolder;

/**
 * LM Studio sunucusundaki mevcut modelleri çekip arayüze yükler.
 */
export async function fetchLmStudioModels() {
  const portInput = document.getElementById('settings-lmstudio-port');
  const port = (portInput && portInput.value) || 1234;
  const hint = document.getElementById('lmstudio-status-hint');
  const btn = document.getElementById('btn-fetch-lmstudio-models');
  if (btn) btn.classList.add('loading');

  try {
    const res = await fetch(`/api/lmstudio/models?port=${encodeURIComponent(port)}`);
    const data = await res.json();
    if (data.success && Array.isArray(data.models) && data.models.length > 0) {
      const datalist = document.getElementById('lmstudio-models-datalist');
      if (datalist) {
        datalist.innerHTML = data.models.map(m => `<option value="${m}"></option>`).join('');
      }
      const modelInput = document.getElementById('settings-lmstudio-model');
      if (modelInput && !modelInput.value) {
        modelInput.value = data.models[0];
      }
      if (hint) {
        hint.innerHTML = `<span style="color: #10b981; font-weight: 600;">✓ ${data.models.length} model algılandı (${data.models.slice(0, 2).join(', ')}${data.models.length > 2 ? '...' : ''})</span>`;
      }
      showToast(`${data.models.length} LM Studio modeli başarıyla bulundu!`, 'success');
      triggerAutoSave(true);
    } else {
      if (hint) {
        hint.innerHTML = `<span style="color: #f59e0b;">⚠ Port ${port} üzerinde model bulunamadı. LM Studio'da bir model yüklü olduğundan emin olun.</span>`;
      }
      showToast('LM Studio üzerinde yüklü model bulunamadı.', 'warning');
    }
  } catch (err) {
    if (hint) {
      hint.innerHTML = `<span style="color: #ef4444;">✗ Bağlantı hatası: ${err.message}</span>`;
    }
    showToast('LM Studio sunucusuna bağlanılamadı.', 'error');
  } finally {
    if (btn) btn.classList.remove('loading');
  }
}
window.fetchLmStudioModels = fetchLmStudioModels;


/**
 * Taşınabilir LLaMA motorlarının (CPU / GPU-Vulkan) durumunu arayüzdeki tercihe göre gösterir.
 */
export async function checkLlamaEngineStatusInUI() {
  const statusText = document.getElementById('gguf-engine-status-text');
  const downloadBtn = document.getElementById('btn-download-llama-engine');
  const btnText = document.getElementById('llama-download-btn-text');
  if (!statusText) return;

  const gpuMode = !!(document.getElementById('settings-gguf-gpu-mode') && document.getElementById('settings-gguf-gpu-mode').checked);
  const t = window.translations?.[window.localDb?.settings?.lang || 'tr'] || window.translations?.tr || {};

  try {
    const res = await fetch('/api/llama/status');
    const data = await res.json();
    const installed = gpuMode ? data.gpuInstalled : data.installed;

    if (btnText) {
      btnText.textContent = gpuMode
        ? (t.settings_llama_gpu_download || '⬇️ GPU Motorunu İndir (~36 MB)')
        : (t.settings_llama_engine_download || '⬇️ Motoru İndir (~23 MB)');
    }

    if (installed) {
      statusText.innerHTML = gpuMode
        ? `⚡ <span style="color: #10b981; font-weight: 600;">${t.llama_engine_ready_gpu || 'GPU (Vulkan) Motoru: Hazır'}</span>`
        : '⚡ <span style="color: #10b981; font-weight: 600;">Taşınabilir LLaMA Motoru: Hazır</span>';
      if (downloadBtn) downloadBtn.style.display = 'none';
    } else {
      statusText.innerHTML = gpuMode
        ? `⚠️ <span style="color: #f59e0b; font-weight: 600;">${t.llama_engine_missing_gpu || 'GPU Motoru Eksik'}</span>`
        : '⚠️ <span style="color: #f59e0b; font-weight: 600;">Taşınabilir Motor Eksik</span>';
      if (downloadBtn) downloadBtn.style.display = 'inline-flex';
    }

    // Önerilen model kartı: kurulu mu / süren indirme var mı
    try {
      const st = await (await fetch('/api/gguf/model/download-status')).json();
      if (st && st.active) {
        renderRecommendedModelState('installing');
        pollRecommendedModelStatus();
      } else if (data.recommendedInstalled) {
        renderRecommendedModelState('installed');
      } else {
        renderRecommendedModelState('idle');
      }
    } catch (_) {}
  } catch (_) {
    statusText.textContent = 'Motor durumu alınamadı.';
  }
}

/**
 * Taşınabilir LLaMA motorunu tek tıkla indirip kurar.
 */
export async function downloadLlamaEngine() {
  const statusText = document.getElementById('gguf-engine-status-text');
  const downloadBtn = document.getElementById('btn-download-llama-engine');
  const btnText = document.getElementById('llama-download-btn-text');
  const gpuMode = !!(document.getElementById('settings-gguf-gpu-mode') && document.getElementById('settings-gguf-gpu-mode').checked);
  if (downloadBtn) {
    downloadBtn.disabled = true;
    if (btnText) btnText.textContent = gpuMode ? '⏳ İndiriliyor (~36 MB)...' : '⏳ İndiriliyor (~23 MB)...';
  }
  if (statusText) {
    statusText.innerHTML = '<span style="color: #60a5fa;">İndiriliyor ve kuruluyor, lütfen bekleyin...</span>';
  }

  try {
    const res = await fetch('/api/llama/install', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ variant: gpuMode ? 'gpu' : 'cpu' })
    });
    const data = await res.json();
    if (data.success) {
      if (typeof window.showToast === 'function') window.showToast(data.message || 'Taşınabilir LLaMA motoru başarıyla kuruldu!', 'success');
      await checkLlamaEngineStatusInUI();
    } else {
      if (typeof window.showToast === 'function') window.showToast('Kurulum başarısız: ' + (data.error || 'Bilinmeyen hata'), 'error');
      if (statusText) statusText.innerHTML = '<span style="color: #ef4444;">İndirme hatası</span>';
      if (downloadBtn) {
        downloadBtn.disabled = false;
        if (btnText) btnText.textContent = '🔄 Tekrar Dene';
      }
    }
  } catch (err) {
    if (typeof window.showToast === 'function') window.showToast('Bağlantı hatası: ' + err.message, 'error');
    if (downloadBtn) {
      downloadBtn.disabled = false;
      if (btnText) btnText.textContent = '🔄 Tekrar Dene';
    }
  }
}
window.downloadLlamaEngine = downloadLlamaEngine;
window.checkLlamaEngineStatusInUI = checkLlamaEngineStatusInUI;

// ── Önerilen Başlangıç Modeli (Gemma 3 1B QAT) indirme akışı ──────────────
let recModelPollTimer = null;

/**
 * Önerilen model kartının görünüm durumunu günceller.
 * @param {'idle'|'installing'|'installed'|'error'} mode
 * @param {string} [message]
 */
function renderRecommendedModelState(mode, message = '') {
  const dlBtn = document.getElementById('btn-download-rec-model');
  if (!dlBtn) return;
  const cancelBtn = document.getElementById('btn-cancel-rec-model');
  const stateEl = document.getElementById('gguf-rec-state');
  const progressWrap = document.getElementById('gguf-rec-progress-wrap');
  const t = window.translations?.[window.localDb?.settings?.lang || 'tr'] || window.translations?.tr || {};

  if (mode === 'installed') {
    dlBtn.style.display = 'none';
    if (cancelBtn) cancelBtn.style.display = 'none';
    if (progressWrap) progressWrap.style.display = 'none';
    if (stateEl) {
      stateEl.style.display = 'inline';
      stateEl.style.color = '#10b981';
      stateEl.textContent = message || (t.settings_gguf_rec_installed || '✓ Model kurulu ve seçili');
    }
  } else if (mode === 'installing') {
    dlBtn.style.display = 'none';
    if (cancelBtn) cancelBtn.style.display = 'inline-flex';
    if (progressWrap) progressWrap.style.display = 'block';
    if (stateEl) stateEl.style.display = 'none';
  } else if (mode === 'error') {
    dlBtn.style.display = 'inline-flex';
    dlBtn.disabled = false;
    dlBtn.textContent = t.settings_gguf_rec_retry || '🔄 Tekrar Dene';
    if (cancelBtn) cancelBtn.style.display = 'none';
    if (progressWrap) progressWrap.style.display = 'none';
    if (stateEl) {
      stateEl.style.display = 'inline';
      stateEl.style.color = '#ef4444';
      stateEl.textContent = message || '';
    }
  } else {
    dlBtn.style.display = 'inline-flex';
    dlBtn.disabled = false;
    dlBtn.textContent = t.settings_gguf_rec_download || '⬇️ Modeli İndir (~687 MB)';
    if (cancelBtn) cancelBtn.style.display = 'none';
    if (progressWrap) progressWrap.style.display = 'none';
    if (stateEl) stateEl.style.display = 'none';
  }
}

/**
 * Önerilen model indirmesini sunucuda başlatır ve ilerlemeyi saniyede bir yoklar.
 */
export async function downloadRecommendedModel() {
  renderRecommendedModelState('installing');
  try {
    const res = await fetch('/api/gguf/model/download', { method: 'POST' });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'İndirme başlatılamadı.');
    if (data.alreadyInstalled) {
      applyRecommendedModelSettings(data.filePath);
      return;
    }
    pollRecommendedModelStatus();
  } catch (err) {
    renderRecommendedModelState('error', err.message);
  }
}
window.downloadRecommendedModel = downloadRecommendedModel;

/**
 * Devam eden önerilen model indirmesini iptal eder.
 */
export async function cancelRecommendedModelUi() {
  try { await fetch('/api/gguf/model/download-cancel', { method: 'POST' }); } catch (_) {}
  if (recModelPollTimer) { clearInterval(recModelPollTimer); recModelPollTimer = null; }
  renderRecommendedModelState('idle');
}
window.cancelRecommendedModelUi = cancelRecommendedModelUi;

/**
 * Sunucudaki indirme durumunu 1 sn'de bir yoklar; ilerleme çubuğunu günceller.
 */
function pollRecommendedModelStatus() {
  if (recModelPollTimer) clearInterval(recModelPollTimer);
  recModelPollTimer = setInterval(async () => {
    try {
      const res = await fetch('/api/gguf/model/download-status');
      const s = await res.json();
      const bar = document.getElementById('gguf-rec-progress-bar');
      const text = document.getElementById('gguf-rec-progress-text');
      const pct = (s.total > 0) ? Math.min(100, Math.round((s.received / s.total) * 100)) : 0;
      if (bar) bar.style.width = pct + '%';
      if (text) text.textContent = pct + '% · ' + Math.round(s.received / 1048576) + ' / ' + Math.round(s.total / 1048576) + ' MB';
      if (!s.active) {
        clearInterval(recModelPollTimer);
        recModelPollTimer = null;
        if (s.done) {
          applyRecommendedModelSettings(s.filePath);
        } else if (s.cancelled) {
          renderRecommendedModelState('idle');
        } else {
          renderRecommendedModelState('error', s.error || 'İndirme yarıda kesildi.');
        }
      }
    } catch (_) {
      if (recModelPollTimer) { clearInterval(recModelPollTimer); recModelPollTimer = null; }
      renderRecommendedModelState('error', 'İndirme durumu alınamadı.');
    }
  }, 1000);
}

/**
 * İndirilen önerilen modeli ayarlara bağlar: yol + klasör + sağlayıcı (GGUF) + otomatik kayıt.
 * @param {string} filePath - İndirilen .gguf dosyasının tam yolu
 */
function applyRecommendedModelSettings(filePath) {
  if (!filePath) return;
  const dir = filePath.replace(/[\\/][^\\/]*$/, '');
  const t = window.translations?.[window.localDb?.settings?.lang || 'tr'] || window.translations?.tr || {};

  const dirInput = document.getElementById('settings-gguf-models-dir');
  if (dirInput) dirInput.value = dir;
  const pathInput = document.getElementById('settings-gguf-model-path');
  if (pathInput) pathInput.value = filePath;
  if (localDb.settings) {
    localDb.settings.ggufModelPath = filePath;
    localDb.settings.ggufModelsDir = dir;
  }
  const providerSelect = document.getElementById('settings-ai-provider');
  if (providerSelect) providerSelect.value = 'gguf';

  triggerAutoSave(true);
  refreshGgufModelList(dir);
  renderRecommendedModelState('installed');
  if (typeof window.refreshGgufModelsInSummary === 'function') window.refreshGgufModelsInSummary();
  if (typeof window.showToast === 'function') {
    window.showToast(t.settings_gguf_rec_done_toast || 'Gemma 3 1B kuruldu ve seçildi! Artık sadece CPU/GPU tercihin var.', 'success');
  }
}

// ── Sesli Okuma (Piper TTS) ayar arayüzü ──────────────────────────────
let ttsStatusCache = null;

/**
 * Hız kaydırıcısının ×1,10 biçimindeki etiketini günceller.
 */
function updateTtsSpeedLabel() {
  const input = document.getElementById('settings-tts-speed');
  const label = document.getElementById('settings-tts-speed-value');
  if (!input || !label) return;
  const v = parseFloat(input.value) || 1;
  label.textContent = '×' + v.toFixed(2).replace('.', ',');
}

/**
 * Piper motoru + ses paketleri durumunu çeker, ses listesini ve durum çubuğunu kurar.
 */
export async function checkTtsStatusInUI() {
  const statusText = document.getElementById('tts-status-text');
  if (!statusText) return;
  const engineBtn = document.getElementById('btn-download-piper-engine');
  const voiceSel = document.getElementById('settings-tts-voice-select');
  const t = window.translations?.[window.localDb?.settings?.lang || 'tr'] || window.translations?.tr || {};

  try {
    const res = await fetch('/api/tts/status');
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Durum alınamadı.');
    ttsStatusCache = data;
    const installed = new Set(data.installedVoices || []);

    if (engineBtn) engineBtn.style.display = data.engineInstalled ? 'none' : 'inline-flex';

    if (voiceSel) {
      const saved = localDb.settings?.ttsVoiceId || '';
      voiceSel.innerHTML = '';
      (data.voices || []).forEach(v => {
        const opt = document.createElement('option');
        opt.value = v.id;
        opt.textContent = (installed.has(v.id) ? '✓ ' : '⬇️ ') + v.label + ' · ' + (installed.has(v.id) ? (t.tts_voice_installed || 'kurulu') : `~${v.sizeMB} MB`);
        voiceSel.appendChild(opt);
      });
      const ids = (data.voices || []).map(v => v.id);
      let pick = ids.includes(saved) ? saved : '';
      if (!pick && installed.has(data.defaultVoiceId)) pick = data.defaultVoiceId;
      if (!pick) pick = ids[0] || '';
      voiceSel.value = pick;
      if (pick && pick !== saved && localDb.settings) {
        localDb.settings.ttsVoiceId = pick;
      }
    }

    if (data.engineInstalled && installed.size > 0) {
      statusText.innerHTML = `🔊 <span style="color: #10b981; font-weight: 600;">${t.tts_engine_ready || 'Sesli Okuma: Hazır'}</span> · ${installed.size}/${(data.voices || []).length} ${t.tts_voice_installed || 'kurulu'}`;
    } else if (data.engineInstalled) {
      statusText.innerHTML = `⚠️ <span style="color: #f59e0b; font-weight: 600;">${t.tts_voice_needed || 'Motor hazır — bir ses paketi indirin'}</span>`;
    } else {
      statusText.innerHTML = `⚠️ <span style="color: #f59e0b; font-weight: 600;">${t.tts_engine_missing || 'Ses Motoru Eksik'}</span>`;
    }
    updateTtsVoiceDownloadButton();
  } catch (err) {
    statusText.textContent = 'Sesli okuma durumu alınamadı.';
  }
}
window.checkTtsStatusInUI = checkTtsStatusInUI;

/**
 * Seçili ses kurulu değilse durum çubuğundaki "Bu Sesi İndir" butonunu görünür yapar
 * (liste sesi varsayılan seçili gösterdiğinde change olayı hiç tetiklenmez).
 */
function updateTtsVoiceDownloadButton() {
  const btn = document.getElementById('btn-download-tts-voice');
  const voiceSel = document.getElementById('settings-tts-voice-select');
  if (!btn || !voiceSel || !ttsStatusCache) return;
  const t = window.translations?.[window.localDb?.settings?.lang || 'tr'] || window.translations?.tr || {};
  const installed = new Set(ttsStatusCache.installedVoices || []);
  const entry = (ttsStatusCache.voices || []).find(v => v.id === voiceSel.value);
  const need = !!(entry && !installed.has(entry.id));
  btn.style.display = need ? 'inline-flex' : 'none';
  const btnText = document.getElementById('tts-voice-btn-text');
  if (need && btnText) btnText.textContent = `${t.tts_voice_download || '⬇️ Bu Sesi İndir'} (~${entry.sizeMB} MB)`;
}

/**
 * Listede seçili olan (ama henüz kurulmamış) sesi indirir.
 */
export async function downloadSelectedTtsVoice() {
  const voiceSel = document.getElementById('settings-tts-voice-select');
  if (!voiceSel || !voiceSel.value) return;
  await onTtsVoiceSelectChange(voiceSel.value);
}
window.downloadSelectedTtsVoice = downloadSelectedTtsVoice;

/**
 * Kullanıcının Piper uyumlu (.onnx + .onnx.json) sesleri koyabileceği özel klasörü seçtirir.
 */
export async function selectTtsVoicesFolder() {
  const isEn = localDb.settings?.lang === 'en';
  showToast(isEn ? 'Opening folder selection window, please wait...' : 'Klasör seçim penceresi açılıyor, lütfen bekleyin...', 'info');
  const startPath = String(localDb.settings?.ttsVoicesDir || '').trim();

  try {
    const res = await fetch('/api/select-folder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ startPath })
    });
    const data = await res.json();
    if (data.success && data.path) {
      if (localDb.settings) localDb.settings.ttsVoicesDir = data.path;
      const dirInput = document.getElementById('settings-tts-voices-dir');
      if (dirInput) dirInput.value = data.path;
      triggerAutoSave(true);
      await checkTtsStatusInUI();
      if (typeof window.invalidateTtsAvailability === 'function') window.invalidateTtsAvailability();
    } else if (data.message) {
      showToast(data.message, 'warning');
    }
  } catch (err) {
    showToast(isEn ? 'Connection error while selecting folder.' : 'Klasör seçilirken bir bağlantı hatası oluştu.', 'error');
  }
}
window.selectTtsVoicesFolder = selectTtsVoicesFolder;

/**
 * Seçili sesle sabit bir Türkçe cümleyi sentezleyip çalar (uçtan uca ses testi).
 * Sorun sunucuda mı arayüzde mi olduğunu tek tıkla ayırır; hatayı birebir gösterir.
 */
export async function testTtsVoice() {
  const t = window.translations?.[window.localDb?.settings?.lang || 'tr'] || window.translations?.tr || {};
  const btn = document.getElementById('btn-test-tts');
  const btnText = document.getElementById('tts-test-btn-text');
  const statusText = document.getElementById('tts-status-text');
  const audio = document.getElementById('tts-test-audio');
  const voiceSel = document.getElementById('settings-tts-voice-select');
  if (!audio) {
    if (typeof window.showToast === 'function') window.showToast('Test ses öğesi bulunamadı (sayfayı yenileyin).', 'error');
    return;
  }

  if (btn) btn.disabled = true;
  if (btnText) btnText.textContent = '⏳ Test...';
  if (statusText) statusText.innerHTML = '<span style="color: #60a5fa;">Ses sentezleniyor...</span>';

  try {
    const speed = parseFloat((document.getElementById('settings-tts-speed') || {}).value || '1') || 1;
    const res = await fetch('/api/tts/speak', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: 'Merhaba, bu bir sesli okuma testidir. Ses geliyorsa her şey çalışıyor demektir.',
        voiceId: (voiceSel && voiceSel.value) || (localDb.settings && localDb.settings.ttsVoiceId) || undefined,
        speed
      })
    });
    let data = null;
    try { data = await res.json(); } catch (_) {}
    if (!res.ok || !data || !data.success) {
      throw new Error((data && data.error) || `HTTP ${res.status}`);
    }

    audio.src = `/api/tts/audio/${encodeURIComponent(data.audioId)}`;
    await new Promise((resolve) => {
      const done = () => resolve();
      audio.addEventListener('canplay', done, { once: true });
      audio.addEventListener('error', done, { once: true });
      setTimeout(done, 4000);
      audio.load();
    });
    await audio.play();
    if (statusText) statusText.innerHTML = `<span style="color: #10b981; font-weight: 600;">✅ Ses çalışıyor${data.voiceId ? ' · ' + data.voiceId : ''}</span>`;
    if (typeof window.showToast === 'function') window.showToast('Ses testi başarılı — hoparlörden ses geliyor.', 'success');
  } catch (err) {
    if (statusText) statusText.innerHTML = `<span style="color: #ef4444; font-weight: 600;">❌ ${String(err.message).slice(0, 120)}</span>`;
    if (typeof window.showToast === 'function') window.showToast('Ses testi başarısız: ' + err.message, 'error');
  } finally {
    if (btn) btn.disabled = false;
    if (btnText) btnText.textContent = t.tts_test_button || '🔊 Sesi Test Et';
    if (typeof window.invalidateTtsAvailability === 'function') window.invalidateTtsAvailability();
  }
}
window.testTtsVoice = testTtsVoice;

/**
 * Ses listesi değişince: kurulmamış ses seçilirse onaylayıp indirir, kuruluysa ayarlar.
 * @param {string} voiceId - Seçilen ses kimliği
 */
export async function onTtsVoiceSelectChange(voiceId) {
  const t = window.translations?.[window.localDb?.settings?.lang || 'tr'] || window.translations?.tr || {};
  const entry = ttsStatusCache ? (ttsStatusCache.voices || []).find(v => v.id === voiceId) : null;
  if (!entry) return;
  const installed = new Set((ttsStatusCache && ttsStatusCache.installedVoices) || []);

  if (installed.has(voiceId)) {
    if (localDb.settings) localDb.settings.ttsVoiceId = voiceId;
    triggerAutoSave(true);
    updateTtsVoiceDownloadButton();
    if (typeof window.invalidateTtsAvailability === 'function') window.invalidateTtsAvailability();
    return;
  }

  const msg = (t.tts_voice_install_confirm || 'Bu ses paketi (~{size} MB) şimdi indirilsin mi?').replace('{size}', String(entry.sizeMB));
  if (!window.confirm(msg)) {
    checkTtsStatusInUI();
    return;
  }

  const statusText = document.getElementById('tts-status-text');
  const voiceSel = document.getElementById('settings-tts-voice-select');
  if (voiceSel) voiceSel.disabled = true;
  if (statusText) statusText.innerHTML = '<span style="color: #60a5fa;">⏳ Ses indiriliyor, lütfen bekleyin...</span>';

  try {
    const res = await fetch('/api/tts/voice/download', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ voiceId })
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Bilinmeyen hata');
    if (localDb.settings) localDb.settings.ttsVoiceId = voiceId;
    triggerAutoSave(true);
    if (typeof window.showToast === 'function') window.showToast(t.tts_voice_done || 'Ses paketi kuruldu!', 'success');
  } catch (err) {
    if (typeof window.showToast === 'function') window.showToast('Ses indirilemedi: ' + err.message, 'error');
  } finally {
    if (voiceSel) voiceSel.disabled = false;
    await checkTtsStatusInUI();
    if (typeof window.invalidateTtsAvailability === 'function') window.invalidateTtsAvailability();
  }
}
window.onTtsVoiceSelectChange = onTtsVoiceSelectChange;

/**
 * Piper ses motorunu (~23 MB) indirip kurar.
 */
export async function downloadPiperEngine() {
  const t = window.translations?.[window.localDb?.settings?.lang || 'tr'] || window.translations?.tr || {};
  const engineBtn = document.getElementById('btn-download-piper-engine');
  const btnText = document.getElementById('piper-download-btn-text');
  const statusText = document.getElementById('tts-status-text');
  if (engineBtn) engineBtn.disabled = true;
  if (btnText) btnText.textContent = '⏳ İndiriliyor (~23 MB)...';
  if (statusText) statusText.innerHTML = '<span style="color: #60a5fa;">Ses motoru indiriliyor ve kuruluyor...</span>';

  try {
    const res = await fetch('/api/tts/engine/download', { method: 'POST' });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Bilinmeyen hata');
    if (typeof window.showToast === 'function') window.showToast(data.message || 'Piper ses motoru kuruldu!', 'success');
  } catch (err) {
    if (typeof window.showToast === 'function') window.showToast('Motor indirilemedi: ' + err.message, 'error');
    if (engineBtn) engineBtn.disabled = false;
    if (btnText) btnText.textContent = '🔄 Tekrar Dene';
  } finally {
    await checkTtsStatusInUI();
    if (typeof window.invalidateTtsAvailability === 'function') window.invalidateTtsAvailability();
  }
}
window.downloadPiperEngine = downloadPiperEngine;

/**
 * Kullanıcının seçtiği bildirim sesini anında test eder.
 * @param {'download'|'merge'} type
 */
export async function testSoundOption(type = 'download') {
  const sel = document.getElementById('settings-sound-download');
  const soundName = sel ? sel.value : 'chime';

  if (soundName === 'silent') {
    if (typeof window.showToast === 'function') {
      const isEn = window.localDb?.settings?.lang === 'en';
      window.showToast(isEn ? 'Sound is set to Silent.' : 'Bu bildirim sessiz olarak ayarlandı.', 'info');
    }
    return;
  }

  // Seçilen sesin veritabanına da anında yansımasını sağla
  if (localDb.settings) localDb.settings.soundDownloadComplete = soundName;
  triggerAutoSave(true);

  // Doğrudan HTML5 Audio üzerinden tek bir kez çal (sunucuyla çift çalma yapma)
  try {
    const audio = new Audio(`/sounds/${soundName}.wav`);
    audio.play().catch(() => {
      // Tarayıcı autoplay engellerse arka uçtan çaldır
      fetch('/api/settings/test-sound', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sound: soundName })
      }).catch(() => {});
    });
  } catch (_) {}
}
window.testSoundOption = testSoundOption;

/**
 * Windows masaüstü bildirimini test eder.
 */
export async function testDesktopNotification() {
  const isEn = window.localDb?.settings?.lang === 'en';
  if (typeof window.showToast === 'function') {
    window.showToast(isEn ? 'Sending test notification...' : 'Masaüstü bildirim testi gönderiliyor...', 'info');
  }

  try {
    const res = await fetch('/api/settings/test-notification', { method: 'POST' });
    const data = await res.json();
    if (data.ok) {
      if (typeof window.showToast === 'function') {
        window.showToast(isEn ? 'Test notification sent!' : 'Test bildirimi başarıyla gönderildi!', 'success');
      }
    } else {
      if (typeof window.showToast === 'function') {
        window.showToast(data.message || 'Bildirim gönderilemedi.', 'warning');
      }
    }
  } catch (err) {
    if (typeof window.showToast === 'function') {
      window.showToast('Bağlantı hatası: ' + err.message, 'error');
    }
  }
}
window.testDesktopNotification = testDesktopNotification;

/**
 * Windows haytool:// URI protokol durumunu denetler ve arayüzdeki butonları günceller.
 */
export async function checkProtocolStatus() {
  try {
    const res = await fetch('/api/settings/protocol-status');
    const data = await res.json();
    const btnReg = document.getElementById('btn-protocol-register');
    const btnRegText = document.getElementById('btn-protocol-register-text');
    const btnUnreg = document.getElementById('btn-protocol-unregister');
    const card = document.getElementById('protocol-integration-card');
    const isEn = window.localDb?.settings?.lang === 'en';

    if (!data.supported) {
      if (card) card.style.display = 'none';
      return;
    }

    if (data.registered) {
      if (btnUnreg) btnUnreg.style.display = 'inline-flex';
      if (btnReg) {
        if (!data.matchesCurrentPath) {
          if (btnRegText) btnRegText.textContent = isEn ? 'Update App Location' : 'Konumu Güncelle';
          btnReg.className = 'btn btn-sm btn-warning';
        } else {
          if (btnRegText) btnRegText.textContent = isEn ? 'Active (Re-register)' : 'Aktif (Yeniden Kaydet)';
          btnReg.className = 'btn btn-sm btn-secondary';
        }
      }
    } else {
      if (btnUnreg) btnUnreg.style.display = 'none';
      if (btnReg) {
        if (btnRegText) btnRegText.textContent = isEn ? 'Enable Feature' : 'Özelliği Etkinleştir';
        btnReg.className = 'btn btn-sm btn-primary';
      }
    }
  } catch (_) {}
}
window.checkProtocolStatus = checkProtocolStatus;

/**
 * haytool:// protokolünü açık onayla kaydeder/günceller.
 */
export async function handleProtocolRegister() {
  const isEn = window.localDb?.settings?.lang === 'en';
  try {
    const res = await fetch('/api/settings/register-protocol', { method: 'POST' });
    const data = await res.json();
    if (data.ok) {
      if (typeof window.showToast === 'function') {
        window.showToast(isEn ? 'Notification click-to-play enabled!' : 'Bildirime tıklayarak oynatma özelliği etkinleştirildi!', 'success');
      }
      checkProtocolStatus();
    } else {
      if (typeof window.showToast === 'function') {
        window.showToast(data.error || 'İşlem başarısız oldu.', 'error');
      }
    }
  } catch (err) {
    if (typeof window.showToast === 'function') window.showToast(err.message, 'error');
  }
}
window.handleProtocolRegister = handleProtocolRegister;

/**
 * haytool:// protokol kaydını sistemden kaldırır.
 */
export async function handleProtocolUnregister() {
  const isEn = window.localDb?.settings?.lang === 'en';
  try {
    const res = await fetch('/api/settings/unregister-protocol', { method: 'POST' });
    const data = await res.json();
    if (data.ok) {
      if (typeof window.showToast === 'function') {
        window.showToast(isEn ? 'Feature removed from registry.' : 'Özellik sistemden tamamen kaldırıldı.', 'info');
      }
      checkProtocolStatus();
    }
  } catch (err) {
    if (typeof window.showToast === 'function') window.showToast(err.message, 'error');
  }
}
window.handleProtocolUnregister = handleProtocolUnregister;

/**
 * Windows PATH entegrasyon durumunu denetler ve Bildirim & Entegrasyon sekmesindeki kartı senkronize eder.
 */
export async function checkCliPathStatus() {
  try {
    const res = await fetch('/api/settings/cli-path-status');
    const data = await res.json();
    const isEn = window.localDb?.settings?.lang === 'en';
    const card = document.getElementById('cli-path-integration-card');
    const badge = document.getElementById('badge-cli-path-status');
    const badgeText = document.getElementById('text-cli-path-status');
    const btnEnable = document.getElementById('btn-cli-path-enable');
    const btnDisable = document.getElementById('btn-cli-path-disable');

    if (!data.supported) {
      if (card) card.style.display = 'none';
      return;
    }

    if (data.inPath) {
      if (badge) badge.className = 'cli-path-status-badge active';
      if (badgeText) badgeText.textContent = isEn ? 'PATH: Active' : 'PATH: Aktif';
      if (btnEnable) btnEnable.style.display = 'none';
      if (btnDisable) btnDisable.style.display = 'inline-flex';
    } else {
      if (badge) badge.className = 'cli-path-status-badge inactive';
      if (badgeText) badgeText.textContent = isEn ? 'PATH: Inactive' : 'PATH: Pasif';
      if (btnEnable) btnEnable.style.display = 'inline-flex';
      if (btnDisable) btnDisable.style.display = 'none';
    }
  } catch (_) {}
}
window.checkCliPathStatus = checkCliPathStatus;

export function isDesktopApp() {
  return !!(window.__IS_HAYTOOL_DESKTOP__ || (typeof window.chrome !== 'undefined' && typeof window.chrome.webview !== 'undefined'));
}
window.isDesktopApp = isDesktopApp;

/**
 * Özel pencere başlığı modunu uygular.
 * @param {boolean} enabled 
 */
export function applyCustomTitlebarMode(enabled) {
  const isDesktop = isDesktopApp();
  const shouldActivate = !!(enabled && isDesktop);

  const winControls = document.getElementById('window-controls');
  if (winControls) {
    winControls.style.display = shouldActivate ? 'inline-flex' : 'none';
  }
  document.body.classList.toggle('custom-titlebar-active', shouldActivate);

  if (isDesktop) {
    try {
      if (window.chrome?.webview?.hostObjects?.playerBridge?.setCustomTitlebar) {
        window.chrome.webview.hostObjects.playerBridge.setCustomTitlebar(!!enabled);
      }
    } catch (e) {
      console.warn('[CustomTitlebar] Bridge call failed:', e);
    }
  }
}
window.applyCustomTitlebarMode = applyCustomTitlebarMode;

/**
 * Pencere kontrolleri ve başlık çubuğu dinleyicilerini başlatır.
 */
export function initCustomTitlebar() {
  const isDesktop = isDesktopApp();
  const customTitlebarEnabled = !!(window.localDb?.settings?.customTitlebar);
  const chk = document.getElementById('settings-custom-titlebar');
  const row = chk ? chk.closest('.settings-row, .setting-item') : null;

  if (!isDesktop) {
    if (chk) chk.disabled = true;
    if (row) {
      const desc = row.querySelector('.setting-description');
      if (desc && !desc.dataset.desktopOnly) {
        desc.dataset.desktopOnly = 'true';
        desc.textContent += ' (Yalnızca Masaüstü Uygulamasında Etkindir)';
      }
    }
    applyCustomTitlebarMode(false);
    return;
  }

  if (chk) {
    chk.checked = customTitlebarEnabled;
    if (!chk.dataset.titlebarBound) {
      chk.dataset.titlebarBound = 'true';
      chk.addEventListener('change', () => {
        applyCustomTitlebarMode(chk.checked);
        triggerAutoSave(true);
      });
    }
  }
  applyCustomTitlebarMode(customTitlebarEnabled);

  // Mevcut pencere durumunu (büyütülmüş / pencere modu) kontrol et ve uygula
  if (window.chrome?.webview?.hostObjects?.playerBridge?.isWindowMaximized) {
    try {
      const isMax = window.chrome.webview.hostObjects.playerBridge.isWindowMaximized();
      if (typeof window.onWindowStateChanged === 'function') {
        window.onWindowStateChanged(isMax);
      }
    } catch (_) {}
  }

  // Topbar sürükleme ve çift tıklama ile büyütme dinleyicisi
  const topbar = document.getElementById('topbar') || document.querySelector('.topbar');
  if (topbar && !topbar.dataset.dragInit) {
    topbar.dataset.dragInit = 'true';

    let lastTitleClickTime = 0;
    let lastTitleClickPos = { x: 0, y: 0 };

    topbar.addEventListener('mousedown', (e) => {
      // Etkileşimli öğelere tıklanmışsa pencere sürüklemesi tetikleme
      if (e.target.closest('button, a, input, select, .status-badge, .nav-item, .window-controls, .theme-toggle-btn, .weather-popover, .disk-popover, .nav-dropdown-menu')) {
        return;
      }
      if (e.button !== 0 || !document.body.classList.contains('custom-titlebar-active')) {
        return;
      }

      const now = Date.now();
      const timeDiff = now - lastTitleClickTime;
      const dist = Math.hypot(e.clientX - lastTitleClickPos.x, e.clientY - lastTitleClickPos.y);

      // Çift tıklama algılama: 350 ms içinde ve 12px mesafe içinde veya e.detail === 2
      if ((timeDiff < 350 && dist < 12) || e.detail === 2) {
        lastTitleClickTime = 0;
        try {
          window.chrome?.webview?.hostObjects?.playerBridge?.toggleMaximizeWindow();
        } catch (_) {}
        return;
      }

      lastTitleClickTime = now;
      lastTitleClickPos = { x: e.clientX, y: e.clientY };

      try {
        window.chrome?.webview?.hostObjects?.playerBridge?.dragWindow();
      } catch (_) {}
    });

    topbar.addEventListener('dblclick', (e) => {
      if (e.target.closest('button, a, input, select, .status-badge, .nav-item, .window-controls, .theme-toggle-btn, .weather-popover, .disk-popover, .nav-dropdown-menu')) {
        return;
      }
      if (document.body.classList.contains('custom-titlebar-active')) {
        try {
          window.chrome?.webview?.hostObjects?.playerBridge?.toggleMaximizeWindow();
        } catch (_) {}
      }
    });
  }
}
window.initCustomTitlebar = initCustomTitlebar;

window.windowControlAction = function(action) {
  try {
    const bridge = window.chrome?.webview?.hostObjects?.playerBridge;
    if (!bridge) return;
    if (action === 'minimize') {
      bridge.minimizeWindow();
    } else if (action === 'maximize') {
      bridge.toggleMaximizeWindow();
    } else if (action === 'close') {
      bridge.closeWindow();
    }
  } catch (err) {
    console.error('[WindowControls] Error:', err);
  }
};

window.onWindowStateChanged = function(isMaximized) {
  const maxIcon = document.getElementById('win-icon-max');
  const restoreIcon = document.getElementById('win-icon-restore');
  const maxBtn = document.getElementById('win-btn-max');
  if (maxIcon && restoreIcon) {
    if (isMaximized) {
      maxIcon.style.display = 'none';
      restoreIcon.style.display = 'inline-block';
      if (maxBtn) maxBtn.title = (window.localDb?.settings?.lang === 'en') ? 'Restore' : 'Aşağı Getir';
    } else {
      maxIcon.style.display = 'inline-block';
      restoreIcon.style.display = 'none';
      if (maxBtn) maxBtn.title = (window.localDb?.settings?.lang === 'en') ? 'Maximize' : 'Ekranı Kapla';
    }
  }

  // Pencere modunda (ekranı kaplamamışken) sekmelerin otomatik ikon moduna geçmesi için sınıf
  document.body.classList.toggle('window-mode-restored', !isMaximized);
  document.body.classList.toggle('window-mode-maximized', !!isMaximized);
};
