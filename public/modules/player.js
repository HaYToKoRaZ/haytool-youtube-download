/**
 * Video Oynatıcı, SponsorBlock, Altyazı ve Yorumlar Modülü (player.js)
 * 
 * Yapımcı: HaYTo
 * Açıklama: Gömülü video oynatıcı (Artplayer/Plyr/HTML5), inline & modal oynatıcı,
 *            SponsorBlock segment atlama, altyazı stilleri, YouTube yorumları ve çalma listesi akışı.
 * Bağımlılıklar: app.js getState() fonksiyonu ile localDb, currentLang, translations erişimi sağlanır.
 */

import { translations } from '../utils/i18n.js';
import { 
  escapeHtml, 
  formatDate, 
  getDaysAgoText, 
  parseSizeToBytes, 
  isShortVideo, 
  parseTimeToSeconds, 
  formatDescriptionTimestamps, 
  parseLikes, 
  parseRelativeTime, 
  debounce, 
  isMembersOnlyVideo 
} from '../utils/helpers.js';
import { showToast } from '../components/toast.js';

let _getState = null;

export function initPlayer(getState) {
  _getState = getState;
}

const localDb = new Proxy({}, {
  get(target, prop) {
    const db = (_getState?.().localDb) || window.localDb || { history: [], channels: [], settings: {}, categories: [] };
    return db[prop];
  },
  set(target, prop, value) {
    const db = (_getState?.().localDb) || window.localDb || {};
    db[prop] = value;
    return true;
  }
});

let _currentPlayingVideoId = null;
export function getCurrentPlayingVideoId() {
  return _currentPlayingVideoId || window.currentPlayingVideoId || null;
}
export function setCurrentPlayingVideoId(id) {
  _currentPlayingVideoId = id;
  if (typeof window !== 'undefined') window.currentPlayingVideoId = id;
}

let _videoPlayerInstance = null;
export function getVideoPlayerInstance() {
  return _videoPlayerInstance || window.videoPlayerInstance || null;
}
export function setVideoPlayerInstance(inst) {
  _videoPlayerInstance = inst;
  if (typeof window !== 'undefined') window.videoPlayerInstance = inst;
}

export const autoSyncWatchtimeHelper = window.autoSyncWatchtimeHelper = function(videoId, currentTime, isFinal = false) {
  if (!videoId || localDb?.settings?.autoSyncWatchtime === false) return;
  if (isFinal && currentTime > 5) {
    fetch(`/api/video/${videoId}/sync-watchtime`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentTime: currentTime, silent: true })
    }).catch(() => {});
  }
};

let seekedForCurrentVideo = false;
let sponsorSegments = [];
let loadedCommentsList = [];
let nextCommentsToken = null;

// Geriye dönük Proxy uyumluluğu
let currentPlayingVideoId = null;
let videoPlayerInstance = null;


// Türkçe Açıklama: Gömülü video oynatıcı açıkken YouTube klavye kısayollarını (Space, F, M, yön tuşları, sayılar vb.) etkinleştirir.
/**
 * Video oynatıcı modalı açıkken YouTube klavye kısayollarını dinler ve yürütür.
 */
document.addEventListener('keydown', (e) => {
  const modal = document.getElementById('player-modal');
  const inlineContainer = document.getElementById('downloaded-inline-player-container');
  const isModalOpen = modal && !modal.classList.contains('hidden');
  const isInlineOpen = inlineContainer && !inlineContainer.classList.contains('hidden');

  if (isModalOpen || isInlineOpen) {
    // Input veya textarea üzerinde yazı yazılıyorsa kısayolları çalıştırma
    const activeEl = document.activeElement;
    const isTyping = activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.isContentEditable);
    if (isTyping) return;

    const player = document.getElementById('embedded-video-player');
    const pType = (localDb.settings && localDb.settings.playerType) || 'plyr';

    // Oynatıcı kontrollerini soyutlayan ortak nesne
    const activePlayer = {
      get paused() {
        if (pType === 'artplayer' && videoPlayerInstance) return videoPlayerInstance.paused;
        if (pType === 'html5' && player) return player.paused;
        return videoPlayerInstance ? videoPlayerInstance.paused : (player ? player.paused : true);
      },
      play() {
        if (pType === 'artplayer' && videoPlayerInstance) return videoPlayerInstance.play();
        if (pType === 'html5' && player) return player.play();
        return videoPlayerInstance ? videoPlayerInstance.play() : (player ? player.play() : Promise.resolve());
      },
      pause() {
        if (pType === 'artplayer' && videoPlayerInstance) videoPlayerInstance.pause();
        else if (pType === 'html5' && player) player.pause();
        else if (videoPlayerInstance) videoPlayerInstance.pause();
        else if (player) player.pause();
      },
      get duration() {
        if (pType === 'artplayer' && videoPlayerInstance) return videoPlayerInstance.duration || 0;
        if (pType === 'html5' && player) return player.duration || 0;
        return videoPlayerInstance ? (videoPlayerInstance.duration || 0) : (player ? (player.duration || 0) : 0);
      },
      get currentTime() {
        if (pType === 'artplayer' && videoPlayerInstance) return videoPlayerInstance.currentTime || 0;
        if (pType === 'html5' && player) return player.currentTime || 0;
        return videoPlayerInstance ? (videoPlayerInstance.currentTime || 0) : (player ? (player.currentTime || 0) : 0);
      },
      set currentTime(val) {
        if (pType === 'artplayer' && videoPlayerInstance) videoPlayerInstance.currentTime = val;
        else if (pType === 'html5' && player) player.currentTime = val;
        else if (videoPlayerInstance) videoPlayerInstance.currentTime = val;
        else if (player) player.currentTime = val;
      },
      get volume() {
        if (pType === 'artplayer' && videoPlayerInstance) return videoPlayerInstance.volume || 0;
        if (pType === 'html5' && player) return player.volume || 0;
        return videoPlayerInstance ? (videoPlayerInstance.volume || 0) : (player ? (player.volume || 0) : 0);
      },
      set volume(val) {
        if (pType === 'artplayer' && videoPlayerInstance) videoPlayerInstance.volume = val;
        else if (pType === 'html5' && player) player.volume = val;
        else if (videoPlayerInstance) videoPlayerInstance.volume = val;
        else if (player) player.volume = val;
      },
      get muted() {
        if (pType === 'artplayer' && videoPlayerInstance) return videoPlayerInstance.muted || false;
        if (pType === 'html5' && player) return player.muted || false;
        return videoPlayerInstance ? (videoPlayerInstance.muted || false) : (player ? (player.muted || false) : false);
      },
      set muted(val) {
        if (pType === 'artplayer' && videoPlayerInstance) videoPlayerInstance.muted = val;
        else if (pType === 'html5' && player) player.muted = val;
        else if (videoPlayerInstance) videoPlayerInstance.muted = val;
        else if (player) player.muted = val;
      },
      get speed() {
        if (pType === 'artplayer' && videoPlayerInstance) return videoPlayerInstance.playbackRate || 1;
        if (pType === 'html5' && player) return player.playbackRate || 1;
        return videoPlayerInstance ? (videoPlayerInstance.speed || 1) : (player ? (player.playbackRate || 1) : 1);
      },
      set speed(val) {
        if (pType === 'artplayer' && videoPlayerInstance) videoPlayerInstance.playbackRate = val;
        else if (pType === 'html5' && player) player.playbackRate = val;
        else if (videoPlayerInstance) videoPlayerInstance.speed = val;
        else if (player) player.playbackRate = val;
      },
      toggleFullscreen() {
        if (pType === 'artplayer' && videoPlayerInstance) {
          videoPlayerInstance.fullscreen = !videoPlayerInstance.fullscreen;
        } else if (pType === 'html5' && player) {
          if (!document.fullscreenElement) {
            player.requestFullscreen().catch(err => console.error(err));
          } else {
            document.exitFullscreen().catch(err => console.error(err));
          }
        } else {
          if (videoPlayerInstance && videoPlayerInstance.fullscreen) {
            videoPlayerInstance.fullscreen.toggle();
          }
        }
      },
      toggleCaptions() {
        if (pType === 'artplayer' && videoPlayerInstance) {
          if (videoPlayerInstance.subtitle) {
            videoPlayerInstance.subtitle.show = !videoPlayerInstance.subtitle.show;
          }
        } else if (pType === 'plyr' && videoPlayerInstance) {
          if (typeof videoPlayerInstance.toggleCaptions === 'function') {
            videoPlayerInstance.toggleCaptions();
          } else if (videoPlayerInstance.captions) {
            videoPlayerInstance.captions.active = !videoPlayerInstance.captions.active;
          }
        } else if (player) {
          const tracks = player.textTracks;
          if (tracks && tracks.length > 0) {
            const isShowing = Array.from(tracks).some(t => t.mode === 'showing');
            for (let i = 0; i < tracks.length; i++) {
              if (isShowing) {
                tracks[i].mode = 'disabled';
              } else {
                tracks[i].mode = i === 0 ? 'showing' : 'disabled';
              }
            }
          }
        }
      }
    };

    const duration = activePlayer.duration;
    const speeds = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];

    switch (e.key) {
      case ' ':
      case 'k':
      case 'K':
        e.preventDefault();
        if (activePlayer.paused) {
          activePlayer.play().catch(() => {});
        } else {
          activePlayer.pause();
        }
        break;

      case 'f':
      case 'F':
        e.preventDefault();
        activePlayer.toggleFullscreen();
        break;

      case 'm':
      case 'M':
        e.preventDefault();
        activePlayer.muted = !activePlayer.muted;
        break;

      case 'c':
      case 'C':
        e.preventDefault();
        activePlayer.toggleCaptions();
        break;

      case 'ArrowRight':
        e.preventDefault();
        activePlayer.currentTime = Math.min(duration, activePlayer.currentTime + 5);
        break;

      case 'ArrowLeft':
        e.preventDefault();
        activePlayer.currentTime = Math.max(0, activePlayer.currentTime - 5);
        break;

      case 'l':
      case 'L':
        e.preventDefault();
        activePlayer.currentTime = Math.min(duration, activePlayer.currentTime + 10);
        break;

      case 'j':
      case 'J':
        e.preventDefault();
        activePlayer.currentTime = Math.max(0, activePlayer.currentTime - 10);
        break;

      case 'ArrowUp':
        e.preventDefault();
        activePlayer.volume = Math.min(1, activePlayer.volume + 0.05);
        break;

      case 'ArrowDown':
        e.preventDefault();
        activePlayer.volume = Math.max(0, activePlayer.volume - 0.05);
        break;

      case 'Home':
        e.preventDefault();
        activePlayer.currentTime = 0;
        break;

      case 'End':
        e.preventDefault();
        activePlayer.currentTime = duration;
        break;

      case '>':
        e.preventDefault();
        {
          const idx = speeds.indexOf(activePlayer.speed);
          if (idx !== -1 && idx < speeds.length - 1) {
            activePlayer.speed = speeds[idx + 1];
          }
        }
        break;

      case '<':
        e.preventDefault();
        {
          const idx = speeds.indexOf(activePlayer.speed);
          if (idx !== -1 && idx > 0) {
            activePlayer.speed = speeds[idx - 1];
          }
        }
        break;

      default:
        // Sayı tuşları (0-9) ile videonun %0 ila %90'ına atlama
        if (e.key >= '0' && e.key <= '9') {
          e.preventDefault();
          const percent = parseInt(e.key, 10) * 10;
          activePlayer.currentTime = duration * (percent / 100);
        }
        if (e.key === '.' && e.shiftKey) {
          e.preventDefault();
          const idx = speeds.indexOf(activePlayer.speed);
          if (idx !== -1 && idx < speeds.length - 1) {
            activePlayer.speed = speeds[idx + 1];
          }
        } else if (e.key === ',' && e.shiftKey) {
          e.preventDefault();
          const idx = speeds.indexOf(activePlayer.speed);
          if (idx !== -1 && idx > 0) {
            activePlayer.speed = speeds[idx - 1];
          }
        }
        break;
    }
  }
});

// Türkçe Açıklama: İndirilen videoyu arayüz içerisindeki gömülü video oynatıcı (Plyr) modalında açarak yürütür.
/**
 * Videoyu gömülü tarayıcı oynatıcısında (Plyr) açar.
 * Shorts videoları dikey gösterilir ve kalınan izleme süresinden devam eder.
 * 
 * @param {string} videoId Oynatılacak video ID'si
 */
// Türkçe Açıklama: Yüzen oynatıcı modalının boyut ve konum stillerini temizleyip video formatına (Shorts / Geniş Ekran) ve kayıtlı ayarlara göre orantılı uygular.
/**
 * Oynatıcı modalının boyut ve en-boy oranını video türüne göre yapılandırır.
 * 
 * @param {boolean} isShort Videonun Shorts/dikey olup olmadığı
 * @param {boolean} [isMinimized=false] Modalın küçültülmüş PiP modunda olup olmadığı
 */
export function resetAndApplyPlayerDimensions(isShort = false, isMinimized = false) {
  const modal = document.getElementById('player-modal');
  if (!modal) return;

  const modalContent = modal.querySelector('.player-modal-content');
  const modalBody = modal.querySelector('.player-modal-body');
  if (!modalContent || !modalBody) return;

  if (isShort) {
    modal.classList.add('is-short-player');
  } else {
    modal.classList.remove('is-short-player');
  }

  if (isMinimized) {
    modal.classList.add('minimized');
  } else {
    modal.classList.remove('minimized');
  }

  const suffix = isShort ? '-short' : '-wide';
  const savedWidth = localStorage.getItem(`player-modal${suffix}-width`);
  const savedHeight = localStorage.getItem(`player-modal${suffix}-height`);
  const savedLeft = localStorage.getItem(`player-modal${suffix}-left`);
  const savedTop = localStorage.getItem(`player-modal${suffix}-top`);

  if (!isMinimized && savedWidth && savedHeight) {
    modalContent.style.width = savedWidth;
    modalContent.style.height = savedHeight;
    modalContent.style.left = savedLeft || '';
    modalContent.style.top = savedTop || '';
    modalContent.style.right = savedLeft ? 'auto' : '20px';
    modalContent.style.bottom = savedTop ? 'auto' : '20px';

    const headerEl = modalContent.querySelector('.player-modal-header') || modalContent.querySelector('.modal-header');
    const headerHeight = headerEl ? headerEl.offsetHeight : 38;
    const bodyHeight = parseInt(savedHeight, 10) - headerHeight;
    if (bodyHeight > 50) {
      modalBody.style.height = `${bodyHeight}px`;
    } else {
      modalBody.style.height = '';
    }
  } else {
    // Varsayılan temiz boyutlandırma (inline stilleri temizle, CSS kurallarına bırak)
    modalContent.style.width = '';
    modalContent.style.height = '';
    modalContent.style.left = '';
    modalContent.style.top = '';
    modalContent.style.right = '20px';
    modalContent.style.bottom = '20px';
    modalBody.style.height = '';
  }

  if (isShort) {
    modalBody.style.aspectRatio = '9 / 16';
  } else {
    modalBody.style.aspectRatio = '16 / 9';
  }
}
window.resetAndApplyPlayerDimensions = resetAndApplyPlayerDimensions;

// Türkçe Açıklama: Gömülü video oynatıcı modalının boyutunu küçültür veya eski boyutuna geri getirir.
/**
 * Oynatıcı modalını küçültür (minimize) veya geri yükler.
 */
