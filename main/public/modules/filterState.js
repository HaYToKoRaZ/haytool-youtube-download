// Türkçe Açıklama: Kütüphane ve İndirilenler sekmelerinin filtre çipleri, sıralama ve görünüm kalıcılığı modülü.

let _ctx = {
  getLocalDb: () => window.localDb || { settings: {} },
  getHistoryViewMode: () => window.historyViewMode || 'grid',
  getHistorySortMode: () => window.historySortMode || 'date-desc',
  setHistorySortMode: (v) => { window.historySortMode = v; },
  getDownloadedSortVal: () => window.downloadedSortVal || 'date-desc',
  setDownloadedSortVal: (v) => { window.downloadedSortVal = v; },
  getDownloadedViewMode: () => window.downloadedViewMode || 'grid',
  getDownloadedOnlyResume: () => !!window.downloadedOnlyPartiallyWatched,
  setDownloadedOnlyResume: (v) => { window.downloadedOnlyPartiallyWatched = !!v; },
  getDownloadedOnlyRemoteChanged: () => !!window.downloadedOnlyRemoteChanged,
  setDownloadedOnlyRemoteChanged: (v) => { window.downloadedOnlyRemoteChanged = !!v; },
  setDownloadedFilterChannel: (v) => { window.downloadedFilterChannel = v; }
};

/**
 * app.js ile paylaşılan filtre ve sıralama state bağlamını kaydeder.
 * @param {object} ctx
 */
export function registerFilterStateContext(ctx) {
  _ctx = { ..._ctx, ...ctx };
}

/**
 * Kütüphane sekmesi filtre ve görünüm durumunu hem localStorage'a hem sunucudaki INI ayarlarına kaydeder.
 */
