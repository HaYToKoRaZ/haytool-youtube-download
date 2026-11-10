/**
 * IPTV Modülü - HaYTooL YouTube Downloader
 * 
 * Yapımcı: HaYTo
 * Açıklama: Modern Canlı TV OSD (On-Screen Display), kesintisiz DVR / Timeshift,
 *           bağımsız arka plan PVR kayıt motoru ve 4'lü çoklu ekran yönetimi.
 */

// ─── Modül-içi Durum Değişkenleri ───
let iptvPlayers = [null, null, null, null]; // Slot 0..3
let activeIptvSlot = 0;
let iptvIsLoading = false;
let iptvSearchQuery = '';
let iptvSelectedCountry = '';
let iptvSelectedCategory = '';
let iptvStatusInterval = null;
let isRestoringIptv = false;
let iptvCurrentPage = 1;
let iptvTotalPages = 1;
let iptvTotalCount = 0;
let iptvIsAppending = false;
let iptvFavorites = new Set();
let iptvPvrSessions = [null, null, null, null]; // Slot 0..3
let iptvLoadAllAtOnce = false;
try {
  iptvLoadAllAtOnce = localStorage.getItem('haytool_iptv_load_all') === 'true';
} catch (e) {}
let iptvChunkRenderTimer = null;
let iptvStreamTimeoutSec = 8; // Varsayılan: 8 saniye (her açılışta 8s olarak başlar)
let iptvGlobalVolume = 1.0; // Kullanıcının genel ses seviyesi
let iptvUserExplicitlyMuted = false; // Kullanıcı sesi kendisi kapatmadıkça kanallar açık sesle başlar

// Favorileri LocalStorage'dan yükle
try {
  const savedFavs = JSON.parse(localStorage.getItem('haytool_iptv_favorites') || '[]');
  if (Array.isArray(savedFavs)) {
    iptvFavorites = new Set(savedFavs);
  }
} catch (e) {}

