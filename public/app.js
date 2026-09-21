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
  resizeAllArtplayers,
  saveIptvState,
  swapIptvSportModePlayers,
  updateIptvSwapBtnVisibility,
  initIptvSportModeDragAndResize,
  updateLoadMoreBtn,
  renderIptvChannels
} from './modules/iptv.js';

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
      const video = (localDb.history || []).find(h => h.id === currentPlayingVideoId);
      const isShort = isShortVideo(video?.duration, video?.title, video?.channelId);
      
      const inlineBody = document.getElementById('inline-player-body');
      const modal = document.getElementById('player-modal');
      const modalBody = modal ? modal.querySelector('.player-modal-body') : null;
      const modalTitle = document.getElementById('player-modal-title');
      const modalLogo = document.getElementById('player-modal-logo');

      if (modal && modalBody && inlineBody && inlineBody.firstElementChild) {
        // Modal başlık ve logoyu güncelle
        if (modalTitle) modalTitle.textContent = video ? video.title : 'Gömülü Video Oynatıcı';
        if (modalLogo && video?.channelId) {
          modalLogo.src = `/api/channels/${video.channelId}/avatar`;
          modalLogo.style.display = 'block';
        } else if (modalLogo) {
          modalLogo.style.display = 'none';
        }

        // Canlı DOM elementini (Artplayer veya Plyr/Video) doğrudan modala taşı
        while (inlineBody.firstChild) {
          modalBody.appendChild(inlineBody.firstChild);
        }

        // Yerleşik alanı gizle
        inlineContainer.classList.add('hidden');
        const listContainer = document.getElementById('downloaded-list-container');
        if (listContainer) listContainer.classList.remove('hidden');

        // Modalı göster ve boyutlandır
        modal.classList.remove('hidden');
        if (typeof resetAndApplyPlayerDimensions === 'function') {
          resetAndApplyPlayerDimensions(isShort, true); // Minimized modunda aç
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
 * Sunucudan GitHub güncelleme durumunu sorgular.
 */
async function checkApplicationUpdates() {
  try {
    const res = await fetch('/api/updates/check');
    if (!res.ok) return;
    const update = await res.json();
    if (update && update.updateAvailable) {
      showUpdateNotification(update);
    }
  } catch (err) {
    console.warn('Update check failed:', err);
  }
}

async function loadAppVersion() {
  try {
    const res = await fetch('/api/version');
    const data = await res.json();
    if (data && data.version) {
      const verStr = 'v' + data.version;
      
      // Topbar version badge
      const topbarVer = document.getElementById('topbar-version');
      if (topbarVer) {
        const link = topbarVer.querySelector('a');
        if (link) {
          link.textContent = verStr;
          link.href = 'https://github.com/HaYToKoRaZ/haytool-youtube-download';
        } else {
          topbarVer.textContent = verStr;
        }
      }
      
      // Settings version label
      const settingsVer = document.getElementById('settings-version');
      if (settingsVer) {
        const link = settingsVer.querySelector('a');
        if (link) {
          link.textContent = verStr;
          link.href = 'https://github.com/HaYToKoRaZ/haytool-youtube-download';
        } else {
          settingsVer.textContent = verStr;
        }
      }
    }
  } catch (err) {
    console.warn('Failed to load version:', err);
  }
}

/**
 * Kullanıcıya yeni sürüm olduğunu bildiren animasyonlu bir kart gösterir.
 */
function showUpdateNotification(update) {
  if (sessionStorage.getItem('hide_update_notification') === 'true') {
    return;
  }
  
  const existing = document.getElementById('github-update-notification');
  if (existing) existing.remove();
  
  const isEn = localDb.settings?.lang === 'en';
  const title = isEn ? 'New Version Available!' : 'Yeni Sürüm Mevcut!';
  const desc = isEn ? `v${update.latestVersion.replace(/^v/, '')} version is ready to download.` : `v${update.latestVersion.replace(/^v/, '')} sürümü indirilebilir durumda.`;
  const btnText = isEn ? 'View on GitHub' : 'GitHub\'da İncele';
  
  const card = document.createElement('div');
  card.id = 'github-update-notification';
  card.className = 'github-update-card';
  card.innerHTML = `
    <div class="update-card-content">
      <div class="update-card-icon">
        <i data-lucide="sparkles"></i>
      </div>
      <div class="update-card-body">
        <h4>${title}</h4>
        <p>${desc}</p>
        <div class="update-card-actions">
          <a href="${update.releaseUrl}" target="_blank" class="update-btn-action">${btnText}</a>
          <button class="update-btn-close" id="github-update-close-btn"><i data-lucide="x"></i></button>
        </div>
      </div>
    </div>
  `;
  
  document.body.appendChild(card);
  
  if (window.lucide) {
    window.lucide.createIcons();
  }
  
  document.getElementById('github-update-close-btn').addEventListener('click', () => {
    card.classList.add('fade-out');
    sessionStorage.setItem('hide_update_notification', 'true');
    setTimeout(() => card.remove(), 400);
  });

  // Ayarlar sekmesindeki sürüm numarasının yanına yeşil bir badge ekle
  const settingsVersion = document.getElementById('settings-version');
  if (settingsVersion && !document.getElementById('settings-update-badge')) {
    const badge = document.createElement('span');
    badge.id = 'settings-update-badge';
    badge.className = 'update-badge-settings';
    badge.textContent = isEn ? 'Update Available' : 'Güncelleme Var';
    badge.style.cssText = 'font-size: 0.75rem; background: #22c55e; color: #fff; padding: 2px 6px; border-radius: 4px; margin-left: 8px; font-weight: 600; display: inline-block; cursor: pointer;';
    badge.onclick = () => window.open(update.releaseUrl, '_blank');
    settingsVersion.parentNode.appendChild(badge);
  }
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

    const settingsChannelScanMode = document.getElementById('settings-channel-scan-mode');
    if (settingsChannelScanMode && document.activeElement !== settingsChannelScanMode) settingsChannelScanMode.value = db.settings.channelScanMode || 'fast';

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

    const settingsPlayerType = document.getElementById('settings-player-type');
    if (settingsPlayerType && document.activeElement !== settingsPlayerType) settingsPlayerType.value = db.settings.playerType || 'plyr';

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
    downloadedFilterChannel = 'all';
    updateUI(localDb);
  }
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

window.deleteChannel = async function(id) {
  if (!confirm('Bu kanalı takipten çıkarmak istediğinizden emin misiniz?')) return;
  
  try {
    const res = await fetch(`/api/channels/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.success) {
      showToast('Kanal takipten çıkarıldı.', 'info');
    } else {
      showToast(data.error || 'Hata oluştu.', 'error');
    }
  } catch (err) {
    showToast('Sunucu ile iletişim hatası.', 'error');
  }
};

// Türkçe Açıklama: Belirtilen kanalın güncel profil resmini YouTube üzerinden indirip yerel diske kaydetmek üzere backend rotasını tetikler.
/**
 * Belirtilen kanalın profil resmini (logosunu) YouTube'dan yeniden çözümler ve günceller.
 * 
 * @param {string} id Güncellenecek kanal ID'si
 */
window.updateChannelAvatar = async function(id) {
  try {
    showToast('Kanal logosu güncelleniyor...', 'info');
    const res = await fetch(`/api/channels/${id}/update-avatar`, { method: 'POST' });
    const data = await res.json();
    if (data.success) {
      showToast('Kanal logosu başarıyla güncellendi.', 'success');
      // Logo güncellendikten sonra resmi yenilemek için cache-busting yapıyoruz
      const img = document.getElementById(`ch-avatar-${id}`);
      if (img) {
        img.src = `/api/channels/${id}/avatar?t=${Date.now()}`;
      }
    } else {
      showToast(data.error || 'Hata oluştu.', 'error');
    }
  } catch (err) {
    showToast('Sunucu ile iletişim hatası.', 'error');
  }
};

/**
 * Takip edilen tüm kanalların logolarını arka planda toplu olarak günceller.
 */
// Türkçe Açıklama: Arayüzden toplu kanal logosu güncelleme API'sini çağırır.
window.updateAllChannelInfo = async function() {
  const isEn = localDb.settings && localDb.settings.lang === 'en';
  showToast(isEn ? 'Updating subscriber counts & avatars for all channels...' : 'Tüm kanal abone sayıları ve avatarları güncelleniyor...', 'info');
  
  const btn = document.getElementById('update-all-channels-btn');
  if (btn) btn.disabled = true;
  
  try {
    const res = await fetch('/api/channels/update-all-info', { method: 'POST' });
    const data = await res.json();
    if (data.success) {
      showToast(isEn ? 'All channel info updated successfully.' : 'Tüm kanal bilgileri başarıyla güncellendi.', 'success');
      if (typeof fetchDb === 'function') {
        await fetchDb();
      }
      // (renderChannels/renderHistory tanımsız eski çağrıları kaldırıldı)
    } else {
      showToast(data.error || (isEn ? 'Process failed.' : 'İşlem başarısız oldu.'), 'error');
    }
  } catch (err) {
    showToast(isEn ? 'Server connection error.' : 'Sunucu ile iletişim hatası.', 'error');
  } finally {
    if (btn) btn.disabled = false;
  }
};

window.updateChannelInfo = async function(id) {
  const isEn = localDb.settings && localDb.settings.lang === 'en';
  try {
    showToast(isEn ? 'Updating channel info (subscribers & avatar)...' : 'Kanal bilgileri (abone sayısı & avatar) güncelleniyor...', 'info');
    const res = await fetch(`/api/channels/${id}/update-info`, { method: 'POST' });
    const data = await res.json();
    if (data.success) {
      showToast(isEn ? 'Channel info updated successfully.' : 'Kanal bilgileri başarıyla güncellendi.', 'success');
      
      const targetChannel = localDb.channels?.find(c => c.id === id);
      if (targetChannel) {
        if (data.subscriberCount) targetChannel.subscriberCount = data.subscriberCount;
        if (data.avatar) targetChannel.avatar = data.avatar;
      }

      if (typeof fetchDb === 'function') {
        await fetchDb();
      }
      // (renderChannels/renderHistory tanımsız eski çağrıları kaldırıldı)
    } else {
      showToast(data.error || (isEn ? 'Error occurred.' : 'Hata oluştu.'), 'error');
    }
  } catch (err) {
    showToast(isEn ? 'Server communication error.' : 'Sunucu ile iletişim hatası.', 'error');
  }
};

window.updateAllChannelAvatars = async function() {
  return window.updateAllChannelInfo();
};

window.updateChannelSubscribers = async function(id) {
  return window.updateChannelInfo(id);
};

window.updateAllChannelSubscribers = async function() {
  return window.updateAllChannelInfo();
};

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

// Form Gönderimleri
if (addChannelForm) {
  addChannelForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const inputVal = channelInput.value.trim();
    if (!inputVal) return;

    const downloadShorts = confirm('Bu kanal için Shorts videoları da otomatik indirilsin mi? (İptal seçilirse Shorts videoları otomatik indirilmeyecektir)');

    addChannelBtn.disabled = true;
    addChannelBtn.querySelector('span').textContent = 'Kanal Çözümleniyor...';
    showToast('Kanal sorgulanıyor, lütfen bekleyin...', 'info');

    try {
      const res = await fetch('/api/channels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: inputVal, downloadShorts })
      });
      
      const data = await res.json();
      
      if (data.success) {
        channelInput.value = '';
        showToast('Kanal başarıyla takip listesine eklendi!', 'success');
      } else {
        showToast(data.error || 'Kanal eklenirken bir hata oluştu.', 'error');
      }
    } catch (err) {
      showToast('Bağlantı hatası.', 'error');
    } finally {
      addChannelBtn.disabled = false;
      addChannelBtn.querySelector('span').textContent = 'Kanalı Takip Et';
      lucide.createIcons();
    }
  });
}

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
    playerType: document.getElementById('settings-player-type').value,
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
    channelScanMode: document.getElementById('settings-channel-scan-mode') ? document.getElementById('settings-channel-scan-mode').value : 'fast',
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

/**
 * Disk senkronizasyonunu manuel olarak tetikler ve arayüz bildirimlerini yönetir.
 * 
 * @returns {Promise<void>}
 */
async function triggerManualDiskSync() {
  const btn = document.getElementById('btn-manual-disk-sync');
  const lang = (localDb && localDb.settings && localDb.settings.lang) || currentLang || 'tr';
  const t = translations[lang] || translations.tr;
  const isEn = lang === 'en';

  let originalHtml = '';
  if (btn) {
    originalHtml = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = `<i data-lucide="loader" class="pulse-animation" style="width:13px;height:13px;"></i> <span>${isEn ? 'Syncing...' : 'Senkronize Ediliyor...'}</span>`;
    try { lucide.createIcons(); } catch(e) {}
  }

  showToast(t.msg_disk_sync_started || (isEn ? 'Disk sync started...' : 'Disk senkronizasyonu başlatıldı...'), 'info');

  try {
    const res = await fetch('/api/settings/sync-disk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    const data = await res.json();
    if (data.success) {
      if (data.busy) {
        showToast(data.message || (isEn ? 'Downloads active, sync deferred.' : 'Aktif indirme olduğu için senkronizasyon ertelendi.'), 'warning');
      } else {
        const successMsg = isEn 
          ? `Disk synced: ${data.totalVerified || 0} videos verified, ${data.updatedCount || 0} updated.`
          : `Disk eşitlendi: ${data.totalVerified || 0} video doğrulandı, ${data.updatedCount || 0} kayıt güncellendi.`;
        showToast(successMsg, 'success');
      }
    } else {
      showToast(data.error || (isEn ? 'Disk sync failed.' : 'Disk senkronizasyonu başarısız oldu.'), 'error');
    }
  } catch (err) {
    showToast(isEn ? 'Connection error.' : 'Bağlantı hatası.', 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = originalHtml;
      try { lucide.createIcons(); } catch(e) {}
    }
  }
}
window.triggerManualDiskSync = triggerManualDiskSync;

const btnManualDiskSync = document.getElementById('btn-manual-disk-sync');
if (btnManualDiskSync) {
  btnManualDiskSync.onclick = triggerManualDiskSync;
}

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

/**
 * Belirli bir kanal için varsayılan indirme kalitesini günceller.
 * 
 * @param {string} id Kanal ID'si
 * @param {string} quality Kalite değeri ('default', 'best', '1080p', '720p')
 */
window.changeChannelQuality = async function(id, quality) {
  try {
    const res = await fetch(`/api/channels/${id}/quality`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quality })
    });
    const data = await res.json();
    if (data.success) {
      showToast('Kanal kalitesi başarıyla güncellendi.', 'success');
    } else {
      showToast(data.error || 'Hata oluştu.', 'error');
    }
  } catch (err) {
    showToast('Sunucu bağlantı hatası.', 'error');
  }
};

// Türkçe Açıklama: Belirtilen kanal için Shorts videolarının indirilip indirilmeyeceğini güncelleyen backend rotasını tetikler.
/**
 * Belirli bir kanal için Shorts videolarının indirilip indirilmeyeceğini günceller.
 * 
 * @param {string} id Kanal ID'si
 * @param {string} downloadShorts Shorts indirme durumu ('true' veya 'false')
 */
window.changeChannelShorts = async function(id, downloadShorts) {
  try {
    const res = await fetch(`/api/channels/${id}/shorts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ downloadShorts: downloadShorts === 'true' })
    });
    const data = await res.json();
    if (data.success) {
      showToast('Kanal Shorts indirme ayarı başarıyla güncellendi.', 'success');
    } else {
      showToast(data.error || 'Hata oluştu.', 'error');
    }
  } catch (err) {
    showToast('Sunucu bağlantı hatası.', 'error');
  }
};

window.changeChannelAutoDownload = async function(id, autoDownload) {
  try {
    const res = await fetch(`/api/channels/${id}/auto-download`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ autoDownload: autoDownload === 'true' })
    });
    const data = await res.json();
    if (data.success) {
      const isEn = localDb.settings && localDb.settings.lang === 'en';
      showToast(isEn ? 'Channel auto download setting successfully updated.' : 'Kanal otomatik indirme ayarı başarıyla güncellendi.', 'success');
    } else {
      showToast(data.error || 'Hata oluştu.', 'error');
    }
  } catch (err) {
    showToast('Sunucu bağlantı hatası.', 'error');
  }
};

