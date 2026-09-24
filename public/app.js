/**
 * HaYTooL YouTube Downloader - İstemci Mantığı (Frontend)
 * 
 * Yapımcı: HaYTo
 * İletişim: korazhayto@gmail.com
 */

import { translations } from './utils/i18n.js';
import { escapeHtml, formatDate, getDaysAgoText, parseSizeToBytes, isShortVideo, parseTimeToSeconds, formatDescriptionTimestamps, parseLikes, parseRelativeTime, debounce, isMembersOnlyVideo, getCatTranslatedName } from './utils/helpers.js';
import { showToast, toastSuccess, toastError, toastWarning, toastInfo } from './components/toast.js';
import { renderVideoGrid } from './components/videoCard.js';
import { renderChannelsList, getChannelsRenderSignature } from './components/channelRow.js';
// Araçlar ve dosya karşılaştırma alt modülü
import './modules/tools.js';
// Ayarlar, yedekleme ve Gist senkronizasyon alt modülü
import { populateGistFields, checkYouTubeAuthStatus, openTempFolder } from './modules/settings.js';
window.openTempFolder = openTempFolder;
// Dinamik dil ve arayüz çevirisi alt modülü
import { applyLanguage } from './modules/i18n-apply.js';
window.applyLanguage = applyLanguage;
// Hava durumu alt modülü
import { updateWeatherBadge, initWeatherPopoverEvents } from './modules/weather.js';
window.updateWeatherBadge = updateWeatherBadge;
window.initWeatherPopoverEvents = initWeatherPopoverEvents;
// FFmpeg yönetim alt modülü
import { checkFfmpegStatus, openFfmpegModal, closeFfmpegModal, updateFfmpegInstallUI, startFfmpegDownload, initFfmpegEvents } from './modules/ffmpeg.js';
// Sistem ve disk durumu alt modülü
import { updateDiskSpace, triggerManualDiskSync, initSystemStatusEvents } from './modules/systemStatus.js';
window.updateDiskSpace = updateDiskSpace;
window.triggerManualDiskSync = triggerManualDiskSync;
// Aktif DNS tespit aracı alt modülü
import { detectActiveDns, openDnsLookupModal, closeDnsLookupModal, copyDnsInfo, initDnsLookupEvents } from './modules/dnsLookup.js';
window.detectActiveDns = detectActiveDns;
window.openDnsLookupModal = openDnsLookupModal;
window.closeDnsLookupModal = closeDnsLookupModal;
window.copyDnsInfo = copyDnsInfo;
// Özel dropdown ve bayrak seçici alt modülü
import { initCustomSelect, setCustomSelectValue } from './modules/uiDropdowns.js';
window.initCustomSelect = initCustomSelect;
window.setCustomSelectValue = setCustomSelectValue;
// Toplu işlem ve modallar alt modülü (Bulk Hide / Bulk Delete)
import './modules/bulkOperations.js';
// İndirme kuyruğu ve sıralama yönetimi alt modülü
import {
  setQueueViewMode,
  moveQueueItem,
  updateQueueOrderDOM,
  handleDragStart,
  handleDragOver,
  handleDrop,
  handleDragEnd,
  cancelDownload,
  cancelAllDownloads,
  cancelQueuedVideo,
  cancelAllQueued,
  pasteAndDownload,
  toggleQueuePause,
  toggleAlternativeSpeed,
  updateQueueSpeedLimit,
  retryFailedVideo,
  retryAllFailedVideos,
  clearFailedVideo,
  clearAllFailedVideos
} from './modules/queue.js';
window.setQueueViewMode = setQueueViewMode;
window.moveQueueItem = moveQueueItem;
window.updateQueueOrderDOM = updateQueueOrderDOM;
window.handleDragStart = handleDragStart;
window.handleDragOver = handleDragOver;
window.handleDrop = handleDrop;
window.handleDragEnd = handleDragEnd;
window.cancelDownload = cancelDownload;
window.cancelAllDownloads = cancelAllDownloads;
window.cancelQueuedVideo = cancelQueuedVideo;
window.cancelAllQueued = cancelAllQueued;
window.pasteAndDownload = pasteAndDownload;
window.toggleQueuePause = toggleQueuePause;
window.toggleAlternativeSpeed = toggleAlternativeSpeed;
window.updateQueueSpeedLimit = updateQueueSpeedLimit;
window.retryFailedVideo = retryFailedVideo;
window.retryAllFailedVideos = retryAllFailedVideos;
window.clearFailedVideo = clearFailedVideo;
window.clearAllFailedVideos = clearAllFailedVideos;
// SponsorBlock oynatıcı alt modülü
import {
  drawSponsorSegmentsOnTimeline,
  fetchSponsorSegments,
  updateSponsorBlockStatusUI,
  updateSBToggleButtonUI,
  checkAndSkipSponsor,
  getSponsorSegments,
  clearSponsorSegments
} from './modules/player/sponsorBlock.js';
window.drawSponsorSegmentsOnTimeline = drawSponsorSegmentsOnTimeline;
window.fetchSponsorSegments = fetchSponsorSegments;
window.updateSponsorBlockStatusUI = updateSponsorBlockStatusUI;
window.updateSBToggleButtonUI = updateSBToggleButtonUI;
window.checkAndSkipSponsor = checkAndSkipSponsor;
window.getSponsorSegments = getSponsorSegments;
window.clearSponsorSegments = clearSponsorSegments;
// Altyazı ve çeviri modülü
import {
  applySubtitlesToPlayer,
  fetchVideoSubtitles,
  openSubtitleTranslateModal,
  initSubtitleStyleControls,
  getCurrentSubtitles,
  setCurrentSubtitles
} from './modules/player/subtitles.js';
window.applySubtitlesToPlayer = applySubtitlesToPlayer;
window.fetchVideoSubtitles = fetchVideoSubtitles;
window.openSubtitleTranslateModal = openSubtitleTranslateModal;
window.initSubtitleStyleControls = initSubtitleStyleControls;
window.getCurrentSubtitles = getCurrentSubtitles;
window.setCurrentSubtitles = setCurrentSubtitles;
// IPTV oynatıcı ve çoklu ekran modülü
import {
  initIptv,
  loadIptvChannels,
  checkIptvStatus,
  restoreIptvState,
  stopAllIptvPlayers,
  stopAllIptvPlayersAndClear,
  clearIptvChannelList,
  getIptvPlayers,
  selectIptvSlot,
  toggleIptvMute,
  clearIptvSlot,
  playIptvChannel,
  resetIptvSlotStyles,
  saveIptvState,
  swapIptvSportModePlayers,
  updateIptvSwapBtnVisibility,
  initIptvSportModeDragAndResize,
  updateLoadMoreBtn,
  renderIptvChannels
} from './modules/iptv.js';
// Kanal yönetimi, arama ve kategori filtreleri alt modülü
import {
  triggerChannelSearch,
  closeChannelSearchResults,
  followChannelFromSearch,
  deleteChannel,
  updateChannelAvatar,
  updateChannelInfo,
  updateAllChannelInfo,
  syncSingleChannelRss,
  changeChannelQuality,
  changeChannelShorts,
  changeChannelAutoDownload,
  changeChannelShortsLimit,
  updateChannelCategoryFilterOptions,
  handleChannelFilterChange,
  initAddChannelForm
} from './modules/channels.js';
window.triggerChannelSearch = triggerChannelSearch;
window.closeChannelSearchResults = closeChannelSearchResults;
window.followChannelFromSearch = followChannelFromSearch;
window.deleteChannel = deleteChannel;
window.updateChannelAvatar = updateChannelAvatar;
window.updateChannelInfo = updateChannelInfo;
window.updateChannelSubscribers = updateChannelInfo;
window.updateAllChannelInfo = updateAllChannelInfo;
window.updateAllChannelAvatars = updateAllChannelInfo;
window.updateAllChannelSubscribers = updateAllChannelInfo;
window.syncSingleChannelRss = syncSingleChannelRss;
window.changeChannelQuality = changeChannelQuality;
window.changeChannelShorts = changeChannelShorts;
window.changeChannelAutoDownload = changeChannelAutoDownload;
window.changeChannelShortsLimit = changeChannelShortsLimit;
window.updateChannelCategoryFilterOptions = updateChannelCategoryFilterOptions;
window.handleChannelFilterChange = handleChannelFilterChange;
window.initAddChannelForm = initAddChannelForm;
// Sistem konsolu ve canlı terminal logları alt modülü
import {
  openConsoleModal,
  closeConsoleModal,
  clearConsoleModal,
  appendLogToConsoleModal,
  initTerminalEvents
} from './modules/terminal.js';
window.openConsoleModal = openConsoleModal;
window.closeConsoleModal = closeConsoleModal;
window.clearConsoleModal = clearConsoleModal;
window.appendLogToConsoleModal = appendLogToConsoleModal;
window.initTerminalEvents = initTerminalEvents;
// Güncelleme kontrolü ve sürüm yönetimi alt modülü
import { loadAppVersion, checkApplicationUpdates, showUpdateNotification } from './modules/updater.js';
// Sistem yedek yöneticisi alt modülü
import { createSystemBackup, loadSystemBackupsList, downloadSystemBackup, deleteSystemBackup, triggerUploadBackupFile, uploadBackupFile, restoreSystemBackup } from './modules/backupManager.js';
// yt-dlp motor sürüm yöneticisi alt modülü
import { fetchYtdlpVersion, updateYtdlp } from './modules/ytdlpManager.js';
// İndirici arayüzü alt modülü (tekil/playlist indirme, eksik video kuyruğa ekleme)
import { handleDownloaderStart, handleDownloaderAll, renderPlaylistResults, downloadMissingVideo } from './modules/downloaderUI.js';
// Video yorumları ve sayfalama alt modülü
import { loadComments, loadMoreComments, renderCommentsList, toggleCommentsPanel } from './modules/comments.js';

// Geliştirici log kontrolü. Localhost haricinde tarayıcı konsol çıktısını devre dışı bırakır.
const isDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
function devLog(...args) {
  if (isDev) console.log('[DEV]', ...args);
}
function devWarn(...args) {
  if (isDev) console.warn('[DEV_WARN]', ...args);
}


// Expose to window for inline event handlers and global state
window.escapeHtml = escapeHtml;
window.formatDate = formatDate;
window.getDaysAgoText = getDaysAgoText;
window.isShortVideo = isShortVideo;
window.showToast = showToast;
window.translations = translations;
window.renderVideoGrid = renderVideoGrid;
window.renderChannelsList = renderChannelsList;
window.getChannelsRenderSignature = getChannelsRenderSignature;
window.debounce = debounce;
window.devLog = devLog;
window.devWarn = devWarn;

/**
 * İndirme motorunu ve askıdaki tüm süreç kilitlerini manuel olarak sıfırlar (Restart ihtiyacını kaldırır).
 */
window.resetDownloadEngine = async function() {
  const currentLang = localStorage.getItem('haytool_user_lang') || 'tr';
  const t = translations[currentLang] || translations.tr;
  const msg = t.reset_engine_confirm || 'İndirme motoru ve askıdaki süreç kilitleri sıfırlanacak. Devam etmek istiyor musunuz?';
  if (!confirm(msg)) return;

  try {
    const res = await fetch('/api/queue/reset-engine', { method: 'POST' });
    const data = await res.json();
    if (data.success) {
      showToast(t.reset_engine_success || 'İndirme motoru başarıyla sıfırlandı.', 'success');
    } else {
      showToast(data.error || 'Sıfırlama sırasında bir hata oluştu.', 'error');
    }
  } catch (err) {
    showToast(`Hata: ${err.message}`, 'error');
  }
};
let localDb = { channels: [], history: [], settings: {} };
window.localDb = localDb;
let currentPlayingVideoId = null;
window.currentPlayingVideoId = null;
let eventSource = null;
let currentLang = 'tr';

// IPTV modülünü başlat ve durum köprüsünü kur
initIptv(() => ({ localDb, currentLang }));

window.isDownloadedBulkDeleteMode = false;
window.isHistoryBulkHideMode = false;
window.historyFilterChannel = 'all';
window.downloadedFilterChannel = 'all';
window.historyFilterDays = 'all';
window.historyOnlyNoAutoDownload = false;
window.historyOnlyNotDownloaded = false;
window.historyOnlyLiveProcessing = false;
window.historyShowMembers = true;
window.historyShowHidden = false;
window.historyViewMode = 'grid';
window.downloadedViewMode = 'grid';



function switchTab(targetTab, triggerPushState = true) {
  window.switchTab = switchTab;
  
  // Gecersiz veya bos tab kontrolu (pd-btn gibi data-tab olmayan nav-itemlar)
  const map = typeof tabPathMap !== 'undefined' ? tabPathMap : {};
  if (!targetTab || !map[targetTab]) {
    if (targetTab) console.warn('[switchTab] Bilinmeyen tab:', targetTab);
    return;
  }

  try {
  const activeTab = document.querySelector('.nav-item.active')?.getAttribute('data-tab') || 'history';
  
  // İndirilenler sekmesinden çıkış yapılıyorsa ve video oynatılıyorsa mini oynatıcıya KESİNTİSİZ (0ms) geç
  if (activeTab === 'downloaded' && targetTab !== 'downloaded') {
    const inlineContainer = document.getElementById('downloaded-inline-player-container');
    const isInlineOpen = inlineContainer && !inlineContainer.classList.contains('hidden');
    if (isInlineOpen && currentPlayingVideoId) {
      const didSwitch = window.switchInlinePlayerToModal();
      if (didSwitch) {
        performTabSwitchUI(targetTab);
        if (triggerPushState) {
          const targetPath = tabPathMap[targetTab];
          if (targetPath && window.location.pathname !== targetPath) {
            history.pushState({ tab: targetTab }, '', targetPath);
          }
        }
        return;
      }
    }
  }
  
  // Başka sekmeden İndirilenler sekmesine geçiş yapılıyorsa ve modal oynatıcı açıksa
  if (targetTab === 'downloaded') {
    const modal = document.getElementById('player-modal');
    const isModalOpen = modal && !modal.classList.contains('hidden');
    if (isModalOpen && currentPlayingVideoId) {
      const video = (localDb.history || []).find(h => h.id === currentPlayingVideoId);
      const isCompleted = video && video.status === 'completed';
      const isMissing = video && video.fileMissing === true;
      const isDownloaded = isCompleted && !isMissing;
      
      if (isDownloaded) {
        const inlineContainer = document.getElementById('downloaded-inline-player-container');
        const inlineBody = document.getElementById('inline-player-body');
        const modalBody = modal.querySelector('.player-modal-body');

        if (inlineContainer && inlineBody && modalBody && modalBody.firstElementChild) {
          // Canlı DOM elementini yerleşik gövdeye geri taşı
          while (modalBody.firstChild) {
            inlineBody.appendChild(modalBody.firstChild);
          }

          modal.classList.add('hidden');
          inlineContainer.classList.remove('hidden');
          const listContainer = document.getElementById('downloaded-list-container');
          if (listContainer) listContainer.classList.add('hidden');

          performTabSwitchUI(targetTab);

          if (videoPlayerInstance && typeof videoPlayerInstance.resize === 'function') {
            setTimeout(() => videoPlayerInstance.resize(), 50);
          }

          if (triggerPushState) {
            const targetPath = tabPathMap[targetTab];
            if (targetPath && window.location.pathname !== targetPath) {
              history.pushState({ tab: targetTab }, '', targetPath);
            }
          }
          return;
        }
      }
    }
  }

  // Normal sekme geçişi
  if (targetTab !== 'downloaded') {
    if (window.closeInlinePlayer) window.closeInlinePlayer();
  }
  
  if (targetTab === 'iptv') {
    // IPTV sekmesine gecince her turlu video player'i tamamen kapat (mini-player'a gitmeden)
    const modal = document.getElementById('player-modal');
    if (modal && !modal.classList.contains('hidden')) {
      if (window.closePlayerModal) window.closePlayerModal();
    }
    if (window.closeInlinePlayer) window.closeInlinePlayer();
    // IPTV kanallarini yukle ve durum kontrolunu baslat
    if (typeof loadIptvChannels === 'function') loadIptvChannels();
    if (typeof checkIptvStatus === 'function') checkIptvStatus();
    // IPTV kayitli sekmeleri ve yerlesimi yukle
    if (typeof restoreIptvState === 'function') restoreIptvState();
  } else {
    // IPTV sekmesinden cikinca: tum IPTV playerlar + arkaplan interval temizle
    if (window.stopAllIptvPlayersAndClear) {
      window.stopAllIptvPlayersAndClear();
    } else {
      if (window.stopAllIptvPlayers) window.stopAllIptvPlayers();
      if (window.clearIptvChannelList) window.clearIptvChannelList();
    }
  }

  performTabSwitchUI(targetTab);

  if (targetTab === 'tools') {
    if (typeof loadCategoriesToTools === 'function') loadCategoriesToTools(localDb.categories);
    if (typeof showToolsSubSection === 'function') {
      showToolsSubSection(window.currentToolsSubSection || 'compare');
    }
  }

  if (triggerPushState) {
    const targetPath = tabPathMap[targetTab];
    if (targetPath && window.location.pathname !== targetPath) {
      history.pushState({ tab: targetTab }, '', targetPath);
    }
  }
  } catch (err) {
    console.error('[switchTab] Hata olustu, tab:', targetTab, err);
    // Hata olsa bile UI'yi guncelle
    try { performTabSwitchUI(targetTab); } catch(e2) { console.error('[switchTab] performTabSwitchUI hatasi:', e2); }
  }
}

// Sekme Degistirme - switchTab fonksiyonu tanimli, navItems henuz tanimsiz
// Bu yuzden forEach'i navItems tanimlandiktan sonra cagiriyoruz (asagida)

// DOM Elemanlari
const statusIndicator = document.getElementById('status-indicator');
const connectionStatus = document.getElementById('connection-status');
const qualityStatus = document.getElementById('quality-status');

const navItems = document.querySelectorAll('.nav-item');
const tabContents = document.querySelectorAll('.tab-content');

// Sekme Degistirme - data-tab olmayan nav-itemleri (pd-btn gibi) atla
// navItems burada tanimlandiktan sonra click handler'lari kayit ediyoruz
document.querySelectorAll('.nav-item[data-tab]').forEach(item => {
  item.addEventListener('click', () => {
    const targetTab = item.getAttribute('data-tab');
    switchTab(targetTab, true);
  });
});

// Dashboard Tab Elemanlari
const noActiveDownload = document.getElementById('no-active-download');
const activeDownloadDetails = document.getElementById('active-download-details');
const activeSpeed = document.getElementById('active-speed');
const activeTitle = document.getElementById('active-title');
const activeChannel = document.getElementById('active-channel');
const activeProgressBar = document.getElementById('active-progress-bar');
const activePercent = document.getElementById('active-percent');
const activeSize = document.getElementById('active-size');
const activeEta = document.getElementById('active-eta');

const statChannelCount = document.getElementById('stat-channel-count');
const statDownloadedCount = document.getElementById('stat-downloaded-count');
const statWaitingCount = document.getElementById('stat-waiting-count');
const queueList = document.getElementById('queue-list');

// Kanallar Tab Elemanları
const addChannelForm = document.getElementById('add-channel-form');
const channelInput = document.getElementById('channel-input');
const channelsList = document.getElementById('channels-list');
const addChannelBtn = document.getElementById('add-channel-btn');

// Geçmiş Tab Elemanları
const historyGrid = document.getElementById('history-grid');
const historyChannelFilter = document.getElementById('history-channel-filter');
const historyDateFilter = document.getElementById('history-date-filter');
const viewGridBtn = document.getElementById('view-grid-btn');
const viewListBtn = document.getElementById('view-list-btn');

let historyViewMode = 'grid'; // grid veya list
let historySortMode = localStorage.getItem('history-sort-val') || 'date-desc'; // date-desc | date-asc | title | duration

// Türkçe Açıklama: Kütüphane sıralama tercihini db.settings + configwin.ini'ye kalıcı kaydeder.
function persistHistorySortMode() {
  if (localDb.settings) {
    localDb.settings.historySortMode = historySortMode;
    fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(localDb.settings)
    }).catch(() => {});
  }
}
let historyFilterChannel = 'all'; // all veya kanalId
let historyFilterDays = 'all'; // all, 0, 1, 2, 3, 4, 5
let historyOnlyNoAutoDownload = false;
let historyOnlyNotDownloaded = false;
let historyShowHidden = false;
let downloadedViewMode = 'grid'; // grid veya list
let downloadedFilterChannel = 'all'; // all veya kanalId
let downloadedOnlyPartiallyWatched = false;
window.downloadedOnlyPartiallyWatched = downloadedOnlyPartiallyWatched;

// İndirilen Videolar Tab Elemanları
const downloadedGrid = document.getElementById('downloaded-grid');
const downloadedChannelFilter = document.getElementById('downloaded-channel-filter');
const downloadedViewGridBtn = document.getElementById('downloaded-view-grid-btn');
const downloadedViewListBtn = document.getElementById('downloaded-view-list-btn');
const downloadedFilterResumeBtn = document.getElementById('downloaded-filter-resume-btn');

// Silme Modalı Elemanları
const deleteModal = document.getElementById('delete-modal');
const closeDeleteModalBtn = document.getElementById('close-delete-modal-btn');
const cancelDeleteBtn = document.getElementById('cancel-delete-btn');
const confirmDeleteBtn = document.getElementById('confirm-delete-btn');
const deleteFileCheckbox = document.getElementById('delete-file-checkbox');
const markWatchedCheckbox = document.getElementById('mark-watched-checkbox');
const hideLibraryCheckbox = document.getElementById('hide-library-checkbox');
const deleteModalMsg = document.getElementById('delete-modal-msg');
let videoIdToDelete = null;

// Ayarlar Tab Elemanları
const settingsForm = document.getElementById('settings-form');
const settingsDownloadPath = document.getElementById('settings-download-path');
const settingsQuality = document.getElementById('settings-quality');
const settingsChannelCheckInterval = document.getElementById('settings-channelcheckinterval');
const settingsAutoDownload = document.getElementById('settings-autodownload');
const settingsShortsDurationLimit = document.getElementById('settings-shortsdurationlimit');

// Diğer Butonlar
const syncNowBtn = document.getElementById('sync-now-btn');
const openFolderBtn = document.getElementById('open-folder-btn');
const selectFolderBtn = document.getElementById('select-folder-btn');
const testFolderBtn = document.getElementById('test-folder-btn');

// Türkçe Açıklama: SPA yönlendirmeleri için sekmeler arası gezinme ve HTML5 History API entegrasyonu.
const tabPathMap = {
  history: '/home',
  queue: '/download',
  downloaded: '/downlist',
  channels: '/channels',
  settings: '/settings',
  iptv: '/iptv',
  tools: '/tools',
  downloader: '/downloader'
};

const pathTabMap = {
  '/home': 'history',
  '/download': 'queue',
  '/downlist': 'downloaded',
  '/channels': 'channels',
  '/settings': 'settings',
  '/iptv': 'iptv',
  '/tools': 'tools',
  '/downloader': 'downloader'
};

// Türkçe Açıklama: Arayüzdeki sekme başlıklarını ve sekme içeriklerini aktif/pasif yapar.
/**
 * Sekme elemanlarının CSS sınıflarını günceller.
 * 
 * @param {string} targetTab Hedef sekme adı
 */
function performTabSwitchUI(targetTab) {
  const toolsDropdown = document.getElementById('tools-dropdown');
  if (toolsDropdown) {
    if (targetTab === 'downloader' || targetTab === 'tools') {
      toolsDropdown.classList.add('active');
    } else {
      toolsDropdown.classList.remove('active');
    }
  }

  document.querySelectorAll('.nav-item').forEach(n => {
    if (n.getAttribute('data-tab') === targetTab) {
      n.classList.add('active');
    } else {
      n.classList.remove('active');
    }
  });

  document.querySelectorAll('.tab-content').forEach(content => {
    if (content.id === `tab-${targetTab}`) {
      content.classList.add('active');
    } else {
      content.classList.remove('active');
    }
  });

  // Sekme değiştirildiğinde ana içerik alanını en yukarı kaydır
  const mainContent = document.querySelector('.main-content');
  if (mainContent) {
    mainContent.scrollTop = 0;
  }
}

// Tarayıcı Geri/İleri Buton Dinleyicisi
window.addEventListener('popstate', (event) => {
  const tabId = (event.state && event.state.tab) || pathTabMap[window.location.pathname] || 'history';
  switchTab(tabId, false);
});

/**
 * Sunucu ile Server-Sent Events (SSE) bağlantısı kurar,
 * canlı indirme ilerlemelerini, veritabanı güncellemelerini ve bildirimleri dinler.
 */
function connectSSE() {
  if (eventSource) {
    eventSource.close();
  }

  eventSource = new EventSource('/api/events');

  eventSource.onopen = () => {
    if (statusIndicator) statusIndicator.className = 'status-dot online';
    if (connectionStatus) {
      connectionStatus.textContent = currentLang === 'en' ? 'Connected' : 'Bağlandı';
      connectionStatus.className = 'value text-muted';
    }
    const statusText = document.getElementById('topbar-status-text');
    const badgeConn = document.getElementById('badge-connection');
    const t = translations[currentLang] || translations.tr;
    if (statusText) statusText.textContent = t.connection_active;
    if (badgeConn) badgeConn.title = t.connection_active;
    updateDiskSpace();
  };

  eventSource.onerror = (err) => {
    if (statusIndicator) statusIndicator.className = 'status-dot offline';
    if (connectionStatus) {
      connectionStatus.textContent = currentLang === 'en' ? 'Connection Lost' : 'Bağlantı Kesildi';
      connectionStatus.className = 'value text-muted';
    }
    const statusText = document.getElementById('topbar-status-text');
    const badgeConn = document.getElementById('badge-connection');
    const t = translations[currentLang] || translations.tr;
    if (statusText) statusText.textContent = t.connection_lost;
    if (badgeConn) badgeConn.title = t.connection_lost;
  };

  // Veritabanı Güncelleme Bildirimi
  eventSource.addEventListener('db_update', (e) => {
    const db = JSON.parse(e.data);
    localDb = db;
    window.localDb = db;
    updateUI(db);
  });

  // Tek Kayıt Güncelleme Bildirimi (hedefli — tüm veritabanı yerine yalnızca değişen kayıt)
  // Performans: RSS taraması gibi yoğun anlarda yüzlerce event gelebilir; render 400ms'de bir toplu yapılır.
  let historyUiUpdateTimer = null;
  eventSource.addEventListener('history_updated', (e) => {
    const data = JSON.parse(e.data);
    const { id, updates } = data || {};
    if (!id || !updates) return;
    if (localDb && Array.isArray(localDb.history)) {
      const item = localDb.history.find(h => h.id === id);
      if (item) Object.assign(item, updates);
    }


    if (historyUiUpdateTimer) clearTimeout(historyUiUpdateTimer);
    historyUiUpdateTimer = setTimeout(() => {
      historyUiUpdateTimer = null;
      updateUI(localDb);
    }, 400);
  });

  // İndirme İlerleme Bildirimi
  eventSource.addEventListener('progress', (e) => {
    const data = JSON.parse(e.data);
    updateActiveDownloadProgress(data);
  });

  // Kanal Tarama İlerleme Bildirimi
  eventSource.addEventListener('channel_scan_progress', (e) => {
    const data = JSON.parse(e.data);
    updateScanProgressToast(data);
  });

  // Sistem Log Bildirimi (Toast ve Masaüstü Bildirimi)
  eventSource.addEventListener('status_log', (e) => {
    const log = JSON.parse(e.data);
    showToast(log.message, log.type, log.thumbnail);

    // Masaüstü Bildirimi (Sadece indirme tamamlanma başarısında ve ayarlarda izin verilmişse)
    if (localDb.settings.showNotifications !== false &&
        log.type === 'success' && 
        'Notification' in window && 
        Notification.permission === 'granted' &&
        !log.message.includes('silindi') &&
        !log.message.includes('temizlendi') &&
        !log.message.includes('deleted') &&
        !log.message.includes('cleared')) {
      const isEn = localDb.settings.lang === 'en';
      new Notification(isEn ? 'HaYTool Download Completed' : 'HaYTool İndirme Tamamlandı', {
        body: log.message,
        icon: '/logo.png'
      });
    }
  });

  // Sunucudan gelen sekme geçiş bildirimini dinler
  eventSource.addEventListener('switch_tab', (e) => {
    try {
      const tabName = JSON.parse(e.data);
      if (window.switchTab) window.switchTab(tabName);
    } catch (err) {
      console.error('Sekme geçiş hatası:', err);
    }
  });

  // FFmpeg İndirme İlerleme Bildirimi
  eventSource.addEventListener('ffmpeg_download', (e) => {
    try {
      const data = JSON.parse(e.data);
      updateFfmpegInstallUI(data);
    } catch (err) {
      console.error('FFmpeg progress parse error:', err);
    }
  });

  // GitHub Güncelleme Durumu Bildirimi
  // GitHub Güncelleme Durumu Bildirimi
  eventSource.addEventListener('update_status', (e) => {
    try {
      const update = JSON.parse(e.data);
      if (update && update.updateAvailable) {
        showUpdateNotification(update);
      }
    } catch (err) {
      console.error('Update status event parse error:', err);
    }
  });

  // Sistem Konsolu Log Akışı
  eventSource.addEventListener('terminal_log', (e) => {
    try {
      const data = JSON.parse(e.data);
      appendLogToConsoleModal(data);
    } catch (err) {}
  });
}


/**
 * Aktif indirme ilerlemesini (yüzde, hız, boyut vb.) canlı olarak arayüzde günceller.
 * 
 * @param {object} data İlerleme veri nesnesi
 */
function updateActiveDownloadProgress(data) {
  noActiveDownload.classList.add('hidden');
  activeDownloadDetails.classList.remove('hidden');

  activeProgressBar.style.width = `${data.progress}%`;
  activePercent.textContent = `${data.progress}%`;
  activeSize.textContent = data.fileSize || '-- MB';
  activeEta.textContent = data.eta || '--:--';
  activeSpeed.textContent = data.speed || '0 KB/s';
}


// === FILTER CHIP HELPERS ===
function toggleFilterChip(checkboxId) {
  const cb = document.getElementById(checkboxId);
  if (!cb) return;
  cb.checked = !cb.checked;
  syncFilterChipUI(checkboxId);
  if (typeof updateHistoryFiltersCount === 'function') updateHistoryFiltersCount();

  const currentDb = window.localDb || (typeof localDb !== 'undefined' ? localDb : {});

  if (checkboxId === 'history-show-shorts') {
    const showShorts = cb.checked;
    if (!currentDb.settings) currentDb.settings = {};
    currentDb.settings.showShorts = showShorts;

    const dlCheckbox = document.getElementById('downloaded-show-shorts');
    if (dlCheckbox) dlCheckbox.checked = showShorts;

    const inlineCheckbox = document.getElementById('inline-playlist-show-shorts');
    if (inlineCheckbox) inlineCheckbox.checked = showShorts;

    const settCheckbox = document.getElementById('settings-showshorts');
    if (settCheckbox) settCheckbox.checked = showShorts;

    if (typeof saveHistoryFilterState === 'function') saveHistoryFilterState();
    if (typeof saveDownloadedFilterState === 'function') saveDownloadedFilterState();

    if (typeof updateUI === 'function') updateUI(currentDb);
    if (typeof currentPlayingVideoId !== 'undefined' && currentPlayingVideoId && typeof renderDownloadedPlaylist === 'function') {
      renderDownloadedPlaylist(currentPlayingVideoId);
    }

    fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...currentDb.settings, showShorts })
    }).then(r => r.json()).then(data => {
      if (data.success) {
        showToast(showShorts ? 'Shorts videoları gösteriliyor.' : 'Shorts videoları gizlendi.', 'success');
      }
    }).catch(() => {});
    return;
  }

  if (checkboxId === 'history-show-live') {
    window.historyShowLive = cb.checked;
    if (!currentDb.settings) currentDb.settings = {};
    currentDb.settings.historyShowLive = cb.checked;
    if (typeof saveHistoryFilterState === 'function') saveHistoryFilterState();
    if (typeof updateUI === 'function') updateUI(currentDb);
    return;
  }

  if (checkboxId === 'history-show-members') {
    window.historyShowMembers = cb.checked;
    if (typeof saveHistoryFilterState === 'function') saveHistoryFilterState();
    if (typeof updateUI === 'function') updateUI(currentDb);
    return;
  }

  if (checkboxId === 'history-only-no-auto-download') {
    window.historyOnlyNoAutoDownload = cb.checked;
    if (typeof saveHistoryFilterState === 'function') saveHistoryFilterState();
    if (typeof updateUI === 'function') updateUI(currentDb);
    return;
  }

  if (checkboxId === 'history-only-not-downloaded') {
    window.historyOnlyNotDownloaded = cb.checked;
    if (typeof saveHistoryFilterState === 'function') saveHistoryFilterState();
    if (typeof updateUI === 'function') updateUI(currentDb);
    return;
  }

  if (checkboxId === 'history-only-live-processing') {
    window.historyOnlyLiveProcessing = cb.checked;
    if (typeof saveHistoryFilterState === 'function') saveHistoryFilterState();
    if (typeof updateUI === 'function') updateUI(currentDb);
    return;
  }

  if (checkboxId === 'history-show-hidden') {
    if (typeof historyShowHidden !== 'undefined') historyShowHidden = cb.checked;
    window.historyShowHidden = cb.checked;
    if (typeof saveHistoryFilterState === 'function') saveHistoryFilterState();
    if (typeof updateUI === 'function') updateUI(currentDb);
    return;
  }

  cb.dispatchEvent(new Event('change'));
}
window.toggleFilterChip = toggleFilterChip;

function syncFilterChipUI(checkboxId) {
  const cb = document.getElementById(checkboxId);
  if (!cb) return;
  const chipMap = {
    'history-show-hidden': 'btn-filter-show-hidden',
    'history-only-not-downloaded': 'btn-filter-not-downloaded',
    'history-only-live-processing': 'btn-filter-live-processing',
    'history-show-members': 'btn-filter-show-members',
    'history-show-shorts': 'btn-filter-show-shorts',
    'history-show-live': 'btn-filter-show-live',
    'history-only-no-auto-download': 'btn-filter-no-auto-download'
  };
  const btnId = chipMap[checkboxId];
  if (btnId) {
    const chipBtn = document.getElementById(btnId);
    if (chipBtn) chipBtn.classList.toggle('active', cb.checked);
  }
}
window.syncFilterChipUI = syncFilterChipUI;

// Türkçe Açıklama: İndirilenler ve Oynatıcı kenar çubuğundaki Shorts gösterimini senkron olarak açar/kapatır ve anında UI'ı günceller.
function toggleDownloadedShowShorts(showShorts) {
  const currentDb = window.localDb || (typeof localDb !== 'undefined' ? localDb : {});
  if (!currentDb.settings) currentDb.settings = {};
  currentDb.settings.showShorts = !!showShorts;

  const dlCheckbox = document.getElementById('downloaded-show-shorts');
  if (dlCheckbox) dlCheckbox.checked = !!showShorts;

  const inlineCheckbox = document.getElementById('inline-playlist-show-shorts');
  if (inlineCheckbox) inlineCheckbox.checked = !!showShorts;

  const histCheckbox = document.getElementById('history-show-shorts');
  if (histCheckbox) {
    histCheckbox.checked = !!showShorts;
    syncFilterChipUI('history-show-shorts');
    if (typeof updateHistoryFiltersCount === 'function') updateHistoryFiltersCount();
  }

  const settCheckbox = document.getElementById('settings-showshorts');
  if (settCheckbox) settCheckbox.checked = !!showShorts;

  if (typeof saveDownloadedFilterState === 'function') saveDownloadedFilterState();
  if (typeof saveHistoryFilterState === 'function') saveHistoryFilterState();

  if (typeof updateUI === 'function') updateUI(currentDb);
  if (typeof currentPlayingVideoId !== 'undefined' && currentPlayingVideoId && typeof renderDownloadedPlaylist === 'function') {
    renderDownloadedPlaylist(currentPlayingVideoId);
  }

  fetch('/api/settings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...currentDb.settings, showShorts: !!showShorts })
  }).then(r => r.json()).then(data => {
    if (data.success) {
      showToast(showShorts ? 'Shorts videoları gösteriliyor.' : 'Shorts videoları gizlendi.', 'success');
    }
  }).catch(() => {});
}
window.toggleDownloadedShowShorts = toggleDownloadedShowShorts;

// === KÜTÜPHANE HIZLI FİLTRELER PANELİ ===
// Türkçe Açıklama: "Filtreler" butonuna tıklanınca kayan paneli açıp kapatır ve viewport'a sabitler.
/**
 * Kütüphane araç çubuğundaki "Filtreler" düğmesinin açılır panelini açar/kapatır.
 * Panel, overflow'lu üst öğelerden (yatay kaydırma) etkilenmemesi için viewport'a sabitlenir.
 * 
 * @param {Event} [event] Tıklama olayı
 */
function toggleHistoryFiltersPanel(event) {
  if (event) {
    event.stopPropagation();
    if (typeof event.preventDefault === 'function') event.preventDefault();
  }
  const panel = document.getElementById('history-filters-panel');
  if (!panel) return;
  const wrap = document.getElementById('history-filters-dropdown-wrap');
  const isOpen = panel.classList.contains('open');
  panel.classList.remove('open');
  if (wrap) {
    const trigger = wrap.querySelector('.history-filters-trigger');
    if (trigger) trigger.classList.remove('open');
  }
  if (!isOpen && wrap) {
    panel.classList.add('open');
    const trigger = wrap.querySelector('.history-filters-trigger');
    if (trigger) {
      trigger.classList.add('open');
      const rect = trigger.getBoundingClientRect();
      panel.style.position = 'fixed';
      panel.style.top = `${Math.max(6, Math.min(rect.bottom + 6, window.innerHeight - 420))}px`;
      panel.style.left = `${Math.max(8, Math.min(rect.left, window.innerWidth - 320))}px`;
      panel.style.maxHeight = `${Math.min(400, window.innerHeight - 60)}px`;
    }
  }
}
window.toggleHistoryFiltersPanel = toggleHistoryFiltersPanel;

