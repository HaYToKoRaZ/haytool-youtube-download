// Türkçe Açıklama: Süresi dolmuş videolar için otomatik silme onay modalı, erteleme ve sıfırlama işlemleri modülü.

let _ctx = {
  getLocalDb: () => window.localDb || { settings: {} },
  getPendingVideos: () => window.pendingAutoDeleteVideos || [],
  setPendingVideos: (v) => { window.pendingAutoDeleteVideos = v; },
  showToast: (msg, type) => window.showToast && window.showToast(msg, type),
  escapeHtml: (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'),
  updateDiskSpace: () => window.updateDiskSpace && window.updateDiskSpace()
};

/**
 * app.js ile paylaşılan otomatik silme modal bağımlılıklarını kaydeder.
 * @param {object} ctx
 */
export function registerAutoDeleteModalContext(ctx) {
  _ctx = { ..._ctx, ...ctx };
}

/**
 * Sayfa açıldığında süresi dolmuş silinmeyi bekleyen video varsa onay penceresini açar.
 */
export async function checkPendingAutoDeleteOnLoad() {
  try {
    const res = await fetch('/api/auto-delete/pending');
    const data = await res.json();
    if (data.success && Array.isArray(data.videos) && data.videos.length > 0) {
      showAutoDeleteConfirmModal(data.videos);
    }
  } catch (err) {
    console.warn('[Auto-Delete] Bekleyen video kontrolü yapılamadı:', err.message);
  }
}

/**
 * Otomatik silme onay penceresindeki bir videoyu oynatıcıda açar.
 */
export function openVideoFromAutoDeleteModal(videoId, titleText) {
  const idStr = String(videoId || '').trim();
  if (!idStr) return;
  if (idStr.startsWith('fakap_') && typeof window.playFakapVideo === 'function') {
    window.playFakapVideo(idStr, titleText);
    return;
  }
  if (typeof window.playVideoEmbedded === 'function') {
    window.playVideoEmbedded(idStr);
    const activeTab = document.querySelector('.nav-item.active')?.getAttribute('data-tab') || 'history';
    if (activeTab === 'downloaded' && typeof window.switchInlinePlayerToModal === 'function') {
      setTimeout(() => {
        try { window.switchInlinePlayerToModal(); } catch (e) {}
      }, 60);
    }
  }
}

/**
 * Süresi dolmuş videolar için toplu silme onay modalını açar ve videoları listeler.
 *
 * @param {Array<object>} videos
 */
export function showAutoDeleteConfirmModal(videos) {
  const modal = document.getElementById('auto-delete-confirm-modal');
  const listEl = document.getElementById('auto-delete-pending-list');
  const countEl = document.getElementById('auto-delete-modal-title');
  if (!modal || !listEl) return;

  const list = Array.isArray(videos) ? videos : [];
  _ctx.setPendingVideos(list);
  window.pendingAutoDeleteVideos = list;
  if (list.length === 0) return;

  const localDb = _ctx.getLocalDb();
  const isEn = (localDb.settings && localDb.settings.lang === 'en') || (window.currentLang === 'en');
  if (countEl) {
    countEl.textContent = isEn
      ? `${list.length} Expired Videos to Delete`
      : `${list.length} Adet Süresi Dolan Video Silinecek`;
  }

  listEl.innerHTML = '';
  list.forEach(v => {
    const itemEl = document.createElement('div');
    itemEl.id = `auto-delete-item-${v.id}`;
    itemEl.style.cssText = 'display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 8px 12px; background: rgba(255, 255, 255, 0.03); border: 1px solid var(--border-color); border-radius: 8px; transition: background 0.15s ease;';
    const reasonBadge = v.reason ? `<span style="font-size: 0.7rem; padding: 1px 6px; border-radius: 4px; background: rgba(239, 68, 68, 0.15); color: var(--accent-red); font-weight: 500;">${_ctx.escapeHtml(v.reason)}</span>` : '';
    const safeTitleAttr = _ctx.escapeHtml(v.title || '').replace(/'/g, '&#39;');
    const playHint = isEn ? 'Click to watch video' : 'Videoyu izlemek için tıklayın';
    itemEl.innerHTML = `
      <div onclick="openVideoFromAutoDeleteModal('${v.id}', '${safeTitleAttr}')" title="${playHint}" style="display: flex; align-items: center; gap: 12px; flex: 1; min-width: 0; cursor: pointer;">
        <div style="position: relative; width: 64px; height: 36px; flex-shrink: 0; border-radius: 4px; overflow: hidden;">
          <img src="${v.thumbnail || '/api/video/' + v.id + '/thumbnail'}" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.src='/logo.png'" />
          <div style="position: absolute; inset: 0; background: rgba(0, 0, 0, 0.35); display: flex; align-items: center; justify-content: center;">
            <i data-lucide="play" style="width: 14px; height: 14px; color: #fff; fill: #fff;"></i>
          </div>
        </div>
        <div style="flex: 1; min-width: 0;">
          <div style="font-size: 0.85rem; font-weight: 600; color: var(--text-color); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${_ctx.escapeHtml(v.title || '')}">${_ctx.escapeHtml(v.title || '')}</div>
          <div style="font-size: 0.75rem; color: var(--text-muted); display: flex; align-items: center; gap: 8px; margin-top: 2px;">
            <span>${_ctx.escapeHtml(v.channelName || '')}</span>
            ${v.fileSize ? `<span>• ${_ctx.escapeHtml(v.fileSize)}</span>` : ''}
            ${reasonBadge}
          </div>
        </div>
      </div>
      <div style="display: flex; align-items: center; gap: 6px; flex-shrink: 0;">
        <button type="button" class="btn btn-secondary btn-sm" onclick="event.stopPropagation(); openVideoFromAutoDeleteModal('${v.id}', '${safeTitleAttr}')" title="${playHint}" style="display: inline-flex; align-items: center; gap: 4px; color: var(--accent-primary); border-color: rgba(168, 85, 247, 0.3); background: rgba(168, 85, 247, 0.08); padding: 4px 10px; font-size: 0.78rem;">
          <i data-lucide="play" style="width: 13px; height: 13px;"></i>
          <span>${isEn ? 'Open' : 'Aç'}</span>
        </button>
        <button type="button" class="btn btn-secondary btn-sm" onclick="event.stopPropagation(); showDeleteModal('${v.id}')" title="${isEn ? 'Delete this video' : 'Bu videoyu sil'}" style="display: inline-flex; align-items: center; gap: 4px; color: var(--accent-red); border-color: rgba(239, 68, 68, 0.3); background: rgba(239, 68, 68, 0.08); padding: 4px 10px; font-size: 0.78rem;">
          <i data-lucide="trash-2" style="width: 13px; height: 13px;"></i>
          <span>${isEn ? 'Delete' : 'Sil'}</span>
        </button>
      </div>
    `;
    listEl.appendChild(itemEl);
  });
  if (typeof lucide !== 'undefined' && lucide.createIcons) {
    try { lucide.createIcons({ root: listEl }); } catch (e) {}
  }

  modal.classList.remove('hidden');
}

/**
 * Otomatik silme onay modalını gizler.
 */
export function hideAutoDeleteConfirmModal() {
  const modal = document.getElementById('auto-delete-confirm-modal');
  if (modal) modal.classList.add('hidden');
}

/**
 * Süresi dolan videoların tamamının silinmesini onaylar.
 */
export async function confirmAutoDeleteAll() {
  const localDb = _ctx.getLocalDb();
  const isEn = (localDb.settings && localDb.settings.lang === 'en') || (window.currentLang === 'en');
  const btn = document.getElementById('btn-confirm-auto-delete-all');
  if (btn) btn.disabled = true;

  try {
    let ids = (window.pendingAutoDeleteVideos || _ctx.getPendingVideos() || []).map(v => v?.id || v).filter(Boolean);
    if (ids.length === 0) {
      try {
        const pRes = await fetch('/api/auto-delete/pending');
        const pData = await pRes.json();
        if (pData.success && Array.isArray(pData.videos)) {
          ids = pData.videos.map(v => v.id);
        }
      } catch (e) {}
    }

    const res = await fetch('/api/auto-delete/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ videoIds: ids })
    });
    const data = await res.json();
    if (data.success) {
      _ctx.showToast(isEn ? `${data.count} videos deleted permanently.` : `${data.count} adet video diskten başarıyla silindi.`, 'success');
      hideAutoDeleteConfirmModal();
      _ctx.setPendingVideos([]);
      window.pendingAutoDeleteVideos = [];
      if (typeof _ctx.updateDiskSpace === 'function') setTimeout(_ctx.updateDiskSpace, 1500);
    } else {
      _ctx.showToast(data.error || (isEn ? 'Deletion failed.' : 'Silme işlemi başarısız oldu.'), 'error');
    }
  } catch (err) {
    _ctx.showToast(isEn ? 'Server communication error.' : 'Sunucu ile iletişim hatası.', 'error');
  } finally {
    if (btn) btn.disabled = false;
  }
}

/**
 * Süresi dolan videoların silinmesini belirtilen dakika, saat veya gün kadar erteler.
 *
 * @param {number|object} [opts=2]
 */
export async function postponeAutoDelete(opts = 2) {
  const localDb = _ctx.getLocalDb();
  const isEn = (localDb.settings && localDb.settings.lang === 'en') || (window.currentLang === 'en');
  try {
    let ids = (window.pendingAutoDeleteVideos || _ctx.getPendingVideos() || []).map(v => v?.id || v).filter(Boolean);
    if (ids.length === 0) {
      try {
        const pRes = await fetch('/api/auto-delete/pending');
        const pData = await pRes.json();
        if (pData.success && Array.isArray(pData.videos)) {
          ids = pData.videos.map(v => v.id);
        }
      } catch (e) {}
    }

    const payload = { videoIds: ids };
    if (typeof opts === 'number') {
      payload.days = opts;
    } else if (opts && typeof opts === 'object') {
      if (opts.minutes) payload.minutes = opts.minutes;
      else if (opts.hours) payload.hours = opts.hours;
      else if (opts.days) payload.days = opts.days;
      else payload.days = 2;
    } else {
      payload.days = 2;
    }

    const res = await fetch('/api/auto-delete/postpone', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (data.success) {
      const totalMins = data.minutes || ((data.days || 2) * 1440);
      let msg = '';
      if (totalMins >= 1440 && totalMins % 1440 === 0) {
        const d = totalMins / 1440;
        msg = isEn ? `Deletion postponed by ${d} day(s).` : `Silme işlemi ${d} gün ertelendi.`;
      } else if (totalMins >= 60 && totalMins % 60 === 0) {
        const h = totalMins / 60;
        msg = isEn ? `Deletion postponed by ${h} hour(s).` : `Silme işlemi ${h} saat ertelendi.`;
      } else {
        msg = isEn ? `Deletion postponed by ${totalMins} minute(s).` : `Silme işlemi ${totalMins} dakika ertelendi.`;
      }
      _ctx.showToast(msg, 'info');
      hideAutoDeleteConfirmModal();
      _ctx.setPendingVideos([]);
      window.pendingAutoDeleteVideos = [];
    } else {
      _ctx.showToast(data.error || (isEn ? 'Postpone failed.' : 'Erteleme başarısız oldu.'), 'error');
    }
  } catch (err) {
    _ctx.showToast(isEn ? 'Server communication error.' : 'Sunucu ile iletişim hatası.', 'error');
  }
}

/**
 * Ertelenmiş otomatik silme sürelerini sıfırlar ve süresi dolan videolar varsa onay penceresini hemen açar.
 */
export async function resetAutoDeletePostponed() {
  const localDb = _ctx.getLocalDb();
  const isEn = (localDb.settings && localDb.settings.lang === 'en') || (window.currentLang === 'en');
  try {
    const res = await fetch('/api/auto-delete/reset-postponed', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    const data = await res.json();
    if (data.success) {
      if (Array.isArray(data.videos) && data.videos.length > 0) {
        showAutoDeleteConfirmModal(data.videos);
        _ctx.showToast(
          isEn
            ? `Postponements reset. ${data.videos.length} expired video(s) listed.`
            : `Ertelemeler sıfırlandı. ${data.videos.length} adet süresi dolan video listelendi.`,
          'info'
        );
      } else {
        _ctx.showToast(
          isEn
            ? `Postponements reset (${data.resetCount || 0}). No expired videos found.`
            : `Erteleme süreleri sıfırlandı (${data.resetCount || 0} video). Şu an süresi dolmuş video yok.`,
          'info'
        );
      }
    } else {
      _ctx.showToast(data.error || (isEn ? 'Reset failed.' : 'Sıfırlama başarısız oldu.'), 'error');
    }
  } catch (err) {
    _ctx.showToast(isEn ? 'Server communication error.' : 'Sunucu ile iletişim hatası.', 'error');
  }
}

/**
 * Otomatik silme onay penceresi kapatma ve erteleme butonlarını bağlar.
 */
export function initAutoDeleteModalButtons() {
  const closeAutoDeleteModalBtn = document.getElementById('close-auto-delete-modal-btn');
  if (closeAutoDeleteModalBtn && !closeAutoDeleteModalBtn.dataset.bound) {
    closeAutoDeleteModalBtn.dataset.bound = 'true';
    closeAutoDeleteModalBtn.addEventListener('click', hideAutoDeleteConfirmModal);
  }

  const btnMap = [
    { id: 'btn-postpone-m1', opts: { minutes: 1 } },
    { id: 'btn-postpone-m3', opts: { minutes: 3 } },
    { id: 'btn-postpone-m5', opts: { minutes: 5 } },
    { id: 'btn-postpone-m10', opts: { minutes: 10 } },
    { id: 'btn-postpone-m15', opts: { minutes: 15 } },
    { id: 'btn-postpone-h1', opts: { hours: 1 } },
    { id: 'btn-postpone-h3', opts: { hours: 3 } },
    { id: 'btn-postpone-h6', opts: { hours: 6 } },
    { id: 'btn-postpone-1', opts: { days: 1 } },
    { id: 'btn-postpone-2', opts: { days: 2 } },
    { id: 'btn-postpone-3', opts: { days: 3 } }
  ];
  btnMap.forEach(({ id, opts }) => {
    const pBtn = document.getElementById(id);
    if (pBtn && !pBtn.dataset.bound) {
      pBtn.dataset.bound = 'true';
      pBtn.addEventListener('click', (e) => {
        e.preventDefault();
        postponeAutoDelete(opts);
      });
    }
  });
}
