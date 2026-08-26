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

// Oturum Log Yönetimi ve Otomatik Rotasyon (Son 30 oturum logu saklanır)
const logsDir = path.join(process.cwd(), 'logs');
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
import { downloadQueue, getEffectiveSpeedLimit } from './server/services/downloader.js';
import { 
  triggerChannelCheck,
  resolveMissingDurations, 
  fetchVideoDuration,
  checkPendingLiveStreams
} from './server/services/rss.js';
import { addTerminalLog, broadcast } from './server/services/sse.js';
import { startCookieHealthCheck } from './server/services/cookieHealth.js';
import { gzipSync } from 'zlib';
import { discordRpc } from './server/services/discord.js';
import { setIptvChannels } from './server/services/iptv.js';
import { configIniPath, parseIni } from './server/config.js';
import { appVersion } from './server/version.js';

// API Rotası Modülleri
import { router as settingsRouter, ensureDailySystemBackup, triggerSilentCookieRefresh, setupPeriodicDiskSync } from './server/routes/settings.js';
import { router as channelsRouter } from './server/routes/channels.js';
import { router as historyRouter } from './server/routes/history.js';
import { router as iptvRouter } from './server/routes/iptv.js';
import { router as streamsRouter } from './server/routes/streams.js';
import { router as queueRouter } from './server/routes/queue.js';
import { router as downloaderRouter } from './server/routes/downloader.js';
import { router as gistRouter } from './server/routes/gist.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Port Ayarlarını configwin.ini/configunix.ini üzerinden oku
const config = parseIni(configIniPath);
const settingsSection = config.Settings || config;
const PORT = parseInt(settingsSection.port || settingsSection.Port || 4141, 10);

// Dizin Tanımları
const iptvCachePath = path.join(process.cwd(), 'iptv_cache.json');

// Express Uygulaması Kurulumu
const app = express();
app.use(express.json());

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

// Statik Dosyaları Sun (public/ klasörü, index.html otomatik gönderimi devre dışı)
// ?v= sürüm parametreli dosyalar güvenle 7 gün önbelleklenebilir
app.use(express.static(path.join(__dirname, 'public'), { index: false, maxAge: '7d' }));

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
app.use('/api/gist', gistRouter);
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
    '<!--PARTIAL:modals-->': 'modals.html',
  };

  for (const [tag, file] of Object.entries(partialMap)) {
    const fullPath = path.join(partialsDir, file);
    if (fs.existsSync(fullPath)) {
      const content = fs.readFileSync(fullPath, 'utf8');
      html = html.replace(tag, content);
    }
  }

  return html;
}

