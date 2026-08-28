/**
 * Veritabanı ve Arayüz Render Motoru (db-renderer.js)
 * 
 * Yapımcı: HaYTo
 * Açıklama: Sunucu ile Server-Sent Events (SSE) bağlantısını kurar, canlı ilerlemeleri,
 *            istatistikleri (kanallar, indirilenler, kuyruk), video kartları çizimini,
 *            FFmpeg durumunu, kanal/kategori filtreleme dropdownlarını ve uygulama güncellemelerini yönetir.
 * Bağımlılıklar: utils, components ve app.js durum yönetimi.
 */

import { translations } from '../utils/i18n.js';
import { 
  escapeHtml, 
  formatDate, 
  getDaysAgoText, 
  parseSizeToBytes, 
  isShortVideo, 
  parseTimeToSeconds, 
  parseDurationToSeconds,
  isMembersOnlyVideo 
} from '../utils/helpers.js';
import { showToast } from '../components/toast.js';
import { renderVideoGrid } from '../components/videoCard.js';
import { renderChannelsList } from '../components/channelRow.js';
import { applyLanguage } from './i18n-apply.js';
import { 
  applyTheme, 
  performAutoSave, 
  populateGistFields, 
  checkYouTubeAuthStatus 
} from './settings.js';
import { 
  playVideoEmbedded, 
  closePlayerModal, 
  closeInlinePlayer, 
  makeElementDraggable, 
  makeElementResizable, 
  renderDownloadedPlaylist 
} from './player.js';
import { 
  switchTab, 
  pathTabMap, 
  saveHistoryFilterState, 
  restoreHistoryFilterState, 
  saveDownloadedFilterState, 
  restoreDownloadedFilterState 
} from './tab-manager.js';
import { updateScanProgressToast } from './tools.js';

let _getState = null;
let eventSource = null;

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
const settingsQuality = document.getElementById('settings-quality');
const settingsChannelCheckInterval = document.getElementById('settings-channelcheckinterval');
const settingsAutoDownload = document.getElementById('settings-autodownload');
const settingsShortsDurationLimit = document.getElementById('settings-shortsdurationlimit');

// Diğer Butonlar
const syncNowBtn = document.getElementById('sync-now-btn');
const openFolderBtn = document.getElementById('open-folder-btn');
const selectFolderBtn = document.getElementById('select-folder-btn');
const testFolderBtn = document.getElementById('test-folder-btn');

let currentLang = 'tr';
let historyFilterChannel = 'all';
let downloadedFilterChannel = 'all';
let historyFilterDays = 'all';
let historyOnlyNoAutoDownload = false;
let historyOnlyNotDownloaded = false;
let historyShowHidden = false;
let downloadedSortVal = 'date-desc';

