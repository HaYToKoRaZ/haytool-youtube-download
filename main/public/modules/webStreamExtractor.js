// Multimedia HaYTooL - Web Video & Dizi Akış Çözücü ve Yerleşik Oynatıcı Sekmesi
// Harici/yüzen pop-up pencere yerine, doğrudan uygulamanın kendi içinde yerleşik sekme (Tab) olarak oynatır.

(function () {
  const HISTORY_STORAGE_KEY = 'haytool_web_stream_history';
  let activePlyrInstance = null;
  let activeHlsInstance = null;
  let activeCurrentStreamData = null;

  function getTranslation(key, fallback) {
    if (typeof window.t === 'function') {
      const val = window.t(key);
      if (val && val !== key) return val;
    }
    return fallback;
  }

  function getRecentStreams() {
    try {
      return JSON.parse(localStorage.getItem(HISTORY_STORAGE_KEY) || '[]');
    } catch {
      return [];
    }
  }

  function saveStreamToHistory(item) {
    try {
      let history = getRecentStreams();
      history = history.filter(h => h.url !== item.url);
      history.unshift({
        url: item.url,
        title: item.title || item.url,
        date: new Date().toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }),
        streamUrl: item.streamUrl || '',
        streamType: item.streamType || 'm3u8',
        embedUrl: item.embedUrl || null
      });
      if (history.length > 12) history = history.slice(0, 12);
      localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(history));
    } catch {}
  }

  function escapeHtml(text) {
    if (!text) return '';
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function getDomain(url) {
    try {
      const u = new URL(url);
      return u.hostname.replace(/^www\./, '');
    } catch {
      return 'web';
    }
  }

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

  function renderHistoryLists() {
    const history = getRecentStreams();
    const emptyListEl = document.getElementById('webstream-empty-history-list');
    const sidebarListEl = document.getElementById('webstream-sidebar-history-list');

    const emptyText = `<div style="color: var(--text-muted); font-size: 0.82rem; text-align: center; padding: 18px; border: 1px dashed var(--border-color); border-radius: 10px;">Henüz izlenen web videosu yok. Yukarıdan bir bağlantı yapıştırıp başlatabilirsiniz.</div>`;

    if (emptyListEl) {
      if (history.length === 0) {
        emptyListEl.innerHTML = emptyText;
      } else {
        emptyListEl.innerHTML = history.map((h, i) => `
          <div style="display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 10px 14px; background: rgba(255,255,255,0.03); border: 1px solid var(--border-color); border-radius: 10px; transition: background 0.15s;">
            <div style="flex: 1; overflow: hidden; cursor: pointer;" onclick="window.playWebStreamUrl('${encodeURIComponent(h.url)}')">
              <div style="font-weight: 600; font-size: 0.88rem; color: var(--text-color); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(h.title)}</div>
              <div style="font-size: 0.74rem; color: var(--text-muted); display: flex; align-items: center; gap: 6px; margin-top: 2px;">
                <span style="color: #ef4444; font-weight: 600;">${escapeHtml(getDomain(h.url))}</span>
                <span>•</span>
                <span>${escapeHtml(h.date)}</span>
                <span>•</span>
                <span style="text-transform: uppercase;">${escapeHtml(h.streamType)}</span>
              </div>
            </div>
            <div style="display: flex; align-items: center; gap: 6px;">
              <button type="button" class="btn btn-secondary btn-sm" onclick="window.playWebStreamUrl('${encodeURIComponent(h.url)}')" style="padding: 6px 12px; font-size: 0.76rem; display: inline-flex; align-items: center; gap: 4px;">
                <i data-lucide="play" style="width: 13px; height: 13px;"></i>
                <span>İzle</span>
              </button>
              <button type="button" class="btn btn-secondary btn-sm" onclick="window.deleteWebStreamHistoryItem('${encodeURIComponent(h.url)}')" title="Sil" style="padding: 6px 8px; color: var(--text-muted);">
                <i data-lucide="trash-2" style="width: 13px; height: 13px;"></i>
              </button>
            </div>
          </div>
        `).join('');
      }
    }

    if (sidebarListEl) {
      if (history.length === 0) {
        sidebarListEl.innerHTML = `<div style="color: var(--text-muted); font-size: 0.78rem; text-align: center; padding: 12px;">Geçmiş boş.</div>`;
      } else {
        sidebarListEl.innerHTML = history.map((h, i) => `
          <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 8px 10px; background: rgba(255,255,255,0.02); border: 1px solid var(--border-color); border-radius: 8px;">
            <div style="flex: 1; overflow: hidden; cursor: pointer;" onclick="window.playWebStreamUrl('${encodeURIComponent(h.url)}')">
              <div style="font-weight: 600; font-size: 0.82rem; color: var(--text-color); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(h.title)}</div>
              <div style="font-size: 0.72rem; color: var(--text-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(getDomain(h.url))} • ${h.date}</div>
            </div>
            <button type="button" class="btn btn-secondary btn-sm" onclick="window.playWebStreamUrl('${encodeURIComponent(h.url)}')" style="padding: 4px 8px; font-size: 0.72rem;">
              <i data-lucide="play" style="width: 12px; height: 12px;"></i>
            </button>
          </div>
        `).join('');
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
      renderHistoryLists();
    } catch {}
  };

  function cleanupActivePlayer() {
    if (activePlyrInstance) {
      try {
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
    const mount = document.getElementById('webstream-player-mount');
    if (mount) {
      mount.innerHTML = '';
    }
  }

  function mountStreamPlayer(streamData) {
    cleanupActivePlayer();
    const mount = document.getElementById('webstream-player-mount');
    if (!mount) return;

    const { streamUrl, streamType, embedUrl } = streamData;

    // 1. Eğer doğrudan video stream veya m3u8 varsa Plyr + Hls.js bağla
    if (streamType === 'm3u8' || streamType === 'mp4' || (streamUrl && streamUrl.includes('.m3u8'))) {
      const videoEl = document.createElement('video');
      videoEl.id = 'webstream-inline-video';
      videoEl.className = 'plyr';
      videoEl.playsInline = true;
      videoEl.controls = true;
      videoEl.autoplay = true;
      videoEl.style.cssText = 'width: 100%; height: 100%; object-fit: contain; background: #000;';

      mount.appendChild(videoEl);

      const isM3u8 = streamType === 'm3u8' || streamUrl.includes('.m3u8');

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

        hls.on(Hls.Events.ERROR, (event, data) => {
          if (data.fatal) {
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
      }

      if (typeof Plyr !== 'undefined') {
        activePlyrInstance = new Plyr(videoEl, {
          autoplay: true,
          controls: [
            'play-large', 'play', 'progress', 'current-time', 'duration',
            'mute', 'volume', 'captions', 'settings', 'pip', 'airplay', 'fullscreen'
          ],
          keyboard: { focused: true, global: true },
          tooltips: { controls: true, seek: true }
        });
      }

      videoEl.play().catch(() => {});

    } else if (embedUrl || streamType === 'embed') {
      // 2. Embed Iframe oynatıcı
      const targetIframeUrl = embedUrl || streamUrl;
      const iframe = document.createElement('iframe');
      iframe.src = targetIframeUrl;
      iframe.style.cssText = 'width: 100%; height: 100%; border: none; background: #000;';
      iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen';
      iframe.setAttribute('allowfullscreen', 'true');
      mount.appendChild(iframe);
    }
  }

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
      const response = await fetch('/api/tools/extract-web-stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: targetUrl })
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
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

      // Oynatıcıyı bağla
      mountStreamPlayer(data);

      // Geçmiş listelerini güncelle
      renderHistoryLists();

      if (typeof window.showToast === 'function') {
        window.showToast('Video başarıyla çözüldü, başlatılıyor...', 'success');
      }

    } catch (err) {
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
    renderHistoryLists();
  }

  window.initWebStreamTab = function () {
    renderHistoryLists();

    const inp = document.getElementById('webstream-tab-input');
    const btnPaste = document.getElementById('webstream-tab-paste-btn');
    const btnPlay = document.getElementById('webstream-tab-play-btn');
    const btnReload = document.getElementById('webstream-btn-reload');
    const btnCopyStream = document.getElementById('webstream-btn-copy-stream');
    const btnOpenNative = document.getElementById('webstream-btn-open-native');
    const btnClosePlayer = document.getElementById('webstream-btn-close-player');
    const btnClearHistory = document.getElementById('webstream-btn-clear-history');

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
        startStreamExtraction();
      };
    }

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

    if (btnClosePlayer) {
      btnClosePlayer.onclick = () => {
        closeWebStreamPlayer();
      };
    }

    if (btnClearHistory) {
      btnClearHistory.onclick = () => {
        localStorage.removeItem(HISTORY_STORAGE_KEY);
        renderHistoryLists();
        if (typeof window.showToast === 'function') {
          window.showToast('İzleme geçmişi temizlendi.', 'info');
        }
      };
    }

    if (typeof lucide !== 'undefined') lucide.createIcons();
  };

  // Eski modal fonksiyonunu doğrudan sekmeye yönlendir
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
