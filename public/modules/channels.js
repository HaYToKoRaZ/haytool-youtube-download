// public/modules/channels.js
// Türkçe Açıklama: Takip edilen YouTube kanallarının arama, ekleme, takipten çıkarma, abone & avatar güncelleme,
// kanal ayarları (kalite, shorts, otomatik indirme) ve filtreleme işlemlerini yöneten bağımsız ES modülü.

import { escapeHtml, getCatTranslatedName } from '../utils/helpers.js';
import { renderChannelsList, getChannelsRenderSignature } from '../components/channelRow.js';

/**
 * YouTube kanal arama işlemini tetikler ve arayüzde sonuçları kart listesi olarak gösterir.
 */
export async function triggerChannelSearch() {
  const inputEl = document.getElementById('channel-input');
  if (!inputEl) return;
  
  const query = inputEl.value.trim();
  const db = window.localDb || {};
  const isEn = db.settings && db.settings.lang === 'en';
  
  if (!query) {
    if (typeof showToast === 'function') {
      showToast(isEn ? 'Please enter a search query.' : 'Lütfen aramak için bir metin girin.', 'error');
    }
    return;
  }
  
  if (query.startsWith('http') || query.includes('youtube.com') || query.includes('youtu.be')) {
    if (typeof showToast === 'function') {
      showToast(isEn ? 'This is a URL. Please click "Follow Channel" button instead.' : 'Bu bir adres. Lütfen "Kanalı Takip Et" butonunu kullanın.', 'info');
    }
    return;
  }
  
  const resultsContainer = document.getElementById('channel-search-results');
  const resultsList = document.getElementById('search-results-list');
  const searchBtn = document.getElementById('search-channel-btn');
  
  if (!resultsContainer || !resultsList) return;
  
  try {
    if (searchBtn) searchBtn.disabled = true;
    if (typeof showToast === 'function') {
      showToast(isEn ? 'Searching channels on YouTube...' : 'YouTube üzerinde kanallar aranıyor...', 'info');
    }
    
    const res = await fetch(`/api/channels/search?q=${encodeURIComponent(query)}`);
    const data = await res.json();
    
    resultsList.innerHTML = '';
    
    if (data && data.length > 0) {
      data.forEach(channel => {
        const item = document.createElement('div');
        item.className = 'channel-item card';
        item.style.display = 'flex';
        item.style.justifyContent = 'space-between';
        item.style.alignItems = 'center';
        item.style.padding = '10px 15px';
        item.style.background = 'var(--bg-card-hover)';
        item.style.border = '1px solid var(--border-color)';
        item.style.borderRadius = '6px';
        
        const isFollowed = (db.channels || []).some(c => c.id === channel.id);
        
        item.innerHTML = `
          <div style="display:flex; align-items:center; gap:12px;">
            <img src="${channel.avatar || '/api/channels/' + channel.id + '/avatar'}" style="width:40px; height:40px; border-radius:50%; object-fit:cover; border:1px solid var(--border-color);" onerror="this.src='https://www.youtube.com/s/desktop/9c83acbb/img/avatar_placeholder_40.png'">
            <div>
              <div style="font-weight:600; color:var(--text-color);">${escapeHtml(channel.name)}</div>
              <div style="font-size:0.8rem; color:var(--text-muted);">${escapeHtml(channel.handle)} • ${escapeHtml(channel.subscribers)}</div>
            </div>
          </div>
          <div>
            ${isFollowed 
              ? `<button class="btn btn-secondary btn-sm" disabled style="opacity: 0.6;">${isEn ? 'Following' : 'Takip Ediliyor'}</button>`
              : `<button class="btn btn-primary btn-sm" onclick="followChannelFromSearch('${channel.id}', '${channel.name.replace(/'/g, "\\'")}', '${channel.handle}', '${channel.avatar}')">${isEn ? 'Follow' : 'Takip Et'}</button>`
            }
          </div>
        `;
        resultsList.appendChild(item);
      });
      resultsContainer.style.display = 'block';
      if (typeof showToast === 'function') {
        showToast(isEn ? 'Search completed.' : 'Arama tamamlandı.', 'success');
      }
    } else {
      resultsList.innerHTML = `<div style="text-align:center; padding:15px; color:var(--text-muted);">${isEn ? 'No channels found.' : 'Kanal bulunamadı.'}</div>`;
      resultsContainer.style.display = 'block';
      if (typeof showToast === 'function') {
        showToast(isEn ? 'No results found.' : 'Sonuç bulunamadı.', 'warning');
      }
    }
  } catch (err) {
    if (typeof showToast === 'function') {
      showToast(isEn ? 'Search error.' : 'Arama sırasında hata oluştu.', 'error');
    }
  } finally {
    if (searchBtn) searchBtn.disabled = false;
  }
}
window.triggerChannelSearch = triggerChannelSearch;

/**
 * YouTube arama sonuçları panelini kapatır.
 */
export function closeChannelSearchResults() {
  const resultsContainer = document.getElementById('channel-search-results');
  if (resultsContainer) {
    resultsContainer.style.display = 'none';
  }
}
window.closeChannelSearchResults = closeChannelSearchResults;

/**
 * Arama sonuçlarındaki kanalı backend'e isim, handle, avatar ve ID ile hızlıca takip listesine eklemek üzere gönderir.
 */
export async function followChannelFromSearch(id, name, handle, avatar) {
  const db = window.localDb || {};
  const isEn = db.settings && db.settings.lang === 'en';
  try {
    if (typeof showToast === 'function') {
      showToast(isEn ? 'Following channel...' : 'Kanal takibe alınıyor...', 'info');
    }
    const res = await fetch('/api/channels', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        input: id, 
        name: name,
        handle: handle,
        avatar: avatar,
        downloadShorts: false 
      })
    });
    const data = await res.json();
    if (data.success) {
      if (typeof showToast === 'function') {
        showToast(isEn ? `Following ${name}!` : `"${name}" başarıyla takibe alındı!`, 'success');
      }
      closeChannelSearchResults();
    } else {
      if (typeof showToast === 'function') {
        showToast(data.error || 'Hata oluştu.', 'error');
      }
    }
  } catch (err) {
    if (typeof showToast === 'function') {
      showToast(isEn ? 'Connection error.' : 'Bağlantı hatası.', 'error');
    }
  }
}
window.followChannelFromSearch = followChannelFromSearch;

/**
 * Belirtilen kanalı takipten çıkarır ve veritabanından siler.
 */
export async function deleteChannel(id) {
  const db = window.localDb || {};
  const isEn = db.settings && db.settings.lang === 'en';
  const confirmMsg = isEn 
    ? 'Are you sure you want to unfollow this channel?' 
    : 'Bu kanalı takipten çıkarmak istediğinizden emin misiniz?';
    
  if (!confirm(confirmMsg)) return;
  
  try {
    const res = await fetch(`/api/channels/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.success) {
      if (typeof showToast === 'function') {
        showToast(isEn ? 'Channel unfollowed.' : 'Kanal takipten çıkarıldı.', 'info');
      }
    } else {
      if (typeof showToast === 'function') {
        showToast(data.error || 'Hata oluştu.', 'error');
      }
    }
  } catch (err) {
    if (typeof showToast === 'function') {
      showToast(isEn ? 'Server connection error.' : 'Sunucu ile iletişim hatası.', 'error');
    }
  }
}
window.deleteChannel = deleteChannel;

