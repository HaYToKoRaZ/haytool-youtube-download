/**
 * IPTV Modülü - HaYTooL YouTube Downloader
 *
 * Yapımcı: HaYTo
 * Açıklama: IPTV kanal listesi, oynatıcı yönetimi ve çoklu ekran (spor modu) işlevlerini içerir.
 * Bağımlılıklar: app.js getState() fonksiyonu ile localDb, currentLang erişimi sağlanır.
 *
 * Kullanım: import { initIptv, loadIptvChannels, checkIptvStatus,
 *             restoreIptvState, stopAllIptvPlayersAndClear, getIptvPlayers } from './modules/iptv.js';
 */

// ─── Modül-içi durum değişkenleri ───
let iptvPlayers = [null, null, null, null];
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

// getState: app.js'den alınan localDb ve currentLang erişimi için
let _getState = null;
let _iptvInitialized = false;

/**
 * Yerel veritabanına ve ayarlara güvenli erişim sağlar.
 * _getState tanımlı değilse window.localDb veya varsayılan nesneye düşer.
 * @returns {Object}
 */
function getLocalDb() {
  const state = typeof _getState === 'function' ? _getState() : null;
  return state?.localDb || window.localDb || { settings: { lang: 'tr' } };
}

/**
 * 2 harfli ISO 3166-1 alpha-2 ülke kodundan standart Unicode bayrak emojisi üretir.
 * 
 * @param {string} countryCode - Örn: 'TR', 'US', 'DE'
 * @returns {string} Bayrak emojisi (örn: 🇹🇷)
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
 * Windows ve tüm platformlarda bayrağın kesinlikle renkli ve doğru görünmesi için
 * HTML formatında bayrak üretir (SVG flagcdn + Unicode emoji fallback).
 * 
 * @param {string} countryCode - Örn: 'TR', 'US', 'DE'
 * @param {string} [className='iptv-flag-img'] - CSS sınıfı
 * @returns {string} HTML dizesi (örn: `<img class="iptv-flag-img" ...>`)
 */
export function getCountryFlagHtml(countryCode, className = 'iptv-flag-img') {
  if (!countryCode || typeof countryCode !== 'string' || countryCode.length !== 2) return '';
  const code = countryCode.toLowerCase();
  const emoji = getCountryFlag(countryCode);
  return `<img class="${className}" src="https://flagcdn.com/w40/${code}.png" alt="${countryCode}" loading="lazy" onerror="this.outerHTML='<span class=\\'iptv-flag-icon\\'>${emoji}</span>';">`;
}

/**
 * 2 harfli ülke kodundan tarayıcının yerleşik Intl API'si ile yerelleştirilmiş ülke adını döner.
 * 
 * @param {string} countryCode - Örn: 'TR'
 * @param {string} [lang='tr'] - Dil kodu ('tr', 'en', 'es', 'de' vb.)
 * @returns {string} Ülke adı (örn: 'Türkiye')
 */
export function getCountryName(countryCode, lang = 'tr') {
  if (!countryCode || typeof countryCode !== 'string' || countryCode.length !== 2) return '';
  try {
    const regionNames = new Intl.DisplayNames([lang || 'tr', 'tr', 'en'], { type: 'region' });
    return regionNames.of(countryCode.toUpperCase()) || countryCode.toUpperCase();
  } catch (e) {
    return countryCode.toUpperCase();
  }
}

// ─── Dışa açılan API ───

/**
 * Güncel iptvPlayers dizisini döndürür.
 * @returns {Array<Object|null>}
 */
export function getIptvPlayers() { return iptvPlayers; }

/**
 * Tüm IPTV oynatıcılarını durdurur ve kanal listesini temizler (RAM tasarrufu).
 * Sekme değiştirildiğinde app.js tarafından çağrılır.
 * @returns {void}
 */
export function stopAllIptvPlayersAndClear() {
  if (iptvStatusInterval) {
    clearInterval(iptvStatusInterval);
    iptvStatusInterval = null;
  }
  stopAllIptvPlayers();
  clearIptvChannelList();
  const loadingEl = document.getElementById('iptv-list-loading');
  if (loadingEl) loadingEl.classList.add('hidden');
  iptvSearchQuery = '';
  iptvSelectedCountry = '';
  iptvSelectedCategory = '';
  const searchEl = document.getElementById('iptv-search-input');
  if (searchEl) searchEl.value = '';
  const cEl = document.getElementById('iptv-country-filter');
  if (cEl) cEl.value = '';
  const catEl = document.getElementById('iptv-category-filter');
  if (catEl) catEl.value = '';
  updateCustomCountryTriggerUI('');
  updateCustomCategoryTriggerUI('');
  syncQuickFlagButtons('');
}

/**
 * Kanal listesi DOM kapsayıcısını temizler.
 */
export function clearIptvChannelList() {
  const listContainer = document.getElementById('iptv-channel-list');
  if (listContainer) listContainer.innerHTML = '';
}

export {
  loadIptvChannels,
  checkIptvStatus,
  restoreIptvState,
  stopAllIptvPlayers,
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
};

/**
 * IPTV modülünü başlatır. Tüm DOM event listener'larını kurar.
 * @param {Function} [getState] - { localDb } döndüren fonksiyon
 */
