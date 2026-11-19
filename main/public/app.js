/**
 * HaYTooL YouTube Downloader - İstemci Mantığı (Frontend)
 * 
 * Yapımcı: HaYTo
 * İletişim: korazhayto@gmail.com
 */

import { translations } from './utils/i18n.js';
import { escapeHtml, formatDate, getDaysAgoText, parseSizeToBytes, isShortVideo, parseTimeToSeconds, formatDescriptionTimestamps, parseLikes, parseRelativeTime, debounce, isMembersOnlyVideo, getCatTranslatedName, getVideoRemainingInfo, hasFollowedChannelAvatar, getSiteFaviconInfo, getChannelOrSiteAvatarHtml } from './utils/helpers.js?v=12.3.5.1';
import { showToast, toastSuccess, toastError, toastWarning, toastInfo } from './components/toast.js';
import { renderVideoGrid } from './components/videoCard.js?v=12.3.5.1';
import { renderChannelsList, getChannelsRenderSignature, buildChannelCardElement } from './components/channelRow.js';
window.buildChannelCardElement = buildChannelCardElement;
// Araçlar ve dosya karşılaştırma alt modülü
import './modules/tools.js';
import './modules/remoteStatus.js';
import './modules/fakap.js';
import { classifyDownloadError } from './modules/error-classifier.js';
import { initShortcutsManager, matchesShortcut, renderShortcutsSettingsPanel, renderShortcutsCheatsheetModal } from './modules/shortcuts.js';
import { getDownloadedUserOrder, saveDownloadedUserOrder, sortDownloadedItems, moveDownloadedItemInUserOrder } from './modules/downloadedPlaylist.js';
import { renderPendingMergeSection, updateMergeQueueState, handleMergeProgressEvent } from './modules/mergeQueue.js';
import { renderCliCommandsPanel } from './modules/cliCommands.js';
// Ayarlar, yedekleme ve Gist senkronizasyon alt modülü
import { initSettings, populateGistFields, checkYouTubeAuthStatus, openTempFolder, openFolder, triggerAutoSave, performAutoSave, initSettingsFormListeners, switchSettingsSubtab, initSettingsSubtabs } from './modules/settings.js';
window.openTempFolder = openTempFolder;
window.openFolder = openFolder;
window.triggerAutoSave = triggerAutoSave;
window.performAutoSave = performAutoSave;
window.switchSettingsSubtab = switchSettingsSubtab;
window.initSettingsSubtabs = initSettingsSubtabs;
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
// Temp disk doluluk uyarı alt modülü
import { checkTempSpace, showDiskWarning } from './modules/diskWarning.js';
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
  setCurrentSubtitles,
  isSubtitlesEnabled,
  setSubtitlesEnabled
} from './modules/player/subtitles.js';
window.applySubtitlesToPlayer = applySubtitlesToPlayer;
window.fetchVideoSubtitles = fetchVideoSubtitles;
window.openSubtitleTranslateModal = openSubtitleTranslateModal;
window.isSubtitlesEnabled = isSubtitlesEnabled;
window.setSubtitlesEnabled = setSubtitlesEnabled;

// Sinema Modu (Theater Mode) alt modülü
import { initTheaterMode, toggleTheaterMode, injectTheaterModeButtonToPlyr, isTheaterMode } from './modules/theaterMode.js';
window.initTheaterMode = initTheaterMode;
window.toggleTheaterMode = toggleTheaterMode;
window.injectTheaterModeButtonToPlyr = injectTheaterModeButtonToPlyr;
window.isTheaterMode = isTheaterMode;

// Özel Sağ Tık Bağlam Menüsü ve Fare Orta Tuşu Modülü
import { initContextMenu, closeContextMenu, toggleAppFullscreen } from './modules/contextMenu.js';
window.initContextMenu = initContextMenu;
window.closeContextMenu = closeContextMenu;
window.toggleAppFullscreen = toggleAppFullscreen;

// Gerçek zamanlı SSE (/api/events) ve aktif indirme telemetrisi modülü
import { registerSseClientContext, getEventSource, connectSSE, updateActiveDownloadProgress } from './modules/sseClient.js';
window.getEventSource = getEventSource;
window.connectSSE = connectSSE;
window.updateActiveDownloadProgress = updateActiveDownloadProgress;
registerSseClientContext({
  getLocalDb: () => localDb,
  setLocalDb: (db) => { localDb = db; window.localDb = db; },
  getCurrentLang: () => currentLang,
  getTranslations: () => translations,
  updateUI: (db) => updateUI(db),
  showToast: (msg, type, thumb) => showToast(msg, type, thumb),
  updateDiskSpace: () => updateDiskSpace(),
  updateScanProgressToast: (data) => typeof window.updateScanProgressToast === 'function' && window.updateScanProgressToast(data),
  handleMergeProgressEvent: (data) => handleMergeProgressEvent(data),
  updateMergeQueueState: (data) => updateMergeQueueState(data),
  showDiskWarning: (data) => showDiskWarning(data),
  updateFfmpegInstallUI: (data) => updateFfmpegInstallUI(data),
  showUpdateNotification: (data) => showUpdateNotification(data),
  appendLogToConsoleModal: (data) => appendLogToConsoleModal(data)
});

// Gömülü oynatıcı modalı boyut/sürükleme/küçültme/yönelim/Discord RPC modülü
import {
  registerPlayerModalContext,
  resetAndApplyPlayerDimensions,
  togglePlayerMinimize,
  makeElementDraggable,
  makeElementResizable,
  adjustPlayerOrientation,
  showPlayerTransientOverlay,
  triggerVolumeHUD,
  showActionToast,
  showCenterBounceIcon,
  initVideoTitleOverlay,
  updateVideoTitleOverlay,
  getActivePlayerContainer,
  sendPlayerActivity,
  injectSpeedControlToPlyr,
  getPlayerVolumeStep
} from './modules/playerModal.js';
window.resetAndApplyPlayerDimensions = resetAndApplyPlayerDimensions;
window.togglePlayerMinimize = togglePlayerMinimize;
window.makeElementDraggable = makeElementDraggable;
window.makeElementResizable = makeElementResizable;
window.adjustPlayerOrientation = adjustPlayerOrientation;
window.showPlayerTransientOverlay = showPlayerTransientOverlay;
window.triggerVolumeHUD = triggerVolumeHUD;
window.showActionToast = showActionToast;
window.showCenterBounceIcon = showCenterBounceIcon;
window.initVideoTitleOverlay = initVideoTitleOverlay;
window.updateVideoTitleOverlay = updateVideoTitleOverlay;
window.getActivePlayerContainer = getActivePlayerContainer;
window.sendPlayerActivity = sendPlayerActivity;
window.injectSpeedControlToPlyr = injectSpeedControlToPlyr;
window.getPlayerVolumeStep = getPlayerVolumeStep;
registerPlayerModalContext({
  getLocalDb: () => localDb,
  getVideoPlayerInstance: () => videoPlayerInstance,
  getCurrentPlayingVideoId: () => currentPlayingVideoId
});

// Süresi dolmuş videolar için otomatik silme onay modalı modülü
import {
  registerAutoDeleteModalContext,
  checkPendingAutoDeleteOnLoad,
  openVideoFromAutoDeleteModal,
  showAutoDeleteConfirmModal,
  hideAutoDeleteConfirmModal,
  confirmAutoDeleteAll,
  postponeAutoDelete,
  resetAutoDeletePostponed,
  initAutoDeleteModalButtons
} from './modules/autoDeleteModal.js';
window.checkPendingAutoDeleteOnLoad = checkPendingAutoDeleteOnLoad;
window.openVideoFromAutoDeleteModal = openVideoFromAutoDeleteModal;
window.showAutoDeleteConfirmModal = showAutoDeleteConfirmModal;
window.hideAutoDeleteConfirmModal = hideAutoDeleteConfirmModal;
window.confirmAutoDeleteAll = confirmAutoDeleteAll;
window.postponeAutoDelete = postponeAutoDelete;
window.resetAutoDeletePostponed = resetAutoDeletePostponed;
registerAutoDeleteModalContext({
  getLocalDb: () => localDb,
  getPendingVideos: () => pendingAutoDeleteVideos,
  setPendingVideos: (v) => { pendingAutoDeleteVideos = v; window.pendingAutoDeleteVideos = v; },
  showToast: (msg, type) => showToast(msg, type),
  escapeHtml: (s) => escapeHtml(s),
  updateDiskSpace: () => updateDiskSpace()
});

// Kütüphane ve İndirilenler filtre/sıralama durum kalıcılığı modülü
import {
  registerFilterStateContext,
  saveHistoryFilterState,
  restoreHistoryFilterState,
  saveDownloadedFilterState,
  restoreDownloadedFilterState
} from './modules/filterState.js';
window.saveHistoryFilterState = saveHistoryFilterState;
window.restoreHistoryFilterState = restoreHistoryFilterState;
window.saveDownloadedFilterState = saveDownloadedFilterState;
window.restoreDownloadedFilterState = restoreDownloadedFilterState;
registerFilterStateContext({
  getLocalDb: () => localDb,
  getHistoryViewMode: () => historyViewMode,
  getHistorySortMode: () => historySortMode,
  setHistorySortMode: (v) => { historySortMode = v; },
  getDownloadedSortVal: () => downloadedSortVal,
  setDownloadedSortVal: (v) => { downloadedSortVal = v; },
  getDownloadedViewMode: () => downloadedViewMode,
  getDownloadedOnlyResume: () => downloadedOnlyPartiallyWatched,
  setDownloadedOnlyResume: (v) => { downloadedOnlyPartiallyWatched = !!v; },
  getDownloadedOnlyRemoteChanged: () => downloadedOnlyRemoteChanged,
  setDownloadedOnlyRemoteChanged: (v) => { downloadedOnlyRemoteChanged = !!v; },
  setDownloadedFilterChannel: (v) => { downloadedFilterChannel = v; }
});

window.handleInlineTranslateSubClick = async function() {
  const videoId = window.currentPlayingVideoId;
  if (!videoId) {
    if (typeof showToast === 'function') {
      const lang = window.localDb?.settings?.lang || 'tr';
      showToast((window.translations && window.translations[lang]?.['modal_translate_no_subs']) || 'Lütfen önce bir video oynatın.', 'warning');
    }
    return;
  }
  let subs = (typeof getCurrentSubtitles === 'function' && getCurrentSubtitles().length > 0)
    ? getCurrentSubtitles()
    : await fetchVideoSubtitles(videoId);

  openSubtitleTranslateModal(videoId, subs, {
    playerContainer: document.getElementById('inline-player-body'),
    onComplete: () => {
      if (typeof playVideoEmbedded === 'function') {
        playVideoEmbedded(videoId, window.videoPlayerInstance ? window.videoPlayerInstance.currentTime : null);
      }
    }
  });
};

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
  getChannelActiveFilters,
  handleChannelFilterChange,
  initAddChannelForm,
  openChannelQuickSettingsModal,
  closeChannelQuickSettingsModal
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
window.getChannelActiveFilters = getChannelActiveFilters;
window.handleChannelFilterChange = handleChannelFilterChange;
window.initAddChannelForm = initAddChannelForm;
window.openChannelQuickSettingsModal = openChannelQuickSettingsModal;
window.closeChannelQuickSettingsModal = closeChannelQuickSettingsModal;
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
import { fetchYtdlpVersion, updateYtdlp, initYtdlpEvents } from './modules/ytdlpManager.js';
window.fetchYtdlpVersion = fetchYtdlpVersion;
window.updateYtdlp = updateYtdlp;
window.initYtdlpEvents = initYtdlpEvents;
// İndirici arayüzü alt modülü (tekil/playlist indirme, eksik video kuyruğa ekleme)
import { handleDownloaderStart, handleDownloaderAll, renderPlaylistResults, downloadMissingVideo } from './modules/downloaderUI.js';
// Video yorumları ve sayfalama alt modülü
import { toggleSummaryPanel, copySummaryText, resetSummaryState, regenerateSummary, onSummaryProviderChange, onSummaryModeChange, onSummaryModelChange, useFallbackLocalNlp, seekSummaryVideo } from './modules/videoSummary.js';
window.toggleSummaryPanel = toggleSummaryPanel;
window.copySummaryText = copySummaryText;
window.resetSummaryState = resetSummaryState;
window.regenerateSummary = regenerateSummary;
window.onSummaryProviderChange = onSummaryProviderChange;
window.onSummaryModeChange = onSummaryModeChange;
window.seekSummaryVideo = seekSummaryVideo;
window.onSummaryModelChange = onSummaryModelChange;
window.useFallbackLocalNlp = useFallbackLocalNlp;
import { loadComments, loadMoreComments, renderCommentsList, toggleCommentsPanel, onCommentsProviderChange, onCommentsModelChange, refreshGgufModelsInComments, updateCommentsOutputLangUI, toggleCommentsFlagDropdown, selectCommentsOutputLang, initCommentsPreferences } from './modules/comments.js';
window.onCommentsProviderChange = onCommentsProviderChange;
window.onCommentsModelChange = onCommentsModelChange;
window.refreshGgufModelsInComments = refreshGgufModelsInComments;
window.updateCommentsOutputLangUI = updateCommentsOutputLangUI;
window.toggleCommentsFlagDropdown = toggleCommentsFlagDropdown;
window.selectCommentsOutputLang = selectCommentsOutputLang;
window.initCommentsPreferences = initCommentsPreferences;
// Tema yönetimi ve döngüsel geçiş alt modülü
import { applyTheme, toggleQuickTheme, updateThemeToggleUI } from './modules/theme.js';

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
window._settingsFormPopulated = false;
let currentPlayingVideoId = null;
window.currentPlayingVideoId = null;
let currentLang = 'tr';

// IPTV modülünü başlat ve durum köprüsünü kur
initIptv(() => ({ localDb, currentLang }));
// Ayarlar modülünü başlat ve durum köprüsünü kur
initSettings(() => ({ localDb, currentLang }));

