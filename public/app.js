/**
 * HaYTooL YouTube Downloader & Media Suite - Ana İstemci Mantığı (app.js)
 * 
 * Yapımcı: HaYTo
 * Lisans: MIT
 */

import { translations } from './utils/i18n.js';
import { 
  escapeHtml, 
  formatDate, 
  getDaysAgoText, 
  parseSizeToBytes, 
  isShortVideo, 
  parseTimeToSeconds, 
  parseDurationToSeconds,
  formatDescriptionTimestamps, 
  parseLikes, 
  parseRelativeTime, 
  debounce, 
  isMembersOnlyVideo 
} from './utils/helpers.js';
import { showToast } from './components/toast.js';
import { renderVideoGrid } from './components/videoCard.js';
import { renderChannelsList } from './components/channelRow.js';

import { 
  initIptv,
  loadIptvChannels,
  stopAllIptvPlayersAndClear,
  stopAllIptvPlayers,
  checkIptvStatus,
  restoreIptvState,
  getIptvPlayers
} from './modules/iptv.js';

import { 
  initTools,
  renderComparisonResults,
  fixFileIssue,
  fixAllUntracked,
  fixAllMissing,
  openFileLocation,
  addCategoryFromTools,
  editCategoryName,
  deleteCategory,
  handleApeMarkWatched,
  toggleToolsAccordion,
  changeChannelCategory,
  removeChannelCategory,
  loadCategoriesToTools,
  runFileComparison,
  toggleToolsDropdown,
  showToolsSubSection
} from './modules/tools.js';

import { 
  initDownloader,
  handleDownloaderStart,
  handleDownloaderAll,
  renderPlaylistResults,
  cancelDownload,
  cancelAllDownloads,
  cancelQueuedVideo,
  cancelAllQueued,
  resetDownloadEngine
} from './modules/downloader.js';

import { 
  initSettings,
  applyTheme,
  toggleQuickTheme,
  triggerAutoSave,
  performAutoSave,
  initSettingsSubtabs,
  createSystemBackup,
  loadSystemBackupsList,
  restoreSystemBackup,
  downloadSystemBackup,
  deleteSystemBackup,
  triggerUploadBackupFile,
  uploadBackupFile,
  toggleGistTokenVisibility,
  testGistToken,
  pushGistChannels,
  pullGistChannels,
  toggleAutoSyncGist,
  populateGistFields,
  saveGistToken,
  deleteGistToken,
  checkYouTubeAuthStatus,
  testCookies,
  logoutYouTube,
  openYouTubeLogin
} from './modules/settings.js';

import { initDbRenderer, connectSSE, updateUI, updateDiskSpace, checkFfmpegStatus, populateChannelFilters, initDragAndDrop } from './modules/db-renderer.js';
import { 
  initTabManager,
  switchTab,
  performTabSwitchUI,
  saveHistoryFilterState,
  restoreHistoryFilterState,
  saveDownloadedFilterState,
  restoreDownloadedFilterState,
  setHistoryViewMode,
  setDownloadedViewMode,
  tabPathMap,
  pathTabMap
} from './modules/tab-manager.js';
import { initI18nApply, applyLanguage } from './modules/i18n-apply.js';
import { 
  initPlayer,
  cleanupAllPlayers,
  playVideoEmbedded,
  closeInlinePlayer,
  togglePlayerMinimize,
  closePlayerModal,
  toggleCommentsPanel,
  toggleDescriptionPanel,
  loadMoreComments,
  sortAndRenderComments,
  fetchSponsorSegments,
  updateSponsorBlockStatusUI,
  renderDownloadedPlaylist,
  openYouTube,
  makeElementDraggable,
  makeElementResizable,
  showPlayerTransientOverlay,
  seekVideoToSeconds,
  playVideoSystem,
  handleThumbMouseEnter,
  handleThumbMouseLeave
} from './modules/player.js';


let localDb = { channels: [], history: [], settings: {} };
window.localDb = localDb;
let eventSource = null;
let currentLang = 'tr';
window.isDownloadedBulkDeleteMode = false;
window.isHistoryBulkHideMode = false;
window.historyFilterChannel = 'all';
window.downloadedFilterChannel = 'all';
window.historyFilterDays = 'all';
window.historyOnlyNoAutoDownload = false;
window.historyOnlyNotDownloaded = false;
window.historyShowHidden = false;
window.historyViewMode = 'grid';
window.downloadedViewMode = 'grid';
let downloadedSortVal = 'date-desc';
window.downloadedSortVal = downloadedSortVal;

