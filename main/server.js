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
  colored = colored.replace(/^(\[SUCCESS\]|\[DOWNLOAD OK\]|\[Download Success\])/gi, `${brightGreen}$1${reset}`);
  colored = colored.replace(/^(\[WARN(?:ING)?\]|\[UYARI\]|\[Channel Check WARN\])/gi, `${yellow}$1${reset}`);
  colored = colored.replace(/^(\[RSS\]|\[RSS Parallel\])/g, `${magenta}$1${reset}`);
  colored = colored.replace(/^(\[RSS Fallback\])/g, `${brightMagenta}$1${reset}`);
  colored = colored.replace(/^(\[DOWNLOAD\]|\[İNDİRME\]|\[Download Fallback\])/gi, `${cyan}$1${reset}`);
  colored = colored.replace(/^(\[WEBSTREAM\])/gi, `${brightMagenta}$1${reset}`);
  colored = colored.replace(/^(\[Uzak Durum\]|\[Remote Status\])/gi, `${brightCyan}$1${reset}`);
  colored = colored.replace(/^(\[FFMPEG\]|\[Birleştirme Kuyruğu\]|\[Merge Queue\])/gi, `${brightYellow}$1${reset}`);
  colored = colored.replace(/^(\[FAKAP\])/gi, `${yellow}$1${reset}`);
  colored = colored.replace(/^(\[Çerez Sağlık\]|\[Cookie Health\]|\[COOKIE\])/gi, `${brightYellow}$1${reset}`);
  colored = colored.replace(/^(\[NET\])/gi, `${brightGreen}$1${reset}`);
  colored = colored.replace(/^(\[Kuyruk\]|\[Queue\])/gi, `${brightCyan}$1${reset}`);
  colored = colored.replace(/^(\[CLIENT[^\]]*\])/gi, `${brightMagenta}$1${reset}`);
  colored = colored.replace(/^(\[KOMUT\]|\[CMD\]|\[Console\])/gi, `${yellow}$1${reset}`);
  colored = colored.replace(/^(\[yt-dlp Uyarı\]|\[yt-dlp Warn\]|yt-dlp uyarı satırı:)/gi, `${yellow}$1${reset}`);
  colored = colored.replace(/^(\[yt-dlp\])/gi, `${brightMagenta}$1${reset}`);
  colored = colored.replace(/^(\[GIST\]|\[Gist\])/gi, `${brightMagenta}$1${reset}`);
  colored = colored.replace(/^(\[DATABASE\])/g, `${yellow}$1${reset}`);
  colored = colored.replace(/^(\[IPTV\])/g, `${brightBlue}$1${reset}`);
  colored = colored.replace(/^(\[SYSTEM\]|\[Sistem\]|\[System\]|\[Sistem Açılışı\]|\[Startup\]|\[Server\]|\[Motor\]|\[Engine\]|\[Güncelleme\]|\[Update\]|\[Disk Sync\]|\[Ayarlar\]|\[Settings\]|\[Channel Check\]|\[Shorts Filter\])/gi, `${green}$1${reset}`);
  colored = colored.replace(/^([╔╠╚][═]+|║)/gm, `${brightMagenta}$1${reset}`);
  colored = colored.replace(/^(\[API\])/g, `${blue}$1${reset}`);
  colored = colored.replace(/^(\[HATA\]|\[ERROR\]|\[RSS ERROR\]|\[Download Error\]|\[Channel Check ERROR\])/gi, `${red}$1${reset}`);

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
import { translateConsoleLog, setConsoleLang, isEnglishConsole } from './server/utils/consoleTranslator.js';

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

const MAX_RECENT_ERRORS = 100;
const recentErrorLogs = [];
let apiVerboseLogging = false;