// Türkçe Açıklama: Varsayılan durumundan farklı (açık/kapalı) olan hızlı filtre sayısını hesaplayıp rozeti günceller.
/**
 * Varsayılan durumundan sapmış hızlı filtre sayısını hesaplar ve "Filtreler" rozetinde gösterir.
 * Varsayılan durum, HTML'deki `checked` özniteliği (defaultChecked) kabul edilir.
 */
function updateHistoryFiltersCount() {
  const ids = [
    'history-show-shorts',
    'history-show-live',
    'history-only-no-auto-download',
    'history-only-not-downloaded',
    'history-only-live-processing',
    'history-show-members',
    'history-show-hidden'
  ];
  let count = 0;
  ids.forEach(id => {
    const cb = document.getElementById(id);
    if (cb && cb.checked !== cb.defaultChecked) count++;
  });
  const badge = document.getElementById('history-filters-count');
  if (badge) {
    badge.textContent = String(count);
    badge.style.display = count > 0 ? 'inline-flex' : 'none';
  }
}
window.updateHistoryFiltersCount = updateHistoryFiltersCount;

// Türkçe Açıklama: Panel dışına tıklanınca veya Escape basılınca filtre panelini kapatır.
document.addEventListener('click', (e) => {
  if (!e.target.closest('#history-filters-dropdown-wrap')) {
    const panel = document.getElementById('history-filters-panel');
    if (panel) panel.classList.remove('open');
  }
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    const panel = document.getElementById('history-filters-panel');
    if (panel) panel.classList.remove('open');
  }
});

// Türkçe Açıklama: Sunucudan veya SSE bağlantısından gelen güncel veritabanı verilerine göre tüm ekran kartlarını, istatistikleri ve listeleri günceller.
/**
 * Veritabanı nesnesine göre arayüzdeki istatistikleri, video listelerini ve ayar formlarını günceller.
 * 
 * @param {object} db Veritabanı veri nesnesi
 */
window.updateUI = updateUI;
function updateUI(db) {
  if (!db) return;
  localDb = db;
  window.localDb = db;

  if (typeof restoreHistoryFilterState === 'function') restoreHistoryFilterState();
  if (typeof restoreDownloadedFilterState === 'function') restoreDownloadedFilterState();

  if (db.settings && db.settings.subtitleColor) {
    document.documentElement.style.setProperty('--subtitle-color', db.settings.subtitleColor);
  }
  if (db.settings && db.settings.subtitleOpacity !== undefined) {
    document.documentElement.style.setProperty('--subtitle-bg-opacity', db.settings.subtitleOpacity);
  }
  if (db.settings && db.settings.subtitleSize !== undefined) {
    document.documentElement.style.setProperty('--subtitle-font-size', db.settings.subtitleSize);
  }

  // 1. Sistem Durum Detayları
  const lang = db.settings?.lang || currentLang || 'tr';
  const t = translations[lang] || translations.tr;
  
  // YouTube Oturum ve Çerez Rozeti Durumunu Sadece İlk Başlangıçta veya İhtiyaç Anında Güncelle
  if (typeof window.checkYouTubeAuthStatus === 'function' && !window._youtubeAuthChecked) {
    window._youtubeAuthChecked = true;
    window.checkYouTubeAuthStatus();
  }
  
  const qualityNames = {
    best: t.status_best_quality || 'En Yüksek',
    '1080p': '1080p FHD',
    '720p': '720p HD'
  };
  if (qualityStatus && db.settings) {
    qualityStatus.textContent = qualityNames[db.settings.quality] || (t.status_automatic || 'Otomatik');
  }

  // Eşzamanlı İndirme Limiti Dropdown Eşleme
  const concurrentSelect = document.getElementById('queue-concurrent-limit');
  if (concurrentSelect && db.settings && db.settings.maxConcurrentDownloads !== undefined) {
    concurrentSelect.value = db.settings.maxConcurrentDownloads.toString();
  }

  // 2. İstatistik Sayıcılar
  if (statChannelCount && db.channels) statChannelCount.textContent = db.channels.length;
  const channelsTotalCount = document.getElementById('channels-total-count');
  if (channelsTotalCount && db.channels) channelsTotalCount.textContent = `${db.channels.length} Kanal`;
  
  if (db.history) {
    const downloadedVideos = db.history.filter(h => h.status === 'completed');
    if (statDownloadedCount) statDownloadedCount.textContent = downloadedVideos.length;

    const waitingVideos = db.history.filter(h => h.status === 'waiting');
    if (statWaitingCount) statWaitingCount.textContent = waitingVideos.length;

    // 3. Aktif İndirme ve İndirme Sırası
    const activeDownload = db.history.find(h => h.status === 'downloading');
    const activeMerging = db.history.find(h => h.status === 'merging');
    
    if (activeDownload) {
      if (noActiveDownload) noActiveDownload.classList.add('hidden');
      if (activeDownloadDetails) {
        activeDownloadDetails.classList.remove('hidden');
        if (activeTitle) activeTitle.textContent = activeDownload.title;
        if (activeChannel) activeChannel.textContent = activeDownload.channelName;
        if (activeProgressBar) activeProgressBar.style.width = `${activeDownload.progress}%`;
        if (activePercent) activePercent.textContent = `${activeDownload.progress}%`;
        if (activeSize) activeSize.textContent = activeDownload.fileSize || '-- MB';
        if (activeEta) activeEta.textContent = activeDownload.eta || '--:--';
      }
      if (activeSpeed) activeSpeed.textContent = activeDownload.speed || '0 KB/s';
    } else if (activeMerging) {
      if (noActiveDownload) noActiveDownload.classList.add('hidden');
      if (activeDownloadDetails) {
        activeDownloadDetails.classList.remove('hidden');
        if (activeTitle) activeTitle.textContent = activeMerging.title;
        if (activeChannel) activeChannel.textContent = activeMerging.channelName;
        if (activeProgressBar) activeProgressBar.style.width = `100%`;
        if (activePercent) activePercent.textContent = t.status_merging || 'Birleştiriliyor (FFmpeg)...';
        if (activeSize) activeSize.textContent = activeMerging.fileSize || '-- MB';
        if (activeEta) activeEta.textContent = '--:--';
      }
      if (activeSpeed) activeSpeed.textContent = 'FFmpeg...';
    } else {
      if (noActiveDownload) noActiveDownload.classList.remove('hidden');
      if (activeDownloadDetails) activeDownloadDetails.classList.add('hidden');
      if (activeSpeed) activeSpeed.textContent = '0 MB/s';
    }

    // 4. Kuyruk Listesi
    // 4. Kuyruk Listesi
    if (queueList) {
      queueList.innerHTML = '';
      const isEn = db.settings && db.settings.lang === 'en';
      const t = translations[lang] || translations.tr;
      const viewMode = (db.settings && db.settings.queueViewMode) || localStorage.getItem('haytool_queue_view_mode') || 'table';

      // Header butonlarını senkronize et
      const tableBtn = document.getElementById('queue-view-table-btn');
      const cardsBtn = document.getElementById('queue-view-cards-btn');
      if (tableBtn && cardsBtn) {
        tableBtn.classList.toggle('active', viewMode === 'table');
        cardsBtn.classList.toggle('active', viewMode === 'cards');
      }

      const mergingVideos = db.history.filter(h => h.status === 'merging' && h.hidden !== true);
      const downloadingVideos = db.history.filter(h => h.status === 'downloading' && h.hidden !== true);
      const waitingVideos = db.history.filter(h => h.status === 'waiting' && h.hidden !== true);
      const allActiveQueue = [...downloadingVideos, ...waitingVideos];
      
      const totalQueueCount = allActiveQueue.length + mergingVideos.length;
      const navQueueCountBadge = document.getElementById('nav-queue-count-badge');
      if (navQueueCountBadge) {
        navQueueCountBadge.textContent = totalQueueCount;
      }
      
      const statWaitingCount = document.getElementById('stat-waiting-count');
      if (statWaitingCount) {
        statWaitingCount.textContent = totalQueueCount;
      }
      
      if (allActiveQueue.length === 0 && mergingVideos.length === 0) {
        queueList.innerHTML = `
          <div class="text-center text-muted" id="queue-list-empty" style="padding: 30px 0; font-size: 0.85rem;">${isEn ? 'No videos waiting in the queue.' : 'Kuyrukta bekleyen video yok.'}</div>
        `;
      } else {
        // Tablo görünümüyse sütun başlıklarını ekle
        if (viewMode === 'table') {
          const headerEl = document.createElement('div');
          headerEl.className = 'queue-table-header';
          headerEl.innerHTML = `
            <div style="display:flex; align-items:center; gap:4px;"><span>${t.queue_col_order || '#'}</span></div>
            <div>${t.queue_col_cover || 'Kapak'}</div>
            <div>${t.queue_col_title || 'Video Başlığı'}</div>
            <div>${t.queue_col_channel || 'Kanal'}</div>
            <div>${t.queue_col_duration || 'Süre'}</div>
            <div>${t.queue_col_size || 'Boyut'}</div>
            <div style="text-align:right;">${t.queue_col_actions || 'Sıralama & İşlem'}</div>
          `;
          queueList.appendChild(headerEl);
        }

        const combinedList = [...mergingVideos, ...allActiveQueue];
        const totalItems = combinedList.length;

        combinedList.forEach((video, idx) => {
          const isMerging = video.status === 'merging';
          const isDownloading = video.status === 'downloading';
          const orderNoStr = `#${(idx + 1).toString().padStart(2, '0')}`;
          const durationStr = video.duration || '--:--';
          const sizeStr = video.fileSize || '';
          const upDisabled = (idx === 0 || isMerging) ? 'disabled' : '';
          const downDisabled = (idx === totalItems - 1 || isMerging) ? 'disabled' : '';
          const cancelOnClick = isDownloading ? `cancelDownload('${video.id}')` : `cancelQueuedVideo('${video.id}')`;

          const item = document.createElement('div');
          item.setAttribute('data-id', video.id);

          if (viewMode === 'table') {
            item.className = 'queue-table-row';
            if (isMerging) {
              item.className += ' queue-item-merging';
              item.setAttribute('draggable', 'false');
              item.style.borderColor = 'rgba(234, 179, 8, 0.3)';
              item.style.background = 'rgba(234, 179, 8, 0.03)';
            } else {
              item.setAttribute('draggable', 'true');
              if (isDownloading) {
                item.className += ' queue-item-downloading';
                item.style.borderColor = 'rgba(16, 185, 129, 0.3)';
                item.style.background = 'rgba(16, 185, 129, 0.03)';
              }
            }

            item.innerHTML = `
              <div style="display:flex; align-items:center; gap:6px;">
                <div class="queue-item-drag-handle" style="cursor: ${isMerging ? 'not-allowed' : 'grab'}; color: var(--text-muted);" title="${isMerging ? (isEn ? 'Merging process cannot be reordered' : 'Birleştirme işlemi sıralanamaz') : (t.drag_drop_hint || 'Sürükleyin')}">
                  ${isMerging ? '<i data-lucide="loader" class="spin-animation" style="width:14px; height:14px; color: #eab308;"></i>' : '<i data-lucide="grip-vertical" style="width:14px; height:14px;"></i>'}
                </div>
                <span class="queue-order-badge">${orderNoStr}</span>
              </div>
              <div class="queue-thumb-container video-thumbnail-wrapper" data-video-id="${video.id}" onmouseenter="handleThumbMouseEnter(this)" onmouseleave="handleThumbMouseLeave(this)" title="${escapeHtml(video.title)}">
                <img src="https://i.ytimg.com/vi/${video.id}/mqdefault.jpg" class="video-thumbnail queue-item-thumbnail" onerror="this.src='logo.png'">
              </div>
              <div class="queue-item-title" title="${escapeHtml(video.title)}" style="font-weight:600; color:var(--text-main); overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
                ${escapeHtml(video.title)}
              </div>
              <div class="queue-item-channel" style="color:var(--text-muted); font-size:0.75rem; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; display:flex; align-items:center; gap:4px;" title="${escapeHtml(video.channelName || '')}">
                <i data-lucide="tv" style="width:12px; height:12px; flex-shrink:0;"></i>
                <span>${escapeHtml(video.channelName || '')}</span>
              </div>
              <div>
                <span class="queue-meta-pill queue-meta-pill-duration" title="${t.queue_col_duration || 'Süre'}">
                  <i data-lucide="clock" style="width:10px; height:10px;"></i>
                  <span>${durationStr}</span>
                </span>
              </div>
              <div>
                ${sizeStr ? `
                  <span class="queue-meta-pill queue-meta-pill-size" title="${t.queue_col_size || 'Boyut'}">
                    <i data-lucide="hard-drive" style="width:10px; height:10px;"></i>
                    <span>${sizeStr}</span>
                  </span>
                ` : `
                  <span class="queue-meta-pill queue-meta-pill-calc" title="${t.queue_calculating || 'Hesaplanıyor...'}">
                    <i data-lucide="loader" class="spin-animation" style="width:10px; height:10px;"></i>
                    <span>${t.queue_calculating || 'Hesaplanıyor...'}</span>
                  </span>
                `}
              </div>
              <div style="display:flex; align-items:center; justify-content:flex-end; gap:6px;">
                ${!isMerging ? `
                <div class="queue-move-btn-group">
                  <button class="queue-move-btn queue-btn-top ${upDisabled ? 'disabled' : ''}" onclick="moveQueueItem('${video.id}', 'top')" ${upDisabled} title="${t.queue_move_top || 'En Başa Taşı'}">
                    <i data-lucide="chevrons-up" style="width:11px; height:11px;"></i>
                  </button>
                  <button class="queue-move-btn queue-btn-up ${upDisabled ? 'disabled' : ''}" onclick="moveQueueItem('${video.id}', 'up')" ${upDisabled} title="${t.queue_move_up || 'Yukarı Taşı'}">
                    <i data-lucide="chevron-up" style="width:11px; height:11px;"></i>
                  </button>
                  <button class="queue-move-btn queue-btn-down ${downDisabled ? 'disabled' : ''}" onclick="moveQueueItem('${video.id}', 'down')" ${downDisabled} title="${t.queue_move_down || 'Aşağı Taşı'}">
                    <i data-lucide="chevron-down" style="width:11px; height:11px;"></i>
                  </button>
                  <button class="queue-move-btn queue-btn-bottom ${downDisabled ? 'disabled' : ''}" onclick="moveQueueItem('${video.id}', 'bottom')" ${downDisabled} title="${t.queue_move_bottom || 'En Sona Taşı'}">
                    <i data-lucide="chevrons-down" style="width:11px; height:11px;"></i>
                  </button>
                </div>` : ''}
                ${isDownloading ? `
                  <span class="queue-item-status-badge" style="font-size:0.68rem; display:inline-flex; align-items:center; gap:4px; padding: 2px 6px; border-radius: 4px; background: rgba(16, 185, 129, 0.1); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.2); font-weight: 600;">
                    <i class="spin-animation" style="width: 8px; height: 8px; display:inline-block; border: 1.5px solid #10b981; border-top-color: transparent; border-radius:50%;"></i>
                    <span>%${video.progress || 0}</span>
                  </span>` : ''}
                ${isMerging ? `
                  <span class="queue-item-status-badge" style="font-size:0.68rem; display:inline-flex; align-items:center; gap:4px; padding: 2px 6px; border-radius: 4px; background: rgba(234, 179, 8, 0.1); color: #eab308; border: 1px solid rgba(234, 179, 8, 0.2); font-weight: 600;">
                    <i data-lucide="cog" class="spin-animation" style="width: 10px; height: 10px;"></i>
                    <span>${t.status_merging || 'Birleştiriliyor'}</span>
                  </span>` : ''}
                <button class="btn-cancel-queue" onclick="${isMerging ? `cancelDownload('${video.id}')` : cancelOnClick}" title="${isEn ? 'Cancel' : 'İptal Et'}">
                  <i data-lucide="x" style="width: 12px; height: 12px;"></i>
                  <span>${isEn ? 'Cancel' : 'İptal'}</span>
                </button>
              </div>
            `;
          } else {
            // Cards View
            item.className = 'queue-item';
            if (isMerging) {
              item.className += ' queue-item-merging';
              item.setAttribute('draggable', 'false');
              item.style.borderColor = 'rgba(234, 179, 8, 0.3)';
              item.style.background = 'rgba(234, 179, 8, 0.03)';
            } else {
              item.setAttribute('draggable', 'true');
              if (isDownloading) {
                item.className += ' queue-item-downloading';
                item.style.borderColor = 'rgba(16, 185, 129, 0.3)';
                item.style.background = 'rgba(16, 185, 129, 0.03)';
              }
            }

            item.innerHTML = `
              <div style="display:flex; align-items:center; gap:8px;">
                <div class="queue-item-drag-handle" style="cursor: ${isMerging ? 'not-allowed' : 'grab'}; color: var(--text-muted);" title="${isMerging ? (isEn ? 'Merging process cannot be reordered' : 'Birleştirme işlemi sıralanamaz') : (t.drag_drop_hint || 'Sürükleyin')}">
                  ${isMerging ? '<i data-lucide="loader" class="spin-animation" style="width:16px; height:16px; color: #eab308;"></i>' : '<i data-lucide="grip-vertical" style="width:16px; height:16px;"></i>'}
                </div>
                <span class="queue-order-badge">${orderNoStr}</span>
                ${!isMerging ? `
                <div class="queue-move-btn-group">
                  <button class="queue-move-btn queue-btn-top ${upDisabled ? 'disabled' : ''}" onclick="moveQueueItem('${video.id}', 'top')" ${upDisabled} title="${t.queue_move_top || 'En Başa Taşı'}">
                    <i data-lucide="chevrons-up" style="width:11px; height:11px;"></i>
                  </button>
                  <button class="queue-move-btn queue-btn-up ${upDisabled ? 'disabled' : ''}" onclick="moveQueueItem('${video.id}', 'up')" ${upDisabled} title="${t.queue_move_up || 'Yukarı Taşı'}">
                    <i data-lucide="chevron-up" style="width:11px; height:11px;"></i>
                  </button>
                  <button class="queue-move-btn queue-btn-down ${downDisabled ? 'disabled' : ''}" onclick="moveQueueItem('${video.id}', 'down')" ${downDisabled} title="${t.queue_move_down || 'Aşağı Taşı'}">
                    <i data-lucide="chevron-down" style="width:11px; height:11px;"></i>
                  </button>
                  <button class="queue-move-btn queue-btn-bottom ${downDisabled ? 'disabled' : ''}" onclick="moveQueueItem('${video.id}', 'bottom')" ${downDisabled} title="${t.queue_move_bottom || 'En Sona Taşı'}">
                    <i data-lucide="chevrons-down" style="width:11px; height:11px;"></i>
                  </button>
                </div>` : ''}
              </div>
              <div class="queue-thumb-container video-thumbnail-wrapper" data-video-id="${video.id}" onmouseenter="handleThumbMouseEnter(this)" onmouseleave="handleThumbMouseLeave(this)" title="${escapeHtml(video.title)}">
                <img src="https://i.ytimg.com/vi/${video.id}/mqdefault.jpg" class="video-thumbnail queue-item-thumbnail" onerror="this.src='logo.png'">
              </div>
              <div class="queue-item-info" style="flex:1; min-width:0;">
                <div class="queue-item-title" title="${escapeHtml(video.title)}" style="font-weight:600; color:var(--text-main); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; margin-bottom:4px;">
                  ${escapeHtml(video.title)}
                </div>
                <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                  <span class="queue-meta-pill queue-meta-pill-channel" title="${escapeHtml(video.channelName || '')}">
                    <i data-lucide="tv" style="width:10px; height:10px;"></i>
                    <span>${escapeHtml(video.channelName || '')}</span>
                  </span>
                  <span class="queue-meta-pill queue-meta-pill-duration" title="${t.queue_col_duration || 'Süre'}">
                    <i data-lucide="clock" style="width:10px; height:10px;"></i>
                    <span>${durationStr}</span>
                  </span>
                  ${sizeStr ? `
                    <span class="queue-meta-pill queue-meta-pill-size" title="${t.queue_col_size || 'Boyut'}">
                      <i data-lucide="hard-drive" style="width:10px; height:10px;"></i>
                      <span>${sizeStr}</span>
                    </span>
                  ` : `
                    <span class="queue-meta-pill queue-meta-pill-calc" title="${t.queue_calculating || 'Hesaplanıyor...'}">
                      <i data-lucide="loader" class="spin-animation" style="width:10px; height:10px;"></i>
                      <span>${t.queue_calculating || 'Hesaplanıyor...'}</span>
                    </span>
                  `}
                  ${isDownloading ? `
                    <span class="queue-item-status-badge" style="font-size:0.68rem; display:inline-flex; align-items:center; gap:4px; padding: 2px 6px; border-radius: 4px; background: rgba(16, 185, 129, 0.1); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.2); font-weight: 600;">
                      <i class="spin-animation" style="width: 8px; height: 8px; display:inline-block; border: 1.5px solid #10b981; border-top-color: transparent; border-radius:50%;"></i>
                      <span>%${video.progress || 0}</span>
                    </span>` : ''}
                  ${isMerging ? `
                    <span class="queue-item-status-badge" style="font-size:0.68rem; display:inline-flex; align-items:center; gap:4px; padding: 2px 6px; border-radius: 4px; background: rgba(234, 179, 8, 0.1); color: #eab308; border: 1px solid rgba(234, 179, 8, 0.2); font-weight: 600;">
                      <i data-lucide="cog" class="spin-animation" style="width: 10px; height: 10px;"></i>
                      <span>${t.status_merging || 'Birleştiriliyor'}</span>
                    </span>` : ''}
                </div>
              </div>
              <div class="queue-item-actions">
                <button class="btn-cancel-queue" onclick="${isMerging ? `cancelDownload('${video.id}')` : cancelOnClick}" title="${isEn ? 'Cancel' : 'İptal Et'}">
                  <i data-lucide="x" style="width: 12px; height: 12px;"></i>
                  <span>${isEn ? 'Cancel' : 'İptal'}</span>
                </button>
              </div>
            `;
          }

          if (!isMerging) {
            item.addEventListener('dragstart', handleDragStart);
            item.addEventListener('dragover', handleDragOver);
            item.addEventListener('drop', handleDrop);
            item.addEventListener('dragend', handleDragEnd);
          }

          queueList.appendChild(item);
        });
      }
    }

    // 4.2. Alt Bölüm: Son İndirilen Videolar (Sol) ve Hata Alanlar & Denenenler (Sağ)
    const queueCompletedList = document.getElementById('queue-completed-list');
    const queueFailedList = document.getElementById('queue-failed-list');
    const completedCountEl = document.getElementById('queue-completed-count');
    const failedCountEl = document.getElementById('queue-failed-count');

    if (db.history) {
      const isEn = db.settings && db.settings.lang === 'en';
      const t = translations[lang] || translations.tr;
      const viewMode = (db.settings && db.settings.queueViewMode) || localStorage.getItem('haytool_queue_view_mode') || 'table';

      // --- SOL: Son İndirilen Videolar (Son 20) ---
      const completedVideos = db.history
        .filter(h => h.status === 'completed' && h.manualDownloader !== true && h.hidden !== true)
        .sort((a, b) => new Date(b.downloadedAt || 0).getTime() - new Date(a.downloadedAt || 0).getTime())
        .slice(0, 20);

      if (completedCountEl) {
        completedCountEl.textContent = completedVideos.length;
      }

      if (queueCompletedList) {
        queueCompletedList.innerHTML = '';
        if (completedVideos.length === 0) {
          queueCompletedList.innerHTML = `
            <div class="text-center text-muted" id="queue-completed-list-empty" style="padding: 30px 0; font-size: 0.85rem;">
              ${t.queue_completed_empty || (isEn ? 'No completed downloads yet.' : 'Henüz tamamlanan indirme yok.')}
            </div>
          `;
        } else {
          if (viewMode === 'table') {
            const compHeader = document.createElement('div');
            compHeader.className = 'queue-table-header split-table-header completed-header';
            compHeader.innerHTML = `
              <div style="display:flex; align-items:center; gap:4px;"><span>${t.queue_col_order || '#'}</span></div>
              <div>${t.queue_col_cover || 'Kapak'}</div>
              <div>${t.queue_col_title || 'Video Başlığı'}</div>
              <div>${t.queue_col_duration || 'Süre'} / ${t.queue_col_size || 'Boyut'}</div>
              <div style="text-align:right;">${t.queue_col_actions || 'İşlemler'}</div>
            `;
            queueCompletedList.appendChild(compHeader);
          }

          completedVideos.forEach((video, idx) => {
            const item = document.createElement('div');
            item.setAttribute('data-id', video.id);
            const orderNoStr = `#${(idx + 1).toString().padStart(2, '0')}`;
            const durationStr = video.duration || '--:--';
            const sizeStr = video.fileSize || '-- MB';
            const dateStr = formatDate(video.downloadedAt || video.publishedAt);

            if (viewMode === 'table') {
              item.className = 'queue-table-row split-table-row completed-row queue-item-completed';
              item.setAttribute('draggable', 'false');
              item.style.borderColor = 'rgba(16, 185, 129, 0.2)';
              item.style.background = 'rgba(16, 185, 129, 0.02)';
              item.innerHTML = `
                <div style="display:flex; align-items:center; gap:4px;">
                  <span class="queue-order-badge" style="background: rgba(16, 185, 129, 0.1); color: #10b981; border-color: rgba(16, 185, 129, 0.25);">${orderNoStr}</span>
                </div>
                <div class="queue-thumb-container video-thumbnail-wrapper" data-video-id="${video.id}" onmouseenter="handleThumbMouseEnter(this)" onmouseleave="handleThumbMouseLeave(this)" title="${escapeHtml(video.title)}">
                  <img src="https://i.ytimg.com/vi/${video.id}/mqdefault.jpg" class="video-thumbnail queue-item-thumbnail" onerror="this.src='logo.png'">
                </div>
                <div style="min-width:0; overflow:hidden;">
                  <div class="queue-item-title" title="${escapeHtml(video.title)}" style="font-weight:600; color:var(--text-main); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:0.78rem;">
                    ${escapeHtml(video.title)}
                  </div>
                  <div class="queue-item-channel" style="color:var(--text-muted); font-size:0.7rem; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; display:flex; align-items:center; gap:4px;" title="${escapeHtml(video.channelName || '')}">
                    <i data-lucide="tv" style="width:10px; height:10px; flex-shrink:0;"></i>
                    <span>${escapeHtml(video.channelName || '')}</span>
                  </div>
                </div>
                <div>
                  <div style="display:flex; align-items:center; gap:4px; flex-wrap:wrap;">
                    <span class="queue-meta-pill queue-meta-pill-duration" title="${t.queue_col_duration || 'Süre'}" style="font-size:0.68rem; padding:1px 5px;">
                      <i data-lucide="clock" style="width:8px; height:8px;"></i>
                      <span>${durationStr}</span>
                    </span>
                    <span class="queue-meta-pill queue-meta-pill-size" title="${t.queue_col_size || 'Boyut'}" style="font-size:0.68rem; padding:1px 5px;">
                      <i data-lucide="hard-drive" style="width:8px; height:8px;"></i>
                      <span>${sizeStr}</span>
                    </span>
                  </div>
                </div>
                <div style="display:flex; align-items:center; justify-content:flex-end; gap:4px;">
                  <button class="btn-play-queue" onclick="playVideoEmbedded('${video.id}')" title="${isEn ? 'Play' : 'Oynat'}" style="padding: 3px 6px; font-size: 0.7rem;">
                    <i data-lucide="play" style="width:10px; height:10px;"></i>
                  </button>
                  <button class="btn-cancel-queue" onclick="(window.showDeleteModal || showDeleteModal)('${video.id}')" title="${isEn ? 'Delete' : 'Sil'}" style="padding: 3px 6px; font-size: 0.7rem;">
                    <i data-lucide="trash-2" style="width: 10px; height: 10px;"></i>
                  </button>
                </div>
              `;
            } else {
              // Cards View
              item.className = 'queue-item queue-item-completed';
              item.setAttribute('draggable', 'false');
              item.style.borderColor = 'rgba(16, 185, 129, 0.2)';
              item.style.background = 'rgba(16, 185, 129, 0.02)';
              item.innerHTML = `
                <div class="queue-item-status-group">
                  <div class="queue-item-status-icon" style="display:flex; align-items:center; justify-content:center; color:#10b981;" title="${isEn ? 'Downloaded' : 'İndirildi'}">
                    <i data-lucide="check-circle" style="width:14px; height:14px; color:#10b981;"></i>
                  </div>
                  <span class="queue-order-badge" style="background: rgba(16, 185, 129, 0.1); color: #10b981; border-color: rgba(16, 185, 129, 0.25);">${orderNoStr}</span>
                </div>
                <div class="queue-thumb-container video-thumbnail-wrapper" data-video-id="${video.id}" onmouseenter="handleThumbMouseEnter(this)" onmouseleave="handleThumbMouseLeave(this)" title="${escapeHtml(video.title)}">
                  <img src="https://i.ytimg.com/vi/${video.id}/mqdefault.jpg" class="video-thumbnail queue-item-thumbnail" onerror="this.src='logo.png'">
                </div>
                <div class="queue-item-info">
                  <div class="queue-item-title" title="${escapeHtml(video.title)}">
                    ${escapeHtml(video.title)}
                  </div>
                  <div style="display:flex; align-items:center; gap:4px; flex-wrap:wrap;">
                    <span class="queue-meta-pill queue-meta-pill-channel" title="${escapeHtml(video.channelName || '')}">
                      <i data-lucide="tv" style="width:9px; height:9px;"></i>
                      <span>${escapeHtml(video.channelName || '')}</span>
                    </span>
                    <span class="queue-meta-pill queue-meta-pill-duration" title="${t.queue_col_duration || 'Süre'}">
                      <i data-lucide="clock" style="width:9px; height:9px;"></i>
                      <span>${durationStr}</span>
                    </span>
                    <span class="queue-meta-pill queue-meta-pill-size" title="${t.queue_col_size || 'Boyut'}">
                      <i data-lucide="hard-drive" style="width:9px; height:9px;"></i>
                      <span>${sizeStr}</span>
                    </span>
                    <span class="queue-meta-pill queue-meta-pill-date" title="${t.queue_col_downloaded_at || 'İndirilme Zamanı'}">
                      <i data-lucide="calendar" style="width:9px; height:9px;"></i>
                      <span>${dateStr}</span>
                    </span>
                  </div>
                </div>
                <div class="queue-item-actions">
                  <button class="btn-play-queue" onclick="playVideoEmbedded('${video.id}')" title="${isEn ? 'Play' : 'Oynat'}">
                    <i data-lucide="play"></i>
                    <span>${isEn ? 'Play' : 'Oynat'}</span>
                  </button>
                  <button class="btn-cancel-queue" onclick="(window.showDeleteModal || showDeleteModal)('${video.id}')" title="${isEn ? 'Delete' : 'Sil'}">
                    <i data-lucide="trash-2"></i>
                    <span>${isEn ? 'Delete' : 'Sil'}</span>
                  </button>
                </div>
              `;
            }

            queueCompletedList.appendChild(item);
          });
        }
      }

      // --- SAĞ: İndirilmeyi Deneyenler & Hata Verenler (Son 20) ---
      const disabledChannelIds = new Set((db.channels || []).filter(c => c.autoDownload === false).map(c => c.id));
      const failedVideos = db.history
        .filter(h => (h.status === 'failed' || h.status === 'waiting_live_processing') && h.hidden !== true && h.status !== 'ignored' && !disabledChannelIds.has(h.channelId))
        .sort((a, b) => new Date(b.downloadedAt || b.publishedAt || 0).getTime() - new Date(a.downloadedAt || a.publishedAt || 0).getTime())
        .slice(0, 20);

      if (failedCountEl) {
        failedCountEl.textContent = failedVideos.length;
      }

      if (queueFailedList) {
        queueFailedList.innerHTML = '';
        if (failedVideos.length === 0) {
          queueFailedList.innerHTML = `
            <div class="text-center text-muted" id="queue-failed-list-empty" style="padding: 30px 0; font-size: 0.85rem;">
              ${t.queue_failed_empty || (isEn ? 'No failed or retrying downloads.' : 'Hata alan veya başarısız indirme bulunmuyor.')}
            </div>
          `;
        } else {
          if (viewMode === 'table') {
            const failHeader = document.createElement('div');
            failHeader.className = 'queue-table-header split-table-header failed-header';
            failHeader.innerHTML = `
              <div style="display:flex; align-items:center; gap:4px;"><span>${t.queue_col_order || '#'}</span></div>
              <div>${t.queue_col_cover || 'Kapak'}</div>
              <div>${t.queue_col_title || 'Video Başlığı'} & ${t.queue_col_error || 'Hata'}</div>
              <div>${t.queue_col_duration || 'Süre'}</div>
              <div style="text-align:right;">${t.queue_col_actions || 'İşlemler'}</div>
            `;
            queueFailedList.appendChild(failHeader);
          }

          failedVideos.forEach((video, idx) => {
            const item = document.createElement('div');
            item.setAttribute('data-id', video.id);
            const orderNoStr = `#${(idx + 1).toString().padStart(2, '0')}`;
            const durationStr = video.duration || '--:--';
            const rawError = video.error || '';
            let shortError = '';
            if (rawError) {
              if (/yeler|üyeler|members-only|katıl|katil|join this channel/i.test(rawError)) {
                shortError = t.card_members_only || 'Üyelere Özel';
              } else if (/çerez|cookie/i.test(rawError)) {
                shortError = 'Çerez Hatası';
              } else if (/403|503|429|Forbidden/i.test(rawError)) {
                shortError = '403 CDN Kısıtı';
              } else if (/bulunamadı|not found/i.test(rawError)) {
                shortError = 'Dosya Bulunamadı';
              } else if (/canl[ıi]|live/i.test(rawError)) {
                shortError = 'Canlı Yayın';
              } else {
                const firstLine = rawError.split('\n')[0] || rawError;
                shortError = firstLine.length > 25 ? firstLine.substring(0, 25) + '...' : firstLine;
              }
            } else {
              shortError = t.downloader_invalid_url || 'İndirme Hatası';
            }

            if (viewMode === 'table') {
              item.className = 'queue-table-row split-table-row failed-row queue-item-failed';
              item.setAttribute('draggable', 'false');
              item.style.borderColor = 'rgba(239, 68, 68, 0.2)';
              item.style.background = 'rgba(239, 68, 68, 0.02)';
              item.innerHTML = `
                <div style="display:flex; align-items:center; gap:4px;">
                  <span class="queue-order-badge" style="background: rgba(239, 68, 68, 0.1); color: #ef4444; border-color: rgba(239, 68, 68, 0.25);">${orderNoStr}</span>
                </div>
                <div class="queue-thumb-container video-thumbnail-wrapper" data-video-id="${video.id}" onmouseenter="handleThumbMouseEnter(this)" onmouseleave="handleThumbMouseLeave(this)" title="${escapeHtml(video.title)}">
                  <img src="https://i.ytimg.com/vi/${video.id}/mqdefault.jpg" class="video-thumbnail queue-item-thumbnail" onerror="this.src='logo.png'">
                </div>
                <div style="min-width:0; overflow:hidden;">
                  <div class="queue-item-title" title="${escapeHtml(video.title)}" style="font-weight:600; color:var(--text-main); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:0.78rem;">
                    ${escapeHtml(video.title)}
                  </div>
                  <div style="display:flex; align-items:center; gap:6px; margin-top:2px;">
                    <span class="queue-meta-pill queue-meta-pill-error" title="${escapeHtml(rawError || shortError)}">
                      <i data-lucide="alert-triangle" style="width:9px; height:9px; flex-shrink:0;"></i>
                      <span>${escapeHtml(shortError)}</span>
                    </span>
                  </div>
                </div>
                <div>
                  <span class="queue-meta-pill queue-meta-pill-duration" title="${t.queue_col_duration || 'Süre'}">
                    <i data-lucide="clock" style="width:9px; height:9px;"></i>
                    <span>${durationStr}</span>
                  </span>
                </div>
                <div style="display:flex; align-items:center; justify-content:flex-end; gap:4px;">
                  <button class="btn-retry-queue" onclick="retryFailedVideo('${video.id}')" title="${t.card_retry_download || 'Yeniden Dene'}" style="padding: 3px 6px; font-size: 0.7rem; display:inline-flex; align-items:center; gap:2px;">
                    <i data-lucide="rotate-ccw" style="width:10px; height:10px;"></i>
                    <span>${t.card_retry_download || 'Tekrar'}</span>
                  </button>
                  <button class="btn-cancel-queue btn-delete-failed" onclick="clearFailedVideo('${video.id}')" title="${isEn ? 'Delete from list and ignore' : 'Hata kaydını sil ve indirilmesini engelle'}" style="padding: 3px 6px; font-size: 0.7rem; display:inline-flex; align-items:center; gap:2px;">
                    <i data-lucide="trash-2" style="width: 10px; height: 10px;"></i>
                    <span>${isEn ? 'Delete' : 'Sil'}</span>
                  </button>
                </div>
              `;
            } else {
              // Cards View
              item.className = 'queue-item queue-item-failed';
              item.setAttribute('draggable', 'false');
              item.style.borderColor = 'rgba(239, 68, 68, 0.2)';
              item.style.background = 'rgba(239, 68, 68, 0.02)';
              item.innerHTML = `
                <div class="queue-item-status-group">
                  <div class="queue-item-status-icon" style="display:flex; align-items:center; justify-content:center; color:#ef4444;" title="${isEn ? 'Failed' : 'Hata'}">
                    <i data-lucide="alert-circle" style="width:14px; height:14px; color:#ef4444;"></i>
                  </div>
                  <span class="queue-order-badge" style="background: rgba(239, 68, 68, 0.1); color: #ef4444; border-color: rgba(239, 68, 68, 0.25);">${orderNoStr}</span>
                </div>
                <div class="queue-thumb-container video-thumbnail-wrapper" data-video-id="${video.id}" onmouseenter="handleThumbMouseEnter(this)" onmouseleave="handleThumbMouseLeave(this)" title="${escapeHtml(video.title)}">
                  <img src="https://i.ytimg.com/vi/${video.id}/mqdefault.jpg" class="video-thumbnail queue-item-thumbnail" onerror="this.src='logo.png'">
                </div>
                <div class="queue-item-info">
                  <div class="queue-item-title" title="${escapeHtml(video.title)}">
                    ${escapeHtml(video.title)}
                  </div>
                  <div style="display:flex; align-items:center; gap:4px; flex-wrap:wrap;">
                    <span class="queue-meta-pill queue-meta-pill-channel" title="${escapeHtml(video.channelName || '')}">
                      <i data-lucide="tv" style="width:9px; height:9px;"></i>
                      <span>${escapeHtml(video.channelName || '')}</span>
                    </span>
                    <span class="queue-meta-pill queue-meta-pill-duration" title="${t.queue_col_duration || 'Süre'}">
                      <i data-lucide="clock" style="width:9px; height:9px;"></i>
                      <span>${durationStr}</span>
                    </span>
                    <span class="queue-meta-pill queue-meta-pill-error" title="${escapeHtml(rawError || shortError)}">
                      <i data-lucide="alert-triangle" style="width:9px; height:9px;"></i>
                      <span>${escapeHtml(shortError)}</span>
                    </span>
                  </div>
                </div>
                <div class="queue-item-actions">
                  <button class="btn-retry-queue" onclick="retryFailedVideo('${video.id}')" title="${t.card_retry_download || 'Yeniden Dene'}">
                    <i data-lucide="rotate-ccw"></i>
                    <span>${t.card_retry_download || 'Tekrar'}</span>
                  </button>
                  <button class="btn-cancel-queue btn-delete-failed" onclick="clearFailedVideo('${video.id}')" title="${isEn ? 'Delete from list and ignore' : 'Hata kaydını sil ve indirilmesini engelle'}">
                    <i data-lucide="trash-2"></i>
                    <span>${isEn ? 'Delete' : 'Sil'}</span>
                  </button>
                </div>
              `;
            }

            queueFailedList.appendChild(item);
          });
        }
      }

      try {
        if (typeof lucide !== 'undefined') {
          lucide.createIcons();
        }
      } catch (e) {}
    }
  }

  // 5. Kanallar Listesi (Alfabetik Sıralı & Filtreli - Akıllı İmza ve Odak Korumalı)
  if (channelsList && db.channels) {
    if (typeof updateChannelCategoryFilterOptions === 'function') {
      updateChannelCategoryFilterOptions(db.categories, db.channels, lang);
    }
    const channelFilters = typeof getChannelActiveFilters === 'function' ? getChannelActiveFilters() : {};
    const sigHelper = typeof getChannelsRenderSignature === 'function' ? getChannelsRenderSignature : (window.getChannelsRenderSignature || (() => Math.random()));
    const currentSig = sigHelper(db.channels, db.categories, channelFilters, lang);
    const isInteracting = channelsList.contains(document.activeElement);

    // Kanallar listesinden odak ayrıldığında veya select değiştiğinde bekleyen render'ı çalıştıracak dinleyici
    if (!channelsList._hasDeferredChannelsListener) {
      channelsList._hasDeferredChannelsListener = true;
      const flushPendingChannelsRender = () => {
        setTimeout(() => {
          if (window._pendingChannelsRender && !channelsList.contains(document.activeElement)) {
            const p = window._pendingChannelsRender;
            window._pendingChannelsRender = null;
            window._lastChannelsRenderSignature = p.sig;
            renderChannelsList(channelsList, p.channels, p.t, p.categories, p.filters);
          }
        }, 60);
      };
      channelsList.addEventListener('focusout', flushPendingChannelsRender);
      channelsList.addEventListener('change', flushPendingChannelsRender);
    }

    if (currentSig !== window._lastChannelsRenderSignature) {
      if (isInteracting) {
        // Kullanıcı şu an menüyü açmış veya seçim yapıyor; açık menünün aniden kapanmaması için render ertelenir
        window._pendingChannelsRender = { channels: db.channels, t, categories: db.categories, filters: channelFilters, sig: currentSig };
      } else {
        window._lastChannelsRenderSignature = currentSig;
        renderChannelsList(channelsList, db.channels, t, db.categories, channelFilters);
      }
    }
  }

  // Kategori Yönetimi Arayüzünü Yükle (Araçlar Sekmesinde)
  if (typeof loadCategoriesToTools === 'function') {
    loadCategoriesToTools(db.categories);
  }

  // 6. Kanal Filtresi Seçeneklerini Doldur (Standart Doğal Seçim Listesi)
  populateChannelFilters(db);



  // Yerleşik oynatma listesi sidebar filtrelerini doldur ve senkronize et
  if (typeof updateSidebarSortButtons === 'function') {
    updateSidebarSortButtons();
  }

  // Normal sayfadaki sıralama butonlarının aktifliğini güncelle
  const downloadedSortGroup = document.getElementById('downloaded-sort-group');
  if (downloadedSortGroup) {
    downloadedSortGroup.querySelectorAll('.sort-btn').forEach(b => {
      if (b.getAttribute('data-sort') === downloadedSortVal) {
        b.classList.add('active');
      } else {
        b.classList.remove('active');
      }
    });
  }

  const inlinePlaylistShowShorts = document.getElementById('inline-playlist-show-shorts');
  if (inlinePlaylistShowShorts) {
    inlinePlaylistShowShorts.checked = db.settings?.showShorts !== false;
  }

  const historyOnlyNotDownloadedCheck = document.getElementById('history-only-not-downloaded');
  if (historyOnlyNotDownloadedCheck) {
    historyOnlyNotDownloadedCheck.checked = !!window.historyOnlyNotDownloaded;
    syncFilterChipUI('history-only-not-downloaded');
  }
  const historyOnlyNoAutoDownloadCheck = document.getElementById('history-only-no-auto-download');
  if (historyOnlyNoAutoDownloadCheck) {
    historyOnlyNoAutoDownloadCheck.checked = !!window.historyOnlyNoAutoDownload;
    syncFilterChipUI('history-only-no-auto-download');
  }
  const historyShowHiddenCheck = document.getElementById('history-show-hidden');
  if (historyShowHiddenCheck) {
    historyShowHiddenCheck.checked = !!window.historyShowHidden;
    syncFilterChipUI('history-show-hidden');
  }
  const historyShowShortsCheck = document.getElementById('history-show-shorts');
  if (historyShowShortsCheck) {
    historyShowShortsCheck.checked = localDb.settings?.showShorts !== false;
    syncFilterChipUI('history-show-shorts');
  }
  const historyShowLiveCheck = document.getElementById('history-show-live');
  if (historyShowLiveCheck) {
    historyShowLiveCheck.checked = localDb.settings?.historyShowLive !== false;
    syncFilterChipUI('history-show-live');
  }
  const historyOnlyLiveProcessingCheck = document.getElementById('history-only-live-processing');
  if (historyOnlyLiveProcessingCheck) {
    historyOnlyLiveProcessingCheck.checked = !!window.historyOnlyLiveProcessing;
    syncFilterChipUI('history-only-live-processing');
  }
  const historyShowMembersCheck = document.getElementById('history-show-members');
  if (historyShowMembersCheck) {
    historyShowMembersCheck.checked = window.historyShowMembers !== false;
    syncFilterChipUI('history-show-members');
  }

  // Hızlı filtre rozetini güncelle
  if (typeof updateHistoryFiltersCount === 'function') updateHistoryFiltersCount();

  // Görünüm butonlarının aktiflik durumunu güncelle
  if (viewGridBtn) viewGridBtn.classList.toggle('active', historyViewMode === 'grid');
  if (viewListBtn) viewListBtn.classList.toggle('active', historyViewMode === 'list');
  
  if (downloadedViewGridBtn) downloadedViewGridBtn.classList.toggle('active', downloadedViewMode === 'grid');
  if (downloadedViewListBtn) downloadedViewListBtn.classList.toggle('active', downloadedViewMode === 'list');
  
  if (historyGrid) {
    if (historyViewMode === 'list') {
      historyGrid.classList.add('compact-list');
    } else {
      historyGrid.classList.remove('compact-list');
    }
  }

  if (downloadedGrid) {
    if (downloadedViewMode === 'list') {
      downloadedGrid.classList.add('compact-list');
    } else {
      downloadedGrid.classList.remove('compact-list');
    }
  }

  const activeNavTab = document.querySelector('.nav-item.active')?.getAttribute('data-tab') || 'history';
  const isHistoryActive = activeNavTab === 'history' || activeNavTab === 'all' || !historyGrid?.closest('.tab-content')?.classList.contains('hidden');
  const isDownloadedActive = activeNavTab === 'downloaded' || activeNavTab === 'all' || !downloadedGrid?.closest('.tab-content')?.classList.contains('hidden');

  // Geçmişi filtrele ve çiz (Sadece Kütüphane sekmesi aktifse)
  if (historyGrid && db.history && db.settings && isHistoryActive) {
    // Sadece takip edilen kanalları Kütüphane listesinde göster (PD/elle eklenen takip dışı kanallar elenir)
    const trackedChannelIds = new Set((db.channels || []).map(c => c.id));
    let filteredHistory = db.history.filter(item => item.channelId && trackedChannelIds.has(item.channelId));
    
    if (historyFilterChannel !== 'all') {
      if (historyFilterChannel.startsWith('category:')) {
        const catId = parseInt(historyFilterChannel.split(':')[1], 10);
        const channelIdsInCat = (db.channels || []).filter(c => (c.categoryIds || [c.categoryId || 1]).includes(catId)).map(c => c.id);
        const channelIdsInCatSet = new Set(channelIdsInCat);
        filteredHistory = filteredHistory.filter(item => channelIdsInCatSet.has(item.channelId));
      } else {
        filteredHistory = filteredHistory.filter(item => item.channelId === historyFilterChannel);
      }
    }
    
    if (window.historyOnlyNoAutoDownload) {
      const disabledChannelIds = new Set((db.channels || []).filter(c => c.autoDownload === false).map(c => c.id));
      filteredHistory = filteredHistory.filter(item => disabledChannelIds.has(item.channelId));
    }
    
    if (window.historyOnlyNotDownloaded) {
      filteredHistory = filteredHistory.filter(item => item.status !== 'completed');
    }

    if (window.historyOnlyLiveProcessing) {
      filteredHistory = filteredHistory.filter(item => item.status === 'waiting_live_processing' || item.status === 'live_processing');
    }

    const showMembers = window.historyShowMembers !== false;
    if (!showMembers) {
      filteredHistory = filteredHistory.filter(item => !isMembersOnlyVideo(item));
    }
    
    if (historyFilterDays !== 'all') {
      filteredHistory = filteredHistory.filter(item => {
        const dateStr = item.publishedAt || item.downloadedAt;
        if (!dateStr || dateStr === '-') return false;
        try {
          const pubDate = new Date(dateStr);
          const now = new Date();
          
          const pubZero = new Date(pubDate.getFullYear(), pubDate.getMonth(), pubDate.getDate());
          const nowZero = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          
          const diffMs = nowZero - pubZero;
          const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
          
          if (historyFilterDays === '0') {
            return diffDays <= 0;
          } else if (historyFilterDays === '1') {
            return diffDays === 1;
          } else {
            const maxDays = parseInt(historyFilterDays, 10);
            return diffDays <= maxDays;
          }
        } catch (e) {
          return false;
        }
      });
    }
    
    const showShorts = db.settings.showShorts !== false;
    if (!showShorts) {
      filteredHistory = filteredHistory.filter(item => !isShortVideo(item.duration, item.title, item.channelId));
    }

    // Süre filtresi: seçilen dakikadan kısa veya eşit olan videoları gizle
    const durationFilterVal = db.settings.historyDurationFilter || 'off';
    if (durationFilterVal !== 'off') {
      const maxSeconds = parseInt(durationFilterVal, 10) * 60;
      filteredHistory = filteredHistory.filter(item => {
        const sec = parseDurationToSeconds(item.duration);
        // Süresi bilinmeyen videoları göster, süresi maxSeconds'tan büyük olanları da göster
        return sec === null || sec > maxSeconds;
      });
    }
    
    // Yüklenme tarihine göre sırala (Yeni olan en üstte)
    filteredHistory.sort((a, b) => {
      const dateA = new Date(a.publishedAt || a.downloadedAt || 0).getTime();
      const dateB = new Date(b.publishedAt || b.downloadedAt || 0).getTime();
      return dateB - dateA;
    });

    // Kanal başına geçmiş limiti sadece Kütüphane sayfasında uygula
    const limit = db.settings.historyLimitPerChannel || 30;
    const limitedHistory = [];
    const channelCounts = {};
    for (const item of filteredHistory) {
      const channelId = item.channelId || 'manual';
      if (!channelCounts[channelId]) {
        channelCounts[channelId] = 0;
      }
      if (channelCounts[channelId] < limit) {
        limitedHistory.push(item);
        channelCounts[channelId]++;
      }
    }
    filteredHistory = limitedHistory;

    // Silinen/gizlenen videoları limit uygulandıktan sonra filtrele ki
    // gizlenmiş videolar son videolar kontenjanını kaplasın ve yerine eski videolar sızmasın.
    if (!window.historyShowHidden) {
      filteredHistory = filteredHistory.filter(item => item.hidden !== true);
    }

    // Kütüphane sıralama uygula (configwin.ini / db.settings historySortMode)
    if (historySortMode === 'date-asc') {
      filteredHistory.sort((a, b) => (a.downloadedAt || a.publishedAt || '').localeCompare(b.downloadedAt || b.publishedAt || ''));
    } else if (historySortMode === 'title') {
      filteredHistory.sort((a, b) => (a.title || '').localeCompare(b.title || '', undefined, { sensitivity: 'base' }));
    } else if (historySortMode === 'duration') {
      filteredHistory.sort((a, b) => (parseTimeToSeconds(b.duration) || 0) - (parseTimeToSeconds(a.duration) || 0));
    } else {
      filteredHistory.sort((a, b) => (b.downloadedAt || b.publishedAt || '').localeCompare(a.downloadedAt || a.publishedAt || ''));
    }
    
    renderVideoGrid(historyGrid, filteredHistory, historyViewMode);
  }

  // İndirilen Videoları filtrele ve çiz (Sadece İndirilenler sekmesi aktifse)
  if (downloadedGrid && db.history && db.settings && isDownloadedActive) {
    let filteredDownloaded = db.history.filter(item => item.status === 'completed');
    
    if (downloadedFilterChannel !== 'all') {
      if (downloadedFilterChannel.startsWith('category:')) {
        const catId = parseInt(downloadedFilterChannel.split(':')[1], 10);
        const channelIdsInCat = (db.channels || []).filter(c => (c.categoryIds || [c.categoryId || 1]).includes(catId)).map(c => c.id);
        const channelIdsInCatSet = new Set(channelIdsInCat);
        filteredDownloaded = filteredDownloaded.filter(item => channelIdsInCatSet.has(item.channelId));
      } else {
        filteredDownloaded = filteredDownloaded.filter(item => item.channelId === downloadedFilterChannel);
      }
    }
    
    const showShorts = db.settings.showShorts !== false;
    if (!showShorts) {
      filteredDownloaded = filteredDownloaded.filter(item => !isShortVideo(item.duration, item.title, item.channelId));
    }

    // Yarım Kalanlar (İzlemeyi yarıda bıraktığım videolar) hesaplama ve filtreleme
    let resumeMap = {};
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        resumeMap = JSON.parse(localStorage.getItem('haytool_playback_resume') || '{}');
      }
    } catch (e) {
      resumeMap = {};
    }

    const isPartiallyWatchedVideo = (item) => {
      let durSeconds = item.durationSeconds || 0;
      if (!durSeconds && item.duration && typeof parseTimeToSeconds === 'function') {
        durSeconds = parseTimeToSeconds(item.duration);
      }
      const lastPos = item.lastPositionSeconds || (resumeMap[item.id] || 0);
      if (durSeconds > 10) {
        return lastPos > 3 && lastPos < durSeconds * 0.95;
      }
      return lastPos > 10;
    };

    const partiallyWatchedCount = filteredDownloaded.filter(isPartiallyWatchedVideo).length;
    const resumeBadge = document.getElementById('badge-resume-count');
    if (resumeBadge) {
      resumeBadge.textContent = partiallyWatchedCount;
      resumeBadge.style.display = partiallyWatchedCount > 0 ? 'inline-block' : 'none';
    }

    const resumeBtnEl = document.getElementById('downloaded-filter-resume-btn');
    if (resumeBtnEl) {
      resumeBtnEl.classList.toggle('active', !!downloadedOnlyPartiallyWatched);
    }

    if (downloadedOnlyPartiallyWatched) {
      filteredDownloaded = filteredDownloaded.filter(isPartiallyWatchedVideo);
    }
    
    // Seçilen kritere göre sırala (Tarih, Boyut veya Kullanıcı)
    const sortVal = downloadedSortVal || 'date-desc';
    filteredDownloaded.sort((a, b) => {
      if (sortVal === 'user') {
        const customOrder = JSON.parse(localStorage.getItem('downloaded-user-order') || '[]');
        let indexA = customOrder.indexOf(a.id);
        let indexB = customOrder.indexOf(b.id);
        
        if (indexA === -1 && indexB === -1) {
          const dateA = new Date(a.publishedAt || a.downloadedAt || 0).getTime();
          const dateB = new Date(b.publishedAt || b.downloadedAt || 0).getTime();
          return dateB - dateA;
        }
        if (indexA === -1) return -1;
        if (indexB === -1) return 1;
        
        return indexA - indexB;
      } else if (sortVal.startsWith('size-')) {
        const sizeA = parseSizeToBytes(a.fileSize);
        const sizeB = parseSizeToBytes(b.fileSize);
        return sortVal === 'size-desc' ? sizeB - sizeA : sizeA - sizeB;
      } else {
        const dateA = new Date(a.publishedAt || a.downloadedAt || 0).getTime();
        const dateB = new Date(b.publishedAt || b.downloadedAt || 0).getTime();
        return sortVal === 'date-asc' ? dateA - dateB : dateB - dateA;
      }
    });
    
    renderVideoGrid(downloadedGrid, filteredDownloaded, downloadedViewMode);

    const inlineContainer = document.getElementById('downloaded-inline-player-container');
    if (inlineContainer && !inlineContainer.classList.contains('hidden') && currentPlayingVideoId) {
      renderDownloadedPlaylist(currentPlayingVideoId);
    }
  }

  // 7. Ayarlar Değerleri (Sadece alan odaklanılmamışsa doldur)
  if (db.settings) {
    if (settingsDownloadPath && document.activeElement !== settingsDownloadPath) settingsDownloadPath.value = db.settings.downloadPath || '';
    const settingsTempDirType = document.getElementById('settings-temp-dir-type');
    if (settingsTempDirType && document.activeElement !== settingsTempDirType) settingsTempDirType.value = db.settings.tempDirType || 'system';

    const settingsDurationFetchMethod = document.getElementById('settings-duration-fetch-method');
    if (settingsDurationFetchMethod && document.activeElement !== settingsDurationFetchMethod) {
      settingsDurationFetchMethod.value = db.settings.durationFetchMethod || 'auto';
    }

    const settingsYtdlpRunMode = document.getElementById('settings-ytdlp-run-mode');
    if (settingsYtdlpRunMode && document.activeElement !== settingsYtdlpRunMode) {
      settingsYtdlpRunMode.value = db.settings.ytdlpRunMode || 'exe';
    }

    const settingsPythonCmd = document.getElementById('settings-python-cmd');
    if (settingsPythonCmd && document.activeElement !== settingsPythonCmd) {
      settingsPythonCmd.value = db.settings.pythonCmd || 'python';
    }
    
    if (typeof window.togglePythonSettingsVisibility === 'function') {
      window.togglePythonSettingsVisibility();
    }
    if (settingsQuality && document.activeElement !== settingsQuality) settingsQuality.value = db.settings.quality || 'best';
    if (settingsChannelCheckInterval && document.activeElement !== settingsChannelCheckInterval) settingsChannelCheckInterval.value = db.settings.channelCheckInterval || 60;
    if (settingsAutoDownload && document.activeElement !== settingsAutoDownload) settingsAutoDownload.checked = !!db.settings.autoDownload;
    if (settingsShortsDurationLimit && document.activeElement !== settingsShortsDurationLimit) settingsShortsDurationLimit.value = db.settings.shortsDurationLimit || 180;

    const settingsMergeType = document.getElementById('settings-mergetype');
    const settingsWriteThumbnail = document.getElementById('settings-writethumbnail');
    if (settingsMergeType && document.activeElement !== settingsMergeType) settingsMergeType.value = db.settings.mergeType || 'single';
    if (settingsWriteThumbnail && document.activeElement !== settingsWriteThumbnail) settingsWriteThumbnail.checked = db.settings.writeThumbnail !== false;

    const settingsShowShorts = document.getElementById('settings-showshorts');
    if (settingsShowShorts && document.activeElement !== settingsShowShorts) settingsShowShorts.checked = db.settings.showShorts !== false;

    const settingsHideOnDelete = document.getElementById('settings-hideondelete');
    if (settingsHideOnDelete && document.activeElement !== settingsHideOnDelete) settingsHideOnDelete.checked = db.settings.hideOnDelete !== false;

    const historyShowShorts = document.getElementById('history-show-shorts');
    if (historyShowShorts && document.activeElement !== historyShowShorts) historyShowShorts.checked = db.settings.showShorts !== false;

    const downloadedShowShorts = document.getElementById('downloaded-show-shorts');
    if (downloadedShowShorts && document.activeElement !== downloadedShowShorts) downloadedShowShorts.checked = db.settings.showShorts !== false;

    const inlinePlaylistShowShorts = document.getElementById('inline-playlist-show-shorts');
    if (inlinePlaylistShowShorts && document.activeElement !== inlinePlaylistShowShorts) inlinePlaylistShowShorts.checked = db.settings.showShorts !== false;

    // Yeni Ayarlar: Tema, Otomatik Silme, RSS Limiti ve Hız Limiti
    const settingsTheme = document.getElementById('settings-theme');
    const settingsAutoDelete = document.getElementById('settings-autodelete');
    const settingsRssLimit = document.getElementById('settings-rsslimit');
    const settingsSpeedLimit = document.getElementById('settings-speedlimit');
    const settingsAltSpeedLimit = document.getElementById('settings-altspeedlimit');
    if (settingsTheme && document.activeElement !== settingsTheme) settingsTheme.value = db.settings.theme || 'dark';
    if (settingsAutoDelete && document.activeElement !== settingsAutoDelete) settingsAutoDelete.value = db.settings.autoDeleteDays || 0;
    if (settingsRssLimit && document.activeElement !== settingsRssLimit) settingsRssLimit.value = db.settings.rssLimit || 5;
    if (settingsSpeedLimit && document.activeElement !== settingsSpeedLimit) settingsSpeedLimit.value = db.settings.downloadSpeedLimit || 0;
    if (settingsAltSpeedLimit && document.activeElement !== settingsAltSpeedLimit) settingsAltSpeedLimit.value = db.settings.alternativeSpeedLimit || 500;

    const settingsLiveStreamHandling = document.getElementById('settings-livestreamhandling');
    if (settingsLiveStreamHandling && document.activeElement !== settingsLiveStreamHandling) settingsLiveStreamHandling.value = db.settings.liveStreamHandling || 'instant_retry';

    const settingsLiveStreamRetryInterval = document.getElementById('settings-livestreamretryinterval');
    if (settingsLiveStreamRetryInterval && document.activeElement !== settingsLiveStreamRetryInterval) settingsLiveStreamRetryInterval.value = String(db.settings.liveStreamRetryInterval || 30);

    const settingsPort = document.getElementById('settings-port');
    if (settingsPort && document.activeElement !== settingsPort) settingsPort.value = db.settings.port || 4141;

    const settingsHistoryLimit = document.getElementById('settings-history-limit');
    if (settingsHistoryLimit && document.activeElement !== settingsHistoryLimit) settingsHistoryLimit.value = db.settings.historyLimitPerChannel || 30;

    const settingsPlaySounds = document.getElementById('settings-playsounds');
    if (settingsPlaySounds && document.activeElement !== settingsPlaySounds) settingsPlaySounds.checked = db.settings.playSounds !== false;

    const settingsAutoSyncWatchtime = document.getElementById('settings-autosync-watchtime');
    if (settingsAutoSyncWatchtime && document.activeElement !== settingsAutoSyncWatchtime) settingsAutoSyncWatchtime.checked = db.settings.autoSyncWatchtime !== false;

    const settingsAutoSyncLocalWatchtime = document.getElementById('settings-autosync-local-watchtime');
    if (settingsAutoSyncLocalWatchtime && document.activeElement !== settingsAutoSyncLocalWatchtime) settingsAutoSyncLocalWatchtime.checked = db.settings.autoSyncLocalWatchtime !== false;

    const settingsAutoDiskSync = document.getElementById('settings-auto-disk-sync');
    if (settingsAutoDiskSync && document.activeElement !== settingsAutoDiskSync) settingsAutoDiskSync.checked = db.settings.autoDiskSync !== false;

    const settingsPeriodicDiskSync = document.getElementById('settings-periodic-disk-sync-interval');
    if (settingsPeriodicDiskSync && document.activeElement !== settingsPeriodicDiskSync) settingsPeriodicDiskSync.value = db.settings.periodicDiskSyncInterval || '360';

    const settingsAutoCookieRefresh = document.getElementById('settings-auto-cookie-refresh');
    if (settingsAutoCookieRefresh && document.activeElement !== settingsAutoCookieRefresh) settingsAutoCookieRefresh.checked = db.settings.autoCookieRefresh !== false;

    const settingsCookieRefreshInterval = document.getElementById('settings-cookie-refresh-interval');
    if (settingsCookieRefreshInterval && document.activeElement !== settingsCookieRefreshInterval) settingsCookieRefreshInterval.value = String(db.settings.cookieRefreshInterval !== undefined ? db.settings.cookieRefreshInterval : 30);

    const settingsShowNotifications = document.getElementById('settings-shownotifications');
    if (settingsShowNotifications && document.activeElement !== settingsShowNotifications) settingsShowNotifications.checked = db.settings.showNotifications !== false;

    const settingsCheckOnStartup = document.getElementById('settings-checkonstartup');
    if (settingsCheckOnStartup && document.activeElement !== settingsCheckOnStartup) settingsCheckOnStartup.checked = db.settings.checkChannelsOnStartup === true;

    const settingsAutoOpenBrowser = document.getElementById('settings-autoopenbrowser');
    if (settingsAutoOpenBrowser && document.activeElement !== settingsAutoOpenBrowser) settingsAutoOpenBrowser.checked = db.settings.autoOpenBrowser !== false;

    const settingsLang = document.getElementById('settings-lang');
    const effectiveLang = db.settings.lang || localStorage.getItem('haytool_user_lang') || 'tr';
    if (settingsLang && document.activeElement !== settingsLang) {
      settingsLang.value = effectiveLang;
      setCustomSelectValue(effectiveLang);
    }

    const settingsPrefAudioLang = document.getElementById('settings-preferredaudiolang');
    if (settingsPrefAudioLang && document.activeElement !== settingsPrefAudioLang) {
      settingsPrefAudioLang.value = db.settings.preferredAudioLang || 'auto';
    }


    const settingsDoubleClickAction = document.getElementById('settings-doubleclickaction');
    if (settingsDoubleClickAction && document.activeElement !== settingsDoubleClickAction) {
      settingsDoubleClickAction.value = db.settings.doubleClickAction || 'system';
    }

    const settingsSubtitleColor = document.getElementById('settings-subtitle-color');
    if (settingsSubtitleColor && document.activeElement !== settingsSubtitleColor) {
      settingsSubtitleColor.value = db.settings.subtitleColor || '#ffffff';
    }

    const settingsSponsorBlock = document.getElementById('settings-sponsorblock');
    if (settingsSponsorBlock && document.activeElement !== settingsSponsorBlock) settingsSponsorBlock.checked = db.settings.sponsorBlockEnabled === true;

    const settingsAltThumbnailsHover = document.getElementById('settings-alt-thumbnails-hover');
    if (settingsAltThumbnailsHover && document.activeElement !== settingsAltThumbnailsHover) settingsAltThumbnailsHover.checked = db.settings.enableAltThumbnailsHover !== false;

    const settingsDiscordRpc = document.getElementById('settings-discordrpc');
    if (settingsDiscordRpc && document.activeElement !== settingsDiscordRpc) settingsDiscordRpc.checked = db.settings.discordRpcEnabled === true;

    // Hava Durumu Ayarları
    const settingsWeatherEnabled = document.getElementById('settings-weatherenabled');
    if (settingsWeatherEnabled && document.activeElement !== settingsWeatherEnabled) {
      settingsWeatherEnabled.checked = db.settings.weatherEnabled !== false;
      const details = document.getElementById('weather-settings-details');
      if (details) details.style.display = settingsWeatherEnabled.checked ? 'block' : 'none';
    }

    const settingsWeatherCity = document.getElementById('settings-weathercity');
    if (settingsWeatherCity && document.activeElement !== settingsWeatherCity) {
      settingsWeatherCity.value = db.settings.weatherCity || 'İstanbul';
    }

    const settingsWeatherUnit = document.getElementById('settings-weatherunit');
    if (settingsWeatherUnit && document.activeElement !== settingsWeatherUnit) {
      settingsWeatherUnit.value = db.settings.weatherUnit || 'celsius';
    }

    const settingsWeatherLat = document.getElementById('settings-weatherlatitude');
    if (settingsWeatherLat && document.activeElement !== settingsWeatherLat) {
      settingsWeatherLat.value = db.settings.weatherLatitude !== undefined ? db.settings.weatherLatitude : 41.0082;
    }

    const settingsWeatherLon = document.getElementById('settings-weatherlongitude');
    if (settingsWeatherLon && document.activeElement !== settingsWeatherLon) {
      settingsWeatherLon.value = db.settings.weatherLongitude !== undefined ? db.settings.weatherLongitude : 28.9784;
    }

    // Kuyruk duraklatma butonu görünümü ve ikonu
    const pauseBtn = document.getElementById('queue-pause-btn');
    if (pauseBtn) {
      const iconEl = pauseBtn.querySelector('i') || pauseBtn.querySelector('[data-lucide]');
      if (db.settings.isPaused) {
        pauseBtn.classList.add('btn-warning');
        if (iconEl) iconEl.setAttribute('data-lucide', 'play');
      } else {
        pauseBtn.classList.remove('btn-warning');
        if (iconEl) iconEl.setAttribute('data-lucide', 'pause');
      }
    }

    // Sıradaki hız sınırı giriş kutusu senkronizasyonu ve etiket güncellemesi
    const queueSpeedLimitInput = document.getElementById('queue-speed-limit-input');
    const speedLimitLabel = document.getElementById('speed-limit-label');
    const altSpeedToggleBtn = document.getElementById('alt-speed-toggle-btn');
    const isEn = db.settings.lang === 'en';

    if (db.settings.useAlternativeSpeed) {
      if (queueSpeedLimitInput && document.activeElement !== queueSpeedLimitInput) {
        queueSpeedLimitInput.value = db.settings.alternativeSpeedLimit || 500;
      }
      if (speedLimitLabel) {
        speedLimitLabel.textContent = isEn ? 'Alt. Speed Limit:' : 'Alt. Hız Sınırı:';
        speedLimitLabel.style.color = 'var(--accent-color)';
      }
      if (altSpeedToggleBtn) {
        altSpeedToggleBtn.classList.add('btn-warning');
        altSpeedToggleBtn.classList.remove('btn-secondary');
        altSpeedToggleBtn.setAttribute('title', isEn ? 'Disable Alternative Speed Limit' : 'Alternatif Hız Sınırını Kapat');
      }
    } else {
      if (queueSpeedLimitInput && document.activeElement !== queueSpeedLimitInput) {
        queueSpeedLimitInput.value = db.settings.downloadSpeedLimit || 0;
      }
      if (speedLimitLabel) {
        speedLimitLabel.textContent = isEn ? 'Speed Limit:' : 'Hız Sınırı:';
        speedLimitLabel.style.color = 'var(--text-muted)';
      }
      if (altSpeedToggleBtn) {
        altSpeedToggleBtn.classList.remove('btn-warning');
        altSpeedToggleBtn.classList.add('btn-secondary');
        altSpeedToggleBtn.setAttribute('title', isEn ? 'Enable Alternative Speed Limit' : 'Alternatif Hız Sınırını Aç');
      }
    }

    // Tema Sınıfı Eşitlemesi
    applyTheme(db.settings.theme || 'dark');
    
    // Dil Çevirisini Uygula
    if (db.settings.lang) {
      applyLanguage(db.settings.lang);
    }
    
    // YouTube Oturumu ve Çerez durumunu kontrol et
    checkYouTubeAuthStatus();
  }

  // Gist alanlarını ve bağlantılarını doldur
  populateGistFields();

  // İkonları yeniden yükle
  lucide.createIcons();

  // URL'deki play parametresini kontrol et ve ilk yüklemede otomatik oynat
  if (!window.hasProcessedUrlPlayParam) {
    window.hasProcessedUrlPlayParam = true;
    const urlParams = new URLSearchParams(window.location.search);
    const playVideoId = urlParams.get('play');
    if (playVideoId) {
      switchTab('downloaded', true);
      setTimeout(() => {
        playVideoEmbedded(playVideoId);
      }, 150);
    }
  }

  // (eski renderBulkHideList çağrısı kaldırıldı - artık Kütüphane tabında inline mod kullanılıyor)
}

