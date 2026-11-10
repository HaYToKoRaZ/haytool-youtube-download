/**
 * Sinema Modu (Theater Mode) Modülü - HaYTooL YouTube Downloader
 *
 * Yapımcı: HaYTo
 * Açıklama: Yerleşik video oynatıcıda YouTube tarzı Sinema Modu (Geniş Ekran)
 *           özelliğini yönetir. Video genişletilir, yan indirme listesi aşağıya alınır.
 */

const STORAGE_KEY = 'haytool_theater_mode';

export function isTheaterMode() {
  const container = document.getElementById('downloaded-inline-player-container');
  return container ? container.classList.contains('theater-mode') : false;
}

export function updateTheaterUI(active) {
  const plyrBtn = document.getElementById('plyr-btn-theater');

  const lang = window.localDb?.settings?.lang || 'tr';
  const translations = window.translations?.[lang] || window.translations?.tr || {};

  const titleText = active
    ? (translations.inline_btn_theater_default_title || 'Varsayılan Görünüm (t)')
    : (translations.inline_btn_theater_title || 'Sinema Modu (t)');

  const labelText = active
    ? (translations.inline_btn_theater_default || 'Varsayılan Görünüm')
    : (translations.inline_btn_theater || 'Sinema Modu');

  if (plyrBtn) {
    plyrBtn.title = titleText;
    plyrBtn.setAttribute('aria-label', titleText);
    const srOnly = plyrBtn.querySelector('.plyr__sr-only');
    if (srOnly) srOnly.textContent = labelText;
    plyrBtn.innerHTML = active
      ? `
        <svg viewBox="0 0 24 24" style="width: 18px; height: 18px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round;">
          <rect x="5" y="6" width="14" height="12" rx="2"></rect>
          <rect x="7" y="8" width="10" height="8" rx="1" style="fill: currentColor; opacity: 0.35;"></rect>
        </svg>
        <span class="plyr__sr-only">${labelText}</span>
      `
      : `
        <svg viewBox="0 0 24 24" style="width: 18px; height: 18px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round;">
          <rect x="2" y="5" width="20" height="14" rx="2"></rect>
          <rect x="6" y="8" width="12" height="8" rx="1" style="fill: currentColor; opacity: 0.25;"></rect>
        </svg>
        <span class="plyr__sr-only">${labelText}</span>
      `;
  }
}

export function toggleTheaterMode(forceState) {
  const container = document.getElementById('downloaded-inline-player-container');
  if (!container) return;

  const willBeActive = (forceState !== undefined)
    ? Boolean(forceState)
    : !container.classList.contains('theater-mode');

  if (willBeActive) {
    container.classList.add('theater-mode');
  } else {
    container.classList.remove('theater-mode');
  }

  try {
    localStorage.setItem(STORAGE_KEY, willBeActive ? '1' : '0');
  } catch (_) {}

  updateTheaterUI(willBeActive);

  // Kısa HUD bildirimi göster
  if (typeof window.showPlayerTransientOverlay === 'function') {
    const lang = window.localDb?.settings?.lang || 'tr';
    const translations = window.translations?.[lang] || window.translations?.tr || {};
    const text = willBeActive
      ? (translations.inline_btn_theater || 'Sinema Modu')
      : (translations.inline_btn_theater_default || 'Varsayılan Görünüm');
    const iconName = willBeActive ? 'rectangle-horizontal' : 'shrink';
    window.showPlayerTransientOverlay(`
      <div class="player-transient-card">
        <i data-lucide="${iconName}" style="width:30px;height:30px;color:var(--accent-primary);"></i>
        <div class="transient-title">${text}</div>
      </div>
    `, 800);
    try { window.lucide?.createIcons(); } catch(_) {}
  }
}

export function injectTheaterModeButtonToPlyr() {
  const container = document.getElementById('downloaded-inline-player-container');
  if (!container) return;
  const plyrControls = container.querySelector('.plyr__controls');
  if (!plyrControls) return;
  if (plyrControls.querySelector('#plyr-btn-theater')) return;

  const fullscreenBtn = plyrControls.querySelector('[data-plyr="fullscreen"]');
  const theaterBtn = document.createElement('button');
  theaterBtn.type = 'button';
  theaterBtn.id = 'plyr-btn-theater';
  theaterBtn.className = 'plyr__control plyr__control--theater';
  theaterBtn.setAttribute('data-plyr', 'theater');
  theaterBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleTheaterMode();
  });

  if (fullscreenBtn && fullscreenBtn.parentNode === plyrControls) {
    plyrControls.insertBefore(theaterBtn, fullscreenBtn);
  } else {
    plyrControls.appendChild(theaterBtn);
  }

  const active = container.classList.contains('theater-mode');
  updateTheaterUI(active);
}

export function initTheaterMode() {
  const container = document.getElementById('downloaded-inline-player-container');
  if (!container) return;

  let saved = false;
  try {
    saved = localStorage.getItem(STORAGE_KEY) === '1';
  } catch (_) {}

  if (saved) {
    container.classList.add('theater-mode');
  }
  updateTheaterUI(saved);
}

if (typeof window !== 'undefined') {
  window.toggleTheaterMode = toggleTheaterMode;
  window.isTheaterMode = isTheaterMode;
  window.injectTheaterModeButtonToPlyr = injectTheaterModeButtonToPlyr;
  window.initTheaterMode = initTheaterMode;
  window.updateTheaterUI = updateTheaterUI;
}