export const togglePlayerMinimize = window.togglePlayerMinimize = function() {
  const modal = document.getElementById('player-modal');
  const btn = document.getElementById('minimize-player-modal-btn');
  if (!modal) return;
  
  modal.classList.toggle('minimized');
  const isMinimized = modal.classList.contains('minimized');
  const isShort = modal.classList.contains('is-short-player');

  resetAndApplyPlayerDimensions(isShort, isMinimized);

  if (btn) {
    const icon = btn.querySelector('i') || btn.querySelector('[data-lucide]');
    if (icon) {
      icon.setAttribute('data-lucide', isMinimized ? 'maximize-2' : 'minus');
    }
    btn.title = isMinimized ? (localDb.settings && localDb.settings.lang === 'en' ? 'Maximize' : 'Büyüt') : (localDb.settings && localDb.settings.lang === 'en' ? 'Minimize' : 'Küçült');
  }
  try {
    if (typeof lucide !== 'undefined') lucide.createIcons();
  } catch (e) {}

  if (videoPlayerInstance && typeof videoPlayerInstance.resize === 'function') {
    setTimeout(() => videoPlayerInstance.resize(), 50);
  }
};

let currentVideoSponsorSegments = [];
let lastSkippedSegmentStart = -1;
let playerResizeObserver = null;

// Türkçe Açıklama: Gömülü video oynatıcı modalının başlık çubuğundan tutularak ekranda serbestçe ve ekran sınırları içinde taşınmasını sağlar.
/**
 * Oynatıcı modalını başlık barından taşınabilir hale getirir.
 * 
 * @param {HTMLElement} modalContent Taşınacak modal içerik elementi
 * @param {HTMLElement} dragHeader Sürükleme tutamacı olarak kullanılacak başlık elementi
 */
export function makeElementDraggable(modalContent, dragHeader) {
  if (!modalContent || !dragHeader) return;
  let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;

  dragHeader.onmousedown = dragMouseDown;

  function dragMouseDown(e) {
    e = e || window.event;
    if (e.target.closest('button') || e.target.closest('a') || e.target.closest('input') || e.target.closest('select')) {
      return;
    }
    e.preventDefault();
    pos3 = e.clientX;
    pos4 = e.clientY;
    document.onmouseup = closeDragElement;
    document.onmousemove = elementDrag;
  }

  function elementDrag(e) {
    e = e || window.event;
    e.preventDefault();
    pos1 = pos3 - e.clientX;
    pos2 = pos4 - e.clientY;
    pos3 = e.clientX;
    pos4 = e.clientY;
    
    const newTop = modalContent.offsetTop - pos2;
    const newLeft = modalContent.offsetLeft - pos1;

    const maxLeft = window.innerWidth - modalContent.offsetWidth - 10;
    const maxTop = window.innerHeight - modalContent.offsetHeight - 10;

    modalContent.style.bottom = 'auto';
    modalContent.style.right = 'auto';
    modalContent.style.left = `${Math.max(10, Math.min(newLeft, maxLeft))}px`;
    modalContent.style.top = `${Math.max(10, Math.min(newTop, maxTop))}px`;
  }

  function closeDragElement() {
    document.onmouseup = null;
    document.onmousemove = null;
    const isShort = modalContent.closest('#player-modal')?.classList.contains('is-short-player');
    const suffix = isShort ? '-short' : '-wide';
    localStorage.setItem(`player-modal${suffix}-left`, modalContent.style.left);
    localStorage.setItem(`player-modal${suffix}-top`, modalContent.style.top);
  }
}

// Türkçe Açıklama: Gömülü video oynatıcı modalının köşelerinden veya kenarlarından en-boy oranını (16:9 veya 9:16) bozmadan orantılı olarak yeniden boyutlandırılmasını sağlar.
/**
 * Oynatıcı modalını en-boy oranı kilitli olarak orantılı boyutlandırılabilir hale getirir.
 * 
 * @param {HTMLElement} modalContent Boyutlandırılacak modal içerik elementi
 */
export function makeElementResizable(modalContent) {
  if (!modalContent) return;
  const handles = modalContent.querySelectorAll('.resize-handle');
  
  handles.forEach(handle => {
    handle.onmousedown = resizeMouseDown;
    
    function resizeMouseDown(e) {
      e.preventDefault();
      e.stopPropagation();

      const modal = modalContent.closest('#player-modal');
      const isShort = modal ? modal.classList.contains('is-short-player') : false;
      
      // Video elementinden veya sınıftan gerçek en-boy oranını al
      const rawVideo = modalContent.querySelector('video') || (window.videoPlayerInstance && window.videoPlayerInstance.video);
      let ratio = 16 / 9;
      if (rawVideo && rawVideo.videoWidth && rawVideo.videoHeight) {
        ratio = rawVideo.videoWidth / rawVideo.videoHeight;
      } else if (isShort) {
        ratio = 9 / 16;
      }

      const isRight = handle.classList.contains('bottom-right') || handle.classList.contains('top-right') || handle.classList.contains('edge-right');
      const isLeft = handle.classList.contains('bottom-left') || handle.classList.contains('top-left') || handle.classList.contains('edge-left');
      const isBottom = handle.classList.contains('bottom-left') || handle.classList.contains('bottom-right') || handle.classList.contains('edge-bottom');
      const isTop = handle.classList.contains('top-left') || handle.classList.contains('top-right') || handle.classList.contains('edge-top');
      
      const startRect = modalContent.getBoundingClientRect();
      const startWidth = startRect.width;
      const startHeight = startRect.height;
      const startX = e.clientX;
      const startY = e.clientY;
      const startLeft = startRect.left;
      const startTop = startRect.top;
      
      const headerEl = modalContent.querySelector('.player-modal-header') || modalContent.querySelector('.modal-header');
      const headerHeight = headerEl ? headerEl.offsetHeight : 38;

      document.onmousemove = elementResize;
      document.onmouseup = closeResizeElement;
      
      function elementResize(e) {
        e.preventDefault();
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;

        let newWidth = startWidth;

        if (isRight) {
          newWidth = startWidth + dx;
        } else if (isLeft) {
          newWidth = startWidth - dx;
        } else if (isBottom) {
          const newBodyHeight = (startHeight - headerHeight) + dy;
          newWidth = newBodyHeight * ratio;
        } else if (isTop) {
          const newBodyHeight = (startHeight - headerHeight) - dy;
          newWidth = newBodyHeight * ratio;
        }

        // Minimum ve maksimum sınır kontrolleri
        const minWidth = isShort ? 200 : 280;
        const maxWidth = Math.min(1000, window.innerWidth - 20);
        newWidth = Math.max(minWidth, Math.min(newWidth, maxWidth));

        let newBodyHeight = Math.round(newWidth / ratio);
        let newTotalHeight = newBodyHeight + headerHeight;

        // Ekran yüksekliğini aşmama kontrolü
        const maxHeight = window.innerHeight - 20;
        if (newTotalHeight > maxHeight) {
          newTotalHeight = maxHeight;
          newBodyHeight = newTotalHeight - headerHeight;
          newWidth = Math.round(newBodyHeight * ratio);
        }

        // Yeni konum hesaplama (Sol veya Üstten çekildiyse başlangıç konumunu kaydır)
        let newLeft = startLeft;
        let newTop = startTop;

        if (isLeft) {
          newLeft = startLeft + (startWidth - newWidth);
        }
        if (isTop) {
          newTop = startTop + (startHeight - newTotalHeight);
        }

        // Ekran dışına taşmayı sınırla
        newLeft = Math.max(10, Math.min(newLeft, window.innerWidth - newWidth - 10));
        newTop = Math.max(10, Math.min(newTop, window.innerHeight - newTotalHeight - 10));

        modalContent.style.width = `${Math.round(newWidth)}px`;
        modalContent.style.height = `${Math.round(newTotalHeight)}px`;
        modalContent.style.left = `${Math.round(newLeft)}px`;
        modalContent.style.top = `${Math.round(newTop)}px`;
        modalContent.style.right = 'auto';
        modalContent.style.bottom = 'auto';

        const bodyEl = modalContent.querySelector('.player-modal-body');
        if (bodyEl) {
          bodyEl.style.height = `${Math.round(newBodyHeight)}px`;
        }
      }
      
      function closeResizeElement() {
        document.onmousemove = null;
        document.onmouseup = null;
        
        const suffix = isShort ? '-short' : '-wide';
        localStorage.setItem(`player-modal${suffix}-width`, modalContent.style.width);
        localStorage.setItem(`player-modal${suffix}-height`, modalContent.style.height);
        localStorage.setItem(`player-modal${suffix}-left`, modalContent.style.left);
        localStorage.setItem(`player-modal${suffix}-top`, modalContent.style.top);
        
        if (videoPlayerInstance && typeof videoPlayerInstance.resize === 'function') {
          videoPlayerInstance.resize();
        }
      }
    }
  });
}

export function drawSponsorSegmentsOnTimeline(duration, playerType) {
  if (!duration || !currentVideoSponsorSegments || currentVideoSponsorSegments.length === 0) return;

  let container = null;
  if (playerType === 'artplayer') {
    container = document.querySelector('#embedded-artplayer .art-progress');
  } else if (playerType === 'plyr') {
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
  wrapper.style.zIndex = '5';

  if (playerType === 'artplayer') {
    wrapper.style.height = '100%';
  } else if (playerType === 'plyr') {
    wrapper.style.height = '6px';
    wrapper.style.top = '50%';
    wrapper.style.transform = 'translateY(-50%)';
    wrapper.style.borderRadius = '3px';
    wrapper.style.overflow = 'hidden';
  }

  const categoryColors = {
    sponsor: 'rgba(74, 222, 128, 0.65)',      // Green
    selfpromo: 'rgba(250, 204, 21, 0.65)',     // Yellow
    interaction: 'rgba(56, 189, 248, 0.65)',   // Blue
    intro: 'rgba(45, 212, 191, 0.65)',         // Teal
    outro: 'rgba(192, 132, 252, 0.65)',        // Purple
    preview: 'rgba(244, 63, 94, 0.65)',        // Pink/Red
    music_offtopic: 'rgba(244, 63, 94, 0.65)'
  };

  currentVideoSponsorSegments.forEach(seg => {
    const leftPercent = (seg.start / duration) * 100;
    const widthPercent = ((seg.end - seg.start) / duration) * 100;
    const color = categoryColors[seg.category] || 'rgba(255, 255, 255, 0.5)';

    const marker = document.createElement('div');
    marker.style.position = 'absolute';
    marker.style.left = `${leftPercent}%`;
    marker.style.width = `${widthPercent}%`;
    marker.style.height = '100%';
    marker.style.backgroundColor = color;
    marker.style.pointerEvents = 'none';
    marker.style.borderRadius = playerType === 'plyr' ? '0' : '2px';

    wrapper.appendChild(marker);
  });

  container.appendChild(wrapper);
}

/**
 * Videonun en-boy oranına göre oynatıcının yönelimini (dikey/yatay) ayarlar.
 * Dikey videolar için hem modal hem de inline wrapper'a 'is-short-player' sınıfı ekler ve gerçek video oranını atar.
 * 
 * @param {HTMLVideoElement} videoElement Kontrol edilecek video DOM elementi
 */
export function adjustPlayerOrientation(videoElement) {
  const modal = document.getElementById('player-modal');
  const inlineWrapper = document.querySelector('.inline-player-wrapper');
  if (!videoElement) return;
  
  if (videoElement.videoWidth && videoElement.videoHeight) {
    const isVertical = videoElement.videoHeight > videoElement.videoWidth;
    const ratio = `${videoElement.videoWidth} / ${videoElement.videoHeight}`;

    if (modal) {
      const isMinimized = modal.classList.contains('minimized');
      resetAndApplyPlayerDimensions(isVertical, isMinimized);
      const modalBody = modal.querySelector('.player-modal-body');
      if (modalBody) {
        modalBody.style.aspectRatio = ratio;
      }
    }

    if (inlineWrapper) {
      if (isVertical) {
        inlineWrapper.classList.add('is-short-player');
      } else {
        inlineWrapper.classList.remove('is-short-player');
      }
      inlineWrapper.style.aspectRatio = ratio;
    }

    if (videoPlayerInstance && typeof videoPlayerInstance.resize === 'function') {
      setTimeout(() => videoPlayerInstance.resize(), 50);
    }
  }
}

export async function fetchSponsorSegments(videoId) {
  currentVideoSponsorSegments = [];
  lastSkippedSegmentStart = -1;
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 1500);

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
        devLog(`[SponsorBlock] Found ${currentVideoSponsorSegments.length} segments:`, currentVideoSponsorSegments);
      }
    }
  } catch (err) {
    clearTimeout(timeoutId);
    devWarn('[SponsorBlock] Failed to fetch segments or request timed out:', err);
  }
}

export function updateSponsorBlockStatusUI() {
  const statusEl = document.getElementById('player-sponsorblock-status');
  if (statusEl) statusEl.style.display = 'none';
  const inlineStatusEl = document.getElementById('inline-player-sponsorblock-status');
  if (inlineStatusEl) inlineStatusEl.style.display = 'none';
}

export function updateSBToggleButtonUI() {
  const btnSBToggle = document.getElementById('inline-btn-sponsorblock-toggle');
  if (!btnSBToggle) return;

  const lang = (localDb && localDb.settings && localDb.settings.lang) || currentLang || 'tr';
  const t = translations[lang] || translations.tr;

  const isActive = localDb.settings && localDb.settings.sponsorBlockEnabled === true;

  if (!isActive) {
    btnSBToggle.title = t.sponsorblock_disabled || 'SponsorBlock Devre Dışı';
    btnSBToggle.style.color = '#ef4444';
    btnSBToggle.style.background = 'rgba(239, 68, 68, 0.1)';
    btnSBToggle.style.borderColor = 'rgba(239, 68, 68, 0.2)';
    btnSBToggle.innerHTML = '<i data-lucide="shield-off" style="width: 16px; height: 16px;"></i>';
  } else {
    btnSBToggle.title = t.sponsorblock_active || 'SponsorBlock Aktif';
    btnSBToggle.style.color = '#4ade80';
    btnSBToggle.style.background = 'rgba(74, 222, 128, 0.1)';
    btnSBToggle.style.borderColor = 'rgba(74, 222, 128, 0.2)';
    btnSBToggle.innerHTML = '<i data-lucide="shield" style="width: 16px; height: 16px;"></i>';
  }
  try {
    lucide.createIcons();
  } catch (e) {}

  const wrappers = document.querySelectorAll('.player-sponsor-markers-wrapper');
  wrappers.forEach(w => {
    w.style.opacity = '1';
  });
}