// Türkçe Açıklama: Belirtilen kanal ID'sini backend API'sine ileterek kanalı izleme listesinden çıkarır ve geçmiş verilerini siler.
/**
 * Belirtilen kanalı takipten çıkarır ve veritabanından siler.
 * 
 * @param {string} id Silinecek kanal ID'si
 */
window.resetHistoryChannelFilter = function() {
  const filterSelect = document.getElementById('history-channel-filter');
  if (filterSelect) {
    filterSelect.value = 'all';
    historyFilterChannel = 'all';
    updateUI(localDb);
  }
};

// Türkçe Açıklama: Kütüphane sekmesindeki tarih filtresini sıfırlar (Tüm Zamanlar yapar).
/**
 * Geçmiş/Kütüphane sekmesindeki tarih filtresini sıfırlar ve arayüzü günceller.
 */
window.resetHistoryDateFilter = function() {
  const dateSelect = document.getElementById('history-date-filter');
  if (dateSelect) {
    dateSelect.value = 'all';
  }
  historyFilterDays = 'all';
  window.historyFilterDays = 'all';
  if (typeof saveHistoryFilterState === 'function') saveHistoryFilterState();
  updateUI(localDb);
};

window.resetDownloadedChannelFilter = function() {
  const filterSelect = document.getElementById('downloaded-channel-filter');
  if (filterSelect) {
    filterSelect.value = 'all';
  }
  downloadedFilterChannel = 'all';
  window.downloadedFilterChannel = 'all';
  if (typeof saveDownloadedFilterState === 'function') saveDownloadedFilterState();
  if (typeof populateChannelFilters === 'function') populateChannelFilters(localDb);
  updateUI(localDb);
};

// Türkçe Açıklama: İndirilenler sekmesinde sadece izlenmesi yarıda bırakılan videoları filtreler
window.toggleDownloadedResumeFilter = function() {
  downloadedOnlyPartiallyWatched = !downloadedOnlyPartiallyWatched;
  window.downloadedOnlyPartiallyWatched = downloadedOnlyPartiallyWatched;
  const btn = document.getElementById('downloaded-filter-resume-btn');
  if (btn) btn.classList.toggle('active', downloadedOnlyPartiallyWatched);
  if (typeof saveDownloadedFilterState === 'function') saveDownloadedFilterState();
  if (typeof localDb !== 'undefined') {
    if (typeof updateUI === 'function') {
      updateUI(localDb);
    } else if (typeof renderUI === 'function') {
      renderUI(localDb);
    }
  }
};

// deleteChannel, updateChannelAvatar, updateChannelInfo, updateAllChannelInfo → ./modules/channels.js

/**
 * Belirtilen videoyu manuel olarak indirme sırasına (kuyruğa) ekler.
 * 
 * @param {string} videoId İndirilecek video ID'si
 */
window.downloadVideoManual = async function(videoId) {
  const item = localDb.history.find(h => h.id === videoId);
  const title = item ? item.title : 'Bilinmeyen Video';
  const channelName = item ? item.channelName : 'Manuel İndirme';
  const channelId = item ? item.channelId : 'manual';

  try {
    showToast(`İndirme başlatılıyor: ${title}`, 'info');
    const res = await fetch('/api/download-video', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ videoId, title, channelName, channelId })
    });
    const data = await res.json();
    if (data.success) {
      showToast('Kuyruğa eklendi.', 'success');
    } else {
      showToast(data.error || 'İndirme tetiklenemedi.', 'error');
    }
  } catch (err) {
    showToast('Sunucu ile iletişim hatası.', 'error');
  }
};

// Türkçe Açıklama: Sunucuya istek göndererek, indirilen videoların bulunduğu klasörü Windows Dosya Gezgini'nde otomatik olarak açar.
/**
 * Sunucuya istek atarak indirme klasörünü (varsa kanal klasörünü) Windows Gezgini'nde açar.
 * 
 * @param {string} channelName Açılacak kanal klasörünün ismi
 */
window.openFolder = async function(channelName) {
  // Eğer parametre bir PointerEvent vb. ise temizle
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
};

// addChannelForm → initAddChannelForm() in ./modules/channels.js

let autoSaveTimeout = null;

async function triggerAutoSave(immediate = false) {
  if (autoSaveTimeout) {
    clearTimeout(autoSaveTimeout);
    autoSaveTimeout = null;
  }
  
  if (immediate) {
    await performAutoSave();
  } else {
    autoSaveTimeout = setTimeout(performAutoSave, 500);
  }
}