// ─── IPTV İstemci Önbelleği (IndexedDB) ───
let _iptvDbPromise = null;
function openIptvDb() {
  if (_iptvDbPromise) return _iptvDbPromise;
  _iptvDbPromise = new Promise((resolve) => {
    if (typeof indexedDB === 'undefined') return resolve(null);
    try {
      const req = indexedDB.open('haytool_iptv_db', 1);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('channels_cache')) {
          db.createObjectStore('channels_cache', { keyPath: 'id' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  return _iptvDbPromise;
}

async function getIptvCache(key) {
  try {
    const db = await openIptvDb();
    if (!db) return null;
    return new Promise((resolve) => {
      const tx = db.transaction('channels_cache', 'readonly');
      const store = tx.objectStore('channels_cache');
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result ? req.result.payload : null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

async function setIptvCache(key, payload) {
  try {
    const db = await openIptvDb();
    if (!db) return;
    const tx = db.transaction('channels_cache', 'readwrite');
    const store = tx.objectStore('channels_cache');
    store.put({ id: key, payload, timestamp: Date.now() });
  } catch {}
}

export async function clearIptvCache() {
  try {
    const db = await openIptvDb();
    if (!db) return;
    const tx = db.transaction('channels_cache', 'readwrite');
    const store = tx.objectStore('channels_cache');
    store.clear();
  } catch {}
}

// getState: app.js'den alınan localDb ve currentLang erişimi için
let _getState = null;
let _iptvInitialized = false;

// ─── HLS Kütüphanesi (hls.js) Tembel Yükleme ───
let _hlsLoadPromise = null;
function ensureHlsLoaded() {
  if (typeof Hls !== 'undefined') return Promise.resolve(true);
  if (_hlsLoadPromise) return _hlsLoadPromise;
  _hlsLoadPromise = new Promise((resolve) => {
    const script = document.createElement('script');
    script.src = '/hls.min.js';
    script.async = true;
    script.onload = () => resolve(typeof Hls !== 'undefined');
    script.onerror = () => { _hlsLoadPromise = null; resolve(false); };
    document.head.appendChild(script);
  });
  return _hlsLoadPromise;
}

/**
 * Yerel veritabanına ve ayarlara güvenli erişim sağlar.
 */
function getLocalDb() {
  const state = typeof _getState === 'function' ? _getState() : null;
  return state?.localDb || window.localDb || { settings: { lang: 'tr' } };
}

/**
 * 2 harfli ISO ülke kodundan Unicode bayrak üretir.
 */
export function getCountryFlag(countryCode) {
  if (!countryCode || typeof countryCode !== 'string' || countryCode.length !== 2) return '';
  const code = countryCode.toUpperCase();
  const first = code.charCodeAt(0);
  const second = code.charCodeAt(1);
  if (first < 65 || first > 90 || second < 65 || second > 90) return '';
  return String.fromCodePoint(127397 + first, 127397 + second);
}

/**
 * Standart SVG bayrak HTML üretir.
 */
export function getCountryFlagHtml(countryCode, className = 'iptv-flag-img') {
  if (!countryCode || typeof countryCode !== 'string' || countryCode.length !== 2) return '';
  const lower = countryCode.toLowerCase();
  const emoji = getCountryFlag(countryCode);
  return `<img class="${className}" src="https://flagcdn.com/w40/${lower}.png" alt="${countryCode.toUpperCase()}" loading="lazy" onerror="this.outerHTML='<span class=\\'iptv-flag-fallback\\'>${emoji}</span>';">`;
}

/**
 * Ülke adını geçerli dilde döner.
 */
export function getCountryName(countryCode) {
  if (!countryCode || countryCode.length !== 2) return countryCode || '';
  try {
    const localDb = getLocalDb();
    const lang = localDb.settings?.lang || 'tr';
    const dn = new Intl.DisplayNames([lang], { type: 'region' });
    return dn.of(countryCode.toUpperCase()) || countryCode.toUpperCase();
  } catch (e) {
    return countryCode.toUpperCase();
  }
}

/**
 * Saniyeyi HH:MM:SS veya MM:SS formatına dönüştürür.
 */
function formatTime(totalSeconds) {
  const s = Math.max(0, Math.floor(totalSeconds));
  const sec = s % 60;
  const min = Math.floor((s / 60) % 60);
  const hrs = Math.floor(s / 3600);
  const pad = (n) => String(n).padStart(2, '0');
  if (hrs > 0) return `${pad(hrs)}:${pad(min)}:${pad(sec)}`;
  return `${pad(min)}:${pad(sec)}`;
}

/**
 * i18n çeviri yardımcısı.
 */
function getTranslation(key, fallback) {
  try {
    const lang = getLocalDb()?.settings?.lang || 'tr';
    if (typeof translations !== 'undefined' && translations[lang] && translations[lang][key]) {
      return translations[lang][key];
    }
  } catch (e) {}
  return fallback;
}

// ─── IPTV Modülü Başlatıcı ───

export function initIptv(getState) {
  if (getState) _getState = getState;
  if (_iptvInitialized) return;
  _iptvInitialized = true;

  // Slot tıklama → aktif slot seç
  document.querySelectorAll('.iptv-slot').forEach(slot => {
    slot.addEventListener('click', (e) => {
      if (e.target.closest('.iptv-osd-overlay') || e.target.closest('.slot-controls')) return;
      selectIptvSlot(parseInt(slot.getAttribute('data-slot'), 10));
    });
  });

  // Slot üstü aksiyon butonları: pvr, swap, clear
  document.querySelectorAll('.iptv-slot').forEach(slot => {
    const slotIndex = parseInt(slot.getAttribute('data-slot'), 10);
    slot.querySelector('.pvr-rec-btn')?.addEventListener('click', (e) => { e.stopPropagation(); toggleIptvPvr(slotIndex); });
    slot.querySelector('.swap-slot-btn')?.addEventListener('click', (e) => { e.stopPropagation(); swapIptvSportModePlayers(); });
    slot.querySelector('.clear-btn')?.addEventListener('click', (e) => { e.stopPropagation(); clearIptvSlot(slotIndex); });
  });

  // Yerleşim modu butonları
  const singleBtn = document.getElementById('iptv-single-view-btn');
  const dualBtn   = document.getElementById('iptv-dual-view-btn');
  const quadBtn   = document.getElementById('iptv-quad-view-btn');
  const sportBtn  = document.getElementById('iptv-sport-view-btn');
  const gridEl    = document.getElementById('iptv-players-grid');

  const setLayout = (mode, activeBtn) => {
    resetIptvSlotStyles();
    gridEl.classList.remove('swapped-mode', 'single-mode', 'dual-mode', 'quad-mode', 'sport-mode');
    gridEl.classList.add(mode);
    [singleBtn, dualBtn, quadBtn, sportBtn].forEach(b => b?.classList.remove('active'));
    activeBtn?.classList.add('active');

    if (mode === 'single-mode') {
      // Tekli ekrana dönüldüğünde: Slot 0 aktif seçilir
      selectIptvSlot(0);
      // Diğer slotlardaki (1, 2, 3) arka planda çalan ve sesi gelen yayınlar anında kapatılır
      for (let i = 1; i < 4; i++) {
        if (iptvPlayers[i]) {
          clearIptvSlot(i, false);
        }
      }
    } else if (mode === 'dual-mode' || mode === 'sport-mode') {
      if (activeIptvSlot > 1) selectIptvSlot(0);
      // İkili ekrana dönüldüğünde Slot 2 ve 3 kapatılır
      for (let i = 2; i < 4; i++) {
        if (iptvPlayers[i]) {
          clearIptvSlot(i, false);
        }
      }
    }

    updateIptvSwapBtnVisibility();
    if (!isRestoringIptv) saveIptvState();
  };

  if (gridEl) {
    singleBtn?.addEventListener('click', () => setLayout('single-mode', singleBtn));
    dualBtn?.addEventListener('click',   () => setLayout('dual-mode',   dualBtn));
    quadBtn?.addEventListener('click',   () => setLayout('quad-mode',   quadBtn));
    sportBtn?.addEventListener('click',  () => setLayout('sport-mode',  sportBtn));
  }

  // Grid tam ekran
  document.getElementById('iptv-grid-fullscreen-btn')?.addEventListener('click', () => {
    if (!document.fullscreenElement) {
      gridEl?.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  });

  // Kısayollar Rehberi Butonu
  document.getElementById('iptv-shortcuts-btn')?.addEventListener('click', () => {
    if (typeof window.openShortcutsModal === 'function') {
      window.openShortcutsModal('iptv');
    }
  });

  // Arama Girişi & Temizleme Butonu
  const searchInput = document.getElementById('iptv-search-input');
  const searchClear = document.getElementById('iptv-search-clear-btn');
  let searchTimer = null;

  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      iptvSearchQuery = e.target.value.trim();
      if (searchClear) searchClear.classList.toggle('hidden', !iptvSearchQuery);
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => {
        loadIptvChannels();
      }, 180);
    });
  }

  if (searchClear) {
    searchClear.addEventListener('click', (e) => {
      e.stopPropagation();
      if (searchInput) {
        searchInput.value = '';
        searchInput.focus();
      }
      iptvSearchQuery = '';
      searchClear.classList.add('hidden');
      loadIptvChannels();
    });
  }

  // Kategori Hapları (Pills)
  document.querySelectorAll('.iptv-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      document.querySelectorAll('.iptv-pill').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');

      const cat = pill.getAttribute('data-category');
      const country = pill.getAttribute('data-country');

      if (country) {
        iptvSelectedCountry = country;
        iptvSelectedCategory = '';
      } else if (cat === 'favorites') {
        iptvSelectedCategory = 'favorites';
        iptvSelectedCountry = '';
      } else if (cat !== null && cat !== undefined) {
        iptvSelectedCategory = cat;
        iptvSelectedCountry = '';
      } else {
        iptvSelectedCategory = '';
        iptvSelectedCountry = '';
      }

      updateCustomCountryTriggerUI(iptvSelectedCountry);
      updateCustomCategoryTriggerUI(iptvSelectedCategory);
      loadIptvChannels();
    });
  });

  // Ülke ve Kategori Dropdown Seçicileri
  setupCustomDropdowns();

  // Daha Fazla Yükle Butonu
  document.getElementById('iptv-load-more-btn')?.addEventListener('click', () => {
    iptvCurrentPage++;
    loadIptvChannels(true);
  });

  // Tüm Kanalları Tek Seferde Yükleme Toggle Butonu
  const loadAllBtn = document.getElementById('iptv-load-all-toggle-btn');
  if (loadAllBtn) {
    loadAllBtn.classList.toggle('active', iptvLoadAllAtOnce);
    loadAllBtn.addEventListener('click', () => {
      iptvLoadAllAtOnce = !iptvLoadAllAtOnce;
      try {
        localStorage.setItem('haytool_iptv_load_all', iptvLoadAllAtOnce);
      } catch (e) {}
      loadAllBtn.classList.toggle('active', iptvLoadAllAtOnce);
      const isEn = getLocalDb().settings?.lang === 'en';
      if (typeof showToast === 'function') {
        const msg = iptvLoadAllAtOnce
          ? (isEn ? 'Load all channels at once: ON' : 'Tüm kanalları tek seferde yükleme: AÇIK')
          : (isEn ? 'Paginated loading (150 per page): ON' : 'Kademeli sayfalama (150şer): AÇIK');
        showToast(msg, 'info');
      }
      loadIptvChannels();
    });
  }

  // Rastgele Kanal Açma Butonu
  document.getElementById('iptv-random-btn')?.addEventListener('click', () => {
    playRandomIptvChannel();
  });

  // Kanal Bağlantı Zaman Aşımı Seçicisi (Varsayılan: 8 sn)
  const timeoutSelect = document.getElementById('iptv-timeout-select');
  const timeoutBadge = document.getElementById('iptv-timeout-badge');
  if (timeoutSelect) {
    timeoutSelect.value = '8';
    iptvStreamTimeoutSec = 8;
    timeoutSelect.addEventListener('change', (e) => {
      iptvStreamTimeoutSec = parseInt(e.target.value, 10) || 8;
    });
  }
  if (timeoutBadge) {
    timeoutBadge.title = getTranslation('iptv_timeout_tooltip', timeoutBadge.title);
  }

  // IPTV Güncelleme Butonu
  document.getElementById('iptv-update-btn')?.addEventListener('click', async () => {
    const isEn = getLocalDb().settings?.lang === 'en';
    try {
      if (typeof showToast === 'function') showToast(isEn ? 'Updating playlist & clearing cache...' : 'Kanal listesi yenileniyor & önbellek temizleniyor...', 'info');
      await clearIptvCache();
      const res = await fetch('/api/iptv/update', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        checkIptvStatus();
        loadIptvChannels();
      } else if (typeof showToast === 'function') {
        showToast(data.error || 'Güncelleme başlatılamadı', 'error');
      }
    } catch {
      if (typeof showToast === 'function') showToast('Bağlantı hatası', 'error');
    }
  });

  // Ekran Değiştir Butonu
  document.getElementById('iptv-swap-btn')?.addEventListener('click', swapIptvSportModePlayers);

  // Spor Modu Sürükle / Boyutlandır
  initIptvSportModeDragAndResize();

  // Klavye Kısayolları (Space, F, M, ArrowUp/Down, ArrowLeft/Right, J/L, R, 1-4)
  initIptvKeyboardShortcuts();

  // İlk yükleme
  loadIptvChannels();
  checkIptvStatus();
  startIptvStatusPolling();
}

/**
 * IPTV Oynatıcı Klavye Kısayolları (YouTube / Masaüstü Medya Deneyimi ile Birebir)
 */
function initIptvKeyboardShortcuts() {
  document.addEventListener('keydown', (e) => {
    // 1. IPTV sekmesi görünür mü?
    const iptvTab = document.getElementById('tab-iptv');
    if (!iptvTab || iptvTab.classList.contains('hidden') || iptvTab.style.display === 'none') return;

    // 2. Video oynatıcı modalı veya ayarlar açıkken IPTV kısayollarını tetikleme
    const playerModal = document.getElementById('player-modal');
    if (playerModal && !playerModal.classList.contains('hidden')) return;

    // 3. Kullanıcı yazı yazıyorsa (Arama kutusu, input, textarea) kısayolları engelle
    const activeEl = document.activeElement;
    const isTyping = activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.isContentEditable);
    if (isTyping) return;

    // 4. Aktif slot ve video kontrolü
    const p = iptvPlayers[activeIptvSlot];
    const video = p?.videoElement;
    const slotEl = document.querySelector(`.iptv-slot[data-slot="${activeIptvSlot}"]`);
    if (!slotEl) return;

    switch (e.key) {
      case ' ':
      case 'k':
      case 'K': {
        e.preventDefault();
        const playBtn = slotEl.querySelector('.osd-play-btn');
        if (playBtn) {
          playBtn.click();
        } else if (video) {
          if (video.paused) video.play().catch(() => {});
          else video.pause();
        }
        break;
      }

      case 'f':
      case 'F': {
        e.preventDefault();
        const fsBtn = slotEl.querySelector('.osd-fullscreen-btn');
        if (fsBtn) {
          fsBtn.click();
        } else if (!document.fullscreenElement) {
          slotEl.requestFullscreen().catch(() => {});
        } else {
          document.exitFullscreen().catch(() => {});
        }
        break;
      }

      case 'm':
      case 'M': {
        e.preventDefault();
        const muteBtn = slotEl.querySelector('.osd-mute-btn');
        if (muteBtn) {
          muteBtn.click();
        } else if (video) {
          video.muted = !video.muted;
          iptvUserExplicitlyMuted = video.muted;
        }
        break;
      }

      case 'ArrowUp': {
        e.preventDefault();
        if (e.shiftKey) {
          playPrevIptvChannel();
        } else if (video) {
          const slider = slotEl.querySelector('.osd-volume-slider');
          const nextVol = Math.min(1, Math.round((video.volume + 0.05) * 100) / 100);
          if (slider) {
            slider.value = nextVol;
            slider.dispatchEvent(new Event('input', { bubbles: true }));
          } else {
            video.volume = nextVol;
            iptvGlobalVolume = nextVol;
          }
          if (p?.showOsd) p.showOsd();
        }
        break;
      }

      case 'ArrowDown': {
        e.preventDefault();
        if (e.shiftKey) {
          playNextIptvChannel();
        } else if (video) {
          const slider = slotEl.querySelector('.osd-volume-slider');
          const nextVol = Math.max(0, Math.round((video.volume - 0.05) * 100) / 100);
          if (slider) {
            slider.value = nextVol;
            slider.dispatchEvent(new Event('input', { bubbles: true }));
          } else {
            video.volume = nextVol;
            iptvGlobalVolume = nextVol;
          }
          if (p?.showOsd) p.showOsd();
        }
        break;
      }

      case 'PageDown':
      case ']':
      case 'n':
      case 'N':
      case 'MediaTrackNext': {
        e.preventDefault();
        playNextIptvChannel();
        break;
      }

      case 'PageUp':
      case '[':
      case 'b':
      case 'B':
      case 'MediaTrackPrevious': {
        e.preventDefault();
        playPrevIptvChannel();
        break;
      }

      case 'ArrowLeft':
      case 'j':
      case 'J': {
        e.preventDefault();
        const rewindBtn = slotEl.querySelector('.osd-rewind-btn');
        if (rewindBtn) {
          rewindBtn.click();
        } else if (video) {
          video.currentTime = Math.max(0, video.currentTime - 10);
        }
        break;
      }

      case 'ArrowRight':
      case 'l':
      case 'L': {
        e.preventDefault();
        const forwardBtn = slotEl.querySelector('.osd-forward-btn');
        if (forwardBtn) {
          forwardBtn.click();
        } else if (video) {
          video.currentTime = video.currentTime + 10;
        }
        break;
      }

      case 'Home':
      case '0': {
        e.preventDefault();
        const liveBtn = slotEl.querySelector('.osd-live-btn');
        if (liveBtn) liveBtn.click();
        break;
      }

      case 'p':
      case 'P': {
        e.preventDefault();
        const pipBtn = slotEl.querySelector('.osd-pip-btn');
        if (pipBtn) pipBtn.click();
        break;
      }

      case 'r':
      case 'R': {
        e.preventDefault();
        playRandomIptvChannel();
        break;
      }

      case '?': {
        e.preventDefault();
        if (typeof window.openShortcutsModal === 'function') {
          window.openShortcutsModal('iptv');
        }
        break;
      }

      default: {
        // Çoklu ekranda 1, 2, 3, 4 tuşlarıyla slot seçimi
        if (e.key >= '1' && e.key <= '4') {
          const gridEl = document.getElementById('iptv-players-grid');
          const isMulti = gridEl && (gridEl.classList.contains('dual-mode') || gridEl.classList.contains('quad-mode') || gridEl.classList.contains('sport-mode'));
          if (isMulti) {
            e.preventDefault();
            selectIptvSlot(parseInt(e.key, 10) - 1);
          }
        }
        break;
      }
    }
  });
}

// ─── Kanal Listesi Yükleme & Filtreleme ───

// ─── Kanal Listesi İlerleme Çubuğu (Progress Indicator) ───
export function updateIptvProgress(percent, text = '') {
  const container = document.getElementById('iptv-progress-container');
  const bar = document.getElementById('iptv-progress-bar');
  const pctText = document.getElementById('iptv-progress-percent');
  const msgText = document.getElementById('iptv-progress-text');
  if (!container || !bar) return;

  if (percent === null) {
    container.classList.add('hidden');
    bar.style.width = '0%';
    return;
  }

  container.classList.remove('hidden');
  const safePct = Math.max(0, Math.min(100, Math.round(percent)));
  bar.style.width = `${safePct}%`;
  if (pctText) pctText.textContent = `%${safePct}`;
  if (msgText && text) msgText.textContent = text;

  if (safePct >= 100) {
    setTimeout(() => {
      container.classList.add('hidden');
      bar.style.width = '0%';
    }, 1500);
  }
}

export async function loadIptvChannels(append = false) {
  if (iptvChunkRenderTimer) {
    cancelAnimationFrame(iptvChunkRenderTimer);
    iptvChunkRenderTimer = null;
  }

  const isEn = getLocalDb().settings?.lang === 'en';
  const isFavMode = iptvSelectedCategory === 'favorites';
  const effectiveCategory = isFavMode ? '' : iptvSelectedCategory;
  const hasFilter = (iptvSelectedCountry || iptvSearchQuery || effectiveCategory || isFavMode);
  const forceAll = iptvLoadAllAtOnce ? 1 : 0;
  const cacheKey = `iptv_${iptvSelectedCountry}_${effectiveCategory}_${iptvSearchQuery}_${forceAll}_p${iptvCurrentPage}`;
  const delay = (ms) => new Promise(res => setTimeout(res, ms));

  if (!append) {
    iptvIsLoading = true;
    iptvCurrentPage = 1;
    const lc = document.getElementById('iptv-channel-list');
    if (lc) lc.innerHTML = '';

    // İstemci Önbelleği (IndexedDB): Eğer önbellekte varsa anında (0ms) render et
    if (!isFavMode) {
      try {
        const cached = await getIptvCache(cacheKey);
        if (cached && Array.isArray(cached.channels) && cached.channels.length > 0) {
          iptvTotalPages = cached.totalPages || 1;
          iptvTotalCount = cached.totalCount || cached.channels.length;
          renderIptvChannels(cached.channels, false);
          if (cached.filters) populateIptvFilters(cached.filters);
          updateLoadMoreBtn();
          updateIptvProgress(100, isEn ? `Loaded from cache (${cached.channels.length.toLocaleString()} channels)` : `Önbellekten hazır (${cached.channels.length.toLocaleString()} kanal)`);
          iptvIsLoading = false;
          return;
        }
      } catch (e) {}
    }
  } else {
    iptvIsAppending = true;
  }

  updateIptvProgress(25, isEn ? 'Connecting to channel playlist... (%25)' : 'Kanal listesi sunucudan indiriliyor... (%25)');
  await delay(100);

  const li = document.getElementById('iptv-list-loading');
  if (li) li.classList.remove('hidden');

  try {
    const limit = (iptvLoadAllAtOnce || hasFilter) ? 0 : 150;
    const url = `/api/iptv/channels?limit=${limit}&page=${iptvCurrentPage}&search=${encodeURIComponent(iptvSearchQuery)}&country=${encodeURIComponent(iptvSelectedCountry)}&category=${encodeURIComponent(effectiveCategory)}&forceAll=${forceAll}`;
    
    updateIptvProgress(55, isEn ? 'Downloading 11,000+ channels... (%55)' : '11.000+ kanal verisi alınıyor... (%55)');
    await delay(100);

    const res = await fetch(url);
    const data = await res.json();
    if (li) li.classList.add('hidden');

    updateIptvProgress(80, isEn ? 'Processing & caching channels... (%80)' : 'Kanallar işleniyor & önbellekleniyor... (%80)');
    await delay(80);

    let channels = data.channels || [];
    if (isFavMode) {
      channels = channels.filter(ch => iptvFavorites.has(ch.id || ch.name));
    }

    iptvTotalPages = data.pagination?.totalPages || 1;
    iptvTotalCount = isFavMode ? channels.length : (data.pagination?.totalCount || 0);

    // Önbelleğe kaydet (sonraki açılışlarda 0 saniyede gelmesi için)
    if (!isFavMode && channels.length > 0) {
      setIptvCache(cacheKey, {
        channels,
        totalPages: iptvTotalPages,
        totalCount: iptvTotalCount,
        filters: data.filters
      });
    }

    renderIptvChannels(channels, append);
    populateIptvFilters(data.filters);
    updateLoadMoreBtn();

    updateIptvProgress(100, isEn ? `${channels.length.toLocaleString()} channels ready! (%100)` : `${channels.length.toLocaleString()} kanal hazır! (%100)`);
  } catch (err) {
    console.error('[IPTV] Kanal listesi hatası:', err);
    if (li) li.classList.add('hidden');
    updateIptvProgress(null);
  } finally {
    iptvIsLoading = false;
    iptvIsAppending = false;
  }
}

// Ultra hızlı inline SVG tanımları (Lucide parser'ı atlayarak 10.000+ kanalda donmayı önler)
const IPTV_TV_SVG = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="15" x="2" y="7" rx="2" ry="2"></rect><polyline points="17 2 12 7 7 2"></polyline></svg>';

// ─── Virtual Scroll Motoru (11.000+ kanalda 0 kasma, 120 FPS akıcılık) ───
let _virtualChannels = [];
let _virtualScrollAttached = false;
const ITEM_HEIGHT = 52; // Piksel cinsinden kesin kart yuvası yüksekliği (48px kart + 4px gap)
const BUFFER_ITEMS = 6;  // Görünüm alanı dışındaki yedek kart sayısı

function createChannelElement(ch) {
  const item = document.createElement('div');
  item.className = 'iptv-channel-item';
  item.dataset.url = ch.url;
  const chId = ch.id || ch.name;
  const isFav = iptvFavorites.has(chId);
  const isPlaying = iptvPlayers.some(p => p && p.streamUrl === ch.url);

  if (isPlaying) item.classList.add('active-playing');

  const flagHtml = ch.country ? getCountryFlagHtml(ch.country, 'iptv-flag-img') : '';
  const logoSrc = ch.logo || '';
  const logoHtml = logoSrc
    ? `<img class="iptv-ch-logo" src="${logoSrc}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.outerHTML='<div class=\\'iptv-ch-logo placeholder\\'>${IPTV_TV_SVG}</div>'">`
    : `<div class="iptv-ch-logo placeholder">${IPTV_TV_SVG}</div>`;

  const starFill = isFav ? 'currentColor' : 'none';
  const starSvg = `<svg class="iptv-star-svg" width="13" height="13" viewBox="0 0 24 24" fill="${starFill}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>`;

  item.innerHTML = `
    ${logoHtml}
    <div class="iptv-ch-info">
      <span class="iptv-ch-name" title="${ch.displayName || ch.name}">${ch.displayName || ch.name}</span>
      <div class="iptv-ch-meta">
        ${flagHtml}
        ${ch.category ? `<span class="iptv-ch-tag">${ch.category}</span>` : ''}
        ${ch.quality ? `<span class="iptv-ch-tag">${ch.quality}</span>` : ''}
      </div>
    </div>
    <div class="iptv-ch-actions">
      <button type="button" class="iptv-fav-btn ${isFav ? 'is-fav' : ''}" title="${isFav ? 'Favorilerden Çıkar' : 'Favorilere Ekle'}">
        ${starSvg}
      </button>
    </div>
  `;

  item.addEventListener('click', (e) => {
    if (e.target.closest('.iptv-fav-btn')) return;
    playIptvChannel(activeIptvSlot, ch.url, ch.displayName || ch.name);
  });

  const favBtn = item.querySelector('.iptv-fav-btn');
  favBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleChannelFavorite(chId, favBtn);
  });

  return item;
}

