// Türkçe Açıklama: Gömülü video oynatıcı modalı boyutlandırma, sürükleme, küçültme, yönelim ve Discord RPC aktivite modülü.

let _ctx = {
  getLocalDb: () => window.localDb || { settings: {}, history: [] },
  getVideoPlayerInstance: () => window.videoPlayerInstance,
  getCurrentPlayingVideoId: () => window.currentPlayingVideoId
};

/**
 * app.js tarafından paylaşılan oynatıcı referanslarını kaydeder.
 * @param {object} ctx
 */
export function registerPlayerModalContext(ctx) {
  _ctx = { ..._ctx, ...ctx };
}

/**
 * Oynatıcı modalını video formatına (Shorts 9:16 vs Wide 16:9) göre sıfırlar ve kayıtlı ölçüleri uygular.
 */
export function resetAndApplyPlayerDimensions(isShort = false, isMinimized = false) {
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

/**
 * Oynatıcı modalını küçültür (minimize) veya geri yükler.
 */
export function togglePlayerMinimize() {
  const modal = document.getElementById('player-modal');
  const btn = document.getElementById('minimize-player-modal-btn');
  if (!modal) return;

  modal.classList.toggle('minimized');
  const isMinimized = modal.classList.contains('minimized');
  const isShort = modal.classList.contains('is-short-player');

  resetAndApplyPlayerDimensions(isShort, isMinimized);

  const localDb = _ctx.getLocalDb();
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

  const playerInst = _ctx.getVideoPlayerInstance();
  if (playerInst && typeof playerInst.resize === 'function') {
    setTimeout(() => playerInst.resize(), 50);
  }
}

/**
 * Oynatıcı modalını başlık barından taşınabilir hale getirir.
 *
 * @param {HTMLElement} modalContent
 * @param {HTMLElement} dragHeader
 */
export function makeElementDraggable(modalContent, dragHeader) {
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

/**
 * Oynatıcı modalını en-boy oranı kilitli olarak orantılı boyutlandırılabilir hale getirir.
 *
 * @param {HTMLElement} modalContent
 */
export function makeElementResizable(modalContent) {
  if (!modalContent) return;
  const handles = modalContent.querySelectorAll('.resize-handle');

  handles.forEach(handle => {
    handle.onmousedown = resizeMouseDown;

    function resizeMouseDown(e) {
      e.preventDefault();
      e.stopPropagation();

      const modal = modalContent.closest('#player-modal');
      const isShort = modal ? modal.classList.contains('is-short-player') : false;

      const playerInst = _ctx.getVideoPlayerInstance();
      const rawVideo = modalContent.querySelector('video') || (playerInst && playerInst.video);
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

      function elementResize(ev) {
        ev.preventDefault();
        const dx = ev.clientX - startX;
        const dy = ev.clientY - startY;

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

        const minWidth = isShort ? 200 : 280;
        const maxWidth = Math.min(1000, window.innerWidth - 20);
        newWidth = Math.max(minWidth, Math.min(newWidth, maxWidth));

        let newBodyHeight = Math.round(newWidth / ratio);
        let newTotalHeight = newBodyHeight + headerHeight;

        const maxHeight = window.innerHeight - 20;
        if (newTotalHeight > maxHeight) {
          newTotalHeight = maxHeight;
          newBodyHeight = newTotalHeight - headerHeight;
          newWidth = Math.round(newBodyHeight * ratio);
        }

        let newLeft = startLeft;
        let newTop = startTop;

        if (isLeft) {
          newLeft = startLeft + (startWidth - newWidth);
        }
        if (isTop) {
          newTop = startTop + (startHeight - newTotalHeight);
        }

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

        const currentInst = _ctx.getVideoPlayerInstance();
        if (currentInst && typeof currentInst.resize === 'function') {
          currentInst.resize();
        }
      }
    }
  });
}

/**
 * Videonun en-boy oranına göre oynatıcının yönelimini (dikey/yatay) ayarlar.
 *
 * @param {HTMLVideoElement} videoElement
 */
export function adjustPlayerOrientation(videoElement) {
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
      if (isVertical) {
        modal.classList.add('is-short-player', 'is-vertical-player');
      } else {
        modal.classList.remove('is-vertical-player');
      }
    }

    if (inlineWrapper) {
      if (isVertical) {
        inlineWrapper.classList.add('is-short-player', 'is-vertical-player');
        inlineWrapper.style.aspectRatio = ratio;
      } else {
        inlineWrapper.classList.remove('is-short-player', 'is-vertical-player');
        inlineWrapper.style.aspectRatio = '';
      }
    }

    const plyrEls = document.querySelectorAll('#player-modal .plyr, .inline-player-wrapper .plyr');
    plyrEls.forEach(el => {
      if (isVertical) {
        el.classList.add('plyr--is-vertical');
      } else {
        el.classList.remove('plyr--is-vertical');
      }
    });

    const playerInst = _ctx.getVideoPlayerInstance();
    if (playerInst && typeof playerInst.resize === 'function') {
      setTimeout(() => playerInst.resize(), 50);
    }
  }
}

