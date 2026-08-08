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

  const lang = window.localDb?.settings?.lang || 'tr';
  const t = translations[lang] || translations.tr;
  const isEn = lang === 'en';

  if (videosList.length === 0) {
    gridElement.innerHTML = `
      <div class="card text-center" style="grid-column: 1 / -1; padding: 40px; background-color: var(--bg-card); border: 1px solid var(--border-color); border-radius: 16px;">
        <p class="text-muted">${t.card_no_video_filter || 'Filtreye uygun video kaydı bulunmuyor.'}</p>
      </div>
    `;
    return;
  }

  videosList.forEach(item => {
    const isShort = isShortVideo(item.duration, item.title, item.channelId);
    const isBulkMode = window.isDownloadedBulkDeleteMode === true && gridElement.id === 'downloaded-grid';
    const isBulkHideMode = window.isHistoryBulkHideMode === true && gridElement.id === 'history-grid';
    // Bir kart gizlenebilir: history-grid'de, indirilmemiş veya canlı, henüz gizlenmemiş
    const isMissingCheck = item.fileMissing === true;
    const isCompletedCheck = item.status === 'completed';
    const isHideEligible = isBulkHideMode && (!isCompletedCheck || item.duration === 'live') && item.hidden !== true;

    const card = document.createElement('div');
    card.className = 'video-card'
      + (isShort ? ' is-short' : '')
      + (isBulkMode ? ' bulk-delete-active' : '')
      + (isBulkHideMode ? ' bulk-hide-active' : '')
      + (isBulkHideMode && !isHideEligible ? ' bulk-hide-ineligible' : '');
    card.setAttribute('data-id', item.id);
    if (typeof window.downloadedSortVal !== 'undefined' && window.downloadedSortVal === 'user' && gridElement === window.downloadedGrid) {
      card.setAttribute('draggable', 'true');
    }
    
    let statusHtml = '';
    let actionsHtml = '';

    const isMissing = item.fileMissing === true;
    const isCompleted = item.status === 'completed';

    const clickAction = isBulkMode
      ? `toggleDownloadedCardSelection('${item.id}')`
      : (isBulkHideMode && isHideEligible)
        ? `toggleHistoryBulkHideCardSelection('${item.id}')`
        : `playVideoEmbedded('${item.id}')`;
    const clickTitle = isBulkMode
      ? (t.card_select_video || 'Videoyu Seç')
      : (isBulkHideMode && isHideEligible)
        ? (t.history_bulk_hide_toggle || 'Toplu Gizle')
        : '';

    if (item.duration === 'live') {
      statusHtml = `<span class="status-pill live"><span class="live-dot animate-pulse"></span>${t.card_live || 'CANLI'}</span>`;
      actionsHtml = `
        <button class="btn-icon btn-action-yt" onclick="openYouTube('${item.id}')" title="${t.btn_open_youtube || 'YouTube\'da Aç'}">
          ${youtubeSvgIcon}
        </button>
        <button class="btn-icon btn-action-play" onclick="playVideoEmbedded('${item.id}')" title="${t.card_watch_live || 'Canlı Yayını İzle'}">
          <i data-lucide="monitor-play"></i>
        </button>
      `;
    } else if (item.status === 'completed') {
      if (isMissing) {
        // Türkçe Açıklama: Dosya diskte bulunamazsa sarı uyarı noktası ve devre dışı butonlar gösterilir.
        statusHtml = `<span class="status-dot-warning" title="${t.card_file_missing || 'Dosya disk üzerinde bulunamadı!'}"></span>`;
        actionsHtml = `
          <button class="btn-icon btn-action-yt" onclick="openYouTube('${item.id}')" title="${t.btn_open_youtube || 'YouTube\'da Aç'}">
            ${youtubeSvgIcon}
          </button>
          <button class="btn-icon" disabled title="${t.card_file_missing_desc || 'Dosya diskte mevcut değil'}" style="opacity:0.35; cursor:not-allowed;">
            <i data-lucide="monitor-play"></i>
          </button>
          <button class="btn-icon" disabled title="${t.card_file_missing_desc || 'Dosya diskte mevcut değil'}" style="opacity:0.35; cursor:not-allowed;">
            <i data-lucide="folder-open"></i>
          </button>
        `;
      } else {
        // Türkçe Açıklama: Başarıyla indirilmiş videolar yeşil nokta ve tam aksiyon butonlarıyla gösterilir.
        statusHtml = `<span class="status-dot-completed" title="${t.card_download_completed || 'İndirildi'}"></span>`;
        actionsHtml = `
          <button class="btn-icon btn-action-yt" onclick="openYouTube('${item.id}')" title="${t.btn_open_youtube || 'YouTube\'da Aç'}">
            ${youtubeSvgIcon}
          </button>
          <button class="btn-icon btn-action-play" onclick="playVideoSystem('${item.id}')" title="${t.card_open_system_player || 'Sistem Oynatıcısında Aç'}">
            <i data-lucide="monitor-play"></i>
          </button>
          <button class="btn-icon btn-action-folder" onclick="openFolder(decodeURIComponent('${encodeURIComponent(item.channelName)}'))" title="${t.card_open_channel_folder || 'Kanal Klasörünü Aç'}">
            <i data-lucide="folder-open"></i>
          </button>
        `;
      }
    } else if (item.status === 'downloading') {
      statusHtml = `<span class="status-pill downloading"><i data-lucide="loader" class="pulse-animation" style="width:12px;height:12px;margin-right:4px;"></i> ${(t.active_download_progress || 'İndiriliyor').replace(':', '')} (${item.progress}%)</span>`;
      actionsHtml = `
        <button class="btn-icon btn-action-cancel" onclick="cancelDownload('${item.id}')" title="${t.card_cancel_download || 'İndirmeyi İptal Et'}">
          <i data-lucide="square"></i>
        </button>
        <button class="btn-icon btn-action-yt" onclick="openYouTube('${item.id}')" title="${t.btn_open_youtube || 'YouTube\'da Aç'}">
          ${youtubeSvgIcon}
        </button>
      `;
    } else if (item.status === 'waiting') {
      statusHtml = `<span class="status-pill waiting"><i data-lucide="clock" style="width:12px;height:12px;margin-right:4px;"></i> ${t.card_in_queue || 'Kuyrukta'}</span>`;
      actionsHtml = `
        <button class="btn-icon btn-action-cancel" onclick="cancelQueuedVideo('${item.id}')" title="${t.active_download_cancel || 'İptal Et'}">
          <i data-lucide="square"></i>
        </button>
        <button class="btn-icon btn-action-yt" onclick="openYouTube('${item.id}')" title="${t.btn_open_youtube || 'YouTube\'da Aç'}">
          ${youtubeSvgIcon}
        </button>
      `;
    } else if (item.status === 'waiting_duration') {
      statusHtml = `<span class="status-pill waiting_duration" style="background-color: var(--warning-light, rgba(245, 158, 11, 0.15)); color: var(--warning-color, #d97706);"><i data-lucide="clock" style="width:12px;height:12px;margin-right:4px;"></i> ${t.card_waiting_duration || 'Süre Analizi'}</span>`;
      actionsHtml = `
        <button class="btn-icon btn-action-cancel" onclick="cancelQueuedVideo('${item.id}')" title="${t.active_download_cancel || 'İptal Et'}">
          <i data-lucide="square"></i>
        </button>
        <button class="btn-icon btn-action-yt" onclick="openYouTube('${item.id}')" title="${t.btn_open_youtube || 'YouTube\'da Aç'}">
          ${youtubeSvgIcon}
        </button>
      `;
    } else if (item.status === 'failed') {
      let shortError = '';
      if (item.error) {
        const errorLines = item.error.split('\n')
          .map(l => l.trim())
          .filter(l => l.toUpperCase().includes('ERROR:'));
        if (errorLines.length > 0) {
          shortError = errorLines[errorLines.length - 1];
        } else {
          shortError = item.error.split('\n')[0] || item.error;
        }
        if (shortError.length > 150) {
          shortError = shortError.substring(0, 150) + '...';
        }
      }
      if (!shortError) {
        shortError = t.downloader_invalid_url || 'İndirme başarısız oldu';
      }

      const isMembersOnly = item.isMembersOnly || (item.error && /yeler|üyeler|members-only|katıl|katil|join this channel|ayrıcalık|ayrcal/i.test(item.error));

      if (isMembersOnly) {
        const tooltipText = t.card_members_only ? `${t.card_members_only}: ${shortError}` : shortError;
        statusHtml = `<span class="status-dot-members" title="${escapeHtml(tooltipText)}"></span>`;
      } else {
        statusHtml = `<span class="status-dot-failed" title="${escapeHtml(shortError)}"></span>`;
      }

      actionsHtml = `
        <button class="btn-icon btn-action-retry" onclick="downloadVideoManual('${item.id}')" title="${t.card_retry_download || 'Yeniden İndirmeyi Dene'}">
          <i data-lucide="rotate-ccw"></i>
        </button>
        <button class="btn-icon btn-action-yt" onclick="openYouTube('${item.id}')" title="${t.btn_open_youtube || 'YouTube\'da Aç'}">
          ${youtubeSvgIcon}
        </button>
      `;
    } else if (item.status === 'ignored') {
      // Türkçe Açıklama: Göz ardı edilmiş videolar mavi nokta ile işaretlenir.
      statusHtml = `<span class="status-dot-ignored" title="${t.card_download_now || 'Göz Ardı Edildi'}"></span>`;
      actionsHtml = `
        <button class="btn-icon btn-action-download" onclick="downloadVideoManual('${item.id}')" title="${t.card_download_now || 'Videoyu Şimdi İndir'}">
          <i data-lucide="download"></i>
        </button>
        <button class="btn-icon btn-action-yt" onclick="openYouTube('${item.id}')" title="${t.btn_open_youtube || 'YouTube\'da Aç'}">
          ${youtubeSvgIcon}
        </button>
      `;
    }

    if (item.status === 'completed' && item.duration !== 'live') {
      actionsHtml += `
        <button class="btn-icon video-action-delete" onclick="showDeleteModal('${item.id}')" title="${t.btn_delete_history || 'Geçmişten/Diskten Sil'}">
          <i data-lucide="trash-2"></i>
        </button>
      `;
    }

    if (gridElement.id === 'history-grid') {
      if (item.hidden === true) {
        actionsHtml += `
          <button class="btn-icon video-action-unhide" onclick="event.stopPropagation(); unhideVideo('${item.id}')" title="${t.card_unhide_video || 'Videoyu Göster'}" style="color: var(--success);">
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
      durationText = t.shorts_limit_hours === 'h' ? 'Upcoming' : 'Yakında';
    } else if (durationText === 'live') {
      durationText = t.card_live || 'Canlı';
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
      <div class="video-thumbnail-wrapper" data-video-id="${item.id}" onmouseenter="handleThumbMouseEnter(this)" onmouseleave="handleThumbMouseLeave(this)" onclick="${clickAction}" style="cursor: pointer;" title="${clickTitle}">
        <img class="video-thumbnail" src="/api/video/${item.id}/thumbnail" alt="Video Resmi" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22320%22 height=%22180%22><rect width=%22320%22 height=%22180%22 fill=%22%2316142a%22/><text x=%2250%25%22 y=%2250%25%22 dominant-baseline=%22middle%22 text-anchor=%22middle%22 fill=%22%2394a3b8%22 font-family=%22sans-serif%22 font-size=%2214%22>Kapak Resmi Yok</text></svg>'">
        ${durationBadgeHtml}
        ${shortsBadgeHtml}
        ${isBulkMode ? `
        <label class="downloaded-bulk-delete-checkbox-wrap" onclick="event.stopPropagation()">
          <input type="checkbox" class="downloaded-bulk-delete-cb" data-id="${item.id}" onchange="updateDownloadedBulkDeleteCount(event)" onclick="event.stopPropagation()">
        </label>
        ` : ''}
        ${isHideEligible ? `
        <label class="history-bulk-hide-checkbox-wrap" onclick="event.stopPropagation()">
          <input type="checkbox" class="history-bulk-hide-cb" data-id="${item.id}" onchange="updateHistoryBulkHideCount(event)" onclick="event.stopPropagation()">
        </label>
        ` : ''}
      </div>
      <div class="video-card-content">
        <h3 class="video-card-title" onclick="${clickAction}" style="cursor: pointer;" title="${escapeHtml(item.title)}">${escapeHtml(item.title)}</h3>
        <div style="display:flex; align-items:center; gap:8px; margin-bottom:8px;">
          <span class="video-card-duration-text">${durationText || (t.card_duration_not_specified || 'Süre Belirtilmedi')}</span>
          ${shortsTagHtml}
        </div>
        <div class="video-card-metadata">
          <span class="video-card-channel clickable-channel" ${item.channelId ? `onclick="event.stopPropagation(); filterByChannel('${item.channelId}', '${gridElement.id}')"` : ''} style="cursor: pointer; text-decoration: underline; display: inline-flex; align-items: center; gap: 4px;">
            ${item.channelId 
              ? `<img src="/api/channels/${item.channelId}/avatar" class="video-card-channel-avatar" onerror="this.style.display='none';" />` 
              : ''}
            ${escapeHtml(item.channelName)}
          </span>
          <span>${t.card_date || 'Tarih'}: ${formatDate(item.publishedAt || item.downloadedAt)}</span>
          ${item.status === 'completed' ? `<span>${t.card_size || 'Boyut'}: ${item.fileSize || '-- MB'}</span>` : ''}
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
