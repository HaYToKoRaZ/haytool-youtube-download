/**
 * HaYTooL YouTube Downloader - İndirme Kuyruğu & Sıralama Yönetim Modülü (Frontend)
 * 
 * Yapımcı: HaYTo
 * İletişim: korazhayto@gmail.com
 */

import { showToast } from '../components/toast.js';
import { translations } from '../utils/i18n.js';

let dragSrcEl = null;

/**
 * Kuyruk sekmesi görünüm modunu (table veya cards) ayarlar.
 * 
 * @param {'table' | 'cards'} mode Seçilen görünüm modu
 */
export function setQueueViewMode(mode) {
  if (mode !== 'table' && mode !== 'cards') mode = 'table';
  
  const tableBtn = document.getElementById('queue-view-table-btn');
  const cardsBtn = document.getElementById('queue-view-cards-btn');
  if (tableBtn && cardsBtn) {
    tableBtn.classList.toggle('active', mode === 'table');
    cardsBtn.classList.toggle('active', mode === 'cards');
  }

  if (window.localDb && window.localDb.settings) {
    window.localDb.settings.queueViewMode = mode;
  }

  localStorage.setItem('haytool_queue_view_mode', mode);

  // Arayüzü güncelle
  if (window.localDb && typeof window.updateUI === 'function') {
    window.updateUI(window.localDb);
  }

  try {
    if (typeof lucide !== 'undefined') {
      lucide.createIcons();
    }
  } catch (e) {}

  // Ayarları backend ve config.ini'ye kaydet
  fetch('/api/settings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...(window.localDb ? window.localDb.settings : {}), queueViewMode: mode })
  }).catch(err => console.error('Error saving queueViewMode:', err));
}
window.setQueueViewMode = setQueueViewMode;

/**
 * Kuyruk listesindeki videoyu en başa, yukarı, aşağı veya en sona taşır.
 * 
 * @param {string} videoId Taşınacak videonun ID'si
 * @param {'top' | 'up' | 'down' | 'bottom'} direction Taşıma yönü
 */
export function moveQueueItem(videoId, direction) {
  const list = document.getElementById('queue-list');
  if (!list) return;

  const items = Array.from(list.querySelectorAll('[data-id]'));
  const currentIndex = items.findIndex(el => el.getAttribute('data-id') === videoId);
  if (currentIndex === -1) return;

  const currentEl = items[currentIndex];

  // Birleştirme (merging) durumundaki video taşınamaz
  if (currentEl.classList.contains('queue-item-merging')) {
    return;
  }

  if (direction === 'top') {
    const firstMovableIndex = items.findIndex(el => !el.classList.contains('queue-item-merging'));
    if (firstMovableIndex === -1 || currentIndex <= firstMovableIndex) return;
    const firstMovableEl = items[firstMovableIndex];
    list.insertBefore(currentEl, firstMovableEl);
  } else if (direction === 'bottom') {
    if (currentIndex >= items.length - 1) return;
    list.appendChild(currentEl);
  } else if (direction === 'up') {
    const targetIndex = currentIndex - 1;
    if (targetIndex < 0) return;
    const targetEl = items[targetIndex];
    if (targetEl.classList.contains('queue-item-merging')) return;
    list.insertBefore(currentEl, targetEl);
  } else if (direction === 'down') {
    const targetIndex = currentIndex + 1;
    if (targetIndex >= items.length) return;
    const targetEl = items[targetIndex];
    targetEl.after(currentEl);
  } else {
    return;
  }

  const newOrderIds = Array.from(list.querySelectorAll('[data-id]')).map(el => el.getAttribute('data-id'));

  // Sıra numaralarını ve ok butonlarının aktif/pasif durumlarını hemen güncelle
  updateQueueOrderDOM(list);

  fetch('/api/queue/reorder', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids: newOrderIds })
  }).catch(err => console.error('Error reordering queue via arrow:', err));
}
window.moveQueueItem = moveQueueItem;

/**
 * DOM üzerindeki sıra numarası rozetlerini (#01, #02..) ve ilk/son elemanın ok butonlarının pasiflik durumunu günceller.
 */