/**
 * Aktif oynatıcı gövdesini (modal, inline, webstream veya IPTV) ve varsa içindeki .plyr sarmalayıcısını döndürür.
 * .plyr döndürüldüğü için tüm HUD katmanları hem normal görünümde hem tam ekranda (fullscreen) kesintisiz görünür.
 * @returns {HTMLElement|null}
 */
export function getActivePlayerContainer() {
  const inlineContainer = document.getElementById('downloaded-inline-player-container');
  const inlineBody = document.getElementById('inline-player-body');
  const modal = document.getElementById('player-modal');
  const activeTab = document.querySelector('.nav-item.active')?.getAttribute('data-tab') || 'history';

  let baseContainer = null;

  if (activeTab === 'iptv') {
    const slotIdx = window.activeIptvSlot !== undefined ? window.activeIptvSlot : 0;
    const activeSlotEl = document.querySelector(`.iptv-slot[data-slot="${slotIdx}"]`);
    if (activeSlotEl) {
      baseContainer = activeSlotEl.querySelector('.slot-body');
    }
  }

  if (!baseContainer && inlineContainer && !inlineContainer.classList.contains('hidden') && inlineBody && inlineBody.firstElementChild) {
    baseContainer = inlineBody;
  }

  if (!baseContainer && modal && !modal.classList.contains('hidden')) {
    baseContainer = modal.querySelector('.player-modal-body');
  }

  if (!baseContainer && activeTab === 'webstream') {
    baseContainer = document.getElementById('webstream-player-mount');
  }

  if (baseContainer) {
    return baseContainer.querySelector('.plyr') || baseContainer;
  }

  if (document.fullscreenElement) {
    return document.fullscreenElement;
  }

  return document.querySelector('#player-modal:not(.hidden) .plyr, #downloaded-inline-player-container:not(.hidden) .plyr')
    || document.querySelector('#embedded-video-player')?.parentElement
    || null;
}

/**
 * Geçici merkez HUD kartı gösterir (Kaldığı yerden devam / SponsorBlock durum bilgisi vb.).
 */
