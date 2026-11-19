// Türkçe Açıklama: Video oynatıcıda imleç merkezli kare yakınlaştırma (1x–8x Zoom), fareyle kaydırma (Pan) ve zoomlu ekran görüntüsü kırpma modülü.
import { translations } from '../../utils/i18n.js';

export const ZOOM_LEVELS = [1, 1.5, 2, 3, 4, 6, 8];
export const MIN_ZOOM_SCALE = 1;
export const MAX_ZOOM_SCALE = 8;

const containerStates = new WeakMap();

function getT() {
  const lang = (typeof window !== 'undefined' && window.localDb?.settings?.lang)
    || (typeof window !== 'undefined' && window.currentLang)
    || (typeof localStorage !== 'undefined' && localStorage.getItem('haytool_user_lang'))
    || 'tr';
  return translations[lang] || translations.tr || {};
}

function getOrCreateState(plyrContainer) {
  let st = containerStates.get(plyrContainer);
  if (!st) {
    st = {
      scale: 1,
      tx: 0,
      ty: 0,
      zoomMode: false,
      isDragging: false,
      wasDragging: false,
      dragStartX: 0,
      dragStartY: 0,
      startTx: 0,
      startTy: 0,
      plyrInst: null
    };
    containerStates.set(plyrContainer, st);
  }
  return st;
}

function resolvePlyrRoot(el) {
  if (!el) return null;
  if (el.classList?.contains('plyr')) return el;
  return el.querySelector?.('.plyr') || el.closest?.('.plyr') || null;
}

function getTargetMediaElement(plyrRoot) {
  if (!plyrRoot) return null;
  const wrapper = plyrRoot.querySelector('.plyr__video-wrapper') || plyrRoot;
  return wrapper.querySelector('video, iframe');
}

/**
 * Kaydırma (Pan) koordinatlarını video çerçevesi sınırları içinde tutar.
 * transform-origin: 0 0 varsayımıyla (tx, ty <= 0 ve >= containerSize * (1 - scale)).
 * @param {number} tx
 * @param {number} ty
 * @param {number} scale
 * @param {number} width
 * @param {number} height
 * @returns {{ tx: number, ty: number }}
 */
export function clampPan(tx, ty, scale, width, height) {
  if (!Number.isFinite(scale) || scale <= 1 || width <= 0 || height <= 0) {
    return { tx: 0, ty: 0 };
  }
  const minTx = width * (1 - scale);
  const minTy = height * (1 - scale);
  return {
    tx: Math.min(0, Math.max(minTx, tx)),
    ty: Math.min(0, Math.max(minTy, ty))
  };
}

function applyTransform(plyrRoot, st) {
  const media = getTargetMediaElement(plyrRoot);
  if (media) {
    if (st.scale <= 1.001) {
      st.scale = 1;
      st.tx = 0;
      st.ty = 0;
      media.style.transformOrigin = '';
      media.style.transform = '';
    } else {
      media.style.transformOrigin = '0 0';
      media.style.transform = `translate3d(${st.tx.toFixed(2)}px, ${st.ty.toFixed(2)}px, 0) scale(${st.scale.toFixed(3)})`;
    }
  }
  const isZoomed = st.scale > 1.001;
  plyrRoot.classList.toggle('is-video-zoomed', isZoomed);
  plyrRoot.classList.toggle('is-zoom-mode-active', st.zoomMode || isZoomed);
  updateZoomUI(plyrRoot, st);
}

function updateZoomUI(plyrRoot, st) {
  const t = getT();
  const isZoomed = st.scale > 1.001;
  const scaleLabel = `${Number(st.scale.toFixed(2))}x`;

  const btn = plyrRoot.querySelector('.plyr-zoom-btn');
  if (btn) {
    btn.classList.toggle('is-active', st.zoomMode || isZoomed);
    const labelSpan = btn.querySelector('.plyr-zoom-btn-label');
    if (labelSpan) {
      labelSpan.textContent = isZoomed ? scaleLabel : '';
    }
  }

  const popover = plyrRoot.querySelector('.plyr-zoom-popover');
  if (popover) {
    popover.querySelectorAll('.plyr-zoom-option[data-zoom]').forEach(opt => {
      const z = Number(opt.getAttribute('data-zoom'));
      opt.classList.toggle('active', Math.abs(z - st.scale) < 0.05);
    });
  }

  let badge = plyrRoot.querySelector('.player-zoom-badge');
  if (isZoomed || st.zoomMode) {
    if (!badge) {
      badge = document.createElement('div');
      badge.className = 'player-zoom-badge';
      badge.innerHTML = `
        <span class="player-zoom-badge-val"></span>
        <button type="button" class="player-zoom-badge-reset" title="${t.player_zoom_reset || 'Sıfırla'}">${t.player_zoom_reset || 'Sıfırla'}</button>
      `;
      badge.querySelector('.player-zoom-badge-reset')?.addEventListener('click', (ev) => {
        ev.stopPropagation();
        resetVideoZoom(plyrRoot);
      });
      plyrRoot.appendChild(badge);
    }
    const valEl = badge.querySelector('.player-zoom-badge-val');
    if (valEl) {
      const dragHint = isZoomed ? ` • ${t.player_zoom_drag_hint || 'Sürükle'}` : ` • ${t.player_zoom_wheel_hint || 'Tekerlek ile Yakınlaştır'}`;
      valEl.textContent = `🔍 ${scaleLabel}${dragHint}`;
    }
    badge.classList.add('visible');
  } else if (badge) {
    badge.classList.remove('visible');
  }
}

