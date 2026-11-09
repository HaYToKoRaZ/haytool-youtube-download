// Türkçe Açıklama: Proje genelinde kullanılan tarih biçimlendirme, XSS koruması, Shorts tespiti, debounce ve sayısal dönüşüm yardımcı fonksiyonları.

/**
 * XSS koruması amacıyla HTML karakterlerini güvenli hale getirir.
 * 
 * @param {string} str Kaçış yapılacak ham metin
 * @returns {string} Güvenli metin
 */
export function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * ISO 8601 tarih biçimini yerelleştirilmiş kısa tarih formatına (Örn: DD.MM.YYYY) dönüştürür.
 * 
 * @param {string} isoString ISO formatında tarih metni
 * @returns {string} Biçimlendirilmiş tarih
 */
export function formatDateTime(isoString) {
  if (!isoString) return '';
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return '';
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${day}.${month}.${year} ${hours}:${minutes}`;
  } catch (e) {
    return '';
  }
}

export function formatDate(isoString) {
  if (!isoString) return '';
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return '';
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}.${month}.${year}`;
  } catch (e) {
    return '';
  }
}

/**
 * Belirtilen tarihin bugünden kaç gün önce olduğunu hesaplar.
 * Kart üzerinde sadece sayısal gün değerini (örn: "33" veya "0"),
 * fare ile üzerine gelindiğinde (tooltip) ise seçili dile göre tam açıklamayı döner.
 * 
 * @param {string} dateStr Tarih metni
 * @param {object} [t={}] Çeviri sözlüğü
 * @returns {{ count: number|string, tooltip: string }}
 */
export function getDaysAgoInfo(dateStr, t = {}) {
  if (!dateStr) return { count: '', tooltip: '' };
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return { count: '', tooltip: '' };
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays <= 1) {
      const todayText = t.card_today || 'Bugün';
      return {
        count: '0',
        tooltip: todayText
      };
    }
    
    const daysAgoTemplate = t.card_days_ago || '{days} gün önce';
    const tooltipText = daysAgoTemplate.replace('{days}', diffDays);
    return {
      count: String(diffDays),
      tooltip: tooltipText
    };
  } catch (e) {
    return { count: '', tooltip: '' };
  }
}

/**
 * Belirtilen tarihin bugünden kaç gün önce olduğunu açıklayan Türkçe veya İngilizce metin döner (Geriye dönük uyumluluk).
 * 
 * @param {string} dateStr Tarih metni
 * @param {boolean} [isEn=false] İngilizce dil seçeneği
 * @returns {string} "X gün önce" veya "X days ago" metni
 */
export function getDaysAgoText(dateStr, isEn = false) {
  if (!dateStr) return '';
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '';
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays <= 1) {
      return isEn ? 'Today' : 'Bugün';
    }
    return isEn ? `${diffDays} days ago` : `${diffDays} gün önce`;
  } catch (e) {
    return '';
  }
}

/**
 * "1.2 GB" veya "450 MB" gibi boyut metinlerini bayt (byte) cinsine dönüştürür.
 * 
 * @param {string} sizeStr Boyut metni
 * @returns {number} Bayt miktarı
 */
export function parseSizeToBytes(sizeStr) {
  if (!sizeStr) return 0;
  const cleaned = sizeStr.replace(/,/g, '').trim();
  const num = parseFloat(cleaned);
  if (isNaN(num)) return 0;
  
  const upper = cleaned.toUpperCase();
  if (upper.includes('GB') || upper.includes('G')) {
    return num * 1024 * 1024 * 1024;
  }
  if (upper.includes('MB') || upper.includes('M')) {
    return num * 1024 * 1024;
  }
  if (upper.includes('KB') || upper.includes('K')) {
    return num * 1024;
  }
  return num;
}

/**
 * Süre ve başlık kriterlerine göre bir videonun Shorts olup olmadığını belirler.
 * 
 * @param {string} durationStr Süre biçimi (Örn: "1:30")
 * @param {string} title Video başlığı
 * @param {string} [channelId] Kanal ID'si
 * @returns {boolean} Shorts ise true
 */
