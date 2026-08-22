/**
 * İndirici (Downloader) Modülü - HaYTooL YouTube Downloader
 *
 * Yapımcı: HaYTo
 * Açıklama: Tekil video ve oynatma listesi indirme, kuyruk yönetimi,
 *            indirme iptali ve motor sıfırlama işlevleri.
 * Bağımlılıklar: app.js getState() fonksiyonu ile localDb, currentLang, translations erişimi sağlanır.
 */

import { escapeHtml } from '../utils/helpers.js';
import { showToast } from '../components/toast.js';

let activePlaylistVideos = [];
let _getState = null;

/**
 * Downloader modülünü başlatır.
 * @param {Function} getState - { localDb, currentLang, translations } döndüren getter
 */
export function initDownloader(getState) {
  _getState = getState;

  const downloaderActionBtn = document.getElementById('downloader-action-btn');
  if (downloaderActionBtn) {
    downloaderActionBtn.addEventListener('click', (e) => {
      e.preventDefault();
      if (window.switchTab) window.switchTab('downloader');
      const dropdown = document.getElementById('tools-dropdown');
      if (dropdown) dropdown.classList.remove('open');
    });
  }

  const formatSelect = document.getElementById('downloader-format-select');
  const bitrateGroup = document.getElementById('downloader-bitrate-group');
  if (formatSelect && bitrateGroup) {
    formatSelect.addEventListener('change', () => {
      if (formatSelect.value === 'audio-mp3') {
        bitrateGroup.style.display = 'block';
      } else {
        bitrateGroup.style.display = 'none';
      }
    });
  }

  const startBtn = document.getElementById('downloader-start-btn');
  if (startBtn) {
    startBtn.addEventListener('click', handleDownloaderStart);
  }

  const downloadAllBtn = document.getElementById('downloader-download-all-btn');
  if (downloadAllBtn) {
    downloadAllBtn.addEventListener('click', handleDownloaderAll);
  }

  const toggleAllCheckbox = document.getElementById('downloader-toggle-all-checkbox');
  if (toggleAllCheckbox) {
    toggleAllCheckbox.addEventListener('change', (e) => {
      const checked = e.target.checked;
      document.querySelectorAll('.playlist-item-checkbox').forEach(cb => {
        cb.checked = checked;
      });
    });
  }

  const cancelActiveBtn = document.getElementById('cancel-active-btn');
  if (cancelActiveBtn) {
    cancelActiveBtn.addEventListener('click', () => {
      const { localDb } = _getState();
      const activeDownload = localDb.history?.find(h => h.status === 'downloading');
      const activeMerging = localDb.history?.find(h => h.status === 'merging');
      const target = activeDownload || activeMerging;
      if (target) {
        cancelDownload(target.id);
      } else {
        showToast('Şu anda aktif bir işlem bulunmuyor.', 'info');
      }
    });
  }
}

// ─── İNDİRME BAŞLATMA VE PLAYLIST ÇÖZÜMLEME ───

