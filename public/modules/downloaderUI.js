/**
 * HaYTooL YouTube Downloader - İndirici Arayüzü Modülü
 *
 * Sorumluluklar:
 *   - handleDownloaderStart()    : Tekil video veya playlist URL'sini işler
 *   - handleDownloaderAll()      : Playlist'teki seçili videoları kuyruğa ekler
 *   - renderPlaylistResults()    : Playlist video listesini arayüzde gösterir
 *   - downloadMissingVideo()     : Kütüphaneden eksik videoyu yeniden kuyruğa ekler
 *
 * Bağımlılıklar:
 *   - showToast (global)
 *   - localDb (global)
 *   - switchTab (global window.switchTab)
 *   - escapeHtml (global window.escapeHtml veya doğrudan import)
 *   - runFileComparison (global window.runFileComparison, tools.js)
 *   - activePlaylistVideos (global, app.js'de tanımlı)
 *
 * Yapımcı: HaYTo
 * İletişim: korazhayto@gmail.com
 */

import { escapeHtml } from '../utils/helpers.js';

export async function handleDownloaderStart() {
  const urlInput = document.getElementById('downloader-url-input');
  if (!urlInput) return;

  const url = urlInput.value.trim();
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
    lucide.createIcons();
  }

  try {
    // Playlist URL kontrolü
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
      // Tekil video indir
      const res = await fetch('/api/downloader/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, format, bitrate })
      });
      const data = await res.json();
      if (data.success) {
        showToast(isEn ? 'Added to download queue.' : 'Kuyruğa başarıyla eklendi.', 'success');
        urlInput.value = '';
        switchTab('queue');
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
      lucide.createIcons();
    }
  }
}

export async function handleDownloaderAll() {
  if (activePlaylistVideos.length === 0) return;
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

  // Temizle ve Kuyruğa yönlendir
  document.getElementById('downloader-playlist-results').classList.add('hidden');
  document.getElementById('downloader-url-input').value = '';
  activePlaylistVideos = [];

  if (downloadAllBtn) {
    downloadAllBtn.disabled = false;
  }

  switchTab('queue');
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
      showToast(isEn ? 'Video added to queue successfully.' : 'Video kuyruğa başarıyla eklendi.', 'success');
      if (window.runFileComparison) window.runFileComparison();
    } else {
      showToast(data.error || (isEn ? 'Failed to queue video.' : 'Kuyruğa eklenemedi.'), 'error');
    }
  } catch (err) {
    showToast(isEn ? 'Connection error.' : 'Bağlantı hatası.', 'error');
  }
}

// Geriye dönük window.* köprüsü (HTML inline onclick bağlamı için)
window.handleDownloaderStart = handleDownloaderStart;
window.handleDownloaderAll = handleDownloaderAll;
window.renderPlaylistResults = renderPlaylistResults;
window.downloadMissingVideo = downloadMissingVideo;
