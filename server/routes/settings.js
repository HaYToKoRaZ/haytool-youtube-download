// Türkçe Açıklama: Ayarların kaydedilmesi, çerez testi, log geçmişi, disk alanı sorguları ve FFmpeg indirme yönetimi API rotaları modülü.
import express from 'express';
import fs from 'fs';
import path from 'path';
import os from 'os';
import https from 'https';
import http from 'http';
import zlib from 'zlib';
import { spawn, exec, execSync, execFileSync } from 'child_process';
import { Readable } from 'stream';
import open from 'open';
import { 
  readDb, 
  writeDb, 
  syncDbWithDisk, 
  updateHistoryItem,
  defaultDownloadDir,
  saveCategoriesToIni
} from '../database.js';
import { localhostOnly } from '../middleware/security.js';
import { ytdlpPath, getFfmpegPath, testFfmpegSync, setFfmpegWorkingCached, getLocalTempDir, spawnYtdlp } from '../services/paths.js';
import { downloadQueue, getEffectiveSpeedLimit, getCookieArgs } from '../services/downloader.js';
import { broadcast, addTerminalLog, terminalLogs } from '../services/sse.js';
import { categoriesIniPath } from '../config.js';
export function formatBackupDateStr(now = new Date()) {
  const day = String(now.getDate()).padStart(2, '0');
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const year = String(now.getFullYear()).slice(-2);
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  return `${day}-${month}-${year}_${hours}-${minutes}-${seconds}`;
}

export const router = express.Router();

let checkIntervalTimer = null;

// Türkçe Açıklama: RSS video kontrol döngüsünü ayardaki saniyeye göre başlatır (rss.js modülünü dinamik çağırır).
/**
 * RSS video kontrol döngüsünü ayardaki saniyeye göre başlatır / günceller.
 * 
 * @returns {Promise<void>}
 */
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
      const { triggerChannelCheck } = await import('../services/rss.js');
      await triggerChannelCheck('timer');
    } catch (err) {
      console.error('[Zamanlayıcı Error] RSS kontrolü çalıştırılamadı:', err.message);
    }
  }, seconds * 1000);
}

/**
 * Sistemdeki aktif çerez durumunu ve YouTube oturumunu kontrol eder.
 * 
 * @name GET /api/youtube-auth-status
 * @function
 * @inner
 * @returns {Promise<void>}
 */
router.get('/youtube-auth-status', localhostOnly, async (req, res) => {
  const rootCookiesTxt = path.resolve(process.cwd(), 'cookies.txt');
  const binCookiesTxt = path.resolve(process.cwd(), 'bin', 'cookies.txt');
  
  let hasValidCookies = false;
  let activeSource = 'none';

  if (fs.existsSync(rootCookiesTxt)) {
    try {
      const content = fs.readFileSync(rootCookiesTxt, 'utf8');
      if (content.includes('LOGIN_INFO') || content.includes('__Secure-1PSID') || content.includes('SID')) {
        hasValidCookies = true;
        activeSource = 'cookies.txt';
      }
    } catch (e) {}
  } else if (fs.existsSync(binCookiesTxt)) {
    try {
      const content = fs.readFileSync(binCookiesTxt, 'utf8');
      if (content.includes('LOGIN_INFO') || content.includes('__Secure-1PSID') || content.includes('SID')) {
        hasValidCookies = true;
        activeSource = 'cookies.txt';
      }
    } catch (e) {}
  }

  res.json({
    success: true,
    activeSource,
    hasCookiesTxt: hasValidCookies,
    hasWebView2Cookies: hasValidCookies,
    selectedBrowser: 'none'
  });
});

/**
 * YouTube'da oturum açmak için HaYTooL dahili tarayıcısını (veya sistem tarayıcısını) açar.
 * 
 * @name POST /api/open-youtube-login
 * @function
 * @inner
 * @returns {void}
 */
