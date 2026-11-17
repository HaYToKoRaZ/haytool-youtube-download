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
 * Geçici HUD kartı gösterir.
 */
export function showPlayerTransientOverlay(htmlContent, durationMs = 1200) {
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
}

/**
 * Ses seviyesi değiştiğinde ekranda geçici ses HUD göstergesini açar.
 */
export function triggerVolumeHUD(volume) {
  const volPercent = Math.round(volume * 100);
  const icon = volPercent === 0 ? 'volume-x' : (volPercent < 33 ? 'volume' : (volPercent < 66 ? 'volume-1' : 'volume-2'));
  const html = `
    <div class="player-transient-card volume-hud-card">
      <i data-lucide="${icon}" style="width: 32px; height: 32px; color: var(--accent-primary);"></i>
      <div class="transient-title">${volPercent}%</div>
    </div>
  `;
  showPlayerTransientOverlay(html, 800);
  try { if (typeof lucide !== 'undefined') lucide.createIcons(); } catch (e) {}
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
