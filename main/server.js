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
  const bold = '\x1b[1m';
  const red = '\x1b[31m';
  const green = '\x1b[32m';
  const yellow = '\x1b[33m';
  const blue = '\x1b[34m';
  const magenta = '\x1b[35m';
  const cyan = '\x1b[36m';
  const brightGreen = '\x1b[92m';
  const brightYellow = '\x1b[93m';
  const brightBlue = '\x1b[94m';
  const brightMagenta = '\x1b[95m';
  const brightCyan = '\x1b[96m';
  
  let colored = text;
  
  // Tag renklendirmeleri
  colored = colored.replace(/^(\[INFO\])/gi, `${brightBlue}$1${reset}`);
  colored = colored.replace(/^(\[SUCCESS\])/gi, `${green}$1${reset}`);
  colored = colored.replace(/^(\[WARN(?:ING)?\])/gi, `${yellow}$1${reset}`);
  colored = colored.replace(/^(\[RSS\])/g, `${magenta}$1${reset}`);
  colored = colored.replace(/^(\[RSS Fallback\])/g, `${brightMagenta}$1${reset}`);
  colored = colored.replace(/^(\[DOWNLOAD\]|\[İNDİRME\])/gi, `${cyan}$1${reset}`);
  colored = colored.replace(/^(\[KOMUT\])/gi, `${yellow}$1${reset}`);
  colored = colored.replace(/^(\[yt-dlp Uyarı\]|yt-dlp uyarı satırı:)/gi, `${yellow}$1${reset}`);
  colored = colored.replace(/^(\[yt-dlp\])/gi, `${brightMagenta}$1${reset}`);
  colored = colored.replace(/^(\[GIST\]|\[Gist\])/gi, `${brightMagenta}$1${reset}`);
  colored = colored.replace(/^(\[DATABASE\])/g, `${yellow}$1${reset}`);
  colored = colored.replace(/^(\[IPTV\])/g, `${brightBlue}$1${reset}`);
  colored = colored.replace(/^(\[SYSTEM\]|\[Sistem\])/g, `${green}$1${reset}`);
  colored = colored.replace(/^(\[API\])/g, `${blue}$1${reset}`);
  colored = colored.replace(/^(\[HATA\]|\[ERROR\])/gi, `${red}$1${reset}`);

  // [Abone & Avatar 70/101] veya [Kanal Logosu 70/101] veya [Abone Sayısı 70/101] veya [ 70/101] veya [70/101] sayacı renklendirme (Parlak Sarı/Kalın)
  colored = colored.replace(/\[([^\]]*?)(\b\d+\/\d+\b)([^\]]*?)\]/g, 
    `${brightMagenta}[$1${reset}${bold}${brightYellow}$2${reset}${brightMagenta}$3]${reset}`
  );

  // Tırnak içerisindeki kanal adı veya video başlıklarını parlak camgöbeği ve kalın yap
  colored = colored.replace(/"([^"\r\n]+)"/g, 
    `"${bold}${brightCyan}$1${reset}"`
  );

  return colored;
}

import fs from 'fs';
import path from 'path';
import { dataRootDir } from './server/config.js';

// Oturum Log Yönetimi ve Otomatik Rotasyon (Son 30 oturum logu saklanır)
const logsDir = path.join(dataRootDir, 'logs');
if (!fs.existsSync(logsDir)) {
  try { fs.mkdirSync(logsDir, { recursive: true }); } catch (e) {}
} else {
  try {
    const logFiles = fs.readdirSync(logsDir)
      .filter(file => file.startsWith('haytool_session_') && file.endsWith('.log'))
      .map(file => ({
        name: file,
        path: path.join(logsDir, file),
        time: fs.statSync(path.join(logsDir, file)).mtime.getTime()
      }))
      .sort((a, b) => b.time - a.time);

    const MAX_LOG_FILES = 30;
    if (logFiles.length > MAX_LOG_FILES) {
      logFiles.slice(MAX_LOG_FILES).forEach(oldLog => {
        try { fs.unlinkSync(oldLog.path); } catch (_) {}
      });
    }
  } catch (e) {}
}