export function checkAndSkipSponsor(currentTime, videoElementOrPlayer) {
  if (!currentVideoSponsorSegments || currentVideoSponsorSegments.length === 0) return;
  if (!localDb.settings || localDb.settings.sponsorBlockEnabled !== true) return;

  let insideAnySegment = false;
  for (const seg of currentVideoSponsorSegments) {
    if (currentTime >= seg.start && currentTime < (seg.end - 0.1)) {
      insideAnySegment = true;
      if (lastSkippedSegmentStart !== seg.start) {
        lastSkippedSegmentStart = seg.start;
        devLog(`[SponsorBlock] Skipping segment from ${seg.start} to ${seg.end}`);
        showToast(
          currentLang === 'en' 
            ? `Skipped sponsor section (${Math.round(seg.start)}s - ${Math.round(seg.end)}s)` 
            : `Sponsor alanı otomatik atlandı (${Math.round(seg.start)}. sn - ${Math.round(seg.end)}. sn)`, 
          'info'
        );
        videoElementOrPlayer.currentTime = seg.end;
      } else {
        videoElementOrPlayer.currentTime = seg.end;
      }
      break;
    }
  }
  
  if (!insideAnySegment) {
    lastSkippedSegmentStart = -1;
  }
}

export const showPlayerTransientOverlay = window.showPlayerTransientOverlay = function(htmlContent, durationMs = 1200) {
  const activeTab = document.querySelector('.nav-item.active')?.getAttribute('data-tab') || 'history';
  const isInline = (activeTab === 'downloaded');
  let container = null;
  if (isInline) {
    container = document.getElementById('inline-player-body');
  } else if (activeTab === 'iptv') {
    const activeSlotEl = document.querySelector(`.iptv-slot[data-slot="${activeIptvSlot}"]`);
    if (activeSlotEl) {
      container = activeSlotEl.querySelector('.slot-body');
    }
  } else {
    const modal = document.getElementById('player-modal');
    if (modal && !modal.classList.contains('hidden')) {
      container = modal.querySelector('.player-modal-body');
    }
  }
  
  if (!container) return;

  let overlay = container.querySelector('.player-transient-overlay');
  if (overlay) {
    if (overlay._fadeOutTimer) clearTimeout(overlay._fadeOutTimer);
  } else {
    overlay = document.createElement('div');
    overlay.className = 'player-transient-overlay';
    container.appendChild(overlay);
  }

  overlay.innerHTML = htmlContent;
  
  overlay._fadeOutTimer = setTimeout(() => {
    overlay.style.animation = 'fadeOut 0.25s ease-in forwards';
    setTimeout(() => {
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
    }, 250);
  }, durationMs);
};

export const triggerVolumeHUD = window.triggerVolumeHUD = function(volume) {
  const volPercent = Math.round(volume * 100);
  const icon = volPercent === 0 ? 'volume-x' : (volPercent < 33 ? 'volume' : (volPercent < 66 ? 'volume-1' : 'volume-2'));
  const html = `
    <div class="player-transient-card volume-hud-card">
      <i data-lucide="${icon}" style="width: 32px; height: 32px; color: var(--accent-primary);"></i>
      <div class="transient-title">${volPercent}%</div>
    </div>
  `;
  if (typeof showPlayerTransientOverlay === 'function') {
    showPlayerTransientOverlay(html, 800);
  }
  try { lucide.createIcons(); } catch(e) {}
};

/**
 * Türkçe Açıklama: Oynatılan videonun başlığını ve kanal adını Discord RPC durumuna yansıtmak üzere backend API'ye gönderir.
 * 
 * @param {boolean} isPlaying - Oynatım durumu (true: oynatılıyor, false: durduruldu)
 * @returns {void}
 */
export function sendPlayerActivity(isPlaying) {
  if (localDb.settings && localDb.settings.discordRpcEnabled === false) return;

  let title = null;
  let channelName = null;
  if (isPlaying && currentPlayingVideoId) {
    const video = (localDb.history || []).find(h => h.id === currentPlayingVideoId);
    if (video) {
      title = video.title || null;
      channelName = video.channelName || null;
    }
  }

  fetch('/api/player/activity', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, channelName })
  }).catch(e => console.error('[Discord RPC] Durum gönderim hatası:', e));
}

export const cleanupAllPlayers = window.cleanupAllPlayers = function() {
  sendPlayerActivity(false);
  if (videoPlayerInstance) {
    try {
      if (typeof videoPlayerInstance.destroy === 'function') {
        videoPlayerInstance.destroy();
      }
    } catch (e) {
      console.error("Error destroying videoPlayerInstance:", e);
    }
    videoPlayerInstance = null;
    setVideoPlayerInstance(null);
  }

  const videoElements = document.querySelectorAll('video');
  videoElements.forEach(video => {
    try {
      video.pause();
      video.src = '';
      video.load();
    } catch (e) {
      console.error("Error pausing video element:", e);
    }
  });

  const iframes = document.querySelectorAll('.inline-player-body iframe, .player-modal-body iframe');
  iframes.forEach(iframe => {
    try {
      iframe.src = 'about:blank';
      iframe.remove();
    } catch (e) {}
  });

  const inlineBody = document.getElementById('inline-player-body');
  if (inlineBody) {
    inlineBody.innerHTML = '';
  }
  const modalBody = document.querySelector('.player-modal-body');
  if (modalBody) {
    modalBody.innerHTML = '';
    modalBody.style.aspectRatio = '';
  }
  const inlineWrapper = document.querySelector('.inline-player-wrapper');
  if (inlineWrapper) {
    inlineWrapper.classList.remove('is-short-player');
    inlineWrapper.style.aspectRatio = '';
  }
};



// Türkçe Açıklama: İndirilen videoyu arayüz içerisindeki gömülü video oynatıcı (Plyr) modalında açarak yürütür.
/**
 * Videoyu gömülü tarayıcı oynatıcısında (Plyr) açar.
 * Shorts videoları dikey gösterilir ve kalınan izleme süresinden devam eder.
 * 
 * @param {string} videoId Oynatılacak video ID'si
 */