async function performAutoSave() {
  if (!settingsForm) return;
  
  const settingsPortInput = document.getElementById('settings-port');
  const port = settingsPortInput ? parseInt(settingsPortInput.value, 10) : 4141;
  
  const settings = {
    downloadPath: settingsDownloadPath.value.trim(),
    tempDirType: document.getElementById('settings-temp-dir-type') ? document.getElementById('settings-temp-dir-type').value : 'system',
    durationFetchMethod: document.getElementById('settings-duration-fetch-method') ? document.getElementById('settings-duration-fetch-method').value : 'auto',
    ytdlpRunMode: document.getElementById('settings-ytdlp-run-mode') ? document.getElementById('settings-ytdlp-run-mode').value : 'exe',
    pythonCmd: document.getElementById('settings-python-cmd') ? document.getElementById('settings-python-cmd').value : 'python',
    quality: settingsQuality.value,
    channelCheckInterval: parseInt(settingsChannelCheckInterval.value, 10) || 60,
    autoDownload: settingsAutoDownload.checked,
    mergeType: document.getElementById('settings-mergetype').value,
    writeThumbnail: document.getElementById('settings-writethumbnail').checked,
    showShorts: document.getElementById('settings-showshorts').checked,
    hideOnDelete: document.getElementById('settings-hideondelete').checked,
    theme: document.getElementById('settings-theme').value,
    autoDeleteDays: parseInt(document.getElementById('settings-autodelete').value, 10) || 0,
    rssLimit: parseInt(document.getElementById('settings-rsslimit').value, 10) || 5,
    liveStreamHandling: document.getElementById('settings-livestreamhandling') ? document.getElementById('settings-livestreamhandling').value : 'instant_retry',
    liveStreamRetryInterval: document.getElementById('settings-livestreamretryinterval') ? (parseInt(document.getElementById('settings-livestreamretryinterval').value, 10) || 30) : 30,
    downloadSpeedLimit: parseInt(document.getElementById('settings-speedlimit').value, 10) || 0,
    alternativeSpeedLimit: parseInt(document.getElementById('settings-altspeedlimit').value, 10) || 500,
     port: port,
    playerType: 'plyr',
    subtitleColor: document.getElementById('settings-subtitle-color').value,
    subtitleOpacity: localDb.settings.subtitleOpacity || '0.7',
    subtitleSize: localDb.settings.subtitleSize || '26px',
    sponsorBlockEnabled: document.getElementById('settings-sponsorblock').checked,
    playSounds: document.getElementById('settings-playsounds').checked,
    autoSyncWatchtime: document.getElementById('settings-autosync-watchtime') ? document.getElementById('settings-autosync-watchtime').checked : (localDb.settings.autoSyncWatchtime !== false),
    autoSyncLocalWatchtime: document.getElementById('settings-autosync-local-watchtime') ? document.getElementById('settings-autosync-local-watchtime').checked : (localDb.settings.autoSyncLocalWatchtime !== false),
    autoDiskSync: document.getElementById('settings-auto-disk-sync') ? document.getElementById('settings-auto-disk-sync').checked : (localDb.settings.autoDiskSync !== false),
    periodicDiskSyncInterval: document.getElementById('settings-periodic-disk-sync-interval') ? document.getElementById('settings-periodic-disk-sync-interval').value : (localDb.settings.periodicDiskSyncInterval || '360'),
    autoCookieRefresh: document.getElementById('settings-auto-cookie-refresh') ? document.getElementById('settings-auto-cookie-refresh').checked : (localDb.settings.autoCookieRefresh !== false),
    cookieRefreshInterval: document.getElementById('settings-cookie-refresh-interval') ? (parseInt(document.getElementById('settings-cookie-refresh-interval').value, 10) || 30) : (localDb.settings.cookieRefreshInterval !== undefined ? localDb.settings.cookieRefreshInterval : 30),
    showNotifications: document.getElementById('settings-shownotifications').checked,
    autoOpenBrowser: document.getElementById('settings-autoopenbrowser').checked,
    checkChannelsOnStartup: document.getElementById('settings-checkonstartup') ? document.getElementById('settings-checkonstartup').checked : false,
    discordRpcEnabled: document.getElementById('settings-discordrpc').checked,
    enableAltThumbnailsHover: document.getElementById('settings-alt-thumbnails-hover') ? document.getElementById('settings-alt-thumbnails-hover').checked : true,
    lang: document.getElementById('settings-lang').value,
    preferredAudioLang: document.getElementById('settings-preferredaudiolang') ? document.getElementById('settings-preferredaudiolang').value : 'auto',
    doubleClickAction: document.getElementById('settings-doubleclickaction').value,
    historyLimitPerChannel: parseInt(document.getElementById('settings-history-limit').value, 10) || 30,
    shortsDurationLimit: settingsShortsDurationLimit ? (parseInt(settingsShortsDurationLimit.value, 10) || 180) : (localDb.settings.shortsDurationLimit || 180),
    githubToken: (document.getElementById('gist-token-input') && document.getElementById('gist-token-input').value.trim()) || (localDb.settings && localDb.settings.githubToken) || '',
    githubGistId: (document.getElementById('gist-id-input') && document.getElementById('gist-id-input').value.trim()) || (localDb.settings && localDb.settings.githubGistId) || '',
    autoSyncGist: document.getElementById('gist-auto-sync-checkbox') ? document.getElementById('gist-auto-sync-checkbox').checked : (localDb.settings.autoSyncGist || false),
    channelScanMode: 'fast',
    weatherEnabled: document.getElementById('settings-weatherenabled') ? document.getElementById('settings-weatherenabled').checked : true,
    weatherCity: document.getElementById('settings-weathercity') ? document.getElementById('settings-weathercity').value.trim() : 'İstanbul',
    weatherUnit: document.getElementById('settings-weatherunit') ? document.getElementById('settings-weatherunit').value : 'celsius',
    weatherLatitude: document.getElementById('settings-weatherlatitude') ? (parseFloat(document.getElementById('settings-weatherlatitude').value) || 41.0082) : 41.0082,
    weatherLongitude: document.getElementById('settings-weatherlongitude') ? (parseFloat(document.getElementById('settings-weatherlongitude').value) || 28.9784) : 28.9784
  };

  const oldPort = localDb.settings.port || 4141;
  const statusSpan = document.getElementById('settings-status');
  if (statusSpan) {
    const isEn = localDb.settings && localDb.settings.lang === 'en';
    statusSpan.innerHTML = `<i data-lucide="loader" class="pulse-animation" style="width:16px; height:16px; margin-right:4px;"></i><span>${isEn ? 'Saving changes...' : 'Ayarlar kaydediliyor...'}</span>`;
    lucide.createIcons();
  }

  try {
    const res = await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings)
    });
    const data = await res.json();
    if (data.success) {
      const isEn = localDb.settings && localDb.settings.lang === 'en';
      if (statusSpan) {
        statusSpan.innerHTML = `<i data-lucide="check-circle" style="width:16px; height:16px; margin-right:4px; color:var(--success-color);"></i><span style="color:var(--success-color);">${isEn ? 'All changes saved.' : 'Tüm değişiklikler kaydedildi.'}</span>`;
        lucide.createIcons();
      }
      showToast(isEn ? 'Settings saved successfully' : 'Ayarlar başarıyla kaydedildi', 'success');
      if (port !== oldPort) {
        showToast(isEn ? 'Port changed. Please restart the app to apply.' : 'Port değiştirildi. Yeni portun aktif olması için uygulamayı yeniden başlatın.', 'warning');
      }
      updateDiskSpace();
      updateWeatherBadge(true);
    }
  } catch (err) {
    console.error('Otomatik kaydetme hatası:', err);
    if (statusSpan) {
      const isEn = localDb.settings && localDb.settings.lang === 'en';
      statusSpan.innerHTML = `<i data-lucide="alert-circle" style="width:16px; height:16px; margin-right:4px; color:var(--danger-color);"></i><span style="color:var(--danger-color);">${isEn ? 'Save error!' : 'Kaydedilemedi!'}</span>`;
      lucide.createIcons();
    }
  }
}

if (settingsForm) {
  settingsForm.addEventListener('submit', (e) => {
    e.preventDefault();
    triggerAutoSave(true);
  });

  // Form içindeki tüm girdi elemanlarını dinle
  const inputs = settingsForm.querySelectorAll('input, select, textarea');
  inputs.forEach(input => {
    if (input.type === 'checkbox' || input.tagName.toLowerCase() === 'select') {
      input.addEventListener('change', () => triggerAutoSave(true));
    } else {
      input.addEventListener('input', () => triggerAutoSave(false));
    }
  });
}

/**
 * Tema Değiştirme ve Uygulama Yardımcı Fonksiyonu
 * 
 * @param {string} themeName - 'dark' | 'light' | 'matrix'
 * @returns {void}
 */
function applyTheme(themeName) {
  const targetTheme = themeName || 'dark';
  document.body.classList.remove('light-theme', 'matrix-theme', 'discord-theme', 'youtube-theme');
  
  if (targetTheme === 'light') {
    document.body.classList.add('light-theme');
  } else if (targetTheme === 'matrix') {
    document.body.classList.add('matrix-theme');
  } else if (targetTheme === 'discord') {
    document.body.classList.add('discord-theme');
  } else if (targetTheme === 'youtube') {
    document.body.classList.add('youtube-theme');
  }
  
  try {
    localStorage.setItem('haytool_theme', targetTheme);
  } catch(e) {}

  if (window.localDb && window.localDb.settings) {
    window.localDb.settings.theme = targetTheme;
  }

  const settingsThemeEl = document.getElementById('settings-theme');
  if (settingsThemeEl) {
    settingsThemeEl.value = targetTheme;
  }

  updateThemeToggleUI(targetTheme);
}
window.applyTheme = applyTheme;

/**
 * Hızlı Tema Değiştir (Quick Theme Toggle Cycle)
 * Koyu -> Açık -> Matrix -> Discord -> YouTube -> Koyu temaları arasında sıralı hızlı geçiş yapar.
 * 
 * @returns {Promise<void>}
 */
async function toggleQuickTheme() {
  const isLight = document.body.classList.contains('light-theme');
  const isMatrix = document.body.classList.contains('matrix-theme');
  const isDiscord = document.body.classList.contains('discord-theme');
  const isYoutube = document.body.classList.contains('youtube-theme');
  
  let newTheme = 'dark';
  if (!isLight && !isMatrix && !isDiscord && !isYoutube) {
    newTheme = 'light';
  } else if (isLight) {
    newTheme = 'matrix';
  } else if (isMatrix) {
    newTheme = 'discord';
  } else if (isDiscord) {
    newTheme = 'youtube';
  } else {
    newTheme = 'dark';
  }

  applyTheme(newTheme);

  try {
    const payload = { ...window.localDb.settings, theme: newTheme };
    await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  } catch (err) {
    devWarn('Tema değişikliği sunucuya kaydedilemedi:', err);
  }

  const isEn = window.localDb && window.localDb.settings && window.localDb.settings.lang === 'en';
  let toastText = '';
  if (newTheme === 'light') {
    toastText = isEn ? 'Light Theme Activated' : 'Açık Tema (Aydınlık) Aktifleştirildi';
  } else if (newTheme === 'matrix') {
    toastText = isEn ? 'Matrix Theme Activated (Cyber Green)' : 'Matrix Teması (Siber Yeşil) Aktifleştirildi 🟢';
  } else if (newTheme === 'discord') {
    toastText = isEn ? 'Discord Theme Activated (Blurple)' : 'Discord Teması (Koyu Blurple) Aktifleştirildi 💬';
  } else if (newTheme === 'youtube') {
    toastText = isEn ? 'YouTube Theme Activated (Obsidian Red)' : 'YouTube Teması (Koyu Kırmızı) Aktifleştirildi ▶️';
  } else {
    toastText = isEn ? 'Dark Theme Activated' : 'Koyu Tema (Karanlık) Aktifleştirildi 🌙';
  }
  
  showToast(toastText, 'info');
}
window.toggleQuickTheme = toggleQuickTheme;

/**
 * Tema Buton İkon ve Başlık Arayüzünü Günceller
 * 
 * @param {string} themeName - Mevcut aktif tema
 * @returns {void}
 */
function updateThemeToggleUI(themeName) {
  const btn = document.getElementById('quick-theme-toggle-btn');
  if (!btn) return;

  const isEn = window.localDb && window.localDb.settings && window.localDb.settings.lang === 'en';
  let currentTheme = 'dark';
  if (typeof themeName === 'string') {
    currentTheme = themeName;
  } else if (document.body.classList.contains('light-theme')) {
    currentTheme = 'light';
  } else if (document.body.classList.contains('matrix-theme')) {
    currentTheme = 'matrix';
  } else if (document.body.classList.contains('discord-theme')) {
    currentTheme = 'discord';
  } else if (document.body.classList.contains('youtube-theme')) {
    currentTheme = 'youtube';
  }

  if (currentTheme === 'light') {
    btn.setAttribute('title', isEn ? 'Switch to Matrix Theme (Cyber Green)' : 'Matrix Temasına Geç (Siber Yeşil)');
    btn.innerHTML = `<i data-lucide="terminal" id="quick-theme-icon"></i>`;
  } else if (currentTheme === 'matrix') {
    btn.setAttribute('title', isEn ? 'Switch to Discord Theme (Blurple)' : 'Discord Temasına Geç (Blurple)');
    btn.innerHTML = `<i data-lucide="message-square" id="quick-theme-icon"></i>`;
  } else if (currentTheme === 'discord') {
    btn.setAttribute('title', isEn ? 'Switch to YouTube Theme (Obsidian Red)' : 'YouTube Temasına Geç (Koyu Kırmızı)');
    btn.innerHTML = `<i data-lucide="play-circle" id="quick-theme-icon"></i>`;
  } else if (currentTheme === 'youtube') {
    btn.setAttribute('title', isEn ? 'Switch to Dark Theme' : 'Koyu Temaya Geç (Karanlık)');
    btn.innerHTML = `<i data-lucide="moon" id="quick-theme-icon"></i>`;
  } else {
    btn.setAttribute('title', isEn ? 'Switch to Light Theme' : 'Açık Temaya Geç (Aydınlık)');
    btn.innerHTML = `<i data-lucide="sun" id="quick-theme-icon"></i>`;
  }
  try { if (typeof lucide !== 'undefined') lucide.createIcons(); } catch (e) {}
}
window.updateThemeToggleUI = updateThemeToggleUI;

if (syncNowBtn) {
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

// triggerManualDiskSync ve ilgili olay dinleyicisi ./modules/systemStatus.js modülünden yönetilmektedir.
initSystemStatusEvents();

if (openFolderBtn) {
  openFolderBtn.addEventListener('click', openFolder);
}

if (selectFolderBtn) {
  selectFolderBtn.addEventListener('click', async () => {
    showToast('Klasör seçim penceresi açılıyor, lütfen bekleyin...', 'info');
    try {
      const res = await fetch('/api/select-folder', { method: 'POST' });
      const data = await res.json();
      if (data.success && data.path) {
        settingsDownloadPath.value = data.path;
        showToast(`Yeni indirme dizini seçildi: ${data.path}`, 'success');
      } else if (data.message) {
        showToast(data.message, 'warning');
      }
    } catch (err) {
      showToast('Klasör seçilirken bir bağlantı hatası oluştu.', 'error');
    }
  });
}

if (testFolderBtn) {
  testFolderBtn.addEventListener('click', async () => {
    // Klasör yolu geçerliliğini test etmek için backend'i tetikleyelim
    const folder = settingsDownloadPath.value.trim();
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

// changeChannelQuality, changeChannelShorts, changeChannelAutoDownload, changeChannelShortsLimit, syncSingleChannelRss → ./modules/channels.js

let videoPlayerInstance = null;
// currentPlayingVideoId dosya başında global tanımlanmıştır
let seekedForCurrentVideo = false;
let lastAutoSyncedTime = 0;
let lastAutoSyncedVideoId = null;

/**
 * İzleme süresini YouTube hesabına otomatik olarak arka planda senkronize eder.
 * 
 * @param {string} vid - Video ID
 * @param {number} curTime - Saniye cinsinden süre
 * @param {boolean} [force=false] - Süre farkı gözetmeksizin zorla gönder (pause/close anında)
 */
let _lastPositionSaveTime = 0;

/**
 * Videonun anlık izleme süresini yerel veritabanına ve localStorage'a kaydeder.
 * 
 * @param {string} videoId Video ID'si
 * @param {number} currentTime O anki saniye
 * @param {number} duration Toplam video süresi
 * @param {boolean} [isFinal=false] Duraklatma veya kapatma anında anında kaydet
 */
window.savePlaybackPosition = function(videoId, currentTime, duration = 0, isFinal = false) {
  if (!videoId) return;

  const posFloor = Math.floor(currentTime || 0);
  const durFloor = Math.floor(duration || 0);

  // Video henüz açılırken veya ilk saniyelerde gelen 0 sürelerin önceki kayıtlı kaldığı yeri silmesini engelle
  if (posFloor <= 3 && !isFinal) {
    return;
  }

  const item = localDb?.history?.find(h => h.id === videoId);
  if (item) {
    if (durFloor > 0 && (posFloor >= durFloor * 0.95 || durFloor - posFloor <= 5)) {
      item.lastPositionSeconds = 0;
    } else if (posFloor > 3) {
      item.lastPositionSeconds = posFloor;
    } else if (isFinal) {
      item.lastPositionSeconds = 0;
    }
    if (durFloor > 0) item.durationSeconds = durFloor;
  }

  try {
    const resumeData = JSON.parse(localStorage.getItem('haytool_playback_resume') || '{}');
    if (durFloor > 0 && (posFloor >= durFloor * 0.95 || durFloor - posFloor <= 5)) {
      delete resumeData[videoId];
    } else if (posFloor > 3) {
      resumeData[videoId] = posFloor;
    } else if (isFinal) {
      delete resumeData[videoId];
    }
    localStorage.setItem('haytool_playback_resume', JSON.stringify(resumeData));
  } catch (e) {}

  const now = Date.now();
  if (isFinal || (now - _lastPositionSaveTime > 5000)) {
    _lastPositionSaveTime = now;
    fetch(`/api/video/${videoId}/save-position`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ position: posFloor, duration: durFloor })
    }).catch(() => {});
  }
};

/**
 * Video kaldığı yerden başlatıldığında ekranda şık bir bilgilendirme kartı gösterir.
 * 
 * @param {number} targetTime Başlatılan saniye
 */
window.showResumeNotification = function(targetTime) {
  if (targetTime <= 3) return;
  const lang = (localDb && localDb.settings && localDb.settings.lang) || currentLang || 'tr';
  const t = translations[lang] || translations.tr;
  const mins = Math.floor(targetTime / 60);
  const secs = Math.floor(targetTime % 60);
  const timeStr = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  
  const template = t.resuming_playback || 'Kaldığınız yerden devam ediliyor: {time}';
  const msg = template.replace('{time}', timeStr);

  const html = `
    <div class="player-transient-card" style="background: rgba(16, 14, 28, 0.9); border: 1px solid rgba(255, 0, 85, 0.4); box-shadow: 0 8px 32px rgba(255, 0, 85, 0.25);">
      <i data-lucide="play-circle" style="width: 32px; height: 32px; color: #ff0055;"></i>
      <div class="transient-title" style="color: #fff; font-size: 0.95rem; font-weight: 600;">${msg}</div>
    </div>
  `;
  if (typeof showPlayerTransientOverlay === 'function') {
    showPlayerTransientOverlay(html, 2200);
  }
  try { if (typeof lucide !== 'undefined') lucide.createIcons(); } catch(e) {}
};

let _syncAbortControllers = {};
let _lastWatchtimeSyncTime = 0;
let _lastWatchtimeSyncVid = null;
let _lastWatchtimeSyncPos = 0;

window.autoSyncWatchtimeHelper = function(vid, curTime, force = false) {
  if (!vid || typeof curTime !== 'number' || isNaN(curTime) || curTime < 2) return;
  if (localDb?.settings?.autoSyncWatchtime === false) return;

  const now = Date.now();
  if (!force) {
    if (_lastWatchtimeSyncVid === vid && (now - _lastWatchtimeSyncTime < 45000) && Math.abs(curTime - _lastWatchtimeSyncPos) < 30) {
      return;
    }
  }

  _lastWatchtimeSyncTime = now;
  _lastWatchtimeSyncVid = vid;
  _lastWatchtimeSyncPos = curTime;

  // Önceki bekleyen istek varsa anında iptal et (kuyruk oluşmasını ve eski sürenin yenisini ezmesini engeller)
  if (_syncAbortControllers[vid]) {
    try { _syncAbortControllers[vid].abort(); } catch (e) {}
  }

  const controller = new AbortController();
  _syncAbortControllers[vid] = controller;

  fetch(`/api/video/${vid}/sync-watchtime`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ currentTime: curTime, silent: true }),
    signal: controller.signal
  }).catch(() => {}).finally(() => {
    if (_syncAbortControllers[vid] === controller) {
      delete _syncAbortControllers[vid];
    }
  });
};

// Türkçe Açıklama: Gömülü video oynatıcı açıkken YouTube klavye kısayollarını (Space, F, M, yön tuşları, sayılar vb.) etkinleştirir.
/**
 * Video oynatıcı modalı açıkken YouTube klavye kısayollarını dinler ve yürütür.
 */
document.addEventListener('keydown', (e) => {
  const modal = document.getElementById('player-modal');
  const inlineContainer = document.getElementById('downloaded-inline-player-container');
  const isModalOpen = modal && !modal.classList.contains('hidden');
  const isInlineOpen = inlineContainer && !inlineContainer.classList.contains('hidden');

  if (isModalOpen || isInlineOpen) {
    // Input veya textarea üzerinde yazı yazılıyorsa kısayolları çalıştırma
    const activeEl = document.activeElement;
    const isTyping = activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.isContentEditable);
    if (isTyping) return;

    const player = document.getElementById('embedded-video-player');

    // Oynatıcı kontrollerini soyutlayan ortak nesne (Plyr)
    const activePlayer = {
      get paused() {
        return videoPlayerInstance ? videoPlayerInstance.paused : (player ? player.paused : true);
      },
      play() {
        return videoPlayerInstance ? videoPlayerInstance.play() : (player ? player.play() : Promise.resolve());
      },
      pause() {
        if (videoPlayerInstance) videoPlayerInstance.pause();
        else if (player) player.pause();
      },
      get duration() {
        return videoPlayerInstance ? (videoPlayerInstance.duration || 0) : (player ? (player.duration || 0) : 0);
      },
      get currentTime() {
        return videoPlayerInstance ? (videoPlayerInstance.currentTime || 0) : (player ? (player.currentTime || 0) : 0);
      },
      set currentTime(val) {
        if (videoPlayerInstance) videoPlayerInstance.currentTime = val;
        else if (player) player.currentTime = val;
      },
      get volume() {
        return videoPlayerInstance ? (videoPlayerInstance.volume || 0) : (player ? (player.volume || 0) : 0);
      },
      set volume(val) {
        const clamped = Math.max(0, Math.min(1, val));
        if (videoPlayerInstance) videoPlayerInstance.volume = clamped;
        else if (player) player.volume = clamped;
        if (typeof triggerVolumeHUD === 'function') {
          triggerVolumeHUD(clamped);
        }
      },
      get muted() {
        return videoPlayerInstance ? (videoPlayerInstance.muted || false) : (player ? (player.muted || false) : false);
      },
      set muted(val) {
        if (videoPlayerInstance) videoPlayerInstance.muted = val;
        else if (player) player.muted = val;
      },
      get speed() {
        return videoPlayerInstance ? (videoPlayerInstance.speed || 1) : (player ? (player.playbackRate || 1) : 1);
      },
      set speed(val) {
        if (videoPlayerInstance) videoPlayerInstance.speed = val;
        else if (player) player.playbackRate = val;
        if (typeof showPlayerTransientOverlay === 'function') {
          showPlayerTransientOverlay(`<div class="player-transient-card"><i data-lucide="gauge" style="width:32px;height:32px;color:var(--accent-color);"></i><div class="transient-title">${val}x</div></div>`, 1000);
        }
      },
      toggleFullscreen() {
        if (videoPlayerInstance && videoPlayerInstance.fullscreen) {
          videoPlayerInstance.fullscreen.toggle();
        }
      },
      toggleCaptions() {
        if (videoPlayerInstance) {
          if (typeof videoPlayerInstance.toggleCaptions === 'function') {
            videoPlayerInstance.toggleCaptions();
          } else if (videoPlayerInstance.captions) {
            videoPlayerInstance.captions.active = !videoPlayerInstance.captions.active;
          }
        } else if (player) {
          const tracks = player.textTracks;
          if (tracks && tracks.length > 0) {
            const isShowing = Array.from(tracks).some(t => t.mode === 'showing');
            for (let i = 0; i < tracks.length; i++) {
              if (isShowing) {
                tracks[i].mode = 'disabled';
              } else {
                tracks[i].mode = i === 0 ? 'showing' : 'disabled';
              }
            }
          }
        }
      }
    };

    const duration = activePlayer.duration;
    const speeds = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];

    switch (e.key) {
      case ' ':
      case 'k':
      case 'K':
        e.preventDefault();
        if (activePlayer.paused) {
          activePlayer.play().catch(() => {});
        } else {
          activePlayer.pause();
        }
        break;

      case 'f':
      case 'F':
        e.preventDefault();
        activePlayer.toggleFullscreen();
        break;

      case 'm':
      case 'M':
        e.preventDefault();
        activePlayer.muted = !activePlayer.muted;
        break;

      case 'c':
      case 'C':
        e.preventDefault();
        activePlayer.toggleCaptions();
        break;

      case 'ArrowRight':
        e.preventDefault();
        activePlayer.currentTime = Math.min(duration, activePlayer.currentTime + 5);
        break;

      case 'ArrowLeft':
        e.preventDefault();
        activePlayer.currentTime = Math.max(0, activePlayer.currentTime - 5);
        break;

      case 'l':
      case 'L':
        e.preventDefault();
        activePlayer.currentTime = Math.min(duration, activePlayer.currentTime + 10);
        break;

      case 'j':
      case 'J':
        e.preventDefault();
        activePlayer.currentTime = Math.max(0, activePlayer.currentTime - 10);
        break;

      case 'ArrowUp':
        e.preventDefault();
        activePlayer.volume = Math.min(1, activePlayer.volume + 0.05);
        break;

      case 'ArrowDown':
        e.preventDefault();
        activePlayer.volume = Math.max(0, activePlayer.volume - 0.05);
        break;

      case 'Home':
        e.preventDefault();
        activePlayer.currentTime = 0;
        break;

      case 'End':
        e.preventDefault();
        activePlayer.currentTime = duration;
        break;

      case '>':
        e.preventDefault();
        {
          const idx = speeds.indexOf(activePlayer.speed);
          if (idx !== -1 && idx < speeds.length - 1) {
            activePlayer.speed = speeds[idx + 1];
          }
        }
        break;

      case '<':
        e.preventDefault();
        {
          const idx = speeds.indexOf(activePlayer.speed);
          if (idx !== -1 && idx > 0) {
            activePlayer.speed = speeds[idx - 1];
          }
        }
        break;

      default:
        // Sayı tuşları (0-9) ile videonun %0 ila %90'ına atlama
        if (e.key >= '0' && e.key <= '9') {
          e.preventDefault();
          const percent = parseInt(e.key, 10) * 10;
          activePlayer.currentTime = duration * (percent / 100);
        }
        if (e.key === '.' && e.shiftKey) {
          e.preventDefault();
          const idx = speeds.indexOf(activePlayer.speed);
          if (idx !== -1 && idx < speeds.length - 1) {
            activePlayer.speed = speeds[idx + 1];
          }
        } else if (e.key === ',' && e.shiftKey) {
          e.preventDefault();
          const idx = speeds.indexOf(activePlayer.speed);
          if (idx !== -1 && idx > 0) {
            activePlayer.speed = speeds[idx - 1];
          }
        }
        break;
    }
  }
});

// Türkçe Açıklama: İndirilen videoyu arayüz içerisindeki gömülü video oynatıcı (Plyr) modalında açarak yürütür.
/**
 * Videoyu gömülü tarayıcı oynatıcısında (Plyr) açar.
 * Shorts videoları dikey gösterilir ve kalınan izleme süresinden devam eder.
 * 
 * @param {string} videoId Oynatılacak video ID'si
 */
// Türkçe Açıklama: Yüzen oynatıcı modalının boyut ve konum stillerini temizleyip video formatına (Shorts / Geniş Ekran) ve kayıtlı ayarlara göre orantılı uygular.
/**
 * Oynatıcı modalının boyut ve en-boy oranını video türüne göre yapılandırır.
 * 
 * @param {boolean} isShort Videonun Shorts/dikey olup olmadığı
 * @param {boolean} [isMinimized=false] Modalın küçültülmüş PiP modunda olup olmadığı
 */
function resetAndApplyPlayerDimensions(isShort = false, isMinimized = false) {
  const modal = document.getElementById('player-modal');
  if (!modal) return;

  const modalContent = modal.querySelector('.player-modal-content');
  const modalBody = modal.querySelector('.player-modal-body');
  if (!modalContent || !modalBody) return;

  if (isShort) {
    modal.classList.add('is-short-player');
  } else {
    modal.classList.remove('is-short-player');
  }

  if (isMinimized) {
    modal.classList.add('minimized');
  } else {
    modal.classList.remove('minimized');
  }

  const suffix = isShort ? '-short' : '-wide';
  const savedWidth = localStorage.getItem(`player-modal${suffix}-width`);
  const savedHeight = localStorage.getItem(`player-modal${suffix}-height`);
  const savedLeft = localStorage.getItem(`player-modal${suffix}-left`);
  const savedTop = localStorage.getItem(`player-modal${suffix}-top`);

  if (!isMinimized && savedWidth && savedHeight) {
    modalContent.style.width = savedWidth;
    modalContent.style.height = savedHeight;
    modalContent.style.left = savedLeft || '';
    modalContent.style.top = savedTop || '';
    modalContent.style.right = savedLeft ? 'auto' : '20px';
    modalContent.style.bottom = savedTop ? 'auto' : '20px';

    const headerEl = modalContent.querySelector('.player-modal-header') || modalContent.querySelector('.modal-header');
    const headerHeight = headerEl ? headerEl.offsetHeight : 38;
    const bodyHeight = parseInt(savedHeight, 10) - headerHeight;
    if (bodyHeight > 50) {
      modalBody.style.height = `${bodyHeight}px`;
    } else {
      modalBody.style.height = '';
    }
  } else {
    // Varsayılan temiz boyutlandırma (inline stilleri temizle, CSS kurallarına bırak)
    modalContent.style.width = '';
    modalContent.style.height = '';
    modalContent.style.left = '';
    modalContent.style.top = '';
    modalContent.style.right = '20px';
    modalContent.style.bottom = '20px';
    modalBody.style.height = '';
  }

  if (isShort) {
    modalBody.style.aspectRatio = '9 / 16';
  } else {
    modalBody.style.aspectRatio = '16 / 9';
  }
}
window.resetAndApplyPlayerDimensions = resetAndApplyPlayerDimensions;

// Türkçe Açıklama: Gömülü video oynatıcı modalının boyutunu küçültür veya eski boyutuna geri getirir.
/**
 * Oynatıcı modalını küçültür (minimize) veya geri yükler.
 */
window.togglePlayerMinimize = function() {
  const modal = document.getElementById('player-modal');
  const btn = document.getElementById('minimize-player-modal-btn');
  if (!modal) return;
  
  modal.classList.toggle('minimized');
  const isMinimized = modal.classList.contains('minimized');
  const isShort = modal.classList.contains('is-short-player');

  resetAndApplyPlayerDimensions(isShort, isMinimized);

  if (btn) {
    const icon = btn.querySelector('i') || btn.querySelector('[data-lucide]');
    if (icon) {
      icon.setAttribute('data-lucide', isMinimized ? 'maximize-2' : 'minus');
    }
    btn.title = isMinimized ? (localDb.settings && localDb.settings.lang === 'en' ? 'Maximize' : 'Büyüt') : (localDb.settings && localDb.settings.lang === 'en' ? 'Minimize' : 'Küçült');
  }
  try {
    if (typeof lucide !== 'undefined') lucide.createIcons();
  } catch (e) {}

  if (videoPlayerInstance && typeof videoPlayerInstance.resize === 'function') {
    setTimeout(() => videoPlayerInstance.resize(), 50);
  }
};

let currentVideoSponsorSegments = [];
let lastSkippedSegmentStart = -1;
let playerResizeObserver = null;

// Türkçe Açıklama: Gömülü video oynatıcı modalının başlık çubuğundan tutularak ekranda serbestçe ve ekran sınırları içinde taşınmasını sağlar.
/**
 * Oynatıcı modalını başlık barından taşınabilir hale getirir.
 * 
 * @param {HTMLElement} modalContent Taşınacak modal içerik elementi
 * @param {HTMLElement} dragHeader Sürükleme tutamacı olarak kullanılacak başlık elementi
 */
function makeElementDraggable(modalContent, dragHeader) {
  if (!modalContent || !dragHeader) return;
  let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;

  dragHeader.onmousedown = dragMouseDown;

  function dragMouseDown(e) {
    e = e || window.event;
    if (e.target.closest('button') || e.target.closest('a') || e.target.closest('input') || e.target.closest('select')) {
      return;
    }
    e.preventDefault();
    pos3 = e.clientX;
    pos4 = e.clientY;
    document.onmouseup = closeDragElement;
    document.onmousemove = elementDrag;
  }

  function elementDrag(e) {
    e = e || window.event;
    e.preventDefault();
    pos1 = pos3 - e.clientX;
    pos2 = pos4 - e.clientY;
    pos3 = e.clientX;
    pos4 = e.clientY;
    
    const newTop = modalContent.offsetTop - pos2;
    const newLeft = modalContent.offsetLeft - pos1;

    const maxLeft = window.innerWidth - modalContent.offsetWidth - 10;
    const maxTop = window.innerHeight - modalContent.offsetHeight - 10;

    modalContent.style.bottom = 'auto';
    modalContent.style.right = 'auto';
    modalContent.style.left = `${Math.max(10, Math.min(newLeft, maxLeft))}px`;
    modalContent.style.top = `${Math.max(10, Math.min(newTop, maxTop))}px`;
  }

  function closeDragElement() {
    document.onmouseup = null;
    document.onmousemove = null;
    const isShort = modalContent.closest('#player-modal')?.classList.contains('is-short-player');
    const suffix = isShort ? '-short' : '-wide';
    localStorage.setItem(`player-modal${suffix}-left`, modalContent.style.left);
    localStorage.setItem(`player-modal${suffix}-top`, modalContent.style.top);
  }
}

// Türkçe Açıklama: Gömülü video oynatıcı modalının köşelerinden veya kenarlarından en-boy oranını (16:9 veya 9:16) bozmadan orantılı olarak yeniden boyutlandırılmasını sağlar.
/**
 * Oynatıcı modalını en-boy oranı kilitli olarak orantılı boyutlandırılabilir hale getirir.
 * 
 * @param {HTMLElement} modalContent Boyutlandırılacak modal içerik elementi
 */
function makeElementResizable(modalContent) {
  if (!modalContent) return;
  const handles = modalContent.querySelectorAll('.resize-handle');
  
  handles.forEach(handle => {
    handle.onmousedown = resizeMouseDown;
    
    function resizeMouseDown(e) {
      e.preventDefault();
      e.stopPropagation();

      const modal = modalContent.closest('#player-modal');
      const isShort = modal ? modal.classList.contains('is-short-player') : false;
      
      // Video elementinden veya sınıftan gerçek en-boy oranını al
      const rawVideo = modalContent.querySelector('video') || (window.videoPlayerInstance && window.videoPlayerInstance.video);
      let ratio = 16 / 9;
      if (rawVideo && rawVideo.videoWidth && rawVideo.videoHeight) {
        ratio = rawVideo.videoWidth / rawVideo.videoHeight;
      } else if (isShort) {
        ratio = 9 / 16;
      }

      const isRight = handle.classList.contains('bottom-right') || handle.classList.contains('top-right') || handle.classList.contains('edge-right');
      const isLeft = handle.classList.contains('bottom-left') || handle.classList.contains('top-left') || handle.classList.contains('edge-left');
      const isBottom = handle.classList.contains('bottom-left') || handle.classList.contains('bottom-right') || handle.classList.contains('edge-bottom');
      const isTop = handle.classList.contains('top-left') || handle.classList.contains('top-right') || handle.classList.contains('edge-top');
      
      const startRect = modalContent.getBoundingClientRect();
      const startWidth = startRect.width;
      const startHeight = startRect.height;
      const startX = e.clientX;
      const startY = e.clientY;
      const startLeft = startRect.left;
      const startTop = startRect.top;
      
      const headerEl = modalContent.querySelector('.player-modal-header') || modalContent.querySelector('.modal-header');
      const headerHeight = headerEl ? headerEl.offsetHeight : 38;

      document.onmousemove = elementResize;
      document.onmouseup = closeResizeElement;
      
      function elementResize(e) {
        e.preventDefault();
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;

        let newWidth = startWidth;

        if (isRight) {
          newWidth = startWidth + dx;
        } else if (isLeft) {
          newWidth = startWidth - dx;
        } else if (isBottom) {
          const newBodyHeight = (startHeight - headerHeight) + dy;
          newWidth = newBodyHeight * ratio;
        } else if (isTop) {
          const newBodyHeight = (startHeight - headerHeight) - dy;
          newWidth = newBodyHeight * ratio;
        }

        // Minimum ve maksimum sınır kontrolleri
        const minWidth = isShort ? 200 : 280;
        const maxWidth = Math.min(1000, window.innerWidth - 20);
        newWidth = Math.max(minWidth, Math.min(newWidth, maxWidth));

        let newBodyHeight = Math.round(newWidth / ratio);
        let newTotalHeight = newBodyHeight + headerHeight;

        // Ekran yüksekliğini aşmama kontrolü
        const maxHeight = window.innerHeight - 20;
        if (newTotalHeight > maxHeight) {
          newTotalHeight = maxHeight;
          newBodyHeight = newTotalHeight - headerHeight;
          newWidth = Math.round(newBodyHeight * ratio);
        }

        // Yeni konum hesaplama (Sol veya Üstten çekildiyse başlangıç konumunu kaydır)
        let newLeft = startLeft;
        let newTop = startTop;

        if (isLeft) {
          newLeft = startLeft + (startWidth - newWidth);
        }
        if (isTop) {
          newTop = startTop + (startHeight - newTotalHeight);
        }

        // Ekran dışına taşmayı sınırla
        newLeft = Math.max(10, Math.min(newLeft, window.innerWidth - newWidth - 10));
        newTop = Math.max(10, Math.min(newTop, window.innerHeight - newTotalHeight - 10));

        modalContent.style.width = `${Math.round(newWidth)}px`;
        modalContent.style.height = `${Math.round(newTotalHeight)}px`;
        modalContent.style.left = `${Math.round(newLeft)}px`;
        modalContent.style.top = `${Math.round(newTop)}px`;
        modalContent.style.right = 'auto';
        modalContent.style.bottom = 'auto';

        const bodyEl = modalContent.querySelector('.player-modal-body');
        if (bodyEl) {
          bodyEl.style.height = `${Math.round(newBodyHeight)}px`;
        }
      }
      
      function closeResizeElement() {
        document.onmousemove = null;
        document.onmouseup = null;
        
        const suffix = isShort ? '-short' : '-wide';
        localStorage.setItem(`player-modal${suffix}-width`, modalContent.style.width);
        localStorage.setItem(`player-modal${suffix}-height`, modalContent.style.height);
        localStorage.setItem(`player-modal${suffix}-left`, modalContent.style.left);
        localStorage.setItem(`player-modal${suffix}-top`, modalContent.style.top);
        
        if (videoPlayerInstance && typeof videoPlayerInstance.resize === 'function') {
          videoPlayerInstance.resize();
        }
      }
    }
  });
}

