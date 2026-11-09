// Türkçe Açıklama: IPTV canlı yayınları için arka planda FFmpeg ile kesintisiz doğrudan kayıt sağlayan servis modülü.
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { getFfmpegPath } from './paths.js';
import { readDb, updateDb, defaultDownloadDir } from '../database.js';
import { broadcast } from './sse.js';
import { dataRootDir } from '../config.js';

// Slot başına aktif PVR oturumları (0, 1, 2, 3)
const activePvrSessions = new Map();

/**
 * Dosya adındaki geçersiz karakterleri temizler.
 * @param {string} str
 * @returns {string}
 */
function sanitizeFileName(str) {
  return (str || 'IPTV')
    .replace(/[\\/:*?"<>|]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 100);
}

/**
 * Saniye cinsinden süreyi HH:MM:SS formatına dönüştürür.
 * @param {number} totalSeconds
 * @returns {string}
 */
function formatDuration(totalSeconds) {
  const sec = Math.floor(totalSeconds % 60);
  const min = Math.floor((totalSeconds / 60) % 60);
  const hrs = Math.floor(totalSeconds / 3600);
  const pad = (n) => String(n).padStart(2, '0');
  if (hrs > 0) {
    return `${pad(hrs)}:${pad(min)}:${pad(sec)}`;
  }
  return `${pad(min)}:${pad(sec)}`;
}

/**
 * IPTV Slotu için arka planda kesintisiz PVR kaydını başlatır.
 * 
 * @param {number} slotIndex Slot indeksi (0-3)
 * @param {string} streamUrl Canlı yayın URL'si
 * @param {string} channelName Kanal adı
 * @returns {Promise<Object>}
 */
export async function startPvr(slotIndex, streamUrl, channelName) {
  const slot = parseInt(slotIndex, 10) || 0;
  if (!streamUrl) {
    throw new Error('Yayın URLsi belirtilmedi');
  }

  // Zaten çalışıyorsa önce durdur
  if (activePvrSessions.has(slot)) {
    await stopPvr(slot);
  }

  // İndirme hedef dizini
  let targetDir = defaultDownloadDir;
  try {
    const dbData = readDb();
    if (dbData?.settings?.downloadPath) {
      targetDir = dbData.settings.downloadPath;
    }
  } catch (e) {}

  const iptvTargetDir = path.join(targetDir, '0-IPTV');
  if (!fs.existsSync(iptvTargetDir)) {
    fs.mkdirSync(iptvTargetDir, { recursive: true });
  }

  const cleanName = sanitizeFileName(channelName || `Kanal_${slot + 1}`);
  const now = new Date();
  const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}-${String(now.getMinutes()).padStart(2, '0')}-${String(now.getSeconds()).padStart(2, '0')}`;
  const permanentFileName = `${cleanName}_${dateStr}.mp4`;
  const permanentPath = path.join(iptvTargetDir, permanentFileName);

  const ffmpegPath = getFfmpegPath();

  // Kesintisiz MP4 Kayıt Argümanları:
  // - Video: doğrudan stream kopyalama (-c:v copy)
  // - Ses: standart AAC stereo (-c:a aac -b:a 192k) ile MP2/AC3 uyumsuzluklarını ve malformed AAC bitstream hatalarını önler
  // - movflags frag_keyframe: kesintisiz parça bazlı yazım, süreç aniden kapansa bile dosya bozulmaz
  const args = [
    '-y',
    '-reconnect', '1',
    '-reconnect_streamed', '1',
    '-reconnect_delay_max', '5',
    '-i', streamUrl,
    '-c:v', 'copy',
    '-c:a', 'aac',
    '-b:a', '192k',
    '-movflags', 'frag_keyframe+empty_moov+default_base_moof',
    permanentPath
  ];

  console.log(`[IPTV PVR] Slot ${slot} kaydı başlatılıyor:`, cleanName);

  const ffmpegProc = spawn(ffmpegPath, args, {
    stdio: ['pipe', 'pipe', 'pipe'],
    windowsHide: true
  });

  const session = {
    slotIndex: slot,
    channelName: cleanName,
    streamUrl,
    permanentPath,
    permanentFileName,
    startTime: Date.now(),
    process: ffmpegProc,
    status: 'recording'
  };

  ffmpegProc.stderr.on('data', (data) => {
    const str = data.toString();
    if (str.includes('error') || str.includes('Error')) {
      console.warn(`[IPTV PVR ${slot}] FFmpeg:`, str.slice(0, 160));
    }
  });

  ffmpegProc.on('close', (code) => {
    console.log(`[IPTV PVR ${slot}] FFmpeg kapandı (kod: ${code})`);
    if (activePvrSessions.get(slot)?.process === ffmpegProc) {
      activePvrSessions.delete(slot);
    }
  });

  ffmpegProc.on('error', (err) => {
    console.error(`[IPTV PVR ${slot}] FFmpeg hata:`, err.message);
    if (activePvrSessions.get(slot)?.process === ffmpegProc) {
      activePvrSessions.delete(slot);
    }
  });

  activePvrSessions.set(slot, session);

  broadcast('iptv_pvr_started', {
    slotIndex: slot,
    channelName: cleanName,
    startTime: session.startTime
  });

  return {
    success: true,
    slotIndex: slot,
    channelName: cleanName,
    startTime: session.startTime,
    permanentPath
  };
}

/**
 * IPTV Slotu için PVR kaydını durdurur ve dosyayı İndirilenler/Geçmiş veritabanına ekler.
 * 
 * @param {number} slotIndex
 * @returns {Promise<Object>}
 */
export async function stopPvr(slotIndex) {
  const slot = parseInt(slotIndex, 10) || 0;
  const session = activePvrSessions.get(slot);

  if (!session) {
    return { success: false, message: 'Aktif PVR oturumu bulunamadı' };
  }

  activePvrSessions.delete(slot);
  const proc = session.process;

  // FFmpeg'e 'q' göndererek çıktıyı temiz kapatmasını sağla
  if (proc && !proc.killed) {
    try {
      proc.stdin.write('q\n');
    } catch (e) {}

    await new Promise((resolve) => {
      let timeout = setTimeout(() => {
        try {
          if (!proc.killed) proc.kill('SIGTERM');
        } catch (e) {}
        resolve();
      }, 2500);

      proc.once('close', () => {
        clearTimeout(timeout);
        resolve();
      });
    });
  }

  const durationSec = Math.max(1, Math.round((Date.now() - session.startTime) / 1000));
  const durationStr = formatDuration(durationSec);

  let fileSizeStr = '0 MB';
  let fileSizeBytes = 0;
  const filePath = session.permanentPath;

  if (fs.existsSync(filePath)) {
    try {
      const stats = fs.statSync(filePath);
      fileSizeBytes = stats.size;
      if (fileSizeBytes >= 1024 * 1024 * 1024) {
        fileSizeStr = (fileSizeBytes / (1024 * 1024 * 1024)).toFixed(1) + ' GB';
      } else {
        fileSizeStr = Math.max(1, Math.round(fileSizeBytes / (1024 * 1024))) + ' MB';
      }
    } catch (e) {}
  }

  // Veritabanı Geçmişine (History) ekle
  let historyItem = null;
  if (fs.existsSync(filePath) && fileSizeBytes > 1000) {
    historyItem = {
      id: `iptv_${Date.now()}`,
      title: `[IPTV] ${session.channelName}`,
      channelId: 'iptv_record',
      channelName: session.channelName,
      downloadedAt: new Date().toISOString(),
      publishedAt: new Date(session.startTime).toISOString(),
      status: 'completed',
      progress: 100,
      fileSize: fileSizeStr,
      filePath: filePath,
      duration: durationStr,
      format: 'MP4 (PVR)',
      platform: 'iptv'
    };

    try {
      const freshDb = await updateDb((data) => {
        if (!Array.isArray(data.history)) data.history = [];
        data.history.unshift(historyItem);
        return data;
      });
      if (freshDb) {
        broadcast('db_update', freshDb);
      }
    } catch (err) {
      console.error('[IPTV PVR] Geçmişe ekleme hatası:', err.message);
    }
  }

  // Bildirim gönder
  broadcast('iptv_pvr_stopped', {
    slotIndex: slot,
    channelName: session.channelName,
    filePath,
    duration: durationStr,
    fileSize: fileSizeStr,
    historyItem
  });

  return {
    success: true,
    slotIndex: slot,
    channelName: session.channelName,
    filePath,
    duration: durationStr,
    fileSize: fileSizeStr,
    historyItem
  };
}

/**
 * Aktif PVR oturumunun veya tüm oturumların durumunu döner.
 * @param {number} [slotIndex]
 * @returns {Object}
 */
export function getPvrStatus(slotIndex) {
  if (slotIndex !== undefined && slotIndex !== null && slotIndex !== '') {
    const slot = parseInt(slotIndex, 10);
    const session = activePvrSessions.get(slot);
    if (!session) return { active: false };

    const elapsed = Math.round((Date.now() - session.startTime) / 1000);
    let currentSize = 0;
    try {
      if (fs.existsSync(session.permanentPath)) {
        currentSize = fs.statSync(session.permanentPath).size;
      }
    } catch (e) {}

    return {
      active: true,
      slotIndex: slot,
      channelName: session.channelName,
      startTime: session.startTime,
      elapsedSeconds: elapsed,
      duration: formatDuration(elapsed),
      currentSizeBytes: currentSize
    };
  }

  const list = [];
  for (const [slot, session] of activePvrSessions.entries()) {
    const elapsed = Math.round((Date.now() - session.startTime) / 1000);
    list.push({
      slotIndex: slot,
      channelName: session.channelName,
      startTime: session.startTime,
      elapsedSeconds: elapsed,
      duration: formatDuration(elapsed)
    });
  }
  return { activeSessions: list };
}

// Uygulama kapanırken tüm aktif FFmpeg süreçlerini temizle
process.on('exit', () => {
  for (const session of activePvrSessions.values()) {
    try {
      if (session.process && !session.process.killed) {
        session.process.kill('SIGKILL');
      }
    } catch (e) {}
  }
});