export function initIptv(getState) {
  if (getState) _getState = getState;
  if (_iptvInitialized) return;
  _iptvInitialized = true;

  // Slot tıklama → aktif slot seç
  document.querySelectorAll('.iptv-slot').forEach(slot => {
    slot.addEventListener('click', (e) => {
      if (e.target.closest('.slot-controls')) return;
      selectIptvSlot(parseInt(slot.getAttribute('data-slot'), 10));
    });
  });

  // Slot butonları: mute, swap, clear
  document.querySelectorAll('.iptv-slot').forEach(slot => {
    const slotIndex = parseInt(slot.getAttribute('data-slot'), 10);
    slot.querySelector('.mute-btn')?.addEventListener('click', (e) => { e.stopPropagation(); toggleIptvMute(slotIndex); });
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
    if ((mode === 'dual-mode' || mode === 'sport-mode') && activeIptvSlot > 1) selectIptvSlot(0);
    updateIptvSwapBtnVisibility();
    resizeAllArtplayers();
    if (!isRestoringIptv) saveIptvState();
  };

  if (gridEl) {
    singleBtn?.addEventListener('click', () => setLayout('single-mode', singleBtn));
    dualBtn?.addEventListener('click',   () => setLayout('dual-mode',   dualBtn));
    quadBtn?.addEventListener('click',   () => setLayout('quad-mode',   quadBtn));
    sportBtn?.addEventListener('click',  () => setLayout('sport-mode',  sportBtn));
  }

  // Grid tam ekran
  const gridFullscreenBtn = document.getElementById('iptv-grid-fullscreen-btn');
  if (gridFullscreenBtn && gridEl) {
    gridFullscreenBtn.addEventListener('click', () => {
      if (!document.fullscreenElement) gridEl.requestFullscreen().catch(e => console.error('[IPTV]', e));
      else document.exitFullscreen().catch(e => console.error('[IPTV]', e));
    });
    document.addEventListener('fullscreenchange', () => {
      const icon = gridFullscreenBtn.querySelector('i');
      if (icon) {
        icon.setAttribute('data-lucide', document.fullscreenElement === gridEl ? 'minimize' : 'maximize');
        if (!document.fullscreenElement) resetIptvSlotStyles();
        if (window.lucide) lucide.createIcons();
      }
      setTimeout(() => { window.dispatchEvent(new Event('resize')); resizeAllArtplayers(); }, 150);
    });
  }

  // Filtreler
  const iptvSearchInput   = document.getElementById('iptv-search-input');
  const iptvCountryFilter = document.getElementById('iptv-country-filter');
  const iptvCategoryFilter = document.getElementById('iptv-category-filter');
  const countryWrapper    = document.getElementById('iptv-country-dropdown-wrapper');
  const countryTrigger    = document.getElementById('iptv-country-trigger');
  const countryMenu       = document.getElementById('iptv-country-menu');
  const countrySearch     = document.getElementById('iptv-country-search');

  if (iptvSearchInput) {
    let _t = null;
    iptvSearchInput.addEventListener('input', () => {
      clearTimeout(_t);
      _t = setTimeout(() => { iptvSearchQuery = iptvSearchInput.value.trim(); loadIptvChannels(); }, 300);
    });
  }

  // Özel Ülke Menüsü Açma/Kapama
  if (countryTrigger && countryMenu) {
    countryTrigger.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = !countryMenu.classList.contains('hidden');
      if (isOpen) {
        countryMenu.classList.add('hidden');
        countryWrapper?.classList.remove('open');
      } else {
        countryMenu.classList.remove('hidden');
        countryWrapper?.classList.add('open');
        if (countrySearch) {
          countrySearch.value = '';
          filterCustomCountryList('');
          setTimeout(() => countrySearch.focus(), 50);
        }
      }
    });

    // Menü dışına tıklanınca kapat
    document.addEventListener('click', (e) => {
      if (countryWrapper && !countryWrapper.contains(e.target)) {
        countryMenu.classList.add('hidden');
        countryWrapper.classList.remove('open');
      }
    });

    // Menü içi arama inputu
    countrySearch?.addEventListener('input', (e) => {
      e.stopPropagation();
      filterCustomCountryList(countrySearch.value.trim().toLowerCase());
    });

    countrySearch?.addEventListener('click', (e) => {
      e.stopPropagation();
    });
  }

  // Özel Kategori Menüsü Açma/Kapama
  const categoryWrapper = document.getElementById('iptv-category-dropdown-wrapper');
  const categoryTrigger = document.getElementById('iptv-category-trigger');
  const categoryMenu    = document.getElementById('iptv-category-menu');
  const categorySearch  = document.getElementById('iptv-category-search');

  if (categoryTrigger && categoryMenu) {
    categoryTrigger.addEventListener('click', (e) => {
      e.stopPropagation();
      // Ülke menüsü açıksa kapat
      if (countryMenu && !countryMenu.classList.contains('hidden')) {
        countryMenu.classList.add('hidden');
        countryWrapper?.classList.remove('open');
      }

      const isOpen = !categoryMenu.classList.contains('hidden');
      if (isOpen) {
        categoryMenu.classList.add('hidden');
        categoryWrapper?.classList.remove('open');
      } else {
        categoryMenu.classList.remove('hidden');
        categoryWrapper?.classList.add('open');
        if (categorySearch) {
          categorySearch.value = '';
          filterCustomCategoryList('');
          setTimeout(() => categorySearch.focus(), 50);
        }
      }
    });

    // Menü dışına tıklanınca kapat
    document.addEventListener('click', (e) => {
      if (categoryWrapper && !categoryWrapper.contains(e.target)) {
        categoryMenu.classList.add('hidden');
        categoryWrapper.classList.remove('open');
      }
    });

    // Menü içi arama inputu
    categorySearch?.addEventListener('input', (e) => {
      e.stopPropagation();
      filterCustomCategoryList(categorySearch.value.trim().toLowerCase());
    });

    categorySearch?.addEventListener('click', (e) => {
      e.stopPropagation();
    });
  }

  iptvCountryFilter?.addEventListener('change', () => {
    iptvSelectedCountry = iptvCountryFilter.value;
    updateCustomCountryTriggerUI(iptvSelectedCountry);
    syncQuickFlagButtons(iptvSelectedCountry);
    loadIptvChannels();
  });

  iptvCategoryFilter?.addEventListener('change', () => {
    iptvSelectedCategory = iptvCategoryFilter.value;
    updateCustomCategoryTriggerUI(iptvSelectedCategory);
    loadIptvChannels();
  });

  document.querySelectorAll('.iptv-quick-flag-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const country = btn.getAttribute('data-country');
      if (!country) return;
      if (iptvSelectedCountry === country) {
        // Zaten seçiliyse filtreyi kaldır
        iptvSelectedCountry = '';
        if (iptvCountryFilter) iptvCountryFilter.value = '';
        btn.classList.remove('active');
      } else {
        iptvSelectedCountry = country;
        if (iptvCountryFilter) iptvCountryFilter.value = country;
      }
      updateCustomCountryTriggerUI(iptvSelectedCountry);
      syncQuickFlagButtons(iptvSelectedCountry);
      loadIptvChannels();
    });
  });

  document.getElementById('iptv-load-more-btn')?.addEventListener('click', () => {
    iptvCurrentPage++;
    loadIptvChannels(true);
  });

  // IPTV güncelleme butonu
  document.getElementById('iptv-update-btn')?.addEventListener('click', async () => {
    const localDb = getLocalDb();
    const isEn = localDb.settings?.lang === 'en';
    try {
      if (window.showToast) showToast(isEn ? 'IPTV list update requested...' : 'IPTV listesi güncellemesi istendi...', 'info');
      const res = await fetch('/api/iptv/update', { method: 'POST' });
      const data = await res.json();
      if (data.success) checkIptvStatus();
      else if (window.showToast) showToast(data.error || 'Update request failed.', 'error');
    } catch { if (window.showToast) showToast('[IPTV] Bağlantı hatası.', 'error'); }
  });

  // Swap butonu
  document.getElementById('iptv-swap-btn')?.addEventListener('click', swapIptvSportModePlayers);

  // Global klavye: S/Y → swap (spor modunda)
  document.addEventListener('keydown', (e) => {
    const activeEl = document.activeElement;
    if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA')) return;
    const gEl = document.getElementById('iptv-players-grid');
    if (!gEl || !gEl.classList.contains('sport-mode')) return;
    if ('sSyY'.includes(e.key)) { e.preventDefault(); swapIptvSportModePlayers(); }
  });

  initIptvSportModeDragAndResize();
}