export const playVideoEmbedded = window.playVideoEmbedded = async function(videoId, startSeconds = null, forcePaused = null) {
  // C# PlayerWindow açılmasını devredışı bıraktık, artık her şey tek pencerede arayüz içinde oynatılacak.
  console.log('[playVideoEmbedded] ▶ START videoId:', videoId);
  try {
  cleanupAllPlayers();
  console.log('[playVideoEmbedded] cleanupAllPlayers done');
  const activeTab = document.querySelector('.nav-item.active')?.getAttribute('data-tab') || 'history';
  const isInline = (activeTab === 'downloaded');
  console.log('[playVideoEmbedded] activeTab:', activeTab, '| isInline:', isInline);

  let video = localDb.history.find(h => h.id === videoId);
  console.log('[playVideoEmbedded] video found:', !!video, '| status:', video?.status, '| fileMissing:', video?.fileMissing);
  let videoTitle = video ? video.title : '';
  let videoChannelId = video ? video.channelId : '';
  let videoChannelName = video ? video.channelName : '';
  let videoDuration = video ? video.duration : '';
  let fileSizeStr = video ? video.fileSize : '';
  let publishDateStr = video ? (video.publishedAt || video.downloadedAt || '') : '';



  // Fetch SponsorBlock segments
  await fetchSponsorSegments(videoId);
  updateSponsorBlockStatusUI();

  // Fetch available subtitles
  let availableSubtitles = [];
  try {
    const subRes = await fetch(`/api/video/${videoId}/subtitles`);
    const subData = await subRes.json();
    if (subData.success && subData.subtitles) {
      availableSubtitles = subData.subtitles;
    }
  } catch (err) {
    console.error("Error loading subtitles:", err);
  }

  // DOM Fallback
  if (!videoTitle) {
    const cardTitleEl = document.querySelector(`.video-card-title[title*="${videoId}"], .video-card-title[onclick*="${videoId}"]`);
    if (cardTitleEl) {
      videoTitle = cardTitleEl.textContent.trim();
    }
  }
  if (!videoChannelId) {
    const cardEl = document.querySelector(`.video-thumbnail-wrapper[onclick*="${videoId}"]`)?.closest('.video-card');
    if (cardEl) {
      const channelNameEl = cardEl.querySelector('.video-card-channel');
      if (channelNameEl) {
        const nameText = channelNameEl.textContent.trim();
        const chan = localDb.channels?.find(c => c.name === nameText);
        if (chan) videoChannelId = chan.id;
      }
    }
  }

  // Önceki oynatıcılar cleanupAllPlayers ile temizlendi

  let playerContainer = null;

  if (isInline) {
    // 1. Modal oynatıcıyı kapat/gizle
    const modal = document.getElementById('player-modal');
    if (modal) modal.classList.add('hidden');

    // 2. Inline player UI göster/gizle
    const inlineContainer = document.getElementById('downloaded-inline-player-container');
    const listContainer = document.getElementById('downloaded-list-container');
    if (inlineContainer) inlineContainer.classList.remove('hidden');
    if (listContainer) listContainer.classList.add('hidden');

    // Video oynatılmaya başladığında sayfayı en yukarı kaydır (böylece oynatıcı tam olarak görünür olur)
    const mainContent = document.querySelector('.main-content');
    if (mainContent) {
      mainContent.scrollTop = 0;
    }

    playerContainer = document.getElementById('inline-player-body');

    // 3. Bilgileri yerleştir
    const titleEl = document.getElementById('inline-player-title');
    if (titleEl) {
      const titleText = videoTitle || 'Yerleşik Oynatıcı';
      titleEl.textContent = titleText;
      titleEl.title = titleText; // Hover tooltip showing full title

      // Karakter sayısına göre yazı boyutunu dinamik ayarla (2. satıra taşmayı engellemek için)
      if (titleText.length > 80) {
        titleEl.style.fontSize = '0.85rem';
      } else if (titleText.length > 60) {
        titleEl.style.fontSize = '0.95rem';
      } else if (titleText.length > 40) {
        titleEl.style.fontSize = '1.1rem';
      } else {
        titleEl.style.fontSize = '1.25rem';
      }
    }

    const channelNameEl = document.getElementById('inline-player-channel-name');
    if (channelNameEl) channelNameEl.textContent = videoChannelName || '';

    const avatarEl = document.getElementById('inline-player-channel-avatar');
    const logoDividerEl = document.getElementById('inline-player-logo-divider');
    if (avatarEl) {
      if (videoChannelId) {
        avatarEl.src = `/api/channels/${videoChannelId}/avatar`;
        avatarEl.style.display = 'block';
        if (logoDividerEl) logoDividerEl.style.display = 'inline';
      } else {
        avatarEl.style.display = 'none';
        if (logoDividerEl) logoDividerEl.style.display = 'none';
      }
    }

    const subsEl = document.getElementById('inline-player-channel-subs');
    const subsTextEl = document.getElementById('inline-player-channel-subs-text');
    const dividerEl = document.getElementById('inline-player-channel-divider');
    if (subsEl && subsTextEl) {
      const channel = localDb.channels?.find(c => c.id === videoChannelId || (videoChannelName && c.name === videoChannelName));
      const subVal = channel && channel.subscriberCount ? channel.subscriberCount : '?';
      
      subsTextEl.textContent = subVal;
      subsEl.style.display = 'inline-flex';
      if (dividerEl) dividerEl.style.display = 'inline';
      try {
        if (typeof lucide !== 'undefined') {
          lucide.createIcons();
        }
      } catch (e) {}
    }

    const channelContainer = document.querySelector('.inline-player-channel');
    if (channelContainer) {
      if (videoChannelId) {
        channelContainer.style.cursor = 'pointer';
        channelContainer.title = localDb.settings?.lang === 'en' ? 'Go to Channel Videos' : 'Kanala Git';
        channelContainer.onclick = (e) => {
          e.preventDefault();
          window.open(`https://www.youtube.com/channel/${videoChannelId}/videos`, '_blank');
        };
      } else {
        channelContainer.style.cursor = 'default';
        channelContainer.title = '';
        channelContainer.onclick = null;
      }
    }

    const publishDateEl = document.getElementById('inline-player-publish-date');
    if (publishDateEl) {
      const isEn = localDb.settings?.lang === 'en';
      const pubDate = video && video.publishedAt ? formatDate(video.publishedAt) : '--';
      publishDateEl.textContent = (isEn ? 'Published: ' : 'Yüklenme: ') + pubDate;
    }

    const downloadDateEl = document.getElementById('inline-player-download-date');
    if (downloadDateEl) {
      const isEn = localDb.settings?.lang === 'en';
      const dlDate = video && video.downloadedAt ? formatDate(video.downloadedAt) : '--';
      downloadDateEl.textContent = (isEn ? 'Downloaded: ' : 'İndirilme: ') + dlDate;
    }

    const fileSizeEl = document.getElementById('inline-player-file-size');
    if (fileSizeEl) {
      const isEn = localDb.settings?.lang === 'en';
      fileSizeEl.textContent = (isEn ? 'Size: ' : 'Boyut: ') + (fileSizeStr || '--');
    }

    // Auto show comments panel
    const commentsContainer = document.getElementById('inline-player-comments-container');
    if (commentsContainer) {
      commentsContainer.classList.remove('hidden');
    }
    const commentsBtn = document.getElementById('inline-btn-comments');
    const isEn = localDb.settings?.lang === 'en';
    if (commentsBtn) {
      commentsBtn.classList.add('active');
      commentsBtn.title = isEn ? 'Hide Comments' : 'Yorumları Gizle';
    }
    loadComments(videoId);

    // Reset and Fetch description panel
    const descContainer = document.getElementById('inline-player-description-container');
    const descContent = document.getElementById('description-content');
    const descBtn = document.getElementById('inline-btn-description');
    
    if (descContainer) descContainer.classList.add('hidden');
    if (descBtn) {
      descBtn.classList.remove('active');
      descBtn.style.display = 'none';
    }
    if (descContent) descContent.innerHTML = '';

    fetch(`/api/video/${videoId}/description`)
      .then(res => res.json())
      .then(data => {
        if (data.success && data.description) {
          if (descContent) {
            descContent.innerHTML = formatDescriptionTimestamps(data.description);
          }
          if (descBtn) {
            descBtn.style.display = 'inline-flex';
            descBtn.classList.add('active');
            descBtn.title = isEn ? 'Hide Description' : 'Açıklamayı Gizle';
          }
          if (descContainer) {
            descContainer.classList.remove('hidden');
          }
        }
      })
      .catch(err => {
        console.error("Error fetching description:", err);
      });

    // Toggle SponsorBlock legend if SponsorBlock is enabled
    const sbLegend = document.getElementById('inline-player-sponsorblock-legend');
    const sbSep = document.getElementById('inline-player-sb-sep');
    if (sbLegend) {
      if (localDb.settings && localDb.settings.sponsorBlockEnabled === true) {
        sbLegend.style.display = 'flex';
        if (sbSep) sbSep.style.display = 'inline';
      } else {
        sbLegend.style.display = 'none';
        if (sbSep) sbSep.style.display = 'none';
      }
    }

    // 4. Eylemleri bağla
    const btnYoutube = document.getElementById('inline-btn-youtube');
    if (btnYoutube) btnYoutube.onclick = () => openYouTube(videoId);

    const btnSystem = document.getElementById('inline-btn-system');
    if (btnSystem) {
      const isCompleted = video && video.status === 'completed';
      const isMissing = video && video.fileMissing === true;
      if (isCompleted && !isMissing) {
        btnSystem.disabled = false;
        btnSystem.style.opacity = '1';
        btnSystem.style.cursor = 'pointer';
        btnSystem.onclick = () => playVideoSystem(videoId);
      } else {
        btnSystem.disabled = true;
        btnSystem.style.opacity = '0.4';
        btnSystem.style.cursor = 'not-allowed';
      }
    }

    const btnFolder = document.getElementById('inline-btn-folder');
    if (btnFolder) {
      const isCompleted = video && video.status === 'completed';
      const isMissing = video && video.fileMissing === true;
      if (isCompleted && !isMissing) {
        btnFolder.disabled = false;
        btnFolder.style.opacity = '1';
        btnFolder.style.cursor = 'pointer';
        btnFolder.onclick = () => openFolder(decodeURIComponent(encodeURIComponent(videoChannelName)));
      } else {
        btnFolder.disabled = true;
        btnFolder.style.opacity = '0.4';
        btnFolder.style.cursor = 'not-allowed';
      }
    }

    const btnDelete = document.getElementById('inline-btn-delete');
    if (btnDelete) {
      const isCompleted = video && video.status === 'completed';
      if (isCompleted) {
        btnDelete.style.display = 'inline-flex';
        btnDelete.onclick = () => showDeleteModal(videoId);
      } else {
        btnDelete.style.display = 'none';
      }
    }

    const btnTranslate = document.getElementById('inline-btn-translate-sub');
    if (btnTranslate) {
      const isCompleted = video && video.status === 'completed';

      if (isCompleted) {
        btnTranslate.style.display = 'inline-flex';
        btnTranslate.onclick = async () => {
          try {
            const lang = localDb.settings?.lang || currentLang || 'tr';
            const t = translations[lang] || translations.tr;

            // Defensive helper function for language names
            const getLangName = (code) => {
              if (!code) return 'Bilinmeyen Dil / Unknown';
              const map = {
                tr: 'Türkçe (TR)',
                en: 'English (EN)',
                es: 'Español (ES)',
                de: 'Deutsch (DE)',
                pt: 'Português (PT)',
                ar: 'العربية (AR)',
                ru: 'Русский (RU)',
                fr: 'Français (FR)',
                it: 'Italiano (IT)',
                ja: '日本語 (JA)',
                zh: '中文 (ZH)'
              };
              const codeLower = String(code).toLowerCase();
              return map[codeLower] || String(code).toUpperCase();
            };

            // Create Modal element
            const modal = document.createElement('div');
            modal.className = 'modal';
            modal.id = 'translate-sub-modal';
            modal.style.zIndex = '15000';
            
            let modalHtml = `
              <div class="modal-content" style="border-radius: 12px; padding: 24px; box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
                <div class="modal-header">
                  <h3>${t.modal_translate_title || 'Altyazı Çevirisi'}</h3>
                  <button class="modal-close-btn" id="close-translate-modal-btn">
                    <i data-lucide="x" style="width: 18px; height: 18px;"></i>
                  </button>
                </div>
                <div class="modal-body">
            `;

            if (!availableSubtitles || availableSubtitles.length === 0) {
              modalHtml += `
                <div style="text-align: center; padding: 12px; color: var(--accent-red); font-size: 0.9rem;">
                  <i data-lucide="alert-triangle" style="width: 32px; height: 32px; margin-bottom: 8px; stroke: var(--accent-red); display: inline-block;"></i>
                  <div>${t.modal_translate_no_subs || 'Bu video için indirilmiş altyazı bulunamadı. Çeviri yapabilmek için en az bir altyazı dosyası indirilmiş olmalıdır.'}</div>
                </div>
              `;
            } else {
              modalHtml += `
                <div class="form-group" style="margin-bottom: 16px;">
                  <label style="display: block; font-size: 0.85rem; color: var(--text-muted); margin-bottom: 6px;">
                    ${t.modal_translate_source || 'Çevrilecek Altyazı (Kaynak)'}
                  </label>
                  <select id="translate-source-lang" class="custom-select-trigger" style="width: 100%; height: 40px; background: var(--bg-sidebar); border: 1px solid var(--border-color); color: var(--text-main); border-radius: 8px; padding: 0 12px; outline: none; font-size: 0.9rem;">
                    ${availableSubtitles.map(s => {
                      const sLang = s && s.lang ? s.lang : '';
                      const sExt = s && s.ext ? String(s.ext).toUpperCase() : 'SRT';
                      return `<option value="${sLang}">${getLangName(sLang)} (${sExt})</option>`;
                    }).join('')}
                  </select>
                </div>
                <div class="form-group" style="margin-bottom: 24px;">
                  <label style="display: block; font-size: 0.85rem; color: var(--text-muted); margin-bottom: 6px;">
                    ${t.modal_translate_target || 'Hedef Dil'}
                  </label>
                  <select id="translate-target-lang" class="custom-select-trigger" style="width: 100%; height: 40px; background: var(--bg-sidebar); border: 1px solid var(--border-color); color: var(--text-main); border-radius: 8px; padding: 0 12px; outline: none; font-size: 0.9rem;">
                    <option value="tr" ${lang === 'tr' ? 'selected' : ''}>Türkçe (TR)</option>
                    <option value="en" ${lang === 'en' ? 'selected' : ''}>English (EN)</option>
                    <option value="es" ${lang === 'es' ? 'selected' : ''}>Español (ES)</option>
                    <option value="de" ${lang === 'de' ? 'selected' : ''}>Deutsch (DE)</option>
                    <option value="pt" ${lang === 'pt' ? 'selected' : ''}>Português (PT)</option>
                    <option value="ar" ${lang === 'ar' ? 'selected' : ''}>العربية (AR)</option>
                    <option value="ru" ${lang === 'ru' ? 'selected' : ''}>Русский (RU)</option>
                    <option value="fr">Français (FR)</option>
                    <option value="it">Italiano (IT)</option>
                    <option value="ja">日本語 (JA)</option>
                    <option value="zh">中文 (ZH)</option>
                  </select>
                </div>
              `;
            }

            modalHtml += `
                </div>
                <div class="modal-actions" style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 20px;">
                  <button class="btn btn-secondary" id="translate-modal-cancel" style="padding: 8px 16px; border-radius: 8px; font-size: 0.85rem; cursor: pointer; background: rgba(255,255,255,0.05); border: 1px solid var(--border-color); color: var(--text-main);">
                    ${t.modal_cancel_btn || 'İptal'}
                  </button>
                  ${availableSubtitles && availableSubtitles.length > 0 ? `
                    <button class="btn btn-primary" id="translate-modal-submit" style="padding: 8px 20px; border-radius: 8px; font-size: 0.85rem; cursor: pointer; font-weight: 600; background: linear-gradient(135deg, var(--accent-primary), var(--accent-secondary)); color: white; border: none;">
                      ${t.btn_translate_action || 'Çevir'}
                    </button>
                  ` : ''}
                </div>
              </div>
            `;

            modal.innerHTML = modalHtml;
            document.body.appendChild(modal);

            try {
              lucide.createIcons();
            } catch (e) {
              console.warn("Lucide icons rendering failed inside modal:", e);
            }

            const closeModal = () => {
              if (modal && modal.parentNode) {
                modal.parentNode.removeChild(modal);
              }
            };

            const closeBtn = document.getElementById('close-translate-modal-btn');
            if (closeBtn) closeBtn.onclick = closeModal;

            const cancelBtn = document.getElementById('translate-modal-cancel');
            if (cancelBtn) cancelBtn.onclick = closeModal;

            const submitBtn = document.getElementById('translate-modal-submit');
            if (submitBtn) {
              submitBtn.onclick = async () => {
                try {
                  const fromLang = document.getElementById('translate-source-lang').value;
                  const toLang = document.getElementById('translate-target-lang').value;

                  if (fromLang === toLang) {
                    showToast(lang === 'en' ? 'Source and target languages cannot be the same.' : 'Kaynak ve hedef dil aynı olamaz.', 'error');
                    return;
                  }

                  closeModal();

                  btnTranslate.disabled = true;
                  btnTranslate.style.opacity = '0.5';
                  const icon = btnTranslate.querySelector('i');
                  if (icon) icon.style.animation = 'spin 1s linear infinite';

                  // Show Toast for translation start
                  showToast(lang === 'en' ? 'Translating subtitles...' : 'Altyazılar çevriliyor...', 'info');

                  // Create and append visual loading overlay
                  const overlay = document.createElement('div');
                  overlay.className = 'subtitle-translation-overlay';
                  overlay.innerHTML = `
                    <div class="subtitle-translation-spinner"></div>
                    <div style="font-weight: 600; font-size: 1.15rem; margin-bottom: 6px; font-family: 'Outfit', sans-serif;">
                      ${t.overlay_translating_title || 'Altyazı Çeviriliyor...'}
                    </div>
                    <div style="font-size: 0.85rem; opacity: 0.8; color: #a1a1aa; max-width: 80%; text-align: center; line-height: 1.4;">
                      ${t.overlay_translating_desc || 'Lütfen bekleyin, altyazı çevirisi yapılıyor...'}
                    </div>
                  `;
                  const targetContainer = playerContainer || document.getElementById('inline-player-body');
                  if (targetContainer) {
                    targetContainer.appendChild(overlay);
                  }

                  try {
                    const res = await fetch(`/api/video/${videoId}/translate-subtitle`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ fromLang, toLang })
                    });
                    const data = await res.json();
                    if (data.success) {
                      showToast(lang === 'en' ? 'Subtitles successfully translated!' : 'Altyazılar başarıyla çevrildi!', 'success');
                      playVideoEmbedded(videoId, videoPlayerInstance ? videoPlayerInstance.currentTime : null);
                    } else {
                      showToast(data.error || 'Translation failed.', 'error');
                    }
                  } catch (err) {
                    console.error('Subtitle translation error:', err);
                    showToast('Translation error occurred.', 'error');
                  } finally {
                    btnTranslate.disabled = false;
                    btnTranslate.style.opacity = '1';
                    if (icon) icon.style.animation = '';
                    if (overlay && overlay.parentNode) {
                      overlay.parentNode.removeChild(overlay);
                    }
                  }
                } catch (submitErr) {
                  console.error("Submit translation click error:", submitErr);
                  showToast("Hata: " + submitErr.message, "error");
                }
              };
            }
          } catch (clickErr) {
            console.error("Translate click error:", clickErr);
            showToast(localDb.settings?.lang === 'en' ? 'An error occurred while opening the translation tool.' : 'Çeviri aracı açılırken bir hata oluştu.', 'error');
          }
        };
      } else {
        btnTranslate.style.display = 'none';
      }
    }

    // SponsorBlock toggle button logic
    const btnSBToggle = document.getElementById('inline-btn-sponsorblock-toggle');
    if (btnSBToggle) {
      btnSBToggle.style.display = 'inline-flex';
      updateSBToggleButtonUI();

      btnSBToggle.onclick = async () => {
        const isCurrentlyActive = localDb.settings && localDb.settings.sponsorBlockEnabled === true;
        const newStatus = !isCurrentlyActive;
        
        if (!localDb.settings) localDb.settings = {};
        localDb.settings.sponsorBlockEnabled = newStatus;

        const settingsSB = document.getElementById('settings-sponsorblock');
        if (settingsSB) settingsSB.checked = newStatus;

        updateSBToggleButtonUI();

        try {
          await fetch('/api/settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sponsorBlockEnabled: newStatus })
          });
        } catch(err) {
          console.error('[SponsorBlock] Setting save error:', err);
        }

        if (typeof updateSponsorBlockStatusUI === 'function') {
          updateSponsorBlockStatusUI();
        }
        
        const lang = (localDb && localDb.settings && localDb.settings.lang) || currentLang || 'tr';
        const t = translations[lang] || translations.tr;
        const icon = newStatus ? 'shield' : 'shield-off';
        const title = newStatus 
          ? (t.sponsorblock_active_toast || 'SponsorBlock Aktif') 
          : (t.sponsorblock_disabled_toast || 'SponsorBlock Devre Dışı');
        const desc = newStatus 
          ? (t.sponsorblock_active_toast_desc || 'Sponsorlu alanlar otomatik atlanacak') 
          : (t.sponsorblock_disabled_toast_desc || 'Sponsorlu alan atlamaları durduruldu');

        const html = `
          <div class="player-transient-card">
            <i data-lucide="${icon}" style="width: 36px; height: 36px; color: ${newStatus ? '#4ade80' : '#ef4444'};"></i>
            <div class="transient-title">${title}</div>
            <div class="transient-desc">${desc}</div>
          </div>
        `;
        if (typeof showPlayerTransientOverlay === 'function') {
          showPlayerTransientOverlay(html, 1500);
        }
        try {
          lucide.createIcons();
        } catch(e) {}
      };
    }

    const btnClose = document.getElementById('inline-btn-close');
    if (btnClose) btnClose.onclick = () => closeInlinePlayer();

    // Autoplay toggle button logic
    const btnAutoplay = document.getElementById('inline-btn-autoplay-toggle');
    if (btnAutoplay) {
      const isAutoplayEnabled = localStorage.getItem('inline-autoplay-enabled') === 'true';
      if (isAutoplayEnabled) {
        btnAutoplay.classList.add('active');
      } else {
        btnAutoplay.classList.remove('active');
      }

      btnAutoplay.onclick = () => {
        const currentlyActive = btnAutoplay.classList.contains('active');
        const nextActive = !currentlyActive;
        localStorage.setItem('inline-autoplay-enabled', nextActive ? 'true' : 'false');
        
        if (nextActive) {
          btnAutoplay.classList.add('active');
        } else {
          btnAutoplay.classList.remove('active');
        }

        const lang = (localDb && localDb.settings && localDb.settings.lang) || currentLang || 'tr';
        const isEn = lang === 'en';
        const title = isEn 
          ? (nextActive ? 'Autoplay: ON' : 'Autoplay: OFF') 
          : (nextActive ? 'Otomatik Geçiş: AÇIK' : 'Otomatik Geçiş: KAPALI');
        const desc = isEn
          ? (nextActive ? 'Next video will play automatically.' : 'Continuous playback disabled.')
          : (nextActive ? 'Sıradaki video otomatik olarak oynatılacak.' : 'Otomatik video geçişi devre dışı bırakıldı.');
        const icon = nextActive ? 'repeat' : 'repeat';
        const color = nextActive ? '#4ade80' : '#ef4444';

        const html = `
          <div class="player-transient-card">
            <i data-lucide="${icon}" style="width: 36px; height: 36px; color: ${color};"></i>
            <div class="transient-title">${title}</div>
            <div class="transient-desc">${desc}</div>
          </div>
        `;
        if (typeof showPlayerTransientOverlay === 'function') {
          showPlayerTransientOverlay(html, 1500);
        }
        try {
          lucide.createIcons();
        } catch(e) {}
      };
    }

    // Açıklama ve Yorumları Güncelleme Butonu logic
    const btnRefreshDetails = document.getElementById('inline-btn-refresh-details');
    if (btnRefreshDetails) {
      btnRefreshDetails.onclick = async () => {
        const lang = (localDb && localDb.settings && localDb.settings.lang) || currentLang || 'tr';
        const isEn = lang === 'en';
        
        // İlk yükleniyor bildirimi
        const loadingHtml = `
          <div class="player-transient-card">
            <i data-lucide="refresh-cw" style="width: 36px; height: 36px; color: #38bdf8; animation: spin 1s linear infinite;"></i>
            <div class="transient-title">${isEn ? 'Refreshing...' : 'Güncelleniyor...'}</div>
            <div class="transient-desc">${isEn ? 'Updating description and comments from YouTube' : 'Açıklama ve yorumlar YouTube\'dan tazelemekte'}</div>
          </div>
        `;
        if (typeof showPlayerTransientOverlay === 'function') {
          showPlayerTransientOverlay(loadingHtml, 6000);
        }
        try {
          lucide.createIcons();
        } catch(e) {}

        try {
          // Açıklamayı güncelle
          const descRes = await fetch(`/api/video/${videoId}/refresh-details`, {
            method: 'POST'
          });
          const descData = await descRes.json();

          if (descData.success) {
            // Açıklama alanını tazele
            const descContent = document.getElementById('description-content');
            if (descContent && descData.description) {
              descContent.innerHTML = formatDescriptionTimestamps(descData.description);
            }
            
            const descBtn = document.getElementById('inline-btn-description');
            if (descBtn) {
              descBtn.style.display = 'inline-flex';
              descBtn.classList.add('active');
              descBtn.title = isEn ? 'Hide Description' : 'Açıklamayı Gizle';
            }
            
            const descContainer = document.getElementById('inline-player-description-container');
            if (descContainer) {
              descContainer.classList.remove('hidden');
            }

            // Yorumları yeniden yükle
            loadComments(videoId);

            // Başarılı bildirimi göster
            const successHtml = `
              <div class="player-transient-card">
                <i data-lucide="check-circle" style="width: 36px; height: 36px; color: #4ade80;"></i>
                <div class="transient-title">${isEn ? 'Details Updated' : 'Detaylar Güncellendi'}</div>
                <div class="transient-desc">${isEn ? 'Description and comments updated successfully.' : 'Açıklama ve yorumlar başarıyla yenilendi.'}</div>
              </div>
            `;
            if (typeof showPlayerTransientOverlay === 'function') {
              showPlayerTransientOverlay(successHtml, 2000);
            }
          } else {
            throw new Error(descData.error || 'API Error');
          }
        } catch (err) {
          console.error("Refresh details error:", err);
          const errorHtml = `
            <div class="player-transient-card">
              <i data-lucide="alert-circle" style="width: 36px; height: 36px; color: #ef4444;"></i>
              <div class="transient-title">${isEn ? 'Update Failed' : 'Güncelleme Başarısız'}</div>
              <div class="transient-desc">${err.message || 'Error occurred.'}</div>
            </div>
          `;
          if (typeof showPlayerTransientOverlay === 'function') {
            showPlayerTransientOverlay(errorHtml, 2500);
          }
        }
        try {
          lucide.createIcons();
        } catch(e) {}
      };
    }

    // Kaldığım Yeri YouTube'a Eşitle Butonu logic
    const btnSyncWatchtime = document.getElementById('inline-btn-sync-watchtime');
    if (btnSyncWatchtime) {
      btnSyncWatchtime.onclick = async () => {
        const lang = (localDb && localDb.settings && localDb.settings.lang) || currentLang || 'tr';
        const isEn = lang === 'en';
        
        let currentTime = 0;
        if (videoPlayerInstance && typeof videoPlayerInstance.currentTime === 'number') {
          currentTime = videoPlayerInstance.currentTime;
        } else {
          const v = document.querySelector('#inline-player-container video, #inline-player-body video');
          if (v) currentTime = v.currentTime || 0;
        }

        const mins = Math.floor(currentTime / 60);
        const secs = Math.floor(currentTime % 60);
        const timeStr = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;

        // Görsel transient kart göster
        const loadingHtml = `
          <div class="player-transient-card">
            <i data-lucide="bookmark-check" style="width: 36px; height: 36px; color: #a855f7; animation: pulse 1s infinite;"></i>
            <div class="transient-title">${isEn ? 'Syncing to YouTube...' : 'YouTube\'a Eşitleniyor...'}</div>
            <div class="transient-desc">${isEn ? `Syncing current position (${timeStr}) with YouTube Watch History` : `Kaldığınız yer (${timeStr}) YouTube izleme geçmişinize kaydediliyor...`}</div>
          </div>
        `;
        if (typeof showPlayerTransientOverlay === 'function') {
          showPlayerTransientOverlay(loadingHtml, 3000);
        }
        try { lucide.createIcons(); } catch(e) {}

        try {
          const targetVideoId = videoId || currentPlayingVideoId;
          if (!targetVideoId) {
            showToast(isEn ? 'No active video found.' : 'Aktif video bulunamadı.', 'error');
            return;
          }
          const item = localDb?.history?.find(h => h.id === targetVideoId);
          const res = await fetch(`/api/video/${targetVideoId}/sync-watchtime`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              currentTime,
              title: item ? item.title : '',
              silent: false
            })
          });
          const data = await res.json();
          if (data.success) {
            const successHtml = `
              <div class="player-transient-card">
                <i data-lucide="check-circle" style="width: 36px; height: 36px; color: #4ade80;"></i>
                <div class="transient-title">${isEn ? 'Position Synced!' : 'YouTube Eşitlendi!'}</div>
                <div class="transient-desc">${isEn ? `Saved at ${timeStr} in your YouTube Watch History.` : `YouTube izleme geçmişinizde ${timeStr} olarak kaydedildi.`}</div>
              </div>
            `;
            if (typeof showPlayerTransientOverlay === 'function') {
              showPlayerTransientOverlay(successHtml, 3000);
            }
          } else {
            showToast(data.error || (isEn ? 'Failed to sync position.' : 'Eşitleme başarısız oldu.'), 'error');
          }
        } catch (err) {
          console.error('Watchtime sync error:', err);
          showToast(isEn ? 'Communication error.' : 'Sunucu ile iletişim hatası.', 'error');
        }
        try { lucide.createIcons(); } catch(e) {}
      };
    }

    // Subtitle Color & Opacity & Redownload bindings
    const inlineSubColor = document.getElementById('inline-subtitle-color');
    if (inlineSubColor) {
      inlineSubColor.value = (localDb.settings && localDb.settings.subtitleColor) || '#ffffff';
      inlineSubColor.onchange = async (e) => {
        const val = e.target.value;
        localDb.settings.subtitleColor = val;
        document.documentElement.style.setProperty('--subtitle-color', val);
        const globalDropdown = document.getElementById('settings-subtitle-color');
        if (globalDropdown) globalDropdown.value = val;
        
        if (videoPlayerInstance && typeof videoPlayerInstance.subtitle?.style === 'function') {
          videoPlayerInstance.subtitle.style({ color: val });
        }
        
        try {
          await fetch('/api/settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(localDb.settings)
          });
        } catch (err) {
          console.error('subtitleColor save error:', err);
        }
      };
    }

    const inlineSubOpacity = document.getElementById('inline-subtitle-opacity');
    if (inlineSubOpacity) {
      inlineSubOpacity.value = (localDb.settings && localDb.settings.subtitleOpacity) || '0.7';
      inlineSubOpacity.onchange = async (e) => {
        const val = e.target.value;
        localDb.settings.subtitleOpacity = val;
        document.documentElement.style.setProperty('--subtitle-bg-opacity', val);
        
        if (videoPlayerInstance && typeof videoPlayerInstance.subtitle?.style === 'function') {
          videoPlayerInstance.subtitle.style({
            backgroundColor: `rgba(0, 0, 0, ${val})`
          });
        }
        
        try {
          await fetch('/api/settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(localDb.settings)
          });
        } catch (err) {
          console.error('subtitleOpacity save error:', err);
        }
      };
    }

    const inlineSubSize = document.getElementById('inline-subtitle-size');
    if (inlineSubSize) {
      inlineSubSize.value = (localDb.settings && localDb.settings.subtitleSize) || '26px';
      inlineSubSize.onchange = async (e) => {
        const val = e.target.value;
        localDb.settings.subtitleSize = val;
        document.documentElement.style.setProperty('--subtitle-font-size', val);
        
        if (videoPlayerInstance && typeof videoPlayerInstance.subtitle?.style === 'function') {
          videoPlayerInstance.subtitle.style({
            fontSize: val
          });
        }
        
        try {
          await fetch('/api/settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(localDb.settings)
          });
        } catch (err) {
          console.error('subtitleSize save error:', err);
        }
      };
    }

    const btnRedownload = document.getElementById('inline-btn-redownload');
    if (btnRedownload) {
      const isCompleted = video && video.status === 'completed';
      if (isCompleted) {
        btnRedownload.style.display = 'inline-flex';
        btnRedownload.onclick = async () => {
          if (!confirm(localDb.settings?.lang === 'en' 
            ? 'Are you sure you want to delete this video and download it again from scratch?' 
            : 'Bu videoyu silip baştan indirmek istediğinizden emin misiniz?')) {
            return;
          }
          
          try {
            showToast(localDb.settings?.lang === 'en' ? 'Redownload triggered...' : 'Tekrar indirme başlatıldı...', 'info');
            const res = await fetch(`/api/history/${videoId}/redownload`, {
              method: 'POST'
            });
            const data = await res.json();
            if (data.success) {
              showToast(localDb.settings?.lang === 'en' ? 'Video queued for download.' : 'Video tekrar indirilmek üzere kuyruğa eklendi.', 'success');
              if (typeof closeInlinePlayer === 'function') {
                closeInlinePlayer();
              }
            } else {
              showToast(data.error || 'Hata oluştu.', 'error');
            }
          } catch (err) {
            showToast('Sunucu ile iletişim hatası.', 'error');
          }
        };
      } else {
        btnRedownload.style.display = 'none';
      }
    }

    // 5. Çalma listesini oluştur
    renderDownloadedPlaylist(videoId);

  } else {
    // Floating Modal player
    const inlineContainer = document.getElementById('downloaded-inline-player-container');
    const listContainer = document.getElementById('downloaded-list-container');
    if (inlineContainer) inlineContainer.classList.add('hidden');
    if (listContainer) listContainer.classList.remove('hidden');

    const modal = document.getElementById('player-modal');
    const titleEl = document.getElementById('player-modal-title');
    if (modal) {
      if (titleEl) {
        titleEl.textContent = videoTitle || 'Gömülü Video Oynatıcı';
      }
      
      const logoEl = document.getElementById('player-modal-logo');
      if (logoEl && videoChannelId) {
        logoEl.src = `/api/channels/${videoChannelId}/avatar`;
        logoEl.style.display = 'block';
        logoEl.style.cursor = 'pointer';
        logoEl.title = localDb.settings?.lang === 'en' ? 'Go to Channel Videos' : 'Kanala Git';
        logoEl.onclick = (e) => {
          e.preventDefault();
          window.open(`https://www.youtube.com/channel/${videoChannelId}/videos`, '_blank');
        };
        logoEl.onerror = function() {
          this.src = 'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2224%22 height=%2224%22><rect width=%2224%22 height=%2224%22 fill=%22%2316142a%22/><text x=%2250%25%22 y=%2250%25%22 dominant-baseline=%22middle%22 text-anchor=%22middle%22 fill=%22%2394a3b8%22 font-family=%22sans-serif%22 font-size=%2210%22>?</text></svg>';
        };
      } else if (logoEl) {
        logoEl.style.display = 'none';
        logoEl.style.cursor = 'default';
        logoEl.onclick = null;
      }

      const isShort = isShortVideo(videoDuration, videoTitle, videoChannelId);
      modal.classList.remove('hidden');
      resetAndApplyPlayerDimensions(isShort, false);

      const minBtn = document.getElementById('minimize-player-modal-btn');
      if (minBtn) {
        const icon = minBtn.querySelector('i') || minBtn.querySelector('[data-lucide]');
        if (icon) {
          icon.setAttribute('data-lucide', 'minus');
        }
        minBtn.title = localDb.settings && localDb.settings.lang === 'en' ? 'Minimize' : 'Küçült';
      }
      try {
        if (typeof lucide !== 'undefined') lucide.createIcons();
      } catch (e) {}

      playerContainer = modal.querySelector('.player-modal-body');
    }
  }

  seekedForCurrentVideo = false;
  currentPlayingVideoId = videoId;
  setCurrentPlayingVideoId(videoId);

  const isCompleted = video && video.status === 'completed';
  const isMissing = video && video.fileMissing === true;
  let streamUrl = `/api/video-stream?videoId=${videoId}`;
  console.log('[playVideoEmbedded] isCompleted:', isCompleted, '| isMissing:', isMissing, '| playerType:', playerType);
  console.log('[playVideoEmbedded] streamUrl:', streamUrl);
  console.log('[playVideoEmbedded] playerContainer before player init:', playerContainer);

  // Eğer WPF Player (WebView2) içindeysek ve video indirilmesi tamamlanmış yerel bir video ise doğrudan sanal yerel disk yolunu kullan
  if (isCompleted && !isMissing && window.chrome?.webview && video.filePath) {
    const pathNormalized = video.filePath.replace(/\\/g, '/');
    const match = pathNormalized.match(/^([a-zA-Z]):\/(.*)$/);
    if (match) {
      const driveLetter = match[1].toLowerCase();
      const relativePath = match[2];
      const encodedPath = relativePath.split('/').map(seg => encodeURIComponent(seg)).join('/');
      streamUrl = `http://haytool-${driveLetter}.local/${encodedPath}`;
    } else {
      streamUrl = `file:///${encodeURI(pathNormalized)}`;
    }
  }

  const playerType = (localDb.settings && localDb.settings.playerType) || 'plyr';
  const playRemote = !isCompleted || isMissing;

  if (playRemote) {
    if (playerContainer) {
      const autoplayVal = (forcePaused === true) ? '0' : '1';
      playerContainer.innerHTML = `<iframe src="https://www.youtube.com/embed/${videoId}?autoplay=${autoplayVal}" style="width: 100%; height: 100%; border: none; display: block;" allow="autoplay; encrypted-media" allowfullscreen></iframe>`;
    }
    videoPlayerInstance = null;
    setVideoPlayerInstance(null);
  } else {
    if (playerContainer) {
      if (playerType === 'artplayer') {
        playerContainer.innerHTML = '<div id="embedded-artplayer" style="width: 100%; height: 100%; display: block; outline: none;"></div>';
      } else {
        const autoplayAttr = (forcePaused === true) ? '' : 'autoplay';
        playerContainer.innerHTML = `<video id="embedded-video-player" controls ${autoplayAttr} style="width: 100%; height: 100%; display: block; outline: none;"></video>`;
      }
    }

    if (playerType === 'artplayer' && typeof Artplayer !== 'undefined') {
      let artHighlight = [];
      if (localDb.settings && localDb.settings.sponsorBlockEnabled === true) {
        artHighlight = currentVideoSponsorSegments.map(seg => ({
          time: seg.start,
          text: localDb.settings.lang === 'en' ? `Sponsor Block (${seg.category})` : `Sponsor Alanı (${seg.category})`
        }));
      }

      let defaultSubtitle = null;
      if (availableSubtitles && availableSubtitles.length > 0) {
        defaultSubtitle = availableSubtitles.find(s => s.lang === 'tr') || 
                          availableSubtitles.find(s => s.lang === 'en') || 
                          availableSubtitles[0];
      }

      const artSettings = [];
      if (availableSubtitles && availableSubtitles.length > 0) {
        const isEn = localDb.settings?.lang === 'en';
        const subtitleSelector = [
          {
            default: !defaultSubtitle,
            html: isEn ? 'Off' : 'Kapalı',
            url: ''
          }
        ];
        
        availableSubtitles.forEach(sub => {
          subtitleSelector.push({
            default: defaultSubtitle && defaultSubtitle.lang === sub.lang,
            html: sub.label,
            url: sub.url
          });
        });

        artSettings.push({
          width: 200,
          html: isEn ? 'Subtitle' : 'Altyazı',
          tooltip: defaultSubtitle ? defaultSubtitle.label : (isEn ? 'Off' : 'Kapalı'),
          selector: subtitleSelector,
          onSelect: function (item) {
            if (item.url) {
              videoPlayerInstance.subtitle.show = true;
              videoPlayerInstance.subtitle.url = item.url;
            } else {
              videoPlayerInstance.subtitle.show = false;
            }
            return item.html;
          }
        });
      }

      // Altyazı Rengi Ayarı
      const artIsEn = localDb.settings?.lang === 'en';
      const colors = [
        { value: '#ffffff', nameEn: 'White', nameTr: 'Beyaz' },
        { value: '#ffff00', nameEn: 'Yellow', nameTr: 'Sarı' },
        { value: '#00ff00', nameEn: 'Green', nameTr: 'Yeşil' },
        { value: '#00ffff', nameEn: 'Cyan', nameTr: 'Turkuaz' },
        { value: '#ff00ff', nameEn: 'Pink', nameTr: 'Pembe' },
        { value: '#ff0000', nameEn: 'Red', nameTr: 'Kırmızı' },
        { value: '#0000ff', nameEn: 'Blue', nameTr: 'Mavi' },
        { value: '#ffa500', nameEn: 'Orange', nameTr: 'Turuncu' },
        { value: '#800080', nameEn: 'Purple', nameTr: 'Mor' },
        { value: '#000000', nameEn: 'Black', nameTr: 'Siyah' },
        { value: '#808080', nameEn: 'Gray', nameTr: 'Gri' },
        { value: '#ffffe0', nameEn: 'Light Yellow', nameTr: 'Açık Sarı' }
      ];
      
      const currentColor = (localDb.settings && localDb.settings.subtitleColor) || '#ffffff';
      const colorSelector = colors.map(c => ({
        default: currentColor === c.value,
        html: artIsEn ? c.nameEn : c.nameTr,
        value: c.value
      }));

      artSettings.push({
        width: 200,
        html: artIsEn ? 'Subtitle Color' : 'Altyazı Rengi',
        tooltip: artIsEn 
          ? (colors.find(c => c.value === currentColor)?.nameEn || 'White')
          : (colors.find(c => c.value === currentColor)?.nameTr || 'Beyaz'),
        selector: colorSelector,
        onSelect: function (item) {
          if (videoPlayerInstance && videoPlayerInstance.subtitle) {
            videoPlayerInstance.subtitle.style({
              color: item.value,
              textShadow: '0 0 4px #000000'
            });
          }
          if (localDb && localDb.settings) {
            localDb.settings.subtitleColor = item.value;
            const selectEl = document.getElementById('settings-subtitle-color');
            if (selectEl) selectEl.value = item.value;
            
            // Arka planda ayarları kaydet
            fetch('/api/settings', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ ...localDb.settings, subtitleColor: item.value })
            })
            .catch(err => console.error(err));
          }
          return item.html;
        }
      });

      videoPlayerInstance = new Artplayer({
        container: '#embedded-artplayer',
        url: streamUrl,
        autoplay: forcePaused === true ? false : true,
        autoSize: false,
        autoMini: false,
        playbackRate: true,
        aspectRatio: true,
        setting: true,
        hotkey: false,
        pip: true,
        fullscreen: true,
        mutex: true,
        theme: '#ff0055',
        highlight: artHighlight,
        subtitle: defaultSubtitle ? {
          url: defaultSubtitle.url,
          type: 'vtt',
          style: {
            color: (localDb.settings && localDb.settings.subtitleColor) || '#ffffff',
            backgroundColor: `rgba(0, 0, 0, ${(localDb.settings && localDb.settings.subtitleOpacity) || '0.7'})`,
            fontSize: (localDb.settings && localDb.settings.subtitleSize) || '26px',
            textShadow: '0 0 4px #000000',
          },
        } : undefined,
        settings: artSettings
      });
      setVideoPlayerInstance(videoPlayerInstance);

      if (playerResizeObserver) {
        playerResizeObserver.disconnect();
      }
      playerResizeObserver = new ResizeObserver(() => {
        if (videoPlayerInstance && typeof videoPlayerInstance.resize === 'function') {
          videoPlayerInstance.resize();
        }
      });
      playerResizeObserver.observe(playerContainer);

      // Volume wheel control
      const artContainer = document.getElementById('embedded-artplayer');
      if (artContainer) {
        artContainer.addEventListener('wheel', (e) => {
          e.preventDefault();
          let currentVolume = videoPlayerInstance.volume;
          let newVolume;
          if (e.deltaY < 0) {
            newVolume = Math.min(1, currentVolume + 0.02);
          } else {
            newVolume = Math.max(0, currentVolume - 0.02);
          }
          videoPlayerInstance.volume = newVolume;
          if (typeof triggerVolumeHUD === 'function') {
            triggerVolumeHUD(newVolume);
          }
        }, { passive: false });
      }

      setVideoPlayerInstance(videoPlayerInstance);

      videoPlayerInstance.on('ready', () => {
        const rawVideo = videoPlayerInstance.video;
        if (rawVideo) {
          rawVideo.addEventListener('play', () => sendPlayerActivity(true));
          rawVideo.addEventListener('pause', () => {
            sendPlayerActivity(false);
            autoSyncWatchtimeHelper(currentPlayingVideoId, rawVideo.currentTime, true);
          });
          rawVideo.addEventListener('ended', () => {
            sendPlayerActivity(false);
            autoSyncWatchtimeHelper(currentPlayingVideoId, rawVideo.currentTime, true);
          });
          adjustPlayerOrientation(rawVideo);
          if (rawVideo.duration) {
            drawSponsorSegmentsOnTimeline(rawVideo.duration, 'artplayer');
          }
          rawVideo.addEventListener('loadedmetadata', () => {
            adjustPlayerOrientation(rawVideo);
            drawSponsorSegmentsOnTimeline(rawVideo.duration, 'artplayer');
          });

          rawVideo.addEventListener('timeupdate', () => {
            if (!currentPlayingVideoId) return;
            const currentTime = rawVideo.currentTime;

            if (localDb.settings && localDb.settings.sponsorBlockEnabled === true) {
              checkAndSkipSponsor(currentTime, rawVideo);
            }

            // Periyodik (her 30sn) YouTube izleme süresi senkronizasyonu
            autoSyncWatchtimeHelper(currentPlayingVideoId, currentTime, false);

            const duration = rawVideo.duration || 0;
            if (currentTime > 2 && duration > 10 && (duration - currentTime) > 5) {
              const resumeData = JSON.parse(localStorage.getItem('haytool_playback_resume') || '{}');
              resumeData[currentPlayingVideoId] = currentTime;
              localStorage.setItem('haytool_playback_resume', JSON.stringify(resumeData));
            } else if (duration > 0 && (duration - currentTime) <= 5) {
              const resumeData = JSON.parse(localStorage.getItem('haytool_playback_resume') || '{}');
              delete resumeData[currentPlayingVideoId];
              localStorage.setItem('haytool_playback_resume', JSON.stringify(resumeData));
            }
          });

          if (!seekedForCurrentVideo && currentPlayingVideoId) {
            const targetTime = (startSeconds !== null) ? startSeconds : (JSON.parse(localStorage.getItem('haytool_playback_resume') || '{}')[currentPlayingVideoId] || 0);
            if (targetTime > 0) {
              rawVideo.currentTime = targetTime;
            }
            seekedForCurrentVideo = true;
          }
          if (forcePaused === true) {
            videoPlayerInstance.pause();
          } else if (forcePaused === false) {
            videoPlayerInstance.play().catch(e => console.warn(e));
          }
          
          rawVideo.addEventListener('ended', () => {
            const isAutoplayEnabled = localStorage.getItem('inline-autoplay-enabled') === 'true';
            if (isAutoplayEnabled) {
              playNextVideoInPlaylist();
            }
          });
        }
      });

    } else {
      const player = document.getElementById('embedded-video-player');
      if (player) {
        // Clear old track tags
        const oldTracks = player.querySelectorAll('track');
        oldTracks.forEach(t => t.remove());

        // Add track tags if available
        if (availableSubtitles && availableSubtitles.length > 0) {
          availableSubtitles.forEach(sub => {
            const track = document.createElement('track');
            track.kind = 'subtitles';
            track.label = sub.label;
            track.srclang = sub.lang;
            track.src = sub.url;
            
            const isDefault = (sub.lang === 'tr' && availableSubtitles.some(s => s.lang === 'tr')) ||
                              (sub.lang === 'en' && !availableSubtitles.some(s => s.lang === 'tr') && sub.lang === 'en') ||
                              (!availableSubtitles.some(s => s.lang === 'tr' || s.lang === 'en') && sub === availableSubtitles[0]);
            
            if (isDefault) {
              track.default = true;
            }
            player.appendChild(track);
          });
        }

        if (playerType === 'plyr' && typeof Plyr !== 'undefined') {
          player.src = streamUrl;
          videoPlayerInstance = new Plyr('#embedded-video-player', {
            iconUrl: '/plyr.svg',
            controls: [
              'play-large', 'restart', 'rewind', 'play', 'fast-forward',
              'progress', 'current-time', 'duration', 'mute', 'volume',
              'captions', 'settings', 'pip', 'fullscreen'
            ],
            settings: ['captions', 'speed', 'loop'],
            speed: { selected: 1, options: [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2] }
          });
          setVideoPlayerInstance(videoPlayerInstance);

          videoPlayerInstance.on('ready', () => {
            adjustPlayerOrientation(videoPlayerInstance.media);
            if (videoPlayerInstance.duration) {
              drawSponsorSegmentsOnTimeline(videoPlayerInstance.duration, 'plyr');
            }

            // Oynatıcı hazır olduğunda başlat (ready öncesi play() sessizce başarısız olur)
            if (forcePaused === true) {
              videoPlayerInstance.pause();
            } else {
              videoPlayerInstance.play().catch(err => {
                console.warn('Otomatik oynatma engellendi (ready içinde):', err);
              });
            }
          });

          videoPlayerInstance.on('play', () => sendPlayerActivity(true));
          videoPlayerInstance.on('pause', () => {
            sendPlayerActivity(false);
            autoSyncWatchtimeHelper(currentPlayingVideoId, videoPlayerInstance.currentTime, true);
          });
          videoPlayerInstance.on('ended', () => {
            sendPlayerActivity(false);
            autoSyncWatchtimeHelper(currentPlayingVideoId, videoPlayerInstance.currentTime, true);
          });

          videoPlayerInstance.on('loadedmetadata', () => {
            adjustPlayerOrientation(videoPlayerInstance.media);
            if (videoPlayerInstance.duration) {
              drawSponsorSegmentsOnTimeline(videoPlayerInstance.duration, 'plyr');
            }
          });

          // Volume wheel control
          const containerSelector = isInline ? '#downloaded-inline-player-container' : '#player-modal';
          const outerContainer = document.querySelector(containerSelector);
          const plyrContainer = outerContainer?.querySelector('.plyr');
          if (plyrContainer) {
            plyrContainer.addEventListener('wheel', (e) => {
              e.preventDefault();
              let currentVolume = videoPlayerInstance.volume;
              let newVolume;
              if (e.deltaY < 0) {
                newVolume = Math.min(1, currentVolume + 0.02);
              } else {
                newVolume = Math.max(0, currentVolume - 0.02);
              }
              videoPlayerInstance.volume = newVolume;
              if (typeof triggerVolumeHUD === 'function') {
                triggerVolumeHUD(newVolume);
              }
            }, { passive: false });
          }

          videoPlayerInstance.on('timeupdate', () => {
            if (!currentPlayingVideoId) return;
            const currentTime = videoPlayerInstance.currentTime;

            if (localDb.settings && localDb.settings.sponsorBlockEnabled === true) {
              checkAndSkipSponsor(currentTime, videoPlayerInstance);
            }

            // Periyodik (her 30sn) YouTube izleme süresi senkronizasyonu
            autoSyncWatchtimeHelper(currentPlayingVideoId, currentTime, false);

            const duration = videoPlayerInstance.duration || 0;
            if (currentTime > 2 && duration > 10 && (duration - currentTime) > 5) {
              const resumeData = JSON.parse(localStorage.getItem('haytool_playback_resume') || '{}');
              resumeData[currentPlayingVideoId] = currentTime;
              localStorage.setItem('haytool_playback_resume', JSON.stringify(resumeData));
            } else if (duration > 0 && (duration - currentTime) <= 5) {
              const resumeData = JSON.parse(localStorage.getItem('haytool_playback_resume') || '{}');
              delete resumeData[currentPlayingVideoId];
              localStorage.setItem('haytool_playback_resume', JSON.stringify(resumeData));
            }
          });

          videoPlayerInstance.on('canplay', () => {
            if (!seekedForCurrentVideo && currentPlayingVideoId) {
              const targetTime = (startSeconds !== null) ? startSeconds : (JSON.parse(localStorage.getItem('haytool_playback_resume') || '{}')[currentPlayingVideoId] || 0);
              if (targetTime > 0) {
                videoPlayerInstance.currentTime = targetTime;
              }
              seekedForCurrentVideo = true;
            }
          });

          videoPlayerInstance.on('ended', () => {
            const isAutoplayEnabled = localStorage.getItem('inline-autoplay-enabled') === 'true';
            if (isAutoplayEnabled) {
              playNextVideoInPlaylist();
            }
          });
        } else {
          // HTML5 standard
          player.src = streamUrl;
          player.controls = true;

          player.addEventListener('loadedmetadata', () => {
            adjustPlayerOrientation(player);
          });
          if (player.duration) {
            adjustPlayerOrientation(player);
          }

          player.addEventListener('wheel', (e) => {
            e.preventDefault();
            let currentVolume = player.volume;
            let newVolume;
            if (e.deltaY < 0) {
              newVolume = Math.min(1, currentVolume + 0.02);
            } else {
              newVolume = Math.max(0, currentVolume - 0.02);
            }
            player.volume = newVolume;
            if (typeof triggerVolumeHUD === 'function') {
              triggerVolumeHUD(newVolume);
            }
          }, { passive: false });

          player.addEventListener('timeupdate', () => {
            if (!currentPlayingVideoId) return;
            const currentTime = player.currentTime;

            if (localDb.settings && localDb.settings.sponsorBlockEnabled === true) {
              checkAndSkipSponsor(currentTime, player);
            }

            // Periyodik (her 30sn) YouTube izleme süresi senkronizasyonu
            autoSyncWatchtimeHelper(currentPlayingVideoId, currentTime, false);

            const duration = player.duration || 0;
            if (currentTime > 2 && duration > 10 && (duration - currentTime) > 5) {
              const resumeData = JSON.parse(localStorage.getItem('haytool_playback_resume') || '{}');
              resumeData[currentPlayingVideoId] = currentTime;
              localStorage.setItem('haytool_playback_resume', JSON.stringify(resumeData));
            } else if (duration > 0 && (duration - currentTime) <= 5) {
              const resumeData = JSON.parse(localStorage.getItem('haytool_playback_resume') || '{}');
              delete resumeData[currentPlayingVideoId];
              localStorage.setItem('haytool_playback_resume', JSON.stringify(resumeData));
            }
          });

          player.addEventListener('canplay', () => {
            if (!seekedForCurrentVideo && currentPlayingVideoId) {
              const targetTime = (startSeconds !== null) ? startSeconds : (JSON.parse(localStorage.getItem('haytool_playback_resume') || '{}')[currentPlayingVideoId] || 0);
              if (targetTime > 0) {
                player.currentTime = targetTime;
              }
              seekedForCurrentVideo = true;
            }
          });

          player.addEventListener('play', () => sendPlayerActivity(true));
          player.addEventListener('pause', () => {
            sendPlayerActivity(false);
            autoSyncWatchtimeHelper(currentPlayingVideoId, player.currentTime, true);
          });
          player.addEventListener('ended', () => {
            sendPlayerActivity(false);
            autoSyncWatchtimeHelper(currentPlayingVideoId, player.currentTime, true);
          });

          player.load();
          if (forcePaused === true) {
            player.pause();
          } else if (forcePaused === false) {
            player.play().catch(err => console.warn(err));
          } else {
            player.play().catch(err => {
              console.warn('Otomatik oynatma engellendi:', err);
            });
          }

          player.addEventListener('ended', () => {
            const isAutoplayEnabled = localStorage.getItem('inline-autoplay-enabled') === 'true';
            if (isAutoplayEnabled) {
              playNextVideoInPlaylist();
            }
          });
        }
      }
    }
  }
  } catch (err) {
    console.error('[playVideoEmbedded] HATA:', err);
    console.error('[playVideoEmbedded] Stack:', err.stack);
  }
};

