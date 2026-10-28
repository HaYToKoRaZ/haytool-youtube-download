// server/services/autoDeleteService.js
// Türkçe Açıklama: Kanala özel silme kurallarını (gün ve maksimum video sayısı), genel sınırları, ertelemeleri ve 
// onay mekanizmasını yöneten bağımsız otomatik dosya silme modülü.

import fs from 'fs';
import path from 'path';
import { readDb, writeDb, recordDeletedVideo } from '../database.js';
import { broadcast, addTerminalLog } from './sse.js';

/**
 * Bir video kaydının dosyasını ve yan dosyalarını (.jpg, .webp, .description, .srt, .vtt) diskten temizler.
 * 
 * @param {object} item db.history video nesnesi
 * @returns {boolean} Silme başarılı mı
 */
export function physicallyDeleteVideoFiles(item) {
  if (!item || !item.filePath) return false;
  try {
    if (fs.existsSync(item.filePath)) {
      fs.unlinkSync(item.filePath);
    }
    const ext = path.extname(item.filePath);
    const sidecars = [
      item.filePath.replace(ext, '.jpg'),
      item.filePath.replace(ext, '.webp'),
      item.filePath.replace(ext, '.description'),
      item.filePath.replace(ext, '.tr.srt'),
      item.filePath.replace(ext, '.en.srt'),
      item.filePath.replace(ext, '.tr.vtt'),
      item.filePath.replace(ext, '.en.vtt')
    ];
    for (const sc of sidecars) {
      if (fs.existsSync(sc)) {
        try { fs.unlinkSync(sc); } catch (e) {}
      }
    }
    // Aynı adı taşıyan diğer yan dosyalar (kullanıcı yapımı altyazı vb.)
    try {
      const dirName = path.dirname(item.filePath);
      const baseName = path.basename(item.filePath, ext);
      const stripped = baseName.replace(/\s*\[[A-Za-z0-9_-]{11}\]\s*/g, ' ').trim();
      const sidecarExt = /\.(srt|vtt|ass|ssa|sub|lrc|txt|description|json|jpg|jpeg|png|webp)$/i;
      for (const file of fs.readdirSync(dirName)) {
        const hit = file.startsWith(baseName + '.') ||
          (item.id && file.includes('[' + item.id + ']')) ||
          (stripped.length >= 6 && stripped !== baseName && file.startsWith(stripped + '.') && sidecarExt.test(file));
        if (hit) { try { fs.unlinkSync(path.join(dirName, file)); } catch (e) {} }
      }
    } catch (e) {}
    return true;
  } catch (err) {
    console.error(`[Auto-Delete] Dosya silme hatası (${item.title}):`, err.message);
    return false;
  }
}

/**
 * 1A Seçeneği: Videonun bilgisayara indirilme zaman damgasını (ms) döner.
 */
export function getVideoDownloadTimestamp(item) {
  if (!item) return 0;
  if (item.downloadedAt) {
    const t = new Date(item.downloadedAt).getTime();
    if (!isNaN(t) && t > 0) return t;
  }
  if (item.completedAt) {
    const t = new Date(item.completedAt).getTime();
    if (!isNaN(t) && t > 0) return t;
  }
  let fileTime = 0;
  try {
    if (item.filePath && fs.existsSync(item.filePath)) {
      const stats = fs.statSync(item.filePath);
      fileTime = stats.birthtimeMs || stats.mtimeMs || stats.ctimeMs;
    }
  } catch (e) {}
  if (fileTime > 0) return fileTime;
  if (item.addedAt) {
    const t = new Date(item.addedAt).getTime();
    if (!isNaN(t) && t > 0) return t;
  }
  return 0;
}

/**
 * Belirtilen videonun silinme vadesini (kalan ms) hesaplar.
 * Hem gün (autoDeleteDays) hem de kanal başı video sayısı (autoDeleteMaxCount) kurallarını değerlendirir.
 * Hangisi önce dolarsa o kural devreye girer.
 * 
 * @param {object} item db.history video nesnesi
 * @param {object} db Veritabanı nesnesi
 * @returns {number|null} null: asla silinmez, >0: kalan ms, <=0: süresi/limiti dolmuş
 */
