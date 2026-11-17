// Türkçe Açıklama: Disk üzerindeki medya dosyalarını SQLite veritabanı ile senkronize eden ve dosya/süre yardımcıları sunan modül.
import fs from 'fs';
import path from 'path';
import { getVideoResolution } from '../services/paths.js';
import { isInsideFakap } from '../services/fakapPaths.js';
import { broadcast, addTerminalLog } from '../services/sse.js';

let _deps = {
  readDb: null,
  writeDb: null,
  defaultDownloadDir: ''
};

/**
 * database.js tarafından sağlanan koordinatör bağımlılıklarını kaydeder.
 * @param {object} deps
 */
export function registerDiskSyncDeps(deps) {
  _deps = { ..._deps, ...deps };
}

/**
 * Belirtilen klasörü tarayarak video dosyalarının ID'lerine göre bir eşleme (Map) döndürür.
 * Sistem klasörlerini ($RECYCLE.BIN, System Volume Information vb.) atlar ve maksimum derinlik sınırı koyar.
 */
export function buildVideoFilesMap(downloadPath) {
  const map = new Map();
  try {
    if (!fs.existsSync(downloadPath)) return map;

    const ignoredFolders = ['$recycle.bin', 'system volume information', '.git', 'node_modules', 'temp', '0nogithub', 'scratch', 'backup'];

    function scanDir(dir, depth = 0) {
      if (depth > 3) return;
      const folderName = path.basename(dir).toLowerCase();
      if (ignoredFolders.includes(folderName) || folderName.startsWith('.')) return;

      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          const entryLower = entry.name.toLowerCase();
          if (ignoredFolders.includes(entryLower) || entryLower.startsWith('.')) continue;
          if (isInsideFakap(fullPath)) continue;
          scanDir(fullPath, depth + 1);
        } else {
          const ext = path.extname(entry.name).toLowerCase();
          if (!['.jpg', '.jpeg', '.webp', '.png', '.json', '.temp', '.part', '.ytdl', '.srt', '.vtt', '.description'].includes(ext)) {
            const bracketMatch = entry.name.match(/\[([a-zA-Z0-9_-]{11,64})\]/);
            if (bracketMatch) {
              const videoId = bracketMatch[1];
              map.set(videoId, fullPath);
            }
          }
        }
      }
    }
    scanDir(downloadPath, 0);
  } catch (e) {
    console.error(`[Disk Sync] Klasör taranırken hata oluştu: ${downloadPath}`, e.message);
  }
  return map;
}

/**
 * Diskteki video dosyaları ile veritabanını senkronize eder.
 * @param {boolean} [forceManual=false] - Kullanıcı tarafından manuel mi tetiklendi?
 * @param {string|boolean} [syncMode='fast'] - 'fast' (yalnızca varlık), 'smart' (çözünürlüğü eksikler), 'full' (tüm videolar FFprobe)
 */
export async function syncDbWithDisk(forceManual = false, syncMode = 'fast') {
  try {
    let mode = 'fast';
    if (syncMode === true || syncMode === 'smart') {
      mode = 'smart';
    } else if (syncMode === 'full') {
      mode = 'full';
    }

    const db = _deps.readDb();
    if (!forceManual && db.settings && db.settings.autoDiskSync === false) {
      return { success: true, skipped: true, message: 'Otomatik disk senkronizasyonu ayarlardan devre dışı bırakılmış.' };
    }

    const { downloadQueue } = await import('../services/downloader.js');
    const { mergeQueue } = await import('../services/mergeQueue.js');
    if ((downloadQueue && (downloadQueue.activeDownloads > 0 || (downloadQueue.activeProcesses && downloadQueue.activeProcesses.size > 0))) || (mergeQueue && mergeQueue.activeJob)) {
      console.log('[Disk Sync] Aktif indirme/birleştirme işlemi olduğu için disk senkronizasyonu ertelendi.');
      if (forceManual) {
        addTerminalLog('[Disk Sync] Aktif indirme/birleştirme işlemi olduğu için disk senkronizasyonu ertelendi.', 'warn');
      }
      return {
        success: false,
        busy: true,
        error: 'Aktif indirme/birleştirme işlemi olduğu için disk senkronizasyonu ertelendi.',
        message: 'Aktif indirme/birleştirme işlemi olduğu için disk senkronizasyonu ertelendi.'
      };
    }

    return performDiskSync(forceManual, mode);
  } catch (err) {
    console.error('[Disk Sync Error]', err.message);
    addTerminalLog(`[Disk Sync Error] ${err.message}`, 'error');
    return { success: false, error: err.message };
  }
}

