// Türkçe Açıklama: SSE (/api/events) gerçek zamanlı sunucu olay dinleyicisi ve aktif indirme ilerleme telemetrisi modülü.

let _ctx = {
  getLocalDb: () => window.localDb || { settings: {}, history: [] },
  setLocalDb: (db) => { window.localDb = db; },
  getCurrentLang: () => window.currentLang || 'tr',
  getTranslations: () => window.translations || {},
  updateUI: (db) => window.updateUI && window.updateUI(db),
  showToast: (msg, type, thumb) => window.showToast && window.showToast(msg, type, thumb),
  updateDiskSpace: () => window.updateDiskSpace && window.updateDiskSpace(),
  updateScanProgressToast: (data) => window.updateScanProgressToast && window.updateScanProgressToast(data),
  handleMergeProgressEvent: (data) => window.handleMergeProgressEvent && window.handleMergeProgressEvent(data),
  updateMergeQueueState: (data) => window.updateMergeQueueState && window.updateMergeQueueState(data),
  showDiskWarning: (data) => window.showDiskWarning && window.showDiskWarning(data),
  updateFfmpegInstallUI: (data) => window.updateFfmpegInstallUI && window.updateFfmpegInstallUI(data),
  showUpdateNotification: (data) => window.showUpdateNotification && window.showUpdateNotification(data),
  appendLogToConsoleModal: (data) => window.appendLogToConsoleModal && window.appendLogToConsoleModal(data)
};

let _eventSource = null;

/**
 * app.js ile paylaşılan durum ve UI geri çağrılarını kaydeder.
 * @param {object} ctx
 */
export function registerSseClientContext(ctx) {
  _ctx = { ..._ctx, ...ctx };
}

/**
 * Aktif EventSource bağlantısını döndürür.
 * @returns {EventSource|null}
 */
export function getEventSource() {
  return _eventSource;
}

/**
 * Sunucu SSE (/api/events) akışına bağlanır ve tüm gerçek zamanlı sistem olaylarını yönetir.
 */
