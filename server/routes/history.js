// Türkçe Açıklama: Kütüphane, video geçmişi, dosya karşılaştırma, konum açma, video silme ve gizleme API rotaları modülü.
import express from 'express';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import open from 'open';
import { exec } from 'child_process';
import { 
  readDb, 
  writeDb, 
  writeDbFast,
  acquireDbLock, 
  updateHistoryItem 
} from '../database.js';
import { localhostOnly } from '../middleware/security.js';
import { downloadQueue, getCookieArgs } from '../services/downloader.js';
import { ytdlpPath, getFfmpegPath, spawnYtdlp } from '../services/paths.js';
import { resolveMissingDurations, fetchVideoDuration, checkSingleChannelRss, triggerChannelCheck, fetchDurationViaYtdlp } from '../services/rss.js';
import { broadcast, addTerminalLog } from '../services/sse.js';
import { triggerSilentCookieRefresh } from './settings.js';
import { updateChannelFullInfo } from './channels.js';

export const router = express.Router();

/**
 * Belirtilen videonun izleme süresini YouTube hesabına senkronize eder.
 * 
 * @param {string} id - YouTube Video ID
 * @param {number} currentTime - O anki izleme süresi (saniye cinsinden)
 * @param {string} [title] - Video Başlığı
 * @returns {Promise<object>} İşlem sonucu
 */
export async function syncVideoWatchtimeToYouTube(id, currentTime, title = '', options = {}) {
  try {
    if (!id || typeof currentTime !== 'number' || isNaN(currentTime) || currentTime < 0) {
      return { success: false, error: 'Geçersiz parametreler.' };
    }

    // Türkçe Açıklama: Hem kök hem bin/ çerez dosyalarını okuyup tek nesnede birleştirir.
    // Kök "cookies.txt" (yt-dlp) genelde SAPISID/SID/LOGIN_INFO/HSID gibi tam oturum
    // çerezlerini İÇERMEZ; "bin/cookies.txt" (Native Bridge) tam oturumu tutar. Eksik
    // kimlik doğrulaması YouTube'un izleme süresini sessizce düşürmesine (HTTP 204'e rağmen)
    // neden olur. Bu yüzden iki dosyayı birleştirip eksiksiz çerez seti kullanıyoruz.
    const rootCookiesTxt = path.resolve(process.cwd(), 'cookies.txt');
    const binCookiesTxt = path.resolve(process.cwd(), 'bin', 'cookies.txt');
    const cookiesObj = {};
    // 1. Önce root sonra bin cookies oku ve birleştir
    for (const cookieFile of [rootCookiesTxt, binCookiesTxt]) {
      if (!fs.existsSync(cookieFile)) continue;
      const cookieContent = fs.readFileSync(cookieFile, 'utf8');
      for (const line of cookieContent.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const parts = trimmed.split('\t');
        if (parts.length >= 7) {
          cookiesObj[parts[5]] = parts[6];
        }
      }
    }

    if (Object.keys(cookiesObj).length === 0) {
      const warnMsg = `[İzleme Senkronu UYARI] YouTube oturum çerezi bulunamadığı için "${title || id}" süresi eşitlenemedi.`;
      addTerminalLog(warnMsg, 'warning');
      triggerSilentCookieRefresh();
      return { success: false, error: 'YouTube oturum çerezi bulunamadı.' };
    }

    // bin/cookies.txt içinde SAPISID veya LOGIN_INFO varsa fakat root cookies.txt'te yoksa, bin dosyasını root'a kopyala
    if (fs.existsSync(binCookiesTxt) && (!fs.existsSync(rootCookiesTxt) || !fs.readFileSync(rootCookiesTxt, 'utf8').includes('SAPISID'))) {
      try { fs.copyFileSync(binCookiesTxt, rootCookiesTxt); } catch (e) {}
    }

    const cookieHeader = Object.entries(cookiesObj).map(([k, v]) => `${k}=${v}`).join('; ');
    const sapisid = cookiesObj['SAPISID'] || cookiesObj['__Secure-1PAPISID'] || cookiesObj['__Secure-3PAPISID'] || '';
    
    const now = Date.now();
    let authHeader = '';
    if (sapisid) {
      const origin = 'https://www.youtube.com';
      const hashStr = `${Math.floor(now / 1000)} ${sapisid} ${origin}`;
      const sha1 = crypto.createHash('sha1').update(hashStr).digest('hex');
      authHeader = `SAPISIDHASH ${Math.floor(now / 1000)}_${sha1}`;
    }

    const playerHeaders = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Cookie': cookieHeader,
      'Content-Type': 'application/json',
      'Origin': 'https://www.youtube.com',
      'Referer': `https://www.youtube.com/watch?v=${id}`,
      'X-YouTube-Client-Name': '1',
      'X-YouTube-Client-Version': '2.20240501.00.00'
    };
    if (authHeader) {
      playerHeaders['Authorization'] = authHeader;
    }

    // 1. YouTube InnerTube Player API'den videoya özel playbackTracking endpoint'lerini al
    const playerBody = {
      context: {
        client: {
          hl: 'tr',
          gl: 'TR',
          clientName: 'WEB',
          clientVersion: '2.20240501.00.00',
          userAgent: playerHeaders['User-Agent']
        }
      },
      videoId: id,
      playbackContext: {
        contentPlaybackContext: {
          html5Preference: 'HTML5_PREF_WANTS'
        }
      }
    };

    let tracking = {};
    try {
      const playerRes = await fetch('https://www.youtube.com/youtubei/v1/player', {
        method: 'POST',
        headers: playerHeaders,
        body: JSON.stringify(playerBody)
      });
      const playerData = await playerRes.json();
      if (playerData && playerData.playbackTracking) {
        tracking = playerData.playbackTracking;
      }
    } catch (e) {
      console.warn('[YouTube Watchtime Sync] Player config çekilemedi:', e.message);
    }

    const CPN_ALPHABET = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_';
    let cpn = '';
    for (let i = 0; i < 16; i++) {
      cpn += CPN_ALPHABET[Math.floor(Math.random() * CPN_ALPHABET.length)];
    }

    const pingHeaders = {
      'User-Agent': playerHeaders['User-Agent'],
      'Cookie': cookieHeader,
      'Origin': 'https://www.youtube.com',
      'Referer': `https://www.youtube.com/watch?v=${id}`,
      'Accept': '*/*'
    };
    if (authHeader) {
      pingHeaders['Authorization'] = authHeader;
    }

    const cmt = currentTime.toFixed(3);
    const rt = Math.floor(currentTime).toString();

    // 2. ATR (Activity Tracking Record - YouTube İzleme Geçmişine Kaydeden Asıl İstek)
    if (tracking.atrUrl?.baseUrl) {
      try {
        const u = new URL(tracking.atrUrl.baseUrl);
        u.searchParams.set('cpn', cpn);
        u.searchParams.set('cmt', cmt);
        u.searchParams.set('st', '0.000');
        u.searchParams.set('et', cmt);
        await fetch(u.toString(), { headers: pingHeaders });
      } catch (e) {}
    }

    // 3. Playback ping
    if (tracking.videostatsPlaybackUrl?.baseUrl) {
      try {
        const u = new URL(tracking.videostatsPlaybackUrl.baseUrl);
        u.searchParams.set('ver', '2');
        u.searchParams.set('cpn', cpn);
        u.searchParams.set('el', 'detailpage');
        u.searchParams.set('cmt', '0.000');
        u.searchParams.set('st', '0.000');
        u.searchParams.set('et', '0.000');
        await fetch(u.toString(), { headers: pingHeaders });
      } catch (e) {}
    }

    // 4. Ptracking ping
    if (tracking.ptrackingUrl?.baseUrl) {
      try {
        const u = new URL(tracking.ptrackingUrl.baseUrl);
        u.searchParams.set('cpn', cpn);
        await fetch(u.toString(), { headers: pingHeaders });
      } catch (e) {}
    }

    // 5. Watchtime ping gönder (hedef currentTime)
    const finalWatchUrl = tracking.videostatsWatchtimeUrl?.baseUrl 
      ? new URL(tracking.videostatsWatchtimeUrl.baseUrl) 
      : new URL('https://www.youtube.com/api/stats/watchtime');
    
    finalWatchUrl.searchParams.set('ns', 'yt');
    finalWatchUrl.searchParams.set('el', 'detailpage');
    finalWatchUrl.searchParams.set('cpn', cpn);
    finalWatchUrl.searchParams.set('docid', id);
    finalWatchUrl.searchParams.set('ver', '2');
    finalWatchUrl.searchParams.set('cmt', cmt);
    finalWatchUrl.searchParams.set('fmt', '251');
    finalWatchUrl.searchParams.set('fs', '0');
    finalWatchUrl.searchParams.set('rt', rt);
    // "İzlendi" işareti için playing state kullanılır; normal izleme senkronunda paused kalır
    const watchState = options.markFullyWatched === true ? 'playing' : 'paused';
    finalWatchUrl.searchParams.set('state', watchState);
    finalWatchUrl.searchParams.set('st', '0.000');
    finalWatchUrl.searchParams.set('et', cmt);
    finalWatchUrl.searchParams.set('lact', Date.now().toString());

    const res = await fetch(finalWatchUrl.toString(), { method: 'GET', headers: pingHeaders });

    const minutes = Math.floor(currentTime / 60);
    const seconds = Math.floor(currentTime % 60);
    const timeStr = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

    if (res.status >= 200 && res.status < 300) {
      addTerminalLog(`[İzleme Senkronu] "${title || id}" için süre YouTube hesabınıza eşitlendi: ${timeStr}`, 'success');
    } else {
      addTerminalLog(`[İzleme Senkronu UYARI] "${title || id}" senkronize edilirken YouTube yanıtı: HTTP ${res.status}. Çerezler arka planda yenilenecek.`, 'warning');
      triggerSilentCookieRefresh();
    }
    
    return {
      success: true,
      timeStr,
      currentTime,
      message: `Kaldığınız yer (${timeStr}) YouTube hesabınıza başarıyla eşitlendi!`
    };
  } catch (err) {
    addTerminalLog(`[İzleme Senkronu HATA]: ${err.message}`, 'error');
    return { success: false, error: err.message };
  }
}

