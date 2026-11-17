// Türkçe Açıklama: Araçlar -> İndirilen YouTube Videoları Uzak Durum Kontrolü önyüz modülü.
import { translations } from '../utils/i18n.js';
import { escapeHtml, formatDateTime } from '../utils/helpers.js';
import { showToast } from '../components/toast.js';

let remoteItemsCache = [];
let remoteSummaryCache = {};
let remoteScanStateCache = { running: false };
let currentRemoteFilter = 'all';
let filterAutoInitialized = false;
let wasScanRunning = false;

function getT() {
  const lang = window.localDb?.settings?.lang || window.currentLang || 'tr';
  return translations[lang] || translations.tr || {};
}

function getBadgeMeta(status, t) {
  switch (status) {
    case 'deleted':
      return {
        label: t.remote_status_badge_deleted || 'Silinmiş / Kaldırılmış',
        bg: 'rgba(239, 68, 68, 0.14)',
        border: 'rgba(239, 68, 68, 0.35)',
        color: '#ef4444',
        icon: 'trash-2'
      };
    case 'unlisted':
      return {
        label: t.remote_status_badge_unlisted || 'Liste Dışı (Unlisted)',
        bg: 'rgba(245, 158, 11, 0.14)',
        border: 'rgba(245, 158, 11, 0.35)',
        color: '#f59e0b',
        icon: 'eye-off'
      };
    case 'private':
      return {
        label: t.remote_status_badge_private || 'Gizli (Private)',
        bg: 'rgba(249, 115, 22, 0.14)',
        border: 'rgba(249, 115, 22, 0.35)',
        color: '#f97316',
        icon: 'lock'
      };
    case 'members_only':
      return {
        label: t.remote_status_badge_members || 'Üyelere Özel',
        bg: 'rgba(168, 85, 247, 0.14)',
        border: 'rgba(168, 85, 247, 0.35)',
        color: '#a855f7',
        icon: 'crown'
      };
    case 'public':
      return {
        label: t.remote_status_badge_public || 'Herkese Açık',
        bg: 'rgba(34, 197, 94, 0.14)',
        border: 'rgba(34, 197, 94, 0.35)',
        color: '#22c55e',
        icon: 'check-circle-2'
      };
    case 'unknown':
      return {
        label: t.remote_status_badge_unknown || 'Belirsiz',
        bg: 'rgba(148, 163, 184, 0.14)',
        border: 'rgba(148, 163, 184, 0.3)',
        color: 'var(--text-muted)',
        icon: 'help-circle'
      };
    default:
      return {
        label: t.remote_status_badge_unchecked || 'Henüz Taranmadı',
        bg: 'rgba(148, 163, 184, 0.1)',
        border: 'rgba(148, 163, 184, 0.2)',
        color: 'var(--text-muted)',
        icon: 'clock'
      };
  }
}

function isChangedStatus(status) {
  return status === 'deleted' || status === 'unlisted' || status === 'private' || status === 'members_only';
}

function renderSummary(summary) {
  const s = summary || {};
  const setVal = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.textContent = String(val ?? 0);
  };
  setVal('remote-stat-total', s.total || 0);
  setVal('remote-stat-changed', s.changed || 0);
  setVal('remote-stat-deleted', s.deleted || 0);
  setVal('remote-stat-unlisted', s.unlisted || 0);
  setVal('remote-stat-private', s.private || 0);
  setVal('remote-stat-public', s.public || 0);
}

function syncFilterActiveState() {
  document.querySelectorAll('[data-remote-filter]').forEach(btn => {
    btn.classList.toggle('is-active', btn.getAttribute('data-remote-filter') === currentRemoteFilter);
  });
  document.querySelectorAll('[data-remote-pill]').forEach(btn => {
    const active = btn.getAttribute('data-remote-pill') === currentRemoteFilter;
    btn.classList.toggle('btn-primary', active);
    btn.classList.toggle('btn-secondary', !active);
  });
}