window.changeChannelShortsLimit = async function(id, limit) {
  try {
    const res = await fetch(`/api/channels/${id}/shorts-limit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ limit: parseInt(limit, 10) })
    });
    const data = await res.json();
    if (data.success) {
      const isEn = localDb.settings && localDb.settings.lang === 'en';
      showToast(isEn ? 'Channel Shorts duration limit successfully updated.' : 'Kanal Shorts süre sınırı başarıyla güncellendi.', 'success');
    } else {
      showToast(data.error || 'Hata oluştu.', 'error');
    }
  } catch (err) {
    showToast('Sunucu bağlantı hatası.', 'error');
  }
};

window.syncSingleChannelRss = async function(id) {
  const isEn = localDb.settings && localDb.settings.lang === 'en';
  showToast(isEn ? 'Checking channel RSS feed...' : 'Kanal RSS yayını taranıyor...', 'info');
  try {
    const res = await fetch(`/api/channels/${id}/sync`, { method: 'POST' });
    const data = await res.json();
    if (data.success) {
      showToast(isEn ? 'Channel RSS checked successfully.' : 'Kanal RSS denetimi başarıyla tamamlandı.', 'success');
    } else {
      showToast(data.error || (isEn ? 'Error occurred.' : 'Hata oluştu.'), 'error');
    }
  } catch (err) {
    showToast(isEn ? 'Connection error.' : 'Bağlantı hatası.', 'error');
  }
};

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

  const item = localDb?.history?.find(h => h.id === videoId);
  if (item) {
    if (durFloor > 0 && (posFloor >= durFloor * 0.95 || durFloor - posFloor <= 5)) {
      item.lastPositionSeconds = 0;
    } else if (posFloor > 3) {
      item.lastPositionSeconds = posFloor;
    } else {
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
    const pType = (localDb.settings && localDb.settings.playerType) || 'plyr';

    // Oynatıcı kontrollerini soyutlayan ortak nesne
    const activePlayer = {
      get paused() {
        if (pType === 'artplayer' && videoPlayerInstance) return videoPlayerInstance.paused;
        if (pType === 'html5' && player) return player.paused;
        return videoPlayerInstance ? videoPlayerInstance.paused : (player ? player.paused : true);
      },
      play() {
        if (pType === 'artplayer' && videoPlayerInstance) return videoPlayerInstance.play();
        if (pType === 'html5' && player) return player.play();
        return videoPlayerInstance ? videoPlayerInstance.play() : (player ? player.play() : Promise.resolve());
      },
      pause() {
        if (pType === 'artplayer' && videoPlayerInstance) videoPlayerInstance.pause();
        else if (pType === 'html5' && player) player.pause();
        else if (videoPlayerInstance) videoPlayerInstance.pause();
        else if (player) player.pause();
      },
      get duration() {
        if (pType === 'artplayer' && videoPlayerInstance) return videoPlayerInstance.duration || 0;
        if (pType === 'html5' && player) return player.duration || 0;
        return videoPlayerInstance ? (videoPlayerInstance.duration || 0) : (player ? (player.duration || 0) : 0);
      },
      get currentTime() {
        if (pType === 'artplayer' && videoPlayerInstance) return videoPlayerInstance.currentTime || 0;
        if (pType === 'html5' && player) return player.currentTime || 0;
        return videoPlayerInstance ? (videoPlayerInstance.currentTime || 0) : (player ? (player.currentTime || 0) : 0);
      },
      set currentTime(val) {
        if (pType === 'artplayer' && videoPlayerInstance) videoPlayerInstance.currentTime = val;
        else if (pType === 'html5' && player) player.currentTime = val;
        else if (videoPlayerInstance) videoPlayerInstance.currentTime = val;
        else if (player) player.currentTime = val;
      },
      get volume() {
        if (pType === 'artplayer' && videoPlayerInstance) return videoPlayerInstance.volume || 0;
        if (pType === 'html5' && player) return player.volume || 0;
        return videoPlayerInstance ? (videoPlayerInstance.volume || 0) : (player ? (player.volume || 0) : 0);
      },
      set volume(val) {
        if (pType === 'artplayer' && videoPlayerInstance) videoPlayerInstance.volume = val;
        else if (pType === 'html5' && player) player.volume = val;
        else if (videoPlayerInstance) videoPlayerInstance.volume = val;
        else if (player) player.volume = val;
      },
      get muted() {
        if (pType === 'artplayer' && videoPlayerInstance) return videoPlayerInstance.muted || false;
        if (pType === 'html5' && player) return player.muted || false;
        return videoPlayerInstance ? (videoPlayerInstance.muted || false) : (player ? (player.muted || false) : false);
      },
      set muted(val) {
        if (pType === 'artplayer' && videoPlayerInstance) videoPlayerInstance.muted = val;
        else if (pType === 'html5' && player) player.muted = val;
        else if (videoPlayerInstance) videoPlayerInstance.muted = val;
        else if (player) player.muted = val;
      },
      get speed() {
        if (pType === 'artplayer' && videoPlayerInstance) return videoPlayerInstance.playbackRate || 1;
        if (pType === 'html5' && player) return player.playbackRate || 1;
        return videoPlayerInstance ? (videoPlayerInstance.speed || 1) : (player ? (player.playbackRate || 1) : 1);
      },
      set speed(val) {
        if (pType === 'artplayer' && videoPlayerInstance) videoPlayerInstance.playbackRate = val;
        else if (pType === 'html5' && player) player.playbackRate = val;
        else if (videoPlayerInstance) videoPlayerInstance.speed = val;
        else if (player) player.playbackRate = val;
      },
      toggleFullscreen() {
        if (pType === 'artplayer' && videoPlayerInstance) {
          videoPlayerInstance.fullscreen = !videoPlayerInstance.fullscreen;
        } else if (pType === 'html5' && player) {
          if (!document.fullscreenElement) {
            player.requestFullscreen().catch(err => console.error(err));
          } else {
            document.exitFullscreen().catch(err => console.error(err));
          }
        } else {
          if (videoPlayerInstance && videoPlayerInstance.fullscreen) {
            videoPlayerInstance.fullscreen.toggle();
          }
        }
      },
      toggleCaptions() {
        if (pType === 'artplayer' && videoPlayerInstance) {
          if (videoPlayerInstance.subtitle) {
            videoPlayerInstance.subtitle.show = !videoPlayerInstance.subtitle.show;
          }
        } else if (pType === 'plyr' && videoPlayerInstance) {
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

function drawSponsorSegmentsOnTimeline(duration, playerType) {
  if (!duration || !currentVideoSponsorSegments || currentVideoSponsorSegments.length === 0) return;

  let container = null;
  if (playerType === 'artplayer') {
    container = document.querySelector('#embedded-artplayer .art-progress');
  } else if (playerType === 'plyr') {
    const inlineContainer = document.getElementById('downloaded-inline-player-container');
    if (inlineContainer && !inlineContainer.classList.contains('hidden')) {
      container = inlineContainer.querySelector('.plyr__progress');
    } else {
      container = document.querySelector('#player-modal .plyr__progress');
    }
  }

  if (!container) return;

  let wrapper = container.querySelector('.player-sponsor-markers-wrapper');
  if (wrapper) {
    wrapper.remove();
  }

  wrapper = document.createElement('div');
  wrapper.className = 'player-sponsor-markers-wrapper';
  wrapper.style.position = 'absolute';
  wrapper.style.left = '0';
  wrapper.style.right = '0';
  wrapper.style.top = '0';
  wrapper.style.bottom = '0';
  wrapper.style.pointerEvents = 'none';
  wrapper.style.zIndex = '5';

  if (playerType === 'artplayer') {
    wrapper.style.height = '100%';
  } else if (playerType === 'plyr') {
    wrapper.style.height = '6px';
    wrapper.style.top = '50%';
    wrapper.style.transform = 'translateY(-50%)';
    wrapper.style.borderRadius = '3px';
    wrapper.style.overflow = 'hidden';
  }

  const categoryColors = {
    sponsor: 'rgba(74, 222, 128, 0.65)',      // Green
    selfpromo: 'rgba(250, 204, 21, 0.65)',     // Yellow
    interaction: 'rgba(56, 189, 248, 0.65)',   // Blue
    intro: 'rgba(45, 212, 191, 0.65)',         // Teal
    outro: 'rgba(192, 132, 252, 0.65)',        // Purple
    preview: 'rgba(244, 63, 94, 0.65)',        // Pink/Red
    music_offtopic: 'rgba(244, 63, 94, 0.65)'
  };

  currentVideoSponsorSegments.forEach(seg => {
    const leftPercent = (seg.start / duration) * 100;
    const widthPercent = ((seg.end - seg.start) / duration) * 100;
    const color = categoryColors[seg.category] || 'rgba(255, 255, 255, 0.5)';

    const marker = document.createElement('div');
    marker.style.position = 'absolute';
    marker.style.left = `${leftPercent}%`;
    marker.style.width = `${widthPercent}%`;
    marker.style.height = '100%';
    marker.style.backgroundColor = color;
    marker.style.pointerEvents = 'none';
    marker.style.borderRadius = playerType === 'plyr' ? '0' : '2px';

    wrapper.appendChild(marker);
  });

  container.appendChild(wrapper);
}

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
      } else {
        inlineWrapper.classList.remove('is-short-player');
      }
      inlineWrapper.style.aspectRatio = ratio;
    }

    if (videoPlayerInstance && typeof videoPlayerInstance.resize === 'function') {
      setTimeout(() => videoPlayerInstance.resize(), 50);
    }
  }
}

async function fetchSponsorSegments(videoId) {
  currentVideoSponsorSegments = [];
  lastSkippedSegmentStart = -1;
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 1500);

  try {
    const categories = '["sponsor","selfpromo","interaction","intro","outro","preview"]';
    const url = `https://sponsor.ajay.app/api/skipSegments?videoID=${videoId}&categories=${encodeURIComponent(categories)}`;
    
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) {
        currentVideoSponsorSegments = data.map(item => ({
          start: item.segment[0],
          end: item.segment[1],
          category: item.category
        }));
        devLog(`[SponsorBlock] Found ${currentVideoSponsorSegments.length} segments:`, currentVideoSponsorSegments);
      }
    }
  } catch (err) {
    clearTimeout(timeoutId);
    devWarn('[SponsorBlock] Failed to fetch segments or request timed out:', err);
  }
}

function updateSponsorBlockStatusUI() {
  const statusEl = document.getElementById('player-sponsorblock-status');
  if (statusEl) statusEl.style.display = 'none';
  const inlineStatusEl = document.getElementById('inline-player-sponsorblock-status');
  if (inlineStatusEl) inlineStatusEl.style.display = 'none';
}

function updateSBToggleButtonUI() {
  const btnSBToggle = document.getElementById('inline-btn-sponsorblock-toggle');
  if (!btnSBToggle) return;

  const lang = (localDb && localDb.settings && localDb.settings.lang) || currentLang || 'tr';
  const t = translations[lang] || translations.tr;

  const isActive = localDb.settings && localDb.settings.sponsorBlockEnabled === true;

  if (!isActive) {
    btnSBToggle.title = t.sponsorblock_disabled || 'SponsorBlock Devre Dışı';
    btnSBToggle.style.color = '#ef4444';
    btnSBToggle.style.background = 'rgba(239, 68, 68, 0.1)';
    btnSBToggle.style.borderColor = 'rgba(239, 68, 68, 0.2)';
    btnSBToggle.innerHTML = '<i data-lucide="shield-off" style="width: 16px; height: 16px;"></i>';
  } else {
    btnSBToggle.title = t.sponsorblock_active || 'SponsorBlock Aktif';
    btnSBToggle.style.color = '#4ade80';
    btnSBToggle.style.background = 'rgba(74, 222, 128, 0.1)';
    btnSBToggle.style.borderColor = 'rgba(74, 222, 128, 0.2)';
    btnSBToggle.innerHTML = '<i data-lucide="shield" style="width: 16px; height: 16px;"></i>';
  }
  try {
    lucide.createIcons();
  } catch (e) {}

  const wrappers = document.querySelectorAll('.player-sponsor-markers-wrapper');
  wrappers.forEach(w => {
    w.style.opacity = '1';
  });
}