// Türkçe Açıklama: İndirilenler sekmesindeki yerleşik video oynatıcıyı kapatır, çalmakta olan videoyu durdurup kaynağını temizler.
/**
 * Yerleşik video oynatıcıyı kapatır ve çalmakta olan videoyu durdurur.
 * 
 * @returns {void}
 */
export const closeInlinePlayer = window.closeInlinePlayer = function() {
  const inlineContainer = document.getElementById('downloaded-inline-player-container');
  const listContainer = document.getElementById('downloaded-list-container');
  if (inlineContainer && inlineContainer.classList.contains('hidden')) {
    return;
  }

  // Otomatik izleme süresi senkronizasyonu
  if (currentPlayingVideoId && localDb?.settings?.autoSyncWatchtime !== false) {
    let lastTime = 0;
    if (videoPlayerInstance && typeof videoPlayerInstance.currentTime === 'number') {
      lastTime = videoPlayerInstance.currentTime;
    } else {
      const v = document.querySelector('#inline-player-container video, #inline-player-body video');
      if (v) lastTime = v.currentTime || 0;
    }
    if (lastTime > 5) {
      fetch(`/api/video/${currentPlayingVideoId}/sync-watchtime`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentTime: lastTime, silent: true })
      }).catch(() => {});
    }
  }

  if (inlineContainer) inlineContainer.classList.add('hidden');
  if (listContainer) listContainer.classList.remove('hidden');

  cleanupAllPlayers();

  currentPlayingVideoId = null;
  setCurrentPlayingVideoId(null);
  seekedForCurrentVideo = false;
};