export function isShortVideo(durationStr, title, channelId, item = null) {
  const lowerTitle = title ? String(title).toLowerCase() : '';
  const urlStr = item ? (item.webUrl || item.url || '') : '';

  // 1. Kesin Shorts Belirteçleri (URL veya Başlıkta #shorts, /shorts/)
  if (lowerTitle.includes('#shorts') || lowerTitle.includes('#short') || lowerTitle.includes('/shorts/') || urlStr.includes('/shorts/')) {
    return true;
  }

  // 2. Kullanıcının manuel veya eklentiyle indirdiği standalone / takip edilmeyen videolar:
  // Başlığında veya URL'sinde kesin shorts ibaresi yoksa normal video kabul edilir (kütüphaneden kaybolmaz)
  const isManualOrStandalone = (channelId === 'manual') || (item && (item.isStandalone === true || item.channelId === 'manual'));
  if (isManualOrStandalone) {
    return false;
  }

  if (durationStr === null || durationStr === undefined || durationStr === '') return false;
  
  let strVal = String(durationStr).trim();
  
  let limit = 180;
  if (channelId && window.localDb && window.localDb.channels) {
    const chan = window.localDb.channels.find(c => c.id === channelId);
    if (chan && chan.shortsDurationLimit !== undefined) {
      limit = chan.shortsDurationLimit;
    }
  } else if (window.localDb && window.localDb.settings && window.localDb.settings.shortsDurationLimit !== undefined) {
    limit = window.localDb.settings.shortsDurationLimit;
  }

  // Doğrudan sayısal saniye gelmişse (örn: "45" veya 45)
  if (!isNaN(strVal) && !strVal.includes(':')) {
    const totalSec = Number(strVal);
    return totalSec > 0 && totalSec <= limit;
  }

  const parts = strVal.split(':').map(Number);
  let totalSeconds = 0;
  
  if (parts.length === 1) {
    totalSeconds = parts[0];
  } else if (parts.length === 2) {
    totalSeconds = (parts[0] * 60) + parts[1];
  } else if (parts.length === 3) {
    totalSeconds = (parts[0] * 3600) + (parts[1] * 60) + parts[2];
  }
  
  if (totalSeconds > 0 && totalSeconds <= limit) {
    return true;
  }
  
  if (lowerTitle.includes('shorts') || lowerTitle.includes('short')) {
    return true;
  }
  return false;
}

/**
 * "01:23:45" formatındaki süre metnini saniye cinsine çevirir.
 * 
 * @param {string} timeStr Süre metni
 * @returns {number} Saniye miktarı
 */
export function parseTimeToSeconds(timeStr) {
  if (!timeStr) return 0;
  const parts = timeStr.split(':').map(Number);
  if (parts.some(isNaN)) return 0;
  
  if (parts.length === 1) {
    return parts[0];
  } else if (parts.length === 2) {
    return (parts[0] * 60) + parts[1];
  } else if (parts.length === 3) {
    return (parts[0] * 3600) + (parts[1] * 60) + parts[2];
  }
  return 0;
}

/**
 * Süre filtresi için "01:23:45" veya "12:34" formatındaki süreyi saniyeye çevirir.
 * 
 * @param {string} duration Süre metni
 * @returns {number|null} Saniye cinsinden süre veya null
 */
export function parseDurationToSeconds(duration) {
  if (!duration) return null;
  const parts = String(duration).split(':').map(Number);
  if (parts.some(isNaN)) return null;
  if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  } else if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  } else if (parts.length === 1) {
    return parts[0];
  }
  return null;
}

/**
 * Video açıklamasındaki zaman etiketlerini (örn: 01:23) tıklanabilir linklere dönüştürür.
 * 
 * @param {string} text Ham açıklama metni
 * @returns {string} Zaman etiketleri linke çevrilmiş HTML metni
 */
export function formatDescriptionTimestamps(text) {
  if (!text) return '';
  const escaped = escapeHtml(text);
  
  // Zaman damgalarını yakalayan regex (örn: 12:34 veya 01:23:45)
  const timestampRegex = /\b(?:(\d{1,2}):)?(\d{1,2}):(\d{2})\b/g;
  
  return escaped.replace(timestampRegex, (match) => {
    const seconds = parseTimeToSeconds(match);
    return `<span class="description-timestamp" onclick="seekVideoToSeconds(${seconds})" style="color:var(--primary);cursor:pointer;text-decoration:underline;">${match}</span>`;
  });
}

/**
 * "1.2K" veya "5.4M" gibi beğeni sayılarını sayı tipine dönüştürür.
 * 
 * @param {string} likeStr Beğeni sayısı metni
 * @returns {number} Sayısal değer
 */
