/**
 * HaYTooL YouTube Downloader - Video Yorumları Modülü
 * public/modules/comments.js
 * 
 * Sorumluluklar:
 *   - Video altı yorumları getirme (/api/video/:id/comments)
 *   - Yorumları sıralama (beğeni, yeni, eski, varsayılan)
 *   - Daha fazla yorum yükleme (sayfalama / pagination)
 *   - Yorum paneli açma / kapama kontrolleri
 * 
 * Yapımcı: HaYTo
 * İletişim: korazhayto@gmail.com
 */

import { escapeHtml, parseLikes, parseRelativeTime } from '../utils/helpers.js';

let nextCommentsToken = null;
let loadedCommentsList = [];

/**
 * Yorumlar listesini aktif sıralama kriterine göre ekrana çizer.
 */
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

  if (typeof lucide !== 'undefined' && lucide.createIcons) {
    lucide.createIcons();
  }
}

/**
 * Belirtilen videonun ilk sayfa yorumlarını API'den çeker.
 * @param {string} videoId 
 */
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
  
  // Sıralama seçenekleri çevirisi
  const commentsSort = document.getElementById('comments-sort');
  if (commentsSort) {
    const isEn = window.localDb?.settings?.lang === 'en';
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

/**
 * Bir sonraki sayfa token'ını kullanarak daha fazla yorum çeker ve listeye ekler.
 */
export async function loadMoreComments() {
  const videoId = window.currentPlayingVideoId;
  if (!videoId || !nextCommentsToken) return;
  
  const moreBtn = document.getElementById('btn-load-more-comments');
  const moreText = document.getElementById('btn-load-more-comments-text');
  const isEn = window.localDb?.settings?.lang === 'en';
  
  if (moreBtn) moreBtn.disabled = true;
  if (moreText) {
    moreText.textContent = isEn ? 'Loading...' : 'Yükleniyor...';
  }
  
  try {
    const res = await fetch(`/api/video/${videoId}/comments?token=${encodeURIComponent(nextCommentsToken)}`);
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
}

/**
 * Yorum panelini açar/kapatır ve kapatıldığında veya açıldığında yorumları sunucudan çeker.
 */
export async function toggleCommentsPanel() {
  const container = document.getElementById('inline-player-comments-container');
  if (!container) return;
  
  const isHidden = container.classList.contains('hidden');
  const btn = document.getElementById('inline-btn-comments');
  const isEn = window.localDb?.settings?.lang === 'en';
  
  if (isHidden) {
    container.classList.remove('hidden');
    if (btn) {
      btn.classList.add('active');
      btn.title = isEn ? 'Hide Comments' : 'Yorumları Gizle';
    }
    await loadComments(window.currentPlayingVideoId);
  } else {
    container.classList.add('hidden');
    if (btn) {
      btn.classList.remove('active');
      btn.title = isEn ? 'Show Comments' : 'Yorumları Göster';
    }
  }
}

// Global window erişim köprüleri (HTML onclick nitelikleri için)
window.renderCommentsList = renderCommentsList;
window.sortAndRenderComments = renderCommentsList;
window.loadComments = loadComments;
window.loadMoreComments = loadMoreComments;
window.toggleCommentsPanel = toggleCommentsPanel;
