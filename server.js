// Türkçe Açıklama: HaYTooL YouTube Downloader ana backend sunucu uygulaması.
// Rotalar, veri tabanı eşitlemesi, zamanlayıcılar ve arka plan daimonları bu modülde koordine edilir.

process.env.FORCE_COLOR = '1';
process.env.TERM = 'xterm-256color';

// Konsol çıktılarını başlık türüne göre ANSI renkleriyle renklendirme
const originalLog = console.log;
const originalError = console.error;
const originalWarn = console.warn;

function colorizeText(text) {
  if (typeof text !== 'string') return text;
  
  const reset = '\x1b[0m';
  const red = '\x1b[31m';
  const green = '\x1b[32m';
  const yellow = '\x1b[33m';
  const blue = '\x1b[34m';
  const magenta = '\x1b[35m';
  const cyan = '\x1b[36m';
  const brightBlue = '\x1b[94m';
  const brightMagenta = '\x1b[95m';
  
  let colored = text;
  
  colored = colored.replace(/^(\[RSS\])/g, `${magenta}$1${reset}`);
  colored = colored.replace(/^(\[RSS Fallback\])/g, `${brightMagenta}$1${reset}`);
  colored = colored.replace(/^(\[DOWNLOAD\])/g, `${cyan}$1${reset}`);
  colored = colored.replace(/^(\[DATABASE\])/g, `${yellow}$1${reset}`);
  colored = colored.replace(/^(\[IPTV\])/g, `${brightBlue}$1${reset}`);
  colored = colored.replace(/^(\[SYSTEM\])/g, `${green}$1${reset}`);
  colored = colored.replace(/^(\[API\])/g, `${blue}$1${reset}`);
  colored = colored.replace(/^(\[HATA\]|\[ERROR\])/gi, `${red}$1${reset}`);
  
  return colored;
}

console.log = function(...args) {
  const colorized = args.map(arg => colorizeText(arg));
  originalLog.apply(console, colorized);
};

console.error = function(...args) {
  const reset = '\x1b[0m';
  const red = '\x1b[31m';
  const colorized = args.map(arg => {
    if (typeof arg === 'string') {
      return `${red}${arg}${reset}`;
    }
    return arg;
  });
  originalError.apply(console, colorized);
};

console.warn = function(...args) {
  const reset = '\x1b[0m';
  const yellow = '\x1b[33m';
  const colorized = args.map(arg => {
    if (typeof arg === 'string') {
      return `${yellow}${arg}${reset}`;
    }
    return arg;
  });
  originalWarn.apply(console, colorized);
};

import express from 'express';
import fs from 'fs';
import path from 'path';
import os from 'os';
import net from 'net';
import https from 'https';
import http from 'http';
import open from 'open';
import { exec } from 'child_process';
import { fileURLToPath } from 'url';

// Çekirdek Backend Modülleri
import { 
  readDb, 
  writeDb, 
  syncDbWithDisk, 
  updateHistoryItem 
} from './server/database.js';
import { 
  getFfmpegPath, 
  ytdlpPath 
} from './server/services/paths.js';
import { downloadQueue, getEffectiveSpeedLimit } from './server/services/downloader.js';
import { 
  checkNextChannelRss, 
  resolveMissingDurations, 
  fetchVideoDuration 
} from './server/services/rss.js';
import { addTerminalLog, broadcast } from './server/services/sse.js';
import { discordRpc } from './server/services/discord.js';
import { setIptvChannels } from './server/services/iptv.js';
import { configIniPath, parseIni } from './server/config.js';

// API Rotası Modülleri
import { router as settingsRouter } from './server/routes/settings.js';
import { router as channelsRouter } from './server/routes/channels.js';
import { router as historyRouter } from './server/routes/history.js';
import { router as iptvRouter } from './server/routes/iptv.js';
import { router as streamsRouter } from './server/routes/streams.js';
import { router as queueRouter } from './server/routes/queue.js';
import { router as downloaderRouter } from './server/routes/downloader.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Port Ayarlarını configwin.ini/configunix.ini üzerinden oku
const config = parseIni(configIniPath);
const settingsSection = config.Settings || config;
const PORT = parseInt(settingsSection.port || settingsSection.Port || 4141, 10);