export function parseLikes(likeStr) {
  if (!likeStr) return 0;
  const cleaned = likeStr.replace(/,/g, '').trim().toUpperCase();
  const num = parseFloat(cleaned);
  if (isNaN(num)) return 0;
  
  if (cleaned.includes('K')) {
    return Math.round(num * 1000);
  }
  if (cleaned.includes('M')) {
    return Math.round(num * 1000000);
  }
  return Math.round(num);
}

/**
 * YouTube'un "3 hours ago" gibi nispi süre metinlerini Türkçe veya İngilizce karşılıklarına dönüştürür.
 * 
 * @param {string} timeStr Nispi zaman metni
 * @returns {string} Yerelleştirilmiş zaman metni
 */
export function parseRelativeTime(timeStr) {
  if (!timeStr) return '';
  const val = timeStr.trim().toLowerCase();
  
  const isEn = window.localDb && window.localDb.settings && window.localDb.settings.lang === 'en';
  
  if (isEn) return timeStr;
  
  // Basit kelime bazlı Türkçe dönüşüm eşlemeleri
  let result = timeStr
    .replace(/years?/g, 'yıl')
    .replace(/months?/g, 'ay')
    .replace(/weeks?/g, 'hafta')
    .replace(/days?/g, 'gün')
    .replace(/hours?/g, 'saat')
    .replace(/minutes?/g, 'dakika')
    .replace(/seconds?/g, 'saniye')
    .replace(/ago/g, 'önce')
    .replace(/an?/g, 'bir');
    
  return result;
}

/**
 * Sık tetiklenen fonksiyonların çalışmasını sınırlandıran debounce fonksiyonu.
 * 
 * @param {function} func Tetiklenecek asıl fonksiyon
 * @param {number} delay Bekleme süresi (milisaniye)
 * @returns {function} Debounce edilmiş sarmalayıcı fonksiyon
 */
export function debounce(func, delay) {
  let timeoutId;
  return function(...args) {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => {
      func.apply(this, args);
    }, delay);
  };
}

/**
 * Video kartında mor nokta (Katıl / Üyelere Özel) alıp almadığını kontrol eder.
 * Sadece status === 'failed' olup üyelik hatası alanları veya isMembersOnly işaretlileri kapsar.
 * 
 * @param {object} item Video nesnesi
 * @returns {boolean}
 */
export function isMembersOnlyVideo(item) {
  if (!item) return false;
  if (item.isMembersOnly === true) return true;
  if (item.status === 'failed' && item.error && /yeler|üyeler|members-only|katıl|katil|join this channel|ayrıcalık|ayrcal/i.test(item.error)) {
    return true;
  }
  return false;
}

/**
 * Varsayılan YouTube/içerik kategori isimleri sözlüğü (1-17).
 */
export const DEFAULT_CATEGORY_NAMES = {
  1: ["Genel", "General"],
  2: ["Oyun", "Gaming"],
  3: ["Eğitim", "Education"],
  4: ["Müzik", "Music"],
  5: ["Teknoloji", "Technology"],
  6: ["Spor", "Sports"],
  7: ["Sinema & Film", "Movies & Cinema"],
  8: ["Haberler & Siyaset", "News & Politics"],
  9: ["Eğlence", "Entertainment"],
  10: ["Bilim", "Science"],
  11: ["Gezi & Yaşam", "Travel & Life"],
  12: ["Komedi", "Comedy"],
  13: ["Belgesel", "Documentary"],
  14: ["Anime & Çizgi Film", "Anime & Cartoon"],
  15: ["Finans & Ekonomi", "Finance & Economy"],
  16: ["League of Legends", "League of Legends"],
  17: ["Podcast", "Podcast"]
};

/**
 * Kategori nesnesini seçili dile göre çevirir ve adını döner.
 * 
 * @param {object} cat - Kategori nesnesi ({ id, name })
 * @param {object} [translationsDict=null] - Çeviri sözlüğü
 * @returns {string} Çevrilmiş kategori adı
 */
