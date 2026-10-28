/**
 * HaYTooL YouTube Downloader - Fakap (Otomatik Kanal Yedekleri) Yönetim Modülü
 *
 * Sorumluluklar:
 *   - Fakap sayfası (Araçlar/Fakap) video kartlarını listeleme, filtreleme, arama
 *   - Fakap videosunu dahili veya harici oynatıcı ile oynatma
 *   - Fakap videosunu diskten silme
 *   - Manuel Fakap taraması tetikleme
 *   - Ayarlar sayfasında Fakap ayarlarını (klasör, kalite, saklama süresi) yönetme
 *
 * Bağımlılıklar: window.localDb, showToast, window.lucide, playVideoEmbedded
 */

import { escapeHtml, formatDate } from '../utils/helpers.js';

let fakapCache = [];

/**
 * Fakap verilerini sunucudan çeker ve arayüzü günceller.
 */
export async function loadFakapVideosList() {
  const grid = document.getElementById('fakap-videos-grid');
  const emptyState = document.getElementById('fakap-videos-empty');
  const badge = document.getElementById('tools-fakap-badge');
  if (!grid) return;

  try {
    const res = await fetch('/api/fakap/list');
    const data = await res.json();
    if (!data.success) return;

    fakapCache = data.videos || [];

    // Ayarlar sayfasındaki alanları güncelle (varsa)
    updateFakapSettingsControls(data);

    // Badge güncelle
    if (badge) {
      badge.textContent = `${fakapCache.length} Video`;
    }

    renderFakapCards(fakapCache);
  } catch (err) {
    console.error('Fakap listesi yüklenemedi:', err);
  }
}
window.loadFakapVideosList = loadFakapVideosList;

/**
 * Arama ve durum filtrelerine göre Fakap kartlarını filtreler.
 */
export function filterFakapVideos() {
  const searchInput = document.getElementById('fakap-videos-search');
  const statusSelect = document.getElementById('fakap-videos-filter-status');
  const q = searchInput ? searchInput.value.trim().toLowerCase() : '';
  const status = statusSelect ? statusSelect.value : 'all';

  const filtered = fakapCache.filter(item => {
    if (status !== 'all' && item.status !== status) return false;
    if (q) {
      const matchTitle = item.title && item.title.toLowerCase().includes(q);
      const matchChannel = item.channelName && item.channelName.toLowerCase().includes(q);
      if (!matchTitle && !matchChannel) return false;
    }
    return true;
  });

  renderFakapCards(filtered);
}
window.filterFakapVideos = filterFakapVideos;

/**
 * Fakap video kartlarını DOM'a basar.
 */