function checkAndSkipSponsor(currentTime, videoElementOrPlayer) {
  if (!currentVideoSponsorSegments || currentVideoSponsorSegments.length === 0) return;
  if (!localDb.settings || localDb.settings.sponsorBlockEnabled !== true) return;

  let insideAnySegment = false;
  for (const seg of currentVideoSponsorSegments) {
    if (currentTime >= seg.start && currentTime < (seg.end - 0.1)) {
      insideAnySegment = true;
      if (lastSkippedSegmentStart !== seg.start) {
        lastSkippedSegmentStart = seg.start;
        devLog(`[SponsorBlock] Skipping segment from ${seg.start} to ${seg.end}`);
        showToast(
          currentLang === 'en' 
            ? `Skipped sponsor section (${Math.round(seg.start)}s - ${Math.round(seg.end)}s)` 
            : `Sponsor alanı otomatik atlandı (${Math.round(seg.start)}. sn - ${Math.round(seg.end)}. sn)`, 
          'info'
        );
        videoElementOrPlayer.currentTime = seg.end;
      } else {
        videoElementOrPlayer.currentTime = seg.end;
      }
      break;
    }
  }
  
  if (!insideAnySegment) {
    lastSkippedSegmentStart = -1;
  }
}

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
    const playerType = (localDb.settings && localDb.settings.playerType) || 'plyr';

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

    // Toggle SponsorBlock legend if SponsorBlock is enabled
    const sbLegend = document.getElementById('inline-player-sponsorblock-legend');
    const sbSep = document.getElementById('inline-player-sb-sep');
    if (sbLegend) {
      if (localDb.settings && localDb.settings.sponsorBlockEnabled === true) {
        sbLegend.style.display = 'flex';
        if (sbSep) sbSep.style.display = 'inline';
      } else {
        sbLegend.style.display = 'none';
        if (sbSep) sbSep.style.display = 'none';
      }
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
        btnTranslate.onclick = async () => {
          try {
            const lang = localDb.settings?.lang || currentLang || 'tr';
            const t = translations[lang] || translations.tr;

            // Defensive helper function for language names
            const getLangName = (code) => {
              if (!code) return 'Bilinmeyen Dil / Unknown';
              const map = {
                tr: 'Türkçe (TR)',
                en: 'English (EN)',
                es: 'Español (ES)',
                de: 'Deutsch (DE)',
                pt: 'Português (PT)',
                ar: 'العربية (AR)',
                ru: 'Русский (RU)',
                fr: 'Français (FR)',
                it: 'Italiano (IT)',
                ja: '日本語 (JA)',
                zh: '中文 (ZH)'
              };
              const codeLower = String(code).toLowerCase();
              return map[codeLower] || String(code).toUpperCase();
            };

            // Create Modal element
            const modal = document.createElement('div');
            modal.className = 'modal';
            modal.id = 'translate-sub-modal';
            modal.style.zIndex = '15000';
            
            let modalHtml = `
              <div class="modal-content" style="border-radius: 12px; padding: 24px; box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
                <div class="modal-header">
                  <h3>${t.modal_translate_title || 'Altyazı Çevirisi'}</h3>
                  <button class="modal-close-btn" id="close-translate-modal-btn">
                    <i data-lucide="x" style="width: 18px; height: 18px;"></i>
                  </button>
                </div>
                <div class="modal-body">
            `;

            if (!availableSubtitles || availableSubtitles.length === 0) {
              modalHtml += `
                <div style="text-align: center; padding: 12px; color: var(--accent-red); font-size: 0.9rem;">
                  <i data-lucide="alert-triangle" style="width: 32px; height: 32px; margin-bottom: 8px; stroke: var(--accent-red); display: inline-block;"></i>
                  <div>${t.modal_translate_no_subs || 'Bu video için indirilmiş altyazı bulunamadı. Çeviri yapabilmek için en az bir altyazı dosyası indirilmiş olmalıdır.'}</div>
                </div>
              `;
            } else {
              modalHtml += `
                <div class="form-group" style="margin-bottom: 16px;">
                  <label style="display: block; font-size: 0.85rem; color: var(--text-muted); margin-bottom: 6px;">
                    ${t.modal_translate_source || 'Çevrilecek Altyazı (Kaynak)'}
                  </label>
                  <select id="translate-source-lang" class="custom-select-trigger" style="width: 100%; height: 40px; background: var(--bg-sidebar); border: 1px solid var(--border-color); color: var(--text-main); border-radius: 8px; padding: 0 12px; outline: none; font-size: 0.9rem;">
                    ${availableSubtitles.map(s => {
                      const sLang = s && s.lang ? s.lang : '';
                      const sExt = s && s.ext ? String(s.ext).toUpperCase() : 'SRT';
                      return `<option value="${sLang}">${getLangName(sLang)} (${sExt})</option>`;
                    }).join('')}
                  </select>
                </div>
                <div class="form-group" style="margin-bottom: 24px;">
                  <label style="display: block; font-size: 0.85rem; color: var(--text-muted); margin-bottom: 6px;">
                    ${t.modal_translate_target || 'Hedef Dil'}
                  </label>
                  <select id="translate-target-lang" class="custom-select-trigger" style="width: 100%; height: 40px; background: var(--bg-sidebar); border: 1px solid var(--border-color); color: var(--text-main); border-radius: 8px; padding: 0 12px; outline: none; font-size: 0.9rem;">
                    <option value="tr" ${lang === 'tr' ? 'selected' : ''}>Türkçe (TR)</option>
                    <option value="en" ${lang === 'en' ? 'selected' : ''}>English (EN)</option>
                    <option value="es" ${lang === 'es' ? 'selected' : ''}>Español (ES)</option>
                    <option value="de" ${lang === 'de' ? 'selected' : ''}>Deutsch (DE)</option>
                    <option value="pt" ${lang === 'pt' ? 'selected' : ''}>Português (PT)</option>
                    <option value="ar" ${lang === 'ar' ? 'selected' : ''}>العربية (AR)</option>
                    <option value="ru" ${lang === 'ru' ? 'selected' : ''}>Русский (RU)</option>
                    <option value="fr">Français (FR)</option>
                    <option value="it">Italiano (IT)</option>
                    <option value="ja">日本語 (JA)</option>
                    <option value="zh">中文 (ZH)</option>
                  </select>
                </div>
              `;
            }

            modalHtml += `
                </div>
                <div class="modal-actions" style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 20px;">
                  <button class="btn btn-secondary" id="translate-modal-cancel" style="padding: 8px 16px; border-radius: 8px; font-size: 0.85rem; cursor: pointer; background: rgba(255,255,255,0.05); border: 1px solid var(--border-color); color: var(--text-main);">
                    ${t.modal_cancel_btn || 'İptal'}
                  </button>
                  ${availableSubtitles && availableSubtitles.length > 0 ? `
                    <button class="btn btn-primary" id="translate-modal-submit" style="padding: 8px 20px; border-radius: 8px; font-size: 0.85rem; cursor: pointer; font-weight: 600; background: linear-gradient(135deg, var(--accent-primary), var(--accent-secondary)); color: white; border: none;">
                      ${t.btn_translate_action || 'Çevir'}
                    </button>
                  ` : ''}
                </div>
              </div>
            `;

            modal.innerHTML = modalHtml;
            document.body.appendChild(modal);

            try {
              lucide.createIcons();
            } catch (e) {
              console.warn("Lucide icons rendering failed inside modal:", e);
            }

            const closeModal = () => {
              if (modal && modal.parentNode) {
                modal.parentNode.removeChild(modal);
              }
            };

            const closeBtn = document.getElementById('close-translate-modal-btn');
            if (closeBtn) closeBtn.onclick = closeModal;

            const cancelBtn = document.getElementById('translate-modal-cancel');
            if (cancelBtn) cancelBtn.onclick = closeModal;

            const submitBtn = document.getElementById('translate-modal-submit');
            if (submitBtn) {
              submitBtn.onclick = async () => {
                try {
                  const fromLang = document.getElementById('translate-source-lang').value;
                  const toLang = document.getElementById('translate-target-lang').value;

                  if (fromLang === toLang) {
                    showToast(lang === 'en' ? 'Source and target languages cannot be the same.' : 'Kaynak ve hedef dil aynı olamaz.', 'error');
                    return;
                  }

                  closeModal();

                  btnTranslate.disabled = true;
                  btnTranslate.style.opacity = '0.5';
                  const icon = btnTranslate.querySelector('i');
                  if (icon) icon.style.animation = 'spin 1s linear infinite';

                  // Show Toast for translation start
                  showToast(lang === 'en' ? 'Translating subtitles...' : 'Altyazılar çevriliyor...', 'info');

                  // Create and append visual loading overlay
                  const overlay = document.createElement('div');
                  overlay.className = 'subtitle-translation-overlay';
                  overlay.innerHTML = `
                    <div class="subtitle-translation-spinner"></div>
                    <div style="font-weight: 600; font-size: 1.15rem; margin-bottom: 6px; font-family: 'Outfit', sans-serif;">
                      ${t.overlay_translating_title || 'Altyazı Çeviriliyor...'}
                    </div>
                    <div style="font-size: 0.85rem; opacity: 0.8; color: #a1a1aa; max-width: 80%; text-align: center; line-height: 1.4;">
                      ${t.overlay_translating_desc || 'Lütfen bekleyin, altyazı çevirisi yapılıyor...'}
                    </div>
                  `;
                  const targetContainer = playerContainer || document.getElementById('inline-player-body');
                  if (targetContainer) {
                    targetContainer.appendChild(overlay);
                  }

                  try {
                    const res = await fetch(`/api/video/${videoId}/translate-subtitle`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ fromLang, toLang })
                    });
                    const data = await res.json();
                    if (data.success) {
                      showToast(lang === 'en' ? 'Subtitles successfully translated!' : 'Altyazılar başarıyla çevrildi!', 'success');
                      playVideoEmbedded(videoId, videoPlayerInstance ? videoPlayerInstance.currentTime : null);
                    } else {
                      showToast(data.error || 'Translation failed.', 'error');
                    }
                  } catch (err) {
                    console.error('Subtitle translation error:', err);
                    showToast('Translation error occurred.', 'error');
                  } finally {
                    btnTranslate.disabled = false;
                    btnTranslate.style.opacity = '1';
                    if (icon) icon.style.animation = '';
                    if (overlay && overlay.parentNode) {
                      overlay.parentNode.removeChild(overlay);
                    }
                  }
                } catch (submitErr) {
                  console.error("Submit translation click error:", submitErr);
                  showToast("Hata: " + submitErr.message, "error");
                }
              };
            }
          } catch (clickErr) {
            console.error("Translate click error:", clickErr);
            showToast(localDb.settings?.lang === 'en' ? 'An error occurred while opening the translation tool.' : 'Çeviri aracı açılırken bir hata oluştu.', 'error');
          }
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

    // Subtitle Color & Opacity & Redownload bindings
    const inlineSubColor = document.getElementById('inline-subtitle-color');
    if (inlineSubColor) {
      inlineSubColor.value = (localDb.settings && localDb.settings.subtitleColor) || '#ffffff';
      inlineSubColor.onchange = async (e) => {
        const val = e.target.value;
        localDb.settings.subtitleColor = val;
        document.documentElement.style.setProperty('--subtitle-color', val);
        const globalDropdown = document.getElementById('settings-subtitle-color');
        if (globalDropdown) globalDropdown.value = val;
        
        if (videoPlayerInstance && typeof videoPlayerInstance.subtitle?.style === 'function') {
          videoPlayerInstance.subtitle.style({ color: val });
        }
        
        try {
          await fetch('/api/settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(localDb.settings)
          });
        } catch (err) {
          console.error('subtitleColor save error:', err);
        }
      };
    }

    const inlineSubOpacity = document.getElementById('inline-subtitle-opacity');
    if (inlineSubOpacity) {
      inlineSubOpacity.value = (localDb.settings && localDb.settings.subtitleOpacity) || '0.7';
      inlineSubOpacity.onchange = async (e) => {
        const val = e.target.value;
        localDb.settings.subtitleOpacity = val;
        document.documentElement.style.setProperty('--subtitle-bg-opacity', val);
        
        if (videoPlayerInstance && typeof videoPlayerInstance.subtitle?.style === 'function') {
          videoPlayerInstance.subtitle.style({
            backgroundColor: `rgba(0, 0, 0, ${val})`
          });
        }
        
        try {
          await fetch('/api/settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(localDb.settings)
          });
        } catch (err) {
          console.error('subtitleOpacity save error:', err);
        }
      };
    }

    const inlineSubSize = document.getElementById('inline-subtitle-size');
    if (inlineSubSize) {
      inlineSubSize.value = (localDb.settings && localDb.settings.subtitleSize) || '26px';
      inlineSubSize.onchange = async (e) => {
        const val = e.target.value;
        localDb.settings.subtitleSize = val;
        document.documentElement.style.setProperty('--subtitle-font-size', val);
        
        if (videoPlayerInstance && typeof videoPlayerInstance.subtitle?.style === 'function') {
          videoPlayerInstance.subtitle.style({
            fontSize: val
          });
        }
        
        try {
          await fetch('/api/settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(localDb.settings)
          });
        } catch (err) {
          console.error('subtitleSize save error:', err);
        }
      };
    }

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
      if (playerType === 'artplayer') {
        playerContainer.innerHTML = '<div id="embedded-artplayer" style="width: 100%; height: 100%; display: block; outline: none;"></div>';
      } else {
        const autoplayAttr = (forcePaused === true) ? '' : 'autoplay';
        playerContainer.innerHTML = `<video id="embedded-video-player" controls ${autoplayAttr} style="width: 100%; height: 100%; display: block; outline: none;"></video>`;
      }
    }

    if (playerType === 'artplayer' && typeof Artplayer !== 'undefined') {
      let artHighlight = [];
      if (localDb.settings && localDb.settings.sponsorBlockEnabled === true) {
        artHighlight = currentVideoSponsorSegments.map(seg => ({
          time: seg.start,
          text: localDb.settings.lang === 'en' ? `Sponsor Block (${seg.category})` : `Sponsor Alanı (${seg.category})`
        }));
      }

      let defaultSubtitle = null;
      if (availableSubtitles && availableSubtitles.length > 0) {
        defaultSubtitle = availableSubtitles.find(s => s.lang === 'tr') || 
                          availableSubtitles.find(s => s.lang === 'en') || 
                          availableSubtitles[0];
      }

      const artSettings = [];
      if (availableSubtitles && availableSubtitles.length > 0) {
        const isEn = localDb.settings?.lang === 'en';
        const subtitleSelector = [
          {
            default: !defaultSubtitle,
            html: isEn ? 'Off' : 'Kapalı',
            url: ''
          }
        ];
        
        availableSubtitles.forEach(sub => {
          subtitleSelector.push({
            default: defaultSubtitle && defaultSubtitle.lang === sub.lang,
            html: sub.label,
            url: sub.url
          });
        });

        artSettings.push({
          width: 200,
          html: isEn ? 'Subtitle' : 'Altyazı',
          tooltip: defaultSubtitle ? defaultSubtitle.label : (isEn ? 'Off' : 'Kapalı'),
          selector: subtitleSelector,
          onSelect: function (item) {
            if (item.url) {
              videoPlayerInstance.subtitle.show = true;
              videoPlayerInstance.subtitle.url = item.url;
            } else {
              videoPlayerInstance.subtitle.show = false;
            }
            return item.html;
          }
        });
      }

      // Altyazı Rengi Ayarı
      const artIsEn = localDb.settings?.lang === 'en';
      const colors = [
        { value: '#ffffff', nameEn: 'White', nameTr: 'Beyaz' },
        { value: '#ffff00', nameEn: 'Yellow', nameTr: 'Sarı' },
        { value: '#00ff00', nameEn: 'Green', nameTr: 'Yeşil' },
        { value: '#00ffff', nameEn: 'Cyan', nameTr: 'Turkuaz' },
        { value: '#ff00ff', nameEn: 'Pink', nameTr: 'Pembe' },
        { value: '#ff0000', nameEn: 'Red', nameTr: 'Kırmızı' },
        { value: '#0000ff', nameEn: 'Blue', nameTr: 'Mavi' },
        { value: '#ffa500', nameEn: 'Orange', nameTr: 'Turuncu' },
        { value: '#800080', nameEn: 'Purple', nameTr: 'Mor' },
        { value: '#000000', nameEn: 'Black', nameTr: 'Siyah' },
        { value: '#808080', nameEn: 'Gray', nameTr: 'Gri' },
        { value: '#ffffe0', nameEn: 'Light Yellow', nameTr: 'Açık Sarı' }
      ];
      
      const currentColor = (localDb.settings && localDb.settings.subtitleColor) || '#ffffff';
      const colorSelector = colors.map(c => ({
        default: currentColor === c.value,
        html: artIsEn ? c.nameEn : c.nameTr,
        value: c.value
      }));

      artSettings.push({
        width: 200,
        html: artIsEn ? 'Subtitle Color' : 'Altyazı Rengi',
        tooltip: artIsEn 
          ? (colors.find(c => c.value === currentColor)?.nameEn || 'White')
          : (colors.find(c => c.value === currentColor)?.nameTr || 'Beyaz'),
        selector: colorSelector,
        onSelect: function (item) {
          if (videoPlayerInstance && videoPlayerInstance.subtitle) {
            videoPlayerInstance.subtitle.style({
              color: item.value,
              textShadow: '0 0 4px #000000'
            });
          }
          if (localDb && localDb.settings) {
            localDb.settings.subtitleColor = item.value;
            const selectEl = document.getElementById('settings-subtitle-color');
            if (selectEl) selectEl.value = item.value;
            
            // Arka planda ayarları kaydet
            fetch('/api/settings', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ ...localDb.settings, subtitleColor: item.value })
            })
            .catch(err => console.error(err));
          }
          return item.html;
        }
      });

      videoPlayerInstance = new Artplayer({
        container: '#embedded-artplayer',
        url: streamUrl,
        autoplay: forcePaused === true ? false : true,
        autoSize: false,
        autoMini: false,
        playbackRate: true,
        aspectRatio: true,
        setting: true,
        hotkey: false,
        pip: true,
        fullscreen: true,
        mutex: true,
        theme: '#ff0055',
        highlight: artHighlight,
        subtitle: defaultSubtitle ? {
          url: defaultSubtitle.url,
          type: 'vtt',
          style: {
            color: (localDb.settings && localDb.settings.subtitleColor) || '#ffffff',
            backgroundColor: `rgba(0, 0, 0, ${(localDb.settings && localDb.settings.subtitleOpacity) || '0.7'})`,
            fontSize: (localDb.settings && localDb.settings.subtitleSize) || '26px',
            textShadow: '0 0 4px #000000',
          },
        } : undefined,
        settings: artSettings
      });

      if (playerResizeObserver) {
        playerResizeObserver.disconnect();
      }
      playerResizeObserver = new ResizeObserver(() => {
        if (videoPlayerInstance && typeof videoPlayerInstance.resize === 'function') {
          videoPlayerInstance.resize();
        }
      });
      playerResizeObserver.observe(playerContainer);

      // Volume wheel control
      const artContainer = document.getElementById('embedded-artplayer');
      if (artContainer) {
        artContainer.addEventListener('wheel', (e) => {
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
      }

      videoPlayerInstance.on('ready', () => {
        const rawVideo = videoPlayerInstance.video;
        if (rawVideo) {
          rawVideo.addEventListener('play', () => sendPlayerActivity(true));
          rawVideo.addEventListener('pause', () => {
            // Kullanıcı talebi: Video duraklatıldığında da Discord etkinliği devam etsin
            autoSyncWatchtimeHelper(currentPlayingVideoId, rawVideo.currentTime, true);
            window.savePlaybackPosition(currentPlayingVideoId, rawVideo.currentTime, rawVideo.duration, true);
          });
          rawVideo.addEventListener('ended', () => {
            sendPlayerActivity(false);
            autoSyncWatchtimeHelper(currentPlayingVideoId, rawVideo.currentTime, true);
            window.savePlaybackPosition(currentPlayingVideoId, 0, rawVideo.duration, true);
          });
          adjustPlayerOrientation(rawVideo);
          if (rawVideo.duration) {
            drawSponsorSegmentsOnTimeline(rawVideo.duration, 'artplayer');
          }
          rawVideo.addEventListener('loadedmetadata', () => {
            adjustPlayerOrientation(rawVideo);
            drawSponsorSegmentsOnTimeline(rawVideo.duration, 'artplayer');
          });

          rawVideo.addEventListener('timeupdate', () => {
            if (!currentPlayingVideoId) return;
            const currentTime = rawVideo.currentTime;

            if (localDb.settings && localDb.settings.sponsorBlockEnabled === true) {
              checkAndSkipSponsor(currentTime, rawVideo);
            }

            // Periyodik (her 30sn) YouTube izleme süresi senkronizasyonu
            autoSyncWatchtimeHelper(currentPlayingVideoId, currentTime, false);

            // Yerel kaldığı yer kaydı
            window.savePlaybackPosition(currentPlayingVideoId, currentTime, rawVideo.duration, false);
          });

          if (!seekedForCurrentVideo && currentPlayingVideoId) {
            const item = (localDb.history || []).find(h => h.id === currentPlayingVideoId);
            const targetTime = (startSeconds !== null) ? startSeconds : (item?.lastPositionSeconds || (JSON.parse(localStorage.getItem('haytool_playback_resume') || '{}')[currentPlayingVideoId] || 0));
            if (targetTime > 3) {
              rawVideo.currentTime = targetTime;
              window.showResumeNotification(targetTime);
            }
            seekedForCurrentVideo = true;
          }
          if (forcePaused === true) {
            videoPlayerInstance.pause();
          } else if (forcePaused === false) {
            videoPlayerInstance.play().catch(e => console.warn(e));
          }
          
          rawVideo.addEventListener('ended', () => {
            const isAutoplayEnabled = localStorage.getItem('inline-autoplay-enabled') === 'true';
            if (isAutoplayEnabled) {
              playNextVideoInPlaylist();
            }
          });
        }
      });

    } else {
      const player = document.getElementById('embedded-video-player');
      if (player) {
        // Clear old track tags
        const oldTracks = player.querySelectorAll('track');
        oldTracks.forEach(t => t.remove());

        // Add track tags if available
        if (availableSubtitles && availableSubtitles.length > 0) {
          availableSubtitles.forEach(sub => {
            const track = document.createElement('track');
            track.kind = 'subtitles';
            track.label = sub.label;
            track.srclang = sub.lang;
            track.src = sub.url;
            
            const isDefault = (sub.lang === 'tr' && availableSubtitles.some(s => s.lang === 'tr')) ||
                              (sub.lang === 'en' && !availableSubtitles.some(s => s.lang === 'tr') && sub.lang === 'en') ||
                              (!availableSubtitles.some(s => s.lang === 'tr' || s.lang === 'en') && sub === availableSubtitles[0]);
            
            if (isDefault) {
              track.default = true;
            }
            player.appendChild(track);
          });
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

          // Volume wheel control
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
 * Belirtilen videonun YouTube sayfasını yeni tarayıcı sekmesinde açar.
 * 
 * @param {string} videoId Açılacak video ID'si
 */
window.openYouTube = async function(videoId) {
  try {
    await fetch('/api/open-youtube', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ videoId })
    });
  } catch (err) {
    window.open(`https://www.youtube.com/watch?v=${videoId}`, '_blank');
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

    const state = {
      channel: channelSelect ? channelSelect.value : 'all',
      sortVal: typeof downloadedSortVal !== 'undefined' ? downloadedSortVal : 'date-desc',
      showShorts: showShortsCb ? showShortsCb.checked : false,
      viewMode: typeof downloadedViewMode !== 'undefined' ? downloadedViewMode : 'grid',
      onlyResume: typeof downloadedOnlyPartiallyWatched !== 'undefined' ? !!downloadedOnlyPartiallyWatched : false
    };

    localStorage.setItem('haytool_downloaded_filters_v2', JSON.stringify(state));
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

    const raw = localStorage.getItem('haytool_downloaded_filters_v2');
    if (!raw) return;
    const state = JSON.parse(raw);

    const channelSelect = document.getElementById('downloaded-channel-filter');
    if (channelSelect && state.channel) {
      channelSelect.value = state.channel;
      window.downloadedFilterChannel = state.channel;
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

    if (state.onlyResume !== undefined) {
      downloadedOnlyPartiallyWatched = !!state.onlyResume;
      window.downloadedOnlyPartiallyWatched = downloadedOnlyPartiallyWatched;
      const resumeBtn = document.getElementById('downloaded-filter-resume-btn');
      if (resumeBtn) {
        resumeBtn.classList.toggle('active', downloadedOnlyPartiallyWatched);
      }
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

// Türkçe Açıklama: Devam eden veya kuyrukta bekleyen bir indirme işlemini durdurup iptal etmesi için backend API'sine istek yollar.
/**
 * Devam etmekte olan aktif bir video indirme işlemini iptal eder.
 * 
 * @param {string} videoId İptal edilecek video ID'si
 */
window.cancelDownload = async function(videoId) {
  if (!confirm('Bu indirme işlemini iptal etmek istediğinizden emin misiniz?')) return;
  
  try {
    showToast('İndirme iptal ediliyor...', 'info');
    const res = await fetch('/api/cancel-download', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ videoId })
    });
    const data = await res.json();
    if (data.success) {
      // Başarı durumunda sunucu bildirim gönderecektir
    } else {
      showToast(data.error || 'İptal işlemi başarısız oldu.', 'error');
    }
  } catch (err) {
    showToast('Sunucu ile iletişim hatası.', 'error');
  }
};

/**
 * Tüm aktif ve kuyruktaki indirmeleri iptal eder.
 */
window.cancelAllDownloads = async function() {
  if (!confirm('Tüm aktif ve kuyruktaki indirmeleri iptal etmek istediğinize emin misiniz?')) return;
  
  try {
    showToast('Tüm indirmeler iptal ediliyor...', 'info');
    const res = await fetch('/api/cancel-all-downloads', {
      method: 'POST'
    });
    const data = await res.json();
    if (data.success) {
      showToast('Tüm indirmeler iptal edildi.', 'success');
    } else {
      showToast(data.error || 'İptal işlemi başarısız oldu.', 'error');
    }
  } catch (err) {
    showToast('Sunucu ile iletişim hatası.', 'error');
  }
};

/**
 * İndirme kuyruğunda (sırasında) bekleyen bir videoyu sıradan çıkarır.
 * 
 * @param {string} videoId Sıradan çıkarılacak video ID'si
 */
window.cancelQueuedVideo = async function(videoId) {
  try {
    showToast('Sıradan çıkarılıyor...', 'info');
    const res = await fetch('/api/cancel-download', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ videoId })
    });
    const data = await res.json();
    if (data.success) {
      // Başarı durumunda sunucu bildirim gönderecektir (SSE ile)
    } else {
      showToast(data.error || 'İptal işlemi başarısız oldu.', 'error');
    }
  } catch (err) {
    showToast('Sunucu ile iletişim hatası.', 'error');
  }
};

window.cancelAllQueued = async function() {
  const isEn = localDb.settings && localDb.settings.lang === 'en';
  if (!confirm(isEn ? 'Are you sure you want to cancel all queued videos?' : 'Kuyruktaki tüm videoları iptal etmek istediğinizden emin misiniz?')) return;
  
  try {
    showToast(isEn ? 'Cancelling all queued videos...' : 'Tüm kuyruk iptal ediliyor...', 'info');
    const res = await fetch('/api/cancel-all-queued', { method: 'POST' });
    const data = await res.json();
    if (data.success) {
      // Server broadcasts update
    } else {
      showToast(data.error || (isEn ? 'Cancel failed.' : 'İptal işlemi başarısız oldu.'), 'error');
    }
  } catch (err) {
    showToast(isEn ? 'Communication error.' : 'Sunucu ile iletişim hatası.', 'error');
  }
};

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