export function updateQueueOrderDOM(listEl) {
  if (!listEl) return;
  const items = Array.from(listEl.querySelectorAll('[data-id]'));
  const total = items.length;

  items.forEach((item, idx) => {
    const badge = item.querySelector('.queue-order-badge');
    if (badge) {
      badge.textContent = `#${(idx + 1).toString().padStart(2, '0')}`;
    }
    const topBtn = item.querySelector('.queue-btn-top');
    const upBtn = item.querySelector('.queue-btn-up');
    const downBtn = item.querySelector('.queue-btn-down');
    const bottomBtn = item.querySelector('.queue-btn-bottom');
    const isFirst = (idx === 0);
    const isLast = (idx === total - 1);

    if (topBtn) {
      topBtn.disabled = isFirst;
      topBtn.classList.toggle('disabled', isFirst);
    }
    if (upBtn) {
      upBtn.disabled = isFirst;
      upBtn.classList.toggle('disabled', isFirst);
    }
    if (downBtn) {
      downBtn.disabled = isLast;
      downBtn.classList.toggle('disabled', isLast);
    }
    if (bottomBtn) {
      bottomBtn.disabled = isLast;
      bottomBtn.classList.toggle('disabled', isLast);
    }
  });
}
window.updateQueueOrderDOM = updateQueueOrderDOM;

/**
 * Sürükleme başladığında tetiklenen olay yöneticisi.
 */
export function handleDragStart(e) {
  this.style.opacity = '0.4';
  dragSrcEl = this;
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/html', this.innerHTML);
}
window.handleDragStart = handleDragStart;

/**
 * Sürüklenen öğe başka bir öğenin üzerine geldiğinde tetiklenir.
 */
export function handleDragOver(e) {
  if (e.preventDefault) {
    e.preventDefault();
  }
  e.dataTransfer.dropEffect = 'move';
  return false;
}
window.handleDragOver = handleDragOver;

/**
 * Sürüklenen öğe bırakıldığında tetiklenen olay yöneticisi.
 */
export function handleDrop(e) {
  if (e.stopPropagation) {
    e.stopPropagation();
  }
  
  if (dragSrcEl !== this) {
    const list = document.getElementById('queue-list');
    if (!list) return false;
    const children = Array.from(list.querySelectorAll('[data-id]'));
    const fromIndex = children.indexOf(dragSrcEl);
    const toIndex = children.indexOf(this);
    
    if (fromIndex < toIndex) {
      this.after(dragSrcEl);
    } else {
      this.before(dragSrcEl);
    }
    
    const newOrderIds = Array.from(list.querySelectorAll('[data-id]')).map(el => el.getAttribute('data-id'));
    
    updateQueueOrderDOM(list);

    fetch('/api/queue/reorder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: newOrderIds })
    }).catch(err => console.error('Error reordering queue:', err));
  }
  
  return false;
}
window.handleDrop = handleDrop;

/**
 * Sürükleme işlemi bittiğinde elemanların şeffaflıklarını sıfırlar.
 */
export function handleDragEnd(e) {
  this.style.opacity = '1';
  document.querySelectorAll('#queue-list [data-id]').forEach(item => {
    item.style.opacity = '1';
  });
}
window.handleDragEnd = handleDragEnd;

/**
 * Devam etmekte olan aktif bir video indirme işlemini iptal eder.
 * 
 * @param {string} videoId İptal edilecek video ID'si
 */
export async function cancelDownload(videoId) {
  if (!confirm('Bu indirme işlemini iptal etmek istediğinizden emin misiniz?')) return;
  
  try {
    showToast('İndirme iptal ediliyor...', 'info');
    const res = await fetch('/api/cancel-download', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ videoId })
    });
    const data = await res.json();
    if (!data.success) {
      showToast(data.error || 'İptal işlemi başarısız oldu.', 'error');
    }
  } catch (err) {
    showToast('Sunucu ile iletişim hatası.', 'error');
  }
}
window.cancelDownload = cancelDownload;

/**
 * Tüm aktif ve kuyruktaki indirmeleri iptal eder.
 */
export async function cancelAllDownloads() {
  if (!confirm('Tüm aktif ve kuyruktaki indirmeleri iptal etmek istediğinize emin misiniz?')) return;
  
  try {
    showToast('Tüm indirmeler iptal ediliyor...', 'info');
    const res = await fetch('/api/cancel-all-downloads', {
      method: 'POST'
    });
    const data = await res.json();
    if (data.success) {
      showToast('Tüm indirmeler iptal edildi.', 'success');
    } else {
      showToast(data.error || 'İptal işlemi başarısız oldu.', 'error');
    }
  } catch (err) {
    showToast('Sunucu ile iletişim hatası.', 'error');
  }
}
window.cancelAllDownloads = cancelAllDownloads;