// ─── Modül-içi Fonksiyonlar ───

async function loadIptvChannels(append = false) {
  if (!append) {
    iptvIsLoading = true;
    iptvCurrentPage = 1;
    const lc = document.getElementById('iptv-channel-list');
    if (lc) lc.innerHTML = '';
  } else {
    iptvIsAppending = true;
  }
  const li = document.getElementById('iptv-list-loading');
  if (li) li.classList.remove('hidden');
  try {
    const hasFilter = (iptvSelectedCountry || iptvSearchQuery || iptvSelectedCategory);
    const url = `/api/iptv/channels?limit=${hasFilter ? 0 : 200}&page=${iptvCurrentPage}&search=${encodeURIComponent(iptvSearchQuery)}&country=${encodeURIComponent(iptvSelectedCountry)}&category=${encodeURIComponent(iptvSelectedCategory)}`;
    const res = await fetch(url);
    const data = await res.json();
    if (li) li.classList.add('hidden');
    iptvTotalPages = data.pagination?.totalPages || 1;
    iptvTotalCount = data.pagination?.totalCount || 0;
    renderIptvChannels(data.channels, append);
    populateIptvFilters(data.filters);
    updateLoadMoreBtn();
  } catch (err) {
    console.error('[IPTV] Kanal listesi yükleme hatası:', err);
    const localDb = getLocalDb();
    if (window.showToast) showToast(localDb.settings?.lang === 'en' ? 'Failed to load IPTV channels.' : 'IPTV kanalları yüklenemedi.', 'error');
    if (li) li.classList.add('hidden');
  } finally {
    iptvIsLoading = false;
    iptvIsAppending = false;
  }
}

function updateLoadMoreBtn() {
  const btn = document.getElementById('iptv-load-more-btn');
  if (!btn) return;
  const hasFilter = (iptvSelectedCountry || iptvSearchQuery || iptvSelectedCategory);
  if (hasFilter || iptvCurrentPage >= iptvTotalPages) {
    btn.classList.add('hidden');
  } else {
    btn.classList.remove('hidden');
    const localDb = getLocalDb();
    const isEn = localDb.settings?.lang === 'en';
    const shown = Math.min(iptvCurrentPage * 200, iptvTotalCount);
    btn.textContent = `${isEn ? 'Load More' : 'Daha Fazla'} (${shown} / ${iptvTotalCount})`;
  }
}

function renderIptvChannels(channels, append = false) {
  const lc = document.getElementById('iptv-channel-list');
  if (!lc) return;
  if (!append) lc.innerHTML = '';
  const localDb = getLocalDb();
  const isEn = localDb.settings?.lang === 'en';
  if (channels.length === 0 && !append) {
    lc.innerHTML = `<div class="text-center text-muted" style="padding:20px 0;font-size:0.85rem;">${isEn ? 'No channels found.' : 'Kanal bulunamadı.'}</div>`;
    return;
  }
  const frag = document.createDocumentFragment();
  channels.forEach(ch => {
    const div = document.createElement('div');
    div.className = 'iptv-channel-item';
    div.dataset.url = ch.url;
    if (iptvPlayers.some(p => p && p.streamUrl === ch.url)) div.classList.add('playing');
    const logoHtml = ch.logo
      ? `<img src="${ch.logo}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.outerHTML='<i data-lucide=\\'monitor\\'></i>';if(window.lucide)lucide.createIcons();">`
      : `<i data-lucide="monitor"></i>`;
    const badges = [];
    if (ch.category) badges.push(`<span class="iptv-channel-badge iptv-channel-category">${ch.category}</span>`);
    if (ch.country) {
      const flagPrefix = getCountryFlagHtml(ch.country, 'iptv-flag-img');
      badges.push(`<span class="iptv-channel-badge iptv-channel-country" title="${getCountryName(ch.country, isEn ? 'en' : 'tr')}">${flagPrefix ? flagPrefix + ' ' : ''}${ch.country}</span>`);
    }
    div.innerHTML = `<div class="iptv-channel-logo">${logoHtml}</div><div class="iptv-channel-details"><div class="iptv-channel-name">${ch.displayName}</div><div class="iptv-channel-sub">${badges.join('')}</div></div>`;
    div.addEventListener('click', () => playIptvChannel(activeIptvSlot, ch.url, ch.displayName));
    frag.appendChild(div);
  });
  lc.appendChild(frag);
  lucide.createIcons();
}