function updateScanProgressUi(scanState) {
  remoteScanStateCache = scanState || { running: false };
  const progressWrap = document.getElementById('remote-status-progress-wrap');
  const progressBar = document.getElementById('remote-status-progress-bar');
  const progressCount = document.getElementById('remote-status-progress-count');
  const progressCurrent = document.getElementById('remote-status-progress-current');
  const scanAllBtn = document.getElementById('btn-remote-status-scan-all');
  const scanUncheckedBtn = document.getElementById('btn-remote-status-scan-unchecked');
  const cancelBtn = document.getElementById('btn-remote-status-cancel');

  const isRunning = Boolean(remoteScanStateCache.running);
  if (scanAllBtn) scanAllBtn.disabled = isRunning;
  if (scanUncheckedBtn) scanUncheckedBtn.disabled = isRunning;
  if (cancelBtn) cancelBtn.classList.toggle('hidden', !isRunning);
  if (progressWrap) progressWrap.classList.toggle('hidden', !isRunning);

  if (isRunning) {
    const total = Number(remoteScanStateCache.total || 0);
    const processed = Number(remoteScanStateCache.processed || 0);
    const pct = total > 0 ? Math.min(100, Math.round((processed / total) * 100)) : 0;
    if (progressBar) progressBar.style.width = `${pct}%`;
    if (progressCount) progressCount.textContent = `${processed} / ${total} (${pct}%)`;
    if (progressCurrent) progressCurrent.textContent = remoteScanStateCache.currentTitle || '';
  }
}