function performDiskSync(forceManual = false, mode = 'fast') {
  try {
    const db = _deps.readDb();
    if (!db || !db.settings) {
      return { success: false, error: 'Veritabanı okunamadı' };
    }

    if (forceManual) {
      let startMsg = '[Disk Sync] Hızlı disk senkronizasyonu ve varlık denetimi başlatıldı...';
      if (mode === 'full') {
        startMsg = '[Disk Sync] Tam medya analizi başlatıldı (Tüm videolar FFprobe ile taranıyor)...';
      } else if (mode === 'smart') {
        startMsg = '[Disk Sync] Akıllı medya analizi başlatıldı (Yalnızca çözünürlüğü eksik videolar taranıyor)...';
      }
      addTerminalLog(startMsg, 'info');
    }

    let dbUpdated = false;
    let totalVerified = 0;
    let updatedCount = 0;

    if (db.history && db.history.length > 0) {
      const newHistory = [];
      const downloadPath = db.settings.downloadPath || _deps.defaultDownloadDir;
      const diskMap = buildVideoFilesMap(downloadPath);

      for (const item of db.history) {
        if (item.isFakap || String(item.id || '').startsWith('fakap_')) {
          newHistory.push(item);
          continue;
        }
        if (item.status === 'completed' || item.status === 'downloaded') {
          let diskFile = diskMap.get(item.id);
          if (!diskFile && item.filePath && fs.existsSync(item.filePath)) {
            diskFile = item.filePath;
          }

          if (diskFile && fs.existsSync(diskFile)) {
            totalVerified++;
            try {
              if (item.filePath !== diskFile) {
                item.filePath = diskFile;
                dbUpdated = true;
                updatedCount++;
              }

              let fileSizeBytes = 0;
              try {
                const stat = fs.statSync(diskFile);
                fileSizeBytes = stat.size || 0;
              } catch (stErr) {
                fileSizeBytes = 0;
              }

              if (fileSizeBytes === 0) {
                if (item.fileCorrupted !== true || item.fileMissing !== true) {
                  item.fileCorrupted = true;
                  item.fileMissing = true;
                  item.fileSize = '0 MB';
                  dbUpdated = true;
                  updatedCount++;
                }
              } else {
                let formattedSize = '';
                if (fileSizeBytes >= 1024 * 1024 * 1024) {
                  formattedSize = Math.round(fileSizeBytes / (1024 * 1024 * 1024)) + ' GB';
                } else {
                  formattedSize = Math.round(fileSizeBytes / (1024 * 1024)) + ' MB';
                }

                if (formattedSize && item.fileSize !== formattedSize) {
                  item.fileSize = formattedSize;
                  dbUpdated = true;
                  updatedCount++;
                }

                if (item.fileMissing === true && item.fileCorrupted !== true) {
                  delete item.fileMissing;
                  dbUpdated = true;
                  updatedCount++;
                }
              }

              const shouldProbe = (mode === 'full') || (mode === 'smart' && (!item.actualQuality || item.actualQuality === ''));
              if (shouldProbe && fileSizeBytes > 0) {
                const res = getVideoResolution(diskFile);
                if (res) {
                  if (item.actualQuality !== res) {
                    item.actualQuality = res;
                    dbUpdated = true;
                    updatedCount++;
                  }
                  if (item.fileCorrupted === true) {
                    delete item.fileCorrupted;
                    delete item.fileMissing;
                    dbUpdated = true;
                    updatedCount++;
                  }
                } else if (item.fileCorrupted !== true) {
                  item.fileCorrupted = true;
                  item.fileMissing = true;
                  dbUpdated = true;
                  updatedCount++;
                }
              }
              newHistory.push(item);
            } catch (err) {
              newHistory.push(item);
            }
          } else {
            if (item.fileMissing !== true) {
              item.fileMissing = true;
              dbUpdated = true;
              updatedCount++;
            }
            newHistory.push(item);
          }
        } else {
          newHistory.push(item);
        }
      }

      if (dbUpdated) {
        const freshDb = _deps.readDb();
        freshDb.history = newHistory;
        _deps.writeDb(freshDb);
        broadcast('db_update', freshDb);
      }
    }

    let modeLabel = 'Hızlı Mod';
    if (mode === 'full') modeLabel = 'Tam FFprobe Modu';
    else if (mode === 'smart') modeLabel = 'Akıllı FFprobe Modu';

    const summaryMsg = `Disk senkronizasyonu tamamlandı (${modeLabel}): ${totalVerified} video doğrulandı, ${updatedCount} kayıt güncellendi.`;

    if (forceManual || updatedCount > 0) {
      addTerminalLog(`[Disk Sync] ${summaryMsg}`, 'success');
      broadcast('status_log', { message: summaryMsg, type: 'success' });
    } else {
      console.log(`[Disk Sync] ${summaryMsg}`);
    }

    return {
      success: true,
      totalVerified,
      updatedCount,
      message: summaryMsg
    };
  } catch (err) {
    console.error('[Disk Sync Performance Error]', err.message);
    addTerminalLog(`[Disk Sync Error] ${err.message}`, 'error');
    return { success: false, error: err.message };
  }
}