/**
 * Belirtilen videoyu YouTube izleme geçmişinde "İzlendi" olarak işaretler.
 * Gerçek video süresi kullanılarak playing state ile gönderilir; böylece
 * YouTube geçmişe eklerken "tamamen izlendi" işaretini de koyar.
 * 
 * @param {string} id - YouTube Video ID
 * @param {string} [title] - Video Başlığı
 * @param {string} [knownDuration] - Bilinen süre (örn: "15:27" veya "1:02:30"); boşsa otomatik çekilir
 */
export async function markVideoWatchedOnYouTube(id, title = '', knownDuration = '') {
  // Türkçe Açıklama: "15:27" / "1:02:30" gibi süre metnini saniyeye çevirir; geçersizse 0 döner
  const durationTextToSeconds = (text) => {
    if (!text || typeof text !== 'string') return 0;
    const t = text.trim().toLowerCase();
    if (!t || t === 'live' || t === 'canlı') return 0;
    const parts = t.split(':').map(p => parseInt(p, 10));
    if (parts.length === 0 || parts.some(n => isNaN(n))) return 0;
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    if (parts.length === 2) return parts[0] * 60 + parts[1];
    return parts[0];
  };

  let durationSeconds = durationTextToSeconds(knownDuration);

  // Bilinen süre yoksa YouTube sayfasından süreyi çek
  if (durationSeconds <= 0) {
    try {
      const fetched = await fetchVideoDuration(id);
      durationSeconds = durationTextToSeconds(fetched && fetched.duration);
    } catch (e) {}
  }

  // Süre bilinemezse güvenli bir değer kullan (YouTube "izlendi" olarak sayar)
  const finalTime = durationSeconds > 0 ? durationSeconds : 600;
  return syncVideoWatchtimeToYouTube(id, finalTime, title, { markFullyWatched: true });
}

/**
 * Türkçe Açıklama: Takip edilmeyen ve kütüphanede kaydı olmayan bir kanalın son videolarını
 * yt-dlp ile çekip her birini YouTube izleme geçmişinde "İzlendi" olarak işaretler.
 * 
 * @param {string} channelUrl - Kanal URL'si veya @handle
 * @param {boolean} syncYouTube - YouTube senkronu açık mı
 * @param {number} [limit] - İşaretlenecek maksimum video sayısı (varsayılan: 50, üst sınır: 200)
 * @returns {Promise<number>} İşaretlenen video sayısı
 */
async function markChannelVideosWatchedOnYouTube(channelUrl, syncYouTube, limit = 50) {
  // Performans koruması: her video ~5-6 ağ isteği gerektirdiğinden aşırı istek yükünü önle
  const LIMIT = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 200);
  try {
    // @handle ise tam URL'ye çevir
    let url = channelUrl.trim();
    if (url.startsWith('@')) {
      url = `https://www.youtube.com/${url}`;
    }

    const args = [
      '--flat-playlist',
      '--playlist-end', LIMIT.toString(),
      '--print', '%(id)s|||%(title)s',
      '--no-warnings',
      url
    ];

    const entries = await new Promise((resolve) => {
      const proc = spawnYtdlp(args);
      let stdout = '';
      proc.stdout.on('data', (d) => { stdout += d.toString(); });
      proc.on('close', () => {
        const parsed = stdout.split('\n').map(l => l.trim()).filter(Boolean).map((l) => {
          const idx = l.indexOf('|||');
          if (idx === -1) return null;
          return [l.substring(0, idx), l.substring(idx + 3)];
        }).filter(Boolean);
        resolve(parsed);
      });
      proc.on('error', () => resolve([]));
    });

    let marked = 0;
    if (syncYouTube) {
      for (const [id, title] of entries) {
        try {
          await markVideoWatchedOnYouTube(id, title || `Video (${id})`);
          marked++;
        } catch (e) {}
      }
    }
    return marked;
  } catch (e) {
    return 0;
  }
}

// Aktif izleme süresi eşitlemelerini tutan harita (eski/gecikmiş kuyruk birikmesini engeller)
const activeWatchtimeSyncMap = new Map();

/**
 * Oynatılan videonun o anki izleme süresini YouTube hesabına senkronize eder
 * ve yerel veritabanına kaldığı yeri kaydeder.
 * 
 * @name POST /api/video/:id/sync-watchtime
 * @function
 * @inner
 */
router.post('/video/:id/sync-watchtime', localhostOnly, async (req, res) => {
  const { id } = req.params;
  const { currentTime, duration, title, silent } = req.body;

  const curTimeNum = parseFloat(currentTime) || 0;
  const durNum = parseFloat(duration) || 0;
  const reqTimestamp = Date.now();
  activeWatchtimeSyncMap.set(id, { reqTimestamp, currentTime: curTimeNum });

  // Yerel veritabanına izleme pozisyonunu kaydet
  try {
    await acquireDbLock(async () => {
      const db = readDb();
      const item = db.history.find(h => h.id === id);
      if (item) {
        if (durNum > 0 && (curTimeNum >= durNum * 0.95 || durNum - curTimeNum <= 5)) {
          item.lastPositionSeconds = 0;
        } else if (curTimeNum > 3) {
          item.lastPositionSeconds = Math.floor(curTimeNum);
        } else {
          item.lastPositionSeconds = 0;
        }
        if (durNum > 0) item.durationSeconds = Math.floor(durNum);
        item.lastWatchedAt = new Date().toISOString();
        writeDb(db);
      }
    });
  } catch (e) {}

  // Daha yeni bir süre isteği gelmişse eski süreyi YouTube'a gönderme
  const latestSync = activeWatchtimeSyncMap.get(id);
  if (latestSync && latestSync.reqTimestamp > reqTimestamp) {
    return res.json({ success: true, skipped: true, message: 'Daha güncel süre işleme alındığı için eski istek atlandı.' });
  }

  const result = await syncVideoWatchtimeToYouTube(id, curTimeNum, title || '', silent === true);
  if (result.success && !silent) {
    broadcast('status_log', {
      message: result.message,
      type: 'success'
    });
  }
  res.json(result);
});

/**
 * Oynatılan videonun yerel kaldığı yeri (position) ve toplam süresini db.json'a kaydeder.
 * Bir sonraki açılışta videonun kaldığı yerden otomatik başlamasını sağlar.
 * 
 * @name POST /api/video/:id/save-position
 * @function
 * @inner
 */