export function showPlayerTransientOverlay(htmlContent, durationMs = 1500) {
  const container = getActivePlayerContainer();
  if (!container) return;

  let overlay = container.querySelector('.player-transient-overlay');
  if (overlay) {
    if (overlay._fadeOutTimer) clearTimeout(overlay._fadeOutTimer);
    overlay.style.animation = 'none';
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
}

/**
 * Ses seviyesi değiştiğinde oynatıcının sağ ortasında dikey modern ses HUD göstergesini açar.
 * Ardışık ses değişimlerinde DOM'u silip yeniden oluşturmak yerine mevcut çubuğu akıcı biçimde günceller.
 * @param {number} volume (0 - 1)
 */
export function triggerVolumeHUD(volume) {
  const container = getActivePlayerContainer();
  if (!container) return;

  const volPercent = Math.max(0, Math.min(100, Math.round(volume * 100)));
  const icon = volPercent === 0 
    ? 'volume-x' 
    : (volPercent < 33 ? 'volume' : (volPercent < 66 ? 'volume-1' : 'volume-2'));

  let hudEl = container.querySelector('.volume-hud-modern');
  if (!hudEl) {
    hudEl = document.createElement('div');
    hudEl.className = 'volume-hud-modern volume-hud-vertical';
    hudEl.innerHTML = `
      <span class="volume-hud-icon-wrap" data-icon="${icon}">
        <i data-lucide="${icon}" class="volume-hud-icon"></i>
      </span>
      <div class="volume-hud-bar-track">
        <div class="volume-hud-bar-fill" style="height: ${volPercent}%;"></div>
      </div>
      <div class="volume-hud-percent">${volPercent}%</div>
    `;
    container.appendChild(hudEl);
    try { if (typeof lucide !== 'undefined') lucide.createIcons(); } catch (e) {}
  } else {
    if (hudEl._fadeOutTimer) clearTimeout(hudEl._fadeOutTimer);
    hudEl.classList.remove('hud-exit');

    const fillEl = hudEl.querySelector('.volume-hud-bar-fill');
    if (fillEl) fillEl.style.height = `${volPercent}%`;

    const pctEl = hudEl.querySelector('.volume-hud-percent');
    if (pctEl) pctEl.textContent = `${volPercent}%`;

    const iconWrap = hudEl.querySelector('.volume-hud-icon-wrap');
    if (iconWrap && iconWrap.getAttribute('data-icon') !== icon) {
      iconWrap.setAttribute('data-icon', icon);
      iconWrap.innerHTML = `<i data-lucide="${icon}" class="volume-hud-icon"></i>`;
      try { if (typeof lucide !== 'undefined') lucide.createIcons(); } catch (e) {}
    }
  }

  hudEl._fadeOutTimer = setTimeout(() => {
    hudEl.classList.add('hud-exit');
    setTimeout(() => {
      if (hudEl && hudEl.parentNode) hudEl.remove();
    }, 220);
  }, 1100);
}

/**
 * Ekranın sağ üst köşesinde okunaklı, şık bir aksiyon bildirimi (HUD Toast) gösterir.
 * (Tam ekran, 5sn/10sn ileri-geri, hız değişimi, sponsor atlama, altyazı vb.)
 * @param {string} iconName Lucide ikon adı
 * @param {string} text Gösterilecek kısa metin
 * @param {number} [durationMs=1500] Gösterim süresi (ms)
 */
export function showActionToast(iconName, text, durationMs = 1500) {
  const container = getActivePlayerContainer();
  if (!container) return;

  let toastContainer = container.querySelector('.player-action-toast-container');
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.className = 'player-action-toast-container';
    container.appendChild(toastContainer);
  }

  let toast = toastContainer.querySelector('.player-action-toast');
  if (toast) {
    if (toast._timer) clearTimeout(toast._timer);
    toast.remove();
  }

  toast = document.createElement('div');
  toast.className = 'player-action-toast';
  toast.innerHTML = `
    <i data-lucide="${iconName}" class="player-action-toast-icon"></i>
    <span class="player-action-toast-text">${text}</span>
  `;
  toastContainer.appendChild(toast);

  try { if (typeof lucide !== 'undefined') lucide.createIcons(); } catch (e) {}

  toast._timer = setTimeout(() => {
    toast.classList.add('toast-exit');
    setTimeout(() => {
      if (toast && toast.parentNode) toast.remove();
    }, 220);
  }, durationMs);
}

/**
 * Video merkezinde kısa süreli bounce (sıçrama) ikonu gösterir (Play/Pause için).
 * @param {string} iconName Lucide ikon adı
 * @param {number} [durationMs=450] Gösterim süresi (ms)
 */