router.post('/open-youtube-login', localhostOnly, (req, res) => {
  try {
    const loginUrl = 'https://accounts.google.com/ServiceLogin?service=youtube&continue=https%3A%2F%2Fwww.youtube.com';

    if (process.platform === 'win32') {
      exec(`cmd /c start "" "${loginUrl}"`, (err) => {
        if (err) {
          open(loginUrl);
        }
      });
    } else {
      open(loginUrl);
    }

    console.log('[YouTube Login] YouTube oturum açma sayfası tarayıcıda başlatıldı.');
    res.json({ success: true, message: 'YouTube oturum açma penceresi açıldı.' });
  } catch (err) {
    console.error('[YouTube Login Hatası]:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * YouTube oturumunu kapatır ve yerel çerez dosyalarını temizler.
 * 
 * @name POST /api/logout-youtube
 * @function
 * @inner
 * @returns {void}
 */
router.post('/logout-youtube', localhostOnly, (req, res) => {
  try {
    const rootCookiesTxt = path.resolve(process.cwd(), 'cookies.txt');
    const binCookiesTxt = path.resolve(process.cwd(), 'bin', 'cookies.txt');

    if (fs.existsSync(rootCookiesTxt)) {
      try { fs.unlinkSync(rootCookiesTxt); } catch (e) {}
    }
    if (fs.existsSync(binCookiesTxt)) {
      try { fs.unlinkSync(binCookiesTxt); } catch (e) {}
    }

    if (process.platform === 'win32') {
      const localAppData = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
      const mainDir = path.join(localAppData, 'HaYTooLPlayer_Main');
      const ebDir = path.join(mainDir, 'EBWebView');

      const cookieFiles = [
        path.join(ebDir, 'Default', 'Network', 'Cookies'),
        path.join(ebDir, 'Default', 'Cookies'),
        path.join(mainDir, 'Default', 'Network', 'Cookies'),
        path.join(mainDir, 'Default', 'Cookies')
      ];

      for (const cPath of cookieFiles) {
        if (fs.existsSync(cPath)) {
          try { fs.unlinkSync(cPath); } catch (e) {}
        }
      }

      // Açık olan HaYTooLPlayer varsa bellek çerezlerini temizlemesi için LOGOUT sinyali gönder
      const launcherExe = path.resolve(process.cwd(), 'HaYTooL-Player Beta.exe');
      if (fs.existsSync(launcherExe)) {
        exec(`"${launcherExe}" LOGOUT`, () => {});
      }
    }

    console.log('[YouTube Logout] YouTube oturumu kapatıldı ve yerel çerezler temizlendi.');
    res.json({
      success: true,
      message: 'YouTube oturumu başarıyla kapatıldı.'
    });
  } catch (err) {
    console.error('[YouTube Logout Hatası]:', err.message);
    res.status(500).json({
      success: false,
      error: 'Çerezler temizlenirken hata oluştu: ' + err.message
    });
  }
});

/**
 * Netscape formatındaki cookies.txt içeriğini doğrudan ana dizine kaydeder.
 * 
 * @name POST /api/save-cookies-txt
 * @function
 * @inner
 * @returns {void}
 */
router.post('/save-cookies-txt', localhostOnly, (req, res) => {
  const { content } = req.body;
  if (typeof content !== 'string') {
    return res.status(400).json({ success: false, error: 'Geçersiz çerez içeriği.' });
  }

  const rootCookiesTxt = path.resolve(process.cwd(), 'cookies.txt');
  try {
    if (!content.trim()) {
      if (fs.existsSync(rootCookiesTxt)) {
        fs.unlinkSync(rootCookiesTxt);
      }
      return res.json({ success: true, message: 'cookies.txt dosyası kaldırıldı.' });
    }

    fs.writeFileSync(rootCookiesTxt, content.trim(), 'utf8');
    console.log('[Çerez Yönetimi] cookies.txt dosyası başarıyla kaydedildi.');
    res.json({ success: true, message: 'cookies.txt başarıyla kaydedildi ve etkinleştirildi.' });
  } catch (err) {
    console.error('[Çerez Kaydetme Hatası]:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Seçilen tarayıcının premium çerezlerinin YouTube için geçerli olup olmadığını test eder.
 * 
 * @name GET /api/test-cookies
 * @function
 * @inner
 * @param {object} req - Express istek nesnesi
 * @param {object} res - Express yanıt nesnesi
 * @returns {Promise<void>}
 */
router.get('/test-cookies', localhostOnly, async (req, res) => {
  const db = readDb();
  const result = await testCookiesValidity(db.settings.browser);
  res.json(result);
});

// Hava Durumu Bellek İçi Önbelleği (15 Dakika)
let weatherCache = {
  key: null,
  timestamp: 0,
  data: null
};

function getWmoWeatherInfo(code) {
  switch (code) {
    case 0:
      return { icon: 'sun', descKey: 'weather_clear', defaultDesc: 'Açık / Güneşli' };
    case 1:
      return { icon: 'cloud-sun', descKey: 'weather_mostly_clear', defaultDesc: 'Çoğunlukla Açık' };
    case 2:
      return { icon: 'cloud-sun', descKey: 'weather_partly_cloudy', defaultDesc: 'Parçalı Bulutlu' };
    case 3:
      return { icon: 'cloud', descKey: 'weather_overcast', defaultDesc: 'Kapalı / Bulutlu' };
    case 45:
    case 48:
      return { icon: 'cloud-fog', descKey: 'weather_fog', defaultDesc: 'Sisli' };
    case 51:
    case 53:
    case 55:
      return { icon: 'cloud-drizzle', descKey: 'weather_drizzle', defaultDesc: 'Çisenti' };
    case 61:
    case 63:
    case 65:
      return { icon: 'cloud-rain', descKey: 'weather_rain', defaultDesc: 'Yağmurlu' };
    case 71:
    case 73:
    case 75:
    case 77:
      return { icon: 'cloud-snow', descKey: 'weather_snow', defaultDesc: 'Kar Yağışlı' };
    case 80:
    case 81:
    case 82:
      return { icon: 'cloud-rain', descKey: 'weather_showers', defaultDesc: 'Sağanak Yağış' };
    case 85:
    case 86:
      return { icon: 'cloud-snow', descKey: 'weather_snow_showers', defaultDesc: 'Kar Sağanağı' };
    case 95:
    case 96:
    case 99:
      return { icon: 'cloud-lightning', descKey: 'weather_thunderstorm', defaultDesc: 'Gök Gürültülü Fırtına' };
    default:
      return { icon: 'cloud-sun', descKey: 'weather_partly_cloudy', defaultDesc: 'Parçalı Bulutlu' };
  }
}

/**
 * Open-Meteo üzerinden anlık hava durumunu döner. 15 dakikalık önbellek kullanır.
 * 
 * @name GET /api/weather
 * @function
 * @inner
 * @param {object} req - Express istek nesnesi
 * @param {object} res - Express yanıt nesnesi
 * @returns {Promise<void>}
 */
router.get('/weather', async (req, res) => {
  try {
    const db = readDb();
    const settings = db.settings || {};
    
    if (settings.weatherEnabled === false) {
      return res.json({ success: true, enabled: false });
    }

    const lat = settings.weatherLatitude !== undefined ? settings.weatherLatitude : 41.0082;
    const lon = settings.weatherLongitude !== undefined ? settings.weatherLongitude : 28.9784;
    const city = settings.weatherCity || 'İstanbul';
    const unit = settings.weatherUnit === 'fahrenheit' ? 'fahrenheit' : 'celsius';
    const unitSymbol = unit === 'fahrenheit' ? '°F' : '°C';
    const cacheKey = `${Number(lat).toFixed(3)}_${Number(lon).toFixed(3)}_${unit}`;
    const now = Date.now();

    // 15 dakikalık (900.000 ms) önbellek kontrolü
    if (weatherCache.data && weatherCache.key === cacheKey && (now - weatherCache.timestamp) < 900000 && req.query.force !== 'true') {
      return res.json({ success: true, enabled: true, cached: true, ...weatherCache.data, city });
    }

    const apiUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m&temperature_unit=${unit}&wind_speed_unit=kmh`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const apiRes = await fetch(apiUrl, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!apiRes.ok) {
      throw new Error(`Open-Meteo HTTP ${apiRes.status}`);
    }

    const json = await apiRes.json();
    const current = json.current || {};
    const temp = Math.round(current.temperature_2m !== undefined ? current.temperature_2m : 0);
    const feelsLike = Math.round(current.apparent_temperature !== undefined ? current.apparent_temperature : temp);
    const humidity = Math.round(current.relative_humidity_2m || 0);
    const windSpeed = Math.round(current.wind_speed_10m || 0);
    const weatherCode = current.weather_code !== undefined ? current.weather_code : 0;
    const weatherInfo = getWmoWeatherInfo(weatherCode);

    const payload = {
      temp,
      unit: unitSymbol,
      feelsLike,
      humidity,
      windSpeed,
      weatherCode,
      icon: weatherInfo.icon,
      descKey: weatherInfo.descKey,
      defaultDesc: weatherInfo.defaultDesc,
      city
    };

    weatherCache = {
      key: cacheKey,
      timestamp: now,
      data: payload
    };

    return res.json({ success: true, enabled: true, cached: false, ...payload });
  } catch (err) {
    if (weatherCache.data) {
      return res.json({ success: true, enabled: true, cached: true, stale: true, ...weatherCache.data });
    }
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Şehir adı ile koordinat arama proxy uç noktası.
 * 
 * @name GET /api/weather/geocode
 * @function
 * @inner
 * @param {object} req - Express istek nesnesi
 * @param {object} res - Express yanıt nesnesi
 * @returns {Promise<void>}
 */
router.get('/weather/geocode', async (req, res) => {
  try {
    const query = (req.query.query || '').trim();
    if (!query || query.length < 2) {
      return res.json({ success: true, results: [] });
    }

    const apiUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=6&language=tr&format=json`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    const apiRes = await fetch(apiUrl, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!apiRes.ok) {
      throw new Error(`Geocoding HTTP ${apiRes.status}`);
    }

    const json = await apiRes.json();
    const results = (json.results || []).map(item => ({
      name: item.name,
      country: item.country || '',
      admin1: item.admin1 || '',
      latitude: item.latitude,
      longitude: item.longitude
    }));

    return res.json({ success: true, results });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Bellekteki terminal günlüklerini (SSE terminal log geçmişi) istemciye döner.
 * 
 * @name GET /api/logs
 * @function
 * @inner
 * @param {object} req - Express istek nesnesi
 * @param {object} res - Express yanıt nesnesi
 * @returns {void}
 */
router.get('/logs', (req, res) => {
  res.json(terminalLogs);
});

/**
 * Uygulama ayarlarını günceller ve kaydeder. Hız sınırları, tema ve diğer tercihleri veritabanına yazar.
 * 
 * @name POST /api/settings
 * @function
 * @inner
 * @param {object} req - Express istek nesnesi
 * @param {object} req.body - Güncellenecek ayarların anahtar-değer çiftleri
 * @param {object} res - Express yanıt nesnesi
 * @returns {void}
 */
router.post('/settings', localhostOnly, (req, res) => {
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

/**
 * FFmpeg ve FFprobe binary dosyalarını platforma göre (Windows/Linux/macOS)
 * ffbinaries CDN üzerinden indirir, ZIP'ten çıkarır ve `ffmpeg/` klasörüne yerleştirir.
 * İndirme sırasında `ffmpegDownloadState` durumu SSE üzerinden arayüze anlık iletilir.
 * Zaten indirme/çıkarma aşamasındaysa tekrar başlatılmaz (idempotent).
 *
 * @returns {Promise<void>}
 */
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

  const ffmpegMirrors = [
    urls.ffmpeg,
    `https://ffbinaries.com/downloads/ffmpeg-6.1-${platformKey === 'windows-64' ? 'win' : platformKey === 'linux-64' ? 'linux' : 'macos'}-64.zip`
  ];
  const ffprobeMirrors = [
    urls.ffprobe,
    `https://ffbinaries.com/downloads/ffprobe-6.1-${platformKey === 'windows-64' ? 'win' : platformKey === 'linux-64' ? 'linux' : 'macos'}-64.zip`
  ];
  
  const downloadHelper = async (urlCandidates, dest, startPercent, endPercent) => {
    const list = Array.isArray(urlCandidates) ? urlCandidates : [urlCandidates];
    let lastError = null;

    for (const targetUrl of list) {
      try {
        console.log(`[FFmpeg] Downloading from: ${targetUrl}`);
        await new Promise((resolve, reject) => {
          const request = (currentUrl, redirectCount = 0) => {
            if (redirectCount > 8) {
              return reject(new Error('Too many redirects'));
            }
            const isHttps = currentUrl.startsWith('https');
            const client = isHttps ? https : http;
            
            const req = client.get(currentUrl, {
              headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': '*/*'
              }
            }, (res) => {
              if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                const nextUrl = new URL(res.headers.location, currentUrl).href;
                return request(nextUrl, redirectCount + 1);
              }
              if (res.statusCode !== 200) {
                return reject(new Error(`HTTP status ${res.statusCode}`));
              }

              const totalBytes = parseInt(res.headers['content-length'] || '0', 10);
              let downloadedBytes = 0;
              const fileStream = fs.createWriteStream(dest);

              res.on('data', (chunk) => {
                downloadedBytes += chunk.length;
                if (totalBytes > 0) {
                  const fileProgress = downloadedBytes / totalBytes;
                  const totalProgress = startPercent + fileProgress * (endPercent - startPercent);
                  ffmpegDownloadState.progress = Math.round(totalProgress);
                  broadcast('ffmpeg_download', ffmpegDownloadState);
                }
              });

              res.pipe(fileStream);

              fileStream.on('finish', () => {
                fileStream.close();
                resolve();
              });

              fileStream.on('error', (err) => {
                try { fs.unlinkSync(dest); } catch(e) {}
                reject(err);
              });

              res.on('error', (err) => {
                try { fs.unlinkSync(dest); } catch(e) {}
                reject(err);
              });
            });

            req.on('error', (err) => {
              try { fs.unlinkSync(dest); } catch(e) {}
              reject(err);
            });

            req.setTimeout(30000, () => {
              req.destroy(new Error('Download request timeout'));
            });
          };

          request(targetUrl);
        });

        if (fs.existsSync(dest) && fs.statSync(dest).size > 1024 * 1024) {
          return;
        }
      } catch (err) {
        console.warn(`[FFmpeg] Mirror failed (${targetUrl}):`, err.message);
        lastError = err;
      }
    }

    throw lastError || new Error('FFmpeg download failed from all mirrors');
  };
  
  try {
    console.log(`[FFmpeg] Downloading FFmpeg...`);
    await downloadHelper(ffmpegMirrors, ffmpegZip, 0, 45);
    
    console.log(`[FFmpeg] Downloading FFprobe...`);
    await downloadHelper(ffprobeMirrors, ffprobeZip, 45, 90);
    
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

// Seçilen veya aktif çerezlerin geçerliliğini test eden fonksiyon
export function testCookiesValidity(browser) {
  return new Promise((resolve) => {
    const db = readDb();
    const settings = { ...db.settings, ...(browser ? { browser } : {}) };
    const cookieArgs = getCookieArgs(settings);

    if (cookieArgs.length === 0) {
      return resolve({ success: true, message: 'Aktif bir çerez kaynağı bulunmuyor (Anonim mod).' });
    }

    const args = [
      ...cookieArgs,
      '--simulate',
      '--js-runtimes', `node:${process.execPath}`,
      'ytsearch1:test cookie liveness'
    ];
    
    console.log(`[Çerez Testi] yt-dlp çerez testi başlatılıyor (${cookieArgs.join(' ')})`);
    const proc = spawnYtdlp(args);
    let errorOutput = '';
    
    proc.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });
    
    const timer = setTimeout(() => {
      proc.kill();
      resolve({ success: false, error: 'Zaman aşımı: Çerez veritabanı kilitli veya yanıt vermiyor.' });
    }, 10000);
    
    proc.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0) {
        let srcName = cookieArgs[0] === '--cookies' ? 'cookies.txt dosyası' : cookieArgs[1];
        resolve({ success: true, message: `Çerezler başarıyla okundu ve YouTube tarafından doğrulandı (${srcName}).` });
      } else {
        let userFriendlyError = errorOutput.trim();
        if (userFriendlyError.includes('Could not copy Chrome cookie database') || userFriendlyError.includes('Could not copy Edge cookie database')) {
          userFriendlyError = 'Tarayıcı çerez veritabanı kilitli! Tarayıcınız açık olabilir, lütfen kapatıp tekrar deneyin veya HaYTooL dahili oturumunu kullanın.';
        } else if (userFriendlyError.includes('Could not find browser')) {
          userFriendlyError = `Belirtilen tarayıcı bulunamadı veya profil dizini eksik: ${browser ? browser.toUpperCase() : ''}`;
        } else {
          userFriendlyError = `Çerez doğrulama uyarısı (Kod: ${code}): ${userFriendlyError.slice(0, 150)}`;
        }
        resolve({ success: false, error: userFriendlyError });
      }
    });
  });
}

function getLocalFfmpegInfo() {
  const isWin = os.platform() === 'win32';
  const ext = isWin ? '.exe' : '';
  const rootDir = path.resolve(process.cwd());
  const pathInSubfolder = path.join(rootDir, 'ffmpeg', `ffmpeg${ext}`);
  const pathInRoot = path.join(rootDir, `ffmpeg${ext}`);

  let targetPath = null;

  if (fs.existsSync(pathInSubfolder)) {
    targetPath = pathInSubfolder;
  } else if (fs.existsSync(pathInRoot)) {
    targetPath = pathInRoot;
  }

  if (!targetPath) {
    return { installed: false, version: null };
  }

  try {
    const output = execFileSync(targetPath, ['-version'], { encoding: 'utf-8', timeout: 5000 });
    const match = output.match(/ffmpeg version ([^\s]+)/i);
    const ver = match ? match[1] : '6.1';
    return { installed: true, version: ver };
  } catch (e) {
    return { installed: false, version: null };
  }
}

router.get('/ffmpeg/status', (req, res) => {
  const info = getLocalFfmpegInfo();
  res.json({
    installed: info.installed,
    localVersion: info.version,
    remoteVersion: 'v6.1',
    status: ffmpegDownloadState.status,
    progress: ffmpegDownloadState.progress,
    error: ffmpegDownloadState.error
  });
});

router.post('/ffmpeg/download', localhostOnly, (req, res) => {
  downloadFfmpegAsync();
  res.json({ success: true });
});

router.post('/settings/toggle-alt-speed', localhostOnly, (req, res) => {
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

router.post('/settings/toggle-discord-rpc', localhostOnly, (req, res) => {
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

/**
 * Uygulamanın kurulu olduğu veya indirme dizininin bulunduğu disk alanının (boş alan, toplam alan, klasör boyutu) bilgilerini sorgular.
 * 
 * @name GET /api/disk-space
 * @function
 * @inner
 * @param {object} req - Express istek nesnesi
 * @param {object} res - Express yanıt nesnesi
 * @returns {void}
 */
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

/**
 * backup/ dizinindeki yedekleri denetler.
 * En son 7 takvim gününün her birinden 1 adet yedeği "Günlük Korunan" (Daily Protected - maks 7 gün) olarak saklar.
 * Bunun haricindeki normal/dönerli yedek sayısı 10'u aştığında en eskileri temizler.
 * Böylece klasörde en fazla 10 Normal + 7 Günlük Korunan = Toplam 17 Yedek barındırılır.
 */
function cleanupOldBackups(backupsDir, maxRegular = 10, maxDailyProtectedDays = 7) {
  if (!fs.existsSync(backupsDir)) return;
  const files = fs.readdirSync(backupsDir);
  const backupFiles = files.filter(f => f.startsWith('manual_backup_') || f.startsWith('auto_backup_') || f.startsWith('daily_backup_'));

  if (backupFiles.length === 0) return;

  const items = backupFiles.map(filename => {
    const fullPath = path.join(backupsDir, filename);
    const stats = fs.statSync(fullPath);
    const mtime = stats.mtime;
    const dateKey = mtime.toISOString().split('T')[0];
    return {
      filename,
      fullPath,
      size: stats.size,
      mtime: mtime.getTime(),
      dateKey,
      isDailyProtected: false
    };
  }).sort((a, b) => a.mtime - b.mtime); // Eskiden yeniye

  // Günlere göre grupla
  const dayGroups = {};
  items.forEach(item => {
    if (!dayGroups[item.dateKey]) dayGroups[item.dateKey] = [];
    dayGroups[item.dateKey].push(item);
  });

  // En son 7 güne ait günlerin ilk yedeğini korumaya al (En fazla 7 Günlük Korunan)
  const sortedDays = Object.keys(dayGroups).sort();
  const protectedDays = new Set(sortedDays.slice(-maxDailyProtectedDays));

  protectedDays.forEach(day => {
    if (dayGroups[day] && dayGroups[day].length > 0) {
      dayGroups[day][0].isDailyProtected = true;
    }
  });

  // Korumalı olmayan normal yedekleri ayır
  const nonProtectedItems = items.filter(item => !item.isDailyProtected);

  // Normal yedek sayısı 10'u aşarsa en eskilerini sil
  if (nonProtectedItems.length > maxRegular) {
    let excessCount = nonProtectedItems.length - maxRegular;
    for (const item of nonProtectedItems) {
      if (excessCount <= 0) break;
      try {
        if (fs.existsSync(item.fullPath)) {
          fs.unlinkSync(item.fullPath);
          console.log(`[Yedek Temizliği] Dönerli yedek sınırı (max ${maxRegular}) aşıldı, silindi: ${item.filename}`);
          excessCount--;
        }
      } catch (e) {
        console.error(`[Yedek Temizliği Hatası]: ${item.filename} silinemedi:`, e.message);
      }
    }
  }
}

/**
 * Sunucu başlatıldığında veya periyodik kontrolde bugüne ait otomatik sistem yedeği yoksa otomatik ZIP yedeği alır.
 */
export function ensureDailySystemBackup() {
  try {
    const backupsDir = path.resolve(process.cwd(), 'backup');
    if (!fs.existsSync(backupsDir)) {
      fs.mkdirSync(backupsDir, { recursive: true });
    }

    const todayStr = new Date().toISOString().split('T')[0];
    const files = fs.readdirSync(backupsDir);
    const backupFiles = files.filter(f => f.startsWith('manual_backup_') || f.startsWith('auto_backup_') || f.startsWith('daily_backup_'));

    // Bugün oluşturulmuş herhangi bir yedek var mı?
    const hasTodayBackup = backupFiles.some(filename => {
      const fullPath = path.join(backupsDir, filename);
      const mtime = fs.statSync(fullPath).mtime;
      return mtime.toISOString().split('T')[0] === todayStr;
    });

    if (!hasTodayBackup) {
      const rootDir = path.resolve(process.cwd());
      const dbFilePath = path.join(rootDir, 'db.json');
      const channelsIniFilePath = path.join(rootDir, 'channels.ini');
      const catIniFilePath = path.join(rootDir, 'categories.ini');
      const configWinPath = path.join(rootDir, 'configwin.ini');
      const configUnixPath = path.join(rootDir, 'configunix.ini');
      const configPath = fs.existsSync(configWinPath) ? configWinPath : configUnixPath;

      const currentDb = readDb();
      const dbSanitized = JSON.parse(JSON.stringify(currentDb));
      if (dbSanitized.settings) {
        delete dbSanitized.settings.githubToken;
      }
      const dbJsonContent = JSON.stringify(dbSanitized, null, 2).replace(/[\u200E\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/g, '');

      const channelsIniContent = fs.existsSync(channelsIniFilePath) ? fs.readFileSync(channelsIniFilePath, 'utf8') : '';
      const categoriesIniContent = fs.existsSync(catIniFilePath) ? fs.readFileSync(catIniFilePath, 'utf8') : '';
      const configIniContent = fs.existsSync(configPath) ? fs.readFileSync(configPath, 'utf8') : '';
      const configFileName = path.basename(configPath);

      const zipFiles = [
        { name: 'db.json', content: dbJsonContent },
        { name: 'channels.ini', content: channelsIniContent },
        { name: 'categories.ini', content: categoriesIniContent },
        { name: configFileName, content: configIniContent }
      ];

      const compressedBuffer = createZipArchive(zipFiles);
      const backupFilename = `auto_backup_${formatBackupDateStr()}.zip`;
      const backupFilePath = path.join(backupsDir, backupFilename);
      fs.writeFileSync(backupFilePath, compressedBuffer);

      cleanupOldBackups(backupsDir, 10, 7);
      console.log(`[Otomatik Günlük Sistem Yedeği] Bugüne ait ilk otomatik yedek alındı: ${backupFilename}`);
    }
  } catch (err) {
    console.error('[Otomatik Günlük Yedek Hatası]:', err.message);
  }
}

function crc32(buf) {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xEDB88320 : 0);
    }
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

/**
 * Saf Node.js zlib kullanarak ayrı ayrı dosyaları kapsayan standart bir ZIP arşivi üretir.
 */
function createZipArchive(files) {
  const localHeaders = [];
  const centralHeaders = [];
  let offset = 0;

  files.forEach(file => {
    const nameBuf = Buffer.from(file.name, 'utf8');
    const contentBuf = Buffer.isBuffer(file.content) ? file.content : Buffer.from(file.content, 'utf8');
    const compressedBuf = zlib.deflateRawSync(contentBuf);
    const crc = crc32(contentBuf);

    const lHeader = Buffer.alloc(30 + nameBuf.length);
    lHeader.writeUInt32LE(0x04034b50, 0);
    lHeader.writeUInt16LE(20, 4);
    lHeader.writeUInt16LE(0, 6);
    lHeader.writeUInt16LE(8, 8);
    lHeader.writeUInt16LE(0, 10);
    lHeader.writeUInt32LE(crc, 14);
    lHeader.writeUInt32LE(compressedBuf.length, 18);
    lHeader.writeUInt32LE(contentBuf.length, 22);
    lHeader.writeUInt16LE(nameBuf.length, 26);
    lHeader.writeUInt16LE(0, 28);
    nameBuf.copy(lHeader, 30);

    const cHeader = Buffer.alloc(46 + nameBuf.length);
    cHeader.writeUInt32LE(0x02014b50, 0);
    cHeader.writeUInt16LE(20, 4);
    cHeader.writeUInt16LE(20, 6);
    cHeader.writeUInt16LE(0, 8);
    cHeader.writeUInt16LE(8, 10);
    cHeader.writeUInt16LE(0, 12);
    cHeader.writeUInt32LE(crc, 16);
    cHeader.writeUInt32LE(compressedBuf.length, 20);
    cHeader.writeUInt32LE(contentBuf.length, 24);
    cHeader.writeUInt16LE(nameBuf.length, 28);
    cHeader.writeUInt16LE(0, 30);
    cHeader.writeUInt16LE(0, 32);
    cHeader.writeUInt16LE(0, 34);
    cHeader.writeUInt32LE(0, 36);
    cHeader.writeUInt32LE(offset, 42);
    nameBuf.copy(cHeader, 46);

    localHeaders.push(lHeader, compressedBuf);
    centralHeaders.push(cHeader);

    offset += lHeader.length + compressedBuf.length;
  });

  const centralStart = offset;
  const centralBuf = Buffer.concat(centralHeaders);

  const endRecord = Buffer.alloc(22);
  endRecord.writeUInt32LE(0x06054b50, 0);
  endRecord.writeUInt16LE(0, 4);
  endRecord.writeUInt16LE(0, 6);
  endRecord.writeUInt16LE(files.length, 8);
  endRecord.writeUInt16LE(files.length, 10);
  endRecord.writeUInt32LE(centralBuf.length, 12);
  endRecord.writeUInt32LE(centralStart, 16);
  endRecord.writeUInt16LE(0, 20);

  return Buffer.concat([...localHeaders, centralBuf, endRecord]);
}

/**
 * Saf Node.js zlib kullanarak ZIP arşivinden ayrı ayrı dosyaları çıkarır.
 */
function parseZipArchive(buf) {
  const files = {};
  let pos = 0;
  while (pos < buf.length - 30) {
    const sig = buf.readUInt32LE(pos);
    if (sig !== 0x04034b50) break;

    const compMethod = buf.readUInt16LE(pos + 8);
    const compSize = buf.readUInt32LE(pos + 18);
    const uncompSize = buf.readUInt32LE(pos + 22);
    const nameLen = buf.readUInt16LE(pos + 26);
    const extraLen = buf.readUInt16LE(pos + 28);

    const filename = buf.toString('utf8', pos + 30, pos + 30 + nameLen);
    const dataStart = pos + 30 + nameLen + extraLen;
    const compData = buf.subarray(dataStart, dataStart + compSize);

    let contentBuf;
    if (compMethod === 8) {
      contentBuf = zlib.inflateRawSync(compData);
    } else {
      contentBuf = compData;
    }

    files[filename] = contentBuf.toString('utf8');
    pos = dataStart + compSize;
  }
  return files;
}

/**
 * Sıkıştırılmış (.zip, .json.gz) veya düz JSON biçimindeki yedek arabelleğini okur ve ayrı ayrı dosyalarına ayrıştırır.
 */
function parseBackupBuffer(buffer, filename = '') {
  // ZIP formatı tespiti (PK\x03\x04 signature)
  if (filename.endsWith('.zip') || (buffer[0] === 0x50 && buffer[1] === 0x4b && buffer[2] === 0x03 && buffer[3] === 0x04)) {
    const zipFiles = parseZipArchive(buffer);
    const res = {};
    if (zipFiles['db.json']) {
      try { res.db = JSON.parse(zipFiles['db.json']); } catch (e) {}
    }
    if (zipFiles['channels.ini']) res.channelsIni = zipFiles['channels.ini'];
    if (zipFiles['categories.ini']) res.categoriesIni = zipFiles['categories.ini'];
    
    const configKey = Object.keys(zipFiles).find(k => k.startsWith('config'));
    if (configKey) {
      res.configIni = zipFiles[configKey];
      res.configIniName = configKey;
    }
    return res;
  }
  
  // GZIP formatı tespiti (.json.gz)
  if (filename.endsWith('.gz') || (buffer[0] === 0x1f && buffer[1] === 0x8b)) {
    const decompressed = zlib.gunzipSync(buffer).toString('utf8');
    return JSON.parse(decompressed);
  }
  
  // Düz JSON formatı
  return JSON.parse(buffer.toString('utf8'));
}

/**
 * Oluşturulmuş olan tüm manuel ve otomatik sistem yedek paketlerini (backup/*.zip, .json.gz veya .json) listeler.
 * 
 * @name GET /api/settings/backups
 * @function
 * @inner
 * @param {object} req - Express istek nesnesi
 * @param {object} res - Express yanıt nesnesi
 * @returns {void}
 */
router.get('/backups', localhostOnly, (req, res) => {
  const backupsDir = path.resolve(process.cwd(), 'backup');
  try {
    if (!fs.existsSync(backupsDir)) {
      return res.json({ success: true, backups: [] });
    }
    
    // Temizlik ve rotasyonu çalıştır
    cleanupOldBackups(backupsDir, 10, 7);

    const files = fs.readdirSync(backupsDir);
    const backupFiles = files.filter(f => f.startsWith('manual_backup_') || f.startsWith('auto_backup_') || f.startsWith('daily_backup_'));

    const items = backupFiles.map(filename => {
      const fullPath = path.join(backupsDir, filename);
      const stats = fs.statSync(fullPath);
      const mtime = stats.mtime;
      const dateKey = mtime.toISOString().split('T')[0];
      return {
        filename,
        fullPath,
        sizeBytes: stats.size,
        size: stats.size < 1024 * 1024 
          ? (stats.size / 1024).toFixed(1) + ' KB' 
          : (stats.size / (1024 * 1024)).toFixed(2) + ' MB',
        mtime: mtime.getTime(),
        dateKey,
        createdAt: mtime.toISOString(),
        isAuto: filename.startsWith('auto_') || filename.startsWith('daily_')
      };
    }).sort((a, b) => a.mtime - b.mtime);

    // Günlük korumalı olanları tespit et
    const dailyProtectedMap = new Set();
    for (const item of items) {
      if (!dailyProtectedMap.has(item.dateKey)) {
        dailyProtectedMap.add(item.dateKey);
        item.isDailyProtected = true;
      } else {
        item.isDailyProtected = false;
      }
    }

    // Yeniden eskiye doğru sıralayıp yanıt dön
    const backups = items
      .sort((a, b) => b.mtime - a.mtime)
      .map(({ filename, size, createdAt, isDailyProtected, isAuto }) => ({
        filename,
        size,
        createdAt,
        isDailyProtected,
        isAuto
      }));
      
    res.json({ success: true, backups });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * db.json, channels.ini, categories.ini ve config ini dosyalarını ayrı ayrı dosyalar halinde ZIP arşiviyle sıkıştırarak backup/ klasörüne manuel kaydeder.
 * 
 * @name POST /api/settings/backup
 * @function
 * @inner
 * @param {object} req - Express istek nesnesi
 * @param {object} res - Express yanıt nesnesi
 * @returns {void}
 */
router.post('/backup', localhostOnly, (req, res) => {
  try {
    const rootDir = path.resolve(process.cwd());
    const dbFilePath = path.join(rootDir, 'db.json');
    const channelsIniFilePath = path.join(rootDir, 'channels.ini');
    const catIniFilePath = path.join(rootDir, 'categories.ini');
    
    const configWinPath = path.join(rootDir, 'configwin.ini');
    const configUnixPath = path.join(rootDir, 'configunix.ini');
    const configPath = fs.existsSync(configWinPath) ? configWinPath : configUnixPath;
    
    const currentDb = readDb();
    const dbSanitized = JSON.parse(JSON.stringify(currentDb));
    if (dbSanitized.settings) {
      delete dbSanitized.settings.githubToken;
    }
    const dbJsonContent = JSON.stringify(dbSanitized, null, 2).replace(/[\u200E\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/g, '');

    const channelsIniContent = fs.existsSync(channelsIniFilePath) ? fs.readFileSync(channelsIniFilePath, 'utf8') : '';
    const categoriesIniContent = fs.existsSync(catIniFilePath) ? fs.readFileSync(catIniFilePath, 'utf8') : '';
    const configIniContent = fs.existsSync(configPath) ? fs.readFileSync(configPath, 'utf8') : '';
    const configFileName = path.basename(configPath);
    
    // Ayrı ayrı bağımsız dosyaları kapsayan ZIP arşiv paketini oluştur
    const zipFiles = [
      { name: 'db.json', content: dbJsonContent },
      { name: 'channels.ini', content: channelsIniContent },
      { name: 'categories.ini', content: categoriesIniContent },
      { name: configFileName, content: configIniContent }
    ];

    const compressedBuffer = createZipArchive(zipFiles);
    
    const backupsDir = path.resolve(process.cwd(), 'backup');
    if (!fs.existsSync(backupsDir)) {
      fs.mkdirSync(backupsDir, { recursive: true });
    }
    
    const backupFilename = `manual_backup_${formatBackupDateStr()}.zip`;
    const backupFilePath = path.join(backupsDir, backupFilename);
    
    fs.writeFileSync(backupFilePath, compressedBuffer);
    
    // Rotasyonu çalıştır (Max 10 regular + 7 daily protected)
    cleanupOldBackups(backupsDir, 10, 7);

    const sizeFormatted = compressedBuffer.length < 1024 * 1024 
      ? (compressedBuffer.length / 1024).toFixed(1) + ' KB' 
      : (compressedBuffer.length / (1024 * 1024)).toFixed(2) + ' MB';
    
    addTerminalLog(`[Sistem] Ayrı dosyalı Manuel ZIP yedek oluşturuldu: ${backupFilename} (${sizeFormatted})`, 'success');
    res.json({ success: true, message: 'ZIP manuel yedek arşivi başarıyla oluşturuldu.', filename: backupFilename, size: sizeFormatted });
  } catch (err) {
    console.error('[Backup Error]:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * Belirtilen yedek paketini (JSON veya JSON.GZ) okuyarak sistem veritabanını, kanalları, kategorileri ve yapılandırmaları geri yükler.
 * 
 * @name POST /api/settings/restore
 * @function
 * @inner
 * @param {object} req - Express istek nesnesi
 * @param {string} req.body.filename - Geri yüklenecek yedek dosyasının adı
 * @param {object} res - Express yanıt nesnesi
 * @returns {Promise<void>}
 */
router.post('/restore', localhostOnly, async (req, res) => {
  const { filename } = req.body;
  if (!filename) return res.status(400).json({ error: 'filename parametresi gereklidir.' });
  
  const backupsDir = path.resolve(process.cwd(), 'backup');
  const backupFilePath = path.join(backupsDir, filename);
  
  if (!fs.existsSync(backupFilePath)) {
    return res.status(404).json({ error: 'Yedek dosyası bulunamadı.' });
  }
  
  try {
    const rawBuffer = fs.readFileSync(backupFilePath);
    const backupContent = parseBackupBuffer(rawBuffer, filename);
    const rootDir = path.resolve(process.cwd());
    
    if (backupContent.db) {
      const dbFilePath = path.join(rootDir, 'db.json');
      fs.writeFileSync(dbFilePath, JSON.stringify(backupContent.db, null, 2), 'utf8');
    }
    
    if (backupContent.channelsIni) {
      const channelsIniFilePath = path.join(rootDir, 'channels.ini');
      fs.writeFileSync(channelsIniFilePath, backupContent.channelsIni, 'utf8');
    }
    
    const catIniFilePath = path.join(rootDir, 'categories.ini');
    if (backupContent.categoriesIni) {
      fs.writeFileSync(catIniFilePath, backupContent.categoriesIni, 'utf8');
    } else if (backupContent.db && backupContent.db.categories) {
      saveCategoriesToIni(backupContent.db);
    }
    
    if (backupContent.configIni) {
      const configIniName = backupContent.configIniName || (os.platform() === 'win32' ? 'configwin.ini' : 'configunix.ini');
      const configPath = path.join(rootDir, configIniName);
      fs.writeFileSync(configPath, backupContent.configIni, 'utf8');
    }
    
    syncDbWithDisk();
    
    addTerminalLog(`[Sistem] Yedek başarıyla geri yüklendi: ${filename}`, 'success');
    res.json({ success: true, message: 'Yedek başarıyla geri yüklendi. Sunucu verileri ve kategoriler güncellendi.' });
  } catch (err) {
    console.error('[Restore Error]:', err.message);
    res.status(500).json({ error: 'Yedek geri yüklenirken hata oluştu: ' + err.message });
  }
});

/**
 * Kullanıcının yüklediği ham yedek dosyasını (Base64 veya metin) geri yükler.
 * 
 * @name POST /api/settings/restore-upload
 * @function
 * @inner
 * @param {object} req - Express istek nesnesi
 * @param {string} req.body.fileData - Base64 veya Metin formatında dosya içeriği
 * @param {string} req.body.filename - Orijinal dosya adı
 * @param {object} res - Express yanıt nesnesi
 * @returns {Promise<void>}
 */
router.post('/restore-upload', localhostOnly, async (req, res) => {
  const { fileData, filename } = req.body;
  if (!fileData) return res.status(400).json({ error: 'Yedek dosya verisi gereklidir.' });

  try {
    let buffer;
    if (fileData.startsWith('data:') && fileData.includes(';base64,')) {
      const base64Str = fileData.split(';base64,')[1];
      buffer = Buffer.from(base64Str, 'base64');
    } else {
      buffer = Buffer.from(fileData, 'utf8');
    }

    const backupContent = parseBackupBuffer(buffer, filename || 'uploaded_backup.json');
    const rootDir = path.resolve(process.cwd());

    if (backupContent.db) {
      const dbFilePath = path.join(rootDir, 'db.json');
      fs.writeFileSync(dbFilePath, JSON.stringify(backupContent.db, null, 2), 'utf8');
    }

    if (backupContent.channelsIni) {
      const channelsIniFilePath = path.join(rootDir, 'channels.ini');
      fs.writeFileSync(channelsIniFilePath, backupContent.channelsIni, 'utf8');
    }

    const catIniFilePath = path.join(rootDir, 'categories.ini');
    if (backupContent.categoriesIni) {
      fs.writeFileSync(catIniFilePath, backupContent.categoriesIni, 'utf8');
    } else if (backupContent.db && backupContent.db.categories) {
      saveCategoriesToIni(backupContent.db);
    }

    if (backupContent.configIni) {
      const configIniName = backupContent.configIniName || (os.platform() === 'win32' ? 'configwin.ini' : 'configunix.ini');
      const configPath = path.join(rootDir, configIniName);
      fs.writeFileSync(configPath, backupContent.configIni, 'utf8');
    }

    syncDbWithDisk();

    addTerminalLog(`[Sistem] Karşıdan yüklenen yedek başarıyla sisteme aktarıldı.`, 'success');
    res.json({ success: true, message: 'Yüklenen yedek başarıyla sisteme aktarıldı ve geri yüklendi.' });
  } catch (err) {
    console.error('[Upload Restore Error]:', err.message);
    res.status(500).json({ error: 'Yüklenen yedek dosyası geçersiz veya bozuk: ' + err.message });
  }
});

/**
 * backup/ dizininden belirli bir yedek dosyasını siler.
 * 
 * @name DELETE /api/settings/backup/:filename
 * @function
 * @inner
 */
router.delete('/backup/:filename', localhostOnly, (req, res) => {
  const { filename } = req.params;
  const backupsDir = path.resolve(process.cwd(), 'backup');
  const backupFilePath = path.join(backupsDir, filename);

  if (!fs.existsSync(backupFilePath)) {
    return res.status(404).json({ error: 'Yedek dosyası bulunamadı.' });
  }

  try {
    fs.unlinkSync(backupFilePath);
    addTerminalLog(`[Sistem] Manuel yedek silindi: ${filename}`, 'warning');
    res.json({ success: true, message: 'Yedek dosyası silindi.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * backup/ dizininden belirli bir yedek dosyasını indirmek üzere sunar.
 * 
 * @name GET /api/settings/backup/download/:filename
 * @function
 * @inner
 */
router.get('/backup/download/:filename', localhostOnly, (req, res) => {
  const { filename } = req.params;
  const backupsDir = path.resolve(process.cwd(), 'backup');
  const backupFilePath = path.join(backupsDir, filename);

  if (!fs.existsSync(backupFilePath)) {
    return res.status(404).json({ error: 'Yedek dosyası bulunamadı.' });
  }

  res.download(backupFilePath, filename);
});

/**
 * Aktif geçici dosyalar (Temp) klasörünü işletim sistemi dosya gezgininde açar.
 * 
 * @name POST /api/settings/open-temp
 * @function
 * @inner
 * @param {object} req - Express istek nesnesi
 * @param {object} res - Express yanıt nesnesi
 * @returns {void}
 */
router.post('/settings/open-temp', localhostOnly, (req, res) => {
  try {
    const tempDir = getLocalTempDir();
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    if (process.platform === 'win32') {
      const resolvedFolder = path.resolve(tempDir);
      exec(`explorer.exe "${resolvedFolder}"`);
      const folderName = path.basename(resolvedFolder);
      const folderNameSafe = folderName.replace(/'/g, "''");
      setTimeout(() => {
        exec(`powershell -Command "(New-Object -ComObject wscript.shell).AppActivate('${folderNameSafe}')"`, (err) => {});
      }, 500);
    } else if (process.platform === 'darwin') {
      open(tempDir);
    } else {
      exec(`xdg-open "${path.resolve(tempDir)}"`);
    }
    res.json({ success: true });
  } catch (err) {
    console.error('[Temp Open Error]:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * Sistem python'ının pip paket yöneticisini kullanarak yt-dlp paketini kurar veya günceller.
 * 
 * @name POST /api/settings/install-python-dep
 * @function
 * @inner
 * @param {object} req - Express istek nesnesi
 * @param {object} res - Express yanıt nesnesi
 * @returns {void}
 */
router.post('/settings/install-python-dep', localhostOnly, (req, res) => {
  const db = readDb();
  const pythonCmd = db.settings?.pythonCmd || 'python';
  
  addTerminalLog(`[Sistem] Python bağımlılığı (yt-dlp) kurulumu başlatılıyor: "${pythonCmd} -m pip install -U yt-dlp"`, 'info');
  
  exec(`"${pythonCmd}" -m pip install -U yt-dlp`, (error, stdout, stderr) => {
    if (error) {
      console.error('[pip install error]:', error.message);
      addTerminalLog(`[Sistem] Bağımlılık kurulumu başarısız: ${error.message}`, 'error');
      return res.status(500).json({ success: false, error: error.message });
    }
    
    console.log('[pip install success]:', stdout);
    addTerminalLog(`[Sistem] Bağımlılık kurulumu/güncellemesi başarıyla tamamlandı.`, 'success');
    res.json({ success: true, output: stdout });
  });
});

/**
 * Disk senkronizasyonunu manuel olarak hemen tetikler.
 * 
 * @name POST /api/settings/sync-disk
 * @function
 * @inner
 */
router.post('/settings/sync-disk', localhostOnly, async (req, res) => {
  try {
    const result = await syncDbWithDisk(true);
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
