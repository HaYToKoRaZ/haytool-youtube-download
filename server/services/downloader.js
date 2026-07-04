// Türkçe Açıklama: İndirme işlemlerini sırayla gerçekleştiren kuyruk yapısını (DownloadQueue), bildirim seslerini ve masaüstü bildirimlerini yöneten motor modülü.
import fs from 'fs';
import path from 'path';
import os from 'os';
import { spawn, exec } from 'child_process';
import { 
  readDb, 
  writeDb, 
  acquireDbLock, 
  updateHistoryItem, 
  defaultDownloadDir 
} from '../database.js';
import { broadcast, addTerminalLog } from './sse.js';
import { ytdlpPath, testFfmpegSync, getFfmpegPath } from './paths.js';

// Türkçe Açıklama: İndirmeleri gerçekleştiren yt-dlp motorunun varlığını kontrol eder.
export function ensureYtdlp() {
  return new Promise((resolve, reject) => {
    const filename = os.platform() === 'win32' ? 'yt-dlp.exe' : 'yt-dlp';
    if (fs.existsSync(ytdlpPath)) {
      console.log(`${filename} zaten mevcut.`);
      return resolve(ytdlpPath);
    }
    const err = new Error(`${filename} bulunamadı! Otomatik indirme iptal edildi. Lütfen yt-dlp/ klasörü altına ${filename} dosyasını ekleyin.`);
    console.error(err.message);
    broadcast('status_log', { message: err.message, type: 'error' });
    reject(err);
  });
}

// Türkçe Açıklama: İndirme durumlarına göre Windows işletim sistemine ait ses tiplerini (uyarı, onay vb.) ses kartı üzerinden çalar.
export function playSystemSound(type = 'notification') {
  const db = readDb();
  if (db.settings && db.settings.playSounds === false) return;
  if (os.platform() !== 'win32') return;
  let soundCmd = '[System.Media.SystemSounds]::Asterisk.Play()';
  if (type === 'start') {
    soundCmd = '[System.Media.SystemSounds]::Asterisk.Play()';
  } else if (type === 'success') {
    soundCmd = '[System.Media.SystemSounds]::Question.Play()';
  } else if (type === 'error') {
    soundCmd = '[System.Media.SystemSounds]::Hand.Play()';
  }
  
  exec(`powershell -c "${soundCmd}"`, (err) => {
    if (err) console.error('Sistem sesi çalınamadı:', err.message);
  });
}