/**
 * Belirtilen kanalın profil resmini (logosunu) YouTube'dan yeniden çözümler ve günceller.
 */
export async function updateChannelAvatar(id) {
  const db = window.localDb || {};
  const isEn = db.settings && db.settings.lang === 'en';
  try {
    if (typeof showToast === 'function') {
      showToast(isEn ? 'Updating channel avatar...' : 'Kanal logosu güncelleniyor...', 'info');
    }
    const res = await fetch(`/api/channels/${id}/update-avatar`, { method: 'POST' });
    const data = await res.json();
    if (data.success) {
      if (typeof showToast === 'function') {
        showToast(isEn ? 'Channel avatar updated successfully.' : 'Kanal logosu başarıyla güncellendi.', 'success');
      }
      const img = document.getElementById(`ch-avatar-${id}`);
      if (img) {
        img.src = `/api/channels/${id}/avatar?t=${Date.now()}`;
      }
    } else {
      if (typeof showToast === 'function') {
        showToast(data.error || 'Hata oluştu.', 'error');
      }
    }
  } catch (err) {
    if (typeof showToast === 'function') {
      showToast(isEn ? 'Server connection error.' : 'Sunucu ile iletişim hatası.', 'error');
    }
  }
}
window.updateChannelAvatar = updateChannelAvatar;

