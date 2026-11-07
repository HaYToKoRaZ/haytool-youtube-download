// Türkçe Açıklama: Oyun / Erteleme modunda ham olarak indirilen ses ve görüntü akışlarını kullanıcı onayıyla (tekli, seçili veya tümü sırayla) FFmpeg üzerinden birleştiren ve dönüştüren bağımsız kuyruk servisi.
import fs from 'fs';
import path from 'path';
import { spawn, exec } from 'child_process';
import {
  readDb,
  updateHistoryItem,
  defaultDownloadDir
} from '../database.js';
import { broadcast, addTerminalLog } from './sse.js';
import {
  testFfmpegSync,
  getFfmpegPath,
  detectHwaccel,
  getVideoResolution,
  getVideoDurationFromFile
} from './paths.js';
import { playAppSound } from './soundService.js';
import { showWindowsNotification } from './downloader.js';

const AUDIO_ONLY_EXTS = new Set(['.m4a', '.aac', '.opus', '.ogg', '.mp3', '.flac', '.wav', '.weba']);
const NON_MEDIA_EXTS = new Set(['.jpg', '.jpeg', '.webp', '.png', '.json', '.temp', '.part', '.ytdl', '.srt', '.vtt', '.description', '.txt']);

/**
 * Dizin gezintisi (Path Traversal) saldırılarını önlemek için video kimliğini güvenli dosya adına dönüştürür.
 * @param {string} videoId
 * @returns {string}
 */
export function sanitizeStagingId(videoId) {
  const safe = String(videoId || '').replace(/[^a-zA-Z0-9_-]/g, '_');
  if (!safe || safe === '.' || safe === '..') {
    throw new Error('Geçersiz video kimliği.');
  }
  return safe;
}

/**
 * Belirtilen indirme kök dizini altındaki gizli bekleyen birleştirme klasörünü döner.
 * @param {string} baseDir
 * @returns {string}
 */
export function getPendingMergeRoot(baseDir) {
  const root = (baseDir && String(baseDir).trim()) ? baseDir : defaultDownloadDir;
  return path.join(root, '.pending_merge');
}

/**
 * Belirli bir videonun ham parçalarının tutulduğu izole klasör yolunu döner.
 * @param {string} baseDir
 * @param {string} videoId
 * @returns {string}
 */
export function getItemStagingDir(baseDir, videoId) {
  return path.join(getPendingMergeRoot(baseDir), sanitizeStagingId(videoId));
}