// drawSponsorSegmentsOnTimeline fonksiyonu ./modules/player/sponsorBlock.js modülünden içe aktarılmıştır.

/**
 * Videonun en-boy oranına göre oynatıcının yönelimini (dikey/yatay) ayarlar.
 * Dikey videolar için hem modal hem de inline wrapper'a 'is-short-player' sınıfı ekler ve gerçek video oranını atar.
 * 
 * @param {HTMLVideoElement} videoElement Kontrol edilecek video DOM elementi
 */
function adjustPlayerOrientation(videoElement) {
  const modal = document.getElementById('player-modal');
  const inlineWrapper = document.querySelector('.inline-player-wrapper');
  if (!videoElement) return;
  
  if (videoElement.videoWidth && videoElement.videoHeight) {
    const isVertical = videoElement.videoHeight > videoElement.videoWidth;
    const ratio = `${videoElement.videoWidth} / ${videoElement.videoHeight}`;

    if (modal) {
      const isMinimized = modal.classList.contains('minimized');
      resetAndApplyPlayerDimensions(isVertical, isMinimized);
      const modalBody = modal.querySelector('.player-modal-body');
      if (modalBody) {
        modalBody.style.aspectRatio = ratio;
      }
    }

    if (inlineWrapper) {
      if (isVertical) {
        inlineWrapper.classList.add('is-short-player');
        inlineWrapper.style.aspectRatio = ratio;
      } else {
        inlineWrapper.classList.remove('is-short-player');
        inlineWrapper.style.aspectRatio = '';
      }
    }

    if (videoPlayerInstance && typeof videoPlayerInstance.resize === 'function') {
      setTimeout(() => videoPlayerInstance.resize(), 50);
    }
  }
}

// SponsorBlock fonksiyonları (fetchSponsorSegments, updateSponsorBlockStatusUI, updateSBToggleButtonUI, checkAndSkipSponsor)
// ./modules/player/sponsorBlock.js modülünden içe aktarılmıştır.

window.showPlayerTransientOverlay = function(htmlContent, durationMs = 1200) {
  const activeTab = document.querySelector('.nav-item.active')?.getAttribute('data-tab') || 'history';
  const isInline = (activeTab === 'downloaded');
  let container = null;
  if (isInline) {
    container = document.getElementById('inline-player-body');
  } else if (activeTab === 'iptv') {
    const slotIdx = window.activeIptvSlot !== undefined ? window.activeIptvSlot : 0;
    const activeSlotEl = document.querySelector(`.iptv-slot[data-slot="${slotIdx}"]`);
    if (activeSlotEl) {
      container = activeSlotEl.querySelector('.slot-body');
    }
  } else {
    const modal = document.getElementById('player-modal');
    if (modal && !modal.classList.contains('hidden')) {
      container = modal.querySelector('.player-modal-body');
    }
  }
  
  if (!container) return;

  let overlay = container.querySelector('.player-transient-overlay');
  if (overlay) {
    if (overlay._fadeOutTimer) clearTimeout(overlay._fadeOutTimer);
  } else {
    overlay = document.createElement('div');
    overlay.className = 'player-transient-overlay';
    container.appendChild(overlay);
  }

  overlay.innerHTML = htmlContent;
  
  overlay._fadeOutTimer = setTimeout(() => {
    overlay.style.animation = 'fadeOut 0.25s ease-in forwards';
    setTimeout(() => {
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
    }, 250);
  }, durationMs);
};

window.triggerVolumeHUD = function(volume) {
  const volPercent = Math.round(volume * 100);
  const icon = volPercent === 0 ? 'volume-x' : (volPercent < 33 ? 'volume' : (volPercent < 66 ? 'volume-1' : 'volume-2'));
  const html = `
    <div class="player-transient-card volume-hud-card">
      <i data-lucide="${icon}" style="width: 32px; height: 32px; color: var(--accent-primary);"></i>
      <div class="transient-title">${volPercent}%</div>
    </div>
  `;
  if (typeof showPlayerTransientOverlay === 'function') {
    showPlayerTransientOverlay(html, 800);
  }
  try { lucide.createIcons(); } catch(e) {}
};

/**
 * Türkçe Açıklama: Oynatılan videonun başlığını ve kanal adını Discord RPC durumuna yansıtmak üzere backend API'ye gönderir.
 * 
 * @param {boolean} isPlaying - Oynatım durumu (true: oynatılıyor, false: durduruldu)
 * @returns {void}
 */
function sendPlayerActivity(isPlaying) {
  if (localDb.settings && localDb.settings.discordRpcEnabled === false) return;

  let title = null;
  let channelName = null;
  if (isPlaying && currentPlayingVideoId) {
    const video = (localDb.history || []).find(h => h.id === currentPlayingVideoId);
    if (video) {
      title = video.title || null;
      channelName = video.channelName || null;
    }
  }

  fetch('/api/player/activity', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, channelName })
  }).catch(e => console.error('[Discord RPC] Durum gönderim hatası:', e));
}

let activePlayRequestId = 0;

// Türkçe Açıklama: İndirilenler tabındaki inline oynatıcıyı, diğer tablarda olduğu gibi sağ alttaki yüzen mini modal'a taşır.
/**
 * İndirilenler tabındaki inline oynatıcıyı yüzen mini modal'a aktarır.
 * Tab geçişi sırasında ve "Küçük Ekran" butonuyla çağrılır.
 * 
 * @returns {boolean} Taşıma başarılıysa true, değilse false döner.
 */
window.switchInlinePlayerToModal = function() {
  const inlineContainer = document.getElementById('downloaded-inline-player-container');
  const isInlineOpen = inlineContainer && !inlineContainer.classList.contains('hidden');
  if (!isInlineOpen || !currentPlayingVideoId) return false;

  const video = (localDb.history || []).find(h => h.id === currentPlayingVideoId);
  const isShort = isShortVideo(video?.duration, video?.title, video?.channelId);

  const inlineBody = document.getElementById('inline-player-body');
  const modal = document.getElementById('player-modal');
  const modalBody = modal ? modal.querySelector('.player-modal-body') : null;
  const modalTitle = document.getElementById('player-modal-title');
  const modalLogo = document.getElementById('player-modal-logo');

  if (!modal || !modalBody || !inlineBody || !inlineBody.firstElementChild) return false;

  // Modal başlık ve logoyu güncelle
  if (modalTitle) modalTitle.textContent = video ? video.title : 'Gömülü Video Oynatıcı';
  if (modalLogo && video?.channelId) {
    modalLogo.src = `/api/channels/${video.channelId}/avatar`;
    modalLogo.style.display = 'block';
  } else if (modalLogo) {
    modalLogo.style.display = 'none';
  }

  // Canlı DOM elementini (Plyr/Video) doğrudan modala taşı
  while (inlineBody.firstChild) {
    modalBody.appendChild(inlineBody.firstChild);
  }

  // Yerleşik alanı gizle, listeyi göster
  inlineContainer.classList.add('hidden');
  const listContainer = document.getElementById('downloaded-list-container');
  if (listContainer) listContainer.classList.remove('hidden');

  // Modalı göster ve boyutlandır (minimize modunda aç)
  modal.classList.remove('hidden');
  if (typeof resetAndApplyPlayerDimensions === 'function') {
    resetAndApplyPlayerDimensions(isShort, true);
  }

  const minBtn = document.getElementById('minimize-player-modal-btn');
  if (minBtn) {
    const icon = minBtn.querySelector('i') || minBtn.querySelector('[data-lucide]');
    if (icon) icon.setAttribute('data-lucide', 'maximize-2');
    minBtn.title = localDb.settings && localDb.settings.lang === 'en' ? 'Maximize' : 'Büyüt';
  }
  try {
    if (typeof lucide !== 'undefined') lucide.createIcons();
  } catch (e) {}

  if (videoPlayerInstance && typeof videoPlayerInstance.resize === 'function') {
    setTimeout(() => videoPlayerInstance.resize(), 50);
  }

  console.log('[HaYTooL] Inline oynatıcı mini modal\'a taşındı.');
  return true;
};

window.cleanupAllPlayers = function() {
  sendPlayerActivity(false);
  if (videoPlayerInstance) {
    try {
      if (typeof videoPlayerInstance.destroy === 'function') {
        videoPlayerInstance.destroy();
      } else if (typeof videoPlayerInstance.pause === 'function') {
        videoPlayerInstance.pause();
      }
    } catch (e) {
      console.error("Error destroying videoPlayerInstance:", e);
    }
    videoPlayerInstance = null;
  }

  const videoElements = document.querySelectorAll('video, audio');
  videoElements.forEach(video => {
    try {
      if (video && typeof video.pause === 'function') video.pause();
      if (video && typeof video.removeAttribute === 'function') video.removeAttribute('src');
      if (video) video.src = '';
      if (video && typeof video.load === 'function') video.load();
      if (video && typeof video.remove === 'function') video.remove();
    } catch (e) {
      console.error("Error pausing video element:", e);
    }
  });

  const iframes = document.querySelectorAll('.inline-player-body iframe, .player-modal-body iframe');
  iframes.forEach(iframe => {
    try {
      iframe.src = 'about:blank';
      iframe.remove();
    } catch (e) {}
  });

  const inlineBody = document.getElementById('inline-player-body');
  if (inlineBody) {
    inlineBody.innerHTML = '';
  }
  const modalBody = document.querySelector('.player-modal-body');
  if (modalBody) {
    modalBody.innerHTML = '';
    modalBody.style.aspectRatio = '';
  }
  const inlineWrapper = document.querySelector('.inline-player-wrapper');
  if (inlineWrapper) {
    inlineWrapper.classList.remove('is-short-player');
    inlineWrapper.style.aspectRatio = '';
  }
};



// Türkçe Açıklama: İndirilen videoyu arayüz içerisindeki gömülü video oynatıcı modalında anında açarak yürütür.
/**
 * Videoyu gömülü tarayıcı oynatıcısında anında açar.
 * 
 * @param {string} videoId Oynatılacak video ID'si
 */
window.playVideoEmbedded = async function(videoId, startSeconds = null, forcePaused = null) {
  const currentRequestId = ++activePlayRequestId;
  try {
    cleanupAllPlayers();

    const activeTab = document.querySelector('.nav-item.active')?.getAttribute('data-tab') || 'history';
    const isInline = (activeTab === 'downloaded');
    const playerType = 'plyr';

    let video = localDb.history.find(h => h.id === videoId);
    let videoTitle = video ? video.title : '';
    let videoChannelId = video ? video.channelId : '';
    let videoChannelName = video ? video.channelName : '';
    let videoDuration = video ? video.duration : '';
    let fileSizeStr = video ? video.fileSize : '';
    let publishDateStr = video ? (video.publishedAt || video.downloadedAt || '') : '';

    // Arka planda gecikmesiz SponsorBlock segmentlerini çek
    fetchSponsorSegments(videoId).then(() => {
      if (currentRequestId !== activePlayRequestId) return;
      updateSponsorBlockStatusUI();
      const rawVideo = document.querySelector('#player-modal video, #inline-player-body video') || (videoPlayerInstance?.media || videoPlayerInstance?.video);
      if (rawVideo && rawVideo.duration) {
        drawSponsorSegmentsOnTimeline(rawVideo.duration, playerType);
      }
    }).catch(() => {});

    let availableSubtitles = [];

    // Altyazıları modül aracılığıyla arka planda hemen çek ve oynatıcıya uygula
    const subFetchPromise = fetchVideoSubtitles(videoId)
      .then(subs => {
        if (currentRequestId !== activePlayRequestId) return [];
        availableSubtitles = subs;
        applySubtitlesToPlayer(subs);
        return availableSubtitles;
      })
      .catch(err => {
        console.warn('[Subtitles] Fetch error:', err);
        return [];
      });

    // DOM Fallback
    if (!videoTitle) {
      const cardTitleEl = document.querySelector(`.video-card-title[title*="${videoId}"], .video-card-title[onclick*="${videoId}"]`);
      if (cardTitleEl) {
        videoTitle = cardTitleEl.textContent.trim();
      }
    }
  if (!videoChannelId) {
    const cardEl = document.querySelector(`.video-thumbnail-wrapper[onclick*="${videoId}"]`)?.closest('.video-card');
    if (cardEl) {
      const channelNameEl = cardEl.querySelector('.video-card-channel');
      if (channelNameEl) {
        const nameText = channelNameEl.textContent.trim();
        const chan = localDb.channels?.find(c => c.name === nameText);
        if (chan) videoChannelId = chan.id;
      }
    }
  }

  // Önceki oynatıcılar cleanupAllPlayers ile temizlendi

  let playerContainer = null;

  if (isInline) {
    // 1. Modal oynatıcıyı kapat/gizle
    const modal = document.getElementById('player-modal');
    if (modal) modal.classList.add('hidden');

    // 2. Inline player UI göster/gizle
    const inlineContainer = document.getElementById('downloaded-inline-player-container');
    const listContainer = document.getElementById('downloaded-list-container');
    if (inlineContainer) inlineContainer.classList.remove('hidden');
    if (listContainer) listContainer.classList.add('hidden');

    // Video oynatılmaya başladığında sayfayı en yukarı kaydır (böylece oynatıcı tam olarak görünür olur)
    const mainContent = document.querySelector('.main-content');
    if (mainContent) {
      mainContent.scrollTop = 0;
    }

    playerContainer = document.getElementById('inline-player-body');

    // 3. Bilgileri yerleştir
    const titleEl = document.getElementById('inline-player-title');
    if (titleEl) {
      const titleText = videoTitle || 'Yerleşik Oynatıcı';
      titleEl.textContent = titleText;
      titleEl.title = titleText; // Hover tooltip showing full title

      // Karakter sayısına göre yazı boyutunu dinamik ayarla (2. satıra taşmayı engellemek için)
      if (titleText.length > 80) {
        titleEl.style.fontSize = '0.85rem';
      } else if (titleText.length > 60) {
        titleEl.style.fontSize = '0.95rem';
      } else if (titleText.length > 40) {
        titleEl.style.fontSize = '1.1rem';
      } else {
        titleEl.style.fontSize = '1.25rem';
      }
    }

    const channelNameEl = document.getElementById('inline-player-channel-name');
    if (channelNameEl) channelNameEl.textContent = videoChannelName || '';

    const avatarEl = document.getElementById('inline-player-channel-avatar');
    const logoDividerEl = document.getElementById('inline-player-logo-divider');
    if (avatarEl) {
      if (videoChannelId) {
        avatarEl.src = `/api/channels/${videoChannelId}/avatar`;
        avatarEl.style.display = 'block';
        if (logoDividerEl) logoDividerEl.style.display = 'inline';
      } else {
        avatarEl.style.display = 'none';
        if (logoDividerEl) logoDividerEl.style.display = 'none';
      }
    }

    const subsEl = document.getElementById('inline-player-channel-subs');
    const subsTextEl = document.getElementById('inline-player-channel-subs-text');
    const dividerEl = document.getElementById('inline-player-channel-divider');
    if (subsEl && subsTextEl) {
      const channel = localDb.channels?.find(c => c.id === videoChannelId || (videoChannelName && c.name === videoChannelName));
      const subVal = channel && channel.subscriberCount ? channel.subscriberCount : '?';
      
      subsTextEl.textContent = subVal;
      subsEl.style.display = 'inline-flex';
      if (dividerEl) dividerEl.style.display = 'inline';
      try {
        if (typeof lucide !== 'undefined') {
          lucide.createIcons();
        }
      } catch (e) {}
    }

    const channelContainer = document.querySelector('.inline-player-channel');
    if (channelContainer) {
      if (videoChannelId) {
        channelContainer.style.cursor = 'pointer';
        channelContainer.title = localDb.settings?.lang === 'en' ? 'Go to Channel Videos' : 'Kanala Git';
        channelContainer.onclick = (e) => {
          e.preventDefault();
          window.open(`https://www.youtube.com/channel/${videoChannelId}/videos`, '_blank');
        };
      } else {
        channelContainer.style.cursor = 'default';
        channelContainer.title = '';
        channelContainer.onclick = null;
      }
    }

    const publishDateEl = document.getElementById('inline-player-publish-date');
    if (publishDateEl) {
      const isEn = localDb.settings?.lang === 'en';
      const pubDate = video && video.publishedAt ? formatDate(video.publishedAt) : '--';
      publishDateEl.textContent = (isEn ? 'Published: ' : 'Yüklenme: ') + pubDate;
    }

    const downloadDateEl = document.getElementById('inline-player-download-date');
    if (downloadDateEl) {
      const isEn = localDb.settings?.lang === 'en';
      const dlDate = video && video.downloadedAt ? formatDate(video.downloadedAt) : '--';
      downloadDateEl.textContent = (isEn ? 'Downloaded: ' : 'İndirilme: ') + dlDate;
    }

    const fileSizeEl = document.getElementById('inline-player-file-size');
    if (fileSizeEl) {
      const isEn = localDb.settings?.lang === 'en';
      fileSizeEl.textContent = (isEn ? 'Size: ' : 'Boyut: ') + (fileSizeStr || '--');
    }

    // Auto show comments panel
    const commentsContainer = document.getElementById('inline-player-comments-container');
    if (commentsContainer) {
      commentsContainer.classList.remove('hidden');
    }
    const commentsBtn = document.getElementById('inline-btn-comments');
    const isEn = localDb.settings?.lang === 'en';
    if (commentsBtn) {
      commentsBtn.classList.add('active');
      commentsBtn.title = isEn ? 'Hide Comments' : 'Yorumları Gizle';
    }
    loadComments(videoId);

    // Reset and Fetch description panel
    const descContainer = document.getElementById('inline-player-description-container');
    const descContent = document.getElementById('description-content');
    const descBtn = document.getElementById('inline-btn-description');
    
    if (descContainer) descContainer.classList.add('hidden');
    if (descBtn) {
      descBtn.classList.remove('active');
      descBtn.style.display = 'none';
    }
    if (descContent) descContent.innerHTML = '';

    fetch(`/api/video/${videoId}/description`)
      .then(res => res.json())
      .then(data => {
        if (data.success && data.description) {
          if (descContent) {
            descContent.innerHTML = formatDescriptionTimestamps(data.description);
          }
          if (descBtn) {
            descBtn.style.display = 'inline-flex';
            descBtn.classList.add('active');
            descBtn.title = isEn ? 'Hide Description' : 'Açıklamayı Gizle';
          }
          if (descContainer) {
            descContainer.classList.remove('hidden');
          }
        }
      })
      .catch(err => {
        console.error("Error fetching description:", err);
      });

    // SponsorBlock renk açıklaması (legend)
    const sbLegend = document.getElementById('inline-player-sponsorblock-legend');
    const sbSep = document.getElementById('inline-player-sb-sep');
    if (sbLegend) {
      sbLegend.style.display = 'flex';
      if (sbSep) sbSep.style.display = 'inline';
    }

    // 4. Eylemleri bağla
    const btnYoutube = document.getElementById('inline-btn-youtube');
    if (btnYoutube) btnYoutube.onclick = () => openYouTube(videoId);

    const btnSystem = document.getElementById('inline-btn-system');
    if (btnSystem) {
      const isCompleted = video && video.status === 'completed';
      const isMissing = video && video.fileMissing === true;
      if (isCompleted && !isMissing) {
        btnSystem.disabled = false;
        btnSystem.style.opacity = '1';
        btnSystem.style.cursor = 'pointer';
        btnSystem.onclick = () => playVideoSystem(videoId);
      } else {
        btnSystem.disabled = true;
        btnSystem.style.opacity = '0.4';
        btnSystem.style.cursor = 'not-allowed';
      }
    }

    const btnFolder = document.getElementById('inline-btn-folder');
    if (btnFolder) {
      const isCompleted = video && video.status === 'completed';
      const isMissing = video && video.fileMissing === true;
      if (isCompleted && !isMissing) {
        btnFolder.disabled = false;
        btnFolder.style.opacity = '1';
        btnFolder.style.cursor = 'pointer';
        btnFolder.onclick = () => openFolder(decodeURIComponent(encodeURIComponent(videoChannelName)));
      } else {
        btnFolder.disabled = true;
        btnFolder.style.opacity = '0.4';
        btnFolder.style.cursor = 'not-allowed';
      }
    }

    const btnDelete = document.getElementById('inline-btn-delete');
    if (btnDelete) {
      const isCompleted = video && video.status === 'completed';
      if (isCompleted) {
        btnDelete.style.display = 'inline-flex';
        btnDelete.onclick = () => {
          // Oynatıcıyı geçici olarak duraklat (kullanıcı silme modalını incelerken ses arka planda devam etmesin)
          if (videoPlayerInstance && typeof videoPlayerInstance.pause === 'function') {
            try { videoPlayerInstance.pause(); } catch (e) {}
          }
          document.querySelectorAll('video, audio').forEach(v => {
            try { v.pause(); } catch (e) {}
          });
          // Özelleştirilmiş zengin silme onay modalını aç (YouTube geçmişi, disk silme, kütüphanede gizleme seçenekleri)
          if (typeof window.showDeleteModal === 'function') {
            window.showDeleteModal(videoId);
          } else if (typeof showDeleteModal === 'function') {
            showDeleteModal(videoId);
          }
        };
      } else {
        btnDelete.style.display = 'none';
      }
    }

    const btnTranslate = document.getElementById('inline-btn-translate-sub');
    if (btnTranslate) {
      const isCompleted = video && video.status === 'completed';

      if (isCompleted) {
        btnTranslate.style.display = 'inline-flex';
        btnTranslate.onclick = () => {
          openSubtitleTranslateModal(videoId, availableSubtitles, {
            playerContainer: playerContainer || document.getElementById('inline-player-body'),
            onComplete: () => {
              playVideoEmbedded(videoId, videoPlayerInstance ? videoPlayerInstance.currentTime : null);
            }
          });
        };
      } else {
        btnTranslate.style.display = 'none';
      }
    }

    // SponsorBlock toggle button logic
    const btnSBToggle = document.getElementById('inline-btn-sponsorblock-toggle');
    if (btnSBToggle) {
      btnSBToggle.style.display = 'inline-flex';
      updateSBToggleButtonUI();

      btnSBToggle.onclick = async () => {
        const isCurrentlyActive = localDb.settings && localDb.settings.sponsorBlockEnabled === true;
        const newStatus = !isCurrentlyActive;
        
        if (!localDb.settings) localDb.settings = {};
        localDb.settings.sponsorBlockEnabled = newStatus;

        const settingsSB = document.getElementById('settings-sponsorblock');
        if (settingsSB) settingsSB.checked = newStatus;

        updateSBToggleButtonUI();

        try {
          await fetch('/api/settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sponsorBlockEnabled: newStatus })
          });
        } catch(err) {
          console.error('[SponsorBlock] Setting save error:', err);
        }

        if (typeof updateSponsorBlockStatusUI === 'function') {
          updateSponsorBlockStatusUI();
        }
        
        const lang = (localDb && localDb.settings && localDb.settings.lang) || currentLang || 'tr';
        const t = translations[lang] || translations.tr;
        const icon = newStatus ? 'shield' : 'shield-off';
        const title = newStatus 
          ? (t.sponsorblock_active_toast || 'SponsorBlock Aktif') 
          : (t.sponsorblock_disabled_toast || 'SponsorBlock Devre Dışı');
        const desc = newStatus 
          ? (t.sponsorblock_active_toast_desc || 'Sponsorlu alanlar otomatik atlanacak') 
          : (t.sponsorblock_disabled_toast_desc || 'Sponsorlu alan atlamaları durduruldu');

        const html = `
          <div class="player-transient-card">
            <i data-lucide="${icon}" style="width: 36px; height: 36px; color: ${newStatus ? '#4ade80' : '#ef4444'};"></i>
            <div class="transient-title">${title}</div>
            <div class="transient-desc">${desc}</div>
          </div>
        `;
        // Kullanıcı isteği: SponsorBlock devre dışı bırakılsa bile ilerleme çubuğundaki renkli segmentler ve legend görünmeye devam etsin (sadece otomatik atlama durdurulsun)
        const currentVidEl = document.querySelector('#player-modal video, #inline-player-body video') || (videoPlayerInstance?.media || videoPlayerInstance?.video);
        if (currentVidEl && currentVidEl.duration) {
          drawSponsorSegmentsOnTimeline(currentVidEl.duration, playerType);
        }

        if (typeof showPlayerTransientOverlay === 'function') {
          showPlayerTransientOverlay(html, 1500);
        }
        try {
          lucide.createIcons();
        } catch(e) {}
      };
    }

    const btnClose = document.getElementById('inline-btn-close');
    if (btnClose) btnClose.onclick = () => closeInlinePlayer();

    // Türkçe Açıklama: "Küçük Ekrana Geç" butonu — inline oynatıcıyı sağ alttaki mini modal'a taşır.
    /**
     * İndirilenler tabındaki inline oynatıcıyı yüzen mini modal'a aktarır.
     * @returns {void}
     */
    const btnSwitchMini = document.getElementById('inline-btn-switch-mini');
    if (btnSwitchMini) {
      btnSwitchMini.onclick = () => window.switchInlinePlayerToModal();
    }

    // Autoplay toggle button logic
    const btnAutoplay = document.getElementById('inline-btn-autoplay-toggle');
    if (btnAutoplay) {
      const isAutoplayEnabled = localStorage.getItem('inline-autoplay-enabled') === 'true';
      if (isAutoplayEnabled) {
        btnAutoplay.classList.add('active');
      } else {
        btnAutoplay.classList.remove('active');
      }

      btnAutoplay.onclick = () => {
        const currentlyActive = btnAutoplay.classList.contains('active');
        const nextActive = !currentlyActive;
        localStorage.setItem('inline-autoplay-enabled', nextActive ? 'true' : 'false');
        
        if (nextActive) {
          btnAutoplay.classList.add('active');
        } else {
          btnAutoplay.classList.remove('active');
        }

        const lang = (localDb && localDb.settings && localDb.settings.lang) || currentLang || 'tr';
        const isEn = lang === 'en';
        const title = isEn 
          ? (nextActive ? 'Autoplay: ON' : 'Autoplay: OFF') 
          : (nextActive ? 'Otomatik Geçiş: AÇIK' : 'Otomatik Geçiş: KAPALI');
        const desc = isEn
          ? (nextActive ? 'Next video will play automatically.' : 'Continuous playback disabled.')
          : (nextActive ? 'Sıradaki video otomatik olarak oynatılacak.' : 'Otomatik video geçişi devre dışı bırakıldı.');
        const icon = nextActive ? 'repeat' : 'repeat';
        const color = nextActive ? '#4ade80' : '#ef4444';

        const html = `
          <div class="player-transient-card">
            <i data-lucide="${icon}" style="width: 36px; height: 36px; color: ${color};"></i>
            <div class="transient-title">${title}</div>
            <div class="transient-desc">${desc}</div>
          </div>
        `;
        if (typeof showPlayerTransientOverlay === 'function') {
          showPlayerTransientOverlay(html, 1500);
        }
        try {
          lucide.createIcons();
        } catch(e) {}
      };
    }

    // Açıklama ve Yorumları Güncelleme Butonu logic
    const btnRefreshDetails = document.getElementById('inline-btn-refresh-details');
    if (btnRefreshDetails) {
      btnRefreshDetails.onclick = async () => {
        const lang = (localDb && localDb.settings && localDb.settings.lang) || currentLang || 'tr';
        const isEn = lang === 'en';
        
        // İlk yükleniyor bildirimi
        const loadingHtml = `
          <div class="player-transient-card">
            <i data-lucide="refresh-cw" style="width: 36px; height: 36px; color: #38bdf8; animation: spin 1s linear infinite;"></i>
            <div class="transient-title">${isEn ? 'Refreshing...' : 'Güncelleniyor...'}</div>
            <div class="transient-desc">${isEn ? 'Updating description and comments from YouTube' : 'Açıklama ve yorumlar YouTube\'dan tazelemekte'}</div>
          </div>
        `;
        if (typeof showPlayerTransientOverlay === 'function') {
          showPlayerTransientOverlay(loadingHtml, 6000);
        }
        try {
          lucide.createIcons();
        } catch(e) {}

        try {
          // Açıklamayı güncelle
          const descRes = await fetch(`/api/video/${videoId}/refresh-details`, {
            method: 'POST'
          });
          const descData = await descRes.json();

          if (descData.success) {
            // Açıklama alanını tazele
            const descContent = document.getElementById('description-content');
            if (descContent && descData.description) {
              descContent.innerHTML = formatDescriptionTimestamps(descData.description);
            }
            
            const descBtn = document.getElementById('inline-btn-description');
            if (descBtn) {
              descBtn.style.display = 'inline-flex';
              descBtn.classList.add('active');
              descBtn.title = isEn ? 'Hide Description' : 'Açıklamayı Gizle';
            }
            
            const descContainer = document.getElementById('inline-player-description-container');
            if (descContainer) {
              descContainer.classList.remove('hidden');
            }

            // Yorumları yeniden yükle
            loadComments(videoId);

            // Başarılı bildirimi göster
            const successHtml = `
              <div class="player-transient-card">
                <i data-lucide="check-circle" style="width: 36px; height: 36px; color: #4ade80;"></i>
                <div class="transient-title">${isEn ? 'Details Updated' : 'Detaylar Güncellendi'}</div>
                <div class="transient-desc">${isEn ? 'Description and comments updated successfully.' : 'Açıklama ve yorumlar başarıyla yenilendi.'}</div>
              </div>
            `;
            if (typeof showPlayerTransientOverlay === 'function') {
              showPlayerTransientOverlay(successHtml, 2000);
            }
          } else {
            throw new Error(descData.error || 'API Error');
          }
        } catch (err) {
          console.error("Refresh details error:", err);
          const errorHtml = `
            <div class="player-transient-card">
              <i data-lucide="alert-circle" style="width: 36px; height: 36px; color: #ef4444;"></i>
              <div class="transient-title">${isEn ? 'Update Failed' : 'Güncelleme Başarısız'}</div>
              <div class="transient-desc">${err.message || 'Error occurred.'}</div>
            </div>
          `;
          if (typeof showPlayerTransientOverlay === 'function') {
            showPlayerTransientOverlay(errorHtml, 2500);
          }
        }
        try {
          lucide.createIcons();
        } catch(e) {}
      };
    }

    // Kaldığım Yeri YouTube'a Eşitle Butonu logic
    const btnSyncWatchtime = document.getElementById('inline-btn-sync-watchtime');
    if (btnSyncWatchtime) {
      btnSyncWatchtime.onclick = async () => {
        const lang = (localDb && localDb.settings && localDb.settings.lang) || currentLang || 'tr';
        const isEn = lang === 'en';
        
        let currentTime = 0;
        if (videoPlayerInstance && typeof videoPlayerInstance.currentTime === 'number') {
          currentTime = videoPlayerInstance.currentTime;
        } else {
          const v = document.querySelector('#inline-player-container video, #inline-player-body video');
          if (v) currentTime = v.currentTime || 0;
        }

        const mins = Math.floor(currentTime / 60);
        const secs = Math.floor(currentTime % 60);
        const timeStr = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;

        // Görsel transient kart göster
        const loadingHtml = `
          <div class="player-transient-card">
            <i data-lucide="bookmark-check" style="width: 36px; height: 36px; color: #a855f7; animation: pulse 1s infinite;"></i>
            <div class="transient-title">${isEn ? 'Syncing to YouTube...' : 'YouTube\'a Eşitleniyor...'}</div>
            <div class="transient-desc">${isEn ? `Syncing current position (${timeStr}) with YouTube Watch History` : `Kaldığınız yer (${timeStr}) YouTube izleme geçmişinize kaydediliyor...`}</div>
          </div>
        `;
        if (typeof showPlayerTransientOverlay === 'function') {
          showPlayerTransientOverlay(loadingHtml, 3000);
        }
        try { lucide.createIcons(); } catch(e) {}

        try {
          const targetVideoId = videoId || currentPlayingVideoId;
          if (!targetVideoId) {
            showToast(isEn ? 'No active video found.' : 'Aktif video bulunamadı.', 'error');
            return;
          }
          const item = localDb?.history?.find(h => h.id === targetVideoId);
          const res = await fetch(`/api/video/${targetVideoId}/sync-watchtime`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              currentTime,
              title: item ? item.title : '',
              silent: false
            })
          });
          const data = await res.json();
          if (data.success) {
            const successHtml = `
              <div class="player-transient-card">
                <i data-lucide="check-circle" style="width: 36px; height: 36px; color: #4ade80;"></i>
                <div class="transient-title">${isEn ? 'Position Synced!' : 'YouTube Eşitlendi!'}</div>
                <div class="transient-desc">${isEn ? `Saved at ${timeStr} in your YouTube Watch History.` : `YouTube izleme geçmişinizde ${timeStr} olarak kaydedildi.`}</div>
              </div>
            `;
            if (typeof showPlayerTransientOverlay === 'function') {
              showPlayerTransientOverlay(successHtml, 3000);
            }
          } else {
            showToast(data.error || (isEn ? 'Failed to sync position.' : 'Eşitleme başarısız oldu.'), 'error');
          }
        } catch (err) {
          console.error('Watchtime sync error:', err);
          showToast(isEn ? 'Communication error.' : 'Sunucu ile iletişim hatası.', 'error');
        }
        try { lucide.createIcons(); } catch(e) {}
      };
    }

    // Subtitle Color & Opacity & Size bindings (Module)
    initSubtitleStyleControls();

    const btnRedownload = document.getElementById('inline-btn-redownload');
    if (btnRedownload) {
      const isCompleted = video && video.status === 'completed';
      if (isCompleted) {
        btnRedownload.style.display = 'inline-flex';
        btnRedownload.onclick = async () => {
          if (!confirm(localDb.settings?.lang === 'en' 
            ? 'Are you sure you want to delete this video and download it again from scratch?' 
            : 'Bu videoyu silip baştan indirmek istediğinizden emin misiniz?')) {
            return;
          }
          
          try {
            showToast(localDb.settings?.lang === 'en' ? 'Redownload triggered...' : 'Tekrar indirme başlatıldı...', 'info');
            const res = await fetch(`/api/history/${videoId}/redownload`, {
              method: 'POST'
            });
            const data = await res.json();
            if (data.success) {
              showToast(localDb.settings?.lang === 'en' ? 'Video queued for download.' : 'Video tekrar indirilmek üzere kuyruğa eklendi.', 'success');
              if (typeof closeInlinePlayer === 'function') {
                closeInlinePlayer();
              }
            } else {
              showToast(data.error || 'Hata oluştu.', 'error');
            }
          } catch (err) {
            showToast('Sunucu ile iletişim hatası.', 'error');
          }
        };
      } else {
        btnRedownload.style.display = 'none';
      }
    }

    // 5. Çalma listesini oluştur
    renderDownloadedPlaylist(videoId);

  } else {
    // Floating Modal player
    const inlineContainer = document.getElementById('downloaded-inline-player-container');
    const listContainer = document.getElementById('downloaded-list-container');
    if (inlineContainer) inlineContainer.classList.add('hidden');
    if (listContainer) listContainer.classList.remove('hidden');

    const modal = document.getElementById('player-modal');
    const titleEl = document.getElementById('player-modal-title');
    if (modal) {
      if (titleEl) {
        titleEl.textContent = videoTitle || 'Gömülü Video Oynatıcı';
      }
      
      const logoEl = document.getElementById('player-modal-logo');
      if (logoEl && videoChannelId) {
        logoEl.src = `/api/channels/${videoChannelId}/avatar`;
        logoEl.style.display = 'block';
        logoEl.style.cursor = 'pointer';
        logoEl.title = localDb.settings?.lang === 'en' ? 'Go to Channel Videos' : 'Kanala Git';
        logoEl.onclick = (e) => {
          e.preventDefault();
          window.open(`https://www.youtube.com/channel/${videoChannelId}/videos`, '_blank');
        };
        logoEl.onerror = function() {
          this.src = 'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2224%22 height=%2224%22><rect width=%2224%22 height=%2224%22 fill=%22%2316142a%22/><text x=%2250%25%22 y=%2250%25%22 dominant-baseline=%22middle%22 text-anchor=%22middle%22 fill=%22%2394a3b8%22 font-family=%22sans-serif%22 font-size=%2210%22>?</text></svg>';
        };
      } else if (logoEl) {
        logoEl.style.display = 'none';
        logoEl.style.cursor = 'default';
        logoEl.onclick = null;
      }

      const isShort = isShortVideo(videoDuration, videoTitle, videoChannelId);
      modal.classList.remove('hidden');
      resetAndApplyPlayerDimensions(isShort, false);

      const minBtn = document.getElementById('minimize-player-modal-btn');
      if (minBtn) {
        const icon = minBtn.querySelector('i') || minBtn.querySelector('[data-lucide]');
        if (icon) {
          icon.setAttribute('data-lucide', 'minus');
        }
        minBtn.title = localDb.settings && localDb.settings.lang === 'en' ? 'Minimize' : 'Küçült';
      }
      try {
        if (typeof lucide !== 'undefined') lucide.createIcons();
      } catch (e) {}

      playerContainer = modal.querySelector('.player-modal-body');
    }
  }

  if (currentRequestId !== activePlayRequestId) return;

  seekedForCurrentVideo = false;
  currentPlayingVideoId = videoId;
  if (typeof window !== 'undefined') window.currentPlayingVideoId = videoId;

  const isCompleted = video && video.status === 'completed';
  const isMissing = video && video.fileMissing === true;
  let streamUrl = `/api/video-stream?videoId=${videoId}`;

  // Eğer WPF Player (WebView2) içindeysek ve video indirilmesi tamamlanmış yerel bir video ise doğrudan sanal yerel disk yolunu kullan
  if (isCompleted && !isMissing && window.chrome?.webview && video.filePath) {
    const pathNormalized = video.filePath.replace(/\\/g, '/');
    const match = pathNormalized.match(/^([a-zA-Z]):\/(.*)$/);
    if (match) {
      const driveLetter = match[1].toLowerCase();
      const relativePath = match[2];
      const encodedPath = relativePath.split('/').map(seg => encodeURIComponent(seg)).join('/');
      streamUrl = `http://haytool-${driveLetter}.local/${encodedPath}`;
    } else {
      streamUrl = `file:///${encodeURI(pathNormalized)}`;
    }
  }

  const playRemote = !isCompleted || isMissing;

  if (playRemote) {
    if (playerContainer) {
      const autoplayVal = (forcePaused === true) ? '0' : '1';
      playerContainer.innerHTML = `<iframe src="https://www.youtube.com/embed/${videoId}?autoplay=${autoplayVal}" style="width: 100%; height: 100%; border: none; display: block;" allow="autoplay; encrypted-media" allowfullscreen></iframe>`;
    }
    videoPlayerInstance = null;
    if (forcePaused !== true) {
      sendPlayerActivity(true);
    }
  } else {
    if (playerContainer) {
      const autoplayAttr = (forcePaused === true) ? '' : 'autoplay';
      playerContainer.innerHTML = `<video id="embedded-video-player" controls ${autoplayAttr} style="width: 100%; height: 100%; display: block; outline: none;"></video>`;
    }

    if (playerType === 'plyr' && typeof Plyr === 'undefined') {
      console.error('[HaYTooL] Plyr kütüphanesi (Plyr) bulunamadı → HTML5 standart moda düşüldü.');
    }
    // Altyazıların arka plandan gelmesini bekle (yarış durumunu önler, Plyr altyazıları ilk anda tanır)
    try {
      await Promise.race([
        subFetchPromise,
        new Promise(resolve => setTimeout(resolve, 350))
      ]);
    } catch (e) {}

    const player = document.getElementById('embedded-video-player');
    if (player) {
      // Clear old track tags
      const oldTracks = player.querySelectorAll('track');
      oldTracks.forEach(t => t.remove());

      // Add track tags if available
      if (availableSubtitles && availableSubtitles.length > 0) {
        applySubtitlesToPlayer(availableSubtitles, player);
      }
    }

    if (playerType === 'plyr' && typeof Plyr !== 'undefined') {
      player.src = streamUrl;
      videoPlayerInstance = new Plyr('#embedded-video-player', {
        iconUrl: '/plyr.svg',
        controls: [
          'play-large', 'restart', 'rewind', 'play', 'fast-forward',
          'progress', 'current-time', 'duration', 'mute', 'volume',
          'captions', 'settings', 'pip', 'fullscreen'
        ],
        settings: ['captions', 'speed', 'loop'],
        captions: { active: true, update: true },
        speed: { selected: 1, options: [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2] }
      });

          videoPlayerInstance.on('ready', () => {
            adjustPlayerOrientation(videoPlayerInstance.media);
            if (videoPlayerInstance.duration) {
              drawSponsorSegmentsOnTimeline(videoPlayerInstance.duration, 'plyr');
            }
          });

          videoPlayerInstance.on('play', () => sendPlayerActivity(true));
          videoPlayerInstance.on('pause', () => {
            // Kullanıcı talebi: Video duraklatıldığında da Discord etkinliği devam etsin
            autoSyncWatchtimeHelper(currentPlayingVideoId, videoPlayerInstance.currentTime, true);
            window.savePlaybackPosition(currentPlayingVideoId, videoPlayerInstance.currentTime, videoPlayerInstance.duration, true);
          });
          videoPlayerInstance.on('ended', () => {
            sendPlayerActivity(false);
            autoSyncWatchtimeHelper(currentPlayingVideoId, videoPlayerInstance.currentTime, true);
            window.savePlaybackPosition(currentPlayingVideoId, 0, videoPlayerInstance.duration, true);
          });

          videoPlayerInstance.on('loadedmetadata', () => {
            adjustPlayerOrientation(videoPlayerInstance.media);
            if (videoPlayerInstance.duration) {
              drawSponsorSegmentsOnTimeline(videoPlayerInstance.duration, 'plyr');
            }
          });

          // Volume wheel control & Double click fullscreen
          const containerSelector = isInline ? '#downloaded-inline-player-container' : '#player-modal';
          const outerContainer = document.querySelector(containerSelector);
          const plyrContainer = outerContainer?.querySelector('.plyr');
          if (plyrContainer) {
            plyrContainer.addEventListener('wheel', (e) => {
              e.preventDefault();
              let currentVolume = videoPlayerInstance.volume;
              let newVolume;
              if (e.deltaY < 0) {
                newVolume = Math.min(1, currentVolume + 0.02);
              } else {
                newVolume = Math.max(0, currentVolume - 0.02);
              }
              videoPlayerInstance.volume = newVolume;
              if (typeof triggerVolumeHUD === 'function') {
                triggerVolumeHUD(newVolume);
              }
            }, { passive: false });

            plyrContainer.addEventListener('dblclick', (e) => {
              // Buton veya kontroller tıklandıysa yoksay
              if (e.target.closest('.plyr__controls') || e.target.closest('button') || e.target.closest('input')) return;
              e.preventDefault();
              if (videoPlayerInstance && typeof videoPlayerInstance.fullscreen?.toggle === 'function') {
                videoPlayerInstance.fullscreen.toggle();
              }
            });
          }

          videoPlayerInstance.on('timeupdate', () => {
            if (!currentPlayingVideoId) return;
            const currentTime = videoPlayerInstance.currentTime;

            if (localDb.settings && localDb.settings.sponsorBlockEnabled === true) {
              checkAndSkipSponsor(currentTime, videoPlayerInstance);
            }

            // Periyodik (her 30sn) YouTube izleme süresi senkronizasyonu
            autoSyncWatchtimeHelper(currentPlayingVideoId, currentTime, false);

            // Yerel kaldığı yer kaydı
            window.savePlaybackPosition(currentPlayingVideoId, currentTime, videoPlayerInstance.duration, false);
          });

          videoPlayerInstance.on('canplay', () => {
            if (!seekedForCurrentVideo && currentPlayingVideoId) {
              const item = (localDb.history || []).find(h => h.id === currentPlayingVideoId);
              const targetTime = (startSeconds !== null) ? startSeconds : (item?.lastPositionSeconds || (JSON.parse(localStorage.getItem('haytool_playback_resume') || '{}')[currentPlayingVideoId] || 0));
              if (targetTime > 3) {
                videoPlayerInstance.currentTime = targetTime;
                window.showResumeNotification(targetTime);
              }
              seekedForCurrentVideo = true;
            }
          });

          if (forcePaused === true) {
            videoPlayerInstance.pause();
          } else if (forcePaused === false) {
            videoPlayerInstance.play().catch(err => console.warn(err));
          } else {
            videoPlayerInstance.play().catch(err => {
              console.warn('Otomatik oynatma engellendi:', err);
            });
          }

          videoPlayerInstance.on('ended', () => {
            const isAutoplayEnabled = localStorage.getItem('inline-autoplay-enabled') === 'true';
            if (isAutoplayEnabled) {
              playNextVideoInPlaylist();
            }
          });
        } else {
          // HTML5 standard
          player.src = streamUrl;
          player.controls = true;
          videoPlayerInstance = player;

          player.addEventListener('dblclick', (e) => {
            e.preventDefault();
            if (!document.fullscreenElement) {
              player.requestFullscreen().catch(() => {});
            } else {
              document.exitFullscreen().catch(() => {});
            }
          });

          player.addEventListener('loadedmetadata', () => {
            adjustPlayerOrientation(player);
          });
          if (player.duration) {
            adjustPlayerOrientation(player);
          }

          player.addEventListener('wheel', (e) => {
            e.preventDefault();
            let currentVolume = player.volume;
            let newVolume;
            if (e.deltaY < 0) {
              newVolume = Math.min(1, currentVolume + 0.02);
            } else {
              newVolume = Math.max(0, currentVolume - 0.02);
            }
            player.volume = newVolume;
            if (typeof triggerVolumeHUD === 'function') {
              triggerVolumeHUD(newVolume);
            }
          }, { passive: false });

          player.addEventListener('timeupdate', () => {
            if (!currentPlayingVideoId) return;
            const currentTime = player.currentTime;

            if (localDb.settings && localDb.settings.sponsorBlockEnabled === true) {
              checkAndSkipSponsor(currentTime, player);
            }

            // Periyodik (her 30sn) YouTube izleme süresi senkronizasyonu
            autoSyncWatchtimeHelper(currentPlayingVideoId, currentTime, false);

            // Yerel kaldığı yer kaydı
            window.savePlaybackPosition(currentPlayingVideoId, currentTime, player.duration, false);
          });

          player.addEventListener('canplay', () => {
            if (!seekedForCurrentVideo && currentPlayingVideoId) {
              const item = (localDb.history || []).find(h => h.id === currentPlayingVideoId);
              const targetTime = (startSeconds !== null) ? startSeconds : (item?.lastPositionSeconds || (JSON.parse(localStorage.getItem('haytool_playback_resume') || '{}')[currentPlayingVideoId] || 0));
              if (targetTime > 3) {
                player.currentTime = targetTime;
                window.showResumeNotification(targetTime);
              }
              seekedForCurrentVideo = true;
            }
          });

          player.addEventListener('play', () => sendPlayerActivity(true));
          player.addEventListener('pause', () => {
            // Kullanıcı talebi: Video duraklatıldığında da Discord etkinliği devam etsin
            autoSyncWatchtimeHelper(currentPlayingVideoId, player.currentTime, true);
            window.savePlaybackPosition(currentPlayingVideoId, player.currentTime, player.duration, true);
          });
          player.addEventListener('ended', () => {
            sendPlayerActivity(false);
            autoSyncWatchtimeHelper(currentPlayingVideoId, player.currentTime, true);
            window.savePlaybackPosition(currentPlayingVideoId, 0, player.duration, true);
          });

          player.load();
          if (forcePaused === true) {
            player.pause();
          } else if (forcePaused === false) {
            player.play().catch(err => console.warn(err));
          } else {
            player.play().catch(err => {
              console.warn('Otomatik oynatma engellendi:', err);
            });
          }

          player.addEventListener('ended', () => {
            const isAutoplayEnabled = localStorage.getItem('inline-autoplay-enabled') === 'true';
            if (isAutoplayEnabled) {
              playNextVideoInPlaylist();
            }
          });
        }
      }
  } catch (err) {
    console.error('[playVideoEmbedded] HATA:', err);
  }
};