// IPTV Global Variables
let iptvPlayers = [null, null, null, null];
let activeIptvSlot = 0;
let iptvIsLoading = false;
let iptvSearchQuery = '';
let iptvSelectedCountry = '';
let iptvSelectedCategory = '';
let iptvStatusInterval = null;
let isRestoringIptv = false;

// Modül Başlatıcıları (State Dependency Injection)
const getState = () => ({
  localDb,
  currentLang,
  translations
});

initIptv(getState);
initTools(getState);
initDownloader(getState);
initSettings(getState);
initPlayer(getState);
initI18nApply(getState);
initTabManager(getState);
initDbRenderer(getState);

// Global Window Atamaları
if (typeof window !== 'undefined') {
  window.escapeHtml = escapeHtml;
  window.formatDate = formatDate;
  window.getDaysAgoText = getDaysAgoText;
  window.isShortVideo = isShortVideo;
  window.parseDurationToSeconds = parseDurationToSeconds;
  window.parseTimeToSeconds = parseTimeToSeconds;
  window.showToast = showToast;
  window.translations = translations;
  window.applyLanguage = applyLanguage;
  window.switchTab = switchTab;
  window.performTabSwitchUI = performTabSwitchUI;
  window.saveHistoryFilterState = saveHistoryFilterState;
  window.restoreHistoryFilterState = restoreHistoryFilterState;
  window.saveDownloadedFilterState = saveDownloadedFilterState;
  window.restoreDownloadedFilterState = restoreDownloadedFilterState;
  window.setHistoryViewMode = setHistoryViewMode;
  window.setDownloadedViewMode = setDownloadedViewMode;
  window.tabPathMap = tabPathMap;
  window.pathTabMap = pathTabMap;
  window.connectSSE = connectSSE;
  window.updateUI = updateUI;
  window.updateDiskSpace = updateDiskSpace;
  window.checkFfmpegStatus = checkFfmpegStatus;
  window.populateChannelFilters = populateChannelFilters;
  window.initDragAndDrop = initDragAndDrop;
  window.renderVideoGrid = renderVideoGrid;
  window.renderChannelsList = renderChannelsList;
  window.loadIptvChannels = loadIptvChannels;
  window.stopAllIptvPlayersAndClear = stopAllIptvPlayersAndClear;
  window.stopAllIptvPlayers = stopAllIptvPlayers;
  window.checkIptvStatus = checkIptvStatus;
  window.restoreIptvState = restoreIptvState;
  window.renderComparisonResults = renderComparisonResults;
  window.fixFileIssue = fixFileIssue;
  window.fixAllUntracked = fixAllUntracked;
  window.fixAllMissing = fixAllMissing;
  window.openFileLocation = openFileLocation;
  window.addCategoryFromTools = addCategoryFromTools;
  window.editCategoryName = editCategoryName;
  window.deleteCategory = deleteCategory;
  window.handleApeMarkWatched = handleApeMarkWatched;
  window.toggleToolsAccordion = toggleToolsAccordion;
  window.cancelQueuedVideo = cancelQueuedVideo;
  window.cancelAllQueued = cancelAllQueued;
  window.resetDownloadEngine = resetDownloadEngine;
  window.applyTheme = applyTheme;
  window.toggleQuickTheme = toggleQuickTheme;
  window.triggerAutoSave = triggerAutoSave;
  window.performAutoSave = performAutoSave;
  window.testCookies = testCookies;
  window.logoutYouTube = logoutYouTube;
  window.createSystemBackup = createSystemBackup;
  window.restoreSystemBackup = restoreSystemBackup;
  window.saveGistToken = saveGistToken;
  window.deleteGistToken = deleteGistToken;
  window.checkYouTubeAuthStatus = checkYouTubeAuthStatus;
  window.populateGistFields = populateGistFields;
  window.cleanupAllPlayers = cleanupAllPlayers;
  window.playVideoEmbedded = playVideoEmbedded;
  window.closeInlinePlayer = closeInlinePlayer;
  window.togglePlayerMinimize = togglePlayerMinimize;
  window.closePlayerModal = closePlayerModal;
  window.toggleCommentsPanel = toggleCommentsPanel;
  window.toggleDescriptionPanel = toggleDescriptionPanel;
  window.loadMoreComments = loadMoreComments;
  window.sortAndRenderComments = sortAndRenderComments;
  window.fetchSponsorSegments = fetchSponsorSegments;
  window.updateSponsorBlockStatusUI = updateSponsorBlockStatusUI;
  window.renderDownloadedPlaylist = renderDownloadedPlaylist;
  window.openYouTube = openYouTube;
  window.makeElementDraggable = makeElementDraggable;
  window.makeElementResizable = makeElementResizable;
  window.showPlayerTransientOverlay = showPlayerTransientOverlay;
  window.seekVideoToSeconds = seekVideoToSeconds;
}


