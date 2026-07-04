// Türkçe Açıklama: Ayarların kaydedilmesi, çerez testi, log geçmişi, disk alanı sorguları ve FFmpeg indirme yönetimi API rotaları modülü.
import express from 'express';
import fs from 'fs';
import path from 'path';
import os from 'os';
import https from 'https';
import { spawn, exec } from 'child_process';
import { Readable } from 'stream';
import { 
  readDb, 
  writeDb, 
  syncDbWithDisk, 
  updateHistoryItem,
  defaultDownloadDir
} from '../database.js';
import { localhostOnly } from '../middleware/security.js';
import { ytdlpPath, getFfmpegPath, testFfmpegSync, setFfmpegWorkingCached } from '../services/paths.js';
import { downloadQueue, getEffectiveSpeedLimit } from '../services/downloader.js';
import { broadcast, addTerminalLog, terminalLogs } from '../services/sse.js';

export const router = express.Router();

let checkIntervalTimer = null;

// Türkçe Açıklama: RSS video kontrol döngüsünü ayardaki saniyeye göre başlatır (rss.js modülünü dinamik çağırır).
async function startIntervalTimer() {
  const db = readDb();
  if (checkIntervalTimer) {
    clearInterval(checkIntervalTimer);
    checkIntervalTimer = null;
  }

  if (db.settings.isPaused) return;

  const seconds = db.settings.channelCheckInterval || 300;
  console.log(`[Zamanlayıcı] RSS kontrol döngüsü ${seconds} saniyede bir çalışacak şekilde başlatıldı.`);
  
  checkIntervalTimer = setInterval(async () => {
    try {
      const { checkNextChannelRss } = await import('../services/rss.js');
      await checkNextChannelRss();
    } catch (err) {
      console.error('[Zamanlayıcı Error] RSS kontrolü çalıştırılamadı:', err.message);
    }
  }, seconds * 1000);
}

// Çerez Test Etme Rotası
router.get('/test-cookies', localhostOnly, async (req, res) => {
  const db = readDb();
  const result = await testCookiesValidity(db.settings.browser);
  res.json(result);
});

// Terminal log geçmişini getir
router.get('/logs', (req, res) => {
  res.json(terminalLogs);
});

// Ayarları kaydet
router.post('/settings', (req, res) => {
  const db = readDb();
  const oldSpeedLimit = getEffectiveSpeedLimit(db.settings);

  if (req.body.downloadSpeedLimit !== undefined) {
    req.body.downloadSpeedLimit = parseInt(req.body.downloadSpeedLimit, 10) || 0;
  }
  if (req.body.alternativeSpeedLimit !== undefined) {
    req.body.alternativeSpeedLimit = parseInt(req.body.alternativeSpeedLimit, 10) || 500;
  }
  if (req.body.useAlternativeSpeed !== undefined) {
    req.body.useAlternativeSpeed = req.body.useAlternativeSpeed === true || req.body.useAlternativeSpeed === 'true';
  }
  if (req.body.sponsorBlockEnabled !== undefined) {
    req.body.sponsorBlockEnabled = req.body.sponsorBlockEnabled === true || req.body.sponsorBlockEnabled === 'true';
  }

  db.settings = { ...db.settings, ...req.body };
  const newSpeedLimit = getEffectiveSpeedLimit(db.settings);
  const speedLimitChanged = newSpeedLimit !== oldSpeedLimit;

  if (req.body.lang) {
    console.log(`[TRAY_CMD] lang=${req.body.lang}`);
  }

  writeDb(db);
  startIntervalTimer(); // Süre değiştiyse zamanlayıcıyı güncelle
  broadcast('db_update', db);

  setTimeout(() => {
    syncDbWithDisk();
  }, 100);

  if (speedLimitChanged && downloadQueue.activeProcess && downloadQueue.activeVideoId) {
    const videoId = downloadQueue.activeVideoId;
    const historyItem = db.history.find(h => h.id === videoId);
    if (historyItem) {
      console.log(`[Ayarlar] Hız sınırı değişti (${oldSpeedLimit} -> ${newSpeedLimit}). Aktif indirme yeni hız sınırı ile yeniden başlatılıyor: ${historyItem.title}`);
      addTerminalLog(`[Ayarlar] Hız sınırı değişti. Aktif indirme yeni hız sınırı ile yeniden başlatılıyor: "${historyItem.title}"`, 'info');
      
      downloadQueue.queue.unshift({
        id: videoId,
        title: historyItem.title,
        channelId: historyItem.channelId,
        channelName: historyItem.channelName,
        url: `https://www.youtube.com/watch?v=${videoId}`,
        publishedAt: historyItem.publishedAt || ''
      });
      
      updateHistoryItem(videoId, {
        status: 'waiting',
        progress: historyItem.progress || 0,
        speed: '',
        eta: ''
      });
      
      const proc = downloadQueue.activeProcess;
      const pid = proc.pid;
      
      downloadQueue.activeProcess = null;
      downloadQueue.activeVideoId = null;
      if (downloadQueue.activeDownloads > 0) {
        downloadQueue.activeDownloads--;
      }
      
      exec(`taskkill /F /T /PID ${pid}`, (err) => {
        try {
          proc.kill('SIGKILL');
        } catch (e) {
          // Kasıtlı sessiz: taskkill zaten süreci öldürdüyse proc.kill hata verir — bu beklenen bir durumdur.
        }
        
        setTimeout(() => {
          downloadQueue.process();
        }, 1000);
      });
    }
  }

  if (db.settings.mergeType === 'merge' && !fs.existsSync(getFfmpegPath())) {
    ensureFfmpeg().catch(e => console.error('FFmpeg auto download error:', e.message));
  }

  res.json({ success: true, settings: db.settings });
});