function updateIptvPlayingStatus() {
  const lc = document.getElementById('iptv-channel-list');
  if (!lc) return;
  lc.querySelectorAll('.iptv-channel-item').forEach(item => {
    const isPlaying = iptvPlayers.some(p => p && p.streamUrl === item.dataset.url);
    item.classList.toggle('playing', isPlaying);
  });
}

function syncQuickFlagButtons(selectedCountry) {
  document.querySelectorAll('.iptv-quick-flag-btn').forEach(btn => {
    const code = btn.getAttribute('data-country');
    btn.classList.toggle('active', !!(selectedCountry && code === selectedCountry));
  });
}

function updateCustomCountryTriggerUI(countryCode) {
  const triggerText = document.getElementById('iptv-country-trigger-text');
  const triggerFlag = document.querySelector('#iptv-country-trigger .iptv-trigger-flag');
  const localDb = getLocalDb();
  const currentLang = localDb.settings?.lang || 'tr';
  const isEn = currentLang === 'en';

  if (!countryCode) {
    if (triggerFlag) triggerFlag.innerHTML = '🌐';
    if (triggerText) triggerText.textContent = isEn ? 'All Countries' : 'Tüm Ülkeler';
    return;
  }

  const flagHtml = getCountryFlagHtml(countryCode, 'iptv-flag-img');
  const name = getCountryName(countryCode, currentLang);
  if (triggerFlag) triggerFlag.innerHTML = flagHtml || '🌐';
  if (triggerText) triggerText.textContent = `${name} (${countryCode})`;
}

function updateCustomCategoryTriggerUI(categoryName) {
  const triggerText = document.getElementById('iptv-category-trigger-text');
  const triggerFlag = document.querySelector('#iptv-category-trigger .iptv-trigger-flag');
  const localDb = getLocalDb();
  const isEn = localDb.settings?.lang === 'en';

  if (!categoryName) {
    if (triggerFlag) triggerFlag.innerHTML = '📁';
    if (triggerText) triggerText.textContent = isEn ? 'All Categories' : 'Tüm Kategoriler';
    return;
  }

  if (triggerFlag) triggerFlag.innerHTML = '📺';
  if (triggerText) triggerText.textContent = categoryName.length > 25 ? categoryName.substring(0, 25) + '...' : categoryName;
}

function filterCustomCountryList(filterText) {
  const listEl = document.getElementById('iptv-country-list');
  if (!listEl) return;
  const items = listEl.querySelectorAll('.iptv-menu-item');
  items.forEach(item => {
    if (!filterText) {
      item.style.display = 'flex';
      return;
    }
    const name = (item.dataset.name || '').toLowerCase();
    const code = (item.dataset.code || '').toLowerCase();
    const matches = name.includes(filterText) || code.includes(filterText);
    item.style.display = matches ? 'flex' : 'none';
  });
}

function filterCustomCategoryList(filterText) {
  const listEl = document.getElementById('iptv-category-list');
  if (!listEl) return;
  const items = listEl.querySelectorAll('.iptv-menu-item');
  items.forEach(item => {
    if (!filterText) {
      item.style.display = 'flex';
      return;
    }
    const name = (item.dataset.name || '').toLowerCase();
    const matches = name.includes(filterText);
    item.style.display = matches ? 'flex' : 'none';
  });
}