// Türkçe Açıklama: İndirme yapılan disk bölümündeki boş alan miktarı ile indirme klasörünün toplam boyutunu API'den sorgulayarak sağ üst köşedeki durum çubuğuna yansıtır.
/**
 * Disk boş alanını ve indirme klasörü boyutunu sunucudan çekip durum çubuğunu günceller.
 * 
 * @returns {Promise<void>}
 */
async function updateDiskSpace() {
  const diskStatusFree = document.getElementById('disk-status-free');
  const diskStatusFolder = document.getElementById('disk-status-folder');
  if (!diskStatusFree) return;
  
  try {
    const res = await fetch('/api/disk-space');
    const data = await res.json();
    if (data.success) {
      const freeGB = Math.round(data.freeBytes / (1024 * 1024 * 1024));
      const totalGB = Math.round(data.totalBytes / (1024 * 1024 * 1024));
      const folderGB = Math.round(data.folderSizeBytes / (1024 * 1024 * 1024));
      
      const isEn = localDb.settings && localDb.settings.lang === 'en';
      diskStatusFree.textContent = `${freeGB} GB`;
      if (diskStatusFolder) {
        diskStatusFolder.textContent = `${folderGB} GB`;
      }
      
      diskStatusFree.title = isEn 
        ? `Drive Free Space: ${freeGB} GB / Total: ${totalGB} GB (${data.driveLetter}:)`
        : `Sürücü Boş Alanı: ${freeGB} GB / Toplam: ${totalGB} GB (${data.driveLetter}:)`;
      if (diskStatusFolder) {
        diskStatusFolder.title = isEn
          ? `Main Download Folder Total Size: ${folderGB} GB`
          : `Ana İndirme Klasörü Toplam Boyutu: ${folderGB} GB`;
      }
    } else {
      const isEn = localDb.settings && localDb.settings.lang === 'en';
      diskStatusFree.textContent = isEn ? 'Unknown' : 'Bilinmiyor';
      if (diskStatusFolder) diskStatusFolder.textContent = isEn ? 'Unknown' : 'Bilinmiyor';
    }
  } catch (err) {
    const isEn = localDb.settings && localDb.settings.lang === 'en';
    diskStatusFree.textContent = isEn ? 'Error' : 'Hata';
    if (diskStatusFolder) diskStatusFolder.textContent = isEn ? 'Error' : 'Hata';
  }
}

// Türkçe Açıklama: Üst bardaki hava durumu rozetini ve detay popover kartını API'den çekilen anlık verilerle günceller.
/**
 * Hava durumu bilgilerini /api/weather üzerinden sorgular, üst bardaki rozete ve popover kartına yansıtır.
 * 
 * @param {boolean} [force=false] Önbelleği atlayarak taze veri isteği
 * @returns {Promise<void>}
 */
async function updateWeatherBadge(force = false) {
  const badge = document.getElementById('badge-weather');
  const display = document.getElementById('weather-display');
  const iconEl = document.getElementById('weather-icon');
  const cityLabel = document.getElementById('weather-city-display');
  if (!badge || !display) return;

  if (localDb.settings && localDb.settings.weatherEnabled === false) {
    badge.style.display = 'none';
    return;
  }
  badge.style.display = 'inline-flex';

  try {
    const res = await fetch(`/api/weather${force ? '?force=true' : ''}`);
    const data = await res.json();
    if (data.success && data.enabled !== false) {
      display.textContent = `${data.temp}${data.unit}`;
      
      // Badge üzerinde şehir adı göster (max 12 karakter)
      if (cityLabel && data.city) {
        const shortCity = data.city.length > 12 ? data.city.substring(0, 11) + '…' : data.city;
        cityLabel.textContent = shortCity;
      }
      
      if (iconEl) {
        iconEl.setAttribute('data-lucide', data.icon || 'sun');
        lucide.createIcons();
      }

      const langKey = data.descKey || 'weather_partly_cloudy';
      const t = (typeof i18n !== 'undefined' && i18n.t) ? i18n.t.bind(i18n) : null;
      const desc = t ? t(langKey) : data.defaultDesc;
      const feelsLikeLabel = t ? t('weather_feels_like') : 'Hissedilen';
      const humidityLabel = t ? t('weather_humidity') : 'Nem';
      const windLabel = t ? t('weather_wind') : 'Rüzgar';
      const precipLabel = t ? t('weather_precipitation') : 'Yağış İhtimali';
      const refreshLabel = t ? t('weather_click_refresh') : 'Çift tıklayarak yenileyin';
      const precipProb = data.precipitationProbability !== undefined ? data.precipitationProbability : 0;

      // Üst bardaki doğrudan yağış ihtimali rozetini güncelle
      const badgePrecipVal = document.getElementById('weather-precip-val');
      const badgePrecipWrapper = document.getElementById('weather-precip-badge');
      if (badgePrecipVal) {
        badgePrecipVal.textContent = `%${precipProb}`;
      }
      if (badgePrecipWrapper) {
        badgePrecipWrapper.title = `${precipLabel}: %${precipProb}`;
      }

      badge.title = `${data.city}: ${desc} (${data.temp}${data.unit}, ${precipLabel}: %${precipProb})`;

      // Ayarlar sekmesindeki ipucu metnini güncelle
      const usageTipEl = document.getElementById('desc-weather-usage-tip');
      if (usageTipEl && t && t('weather_usage_tip')) {
        usageTipEl.innerHTML = t('weather_usage_tip');
      }

      // Popover kartını güncelle
      const popTemp = document.getElementById('weather-popover-temp');
      const popDesc = document.getElementById('weather-popover-desc');
      const popCity = document.getElementById('weather-popover-city');
      const popFeels = document.getElementById('weather-popover-feels');
      const popHumidity = document.getElementById('weather-popover-humidity');
      const popWind = document.getElementById('weather-popover-wind');
      const popPrecip = document.getElementById('weather-popover-precip');
      const popFeelsLabel = document.getElementById('weather-popover-feels-label');
      const popHumidityLabel = document.getElementById('weather-popover-humidity-label');
      const popWindLabel = document.getElementById('weather-popover-wind-label');
      const popPrecipLabel = document.getElementById('weather-popover-precip-label');
      const popRefreshText = document.getElementById('weather-popover-refresh-text');
      const popIcon = document.getElementById('weather-popover-icon');

      if (popTemp) popTemp.textContent = `${data.temp}${data.unit}`;
      if (popDesc) popDesc.textContent = desc;
      if (popCity) popCity.textContent = data.city || '--';
      if (popFeels) popFeels.textContent = `${data.feelsLike}${data.unit}`;
      if (popHumidity) popHumidity.textContent = `%${data.humidity}`;
      if (popWind) popWind.textContent = `${data.windSpeed} km/s`;
      if (popPrecip) popPrecip.textContent = `%${precipProb}`;
      if (popFeelsLabel) popFeelsLabel.textContent = feelsLikeLabel;
      if (popHumidityLabel) popHumidityLabel.textContent = humidityLabel;
      if (popWindLabel) popWindLabel.textContent = windLabel;
      if (popPrecipLabel) popPrecipLabel.textContent = precipLabel;
      if (popRefreshText) popRefreshText.textContent = refreshLabel;
      if (popIcon) {
        popIcon.setAttribute('data-lucide', data.icon || 'sun');
      }

      // İkonları render et
      if (typeof lucide !== 'undefined' && lucide.createIcons) {
        lucide.createIcons();
      }

      // Popover olay dinleyicilerini garantiye al
      initWeatherPopoverEvents();
    } else if (data.enabled === false) {
      badge.style.display = 'none';
    } else {
      display.textContent = '--°';
    }
  } catch (err) {
    display.textContent = '--°';
  }
}

// Türkçe Açıklama: Hava durumu rozeti tıklama ve popover aç/kapa/yenile mantığını kurar
function initWeatherPopoverEvents() {
  const badgeWeather = document.getElementById('badge-weather');
  const weatherPopover = document.getElementById('weather-popover');

  if (!badgeWeather || !weatherPopover) return;
  if (badgeWeather._popoverInitialized) return;
  badgeWeather._popoverInitialized = true;

  // Sol tık: popover aç/kapa
  badgeWeather.addEventListener('click', (e) => {
    // Popover içindeki tıklamalarda badge açma-kapama tetiklenmesin
    if (weatherPopover.contains(e.target)) return;

    e.stopPropagation();
    const isActive = weatherPopover.classList.contains('active');
    if (isActive) {
      weatherPopover.classList.remove('active');
    } else {
      weatherPopover.classList.add('active');
      lucide.createIcons();
    }
  });

  // Popover içi tıklama: yayılmayı durdur
  weatherPopover.addEventListener('click', (e) => {
    e.stopPropagation();
  });

  // Dışarı tıklayınca popover'ı kapat
  document.addEventListener('click', (e) => {
    if (!badgeWeather.contains(e.target)) {
      weatherPopover.classList.remove('active');
    }
  });

  // Çift tıklama: veriyi yenile
  badgeWeather.addEventListener('dblclick', async (e) => {
    e.stopPropagation();
    showToast('Hava durumu güncelleniyor...', 'info');
    await updateWeatherBadge(true);
    showToast('Hava durumu güncellendi.', 'success');
  });
}

if (document.readyState !== 'loading') {
  initWeatherPopoverEvents();
}

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

// Türkçe Açıklama: Kanal ekleme kutusundaki arama sorgusunu alarak YouTube'da arama yapar ve sonuçları kart yapısında listeler.
/**
 * YouTube kanal arama işlemini tetikler ve arayüzde sonuçları gösterir.
 */
window.triggerChannelSearch = async function() {
  const inputEl = document.getElementById('channel-input');
  if (!inputEl) return;
  
  const query = inputEl.value.trim();
  const isEn = localDb.settings && localDb.settings.lang === 'en';
  
  if (!query) {
    showToast(isEn ? 'Please enter a search query.' : 'Lütfen aramak için bir metin girin.', 'error');
    return;
  }
  
  // Eğer girilen değer bir URL ise doğrudan eklemeyi önerebilir veya aramayı durdurabiliriz
  if (query.startsWith('http') || query.includes('youtube.com') || query.includes('youtu.be')) {
    showToast(isEn ? 'This is a URL. Please click "Follow Channel" button instead.' : 'Bu bir adres. Lütfen "Kanalı Takip Et" butonunu kullanın.', 'info');
    return;
  }
  
  const resultsContainer = document.getElementById('channel-search-results');
  const resultsList = document.getElementById('search-results-list');
  const searchBtn = document.getElementById('search-channel-btn');
  
  if (!resultsContainer || !resultsList) return;
  
  try {
    if (searchBtn) searchBtn.disabled = true;
    showToast(isEn ? 'Searching channels on YouTube...' : 'YouTube üzerinde kanallar aranıyor...', 'info');
    
    const res = await fetch(`/api/channels/search?q=${encodeURIComponent(query)}`);
    const data = await res.json();
    
    resultsList.innerHTML = '';
    
    if (data && data.length > 0) {
      data.forEach(channel => {
        const item = document.createElement('div');
        item.className = 'channel-item card';
        item.style.display = 'flex';
        item.style.justifyContent = 'space-between';
        item.style.alignItems = 'center';
        item.style.padding = '10px 15px';
        item.style.background = 'var(--bg-card-hover)';
        item.style.border = '1px solid var(--border-color)';
        item.style.borderRadius = '6px';
        
        // Kanala daha önce ekli mi kontrolü
        const isFollowed = localDb.channels.some(c => c.id === channel.id);
        
        item.innerHTML = `
          <div style="display:flex; align-items:center; gap:12px;">
            <img src="${channel.avatar || '/api/channels/' + channel.id + '/avatar'}" style="width:40px; height:40px; border-radius:50%; object-fit:cover; border:1px solid var(--border-color);" onerror="this.src='https://www.youtube.com/s/desktop/9c83acbb/img/avatar_placeholder_40.png'">
            <div>
              <div style="font-weight:600; color:var(--text-color);">${channel.name}</div>
              <div style="font-size:0.8rem; color:var(--text-muted);">${channel.handle} • ${channel.subscribers}</div>
            </div>
          </div>
          <div>
            ${isFollowed 
              ? `<button class="btn btn-secondary btn-sm" disabled style="opacity: 0.6;">${isEn ? 'Following' : 'Takip Ediliyor'}</button>`
              : `<button class="btn btn-primary btn-sm" onclick="followChannelFromSearch('${channel.id}', '${channel.name.replace(/'/g, "\\'")}', '${channel.handle}', '${channel.avatar}')">${isEn ? 'Follow' : 'Takip Et'}</button>`
            }
          </div>
        `;
        resultsList.appendChild(item);
      });
      resultsContainer.style.display = 'block';
      showToast(isEn ? 'Search completed.' : 'Arama tamamlandı.', 'success');
    } else {
      resultsList.innerHTML = `<div style="text-align:center; padding:15px; color:var(--text-muted);">${isEn ? 'No channels found.' : 'Kanal bulunamadı.'}</div>`;
      resultsContainer.style.display = 'block';
      showToast(isEn ? 'No results found.' : 'Sonuç bulunamadı.', 'warning');
    }
  } catch (err) {
    showToast(isEn ? 'Search error.' : 'Arama sırasında hata oluştu.', 'error');
  } finally {
    if (searchBtn) searchBtn.disabled = false;
  }
};

// Türkçe Açıklama: YouTube arama sonuçları panelini kapatarak görünürlüğünü gizler.
/**
 * Arama sonuçları panelini kapatır.
 */
window.closeChannelSearchResults = function() {
  const resultsContainer = document.getElementById('channel-search-results');
  if (resultsContainer) {
    resultsContainer.style.display = 'none';
  }
};

// Türkçe Açıklama: Arama sonuçlarındaki kanalı backend'e isim, handle, avatar ve ID ile hızlıca takip listesine eklemek üzere gönderir.
/**
 * Arama sonuçlarındaki bir kanalı takip listesine ekler.
 * 
 * @param {string} id Kanal ID'si
 * @param {string} name Kanal adı
 * @param {string} handle Kanal handle adı (@ ile başlayan)
 * @param {string} avatar Kanal profil resmi URL'si
 */
window.followChannelFromSearch = async function(id, name, handle, avatar) {
  const isEn = localDb.settings && localDb.settings.lang === 'en';
  try {
    showToast(isEn ? 'Following channel...' : 'Kanal takibe alınıyor...', 'info');
    const res = await fetch('/api/channels', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        input: id, 
        name: name,
        handle: handle,
        avatar: avatar,
        downloadShorts: false 
      })
    });
    const data = await res.json();
    if (data.success) {
      showToast(isEn ? `Following ${name}!` : `"${name}" başarıyla takibe alındı!`, 'success');
      closeChannelSearchResults();
    } else {
      showToast(data.error || 'Hata oluştu.', 'error');
    }
  } catch (err) {
    showToast(isEn ? 'Connection error.' : 'Bağlantı hatası.', 'error');
  }
};

// getChannelActiveFilters → db-renderer.js window.getChannelActiveFilters


/**
 * Kanallar sekmesindeki Kategori filtresi dropdown seçeneklerini dinamik olarak günceller.
 * 
 * @param {Array<object>} categories Kategori listesi
 * @param {Array<object>} channels Kanal listesi
 * @param {string} lang Geçerli dil kodu
 */
export function updateChannelCategoryFilterOptions(categories = [], channels = [], lang = 'tr') {
  const select = document.getElementById('filter-channel-category');
  if (!select) return;

  // Kullanıcı o an dropdown ile etkileşimdeyse veya liste açıkken seçenekleri bozma
  if (document.activeElement === select) return;

  const t = translations[lang] || translations.tr || {};
  const currentVal = select.value || 'all';

  const getCatName = (cat) => getCatTranslatedName(cat, t);

  const safeEscape = (str) => String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  // Kategorilere göre kanal sayılarını hesapla
  const catCountMap = {};
  let uncategorizedCount = 0;

  (channels || []).forEach(ch => {
    const ids = (ch.categoryIds && ch.categoryIds.length > 0)
      ? ch.categoryIds.map(Number)
      : (ch.categoryId !== undefined ? [Number(ch.categoryId)] : [1]);
    
    if (ids.length === 0 || (ids.length === 1 && ids[0] === 1)) {
      uncategorizedCount++;
    }
    ids.forEach(id => {
      catCountMap[id] = (catCountMap[id] || 0) + 1;
    });
  });

  const sortedCats = [...(categories || [])].sort((a, b) => {
    if (a.id === 1) return -1;
    if (b.id === 1) return 1;
    const nameA = getCatName(a);
    const nameB = getCatName(b);
    return nameA.localeCompare(nameB, 'tr', { sensitivity: 'base' });
  });

  const allLabel = t.opt_filter_category_all || 'Tüm Kategoriler';
  const noneLabel = t.opt_filter_category_none || 'Atanmamış / Kategorisiz';

  let html = `<option value="all">${safeEscape(allLabel)} (${channels.length})</option>`;

  sortedCats.forEach(cat => {
    const cName = getCatName(cat);
    const count = catCountMap[cat.id] || 0;
    html += `<option value="${cat.id}">${safeEscape(cName)} (${count})</option>`;
  });

  if (uncategorizedCount > 0) {
    html += `<option value="uncategorized">${safeEscape(noneLabel)} (${uncategorizedCount})</option>`;
  }

  // Sadece içerik değişmişse DOM'a uygula
  if (select.dataset.renderedHtml !== html) {
    select.innerHTML = html;
    select.dataset.renderedHtml = html;
    const hasCurrentVal = [...select.options].some(o => o.value === currentVal);
    select.value = hasCurrentVal ? currentVal : 'all';
  }
}
window.updateChannelCategoryFilterOptions = updateChannelCategoryFilterOptions;

/**
 * Kanallar sekmesinde arama veya filtreler değiştiğinde kanal listesini anlık yeniden render eder.
 */
export function handleChannelFilterChange() {
  if (!window.localDb || !window.localDb.channels) return;
  const channelsList = document.getElementById('channels-list');
  if (!channelsList) return;
  const lang = (window.localDb.settings && window.localDb.settings.lang) || currentLang || 'tr';
  const t = translations[lang] || translations.tr;
  const filters = getChannelActiveFilters();
  const sigHelper = typeof getChannelsRenderSignature === 'function' ? getChannelsRenderSignature : (window.getChannelsRenderSignature || (() => ''));
  window._lastChannelsRenderSignature = sigHelper(window.localDb.channels, window.localDb.categories, filters, lang);
  renderChannelsList(channelsList, window.localDb.channels, t, window.localDb.categories, filters);
  try {
    if (typeof lucide !== 'undefined' && lucide.createIcons) {
      lucide.createIcons();
    }
  } catch (e) {}
}
window.handleChannelFilterChange = handleChannelFilterChange;

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

let dragSrcEl = null;

// Türkçe Açıklama: Kuyruk sekmesinin görünüm modunu (table veya cards) değiştirir, buton durumunu günceller, ayarları INI'ye kaydeder ve listeyi yeniden çizer.
/**
 * Kuyruk sekmesi görünüm modunu ayarlar.
 * 
 * @param {'table' | 'cards'} mode Seçilen görünüm modu
 */
window.setQueueViewMode = function(mode) {
  if (mode !== 'table' && mode !== 'cards') mode = 'table';
  
  const tableBtn = document.getElementById('queue-view-table-btn');
  const cardsBtn = document.getElementById('queue-view-cards-btn');
  if (tableBtn && cardsBtn) {
    tableBtn.classList.toggle('active', mode === 'table');
    cardsBtn.classList.toggle('active', mode === 'cards');
  }

  if (window.localDb && window.localDb.settings) {
    window.localDb.settings.queueViewMode = mode;
  }

  localStorage.setItem('haytool_queue_view_mode', mode);

  // Arayüzü güncelle
  if (window.localDb) {
    updateUI(window.localDb);
  }

  try {
    if (typeof lucide !== 'undefined') {
      lucide.createIcons();
    }
  } catch (e) {}

  // Ayarları backend ve config.ini'ye kaydet
  fetch('/api/settings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...(window.localDb ? window.localDb.settings : {}), queueViewMode: mode })
  }).catch(err => console.error('Error saving queueViewMode:', err));
};

// Türkçe Açıklama: Kuyruktaki bir videonun sırasını yukarı veya aşağı yönde bir basamak kaydırır ve sunucuya bildirir.
// Türkçe Açıklama: Kuyruk listesindeki videoyu en başa, bir yukarı, bir aşağı veya en sona taşır.
/**
 * Kuyruk listesindeki videoyu taşır.
 * 
 * @param {string} videoId Taşınacak videonun ID'si
 * @param {'top' | 'up' | 'down' | 'bottom'} direction Taşıma yönü
 */
window.moveQueueItem = function(videoId, direction) {
  const list = document.getElementById('queue-list');
  if (!list) return;

  const items = Array.from(list.querySelectorAll('[data-id]'));
  const currentIndex = items.findIndex(el => el.getAttribute('data-id') === videoId);
  if (currentIndex === -1) return;

  const currentEl = items[currentIndex];

  // Birleştirme (merging) durumundaki video taşınamaz
  if (currentEl.classList.contains('queue-item-merging')) {
    return;
  }

  if (direction === 'top') {
    const firstMovableIndex = items.findIndex(el => !el.classList.contains('queue-item-merging'));
    if (firstMovableIndex === -1 || currentIndex <= firstMovableIndex) return;
    const firstMovableEl = items[firstMovableIndex];
    list.insertBefore(currentEl, firstMovableEl);
  } else if (direction === 'bottom') {
    if (currentIndex >= items.length - 1) return;
    list.appendChild(currentEl);
  } else if (direction === 'up') {
    const targetIndex = currentIndex - 1;
    if (targetIndex < 0) return;
    const targetEl = items[targetIndex];
    if (targetEl.classList.contains('queue-item-merging')) return;
    list.insertBefore(currentEl, targetEl);
  } else if (direction === 'down') {
    const targetIndex = currentIndex + 1;
    if (targetIndex >= items.length) return;
    const targetEl = items[targetIndex];
    targetEl.after(currentEl);
  } else {
    return;
  }

  const newOrderIds = Array.from(list.querySelectorAll('[data-id]')).map(el => el.getAttribute('data-id'));

  // Sıra numaralarını ve ok butonlarının aktif/pasif durumlarını hemen güncelle
  updateQueueOrderDOM(list);

  fetch('/api/queue/reorder', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids: newOrderIds })
  }).catch(err => console.error('Error reordering queue via arrow:', err));
};

// Türkçe Açıklama: DOM üzerindeki sıra numarası rozetlerini (#01, #02..) ve ilk/son elemanın ok butonlarının pasiflik durumunu anında senkronize eder.
function updateQueueOrderDOM(listEl) {
  if (!listEl) return;
  const items = Array.from(listEl.querySelectorAll('[data-id]'));
  const total = items.length;

  items.forEach((item, idx) => {
    const badge = item.querySelector('.queue-order-badge');
    if (badge) {
      badge.textContent = `#${(idx + 1).toString().padStart(2, '0')}`;
    }
    const topBtn = item.querySelector('.queue-btn-top');
    const upBtn = item.querySelector('.queue-btn-up');
    const downBtn = item.querySelector('.queue-btn-down');
    const bottomBtn = item.querySelector('.queue-btn-bottom');
    const isFirst = (idx === 0);
    const isLast = (idx === total - 1);

    if (topBtn) {
      topBtn.disabled = isFirst;
      topBtn.classList.toggle('disabled', isFirst);
    }
    if (upBtn) {
      upBtn.disabled = isFirst;
      upBtn.classList.toggle('disabled', isFirst);
    }
    if (downBtn) {
      downBtn.disabled = isLast;
      downBtn.classList.toggle('disabled', isLast);
    }
    if (bottomBtn) {
      bottomBtn.disabled = isLast;
      bottomBtn.classList.toggle('disabled', isLast);
    }
  });
}
window.updateQueueOrderDOM = updateQueueOrderDOM;