/**
 * İndirme kuyruğunda (sırasında) bekleyen bir videoyu sıradan çıkarır.
 * 
 * @param {string} videoId Sıradan çıkarılacak video ID'si
 */
export async function cancelQueuedVideo(videoId) {
  try {
    showToast('Sıradan çıkarılıyor...', 'info');
    const res = await fetch('/api/cancel-download', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ videoId })
    });
    const data = await res.json();
    if (!data.success) {
      showToast(data.error || 'İptal işlemi başarısız oldu.', 'error');
    }
  } catch (err) {
    showToast('Sunucu ile iletişim hatası.', 'error');
  }
}
window.cancelQueuedVideo = cancelQueuedVideo;

/**
 * Kuyruktaki tüm videoları iptal eder.
 */
export async function cancelAllQueued() {
  const currentLang = localStorage.getItem('haytool_user_lang') || 'tr';
  const isEn = currentLang === 'en';
  if (!confirm(isEn ? 'Are you sure you want to cancel all queued videos?' : 'Kuyruktaki tüm videoları iptal etmek istediğinizden emin misiniz?')) return;
  
  try {
    showToast(isEn ? 'Cancelling all queued videos...' : 'Tüm kuyruk iptal ediliyor...', 'info');
    const res = await fetch('/api/cancel-all-queued', { method: 'POST' });
    const data = await res.json();
    if (!data.success) {
      showToast(data.error || (isEn ? 'Cancel failed.' : 'İptal işlemi başarısız oldu.'), 'error');
    }
  } catch (err) {
    showToast(isEn ? 'Communication error.' : 'Sunucu ile iletişim hatası.', 'error');
  }
}
window.cancelAllQueued = cancelAllQueued;

/**
 * Pano içeriğini veya girilen YouTube linkini okuyarak doğrudan indirme kuyruğuna ekler.
 */
export async function pasteAndDownload() {
  let urlText = '';
  try {
    urlText = await navigator.clipboard.readText();
    urlText = urlText.trim();
  } catch (err) {
    console.warn('Pano okuma izni alınamadı:', err);
  }

  const youtubeRegex = /(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/))([^?&"'>\s]{11})/;
  
  if (!urlText || !youtubeRegex.test(urlText)) {
    urlText = prompt('Lütfen indirmek istediğiniz YouTube video linkini buraya yapıştırın:');
    if (!urlText) return;
    urlText = urlText.trim();
  }

  const match = urlText.match(youtubeRegex);
  if (match) {
    const videoId = match[1];
    showToast('Video çözümleniyor ve kuyruğa ekleniyor...', 'info');
    try {
      const res = await fetch('/api/download-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoId })
      });
      const data = await res.json();
      if (data.success) {
        showToast('Video kuyruğa başarıyla eklendi!', 'success');
        if (window.switchTab) window.switchTab('queue');
      } else {
        showToast(data.error || 'İndirme eklenemedi.', 'error');
      }
    } catch (err) {
      showToast('Sunucu ile iletişim hatası.', 'error');
    }
  } else {
    showToast('Geçersiz YouTube video linki girildi.', 'error');
  }
}
window.pasteAndDownload = pasteAndDownload;

/**
 * Kuyruk indirme sırasını duraklatır veya kaldığı yerden devam ettirir.
 */
export async function toggleQueuePause() {
  const currentDb = window.localDb || {};
  const isPaused = currentDb.settings && currentDb.settings.isPaused;
  const endpoint = isPaused ? '/api/queue/resume' : '/api/queue/pause';
  const actionText = isPaused 
    ? ((currentDb.settings && currentDb.settings.lang === 'en') ? 'Resuming queue...' : 'Kuyruk devam ettiriliyor...')
    : ((currentDb.settings && currentDb.settings.lang === 'en') ? 'Pausing queue...' : 'Kuyruk duraklatılıyor...');
    
  showToast(actionText, 'info');
  
  try {
    const res = await fetch(endpoint, { method: 'POST' });
    const data = await res.json();
    if (data.success) {
      if (!currentDb.settings) currentDb.settings = {};
      currentDb.settings.isPaused = data.isPaused;
      if (typeof window.updateUI === 'function') {
        window.updateUI(currentDb);
      }
    } else {
      showToast(data.error || 'İşlem başarısız.', 'error');
    }
  } catch (err) {
    showToast('Sunucu bağlantı hatası.', 'error');
  }
}
window.toggleQueuePause = toggleQueuePause;