export function showCenterBounceIcon(iconName, durationMs = 450) {
  const container = getActivePlayerContainer();
  if (!container) return;

  let bounceEl = container.querySelector('.player-center-bounce');
  if (bounceEl) {
    if (bounceEl._timer) clearTimeout(bounceEl._timer);
    bounceEl.remove();
  }

  bounceEl = document.createElement('div');
  bounceEl.className = 'player-center-bounce';
  bounceEl.innerHTML = `<i data-lucide="${iconName}" class="player-center-bounce-icon"></i>`;
  container.appendChild(bounceEl);

  try { if (typeof lucide !== 'undefined') lucide.createIcons(); } catch (e) {}

  bounceEl._timer = setTimeout(() => {
    bounceEl.classList.add('bounce-exit');
    setTimeout(() => {
      if (bounceEl && bounceEl.parentNode) bounceEl.remove();
    }, 180);
  }, durationMs);
}

let _titleOverlayTimer = null;
let _currentOverlayTitle = '';

/**
 * Video oynatıcı üzerinde sol üstte fare hareketiyle (seekbar ile senkron) belirip kaybolan başlık katmanını başlatır.
 * @param {string} title Video başlığı
 * @param {HTMLElement|null} [targetContainer=null]
 */
export function initVideoTitleOverlay(title, targetContainer = null) {
  const cleanTitle = (title || _currentOverlayTitle || '').trim();
  if (cleanTitle) _currentOverlayTitle = cleanTitle;

  const rawContainer = targetContainer || getActivePlayerContainer();
  if (!rawContainer) return;

  const container = rawContainer.classList?.contains('plyr')
    ? rawContainer
    : (rawContainer.querySelector?.('.plyr') || rawContainer);

  let titleEl = container.querySelector('.player-video-title-overlay');
  if (!titleEl) {
    titleEl = document.createElement('div');
    titleEl.className = 'player-video-title-overlay';
    container.appendChild(titleEl);
  }

  titleEl.textContent = cleanTitle;
  titleEl.title = cleanTitle;

  if (!container._hasTitleOverlayListeners) {
    container._hasTitleOverlayListeners = true;

    const showTitle = () => {
      const el = container.querySelector('.player-video-title-overlay');
      if (!el || !el.textContent) return;
      el.classList.add('visible');
      if (_titleOverlayTimer) clearTimeout(_titleOverlayTimer);
      _titleOverlayTimer = setTimeout(() => {
        el.classList.remove('visible');
      }, 2500);
    };

    const hideTitle = () => {
      const el = container.querySelector('.player-video-title-overlay');
      if (el) {
        if (_titleOverlayTimer) clearTimeout(_titleOverlayTimer);
        el.classList.remove('visible');
      }
    };

    container.addEventListener('mousemove', showTitle);
    container.addEventListener('mouseenter', showTitle);
    container.addEventListener('mouseleave', hideTitle);
  }

  titleEl.classList.add('visible');
  if (_titleOverlayTimer) clearTimeout(_titleOverlayTimer);
  _titleOverlayTimer = setTimeout(() => {
    titleEl.classList.remove('visible');
  }, 3000);
}

/**
 * Mevcut video başlık katmanındaki metni günceller.
 * @param {string} title
 */
export function updateVideoTitleOverlay(title) {
  const cleanTitle = (title || '').trim();
  if (cleanTitle) _currentOverlayTitle = cleanTitle;
  const titleEls = document.querySelectorAll('.player-video-title-overlay');
  if (titleEls.length === 0 && cleanTitle) {
    initVideoTitleOverlay(cleanTitle);
    return;
  }
  titleEls.forEach(el => {
    el.textContent = cleanTitle;
    el.title = cleanTitle;
  });
}

/**
 * Oynatılan videonun başlığını ve kanal adını Discord RPC durumuna yansıtmak üzere backend API'ye gönderir.
 *
 * @param {boolean} isPlaying
 * @param {string|null} [customTitle=null]
 * @param {string|null} [customChannel=null]
 */