/**
 * Belirli bir ekran noktasına (clientX, clientY) odaklanarak yakınlaştırma/uzaklaştırma uygular.
 */
export function setVideoZoomAtPoint(containerEl, newScale, clientX = null, clientY = null) {
  const plyrRoot = resolvePlyrRoot(containerEl);
  if (!plyrRoot) return;
  const st = getOrCreateState(plyrRoot);
  const wrapper = plyrRoot.querySelector('.plyr__video-wrapper') || plyrRoot;
  const rect = wrapper.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return;

  const clampedScale = Math.max(MIN_ZOOM_SCALE, Math.min(MAX_ZOOM_SCALE, Number(newScale)));
  if (clampedScale <= 1.01) {
    st.scale = 1;
    st.tx = 0;
    st.ty = 0;
    applyTransform(plyrRoot, st);
    return;
  }

  const focalX = (clientX !== null && Number.isFinite(clientX))
    ? Math.max(0, Math.min(rect.width, clientX - rect.left))
    : rect.width / 2;
  const focalY = (clientY !== null && Number.isFinite(clientY))
    ? Math.max(0, Math.min(rect.height, clientY - rect.top))
    : rect.height / 2;

  const contentX = (focalX - st.tx) / st.scale;
  const contentY = (focalY - st.ty) / st.scale;

  const rawTx = focalX - contentX * clampedScale;
  const rawTy = focalY - contentY * clampedScale;
  const clamped = clampPan(rawTx, rawTy, clampedScale, rect.width, rect.height);

  st.scale = clampedScale;
  st.tx = clamped.tx;
  st.ty = clamped.ty;
  applyTransform(plyrRoot, st);
}

export function resetVideoZoom(containerEl = null) {
  const roots = containerEl
    ? [resolvePlyrRoot(containerEl)].filter(Boolean)
    : Array.from(document.querySelectorAll('.plyr'));
  roots.forEach(plyrRoot => {
    const st = containerStates.get(plyrRoot);
    if (!st) return;
    st.scale = 1;
    st.tx = 0;
    st.ty = 0;
    st.zoomMode = false;
    st.isDragging = false;
    st.wasDragging = false;
    applyTransform(plyrRoot, st);
  });
}

export function isVideoZoomActive(containerEl = null) {
  const plyrRoot = resolvePlyrRoot(containerEl) || document.querySelector('#player-modal:not(.hidden) .plyr, #downloaded-inline-player-container:not(.hidden) .plyr');
  if (!plyrRoot) return false;
  const st = containerStates.get(plyrRoot);
  return Boolean(st && (st.scale > 1.001 || st.zoomMode));
}

export function toggleVideoZoomShortcut(containerEl = null) {
  const plyrRoot = resolvePlyrRoot(containerEl)
    || document.querySelector('#player-modal:not(.hidden) .plyr, #downloaded-inline-player-container:not(.hidden) .plyr, #webstream-player-mount .plyr');
  if (!plyrRoot) return false;
  const st = getOrCreateState(plyrRoot);
  const t = getT();

  if (st.scale > 1.001 || st.zoomMode) {
    resetVideoZoom(plyrRoot);
    if (typeof window.showActionToast === 'function') {
      window.showActionToast('zoom-out', t.player_zoom_mode_off || 'Zoom: 1x', 1300);
    }
    return false;
  }

  st.zoomMode = true;
  setVideoZoomAtPoint(plyrRoot, 2.0);
  if (typeof window.showActionToast === 'function') {
    window.showActionToast('zoom-in', `${t.player_zoom_mode_on || 'Zoom'}: 2x`, 1400);
  }
  return true;
}