// Türkçe Açıklama: Liste elemanı sürüklenmeye başlandığında şeffaflığı azaltarak görsel bildirim verir ve sürükleme verilerini ayarlar.
/**
 * Sürükleme başladığında tetiklenen olay yöneticisi.
 * 
 * @param {DragEvent} e Sürükleme olayı nesnesi
 */
function handleDragStart(e) {
  this.style.opacity = '0.4';
  dragSrcEl = this;
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/html', this.innerHTML);
}
window.handleDragStart = handleDragStart;

// Türkçe Açıklama: Sürüklenen eleman diğer elemanın üzerine geldiğinde tarayıcının varsayılan sürükleme davranışını engelleyerek taşımaya izin verir.
/**
 * Sürüklenen öğe başka bir öğenin üzerine geldiğinde tetiklenir.
 * 
 * @param {DragEvent} e Sürükleme olayı nesnesi
 */
function handleDragOver(e) {
  if (e.preventDefault) {
    e.preventDefault();
  }
  e.dataTransfer.dropEffect = 'move';
  return false;
}
window.handleDragOver = handleDragOver;

// Türkçe Açıklama: Sürüklenen eleman hedef konum üzerine bırakıldığında DOM üzerindeki sırasını değiştirir ve güncel sıralamayı backend API'sine kaydeder.
/**
 * Sürüklenen öğe bırakıldığında tetiklenen olay yöneticisi.
 * Sıralamayı DOM üzerinde günceller ve sunucuya bildirir.
 * 
 * @param {DragEvent} e Sürükleme olayı nesnesi
 */
function handleDrop(e) {
  if (e.stopPropagation) {
    e.stopPropagation();
  }
  
  if (dragSrcEl !== this) {
    const list = document.getElementById('queue-list');
    if (!list) return false;
    const children = Array.from(list.querySelectorAll('[data-id]'));
    const fromIndex = children.indexOf(dragSrcEl);
    const toIndex = children.indexOf(this);
    
    if (fromIndex < toIndex) {
      this.after(dragSrcEl);
    } else {
      this.before(dragSrcEl);
    }
    
    const newOrderIds = Array.from(list.querySelectorAll('[data-id]')).map(el => el.getAttribute('data-id'));
    
    updateQueueOrderDOM(list);

    fetch('/api/queue/reorder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: newOrderIds })
    }).catch(err => console.error('Error reordering queue:', err));
  }
  
  return false;
}
window.handleDrop = handleDrop;

// Türkçe Açıklama: Sürükleme işlemi bittiğinde elemanların şeffaflıklarını sıfırlayarak görünümü normale döndürür.
/**
 * Sürükleme işlemi bittiğinde tetiklenen olay yöneticisi.
 * 
 * @param {DragEvent} e Sürükleme olayı nesnesi
 */
function handleDragEnd(e) {
  this.style.opacity = '1';
  document.querySelectorAll('#queue-list [data-id]').forEach(item => {
    item.style.opacity = '1';
  });
}
window.handleDragEnd = handleDragEnd;

/**
 * Pano içeriğini veya girilen YouTube linkini okuyarak doğrudan indirme kuyruğuna ekler.
 */
window.pasteAndDownload = async function() {
  let urlText = '';
  try {
    // Tarayıcı panosundaki metni okumayı dene
    urlText = await navigator.clipboard.readText();
    urlText = urlText.trim();
  } catch (err) {
    console.warn('Pano okuma izni alınamadı:', err);
  }

  const youtubeRegex = /(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/))([^?&"'>\s]{11})/;
  
  // Eğer panoda geçerli bir youtube linki yoksa kullanıcıya girdi kutusu göster
  if (!urlText || !youtubeRegex.test(urlText)) {
    urlText = prompt('Lütfen indirmek istediğiniz YouTube video linkini buraya yapıştırın:');
    if (!urlText) return;
    urlText = urlText.trim();
  }

  const match = urlText.match(youtubeRegex);
  if (match) {
    const videoId = match[1];
    showToast('Video çözümleniyor ve kuyruğa ekleniyor...', 'info');
    try {
      const res = await fetch('/api/download-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoId })
      });
      const data = await res.json();
      if (data.success) {
        showToast('Video kuyruğa başarıyla eklendi!', 'success');
        if (window.switchTab) window.switchTab('queue');
      } else {
        showToast(data.error || 'İndirme eklenemedi.', 'error');
      }
    } catch (err) {
      showToast('Sunucu ile iletişim hatası.', 'error');
    }
  } else {
    showToast('Geçersiz YouTube video linki girildi.', 'error');
  }
};

// Türkçe Açıklama: Kuyruk indirme sırasını duraklatır veya kaldığı yerden devam ettirir. Aktif indirme varsa süreci güvenle durdurup kuyruğun başına alır.
/**
 * Kuyruk duraklatma ve devam ettirme durumunu değiştirir.
 */
window.toggleQueuePause = async function() {
  const isPaused = localDb.settings && localDb.settings.isPaused;
  const endpoint = isPaused ? '/api/queue/resume' : '/api/queue/pause';
  const actionText = isPaused 
    ? (localDb.settings.lang === 'en' ? 'Resuming queue...' : 'Kuyruk devam ettiriliyor...')
    : (localDb.settings.lang === 'en' ? 'Pausing queue...' : 'Kuyruk duraklatılıyor...');
    
  showToast(actionText, 'info');
  
  try {
    const res = await fetch(endpoint, { method: 'POST' });
    const data = await res.json();
    if (data.success) {
      localDb.settings.isPaused = data.isPaused;
      updateUI(localDb);
    } else {
      showToast(data.error || 'İşlem başarısız.', 'error');
    }
  } catch (err) {
    showToast('Sunucu bağlantı hatası.', 'error');
  }
};

// Türkçe Açıklama: Alternatif hız sınırı (kaplumbağa) profilini açıp kapatır.
window.toggleAlternativeSpeed = async function() {
  const isEn = localDb.settings && localDb.settings.lang === 'en';
  showToast(isEn ? 'Toggling speed limit profile...' : 'Hız sınırı profili değiştiriliyor...', 'info');
  try {
    const res = await fetch('/api/settings/toggle-alt-speed', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    const data = await res.json();
    if (data.success) {
      showToast(isEn ? 'Speed profile changed successfully!' : 'Hız profili başarıyla değiştirildi!', 'success');
    } else {
      showToast(data.error || 'Hata oluştu.', 'error');
    }
  } catch (err) {
    showToast('Bağlantı hatası.', 'error');
  }
};

// Türkçe Açıklama: Kullanıcının girdiği hız limitini (KB/s) sunucuya göndererek kaydeder ve indirme sırasına anlık uygular.
/**
 * İndirme hız limitini günceller.
 */
window.updateQueueSpeedLimit = async function() {
  const input = document.getElementById('queue-speed-limit-input');
  if (!input) return;
  
  const limit = parseInt(input.value, 10);
  if (isNaN(limit) || limit < 0) {
    showToast('Lütfen geçerli bir hız sınırı değeri girin (0 veya daha büyük).', 'error');
    return;
  }
  
  const isEn = localDb.settings && localDb.settings.lang === 'en';
  showToast(isEn ? 'Updating speed limit...' : 'Hız sınırı güncelleniyor...', 'info');
  
  try {
    const updatedSettings = { ...localDb.settings };
    if (localDb.settings.useAlternativeSpeed) {
      updatedSettings.alternativeSpeedLimit = limit;
    } else {
      updatedSettings.downloadSpeedLimit = limit;
    }
    
    const res = await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updatedSettings)
    });
    const data = await res.json();
    if (data.success) {
      showToast(isEn ? 'Speed limit updated successfully!' : 'Hız sınırı başarıyla güncellendi!', 'success');
    } else {
      showToast(data.error || 'Hata oluştu.', 'error');
    }
  } catch (err) {
    showToast('Bağlantı hatası.', 'error');
  }
};

// Türkçe Açıklama: Hata alan veya başarısız olan videoyu tekrar indirme kuyruğuna ekler.
window.retryFailedVideo = async function(videoId) {
  if (typeof window.downloadVideoManual === 'function') {
    window.downloadVideoManual(videoId);
  } else {
    try {
      const res = await fetch(`/api/history/${videoId}/redownload`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        showToast('Video tekrar indirme kuyruğuna alındı.', 'success');
      } else {
        showToast(data.error || 'İşlem başarısız.', 'error');
      }
    } catch (e) {
      showToast('Sunucu hatası.', 'error');
    }
  }
};

// Türkçe Açıklama: Tüm hata veren videoları sırayla indirme kuyruğuna tekrar ekler (Gizlenenler ve Otomatik İndirmesi Kapalı Kanallar hariç).
window.retryAllFailedVideos = async function() {
  const currentLang = localStorage.getItem('haytool_user_lang') || 'tr';
  const isEn = currentLang === 'en';
  const disabledChannelIds = new Set((localDb.channels || []).filter(c => c.autoDownload === false).map(c => c.id));
  const failedItems = (localDb.history || []).filter(h => h.status === 'failed' && h.hidden !== true && h.status !== 'ignored' && !disabledChannelIds.has(h.channelId));
  if (failedItems.length === 0) {
    showToast(isEn ? 'No failed videos to retry.' : 'Tekrar denenecek hata alan video bulunmuyor.', 'info');
    return;
  }

  showToast(isEn ? `Retrying ${failedItems.length} failed downloads...` : `${failedItems.length} hata alan video indirmeye ekleniyor...`, 'info');
  
  let successCount = 0;
  for (const item of failedItems) {
    try {
      const res = await fetch('/api/download-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoId: item.id,
          title: item.title,
          channelName: item.channelName,
          channelId: item.channelId
        })
      });
      const data = await res.json();
      if (data.success) successCount++;
    } catch (e) {}
  }

  if (successCount > 0) {
    showToast(isEn ? `${successCount} videos added to queue.` : `${successCount} video kuyruğa yeniden eklendi.`, 'success');
  } else {
    showToast(isEn ? 'Failed to retry downloads.' : 'Videolar kuyruğa eklenemedi.', 'error');
  }
};

// Türkçe Açıklama: Hata veren tek bir videoyu geçmiş listesinden temizler ve tekrar indirilmesini engellemek için göz ardı eder.
window.clearFailedVideo = async function(videoId) {
  const currentLang = localStorage.getItem('haytool_user_lang') || 'tr';
  const isEn = currentLang === 'en';
  const db = window.localDb || (typeof localDb !== 'undefined' ? localDb : { history: [] });
  const itemIndex = (db.history || []).findIndex(h => h.id === videoId && (h.status === 'failed' || h.status === 'waiting_live_processing'));
  let backup = null;
  if (itemIndex !== -1) {
    backup = { ...db.history[itemIndex] };
    db.history.splice(itemIndex, 1);
    if (typeof updateUI === 'function') updateUI(db);
  }

  try {
    const res = await fetch(`/api/history/${videoId}?deleteFile=false&hideOnDelete=true&markWatched=true`, { method: 'DELETE' });
    const data = await res.json();
    if (data.success) {
      showToast(isEn ? 'Failed download removed and ignored.' : 'Hata kaydı temizlendi ve indirilmesi engellendi.', 'success');
    } else {
      if (backup) {
        db.history.push(backup);
        if (typeof updateUI === 'function') updateUI(db);
      }
      showToast(data.error || (isEn ? 'Failed to remove.' : 'Temizlenemedi.'), 'error');
    }
  } catch (err) {
    if (backup) {
      db.history.push(backup);
      if (typeof updateUI === 'function') updateUI(db);
    }
    showToast('Sunucu hatası.', 'error');
  }
};

// Türkçe Açıklama: Tüm hata veren videoları onay alarak toplu biçimde geçmişten temizler (Gizlenenler ve Otomatik İndirmesi Kapalı Kanallar hariç).
window.clearAllFailedVideos = async function() {
  const currentLang = localStorage.getItem('haytool_user_lang') || 'tr';
  const t = translations[currentLang] || translations.tr;
  const isEn = currentLang === 'en';
  const disabledChannelIds = new Set((localDb.channels || []).filter(c => c.autoDownload === false).map(c => c.id));
  
  const failedItems = (localDb.history || []).filter(h => (h.status === 'failed' || h.status === 'waiting_live_processing') && h.hidden !== true && h.status !== 'ignored' && !disabledChannelIds.has(h.channelId));
  if (failedItems.length === 0) {
    showToast(isEn ? 'No failed videos to clear.' : 'Temizlenecek hata kaydı bulunmuyor.', 'info');
    return;
  }

  const confirmMsg = t.btn_clear_failed_confirm || (isEn ? 'Are you sure you want to clear all failed downloads?' : 'Tüm hata veren indirme kayıtlarını temizlemek istediğinize emin misiniz?');
  if (!confirm(confirmMsg)) return;

  const failedIds = failedItems.map(f => f.id);
  const failedIdsSet = new Set(failedIds);
  const backupItems = [...failedItems];

  // Optimistik temizlik (yalnızca seçilen hata kayıtları)
  localDb.history = localDb.history.filter(h => !failedIdsSet.has(h.id));
  if (typeof updateUI === 'function') updateUI(localDb);

  try {
    const res = await fetch('/api/history/bulk-delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: failedIds, deleteFiles: false, hideOnDelete: true })
    });
    const data = await res.json();
    if (data.success) {
      showToast(isEn ? `${failedIds.length} failed records cleared and ignored.` : `${failedIds.length} hata kaydı temizlendi ve indirilmesi engellendi.`, 'success');
    } else {
      localDb.history.push(...backupItems);
      if (typeof updateUI === 'function') updateUI(localDb);
      showToast(data.error || (isEn ? 'Failed to clear records.' : 'Kayıtlar temizlenemedi.'), 'error');
    }
  } catch (err) {
    localDb.history.push(...backupItems);
    if (typeof updateUI === 'function') updateUI(localDb);
    showToast('Sunucu bağlantı hatası.', 'error');
  }
};