// Türkçe Açıklama: İndirilenler sekmesindeki yerleşik video oynatıcıyı kapatır, çalmakta olan videoyu durdurup kaynağını temizler.
/**
 * Yerleşik video oynatıcıyı kapatır ve çalmakta olan videoyu durdurur.
 * 
 * @returns {void}
 */
window.closeInlinePlayer = function(skipWatchSync = false) {
  const inlineContainer = document.getElementById('downloaded-inline-player-container');
  const listContainer = document.getElementById('downloaded-list-container');
  if (inlineContainer && inlineContainer.classList.contains('hidden')) {
    return;
  }

  // Otomatik izleme süresi senkronizasyonu (silme sırasında atlanır)
  if (!skipWatchSync && currentPlayingVideoId && localDb?.settings?.autoSyncWatchtime !== false) {
    let lastTime = 0;
    if (videoPlayerInstance && typeof videoPlayerInstance.currentTime === 'number') {
      lastTime = videoPlayerInstance.currentTime;
    } else {
      const v = document.querySelector('#inline-player-container video, #inline-player-body video');
      if (v) lastTime = v.currentTime || 0;
    }
    if (lastTime > 5) {
      fetch(`/api/video/${currentPlayingVideoId}/sync-watchtime`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentTime: lastTime, silent: true })
      }).catch(() => {});
    }
  }

  if (inlineContainer) inlineContainer.classList.add('hidden');
  if (listContainer) listContainer.classList.remove('hidden');

  cleanupAllPlayers();

  currentPlayingVideoId = null;
  seekedForCurrentVideo = false;
};

/**
 * Yerleşik oynatıcı çalma listesi sidebar sıralama butonlarının aktiflik ve yön durumlarını günceller.
 */
function updateSidebarSortButtons() {
  const btnDate = document.getElementById('inline-btn-sort-date');
  const btnSize = document.getElementById('inline-btn-sort-size');
  const btnUser = document.getElementById('inline-btn-sort-user');
  const txtDate = document.getElementById('inline-btn-sort-date-text');
  const txtSize = document.getElementById('inline-btn-sort-size-text');

  if (!btnDate || !btnSize) return;

  const isEn = localDb.settings?.lang === 'en';

  btnDate.classList.remove('active');
  btnSize.classList.remove('active');
  if (btnUser) btnUser.classList.remove('active');

  if (downloadedSortVal === 'user') {
    if (btnUser) btnUser.classList.add('active');
    if (txtDate) txtDate.textContent = isEn ? 'Date ▼' : 'Tarih ▼';
    if (txtSize) txtSize.textContent = isEn ? 'Size ▼' : 'Boyut ▼';
  } else if (downloadedSortVal.startsWith('date-')) {
    btnDate.classList.add('active');
    if (downloadedSortVal === 'date-asc') {
      if (txtDate) txtDate.textContent = isEn ? 'Date ▲' : 'Tarih ▲';
    } else {
      if (txtDate) txtDate.textContent = isEn ? 'Date ▼' : 'Tarih ▼';
    }
    if (txtSize) txtSize.textContent = isEn ? 'Size ▼' : 'Boyut ▼';
  } else if (downloadedSortVal.startsWith('size-')) {
    btnSize.classList.add('active');
    if (downloadedSortVal === 'size-asc') {
      if (txtSize) txtSize.textContent = isEn ? 'Size ▲' : 'Boyut ▲';
    } else {
      if (txtSize) txtSize.textContent = isEn ? 'Size ▼' : 'Boyut ▼';
    }
    if (txtDate) txtDate.textContent = isEn ? 'Date ▼' : 'Tarih ▼';
  }
}

// Türkçe Açıklama: Yerleşik oynatıcının sağ tarafındaki dikey oynatma listesinde indirilmiş diğer videoları kartlar halinde listeler.
/**
 * Yerleşik oynatıcı için çalma listesi sidebar içeriğini render eder.
 * 
 * @param {string} currentVideoId Aktif oynatılan video ID'si
 * @returns {void}
 */
function renderDownloadedPlaylist(currentVideoId) {
  const playlistGrid = document.getElementById('downloaded-playlist-grid');
  if (!playlistGrid) return;
  playlistGrid.innerHTML = '';

  const titleEl = document.getElementById('inline-sidebar-title');
  if (titleEl) {
    titleEl.textContent = currentLang === 'en' ? 'Downloads' : 'İndirilenler';
  }

  // Update sorting buttons state
  if (typeof updateSidebarSortButtons === 'function') {
    updateSidebarSortButtons();
  }

  // Update Shorts label text if exists
  const labelShortsText = document.getElementById('inline-label-shorts-text');
  if (labelShortsText) {
    labelShortsText.textContent = currentLang === 'en' ? 'Shorts' : 'Shorts';
  }

  let filteredDownloaded = localDb.history.filter(item => item.status === 'completed');
  if (downloadedFilterChannel !== 'all') {
    if (downloadedFilterChannel.startsWith('category:')) {
      const catId = parseInt(downloadedFilterChannel.split(':')[1], 10);
      const channelIdsInCat = (localDb.channels || []).filter(c => (c.categoryIds || [c.categoryId || 1]).includes(catId)).map(c => c.id);
      const channelIdsInCatSet = new Set(channelIdsInCat);
      filteredDownloaded = filteredDownloaded.filter(item => channelIdsInCatSet.has(item.channelId));
    } else {
      filteredDownloaded = filteredDownloaded.filter(item => item.channelId === downloadedFilterChannel);
    }
  }
  const showShorts = localDb.settings?.showShorts !== false;
  if (!showShorts) {
    filteredDownloaded = filteredDownloaded.filter(item => !isShortVideo(item.duration, item.title, item.channelId));
  }
  
  const sortVal = downloadedSortVal || 'date-desc';
  filteredDownloaded.sort((a, b) => {
    if (sortVal === 'user') {
      const customOrder = JSON.parse(localStorage.getItem('downloaded-user-order') || '[]');
      let indexA = customOrder.indexOf(a.id);
      let indexB = customOrder.indexOf(b.id);
      
      if (indexA === -1 && indexB === -1) {
        const dateA = new Date(a.publishedAt || a.downloadedAt || 0).getTime();
        const dateB = new Date(b.publishedAt || b.downloadedAt || 0).getTime();
        return dateB - dateA;
      }
      if (indexA === -1) return -1;
      if (indexB === -1) return 1;
      
      return indexA - indexB;
    } else if (sortVal.startsWith('size-')) {
      const sizeA = parseSizeToBytes(a.fileSize);
      const sizeB = parseSizeToBytes(b.fileSize);
      return sortVal === 'size-desc' ? sizeB - sizeA : sizeA - sizeB;
    } else {
      const dateA = new Date(a.publishedAt || a.downloadedAt || 0).getTime();
      const dateB = new Date(b.publishedAt || b.downloadedAt || 0).getTime();
      return sortVal === 'date-asc' ? dateA - dateB : dateB - dateA;
    }
  });

  if (filteredDownloaded.length === 0) {
    playlistGrid.innerHTML = `<p class="text-muted" style="font-size:0.8rem; padding: 10px;">${currentLang === 'en' ? 'No other videos found' : 'Başka video bulunamadı'}</p>`;
    return;
  }

  filteredDownloaded.forEach(item => {
    const isCurrent = item.id === currentVideoId;
    const itemEl = document.createElement('div');
    itemEl.className = `playlist-item${isCurrent ? ' active' : ''}`;
    itemEl.setAttribute('data-id', item.id);
    if (sortVal === 'user') {
      itemEl.setAttribute('draggable', 'true');
    }
    
    itemEl.onclick = () => {
      if (!isCurrent) {
        playVideoEmbedded(item.id);
      }
    };

    const durationHtml = item.duration ? `<span class="playlist-item-duration">${item.duration}</span>` : '';
    const playlistQualityHtml = item.actualQuality ? `<span class="playlist-item-quality quality-${item.actualQuality.toLowerCase()}">${item.actualQuality}</span>` : '';

    itemEl.innerHTML = `
      <div class="playlist-item-thumbnail-wrapper">
        <img class="playlist-item-thumbnail" src="/api/video/${item.id}/thumbnail" alt="${escapeHtml(item.title)}" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22100%22 height=%2256%22><rect width=%22100%22 height=%2256%22 fill=%22%2316142a%22/><text x=%2250%25%22 y=%2250%25%22 dominant-baseline=%22middle%22 text-anchor=%22middle%22 fill=%22%2394a3b8%22 font-family=%22sans-serif%22 font-size=%228%22>No Image</text></svg>'">
        ${playlistQualityHtml}
        ${durationHtml}
      </div>
      <div class="playlist-item-details">
        <h5 class="playlist-item-title" title="${escapeHtml(item.title)}">${escapeHtml(item.title)}</h5>
        <div class="playlist-item-channel" style="font-size:0.75rem; color:var(--text-muted); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${escapeHtml(item.channelName || '')} • ${item.fileSize || '-- MB'} • ${formatDate(item.publishedAt || item.downloadedAt)}">
          ${escapeHtml(item.channelName || '')} • ${item.fileSize || '-- MB'} • ${formatDate(item.publishedAt || item.downloadedAt)}
        </div>
      </div>
    `;
    playlistGrid.appendChild(itemEl);
  });
}

// Türkçe Açıklama: İndirilen video dosyasını işletim sisteminin (Windows) varsayılan medya oynatıcısında (VLC, Windows Media Player vb.) açar.
/**
 * Videoyu işletim sisteminin varsayılan medya oynatıcısında (VLC, KMPlayer vb.) çalıştırır.
 * 
 * @param {string} videoId Oynatılacak video ID'si
 */
window.playVideoSystem = async function(videoId) {
  try {
    showToast('Video oynatıcıda açılıyor...', 'info');
    const res = await fetch('/api/play-video', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ videoId })
    });
    const data = await res.json();
    if (!data.success) {
      showToast(data.error || 'Video oynatılamadı. Dosya taşınmış veya silinmiş olabilir.', 'error');
    }
  } catch (err) {
    showToast('Sunucu ile iletişim hatası.', 'error');
  }
};

// Türkçe Açıklama: Fare video kapağı üzerine geldiğinde yüksek çözünürlüklü (HQ) 7 farklı kapak karesi arasında 400ms aralıklarla akıcı geçiş yapar.
window.handleThumbMouseEnter = function(wrapperEl) {
  if (!wrapperEl || (window.dbSettings && window.dbSettings.enableAltThumbnailsHover === false)) return;
  const videoId = wrapperEl.getAttribute('data-video-id');
  if (!videoId) return;

  const imgEl = wrapperEl.querySelector('.video-thumbnail');
  if (!imgEl) return;

  if (!wrapperEl.dataset.origSrc) {
    wrapperEl.dataset.origSrc = imgEl.src;
  }

  // 4 Yüksek Çözünürlüklü (HQ/HD) kapak ve frame döngü listesi
  // Sıralama: Orijinal Kapak -> HQ Kare 1 -> HQ Kare 2 -> HQ Kare 3 -> Tekrar Başa (Orijinal Kapak)
  const altUrls = [
    wrapperEl.dataset.origSrc,
    `https://img.youtube.com/vi/${videoId}/hq1.jpg`,
    `https://img.youtube.com/vi/${videoId}/hq2.jpg`,
    `https://img.youtube.com/vi/${videoId}/hq3.jpg`
  ];

  // HD görselleri önceden yükle (Belirli bir kare açılmazsa otomatik orijinal resme düşer)
  altUrls.forEach((url, idx) => {
    if (idx === 0) return;
    const pImg = new Image();
    pImg.onerror = () => {
      altUrls[idx] = wrapperEl.dataset.origSrc;
    };
    pImg.src = url;
  });

  let currentIndex = 0;
  if (wrapperEl._thumbTimer) clearInterval(wrapperEl._thumbTimer);

  wrapperEl._thumbTimer = setInterval(() => {
    currentIndex = (currentIndex + 1) % altUrls.length;
    imgEl.src = altUrls[currentIndex];
  }, 666);
};

window.handleThumbMouseLeave = function(wrapperEl) {
  if (!wrapperEl) return;
  if (wrapperEl._thumbTimer) {
    clearInterval(wrapperEl._thumbTimer);
    wrapperEl._thumbTimer = null;
  }
  const imgEl = wrapperEl.querySelector('.video-thumbnail');
  if (imgEl && wrapperEl.dataset.origSrc) {
    imgEl.src = wrapperEl.dataset.origSrc;
    imgEl.style.opacity = '1';
  }
};

// Türkçe Açıklama: Arayüzdeki gömülü Plyr video oynatıcı modalını kapatır ve çalmakta olan videoyu durdurup kaynağını temizler.
/**
 * Gömülü video oynatıcı modalını kapatır ve çalmakta olan videoyu durdurur.
 */
window.closePlayerModal = function(skipWatchSync = false) {
  const modal = document.getElementById('player-modal');
  if (modal && modal.classList.contains('hidden')) {
    return;
  }

  // Otomatik izleme süresi senkronizasyonu (silme sırasında atlanır)
  if (!skipWatchSync && currentPlayingVideoId) {
    let lastTime = 0;
    if (videoPlayerInstance && typeof videoPlayerInstance.currentTime === 'number') {
      lastTime = videoPlayerInstance.currentTime;
    } else {
      const v = document.querySelector('#player-modal video, #embedded-video-player');
      if (v) lastTime = v.currentTime || 0;
    }
    autoSyncWatchtimeHelper(currentPlayingVideoId, lastTime, true);
  }

  if (modal) {
    modal.classList.add('hidden');
    modal.classList.remove('is-short-player');
    modal.classList.remove('minimized');
    
    // Reset position & dimensions to default bottom-right
    const modalContent = modal.querySelector('.player-modal-content');
    const modalBody = modal.querySelector('.player-modal-body');
    if (modalContent) {
      modalContent.style.left = '';
      modalContent.style.top = '';
      modalContent.style.bottom = '';
      modalContent.style.right = '';
      modalContent.style.width = '';
      modalContent.style.height = '';
    }
    if (modalBody) {
      modalBody.style.height = '';
      modalBody.style.aspectRatio = '';
    }
  }

  // Disconnect ResizeObserver
  if (playerResizeObserver) {
    playerResizeObserver.disconnect();
    playerResizeObserver = null;
  }
  cleanupAllPlayers();
  currentPlayingVideoId = null;
  seekedForCurrentVideo = false;
  
  const minBtn = document.getElementById('minimize-player-modal-btn');
  if (minBtn) {
    const icon = minBtn.querySelector('i') || minBtn.querySelector('[data-lucide]');
    if (icon) {
      icon.setAttribute('data-lucide', 'minus');
    }
  }
  lucide.createIcons();
};

// Türkçe Açıklama: Belirtilen video ID'sine ait YouTube izleme sayfasını tarayıcıda yeni bir sekmede açar.
/**
 * Belirtilen videonun YouTube sayfasını (varsa oynatıcıdaki mevcut zaman ile) tarayıcıda açar.
 * 
 * @param {string} videoId Açılacak video ID'si
 * @param {number} [currentSeconds] İsteğe bağlı zaman damgası (saniye)
 */