export function connectSSE() {
  if (_eventSource) {
    _eventSource.close();
  }

  _eventSource = new EventSource('/api/events');

  _eventSource.onopen = () => {
    const lang = _ctx.getCurrentLang();
    const translations = _ctx.getTranslations();
    const statusIndicator = document.getElementById('status-indicator');
    const connectionStatus = document.getElementById('connection-status');
    if (statusIndicator) statusIndicator.className = 'status-dot online';
    if (connectionStatus) {
      connectionStatus.textContent = lang === 'en' ? 'Connected' : 'Bağlandı';
      connectionStatus.className = 'value text-muted';
    }
    const statusText = document.getElementById('topbar-status-text');
    const badgeConn = document.getElementById('badge-connection');
    const t = translations[lang] || translations.tr || {};
    if (statusText && t.connection_active) statusText.textContent = t.connection_active;
    if (badgeConn && t.connection_active) badgeConn.title = t.connection_active;
    _ctx.updateDiskSpace();

    if (typeof window.checkPendingAutoDeleteOnLoad === 'function') {
      window.checkPendingAutoDeleteOnLoad();
    }
  };

  _eventSource.onerror = () => {
    const lang = _ctx.getCurrentLang();
    const translations = _ctx.getTranslations();
    const statusIndicator = document.getElementById('status-indicator');
    const connectionStatus = document.getElementById('connection-status');
    if (statusIndicator) statusIndicator.className = 'status-dot offline';
    if (connectionStatus) {
      connectionStatus.textContent = lang === 'en' ? 'Connection Lost' : 'Bağlantı Kesildi';
      connectionStatus.className = 'value text-muted';
    }
    const statusText = document.getElementById('topbar-status-text');
    const badgeConn = document.getElementById('badge-connection');
    const t = translations[lang] || translations.tr || {};
    if (statusText && t.connection_lost) statusText.textContent = t.connection_lost;
    if (badgeConn && t.connection_lost) badgeConn.title = t.connection_lost;
  };

  _eventSource.addEventListener('cookie_status', () => {
    if (typeof window.checkYouTubeAuthStatus === 'function') window.checkYouTubeAuthStatus();
  });

  _eventSource.addEventListener('db_update', (e) => {
    const db = JSON.parse(e.data);
    _ctx.setLocalDb(db);
    window.localDb = db;
    _ctx.updateUI(db);
  });

  let historyUiUpdateTimer = null;
  _eventSource.addEventListener('history_updated', (e) => {
    const data = JSON.parse(e.data);
    const { id, updates } = data || {};
    if (!id || !updates) return;
    const localDb = _ctx.getLocalDb();
    if (localDb && Array.isArray(localDb.history)) {
      const item = localDb.history.find(h => h.id === id);
      if (item) Object.assign(item, updates);
    }

    const updateKeys = Object.keys(updates);
    const isOnlyProgressMetrics = updateKeys.length > 0 && updateKeys.every(k => ['progress', 'speed', 'eta', 'fileSize'].includes(k));
    if (isOnlyProgressMetrics) {
      updateActiveDownloadProgress({ id, ...updates });
      const queueBadge = document.querySelector(`.queue-table-row[data-id="${id}"] .queue-item-status-badge span, .queue-item[data-id="${id}"] .queue-item-status-badge span`);
      if (queueBadge && updates.progress !== undefined) {
        queueBadge.textContent = `%${updates.progress}`;
      }
      return;
    }

    if (historyUiUpdateTimer) clearTimeout(historyUiUpdateTimer);
    historyUiUpdateTimer = setTimeout(() => {
      historyUiUpdateTimer = null;
      _ctx.updateUI(_ctx.getLocalDb());
    }, 400);
  });

  _eventSource.addEventListener('progress', (e) => {
    const data = JSON.parse(e.data);
    updateActiveDownloadProgress(data);
    if (typeof window.updateFakapProgress === 'function') window.updateFakapProgress(data);
  });

  _eventSource.addEventListener('channel_scan_progress', (e) => {
    const data = JSON.parse(e.data);
    _ctx.updateScanProgressToast(data);
  });

  _eventSource.addEventListener('remote_status_scan_progress', (e) => {
    try {
      const data = JSON.parse(e.data);
      if (typeof window.handleRemoteStatusScanProgress === 'function') {
        window.handleRemoteStatusScanProgress(data);
      }
    } catch (_) {}
  });

  _eventSource.addEventListener('merge_progress', (e) => {
    try { _ctx.handleMergeProgressEvent(JSON.parse(e.data)); } catch (_) {}
  });
  _eventSource.addEventListener('merge_queue_state', (e) => {
    try { _ctx.updateMergeQueueState(JSON.parse(e.data)); } catch (_) {}
  });

  _eventSource.addEventListener('disk_warning', (e) => {
    _ctx.showDiskWarning(JSON.parse(e.data));
  });

  _eventSource.addEventListener('status_log', (e) => {
    const log = JSON.parse(e.data);
    _ctx.showToast(log.message, log.type, log.thumbnail);

    const localDb = _ctx.getLocalDb();
    if (localDb?.settings?.showNotifications !== false &&
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

  _eventSource.addEventListener('switch_tab', (e) => {
    try {
      const tabName = JSON.parse(e.data);
      if (window.switchTab) window.switchTab(tabName);
    } catch (err) {
      console.error('Sekme geçiş hatası:', err);
    }
  });

  _eventSource.addEventListener('play_video', (e) => {
    try {
      const data = JSON.parse(e.data || '{}');
      if (data && data.id && typeof window.playVideoEmbedded === 'function') {
        window.playVideoEmbedded(data.id);
      }
    } catch (err) {
      console.error('Video oynatma hatası:', err);
    }
  });

  _eventSource.addEventListener('open_webstream', (e) => {
    try {
      const data = JSON.parse(e.data || '{}');
      if (data && data.url) {
        try {
          if (window.chrome && window.chrome.webview && window.chrome.webview.hostObjects && window.chrome.webview.hostObjects.playerBridge) {
            window.chrome.webview.hostObjects.playerBridge.bringToFront();
          }
        } catch (err) {}

        if (typeof window.switchTab === 'function') window.switchTab('webstream');
        setTimeout(() => {
          if (typeof window.playWebStreamUrl === 'function') {
            window.playWebStreamUrl(encodeURIComponent(data.url));
          }
        }, 100);
      }
    } catch (err) {
      console.error('Web stream açma hatası:', err);
    }
  });

  _eventSource.addEventListener('ffmpeg_download', (e) => {
    try {
      _ctx.updateFfmpegInstallUI(JSON.parse(e.data));
    } catch (err) {
      console.error('FFmpeg progress parse error:', err);
    }
  });

  _eventSource.addEventListener('update_status', (e) => {
    try {
      const update = JSON.parse(e.data);
      if (update && update.updateAvailable) {
        _ctx.showUpdateNotification(update);
      }
    } catch (err) {
      console.error('Update status event parse error:', err);
    }
  });

  _eventSource.addEventListener('auto_delete_pending', (e) => {
    try {
      const data = JSON.parse(e.data);
      if (data && Array.isArray(data.videos) && data.videos.length > 0 && typeof window.showAutoDeleteConfirmModal === 'function') {
        window.showAutoDeleteConfirmModal(data.videos);
      }
    } catch (err) {
      console.error('auto_delete_pending parse error:', err);
    }
  });

  _eventSource.addEventListener('terminal_log', (e) => {
    try {
      _ctx.appendLogToConsoleModal(JSON.parse(e.data));
    } catch (err) {}
  });

  _eventSource.addEventListener('terminal_raw', (e) => {
    try {
      const data = JSON.parse(e.data);
      if (typeof window.appendRawLogToConsole === 'function') window.appendRawLogToConsole(data);
    } catch (err) {}
  });
}

/**
 * Aktif indirme ilerlemesini (yüzde, hız, boyut vb.) canlı olarak arayüzde günceller.
 *
 * @param {object} data İlerleme veri nesnesi
 */
export function updateActiveDownloadProgress(data) {
  const noActiveDownload = document.getElementById('no-active-download');
  const activeDownloadDetails = document.getElementById('active-download-details');
  const activeProgressBar = document.getElementById('active-progress-bar');
  const activePercent = document.getElementById('active-percent');
  const activeSize = document.getElementById('active-size');
  const activeEta = document.getElementById('active-eta');
  const activeSpeed = document.getElementById('active-speed');

  if (noActiveDownload) noActiveDownload.classList.add('hidden');
  if (activeDownloadDetails) activeDownloadDetails.classList.remove('hidden');

  if (activeProgressBar) activeProgressBar.style.width = `${data.progress}%`;
  if (activePercent) activePercent.textContent = `${data.progress}%`;
  if (activeSize) activeSize.textContent = data.fileSize || '-- MB';
  if (activeEta) activeEta.textContent = data.eta || '--:--';
  if (activeSpeed) activeSpeed.textContent = data.speed || '0 KB/s';

  const dlFill = document.getElementById('downloader-progress-fill');
  const dlPercent = document.getElementById('downloader-progress-percent');
  const dlSpeed = document.getElementById('downloader-progress-speed');
  const dlEta = document.getElementById('downloader-progress-eta');
  if (dlFill) dlFill.style.width = `${data.progress}%`;
  if (dlPercent) dlPercent.textContent = `${data.progress}%`;
  if (dlSpeed && data.speed) dlSpeed.textContent = data.speed;
  if (dlEta && data.eta) dlEta.textContent = data.eta;

  const thumbImg = document.getElementById('active-thumbnail-img');
  const thumbPlc = document.getElementById('active-thumbnail-placeholder');
  if (thumbImg && thumbPlc && data.id) {
    const thumbUrl = 'https://i.ytimg.com/vi/' + data.id + '/mqdefault.jpg';
    if (thumbImg.style.display === 'none' || !thumbImg.src || thumbImg.src.endsWith('/logo.png')) {
      thumbImg.src = thumbUrl;
      thumbImg.style.display = 'block';
      thumbPlc.style.display = 'none';
    }
  }
}