function onVirtualScroll() {
  const wrapper = document.querySelector('.iptv-list-wrapper');
  const lc = document.getElementById('iptv-channel-list');
  const phantom = document.getElementById('iptv-virtual-phantom');
  if (!wrapper || !lc || _virtualChannels.length <= 150) return;

  const scrollTop = wrapper.scrollTop;
  const viewportHeight = wrapper.clientHeight || 320;

  const startIndex = Math.max(0, Math.floor(scrollTop / ITEM_HEIGHT) - BUFFER_ITEMS);
  const endIndex = Math.min(_virtualChannels.length, Math.ceil((scrollTop + viewportHeight) / ITEM_HEIGHT) + BUFFER_ITEMS);

  const offsetY = startIndex * ITEM_HEIGHT;
  lc.style.transform = `translate3d(0, ${offsetY}px, 0)`;

  const slice = _virtualChannels.slice(startIndex, endIndex);
  const frag = document.createDocumentFragment();
  slice.forEach(ch => frag.appendChild(createChannelElement(ch)));
  lc.innerHTML = '';
  lc.appendChild(frag);
}

export function renderIptvChannels(channels, append = false) {
  const lc = document.getElementById('iptv-channel-list');
  const phantom = document.getElementById('iptv-virtual-phantom');
  const wrapper = document.querySelector('.iptv-list-wrapper');
  if (!lc) return;

  const isEn = getLocalDb().settings?.lang === 'en';

  if (!channels || channels.length === 0) {
    _virtualChannels = [];
    if (phantom) phantom.style.height = 'auto';
    lc.style.position = 'static';
    lc.style.transform = '';
    if (!append) {
      lc.innerHTML = `<div class="text-center text-muted" style="padding: 30px 10px; font-size: 0.85rem;">
        <i data-lucide="tv-2" style="width: 32px; height: 32px; opacity: 0.4; margin-bottom: 8px;"></i>
        <div>${isEn ? 'No channels found.' : 'Kriterlere uygun kanal bulunamadı.'}</div>
      </div>`;
      if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
    }
    return;
  }

  // 150'den fazla kanal varsa Phantom tabanlı Virtual Scroll devreye girer (Sıfır kasma, pürüzsüz sonuna kadar kayma)
  if (channels.length > 150) {
    _virtualChannels = channels;
    const totalHeight = channels.length * ITEM_HEIGHT;
    if (phantom) {
      phantom.style.height = `${totalHeight}px`;
      phantom.style.position = 'relative';
      phantom.style.width = '100%';
    }
    lc.style.position = 'absolute';
    lc.style.top = '0';
    lc.style.left = '0';
    lc.style.right = '0';
    lc.style.willChange = 'transform';

    if (!_virtualScrollAttached && wrapper) {
      wrapper.addEventListener('scroll', () => {
        requestAnimationFrame(onVirtualScroll);
      }, { passive: true });
      _virtualScrollAttached = true;
    }

    if (!append && wrapper) {
      wrapper.scrollTop = 0;
    }

    onVirtualScroll();
    return;
  }

  // Normal boyutlu listeler (<150) için düz render
  _virtualChannels = [];
  if (phantom) {
    phantom.style.height = 'auto';
    phantom.style.position = 'static';
  }
  lc.style.position = 'static';
  lc.style.transform = '';
  if (!append) lc.innerHTML = '';

  const frag = document.createDocumentFragment();
  channels.forEach(ch => frag.appendChild(createChannelElement(ch)));
  lc.appendChild(frag);
}

