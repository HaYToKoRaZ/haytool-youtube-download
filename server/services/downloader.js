// Türkçe Açıklama: İndirme işlemlerini sırayla gerçekleştiren kuyruk yapısını (DownloadQueue), bildirim seslerini ve masaüstü bildirimlerini yöneten motor modülü.
import fs from 'fs';
import { dataRootDir } from '../config.js';
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
import { ytdlpPath, testFfmpegSync, getFfmpegPath, getLocalTempDir, cleanMeiForPid, spawnYtdlp, execYtdlp, getVideoResolution } from './paths.js';
import { getWorkingProxy, rotateProxy } from './proxyManager.js';

// Türkçe Açıklama: İndirmeleri gerçekleştiren yt-dlp motorunun varlığını kontrol eder, yoksa GitHub üzerinden otomatik indirir.
export async function ensureYtdlp() {
  const isWin = os.platform() === 'win32';
  const filename = isWin ? 'yt-dlp.exe' : 'yt-dlp';
  if (fs.existsSync(ytdlpPath)) {
    return ytdlpPath;
  }

  console.log(`[yt-dlp] ${filename} bulunamadı, GitHub üzerinden en güncel Nightly sürümü otomatik indiriliyor...`);
  addTerminalLog(`[yt-dlp] ${filename} bulunamadı, GitHub üzerinden en güncel sürüm otomatik indiriliyor...`, 'info');

  const targetDir = path.dirname(ytdlpPath);
  if (!fs.existsSync(targetDir)) {
    try { fs.mkdirSync(targetDir, { recursive: true }); } catch (e) {}
  }

  const downloadUrl = isWin
    ? 'https://github.com/yt-dlp/yt-dlp-nightly-builds/releases/latest/download/yt-dlp.exe'
    : 'https://github.com/yt-dlp/yt-dlp-nightly-builds/releases/latest/download/yt-dlp';

  try {
    const res = await fetch(downloadUrl, {
      headers: { 'User-Agent': 'HaYTooL-YT-Downloader' },
      redirect: 'follow'
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    const buffer = Buffer.from(await res.arrayBuffer());
    fs.writeFileSync(ytdlpPath, buffer);
    if (!isWin) {
      try { fs.chmodSync(ytdlpPath, '755'); } catch (e) {}
    }
    console.log(`[yt-dlp] ${filename} başarıyla indirildi ve kullanıma hazır.`);
    addTerminalLog(`[yt-dlp] ${filename} başarıyla indirildi ve kullanıma hazır.`, 'success');
    return ytdlpPath;
  } catch (err) {
    console.error(`[yt-dlp] Otomatik indirme başarısız:`, err.message);
    addTerminalLog(`[yt-dlp] Motor indirme hatası: ${err.message}`, 'error');
    throw err;
  }
}

// Türkçe Açıklama: İndirme durumlarına göre özel melodik bip seslerini (başlama, başarı, hata) ses kartı üzerinden çalar.
export function playSystemSound(type = 'notification') {
  const db = readDb();
  if (db.settings && db.settings.playSounds === false) return;

  // Türkçe Açıklama: Eğer sunucu tray launcher (arayüz) tarafından başlatıldıysa, komutu tray'e ileterek native çaldır.
  console.log(`[TRAY_CMD] play_sound=${type}`);

  if (os.platform() !== 'win32') return;

  // Türkçe Açıklama: Eğer stdout yönlendirilmişse (isTTY değilse), tray launcher sesi zaten native çalar. Çift çalmayı engelleyelim.
  const isRunningInTray = !process.stdout.isTTY;
  if (isRunningInTray) return;
  
  let soundCmd = '';
  if (type === 'success') {
    soundCmd = '[System.Console]::Beep(1046, 120)';
  } else if (type === 'error') {
    soundCmd = '[System.Console]::Beep(330, 200)';
  }
  
  if (soundCmd) {
    exec(`powershell -c "${soundCmd}"`, (err) => {
      if (err) console.error('Uygulama özel bildirim sesi çalınamadı:', err.message);
    });
  }
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

// Türkçe Açıklama: Kök ve bin/ çerez dosyalarını tek bir Netscape dosyasında birleştirip yt-dlp argümanlarını döner.
// Kök "cookies.txt" (yt-dlp dışa aktarımı) çoğu zaman yalnızca 3. taraf (__Secure-3P*) çerezleri tutar;
// tam oturum (SAPISID/SID/HSID/SSID/APISID/LOGIN_INFO/__Secure-1PSID) "bin/cookies.txt" içindedir.
// "izlendi olarak işaretle" (--mark-watched) gibi kimlik doğrulama isteyen işlemler eksik çerezlerle sessizce
// başarısız olur. Bu yüzden iki dosyayı birleştirip eksiksiz seti yt-dlp'ye veriyoruz.
export function getCookieArgs(settings = {}) {
  const rootCookiesTxt = path.join(dataRootDir, 'cookies.txt');
  const binCookiesTxt = path.join(dataRootDir, 'bin', 'cookies.txt');

  const merged = mergeCookieFiles([rootCookiesTxt, binCookiesTxt]);
  if (merged) {
    return ['--cookies', merged];
  }

  return [];
}

// Türkçe Açıklama: Birden çok Netscape çerez dosyasını tek dosyada birleştirir. Aynı (alan adı + isim)
// çerezinde son dosya öncekini ezer; bu yüzden bin/ (tam oturum) kök dosyanın üzerine yazılır.
// Sonuç her çağrıda taze üretilir; hiçbir çerez yoksa null döner.
function mergeCookieFiles(filePaths) {
  const cookieMap = new Map();
  for (const fp of filePaths) {
    if (!fp || !fs.existsSync(fp)) continue;
    const content = fs.readFileSync(fp, 'utf8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const parts = trimmed.split('\t');
      if (parts.length < 7) continue;
      const key = `${parts[0]}\t${parts[5]}`; // alan adı + çerez adı
      cookieMap.set(key, trimmed);
    }
  }

  if (cookieMap.size === 0) return null;

  const mergedPath = path.join(os.tmpdir(), 'haytool_cookies_merged.txt');
  const merged = '# Netscape HTTP Cookie File\n' + Array.from(cookieMap.values()).join('\n') + '\n';
  fs.writeFileSync(mergedPath, merged, 'utf8');
  return mergedPath;
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
      if (item.status === 'downloading' || item.status === 'merging') {
        return id;
      }
    }
    return null;
  }

  getActiveDownloadingProcess() {
    for (const [id, item] of this.activeProcesses.entries()) {
      if (item.status === 'downloading' || item.status === 'merging') {
        return item.process;
      }
    }
    return null;
  }

  async add(video) {
    if (this.queue.some(item => item.id === video.id)) return;

    // Türkçe Açıklama: Eğer bu video ID'sine ait aktif süreç askıda kalmışsa, bayat süreci sonlandırıp temizleyelim
    if (this.activeProcesses.has(video.id)) {
      const staleProcInfo = this.activeProcesses.get(video.id);
      if (staleProcInfo) {
        if (staleProcInfo.timeoutTimer) clearTimeout(staleProcInfo.timeoutTimer);
        try {
          if (staleProcInfo.process && staleProcInfo.process.pid) {
            if (process.platform === 'win32') {
              exec(`taskkill /pid ${staleProcInfo.process.pid} /T /F`);
            } else {
              staleProcInfo.process.kill();
            }
          }
        } catch (e) {}
        this.activeProcesses.delete(video.id);
        console.log(`[Kuyruk Auto-Healing] "${video.title}" için eski askıdaki indirme süreci sonlandırıldı ve temizlendi.`);
      }
    }

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
          isStandalone: video.isStandalone || false,
          duration: video.duration || ''
        };
        db.history.push(historyItem);
        writeDb(db);
      } else {
        historyItem.status = 'waiting';
        historyItem.progress = 0;
        historyItem.speed = '';
        historyItem.eta = '';
        delete historyItem.error;
        delete historyItem.retryCount;
        historyItem.resolveAttempts = 0;
        historyItem.downloadedAt = new Date().toISOString();
        if (video.publishedAt) {
          historyItem.publishedAt = video.publishedAt;
        }
        if (video.duration) {
          historyItem.duration = video.duration;
        }
        writeDb(db);
      }

      this.queue.push(video);
      broadcast('db_update', readDb());
    } finally {
      release();
    }
    
    // Arka planda asenkron olarak boyut ve süre metadata'sını sorgula
    this.fetchMetadataAsync(video.id);
    
    this.process();
  }

  async fetchMetadataAsync(videoId) {
    try {
      // 1-2 saniye gecikmeyle arka planda sorgula (indirme kuyruğu performansını etkilememek için)
      setTimeout(() => {
        const db = readDb();
        const item = db.history.find(h => h.id === videoId);
        if (!item) return;

        // Boyut veya süre eksikse yt-dlp ile sorgulayalım
        if (!item.fileSize || !item.duration) {
          const quality = db.settings.quality || 'best';
          let formatSel = 'bestvideo+bestaudio/best';
          if (quality !== 'best') {
            const h = quality.replace('p', '');
            formatSel = `bestvideo[height<=${h}]+bestaudio/best`;
          }
          
          const cmd = `"${ytdlpPath}" --simulate --format "${formatSel}" --print "%(filesize,filesize_approx)s|%(duration)s" "https://www.youtube.com/watch?v=${videoId}"`;
          const localTemp = getLocalTempDir();
          const execProc = execYtdlp(cmd, { env: { ...process.env, TEMP: localTemp, TMP: localTemp } }, (error, stdout, stderr) => {
            cleanMeiForPid(execProc.pid);
            if (!error && stdout) {
              const parts = stdout.trim().split('|');
              if (parts.length >= 2) {
                const rawSize = parts[0];
                const rawDuration = parseInt(parts[1], 10);
                
                const updateData = {};
                if (rawSize && rawSize !== 'NA' && rawSize !== 'null') {
                  const bytes = parseInt(rawSize, 10);
                  if (!isNaN(bytes)) {
                    updateData.fileSize = (bytes / (1024 * 1024)).toFixed(1) + ' MB';
                  }
                }
                if (rawDuration && !isNaN(rawDuration)) {
                  const hrs = Math.floor(rawDuration / 3600);
                  const mins = Math.floor((rawDuration % 3600) / 60);
                  const secs = rawDuration % 60;
                  updateData.duration = hrs > 0 
                    ? `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
                    : `${mins}:${secs.toString().padStart(2, '0')}`;
                }
                
                if (Object.keys(updateData).length > 0) {
                  updateHistoryItem(videoId, updateData);
                }
              }
            }
          });
        }
      }, 500);
    } catch (e) {
      console.warn('Metadata async fetch error:', e);
    }
  }

  process() {
    if (this.isPaused) {
      console.log('[Kuyruk] Queue paused. Bir sonraki indirme bekliyor.');
      return;
    }

    const db = readDb();
    if (db && db.settings) {
      this.maxConcurrent = parseInt(db.settings.maxConcurrentDownloads, 10) || 1;
    }

    // Türkçe Açıklama: Auto-Healing - Kapanmış/ölmüş ancak haritada kalmış süreçleri otomatik temizle
    for (const [vid, procInfo] of this.activeProcesses.entries()) {
      if (!procInfo.process || procInfo.process.killed || procInfo.process.exitCode !== null) {
        if (procInfo.timeoutTimer) clearTimeout(procInfo.timeoutTimer);
        this.activeProcesses.delete(vid);
        console.log(`[Kuyruk Auto-Healing] Kapanmış süreç haritadan temizlendi: ${vid}`);
      }
    }

    if (this.activeProcesses.size === 0) {
      this.activeDownloads = 0;
    } else if (!this.activeProcess && this.activeDownloads > 0) {
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
    } else {
      // Türkçe Açıklama: Önceki başarısız/yarım kalmış indirmelerden kalan birleşmemiş parçaları (.f137.mp4, .part vb.) temizle
      try {
        const filesInDir = fs.readdirSync(outputDir);
        for (const f of filesInDir) {
          if (f.includes(`[${video.id}]`) && (f.endsWith('.part') || f.endsWith('.ytdl') || f.includes('.part-Frag') || /\.f\d+\.(mp4|m4a|webm)$/i.test(f))) {
            try { fs.unlinkSync(path.join(outputDir, f)); } catch (e) {}
          }
        }
      } catch (e) {}
    }

    const outputTemplate = skipChannelFolder
      ? path.join(outputDir, `%(title)s [${video.id}].%(ext)s`)
      : path.join(outputDir, `${video.channelName} - %(title)s [${video.id}].%(ext)s`);
    
    const isMp3 = (video.customFormat === 'audio-mp3');

    const userLang = settings.lang || 'tr';
    const subLangs = userLang === 'en'
      ? 'en,en-orig'
      : `${userLang},${userLang}-orig,en,en-orig`;

    const args = [
      video.url,
      '--no-playlist',
      '--no-mtime',
      '--ignore-errors',
      '--geo-bypass',
      '--windows-filenames',
      '--js-runtimes', `node:${process.execPath}`,
      '--replace-in-metadata', 'title', '[#?%]', '',
      '--replace-in-metadata', 'title', '[/\\\\:\\*\\?\"<>|｜|]', '-',
      '-o', outputTemplate,
      '--newline',
      '--write-subs',
      '--write-auto-subs',
      '--sub-langs', subLangs,
      '--sub-format', 'srt'
    ];

    if (!isMp3) {
      args.push('--write-description');
    }

    const prefLang = (settings.preferredAudioLang && settings.preferredAudioLang !== 'auto')
      ? settings.preferredAudioLang
      : (settings.lang || 'tr');

    args.push('--add-header', `Accept-Language:${prefLang}-${prefLang.toUpperCase()},${prefLang};q=0.9,en-US;q=0.8,en;q=0.7`);
    
    const cookieArgs = getCookieArgs(settings);
    const hasCookies = cookieArgs.length > 0;

    if (video._fallbackClient) {
      args.push('--extractor-args', `youtube:lang=${prefLang},${prefLang}-${prefLang.toUpperCase()};player_client=${video._fallbackClient}`);
    } else if (hasCookies) {
      // Çerez aktifken: visionos, ios, android, web_creator, mweb, web
      args.push('--extractor-args', `youtube:lang=${prefLang},${prefLang}-${prefLang.toUpperCase()};player_client=visionos,ios,android,web_creator,mweb,web`);
    } else {
      // Anonim modda: visionos, ios, android, web
      args.push('--extractor-args', `youtube:lang=${prefLang},${prefLang}-${prefLang.toUpperCase()};player_client=visionos,ios,android,web`);
    }

    args.push('--remote-components', 'ejs:github');
    args.push('--format-sort', 'hasvid,res,fps,hdr,vcodec');

    const effectiveSpeed = getEffectiveSpeedLimit(settings);
    if (effectiveSpeed && effectiveSpeed > 0) {
      args.push('--limit-rate', `${effectiveSpeed}K`);
    }

    // Çerez kaynağını ekle (cookies.txt -> Dahili WebView2 -> Harici Tarayıcı)
    if (hasCookies) {
      args.push(...cookieArgs);
    }

    if (video._proxy) {
      args.push('--proxy', video._proxy);
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
        const audioOnlyFmt = `bestaudio[language^=${prefLang}]/bestaudio[language=original]/bestaudio`;
        args.push('-f', audioOnlyFmt, '--extract-audio', '--audio-format', 'mp3', '--audio-quality', `${bitrate}K`, '--embed-thumbnail');
      } else {
        let maxH = 1080;
        if (fmt === 'video-720p') maxH = 720;
        else if (fmt === 'video-480p') maxH = 480;
        else if (fmt === 'video-360p') maxH = 360;
        else if (fmt === 'video-240p') maxH = 240;
        else if (fmt === 'video-144p') maxH = 144;
        else if (fmt === 'video-best') maxH = 4320;

        const vSpec = `bestvideo[height<=${maxH}]`;
        const fmtCombo = `${vSpec}+bestaudio[language^=${prefLang}]/${vSpec}+bestaudio[language=original]/${vSpec}+bestaudio/best[height<=${maxH}]/best`;
        args.push('-f', fmtCombo);
        if (hasWorkingFfmpeg) {
          args.push('--merge-output-format', 'mp4');
        }
      }
    } else {
      let maxH = (videoQuality === '1080p') ? 1080 : ((videoQuality === '720p') ? 720 : 4320);
      const vSpec = `bestvideo[height<=${maxH}]`;
      const fmtCombo = `${vSpec}+bestaudio[language^=${prefLang}]/${vSpec}+bestaudio[language=original]/${vSpec}+bestaudio/best[height<=${maxH}]/best`;
      
      if (actualMergeType === 'separate') {
        const audioFmt = `bestaudio[language^=${prefLang}]/bestaudio[language=original]/bestaudio`;
        args.push('-f', `${vSpec},${audioFmt}`);
      } else {
        args.push('-f', fmtCombo);
        if (hasWorkingFfmpeg) {
          args.push('--merge-output-format', 'mp4');
        }
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
    // Canlı Yayın Garantili İndirme: Sadece aktif canlı yayınlarda --live-from-start kullan, normal ve sonlanmış yayınlarda kullanma
    if (video.duration === 'live' || video.status === 'live') {
      args.push('--live-from-start', '--concurrent-fragments', '4', '--hls-use-mpegts');
    } else {
      args.push('--concurrent-fragments', '4');
    }
    args.push('--fragment-retries', '10', '--retries', '5', '--retry-sleep', 'fragment:exp=1:20', '--skip-unavailable-fragments');

    const startLogMsg = `[İNDİRME] İndirme başlatılıyor: "${video.title}"`;
    const cmdLogMsg = `[KOMUT] yt-dlp ${args.join(' ')}`;
    console.log(startLogMsg);
    console.log(cmdLogMsg);
    addTerminalLog(startLogMsg, 'info');
    addTerminalLog(cmdLogMsg, 'info');

    const localTemp = getLocalTempDir();
    const spawnOptions = {
      env: { ...process.env, TEMP: localTemp, TMP: localTemp },
      ...(process.platform === 'win32' 
        ? { stdio: ['ignore', 'pipe', 'pipe'] } 
        : { stdio: ['ignore', 'pipe', 'pipe'], detached: true })
    };
    const timeoutDuration = 30 * 60 * 1000;
    const downloadProc = spawnYtdlp(args, spawnOptions);
    
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
      }
    }, timeoutDuration);

    // %0 Takılma Koruması (Yeni sonlanmış VOD işleme sürecindeki canlı yayınlar için 45sn zaman aşımı)
    const stallTimer = setTimeout(() => {
      const procInfo = this.activeProcesses.get(video.id);
      if (procInfo && procInfo.status === 'downloading' && (!procInfo.progress || procInfo.progress === 0)) {
        console.warn(`[Canlı Yayın Koruması] "${video.title}" 45 saniyedir %0'da takıldı. Canlı yayın VOD işleme aşamasında olduğu için indirme ertelendi.`);
        addTerminalLog(`[Canlı Yayın Koruması] "${video.title}" %0'da takıldı. Canlı yayın henüz yeni sonlandı, YouTube VOD işlemesi bekleniyor.`, 'warning');
        
        try {
          if (process.platform === 'win32') {
            exec(`taskkill /pid ${procInfo.process.pid} /T /F`);
          } else {
            procInfo.process.kill();
          }
        } catch (e) {}

        if (procInfo.timeoutTimer) clearTimeout(procInfo.timeoutTimer);
        this.activeProcesses.delete(video.id);
        this.activeDownloads = Math.max(0, this.activeDownloads - 1);

        updateHistoryItem(video.id, {
          status: 'waiting_live_processing',
          error: 'Canlı yayın yeni sonlandı, YouTube VOD işlemesi bekleniyor.'
        });
        this.process();
      }
    }, 45000);

    this.activeProcesses.set(video.id, {
      process: downloadProc,
      status: 'downloading',
      video: video,
      timeoutTimer: timeoutTimer,
      stallTimer: stallTimer,
      progress: 0
    });

    downloadProc.stdout.on('data', (data) => {
      const output = data.toString();
      
      // \r ayracı da satır sonu kabul edilir (yt-dlp/ffmpeg ilerleme satırları birleşmesin)
      const lines = output.split(/[\r\n]+/);
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed) {
          const isProgressSpam = trimmed.includes('[download]') && trimmed.includes('%') && (trimmed.includes('at') || trimmed.includes('ETA'));
          const isFragmentRetrySpam = trimmed.includes('Got error: HTTP Error 403') || trimmed.includes('Retrying fragment');
          if (!isProgressSpam && !isFragmentRetrySpam) {
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
        }
      }

      // 2. Detaylı İlerleme Bilgisi (Yüzde, Boyut, Hız, Kalan Süre - tilde ~ ve DASH parçaları destekli)
      const detailMatch = output.match(/\[download\]\s+(\d+(?:\.\d+)?)%\s+of\s+~?\s*([\d\.]+\s*[a-zA-Z]+|\d+\s*fragments)\s+at\s+([^\s]+)\s+ETA\s+([^\s]+)/i);
      if (detailMatch) {
        const percent = parseFloat(detailMatch[1]);
        const rawSize = detailMatch[2];
        const speed = detailMatch[3];
        const eta = detailMatch[4];

        const procInfo = this.activeProcesses.get(video.id);
        if (procInfo && procInfo.status === 'downloading') {
          procInfo.progress = percent;
          if (percent > 0 && procInfo.stallTimer) {
            clearTimeout(procInfo.stallTimer);
            delete procInfo.stallTimer;
          }
          updateHistoryItem(video.id, {
            progress: percent,
            fileSize: rawSize,
            speed: speed,
            eta: eta
          }, { persist: false });

          broadcast('progress', {
            id: video.id,
            progress: percent,
            speed: speed,
            eta: eta,
            fileSize: rawSize
          });
        }
      } else {
        // 3. DASH Parça İlerleme Desteği (Örn: Fragment 164 of 1618)
        const fragMatch = output.match(/(?:fragment|chunk)\s+(\d+)\s+of\s+(\d+)/i);
        if (fragMatch) {
          const currentFrag = parseInt(fragMatch[1], 10);
          const totalFrags = parseInt(fragMatch[2], 10);
          if (totalFrags > 0) {
            const percent = parseFloat(((currentFrag / totalFrags) * 100).toFixed(1));
            const procInfo = this.activeProcesses.get(video.id);
            if (procInfo && procInfo.status === 'downloading') {
              updateHistoryItem(video.id, {
                progress: percent,
                speed: 'DASH Stream',
                eta: `${currentFrag}/${totalFrags} Parça`
              }, { persist: false });

              broadcast('progress', {
                id: video.id,
                progress: percent,
                speed: 'DASH Stream',
                eta: `${currentFrag}/${totalFrags} Parça`,
                fileSize: `${totalFrags} Parça`
              });
            }
          }
        }
      }
    });

    let errorOutput = '';
    let stderrBuffer = '';
    // Gerçek hata satırları: WARNING ve zararsız ffmpeg çıktıları hariç yalnızca gerçek hatalar toplanır
    let realErrorLines = [];

    function handleStderrLine(line) {
      const trimmed = line.trim();
      if (!trimmed) return;

      const lowerTrimmed = trimmed.toLowerCase();
      // HLS/TS ilerleme satırları (size=... time=... bitrate=...) ilerleme spamı sayılır
      const isFfmpegProgress = lowerTrimmed.startsWith('frame=') || (lowerTrimmed.includes('fps=') && lowerTrimmed.includes('size=') && lowerTrimmed.includes('time=')) || (lowerTrimmed.includes('size=') && lowerTrimmed.includes('time=') && lowerTrimmed.includes('bitrate='));
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
                           lowerTrimmed.includes('press [q] to stop') ||
                           lowerTrimmed.includes('id3v2_priv') ||
                           lowerTrimmed.includes('transportstreamtimestamp') ||
                           lowerTrimmed.includes('thread message queue blocking');
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

      const isWarning = lowerTrimmed.includes('warning:') || lowerTrimmed.includes('uyari:');

      if (lowerTrimmed.includes('unable to download video subtitles') || lowerTrimmed.includes('http error 429')) {
        const cleanMsg = `[yt-dlp Uyarı] Altyazı uyarısı (YouTube sunucusu 429 kısıtlaması verdi - Video indirmesi kesintisiz devam ediyor).`;
        console.log(cleanMsg);
        addTerminalLog(cleanMsg, 'warning');
      } else if (isWarning) {
        console.log(`yt-dlp uyarı satırı: ${trimmed}`);
        addTerminalLog(`[yt-dlp Uyarı] ${trimmed}`, 'warning');
      } else {
        console.error(`yt-dlp error line: ${trimmed}`);
        addTerminalLog(`[yt-dlp Error] ${trimmed}`, 'error');
        realErrorLines.push(trimmed);
      }
    }

    downloadProc.stderr.on('data', (data) => {
      const output = data.toString();
      errorOutput += output;
      if (errorOutput.length > 50000) {
        errorOutput = errorOutput.slice(-50000);
      }
      stderrBuffer += output;
      
      // \r ayracı da satır sonu kabul edilir (ffmpeg ilerleme/HLS satırları birleşmesin)
      const lines = stderrBuffer.split(/[\r\n]+/);
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
      cleanMeiForPid(downloadProc.pid);
      const procInfo = this.activeProcesses.get(video.id);
      if (!procInfo) return;

      if (procInfo.timeoutTimer) {
        clearTimeout(procInfo.timeoutTimer);
      }
      if (procInfo.stallTimer) {
        clearTimeout(procInfo.stallTimer);
      }

      this.activeProcesses.delete(video.id);

      this.activeDownloads = Math.max(0, this.activeDownloads - 1);

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

          const actualQuality = actualPath ? getVideoResolution(actualPath) : null;

          updateHistoryItem(video.id, {
            status: 'completed',
            progress: 100,
            filePath: actualPath,
            title: resolvedTitle,
            speed: '',
            eta: '',
            fileSize: calculatedSize,
            ...(actualQuality ? { actualQuality } : {})
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
        // Gerçek hata satırları toplandıysa onları kullan; yoksa ham stderr'e düş (güvenli geri dönüş)
        let userFriendlyError = realErrorLines.length > 0 ? realErrorLines.join('\n') : errorOutput.trim();
        if (userFriendlyError.includes('Could not copy Chrome cookie database') || userFriendlyError.includes('Could not copy Edge cookie database')) {
          userFriendlyError = `Tarayıcı çerez dosyası kilitli! Edge/Chrome tarayıcınız arka planda çalışmaya devam ediyor olabilir. Lütfen tarayıcınızı tamamen kapatıp tekrar deneyin veya Ayarlar sekmesinden çerez seçeneğini 'Çerez Kullanma (Sadece Açık Videolar)' olarak ayarlayın.`;
        } else if ((userFriendlyError.includes('Could not find browser') || userFriendlyError.includes('cookie')) && !/no longer valid|cookies? are? (no longer valid|expired)|WARNING:/i.test(userFriendlyError)) {
          userFriendlyError = `YouTube oturum çerezleri okunamadı. Lütfen Ayarlar sekmesinden "YouTube'da Oturum Aç" ile oturumunuzu yenileyip tekrar deneyin.`;
        } else if (/yeler|üyeler|members-only|katıl|katil|join this channel|ayrıcalık|ayrcal/i.test(userFriendlyError)) {
          userFriendlyError = settings.lang === 'en'
            ? `This video is Members-Only content. To download it, you must be a joined member of this channel and set 'Premium Browser Cookies' in Settings.`
            : `Bu video Katıl (Üyelere Özel) içeriğidir. İndirebilmek için kanala Katıl üyesi olmanız ve Ayarlar sekmesinden "Premium Çerez Tarayıcısı" seçeneğini aktif yapmanız gerekmektedir.`;
        }

        let isLiveProcessingError = /live stream (has ended|recording is still processing|is currently live)|this live event will begin|this video is a live stream|processing stream|The downloaded file is empty|Post-Live Manifestless mode|No such file or directory.*\.part-Frag|canl[ıi] etkinlik.*ba[şs]layacak|canl[ıi] yay[ıi]n.*(ba[şs]layacak|i[şs]leniyor|i[şs]len|devam ediyor|s[üu]r[üu]yor)|bu canl[ıi]|yay[ıi]n.*sonra ba[şs]layacak/i.test(userFriendlyError);
        let isTransientHttpError = /HTTP Error 403|HTTP Error 503|HTTP Error 429|Service Unavailable|Forbidden/i.test(userFriendlyError);
        let isGeoBlockedVideo = (/yasal|alan ad|country\'s domain|not available in your country|Geo-blocked|b[öo\uFFFD]lge|unavailable|kullan[ıi\uFFFD]lam/i.test(userFriendlyError) || /yasal|alan ad|country\'s domain|not available in your country|Geo-blocked|unavailable/i.test(errorOutput)) && !/Private video|Gizli video|This is a private video/i.test(userFriendlyError);

        if (isLiveProcessingError) {
          updateHistoryItem(video.id, {
            status: 'waiting_live_processing',
            progress: 0,
            speed: '',
            eta: '',
            error: 'YouTube Canlı Yayın İşleniyor'
          });
          console.log(`[Downloader] Live stream is processing on YouTube. Deferred to waiting_live_processing: ${video.title}`);
          addTerminalLog(`[Kuyruk] Canlı yayın henüz işleniyor: "${video.title}" - YouTube VOD dönüştürmesi tamamlandığında otomatik indirilecek.`, 'info');
        } else if (isGeoBlockedVideo && (!video._geoRetryCount || video._geoRetryCount < 2)) {
          video._geoRetryCount = (video._geoRetryCount || 0) + 1;
          try {
            console.log(`[YASAKLI VİDEO] "${video.title}" için bölgesel/yasal kısıtlama tespit edildi. Proxy havuzundan tünel aranıyor...`);
            addTerminalLog(`[YASAKLI VİDEO] "${video.title}" bölgesel/yasal kısıtlamalı içerik algılandı. Çalışan Proxy tüneli aranıyor...`, 'warning');
            const workingProxy = await getWorkingProxy();
            if (workingProxy) {
              video._proxy = workingProxy;
              console.log(`[YASAKLI VİDEO] "${video.title}" Proxy tüneli (${workingProxy.replace('http://', '')}) üzerinden otomatik yeniden indiriliyor...`);
              addTerminalLog(`[YASAKLI VİDEO] "${video.title}" Proxy tüneli (${workingProxy.replace('http://', '')}) üzerinden otomatik indirme kuyruğuna alındı.`, 'info');
              updateHistoryItem(video.id, {
                status: 'waiting',
                progress: 0,
                speed: '',
                eta: '',
                error: 'Proxy Tüneli ile İndiriliyor'
              });
              broadcast('db_update', readDb());
              setTimeout(() => {
                this.add(video);
                this.process();
              }, 1000);
              return;
            }
          } catch (proxyErr) {
            console.error('[YASAKLI VİDEO] Proxy tünel hatası:', proxyErr.message);
          }
        } else if (isTransientHttpError && (!video.retryCount || video.retryCount < 3)) {
          video.retryCount = (video.retryCount || 0) + 1;
          delete video._fallbackClient;
          if (video._proxy) {
            const nextProxy = rotateProxy();
            if (nextProxy) {
              video._proxy = nextProxy;
              console.log(`[Proxy Havuzu] HTTP kısıtlaması sonrası yeni proxy ile deneniyor: ${nextProxy}`);
              addTerminalLog(`[Proxy Havuzu] Sıradaki Proxy tüneline (${nextProxy.replace('http://', '')}) geçiş yapılıyor...`, 'info');
            }
          }
          const waitSec = video.retryCount * 4;
          console.warn(`[Kuyruk Auto-Retry] "${video.title}" için geçici YouTube CDN kısıtlaması (403/503/429) algılandı. ${waitSec} saniye beklenip en yüksek kalitede otomatik yeniden denenecek (${video.retryCount}/3)...`);
          addTerminalLog(`[403 Koruması] "${video.title}" için geçici YouTube CDN kısıtlaması algılandı. ${waitSec} sn sonra en yüksek kalitede (1080p/4K) otomatik yeniden deneniyor (${video.retryCount}/3)...`, 'warning');
          setTimeout(() => {
            this.add(video);
            this.process();
          }, waitSec * 1000);
          return;
        } else {
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

        // Başarısız veya Ertelenmiş İndirmelerde Disk Temizliği: Artık kalan tüm .part/.ytdl geçici dosyalarını sil
        try {
          const skipChannelFolder = video.skipChannelFolder === true;
          const targetDir = skipChannelFolder
            ? settings.downloadPath
            : path.join(settings.downloadPath, video.channelName);
          if (fs.existsSync(targetDir)) {
            const files = fs.readdirSync(targetDir);
            for (const file of files) {
              if (file.includes(`[${video.id}]`) && (file.endsWith('.part') || file.endsWith('.ytdl') || file.includes('.part-Frag'))) {
                try { fs.unlinkSync(path.join(targetDir, file)); } catch (e) {}
              }
            }
          }
        } catch (e) {}
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