export function getVideoRemainingMs(item, db) {
  if (!item || item.status !== 'completed' || !item.filePath) return null;

  // Fakap Otomatik Yedek Saklama Süresi Kuralı
  if (item.isFakap || (item.id && String(item.id).startsWith('fakap_'))) {
    const rawFakapRetention = db.settings?.fakapRetentionDays;
    if (rawFakapRetention === 'never' || rawFakapRetention === 0 || rawFakapRetention === '0' || !rawFakapRetention) {
      return null;
    }
    const effectiveDays = parseInt(rawFakapRetention, 10) || 0;
    if (effectiveDays <= 0) return null;
    const fileTime = getVideoDownloadTimestamp(item) || Date.now();
    const now = Date.now();
    const baseExpireMs = fileTime + (effectiveDays * 24 * 60 * 60 * 1000);
    let finalExpireMs = baseExpireMs;
    if (item.autoDeletePostponedUntil && item.autoDeletePostponedUntil > finalExpireMs) {
      finalExpireMs = item.autoDeletePostponedUntil;
    }
    return finalExpireMs - now;
  }

  const channel = (db.channels || []).find(c => c.id === item.channelId);

  // 1. Gün Kuralı
  const chDayRule = channel ? channel.autoDeleteDays : 'never';
  let effectiveDays = 0;
  if (chDayRule === 'never') {
    effectiveDays = 0;
  } else if (chDayRule === 'global' || !chDayRule) {
    effectiveDays = db.settings?.autoDeleteDays || 0;
  } else {
    effectiveDays = parseInt(chDayRule, 10) || 0;
  }

  let dayRemainingMs = null;
  if (effectiveDays > 0) {
    const fileTime = getVideoDownloadTimestamp(item) || Date.now();
    const now = Date.now();
    const baseExpireMs = fileTime + (effectiveDays * 24 * 60 * 60 * 1000);
    let finalExpireMs = baseExpireMs;
    if (item.autoDeletePostponedUntil && item.autoDeletePostponedUntil > finalExpireMs) {
      finalExpireMs = item.autoDeletePostponedUntil;
    }
    dayRemainingMs = finalExpireMs - now;
  }

  // 2. Sayı Kuralı (Kanal Başına Maksimum Video Sayısı Sınırı)
  const chCountRule = channel ? channel.autoDeleteMaxCount : 'none';
  let effectiveMaxCount = 0;
  if (chCountRule === 'none' || chCountRule === 'never') {
    effectiveMaxCount = 0;
  } else if (chCountRule === 'global' || !chCountRule) {
    effectiveMaxCount = db.settings?.autoDeleteMaxCount || 0;
  } else {
    effectiveMaxCount = parseInt(chCountRule, 10) || 0;
  }

  let countRemainingMs = null;
  if (effectiveMaxCount > 0) {
    const channelVideos = (db.history || [])
      .filter(h => h.channelId === item.channelId && h.status === 'completed' && h.filePath)
      .sort((a, b) => getVideoDownloadTimestamp(b) - getVideoDownloadTimestamp(a));

    const itemRank = channelVideos.findIndex(v => v.id === item.id);
    if (itemRank >= effectiveMaxCount) {
      // Limit aşıldı! En yeni N videonun dışında kaldı
      const now = Date.now();
      if (item.autoDeletePostponedUntil && item.autoDeletePostponedUntil > now) {
        countRemainingMs = item.autoDeletePostponedUntil - now;
      } else {
        countRemainingMs = 0; // Süresi/limiti hemen doldu
      }
    }
  }

  // Hangisi önce dolarsa (Math.min)
  if (dayRemainingMs !== null && countRemainingMs !== null) {
    return Math.min(dayRemainingMs, countRemainingMs);
  }
  if (dayRemainingMs !== null) return dayRemainingMs;
  if (countRemainingMs !== null) return countRemainingMs;

  return null;
}

/**
 * Silinme uyarısı veya onay modalı için videonun silinme nedenini döner.
 */