export function toggleChannelFavorite(channelId, favBtn) {
  const star = favBtn.querySelector('svg');
  if (iptvFavorites.has(channelId)) {
    iptvFavorites.delete(channelId);
    favBtn.classList.remove('is-fav');
    if (star) star.setAttribute('fill', 'none');
  } else {
    iptvFavorites.add(channelId);
    favBtn.classList.add('is-fav');
    if (star) star.setAttribute('fill', 'currentColor');
  }
  try {
    localStorage.setItem('haytool_iptv_favorites', JSON.stringify([...iptvFavorites]));
  } catch (e) {}
}

export function updateLoadMoreBtn() {
  const btn = document.getElementById('iptv-load-more-btn');
  if (!btn) return;
  const isFavMode = iptvSelectedCategory === 'favorites';
  const hasFilter = (iptvSelectedCountry || iptvSearchQuery || iptvSelectedCategory || isFavMode);

  if (iptvLoadAllAtOnce || hasFilter || iptvCurrentPage >= iptvTotalPages) {
    btn.classList.add('hidden');
  } else {
    btn.classList.remove('hidden');
    const isEn = getLocalDb().settings?.lang === 'en';
    const shown = Math.min(iptvCurrentPage * 150, iptvTotalCount);
    btn.textContent = `${isEn ? 'Load More' : 'Daha Fazla'} (${shown} / ${iptvTotalCount})`;
  }
}

/**
 * Aktif filtre kriterlerine uyan kanallar arasından rastgele bir kanal açar.
 */
