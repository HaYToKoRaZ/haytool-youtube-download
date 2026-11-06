// Türkçe Açıklama: Oyun Modu (Ertelenmiş FFmpeg Birleştirme ve Dönüştürme Kuyruğu) önyüz kontrol, liste oluşturma ve canlı ilerleme modülü.
import { translations } from '../utils/i18n.js';
import { escapeHtml } from '../utils/helpers.js';
import { showToast } from '../components/toast.js';

const selectedMergeIds = new Set();
const mergeProgressMap = new Map(); // videoId -> number (0..100)
let mergeQueueSnapshot = {
  isRunning: false,
  isPaused: false,
  activeVideoId: null,
  queuedIds: [],
  totalBatchCount: 0,
  completedBatchCount: 0
};

function getT() {
  const lang = localStorage.getItem('haytool_user_lang')
    || document.documentElement.lang
    || (window.localDb && window.localDb.settings && window.localDb.settings.lang)
    || 'tr';
  return translations[lang] || translations.tr || {};
}

export async function toggleDeferMergeMode() {
  const t = getT();
  try {
    const res = await fetch('/api/settings/toggle-defer-merge', { method: 'POST' });
    const data = await res.json();
    if (data && data.success) {
      showToast(data.deferMerge ? t.toast_defer_merge_on : t.toast_defer_merge_off, data.deferMerge ? 'info' : 'success');
    }
  } catch (err) {
    console.error('[MergeQueue] Toggle error:', err);
  }
}

export async function startMergeAllSequential() {
  const t = getT();
  try {
    const res = await fetch('/api/merge-queue/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'all' })
    });
    const data = await res.json();
    if (data && data.success) {
      updateMergeQueueState(data);
      showToast(t.toast_merge_started, 'info');
    }
  } catch (err) {
    console.error('[MergeQueue] Start all error:', err);
  }
}

export async function startMergeSelected() {
  const ids = Array.from(selectedMergeIds);
  if (ids.length === 0) return;
  const t = getT();
  try {
    const res = await fetch('/api/merge-queue/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ videoIds: ids })
    });
    const data = await res.json();
    if (data && data.success) {
      selectedMergeIds.clear();
      updateMergeQueueState(data);
      showToast(t.toast_merge_started, 'info');
    }
  } catch (err) {
    console.error('[MergeQueue] Start selected error:', err);
  }
}

export async function mergeSingleDeferredVideo(videoId) {
  if (!videoId) return;
  const t = getT();
  try {
    const res = await fetch('/api/merge-queue/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ videoIds: [String(videoId)] })
    });
    const data = await res.json();
    if (data && data.success) {
      updateMergeQueueState(data);
      showToast(t.toast_merge_started, 'info');
    }
  } catch (err) {
    console.error('[MergeQueue] Single merge error:', err);
  }
}

export async function pauseMergeQueue() {
  const t = getT();
  try {
    const res = await fetch('/api/merge-queue/pause', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ abortActive: false })
    });
    const data = await res.json();
    if (data && data.success) {
      updateMergeQueueState(data);
      showToast(t.toast_merge_paused, 'warning');
    }
  } catch (err) {
    console.error('[MergeQueue] Pause error:', err);
  }
}

export async function discardPendingMergeVideo(videoId) {
  if (!videoId) return;
  const t = getT();
  if (!window.confirm(t.confirm_discard_pending_merge)) return;
  try {
    selectedMergeIds.delete(String(videoId));
    mergeProgressMap.delete(String(videoId));
    await fetch('/api/merge-queue/cancel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ videoId: String(videoId) })
    });
  } catch (err) {
    console.error('[MergeQueue] Discard error:', err);
  }
}

export function toggleSelectPendingMerge(videoId, checked) {
  const id = String(videoId || '');
  if (!id) return;
  if (checked) selectedMergeIds.add(id);
  else selectedMergeIds.delete(id);
  syncMergeSelectionButtons();
}