function formatByteSize(sizeInBytes) {
  if (!sizeInBytes || sizeInBytes <= 0) return '';
  if (sizeInBytes >= 1024 * 1024 * 1024) {
    return (sizeInBytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
  }
  return Math.max(1, Math.round(sizeInBytes / (1024 * 1024))) + ' MB';
}

function parseFfmpegTimeSeconds(line) {
  const m = line.match(/time=(\d{2}):(\d{2}):(\d{2}(?:\.\d+)?)/);
  if (!m) return null;
  return parseInt(m[1], 10) * 3600 + parseInt(m[2], 10) * 60 + parseFloat(m[3]);
}

function cleanupEmptyPendingRoot(stagingDir) {
  try {
    const parentRoot = path.dirname(stagingDir);
    if (path.basename(parentRoot) === '.pending_merge' && fs.existsSync(parentRoot)) {
      const remaining = fs.readdirSync(parentRoot);
      if (remaining.length === 0) {
        fs.rmdirSync(parentRoot);
      }
    }
  } catch (_) {}
}

class MergeQueue {
  constructor() {
    this.queue = [];
    this.activeJob = null; // { id, process, cancelled }
    this.isPaused = false;
    this.totalBatchCount = 0;
    this.completedBatchCount = 0;
  }

  getStatusSnapshot() {
    return {
      isRunning: Boolean(this.activeJob),
      isPaused: this.isPaused,
      activeVideoId: this.activeJob ? this.activeJob.id : null,
      queuedIds: this.queue.slice(),
      totalBatchCount: this.totalBatchCount,
      completedBatchCount: this.completedBatchCount
    };
  }

  /**
   * Bekleyen birleştirme işlerini sıraya ekler ve ardışık (concurrency = 1) olarak başlatır.
   * @param {'all' | string[]} targetIds
   * @returns {{ added: number, activeVideoId: string|null, queuedCount: number }}
   */
  enqueue(targetIds = 'all') {
    const db = readDb();
    const history = Array.isArray(db.history) ? db.history : [];
    let candidates = [];

    if (targetIds === 'all') {
      candidates = history
        .filter(h => h.status === 'pending_merge')
        .map(h => h.id);
    } else if (Array.isArray(targetIds)) {
      const wanted = new Set(targetIds.map(String));
      candidates = history
        .filter(h => wanted.has(String(h.id)) && h.status === 'pending_merge')
        .map(h => h.id);
    }

    let added = 0;
    for (const id of candidates) {
      if (this.activeJob && this.activeJob.id === id) continue;
      if (!this.queue.includes(id)) {
        this.queue.push(id);
        added++;
      }
    }

    if (!this.activeJob && added > 0) {
      this.totalBatchCount = this.queue.length;
      this.completedBatchCount = 0;
    } else if (added > 0) {
      this.totalBatchCount += added;
    }

    this.isPaused = false;
    broadcast('merge_queue_state', this.getStatusSnapshot());
    this.processNext();

    return {
      added,
      activeVideoId: this.activeJob ? this.activeJob.id : null,
      queuedCount: this.queue.length
    };
  }

  /**
   * Oyun modu kapatıldığında bekleyen tüm işleri otomatik olarak sırayla birleştirir.
   */
  startAllAutoIfIdle() {
    const db = readDb();
    const hasPending = Array.isArray(db.history) && db.history.some(h => h.status === 'pending_merge');
    if (!hasPending) return { added: 0 };
    addTerminalLog('[Birleştirme Kuyruğu] Oyun modu kapatıldı — bekleyen videolar sırayla birleştiriliyor.', 'info');
    return this.enqueue('all');
  }

  /**
   * Sıradaki birleştirmeleri duraklatır (aktif birleştirme bozulmaması için temizce tamamlanır veya isteğe bağlı kesilir).
   */
  pause(abortActive = false) {
    this.isPaused = true;
    this.queue = [];
    if (abortActive && this.activeJob && this.activeJob.process) {
      this.activeJob.abortedToPending = true;
      this._killProcess(this.activeJob.process);
    }
    broadcast('merge_queue_state', this.getStatusSnapshot());
    addTerminalLog('[Birleştirme Kuyruğu] Sıralı birleştirme duraklatıldı.', 'warning');
  }

  /**
   * Bekleyen bir videoyu birleştirme kuyruğundan çıkarır ve ham geçici dosyalarını siler.
   * @param {string} videoId
   */
  cancelItem(videoId) {
    const id = String(videoId || '');
    if (!id) return false;

    this.queue = this.queue.filter(qId => qId !== id);

    if (this.activeJob && this.activeJob.id === id) {
      this.activeJob.cancelled = true;
      if (this.activeJob.process) {
        this._killProcess(this.activeJob.process);
      }
    }

    const db = readDb();
    const item = db.history ? db.history.find(h => h.id === id) : null;
    const baseDir = item && item.isFakap
      ? ((db.settings.fakapPath || '').trim() || path.join(db.settings.downloadPath || defaultDownloadDir, 'Fakap'))
      : (db.settings?.downloadPath || defaultDownloadDir);

    const stagingCandidates = new Set();
    if (item && item.stagingDir) stagingCandidates.add(item.stagingDir);
    try {
      stagingCandidates.add(getItemStagingDir(baseDir, id));
    } catch (_) {}

    for (const dir of stagingCandidates) {
      try {
        if (dir && fs.existsSync(dir)) {
          fs.rmSync(dir, { recursive: true, force: true });
          cleanupEmptyPendingRoot(dir);
        }
      } catch (_) {}
    }

    if (item && (item.status === 'pending_merge' || item.status === 'merging_deferred')) {
      updateHistoryItem(id, {
        status: 'ignored',
        progress: 0,
        speed: '',
        eta: '',
        stagingDir: '',
        error: 'Birleştirme kullanıcı tarafından iptal edildi.'
      });
    }

    broadcast('merge_queue_state', this.getStatusSnapshot());
    broadcast('db_update', readDb());
    return true;
  }

  _killProcess(proc) {
    try {
      if (!proc || !proc.pid) return;
      if (process.platform === 'win32') {
        exec(`taskkill /pid ${proc.pid} /T /F`);
      } else {
        proc.kill('SIGKILL');
      }
    } catch (_) {}
  }

  async processNext() {
    if (this.isPaused || this.activeJob) return;
    if (this.queue.length === 0) {
      this.totalBatchCount = 0;
      this.completedBatchCount = 0;
      broadcast('merge_queue_state', this.getStatusSnapshot());
      return;
    }

    const nextId = this.queue.shift();
    const db = readDb();
    const item = db.history ? db.history.find(h => h.id === nextId) : null;
    if (!item || item.status !== 'pending_merge') {
      return this.processNext();
    }

    if (!testFfmpegSync()) {
      const msg = db.settings?.lang === 'en'
        ? 'FFmpeg is not installed. Cannot merge pending streams.'
        : 'FFmpeg kurulu olmadığı için bekleyen akışlar birleştirilemiyor.';
      addTerminalLog(`[Birleştirme Kuyruğu] ${msg}`, 'error');
      broadcast('status_log', { message: msg, type: 'error' });
      this.queue = [];
      broadcast('merge_queue_state', this.getStatusSnapshot());
      return;
    }

    this.activeJob = {
      id: nextId,
      process: null,
      cancelled: false,
      abortedToPending: false
    };
    broadcast('merge_queue_state', this.getStatusSnapshot());

    try {
      await this._executeMerge(item, db.settings || {});
    } catch (err) {
      console.error(`[Birleştirme Kuyruğu Hatası] (${item.title}):`, err);
      if (!this.activeJob?.cancelled && !this.activeJob?.abortedToPending) {
        updateHistoryItem(item.id, {
          status: 'pending_merge',
          error: err.message || 'Birleştirme sırasında hata oluştu.'
        });
        addTerminalLog(`[Birleştirme Kuyruğu] "${item.title}" birleştirilemedi (ham dosyalar korundu): ${err.message}`, 'error');
      }
    } finally {
      const wasAborted = this.activeJob?.abortedToPending;
      const wasCancelled = this.activeJob?.cancelled;
      this.activeJob = null;
      if (!wasAborted && !wasCancelled) {
        this.completedBatchCount++;
      }
      broadcast('merge_queue_state', this.getStatusSnapshot());
      broadcast('db_update', readDb());
      if (!this.isPaused) {
        setImmediate(() => this.processNext());
      }
    }
  }

  async _executeMerge(item, settings) {
    const baseDir = item.isFakap
      ? ((settings.fakapPath || '').trim() || path.join(settings.downloadPath || defaultDownloadDir, 'Fakap'))
      : (settings.downloadPath || defaultDownloadDir);

    const stagingDir = (item.stagingDir && fs.existsSync(item.stagingDir))
      ? item.stagingDir
      : getItemStagingDir(baseDir, item.id);

    if (!fs.existsSync(stagingDir)) {
      updateHistoryItem(item.id, {
        status: 'failed',
        error: settings.lang === 'en' ? 'Pending stream files not found on disk.' : 'Bekleyen ham video parçaları diskte bulunamadı.'
      });
      return;
    }

    let manifest = null;
    const manifestPath = path.join(stagingDir, 'manifest.json');
    if (fs.existsSync(manifestPath)) {
      try {
        manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      } catch (_) {}
    }

    const allFiles = fs.readdirSync(stagingDir).filter(f => f !== 'manifest.json' && !f.startsWith('_merged_out'));
    const mediaFiles = allFiles.filter(f => !NON_MEDIA_EXTS.has(path.extname(f).toLowerCase()));
    const companionFiles = allFiles.filter(f => {
      const ext = path.extname(f).toLowerCase();
      return ['.srt', '.vtt', '.description', '.jpg', '.jpeg', '.webp', '.png'].includes(ext);
    });

    if (mediaFiles.length === 0) {
      throw new Error(settings.lang === 'en' ? 'No media streams found in staging directory.' : 'Geçici klasörde birleştirilecek medya akışı bulunamadı.');
    }

    const isMp3 = Boolean(
      manifest?.isMp3 ||
      manifest?.targetQuality === 'mp3' ||
      item.targetFormat === 'MP3' ||
      item.customFormat === 'audio-mp3' ||
      item.quality === 'mp3'
    );
    const outputDir = manifest?.outputDir || (item.skipChannelFolder ? baseDir : path.join(baseDir, item.channelName || '0-Unfollowed'));
    const ytVideoId = manifest?.ytVideoId || item.originalId || String(item.id).replace(/^fakap_/, '');

    // Çıktı temel dosya adını ham akış dosyasından güvenli şekilde türet
    const primaryRaw = mediaFiles[0];
    const primaryExt = path.extname(primaryRaw);
    const baseWithoutExt = path.basename(primaryRaw, primaryExt);
    const cleanStem = baseWithoutExt.replace(/\.f[a-zA-Z0-9_-]+$/, '');
    const finalExt = isMp3 ? '.mp3' : '.mp4';
    const finalFilename = `${cleanStem}${finalExt}`;
    const tempMergedPath = path.join(stagingDir, `_merged_out${finalExt}`);

    updateHistoryItem(item.id, {
      status: 'merging_deferred',
      progress: 0,
      error: ''
    });
    broadcast('db_update', readDb());
    addTerminalLog(`[Birleştirme Kuyruğu] Birleştiriliyor: "${item.title}"`, 'info');

    const ffmpegBin = getFfmpegPath();

    if (isMp3) {
      const audioSrc = path.join(stagingDir, mediaFiles[0]);
      const bitrate = String(manifest?.audioBitrate || '192').replace(/[^0-9]/g, '') || '192';
      const durationInfo = getVideoDurationFromFile(audioSrc);
      const totalSec = durationInfo?.durationSeconds || 0;

      // Kapak resmi varsa JPG'e çevirip gömmeyi dene
      let coverJpgPath = null;
      const thumbRaw = companionFiles.find(f => ['.jpg', '.jpeg', '.png', '.webp'].includes(path.extname(f).toLowerCase()));
      if (thumbRaw) {
        const srcThumb = path.join(stagingDir, thumbRaw);
        if (['.jpg', '.jpeg'].includes(path.extname(thumbRaw).toLowerCase())) {
          coverJpgPath = srcThumb;
        } else {
          const convertedJpg = path.join(stagingDir, `${cleanStem}.jpg`);
          const okThumb = await this._runFfmpeg(ffmpegBin, ['-y', '-i', srcThumb, convertedJpg], 0, item.id);
          if (okThumb && fs.existsSync(convertedJpg)) {
            coverJpgPath = convertedJpg;
          }
        }
      }

      let mp3Ok = false;
      if (coverJpgPath && fs.existsSync(coverJpgPath)) {
        mp3Ok = await this._runFfmpeg(ffmpegBin, [
          '-y', '-i', audioSrc, '-i', coverJpgPath,
          '-map', '0:a:0', '-map', '1:v:0',
          '-c:a', 'libmp3lame', '-b:a', `${bitrate}k`,
          '-c:v', 'mjpeg', '-id3v2_version', '3',
          '-metadata:s:v', 'title=Album cover',
          tempMergedPath
        ], totalSec, item.id);
      }
      if (!mp3Ok) {
        mp3Ok = await this._runFfmpeg(ffmpegBin, [
          '-y', '-i', audioSrc,
          '-vn', '-c:a', 'libmp3lame', '-b:a', `${bitrate}k`,
          tempMergedPath
        ], totalSec, item.id);
      }

      if (!mp3Ok) {
        this._handleInterruptionOrThrow(tempMergedPath, 'MP3 dönüştürme işlemi başarısız oldu.');
        return;
      }
    } else if (mediaFiles.length >= 2) {
      // Video ve ses dosyasını ayırt et
      let videoFile = null;
      let audioFile = null;

      for (const f of mediaFiles) {
        const full = path.join(stagingDir, f);
        const ext = path.extname(f).toLowerCase();
        if (AUDIO_ONLY_EXTS.has(ext) && !audioFile) {
          audioFile = full;
        }
      }

      const remaining = mediaFiles.map(f => path.join(stagingDir, f)).filter(full => full !== audioFile);
      if (audioFile && remaining.length >= 1) {
        videoFile = remaining[0];
      } else {
        // İkisi de .webm veya .mp4 ise çözünürlük/boyut kontrolü ile ayır
        const inspected = mediaFiles.map(f => {
          const full = path.join(stagingDir, f);
          const res = getVideoResolution(full);
          let size = 0;
          try { size = fs.statSync(full).size; } catch (_) {}
          return { full, hasVideo: Boolean(res), size };
        });
        const withVid = inspected.find(x => x.hasVideo);
        const withoutVid = inspected.find(x => !x.hasVideo);
        if (withVid && withoutVid) {
          videoFile = withVid.full;
          audioFile = withoutVid.full;
        } else {
          inspected.sort((a, b) => b.size - a.size);
          videoFile = inspected[0].full;
          audioFile = inspected[1].full;
        }
      }

      const durationInfo = getVideoDurationFromFile(videoFile);
      const totalSec = durationInfo?.durationSeconds || 0;
      const audioExt = path.extname(audioFile).toLowerCase();
      const canCopyAudio = ['.m4a', '.aac', '.mp4'].includes(audioExt);
      const audioCodecArgs = canCopyAudio ? ['-c:a', 'copy'] : ['-c:a', 'aac', '-b:a', '192k'];

      // 1. Deneme: Kayıpsız ve çok hızlı akış birleştirme (-c:v copy)
      let mergeOk = await this._runFfmpeg(ffmpegBin, [
        '-y',
        '-i', videoFile,
        '-i', audioFile,
        '-map', '0:v:0',
        '-map', '1:a:0',
        '-c:v', 'copy',
        ...audioCodecArgs,
        '-movflags', '+faststart',
        tempMergedPath
      ], totalSec, item.id);

      // 2. Deneme: Konteyner uyuşmazlığı varsa donanım hızlandırmalı kodlamaya düş
      if (!mergeOk && !this.activeJob?.cancelled && !this.activeJob?.abortedToPending) {
        const { encoder: vEncoder, extra: vExtra } = this._resolveVideoEncoder(settings);
        addTerminalLog(`[Birleştirme Kuyruğu] Kayıpsız kopyalama uyumsuz oldu, GPU/Donanım hızlandırmalı (${vEncoder}) ile dönüştürülüyor: "${item.title}"`, 'warning');
        mergeOk = await this._runFfmpeg(ffmpegBin, [
          '-y',
          '-i', videoFile,
          '-i', audioFile,
          '-map', '0:v:0',
          '-map', '1:a:0',
          '-c:v', vEncoder,
          ...vExtra,
          '-c:a', 'aac', '-b:a', '192k',
          '-movflags', '+faststart',
          tempMergedPath
        ], totalSec, item.id);
      }

      if (!mergeOk) {
        this._handleInterruptionOrThrow(tempMergedPath, 'FFmpeg ses/görüntü birleştirme işlemi başarısız oldu.');
        return;
      }
    } else {
      // Tek akışlı ancak .webm/.mkv/.ts uzantılı dosya -> .mp4 konteynerine hızlı aktar
      const singleSrc = path.join(stagingDir, mediaFiles[0]);
      const durationInfo = getVideoDurationFromFile(singleSrc);
      const totalSec = durationInfo?.durationSeconds || 0;
      const singleOk = await this._runFfmpeg(ffmpegBin, [
        '-y',
        '-i', singleSrc,
        '-c:v', 'copy',
        '-c:a', 'aac', '-b:a', '192k',
        '-movflags', '+faststart',
        tempMergedPath
      ], totalSec, item.id);

      if (!singleOk) {
        this._handleInterruptionOrThrow(tempMergedPath, 'Tekil medya akışı MP4 formatına aktarılamadı.');
        return;
      }
    }

    // İsteğe bağlı küçük resim (.webp -> .jpg) dönüşümü
    if (manifest?.writeThumbnail && !isMp3) {
      const rawThumb = companionFiles.find(f => ['.webp', '.png'].includes(path.extname(f).toLowerCase()));
      if (rawThumb) {
        const srcThumb = path.join(stagingDir, rawThumb);
        const jpgOut = path.join(stagingDir, `${cleanStem}.jpg`);
        const okJpg = await this._runFfmpeg(ffmpegBin, ['-y', '-i', srcThumb, jpgOut], 0, item.id);
        if (okJpg && fs.existsSync(jpgOut)) {
          try { fs.unlinkSync(srcThumb); } catch (_) {}
        }
      }
    }

    if (!fs.existsSync(tempMergedPath) || fs.statSync(tempMergedPath).size < 512) {
      throw new Error('Birleştirilen çıktı dosyası doğrulanamadı.');
    }

    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const finalOutputPath = path.join(outputDir, finalFilename);
    this._moveFileCrossSafe(tempMergedPath, finalOutputPath);

    // Yan dosyaları (.srt, .vtt, .description, .jpg) hedef klasöre taşı
    const postFiles = fs.readdirSync(stagingDir);
    for (const f of postFiles) {
      const ext = path.extname(f).toLowerCase();
      if (['.srt', '.vtt', '.description', '.jpg', '.jpeg'].includes(ext)) {
        // .fXXX kalıntısı olmayan yan dosyaları taşı
        const destCompanion = path.join(outputDir, f);
        try {
          this._moveFileCrossSafe(path.join(stagingDir, f), destCompanion);
        } catch (_) {}
      }
    }

    const stats = fs.statSync(finalOutputPath);
    const calculatedSize = formatByteSize(stats.size);
    const actualQuality = !isMp3 ? getVideoResolution(finalOutputPath) : null;
    const actualDurationInfo = getVideoDurationFromFile(finalOutputPath);

    // Çıktı doğrulandı, geçici ham klasörü tamamen temizle
    try {
      fs.rmSync(stagingDir, { recursive: true, force: true });
      cleanupEmptyPendingRoot(stagingDir);
    } catch (_) {}

    const resolvedTitle = manifest?.title || item.title;
    updateHistoryItem(item.id, {
      status: 'completed',
      progress: 100,
      filePath: finalOutputPath,
      title: resolvedTitle,
      speed: '',
      eta: '',
      stagingDir: '',
      error: '',
      fileSize: calculatedSize,
      ...(actualQuality ? { actualQuality } : {}),
      ...(actualDurationInfo ? { duration: actualDurationInfo.duration, durationSeconds: actualDurationInfo.durationSeconds } : {})
    });

    broadcast('merge_progress', {
      id: item.id,
      progress: 100,
      status: 'completed',
      ytVideoId
    });
    broadcast('status_log', {
      message: settings.lang === 'en'
        ? `Merge completed: ${resolvedTitle}`
        : `Birleştirme tamamlandı: ${resolvedTitle}`,
      type: 'success',
      thumbnail: `/api/video/${item.id}/thumbnail`
    });
    addTerminalLog(`[Birleştirme Kuyruğu] TAMAMLANDI: "${resolvedTitle}" -> ${finalOutputPath}`, 'success');

    // Video indirme ve birleştirme süreci tamamen bittiğinde kullanıcıya indirme tamamlandı bildirimi verilir
    playAppSound('download_complete');
    showWindowsNotification(
      settings.lang === 'en' ? 'Download Completed' : 'İndirme Tamamlandı',
      settings.lang === 'en' ? `"${resolvedTitle}" downloaded successfully.` : `"${resolvedTitle}" videosu başarıyla indirildi.`,
      'download_complete',
      {
        videoId: item.id || ytVideoId || '',
        channelName: item.channelName || '',
        thumbnail: item.thumbnail || (ytVideoId ? `https://i.ytimg.com/vi/${ytVideoId}/hqdefault.jpg` : '')
      }
    );
  }

  _handleInterruptionOrThrow(tempMergedPath, errorMsg) {
    try {
      if (fs.existsSync(tempMergedPath)) fs.unlinkSync(tempMergedPath);
    } catch (_) {}

    if (this.activeJob?.cancelled) {
      return;
    }
    if (this.activeJob?.abortedToPending) {
      updateHistoryItem(this.activeJob.id, {
        status: 'pending_merge',
        progress: 100,
        error: ''
      });
      return;
    }
    throw new Error(errorMsg);
  }

  _resolveVideoEncoder(settings) {
    const hwMode = settings.hardwareAcceleration || 'auto';
    const hwInfo = detectHwaccel();
    const effectiveHw = (hwMode === 'auto') ? hwInfo.recommended : hwMode;
    if (effectiveHw === 'nvenc' || hwInfo.nvenc || hwMode === 'nvenc') return { encoder: 'h264_nvenc', extra: ['-preset', 'p5', '-cq', '22'] };
    if (effectiveHw === 'qsv' && (hwInfo.qsv || hwMode === 'qsv')) return { encoder: 'h264_qsv', extra: ['-preset', 'fast'] };
    if (effectiveHw === 'amf' && (hwInfo.amf || hwMode === 'amf')) return { encoder: 'h264_amf', extra: ['-quality', 'speed'] };
    return { encoder: 'libx264', extra: ['-preset', 'veryfast', '-crf', '22'] };
  }

  _moveFileCrossSafe(src, dest) {
    try {
      if (fs.existsSync(dest)) fs.unlinkSync(dest);
      fs.renameSync(src, dest);
    } catch (_) {
      fs.copyFileSync(src, dest);
      fs.unlinkSync(src);
    }
  }

  _runFfmpeg(ffmpegBin, args, totalDurationSec, videoId) {
    return new Promise((resolve) => {
      const proc = spawn(ffmpegBin, args, {
        stdio: ['ignore', 'ignore', 'pipe'],
        windowsHide: true
      });

      if (this.activeJob && this.activeJob.id === videoId) {
        this.activeJob.process = proc;
      }

      let lastBroadcastPct = -1;
      proc.stderr.on('data', (chunk) => {
        if (!totalDurationSec || totalDurationSec <= 0) return;
        const text = chunk.toString();
        const curSec = parseFfmpegTimeSeconds(text);
        if (curSec !== null) {
          const pct = Math.min(99, Math.max(1, Math.round((curSec / totalDurationSec) * 100)));
          if (pct !== lastBroadcastPct) {
            lastBroadcastPct = pct;
            broadcast('merge_progress', {
              id: videoId,
              progress: pct,
              status: 'merging_deferred'
            });
          }
        }
      });

      proc.on('error', () => resolve(false));
      proc.on('close', (code) => resolve(code === 0));
    });
  }
}

export const mergeQueue = new MergeQueue();