// FFmpeg İndirme Durumu ve API Rotaları
export let ffmpegDownloadState = { status: 'idle', progress: 0, error: null };

export async function downloadFfmpegAsync() {
  if (ffmpegDownloadState.status === 'downloading' || ffmpegDownloadState.status === 'extracting') {
    return;
  }
  
  ffmpegDownloadState = { status: 'downloading', progress: 0, error: null };
  broadcast('ffmpeg_download', ffmpegDownloadState);
  
  const rootDir = path.resolve(process.cwd());
  const ffmpegDir = path.join(rootDir, 'ffmpeg');
  if (!fs.existsSync(ffmpegDir)) {
    fs.mkdirSync(ffmpegDir, { recursive: true });
  }
  
  const platform = os.platform();
  let platformKey = '';
  if (platform === 'win32') platformKey = 'windows-64';
  else if (platform === 'linux') platformKey = 'linux-64';
  else if (platform === 'darwin') platformKey = 'osx-64';
  else {
    ffmpegDownloadState = { status: 'failed', progress: 0, error: 'Unsupported operating system: ' + platform };
    broadcast('ffmpeg_download', ffmpegDownloadState);
    return;
  }
  
  let urls = {
    'windows-64': {
      ffmpeg: 'https://github.com/ffbinaries/ffbinaries-prebuilt/releases/download/v6.1/ffmpeg-6.1-win-64.zip',
      ffprobe: 'https://github.com/ffbinaries/ffbinaries-prebuilt/releases/download/v6.1/ffprobe-6.1-win-64.zip'
    },
    'linux-64': {
      ffmpeg: 'https://github.com/ffbinaries/ffbinaries-prebuilt/releases/download/v6.1/ffmpeg-6.1-linux-64.zip',
      ffprobe: 'https://github.com/ffbinaries/ffbinaries-prebuilt/releases/download/v6.1/ffprobe-6.1-linux-64.zip'
    },
    'osx-64': {
      ffmpeg: 'https://github.com/ffbinaries/ffbinaries-prebuilt/releases/download/v6.1/ffmpeg-6.1-macos-64.zip',
      ffprobe: 'https://github.com/ffbinaries/ffbinaries-prebuilt/releases/download/v6.1/ffprobe-6.1-macos-64.zip'
    }
  }[platformKey];
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    const apiRes = await fetch('https://ffbinaries.com/api/v1/version/latest', { signal: controller.signal });
    clearTimeout(timeoutId);
    if (apiRes.ok) {
      const apiData = await apiRes.json();
      if (apiData && apiData.bin && apiData.bin[platformKey]) {
        urls = apiData.bin[platformKey];
      }
    }
  } catch (apiErr) {
    console.warn('[FFmpeg] ffbinaries API dynamic URLs could not be fetched, using fallbacks:', apiErr.message);
  }
  
  const ffmpegZip = path.join(ffmpegDir, 'ffmpeg_temp.zip');
  const ffprobeZip = path.join(ffmpegDir, 'ffprobe_temp.zip');
  
  const downloadHelper = async (url, dest, startPercent, endPercent) => {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
    const totalBytes = parseInt(res.headers.get('content-length'), 10) || 0;
    
    const fileStream = fs.createWriteStream(dest);
    const nodeStream = Readable.fromWeb(res.body);
    let downloadedBytes = 0;
    
    nodeStream.on('data', (chunk) => {
      downloadedBytes += chunk.length;
      if (totalBytes > 0) {
        const fileProgress = downloadedBytes / totalBytes;
        const totalProgress = startPercent + fileProgress * (endPercent - startPercent);
        ffmpegDownloadState.progress = Math.round(totalProgress);
        broadcast('ffmpeg_download', ffmpegDownloadState);
      }
    });
    
    nodeStream.pipe(fileStream);
    
    await new Promise((resolve, reject) => {
      fileStream.on('finish', resolve);
      fileStream.on('error', reject);
      nodeStream.on('error', reject);
    });
  };
  
  try {
    console.log(`[FFmpeg] Downloading FFmpeg from ${urls.ffmpeg}...`);
    await downloadHelper(urls.ffmpeg, ffmpegZip, 0, 45);
    
    console.log(`[FFmpeg] Downloading FFprobe from ${urls.ffprobe}...`);
    await downloadHelper(urls.ffprobe, ffprobeZip, 45, 90);
    
    ffmpegDownloadState.status = 'extracting';
    ffmpegDownloadState.progress = 90;
    broadcast('ffmpeg_download', ffmpegDownloadState);
    
    const checkZipSize = (filePath) => {
      if (!fs.existsSync(filePath)) {
        throw new Error(`Downloaded file not found: ${filePath}`);
      }
      const stats = fs.statSync(filePath);
      if (stats.size < 1024 * 1024) {
        throw new Error(`Downloaded file is corrupt or too small (${stats.size} bytes): ${filePath}`);
      }
    };
    checkZipSize(ffmpegZip);
    checkZipSize(ffprobeZip);
    
    console.log('[FFmpeg] Extracting zip files...');
    
    const extractHelper = (zipPath, destDir) => {
      return new Promise((resolve, reject) => {
        let completed = false;
        let fallbackTriggered = false;
        
        const triggerFallback = (reasonErr) => {
          if (fallbackTriggered || completed) return;
          fallbackTriggered = true;
          console.log(`[FFmpeg] Tar extraction not available or failed for ${path.basename(zipPath)}. Running fallback. Reason: ${reasonErr.message}`);
          
          if (platform === 'win32') {
            const ps = spawn('powershell', [
              '-NoProfile',
              '-NonInteractive',
              '-Command',
              `$ErrorActionPreference = 'Stop'; Expand-Archive -LiteralPath "${zipPath}" -DestinationPath "${destDir}" -Force`
            ]);
            ps.on('close', (psCode) => {
              if (completed) return;
              completed = true;
              if (psCode === 0) resolve();
              else reject(new Error(`Powershell fallback extraction failed with code ${psCode}`));
            });
            ps.on('error', (psErr) => {
              if (completed) return;
              completed = true;
              reject(new Error(`Powershell execution failed: ${psErr.message}`));
            });
          } else {
            const uz = spawn('unzip', ['-o', zipPath, '-d', destDir]);
            uz.on('close', (uzCode) => {
              if (completed) return;
              completed = true;
              if (uzCode === 0) resolve();
              else reject(new Error(`Unzip fallback failed with code ${uzCode}`));
            });
            uz.on('error', (uzErr) => {
              if (completed) return;
              completed = true;
              reject(new Error(`Unzip execution failed: ${uzErr.message}`));
            });
          }
        };
        
        const tar = spawn('tar', ['-xf', zipPath, '-C', destDir]);
        
        tar.on('close', (code) => {
          if (completed || fallbackTriggered) return;
          if (code === 0) {
            completed = true;
            resolve();
          } else {
            triggerFallback(new Error(`tar exited with code ${code}`));
          }
        });
        
        tar.on('error', (err) => {
          triggerFallback(err);
        });
      });
    };
    
    await extractHelper(ffmpegZip, ffmpegDir);
    await extractHelper(ffprobeZip, ffmpegDir);
    
    if (platform !== 'win32') {
      try {
        fs.chmodSync(path.join(ffmpegDir, 'ffmpeg'), 0o755);
        fs.chmodSync(path.join(ffmpegDir, 'ffprobe'), 0o755);
      } catch (chmodErr) {
        console.warn('[FFmpeg] Failed to set execute permissions on binaries:', chmodErr.message);
      }
    }
    
    try {
      if (fs.existsSync(ffmpegZip)) fs.unlinkSync(ffmpegZip);
      if (fs.existsSync(ffprobeZip)) fs.unlinkSync(ffprobeZip);
    } catch (e) {
      // Kasıtlı sessiz: Geçici ZIP dosyaları silinmese bile FFmpeg kurulumu başarılı sayılabilir.
    }
    
    setFfmpegWorkingCached(null);
    const testResult = testFfmpegSync();
    
    if (testResult) {
      ffmpegDownloadState.status = 'completed';
      ffmpegDownloadState.progress = 100;
      ffmpegDownloadState.error = null;
      console.log('[FFmpeg] Installation completed successfully.');
      broadcast('ffmpeg_download', ffmpegDownloadState);
      broadcast('status_log', { message: 'FFmpeg automatically installed and activated.', type: 'success' });
    } else {
      throw new Error('FFmpeg check test failed after extraction.');
    }
  } catch (err) {
    console.error('[FFmpeg] Installation process failed:', err);
    try {
      if (fs.existsSync(ffmpegZip)) fs.unlinkSync(ffmpegZip);
      if (fs.existsSync(ffprobeZip)) fs.unlinkSync(ffprobeZip);
    } catch (e) {
      // Kasıtlı sessiz: Hata durumunda geçici ZIP dosyaları silinmese de asıl hata zaten loglandı.
    }
    
    ffmpegDownloadState.status = 'failed';
    ffmpegDownloadState.error = err.message || 'Extraction failed';
    broadcast('ffmpeg_download', ffmpegDownloadState);
  }
}