/**
 * Alternatif hız sınırı (kaplumbağa) profilini açıp kapatır.
 */
export async function toggleAlternativeSpeed() {
  const currentLang = localStorage.getItem('haytool_user_lang') || 'tr';
  const isEn = currentLang === 'en';
  showToast(isEn ? 'Toggling speed limit profile...' : 'Hız sınırı profili değiştiriliyor...', 'info');
  try {
    const res = await fetch('/api/settings/toggle-alt-speed', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    const data = await res.json();
    if (data.success) {
      showToast(isEn ? 'Speed profile changed successfully!' : 'Hız profili başarıyla değiştirildi!', 'success');
    } else {
      showToast(data.error || 'Hata oluştu.', 'error');
    }
  } catch (err) {
    showToast('Bağlantı hatası.', 'error');
  }
}
window.toggleAlternativeSpeed = toggleAlternativeSpeed;

/**
 * Kullanıcının girdiği hız limitini (KB/s) sunucuya göndererek kaydeder.
 */
export async function updateQueueSpeedLimit() {
  const input = document.getElementById('queue-speed-limit-input');
  if (!input) return;
  
  const limit = parseInt(input.value, 10);
  if (isNaN(limit) || limit < 0) {
    showToast('Lütfen geçerli bir hız sınırı değeri girin (0 veya daha büyük).', 'error');
    return;
  }
  
  const currentDb = window.localDb || { settings: {} };
  const isEn = currentDb.settings && currentDb.settings.lang === 'en';
  showToast(isEn ? 'Updating speed limit...' : 'Hız sınırı güncelleniyor...', 'info');
  
  try {
    const updatedSettings = { ...currentDb.settings };
    if (currentDb.settings.useAlternativeSpeed) {
      updatedSettings.alternativeSpeedLimit = limit;
    } else {
      updatedSettings.downloadSpeedLimit = limit;
    }
    
    const res = await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updatedSettings)
    });
    const data = await res.json();
    if (data.success) {
      showToast(isEn ? 'Speed limit updated successfully!' : 'Hız sınırı başarıyla güncellendi!', 'success');
    } else {
      showToast(data.error || 'Hız sınırı güncellenemedi.', 'error');
    }
  } catch (err) {
    showToast('Sunucu hatası.', 'error');
  }
}
window.updateQueueSpeedLimit = updateQueueSpeedLimit;

/**
 * Hata alan veya başarısız olan videoyu tekrar indirme kuyruğuna ekler.
 */
export async function retryFailedVideo(videoId) {
  if (typeof window.downloadVideoManual === 'function') {
    window.downloadVideoManual(videoId);
  } else {
    try {
      const res = await fetch(`/api/history/${videoId}/redownload`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        showToast('Video tekrar indirme kuyruğuna alındı.', 'success');
      } else {
        showToast(data.error || 'İşlem başarısız.', 'error');
      }
    } catch (e) {
      showToast('Sunucu hatası.', 'error');
    }
  }
}
window.retryFailedVideo = retryFailedVideo;

/**
 * Tüm hata veren videoları sırayla indirme kuyruğuna tekrar ekler.
 */
export async function retryAllFailedVideos() {
  const currentDb = window.localDb || {};
  const currentLang = localStorage.getItem('haytool_user_lang') || 'tr';
  const isEn = currentLang === 'en';
  const disabledChannelIds = new Set((currentDb.channels || []).filter(c => c.autoDownload === false).map(c => c.id));
  const failedItems = (currentDb.history || []).filter(h => h.status === 'failed' && h.hidden !== true && h.status !== 'ignored' && !disabledChannelIds.has(h.channelId));
  if (failedItems.length === 0) {
    showToast(isEn ? 'No failed videos to retry.' : 'Tekrar denenecek hata alan video bulunmuyor.', 'info');
    return;
  }

  showToast(isEn ? `Retrying ${failedItems.length} failed downloads...` : `${failedItems.length} hata alan video indirmeye ekleniyor...`, 'info');
  
  let successCount = 0;
  for (const item of failedItems) {
    try {
      const res = await fetch('/api/download-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoId: item.id,
          title: item.title,
          channelName: item.channelName,
          channelId: item.channelId
        })
      });
      const data = await res.json();
      if (data.success) successCount++;
    } catch (e) {}
  }

  if (successCount > 0) {
    showToast(isEn ? `${successCount} videos added to queue.` : `${successCount} video kuyruğa yeniden eklendi.`, 'success');
  } else {
    showToast(isEn ? 'Failed to retry downloads.' : 'Videolar kuyruğa eklenemedi.', 'error');
  }
}
window.retryAllFailedVideos = retryAllFailedVideos;