/**
 * Kanal bilgilerini (abone sayısı & avatar) arka planda günceller.
 */
export async function updateChannelInfo(id) {
  const db = window.localDb || {};
  const isEn = db.settings && db.settings.lang === 'en';
  try {
    if (typeof showToast === 'function') {
      showToast(isEn ? 'Updating channel info (subscribers & avatar)...' : 'Kanal bilgileri (abone sayısı & avatar) güncelleniyor...', 'info');
    }
    const res = await fetch(`/api/channels/${id}/update-info`, { method: 'POST' });
    const data = await res.json();
    if (data.success) {
      if (typeof showToast === 'function') {
        showToast(isEn ? 'Channel info updated successfully.' : 'Kanal bilgileri başarıyla güncellendi.', 'success');
      }
      
      const targetChannel = (window.localDb?.channels || []).find(c => c.id === id);
      if (targetChannel) {
        if (data.subscriberCount) targetChannel.subscriberCount = data.subscriberCount;
        if (data.avatar) targetChannel.avatar = data.avatar;
      }

      if (typeof fetchDb === 'function') {
        await fetchDb();
      }
    } else {
      if (typeof showToast === 'function') {
        showToast(data.error || (isEn ? 'Error occurred.' : 'Hata oluştu.'), 'error');
      }
    }
  } catch (err) {
    if (typeof showToast === 'function') {
      showToast(isEn ? 'Server communication error.' : 'Sunucu ile iletişim hatası.', 'error');
    }
  }
}
window.updateChannelInfo = updateChannelInfo;
window.updateChannelSubscribers = updateChannelInfo;

/**
 * Takip edilen tüm kanalların abone sayılarını ve avatarlarını toplu olarak günceller.
 */
export async function updateAllChannelInfo() {
  const db = window.localDb || {};
  const isEn = db.settings && db.settings.lang === 'en';
  if (typeof showToast === 'function') {
    showToast(isEn ? 'Updating subscriber counts & avatars for all channels...' : 'Tüm kanal abone sayıları ve avatarları güncelleniyor...', 'info');
  }
  
  const btn = document.getElementById('update-all-channels-btn');
  if (btn) btn.disabled = true;
  
  try {
    const res = await fetch('/api/channels/update-all-info', { method: 'POST' });
    const data = await res.json();
    if (data.success) {
      if (typeof showToast === 'function') {
        showToast(isEn ? 'All channel info updated successfully.' : 'Tüm kanal bilgileri başarıyla güncellendi.', 'success');
      }
      if (typeof fetchDb === 'function') {
        await fetchDb();
      }
    } else {
      if (typeof showToast === 'function') {
        showToast(data.error || (isEn ? 'Process failed.' : 'İşlem başarısız oldu.'), 'error');
      }
    }
  } catch (err) {
    if (typeof showToast === 'function') {
      showToast(isEn ? 'Server connection error.' : 'Sunucu ile iletişim hatası.', 'error');
    }
  } finally {
    if (btn) btn.disabled = false;
  }
}
window.updateAllChannelInfo = updateAllChannelInfo;
window.updateAllChannelAvatars = updateAllChannelInfo;
window.updateAllChannelSubscribers = updateAllChannelInfo;