function renderFakapCards(videos) {
  const grid = document.getElementById('fakap-videos-grid');
  const emptyState = document.getElementById('fakap-videos-empty');
  if (!grid) return;

  grid.innerHTML = '';

  if (!videos || videos.length === 0) {
    if (emptyState) emptyState.classList.remove('hidden');
    return;
  }
  if (emptyState) emptyState.classList.add('hidden');

  const lang = (window.localDb?.settings && window.localDb.settings.lang) || 'tr';
  const t = (window.translations && (window.translations[lang] || window.translations.tr)) || {};

  videos.forEach(item => {
    const card = document.createElement('div');
    card.className = 'video-card fakap-card';
    card.setAttribute('data-id', item.id);

    // Durum ve rozet
    let statusBadge = '';
    let actionsHtml = '';
    const isCompleted = item.status === 'completed';
    const isDownloading = item.status === 'downloading';
    const isQueued = item.status === 'queued';
    const isFailed = item.status === 'failed';

    const qualityLabel = (item.quality || '360') + 'p';

    if (isCompleted) {
      statusBadge = `<span class="status-dot-completed" title="${t.card_download_completed || 'İndirildi'}"></span>`;
      actionsHtml = `
        <button class="btn-icon btn-action-yt" onclick="event.stopPropagation(); window.open('https://www.youtube.com/watch?v=${item.originalId || String(item.id).replace(/^fakap_/, '')}', '_blank')" title="${t.btn_open_youtube || 'YouTube\'da Aç'}">
          <i data-lucide="external-link"></i>
        </button>
        <button class="btn-icon btn-action-play" onclick="playFakapVideo('${item.id}', '${escapeHtml(item.title).replace(/'/g, "\\'")}')" title="${t.card_play_video || 'Oynat'}">
          <i data-lucide="play"></i>
        </button>
        <button class="btn-icon video-action-delete" onclick="deleteFakapVideoById('${item.id}')" title="${t.btn_delete_video || 'Yedeği Sil'}" style="color:var(--accent-red);">
          <i data-lucide="trash-2"></i>
        </button>
      `;
    } else if (isDownloading) {
      const pct = Math.round(item.progress || 0);
      statusBadge = `<span class="status-pill downloading" data-fakap-pct="${item.id}" style="padding:2px 6px; font-weight:700;">${pct}%</span>`;
      actionsHtml = `
        <span style="font-size:0.75rem; color:var(--text-muted);">${item.speed || ''} ${item.eta ? 'ETA: ' + item.eta : ''}</span>
      `;
    } else if (isQueued) {
      statusBadge = `<span class="status-dot-waiting" title="Kuyrukta Bekliyor"></span>`;
      actionsHtml = `
        <button class="btn-icon video-action-delete" onclick="deleteFakapVideoById('${item.id}')" title="Kuyruktan Çıkar">
          <i data-lucide="x"></i>
        </button>
      `;
    } else if (isFailed) {
      statusBadge = `<span class="status-dot-danger" title="${escapeHtml(item.error || 'Yedekleme başarısız')}"></span>`;
      actionsHtml = `
        <button class="btn-icon video-action-delete" onclick="deleteFakapVideoById('${item.id}')" title="Kaydı Sil">
          <i data-lucide="trash-2"></i>
        </button>
      `;
    }

    // Dosya boyutu formatı
    const sizeStr = item.fileSize ? formatBytes(item.fileSize) : '';

    // Saklama bilgisi
    const retentionInfo = getFakapRetentionText(item, t);

    card.innerHTML = `
      <div class="video-thumbnail-wrapper" onclick="${isCompleted ? `playFakapVideo('${item.id}', '${escapeHtml(item.title).replace(/'/g, "\\'")}')` : ''}" style="cursor: ${isCompleted ? 'pointer' : 'default'};">
        <img class="video-thumbnail" src="/api/fakap/thumb/${item.id}" alt="${escapeHtml(item.title)}" onerror="this.src='/api/fakap/thumb/${item.id}';">
        <div class="video-quality-badge quality-360p" style="background:rgba(56,189,248,0.9);">${qualityLabel}</div>
        ${retentionInfo ? `<div class="video-duration-badge" style="background:rgba(15,23,42,0.85);">${retentionInfo}</div>` : ''}
        ${(isDownloading || isQueued) ? `
        <div class="fakap-progress-track" data-fakap-progress="${item.id}">
          <div class="fakap-progress-fill" style="width:${Math.round(item.progress || 0)}%"></div>
        </div>` : ''}
      </div>
      <div class="video-card-content">
        <div class="video-card-title-wrap">
          <h3 class="video-card-title" title="${escapeHtml(item.title)}">${escapeHtml(item.title)}</h3>
        </div>
        <div class="video-card-metadata" style="margin-top:6px;">
          <span class="video-card-channel" style="display:inline-flex; align-items:center; gap:4px; font-weight:600;">
            <i data-lucide="tv" style="width:12px;height:12px;color:var(--accent-primary);"></i>
            ${escapeHtml(item.channelName || '')}
          </span>
          <span>${formatDate(item.publishedAt || item.addedAt)}</span>
          ${sizeStr ? `<span>${sizeStr}</span>` : ''}
        </div>
        ${item.error ? `<div style="font-size:0.75rem; color:#ef4444; margin-top:4px;" title="${escapeHtml(item.error)}">${escapeHtml(item.error.slice(0, 90))}</div>` : ''}
        <div class="video-card-bottom" style="margin-top:10px;">
          <div style="display:flex; align-items:center; gap:6px;">
            ${statusBadge}
            <span style="font-size:0.75rem; color:var(--text-muted); text-transform:uppercase; font-weight:600;">${item.status}</span>
          </div>
          <div class="video-card-actions">
            ${actionsHtml}
          </div>
        </div>
      </div>
    `;

    grid.appendChild(card);
  });

  try {
    if (window.lucide && window.lucide.createIcons) {
      window.lucide.createIcons();
    }
  } catch (e) {}
}

function formatBytes(bytes) {  if (!bytes || bytes <= 0) return '';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function getFakapRetentionText(item, t) {
  const db = window.localDb || {};
  const days = parseInt(db.settings?.fakapRetentionDays, 10);
  if (!days || isNaN(days) || days <= 0) {
    return t.fakap_retention_never || 'Asla Silinmez';
  }
  if (!item.downloadedAt) return '';
  const now = Date.now();
  const downTime = new Date(item.downloadedAt).getTime();
  const passedDays = (now - downTime) / 86400000;
  const remain = Math.max(0, Math.ceil(days - passedDays));
  return `${remain} ${t.unit_days || 'Gün'}`;
}

/**
 * Fakap videosunu Plyr veya varsayılan player ile oynatır.
 */
export function playFakapVideo(id, title) {
  const streamUrl = `/api/fakap/stream/${id}`;
  if (typeof window.playCustomMediaUrl === 'function') {
    window.playCustomMediaUrl(streamUrl, title || 'Fakap Video');
  } else if (typeof window.playVideoEmbedded === 'function') {
    window.playVideoEmbedded(id);
  } else {
    window.open(streamUrl, '_blank');
  }
}
window.playFakapVideo = playFakapVideo;

/**
 * Fakap videosunu siler.
 */
export async function deleteFakapVideoById(id) {
  const lang = (window.localDb?.settings && window.localDb.settings.lang) || 'tr';
  const t = (window.translations && (window.translations[lang] || window.translations.tr)) || {};
  const confirmMsg = t.fakap_delete_confirm || 'Bu Fakap yedek kaydını ve dosyasını silmek istediğinize emin misiniz?';
  if (!confirm(confirmMsg)) return;

  try {
    const res = await fetch(`/api/fakap/video/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.success) {
      if (typeof showToast === 'function') showToast(t.fakap_delete_success || 'Yedek silindi.', 'success');
      loadFakapVideosList();
    } else {
      if (typeof showToast === 'function') showToast(data.error || 'Silinemedi.', 'error');
    }
  } catch (err) {
    if (typeof showToast === 'function') showToast('Bağlantı hatası.', 'error');
  }
}
window.deleteFakapVideoById = deleteFakapVideoById;

