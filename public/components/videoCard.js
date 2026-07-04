// Türkçe Açıklama: Kütüphane ve İndirilenler sayfalarında videoların kart (grid) veya liste (compact) görünümünde çizilmesini sağlayan UI bileşeni.

import { escapeHtml, formatDate, getDaysAgoText, isShortVideo } from '../utils/helpers.js';
import { translations } from '../utils/i18n.js';

// YouTube SVG İkon Şablonu
export const youtubeSvgIcon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" style="display:inline-block !important;vertical-align:middle !important;fill:#ff0000 !important;stroke:none !important;width:16px !important;height:16px !important;"><path d="M23.498 6.163a3.003 3.003 0 0 0-2.11-2.11C19.517 3.545 12 3.545 12 3.545s-7.516 0-9.388.508a3.003 3.003 0 0 0-2.11 2.11C0 8.033 0 12 0 12s0 3.967.502 5.837a3.003 3.003 0 0 0 2.11 2.11c1.872.508 9.388.508 9.388.508s7.517 0 9.388-.508a3.003 3.003 0 0 0 2.11-2.11C24 15.967 24 12 24 12s0-3.967-.502-5.837zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" style="fill:#ff0000 !important;stroke:none !important;"/></svg>`;

/**
 * Belirtilen video listesini hedef DOM elemanı içerisine kart veya liste düzeninde render eder.
 * 
 * @param {HTMLElement} gridElement Hedef çizim DOM elemanı (örn: history-grid)
 * @param {Array<object>} videosList Çizilecek videoların veri dizisi
 * @param {'grid'|'list'} viewMode Arayüz görünüm modu
 * @returns {void}
 */