export async function playRandomIptvChannel(retryCount = 0) {
  const isEn = getLocalDb().settings?.lang === 'en';
  const isFavMode = iptvSelectedCategory === 'favorites';
  const randomBtn = document.getElementById('iptv-random-btn');

  if (randomBtn && retryCount === 0) {
    randomBtn.style.transform = 'rotate(360deg)';
    randomBtn.style.transition = 'transform 0.4s ease';
    setTimeout(() => { if (randomBtn) randomBtn.style.transform = ''; }, 450);
  }

  if (isFavMode) {
    const favUrls = Array.from(iptvFavorites);
    if (favUrls.length === 0) {
      if (typeof showToast === 'function') {
        showToast(isEn ? 'No favorite channels found.' : 'Favorilerinizde henüz kanal yok.', 'warning');
      }
      return;
    }
    const items = Array.from(document.querySelectorAll('.iptv-channel-item'));
    if (items.length > 0) {
      const randomItem = items[Math.floor(Math.random() * items.length)];
      randomItem.click();
      randomItem.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      return;
    }
  }

  try {
    let ch = null;
    let chName = '';

    try {
      const effectiveCategory = isFavMode ? '' : iptvSelectedCategory;
      const url = `/api/iptv/random?search=${encodeURIComponent(iptvSearchQuery)}&country=${encodeURIComponent(iptvSelectedCountry)}&category=${encodeURIComponent(effectiveCategory)}`;
      const res = await fetch(url);
      const data = await res.json();
      if (data && data.success && data.channel) {
        ch = data.channel;
        chName = ch.displayName || ch.name;
      }
    } catch (e) {}

    // Fallback: Backend henüz yeniden başlatılmadıysa veya ağ gecikmesinde ekrandaki mevcut kanallardan seç
    if (!ch) {
      const items = Array.from(document.querySelectorAll('.iptv-channel-item'));
      if (items.length > 0) {
        const randomItem = items[Math.floor(Math.random() * items.length)];
        const titleEl = randomItem.querySelector('.iptv-ch-name');
        chName = titleEl ? titleEl.textContent : 'Kanal';
        randomItem.click();
        randomItem.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        if (typeof showToast === 'function') {
          showToast(isEn ? `🎲 Random: ${chName}` : `🎲 Rastgele: ${chName}`, 'info');
        }
        return;
      }
      if (typeof showToast === 'function') {
        showToast(isEn ? 'No channel found matching current filter.' : 'Mevcut filtreye uyan kanal bulunamadı.', 'warning');
      }
      return;
    }

    if (retryCount === 0 && typeof showToast === 'function') {
      showToast(isEn ? `🎲 Random: ${chName}` : `🎲 Rastgele: ${chName}`, 'info');
    }

    await playIptvChannel(activeIptvSlot, ch.url, chName, { isRandom: true, retryCount });

    // Listede varsa veya sanal listedeyse o karta odaklan
    if (_virtualChannels.length > 0) {
      const chIdx = _virtualChannels.findIndex(c => c.url === ch.url);
      const wrapper = document.querySelector('.iptv-list-wrapper');
      if (chIdx !== -1 && wrapper) {
        wrapper.scrollTop = Math.max(0, (chIdx - 2) * ITEM_HEIGHT);
      }
    } else {
      const targetItem = document.querySelector(`.iptv-channel-item[data-url="${ch.url}"]`);
      if (targetItem) {
        targetItem.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  } catch (err) {
    console.error('[IPTV Random Hatası]:', err);
    if (typeof showToast === 'function') {
      showToast(isEn ? 'Failed to pick random channel.' : 'Rastgele kanal seçilemedi.', 'error');
    }
  }
}

/**
 * Sıradaki kanala geçer (Virtual list veya mevcut filtrelenmiş listeden)
 */
export function playNextIptvChannel() {
  switchIptvChannel(1);
}

/**
 * Önceki kanala geçer
 */
export function playPrevIptvChannel() {
  switchIptvChannel(-1);
}

function switchIptvChannel(direction = 1) {
  const isEn = getLocalDb().settings?.lang === 'en';
  const curUrl = iptvPlayers[activeIptvSlot]?.streamUrl;

  if (Array.isArray(_virtualChannels) && _virtualChannels.length > 0) {
    const curIdx = _virtualChannels.findIndex(ch => ch.url === curUrl);
    let targetIdx = 0;
    if (curIdx >= 0) {
      targetIdx = (curIdx + direction + _virtualChannels.length) % _virtualChannels.length;
    } else {
      targetIdx = direction > 0 ? 0 : _virtualChannels.length - 1;
    }

    const targetCh = _virtualChannels[targetIdx];
    if (targetCh) {
      const chName = targetCh.displayName || targetCh.name || 'Kanal';
      playIptvChannel(activeIptvSlot, targetCh.url, chName);

      // Sanal listede o kanala odaklan
      const wrapper = document.querySelector('.iptv-list-wrapper');
      if (wrapper) {
        wrapper.scrollTop = Math.max(0, (targetIdx - 2) * ITEM_HEIGHT);
      }

      if (typeof showToast === 'function') {
        const prefix = direction > 0 ? '⏭️ ' : '⏮️ ';
        showToast(`${prefix}${chName}`, 'info');
      }
      return;
    }
  }

  // Fallback: DOM üzerindeki kanallar arasında geçiş
  const items = Array.from(document.querySelectorAll('.iptv-channel-item'));
  if (items.length > 0) {
    const curIdx = items.findIndex(el => el.dataset.url === curUrl || el.classList.contains('active-playing'));
    let targetIdx = 0;
    if (curIdx >= 0) {
      targetIdx = (curIdx + direction + items.length) % items.length;
    } else {
      targetIdx = direction > 0 ? 0 : items.length - 1;
    }

    const targetEl = items[targetIdx];
    if (targetEl) {
      targetEl.click();
      targetEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      const chName = targetEl.querySelector('.iptv-ch-name')?.textContent || 'Kanal';
      if (typeof showToast === 'function') {
        const prefix = direction > 0 ? '⏭️ ' : '⏮️ ';
        showToast(`${prefix}${chName}`, 'info');
      }
    }
  }
}

/**
 * Slot içinde şık çevrimdışı / yayın yok hata katmanını gösterir.
 */
function showSlotError(slot, displayName, streamUrl) {
  const slotEl = document.querySelector(`.iptv-slot[data-slot="${slot}"]`);
  if (!slotEl) return;

  const errorOverlay = slotEl.querySelector('.slot-error-overlay');
  const placeholder = slotEl.querySelector('.slot-placeholder');
  const wrapper = slotEl.querySelector('.slot-video-wrapper');

  if (placeholder) placeholder.style.display = 'none';
  if (wrapper) wrapper.classList.add('hidden');

  if (errorOverlay) {
    errorOverlay.classList.remove('hidden');
    const chEl = errorOverlay.querySelector('.slot-error-channel');
    if (chEl) chEl.textContent = displayName || `Slot ${slot + 1}`;

    // Retry Butonu
    const retryBtn = errorOverlay.querySelector('.slot-error-retry-btn');
    if (retryBtn) {
      retryBtn.onclick = (e) => {
        e.stopPropagation();
        errorOverlay.classList.add('hidden');
        playIptvChannel(slot, streamUrl, displayName);
      };
    }

    // Başka Rastgele Kanal Butonu
    const randomBtn = errorOverlay.querySelector('.slot-error-random-btn');
    if (randomBtn) {
      randomBtn.onclick = (e) => {
        e.stopPropagation();
        errorOverlay.classList.add('hidden');
        playRandomIptvChannel();
      };
    }

    // Kapat Butonu
    const closeBtn = errorOverlay.querySelector('.slot-error-close-btn');
    if (closeBtn) {
      closeBtn.onclick = (e) => {
        e.stopPropagation();
        clearIptvSlot(slot);
      };
    }

    if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
  }
}

const IPTV_STREAM_TIMEOUT_MS = 3000; // 3 saniyede veri gelmezse çevrimdışı say
const IPTV_MAX_RANDOM_RETRIES = 15; // Rastgele kanalda 15 denemeye kadar otomatik atla

/**
 * Yayın veri akışı kesildiğinde, hata aldığında veya yanıt vermediğinde tetiklenir.
 */
function handleStreamFailure(slot, displayName, streamUrl, reason = 'unknown', isRandom = false, retryCount = 0) {
  const cur = iptvPlayers[slot];
  if (cur && cur.isDead) return;
  if (cur) cur.isDead = true;

  console.warn(`[IPTV Stream Error] Slot ${slot} ("${displayName}"): ${reason}`);

  if (cur && cur.loadTimer) {
    clearTimeout(cur.loadTimer);
    cur.loadTimer = null;
  }

  // Eğer bu rastgele kanal açma modundan geldiyse ve henüz limit aşılmadıysa:
  if (isRandom && retryCount < IPTV_MAX_RANDOM_RETRIES) {
    const nextRetry = retryCount + 1;
    const msg = getTranslation('iptv_random_retry_toast', '⚠️ {channel} çevrimdışı, yeni kanal aranıyor... ({attempt}/{max})')
      .replace('{channel}', displayName || 'Kanal')
      .replace('{attempt}', nextRetry)
      .replace('{max}', IPTV_MAX_RANDOM_RETRIES);
    if (typeof showToast === 'function') showToast(msg, 'warning');

    clearIptvSlot(slot, false);
    setTimeout(() => {
      playRandomIptvChannel(nextRetry);
    }, 400);
    return;
  }

  // Rastgele denenip tüm denemeler tükendiyse
  if (isRandom && retryCount >= IPTV_MAX_RANDOM_RETRIES) {
    const exhaustedMsg = getTranslation('iptv_random_exhausted', 'Mevcut filtrede çalışan rastgele kanal bulunamadı.');
    if (typeof showToast === 'function') showToast(exhaustedMsg, 'error');
  } else {
    // Normal tıklamada toast uyarısı
    const errorMsg = getTranslation('iptv_stream_error_toast', '⚠️ {channel}: Yayın alınamıyor (Çevrimdışı)')
      .replace('{channel}', displayName || 'Kanal');
    if (typeof showToast === 'function') showToast(errorMsg, 'error');
  }

  // Slot içinde şık hata katmanını göster
  showSlotError(slot, displayName, streamUrl);
}

// ─── CANLI TV OYNATICI (Player & OSD Engine) ───

/**
 * Belirtilen slotta IPTV kanalını kesintisiz ve özel Canlı OSD ile başlatır.
 */
export async function playIptvChannel(slotIndex, streamUrl, displayName, options = {}) {
  const slot = parseInt(slotIndex, 10) || 0;
  const isRandom = Boolean(options.isRandom);
  const retryCount = options.retryCount || 0;

  // Hls.js hazır mı kontrol et
  const ok = await ensureHlsLoaded();
  if (!ok) {
    if (typeof showToast === 'function') showToast('IPTV oynatıcı kütüphanesi (hls.js) yüklenemedi.', 'error');
    return;
  }

  const slotEl = document.querySelector(`.iptv-slot[data-slot="${slot}"]`);
  if (!slotEl) return;

  // Önceki yayını ve süreçleri temizle
  clearIptvSlot(slot, false);

  const wrapper = slotEl.querySelector('.slot-video-wrapper');
  const placeholder = slotEl.querySelector('.slot-placeholder');
  const video = slotEl.querySelector(`#iptv-video-${slot}`);

  if (!wrapper || !video) return;

  // Görünürlük ayarla
  if (placeholder) placeholder.style.display = 'none';
  wrapper.classList.remove('hidden');
  slotEl.classList.add('has-video');

  // OSD Başlıklarını ayarla
  const titleEl = slotEl.querySelector('.osd-channel-title');
  if (titleEl) titleEl.textContent = displayName || `Slot ${slot + 1}`;

  // OSD Elemanlarını yakala
  const osdOverlay = slotEl.querySelector('.iptv-osd-overlay');
  const timelineTrack = slotEl.querySelector('.osd-timeline-track');
  const timelineBuffer = slotEl.querySelector('.osd-timeline-buffer');
  const timelineProgress = slotEl.querySelector('.osd-timeline-progress');
  const timelineHandle = slotEl.querySelector('.osd-timeline-handle');
  const timeDisplay = slotEl.querySelector('.osd-time-display');
  const liveBtn = slotEl.querySelector('.osd-live-btn');
  const playBtn = slotEl.querySelector('.osd-play-btn');
  const muteBtn = slotEl.querySelector('.osd-mute-btn');
  const volumeSlider = slotEl.querySelector('.osd-volume-slider');
  const rewindBtn = slotEl.querySelector('.osd-rewind-btn');
  const forwardBtn = slotEl.querySelector('.osd-forward-btn');
  const pipBtn = slotEl.querySelector('.osd-pip-btn');
  const fullscreenBtn = slotEl.querySelector('.osd-fullscreen-btn');
  const pulseIcon = slotEl.querySelector('.osd-pulse-icon');
  const dvrPill = slotEl.querySelector('.osd-dvr-pill');

  let isServerDvr = false;
  let lastPillUpdate = 0;

  const updateDvrPill = (spanSeconds) => {
    if (!dvrPill) return;
    const now = Date.now();
    if (now - lastPillUpdate < 2000 && dvrPill.textContent) return;
    lastPillUpdate = now;

    dvrPill.classList.remove('hidden');
    if (isServerDvr && spanSeconds > 35) {
      dvrPill.classList.remove('no-server');
      dvrPill.title = `Bu kanal sunucuda ${formatTime(spanSeconds)} geriye sarma desteği sağlıyor`;
      dvrPill.innerHTML = `<i data-lucide="rewind" style="width:11px;height:11px;"></i> DVR: ${formatTime(spanSeconds)}`;
    } else {
      dvrPill.classList.add('no-server');
      dvrPill.title = 'Sunucuda yayın geçmişi yok; kanalı izlediğiniz süre boyunca yerel belleğe alınır';
      dvrPill.innerHTML = `<i data-lucide="clock" style="width:11px;height:11px;"></i> Bellek DVR: ${formatTime(spanSeconds)}`;
    }
    if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
  };

  // Hls.js Başlatıcı (10 dakikalık geri sarma tamponu)
  let hlsInstance = null;
  const isHls = streamUrl.includes('.m3u8') || streamUrl.includes('m3u8') || streamUrl.startsWith('http');

  // Akış bağlantı zaman aşımı denetçisi (Seçili saniyede veri gelmezse çevrimdışı say)
  const timeoutMs = (iptvStreamTimeoutSec || 8) * 1000;
  let loadTimer = setTimeout(() => {
    if (!video.played || video.currentTime === 0 || video.readyState < 2) {
      handleStreamFailure(slot, displayName, streamUrl, 'timeout', isRandom, retryCount);
    }
  }, timeoutMs);

  const onStreamSuccess = () => {
    if (loadTimer) {
      clearTimeout(loadTimer);
      loadTimer = null;
    }
    if (iptvPlayers[slot]) {
      iptvPlayers[slot].isDead = false;
      iptvPlayers[slot].hasStarted = true;
    }
    const errOverlay = slotEl.querySelector('.slot-error-overlay');
    if (errOverlay) errOverlay.classList.add('hidden');

    // Kanal başarıyla bağlanıp oynatıldığında aktif slotsa sesin açık olduğundan emin ol
    if (slot === activeIptvSlot && !iptvUserExplicitlyMuted) {
      video.muted = false;
      video.volume = iptvGlobalVolume;
      updateVolumeUI();
    }

    if (isRandom && retryCount > 0 && !iptvPlayers[slot]?.connectedToastShown) {
      iptvPlayers[slot].connectedToastShown = true;
      const successMsg = getTranslation('iptv_random_connected', '🎲 {channel} yayını bağlandı!')
        .replace('{channel}', displayName || 'Kanal');
      if (typeof showToast === 'function') showToast(successMsg, 'success');
    }
  };

  video.addEventListener('playing', () => {
    if (slot === activeIptvSlot && !iptvUserExplicitlyMuted && video.muted) {
      video.muted = false;
      video.volume = iptvGlobalVolume;
      updateVolumeUI();
    }
    onStreamSuccess();
  }, { once: true });

  video.addEventListener('loadeddata', onStreamSuccess, { once: true });
  video.addEventListener('canplay', () => {
    if (slot === activeIptvSlot && !iptvUserExplicitlyMuted && video.muted) {
      video.muted = false;
      video.volume = iptvGlobalVolume;
      updateVolumeUI();
    }
    if (video.currentTime > 0) onStreamSuccess();
  });

  video.onerror = () => {
    handleStreamFailure(slot, displayName, streamUrl, 'video_error', isRandom, retryCount);
  };

  // Aktif slot için sesi açık başlat; diğer arka plan slotları sessiz başlar
  const isSelectedSlot = (slot === activeIptvSlot);
  video.volume = iptvGlobalVolume;
  video.muted = isSelectedSlot ? Boolean(iptvUserExplicitlyMuted) : true;
  video.autoplay = true;

  const startPlaybackSafely = () => {
    const isSelected = (slot === activeIptvSlot);
    if (isSelected && !iptvUserExplicitlyMuted) {
      video.muted = false;
      video.volume = iptvGlobalVolume;
    } else if (!isSelected) {
      video.muted = true;
    }

    const p = video.play();
    if (p !== undefined) {
      p.then(() => {
        if (isSelected && !iptvUserExplicitlyMuted) {
          video.muted = false;
          video.volume = iptvGlobalVolume;
          updateVolumeUI();
        }
      }).catch((err) => {
        // Yalnızca tarayıcının Autoplay ilkesi sesli oynatmayı reddederse sessize al
        if (err && err.name === 'NotAllowedError') {
          console.warn('[IPTV Audio] Autoplay policy prevented unmuted playback, muting fallback');
          video.muted = true;
          video.play().catch(() => {});
          updateVolumeUI();
        }
      });
    }
  };

  if (isHls && typeof Hls !== 'undefined' && Hls.isSupported()) {
    hlsInstance = new Hls({
      maxBufferLength: 300,
      maxMaxBufferLength: 600,
      backBufferLength: 600, // 10 dakika geriye sarma tamponu
      liveSyncDurationCount: 3,
      liveDurationInfinity: true,
      highBufferWatchdogPeriod: 0,
      enableWorker: true
    });

    let networkRetries = 0;
    hlsInstance.on(Hls.Events.ERROR, (event, data) => {
      if (data.fatal) {
        switch (data.type) {
          case Hls.ErrorTypes.NETWORK_ERROR:
            networkRetries++;
            if (networkRetries <= 1) {
              hlsInstance.startLoad();
            } else {
              handleStreamFailure(slot, displayName, streamUrl, 'hls_network_fatal', isRandom, retryCount);
            }
            break;
          case Hls.ErrorTypes.MEDIA_ERROR:
            hlsInstance.recoverMediaError();
            break;
          default:
            handleStreamFailure(slot, displayName, streamUrl, 'hls_fatal_' + data.type, isRandom, retryCount);
            break;
        }
      } else if (data.response && (data.response.code === 403 || data.response.code === 404 || data.response.code >= 500)) {
        handleStreamFailure(slot, displayName, streamUrl, 'http_' + data.response.code, isRandom, retryCount);
      }
    });

    hlsInstance.on(Hls.Events.MANIFEST_PARSED, () => {
      startPlaybackSafely();
    });

    hlsInstance.on(Hls.Events.LEVEL_UPDATED, (event, data) => {
      if (data && data.details) {
        const totalDur = data.details.totalduration || 0;
        if (totalDur > 35) {
          isServerDvr = true;
        }
      }
    });

    hlsInstance.loadSource(streamUrl);
    hlsInstance.attachMedia(video);
  } else {
    video.src = streamUrl;
    video.onloadedmetadata = () => startPlaybackSafely();
  }

  // İlk oynatma girişimini güvenli olarak başlat
  startPlaybackSafely();

  let isScrubbing = false;
  let osdTimeout = null;

  // Fare takibi ile OSD otomatik gizleme (3.5 sn)
  const showOsd = () => {
    slotEl.classList.add('osd-active');
    clearTimeout(osdTimeout);
    osdTimeout = setTimeout(() => {
      if (!video.paused && !isScrubbing) {
        slotEl.classList.remove('osd-active');
      }
    }, 3500);
  };

  slotEl.onmousemove = showOsd;
  slotEl.onmouseenter = showOsd;
  slotEl.onmouseleave = () => {
    if (!video.paused && !isScrubbing) slotEl.classList.remove('osd-active');
  };

  // Flash ikonu oynatıcı merkezinde göster
  const flashIcon = (iconName) => {
    if (!pulseIcon) return;
    pulseIcon.innerHTML = `<i data-lucide="${iconName}"></i>`;
    pulseIcon.classList.add('flash');
    if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
    setTimeout(() => pulseIcon.classList.remove('flash'), 300);
  };

  // DVR Zaman Çizelgesi: Akışın geri sarılabilir tampon aralığı [minTime, maxTime]
  const getDvrRange = () => {
    let minTime = video.currentTime || 0;
    let maxTime = video.currentTime || 0;

    if (video.seekable && video.seekable.length > 0) {
      minTime = video.seekable.start(0);
      maxTime = Math.max(maxTime, video.seekable.end(video.seekable.length - 1));
    }
    if (video.buffered && video.buffered.length > 0) {
      minTime = Math.min(minTime, video.buffered.start(0));
      maxTime = Math.max(maxTime, video.buffered.end(video.buffered.length - 1));
    }
    if (hlsInstance && hlsInstance.liveSyncPosition && isFinite(hlsInstance.liveSyncPosition)) {
      maxTime = Math.max(maxTime, hlsInstance.liveSyncPosition);
    }
    const span = Math.max(1, maxTime - minTime);
    return { minTime, maxTime, span };
  };

  // DVR Timeline & Timeupdate
  video.ontimeupdate = () => {
    if (isScrubbing) return;
    const { minTime, maxTime, span } = getDvrRange();
    updateDvrPill(span);
    const curTime = video.currentTime || minTime;
    const diff = Math.max(0, maxTime - curTime);

    // Canlıda mı kontrolü (6 saniye tolerans)
    if (diff <= 6 || !isFinite(diff)) {
      if (timeDisplay) timeDisplay.textContent = '-00:00';
      if (liveBtn) {
        liveBtn.classList.add('at-live');
        liveBtn.classList.remove('behind-live');
      }
    } else {
      if (timeDisplay) timeDisplay.textContent = '-' + formatTime(diff);
      if (liveBtn) {
        liveBtn.classList.remove('at-live');
        liveBtn.classList.add('behind-live');
      }
    }

    // İlerleme çubuğu: Sağ uç (%100) = CANLI, Sol uç (%0) = En eski sarılabilir an
    const pct = Math.min(100, Math.max(0, ((curTime - minTime) / span) * 100));

    if (timelineProgress) timelineProgress.style.width = pct + '%';
    if (timelineHandle) timelineHandle.style.left = pct + '%';

    if (video.buffered && video.buffered.length > 0) {
      const bufEnd = video.buffered.end(video.buffered.length - 1);
      const bufPct = Math.min(100, Math.max(0, ((bufEnd - minTime) / span) * 100));
      if (timelineBuffer) timelineBuffer.style.width = bufPct + '%';
    } else {
      if (timelineBuffer) timelineBuffer.style.width = '100%';
    }
  };

  // Zaman çizelgesine tıklama ve sürükleme
  const seekFromTrack = (e) => {
    if (!timelineTrack) return;
    const rect = timelineTrack.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    const { minTime, maxTime, span } = getDvrRange();

    if (ratio >= 0.98) {
      video.currentTime = maxTime;
    } else {
      video.currentTime = minTime + (span * ratio);
    }
    video.play().catch(() => {});
  };

  if (timelineTrack) {
    timelineTrack.onmousedown = (e) => {
      isScrubbing = true;
      timelineTrack.classList.add('dragging');
      seekFromTrack(e);

      const onMouseMove = (ev) => seekFromTrack(ev);
      const onMouseUp = () => {
        isScrubbing = false;
        timelineTrack.classList.remove('dragging');
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
      };
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    };
  }

  // Canlı Butonuna basınca canlı kenara git
  if (liveBtn) {
    liveBtn.onclick = (e) => {
      e.stopPropagation();
      const { maxTime } = getDvrRange();
      video.currentTime = maxTime;
      video.play().catch(() => {});
      flashIcon('radio');
    };
  }

  // Oynat / Duraklat
  const togglePlay = () => {
    if (video.paused) {
      video.play().catch(() => {});
      if (playBtn) playBtn.innerHTML = '<i data-lucide="pause"></i>';
      flashIcon('play');
    } else {
      video.pause();
      if (playBtn) playBtn.innerHTML = '<i data-lucide="play"></i>';
      flashIcon('pause');
      showOsd();
    }
    if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
  };

  if (playBtn) playBtn.onclick = (e) => { e.stopPropagation(); togglePlay(); };
  video.onclick = togglePlay;

  // 10 Saniye Geri ve İleri (tampon sınırları içinde güvenli atlama)
  if (rewindBtn) {
    rewindBtn.onclick = (e) => {
      e.stopPropagation();
      const { minTime } = getDvrRange();
      video.currentTime = Math.max(minTime, (video.currentTime || 0) - 10);
      flashIcon('rotate-ccw');
    };
  }

  if (forwardBtn) {
    forwardBtn.onclick = (e) => {
      e.stopPropagation();
      const { maxTime } = getDvrRange();
      video.currentTime = Math.min(maxTime, (video.currentTime || 0) + 10);
      flashIcon('rotate-cw');
    };
  }

  // Ses ve Mute
  const updateVolumeUI = () => {
    if (video.muted || video.volume === 0) {
      if (muteBtn) muteBtn.innerHTML = '<i data-lucide="volume-x"></i>';
      if (volumeSlider) volumeSlider.value = 0;
    } else {
      if (muteBtn) muteBtn.innerHTML = (video.volume > 0.5) ? '<i data-lucide="volume-2"></i>' : '<i data-lucide="volume-1"></i>';
      if (volumeSlider) volumeSlider.value = video.volume;
    }
    if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
  };

  if (muteBtn) {
    muteBtn.onclick = (e) => {
      e.stopPropagation();
      video.muted = !video.muted;
      iptvUserExplicitlyMuted = video.muted;
      updateVolumeUI();
    };
  }

  if (volumeSlider) {
    volumeSlider.oninput = (e) => {
      e.stopPropagation();
      const val = parseFloat(e.target.value);
      video.volume = val;
      iptvGlobalVolume = val;
      if (video.muted && val > 0) {
        video.muted = false;
        iptvUserExplicitlyMuted = false;
      }
      updateVolumeUI();
    };
  }

  // Tekerlek ile ses kontrolü
  slotEl.onwheel = (e) => {
    e.preventDefault();
    const newVol = Math.min(1, Math.max(0, video.volume + (e.deltaY < 0 ? 0.05 : -0.05)));
    video.volume = newVol;
    iptvGlobalVolume = newVol;
    if (video.muted && newVol > 0) {
      video.muted = false;
      iptvUserExplicitlyMuted = false;
    }
    updateVolumeUI();
  };

  // İlk ses arayüzü senkronizasyonu
  updateVolumeUI();

  // PIP ve Tam Ekran
  if (pipBtn) {
    pipBtn.onclick = (e) => {
      e.stopPropagation();
      if (document.pictureInPictureElement) {
        document.exitPictureInPicture().catch(() => {});
      } else if (document.pictureInPictureEnabled) {
        video.requestPictureInPicture().catch(() => {});
      }
    };
  }

  if (fullscreenBtn) {
    fullscreenBtn.onclick = (e) => {
      e.stopPropagation();
      if (!document.fullscreenElement) {
        slotEl.requestFullscreen().catch(() => {});
      } else {
        document.exitFullscreen().catch(() => {});
      }
    };
  }

  // Slot referansını sakla
  iptvPlayers[slot] = {
    slotIndex: slot,
    videoElement: video,
    hls: hlsInstance,
    streamUrl,
    displayName,
    showOsd,
    loadTimer,
    isDead: false
  };

  updateIptvPlayingStatus();
  if (!isRestoringIptv) saveIptvState();
  if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();

  // Discord RPC yayını
  try {
    if (typeof window.sendPlayerActivity === 'function') {
      window.sendPlayerActivity(true, displayName, 'IPTV Canlı Yayın');
    }
  } catch (e) {}
}

/**
 * Belirtilen slotu temizler ve yayını durdurur.
 */
export function clearIptvSlot(slotIndex, save = true) {
  const slot = parseInt(slotIndex, 10) || 0;
  const slotEl = document.querySelector(`.iptv-slot[data-slot="${slot}"]`);
  if (!slotEl) return;

  // PVR açıksa durdur
  if (iptvPvrSessions[slot]?.isRecording) {
    stopIptvPvr(slot, true);
  }

  const cur = iptvPlayers[slot];
  if (cur) {
    if (cur.loadTimer) {
      clearTimeout(cur.loadTimer);
      cur.loadTimer = null;
    }
    try {
      if (cur.hls) cur.hls.destroy();
      if (cur.videoElement) {
        cur.videoElement.pause();
        cur.videoElement.src = '';
        cur.videoElement.load();
      }
    } catch (e) {}
    iptvPlayers[slot] = null;
  }

  const wrapper = slotEl.querySelector('.slot-video-wrapper');
  const placeholder = slotEl.querySelector('.slot-placeholder');
  const errorOverlay = slotEl.querySelector('.slot-error-overlay');
  if (wrapper) wrapper.classList.add('hidden');
  if (placeholder) placeholder.style.display = 'flex';
  if (errorOverlay) errorOverlay.classList.add('hidden');

  slotEl.classList.remove('has-video', 'osd-active');

  const recBtn = slotEl.querySelector('.pvr-rec-btn');
  if (recBtn) recBtn.classList.remove('recording');

  const tProg = slotEl.querySelector('.osd-timeline-progress');
  const tBuf = slotEl.querySelector('.osd-timeline-buffer');
  const tHand = slotEl.querySelector('.osd-timeline-handle');
  if (tProg) tProg.style.width = '0%';
  if (tBuf) tBuf.style.width = '0%';
  if (tHand) tHand.style.left = '0%';

  const dvrPill = slotEl.querySelector('.osd-dvr-pill');
  if (dvrPill) {
    dvrPill.classList.add('hidden');
    dvrPill.textContent = '';
  }

  updateIptvPlayingStatus();
  if (save && !isRestoringIptv) saveIptvState();

  const hasAnyActive = iptvPlayers.some(p => p !== null);
  if (!hasAnyActive && typeof window.sendPlayerActivity === 'function') {
    window.sendPlayerActivity(false);
  }
}

/**
 * Tüm slotları durdurur ve sıfırlar.
 */
export function stopAllIptvPlayers() {
  saveIptvState();
  const prev = isRestoringIptv;
  isRestoringIptv = true;
  try {
    for (let i = 0; i < 4; i++) clearIptvSlot(i, false);
  } finally {
    isRestoringIptv = prev;
  }
  if (typeof window.sendPlayerActivity === 'function') {
    window.sendPlayerActivity(false);
  }
}

export function stopAllIptvPlayersAndClear() {
  stopAllIptvPlayers();
  localStorage.removeItem('haytool_iptv_state');
}

export function clearIptvChannelList() {
  const lc = document.getElementById('iptv-channel-list');
  if (lc) lc.innerHTML = '';
}

export function getIptvPlayers() {
  return iptvPlayers;
}

export function toggleIptvMute(slotIndex) {
  const slot = parseInt(slotIndex, 10) || 0;
  const p = iptvPlayers[slot];
  if (p && p.videoElement) {
    p.videoElement.muted = !p.videoElement.muted;
  }
}

// ─── PVR KAYIT YÖNETİMİ (YAYIN KESİNTİSİZ) ───

export async function toggleIptvPvr(slotIndex) {
  const slot = parseInt(slotIndex, 10) || 0;
  if (iptvPvrSessions[slot]?.isRecording) {
    await stopIptvPvr(slot);
  } else {
    await startIptvPvr(slot);
  }
}

export async function startIptvPvr(slotIndex) {
  const slot = parseInt(slotIndex, 10) || 0;
  const playerRef = iptvPlayers[slot];

  if (!playerRef || !playerRef.streamUrl) {
    if (typeof showToast === 'function') {
      showToast(getTranslation('iptv_no_active_stream', 'Lütfen önce bu ekranda bir kanal açın.'), 'warning');
    }
    return;
  }

  const slotEl = document.querySelector(`.iptv-slot[data-slot="${slot}"]`);
  const recBtn = slotEl?.querySelector('.pvr-rec-btn');
  const timerText = recBtn?.querySelector('.pvr-timer-text');

  try {
    const res = await fetch('/api/iptv/pvr/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        slotIndex: slot,
        streamUrl: playerRef.streamUrl,
        channelName: playerRef.displayName || `Slot ${slot + 1}`
      })
    });
    const data = await res.json();
    if (!data.success) {
      if (typeof showToast === 'function') showToast(data.error || 'PVR başlatılamadı', 'error');
      return;
    }

    const session = {
      isRecording: true,
      startTime: data.startTime || Date.now(),
      channelName: playerRef.displayName,
      timerInterval: null
    };
    iptvPvrSessions[slot] = session;

    if (recBtn) recBtn.classList.add('recording');
    if (timerText) timerText.textContent = '00:00:00';

    session.timerInterval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - session.startTime) / 1000);
      if (timerText) timerText.textContent = formatTime(elapsed);
    }, 1000);

    if (typeof showToast === 'function') {
      showToast(getTranslation('iptv_pvr_started', 'Kayıt başlatıldı (yayın kesintisiz devam ediyor).'), 'info');
    }
  } catch (err) {
    console.error('[IPTV PVR] Başlatma hatası:', err);
  }
}