// Ana Sayfa ve SPA Yönlendirmeleri (Modüler Partial Birleştirmeli)
app.get(['/', '/index.html', '/home', '/download', '/downlist', '/channels', '/settings', '/iptv', '/downloader', '/tools'], (req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(getCompositeIndexHtml());
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
let liveStreamTimer = null;

function startLiveStreamTimer() {
  const db = readDb();
  if (liveStreamTimer) {
    clearInterval(liveStreamTimer);
    liveStreamTimer = null;
  }
  if (db.settings.isPaused) return;

  const mins = parseInt(db.settings.liveStreamRetryInterval, 10) || 30;
  liveStreamTimer = setInterval(async () => {
    try {
      await checkPendingLiveStreams();
    } catch (err) {
      console.error('[Canlı Yayın Zamanlayıcı] Kontrol hatası:', err.message);
    }
  }, mins * 60 * 1000);
}

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
      await triggerChannelCheck('timer');
    } catch (err) {
      console.error('[Zamanlayıcı] RSS kontrolü çalıştırılamadı:', err.message);
    }
  }, seconds * 1000);

  startLiveStreamTimer();
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
  if (downloadQueue && (downloadQueue.activeDownloads > 0 || (downloadQueue.activeProcesses && downloadQueue.activeProcesses.size > 0))) {
    return; // Aktif indirme veya FFmpeg birleştirmesi varken oto-silmeyi ertele
  }

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
    console.log('[Console] Kullanılabilir Komutlar:\n' +
                '  • status                 : Hız limitlerini ve aktif indirme durumunu gösterir\n' +
                '  • ton / turtleon         : Alternatif kaplumbağa hız limitini açar\n' +
                '  • toff / turtleoff       : Alternatif kaplumbağa hız limitini kapatır\n' +
                '  • toggle                 : Alternatif hız modunu açar/kapatır (geçiş yapar)\n' +
                '  • speed <değer|off|on>   : Normal hız limitini ayarlar veya kapatır (örn: speed 2500, speed off)\n' +
                '  • altspeed <değer>       : Alternatif hız profilini ayarlar (örn: altspeed 500)\n' +
                '  • pd <link>              : Belirtilen YouTube video/oynatma listesini kuyruğa ekler\n' +
                '  • clear                  : Konsol ekranını temizler');
    return;
  }

  const db = readDb();

  if (command === 'ton' || command === 'turtleon' || command === 'turtleac') {
    const oldLimit = getEffectiveSpeedLimit(db.settings);
    db.settings.useAlternativeSpeed = true;
    const newLimit = getEffectiveSpeedLimit(db.settings);
    const speedLimitChanged = oldLimit !== newLimit;
    writeDb(db);
    broadcast('db_update', db);
    addTerminalLog(`[Console] Alternative speed limit (Turtle) ENABLED. Limit: ${newLimit} KB/s`, 'info');
    console.log(`[Console] Alternative speed limit (Turtle) ENABLED. Limit: ${newLimit} KB/s`);
    if (speedLimitChanged && downloadQueue.activeProcess && downloadQueue.activeVideoId) {
      restartActiveDownloadWithNewLimit(db, oldLimit, newLimit);
    }
  } else if (command === 'toff' || command === 'turtleoff' || command === 'turtlekapat') {
    const oldLimit = getEffectiveSpeedLimit(db.settings);
    db.settings.useAlternativeSpeed = false;
    const newLimit = getEffectiveSpeedLimit(db.settings);
    const speedLimitChanged = oldLimit !== newLimit;
    writeDb(db);
    broadcast('db_update', db);
    addTerminalLog(`[Console] Alternative speed limit (Turtle) DISABLED. Limit: ${newLimit} KB/s`, 'info');
    console.log(`[Console] Alternative speed limit (Turtle) DISABLED. Limit: ${newLimit} KB/s`);
    if (speedLimitChanged && downloadQueue.activeProcess && downloadQueue.activeVideoId) {
      restartActiveDownloadWithNewLimit(db, oldLimit, newLimit);
    }
  } else if (command === 'toggle' || (command === 'altspeed' && args[0] === 'toggle')) {
    const oldLimit = getEffectiveSpeedLimit(db.settings);
    db.settings.useAlternativeSpeed = !db.settings.useAlternativeSpeed;
    const newLimit = getEffectiveSpeedLimit(db.settings);
    const speedLimitChanged = oldLimit !== newLimit;
    writeDb(db);
    broadcast('db_update', db);
    const stateStr = db.settings.useAlternativeSpeed ? 'AÇIK (ENABLED)' : 'KAPALI (DISABLED)';
    addTerminalLog(`[Console] Alternatif hız sınırı (Turtle): ${stateStr}. Geçerli Limit: ${newLimit} KB/s`, 'info');
    console.log(`[Console] Alternatif hız sınırı (Turtle): ${stateStr}. Geçerli Limit: ${newLimit} KB/s`);
    if (speedLimitChanged && downloadQueue.activeProcess && downloadQueue.activeVideoId) {
      restartActiveDownloadWithNewLimit(db, oldLimit, newLimit);
    }
  } else if (command === 'speed') {
    const val = args[0];
    if (!val) {
      console.log(`[Console] Geçerli normal hız limiti: ${db.settings.downloadSpeedLimit || 0} KB/s (0 = Limitsiz)`);
      return;
    }
    const oldLimit = getEffectiveSpeedLimit(db.settings);
    if (val.toLowerCase() === 'off' || val === '0' || val.toLowerCase() === 'none') {
      db.settings.downloadSpeedLimit = 0;
      console.log('[Console] Hız limiti KAPATILDI (Limitsiz mod).');
      addTerminalLog('[Console] Normal indirme hız limiti KAPATILDI (Limitsiz mod).', 'info');
    } else {
      const numVal = parseInt(val, 10);
      if (isNaN(numVal) || numVal < 0) {
        console.log('[Console] Hata: Geçerli bir sayı girmelisiniz. Örnek: speed 2500 veya speed off');
        return;
      }
      db.settings.downloadSpeedLimit = numVal;
      console.log(`[Console] Normal indirme hız limiti ${numVal} KB/s olarak ayarlandı.`);
      addTerminalLog(`[Console] Normal indirme hız limiti ${numVal} KB/s olarak ayarlandı.`, 'info');
    }
    const newLimit = getEffectiveSpeedLimit(db.settings);
    const speedLimitChanged = oldLimit !== newLimit;
    writeDb(db);
    broadcast('db_update', db);
    if (speedLimitChanged && downloadQueue.activeProcess && downloadQueue.activeVideoId) {
      restartActiveDownloadWithNewLimit(db, oldLimit, newLimit);
    }
  } else if (command === 'altspeed') {
    const val = args[0];
    if (!val) {
      console.log(`[Console] Geçerli alternatif hız limiti: ${db.settings.alternativeSpeedLimit || 500} KB/s`);
      return;
    }
    const numVal = parseInt(val, 10);
    if (isNaN(numVal) || numVal < 0) {
      console.log('[Console] Hata: Geçerli bir sayı girmelisiniz. Örnek: altspeed 500');
      return;
    }
    const oldLimit = getEffectiveSpeedLimit(db.settings);
    db.settings.alternativeSpeedLimit = numVal;
    writeDb(db);
    broadcast('db_update', db);
    console.log(`[Console] Alternatif hız limiti ${numVal} KB/s olarak ayarlandı.`);
    addTerminalLog(`[Console] Alternatif hız limiti ${numVal} KB/s olarak ayarlandı.`, 'info');
    const newLimit = getEffectiveSpeedLimit(db.settings);
    if (db.settings.useAlternativeSpeed && oldLimit !== newLimit && downloadQueue.activeProcess && downloadQueue.activeVideoId) {
      restartActiveDownloadWithNewLimit(db, oldLimit, newLimit);
    }
  } else if (command === 'status') {
    const effective = getEffectiveSpeedLimit(db.settings);
    const altStatus = db.settings.useAlternativeSpeed ? 'Active (Kaplumbağa Açık)' : 'Inactive (Kaplumbağa Kapalı)';
    console.log(`[Console] Sistem Durumu:
      - Normal Hız Limiti: ${db.settings.downloadSpeedLimit || 0} KB/s (${db.settings.downloadSpeedLimit ? 'Aktif' : 'Limitsiz'})
      - Alternatif Hız Limiti: ${db.settings.alternativeSpeedLimit || 500} KB/s
      - Alternatif Hız (Turtle): ${altStatus}
      - Geçerli İndirme Limiti: ${effective > 0 ? effective + ' KB/s' : 'Limitsiz'}
      - Aktif İndirme Süreci: ${downloadQueue.activeVideoId ? 'Evet (' + downloadQueue.activeVideoId + ')' : 'Hayır'}`);
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
    console.log('[Console] Bilinmeyen komut. Komut rehberi için "help" veya "?" yazabilirsiniz.');
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
      addTerminalLog('[Sistem Açılışı] YouTube oturum çerezleri açılışta tazeleniyor...', 'info');
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
      if (currentDb.settings.checkChannelsOnStartup && !currentDb.settings.isPaused && currentDb.channels.length > 0) {
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

    // Tarayıcıyı aç
    const currentDbState = readDb();
    if (currentDbState.settings.autoOpenBrowser !== false) {
      const targetUrl = `http://localhost:${PORT}`;
      if (process.platform === 'linux') {
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
