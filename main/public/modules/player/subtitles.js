/**
 * HaYTooL YT Downloader - Subtitles Module
 * public/modules/player/subtitles.js
 * 
 * Video altyazılarının çekilmesi, oynatıcıya eklenmesi, 
 * yapay zeka / servis destekli altyazı çeviri modalı ve 
 * altyazı görsel stillerinin (renk, şeffaflık, boyut) yönetimi.
 */

import { showToast } from '../../components/toast.js';
import { translations } from '../../utils/i18n.js';

// Modül düzeyi durum (State)
let currentSubtitles = [];

/**
 * Mevcut video için yüklü altyazı listesini döner.
 */
export function getCurrentSubtitles() {
  return currentSubtitles;
}

/**
 * Mevcut video altyazı listesini günceller veya sıfırlar.
 */
export function setCurrentSubtitles(subs = []) {
  currentSubtitles = Array.isArray(subs) ? subs : [];
  return currentSubtitles;
}

/**
 * Belirtilen dil koduna göre kullanıcı dostu isim döndürür.
 * @param {string} code Dil kodu (tr, en, es vb.)
 */
export function getLangName(code) {
  if (!code) return 'Bilinmeyen Dil / Unknown';
  const map = {
    tr: 'Türkçe (TR)',
    en: 'English (EN)',
    es: 'Español (ES)',
    de: 'Deutsch (DE)',
    pt: 'Português (PT)',
    ar: 'العربية (AR)',
    ru: 'Русский (RU)',
    fr: 'Français (FR)',
    it: 'Italiano (IT)',
    ja: '日本語 (JA)',
    zh: '中文 (ZH)'
  };
  const codeLower = String(code).toLowerCase();
  return map[codeLower] || String(code).toUpperCase();
}

/**
 * Oynatıcı video elementine altyazı track elemanlarını ekler / günceller.
 * @param {Array} subs Altyazı objeleri dizisi [{ label, lang, url, ext }]
 * @param {HTMLMediaElement|null} targetPlayerEl Hedef video elemanı (opsiyonel)
 * @param {Object} playerInstance Plyr oynatıcı nesnesi (opsiyonel)
 */
export function applySubtitlesToPlayer(subs, targetPlayerEl = null, playerInstance = null) {
  if (!subs || subs.length === 0) return;
  const playerEl = targetPlayerEl || document.getElementById('embedded-video-player');
  if (!playerEl) return;

  // Mevcut track etiketlerini temizle
  const oldTracks = playerEl.querySelectorAll('track');
  oldTracks.forEach(t => t.remove());

  const userPrefLang = (window.localDb?.settings && window.localDb.settings.lang) || 'tr';

  subs.forEach(sub => {
    const track = document.createElement('track');
    track.kind = 'subtitles';
    track.label = sub.label;
    track.srclang = sub.lang;
    track.src = sub.url;

    const isDefault = (sub.lang.startsWith(userPrefLang)) ||
                      (!subs.some(s => s.lang.startsWith(userPrefLang)) && sub.lang.startsWith('en')) ||
                      (!subs.some(s => s.lang.startsWith(userPrefLang) || s.lang.startsWith('en')) && sub === subs[0]);

    if (isDefault) {
      track.default = true;
    }
    playerEl.appendChild(track);
  });

  const pInst = playerInstance || window.videoPlayerInstance;
  if (pInst) {
    try {
      if (pInst.elements?.container) {
        // Plyr'ın altyazıları yeniden yapılandırmasını sağla
        if (typeof pInst.toggleCaptions === 'function' && subs.length > 0) {
          if (pInst.captions && !pInst.captions.active) {
            pInst.captions.active = true;
          }
        }
      }
    } catch (e) {}
  }
}

/**
 * Sunucudan videoya ait altyazıları asenkron çeker.
 * @param {string} videoId Video ID
 * @returns {Promise<Array>}
 */
export async function fetchVideoSubtitles(videoId) {
  if (!videoId) return [];
  try {
    const res = await fetch(`/api/video/${videoId}/subtitles`);
    const data = await res.json();
    if (data.success && Array.isArray(data.subtitles)) {
      currentSubtitles = data.subtitles;
      return currentSubtitles;
    }
    return [];
  } catch (err) {
    console.warn('[Subtitles] Fetch error:', err);
    return [];
  }
}