// Türkçe Açıklama: Windows işletim sisteminde PowerShell kullanarak masaüstü bildirim balonu gösterir.
export function showWindowsNotification(title, message) {
  const db = readDb();
  if (db.settings && db.settings.showNotifications === false) return;
  if (os.platform() !== 'win32') return;

  const cleanTitle = title.replace(/[’‘]/g, "'").replace(/[“”]/g, '"');
  const cleanMessage = message.replace(/[’‘]/g, "'").replace(/[“”]/g, '"');

  const escapedTitle = cleanTitle.replace(/'/g, "''");
  const escapedMessage = cleanMessage.replace(/'/g, "''");

  const iconPath = path.resolve(process.cwd(), 'icon.ico').replace(/\\/g, '\\\\');

  const psScript = `
    [void] [System.Reflection.Assembly]::LoadWithPartialName('System.Windows.Forms');
    [void] [System.Reflection.Assembly]::LoadWithPartialName('System.Drawing');
    $notification = New-Object System.Windows.Forms.NotifyIcon;
    if (Test-Path '${iconPath}') {
      $notification.Icon = New-Object System.Drawing.Icon('${iconPath}');
    } else {
      $notification.Icon = [System.Drawing.SystemIcons]::Information;
    }
    $notification.BalloonTipTitle = '${escapedTitle}';
    $notification.BalloonTipText = '${escapedMessage}';
    $notification.Visible = $true;
    $notification.ShowBalloonTip(5000);
    Start-Sleep -s 4;
    $notification.Dispose();
  `;

  const base64Script = Buffer.from(psScript, 'utf16le').toString('base64');

  exec(`powershell -NoProfile -NonInteractive -EncodedCommand ${base64Script}`, (err) => {
    if (err) console.error('Windows masaüstü bildirimi gönderilemedi:', err.message);
  });
}

// Türkçe Açıklama: Etkin indirme hız sınırını belirler.
export function getEffectiveSpeedLimit(settings) {
  if (settings.useAlternativeSpeed) {
    return settings.alternativeSpeedLimit || 0;
  }
  return settings.downloadSpeedLimit || 0;
}

export class DownloadQueue {
  constructor() {
    this.queue = [];
    this.activeDownloads = 0;
    this.maxConcurrent = 1;
    this.activeProcesses = new Map(); // videoId -> { process, status, video }
    this.isPaused = false;
  }

  get activeProcess() {
    return this.getActiveDownloadingProcess();
  }

  set activeProcess(val) {
    if (val === null) {
      const activeVideoId = this.getActiveDownloadingVideoId();
      if (activeVideoId) {
        this.activeProcesses.delete(activeVideoId);
      }
    }
  }

  get activeVideoId() {
    return this.getActiveDownloadingVideoId();
  }

  set activeVideoId(val) {
    if (val === null) {
      const activeVideoId = this.getActiveDownloadingVideoId();
      if (activeVideoId) {
        this.activeProcesses.delete(activeVideoId);
      }
    }
  }

  getActiveDownloadingVideoId() {
    for (const [id, item] of this.activeProcesses.entries()) {
      if (item.status === 'downloading') {
        return id;
      }
    }
    return null;
  }

  getActiveDownloadingProcess() {
    for (const [id, item] of this.activeProcesses.entries()) {
      if (item.status === 'downloading') {
        return item.process;
      }
    }
    return null;
  }

  async add(video) {
    if (this.queue.some(item => item.id === video.id)) return;

    const release = await acquireDbLock();
    try {
      const db = readDb();
      
      // Klasör oluşturulmasını sağla
      if (!fs.existsSync(db.settings.downloadPath)) {
        try {
          fs.mkdirSync(db.settings.downloadPath, { recursive: true });
        } catch (err) {
          console.error('İndirme klasörü oluşturulamadı:', err);
        }
      }

      let historyItem = db.history.find(h => h.id === video.id);
      if (!historyItem) {
        historyItem = {
          id: video.id,
          title: video.title,
          channelId: video.channelId,
          channelName: video.channelName,
          downloadedAt: new Date().toISOString(),
          publishedAt: video.publishedAt || new Date().toISOString(),
          status: 'waiting',
          progress: 0,
          speed: '',
          eta: '',
          fileSize: '',
          filePath: '',
          isStandalone: video.isStandalone || false
        };
        db.history.push(historyItem);
        writeDb(db);
      } else {
        historyItem.status = 'waiting';
        historyItem.progress = 0;
        historyItem.speed = '';
        historyItem.eta = '';
        historyItem.downloadedAt = new Date().toISOString();
        if (video.publishedAt) {
          historyItem.publishedAt = video.publishedAt;
        }
        writeDb(db);
      }

      this.queue.push(video);
      broadcast('db_update', readDb());
    } finally {
      release();
    }
    this.process();
  }

  process() {
    if (this.isPaused) {
      console.log('[Kuyruk] Queue paused. Bir sonraki indirme bekliyor.');
      return;
    }

    if (!this.activeProcess && this.activeDownloads > 0) {
      console.log(`[Kuyruk Safety] Aktif süreç bulunamadı, activeDownloads sıfırlanıyor.`);
      this.activeDownloads = 0;
    }

    if (this.activeDownloads >= this.maxConcurrent || this.queue.length === 0) return;

    const nextVideo = this.queue.shift();
    this.activeDownloads++;
    this.download(nextVideo);
  }

  async download(video) {
    try {
      await ensureYtdlp();
    } catch (err) {
      updateHistoryItem(video.id, {
        status: 'failed',
        error: 'yt-dlp motoru yüklenemedi.'
      });
      this.activeDownloads = Math.max(0, this.activeDownloads - 1);
      broadcast('db_update', readDb());
      this.process();
      return;
    }

    const db = readDb();
    const settings = db.settings;

    updateHistoryItem(video.id, { status: 'downloading', progress: 0 });
    broadcast('db_update', readDb());
    playSystemSound('start');
    addTerminalLog(`[Kuyruk] "${video.title}" videosu için indirme süreci başlatıldı.`, 'info');
    showWindowsNotification(
      settings.lang === 'en' ? 'Download Started' : 'İndirme Başlatıldı',
      settings.lang === 'en' ? `"${video.title}" download process has started.` : `"${video.title}" videosunun indirme işlemi başladı.`
    );

    const skipChannelFolder = video.skipChannelFolder === true;
    const outputDir = skipChannelFolder
      ? settings.downloadPath
      : path.join(settings.downloadPath, video.channelName);

    if (!fs.existsSync(outputDir)) {
      try {
        fs.mkdirSync(outputDir, { recursive: true });
      } catch (err) {
        console.error('İndirme klasörü oluşturulamadı:', err);
      }
    }

    const outputTemplate = skipChannelFolder
      ? path.join(outputDir, `%(title)s [${video.id}].%(ext)s`)
      : path.join(outputDir, `${video.channelName} - %(title)s [${video.id}].%(ext)s`);
    
    const isMp3 = (video.customFormat === 'audio-mp3');

    const args = [
      video.url,
      '--no-playlist',
      '--no-mtime',
      '--ignore-errors',
      '--js-runtimes', `node:${process.execPath}`,
      '-o', outputTemplate,
      '--newline',
      '--write-subs',
      '--write-auto-subs',
      '--sub-langs', 'tr,en',
      '--sub-format', 'srt'
    ];

    if (!isMp3) {
      args.push('--write-description');
    }

    if (settings.lang) {
      args.push('--extractor-args', `youtube:lang=${settings.lang}`);
    }

    const effectiveSpeed = getEffectiveSpeedLimit(settings);
    if (effectiveSpeed && effectiveSpeed > 0) {
      args.push('--limit-rate', `${effectiveSpeed}K`);
    }

    if (settings.browser && settings.browser !== 'none') {
      const browserName = settings.browser === 'msedge' ? 'edge' : settings.browser;
      args.push('--cookies-from-browser', browserName);
    }

    const channelConfig = db.channels.find(c => c.id === video.channelId);
    const videoQuality = (channelConfig && channelConfig.quality && channelConfig.quality !== 'default') 
      ? channelConfig.quality 
      : settings.quality;

    const hasWorkingFfmpeg = testFfmpegSync();
    let actualMergeType = settings.mergeType || 'single';

    if (actualMergeType === 'merge' && !hasWorkingFfmpeg) {
      actualMergeType = 'single';
      console.log(`[Warning] FFmpeg is not found or not working. Falling back to 'single' download mode.\n`);
      addTerminalLog(`[Warning] FFmpeg not found or not working. Falling back to single file download (best pre-merged quality).`, 'warning');
    }

    if (video.customFormat) {
      const fmt = video.customFormat;
      if (fmt === 'audio-mp3') {
        const bitrate = video.audioBitrate || '192';
        args.push('-f', 'bestaudio', '--extract-audio', '--audio-format', 'mp3', '--audio-quality', `${bitrate}K`, '--embed-thumbnail');
      } else if (fmt === 'video-best') {
        args.push('-f', 'bestvideo+bestaudio/best');
        args.push('--merge-output-format', 'mp4');
      } else if (fmt === 'video-1080p') {
        args.push('-f', 'bestvideo[height<=1080]+bestaudio/best[height<=1080]/best');
        args.push('--merge-output-format', 'mp4');
      } else if (fmt === 'video-720p') {
        args.push('-f', 'bestvideo[height<=720]+bestaudio/best[height<=720]/best');
        args.push('--merge-output-format', 'mp4');
      } else if (fmt === 'video-480p') {
        args.push('-f', 'best[height<=480]/best');
      } else if (fmt === 'video-360p') {
        args.push('-f', 'best[height<=360]/best');
      } else if (fmt === 'video-240p') {
        args.push('-f', 'best[height<=240]/best');
      } else if (fmt === 'video-144p') {
        args.push('-f', 'best[height<=144]/best');
      }
    } else {
      if (actualMergeType === 'single') {
        if (videoQuality === '1080p') {
          args.push('-f', 'best[height<=1080]/best');
        } else if (videoQuality === '720p') {
          args.push('-f', 'best[height<=720]/best');
        } else {
          args.push('-f', 'best');
        }
      } else if (actualMergeType === 'separate') {
        if (videoQuality === '1080p') {
          args.push('-f', 'bestvideo[height<=1080],bestaudio');
        } else if (videoQuality === '720p') {
          args.push('-f', 'bestvideo[height<=720],bestaudio');
        } else {
          args.push('-f', 'bestvideo,bestaudio');
        }
      } else {
        if (videoQuality === '1080p') {
          args.push('-f', 'bestvideo[height<=1080]+bestaudio/best[height<=1080]/best');
        } else if (videoQuality === '720p') {
          args.push('-f', 'bestvideo[height<=720]+bestaudio/best[height<=720]/best');
        } else {
          args.push('-f', 'bestvideo+bestaudio/best');
        }
        args.push('--merge-output-format', 'mp4');
      }
    }

    if (settings.writeThumbnail || isMp3) {
      args.push('--write-thumbnail');
      if (hasWorkingFfmpeg) {
        args.push('--convert-thumbnails', 'jpg');
      }
    }

    if (hasWorkingFfmpeg) {
      args.push('--ffmpeg-location', path.dirname(getFfmpegPath()));
    }

    console.log(`İndirme başlatılıyor: ${video.title}`);
    console.log(`Komut: yt-dlp ${args.join(' ')}`);

    const spawnOptions = process.platform === 'win32' 
      ? { stdio: ['ignore', 'pipe', 'pipe'] } 
      : { stdio: ['ignore', 'pipe', 'pipe'], detached: true };
    const timeoutDuration = 30 * 60 * 1000;
    const downloadProc = spawn(ytdlpPath, args, spawnOptions);
    
    const timeoutTimer = setTimeout(() => {
      const procInfo = this.activeProcesses.get(video.id);
      if (procInfo && procInfo.process) {
        console.error(`[Zaman Aşımı] "${video.title}" indirme/birleştirme işlemi 30 dakikayı geçtiği için sonlandırılıyor.`);
        addTerminalLog(`[Zaman Aşımı] "${video.title}" işlemi 30 dakikayı geçtiği için otomatik sonlandırıldı.`, 'error');
        
        try {
          if (process.platform === 'win32') {
            exec(`taskkill /pid ${procInfo.process.pid} /T /F`);
          } else {
            process.kill(-procInfo.process.pid);
          }
        } catch (e) {
          procInfo.process.kill();
        }
        
        updateHistoryItem(video.id, {
          status: 'error',
          error: 'İndirme zaman aşımına uğradı (Takıldı).'
        });
        broadcast('db_update', readDb());
      }
    }, timeoutDuration);

    this.activeProcesses.set(video.id, {
      process: downloadProc,
      status: 'downloading',
      video: video,
      timeoutTimer: timeoutTimer
    });

    downloadProc.stdout.on('data', (data) => {
      const output = data.toString();
      
      const lines = output.split(/\r?\n/);
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed) {
          const isProgressSpam = trimmed.includes('[download]') && trimmed.includes('%') && (trimmed.includes('at') || trimmed.includes('ETA'));
          if (!isProgressSpam) {
            let logType = 'info';
            if (trimmed.startsWith('[download]')) logType = 'success';
            else if (trimmed.startsWith('[ffmpeg]') || trimmed.startsWith('[Merger]')) logType = 'warning';
            addTerminalLog(`[yt-dlp] ${trimmed}`, logType);
          }
        }
      }

      const isMergingOutput = output.includes('[Merger]') || 
                              output.includes('[ffmpeg]') || 
                              output.includes('[VideoConvertor]') || 
                              output.includes('[postprocess]') || 
                              output.includes('[ExtractAudio]');
      
      let isProgress100 = false;
      const progressMatch = output.match(/\[download\]\s+(\d+\.\d+)%\s+of/);
      if (progressMatch) {
        const percent = parseFloat(progressMatch[1]);
        if (percent >= 100.0) {
          isProgress100 = true;
        }
      }

      if (isMergingOutput || isProgress100) {
        const procInfo = this.activeProcesses.get(video.id);
        if (procInfo && procInfo.status === 'downloading') {
          procInfo.status = 'merging';
          console.log(`[Kuyruk] "${video.title}" videosunun indirmesi bitti, FFmpeg birleştirme (merge) aşamasına geçildi.`);
          addTerminalLog(`[Kuyruk] "${video.title}" videosunun indirmesi bitti, FFmpeg birleştirme (merge) aşamasına geçildi.`, 'warning');
          
          updateHistoryItem(video.id, {
            status: 'merging',
            progress: 100,
            speed: '',
            eta: ''
          });
          broadcast('db_update', readDb());

          this.activeDownloads = Math.max(0, this.activeDownloads - 1);
          this.process();
        }
      }

      const detailMatch = output.match(/\[download\]\s+(\d+\.\d+)%\s+of\s+([^\s]+)\s+at\s+([^\s]+)\s+ETA\s+([^\s]+)/);
      if (detailMatch) {
        const percent = parseFloat(detailMatch[1]);
        const size = detailMatch[2];
        const speed = detailMatch[3];
        const eta = detailMatch[4];

        const procInfo = this.activeProcesses.get(video.id);
        if (procInfo && procInfo.status === 'downloading') {
          updateHistoryItem(video.id, {
            progress: percent,
            fileSize: size,
            speed: speed,
            eta: eta
          });

          broadcast('progress', {
            id: video.id,
            progress: percent,
            speed: speed,
            eta: eta,
            fileSize: size
          });
        }
      }
    });

    let errorOutput = '';
    let stderrBuffer = '';

    function handleStderrLine(line) {
      const trimmed = line.trim();
      if (!trimmed) return;

      const lowerTrimmed = trimmed.toLowerCase();
      const isFfmpegProgress = lowerTrimmed.startsWith('frame=') || (lowerTrimmed.includes('fps=') && lowerTrimmed.includes('size=') && lowerTrimmed.includes('time='));
      const isFfmpegOpening = lowerTrimmed.includes('opening \'http') || /\[[a-z0-9]+ @ [0-9a-fx]+\] opening/i.test(trimmed);
      const isFfmpegInfo = lowerTrimmed.includes('last message repeated') ||
                           lowerTrimmed.startsWith('input #') ||
                           lowerTrimmed.startsWith('duration:') ||
                           lowerTrimmed.startsWith('program ') ||
                           lowerTrimmed.startsWith('metadata:') ||
                           lowerTrimmed.includes('variant_bitrate') ||
                           lowerTrimmed.includes('stream #') ||
                           lowerTrimmed.includes('stream mapping:') ||
                           lowerTrimmed.startsWith('output #') ||
                           lowerTrimmed.includes('encoder') ||
                           lowerTrimmed.includes('press [q] to stop');
      const isFfmpegConnection = /^\[[a-z0-9#_/.-]+ @ 0x?[0-9a-f]+\]/i.test(trimmed) && (
        lowerTrimmed.includes('cannot reuse') ||
        lowerTrimmed.includes('keepalive') ||
        lowerTrimmed.includes('retry') ||
        lowerTrimmed.includes('http connection')
      );

      const isFfmpegSkip = /^\[[a-z0-9#_/.-]+ @ 0x?[0-9a-f]+\]/i.test(trimmed) && (
        lowerTrimmed.includes('skip') ||
        lowerTrimmed.includes('daterange') ||
        lowerTrimmed.includes('#ext-x-')
      );

      if (isFfmpegProgress || isFfmpegOpening || isFfmpegInfo || isFfmpegConnection || isFfmpegSkip) {
        return;
      }

      const isWarning = trimmed.toLowerCase().includes('warning:') || trimmed.toLowerCase().includes('uyari:');
      if (isWarning) {
        console.log(`yt-dlp uyarı satırı: ${trimmed}`);
        addTerminalLog(`[yt-dlp Uyarı] ${trimmed}`, 'warning');
      } else {
        console.error(`yt-dlp error line: ${trimmed}`);
        addTerminalLog(`[yt-dlp Error] ${trimmed}`, 'error');
      }
    }

    downloadProc.stderr.on('data', (data) => {
      const output = data.toString();
      errorOutput += output;
      stderrBuffer += output;
      
      const lines = stderrBuffer.split(/\r?\n/);
      stderrBuffer = lines.pop();
      
      for (const line of lines) {
        handleStderrLine(line);
      }
    });

    downloadProc.stderr.on('end', () => {
      if (stderrBuffer) {
        handleStderrLine(stderrBuffer);
      }
    });

    downloadProc.on('close', async (code) => {
      const procInfo = this.activeProcesses.get(video.id);
      if (!procInfo) return;

      if (procInfo.timeoutTimer) {
        clearTimeout(procInfo.timeoutTimer);
      }

      this.activeProcesses.delete(video.id);

      if (procInfo.status === 'downloading') {
        this.activeDownloads = Math.max(0, this.activeDownloads - 1);
      }

      const db = readDb();
      const currentItem = db.history.find(h => h.id === video.id);
      const isCancelled = currentItem && currentItem.error === 'Kullanıcı tarafından iptal edildi.';

      if (isCancelled) {
        broadcast('status_log', { message: `İndirme iptal edildi: ${video.title}`, type: 'info', thumbnail: `/api/video/${video.id}/thumbnail` });
        addTerminalLog(`[Kuyruk] İndirme kullanıcı tarafından iptal edildi: "${video.title}"`, 'warning');
        broadcast('db_update', readDb());
        this.process();
        return;
      }

      if (code === 0) {
        let actualPath = '';
        let resolvedTitle = video.title;
        const skipChannelFolder = video.skipChannelFolder === true;
        try {
          const targetDir = skipChannelFolder
            ? settings.downloadPath
            : path.join(settings.downloadPath, video.channelName);
          const files = fs.readdirSync(targetDir);
          const match = files.find(f => {
            if (!f.includes(`[${video.id}]`)) return false;
            const ext = path.extname(f).toLowerCase();
            return !['.jpg', '.jpeg', '.webp', '.png', '.json', '.temp', '.part', '.ytdl', '.srt', '.vtt', '.description'].includes(ext);
          });
          if (match) {
            actualPath = path.join(targetDir, match);
            const baseName = path.basename(match, path.extname(match));
            const idPattern = ` [${video.id}]`;
            if (baseName.endsWith(idPattern)) {
              const withoutId = baseName.substring(0, baseName.length - idPattern.length);
              if (skipChannelFolder) {
                resolvedTitle = withoutId;
              } else {
                const prefix = `${video.channelName} - `;
                if (withoutId.startsWith(prefix)) {
                  resolvedTitle = withoutId.substring(prefix.length);
                } else {
                  const dashIdx = withoutId.indexOf(' - ');
                  if (dashIdx !== -1) {
                    resolvedTitle = withoutId.substring(dashIdx + 3);
                  } else {
                    resolvedTitle = withoutId;
                  }
                }
              }
            }
          } else {
            actualPath = skipChannelFolder
              ? path.join(targetDir, `${video.title} [${video.id}].mp4`)
              : path.join(targetDir, `${video.channelName} - ${video.title} [${video.id}].mp4`);
          }
        } catch (e) {
          actualPath = skipChannelFolder
            ? path.join(settings.downloadPath, `${video.title} [${video.id}].mp4`)
            : path.join(settings.downloadPath, video.channelName, `${video.channelName} - ${video.title} [${video.id}].mp4`);
        }

        let fileExists = false;
        try {
          fileExists = fs.existsSync(actualPath);
        } catch (e) {
          // Kasıtlı sessiz: Dosya varlığı sorgulanamadıysa yok varsayılır
        }

        if (!fileExists) {
          updateHistoryItem(video.id, {
            status: 'failed',
            progress: 0,
            speed: '',
            eta: '',
            error: settings.lang === 'en' ? 'Video file not found.' : 'Video dosyası bulunamadı.'
          });
          console.error(`İndirme Başarısız (Dosya bulunamadı): ${video.title}`);
          broadcast('status_log', { message: `İndirme başarısız (Dosya bulunamadı): ${video.title}`, type: 'error', thumbnail: `/api/video/${video.id}/thumbnail` });
          addTerminalLog(`[Kuyruk] İndirme FAILED: "${video.title}" - Hata: Video dosyası bulunamadı.`, 'error');
          playSystemSound('error');
          showWindowsNotification(
            settings.lang === 'en' ? 'Download Failed' : 'İndirme Başarısız',
            settings.lang === 'en' ? `"${video.title}" download failed (video file not found).` : `"${video.title}" videosunun indirilmesi başarısız oldu (video dosyası bulunamadı).`
          );
        } else {
          let calculatedSize = '';
          try {
            if (fs.existsSync(actualPath)) {
              const stats = fs.statSync(actualPath);
              const sizeInBytes = stats.size;
              if (sizeInBytes >= 1024 * 1024 * 1024) {
                calculatedSize = Math.round(sizeInBytes / (1024 * 1024 * 1024)) + ' GB';
              } else {
                calculatedSize = Math.round(sizeInBytes / (1024 * 1024)) + ' MB';
              }
            }
          } catch (err) {
            console.error(`Boyut okuma hatası: ${resolvedTitle}`, err.message);
          }

          updateHistoryItem(video.id, {
            status: 'completed',
            progress: 100,
            filePath: actualPath,
            title: resolvedTitle,
            speed: '',
            eta: '',
            fileSize: calculatedSize
          });
          console.log(`İndirme tamamlandı: ${resolvedTitle}`);
          broadcast('status_log', { message: `İndirme tamamlandı: ${resolvedTitle}`, type: 'success', thumbnail: `/api/video/${video.id}/thumbnail` });
          addTerminalLog(`[Kuyruk] İndirme SUCCESSFUL: "${resolvedTitle}" -> Dosya Yolu: ${actualPath}`, 'success');
          playSystemSound('success');
          showWindowsNotification(
            settings.lang === 'en' ? 'Download Completed' : 'İndirme Tamamlandı',
            settings.lang === 'en' ? `"${resolvedTitle}" downloaded successfully.` : `"${resolvedTitle}" videosu başarıyla indirildi.`
          );
        }
      } else {
        let userFriendlyError = errorOutput.trim();
        if (userFriendlyError.includes('Could not copy Chrome cookie database') || userFriendlyError.includes('Could not copy Edge cookie database')) {
          userFriendlyError = `Tarayıcı çerez dosyası kilitli! Edge tarayıcınız arka planda çalışmaya devam ediyor olabilir. Lütfen tarayıcınızı tamamen kapatıp tekrar deneyin veya Ayarlar sekmesinden çerez seçeneğini 'Çerez Kullanma (Sadece Açık Videolar)' olarak ayarlayın.`;
        } else if (userFriendlyError.includes('Could not find browser') || userFriendlyError.includes('cookie')) {
          userFriendlyError = `Tarayıcı çerezleri okunamadı. Lütfen ayarlarınızdan çerez aldığınız tarayıcıyı (${settings.browser.toUpperCase()}) kapatıp tekrar deneyin veya tarayıcı profilinizin doğru olduğundan emin olun.`;
        }

        updateHistoryItem(video.id, {
          status: 'failed',
          progress: 0,
          speed: '',
          eta: '',
          error: userFriendlyError || `Hata Kodu: ${code}`
        });
        console.error(`İndirme Başarısız: ${video.title} - Kod: ${code}`);
        broadcast('status_log', { message: `İndirme başarısız: ${video.title}`, type: 'error', thumbnail: `/api/video/${video.id}/thumbnail` });
        addTerminalLog(`[Kuyruk] İndirme FAILED: "${video.title}" - Hata: ${userFriendlyError || `Hata Kodu: ${code}`}`, 'error');
        playSystemSound('error');
        showWindowsNotification(
          settings.lang === 'en' ? 'Download Failed' : 'İndirme Başarısız',
          settings.lang === 'en' ? `"${video.title}" download failed.` : `"${video.title}" videosunun indirilmesi başarısız oldu.`
        );
      }

      broadcast('db_update', readDb());
      
      // RSS modülünü dinamik yükleyip eksik süreleri çözmeyi tetikle
      try {
        const { resolveMissingDurations } = await import('./rss.js');
        resolveMissingDurations();
      } catch (err) {
        console.error('RSS modülü dinamik yüklenemedi:', err);
      }

      this.process();
    });
  }
}

export const downloadQueue = new DownloadQueue();
try {
  const initDb = readDb();
  downloadQueue.isPaused = !!initDb.settings.isPaused;
} catch (e) {
  downloadQueue.isPaused = false;
}