export function ensureFfmpeg() {
  const ffmpegPath = getFfmpegPath();
  if (fs.existsSync(ffmpegPath)) return Promise.resolve(ffmpegPath);
  
  downloadFfmpegAsync(); // Arka planda indirmeyi başlat
  
  const err = new Error('FFmpeg bulunamadı! Otomatik indirme başlatıldı. Lütfen indirme durumunu arayüzden takip edin.');
  broadcast('status_log', { message: err.message, type: 'info' });
  return Promise.reject(err);
}

// Seçilen tarayıcı çerezlerinin geçerliliğini test eden fonksiyon
export function testCookiesValidity(browser) {
  return new Promise((resolve) => {
    if (!browser || browser === 'none') {
      return resolve({ success: true, message: 'Tarayıcı çerezleri kullanılmıyor.' });
    }
    
    const browserName = browser === 'msedge' ? 'edge' : browser;
    const args = [
      '--cookies-from-browser', browserName,
      '--simulate',
      '--js-runtimes', `node:${process.execPath}`,
      'ytsearch1:test cookie liveness'
    ];
    
    console.log(`[Çerez Testi] yt-dlp çerez testi başlatılıyor: ${browserName}`);
    const proc = spawn(ytdlpPath, args);
    let errorOutput = '';
    
    proc.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });
    
    const timer = setTimeout(() => {
      proc.kill();
      resolve({ success: false, error: 'Zaman aşımı: Tarayıcı çerez veritabanı kilitli veya yanıt vermiyor. Lütfen tarayıcınızı tamamen kapatıp tekrar deneyin.' });
    }, 8000);
    
    proc.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0) {
        resolve({ success: true, message: 'Çerezler başarıyla okundu ve doğrulandı.' });
      } else {
        let userFriendlyError = errorOutput.trim();
        if (userFriendlyError.includes('Could not copy Chrome cookie database') || userFriendlyError.includes('Could not copy Edge cookie database')) {
          userFriendlyError = 'Tarayıcı çerez veritabanı kilitli! Tarayıcınız açık olabilir, lütfen kapatıp tekrar deneyin.';
        } else if (userFriendlyError.includes('Could not find browser')) {
          userFriendlyError = `Belirtilen tarayıcı bulunamadı veya profil dizini eksik: ${browser.toUpperCase()}`;
        } else {
          userFriendlyError = `Çerez doğrulama hatası (Kod: ${code}): ${userFriendlyError.slice(0, 150)}`;
        }
        resolve({ success: false, error: userFriendlyError });
      }
    });
  });
}

