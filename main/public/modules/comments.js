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
import { showToast } from '../components/toast.js';

let nextCommentsToken = null;
let loadedCommentsList = [];
let cachedTotalComments = null;
let cachedCommentsSummary = '';
let sidebarResizeObserver = null;

/**
 * Yorumlar panelinin yüksekliğini içeriğe göre doğal uzatır; 
 * kullanıcının fareyle rahatça tüm sayfayı kaydırabilmesi için iç kaydırma sınırını kaldırır.
 */
export function syncCommentsHeightWithSidebar() {
  const container = document.getElementById('inline-player-comments-container');
  if (!container || container.classList.contains('hidden')) return;

  // Kullanıcı tercihi: Yorum ne kadar aşağıya iniyorsa alan da o kadar aşağı uzar
  container.style.height = 'auto';
  container.style.maxHeight = 'none';
  container.style.overflow = 'visible';

  const list = document.getElementById('comments-list');
  if (list) {
    list.style.height = 'auto';
    list.style.maxHeight = 'none';
    list.style.overflow = 'visible';
  }
}

/**
 * Sidebar değişken yüksekliğini (video sayısı, filtreler, pencere boyutu) sürekli izler.
 */
export function initSidebarResizeObserver() {
  if (typeof ResizeObserver === 'undefined') return;
  if (!sidebarResizeObserver) {
    const sidebar = document.querySelector('.inline-player-sidebar');
    if (sidebar) {
      sidebarResizeObserver = new ResizeObserver(() => {
        syncCommentsHeightWithSidebar();
      });
      sidebarResizeObserver.observe(sidebar);
    }
  }
}

/**
 * Yorum sayısı rozetini (#comments-count-badge) günceller.
 */
