/**
 * HaYTooL YT Downloader - Bulk Operations Module
 * public/modules/bulkOperations.js
 * 
 * Kütüphane ve İndirilenler sekmelerindeki toplu gizleme (Bulk Hide)
 * ve toplu silme (Bulk Delete) arayüz ve API işlemlerini yönetir.
 */

import { showToast } from '../components/toast.js';

// Global state flags and selected IDs initialization
window.isDownloadedBulkDeleteMode = window.isDownloadedBulkDeleteMode || false;
window.isHistoryBulkHideMode = window.isHistoryBulkHideMode || false;
window.selectedDownloadedBulkDeleteIds = window.selectedDownloadedBulkDeleteIds || new Set();
window.selectedHistoryBulkHideIds = window.selectedHistoryBulkHideIds || new Set();

// === DOWNLOADED BULK DELETE FUNCTIONS ===

export function toggleDownloadedBulkDeleteMode() {
  const toggleBtn = document.getElementById('downloaded-bulk-delete-toggle-btn');
  const bar = document.getElementById('downloaded-bulk-delete-bar');
  
  window.isDownloadedBulkDeleteMode = !window.isDownloadedBulkDeleteMode;
  if (!window.selectedDownloadedBulkDeleteIds) window.selectedDownloadedBulkDeleteIds = new Set();
  window.selectedDownloadedBulkDeleteIds.clear();
  
  if (window.isDownloadedBulkDeleteMode) {
    if (toggleBtn) {
      toggleBtn.classList.add('active');
      toggleBtn.style.background = 'var(--primary)';
      toggleBtn.style.color = '#fff';
    }
    if (bar) bar.classList.remove('hidden');
    const filesCb = document.getElementById('downloaded-bulk-delete-files-checkbox');
    if (filesCb) filesCb.checked = true;
  } else {
    if (toggleBtn) {
      toggleBtn.classList.remove('active');
      toggleBtn.style.background = '';
      toggleBtn.style.color = '';
    }
    if (bar) bar.classList.add('hidden');
    // Clear selections
    const selectAllCb = document.getElementById('downloaded-bulk-delete-select-all');
    if (selectAllCb) selectAllCb.checked = false;
  }
  
  // Update counts
  updateDownloadedBulkDeleteCount();
  
  // Re-render UI to apply isDownloadedBulkDeleteMode state to cards
  if (typeof window.updateUI === 'function') {
    window.updateUI(window.localDb);
  }
}

export function cancelDownloadedBulkDeleteMode() {
  window.isDownloadedBulkDeleteMode = false;
  if (window.selectedDownloadedBulkDeleteIds) window.selectedDownloadedBulkDeleteIds.clear();
  const toggleBtn = document.getElementById('downloaded-bulk-delete-toggle-btn');
  const bar = document.getElementById('downloaded-bulk-delete-bar');
  if (toggleBtn) {
    toggleBtn.classList.remove('active');
    toggleBtn.style.background = '';
    toggleBtn.style.color = '';
  }
  if (bar) bar.classList.add('hidden');
  
  const selectAllCb = document.getElementById('downloaded-bulk-delete-select-all');
  if (selectAllCb) selectAllCb.checked = false;
  
  updateDownloadedBulkDeleteCount();
  if (typeof window.updateUI === 'function') {
    window.updateUI(window.localDb);
  }
}

export function toggleSelectAllDownloadedBulkDelete(masterCb) {
  if (!window.selectedDownloadedBulkDeleteIds) window.selectedDownloadedBulkDeleteIds = new Set();
  const cbs = document.querySelectorAll('.downloaded-bulk-delete-cb');
  if (masterCb.checked) {
    cbs.forEach(cb => {
      const id = cb.getAttribute('data-id');
      if (id) window.selectedDownloadedBulkDeleteIds.add(id);
      cb.checked = true;
      const card = cb.closest('.video-card');
      if (card) {
        card.classList.add('bulk-delete-selected');
      }
    });
  } else {
    window.selectedDownloadedBulkDeleteIds.clear();
    cbs.forEach(cb => {
      cb.checked = false;
      const card = cb.closest('.video-card');
      if (card) {
        card.classList.remove('bulk-delete-selected');
      }
    });
  }
  updateDownloadedBulkDeleteCount();
}