/**
 * Altyazı çeviri modalını açar ve çeviri işlemini yürütür.
 * @param {string} videoId
 * @param {Array} availableSubs
 * @param {Object} options { playerContainer, onComplete }
 */
export async function openSubtitleTranslateModal(videoId, availableSubs = null, options = {}) {
  try {
    const localDb = window.localDb || {};
    const lang = localDb.settings?.lang || window.currentLang || 'tr';
    const t = translations[lang] || translations.tr;

    let subs = availableSubs;
    // Eğer parametre olarak gelmediyse veya taze çekim isteniyorsa
    if (!subs) {
      try {
        subs = await fetchVideoSubtitles(videoId);
        applySubtitlesToPlayer(subs);
      } catch (e) {
        console.warn('[Translate Modal] Sub fetch error:', e);
        subs = currentSubtitles || [];
      }
    }

    // Modal DOM elemanını oluştur
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = 'translate-sub-modal';
    modal.style.zIndex = '15000';

    let modalHtml = `
      <div class="modal-content" style="border-radius: 12px; padding: 24px; box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
        <div class="modal-header">
          <h3>${t.modal_translate_title || 'Altyazı Çevirisi'}</h3>
          <button class="modal-close-btn" id="close-translate-modal-btn">
            <i data-lucide="x" style="width: 18px; height: 18px;"></i>
          </button>
        </div>
        <div class="modal-body">
    `;

    if (!subs || subs.length === 0) {
      modalHtml += `
        <div style="text-align: center; padding: 12px; color: var(--accent-red); font-size: 0.9rem;">
          <i data-lucide="alert-triangle" style="width: 32px; height: 32px; margin-bottom: 8px; stroke: var(--accent-red); display: inline-block;"></i>
          <div>${t.modal_translate_no_subs || 'Bu video için indirilmiş altyazı bulunamadı. Çeviri yapabilmek için en az bir altyazı dosyası indirilmiş olmalıdır.'}</div>
        </div>
      `;
    } else {
      modalHtml += `
        <div class="form-group" style="margin-bottom: 16px;">
          <label style="display: block; font-size: 0.85rem; color: var(--text-muted); margin-bottom: 6px;">
            ${t.modal_translate_source || 'Çevrilecek Altyazı (Kaynak)'}
          </label>
          <select id="translate-source-lang" class="custom-select-trigger" style="width: 100%; height: 40px; background: var(--bg-sidebar); border: 1px solid var(--border-color); color: var(--text-main); border-radius: 8px; padding: 0 12px; outline: none; font-size: 0.9rem;">
            ${subs.map(s => {
              const sLang = s && s.lang ? s.lang : '';
              const sExt = s && s.ext ? String(s.ext).toUpperCase() : 'SRT';
              return `<option value="${sLang}">${getLangName(sLang)} (${sExt})</option>`;
            }).join('')}
          </select>
        </div>
        <div class="form-group" style="margin-bottom: 24px;">
          <label style="display: block; font-size: 0.85rem; color: var(--text-muted); margin-bottom: 6px;">
            ${t.modal_translate_target || 'Hedef Dil'}
          </label>
          <select id="translate-target-lang" class="custom-select-trigger" style="width: 100%; height: 40px; background: var(--bg-sidebar); border: 1px solid var(--border-color); color: var(--text-main); border-radius: 8px; padding: 0 12px; outline: none; font-size: 0.9rem;">
            <option value="tr" ${lang === 'tr' ? 'selected' : ''}>Türkçe (TR)</option>
            <option value="en" ${lang === 'en' ? 'selected' : ''}>English (EN)</option>
            <option value="es" ${lang === 'es' ? 'selected' : ''}>Español (ES)</option>
            <option value="de" ${lang === 'de' ? 'selected' : ''}>Deutsch (DE)</option>
            <option value="pt" ${lang === 'pt' ? 'selected' : ''}>Português (PT)</option>
            <option value="ar" ${lang === 'ar' ? 'selected' : ''}>العربية (AR)</option>
            <option value="ru" ${lang === 'ru' ? 'selected' : ''}>Русский (RU)</option>
            <option value="fr">Français (FR)</option>
            <option value="it">Italiano (IT)</option>
            <option value="ja">日本語 (JA)</option>
            <option value="zh">中文 (ZH)</option>
          </select>
        </div>
      `;
    }

    modalHtml += `
        </div>
        <div class="modal-actions" style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 20px;">
          <button class="btn btn-secondary" id="translate-modal-cancel" style="padding: 8px 16px; border-radius: 8px; font-size: 0.85rem; cursor: pointer; background: rgba(255,255,255,0.05); border: 1px solid var(--border-color); color: var(--text-main);">
            ${t.modal_cancel_btn || 'İptal'}
          </button>
          ${subs && subs.length > 0 ? `
            <button class="btn btn-primary" id="translate-modal-submit" style="padding: 8px 20px; border-radius: 8px; font-size: 0.85rem; cursor: pointer; font-weight: 600; background: linear-gradient(135deg, var(--accent-primary), var(--accent-secondary)); color: white; border: none;">
              ${t.btn_translate_action || 'Çevir'}
            </button>
          ` : ''}
        </div>
      </div>
    `;

    modal.innerHTML = modalHtml;
    document.body.appendChild(modal);

    try {
      if (window.lucide && typeof window.lucide.createIcons === 'function') {
        window.lucide.createIcons();
      }
    } catch (e) {
      console.warn("Lucide icons rendering failed inside modal:", e);
    }

    const closeModal = () => {
      if (modal && modal.parentNode) {
        modal.parentNode.removeChild(modal);
      }
    };

    const closeBtn = document.getElementById('close-translate-modal-btn');
    if (closeBtn) closeBtn.onclick = closeModal;

    const cancelBtn = document.getElementById('translate-modal-cancel');
    if (cancelBtn) cancelBtn.onclick = closeModal;

    const submitBtn = document.getElementById('translate-modal-submit');
    if (submitBtn) {
      submitBtn.onclick = async () => {
        try {
          const fromLang = document.getElementById('translate-source-lang')?.value;
          const toLang = document.getElementById('translate-target-lang')?.value;

          if (fromLang === toLang) {
            showToast(lang === 'en' ? 'Source and target languages cannot be the same.' : 'Kaynak ve hedef dil aynı olamaz.', 'error');
            return;
          }

          closeModal();

          const btnTranslate = document.getElementById('inline-btn-translate-sub');
          if (btnTranslate) {
            btnTranslate.disabled = true;
            btnTranslate.style.opacity = '0.5';
          }
          const icon = btnTranslate?.querySelector('i');
          if (icon) icon.style.animation = 'spin 1s linear infinite';

          showToast(lang === 'en' ? 'Translating subtitles...' : 'Altyazılar çevriliyor...', 'info');

          // Yükleme katmanı (overlay)
          const overlay = document.createElement('div');
          overlay.className = 'subtitle-translation-overlay';
          overlay.innerHTML = `
            <div class="subtitle-translation-spinner"></div>
            <div style="font-weight: 600; font-size: 1.15rem; margin-bottom: 6px; font-family: 'Outfit', sans-serif;">
              ${t.overlay_translating_title || 'Altyazı Çeviriliyor...'}
            </div>
            <div style="font-size: 0.85rem; opacity: 0.8; color: #a1a1aa; max-width: 80%; text-align: center; line-height: 1.4;">
              ${t.overlay_translating_desc || 'Lütfen bekleyin, altyazı çevirisi yapılıyor...'}
            </div>
          `;
          const targetContainer = options.playerContainer || document.getElementById('inline-player-body');
          if (targetContainer) {
            targetContainer.appendChild(overlay);
          }

          try {
            const res = await fetch(`/api/video/${videoId}/translate-subtitle`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ fromLang, toLang })
            });
            const data = await res.json();
            if (data.success) {
              showToast(lang === 'en' ? 'Subtitles successfully translated!' : 'Altyazılar başarıyla çevrildi!', 'success');
              if (typeof options.onComplete === 'function') {
                options.onComplete();
              } else if (typeof window.playVideoEmbedded === 'function') {
                const curTime = window.videoPlayerInstance ? window.videoPlayerInstance.currentTime : null;
                window.playVideoEmbedded(videoId, curTime);
              }
            } else {
              showToast(data.error || 'Translation failed.', 'error');
            }
          } catch (err) {
            console.error('Subtitle translation error:', err);
            showToast('Translation error occurred.', 'error');
          } finally {
            if (btnTranslate) {
              btnTranslate.disabled = false;
              btnTranslate.style.opacity = '1';
            }
            if (icon) icon.style.animation = '';
            if (overlay && overlay.parentNode) {
              overlay.parentNode.removeChild(overlay);
            }
          }
        } catch (submitErr) {
          console.error("Submit translation click error:", submitErr);
          showToast("Hata: " + submitErr.message, "error");
        }
      };
    }
  } catch (clickErr) {
    console.error("Translate click error:", clickErr);
    showToast(window.localDb?.settings?.lang === 'en' ? 'An error occurred while opening the translation tool.' : 'Çeviri aracı açılırken bir hata oluştu.', 'error');
  }
}