function getSessionTimestamp() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const mins = String(d.getMinutes()).padStart(2, '0');
  const secs = String(d.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${day}_${hours}-${mins}-${secs}`;
}

const sessionLogFile = path.join(logsDir, `haytool_session_${getSessionTimestamp()}.log`);

function appendSessionLog(text) {
  if (!text) return;
  const cleanText = String(text).replace(/\x1b\[[0-9;]*m/g, '');
  const timestamp = new Date().toLocaleTimeString('tr-TR');
  const line = `[${timestamp}] ${cleanText}\n`;
  fs.appendFile(sessionLogFile, line, 'utf8', () => {});
}

console.log = function(...args) {
  const text = args.map(arg => (typeof arg === 'string' ? arg : JSON.stringify(arg))).join(' ');
  appendSessionLog(text);
  const colorized = args.map(arg => colorizeText(arg));
  originalLog.apply(console, colorized);
};

console.error = function(...args) {
  const text = args.map(arg => (typeof arg === 'string' ? arg : JSON.stringify(arg))).join(' ');
  appendSessionLog(`[HATA] ${text}`);
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
  const text = args.map(arg => (typeof arg === 'string' ? arg : JSON.stringify(arg))).join(' ');
  appendSessionLog(`[UYARI] ${text}`);
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

// Asenkron süreç ve iş parçacığı hata yakalayıcıları (nodejs-backend-patterns)
process.on('unhandledRejection', (reason) => {
  console.error('[Unhandled Rejection]', reason && reason.stack ? reason.stack : reason);
});

process.on('uncaughtException', (err) => {
  console.error('[Uncaught Exception]', err && err.stack ? err.stack : err);
});


import express from 'express';
import os from 'os';
import net from 'net';
import https from 'https';
import http from 'http';
import open from 'open';
import { exec, execSync } from 'child_process';
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
  ytdlpPath,
  cleanLocalTempDir 
} from './server/services/paths.js';
import { downloadQueue, getEffectiveSpeedLimit, performYtdlpUpdate, resolveItemDownloadUrl, showWindowsNotification } from './server/services/downloader.js';
import { playAppSound } from './server/services/soundService.js';
import { 
  triggerChannelCheck,
  resolveMissingDurations, 
  fetchVideoDuration,
  checkPendingLiveStreams
} from './server/services/rss.js';
import { addTerminalLog, broadcast, attachConsoleBridge } from './server/services/sse.js';
import { startCookieHealthCheck } from './server/services/cookieHealth.js';
import { startNetworkHealthCheck } from './server/services/networkHealth.js';
import { startFakapService, cleanupExpired } from './server/services/fakapService.js';
import { startMaintenanceService } from './server/services/maintenanceService.js';
import { gzipSync } from 'zlib';
import { discordRpc } from './server/services/discord.js';
import { setIptvChannels, downloadHlsJsIfNeeded } from './server/services/iptv.js';
import { checkAndProcessAutoDelete } from './server/services/autoDeleteService.js';
import { configIniPath, parseIni } from './server/config.js';
import { appVersion } from './server/version.js';

// API Rotası Modülleri
import { router as settingsRouter, ensureDailySystemBackup, triggerSilentCookieRefresh, setupPeriodicDiskSync, startIntervalTimer, startLiveStreamTimer } from './server/routes/settings.js';
import { router as channelsRouter } from './server/routes/channels.js';
import { router as historyRouter } from './server/routes/history.js';
import { router as iptvRouter } from './server/routes/iptv.js';
import { router as streamsRouter } from './server/routes/streams.js';
import { router as queueRouter } from './server/routes/queue.js';
import { router as downloaderRouter } from './server/routes/downloader.js';
import { router as gistRouter } from './server/routes/gist.js';
import { router as fakapRouter } from './server/routes/fakap.js';
import { router as clientLogRouter } from './server/routes/clientlog.js';
import { mergeQueue } from './server/services/mergeQueue.js';
import { localhostOnly } from './server/middleware/security.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Port Ayarlarını configwin.ini/configunix.ini üzerinden oku
const config = parseIni(configIniPath);
const settingsSection = config.Settings || config;
const PORT = parseInt(settingsSection.port || settingsSection.Port || 4141, 10);

// Dizin Tanımları
const iptvCachePath = path.join(dataRootDir, 'iptv_cache.json');

// Ham konsol köprüsü: stdout/stderr'i canlı konsolun "Ham Çıktı" moduna aktarır.
attachConsoleBridge();

// Express Uygulaması Kurulumu
const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '2mb' }));

// Türkçe Açıklama: Vanilla zlib ile gzip sıkıştırma middleware'i.
// Yalnızca gzip destekleyen istemcilere ve 1KB üzeri yanıtlara uygulanır.
// SSE (EventSource) yanıtları res.write ile aktığı için bu katmandan etkilenmez.
app.use((req, res, next) => {
  const acceptEncoding = req.headers['accept-encoding'] || '';
  if (!acceptEncoding.includes('gzip')) return next();
  const originalSend = res.send.bind(res);
  res.send = (body) => {
    const buf = Buffer.isBuffer(body) ? body : (typeof body === 'string' ? Buffer.from(body, 'utf8') : null);
    if (buf && buf.length > 1024) {
      res.setHeader('Content-Encoding', 'gzip');
      res.setHeader('Vary', 'Accept-Encoding');
      return originalSend(gzipSync(buf));
    }
    return originalSend(body);
  };
  next();
});

// JS ve CSS dosyaları için her zaman en güncel sürümün yüklenmesini sağla (Önbellek kilidini kaldır)
app.use((req, res, next) => {
  if (req.path === '/app.js' || req.path.endsWith('.js') || req.path.endsWith('.css')) {
    res.setHeader('Cache-Control', 'no-cache, must-revalidate');
  }
  next();
});

// Statik Dosyaları Sun (public/ klasörü, index.html otomatik gönderimi devre dışı)
app.use(express.static(path.join(__dirname, 'public'), {
  index: false,
  maxAge: 0,
  setHeaders: (res, filePath) => {
    // Statik kütüphane ve medya varlıkları için tarayıcı önbelleklemesi (1 gün) - style.css hariç
    if (/\.(min\.js|png|jpg|jpeg|svg|woff2?)$/i.test(filePath) && !filePath.endsWith('style.css')) {
      res.setHeader('Cache-Control', 'public, max-age=86400');
    } else {
      res.setHeader('Cache-Control', 'no-cache, must-revalidate');
    }
  }
}));

// Geliştirme/Hata Ayıklama Günlükleri (İsteğe bağlı)
const isDev = process.env.NODE_ENV === 'development';

// API Rota Grupları
app.use('/api', localhostOnly);
app.use('/api', queueRouter);
app.use('/api', settingsRouter);
app.use('/api/channels', channelsRouter);
app.use('/api', historyRouter);
app.use('/api/iptv', iptvRouter);
app.use('/api', streamsRouter);
app.use('/api/downloader', downloaderRouter);
app.use('/api/gist', gistRouter);
app.use('/api/fakap', fakapRouter);
app.use('/api', clientLogRouter);
app.get('/api/version', (req, res) => {
  res.json({ version: appVersion });
});
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

/**
 * public/partials/ altındaki modüler HTML parçalarını index.html şablonu ile anında birleştirir.
 * @returns {string} Birleştirilmiş eksiksiz HTML içeriği
 */
export function getCompositeIndexHtml() {
  const publicDir = path.join(__dirname, 'public');
  const partialsDir = path.join(publicDir, 'partials');
  const indexPath = path.join(publicDir, 'index.html');
  let html = fs.readFileSync(indexPath, 'utf8');

  const partialMap = {
    '<!--PARTIAL:header-->': 'header.html',
    '<!--PARTIAL:tab-channels-->': 'tab-channels.html',
    '<!--PARTIAL:tab-history-->': 'tab-history.html',
    '<!--PARTIAL:tab-queue-->': 'tab-queue.html',
    '<!--PARTIAL:tab-downloaded-->': 'tab-downloaded.html',
    '<!--PARTIAL:tab-settings-->': 'tab-settings.html',
    '<!--PARTIAL:tab-tools-->': 'tab-tools.html',
    '<!--PARTIAL:tab-downloader-->': 'tab-downloader.html',
    '<!--PARTIAL:tab-iptv-->': 'tab-iptv.html',
    '<!--PARTIAL:tab-webstream-->': 'tab-webstream.html',
    '<!--PARTIAL:modals-->': 'modals.html',
  };

  for (const [tag, file] of Object.entries(partialMap)) {
    const fullPath = path.join(partialsDir, file);
    if (fs.existsSync(fullPath)) {
      const content = fs.readFileSync(fullPath, 'utf8');
      html = html.replace(tag, content);
    }
  }

  // app.js ve style.css için dinamik zaman damgası önbellek kırıcı (Cache Buster)
  const appJsPath = path.join(publicDir, 'app.js');
  if (fs.existsSync(appJsPath)) {
    const mtime = Math.floor(fs.statSync(appJsPath).mtimeMs);
    html = html.replace(/app\.js\?v=[^"']*/g, `app.js?v=${mtime}`);
  }
  const styleCssPath = path.join(publicDir, 'style.css');
  if (fs.existsSync(styleCssPath)) {
    const mtime = Math.floor(fs.statSync(styleCssPath).mtimeMs);
    html = html.replace(/style\.css\?v=[^"']*/g, `style.css?v=${mtime}`);
  }

  return html;
}

// Ana Sayfa ve SPA Yönlendirmeleri (Modüler Partial Birleştirmeli)
app.get([
  '/', '/index.html', '/home', '/download', '/downlist', '/channels', '/settings', '/iptv', '/downloader', '/tools',
  '/webstream', '/watch',
  '/tools/compare', '/tools/deleted', '/tools/categories', '/tools/ape', '/tools/subscriptions', '/tools/bulk-delete'
], (req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.send(getCompositeIndexHtml());
});

// Yerel CLI & Görev Çubuğu Jump List Komut Yürütücüsü
app.post('/api/cli/exec', localhostOnly, async (req, res) => {
  try {
    const cmdLine = req.body && typeof req.body.command === 'string' ? req.body.command.trim() : '';
    if (!cmdLine) {
      return res.status(400).json({ ok: false, message: 'Komut boş olamaz.' });
    }
    const result = await executeCliCommand(cmdLine);
    res.json(result);
  } catch (err) {
    res.status(500).json({ ok: false, message: `[Console] Hata: ${err.message}` });
  }
});

// Bildirim veya Protokol Tıklamasında Videoyu Arayüzde Doğrudan Oynatma Uç Noktası
app.post('/api/play-video', localhostOnly, (req, res) => {
  const vidId = String(req.body?.videoId || req.query?.videoId || '').replace(/[^a-zA-Z0-9_\-]/g, '').trim();
  if (!vidId) {
    return res.status(400).json({ ok: false, error: 'Video ID gereklidir.' });
  }
  broadcast('play_video', { id: vidId });
  res.json({ ok: true, videoId: vidId });
});

// Eşleşmeyen API Uç Noktaları İçin 404 Yakalayıcı (nodejs-backend-patterns)
app.all('/api/*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    path: req.originalUrl
  });
});

// Express Global Hata Yakalama Middleware'i (nodejs-backend-patterns)
app.use((err, req, res, next) => {
  console.error('[API Sunucu Hatası]', err && err.stack ? err.stack : err);
  if (res.headersSent) {
    return next(err);
  }
  const statusCode = err.statusCode || err.status || 500;
  res.status(statusCode).json({
    success: false,
    error: err.message || 'Dahili sunucu hatası.'
  });
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

// GitHub Otomatik Güncelleme Kontrolü Durumu
let updateState = {
  updateAvailable: false,
  latestVersion: null,
  releaseUrl: null,
  releaseNotes: null,
  checkedAt: null
};

async function checkGithubUpdates() {
  const currentVersion = appVersion;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);
    
    const db = readDb();
    const token = db.settings?.githubToken;
    const headers = {
      'User-Agent': 'HaYTooL-YT-Downloader-UpdateChecker'
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token.trim()}`;
    }

    const response = await fetch('https://api.github.com/repos/HaYToKoRaZ/haytool-youtube-download/releases/latest', {
      headers,
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
    } else if (response.status === 403 || response.status === 429) {
      console.warn('[GitHub Updates]: API hız sınırı aşıldı (rate limit exceeded), güncelleme kontrolü ertelendi.');
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

// Süresi dolmuş videoları otomatik sil / onaya sun
function autoDeleteOldVideos() {
  checkAndProcessAutoDelete(downloadQueue);
}

// Konsoldan alternatif hız limitini değiştirince aktif indirmeleri yeniden başlat
function restartActiveDownloadWithNewLimit(db, oldSpeedLimit, newSpeedLimit) {
  let restartedAny = false;
  while (downloadQueue.activeProcess && downloadQueue.activeVideoId) {
    const videoId = downloadQueue.activeVideoId;
    const proc = downloadQueue.activeProcess;
    const pid = proc ? proc.pid : null;
    const historyItem = db.history.find(h => h.id === videoId);

    downloadQueue.activeProcess = null;
    downloadQueue.activeVideoId = null;
    if (downloadQueue.activeDownloads > 0) {
      downloadQueue.activeDownloads--;
    }

    if (historyItem) {
      restartedAny = true;
      console.log(`[Console] Hız sınırı değişti (${oldSpeedLimit} -> ${newSpeedLimit}). Aktif indirme yeni hız sınırı ile yeniden başlatılıyor: ${historyItem.title}`);
      addTerminalLog(`[Console] Hız sınırı değişti. Aktif indirme yeni hız sınırı ile yeniden başlatılıyor: "${historyItem.title}"`, 'info');

      const targetUrl = resolveItemDownloadUrl(historyItem);
      downloadQueue.queue.unshift({
        id: videoId,
        originalId: historyItem.originalId || videoId,
        title: historyItem.title,
        channelId: historyItem.channelId,
        channelName: historyItem.channelName,
        url: targetUrl,
        webUrl: historyItem.webUrl || (targetUrl.startsWith('http') ? targetUrl : ''),
        platform: historyItem.platform,
        publishedAt: historyItem.publishedAt || ''
      });

      updateHistoryItem(videoId, {
        status: 'waiting',
        progress: historyItem.progress || 0,
        speed: '',
        eta: ''
      });
    }

    if (pid) {
      exec(`taskkill /F /T /PID ${pid}`, () => {
        try {
          proc.kill('SIGKILL');
        } catch (e) {}
      });
    }
  }

  if (restartedAny && !downloadQueue.isPaused) {
    setTimeout(() => {
      downloadQueue.process();
    }, 1000);
  }
}

// Konsol yardımıyla URL üzerinden kuyruğa video ekleme (YouTube + Çoklu Platform destekli)
async function addVideoToQueueByUrl(rawUrlText) {
  const urlText = String(rawUrlText || '').replace(/^["']+|["']+$/g, '').trim();
  const youtubeRegex = /(?:youtu\.be\/|(?:music\.)?youtube\.com\/(?:embed\/|v\/|live\/|watch\?v=|watch\?.+&v=|shorts\/))([^?&"'>\s]{11})/;
  const match = urlText.match(youtubeRegex);
  if (!match) {
    if (urlText.startsWith('http://') || urlText.startsWith('https://')) {
      const resp = await fetch(`http://127.0.0.1:${PORT}/api/downloader/download`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: urlText, format: 'video-best' })
      });
      const data = await resp.json();
      if (!resp.ok || data.error) {
        throw new Error(data.error || 'Bağlantı kuyruğa eklenemedi.');
      }
      return data.videoId || data.id || urlText;
    }
    throw new Error('Geçersiz video bağlantısı.');
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

function pauseDownloadQueue() {
  downloadQueue.isPaused = true;
  const db = readDb();
  db.settings.isPaused = true;
  writeDb(db);
  console.log('[Kuyruk] CLI komutu ile indirme kuyruğu duraklatıldı.');
  addTerminalLog('[Kuyruk] İndirme sırası duraklatıldı.', 'warning');

  let pausedActiveCount = 0;
  while (downloadQueue.activeProcess && downloadQueue.activeVideoId) {
    const videoId = downloadQueue.activeVideoId;
    const proc = downloadQueue.activeProcess;
    const pid = proc ? proc.pid : null;
    const historyItem = db.history.find(h => h.id === videoId);

    downloadQueue.activeProcess = null;
    downloadQueue.activeVideoId = null;
    if (downloadQueue.activeDownloads > 0) {
      downloadQueue.activeDownloads--;
    }

    if (historyItem) {
      pausedActiveCount++;
      const targetUrl = resolveItemDownloadUrl(historyItem);
      downloadQueue.queue.unshift({
        id: videoId,
        originalId: historyItem.originalId || videoId,
        title: historyItem.title,
        channelId: historyItem.channelId,
        channelName: historyItem.channelName,
        url: targetUrl,
        webUrl: historyItem.webUrl || (targetUrl.startsWith('http') ? targetUrl : ''),
        platform: historyItem.platform,
        publishedAt: historyItem.publishedAt || ''
      });
      updateHistoryItem(videoId, {
        status: 'waiting',
        progress: historyItem.progress || 0,
        speed: '',
        eta: ''
      });
    }

    if (pid) {
      exec(`taskkill /F /T /PID ${pid}`, () => {
        try { proc.kill('SIGKILL'); } catch (e) {}
      });
    }
  }

  downloadQueue.notifyTrayState();
  broadcast('db_update', readDb());
  return pausedActiveCount;
}

function resumeDownloadQueue() {
  downloadQueue.isPaused = false;
  downloadQueue.isNetworkWaiting = false;
  if (downloadQueue.networkRecoveryTimer) {
    clearInterval(downloadQueue.networkRecoveryTimer);
    downloadQueue.networkRecoveryTimer = null;
  }
  const db = readDb();
  db.settings.isPaused = false;
  writeDb(db);
  console.log('[Kuyruk] CLI komutu ile indirme kuyruğu devam ettiriliyor.');
  addTerminalLog('[Kuyruk] İndirme sırası devam ettiriliyor.', 'success');
  broadcast('db_update', readDb());
  downloadQueue.process();
}

async function executeCliCommand(rawLine) {
  const line = String(rawLine || '').trim();
  if (!line) return { ok: false, message: '' };

  const parts = line.split(/\s+/);
  const command = parts[0].toLowerCase().replace(/^(?:--?|\/)/, '');
  const args = parts.slice(1);
  const subArg = (args[0] || '').toLowerCase();

  const reply = (msg, logType = null, notifyTitle = null) => {
    console.log(msg);
    if (logType) addTerminalLog(msg, logType);
    playAppSound('cli');
    if (notifyTitle) {
      showWindowsNotification(notifyTitle, msg.replace(/^\[Console\]\s*/, ''));
    }
    return { ok: true, message: msg };
  };

  if (command === 'help' || command === '?' || command === 'komutlar') {
    const helpMsg = '[Console] Kullanılabilir CLI & Konsol Komutları:\n' +
      '  • status / info / durum        : Sistem, kuyruk, hız ve Oyun Modu durumunu gösterir\n' +
      '  • gton / gtoff                 : Oyun Modu + Kaplumbağa Hız Limitini aynı anda açar / kapatır\n' +
      '  • gameon / game off / game     : Oyun Modunu (Ertelenmiş FFmpeg Birleştirme) açar, kapatır veya değiştirir\n' +
      '  • merge / merge-pause          : Bekleyen birleştirmeleri sırayla başlatır veya duraklatır\n' +
      '  • pause / duraklat             : Aktif indirmeleri beklemeye alır ve indirme kuyruğunu duraklatır\n' +
      '  • resume / devam               : Duraklatılmış indirme kuyruğunu devam ettirir\n' +
      '  • ton / toff / toggle          : Kaplumbağa alternatif hız limitini açar / kapatır / değiştirir\n' +
      '  • speed <kb|off|on>            : Normal hız limitini ayarlar (KB/s), kapatır veya son değere açar\n' +
      '  • altspeed <kb>                : Kaplumbağa modu hız profilini ayarlar (örn: altspeed 500)\n' +
      '  • pd [link]                    : Link verilirse kuyruğa ekler; linksiz ise duraklat/devam geçişi yapar\n' +
      '  • paste / pano                 : Panodaki bağlantıyı doğrudan indirme kuyruğuna ekler\n' +
      '  • check / tara / scan          : Takip edilen kanalları anında RSS ile denetler\n' +
      '  • backup / yedek               : Sistem veritabanı ve ayarlarının anlık yedeğini alır\n' +
      '  • fakap / fakap-run            : Fakap otomatik yedekleme kontrolünü anında çalıştırır\n' +
      '  • open / hide / tray / stop    : Pencereyi açar, tepsiye gizler, simgeyi gösterir veya kapatır\n' +
      '  • clear                        : Konsol ekranını temizler';
    return reply(helpMsg);
  }

  if (command === 'exit' || command === 'quit' || command === 'stop') {
    console.log('[Console] Kapatma komutu alındı. Sunucu sonlandırılıyor...');
    setTimeout(() => process.exit(0), 150);
    return { ok: true, message: '[Console] Kapatma komutu alındı. Sunucu sonlandırılıyor...' };
  }

  if (command === 'pause' || command === 'duraklat' || command === 'pause-all') {
    const pausedActiveCount = pauseDownloadQueue();
    const suffix = pausedActiveCount > 0 ? ` (${pausedActiveCount} aktif indirme beklemeye alındı)` : '';
    return reply(`[Console] İndirme kuyruğu duraklatıldı${suffix}.`, null, 'İndirmeler Duraklatıldı');
  }

  if (command === 'resume' || command === 'devam' || command === 'resume-all') {
    resumeDownloadQueue();
    return reply('[Console] İndirme kuyruğu devam ettiriliyor.', null, 'İndirmeler Devam Ediyor');
  }

  if (command === 'play' || command === 'oynat') {
    let vidId = (args[0] || '').trim();
    if (vidId.startsWith('haytool://play/')) vidId = vidId.replace('haytool://play/', '');
    if (vidId.startsWith('haytool:play/')) vidId = vidId.replace('haytool:play/', '');
    if (vidId.startsWith('/play/')) vidId = vidId.replace('/play/', '');
    vidId = vidId.replace(/[^a-zA-Z0-9_\-]/g, '').trim();
    if (!vidId) {
      return { ok: false, message: '[Console] Geçerli bir video ID belirtilmedi.' };
    }
    broadcast('play_video', { id: vidId });
    return reply(`[Console] Video oynatma isteği arayüze iletildi: ${vidId}`, 'info');
  }

  if (command === 'check' || command === 'scan' || command === 'tara') {
    triggerChannelCheck('cli').catch(err => console.error('[Console] Tarama hatası:', err.message));
    return reply('[Console] Takip edilen kanallar CLI üzerinden taranıyor...', 'info');
  }

  if (command === 'backup' || command === 'yedek') {
    ensureDailySystemBackup();
    return reply('[Console] Sistem anlık yedeği alınıyor...', 'info');
  }

  if (command === 'fakap' || command === 'fakap-run') {
    cleanupExpired().catch(() => {});
    return reply('[Console] Fakap bakım ve temizliği çalıştırıldı.', 'info');
  }

  // Birleştirme kuyruğu manuel başlat / duraklat komutları
  if (command === 'merge-pause' || command === 'birlestir-duraklat' || ((command === 'merge' || command === 'birlestir') && (subArg === 'pause' || subArg === 'duraklat' || subArg === 'stop'))) {
    mergeQueue.pause(false);
    return { ok: true, message: '[Console] Sıralı FFmpeg birleştirme kuyruğu duraklatıldı.' };
  }

  if (command === 'merge' || command === 'merge-all' || command === 'birlestir') {
    const res = mergeQueue.enqueue('all');
    const msg = res.added > 0 || mergeQueue.activeJob
      ? `[Console] Sıralı FFmpeg birleştirme kuyruğu başlatıldı (Eklenen: ${res.added}, Sırada: ${res.queuedCount}).`
      : '[Console] Birleştirme bekleyen ham video bulunmuyor.';
    return reply(msg, 'info');
  }

  const db = readDb();

  // Birleşik Oyun Modu + Kaplumbağa Hız Limiti (gameon+ton / gameoff+toff) CLI komutları
  const isComboOn = command === 'gton' || command === 'gt-on' || command === 'gameton' || command === 'game-ton';
  const isComboOff = command === 'gtoff' || command === 'gt-off' || command === 'gametoff' || command === 'game-toff';

  if (isComboOn) {
    const oldLimit = getEffectiveSpeedLimit(db.settings);
    db.settings.deferMerge = true;
    db.settings.useAlternativeSpeed = true;
    if (mergeQueue.queue && mergeQueue.queue.length > 0) {
      mergeQueue.pause(false);
    }
    const newLimit = getEffectiveSpeedLimit(db.settings);
    const speedLimitChanged = oldLimit !== newLimit;
    writeDb(db);
    broadcast('db_update', db);
    if (speedLimitChanged && !downloadQueue.isPaused && downloadQueue.activeProcess && downloadQueue.activeVideoId) {
      restartActiveDownloadWithNewLimit(db, oldLimit, newLimit);
    }
    return reply(`[Console] Oyun + Kaplumbağa Modu AÇILDI: FFmpeg birleştirmeleri ertelendi, hız sınırı ${newLimit} KB/s olarak uygulandı.`, 'info', 'Oyun + Kaplumbağa Modu Açıldı');
  }

  if (isComboOff) {
    const oldLimit = getEffectiveSpeedLimit(db.settings);
    db.settings.deferMerge = false;
    db.settings.useAlternativeSpeed = false;
    const newLimit = getEffectiveSpeedLimit(db.settings);
    const speedLimitChanged = oldLimit !== newLimit;
    writeDb(db);
    broadcast('db_update', db);
    if (speedLimitChanged && !downloadQueue.isPaused && downloadQueue.activeProcess && downloadQueue.activeVideoId) {
      restartActiveDownloadWithNewLimit(db, oldLimit, newLimit);
    }
    const autoRes = mergeQueue.startAllAutoIfIdle();
    const mergeSuffix = (autoRes && autoRes.added > 0)
      ? ` Bekleyen ${autoRes.added} video sırayla birleştiriliyor.`
      : '';
    const limitLabel = newLimit > 0 ? `${newLimit} KB/s` : 'Limitsiz';
    return reply(`[Console] Oyun + Kaplumbağa Modu KAPATILDI: Geçerli hız ${limitLabel}, FFmpeg birleştirmeleri otomatik yapılacak.${mergeSuffix}`, 'info', 'Oyun + Kaplumbağa Modu Kapatıldı');
  }

  // Oyun Modu (Ertelenmiş FFmpeg Birleştirme & Dönüştürme Kuyruğu) CLI komutları
  const isGameExplicitOn = command === 'gameon' || command === 'game-on' || command === 'oyunac' || command === 'oyun-ac' || command === 'defer-on' || command === 'deferon' ||
    ((command === 'game' || command === 'gamemode' || command === 'game-mode' || command === 'oyun' || command === 'defer-merge' || command === 'defermerge') && (subArg === 'on' || subArg === 'ac' || subArg === '1' || subArg === 'true'));
  const isGameExplicitOff = command === 'gameoff' || command === 'game-off' || command === 'oyunkapat' || command === 'oyun-kapat' || command === 'defer-off' || command === 'deferoff' ||
    ((command === 'game' || command === 'gamemode' || command === 'game-mode' || command === 'oyun' || command === 'defer-merge' || command === 'defermerge') && (subArg === 'off' || subArg === 'kapat' || subArg === '0' || subArg === 'false'));
  const isGameToggle = command === 'gametoggle' || command === 'game-toggle' || command === 'oyuntoggle' ||
    ((command === 'game' || command === 'gamemode' || command === 'game-mode' || command === 'oyun' || command === 'defer-merge' || command === 'defermerge') && (!subArg || subArg === 'toggle'));

  if (isGameExplicitOn || isGameExplicitOff || isGameToggle) {
    const prevDefer = Boolean(db.settings.deferMerge);
    const nextDefer = isGameExplicitOn ? true : (isGameExplicitOff ? false : !prevDefer);
    db.settings.deferMerge = nextDefer;
    writeDb(db);
    broadcast('db_update', db);

    if (nextDefer) {
      return reply('[Console] Oyun Modu AÇILDI: Videolar tam hızda indirilecek, FFmpeg birleştirmeleri kuyrukta bekletilecek.', 'info', 'Oyun Modu Açıldı');
    } else {
      const autoRes = prevDefer ? mergeQueue.startAllAutoIfIdle() : { added: 0 };
      const suffix = (autoRes && autoRes.added > 0)
        ? ` Bekleyen ${autoRes.added} video sırayla birleştiriliyor.`
        : '';
      return reply(`[Console] Oyun Modu KAPATILDI: FFmpeg birleştirmeleri otomatik yapılacak.${suffix}`, 'info', 'Oyun Modu Kapatıldı');
    }
  }

  if (command === 'ton' || command === 'turtleon' || command === 'turtleac' || command === 'turtle-on') {
    const oldLimit = getEffectiveSpeedLimit(db.settings);
    db.settings.useAlternativeSpeed = true;
    const newLimit = getEffectiveSpeedLimit(db.settings);
    const speedLimitChanged = oldLimit !== newLimit;
    writeDb(db);
    broadcast('db_update', db);
    if (speedLimitChanged && downloadQueue.activeProcess && downloadQueue.activeVideoId) {
      restartActiveDownloadWithNewLimit(db, oldLimit, newLimit);
    }
    return reply(`[Console] Alternatif hız sınırı (Turtle) AÇILDI. Geçerli Limit: ${newLimit} KB/s`, 'info', 'Kaplumbağa Hız Sınırı Açıldı');
  } else if (command === 'toff' || command === 'turtleoff' || command === 'turtlekapat' || command === 'turtle-off') {
    const oldLimit = getEffectiveSpeedLimit(db.settings);
    db.settings.useAlternativeSpeed = false;
    const newLimit = getEffectiveSpeedLimit(db.settings);
    const speedLimitChanged = oldLimit !== newLimit;
    writeDb(db);
    broadcast('db_update', db);
    if (speedLimitChanged && downloadQueue.activeProcess && downloadQueue.activeVideoId) {
      restartActiveDownloadWithNewLimit(db, oldLimit, newLimit);
    }
    return reply(`[Console] Alternatif hız sınırı (Turtle) KAPATILDI. Geçerli Limit: ${newLimit > 0 ? newLimit + ' KB/s' : 'Limitsiz'}`, 'info', 'Kaplumbağa Hız Sınırı Kapatıldı');
  } else if (command === 'toggle' || command === 'turtle' || command === 'turtle-toggle' || (command === 'altspeed' && subArg === 'toggle')) {
    const oldLimit = getEffectiveSpeedLimit(db.settings);
    db.settings.useAlternativeSpeed = !db.settings.useAlternativeSpeed;
    const newLimit = getEffectiveSpeedLimit(db.settings);
    const speedLimitChanged = oldLimit !== newLimit;
    writeDb(db);
    broadcast('db_update', db);
    const stateStr = db.settings.useAlternativeSpeed ? 'AÇIK (ENABLED)' : 'KAPALI (DISABLED)';
    if (speedLimitChanged && downloadQueue.activeProcess && downloadQueue.activeVideoId) {
      restartActiveDownloadWithNewLimit(db, oldLimit, newLimit);
    }
    return reply(`[Console] Alternatif hız sınırı (Turtle): ${stateStr}. Geçerli Limit: ${newLimit > 0 ? newLimit + ' KB/s' : 'Limitsiz'}`, 'info');
  } else if (command === 'speed') {
    const val = args[0];
    if (!val) {
      return reply(`[Console] Geçerli normal hız limiti: ${db.settings.downloadSpeedLimit || 0} KB/s (0 = Limitsiz)`);
    }
    const oldLimit = getEffectiveSpeedLimit(db.settings);
    let msgText = '';
    if (subArg === 'off' || val === '0' || subArg === 'none' || subArg === 'kapat') {
      if (db.settings.downloadSpeedLimit > 0) {
        db.settings.lastDownloadSpeedLimit = db.settings.downloadSpeedLimit;
      }
      db.settings.downloadSpeedLimit = 0;
      msgText = '[Console] Normal indirme hız limiti KAPATILDI (Limitsiz mod).';
    } else if (subArg === 'on' || subArg === 'ac') {
      const restored = (db.settings.lastDownloadSpeedLimit && db.settings.lastDownloadSpeedLimit > 0)
        ? db.settings.lastDownloadSpeedLimit
        : (db.settings.downloadSpeedLimit > 0 ? db.settings.downloadSpeedLimit : 2500);
      db.settings.downloadSpeedLimit = restored;
      msgText = `[Console] Normal indirme hız limiti tekrar AÇILDI (${restored} KB/s).`;
    } else {
      const numVal = parseInt(val, 10);
      if (isNaN(numVal) || numVal < 0) {
        const errMsg = '[Console] Hata: Geçerli bir sayı girmelisiniz. Örnek: speed 2500, speed off veya speed on';
        console.log(errMsg);
        return { ok: false, message: errMsg };
      }
      db.settings.downloadSpeedLimit = numVal;
      if (numVal > 0) db.settings.lastDownloadSpeedLimit = numVal;
      msgText = `[Console] Normal indirme hız limiti ${numVal} KB/s olarak ayarlandı.`;
    }
    const newLimit = getEffectiveSpeedLimit(db.settings);
    const speedLimitChanged = oldLimit !== newLimit;
    writeDb(db);
    broadcast('db_update', db);
    if (speedLimitChanged && downloadQueue.activeProcess && downloadQueue.activeVideoId) {
      restartActiveDownloadWithNewLimit(db, oldLimit, newLimit);
    }
    return reply(msgText, 'info');
  } else if (command === 'altspeed') {
    const val = args[0];
    if (!val) {
      return reply(`[Console] Geçerli alternatif hız limiti: ${db.settings.alternativeSpeedLimit || 500} KB/s`);
    }
    const numVal = parseInt(val, 10);
    if (isNaN(numVal) || numVal < 0) {
      const errMsg = '[Console] Hata: Geçerli bir sayı girmelisiniz. Örnek: altspeed 500';
      console.log(errMsg);
      return { ok: false, message: errMsg };
    }
    const oldLimit = getEffectiveSpeedLimit(db.settings);
    db.settings.alternativeSpeedLimit = numVal;
    writeDb(db);
    broadcast('db_update', db);
    const newLimit = getEffectiveSpeedLimit(db.settings);
    if (db.settings.useAlternativeSpeed && oldLimit !== newLimit && downloadQueue.activeProcess && downloadQueue.activeVideoId) {
      restartActiveDownloadWithNewLimit(db, oldLimit, newLimit);
    }
    return reply(`[Console] Alternatif hız limiti ${numVal} KB/s olarak ayarlandı.`, 'info');
  } else if (command === 'status' || command === 'info' || command === 'durum') {
    const effective = getEffectiveSpeedLimit(db.settings);
    const altStatus = db.settings.useAlternativeSpeed ? 'AÇIK (Turtle ON)' : 'KAPALI (Turtle OFF)';
    const gameStatus = db.settings.deferMerge ? 'AÇIK (Birleştirme Erteleniyor)' : 'KAPALI (Otomatik Birleştirme)';
    const pendingMerges = Array.isArray(db.history)
      ? db.history.filter(h => h.status === 'pending_merge' || h.status === 'merging_deferred').length
      : 0;
    const queueStatus = downloadQueue.isPaused ? 'DURAKLATILDI (PAUSED)' : 'DEVAM EDİYOR (ACTIVE)';
    const queueCount = downloadQueue.queue ? downloadQueue.queue.length : 0;
    const activeVideo = downloadQueue.activeVideoId ? `İndiriliyor (${downloadQueue.activeVideoId})` : 'Boşta (Yok)';
    const fakapStatus = db.settings.fakapEnabled !== false ? 'Açık' : 'Kapalı';
    const statusMsg = `[Console] Sistem Durumu:
      - İndirme Kuyruğu: ${queueStatus} (Bekleyen: ${queueCount})
      - Aktif İndirme: ${activeVideo}
      - Oyun Modu (Ertelenmiş FFmpeg): ${gameStatus} (Bekleyen Birleştirme: ${pendingMerges})
      - Normal Hız Limiti: ${db.settings.downloadSpeedLimit || 0} KB/s (${db.settings.downloadSpeedLimit ? 'Aktif' : 'Limitsiz'})
      - Alternatif Hız Limiti: ${db.settings.alternativeSpeedLimit || 500} KB/s
      - Alternatif Hız (Turtle): ${altStatus}
      - Geçerli Hız Limiti: ${effective > 0 ? effective + ' KB/s' : 'Limitsiz'}
      - Fakap Otomatik Yedek: ${fakapStatus} (Kalite: ${db.settings.fakapQuality || '144'}p, Saklama: ${db.settings.fakapRetentionDays || 7} gün)
      - Otomatik İndirme: ${db.settings.autoDownload ? 'Açık' : 'Kapalı'}`;
    return reply(statusMsg);
  } else if (command === 'pd') {
    const link = args[0];
    if (!link) {
      if (downloadQueue.isPaused) {
        resumeDownloadQueue();
        return { ok: true, message: '[Console] İndirme kuyruğu devam ettiriliyor.' };
      } else {
        pauseDownloadQueue();
        return { ok: true, message: '[Console] İndirme kuyruğu duraklatıldı.' };
      }
    }
    try {
      const vid = await addVideoToQueueByUrl(link);
      return reply(`[Console] Video kuyruğa başarıyla eklendi. ID: ${vid}`, 'success');
    } catch (err) {
      const errMsg = `[Console] Hata: ${err.message}`;
      addTerminalLog(errMsg, 'error');
      console.log(errMsg);
      return { ok: false, message: errMsg };
    }
  } else if (command === 'clear') {
    console.clear();
    return { ok: true, message: '' };
  } else {
    const unknownMsg = `[Console] Bilinmeyen komut: "${command}". Komut rehberi için "help" veya "?" yazabilirsiniz.`;
    console.log(unknownMsg);
    return { ok: false, message: unknownMsg };
  }
}

process.stdin.on('data', (data) => {
  const lines = data.toString().split(/\r?\n/);
  for (const line of lines) {
    if (line.trim()) {
      executeCliCommand(line).catch(err => console.error('[Console] Komut hatası:', err.message));
    }
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
                      Versiyon: v${appVersion}
           Yapımcı: HaYTo
    ====================================================
    `);
    console.log(`Sunucu http://localhost:${PORT} portunda çalışıyor.`);
    
    if (!fs.existsSync(db.settings.downloadPath)) {
      try {
        fs.mkdirSync(db.settings.downloadPath, { recursive: true });
      } catch (err) {}
    }

    // Otomatik günlük sistem yedeğini başlat ve periyodik disk senkronizasyonu kur
    setTimeout(() => {
      ensureDailySystemBackup();
    }, 1000);
    setupPeriodicDiskSync();

    // YouTube oturum çerezlerini açılışın ilk adımı olarak bağımsız şekilde tazele.
    // İndirme kuyruğu (4s), disk sync (7s) ve diğer işlemlerden ÖNCE çalışır.
    // Aktif indirme veya başka bir işlem olup olmadığından bağımsızdır.
    setTimeout(() => {
      // YouTube oturum çerezleri arka planda sessizce tazelenir
      triggerSilentCookieRefresh();
    }, 2000);
    
    // Bozuk kanal kayıtlarını temizle
    const originalCount = db.channels.length;
    db.channels = db.channels.filter(c => c.name !== c.id);
    if (db.channels.length !== originalCount) {
      console.log(`[Ayarlar] İsmi ve ID'si aynı olan ${originalCount - db.channels.length} adet bozuk kanal veritabanından temizlendi.`);
      writeDb(db);
    }

    addTerminalLog(`[Sistem] Sunucu başarıyla başlatıldı. Adres: http://localhost:${PORT}`, 'success');
    addTerminalLog(`[Sistem] Otomatik indirme klasörü: "${db.settings.downloadPath}"`, 'info');
    
    // Ana dizindeki Temp klasörünü açılışta temizle
    cleanLocalTempDir();

    try {
      await ensureYtdlp();
    } catch (e) {
      console.error('yt-dlp kontrolü başarısız oldu:', e.message);
    }

    if (db.settings.mergeType === 'merge' && !fs.existsSync(getFfmpegPath())) {
      ensureFfmpeg().catch(e => console.error('FFmpeg kontrol hatası:', e.message));
    }

    startIntervalTimer();

    // YouTube oturum çerezlerinin periyodik sağlık kontrolü (30 dk; geçersizse sessiz yenileme + bildirim)
    startCookieHealthCheck();

    // Genel ağ bağlantısı süreklilik denetimi
    startNetworkHealthCheck();
    startFakapService();
    startMaintenanceService();

    // Otomatik video silme döngüsü (Dakika bazlı ertelemeler için 60 saniyede bir kontrol)
    setTimeout(() => {
      autoDeleteOldVideos();
    }, 8000);
    setInterval(autoDeleteOldVideos, 60 * 1000);

    // Eksik video sürelerini çözücü tetikle
    setTimeout(() => {
      resolveMissingDurations();
    }, 6000);

    // Başlangıçta kuyruğa bekleyen/yarım kalan indirmeleri ekle
    setTimeout(() => {
      const currentDb = readDb();
      let queuedCount = 0;
      let healedCount = 0;

      // Önceki kapanıştan öksüz kalan 'downloading' veya 'merging' durumlarını 'waiting' yap; kesilen 'merging_deferred' ise 'pending_merge' durumuna geri al
      let healedMergeCount = 0;
      currentDb.history.forEach(item => {
        if (item.status === 'downloading' || item.status === 'merging') {
          if (String(item.id).startsWith('ws_') || item.platform === 'webstream') {
            item.status = 'failed';
            item.error = 'Uygulama kapandığı için web akış indirmesi durduruldu.';
            item.speed = '';
            item.eta = '';
          } else {
            item.status = 'waiting';
            item.speed = '';
            item.eta = '';
            healedCount++;
          }
        } else if (item.status === 'merging_deferred') {
          item.status = 'pending_merge';
          item.speed = '';
          item.eta = '';
          healedMergeCount++;
        }
      });
      if (healedCount > 0 || healedMergeCount > 0) {
        writeDb(currentDb);
        broadcast('db_update', currentDb);
        if (healedCount > 0) {
          addTerminalLog(`[Sistem] Önceki oturumdan kalan ${healedCount} adet işlem düzeltildi ('waiting' durumuna alındı).`, 'info');
        }
        if (healedMergeCount > 0) {
          addTerminalLog(`[Sistem] Önceki oturumda yarıda kalan ${healedMergeCount} adet birleştirme işi 'Birleştirme Bekliyor' durumuna geri alındı.`, 'info');
        }
      }

      if (!currentDb.settings?.deferMerge) {
        setTimeout(() => mergeQueue.startAllAutoIfIdle(), 2000);
      }

      currentDb.history.forEach(item => {
        if (item.status === 'waiting') {
          const targetUrl = resolveItemDownloadUrl(item);
          if (targetUrl) {
            downloadQueue.add({
              id: item.id,
              originalId: item.originalId || item.id,
              title: item.title,
              channelId: item.channelId,
              channelName: item.channelName,
              url: targetUrl,
              webUrl: item.webUrl || (targetUrl.startsWith('http') ? targetUrl : ''),
              platform: item.platform,
              publishedAt: item.publishedAt || '',
              isStandalone: item.isStandalone || String(item.id).startsWith('ext_'),
              skipChannelFolder: item.skipChannelFolder === true,
              customFormat: item.customFormat,
              audioBitrate: item.audioBitrate,
              duration: item.duration || '',
              thumbnail: item.thumbnail || ''
            });
            queuedCount++;
          }
        }
      });
      if (queuedCount > 0) {
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

    // Açılışta yt-dlp Motor Sürümü Güncelleme Kontrolü (Ayarlarda aktifse)
    setTimeout(async () => {
      try {
        const currentDb = readDb();
        if (currentDb.settings && currentDb.settings.checkYtdlpOnStartup === true) {
          const target = currentDb.settings.ytdlpStartupTarget || 'nightly';
          console.log(`[Sistem Açılışı] yt-dlp motor güncellemesi denetleniyor (${target})...`);
          const res = await performYtdlpUpdate(target);
          if (res && res.success) {
            addTerminalLog(`[Sistem Açılışı] yt-dlp motoru güncel (${res.newVersion || target}).`, 'success');
          }
        }
      } catch (err) {
        console.error('[Sistem Açılışı] yt-dlp açılış güncelleme hatası:', err.message);
      }
    }, 4500);

    // Sunucu açılış yaşam döngüsü: Disk Senkronizasyonu -> Açılış Kanal Taraması
    // NOT: Çerez tazeleme (triggerSilentCookieRefresh) bağımsız olarak 2s'de çalışmaktadır.
    setTimeout(async () => {
      try {
        const initialDb = readDb();
        if (initialDb.settings.autoDiskSync !== false) {
          addTerminalLog('[Sistem Açılışı] 1/2 Disk senkronizasyonu çalıştırılıyor...', 'info');
          await syncDbWithDisk();
        }
      } catch (diskErr) {
        console.error('[Sistem Açılışı] Disk senkronizasyonu hatası:', diskErr.message);
      }

      // Disk senkronizasyonu tamamlandıktan sonra açılış kanal taraması (Ayarlarda aktifse)
      const currentDb = readDb();
      if (currentDb.settings.checkChannelsOnStartup && currentDb.channels.length > 0) {
        try {
          addTerminalLog('[Sistem Açılışı] 2/2 Açılış kanal taraması başlatılıyor...', 'info');
          await triggerChannelCheck('startup');
        } catch (err) {
          console.error('[RSS] Başlangıç taramasında hata oluştu:', err.message);
        }
      }
    }, 7000);

    // YouTube Oturum Çerezlerini Periyodik Olarak Arka Planda Yenile (Her 30 dakikada bir)
    setInterval(() => {
      triggerSilentCookieRefresh();
    }, 30 * 60 * 1000);

    // Tarayıcıyı / Oynatıcıyı aç (Kullanıcı tercihi veya varsayılan /downlist)
    if (process.env.HAYTOOL_MANAGED_BY_TRAY === '1') {
      console.log('[Server] Tepsi yöneticisi (TrayManager) devrede; arayüz açılışı masaüstü uygulaması tarafından yönetiliyor.');
    } else {
      const currentDbState = readDb();
      if (currentDbState.settings.autoOpenBrowser !== false) {
        const targetUrl = `http://localhost:${PORT}/downlist`;
        const actionPref = (currentDbState.settings.doubleClickAction || 'player').toLowerCase();
        const baseDir = process.cwd();
        const playerPath = path.join(baseDir, 'Multimedia HaYTooL.exe');
        const playerExists = fs.existsSync(playerPath) ? playerPath : null;

        if (process.platform === 'win32') {
          if (actionPref === 'player' && playerExists) {
            try {
              exec(`"${playerExists}" "/downlist"`, { cwd: baseDir, windowsHide: false }, (err) => {
                if (err) {
                  console.log(`Multimedia HaYTooL açılamadı, sistem tarayıcısına yönlendiriliyor: ${err.message}`);
                  open(targetUrl).catch(() => {});
                }
              });
            } catch (e) {
              open(targetUrl).catch(() => {});
            }
          } else if (actionPref === 'embedded') {
            exec(`start msedge --app="${targetUrl}"`, { shell: true }, (err) => {
              if (err) {
                console.log(`Edge App modu açılamadı, varsayılan tarayıcı açılıyor: ${err.message}`);
                open(targetUrl).catch(() => {});
              }
            });
          } else {
            // system
            open(targetUrl).catch(() => {});
          }
        } else if (process.platform === 'linux') {
          const browsers = ['google-chrome', 'chromium', 'chromium-browser', 'brave-browser', 'microsoft-edge'];
          let appBrowser = null;
          for (const b of browsers) {
            try {
              if (execSync(`which ${b} 2>/dev/null`).toString().trim()) {
                appBrowser = b;
                break;
              }
            } catch(e) {}
          }
          
          if (appBrowser) {
            exec(`${appBrowser} --app="${targetUrl}"`, (err) => {
              if (err) console.log(`AppMode açılamadı, lütfen ${targetUrl} adresine manuel gidin.`);
            });
          } else {
            // Fallback
            exec(`xdg-open "${targetUrl}"`, (err) => {
              if (err) {
                console.log(`Tarayıcı otomatik açılamadı, lütfen ${targetUrl} adresine manuel gidin.`);
              }
            });
          }
        } else {
          try {
            const child = await open(targetUrl);
            child.on('error', (err) => {
              console.log(`Tarayıcı otomatik açılamadı: ${err.message}. Lütfen ${targetUrl} adresine manuel gidin.`);
            });
          } catch (e) {
            console.log(`Tarayıcı otomatik açılamadı, lütfen ${targetUrl} adresine manuel gidin.`);
          }
        }
      } else {
        console.log(`Otomatik tarayıcı açılışı devre dışı bırakıldı. Lütfen http://localhost:${PORT}/downlist adresine el ile gidin.`);
      }
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

  // Nazik Kapanış Yönetimi - Graceful Shutdown (nodejs-backend-patterns)
  let isShuttingDown = false;
  const gracefulShutdown = (signal) => {
    if (isShuttingDown) return;
    isShuttingDown = true;
    console.log(`\n[Sistem] ${signal} sinyali alındı, sunucu nazikçe kapatılıyor...`);

    server.close(() => {
      console.log('[Sistem] HTTP sunucu bağlantıları kapatıldı.');
      process.exit(0);
    });

    // 5 saniye içinde zorla kapatma güvenlik kilidi
    setTimeout(() => {
      console.warn('[Sistem] Zaman aşımı: Sunucu zorla kapatılıyor.');
      process.exit(1);
    }, 5000).unref();
  };

  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

}