window.isDownloadedBulkDeleteMode = false;
window.isHistoryBulkHideMode = false;
window.historyFilterChannel = 'all';
window.downloadedFilterChannel = 'all';
window.historyFilterDays = 'all';
window.historyOnlyNoAutoDownload = false;
window.historyOnlyNotDownloaded = false;
window.historyOnlyLiveProcessing = false;
window.historyShowLive = true;
window.historyShowUpcoming = false;
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
  
  // İndirilenler sekmesinden çıkış yapılıyorsa ve video oynatılıyorsa mini oynatıcıya KESİNTİSİZ (0ms) geç (IPTV hariç)
  if (activeTab === 'downloaded' && targetTab !== 'downloaded' && targetTab !== 'iptv') {
    const inlineContainer = document.getElementById('downloaded-inline-player-container');
    const isInlineOpen = inlineContainer && !inlineContainer.classList.contains('hidden');
    if (isInlineOpen && currentPlayingVideoId) {
      const didSwitch = window.switchInlinePlayerToModal();
      if (didSwitch) {
        performTabSwitchUI(targetTab);
        if (triggerPushState) {
          applyTabHistory(targetTab, false);
        }
        return;
      }
    }
  }
  
  // Başka sekmeden İndirilenler sekmesine geçiş yapılıyorsa ve modal oynatıcı açıksa (indirilmiş veya indirilmemiş video)
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

          // Oynatıcı başlık, kanal adı, avatar, yorumlar, açıklama ve çalma listesini doğru video ile güncelle
          if (typeof window.setupInlinePlayerPanels === 'function') {
            window.setupInlinePlayerPanels(currentPlayingVideoId, video, [], inlineBody);
          } else {
            if (typeof updateInlinePlayerMetadata === 'function') updateInlinePlayerMetadata(video);
            if (typeof renderDownloadedPlaylist === 'function') renderDownloadedPlaylist(currentPlayingVideoId);
          }

          performTabSwitchUI(targetTab);

          if (videoPlayerInstance && typeof videoPlayerInstance.resize === 'function') {
            setTimeout(() => videoPlayerInstance.resize(), 50);
          }

          if (triggerPushState) {
            applyTabHistory(targetTab, false);
          }
          return;
        }
      } else {
        // İndirilmemiş (uzak YouTube) video yüzen pencerede açıksa İndirilenler sekmesine geçildiğinde yerleşik büyük oynatıcıya büyüt
        let resumeSec = null;
        let wasPaused = false;
        if (videoPlayerInstance) {
          if (typeof videoPlayerInstance.currentTime === 'number' && videoPlayerInstance.currentTime > 1) {
            resumeSec = videoPlayerInstance.currentTime;
          }
          wasPaused = !!videoPlayerInstance.paused;
        }
        performTabSwitchUI(targetTab);
        if (triggerPushState) {
          applyTabHistory(targetTab, false);
        }
        window.playVideoEmbedded(currentPlayingVideoId, resumeSec, wasPaused, false);
        return;
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
    if (typeof window.cleanupWebStreamPlayer === 'function') {
      try { window.cleanupWebStreamPlayer(); } catch (e) {}
    }
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

  if (targetTab === 'settings') {
    if (typeof fetchYtdlpVersion === 'function') fetchYtdlpVersion();
    if (typeof initYtdlpEvents === 'function') initYtdlpEvents();
    if (typeof loadFakapVideosList === 'function') loadFakapVideosList();
  }

  if (triggerPushState) {
    applyTabHistory(targetTab, false);
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
      body: JSON.stringify({ historySortMode })
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
let downloadedFilterPlatform = 'all'; // all, youtube, tiktok, x, instagram
window.downloadedFilterPlatform = 'all';
let downloadedOnlyPartiallyWatched = false;
window.downloadedOnlyPartiallyWatched = downloadedOnlyPartiallyWatched;
let downloadedOnlyRemoteChanged = false;
window.downloadedOnlyRemoteChanged = downloadedOnlyRemoteChanged;

// İndirilen Videolar Tab Elemanları
const downloadedGrid = document.getElementById('downloaded-grid');
window.downloadedGrid = downloadedGrid;
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

// Ayarlar Tab Elemanları ve Butonları ./modules/settings.js içerisinden dinamik olarak yönetilmektedir.

// Türkçe Açıklama: SPA yönlendirmeleri için sekmeler arası gezinme ve HTML5 History API entegrasyonu.
const tabPathMap = {
  history: '/home',
  queue: '/download',
  downloaded: '/downlist',
  channels: '/channels',
  settings: '/settings',
  iptv: '/iptv',
  tools: '/tools',
  downloader: '/downloader',
  webstream: '/webstream'
};

const pathTabMap = {
  '/home': 'history',
  '/download': 'queue',
  '/downlist': 'downloaded',
  '/channels': 'channels',
  '/settings': 'settings',
  '/iptv': 'iptv',
  '/tools': 'tools',
  '/downloader': 'downloader',
  '/webstream': 'webstream',
  '/watch': 'webstream'
};

const validToolsSubSections = ['compare', 'remote-status', 'categories', 'ape', 'subscriptions', 'deleted', 'bulk-delete', 'fakap'];

function normalizeToolsSubSection(sub) {
  return validToolsSubSections.includes(sub) ? sub : 'compare';
}

function parseAppLocation(pathname) {
  const toolsMatch = (pathname || '').match(/^\/tools(?:\/([a-z0-9-]+))?\/?$/);
  if (toolsMatch) {
    return { tab: 'tools', toolsSub: normalizeToolsSubSection(toolsMatch[1] || 'compare') };
  }
  return { tab: pathTabMap[pathname] || 'history', toolsSub: null };
}

function getTabPath(tab) {
  if (tab === 'tools') {
    return '/tools/' + normalizeToolsSubSection(window.currentToolsSubSection || 'compare');
  }
  return tabPathMap[tab];
}

function applyTabHistory(tab, replace) {
  const targetPath = getTabPath(tab);
  if (!targetPath) return;
  const state = {
    tab,
    toolsSub: tab === 'tools' ? normalizeToolsSubSection(window.currentToolsSubSection || 'compare') : undefined
  };
  if (replace) {
    history.replaceState(state, '', targetPath);
    return;
  }
  if (window.location.pathname !== targetPath) {
    history.pushState(state, '', targetPath);
  }
}

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

  // Aktif olmayan ağır sekmelerin DOM listelerini ve görsel önbelleklerini temizle (RAM tasarrufu)
  if (targetTab !== 'history') {
    const hg = document.getElementById('history-grid');
    if (hg && hg.firstChild) {
      hg.innerHTML = '';
      hg._allVideos = null;
    }
    const hop = document.getElementById('history-channel-options-panel');
    if (hop && hop.firstChild) hop.innerHTML = '';
  }
  if (targetTab !== 'downloaded') {
    const dg = document.getElementById('downloaded-grid');
    if (dg && dg.firstChild) {
      dg.innerHTML = '';
      dg._allVideos = null;
    }
    const dop = document.getElementById('downloaded-channel-options-panel');
    if (dop && dop.firstChild) dop.innerHTML = '';
    const dpg = document.getElementById('downloaded-playlist-grid');
    if (dpg && dpg.firstChild) dpg.innerHTML = '';
  }
  if (targetTab !== 'queue') {
    const ql = document.getElementById('queue-list');
    if (ql && ql.firstChild) ql.innerHTML = '';
    const qcl = document.getElementById('queue-completed-list');
    if (qcl && qcl.firstChild) qcl.innerHTML = '';
    const qfl = document.getElementById('queue-failed-list');
    if (qfl && qfl.firstChild) qfl.innerHTML = '';
    if (typeof syncActiveThumbCycle === 'function') syncActiveThumbCycle(false);
  }
  if (targetTab !== 'channels') {
    const cl = document.getElementById('channels-list');
    if (cl && cl.firstChild) {
      cl.innerHTML = '';
      window._lastChannelsRenderSignature = null;
    }
  }
  if (targetTab !== 'iptv') {
    const icl = document.getElementById('iptv-channel-list');
    if (icl && icl.firstChild) {
      icl.innerHTML = '';
    }
  }

  // Yeni açılan sekmenin ikonlarını yalnızca o sekme aktif olduğunda oluştur
  const activeTabEl = document.getElementById(`tab-${targetTab}`);
  if (activeTabEl && typeof lucide !== 'undefined' && typeof lucide.createIcons === 'function') {
    try { lucide.createIcons({ root: activeTabEl }); } catch (e) {}
  }

  // Yeni açılan sekme veri odaklıysa anında çiz
  if ((targetTab === 'history' || targetTab === 'downloaded' || targetTab === 'channels' || targetTab === 'queue' || targetTab === 'tools' || targetTab === 'settings') && localDb && localDb.history) {
    requestAnimationFrame(() => updateUI(localDb));
  }

  if (targetTab === 'settings' && typeof window.initSettingsSubtabs === 'function') {
    window.initSettingsSubtabs();
  }

  if (targetTab === 'webstream' && typeof window.initWebStreamTab === 'function') {
    window.initWebStreamTab();
  }

  // Sekme değiştirildiğinde ana içerik alanını en yukarı kaydır
  const mainContent = document.querySelector('.main-content');
  if (mainContent) {
    mainContent.scrollTop = 0;
  }
}

// Tarayıcı Geri/İleri Buton Dinleyicisi
window.addEventListener('popstate', (event) => {
  const parsed = parseAppLocation(window.location.pathname);
  const tabId = (event.state && event.state.tab) || parsed.tab || 'history';
  if (tabId === 'tools') {
    window.currentToolsSubSection = (event.state && event.state.toolsSub) || parsed.toolsSub || 'compare';
  }
  switchTab(tabId, false);
});

// SSE (/api/events) ve aktif indirme ilerleme telemetrisi -> ./modules/sseClient.js

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
      body: JSON.stringify({ showShorts })
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

  if (checkboxId === 'history-show-upcoming') {
    window.historyShowUpcoming = cb.checked;
    if (!currentDb.settings) currentDb.settings = {};
    currentDb.settings.historyShowUpcoming = cb.checked;
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
    'history-show-upcoming': 'btn-filter-show-upcoming',
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
    body: JSON.stringify({ showShorts: !!showShorts })
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
    'history-show-upcoming',
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
  if (window.isCapturingShortcut) return;
  if (e.key === 'Escape') {
    const shortcutsModal = document.getElementById('shortcuts-modal');
    if (shortcutsModal && !shortcutsModal.classList.contains('hidden')) {
      if (typeof window.closeShortcutsModal === 'function') window.closeShortcutsModal();
      return;
    }
    const panel = document.getElementById('history-filters-panel');
    if (panel) panel.classList.remove('open');
  }

  // Kısayol rehberi modalını aç (varsayılan '?')
  if (matchesShortcut(e, 'global_shortcuts_help')) {
    const activeEl = document.activeElement;
    const isTyping = activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.isContentEditable);
    if (!isTyping) {
      e.preventDefault();
      const iptvTab = document.getElementById('tab-iptv');
      const isIptv = iptvTab && !iptvTab.classList.contains('hidden') && iptvTab.style.display !== 'none';
      if (typeof window.openShortcutsModal === 'function') {
        window.openShortcutsModal(isIptv ? 'iptv' : 'player');
      }
    }
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

  if (!document.fullscreenElement && typeof window.initCustomTitlebar === 'function') {
    window.initCustomTitlebar();
  }

  // 1. Sistem Durum Detayları
  const lang = db.settings?.lang || currentLang || 'tr';
  const t = translations[lang] || translations.tr;
  
  // YouTube Oturum ve Çerez Rozeti: yalnızca uygulama açılışında kontrol edilir.
  // Sonraki güncellemeler sunucunun periyodik çerez denetiminden (Ayarlar → Denetleme Sıklığı)
  // gelen 'cookie_status' SSE olayıyla yapılır; tarayıcıda ayrı bir zamanlayıcı yoktur.
  if (typeof window.checkYouTubeAuthStatus === 'function' && !window._youtubeAuthChecked) {
    window._youtubeAuthChecked = true;
    window.checkYouTubeAuthStatus();
  }
  
  const qualityNames = {
    best: t.status_best_quality || 'En Yüksek',
    '2160p': '2160p 4K',
    '1440p': '1440p QHD',
    '1080p': '1080p FHD',
    '720p': '720p HD',
    '480p': '480p',
    '360p': '360p',
    audio_only: t.status_audio_only || 'Audio Only'
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
        const thumbImg = document.getElementById('active-thumbnail-img');
        const thumbPlc = document.getElementById('active-thumbnail-placeholder');
        if (thumbImg && thumbPlc) {
          window._activeVideoId = activeDownload.id;
          const isExt = activeDownload.platform && activeDownload.platform !== 'youtube';
          const thumbUrl = (activeDownload.thumbnail && activeDownload.thumbnail.startsWith('http'))
            ? activeDownload.thumbnail
            : (isExt ? `/api/video/${activeDownload.id}/thumbnail` : (activeDownload.id ? 'https://i.ytimg.com/vi/' + activeDownload.id + '/mqdefault.jpg' : ''));
          if (thumbUrl) {
            if (thumbImg.dataset.baseUrl !== thumbUrl) {
              thumbImg.dataset.baseUrl = thumbUrl;
              thumbImg.src = thumbUrl;
              const thumbWrap = document.getElementById('active-thumbnail-wrapper');
              if (thumbWrap) {
                thumbWrap.setAttribute('data-video-id', activeDownload.id || '');
                if (thumbWrap._thumbTimer) { clearInterval(thumbWrap._thumbTimer); thumbWrap._thumbTimer = null; }
              }
            }
            thumbImg.style.display = 'block';
            if (typeof syncActiveThumbCycle === 'function') syncActiveThumbCycle(true);
            thumbPlc.style.display = 'none';
          } else {
            thumbImg.style.display = 'none';
            thumbPlc.style.display = 'block';
          }
        }
        const hudSpeed = document.getElementById('active-speed-val');
        if (hudSpeed) hudSpeed.textContent = activeDownload.speed || '0 KB/s';
      }
      if (activeSpeed) activeSpeed.textContent = activeDownload.speed || '0 KB/s';
    } else if (activeMerging) {
      if (noActiveDownload) noActiveDownload.classList.add('hidden');
      if (activeDownloadDetails) {
        activeDownloadDetails.classList.remove('hidden');
        if (activeTitle) activeTitle.textContent = activeMerging.title;
        if (activeChannel) activeChannel.textContent = activeMerging.channelName;
        const mergePct = typeof activeMerging.progress === 'number' ? activeMerging.progress : 0;
        if (activeProgressBar) activeProgressBar.style.width = `${mergePct}%`;
        if (activePercent) {
          const mergeText = (t.status_merging || 'Birleştiriliyor (FFmpeg)...').replace(/\.+$/, '');
          activePercent.textContent = `${mergeText}: %${mergePct}`;
        }
        if (activeSize) activeSize.textContent = activeMerging.fileSize || '-- MB';
        if (activeEta) activeEta.textContent = activeMerging.eta || '--:--';
        const thumbImg = document.getElementById('active-thumbnail-img');
        const thumbPlc = document.getElementById('active-thumbnail-placeholder');
        if (thumbImg && thumbPlc) {
          window._activeVideoId = activeMerging.id;
          const isExt = activeMerging.platform && activeMerging.platform !== 'youtube';
          const thumbUrl = (activeMerging.thumbnail && activeMerging.thumbnail.startsWith('http'))
            ? activeMerging.thumbnail
            : (isExt ? `/api/video/${activeMerging.id}/thumbnail` : (activeMerging.id ? 'https://i.ytimg.com/vi/' + activeMerging.id + '/mqdefault.jpg' : ''));
          if (thumbUrl) {
            if (thumbImg.dataset.baseUrl !== thumbUrl) {
              thumbImg.dataset.baseUrl = thumbUrl;
              thumbImg.src = thumbUrl;
              const thumbWrap = document.getElementById('active-thumbnail-wrapper');
              if (thumbWrap) {
                thumbWrap.setAttribute('data-video-id', activeMerging.id || '');
                if (thumbWrap._thumbTimer) { clearInterval(thumbWrap._thumbTimer); thumbWrap._thumbTimer = null; }
              }
            }
            thumbImg.style.display = 'block';
            if (typeof syncActiveThumbCycle === 'function') syncActiveThumbCycle(true);
            thumbPlc.style.display = 'none';
          } else {
            thumbImg.style.display = 'none';
            thumbPlc.style.display = 'block';
          }
        }
        const hudSpeed = document.getElementById('active-speed-val');
        if (hudSpeed) hudSpeed.textContent = activeMerging.speed || 'FFmpeg...';
      }
      if (activeSpeed) activeSpeed.textContent = activeMerging.speed || 'FFmpeg...';
    } else {
      if (noActiveDownload) noActiveDownload.classList.remove('hidden');
      if (activeDownloadDetails) activeDownloadDetails.classList.add('hidden');
      if (typeof syncActiveThumbCycle === 'function') syncActiveThumbCycle(false);
      if (activeSpeed) activeSpeed.textContent = '0 MB/s';
    }

    const isQueueActive = !!document.getElementById('tab-queue')?.classList.contains('active');
    if (!isQueueActive && typeof syncActiveThumbCycle === 'function') {
      syncActiveThumbCycle(false);
    }

    // 4. Kuyruk Sayacı (Her zaman üst bar rozeti için güncellenir) ve Kuyruk Listesi (Yalnızca Kuyruk sekmesi aktifse çizilir)
    const isFakapRow = (h) => h && (h.isFakap === true || String(h.id || '').startsWith('fakap_'));
    const mergingVideos = db.history.filter(h => h.status === 'merging' && h.hidden !== true && !isFakapRow(h));
    const downloadingVideos = db.history.filter(h => h.status === 'downloading' && h.hidden !== true && !isFakapRow(h));
    const waitingVideosAll = db.history.filter(h => h.status === 'waiting' && h.hidden !== true && !isFakapRow(h));
    const allActiveQueue = [...downloadingVideos, ...waitingVideosAll];
    const totalQueueCount = allActiveQueue.length + mergingVideos.length;

    const navQueueCountBadge = document.getElementById('nav-queue-count-badge');
    if (navQueueCountBadge) {
      navQueueCountBadge.textContent = totalQueueCount;
    }
    if (statWaitingCount) {
      statWaitingCount.textContent = totalQueueCount;
    }

    if (queueList && isQueueActive) {
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

      // Fakap yedekleri kuyrukta satır olarak görünmez; üstte tek satır özet gösterilir.
      const fakapActiveItems = db.history.filter(h => isFakapRow(h) && (h.status === 'waiting' || h.status === 'downloading' || h.status === 'merging'));
      const fakapActiveCount = fakapActiveItems.length;
      const fakapAvgPct = fakapActiveCount
        ? Math.round(fakapActiveItems.reduce((sum, h) => sum + (Number(h.progress) || 0), 0) / fakapActiveCount)
        : 0;
      const fakapSummaryHtml = fakapActiveCount > 0
        ? `<div class="fakap-queue-summary" onclick="if(typeof switchTab==='function')switchTab('tools');if(typeof switchToolsSubSection==='function')switchToolsSubSection('fakap')" title="${isEn ? 'Open Fakap backups' : 'Fakap yedeklerini aç'}">
             <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14" aria-hidden="true"><rect x="3" y="4" width="18" height="4" rx="1"/><path d="M5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8"/><path d="M10 12h4"/></svg>
             <span>${isEn ? 'Fakap backup' : 'Fakap yedeği'}: <strong>${fakapActiveCount}</strong> ${isEn ? 'active' : 'aktif'} · %${fakapAvgPct}</span>
             <span class="fakap-queue-summary-link">${isEn ? 'Tools > Fakap' : 'Araçlar > Fakap'} →</span>
           </div>`
        : '';
      
      if (allActiveQueue.length === 0 && mergingVideos.length === 0) {
        // Kuyruk boş görünse de Fakap yedeği indiriliyor olabilir; kullanıcıya bunu sessizce bildir.
        queueList.innerHTML = `
          <div class="text-center text-muted" id="queue-list-empty" style="padding: 30px 0; font-size: 0.85rem;">${isEn ? 'No videos waiting in the queue.' : 'Kuyrukta bekleyen video yok.'}</div>
          ${fakapSummaryHtml}
        `;
      } else {
        if (fakapSummaryHtml) queueList.insertAdjacentHTML('beforeend', fakapSummaryHtml);
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
              item.style.setProperty('--dl-progress', `${video.progress || 0}%`);
            } else {
              item.setAttribute('draggable', 'true');
              if (isDownloading) {
                item.className += ' queue-item-downloading';
                item.style.borderColor = 'rgba(16, 185, 129, 0.3)';
                item.style.background = 'rgba(16, 185, 129, 0.03)';
                item.style.setProperty('--dl-progress', `${video.progress || 0}%`);
              }
            }

            item.innerHTML = `
              <div style="display:flex; align-items:center; gap:6px;">
                <div class="queue-item-drag-handle" style="cursor: ${isMerging ? 'not-allowed' : 'grab'}; color: var(--text-muted);" title="${isMerging ? (isEn ? 'Merging process cannot be reordered' : 'Birleştirme işlemi sıralanamaz') : (t.drag_drop_hint || 'Sürükleyin')}">
                  ${isMerging ? '<i data-lucide="loader" class="spin-animation" style="width:14px; height:14px; color: #eab308;"></i>' : '<i data-lucide="grip-vertical" style="width:14px; height:14px;"></i>'}
                </div>
                <span class="queue-order-badge">${orderNoStr}</span>
              </div>
              <div class="queue-thumb-container video-thumbnail-wrapper" data-video-id="${video.id}" data-platform="${video.platform || 'youtube'}" onmouseenter="handleThumbMouseEnter(this)" onmouseleave="handleThumbMouseLeave(this)" style="position: relative;" title="${escapeHtml(video.title)}">
                <img src="${(video.thumbnail && video.thumbnail.startsWith('http')) ? video.thumbnail : ((video.platform && video.platform !== 'youtube') ? ('/api/video/' + video.id + '/thumbnail') : ('https://i.ytimg.com/vi/' + video.id + '/mqdefault.jpg'))}" class="video-thumbnail queue-item-thumbnail" width="120" height="68" loading="lazy" decoding="async" onerror="this.onerror=null; this.src='/api/video/${video.id}/thumbnail'">
              </div>
              <div class="queue-item-title" title="${escapeHtml(video.title)}" style="font-weight:600; color:var(--text-main); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; display:flex; align-items:center; gap:6px;">
                <span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escapeHtml(video.title)}</span>
                ${(video.retryAttempt === 2 || video._singleFragmentMode) ? `
                  <span class="queue-retry-badge" title="${t.queue_retry_badge_title || ''}">
                    <i data-lucide="rotate-ccw"></i>
                    <span>${t.queue_retry_badge || '2. Deneme (Son Şans)'}</span>
                  </span>
                ` : ''}
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
                    <span>${t.status_merging_short || (isEn ? 'Merging' : 'Birleştiriliyor')} %${video.progress || 0}</span>
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
              item.style.setProperty('--dl-progress', `${video.progress || 0}%`);
            } else {
              item.setAttribute('draggable', 'true');
              if (isDownloading) {
                item.className += ' queue-item-downloading';
                item.style.borderColor = 'rgba(16, 185, 129, 0.3)';
                item.style.background = 'rgba(16, 185, 129, 0.03)';
                item.style.setProperty('--dl-progress', `${video.progress || 0}%`);
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
              <div class="queue-thumb-container video-thumbnail-wrapper" data-video-id="${video.id}" data-platform="${video.platform || 'youtube'}" onmouseenter="handleThumbMouseEnter(this)" onmouseleave="handleThumbMouseLeave(this)" title="${escapeHtml(video.title)}">
                <img src="${(video.thumbnail && video.thumbnail.startsWith('http')) ? video.thumbnail : ((video.platform && video.platform !== 'youtube') ? ('/api/video/' + video.id + '/thumbnail') : ('https://i.ytimg.com/vi/' + video.id + '/mqdefault.jpg'))}" class="video-thumbnail queue-item-thumbnail" width="120" height="68" loading="lazy" decoding="async" onerror="this.onerror=null; this.src='/api/video/${video.id}/thumbnail'">
              </div>
              <div class="queue-item-info" style="flex:1; min-width:0;">
                <div class="queue-item-title" title="${escapeHtml(video.title)}" style="font-weight:600; color:var(--text-main); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; margin-bottom:4px; display:flex; align-items:center; gap:6px;">
                  <span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escapeHtml(video.title)}</span>
                  ${(video.retryAttempt === 2 || video._singleFragmentMode) ? `
                    <span class="queue-retry-badge" title="${t.queue_retry_badge_title || ''}">
                      <i data-lucide="rotate-ccw"></i>
                      <span>${t.queue_retry_badge || '2. Deneme (Son Şans)'}</span>
                    </span>
                  ` : ''}
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
                      <span>${t.status_merging_short || (isEn ? 'Merging' : 'Birleştiriliyor')} %${video.progress || 0}</span>
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

    // 4.2. Alt Bölüm: Son İndirilen Videolar (Sol) ve Hata Alanlar & Denenenler (Sağ) - Yalnızca Kuyruk sekmesi aktifse çizilir
    const queueCompletedList = document.getElementById('queue-completed-list');
    const queueFailedList = document.getElementById('queue-failed-list');
    const completedCountEl = document.getElementById('queue-completed-count');
    const failedCountEl = document.getElementById('queue-failed-count');

    if (db.history && isQueueActive) {
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
                <div class="queue-thumb-container video-thumbnail-wrapper" data-video-id="${video.id}" data-platform="${video.platform || 'youtube'}" onmouseenter="handleThumbMouseEnter(this)" onmouseleave="handleThumbMouseLeave(this)" title="${escapeHtml(video.title)}">
                  <img src="/api/video/${video.id}/thumbnail" class="video-thumbnail queue-item-thumbnail" width="120" height="68" loading="lazy" decoding="async" onerror="this.onerror=null; this.src='/logo.png'">
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
                <div class="queue-thumb-container video-thumbnail-wrapper" data-video-id="${video.id}" data-platform="${video.platform || 'youtube'}" onmouseenter="handleThumbMouseEnter(this)" onmouseleave="handleThumbMouseLeave(this)" title="${escapeHtml(video.title)}">
                  <img src="/api/video/${video.id}/thumbnail" class="video-thumbnail queue-item-thumbnail" width="120" height="68" loading="lazy" decoding="async" onerror="this.onerror=null; this.src='/logo.png'">
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
            const failDate = video.failedAt || video.downloadedAt || video.publishedAt;
            let failTimeStr = '';
            let failFullDate = '';
            if (failDate) {
              const d = new Date(failDate);
              if (!isNaN(d.getTime())) {
                const hh = String(d.getHours()).padStart(2, '0');
                const mm = String(d.getMinutes()).padStart(2, '0');
                failTimeStr = `${hh}:${mm}`;
                failFullDate = `${d.toLocaleDateString()} ${hh}:${mm}`;
              }
            }
            const item = document.createElement('div');
            item.setAttribute('data-id', video.id);
            const orderNoStr = `#${(idx + 1).toString().padStart(2, '0')}`;
            const durationStr = video.duration || '--:--';
            const rawError = video.error || '';
            const classifiedErr = classifyDownloadError(rawError, t);
            const shortError = classifiedErr.shortLabel;
            const errorTooltip = classifiedErr.fullTooltip;

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
                <img src="${(video.platform && video.platform !== 'youtube') ? (video.thumbnail || '/api/video/' + video.id + '/thumbnail') : ('https://i.ytimg.com/vi/' + video.id + '/mqdefault.jpg')}" class="video-thumbnail queue-item-thumbnail" width="120" height="68" loading="lazy" decoding="async" onerror="this.src='/logo.png'">
                </div>
                <div style="min-width:0; overflow:hidden;">
                  <div class="queue-item-title" title="${escapeHtml(video.title)}" style="font-weight:600; color:var(--text-main); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:0.78rem;">
                    ${escapeHtml(video.title)}
                  </div>
                  <div style="display:flex; align-items:center; gap:6px; margin-top:2px;">
                    <span class="queue-meta-pill queue-meta-pill-error" title="${escapeHtml(errorTooltip)}">
                      <i data-lucide="alert-triangle" style="width:9px; height:9px; flex-shrink:0;"></i>
                      <span>${escapeHtml(shortError)}</span>
                    </span>
                    ${failTimeStr ? `<span class="queue-meta-pill queue-meta-pill-time" title="${isEn ? 'Error Time' : 'Hata Saati'}: ${failFullDate}" style="font-size:0.7rem; color:var(--text-muted); background:rgba(255,255,255,0.04);"><i data-lucide="clock" style="width:9px; height:9px; flex-shrink:0;"></i><span>${failTimeStr}</span></span>` : ''}
                  </div>
                </div>
                <div>
                  <span class="queue-meta-pill queue-meta-pill-duration" title="${t.queue_col_duration || 'Süre'}">
                    <i data-lucide="clock" style="width:9px; height:9px;"></i>
                    <span>${durationStr}</span>
                  </span>
                </div>
                <div style="display:flex; align-items:center; justify-content:flex-end; gap:4px;">
                  <button class="btn-play-queue" onclick="openYouTube('${video.id}')" aria-label="${isEn ? 'Open in YouTube' : 'YouTube üzerinde aç'}" title="${isEn ? 'Open in YouTube' : 'YouTube üzerinde aç'}" style="padding: 4px 8px; font-size: 0.72rem; min-height: 28px; min-width: 28px; display:inline-flex; align-items:center; gap:2px;">
                    <i data-lucide="external-link" style="width:10px; height:10px;"></i>
                  </button>
                  <button class="btn-retry-queue" onclick="retryFailedVideo('${video.id}')" aria-label="${t.card_retry_download || 'Yeniden Dene'}" title="${t.card_retry_download || 'Yeniden Dene'}" style="padding: 4px 8px; font-size: 0.72rem; min-height: 28px; min-width: 28px; display:inline-flex; align-items:center; gap:2px;">
                    <i data-lucide="rotate-ccw" style="width:10px; height:10px;"></i>
                    <span>${t.card_retry_download || 'Tekrar'}</span>
                  </button>
                  <button class="btn-cancel-queue btn-delete-failed" onclick="clearFailedVideo('${video.id}')" aria-label="${isEn ? 'Delete' : 'Sil'}" title="${isEn ? 'Delete from list and ignore' : 'Hata kaydını sil ve indirilmesini engelle'}" style="padding: 4px 8px; font-size: 0.72rem; min-height: 28px; min-width: 28px; display:inline-flex; align-items:center; gap:2px;">
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
                  <div class="queue-item-status-icon" style="display:flex; align-items:center; justify-content:center; color:#ef4444;" title="${escapeHtml(shortError)}">
                    <i data-lucide="alert-circle" style="width:14px; height:14px; color:#ef4444;"></i>
                  </div>
                  <span class="queue-order-badge" style="background: rgba(239, 68, 68, 0.1); color: #ef4444; border-color: rgba(239, 68, 68, 0.25);">${orderNoStr}</span>
                </div>
                <div class="queue-thumb-container video-thumbnail-wrapper" data-video-id="${video.id}" onmouseenter="handleThumbMouseEnter(this)" onmouseleave="handleThumbMouseLeave(this)" title="${escapeHtml(video.title)}">
                <img src="${(video.platform && video.platform !== 'youtube') ? (video.thumbnail || '/api/video/' + video.id + '/thumbnail') : ('https://i.ytimg.com/vi/' + video.id + '/mqdefault.jpg')}" class="video-thumbnail queue-item-thumbnail" width="120" height="68" loading="lazy" decoding="async" onerror="this.src='/logo.png'">
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
                    <span class="queue-meta-pill queue-meta-pill-error" title="${escapeHtml(errorTooltip)}">
                      <i data-lucide="alert-triangle" style="width:9px; height:9px;"></i>
                      <span>${escapeHtml(shortError)}</span>
                    </span>
                    ${failTimeStr ? `<span class="queue-meta-pill queue-meta-pill-time" title="${isEn ? 'Error Time' : 'Hata Saati'}: ${failFullDate}"><i data-lucide="clock" style="width:9px; height:9px;"></i><span>${failTimeStr}</span></span>` : ''}
                  </div>
                </div>
                <div class="queue-item-actions">
                  <button class="btn-play-queue" onclick="openYouTube('${video.id}')" aria-label="${isEn ? 'Open in YouTube' : 'YouTube üzerinde aç'}" title="${isEn ? 'Open in YouTube' : 'YouTube üzerinde aç'}">
                    <i data-lucide="external-link"></i>
                    <span>YouTube</span>
                  </button>
                  <button class="btn-retry-queue" onclick="retryFailedVideo('${video.id}')" aria-label="${t.card_retry_download || 'Yeniden Dene'}" title="${t.card_retry_download || 'Yeniden Dene'}">
                    <i data-lucide="rotate-ccw"></i>
                    <span>${t.card_retry_download || 'Tekrar'}</span>
                  </button>
                  <button class="btn-cancel-queue btn-delete-failed" onclick="clearFailedVideo('${video.id}')" aria-label="${isEn ? 'Delete' : 'Sil'}" title="${isEn ? 'Delete from list and ignore' : 'Hata kaydını sil ve indirilmesini engelle'}">
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
        if (typeof lucide !== 'undefined' && typeof lucide.createIcons === 'function') {
          const qTab = document.getElementById('tab-queue');
          lucide.createIcons(qTab ? { root: qTab } : undefined);
        }
      } catch (e) {}
    }
  }

  // 5. Kanallar Listesi (Alfabetik Sıralı & Filtreli - Akıllı İmza ve Odak Korumalı)
  const isChannelsTabActive = document.getElementById('tab-channels')?.classList.contains('active');
  if (channelsList && db.channels && isChannelsTabActive) {
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

  // Kategori Yönetimi Arayüzünü Yükle (Yalnızca Araçlar Sekmesi Aktifse)
  const isToolsTabActive = !!document.getElementById('tab-tools')?.classList.contains('active');
  if (isToolsTabActive) {
    try {
      if (typeof loadCategoriesToTools === 'function') {
        loadCategoriesToTools(db.categories);
      }
    } catch (err) {
      console.error('loadCategoriesToTools çalıştırılırken hata:', err);
    }
  }

  // 6. Kanal Filtresi Seçeneklerini Doldur (Standart Doğal Seçim Listesi)
  try {
    populateChannelFilters(db);
  } catch (err) {
    console.error('Kanal filtresi doldurulurken hata oluştu:', err);
  }



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
  if (typeof syncDownloadedSortButtons === 'function') {
    syncDownloadedSortButtons(downloadedSortVal);
  }
  if (typeof updateDownloadedViewButtonUI === 'function') {
    updateDownloadedViewButtonUI();
  }
  const dlShortsBtn = document.getElementById('btn-dl-show-shorts');
  if (dlShortsBtn) {
    dlShortsBtn.classList.toggle('active', db.settings?.showShorts !== false);
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
    const showLiveVal = localDb.settings?.historyShowLive !== undefined ? localDb.settings.historyShowLive !== false : window.historyShowLive !== false;
    window.historyShowLive = showLiveVal;
    historyShowLiveCheck.checked = showLiveVal;
    syncFilterChipUI('history-show-live');
  }
  const historyShowUpcomingCheck = document.getElementById('history-show-upcoming');
  if (historyShowUpcomingCheck) {
    const showUpcomingVal = localDb.settings?.historyShowUpcoming !== undefined ? localDb.settings.historyShowUpcoming === true : window.historyShowUpcoming === true;
    window.historyShowUpcoming = showUpcomingVal;
    historyShowUpcomingCheck.checked = showUpcomingVal;
    syncFilterChipUI('history-show-upcoming');
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

  const isHistoryActive = !!document.getElementById('tab-history')?.classList.contains('active');
  const isDownloadedActive = !!document.getElementById('tab-downloaded')?.classList.contains('active');

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
      } else if (historyFilterChannel.startsWith('platform:')) {
        const targetPlat = historyFilterChannel.split(':')[1];
        filteredHistory = filteredHistory.filter(item => {
          const p = item.platform || (typeof detectVideoPlatform === 'function' ? detectVideoPlatform(item) : 'youtube');
          return p === targetPlat;
        });
      } else {
        filteredHistory = filteredHistory.filter(item => item.channelId === historyFilterChannel);
      }
    }
    
    if (window.historyOnlyNoAutoDownload) {
      const disabledChannelIds = new Set((db.channels || []).filter(c => c.autoDownload === false).map(c => c.id));
      filteredHistory = filteredHistory.filter(item => disabledChannelIds.has(item.channelId));
    }
    
    if (window.historyOnlyLiveProcessing) {
      filteredHistory = filteredHistory.filter(item => item.status === 'waiting_live_processing' || item.status === 'live_processing');
    } else if (db.settings.liveStreamHandling === 'ignore_live') {
      filteredHistory = filteredHistory.filter(item =>
        item.status !== 'live' &&
        item.status !== 'upcoming' &&
        item.status !== 'waiting_live_processing' &&
        item.status !== 'live_processing' &&
        item.duration !== 'live' &&
        item.duration !== 'upcoming'
      );
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
      filteredHistory = filteredHistory.filter(item => !isShortVideo(item.duration, item.title, item.channelId, item));
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
    
    // Yüklenme tarihine göre sırala (Yeni olan en üstte; yayın tarihi belirsiz olanlar gerçek tarihlilerin önüne geçemez)
    const getValidPubOrDlTime = (item) => {
      if (item.publishedAt && item.publishedAt !== '-') {
        const t = new Date(item.publishedAt).getTime();
        if (!isNaN(t) && t > 0) return t;
      }
      if (item.downloadedAt && item.downloadedAt !== '-') {
        const t = new Date(item.downloadedAt).getTime();
        if (!isNaN(t) && t > 0) return t;
      }
      return 0;
    };
    filteredHistory.sort((a, b) => getValidPubOrDlTime(b) - getValidPubOrDlTime(a));

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

    // Silinen/gizlenen ve zaten indirilmiş (completed) videoları kanal başına limit uygulandıktan sonra filtrele ki
    // kanalın son videolar kontenjanını kaplasınlar ve yerlerine aylarca önceki eski videolar sızmasın.
    if (!window.historyShowHidden) {
      filteredHistory = filteredHistory.filter(item => item.hidden !== true);
    }
    if (window.historyOnlyNotDownloaded) {
      filteredHistory = filteredHistory.filter(item => item.status !== 'completed');
    }
    if (!window.historyOnlyLiveProcessing) {
      const showLive = db.settings.historyShowLive !== undefined ? db.settings.historyShowLive !== false : window.historyShowLive !== false;
      if (!showLive) {
        filteredHistory = filteredHistory.filter(item =>
          !(item.status === 'live' || (item.duration === 'live' && item.status !== 'waiting_live_processing' && item.status !== 'live_processing'))
        );
      }
      const showUpcoming = db.settings.historyShowUpcoming !== undefined ? db.settings.historyShowUpcoming === true : window.historyShowUpcoming === true;
      if (!showUpcoming) {
        filteredHistory = filteredHistory.filter(item => item.status !== 'upcoming' && item.duration !== 'upcoming');
      }
    }

    // Kütüphane sıralama uygula (configwin.ini / db.settings historySortMode)
    const getSortDateStr = (item) => (item.publishedAt && item.publishedAt !== '-') ? item.publishedAt : (item.downloadedAt || '');
    if (historySortMode === 'date-asc') {
      filteredHistory.sort((a, b) => getSortDateStr(a).localeCompare(getSortDateStr(b)));
    } else if (historySortMode === 'title') {
      filteredHistory.sort((a, b) => (a.title || '').localeCompare(b.title || '', undefined, { sensitivity: 'base' }));
    } else if (historySortMode === 'duration') {
      filteredHistory.sort((a, b) => (parseTimeToSeconds(b.duration) || 0) - (parseTimeToSeconds(a.duration) || 0));
    } else {
      filteredHistory.sort((a, b) => getSortDateStr(b).localeCompare(getSortDateStr(a)));
    }
    
    renderVideoGrid(historyGrid, filteredHistory, historyViewMode);
  }

  // İndirilen Videoları filtrele ve çiz (Sadece İndirilenler sekmesi aktifse)
  if (downloadedGrid && db.history && db.settings && isDownloadedActive) {
    // Fakap yedekleri "İndirilenler" listesinde gösterilmez; kendi sayfasında (Araçlar > Fakap) listelenir.
    let filteredDownloaded = db.history.filter(item => item.status === 'completed' && !(item.isFakap === true || String(item.id || '').startsWith('fakap_')));
    
    if (typeof applyDownloadedChannelAndCategoryFilter === 'function') {
      filteredDownloaded = applyDownloadedChannelAndCategoryFilter(filteredDownloaded, db);
    } else if (downloadedFilterChannel !== 'all') {
      if (downloadedFilterChannel.startsWith('category:')) {
        const catId = parseInt(downloadedFilterChannel.split(':')[1], 10);
        const channelIdsInCat = (db.channels || []).filter(c => (c.categoryIds || [c.categoryId || 1]).includes(catId)).map(c => c.id);
        const channelIdsInCatSet = new Set(channelIdsInCat);
        filteredDownloaded = filteredDownloaded.filter(item => channelIdsInCatSet.has(item.channelId));
      } else if (downloadedFilterChannel.startsWith('platform:')) {
        const targetPlat = downloadedFilterChannel.split(':')[1];
        filteredDownloaded = filteredDownloaded.filter(item => {
          const p = item.platform || (typeof detectVideoPlatform === 'function' ? detectVideoPlatform(item) : 'youtube');
          return p === targetPlat;
        });
      } else {
        filteredDownloaded = filteredDownloaded.filter(item => item.channelId === downloadedFilterChannel);
      }
    }

    if (downloadedFilterPlatform && downloadedFilterPlatform !== 'all') {
      filteredDownloaded = filteredDownloaded.filter(item => {
        const p = item.platform || (typeof detectVideoPlatform === 'function' ? detectVideoPlatform(item) : 'youtube');
        return p === downloadedFilterPlatform;
      });
    }
    
    const showShorts = db.settings.showShorts !== false;
    if (!showShorts) {
      filteredDownloaded = filteredDownloaded.filter(item => !isShortVideo(item.duration, item.title, item.channelId, item));
    }

    // Video başlığı veya kanal adına göre anlık arama
    const dlSearchInput = document.getElementById('downloaded-search-input');
    const dlSearchQuery = ((dlSearchInput ? dlSearchInput.value : window.downloadedSearchQuery) || '').trim().toLowerCase();
    if (dlSearchQuery) {
      filteredDownloaded = filteredDownloaded.filter(item => {
        const title = (item.title || '').toLowerCase();
        const chName = (item.channelName || '').toLowerCase();
        return title.includes(dlSearchQuery) || chName.includes(dlSearchQuery);
      });
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

    const isRemoteChangedVideo = (item) => ['deleted', 'unlisted', 'private', 'members_only'].includes(item.remoteStatus);
    const remoteChangedCount = filteredDownloaded.filter(isRemoteChangedVideo).length;
    const remoteChangedBadge = document.getElementById('badge-remote-changed-count');
    if (remoteChangedBadge) {
      remoteChangedBadge.textContent = remoteChangedCount;
      remoteChangedBadge.style.display = remoteChangedCount > 0 ? 'inline-block' : 'none';
    }

    const remoteChangedBtnEl = document.getElementById('downloaded-filter-remote-changed-btn');
    if (remoteChangedBtnEl) {
      remoteChangedBtnEl.classList.toggle('active', !!downloadedOnlyRemoteChanged);
    }

    if (downloadedOnlyPartiallyWatched) {
      filteredDownloaded = filteredDownloaded.filter(isPartiallyWatchedVideo);
    }

    if (downloadedOnlyRemoteChanged) {
      filteredDownloaded = filteredDownloaded.filter(isRemoteChangedVideo);
    }
    
    // Seçilen kritere göre sırala (Tarih, Boyut veya Kullanıcı)
    const sortVal = downloadedSortVal || 'date-desc';
    sortDownloadedItems(filteredDownloaded, sortVal, localDb);
    
    renderVideoGrid(downloadedGrid, filteredDownloaded, downloadedViewMode);

    const inlineContainer = document.getElementById('downloaded-inline-player-container');
    if (inlineContainer && !inlineContainer.classList.contains('hidden') && currentPlayingVideoId) {
      renderDownloadedPlaylist(currentPlayingVideoId);
    }
  }

  // 7. Ayarlar Değerleri (Sadece alan odaklanılmamışsa doldur)
  if (db.settings) {
    const settingsDownloadPath = document.getElementById('settings-download-path');
    if (settingsDownloadPath && document.activeElement !== settingsDownloadPath) settingsDownloadPath.value = db.settings.downloadPath || '';
    const settingsTempDirType = document.getElementById('settings-temp-dir-type');
    if (settingsTempDirType && document.activeElement !== settingsTempDirType) settingsTempDirType.value = db.settings.tempDirType || 'system';

    const settingsUseTempStaging = document.getElementById('settings-use-temp-staging');
    if (settingsUseTempStaging && document.activeElement !== settingsUseTempStaging) {
      settingsUseTempStaging.checked = db.settings.useTempDownloadStaging === true;
    }

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
    const settingsQuality = document.getElementById('settings-quality');
    if (settingsQuality && document.activeElement !== settingsQuality) settingsQuality.value = db.settings.quality || 'best';
    const settingsChannelCheckInterval = document.getElementById('settings-channelcheckinterval');
    if (settingsChannelCheckInterval && document.activeElement !== settingsChannelCheckInterval) settingsChannelCheckInterval.value = db.settings.channelCheckInterval || 30; if (typeof window.updateChannelIntervalWarning === 'function') window.updateChannelIntervalWarning();
    const settingsAutoDownload = document.getElementById('settings-autodownload');
    if (settingsAutoDownload && document.activeElement !== settingsAutoDownload) settingsAutoDownload.checked = !!db.settings.autoDownload;
    const settingsShortsDurationLimit = document.getElementById('settings-shortsdurationlimit');
    if (settingsShortsDurationLimit && document.activeElement !== settingsShortsDurationLimit) settingsShortsDurationLimit.value = db.settings.shortsDurationLimit || 180;

    const settingsMergeType = document.getElementById('settings-mergetype');
    const settingsHwaccel = document.getElementById('settings-hwaccel');
    const settingsWriteThumbnail = document.getElementById('settings-writethumbnail');
    if (settingsMergeType && document.activeElement !== settingsMergeType) settingsMergeType.value = db.settings.mergeType || 'single';
    if (settingsHwaccel && document.activeElement !== settingsHwaccel) settingsHwaccel.value = db.settings.hardwareAcceleration || 'auto';
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
    const settingsAutoDeleteMaxCount = document.getElementById('settings-autodelete-max-count');
    if (settingsAutoDeleteMaxCount && document.activeElement !== settingsAutoDeleteMaxCount) settingsAutoDeleteMaxCount.value = db.settings.autoDeleteMaxCount || 0;
    const settingsAutoDeleteRequireConfirm = document.getElementById('settings-autodelete-require-confirmation');
    if (settingsAutoDeleteRequireConfirm && document.activeElement !== settingsAutoDeleteRequireConfirm) {
      settingsAutoDeleteRequireConfirm.checked = db.settings.autoDeleteRequireConfirmation !== false;
    }
    if (settingsRssLimit && document.activeElement !== settingsRssLimit) settingsRssLimit.value = db.settings.rssLimit || 5;
    if (settingsSpeedLimit && document.activeElement !== settingsSpeedLimit) settingsSpeedLimit.value = db.settings.downloadSpeedLimit || 0;
    if (settingsAltSpeedLimit && document.activeElement !== settingsAltSpeedLimit) settingsAltSpeedLimit.value = db.settings.alternativeSpeedLimit || 500;

    const settingsLiveStreamHandling = document.getElementById('settings-livestreamhandling');
    if (settingsLiveStreamHandling && document.activeElement !== settingsLiveStreamHandling) settingsLiveStreamHandling.value = db.settings.liveStreamHandling || 'instant_retry';

    const settingsLiveStreamRetryInterval = document.getElementById('settings-livestreamretryinterval');
    if (settingsLiveStreamRetryInterval && document.activeElement !== settingsLiveStreamRetryInterval) settingsLiveStreamRetryInterval.value = String(db.settings.liveStreamRetryInterval || 30);

    const settingsNetworkRetryInterval = document.getElementById('settings-network-retry-interval');
    if (settingsNetworkRetryInterval && document.activeElement !== settingsNetworkRetryInterval) {
      settingsNetworkRetryInterval.value = db.settings.networkRetryIntervalSeconds !== undefined ? db.settings.networkRetryIntervalSeconds : 120;
    }

    const settingsPort = document.getElementById('settings-port');
    if (settingsPort && document.activeElement !== settingsPort) settingsPort.value = db.settings.port || 4141;

    const settingsHistoryLimit = document.getElementById('settings-history-limit');
    if (settingsHistoryLimit && document.activeElement !== settingsHistoryLimit) settingsHistoryLimit.value = db.settings.historyLimitPerChannel || 30;

    const settingsPlaySounds = document.getElementById('settings-playsounds');
    if (settingsPlaySounds && document.activeElement !== settingsPlaySounds) settingsPlaySounds.checked = db.settings.playSounds !== false;

    const settingsSoundDownload = document.getElementById('settings-sound-download');
    if (settingsSoundDownload && document.activeElement !== settingsSoundDownload) settingsSoundDownload.value = db.settings.soundDownloadComplete || 'chime';

    const setCheckedIfPresent = (id, val, def = true) => {
      const el = document.getElementById(id);
      if (el && document.activeElement !== el) el.checked = (val !== undefined ? val !== false : def);
    };

    setCheckedIfPresent('settings-notify-dl-start-toast', db.settings.notifyDownloadStartToast);
    setCheckedIfPresent('settings-notify-dl-start-sound', db.settings.notifyDownloadStartSound);
    setCheckedIfPresent('settings-notify-dl-complete-toast', db.settings.notifyDownloadCompleteToast);
    setCheckedIfPresent('settings-notify-dl-complete-sound', db.settings.notifyDownloadCompleteSound);

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

    const settingsScanRemoteStartup = document.getElementById('settings-scan-remote-startup');
    if (settingsScanRemoteStartup && document.activeElement !== settingsScanRemoteStartup) settingsScanRemoteStartup.checked = db.settings.scanRemoteStatusOnStartup !== false;

    const settingsCheckYtdlpOnStartup = document.getElementById('settings-check-ytdlp-on-startup');
    if (settingsCheckYtdlpOnStartup && document.activeElement !== settingsCheckYtdlpOnStartup) settingsCheckYtdlpOnStartup.checked = db.settings.checkYtdlpOnStartup === true;

    const ytdlpTargetSelect = document.getElementById('ytdlp-target-select');
    if (ytdlpTargetSelect && document.activeElement !== ytdlpTargetSelect && db.settings.ytdlpStartupTarget) {
      ytdlpTargetSelect.value = db.settings.ytdlpStartupTarget;
    }

    const settingsAutoOpenBrowser = document.getElementById('settings-autoopenbrowser');
    if (settingsAutoOpenBrowser && document.activeElement !== settingsAutoOpenBrowser) settingsAutoOpenBrowser.checked = db.settings.autoOpenBrowser !== false;

    const settingsUnloadUiOnHide = document.getElementById('settings-unload-ui-on-hide');
    if (settingsUnloadUiOnHide && document.activeElement !== settingsUnloadUiOnHide) settingsUnloadUiOnHide.checked = db.settings.unloadUiOnHide !== false;

    const settingsPlayerGpuMode = document.getElementById('settings-player-gpu-mode');
    if (settingsPlayerGpuMode && document.activeElement !== settingsPlayerGpuMode) settingsPlayerGpuMode.value = db.settings.playerGpuMode || 'gpu';

    const settingsVolumeStep = document.getElementById('settings-volume-step');
    if (settingsVolumeStep && document.activeElement !== settingsVolumeStep) {
      settingsVolumeStep.value = String(db.settings.volumeStep !== undefined ? db.settings.volumeStep : 5);
    }

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
      settingsDoubleClickAction.value = db.settings.doubleClickAction || 'player';
    }

    const settingsSubtitleColor = document.getElementById('settings-subtitle-color');
    if (settingsSubtitleColor && document.activeElement !== settingsSubtitleColor) {
      settingsSubtitleColor.value = db.settings.subtitleColor || '#ffffff';
    }

    const settingsSponsorBlock = document.getElementById('settings-sponsorblock');
    if (settingsSponsorBlock && document.activeElement !== settingsSponsorBlock) settingsSponsorBlock.checked = db.settings.sponsorBlockEnabled === true;

    const settingsAltThumbnailsHover = document.getElementById('settings-alt-thumbnails-hover');
    if (settingsAltThumbnailsHover && document.activeElement !== settingsAltThumbnailsHover) settingsAltThumbnailsHover.checked = db.settings.enableAltThumbnailsHover !== false;

    const settingsPreventSleep = document.getElementById('settings-prevent-sleep');
    if (settingsPreventSleep && document.activeElement !== settingsPreventSleep) settingsPreventSleep.checked = db.settings.preventSleepOnDownload !== false;

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

    const queuePausedNotice = document.getElementById('queue-paused-notice');
    if (queuePausedNotice) {
      queuePausedNotice.style.display = db.settings.isPaused ? 'flex' : 'none';
      if (typeof lucide !== 'undefined') lucide.createIcons();
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
        altSpeedToggleBtn.classList.add('btn-warning', 'active');
        altSpeedToggleBtn.classList.remove('btn-secondary');
        altSpeedToggleBtn.setAttribute('title', isEn ? 'Disable Alternative Speed Limit (Active)' : 'Alternatif Hız Sınırını Kapat (Açık 🐢)');
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
        altSpeedToggleBtn.classList.remove('btn-warning', 'active');
        altSpeedToggleBtn.classList.add('btn-secondary');
        altSpeedToggleBtn.setAttribute('title', isEn ? 'Enable Alternative Speed Limit (Inactive)' : 'Alternatif Hız Sınırını Aç (Kapalı)');
      }
    }

    // Tema Sınıfı Eşitlemesi
    applyTheme(db.settings.theme || 'dark');
    
    // Dil Çevirisini Uygula
    if (db.settings.lang) {
      applyLanguage(db.settings.lang);
    }
    
    window._settingsFormPopulated = true;
    initShortcutsManager();
  }

  const isSettingsTabActive = !!document.getElementById('tab-settings')?.classList.contains('active');
  // Gist alanlarını ve bağlantılarını doldur (Yalnızca Ayarlar sekmesi aktifse)
  if (window._settingsFormPopulated && isSettingsTabActive) {
    populateGistFields();
    renderShortcutsSettingsPanel();
  }

  if ((isToolsTabActive || isSettingsTabActive) && typeof updateFakapSettingsControls === 'function' && localDb?.settings) {
    updateFakapSettingsControls({
      enabled: localDb.settings.fakapEnabled,
      dir: localDb.settings.fakapPath,
      quality: localDb.settings.fakapQuality,
      retentionDays: localDb.settings.fakapRetentionDays
    });
  }

  if (document.getElementById('tab-queue')?.classList.contains('active')) {
    renderPendingMergeSection(db);
  }
  if (isToolsTabActive && !window._cliCommandsRendered) {
    renderCliCommandsPanel();
    window._cliCommandsRendered = true;
  }

  // İkonları yalnızca üst bar ve aktif sekme için yükle (gizli sekmeleri tarama)
  if (typeof lucide !== 'undefined' && typeof lucide.createIcons === 'function') {
    try {
      const topbarEl = document.querySelector('.topbar');
      const activeTabEl = document.querySelector('.tab-content.active');
      if (topbarEl) lucide.createIcons({ root: topbarEl });
      if (activeTabEl) lucide.createIcons({ root: activeTabEl });
    } catch (e) {}
  }

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
    const webstreamUrl = urlParams.get('webstream') || urlParams.get('stream_url');
    if (webstreamUrl) {
      switchTab('webstream', true);
      setTimeout(() => {
        if (typeof window.playWebStreamUrl === 'function') {
          window.playWebStreamUrl(encodeURIComponent(webstreamUrl));
        }
      }, 200);
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

window.resetDownloadedChannelFilter = function(event) {
  if (event) {
    event.stopPropagation();
  }
  const filterSelect = document.getElementById('downloaded-channel-filter');
  if (filterSelect) {
    filterSelect.value = 'all';
  }
  downloadedFilterChannel = 'all';
  window.downloadedFilterChannel = 'all';
  window.downloadedFilterState = { mode: 'include', categories: [], channels: [], platform: 'all' };
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

// Türkçe Açıklama: İndirilenler sekmesinde sadece YouTube uzak sunucu durumu değişen (yıldızlı) videoları filtreler
window.toggleDownloadedRemoteChangedFilter = function() {
  downloadedOnlyRemoteChanged = !downloadedOnlyRemoteChanged;
  window.downloadedOnlyRemoteChanged = downloadedOnlyRemoteChanged;
  const btn = document.getElementById('downloaded-filter-remote-changed-btn');
  if (btn) btn.classList.toggle('active', downloadedOnlyRemoteChanged);
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
    // Fakap kayıtlarında id "fakap_<videoId>" olabilir; sunucuya her zaman gerçek video kimliği gider.
    const cleanId = (item && item.originalId) || String(videoId || '').replace(/^fakap_/, '');
    const itemUrl = item ? (item.webUrl || item.url || '') : '';
    const res = await fetch('/api/download-video', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ videoId: cleanId, title, channelName, channelId, url: itemUrl })
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

// addChannelForm → initAddChannelForm() in ./modules/channels.js

// triggerManualDiskSync ve ilgili olay dinleyicisi ./modules/systemStatus.js modülünden yönetilmektedir.
initSystemStatusEvents();

// Ayarlar formu dinleyicileri, otomatik kaydetme ve klasör açma/seçme/test işlevleri ./modules/settings.js tarafından yönetilmektedir.
initSettingsFormListeners();

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
  // İndirilmemiş (doğrudan YouTube üzerinden oynatılan) videolarda YouTube zaten kendi oturumuyla süreyi tutar;
  // arka plandan ikinci bir InnerTube player isteği atmak "Aynı anda çok fazla cihazda izleniyor" hatasını tetikler.
  const histItem = (localDb?.history || []).find(h => h.id === vid);
  if (!histItem || histItem.status !== 'completed' || histItem.fileMissing === true) return;

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
  const activeTab = document.querySelector('.nav-item.active')?.getAttribute('data-tab') || 'history';
  const webStreamPlyr = (activeTab === 'webstream' && typeof window.getWebStreamPlyrInstance === 'function')
    ? window.getWebStreamPlyrInstance()
    : null;

  if (isModalOpen || isInlineOpen || webStreamPlyr) {
    // Input veya textarea üzerinde yazı yazılıyorsa kısayolları çalıştırma
    const activeEl = document.activeElement;
    const isTyping = activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.isContentEditable);
    if (isTyping) return;

    const plyrInst = videoPlayerInstance || webStreamPlyr;
    const player = document.getElementById('embedded-video-player') || document.getElementById('webstream-inline-video');

    // Oynatıcı kontrollerini soyutlayan ortak nesne (Plyr)
    const activePlayer = {
      get paused() {
        return plyrInst ? plyrInst.paused : (player ? player.paused : true);
      },
      play() {
        return plyrInst ? plyrInst.play() : (player ? player.play() : Promise.resolve());
      },
      pause() {
        if (plyrInst) plyrInst.pause();
        else if (player) player.pause();
      },
      get duration() {
        return plyrInst ? (plyrInst.duration || 0) : (player ? (player.duration || 0) : 0);
      },
      get currentTime() {
        return plyrInst ? (plyrInst.currentTime || 0) : (player ? (player.currentTime || 0) : 0);
      },
      set currentTime(val) {
        if (plyrInst) plyrInst.currentTime = val;
        else if (player) player.currentTime = val;
      },
      get volume() {
        return plyrInst ? (plyrInst.volume || 0) : (player ? (player.volume || 0) : 0);
      },
      set volume(val) {
        const clamped = Math.max(0, Math.min(1, val));
        if (plyrInst) plyrInst.volume = clamped;
        else if (player) player.volume = clamped;
        if (typeof triggerVolumeHUD === 'function') {
          triggerVolumeHUD(clamped);
        }
      },
      get muted() {
        return plyrInst ? (plyrInst.muted || false) : (player ? (player.muted || false) : false);
      },
      set muted(val) {
        if (plyrInst) plyrInst.muted = val;
        else if (player) player.muted = val;
      },
      get speed() {
        return plyrInst ? (plyrInst.speed || 1) : (player ? (player.playbackRate || 1) : 1);
      },
      set speed(val) {
        if (plyrInst) plyrInst.speed = val;
        else if (player) player.playbackRate = val;
        if (typeof showActionToast === 'function') {
          showActionToast('gauge', `${val}x`, 1600);
        } else if (typeof showPlayerTransientOverlay === 'function') {
          showPlayerTransientOverlay(`<div class="player-transient-card"><i data-lucide="gauge" style="width:32px;height:32px;color:var(--accent-color);"></i><div class="transient-title">${val}x</div></div>`, 1500);
        }
      },
      toggleFullscreen() {
        if (webStreamPlyr && webStreamPlyr.fullscreen && typeof webStreamPlyr.fullscreen.toggle === 'function') {
          try { webStreamPlyr.fullscreen.toggle()?.catch?.(() => {}); } catch (e) {}
        } else if (typeof window.toggleActiveVideoFullscreen === 'function') {
          window.toggleActiveVideoFullscreen();
        } else if (plyrInst && plyrInst.fullscreen && typeof plyrInst.fullscreen.toggle === 'function') {
          try {
            plyrInst.fullscreen.toggle()?.catch?.(() => {});
          } catch (e) {}
        } else if (typeof window.togglePlayerModalFullscreen === 'function') {
          window.togglePlayerModalFullscreen();
        }
      },
      toggleCaptions() {
        if (plyrInst) {
          if (typeof plyrInst.toggleCaptions === 'function') {
            plyrInst.toggleCaptions();
          } else if (plyrInst.captions) {
            plyrInst.captions.active = !plyrInst.captions.active;
            localStorage.setItem('haytool_subtitles_enabled', plyrInst.captions.active ? 'true' : 'false');
          }
        } else if (player) {
          const tracks = player.textTracks;
          if (tracks && tracks.length > 0) {
            const isShowing = Array.from(tracks).some(t => t.mode === 'showing');
            const newMode = !isShowing;
            for (let i = 0; i < tracks.length; i++) {
              tracks[i].mode = (i === 0 && newMode) ? 'showing' : 'disabled';
            }
            localStorage.setItem('haytool_subtitles_enabled', newMode ? 'true' : 'false');
          }
        }
      }
    };

    const duration = activePlayer.duration;
    const speeds = [0.5, 0.75, 0.85, 0.9, 1, 1.05, 1.1, 1.15, 1.25, 1.5, 1.75, 2];
    const userLang = (localDb && localDb.settings && localDb.settings.lang) || localStorage.getItem('haytool_user_lang') || 'tr';
    const langDict = window.translations?.[userLang] || window.translations?.['tr'] || {};

    if (window.isCapturingShortcut) return;

    if (matchesShortcut(e, 'player_play_pause')) {
      e.preventDefault();
      if (activePlayer.paused) {
        activePlayer.play().catch(() => {});
        if (typeof showCenterBounceIcon === 'function') showCenterBounceIcon('play');
      } else {
        activePlayer.pause();
        if (typeof showCenterBounceIcon === 'function') showCenterBounceIcon('pause');
      }
      return;
    }

    if (matchesShortcut(e, 'player_fullscreen')) {
      e.preventDefault();
      const willBeFs = !document.fullscreenElement;
      activePlayer.toggleFullscreen();
      if (typeof showActionToast === 'function') {
        const fsLabel = willBeFs ? (langDict.hud_fullscreen || 'Tam Ekran') : (langDict.hud_exit_fullscreen || 'Pencere Modu');
        showActionToast(willBeFs ? 'maximize' : 'minimize', fsLabel, 1700);
      }
      return;
    }

    if (matchesShortcut(e, 'player_theater')) {
      e.preventDefault();
      if (typeof window.toggleTheaterMode === 'function') {
        const isTheater = window.toggleTheaterMode();
        if (typeof showActionToast === 'function') {
          const tLabel = isTheater ? (langDict.hud_theater_on || 'Sinema Modu') : (langDict.hud_theater_off || 'Normal Mod');
          showActionToast('tv', tLabel, 1600);
        }
      }
      return;
    }

    if (matchesShortcut(e, 'player_mute')) {
      e.preventDefault();
      activePlayer.muted = !activePlayer.muted;
      if (typeof showActionToast === 'function') {
        const mLabel = activePlayer.muted ? (langDict.hud_muted || 'Sessiz') : (langDict.hud_unmuted || 'Ses Açık');
        showActionToast(activePlayer.muted ? 'volume-x' : 'volume-2', mLabel, 1600);
      }
      return;
    }

    if (matchesShortcut(e, 'player_captions')) {
      e.preventDefault();
      activePlayer.toggleCaptions();
      if (typeof showActionToast === 'function') {
        const isSubOn = (videoPlayerInstance && videoPlayerInstance.captions && videoPlayerInstance.captions.active) || (localStorage.getItem('haytool_subtitles_enabled') === 'true');
        const cLabel = isSubOn ? (langDict.hud_subtitles_on || 'Altyazı Açık') : (langDict.hud_subtitles_off || 'Altyazı Kapalı');
        showActionToast('subtitles', cLabel, 1600);
      }
      return;
    }

    if (matchesShortcut(e, 'player_sponsorblock')) {
      e.preventDefault();
      const btnSBToggle = document.getElementById('inline-btn-sponsorblock-toggle');
      if (btnSBToggle && typeof btnSBToggle.onclick === 'function') {
        btnSBToggle.onclick();
      } else {
        if (!localDb.settings) localDb.settings = {};
        const newStatus = !(localDb.settings.sponsorBlockEnabled === true);
        localDb.settings.sponsorBlockEnabled = newStatus;
        const settingsSB = document.getElementById('settings-sponsorblock');
        if (settingsSB) settingsSB.checked = newStatus;
        if (typeof window.updateSBToggleButtonUI === 'function') window.updateSBToggleButtonUI();
        fetch('/api/settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sponsorBlockEnabled: newStatus })
        }).catch(() => {});
        if (typeof showActionToast === 'function') {
          const sbTitle = newStatus
            ? (langDict.sponsorblock_active_toast || 'SponsorBlock Aktif')
            : (langDict.sponsorblock_disabled_toast || 'SponsorBlock Devre Dışı');
          showActionToast(newStatus ? 'shield' : 'shield-off', sbTitle, 1600);
        }
      }
      return;
    }

    if (matchesShortcut(e, 'player_seek_fwd_5')) {
      e.preventDefault();
      activePlayer.currentTime = Math.min(duration, activePlayer.currentTime + 5);
      if (typeof showActionToast === 'function') {
        showActionToast('fast-forward', '+5s', 1400);
      }
      return;
    }

    if (matchesShortcut(e, 'player_seek_back_5')) {
      e.preventDefault();
      activePlayer.currentTime = Math.max(0, activePlayer.currentTime - 5);
      if (typeof showActionToast === 'function') {
        showActionToast('rewind', '-5s', 1400);
      }
      return;
    }

    if (matchesShortcut(e, 'player_seek_fwd_10')) {
      e.preventDefault();
      activePlayer.currentTime = Math.min(duration, activePlayer.currentTime + 10);
      if (typeof showActionToast === 'function') {
        showActionToast('fast-forward', '+10s', 1400);
      }
      return;
    }

    if (matchesShortcut(e, 'player_seek_back_10')) {
      e.preventDefault();
      activePlayer.currentTime = Math.max(0, activePlayer.currentTime - 10);
      if (typeof showActionToast === 'function') {
        showActionToast('rewind', '-10s', 1400);
      }
      return;
    }

    if (matchesShortcut(e, 'player_vol_up')) {
      e.preventDefault();
      activePlayer.volume = Math.min(1, Math.round((activePlayer.volume + getPlayerVolumeStep()) * 100) / 100);
      return;
    }

    if (matchesShortcut(e, 'player_vol_down')) {
      e.preventDefault();
      activePlayer.volume = Math.max(0, Math.round((activePlayer.volume - getPlayerVolumeStep()) * 100) / 100);
      return;
    }

    if (matchesShortcut(e, 'player_seek_start')) {
      e.preventDefault();
      activePlayer.currentTime = 0;
      if (typeof showActionToast === 'function') {
        showActionToast('skip-back', langDict.hud_seek_start || 'Başa Dön', 1500);
      }
      return;
    }

    if (matchesShortcut(e, 'player_seek_end')) {
      e.preventDefault();
      activePlayer.currentTime = duration;
      if (typeof showActionToast === 'function') {
        showActionToast('skip-forward', langDict.hud_seek_end || 'Sona Git', 1500);
      }
      return;
    }

    if (matchesShortcut(e, 'player_speed_up')) {
      e.preventDefault();
      const idx = speeds.indexOf(activePlayer.speed);
      if (idx !== -1 && idx < speeds.length - 1) {
        activePlayer.speed = speeds[idx + 1];
      } else if (idx === -1) {
        const nextSpeed = speeds.find(s => s > activePlayer.speed);
        if (nextSpeed) activePlayer.speed = nextSpeed;
      }
      return;
    }

    if (matchesShortcut(e, 'player_speed_down')) {
      e.preventDefault();
      const idx = speeds.indexOf(activePlayer.speed);
      if (idx !== -1 && idx > 0) {
        activePlayer.speed = speeds[idx - 1];
      } else if (idx === -1) {
        const prevSpeed = [...speeds].reverse().find(s => s < activePlayer.speed);
        if (prevSpeed) activePlayer.speed = prevSpeed;
      }
      return;
    }

    // Sayı tuşları (0-9) ile videonun %0 ila %90'ına atlama
    if (!e.ctrlKey && !e.altKey && !e.shiftKey && e.key >= '0' && e.key <= '9') {
      e.preventDefault();
      const percent = parseInt(e.key, 10) * 10;
      activePlayer.currentTime = duration * (percent / 100);
      if (typeof showActionToast === 'function') {
        showActionToast('crosshair', `%${percent}`, 1400);
      }
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
// Oynatıcı modal boyutlandırma/küçültme/sürükleme/yönelim/Discord RPC -> ./modules/playerModal.js

let currentVideoSponsorSegments = [];
let lastSkippedSegmentStart = -1;
let playerResizeObserver = null;

let activePlayRequestId = 0;

window.toggleActiveVideoFullscreen = function() {
  const modal = document.getElementById('player-modal');
  const inlineContainer = document.getElementById('downloaded-inline-player-container');
  const isModalOpen = modal && !modal.classList.contains('hidden') && modal.style.display !== 'none';
  const isInlineOpen = inlineContainer && !inlineContainer.classList.contains('hidden') && inlineContainer.style.display !== 'none';

  function fallbackTargetFullscreen() {
    const target = isInlineOpen
      ? (document.getElementById('inline-player-body') || inlineContainer)
      : (modal?.querySelector('.player-modal-body') || modal || document.querySelector('.plyr, #embedded-video-player') || document.documentElement);
    if (!target) return;
    if (!document.fullscreenElement) {
      target.requestFullscreen().catch(() => {
        if (typeof window.toggleAppFullscreen === 'function') window.toggleAppFullscreen();
      });
    } else {
      document.exitFullscreen().catch(() => {});
    }
  }

  // 1. Eğer Plyr nesnesi varsa önce Plyr üzerinden dene
  if (videoPlayerInstance && videoPlayerInstance.fullscreen && typeof videoPlayerInstance.fullscreen.toggle === 'function') {
    try {
      const p = videoPlayerInstance.fullscreen.toggle();
      if (p && typeof p.catch === 'function') {
        p.catch(() => {
          fallbackTargetFullscreen();
        });
      }
      return;
    } catch {
      fallbackTargetFullscreen();
      return;
    }
  }

  // 2. Eğer IPTV sekmesinde aktif bir slot varsa
  const activeIptvSlot = document.querySelector('.iptv-slot.active-slot') || document.querySelector('.iptv-slot');
  if (activeIptvSlot && document.getElementById('tab-iptv')?.classList.contains('active')) {
    if (!document.fullscreenElement) {
      activeIptvSlot.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
    return;
  }

  // 3. Modal veya inline oynatıcı açıksa konteyneri tam ekran yap
  if (isModalOpen || isInlineOpen) {
    fallbackTargetFullscreen();
    return;
  }

  // 4. Video açık değilse pencere tam ekranını aç/kapa
  if (typeof window.toggleAppFullscreen === 'function') {
    window.toggleAppFullscreen();
  }
};
window.togglePlayerModalFullscreen = window.toggleActiveVideoFullscreen;

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
  const isCompleted = video && video.status === 'completed';
  const isMissing = video && video.fileMissing === true;
  const isDownloaded = isCompleted && !isMissing;
  const isShort = isShortVideo(video?.duration, video?.title, video?.channelId);

  if (!isDownloaded) {
    let resumeSec = null;
    let wasPaused = false;
    if (videoPlayerInstance) {
      if (typeof videoPlayerInstance.currentTime === 'number' && videoPlayerInstance.currentTime > 1) {
        resumeSec = videoPlayerInstance.currentTime;
      }
      wasPaused = !!videoPlayerInstance.paused;
    }
    inlineContainer.classList.add('hidden');
    const listContainer = document.getElementById('downloaded-list-container');
    if (listContainer) listContainer.classList.remove('hidden');
    window.playVideoEmbedded(currentPlayingVideoId, resumeSec, wasPaused, true);
    return true;
  }

  const inlineBody = document.getElementById('inline-player-body');
  const modal = document.getElementById('player-modal');
  const modalBody = modal ? modal.querySelector('.player-modal-body') : null;
  const modalTitle = document.getElementById('player-modal-title');
  const modalLogo = document.getElementById('player-modal-logo');

  if (!modal || !modalBody || !inlineBody || !inlineBody.firstElementChild) return false;

  // Modal başlık ve logoyu güncelle
  if (modalTitle) modalTitle.textContent = video ? video.title : 'Gömülü Video Oynatıcı';
  if (typeof initVideoTitleOverlay === 'function') {
    initVideoTitleOverlay(video ? video.title : 'Gömülü Video Oynatıcı', modalBody);
  }
  if (modalLogo && video) {
    const vPlat = (typeof detectVideoPlatform === 'function') ? detectVideoPlatform(video) : 'youtube';
    if (vPlat === 'youtube' && hasFollowedChannelAvatar(video.channelId)) {
      modalLogo.onerror = function() { this.style.display = 'none'; };
      modalLogo.src = `/api/channels/${encodeURIComponent(video.channelId)}/avatar`;
      modalLogo.style.display = 'block';
    } else {
      const fav = getSiteFaviconInfo(video);
      modalLogo.onerror = function() { this.onerror = null; this.src = fav.fallback; };
      modalLogo.src = fav.src;
      modalLogo.style.display = 'block';
    }
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
    window.videoPlayerInstance = null;
  }

  const videoElements = document.querySelectorAll('#inline-player-body video, .player-modal-body video, #embedded-video-player, audio');
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
window.playVideoEmbedded = async function(videoId, startSeconds = null, forcePaused = null, forceModal = false) {
  const currentRequestId = ++activePlayRequestId;
  try {
    cleanupAllPlayers();

    const activeTab = document.querySelector('.nav-item.active')?.getAttribute('data-tab') || 'history';
    const isInline = !forceModal && (activeTab === 'downloaded');
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
    const isCompletedLocal = video && video.status === 'completed' && !video.fileMissing;

    // Altyazıları yalnızca indirilmiş yerel videolar için çek (uzak YouTube oynatımında yt-dlp çerez çakışmasını önler)
    const subFetchPromise = isCompletedLocal
      ? fetchVideoSubtitles(videoId)
          .then(subs => {
            if (currentRequestId !== activePlayRequestId) return [];
            availableSubtitles = subs;
            applySubtitlesToPlayer(subs);
            return availableSubtitles;
          })
          .catch(err => {
            console.warn('[Subtitles] Fetch error:', err);
            return [];
          })
      : Promise.resolve([]);

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

  window.setupInlinePlayerPanels = function(videoId, video, availableSubtitles = [], playerContainer = null) {
    const videoTitle = video ? video.title : '';
    const videoChannelId = video ? video.channelId : '';
    const videoChannelName = video ? video.channelName : '';
    const fileSizeStr = video ? video.fileSize : '';
    const publishDateStr = video ? (video.publishedAt || video.downloadedAt || '') : '';

window.updateInlinePlayerMetadata = function(videoObj) {
  if (!videoObj) return;
  const titleText = videoObj.title || 'Yerleşik Oynatıcı';
  const videoChannelName = videoObj.channelName || '';
  let videoChannelId = videoObj.channelId || '';

  // Eğer channelId boşsa kanallar listesinden isme göre bul
  if (!videoChannelId && videoChannelName && window.localDb?.channels) {
    const matchedChan = window.localDb.channels.find(c => c.name === videoChannelName);
    if (matchedChan) videoChannelId = matchedChan.id;
  }

  const titleEl = document.getElementById('inline-player-title');
  if (titleEl) {
    titleEl.textContent = titleText;
    titleEl.title = titleText;
    if (typeof updateVideoTitleOverlay === 'function') {
      updateVideoTitleOverlay(titleText);
    }
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

  const platform = (typeof detectVideoPlatform === 'function') ? detectVideoPlatform(videoObj) : 'youtube';
  const isYouTube = platform === 'youtube';

  const channelNameEl = document.getElementById('inline-player-channel-name');
  if (channelNameEl) channelNameEl.textContent = videoChannelName || '';

  const avatarEl = document.getElementById('inline-player-channel-avatar');
  const logoDividerEl = document.getElementById('inline-player-logo-divider');
  const platformIconEl = document.getElementById('inline-player-platform-icon');
  if (avatarEl) {
    if (isYouTube && hasFollowedChannelAvatar(videoChannelId)) {
      avatarEl.onerror = function() { this.style.display = 'none'; };
      avatarEl.src = `/api/channels/${encodeURIComponent(videoChannelId)}/avatar`;
      avatarEl.style.display = 'block';
      if (logoDividerEl) logoDividerEl.style.display = 'inline';
      if (platformIconEl) platformIconEl.style.display = 'none';
    } else if (videoObj) {
      const fav = getSiteFaviconInfo(videoObj);
      avatarEl.onerror = function() { this.onerror = null; this.src = fav.fallback; };
      avatarEl.src = fav.src;
      avatarEl.style.display = 'block';
      if (logoDividerEl) logoDividerEl.style.display = 'inline';
      if (platformIconEl) platformIconEl.style.display = 'none';
    } else {
      avatarEl.style.display = 'none';
      if (logoDividerEl) logoDividerEl.style.display = 'none';
      if (platformIconEl) platformIconEl.style.display = 'none';
    }
  }

  function formatInlineViewsCount(views) {
    const num = Number(views);
    if (!Number.isFinite(num) || num <= 0) return null;
    if (num >= 1000000000) return (num / 1000000000).toFixed(1).replace(/\.0$/, '') + 'B';
    if (num >= 1000000) return (num / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
    return num.toLocaleString();
  }

  const subsEl = document.getElementById('inline-player-channel-subs');
  const subsTextEl = document.getElementById('inline-player-channel-subs-text');
  const dividerEl = document.getElementById('inline-player-channel-divider');
  if (subsEl && subsTextEl) {
    if (isYouTube) {
      const channel = window.localDb?.channels?.find(c => c.id === videoChannelId || (videoChannelName && c.name === videoChannelName));
      const subVal = channel && channel.subscriberCount ? channel.subscriberCount : '?';
      subsTextEl.textContent = subVal;
      subsEl.style.display = 'inline-flex';
      if (dividerEl) dividerEl.style.display = 'inline';
      try {
        if (typeof lucide !== 'undefined') lucide.createIcons();
      } catch (e) {}
    } else {
      subsEl.style.display = 'none';
      if (dividerEl) dividerEl.style.display = 'none';
    }
  }

  // YouTube İzlenme Sayısı Rozeti (#inline-player-video-views)
  const viewsEl = document.getElementById('inline-player-video-views');
  const viewsTextEl = document.getElementById('inline-player-video-views-text');
  if (viewsEl && viewsTextEl) {
    if (isYouTube) {
      const histItem = window.localDb?.history?.find(h => h.id === videoObj.id);
      const viewVal = (histItem && histItem.viewCount) || videoObj.viewCount;
      const formatted = formatInlineViewsCount(viewVal);
      viewsTextEl.textContent = formatted || '--';
      if (viewVal && Number(viewVal) > 0) {
        viewsEl.title = Number(viewVal).toLocaleString();
      }
      viewsEl.style.display = 'inline-flex';
      try {
        if (typeof lucide !== 'undefined') lucide.createIcons();
      } catch (e) {}
    } else {
      viewsEl.style.display = 'none';
    }
  }

  const channelContainer = document.querySelector('.inline-player-channel');
  if (channelContainer) {
    if (isYouTube && videoChannelId) {
      channelContainer.style.cursor = 'pointer';
      channelContainer.title = window.localDb?.settings?.lang === 'en' ? 'Go to Channel Videos' : 'Kanala Git';
      channelContainer.onclick = (e) => {
        e.preventDefault();
        const channelUrl = `https://www.youtube.com/channel/${videoChannelId}/videos`;
        fetch('/api/open-url', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: channelUrl })
        }).catch(() => {
          window.open(channelUrl, '_blank', 'noopener,noreferrer');
        });
      };
    } else if (!isYouTube) {
      const rawHandle = String(videoChannelName || '').replace(/^@+/, '').trim();
      let profUrl = '';
      if (platform === 'instagram') profUrl = rawHandle ? `https://www.instagram.com/${rawHandle}/` : 'https://www.instagram.com/';
      else if (platform === 'x') profUrl = rawHandle ? `https://x.com/${rawHandle}` : 'https://x.com/';
      else if (platform === 'tiktok') profUrl = rawHandle ? `https://www.tiktok.com/@${rawHandle}` : 'https://www.tiktok.com/';
      else if (videoObj.webUrl) profUrl = videoObj.webUrl;

      if (profUrl) {
        channelContainer.style.cursor = 'pointer';
        channelContainer.title = (window.localDb?.settings?.lang === 'en' ? 'Open Profile' : 'Profili Aç') + ': ' + (videoChannelName || rawHandle);
        channelContainer.onclick = (e) => {
          e.preventDefault();
          if (typeof window.openExternalWebUrl === 'function') {
            window.openExternalWebUrl(profUrl);
          } else {
            window.open(profUrl, '_blank', 'noopener,noreferrer');
          }
        };
      } else {
        channelContainer.style.cursor = 'default';
        channelContainer.title = '';
        channelContainer.onclick = null;
      }
    } else {
      channelContainer.style.cursor = 'default';
      channelContainer.title = '';
      channelContainer.onclick = null;
    }
  }

    const publishDateEl = document.getElementById('inline-player-publish-date');
  if (publishDateEl) {
    const isEn = window.localDb?.settings?.lang === 'en';
    const pubDate = videoObj.publishedAt ? formatDate(videoObj.publishedAt) : '--';
    publishDateEl.textContent = (isEn ? 'Published: ' : 'Yüklenme: ') + pubDate;
  }

  const downloadDateEl = document.getElementById('inline-player-download-date');
  if (downloadDateEl) {
    const isEn = window.localDb?.settings?.lang === 'en';
    const dlDate = videoObj.downloadedAt ? formatDate(videoObj.downloadedAt) : '--';
    downloadDateEl.textContent = (isEn ? 'Downloaded: ' : 'İndirilme: ') + dlDate;
  }

  const fileSizeEl = document.getElementById('inline-player-file-size');
  if (fileSizeEl) {
    const isEn = window.localDb?.settings?.lang === 'en';
    fileSizeEl.textContent = (isEn ? 'Size: ' : 'Boyut: ') + (videoObj.fileSize || '--');
  }

  // Return YouTube Dislike (RYD) İstatistiklerini Getir ve Oy Verme Mantığı
  const rydPill = document.getElementById('inline-player-ryd-pill');
  const rydSep = document.getElementById('inline-player-ryd-sep');
  const rydLikeBtn = document.getElementById('ryd-like-btn');
  const rydDislikeBtn = document.getElementById('ryd-dislike-btn');
  const likesCountEl = document.getElementById('ryd-likes-count');
  const dislikesCountEl = document.getElementById('ryd-dislikes-count');
  const barFillEl = document.getElementById('ryd-bar-fill');

  if (rydPill) {
    rydPill.style.display = 'none';
    if (rydSep) rydSep.style.display = 'none';
    if (rydLikeBtn) {
      rydLikeBtn.classList.remove('voted');
      rydLikeBtn.onclick = null;
    }
    if (rydDislikeBtn) {
      rydDislikeBtn.classList.remove('voted');
      rydDislikeBtn.onclick = null;
    }

    if (videoObj.id) {
      fetch(`/api/video/${videoObj.id}/votes`)
        .then(r => r.json())
        .then(data => {
          if (data && data.available) {
            let currentLikes = Number(data.likes) || 0;
            let currentDislikes = Number(data.dislikes) || 0;

            const fmt = (num) => {
              if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
              if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
              return num.toLocaleString();
            };

            const updateRydDisplay = () => {
              if (likesCountEl) likesCountEl.textContent = fmt(currentLikes);
              if (dislikesCountEl) dislikesCountEl.textContent = fmt(currentDislikes);
              const total = currentLikes + currentDislikes;
              const ratio = total > 0 ? ((currentLikes / total) * 100) : 50;
              if (barFillEl) barFillEl.style.width = ratio.toFixed(1) + '%';
            };

            updateRydDisplay();

            // RYD üzerinden gelen güncel viewCount varsa ve rozet boşsa güncelle
            if (viewsEl && viewsTextEl && isYouTube && data.viewCount) {
              const formatted = formatInlineViewsCount(data.viewCount);
              if (formatted) {
                viewsTextEl.textContent = formatted;
                viewsEl.title = Number(data.viewCount).toLocaleString();
                viewsEl.style.display = 'inline-flex';
              }
            }

            // Kullanıcının daha önceki oyunu yerel hafızadan kontrol et
            const storageVoteKey = `ryd_vote_${videoObj.id}`;
            let userVote = parseInt(localStorage.getItem(storageVoteKey) || '0', 10);
            if (userVote === 1 && rydLikeBtn) rydLikeBtn.classList.add('voted');
            if (userVote === -1 && rydDislikeBtn) rydDislikeBtn.classList.add('voted');

            // Oy Gönderme İşleyicisi
            let isVoting = false;
            const handleVote = async (targetValue) => {
              if (isVoting) return;
              isVoting = true;

              // Aynı oya tekrar tıklanırsa iptal et (0 gönder), farklıysa oyu güncelle
              const finalValue = userVote === targetValue ? 0 : targetValue;
              const isEn = window.localDb?.settings?.lang === 'en';

              try {
                const res = await fetch(`/api/video/${videoObj.id}/vote`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ value: finalValue })
                });
                const resData = await res.json();

                if (resData.success) {
                  // Önceki durumu geri al
                  if (userVote === 1) currentLikes = Math.max(0, currentLikes - 1);
                  if (userVote === -1) currentDislikes = Math.max(0, currentDislikes - 1);

                  // Yeni durumu ekle
                  if (finalValue === 1) currentLikes++;
                  if (finalValue === -1) currentDislikes++;

                  userVote = finalValue;
                  localStorage.setItem(storageVoteKey, finalValue.toString());

                  if (rydLikeBtn) rydLikeBtn.classList.toggle('voted', userVote === 1);
                  if (rydDislikeBtn) rydDislikeBtn.classList.toggle('voted', userVote === -1);

                  updateRydDisplay();

                  if (finalValue === 1) {
                    showToast(isEn ? 'Liked on RYD network! 👍' : 'RYD ağına Beğeni gönderildi! 👍', 'success');
                  } else if (finalValue === -1) {
                    showToast(isEn ? 'Disliked on RYD network! 👎' : 'RYD ağına Dislike gönderildi! 👎', 'info');
                  } else {
                    showToast(isEn ? 'Vote removed from RYD.' : 'RYD oyunuz geri çekildi.', 'info');
                  }
                } else {
                  showToast(resData.error || (isEn ? 'Failed to submit vote to RYD' : 'RYD oyu gönderilemedi'), 'error');
                }
              } catch (voteErr) {
                console.error('[RYD Vote Error]', voteErr);
                showToast(isEn ? 'Connection error while voting' : 'Oy gönderilirken bağlantı hatası oluştu', 'error');
              } finally {
                isVoting = false;
              }
            };

            if (rydLikeBtn) {
              rydLikeBtn.onclick = (e) => {
                e.stopPropagation();
                handleVote(1);
              };
            }

            if (rydDislikeBtn) {
              rydDislikeBtn.onclick = (e) => {
                e.stopPropagation();
                handleVote(-1);
              };
            }

            rydPill.style.display = 'inline-flex';
            if (rydSep) rydSep.style.display = 'inline';
            if (window.lucide && typeof window.lucide.createIcons === 'function') {
              window.lucide.createIcons();
            }
          }
        })
        .catch(() => {});
    }
  }
};

    // 3. Bilgileri yerleştir
    updateInlinePlayerMetadata(video || { id: videoId, title: videoTitle, channelId: videoChannelId, channelName: videoChannelName, fileSize: fileSizeStr, publishedAt: publishDateStr });

    const activeVideoObj = video || { id: videoId, title: videoTitle, channelId: videoChannelId, channelName: videoChannelName, fileSize: fileSizeStr, publishedAt: publishDateStr };
    const currentPlatform = (typeof detectVideoPlatform === 'function') ? detectVideoPlatform(activeVideoObj) : 'youtube';
    const isPlatformYouTube = currentPlatform === 'youtube';

    // Auto show comments panel only for YouTube; automatically hide for external sources
    const commentsContainer = document.getElementById('inline-player-comments-container');
    const commentsBtn = document.getElementById('inline-btn-comments');
    const isEn = localDb.settings?.lang === 'en';
    if (isPlatformYouTube) {
      if (commentsBtn) {
        commentsBtn.style.display = 'inline-flex';
        commentsBtn.classList.add('active');
        commentsBtn.title = isEn ? 'Hide Comments' : 'Yorumları Gizle';
      }
      if (commentsContainer) {
        commentsContainer.classList.remove('hidden');
      }
      loadComments(videoId);
    } else {
      if (commentsBtn) {
        commentsBtn.style.display = 'none';
        commentsBtn.classList.remove('active');
      }
      if (commentsContainer) {
        commentsContainer.classList.add('hidden');
      }
    }

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

    // SponsorBlock renk açıklaması (legend) - Sadece YouTube
    const sbLegend = document.getElementById('inline-player-sponsorblock-legend');
    const sbSep = document.getElementById('inline-player-sb-sep');
    if (sbLegend) {
      sbLegend.style.display = isPlatformYouTube ? 'flex' : 'none';
      if (sbSep) sbSep.style.display = isPlatformYouTube ? 'inline' : 'none';
    }

    // 4. Eylemleri bağla
    // Platform bazlı kaynak açma butonu (#inline-btn-youtube)
    const btnYoutube = document.getElementById('inline-btn-youtube');
    if (btnYoutube) {
      const targetWebUrl = activeVideoObj?.webUrl || activeVideoObj?.url || '';
      let btnSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" style="fill:#ff0000; display:inline-block; vertical-align:middle;"><path d="M23.498 6.163a3.003 3.003 0 0 0-2.11-2.11C19.517 3.545 12 3.545 12 3.545s-7.516 0-9.388.508a3.003 3.003 0 0 0-2.11 2.11C0 8.033 0 12 0 12s0 3.967.502 5.837a3.003 3.003 0 0 0 2.11 2.11c1.872.508 9.388.508 9.388.508s7.517 0 9.388-.508a3.003 3.003 0 0 0 2.11-2.11C24 15.967 24 12 24 12s0-3.967-.502-5.837zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>`;
      let btnTitle = isEn ? 'Open on YouTube' : "YouTube'da Aç";
      let btnAction = () => openYouTube(videoId);

      if (currentPlatform === 'tiktok') {
        btnTitle = isEn ? 'Open on TikTok' : "TikTok'ta Aç";
        btnSvg = (typeof getPlatformSvgIcon === 'function') ? getPlatformSvgIcon('tiktok', 16) : btnSvg;
        const targetUrl = targetWebUrl || (videoChannelName ? `https://www.tiktok.com/@${videoChannelName.replace(/^@+/, '')}` : 'https://www.tiktok.com/');
        btnAction = () => {
          if (typeof window.openExternalWebUrl === 'function') window.openExternalWebUrl(targetUrl);
          else window.open(targetUrl, '_blank', 'noopener,noreferrer');
        };
      } else if (currentPlatform === 'x') {
        btnTitle = isEn ? 'Open on Twitter / X' : "X (Twitter)'da Aç";
        btnSvg = (typeof getPlatformSvgIcon === 'function') ? getPlatformSvgIcon('x', 16) : btnSvg;
        const targetUrl = targetWebUrl || (videoChannelName ? `https://x.com/${videoChannelName.replace(/^@+/, '')}` : 'https://x.com/');
        btnAction = () => {
          if (typeof window.openExternalWebUrl === 'function') window.openExternalWebUrl(targetUrl);
          else window.open(targetUrl, '_blank', 'noopener,noreferrer');
        };
      } else if (currentPlatform === 'instagram') {
        btnTitle = isEn ? 'Open on Instagram' : "Instagram'da Aç";
        btnSvg = (typeof getPlatformSvgIcon === 'function') ? getPlatformSvgIcon('instagram', 16) : btnSvg;
        const targetUrl = targetWebUrl || (videoChannelName ? `https://www.instagram.com/${videoChannelName.replace(/^@+/, '')}/` : 'https://www.instagram.com/');
        btnAction = () => {
          if (typeof window.openExternalWebUrl === 'function') window.openExternalWebUrl(targetUrl);
          else window.open(targetUrl, '_blank', 'noopener,noreferrer');
        };
      } else if (!isPlatformYouTube) {
        btnTitle = isEn ? 'Open in Browser' : "Kaynağı Aç";
        btnSvg = (typeof getPlatformSvgIcon === 'function') ? getPlatformSvgIcon(currentPlatform, 16) : btnSvg;
        const targetUrl = targetWebUrl || 'https://google.com';
        btnAction = () => {
          if (typeof window.openExternalWebUrl === 'function') window.openExternalWebUrl(targetUrl);
          else window.open(targetUrl, '_blank', 'noopener,noreferrer');
        };
      }

      btnYoutube.innerHTML = btnSvg;
      btnYoutube.title = btnTitle;
      btnYoutube.setAttribute('aria-label', btnTitle);
      btnYoutube.onclick = btnAction;
    }

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
        btnFolder.onclick = () => window.openVideoLocation(videoId, encodeURIComponent(video.filePath || ''), encodeURIComponent(videoChannelName || ''));
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
          document.querySelectorAll('#inline-player-body video, .player-modal-body video, #embedded-video-player, audio').forEach(v => {
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
        btnTranslate.onclick = async () => {
          let currentSubs = (typeof getCurrentSubtitles === 'function' && getCurrentSubtitles().length > 0)
            ? getCurrentSubtitles()
            : null;
          if (!currentSubs || currentSubs.length === 0) {
            currentSubs = await fetchVideoSubtitles(videoId);
          }
          openSubtitleTranslateModal(videoId, currentSubs, {
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

    // SponsorBlock toggle button logic (yalnızca YouTube kaynaklarında)
    const btnSBToggle = document.getElementById('inline-btn-sponsorblock-toggle');
    if (btnSBToggle) {
      if (isPlatformYouTube) {
        btnSBToggle.style.display = 'inline-flex';
        updateSBToggleButtonUI();
      } else {
        btnSBToggle.style.display = 'none';
      }

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

            // İzlenme sayısını da tazele
            if (descData.viewCount !== undefined && descData.viewCount !== null) {
              const vEl = document.getElementById('inline-player-video-views');
              const vTextEl = document.getElementById('inline-player-video-views-text');
              if (vEl && vTextEl) {
                const formatted = (typeof formatInlineViewsCount === 'function')
                  ? formatInlineViewsCount(descData.viewCount)
                  : ((Number(descData.viewCount) >= 1000000) ? (Number(descData.viewCount)/1000000).toFixed(1)+'M' : Number(descData.viewCount).toLocaleString());
                vTextEl.textContent = formatted || '--';
                vEl.title = Number(descData.viewCount).toLocaleString();
                vEl.style.display = 'inline-flex';
              }
              const localHist = window.localDb?.history?.find(h => h.id === videoId);
              if (localHist) localHist.viewCount = descData.viewCount;
            }

            // Kanal abone sayısını ve avatarını oynatıcı üst çubuğunda anında tazele
            if (descData.subscriberCount && descData.subscriberCount !== '?') {
              const subsEl = document.getElementById('inline-player-channel-subs');
              const subsTextEl = document.getElementById('inline-player-channel-subs-text');
              const dividerEl = document.getElementById('inline-player-channel-divider');
              if (subsEl && subsTextEl) {
                subsTextEl.textContent = descData.subscriberCount;
                subsEl.style.display = 'inline-flex';
                if (dividerEl) dividerEl.style.display = 'inline';
              }
              const localCh = window.localDb?.channels?.find(c =>
                (descData.channelId && c.id === descData.channelId) ||
                (descData.channelName && c.name === descData.channelName)
              );
              if (localCh) localCh.subscriberCount = descData.subscriberCount;
            }

            if (descData.channelId) {
              const avatarEl = document.getElementById('inline-player-channel-avatar');
              const logoDividerEl = document.getElementById('inline-player-logo-divider');
              const platformIconEl = document.getElementById('inline-player-platform-icon');
              if (avatarEl && hasFollowedChannelAvatar(descData.channelId)) {
                avatarEl.onerror = function() { this.style.display = 'none'; };
                avatarEl.src = `/api/channels/${encodeURIComponent(descData.channelId)}/avatar?t=${Date.now()}`;
                avatarEl.style.display = 'block';
                if (logoDividerEl) logoDividerEl.style.display = 'inline';
                if (platformIconEl) platformIconEl.style.display = 'none';
              }
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

    // Kaldığım Yeri YouTube'a Eşitle Butonu logic (yalnızca YouTube kaynaklarında)
    const btnSyncWatchtime = document.getElementById('inline-btn-sync-watchtime');
    if (btnSyncWatchtime) {
      if (!isPlatformYouTube) {
        btnSyncWatchtime.style.display = 'none';
        btnSyncWatchtime.onclick = null;
      } else {
        btnSyncWatchtime.style.display = 'inline-flex';
      }
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

    // Videoyu Paylaş Butonu (#inline-btn-share)
    const btnShare = document.getElementById('inline-btn-share');
    if (btnShare) {
      btnShare.onclick = () => {
        if (typeof window.shareVideo === 'function') {
          window.shareVideo(videoId);
        }
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
  };

  if (isInline) {
    // 1. Modal oynatıcıyı kapat/gizle
    const modal = document.getElementById('player-modal');
    if (modal) modal.classList.add('hidden');

    // 2. Inline player UI göster/gizle
    const inlineContainer = document.getElementById('downloaded-inline-player-container');
    const listContainer = document.getElementById('downloaded-list-container');
    if (inlineContainer) inlineContainer.classList.remove('hidden');
    if (listContainer) listContainer.classList.add('hidden');
    if (typeof window.initTheaterMode === 'function') window.initTheaterMode();

    // Video oynatılmaya başladığında sayfayı en yukarı kaydır (böylece oynatıcı tam olarak görünür olur)
    const mainContent = document.querySelector('.main-content');
    if (mainContent) {
      mainContent.scrollTop = 0;
    }

    playerContainer = document.getElementById('inline-player-body');
    window.setupInlinePlayerPanels(videoId, video || { id: videoId, title: videoTitle, channelId: videoChannelId, channelName: videoChannelName, fileSize: fileSizeStr, publishedAt: publishDateStr }, availableSubtitles, playerContainer);
    if (typeof initVideoTitleOverlay === 'function') {
      initVideoTitleOverlay(videoTitle || video?.title || 'Yerleşik Oynatıcı', playerContainer);
    }

  } else {
    // Floating Modal player
    const inlineContainer = document.getElementById('downloaded-inline-player-container');
    const listContainer = document.getElementById('downloaded-list-container');
    if (typeof resetSummaryState === 'function') resetSummaryState();
    if (inlineContainer) inlineContainer.classList.add('hidden');
    if (listContainer) listContainer.classList.remove('hidden');

    const modal = document.getElementById('player-modal');
    const titleEl = document.getElementById('player-modal-title');
    if (modal) {
      if (titleEl) {
        titleEl.textContent = videoTitle || 'Gömülü Video Oynatıcı';
      }
      if (typeof initVideoTitleOverlay === 'function') {
        initVideoTitleOverlay(videoTitle || video?.title || 'Gömülü Video Oynatıcı', modal.querySelector('.player-modal-body'));
      }
      
      const modalPlatform = (typeof detectVideoPlatform === 'function') ? detectVideoPlatform(video) : 'youtube';
      const isModalYouTube = modalPlatform === 'youtube';
      const logoEl = document.getElementById('player-modal-logo');
      if (logoEl && isModalYouTube && hasFollowedChannelAvatar(videoChannelId)) {
        logoEl.onerror = function() {
          this.onerror = null;
          this.src = getSiteFaviconInfo(video).fallback;
        };
        logoEl.src = `/api/channels/${encodeURIComponent(videoChannelId)}/avatar`;
        logoEl.style.display = 'block';
        logoEl.style.cursor = 'pointer';
        logoEl.title = localDb.settings?.lang === 'en' ? 'Go to Channel Videos' : 'Kanala Git';
        logoEl.onclick = (e) => {
          e.preventDefault();
          window.open(`https://www.youtube.com/channel/${videoChannelId}/videos`, '_blank');
        };
      } else if (logoEl && video) {
        const fav = getSiteFaviconInfo(video);
        logoEl.onerror = function() {
          this.onerror = null;
          this.src = fav.fallback;
        };
        logoEl.src = fav.src;
        logoEl.style.display = 'block';
        const extTargetUrl = video.webUrl || video.url || '';
        if (extTargetUrl && (extTargetUrl.startsWith('http://') || extTargetUrl.startsWith('https://'))) {
          logoEl.style.cursor = 'pointer';
          logoEl.title = fav.domain || '';
          logoEl.onclick = (e) => {
            e.preventDefault();
            window.open(extTargetUrl, '_blank');
          };
        } else {
          logoEl.style.cursor = 'default';
          logoEl.onclick = null;
        }
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
  // Masaüstü uygulamasında (WebView2) sunucu stream yerine doğrudan yerel diskten oynat (sıfır ağ yükü ve anında ileri/geri sarma)
  if (isCompleted && !isMissing && video.filePath && typeof window !== 'undefined' && window.chrome && window.chrome.webview) {
    const normalizedPath = video.filePath.replace(/\\/g, '/');
    const driveMatch = normalizedPath.match(/^([a-zA-Z]):\/(.*)$/);
    if (driveMatch) {
      const driveLetter = driveMatch[1].toLowerCase();
      const restPath = driveMatch[2].split('/').map(seg => encodeURIComponent(seg)).join('/');
      streamUrl = `http://haytool-${driveLetter}.local/${restPath}`;
    }
  }

  const playRemote = !isCompleted || isMissing;
  const rawYtId = (video && video.originalId) ? video.originalId : String(videoId || '').replace(/^fakap_/, '');

  if (playRemote && typeof Plyr === 'undefined') {
    if (playerContainer) {
      const autoplayVal = (forcePaused === true) ? '0' : '1';
      playerContainer.innerHTML = `<iframe src="https://www.youtube.com/embed/${rawYtId}?autoplay=${autoplayVal}&fs=1&rel=0" style="width: 100%; height: 100%; border: none; display: block;" allow="autoplay; encrypted-media; fullscreen; picture-in-picture" allowfullscreen></iframe>`;
    }
    videoPlayerInstance = null;
    window.videoPlayerInstance = null;
    if (forcePaused !== true) {
      sendPlayerActivity(true);
    }
  } else {
    if (playerContainer) {
      if (playRemote) {
        playerContainer.innerHTML = `<div id="embedded-video-player" data-plyr-provider="youtube" data-plyr-embed-id="${rawYtId}" style="width: 100%; height: 100%;"></div>`;
      } else {
        const autoplayAttr = (forcePaused === true) ? '' : 'autoplay';
        playerContainer.innerHTML = `<video id="embedded-video-player" controls ${autoplayAttr} style="width: 100%; height: 100%; display: block; outline: none;"></video>`;
      }
    }

    if (playerType === 'plyr' && typeof Plyr === 'undefined') {
      console.error('[HaYTooL] Plyr kütüphanesi (Plyr) bulunamadı → HTML5 standart moda düşüldü.');
    }
    if (!playRemote) {
      // Altyazıların arka plandan gelmesini bekle (yarış durumunu önler, Plyr altyazıları ilk anda tanır)
      try {
        await Promise.race([
          subFetchPromise,
          new Promise(resolve => setTimeout(resolve, 350))
        ]);
      } catch (e) {}
    }

    const player = document.getElementById('embedded-video-player');
    if (player && !playRemote) {
      // Clear old track tags
      const oldTracks = player.querySelectorAll('track');
      oldTracks.forEach(t => t.remove());

      // Add track tags if available
      if (availableSubtitles && availableSubtitles.length > 0) {
        applySubtitlesToPlayer(availableSubtitles, player);
      }
    }

    if (playerType === 'plyr' && typeof Plyr !== 'undefined') {
      if (!playRemote && player) {
        player.src = streamUrl;
      }
      videoPlayerInstance = new Plyr('#embedded-video-player', {
        iconUrl: '/plyr.svg',
        controls: [
          'play-large', 'restart', 'rewind', 'play', 'fast-forward',
          'progress', 'current-time', 'duration', 'mute', 'volume',
          'captions', 'settings', 'pip', 'fullscreen'
        ],
        settings: ['captions', 'speed', 'loop'],
        captions: { active: (localStorage.getItem('haytool_subtitles_enabled') === 'true'), update: true },
        speed: { selected: 1, options: [0.5, 0.75, 0.85, 0.9, 1, 1.05, 1.1, 1.15, 1.25, 1.5, 1.75, 2] },
        youtube: {
          noCookie: false,
          rel: 0,
          showinfo: 0,
          iv_load_policy: 3,
          modestbranding: 1,
          playsinline: 1,
          hl: (localDb.settings && localDb.settings.lang) || 'tr'
        }
      });
      window.videoPlayerInstance = videoPlayerInstance;
      if (typeof initVideoTitleOverlay === 'function') {
        initVideoTitleOverlay(videoTitle || video?.title || '', playerContainer);
      }

      // Kullanıcının altyazı açık/kapalı tercihini hafızaya al
      videoPlayerInstance.on('captionsenabled', () => {
        localStorage.setItem('haytool_subtitles_enabled', 'true');
      });
      videoPlayerInstance.on('captionsdisabled', () => {
        localStorage.setItem('haytool_subtitles_enabled', 'false');
      });

          const bindPlyrInteractions = () => {
            const containerSelector = isInline ? '#downloaded-inline-player-container' : '#player-modal';
            const outerContainer = document.querySelector(containerSelector);
            const plyrContainer = outerContainer?.querySelector('.plyr');
            if (plyrContainer && typeof initVideoTitleOverlay === 'function') {
              initVideoTitleOverlay(videoTitle || video?.title || '', plyrContainer);
            }
            if (typeof injectSpeedControlToPlyr === 'function') {
              injectSpeedControlToPlyr(videoPlayerInstance, plyrContainer || outerContainer);
            }
            if (plyrContainer && !plyrContainer._boundWheelDbl) {
              plyrContainer._boundWheelDbl = true;
              plyrContainer.addEventListener('wheel', (e) => {
                e.preventDefault();
                let currentVolume = videoPlayerInstance.volume;
                const step = getPlayerVolumeStep();
                let newVolume;
                if (e.deltaY < 0) {
                  newVolume = Math.min(1, Math.round((currentVolume + step) * 100) / 100);
                } else {
                  newVolume = Math.max(0, Math.round((currentVolume - step) * 100) / 100);
                }
                videoPlayerInstance.volume = newVolume;
                if (typeof triggerVolumeHUD === 'function') {
                  triggerVolumeHUD(newVolume, e.deltaY < 0 ? 'up' : 'down');
                }
              }, { passive: false });

              plyrContainer.addEventListener('dblclick', (e) => {
                // Buton veya kontroller tıklandıysa yoksay
                if (e.target.closest('.plyr__controls') || e.target.closest('button') || e.target.closest('input')) return;
                e.preventDefault();
                const willBeFs = !document.fullscreenElement;
                if (typeof window.toggleActiveVideoFullscreen === 'function') {
                  window.toggleActiveVideoFullscreen();
                } else if (videoPlayerInstance && typeof videoPlayerInstance.fullscreen?.toggle === 'function') {
                  try {
                    videoPlayerInstance.fullscreen.toggle()?.catch?.(() => {});
                  } catch (e) {}
                }
                if (typeof showActionToast === 'function') {
                  const uLang = (localDb && localDb.settings && localDb.settings.lang) || localStorage.getItem('haytool_user_lang') || 'tr';
                  const lDict = window.translations?.[uLang] || window.translations?.['tr'] || {};
                  const fsLabel = willBeFs ? (lDict.hud_fullscreen || 'Tam Ekran') : (lDict.hud_exit_fullscreen || 'Pencere Modu');
                  showActionToast(willBeFs ? 'maximize' : 'minimize', fsLabel, 1700);
                }
              });
            }
          };

          videoPlayerInstance.on('ready', () => {
            const containerSelectorReady = isInline ? '#downloaded-inline-player-container' : '#player-modal';
            const outerReady = document.querySelector(containerSelectorReady);
            const ytIframe = outerReady?.querySelector('iframe');
            if (ytIframe) {
              ytIframe.setAttribute('allow', 'autoplay; encrypted-media; fullscreen; picture-in-picture');
              ytIframe.setAttribute('allowfullscreen', '');
            }
            bindPlyrInteractions();
            if (isInline && typeof window.injectTheaterModeButtonToPlyr === 'function') {
              window.injectTheaterModeButtonToPlyr();
            }
            adjustPlayerOrientation(videoPlayerInstance.media);
            if (videoPlayerInstance.duration) {
              drawSponsorSegmentsOnTimeline(videoPlayerInstance.duration, 'plyr');
            }
            if (playRemote) {
              if (!seekedForCurrentVideo && currentPlayingVideoId) {
                const item = (localDb.history || []).find(h => h.id === currentPlayingVideoId);
                const targetTime = (startSeconds !== null) ? startSeconds : (item?.lastPositionSeconds || (JSON.parse(localStorage.getItem('haytool_playback_resume') || '{}')[currentPlayingVideoId] || 0));
                if (targetTime > 3) {
                  try {
                    videoPlayerInstance.currentTime = targetTime;
                    window.showResumeNotification(targetTime);
                  } catch (e) {}
                }
                seekedForCurrentVideo = true;
              }
              if (forcePaused === true) {
                try { videoPlayerInstance.pause(); } catch (e) {}
              } else {
                try {
                  const p = videoPlayerInstance.play();
                  if (p && typeof p.catch === 'function') p.catch(() => {});
                } catch (e) {}
              }
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
          bindPlyrInteractions();

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

          if (!playRemote) {
            if (forcePaused === true) {
              videoPlayerInstance.pause();
            } else if (forcePaused === false) {
              const p = videoPlayerInstance.play();
              if (p && typeof p.catch === 'function') p.catch(err => console.warn(err));
            } else {
              const p = videoPlayerInstance.play();
              if (p && typeof p.catch === 'function') {
                p.catch(err => {
                  console.warn('Otomatik oynatma engellendi:', err);
                });
              }
            }
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
          if (typeof initVideoTitleOverlay === 'function') {
            initVideoTitleOverlay(videoTitle || video?.title || '', playerContainer);
          }

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
            const step = getPlayerVolumeStep();
            let newVolume;
            if (e.deltaY < 0) {
              newVolume = Math.min(1, Math.round((currentVolume + step) * 100) / 100);
            } else {
              newVolume = Math.max(0, Math.round((currentVolume - step) * 100) / 100);
            }
            player.volume = newVolume;
            if (typeof triggerVolumeHUD === 'function') {
              triggerVolumeHUD(newVolume, e.deltaY < 0 ? 'up' : 'down');
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
  const playlistGrid = document.getElementById('downloaded-playlist-grid');
  if (playlistGrid) playlistGrid.innerHTML = '';

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
  if (typeof applyDownloadedChannelAndCategoryFilter === 'function') {
    filteredDownloaded = applyDownloadedChannelAndCategoryFilter(filteredDownloaded, localDb);
  } else if (downloadedFilterChannel !== 'all') {
    if (downloadedFilterChannel.startsWith('category:')) {
      const catId = parseInt(downloadedFilterChannel.split(':')[1], 10);
      const channelIdsInCat = (localDb.channels || []).filter(c => (c.categoryIds || [c.categoryId || 1]).includes(catId)).map(c => c.id);
      const channelIdsInCatSet = new Set(channelIdsInCat);
      filteredDownloaded = filteredDownloaded.filter(item => channelIdsInCatSet.has(item.channelId));
    } else if (downloadedFilterChannel.startsWith('platform:')) {
      const targetPlat = downloadedFilterChannel.split(':')[1];
      filteredDownloaded = filteredDownloaded.filter(item => {
        const p = item.platform || (typeof detectVideoPlatform === 'function' ? detectVideoPlatform(item) : 'youtube');
        return p === targetPlat;
      });
    } else {
      filteredDownloaded = filteredDownloaded.filter(item => item.channelId === downloadedFilterChannel);
    }
  }
  const showShorts = localDb.settings?.showShorts !== false;
  if (!showShorts) {
    filteredDownloaded = filteredDownloaded.filter(item => !isShortVideo(item.duration, item.title, item.channelId, item));
  }
  const dlPlSearch = ((document.getElementById('downloaded-search-input')?.value || window.downloadedSearchQuery) || '').trim().toLowerCase();
  if (dlPlSearch) {
    filteredDownloaded = filteredDownloaded.filter(item => {
      const title = (item.title || '').toLowerCase();
      const chName = (item.channelName || '').toLowerCase();
      return title.includes(dlPlSearch) || chName.includes(dlPlSearch);
    });
  }
  
  const sortVal = downloadedSortVal || 'date-desc';
  sortDownloadedItems(filteredDownloaded, sortVal, localDb);

  if (filteredDownloaded.length === 0) {
    playlistGrid.innerHTML = `<p class="text-muted" style="font-size:0.8rem; padding: 10px;">${currentLang === 'en' ? 'No other videos found' : 'Başka video bulunamadı'}</p>`;
    return;
  }

  const langKey = localDb?.settings?.lang || currentLang || 'tr';
  const t = translations[langKey] || translations.tr || {};

  filteredDownloaded.forEach(item => {
    const isCurrent = item.id === currentVideoId;
    const itemEl = document.createElement('div');
    itemEl.className = `playlist-item${isCurrent ? ' active' : ''}${sortVal === 'user' ? ' user-sortable-playlist-item' : ''}`;
    itemEl.setAttribute('data-id', item.id);
    if (sortVal === 'user') {
      itemEl.setAttribute('draggable', 'true');
    }
    
    itemEl.onclick = () => {
      if (window._justDraggedSortable) return;
      if (!isCurrent) {
        playVideoEmbedded(item.id);
      }
    };

    const durationHtml = item.duration ? `<span class="playlist-item-duration">${item.duration}</span>` : '';
    const playlistQualityHtml = item.actualQuality ? `<span class="playlist-item-quality quality-${item.actualQuality.toLowerCase()}">${item.actualQuality}</span>` : '';
    const userSortSidebarBtns = sortVal === 'user' ? `
      <div class="playlist-item-sort-controls" onclick="event.stopPropagation()" title="${escapeHtml(t.user_sort_drag_hint || 'Sürükleyerek veya oklarla sıralayın')}">
        <span class="user-sort-grip" aria-hidden="true">⋮⋮</span>
        <button type="button" class="playlist-item-sort-btn" onclick="event.stopPropagation(); window.moveDownloadedItemInUserOrder && window.moveDownloadedItemInUserOrder('${escapeHtml(item.id)}', 'up')" title="${escapeHtml(t.user_sort_move_up || 'Yukarı Taşı')}" aria-label="${escapeHtml(t.user_sort_move_up || 'Yukarı Taşı')}">▲</button>
        <button type="button" class="playlist-item-sort-btn" onclick="event.stopPropagation(); window.moveDownloadedItemInUserOrder && window.moveDownloadedItemInUserOrder('${escapeHtml(item.id)}', 'down')" title="${escapeHtml(t.user_sort_move_down || 'Aşağı Taşı')}" aria-label="${escapeHtml(t.user_sort_move_down || 'Aşağı Taşı')}">▼</button>
      </div>
    ` : '';

    itemEl.innerHTML = `
      ${userSortSidebarBtns}
      <div class="playlist-item-thumbnail-wrapper">
        <img class="playlist-item-thumbnail" width="100" height="56" loading="lazy" decoding="async" draggable="false" src="/api/video/${item.id}/thumbnail" alt="${escapeHtml(item.title)}" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22100%22 height=%2256%22><rect width=%22100%22 height=%2256%22 fill=%22%2316142a%22/><text x=%2250%25%22 y=%2250%25%22 dominant-baseline=%22middle%22 text-anchor=%22middle%22 fill=%22%2394a3b8%22 font-family=%22sans-serif%22 font-size=%228%22>No Image</text></svg>'">
        ${playlistQualityHtml}
        ${durationHtml}
      </div>
      <div class="playlist-item-details">
        <h5 class="playlist-item-title" title="${escapeHtml(item.title)}">${escapeHtml(item.title)}</h5>
        <div class="playlist-item-channel" title="${escapeHtml(item.channelName || '')} • ${item.fileSize || '-- MB'} • ${formatDate(item.publishedAt || item.downloadedAt)}">
          ${getChannelOrSiteAvatarHtml(item, 'playlist-item-channel-avatar')}
          <span class="playlist-item-channel-name">${escapeHtml(item.channelName || '')}</span>
          <span class="playlist-item-meta-sep">•</span>
          <span class="playlist-item-meta-info">${item.fileSize || '-- MB'} • ${formatDate(item.publishedAt || item.downloadedAt)}</span>
        </div>
      </div>
      <div class="playlist-item-actions">
        <button class="playlist-item-action-btn btn-action-yt" onclick="event.stopPropagation(); (window.openYouTube || openYouTube)('${item.id}')" title="${currentLang === 'en' ? 'Open on YouTube' : 'YouTube\'da Aç'}" aria-label="${currentLang === 'en' ? 'Open on YouTube' : 'YouTube\'da Aç'}">
          <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor" aria-hidden="true"><path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.6 12 3.6 12 3.6s-7.5 0-9.4.5A3 3 0 0 0 .5 6.2C0 8.1 0 12 0 12s0 3.9.5 5.8a3 3 0 0 0 2.1 2.1c1.9.5 9.4.5 9.4.5s7.5 0 9.4-.5a3 3 0 0 0 2.1-2.1c.5-1.9.5-5.8.5-5.8s0-3.9-.5-5.8zM9.6 15.6V8.4l6.2 3.6-6.2 3.6z"/></svg>
        </button>
        <button class="playlist-item-action-btn btn-action-folder" onclick="event.stopPropagation(); window.openVideoLocation('${item.id}')" title="${currentLang === 'en' ? 'Open Video Location' : 'Video Konumunu Aç'}" aria-label="${currentLang === 'en' ? 'Open Video Location' : 'Video Konumunu Aç'}">
          <i data-lucide="folder-open" style="width: 13px; height: 13px;"></i>
        </button>
        <button class="playlist-item-delete-btn" onclick="event.stopPropagation(); (window.showDeleteModal || showDeleteModal)('${item.id}')" title="${currentLang === 'en' ? 'Delete Video' : 'Videoyu Sil'}" aria-label="${currentLang === 'en' ? 'Delete Video' : 'Videoyu Sil'}">
          <i data-lucide="trash-2" style="width: 13px; height: 13px;"></i>
        </button>
      </div>
    `;
    playlistGrid.appendChild(itemEl);
  });

  try {
    if (typeof lucide !== 'undefined' && typeof lucide.createIcons === 'function') {
      lucide.createIcons({ root: playlistGrid });
    }
  } catch (e) {}
}
window.renderDownloadedPlaylist = renderDownloadedPlaylist;

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

// Türkçe Açıklama: Videonun diskteki konumunu işletim sisteminin dosya yöneticisinde (Explorer/Finder/Dolphin) açar ve video dosyasını seçili gösterir.
// Dosya yolu bilinmiyorsa kanal klasörünü açmaya geri döner.
/**
 * Videonun diskteki konumunu dosya yöneticisinde açar ve dosyayı seçili gösterir.
 *
 * @param {string} videoId Video ID'si (log/yedek amaçlı)
 * @param {string} encodedFilePath encodeURIComponent ile kodlanmış mutlak dosya yolu
 * @param {string} encodedChannelName encodeURIComponent ile kodlanmış kanal adı (yedek yol)
 */
window.openVideoLocation = async function(videoId, encodedFilePath, encodedChannelName) {
  let filePath = '';
  if (encodedFilePath) {
    try {
      filePath = decodeURIComponent(encodedFilePath);
    } catch (e) {
      filePath = encodedFilePath;
    }
  }
  try {
    const res = await fetch('/api/tools/open-file-location', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filePath, videoId })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.error) {
      showToast(data.error || (currentLang === 'en' ? 'Video location could not be opened.' : 'Video konumu açılamadı.'), 'error');
    }
  } catch (err) {
    showToast(currentLang === 'en' ? 'Server communication error.' : 'Sunucu ile iletişim hatası.', 'error');
  }
};

// Türkçe Açıklama: Fare video kartı veya kapak üzerine geldiğinde yüksek çözünürlüklü (HQ) alternatif kapak karesi döngüsünü çalıştırır.
window.handleThumbMouseEnter = function(targetEl) {
  if (!targetEl || (window.dbSettings && window.dbSettings.enableAltThumbnailsHover === false)) return;
  const wrapperEl = (targetEl.classList.contains('video-thumbnail-wrapper') || targetEl.hasAttribute('data-thumb-hover'))
    ? targetEl
    : targetEl.querySelector('.video-thumbnail-wrapper');
  if (!wrapperEl) return;

  const videoId = wrapperEl.getAttribute('data-video-id') || targetEl.getAttribute('data-id');
  if (!videoId || !/^[a-zA-Z0-9_-]{11}$/.test(videoId)) return;

  // Harici platformlar (TikTok, X, Instagram) için resim döndürme döngüsü çalıştırılmaz, orijinal kapak sabit kalır
  const vPlatform = wrapperEl.getAttribute('data-platform');
  if (vPlatform && vPlatform !== 'youtube') return;
  if (String(videoId).startsWith('ext_')) return;

  // Uzak sunucu durumu değişen (silinmiş, gizli, liste dışı, üyelere özel) videolarda 1/2/3.jpg 404 hatasını önle
  const histItem = (typeof localDb !== 'undefined' ? localDb : window.localDb)?.history?.find(h => h.id === videoId);
  if (histItem && ['deleted', 'unlisted', 'private', 'members_only'].includes(histItem.remoteStatus)) {
    return;
  }

  const imgEl = wrapperEl.querySelector('.video-thumbnail, [data-thumb-img]');
  if (!imgEl) return;

  // Aktif indirme kapağı gibi video değişebilen alanlarda eski kapak önbelleğini sıfırla
  if (wrapperEl.dataset.origVid !== videoId) {
    delete wrapperEl.dataset.origSrc;
    wrapperEl.dataset.origVid = videoId;
  }
  if (!wrapperEl.dataset.origSrc) {
    wrapperEl.dataset.origSrc = imgEl.src;
  }

  // YouTube video storyboard kareleri (1.jpg, 2.jpg, 3.jpg her videoda garanti mevcuttur)
  // Sıralama: Orijinal Kapak -> Kare 1 -> Kare 2 -> Kare 3 -> Tekrar Başa (Orijinal Kapak)
  const altUrls = [
    wrapperEl.dataset.origSrc,
    `https://img.youtube.com/vi/${videoId}/1.jpg`,
    `https://img.youtube.com/vi/${videoId}/2.jpg`,
    `https://img.youtube.com/vi/${videoId}/3.jpg`
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

// Türkçe Açıklama: İndirme aktifken kuyruktaki aktif kapak resmi fare olmadan da otomatik döner; indirme bitince durur.
window.syncActiveThumbCycle = function(isActive) {
  const w = document.getElementById('active-thumbnail-wrapper');
  if (!w) return;
  window._activeThumbWanted = !!isActive;
  if (isActive) {
    if (!w._thumbTimer && w.getAttribute('data-video-id')) window.handleThumbMouseEnter(w);
  } else if (w._thumbTimer) {
    window.handleThumbMouseLeave(w);
  }
};

window.handleThumbMouseLeave = function(targetEl) {
  if (!targetEl) return;
  const wrapperEl = (targetEl.classList.contains('video-thumbnail-wrapper') || targetEl.hasAttribute('data-thumb-hover'))
    ? targetEl
    : targetEl.querySelector('.video-thumbnail-wrapper');
  if (!wrapperEl) return;

  if (wrapperEl._thumbTimer) {
    clearInterval(wrapperEl._thumbTimer);
    wrapperEl._thumbTimer = null;
  }
  const imgEl = wrapperEl.querySelector('.video-thumbnail, [data-thumb-img]');
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

window.openExternalWebUrl = async function(url, videoId, currentSeconds) {
  if (url && (url.startsWith('http://') || url.startsWith('https://')) && !url.includes('youtube.com/watch?v=ext_')) {
    try {
      await fetch('/api/open-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      });
      return;
    } catch (e) {
      window.open(url, '_blank');
      return;
    }
  }
  // YouTube fallback
  if (typeof window.openYouTube === 'function') {
    window.openYouTube(videoId, currentSeconds);
  }
};

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

  const isIptv = (item.platform === 'iptv') || (typeof item.id === 'string' && item.id.startsWith('iptv_')) || (typeof detectVideoPlatform === 'function' && detectVideoPlatform(item) === 'iptv');
  const isExternalPlatform = isIptv || (item.platform && item.platform !== 'youtube') || (typeof item.id === 'string' && (item.id.startsWith('ext_') || item.id.startsWith('ws_')));
  const markWatchedContainer = document.getElementById('mark-watched-container');
  const hideLibraryContainer = document.getElementById('hide-library-container');

  if (isIptv) {
    checkboxContainers.forEach(c => c.classList.add('hidden'));
    if (fileCb) fileCb.checked = true;
  } else if (isExternalPlatform) {
    if (markWatchedContainer) markWatchedContainer.classList.add('hidden');
    if (hideLibraryContainer) hideLibraryContainer.classList.add('hidden');
  } else {
    if (markWatchedContainer) markWatchedContainer.classList.remove('hidden');
    if (hideLibraryContainer) hideLibraryContainer.classList.remove('hidden');
  }
  
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
    const targetItem = (localDb.history || []).find(h => h.id === id);
    const isExternal = (targetItem && targetItem.platform && targetItem.platform !== 'youtube') || id.startsWith('ext_');

    const deleteFile = (deleteFileCheckbox || document.getElementById('delete-file-checkbox'))?.checked ?? true;
    const markWatchedCb = markWatchedCheckbox || document.getElementById('mark-watched-checkbox');
    const markWatched = (!isExternal && markWatchedCb) ? markWatchedCb.checked : false;
    const hideLibraryCb = hideLibraryCheckbox || document.getElementById('hide-library-checkbox');
    const hideOnDelete = hideLibraryCb ? hideLibraryCb.checked : (localDb.settings?.hideOnDelete !== false);

    // Tercihleri kalıcı olarak sakla (sadece YouTube videolarında ayar kaydedilir)
    if (!isExternal) {
      localStorage.setItem('haytool_mark_watched_on_delete', String(markWatched));
      localStorage.setItem('haytool_hide_on_delete', String(hideOnDelete));
    }
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
      document.querySelectorAll('#inline-player-body video, .player-modal-body video, #embedded-video-player, audio').forEach(v => {
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
        if (typeof window.showUndoToast === 'function' && backupItem) {
          window.showUndoToast(isEn ? 'Video deleted from library.' : 'Video kütüphaneden silindi.', async () => {
            localDb.history.push(backupItem);
            if (typeof updateUI === 'function') updateUI(localDb);
            await fetch('/api/history', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(backupItem)
            }).catch(() => {});
            showToast(isEn ? 'Video restored.' : 'Video geri yüklendi.', 'success');
          });
        } else {
          showToast(isEn ? 'Video deleted successfully.' : 'Video başarıyla silindi.', 'success');
        }
        if (typeof updateDiskSpace === 'function') setTimeout(updateDiskSpace, 1500);
        // Eğer bu video otomatik silme onay listesinde varsa oradan da dinamik olarak kaldır
        if (window.pendingAutoDeleteVideos && Array.isArray(window.pendingAutoDeleteVideos)) {
          const pIndex = window.pendingAutoDeleteVideos.findIndex(v => (v?.id || v) === id);
          if (pIndex !== -1) {
            window.pendingAutoDeleteVideos.splice(pIndex, 1);
            if (Array.isArray(pendingAutoDeleteVideos)) {
              const pIdx2 = pendingAutoDeleteVideos.findIndex(v => (v?.id || v) === id);
              if (pIdx2 !== -1) pendingAutoDeleteVideos.splice(pIdx2, 1);
            }
            const itemDom = document.getElementById(`auto-delete-item-${id}`);
            if (itemDom) itemDom.remove();
            
            const countEl = document.getElementById('auto-delete-modal-title');
            const remainingCount = window.pendingAutoDeleteVideos.length;
            if (countEl) {
              countEl.textContent = isEn 
                ? `${remainingCount} Expired Videos to Delete`
                : `${remainingCount} Adet Süresi Dolan Video Silinecek`;
            }
            if (remainingCount === 0 && typeof hideAutoDeleteConfirmModal === 'function') {
              hideAutoDeleteConfirmModal();
            }
          }
        }
        else if (window.updateDiskSpace) setTimeout(window.updateDiskSpace, 1500);

        if (typeof window.removeVideoFromRemoteStatusAlertModal === 'function') {
          window.removeVideoFromRemoteStatusAlertModal(id);
        }
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

// === OTOMATİK SİLME ONAY VE ERTELEME SİSTEMİ ===
let pendingAutoDeleteVideos = [];
window.pendingAutoDeleteVideos = pendingAutoDeleteVideos;

// Otomatik silme onay modalı -> ./modules/autoDeleteModal.js
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initAutoDeleteModalButtons);
} else {
  initAutoDeleteModalButtons();
}

// Kütüphane ve İndirilenler filtre/sıralama kalıcılığı -> ./modules/filterState.js

// Kütüphane Sıralama Butonları Dinleyicisi
const historySortGroup = document.getElementById('history-sort-group');
if (historySortGroup) {
  historySortGroup.addEventListener('click', (e) => {
    const btn = e.target.closest('.sort-btn');
    if (!btn) return;
    let sortVal = btn.getAttribute('data-sort');
    if (!sortVal) return;

    // "Tarih" tek buton: her tıklamada yön değiştirir (yeniden eskiye ↔ eskiden yeniye).
    if (sortVal === 'date') {
      sortVal = (historySortMode === 'date-desc') ? 'date-asc' : 'date-desc';
      const dateLabel = document.getElementById('history-sort-date-label');
      if (dateLabel) dateLabel.textContent = sortVal === 'date-asc' ? 'Tarih ▲' : 'Tarih ▼';
      btn.title = sortVal === 'date-asc' ? 'Tarih: Eskiden Yeniye' : 'Tarih: Yeniden Eskiye';
    }

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
        body: JSON.stringify({ historyViewMode: 'grid' })
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
        body: JSON.stringify({ historyViewMode: 'list' })
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
        body: JSON.stringify({ downloadedViewMode: 'grid' })
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
        body: JSON.stringify({ downloadedViewMode: 'list' })
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

// === Kanal Dropdown İçi Arama ve Temizleme ===
function filterCustomChannelOptions(type, query) {
  const panel = document.getElementById(`${type}-channel-items-list`);
  const input = document.getElementById(`${type}-channel-search-input`);
  const clearBtn = input ? input.parentElement.querySelector('.custom-dropdown-search-clear') : null;
  if (clearBtn) clearBtn.style.display = query ? 'block' : 'none';
  if (!panel) return;
  const q = (query || '').toLowerCase().trim();
  const items = panel.querySelectorAll('.custom-dropdown-item');
  const dividers = panel.querySelectorAll('.custom-dropdown-divider');
  let visibleCount = 0;
  items.forEach(item => {
    const text = item.textContent.toLowerCase();
    const match = !q || text.includes(q);
    item.style.display = match ? 'flex' : 'none';
    if (match) visibleCount++;
  });
  dividers.forEach(d => {
    d.style.display = q ? 'none' : 'block';
  });
  let noRes = panel.querySelector('.custom-dropdown-no-results');
  if (visibleCount === 0) {
    if (!noRes) {
      noRes = document.createElement('div');
      noRes.className = 'custom-dropdown-no-results';
      noRes.style.cssText = 'padding: 14px; text-align: center; color: var(--text-muted); font-size: 0.8rem;';
      const lang = localDb?.settings?.lang || currentLang || 'tr';
      const t = translations[lang] || translations.tr;
      noRes.textContent = t.channel_search_empty || 'Sonuç bulunamadı';
      panel.appendChild(noRes);
    }
    noRes.style.display = 'block';
  } else if (noRes) {
    noRes.style.display = 'none';
  }
}
window.filterCustomChannelOptions = filterCustomChannelOptions;

function clearCustomChannelSearch(type, event) {
  if (event) {
    event.stopPropagation();
    event.preventDefault();
  }
  const input = document.getElementById(`${type}-channel-search-input`);
  if (input) {
    input.value = '';
    filterCustomChannelOptions(type, '');
    input.focus();
  }
}
window.clearCustomChannelSearch = clearCustomChannelSearch;

// === Video Başlığına Göre Anlık Arama ===
let downloadedSearchDebounceTimer = null;
function onDownloadedSearchInput(val) {
  const clearBtn = document.getElementById('downloaded-search-clear-btn');
  if (clearBtn) clearBtn.classList.toggle('hidden', !val);
  window.downloadedSearchQuery = val;
  if (typeof saveDownloadedFilterState === 'function') saveDownloadedFilterState();
  clearTimeout(downloadedSearchDebounceTimer);
  downloadedSearchDebounceTimer = setTimeout(() => {
    if (typeof updateUI === 'function') updateUI(localDb);
    if (typeof currentPlayingVideoId !== 'undefined' && currentPlayingVideoId && typeof renderDownloadedPlaylist === 'function') {
      renderDownloadedPlaylist(currentPlayingVideoId);
    }
  }, 180);
}
window.onDownloadedSearchInput = onDownloadedSearchInput;

function clearDownloadedSearch() {
  const input = document.getElementById('downloaded-search-input');
  if (input) {
    input.value = '';
    onDownloadedSearchInput('');
    input.focus();
  }
}
window.clearDownloadedSearch = clearDownloadedSearch;

// === Kompakt Sıralama Yönetimi (Tarih / Boyut Tekil Toggle) ===
function cycleDownloadedDateSort(event) {
  if (event) event.stopPropagation();
  let newSort = 'date-desc';
  if (window.downloadedSortVal === 'date-desc') {
    newSort = 'date-asc';
  } else if (window.downloadedSortVal === 'date-asc') {
    newSort = 'date-desc';
  }
  applyDownloadedSort(newSort);
}
window.cycleDownloadedDateSort = cycleDownloadedDateSort;

function cycleDownloadedSizeSort(event) {
  if (event) event.stopPropagation();
  let newSort = 'size-desc';
  if (window.downloadedSortVal === 'size-desc') {
    newSort = 'size-asc';
  } else if (window.downloadedSortVal === 'size-asc') {
    newSort = 'size-desc';
  }
  applyDownloadedSort(newSort);
}
window.cycleDownloadedSizeSort = cycleDownloadedSizeSort;

function applyDownloadedSort(sortVal) {
  downloadedSortVal = sortVal;
  window.downloadedSortVal = sortVal;
  localStorage.setItem('downloaded-sort-val', sortVal);
  // İlk kez 'user' sıralamasına geçildiğinde henüz kayıtlı sıra yoksa mevcut görünür sırayı başlangıç olarak kaydet
  if (sortVal === 'user') {
    const existingOrder = getDownloadedUserOrder(localDb);
    if (!existingOrder || existingOrder.length === 0) {
      const domCards = Array.from(document.querySelectorAll('#downloaded-playlist-grid .playlist-item, #downloaded-grid .video-card'));
      const initialIds = domCards.map(el => el.getAttribute('data-id')).filter(Boolean);
      if (initialIds.length > 0) {
        saveDownloadedUserOrder(initialIds, localDb);
      }
    }
  }
  if (typeof saveDownloadedFilterState === 'function') saveDownloadedFilterState();
  if (typeof persistDownloadedSortMode === 'function') persistDownloadedSortMode();
  syncDownloadedSortButtons(sortVal);
  if (typeof updateSidebarSortButtons === 'function') updateSidebarSortButtons();
  if (typeof updateUI === 'function') updateUI(localDb);
  if (currentPlayingVideoId && typeof renderDownloadedPlaylist === 'function') {
    renderDownloadedPlaylist(currentPlayingVideoId);
  }
}
window.applyDownloadedSort = applyDownloadedSort;

function syncDownloadedSortButtons(sortVal) {
  const curSort = sortVal || window.downloadedSortVal || 'date-desc';
  const group = document.getElementById('downloaded-sort-group');
  if (!group) return;

  const lang = localDb?.settings?.lang || currentLang || 'tr';
  const t = translations[lang] || translations.tr;

  const dateBtn = document.getElementById('sort-btn-date');
  const dateLabel = document.getElementById('sort-btn-date-label');
  const sizeBtn = document.getElementById('sort-btn-size');
  const sizeLabel = document.getElementById('sort-btn-size-label');
  const autoBtn = document.getElementById('sort-btn-auto-delete');
  const userBtn = document.getElementById('sort-btn-user');

  const isDate = curSort.startsWith('date-');
  const isSize = curSort.startsWith('size-');
  const isAuto = curSort === 'auto-delete';
  const isUser = curSort === 'user';

  if (dateBtn) {
    dateBtn.classList.toggle('active', isDate);
    if (dateLabel) {
      if (curSort === 'date-asc') {
        dateLabel.textContent = t.sort_btn_date_asc || 'Tarih ▲';
      } else if (curSort === 'date-desc') {
        dateLabel.textContent = t.sort_btn_date_desc || 'Tarih ▼';
      } else {
        dateLabel.textContent = t.sort_btn_date_toggle || 'Tarih ↕';
      }
    }
  }

  if (sizeBtn) {
    sizeBtn.classList.toggle('active', isSize);
    if (sizeLabel) {
      if (curSort === 'size-asc') {
        sizeLabel.textContent = t.sort_btn_size_asc || 'Boyut ▲';
      } else if (curSort === 'size-desc') {
        sizeLabel.textContent = t.sort_btn_size_desc || 'Boyut ▼';
      } else {
        sizeLabel.textContent = t.sort_btn_size_toggle || 'Boyut ↕';
      }
    }
  }

  if (autoBtn) autoBtn.classList.toggle('active', isAuto);
  if (userBtn) userBtn.classList.toggle('active', isUser);

  if (typeof document !== 'undefined') {
    document.body.classList.toggle('sort-auto-delete-active', isAuto);
    const dlGrid = document.getElementById('downloaded-grid');
    if (dlGrid) dlGrid.classList.toggle('sort-auto-delete-active', isAuto);
  }

  group.querySelectorAll('.sort-btn[data-sort]').forEach(b => {
    b.classList.toggle('active', b.getAttribute('data-sort') === curSort);
  });
}
window.syncDownloadedSortButtons = syncDownloadedSortButtons;

// === Tekil Görünüm Modu Butonu (Kartlar <-> Sade Liste) ===
function updateDownloadedViewButtonUI() {
  const btn = document.getElementById('downloaded-view-toggle-btn');
  const icon = document.getElementById('downloaded-view-toggle-icon');
  const text = document.getElementById('downloaded-view-toggle-text');
  const lang = localDb?.settings?.lang || currentLang || 'tr';
  const t = translations[lang] || translations.tr;

  const isGrid = (window.downloadedViewMode !== 'list');
  if (btn) {
    btn.title = isGrid 
      ? (t.view_mode_toggle_to_list || 'Sade Liste Görünümüne Geç') 
      : (t.view_mode_toggle_to_grid || 'Kart Görünümüne Geç');
  }
  if (icon) {
    icon.setAttribute('data-lucide', isGrid ? 'layout-grid' : 'list');
  }
  if (text) {
    text.textContent = isGrid ? (t.view_grid || 'Kartlar') : (t.view_list || 'Sade Liste');
  }
  try { if (typeof lucide !== 'undefined') lucide.createIcons(); } catch (e) {}

  const gridBtn = document.getElementById('downloaded-view-grid-btn');
  const listBtn = document.getElementById('downloaded-view-list-btn');
  if (gridBtn) gridBtn.classList.toggle('active', isGrid);
  if (listBtn) listBtn.classList.toggle('active', !isGrid);
}
window.updateDownloadedViewButtonUI = updateDownloadedViewButtonUI;

function toggleDownloadedViewMode() {
  const newMode = (window.downloadedViewMode === 'list') ? 'grid' : 'list';
  window.downloadedViewMode = newMode;
  if (typeof downloadedViewMode !== 'undefined') downloadedViewMode = newMode;
  if (typeof saveDownloadedFilterState === 'function') saveDownloadedFilterState();
  if (localDb.settings) {
    localDb.settings.downloadedViewMode = newMode;
    fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ downloadedViewMode: newMode })
    }).catch(() => {});
  }
  updateDownloadedViewButtonUI();
  if (typeof updateUI === 'function') updateUI(localDb);
}
window.toggleDownloadedViewMode = toggleDownloadedViewMode;

function toggleDownloadedShortsChip() {
  const cb = document.getElementById('downloaded-show-shorts');
  const currentVal = localDb?.settings?.showShorts !== false;
  if (typeof toggleDownloadedShowShorts === 'function') {
    toggleDownloadedShowShorts(!currentVal);
  }
}
window.toggleDownloadedShortsChip = toggleDownloadedShortsChip;


// Sıralama Butonları Dinleyicisi
let downloadedSortVal = localStorage.getItem('downloaded-sort-val') || 'date-desc';
if (downloadedSortVal === 'auto-delete') {
  downloadedSortVal = 'date-desc';
  localStorage.setItem('downloaded-sort-val', 'date-desc');
}
window.downloadedSortVal = downloadedSortVal;

// Türkçe Açıklama: İndirilenler sıralama tercihini db.settings + configwin.ini'ye kalıcı kaydeder.
function persistDownloadedSortMode() {
  if (localDb.settings) {
    localDb.settings.downloadedSortMode = downloadedSortVal;
    fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ downloadedSortMode: downloadedSortVal })
    }).catch(() => {});
  }
}

document.addEventListener('click', (e) => {
  const btn = e.target.closest('.sort-btn');
  if (btn && btn.closest('#downloaded-sort-group')) {
    const sortVal = btn.getAttribute('data-sort');
    if (sortVal === 'auto-delete') {
      const nextSort = (downloadedSortVal === 'auto-delete') ? 'date-desc' : 'auto-delete';
      applyDownloadedSort(nextSort);
    } else if (sortVal) {
      applyDownloadedSort(sortVal);
    }
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

  const historyShowLiveCheck = document.getElementById('history-show-live');
  if (historyShowLiveCheck) {
    historyShowLiveCheck.addEventListener('change', () => {
      window.historyShowLive = historyShowLiveCheck.checked;
      if (localDb && localDb.settings) localDb.settings.historyShowLive = historyShowLiveCheck.checked;
      syncFilterChipUI('history-show-live');
      saveHistoryFilterState();
      updateUI(localDb);
    });
  }

  const historyShowUpcomingCheck = document.getElementById('history-show-upcoming');
  if (historyShowUpcomingCheck) {
    historyShowUpcomingCheck.addEventListener('change', () => {
      window.historyShowUpcoming = historyShowUpcomingCheck.checked;
      if (localDb && localDb.settings) localDb.settings.historyShowUpcoming = historyShowUpcomingCheck.checked;
      syncFilterChipUI('history-show-upcoming');
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

  // Playlist Sidebar Sıralama Butonları Dinleyicileri (applyDownloadedSort ile ana listeyle %100 senkron)
  const btnSortDate = document.getElementById('inline-btn-sort-date');
  if (btnSortDate) {
    btnSortDate.addEventListener('click', () => {
      const nextSort = downloadedSortVal === 'date-desc' ? 'date-asc' : 'date-desc';
      applyDownloadedSort(nextSort);
    });
  }

  const btnSortSize = document.getElementById('inline-btn-sort-size');
  if (btnSortSize) {
    btnSortSize.addEventListener('click', () => {
      const nextSort = downloadedSortVal === 'size-desc' ? 'size-asc' : 'size-desc';
      applyDownloadedSort(nextSort);
    });
  }

  const btnSortUser = document.getElementById('inline-btn-sort-user');
  if (btnSortUser) {
    btnSortUser.addEventListener('click', () => {
      applyDownloadedSort('user');
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
checkTempSpace();
updateWeatherBadge();
loadAppVersion();
checkApplicationUpdates();
setInterval(updateDiskSpace, 60 * 60 * 1000); // Her 60 dakikada bir güncelle
setInterval(() => updateWeatherBadge(), 15 * 60 * 1000); // Her 15 dakikada bir hava durumunu güncelle

// Türkçe Açıklama: Sayfa yüklendiğinde mevcut URL path'ine göre doğru sekmeyi ve Araçlar alt sayfasını aktif ediyoruz.
const currentPath = window.location.pathname;
const initialLocation = parseAppLocation(currentPath);
const initialTab = initialLocation.tab;
if (initialLocation.toolsSub) {
  window.currentToolsSubSection = initialLocation.toolsSub;
}
const initialUrlPath = currentPath === '/' ? '/home' : (currentPath === '/tools' ? '/tools/compare' : currentPath);
history.replaceState({ tab: initialTab, toolsSub: initialLocation.toolsSub || undefined }, '', initialUrlPath);
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

// Initial icons trigger (yalnızca üst bar ve aktif sekme; gizli sekmeler açıldıkça çizilir)
if (typeof lucide !== 'undefined' && typeof lucide.createIcons === 'function') {
  try {
    const topbarEl = document.querySelector('.topbar');
    const activeTabEl = document.querySelector('.tab-content.active');
    if (topbarEl) lucide.createIcons({ root: topbarEl });
    if (activeTabEl) lucide.createIcons({ root: activeTabEl });
  } catch (e) {}
}

let _autoplayTransitionLock = false;

function playNextVideoInPlaylist() {
  if (!currentPlayingVideoId || _autoplayTransitionLock) return;
  _autoplayTransitionLock = true;
  setTimeout(() => { _autoplayTransitionLock = false; }, 1200);

  const langKey = localDb?.settings?.lang || currentLang || 'tr';
  const t = translations[langKey] || translations.tr || {};

  // 1. Öncelik: Yan listede (#downloaded-playlist-grid) kullanıcının gördüğü birebir sıra
  const sidebarItems = Array.from(document.querySelectorAll('#downloaded-playlist-grid .playlist-item[data-id]'));
  const sidebarIds = sidebarItems.map(el => el.getAttribute('data-id')).filter(Boolean);
  let nextVideoId = null;

  if (sidebarIds.length > 0) {
    const domIdx = sidebarIds.indexOf(currentPlayingVideoId);
    if (domIdx !== -1) {
      if (domIdx + 1 < sidebarIds.length) {
        nextVideoId = sidebarIds[domIdx + 1];
      } else {
        // Yan listenin son video öğesine ulaşıldı
        showToast(t.autoplay_playlist_finished || (langKey === 'en' ? 'Playlist finished.' : 'Çalma listesi tamamlandı.'), 'info');
        return;
      }
    }
  }

  // 2. Yedek: Yan listede bulunamadıysa filtrelenmiş + sıralanmış veri listesinden bul
  if (!nextVideoId) {
    let filteredDownloaded = (localDb.history || []).filter(item => item.status === 'completed');
    if (typeof applyDownloadedChannelAndCategoryFilter === 'function') {
      filteredDownloaded = applyDownloadedChannelAndCategoryFilter(filteredDownloaded, localDb);
    } else if (downloadedFilterChannel !== 'all') {
      if (downloadedFilterChannel.startsWith('category:')) {
        const catId = parseInt(downloadedFilterChannel.split(':')[1], 10);
        const channelIdsInCat = (localDb.channels || []).filter(c => (c.categoryIds || [c.categoryId || 1]).includes(catId)).map(c => c.id);
        const channelIdsInCatSet = new Set(channelIdsInCat);
        filteredDownloaded = filteredDownloaded.filter(item => channelIdsInCatSet.has(item.channelId));
      } else if (downloadedFilterChannel.startsWith('platform:')) {
        const targetPlat = downloadedFilterChannel.split(':')[1];
        filteredDownloaded = filteredDownloaded.filter(item => {
          const p = item.platform || (typeof detectVideoPlatform === 'function' ? detectVideoPlatform(item) : 'youtube');
          return p === targetPlat;
        });
      } else {
        filteredDownloaded = filteredDownloaded.filter(item => item.channelId === downloadedFilterChannel);
      }
    }
    const showShorts = localDb.settings?.showShorts !== false;
    if (!showShorts) {
      filteredDownloaded = filteredDownloaded.filter(item => !isShortVideo(item.duration, item.title, item.channelId, item));
    }
    const dlNextSearch = ((document.getElementById('downloaded-search-input')?.value || window.downloadedSearchQuery) || '').trim().toLowerCase();
    if (dlNextSearch) {
      filteredDownloaded = filteredDownloaded.filter(item => {
        const title = (item.title || '').toLowerCase();
        const chName = (item.channelName || '').toLowerCase();
        return title.includes(dlNextSearch) || chName.includes(dlNextSearch);
      });
    }
    const sortVal = downloadedSortVal || window.downloadedSortVal || 'date-desc';
    sortDownloadedItems(filteredDownloaded, sortVal, localDb);

    let currentIndex = filteredDownloaded.findIndex(item => item.id === currentPlayingVideoId);
    if (currentIndex === -1) {
      // Aktif filtre mevcut videoyu gizlediyse tüm tamamlanmış videoların sıralı listesinden devam et
      const allCompleted = (localDb.history || []).filter(item => item.status === 'completed');
      sortDownloadedItems(allCompleted, sortVal, localDb);
      const fullIdx = allCompleted.findIndex(item => item.id === currentPlayingVideoId);
      if (fullIdx !== -1 && fullIdx + 1 < allCompleted.length) {
        nextVideoId = allCompleted[fullIdx + 1].id;
      }
    } else if (currentIndex + 1 < filteredDownloaded.length) {
      nextVideoId = filteredDownloaded[currentIndex + 1].id;
    }
  }

  if (nextVideoId) {
    playVideoEmbedded(nextVideoId, 0, false);
  } else {
    showToast(t.autoplay_playlist_finished || (langKey === 'en' ? 'Playlist finished.' : 'Çalma listesi tamamlandı.'), 'info');
  }
}
window.playNextVideoInPlaylist = playNextVideoInPlaylist;

function initDragAndDrop() {
  setupSortableContainer(document.getElementById('downloaded-grid'), '.video-card', 'downloaded-user-order');
  setupSortableContainer(document.getElementById('downloaded-playlist-grid'), '.playlist-item', 'downloaded-user-order');
}

function setupSortableContainer(container, itemSelector, storageKey) {
  if (!container) return;
  let draggingElement = null;

  container.addEventListener('dragstart', (e) => {
    const curSort = (typeof downloadedSortVal !== 'undefined' && downloadedSortVal) || window.downloadedSortVal;
    if (curSort !== 'user') return;
    const item = e.target.closest(itemSelector);
    if (!item) return;
    draggingElement = item;
    window._justDraggedSortable = true;
    item.classList.add('dragging');
    try {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', item.getAttribute('data-id') || '');
    } catch (_) {}
  });

  container.addEventListener('dragover', (e) => {
    const curSort = (typeof downloadedSortVal !== 'undefined' && downloadedSortVal) || window.downloadedSortVal;
    if (curSort !== 'user' || !draggingElement) return;
    e.preventDefault();
    try { e.dataTransfer.dropEffect = 'move'; } catch (_) {}
    const target = e.target.closest(itemSelector);
    if (!target || target === draggingElement) return;

    const rect = target.getBoundingClientRect();
    const isVerticalList = container.id === 'downloaded-playlist-grid' || container.classList.contains('compact-list');
    const next = isVerticalList
      ? (e.clientY - rect.top) / Math.max(1, rect.bottom - rect.top) > 0.5
      : ((e.clientY - rect.top) / Math.max(1, rect.bottom - rect.top) > 0.5 || (e.clientX - rect.left) / Math.max(1, rect.right - rect.left) > 0.5);

    if (next) {
      target.after(draggingElement);
    } else {
      target.before(draggingElement);
    }
  });

  container.addEventListener('drop', (e) => {
    const curSort = (typeof downloadedSortVal !== 'undefined' && downloadedSortVal) || window.downloadedSortVal;
    if (curSort !== 'user' || !draggingElement) return;
    e.preventDefault();
  });

  container.addEventListener('dragend', () => {
    if (draggingElement) {
      draggingElement.classList.remove('dragging');
      draggingElement = null;
    }
    setTimeout(() => { window._justDraggedSortable = false; }, 250);

    const curSort = (typeof downloadedSortVal !== 'undefined' && downloadedSortVal) || window.downloadedSortVal;
    if (curSort !== 'user') return;

    const items = Array.from(container.querySelectorAll(itemSelector));
    const newOrder = items.map(el => el.getAttribute('data-id')).filter(Boolean);
    saveDownloadedUserOrder(newOrder, localDb);

    updateUI(localDb);
    if (currentPlayingVideoId && typeof renderDownloadedPlaylist === 'function') {
      renderDownloadedPlaylist(currentPlayingVideoId);
    }
  });
}


// Araçlar, dosya karşılaştırma ve indirme UI fonksiyonları artık doğrudan './modules/tools.js' modülü üzerinden yönetilmektedir.

// Toplu işlem ve modallar (Bulk Hide / Bulk Delete) ./modules/bulkOperations.js modülünden yönetilmektedir.

// [downloaderUI.js modülüne taşındı: handleDownloaderStart, handleDownloaderAll, renderPlaylistResults, downloadMissingVideo]

// [backupManager.js modülüne taşındı: loadSystemBackupsList, downloadSystemBackup,
//  deleteSystemBackup, triggerUploadBackupFile, uploadBackupFile, restoreSystemBackup]
// [ytdlpManager.js modülüne taşındı: fetchYtdlpVersion, updateYtdlp]

// Sayfa yüklendiğinde yt-dlp sürümünü, dinleyicilerini ve Gist alanlarını otomatik sorgula
document.addEventListener('DOMContentLoaded', () => {
  fetchYtdlpVersion();
  fetch('/api/merge-queue/status').then(r => r.json()).then(d => { if (d && d.success) updateMergeQueueState(d); }).catch(() => {});
  initYtdlpEvents();
  setTimeout(() => {
    if (window._settingsFormPopulated) {
      populateGistFields();
    }

    if (window._settingsFormPopulated && typeof updateFakapSettingsControls === 'function' && localDb?.settings) {
      updateFakapSettingsControls({
        enabled: localDb.settings.fakapEnabled,
        dir: localDb.settings.fakapPath,
        quality: localDb.settings.fakapQuality,
        retentionDays: localDb.settings.fakapRetentionDays
      });
    }
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
  if (typeof initTheaterMode === 'function') initTheaterMode();
  if (typeof initContextMenu === 'function') initContextMenu();
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
    if (typeof parseDownloadedFilterString === 'function') {
      window.downloadedFilterState = parseDownloadedFilterString(channelId);
    }
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
      // Menü ilk kez açıldığında 137 kanalın avatarlarını talep üzerine (lazy) yükle
      menu.querySelectorAll('img[data-avatar-src]').forEach(img => {
        const realSrc = img.getAttribute('data-avatar-src');
        if (realSrc) {
          img.src = realSrc;
          img.removeAttribute('data-avatar-src');
        }
      });
      const rect = trigger.getBoundingClientRect();
      menu.style.position = 'fixed';
      menu.style.top = `${Math.min(rect.bottom + 6, window.innerHeight - 40)}px`;
      menu.style.left = `${Math.max(8, Math.min(rect.left, window.innerWidth - 280))}px`;
      menu.style.maxHeight = `${Math.min(360, window.innerHeight - 60)}px`;
      setTimeout(() => {
        const searchInput = document.getElementById(`${type}-channel-search-input`);
        if (searchInput) {
          searchInput.value = '';
          if (typeof filterCustomChannelOptions === 'function') filterCustomChannelOptions(type, '');
          searchInput.focus();
        }
      }, 50);
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
    window.downloadedFilterState = parseDownloadedFilterString(safeVal);
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

// === İndirilenler Çoklu Seçim & Hariç Tutma Filtre Mantığı ===
function parseDownloadedFilterString(str) {
  const defaultState = { mode: 'include', categories: [], channels: [], platform: 'all' };
  if (!str || typeof str !== 'string' || str.trim() === '' || str === 'all') {
    return defaultState;
  }
  const s = str.trim();
  if (s.startsWith('{') && s.endsWith('}')) {
    try {
      const parsed = JSON.parse(s);
      return {
        mode: parsed.mode === 'exclude' ? 'exclude' : 'include',
        categories: Array.isArray(parsed.categories) ? parsed.categories.map(Number).filter(n => !isNaN(n)) : [],
        channels: Array.isArray(parsed.channels) ? parsed.channels : [],
        platform: parsed.platform || 'all'
      };
    } catch (e) {}
  }
  let mode = 'include';
  let body = s;
  if (body.startsWith('exclude:')) {
    mode = 'exclude';
    body = body.slice('exclude:'.length);
  } else if (body.startsWith('include:')) {
    mode = 'include';
    body = body.slice('include:'.length);
  }

  const res = { mode, categories: [], channels: [], platform: 'all' };

  if (body.startsWith('category:')) {
    const cid = parseInt(body.split(':')[1], 10);
    if (!isNaN(cid)) res.categories.push(cid);
    return res;
  }
  if (body.startsWith('platform:')) {
    res.platform = body.split(':')[1] || 'all';
    return res;
  }

  const parts = body.split(';');
  parts.forEach(part => {
    const p = part.trim();
    if (p.startsWith('cats:')) {
      const cids = p.slice('cats:'.length).split(',').map(x => parseInt(x.trim(), 10)).filter(n => !isNaN(n));
      res.categories.push(...cids);
    } else if (p.startsWith('chans:')) {
      const chans = p.slice('chans:'.length).split(',').map(x => x.trim()).filter(Boolean);
      res.channels.push(...chans);
    } else if (p.startsWith('plat:')) {
      res.platform = p.slice('plat:'.length).trim() || 'all';
    } else if (p && p !== 'all') {
      res.channels.push(p);
    }
  });

  return res;
}
window.parseDownloadedFilterString = parseDownloadedFilterString;

function serializeDownloadedFilterState(state) {
  if (!state) return 'all';
  const hasCats = Array.isArray(state.categories) && state.categories.length > 0;
  const hasChans = Array.isArray(state.channels) && state.channels.length > 0;
  const hasPlat = state.platform && state.platform !== 'all';

  if (!hasCats && !hasChans && !hasPlat) return 'all';

  if (state.mode === 'include') {
    if (hasCats && !hasChans && !hasPlat && state.categories.length === 1) {
      return `category:${state.categories[0]}`;
    }
    if (hasPlat && !hasCats && !hasChans) {
      return `platform:${state.platform}`;
    }
    if (hasChans && !hasCats && !hasPlat && state.channels.length === 1) {
      return state.channels[0];
    }
  }

  const parts = [];
  if (hasCats) parts.push('cats:' + state.categories.join(','));
  if (hasChans) parts.push('chans:' + state.channels.join(','));
  if (hasPlat) parts.push('plat:' + state.platform);

  return `${state.mode}:${parts.join(';')}`;
}
window.serializeDownloadedFilterState = serializeDownloadedFilterState;

function getDownloadedFilterState() {
  if (!window.downloadedFilterState) {
    window.downloadedFilterState = parseDownloadedFilterString(window.downloadedFilterChannel || 'all');
  }
  return window.downloadedFilterState;
}
window.getDownloadedFilterState = getDownloadedFilterState;

function applyDownloadedChannelAndCategoryFilter(items, db) {
  if (!items || !items.length) return [];
  const state = getDownloadedFilterState();
  const hasCats = Array.isArray(state.categories) && state.categories.length > 0;
  const hasChans = Array.isArray(state.channels) && state.channels.length > 0;
  const hasPlat = state.platform && state.platform !== 'all';

  if (!hasCats && !hasChans && !hasPlat) {
    return items;
  }

  const channelsList = (db && db.channels) || (window.localDb && window.localDb.channels) || [];
  const channelCatMap = new Map();
  channelsList.forEach(c => {
    if (c && c.id) {
      const cids = (Array.isArray(c.categoryIds) && c.categoryIds.length) ? c.categoryIds : [c.categoryId || 1];
      channelCatMap.set(c.id, new Set(cids));
    }
  });

  const chanSet = new Set(state.channels);

  if (state.mode === 'exclude') {
    return items.filter(item => {
      if (!item) return false;
      if (hasPlat) {
        const p = item.platform || (typeof detectVideoPlatform === 'function' ? detectVideoPlatform(item) : 'youtube');
        if (p === state.platform) return false;
      }
      if (hasChans && chanSet.has(item.channelId)) {
        return false;
      }
      if (hasCats) {
        const itemCatSet = channelCatMap.get(item.channelId);
        if (itemCatSet) {
          for (const cid of state.categories) {
            if (itemCatSet.has(cid)) return false;
          }
        }
      }
      return true;
    });
  } else {
    return items.filter(item => {
      if (!item) return false;
      if (hasPlat) {
        const p = item.platform || (typeof detectVideoPlatform === 'function' ? detectVideoPlatform(item) : 'youtube');
        if (p !== state.platform) return false;
      }
      let match = false;
      if (hasChans && chanSet.has(item.channelId)) {
        match = true;
      }
      if (!match && hasCats) {
        const itemCatSet = channelCatMap.get(item.channelId);
        if (itemCatSet) {
          for (const cid of state.categories) {
            if (itemCatSet.has(cid)) {
              match = true;
              break;
            }
          }
        }
      }
      if (!hasCats && !hasChans && hasPlat) {
        match = true;
      }
      return match;
    });
  }
}
window.applyDownloadedChannelAndCategoryFilter = applyDownloadedChannelAndCategoryFilter;

function setDownloadedFilterMode(mode, event) {
  if (event) event.stopPropagation();
  const state = getDownloadedFilterState();
  state.mode = mode === 'exclude' ? 'exclude' : 'include';
  commitDownloadedFilterState();
}
window.setDownloadedFilterMode = setDownloadedFilterMode;

function toggleDownloadedFilterCategory(catId, event) {
  if (event) event.stopPropagation();
  const state = getDownloadedFilterState();
  const numId = parseInt(catId, 10);
  const idx = state.categories.indexOf(numId);
  if (idx > -1) {
    state.categories.splice(idx, 1);
  } else {
    state.categories.push(numId);
  }
  commitDownloadedFilterState();
}
window.toggleDownloadedFilterCategory = toggleDownloadedFilterCategory;

function toggleDownloadedCategoryPill(catId, event) {
  if (event) event.stopPropagation();
  toggleDownloadedFilterCategory(catId, event);
}
window.toggleDownloadedCategoryPill = toggleDownloadedCategoryPill;

function toggleDownloadedFilterChannelOption(channelId, event) {
  if (event) event.stopPropagation();
  const state = getDownloadedFilterState();
  const idx = state.channels.indexOf(channelId);
  if (idx > -1) {
    state.channels.splice(idx, 1);
  } else {
    state.channels.push(channelId);
  }
  commitDownloadedFilterState();
}
window.toggleDownloadedFilterChannelOption = toggleDownloadedFilterChannelOption;

function toggleDownloadedFilterPlatform(platformId, event) {
  if (event) event.stopPropagation();
  const state = getDownloadedFilterState();
  if (state.platform === platformId) {
    state.platform = 'all';
  } else {
    state.platform = platformId;
  }
  commitDownloadedFilterState();
}
window.toggleDownloadedFilterPlatform = toggleDownloadedFilterPlatform;

function commitDownloadedFilterState() {
  const state = getDownloadedFilterState();
  const serialized = serializeDownloadedFilterState(state);
  downloadedFilterChannel = serialized;
  window.downloadedFilterChannel = serialized;
  
  const selectEl = document.getElementById('downloaded-channel-filter');
  if (selectEl) {
    selectEl.value = serialized;
  }

  if (typeof saveDownloadedFilterState === 'function') {
    saveDownloadedFilterState();
  }

  // Dropdown menü açık ise açık tut ve kaydırma pozisyonunu koru
  const dropdown = document.getElementById('downloaded-custom-dropdown');
  const wasOpen = dropdown ? dropdown.classList.contains('open') : false;
  const itemsList = document.getElementById('downloaded-channel-items-list');
  const scrollTop = itemsList ? itemsList.scrollTop : 0;

  populateChannelFilters(localDb);
  
  if (wasOpen && dropdown) {
    dropdown.classList.add('open');
    const newItemsList = document.getElementById('downloaded-channel-items-list');
    if (newItemsList) newItemsList.scrollTop = scrollTop;
  }

  if (typeof updateUI === 'function') {
    updateUI(localDb);
  }
}
window.commitDownloadedFilterState = commitDownloadedFilterState;

function populateChannelFilters(db) {
  const targetDb = db || localDb || {};
  const channels = targetDb.channels || [];
  const categories = targetDb.categories || [];
  const lang = localDb.settings?.lang || currentLang || 'tr';
  const t = translations[lang] || translations.tr || {};

  const isHistoryTabActive = !!document.getElementById('tab-history')?.classList.contains('active');
  const isDownloadedTabActive = !!document.getElementById('tab-downloaded')?.classList.contains('active');
  const typesToPopulate = [];
  if (isHistoryTabActive) typesToPopulate.push('history');
  if (isDownloadedTabActive) typesToPopulate.push('downloaded');

  typesToPopulate.forEach(type => {
    const panel = document.getElementById(`${type}-channel-options-panel`);
    const triggerContent = document.getElementById(`${type}-channel-trigger-content`);
    const selectEl = document.getElementById(`${type}-channel-filter`);
    if (!panel) return;

    let currentValue = (type === 'history' ? historyFilterChannel : downloadedFilterChannel) || (selectEl ? selectEl.value : 'all');
    if (!currentValue || currentValue.trim() === '') currentValue = 'all';

    const searchPlaceholder = t.search_channel_placeholder || 'Kanal veya kategori ara...';

    let modeTabsHtml = '';
    const state = (type === 'downloaded' && typeof getDownloadedFilterState === 'function')
      ? getDownloadedFilterState()
      : { mode: 'include', categories: [], channels: [], platform: 'all' };

    if (type === 'downloaded') {
      const isInc = state.mode !== 'exclude';
      modeTabsHtml = `
        <div class="custom-dropdown-mode-tabs">
          <button type="button" class="custom-dropdown-mode-btn ${isInc ? 'active' : ''}" data-mode="include" onclick="setDownloadedFilterMode('include', event)">
            <i data-lucide="check" style="width:12px;height:12px;"></i>
            <span>${escapeHtml(t.filter_mode_include || 'Dahil Et')}</span>
          </button>
          <button type="button" class="custom-dropdown-mode-btn ${!isInc ? 'active' : ''}" data-mode="exclude" onclick="setDownloadedFilterMode('exclude', event)">
            <i data-lucide="ban" style="width:12px;height:12px;"></i>
            <span>${escapeHtml(t.filter_mode_exclude || 'Hariç Tut')}</span>
          </button>
        </div>
      `;
    }

    const headerHtml = `
      ${modeTabsHtml}
      <div class="custom-dropdown-search-wrap">
        <div style="position:relative; display:flex; align-items:center;">
          <i data-lucide="search" style="position:absolute; left:8px; width:13px; height:13px; color:var(--text-muted); pointer-events:none;"></i>
          <input type="text" class="custom-dropdown-search-input" id="${type}-channel-search-input" placeholder="${escapeHtml(searchPlaceholder)}" oninput="filterCustomChannelOptions('${type}', this.value)" onclick="event.stopPropagation()">
          <span class="custom-dropdown-search-clear" onclick="clearCustomChannelSearch('${type}', event)" style="position:absolute; right:8px; font-size:12px; color:var(--text-muted); cursor:pointer; display:none;">✕</span>
        </div>
      </div>
      <div class="custom-dropdown-items-list" id="${type}-channel-items-list">
    `;
    let html = '';
    let selectOptionsHtml = `<option value="all">${escapeHtml(t.filter_all_channels || 'Tüm Kanallar')}</option>`;
    let activeTriggerHtml = `<i data-lucide="globe" style="width:14px;height:14px;color:var(--accent-color);"></i><span>${escapeHtml(t.filter_all_channels || 'Tüm Kanallar')}</span>`;

    // 1. Tüm Kanallar
    const allText = t.filter_all_channels || 'Tüm Kanallar';
    const allIcon = `<i data-lucide="globe" style="width:16px;height:16px;color:var(--accent-color);"></i>`;

    if (type === 'downloaded') {
      const isAllActive = state.categories.length === 0 && state.channels.length === 0 && (!state.platform || state.platform === 'all');
      if (isAllActive) {
        activeTriggerHtml = `${allIcon}<span>${escapeHtml(allText)}</span>`;
      } else if (state.mode === 'exclude') {
        const excCount = state.categories.length + state.channels.length + (state.platform !== 'all' ? 1 : 0);
        const excText = (t.filter_excluded_count || '{count} Hariç').replace('{count}', excCount);
        activeTriggerHtml = `<i data-lucide="ban" style="width:14px;height:14px;color:#ef4444;"></i><span style="color:#ef4444;font-weight:600;">${escapeHtml(excText)}</span>`;
      } else {
        const totalCount = state.categories.length + state.channels.length + (state.platform !== 'all' ? 1 : 0);
        if (totalCount === 1) {
          if (state.categories.length === 1) {
            const foundCat = categories.find(c => c && c.id === state.categories[0]);
            const catName = foundCat ? getCatTranslatedName(foundCat, t) : 'Kategori';
            activeTriggerHtml = `<i data-lucide="folder" style="width:14px;height:14px;color:var(--accent-color);"></i><span>${escapeHtml(catName)}</span>`;
          } else if (state.channels.length === 1) {
            const foundChan = channels.find(c => c && c.id === state.channels[0]);
            const chanName = foundChan ? foundChan.name : 'Kanal';
            const avatarUrl = `/api/channels/${state.channels[0]}/avatar`;
            activeTriggerHtml = `<img src="${avatarUrl}" class="custom-dropdown-avatar" onerror="this.src='/logo.png'"><span>${escapeHtml(chanName)}</span>`;
          } else if (state.platform !== 'all') {
            const platSvg = (typeof getPlatformSvgIcon === 'function')
              ? getPlatformSvgIcon(state.platform, 14)
              : '<i data-lucide="video" style="width:14px;height:14px;color:var(--accent-color);"></i>';
            activeTriggerHtml = `<span style="display:inline-flex;align-items:center;justify-content:center;width:14px;height:14px;">${platSvg}</span><span>${escapeHtml(state.platform)}</span>`;
          }
        } else {
          const selText = (t.filter_selected_count || '{count} Seçili').replace('{count}', totalCount);
          activeTriggerHtml = `<i data-lucide="layers" style="width:14px;height:14px;color:var(--accent-color);"></i><span>${escapeHtml(selText)}</span>`;
        }
      }

      html += `
        <div class="custom-dropdown-item ${isAllActive ? 'active' : ''}" onclick="resetDownloadedChannelFilter(event)">
          ${allIcon}
          <span>${escapeHtml(allText)}</span>
          ${isAllActive ? '<i data-lucide="check" style="margin-left:auto;width:14px;height:14px;"></i>' : ''}
        </div>
      `;
    } else {
      // history type
      if (currentValue === 'all') {
        activeTriggerHtml = `${allIcon}<span>${escapeHtml(allText)}</span>`;
      }
      html += `
        <div class="custom-dropdown-item ${currentValue === 'all' ? 'active' : ''}" onclick="selectCustomChannelOption('${type}', 'all', event)">
          ${allIcon}
          <span>${escapeHtml(allText)}</span>
        </div>
      `;
    }

    // 1.5 Kaynaklar / Platformlar - SADECE İndirilenler (downloaded) sekmesinde gösterilir (Kütüphane yalnızca YouTube kanallarını takip eder!)
    if (type === 'downloaded') {
      const platformsList = [
        { id: 'youtube', name: 'YouTube' },
        { id: 'x', name: 'Twitter / X' },
        { id: 'instagram', name: 'Instagram' },
        { id: 'tiktok', name: 'TikTok' },
        { id: 'iptv', name: 'IPTV' }
      ];

      platformsList.forEach(plat => {
        const platVal = 'platform:' + plat.id;
        const platSvg = (typeof getPlatformSvgIcon === 'function')
          ? getPlatformSvgIcon(plat.id, 16)
          : '<i data-lucide="video" style="width:16px;height:16px;color:var(--accent-color);"></i>';
        const isSel = state.platform === plat.id;
        selectOptionsHtml += '<option value="' + platVal + '">' + escapeHtml(plat.name) + '</option>';
        html += `
          <div class="custom-dropdown-item ${isSel ? 'active' : ''}" onclick="toggleDownloadedFilterPlatform('${plat.id}', event)">
            <span class="custom-dropdown-checkbox ${isSel ? 'checked' : ''}"></span>
            <span style="display:inline-flex;align-items:center;justify-content:center;width:16px;height:16px;flex-shrink:0;">${platSvg}</span>
            <span>${escapeHtml(plat.name)}</span>
          </div>
        `;
      });

      html += '<div class="custom-dropdown-divider"></div>';
    }

    // 2. Kategoriler
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
          const catIcon = `<i data-lucide="folder" style="width:16px;height:16px;color:var(--accent-color);"></i>`;
          
          if (type === 'downloaded') {
            const isCatSel = state.categories.includes(cat.id);
            const isExc = state.mode === 'exclude';
            selectOptionsHtml += `<option value="${catValue}">${escapeHtml(catName)}</option>`;
            html += `
              <div class="custom-dropdown-item ${isCatSel ? 'active' : ''} ${isExc && isCatSel ? 'is-excluded' : ''}" onclick="toggleDownloadedFilterCategory(${cat.id}, event)">
                <span class="custom-dropdown-checkbox ${isCatSel ? 'checked' : ''}"></span>
                ${catIcon}
                <span>${escapeHtml(catName)}</span>
              </div>
            `;
          } else {
            const isSel = currentValue === catValue;
            if (isSel) {
              activeTriggerHtml = `${catIcon}<span>${escapeHtml(catName)}</span>`;
            }
            selectOptionsHtml += `<option value="${catValue}">${escapeHtml(catName)}</option>`;
            html += `
              <div class="custom-dropdown-item ${isSel ? 'active' : ''}" onclick="selectCustomChannelOption('${type}', '${catValue}', event)">
                ${catIcon}
                <span>${escapeHtml(catName)}</span>
              </div>
            `;
          }
        }
      });

      html += `<div class="custom-dropdown-divider"></div>`;
    }

    // 3. Kanallar (Menü kapalıyken 137 kanalın avatarını RAM'e yüklememek için data-avatar-src kullanılır; menü açılınca yüklenir)
    const emptyPixel = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
    const sortedChannels = [...channels].sort((a, b) => a.name.localeCompare(b.name, 'tr'));
    sortedChannels.forEach(channel => {
      const avatarUrl = `/api/channels/${channel.id}/avatar`;
      const lazyAvatarImgHtml = `<img src="${emptyPixel}" data-avatar-src="${avatarUrl}" class="custom-dropdown-avatar" width="20" height="20" loading="lazy" decoding="async" onerror="this.src='/logo.png'">`;
      const eagerAvatarImgHtml = `<img src="${avatarUrl}" class="custom-dropdown-avatar" width="20" height="20" loading="lazy" decoding="async" onerror="this.src='/logo.png'">`;
      
      if (type === 'downloaded') {
        const isChanSel = state.channels.includes(channel.id);
        const isExc = state.mode === 'exclude';
        selectOptionsHtml += `<option value="${channel.id}">${escapeHtml(channel.name)}</option>`;
        html += `
          <div class="custom-dropdown-item ${isChanSel ? 'active' : ''} ${isExc && isChanSel ? 'is-excluded' : ''}" onclick="toggleDownloadedFilterChannelOption('${channel.id}', event)">
            <span class="custom-dropdown-checkbox ${isChanSel ? 'checked' : ''}"></span>
            ${lazyAvatarImgHtml}
            <span>${escapeHtml(channel.name)}</span>
          </div>
        `;
      } else {
        const isSel = currentValue === channel.id;
        if (isSel) {
          activeTriggerHtml = `${eagerAvatarImgHtml}<span>${escapeHtml(channel.name)}</span>`;
        }
        selectOptionsHtml += `<option value="${channel.id}">${escapeHtml(channel.name)}</option>`;
        html += `
          <div class="custom-dropdown-item ${isSel ? 'active' : ''}" onclick="selectCustomChannelOption('${type}', '${channel.id}', event)">
            ${lazyAvatarImgHtml}
            <span>${escapeHtml(channel.name)}</span>
          </div>
        `;
      }
    });

    panel.innerHTML = headerHtml + html + '</div>';
    if (triggerContent) {
      triggerContent.innerHTML = activeTriggerHtml;
    }
    if (selectEl) {
      selectEl.innerHTML = selectOptionsHtml;
      selectEl.value = currentValue;
    }

    if (type === 'downloaded') {
      renderDownloadedCategoryQuickPills(currentValue, targetDb);
    }

    try {
      if (typeof lucide !== 'undefined' && typeof lucide.createIcons === 'function') {
        lucide.createIcons({ root: panel });
        if (triggerContent) lucide.createIcons({ root: triggerContent });
      }
    } catch (e) {}
  });
}
window.populateChannelFilters = populateChannelFilters;

/**
 * Türkçe Açıklama: İndirilenler üst barındaki hızlı kategori hap butonlarını render eder.
 * Kullanıcı araçlar sekmesinden pinlediyse pinlenenleri (max 5),
 * henüz seçim yapılmamışsa varsayılan popüler kategorileri (max 5) listeler.
 * @param {string} [activeVal] Aktif seçili filtre değeri ('all', 'category:X', vs.)
 * @param {object} [dbParam] Veritabanı veri nesnesi
 */
function renderDownloadedCategoryQuickPills(activeVal, dbParam) {
  try {
    const container = document.getElementById('downloaded-category-quick-pills');
    if (!container) return;

    const targetDb = dbParam || window.localDb || {};
    const categories = Array.isArray(targetDb.categories) ? targetDb.categories : [];
    const channels = Array.isArray(targetDb.channels) ? targetDb.channels : [];
    const lang = targetDb.settings?.lang || window.localDb?.settings?.lang || currentLang || 'tr';
    const t = translations[lang] || translations.tr || {};

    const state = (typeof getDownloadedFilterState === 'function')
      ? getDownloadedFilterState()
      : { mode: 'include', categories: [], channels: [], platform: 'all' };

    // 1. Kullanıcının pinlediği kategorileri al
    let pins = [];
    try {
      pins = JSON.parse(localStorage.getItem('haytool_quick_category_pins') || '[]');
      if (!Array.isArray(pins)) pins = [];
    } catch (e) {
      pins = [];
    }

    let selectedCats = [];

    if (pins.length > 0) {
      // Pinlenen kategorileri sırayla bul
      selectedCats = pins
        .map(id => categories.find(c => c && c.id === id))
        .filter(c => c && typeof c.id !== 'undefined');
    }

    // Eğer kullanıcı henüz pinleme yapmamışsa: En popüler/kanalı olan ilk 5 kategoriyi otomatik seç
    if (selectedCats.length === 0 && categories.length > 0) {
      const defaultPriority = [17, 4, 5, 2, 3, 10, 7, 8, 9, 1];
      const presentCats = [];
      for (const pid of defaultPriority) {
        const found = categories.find(c => c && c.id === pid);
        if (found && !presentCats.some(c => c.id === found.id)) {
          presentCats.push(found);
        }
        if (presentCats.length >= 3) break;
      }
      for (const cat of categories) {
        if (cat && !presentCats.some(c => c.id === cat.id)) {
          presentCats.push(cat);
        }
        if (presentCats.length >= 3) break;
      }
      selectedCats = presentCats;
    }

    // Maksimum 3 adetle sınırla ve geçersiz öğeleri temizle
    selectedCats = selectedCats.filter(c => c && typeof c.id !== 'undefined').slice(0, 3);

    const isExc = state.mode === 'exclude';
    let pillsHtml = '';
    selectedCats.forEach(cat => {
      const catName = (typeof getCatTranslatedName === 'function') ? getCatTranslatedName(cat, t) : (cat.name || 'Kategori');
      const isCatActive = state.categories.includes(cat.id);
      const activeClass = isCatActive ? (isExc ? 'active exclude-active' : 'active') : '';
      const catIcon = cat.id === 17 ? 'mic' : (cat.id === 4 ? 'music' : (cat.id === 2 ? 'gamepad-2' : (cat.id === 5 ? 'cpu' : 'folder')));

      pillsHtml += `
        <button type="button" 
                class="downloaded-cat-pill-btn ${activeClass}" 
                onclick="toggleDownloadedCategoryPill(${cat.id}, event)" 
                title="${escapeHtml(catName)}${isExc ? ' (Hariç Tut)' : ''}">
          <i data-lucide="${catIcon}" style="width:12px; height:12px;"></i>
          <span class="pill-label">${escapeHtml(catName)}</span>
        </button>
      `;
    });

    container.innerHTML = pillsHtml;
    try { if (typeof lucide !== 'undefined') lucide.createIcons({ root: container }); } catch (e) {}
  } catch (err) {
    console.warn('[renderDownloadedCategoryQuickPills] Hata yakalandı:', err);
  }
}
window.renderDownloadedCategoryQuickPills = renderDownloadedCategoryQuickPills;

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

// Sayfa ilk yüklendiğinde süresi dolmuş video onayı var mı kontrol et
setTimeout(() => {
  if (typeof checkPendingAutoDeleteOnLoad === 'function') {
    checkPendingAutoDeleteOnLoad();
  }
}, 1200);



// Tarayıcı Eklentisi Modalı Yönetimi
window.openShortcutsModal = function(initialTab = 'iptv') {
  const modal = document.getElementById('shortcuts-modal');
  if (!modal) return;
  renderShortcutsCheatsheetModal();
  modal.classList.remove('hidden');
  if (typeof window.switchShortcutsTab === 'function') window.switchShortcutsTab(initialTab);
  if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
};

window.closeShortcutsModal = function() {
  const modal = document.getElementById('shortcuts-modal');
  if (modal) modal.classList.add('hidden');
};

window.switchShortcutsTab = function(tab = 'iptv') {
  const isIptv = tab === 'iptv';
  const iptvBtn = document.getElementById('shortcuts-tab-iptv-btn');
  const playerBtn = document.getElementById('shortcuts-tab-player-btn');
  const iptvPanel = document.getElementById('shortcuts-panel-iptv');
  const playerPanel = document.getElementById('shortcuts-panel-player');

  if (iptvBtn) iptvBtn.classList.toggle('active', isIptv);
  if (playerBtn) playerBtn.classList.toggle('active', !isIptv);
  if (iptvPanel) iptvPanel.classList.toggle('hidden', !isIptv);
  if (playerPanel) playerPanel.classList.toggle('hidden', isIptv);
};

window.openExtensionModal = function() {
  const modal = document.getElementById('extension-modal');
  if (modal) {
    modal.classList.remove('hidden');
    if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
  }
};

window.closeExtensionModal = function() {
  const modal = document.getElementById('extension-modal');
  if (modal) {
    modal.classList.add('hidden');
  }
};

window.openExtensionFolder = async function() {
  try {
    const res = await fetch('/api/tools/open-extension-folder', { method: 'POST' });
    const data = await res.json();
    if (data.success) {
      if (typeof showToast === 'function') showToast('Eklenti klasörü açıldı.', 'success');
    } else {
      if (typeof showToast === 'function') showToast(data.error || 'Klasör açılamadı.', 'error');
    }
  } catch (err) {
    if (typeof showToast === 'function') showToast('Bağlantı hatası.', 'error');
  }
};


window.copyExtAddress = function(text, btnEl) {
  if (!text) return;
  navigator.clipboard.writeText(text).then(() => {
    if (typeof showToast === 'function') {
      showToast(text + ' kopyalandı! Tarayıcınızda yeni sekme açıp yapıştırın.', 'success');
    }
    if (btnEl) {
      const origHtml = btnEl.innerHTML;
      btnEl.style.borderColor = 'var(--accent-color)';
      setTimeout(() => {
        btnEl.innerHTML = origHtml;
        btnEl.style.borderColor = '';
        if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
      }, 1500);
    }
  }).catch(() => {
    // Fallback prompt
    prompt('Adresi kopyalayın:', text);
  });
};


window.copyInputVal = function(inputId, btnEl) {
  const el = document.getElementById(inputId);
  if (!el) return;
  el.select();
  el.setSelectionRange(0, 99999);
  
  const text = el.value;
  navigator.clipboard.writeText(text).then(() => {
    if (typeof showToast === 'function') {
      showToast(text + ' panoya kopyalandı! Yeni sekmede yapıştırıp Enter\'a basın.', 'success');
    }
    if (btnEl) {
      const origHtml = btnEl.innerHTML;
      btnEl.innerHTML = '<i data-lucide="check" style="width:12px; height:12px; color:#22c55e;"></i> <span style="color:#22c55e;">Kopyalandı</span>';
      if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
      setTimeout(() => {
        btnEl.innerHTML = origHtml;
        if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
      }, 1500);
    }
  }).catch(() => {
    document.execCommand('copy');
    if (typeof showToast === 'function') showToast(text + ' kopyalandı!', 'success');
  });
};

window.onDownloadedPlatformFilterChange = function() {
  const sel = document.getElementById('downloaded-platform-filter');
  downloadedFilterPlatform = sel ? sel.value : 'all';
  window.downloadedFilterPlatform = downloadedFilterPlatform;
  updateUI(localDb);
};


// Türkçe Açıklama: Paylaş menüsünü açar/kapatır.
window.toggleShareMenu = function(e) {
  if (e) {
    e.stopPropagation();
    e.preventDefault();
  }
  const menu = document.getElementById('inline-share-menu');
  if (!menu) return;
  const isHidden = menu.style.display === 'none' || menu.classList.contains('hidden');
  if (isHidden) {
    menu.classList.remove('hidden');
    menu.style.display = 'flex';
    try { if (typeof lucide !== 'undefined') lucide.createIcons(); } catch(err) {}
    
    // Dışarı tıklandığında menüyü kapat dinleyicisi
    const closeHandler = (evt) => {
      if (!evt.target.closest('.inline-share-wrapper')) {
        menu.classList.add('hidden');
        menu.style.display = 'none';
        document.removeEventListener('click', closeHandler);
      }
    };
    setTimeout(() => document.addEventListener('click', closeHandler), 10);
  } else {
    menu.classList.add('hidden');
    menu.style.display = 'none';
  }
};

// Türkçe Açıklama: Paylaş seçeneği tıklandığında (Dosya, Kopyala veya Link) çalışır.
window.shareOptionSelected = async function(type) {
  const menu = document.getElementById('inline-share-menu');
  if (menu) {
    menu.classList.add('hidden');
    menu.style.display = 'none';
  }
  const vId = window.currentPlayingVideoId;
  if (!vId) return;

  if (type === 'file') {
    await window.shareVideoFile(vId);
  } else if (type === 'copy-file') {
    await window.copyVideoFileToClipboard(vId);
  } else {
    await window.shareVideoLink(vId);
  }
};

// Türkçe Açıklama: Video dosyasını doğrudan Windows panosuna kopyalar (WhatsApp'a Ctrl+V yapıştırmak için).
window.copyVideoFileToClipboard = async function(videoId) {
  const vId = videoId || currentPlayingVideoId;
  if (!vId) return;
  const video = (localDb.history || []).find(h => h.id === vId);
  const lang = (localDb && localDb.settings && localDb.settings.lang) || currentLang || 'tr';
  const t = translations[lang] || translations.tr || {};
  const isEn = lang === 'en';

  if (!video || !video.filePath) {
    showToast(isEn ? 'Video file not found on disk.' : 'Video dosyası diskte bulunamadı.', 'warning');
    return;
  }

  // 1. Önce WPF WebView2 C# köprüsünü dene
  try {
    if (window.chrome?.webview?.hostObjects?.playerBridge?.copyFileToClipboard) {
      const ok = await window.chrome.webview.hostObjects.playerBridge.copyFileToClipboard(video.filePath);
      if (ok) {
        showToast(t.share_file_copied_toast || (isEn ? 'Video file copied! You can paste with Ctrl+V into WhatsApp.' : 'Video dosyası kopyalandı! WhatsApp içine Ctrl+V ile yapıştırabilirsiniz.'), 'success');
        return;
      }
    }
  } catch (err) {}

  // 2. Web / Backend API fallback
  try {
    const res = await fetch('/api/tools/copy-file-to-clipboard', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filePath: video.filePath })
    });
    const data = await res.json();
    if (data.success) {
      showToast(t.share_file_copied_toast || (isEn ? 'Video dosyası kopyalandı! WhatsApp içine Ctrl+V ile yapıştırabilirsiniz.' : 'Video dosyası kopyalandı! WhatsApp içine Ctrl+V ile yapıştırabilirsiniz.'), 'success');
    } else {
      showToast(data.error || 'Dosya kopyalanamadı.', 'error');
    }
  } catch (e) {
    showToast(isEn ? 'Connection error.' : 'Bağlantı hatası.', 'error');
  }
};

// Türkçe Açıklama: Videonun orijinal MP4 dosyasını sistem paylaşım penceresiyle paylaşır (Yalnızca dosya, metinsiz).
window.shareVideoFile = async function(videoId) {
  const vId = videoId || currentPlayingVideoId;
  if (!vId) return;
  const video = (localDb.history || []).find(h => h.id === vId);
  const lang = (localDb && localDb.settings && localDb.settings.lang) || currentLang || 'tr';
  const t = translations[lang] || translations.tr || {};
  const isEn = lang === 'en';

  const isCompleted = video && video.status === 'completed' && !video.fileMissing;
  if (!isCompleted) {
    showToast(isEn ? 'Video file is not downloaded yet.' : 'Video dosyası henüz indirilmemiş.', 'warning');
    return;
  }

  // Arka planda panoya da kopyala (WhatsApp paylaşım ekranında dosya yüklenmezse Ctrl+V hemen çalışsın)
  if (video.filePath) {
    window.copyVideoFileToClipboard(vId).catch(() => {});
  }

  showToast(t.share_file_preparing || (isEn ? 'Preparing video file for sharing...' : 'Video dosyası paylaşıma hazırlanıyor...'), 'info');

  try {
    const streamUrl = `/api/video-stream?videoId=${vId}`;
    const response = await fetch(streamUrl);
    if (!response.ok) throw new Error('File stream error');

    const blob = await response.blob();
    const ext = (video.filePath && video.filePath.includes('.')) ? video.filePath.split('.').pop() : 'mp4';
    const cleanTitle = (video.title || 'video').replace(/[/\\?%*:|"<>]/g, '_').substring(0, 100);
    const fileName = `${cleanTitle}.${ext}`;
    const mimeType = blob.type || 'video/mp4';
    const file = new File([blob], fileName, { type: mimeType });

    // ÖNEMLİ: title veya text PARAMETRESİ VERİLMEZ!
    // Eğer title/text verilirse Windows ve WhatsApp dosyayı yok sayıp sadece başlık metnini yapıştırır!
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({
        files: [file]
      });
      return;
    }
  } catch (err) {
    if (err && err.name === 'AbortError') return; // Kullanıcı pencereyi kapattı
    console.warn('[Share] File sharing via navigator.share failed or unsupported:', err);
  }

  // Fallback: Web Share dosya paylaşımını desteklemiyorsa video konumunu aç
  if (video && video.filePath) {
    try {
      await fetch('/api/tools/open-file-location', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath: video.filePath, videoId: vId })
      });
      showToast(t.share_file_opened_folder || (isEn ? 'Video file selected in folder.' : 'Video dosyası klasörde seçili olarak açıldı (ve panoya kopyalandı).'), 'success');
    } catch (e) {
      showToast(isEn ? 'Could not open video location.' : 'Video konumu açılamadı.', 'error');
    }
  } else {
    showToast(isEn ? 'Video file not found on disk.' : 'Video dosyası diskte bulunamadı.', 'warning');
  }
};

// Türkçe Açıklama: Videonun web bağlantısını sistem paylaşım penceresiyle paylaşır veya kopyalar.
window.shareVideoLink = async function(videoId) {
  const vId = videoId || currentPlayingVideoId;
  if (!vId) return;
  const video = (localDb.history || []).find(h => h.id === vId);
  const title = video?.title || document.getElementById('inline-player-title')?.textContent || 'Video';
  const platform = (typeof detectVideoPlatform === 'function') ? detectVideoPlatform(video) : 'youtube';

  let shareUrl = video?.webUrl || video?.url || '';
  if (!shareUrl) {
    if (platform === 'youtube') {
      const ytId = (video && video.originalId) ? video.originalId : String(vId).replace(/^fakap_/, '');
      shareUrl = `https://www.youtube.com/watch?v=${ytId}`;
    }
  }

  const lang = (localDb && localDb.settings && localDb.settings.lang) || currentLang || 'tr';
  const t = translations[lang] || translations.tr || {};
  const isEn = lang === 'en';

  if (navigator.share) {
    try {
      await navigator.share({
        title: title,
        text: title,
        url: shareUrl || window.location.href
      });
      return;
    } catch (err) {
      if (err && err.name === 'AbortError') return;
      console.warn('[Share] navigator.share error, fallback to clipboard:', err);
    }
  }

  if (shareUrl) {
    try {
      await navigator.clipboard.writeText(shareUrl);
      showToast(t.share_link_copied || (isEn ? 'Link copied to clipboard!' : 'Bağlantı panoya kopyalandı!'), 'success');
    } catch (e) {
      prompt(isEn ? 'Copy link:' : 'Bağlantıyı kopyalayın:', shareUrl);
    }
  } else {
    showToast(isEn ? 'Share link not available.' : 'Paylaşılacak bağlantı bulunamadı.', 'warning');
  }
};

window.shareVideo = function(videoId) {
  toggleShareMenu();
};