/**
 * Yerleşik oynatıcı çalma listesi sidebar sıralama butonlarının aktiflik ve yön durumlarını günceller.
 */
export function updateSidebarSortButtons() {
  const btnDate = document.getElementById('inline-btn-sort-date');
  const btnSize = document.getElementById('inline-btn-sort-size');
  const btnUser = document.getElementById('inline-btn-sort-user');
  const txtDate = document.getElementById('inline-btn-sort-date-text');
  const txtSize = document.getElementById('inline-btn-sort-size-text');

  if (!btnDate || !btnSize) return;

  const isEn = localDb.settings?.lang === 'en';

  btnDate.classList.remove('active');
  btnSize.classList.remove('active');
  if (btnUser) btnUser.classList.remove('active');

  const curSort = window.downloadedSortVal || localStorage.getItem('downloaded-sort-val') || 'date-desc';

  if (curSort === 'user') {
    if (btnUser) btnUser.classList.add('active');
    if (txtDate) txtDate.textContent = isEn ? 'Date ▼' : 'Tarih ▼';
    if (txtSize) txtSize.textContent = isEn ? 'Size ▼' : 'Boyut ▼';
  } else if (curSort.startsWith('date-')) {
    btnDate.classList.add('active');
    if (curSort === 'date-asc') {
      if (txtDate) txtDate.textContent = isEn ? 'Date ▲' : 'Tarih ▲';
    } else {
      if (txtDate) txtDate.textContent = isEn ? 'Date ▼' : 'Tarih ▼';
    }
    if (txtSize) txtSize.textContent = isEn ? 'Size ▼' : 'Boyut ▼';
  } else if (curSort.startsWith('size-')) {
    btnSize.classList.add('active');
    if (curSort === 'size-asc') {
      if (txtSize) txtSize.textContent = isEn ? 'Size ▲' : 'Boyut ▲';
    } else {
      if (txtSize) txtSize.textContent = isEn ? 'Size ▼' : 'Boyut ▼';
    }
    if (txtDate) txtDate.textContent = isEn ? 'Date ▼' : 'Tarih ▼';
  }
}