function recordRecentError(level, text) {
  const clean = String(text || '').replace(/\x1b\[[0-9;]*m/g, '').trim();
  if (!clean) return;
  const isErrorLike = level === 'error' || level === 'warn' || /\[HATA\]|\[ERROR\]|\[WARN|\[UYARI\]|\[CLIENT[^\]]*\]|->\s*[45]\d{2}\b/.test(clean);
  if (!isErrorLike) return;
  recentErrorLogs.push({
    time: new Date().toLocaleTimeString('tr-TR'),
    level,
    text: clean.slice(0, 350)
  });
  if (recentErrorLogs.length > MAX_RECENT_ERRORS) {
    recentErrorLogs.shift();
  }
}

function appendSessionLog(text) {
  if (!text) return;
  const cleanText = String(text).replace(/\x1b\[[0-9;]*m/g, '');
  const timestamp = new Date().toLocaleTimeString('tr-TR');
  const line = `[${timestamp}] ${cleanText}\n`;
  fs.appendFile(sessionLogFile, line, 'utf8', () => {});
}

console.log = function(...args) {
  const translatedArgs = args.map(arg => (typeof arg === 'string' ? translateConsoleLog(arg) : arg));
  const text = translatedArgs.map(arg => (typeof arg === 'string' ? arg : JSON.stringify(arg))).join(' ');
  appendSessionLog(text);
  recordRecentError('info', text);
  const colorized = translatedArgs.map(arg => colorizeText(arg));
  originalLog.apply(console, colorized);
};

console.error = function(...args) {
  const translatedArgs = args.map(arg => (typeof arg === 'string' ? translateConsoleLog(arg) : arg));
  const text = translatedArgs.map(arg => (typeof arg === 'string' ? arg : JSON.stringify(arg))).join(' ');
  const errTag = isEnglishConsole() ? '[ERROR]' : '[HATA]';
  const hasErrTag = /\[(HATA|ERROR|RSS HATA|RSS ERROR|Channel Check ERROR|Download Error|yt-dlp Error)\]/i.test(text);
  const taggedText = hasErrTag ? text : `${errTag} ${text}`;
  appendSessionLog(taggedText);
  recordRecentError('error', taggedText);
  const reset = '\x1b[0m';
  const red = '\x1b[31m';
  const outArgs = hasErrTag ? translatedArgs : [errTag, ...translatedArgs];
  const colorized = outArgs.map(arg => {
    if (typeof arg === 'string') {
      return `${red}${arg}${reset}`;
    }
    return arg;
  });
  originalError.apply(console, colorized);
};

console.warn = function(...args) {
  const translatedArgs = args.map(arg => (typeof arg === 'string' ? translateConsoleLog(arg) : arg));
  const text = translatedArgs.map(arg => (typeof arg === 'string' ? arg : JSON.stringify(arg))).join(' ');
  const warnTag = isEnglishConsole() ? '[WARN]' : '[UYARI]';
  const hasWarnTag = /\[(UYARI|WARN|WARNING|Channel Check WARN|yt-dlp Uyarı|yt-dlp Warn)\]/i.test(text);
  const taggedText = hasWarnTag ? text : `${warnTag} ${text}`;
  appendSessionLog(taggedText);
  recordRecentError('warn', taggedText);
  const reset = '\x1b[0m';
  const yellow = '\x1b[33m';
  const outArgs = hasWarnTag ? translatedArgs : [warnTag, ...translatedArgs];
  const colorized = outArgs.map(arg => {
    if (typeof arg === 'string') {
      return `${yellow}${arg}${reset}`;
    }
    return arg;
  });
  originalWarn.apply(console, colorized);
};

// Asenkron süreç ve iş parçacığı hata yakalayıcıları (nodejs-backend-patterns)
process.on('unhandledRejection', (reason) => {
  const detail = reason && reason.stack ? reason.stack : reason;
  console.error('[HATA] [Yakalanmamış Promise Hatası]', detail);
  try { addTerminalLog(`[HATA] Yakalanmamış Promise: ${reason?.message || reason}`, 'error'); } catch {}
});

process.on('uncaughtException', (err) => {
  const detail = err && err.stack ? err.stack : err;
  console.error('[HATA] [Yakalanmamış İstisna]', detail);
  try { addTerminalLog(`[HATA] Yakalanmamış İstisna: ${err?.message || err}`, 'error'); } catch {}
});


import express from 'express';
import os from 'os';
import net from 'net';
import https from 'https';
import http from 'http';
import open from 'open';
import { execFile, execSync } from 'child_process';
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
  cleanLocalTempDir,
  testFfmpegSync
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
import { startCookieHealthCheck, getLastCookieHealth } from './server/services/cookieHealth.js';
import { startNetworkHealthCheck } from './server/services/networkHealth.js';
import { startFakapService, cleanupExpired } from './server/services/fakapService.js';
import { startMaintenanceService } from './server/services/maintenanceService.js';
import { startRemoteStatusScan, setStartupRemoteScanScheduled } from './server/services/remoteStatusScanner.js';
import { gzip } from 'zlib';
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
import { suggestClosestCliCommands } from './server/utils/cliSuggest.js';

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

// Türkçe Açıklama: Vanilla zlib ile asenkron ve seçici gzip sıkıştırma middleware'i.
// Yalnızca gzip destekleyen istemcilere, 1KB üzeri metin/JSON/HTML/JS yanıtlarına libuv iş parçacığında uygulanır.
// Video/ses/ikili tamponlar ve SSE (EventSource) yanıtları bu katmandan etkilenmez.
app.use((req, res, next) => {
  const acceptEncoding = req.headers['accept-encoding'] || '';
  if (!acceptEncoding.includes('gzip')) return next();
  const originalSend = res.send.bind(res);
  res.send = (body) => {
    const contentType = String(res.getHeader('Content-Type') || '').toLowerCase();
    const isBinaryOrCompressed =
      contentType.startsWith('video/') ||
      contentType.startsWith('audio/') ||
      (contentType.startsWith('image/') && !contentType.includes('svg')) ||
      contentType.includes('zip') ||
      contentType.includes('octet-stream') ||
      (Buffer.isBuffer(body) && !contentType);
    const buf = Buffer.isBuffer(body) ? body : (typeof body === 'string' ? Buffer.from(body, 'utf8') : null);
    if (!isBinaryOrCompressed && buf && buf.length > 1024 && !res.headersSent) {
      gzip(buf, (err, compressed) => {
        if (res.headersSent || res.writableEnded) return;
        if (err) {
          return originalSend(body);
        }
        res.setHeader('Content-Encoding', 'gzip');
        res.setHeader('Vary', 'Accept-Encoding');
        return originalSend(compressed);
      });
      return res;
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

// Akıllı, gürültüsüz API telemetri katmanı (yüksek frekanslı yoklama/thumbnail/SSE hariç)
app.use('/api', (req, res, next) => {
  const pathUrl = req.path || '';
  const isNoisyPoll =
    pathUrl === '/events' ||
    pathUrl === '/logs' ||
    pathUrl === '/system/console-stats' ||
    pathUrl === '/client-log' ||
    pathUrl === '/player/activity' ||
    pathUrl === '/version' ||
    /^\/video\/[^/]+\/thumbnail/.test(pathUrl) ||
    pathUrl === '/merge-queue/status' ||
    pathUrl === '/downloader/status' ||
    pathUrl === '/downloader/active-status' ||
    pathUrl === '/queue/status';

  const startedAt = Date.now();
  res.on('finish', () => {
    const elapsedMs = Date.now() - startedAt;
    const isMutating = req.method !== 'GET' && req.method !== 'HEAD';
    const isError = res.statusCode >= 400;
    const isSlow = elapsedMs >= 450;

    if (!apiVerboseLogging && isNoisyPoll && !isError && !isSlow) return;
    if (apiVerboseLogging || isError || isSlow || isMutating) {
      const tag = isError ? '[API] [HATA]' : (isSlow ? '[API] [YAVAŞ]' : '[API]');
      console.log(`${tag} ${req.method} /api${pathUrl} -> ${res.statusCode} (${elapsedMs}ms)`);
    }
  });
  next();
});

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
app.get('/api/system/console-stats', localhostOnly, (req, res) => {
  try {
    const db = readDb();
    const history = Array.isArray(db.history) ? db.history : [];
    const activeItems = history.filter(h => h.status === 'downloading' || h.status === 'merging');
    const waitingItems = history.filter(h => h.status === 'waiting');
    const directActiveId = downloadQueue.activeVideoId || (activeItems[0] ? activeItems[0].id : null);
    const activeItem = directActiveId
      ? history.find(h => h.id === directActiveId)
      : (activeItems[0] || null);
    const activeCount = Math.max(
      activeItems.length,
      typeof downloadQueue.activeDownloads === 'number' ? downloadQueue.activeDownloads : 0,
      downloadQueue.activeProcesses ? downloadQueue.activeProcesses.size : 0
    );
    const waitingCount = Math.max(
      waitingItems.length,
      downloadQueue.queue ? downloadQueue.queue.length : 0
    );
    const pendingMergeCount = history.filter(h => h.status === 'pending_merge' || h.status === 'merging_deferred').length;
    const mem = process.memoryUsage();
    const cookieHealth = getLastCookieHealth();
    const effectiveSpeed = getEffectiveSpeedLimit(db.settings || {});
    res.json({
      success: true,
      port: PORT,
      version: appVersion,
      uptimeSec: Math.floor(process.uptime()),
      memoryMb: Math.round(mem.rss / (1024 * 1024)),
      heapUsedMb: Math.round(mem.heapUsed / (1024 * 1024)),
      logsDir,
      dataRootDir,
      sessionLogFile,
      activeCount,
      waitingCount,
      queueCount: activeCount + waitingCount,
      activeVideoId: directActiveId || null,
      activeTitle: activeItem ? activeItem.title : '',
      activeSpeed: activeItem ? (activeItem.speed || '') : '',
      activeProgress: activeItem ? Math.round(Number(activeItem.progress) || 0) : 0,
      isPaused: Boolean(downloadQueue.isPaused),
      pendingMergeCount,
      cookieHealthy: cookieHealth ? Boolean(cookieHealth.healthy) : null,
      speedLimitKb: effectiveSpeed || 0,
      turtleActive: Boolean(db.settings?.useAlternativeSpeed),
      gameMode: Boolean(db.settings?.deferMerge),
      verboseApi: apiVerboseLogging,
      lang: db.settings?.lang || 'tr'
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
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
  '/tools/compare', '/tools/deleted', '/tools/categories', '/tools/ape', '/tools/subscriptions', '/tools/bulk-delete', '/tools/remote-status'
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
  const msg = err && err.stack ? err.stack : (err && err.message ? err.message : String(err));
  console.error(`[API] [HATA] ${req.method} ${req.originalUrl} -> İşlenmeyen sunucu hatası: ${msg}`);
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
setConsoleLang(initialDbState.settings?.lang || 'tr');
downloadQueue.isPaused = !!initialDbState.settings.isPaused;

// IPTV Önbelleği Lazy-Load: Başlangıçta RAM'e yüklenmez; yalnızca IPTV sekmesi/API'si kullanıldığında yüklenir.

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
          console.log(`[Güncelleme] Yeni sürüm mevcut: ${remoteTag} (geçerli: v${currentVersion})`);
          broadcast('update_status', updateState);
        } else {
          updateState = {
            updateAvailable: false,
            latestVersion: remoteTag,
            releaseUrl: null,
            releaseNotes: null,
            checkedAt: new Date().toISOString()
          };
          console.log(`[Güncelleme] Yazılım güncel: v${currentVersion} (GitHub: ${remoteTag})`);
        }
      }
    } else if (response.status === 403 || response.status === 429) {
      console.warn('[Güncelleme] GitHub API hız sınırı aşıldı, kontrol ertelendi.');
    }
  } catch (err) {
    console.warn('[Güncelleme] Kontrol hatası:', err.message);
  }
}

// yt-dlp binary varlığını doğrula
function ensureYtdlp() {
  return new Promise((resolve, reject) => {
    const filename = os.platform() === 'win32' ? 'yt-dlp.exe' : 'yt-dlp';
    if (fs.existsSync(ytdlpPath)) {
      console.log(`[Motor] ${filename} doğrulandı ve hazır.`);
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

// Konsoldan alternatif hız limitini değiştirince aktif indirmeleri kaldığı yerden (.part koruyarak) yeniden başlat
function restartActiveDownloadWithNewLimit(db, oldSpeedLimit, newSpeedLimit) {
  downloadQueue.restartActiveDownloadsForSpeedChange(oldSpeedLimit, newSpeedLimit);
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

  const pausedActiveCount = downloadQueue.interruptActiveDownloadsForPause();
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
    const outMsg = translateConsoleLog(msg);
    console.log(outMsg);
    if (logType) addTerminalLog(outMsg, logType);
    playAppSound('cli');
    if (notifyTitle) {
      showWindowsNotification(notifyTitle, outMsg.replace(/^\[Console\]\s*/, ''));
    }
    return { ok: true, message: outMsg };
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
      '  • diag / health / sistem       : RAM, çalışma süresi, FFmpeg/yt-dlp, çerez ve disk tanısı verir\n' +
      '  • queue / kuyruk               : Aktif indirme ve kuyrukta/birleştirmede bekleyenleri listeler\n' +
      '  • errors [N] / hatalar [N]     : Oturumdaki son N hata ve uyarı satırını özetler\n' +
      '  • verbose [on|off]             : Tüm API HTTP istek günlüklemesini açar veya kapatır\n' +
      '  • open / hide / tray / stop    : Pencereyi açar, tepsiye gizler, simgeyi gösterir veya kapatır\n' +
      '  • clear                        : Konsol ekranını temizler';
    return reply(helpMsg);
  }

  if (command === 'diag' || command === 'health' || command === 'sistem') {
    const db = readDb();
    const mem = process.memoryUsage();
    const rssMb = Math.round(mem.rss / (1024 * 1024));
    const heapMb = Math.round(mem.heapUsed / (1024 * 1024));
    const up = Math.floor(process.uptime());
    const hh = String(Math.floor(up / 3600)).padStart(2, '0');
    const mm = String(Math.floor((up % 3600) / 60)).padStart(2, '0');
    const ss = String(up % 60).padStart(2, '0');
    const ffmpegOk = testFfmpegSync();
    const ytdlpOk = fs.existsSync(ytdlpPath);
    const cookieState = getLastCookieHealth();
    const cookieLabel = cookieState === null ? 'Henüz test edilmedi' : (cookieState.healthy ? 'Sağlıklı' : 'Geçersiz / Yenileme Gerekli');
    let diskText = 'Bilinmiyor';
    try {
      const statFs = fs.statfsSync(db.settings.downloadPath || dataRootDir);
      const freeGb = ((statFs.bavail * statFs.bsize) / (1024 * 1024 * 1024)).toFixed(1);
      diskText = `${freeGb} GB boş`;
    } catch {}
    const msg = `[Console] Sistem Tanı Raporu:\n` +
      `  • Sürüm & Port   : v${appVersion} | http://127.0.0.1:${PORT} | Node ${process.version}\n` +
      `  • Çalışma & RAM  : ${hh}:${mm}:${ss} | RSS: ${rssMb} MB (Heap: ${heapMb} MB)\n` +
      `  • Araçlar        : yt-dlp=${ytdlpOk ? 'Hazır' : 'Eksik'} | ffmpeg=${ffmpegOk ? 'Hazır' : 'Eksik'}\n` +
      `  • Çerez & API    : YouTube Çerez="${cookieLabel}" | Verbose API=${apiVerboseLogging ? 'AÇIK' : 'KAPALI'}\n` +
      `  • Dizin & Disk   : Data="${dataRootDir}" | İndirme="${db.settings.downloadPath}" (${diskText})\n` +
      `  • Oturum Logu    : ${path.basename(sessionLogFile)}`;
    return reply(msg, 'info');
  }

  if (command === 'queue' || command === 'kuyruk') {
    const db = readDb();
    const history = Array.isArray(db.history) ? db.history : [];
    const active = history.filter(h => h.status === 'downloading' || h.status === 'merging');
    const waiting = history.filter(h => h.status === 'waiting');
    const pendingMerge = history.filter(h => h.status === 'pending_merge' || h.status === 'merging_deferred');
    const lines = [
      `[Console] Kuyruk Özeti (Aktif: ${active.length} | Bekleyen: ${waiting.length} | Birleştirme: ${pendingMerge.length} | Durum: ${downloadQueue.isPaused ? 'DURAKLATILDI' : 'AKTİF'})`
    ];
    active.forEach(item => {
      lines.push(`  ▶ [AKTİF] "${item.title}" (%${item.progress || 0}${item.speed ? ' · ' + item.speed : ''}${item.eta ? ' · ETA ' + item.eta : ''})`);
    });
    waiting.slice(0, 12).forEach((item, idx) => {
      lines.push(`  ⏳ [${idx + 1}/${waiting.length}] "${item.title}" (${item.platform || 'youtube'})`);
    });
    if (waiting.length > 12) lines.push(`  ... ve ${waiting.length - 12} bekleyen öğe daha.`);
    pendingMerge.slice(0, 5).forEach((item, idx) => {
      lines.push(`  🎞 [MERGE ${idx + 1}/${pendingMerge.length}] "${item.title}"`);
    });
    return reply(lines.join('\n'), 'info');
  }

  if (command === 'errors' || command === 'hatalar') {
    const rawLimit = args[0];
    if (rawLimit !== undefined && !/^\d+$/.test(rawLimit)) {
      const errMsg = translateConsoleLog('[Console] Hata: Geçerli bir pozitif tam sayı girmelisiniz. Örnek: errors 15');
      console.warn(errMsg);
      return { ok: false, message: errMsg };
    }
    const countArg = rawLimit ? parseInt(rawLimit, 10) : 15;
    if (countArg <= 0) {
      const errMsg = translateConsoleLog('[Console] Hata: Geçerli bir pozitif tam sayı girmelisiniz. Örnek: errors 15');
      console.warn(errMsg);
      return { ok: false, message: errMsg };
    }
    const limit = Math.min(countArg, MAX_RECENT_ERRORS);
    if (recentErrorLogs.length === 0) {
      return reply('[Console] Bu oturumda henüz hata veya uyarı kaydedilmedi.', 'success');
    }
    const slice = recentErrorLogs.slice(-limit);
    const lines = [`[Console] Son ${slice.length} Hata / Uyarı (Toplam hafıza: ${recentErrorLogs.length}):`];
    slice.forEach((e, idx) => {
      lines.push(`  ${idx + 1}. [${e.time}] ${e.text}`);
    });
    return reply(lines.join('\n'));
  }

  if (command === 'verbose' || command === 'log-api') {
    if (subArg) {
      if (['on', 'ac', '1', 'true'].includes(subArg)) apiVerboseLogging = true;
      else if (['off', 'kapat', '0', 'false'].includes(subArg)) apiVerboseLogging = false;
      else if (subArg === 'toggle') apiVerboseLogging = !apiVerboseLogging;
      else {
        const errMsg = translateConsoleLog(`[Console] Hata: "verbose" komutu için geçersiz parametre: "${args[0]}". Geçerli kullanım: verbose [on|off]`);
        console.warn(errMsg);
        return { ok: false, message: errMsg };
      }
    } else {
      apiVerboseLogging = !apiVerboseLogging;
    }
    return reply(`[Console] Ayrıntılı API HTTP günlüğü ${apiVerboseLogging ? 'AÇILDI' : 'KAPATILDI'}.`, 'info');
  }

  if (command === 'open' || command === 'show' || command === 'gui') {
    broadcast('window_control', { action: 'open' });
    return reply('[Console] Pencere öne getiriliyor.', 'info');
  }

  if (command === 'hide' || command === 'min' || command === 'minimize') {
    broadcast('window_control', { action: 'hide' });
    return reply('[Console] Pencere sistem tepsisine gizleniyor.', 'info');
  }

  if (command === 'tray') {
    broadcast('window_control', { action: 'tray' });
    return reply('[Console] Sistem tepsisi simgesi görünür yapıldı.', 'info');
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
  if (command === 'merge-pause' || command === 'birlestir-duraklat' || ((command === 'merge' || command === 'birlestir') && ['pause', 'duraklat', 'stop'].includes(subArg))) {
    mergeQueue.pause(false);
    return reply('[Console] Sıralı FFmpeg birleştirme kuyruğu duraklatıldı.', 'info');
  }

  if (command === 'merge' || command === 'merge-all' || command === 'birlestir') {
    if (subArg && !['all', 'start', 'baslat'].includes(subArg)) {
      const errMsg = translateConsoleLog(`[Console] Hata: "merge" komutu için geçersiz parametre: "${args[0]}". Geçerli kullanım: merge [pause]`);
      console.warn(errMsg);
      return { ok: false, message: errMsg };
    }
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
  const isGameRoot = ['game', 'gamemode', 'game-mode', 'oyun', 'defer-merge', 'defermerge'].includes(command);
  const isGameExplicitOn = command === 'gameon' || command === 'game-on' || command === 'oyunac' || command === 'oyun-ac' || command === 'defer-on' || command === 'deferon' ||
    (isGameRoot && ['on', 'ac', '1', 'true'].includes(subArg));
  const isGameExplicitOff = command === 'gameoff' || command === 'game-off' || command === 'oyunkapat' || command === 'oyun-kapat' || command === 'defer-off' || command === 'deferoff' ||
    (isGameRoot && ['off', 'kapat', '0', 'false'].includes(subArg));
  const isGameToggle = command === 'gametoggle' || command === 'game-toggle' || command === 'oyuntoggle' ||
    (isGameRoot && (!subArg || subArg === 'toggle'));

  if (isGameRoot && subArg && !isGameExplicitOn && !isGameExplicitOff && !isGameToggle) {
    const errMsg = translateConsoleLog(`[Console] Hata: "${command}" komutu için geçersiz parametre: "${args[0]}". Geçerli kullanım: game [on|off|toggle]`);
    console.warn(errMsg);
    return { ok: false, message: errMsg };
  }

  if (isGameExplicitOn || isGameExplicitOff || isGameToggle) {
    const prevDefer = Boolean(db.settings.deferMerge);
    const nextDefer = isGameExplicitOn ? true : (isGameExplicitOff ? false : !prevDefer);
    db.settings.deferMerge = nextDefer;
    if (nextDefer && mergeQueue.queue && mergeQueue.queue.length > 0) {
      mergeQueue.pause(false);
    }
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
      if (!/^\d+$/.test(String(val).trim())) {
        const errMsg = translateConsoleLog('[Console] Hata: Geçerli bir sayı girmelisiniz. Örnek: speed 2500, speed off veya speed on');
        console.warn(errMsg);
        return { ok: false, message: errMsg };
      }
      const numVal = parseInt(val, 10);
      if (isNaN(numVal) || numVal < 0 || numVal > 1000000) {
        const errMsg = translateConsoleLog('[Console] Hata: Geçerli bir sayı girmelisiniz. Örnek: speed 2500, speed off veya speed on');
        console.warn(errMsg);
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
    if (!/^\d+$/.test(String(val).trim())) {
      const errMsg = translateConsoleLog('[Console] Hata: Geçerli bir sayı girmelisiniz. Örnek: altspeed 500');
      console.warn(errMsg);
      return { ok: false, message: errMsg };
    }
    const numVal = parseInt(val, 10);
    if (isNaN(numVal) || numVal < 0 || numVal > 1000000) {
      const errMsg = translateConsoleLog('[Console] Hata: Geçerli bir sayı girmelisiniz. Örnek: altspeed 500');
      console.warn(errMsg);
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
        return reply('[Console] İndirme kuyruğu devam ettiriliyor.', 'info');
      } else {
        pauseDownloadQueue();
        return reply('[Console] İndirme kuyruğu duraklatıldı.', 'info');
      }
    }
    try {
      const vid = await addVideoToQueueByUrl(link);
      return reply(`[Console] Video kuyruğa başarıyla eklendi. ID: ${vid}`, 'success');
    } catch (err) {
      const errMsg = translateConsoleLog(`[Console] Hata: ${err.message}`);
      addTerminalLog(errMsg, 'error');
      console.error(errMsg);
      return { ok: false, message: errMsg };
    }
  } else if (command === 'clear') {
    console.clear();
    return { ok: true, message: '' };
  } else {
    const suggestions = suggestClosestCliCommands(command);
    const suggestPart = suggestions.length > 0
      ? ` Bunu mu demek istediniz: ${suggestions.join(', ')}?`
      : '';
    const unknownMsg = translateConsoleLog(
      `[Console] Bilinmeyen komut: "${command}".${suggestPart} Komut rehberi için "help" veya "?" yazabilirsiniz.`
    );
    console.warn(unknownMsg);
    return { ok: false, message: unknownMsg, suggestions };
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
    const activeLang = (db.settings?.lang || 'tr').toLowerCase();
    setConsoleLang(activeLang);
    console.log(`[TRAY_CMD] lang=${db.settings.lang || 'tr'}`);

    if (db.settings.discordRpcEnabled) {
      discordRpc.connect();
    }

    const isEn = activeLang !== 'tr';
    const startupHistory = Array.isArray(db.history) ? db.history : [];
    const startupCompleted = startupHistory.filter(h => h.status === 'completed').length;
    const startupWaiting = startupHistory.filter(h => h.status === 'waiting' || h.status === 'downloading').length;
    const startupPendingMerge = startupHistory.filter(h => h.status === 'pending_merge' || h.status === 'merging_deferred').length;
    const startupSpeed = getEffectiveSpeedLimit(db.settings || {});
    const ytdlpBadge = fs.existsSync(ytdlpPath) ? (isEn ? '✔ Ready' : '✔ Hazır') : (isEn ? '⏳ Checking' : '⏳ Kontrol ediliyor');
    const ffmpegBadge = testFfmpegSync() ? (isEn ? '✔ Ready' : '✔ Hazır') : (isEn ? '⏳ Checking' : '⏳ Kontrol ediliyor');
    const speedBadge = startupSpeed > 0 ? `${startupSpeed} KB/s` : (isEn ? 'Unlimited' : 'Limitsiz');
    const onOff = (v) => v ? (isEn ? 'Açık' : 'Açık') : (isEn ? 'Kapalı' : 'Kapalı');
    const onOffEn = (v) => v ? 'On' : 'Off';

    const bannerLines = isEn ? [
      `╔═══════════════════════════════════════════════════════════════════════════`,
      `║  ▶ MULTIMEDIA HaYTooL  v${appVersion}   ·   Desktop Media & Download Engine`,
      `╠═══════════════════════════════════════════════════════════════════════════`,
      `║  🌐 Server   : http://localhost:${PORT}   |   Node ${process.version}`,
      `║  📂 Data Dir : "${dataRootDir}"`,
      `║  ⚙  Engines  : yt-dlp ${ytdlpBadge}   ·   ffmpeg ${ffmpegBadge}   ·   Log: ${path.basename(sessionLogFile)}`,
      `║  📚 Library  : ${(db.channels || []).length} channels   ·   ${startupCompleted} downloaded   ·   ${startupWaiting} queued   ·   ${startupPendingMerge} merge`,
      `║  🎛  Modes    : Speed=${speedBadge}  ·  Turtle=${onOffEn(db.settings?.useAlternativeSpeed)}  ·  Game=${onOffEn(db.settings?.deferMerge)}  ·  AutoDL=${onOffEn(db.settings?.autoDownload)}  ·  Fakap=${onOffEn(db.settings?.fakapEnabled !== false)}`,
      `╠═══════════════════════════════════════════════════════════════════════════`,
      `║  💡 Commands : "diag" (health) · "queue" · "errors" · "verbose" · "help"`,
      `╚═══════════════════════════════════════════════════════════════════════════`
    ] : [
      `╔═══════════════════════════════════════════════════════════════════════════`,
      `║  ▶ MULTIMEDIA HaYTooL  v${appVersion}   ·   Masaüstü Medya & İndirme Motoru`,
      `╠═══════════════════════════════════════════════════════════════════════════`,
      `║  🌐 Adres       : http://localhost:${PORT}   |   Node ${process.version}`,
      `║  📂 Veri Dizini : "${dataRootDir}"`,
      `║  ⚙  Motorlar    : yt-dlp ${ytdlpBadge}   ·   ffmpeg ${ffmpegBadge}   ·   Log: ${path.basename(sessionLogFile)}`,
      `║  📚 Kütüphane   : ${(db.channels || []).length} kanal   ·   ${startupCompleted} indirilen   ·   ${startupWaiting} kuyrukta   ·   ${startupPendingMerge} birleştirme`,
      `║  🎛  Modlar      : Hız=${speedBadge}  ·  Turtle=${onOff(db.settings?.useAlternativeSpeed)}  ·  OyunModu=${onOff(db.settings?.deferMerge)}  ·  Otoİndirme=${onOff(db.settings?.autoDownload)}  ·  Fakap=${onOff(db.settings?.fakapEnabled !== false)}`,
      `╠═══════════════════════════════════════════════════════════════════════════`,
      `║  💡 Komutlar    : "diag" (tanı) · "queue" (kuyruk) · "errors" (hata) · "help"`,
      `╚═══════════════════════════════════════════════════════════════════════════`
    ];
    console.log(bannerLines.join('\n'));
    
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
    // Masaüstü uygulaması (TrayManager) aktifse MainWindow kendi CookieManager'ından senkronize edeceği için ikinci süreç başlatılmaz.
    if (process.env.HAYTOOL_MANAGED_BY_TRAY !== '1') {
      setTimeout(() => {
        triggerSilentCookieRefresh();
      }, 2000);
    }
    
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

    // Açılışta uzak durum taraması aktifse ve bugün henüz tarama yapılmadıysa, otomatik silmeyi tarama bitene kadar beklet
    const todayRemoteScanDate = new Date().toISOString().slice(0, 10);
    const lastRemoteScanMarkerPath = path.join(dataRootDir, '.last_remote_scan_date');
    let isRemoteScannedToday = false;
    try {
      if (fs.existsSync(lastRemoteScanMarkerPath)) {
        isRemoteScannedToday = fs.readFileSync(lastRemoteScanMarkerPath, 'utf8').trim() === todayRemoteScanDate;
      }
    } catch {}
    if (db.settings && db.settings.scanRemoteStatusOnStartup !== false && !isRemoteScannedToday) {
      setStartupRemoteScanScheduled(true);
    }

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

      const latestDb = readDb();
      const todayDateStr = new Date().toISOString().slice(0, 10);
      const lastScanMarkerPath = path.join(dataRootDir, '.last_remote_scan_date');
      let alreadyScannedToday = false;
      try {
        if (fs.existsSync(lastScanMarkerPath)) {
          alreadyScannedToday = fs.readFileSync(lastScanMarkerPath, 'utf8').trim() === todayDateStr;
        }
      } catch {}

      if (latestDb.settings && latestDb.settings.scanRemoteStatusOnStartup !== false && !alreadyScannedToday) {
        try {
          addTerminalLog('[Sistem Açılışı] İndirilen YouTube videoları uzak durum taraması arka planda başlatılıyor (Günde 1 kez)...', 'info');
          startRemoteStatusScan({
            onlyUnchecked: false,
            isStartupScan: true,
            onComplete: () => {
              try { fs.writeFileSync(lastScanMarkerPath, todayDateStr, 'utf8'); } catch {}
              setTimeout(() => autoDeleteOldVideos(), 500);
            }
          });
        } catch (err) {
          setStartupRemoteScanScheduled(false);
          console.error('[Uzak Durum] Başlangıç taramasında hata oluştu:', err.message);
        }
      } else {
        if (alreadyScannedToday && latestDb.settings?.scanRemoteStatusOnStartup !== false) {
          console.log(`[Uzak Durum] Bugün (${todayDateStr}) açılış taraması zaten yapıldığı için tekrar atlandı.`);
        }
        setStartupRemoteScanScheduled(false);
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
              execFile(playerExists, ['/downlist'], { cwd: baseDir, windowsHide: false }, (err) => {
                if (err) {
                  console.log(`Multimedia HaYTooL açılamadı, sistem tarayıcısına yönlendiriliyor: ${err.message}`);
                  open(targetUrl).catch(() => {});
                }
              });
            } catch (e) {
              open(targetUrl).catch(() => {});
            }
          } else if (actionPref === 'embedded') {
            execFile('cmd.exe', ['/c', 'start', '', 'msedge', `--app=${targetUrl}`], { windowsHide: true }, (err) => {
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
            execFile(appBrowser, [`--app=${targetUrl}`], (err) => {
              if (err) console.log(`AppMode açılamadı, lütfen ${targetUrl} adresine manuel gidin.`);
            });
          } else {
            // Fallback
            execFile('xdg-open', [targetUrl], (err) => {
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