// Custom Select Dropdown with Flags (Windows Compatibility)
function initCustomSelect() {
  const trigger = document.getElementById('lang-select-trigger');
  const optionsContainer = document.getElementById('lang-custom-options');
  const hiddenInput = document.getElementById('settings-lang');
  const selectedFlag = document.getElementById('selected-lang-flag');
  const selectedText = document.getElementById('selected-lang-text');

  if (!trigger || !optionsContainer || !hiddenInput) return;

  // Dil seçeneklerini visual olarak alfabetik sıraya göre sırala
  const options = Array.from(optionsContainer.querySelectorAll('.custom-option'));
  options.sort((a, b) => {
    const textA = a.querySelector('span').innerText.trim();
    const textB = b.querySelector('span').innerText.trim();
    return textA.localeCompare(textB, 'tr', { sensitivity: 'base' });
  });

  // Seçenekleri temizleyip sıralı şekilde yeniden ekle
  optionsContainer.innerHTML = '';
  options.forEach(opt => optionsContainer.appendChild(opt));

  trigger.addEventListener('click', (e) => {
    e.stopPropagation();
    optionsContainer.classList.toggle('open');
  });

  document.addEventListener('click', () => {
    optionsContainer.classList.remove('open');
  });

  const allOptions = optionsContainer.querySelectorAll('.custom-option');
  allOptions.forEach(opt => {
    opt.addEventListener('click', () => {
      const val = opt.getAttribute('data-value');
      hiddenInput.value = val;
      
      // Update trigger UI
      selectedFlag.src = opt.querySelector('img').src;
      selectedText.innerText = opt.querySelector('span').innerText;

      // Update active option class
      options.forEach(o => o.classList.remove('selected'));
      opt.classList.add('selected');

      // Close options
      optionsContainer.classList.remove('open');

      // Dil değişikliğini anında tüm arayüze canlı olarak uygula
      if (window.localDb && window.localDb.settings) {
        window.localDb.settings.lang = val;
      }
      if (typeof applyLanguage === 'function') {
        applyLanguage(val);
      }

      // Otomatik kaydetmeyi tetikle
      performAutoSave();

      // Üst bildirim mesajı göster
      const langNames = { tr: 'Türkçe', en: 'English', es: 'Español', de: 'Deutsch', pt: 'Português', ar: 'العربية', ru: 'Русский' };
      const chosenLangName = langNames[val] || val;
      const toastMsg = val === 'en' ? `App language updated: ${chosenLangName}` : `Uygulama dili güncellendi: ${chosenLangName}`;
      showToast(toastMsg, 'success');
    });
  });
}

function setCustomSelectValue(val) {
  const hiddenInput = document.getElementById('settings-lang');
  const selectedFlag = document.getElementById('selected-lang-flag');
  const selectedText = document.getElementById('selected-lang-text');
  const optionsContainer = document.getElementById('lang-custom-options');
  if (!hiddenInput || !selectedFlag || !selectedText || !optionsContainer) return;

  hiddenInput.value = val;

  const opt = optionsContainer.querySelector(`.custom-option[data-value="${val}"]`);
  if (opt) {
    selectedFlag.src = opt.querySelector('img').src;
    selectedText.innerText = opt.querySelector('span').innerText;
    
    const options = optionsContainer.querySelectorAll('.custom-option');
    options.forEach(o => o.classList.remove('selected'));
    opt.classList.add('selected');
  }
}

async function checkFfmpegStatus() {
  const langKey = currentLang || (localDb.settings && localDb.settings.lang) || 'tr';
  const t = translations[langKey] || translations.tr;
  try {
    const res = await fetch('/api/ffmpeg/status');
    const data = await res.json();
    
    const banner = document.getElementById('ffmpeg-info-banner');
    const statusIndicator = document.getElementById('settings-ffmpeg-status');
    const settingsBtn = document.getElementById('settings-ffmpeg-btn');
    const versionBadge = document.getElementById('settings-ffmpeg-version-info');
    
    const isEn = langKey === 'en';
    const isAr = langKey === 'ar';
    const isEs = langKey === 'es';
    const isDe = langKey === 'de';
    const isPt = langKey === 'pt';
    const isRu = langKey === 'ru';

    let localPrefix = 'Yerel:';
    let remotePrefix = 'Uzak:';
    if (isEn) { localPrefix = 'Local:'; remotePrefix = 'Remote:'; }
    else if (isEs) { localPrefix = 'Local:'; remotePrefix = 'Remoto:'; }
    else if (isDe) { localPrefix = 'Lokal:'; remotePrefix = 'Remote:'; }
    else if (isPt) { localPrefix = 'Local:'; remotePrefix = 'Remoto:'; }
    else if (isAr) { localPrefix = 'المحلي:'; remotePrefix = 'البعيد:'; }
    else if (isRu) { localPrefix = 'Локально:'; remotePrefix = 'Удаленно:'; }

    if (versionBadge) {
      if (data.installed && data.localVersion) {
        versionBadge.style.display = 'inline-block';
        versionBadge.innerText = `${localPrefix} ${data.localVersion} | ${remotePrefix} ${data.remoteVersion || 'v6.1'}`;
      } else if (data.remoteVersion) {
        versionBadge.style.display = 'inline-block';
        versionBadge.innerText = `${remotePrefix} ${data.remoteVersion}`;
      } else {
        versionBadge.style.display = 'none';
      }
    }

    if (data.installed) {
      if (banner) banner.classList.add('hidden');
      if (statusIndicator) {
        statusIndicator.innerText = t.ffmpeg_status_installed || 'Kurulu';
        statusIndicator.className = 'ffmpeg-status-indicator installed';
      }
      if (settingsBtn) {
        settingsBtn.innerText = t.ffmpeg_btn_reinstall || 'Yeniden Kur';
      }
    } else {
      if (banner && localStorage.getItem('ffmpeg_banner_dismissed') !== 'true') {
        banner.classList.remove('hidden');
      }
      if (statusIndicator) {
        statusIndicator.innerText = t.ffmpeg_status_not_installed || 'Kurulu Değil';
        statusIndicator.className = 'ffmpeg-status-indicator not-installed';
      }
      if (settingsBtn) {
        settingsBtn.innerText = t.ffmpeg_btn_install || 'Kur';
      }
    }
  } catch (err) {
    console.error('Error checking FFmpeg status:', err);
  }
}
window.checkFfmpegStatus = checkFfmpegStatus;

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
// FFmpeg Installer Logic
function openFfmpegModal() {
  const modal = document.getElementById('ffmpeg-installer-modal');
  if (modal) {
    modal.classList.remove('hidden');
    // Hide close actions until finished or failed
    const closeActionBtn = document.getElementById('ffmpeg-modal-close-action-btn');
    if (closeActionBtn) closeActionBtn.classList.add('hidden');
  }
}

function closeFfmpegModal() {
  const modal = document.getElementById('ffmpeg-installer-modal');
  if (modal) modal.classList.add('hidden');
}

function updateFfmpegInstallUI(data) {
  const isEn = localDb.settings && localDb.settings.lang === 'en';
  const progressBar = document.getElementById('ffmpeg-progress-bar');
  const statusText = document.getElementById('ffmpeg-status-text');
  const closeActionBtn = document.getElementById('ffmpeg-modal-close-action-btn');
  
  if (progressBar) {
    progressBar.style.width = `${data.progress}%`;
    progressBar.style.background = ''; // reset color
  }
  
  if (statusText) {
    if (data.status === 'downloading') {
      statusText.innerText = isEn ? `Downloading: %${data.progress}` : `İndiriliyor: %${data.progress}`;
      statusText.style.color = 'var(--primary)';
    } else if (data.status === 'extracting') {
      statusText.innerText = isEn ? 'Extracting archive...' : 'Arşivden Çıkarılıyor...';
      statusText.style.color = 'var(--secondary)';
    } else if (data.status === 'completed') {
      statusText.innerText = isEn ? 'Installation Completed Successfully!' : 'Kurulum Başarıyla Tamamlandı!';
      statusText.style.color = 'var(--success-color)';
      if (closeActionBtn) closeActionBtn.classList.remove('hidden');
      checkFfmpegStatus();
    } else if (data.status === 'failed') {
      statusText.innerText = isEn ? `Installation Failed: ${data.error}` : `Kurulum Başarısız: ${data.error}`;
      statusText.style.color = 'var(--danger-color)';
      if (progressBar) progressBar.style.background = 'var(--danger-color)';
      if (closeActionBtn) closeActionBtn.classList.remove('hidden');
    }
  }
}

async function startFfmpegDownload() {
  const isEn = localDb.settings && localDb.settings.lang === 'en';
  openFfmpegModal();
  
  const progressBar = document.getElementById('ffmpeg-progress-bar');
  const statusText = document.getElementById('ffmpeg-status-text');
  if (progressBar) progressBar.style.width = '0%';
  if (statusText) statusText.innerText = isEn ? 'Starting installation...' : 'Kurulum başlatılıyor...';
  
  try {
    const res = await fetch('/api/ffmpeg/download', { method: 'POST' });
    const data = await res.json();
    if (data.success) {
      if (data.state) {
        updateFfmpegInstallUI(data.state);
      }
    } else {
      if (statusText) {
        statusText.innerText = data.message || (isEn ? 'Failed to start download' : 'İndirme başlatılamadı');
        statusText.style.color = 'var(--danger-color)';
      }
    }
  } catch (err) {
    console.error('Error starting FFmpeg download:', err);
    if (statusText) {
      statusText.innerText = isEn ? 'Connection error' : 'Bağlantı hatası';
      statusText.style.color = 'var(--danger-color)';
    }
  }
}

// Event Listeners for FFmpeg UI
const bannerInstallBtn = document.getElementById('ffmpeg-banner-install-btn');
const bannerCloseBtn = document.getElementById('ffmpeg-banner-close-btn');
const settingsFfmpegBtn = document.getElementById('settings-ffmpeg-btn');
const closeFfmpegModalBtn = document.getElementById('close-ffmpeg-modal-btn');
const ffmpegModalCloseActionBtn = document.getElementById('ffmpeg-modal-close-action-btn');
const banner = document.getElementById('ffmpeg-info-banner');

if (bannerInstallBtn) {
  bannerInstallBtn.addEventListener('click', startFfmpegDownload);
}

if (bannerCloseBtn) {
  bannerCloseBtn.addEventListener('click', () => {
    if (banner) banner.classList.add('hidden');
    localStorage.setItem('ffmpeg_banner_dismissed', 'true');
  });
}

if (settingsFfmpegBtn) {
  settingsFfmpegBtn.addEventListener('click', startFfmpegDownload);
}

if (closeFfmpegModalBtn) {
  closeFfmpegModalBtn.addEventListener('click', closeFfmpegModal);
}

if (ffmpegModalCloseActionBtn) {
  ffmpegModalCloseActionBtn.addEventListener('click', closeFfmpegModal);
}

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

// Türkçe Açıklama: Yorumlar panelini açar/kapatır ve kapatıldığında veya açıldığında yorumları sunucudan çeker.
window.toggleCommentsPanel = async function() {
  const container = document.getElementById('inline-player-comments-container');
  if (!container) return;
  
  const isHidden = container.classList.contains('hidden');
  const btn = document.getElementById('inline-btn-comments');
  const isEn = localDb.settings?.lang === 'en';
  
  if (isHidden) {
    container.classList.remove('hidden');
    if (btn) {
      btn.classList.add('active');
      btn.title = isEn ? 'Hide Comments' : 'Yorumları Gizle';
    }
    await loadComments(currentPlayingVideoId);
  } else {
    container.classList.add('hidden');
    if (btn) {
      btn.classList.remove('active');
      btn.title = isEn ? 'Show Comments' : 'Yorumları Göster';
    }
  }
};


/**
 * Türkçe Açıklama: Aktif video oynatıcının süresini belirtilen saniyeye atlatır (Plyr, Artplayer, HTML5 uyumlu).
 * 
 * @param {number} seconds - Atlanacak saniye değeri
 * @returns {void}
 */
