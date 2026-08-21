/**
 * Sekme ve Navigasyon Yönetimi Modülü (tab-manager.js)
 * 
 * Yapımcı: HaYTo
 * Açıklama: SPA sekme geçişleri (switchTab), URL geçmişi (HTML5 History API popstate),
 *            sekme bazlı oynatıcı geçişleri, filtre durumu saklama/geri yükleme
 *            (Kütüphane & İndirilenler filtreleri, grid/list görünümleri, sıralama butonları).
 * Bağımlılıklar: app.js getState() fonksiyonu ile localDb, currentLang, translations erişimi sağlanır.
 */

import { isShortVideo } from '../utils/helpers.js';

let _getState = null;

export const tabPathMap = {
  history: '/home',
  queue: '/download',
  downloaded: '/downlist',
  channels: '/channels',
  settings: '/settings',
  iptv: '/iptv',
  tools: '/tools',
  downloader: '/downloader'
};

export const pathTabMap = {
  '/home': 'history',
  '/download': 'queue',
  '/downlist': 'downloaded',
  '/channels': 'channels',
  '/settings': 'settings',
  '/iptv': 'iptv',
  '/tools': 'tools',
  '/downloader': 'downloader'
};

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

export function switchTab(targetTab, triggerPushState = true) {
  window.switchTab = switchTab;
  
  // Gecersiz veya bos tab kontrolu (pd-btn gibi data-tab olmayan nav-itemlar)
  if (!targetTab || !tabPathMap[targetTab]) {
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
    if (window.stopAllIptvPlayers) window.stopAllIptvPlayers();
    if (window.clearIptvChannelList) window.clearIptvChannelList();
    // IPTV durum kontrol interval'ini durdur
    if (typeof iptvStatusInterval !== 'undefined' && iptvStatusInterval) {
      clearInterval(iptvStatusInterval);
      iptvStatusInterval = null;
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
let historyFilterChannel = 'all'; // all veya kanalId
let historyFilterDays = 'all'; // all, 0, 1, 2, 3, 4, 5
let historyOnlyNoAutoDownload = false;
let historyOnlyNotDownloaded = false;
let historyShowHidden = false;
let downloadedViewMode = 'grid'; // grid veya list
let downloadedFilterChannel = 'all'; // all veya kanalId

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

// Türkçe Açıklama: SPA yönlendirmeleri için sekmeler arası gezinme ve HTML5 History API entegrasyonu.




// Türkçe Açıklama: Aktif oynatıcı tipine (ArtPlayer, Plyr, HTML5) göre oynatım saniyesini ve paused durumunu alır.
/**
 * Aktif oynatıcının zamanını ve oynatılma durumunu döndürür.
 * 
 * @returns {{currentTime: number, paused: boolean}}
 */
export function getCurrentPlaybackState() {
  const pType = (localDb.settings && localDb.settings.playerType) || 'plyr';
  const player = document.getElementById('embedded-video-player');
  
  let currentTime = 0;
  let paused = true;
  
  if (pType === 'artplayer' && videoPlayerInstance) {
    currentTime = videoPlayerInstance.currentTime || 0;
    paused = videoPlayerInstance.paused;
  } else if (pType === 'html5' && player) {
    currentTime = player.currentTime || 0;
    paused = player.paused;
  } else if (videoPlayerInstance) {
    currentTime = videoPlayerInstance.currentTime || 0;
    paused = videoPlayerInstance.paused;
  } else if (player) {
    currentTime = player.currentTime || 0;
    paused = player.paused;
  }
  
  return { currentTime, paused };
}

// Türkçe Açıklama: Arayüzdeki sekme başlıklarını ve sekme içeriklerini aktif/pasif yapar.
/**
 * Sekme elemanlarının CSS sınıflarını günceller.
 * 
 * @param {string} targetTab Hedef sekme adı
 */
export function performTabSwitchUI(targetTab) {
  const toolsDropdown = document.getElementById('tools-dropdown');
  if (toolsDropdown) {
    if (targetTab === 'downloader' || targetTab === 'tools') {
      toolsDropdown.classList.add('active');
    } else {
      toolsDropdown.classList.remove('active');
    }
  }

  navItems.forEach(n => {
    if (n.getAttribute('data-tab') === targetTab) {
      n.classList.add('active');
    } else {
      n.classList.remove('active');
    }
  });

  tabContents.forEach(content => {
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


// === FILTER PERSISTENCE SYSTEM (KÜTÜPHANE & İNDİRİLENLER) ===
export function saveHistoryFilterState() {
  try {
    const channelSelect = document.getElementById('history-channel-filter');
    const durationSelect = document.getElementById('history-duration-filter');
    const dateSelect = document.getElementById('history-date-filter');
    const showShortsCb = document.getElementById('history-show-shorts');
    const showLiveCb = document.getElementById('history-show-live');
    const showMembersCb = document.getElementById('history-show-members');
    const noAutoDlCb = document.getElementById('history-only-no-auto-download');
    const notDownloadedCb = document.getElementById('history-only-not-downloaded');
    const showHiddenCb = document.getElementById('history-show-hidden');

    const state = {
      channel: channelSelect ? channelSelect.value : (window.historyFilterChannel || 'all'),
      duration: durationSelect ? durationSelect.value : 'off',
      date: dateSelect ? dateSelect.value : (window.historyFilterDays || 'all'),
      showShorts: showShortsCb ? showShortsCb.checked : false,
      showLive: showLiveCb ? showLiveCb.checked : true,
      showMembers: showMembersCb ? showMembersCb.checked : (window.historyShowMembers !== false),
      noAutoDownload: noAutoDlCb ? noAutoDlCb.checked : !!window.historyOnlyNoAutoDownload,
      notDownloaded: notDownloadedCb ? notDownloadedCb.checked : !!window.historyOnlyNotDownloaded,
      showHidden: showHiddenCb ? showHiddenCb.checked : !!window.historyShowHidden,
      viewMode: typeof historyViewMode !== 'undefined' ? historyViewMode : 'grid'
    };

    localStorage.setItem('haytool_history_filters_v2', JSON.stringify(state));
  } catch (err) {
    console.error('saveHistoryFilterState error:', err);
  }
}
window.saveHistoryFilterState = saveHistoryFilterState;

export function restoreHistoryFilterState() {
  try {
    const raw = localStorage.getItem('haytool_history_filters_v2');
    if (!raw) return;
    const state = JSON.parse(raw);

    if (state.channel !== undefined) {
      window.historyFilterChannel = state.channel;
      const channelSelect = document.getElementById('history-channel-filter');
      if (channelSelect) channelSelect.value = state.channel;
    }

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

    if (state.noAutoDownload !== undefined) window.historyOnlyNoAutoDownload = !!state.noAutoDownload;
    if (state.notDownloaded !== undefined) window.historyOnlyNotDownloaded = !!state.notDownloaded;
    if (state.showMembers !== undefined) window.historyShowMembers = state.showMembers !== false;
    if (state.showHidden !== undefined) window.historyShowHidden = !!state.showHidden;

    const checkMap = {
      'history-show-shorts': state.showShorts,
      'history-show-live': state.showLive,
      'history-show-members': window.historyShowMembers !== false,
      'history-only-no-auto-download': window.historyOnlyNoAutoDownload,
      'history-only-not-downloaded': window.historyOnlyNotDownloaded,
      'history-show-hidden': window.historyShowHidden
    };

    for (const [id, val] of Object.entries(checkMap)) {
      if (val !== undefined) {
        const cb = document.getElementById(id);
        if (cb) cb.checked = !!val;
        if (typeof syncFilterChipUI === 'function') syncFilterChipUI(id);
      }
    }

    const effectiveMode = (localDb.settings && localDb.settings.historyViewMode) || state.viewMode || localStorage.getItem('haytool_history_view_mode') || 'grid';
    window.historyViewMode = effectiveMode;
    const viewGridBtn = document.getElementById('view-grid-btn');
    const viewListBtn = document.getElementById('view-list-btn');
    if (viewGridBtn && viewListBtn) {
      viewGridBtn.classList.toggle('active', effectiveMode === 'grid');
      viewListBtn.classList.toggle('active', effectiveMode === 'list');
    }
    const gridEl = document.getElementById('history-grid');
    if (gridEl) {
      if (effectiveMode === 'list') {
        gridEl.classList.add('compact-list');
      } else {
        gridEl.classList.remove('compact-list');
      }
    }
  } catch (err) {
    console.error('restoreHistoryFilterState error:', err);
  }
}
window.restoreHistoryFilterState = restoreHistoryFilterState;

export function saveDownloadedFilterState() {
  try {
    const channelSelect = document.getElementById('downloaded-channel-filter');
    const showShortsCb = document.getElementById('downloaded-show-shorts');

    const state = {
      channel: channelSelect ? channelSelect.value : 'all',
      sortVal: typeof downloadedSortVal !== 'undefined' ? downloadedSortVal : 'date-desc',
      showShorts: showShortsCb ? showShortsCb.checked : false,
      viewMode: typeof downloadedViewMode !== 'undefined' ? downloadedViewMode : 'grid'
    };

    localStorage.setItem('haytool_downloaded_filters_v2', JSON.stringify(state));
  } catch (err) {
    console.error('saveDownloadedFilterState error:', err);
  }
}
window.saveDownloadedFilterState = saveDownloadedFilterState;
  window.setHistoryViewMode = setHistoryViewMode;
  window.setDownloadedViewMode = setDownloadedViewMode;

export function restoreDownloadedFilterState() {
  try {
    const raw = localStorage.getItem('haytool_downloaded_filters_v2');
    if (!raw) return;
    const state = JSON.parse(raw);

    const channelSelect = document.getElementById('downloaded-channel-filter');
    if (channelSelect && state.channel) {
      channelSelect.value = state.channel;
      window.downloadedFilterChannel = state.channel;
    }

    if (state.sortVal) {
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
    if (showShortsCb && state.showShorts !== undefined) {
      showShortsCb.checked = !!state.showShorts;
      const inlineCb = document.getElementById('inline-playlist-show-shorts');
      if (inlineCb) inlineCb.checked = !!state.showShorts;
    }

    const effectiveDlMode = (localDb.settings && localDb.settings.downloadedViewMode) || state.viewMode || localStorage.getItem('haytool_downloaded_view_mode') || 'grid';
    window.downloadedViewMode = effectiveDlMode;
    const gridBtn = document.getElementById('downloaded-view-grid-btn');
    const listBtn = document.getElementById('downloaded-view-list-btn');
    if (gridBtn && listBtn) {
      gridBtn.classList.toggle('active', effectiveDlMode === 'grid');
      listBtn.classList.toggle('active', effectiveDlMode === 'list');
    }
    const dlGridEl = document.getElementById('downloaded-grid');
    if (dlGridEl) {
      if (effectiveDlMode === 'list') {
        dlGridEl.classList.add('compact-list');
      } else {
        dlGridEl.classList.remove('compact-list');
      }
    }
  } catch (err) {
    console.error('restoreDownloadedFilterState error:', err);
  }
}
window.restoreDownloadedFilterState = restoreDownloadedFilterState;

// Sıralama Butonları Dinleyicisi
let downloadedSortVal = localStorage.getItem('downloaded-sort-val') || 'date-desc';
document.addEventListener('click', (e) => {
  const btn = e.target.closest('.sort-btn');
  if (btn && btn.closest('#downloaded-sort-group')) {
    const sortVal = btn.getAttribute('data-sort');
    downloadedSortVal = sortVal;
    localStorage.setItem('downloaded-sort-val', downloadedSortVal);
    saveDownloadedFilterState();
    
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


/**
 * Tab Manager olay dinleyicilerini ve başlatıcılarını bağlar.
 */



/**
 * Kütüphane sekmesi görünüm modunu (grid/list) ayarlar, ini dosyasına kaydeder ve anında UI'ı günceller.
 * @param {'grid'|'list'} mode 
 */
export function setHistoryViewMode(mode) {
  window.historyViewMode = mode;
  if (!localDb.settings) localDb.settings = {};
  localDb.settings.historyViewMode = mode;
  try { localStorage.setItem('haytool_history_view_mode', mode); } catch (e) {}

  // configwin.ini dosyasına kalıcı olarak kaydet
  try {
    fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...localDb.settings, historyViewMode: mode })
    }).catch(() => {});
  } catch (e) {}

  saveHistoryFilterState();

  const vGrid = document.getElementById('view-grid-btn');
  const vList = document.getElementById('view-list-btn');
  if (vGrid) vGrid.classList.toggle('active', mode === 'grid');
  if (vList) vList.classList.toggle('active', mode === 'list');
  
  const gridEl = document.getElementById('history-grid');
  if (gridEl) {
    if (mode === 'list') {
      gridEl.classList.add('compact-list');
    } else {
      gridEl.classList.remove('compact-list');
    }
  }

  if (typeof window.updateUI === 'function') {
    window.updateUI(localDb);
  }
}

/**
 * İndirilenler sekmesi görünüm modunu (grid/list) ayarlar, ini dosyasına kaydeder ve anında UI'ı günceller.
 * @param {'grid'|'list'} mode 
 */
export function setDownloadedViewMode(mode) {
  window.downloadedViewMode = mode;
  if (!localDb.settings) localDb.settings = {};
  localDb.settings.downloadedViewMode = mode;
  try { localStorage.setItem('haytool_downloaded_view_mode', mode); } catch (e) {}

  // configwin.ini dosyasına kalıcı olarak kaydet
  try {
    fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...localDb.settings, downloadedViewMode: mode })
    }).catch(() => {});
  } catch (e) {}

  saveDownloadedFilterState();

  const vGrid = document.getElementById('downloaded-view-grid-btn');
  const vList = document.getElementById('downloaded-view-list-btn');
  if (vGrid) vGrid.classList.toggle('active', mode === 'grid');
  if (vList) vList.classList.toggle('active', mode === 'list');
  
  const gridEl = document.getElementById('downloaded-grid');
  if (gridEl) {
    if (mode === 'list') {
      gridEl.classList.add('compact-list');
    } else {
      gridEl.classList.remove('compact-list');
    }
  }

  if (typeof window.updateUI === 'function') {
    window.updateUI(localDb);
  }
}


export function initTabManager(getState) {
  _getState = getState;

  // Sekme Dinleyicileri (Delegation)
  document.addEventListener('click', (e) => {
    // 1. Sekme Değiştirme
    const navItem = e.target.closest('.nav-item[data-tab]');
    if (navItem) {
      const targetTab = navItem.getAttribute('data-tab');
      switchTab(targetTab, true);
      return;
    }

    // 2. Kütüphane Görünüm Modu Butonları
    if (e.target.closest('#view-grid-btn')) {
      setHistoryViewMode('grid');
      return;
    }
    if (e.target.closest('#view-list-btn')) {
      setHistoryViewMode('list');
      return;
    }

    // 3. İndirilenler Görünüm Modu Butonları
    if (e.target.closest('#downloaded-view-grid-btn')) {
      setDownloadedViewMode('grid');
      return;
    }
    if (e.target.closest('#downloaded-view-list-btn')) {
      setDownloadedViewMode('list');
      return;
    }

    // 4. İndirilenler Sıralama Butonları
    const sortBtn = e.target.closest('#downloaded-sort-group .sort-btn');
    if (sortBtn) {
      const sortVal = sortBtn.getAttribute('data-sort');
      if (sortVal) {
        window.downloadedSortVal = sortVal;
        localStorage.setItem('downloaded-sort-val', sortVal);
        saveDownloadedFilterState();
        const group = document.getElementById('downloaded-sort-group');
        if (group) {
          group.querySelectorAll('.sort-btn').forEach(b => b.classList.toggle('active', b === sortBtn));
        }
        if (typeof window.updateUI === 'function') window.updateUI(localDb);
      }
    }
  });

  // Tarayıcı Geri/İleri Buton Dinleyicisi
  window.addEventListener('popstate', (event) => {
    const tabId = (event.state && event.state.tab) || pathTabMap[window.location.pathname] || 'history';
    switchTab(tabId, false);
  });

  // Filtre Değişim Dinleyicileri
  document.addEventListener('change', (e) => {
    if (e.target && e.target.id === 'history-channel-filter') {
      window.historyFilterChannel = e.target.value;
      saveHistoryFilterState();
      if (typeof window.updateUI === 'function') window.updateUI(localDb);
    } else if (e.target && e.target.id === 'history-date-filter') {
      window.historyFilterDays = e.target.value;
      saveHistoryFilterState();
      if (typeof window.updateUI === 'function') window.updateUI(localDb);
    } else if (e.target && e.target.id === 'downloaded-channel-filter') {
      window.downloadedFilterChannel = e.target.value;
      saveDownloadedFilterState();
      if (typeof window.updateUI === 'function') window.updateUI(localDb);
    }
  });
}

if (typeof window !== 'undefined') {
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
}