function populateIptvFilters(filters) {
  if (!filters) return;
  const cf = document.getElementById('iptv-country-filter');
  const catf = document.getElementById('iptv-category-filter');
  const customCountryListEl = document.getElementById('iptv-country-list');
  const customCatListEl = document.getElementById('iptv-category-list');
  const localDb = getLocalDb();
  const currentLang = localDb.settings?.lang || 'tr';
  const isEn = currentLang === 'en';
  const selC = iptvSelectedCountry || cf?.value || '';
  const selCat = iptvSelectedCategory || catf?.value || '';

  // 1. Ülke Filtresi Doldurma
  if (filters.countries) {
    if (cf) {
      cf.innerHTML = `<option value="">${isEn ? 'All Countries' : 'Tüm Ülkeler'}</option>`;
    }

    const countryItems = filters.countries.map(c => {
      const flag = getCountryFlag(c);
      const name = getCountryName(c, currentLang);
      const label = flag ? `${flag} ${name} (${c})` : `${name} (${c})`;
      return { code: c, label, name, flag };
    });

    countryItems.sort((a, b) => a.name.localeCompare(b.name, currentLang));

    if (cf) {
      countryItems.forEach(item => {
        const o = document.createElement('option');
        o.value = item.code;
        o.textContent = item.label;
        cf.appendChild(o);
      });
      if (selC) cf.value = selC;
    }

    if (customCountryListEl) {
      customCountryListEl.innerHTML = '';

      // "Tüm Ülkeler" öğesi
      const allItem = document.createElement('div');
      allItem.className = `iptv-menu-item ${!selC ? 'selected' : ''}`;
      allItem.dataset.code = '';
      allItem.dataset.name = isEn ? 'All Countries' : 'Tüm Ülkeler';
      allItem.innerHTML = `
        <span class="iptv-menu-flag">🌐</span>
        <span class="iptv-menu-name">${isEn ? 'All Countries' : 'Tüm Ülkeler'}</span>
      `;
      allItem.addEventListener('click', () => selectCountryFromMenu(''));
      customCountryListEl.appendChild(allItem);

      // Her ülke için bayraklı öğe (Windows'ta emoji render hatasını engelleyen flagcdn img + fallback)
      countryItems.forEach(item => {
        const itemEl = document.createElement('div');
        const isSelected = selC === item.code;
        itemEl.className = `iptv-menu-item ${isSelected ? 'selected' : ''}`;
        itemEl.dataset.code = item.code;
        itemEl.dataset.name = item.name;
        const flagHtml = getCountryFlagHtml(item.code, 'iptv-menu-flag-img');
        itemEl.innerHTML = `
          <span class="iptv-menu-flag">${flagHtml}</span>
          <span class="iptv-menu-name">${item.name}</span>
          <span class="iptv-menu-code">${item.code}</span>
        `;
        itemEl.addEventListener('click', () => selectCountryFromMenu(item.code));
        customCountryListEl.appendChild(itemEl);
      });
    }

    updateCustomCountryTriggerUI(selC);
    syncQuickFlagButtons(selC);
  }

  // 2. Kategori Filtresi Doldurma
  if (filters.categories) {
    if (catf) {
      catf.innerHTML = `<option value="">${isEn ? 'All Categories' : 'Tüm Kategoriler'}</option>`;
      filters.categories.forEach(cat => {
        const o = document.createElement('option');
        o.value = cat;
        o.textContent = cat.length > 40 ? cat.substring(0, 40) + '...' : cat;
        catf.appendChild(o);
      });
      if (selCat) catf.value = selCat;
    }

    if (customCatListEl) {
      customCatListEl.innerHTML = '';

      // "Tüm Kategoriler" öğesi
      const allCatItem = document.createElement('div');
      allCatItem.className = `iptv-menu-item ${!selCat ? 'selected' : ''}`;
      allCatItem.dataset.name = isEn ? 'All Categories' : 'Tüm Kategoriler';
      allCatItem.innerHTML = `
        <span class="iptv-menu-flag">📁</span>
        <span class="iptv-menu-name">${isEn ? 'All Categories' : 'Tüm Kategoriler'}</span>
      `;
      allCatItem.addEventListener('click', () => selectCategoryFromMenu(''));
      customCatListEl.appendChild(allCatItem);

      filters.categories.forEach(cat => {
        const catItem = document.createElement('div');
        const isSelected = selCat === cat;
        catItem.className = `iptv-menu-item ${isSelected ? 'selected' : ''}`;
        catItem.dataset.name = cat;
        catItem.innerHTML = `
          <span class="iptv-menu-flag">📺</span>
          <span class="iptv-menu-name">${cat}</span>
        `;
        catItem.addEventListener('click', () => selectCategoryFromMenu(cat));
        customCatListEl.appendChild(catItem);
      });
    }

    updateCustomCategoryTriggerUI(selCat);
  }
}

function selectCountryFromMenu(code) {
  iptvSelectedCountry = code;
  const cf = document.getElementById('iptv-country-filter');
  if (cf) cf.value = code;

  const customListEl = document.getElementById('iptv-country-list');
  if (customListEl) {
    customListEl.querySelectorAll('.iptv-menu-item').forEach(item => {
      item.classList.toggle('selected', (item.dataset.code || '') === code);
    });
  }

  updateCustomCountryTriggerUI(code);
  syncQuickFlagButtons(code);

  const countryMenu = document.getElementById('iptv-country-menu');
  const countryWrapper = document.getElementById('iptv-country-dropdown-wrapper');
  countryMenu?.classList.add('hidden');
  countryWrapper?.classList.remove('open');

  loadIptvChannels();
}

function selectCategoryFromMenu(cat) {
  iptvSelectedCategory = cat;
  const catf = document.getElementById('iptv-category-filter');
  if (catf) catf.value = cat;

  const customListEl = document.getElementById('iptv-category-list');
  if (customListEl) {
    customListEl.querySelectorAll('.iptv-menu-item').forEach(item => {
      item.classList.toggle('selected', (item.dataset.name || '') === cat);
    });
  }

  updateCustomCategoryTriggerUI(cat);

  const categoryMenu = document.getElementById('iptv-category-menu');
  const categoryWrapper = document.getElementById('iptv-category-dropdown-wrapper');
  categoryMenu?.classList.add('hidden');
  categoryWrapper?.classList.remove('open');

  loadIptvChannels();
}

function selectIptvSlot(slotIndex) {
  activeIptvSlot = slotIndex;
  window.activeIptvSlot = slotIndex;
  document.querySelectorAll('.iptv-slot').forEach(slot => {
    slot.classList.toggle('active', parseInt(slot.getAttribute('data-slot'), 10) === slotIndex);
  });
  const label = document.getElementById('active-slot-label');
  if (label) {
    const localDb = getLocalDb();
    const isEn = localDb.settings?.lang === 'en';
    label.textContent = isEn ? `Active Slot: Slot ${slotIndex + 1}` : `Aktif Slot: Slot ${slotIndex + 1}`;
  }
}

function toggleIptvMute(slotIndex) {
  const cur = iptvPlayers[slotIndex];
  if (!cur) return;
  const muteBtn = document.querySelector(`.iptv-slot[data-slot="${slotIndex}"] .mute-btn`);
  let isMuted = false;
  if (cur.type === 'plyr' && cur.player) { isMuted = cur.player.muted; cur.player.muted = !isMuted; isMuted = !isMuted; }
  else if (cur.videoElement) { isMuted = cur.videoElement.muted; cur.videoElement.muted = !isMuted; isMuted = !isMuted; }
  if (muteBtn) { muteBtn.innerHTML = isMuted ? '<i data-lucide="volume-x"></i>' : '<i data-lucide="volume-2"></i>'; lucide.createIcons(); }
}