export function filterRemoteStatusTable() {
  const t = getT();
  const tbody = document.getElementById('remote-status-table-body');
  const tableWrap = document.getElementById('remote-status-table-wrap');
  const emptyBox = document.getElementById('remote-status-empty');
  const emptyMsg = document.getElementById('remote-status-empty-msg');
  if (!tbody) return;

  const query = (document.getElementById('remote-status-search-input')?.value || '').trim().toLowerCase();

  let filtered = remoteItemsCache.filter(item => {
    const st = item.remoteStatus || '';
    if (currentRemoteFilter === 'changed' && !isChangedStatus(st)) return false;
    if (currentRemoteFilter === 'deleted' && st !== 'deleted') return false;
    if (currentRemoteFilter === 'unlisted' && st !== 'unlisted') return false;
    if (currentRemoteFilter === 'private' && st !== 'private') return false;
    if (currentRemoteFilter === 'public' && st !== 'public') return false;
    if (currentRemoteFilter === 'unchecked' && st && st !== 'unknown') return false;

    if (query) {
      const hay = `${item.title || ''} ${item.channelName || ''} ${item.originalId || ''} ${item.id || ''}`.toLowerCase();
      if (!hay.includes(query)) return false;
    }
    return true;
  });

  // Değişiklik tespit edilenler daima en üstte görünsün
  const priority = { deleted: 0, private: 1, members_only: 2, unlisted: 3, unknown: 4, '': 5, public: 6 };
  filtered = [...filtered].sort((a, b) => {
    const pa = priority[a.remoteStatus || ''] ?? 5;
    const pb = priority[b.remoteStatus || ''] ?? 5;
    if (pa !== pb) return pa - pb;
    return String(b.downloadedAt || '').localeCompare(String(a.downloadedAt || ''));
  });

  syncFilterActiveState();

  if (filtered.length === 0) {
    tbody.innerHTML = '';
    if (tableWrap) tableWrap.classList.add('hidden');
    if (emptyBox) emptyBox.classList.remove('hidden');
    if (emptyMsg) {
      emptyMsg.textContent = currentRemoteFilter === 'changed'
        ? (t.remote_status_empty_changed || 'Henüz durumu değişen (silinmiş, gizli veya liste dışı) video tespit edilmedi.')
        : (t.remote_status_empty_all || 'Gösterilecek indirilmiş YouTube videosu bulunmuyor.');
    }
    try { if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons(); } catch {}
    return;
  }

  if (tableWrap) tableWrap.classList.remove('hidden');
  if (emptyBox) emptyBox.classList.add('hidden');

  tbody.innerHTML = filtered.map(item => {
    const ytId = item.originalId || item.id;
    const badge = getBadgeMeta(item.remoteStatus || '', t);
    const thumbUrl = item.thumbnail || `https://i.ytimg.com/vi/${ytId}/default.jpg`;
    const titleChanged = item.remoteTitle && item.title && item.remoteTitle.trim() !== item.title.trim() && item.remoteStatus !== 'deleted';
    const checkedText = item.remoteCheckedAt ? formatDateTime(item.remoteCheckedAt) : '-';

    return `
      <tr style="border-bottom: 1px solid var(--border-color);">
        <td style="padding: 10px 12px; max-width: 380px;">
          <div style="display: flex; align-items: center; gap: 10px;">
            <img src="${escapeHtml(thumbUrl)}" alt="" onerror="this.src='/logo.png'" style="width: 56px; height: 32px; object-fit: cover; border-radius: 5px; flex-shrink: 0; background: var(--bg-input);">
            <div style="min-width: 0;">
              <div style="font-weight: 600; color: var(--text-main); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${escapeHtml(item.title || ytId)}">${escapeHtml(item.title || ytId)}</div>
              <div style="font-size: 0.75rem; color: var(--text-muted); font-family: monospace;">${escapeHtml(ytId)}</div>
              ${titleChanged ? `<div style="font-size: 0.75rem; color: #38bdf8; margin-top: 2px;">${escapeHtml(t.remote_status_title_changed_hint || 'Uzak başlık farklı')}: ${escapeHtml(item.remoteTitle)}</div>` : ''}
            </div>
          </div>
        </td>
        <td style="padding: 10px 12px; color: var(--text-muted);">${escapeHtml(item.channelName || '-')}</td>
        <td style="padding: 10px 12px;">
          <span style="display: inline-flex; align-items: center; gap: 5px; padding: 3px 9px; border-radius: 999px; font-size: 0.78rem; font-weight: 600; background: ${badge.bg}; border: 1px solid ${badge.border}; color: ${badge.color}; white-space: nowrap;">
            <i data-lucide="${badge.icon}" style="width: 13px; height: 13px;"></i>
            <span>${escapeHtml(badge.label)}</span>
          </span>
          ${item.remoteReason ? `<div style="font-size: 0.74rem; color: var(--text-muted); margin-top: 4px; max-width: 260px;">${escapeHtml(item.remoteReason)}</div>` : ''}
        </td>
        <td style="padding: 10px 12px; color: var(--text-muted); font-size: 0.8rem; white-space: nowrap;">${escapeHtml(checkedText)}</td>
        <td style="padding: 10px 12px; text-align: right; white-space: nowrap;">
          <div style="display: inline-flex; gap: 6px; justify-content: flex-end;">
            ${!item.fileMissing ? `<button type="button" class="btn btn-secondary btn-xs" onclick="if(window.playVideoEmbedded) window.playVideoEmbedded('${escapeHtml(item.id)}')" title="Play"><i data-lucide="play" style="width: 13px; height: 13px;"></i></button>` : ''}
            <button type="button" class="btn btn-secondary btn-xs" onclick="openRemoteVideoOnYouTube('${escapeHtml(ytId)}')" title="${escapeHtml(t.btn_open_youtube || "YouTube'da Aç")}"><i data-lucide="external-link" style="width: 13px; height: 13px;"></i></button>
            <button type="button" class="btn btn-secondary btn-xs" onclick="recheckSingleRemoteVideo('${escapeHtml(item.id)}')" title="${escapeHtml(t.remote_status_action_recheck || 'Tekrar Kontrol Et')}"><i data-lucide="refresh-cw" style="width: 13px; height: 13px;"></i></button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  try { if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons(); } catch {}
}

export function setRemoteStatusFilter(filter) {
  currentRemoteFilter = filter || 'all';
  filterAutoInitialized = true;
  filterRemoteStatusTable();
}

export async function loadRemoteStatusTool() {
  try {
    const res = await fetch('/api/tools/remote-status');
    const data = await res.json();
    if (!data.success) return;

    remoteItemsCache = Array.isArray(data.items) ? data.items : [];
    remoteSummaryCache = data.summary || {};
    updateScanProgressUi(data.scanState);
    renderSummary(remoteSummaryCache);

    if (!filterAutoInitialized) {
      currentRemoteFilter = (remoteSummaryCache.changed || 0) > 0 ? 'changed' : 'all';
      filterAutoInitialized = true;
    }

    filterRemoteStatusTable();
  } catch (err) {
    console.error('[RemoteStatus] Yükleme hatası:', err);
  }
}

export async function startRemoteStatusScan(onlyUnchecked = false) {
  try {
    const res = await fetch('/api/tools/remote-status/scan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ onlyUnchecked: Boolean(onlyUnchecked) })
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      showToast(data.error || 'Tarama başlatılamadı', 'warning');
      if (data.scanState) updateScanProgressUi(data.scanState);
      return;
    }
    wasScanRunning = Boolean(data.scanState?.running);
    updateScanProgressUi(data.scanState);
  } catch (err) {
    showToast(err.message || 'Tarama başlatılamadı', 'error');
  }
}

export async function recheckSingleRemoteVideo(videoId) {
  try {
    const res = await fetch('/api/tools/remote-status/scan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ videoId })
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      showToast(data.error || 'Tarama başlatılamadı', 'warning');
      return;
    }
    wasScanRunning = Boolean(data.scanState?.running);
    updateScanProgressUi(data.scanState);
  } catch (err) {
    showToast(err.message || 'Tarama başlatılamadı', 'error');
  }
}

export async function cancelRemoteStatusScan() {
  try {
    const res = await fetch('/api/tools/remote-status/cancel', { method: 'POST' });
    const data = await res.json();
    if (data.scanState) updateScanProgressUi(data.scanState);
  } catch (err) {
    showToast(err.message || 'İptal edilemedi', 'error');
  }
}

export function handleRemoteStatusScanProgress(state) {
  if (!state) return;
  const wasRunningBefore = wasScanRunning || Boolean(remoteScanStateCache.running);
  updateScanProgressUi(state);
  wasScanRunning = Boolean(state.running);

  if (wasRunningBefore && !state.running) {
    const changed = Number(state.changed || 0);
    const processed = Number(state.processed || 0);
    const isEn = (window.localDb?.settings?.lang || 'tr') !== 'tr';
    const msg = state.cancelled
      ? (isEn ? `Remote scan cancelled (${processed}/${state.total || 0}).` : `Uzak durum taraması iptal edildi (${processed}/${state.total || 0}).`)
      : (isEn ? `Remote scan finished: ${processed} checked, ${changed} changed.` : `Uzak durum taraması tamamlandı: ${processed} kontrol edildi, ${changed} değişiklik.`);
    showToast(msg, changed > 0 ? 'warning' : 'success');
    loadRemoteStatusTool();
  } else if (state.running && Number(state.processed || 0) % 5 === 0) {
    if (window.currentToolsSubSection === 'remote-status') {
      loadRemoteStatusTool();
    }
  }
}

export async function openRemoteVideoOnYouTube(videoId) {
  const cleanId = String(videoId || '').trim();
  if (!cleanId) return;
  try {
    if (typeof window.openYouTube === 'function') {
      await window.openYouTube(cleanId);
      return;
    }
    await fetch('/api/open-youtube', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ videoId: cleanId })
    });
  } catch (err) {
    showToast(err.message || "YouTube açılamadı", 'error');
  }
}

let pendingStartupAlertVideos = [];

export async function checkStartupRemoteStatusAlertOnLoad() {
  try {
    const res = await fetch('/api/tools/remote-status/startup-alert');
    const data = await res.json();
    if (data && data.success && Array.isArray(data.videos) && data.videos.length > 0) {
      showRemoteStatusStartupAlertModal(data.videos);
    }
  } catch (_) {}
}

export function showRemoteStatusStartupAlertModal(videos) {
  const modal = document.getElementById('remote-status-alert-modal');
  const listEl = document.getElementById('remote-status-alert-list');
  const titleEl = document.getElementById('remote-status-alert-modal-title');
  const descEl = document.getElementById('remote-status-alert-modal-desc');
  const openToolTxt = document.getElementById('btn-text-remote-alert-open-tool');
  const laterTxt = document.getElementById('btn-text-remote-alert-later');
  const ackTxt = document.getElementById('btn-text-remote-alert-ack');
  if (!modal || !listEl) return;

  const list = Array.isArray(videos) ? videos : [];
  pendingStartupAlertVideos = list;
  if (list.length === 0) return;

  const t = getT();
  const isEn = (window.localDb?.settings?.lang || window.currentLang || 'tr') === 'en';

  if (titleEl) {
    titleEl.textContent = (t.remote_alert_modal_title || (isEn
      ? '{count} Downloaded Videos Changed Status on YouTube'
      : '{count} İndirilen Videonun Uzak Durumu Değişti')).replace('{count}', String(list.length));
  }
  if (descEl) {
    descEl.innerHTML = t.remote_alert_modal_desc || (isEn
      ? 'The YouTube status of the downloaded videos below has changed (Deleted / Unlisted / Private). To protect your local archive, these videos are automatically <strong>exempt from Auto-Delete and Channel Max Video Limits</strong>.'
      : 'Aşağıdaki indirilmiş videoların YouTube üzerindeki durumu (Silindi / Liste Dışı / Gizli) değişti. Yerel arşivinizin korunması için bu videolar <strong>Otomatik Video Silme</strong> ve <strong>Kanal Maksimum Video Sınırı</strong> kurallarından otomatik olarak muaf tutuldu.');
  }
  if (openToolTxt) {
    openToolTxt.textContent = t.remote_alert_btn_open_tool || (isEn ? 'View in Remote Status Tool' : 'Uzak Durum Aracında Gör');
  }
  if (laterTxt) {
    laterTxt.textContent = t.remote_alert_btn_later || (isEn ? 'Remind Later' : 'Sonra Hatırlat');
  }
  if (ackTxt) {
    ackTxt.textContent = t.remote_alert_btn_ack || (isEn ? "Got It (Don't Warn Again)" : 'Anladım (Tekrar Bildirme)');
  }

  listEl.innerHTML = '';
  list.forEach(v => {
    const ytId = v.originalId || v.id;
    const badge = getBadgeMeta(v.remoteStatus || 'deleted', t);
    const itemEl = document.createElement('div');
    itemEl.id = `remote-alert-item-${v.id}`;
    itemEl.style.cssText = 'display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 10px 12px; background: rgba(255, 255, 255, 0.03); border: 1px solid var(--border-color); border-radius: 8px;';
    const playHint = isEn ? 'Click to watch local video' : 'Yerel videoyu izlemek için tıklayın';
    const exemptLabel = t.remote_alert_exempt_badge || (isEn ? '🛡️ Exempt from Auto-Delete' : '🛡️ Oto-Silmeden Muaf');

    itemEl.innerHTML = `
      <div onclick="if(typeof openVideoFromAutoDeleteModal==='function'){openVideoFromAutoDeleteModal('${escapeHtml(v.id)}','${escapeHtml(v.title || '').replace(/'/g, '&#39;')}')}else if(typeof playVideoEmbedded==='function'){playVideoEmbedded('${escapeHtml(v.id)}')}" title="${escapeHtml(playHint)}" style="display: flex; align-items: center; gap: 12px; flex: 1; min-width: 0; cursor: pointer;">
        <div style="position: relative; width: 64px; height: 36px; flex-shrink: 0; border-radius: 4px; overflow: hidden; border: 1px solid var(--border-color);">
          <img src="${escapeHtml(v.thumbnail || '/api/video/' + v.id + '/thumbnail')}" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.src='/logo.png'" />
          <div style="position: absolute; inset: 0; background: rgba(0, 0, 0, 0.35); display: flex; align-items: center; justify-content: center;">
            <i data-lucide="play" style="width: 14px; height: 14px; color: #fff; fill: #fff;"></i>
          </div>
        </div>
        <div style="flex: 1; min-width: 0;">
          <div style="font-size: 0.88rem; font-weight: 600; color: var(--text-color); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${escapeHtml(v.title || '')}">${escapeHtml(v.title || '')}</div>
          <div style="font-size: 0.75rem; color: var(--text-muted); display: flex; align-items: center; flex-wrap: nowrap; white-space: nowrap; gap: 8px; margin-top: 4px; overflow: hidden;">
            <span style="overflow: hidden; text-overflow: ellipsis; max-width: 220px;">${escapeHtml(v.channelName || '-')}</span>
            ${v.fileSize ? `<span style="flex-shrink: 0;">• ${escapeHtml(v.fileSize)}</span>` : ''}
            <span style="flex-shrink: 0; display: inline-flex; align-items: center; gap: 4px; padding: 1px 8px; border-radius: 999px; font-size: 0.71rem; font-weight: 600; background: ${badge.bg}; border: 1px solid ${badge.border}; color: ${badge.color};">
              ★ ${escapeHtml(badge.label)}
            </span>
            <span style="flex-shrink: 0; display: inline-flex; align-items: center; padding: 1px 7px; border-radius: 4px; font-size: 0.7rem; font-weight: 600; background: rgba(16, 185, 129, 0.14); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.3);">
              ${escapeHtml(exemptLabel)}
            </span>
          </div>
          ${v.remoteReason ? `<div style="font-size: 0.74rem; color: #f59e0b; margin-top: 4px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${escapeHtml(v.remoteReason)}">${escapeHtml(v.remoteReason)}</div>` : ''}
        </div>
      </div>
      <div style="display: flex; align-items: center; gap: 6px; flex-shrink: 0;">
        ${!v.fileMissing ? `
        <button type="button" class="btn btn-secondary btn-sm" onclick="event.stopPropagation(); if(typeof openVideoFromAutoDeleteModal==='function'){openVideoFromAutoDeleteModal('${escapeHtml(v.id)}','${escapeHtml(v.title || '').replace(/'/g, '&#39;')}')}else if(typeof playVideoEmbedded==='function'){playVideoEmbedded('${escapeHtml(v.id)}')}" title="${escapeHtml(playHint)}" style="display: inline-flex; align-items: center; gap: 4px; padding: 4px 9px; font-size: 0.76rem;">
          <i data-lucide="play" style="width: 13px; height: 13px;"></i>
          <span>${isEn ? 'Watch' : 'İzle'}</span>
        </button>` : ''}
        <button type="button" class="btn btn-secondary btn-sm" onclick="event.stopPropagation(); openRemoteVideoOnYouTube('${escapeHtml(ytId)}')" title="${escapeHtml(t.btn_open_youtube || "YouTube'da Aç")}" style="display: inline-flex; align-items: center; gap: 4px; padding: 4px 9px; font-size: 0.76rem;">
          <i data-lucide="external-link" style="width: 13px; height: 13px;"></i>
          <span>YouTube</span>
        </button>
        <button type="button" class="btn btn-secondary btn-sm" onclick="event.stopPropagation(); if(typeof window.showDeleteModal==='function') window.showDeleteModal('${escapeHtml(v.id)}')" title="${escapeHtml(isEn ? 'Delete this video' : 'Bu videoyu sil')}" style="display: inline-flex; align-items: center; gap: 4px; color: var(--accent-red); border-color: rgba(239, 68, 68, 0.3); background: rgba(239, 68, 68, 0.08); padding: 4px 9px; font-size: 0.76rem;">
          <i data-lucide="trash-2" style="width: 13px; height: 13px;"></i>
          <span>${isEn ? 'Delete' : 'Sil'}</span>
        </button>
      </div>
    `;
    listEl.appendChild(itemEl);
  });

  if (typeof lucide !== 'undefined' && lucide.createIcons) {
    try { lucide.createIcons({ root: modal }); } catch (_) {}
  }

  modal.classList.remove('hidden');
}

export function hideRemoteStatusStartupAlertModal() {
  const modal = document.getElementById('remote-status-alert-modal');
  if (modal) modal.classList.add('hidden');
}

export async function acknowledgeRemoteStatusAlert(permanent = false) {
  const ids = pendingStartupAlertVideos.map(v => v.id).filter(Boolean);
  hideRemoteStatusStartupAlertModal();
  try {
    await fetch('/api/tools/remote-status/ack-alert', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ videoIds: ids, permanent: Boolean(permanent) })
    });
    pendingStartupAlertVideos = [];
  } catch (_) {}
}

export function openRemoteStatusToolFromAlert() {
  acknowledgeRemoteStatusAlert(false);
  if (typeof window.switchTab === 'function') {
    window.switchTab('tools');
  }
  if (typeof window.switchToolsSubSection === 'function') {
    window.switchToolsSubSection('remote-status');
  }
  setRemoteStatusFilter('changed');
}

export function removeVideoFromRemoteStatusAlertModal(videoId) {
  const idStr = String(videoId || '').trim();
  if (!idStr) return;

  const idx = pendingStartupAlertVideos.findIndex(v => String(v?.id || '') === idStr);
  if (idx !== -1) {
    pendingStartupAlertVideos.splice(idx, 1);
  }

  const itemDom = document.getElementById(`remote-alert-item-${idStr}`);
  if (itemDom) itemDom.remove();

  fetch('/api/tools/remote-status/ack-alert', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ videoIds: [idStr], permanent: true })
  }).catch(() => {});

  const remaining = pendingStartupAlertVideos.length;
  const titleEl = document.getElementById('remote-status-alert-modal-title');
  if (titleEl && remaining > 0) {
    const t = getT();
    const isEn = (window.localDb?.settings?.lang || window.currentLang || 'tr') === 'en';
    titleEl.textContent = (t.remote_alert_modal_title || (isEn
      ? '{count} Downloaded Videos Changed Status on YouTube'
      : '{count} İndirilen Videonun Uzak Durumu Değişti')).replace('{count}', String(remaining));
  }

  if (remaining === 0) {
    hideRemoteStatusStartupAlertModal();
  }
}

if (typeof window !== 'undefined') {
  window.loadRemoteStatusTool = loadRemoteStatusTool;
  window.startRemoteStatusScan = startRemoteStatusScan;
  window.cancelRemoteStatusScan = cancelRemoteStatusScan;
  window.recheckSingleRemoteVideo = recheckSingleRemoteVideo;
  window.setRemoteStatusFilter = setRemoteStatusFilter;
  window.filterRemoteStatusTable = filterRemoteStatusTable;
  window.handleRemoteStatusScanProgress = handleRemoteStatusScanProgress;
  window.openRemoteVideoOnYouTube = openRemoteVideoOnYouTube;
  window.checkStartupRemoteStatusAlertOnLoad = checkStartupRemoteStatusAlertOnLoad;
  window.showRemoteStatusStartupAlertModal = showRemoteStatusStartupAlertModal;
  window.hideRemoteStatusStartupAlertModal = hideRemoteStatusStartupAlertModal;
  window.acknowledgeRemoteStatusAlert = acknowledgeRemoteStatusAlert;
  window.openRemoteStatusToolFromAlert = openRemoteStatusToolFromAlert;
  window.removeVideoFromRemoteStatusAlertModal = removeVideoFromRemoteStatusAlertModal;
}