/**
 * Fare tekerleği olayının zoom tarafından tüketilip tüketilmeyeceğini kontrol eder.
 * Ctrl basılıyken veya zoom modu / yakınlaştırma aktifken true döner (ses değişimini engeller).
 */
export function handleVideoZoomWheel(e, containerEl) {
  const plyrRoot = resolvePlyrRoot(containerEl);
  if (!plyrRoot) return false;
  const st = getOrCreateState(plyrRoot);

  const shouldZoom = e.ctrlKey || st.zoomMode || st.scale > 1.001;
  if (!shouldZoom) return false;

  e.preventDefault();
  e.stopPropagation();

  const factor = e.deltaY < 0 ? 1.18 : 1 / 1.18;
  const nextScale = st.scale * factor;
  setVideoZoomAtPoint(plyrRoot, nextScale, e.clientX, e.clientY);
  return true;
}

/**
 * object-fit: contain ve CSS zoom/pan dikkate alınarak gerçek video piksel kırpma dikdörtgenini hesaplar.
 * @param {HTMLVideoElement} videoEl
 * @param {HTMLElement|null} [plyrRootOverride=null]
 * @returns {{ sx: number, sy: number, sw: number, sh: number, nx: number, ny: number, nw: number, nh: number } | null}
 */
export function getVideoZoomCropRect(videoEl, plyrRootOverride = null) {
  if (!videoEl || !videoEl.videoWidth || !videoEl.videoHeight) return null;
  const plyrRoot = plyrRootOverride || resolvePlyrRoot(videoEl);
  if (!plyrRoot) return null;
  const st = containerStates.get(plyrRoot);
  if (!st || st.scale <= 1.001) return null;

  const wrapper = plyrRoot.querySelector('.plyr__video-wrapper') || plyrRoot;
  const cw = wrapper.clientWidth;
  const ch = wrapper.clientHeight;
  if (cw <= 0 || ch <= 0) return null;

  const vw = videoEl.videoWidth;
  const vh = videoEl.videoHeight;

  // object-fit: contain altındaki gerçek çizilmiş video alanı (letterbox/pillarbox hariç)
  const videoRatio = vw / vh;
  const boxRatio = cw / ch;
  let drawW = cw;
  let drawH = ch;
  let drawX = 0;
  let drawY = 0;
  if (videoRatio > boxRatio) {
    drawH = cw / videoRatio;
    drawY = (ch - drawH) / 2;
  } else {
    drawW = ch * videoRatio;
    drawX = (cw - drawW) / 2;
  }

  // Wrapper'ın görünür alanı [0..cw, 0..ch], video koordinat sisteminde:
  const visLeft = (-st.tx) / st.scale;
  const visTop = (-st.ty) / st.scale;
  const visRight = (cw - st.tx) / st.scale;
  const visBottom = (ch - st.ty) / st.scale;

  // Video çizim alanıyla kesiştir
  const cropLeft = Math.max(drawX, visLeft);
  const cropTop = Math.max(drawY, visTop);
  const cropRight = Math.min(drawX + drawW, visRight);
  const cropBottom = Math.min(drawY + drawH, visBottom);

  if (cropRight <= cropLeft || cropBottom <= cropTop) return null;

  const nx = Math.max(0, Math.min(1, (cropLeft - drawX) / drawW));
  const ny = Math.max(0, Math.min(1, (cropTop - drawY) / drawH));
  const nw = Math.max(0.01, Math.min(1 - nx, (cropRight - cropLeft) / drawW));
  const nh = Math.max(0.01, Math.min(1 - ny, (cropBottom - cropTop) / drawH));

  return {
    sx: Math.round(nx * vw),
    sy: Math.round(ny * vh),
    sw: Math.max(1, Math.round(nw * vw)),
    sh: Math.max(1, Math.round(nh * vh)),
    nx,
    ny,
    nw,
    nh
  };
}