/**
 * Manuel Fakap taramasını tetikler.
 */
export async function triggerFakapScan() {
  const btn = document.getElementById('btn-scan-fakap');
  const lang = (window.localDb?.settings && window.localDb.settings.lang) || 'tr';
  const t = (window.translations && (window.translations[lang] || window.translations.tr)) || {};
  if (btn) btn.disabled = true;

  try {
    if (typeof showToast === 'function') showToast(t.fakap_scan_started || 'Fakap kanalları taranıyor...', 'info');
    const res = await fetch('/api/fakap/scan', { method: 'POST' });
    const data = await res.json();
    if (data.success) {
      if (typeof showToast === 'function') {
        const msg = data.inProgress 
          ? (t.fakap_scan_in_progress || 'Tarama zaten devam ediyor.')
          : `${data.found || 0} ${t.fakap_scan_found || 'yeni video kuyruğa alındı.'}`;
        showToast(msg, 'success');
      }
      setTimeout(loadFakapVideosList, 1500);
    }
  } catch (err) {
    if (typeof showToast === 'function') showToast('Bağlantı hatası.', 'error');
  } finally {
    if (btn) btn.disabled = false;
  }
}
window.triggerFakapScan = triggerFakapScan;

/**
 * Fakap'taki TÜM kayıtları ve indirilen dosyaları siler.
 */