export function toggleSelectAllPendingMerge(checked) {
  const db = window.localDb;
  const items = (db && Array.isArray(db.history))
    ? db.history.filter(h => h.status === 'pending_merge')
    : [];
  selectedMergeIds.clear();
  if (checked) {
    items.forEach(item => selectedMergeIds.add(String(item.id)));
  }
  document.querySelectorAll('.pending-merge-checkbox').forEach(cb => {
    cb.checked = Boolean(checked);
  });
  syncMergeSelectionButtons();
}

function syncMergeSelectionButtons() {
  const t = getT();
  const selBtn = document.getElementById('btn-merge-selected');
  const selSpan = document.getElementById('btn-merge-selected-text');
  if (!selBtn) return;
  const count = selectedMergeIds.size;
  selBtn.style.display = count > 0 ? 'inline-flex' : 'none';
  if (selSpan) {
    selSpan.textContent = `${t.btn_merge_selected} (${count})`;
  }
}

export function updateMergeQueueState(snapshot) {
  if (!snapshot || typeof snapshot !== 'object') return;
  mergeQueueSnapshot = {
    ...mergeQueueSnapshot,
    ...snapshot
  };
  if (window.localDb) {
    renderPendingMergeSection(window.localDb);
  }
}

export function handleMergeProgressEvent(payload) {
  if (!payload || !payload.id) return;
  const id = String(payload.id);
  if (payload.status === 'completed') {
    mergeProgressMap.delete(id);
    selectedMergeIds.delete(id);
  } else if (typeof payload.progress === 'number') {
    mergeProgressMap.set(id, payload.progress);
  }

  const bar = document.getElementById(`merge-prog-bar-${id}`);
  const pct = document.getElementById(`merge-prog-pct-${id}`);
  if (bar && typeof payload.progress === 'number') {
    bar.style.width = `${payload.progress}%`;
  }
  if (pct && typeof payload.progress === 'number') {
    pct.textContent = `%${payload.progress}`;
  }
}