function bindPanListeners(plyrRoot, st) {
  if (plyrRoot._boundZoomPan) return;
  plyrRoot._boundZoomPan = true;

  const wrapper = plyrRoot.querySelector('.plyr__video-wrapper') || plyrRoot;

  wrapper.addEventListener('mousedown', (e) => {
    if (e.button !== 0 || st.scale <= 1.001) return;
    if (e.target.closest('.plyr__controls') || e.target.closest('button')) return;
    st.isDragging = true;
    st.wasDragging = false;
    st.dragStartX = e.clientX;
    st.dragStartY = e.clientY;
    st.startTx = st.tx;
    st.startTy = st.ty;
    plyrRoot.classList.add('is-zoom-panning');
    e.preventDefault();
  });

  window.addEventListener('mousemove', (e) => {
    if (!st.isDragging) return;
    const dx = e.clientX - st.dragStartX;
    const dy = e.clientY - st.dragStartY;
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
      st.wasDragging = true;
    }
    const rect = wrapper.getBoundingClientRect();
    const clamped = clampPan(st.startTx + dx, st.startTy + dy, st.scale, rect.width, rect.height);
    st.tx = clamped.tx;
    st.ty = clamped.ty;
    applyTransform(plyrRoot, st);
  });

  window.addEventListener('mouseup', () => {
    if (!st.isDragging) return;
    st.isDragging = false;
    plyrRoot.classList.remove('is-zoom-panning');
    if (st.wasDragging) {
      setTimeout(() => { st.wasDragging = false; }, 60);
    }
  });

  // Kaydırma sonrası Plyr'ın tıklamayla oynat/duraklat yapmasını engelle
  wrapper.addEventListener('click', (e) => {
    if (st.wasDragging) {
      e.preventDefault();
      e.stopPropagation();
      st.wasDragging = false;
    }
  }, true);

  // Sağ tık ile hızlıca 1x sıfırlama (zoom aktifken)
  wrapper.addEventListener('contextmenu', (e) => {
    if (st.scale > 1.001) {
      e.preventDefault();
      resetVideoZoom(plyrRoot);
    }
  });
}

/**
 * Plyr kontrol çubuğuna Büyüteç (Zoom) butonu ve hızlı seviye menüsünü ekler.
 */
export function injectZoomControlToPlyr(plyrInst, containerEl = null) {
  const plyrRoot = resolvePlyrRoot(containerEl);
  if (!plyrRoot) return;
  const controls = plyrRoot.querySelector('.plyr__controls');
  if (!controls) return;

  const st = getOrCreateState(plyrRoot);
  st.plyrInst = plyrInst;
  bindPanListeners(plyrRoot, st);

  if (controls.querySelector('.plyr-zoom-control-wrap')) return;

  const t = getT();
  const wrap = document.createElement('div');
  wrap.className = 'plyr-zoom-control-wrap';

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'plyr__control plyr-zoom-btn';
  btn.setAttribute('aria-label', t.player_zoom_btn_title || 'Videoyu Yakınlaştır (Zoom)');
  btn.title = t.player_zoom_btn_title || 'Videoyu Yakınlaştır (Zoom) • Z';
  btn.innerHTML = `<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg><span class="plyr-zoom-btn-label"></span>`;

  const popover = document.createElement('div');
  popover.className = 'plyr-zoom-popover';
  popover.setAttribute('role', 'menu');

  ZOOM_LEVELS.forEach(lvl => {
    const opt = document.createElement('button');
    opt.type = 'button';
    opt.className = 'plyr-zoom-option';
    opt.setAttribute('data-zoom', String(lvl));
    opt.textContent = lvl === 1 ? (t.player_zoom_reset || '1x (Sıfırla)') : `${lvl}x`;
    opt.addEventListener('click', (ev) => {
      ev.stopPropagation();
      if (lvl === 1) {
        resetVideoZoom(plyrRoot);
      } else {
        st.zoomMode = true;
        setVideoZoomAtPoint(plyrRoot, lvl);
      }
      wrap.classList.remove('open');
    });
    popover.appendChild(opt);
  });

  btn.addEventListener('click', (ev) => {
    ev.stopPropagation();
    toggleVideoZoomShortcut(plyrRoot);
  });

  wrap.appendChild(popover);
  wrap.appendChild(btn);

  const anchor = controls.querySelector('.plyr-screenshot-btn')
    || controls.querySelector('.plyr__menu')
    || controls.querySelector('[data-plyr="captions"]')
    || controls.querySelector('[data-plyr="fullscreen"]');
  if (anchor && anchor.parentNode === controls) {
    controls.insertBefore(wrap, anchor);
  } else {
    controls.appendChild(wrap);
  }

  updateZoomUI(plyrRoot, st);
}

if (typeof window !== 'undefined') {
  window.injectZoomControlToPlyr = injectZoomControlToPlyr;
  window.handleVideoZoomWheel = handleVideoZoomWheel;
  window.toggleVideoZoomShortcut = toggleVideoZoomShortcut;
  window.resetVideoZoom = resetVideoZoom;
  window.isVideoZoomActive = isVideoZoomActive;
  window.getVideoZoomCropRect = getVideoZoomCropRect;
}