/**
 * Belirtilen kanal için anlık RSS denetimi tetikler.
 */
export async function syncSingleChannelRss(id) {
  const db = window.localDb || {};
  const isEn = db.settings && db.settings.lang === 'en';
  if (typeof showToast === 'function') {
    showToast(isEn ? 'Checking channel RSS feed...' : 'Kanal RSS yayını taranıyor...', 'info');
  }
  try {
    const res = await fetch(`/api/channels/${id}/sync`, { method: 'POST' });
    const data = await res.json();
    if (data.success) {
      if (typeof showToast === 'function') {
        showToast(isEn ? 'Channel RSS checked successfully.' : 'Kanal RSS denetimi başarıyla tamamlandı.', 'success');
      }
    } else {
      if (typeof showToast === 'function') {
        showToast(data.error || (isEn ? 'Error occurred.' : 'Hata oluştu.'), 'error');
      }
    }
  } catch (err) {
    if (typeof showToast === 'function') {
      showToast(isEn ? 'Connection error.' : 'Bağlantı hatası.', 'error');
    }
  }
}
window.syncSingleChannelRss = syncSingleChannelRss;

/**
 * Belirli bir kanal için indirme kalitesi tercihini günceller.
 */
export async function changeChannelQuality(id, quality) {
  const db = window.localDb || {};
  const isEn = db.settings && db.settings.lang === 'en';
  try {
    const res = await fetch(`/api/channels/${id}/quality`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quality })
    });
    const data = await res.json();
    if (data.success) {
      if (typeof showToast === 'function') {
        showToast(isEn ? 'Channel quality updated successfully.' : 'Kanal kalitesi başarıyla güncellendi.', 'success');
      }
    } else {
      if (typeof showToast === 'function') {
        showToast(data.error || 'Hata oluştu.', 'error');
      }
    }
  } catch (err) {
    if (typeof showToast === 'function') {
      showToast(isEn ? 'Server connection error.' : 'Sunucu bağlantı hatası.', 'error');
    }
  }
}
window.changeChannelQuality = changeChannelQuality;

/**
 * Belirli bir kanal için Shorts videolarının indirilip indirilmeyeceğini günceller.
 */
export async function changeChannelShorts(id, downloadShorts) {
  const db = window.localDb || {};
  const isEn = db.settings && db.settings.lang === 'en';
  try {
    const res = await fetch(`/api/channels/${id}/shorts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ downloadShorts: downloadShorts === 'true' })
    });
    const data = await res.json();
    if (data.success) {
      if (typeof showToast === 'function') {
        showToast(isEn ? 'Channel Shorts setting updated successfully.' : 'Kanal Shorts indirme ayarı başarıyla güncellendi.', 'success');
      }
    } else {
      if (typeof showToast === 'function') {
        showToast(data.error || 'Hata oluştu.', 'error');
      }
    }
  } catch (err) {
    if (typeof showToast === 'function') {
      showToast(isEn ? 'Server connection error.' : 'Sunucu bağlantı hatası.', 'error');
    }
  }
}
window.changeChannelShorts = changeChannelShorts;

/**
 * Belirli bir kanal için otomatik video indirme durumunu günceller.
 */
export async function changeChannelAutoDownload(id, autoDownload) {
  const db = window.localDb || {};
  const isEn = db.settings && db.settings.lang === 'en';
  try {
    const res = await fetch(`/api/channels/${id}/auto-download`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ autoDownload: autoDownload === 'true' })
    });
    const data = await res.json();
    if (data.success) {
      if (typeof showToast === 'function') {
        showToast(isEn ? 'Channel auto download setting successfully updated.' : 'Kanal otomatik indirme ayarı başarıyla güncellendi.', 'success');
      }
    } else {
      if (typeof showToast === 'function') {
        showToast(data.error || 'Hata oluştu.', 'error');
      }
    }
  } catch (err) {
    if (typeof showToast === 'function') {
      showToast(isEn ? 'Server connection error.' : 'Sunucu bağlantı hatası.', 'error');
    }
  }
}
window.changeChannelAutoDownload = changeChannelAutoDownload;

/**
 * Belirli bir kanal için Shorts süre sınırını günceller.
 */
export async function changeChannelShortsLimit(id, limit) {
  const db = window.localDb || {};
  const isEn = db.settings && db.settings.lang === 'en';
  try {
    const res = await fetch(`/api/channels/${id}/shorts-limit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ limit: parseInt(limit, 10) })
    });
    const data = await res.json();
    if (data.success) {
      if (typeof showToast === 'function') {
        showToast(isEn ? 'Channel Shorts duration limit successfully updated.' : 'Kanal Shorts süre sınırı başarıyla güncellendi.', 'success');
      }
    } else {
      if (typeof showToast === 'function') {
        showToast(data.error || 'Hata oluştu.', 'error');
      }
    }
  } catch (err) {
    if (typeof showToast === 'function') {
      showToast(isEn ? 'Server connection error.' : 'Sunucu bağlantı hatası.', 'error');
    }
  }
}
window.changeChannelShortsLimit = changeChannelShortsLimit;