// Dizin Tanımları
const logsDir = path.join(process.cwd(), 'logs');
const iptvCachePath = path.join(process.cwd(), 'iptv_cache.json');

// Express Uygulaması Kurulumu
const app = express();
app.use(express.json());

// Statik Dosyaları Sun (public/ klasörü)
app.use(express.static(path.join(__dirname, 'public')));

// Geliştirme/Hata Ayıklama Günlükleri (İsteğe bağlı)
const isDev = process.env.NODE_ENV === 'development';

// API Rota Grupları
app.use('/api', queueRouter);
app.use('/api', settingsRouter);
app.use('/api/channels', channelsRouter);
app.use('/api', historyRouter);
app.use('/api/iptv', iptvRouter);
app.use('/api', streamsRouter);
app.use('/api/downloader', downloaderRouter);
// GitHub Güncelleme Kontrolü Rotası
app.get('/api/updates/check', (req, res) => {
  res.json(updateState);
});

app.post('/api/updates/check', async (req, res) => {
  await checkGithubUpdates();
  res.json(updateState);
});

// Discord RPC Aktif Oynatılan Video Durumu
app.post('/api/player/activity', (req, res) => {
  const { title, channelName } = req.body;
  const db = readDb();
  if (db.settings.discordRpcEnabled !== false) {
    discordRpc.setActivity(title || null, channelName || null);
  }
  res.json({ success: true });
});