function clearIptvSlot(slotIndex) {
  const slotEl = document.querySelector(`.iptv-slot[data-slot="${slotIndex}"]`);
  if (!slotEl) return;
  const cur = iptvPlayers[slotIndex];
  if (cur) {
    try {
      if (cur.type === 'plyr' && cur.player) cur.player.destroy();
      if (cur.hls) cur.hls.destroy();
      if (cur.videoElement) { cur.videoElement.pause(); cur.videoElement.src = ''; cur.videoElement.load(); }
    } catch (e) { console.error(`[IPTV] Slot ${slotIndex} temizleme hatası:`, e); }
    iptvPlayers[slotIndex] = null;
  }
  const pc = slotEl.querySelector('.slot-player-instance');
  if (pc) pc.innerHTML = '';
  slotEl.classList.remove('has-video');
  const titleEl = slotEl.querySelector('.slot-title');
  if (titleEl) titleEl.textContent = `Slot ${slotIndex + 1}: Boş`;
  const muteBtn = slotEl.querySelector('.mute-btn');
  if (muteBtn) { muteBtn.innerHTML = '<i data-lucide="volume-x"></i>'; lucide.createIcons(); }
  updateIptvPlayingStatus();
  if (!isRestoringIptv) saveIptvState();
}

function stopAllIptvPlayers() {
  saveIptvState();
  const prev = isRestoringIptv;
  isRestoringIptv = true;
  try { for (let i = 0; i < 4; i++) clearIptvSlot(i); }
  finally { isRestoringIptv = prev; }
}

function playIptvChannel(slotIndex, streamUrl, displayName) {
  clearIptvSlot(slotIndex);
  const slotEl = document.querySelector(`.iptv-slot[data-slot="${slotIndex}"]`);
  if (!slotEl) return;
  const playerContainer = slotEl.querySelector('.slot-player-instance');
  playerContainer.innerHTML = '';
  const video = document.createElement('video');
  video.id = `iptv-video-player-${slotIndex}`;
  Object.assign(video.style, { width: '100%', height: '100%', display: 'block', outline: 'none' });
  video.controls = video.autoplay = true;
  video.muted = true;
  playerContainer.appendChild(video);
  slotEl.classList.add('has-video');
  const titleEl = slotEl.querySelector('.slot-title');
  if (titleEl) titleEl.textContent = `Slot ${slotIndex + 1}: ${displayName}`;
  const muteBtn = slotEl.querySelector('.mute-btn');
  if (muteBtn) { muteBtn.innerHTML = '<i data-lucide="volume-x"></i>'; lucide.createIcons(); }

  const localDb = getLocalDb();
  const playerType = 'plyr';
  let hlsInstance = null;
  let playerInstance = null;

  const isHlsUrl = streamUrl.includes('.m3u8') || streamUrl.includes('m3u8') || streamUrl.includes('stream') || streamUrl.startsWith('http');
  if (isHlsUrl && typeof Hls !== 'undefined' && Hls.isSupported()) {
    hlsInstance = new Hls();
    hlsInstance.loadSource(streamUrl);
    hlsInstance.attachMedia(video);
  } else if (isHlsUrl && video.canPlayType('application/vnd.apple.mpegurl')) {
    video.src = streamUrl;
  } else {
    video.src = streamUrl;
  }

  if (typeof Plyr !== 'undefined') {
    playerInstance = new Plyr(video, { controls: ['play', 'mute', 'volume', 'fullscreen'], keyboard: { global: false, focused: false } });
  } else {
    playerInstance = video;
  }

  const playerRef = { player: playerInstance, hls: hlsInstance, type: playerType, videoElement: video, streamUrl, displayName };
  iptvPlayers[slotIndex] = playerRef;

  const getVid = () => playerRef.videoElement || document.getElementById(`iptv-video-player-${slotIndex}`);

  playerContainer.addEventListener('wheel', (e) => {
    e.preventDefault();
    const vid = getVid(); if (!vid) return;
    const newVol = Math.min(1, Math.max(0, (vid.volume || 0) + (e.deltaY < 0 ? 0.05 : -0.05)));
    vid.volume = newVol;
    if (vid.muted && newVol > 0) vid.muted = false;
    if (typeof triggerVolumeHUD === 'function') triggerVolumeHUD(newVol);
    const muteB = slotEl.querySelector('.mute-btn');
    if (muteB) { muteB.innerHTML = (vid.muted || newVol === 0) ? '<i data-lucide="volume-x"></i>' : '<i data-lucide="volume-2"></i>'; lucide.createIcons(); }
  }, { passive: false });

  slotEl.setAttribute('tabindex', '0');
  slotEl.addEventListener('keydown', (e) => {
    const el = document.activeElement;
    if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) return;
    const vid = getVid(); if (!vid) return;
    switch (e.key) {
      case ' ': case 'k': case 'K': e.preventDefault(); vid.paused ? vid.play().catch(() => {}) : vid.pause(); break;
      case 'm': case 'M': e.preventDefault(); vid.muted = !vid.muted; if (typeof triggerVolumeHUD === 'function') triggerVolumeHUD(vid.muted ? 0 : vid.volume); break;
      case 'f': case 'F': e.preventDefault(); !document.fullscreenElement ? slotEl.requestFullscreen().catch(() => {}) : document.exitFullscreen().catch(() => {}); break;
      case 'ArrowUp': e.preventDefault(); { const v = Math.min(1, (vid.volume || 0) + 0.05); vid.volume = v; if (vid.muted && v > 0) vid.muted = false; if (typeof triggerVolumeHUD === 'function') triggerVolumeHUD(v); } break;
      case 'ArrowDown': e.preventDefault(); { const v = Math.max(0, (vid.volume || 0) - 0.05); vid.volume = v; if (typeof triggerVolumeHUD === 'function') triggerVolumeHUD(v); } break;
    }
  });

  updateIptvPlayingStatus();
  if (!isRestoringIptv) saveIptvState();
}