export async function handleDownloaderStart() {
  const urlInput = document.getElementById('downloader-url-input');
  if (!urlInput) return;

  const url = urlInput.value.trim();
  const { localDb } = _getState();
  const isEn = localDb.settings && localDb.settings.lang === 'en';

  if (!url) {
    showToast(isEn ? 'Please enter a valid URL.' : 'Lütfen geçerli bir URL girin.', 'error');
    return;
  }

  const formatSelect = document.getElementById('downloader-format-select');
  const bitrateSelect = document.getElementById('downloader-bitrate-select');
  const format = formatSelect ? formatSelect.value : 'video-best';
  const bitrate = (format === 'audio-mp3' && bitrateSelect) ? bitrateSelect.value : null;

  const startBtn = document.getElementById('downloader-start-btn');
  if (startBtn) {
    startBtn.disabled = true;
    startBtn.innerHTML = `<i class="toast-icon spin" data-lucide="loader" style="width:14px;height:14px;display:inline-block;vertical-align:middle;margin-right:5px;"></i> <span>${isEn ? 'Processing...' : 'İşleniyor...'}</span>`;
    if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
  }

  try {
    const isPlaylist = url.includes('list=') && !url.includes('watch?v=');

    if (isPlaylist) {
      showToast(isEn ? 'Resolving playlist, please wait...' : 'Playlist çözümleniyor, lütfen bekleyin...', 'info');
      const res = await fetch('/api/downloader/resolve-playlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      });
      const data = await res.json();

      if (data.success && data.videos && data.videos.length > 0) {
        activePlaylistVideos = data.videos;
        renderPlaylistResults(data.videos);
        showToast(isEn ? `${data.videos.length} videos found.` : `${data.videos.length} video bulundu.`, 'success');
      } else {
        showToast(data.error || (isEn ? 'Failed to resolve playlist.' : 'Playlist çözümlenemedi.'), 'error');
      }
    } else {
      const res = await fetch('/api/downloader/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, format, bitrate })
      });
      const data = await res.json();
      if (data.success) {
        showToast(isEn ? 'Added to download queue.' : 'Kuyruğa başarıyla eklendi.', 'success');
        urlInput.value = '';
        if (window.switchTab) window.switchTab('queue');
      } else {
        showToast(data.error || (isEn ? 'Failed to start download.' : 'İndirme başlatılamadı.'), 'error');
      }
    }
  } catch (err) {
    showToast(isEn ? 'Connection error.' : 'Bağlantı hatası.', 'error');
  } finally {
    if (startBtn) {
      startBtn.disabled = false;
      startBtn.innerHTML = `<i data-lucide="download"></i> <span>${isEn ? 'Start Download' : 'İndirmeyi Başlat'}</span>`;
      if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
    }
  }
}

export async function handleDownloaderAll() {
  if (activePlaylistVideos.length === 0) return;
  const { localDb } = _getState();
  const isEn = localDb.settings && localDb.settings.lang === 'en';

  const checkboxes = document.querySelectorAll('.playlist-item-checkbox:checked');
  if (checkboxes.length === 0) {
    showToast(isEn ? 'Please select at least one video.' : 'Lütfen en az bir video seçin.', 'error');
    return;
  }

  const selectedIds = Array.from(checkboxes).map(cb => cb.getAttribute('data-id'));
  const targetVideos = activePlaylistVideos.filter(v => selectedIds.includes(v.id));

  const formatSelect = document.getElementById('downloader-format-select');
  const bitrateSelect = document.getElementById('downloader-bitrate-select');
  const format = formatSelect ? formatSelect.value : 'video-best';
  const bitrate = (format === 'audio-mp3' && bitrateSelect) ? bitrateSelect.value : null;

  const downloadAllBtn = document.getElementById('downloader-download-all-btn');
  if (downloadAllBtn) {
    downloadAllBtn.disabled = true;
  }

  let addedCount = 0;
  for (const video of targetVideos) {
    try {
      const videoUrl = `https://www.youtube.com/watch?v=${video.id}`;
      const res = await fetch('/api/downloader/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: videoUrl,
          format,
          bitrate,
          title: video.title,
          channelId: 'manual',
          channelName: video.uploader || 'Manuel İndirme'
        })
      });
      const data = await res.json();
      if (data.success) {
        addedCount++;
      }
    } catch (e) {
      console.error('Playlist video ekleme hatası:', e);
    }
  }

  showToast(isEn ? `${addedCount} videos added to queue.` : `${addedCount} video kuyruğa eklendi.`, 'success');

  const playlistResults = document.getElementById('downloader-playlist-results');
  if (playlistResults) playlistResults.classList.add('hidden');
  const urlInput = document.getElementById('downloader-url-input');
  if (urlInput) urlInput.value = '';
  activePlaylistVideos = [];

  if (downloadAllBtn) {
    downloadAllBtn.disabled = false;
  }

  if (window.switchTab) window.switchTab('queue');
}