/**
 * Toplu seçim kartı toggle işlemi — genel yardımcı.
 * @param {string} id - Video ID'si
 * @param {string} cbSelector - Checkbox CSS selector'ı (ör. '.downloaded-bulk-delete-cb')
 * @param {string} cardClass - Seçili kart CSS sınıfı (ör. 'bulk-delete-selected')
 * @param {string} selectAllId - "Tümünü Seç" checkbox element ID'si
 * @param {Function} updateCountFn - Sayaç güncelleme fonksiyonu
 */
export function toggleBulkCardSelection(id, cbSelector, cardClass, selectAllId, updateCountFn) {
  const isHistory = cbSelector.includes('history');
  const stateSet = isHistory ? window.selectedHistoryBulkHideIds : window.selectedDownloadedBulkDeleteIds;
  if (!stateSet) return;

  const isNowSelected = !stateSet.has(id);
  if (isNowSelected) {
    stateSet.add(id);
  } else {
    stateSet.delete(id);
  }

  const cb = document.querySelector(`${cbSelector}[data-id="${id}"]`);
  if (cb) cb.checked = isNowSelected;

  const card = cb ? cb.closest('.video-card') : document.querySelector(`.video-card[data-id="${id}"]`);
  if (card) {
    card.classList.toggle(cardClass, isNowSelected);
  }

  if (typeof updateCountFn === 'function') updateCountFn();
}

/** İndirilenlerde toplu silme kart seçimi. */
export function toggleDownloadedCardSelection(id) {
  toggleBulkCardSelection(
    id,
    '.downloaded-bulk-delete-cb',
    'bulk-delete-selected',
    'downloaded-bulk-delete-select-all',
    updateDownloadedBulkDeleteCount
  );
}

/** Geçmişte toplu gizleme kart seçimi. */
export function toggleHistoryBulkHideCardSelection(id) {
  toggleBulkCardSelection(
    id,
    '.history-bulk-hide-cb',
    'bulk-hide-selected',
    'history-bulk-hide-select-all',
    updateHistoryBulkHideCount
  );
}

export function updateDownloadedBulkDeleteCount(e) {
  if (!window.selectedDownloadedBulkDeleteIds) window.selectedDownloadedBulkDeleteIds = new Set();
  if (e) {
    e.stopPropagation();
    const cb = e.target;
    const id = cb.getAttribute('data-id');
    if (id) {
      if (cb.checked) {
        window.selectedDownloadedBulkDeleteIds.add(id);
      } else {
        window.selectedDownloadedBulkDeleteIds.delete(id);
      }
    }
    const card = cb.closest('.video-card');
    if (card) {
      card.classList.toggle('bulk-delete-selected', cb.checked);
    }
  }

  // Sync Select All checkbox
  const allCbs = document.querySelectorAll('.downloaded-bulk-delete-cb');
  const selectAllCb = document.getElementById('downloaded-bulk-delete-select-all');
  if (selectAllCb) {
    selectAllCb.checked = allCbs.length > 0 && Array.from(allCbs).every(cb => cb.checked);
  }

  const countEl = document.getElementById('downloaded-bulk-delete-selected-count');
  if (countEl) countEl.textContent = window.selectedDownloadedBulkDeleteIds.size;
}