export async function stopIptvPvr(slotIndex, silent = false) {
  const slot = parseInt(slotIndex, 10) || 0;
  const session = iptvPvrSessions[slot];
  if (!session) return;

  if (session.timerInterval) {
    clearInterval(session.timerInterval);
    session.timerInterval = null;
  }
  iptvPvrSessions[slot] = null;

  const slotEl = document.querySelector(`.iptv-slot[data-slot="${slot}"]`);
  const recBtn = slotEl?.querySelector('.pvr-rec-btn');
  if (recBtn) recBtn.classList.remove('recording');

  try {
    const res = await fetch('/api/iptv/pvr/stop', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slotIndex: slot })
    });
    const data = await res.json();

    if (!silent && data.success) {
      const msg = `${getTranslation('iptv_pvr_saved', 'IPTV kaydı tamamlandı')}: ${data.duration || ''} (${data.fileSize || ''})`;
      if (typeof showToast === 'function') showToast(msg, 'success');
      if (typeof window.playNotificationSound === 'function') window.playNotificationSound('success');
      if (typeof window.loadHistoryList === 'function') window.loadHistoryList();
    }
  } catch (err) {
    console.error('[IPTV PVR] Durdurma hatası:', err);
  }
}

// ─── Slot & Görünüm Yönetimi ───