export function connectSSE() {
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
    window.window.localDb = db;
  if (_getState?.().localDb) Object.assign(_getState().localDb, db);
    updateUI(db);
  });

  // Tek Kayıt Güncelleme Bildirimi (hedefli — tüm veritabanı yerine yalnızca değişen kayıt)
  eventSource.addEventListener('history_updated', (e) => {
    const data = JSON.parse(e.data);
    const { id, updates } = data || {};
    if (!id || !updates) return;
    const db = window.localDb || {};
    if (db && Array.isArray(db.history)) {
      const item = db.history.find(h => h.id === id);
      if (item) Object.assign(item, updates);
    }
    // Hafif arayüz güncellemesi (sayaçlar + aktif indirme paneli + kuyruk listesi)
    updateUI(db);
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
}

/**
 * Sunucudan GitHub güncelleme durumunu sorgular.
 */
export async function checkApplicationUpdates() {
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

export async function loadAppVersion() {
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
export function showUpdateNotification(update) {
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
export function updateActiveDownloadProgress(data) {
  noActiveDownload.classList.add('hidden');
  activeDownloadDetails.classList.remove('hidden');

  activeProgressBar.style.width = `${data.progress}%`;
  activePercent.textContent = `${data.progress}%`;
  activeSize.textContent = data.fileSize || '-- MB';
  activeEta.textContent = data.eta || '--:--';
  activeSpeed.textContent = data.speed || '0 KB/s';
}


// === FILTER CHIP HELPERS ===
export function toggleFilterChip(checkboxId) {
  const cb = document.getElementById(checkboxId);
  if (!cb) return;
  cb.checked = !cb.checked;
  cb.dispatchEvent(new Event('change'));
  syncFilterChipUI(checkboxId);
}
window.toggleFilterChip = toggleFilterChip;

export function syncFilterChipUI(checkboxId) {
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

// Türkçe Açıklama: Sunucudan veya SSE bağlantısından gelen güncel veritabanı verilerine göre tüm ekran kartlarını, istatistikleri ve listeleri günceller.
/**
 * Veritabanı nesnesine göre arayüzdeki istatistikleri, video listelerini ve ayar formlarını günceller.
 * 
 * @param {object} db Veritabanı veri nesnesi
 */
window.updateUI = updateUI;
export function updateUI(db) {
  if (!db) return;
  window.localDb = db;
  window.window.localDb = db;

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

      const mergingVideos = db.history.filter(h => h.status === 'merging');
      const downloadingVideos = db.history.filter(h => h.status === 'downloading');
      const waitingVideos = db.history.filter(h => h.status === 'waiting');
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
                  <button class="queue-move-btn queue-btn-up ${upDisabled ? 'disabled' : ''}" onclick="moveQueueItem('${video.id}', 'up')" ${upDisabled} title="${t.queue_move_up || 'Yukarı Taşı'}">
                    <i data-lucide="chevron-up" style="width:12px; height:12px;"></i>
                  </button>
                  <button class="queue-move-btn queue-btn-down ${downDisabled ? 'disabled' : ''}" onclick="moveQueueItem('${video.id}', 'down')" ${downDisabled} title="${t.queue_move_down || 'Aşağı Taşı'}">
                    <i data-lucide="chevron-down" style="width:12px; height:12px;"></i>
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
                  <button class="queue-move-btn queue-btn-up ${upDisabled ? 'disabled' : ''}" onclick="moveQueueItem('${video.id}', 'up')" ${upDisabled} title="${t.queue_move_up || 'Yukarı Taşı'}">
                    <i data-lucide="chevron-up" style="width:12px; height:12px;"></i>
                  </button>
                  <button class="queue-move-btn queue-btn-down ${downDisabled ? 'disabled' : ''}" onclick="moveQueueItem('${video.id}', 'down')" ${downDisabled} title="${t.queue_move_down || 'Aşağı Taşı'}">
                    <i data-lucide="chevron-down" style="width:12px; height:12px;"></i>
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

    // 4.2. Son İndirilen Videolar (Son 20)
    const queueCompletedList = document.getElementById('queue-completed-list');
    if (queueCompletedList && db.history) {
      queueCompletedList.innerHTML = '';
      const isEn = db.settings && db.settings.lang === 'en';
      const t = translations[lang] || translations.tr;
      const viewMode = (db.settings && db.settings.queueViewMode) || localStorage.getItem('haytool_queue_view_mode') || 'table';
      
      const completedVideos = db.history
        .filter(h => h.status === 'completed' && h.manualDownloader !== true)
        .sort((a, b) => new Date(b.downloadedAt || 0).getTime() - new Date(a.downloadedAt || 0).getTime())
        .slice(0, 20);

      if (completedVideos.length === 0) {
        queueCompletedList.innerHTML = `
          <div class="text-center text-muted" id="queue-completed-list-empty" style="padding: 30px 0; font-size: 0.85rem;">
            ${t.queue_completed_empty || (isEn ? 'No completed downloads yet.' : 'Henüz tamamlanan indirme yok.')}
          </div>
        `;
      } else {
        if (viewMode === 'table') {
          const compHeader = document.createElement('div');
          compHeader.className = 'queue-table-header completed-header';
          compHeader.innerHTML = `
            <div style="display:flex; align-items:center; gap:4px;"><span>${t.queue_col_order || '#'}</span></div>
            <div>${t.queue_col_cover || 'Kapak'}</div>
            <div>${t.queue_col_title || 'Video Başlığı'}</div>
            <div>${t.queue_col_channel || 'Kanal'}</div>
            <div>${t.queue_col_duration || 'Süre'}</div>
            <div>${t.queue_col_size || 'Boyut'}</div>
            <div>${t.queue_col_downloaded_at || 'İndirilme Zamanı'}</div>
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
            item.className = 'queue-table-row completed-row queue-item-completed';
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
                <span class="queue-meta-pill queue-meta-pill-size" title="${t.queue_col_size || 'Boyut'}">
                  <i data-lucide="hard-drive" style="width:10px; height:10px;"></i>
                  <span>${sizeStr}</span>
                </span>
              </div>
              <div>
                <span class="queue-meta-pill queue-meta-pill-date" title="${t.queue_col_downloaded_at || 'İndirilme Zamanı'}">
                  <i data-lucide="calendar" style="width:10px; height:10px;"></i>
                  <span>${dateStr}</span>
                </span>
              </div>
              <div style="display:flex; align-items:center; justify-content:flex-end; gap:6px;">
                <button class="btn-play-queue" onclick="playVideoEmbedded('${video.id}')" title="${isEn ? 'Play' : 'Oynat'}">
                  <i data-lucide="play" style="width:10px; height:10px;"></i>
                  <span>${isEn ? 'Play' : 'Oynat'}</span>
                </button>
                <button class="btn-cancel-queue" onclick="showDeleteModal('${video.id}')" title="${isEn ? 'Delete' : 'Sil'}" style="padding: 4px 8px;">
                  <i data-lucide="trash-2" style="width: 10px; height: 10px;"></i>
                  <span>${isEn ? 'Delete' : 'Sil'}</span>
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
              <div style="display:flex; align-items:center; gap:8px;">
                <div class="queue-item-status-icon" style="display:flex; align-items:center; justify-content:center; color:#10b981;" title="${isEn ? 'Downloaded' : 'İndirildi'}">
                  <i data-lucide="check-circle" style="width:16px; height:16px; color:#10b981;"></i>
                </div>
                <span class="queue-order-badge" style="background: rgba(16, 185, 129, 0.1); color: #10b981; border-color: rgba(16, 185, 129, 0.25);">${orderNoStr}</span>
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
                  <span class="queue-meta-pill queue-meta-pill-size" title="${t.queue_col_size || 'Boyut'}">
                    <i data-lucide="hard-drive" style="width:10px; height:10px;"></i>
                    <span>${sizeStr}</span>
                  </span>
                  <span class="queue-meta-pill queue-meta-pill-date" title="${t.queue_col_downloaded_at || 'İndirilme Zamanı'}">
                    <i data-lucide="calendar" style="width:10px; height:10px;"></i>
                    <span>${dateStr}</span>
                  </span>
                </div>
              </div>
              <div class="queue-item-actions" style="display:flex; gap:6px;">
                <button class="btn-play-queue" onclick="playVideoEmbedded('${video.id}')" title="${isEn ? 'Play' : 'Oynat'}">
                  <i data-lucide="play" style="width: 10px; height: 10px;"></i>
                  <span>${isEn ? 'Play' : 'Oynat'}</span>
                </button>
                <button class="btn-cancel-queue" onclick="showDeleteModal('${video.id}')" title="${isEn ? 'Delete' : 'Sil'}" style="padding: 4px 8px;">
                  <i data-lucide="trash-2" style="width: 10px; height: 10px;"></i>
                  <span>${isEn ? 'Delete' : 'Sil'}</span>
                </button>
              </div>
            `;
          }

          queueCompletedList.appendChild(item);
        });

        try {
          if (typeof lucide !== 'undefined') {
            lucide.createIcons();
          }
        } catch (e) {}
      }
    }
  }

  // 5. Kanallar Listesi (Alfabetik Sıralı & Filtreli)
  if (channelsList && db.channels) {
    const channelFilters = typeof getChannelActiveFilters === 'function' ? getChannelActiveFilters() : {};
    renderChannelsList(channelsList, db.channels, t, db.categories, channelFilters);
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
  const currentDlSort = window.downloadedSortVal || localStorage.getItem('downloaded-sort-val') || 'date-desc';
  const downloadedSortGroup = document.getElementById('downloaded-sort-group');
  if (downloadedSortGroup) {
    downloadedSortGroup.querySelectorAll('.sort-btn').forEach(b => {
      if (b.getAttribute('data-sort') === currentDlSort) {
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
    syncFilterChipUI('history-show-live');
  }
  const historyShowMembersCheck = document.getElementById('history-show-members');
  if (historyShowMembersCheck) {
    historyShowMembersCheck.checked = window.historyShowMembers !== false;
    syncFilterChipUI('history-show-members');
  }

  // Görünüm butonlarının aktiflik durumunu güncelle
  const currentHistoryMode = window.historyViewMode || 'grid';
  const currentDownloadedMode = window.downloadedViewMode || 'grid';

  const viewGridBtn = document.getElementById('view-grid-btn');
  const viewListBtn = document.getElementById('view-list-btn');
  const downloadedViewGridBtn = document.getElementById('downloaded-view-grid-btn');
  const downloadedViewListBtn = document.getElementById('downloaded-view-list-btn');

  if (viewGridBtn) viewGridBtn.classList.toggle('active', currentHistoryMode === 'grid');
  if (viewListBtn) viewListBtn.classList.toggle('active', currentHistoryMode === 'list');
  
  if (downloadedViewGridBtn) downloadedViewGridBtn.classList.toggle('active', currentDownloadedMode === 'grid');
  if (downloadedViewListBtn) downloadedViewListBtn.classList.toggle('active', currentDownloadedMode === 'list');
  
  if (historyGrid) {
    if (currentHistoryMode === 'list') {
      historyGrid.classList.add('compact-list');
    } else {
      historyGrid.classList.remove('compact-list');
    }
  }

  if (downloadedGrid) {
    if (currentDownloadedMode === 'list') {
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
    
    const curHistoryChannel = window.historyFilterChannel || 'all';
    if (curHistoryChannel !== 'all') {
      if (curHistoryChannel.startsWith('category:')) {
        const catId = parseInt(curHistoryChannel.split(':')[1], 10);
        const channelIdsInCat = (db.channels || []).filter(c => (c.categoryIds || [c.categoryId || 1]).includes(catId)).map(c => c.id);
        const channelIdsInCatSet = new Set(channelIdsInCat);
        filteredHistory = filteredHistory.filter(item => channelIdsInCatSet.has(item.channelId));
      } else {
        filteredHistory = filteredHistory.filter(item => item.channelId === curHistoryChannel);
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
    
    const curHistoryDays = window.historyFilterDays || 'all';
    if (curHistoryDays !== 'all') {
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
          
          if (curHistoryDays === '0') {
            return diffDays <= 0;
          } else if (curHistoryDays === '1') {
            return diffDays === 1;
          } else {
            const maxDays = parseInt(curHistoryDays, 10);
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
    
    renderVideoGrid(historyGrid, filteredHistory, window.historyViewMode || 'grid');
  }

  // İndirilen Videoları filtrele ve çiz (Sadece İndirilenler sekmesi aktifse)
  if (downloadedGrid && db.history && db.settings && isDownloadedActive) {
    let filteredDownloaded = db.history.filter(item => item.status === 'completed');
    
    const curDlChannel = window.downloadedFilterChannel || 'all';
    if (curDlChannel !== 'all') {
      if (curDlChannel.startsWith('category:')) {
        const catId = parseInt(curDlChannel.split(':')[1], 10);
        const channelIdsInCat = (db.channels || []).filter(c => (c.categoryIds || [c.categoryId || 1]).includes(catId)).map(c => c.id);
        const channelIdsInCatSet = new Set(channelIdsInCat);
        filteredDownloaded = filteredDownloaded.filter(item => channelIdsInCatSet.has(item.channelId));
      } else {
        filteredDownloaded = filteredDownloaded.filter(item => item.channelId === curDlChannel);
      }
    }
    
    const showShorts = db.settings.showShorts !== false;
    if (!showShorts) {
      filteredDownloaded = filteredDownloaded.filter(item => !isShortVideo(item.duration, item.title, item.channelId));
    }
    
    // Seçilen kritere göre sırala (Tarih, Boyut veya Kullanıcı)
    const sortVal = window.downloadedSortVal || localStorage.getItem('downloaded-sort-val') || 'date-desc';
    filteredDownloaded.sort((a, b) => {
      if (sortVal === 'user') {
        const customOrder = JSON.parse(localStorage.getItem('downloaded-user-order') || '[]');
        let indexA = customOrder.indexOf(a.id);
        let indexB = customOrder.indexOf(b.id);
        
        if (indexA === -1 && indexB === -1) {
          const dateA = new Date(a.downloadedAt || a.publishedAt || 0).getTime();
          const dateB = new Date(b.downloadedAt || b.publishedAt || 0).getTime();
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
        const dateA = new Date(a.downloadedAt || a.publishedAt || 0).getTime();
        const dateB = new Date(b.downloadedAt || b.publishedAt || 0).getTime();
        return sortVal === 'date-asc' ? dateA - dateB : dateB - dateA;
      }
    });
    
    renderVideoGrid(downloadedGrid, filteredDownloaded, window.downloadedViewMode || 'grid');

    const inlineContainer = document.getElementById('downloaded-inline-player-container');
    if (inlineContainer && !inlineContainer.classList.contains('hidden') && window.currentPlayingVideoId) {
      renderDownloadedPlaylist(window.currentPlayingVideoId);
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
    const activeTheme = localStorage.getItem('haytool_theme') || db.settings?.theme || 'dark';
    applyTheme(activeTheme);
    if (typeof window.initSettingsThemeListener === 'function') {
      window.initSettingsThemeListener();
    }
    
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
  }
  window.historyFilterChannel = 'all';
  if (typeof window.saveHistoryFilterState === 'function') window.saveHistoryFilterState();
  const triggerContent = document.getElementById('history-channel-trigger-content');
  if (triggerContent) {
    triggerContent.innerHTML = '<i data-lucide="globe" style="width:14px;height:14px;color:var(--accent-color);"></i><span>Tüm Kanallar</span>';
    try { if (typeof lucide !== 'undefined') lucide.createIcons(); } catch (e) {}
  }
  updateUI(localDb);
};

window.resetHistoryDurationFilter = function() {
  const durationSelect = document.getElementById('history-duration-filter');
  if (durationSelect) {
    durationSelect.value = 'off';
  }
  if (!localDb.settings) localDb.settings = {};
  localDb.settings.historyDurationFilter = 'off';
  if (typeof window.saveHistoryFilterState === 'function') window.saveHistoryFilterState();
  try {
    fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...localDb.settings, historyDurationFilter: 'off' })
    }).catch(() => {});
  } catch (e) {}
  updateUI(localDb);
};

window.resetHistoryDateFilter = function() {
  const dateSelect = document.getElementById('history-date-filter');
  if (dateSelect) {
    dateSelect.value = 'all';
  }
  window.historyFilterDays = 'all';
  if (typeof window.saveHistoryFilterState === 'function') window.saveHistoryFilterState();
  updateUI(localDb);
};

window.resetDownloadedChannelFilter = function() {
  const filterSelect = document.getElementById('downloaded-channel-filter');
  if (filterSelect) {
    filterSelect.value = 'all';
  }
  window.downloadedFilterChannel = 'all';
  if (typeof window.saveDownloadedFilterState === 'function') window.saveDownloadedFilterState();
  const triggerContent = document.getElementById('downloaded-channel-trigger-content');
  if (triggerContent) {
    triggerContent.innerHTML = '<i data-lucide="globe" style="width:14px;height:14px;color:var(--accent-color);"></i><span>Tüm Kanallar</span>';
    try { if (typeof lucide !== 'undefined') lucide.createIcons(); } catch (e) {}
  }
  updateUI(localDb);
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



async function updateMetadata(type) {
  const isEn = localDb.settings && localDb.settings.lang === 'en';
  showToast(isEn ? 'Metadata update started...' : 'Metadata güncellemesi başlatıldı...', 'info');
  try {
    const res = await fetch('/api/library/update-metadata', { 
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type })
    });
    const data = await res.json();
    if (data.success) {
      showToast(isEn ? `Metadata updated! Evaluated ${data.count} items.` : `Metadata güncellendi! ${data.count} öğe denetlendi.`, 'success');
      loadDb(); // refresh the UI
    } else {
      showToast(data.message || (isEn ? 'Update failed' : 'Güncelleme başarısız'), 'error');
    }
  } catch (err) {
    showToast(isEn ? 'Error occurred' : 'Hata oluştu', 'error');
    console.error(err);
  }
}



window.showDeleteModal = function(id) {
  const item = localDb.history.find(h => h.id === id);
  if (!item) return;

  videoIdToDelete = id;
  const isEn = localDb.settings && localDb.settings.lang === 'en';
  deleteModalMsg.innerHTML = isEn 
    ? `Are you sure you want to remove <strong>"${escapeHtml(item.title)}"</strong> from download history?`
    : `<strong>"${escapeHtml(item.title)}"</strong> başlıklı videoyu geçmişten kaldırmak istediğinize emin misiniz?`;
  
  // Bilgisayardan dosya silme kutusunu göster
  const checkboxContainers = deleteModal.querySelectorAll('.checkbox-container');
  checkboxContainers.forEach(c => c.classList.remove('hidden'));
  if (deleteFileCheckbox) deleteFileCheckbox.checked = true;
  
  // YouTube'da izlendi olarak işaretleme tercihi (settings / localStorage)
  const markWatchedCb = document.getElementById('mark-watched-checkbox');
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

  deleteModal.classList.remove('hidden');
};

/**
 * Silme onay modalını kapatır ve seçili video ID'sini sıfırlar.
 */
function hideDeleteModal() {
  deleteModal.classList.add('hidden');
  videoIdToDelete = null;
}

if (closeDeleteModalBtn) closeDeleteModalBtn.addEventListener('click', hideDeleteModal);
if (cancelDeleteBtn) cancelDeleteBtn.addEventListener('click', hideDeleteModal);

// Silme Onaylama Butonu Dinleyicisi
if (confirmDeleteBtn) {
  confirmDeleteBtn.addEventListener('click', async () => {
    if (!videoIdToDelete) return;
    
    const id = videoIdToDelete;
    const deleteFile = deleteFileCheckbox ? deleteFileCheckbox.checked : true;
    const markWatchedCb = document.getElementById('mark-watched-checkbox');
    const markWatched = markWatchedCb ? markWatchedCb.checked : false;

    // Tercihi kalıcı olarak sakla
    localStorage.setItem('haytool_mark_watched_on_delete', String(markWatched));
    if (localDb.settings && localDb.settings.markWatchedOnDelete !== markWatched) {
      localDb.settings.markWatchedOnDelete = markWatched;
      try {
        fetch('/api/settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(localDb.settings)
        }).catch(() => {});
      } catch (e) {}
    }

    hideDeleteModal();
    
    const isEn = localDb.settings && localDb.settings.lang === 'en';
    
    // OPTİMİSTİK UI: Video kartını anında DOM'dan kaldır
    const itemIndex = localDb.history.findIndex(h => h.id === id);
    let backupItem = null;
    if (itemIndex !== -1) {
      backupItem = localDb.history[itemIndex];
      localDb.history.splice(itemIndex, 1);
      if (typeof updateUI === 'function') updateUI(localDb);
    }
    
    // FILE LOCK DÜZELTMESİ: Silinecek video oynatılıyorsa, önce oynatıcıyı kapat
    if (id === window.currentPlayingVideoId) {
      if (window.closePlayerModal) window.closePlayerModal();
      if (window.closeInlinePlayer) window.closeInlinePlayer();
      // Dosya kilitlerinin Windows ve tarayıcı tarafından tamamen bırakılması için kısa bir süre bekle
      await new Promise(resolve => setTimeout(resolve, 300));
    }
    
    try {
      // showToast(isEn ? 'Processing deletion...' : 'İşlem gerçekleştiriliyor...', 'info'); // Artık gerek yok, anında silindi gibi görünüyor.
      const res = await fetch(`/api/history/${id}?deleteFile=${deleteFile}&markWatched=${markWatched}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (data.success) {
        setTimeout(updateDiskSpace, 1500); 
      } else {
        // Hata: Kartı geri getir
        if (backupItem) {
          localDb.history.push(backupItem);
          if (typeof updateUI === 'function') updateUI(localDb);
        }
        showToast(data.error || (isEn ? 'Deletion failed.' : 'Silme işlemi başarısız oldu.'), 'error');
      }
    } catch (err) {
      // Ağ hatası: Kartı geri getir
      if (backupItem) {
        localDb.history.push(backupItem);
        if (typeof updateUI === 'function') updateUI(localDb);
      }
      showToast(isEn ? 'Communication error.' : 'Sunucu ile iletişim hatası.', 'error');
    }
  });
}

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
});


  const historyShowShorts = document.getElementById('history-show-shorts');
  if (historyShowShorts) {
    historyShowShorts.addEventListener('change', async () => {
      const showShorts = historyShowShorts.checked;
      syncFilterChipUI('history-show-shorts');
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
      if (histCheckbox) histCheckbox.checked = showShorts;

      const settCheckbox = document.getElementById('settings-showshorts');
      if (settCheckbox) settCheckbox.checked = showShorts;

      if (typeof saveDownloadedFilterState === 'function') saveDownloadedFilterState();
      updateUI(localDb);
      if (currentPlayingVideoId) {
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
      const currentSort = window.downloadedSortVal || localStorage.getItem('downloaded-sort-val') || 'date-desc';
      const newSort = currentSort === 'date-desc' ? 'date-asc' : 'date-desc';
      window.downloadedSortVal = newSort;
      localStorage.setItem('downloaded-sort-val', newSort);
      if (typeof window.saveDownloadedFilterState === 'function') window.saveDownloadedFilterState();
      // UI güncelle
      updateUI(localDb);
      if (currentPlayingVideoId) {
        renderDownloadedPlaylist(currentPlayingVideoId);
      }
    });
  }

  const btnSortSize = document.getElementById('inline-btn-sort-size');
  if (btnSortSize) {
    btnSortSize.addEventListener('click', () => {
      const currentSort = window.downloadedSortVal || localStorage.getItem('downloaded-sort-val') || 'date-desc';
      const newSort = currentSort === 'size-desc' ? 'size-asc' : 'size-desc';
      window.downloadedSortVal = newSort;
      localStorage.setItem('downloaded-sort-val', newSort);
      if (typeof window.saveDownloadedFilterState === 'function') window.saveDownloadedFilterState();
      // UI güncelle
      updateUI(localDb);
      if (currentPlayingVideoId) {
        renderDownloadedPlaylist(currentPlayingVideoId);
      }
    });
  }

  const btnSortUser = document.getElementById('inline-btn-sort-user');
  if (btnSortUser) {
    btnSortUser.addEventListener('click', () => {
      window.downloadedSortVal = 'user';
      localStorage.setItem('downloaded-sort-val', 'user');
      if (typeof window.saveDownloadedFilterState === 'function') window.saveDownloadedFilterState();
      // UI güncelle
      updateUI(localDb);
      if (currentPlayingVideoId) {
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
      
      // UI'yı yerel olarak güncelle
      updateUI(localDb);
      if (currentPlayingVideoId) {
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
  if (!confirm('Bu videoyu indirme sırasından çıkarmak istediğinizden emin misiniz?')) return;
  
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
export async function updateDiskSpace() {
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

// Türkçe Açıklama: Üst bardaki hava durumu rozetini API'den çekilen anlık sıcaklık ve ikon verileriyle günceller.
/**
 * Hava durumu bilgilerini /api/weather üzerinden sorgular ve üst bardaki rozete yansıtır.
 * 
 * @param {boolean} [force=false] Önbelleği atlayarak taze veri isteği
 * @returns {Promise<void>}
 */

export async function updateWeatherBadge(force = false) {
  const badge = document.getElementById('badge-weather');
  const display = document.getElementById('weather-display');
  const iconEl = document.getElementById('weather-icon');
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
      
      if (iconEl) {
        iconEl.setAttribute('data-lucide', data.icon || 'sun');
        if (typeof lucide !== 'undefined') lucide.createIcons();
      }

      const langKey = data.descKey || 'weather_partly_cloudy';
      const desc = (typeof i18n !== 'undefined' && i18n.t) ? i18n.t(langKey) : data.defaultDesc;
      const feelsLikeLabel = (typeof i18n !== 'undefined' && i18n.t) ? i18n.t('weather_feels_like') : 'Hissedilen';
      const humidityLabel = (typeof i18n !== 'undefined' && i18n.t) ? i18n.t('weather_humidity') : 'Nem';
      const windLabel = (typeof i18n !== 'undefined' && i18n.t) ? i18n.t('weather_wind') : 'Rüzgar';

      badge.title = `${data.city}: ${desc} (${data.temp}${data.unit})\n${feelsLikeLabel}: ${data.feelsLike}${data.unit} | ${humidityLabel}: %${data.humidity} | ${windLabel}: ${data.windSpeed} km/s\n(Tıklayarak Yenileyin)`;
    } else if (data.enabled === false) {
      badge.style.display = 'none';
    } else {
      display.textContent = '--°';
    }
  } catch (err) {
    display.textContent = '--°';
  }
}

// Hava Durumu Rozeti ve Ayar Butonları Dinleyicileri
document.addEventListener('DOMContentLoaded', () => {
  const badgeWeather = document.getElementById('badge-weather');
  if (badgeWeather) {
    badgeWeather.addEventListener('click', async () => {
      showToast('Hava durumu güncelleniyor...', 'info');
      await updateWeatherBadge(true);
      showToast('Hava durumu güncellendi.', 'success');
    });
  }

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

/**
 * Kanallar sekmesindeki aktif arama ve filtre seçimlerini nesne olarak döner.
 * @returns {{ searchQuery: string, autoDownload: string, shortsDownload: string }}
 */
export function getChannelActiveFilters() {
  const searchInput = document.getElementById('channel-list-search-input');
  const autoSelect = document.getElementById('filter-channel-auto-download');
  const shortsSelect = document.getElementById('filter-channel-shorts-download');

  return {
    searchQuery: searchInput ? searchInput.value : '',
    autoDownload: autoSelect ? autoSelect.value : 'all',
    shortsDownload: shortsSelect ? shortsSelect.value : 'all'
  };
}
window.getChannelActiveFilters = getChannelActiveFilters;

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
/**
 * Kuyruk listesindeki videoyu yukarı veya aşağı taşır.
 * 
 * @param {string} videoId Taşınacak videonun ID'si
 * @param {'up' | 'down'} direction Taşıma yönü
 */
window.moveQueueItem = function(videoId, direction) {
  const list = document.getElementById('queue-list');
  if (!list) return;

  const items = Array.from(list.querySelectorAll('[data-id]'));
  const currentIndex = items.findIndex(el => el.getAttribute('data-id') === videoId);
  if (currentIndex === -1) return;

  const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
  if (targetIndex < 0 || targetIndex >= items.length) return;

  const currentEl = items[currentIndex];
  const targetEl = items[targetIndex];

  // Birleştirme (merging) durumundaki video taşınamaz
  if (currentEl.classList.contains('queue-item-merging') || targetEl.classList.contains('queue-item-merging')) {
    return;
  }

  if (direction === 'up') {
    list.insertBefore(currentEl, targetEl);
  } else {
    targetEl.after(currentEl);
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
    const upBtn = item.querySelector('.queue-btn-up');
    const downBtn = item.querySelector('.queue-btn-down');
    if (upBtn) {
      upBtn.disabled = (idx === 0);
      upBtn.classList.toggle('disabled', idx === 0);
    }
    if (downBtn) {
      downBtn.disabled = (idx === total - 1);
      downBtn.classList.toggle('disabled', idx === total - 1);
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


// Türkçe Açıklama: Takip edilen kanallar yedek listesini dışarı aktarmak için browser download tetikler.
function exportChannels() {
  window.location.href = '/api/channels/export';
}

// Türkçe Açıklama: Dosya seçici input penceresini tetikler.
function triggerImportFile() {
  const fileInput = document.getElementById('import-file-input');
  if (fileInput) {
    fileInput.click();
  }
}

// Türkçe Açıklama: Seçilen yedek JSON dosyasını okuyup backend'e aktararak kanalları içe aktarır.
async function importChannels(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async function(e) {
    try {
      const backupData = JSON.parse(e.target.result);
      if (!backupData || !Array.isArray(backupData.channels)) {
        showToast(localDb.settings.lang === 'en' ? 'Invalid backup file structure.' : 'Geçersiz yedek dosyası yapısı.', 'error');
        return;
      }

      const importMode = document.getElementById('import-mode').value;
      const overwrite = importMode === 'overwrite';

      const res = await fetch('/api/channels/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          overwrite: overwrite,
          channels: backupData.channels
        })
      });

      const data = await res.json();
      if (data.success) {
        const msg = localDb.settings.lang === 'en'
          ? `Backup imported successfully! Added: ${data.added}, Updated: ${data.updated}`
          : `Yedek başarıyla içeri aktarıldı! Eklenen: ${data.added}, Güncellenen: ${data.updated}`;
        showToast(msg, 'success');
      } else {
        showToast(data.error || (localDb.settings.lang === 'en' ? 'Import failed.' : 'İçeri aktarma başarısız.'), 'error');
      }
    } catch (err) {
      console.error('Yedek okuma hatası:', err);
      showToast(localDb.settings.lang === 'en' ? 'Failed to read backup file.' : 'Yedek dosyası okunamadı.', 'error');
    } finally {
      event.target.value = '';
    }
  };
  reader.readAsText(file);
}

// Custom Select Dropdown with Flags (Windows Compatibility)
function initCustomSelect() {
  const trigger = document.getElementById('lang-select-trigger');
  const optionsContainer = document.getElementById('lang-custom-options');
  const hiddenInput = document.getElementById('settings-lang');
  const selectedFlag = document.getElementById('selected-lang-flag');
  const selectedText = document.getElementById('selected-lang-text');

  if (!trigger || !optionsContainer || !hiddenInput) return;

  // Çift bağlamayı önle: modül import ve initDbRenderer iki kez çağırabilir,
  // aksi halde tek tıklamada toggle iki kez çalışır ve menü asla açılmaz.
  if (trigger.dataset.customSelectInit) return;
  trigger.dataset.customSelectInit = '1';

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

export async function checkFfmpegStatus() {
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

// Initial drag-and-drop list sortable containers setup
initDragAndDrop();

// Initial icons trigger
lucide.createIcons();

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

export function populateChannelFilters(db) {
  const targetDb = db || localDb || {};
  const channels = targetDb.channels || [];
  const categories = targetDb.categories || [];
  const lang = localDb.settings?.lang || currentLang || 'tr';
  const t = translations[lang] || translations.tr;

  const defaultNames = {
    1: ["Genel", "General"], 2: ["Oyun", "Gaming"], 3: ["Eğitim", "Education"],
    4: ["Müzik", "Music"], 5: ["Teknoloji", "Technology"], 6: ["Spor", "Sports"],
    7: ["Sinema & Film", "Movies & Cinema"], 8: ["Haberler & Siyaset", "News & Politics"],
    9: ["Eğlence", "Entertainment"], 10: ["Bilim", "Science"], 11: ["Gezi & Yaşam", "Travel & Life"],
    12: ["Komedi", "Comedy"], 13: ["Belgesel", "Documentary"], 14: ["Anime & Çizgi Film", "Anime & Cartoon"],
    15: ["Finans & Ekonomi", "Finance & Economy"], 16: ["League of Legends", "League of Legends"], 17: ["Podcast", "Podcast"]
  };

  const getCatTranslatedName = (cat) => {
    let catName = cat.name;
    if (cat.id >= 1 && cat.id <= 17) {
      const list = defaultNames[cat.id];
      if (list && (cat.name === list[0] || cat.name === list[1] || !cat.name)) {
        catName = t[`category_${cat.id}`] || cat.name;
      }
    }
    return catName;
  };

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
        return getCatTranslatedName(a).localeCompare(getCatTranslatedName(b), lang, { sensitivity: 'base' });
      });

      sortedFilterCats.forEach(cat => {
        const catName = getCatTranslatedName(cat);
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



export function initDragAndDrop() {
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


// State variables for folder comparison


export function initDbRenderer(getState) {
  _getState = getState;

  // SSE Bağlantısı
  connectSSE();

  // Başlangıç kontrolleri
  initCustomSelect();
  checkFfmpegStatus();
  updateDiskSpace();
  if (typeof updateWeatherBadge === 'function') updateWeatherBadge();
  loadAppVersion();
  checkApplicationUpdates();
  
  setInterval(updateDiskSpace, 60 * 60 * 1000);
  if (typeof updateWeatherBadge === 'function') {
    setInterval(() => updateWeatherBadge(), 15 * 60 * 1000);
  }

  // Oynatıcıyı sürüklenebilir ve yeniden boyutlandırılabilir yap
  const modalContent = document.querySelector('#player-modal .player-modal-content');
  const modalHeader = document.querySelector('#player-modal .modal-header');
  if (modalContent && modalHeader) {
    makeElementDraggable(modalContent, modalHeader);
    makeElementResizable(modalContent);
  }

  // Sürükle ve bırak listeleri
  initDragAndDrop();

  // İkonları oluştur
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

if (typeof window !== 'undefined') {
  window.connectSSE = connectSSE;
  window.updateUI = updateUI;
  window.updateDiskSpace = updateDiskSpace;
  window.checkFfmpegStatus = checkFfmpegStatus;
  window.populateChannelFilters = populateChannelFilters;
  window.initDragAndDrop = initDragAndDrop;
}