router.post('/video/:id/save-position', localhostOnly, async (req, res) => {
  const { id } = req.params;
  const { position, duration } = req.body;

  if (!id) {
    return res.status(400).json({ success: false, error: 'Video ID zorunludur.' });
  }

  const posNum = parseFloat(position) || 0;
  const durNum = parseFloat(duration) || 0;

  try {
    await acquireDbLock(async () => {
      const db = readDb();
      const item = db.history.find(h => h.id === id);
      if (item) {
        if (durNum > 0 && (posNum >= durNum * 0.95 || durNum - posNum <= 5)) {
          item.lastPositionSeconds = 0;
        } else if (posNum > 3) {
          item.lastPositionSeconds = Math.floor(posNum);
        } else {
          item.lastPositionSeconds = 0;
        }

        if (durNum > 0) {
          item.durationSeconds = Math.floor(durNum);
        }
        item.lastWatchedAt = new Date().toISOString();

        writeDb(db);
      }
    });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * APE Aracı: Verilen video veya kanal bağlantısındaki videoları izlendi/gizlendi olarak işaretler ve YouTube geçmişine eşitler.
 * @route POST /api/tools/ape-mark-watched
 */
router.post('/tools/ape-mark-watched', localhostOnly, async (req, res) => {
  try {
    const { target, syncYouTube, limit } = req.body;
    if (!target || typeof target !== 'string' || !target.trim()) {
      return res.status(400).json({ success: false, error: 'Lütfen geçerli bir video veya kanal linki/ID girin.' });
    }

    const raw = target.trim();
    const db = readDb();
    if (!db.history) db.history = [];
    if (!db.channels) db.channels = [];

    // 1. Kapsamlı Video URL / ID Tespiti (watch, youtu.be, shorts, live, embed, v)
    let videoId = null;
    if (/^[a-zA-Z0-9_-]{11}$/.test(raw)) {
      videoId = raw;
    } else if (raw.includes('watch?v=')) {
      const match = raw.match(/v=([a-zA-Z0-9_-]{11})/);
      if (match) videoId = match[1];
    } else if (raw.includes('youtu.be/')) {
      const match = raw.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
      if (match) videoId = match[1];
    } else if (raw.includes('/shorts/')) {
      const match = raw.match(/\/shorts\/([a-zA-Z0-9_-]{11})/);
      if (match) videoId = match[1];
    } else if (raw.includes('/live/')) {
      const match = raw.match(/\/live\/([a-zA-Z0-9_-]{11})/);
      if (match) videoId = match[1];
    } else if (raw.includes('/embed/')) {
      const match = raw.match(/\/embed\/([a-zA-Z0-9_-]{11})/);
      if (match) videoId = match[1];
    } else if (raw.includes('/v/')) {
      const match = raw.match(/\/v\/([a-zA-Z0-9_-]{11})/);
      if (match) videoId = match[1];
    }

    if (videoId) {
      // Tek video işaretleme
      let matchedVideo = db.history.find(h => h.id === videoId);
      let videoTitle = matchedVideo ? matchedVideo.title : `Video (${videoId})`;

      if (matchedVideo) {
        matchedVideo.hidden = true;
        matchedVideo.watched = true;
        writeDb(db);
        broadcast('db_update', db);
      }

      let ytSyncResult = null;
      if (syncYouTube !== false) {
        ytSyncResult = await markVideoWatchedOnYouTube(videoId, videoTitle, matchedVideo ? (matchedVideo.duration || '') : '');
      }

      const syncNote = ytSyncResult && ytSyncResult.success 
        ? ' (YouTube geçmişine de kaydedildi)' 
        : (ytSyncResult && ytSyncResult.error ? ` (${ytSyncResult.error})` : '');

      return res.json({
        success: true,
        type: 'video',
        videoId: videoId,
        title: videoTitle,
        inDatabase: !!matchedVideo,
        ytSynced: ytSyncResult ? ytSyncResult.success : false,
        message: `"${videoTitle}" başarıyla izlendi olarak işaretlendi.${syncNote}`
      });
    }

    // 2. Kanal URL / Handle Tespiti
    let matchedChannels = [];
    let handleQuery = null;
    // Kanal formatında bir girdi mi? (yanlış video-ID yakalamayı önler)
    let isChannelFormat = raw.startsWith('@') || raw.includes('/@') || raw.includes('/channel/') || raw.includes('/c/') || raw.includes('/user/');

    if (raw.startsWith('@') || raw.includes('/@')) {
      handleQuery = (raw.startsWith('@') ? raw : raw.substring(raw.indexOf('@'))).split(/[/?#]/)[0].toLowerCase();
      matchedChannels = db.channels.filter(c => c.handle && c.handle.toLowerCase().includes(handleQuery));
    } else if (raw.includes('/channel/')) {
      const chanId = raw.split('/channel/')[1].split(/[/?#]/)[0];
      matchedChannels = db.channels.filter(c => c.id === chanId);
    } else if (raw.includes('/c/') || raw.includes('/user/')) {
      const seg = raw.split(/\/(?:c|user)\//)[1].split(/[/?#]/)[0].toLowerCase();
      matchedChannels = db.channels.filter(c => (c.name && c.name.toLowerCase().includes(seg)) || (c.handle && c.handle.toLowerCase().includes(seg)));
    } else {
      // İsim araması
      const query = raw.toLowerCase();
      matchedChannels = db.channels.filter(c => (c.name && c.name.toLowerCase().includes(query)) || (c.handle && c.handle.toLowerCase().includes(query)));
    }

    if (matchedChannels.length > 0) {
      const channelIds = new Set(matchedChannels.map(c => c.id));
      const channelNames = matchedChannels.map(c => c.name).join(', ');
      let markedCount = 0;
      const watchedVideos = [];

      for (const item of db.history) {
        if (channelIds.has(item.channelId)) {
          if (item.hidden !== true || item.watched !== true) {
            item.hidden = true;
            item.watched = true;
            markedCount++;
            watchedVideos.push(item);
          }
        }
      }

      if (markedCount > 0) {
        writeDb(db);
        broadcast('db_update', db);
      }

      // YouTube izleme geçmişine izlendi olarak ekle (arka planda; yanıt bekletilmez)
      if (syncYouTube !== false) {
        for (const item of watchedVideos) {
          markVideoWatchedOnYouTube(item.id, item.title, item.duration || '').catch(() => {});
        }
      }

      const ytNote = syncYouTube !== false && watchedVideos.length > 0 ? ' YouTube geçmişine ekleniyor.' : '';
      return res.json({
        success: true,
        type: 'channel',
        channels: channelNames,
        markedCount: markedCount,
        message: `"${channelNames}" kanalındaki ${markedCount} video izlendi/gizlendi olarak işaretlendi.${ytNote}`
      });
    }

    // 2b. Kanal takip listesinde yoksa kütüphanedeki (db.history) videoları kanal ID / kanal adı üzerinden tara
    if (matchedChannels.length === 0) {
      let historyFilter = null;
      let displayName = raw;
      if (raw.includes('/channel/')) {
        const chanId = raw.split('/channel/')[1].split(/[/?#]/)[0];
        historyFilter = (h) => h.channelId === chanId;
        displayName = chanId;
      } else if (!raw.startsWith('@') && !raw.includes('/@') && !raw.includes('/c/') && !raw.includes('/user/')) {
        const query = raw.toLowerCase();
        historyFilter = (h) => h.channelName && h.channelName.toLowerCase().includes(query);
      }

      if (historyFilter) {
        const historyMatches = db.history.filter(historyFilter);
        let historyMarked = 0;
        for (const item of historyMatches) {
          if (item.hidden !== true || item.watched !== true) {
            item.hidden = true;
            item.watched = true;
            historyMarked++;
          }
        }
        if (historyMarked > 0) {
          writeDb(db);
          broadcast('db_update', db);
        }

        // Kütüphanede bulunan bu videoları YouTube izleme geçmişine de ekle (arka planda)
        if (syncYouTube !== false && historyMatches.length > 0) {
          for (const item of historyMatches) {
            markVideoWatchedOnYouTube(item.id, item.title, item.duration || '').catch(() => {});
          }
        }

        if (historyMarked > 0) {
          return res.json({
            success: true,
            type: 'channel',
            channels: displayName,
            markedCount: historyMarked,
            message: `Kütüphanenizde "${displayName}" kanalına ait ${historyMarked} video izlendi/gizlendi olarak işaretlendi (bu kanal takip listenizde değil).${syncYouTube !== false ? ' YouTube geçmişine ekleniyor.' : ''}`
          });
        }
      }
    }

    // 2c. Kanal hiçbir yerde yoksa: kanal formatındaki girdilerde son videoları YouTube'dan çekip
    // arka planda izlendi olarak işaretle (indirilmemiş / takip edilmeyen kanallar için)
    if (matchedChannels.length === 0 && isChannelFormat) {
      let channelUrl = raw.trim();
      if (channelUrl.startsWith('@')) {
        channelUrl = `https://www.youtube.com/${channelUrl}`;
      }
      const channelLimit = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 200);
      markChannelVideosWatchedOnYouTube(channelUrl, syncYouTube !== false, channelLimit);
      return res.json({
        success: true,
        type: 'channel',
        markedCount: 0,
        message: `"${raw}" kanalının son ${channelLimit} videosu arka planda YouTube geçmişinize izlendi olarak işaretleniyor.`
      });
    }

    // 3. Kanal formatındaki girdilerde yanlış video-ID yakalamasını önle; diğer girdilerde
    // olası bir 11 karakterlik video ID'yi dene
    if (!isChannelFormat) {
      const anyIdMatch = raw.match(/([a-zA-Z0-9_-]{11})/);
      if (anyIdMatch) {
        const genericId = anyIdMatch[1];
        let ytSyncResult = null;
        if (syncYouTube !== false) {
          ytSyncResult = await markVideoWatchedOnYouTube(genericId, `Video (${genericId})`);
        }

        return res.json({
          success: true,
          type: 'video',
          videoId: genericId,
          title: `Video (${genericId})`,
          inDatabase: false,
          ytSynced: ytSyncResult ? ytSyncResult.success : false,
          message: `"${genericId}" kimlikli video YouTube geçmişinizde izlendi olarak işaretlendi.${ytSyncResult && ytSyncResult.success ? ' (Watchtime Sync Başarılı)' : ''}`
        });
      }
    }

    return res.status(400).json({
      success: false,
      error: isChannelFormat
        ? 'Bu kanal takip listenizde veya kütüphanenizde bulunamadı. Kanal linki ile denediyseniz arka plan işlemi başlatılmış olabilir; kanal adı ile denediyseniz lütfen kanalın tam linkini girin.'
        : 'Girilen bağlantıdan geçerli bir video veya kanal tespit edilemedi. Lütfen tam YouTube video URL\'si (https://youtube.com/watch?v=...) veya @KanalAdi girin.'
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message || 'APE işlemi sırasında sunucu hatası oluştu.' });
  }
});

// YouTube abonelik listesi önbelleği (11MB'lık sayfa tekrar indirilmesin)
let subscriptionsCacheRaw = null;
let subscriptionsCacheTime = 0;
const SUBSCRIPTIONS_CACHE_TTL_MS = 5 * 60 * 1000;

// Türkçe Açıklama: Kök ve bin/ çerez dosyalarını birleştirip tek Cookie header'ı üretir.
function buildSubscriptionsCookieHeader() {
  const rootCookiesTxt = path.resolve(process.cwd(), 'cookies.txt');
  const binCookiesTxt = path.resolve(process.cwd(), 'bin', 'cookies.txt');
  const cookiesObj = {};
  for (const cookieFile of [rootCookiesTxt, binCookiesTxt]) {
    if (!fs.existsSync(cookieFile)) continue;
    const content = fs.readFileSync(cookieFile, 'utf8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const parts = trimmed.split('\t');
      if (parts.length >= 7) cookiesObj[parts[5]] = parts[6];
    }
  }
  return Object.entries(cookiesObj).map(([k, v]) => `${k}=${v}`).join('; ');
}

/**
 * YouTube abone kanal listesini oturum çerezleriyle çekip takip durumlarıyla birlikte döndürür.
 * 
 * @name GET /api/tools/subscriptions
 * @function
 * @inner
 * @param {object} req - Express istek nesnesi
 * @param {object} res - Express yanıt nesnesi
 * @returns {Promise<void>}
 */
router.get('/tools/subscriptions', localhostOnly, async (req, res) => {
  try {
    const cookieHeader = buildSubscriptionsCookieHeader();
    if (!cookieHeader) {
      return res.status(400).json({ success: false, error: 'YouTube oturum çerezi bulunamadı. Lütfen Ayarlar sekmesinden "YouTube\'da Oturum Aç" ile oturum açın.' });
    }

    // Önbellek: aynı oturumda 5 dakika içinde 11MB'lık sayfayı tekrar indirme (performans)
    let channels;
    const now = Date.now();
    if (subscriptionsCacheRaw && (now - subscriptionsCacheTime) < SUBSCRIPTIONS_CACHE_TTL_MS) {
      channels = subscriptionsCacheRaw;
    } else {
      const fetchRes = await fetch('https://www.youtube.com/feed/channels', {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Cookie': cookieHeader,
          'Accept-Language': 'tr-TR,tr;q=0.9,en;q=0.8'
        },
        redirect: 'follow'
      });
      if (fetchRes.status !== 200) {
        return res.status(502).json({ success: false, error: `YouTube yanıtı: HTTP ${fetchRes.status}` });
      }
      const html = await fetchRes.text();

      // channelRenderer bloklarını parse et (channelId + kanal adı)
      const parsed = [];
      const seen = new Set();
      const rendererRe = /"channelRenderer":\{"channelId":"(UC[\w-]+)","title":\{"simpleText":"([^"]+)"\}/g;
      let match;
      while ((match = rendererRe.exec(html)) !== null) {
        const id = match[1];
        const name = match[2].trim();
        if (name && !seen.has(id)) {
          seen.add(id);
          parsed.push({ id, name });
        }
      }
      channels = parsed;
      subscriptionsCacheRaw = parsed;
      subscriptionsCacheTime = now;
    }

    if (channels.length === 0) {
      return res.json({ success: true, channels: [], sessionValid: false, message: 'Abone kanalı bulunamadı. Oturum geçersiz olabilir — Ayarlar → "YouTube\'da Oturum Aç" ile yenileyin.' });
    }

    const db = readDb();
    const result = channels.map(ch => ({
      ...ch,
      followed: db.channels.some(c => c.id === ch.id)
    }));
    res.json({ success: true, channels: result, sessionValid: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message || 'Abonelikler çekilemedi.' });
  }
});

/**
 * Seçilen YouTube abone kanallarını toplu olarak takip listesine ekler.
 * 
 * @name POST /api/tools/subscriptions/import
 * @function
 * @inner
 * @param {object} req - Express istek nesnesi (gövde: { channels: [{id, name}] })
 * @param {object} res - Express yanıt nesnesi
 * @returns {Promise<void>}
 */
router.post('/tools/subscriptions/import', localhostOnly, async (req, res) => {
  try {
    const { channels } = req.body || {};
    if (!Array.isArray(channels) || channels.length === 0) {
      return res.status(400).json({ success: false, error: 'Eklenecek kanal seçilmedi.' });
    }

    const db = readDb();
    let added = 0;
    let skipped = 0;
    const addedNames = [];
    const addedIds = [];

    for (const ch of channels) {
      const id = ch && ch.id;
      const name = ch && ch.name;
      if (!id || !/^UC[\w-]{22}$/.test(id) || !name || typeof name !== 'string') {
        skipped++;
        continue;
      }
      if (db.channels.some(c => c.id === id)) {
        skipped++;
        continue;
      }
      const cleanName = name.trim();
      db.channels.push({
        id,
        name: cleanName,
        handle: `@${cleanName.replace(/\s+/g, '')}`,
        addedAt: new Date().toISOString(),
        quality: 'default',
        downloadShorts: false,
        avatar: '',
        shortsDurationLimit: 180,
        autoDownload: true,
        subscriberCount: ''
      });
      added++;
      addedNames.push(cleanName);
      addedIds.push(id);
    }

    if (added > 0) {
      writeDb(db);
      broadcast('db_update', db);
      broadcast('status_log', { message: `${added} YouTube aboneliği takip listesine eklendi.`, type: 'success' });

      // Arka planda yalnızca YENİ EKLENEN kanalların abone/avatar bilgilerini güncelle (600ms arayla)
      setTimeout(async () => {
        let changed = false;
        for (const chId of addedIds) {
          try {
            const dbForUpdate = readDb();
            const ch = dbForUpdate.channels.find(c => c.id === chId);
            if (ch) {
              await updateChannelFullInfo(ch);
              changed = true;
            }
          } catch (e) {}
          await new Promise(r => setTimeout(r, 600));
        }
        if (changed) {
          try { writeDb(readDb()); } catch (e) {}
        }
      }, 300);
    }

    res.json({ success: true, addedCount: added, skippedCount: skipped, addedNames });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message || 'Kanallar eklenemedi.' });
  }
});

/**
 * YouTube abonelikler (feed/channels) sayfasını WebView2 oynatıcıda açar.
 * 
 * @name POST /api/tools/open-subscriptions
 * @function
 * @inner
 * @param {object} req - Express istek nesnesi
 * @param {object} res - Express yanıt nesnesi
 * @returns {Promise<void>}
 */
router.post('/tools/open-subscriptions', localhostOnly, (req, res) => {
  try {
    const subsUrl = 'https://www.youtube.com/feed/channels';
    const binPlayerExe = path.resolve(process.cwd(), 'bin', 'HaYTooLPlayer.exe');
    const launcherExe = path.resolve(process.cwd(), 'HaYTooL-Player Beta.exe');
    const targetExe = fs.existsSync(binPlayerExe) ? binPlayerExe : (fs.existsSync(launcherExe) ? launcherExe : null);
    if (targetExe) {
      exec(`"${targetExe}" "${subsUrl}"`, { windowsHide: false }, () => {});
      console.log('[YouTube Abonelikler] feed/channels sayfası WebView2 oynatıcıda açıldı.');
      return res.json({ success: true, message: 'YouTube abonelik sayfası açıldı.' });
    }
    open(subsUrl);
    res.json({ success: true, message: 'YouTube abonelik sayfası tarayıcıda açıldı.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Belirtilen dizin içerisindeki tüm dosyaları alt klasörleriyle birlikte özyinelemeli (recursive) olarak tarar.
 * 
 * @param {string} dir - Taranacak klasörün mutlak yolu
 * @returns {Array<string>} Bulunan tüm dosyaların yollarını içeren dizi
 */
function getFilesRecursively(dir) {
  let results = [];
  if (!fs.existsSync(dir)) return results;
  try {
    const list = fs.readdirSync(dir);
    for (const file of list) {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);
      if (stat && stat.isDirectory()) {
        results = results.concat(getFilesRecursively(filePath));
      } else {
        results.push(filePath);
      }
    }
  } catch (err) {
    console.error(`Error scanning directory ${dir}:`, err.message);
  }
  return results;
}

/**
 * db.json veritabanı dosyasının tüm içeriğini JSON olarak istemciye döner.
 * 
 * @name GET /api/db
 * @function
 * @inner
 * @param {object} req - Express istek nesnesi
 * @param {object} res - Express yanıt nesnesi
 * @returns {void}
 */
router.get('/db', (req, res) => {
  res.json(readDb());
});

/**
 * Belirtilen YouTube videosunu doğrudan kuyruğa ekleyerek manuel indirmeyi başlatır.
 * 
 * @name POST /api/download-video
 * @function
 * @inner
 * @param {object} req - Express istek nesnesi
 * @param {string} [req.body.videoId] - YouTube video ID'si (11 karakter)
 * @param {string} [req.body.url] - YouTube video bağlantı adresi (ID ayıklamak için)
 * @param {string} [req.body.title] - Özel video başlığı
 * @param {string} [req.body.channelName] - Kanal adı
 * @param {string} [req.body.channelId] - Kanal ID'si
 * @param {object} res - Express yanıt nesnesi
 * @returns {Promise<void>}
 */
router.post('/download-video', localhostOnly, async (req, res) => {
  const { videoId, url } = req.body;
  let { title, channelName, channelId } = req.body;

  let targetVideoId = videoId;

  if (!targetVideoId && url) {
    const youtubeRegex = /(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/))([^?&"'>\s]{11})/;
    const match = url.match(youtubeRegex);
    if (match) {
      targetVideoId = match[1];
    }
  }

  if (!targetVideoId) return res.status(400).json({ error: 'Video ID veya URL gereklidir.' });
  if (!/^[a-zA-Z0-9_-]{11}$/.test(targetVideoId)) {
    return res.status(400).json({ error: 'Geçersiz Video ID formatı.' });
  }

  if (!channelName || !title) {
    try {
      console.log(`[Manual Download] Fetching video details from YouTube: ${targetVideoId}`);
      const details = await fetchVideoDuration(targetVideoId);
      if (details) {
        if (details.title) title = details.title;
        if (details.channelName) channelName = details.channelName;
        if (details.channelId) channelId = details.channelId;
      }
    } catch (err) {
      console.error(`[Manual Download] Error occurred:`, err.message);
    }
  }

  if (downloadQueue.isPaused) {
    downloadQueue.isPaused = false;
    try {
      const db = readDb();
      if (db && db.settings) {
        db.settings.isPaused = false;
        writeDb(db);
      }
    } catch (e) {}
  }

  downloadQueue.add({
    id: targetVideoId,
    title: title || 'Bilinmeyen Video',
    channelId: channelId || 'manual',
    channelName: channelName || 'Manuel İndirme',
    url: `https://www.youtube.com/watch?v=${targetVideoId}`,
    publishedAt: ''
  });

  resolveMissingDurations();

  res.json({ success: true, message: 'İndirme kuyruğuna eklendi.', videoId: targetVideoId });
});

/**
 * Kütüphane geçmişindeki videoların eksik kalan metadata detaylarını (süre, tarih vb.) onarır / günceller.
 * 
 * @name POST /api/library/update-metadata
 * @function
 * @inner
 * @param {object} req - Express istek nesnesi
 * @param {string} req.body.type - Güncelleme türü ('downloaded' vb.)
 * @param {object} res - Express yanıt nesnesi
 * @returns {void}
 */
router.post('/library/update-metadata', localhostOnly, (req, res) => {
  try {
    const db = readDb();
    const type = req.body.type;
    let updated = false;
    let count = 0;

    if (type === 'downloaded') {
      db.history.forEach(item => {
        if (item.status === 'completed') {
          if (item.duration === '-') item.duration = '';
          if (item.publishedAt === '-') item.publishedAt = '';
          item.resolveAttempts = 0;
          updated = true;
          count++;
        }
      });
    } else {
      db.history.forEach(item => {
        if (item.duration === '-') item.duration = '';
        if (item.publishedAt === '-') item.publishedAt = '';
        item.resolveAttempts = 0;
        updated = true;
        count++;
      });
    }

    if (updated) {
      writeDb(db);
      broadcast('db_update', readDb());
    }

    resolveMissingDurations();
    res.json({ success: true, count });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Tüm İndirmeleri İptal Et / Sıfırla
/**
 * Tüm kayıtlı kanalların RSS akışlarını sırayla arka planda denetler (Manuel senkronizasyon tetiklemesi).
 * 
 * @name POST /api/sync
 * @function
 * @inner
 * @param {object} req - Express istek nesnesi
 * @param {object} res - Express yanıt nesnesi
 * @returns {void}
 */
router.post(['/sync', '/history/sync'], localhostOnly, async (req, res) => {
  try {
    const db = readDb();
    if (!db.channels || db.channels.length === 0) {
      return res.json({ success: true, message: 'İzlenen kanal bulunmuyor.' });
    }
    
    const source = req.body?.source || 'ui';
    const result = await triggerChannelCheck(source);

    if (result.inProgress) {
      return res.json({ success: true, message: 'Tarama zaten devam ediyor.' });
    }

    const successMsg = `Tüm kanalların denetimi ${result.duration || 0} saniyede tamamlandı. ${result.newVideos || 0} yeni video bulundu.`;
    broadcast('status_log', { message: successMsg, type: 'success' });
    
    res.json({ 
      success: true, 
      message: successMsg, 
      duration: result.duration, 
      newVideos: result.newVideos 
    });
  } catch (err) {
    console.error('[History Sync Error]:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * İndirme dizinindeki fiziksel dosyaları veritabanı kayıtları ile karşılaştırarak tutarsızlıkları (kayıtlı olup fiziksel bulunamayanlar, fiziksel bulunup veritabanında olmayanlar vb.) listeler.
 * 
 * @name GET /api/tools/compare-files
 * @function
 * @inner
 * @param {object} req - Express istek nesnesi
 * @param {object} res - Express yanıt nesnesi
 * @returns {void}
 */
router.get('/tools/compare-files', localhostOnly, (req, res) => {
  const db = readDb();
  const folder = db.settings.downloadPath;
  
  if (!fs.existsSync(folder)) {
    return res.json({ success: true, untrackedFiles: [], unrelatedFiles: [], missingFiles: [] });
  }

  const allFiles = getFilesRecursively(folder);
  const videoExtensions = ['.mp4', '.mkv', '.webm', '.avi', '.ts', '.3gp', '.flv'];
  
  const formatBytes = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const completedHistory = db.history.filter(h => h.status === 'completed');
  const completedHistoryIds = new Set(completedHistory.map(h => h.id));
  
  const untrackedFiles = [];
  const unrelatedFiles = [];
  const diskVideos = [];

  for (const filePath of allFiles) {
    const filename = path.basename(filePath);
    const filenameLower = filename.toLowerCase();
    
    if (filenameLower === 'avatar.ico' || filenameLower === 'avatar.jpg' || filenameLower === 'desktop.ini') {
      continue;
    }

    const ext = path.extname(filePath).toLowerCase();
    const idMatch = filename.match(/\[([a-zA-Z0-9_-]{11})\]/);
    let videoId = null;
    if (idMatch) {
      videoId = idMatch[1];
    }
    
    if (videoId && videoExtensions.includes(ext)) {
      diskVideos.push(videoId);
    }
    
    try {
      const stat = fs.statSync(filePath);
      const fileData = {
        id: videoId,
        title: filename,
        filename: filename,
        filePath: filePath,
        fileSize: formatBytes(stat.size)
      };
      
      if (videoId) {
        if (completedHistoryIds.has(videoId)) {
          continue;
        } else {
          if (videoExtensions.includes(ext)) {
            const nameWithoutExt = filename.slice(0, filename.length - ext.length);
            const bracketIndex = nameWithoutExt.lastIndexOf(' [');
            let channelName = '';
            let title = nameWithoutExt;
            if (bracketIndex !== -1) {
              const titleAndChannel = nameWithoutExt.slice(0, bracketIndex);
              const dashIndex = titleAndChannel.indexOf(' - ');
              if (dashIndex !== -1) {
                channelName = titleAndChannel.slice(0, dashIndex).trim();
                title = titleAndChannel.slice(dashIndex + 3).trim();
              } else {
                title = titleAndChannel.trim();
              }
            }
            fileData.channelName = channelName;
            fileData.title = title;
            untrackedFiles.push(fileData);
          } else {
            unrelatedFiles.push(fileData);
          }
        }
      } else {
        unrelatedFiles.push(fileData);
      }
    } catch (e) {
      // Kasıtlı sessiz: Bozuk veya erişilemeyen bir dosya karşılaştırmayı durdurmasın, atla ve devam et.
    }
  }

  const missingFiles = [];
  for (const item of completedHistory) {
    const existsOnDisk = diskVideos.includes(item.id);
    if (!existsOnDisk) {
      missingFiles.push({
        id: item.id,
        title: item.title,
        channelName: item.channelName,
        channelId: item.channelId,
        filePath: item.filePath,
        publishedAt: item.publishedAt,
        downloadedAt: item.downloadedAt
      });
    }
  }

  res.json({
    success: true,
    untrackedFiles,
    unrelatedFiles,
    missingFiles
  });
});

/**
 * Belirtilen dosyanın disk üzerindeki klasör konumunu Windows Gezgini'nde (Explorer) açar ve dosyayı seçili gösterir.
 * 
 * @name POST /api/tools/open-file-location
 * @function
 * @inner
 * @param {object} req - Express istek nesnesi
 * @param {string} req.body.filePath - Konumu açılacak dosyanın mutlak yolu
 * @param {object} res - Express yanıt nesnesi
 * @returns {void}
 */
router.post('/tools/open-file-location', localhostOnly, (req, res) => {
  const { filePath } = req.body;
  if (!filePath) return res.status(400).json({ error: 'filePath parametresi gereklidir.' });
  
  const resolvedFile = path.resolve(filePath);
  const db = readDb();
  const downloadPathResolved = path.resolve(db.settings.downloadPath);
  
  if (!resolvedFile.toLowerCase().startsWith(downloadPathResolved.toLowerCase())) {
    return res.status(403).json({ error: 'Güvenlik hatası: İndirme klasörü dışındaki bir dosya açılamaz.' });
  }
  
  if (!fs.existsSync(resolvedFile)) {
    return res.status(404).json({ error: 'Dosya bulunamadı.' });
  }
  
  try {
    if (process.platform === 'win32') {
      exec(`explorer.exe /select,"${resolvedFile}"`);
      const folderName = path.basename(path.dirname(resolvedFile));
      const folderNameSafe = folderName.replace(/'/g, "''");
      setTimeout(() => {
        exec(`powershell -Command "(New-Object -ComObject wscript.shell).AppActivate('${folderNameSafe}')"`, (err) => {});
      }, 500);
    } else if (process.platform === 'darwin') {
      exec(`open -R "${resolvedFile}"`);
    } else {
      exec(`dolphin --select "${resolvedFile}"`, (err) => {
        if (err) {
          exec(`xdg-open "${path.dirname(resolvedFile)}"`);
        }
      });
    }
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * Veritabanında ve disk üzerinde bulunan dosyaları eşitlemek için toplu düzeltme / onarma işlemleri yapar.
 * 
 * @name POST /api/tools/fix-files
 * @function
 * @inner
 * @param {object} req - Express istek nesnesi
 * @param {string} req.body.action - Yapılacak eylem ('delete-untracked', 'import-untracked', 'clean-missing', 'delete-history-item', 'mark-missing-as-not-downloaded')
 * @param {Array<string>} [req.body.videoIds] - Eylem kapsamındaki video ID listesi
 * @param {Array<string>} [req.body.filePaths] - Eylem kapsamındaki dosya yolu listesi
 * @param {Array<object>} [req.body.filesToImport] - İçe aktarılacak dosyaların bilgileri
 * @param {object} res - Express yanıt nesnesi
 * @returns {Promise<void>}
 */
router.post('/tools/fix-files', localhostOnly, async (req, res) => {
  const { action, videoIds, filePaths, filesToImport } = req.body;
  const release = await acquireDbLock();
  
  try {
    const db = readDb();
    const downloadPathResolved = path.resolve(db.settings.downloadPath);
    let deletedCount = 0;
    let importedCount = 0;

    if (action === 'delete-untracked' || action === 'delete-unrelated' || action === 'delete-untracked-file' || action === 'delete-unrelated-file') {
      if (filePaths && filePaths.length > 0) {
        for (const f of filePaths) {
          const resolvedFile = path.resolve(f);
          if (!resolvedFile.toLowerCase().startsWith(downloadPathResolved.toLowerCase())) continue;
          
          try {
            if (!fs.existsSync(resolvedFile)) continue;
            
            if (action === 'delete-untracked' || action === 'delete-untracked-file') {
              const baseName = path.basename(resolvedFile);
              const ext = path.extname(resolvedFile);
              const baseNameWithoutExt = baseName.slice(0, baseName.length - ext.length);
              
              const idMatch = baseName.match(/\[([a-zA-Z0-9_-]{11})\]/);
              const targetToken = idMatch ? `[${idMatch[1]}]` : null;

              const parentDir = path.dirname(resolvedFile);
              const siblings = fs.readdirSync(parentDir);

              for (const sibling of siblings) {
                const fullSibling = path.join(parentDir, sibling);
                let shouldDelete = false;
                
                if (targetToken && sibling.includes(targetToken)) {
                  shouldDelete = true;
                } else if (!targetToken && sibling.startsWith(baseNameWithoutExt)) {
                  shouldDelete = true;
                }

                if (shouldDelete) {
                  try {
                    if (fullSibling.toLowerCase().startsWith(downloadPathResolved.toLowerCase())) {
                      fs.unlinkSync(fullSibling);
                    }
                  } catch (e) {
                    // Kasıtlı sessiz: Companion dosyası silinemezse ana silme işlemi devam etsin.
                  }
                }
              }
            }

            if (fs.existsSync(resolvedFile)) {
              fs.unlinkSync(resolvedFile);
              deletedCount++;
            }
          } catch (err) {
            console.error(`Dosya silinemedi: ${resolvedFile}`, err.message);
          }
        }
      }
    } else if (action === 'import-untracked') {
      if (filesToImport && filesToImport.length > 0) {
        for (const fileData of filesToImport) {
          if (!fileData.id || !fileData.filePath) continue;
          const resolvedFile = path.resolve(fileData.filePath);
          if (!resolvedFile.toLowerCase().startsWith(downloadPathResolved.toLowerCase())) continue;
          if (!fs.existsSync(resolvedFile)) continue;

          const existsInDb = db.history.some(h => h.id === fileData.id);
          if (!existsInDb) {
            let title = fileData.title || fileData.filename;
            let channelName = fileData.channelName || 'İçe Aktarılan Kanal';
            let channelId = 'imported';

            const matchingChannel = db.channels.find(c => c.name.toLowerCase() === channelName.toLowerCase());
            if (matchingChannel) {
              channelId = matchingChannel.id;
              channelName = matchingChannel.name;
            }

            let publishedAt = new Date().toISOString();
            let duration = '';
            
            try {
              const details = await fetchVideoDuration(fileData.id);
              if (details) {
                if (details.publishedAt) publishedAt = details.publishedAt;
                if (details.duration) duration = details.duration;
              }
            } catch (err) {
              // Kasıtlı sessiz: Süre çözümlenemese de işleme devam edilir
            }

            try {
              const stats = fs.statSync(resolvedFile);
              const sizeInBytes = stats.size;
              let fileSizeStr = '';
              if (sizeInBytes >= 1024 * 1024 * 1024) {
                fileSizeStr = Math.round(sizeInBytes / (1024 * 1024 * 1024)) + ' GB';
              } else {
                fileSizeStr = Math.round(sizeInBytes / (1024 * 1024)) + ' MB';
              }

              db.history.push({
                id: fileData.id,
                title: title,
                channelId: channelId,
                channelName: channelName,
                downloadedAt: new Date().toISOString(),
                publishedAt: publishedAt,
                status: 'completed',
                progress: 100,
                fileSize: fileSizeStr,
                filePath: resolvedFile,
                duration: duration
              });
              importedCount++;
            } catch (err) {
              // Kasıtlı sessiz: Dosya istatistiği alınamazsa işlem devam eder
            }
          }
        }
        if (importedCount > 0) {
          writeDb(db);
        }
      }
    } else if (action === 'clean-missing') {
      if (videoIds && videoIds.length > 0) {
        const idSet = new Set(videoIds);
        db.history = db.history.filter(item => {
          if (item.status === 'completed' && idSet.has(item.id)) {
            const diskPath = item.filePath;
            if (!diskPath || !fs.existsSync(diskPath)) {
              deletedCount++;
              return false;
            }
          }
          return true;
        });
        if (deletedCount > 0) {
          writeDb(db);
        }
      }
    } else if (action === 'delete-history-item') {
      if (videoIds && videoIds.length > 0) {
        const idSet = new Set(videoIds);
        db.history = db.history.filter(item => {
          if (idSet.has(item.id)) {
            deletedCount++;
            return false;
          }
          return true;
        });
        if (deletedCount > 0) {
          writeDb(db);
        }
      }
    } else if (action === 'mark-missing-as-not-downloaded') {
      if (videoIds && videoIds.length > 0) {
        const idSet = new Set(videoIds);
        db.history.forEach(item => {
          if (idSet.has(item.id)) {
            item.status = 'ignored';
            item.filePath = '';
            item.fileSize = '';
            item.progress = 0;
            deletedCount++;
          }
        });
        if (deletedCount > 0) {
          writeDb(db);
        }
      }
    }

    broadcast('db_update', readDb());
    res.json({ success: true, deletedCount, importedCount });
  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    release();
  }
});

/**
 * Windows işletim sistemine özel yerel klasör seçim diyaloğunu (FolderBrowserDialog) başlatarak seçilen yolu döner.
 * 
 * @name POST /api/select-folder
 * @function
 * @inner
 * @param {object} req - Express istek nesnesi
 * @param {object} res - Express yanıt nesnesi
 * @returns {void}
 */
router.post('/select-folder', localhostOnly, (req, res) => {
  const db = readDb();
  const currentPath = db.settings.downloadPath || '';
  const escapedPath = currentPath.replace(/'/g, "''");
  
  const psCommand = `powershell -NoProfile -STA -Command "Add-Type -AssemblyName System.Windows.Forms; $dialog = New-Object System.Windows.Forms.FolderBrowserDialog; $dialog.Description = 'Please select a download folder'; $dialog.SelectedPath = '${escapedPath}'; $dialog.ShowNewFolderButton = $true; $form = New-Object System.Windows.Forms.Form; $form.TopMost = $true; $form.Opacity = 0; $form.Show(); $form.Activate(); $result = $dialog.ShowDialog($form); $form.Close(); if ($result -eq 'OK') { Write-Output $dialog.SelectedPath } else { Write-Output 'CANCEL' }"`;
  
  exec(psCommand, (err, stdout, stderr) => {
    if (err) {
      console.error('Folder selection error:', err.message || stderr);
      return res.status(500).json({ error: 'Klasör seçim penceresi açılamadı.' });
    }
    const selectedPath = stdout.trim();
    if (selectedPath && selectedPath !== 'CANCEL') {
      res.json({ success: true, path: selectedPath });
    } else {
      res.json({ success: false, message: 'Klasör seçimi iptal edildi.' });
    }
  });
});

/**
 * Belirtilen kanalın veya genel indirme klasörünü yerel işletim sisteminin dosya yöneticisinde (Explorer/Finder) açar.
 * 
 * @name POST /api/open-folder
 * @function
 * @inner
 * @param {object} req - Express istek nesnesi
 * @param {string} [req.body.channelName] - Açılacak kanala özel alt klasörün adı
 * @param {object} res - Express yanıt nesnesi
 * @returns {void}
 */
router.post('/open-folder', localhostOnly, (req, res) => {
  const db = readDb();
  let folder = db.settings.downloadPath;
  
  const { channelName } = req.body || {};
  if (channelName && typeof channelName === 'string') {
    const baseDownloadPath = path.resolve(db.settings.downloadPath);
    const targetFolder = path.resolve(baseDownloadPath, channelName);
    const relative = path.relative(baseDownloadPath, targetFolder);
    const isSafe = relative && !relative.startsWith('..') && !path.isAbsolute(relative);
    
    if (isSafe && fs.existsSync(targetFolder)) {
      folder = targetFolder;
    }
  }

  if (!fs.existsSync(folder)) {
    try {
      fs.mkdirSync(folder, { recursive: true });
    } catch (err) {
      return res.status(500).json({ error: 'Klasör oluşturulamadı.' });
    }
  }

  if (process.platform === 'win32') {
    const resolvedFolder = path.resolve(folder);
    exec(`explorer.exe "${resolvedFolder}"`);
    const folderName = path.basename(resolvedFolder);
    const folderNameSafe = folderName.replace(/'/g, "''");
    setTimeout(() => {
      exec(`powershell -Command "(New-Object -ComObject wscript.shell).AppActivate('${folderNameSafe}')"`, (err) => {});
    }, 500);
  } else if (process.platform === 'darwin') {
    open(folder);
  } else {
    exec(`xdg-open "${path.resolve(folder)}"`);
  }
  res.json({ success: true });
});

/**
 * Kütüphane / geçmiş listesinden bir videoyu siler ve isteğe bağlı olarak diski de temizler.
 * 
 * @name DELETE /api/history/:id
 * @function
 * @inner
 * @param {object} req - Express istek nesnesi
 * @param {string} req.params.id - Silinecek videonon YouTube ID'si (11 karakter)
 * @param {boolean} [req.query.deleteFile] - Disk üzerindeki video dosyasının da silinip silinmeyeceği
 * @param {object} res - Express yanıt nesnesi
 * @returns {Promise<void>}
 */
router.delete('/history/:id', localhostOnly, async (req, res) => {
  const { id } = req.params;
  if (!/^[a-zA-Z0-9_-]{11}$/.test(id)) {
    return res.status(400).json({ error: 'Geçersiz Video ID formatı.' });
  }
  const deleteFile = req.query.deleteFile === 'true';
  const markWatched = req.query.markWatched === 'true';
  
  console.log(`\n--- SİLME İŞLEMİ BAŞLATILDI ---`);
  console.log(`Tarih/Saat: ${new Date().toLocaleString('tr-TR')}`);
  console.log(`Target Video ID: ${id}`);
  console.log(`Bilgisayardan dosya silinsin mi: ${deleteFile}`);
  console.log(`YouTube'da izlendi olarak işaretlensin mi: ${markWatched}`);

  const db = readDb();
  const itemIndex = db.history.findIndex(h => h.id === id);

  if (itemIndex !== -1) {
    const item = db.history[itemIndex];
    console.log(`Video Adı: ${item.title}`);
    console.log(`Kanal: ${item.channelName}`);
    console.log(`Kayıtlı Yol: ${item.filePath}`);
    
    if (deleteFile) {
      try {
        let deletedAny = false;
        let failedToDelete = [];
        const filesToDelete = new Set();
        const targetPattern = `[${id}]`;

        // 1. Yol tabanlı akıllı silme klasör taraması
        if (item.filePath) {
          try {
            const ext = path.extname(item.filePath);
            const baseName = path.basename(item.filePath, ext);
            const dirName = path.dirname(item.filePath);
            
            console.log(`Yol tabanlı akıllı silme bașlatıldı. Klasör: ${dirName}, Dosya öneki: ${baseName}`);
            
            const dirExists = await fs.promises.access(dirName).then(() => true).catch(() => false);
            if (dirExists) {
              const files = await fs.promises.readdir(dirName);
              for (const file of files) {
                if (file === path.basename(item.filePath) || file.startsWith(baseName + '.')) {
                  filesToDelete.add(path.join(dirName, file));
                }
              }
            }
          } catch (pathErr) {
            console.error('[Akıllı Silme Hata]:', pathErr.message);
          }
        }

        // 2. Pattern tabanlı yedek silme klasör taraması
        const folder = db.settings.downloadPath;
        const foldersToSearch = [folder];
        if (item.channelName) {
          foldersToSearch.push(path.join(folder, item.channelName));
        }

        console.log(`Silme ișlemi için aranan klasörler:`, foldersToSearch);

        for (const fld of foldersToSearch) {
          try {
            const dirExists = await fs.promises.access(fld).then(() => true).catch(() => false);
            if (dirExists) {
              const files = await fs.promises.readdir(fld);
              for (const file of files) {
                if (file.includes(targetPattern)) {
                  filesToDelete.add(path.join(fld, file));
                }
              }
            }
          } catch (patternErr) {}
        }

        // Toplanan tüm dosyaları paralel olarak sil
        if (filesToDelete.size > 0) {
          console.log(`Eşleşen toplam ${filesToDelete.size} dosya bulundu, siliniyor...`);
          const deletePromises = Array.from(filesToDelete).map(async (fullPath) => {
            try {
              await fs.promises.unlink(fullPath);
              console.log(`BAŞARI: Dosya silindi: ${path.basename(fullPath)}`);
              deletedAny = true;
            } catch (e) {
              if (e.code !== 'ENOENT') {
                console.error(`HATA: Dosya silinemedi: ${path.basename(fullPath)}`, e.message);
                failedToDelete.push(`${path.basename(fullPath)} (${e.message})`);
              }
            }
          });
          await Promise.all(deletePromises);
        }

        if (failedToDelete.length > 0) {
          const errorMsg = `Video dosyası silinemedi (Dosya kilitli veya açık olabilir): ${failedToDelete.join(', ')}`;
          console.error(`[DELETE ERROR] ${errorMsg}`);
          console.log(`--- SİLME İŞLEMİ BAŞARISIZ ---\n`);
          return res.status(500).json({ error: errorMsg });
        }
        
        if (deletedAny) {
          broadcast('status_log', { message: `İlgili video dosyaları bilgisayarınızdan silindi: ${item.title}`, type: 'info' });
        } else {
          console.log(`BİLGİ: Klasörlerde '${targetPattern}' içeren herhangi bir dosya bulunamadı.`);
        }
      } catch (err) {
        console.error(`[DELETE ERROR] Genel hata: ${err.message}`);
        console.log(`--- SİLME İŞLEMİ BAŞARISIZ ---\n`);
        return res.status(500).json({ error: `Dosya silme hatası: ${err.message}` });
      }
    }

    db.history.splice(itemIndex, 1);

    const hideOnDelete = db.settings && db.settings.hideOnDelete !== false;

    db.history.push({
      id: item.id,
      title: item.title,
      channelId: item.channelId,
      channelName: item.channelName,
      downloadedAt: new Date().toISOString(),
      publishedAt: item.publishedAt || '',
      status: 'ignored',
      progress: 0,
      fileSize: '',
      filePath: '',
      speed: '',
      eta: '',
      duration: item.duration || '',
      hidden: hideOnDelete
    });
    console.log(`BİLGİ: Video '${item.title}' RSS'in tekrar indirmemesi için 'ignored' olarak işaretlendi (Gizleme: ${hideOnDelete}).`);

    await writeDbFast(db);
    broadcast('db_update', db);

    
    const isEn = db.settings && db.settings.lang === 'en';
    let statusMsg = '';
    if (hideOnDelete) {
      statusMsg = isEn ? `Video deleted and hidden from library: ${item.title}` : `Video silindi ve kütüphaneden gizlendi: ${item.title}`;
    } else {
      statusMsg = isEn ? `Video removed from history: ${item.title}` : `Video geçmişten temizlendi: ${item.title}`;
    }
    broadcast('status_log', { message: statusMsg, type: 'success' });
    
    if (markWatched) {
      setTimeout(() => {
        markVideoWatchedOnYouTube(id, item.title, item.duration || '').catch(err => {
          console.error(`[YouTube Watch Sync Error during Delete]`, err.message);
        });
      }, 0);
    }

    console.log(`BAŞARI: Video geçmiş kaydı veri tabanından silindi.`);
    console.log(`--- SİLME İŞLEMİ TAMAMLANDI ---\n`);
    res.json({ success: true });
  } else {
    console.error(`HATA: ID '${id}' video kaydı veri tabanında bulunamadı.`);
    console.log(`--- SİLME İŞLEMİ BAŞARISIZ ---\n`);
    res.status(404).json({ error: 'Video kaydı bulunamadı.' });
  }
});

/**
 * Belirtilen videonun disk üzerindeki dosyalarını siler ve indirme kuyruğuna tekrar ekler (Yeniden İndirme).
 * 
 * @name POST /api/history/:id/redownload
 * @function
 * @inner
 * @param {object} req - Express istek nesnesi
 * @param {string} req.params.id - Yeniden indirilecek videonun YouTube ID'si (11 karakter)
 * @param {object} res - Express yanıt nesnesi
 * @returns {Promise<void>}
 */
router.post('/history/:id/redownload', localhostOnly, async (req, res) => {
  const { id } = req.params;
  if (!/^[a-zA-Z0-9_-]{11}$/.test(id)) {
    return res.status(400).json({ error: 'Geçersiz Video ID formatı.' });
  }

  const db = readDb();
  const item = db.history.find(h => h.id === id);
  if (!item) {
    return res.status(404).json({ error: 'Video geçmişte bulunamadı.' });
  }

  try {
    const targetPattern = `[${id}]`;
    if (item.filePath) {
      const ext = path.extname(item.filePath);
      const baseName = path.basename(item.filePath, ext);
      const dirName = path.dirname(item.filePath);
      if (fs.existsSync(dirName)) {
        const files = fs.readdirSync(dirName);
        for (const file of files) {
          if (file === path.basename(item.filePath) || file.startsWith(baseName + '.')) {
            const fullPath = path.join(dirName, file);
            if (fs.existsSync(fullPath)) {
              try {
                fs.unlinkSync(fullPath);
              } catch (e) {
                console.error(`Tekrar İndir silme hatası: ${file}`, e.message);
              }
            }
          }
        }
      }
    }

    const folder = db.settings.downloadPath;
    const foldersToSearch = [folder];
    if (item.channelName) {
      foldersToSearch.push(path.join(folder, item.channelName));
    }
    for (const fld of foldersToSearch) {
      if (fs.existsSync(fld)) {
        const files = fs.readdirSync(fld);
        for (const file of files) {
          if (file.includes(targetPattern)) {
            const fullPath = path.join(fld, file);
            if (fs.existsSync(fullPath)) {
              try {
                fs.unlinkSync(fullPath);
              } catch (e) {
                if (e.code !== 'ENOENT') {
                  console.error(`Tekrar İndir yedek silme hatası: ${file}`, e.message);
                }
              }
            }
          }
        }
      }
    }
  } catch (err) {
    console.error(`Tekrar İndirme öncesi temizleme hatası:`, err.message);
  }

  await downloadQueue.add({
    id: item.id,
    title: item.title,
    channelId: item.channelId,
    channelName: item.channelName,
    url: `https://www.youtube.com/watch?v=${item.id}`,
    publishedAt: item.publishedAt || ''
  });

  resolveMissingDurations();

  res.json({ success: true, message: 'Video silindi ve tekrar indirilmek üzere kuyruğa eklendi.' });
});

/**
 * Belirtilen videoyu geçmiş/kütüphane arayüz görünümünde gizler.
 * 
 * @name POST /api/history/:id/hide
 * @function
 * @inner
 * @param {object} req - Express istek nesnesi
 * @param {string} req.params.id - Gizlenecek videonun YouTube ID'si (11 karakter)
 * @param {object} res - Express yanıt nesnesi
 * @returns {Promise<void>}
 */
router.post('/history/:id/hide', localhostOnly, async (req, res) => {
  const { id } = req.params;
  if (!/^[a-zA-Z0-9_-]{11}$/.test(id)) {
    return res.status(400).json({ error: 'Geçersiz Video ID formatı.' });
  }

  const release = await acquireDbLock();
  try {
    const db = readDb();
    const items = db.history.filter(h => h.id === id);
    if (items.length === 0) {
      return res.status(404).json({ error: 'Video geçmişte bulunamadı.' });
    }

    items.forEach(item => { item.hidden = true; });
    writeDb(db);
    
    broadcast('db_update', readDb());
    res.json({ success: true, message: 'Video kütüphaneden gizlendi.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    release();
  }
});

/**
 * Birden fazla videoyu geçmiş/kütüphane arayüz görünümünde toplu olarak gizler.
 * 
 * @name POST /api/history/bulk-hide
 * @function
 * @inner
 * @param {object} req - Express istek nesnesi
 * @param {string[]} req.body.ids - Gizlenecek videoların YouTube ID listesi
 * @param {object} res - Express yanıt nesnesi
 * @returns {Promise<void>}
 */
router.post('/history/bulk-hide', localhostOnly, async (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'Geçersiz veya boş video ID listesi.' });
  }

  // Validate all IDs
  for (const id of ids) {
    if (!/^[a-zA-Z0-9_-]{11}$/.test(id)) {
      return res.status(400).json({ error: `Geçersiz Video ID formatı: ${id}` });
    }
  }

  const release = await acquireDbLock();
  try {
    const db = readDb();
    let hiddenCount = 0;

    for (const id of ids) {
      const items = db.history.filter(h => h.id === id);
      if (items.length > 0) {
        items.forEach(item => { item.hidden = true; });
        hiddenCount++;
      }
    }

    if (hiddenCount > 0) {
      writeDb(db);
      broadcast('db_update', readDb());
    }

    res.json({ success: true, message: `${hiddenCount} video kütüphaneden gizlendi.`, count: hiddenCount });
  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    release();
  }
});

/**
 * Gizlenmiş olan bir videoyu geçmiş/kütüphane arayüzünde tekrar görünür kılar.
 * 
 * @name POST /api/history/:id/unhide
 * @function
 * @inner
 * @param {object} req - Express istek nesnesi
 * @param {string} req.params.id - Görünür yapılacak videonun YouTube ID'si (11 karakter)
 * @param {object} res - Express yanıt nesnesi
 * @returns {Promise<void>}
 */
router.post('/history/:id/unhide', localhostOnly, async (req, res) => {
  const { id } = req.params;
  if (!/^[a-zA-Z0-9_-]{11}$/.test(id)) {
    return res.status(400).json({ error: 'Geçersiz Video ID formatı.' });
  }

  const release = await acquireDbLock();
  try {
    const db = readDb();
    const items = db.history.filter(h => h.id === id);
    if (items.length === 0) {
      return res.status(404).json({ error: 'Video geçmişte bulunamadı.' });
    }

    items.forEach(item => { item.hidden = false; });
    writeDb(db);
    
    broadcast('db_update', readDb());
    res.json({ success: true, message: 'Video kütüphanede görünür yapıldı.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    release();
  }
});

/**
 * Türkçe Açıklama: Seçilen birden fazla videoyu diskteki dosyalarıyla birlikte veritabanından toplu olarak siler ve durumlarını 'ignored' yapar.
 * 
 * @name POST /api/history/bulk-delete
 * @path {POST} /api/history/bulk-delete
 * @auth localhostOnly
 * @body {Array<string>} ids Silinecek video ID'lerinin listesi
 * @body {boolean} deleteFiles Bilgisayardaki fiziksel dosyaların da silinip silinmeyeceği
 * @returns {Promise<void>}
 */
router.post('/history/bulk-delete', localhostOnly, async (req, res) => {
  const { ids, deleteFiles } = req.body;
  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'Silinecek video ID listesi geçersiz.' });
  }

  const release = await acquireDbLock();
  try {
    const db = readDb();
    let deletedCount = 0;
    const hideOnDelete = db.settings && db.settings.hideOnDelete !== false;

    for (const id of ids) {
      const itemIndex = db.history.findIndex(h => h.id === id);
      if (itemIndex === -1) continue;

      const item = db.history[itemIndex];

      if (deleteFiles) {
        const filesToDelete = new Set();
        const targetPattern = `[${id}]`;

        // Yol tabanlı akıllı silme
        if (item.filePath) {
          try {
            const ext = path.extname(item.filePath);
            const baseName = path.basename(item.filePath, ext);
            const dirName = path.dirname(item.filePath);
            const dirExists = await fs.promises.access(dirName).then(() => true).catch(() => false);
            if (dirExists) {
              const files = await fs.promises.readdir(dirName);
              for (const file of files) {
                if (file === path.basename(item.filePath) || file.startsWith(baseName + '.')) {
                  filesToDelete.add(path.join(dirName, file));
                }
              }
            }
          } catch (e) {
            console.error(`[Bulk Delete File Error]: ${e.message}`);
          }
        }

        // Pattern tabanlı yedek silme
        try {
          const folder = db.settings.downloadPath;
          const foldersToSearch = [folder];
          if (item.channelName) {
            foldersToSearch.push(path.join(folder, item.channelName));
          }
          for (const fld of foldersToSearch) {
            const dirExists = await fs.promises.access(fld).then(() => true).catch(() => false);
            if (dirExists) {
              const files = await fs.promises.readdir(fld);
              for (const file of files) {
                if (file.includes(targetPattern)) {
                  filesToDelete.add(path.join(fld, file));
                }
              }
            }
          }
        } catch (patternErr) {
          console.error(`[Bulk Delete Pattern Error]: ${patternErr.message}`);
        }

        // Toplanan dosyaları sil
        if (filesToDelete.size > 0) {
          const deletePromises = Array.from(filesToDelete).map(async (fullPath) => {
            try {
              await fs.promises.unlink(fullPath);
            } catch (e) {}
          });
          await Promise.all(deletePromises);
        }
      }

      // Geçmiş kaydını kaldır ve 'ignored' olarak geri ekle (RSS tekrar indirmesin diye)
      db.history.splice(itemIndex, 1);
      db.history.push({
        id: item.id,
        title: item.title,
        channelId: item.channelId,
        channelName: item.channelName,
        downloadedAt: new Date().toISOString(),
        publishedAt: item.publishedAt || '',
        status: 'ignored',
        progress: 0,
        fileSize: '',
        filePath: '',
        speed: '',
        eta: '',
        duration: item.duration || '',
        hidden: hideOnDelete
      });
      deletedCount++;
    }

    if (deletedCount > 0) {
      await writeDbFast(db);
      broadcast('db_update', db);
      const isEn = db.settings && db.settings.lang === 'en';
      const statusMsg = isEn 
        ? `Successfully deleted ${deletedCount} videos.` 
        : `${deletedCount} adet video başarıyla silindi.`;
      broadcast('status_log', { message: statusMsg, type: 'success' });
    }

    res.json({ success: true, deletedCount });
  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    release();
  }
});

let isMetadataRefreshing = false;

/**
 * Veritabanındaki tüm videoların eksik olan süre ve dosya boyutu bilgilerini yeniler.
 */
router.post('/tools/refresh-metadata', localhostOnly, async (req, res) => {
  if (isMetadataRefreshing) {
    return res.status(400).json({ error: 'Metadata yenileme işlemi zaten arka planda çalışıyor.' });
  }

  isMetadataRefreshing = true;

  // Arka planda çalışacak asenkron fonksiyon
  (async () => {
    try {
      addTerminalLog('[Metadata] İndirilen videolar için metadata güncelleme taraması başlatılıyor...', 'info');
      broadcast('status_log', { message: 'İndirilen videolar için metadata güncelleme başlatıldı...', type: 'info' });

      // 1. Veritabanını oku (Sadece tamamlanmış/indirilmiş videolar)
      const db = readDb();
      const downloadedItems = (db.history || []).filter(item => item.status === 'completed');
      let updatedCount = 0;
      let totalToProcess = downloadedItems.length;

      addTerminalLog(`[Metadata] İndirilenler sekmesinde taranacak toplam video sayısı: ${totalToProcess}`, 'info');

      let processedCount = 0;

      // 2. Sadece indirilmiş videoları sırayla tara ve güncelle
      for (const item of downloadedItems) {
        processedCount++;
        let itemUpdated = false;
        const needsDuration = !item.duration || item.duration === '-' || item.duration === 'unknown';

        // Dosya Boyutu Kontrolü (Diskteki fiziki dosyadan boyutu oku ve karşılaştır)
        if (item.filePath) {
          try {
            if (fs.existsSync(item.filePath)) {
              const stats = fs.statSync(item.filePath);
              const sizeInBytes = stats.size;
              let calculatedSize = '';
              if (sizeInBytes >= 1024 * 1024 * 1024) {
                calculatedSize = (sizeInBytes / (1024 * 1024 * 1024)).toFixed(1) + ' GB';
              } else {
                calculatedSize = Math.round(sizeInBytes / (1024 * 1024)) + ' MB';
              }
              if (item.fileSize !== calculatedSize) {
                item.fileSize = calculatedSize;
                itemUpdated = true;
              }
              if (item.fileMissing === true) {
                item.fileMissing = false;
                itemUpdated = true;
              }
            } else if (item.fileMissing !== true) {
              item.fileMissing = true;
              itemUpdated = true;
            }
          } catch (err) {
            console.error(`[Metadata] Boyut okunurken hata (${item.title}):`, err.message);
          }
        }

        // Süre Kontrolü (Eksik veya '-' / 'unknown' olan süresiz videoları tamamla)
        if (needsDuration) {
          try {
            if (item.resolveAttempts) {
              item.resolveAttempts = 0;
            }
            const result = await fetchVideoDuration(item.id);
            let duration = result ? result.duration : '';
            
            if (!duration) {
              duration = await fetchDurationViaYtdlp(item.id);
            }

            if (duration) {
              if (duration === 'live' && (item.duration !== 'live' || item.status !== 'live')) {
                item.duration = 'live';
                item.status = 'live';
                itemUpdated = true;
              } else if (duration !== 'upcoming' && duration !== 'live') {
                item.duration = duration;
                if (item.status === 'upcoming' || item.status === 'live') {
                  item.status = 'waiting';
                }
                itemUpdated = true;
              }
            }
          } catch (err) {
            console.error(`[Metadata] Süre yenilenirken hata (${item.title}):`, err.message);
          }
        }

        if (itemUpdated) {
          updatedCount++;
          
          // Değişikliği veritabanına kaydet ve bildir
          const releaseWrite = await acquireDbLock();
          try {
            const finalDb = readDb();
            const originalItem = finalDb.history.find(h => h.id === item.id);
            if (originalItem) {
              originalItem.duration = item.duration;
              originalItem.fileSize = item.fileSize;
              originalItem.fileMissing = item.fileMissing;
            }
            writeDb(finalDb);
            broadcast('db_update', finalDb);
          } finally {
            releaseWrite();
          }

          addTerminalLog(`[Metadata] Güncellendi: "${item.title}" -> Süre: ${item.duration || '-'}, Boyut: ${item.fileSize || '-'}`, 'success');
        }

        if (processedCount % 5 === 0 || processedCount === totalToProcess) {
          addTerminalLog(`[Metadata] İndirilen videolar taranıyor (${processedCount}/${totalToProcess}): "${(item.title || '-').substring(0, 50)}"`, 'info');
          broadcast('status_log', { message: `Metadata güncelleme: ${processedCount}/${totalToProcess} indirilen video tarandı.`, type: 'info' });
        }
      }

      const successMsg = `Metadata taraması tamamlandı. Toplam ${totalToProcess} indirilen video tarandı, ${updatedCount} adet güncelleme yapıldı.`;
      addTerminalLog(`[Metadata] ${successMsg}`, 'success');
      broadcast('status_log', { message: successMsg, type: 'success' });
    } catch (bgErr) {
      addTerminalLog(`[Metadata] [HATA] Arka plan yenileme başarısız: ${bgErr.message}`, 'error');
    } finally {
      isMetadataRefreshing = false;
    }
  })();

  res.json({ success: true, message: 'İndirilen videoların metadata taraması arka planda başlatıldı.' });
});

