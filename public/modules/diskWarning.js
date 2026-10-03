/**
 * HaYTooL YouTube Downloader - Temp Disk Uyarı Modülü
 *
 * Sorumluluklar:
 *   - checkTempSpace()   : Temp sürücüsünün boş alanını sorgular, düşükse uyarı bannerı gösterir
 *   - showDiskWarning()  : Kapatılabilir, i18n destekli uyarı bannerını oluşturur
 *   - hideDiskWarning()  : Banner'ı kaldırır
 *
 * Neden: yt-dlp.exe her çalışışında Temp'e açılır; sürücü dolarsa hiç başlamaz.
 *
 * Yapımcı: HaYTo
 * İletişim: korazhayto@gmail.com
 */

import { translations } from '../utils/i18n.js';

const BANNER_ID = 'disk-warning-banner';

function getText() {
  const lang = window.localDb?.settings?.lang || localStorage.getItem('haytool_user_lang') || 'tr';
  return translations[lang] || translations.tr;
}

/**
 * Temp sürücüsü dolu uyarı bannerını gösterir.
 * @param {{freeMB: number, minMB: number, drive: string}} info
 */
export function showDiskWarning(info = {}) {
  const t = getText();
  const body = (t.disk_warn_body || '')
    .replace('{drive}', info.drive ? `${info.drive}:` : 'C:')
    .replace('{free}', String(info.freeMB ?? 0))
    .replace('{min}', String(info.minMB ?? 500));

  let banner = document.getElementById(BANNER_ID);
  if (!banner) {
    banner = document.createElement('div');
    banner.id = BANNER_ID;
    banner.className = 'disk-warning-banner';
    banner.setAttribute('role', 'alert');
    document.body.prepend(banner);
  }

  banner.innerHTML = '';

  const text = document.createElement('div');
  text.className = 'disk-warning-text';
  const title = document.createElement('strong');
  title.textContent = t.disk_warn_title || '';
  const desc = document.createElement('span');
  desc.textContent = `${body} ${t.disk_warn_steps || ''}`;
  text.append(title, desc);

  const actions = document.createElement('div');
  actions.className = 'disk-warning-actions';

  const openBtn = document.createElement('button');
  openBtn.id = 'disk-warning-open-btn';
  openBtn.type = 'button';
  openBtn.className = 'disk-warning-btn';
  openBtn.textContent = t.disk_warn_open || '';
  openBtn.addEventListener('click', () => {
    if (typeof window.openTempFolder === 'function') window.openTempFolder();
  });

  const closeBtn = document.createElement('button');
  closeBtn.id = 'disk-warning-close-btn';
  closeBtn.type = 'button';
  closeBtn.className = 'disk-warning-btn disk-warning-btn-ghost';
  closeBtn.textContent = t.disk_warn_dismiss || '';
  closeBtn.addEventListener('click', hideDiskWarning);

  actions.append(openBtn, closeBtn);
  banner.append(text, actions);
}

/** Uyarı bannerını kaldırır. */
export function hideDiskWarning() {
  document.getElementById(BANNER_ID)?.remove();
}

/**
 * Temp boş alanını sorgular; eşik altındaysa banner gösterir, değilse gizler.
 * @returns {Promise<void>}
 */
export async function checkTempSpace() {
  try {
    const res = await fetch('/api/downloader/temp-space');
    const info = await res.json();
    if (info.success && info.low) {
      showDiskWarning(info);
    } else {
      hideDiskWarning();
    }
  } catch (e) {
    // Kasıtlı sessiz: Sunucu erişilemezse banner durumu değişmez
  }
}

window.checkTempSpace = checkTempSpace;