function resetIptvSlotStyles(slotIdx = null) {
  const resetSlot = (idx) => {
    const s = document.querySelector(`.iptv-slot[data-slot="${idx}"]`);
    if (s) { s.classList.remove('is-dragging', 'is-resizing'); ['left','top','right','bottom','width','height','aspectRatio'].forEach(p => s.style[p] = ''); }
  };
  slotIdx !== null ? resetSlot(slotIdx) : [0,1,2,3].forEach(resetSlot);
}

function resizeAllArtplayers() {
  // ArtPlayer kaldırıldı — stub korundu (çağrı zinciri için)
}

function saveIptvState() {
  const slotsData = {};
  iptvPlayers.forEach((p, i) => { slotsData[i] = p ? { streamUrl: p.streamUrl, displayName: p.displayName } : null; });
  const gridEl = document.getElementById('iptv-players-grid');
  let layout = 'single-mode';
  if (gridEl) {
    if (gridEl.classList.contains('dual-mode')) layout = 'dual-mode';
    else if (gridEl.classList.contains('quad-mode')) layout = 'quad-mode';
    else if (gridEl.classList.contains('sport-mode')) layout = 'sport-mode';
  }
  localStorage.setItem('iptv_saved_state', JSON.stringify({ layout, slots: slotsData }));
}

function restoreIptvState() {
  const saved = localStorage.getItem('iptv_saved_state');
  if (!saved) return;
  try {
    resetIptvSlotStyles();
    isRestoringIptv = true;
    const state = JSON.parse(saved);
    const gridEl = document.getElementById('iptv-players-grid');
    const singleBtn = document.getElementById('iptv-single-view-btn');
    const dualBtn   = document.getElementById('iptv-dual-view-btn');
    const quadBtn   = document.getElementById('iptv-quad-view-btn');
    const sportBtn  = document.getElementById('iptv-sport-view-btn');
    if (gridEl) {
      gridEl.classList.remove('single-mode','dual-mode','quad-mode','sport-mode','swapped-mode');
      gridEl.classList.add(state.layout || 'single-mode');
      [singleBtn, dualBtn, quadBtn, sportBtn].forEach(b => b?.classList.remove('active'));
      if (state.layout === 'dual-mode') dualBtn?.classList.add('active');
      else if (state.layout === 'quad-mode') quadBtn?.classList.add('active');
      else if (state.layout === 'sport-mode') sportBtn?.classList.add('active');
      else singleBtn?.classList.add('active');
    }
    if (state.slots) {
      Object.keys(state.slots).forEach(k => {
        const ch = state.slots[k];
        if (ch?.streamUrl && ch?.displayName) playIptvChannel(parseInt(k, 10), ch.streamUrl, ch.displayName);
      });
    }
    if ((state.layout === 'dual-mode' || state.layout === 'sport-mode') && activeIptvSlot > 1) selectIptvSlot(0);
    else if (state.layout === 'single-mode' && activeIptvSlot !== 0) {
      let ps = 0;
      if (state.slots) { for (let i = 0; i < 4; i++) { if (state.slots[i]) { ps = i; break; } } }
      selectIptvSlot(ps);
    }
    isRestoringIptv = false;
    updateIptvSwapBtnVisibility();
    saveIptvState();
    resizeAllArtplayers();
  } catch (e) { isRestoringIptv = false; console.error('[IPTV] Durum geri yükleme hatası:', e); }
}

async function checkIptvStatus() {
  try { const res = await fetch('/api/iptv/status'); updateIptvStatusUI(await res.json()); }
  catch (err) { console.error('[IPTV] Durum sorgulama hatası:', err); }
}

function updateIptvStatusUI(status) {
  const si = document.getElementById('iptv-status-info');
  const ub = document.getElementById('iptv-update-btn');
  if (!si) return;
  const localDb = getLocalDb();
  const isEn = localDb.settings?.lang === 'en';
  if (status.status === 'updating') {
    si.textContent = isEn ? 'Updating channel list...' : 'Kanal listesi güncelleniyor...';
    if (ub) { ub.disabled = true; ub.querySelector('i')?.classList.add('spin-animation'); }
    startIptvStatusPolling();
  } else {
    if (ub) { ub.disabled = false; ub.querySelector('i')?.classList.remove('spin-animation'); }
    si.textContent = status.lastUpdated
      ? (isEn ? `Last Updated: ${new Date(status.lastUpdated).toLocaleString()} (${status.totalChannels} channels)` : `Son Güncelleme: ${new Date(status.lastUpdated).toLocaleString()} (${status.totalChannels} Kanal)`)
      : (isEn ? 'Not updated yet.' : 'Henüz güncellenmedi.');
  }
}

function startIptvStatusPolling() {
  if (iptvStatusInterval) return;
  iptvStatusInterval = setInterval(async () => {
    try {
      const data = await (await fetch('/api/iptv/status')).json();
      updateIptvStatusUI(data);
      if (data.status !== 'updating') { clearInterval(iptvStatusInterval); iptvStatusInterval = null; loadIptvChannels(); }
    } catch (e) { console.error('[IPTV] Polling hatası:', e); }
  }, 3000);
}

function updateSlotMuteIcon(slotIndex, isMuted) {
  const muteBtn = document.querySelector(`.iptv-slot[data-slot="${slotIndex}"] .mute-btn`);
  if (muteBtn) { muteBtn.innerHTML = isMuted ? '<i data-lucide="volume-x"></i>' : '<i data-lucide="volume-2"></i>'; if (window.lucide) lucide.createIcons(); }
}

