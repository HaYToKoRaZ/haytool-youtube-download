/**
 * HaYTooL YT Downloader - SponsorBlock Module
 * public/modules/player/sponsorBlock.js
 * 
 * Oynatılan videolar için SponsorBlock API segmentlerini çeker,
 * oynatıcı zaman çizgisi üzerine renkli işaretçiler yerleştirir,
 * geçerli zamana göre sponsorlu alanları otomatik atlar ve durum butonunu yönetir.
 */

import { showToast } from '../../components/toast.js';

// Module-level isolated state
let currentVideoSponsorSegments = [];
let lastSkippedSegmentStart = -1;

export function getSponsorSegments() {
  return currentVideoSponsorSegments;
}

export function clearSponsorSegments() {
  currentVideoSponsorSegments = [];
  lastSkippedSegmentStart = -1;
}

/**
 * SponsorBlock segmentlerini oynatıcı zaman çizgisi üzerine renkli işaretçiler olarak çizer.
 * @param {number} duration Videonun toplam süresi (saniye)
 * @param {string} playerType Oynatıcı türü ('plyr')
 */
export function drawSponsorSegmentsOnTimeline(duration, playerType = 'plyr') {
  if (!duration || !currentVideoSponsorSegments || currentVideoSponsorSegments.length === 0) return;

  let container = null;
  if (playerType === 'plyr') {
    const inlineContainer = document.getElementById('downloaded-inline-player-container');
    if (inlineContainer && !inlineContainer.classList.contains('hidden')) {
      container = inlineContainer.querySelector('.plyr__progress');
    } else {
      container = document.querySelector('#player-modal .plyr__progress');
    }
  }

  if (!container) return;

  let wrapper = container.querySelector('.player-sponsor-markers-wrapper');
  if (wrapper) {
    wrapper.remove();
  }

  wrapper = document.createElement('div');
  wrapper.className = 'player-sponsor-markers-wrapper';
  wrapper.style.position = 'absolute';
  wrapper.style.left = '0';
  wrapper.style.right = '0';
  wrapper.style.top = '0';
  wrapper.style.bottom = '0';
  wrapper.style.pointerEvents = 'none';
  wrapper.style.zIndex = '25';

  if (playerType === 'plyr') {
    wrapper.style.height = '6px';
    wrapper.style.top = '50%';
    wrapper.style.transform = 'translateY(-50%)';
    wrapper.style.borderRadius = '3px';
    wrapper.style.overflow = 'hidden';
  }

  const categoryColors = {
    sponsor: 'rgba(74, 222, 128, 0.85)',      // Green
    selfpromo: 'rgba(250, 204, 21, 0.85)',     // Yellow
    interaction: 'rgba(56, 189, 248, 0.85)',   // Blue
    intro: 'rgba(45, 212, 191, 0.85)',         // Teal
    outro: 'rgba(192, 132, 252, 0.85)',        // Purple
    preview: 'rgba(244, 63, 94, 0.85)',        // Pink/Red
    music_offtopic: 'rgba(244, 63, 94, 0.85)'
  };

  currentVideoSponsorSegments.forEach(seg => {
    const leftPercent = (seg.start / duration) * 100;
    const widthPercent = ((seg.end - seg.start) / duration) * 100;
    const color = categoryColors[seg.category] || 'rgba(74, 222, 128, 0.85)';

    const marker = document.createElement('div');
    marker.style.position = 'absolute';
    marker.style.left = `${leftPercent}%`;
    marker.style.width = `${Math.max(widthPercent, 0.5)}%`;
    marker.style.height = '100%';
    marker.style.backgroundColor = color;
    marker.style.pointerEvents = 'none';
    marker.style.borderRadius = '0';

    wrapper.appendChild(marker);
  });

  container.appendChild(wrapper);
}

/**
 * SponsorBlock API üzerinden videoya ait atlama segmentlerini çeker.
 * @param {string} videoId 11 haneli YouTube Video ID
 * @returns {Promise<Array>}
 */
export async function fetchSponsorSegments(videoId) {
  currentVideoSponsorSegments = [];
  lastSkippedSegmentStart = -1;
  
  if (!videoId) return [];

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 4000);

  try {
    const categories = '["sponsor","selfpromo","interaction","intro","outro","preview"]';
    const url = `https://sponsor.ajay.app/api/skipSegments?videoID=${videoId}&categories=${encodeURIComponent(categories)}`;
    
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) {
        currentVideoSponsorSegments = data.map(item => ({
          start: item.segment[0],
          end: item.segment[1],
          category: item.category
        }));
        if (typeof window.devLog === 'function') {
          window.devLog(`[SponsorBlock] Found ${currentVideoSponsorSegments.length} segments:`, currentVideoSponsorSegments);
        }
      }
    }
  } catch (err) {
    clearTimeout(timeoutId);
    if (typeof window.devWarn === 'function') {
      window.devWarn('[SponsorBlock] Failed to fetch segments or request timed out:', err);
    }
  }

  // Global senkronizasyon
  window.currentVideoSponsorSegments = currentVideoSponsorSegments;
  return currentVideoSponsorSegments;
}