/**
 * Kanallar sekmesindeki Kategori filtresi dropdown seçeneklerini dinamik olarak günceller.
 */
export function updateChannelCategoryFilterOptions(categories = [], channels = [], lang = 'tr') {
  const select = document.getElementById('filter-channel-category');
  if (!select) return;

  if (document.activeElement === select) return;

  const trs = window.translations || {};
  const t = trs[lang] || trs.tr || {};
  const currentVal = select.value || 'all';

  const getCatName = (cat) => getCatTranslatedName(cat, t);
  const safeEscape = (str) => String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  const catCountMap = {};
  let uncategorizedCount = 0;

  (channels || []).forEach(ch => {
    const ids = (ch.categoryIds && ch.categoryIds.length > 0)
      ? ch.categoryIds.map(Number)
      : (ch.categoryId !== undefined ? [Number(ch.categoryId)] : [1]);
    
    if (ids.length === 0 || (ids.length === 1 && ids[0] === 1)) {
      uncategorizedCount++;
    }
    ids.forEach(id => {
      catCountMap[id] = (catCountMap[id] || 0) + 1;
    });
  });

  const sortedCats = [...(categories || [])].sort((a, b) => {
    if (a.id === 1) return -1;
    if (b.id === 1) return 1;
    const nameA = getCatName(a);
    const nameB = getCatName(b);
    return nameA.localeCompare(nameB, 'tr', { sensitivity: 'base' });
  });

  const allLabel = t.opt_filter_category_all || 'Tüm Kategoriler';
  const noneLabel = t.opt_filter_category_none || 'Atanmamış / Kategorisiz';

  let html = `<option value="all">${safeEscape(allLabel)} (${channels.length})</option>`;

  sortedCats.forEach(cat => {
    const cName = getCatName(cat);
    const count = catCountMap[cat.id] || 0;
    html += `<option value="${cat.id}">${safeEscape(cName)} (${count})</option>`;
  });

  if (uncategorizedCount > 0) {
    html += `<option value="uncategorized">${safeEscape(noneLabel)} (${uncategorizedCount})</option>`;
  }

  if (select.dataset.renderedHtml !== html) {
    select.innerHTML = html;
    select.dataset.renderedHtml = html;
    const hasCurrentVal = [...select.options].some(o => o.value === currentVal);
    select.value = hasCurrentVal ? currentVal : 'all';
  }
}
window.updateChannelCategoryFilterOptions = updateChannelCategoryFilterOptions;

/**
 * Kanallar sekmesindeki aktif arama ve filtre seçimlerini okur.
 * 
 * @returns {object} { searchQuery, autoDownload, shortsDownload, categoryId }
 */