/**
 * İndirme klasörü altındaki tüm alt dizinlerde verilen video ID'sine sahip
 * dosyayı özyinelemeli (recursive) olarak arar. Sistem klasörlerini ve derin yolları atlar.
 *
 * @param {string} videoId
 * @param {string} downloadPath
 * @returns {string|null}
 */
export function findVideoFileInDownloadDir(videoId, downloadPath) {
  try {
    if (!fs.existsSync(downloadPath)) return null;
    const targetPattern = `[${videoId}]`;
    const ignoredFolders = ['$recycle.bin', 'system volume information', '.git', 'node_modules', 'temp', '0nogithub', 'scratch', 'backup'];

    function searchDir(dir, depth = 0) {
      if (depth > 3) return null;
      const folderName = path.basename(dir).toLowerCase();
      if (ignoredFolders.includes(folderName) || folderName.startsWith('.')) return null;

      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          const entryLower = entry.name.toLowerCase();
          if (ignoredFolders.includes(entryLower) || entryLower.startsWith('.')) continue;
          if (isInsideFakap(fullPath)) continue;
          const result = searchDir(fullPath, depth + 1);
          if (result) return result;
        } else {
          if (entry.name.includes(targetPattern)) {
            const ext = path.extname(entry.name).toLowerCase();
            if (!['.jpg', '.jpeg', '.webp', '.png', '.json', '.temp', '.part', '.ytdl', '.srt', '.vtt', '.description'].includes(ext)) {
              return fullPath;
            }
          }
        }
      }
      return null;
    }

    return searchDir(downloadPath, 0);
  } catch (e) {
    console.error(`Error searching recursively for video ${videoId} in ${downloadPath}:`, e.message);
  }
  return null;
}

/**
 * Yeni bir video geçmişi (history) kaydı oluşturur.
 */
export function createHistoryItem(videoId, title, channelId, channelName, publishedAt, duration, settings) {
  const downloadPath = settings.downloadPath || _deps.defaultDownloadDir;
  const foundPath = findVideoFileInDownloadDir(videoId, downloadPath);

  let status = 'ignored';
  let filePath = '';
  let fileSize = '';
  let progress = 0;

  if (foundPath) {
    status = 'completed';
    filePath = foundPath;
    progress = 100;
    try {
      const stats = fs.statSync(foundPath);
      const sizeInBytes = stats.size;
      if (sizeInBytes >= 1024 * 1024 * 1024) {
        fileSize = Math.round(sizeInBytes / (1024 * 1024 * 1024)) + ' GB';
      } else {
        fileSize = Math.round(sizeInBytes / (1024 * 1024)) + ' MB';
      }
    } catch (err) {}
  }

  return {
    id: videoId,
    title: title,
    channelId: channelId,
    channelName: channelName,
    downloadedAt: new Date().toISOString(),
    publishedAt: publishedAt || '',
    status: status,
    progress: progress,
    fileSize: fileSize,
    filePath: filePath,
    duration: duration || ''
  };
}

/**
 * Verilen süre dizesini ('SS', 'DD:SS', 'SS:DD:SS') saniyeye çevirerek limite göre kontrol eder.
 */
export function isShortDuration(durationStr, limit = 180) {
  if (!durationStr) return false;

  const parts = durationStr.split(':').map(Number);
  let totalSeconds = 0;

  if (parts.length === 1) {
    totalSeconds = parts[0];
  } else if (parts.length === 2) {
    totalSeconds = (parts[0] * 60) + parts[1];
  } else if (parts.length === 3) {
    totalSeconds = (parts[0] * 3600) + (parts[1] * 60) + parts[2];
  }

  return totalSeconds <= limit;
}