export function selectIptvSlot(slotIndex) {
  activeIptvSlot = Math.max(0, Math.min(3, slotIndex));
  document.querySelectorAll('.iptv-slot').forEach(s => s.classList.remove('active'));
  const activeEl = document.querySelector(`.iptv-slot[data-slot="${activeIptvSlot}"]`);
  if (activeEl) activeEl.classList.add('active');

  const label = document.getElementById('active-slot-label');
  if (label) {
    const isEn = getLocalDb().settings?.lang === 'en';
    label.textContent = isEn ? `Active Slot: Slot ${activeIptvSlot + 1}` : `Aktif Slot: Slot ${activeIptvSlot + 1}`;
  }

  // Seçilen aktif slotun sesini aç, diğer slotları sessize al
  iptvPlayers.forEach((p, idx) => {
    if (p && p.videoElement) {
      if (idx === activeIptvSlot) {
        if (!iptvUserExplicitlyMuted) {
          p.videoElement.muted = false;
          p.videoElement.volume = iptvGlobalVolume;
        }
      } else {
        p.videoElement.muted = true;
      }
    }
  });
}

export function swapIptvSportModePlayers() {
  const p0 = iptvPlayers[0];
  const p1 = iptvPlayers[1];
  if (!p0 && !p1) return;

  const url0 = p0?.streamUrl || '';
  const name0 = p0?.displayName || '';
  const url1 = p1?.streamUrl || '';
  const name1 = p1?.displayName || '';

  clearIptvSlot(0, false);
  clearIptvSlot(1, false);

  if (url1) playIptvChannel(0, url1, name1);
  if (url0) playIptvChannel(1, url0, name0);

  saveIptvState();
}

export function updateIptvSwapBtnVisibility() {
  const gridEl = document.getElementById('iptv-players-grid');
  const swapBtn = document.getElementById('iptv-swap-btn');
  if (!swapBtn || !gridEl) return;
  const isSport = gridEl.classList.contains('sport-mode');
  swapBtn.classList.toggle('hidden', !isSport);
}