// Türkçe Açıklama: Yerleşik oynatıcının sağ tarafındaki dikey oynatma listesinde indirilmiş diğer videoları kartlar halinde listeler.
/**
 * Yerleşik oynatıcı için çalma listesi sidebar içeriğini render eder.
 * 
 * @param {string} currentVideoId Aktif oynatılan video ID'si
 * @returns {void}
 */
export function renderDownloadedPlaylist(currentVideoId) {
  const playlistGrid = document.getElementById('downloaded-playlist-grid');
  if (!playlistGrid) return;
  playlistGrid.innerHTML = '';

  const titleEl = document.getElementById('inline-sidebar-title');
  if (titleEl) {
    titleEl.textContent = currentLang === 'en' ? 'Downloads' : 'İndirilenler';
  }

  // Update sorting buttons state
  if (typeof updateSidebarSortButtons === 'function') {
    updateSidebarSortButtons();
  }

  // Update Shorts label text if exists
  const labelShortsText = document.getElementById('inline-label-shorts-text');
  if (labelShortsText) {
    labelShortsText.textContent = currentLang === 'en' ? 'Shorts' : 'Shorts';
  }

  let filteredDownloaded = localDb.history.filter(item => item.status === 'completed');
  const dlFilterChan = window.downloadedFilterChannel || 'all';
  if (dlFilterChan !== 'all') {
    if (dlFilterChan.startsWith('category:')) {
      const catId = parseInt(dlFilterChan.split(':')[1], 10);
      const channelIdsInCat = (localDb.channels || []).filter(c => (c.categoryIds || [c.categoryId || 1]).includes(catId)).map(c => c.id);
      const channelIdsInCatSet = new Set(channelIdsInCat);
      filteredDownloaded = filteredDownloaded.filter(item => channelIdsInCatSet.has(item.channelId));
    } else {
      filteredDownloaded = filteredDownloaded.filter(item => item.channelId === dlFilterChan);
    }
  }
  const showShorts = localDb.settings?.showShorts !== false;
  if (!showShorts) {
    filteredDownloaded = filteredDownloaded.filter(item => !isShortVideo(item.duration, item.title, item.channelId));
  }
  
  const sortVal = window.downloadedSortVal || localStorage.getItem('downloaded-sort-val') || 'date-desc';
  filteredDownloaded.sort((a, b) => {
    if (sortVal === 'user') {
      const customOrder = JSON.parse(localStorage.getItem('downloaded-user-order') || '[]');
      let indexA = customOrder.indexOf(a.id);
      let indexB = customOrder.indexOf(b.id);
      
      if (indexA === -1 && indexB === -1) {
        const dateA = new Date(a.downloadedAt || a.publishedAt || 0).getTime();
        const dateB = new Date(b.downloadedAt || b.publishedAt || 0).getTime();
        return dateB - dateA;
      }
      if (indexA === -1) return -1;
      if (indexB === -1) return 1;
      
      return indexA - indexB;
    } else if (sortVal.startsWith('size-')) {
      const sizeA = parseSizeToBytes(a.fileSize);
      const sizeB = parseSizeToBytes(b.fileSize);
      return sortVal === 'size-desc' ? sizeB - sizeA : sizeA - sizeB;
    } else {
      const dateA = new Date(a.downloadedAt || a.publishedAt || 0).getTime();
      const dateB = new Date(b.downloadedAt || b.publishedAt || 0).getTime();
      return sortVal === 'date-asc' ? dateA - dateB : dateB - dateA;
    }
  });

  if (filteredDownloaded.length === 0) {
    playlistGrid.innerHTML = `<p class="text-muted" style="font-size:0.8rem; padding: 10px;">${currentLang === 'en' ? 'No other videos found' : 'Başka video bulunamadı'}</p>`;
    return;
  }

  filteredDownloaded.forEach(item => {
    const isCurrent = item.id === currentVideoId;
    const itemEl = document.createElement('div');
    itemEl.className = `playlist-item${isCurrent ? ' active' : ''}`;
    itemEl.setAttribute('data-id', item.id);
    if (sortVal === 'user') {
      itemEl.setAttribute('draggable', 'true');
    }
    
    itemEl.onclick = () => {
      if (!isCurrent) {
        playVideoEmbedded(item.id);
      }
    };

    const durationHtml = item.duration ? `<span class="playlist-item-duration">${item.duration}</span>` : '';
    const playlistQualityHtml = item.actualQuality ? `<span class="playlist-item-quality quality-${item.actualQuality.toLowerCase()}">${item.actualQuality}</span>` : '';

    itemEl.innerHTML = `
      <div class="playlist-item-thumbnail-wrapper">
        <img class="playlist-item-thumbnail" src="/api/video/${item.id}/thumbnail" alt="${escapeHtml(item.title)}" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22100%22 height=%2256%22><rect width=%22100%22 height=%2256%22 fill=%22%2316142a%22/><text x=%2250%25%22 y=%2250%25%22 dominant-baseline=%22middle%22 text-anchor=%22middle%22 fill=%22%2394a3b8%22 font-family=%22sans-serif%22 font-size=%228%22>No Image</text></svg>'">
        ${playlistQualityHtml}
        ${durationHtml}
      </div>
      <div class="playlist-item-details">
        <h5 class="playlist-item-title" title="${escapeHtml(item.title)}">${escapeHtml(item.title)}</h5>
        <div class="playlist-item-channel" style="font-size:0.75rem; color:var(--text-muted); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${escapeHtml(item.channelName || '')} • ${item.fileSize || '-- MB'} • ${formatDate(item.publishedAt || item.downloadedAt)}">
          ${escapeHtml(item.channelName || '')} • ${item.fileSize || '-- MB'} • ${formatDate(item.publishedAt || item.downloadedAt)}
        </div>
      </div>
    `;
    playlistGrid.appendChild(itemEl);
  });
}

// Türkçe Açıklama: İndirilen video dosyasını işletim sisteminin (Windows) varsayılan medya oynatıcısında (VLC, Windows Media Player vb.) açar.
/**
 * Videoyu işletim sisteminin varsayılan medya oynatıcısında (VLC, KMPlayer vb.) çalıştırır.
 * 
 * @param {string} videoId Oynatılacak video ID'si
 */
export const playVideoSystem = window.playVideoSystem = async function(videoId) {
  try {
    showToast('Video oynatıcıda açılıyor...', 'info');
    const res = await fetch('/api/play-video', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ videoId })
    });
    const data = await res.json();
    if (!data.success) {
      showToast(data.error || 'Video oynatılamadı. Dosya taşınmış veya silinmiş olabilir.', 'error');
    }
  } catch (err) {
    showToast('Sunucu ile iletişim hatası.', 'error');
  }
};

// Türkçe Açıklama: Fare video kapağı üzerine geldiğinde yüksek çözünürlüklü (HQ) 7 farklı kapak karesi arasında 400ms aralıklarla akıcı geçiş yapar.
export const handleThumbMouseEnter = window.handleThumbMouseEnter = function(wrapperEl) {
  if (!wrapperEl || (window.dbSettings && window.dbSettings.enableAltThumbnailsHover === false)) return;
  const videoId = wrapperEl.getAttribute('data-video-id');
  if (!videoId) return;

  const imgEl = wrapperEl.querySelector('.video-thumbnail');
  if (!imgEl) return;

  if (!wrapperEl.dataset.origSrc) {
    wrapperEl.dataset.origSrc = imgEl.src;
  }

  // 4 Yüksek Çözünürlüklü (HQ/HD) kapak ve frame döngü listesi
  // Sıralama: Orijinal Kapak -> HQ Kare 1 -> HQ Kare 2 -> HQ Kare 3 -> Tekrar Başa (Orijinal Kapak)
  const altUrls = [
    wrapperEl.dataset.origSrc,
    `https://img.youtube.com/vi/${videoId}/hq1.jpg`,
    `https://img.youtube.com/vi/${videoId}/hq2.jpg`,
    `https://img.youtube.com/vi/${videoId}/hq3.jpg`
  ];

  // HD görselleri önceden yükle (Belirli bir kare açılmazsa otomatik orijinal resme düşer)
  altUrls.forEach((url, idx) => {
    if (idx === 0) return;
    const pImg = new Image();
    pImg.onerror = () => {
      altUrls[idx] = wrapperEl.dataset.origSrc;
    };
    pImg.src = url;
  });

  let currentIndex = 0;
  if (wrapperEl._thumbTimer) clearInterval(wrapperEl._thumbTimer);

  wrapperEl._thumbTimer = setInterval(() => {
    currentIndex = (currentIndex + 1) % altUrls.length;
    imgEl.src = altUrls[currentIndex];
  }, 666);
};

export const handleThumbMouseLeave = window.handleThumbMouseLeave = function(wrapperEl) {
  if (!wrapperEl) return;
  if (wrapperEl._thumbTimer) {
    clearInterval(wrapperEl._thumbTimer);
    wrapperEl._thumbTimer = null;
  }
  const imgEl = wrapperEl.querySelector('.video-thumbnail');
  if (imgEl && wrapperEl.dataset.origSrc) {
    imgEl.src = wrapperEl.dataset.origSrc;
    imgEl.style.opacity = '1';
  }
};

// Türkçe Açıklama: Arayüzdeki gömülü Plyr video oynatıcı modalını kapatır ve çalmakta olan videoyu durdurup kaynağını temizler.
/**
 * Gömülü video oynatıcı modalını kapatır ve çalmakta olan videoyu durdurur.
 */