export function sendPlayerActivity(isPlaying, customTitle = null, customChannel = null) {
  const localDb = _ctx.getLocalDb();
  if (localDb.settings && localDb.settings.discordRpcEnabled === false) return;

  let title = customTitle || null;
  let channelName = customChannel || null;

  const currentPlayingVideoId = _ctx.getCurrentPlayingVideoId();
  if (isPlaying && !title && currentPlayingVideoId) {
    const video = (localDb.history || []).find(h => h.id === currentPlayingVideoId);
    if (video) {
      title = video.title || null;
      channelName = video.channelName || null;
    }
  }

  fetch('/api/player/activity', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: isPlaying ? title : null, channelName: isPlaying ? channelName : null })
  }).catch(e => console.error('[Discord RPC] Durum gönderim hatası:', e));
}

export const PLAYER_SPEED_OPTIONS = [0.5, 0.75, 0.85, 0.9, 1, 1.05, 1.1, 1.15, 1.25, 1.5, 1.75, 2];

/**
 * Plyr kontrol çubuğuna üzerine gelince açılan ince hızlı oynatma hızı menüsü ekler.
 * @param {object} plyrInst Plyr oynatıcı örneği
 * @param {HTMLElement|null} [containerEl=null] Oynatıcı konteyneri
 */
