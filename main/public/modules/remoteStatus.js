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

if (typeof window !== 'undefined') {
  window.loadRemoteStatusTool = loadRemoteStatusTool;
  window.startRemoteStatusScan = startRemoteStatusScan;
  window.cancelRemoteStatusScan = cancelRemoteStatusScan;
  window.recheckSingleRemoteVideo = recheckSingleRemoteVideo;
  window.setRemoteStatusFilter = setRemoteStatusFilter;
  window.filterRemoteStatusTable = filterRemoteStatusTable;
  window.handleRemoteStatusScanProgress = handleRemoteStatusScanProgress;
  window.openRemoteVideoOnYouTube = openRemoteVideoOnYouTube;
}