/**
 * Altyazı renk, opaklık ve boyut kontrollerini başlatır ve dinleyicilerini bağlar.
 */
export function initSubtitleStyleControls() {
  const localDb = window.localDb || { settings: {} };
  if (!localDb.settings) localDb.settings = {};

  // 1. Altyazı Rengi
  const inlineSubColor = document.getElementById('inline-subtitle-color');
  if (inlineSubColor) {
    inlineSubColor.value = localDb.settings.subtitleColor || '#ffffff';
    inlineSubColor.onchange = async (e) => {
      const val = e.target.value;
      localDb.settings.subtitleColor = val;
      document.documentElement.style.setProperty('--subtitle-color', val);
      const globalDropdown = document.getElementById('settings-subtitle-color');
      if (globalDropdown) globalDropdown.value = val;

      if (window.videoPlayerInstance && typeof window.videoPlayerInstance.subtitle?.style === 'function') {
        window.videoPlayerInstance.subtitle.style({ color: val });
      }

      try {
        await fetch('/api/settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(localDb.settings)
        });
      } catch (err) {
        console.error('subtitleColor save error:', err);
      }
    };
  }

  // 2. Altyazı Arka Plan Opaklığı
  const inlineSubOpacity = document.getElementById('inline-subtitle-opacity');
  if (inlineSubOpacity) {
    inlineSubOpacity.value = localDb.settings.subtitleOpacity || '0.7';
    inlineSubOpacity.onchange = async (e) => {
      const val = e.target.value;
      localDb.settings.subtitleOpacity = val;
      document.documentElement.style.setProperty('--subtitle-bg-opacity', val);

      if (window.videoPlayerInstance && typeof window.videoPlayerInstance.subtitle?.style === 'function') {
        window.videoPlayerInstance.subtitle.style({
          backgroundColor: `rgba(0, 0, 0, ${val})`
        });
      }

      try {
        await fetch('/api/settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(localDb.settings)
        });
      } catch (err) {
        console.error('subtitleOpacity save error:', err);
      }
    };
  }

  // 3. Altyazı Yazı Tipi Boyutu
  const inlineSubSize = document.getElementById('inline-subtitle-size');
  if (inlineSubSize) {
    inlineSubSize.value = localDb.settings.subtitleSize || '26px';
    inlineSubSize.onchange = async (e) => {
      const val = e.target.value;
      localDb.settings.subtitleSize = val;
      document.documentElement.style.setProperty('--subtitle-font-size', val);

      if (window.videoPlayerInstance && typeof window.videoPlayerInstance.subtitle?.style === 'function') {
        window.videoPlayerInstance.subtitle.style({
          fontSize: val
        });
      }

      try {
        await fetch('/api/settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(localDb.settings)
        });
      } catch (err) {
        console.error('subtitleSize save error:', err);
      }
    };
  }
}