export function getVideoAutoDeleteReason(item, db) {
  if (!item || item.status !== 'completed' || !item.filePath) return '';

  if (item.isFakap || (item.id && String(item.id).startsWith('fakap_'))) {
    const rawFakapRetention = db.settings?.fakapRetentionDays;
    const effectiveDays = parseInt(rawFakapRetention, 10) || 0;
    return `Fakap Saklama Süresi (${effectiveDays} gün)`;
  }

  const channel = (db.channels || []).find(c => c.id === item.channelId);

  const chDayRule = channel ? channel.autoDeleteDays : 'never';
  let effectiveDays = 0;
  if (chDayRule !== 'never') {
    effectiveDays = (chDayRule === 'global' || !chDayRule) ? (db.settings?.autoDeleteDays || 0) : (parseInt(chDayRule, 10) || 0);
  }

  const chCountRule = channel ? channel.autoDeleteMaxCount : 'none';
  let effectiveMaxCount = 0;
  if (chCountRule !== 'none' && chCountRule !== 'never') {
    effectiveMaxCount = (chCountRule === 'global' || !chCountRule) ? (db.settings?.autoDeleteMaxCount || 0) : (parseInt(chCountRule, 10) || 0);
  }

  let countExpired = false;
  if (effectiveMaxCount > 0) {
    const channelVideos = (db.history || [])
      .filter(h => h.channelId === item.channelId && h.status === 'completed' && h.filePath)
      .sort((a, b) => getVideoDownloadTimestamp(b) - getVideoDownloadTimestamp(a));
    const itemRank = channelVideos.findIndex(v => v.id === item.id);
    if (itemRank >= effectiveMaxCount) {
      countExpired = true;
    }
  }

  let dayExpired = false;
  if (effectiveDays > 0) {
    const fileTime = getVideoDownloadTimestamp(item) || Date.now();
    if (Date.now() - fileTime >= effectiveDays * 24 * 60 * 60 * 1000) {
      dayExpired = true;
    }
  }

  if (countExpired && dayExpired) {
    return 'Gün ve Sayı Sınırı Doldu';
  } else if (countExpired) {
    return `Kanal Video Sınırı Aşıldı (Azami: ${effectiveMaxCount})`;
  } else if (dayExpired) {
    return `Süre Sınırı Doldu (${effectiveDays} Gün)`;
  }
  return '';
}

/**
 * Süresi veya sayısı dolmuş videoları tespit eder. Onay gerekiyorsa SSE ile arayüze onay penceresi fırlatır,
 * onay kapalıysa doğrudan diskten siler.
 * 
 * @param {object} downloadQueue Aktif indirme kuyruğu nesnesi
 */
export function checkAndProcessAutoDelete(downloadQueue) {
  if (downloadQueue && (downloadQueue.activeDownloads > 0 || (downloadQueue.activeProcesses && downloadQueue.activeProcesses.size > 0))) {
    return; // Aktif indirme varken ertele
  }

  const db = readDb();
  const requireConfirm = db.settings.autoDeleteRequireConfirmation !== false;
  const expiredItems = [];

  for (const item of (db.history || [])) {
    const remainingMs = getVideoRemainingMs(item, db);
    if (remainingMs !== null && remainingMs <= 0) {
      expiredItems.push(item);
    }
  }

  if (expiredItems.length === 0) return;

  if (requireConfirm) {
    // Arayüze toplu onay modalı için bildirim gönder
    const payload = expiredItems.map(item => ({
      id: item.id,
      title: item.title,
      channelName: item.channelName,
      filePath: item.filePath,
      fileSize: item.fileSize || '',
      reason: getVideoAutoDeleteReason(item, db),
      thumbnail: `/api/video/${item.id}/thumbnail`
    }));

    broadcast('auto_delete_pending', {
      videos: payload,
      count: payload.length
    });
    console.log(`[Auto-Delete] ${payload.length} adet videonun silinme süresi/limiti doldu, kullanıcı onayı bekleniyor.`);
  } else {
    // Doğrudan sessizce sil
    let updated = false;
    for (const item of expiredItems) {
      recordDeletedVideo(item, 'auto', db);
      physicallyDeleteVideoFiles(item);
      item.status = 'ignored';
      item.filePath = '';
      item.fileSize = '';
      item.hidden = true; // Kütüphanede gizlenenlere ekle
      updated = true;
      const r = getVideoAutoDeleteReason(item, db);
      addTerminalLog(`[Oto-Silme] ${r ? '(' + r + ') ' : ''}"${item.title}" videosu diskten silindi ve kütüphanede gizlenenlere eklendi.`, 'info');
    }
    if (updated) {
      writeDb(db);
      broadcast('db_update', db);
    }
  }
}

/**
 * Onay bekleyen süresi dolmuş videoların listesini döner.
 * 
 * @returns {Array<object>} Bekleyen video listesi
 */
export function getPendingAutoDeleteVideos() {
  const db = readDb();
  const requireConfirm = db.settings.autoDeleteRequireConfirmation !== false;
  if (!requireConfirm) return [];

  const expired = [];
  for (const item of (db.history || [])) {
    const remainingMs = getVideoRemainingMs(item, db);
    if (remainingMs !== null && remainingMs <= 0) {
      expired.push({
        id: item.id,
        title: item.title,
        channelName: item.channelName,
        filePath: item.filePath,
        fileSize: item.fileSize || '',
        reason: getVideoAutoDeleteReason(item, db),
        thumbnail: `/api/video/${item.id}/thumbnail`
      });
    }
  }
  return expired;
}