router.get('/ffmpeg/status', (req, res) => {
  const isFfmpegWorking = testFfmpegSync();
  res.json({
    installed: isFfmpegWorking,
    status: ffmpegDownloadState.status,
    progress: ffmpegDownloadState.progress,
    error: ffmpegDownloadState.error
  });
});

router.post('/ffmpeg/download', localhostOnly, (req, res) => {
  downloadFfmpegAsync();
  res.json({ success: true });
});

router.post('/settings/toggle-alt-speed', (req, res) => {
  const db = readDb();
  const oldSpeed = getEffectiveSpeedLimit(db.settings);
  db.settings.useAlternativeSpeed = !db.settings.useAlternativeSpeed;
  const newSpeed = getEffectiveSpeedLimit(db.settings);
  writeDb(db);
  broadcast('db_update', db);
  
  if (oldSpeed !== newSpeed && downloadQueue.activeProcess && downloadQueue.activeVideoId) {
    const videoId = downloadQueue.activeVideoId;
    const historyItem = db.history.find(h => h.id === videoId);
    if (historyItem) {
      downloadQueue.queue.unshift({
        id: videoId,
        title: historyItem.title,
        channelId: historyItem.channelId,
        channelName: historyItem.channelName,
        url: `https://www.youtube.com/watch?v=${videoId}`,
        publishedAt: historyItem.publishedAt || ''
      });
      updateHistoryItem(videoId, {
        status: 'waiting',
        progress: historyItem.progress || 0,
        speed: '',
        eta: ''
      });
      const proc = downloadQueue.activeProcess;
      const pid = proc.pid;
      downloadQueue.activeProcess = null;
      downloadQueue.activeVideoId = null;
      if (downloadQueue.activeDownloads > 0) downloadQueue.activeDownloads--;
      exec(`taskkill /F /T /PID ${pid}`, () => {
        try { proc.kill('SIGKILL'); } catch (e) { /* Kasıtlı sessiz: Süreç sonlandırma hatası */ }
        setTimeout(() => downloadQueue.process(), 1000);
      });
    }
  }
  res.json({ success: true, settings: db.settings });
});