export function saveHistoryFilterState() {
  try {
    const durationSelect = document.getElementById('history-duration-filter');
    const dateSelect = document.getElementById('history-date-filter');
    const showShortsCb = document.getElementById('history-show-shorts');
    const showLiveCb = document.getElementById('history-show-live');
    const showUpcomingCb = document.getElementById('history-show-upcoming');
    const showMembersCb = document.getElementById('history-show-members');
    const noAutoDlCb = document.getElementById('history-only-no-auto-download');
    const notDownloadedCb = document.getElementById('history-only-not-downloaded');
    const onlyLiveProcessingCb = document.getElementById('history-only-live-processing');
    const showHiddenCb = document.getElementById('history-show-hidden');

    const state = {
      duration: durationSelect ? durationSelect.value : 'off',
      date: dateSelect ? dateSelect.value : (window.historyFilterDays || 'all'),
      showShorts: showShortsCb ? showShortsCb.checked : false,
      showLive: showLiveCb ? showLiveCb.checked : (window.historyShowLive !== false),
      showUpcoming: showUpcomingCb ? showUpcomingCb.checked : !!window.historyShowUpcoming,
      showMembers: showMembersCb ? showMembersCb.checked : (window.historyShowMembers !== false),
      noAutoDownload: noAutoDlCb ? noAutoDlCb.checked : !!window.historyOnlyNoAutoDownload,
      notDownloaded: notDownloadedCb ? notDownloadedCb.checked : !!window.historyOnlyNotDownloaded,
      onlyLiveProcessing: onlyLiveProcessingCb ? onlyLiveProcessingCb.checked : !!window.historyOnlyLiveProcessing,
      showHidden: showHiddenCb ? showHiddenCb.checked : !!window.historyShowHidden,
      viewMode: _ctx.getHistoryViewMode()
    };

    localStorage.setItem('haytool_history_filters_v2', JSON.stringify(state));

    const localDb = _ctx.getLocalDb();
    if (localDb && localDb.settings) {
      const iniPatch = {
        showShorts: state.showShorts !== false,
        historyShowLive: state.showLive !== false,
        historyShowUpcoming: !!state.showUpcoming,
        historyShowMembers: state.showMembers !== false,
        historyOnlyNoAutoDownload: !!state.noAutoDownload,
        historyOnlyNotDownloaded: !!state.notDownloaded,
        historyOnlyLiveProcessing: !!state.onlyLiveProcessing,
        historyShowHidden: !!state.showHidden
      };
      Object.assign(localDb.settings, iniPatch);
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

/**
 * Kütüphane sekmesi filtre ve sıralama ayarlarını INI (öncelikli) ve localStorage üzerinden geri yükler.
 */
export function restoreHistoryFilterState() {
  try {
    const localDb = _ctx.getLocalDb();
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

    const dbHistorySort = localDb.settings && localDb.settings.historySortMode;
    const storedHistorySort = localStorage.getItem('history-sort-val');
    if (dbHistorySort || storedHistorySort) {
      const nextSort = dbHistorySort || storedHistorySort || 'date-desc';
      _ctx.setHistorySortMode(nextSort);
      window.historySortMode = nextSort;
      const sortGroup = document.getElementById('history-sort-group');
      if (sortGroup) {
        sortGroup.querySelectorAll('.sort-btn').forEach(b => {
          const ds = b.getAttribute('data-sort');
          const isActive = ds === nextSort || (ds === 'date' && String(nextSort).startsWith('date-'));
          b.classList.toggle('active', isActive);
        });
        const dateLabel = document.getElementById('history-sort-date-label');
        if (dateLabel) dateLabel.textContent = nextSort === 'date-asc' ? 'Tarih ▲' : 'Tarih ▼';
      }
    }

    const ini = localDb.settings || {};
    const iniHas = {
      showLive: ini.historyShowLive !== undefined,
      showUpcoming: ini.historyShowUpcoming !== undefined,
      noAutoDownload: ini.historyOnlyNoAutoDownload !== undefined,
      notDownloaded: ini.historyOnlyNotDownloaded !== undefined,
      onlyLiveProcessing: ini.historyOnlyLiveProcessing !== undefined,
      showMembers: ini.historyShowMembers !== undefined,
      showHidden: ini.historyShowHidden !== undefined
    };
    if (iniHas.showLive) window.historyShowLive = ini.historyShowLive !== false;
    if (iniHas.showUpcoming) window.historyShowUpcoming = ini.historyShowUpcoming === true;
    if (iniHas.noAutoDownload) window.historyOnlyNoAutoDownload = ini.historyOnlyNoAutoDownload;
    if (iniHas.notDownloaded) window.historyOnlyNotDownloaded = ini.historyOnlyNotDownloaded;
    if (iniHas.onlyLiveProcessing) window.historyOnlyLiveProcessing = ini.historyOnlyLiveProcessing;
    if (iniHas.showMembers) window.historyShowMembers = ini.historyShowMembers;
    if (iniHas.showHidden) window.historyShowHidden = ini.historyShowHidden;

    const raw = localStorage.getItem('haytool_history_filters_v2');
    if (!raw) return;
    const state = JSON.parse(raw);

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

    if (state.showLive !== undefined && !iniHas.showLive) window.historyShowLive = state.showLive !== false;
    if (state.showUpcoming !== undefined && !iniHas.showUpcoming) window.historyShowUpcoming = !!state.showUpcoming;
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
      'history-show-live': window.historyShowLive !== false,
      'history-show-upcoming': !!window.historyShowUpcoming,
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
        if (typeof window.syncFilterChipUI === 'function') window.syncFilterChipUI(id);
      }
    }

    if (typeof window.updateHistoryFiltersCount === 'function') window.updateHistoryFiltersCount();

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

/**
 * İndirilenler sekmesi filtre, sıralama ve arama durumunu localStorage ve configwin.ini'ye kaydeder.
 */
export function saveDownloadedFilterState() {
  try {
    const channelSelect = document.getElementById('downloaded-channel-filter');
    const showShortsCb = document.getElementById('downloaded-show-shorts');
    const searchInput = document.getElementById('downloaded-search-input');

    let chosenChannel = window.downloadedFilterChannel || (channelSelect ? channelSelect.value : 'all');
    if (!chosenChannel || chosenChannel.trim() === '') {
      chosenChannel = 'all';
    }

    const state = {
      channel: chosenChannel,
      sortVal: _ctx.getDownloadedSortVal(),
      showShorts: showShortsCb ? showShortsCb.checked : false,
      viewMode: _ctx.getDownloadedViewMode(),
      onlyResume: _ctx.getDownloadedOnlyResume(),
      onlyRemoteChanged: _ctx.getDownloadedOnlyRemoteChanged(),
      searchQuery: searchInput ? searchInput.value : ''
    };

    localStorage.setItem('haytool_downloaded_filters_v2', JSON.stringify(state));

    const localDb = _ctx.getLocalDb();
    if (localDb && localDb.settings) {
      const iniPatch = {
        downloadedFilterChannel: state.channel,
        downloadedSortMode: state.sortVal,
        downloadedShowShorts: state.showShorts,
        downloadedViewMode: state.viewMode,
        downloadedOnlyResume: state.onlyResume,
        downloadedSearchQuery: state.searchQuery
      };
      Object.assign(localDb.settings, iniPatch);
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

/**
 * İndirilenler sekmesi filtre ve sıralama durumunu INI ve localStorage'dan geri yükler.
 */
export function restoreDownloadedFilterState() {
  try {
    const localDb = _ctx.getLocalDb();
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
      const initialSort = localDb.settings.downloadedSortMode === 'auto-delete' ? 'date-desc' : localDb.settings.downloadedSortMode;
      _ctx.setDownloadedSortVal(initialSort);
      window.downloadedSortVal = initialSort;
      localStorage.setItem('downloaded-sort-val', initialSort);
      if (typeof window.syncDownloadedSortButtons === 'function') window.syncDownloadedSortButtons(initialSort);
      if (typeof window.updateSidebarSortButtons === 'function') window.updateSidebarSortButtons();
    }

    const ini = localDb.settings || {};
    const hasValidIniChannel = ini.downloadedFilterChannel && typeof ini.downloadedFilterChannel === 'string' && ini.downloadedFilterChannel.trim() !== '' && ini.downloadedFilterChannel !== 'all';
    const iniHasDl = {
      channel: hasValidIniChannel,
      onlyResume: ini.downloadedOnlyResume !== undefined,
      showShorts: ini.downloadedShowShorts !== undefined,
      searchQuery: ini.downloadedSearchQuery !== undefined
    };

    if (iniHasDl.channel) {
      window.downloadedFilterChannel = ini.downloadedFilterChannel;
      _ctx.setDownloadedFilterChannel(ini.downloadedFilterChannel);
      if (typeof window.parseDownloadedFilterString === 'function') {
        window.downloadedFilterState = window.parseDownloadedFilterString(ini.downloadedFilterChannel);
      }
      const channelSelectEl = document.getElementById('downloaded-channel-filter');
      if (channelSelectEl) channelSelectEl.value = ini.downloadedFilterChannel;
    } else {
      window.downloadedFilterChannel = 'all';
      _ctx.setDownloadedFilterChannel('all');
      window.downloadedFilterState = { mode: 'include', categories: [], channels: [], platform: 'all' };
      const channelSelectEl = document.getElementById('downloaded-channel-filter');
      if (channelSelectEl) channelSelectEl.value = 'all';
    }

    if (iniHasDl.onlyResume) {
      const onlyResume = !!ini.downloadedOnlyResume;
      _ctx.setDownloadedOnlyResume(onlyResume);
      window.downloadedOnlyPartiallyWatched = onlyResume;
      const resumeBtn = document.getElementById('downloaded-filter-resume-btn');
      if (resumeBtn) resumeBtn.classList.toggle('active', onlyResume);
    }

    if (iniHasDl.searchQuery && ini.downloadedSearchQuery) {
      const searchInput = document.getElementById('downloaded-search-input');
      if (searchInput && !searchInput.value) searchInput.value = ini.downloadedSearchQuery;
    }

    const raw = localStorage.getItem('haytool_downloaded_filters_v2');
    if (!raw) return;
    const state = JSON.parse(raw);

    const channelSelect = document.getElementById('downloaded-channel-filter');
    if (channelSelect && state.channel && state.channel.trim() !== '' && !iniHasDl.channel) {
      channelSelect.value = state.channel;
      window.downloadedFilterChannel = state.channel;
      _ctx.setDownloadedFilterChannel(state.channel);
      if (typeof window.parseDownloadedFilterString === 'function') {
        window.downloadedFilterState = window.parseDownloadedFilterString(state.channel);
      }
    }

    if (state.sortVal && !(localDb.settings && localDb.settings.downloadedSortMode)) {
      _ctx.setDownloadedSortVal(state.sortVal);
      window.downloadedSortVal = state.sortVal;
      localStorage.setItem('downloaded-sort-val', state.sortVal);
      if (typeof window.syncDownloadedSortButtons === 'function') window.syncDownloadedSortButtons(state.sortVal);
      if (typeof window.updateSidebarSortButtons === 'function') window.updateSidebarSortButtons();
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
      const onlyResume = !!state.onlyResume;
      _ctx.setDownloadedOnlyResume(onlyResume);
      window.downloadedOnlyPartiallyWatched = onlyResume;
      const resumeBtn = document.getElementById('downloaded-filter-resume-btn');
      if (resumeBtn) {
        resumeBtn.classList.toggle('active', onlyResume);
      }
    }

    if (state.onlyRemoteChanged !== undefined) {
      const onlyRemoteChanged = !!state.onlyRemoteChanged;
      _ctx.setDownloadedOnlyRemoteChanged(onlyRemoteChanged);
      window.downloadedOnlyRemoteChanged = onlyRemoteChanged;
      const remoteBtn = document.getElementById('downloaded-filter-remote-changed-btn');
      if (remoteBtn) {
        remoteBtn.classList.toggle('active', onlyRemoteChanged);
      }
    }

    if (state.searchQuery && !iniHasDl.searchQuery) {
      const searchInput = document.getElementById('downloaded-search-input');
      if (searchInput && !searchInput.value) searchInput.value = state.searchQuery;
    }

    if (typeof window.updateDownloadedViewButtonUI === 'function') {
      window.updateDownloadedViewButtonUI();
    }
    if (typeof window.syncDownloadedSortButtons === 'function') {
      window.syncDownloadedSortButtons();
    }
    const shortsChipBtn = document.getElementById('btn-dl-show-shorts');
    if (shortsChipBtn) {
      const showShortsEl = document.getElementById('downloaded-show-shorts');
      const isShorts = !!(showShortsEl && showShortsEl.checked);
      shortsChipBtn.classList.toggle('active', isShorts);
    }
  } catch (err) {
    console.error('restoreDownloadedFilterState error:', err);
  }
}
