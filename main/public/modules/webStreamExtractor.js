// Multimedia HaYTooL - Web Video & Dizi Akış Çözücü ve Yerleşik Oynatıcı Sekmesi
// Harici/yüzen pop-up pencere yerine, doğrudan uygulamanın kendi içinde yerleşik sekme (Tab) olarak oynatır.
// Özellikler: Bölüm Gezgini (Önceki/Sonraki), İndirme Kuyruğu Entegrasyonu, Kaldığı Yerden Devam Etme, Favoriler, Alternatif Kaynaklar ve Hızlı Site Gezgini.

(function () {
  const HISTORY_STORAGE_KEY = 'haytool_web_stream_history';
  const FAVORITES_STORAGE_KEY = 'haytool_web_stream_favorites';
  const PROGRESS_STORAGE_KEY = 'haytool_web_stream_progress_map';

  let activePlyrInstance = null;
  let activeHlsInstance = null;
  let activeCurrentStreamData = null;
  let activeSideTab = 'history'; // 'history' | 'favorites'
  let activeEmptyTab = 'history'; // 'history' | 'favorites'
  let lastProgressSaveTime = 0;

  function getTranslation(key, fallback) {
    if (typeof window.t === 'function') {
      const val = window.t(key);
      if (val && val !== key) return val;
    }
    return fallback;
  }

  function escapeHtml(text) {
    if (!text) return '';
    return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function getDomain(url) {
    try {
      const u = new URL(url);
      return u.hostname.replace(/^www\./, '');
    } catch {
      return 'web';
    }
  }

  function getOriginUrl(url) {
    try {
      const u = new URL(url);
      return `${u.protocol}//${u.host}`;
    } catch {
      return url || '';
    }
  }

  function formatTime(seconds) {
    if (!seconds || isNaN(seconds) || seconds < 0) return '0:00';
    const s = Math.floor(seconds);
    const m = Math.floor(s / 60);
    const h = Math.floor(m / 60);
    const remM = m % 60;
    const remS = s % 60;
    if (h > 0) {
      return `${h}:${remM < 10 ? '0' : ''}${remM}:${remS < 10 ? '0' : ''}${remS}`;
    }
    return `${remM}:${remS < 10 ? '0' : ''}${remS}`;
  }

  // --- STORAGE HELPERS ---
  function getRecentStreams() {
    try {
      return JSON.parse(localStorage.getItem(HISTORY_STORAGE_KEY) || '[]');
    } catch {
      return [];
    }
  }

  function getFavorites() {
    try {
      return JSON.parse(localStorage.getItem(FAVORITES_STORAGE_KEY) || '[]');
    } catch {
      return [];
    }
  }

  function isFavorite(url) {
    if (!url) return false;
    const favs = getFavorites();
    return favs.some(f => f.url === url);
  }

  function toggleFavoriteItem(item) {
    try {
      let favs = getFavorites();
      const idx = favs.findIndex(f => f.url === item.url);
      let favorited = false;
      if (idx >= 0) {
        favs.splice(idx, 1);
        favorited = false;
      } else {
        favs.unshift({
          url: item.url,
          title: item.title || item.url,
          domain: getDomain(item.url),
          date: new Date().toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' }),
          streamUrl: item.streamUrl || '',
          streamType: item.streamType || 'm3u8',
          embedUrl: item.embedUrl || null
        });
        favorited = true;
      }
      localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(favs));
      updateFavoriteButtonState();
      renderAllLists();
      return favorited;
    } catch {
      return false;
    }
  }

  function getProgressMap() {
    try {
      return JSON.parse(localStorage.getItem(PROGRESS_STORAGE_KEY) || '{}');
    } catch {
      return {};
    }
  }

  function getStreamProgress(url) {
    if (!url) return null;
    const map = getProgressMap();
    return map[url] || null;
  }

  function saveStreamProgress(url, currentTime, duration) {
    if (!url || !duration || duration <= 0) return;
    try {
      const map = getProgressMap();
      const percent = Math.min(100, Math.floor((currentTime / duration) * 100));
      map[url] = {
        currentTime: Math.floor(currentTime),
        duration: Math.floor(duration),
        percent,
        updatedAt: Date.now()
      };
      localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify(map));

      // Geçmiş listesindeki öğeyi de güncelle
      let history = getRecentStreams();
      const hItem = history.find(h => h.url === url);
      if (hItem) {
        hItem.currentTime = Math.floor(currentTime);
        hItem.duration = Math.floor(duration);
        hItem.percent = percent;
        localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(history));
      }
    } catch {}
  }

  function saveStreamToHistory(item) {
    try {
      let history = getRecentStreams();
      const existing = history.find(h => h.url === item.url);
      history = history.filter(h => h.url !== item.url);
      history.unshift({
        url: item.url,
        title: item.title || item.url,
        date: new Date().toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }),
        streamUrl: item.streamUrl || '',
        streamType: item.streamType || 'm3u8',
        embedUrl: item.embedUrl || null,
        currentTime: existing ? existing.currentTime : 0,
        duration: existing ? existing.duration : 0,
        percent: existing ? existing.percent : 0
      });
      if (history.length > 20) history = history.slice(0, 20);
      localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(history));
    } catch {}
  }

  // --- EPISODE NAVIGATION PARSER ---
  function detectEpisodeNavigation(url) {
    if (!url || typeof url !== 'string') return null;

    // Pattern 1: {prefix}(\d+)-sezon-(\d+)-bolum{suffix}
    const p1 = /(.*?)(?:^|[\/\-_])(\d+)[-_]sezon[-_](\d+)[-_]bolum(.*)/i;
    let match = url.match(p1);
    if (match) {
      const prefix = match[1];
      const season = parseInt(match[2], 10);
      const episode = parseInt(match[3], 10);
      const suffix = match[4];

      const prevUrl = episode > 1
        ? `${prefix}${season}-sezon-${episode - 1}-bolum${suffix}`
        : (season > 1 ? `${prefix}${season - 1}-sezon-1-bolum${suffix}` : null);
      const nextUrl = `${prefix}${season}-sezon-${episode + 1}-bolum${suffix}`;

      return {
        season,
        episode,
        currentLabel: `Sezon ${season} • Bölüm ${episode}`,
        prevUrl,
        prevLabel: episode > 1 ? `S${season}B${episode - 1}` : (season > 1 ? `S${season - 1}` : null),
        nextUrl,
        nextLabel: `S${season}B${episode + 1}`
      };
    }

    // Pattern 2: s01e04 or s1e4
    const p2 = /(.*?)(?:^|[\/\-_])s(\d+)[-_]?e(\d+)(.*)/i;
    match = url.match(p2);
    if (match) {
      const prefix = match[1];
      const season = parseInt(match[2], 10);
      const episode = parseInt(match[3], 10);
      const suffix = match[4];

      const prevUrl = episode > 1 ? `${prefix}s${season}e${episode - 1}${suffix}` : null;
      const nextUrl = `${prefix}s${season}e${episode + 1}${suffix}`;

      return {
        season,
        episode,
        currentLabel: `S${season} E${episode}`,
        prevUrl,
        prevLabel: episode > 1 ? `S${season}E${episode - 1}` : null,
        nextUrl,
        nextLabel: `S${season}E${episode + 1}`
      };
    }

    // Pattern 3: {prefix}(\d+)-bolum{suffix} or bolum-(\d+)
    const p3 = /(.*?)(?:^|[\/\-_])(?:bolum[-_]|ep[-_]|episode[-_])(\d+)(.*)/i;
    match = url.match(p3);
    if (match) {
      const prefix = match[1];
      const episode = parseInt(match[2], 10);
      const suffix = match[3];

      const prevUrl = episode > 1 ? `${prefix}bolum-${episode - 1}${suffix}` : null;
      const nextUrl = `${prefix}bolum-${episode + 1}${suffix}`;

      return {
        season: 1,
        episode,
        currentLabel: `Bölüm ${episode}`,
        prevUrl,
        prevLabel: episode > 1 ? `Bölüm ${episode - 1}` : null,
        nextUrl,
        nextLabel: `Bölüm ${episode + 1}`
      };
    }

    // Pattern 4: (\d+)-bolum
    const p4 = /(.*?)(?:^|[\/\-_])(\d+)[-_]bolum(.*)/i;
    match = url.match(p4);
    if (match) {
      const prefix = match[1];
      const episode = parseInt(match[2], 10);
      const suffix = match[3];

      const prevUrl = episode > 1 ? `${prefix}${episode - 1}-bolum${suffix}` : null;
      const nextUrl = `${prefix}${episode + 1}-bolum${suffix}`;

      return {
        season: 1,
        episode,
        currentLabel: `Bölüm ${episode}`,
        prevUrl,
        prevLabel: episode > 1 ? `Bölüm ${episode - 1}` : null,
        nextUrl,
        nextLabel: `Bölüm ${episode + 1}`
      };
    }

    return null;
  }

  function updateEpisodeNavigationUI(targetUrl) {
    const navContainer = document.getElementById('webstream-episode-nav');
    const prevBtn = document.getElementById('webstream-btn-prev-ep');
    const nextBtn = document.getElementById('webstream-btn-next-ep');
    const currentText = document.getElementById('webstream-current-ep-text');
    const prevText = document.getElementById('lbl-webstream-prev-ep');
    const nextText = document.getElementById('lbl-webstream-next-ep');

    if (!navContainer) return;

    const navData = detectEpisodeNavigation(targetUrl);
    if (!navData) {
      navContainer.style.display = 'none';
      return;
    }

    navContainer.style.display = 'flex';
    if (currentText) currentText.textContent = navData.currentLabel;

    if (prevBtn) {
      if (navData.prevUrl) {
        prevBtn.disabled = false;
        prevBtn.style.opacity = '1';
        if (prevText) prevText.textContent = `◀ ${navData.prevLabel || 'Önceki'}`;
        prevBtn.onclick = () => { window.playWebStreamUrl(encodeURIComponent(navData.prevUrl)); };
      } else {
        prevBtn.disabled = true;
        prevBtn.style.opacity = '0.4';
        if (prevText) prevText.textContent = 'İlk Bölüm';
        prevBtn.onclick = null;
      }
    }

    if (nextBtn) {
      if (navData.nextUrl) {
        nextBtn.disabled = false;
        nextBtn.style.opacity = '1';
        if (nextText) nextText.textContent = `${navData.nextLabel || 'Sonraki'} ▶`;
        nextBtn.onclick = () => { window.playWebStreamUrl(encodeURIComponent(navData.nextUrl)); };
      } else {
        nextBtn.disabled = true;
        nextBtn.style.opacity = '0.4';
        nextBtn.onclick = null;
      }
    }

    if (typeof lucide !== 'undefined') lucide.createIcons();
  }

  // --- MULTI-SOURCE SWITCHER UI ---
  function updateMultiSourceUI(streamData) {
    const topBar = document.getElementById('webstream-top-sources-bar');
    const topChips = document.getElementById('webstream-top-sources-chips');
    const topCount = document.getElementById('webstream-top-sources-count');

    const streams = streamData.allStreams || [];
    if (streams.length <= 1) {
      if (topBar) topBar.style.display = 'none';
      return;
    }

    if (topBar) topBar.style.display = 'flex';
    if (topCount) {
      const baseLabel = getTranslation('webstream_found_sources', 'Bulunan Videolar / Kaynaklar');
      topCount.textContent = `${baseLabel} (${streams.length} Kaynak)`;
    }

    // Üst belirgin seçim barı (Büyük butonlar)
    if (topChips) {
      topChips.innerHTML = streams.map((s, idx) => {
        const isActive = (s.url === streamData.streamUrl);
        const isM3u8 = (s.type === 'm3u8' || s.url.includes('.m3u8') || s.url.includes('master.txt') || s.url.includes('/m/') || s.url.includes('workers.dev'));
        const isEmbed = (s.type === 'embed');
        const isTrailer = !!s.isTrailer;
        const badgeColor = isTrailer ? '#f59e0b' : (isM3u8 ? '#ef4444' : (isEmbed ? '#a855f7' : '#22c55e'));
        const iconName = isTrailer ? 'film' : (isEmbed ? 'tv' : 'play');

        return `
          <button type="button" class="btn ${isActive ? 'btn-primary' : 'btn-secondary'} btn-sm" onclick="window.switchWebStreamSource(${idx})" title="${escapeHtml(s.label || `Kaynak ${idx + 1}`)}" style="padding: 6px 13px; font-size: 0.80rem; border-radius: 8px; display: inline-flex; align-items: center; gap: 7px; ${isActive ? 'background: linear-gradient(135deg, #ef4444, #dc2626); color: #fff; font-weight: 700; box-shadow: 0 2px 10px rgba(239,68,68,0.4);' : 'background: rgba(255, 255, 255, 0.06); border: 1px solid var(--border-color); color: var(--text-color);'}">
            <span style="width: 8px; height: 8px; border-radius: 50%; background: ${badgeColor}; flex-shrink: 0;"></span>
            <i data-lucide="${iconName}" style="width: 14px; height: 14px;"></i>
            <span>${escapeHtml(s.label || `Video ${idx + 1}`)}</span>
          </button>
        `;
      }).join('');
    }

    if (typeof lucide !== 'undefined') lucide.createIcons();
  }

  window.switchWebStreamSource = function (index) {
    if (!activeCurrentStreamData || !activeCurrentStreamData.allStreams) return;
    const targetSource = activeCurrentStreamData.allStreams[index];
    if (!targetSource) return;

    // Mevcut saniyeyi saklayıp yeni akışa aktarmayı dene
    let currentPos = 0;
    if (activePlyrInstance) {
      currentPos = activePlyrInstance.currentTime || 0;
    }

    activeCurrentStreamData.streamUrl = targetSource.url;
    activeCurrentStreamData.streamType = targetSource.type;
    activeCurrentStreamData.streamReferer = targetSource.referer || activeCurrentStreamData.referer;
    if (targetSource.type === 'embed') {
      activeCurrentStreamData.embedUrl = targetSource.url;
    } else {
      activeCurrentStreamData.embedUrl = null;
    }

    mountStreamPlayer(activeCurrentStreamData, currentPos);
    updateMultiSourceUI(activeCurrentStreamData);

    const badgeEl = document.getElementById('webstream-meta-badge');
    if (badgeEl) badgeEl.textContent = (targetSource.type || 'm3u8').toUpperCase();

    if (typeof window.showToast === 'function') {
      window.showToast(`Kaynak değiştirildi: ${targetSource.label}`, 'info');
    }
  };

  // --- AUDIO TRACK SELECTOR (DUBLAJ / ORİJİNAL SES) ---
  function renderAudioTrackSelector(hls) {
    const bar = document.getElementById('webstream-audio-tracks-bar');
    const chips = document.getElementById('webstream-audio-tracks-chips');
    if (!bar || !chips) return;

    const tracks = (hls && hls.audioTracks) ? hls.audioTracks : [];
    if (!tracks || tracks.length <= 1) {
      bar.style.display = 'none';
      return;
    }

    bar.style.display = 'flex';
    const currentTrackId = hls.audioTrack;

    chips.innerHTML = tracks.map((t, idx) => {
      const isActive = (t.id === currentTrackId || idx === currentTrackId);
      let label = t.name || `Ses ${idx + 1}`;
      const lower = label.toLowerCase();
      let flag = '🔊';
      if (lower.includes('turkish') || lower.includes('türkçe') || t.lang === 'tr') {
        label = getTranslation('webstream_audio_dub', '🇹🇷 Türkçe Dublaj');
        flag = '';
      } else if (lower.includes('original') || lower.includes('orijinal') || t.lang === 'en') {
        label = getTranslation('webstream_audio_orig', '🌐 Orijinal Dil');
        flag = '';
      }

      return `
        <button type="button" class="btn btn-sm" onclick="window.switchWebStreamAudioTrack(${idx})" style="padding: 4px 11px; font-size: 0.74rem; border-radius: 6px; display: inline-flex; align-items: center; gap: 5px; cursor: pointer; transition: all 0.2s; ${isActive ? 'background: rgba(59, 130, 246, 0.25); border: 1px solid #3b82f6; color: #fff; font-weight: 700;' : 'background: rgba(255, 255, 255, 0.05); border: 1px solid var(--border-color); color: var(--text-muted);'}">
          <span>${flag ? flag + ' ' : ''}${escapeHtml(label)}</span>
        </button>
      `;
    }).join('');

    if (typeof lucide !== 'undefined') lucide.createIcons();
  }

  window.switchWebStreamAudioTrack = function(trackIndex) {
    if (activeHlsInstance && activeHlsInstance.audioTracks) {
      activeHlsInstance.audioTrack = trackIndex;
      renderAudioTrackSelector(activeHlsInstance);
      const track = activeHlsInstance.audioTracks[trackIndex];
      const trackName = track?.name || `Ses ${trackIndex + 1}`;
      if (typeof window.showToast === 'function') {
        window.showToast(`${getTranslation('webstream_audio_lang', 'Ses / Dil')}: ${trackName}`, 'info');
      }
    }
  };

  // --- QUICK SOURCE SITES UI ---
  function renderQuickSitesBar() {
    const bar = document.getElementById('webstream-quick-sites-bar');
    const chips = document.getElementById('webstream-quick-sites-chips');
    if (!chips) return;

    // Popüler siteler ve geçmişteki benzersiz domainler (vidmoly harici video barındırıcı olduğundan kaynak siteler barından çıkarıldı)
    const defaultSites = [
      { name: 'Dizipal', url: 'https://dizipal3009.com' },
      { name: 'FullHDFilmizlesene', url: 'https://www.fullhdfilmizlesene.now' },
      { name: 'Jetfilmizle', url: 'https://jetfilmizle.app' },
      { name: 'HDFilmcehennemi', url: 'https://www.hdfilmcehennemi.nl' },
      { name: 'Filmmakinesi', url: 'https://filmmakinesi.to' }
    ];

    const history = getRecentStreams();
    const favs = getFavorites();
    const allItems = [...favs, ...history];

    const discoveredOrigins = new Map();
    defaultSites.forEach(s => discoveredOrigins.set(getDomain(s.url), s.url));

    allItems.forEach(item => {
      if (item.url && item.url.startsWith('http')) {
        const dom = getDomain(item.url);
        const origin = getOriginUrl(item.url);
        // Vidmoly, filemoon veya localhost gibi siteleri hızlı gezinme barına ekleme
        if (!discoveredOrigins.has(dom) && dom !== 'web' && !dom.includes('localhost') && !dom.includes('127.0.0.1') && !dom.includes('vidmoly') && !dom.includes('filemoon')) {
          discoveredOrigins.set(dom, origin);
        }
      }
    });

    const entries = Array.from(discoveredOrigins.entries()).slice(0, 12);
    if (entries.length === 0) {
      if (bar) bar.style.display = 'none';
      return;
    }

    if (bar) bar.style.display = 'flex';
    chips.innerHTML = entries.map(([domain, fullUrl]) => `
      <button type="button" class="btn btn-secondary btn-sm" onclick="window.openWebStreamSite('${encodeURIComponent(fullUrl)}')" title="${escapeHtml(domain)} anasayfasını dahili gezginde aç" style="padding: 3px 8px; font-size: 0.72rem; display: inline-flex; align-items: center; gap: 4px; border-radius: 6px; background: rgba(255,255,255,0.03);">
        <i data-lucide="globe" style="width: 11px; height: 11px; color: var(--accent-primary);"></i>
        <span>${escapeHtml(domain)}</span>
      </button>
    `).join('');

    if (typeof lucide !== 'undefined') lucide.createIcons();
  }

  let currentBrowsingUrl = '';

  window.openWebStreamSite = function (encodedUrl) {
    const url = decodeURIComponent(encodedUrl);
    if (!url) return;

    currentBrowsingUrl = url;
    const browserCard = document.getElementById('webstream-browser-card');
    const urlInput = document.getElementById('webstream-browser-url-input');
    const siteIframe = document.getElementById('webstream-site-iframe');
    const titleSpan = document.getElementById('webstream-browser-title');

    if (browserCard && siteIframe) {
      if (titleSpan) titleSpan.textContent = getDomain(url);
      if (urlInput) urlInput.value = url;
      // Doğrudan açmak yerine gezinme proxy'si üzerinden yükle (target="_blank" dışarı fırlamasını önler ve URL değişimlerini yakalar)
      siteIframe.src = `/api/tools/webstream-browse-proxy?url=${encodeURIComponent(url)}`;
      browserCard.style.display = 'block';
      browserCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } else {
      window.open(url, '_blank');
    }
  };

  function setupEmbeddedSiteBrowser() {
    const browserCard = document.getElementById('webstream-browser-card');
    const urlInput = document.getElementById('webstream-browser-url-input');
    const siteIframe = document.getElementById('webstream-site-iframe');
    const captureBtn = document.getElementById('webstream-browser-capture-btn');
    const openExtBtn = document.getElementById('webstream-browser-open-ext-btn');
    const closeBtn = document.getElementById('webstream-browser-close-btn');

    // İframe içindeki script'ten gelen gezinme mesajlarını dinle (URL barını ve ana giriş kutusunu canlı güncelle)
    window.addEventListener('message', async (event) => {
      if (event.data && event.data.type === 'HAYTOOL_BROWSE_NAVIGATED' && event.data.url) {
        let navUrl = event.data.url;
        // Eğer proxy URL'si ise içindeki asıl url parametresini al
        if (navUrl.includes('webstream-browse-proxy?url=')) {
          try {
            const uObj = new URL(navUrl, window.location.origin);
            navUrl = uObj.searchParams.get('url') || navUrl;
          } catch(e) {}
        }
        currentBrowsingUrl = navUrl;
        if (urlInput) {
          urlInput.value = navUrl;
        }
        // Ana URL giriş kutusunu da otomatik doldur
        const mainInput = document.getElementById('webstream-tab-input');
        if (mainInput) {
          mainInput.value = navUrl;
        }
        const titleSpan = document.getElementById('webstream-browser-title');
        if (titleSpan) {
          titleSpan.textContent = getDomain(navUrl);
        }

        // İçerik sayfasına (film/dizi/bölüm) geçildiğinde kullanıcıya butonun hazır olduğunu hissettir
        const btnPlay = document.getElementById('webstream-tab-play-btn');
        if (btnPlay) {
          btnPlay.style.transform = 'scale(1.05)';
          btnPlay.style.transition = 'transform 0.2s';
          setTimeout(() => { btnPlay.style.transform = ''; }, 400);
        }
      }

      // Iframe içindeki Cloudflare bilgi kartından gelen dış tarayıcıda açma talebi
      if (event.data && event.data.type === 'HAYTOOL_OPEN_BROWSER' && event.data.url) {
        try {
          await fetch('/api/open-url', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: event.data.url })
          });
        } catch {
          window.open(event.data.url, '_blank');
        }
      }
    });

    if (closeBtn) {
      closeBtn.onclick = () => {
        if (browserCard) browserCard.style.display = 'none';
        if (siteIframe) siteIframe.src = 'about:blank';
      };
    }

    if (openExtBtn) {
      openExtBtn.onclick = async () => {
        const target = (urlInput?.value || currentBrowsingUrl).trim();
        if (!target) return;
        try {
          await fetch('/api/open-url', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: target })
          });
        } catch {
          window.open(target, '_blank');
        }
      };
    }
  }

  // --- KAYNAK SİTELERDE ARAMA SİSTEMİ ---
  async function performWebStreamSearch() {
    const searchInp = document.getElementById('webstream-search-input');
    const sourceSelect = document.getElementById('webstream-search-source-select');
    const btnSearch = document.getElementById('webstream-search-btn');
    const btnClear = document.getElementById('webstream-search-clear-btn');
    const statsLbl = document.getElementById('webstream-search-stats');
    const container = document.getElementById('webstream-search-results-container');
    const grid = document.getElementById('webstream-search-grid');
    const btnText = document.getElementById('lbl-webstream-search-btn');

    if (!searchInp || !grid) return;
    const query = searchInp.value.trim();
    if (!query || query.length < 2) {
      if (typeof window.showToast === 'function') {
        window.showToast(getTranslation('webstream_search_placeholder', 'Lütfen aramak için en az 2 karakter girin.'), 'warning');
      }
      return;
    }

    const source = sourceSelect ? sourceSelect.value : 'all';

    // Loading durumu
    if (btnSearch) btnSearch.disabled = true;
    if (btnText) btnText.textContent = getTranslation('webstream_search_searching', 'Aranıyor...');
    if (btnClear) btnClear.style.display = 'inline-flex';
    if (container) container.style.display = 'block';
    if (statsLbl) {
      statsLbl.style.display = 'inline-block';
      statsLbl.textContent = getTranslation('webstream_search_searching', 'Aranıyor...');
    }

    grid.innerHTML = `
      <div style="grid-column: 1 / -1; padding: 30px; text-align: center; color: var(--text-muted);">
        <i data-lucide="loader" class="spin" style="width: 28px; height: 28px; margin: 0 auto 10px; display: block; color: var(--accent-primary);"></i>
        <span>"${escapeHtml(query)}" için kaynaklar taranıyor...</span>
      </div>
    `;
    if (typeof lucide !== 'undefined') lucide.createIcons();

    try {
      const res = await fetch('/api/tools/webstream-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, source })
      });
      const data = await res.json();

      if (!data.success || !Array.isArray(data.results) || data.results.length === 0) {
        if (statsLbl) statsLbl.textContent = getTranslation('webstream_search_no_results', 'Sonuç bulunamadı.');
        grid.innerHTML = `
          <div style="grid-column: 1 / -1; padding: 30px; text-align: center; color: var(--text-muted);">
            <i data-lucide="search-x" style="width: 32px; height: 32px; margin: 0 auto 10px; display: block; opacity: 0.5;"></i>
            <span>${getTranslation('webstream_search_no_results', 'Sonuç bulunamadı.')}</span>
          </div>
        `;
        if (typeof lucide !== 'undefined') lucide.createIcons();
        return;
      }

      if (statsLbl) {
        statsLbl.textContent = `${data.results.length} içerik bulundu`;
      }

      grid.innerHTML = data.results.map((item) => {
        const safeTitle = escapeHtml(item.title || 'Video');
        const safeYear = escapeHtml(item.year || '');
        const safeSource = escapeHtml(item.source || 'Web');
        const safePoster = item.poster ? escapeHtml(item.poster) : '';
        const safeType = item.type === 'dizi' ? 'Dizi' : 'Film';
        const typeBadgeColor = item.type === 'dizi' ? 'rgba(59, 130, 246, 0.2)' : 'rgba(239, 68, 68, 0.2)';
        const typeTextColor = item.type === 'dizi' ? '#60a5fa' : '#f87171';

        const posterHtml = safePoster ? `
          <img src="${safePoster}" alt="${safeTitle}" loading="lazy" style="width: 100%; height: 220px; object-fit: cover; display: block; transition: transform 0.3s;" onerror="this.onerror=null; this.parentElement.innerHTML='<div style=\\'width:100%;height:220px;display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,0.03);color:var(--text-muted);\\'>🎬</div>';">
        ` : `
          <div style="width: 100%; height: 220px; display: flex; flex-direction: column; align-items: center; justify-content: center; background: rgba(255,255,255,0.03); color: var(--text-muted); gap: 6px;">
            <i data-lucide="film" style="width: 32px; height: 32px; opacity: 0.4;"></i>
            <span style="font-size: 0.72rem; opacity: 0.6;">Afiş Yok</span>
          </div>
        `;

        return `
          <div class="webstream-search-card-item card" onclick="window.playSearchResult('${encodeURIComponent(item.url)}')" style="display: flex; flex-direction: column; border-radius: 10px; overflow: hidden; background: var(--bg-card, #18181b); border: 1px solid var(--border-color); cursor: pointer; transition: transform 0.2s, box-shadow 0.2s, border-color 0.2s; position: relative;" onmouseenter="this.style.transform='translateY(-4px)'; this.style.borderColor='var(--accent-primary)';" onmouseleave="this.style.transform='none'; this.style.borderColor='var(--border-color)';">
            <div style="position: relative; overflow: hidden; background: #000;">
              ${posterHtml}
              <div style="position: absolute; top: 6px; left: 6px; display: flex; gap: 4px; flex-wrap: wrap;">
                <span style="padding: 2px 6px; font-size: 0.68rem; font-weight: 700; border-radius: 4px; background: rgba(0,0,0,0.75); color: #fff; border: 1px solid rgba(255,255,255,0.15); backdrop-filter: blur(4px);">${safeSource}</span>
                <span style="padding: 2px 6px; font-size: 0.68rem; font-weight: 600; border-radius: 4px; background: ${typeBadgeColor}; color: ${typeTextColor}; border: 1px solid ${typeTextColor}33;">${safeType}</span>
              </div>
              ${safeYear ? `<span style="position: absolute; bottom: 6px; right: 6px; padding: 2px 6px; font-size: 0.68rem; font-weight: 700; border-radius: 4px; background: rgba(0,0,0,0.8); color: #fbbf24;">${safeYear}</span>` : ''}
            </div>
            <div style="padding: 8px 10px 10px; display: flex; flex-direction: column; flex: 1; justify-content: space-between; gap: 6px;">
              <h4 style="margin: 0; font-size: 0.80rem; font-weight: 600; line-height: 1.3; color: var(--text-color); display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;" title="${safeTitle}">${safeTitle}</h4>
              <button type="button" class="btn btn-primary btn-sm" style="width: 100%; padding: 4px 8px; font-size: 0.74rem; font-weight: 600; display: inline-flex; align-items: center; justify-content: center; gap: 5px; margin-top: 4px;">
                <i data-lucide="play" style="width: 12px; height: 12px;"></i>
                <span>${getTranslation('webstream_search_play_now', 'Oynat & İzle')}</span>
              </button>
            </div>
          </div>
        `;
      }).join('');

      if (typeof lucide !== 'undefined') lucide.createIcons();

    } catch (err) {
      if (statsLbl) statsLbl.textContent = 'Arama hatası';
      grid.innerHTML = `
        <div style="grid-column: 1 / -1; padding: 20px; text-align: center; color: #ef4444;">
          <p style="margin: 0; font-size: 0.84rem;">Arama sırasında hata oluştu: ${escapeHtml(err.message)}</p>
        </div>
      `;
    } finally {
      if (btnSearch) btnSearch.disabled = false;
      if (btnText) btnText.textContent = getTranslation('webstream_search_btn', 'Ara');
    }
  }

  window.playSearchResult = function(encodedUrl) {
    const url = decodeURIComponent(encodedUrl);
    if (!url) return;
    const inp = document.getElementById('webstream-tab-input');
    if (inp) {
      inp.value = url;
    }
    // Oynatmayı doğrudan başlat
    startStreamExtraction(url);
    // Player alanına yumuşak kaydır
    const playerView = document.getElementById('webstream-view-player');
    if (playerView) {
      setTimeout(() => {
        playerView.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 300);
    }
  };

  function clearWebStreamSearch() {
    const searchInp = document.getElementById('webstream-search-input');
    const btnClear = document.getElementById('webstream-search-clear-btn');
    const statsLbl = document.getElementById('webstream-search-stats');
    const container = document.getElementById('webstream-search-results-container');
    const grid = document.getElementById('webstream-search-grid');
    if (searchInp) searchInp.value = '';
    if (btnClear) btnClear.style.display = 'none';
    if (statsLbl) statsLbl.style.display = 'none';
    if (grid) grid.innerHTML = '';
    if (container) container.style.display = 'none';
  }

  // --- FAVORITE BUTTON STATE ---
  function updateFavoriteButtonState() {
    const btnFav = document.getElementById('webstream-btn-favorite');
    const favIcon = document.getElementById('webstream-fav-icon');
    const favText = document.getElementById('lbl-webstream-fav');
    if (!btnFav || !activeCurrentStreamData) return;

    const currentUrl = activeCurrentStreamData.sourceUrl || activeCurrentStreamData.url;
    const isFav = isFavorite(currentUrl);

    if (isFav) {
      btnFav.style.background = 'rgba(234, 179, 8, 0.15)';
      btnFav.style.borderColor = 'rgba(234, 179, 8, 0.4)';
      btnFav.style.color = '#eab308';
      if (favIcon) favIcon.style.fill = '#eab308';
      if (favText) favText.textContent = getTranslation('webstream_favorite', 'Favori') + ' ★';
    } else {
      btnFav.style.background = '';
      btnFav.style.borderColor = '';
      btnFav.style.color = '';
      if (favIcon) favIcon.style.fill = 'none';
      if (favText) favText.textContent = getTranslation('webstream_favorite', 'Favori');
    }
  }

  // --- DOWNLOAD STREAM INTEGRATION ---
  window.downloadCurrentStream = async function () {
    if (!activeCurrentStreamData) return;
    let targetUrl = activeCurrentStreamData.directStreamUrl;
    if (!targetUrl || (!targetUrl.includes('.m3u8') && !targetUrl.includes('.mp4'))) {
      const foundStream = (activeCurrentStreamData.allStreams || []).find(s => s.type === 'm3u8' || s.type === 'mp4' || s.url?.includes('.m3u8') || s.url?.includes('.mp4'));
      if (foundStream) targetUrl = foundStream.url;
    }
    if (!targetUrl) targetUrl = activeCurrentStreamData.streamUrl || activeCurrentStreamData.sourceUrl;
    const title = activeCurrentStreamData.title || 'Web Video';
    const referer = activeCurrentStreamData.streamReferer || activeCurrentStreamData.referer || activeCurrentStreamData.embedUrl || activeCurrentStreamData.sourceUrl || targetUrl;

    if (!targetUrl) return;

    try {
      if (typeof window.showToast === 'function') {
        window.showToast(`İndirme sırasına ekleniyor: ${title}`, 'info');
      }

      const res = await fetch('/api/downloader/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: targetUrl,
          webUrl: activeCurrentStreamData.sourceUrl || targetUrl,
          referer: referer,
          title: title,
          platform: 'webstream',
          format: 'video-best'
        })
      });

      const data = await res.json();
      if (data.success) {
        if (typeof window.showToast === 'function') {
          window.showToast('İndirme kuyruğuna eklendi! İndirilenler sekmesinden takip edebilirsiniz.', 'success');
        }
      } else {
        if (typeof window.showToast === 'function') {
          window.showToast(data.error || 'İndirme kuyruğuna eklenemedi.', 'error');
        }
      }
    } catch (err) {
      if (typeof window.showToast === 'function') {
        window.showToast(`İndirme isteği hatası: ${err.message}`, 'error');
      }
    }
  };

  // --- STATUS & TOAST ---
  function showStatus(msg, type = 'info') {
    const statusBox = document.getElementById('webstream-tab-status');
    if (!statusBox) return;

    statusBox.style.display = 'block';
    if (type === 'error') {
      statusBox.style.background = 'rgba(239, 68, 68, 0.12)';
      statusBox.style.border = '1px solid rgba(239, 68, 68, 0.3)';
      statusBox.style.color = '#fca5a5';
      statusBox.innerHTML = `<div style="display:flex;align-items:center;gap:8px;"><i data-lucide="alert-circle" style="width:16px;height:16px;color:#ef4444;"></i><span>${escapeHtml(msg)}</span></div>`;
    } else if (type === 'warning') {
      statusBox.style.background = 'rgba(245, 158, 11, 0.12)';
      statusBox.style.border = '1px solid rgba(245, 158, 11, 0.3)';
      statusBox.style.color = '#fde68a';
      statusBox.innerHTML = `<div style="display:flex;align-items:center;gap:8px;"><i data-lucide="alert-triangle" style="width:16px;height:16px;color:#f59e0b;"></i><span>${escapeHtml(msg)}</span></div>`;
    } else {
      statusBox.style.background = 'rgba(168, 85, 247, 0.12)';
      statusBox.style.border = '1px solid rgba(168, 85, 247, 0.3)';
      statusBox.style.color = '#d8b4fe';
      statusBox.innerHTML = `<div style="display:flex;align-items:center;gap:8px;"><i data-lucide="info" style="width:16px;height:16px;color:#a855f7;"></i><span>${escapeHtml(msg)}</span></div>`;
    }

    if (typeof lucide !== 'undefined') lucide.createIcons();
  }

  function hideStatus() {
    const statusBox = document.getElementById('webstream-tab-status');
    if (statusBox) statusBox.style.display = 'none';
  }

  // --- RENDER LISTS (HISTORY & FAVORITES) ---
  function renderAllLists() {
    renderQuickSitesBar();

    const history = getRecentStreams();
    const favs = getFavorites();

    // Badgeleri güncelle
    const sideFavBadge = document.getElementById('webstream-fav-badge');
    const emptyFavBadge = document.getElementById('webstream-empty-fav-badge');
    if (sideFavBadge) sideFavBadge.textContent = favs.length;
    if (emptyFavBadge) emptyFavBadge.textContent = favs.length;

    // 1. Sidebar Listesi
    const sidebarListEl = document.getElementById('webstream-sidebar-list');
    const sidebarSectionTitle = document.getElementById('webstream-sidebar-section-title');
    const isSideFav = (activeSideTab === 'favorites');

    if (sidebarSectionTitle) {
      sidebarSectionTitle.textContent = isSideFav ? getTranslation('webstream_favorites', 'Favorilerim') : getTranslation('webstream_history', 'Son İzlenenler');
    }

    if (sidebarListEl) {
      const targetItems = isSideFav ? favs : history;
      if (targetItems.length === 0) {
        sidebarListEl.innerHTML = `<div style="color: var(--text-muted); font-size: 0.78rem; text-align: center; padding: 16px; border: 1px dashed var(--border-color); border-radius: 8px;">${isSideFav ? 'Henüz favori eklenmedi.' : 'Geçmiş boş.'}</div>`;
      } else {
        sidebarListEl.innerHTML = targetItems.map(item => {
          const progress = getStreamProgress(item.url) || item;
          const hasProg = progress && progress.percent > 0;
          const progWidth = hasProg ? Math.min(100, Math.max(2, progress.percent)) : 0;
          const timeText = hasProg ? `${formatTime(progress.currentTime)} / ${formatTime(progress.duration)}` : '';
          const originUrl = getOriginUrl(item.url);

          return `
            <div style="display: flex; flex-direction: column; gap: 4px; padding: 8px 10px; background: rgba(255,255,255,0.02); border: 1px solid var(--border-color); border-radius: 8px; transition: background 0.15s;">
              <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px;">
                <div style="flex: 1; overflow: hidden; cursor: pointer;" onclick="window.playWebStreamUrl('${encodeURIComponent(item.url)}')">
                  <div style="font-weight: 600; font-size: 0.82rem; color: var(--text-color); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${escapeHtml(item.title)}">${escapeHtml(item.title)}</div>
                  <div style="font-size: 0.70rem; color: var(--text-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin-top: 1px;">
                    <span style="color:#ef4444; font-weight:600;">${escapeHtml(getDomain(item.url))}</span>
                    ${item.date ? ` • ${item.date}` : ''}
                  </div>
                </div>
                <div style="display: flex; align-items: center; gap: 4px; flex-shrink: 0;">
                  <button type="button" class="btn btn-secondary btn-sm" onclick="window.openWebStreamSite('${encodeURIComponent(originUrl)}')" title="Kaynak Siteyi Aç" style="padding: 4px 6px; font-size: 0.70rem;">
                    <i data-lucide="globe" style="width: 12px; height: 12px;"></i>
                  </button>
                  <button type="button" class="btn btn-secondary btn-sm" onclick="window.playWebStreamUrl('${encodeURIComponent(item.url)}')" title="İzle" style="padding: 4px 8px; font-size: 0.72rem;">
                    <i data-lucide="play" style="width: 12px; height: 12px;"></i>
                  </button>
                  ${isSideFav ? `
                    <button type="button" class="btn btn-secondary btn-sm" onclick="window.deleteWebStreamFavorite('${encodeURIComponent(item.url)}')" title="Favorilerden Çıkar" style="padding: 4px 6px; color: #eab308;">
                      <i data-lucide="star" style="width: 12px; height: 12px; fill: #eab308;"></i>
                    </button>
                  ` : `
                    <button type="button" class="btn btn-secondary btn-sm" onclick="window.deleteWebStreamHistoryItem('${encodeURIComponent(item.url)}')" title="Sil" style="padding: 4px 6px; color: var(--text-muted);">
                      <i data-lucide="trash-2" style="width: 12px; height: 12px;"></i>
                    </button>
                  `}
                </div>
              </div>
              ${hasProg ? `
                <div style="display: flex; align-items: center; gap: 6px; margin-top: 2px;">
                  <div style="flex: 1; height: 3px; background: rgba(255,255,255,0.08); border-radius: 2px; overflow: hidden;">
                    <div style="height: 100%; width: ${progWidth}%; background: linear-gradient(90deg, #ef4444, #f97316); border-radius: 2px;"></div>
                  </div>
                  <span style="font-size: 0.65rem; color: var(--text-muted);">${timeText} (%${progress.percent})</span>
                </div>
              ` : ''}
            </div>
          `;
        }).join('');
      }
    }

    // 2. Empty View Geniş Liste
    const emptyListEl = document.getElementById('webstream-empty-list');
    const isEmpFav = (activeEmptyTab === 'favorites');

    if (emptyListEl) {
      const targetItems = isEmpFav ? favs : history;
      if (targetItems.length === 0) {
        emptyListEl.innerHTML = `<div style="color: var(--text-muted); font-size: 0.84rem; text-align: center; padding: 24px; border: 1px dashed var(--border-color); border-radius: 10px;">${isEmpFav ? 'Henüz favori video veya dizi eklemediniz. Video izlerken ⭐ Favori butonuna basarak ekleyebilirsiniz.' : 'Henüz izlenen web videosu yok. Yukarıdan bir bağlantı yapıştırıp başlatabilirsiniz.'}</div>`;
      } else {
        emptyListEl.innerHTML = targetItems.map(item => {
          const progress = getStreamProgress(item.url) || item;
          const hasProg = progress && progress.percent > 0;
          const progWidth = hasProg ? Math.min(100, Math.max(2, progress.percent)) : 0;
          const timeText = hasProg ? `${formatTime(progress.currentTime)} / ${formatTime(progress.duration)}` : '';
          const originUrl = getOriginUrl(item.url);

          return `
            <div style="display: flex; flex-direction: column; gap: 6px; padding: 10px 14px; background: rgba(255,255,255,0.03); border: 1px solid var(--border-color); border-radius: 10px; transition: background 0.15s;">
              <div style="display: flex; align-items: center; justify-content: space-between; gap: 10px;">
                <div style="flex: 1; overflow: hidden; cursor: pointer;" onclick="window.playWebStreamUrl('${encodeURIComponent(item.url)}')">
                  <div style="font-weight: 600; font-size: 0.88rem; color: var(--text-color); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(item.title)}</div>
                  <div style="font-size: 0.74rem; color: var(--text-muted); display: flex; align-items: center; gap: 6px; margin-top: 2px;">
                    <span style="color: #ef4444; font-weight: 600;">${escapeHtml(getDomain(item.url))}</span>
                    ${item.date ? `<span>•</span><span>${escapeHtml(item.date)}</span>` : ''}
                    <span>•</span>
                    <span style="text-transform: uppercase;">${escapeHtml(item.streamType || 'M3U8')}</span>
                  </div>
                </div>
                <div style="display: flex; align-items: center; gap: 6px;">
                  <button type="button" class="btn btn-secondary btn-sm" onclick="window.openWebStreamSite('${encodeURIComponent(originUrl)}')" title="Kaynak Siteyi Aç (${escapeHtml(getDomain(item.url))})" style="padding: 6px 10px; font-size: 0.74rem; display: inline-flex; align-items: center; gap: 4px;">
                    <i data-lucide="globe" style="width: 13px; height: 13px;"></i>
                    <span>Site</span>
                  </button>
                  <button type="button" class="btn btn-secondary btn-sm" onclick="window.playWebStreamUrl('${encodeURIComponent(item.url)}')" style="padding: 6px 12px; font-size: 0.76rem; display: inline-flex; align-items: center; gap: 4px;">
                    <i data-lucide="play" style="width: 13px; height: 13px;"></i>
                    <span>İzle</span>
                  </button>
                  ${isEmpFav ? `
                    <button type="button" class="btn btn-secondary btn-sm" onclick="window.deleteWebStreamFavorite('${encodeURIComponent(item.url)}')" title="Favorilerden Çıkar" style="padding: 6px 8px; color: #eab308;">
                      <i data-lucide="star" style="width: 13px; height: 13px; fill: #eab308;"></i>
                    </button>
                  ` : `
                    <button type="button" class="btn btn-secondary btn-sm" onclick="window.deleteWebStreamHistoryItem('${encodeURIComponent(item.url)}')" title="Sil" style="padding: 6px 8px; color: var(--text-muted);">
                      <i data-lucide="trash-2" style="width: 13px; height: 13px;"></i>
                    </button>
                  `}
                </div>
              </div>
              ${hasProg ? `
                <div style="display: flex; align-items: center; gap: 8px; margin-top: 2px;">
                  <div style="flex: 1; height: 4px; background: rgba(255,255,255,0.08); border-radius: 2px; overflow: hidden;">
                    <div style="height: 100%; width: ${progWidth}%; background: linear-gradient(90deg, #ef4444, #f97316); border-radius: 2px;"></div>
                  </div>
                  <span style="font-size: 0.70rem; color: var(--text-muted);">${timeText} (%${progress.percent})</span>
                </div>
              ` : ''}
            </div>
          `;
        }).join('');
      }
    }

    if (typeof lucide !== 'undefined') lucide.createIcons();
  }

  window.playWebStreamUrl = function (encodedUrl) {
    const url = decodeURIComponent(encodedUrl);
    const inp = document.getElementById('webstream-tab-input');
    if (inp) {
      inp.value = url;
    }
    startStreamExtraction(url);
  };

  window.deleteWebStreamHistoryItem = function (encodedUrl) {
    const url = decodeURIComponent(encodedUrl);
    try {
      let history = getRecentStreams();
      history = history.filter(h => h.url !== url);
      localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(history));
      renderAllLists();
    } catch {}
  };

  window.deleteWebStreamFavorite = function (encodedUrl) {
    const url = decodeURIComponent(encodedUrl);
    try {
      let favs = getFavorites();
      favs = favs.filter(f => f.url !== url);
      localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(favs));
      updateFavoriteButtonState();
      renderAllLists();
    } catch {}
  };

  function cleanupActivePlayer() {
    if (activePlyrInstance) {
      try {
        // Kapanmadan önce son pozisyonu kaydet
        if (activeCurrentStreamData && activeCurrentStreamData.sourceUrl && activePlyrInstance.currentTime && activePlyrInstance.duration) {
          saveStreamProgress(activeCurrentStreamData.sourceUrl, activePlyrInstance.currentTime, activePlyrInstance.duration);
        }
        activePlyrInstance.destroy();
      } catch {}
      activePlyrInstance = null;
    }
    if (activeHlsInstance) {
      try {
        activeHlsInstance.destroy();
      } catch {}
      activeHlsInstance = null;
    }
    const audioBar = document.getElementById('webstream-audio-tracks-bar');
    if (audioBar) audioBar.style.display = 'none';

    const mount = document.getElementById('webstream-player-mount');
    if (mount) {
      mount.innerHTML = '';
    }
  }

  // --- PLAYER MOUNT (PLYR / HLS / RESUME / AUTO NEXT) ---
  function mountStreamPlayer(streamData, resumePositionOverride = null) {
    cleanupActivePlayer();
    const mount = document.getElementById('webstream-player-mount');
    if (!mount) return;

    const { streamUrl, streamType, embedUrl, sourceUrl } = streamData;
    const isM3u8 = streamType === 'm3u8' || (streamUrl && (streamUrl.includes('.m3u8') || streamUrl.includes('master.txt') || streamUrl.includes('/m/') || streamUrl.includes('/mm/') || streamUrl.includes('/mx/') || streamUrl.includes('workers.dev') || streamUrl.includes('cdnimages')));
    const isMp4 = !isM3u8 && (streamType === 'mp4' || (streamUrl && streamUrl.includes('.mp4')));

    if (isM3u8 || isMp4) {
      const videoEl = document.createElement('video');
      videoEl.id = 'webstream-inline-video';
      videoEl.className = 'plyr';
      videoEl.playsInline = true;
      videoEl.controls = true;
      videoEl.autoplay = true;
      videoEl.style.cssText = 'width: 100%; height: 100%; object-fit: contain; background: #000;';

      // VTT Altyazılarını ekle (Kullanıcı tercihi kapalıysa default atanmaz)
      const userSubEnabled = localStorage.getItem('haytool_subtitles_enabled') === 'true';
      if (Array.isArray(streamData.tracks) && streamData.tracks.length > 0) {
        streamData.tracks.forEach((t) => {
          if (t && t.file) {
            const trackEl = document.createElement('track');
            trackEl.kind = t.kind || 'captions';
            trackEl.label = t.label || 'Altyazı';
            trackEl.srclang = t.label ? t.label.toLowerCase().slice(0, 2) : 'tr';
            trackEl.src = t.file;
            if (t.default && userSubEnabled) trackEl.default = true;
            videoEl.appendChild(trackEl);
          }
        });
      }

      mount.appendChild(videoEl);

      // Kaldığı yerden devam etme kontrolü
      const savedProg = getStreamProgress(sourceUrl);
      let targetStartTime = resumePositionOverride !== null
        ? resumePositionOverride
        : (savedProg && savedProg.currentTime > 10 && savedProg.currentTime < (savedProg.duration - 20) ? savedProg.currentTime : 0);

      if (isM3u8 && typeof Hls !== 'undefined' && Hls.isSupported()) {
        const hls = new Hls({
          enableWorker: true,
          lowLatencyMode: true,
          xhrSetup: (xhr) => {
            xhr.withCredentials = false;
          }
        });
        hls.loadSource(streamUrl);
        hls.attachMedia(videoEl);
        activeHlsInstance = hls;

        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          renderAudioTrackSelector(hls);
          if (targetStartTime > 0) {
            videoEl.currentTime = targetStartTime;
            if (typeof window.showToast === 'function') {
              window.showToast(`${getTranslation('webstream_resuming', 'Kaldığınız yerden devam ediliyor')} (${formatTime(targetStartTime)})`, 'info');
            }
          }
          videoEl.play().catch(() => {});
        });

        hls.on(Hls.Events.AUDIO_TRACKS_UPDATED, () => {
          renderAudioTrackSelector(hls);
        });

        hls.on(Hls.Events.ERROR, (event, data) => {
          if (data.fatal) {
            console.warn('[WebStream] HLS fatal error:', data.type, data.details);
            if (embedUrl) {
              // HLS 403 / CORS hatası durumunda otomatik iframe oynatıcıya geç
              mountStreamPlayer({ ...streamData, streamType: 'embed', streamUrl: embedUrl });
              return;
            }
            switch (data.type) {
              case Hls.ErrorTypes.NETWORK_ERROR:
                hls.startLoad();
                break;
              case Hls.ErrorTypes.MEDIA_ERROR:
                hls.recoverMediaError();
                break;
              default:
                hls.destroy();
                break;
            }
          }
        });
      } else {
        videoEl.src = streamUrl;
        if (targetStartTime > 0) {
          videoEl.onloadedmetadata = () => {
            videoEl.currentTime = targetStartTime;
            if (typeof window.showToast === 'function') {
              window.showToast(`${getTranslation('webstream_resuming', 'Kaldığınız yerden devam ediliyor')} (${formatTime(targetStartTime)})`, 'info');
            }
          };
        }
      }

      if (typeof Plyr !== 'undefined') {
        const isSubEnabled = localStorage.getItem('haytool_subtitles_enabled') === 'true';
        activePlyrInstance = new Plyr(videoEl, {
          autoplay: true,
          captions: { active: isSubEnabled, update: true },
          controls: [
            'play-large', 'play', 'progress', 'current-time', 'duration',
            'mute', 'volume', 'captions', 'settings', 'pip', 'airplay', 'fullscreen'
          ],
          keyboard: { focused: true, global: true },
          tooltips: { controls: true, seek: true }
        });

        // Kullanıcı altyazıyı açıp kapattığında tercihi hatırla
        activePlyrInstance.on('captionsenabled', () => {
          localStorage.setItem('haytool_subtitles_enabled', 'true');
        });
        activePlyrInstance.on('captionsdisabled', () => {
          localStorage.setItem('haytool_subtitles_enabled', 'false');
        });

        // Süre ilerleme dinleyicisi (Progress throttling)
        activePlyrInstance.on('timeupdate', () => {
          const now = Date.now();
          if (now - lastProgressSaveTime > 4000) {
            lastProgressSaveTime = now;
            if (videoEl.currentTime && videoEl.duration) {
              saveStreamProgress(sourceUrl, videoEl.currentTime, videoEl.duration);
            }
          }
        });

        activePlyrInstance.on('pause', () => {
          if (videoEl.currentTime && videoEl.duration) {
            saveStreamProgress(sourceUrl, videoEl.currentTime, videoEl.duration);
            renderAllLists();
          }
        });

        // Video bittiğinde otomatik sonraki bölüme geçiş
        activePlyrInstance.on('ended', () => {
          const navData = detectEpisodeNavigation(sourceUrl);
          if (navData && navData.nextUrl) {
            if (typeof window.showToast === 'function') {
              window.showToast(`Bölüm bitti! 3 saniye içinde sonraki bölüme (${navData.nextLabel}) geçiliyor...`, 'info');
            }
            setTimeout(() => {
              window.playWebStreamUrl(encodeURIComponent(navData.nextUrl));
            }, 3000);
          }
        });
      }

      videoEl.play().catch(() => {});

    } else if (embedUrl || streamType === 'embed') {
      const audioBar = document.getElementById('webstream-audio-tracks-bar');
      if (audioBar) audioBar.style.display = 'none';

      const targetIframeUrl = embedUrl || streamUrl;
      const iframe = document.createElement('iframe');
      iframe.src = targetIframeUrl;
      iframe.style.cssText = 'width: 100%; height: 100%; border: none; background: #000;';
      iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen';
      iframe.setAttribute('allowfullscreen', 'true');
      // Frame-buster (top.location) koruması: Dış sitelerin ana uygulamayı yönlendirmesini engelle, oynatıcıyı kilitli tut
      iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-forms allow-presentation allow-popups allow-popups-to-escape-sandbox');
      mount.appendChild(iframe);
    }
  }

  // --- STREAM EXTRACTION ORCHESTRATOR ---
  async function startStreamExtraction(forceUrl = null) {
    const inpUrl = document.getElementById('webstream-tab-input');
    const btnPlay = document.getElementById('webstream-tab-play-btn');
    const btnIcon = document.getElementById('webstream-tab-btn-icon');
    const lblBtn = document.getElementById('lbl-webstream-play-btn');
    const viewPlayer = document.getElementById('webstream-view-player');
    const viewEmpty = document.getElementById('webstream-view-empty');

    const targetUrl = (forceUrl || (inpUrl ? inpUrl.value : '')).trim();
    if (!targetUrl) {
      showStatus('Lütfen bir video veya dizi izleme bağlantısı yapıştırın.', 'warning');
      return;
    }

    hideStatus();
    if (btnPlay) btnPlay.disabled = true;
    if (lblBtn) lblBtn.textContent = 'Çözümleniyor...';
    if (btnIcon) btnIcon.setAttribute('data-lucide', 'loader');
    if (typeof lucide !== 'undefined') lucide.createIcons();

    try {
      const methodSel = document.getElementById('webstream-method-select');
      const selectedMethod = methodSel ? methodSel.value : (localStorage.getItem('webstream_extraction_method') || 'auto');

      console.log('[startStreamExtraction] Sending request for:', targetUrl, 'method:', selectedMethod);
      const response = await fetch('/api/tools/extract-web-stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: targetUrl, method: selectedMethod })
      });

      const data = await response.json();
      console.log('[startStreamExtraction] Got response status:', response.status, 'data:', data);

      if (!response.ok || !data.success) {
        console.warn('[startStreamExtraction] Response not ok or not success:', data);
        showStatus(data.error || 'Video akışı çözümlenemedi. Bağlantıyı kontrol edin.', 'error');
        return;
      }

      activeCurrentStreamData = data;
      saveStreamToHistory({
        url: targetUrl,
        title: data.title,
        streamUrl: data.streamUrl,
        streamType: data.streamType,
        embedUrl: data.embedUrl
      });

      // Arayüzü video oynatma moduna geçir
      if (viewEmpty) viewEmpty.classList.add('hidden');
      if (viewPlayer) viewPlayer.classList.remove('hidden');

      // Başlık ve meta bilgilerini doldur
      const titleEl = document.getElementById('webstream-active-title');
      const badgeEl = document.getElementById('webstream-meta-badge');
      const domainEl = document.getElementById('webstream-source-domain');

      if (titleEl) titleEl.textContent = data.title || targetUrl;
      if (badgeEl) badgeEl.textContent = (data.streamType || 'm3u8').toUpperCase();
      if (domainEl) domainEl.textContent = getDomain(targetUrl);

      // Favori buton durumunu senkronize et
      updateFavoriteButtonState();

      // Bölüm navigasyonunu bağla
      updateEpisodeNavigationUI(targetUrl);

      // Çoklu kaynak / sunucu seçicisini güncelle
      updateMultiSourceUI(data);

      // Oynatıcıyı bağla
      mountStreamPlayer(data);

      // Listeleri güncelle
      renderAllLists();

      if (typeof window.showToast === 'function') {
        if (data.promptUserSelection && data.allStreams && data.allStreams.length > 1) {
          window.showToast(`${data.allStreams.length} video kaynağı tespit edildi, dilediğinizi seçin.`, 'info');
        } else {
          window.showToast('Video başarıyla çözüldü, başlatılıyor...', 'success');
        }
      }

    } catch (err) {
      console.error('[startStreamExtraction] Catch error:', err);
      showStatus(`Bağlantı hatası: ${err.message}`, 'error');
    } finally {
      if (btnPlay) btnPlay.disabled = false;
      if (lblBtn) lblBtn.textContent = 'Çöz & İzle';
      if (btnIcon) btnIcon.setAttribute('data-lucide', 'play');
      if (typeof lucide !== 'undefined') lucide.createIcons();
    }
  }

  function closeWebStreamPlayer() {
    cleanupActivePlayer();
    activeCurrentStreamData = null;
    const viewPlayer = document.getElementById('webstream-view-player');
    const viewEmpty = document.getElementById('webstream-view-empty');

    if (viewPlayer) viewPlayer.classList.add('hidden');
    if (viewEmpty) viewEmpty.classList.remove('hidden');
    renderAllLists();
  }

  // --- INITIALIZATION & EVENT LISTENERS ---
  window.initWebStreamTab = function () {
    renderAllLists();

    const methodSel = document.getElementById('webstream-method-select');
    if (methodSel) {
      const savedMethod = localStorage.getItem('webstream_extraction_method') || 'auto';
      methodSel.value = savedMethod;
      methodSel.onchange = () => {
        localStorage.setItem('webstream_extraction_method', methodSel.value);
      };
    }

    const inp = document.getElementById('webstream-tab-input');
    const btnPaste = document.getElementById('webstream-tab-paste-btn');
    const btnPlay = document.getElementById('webstream-tab-play-btn');
    const btnReload = document.getElementById('webstream-btn-reload');
    const btnCopyStream = document.getElementById('webstream-btn-copy-stream');
    const btnOpenNative = document.getElementById('webstream-btn-open-native');
    const btnClosePlayer = document.getElementById('webstream-btn-close-player');
    const btnClearHistory = document.getElementById('webstream-btn-clear-history');
    const btnFavorite = document.getElementById('webstream-btn-favorite');
    const btnDownload = document.getElementById('webstream-btn-download');
    const btnOpenSite = document.getElementById('webstream-btn-open-site');

    // Yan Panel Sekmeleri
    const sideTabHist = document.getElementById('webstream-side-tab-history');
    const sideTabFavs = document.getElementById('webstream-side-tab-favs');
    if (sideTabHist && sideTabFavs) {
      sideTabHist.onclick = () => {
        activeSideTab = 'history';
        sideTabHist.classList.add('active');
        sideTabFavs.classList.remove('active');
        renderAllLists();
      };
      sideTabFavs.onclick = () => {
        activeSideTab = 'favorites';
        sideTabFavs.classList.add('active');
        sideTabHist.classList.remove('active');
        renderAllLists();
      };
    }

    // Boş Durum Sekmeleri
    const empTabHist = document.getElementById('webstream-empty-tab-history');
    const empTabFavs = document.getElementById('webstream-empty-tab-favs');
    if (empTabHist && empTabFavs) {
      empTabHist.onclick = () => {
        activeEmptyTab = 'history';
        empTabHist.classList.add('active');
        empTabFavs.classList.remove('active');
        renderAllLists();
      };
      empTabFavs.onclick = () => {
        activeEmptyTab = 'favorites';
        empTabFavs.classList.add('active');
        empTabHist.classList.remove('active');
        renderAllLists();
      };
    }

    // Yapıştır
    if (btnPaste && inp) {
      btnPaste.onclick = async () => {
        try {
          const text = await navigator.clipboard.readText();
          if (text) {
            inp.value = text.trim();
            inp.focus();
          }
        } catch {}
      };
    }

    if (inp) {
      inp.onkeydown = (e) => {
        if (e.key === 'Enter') {
          startStreamExtraction();
        }
      };
    }

    if (btnPlay) {
      btnPlay.onclick = () => {
        // Eğer site gezgini açıksa ve gezginden bir film açılmışsa gezgini gizle
        const browserCard = document.getElementById('webstream-browser-card');
        const urlInput = document.getElementById('webstream-browser-url-input');
        if (browserCard && browserCard.style.display !== 'none') {
          browserCard.style.display = 'none';
        }
        // Eğer gezginden bir URL alınmışsa ve ana kutu boşsa veya kök kalmışsa gezgindeki güncel adresi aktar
        const inp = document.getElementById('webstream-tab-input');
        const candidateUrl = (urlInput?.value || currentBrowsingUrl || '').trim();
        if (candidateUrl && inp && (!inp.value || inp.value.length < candidateUrl.length)) {
          inp.value = candidateUrl;
        }
        startStreamExtraction();
      };
    }

    // Favorilere Ekle / Çıkar
    if (btnFavorite) {
      btnFavorite.onclick = () => {
        if (!activeCurrentStreamData) return;
        const currentUrl = activeCurrentStreamData.sourceUrl || activeCurrentStreamData.url;
        const isFav = toggleFavoriteItem({
          url: currentUrl,
          title: activeCurrentStreamData.title,
          streamUrl: activeCurrentStreamData.streamUrl,
          streamType: activeCurrentStreamData.streamType,
          embedUrl: activeCurrentStreamData.embedUrl
        });

        if (typeof window.showToast === 'function') {
          window.showToast(isFav ? 'Favorilere eklendi! ⭐' : 'Favorilerden çıkarıldı.', 'info');
        }
      };
    }

    // HaYTooL ile İndir
    if (btnDownload) {
      btnDownload.onclick = () => {
        window.downloadCurrentStream();
      };
    }

    // Kaynak Sayfayı / Siteyi Aç
    if (btnOpenSite) {
      btnOpenSite.onclick = () => {
        if (!activeCurrentStreamData) return;
        const targetUrl = activeCurrentStreamData.sourceUrl || activeCurrentStreamData.url;
        if (targetUrl) {
          window.openWebStreamSite(encodeURIComponent(targetUrl));
        }
      };
    }

    // Yenile
    if (btnReload) {
      btnReload.onclick = () => {
        if (activeCurrentStreamData) {
          mountStreamPlayer(activeCurrentStreamData);
          if (typeof window.showToast === 'function') {
            window.showToast('Akış yeniden yüklendi.', 'info');
          }
        }
      };
    }

    // Akış Bağlantısını Kopyala
    if (btnCopyStream) {
      btnCopyStream.onclick = async () => {
        if (activeCurrentStreamData && activeCurrentStreamData.streamUrl) {
          try {
            await navigator.clipboard.writeText(activeCurrentStreamData.streamUrl);
            if (typeof window.showToast === 'function') {
              window.showToast('Akış bağlantısı panoya kopyalandı!', 'success');
            }
          } catch {}
        }
      };
    }

    // Ayrı Pencere (Native HaYTooL Oynatıcı)
    if (btnOpenNative) {
      btnOpenNative.onclick = async () => {
        if (!activeCurrentStreamData) return;
        const targetUrl = activeCurrentStreamData.streamUrl || activeCurrentStreamData.embedUrl;
        if (!targetUrl) return;

        try {
          if (typeof window.chrome !== 'undefined' && window.chrome.webview && window.chrome.webview.hostObjects && window.chrome.webview.hostObjects.playerBridge) {
            await window.chrome.webview.hostObjects.playerBridge.play(targetUrl);
          } else {
            window.open(targetUrl, '_blank');
          }
        } catch {
          window.open(targetUrl, '_blank');
        }
      };
    }

    // Kapat
    if (btnClosePlayer) {
      btnClosePlayer.onclick = () => {
        closeWebStreamPlayer();
      };
    }

    // Geçmişi Temizle
    if (btnClearHistory) {
      btnClearHistory.onclick = () => {
        localStorage.removeItem(HISTORY_STORAGE_KEY);
        renderAllLists();
        if (typeof window.showToast === 'function') {
          window.showToast('İzleme geçmişi temizlendi.', 'info');
        }
      };
    }

    // Arama Çubuğu Olay Dinleyicileri
    const btnSearch = document.getElementById('webstream-search-btn');
    const searchInp = document.getElementById('webstream-search-input');
    const btnClearSearch = document.getElementById('webstream-search-clear-btn');

    if (btnSearch) {
      btnSearch.onclick = () => {
        performWebStreamSearch();
      };
    }

    if (searchInp) {
      searchInp.onkeydown = (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          performWebStreamSearch();
        }
      };
    }

    if (btnClearSearch) {
      btnClearSearch.onclick = () => {
        clearWebStreamSearch();
      };
    }

    setupEmbeddedSiteBrowser();

    if (typeof lucide !== 'undefined') lucide.createIcons();
  };

  // Modal yönlendirmesi
  window.openWebStreamExtractorModal = function () {
    if (typeof window.switchTab === 'function') {
      window.switchTab('webstream');
    }
  };

  // Sayfa yüklendiğinde başlat
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      window.initWebStreamTab();
    });
  } else {
    window.initWebStreamTab();
  }
})();