router.post('/settings/toggle-discord-rpc', (req, res) => {
  const db = readDb();
  db.settings.discordRpcEnabled = req.body.discordRpcEnabled === true || req.body.discordRpcEnabled === 'true';
  writeDb(db);
  broadcast('db_update', db);
  
  import('./discord.js').then(({ discordRpc }) => {
    if (db.settings.discordRpcEnabled) {
      discordRpc.connect();
    } else {
      discordRpc.disconnect();
    }
  }).catch(e => console.error('DiscordRPC dynamic import fail:', e.message));
  
  res.json({ success: true, settings: db.settings });
});

function getDirSize(dirPath) {
  let totalSize = 0;
  try {
    const files = fs.readdirSync(dirPath);
    for (const file of files) {
      const filePath = path.join(dirPath, file);
      const stat = fs.statSync(filePath);
      if (stat.isDirectory()) {
        totalSize += getDirSize(filePath);
      } else {
        totalSize += stat.size;
      }
    }
  } catch (e) {
    // Erişim kısıtlaması olan veya silinmiş dosya/klasör hatalarını yutuyoruz
  }
  return totalSize;
}

router.get('/disk-space', (req, res) => {
  const db = readDb();
  const folder = db.settings.downloadPath || defaultDownloadDir;
  
  try {
    if (!fs.existsSync(folder)) {
      fs.mkdirSync(folder, { recursive: true });
    }
    const stats = fs.statfsSync(folder);
    const freeBytes = stats.bfree * stats.bsize;
    const totalBytes = stats.blocks * stats.bsize;
    
    const folderSizeBytes = getDirSize(folder);
    
    const absPath = path.resolve(folder);
    const driveLetterMatch = absPath.match(/^([a-zA-Z]):/);
    const driveLetter = driveLetterMatch ? driveLetterMatch[1].toUpperCase() : '';

    return res.json({
      success: true,
      freeBytes,
      totalBytes,
      folderSizeBytes,
      driveLetter
    });
  } catch (e) {
    console.error('[Disk Space Error]:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// Manuel Yedekleri Yönetmek İçin Yeni Rotalar

// 1. GET /api/settings/backups - Mevcut yedekleri listeler
router.get('/backups', localhostOnly, (req, res) => {
  const backupsDir = path.resolve(process.cwd(), 'backup');
  try {
    if (!fs.existsSync(backupsDir)) {
      return res.json({ success: true, backups: [] });
    }
    const files = fs.readdirSync(backupsDir);
    const backups = files
      .filter(f => f.startsWith('manual_backup_') && f.endsWith('.json'))
      .map(filename => {
        const fullPath = path.join(backupsDir, filename);
        const stats = fs.statSync(fullPath);
        return {
          filename,
          size: (stats.size / 1024).toFixed(1) + ' KB',
          createdAt: stats.birthtime.toISOString()
        };
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      
    res.json({ success: true, backups });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2. POST /api/settings/backup - Yeni yedek paketi oluşturur
router.post('/backup', localhostOnly, (req, res) => {
  try {
    const rootDir = path.resolve(process.cwd());
    const dbFilePath = path.join(rootDir, 'db.json');
    const channelsIniFilePath = path.join(rootDir, 'channels.ini');
    
    // configwin.ini veya configunix.ini hangisi varsa onu yedekle
    const configWinPath = path.join(rootDir, 'configwin.ini');
    const configUnixPath = path.join(rootDir, 'configunix.ini');
    const configPath = fs.existsSync(configWinPath) ? configWinPath : configUnixPath;
    
    const dbContent = fs.existsSync(dbFilePath) ? JSON.parse(fs.readFileSync(dbFilePath, 'utf8')) : null;
    const channelsIniContent = fs.existsSync(channelsIniFilePath) ? fs.readFileSync(channelsIniFilePath, 'utf8') : '';
    const configIniContent = fs.existsSync(configPath) ? fs.readFileSync(configPath, 'utf8') : '';
    
    const backupData = {
      timestamp: new Date().toISOString(),
      version: '7.4.0',
      db: dbContent,
      channelsIni: channelsIniContent,
      configIni: configIniContent,
      configIniName: path.basename(configPath)
    };
    
    const backupsDir = path.resolve(process.cwd(), 'backup');
    if (!fs.existsSync(backupsDir)) {
      fs.mkdirSync(backupsDir, { recursive: true });
    }
    
    // Tarih damgalı dosya adı oluştur
    const now = new Date();
    const dateStr = now.getFullYear() +
      String(now.getMonth() + 1).padStart(2, '0') +
      String(now.getDate()).padStart(2, '0') + '_' +
      String(now.getHours()).padStart(2, '0') +
      String(now.getMinutes()).padStart(2, '0') +
      String(now.getSeconds()).padStart(2, '0');
      
    const backupFilename = `manual_backup_${dateStr}.json`;
    const backupFilePath = path.join(backupsDir, backupFilename);
    
    fs.writeFileSync(backupFilePath, JSON.stringify(backupData, null, 2), 'utf8');
    
    addTerminalLog(`[Sistem] Manuel yedek başarıyla oluşturuldu: ${backupFilename}`, 'success');
    res.json({ success: true, message: 'Yedek başarıyla oluşturuldu.', filename: backupFilename });
  } catch (err) {
    console.error('[Backup Error]:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// 3. POST /api/settings/restore - Seçilen yedeği geri yükler
router.post('/restore', localhostOnly, async (req, res) => {
  const { filename } = req.body;
  if (!filename) return res.status(400).json({ error: 'filename parametresi gereklidir.' });
  
  const backupsDir = path.resolve(process.cwd(), 'backup');
  const backupFilePath = path.join(backupsDir, filename);
  
  if (!fs.existsSync(backupFilePath)) {
    return res.status(404).json({ error: 'Yedek dosyası bulunamadı.' });
  }
  
  try {
    const backupContent = JSON.parse(fs.readFileSync(backupFilePath, 'utf8'));
    const rootDir = path.resolve(process.cwd());
    
    // 1. db.json'ı yaz
    if (backupContent.db) {
      const dbFilePath = path.join(rootDir, 'db.json');
      fs.writeFileSync(dbFilePath, JSON.stringify(backupContent.db, null, 2), 'utf8');
    }
    
    // 2. channels.ini'yi yaz
    if (backupContent.channelsIni) {
      const channelsIniFilePath = path.join(rootDir, 'channels.ini');
      fs.writeFileSync(channelsIniFilePath, backupContent.channelsIni, 'utf8');
    }
    
    // 3. config ini dosyasını yaz
    if (backupContent.configIni) {
      const configIniName = backupContent.configIniName || (os.platform() === 'win32' ? 'configwin.ini' : 'configunix.ini');
      const configPath = path.join(rootDir, configIniName);
      fs.writeFileSync(configPath, backupContent.configIni, 'utf8');
    }
    
    // Veritabanını bellekten disktekiyle senkronize et
    syncDbWithDisk();
    
    addTerminalLog(`[Sistem] Yedek başarıyla geri yüklendi: ${filename}`, 'success');
    res.json({ success: true, message: 'Yedek başarıyla geri yüklendi. Sunucu verileri güncellendi.' });
  } catch (err) {
    console.error('[Restore Error]:', err.message);
    res.status(500).json({ error: err.message });
  }
});