window.openYouTube = async function(videoId, currentSeconds) {
  let time = currentSeconds;
  if (time === undefined && currentPlayingVideoId === videoId) {
    if (videoPlayerInstance && typeof videoPlayerInstance.currentTime === 'number') {
      time = videoPlayerInstance.currentTime;
    } else if (videoPlayerInstance && videoPlayerInstance.video && typeof videoPlayerInstance.video.currentTime === 'number') {
      time = videoPlayerInstance.video.currentTime;
    } else {
      const v = document.querySelector('#inline-player-body video, #player-modal video, #embedded-video-player');
      if (v && typeof v.currentTime === 'number') {
        time = v.currentTime;
      }
    }
  }

  const timeNum = Number(time);
  const timeQuery = (!isNaN(timeNum) && timeNum > 3) ? `&t=${Math.floor(timeNum)}s` : '';
  const payload = { videoId };
  if (!isNaN(timeNum) && timeNum > 3) {
    payload.time = Math.floor(timeNum);
  }

  try {
    await fetch('/api/open-youtube', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  } catch (err) {
    window.open(`https://www.youtube.com/watch?v=${videoId}${timeQuery}`, '_blank');
  }
};

// Türkçe Açıklama: Seçilen videoyu geçmişten veya diskteki dosyasından silmek üzere kullanıcıya onay modalı (penceresi) gösterir.
/**
 * Geçmişten veya diskten video silmek için onay modalını açar.
 * 
 * @param {string} id Silinecek video ID'si
 */
function showDeleteModal(id) {
  const modal = deleteModal || document.getElementById('delete-modal');
  const msgEl = deleteModalMsg || document.getElementById('delete-modal-msg');
  const fileCb = deleteFileCheckbox || document.getElementById('delete-file-checkbox');
  const trimmedId = (typeof id === 'string') ? id.trim() : String(id || '').trim();
  if (!trimmedId) return;

  let item = (localDb.history || []).find(h => h.id === trimmedId);
  if (!item) {
    const cardTitleEl = document.querySelector(`[data-video-id="${trimmedId}"] .video-card-title, [data-video-id="${trimmedId}"] .queue-item-title, .video-card[data-id="${trimmedId}"] .video-card-title`);
    const fallbackTitle = cardTitleEl ? cardTitleEl.textContent.trim() : (document.getElementById('inline-player-title')?.textContent.trim() || trimmedId);
    item = { id: trimmedId, title: fallbackTitle };
  }
  if (!item || !modal) return;

  videoIdToDelete = trimmedId;
  const isEn = (localDb.settings && localDb.settings.lang === 'en') || (window.currentLang === 'en');
  if (msgEl) {
    msgEl.innerHTML = isEn 
      ? `Are you sure you want to remove <strong>"${escapeHtml(item.title)}"</strong> from download history?`
      : `<strong>"${escapeHtml(item.title)}"</strong> başlıklı videoyu geçmişten kaldırmak istediğinize emin misiniz?`;
  }
  
  // Bilgisayardan dosya silme kutusunu göster
  const checkboxContainers = modal.querySelectorAll('.checkbox-container');
  checkboxContainers.forEach(c => c.classList.remove('hidden'));
  if (fileCb) fileCb.checked = true;
  
  // YouTube'da izlendi olarak işaretleme tercihi (settings / localStorage)
  const markWatchedCb = markWatchedCheckbox || document.getElementById('mark-watched-checkbox');
  if (markWatchedCb) {
    let savedPreference = true;
    if (localDb.settings && typeof localDb.settings.markWatchedOnDelete === 'boolean') {
      savedPreference = localDb.settings.markWatchedOnDelete;
    } else {
      const stored = localStorage.getItem('haytool_mark_watched_on_delete');
      if (stored !== null) savedPreference = (stored === 'true');
    }
    markWatchedCb.checked = savedPreference;
  }

  // Kütüphanede gizleme tercihi (settings / localStorage)
  const hideLibraryCb = hideLibraryCheckbox || document.getElementById('hide-library-checkbox');
  if (hideLibraryCb) {
    let savedHide = true;
    if (localDb.settings && typeof localDb.settings.hideOnDelete === 'boolean') {
      savedHide = localDb.settings.hideOnDelete;
    } else {
      const stored = localStorage.getItem('haytool_hide_on_delete');
      if (stored !== null) savedHide = (stored === 'true');
    }
    hideLibraryCb.checked = savedHide;
  }

  modal.classList.remove('hidden');
}
window.showDeleteModal = showDeleteModal;

/**
 * Silme onay modalını kapatır ve seçili video ID'sini sıfırlar.
 */
function hideDeleteModal() {
  const modal = deleteModal || document.getElementById('delete-modal');
  if (modal) modal.classList.add('hidden');
  videoIdToDelete = null;
}

if (closeDeleteModalBtn) closeDeleteModalBtn.addEventListener('click', hideDeleteModal);
if (cancelDeleteBtn) cancelDeleteBtn.addEventListener('click', hideDeleteModal);

// Silme Onaylama Butonu Dinleyicisi
if (confirmDeleteBtn) {
  confirmDeleteBtn.addEventListener('click', async () => {
    if (!videoIdToDelete) return;
    
    const id = videoIdToDelete;
    const deleteFile = (deleteFileCheckbox || document.getElementById('delete-file-checkbox'))?.checked ?? true;
    const markWatchedCb = markWatchedCheckbox || document.getElementById('mark-watched-checkbox');
    const markWatched = markWatchedCb ? markWatchedCb.checked : false;
    const hideLibraryCb = hideLibraryCheckbox || document.getElementById('hide-library-checkbox');
    const hideOnDelete = hideLibraryCb ? hideLibraryCb.checked : (localDb.settings?.hideOnDelete !== false);

    // Tercihleri kalıcı olarak sakla
    localStorage.setItem('haytool_mark_watched_on_delete', String(markWatched));
    localStorage.setItem('haytool_hide_on_delete', String(hideOnDelete));
    let settingsChanged = false;
    if (localDb.settings) {
      if (localDb.settings.markWatchedOnDelete !== markWatched) {
        localDb.settings.markWatchedOnDelete = markWatched;
        settingsChanged = true;
      }
      if (localDb.settings.hideOnDelete !== hideOnDelete) {
        localDb.settings.hideOnDelete = hideOnDelete;
        settingsChanged = true;
      }
      if (settingsChanged) {
        try {
          fetch('/api/settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(localDb.settings)
          }).catch(() => {});
        } catch (e) {}
      }
    }

    hideDeleteModal();
    
    const isEn = (localDb.settings && localDb.settings.lang === 'en') || (window.currentLang === 'en');
    
    // 1. OYNATICIYI DERHAL VE KESİN OLARAK KAPAT
    const inlineContainer = document.getElementById('downloaded-inline-player-container');
    const isInlineOpen = inlineContainer && !inlineContainer.classList.contains('hidden');
    const playerModal = document.getElementById('player-modal');
    const isModalOpen = playerModal && !playerModal.classList.contains('hidden');
    const isMatchingPlayingVideo = (id === currentPlayingVideoId) || 
                                  (typeof window !== 'undefined' && window.currentPlayingVideoId && id === window.currentPlayingVideoId);

    // Sunucudaki açık video akış soketini derhal zorla kapatması için her durumda bildirim gönder
    fetch(`/api/video-stream/close?videoId=${id}`, { method: 'POST' }).catch(() => {});

    // Eğer silinen video o an oynatıcıda açıksa oynatıcıyı temizle ve kapat
    if (isMatchingPlayingVideo) {
      if (typeof window.closeInlinePlayer === 'function') {
        try { window.closeInlinePlayer(true); } catch(e) {}
      }
      if (inlineContainer) {
        inlineContainer.classList.add('hidden');
        const listContainer = document.getElementById('downloaded-list-container');
        if (listContainer) listContainer.classList.remove('hidden');
      }

      if (typeof window.closePlayerModal === 'function') {
        try { window.closePlayerModal(true); } catch(e) {}
      }
      if (playerModal) {
        playerModal.classList.add('hidden');
      }

      if (typeof window.cleanupAllPlayers === 'function') {
        try { window.cleanupAllPlayers(); } catch(e) {}
      }
      document.querySelectorAll('video, audio').forEach(v => {
        try { 
          v.pause(); 
          v.removeAttribute('src'); 
          v.src = ''; 
          if (typeof v.load === 'function') v.load();
        } catch(e) {}
      });

      currentPlayingVideoId = null;
      if (typeof window !== 'undefined') window.currentPlayingVideoId = null;

      // Dosya kilitlerinin Windows ve tarayıcı tarafından tamamen bırakılması için bekle
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    // 2. OPTİMİSTİK UI: Video kartını anında DOM'dan kaldır
    const itemIndex = (localDb.history || []).findIndex(h => h.id === id);
    let backupItem = null;
    if (itemIndex !== -1) {
      backupItem = localDb.history[itemIndex];
      localDb.history.splice(itemIndex, 1);
      if (typeof updateUI === 'function') {
        try {
          updateUI(localDb);
        } catch (uiErr) {
          console.error('Optimistic updateUI error:', uiErr);
        }
      }
    }
    
    try {
      const res = await fetch(`/api/history/${id}?deleteFile=${deleteFile}&markWatched=${markWatched}&hideOnDelete=${hideOnDelete}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (data.success) {
        showToast(isEn ? 'Video deleted successfully.' : 'Video başarıyla silindi.', 'success');
        if (typeof updateDiskSpace === 'function') setTimeout(updateDiskSpace, 1500);
        else if (window.updateDiskSpace) setTimeout(window.updateDiskSpace, 1500);
      } else {
        // Hata: Kartı geri getir
        if (backupItem) {
          localDb.history.push(backupItem);
          if (typeof updateUI === 'function') {
            try {
              updateUI(localDb);
            } catch (uiErr) {
              console.error('Rollback updateUI error:', uiErr);
            }
          }
        }
        showToast(data.error || (isEn ? 'Deletion failed.' : 'Silme işlemi başarısız oldu.'), 'error');
      }
    } catch (err) {
      console.error('Modal delete request error:', err);
      // Ağ hatası veya soket sıfırlanması durumunda veritabanını doğrula
      try {
        const checkRes = await fetch('/api/db');
        const checkDb = await checkRes.json();
        const stillCompleted = (checkDb.history || []).some(h => h.id === id && h.status === 'completed');
        if (!stillCompleted) {
          showToast(isEn ? 'Video deleted successfully.' : 'Video başarıyla silindi.', 'success');
          if (typeof updateDiskSpace === 'function') setTimeout(updateDiskSpace, 1000);
          return;
        }
      } catch (checkErr) {}

      // Gerçekten başarısız olduysa kartı geri getir
      if (backupItem) {
        localDb.history.push(backupItem);
        if (typeof updateUI === 'function') updateUI(localDb);
      }
      showToast(isEn ? 'Communication error.' : 'Sunucu ile iletişim hatası.', 'error');
    }
  });
}

// === FILTER PERSISTENCE SYSTEM (KÜTÜPHANE & İNDİRİLENLER) ===
function saveHistoryFilterState() {
  try {
    const durationSelect = document.getElementById('history-duration-filter');
    const dateSelect = document.getElementById('history-date-filter');
    const showShortsCb = document.getElementById('history-show-shorts');
    const showLiveCb = document.getElementById('history-show-live');
    const showMembersCb = document.getElementById('history-show-members');
    const noAutoDlCb = document.getElementById('history-only-no-auto-download');
    const notDownloadedCb = document.getElementById('history-only-not-downloaded');
    const onlyLiveProcessingCb = document.getElementById('history-only-live-processing');
    const showHiddenCb = document.getElementById('history-show-hidden');

    // Not: Kanal filtresi (historyFilterChannel) bilinçli olarak kalıcı duruma DAHIL EDILMEZ —
    // kullanici her acilista "Tum Kanallar" ile baslamak istiyor (kanal filtresine gerek yok).
    const state = {
      duration: durationSelect ? durationSelect.value : 'off',
      date: dateSelect ? dateSelect.value : (window.historyFilterDays || 'all'),
      showShorts: showShortsCb ? showShortsCb.checked : false,
      showLive: showLiveCb ? showLiveCb.checked : true,
      showMembers: showMembersCb ? showMembersCb.checked : (window.historyShowMembers !== false),
      noAutoDownload: noAutoDlCb ? noAutoDlCb.checked : !!window.historyOnlyNoAutoDownload,
      notDownloaded: notDownloadedCb ? notDownloadedCb.checked : !!window.historyOnlyNotDownloaded,
      onlyLiveProcessing: onlyLiveProcessingCb ? onlyLiveProcessingCb.checked : !!window.historyOnlyLiveProcessing,
      showHidden: showHiddenCb ? showHiddenCb.checked : !!window.historyShowHidden,
      viewMode: typeof historyViewMode !== 'undefined' ? historyViewMode : 'grid'
    };

    localStorage.setItem('haytool_history_filters_v2', JSON.stringify(state));

    // Configwin.ini kalıcılığı: hızlı filtre çipleri sunucuya da yazılır (kanal filtresi hariç)
    if (localDb && localDb.settings) {
      const iniPatch = {
        ...localDb.settings,
        showShorts: state.showShorts !== false,
        historyShowLive: state.showLive !== false,
        historyShowMembers: state.showMembers !== false,
        historyOnlyNoAutoDownload: !!state.noAutoDownload,
        historyOnlyNotDownloaded: !!state.notDownloaded,
        historyOnlyLiveProcessing: !!state.onlyLiveProcessing,
        historyShowHidden: !!state.showHidden
      };
      fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(iniPatch)
      }).catch(err => console.error('saveHistoryFilterState ini error:', err));
    }
  } catch (err) {
    console.error('saveHistoryFilterState error:', err);
  }
}
window.saveHistoryFilterState = saveHistoryFilterState;

function restoreHistoryFilterState() {
  try {
    // Configwin.ini / db.settings öncelikli görünüm modu (kullanıcı en son nasıl bıraktıysa)
    const dbViewMode = localDb.settings && localDb.settings.historyViewMode;
    if (dbViewMode === 'grid' || dbViewMode === 'list') {
      window.historyViewMode = dbViewMode;
      const viewGridBtn = document.getElementById('view-grid-btn');
      const viewListBtn = document.getElementById('view-list-btn');
      if (viewGridBtn && viewListBtn) {
        viewGridBtn.classList.toggle('active', dbViewMode === 'grid');
        viewListBtn.classList.toggle('active', dbViewMode === 'list');
      }
    }

    // Kütüphane sıralama (configwin.ini / db.settings öncelikli)
    const dbHistorySort = localDb.settings && localDb.settings.historySortMode;
    const storedHistorySort = localStorage.getItem('history-sort-val');
    if (dbHistorySort || storedHistorySort) {
      historySortMode = dbHistorySort || storedHistorySort || 'date-desc';
      window.historySortMode = historySortMode;
      const sortGroup = document.getElementById('history-sort-group');
      if (sortGroup) {
        sortGroup.querySelectorAll('.sort-btn').forEach(b => b.classList.toggle('active', b.getAttribute('data-sort') === historySortMode));
      }
    }

    // Configwin.ini / db.settings öncelikli hızlı filtre çipleri (kalıcılık INI üzerinden)
    const ini = localDb.settings || {};
    const iniHas = {
      noAutoDownload: ini.historyOnlyNoAutoDownload !== undefined,
      notDownloaded: ini.historyOnlyNotDownloaded !== undefined,
      onlyLiveProcessing: ini.historyOnlyLiveProcessing !== undefined,
      showMembers: ini.historyShowMembers !== undefined,
      showHidden: ini.historyShowHidden !== undefined
    };
    if (iniHas.noAutoDownload) window.historyOnlyNoAutoDownload = ini.historyOnlyNoAutoDownload;
    if (iniHas.notDownloaded) window.historyOnlyNotDownloaded = ini.historyOnlyNotDownloaded;
    if (iniHas.onlyLiveProcessing) window.historyOnlyLiveProcessing = ini.historyOnlyLiveProcessing;
    if (iniHas.showMembers) window.historyShowMembers = ini.historyShowMembers;
    if (iniHas.showHidden) window.historyShowHidden = ini.historyShowHidden;

    const raw = localStorage.getItem('haytool_history_filters_v2');
    if (!raw) return;
    const state = JSON.parse(raw);

    // Kanal filtresi bilinçli olarak geri yüklenmez — her açılışta "Tüm Kanallar" ile başlanır.
    const channelSelect = document.getElementById('history-channel-filter');
    if (channelSelect) channelSelect.value = 'all';
    window.historyFilterChannel = 'all';

    if (state.duration !== undefined) {
      const durationSelect = document.getElementById('history-duration-filter');
      if (durationSelect) durationSelect.value = state.duration;
      if (!localDb.settings) localDb.settings = {};
      localDb.settings.historyDurationFilter = state.duration;
    }

    if (state.date !== undefined) {
      window.historyFilterDays = state.date;
      const dateSelect = document.getElementById('history-date-filter');
      if (dateSelect) dateSelect.value = state.date;
    }

    // localStorage'daki değerler yalnızca INI'de tanımlı değilse uygulanır (INI öncelikli)
    if (state.noAutoDownload !== undefined && !iniHas.noAutoDownload) window.historyOnlyNoAutoDownload = !!state.noAutoDownload;
    if (state.notDownloaded !== undefined && !iniHas.notDownloaded) window.historyOnlyNotDownloaded = !!state.notDownloaded;
    if (state.showMembers !== undefined && !iniHas.showMembers) window.historyShowMembers = state.showMembers !== false;
    if (state.showHidden !== undefined && !iniHas.showHidden) window.historyShowHidden = !!state.showHidden;
    if (state.onlyLiveProcessing !== undefined && !iniHas.onlyLiveProcessing) window.historyOnlyLiveProcessing = !!state.onlyLiveProcessing;
    if (state.showShorts !== undefined) {
      if (!localDb.settings) localDb.settings = {};
      localDb.settings.showShorts = !!state.showShorts;
    }

    const checkMap = {
      'history-show-shorts': state.showShorts,
      'history-show-live': state.showLive,
      'history-show-members': window.historyShowMembers !== false,
      'history-only-no-auto-download': window.historyOnlyNoAutoDownload,
      'history-only-not-downloaded': window.historyOnlyNotDownloaded,
      'history-only-live-processing': window.historyOnlyLiveProcessing,
      'history-show-hidden': window.historyShowHidden
    };

    for (const [id, val] of Object.entries(checkMap)) {
      if (val !== undefined) {
        const cb = document.getElementById(id);
        if (cb) cb.checked = !!val;
        if (typeof syncFilterChipUI === 'function') syncFilterChipUI(id);
      }
    }

    if (typeof updateHistoryFiltersCount === 'function') updateHistoryFiltersCount();

    if (state.viewMode && !(localDb.settings && localDb.settings.historyViewMode)) {
      window.historyViewMode = state.viewMode;
      const viewGridBtn = document.getElementById('view-grid-btn');
      const viewListBtn = document.getElementById('view-list-btn');
      if (viewGridBtn && viewListBtn) {
        viewGridBtn.classList.toggle('active', state.viewMode === 'grid');
        viewListBtn.classList.toggle('active', state.viewMode === 'list');
      }
    }
  } catch (err) {
    console.error('restoreHistoryFilterState error:', err);
  }
}
window.restoreHistoryFilterState = restoreHistoryFilterState;

function saveDownloadedFilterState() {
  try {
    const channelSelect = document.getElementById('downloaded-channel-filter');
    const showShortsCb = document.getElementById('downloaded-show-shorts');
    const searchInput = document.getElementById('downloaded-search-input');

    // Boş string ("") asla kaydedilmemeli; tanımlı kanal yoksa 'all' varsayılan olmalı
    let chosenChannel = window.downloadedFilterChannel || (channelSelect ? channelSelect.value : 'all');
    if (!chosenChannel || chosenChannel.trim() === '') {
      chosenChannel = 'all';
    }

    const state = {
      channel: chosenChannel,
      sortVal: typeof downloadedSortVal !== 'undefined' ? downloadedSortVal : 'date-desc',
      showShorts: showShortsCb ? showShortsCb.checked : false,
      viewMode: typeof downloadedViewMode !== 'undefined' ? downloadedViewMode : 'grid',
      onlyResume: typeof downloadedOnlyPartiallyWatched !== 'undefined' ? !!downloadedOnlyPartiallyWatched : false,
      searchQuery: searchInput ? searchInput.value : ''
    };

    localStorage.setItem('haytool_downloaded_filters_v2', JSON.stringify(state));

    // Configwin.ini kalıcılığı: indirilenler filtre durumu sunucuya da yazılır
    // Aynı origin'deki tüm portlar (4141, EXE içi WebView2) bu alanları db.settings üzerinden okur.
    if (localDb && localDb.settings) {
      const iniPatch = {
        ...localDb.settings,
        downloadedFilterChannel: state.channel,
        downloadedSortMode: state.sortVal,
        downloadedShowShorts: state.showShorts,
        downloadedViewMode: state.viewMode,
        downloadedOnlyResume: state.onlyResume,
        downloadedSearchQuery: state.searchQuery
      };
      fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(iniPatch)
      }).catch(err => console.error('[HaYTooL] saveDownloadedFilterState ini hata:', err));
    }
  } catch (err) {
    console.error('saveDownloadedFilterState error:', err);
  }
}
window.saveDownloadedFilterState = saveDownloadedFilterState;

function restoreDownloadedFilterState() {
  try {
    // Configwin.ini / db.settings öncelikli görünüm modu ve sıralama
    const dbDlMode = localDb.settings && localDb.settings.downloadedViewMode;
    if (dbDlMode === 'grid' || dbDlMode === 'list') {
      window.downloadedViewMode = dbDlMode;
      const gridBtn = document.getElementById('downloaded-view-grid-btn');
      const listBtn = document.getElementById('downloaded-view-list-btn');
      if (gridBtn && listBtn) {
        gridBtn.classList.toggle('active', dbDlMode === 'grid');
        listBtn.classList.toggle('active', dbDlMode === 'list');
      }
    }
    if (localDb.settings && localDb.settings.downloadedSortMode) {
      window.downloadedSortVal = localDb.settings.downloadedSortMode;
      localStorage.setItem('downloaded-sort-val', localDb.settings.downloadedSortMode);
      const group = document.getElementById('downloaded-sort-group');
      if (group) {
        group.querySelectorAll('.sort-btn').forEach(b => b.classList.toggle('active', b.getAttribute('data-sort') === localDb.settings.downloadedSortMode));
      }
    }

    // configwin.ini öncelikli INI alanlarını oku (tüm portlarda + EXE'de kalıcı)
    const ini = localDb.settings || {};
    const hasValidIniChannel = ini.downloadedFilterChannel && typeof ini.downloadedFilterChannel === 'string' && ini.downloadedFilterChannel.trim() !== '' && ini.downloadedFilterChannel !== 'all';
    const iniHasDl = {
      channel: hasValidIniChannel,
      onlyResume: ini.downloadedOnlyResume !== undefined,
      showShorts: ini.downloadedShowShorts !== undefined,
      searchQuery: ini.downloadedSearchQuery !== undefined
    };

    // Kanal filtresi INI'den
    if (iniHasDl.channel) {
      window.downloadedFilterChannel = ini.downloadedFilterChannel;
      downloadedFilterChannel = ini.downloadedFilterChannel;
      const channelSelectEl = document.getElementById('downloaded-channel-filter');
      if (channelSelectEl) channelSelectEl.value = ini.downloadedFilterChannel;
    } else {
      window.downloadedFilterChannel = 'all';
      downloadedFilterChannel = 'all';
      const channelSelectEl = document.getElementById('downloaded-channel-filter');
      if (channelSelectEl) channelSelectEl.value = 'all';
    }

    // Yarım kalma filtresi INI'den
    if (iniHasDl.onlyResume) {
      downloadedOnlyPartiallyWatched = !!ini.downloadedOnlyResume;
      window.downloadedOnlyPartiallyWatched = downloadedOnlyPartiallyWatched;
      const resumeBtn = document.getElementById('downloaded-filter-resume-btn');
      if (resumeBtn) resumeBtn.classList.toggle('active', downloadedOnlyPartiallyWatched);
    }

    // Arama sorgusu INI'den
    if (iniHasDl.searchQuery && ini.downloadedSearchQuery) {
      const searchInput = document.getElementById('downloaded-search-input');
      if (searchInput && !searchInput.value) searchInput.value = ini.downloadedSearchQuery;
    }

    const raw = localStorage.getItem('haytool_downloaded_filters_v2');
    if (!raw) return;
    const state = JSON.parse(raw);

    // localStorage alanları yalnızca INI'de tanımlı değilse uygulanır
    const channelSelect = document.getElementById('downloaded-channel-filter');
    if (channelSelect && state.channel && state.channel.trim() !== '' && !iniHasDl.channel) {
      channelSelect.value = state.channel;
      window.downloadedFilterChannel = state.channel;
      downloadedFilterChannel = state.channel;
    }

    if (state.sortVal && !(localDb.settings && localDb.settings.downloadedSortMode)) {
      window.downloadedSortVal = state.sortVal;
      localStorage.setItem('downloaded-sort-val', state.sortVal);
      const group = document.getElementById('downloaded-sort-group');
      if (group) {
        group.querySelectorAll('.sort-btn').forEach(b => {
          b.classList.toggle('active', b.getAttribute('data-sort') === state.sortVal);
        });
      }
    }

    const showShortsCb = document.getElementById('downloaded-show-shorts');
    const inlineCb = document.getElementById('inline-playlist-show-shorts');
    const dbHasShowShorts = localDb.settings && localDb.settings.showShorts !== undefined;
    const finalShowShorts = dbHasShowShorts ? !!localDb.settings.showShorts : (state.showShorts !== undefined ? !!state.showShorts : false);

    if (showShortsCb) showShortsCb.checked = finalShowShorts;
    if (inlineCb) inlineCb.checked = finalShowShorts;
    if (!localDb.settings) localDb.settings = {};
    localDb.settings.showShorts = finalShowShorts;

    if (state.viewMode && !(localDb.settings && localDb.settings.downloadedViewMode)) {
      window.downloadedViewMode = state.viewMode;
      const gridBtn = document.getElementById('downloaded-view-grid-btn');
      const listBtn = document.getElementById('downloaded-view-list-btn');
      if (gridBtn && listBtn) {
        gridBtn.classList.toggle('active', state.viewMode === 'grid');
        listBtn.classList.toggle('active', state.viewMode === 'list');
      }
    }

    if (state.onlyResume !== undefined && !iniHasDl.onlyResume) {
      downloadedOnlyPartiallyWatched = !!state.onlyResume;
      window.downloadedOnlyPartiallyWatched = downloadedOnlyPartiallyWatched;
      const resumeBtn = document.getElementById('downloaded-filter-resume-btn');
      if (resumeBtn) {
        resumeBtn.classList.toggle('active', downloadedOnlyPartiallyWatched);
      }
    }

    // Arama sorgusu localStorage'dan (INI yoksa)
    if (state.searchQuery && !iniHasDl.searchQuery) {
      const searchInput = document.getElementById('downloaded-search-input');
      if (searchInput && !searchInput.value) searchInput.value = state.searchQuery;
    }
  } catch (err) {
    console.error('restoreDownloadedFilterState error:', err);
  }
}
window.restoreDownloadedFilterState = restoreDownloadedFilterState;

// Kütüphane Sıralama Butonları Dinleyicisi
const historySortGroup = document.getElementById('history-sort-group');
if (historySortGroup) {
  historySortGroup.addEventListener('click', (e) => {
    const btn = e.target.closest('.sort-btn');
    if (!btn) return;
    const sortVal = btn.getAttribute('data-sort');
    if (!sortVal) return;
    historySortMode = sortVal;
    localStorage.setItem('history-sort-val', historySortMode);
    historySortGroup.querySelectorAll('.sort-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    persistHistorySortMode();
    updateUI(localDb);
  });
}

if (viewGridBtn) {
  viewGridBtn.addEventListener('click', () => {
    historyViewMode = 'grid';
    saveHistoryFilterState();    // Görünüm modunu db.settings + configwin.ini'ye kalıcı kaydet
    if (localDb.settings) {
      localDb.settings.historyViewMode = 'grid';
      fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(localDb.settings)
      }).catch(() => {});
    }
    updateUI(localDb);
  });
}

if (viewListBtn) {
  viewListBtn.addEventListener('click', () => {
    historyViewMode = 'list';
    saveHistoryFilterState();
    if (localDb.settings) {
      localDb.settings.historyViewMode = 'list';
      fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(localDb.settings)
      }).catch(() => {});
    }
    updateUI(localDb);
  });
}

if (historyChannelFilter) {
  historyChannelFilter.addEventListener('change', () => {
    historyFilterChannel = historyChannelFilter.value;
    saveHistoryFilterState();
    updateUI(localDb);
  });
}

// Hızlı Tarih Filtreleme Seçim Dinleyicisi
if (historyDateFilter) {
  historyDateFilter.addEventListener('change', () => {
    historyFilterDays = historyDateFilter.value;
    saveHistoryFilterState();
    updateUI(localDb);
  });
}

const historyClearDateFilterBtn = document.getElementById('history-clear-date-filter');
if (historyClearDateFilterBtn) {
  historyClearDateFilterBtn.addEventListener('click', () => {
    if (historyDateFilter) {
      historyDateFilter.value = 'all';
    }
    historyFilterDays = 'all';
    saveHistoryFilterState();
    updateUI(localDb);
  });
}

if (downloadedViewGridBtn) {
  downloadedViewGridBtn.addEventListener('click', () => {
    downloadedViewMode = 'grid';
    saveDownloadedFilterState();
    if (localDb.settings) {
      localDb.settings.downloadedViewMode = 'grid';
      fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(localDb.settings)
      }).catch(() => {});
    }
    updateUI(localDb);
  });
}

if (downloadedViewListBtn) {
  downloadedViewListBtn.addEventListener('click', () => {
    downloadedViewMode = 'list';
    saveDownloadedFilterState();
    if (localDb.settings) {
      localDb.settings.downloadedViewMode = 'list';
      fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(localDb.settings)
      }).catch(() => {});
    }
    updateUI(localDb);
  });
}

if (downloadedChannelFilter) {
  downloadedChannelFilter.addEventListener('change', () => {
    downloadedFilterChannel = downloadedChannelFilter.value;
    saveDownloadedFilterState();
    updateUI(localDb);
  });
}

// Sıralama Butonları Dinleyicisi
let downloadedSortVal = localStorage.getItem('downloaded-sort-val') || 'date-desc';

// Türkçe Açıklama: İndirilenler sıralama tercihini db.settings + configwin.ini'ye kalıcı kaydeder.
function persistDownloadedSortMode() {
  if (localDb.settings) {
    localDb.settings.downloadedSortMode = downloadedSortVal;
    fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(localDb.settings)
    }).catch(() => {});
  }
}

document.addEventListener('click', (e) => {
  const btn = e.target.closest('.sort-btn');
  if (btn && btn.closest('#downloaded-sort-group')) {
    const sortVal = btn.getAttribute('data-sort');
    downloadedSortVal = sortVal;
    localStorage.setItem('downloaded-sort-val', downloadedSortVal);
    saveDownloadedFilterState();
    persistDownloadedSortMode();
    
    // Aktif sınıfını güncelle
    const group = document.getElementById('downloaded-sort-group');
    if (group) {
      group.querySelectorAll('.sort-btn').forEach(b => b.classList.remove('active'));
    }
    btn.classList.add('active');
    
    updateUI(localDb);
  }
});

// Shorts Göster/Gizle Değiştiğinde Sunucuya Kaydet
document.addEventListener('DOMContentLoaded', () => {
  const savedLang = localStorage.getItem('haytool_user_lang');
  if (savedLang) {
    applyLanguage(savedLang);
  }
  restoreHistoryFilterState();
  restoreDownloadedFilterState();

  const historyOnlyNoAutoDownloadCheck = document.getElementById('history-only-no-auto-download');
  if (historyOnlyNoAutoDownloadCheck) {
    historyOnlyNoAutoDownloadCheck.addEventListener('change', () => {
      historyOnlyNoAutoDownload = historyOnlyNoAutoDownloadCheck.checked;
      syncFilterChipUI('history-only-no-auto-download');
      saveHistoryFilterState();
      updateUI(localDb);
    });
  }

  const historyOnlyNotDownloadedCheck = document.getElementById('history-only-not-downloaded');
  if (historyOnlyNotDownloadedCheck) {
    historyOnlyNotDownloadedCheck.addEventListener('change', () => {
      historyOnlyNotDownloaded = historyOnlyNotDownloadedCheck.checked;
      syncFilterChipUI('history-only-not-downloaded');
      saveHistoryFilterState();
      updateUI(localDb);
    });
  }

  const historyOnlyLiveProcessingCheck = document.getElementById('history-only-live-processing');
  if (historyOnlyLiveProcessingCheck) {
    historyOnlyLiveProcessingCheck.addEventListener('change', () => {
      window.historyOnlyLiveProcessing = historyOnlyLiveProcessingCheck.checked;
      syncFilterChipUI('history-only-live-processing');
      saveHistoryFilterState();
      updateUI(localDb);
    });
  }

  const historyShowMembersCheck = document.getElementById('history-show-members');
  if (historyShowMembersCheck) {
    historyShowMembersCheck.addEventListener('change', () => {
      window.historyShowMembers = historyShowMembersCheck.checked;
      syncFilterChipUI('history-show-members');
      saveHistoryFilterState();
      updateUI(localDb);
    });
  }

  const historyShowHiddenCheck = document.getElementById('history-show-hidden');
  if (historyShowHiddenCheck) {
    historyShowHiddenCheck.addEventListener('change', () => {
      historyShowHidden = historyShowHiddenCheck.checked;
      syncFilterChipUI('history-show-hidden');
      saveHistoryFilterState();
      updateUI(localDb);
    });
  }


  const historyShowShorts = document.getElementById('history-show-shorts');
  if (historyShowShorts) {
    historyShowShorts.addEventListener('change', async () => {
      const showShorts = historyShowShorts.checked;

      if (!localDb.settings) localDb.settings = {};
      localDb.settings.showShorts = showShorts;

      const dlCheckbox = document.getElementById('downloaded-show-shorts');
      if (dlCheckbox) dlCheckbox.checked = showShorts;

      const inlineCheckbox = document.getElementById('inline-playlist-show-shorts');
      if (inlineCheckbox) inlineCheckbox.checked = showShorts;

      const settCheckbox = document.getElementById('settings-showshorts');
      if (settCheckbox) settCheckbox.checked = showShorts;

      syncFilterChipUI('history-show-shorts');
      if (typeof updateHistoryFiltersCount === 'function') updateHistoryFiltersCount();
      if (typeof saveHistoryFilterState === 'function') saveHistoryFilterState();
      if (typeof saveDownloadedFilterState === 'function') saveDownloadedFilterState();

      updateUI(localDb);
      if (currentPlayingVideoId && typeof renderDownloadedPlaylist === 'function') {
        renderDownloadedPlaylist(currentPlayingVideoId);
      }

      try {
        const res = await fetch('/api/settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...localDb.settings, showShorts })
        });
        const data = await res.json();
        if (data.success) {
          showToast(showShorts ? 'Shorts videoları gösteriliyor.' : 'Shorts videoları gizlendi.', 'success');
        }
      } catch (err) {
        showToast('Ayarlar kaydedilemedi.', 'error');
      }
    });
  }

  const downloadedShowShorts = document.getElementById('downloaded-show-shorts');
  if (downloadedShowShorts) {
    downloadedShowShorts.addEventListener('change', async () => {
      const showShorts = downloadedShowShorts.checked;
      
      if (!localDb.settings) localDb.settings = {};
      localDb.settings.showShorts = showShorts;
      
      const inlineCheckbox = document.getElementById('inline-playlist-show-shorts');
      if (inlineCheckbox) inlineCheckbox.checked = showShorts;

      const histCheckbox = document.getElementById('history-show-shorts');
      if (histCheckbox) {
        histCheckbox.checked = showShorts;
        syncFilterChipUI('history-show-shorts');
        if (typeof updateHistoryFiltersCount === 'function') updateHistoryFiltersCount();
      }

      const settCheckbox = document.getElementById('settings-showshorts');
      if (settCheckbox) settCheckbox.checked = showShorts;

      if (typeof saveDownloadedFilterState === 'function') saveDownloadedFilterState();
      if (typeof saveHistoryFilterState === 'function') saveHistoryFilterState();
      updateUI(localDb);
      if (currentPlayingVideoId && typeof renderDownloadedPlaylist === 'function') {
        renderDownloadedPlaylist(currentPlayingVideoId);
      }
      
      try {
        const res = await fetch('/api/settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...localDb.settings, showShorts })
        });
        const data = await res.json();
        if (data.success) {
          showToast(showShorts ? 'Shorts videoları gösteriliyor.' : 'Shorts videoları gizlendi.', 'success');
        }
      } catch (err) {
        showToast('Ayarlar kaydedilemedi.', 'error');
      }
    });
  }

  // Playlist Sidebar Sıralama Butonları Dinleyicileri
  const btnSortDate = document.getElementById('inline-btn-sort-date');
  if (btnSortDate) {
    btnSortDate.addEventListener('click', () => {
      if (downloadedSortVal === 'date-desc') {
        downloadedSortVal = 'date-asc';
      } else {
        downloadedSortVal = 'date-desc';
      }
      localStorage.setItem('downloaded-sort-val', downloadedSortVal);
      persistDownloadedSortMode();
      // UI güncelle
      updateUI(localDb);
      if (currentPlayingVideoId && typeof renderDownloadedPlaylist === 'function') {
        renderDownloadedPlaylist(currentPlayingVideoId);
      }
    });
  }

  const btnSortSize = document.getElementById('inline-btn-sort-size');
  if (btnSortSize) {
    btnSortSize.addEventListener('click', () => {
      if (downloadedSortVal === 'size-desc') {
        downloadedSortVal = 'size-asc';
      } else {
        downloadedSortVal = 'size-desc';
      }
      localStorage.setItem('downloaded-sort-val', downloadedSortVal);
      persistDownloadedSortMode();
      // UI güncelle
      updateUI(localDb);
      if (currentPlayingVideoId && typeof renderDownloadedPlaylist === 'function') {
        renderDownloadedPlaylist(currentPlayingVideoId);
      }
    });
  }

  const btnSortUser = document.getElementById('inline-btn-sort-user');
  if (btnSortUser) {
    btnSortUser.addEventListener('click', () => {
      downloadedSortVal = 'user';
      localStorage.setItem('downloaded-sort-val', downloadedSortVal);
      persistDownloadedSortMode();
      // UI güncelle
      updateUI(localDb);
      if (currentPlayingVideoId && typeof renderDownloadedPlaylist === 'function') {
        renderDownloadedPlaylist(currentPlayingVideoId);
      }
    });
  }

  // Playlist Sidebar Shorts Göster/Gizle Dinleyicisi
  const inlinePlaylistShowShorts = document.getElementById('inline-playlist-show-shorts');
  if (inlinePlaylistShowShorts) {
    inlinePlaylistShowShorts.addEventListener('change', async () => {
      const showShorts = inlinePlaylistShowShorts.checked;
      
      // Local state'i ve normal checkbox'ı güncelle
      if (!localDb.settings) localDb.settings = {};
      localDb.settings.showShorts = showShorts;
      
      const normalCheckbox = document.getElementById('downloaded-show-shorts');
      if (normalCheckbox) {
        normalCheckbox.checked = showShorts;
      }

      const histCheckbox = document.getElementById('history-show-shorts');
      if (histCheckbox) {
        histCheckbox.checked = showShorts;
        syncFilterChipUI('history-show-shorts');
        if (typeof updateHistoryFiltersCount === 'function') updateHistoryFiltersCount();
      }

      const settCheckbox = document.getElementById('settings-showshorts');
      if (settCheckbox) settCheckbox.checked = showShorts;

      if (typeof saveDownloadedFilterState === 'function') saveDownloadedFilterState();
      if (typeof saveHistoryFilterState === 'function') saveHistoryFilterState();
      
      // UI'yı yerel olarak güncelle
      updateUI(localDb);
      if (currentPlayingVideoId && typeof renderDownloadedPlaylist === 'function') {
        renderDownloadedPlaylist(currentPlayingVideoId);
      }
      
      try {
        const res = await fetch('/api/settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...localDb.settings, showShorts })
        });
        const data = await res.json();
        if (data.success) {
          showToast(showShorts ? 'Shorts videoları gösteriliyor.' : 'Shorts videoları gizlendi.', 'success');
        }
      } catch (err) {
        showToast('Ayarlar kaydedilemedi.', 'error');
      }
    });
  }
});

// Aktif İndirme ve Kuyruk İptal/Yönetim fonksiyonları ./modules/queue.js modülünden içe aktarılmıştır.

// Aktif İndirme İptal Butonu Dinleyicisi
document.addEventListener('DOMContentLoaded', () => {
  const cancelActiveBtn = document.getElementById('cancel-active-btn');
  if (cancelActiveBtn) {
    cancelActiveBtn.addEventListener('click', () => {
      const activeDownload = localDb.history.find(h => h.status === 'downloading');
      const activeMerging = localDb.history.find(h => h.status === 'merging');
      const target = activeDownload || activeMerging;
      if (target) {
        cancelDownload(target.id);
      } else {
        showToast('Şu anda aktif bir işlem bulunmuyor.', 'info');
      }
    });
  }

  // Türkçe Açıklama: Ayarlar sayfasında alt sekmeler arasında tıklama ile geçiş yapılmasını ve ilgili ayar gruplarının görüntülenmesini sağlar.
  const settingsTabBtns = document.querySelectorAll('.settings-tab-btn');
  settingsTabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      settingsTabBtns.forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.settings-subtab-content').forEach(c => c.classList.remove('active'));
      
      btn.classList.add('active');
      const targetSubtab = btn.getAttribute('data-subtab');
      const targetContent = document.getElementById(`subtab-${targetSubtab}`);
      if (targetContent) {
        targetContent.classList.add('active');
      }
    });
  });
});

// updateDiskSpace fonksiyonu ./modules/systemStatus.js modülünden içe aktarılmıştır.

// Hava durumu fonksiyonları (updateWeatherBadge, initWeatherPopoverEvents) ./modules/weather.js modülünden içe aktarılmıştır.

// Türkçe Açıklama: Hava durumu ayarları ve kontrolleri
document.addEventListener('DOMContentLoaded', () => {
  initWeatherPopoverEvents();

  const weatherToggle = document.getElementById('settings-weatherenabled');
  if (weatherToggle) {
    weatherToggle.addEventListener('change', () => {
      const details = document.getElementById('weather-settings-details');
      if (details) details.style.display = weatherToggle.checked ? 'block' : 'none';
      const badge = document.getElementById('badge-weather');
      if (badge) badge.style.display = weatherToggle.checked ? 'inline-flex' : 'none';
    });
  }

  // Şehir Arama Butonu
  const btnWeatherSearch = document.getElementById('btn-weather-search');
  const cityInput = document.getElementById('settings-weathercity');
  const suggestionsBox = document.getElementById('weather-city-suggestions');

  async function performCitySearch() {
    if (!cityInput || !suggestionsBox) return;
    const query = cityInput.value.trim();
    if (!query || query.length < 2) {
      showToast('Lütfen en az 2 karakterli bir şehir adı girin.', 'warning');
      return;
    }

    try {
      suggestionsBox.innerHTML = '<div style="padding: 8px 12px; color: var(--text-muted); font-size: 0.8rem;">Aranıyor...</div>';
      suggestionsBox.classList.remove('hidden');

      const res = await fetch(`/api/weather/geocode?query=${encodeURIComponent(query)}`);
      const data = await res.json();
      
      if (!data.results || data.results.length === 0) {
        suggestionsBox.innerHTML = '<div style="padding: 8px 12px; color: var(--text-muted); font-size: 0.8rem;">Sonuç bulunamadı.</div>';
        return;
      }

      suggestionsBox.innerHTML = '';
      data.results.forEach(item => {
        const row = document.createElement('div');
        row.style.padding = '8px 12px';
        row.style.cursor = 'pointer';
        row.style.fontSize = '0.85rem';
        row.style.borderBottom = '1px solid rgba(255,255,255,0.05)';
        row.style.color = 'var(--text-main)';
        row.style.transition = 'background 0.2s';
        row.innerHTML = `<strong>${item.name}</strong> <span style="color: var(--text-muted); font-size: 0.75rem;">(${item.admin1 ? item.admin1 + ', ' : ''}${item.country})</span> <span style="float: right; color: #00f2fe; font-size: 0.75rem;">${item.latitude.toFixed(2)}, ${item.longitude.toFixed(2)}</span>`;

        row.addEventListener('mouseenter', () => { row.style.background = 'rgba(255,255,255,0.08)'; });
        row.addEventListener('mouseleave', () => { row.style.background = 'transparent'; });

        row.addEventListener('click', () => {
          cityInput.value = item.name;
          const latInput = document.getElementById('settings-weatherlatitude');
          const lonInput = document.getElementById('settings-weatherlongitude');
          if (latInput) latInput.value = item.latitude;
          if (lonInput) lonInput.value = item.longitude;
          suggestionsBox.classList.add('hidden');

          if (typeof triggerAutoSave === 'function') {
            triggerAutoSave(true);
          }
        });

        suggestionsBox.appendChild(row);
      });
    } catch (err) {
      suggestionsBox.innerHTML = '<div style="padding: 8px 12px; color: var(--danger-color); font-size: 0.8rem;">Arama başarısız oldu.</div>';
    }
  }

  if (btnWeatherSearch) {
    btnWeatherSearch.addEventListener('click', performCitySearch);
  }
  if (cityInput) {
    cityInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        performCitySearch();
      }
    });
  }

  // Dışarı tıklandığında öneri kutusunu kapat
  document.addEventListener('click', (e) => {
    if (suggestionsBox && !suggestionsBox.contains(e.target) && e.target !== btnWeatherSearch && e.target !== cityInput) {
      suggestionsBox.classList.add('hidden');
    }
  });

  // GPS Butonu
  const btnWeatherGps = document.getElementById('btn-weather-gps');
  if (btnWeatherGps) {
    btnWeatherGps.addEventListener('click', () => {
      if (!navigator.geolocation) {
        showToast('Tarayıcınız konum servisini desteklemiyor.', 'warning');
        return;
      }

      showToast('Mevcut GPS konumu alınıyor...', 'info');
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = parseFloat(pos.coords.latitude.toFixed(4));
          const lon = parseFloat(pos.coords.longitude.toFixed(4));
          const latInput = document.getElementById('settings-weatherlatitude');
          const lonInput = document.getElementById('settings-weatherlongitude');
          if (latInput) latInput.value = lat;
          if (lonInput) lonInput.value = lon;

          showToast(`Konum alındı: ${lat}, ${lon}`, 'success');
          if (typeof triggerAutoSave === 'function') {
            triggerAutoSave(true);
          }
        },
        (err) => {
          showToast('GPS konumu alınamadı. Lütfen tarayıcı konum iznini kontrol edin veya şehir arayın.', 'error');
        },
        { timeout: 10000 }
      );
    });
  }
});

// triggerChannelSearch, closeChannelSearchResults, followChannelFromSearch, updateChannelCategoryFilterOptions, handleChannelFilterChange → ./modules/channels.js

// Türkçe Açıklama: Sağ üst köşedeki sistem durumu ikonuna tıklandığında disk/çerez durumu özet menüsünün açılıp kapanmasını sağlar.
/**
 * Sistem durumu açılır kutusunun (dropdown) görünürlüğünü değiştirir.
 * 
 * @param {Event} e Olay nesnesi
 */
window.toggleStatusDropdown = function(e) {
  if (e) e.stopPropagation();
  const dropdown = document.getElementById('status-dropdown');
  if (dropdown) {
    dropdown.classList.toggle('hidden');
  }
};

// Dışarı tıklanınca dropdown menüyü kapat
window.addEventListener('click', (e) => {
  const dropdown = document.getElementById('status-dropdown');
  const summary = document.querySelector('.status-summary');
  if (dropdown && !dropdown.classList.contains('hidden')) {
    if (!dropdown.contains(e.target) && !summary.contains(e.target)) {
      dropdown.classList.add('hidden');
    }
  }
});

// Kuyruk görünümü, sürükle-bırak sıralama, hız limitleri ve hata yönetimi fonksiyonları ./modules/queue.js modülünden içe aktarılmıştır.

// initCustomSelect ve setCustomSelectValue fonksiyonları ./modules/uiDropdowns.js modülünden içe aktarılmıştır.


async function installPythonDependencies() {
  const isEn = localDb.settings && localDb.settings.lang === 'en';
  const btn = document.getElementById('btn-install-pip-deps');
  if (btn) btn.disabled = true;
  
  showToast(isEn ? 'Installing pip dependencies (yt-dlp)...' : 'pip bağımlılıkları (yt-dlp) kuruluyor...', 'info');
  
  try {
    const res = await fetch('/api/settings/install-python-dep', { method: 'POST' });
    const data = await res.json();
    if (res.ok && data.success) {
      showToast(isEn ? 'Dependencies installed successfully!' : 'Bağımlılıklar başarıyla kuruldu/güncellendi!', 'success');
    } else {
      showToast(data.error || (isEn ? 'Installation failed.' : 'Kurulum başarısız oldu.'), 'error');
    }
  } catch (err) {
    showToast(isEn ? 'Connection error.' : 'Bağlantı hatası.', 'error');
  } finally {
    if (btn) btn.disabled = false;
  }
}
window.installPythonDependencies = installPythonDependencies;
// FFmpeg Installer Logic & Event Listeners are modularized in public/modules/ffmpeg.js
initFfmpegEvents();

// Başlangıç
connectSSE();
initCustomSelect();
checkFfmpegStatus();
updateDiskSpace();
updateWeatherBadge();
loadAppVersion();
checkApplicationUpdates();
setInterval(updateDiskSpace, 60 * 60 * 1000); // Her 60 dakikada bir güncelle
setInterval(() => updateWeatherBadge(), 15 * 60 * 1000); // Her 15 dakikada bir hava durumunu güncelle

// Türkçe Açıklama: Sayfa yüklendiğinde mevcut URL path'ine göre doğru sekmeyi aktif ediyoruz.
const currentPath = window.location.pathname;
const initialTab = pathTabMap[currentPath] || 'history';
history.replaceState({ tab: initialTab }, '', currentPath === '/' ? '/home' : currentPath);
switchTab(initialTab, false);

// Oynatıcıyı sürüklenebilir ve yeniden boyutlandırılabilir yap
const modalContent = document.querySelector('#player-modal .player-modal-content');
const modalHeader = document.querySelector('#player-modal .modal-header');
if (modalContent && modalHeader) {
  makeElementDraggable(modalContent, modalHeader);
  makeElementResizable(modalContent);
}

// [comments.js modülüne taşındı: toggleCommentsPanel, loadComments, loadMoreComments, renderCommentsList]


/**
 * Türkçe Açıklama: Aktif video oynatıcının süresini belirtilen saniyeye atlatir (Plyr uyumlu).
 * 
 * @param {number} seconds - Atlanacak saniye değeri
 * @returns {void}
 */
window.seekVideoToSeconds = function(seconds) {
  const player = document.getElementById('embedded-video-player');
  if (videoPlayerInstance) {
    videoPlayerInstance.currentTime = seconds;
  } else if (player) {
    player.currentTime = seconds;
  }
};


/**
 * Türkçe Açıklama: Video açıklama panelini açar/kapatır ve yorum panelini gizler.
 * 
 * @returns {void}
 */
window.toggleDescriptionPanel = function() {
  const container = document.getElementById('inline-player-description-container');
  if (!container) return;

  const isHidden = container.classList.contains('hidden');
  const btn = document.getElementById('inline-btn-description');
  const isEn = localDb.settings?.lang === 'en';
  
  if (isHidden) {
    container.classList.remove('hidden');
    if (btn) {
      btn.classList.add('active');
      btn.title = isEn ? 'Hide Description' : 'Açıklamayı Gizle';
    }
  } else {
    container.classList.add('hidden');
    if (btn) {
      btn.classList.remove('active');
      btn.title = isEn ? 'Show Description' : 'Açıklamayı Göster';
    }
  }
};

// [comments.js modülüne taşındı: renderCommentsList, loadComments, loadMoreComments]



// Initial drag-and-drop list sortable containers setup
initDragAndDrop();

// Initial icons trigger
lucide.createIcons();

function playNextVideoInPlaylist() {
  if (!currentPlayingVideoId) return;

  let filteredDownloaded = localDb.history.filter(item => item.status === 'completed');
  if (downloadedFilterChannel !== 'all') {
    if (downloadedFilterChannel.startsWith('category:')) {
      const catId = parseInt(downloadedFilterChannel.split(':')[1], 10);
      const channelIdsInCat = (localDb.channels || []).filter(c => (c.categoryIds || [c.categoryId || 1]).includes(catId)).map(c => c.id);
      const channelIdsInCatSet = new Set(channelIdsInCat);
      filteredDownloaded = filteredDownloaded.filter(item => channelIdsInCatSet.has(item.channelId));
    } else {
      filteredDownloaded = filteredDownloaded.filter(item => item.channelId === downloadedFilterChannel);
    }
  }
  const showShorts = localDb.settings?.showShorts !== false;
  if (!showShorts) {
    filteredDownloaded = filteredDownloaded.filter(item => !isShortVideo(item.duration, item.title, item.channelId));
  }
  const sortVal = downloadedSortVal || 'date-desc';
  
  filteredDownloaded.sort((a, b) => {
    if (sortVal === 'user') {
      const customOrder = JSON.parse(localStorage.getItem('downloaded-user-order') || '[]');
      let indexA = customOrder.indexOf(a.id);
      let indexB = customOrder.indexOf(b.id);
      
      if (indexA === -1 && indexB === -1) {
        const dateA = new Date(a.publishedAt || a.downloadedAt || 0).getTime();
        const dateB = new Date(b.publishedAt || b.downloadedAt || 0).getTime();
        return dateB - dateA;
      }
      if (indexA === -1) return -1;
      if (indexB === -1) return 1;
      
      return indexA - indexB;
    } else if (sortVal.startsWith('size-')) {
      const sizeA = parseSizeToBytes(a.fileSize);
      const sizeB = parseSizeToBytes(b.fileSize);
      return sortVal === 'size-desc' ? sizeB - sizeA : sizeA - sizeB;
    } else {
      const dateA = new Date(a.publishedAt || a.downloadedAt || 0).getTime();
      const dateB = new Date(b.publishedAt || b.downloadedAt || 0).getTime();
      return sortVal === 'date-asc' ? dateA - dateB : dateB - dateA;
    }
  });

  const currentIndex = filteredDownloaded.findIndex(item => item.id === currentPlayingVideoId);
  if (currentIndex !== -1 && currentIndex + 1 < filteredDownloaded.length) {
    const nextVideo = filteredDownloaded[currentIndex + 1];
    playVideoEmbedded(nextVideo.id);
  }
}

function initDragAndDrop() {
  setupSortableContainer(document.getElementById('downloaded-grid'), '.video-card', 'downloaded-user-order');
  setupSortableContainer(document.getElementById('downloaded-playlist-grid'), '.playlist-item', 'downloaded-user-order');
}

function setupSortableContainer(container, itemSelector, storageKey) {
  if (!container) return;
  let draggingElement = null;

  container.addEventListener('dragstart', (e) => {
    if (typeof downloadedSortVal === 'undefined' || downloadedSortVal !== 'user') return;
    const item = e.target.closest(itemSelector);
    if (!item) return;
    draggingElement = item;
    item.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
  });

  container.addEventListener('dragover', (e) => {
    if (typeof downloadedSortVal === 'undefined' || downloadedSortVal !== 'user') return;
    e.preventDefault();
    const target = e.target.closest(itemSelector);
    if (!target || target === draggingElement) return;

    const rect = target.getBoundingClientRect();
    const next = (e.clientY - rect.top) / (rect.bottom - rect.top) > 0.5 || (e.clientX - rect.left) / (rect.right - rect.left) > 0.5;

    if (next) {
      target.after(draggingElement);
    } else {
      target.before(draggingElement);
    }
  });

  container.addEventListener('dragend', () => {
    if (draggingElement) {
      draggingElement.classList.remove('dragging');
      draggingElement = null;
    }
    
    if (typeof downloadedSortVal === 'undefined' || downloadedSortVal !== 'user') return;
    
    const items = Array.from(container.querySelectorAll(itemSelector));
    const newOrder = items.map(el => el.getAttribute('data-id')).filter(Boolean);
    localStorage.setItem(storageKey, JSON.stringify(newOrder));
    
    updateUI(localDb);
  });
}


// Araçlar, dosya karşılaştırma ve indirme UI fonksiyonları artık doğrudan './modules/tools.js' modülü üzerinden yönetilmektedir.

// Toplu işlem ve modallar (Bulk Hide / Bulk Delete) ./modules/bulkOperations.js modülünden yönetilmektedir.

// [downloaderUI.js modülüne taşındı: handleDownloaderStart, handleDownloaderAll, renderPlaylistResults, downloadMissingVideo]

// [backupManager.js modülüne taşındı: loadSystemBackupsList, downloadSystemBackup,
//  deleteSystemBackup, triggerUploadBackupFile, uploadBackupFile, restoreSystemBackup]
// [ytdlpManager.js modülüne taşındı: fetchYtdlpVersion, updateYtdlp]

// Sayfa yüklendiğinde yt-dlp sürümünü ve Gist alanlarını otomatik sorgula
document.addEventListener('DOMContentLoaded', () => {
  fetchYtdlpVersion();
  setTimeout(() => {
    populateGistFields();
  }, 500);
});

// [Duplikat DOMContentLoaded bloğu kaldırıldı — tek kayıt yukarıda L6637]

/**
 * Türkçe Açıklama: Video süre stringini (HH:MM:SS, MM:SS, veya saniye) saniyeye çevirir.
 * Bilinmeyen formatlar için null döner.
 * @param {string|number|undefined} duration - Video süresi
 * @returns {number|null} Saniye cinsinden süre veya null
 */
function parseDurationToSeconds(duration) {
  if (duration === undefined || duration === null || duration === '' || duration === '-') return null;
  if (typeof duration === 'number') return duration;
  const str = String(duration).trim();
  if (!str) return null;
  // HH:MM:SS veya MM:SS formatı
  const parts = str.split(':');
  if (parts.length === 3) {
    return parseInt(parts[0], 10) * 3600 + parseInt(parts[1], 10) * 60 + parseInt(parts[2], 10);
  }
  if (parts.length === 2) {
    return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
  }
  // Düz sayı (saniye)
  const num = parseInt(str, 10);
  return isNaN(num) ? null : num;
}

/**
 * Türkçe Açıklama: Kütüphane süre filtresi dropdown değiştiğinde tetiklenir.
 */
function onHistoryDurationFilterChange() {
  const sel = document.getElementById('history-duration-filter');
  if (!sel) return;
  const val = sel.value;
  if (!localDb.settings) localDb.settings = {};
  localDb.settings.historyDurationFilter = val;
  saveHistoryFilterState();
  updateUI(localDb);
  // Backend'e kaydet
  fetch('/api/settings', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ historyDurationFilter: val })
  }).catch(err => console.error('Duration filter save error:', err));
}
window.onHistoryDurationFilterChange = onHistoryDurationFilterChange;

function onHistoryChannelFilterChange() {
  const sel = document.getElementById('history-channel-filter');
  if (!sel) return;
  window.historyFilterChannel = sel.value;
  saveHistoryFilterState();
  updateUI(localDb);
}
window.onHistoryChannelFilterChange = onHistoryChannelFilterChange;

function onHistoryDateFilterChange() {
  const sel = document.getElementById('history-date-filter');
  if (!sel) return;
  window.historyFilterDays = sel.value;
  saveHistoryFilterState();
  updateUI(localDb);
}
window.onHistoryDateFilterChange = onHistoryDateFilterChange;

/**
 * Türkçe Açıklama: Süre filtresini sıfırlar (kapalı konumuna getirir).
 */
function resetHistoryDurationFilter() {
  const sel = document.getElementById('history-duration-filter');
  if (sel) {
    sel.value = 'off';
    onHistoryDurationFilterChange();
  }
}
window.resetHistoryDurationFilter = resetHistoryDurationFilter;

// Türkçe Açıklama: İndirilenler ve Kütüphane genelindeki videoların eksik süre ve dosya boyutu (MB/GB) bilgilerini backend'de yeniler.
async function executeRefreshMetadata() {
  const dlBtn = document.getElementById('dl-refresh-metadata-btn');
  const startBtn = document.getElementById('start-refresh-metadata-btn');
  const loading = document.getElementById('refresh-metadata-loading');
  const lang = localDb.settings?.lang || 'tr';
  const t = translations[lang] || translations.tr;
  const isEn = lang === 'en';

  console.log('[Metadata Refresh] İndirilen videolar için metadata güncelleme başlatılıyor...');

  if (dlBtn) dlBtn.disabled = true;
  if (startBtn) startBtn.disabled = true;
  if (loading) loading.classList.remove('hidden');

  const originalDlHtml = dlBtn ? dlBtn.innerHTML : '';
  if (dlBtn) {
    dlBtn.innerHTML = `<i data-lucide="loader" class="spin" style="width:14px;height:14px;display:inline-block;vertical-align:middle;margin-right:4px;"></i> <span>${isEn ? 'Refreshing...' : 'Güncelleniyor...'}</span>`;
    try { lucide.createIcons(); } catch(e) {}
  }

  try {
    const res = await fetch('/api/tools/refresh-metadata', {
      method: 'POST'
    });
    const result = await res.json();
    console.log('[Metadata Refresh] Sunucu yanıtı alındı:', result);

    if (result.success) {
      const successMsg = result.message || (isEn ? 'Metadata refresh started in background.' : 'İndirilen videoların metadata taraması arka planda başlatıldı.');
      showToast(successMsg, 'success');
      
      if (typeof loadDb === 'function') {
        await loadDb();
      }
    } else {
      console.warn('[Metadata Refresh] Hata:', result.error);
      showToast(result.error || t.refresh_metadata_error || (isEn ? 'Metadata refresh failed.' : 'Metadata yenileme başarısız.'), 'error');
    }
  } catch (err) {
    console.error('[Metadata Refresh] İstek hatası:', err);
    showToast(isEn ? 'Metadata refresh request failed.' : 'Metadata yenileme isteği başarısız.', 'error');
  } finally {
    if (dlBtn) {
      dlBtn.disabled = false;
      dlBtn.innerHTML = originalDlHtml;
      try { lucide.createIcons(); } catch(e) {}
    }
    if (startBtn) startBtn.disabled = false;
    if (loading) loading.classList.add('hidden');
  }
}
window.executeRefreshMetadata = executeRefreshMetadata;


// changeChannelCategory → tools.js window.changeChannelCategory
// removeChannelCategory → tools.js window.removeChannelCategory

// Kategori listesi ve silme işlevleri './modules/tools.js' modülü üzerinden window.loadCategoriesToTools ve window.deleteCategory ile yönetilmektedir.


document.addEventListener('DOMContentLoaded', () => {
  if (typeof initDownloaderUI === 'function') initDownloaderUI();
  if (typeof restoreHistoryFilterState === 'function') restoreHistoryFilterState();
  if (typeof restoreDownloadedFilterState === 'function') restoreDownloadedFilterState();

  const durationFilterEl = document.getElementById('history-duration-filter');
  if (durationFilterEl) {
    durationFilterEl.addEventListener('change', onHistoryDurationFilterChange);
  }

  // Kanal Filtrelerini Sayfa Yüklenince Otomatik Doldur
  setTimeout(() => {
    if (typeof populateChannelFilters === 'function') {
      populateChannelFilters(localDb);
    }
  }, 300);
});

/**
 * APE Aracı: Girilen video veya kanal linkindeki videoları izlendi/gizlendi işaretler.
 */
window.handleApeMarkWatched = async function() {
  const inputEl = document.getElementById('ape-target-input');
  const syncCb = document.getElementById('ape-sync-youtube-checkbox');
  const limitEl = document.getElementById('ape-limit-input');
  const resultBox = document.getElementById('ape-result-box');
  const resultText = document.getElementById('ape-result-text');
  const resultIcon = document.getElementById('ape-result-icon');
  const btn = document.getElementById('btn-ape-mark-watched');

  if (!inputEl) return;
  const target = inputEl.value.trim();
  const limit = limitEl ? parseInt(limitEl.value, 10) || 50 : 50;
  const lang = localStorage.getItem('haytool_user_lang') || 'tr';
  const t = translations[lang] || translations.tr;

  if (!target) {
    showToast(t.ape_empty_input || 'Lütfen bir video veya kanal linki girin.', 'warning');
    if (inputEl) inputEl.focus();
    return;
  }

  const syncYouTube = syncCb ? syncCb.checked : true;

  try {
    if (btn) btn.disabled = true;
    showToast(t.ape_processing || 'İşleniyor...', 'info');

    const res = await fetch('/api/tools/ape-mark-watched', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target, syncYouTube, limit })
    });

    const data = await res.json();
    if (data.success) {
      showToast(data.message || 'Başarıyla işaretlendi.', 'success');
      if (resultBox && resultText) {
        resultBox.classList.remove('hidden');
        resultBox.style.background = 'rgba(34, 197, 94, 0.1)';
        resultBox.style.border = '1px solid rgba(34, 197, 94, 0.3)';
        resultBox.style.color = '#22c55e';
        resultText.innerHTML = `<strong>${t.ape_success_title || 'Başarılı:'}</strong> ${escapeHtml(data.message)}`;
        if (resultIcon) resultIcon.setAttribute('data-lucide', 'check-circle');
      }
      inputEl.value = '';
    } else {
      showToast(data.error || 'İşlem başarısız oldu.', 'error');
      if (resultBox && resultText) {
        resultBox.classList.remove('hidden');
        resultBox.style.background = 'rgba(239, 68, 68, 0.1)';
        resultBox.style.border = '1px solid rgba(239, 68, 68, 0.3)';
        resultBox.style.color = '#ef4444';
        resultText.innerHTML = `<strong>${t.ape_error_title || 'Hata:'}</strong> ${escapeHtml(data.error || 'Bilinmeyen hata')}`;
        if (resultIcon) resultIcon.setAttribute('data-lucide', 'alert-triangle');
      }
    }
    if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
  } catch (err) {
    showToast(err.message || 'Bağlantı hatası.', 'error');
  } finally {
    if (btn) btn.disabled = false;
  }
};

/**
 * Araçlar sekmesindeki akordiyon menü ögelerinin açılıp kapanmasını kontrol eder.
 * @param {'compare'|'categories'|'ape'} itemKey Akordiyon öge anahtarı
 */
window.toggleToolsAccordion = function(itemKey) {
  const itemEl = document.getElementById(`accordion-item-${itemKey}`);
  if (!itemEl) return;
  const isCurrentlyActive = itemEl.classList.contains('active');
  
  if (isCurrentlyActive) {
    itemEl.classList.remove('active');
  } else {
    itemEl.classList.add('active');
  }
  try {
    if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
  } catch (e) {}
};

/**
 * Video kartında veya listede kanal adına tıklandığında filtreleme uygular.
 * @param {string} channelId Filtrelenecek kanal kimliği
 * @param {string} gridId İlgili tablosunun kimliği (history-grid veya downloaded-grid)
 */
window.filterByChannel = function(channelId, gridId) {
  if (!channelId) return;
  const isDownloaded = gridId === 'downloaded-grid';
  const type = isDownloaded ? 'downloaded' : 'history';

  if (isDownloaded) {
    downloadedFilterChannel = channelId;
    window.downloadedFilterChannel = channelId;
    const downloadedChannelFilter = document.getElementById('downloaded-channel-filter');
    if (downloadedChannelFilter) {
      let opt = downloadedChannelFilter.querySelector(`option[value="${CSS.escape(channelId)}"]`);
      if (!opt) {
        opt = document.createElement('option');
        opt.value = channelId;
        opt.textContent = channelId;
        downloadedChannelFilter.appendChild(opt);
      }
      downloadedChannelFilter.value = channelId;
    }
    saveDownloadedFilterState();
  } else {
    historyFilterChannel = channelId;
    window.historyFilterChannel = channelId;
    const historyChannelFilter = document.getElementById('history-channel-filter');
    if (historyChannelFilter) {
      let opt = historyChannelFilter.querySelector(`option[value="${CSS.escape(channelId)}"]`);
      if (!opt) {
        opt = document.createElement('option');
        opt.value = channelId;
        opt.textContent = channelId;
        historyChannelFilter.appendChild(opt);
      }
      historyChannelFilter.value = channelId;
    }
    saveHistoryFilterState();
  }

  populateChannelFilters(localDb);
  updateUI(localDb);
};

/* ===== Global Custom Channel Avatar Dropdown Component ===== */
function toggleCustomChannelPicker(type, event) {
  if (event) {
    event.stopPropagation();
    if (typeof event.preventDefault === 'function') event.preventDefault();
  }
  const dropdown = document.getElementById(`${type}-custom-dropdown`);
  if (!dropdown) return;
  const isOpen = dropdown.classList.contains('open');
  document.querySelectorAll('.custom-channel-dropdown').forEach(d => d.classList.remove('open'));
  if (!isOpen) {
    dropdown.classList.add('open');
    // Menüyü overflow'lu parent'lardan (toolbar yatay kaydırma) kurtarmak için viewport'a sabitle
    const menu = dropdown.querySelector('.custom-dropdown-menu');
    const trigger = dropdown.querySelector('.custom-dropdown-trigger');
    if (menu && trigger) {
      const rect = trigger.getBoundingClientRect();
      menu.style.position = 'fixed';
      menu.style.top = `${Math.min(rect.bottom + 6, window.innerHeight - 40)}px`;
      menu.style.left = `${Math.max(8, Math.min(rect.left, window.innerWidth - 280))}px`;
      menu.style.maxHeight = `${Math.min(360, window.innerHeight - 60)}px`;
    }
  }
}
window.toggleCustomChannelPicker = toggleCustomChannelPicker;

document.addEventListener('click', (e) => {
  if (!e.target.closest('.custom-channel-dropdown')) {
    document.querySelectorAll('.custom-channel-dropdown').forEach(d => d.classList.remove('open'));
  }
});

function selectCustomChannelOption(type, value, event) {
  if (event) {
    event.stopPropagation();
  }
  const selectEl = document.getElementById(`${type}-channel-filter`);
  const dropdown = document.getElementById(`${type}-custom-dropdown`);

  const safeVal = (!value || value.trim() === '') ? 'all' : value;

  if (selectEl) {
    let opt = selectEl.querySelector(`option[value="${CSS.escape(safeVal)}"]`);
    if (!opt) {
      opt = document.createElement('option');
      opt.value = safeVal;
      opt.textContent = safeVal;
      selectEl.appendChild(opt);
    }
    selectEl.value = safeVal;
  }
  if (dropdown) dropdown.classList.remove('open');

  if (type === 'history') {
    historyFilterChannel = safeVal;
    window.historyFilterChannel = safeVal;
    if (typeof saveHistoryFilterState === 'function') saveHistoryFilterState();
  } else if (type === 'downloaded') {
    downloadedFilterChannel = safeVal;
    window.downloadedFilterChannel = safeVal;
    if (typeof saveDownloadedFilterState === 'function') saveDownloadedFilterState();
  }

  // Yeniden render et ve arayüzü güncelle
  if (typeof updateUI === 'function') {
    updateUI(localDb);
  } else {
    populateChannelFilters(localDb);
  }
}
window.selectCustomChannelOption = selectCustomChannelOption;

function populateChannelFilters(db) {
  const targetDb = db || localDb || {};
  const channels = targetDb.channels || [];
  const categories = targetDb.categories || [];
  const lang = localDb.settings?.lang || currentLang || 'tr';
  const t = translations[lang] || translations.tr;

  ['history', 'downloaded'].forEach(type => {
    const panel = document.getElementById(`${type}-channel-options-panel`);
    const triggerContent = document.getElementById(`${type}-channel-trigger-content`);
    const selectEl = document.getElementById(`${type}-channel-filter`);
    if (!panel) return;

    let currentValue = (type === 'history' ? historyFilterChannel : downloadedFilterChannel) || (selectEl ? selectEl.value : 'all');
    if (!currentValue || currentValue.trim() === '') currentValue = 'all';

    let html = '';
    let selectOptionsHtml = `<option value="all">${escapeHtml(t.filter_all_channels || 'Tüm Kanallar')}</option>`;
    let activeTriggerHtml = `<i data-lucide="globe" style="width:14px;height:14px;color:var(--accent-color);"></i><span>${escapeHtml(t.filter_all_channels || 'Tüm Kanallar')}</span>`;

    // 1. Tüm Kanallar
    const allText = t.filter_all_channels || 'Tüm Kanallar';
    const allIcon = `<i data-lucide="globe" style="width:16px;height:16px;color:var(--accent-color);"></i>`;
    if (currentValue === 'all') {
      activeTriggerHtml = `${allIcon}<span>${escapeHtml(allText)}</span>`;
    }
    html += `
      <div class="custom-dropdown-item ${currentValue === 'all' ? 'active' : ''}" onclick="selectCustomChannelOption('${type}', 'all', event)">
        ${allIcon}
        <span>${escapeHtml(allText)}</span>
      </div>
    `;

    // 2. Kategoriler (Tek Kategori İkonu)
    if (categories && categories.length > 0) {
      const sortedFilterCats = [...categories].sort((a, b) => {
        if (a.id === 1) return -1;
        if (b.id === 1) return 1;
        return getCatTranslatedName(a, t).localeCompare(getCatTranslatedName(b, t), lang, { sensitivity: 'base' });
      });

      sortedFilterCats.forEach(cat => {
        const catName = getCatTranslatedName(cat, t);
        const hasChannel = channels.some(c => (c.categoryIds || [c.categoryId || 1]).includes(cat.id));
        if (hasChannel) {
          const catValue = `category:${cat.id}`;
          const catText = catName;
          const catIcon = `<i data-lucide="folder" style="width:16px;height:16px;color:var(--accent-color);"></i>`;
          const isSel = currentValue === catValue;
          if (isSel) {
            activeTriggerHtml = `${catIcon}<span>${escapeHtml(catText)}</span>`;
          }
          selectOptionsHtml += `<option value="${catValue}">${escapeHtml(catText)}</option>`;
          html += `
            <div class="custom-dropdown-item ${isSel ? 'active' : ''}" onclick="selectCustomChannelOption('${type}', '${catValue}', event)">
              ${catIcon}
              <span>${escapeHtml(catText)}</span>
            </div>
          `;
        }
      });

      html += `<div class="custom-dropdown-divider"></div>`;
    }

    // 3. Kanallar (GERÇEK YOUTUBE KANAL LOGOLARI/AVATARLARI İLE)
    const sortedChannels = [...channels].sort((a, b) => a.name.localeCompare(b.name, 'tr'));
    sortedChannels.forEach(channel => {
      const avatarUrl = `/api/channels/${channel.id}/avatar`;
      const isSel = currentValue === channel.id;
      const avatarImgHtml = `<img src="${avatarUrl}" class="custom-dropdown-avatar" onerror="this.src='/logo.png'">`;
      
      if (isSel) {
        activeTriggerHtml = `${avatarImgHtml}<span>${escapeHtml(channel.name)}</span>`;
      }
      selectOptionsHtml += `<option value="${channel.id}">${escapeHtml(channel.name)}</option>`;

      html += `
        <div class="custom-dropdown-item ${isSel ? 'active' : ''}" onclick="selectCustomChannelOption('${type}', '${channel.id}', event)">
          ${avatarImgHtml}
          <span>${escapeHtml(channel.name)}</span>
        </div>
      `;
    });

    panel.innerHTML = html;
    if (triggerContent) {
      triggerContent.innerHTML = activeTriggerHtml;
    }
    if (selectEl) {
      selectEl.innerHTML = selectOptionsHtml;
      selectEl.value = currentValue;
    }
  });

  try { if (typeof lucide !== 'undefined') lucide.createIcons(); } catch (e) {}
}
window.populateChannelFilters = populateChannelFilters;

// Gist ve YouTube oturum/çerez yönetim fonksiyonları './modules/settings.js' modülü tarafından yönetilmektedir.

// === YOUTUBE ABONELİKLERİNİ İÇE AKTAR (aktif kopya — app.js monolitik yapıdadır) ===
// Türkçe Açıklama: YouTube abone kanallarını backend'den çekip seçmeli takip listesi listeler.
// 1000+ kanal için parça parça render + arama filtresi + toplu seçim desteklenir.
let subscriptionsCache = [];
let subsChecked = new Set();
let subsRenderCount = 100;
let subsFilterText = '';

window.fetchYouTubeSubscriptions = async function() {
  const lang = localStorage.getItem('haytool_user_lang') || 'tr';
  const t = translations[lang] || translations.tr;
  const listEl = document.getElementById('subs-list');
  const loadingEl = document.getElementById('subs-loading');
  const btn = document.getElementById('btn-subs-fetch');
  const resultBox = document.getElementById('subs-result-box');
  const resultText = document.getElementById('subs-result-text');
  const resultIcon = document.getElementById('subs-result-icon');
  const importBtn = document.getElementById('btn-subs-import');

  if (loadingEl) loadingEl.classList.remove('hidden');
  if (listEl) listEl.innerHTML = '';
  if (importBtn) importBtn.style.display = 'none';
  if (resultBox) resultBox.classList.add('hidden');
  if (btn) btn.disabled = true;

  try {
    const res = await fetch('/api/tools/subscriptions');
    const data = await res.json();
    if (!data.success) {
      showToast(data.error || 'Abonelikler çekilemedi.', 'error');
      if (resultBox && resultText) {
        resultBox.classList.remove('hidden');
        resultBox.style.background = 'rgba(239, 68, 68, 0.1)';
        resultBox.style.border = '1px solid rgba(239, 68, 68, 0.3)';
        resultBox.style.color = '#ef4444';
        resultText.innerHTML = `<strong>${t.ape_error_title || 'Hata:'}</strong> ${escapeHtml(data.error || 'Bilinmeyen hata')}`;
        if (resultIcon) resultIcon.setAttribute('data-lucide', 'alert-triangle');
      }
      return;
    }

    subscriptionsCache = data.channels || [];
    if (subscriptionsCache.length === 0) {
      if (resultBox && resultText) {
        resultBox.classList.remove('hidden');
        resultBox.style.background = 'rgba(239, 68, 68, 0.1)';
        resultBox.style.border = '1px solid rgba(239, 68, 68, 0.3)';
        resultBox.style.color = '#ef4444';
        resultText.innerHTML = `<strong>${t.ape_error_title || 'Hata:'}</strong> ${escapeHtml(data.message || 'Abone kanalı bulunamadı.')}`;
        if (resultIcon) resultIcon.setAttribute('data-lucide', 'alert-triangle');
      }
      return;
    }

    listEl.innerHTML = '';
    subsChecked = new Set();
    subsRenderCount = 100;
    subsFilterText = '';
    const searchEl = document.getElementById('subs-search-input');
    if (searchEl) searchEl.value = '';

    renderSubsList();

    if (importBtn) importBtn.style.display = 'none';
    if (resultBox && resultText) {
      resultBox.classList.remove('hidden');
      resultBox.style.background = 'rgba(34, 197, 94, 0.1)';
      resultBox.style.border = '1px solid rgba(34, 197, 94, 0.3)';
      resultBox.style.color = '#22c55e';
      resultText.innerHTML = `<strong>${t.subs_found_title || 'Bulundu:'}</strong> ${subscriptionsCache.length} ${t.subs_channel_count || 'abone kanalı'}`;
      if (resultIcon) resultIcon.setAttribute('data-lucide', 'check-circle');
    }
  } catch (err) {
    showToast('Sunucu ile iletişim hatası.', 'error');
  } finally {
    if (loadingEl) loadingEl.classList.add('hidden');
    if (btn) btn.disabled = false;
  }
};

// Türkçe Açıklama: Filtrelenmiş abone listesini 100'er parça halinde render eder (performans için).
window.renderSubsList = function() {
  const listEl = document.getElementById('subs-list');
  if (!listEl) return;
  const lang = localStorage.getItem('haytool_user_lang') || 'tr';
  const t = translations[lang] || translations.tr;
  const filtered = subscriptionsCache.filter(ch => !subsFilterText || (ch.name || '').toLowerCase().includes(subsFilterText));
  const visible = filtered.slice(0, subsRenderCount);
  listEl.innerHTML = visible.map(ch => `
    <label style="display:flex; align-items:center; gap:10px; padding:8px 10px; border-radius:6px; cursor:${ch.followed ? 'default' : 'pointer'}; ${ch.followed ? 'opacity:0.55;' : ''}" title="${escapeHtml(ch.id)}">
      <input type="checkbox" class="subs-check" data-id="${escapeHtml(ch.id)}" ${ch.followed ? 'disabled' : ''} ${subsChecked.has(ch.id) ? 'checked' : ''} onchange="toggleSubsCheck(this)">
      <span style="flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:0.9rem;">${escapeHtml(ch.name)}</span>
      ${ch.followed ? '<span style="font-size:0.72rem; color:var(--text-muted); flex-shrink:0;">' + (t.subs_followed || 'Takip ediliyor ✓') + '</span>' : ''}
    </label>
  `).join('');

  const loadMoreBtn = document.getElementById('btn-subs-load-more');
  if (loadMoreBtn) {
    const remaining = filtered.length - visible.length;
    loadMoreBtn.style.display = remaining > 0 ? 'inline-flex' : 'none';
    const loadMoreText = document.getElementById('btn-subs-load-more-text');
    if (loadMoreText) loadMoreText.textContent = `${t.subs_load_more || 'Daha Fazla Göster'} (${remaining})`;
  }
  updateSubsImportButton();
  if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
};

// Türkçe Açıklama: Checkbox değişiminde seçimi bellek kümesine işler.
window.toggleSubsCheck = function(cb) {
  if (!cb || cb.disabled) return;
  if (cb.checked) subsChecked.add(cb.dataset.id);
  else subsChecked.delete(cb.dataset.id);
  updateSubsImportButton();
};

// Türkçe Açıklama: Arama kutusuna göre listeyi filtreler ve baştan render eder.
window.filterSubsList = function() {
  const searchEl = document.getElementById('subs-search-input');
  subsFilterText = (searchEl ? searchEl.value : '').trim().toLowerCase();
  subsRenderCount = 100;
  renderSubsList();
};

// Türkçe Açıklama: Sonraki 100 kanalı listeye ekler.
window.loadMoreSubs = function() {
  subsRenderCount += 100;
  renderSubsList();
};

// Türkçe Açıklama: Takip edilmeyen tüm abone kanallarını tek seferde işaretler.
window.selectAllSubs = function() {
  const lang = localStorage.getItem('haytool_user_lang') || 'tr';
  const t = translations[lang] || translations.tr;
  subscriptionsCache.forEach(ch => { if (!ch.followed) subsChecked.add(ch.id); });
  renderSubsList();
  showToast(`${subsChecked.size} ${t.subs_selected || 'kanal seçildi'}`, 'info');
};

// Türkçe Açıklama: Seçilen abone sayısına göre "Ekle" butonunu ve sayacı günceller.
window.updateSubsImportButton = function() {
  const count = subsChecked.size;
  const importBtn = document.getElementById('btn-subs-import');
  const countEl = document.getElementById('subs-selected-count');
  const lang = localStorage.getItem('haytool_user_lang') || 'tr';
  const t = translations[lang] || translations.tr;
  if (importBtn) importBtn.style.display = count > 0 ? 'inline-flex' : 'none';
  if (countEl) countEl.textContent = count > 0 ? `${count} ${t.subs_selected || 'kanal seçildi'}` : '';
};

// Türkçe Açıklama: Seçilen abone kanallarını takip listesine toplu ekler.
window.importSelectedSubscriptions = async function() {
  if (subsChecked.size === 0) return;
  const lang = localStorage.getItem('haytool_user_lang') || 'tr';
  const t = translations[lang] || translations.tr;
  const channels = subscriptionsCache.filter(ch => subsChecked.has(ch.id)).map(ch => ({ id: ch.id, name: ch.name }));
  const btn = document.getElementById('btn-subs-import');
  if (btn) btn.disabled = true;
  try {
    const res = await fetch('/api/tools/subscriptions/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channels })
    });
    const data = await res.json();
    if (data.success) {
      showToast(`${data.addedCount} ${t.subs_added_toast || 'kanal takip listesine eklendi'}${data.skippedCount ? ` (${data.skippedCount} ${t.subs_skipped || 'atlandı'})` : ''}.`, 'success');
      // Eklendi olarak işaretle (artık takip ediliyor) ve seçimi temizle
      channels.forEach(ch => {
        const cached = subscriptionsCache.find(x => x.id === ch.id);
        if (cached) cached.followed = true;
      });
      subsChecked.clear();
      renderSubsList();
      const resultBox = document.getElementById('subs-result-box');
      const resultText = document.getElementById('subs-result-text');
      const resultIcon = document.getElementById('subs-result-icon');
      if (resultBox && resultText) {
        resultBox.classList.remove('hidden');
        resultBox.style.background = 'rgba(34, 197, 94, 0.1)';
        resultBox.style.border = '1px solid rgba(34, 197, 94, 0.3)';
        resultBox.style.color = '#22c55e';
        resultText.innerHTML = `<strong>${t.subs_success_title || 'Başarılı:'}</strong> ${data.addedCount} ${t.subs_added_detail || 'kanal eklendi. Kanal bilgileri (avatar, abone sayısı) Kanallar sekmesinden "Bilgileri Güncelle" ile doldurulabilir.'}`;
        if (resultIcon) resultIcon.setAttribute('data-lucide', 'check-circle');
      }
      updateSubsImportButton();

      // Yeni eklenen kanalların abone/avatar bilgileri sunucu tarafında arka planda otomatik güncellenir
      showToast(t.subs_info_update_started || 'Yeni eklenen kanalların bilgileri arka planda güncelleniyor...', 'info');
    } else {
      showToast(data.error || 'Ekleme başarısız.', 'error');
    }
  } catch (err) {
    showToast('Sunucu ile iletişim hatası.', 'error');
  } finally {
    if (btn) btn.disabled = false;
  }
};

// Türkçe Açıklama: YouTube feed/channels (abonelikler) sayfasını WebView2 oynatıcıda açar.
window.openSubscriptionsPage = async function() {
  try {
    const res = await fetch('/api/tools/open-subscriptions', { method: 'POST' });
    const data = await res.json();
    showToast(data.message || 'YouTube abonelik sayfası açılıyor...', 'info');
  } catch (err) {
    showToast('Sunucu ile iletişim hatası.', 'error');
  }
};

// SİSTEM KONSOLU MODALI (openConsoleModal, closeConsoleModal, clearConsoleModal, appendLogToConsoleModal) → ./modules/terminal.js

// ===== DNS SORGULAYICI =====

// ===== AKTİF DNS SUNUCUSU TESPİTİ =====
// DNS fonksiyonları ve olay dinleyicileri ./modules/dnsLookup.js modülünden yönetilmektedir.
initDnsLookupEvents();