/**
 * Hata veren tek bir videoyu geçmiş listesinden temizler ve tekrar indirilmesini engellemek için göz ardı eder.
 */
export async function clearFailedVideo(videoId) {
  const currentLang = localStorage.getItem('haytool_user_lang') || 'tr';
  const isEn = currentLang === 'en';
  const db = window.localDb || { history: [] };
  const itemIndex = (db.history || []).findIndex(h => h.id === videoId && (h.status === 'failed' || h.status === 'waiting_live_processing'));
  let backup = null;
  if (itemIndex !== -1) {
    backup = { ...db.history[itemIndex] };
    db.history.splice(itemIndex, 1);
    if (typeof window.updateUI === 'function') window.updateUI(db);
  }

  try {
    const res = await fetch(`/api/history/${videoId}?deleteFile=false&hideOnDelete=true&markWatched=true`, { method: 'DELETE' });
    const data = await res.json();
    if (data.success) {
      showToast(isEn ? 'Failed download removed and ignored.' : 'Hata kaydı temizlendi ve indirilmesi engellendi.', 'success');
    } else {
      if (backup) {
        db.history.push(backup);
        if (typeof window.updateUI === 'function') window.updateUI(db);
      }
      showToast(data.error || (isEn ? 'Failed to remove.' : 'Temizlenemedi.'), 'error');
    }
  } catch (err) {
    if (backup) {
      db.history.push(backup);
      if (typeof window.updateUI === 'function') window.updateUI(db);
    }
    showToast('Sunucu hatası.', 'error');
  }
}
window.clearFailedVideo = clearFailedVideo;

/**
 * Tüm hata veren videoları onay alarak toplu biçimde geçmişten temizler.
 */
export async function clearAllFailedVideos() {
  const currentDb = window.localDb || {};
  const currentLang = localStorage.getItem('haytool_user_lang') || 'tr';
  const t = translations[currentLang] || translations.tr;
  const isEn = currentLang === 'en';
  const disabledChannelIds = new Set((currentDb.channels || []).filter(c => c.autoDownload === false).map(c => c.id));
  
  const failedItems = (currentDb.history || []).filter(h => (h.status === 'failed' || h.status === 'waiting_live_processing') && h.hidden !== true && h.status !== 'ignored' && !disabledChannelIds.has(h.channelId));
  if (failedItems.length === 0) {
    showToast(isEn ? 'No failed videos to clear.' : 'Temizlenecek hata kaydı bulunmuyor.', 'info');
    return;
  }

  const confirmMsg = t.btn_clear_failed_confirm || (isEn ? 'Are you sure you want to clear all failed downloads?' : 'Tüm hata veren indirme kayıtlarını temizlemek istediğinize emin misiniz?');
  if (!confirm(confirmMsg)) return;

  const failedIds = failedItems.map(f => f.id);
  const failedIdsSet = new Set(failedIds);
  const backupItems = [...failedItems];

  // Optimistik temizlik
  currentDb.history = currentDb.history.filter(h => !failedIdsSet.has(h.id));
  if (typeof window.updateUI === 'function') window.updateUI(currentDb);

  try {
    const res = await fetch('/api/history/bulk-delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: failedIds, deleteFiles: false, hideOnDelete: true })
    });
    const data = await res.json();
    if (data.success) {
      showToast(isEn ? `${failedIds.length} failed records cleared and ignored.` : `${failedIds.length} hata kaydı temizlendi ve indirilmesi engellendi.`, 'success');
    } else {
      currentDb.history.push(...backupItems);
      if (typeof window.updateUI === 'function') window.updateUI(currentDb);
      showToast(data.error || (isEn ? 'Failed to clear records.' : 'Kayıtlar temizlenemedi.'), 'error');
    }
  } catch (err) {
    currentDb.history.push(...backupItems);
    if (typeof window.updateUI === 'function') window.updateUI(currentDb);
    showToast('Sunucu bağlantı hatası.', 'error');
  }
}
window.clearAllFailedVideos = clearAllFailedVideos;