export function renderPendingMergeSection(db) {
  if (!db || !db.settings) return;
  const t = getT();
  const isDeferOn = Boolean(db.settings.deferMerge);

  // 1. Üst Bar Oyun Modu Düğmesi
  const toggleBtn = document.getElementById('defer-merge-toggle-btn');
  const toggleLbl = document.getElementById('defer-merge-btn-label');
  if (toggleLbl) toggleLbl.textContent = t.defer_merge_btn_label;
  if (toggleBtn) {
    if (isDeferOn) {
      toggleBtn.classList.add('btn-primary', 'active');
      toggleBtn.classList.remove('btn-secondary');
      toggleBtn.setAttribute('title', t.defer_merge_tooltip_on);
    } else {
      toggleBtn.classList.remove('btn-primary', 'active');
      toggleBtn.classList.add('btn-secondary');
      toggleBtn.setAttribute('title', t.defer_merge_tooltip_off);
    }
  }

  // 2. Ayarlar Sayfası Kutucuğu
  const settingsCb = document.getElementById('settings-defer-merge');
  if (settingsCb) {
    settingsCb.checked = isDeferOn;
  }
  const settingsLbl = document.getElementById('label-settings-defer-merge');
  if (settingsLbl) settingsLbl.textContent = t.settings_defer_merge_label;
  const settingsDesc = document.getElementById('desc-settings-defer-merge');
  if (settingsDesc) settingsDesc.textContent = t.settings_defer_merge_desc;

  // 3. Oyun Modu Bilgi Bandı
  const deferNotice = document.getElementById('defer-merge-notice');
  const deferNoticeText = document.getElementById('defer-merge-notice-text');
  if (deferNoticeText) deferNoticeText.textContent = t.defer_merge_notice_text;
  if (deferNotice) {
    deferNotice.style.display = isDeferOn ? 'flex' : 'none';
  }

  // 4. Birleştirme Bekleyenler Kartı
  const card = document.getElementById('pending-merge-card');
  const listEl = document.getElementById('pending-merge-list');
  const countEl = document.getElementById('pending-merge-count');
  const cardTitleEl = document.getElementById('pending-merge-card-title');
  const mergeAllTextEl = document.getElementById('btn-merge-all-text');
  const pauseBtn = document.getElementById('btn-merge-pause');
  const pauseTextEl = document.getElementById('btn-merge-pause-text');
  const batchCounterEl = document.getElementById('pending-merge-batch-counter');

  if (!card || !listEl) return;

  if (cardTitleEl) cardTitleEl.textContent = t.pending_merge_card_title;
  if (mergeAllTextEl) mergeAllTextEl.textContent = t.btn_merge_all_seq;
  if (pauseTextEl) pauseTextEl.textContent = t.btn_merge_pause;

  const pendingItems = (Array.isArray(db.history) ? db.history : []).filter(
    h => h.status === 'pending_merge' || h.status === 'merging_deferred'
  );

  // Silinmiş/tamamlanmış seçimleri temizle
  const validIds = new Set(pendingItems.map(i => String(i.id)));
  for (const sId of Array.from(selectedMergeIds)) {
    if (!validIds.has(sId)) selectedMergeIds.delete(sId);
  }

  if (countEl) countEl.textContent = String(pendingItems.length);

  // Bekleyen iş yoksa ve Oyun Modu kapalıysa kartı gizle
  if (pendingItems.length === 0 && !isDeferOn) {
    card.style.display = 'none';
    return;
  }
  card.style.display = 'flex';

  const isAnyMerging = pendingItems.some(h => h.status === 'merging_deferred') || mergeQueueSnapshot.isRunning;
  if (pauseBtn) {
    pauseBtn.style.display = isAnyMerging ? 'inline-flex' : 'none';
  }

  if (batchCounterEl) {
    if (isAnyMerging && mergeQueueSnapshot.totalBatchCount > 0) {
      const curIdx = Math.min(mergeQueueSnapshot.totalBatchCount, mergeQueueSnapshot.completedBatchCount + 1);
      batchCounterEl.style.display = 'inline-flex';
      batchCounterEl.textContent = `${t.badge_merging_now}: ${curIdx} / ${mergeQueueSnapshot.totalBatchCount}`;
    } else {
      batchCounterEl.style.display = 'none';
    }
  }

  syncMergeSelectionButtons();

  if (pendingItems.length === 0) {
    listEl.innerHTML = `<div class="text-center text-muted" style="padding: 24px 0; font-size: 0.85rem;">${escapeHtml(t.pending_merge_empty)}</div>`;
    return;
  }

  const queuedSet = new Set((mergeQueueSnapshot.queuedIds || []).map(String));

  listEl.innerHTML = pendingItems.map(item => {
    const id = String(item.id);
    const isMergingNow = item.status === 'merging_deferred' || mergeQueueSnapshot.activeVideoId === id;
    const isInMergeSubqueue = queuedSet.has(id);
    const pct = mergeProgressMap.get(id) || 0;
    const checkedAttr = selectedMergeIds.has(id) ? 'checked' : '';
    const fmtBadge = escapeHtml(item.targetFormat || (item.customFormat === 'audio-mp3' ? 'MP3' : 'MP4'));
    const sizeText = item.fileSize ? escapeHtml(item.fileSize) : '';
    const thumbSrc = item.thumbnail || `/api/video/${encodeURIComponent(id)}/thumbnail`;

    return `
      <div class="pending-merge-row" style="display:flex; align-items:center; gap:12px; padding:10px 12px; border-radius:8px; background:var(--bg-body); border:1px solid ${isMergingNow ? 'var(--primary)' : 'var(--border-color)'}; transition:border-color 0.2s;">
        <input type="checkbox" class="pending-merge-checkbox" ${checkedAttr} ${isMergingNow ? 'disabled' : ''} onchange="toggleSelectPendingMerge('${escapeHtml(id)}', this.checked)" style="width:16px; height:16px; cursor:pointer; flex-shrink:0;" />
        <img src="${escapeHtml(thumbSrc)}" onerror="this.onerror=null;this.src='/logo.png';" alt="" style="width:64px; height:36px; object-fit:cover; border-radius:6px; flex-shrink:0; border:1px solid var(--border-color);" />
        <div style="flex:1; min-width:0;">
          <div style="display:flex; align-items:center; gap:8px; margin-bottom:3px;">
            <span style="font-size:0.88rem; font-weight:600; color:var(--text-main); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${escapeHtml(item.title || '')}">${escapeHtml(item.title || '')}</span>
          </div>
          <div style="display:flex; align-items:center; gap:8px; font-size:0.76rem; color:var(--text-muted); flex-wrap:wrap;">
            <span>${escapeHtml(item.channelName || '')}</span>
            ${sizeText ? `<span>• ${sizeText}</span>` : ''}
            <span style="padding:1px 6px; border-radius:4px; background:rgba(56,189,248,0.12); color:var(--primary); font-weight:600;">${fmtBadge}</span>
            <span style="padding:1px 6px; border-radius:4px; background:${isMergingNow ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.14)'}; color:${isMergingNow ? '#10b981' : '#f59e0b'}; font-weight:600;">
              ${escapeHtml(isMergingNow ? t.badge_merging_now : (isInMergeSubqueue ? `${t.badge_pending_merge} (Sırada)` : t.badge_pending_merge))}
            </span>
          </div>
          ${isMergingNow ? `
            <div style="margin-top:6px; display:flex; align-items:center; gap:8px;">
              <div style="flex:1; height:6px; background:var(--border-color); border-radius:4px; overflow:hidden;">
                <div id="merge-prog-bar-${escapeHtml(id)}" style="width:${pct}%; height:100%; background:linear-gradient(90deg, var(--primary), #10b981); transition:width 0.25s ease;"></div>
              </div>
              <span id="merge-prog-pct-${escapeHtml(id)}" style="font-size:0.75rem; font-weight:700; color:var(--primary); min-width:34px; text-align:right;">%${pct}</span>
            </div>
          ` : ''}
        </div>
        <div style="display:flex; align-items:center; gap:6px; flex-shrink:0;">
          ${!isMergingNow ? `
            <button type="button" class="btn btn-primary" onclick="mergeSingleDeferredVideo('${escapeHtml(id)}')" title="${escapeHtml(t.btn_merge_now)}" style="padding:4px 10px; font-size:0.75rem; display:inline-flex; align-items:center; gap:4px;">
              <span>▶ ${escapeHtml(t.btn_merge_now)}</span>
            </button>
          ` : ''}
          <button type="button" class="btn btn-secondary" onclick="discardPendingMergeVideo('${escapeHtml(id)}')" title="${escapeHtml(t.btn_merge_discard)}" style="padding:4px 8px; font-size:0.75rem; color:var(--accent-red); border-color:rgba(255,0,85,0.25); background:rgba(255,0,85,0.08);">
            ✕
          </button>
        </div>
      </div>
    `;
  }).join('');
}

// Global inline olay bağlayıcıları
window.toggleDeferMergeMode = toggleDeferMergeMode;
window.startMergeAllSequential = startMergeAllSequential;
window.startMergeSelected = startMergeSelected;
window.mergeSingleDeferredVideo = mergeSingleDeferredVideo;
window.pauseMergeQueue = pauseMergeQueue;
window.discardPendingMergeVideo = discardPendingMergeVideo;
window.toggleSelectPendingMerge = toggleSelectPendingMerge;
window.toggleSelectAllPendingMerge = toggleSelectAllPendingMerge;
window.renderPendingMergeSection = renderPendingMergeSection;