export async function resetFakapAll() {
  const lang = (window.localDb?.settings && window.localDb.settings.lang) || 'tr';
  const t = (window.translations && (window.translations[lang] || window.translations.tr)) || {};
  const msg = t.fakap_reset_confirm || 'Fakap listesindeki TÜM kayıtlar ve indirilen dosyalar silinecek. Emin misiniz?';
  if (!confirm(msg)) return;
  try {
    const res = await fetch('/api/fakap/reset', { method: 'POST' });
    const data = await res.json();
    if (data.success) {
      if (typeof showToast === 'function') showToast(`${data.removed || 0} ${t.fakap_reset_done || 'kayıt silindi.'}`, 'success');
      loadFakapVideosList();
    } else if (typeof showToast === 'function') {
      showToast(data.error || 'İşlem başarısız.', 'error');
    }
  } catch (err) {
    console.error('Fakap sıfırlama hatası:', err);
    if (typeof showToast === 'function') showToast(t.fakap_conn_error || 'Sunucu bağlantı hatası.', 'error');
  }
}
window.resetFakapAll = resetFakapAll;

/**
 * Tüm kanallarda Fakap'ı açar.
 */
export async function enableAllFakapChannels() {
  const lang = (window.localDb?.settings && window.localDb.settings.lang) || 'tr';
  const t = (window.translations && (window.translations[lang] || window.translations.tr)) || {};
  const msg = t.fakap_enable_all_confirm || 'Tüm kanallarda Fakap açılacak. Yalnızca bu andan sonra yayınlanan videolar yedeklenir. Emin misiniz?';
  if (!confirm(msg)) return;
  try {
    const res = await fetch('/api/fakap/channels/enable-all', { method: 'POST' });
    const data = await res.json();
    if (data.success) {
      if (typeof showToast === 'function') showToast(`${data.enabled || 0} ${t.fakap_enable_all_done || 'kanalda Fakap açıldı.'}`, 'success');
      loadFakapVideosList();
      if (typeof window.applyFilters === 'function') window.applyFilters();
    }
  } catch (err) {
    console.error('Fakap toplu açma hatası:', err);
  }
}
window.enableAllFakapChannels = enableAllFakapChannels;

/**
 * Tüm kanallarda Fakap'ı kapatır.
 */
export async function disableAllFakapChannels() {
  const lang = (window.localDb?.settings && window.localDb.settings.lang) || 'tr';
  const t = (window.translations && (window.translations[lang] || window.translations.tr)) || {};
  const msg = t.fakap_disable_all_confirm || 'Tüm kanallarda Fakap kapatılacak. Emin misiniz?';
  if (!confirm(msg)) return;
  try {
    const res = await fetch('/api/fakap/channels/disable-all', { method: 'POST' });
    const data = await res.json();
    if (data.success) {
      if (typeof showToast === 'function') showToast(t.fakap_disable_all_done || 'Tüm kanallarda Fakap kapatıldı.', 'success');
      loadFakapVideosList();
      if (typeof window.applyFilters === 'function') window.applyFilters();
    }
  } catch (err) {
    console.error('Fakap toplu kapatma hatası:', err);
  }
}
window.disableAllFakapChannels = disableAllFakapChannels;

/**
 * Fakap klasörünü açar.
 */
export async function openFakapFolder() {
  try {
    await fetch('/api/fakap/open-folder', { method: 'POST' });
  } catch (e) {
    console.error('Klasör açılamadı:', e);
  }
}
window.openFakapFolder = openFakapFolder;

/**
 * Ayarlar sekmesinde Fakap klasörü seçme diyaloğu.
 */