export function updateSponsorBlockStatusUI() {
  const statusEl = document.getElementById('player-sponsorblock-status');
  if (statusEl) statusEl.style.display = 'none';
}

/**
 * Oynatıcı alt çubuğundaki SponsorBlock açma/kapama kalkan butonunun görselini günceller.
 */
export function updateSBToggleButtonUI() {
  const btnSBToggle = document.getElementById('inline-btn-sponsorblock-toggle');
  if (!btnSBToggle) return;

  const isEnabled = window.localDb?.settings?.sponsorBlockEnabled === true;
  const lang = window.localDb?.settings?.lang || window.currentLang || 'tr';
  const t = window.translations?.[lang] || window.translations?.tr || {};

  if (!isEnabled) {
    btnSBToggle.classList.remove('active');
    btnSBToggle.title = t.btn_sponsorblock_disabled || 'SponsorBlock Devre Dışı (Açmak için tıklayın)';
    btnSBToggle.style.color = '#ef4444';
    btnSBToggle.style.background = 'rgba(239, 68, 68, 0.1)';
    btnSBToggle.style.borderColor = 'rgba(239, 68, 68, 0.2)';
    btnSBToggle.innerHTML = '<i data-lucide="shield-off" style="width: 16px; height: 16px;"></i>';
  } else {
    btnSBToggle.classList.add('active');
    btnSBToggle.title = t.btn_sponsorblock_active || 'SponsorBlock Aktif (Kapatmak için tıklayın)';
    btnSBToggle.style.color = '#4ade80';
    btnSBToggle.style.background = 'rgba(74, 222, 128, 0.1)';
    btnSBToggle.style.borderColor = 'rgba(74, 222, 128, 0.2)';
    btnSBToggle.innerHTML = '<i data-lucide="shield" style="width: 16px; height: 16px;"></i>';
  }
  try {
    if (typeof window.lucide !== 'undefined') window.lucide.createIcons();
  } catch (e) {}

  const wrappers = document.querySelectorAll('.player-sponsor-markers-wrapper');
  wrappers.forEach(w => {
    w.style.opacity = '1';
  });
}

/**
 * Video oynatılırken o anki saniyenin sponsor alanına denk gelip gelmediğini kontrol eder ve otomatik atlar.
 * @param {number} currentTime
 * @param {HTMLVideoElement} videoElementOrPlayer
 */
export function checkAndSkipSponsor(currentTime, videoElementOrPlayer) {
  if (!currentVideoSponsorSegments || currentVideoSponsorSegments.length === 0) return;
  if (!window.localDb?.settings || window.localDb.settings.sponsorBlockEnabled !== true) return;

  let insideAnySegment = false;
  for (const seg of currentVideoSponsorSegments) {
    if (currentTime >= seg.start && currentTime < (seg.end - 0.1)) {
      insideAnySegment = true;
      if (lastSkippedSegmentStart !== seg.start) {
        lastSkippedSegmentStart = seg.start;
        if (typeof window.devLog === 'function') {
          window.devLog(`[SponsorBlock] Skipping segment from ${seg.start} to ${seg.end}`);
        }
        showToast(
          window.currentLang === 'en' 
            ? `Skipped sponsor section (${Math.round(seg.start)}s - ${Math.round(seg.end)}s)` 
            : `Sponsor alanı otomatik atlandı (${Math.round(seg.start)}. sn - ${Math.round(seg.end)}. sn)`, 
          'info'
        );
        if (window.videoPlayerInstance) {
          try { window.videoPlayerInstance.seek = seg.end; } catch (e) {}
        }
        if (videoElementOrPlayer) {
          try { videoElementOrPlayer.currentTime = seg.end; } catch (e) {}
        }
      } else {
        if (window.videoPlayerInstance) {
          try { window.videoPlayerInstance.seek = seg.end; } catch (e) {}
        }
        if (videoElementOrPlayer) {
          try { videoElementOrPlayer.currentTime = seg.end; } catch (e) {}
        }
      }
      break;
    }
  }
  
  if (!insideAnySegment) {
    lastSkippedSegmentStart = -1;
  }
}

// Global window bindings
window.drawSponsorSegmentsOnTimeline = drawSponsorSegmentsOnTimeline;
window.fetchSponsorSegments = fetchSponsorSegments;
window.updateSponsorBlockStatusUI = updateSponsorBlockStatusUI;
window.updateSBToggleButtonUI = updateSBToggleButtonUI;
window.checkAndSkipSponsor = checkAndSkipSponsor;
window.getSponsorSegments = getSponsorSegments;
window.clearSponsorSegments = clearSponsorSegments;
