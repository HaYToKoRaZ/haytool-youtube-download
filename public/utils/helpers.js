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
 * Belirtilen tarihin bugünden kaç gün önce olduğunu açıklayan Türkçe veya İngilizce metin döner.
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
export function isShortVideo(durationStr, title, channelId) {
  if (title) {
    const lowerTitle = title.toLowerCase();
    if (lowerTitle.includes('#shorts') || lowerTitle.includes('#short')) {
      return true;
    }
  }
  if (!durationStr) return false;
  
  let limit = 180;
  if (channelId && window.localDb && window.localDb.channels) {
    const chan = window.localDb.channels.find(c => c.id === channelId);
    if (chan && chan.shortsDurationLimit !== undefined) {
      limit = chan.shortsDurationLimit;
    }
  } else if (window.localDb && window.localDb.settings && window.localDb.settings.shortsDurationLimit !== undefined) {
    limit = window.localDb.settings.shortsDurationLimit;
  }

  const parts = durationStr.split(':').map(Number);
  let totalSeconds = 0;
  
  if (parts.length === 1) {
    totalSeconds = parts[0];
  } else if (parts.length === 2) {
    totalSeconds = (parts[0] * 60) + parts[1];
  } else if (parts.length === 3) {
    totalSeconds = (parts[0] * 3600) + (parts[1] * 60) + parts[2];
  }
  
  if (title && totalSeconds <= limit) {
    const lowerTitle = title.toLowerCase();
    // Arama kelimeleri içeren ve süresi uyanları işaretle
    if (lowerTitle.includes('shorts') || lowerTitle.includes('short')) {
      return true;
    }
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