export async function executeDownloadedBulkDelete() {
  const isEn = window.localDb?.settings?.lang === 'en';
  let videoIds = Array.from(window.selectedDownloadedBulkDeleteIds || []);
  if (videoIds.length === 0) {
    const checked = document.querySelectorAll('.downloaded-bulk-delete-cb:checked');
    videoIds = Array.from(checked).map(cb => cb.getAttribute('data-id'));
  }
  if (videoIds.length === 0) {
    showToast(isEn ? 'Please select at least one video to delete.' : 'Lütfen silmek için en az bir video seçin.', 'error');
    return;
  }
  
  const alsoDeleteFiles = document.getElementById('downloaded-bulk-delete-files-checkbox')?.checked || false;
  
  const confirmMsg = isEn 
    ? `Are you sure you want to delete the selected ${videoIds.length} video(s)?`
    : `Seçilen ${videoIds.length} videoyu silmek istediğinize emin misiniz?`;
    
  if (!confirm(confirmMsg)) return;
  
  try {
    const response = await fetch('/api/history/bulk-delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: videoIds, deleteFiles: alsoDeleteFiles })
    });
    
    if (response.ok) {
      showToast(isEn ? `${videoIds.length} video(s) deleted successfully.` : `${videoIds.length} video başarıyla silindi.`, 'success');
      if (window.selectedDownloadedBulkDeleteIds) window.selectedDownloadedBulkDeleteIds.clear();
      cancelDownloadedBulkDeleteMode();
      
      if (typeof window.loadDb === 'function') {
        await window.loadDb();
      }
    } else {
      showToast(isEn ? 'Failed to delete videos.' : 'Videolar silinirken bir hata oluştu.', 'error');
    }
  } catch (err) {
    console.error('[executeDownloadedBulkDelete] Hata:', err);
    showToast(isEn ? 'An error occurred during deletion.' : 'Silme işlemi sırasında bir hata oluştu.', 'error');
  }
}

// === HISTORY BULK HIDE FUNCTIONS ===

export function toggleHistoryBulkHideMode() {
  const toggleBtn = document.getElementById('history-bulk-hide-toggle-btn');
  const bar = document.getElementById('history-bulk-hide-bar');
  
  window.isHistoryBulkHideMode = !window.isHistoryBulkHideMode;
  if (!window.selectedHistoryBulkHideIds) window.selectedHistoryBulkHideIds = new Set();
  window.selectedHistoryBulkHideIds.clear();
  
  if (window.isHistoryBulkHideMode) {
    if (toggleBtn) {
      toggleBtn.classList.add('active');
    }
    if (bar) bar.classList.remove('hidden');
  } else {
    if (toggleBtn) {
      toggleBtn.classList.remove('active');
    }
    if (bar) bar.classList.add('hidden');
    // Clear selections
    const selectAllCb = document.getElementById('history-bulk-hide-select-all');
    if (selectAllCb) selectAllCb.checked = false;
  }
  
  updateHistoryBulkHideCount();
  
  // Re-render UI to apply isHistoryBulkHideMode state to history cards
  if (typeof window.updateUI === 'function') {
    window.updateUI(window.localDb);
  }
}

export function cancelHistoryBulkHideMode() {
  window.isHistoryBulkHideMode = false;
  if (window.selectedHistoryBulkHideIds) window.selectedHistoryBulkHideIds.clear();
  const toggleBtn = document.getElementById('history-bulk-hide-toggle-btn');
  const bar = document.getElementById('history-bulk-hide-bar');
  if (toggleBtn) {
    toggleBtn.classList.remove('active');
  }
  if (bar) bar.classList.add('hidden');
  
  const selectAllCb = document.getElementById('history-bulk-hide-select-all');
  if (selectAllCb) selectAllCb.checked = false;
  
  updateHistoryBulkHideCount();
  if (typeof window.updateUI === 'function') {
    window.updateUI(window.localDb);
  }
}

export function toggleSelectAllHistoryBulkHide(masterCb) {
  if (!window.selectedHistoryBulkHideIds) window.selectedHistoryBulkHideIds = new Set();
  const cbs = document.querySelectorAll('.history-bulk-hide-cb');
  if (masterCb.checked) {
    cbs.forEach(cb => {
      const id = cb.getAttribute('data-id');
      if (id) window.selectedHistoryBulkHideIds.add(id);
      cb.checked = true;
      const card = cb.closest('.video-card');
      if (card) {
        card.classList.add('bulk-hide-selected');
      }
    });
  } else {
    window.selectedHistoryBulkHideIds.clear();
    cbs.forEach(cb => {
      cb.checked = false;
      const card = cb.closest('.video-card');
      if (card) {
        card.classList.remove('bulk-hide-selected');
      }
    });
  }
  updateHistoryBulkHideCount();
}