export function getCatTranslatedName(cat, translationsDict = null) {
  if (!cat) return '';
  let catName = cat.name || '';
  if (cat.id >= 1 && cat.id <= 17) {
    const list = DEFAULT_CATEGORY_NAMES[cat.id];
    if (list && (cat.name === list[0] || cat.name === list[1] || !cat.name)) {
      if (translationsDict && translationsDict[`category_${cat.id}`]) {
        catName = translationsDict[`category_${cat.id}`];
      }
    }
  }
  return catName;
}
/**
 * Bir videonun otomatik silinmesine kalan süreyi hesaplar.
 * 
 * @param {object} item db.history video nesnesi
 * @param {object} db Yerel db nesnesi
 * @returns {{ remainingMs: number|null, isExpired: boolean, badgeText: string, tooltip: string }|null}
 */
export function getVideoRemainingInfo(item, db) {
  if (!item || item.status !== 'completed' || !db) return null;
  const channel = (db.channels || []).find(c => c.id === item.channelId);

  // Gün kuralı
  const chRule = channel ? channel.autoDeleteDays : 'never';
  let effectiveDays = 0;
  if (chRule !== 'never') {
    if (chRule === 'global' || !chRule) {
      effectiveDays = db.settings?.autoDeleteDays || 0;
    } else {
      effectiveDays = parseInt(chRule, 10) || 0;
    }
  }

  // Sayı kuralı
  const chCountRule = channel ? channel.autoDeleteMaxCount : 'none';
  let effectiveMaxCount = 0;
  if (chCountRule !== 'none' && chCountRule !== 'never') {
    if (chCountRule === 'global' || !chCountRule) {
      effectiveMaxCount = parseInt(db.settings?.autoDeleteMaxCount, 10) || 0;
    } else {
      effectiveMaxCount = parseInt(chCountRule, 10) || 0;
    }
  }

  if (effectiveDays <= 0 && effectiveMaxCount <= 0) return null;

  // Erteleme kontrolü
  const isPostponed = item.autoDeletePostponedUntil && item.autoDeletePostponedUntil > Date.now();

  // 1. Gün hesabı
  let dayRemainingMs = null;
  let isDayExpired = false;
  let remainingHours = 0;
  let remainingDays = 0;
  if (effectiveDays > 0) {
    let fileTime = 0;
    if (item.completedAt) {
      fileTime = new Date(item.completedAt).getTime();
    } else if (item.publishedAt) {
      fileTime = new Date(item.publishedAt).getTime();
    } else if (item.downloadedAt) {
      fileTime = new Date(item.downloadedAt).getTime();
    } else {
      fileTime = Date.now();
    }

    const baseExpireMs = fileTime + (effectiveDays * 24 * 60 * 60 * 1000);
    let finalExpireMs = baseExpireMs;
    if (item.autoDeletePostponedUntil && item.autoDeletePostponedUntil > finalExpireMs) {
      finalExpireMs = item.autoDeletePostponedUntil;
    }

    dayRemainingMs = finalExpireMs - Date.now();
    remainingHours = Math.round(dayRemainingMs / (1000 * 60 * 60));
    remainingDays = Math.ceil(dayRemainingMs / (1000 * 60 * 60 * 24));
    isDayExpired = dayRemainingMs <= 0;
  }

  // 2. Sayı hesabı
  let isCountExceeded = false;
  if (effectiveMaxCount > 0 && channel) {
    const channelCompleted = (db.history || []).filter(h => h.channelId === item.channelId && h.status === 'completed');
    if (channelCompleted.length > effectiveMaxCount) {
      channelCompleted.sort((a, b) => {
        const timeA = new Date(a.completedAt || a.publishedAt || a.downloadedAt || 0).getTime();
        const timeB = new Date(b.completedAt || b.publishedAt || b.downloadedAt || 0).getTime();
        return timeB - timeA;
      });
      const rank = channelCompleted.findIndex(h => h.id === item.id);
      if (rank >= effectiveMaxCount) {
        isCountExceeded = true;
      }
    }
  }

  let isExpired = false;
  let badgeText = '';
  let tooltip = '';
  let remainingMs = 0;

  if (isPostponed) {
    const postponeRemainingMs = item.autoDeletePostponedUntil - Date.now();
    const pMins = Math.ceil(postponeRemainingMs / (1000 * 60));
    if (pMins < 60) {
      badgeText = `⏸️ ${pMins}dk`;
    } else if (pMins < 1440) {
      badgeText = `⏸️ ${Math.ceil(pMins / 60)}sa`;
    } else {
      badgeText = `⏸️ ${Math.ceil(pMins / 1440)}g`;
    }
    tooltip = 'Otomatik silme kullanıcı tarafından ertelendi';
    remainingMs = postponeRemainingMs;
    isExpired = false;
  } else if (isDayExpired && isCountExceeded) {
    isExpired = true;
    badgeText = '⏳ Süre & Limit Doldu';
    tooltip = 'Videonun hem süresi hem kanal video sayısı sınırı aşıldı';
    remainingMs = 0;
  } else if (isCountExceeded) {
    isExpired = true;
    badgeText = '⏳ Limit Aşıldı';
    tooltip = `Kanal azami video sınırını aştı (En eski indirilen / Azami: ${effectiveMaxCount})`;
    remainingMs = 0;
  } else if (isDayExpired) {
    isExpired = true;
    badgeText = '⏳ Süresi Doldu';
    tooltip = 'Otomatik silme süresi doldu, silinmeyi bekliyor';
    remainingMs = dayRemainingMs;
  } else if (dayRemainingMs !== null) {
    remainingMs = dayRemainingMs;
    if (remainingDays <= 1) {
      badgeText = `⏳ ${Math.max(1, remainingHours)}s`;
      tooltip = `Silinmeye ${Math.max(1, remainingHours)} saat kaldı`;
    } else {
      badgeText = `⏳ ${remainingDays}g`;
      tooltip = `Silinmeye ${remainingDays} gün kaldı`;
    }
  } else {
    // Sadece sayı kuralı var ve limit henüz aşılmadı
    return null;
  }

  return {
    remainingMs,
    isExpired,
    remainingDays,
    badgeText,
    tooltip
  };
}
if (typeof window !== 'undefined') {
  window.getVideoRemainingInfo = getVideoRemainingInfo;
}