// SPA Yönlendirmesi (IPTV Dahil)
app.get(['/home', '/download', '/downlist', '/channels', '/settings', '/iptv', '/downloader', '/tools'], (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Başlangıç Yolu ve Veritabanı Doğrulama Kontrolleri
const initialDbState = readDb();
downloadQueue.isPaused = !!initialDbState.settings.isPaused;

// IPTV Önbelleğini Yükle
if (fs.existsSync(iptvCachePath)) {
  try {
    const data = JSON.parse(fs.readFileSync(iptvCachePath, 'utf8'));
    if (data && data.channels) {
      setIptvChannels(data.channels);
      console.log(`[IPTV] ${data.channels.length} kanal önbellekten başarıyla yüklendi.`);
    }
  } catch (err) {
    console.error('[IPTV] Önbellek dosyası yüklenemedi:', err.message);
  }
}

// Zamanlayıcı Taraması (Settings rotası tarafından da kontrol edilebilir)
let checkIntervalTimer = null;
function startIntervalTimer() {
  const db = readDb();
  if (checkIntervalTimer) {
    clearInterval(checkIntervalTimer);
    checkIntervalTimer = null;
  }

  if (db.settings.isPaused) return;

  const seconds = db.settings.channelCheckInterval || 300;
  
  checkIntervalTimer = setInterval(async () => {
    try {
      await checkNextChannelRss();
    } catch (err) {
      console.error('[Zamanlayıcı] RSS kontrolü çalıştırılamadı:', err.message);
    }
  }, seconds * 1000);
}

// GitHub Otomatik Güncelleme Kontrolü Durumu
let updateState = {
  updateAvailable: false,
  latestVersion: null,
  releaseUrl: null,
  releaseNotes: null,
  checkedAt: null
};

async function checkGithubUpdates() {
  const currentVersion = '7.1.0';
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);
    
    const response = await fetch('https://api.github.com/repos/HaYToKoRaZ/haytool-youtube-download/releases/latest', {
      headers: {
        'User-Agent': 'HaYTooL-YT-Downloader-UpdateChecker'
      },
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (response.ok) {
      const data = await response.json();
      if (data && data.tag_name) {
        const remoteTag = data.tag_name.trim();
        const remoteVer = remoteTag.replace(/^v/, '');
        
        const compareVersions = (v1, v2) => {
          const parts1 = v1.split('.').map(Number);
          const parts2 = v2.split('.').map(Number);
          for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
            const p1 = parts1[i] || 0;
            const p2 = parts2[i] || 0;
            if (p1 > p2) return 1;
            if (p1 < p2) return -1;
          }
          return 0;
        };

        if (compareVersions(remoteVer, currentVersion) > 0) {
          updateState = {
            updateAvailable: true,
            latestVersion: remoteTag,
            releaseUrl: data.html_url || 'https://github.com/HaYToKoRaZ/haytool-youtube-download/releases',
            releaseNotes: data.body || '',
            checkedAt: new Date().toISOString()
          };
          console.log(`Yeni bir güncelleme mevcut: ${remoteTag}. Geçerli sürüm: v${currentVersion}`);
          broadcast('update_status', updateState);
        } else {
          updateState = {
            updateAvailable: false,
            latestVersion: remoteTag,
            releaseUrl: null,
            releaseNotes: null,
            checkedAt: new Date().toISOString()
          };
          console.log(`Yazılım güncel. Geçerli sürüm: v${currentVersion}, En son sürüm: ${remoteTag}`);
        }
      }
    }
  } catch (err) {
    console.warn('GitHub güncelleme kontrolü sırasında hata oluştu:', err.message);
  }
}

// yt-dlp binary varlığını doğrula
function ensureYtdlp() {
  return new Promise((resolve, reject) => {
    const filename = os.platform() === 'win32' ? 'yt-dlp.exe' : 'yt-dlp';
    if (fs.existsSync(ytdlpPath)) {
      console.log(`${filename} zaten mevcut.`);
      return resolve(ytdlpPath);
    }
    const err = new Error(`${filename} bulunamadı! Lütfen yt-dlp/ klasörü altına ${filename} dosyasını ekleyin.`);
    console.error(err.message);
    broadcast('status_log', { message: err.message, type: 'error' });
    reject(err);
  });
}

// FFmpeg binary varlığını doğrula
function ensureFfmpeg() {
  const ffmpegPath = getFfmpegPath();
  if (fs.existsSync(ffmpegPath)) return Promise.resolve(ffmpegPath);
  
  const err = new Error('FFmpeg bulunamadı! Lütfen ffmpeg/ klasörü altına ffmpeg.exe ve ffprobe.exe dosyalarını ekleyin.');
  broadcast('status_log', { message: err.message, type: 'error' });
  return Promise.reject(err);
}

// hls.min.js kontrol et ve gerekliyse indir (IPTV offline oynatımı için)
function downloadHlsJsIfNeeded() {
  return new Promise((resolve) => {
    const publicDir = path.join(__dirname, 'public');
    const hlsPath = path.join(publicDir, 'hls.min.js');
    if (fs.existsSync(hlsPath)) {
      console.log('[IPTV] hls.min.js zaten mevcut.');
      return resolve();
    }

    console.log('[IPTV] hls.min.js bulunamadı, CDN üzerinden indiriliyor...');
    const url = 'https://cdnjs.cloudflare.com/ajax/libs/hls.js/1.5.8/hls.min.js';
    
    https.get(url, (res) => {
      if (res.statusCode !== 200) {
        console.error(`[IPTV] hls.min.js indirilemedi: HTTP ${res.statusCode}`);
        return resolve();
      }

      const fileStream = fs.createWriteStream(hlsPath);
      res.pipe(fileStream);
      fileStream.on('finish', () => {
        fileStream.close();
        console.log('[IPTV] hls.min.js başarıyla indirildi.');
        resolve();
      });
      fileStream.on('error', (err) => {
        fileStream.close();
        fs.unlink(hlsPath, () => {});
        console.error('[IPTV] hls.min.js yazılırken hata oluştu:', err.message);
        resolve();
      });
    }).on('error', (err) => {
      console.error('[IPTV] hls.min.js indirilirken bağlantı hatası oluştu:', err.message);
      resolve();
    });
  });
}

// 7 günden eski günlük dosyalarını temizle
function cleanOldLogs() {
  try {
    if (!fs.existsSync(logsDir)) return;
    const files = fs.readdirSync(logsDir);
    const now = Date.now();
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    
    let deletedCount = 0;
    for (const file of files) {
      if (file.endsWith('.log')) {
        const filePath = path.join(logsDir, file);
        const stats = fs.statSync(filePath);
        if (now - stats.mtimeMs > sevenDaysMs) {
          fs.unlinkSync(filePath);
          deletedCount++;
        }
      }
    }
    if (deletedCount > 0) {
      console.log(`[Log Temizleyici] 7 günden eski ${deletedCount} adet log dosyası silindi.`);
    }
  } catch (err) {
    console.error('[Log Temizleyici] Log dosyaları temizlenirken hata oluştu:', err.message);
  }
}

// Süresi dolmuş videoları otomatik sil
function autoDeleteOldVideos() {
  const db = readDb();
  const autoDeleteDays = db.settings.autoDeleteDays || 0;
  if (autoDeleteDays <= 0) return;

  const thresholdMs = autoDeleteDays * 24 * 60 * 60 * 1000;
  const now = Date.now();
  let updated = false;

  for (const item of db.history) {
    if (item.status === 'completed' && item.filePath) {
      if (fs.existsSync(item.filePath)) {
        try {
          const stats = fs.statSync(item.filePath);
          const fileTime = stats.birthtimeMs || stats.mtimeMs || stats.ctimeMs;
          const ageMs = now - fileTime;

          if (ageMs > thresholdMs) {
            console.log(`[Auto-Delete] Video süresi doldu, siliniyor: ${item.title}`);
            fs.unlinkSync(item.filePath);
            
            const ext = path.extname(item.filePath);
            const thumbJpg = item.filePath.replace(ext, '.jpg');
            const thumbWebp = item.filePath.replace(ext, '.webp');
            const descFile = item.filePath.replace(ext, '.description');
            if (fs.existsSync(thumbJpg)) fs.unlinkSync(thumbJpg);
            if (fs.existsSync(thumbWebp)) fs.unlinkSync(thumbWebp);
            if (fs.existsSync(descFile)) fs.unlinkSync(descFile);

            const trSrt = item.filePath.replace(ext, '.tr.srt');
            const enSrt = item.filePath.replace(ext, '.en.srt');
            const trVtt = item.filePath.replace(ext, '.tr.vtt');
            const enVtt = item.filePath.replace(ext, '.en.vtt');
            if (fs.existsSync(trSrt)) fs.unlinkSync(trSrt);
            if (fs.existsSync(enSrt)) fs.unlinkSync(enSrt);
            if (fs.existsSync(trVtt)) fs.unlinkSync(trVtt);
            if (fs.existsSync(enVtt)) fs.unlinkSync(enVtt);

            item.status = 'ignored';
            item.filePath = '';
            item.fileSize = '';
            updated = true;
            addTerminalLog(`[Oto-Silme] ${autoDeleteDays} günü aşan "${item.title}" videosu diskten otomatik olarak silindi.`, 'info');
          }
        } catch (err) {
          console.error(`[Auto-Delete] Dosya silme hatası (${item.title}):`, err.message);
        }
      } else {
        item.status = 'ignored';
        item.filePath = '';
        item.fileSize = '';
        updated = true;
      }
    }
  }

  if (updated) {
    writeDb(db);
    broadcast('db_update', db);
  }
}

// Konsoldan alternatif hız limitini değiştirince aktif indirmeyi yeniden başlat
function restartActiveDownloadWithNewLimit(db, oldSpeedLimit, newSpeedLimit) {
  const videoId = downloadQueue.activeVideoId;
  const historyItem = db.history.find(h => h.id === videoId);
  if (historyItem) {
    console.log(`[Console] Hız sınırı değişti (${oldSpeedLimit} -> ${newSpeedLimit}). Aktif indirme yeni hız sınırı ile yeniden başlatılıyor: ${historyItem.title}`);
    addTerminalLog(`[Console] Hız sınırı değişti. Aktif indirme yeni hız sınırı ile yeniden başlatılıyor: "${historyItem.title}"`, 'info');
    
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
    
    if (pid) {
      exec(`taskkill /F /T /PID ${pid}`, (err) => {
        try {
          proc.kill('SIGKILL');
        } catch (e) {}
        
        setTimeout(() => {
          downloadQueue.process();
        }, 1000);
      });
    }
  }
}

// Konsol yardımıyla URL üzerinden kuyruğa video ekleme
async function addVideoToQueueByUrl(urlText) {
  const youtubeRegex = /(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/))([^?&"'>\s]{11})/;
  const match = urlText.match(youtubeRegex);
  if (!match) {
    throw new Error('Geçersiz YouTube video linki.');
  }
  const videoId = match[1];

  let title = '';
  let channelName = '';
  let channelId = '';

  try {
    const details = await fetchVideoDuration(videoId);
    if (details) {
      if (details.title) title = details.title;
      if (details.channelName) channelName = details.channelName;
      if (details.channelId) channelId = details.channelId;
    }
  } catch (err) {
    console.error(`[Console pd] Video bilgileri alınamadı:`, err.message);
  }

  downloadQueue.add({
    id: videoId,
    title: title || 'Bilinmeyen Video',
    channelId: channelId || 'manual',
    channelName: channelName || 'Manuel İndirme',
    url: `https://www.youtube.com/watch?v=${videoId}`,
    publishedAt: ''
  });

  resolveMissingDurations();
  return videoId;
}

// Konsol (stdin) Komut Dinleyicisi
process.stdin.setEncoding('utf8');
process.stdin.on('close', () => {
  console.log('[Sistem] Standart giriş kapandı (stdin close). Backend sonlandırılıyor...');
  process.exit(0);
});
process.stdin.on('end', () => {
  console.log('[Sistem] Standart giriş sona erdi (stdin end). Backend sonlandırılıyor...');
  process.exit(0);
});

process.stdin.on('data', (data) => {
  const line = data.toString().trim();
  if (!line) return;

  const parts = line.split(' ');
  const command = parts[0].toLowerCase();
  const args = parts.slice(1);

  if (command === 'help' || command === '?') {
    console.log('[Console] Kullanılabilir komutlar:\n' +
                '  - status (Hız ve kuyruk durumunu gösterir)\n' +
                '  - ton (Alternatif kaplumbağa hız limitini açar)\n' +
                '  - toff (Alternatif kaplumbağa hız limitini kapatır)\n' +
                '  - pd <link> (Verilen YouTube URL\'sini indirme sırasına ekler)\n' +
                '  - clear (Konsol ekranını temizler)');
    return;
  }

  const db = readDb();

  if (command === 'ton') {
    const oldLimit = getEffectiveSpeedLimit(db.settings);
    db.settings.useAlternativeSpeed = true;
    const newLimit = getEffectiveSpeedLimit(db.settings);
    const speedLimitChanged = oldLimit !== newLimit;
    writeDb(db);
    broadcast('db_update', db);
    addTerminalLog(`[Console] Alternative speed limit (Turtle) ENABLED.`, 'info');
    console.log(`[Console] Alternative speed limit (Turtle) ENABLED. Limit: ${newLimit} KB/s`);
    if (speedLimitChanged && downloadQueue.activeProcess && downloadQueue.activeVideoId) {
      restartActiveDownloadWithNewLimit(db, oldLimit, newLimit);
    }
  } else if (command === 'toff') {
    const oldLimit = getEffectiveSpeedLimit(db.settings);
    db.settings.useAlternativeSpeed = false;
    const newLimit = getEffectiveSpeedLimit(db.settings);
    const speedLimitChanged = oldLimit !== newLimit;
    writeDb(db);
    broadcast('db_update', db);
    addTerminalLog(`[Console] Alternative speed limit (Turtle) DISABLED.`, 'info');
    console.log(`[Console] Alternative speed limit (Turtle) DISABLED. Limit: ${newLimit} KB/s`);
    if (speedLimitChanged && downloadQueue.activeProcess && downloadQueue.activeVideoId) {
      restartActiveDownloadWithNewLimit(db, oldLimit, newLimit);
    }
  } else if (command === 'status') {
    const effective = getEffectiveSpeedLimit(db.settings);
    const altStatus = db.settings.useAlternativeSpeed ? 'Active' : 'Inactive';
    console.log(`[Console] Durum:
      - Normal Hız Limiti: ${db.settings.downloadSpeedLimit} KB/s
      - Alternatif Hız Limiti: ${db.settings.alternativeSpeedLimit} KB/s
      - Alternatif Hız (Kaplumbağa) Aktif: ${altStatus}
      - Geçerli Limit: ${effective} KB/s
      - Aktif İndirme: ${downloadQueue.activeVideoId ? 'Evet' : 'Hayır'}`);
  } else if (command === 'pd') {
    const link = args[0];
    if (!link) {
      console.log('[Console] Hata: YouTube video adresi belirtmelisiniz. Örnek: pd https://www.youtube.com/watch?v=dQw4w9WgXcQ');
      return;
    }
    addVideoToQueueByUrl(link)
      .then(vid => {
        addTerminalLog(`[Console] Video kuyruğa başarıyla eklendi. ID: ${vid}`, 'success');
        console.log(`[Console] Video kuyruğa başarıyla eklendi. ID: ${vid}`);
      })
      .catch(err => {
        addTerminalLog(`[Console] Hata: ${err.message}`, 'error');
        console.log(`[Console] Hata: ${err.message}`);
      });
  } else if (command === 'clear') {
    console.clear();
  } else {
    console.log('[Console] Bilinmeyen komut. Kullanılabilir komutlar: ton, toff, pd <video-link>, status, clear, help');
  }
});

// Sunucu Başlatıldığında
if (process.argv.length <= 2) {
  const server = app.listen(PORT, '127.0.0.1', async () => {
    await downloadHlsJsIfNeeded();
    cleanOldLogs();

    const db = readDb();
    console.log(`[TRAY_CMD] lang=${db.settings.lang || 'tr'}`);

    if (db.settings.discordRpcEnabled) {
      discordRpc.connect();
    }

    console.log(`
    ====================================================
     _    _         __     __ _______  ___   ___   _      
    | |  | |  __ _  \\ \\   / /|__   __|/ _ \\ / _ \\ | |     
    | |__| | / _\` |  \\ \\_/ /    | |  | (_) | (_) || |     
    |  __  || (_| |   \\   /     | |   \\___/ \\___/ | |     
    | |  | | \\__,_|    | |      | |               | |____ 
    |_|  |_|           |_|      |_|               |______|

               -- Premium Otomasyonu --
                      Versiyon: v7.1.0
           Yapımcı: HaYTo
    ====================================================
    `);
    console.log(`Sunucu http://localhost:${PORT} portunda çalışıyor.`);
    
    if (!fs.existsSync(db.settings.downloadPath)) {
      try {
        fs.mkdirSync(db.settings.downloadPath, { recursive: true });
      } catch (err) {}
    }

    // Disk senkronizasyonunu başlat
    setTimeout(() => {
      syncDbWithDisk();
    }, 1000);
    setInterval(syncDbWithDisk, 5 * 60 * 1000);
    
    // Bozuk kanal kayıtlarını temizle
    const originalCount = db.channels.length;
    db.channels = db.channels.filter(c => c.name !== c.id);
    if (db.channels.length !== originalCount) {
      console.log(`[Ayarlar] İsmi ve ID'si aynı olan ${originalCount - db.channels.length} adet bozuk kanal veritabanından temizlendi.`);
      writeDb(db);
    }

    addTerminalLog(`[Sistem] Sunucu başarıyla başlatıldı. Adres: http://localhost:${PORT}`, 'success');
    addTerminalLog(`[Sistem] Otomatik indirme klasörü: "${db.settings.downloadPath}"`, 'info');
    
    try {
      await ensureYtdlp();
    } catch (e) {
      console.error('yt-dlp kontrolü başarısız oldu:', e.message);
    }

    if (db.settings.mergeType === 'merge' && !fs.existsSync(getFfmpegPath())) {
      ensureFfmpeg().catch(e => console.error('FFmpeg kontrol hatası:', e.message));
    }

    startIntervalTimer();

    // RSS kanallarını tarama döngüsünü başlat
    setTimeout(() => {
      checkNextChannelRss();
    }, 3000);

    // Otomatik video silme döngüsü
    setTimeout(() => {
      autoDeleteOldVideos();
    }, 8000);
    setInterval(autoDeleteOldVideos, 60 * 60 * 1000);

    // Eksik video sürelerini çözücü tetikle
    setTimeout(() => {
      resolveMissingDurations();
    }, 6000);

    // Başlangıçta kuyruğa bekleyen/yarım kalan indirmeleri ekle
    setTimeout(() => {
      const currentDb = readDb();
      let queuedCount = 0;
      currentDb.history.forEach(item => {
        if (item.status === 'waiting' || item.status === 'downloading') {
          downloadQueue.add({
            id: item.id,
            title: item.title,
            channelId: item.channelId,
            channelName: item.channelName,
            url: `https://www.youtube.com/watch?v=${item.id}`,
            publishedAt: item.publishedAt || ''
          });
          queuedCount++;
        }
      });
      if (queuedCount > 0) {
        console.log(`[Sistem] Sunucu başlangıcında ${queuedCount} adet yarım kalan/bekleyen indirme kuyruğa yeniden eklendi.`);
        addTerminalLog(`[Sistem] Sunucu başlangıcında ${queuedCount} adet yarım kalan/bekleyen indirme kuyruğa yeniden eklendi.`, 'info');
      }
    }, 4000);

    // GitHub güncellemelerini kontrol et
    setTimeout(() => {
      checkGithubUpdates().catch(err => console.error('GitHub güncelleme kontrolü başlatılamadı:', err.message));
    }, 5000);
    setInterval(() => {
      checkGithubUpdates().catch(err => console.error('GitHub güncelleme kontrolü yenilenemedi:', err.message));
    }, 12 * 60 * 60 * 1000);

    // Tarayıcıyı aç
    const currentDbState = readDb();
    if (currentDbState.settings.autoOpenBrowser !== false) {
      try {
        await open(`http://localhost:${PORT}`);
      } catch (e) {
        console.log(`Tarayıcı otomatik açılamadı, lütfen http://localhost:${PORT} adresine manuel gidin.`);
      }
    } else {
      console.log(`Otomatik tarayıcı açılışı devre dışı bırakıldı. Lütfen http://localhost:${PORT} adresine el ile gidin.`);
    }
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      let dbLang = 'tr';
      try {
        const db = readDb();
        dbLang = db.settings.lang || 'tr';
      } catch (e) {}

      if (dbLang === 'en') {
        console.error(`\n[ERROR] Port ${PORT} is already in use by another application or process!`);
        console.error(`Please close other background server processes or change the 'port' setting in configwin.ini.\n`);
      } else if (dbLang === 'es') {
        console.error(`\n[ERROR] ¡El puerto ${PORT} ya está siendo utilizado por otra aplicación o proceso!`);
        console.error(`Cierre otros procesos del servidor en segundo plano o cambie el puerto en configwin.ini.\n`);
      } else if (dbLang === 'de') {
        console.error(`\n[FEHLER] Port ${PORT} wird bereits von einer anderen Anwendung oder einem anderen Prozess verwendet!`);
        console.error(`Bitte schließen Sie andere Hintergrundserver-Prozesse oder ändern Sie den Port in configwin.ini.\n`);
      } else if (dbLang === 'pt') {
        console.error(`\n[ERRO] A porta ${PORT} já está em uso por outro aplicativo ou processo!`);
        console.error(`Feche outros processos do servidor em segundo plano ou altere a porta no configwin.ini.\n`);
      } else if (dbLang === 'ar') {
        console.error(`\n[خطأ] المنفذ ${PORT} مستخدم بالفعل بواسطة تطبيق أو عملية أخرى!`);
        console.error(`يرجى إغلاق عمليات الخادم الخلفية الأخرى أو تغيير المنفذ في configwin.ini.\n`);
      } else {
        console.error(`\n[HATA] Port ${PORT} başka bir uygulama veya süreç tarafından kullanılıyor!`);
        console.error(`Lütfen arka plandaki diğer sunucu süreçlerini kapatın veya configwin.ini dosyasından 'port' ayarını değiştirin.\n`);
      }
      process.exit(1);
    } else {
      console.error('Sunucu başlatılırken hata oluştu:', err.message);
      process.exit(1);
    }
  });
}