export function renderPlaylistResults(videos) {
  const container = document.getElementById('downloader-playlist-results');
  const listContainer = document.getElementById('downloader-playlist-list');
  if (!container || !listContainer) return;

  listContainer.innerHTML = '';
  videos.forEach((video, index) => {
    const item = document.createElement('div');
    item.className = 'downloader-playlist-item';
    item.setAttribute('data-video-id', video.id);

    let durationStr = '';
    if (video.duration) {
      const min = Math.floor(video.duration / 60);
      const sec = Math.floor(video.duration % 60);
      durationStr = `${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
    }

    const thumbUrl = video.thumbnail || `https://i.ytimg.com/vi/${video.id}/hqdefault.jpg`;

    item.innerHTML = `
      <input type="checkbox" class="playlist-item-checkbox" checked data-id="${video.id}" onclick="event.stopPropagation();" />
      <span class="item-index">${index + 1}</span>
      <div class="playlist-item-thumb-wrap">
        <img src="${thumbUrl}" class="playlist-item-thumb" onerror="this.src='logo.png';" />
      </div>
      <span class="item-title" title="${escapeHtml(video.title)}">${escapeHtml(video.title)}</span>
      <span class="item-duration">${durationStr}</span>
    `;

    item.addEventListener('click', (e) => {
      if (e.target.tagName !== 'INPUT') {
        const cb = item.querySelector('.playlist-item-checkbox');
        if (cb) cb.checked = !cb.checked;
      }
    });

    listContainer.appendChild(item);
  });

  container.classList.remove('hidden');
}

export async function downloadMissingVideo(videoId, title, channelName, channelId) {
  const { localDb } = _getState();
  const isEn = localDb.settings && localDb.settings.lang === 'en';
  try {
    showToast(isEn ? 'Adding video to download queue...' : 'Video indirme kuyruğuna ekleniyor...', 'info');
    const res = await fetch('/api/downloader/download', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: videoId,
        title: title,
        channelName: channelName,
        channelId: channelId
      })
    });
    const data = await res.json();
    if (data.success) {
      showToast(isEn ? 'Added to download queue.' : 'Kuyruğa başarıyla eklendi.', 'success');
      if (window.switchTab) window.switchTab('queue');
    } else {
      showToast(data.error || (isEn ? 'Failed to add to queue.' : 'Kuyruğa eklenemedi.'), 'error');
    }
  } catch (err) {
    showToast(isEn ? 'Connection error.' : 'Bağlantı hatası.', 'error');
  }
}

export async function downloadVideoManual(videoId) {
  const { localDb } = _getState();
  const item = localDb.history?.find(h => h.id === videoId);
  const title = item ? item.title : 'Bilinmeyen Video';
  const channelName = item ? item.channelName : 'Manuel İndirme';
  const channelId = item ? item.channelId : 'manual';

  try {
    showToast(`İndirme başlatılıyor: ${title}`, 'info');
    const res = await fetch('/api/download-video', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ videoId, title, channelName, channelId })
    });
    const data = await res.json();
    if (data.success) {
      showToast('Kuyruğa eklendi.', 'success');
    } else {
      showToast(data.error || 'İndirme tetiklenemedi.', 'error');
    }
  } catch (err) {
    showToast('Sunucu ile iletişim hatası.', 'error');
  }
}

// ─── İNDİRME İPTALİ VE KUYRUK İŞLEMLERİ ───

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

export async function cancelQueuedVideo(videoId) {
  if (!confirm('Bu videoyu indirme sırasından çıkarmak istediğinizden emin misiniz?')) return;

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

export async function cancelAllQueued() {
  const { localDb } = _getState();
  const isEn = localDb.settings && localDb.settings.lang === 'en';
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

export async function resetDownloadEngine() {
  const { translations } = _getState();
  const currentLang = localStorage.getItem('haytool_user_lang') || 'tr';
  const t = translations[currentLang] || translations.tr;
  const msg = t.reset_engine_confirm || 'İndirme motoru ve askıdaki süreç kilitleri sıfırlanacak. Devam etmek istiyor musunuz?';
  if (!confirm(msg)) return;

  try {
    const res = await fetch('/api/queue/reset-engine', { method: 'POST' });
    const data = await res.json();
    if (data.success) {
      showToast(t.reset_engine_success || 'İndirme motoru başarıyla sıfırlandı.', 'success');
    } else {
      showToast(data.error || 'Sıfırlama sırasında bir hata oluştu.', 'error');
    }
  } catch (err) {
    showToast(`Hata: ${err.message}`, 'error');
  }
}