export function updateHistoryBulkHideCount(e) {
  if (!window.selectedHistoryBulkHideIds) window.selectedHistoryBulkHideIds = new Set();
  if (e) {
    e.stopPropagation();
    const cb = e.target;
    const id = cb.getAttribute('data-id');
    if (id) {
      if (cb.checked) {
        window.selectedHistoryBulkHideIds.add(id);
      } else {
        window.selectedHistoryBulkHideIds.delete(id);
      }
    }
    const card = cb.closest('.video-card');
    if (card) {
      card.classList.toggle('bulk-hide-selected', cb.checked);
    }
  }

  // Sync Select All checkbox
  const allCbs = document.querySelectorAll('.history-bulk-hide-cb');
  const selectAllCb = document.getElementById('history-bulk-hide-select-all');
  if (selectAllCb) {
    selectAllCb.checked = allCbs.length > 0 && Array.from(allCbs).every(cb => cb.checked);
  }

  const countEl = document.getElementById('history-bulk-hide-selected-count');
  if (countEl) countEl.textContent = window.selectedHistoryBulkHideIds.size;
}

export async function executeHistoryBulkHide() {
  const isEn = window.localDb?.settings?.lang === 'en';
  let videoIds = Array.from(window.selectedHistoryBulkHideIds || []);
  if (videoIds.length === 0) {
    const checked = document.querySelectorAll('.history-bulk-hide-cb:checked');
    videoIds = Array.from(checked).map(cb => cb.getAttribute('data-id'));
  }
  if (videoIds.length === 0) {
    showToast(isEn ? 'Please select at least one video to hide.' : 'Lütfen gizlemek için en az bir video seçin.', 'warning');
    return;
  }
  
  const confirmMsg = isEn 
    ? `Are you sure you want to hide the selected ${videoIds.length} video(s)?`
    : `Seçilen ${videoIds.length} videoyu gizlemek istediğinize emin misiniz?`;
    
  if (!confirm(confirmMsg)) return;
  
  try {
    const response = await fetch('/api/history/bulk-hide', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: videoIds })
    });
    
    const result = await response.json();
    if (result.success) {
      const count = result.count || videoIds.length;
      showToast(isEn ? `${count} video(s) hidden successfully.` : `${count} video başarıyla gizlendi.`, 'success');
      if (window.selectedHistoryBulkHideIds) window.selectedHistoryBulkHideIds.clear();
      cancelHistoryBulkHideMode();
      
      if (typeof window.loadDb === 'function') {
        await window.loadDb();
      }
    } else {
      showToast(result.error || (isEn ? 'Failed to hide videos.' : 'Videolar gizlenirken bir hata oluştu.'), 'error');
    }
  } catch (err) {
    console.error('[executeHistoryBulkHide] Hata:', err);
    showToast(isEn ? 'An error occurred while hiding videos.' : 'Gizleme işlemi sırasında bir hata oluştu.', 'error');
  }
}

// Global window bindings for inline HTML attribute callers & card events
window.toggleDownloadedBulkDeleteMode = toggleDownloadedBulkDeleteMode;
window.cancelDownloadedBulkDeleteMode = cancelDownloadedBulkDeleteMode;
window.toggleSelectAllDownloadedBulkDelete = toggleSelectAllDownloadedBulkDelete;
window.toggleBulkCardSelection = toggleBulkCardSelection;
window.toggleDownloadedCardSelection = toggleDownloadedCardSelection;
window.toggleHistoryBulkHideCardSelection = toggleHistoryBulkHideCardSelection;
window.updateDownloadedBulkDeleteCount = updateDownloadedBulkDeleteCount;
window.executeDownloadedBulkDelete = executeDownloadedBulkDelete;

window.toggleHistoryBulkHideMode = toggleHistoryBulkHideMode;
window.cancelHistoryBulkHideMode = cancelHistoryBulkHideMode;
window.toggleSelectAllHistoryBulkHide = toggleSelectAllHistoryBulkHide;
window.updateHistoryBulkHideCount = updateHistoryBulkHideCount;
window.executeHistoryBulkHide = executeHistoryBulkHide;