window.seekVideoToSeconds = function(seconds) {
  const pType = (localDb.settings && localDb.settings.playerType) || 'plyr';
  const player = document.getElementById('embedded-video-player');
  
  if (pType === 'artplayer' && videoPlayerInstance) {
    videoPlayerInstance.currentTime = seconds;
  } else if (pType === 'html5' && player) {
    player.currentTime = seconds;
  } else if (videoPlayerInstance) {
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

let nextCommentsToken = null;
let loadedCommentsList = [];

// Render comments list with sorting
function renderCommentsList() {
  const list = document.getElementById('comments-list');
  if (!list) return;
  list.innerHTML = '';
  
  const sortVal = document.getElementById('comments-sort')?.value || 'default';
  let sorted = [...loadedCommentsList];
  
  if (sortVal === 'likes-desc') {
    sorted.sort((a, b) => parseLikes(b.likeCount) - parseLikes(a.likeCount));
  } else if (sortVal === 'date-new') {
    sorted.sort((a, b) => parseRelativeTime(a.publishedTime) - parseRelativeTime(b.publishedTime));
  } else if (sortVal === 'date-old') {
    sorted.sort((a, b) => parseRelativeTime(b.publishedTime) - parseRelativeTime(a.publishedTime));
  }
  
  sorted.forEach(c => {
    const item = document.createElement('div');
    item.className = 'comment-item';
    
    const avatarUrl = c.authorAvatar || 'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2240%22 height=%2240%22><circle cx=%2220%22 cy=%2220%22 r=%2220%22 fill=%22%2316142a%22/></svg>';
    
    item.innerHTML = `
      <img class="comment-avatar" src="${avatarUrl}" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2240%22 height=%2240%22><circle cx=%2220%22 cy=%2220%22 r=%2220%22 fill=%22%2316142a%22/></svg>';" />
      <div class="comment-content">
        <div class="comment-meta">
          <span class="comment-author">${escapeHtml(c.author)}</span>
          <span class="comment-time">${escapeHtml(c.publishedTime)}</span>
        </div>
        <div class="comment-text">${escapeHtml(c.text)}</div>
        <div class="comment-likes-row">
          <i data-lucide="thumbs-up"></i>
          <span>${escapeHtml(c.likeCount)}</span>
        </div>
      </div>
    `;
    list.appendChild(item);
  });
  lucide.createIcons();
}

window.sortAndRenderComments = function() {
  renderCommentsList();
};

async function loadComments(videoId) {
  const list = document.getElementById('comments-list');
  const loading = document.getElementById('comments-loading');
  const empty = document.getElementById('comments-list-empty');
  const moreContainer = document.getElementById('comments-more-container');
  
  if (!list || !loading || !empty) return;
  
  list.innerHTML = '';
  loading.style.display = 'block';
  empty.style.display = 'none';
  if (moreContainer) moreContainer.style.display = 'none';
  nextCommentsToken = null;
  loadedCommentsList = [];
  
  // Translation
  const commentsSort = document.getElementById('comments-sort');
  if (commentsSort) {
    const isEn = localDb.settings?.lang === 'en';
    commentsSort.options[0].text = isEn ? 'Default' : 'Varsayılan';
    commentsSort.options[1].text = isEn ? 'Likes (High to Low)' : 'Beğeni (Çoktan Aza)';
    commentsSort.options[2].text = isEn ? 'Newest' : 'En Yeni';
    commentsSort.options[3].text = isEn ? 'Oldest' : 'En Eski';
  }

  try {
    const res = await fetch(`/api/video/${videoId}/comments`);
    const data = await res.json();
    loading.style.display = 'none';
    
    if (data.success && data.comments && data.comments.length > 0) {
      loadedCommentsList = data.comments;
      renderCommentsList();
      if (data.nextPageToken) {
        nextCommentsToken = data.nextPageToken;
        if (moreContainer) moreContainer.style.display = 'block';
      }
    } else {
      empty.style.display = 'block';
    }
  } catch (err) {
    loading.style.display = 'none';
    empty.style.display = 'block';
    console.error("Error loading comments:", err);
  }
}

window.loadMoreComments = async function() {
  if (!currentPlayingVideoId || !nextCommentsToken) return;
  
  const moreBtn = document.getElementById('btn-load-more-comments');
  const moreText = document.getElementById('btn-load-more-comments-text');
  const isEn = localDb.settings?.lang === 'en';
  
  if (moreBtn) moreBtn.disabled = true;
  if (moreText) {
    moreText.textContent = isEn ? 'Loading...' : 'Yükleniyor...';
  }
  
  try {
    const res = await fetch(`/api/video/${currentPlayingVideoId}/comments?token=${encodeURIComponent(nextCommentsToken)}`);
    const data = await res.json();
    
    if (data.success && data.comments && data.comments.length > 0) {
      loadedCommentsList = loadedCommentsList.concat(data.comments);
      renderCommentsList();
      if (data.nextPageToken) {
        nextCommentsToken = data.nextPageToken;
        if (moreBtn) moreBtn.disabled = false;
        if (moreText) {
          moreText.textContent = isEn ? 'Show More' : 'Daha Fazla Göster';
        }
      } else {
        nextCommentsToken = null;
        const moreContainer = document.getElementById('comments-more-container');
        if (moreContainer) moreContainer.style.display = 'none';
      }
    } else {
      nextCommentsToken = null;
      const moreContainer = document.getElementById('comments-more-container');
      if (moreContainer) moreContainer.style.display = 'none';
    }
  } catch (err) {
    console.error("Error loading more comments:", err);
    if (moreBtn) moreBtn.disabled = false;
    if (moreText) {
      moreText.textContent = isEn ? 'Show More' : 'Daha Fazla Göster';
    }
  }
};

lucide.createIcons();


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

// === DOWNLOADED BULK DELETE FUNCTIONS ===
function toggleDownloadedBulkDeleteMode() {
  const isEn = localDb.settings?.lang === 'en';
  const toggleBtn = document.getElementById('downloaded-bulk-delete-toggle-btn');
  const bar = document.getElementById('downloaded-bulk-delete-bar');
  
  window.isDownloadedBulkDeleteMode = !window.isDownloadedBulkDeleteMode;
  
  if (window.isDownloadedBulkDeleteMode) {
    if (toggleBtn) {
      toggleBtn.classList.add('active');
      toggleBtn.style.background = 'var(--primary)';
      toggleBtn.style.color = '#fff';
    }
    if (bar) bar.classList.remove('hidden');
    const filesCb = document.getElementById('downloaded-bulk-delete-files-checkbox');
    if (filesCb) filesCb.checked = true;
  } else {
    if (toggleBtn) {
      toggleBtn.classList.remove('active');
      toggleBtn.style.background = '';
      toggleBtn.style.color = '';
    }
    if (bar) bar.classList.add('hidden');
    // Clear selections
    const selectAllCb = document.getElementById('downloaded-bulk-delete-select-all');
    if (selectAllCb) selectAllCb.checked = false;
  }
  
  // Update counts
  updateDownloadedBulkDeleteCount();
  
  // Re-render UI to apply isDownloadedBulkDeleteMode state to cards
  if (typeof updateUI === 'function') {
    updateUI(localDb);
  }
}
window.toggleDownloadedBulkDeleteMode = toggleDownloadedBulkDeleteMode;

function cancelDownloadedBulkDeleteMode() {
  window.isDownloadedBulkDeleteMode = false;
  const toggleBtn = document.getElementById('downloaded-bulk-delete-toggle-btn');
  const bar = document.getElementById('downloaded-bulk-delete-bar');
  if (toggleBtn) {
    toggleBtn.classList.remove('active');
    toggleBtn.style.background = '';
    toggleBtn.style.color = '';
  }
  if (bar) bar.classList.add('hidden');
  
  const selectAllCb = document.getElementById('downloaded-bulk-delete-select-all');
  if (selectAllCb) selectAllCb.checked = false;
  
  updateDownloadedBulkDeleteCount();
  if (typeof updateUI === 'function') {
    updateUI(localDb);
  }
}
window.cancelDownloadedBulkDeleteMode = cancelDownloadedBulkDeleteMode;

function toggleSelectAllDownloadedBulkDelete(masterCb) {
  const cbs = document.querySelectorAll('.downloaded-bulk-delete-cb');
  cbs.forEach(cb => {
    cb.checked = masterCb.checked;
    const card = cb.closest('.video-card');
    if (card) {
      card.classList.toggle('bulk-delete-selected', cb.checked);
    }
  });
  updateDownloadedBulkDeleteCount();
}
window.toggleSelectAllDownloadedBulkDelete = toggleSelectAllDownloadedBulkDelete;

/**
 * Toplu seçim kartı toggle işlemi — genel yardımcı.
 * @param {string} id - Video ID'si
 * @param {string} cbSelector - Checkbox CSS selector'ı (ör. '.downloaded-bulk-delete-cb')
 * @param {string} cardClass - Seçili kart CSS sınıfı (ör. 'bulk-delete-selected')
 * @param {string} selectAllId - "Tümünü Seç" checkbox element ID'si
 * @param {Function} updateCountFn - Sayaç güncelleme fonksiyonu
 */
function toggleBulkCardSelection(id, cbSelector, cardClass, selectAllId, updateCountFn) {
  const cb = document.querySelector(`${cbSelector}[data-id="${id}"]`);
  if (!cb) return;

  cb.checked = !cb.checked;

  const card = cb.closest('.video-card');
  if (card) {
    card.classList.toggle(cardClass, cb.checked);
  }

  // "Tümünü Seç" checkbox'ını senkronize et
  const allCbs = document.querySelectorAll(cbSelector);
  const checkedCbs = document.querySelectorAll(`${cbSelector}:checked`);
  const selectAllCb = document.getElementById(selectAllId);
  if (selectAllCb) {
    selectAllCb.checked = allCbs.length > 0 && allCbs.length === checkedCbs.length;
  }

  if (typeof updateCountFn === 'function') updateCountFn();
}

/** İndirilenlerde toplu silme kart seçimi. */
function toggleDownloadedCardSelection(id) {
  toggleBulkCardSelection(
    id,
    '.downloaded-bulk-delete-cb',
    'bulk-delete-selected',
    'downloaded-bulk-delete-select-all',
    updateDownloadedBulkDeleteCount
  );
}
window.toggleDownloadedCardSelection = toggleDownloadedCardSelection;

/** Geçmişte toplu gizleme kart seçimi. */
function toggleHistoryBulkHideCardSelection(id) {
  toggleBulkCardSelection(
    id,
    '.history-bulk-hide-cb',
    'bulk-hide-selected',
    'history-bulk-hide-select-all',
    updateHistoryBulkHideCount
  );
}
window.toggleHistoryBulkHideCardSelection = toggleHistoryBulkHideCardSelection;

function updateDownloadedBulkDeleteCount(e) {
  if (e) {
    e.stopPropagation();
    const cb = e.target;
    const card = cb.closest('.video-card');
    if (card) {
      card.classList.toggle('bulk-delete-selected', cb.checked);
    }
    // Sync Select All checkbox
    const allCbs = document.querySelectorAll('.downloaded-bulk-delete-cb');
    const checkedCbs = document.querySelectorAll('.downloaded-bulk-delete-cb:checked');
    const selectAllCb = document.getElementById('downloaded-bulk-delete-select-all');
    if (selectAllCb) {
      selectAllCb.checked = allCbs.length > 0 && allCbs.length === checkedCbs.length;
    }
  }
  const checkedCount = document.querySelectorAll('.downloaded-bulk-delete-cb:checked').length;
  const countEl = document.getElementById('downloaded-bulk-delete-selected-count');
  if (countEl) countEl.textContent = checkedCount;
}
window.updateDownloadedBulkDeleteCount = updateDownloadedBulkDeleteCount;

async function executeDownloadedBulkDelete() {
  const isEn = localDb.settings?.lang === 'en';
  const checked = document.querySelectorAll('.downloaded-bulk-delete-cb:checked');
  if (checked.length === 0) {
    showToast(isEn ? 'Please select at least one video to delete.' : 'Lütfen silmek için en az bir video seçin.', 'error');
    return;
  }
  
  const videoIds = Array.from(checked).map(cb => cb.getAttribute('data-id'));
  const alsoDeleteFiles = document.getElementById('downloaded-bulk-delete-files-checkbox')?.checked || false;
  
  const confirmMsg = isEn 
    ? `Are you sure you want to delete the selected ${videoIds.length} video(s)?`
    : `Seçilen ${videoIds.length} videoyu silmek istediğinize emin misiniz?`;
    
  if (!confirm(confirmMsg)) return;
  
  try {
    const response = await fetch('/api/history/bulk-delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: videoIds, deleteFiles: alsoDeleteFiles })
    });
    
    if (response.ok) {
      showToast(isEn ? `${videoIds.length} video(s) deleted successfully.` : `${videoIds.length} video başarıyla silindi.`, 'success');
      cancelDownloadedBulkDeleteMode();
      
      if (typeof loadDb === 'function') {
        await loadDb();
      }
    } else {
      showToast(isEn ? 'Failed to delete videos.' : 'Videolar silinirken bir hata oluştu.', 'error');
    }
  } catch (err) {
    console.error('[executeDownloadedBulkDelete] Hata:', err);
    showToast(isEn ? 'An error occurred during deletion.' : 'Silme işlemi sırasında bir hata oluştu.', 'error');
  }
}
window.executeDownloadedBulkDelete = executeDownloadedBulkDelete;

// === HISTORY BULK HIDE FUNCTIONS ===
function toggleHistoryBulkHideMode() {
  const toggleBtn = document.getElementById('history-bulk-hide-toggle-btn');
  const bar = document.getElementById('history-bulk-hide-bar');
  
  window.isHistoryBulkHideMode = !window.isHistoryBulkHideMode;
  
  if (window.isHistoryBulkHideMode) {
    if (toggleBtn) {
      toggleBtn.classList.add('active');
    }
    if (bar) bar.classList.remove('hidden');
  } else {
    if (toggleBtn) {
      toggleBtn.classList.remove('active');
    }
    if (bar) bar.classList.add('hidden');
    // Clear selections
    const selectAllCb = document.getElementById('history-bulk-hide-select-all');
    if (selectAllCb) selectAllCb.checked = false;
  }
  
  updateHistoryBulkHideCount();
  
  // Re-render UI to apply isHistoryBulkHideMode state to history cards
  if (typeof updateUI === 'function') {
    updateUI(localDb);
  }
}
window.toggleHistoryBulkHideMode = toggleHistoryBulkHideMode;

function cancelHistoryBulkHideMode() {
  window.isHistoryBulkHideMode = false;
  const toggleBtn = document.getElementById('history-bulk-hide-toggle-btn');
  const bar = document.getElementById('history-bulk-hide-bar');
  if (toggleBtn) {
    toggleBtn.classList.remove('active');
  }
  if (bar) bar.classList.add('hidden');
  
  const selectAllCb = document.getElementById('history-bulk-hide-select-all');
  if (selectAllCb) selectAllCb.checked = false;
  
  updateHistoryBulkHideCount();
  if (typeof updateUI === 'function') {
    updateUI(localDb);
  }
}
window.cancelHistoryBulkHideMode = cancelHistoryBulkHideMode;

function toggleSelectAllHistoryBulkHide(masterCb) {
  const cbs = document.querySelectorAll('.history-bulk-hide-cb');
  cbs.forEach(cb => {
    cb.checked = masterCb.checked;
    const card = cb.closest('.video-card');
    if (card) {
      card.classList.toggle('bulk-hide-selected', cb.checked);
    }
  });
  updateHistoryBulkHideCount();
}
window.toggleSelectAllHistoryBulkHide = toggleSelectAllHistoryBulkHide;


function updateHistoryBulkHideCount(e) {
  if (e) {
    e.stopPropagation();
    const cb = e.target;
    const card = cb.closest('.video-card');
    if (card) {
      card.classList.toggle('bulk-hide-selected', cb.checked);
    }
    // Sync Select All checkbox
    const allCbs = document.querySelectorAll('.history-bulk-hide-cb');
    const checkedCbs = document.querySelectorAll('.history-bulk-hide-cb:checked');
    const selectAllCb = document.getElementById('history-bulk-hide-select-all');
    if (selectAllCb) {
      selectAllCb.checked = allCbs.length > 0 && allCbs.length === checkedCbs.length;
    }
  }
  const checkedCount = document.querySelectorAll('.history-bulk-hide-cb:checked').length;
  const countEl = document.getElementById('history-bulk-hide-selected-count');
  if (countEl) countEl.textContent = checkedCount;
}
window.updateHistoryBulkHideCount = updateHistoryBulkHideCount;

async function executeHistoryBulkHide() {
  const isEn = localDb.settings?.lang === 'en';
  const checked = document.querySelectorAll('.history-bulk-hide-cb:checked');
  if (checked.length === 0) {
    showToast(isEn ? 'Please select at least one video to hide.' : 'Lütfen gizlemek için en az bir video seçin.', 'warning');
    return;
  }
  
  const videoIds = Array.from(checked).map(cb => cb.getAttribute('data-id'));
  
  const confirmMsg = isEn 
    ? `Are you sure you want to hide the selected ${videoIds.length} video(s)?`
    : `Seçilen ${videoIds.length} videoyu gizlemek istediğinize emin misiniz?`;
    
  if (!confirm(confirmMsg)) return;
  
  try {
    const response = await fetch('/api/history/bulk-hide', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: videoIds })
    });
    
    const result = await response.json();
    if (result.success) {
      const count = result.count || videoIds.length;
      showToast(isEn ? `${count} video(s) hidden successfully.` : `${count} video başarıyla gizlendi.`, 'success');
      cancelHistoryBulkHideMode();
      
      if (typeof loadDb === 'function') {
        await loadDb();
      }
    } else {
      showToast(result.error || (isEn ? 'Failed to hide videos.' : 'Videolar gizlenirken bir hata oluştu.'), 'error');
    }
  } catch (err) {
    console.error('[executeHistoryBulkHide] Hata:', err);
    showToast(isEn ? 'An error occurred while hiding videos.' : 'Gizleme işlemi sırasında bir hata oluştu.', 'error');
  }
}
window.executeHistoryBulkHide = executeHistoryBulkHide;

async function handleDownloaderStart() {
  const urlInput = document.getElementById('downloader-url-input');
  if (!urlInput) return;

  const url = urlInput.value.trim();
  const isEn = localDb.settings && localDb.settings.lang === 'en';

  if (!url) {
    showToast(isEn ? 'Please enter a valid URL.' : 'Lütfen geçerli bir URL girin.', 'error');
    return;
  }

  const formatSelect = document.getElementById('downloader-format-select');
  const bitrateSelect = document.getElementById('downloader-bitrate-select');
  const format = formatSelect ? formatSelect.value : 'video-best';
  const bitrate = (format === 'audio-mp3' && bitrateSelect) ? bitrateSelect.value : null;

  const startBtn = document.getElementById('downloader-start-btn');
  if (startBtn) {
    startBtn.disabled = true;
    const originalText = startBtn.innerHTML;
    startBtn.innerHTML = `<i class="toast-icon spin" data-lucide="loader" style="width:14px;height:14px;display:inline-block;vertical-align:middle;margin-right:5px;"></i> <span>${isEn ? 'Processing...' : 'İşleniyor...'}</span>`;
    lucide.createIcons();
  }

  try {
    // Playlist URL kontrolü
    const isPlaylist = url.includes('list=') && !url.includes('watch?v=');
    
    if (isPlaylist) {
      // Playlist'i çözümle
      showToast(isEn ? 'Resolving playlist, please wait...' : 'Playlist çözümleniyor, lütfen bekleyin...', 'info');
      const res = await fetch('/api/downloader/resolve-playlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      });
      const data = await res.json();
      
      if (data.success && data.videos && data.videos.length > 0) {
        activePlaylistVideos = data.videos;
        renderPlaylistResults(data.videos);
        showToast(isEn ? `${data.videos.length} videos found.` : `${data.videos.length} video bulundu.`, 'success');
      } else {
        showToast(data.error || (isEn ? 'Failed to resolve playlist.' : 'Playlist çözümlenemedi.'), 'error');
      }
    } else {
      // Tekil video indir
      const res = await fetch('/api/downloader/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, format, bitrate })
      });
      const data = await res.json();
      if (data.success) {
        showToast(isEn ? 'Added to download queue.' : 'Kuyruğa başarıyla eklendi.', 'success');
        urlInput.value = '';
        switchTab('queue');
      } else {
        showToast(data.error || (isEn ? 'Failed to start download.' : 'İndirme başlatılamadı.'), 'error');
      }
    }
  } catch (err) {
    showToast(isEn ? 'Connection error.' : 'Bağlantı hatası.', 'error');
  } finally {
    if (startBtn) {
      startBtn.disabled = false;
      startBtn.innerHTML = `<i data-lucide="download"></i> <span>${isEn ? 'Start Download' : 'İndirmeyi Başlat'}</span>`;
      lucide.createIcons();
    }
  }
}
window.handleDownloaderStart = handleDownloaderStart;
window.initDownloaderUI = initDownloaderUI;

async function handleDownloaderAll() {
  if (activePlaylistVideos.length === 0) return;
  const isEn = localDb.settings && localDb.settings.lang === 'en';
  
  const checkboxes = document.querySelectorAll('.playlist-item-checkbox:checked');
  if (checkboxes.length === 0) {
    showToast(isEn ? 'Please select at least one video.' : 'Lütfen en az bir video seçin.', 'error');
    return;
  }

  const selectedIds = Array.from(checkboxes).map(cb => cb.getAttribute('data-id'));
  const targetVideos = activePlaylistVideos.filter(v => selectedIds.includes(v.id));

  const formatSelect = document.getElementById('downloader-format-select');
  const bitrateSelect = document.getElementById('downloader-bitrate-select');
  const format = formatSelect ? formatSelect.value : 'video-best';
  const bitrate = (format === 'audio-mp3' && bitrateSelect) ? bitrateSelect.value : null;

  const downloadAllBtn = document.getElementById('downloader-download-all-btn');
  if (downloadAllBtn) {
    downloadAllBtn.disabled = true;
  }

  let addedCount = 0;
  for (const video of targetVideos) {
    try {
      const videoUrl = `https://www.youtube.com/watch?v=${video.id}`;
      const res = await fetch('/api/downloader/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          url: videoUrl, 
          format, 
          bitrate, 
          title: video.title,
          channelId: 'manual',
          channelName: video.uploader || 'Manuel İndirme'
        })
      });
      const data = await res.json();
      if (data.success) {
        addedCount++;
      }
    } catch (e) {
      console.error('Playlist video ekleme hatası:', e);
    }
  }

  showToast(isEn ? `${addedCount} videos added to queue.` : `${addedCount} video kuyruğa eklendi.`, 'success');
  
  // Temizle ve Kuyruğa yönlendir
  document.getElementById('downloader-playlist-results').classList.add('hidden');
  document.getElementById('downloader-url-input').value = '';
  activePlaylistVideos = [];
  
  if (downloadAllBtn) {
    downloadAllBtn.disabled = false;
  }
  
  switchTab('queue');
}

function renderPlaylistResults(videos) {
  const container = document.getElementById('downloader-playlist-results');
  const listContainer = document.getElementById('downloader-playlist-list');
  if (!container || !listContainer) return;

  listContainer.innerHTML = '';
  videos.forEach((video, index) => {
    const item = document.createElement('div');
    item.className = 'downloader-playlist-item';
    item.setAttribute('data-video-id', video.id);
    
    let durationStr = '';
    if (video.duration) {
      const min = Math.floor(video.duration / 60);
      const sec = Math.floor(video.duration % 60);
      durationStr = `${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
    }

    const thumbUrl = video.thumbnail || `https://i.ytimg.com/vi/${video.id}/hqdefault.jpg`;

    item.innerHTML = `
      <input type="checkbox" class="playlist-item-checkbox" checked data-id="${video.id}" onclick="event.stopPropagation();" />
      <span class="item-index">${index + 1}</span>
      <div class="playlist-item-thumb-wrap">
        <img src="${thumbUrl}" class="playlist-item-thumb" onerror="this.src='logo.png';" />
      </div>
      <span class="item-title" title="${escapeHtml(video.title)}">${escapeHtml(video.title)}</span>
      <span class="item-duration">${durationStr}</span>
    `;

    item.addEventListener('click', (e) => {
      if (e.target.tagName !== 'INPUT') {
        const cb = item.querySelector('.playlist-item-checkbox');
        if (cb) cb.checked = !cb.checked;
      }
    });

    listContainer.appendChild(item);
  });

  container.classList.remove('hidden');
}

async function downloadMissingVideo(videoId, title, channelName, channelId) {
  const isEn = localDb.settings && localDb.settings.lang === 'en';
  try {
    showToast(isEn ? 'Adding video to download queue...' : 'Video indirme kuyruğuna ekleniyor...', 'info');
    const res = await fetch('/api/downloader/download', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: videoId,
        title: title,
        channelName: channelName,
        channelId: channelId
      })
    });
    const data = await res.json();
    if (data.success) {
      showToast(isEn ? 'Video added to queue successfully.' : 'Video kuyruğa başarıyla eklendi.', 'success');
      runFileComparison();
    } else {
      showToast(data.error || (isEn ? 'Failed to queue video.' : 'Kuyruğa eklenemedi.'), 'error');
    }
  } catch (err) {
    showToast(isEn ? 'Connection error.' : 'Bağlantı hatası.', 'error');
  }
}
window.downloadMissingVideo = downloadMissingVideo;