function swapIptvSportModePlayers() {
  const gridEl = document.getElementById('iptv-players-grid');
  if (!gridEl?.classList.contains('sport-mode')) return;
  const [p0, p1] = [iptvPlayers[0], iptvPlayers[1]];
  const [url0, name0, url1, name1] = [p0?.streamUrl, p0?.displayName, p1?.streamUrl, p1?.displayName];
  if (url1 && name1) {
    playIptvChannel(0, url1, name1);
    const np0 = iptvPlayers[0];
    if (np0) { if (np0.videoElement) np0.videoElement.muted = false; if (np0.player) np0.player.muted = false; updateSlotMuteIcon(0, false); }
  } else { clearIptvSlot(0); }
  if (url0 && name0) {
    playIptvChannel(1, url0, name0);
    const np1 = iptvPlayers[1];
    if (np1) { if (np1.videoElement) np1.videoElement.muted = true; if (np1.player) np1.player.muted = true; updateSlotMuteIcon(1, true); }
  } else { clearIptvSlot(1); }
  saveIptvState();
  resizeAllArtplayers();
}

function updateIptvSwapBtnVisibility() {
  const gridEl = document.getElementById('iptv-players-grid');
  const swapBtn = document.getElementById('iptv-swap-btn');
  if (gridEl && swapBtn) swapBtn.classList.toggle('hidden', !gridEl.classList.contains('sport-mode'));
}

function initIptvSportModeDragAndResize() {
  const setup = (slotIndex) => {
    const slot = document.querySelector(`.iptv-slot[data-slot="${slotIndex}"]`);
    if (!slot) return;
    const header = slot.querySelector('.slot-header');
    const resizeHandle = slot.querySelector('.slot-resize-handle');
    if (!header || !resizeHandle) return;
    let isDragging = false, isResizing = false;
    let startX, startY, startLeft, startTop, startWidth;
    const gridEl = document.getElementById('iptv-players-grid');

    const startAction = (e, mode) => {
      if (!gridEl?.classList.contains('sport-mode') || slotIndex !== 1) return;
      if (mode === 'drag' && (e.target.closest('.slot-btn') || e.target.closest('button'))) return;
      e.preventDefault();
      if (mode === 'resize') e.stopPropagation();
      isDragging = mode === 'drag';
      isResizing = mode === 'resize';
      slot.classList.add(mode === 'drag' ? 'is-dragging' : 'is-resizing');
      const rect = slot.getBoundingClientRect();
      const parentRect = gridEl.getBoundingClientRect();
      Object.assign(slot.style, { right: 'auto', bottom: 'auto', left: `${rect.left - parentRect.left}px`, top: `${rect.top - parentRect.top}px`, aspectRatio: 'auto', height: `${rect.height}px`, width: `${rect.width}px` });
      startX = e.clientX; startY = e.clientY;
      startLeft = parseFloat(slot.style.left) || 0;
      startTop = parseFloat(slot.style.top) || 0;
      startWidth = rect.width;
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    };

    header.addEventListener('mousedown', (e) => startAction(e, 'drag'));
    resizeHandle.addEventListener('mousedown', (e) => startAction(e, 'resize'));

    function onMouseMove(e) {
      const parentRect = gridEl.getBoundingClientRect();
      if (isDragging) {
        const slotRect = slot.getBoundingClientRect();
        slot.style.left = `${Math.max(0, Math.min(startLeft + (e.clientX - startX), parentRect.width - slotRect.width))}px`;
        slot.style.top = `${Math.max(0, Math.min(startTop + (e.clientY - startY), parentRect.height - slotRect.height))}px`;
      } else if (isResizing) {
        let newW = Math.max(150, Math.min(startWidth + (e.clientX - startX), parentRect.width * 0.8));
        let newH = newW * (9 / 16);
        const curTop = parseFloat(slot.style.top) || 0;
        if (curTop + newH > parentRect.height) { newH = parentRect.height - curTop; newW = newH * (16 / 9); }
        slot.style.width = `${newW}px`;
        slot.style.height = `${newH}px`;
        resizeAllArtplayers();
      }
    }
    function onMouseUp() {
      isDragging = isResizing = false;
      slot.classList.remove('is-dragging', 'is-resizing');
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    }
  };
  setup(0);
  setup(1);
}

// ─── Window Küresel Köprüsü (Modüller arası ve HTML onclick uyumluluğu) ───
if (typeof window !== 'undefined') {
  window.initIptv = initIptv;
  window.loadIptvChannels = loadIptvChannels;
  window.checkIptvStatus = checkIptvStatus;
  window.restoreIptvState = restoreIptvState;
  window.stopAllIptvPlayers = stopAllIptvPlayers;
  window.stopAllIptvPlayersAndClear = stopAllIptvPlayersAndClear;
  window.clearIptvChannelList = clearIptvChannelList;
  window.getIptvPlayers = getIptvPlayers;
  window.selectIptvSlot = selectIptvSlot;
  window.toggleIptvMute = toggleIptvMute;
  window.clearIptvSlot = clearIptvSlot;
  window.playIptvChannel = playIptvChannel;
  window.resetIptvSlotStyles = resetIptvSlotStyles;
  window.resizeAllArtplayers = resizeAllArtplayers;
  window.saveIptvState = saveIptvState;
  window.swapIptvSportModePlayers = swapIptvSportModePlayers;
  window.updateIptvSwapBtnVisibility = updateIptvSwapBtnVisibility;
  window.initIptvSportModeDragAndResize = initIptvSportModeDragAndResize;
  window.updateLoadMoreBtn = updateLoadMoreBtn;
  window.renderIptvChannels = renderIptvChannels;
  window.activeIptvSlot = activeIptvSlot;
  window.getCountryFlag = getCountryFlag;
  window.getCountryName = getCountryName;
}

// Sayfa yüklendiğinde otomatik başlat
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => initIptv());
  } else {
    initIptv();
  }
}