function updateIptvPlayingStatus() {
  document.querySelectorAll('.iptv-channel-item').forEach(item => {
    const url = item.dataset.url;
    const isPlaying = iptvPlayers.some(p => p && p.streamUrl === url);
    item.classList.toggle('active-playing', isPlaying);
  });
}

export function resetIptvSlotStyles(slotIdx = null) {
  const resetSlot = (idx) => {
    const s = document.querySelector(`.iptv-slot[data-slot="${idx}"]`);
    if (s) {
      s.classList.remove('is-dragging', 'is-resizing');
      ['left','top','right','bottom','width','height','aspectRatio'].forEach(p => s.style[p] = '');
    }
  };
  slotIdx !== null ? resetSlot(slotIdx) : [0,1,2,3].forEach(resetSlot);
}

export function initIptvSportModeDragAndResize() {
  const gridEl = document.getElementById('iptv-players-grid');
  if (!gridEl) return;

  const setup = (idx) => {
    const slot = gridEl.querySelector(`.iptv-slot[data-slot="${idx}"]`);
    if (!slot) return;
    const resizeHandle = slot.querySelector('.slot-resize-handle');
    if (!resizeHandle) return;

    let isResizing = false;
    let startX = 0, startWidth = 0;

    resizeHandle.addEventListener('mousedown', (e) => {
      if (!gridEl.classList.contains('sport-mode')) return;
      e.preventDefault();
      e.stopPropagation();
      isResizing = true;
      startX = e.clientX;
      startWidth = slot.offsetWidth;
      slot.classList.add('is-resizing');

      const onMouseMove = (ev) => {
        if (!isResizing) return;
        const newW = Math.max(160, Math.min(startWidth + (ev.clientX - startX), gridEl.offsetWidth * 0.8));
        slot.style.width = `${newW}px`;
        slot.style.height = `${newW * (9 / 16)}px`;
      };

      const onMouseUp = () => {
        isResizing = false;
        slot.classList.remove('is-resizing');
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
      };

      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    });
  };

  setup(0);
  setup(1);
}

// ─── Durum Saklama ve Geri Yükleme ───

export function saveIptvState() {
  const gridEl = document.getElementById('iptv-players-grid');
  let currentMode = 'single-mode';
  if (gridEl) {
    ['single-mode', 'dual-mode', 'quad-mode', 'sport-mode'].forEach(m => {
      if (gridEl.classList.contains(m)) currentMode = m;
    });
  }

  const channelsData = iptvPlayers.map(p => {
    if (!p) return null;
    return { streamUrl: p.streamUrl, displayName: p.displayName };
  });

  const state = {
    mode: currentMode,
    activeSlot: activeIptvSlot,
    channels: channelsData,
    favorites: [...iptvFavorites]
  };

  try {
    localStorage.setItem('haytool_iptv_state', JSON.stringify(state));
  } catch (e) {}
}

export function restoreIptvState() {
  let state = null;
  try {
    state = JSON.parse(localStorage.getItem('haytool_iptv_state'));
  } catch (e) {}
  if (!state) return;

  isRestoringIptv = true;

  try {
    if (state.mode) {
      const modeBtnMap = {
        'single-mode': document.getElementById('iptv-single-view-btn'),
        'dual-mode': document.getElementById('iptv-dual-view-btn'),
        'quad-mode': document.getElementById('iptv-quad-view-btn'),
        'sport-mode': document.getElementById('iptv-sport-view-btn')
      };
      modeBtnMap[state.mode]?.click();
    }

    if (state.activeSlot !== undefined) {
      selectIptvSlot(state.activeSlot);
    }

    if (Array.isArray(state.channels)) {
      state.channels.forEach((ch, idx) => {
        if (ch && ch.streamUrl) {
          playIptvChannel(idx, ch.streamUrl, ch.displayName);
        }
      });
    }
  } finally {
    isRestoringIptv = false;
  }
}

// ─── IPTV Durum Denetimi ───

export async function checkIptvStatus() {
  try {
    const res = await fetch('/api/iptv/status');
    const data = await res.json();
    const infoEl = document.getElementById('iptv-status-info');
    if (!infoEl) return;

    if (data.status === 'updating') {
      infoEl.textContent = 'İndiriliyor...';
    } else if (data.totalChannels > 0) {
      infoEl.textContent = `${data.totalChannels.toLocaleString()} Kanal`;
    }
  } catch (e) {}
}

function startIptvStatusPolling() {
  if (iptvStatusInterval) clearInterval(iptvStatusInterval);
  iptvStatusInterval = setInterval(checkIptvStatus, 60000);
}

// ─── Özel Açılır Menüler (Dropdowns) ───

function setupCustomDropdowns() {
  const countryWrapper = document.getElementById('iptv-country-dropdown-wrapper');
  const countryTrigger = document.getElementById('iptv-country-trigger');
  const countryMenu = document.getElementById('iptv-country-menu');
  const countrySearch = document.getElementById('iptv-country-search');

  const catWrapper = document.getElementById('iptv-category-dropdown-wrapper');
  const catTrigger = document.getElementById('iptv-category-trigger');
  const catMenu = document.getElementById('iptv-category-menu');
  const catSearch = document.getElementById('iptv-category-search');

  countryTrigger?.addEventListener('click', (e) => {
    e.stopPropagation();
    catMenu?.classList.add('hidden');
    countryMenu?.classList.toggle('hidden');
    if (!countryMenu?.classList.contains('hidden')) countrySearch?.focus();
  });

  catTrigger?.addEventListener('click', (e) => {
    e.stopPropagation();
    countryMenu?.classList.add('hidden');
    catMenu?.classList.toggle('hidden');
    if (!catMenu?.classList.contains('hidden')) catSearch?.focus();
  });

  document.addEventListener('click', (e) => {
    if (!countryWrapper?.contains(e.target)) countryMenu?.classList.add('hidden');
    if (!catWrapper?.contains(e.target)) catMenu?.classList.add('hidden');
  });

  countrySearch?.addEventListener('input', (e) => {
    const q = e.target.value.toLowerCase();
    document.querySelectorAll('#iptv-country-list .iptv-menu-item').forEach(item => {
      const text = item.textContent.toLowerCase();
      item.style.display = text.includes(q) ? 'flex' : 'none';
    });
  });

  catSearch?.addEventListener('input', (e) => {
    const q = e.target.value.toLowerCase();
    document.querySelectorAll('#iptv-category-list .iptv-menu-item').forEach(item => {
      const text = item.textContent.toLowerCase();
      item.style.display = text.includes(q) ? 'flex' : 'none';
    });
  });
}

function populateIptvFilters(filters) {
  if (!filters) return;
  const countryList = document.getElementById('iptv-country-list');
  const catList = document.getElementById('iptv-category-list');

  if (countryList && countryList.children.length <= 1 && Array.isArray(filters.countries)) {
    countryList.innerHTML = `<div class="iptv-menu-item" data-value="">🌐 Tüm Ülkeler</div>`;
    filters.countries.forEach(c => {
      const item = document.createElement('div');
      item.className = 'iptv-menu-item';
      item.dataset.value = c;
      item.innerHTML = `${getCountryFlagHtml(c, 'iptv-flag-img')} <span>${getCountryName(c)}</span>`;
      item.onclick = () => {
        iptvSelectedCountry = c;
        updateCustomCountryTriggerUI(c);
        document.getElementById('iptv-country-menu')?.classList.add('hidden');
        loadIptvChannels();
      };
      countryList.appendChild(item);
    });
  }

  if (catList && catList.children.length <= 1 && Array.isArray(filters.categories)) {
    catList.innerHTML = `<div class="iptv-menu-item" data-value="">📁 Tüm Kategoriler</div>`;
    filters.categories.forEach(cat => {
      const item = document.createElement('div');
      item.className = 'iptv-menu-item';
      item.dataset.value = cat;
      item.textContent = cat;
      item.onclick = () => {
        iptvSelectedCategory = cat;
        updateCustomCategoryTriggerUI(cat);
        document.getElementById('iptv-category-menu')?.classList.add('hidden');
        loadIptvChannels();
      };
      catList.appendChild(item);
    });
  }
}

function updateCustomCountryTriggerUI(country) {
  const triggerText = document.getElementById('iptv-country-trigger-text');
  const triggerFlag = document.querySelector('#iptv-country-trigger .iptv-trigger-flag');
  if (triggerText) triggerText.textContent = country ? getCountryName(country) : 'Tüm Ülkeler';
  if (triggerFlag) triggerFlag.innerHTML = country ? getCountryFlagHtml(country, 'iptv-flag-img') : '🌐';
}

function updateCustomCategoryTriggerUI(cat) {
  const triggerText = document.getElementById('iptv-category-trigger-text');
  if (triggerText) triggerText.textContent = cat || 'Tüm Kategoriler';
}

// ─── Window Köprüsü (Dış modüllerle ve HTML ile tam uyumluluk) ───
if (typeof window !== 'undefined') {
  window.initIptv = initIptv;
  window.loadIptvChannels = loadIptvChannels;
  window.checkIptvStatus = checkIptvStatus;
  window.restoreIptvState = restoreIptvState;
  window.stopAllIptvPlayers = stopAllIptvPlayers;
  window.stopAllIptvPlayersAndClear = stopAllIptvPlayersAndClear;
  window.selectIptvSlot = selectIptvSlot;
  window.playIptvChannel = playIptvChannel;
  window.clearIptvSlot = clearIptvSlot;
  window.toggleIptvPvr = toggleIptvPvr;
  window.startIptvPvr = startIptvPvr;
  window.stopIptvPvr = stopIptvPvr;
  window.swapIptvSportModePlayers = swapIptvSportModePlayers;
  window.updateIptvSwapBtnVisibility = updateIptvSwapBtnVisibility;
  window.renderIptvChannels = renderIptvChannels;
  window.playRandomIptvChannel = playRandomIptvChannel;
  window.playNextIptvChannel = playNextIptvChannel;
  window.playPrevIptvChannel = playPrevIptvChannel;
  window.getCountryFlag = getCountryFlag;
  window.getCountryName = getCountryName;
  window.iptvPlayers = iptvPlayers;
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => initIptv());
  } else {
    initIptv();
  }
}