/**
 * Video nesnesinden veya URL'den platform adını çözümler ('youtube' | 'tiktok' | 'x' | 'instagram' | 'other').
 */
export function detectVideoPlatform(item) {
  if (!item) return 'youtube';
  if (item.platform) return item.platform;
  const url = (item.url || item.webUrl || '').toLowerCase();
  const ch = (item.channelName || '').toLowerCase();
  const cid = String(item.channelId || '');
  const fp = (item.filePath || '').toLowerCase();
  const title = (item.title || '').toLowerCase();
  const id = String(item.id || '');
  if (url.includes('tiktok.com') || ch.includes('tiktok') || fp.includes('0-tiktok') || cid.startsWith('MS4wLjAB')) return 'tiktok';
  if (url.includes('twitter.com') || url.includes('x.com') || ch.includes('twitter') || fp.includes('0-x') || (id.startsWith('ext_') && /^\d{7,22}$/.test(cid))) return 'x';
  if (url.includes('instagram.com') || ch.includes('instagram') || fp.includes('0-instagram') || title.startsWith('video by ') || title.startsWith('post by ')) return 'instagram';
  if (id.startsWith('iptv_') || fp.includes('0-iptv') || fp.includes('\\iptv\\') || fp.includes('/iptv/') || item.platform === 'iptv' || cid === 'iptv_record') return 'iptv';
  if (id.startsWith('ext_')) return 'other';
  return 'youtube';
}

/**
 * Platformlar için SVG ikonu döner.
 */
