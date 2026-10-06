// server/services/autoDeleteService.js
// Türkçe Açıklama: Kanala özel silme kurallarını, genel gün sınırını, ertelemeleri ve 
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
    return true;
  } catch (err) {
    console.error(`[Auto-Delete] Dosya silme hatası (${item.title}):`, err.message);
    return false;
  }
}

/**
 * Belirtilen videonun silinme vadesini (kalan ms) hesaplar.
 * @returns {number|null} null: asla silinmez, >0: kalan ms, <=0: süresi dolmuş
 */
export function getVideoRemainingMs(item, db) {
  if (!item || item.status !== 'completed' || !item.filePath) return null;

  // 1. Kanal bazlı kural kontrolü
  const channel = (db.channels || []).find(c => c.id === item.channelId);
  const chRule = channel ? channel.autoDeleteDays : 'never';

  let effectiveDays = 0;
  if (chRule === 'never') {
    return null; // Asla silinmez
  } else if (chRule === 'global' || !chRule) {
    effectiveDays = db.settings.autoDeleteDays || 0;
  } else {
    effectiveDays = parseInt(chRule, 10) || 0;
  }

  if (effectiveDays <= 0) return null; // Kural kapalı

  // Dosya tarihini belirle
  let fileTime = 0;
  try {
    if (fs.existsSync(item.filePath)) {
      const stats = fs.statSync(item.filePath);
      fileTime = stats.birthtimeMs || stats.mtimeMs || stats.ctimeMs;
    }
  } catch (e) {}

  if (!fileTime) {
    if (item.completedAt) {
      fileTime = new Date(item.completedAt).getTime();
    } else if (item.addedAt) {
      fileTime = new Date(item.addedAt).getTime();
    } else {
      fileTime = Date.now();
    }
  }

  const now = Date.now();
  const baseExpireMs = fileTime + (effectiveDays * 24 * 60 * 60 * 1000);

  // Erteleme kontrolü
  let finalExpireMs = baseExpireMs;
  if (item.autoDeletePostponedUntil && item.autoDeletePostponedUntil > finalExpireMs) {
    finalExpireMs = item.autoDeletePostponedUntil;
  }

  return finalExpireMs - now;
}

/**
 * Süresi dolmuş videoları tespit eder. Onay gerekiyorsa SSE ile arayüze onay penceresi fırlatır,
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
      thumbnail: `/api/video/${item.id}/thumbnail`
    }));

    broadcast('auto_delete_pending', {
      videos: payload,
      count: payload.length
    });
    console.log(`[Auto-Delete] ${payload.length} adet videonun silinme süresi doldu, kullanıcı onayı bekleniyor.`);
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
      addTerminalLog(`[Oto-Silme] Süresi dolan "${item.title}" videosu diskten silindi ve kütüphanede gizlenenlere eklendi.`, 'info');
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
        thumbnail: `/api/video/${item.id}/thumbnail`
      });
    }
  }
  return expired;
}