export const closePlayerModal = window.closePlayerModal = function() {
  const modal = document.getElementById('player-modal');

  // Otomatik izleme süresi senkronizasyonu
  if (currentPlayingVideoId) {
    let lastTime = 0;
    if (videoPlayerInstance && typeof videoPlayerInstance.currentTime === 'number') {
      lastTime = videoPlayerInstance.currentTime;
    } else {
      const v = document.querySelector('#player-modal video, #embedded-video-player');
      if (v) lastTime = v.currentTime || 0;
    }
    autoSyncWatchtimeHelper(currentPlayingVideoId, lastTime, true);
  }

  if (modal) {
    modal.classList.add('hidden');
    modal.classList.remove('is-short-player');
    modal.classList.remove('minimized');
    
    // Reset position & dimensions to default bottom-right
    const modalContent = modal.querySelector('.player-modal-content');
    const modalBody = modal.querySelector('.player-modal-body');
    if (modalContent) {
      modalContent.style.left = '';
      modalContent.style.top = '';
      modalContent.style.bottom = '';
      modalContent.style.right = '';
      modalContent.style.width = '';
      modalContent.style.height = '';
    }
    if (modalBody) {
      modalBody.style.height = '';
      modalBody.style.aspectRatio = '';
    }
  }

  // Disconnect ResizeObserver
  if (playerResizeObserver) {
    playerResizeObserver.disconnect();
    playerResizeObserver = null;
  }
  cleanupAllPlayers();
  currentPlayingVideoId = null;
  setCurrentPlayingVideoId(null);
  seekedForCurrentVideo = false;
  
  const minBtn = document.getElementById('minimize-player-modal-btn');
  if (minBtn) {
    const icon = minBtn.querySelector('i') || minBtn.querySelector('[data-lucide]');
    if (icon) {
      icon.setAttribute('data-lucide', 'minus');
    }
  }
  try {
    if (typeof lucide !== 'undefined' && lucide.createIcons) {
      lucide.createIcons();
    }
  } catch (e) {}
};

// Türkçe Açıklama: Belirtilen video ID'sine ait YouTube izleme sayfasını tarayıcıda yeni bir sekmede açar.
/**
 * Belirtilen videonun YouTube sayfasını yeni tarayıcı sekmesinde açar.
 * 
 * @param {string} videoId Açılacak video ID'si
 */
export const openYouTube = window.openYouTube = async function(videoId) {
  try {
    await fetch('/api/open-youtube', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ videoId })
    });
  } catch (err) {
    window.open(`https://www.youtube.com/watch?v=${videoId}`, '_blank');
  }
};

// Türkçe Açıklama: Seçilen videoyu geçmişten veya diskteki dosyasından silmek üzere kullanıcıya onay modalı (penceresi) gösterir.
/**
 * Geçmişten veya diskten video silmek için onay modalını açar.
 * 
 * @param {string} id Silinecek video ID'si
 */


// Türkçe Açıklama: Yorumlar panelini açar/kapatır ve kapatıldığında veya açıldığında yorumları sunucudan çeker.
export const toggleCommentsPanel = window.toggleCommentsPanel = async function() {
  const container = document.getElementById('inline-player-comments-container');
  if (!container) return;
  
  const isHidden = container.classList.contains('hidden');
  const btn = document.getElementById('inline-btn-comments');
  const isEn = localDb.settings?.lang === 'en';
  
  if (isHidden) {
    container.classList.remove('hidden');
    if (btn) {
      btn.classList.add('active');
      btn.title = isEn ? 'Hide Comments' : 'Yorumları Gizle';
    }
    await loadComments(currentPlayingVideoId);
  } else {
    container.classList.add('hidden');
    if (btn) {
      btn.classList.remove('active');
      btn.title = isEn ? 'Show Comments' : 'Yorumları Göster';
    }
  }
};


/**
 * Türkçe Açıklama: Aktif video oynatıcının süresini belirtilen saniyeye atlatır (Plyr, Artplayer, HTML5 uyumlu).
 * 
 * @param {number} seconds - Atlanacak saniye değeri
 * @returns {void}
 */
export const seekVideoToSeconds = window.seekVideoToSeconds = function(seconds) {
  const pType = (localDb.settings && localDb.settings.playerType) || 'plyr';
  const player = document.getElementById('embedded-video-player');
  
  if (pType === 'artplayer' && videoPlayerInstance) {
    videoPlayerInstance.currentTime = seconds;
  } else if (pType === 'html5' && player) {
    player.currentTime = seconds;
  } else if (videoPlayerInstance) {
    videoPlayerInstance.currentTime = seconds;
  } else if (player) {
    player.currentTime = seconds;
  }
};


/**
 * Türkçe Açıklama: Video açıklama panelini açar/kapatır ve yorum panelini gizler.
 * 
 * @returns {void}
 */
export const toggleDescriptionPanel = window.toggleDescriptionPanel = function() {
  const container = document.getElementById('inline-player-description-container');
  if (!container) return;

  const isHidden = container.classList.contains('hidden');
  const btn = document.getElementById('inline-btn-description');
  const isEn = localDb.settings?.lang === 'en';
  
  if (isHidden) {
    container.classList.remove('hidden');
    if (btn) {
      btn.classList.add('active');
      btn.title = isEn ? 'Hide Description' : 'Açıklamayı Gizle';
    }
  } else {
    container.classList.add('hidden');
    if (btn) {
      btn.classList.remove('active');
      btn.title = isEn ? 'Show Description' : 'Açıklamayı Göster';
    }
  }
};


// IPTV Sayfalama durumu
let iptvCurrentPage = 1;
let iptvTotalPages = 1;
let iptvTotalCount = 0;
let iptvIsAppending = false;

export async function loadIptvChannels(append = false) {

  if (!append) {
    iptvIsLoading = true;
    iptvCurrentPage = 1;
    const listContainer = document.getElementById('iptv-channel-list');
    if (listContainer) listContainer.innerHTML = '';
  } else {
    iptvIsAppending = true;
  }

  const loadingIndicator = document.getElementById('iptv-list-loading');
  if (loadingIndicator) loadingIndicator.classList.remove('hidden');

  try {
    const hasFilter = (iptvSelectedCountry || iptvSearchQuery || iptvSelectedCategory);
    // Filtre varsa tum listeyi (limit=0), yoksa sayfalı (200)
    const limitParam = hasFilter ? 0 : 200;
    const url = `/api/iptv/channels?limit=${limitParam}&page=${iptvCurrentPage}&search=${encodeURIComponent(iptvSearchQuery)}&country=${encodeURIComponent(iptvSelectedCountry)}&category=${encodeURIComponent(iptvSelectedCategory)}`;
    const res = await fetch(url);
    const data = await res.json();

    if (loadingIndicator) loadingIndicator.classList.add('hidden');

    iptvTotalPages = data.pagination?.totalPages || 1;
    iptvTotalCount = data.pagination?.totalCount || 0;

    renderIptvChannels(data.channels, append);
    populateIptvFilters(data.filters);
    updateLoadMoreBtn();
  } catch (err) {
    console.error('Error loading IPTV channels:', err);
    showToast(currentLang === 'en' ? 'Failed to load IPTV channels.' : 'IPTV kanalları yüklenemedi.', 'error');
    if (loadingIndicator) loadingIndicator.classList.add('hidden');
  } finally {
    iptvIsLoading = false;
    iptvIsAppending = false;
  }
}

export function updateLoadMoreBtn() {
  const btn = document.getElementById('iptv-load-more-btn');
  if (!btn) return;
  const hasFilter = (iptvSelectedCountry || iptvSearchQuery || iptvSelectedCategory);
  if (hasFilter || iptvCurrentPage >= iptvTotalPages) {
    btn.classList.add('hidden');
  } else {
    btn.classList.remove('hidden');
    const isEn = currentLang === 'en';
    const shown = Math.min(iptvCurrentPage * 200, iptvTotalCount);
    btn.textContent = `${isEn ? 'Load More' : 'Daha Fazla'} (${shown} / ${iptvTotalCount})`;
  }
}

// Render comments list with sorting
export function renderCommentsList() {
  const list = document.getElementById('comments-list');
  if (!list) return;
  list.innerHTML = '';
  
  const sortVal = document.getElementById('comments-sort')?.value || 'default';
  let sorted = [...loadedCommentsList];
  
  if (sortVal === 'likes-desc') {
    sorted.sort((a, b) => parseLikes(b.likeCount) - parseLikes(a.likeCount));
  } else if (sortVal === 'date-new') {
    sorted.sort((a, b) => parseRelativeTime(a.publishedTime) - parseRelativeTime(b.publishedTime));
  } else if (sortVal === 'date-old') {
    sorted.sort((a, b) => parseRelativeTime(b.publishedTime) - parseRelativeTime(a.publishedTime));
  }
  
  sorted.forEach(c => {
    const item = document.createElement('div');
    item.className = 'comment-item';
    
    const avatarUrl = c.authorAvatar || 'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2240%22 height=%2240%22><circle cx=%2220%22 cy=%2220%22 r=%2220%22 fill=%22%2316142a%22/></svg>';
    
    item.innerHTML = `
      <img class="comment-avatar" src="${avatarUrl}" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2240%22 height=%2240%22><circle cx=%2220%22 cy=%2220%22 r=%2220%22 fill=%22%2316142a%22/></svg>';" />
      <div class="comment-content">
        <div class="comment-meta">
          <span class="comment-author">${escapeHtml(c.author)}</span>
          <span class="comment-time">${escapeHtml(c.publishedTime)}</span>
        </div>
        <div class="comment-text">${escapeHtml(c.text)}</div>
        <div class="comment-likes-row">
          <i data-lucide="thumbs-up"></i>
          <span>${escapeHtml(c.likeCount)}</span>
        </div>
      </div>
    `;
    list.appendChild(item);
  });
  lucide.createIcons();
}

export const sortAndRenderComments = window.sortAndRenderComments = function() {
  renderCommentsList();
};

export async function loadComments(videoId) {
  const list = document.getElementById('comments-list');
  const loading = document.getElementById('comments-loading');
  const empty = document.getElementById('comments-list-empty');
  const moreContainer = document.getElementById('comments-more-container');
  
  if (!list || !loading || !empty) return;
  
  list.innerHTML = '';
  loading.style.display = 'block';
  empty.style.display = 'none';
  if (moreContainer) moreContainer.style.display = 'none';
  nextCommentsToken = null;
  loadedCommentsList = [];
  
  // Translation
  const commentsSort = document.getElementById('comments-sort');
  if (commentsSort) {
    const isEn = localDb.settings?.lang === 'en';
    commentsSort.options[0].text = isEn ? 'Default' : 'Varsayılan';
    commentsSort.options[1].text = isEn ? 'Likes (High to Low)' : 'Beğeni (Çoktan Aza)';
    commentsSort.options[2].text = isEn ? 'Newest' : 'En Yeni';
    commentsSort.options[3].text = isEn ? 'Oldest' : 'En Eski';
  }

  try {
    const res = await fetch(`/api/video/${videoId}/comments`);
    const data = await res.json();
    loading.style.display = 'none';
    
    if (data.success && data.comments && data.comments.length > 0) {
      loadedCommentsList = data.comments;
      renderCommentsList();
      if (data.nextPageToken) {
        nextCommentsToken = data.nextPageToken;
        if (moreContainer) moreContainer.style.display = 'block';
      }
    } else {
      empty.style.display = 'block';
    }
  } catch (err) {
    loading.style.display = 'none';
    empty.style.display = 'block';
    console.error("Error loading comments:", err);
  }
}

export const loadMoreComments = window.loadMoreComments = async function() {
  if (!currentPlayingVideoId || !nextCommentsToken) return;
  
  const moreBtn = document.getElementById('btn-load-more-comments');
  const moreText = document.getElementById('btn-load-more-comments-text');
  const isEn = localDb.settings?.lang === 'en';
  
  if (moreBtn) moreBtn.disabled = true;
  if (moreText) {
    moreText.textContent = isEn ? 'Loading...' : 'Yükleniyor...';
  }
  
  try {
    const res = await fetch(`/api/video/${currentPlayingVideoId}/comments?token=${encodeURIComponent(nextCommentsToken)}`);
    const data = await res.json();
    
    if (data.success && data.comments && data.comments.length > 0) {
      loadedCommentsList = loadedCommentsList.concat(data.comments);
      renderCommentsList();
      if (data.nextPageToken) {
        nextCommentsToken = data.nextPageToken;
        if (moreBtn) moreBtn.disabled = false;
        if (moreText) {
          moreText.textContent = isEn ? 'Show More' : 'Daha Fazla Göster';
        }
      } else {
        nextCommentsToken = null;
        const moreContainer = document.getElementById('comments-more-container');
        if (moreContainer) moreContainer.style.display = 'none';
      }
    } else {
      nextCommentsToken = null;
      const moreContainer = document.getElementById('comments-more-container');
      if (moreContainer) moreContainer.style.display = 'none';
    }
  } catch (err) {
    console.error("Error loading more comments:", err);
    if (moreBtn) moreBtn.disabled = false;
    if (moreText) {
      moreText.textContent = isEn ? 'Show More' : 'Daha Fazla Göster';
    }
  }
};

try { if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons(); } catch(e) {}



// ─── Global / Window Bağlantıları ───
if (typeof window !== 'undefined') {
  window.sendPlayerActivity = typeof sendPlayerActivity !== 'undefined' ? sendPlayerActivity : window.sendPlayerActivity;
  window.cleanupAllPlayers = typeof cleanupAllPlayers !== 'undefined' ? cleanupAllPlayers : window.cleanupAllPlayers;
  window.playVideoEmbedded = typeof playVideoEmbedded !== 'undefined' ? playVideoEmbedded : window.playVideoEmbedded;
  window.closeInlinePlayer = typeof closeInlinePlayer !== 'undefined' ? closeInlinePlayer : window.closeInlinePlayer;
  window.togglePlayerMinimize = typeof togglePlayerMinimize !== 'undefined' ? togglePlayerMinimize : window.togglePlayerMinimize;
  window.closePlayerModal = typeof closePlayerModal !== 'undefined' ? closePlayerModal : window.closePlayerModal;
  window.toggleCommentsPanel = typeof toggleCommentsPanel !== 'undefined' ? toggleCommentsPanel : window.toggleCommentsPanel;
  window.toggleDescriptionPanel = typeof toggleDescriptionPanel !== 'undefined' ? toggleDescriptionPanel : window.toggleDescriptionPanel;
  window.loadMoreComments = typeof loadMoreComments !== 'undefined' ? loadMoreComments : window.loadMoreComments;
  window.sortAndRenderComments = typeof sortAndRenderComments !== 'undefined' ? sortAndRenderComments : window.sortAndRenderComments;
  window.fetchSponsorSegments = typeof fetchSponsorSegments !== 'undefined' ? fetchSponsorSegments : window.fetchSponsorSegments;
  window.updateSponsorBlockStatusUI = typeof updateSponsorBlockStatusUI !== 'undefined' ? updateSponsorBlockStatusUI : window.updateSponsorBlockStatusUI;
  window.renderDownloadedPlaylist = typeof renderDownloadedPlaylist !== 'undefined' ? renderDownloadedPlaylist : window.renderDownloadedPlaylist;
  window.openYouTube = typeof openYouTube !== 'undefined' ? openYouTube : window.openYouTube;
  window.makeElementDraggable = typeof makeElementDraggable !== 'undefined' ? makeElementDraggable : window.makeElementDraggable;
  window.makeElementResizable = typeof makeElementResizable !== 'undefined' ? makeElementResizable : window.makeElementResizable;
  window.showPlayerTransientOverlay = typeof showPlayerTransientOverlay !== 'undefined' ? showPlayerTransientOverlay : window.showPlayerTransientOverlay;
  window.seekVideoToSeconds = typeof seekVideoToSeconds !== 'undefined' ? seekVideoToSeconds : window.seekVideoToSeconds;
}


if (typeof window !== 'undefined') {
  window.currentPlayingVideoId = currentPlayingVideoId;
  window.videoPlayerInstance = videoPlayerInstance;
}