export function updateCommentsCountBadge(count) {
  const badge = document.getElementById('comments-count-badge');
  if (!badge) return;
  if (count !== undefined && count !== null && count !== '') {
    cachedTotalComments = count;
    badge.textContent = count;
    badge.style.display = 'inline-flex';
  } else if (loadedCommentsList.length > 0) {
    badge.textContent = loadedCommentsList.length;
    badge.style.display = 'inline-flex';
  } else {
    badge.style.display = 'none';
  }
}

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
    const likesHtml = (c.likeCount && c.likeCount !== '0')
      ? `<div class="comment-likes-row" title="${escapeHtml(c.likeCount)} Beğeni">
          <i data-lucide="thumbs-up"></i>
          <span>${escapeHtml(c.likeCount)}</span>
        </div>`
      : '';
    
    item.innerHTML = `
      <img class="comment-avatar" src="${avatarUrl}" alt="${escapeHtml(c.author)}" loading="lazy" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2240%22 height=%2240%22><circle cx=%2220%22 cy=%2220%22 r=%2220%22 fill=%22%2316142a%22/></svg>';" />
      <div class="comment-content">
        <div class="comment-meta">
          <span class="comment-author">${escapeHtml(c.author)}</span>
          <span class="comment-time">${escapeHtml(c.publishedTime)}</span>
        </div>
        <div class="comment-text">${escapeHtml(c.text)}</div>
        ${likesHtml}
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
  const summaryCard = document.getElementById('comments-ai-summary-card');
  if (summaryCard) summaryCard.style.display = 'none';
  cachedCommentsSummary = '';
  nextCommentsToken = null;
  loadedCommentsList = [];
  cachedTotalComments = null;
  updateCommentsCountBadge(null);
  initCommentsPreferences();
  
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
      updateCommentsCountBadge(data.totalCount || loadedCommentsList.length);
      renderCommentsList();
      nextCommentsToken = data.nextPageToken || null;
      
      if (moreContainer) {
        moreContainer.style.display = 'flex';
        const paginationGroup = document.getElementById('comments-pagination-group');
        if (paginationGroup) {
          paginationGroup.style.display = nextCommentsToken ? 'inline-flex' : 'none';
        }
      }
      syncCommentsHeightWithSidebar();
    } else {
      updateCommentsCountBadge(null);
      empty.style.display = 'block';
    }
  } catch (err) {
    loading.style.display = 'none';
    empty.style.display = 'block';
    updateCommentsCountBadge(null);
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
  const paginationGroup = document.getElementById('comments-pagination-group');
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
      if (!cachedTotalComments) {
        updateCommentsCountBadge(loadedCommentsList.length);
      }
      renderCommentsList();
      if (data.nextPageToken) {
        nextCommentsToken = data.nextPageToken;
        if (moreBtn) moreBtn.disabled = false;
        if (moreText) {
          moreText.textContent = isEn ? 'Show More' : 'Daha Fazla Göster';
        }
        if (paginationGroup) paginationGroup.style.display = 'inline-flex';
      } else {
        nextCommentsToken = null;
        if (paginationGroup) paginationGroup.style.display = 'none';
      }
    } else {
      nextCommentsToken = null;
      if (paginationGroup) paginationGroup.style.display = 'none';
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
 * Mevcut tüm yorum sayfalarını sırayla otomatik çeker ve tek seferde gösterir.
 */
export async function loadAllComments() {
  const videoId = window.currentPlayingVideoId;
  if (!videoId || !nextCommentsToken) return;

  const allBtn = document.getElementById('btn-load-all-comments');
  const allText = document.getElementById('btn-load-all-comments-text');
  const moreBtn = document.getElementById('btn-load-more-comments');
  const paginationGroup = document.getElementById('comments-pagination-group');
  const isEn = window.localDb?.settings?.lang === 'en';

  if (allBtn) allBtn.disabled = true;
  if (moreBtn) moreBtn.disabled = true;

  try {
    let page = 0;
    const maxPages = 20; // Güvenlik üst sınırı: 20 sayfa (~400 yorum)
    while (nextCommentsToken && page < maxPages) {
      page++;
      if (allText) {
        allText.textContent = isEn ? `Loading... (${loadedCommentsList.length})` : `Yükleniyor... (${loadedCommentsList.length})`;
      }
      const res = await fetch(`/api/video/${videoId}/comments?token=${encodeURIComponent(nextCommentsToken)}`);
      const data = await res.json();
      if (data.success && data.comments && data.comments.length > 0) {
        loadedCommentsList = loadedCommentsList.concat(data.comments);
        if (!cachedTotalComments) {
          updateCommentsCountBadge(loadedCommentsList.length);
        }
        nextCommentsToken = data.nextPageToken || null;
      } else {
        nextCommentsToken = null;
        break;
      }
    }
    renderCommentsList();
    if (!nextCommentsToken && paginationGroup) {
      paginationGroup.style.display = 'none';
    }
  } catch (err) {
    console.error("Error loading all comments:", err);
  } finally {
    if (allBtn) allBtn.disabled = false;
    if (moreBtn) moreBtn.disabled = false;
    if (allText) {
      allText.textContent = isEn ? 'Show All' : 'Hepsini Göster';
    }
  }
}

/**
 * Markdown formatındaki yorum özetini şık HTML bloklarına dönüştürür.
 * @param {string} md 
 * @returns {string}
 */
function formatCommentsMarkdown(md) {
  if (!md) return '';
  const blocks = md.trim().split(/\n\s*\n/);
  return blocks.map(block => {
    const lines = block.split('\n').map(l => l.trim()).filter(Boolean);

    // Başlık blokları (### Başlık veya **Başlık:**)
    if (lines.length === 1 && (/^#{1,4}\s+/.test(lines[0]) || /^\*\*[^*]+\*\*:?$/.test(lines[0]))) {
      const headerText = lines[0].replace(/^#{1,4}\s+/, '').replace(/^\*\*|\*\*:?$/g, '');
      return `<div style="font-weight: 700; font-size: 0.90rem; color: #c084fc; margin: 12px 0 6px 0; border-bottom: 1px dashed rgba(168,85,247,0.25); padding-bottom: 3px; display: flex; align-items: center; gap: 6px;">${escapeHtml(headerText)}</div>`;
    }

    // Liste blokları (- madde, * madde, 1. madde)
    const isList = lines.some(l => /^(\d+\.|[-*•])\s+/.test(l));
    if (isList) {
      const listItems = lines.map(line => {
        if (/^(\d+\.|[-*•])\s+/.test(line)) {
          const numMatch = line.match(/^(\d+)\.\s+/);
          const clean = line.replace(/^(\d+\.|[-*•])\s+/, '').trim();
          const withBold = escapeHtml(clean)
            .replace(/\*\*([^*]+)\*\*/g, '<strong style="color: var(--text-main); font-weight: 600;">$1</strong>')
            .replace(/\*([^*]+)\*/g, '<em>$1</em>');
          const bullet = numMatch 
            ? `<span style="display: inline-flex; align-items: center; justify-content: center; width: 17px; height: 17px; border-radius: 50%; background: rgba(168, 85, 247, 0.2); color: #c084fc; font-size: 0.70rem; font-weight: 700; margin-right: 6px; flex-shrink: 0;">${numMatch[1]}</span>`
            : `<span style="color: #a855f7; margin-right: 6px; font-size: 0.95rem;">•</span>`;
          return `<li style="margin-bottom: 6px; line-height: 1.55; color: var(--text-main); font-size: 0.83rem; display: flex; align-items: baseline;">${bullet}<span>${withBold}</span></li>`;
        }
        return `<div style="margin-bottom: 4px; line-height: 1.55; font-size: 0.83rem;">${escapeHtml(line)}</div>`;
      }).join('');
      return `<ul style="margin: 6px 0 10px 0; padding: 0; list-style: none;">${listItems}</ul>`;
    }

    // Normal paragraflar ve alıntılar
    const formatted = escapeHtml(block)
      .replace(/\*\*([^*]+)\*\*/g, '<strong style="color: var(--text-main); font-weight: 600;">$1</strong>')
      .replace(/\*([^*]+)\*/g, '<em>$1</em>')
      .replace(/\n/g, '<br>');
    return `<p style="line-height: 1.6; font-size: 0.84rem; color: var(--text-main); margin: 0 0 8px 0;">${formatted}</p>`;
  }).join('');
}

const LANG_FLAG_SRC = {
  tr: 'flags/tr.png',
  en: 'flags/gb.png',
  de: 'flags/de.png',
  es: 'flags/es.png',
  pt: 'flags/pt.png',
  ru: 'flags/ru.png',
  ar: 'flags/sa.png'
};

let commentsFlagClickOutsideInit = false;

/**
 * Yorum özeti çıktı dili bayrak arayüzünü günceller.
 */
export function updateCommentsOutputLangUI(lang) {
  const currentSpan = document.getElementById('comments-output-lang-current');
  const hiddenInput = document.getElementById('comments-ai-lang-select');
  const dropdown = document.getElementById('comments-flag-dropdown');
  const effectiveLang = lang || (hiddenInput && hiddenInput.value) || localStorage.getItem('haytool_comments_out_lang') || 'app';

  if (hiddenInput) hiddenInput.value = effectiveLang;

  if (currentSpan) {
    if (effectiveLang === 'app' || !LANG_FLAG_SRC[effectiveLang]) {
      currentSpan.innerHTML = '<i data-lucide="globe" style="width: 13px; height: 13px; color: #a855f7;"></i>';
      if (window.lucide && typeof window.lucide.createIcons === 'function') {
        window.lucide.createIcons({ root: currentSpan });
      }
    } else {
      currentSpan.innerHTML = `<img src="${LANG_FLAG_SRC[effectiveLang]}" alt="${effectiveLang.toUpperCase()}" class="summary-flag-img">`;
    }
  }

  if (dropdown) {
    dropdown.querySelectorAll('.summary-flag-item').forEach(btn => {
      if (btn.getAttribute('data-lang') === effectiveLang) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
  }
}

/**
 * Yorum özet çıktı dili bayrak menüsünü açar/kapatır.
 */
export function toggleCommentsFlagDropdown(e) {
  if (e) e.stopPropagation();
  const dropdown = document.getElementById('comments-flag-dropdown');
  if (!dropdown) return;
  const isShown = dropdown.style.display !== 'none';
  dropdown.style.display = isShown ? 'none' : 'grid';

  if (!commentsFlagClickOutsideInit) {
    commentsFlagClickOutsideInit = true;
    document.addEventListener('click', (ev) => {
      const wrap = document.getElementById('comments-output-lang-wrap');
      if (wrap && !wrap.contains(ev.target)) {
        const dd = document.getElementById('comments-flag-dropdown');
        if (dd) dd.style.display = 'none';
      }
    });
  }
}

/**
 * Yorum özet çıktı dili seçimini kaydeder ve bayrak arayüzünü günceller.
 */
export function selectCommentsOutputLang(lang) {
  const dropdown = document.getElementById('comments-flag-dropdown');
  if (dropdown) dropdown.style.display = 'none';
  localStorage.setItem('haytool_comments_out_lang', lang || 'app');
  updateCommentsOutputLangUI(lang);
}

/**
 * Yorum özet motoru seçimi değiştiğinde GGUF model menüsünü gösterir veya gizler ve tercihi kaydeder.
 * @param {string} provider 
 */
export async function onCommentsProviderChange(provider) {
  if (provider) {
    localStorage.setItem('haytool_comments_provider', provider);
  }
  const ggufWrap = document.getElementById('comments-gguf-model-wrap');
  if (provider === 'gguf') {
    if (ggufWrap) {
      ggufWrap.style.display = 'inline-flex';
      if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
    }
    await refreshGgufModelsInComments();
  } else {
    if (ggufWrap) ggufWrap.style.display = 'none';
  }
}

/**
 * Kullanıcı GGUF modelini değiştirdiğinde tercihi yerel depolamaya kaydeder.
 * @param {string} modelPath 
 */
export function onCommentsModelChange(modelPath) {
  if (modelPath && modelPath !== 'none') {
    localStorage.setItem('haytool_comments_gguf_model', modelPath);
  }
}

/**
 * GGUF model klasöründeki modelleri sunucudan çekip yorumlar altındaki GGUF model menüsüne doldurur.
 * Kullanıcının son seçtiği modeli otomatik olarak seçili getirir.
 */
export async function refreshGgufModelsInComments() {
  const select = document.getElementById('comments-gguf-model-select');
  if (!select) return;

  const t = window.translations?.[window.localDb?.settings?.lang || 'tr'] || window.translations?.tr || {};
  const settings = window.localDb?.settings || {};
  const savedPath = localStorage.getItem('haytool_comments_gguf_model') || settings.ggufModelPath || '';
  let dir = (settings.ggufModelsDir || '').trim();
  if (!dir && savedPath) dir = savedPath.replace(/[\\/][^\\/]*$/, '');

  try {
    const res = await fetch(`/api/gguf/models?dir=${encodeURIComponent(dir)}`);
    const data = await res.json();
    if (data.success && Array.isArray(data.models) && data.models.length > 0) {
      let opts = '';
      let matched = false;
      data.models.forEach(m => {
        const isSelected = (!matched && m.path === savedPath) ? ' selected' : '';
        if (isSelected) matched = true;
        const sizeStr = m.sizeMB >= 1024
          ? (m.sizeMB / 1024).toFixed(1) + ' GB'
          : (m.sizeMB > 0 ? m.sizeMB + ' MB' : '');
        const label = sizeStr ? `[${sizeStr}] ${m.name}` : m.name;
        opts += `<option value="${escapeHtml(m.path)}"${isSelected} title="${escapeHtml(m.path)}">${escapeHtml(label)}</option>`;
      });
      select.innerHTML = opts;
      if (select.value && select.value !== 'none') {
        localStorage.setItem('haytool_comments_gguf_model', select.value);
      }
    } else {
      select.innerHTML = `<option value="none">${escapeHtml(t.summary_gguf_pick_folder || '⚠️ Model klasörü seçin')}</option>`;
    }
  } catch (err) {
    console.warn('[GGUF Comments Models Fetch Warn]:', err);
  }
}

/**
 * Kullanıcının yorum AI özetinde yaptığı son tercihleri (sağlayıcı motoru, GGUF modeli, çıktı dili) geri yükler.
 */
export function initCommentsPreferences() {
  // 1. Çıktı Dili Tercihi (Bayraklı Seçici)
  const savedLang = localStorage.getItem('haytool_comments_out_lang') || 'app';
  updateCommentsOutputLangUI(savedLang);

  // 2. Sağlayıcı Motoru Tercihi
  const savedProvider = localStorage.getItem('haytool_comments_provider') || window.localDb?.settings?.aiProvider || 'auto';
  const providerSelect = document.getElementById('comments-ai-provider-select');
  if (providerSelect) {
    providerSelect.value = savedProvider;
    onCommentsProviderChange(savedProvider);
  }
}

/**
 * Yüklenmiş yorumları seçilen yapay zekâ motoru ile özetler.
 * Eksik bilgi kalmaması için tetiklendiğinde henüz çekilmemiş tüm yorumları otomatik yükler.
 */
export async function summarizeComments() {
  const videoId = window.currentPlayingVideoId;
  const isEn = window.localDb?.settings?.lang === 'en';

  if (!videoId) {
    showToast(isEn ? 'Please play a video first.' : 'Özet çıkarmak için önce bir video oynatılmalıdır.', 'warning');
    return;
  }

  const summaryCard = document.getElementById('comments-ai-summary-card');
  const summaryLoading = document.getElementById('comments-summary-loading');
  const summaryBody = document.getElementById('comments-summary-body');
  const summarizeBtn = document.getElementById('btn-summarize-comments');
  const summarizeText = document.getElementById('btn-summarize-comments-text');
  const providerSelect = document.getElementById('comments-ai-provider-select');
  const ggufSelect = document.getElementById('comments-gguf-model-select');
  const langSelect = document.getElementById('comments-ai-lang-select');
  const engineBadge = document.getElementById('comments-summary-engine-badge');
  const metaText = document.getElementById('comments-summary-meta');

  if (summaryCard) summaryCard.style.display = 'block';
  if (summaryLoading) summaryLoading.style.display = 'block';
  if (summaryBody) {
    summaryBody.style.display = 'none';
    summaryBody.innerHTML = '';
  }
  if (summarizeBtn) summarizeBtn.disabled = true;

  // 1. Eğer yorumlar henüz hiç yüklenmediyse önce ilk partiyi çek
  if (loadedCommentsList.length === 0) {
    if (summarizeText) summarizeText.textContent = isEn ? 'Loading comments...' : 'Yorumlar yükleniyor...';
    await loadComments(videoId);
  }

  // 2. Eksik bilgi kalmaması için mevcut tüm sayfaları otomatik çek ("Hepsini Göster" gibi)
  if (nextCommentsToken) {
    if (summarizeText) summarizeText.textContent = isEn ? 'Loading all comments...' : 'Tüm yorumlar yükleniyor...';
    await loadAllComments();
  }

  if (loadedCommentsList.length === 0) {
    if (summarizeBtn) summarizeBtn.disabled = false;
    if (summarizeText) summarizeText.textContent = isEn ? 'Summarize Comments' : 'Yorumları Özetle';
    if (summaryLoading) summaryLoading.style.display = 'none';
    showToast(isEn ? 'No comments available for this video.' : 'Bu video için incelenecek yorum bulunamadı.', 'warning');
    return;
  }

  if (summarizeText) summarizeText.textContent = isEn ? 'Summarizing...' : 'Özetleniyor...';

  const selectedProvider = providerSelect?.value || 'auto';
  const selectedModel = (selectedProvider === 'gguf' && ggufSelect && ggufSelect.value !== 'none') ? ggufSelect.value : '';
  const selectedLang = langSelect?.value || 'app';
  const targetLang = selectedLang === 'app' ? (window.localDb?.settings?.lang || 'tr') : selectedLang;

  try {
    const res = await fetch(`/api/video/${videoId}/comments/ai-summary`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        provider: selectedProvider,
        model: selectedModel,
        lang: targetLang,
        outputLang: targetLang,
        comments: loadedCommentsList
      })
    });
    const data = await res.json();
    if (summaryLoading) summaryLoading.style.display = 'none';

    if (data.success && data.summary) {
      cachedCommentsSummary = data.summary;
      if (summaryBody) {
        summaryBody.innerHTML = formatCommentsMarkdown(data.summary);
        summaryBody.style.display = 'block';
      }
      if (engineBadge) {
        const engineLabel = data.engine ? data.engine.toUpperCase() : 'AI';
        const modelLabel = data.model ? ` (${data.model.replace(/\.gguf$/i, '')})` : '';
        engineBadge.textContent = engineLabel + modelLabel;
        engineBadge.style.display = 'inline-flex';
      }
      if (metaText) {
        const timeSec = data.tookMs ? (data.tookMs / 1000).toFixed(1) + 's' : '';
        const countStr = data.commentCount ? `${data.commentCount} ${isEn ? 'comments' : 'yorum'}` : '';
        metaText.textContent = [countStr, timeSec].filter(Boolean).join(' • ');
      }
      if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
      summaryCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } else {
      if (summaryBody) {
        summaryBody.innerHTML = `<div style="color: #ef4444; padding: 10px 0; font-size: 0.83rem;">${escapeHtml(data.error || (isEn ? 'Could not generate comments summary.' : 'Yorum özeti çıkarılamadı.'))}</div>`;
        summaryBody.style.display = 'block';
      }
    }
  } catch (err) {
    console.error("Error summarizing comments:", err);
    if (summaryLoading) summaryLoading.style.display = 'none';
    if (summaryBody) {
      summaryBody.innerHTML = `<div style="color: #ef4444; padding: 10px 0; font-size: 0.83rem;">${escapeHtml(err.message || (isEn ? 'Error occurred while generating summary.' : 'Özet oluşturulurken bir hata meydana geldi.'))}</div>`;
      summaryBody.style.display = 'block';
    }
  } finally {
    if (summarizeBtn) summarizeBtn.disabled = false;
    if (summarizeText) {
      summarizeText.textContent = isEn ? 'Summarize Comments' : 'Yorumları Özetle';
    }
  }
}

/**
 * AI Yorum Özeti kartını kapatır.
 */
export function closeCommentsSummary() {
  const summaryCard = document.getElementById('comments-ai-summary-card');
  if (summaryCard) summaryCard.style.display = 'none';
}

/**
 * AI Yorum Özetini panoya kopyalar.
 */
export function copyCommentsSummary() {
  const isEn = window.localDb?.settings?.lang === 'en';
  if (!cachedCommentsSummary) {
    showToast(isEn ? 'No summary to copy.' : 'Kopyalanacak özet bulunamadı.', 'warning');
    return;
  }
  navigator.clipboard.writeText(cachedCommentsSummary).then(() => {
    showToast(isEn ? 'Comments summary copied to clipboard!' : 'Yorum özeti panoya kopyalandı!', 'success');
  }).catch(() => {
    showToast(isEn ? 'Could not copy to clipboard.' : 'Panoya kopyalanamadı.', 'error');
  });
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
    initCommentsPreferences();
    initSidebarResizeObserver();
    syncCommentsHeightWithSidebar();
    await loadComments(window.currentPlayingVideoId);
    syncCommentsHeightWithSidebar();
  } else {
    container.classList.add('hidden');
    container.style.height = '';
    container.style.maxHeight = '';
    if (btn) {
      btn.classList.remove('active');
      btn.title = isEn ? 'Show Comments' : 'Yorumları Göster';
    }
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('resize', syncCommentsHeightWithSidebar);
}

// Global window erişim köprüleri (HTML onclick nitelikleri için)
window.renderCommentsList = renderCommentsList;
window.sortAndRenderComments = renderCommentsList;
window.loadComments = loadComments;
window.loadMoreComments = loadMoreComments;
window.loadAllComments = loadAllComments;
window.summarizeComments = summarizeComments;
window.closeCommentsSummary = closeCommentsSummary;
window.copyCommentsSummary = copyCommentsSummary;
window.updateCommentsCountBadge = updateCommentsCountBadge;
window.toggleCommentsPanel = toggleCommentsPanel;
window.syncCommentsHeightWithSidebar = syncCommentsHeightWithSidebar;
window.onCommentsProviderChange = onCommentsProviderChange;
window.onCommentsModelChange = onCommentsModelChange;
window.refreshGgufModelsInComments = refreshGgufModelsInComments;
window.updateCommentsOutputLangUI = updateCommentsOutputLangUI;
window.toggleCommentsFlagDropdown = toggleCommentsFlagDropdown;
window.selectCommentsOutputLang = selectCommentsOutputLang;
window.initCommentsPreferences = initCommentsPreferences;

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initCommentsPreferences);
  } else {
    setTimeout(initCommentsPreferences, 300);
  }
}