async function createSystemBackup() {
  const isEn = localDb.settings && localDb.settings.lang === 'en';
  try {
    showToast(isEn ? 'Creating compressed system backup...' : 'Sıkıştırılmış sistem yedeği oluşturuluyor...', 'info');
    const res = await fetch('/api/backup', { method: 'POST' });
    const data = await res.json();
    if (data.success) {
      showToast(isEn ? `Backup created successfully (${data.size}).` : `Sıkıştırılmış yedek oluşturuldu (${data.size}).`, 'success');
      const container = document.getElementById('system-backups-container');
      if (container && !container.classList.contains('hidden')) {
        loadSystemBackupsList(true);
      }
    } else {
      showToast(data.error || (isEn ? 'Failed to create backup.' : 'Yedek oluşturulamadı.'), 'error');
    }
  } catch (err) {
    showToast(isEn ? 'Connection error.' : 'Bağlantı hatası.', 'error');
  }
}

async function loadSystemBackupsList(forceOpen = false) {
  const isEn = localDb.settings && localDb.settings.lang === 'en';
  const container = document.getElementById('system-backups-container');
  const tbody = document.getElementById('system-backups-list');
  if (!container || !tbody) return;

  if (!forceOpen && !container.classList.contains('hidden')) {
    container.classList.add('hidden');
    return;
  }

  try {
    const res = await fetch('/api/backups');
    const data = await res.json();
    if (data.success) {
      tbody.innerHTML = '';
      if (data.backups.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" style="padding: 10px; text-align: center; color: var(--text-muted);">${isEn ? 'No backups found.' : 'Henüz saklanan yedek bulunmuyor.'}</td></tr>`;
      } else {
        data.backups.forEach(backup => {
          const tr = document.createElement('tr');
          tr.style.borderBottom = '1px solid rgba(255,255,255,0.05)';
          const isAutoBackup = backup.isAuto || backup.filename.startsWith('auto_') || backup.filename.startsWith('daily_');
          let badgeHtml = '';
          if (backup.isDailyProtected) {
            badgeHtml = `<span style="background: rgba(16, 185, 129, 0.15); border: 1px solid rgba(16, 185, 129, 0.3); color: #10b981; font-size: 0.7rem; padding: 2px 6px; border-radius: 4px; font-weight: 600;">🛡️ ${isEn ? 'Daily Protected' : 'Günlük Korunan'}</span>`;
          } else if (isAutoBackup) {
            badgeHtml = `<span style="background: rgba(168, 85, 247, 0.15); border: 1px solid rgba(168, 85, 247, 0.3); color: #a855f7; font-size: 0.7rem; padding: 2px 6px; border-radius: 4px; font-weight: 600;">🤖 ${isEn ? 'Automatic' : 'Otomatik'}</span>`;
          } else {
            badgeHtml = `<span style="background: rgba(56, 189, 248, 0.15); border: 1px solid rgba(56, 189, 248, 0.3); color: #38bdf8; font-size: 0.7rem; padding: 2px 6px; border-radius: 4px; font-weight: 600;">🖐️ ${isEn ? 'Manual' : 'Manuel'}</span>`;
          }

          tr.innerHTML = `
            <td style="padding: 6px 8px;" title="${backup.filename}">${backup.filename}</td>
            <td style="padding: 6px 8px; color: var(--text-muted);">${backup.size}</td>
            <td style="padding: 6px 8px;">${badgeHtml}</td>
            <td style="padding: 6px 8px; text-align: right; display: flex; gap: 4px; justify-content: flex-end;">
              <button type="button" class="btn btn-secondary btn-xs" onclick="downloadSystemBackup('${backup.filename}')" title="${isEn ? 'Download' : 'İndir'}" style="padding: 2px 6px; font-size: 0.75rem;">
                <i data-lucide="download" style="width:12px;height:12px;"></i>
              </button>
              <button type="button" class="btn btn-secondary btn-xs" onclick="restoreSystemBackup('${backup.filename}')" title="${isEn ? 'Restore' : 'Geri Yükle'}" style="padding: 2px 6px; font-size: 0.75rem; background: rgba(56, 189, 248, 0.1); border-color: rgba(56, 189, 248, 0.2); color: var(--accent-color);">
                ${isEn ? 'Geri Yükle' : 'Geri Yükle'}
              </button>
              <button type="button" class="btn btn-secondary btn-xs" onclick="deleteSystemBackup('${backup.filename}')" title="${isEn ? 'Delete' : 'Sil'}" style="padding: 2px 6px; font-size: 0.75rem; color: #ef4444; border-color: rgba(239, 68, 68, 0.3);">
                <i data-lucide="trash-2" style="width:12px;height:12px;"></i>
              </button>
            </td>
          `;
          tbody.appendChild(tr);
        });
        if (window.lucide) window.lucide.createIcons();
      }
      container.classList.remove('hidden');
    } else {
      showToast(data.error || (isEn ? 'Failed to load backups list.' : 'Yedek listesi yüklenemedi.'), 'error');
    }
  } catch (err) {
    showToast(isEn ? 'Connection error.' : 'Bağlantı hatası.', 'error');
  }
}

function downloadSystemBackup(filename) {
  window.open(`/api/backup/download/${encodeURIComponent(filename)}`, '_blank');
}

async function deleteSystemBackup(filename) {
  const isEn = localDb.settings && localDb.settings.lang === 'en';
  if (!confirm(isEn ? `Are you sure you want to delete the backup file "${filename}"?` : `"${filename}" yedek dosyasını silmek istediğinize emin misiniz?`)) {
    return;
  }

  try {
    const res = await fetch(`/api/backup/${encodeURIComponent(filename)}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.success) {
      showToast(isEn ? 'Backup file deleted.' : 'Yedek dosyası silindi.', 'success');
      loadSystemBackupsList(true);
    } else {
      showToast(data.error || (isEn ? 'Failed to delete backup.' : 'Yedek dosyası silinemedi.'), 'error');
    }
  } catch (err) {
    showToast(isEn ? 'Connection error.' : 'Bağlantı hatası.', 'error');
  }
}

function triggerUploadBackupFile() {
  const input = document.getElementById('backup-file-upload-input');
  if (input) input.click();
}

async function uploadBackupFile(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;
  const isEn = localDb.settings && localDb.settings.lang === 'en';

  if (!confirm(isEn ? `Are you sure you want to restore from "${file.name}"? Current settings and database will be replaced.` : `"${file.name}" dosyasındaki yedeği geri yüklemek istediğinize emin misiniz? Mevcut verilerin üzerine yazılacaktır.`)) {
    event.target.value = '';
    return;
  }

  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      showToast(isEn ? 'Uploading and restoring backup...' : 'Yedek dosyası aktarılıyor ve geri yükleniyor...', 'info');
      const fileData = e.target.result;
      const res = await fetch('/api/restore-upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileData, filename: file.name })
      });
      const data = await res.json();
      if (data.success) {
        showToast(isEn ? 'Backup restored successfully! Reloading...' : 'Yedek başarıyla yüklendi ve geri yüklendi! Sayfa yenileniyor...', 'success');
        setTimeout(() => { window.location.reload(); }, 1500);
      } else {
        showToast(data.error || (isEn ? 'Failed to restore backup file.' : 'Yedek dosyası geri yüklenemedi.'), 'error');
      }
    } catch (err) {
      showToast(isEn ? 'Connection error.' : 'Bağlantı hatası.', 'error');
    } finally {
      event.target.value = '';
    }
  };
  reader.readAsDataURL(file);
}

async function restoreSystemBackup(filename) {
  const isEn = localDb.settings && localDb.settings.lang === 'en';
  if (!confirm(isEn ? `Are you sure you want to restore the backup "${filename}"? Current data will be overwritten.` : `"${filename}" yedeğini geri yüklemek istediğinize emin misiniz? Mevcut verilerin üzerine yazılacaktır.`)) {
    return;
  }

  try {
    showToast(isEn ? 'Restoring backup, please wait...' : 'Yedek geri yükleniyor, lütfen bekleyin...', 'info');
    const res = await fetch('/api/restore', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename })
    });
    const data = await res.json();
    if (data.success) {
      showToast(isEn ? 'Backup restored successfully! Reloading page...' : 'Yedek başarıyla geri yüklendi! Sayfa yenileniyor...', 'success');
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } else {
      showToast(data.error || (isEn ? 'Failed to restore backup.' : 'Yedek geri yüklenemedi.'), 'error');
    }
  } catch (err) {
    showToast(isEn ? 'Connection error.' : 'Bağlantı hatası.', 'error');
  }
}

window.createSystemBackup = createSystemBackup;
window.loadSystemBackupsList = loadSystemBackupsList;
window.restoreSystemBackup = restoreSystemBackup;
window.downloadSystemBackup = downloadSystemBackup;
window.deleteSystemBackup = deleteSystemBackup;
window.triggerUploadBackupFile = triggerUploadBackupFile;
window.uploadBackupFile = uploadBackupFile;

async function updateConcurrentLimit() {
  const select = document.getElementById('queue-concurrent-limit');
  if (!select) return;

  const val = parseInt(select.value, 10);
  const isEn = localDb.settings?.lang === 'en';

  try {
    const res = await fetch('/api/settings/concurrent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ limit: val })
    });
    const data = await res.json();
    if (data.success) {
      showToast(isEn ? `Concurrent downloads limit set to ${val}!` : `Eşzamanlı indirme limiti ${val} olarak ayarlandı!`, 'success');
    }
  } catch (err) {
    console.error('Error updating concurrent limit:', err);
    showToast(isEn ? 'Failed to update concurrent limit.' : 'Eşzamanlı limit güncellenemedi.', 'error');
  }
}

window.updateConcurrentLimit = updateConcurrentLimit;

// Türkçe Açıklama: Mevcut yt-dlp motor sürümünü, kanalını ve tüm GitHub sürümlerini sorgulayarak ayarlar sayfasındaki seçim listesini doldurur.
/**
 * yt-dlp motor sürümünü ve mevcut tüm sürümleri API'den sorgular, arayüzü günceller.
 */
async function fetchYtdlpVersion() {
  const versionEl = document.getElementById('ytdlp-current-version');
  const latestEl = document.getElementById('ytdlp-latest-version');
  const badgeEl = document.getElementById('ytdlp-channel-badge');
  const selectEl = document.getElementById('ytdlp-target-select');
  const btn = document.getElementById('ytdlp-update-btn');
  if (!versionEl) return;

  try {
    const res = await fetch('/api/downloader/ytdlp-version');
    const data = await res.json();
    
    // Yerel Sürüm
    if (data.version) {
      versionEl.textContent = data.version;
    } else {
      versionEl.textContent = '?';
    }

    // Kanal Rozeti
    if (badgeEl) {
      if (data.channel === 'nightly') {
        badgeEl.textContent = '🌙 Nightly (Önerilen)';
        badgeEl.style.background = 'rgba(147, 51, 234, 0.15)';
        badgeEl.style.color = '#c084fc';
        badgeEl.style.borderColor = 'rgba(147, 51, 234, 0.3)';
      } else if (data.channel === 'stable') {
        badgeEl.textContent = '⭐ Kararlı (Stable)';
        badgeEl.style.background = 'rgba(59, 130, 246, 0.15)';
        badgeEl.style.color = '#60a5fa';
        badgeEl.style.borderColor = 'rgba(59, 130, 246, 0.3)';
      } else {
        badgeEl.textContent = 'Bilinmiyor';
      }
    }

    // En Son Sürüm (Uzak Sunucu)
    if (latestEl) {
      if (data.latestNightly) {
        latestEl.textContent = data.latestNightly + ' (Nightly)';
      } else if (data.latestStable) {
        latestEl.textContent = data.latestStable + ' (Stable)';
      } else {
        latestEl.textContent = '-';
      }
    }

    // Sürüm Seçim Dropdown'ını Doldur
    if (selectEl) {
      const nightlyGroup = document.getElementById('optgroup-nightly-history');
      const stableGroup = document.getElementById('optgroup-stable-history');

      if (nightlyGroup) {
        nightlyGroup.innerHTML = '';
        if (data.recentNightly && data.recentNightly.length > 0) {
          data.recentNightly.forEach(item => {
            const opt = document.createElement('option');
            opt.value = `nightly@${item.tag}`;
            opt.textContent = `🌙 Nightly ${item.tag}`;
            nightlyGroup.appendChild(opt);
          });
        }
      }

      if (stableGroup) {
        stableGroup.innerHTML = '';
        if (data.recentStable && data.recentStable.length > 0) {
          data.recentStable.forEach(item => {
            const opt = document.createElement('option');
            opt.value = `stable@${item.tag}`;
            opt.textContent = `⭐ Stable ${item.tag}`;
            stableGroup.appendChild(opt);
          });
        }
      }
    }
  } catch (err) {
    versionEl.textContent = '?';
    if (latestEl) latestEl.textContent = '-';
  }
}

// Türkçe Açıklama: Seçilen yt-dlp sürümüne veya en güncel sürüme günceller / geri alır.
/**
 * Seçilen hedef sürüme göre yt-dlp motorunu günceller.
 */
async function updateYtdlp() {
  const btn = document.getElementById('ytdlp-update-btn');
  const selectEl = document.getElementById('ytdlp-target-select');
  const icon = btn ? btn.querySelector('i') : null;
  const t = translations[currentLang] || translations.tr;

  const target = selectEl ? selectEl.value : 'nightly';

  if (btn) btn.disabled = true;
  if (icon) icon.style.animation = 'spin 1s linear infinite';

  showToast(t.toast_ytdlp_updating || 'yt-dlp güncelleniyor...', 'info');

  try {
    const res = await fetch('/api/downloader/ytdlp-update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target })
    });
    const data = await res.json();

    if (data.success) {
      showToast((t.toast_ytdlp_success || 'yt-dlp başarıyla güncellendi') + (data.newVersion ? ': ' + data.newVersion : ''), 'success');
      fetchYtdlpVersion();
    } else {
      showToast((t.toast_ytdlp_fail || 'yt-dlp güncellemesi başarısız oldu') + (data.error ? ': ' + data.error : ''), 'error');
    }
  } catch (err) {
    showToast((t.toast_ytdlp_fail || 'yt-dlp güncellemesi başarısız oldu') + ': ' + err.message, 'error');
  } finally {
    if (btn) btn.disabled = false;
    if (icon) icon.style.animation = '';
  }
}

window.updateYtdlp = updateYtdlp;
window.fetchYtdlpVersion = fetchYtdlpVersion;

// Sayfa yüklendiğinde yt-dlp sürümünü ve Gist alanlarını otomatik sorgula
document.addEventListener('DOMContentLoaded', () => {
  fetchYtdlpVersion();
  setTimeout(() => {
    populateGistFields();
  }, 500);
});

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
    if (downloadedChannelFilter) downloadedChannelFilter.value = channelId;
    saveDownloadedFilterState();
  } else {
    historyFilterChannel = channelId;
    window.historyFilterChannel = channelId;
    const historyChannelFilter = document.getElementById('history-channel-filter');
    if (historyChannelFilter) historyChannelFilter.value = channelId;
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

  if (selectEl) selectEl.value = value;
  if (dropdown) dropdown.classList.remove('open');

  if (type === 'history') {
    historyFilterChannel = value;
  } else if (type === 'downloaded') {
    downloadedFilterChannel = value;
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

    const currentValue = (type === 'history' ? historyFilterChannel : downloadedFilterChannel) || (selectEl ? selectEl.value : 'all');

    let html = '';
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

// ==========================================
// SİSTEM KONSOLU MODALI
// ==========================================
const consoleModal = document.getElementById('console-modal');
const consoleOutput = document.getElementById('console-output');
const closeConsoleBtn = document.getElementById('close-console-modal-btn');
const clearConsoleBtn = document.getElementById('clear-console-btn');
const navToolsConsoleBtn = document.getElementById('nav-tools-console-btn');

window.openConsoleModal = function() {
  if (consoleModal) {
    consoleModal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    
    // Geçmiş logları çek
    fetch('/api/logs')
      .then(res => res.json())
      .then(logs => {
        if (!consoleOutput) return;
        consoleOutput.innerHTML = ''; // Temizle
        if (logs && logs.length > 0) {
          logs.forEach(log => window.appendLogToConsoleModal(log));
        } else {
          consoleOutput.innerHTML = '<div style="color: #a3a3a3; margin-bottom: 8px;">> Geçmiş log bulunamadı, yeni olaylar bekleniyor...</div>';
        }
      })
      .catch(err => console.error('Log geçmişi alınamadı:', err));
  }
  // Araçlar menüsünü kapat
  const toolsMenu = document.getElementById('tools-menu');
  if (toolsMenu && toolsMenu.classList.contains('show')) {
    toolsMenu.classList.remove('show');
  }
};

window.closeConsoleModal = function() {
  if (consoleModal) {
    consoleModal.classList.add('hidden');
    document.body.style.overflow = '';
  }
};

window.clearConsoleModal = function() {
  if (consoleOutput) {
    consoleOutput.innerHTML = '<div style="color: #a3a3a3; margin-bottom: 8px;">> Konsol temizlendi.</div>';
  }
};

window.appendLogToConsoleModal = function(log) {
  if (!consoleOutput) return;
  const div = document.createElement('div');
  div.style.marginBottom = '4px';
  div.style.wordBreak = 'break-all';
  
  // Renk kodlaması
  let color = '#d4d4d4'; // Varsayılan info
  if (log.type === 'error') color = '#ff4d4d';
  else if (log.type === 'warning' || log.type === 'warn') color = '#ffcc00';
  else if (log.type === 'success') color = '#4af626';
  
  const timeStr = log.timestamp ? new Date(log.timestamp).toLocaleTimeString() : new Date().toLocaleTimeString();
  div.innerHTML = `<span style="color: #666;">[${timeStr}]</span> <span style="color: ${color};">${log.message}</span>`;
  
  consoleOutput.appendChild(div);
  
  // Otomatik aşağı kaydır
  consoleOutput.scrollTop = consoleOutput.scrollHeight;
};

if (navToolsConsoleBtn) {
  navToolsConsoleBtn.addEventListener('click', window.openConsoleModal);
}
if (closeConsoleBtn) {
  closeConsoleBtn.addEventListener('click', window.closeConsoleModal);
}
if (clearConsoleBtn) {
  clearConsoleBtn.addEventListener('click', window.clearConsoleModal);
}