/**
 * HaYTooL YouTube Downloader - İstemci Mantığı (Frontend)
 * 
 * Yapımcı: HaYTo
 * İletişim: korazhayto@gmail.com
 */







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

// YouTube SVG İkon Şablonu (Lucide bağımlılığı olmadan her ortamda çalışması için yerel SVG kullanıyoruz)
const youtubeSvgIcon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" style="display:inline-block !important;vertical-align:middle !important;fill:#ff0000 !important;stroke:none !important;width:16px !important;height:16px !important;"><path d="M23.498 6.163a3.003 3.003 0 0 0-2.11-2.11C19.517 3.545 12 3.545 12 3.545s-7.516 0-9.388.508a3.003 3.003 0 0 0-2.11 2.11C0 8.033 0 12 0 12s0 3.967.502 5.837a3.003 3.003 0 0 0 2.11 2.11c1.872.508 9.388.508 9.388.508s7.517 0 9.388-.508a3.003 3.003 0 0 0 2.11-2.11C24 15.967 24 12 24 12s0-3.967-.502-5.837zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" style="fill:#ff0000 !important;stroke:none !important;"/></svg>`;

;

// Türkçe Açıklama: Seçilen dil paketine (TR veya EN) göre sayfadaki tüm metin etiketlerini ve açıklamaları dinamik olarak günceller.
/**
 * Arayüz dilini seçilen dile göre günceller.
 * 
 * @param {string} lang Seçilen dil kodu ('tr' veya 'en')
 */

// ─── DOM Elemanları Tanımları ───
const statusIndicator = document.getElementById('status-indicator');
const connectionStatus = document.getElementById('connection-status');
const qualityStatus = document.getElementById('quality-status');

const navItems = document.querySelectorAll('.nav-item');
const tabContents = document.querySelectorAll('.tab-content');

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

// İndirilen Videolar Tab Elemanları
const downloadedGrid = document.getElementById('downloaded-grid');
const downloadedChannelFilter = document.getElementById('downloaded-channel-filter');
const downloadedViewGridBtn = document.getElementById('downloaded-view-grid-btn');
const downloadedViewListBtn = document.getElementById('downloaded-view-list-btn');

// Silme Modalı Elemanları
const deleteModal = document.getElementById('delete-modal');
const closeDeleteModalBtn = document.getElementById('close-delete-modal-btn');
const cancelDeleteBtn = document.getElementById('cancel-delete-btn');
const confirmDeleteBtn = document.getElementById('confirm-delete-btn');
const deleteFileCheckbox = document.getElementById('delete-file-checkbox');
const deleteModalMsg = document.getElementById('delete-modal-msg');
let videoIdToDelete = null;

// Ayarlar Tab Elemanları
const settingsForm = document.getElementById('settings-form');
const settingsDownloadPath = document.getElementById('settings-download-path');
const settingsBrowser = document.getElementById('settings-browser');
const settingsQuality = document.getElementById('settings-quality');
const settingsChannelCheckInterval = document.getElementById('settings-channelcheckinterval');
const settingsAutoDownload = document.getElementById('settings-autodownload');
const settingsShortsDurationLimit = document.getElementById('settings-shortsdurationlimit');

// Diğer Butonlar
const syncNowBtn = document.getElementById('sync-now-btn');
const openFolderBtn = document.getElementById('open-folder-btn');
const selectFolderBtn = document.getElementById('select-folder-btn');
const testFolderBtn = document.getElementById('test-folder-btn');