export function injectSpeedControlToPlyr(plyrInst, containerEl = null) {
  if (!plyrInst) return;
  const root = containerEl || getActivePlayerContainer();
  if (!root) return;
  const controls = root.querySelector('.plyr__controls') || (root.closest?.('.plyr')?.querySelector('.plyr__controls'));
  if (!controls || controls.querySelector('.plyr-speed-control-wrap')) return;

  const formatSpeed = (v) => `${Number(Number(v).toFixed(2))}x`;
  let lastCustomSpeed = 1.25;

  const wrap = document.createElement('div');
  wrap.className = 'plyr-speed-control-wrap';

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'plyr__control plyr-speed-btn';
  btn.setAttribute('aria-label', 'Oynatma Hızı');
  btn.textContent = formatSpeed(plyrInst.speed || 1);

  const popover = document.createElement('div');
  popover.className = 'plyr-speed-popover';
  popover.setAttribute('role', 'menu');

  const syncUI = (spd) => {
    const cur = Number(Number(spd || 1).toFixed(2));
    if (cur !== 1) lastCustomSpeed = cur;
    btn.textContent = formatSpeed(cur);
    btn.classList.toggle('is-boosted', cur !== 1);
    popover.querySelectorAll('.plyr-speed-option').forEach(opt => {
      const ov = Number(opt.getAttribute('data-speed'));
      opt.classList.toggle('active', Math.abs(ov - cur) < 0.001);
    });
  };

  const applySpeed = (val) => {
    const clamped = Math.max(0.25, Math.min(2.5, Number(Number(val).toFixed(2))));
    plyrInst.speed = clamped;
    syncUI(clamped);
    showActionToast('gauge', formatSpeed(clamped), 1400);
  };

  PLAYER_SPEED_OPTIONS.forEach(spd => {
    const opt = document.createElement('button');
    opt.type = 'button';
    opt.className = 'plyr-speed-option';
    opt.setAttribute('data-speed', String(spd));
    opt.textContent = formatSpeed(spd);
    opt.addEventListener('click', (e) => {
      e.stopPropagation();
      applySpeed(spd);
      wrap.classList.remove('open');
    });
    popover.appendChild(opt);
  });

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    const cur = Number(Number(plyrInst.speed || 1).toFixed(2));
    applySpeed(cur === 1 ? lastCustomSpeed : 1);
  });

  wrap.addEventListener('wheel', (e) => {
    e.preventDefault();
    e.stopPropagation();
    const cur = Number(plyrInst.speed || 1);
    const delta = e.deltaY < 0 ? 0.05 : -0.05;
    applySpeed(Math.max(0.5, Math.min(2, cur + delta)));
  }, { passive: false });

  wrap.appendChild(popover);
  wrap.appendChild(btn);

  // Ekran Görüntüsü Al & Paylaş Butonu
  const shotBtn = document.createElement('button');
  shotBtn.type = 'button';
  shotBtn.className = 'plyr__control plyr-screenshot-btn';
  shotBtn.setAttribute('aria-label', 'Ekran Görüntüsü Al ve Paylaş');
  shotBtn.title = 'Ekran Görüntüsü Al ve Paylaş';
  shotBtn.innerHTML = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/></svg>`;
  shotBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    captureAndShareVideoFrame(plyrInst, root);
  });

  // .plyr__menu (ayarlar çarkı), captions, pip veya fullscreen'in SOLUNA yerleştir -> Tam Ekran her zaman en sağda kalır
  const anchor = controls.querySelector('.plyr__menu')
    || controls.querySelector('[data-plyr="captions"]')
    || controls.querySelector('[data-plyr="pip"]')
    || controls.querySelector('[data-plyr="fullscreen"]');
  if (anchor && anchor.parentNode === controls) {
    controls.insertBefore(wrap, anchor);
    controls.insertBefore(shotBtn, anchor);
  } else {
    controls.appendChild(wrap);
    controls.appendChild(shotBtn);
  }

  syncUI(plyrInst.speed || 1);
  if (typeof plyrInst.on === 'function') {
    plyrInst.on('ratechange', () => syncUI(plyrInst.speed || 1));
  }
}

/**
 * Aktif video karesini PNG olarak yakalar, panoya kopyalar ve Windows Paylaşım Penceresini açar.
 * @param {object} plyrInst
 * @param {HTMLElement} root
 */
export async function captureAndShareVideoFrame(plyrInst, root) {
  const videoEl = root?.querySelector('video') || plyrInst?.media || document.querySelector('#embedded-video-player, #webstream-inline-video');
  if (!videoEl) return;

  const videoId = _ctx.getCurrentPlayingVideoId();
  const titleText = (_currentOverlayTitle || document.getElementById('inline-player-title')?.textContent || 'video').trim();
  const safeName = titleText.replace(/[^a-zA-Z0-9_\-ğüşıöçĞÜŞİÖÇ ]/g, '').trim().slice(0, 50) || 'screenshot';
  const curSec = Math.floor(videoEl.currentTime || 0);
  const fileName = `${safeName}_${curSec}s.png`;

  let blob = null;
  try {
    const w = videoEl.videoWidth || 1280;
    const h = videoEl.videoHeight || 720;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(videoEl, 0, 0, w, h);
    blob = await new Promise((resolve, reject) => {
      try {
        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob null'))), 'image/png');
      } catch (err) {
        reject(err);
      }
    });
  } catch (canvasErr) {
    // Çapraz kaynak (haytool-d.local) tuval kısıtı varsa sunucudan FFmpeg ile anlık kare al
    if (videoId) {
      try {
        const res = await fetch(`/api/video/${encodeURIComponent(videoId)}/screenshot?time=${encodeURIComponent(videoEl.currentTime || 0)}`);
        if (res.ok) blob = await res.blob();
      } catch (_) {}
    }
  }

  if (!blob) {
    showActionToast('alert-circle', 'Kare yakalanamadı', 1600);
    return;
  }

  // Panoya kopyala (sessizce)
  try {
    if (navigator.clipboard && window.ClipboardItem) {
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
    }
  } catch (_) {}

  // Windows Paylaşım Penceresini (Web Share API) aç
  const pngFile = new File([blob], fileName, { type: 'image/png' });
  try {
    if (navigator.share && (!navigator.canShare || navigator.canShare({ files: [pngFile] }))) {
      showActionToast('camera', 'Paylaşılıyor...', 1200);
      await navigator.share({
        files: [pngFile],
        title: titleText
      });
      return;
    }
  } catch (shareErr) {
    if (shareErr && shareErr.name === 'AbortError') {
      return;
    }
  }

  // Web Share desteklenmiyorsa/başarısızsa PNG olarak indir ve panoya kopyalandı bildirimi göster
  try {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  } catch (_) {}
  showActionToast('camera', 'Kare Yakalandı (Pano + İndirilenler)', 1800);
}