export function renderVideoGrid(gridElement, videosList, viewMode) {
  if (!gridElement) return;
  gridElement.innerHTML = '';
  
  if (viewMode === 'list') {
    gridElement.classList.add('compact-list');
  } else {
    gridElement.classList.remove('compact-list');
  }

  const isEn = window.localDb && window.localDb.settings && window.localDb.settings.lang === 'en';

  if (videosList.length === 0) {
    gridElement.innerHTML = `
      <div class="card text-center" style="grid-column: 1 / -1; padding: 40px; background-color: var(--bg-card); border: 1px solid var(--border-color); border-radius: 16px;">
        <p class="text-muted">${isEn ? 'No video records match the filter.' : 'Filtreye uygun video kaydı bulunmuyor.'}</p>
      </div>
    `;
    return;
  }

  videosList.forEach(item => {
    const isShort = isShortVideo(item.duration, item.title, item.channelId);
    const card = document.createElement('div');
    card.className = 'video-card' + (isShort ? ' is-short' : '');
    card.setAttribute('data-id', item.id);
    if (typeof window.downloadedSortVal !== 'undefined' && window.downloadedSortVal === 'user' && gridElement === window.downloadedGrid) {
      card.setAttribute('draggable', 'true');
    }
    
    let statusHtml = '';
    let actionsHtml = '';

    const isMissing = item.fileMissing === true;
    const isCompleted = item.status === 'completed';
    const canPlayEmbedded = isCompleted && !isMissing;

    const clickAction = `playVideoEmbedded('${item.id}')`;
    const clickTitle = isEn ? 'Play video' : 'Videoyu Gömülü Oynatıcıda Aç';

    const t = translations[window.localDb?.settings?.lang || 'tr'] || translations.tr;

    if (item.duration === 'live') {
      statusHtml = `<span class="status-pill live"><span class="live-dot animate-pulse"></span>${isEn ? 'LIVE' : 'CANLI'}</span>`;
      actionsHtml = `
        <button class="btn-icon" onclick="openYouTube('${item.id}')" title="${isEn ? 'Open on YouTube' : 'YouTube\'da Aç'}">
          ${youtubeSvgIcon}
        </button>
        <button class="btn-icon btn-icon-primary" onclick="playVideoEmbedded('${item.id}')" title="${isEn ? 'Watch Live Stream' : 'Canlı Yayını İzle'}">
          <i data-lucide="tv"></i>
        </button>
      `;
    } else if (item.status === 'completed') {
      if (isMissing) {
        statusHtml = `<span class="status-dot-warning" title="${isEn ? 'File not found on disk!' : 'Dosya disk üzerinde bulunamadı!'}"></span>`;
        actionsHtml = `
          <button class="btn-icon" onclick="openYouTube('${item.id}')" title="${isEn ? 'Open on YouTube' : 'YouTube\'da Aç'}">
            ${youtubeSvgIcon}
          </button>
          <button class="btn-icon btn-icon-primary" disabled title="${isEn ? 'File missing on disk' : 'Dosya diskte mevcut değil'}" style="opacity:0.4; cursor:not-allowed;">
            <i data-lucide="tv"></i>
          </button>
          <button class="btn-icon" disabled title="${isEn ? 'File missing on disk' : 'Dosya diskte mevcut değil'}" style="opacity:0.4; cursor:not-allowed;">
            <i data-lucide="folder-open"></i>
          </button>
        `;
      } else {
        statusHtml = `<span class="status-dot-completed" title="${isEn ? 'Downloaded' : 'İndirildi'}"></span>`;
        actionsHtml = `
          <button class="btn-icon" onclick="openYouTube('${item.id}')" title="${isEn ? 'Open on YouTube' : 'YouTube\'da Aç'}">
            ${youtubeSvgIcon}
          </button>
          <button class="btn-icon btn-icon-primary" onclick="playVideoSystem('${item.id}')" title="${isEn ? 'Open in System Player' : 'Sistem Oynatıcısında Aç'}">
            <i data-lucide="tv"></i>
          </button>
          <button class="btn-icon" onclick="openFolder(decodeURIComponent('${encodeURIComponent(item.channelName)}'))" title="${isEn ? 'Open Channel Folder' : 'Kanal Klasörünü Aç'}">
            <i data-lucide="folder-open"></i>
          </button>
        `;
      }
    } else if (item.status === 'downloading') {
      statusHtml = `<span class="status-pill downloading"><i data-lucide="loader" class="pulse-animation" style="width:12px;height:12px;margin-right:4px;"></i> ${isEn ? 'Downloading' : 'İndiriliyor'} (${item.progress}%)</span>`;
      actionsHtml = `
        <button class="btn-icon" onclick="cancelDownload('${item.id}')" title="${isEn ? 'Cancel Download' : 'İndirmeyi İptal Et'}" style="color: var(--accent-red); background: rgba(255, 0, 85, 0.05); border: 1px solid rgba(255, 0, 85, 0.15);">
          <i data-lucide="square"></i>
        </button>
        <button class="btn-icon" onclick="openYouTube('${item.id}')" title="YouTube'da Aç">
          ${youtubeSvgIcon}
        </button>
      `;
    } else if (item.status === 'waiting') {
      statusHtml = `<span class="status-pill waiting"><i data-lucide="clock" style="width:12px;height:12px;margin-right:4px;"></i> ${isEn ? 'In Queue' : 'Kuyrukta'}</span>`;
      actionsHtml = `
        <button class="btn-icon" onclick="cancelQueuedVideo('${item.id}')" title="${isEn ? 'Cancel' : 'İptal Et'}" style="color: var(--accent-red); background: rgba(255, 0, 85, 0.05); border: 1px solid rgba(255, 0, 85, 0.15);">
          <i data-lucide="square"></i>
        </button>
        <button class="btn-icon" onclick="openYouTube('${item.id}')" title="YouTube'da Aç">
          ${youtubeSvgIcon}
        </button>
      `;
    } else if (item.status === 'failed') {
      statusHtml = `<span class="status-pill failed" title="${item.error || ''}"><i data-lucide="alert-circle" style="width:12px;height:12px;margin-right:4px;"></i> ${isEn ? 'Error' : 'Hata'}</span>`;
      actionsHtml = `
        <button class="btn-icon" onclick="downloadVideoManual('${item.id}')" title="${isEn ? 'Retry Download' : 'Yeniden İndirmeyi Dene'}">
          <i data-lucide="rotate-ccw"></i>
        </button>
        <button class="btn-icon" onclick="openYouTube('${item.id}')" title="YouTube'da Aç">
          ${youtubeSvgIcon}
        </button>
      `;
    } else if (item.status === 'ignored') {
      statusHtml = `<span class="status-dot-warning" style="background-color: var(--accent-red); box-shadow: 0 0 8px rgba(255, 0, 85, 0.8);" title="${isEn ? 'Ignored' : 'Göz Ardı Edildi'}"></span>`;
      actionsHtml = `
        <button class="btn-icon" onclick="downloadVideoManual('${item.id}')" title="${isEn ? 'Download Now' : 'Videoyu Şimdi İndir'}">
          <i data-lucide="download"></i>
        </button>
        <button class="btn-icon" onclick="openYouTube('${item.id}')" title="YouTube'da Aç">
          ${youtubeSvgIcon}
        </button>
      `;
    }

    if (item.status === 'completed' && item.duration !== 'live') {
      actionsHtml += `
        <button class="btn-icon video-action-delete" onclick="showDeleteModal('${item.id}')" title="${isEn ? 'Delete from History/Disk' : 'Geçmişten/Diskten Sil'}">
          <i data-lucide="trash-2"></i>
        </button>
      `;
    }

    if (gridElement.id === 'history-grid') {
      if (item.hidden === true) {
        actionsHtml += `
          <button class="btn-icon video-action-unhide" onclick="event.stopPropagation(); unhideVideo('${item.id}')" title="${isEn ? 'Unhide Video' : 'Videoyu Göster'}" style="color: var(--success);">
            <i data-lucide="eye"></i>
          </button>
        `;
      } else {
        const isDownloaded = item.status === 'completed' && !isMissing;
        if (!isDownloaded || item.duration === 'live') {
          actionsHtml += `
            <button class="btn-icon video-action-hide" onclick="event.stopPropagation(); hideVideo('${item.id}')" title="${t.label_history_hide || 'Hide'}">
              <i data-lucide="eye-off"></i>
            </button>
          `;
        }
      }
    }

    let durationText = item.duration || '';
    if (durationText === 'upcoming') {
      durationText = isEn ? 'Upcoming' : 'Yakında';
    } else if (durationText === 'live') {
      durationText = isEn ? 'Live' : 'Canlı';
    }

    const durationBadgeHtml = durationText 
      ? `<div class="video-duration-badge">${durationText}</div>` 
      : '';

    const shortsBadgeHtml = isShort 
      ? `<div class="video-shorts-badge"><i data-lucide="zap" style="width:10px;height:10px;margin-right:2px;"></i> Shorts</div>` 
      : '';

    const shortsTagHtml = isShort 
      ? `<span class="video-card-shorts-tag"><i data-lucide="zap" style="width:10px;height:10px;margin-right:2px;"></i> Shorts</span>` 
      : '';

    card.innerHTML = `
      <div class="video-thumbnail-wrapper" onclick="${clickAction}" style="cursor: pointer;" title="${clickTitle}">
        <img class="video-thumbnail" src="/api/video/${item.id}/thumbnail" alt="Video Resmi" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22320%22 height=%22180%22><rect width=%22320%22 height=%22180%22 fill=%22%2316142a%22/><text x=%2250%25%22 y=%2250%25%22 dominant-baseline=%22middle%22 text-anchor=%22middle%22 fill=%22%2394a3b8%22 font-family=%22sans-serif%22 font-size=%2214%22>Kapak Resmi Yok</text></svg>'">
        ${durationBadgeHtml}
        ${shortsBadgeHtml}
      </div>
      <div class="video-card-content">
        <h3 class="video-card-title" onclick="${clickAction}" style="cursor: pointer;" title="${clickTitle}: ${escapeHtml(item.title)}">${escapeHtml(item.title)}</h3>
        <div style="display:flex; align-items:center; gap:8px; margin-bottom:8px;">
          <span class="video-card-duration-text">${durationText || (isEn ? 'Duration Not Specified' : 'Süre Belirtilmedi')}</span>
          ${shortsTagHtml}
        </div>
        <div class="video-card-metadata">
          <span class="video-card-channel clickable-channel" ${item.channelId ? `onclick="event.stopPropagation(); filterByChannel('${item.channelId}', '${gridElement.id}')"` : ''} style="cursor: pointer; text-decoration: underline; display: inline-flex; align-items: center; gap: 4px;">
            ${item.channelId 
              ? `<img src="/api/channels/${item.channelId}/avatar" class="video-card-channel-avatar" onerror="this.style.display='none';" />` 
              : ''}
            ${escapeHtml(item.channelName)}
          </span>
          <span>${isEn ? 'Date' : 'Tarih'}: ${formatDate(item.publishedAt || item.downloadedAt)}</span>
          ${item.status === 'completed' ? `<span>${isEn ? 'Size' : 'Boyut'}: ${item.fileSize || '-- MB'}</span>` : ''}
        </div>
        <div class="video-card-bottom">
          <div style="display: flex; align-items: center; gap: 8px;">
            ${statusHtml}
            <span class="video-card-age-text" style="font-size: 0.75rem; color: var(--text-muted); font-weight: 500; display: inline-block;">
               ${getDaysAgoText(item.publishedAt || item.downloadedAt, isEn)}
            </span>
          </div>
          <div class="video-card-actions">
            ${actionsHtml}
          </div>
        </div>
      </div>
    `;
    gridElement.appendChild(card);
  });

  try {
    lucide.createIcons();
  } catch (e) {
    // Kasıtlı sessiz
  }
}