export function getChannelActiveFilters() {
  const searchInput = document.getElementById('channel-list-search-input');
  const autoSelect = document.getElementById('filter-channel-auto-download');
  const shortsSelect = document.getElementById('filter-channel-shorts-download');
  const catSelect = document.getElementById('filter-channel-category');

  return {
    searchQuery: searchInput ? searchInput.value.trim() : '',
    autoDownload: autoSelect ? autoSelect.value : 'all',
    shortsDownload: shortsSelect ? shortsSelect.value : 'all',
    categoryId: catSelect ? catSelect.value : 'all'
  };
}
window.getChannelActiveFilters = getChannelActiveFilters;

/**
 * Kanallar sekmesinde arama veya filtreler değiştiğinde kanal listesini anlık yeniden render eder.
 */
export function handleChannelFilterChange() {
  if (!window.localDb || !window.localDb.channels) return;
  const channelsList = document.getElementById('channels-list');
  if (!channelsList) return;
  const lang = (window.localDb.settings && window.localDb.settings.lang) || window.currentLang || 'tr';
  const trs = window.translations || {};
  const t = trs[lang] || trs.tr;
  const filters = typeof getChannelActiveFilters === 'function' 
    ? getChannelActiveFilters() 
    : (window.getChannelActiveFilters ? window.getChannelActiveFilters() : {});
  const sigHelper = typeof getChannelsRenderSignature === 'function' 
    ? getChannelsRenderSignature 
    : (window.getChannelsRenderSignature || (() => ''));
  window._lastChannelsRenderSignature = sigHelper(window.localDb.channels, window.localDb.categories, filters, lang);
  renderChannelsList(channelsList, window.localDb.channels, t, window.localDb.categories, filters);
  try {
    if (typeof lucide !== 'undefined' && lucide.createIcons) {
      lucide.createIcons();
    }
  } catch (e) {}
}
window.handleChannelFilterChange = handleChannelFilterChange;

/**
 * Kanal ekleme formunu (`#add-channel-form`) dinleyici ile ilklendirir.
 */
export function initAddChannelForm() {
  const addChannelForm = document.getElementById('add-channel-form');
  const channelInput = document.getElementById('channel-input');
  const addChannelBtn = document.getElementById('add-channel-btn');

  if (addChannelForm && !addChannelForm.dataset.initialized) {
    addChannelForm.dataset.initialized = 'true';
    addChannelForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const inputVal = channelInput ? channelInput.value.trim() : '';
      if (!inputVal) return;

      const downloadShorts = confirm('Bu kanal için Shorts videoları da otomatik indirilsin mi? (İptal seçilirse Shorts videoları otomatik indirilmeyecektir)');

      if (addChannelBtn) {
        addChannelBtn.disabled = true;
        const span = addChannelBtn.querySelector('span');
        if (span) span.textContent = 'Kanal Çözümleniyor...';
      }
      if (typeof showToast === 'function') {
        showToast('Kanal sorgulanıyor, lütfen bekleyin...', 'info');
      }

      try {
        const res = await fetch('/api/channels', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ input: inputVal, downloadShorts })
        });
        
        const data = await res.json();
        
        if (data.success) {
          if (channelInput) channelInput.value = '';
          if (typeof showToast === 'function') {
            showToast('Kanal başarıyla takip listesine eklendi!', 'success');
          }
        } else {
          if (typeof showToast === 'function') {
            showToast(data.error || 'Kanal eklenirken bir hata oluştu.', 'error');
          }
        }
      } catch (err) {
        if (typeof showToast === 'function') {
          showToast('Bağlantı hatası.', 'error');
        }
      } finally {
        if (addChannelBtn) {
          addChannelBtn.disabled = false;
          const span = addChannelBtn.querySelector('span');
          if (span) span.textContent = 'Kanalı Takip Et';
        }
        try {
          if (typeof lucide !== 'undefined' && lucide.createIcons) {
            lucide.createIcons();
          }
        } catch (e) {}
      }
    });
  }
}
window.initAddChannelForm = initAddChannelForm;

document.addEventListener('DOMContentLoaded', () => {
  initAddChannelForm();
});