export function getPlatformSvgIcon(platform, size = 16) {
  switch (platform) {
    case 'tiktok':
      return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="currentColor"><path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64c.298-.002.595.042.88.13V9.4a6.33 6.33 0 0 0-1-.08A6.34 6.34 0 0 0 3 15.66a6.34 6.34 0 0 0 10.86 4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-.04-4.52z"/></svg>`;
    case 'x':
      return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>`;
    case 'instagram':
      return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>`;
    case 'iptv':
      return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="15" rx="2" ry="2"/><polyline points="17 2 12 7 7 2"/></svg>`;
    case 'other':
      return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>`;
    default:
      return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="currentColor"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>`;
  }
}

/**
 * Türkçe Açıklama: Verilen kanal ID'sinin takip listesinde (localDb.channels) kayıtlı gerçek bir kanal olup olmadığını döner.
 */
export function hasFollowedChannelAvatar(channelId, channelsOverride = null) {
  if (!channelId || channelId === 'manual' || String(channelId).startsWith('@')) return false;
  const list = Array.isArray(channelsOverride)
    ? channelsOverride
    : (typeof window !== 'undefined' && Array.isArray(window.localDb?.channels) ? window.localDb.channels : []);
  return list.some(c => c && c.id === channelId);
}

/**
 * Türkçe Açıklama: Bilinen platformlar için sıfır ağ gecikmeli ve sıfır harici takip (telemetri) içeren
 * yüksek çözünürlüklü yerleşik site favicon SVG data-URI'lerini döner.
 */
export function getSiteFaviconFallbackDataUri(platform = 'other') {
  if (platform === 'x') {
    return "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Crect width='24' height='24' rx='6' fill='%230f172a'/%3E%3Cpath fill='%23ffffff' d='M16.9 5.5h2.4l-5.3 6 6.2 8.2h-4.9l-3.8-5-4.4 5H4.7l5.6-6.4L4.4 5.5h5l3.5 4.6 4-4.6zm-.8 12.8h1.3L8.9 6.8H7.5l8.6 11.5z'/%3E%3C/svg%3E";
  }
  if (platform === 'instagram') {
    return "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cdefs%3E%3ClinearGradient id='ig' x1='0%25' y1='100%25' x2='100%25' y2='0%25'%3E%3Cstop offset='0%25' stop-color='%23f09433'/%3E%3Cstop offset='50%25' stop-color='%23dc2743'/%3E%3Cstop offset='100%25' stop-color='%23bc1888'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='24' height='24' rx='6' fill='url(%23ig)'/%3E%3Crect x='4.5' y='4.5' width='15' height='15' rx='4.2' fill='none' stroke='%23fff' stroke-width='1.8'/%3E%3Ccircle cx='12' cy='12' r='3.6' fill='none' stroke='%23fff' stroke-width='1.8'/%3E%3Ccircle cx='16.3' cy='7.7' r='1.1' fill='%23fff'/%3E%3C/svg%3E";
  }
  if (platform === 'tiktok') {
    return "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Crect width='24' height='24' rx='6' fill='%2309090b'/%3E%3Cpath fill='%2325f4ee' d='M16.6 7.8a3.6 3.6 0 0 1-2.8-3.1V4.2h-2.5v9.9a2.1 2.1 0 1 1-1.5-2v-2.5a4.6 4.6 0 1 0 4 4.5V9.2a5.9 5.9 0 0 0 3.4 1.1V7.9l-.6-.1z'/%3E%3Cpath fill='%23fe2c55' d='M17.2 8.3a3.6 3.6 0 0 1-2.8-3.1V4.7h-2v9.9a2.1 2.1 0 1 1-1.8-2.1V10a4.6 4.6 0 1 0 4.3 4.6V9.7a5.9 5.9 0 0 0 3.4 1.1V8.4l-1.1-.1z' opacity='.85'/%3E%3C/svg%3E";
  }
  if (platform === 'youtube') {
    return "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Crect width='24' height='24' rx='6' fill='%23ef4444'/%3E%3Cpolygon points='9.8,7.5 16.8,12 9.8,16.5' fill='%23ffffff'/%3E%3C/svg%3E";
  }
  if (platform === 'iptv') {
    return "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Crect width='24' height='24' rx='6' fill='%230284c7'/%3E%3Crect x='4' y='7' width='16' height='12' rx='2' fill='none' stroke='%23fff' stroke-width='1.8'/%3E%3Cpolyline points='15 3 12 7 9 3' stroke='%23fff' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round' fill='none'/%3E%3C/svg%3E";
  }
  return "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Crect width='24' height='24' rx='6' fill='%23334155'/%3E%3Ccircle cx='12' cy='12' r='6.8' fill='none' stroke='%23e2e8f0' stroke-width='1.6'/%3E%3Cline x1='5.2' y1='12' x2='18.8' y2='12' stroke='%23e2e8f0' stroke-width='1.5'/%3E%3Cellipse cx='12' cy='12' rx='3.2' ry='6.8' fill='none' stroke='%23e2e8f0' stroke-width='1.5'/%3E%3C/svg%3E";
}

/**
 * Türkçe Açıklama: Video nesnesinin kaynak sitesine ait favicon adresini çözümler.
 * Bilinen platformlarda (X, Instagram, TikTok, YouTube) sayfa yüklemesini yavaşlatmamak ve harici
 * sunuculara istek atmamak için doğrudan yerleşik renkli favicon SVG kullanılır; diğer sitelerde
 * sitenin kendi /favicon.ico adresi (yerleşik SVG yedekli olarak) kullanılır.
 */
export function getSiteFaviconInfo(item) {
  const platform = detectVideoPlatform(item);
  let domain = '';
  const rawUrl = item?.webUrl || item?.url || '';
  if (rawUrl && (rawUrl.startsWith('http://') || rawUrl.startsWith('https://'))) {
    try {
      const host = new URL(rawUrl).hostname.replace(/^www\./i, '').toLowerCase();
      if (host) domain = host;
    } catch (e) {}
  }
  if (!domain) {
    if (platform === 'x') domain = 'x.com';
    else if (platform === 'instagram') domain = 'instagram.com';
    else if (platform === 'tiktok') domain = 'tiktok.com';
    else if (platform === 'youtube') domain = 'youtube.com';
  }
  const fallback = getSiteFaviconFallbackDataUri(platform);
  const isBuiltInBrand = platform === 'x' || platform === 'instagram' || platform === 'tiktok' || platform === 'youtube';
  const src = (!isBuiltInBrand && domain)
    ? `https://${domain}/favicon.ico`
    : fallback;
  return { src, fallback, domain, platform };
}

/**
 * Türkçe Açıklama: Takip edilen YouTube kanalları için yerel kanal avatarını, YouTube harici kaynaklar
 * (X, Instagram, TikTok ve diğer siteler) veya takip edilmeyen manuel videolar için ise kaynak sitenin
 * favicon resmini döndürür (404 /api/channels/manual/avatar hatalarını tamamen önler).
 */
export function getChannelOrSiteAvatarHtml(item, className = 'video-card-channel-avatar', channelsOverride = null) {
  if (!item) return '';
  const platform = detectVideoPlatform(item);
  if (platform === 'youtube' && hasFollowedChannelAvatar(item.channelId, channelsOverride)) {
    return `<img src="/api/channels/${encodeURIComponent(item.channelId)}/avatar" class="${className}" alt="" aria-hidden="true" loading="lazy" decoding="async" onerror="this.style.display='none';" />`;
  }
  const { src, fallback } = getSiteFaviconInfo(item);
  return `<img src="${src}" class="${className} site-favicon-avatar" alt="" aria-hidden="true" loading="lazy" decoding="async" referrerpolicy="no-referrer" onerror="this.onerror=null;this.src=&quot;${fallback}&quot;;" />`;
}

/**
 * Sol alt köşede gösterilecek platform rozetini üretir.
 */
export function getPlatformBadgeHtml(item) {
  const platform = detectVideoPlatform(item);
  let bg = 'rgba(239, 68, 68, 0.85)'; // YouTube Kırmızı
  let label = 'YouTube';

  if (platform === 'tiktok') {
    bg = 'rgba(0, 0, 0, 0.85)';
    label = 'TikTok';
  } else if (platform === 'x') {
    bg = 'rgba(15, 23, 42, 0.9)';
    label = 'Twitter / X';
  } else if (platform === 'instagram') {
    bg = 'linear-gradient(45deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)';
    label = 'Instagram';
  } else if (platform === 'iptv') {
    bg = 'linear-gradient(135deg, #0284c7, #4f46e5)';
    label = 'IPTV';
  }

  const iconSvg = getPlatformSvgIcon(platform, 13);
  return `<span class="video-card-platform-badge" title="${label}" style="position: absolute; bottom: 8px; left: 8px; z-index: 12; display: inline-flex; align-items: center; justify-content: center; width: 22px; height: 22px; border-radius: 6px; background: ${bg}; color: #fff; box-shadow: 0 2px 6px rgba(0,0,0,0.4); border: 1px solid rgba(255,255,255,0.2); pointer-events: none;">${iconSvg}</span>`;
}

if (typeof window !== 'undefined') {
  window.detectVideoPlatform = detectVideoPlatform;
  window.getPlatformSvgIcon = getPlatformSvgIcon;
  window.getPlatformBadgeHtml = getPlatformBadgeHtml;
  window.hasFollowedChannelAvatar = hasFollowedChannelAvatar;
  window.getSiteFaviconInfo = getSiteFaviconInfo;
  window.getChannelOrSiteAvatarHtml = getChannelOrSiteAvatarHtml;
}