export async function fakapBrowseFolder() {
  try {
    const res = await fetch('/api/fakap/select-folder', { method: 'POST' });
    const data = await res.json();
    if (data.success && data.path) {
      await fetch('/api/fakap/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fakapPath: data.path })
      });
      const input = document.getElementById('fakap-path-input');
      if (input) input.value = data.path;
      if (typeof showToast === 'function') showToast('Fakap klasörü güncellendi.', 'success');
      loadFakapVideosList();
    }
  } catch (err) {
    console.error('Fakap klasör seçimi hatası:', err);
  }
}
window.fakapBrowseFolder = fakapBrowseFolder;

/**
 * Fakap klasörünü varsayılana sıfırlar.
 */
export async function fakapResetFolder() {
  try {
    const res = await fetch('/api/fakap/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fakapPath: '' })
    });
    const data = await res.json();
    if (data.success) {
      const input = document.getElementById('fakap-path-input');
      if (input) input.value = data.dir || '';
      if (typeof showToast === 'function') showToast('Fakap varsayılan konuma sıfırlandı.', 'info');
      loadFakapVideosList();
    }
  } catch (e) {}
}
window.fakapResetFolder = fakapResetFolder;

/**
 * Fakap çözünürlük ve saklama süresi ayarlarını kaydeder.
 */
export async function fakapSaveSettings() {
  const qualitySelect = document.getElementById('fakap-quality-select');
  const retentionSelect = document.getElementById('fakap-retention-select');
  if (!qualitySelect || !retentionSelect) return;

  const payload = {
    fakapQuality: qualitySelect.value,
    fakapRetentionDays: retentionSelect.value
  };

  try {
    const res = await fetch('/api/fakap/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (data.success && typeof showToast === 'function') {
      showToast('Fakap ayarları kaydedildi.', 'success');
    }
  } catch (e) {}
}
window.fakapSaveSettings = fakapSaveSettings;

/**
 * Ayarlar sekmesindeki kontrolleri doldurur.
 */
export function updateFakapSettingsControls(data) {
  const pathInput = document.getElementById('fakap-path-input');
  const qualitySelect = document.getElementById('fakap-quality-select');
  const retentionSelect = document.getElementById('fakap-retention-select');

  if (pathInput && data.dir) pathInput.value = data.dir;
  if (qualitySelect && data.quality) qualitySelect.value = data.quality;

  if (retentionSelect && retentionSelect.options.length <= 1) {
    const lang = (window.localDb?.settings && window.localDb.settings.lang) || 'tr';
    const t = (window.translations && (window.translations[lang] || window.translations.tr)) || {};
    retentionSelect.innerHTML = `<option value="never">${t.fakap_retention_never || 'Asla (Hiç Silinmez)'}</option>`;
    for (let i = 1; i <= 30; i++) {
      const opt = document.createElement('option');
      opt.value = String(i);
      opt.textContent = `${i} ${t.unit_days || 'Gün'}`;
      retentionSelect.appendChild(opt);
    }
    const currentDays = data.retentionDays || 'never';
    retentionSelect.value = currentDays === 0 ? 'never' : String(currentDays);
  }
}

/**
 * Canlı indirme ilerlemesini Fakap kartına yansıtır (SSE 'progress' olayı).
 * Kart ekranda değilse sessizce hiçbir şey yapmaz.
 */
export function updateFakapProgress(data) {
  if (!data || !data.id) return;
  const track = document.querySelector('[data-fakap-progress="' + data.id + '"]');
  const pctEl = document.querySelector('[data-fakap-pct="' + data.id + '"]');
  const pct = Math.max(0, Math.min(100, Number(data.progress) || 0));
  if (track) {
    const fill = track.querySelector('.fakap-progress-fill');
    if (fill) fill.style.width = pct + '%';
  }
  if (pctEl) pctEl.textContent = Math.round(pct) + '%';
  if (pct >= 100) {
    setTimeout(() => { if (typeof loadFakapVideosList === 'function') loadFakapVideosList(); }, 800);
  }
}
window.updateFakapProgress = updateFakapProgress;