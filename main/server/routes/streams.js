// Türkçe Açıklama: Video oynatma (HTTP 206 akışı), video kapağı (thumbnail), altyazı listeleme/okuma, otomatik Google Translate altyazı çevirisi, YouTube yorumları çekme ve YouTube'u tarayıcıda açma API rotaları modülü.
import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import open from 'open';
import dns from 'dns';
import { spawn, execFile, exec } from 'child_process';
import { ytdlpPath, getLocalTempDir, cleanMeiForPid, spawnYtdlp, getFfmpegPath } from '../services/paths.js';
import { updateChannelFullInfo } from './channels.js';
import { getCookieArgs } from '../services/downloader.js';
import { writeDb } from '../database.js';
import { broadcast } from '../services/sse.js';
import { readDb, findVideoFileInDownloadDir } from '../database.js';
import { localhostOnly } from '../middleware/security.js';
import { generateVideoSummary, generateCommentsSummary, getLmStudioModels, checkLlamaEngineStatus, downloadAndInstallLlamaEngine, scanGgufModels, stopLlamaEngine, startRecommendedModelDownload, getRecommendedModelDownloadStatus, cancelRecommendedModelDownload } from '../services/aiSummary.js';
import { getTtsStatus, downloadPiperEngine, downloadPiperVoice, speakText, stopTtsEngine, VOICE_CATALOG, getTtsCacheDir } from '../services/tts.js';
import { extractStreamFromUrl } from '../services/streamExtractor.js';

export const router = express.Router();

let cachedYoutubeApiKey = null;

// Aktif video oynatma akışlarını (streams) takip eden harita: videoId -> Set<{ req, res }>
const activeVideoStreams = new Map();

/**
 * Belirtilen video ID'sine ait tüm aktif video oynatma HTTP akışlarını ve dosya tanıtıcılarını derhal sonlandırır.
 * Dosya silinmeden önce dosya kilidini serbest bırakmak için kullanılır.
 * 
 * @param {string} videoId - Hedef video ID'si
 */
export function closeActiveVideoStreams(videoId) {
  if (!videoId) return;
  const streams = activeVideoStreams.get(videoId);
  if (streams && streams.size > 0) {
    console.log(`[Stream] Video ID '${videoId}' için ${streams.size} aktif oynatma akışı zorla sonlandırılıyor.`);
    for (const item of streams) {
      try {
        if (item.res && !item.res.destroyed) {
          item.res.setHeader('Connection', 'close');
          item.res.destroy();
        }
        if (item.req && !item.req.destroyed) {
          item.req.destroy();
        }
      } catch (e) {
        console.error(`[Stream Kapatma Hata]:`, e.message);
      }
    }
    activeVideoStreams.delete(videoId);
  }
}

/**
 * Belirtilen videonun aktif akışlarını kapatmak için istemci uç noktası.
 * 
 * @name POST /api/video-stream/close
 */
router.post('/video-stream/close', localhostOnly, (req, res) => {
  const videoId = req.query.videoId || req.body?.videoId;
  if (videoId) {
    closeActiveVideoStreams(videoId);
  }
  res.json({ success: true });
});

/**
 * İstemciye gömülü video oynatıcı (embed player) için video dosyasını akış (stream) olarak sunar.
 * 
 * @name GET /api/video-stream
 * @function
 * @inner
 * @param {object} req - Express istek nesnesi
 * @param {string} req.query.videoId - Hedef videonun YouTube ID'si (11 karakter)
 * @param {object} res - Express yanıt nesnesi
 * @returns {void}
 */
router.get('/video-stream', localhostOnly, (req, res) => {
  const rawId = req.query.videoId;
  if (!rawId) return res.status(400).send('Video ID is required');
  const videoId = String(rawId).replace(/^fakap_/, '');
  if (!/^[a-zA-Z0-9_-]{11,64}$/.test(videoId)) {
    return res.status(400).send('Invalid Video ID format');
  }

  const db = readDb();
  const item = db.history.find(h => h.id === rawId || h.id === videoId);
  let fileToPlay = item ? item.filePath : null;

  if (!fileToPlay || !fs.existsSync(fileToPlay)) {
    fileToPlay = findVideoFileInDownloadDir(videoId, db.settings.downloadPath);
  }

  if (fileToPlay && fs.existsSync(fileToPlay)) {
    console.log(`[Stream] Video akıtılıyor: ${fileToPlay}`);

    // Aktif akış kaydı oluştur (silme anında kilidin hemen serbest bırakılması için)
    if (!activeVideoStreams.has(videoId)) {
      activeVideoStreams.set(videoId, new Set());
    }
    const streamSet = activeVideoStreams.get(videoId);
    const streamItem = { req, res };
    streamSet.add(streamItem);

    const cleanupStream = () => {
      streamSet.delete(streamItem);
      if (streamSet.size === 0) {
        activeVideoStreams.delete(videoId);
      }
    };

    req.on('close', cleanupStream);
    res.on('finish', cleanupStream);
    res.on('close', cleanupStream);
    res.on('error', cleanupStream);

    res.sendFile(path.resolve(fileToPlay));
  } else {
    console.error(`[Stream Hata] Dosya bulunamadı. ID: ${videoId}`);
    res.status(404).send('Video dosyası bulunamadı.');
  }
});

/**
 * Belirtilen videonun yerel diskteki kapak resmini (thumbnail) sunar. Yerelde yoksa YouTube API'sine yönlendirir.
 * 
 * @name GET /api/video/:videoId/thumbnail
 * @function
 * @inner
 * @param {object} req - Express istek nesnesi
 * @param {string} req.params.videoId - Hedef videonun YouTube ID'si (11 karakter)
 * @param {object} res - Express yanıt nesnesi
 * @returns {void}
 */
const PLATFORM_SVG_BANNERS = {
  tiktok: `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180" viewBox="0 0 320 180"><rect width="320" height="180" fill="#010101"/><g transform="translate(136, 66) scale(2)" fill="#ffffff"><path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64c.298-.002.595.042.88.13V9.4a6.33 6.33 0 0 0-1-.08A6.34 6.34 0 0 0 3 15.66a6.34 6.34 0 0 0 10.86 4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-.04-4.52z"/></g></svg>`,
  x: `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180" viewBox="0 0 320 180"><rect width="320" height="180" fill="#0b0e14"/><g transform="translate(136, 66) scale(2)" fill="#ffffff"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></g></svg>`,
  instagram: `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180" viewBox="0 0 320 180"><defs><linearGradient id="ig" x1="0%" y1="100%" x2="100%" y2="0%"><stop offset="0%" stop-color="#f09433"/><stop offset="25%" stop-color="#e6683c"/><stop offset="50%" stop-color="#dc2743"/><stop offset="75%" stop-color="#cc2366"/><stop offset="100%" stop-color="#bc1888"/></linearGradient></defs><rect width="320" height="180" fill="url(#ig)"/><g transform="translate(136, 66) scale(2)" fill="#ffffff"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></g></svg>`,
  youtube: `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180" viewBox="0 0 320 180"><rect width="320" height="180" fill="#0f0f13"/><g transform="translate(136, 66) scale(2)" fill="#ff0000"><path d="M23.498 6.163a3.003 3.003 0 0 0-2.11-2.11C19.517 3.545 12 3.545 12 3.545s-7.516 0-9.388.508a3.003 3.003 0 0 0-2.11 2.11C0 8.033 0 12 0 12s0 3.967.502 5.837a3.003 3.003 0 0 0 2.11 2.11c1.872.508 9.388.508 9.388.508s7.517 0 9.388-.508a3.003 3.003 0 0 0 2.11-2.11C24 15.967 24 12 24 12s0-3.967-.502-5.837zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></g></svg>`,
  iptv: `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180" viewBox="0 0 320 180"><defs><linearGradient id="iptvgrad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#0284c7"/><stop offset="100%" stop-color="#4f46e5"/></linearGradient></defs><rect width="320" height="180" fill="url(#iptvgrad)"/><g transform="translate(136, 66) scale(2)" stroke="#ffffff" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="15" rx="2" ry="2"/><polyline points="17 2 12 7 7 2"/></g></svg>`
};

router.get('/video/:videoId/thumbnail', localhostOnly, (req, res) => {
  const rawId = req.params.videoId;
  const videoId = String(rawId).replace(/^fakap_/, '');

  const db = readDb();
  let item = db.history.find(h => h.id === rawId || h.id === videoId);
  if (!item && db.queue) {
    item = db.queue.find(q => q.id === rawId || q.id === videoId);
  }

  let filePath = item?.filePath;
  if (!filePath || !fs.existsSync(filePath)) {
    filePath = findVideoFileInDownloadDir(videoId, db.settings?.downloadPath);
  }

  if (filePath && fs.existsSync(filePath)) {
    try {
      const ext = path.extname(filePath);
      const basePath = filePath.slice(0, -ext.length);

      const possibleExtensions = ['.jpg', '.jpeg', '.webp', '.png'];
      for (const tExt of possibleExtensions) {
        const thumbPath = basePath + tExt;
        if (fs.existsSync(thumbPath)) {
          return res.sendFile(thumbPath);
        }
      }

      // Eğer diskte hazır kapak resmi yoksa ve video dosyası mevcutsa, FFmpeg ile 2. saniyeden kare çıkar
      const outJpg = basePath + '.jpg';
      const ffmpegBin = getFfmpegPath();
      if (fs.existsSync(ffmpegBin)) {
        try {
          execFile(ffmpegBin, [
            '-y',
            '-ss', '00:00:02',
            '-i', filePath,
            '-vframes', '1',
            '-q:v', '2',
            outJpg
          ], (err) => {
            if (!err && fs.existsSync(outJpg)) {
              return res.sendFile(outJpg);
            }
            finishFallback();
          });
          return;
        } catch (eFf) {
          // fallback
        }
      }
    } catch (err) {
      console.error(`Error reading thumbnail for ${videoId}:`, err.message);
    }
  }

  function finishFallback() {
    if (item && item.thumbnail && item.thumbnail.startsWith('http')) {
      return res.redirect(item.thumbnail);
    }

    if (/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
      return res.redirect(`https://img.youtube.com/vi/${videoId}/mqdefault.jpg`);
    }

    let platform = item?.platform;
    if (!platform && item) {
      const u = (item.webUrl || item.url || '').toLowerCase();
      if (u.includes('tiktok.com')) platform = 'tiktok';
      else if (u.includes('twitter.com') || u.includes('x.com')) platform = 'x';
      else if (u.includes('instagram.com')) platform = 'instagram';
    }

    if (platform && PLATFORM_SVG_BANNERS[platform]) {
      res.setHeader('Content-Type', 'image/svg+xml');
      return res.send(PLATFORM_SVG_BANNERS[platform]);
    }

    res.redirect('/logo.png');
  }

  finishFallback();
});

/**
 * Belirtilen videonun alternatif kapak resimleri URL listesini ve DeArrow karelerini döner.
 * 
 * @name GET /api/video/:videoId/alt-thumbnails
 * @function
 * @inner
 * @param {object} req - Express istek nesnesi
 * @param {string} req.params.videoId - Hedef videonun YouTube ID'si (11 karakter)
 * @param {object} res - Express yanıt nesnesi
 * @returns {void}
 */
router.get('/video/:videoId/alt-thumbnails', (req, res) => {
  const { videoId } = req.params;
  if (!/^[a-zA-Z0-9_-]{11,64}$/.test(videoId)) {
    return res.status(400).json({ error: 'Invalid Video ID format' });
  }

  const thumbnails = [
    `/api/video/${videoId}/thumbnail`,
    `https://img.youtube.com/vi/${videoId}/1.jpg`,
    `https://img.youtube.com/vi/${videoId}/2.jpg`,
    `https://img.youtube.com/vi/${videoId}/3.jpg`
  ];

  res.json({ videoId, thumbnails });
});

/**
 * İndirilmiş olan videonun .description dosyasından açıklama metnini okur ve döner.
 * 
 * @name GET /api/video/:videoId/description
 * @function
 * @inner
 * @param {object} req - Express istek nesnesi
 * @param {string} req.params.videoId - Hedef videonun YouTube ID'si (11 karakter)
 * @param {object} res - Express yanıt nesnesi
 * @returns {void}
 */
router.get('/video/:videoId/description', (req, res) => {
  const { videoId } = req.params;
  if (!/^[a-zA-Z0-9_-]{11,64}$/.test(videoId)) {
    return res.status(400).send('Invalid Video ID format');
  }

  const db = readDb();
  const item = db.history.find(h => h.id === videoId);
  
  try {
    if (item && item.filePath) {
      const ext = path.extname(item.filePath);
      const basePath = item.filePath.slice(0, -ext.length);
      const descPath = basePath + '.description';
      if (fs.existsSync(descPath)) {
        const descText = fs.readFileSync(descPath, 'utf8');
        return res.json({ success: true, description: descText });
      }
    }
  } catch (err) {
    console.error(`Error reading description for ${videoId}:`, err.message);
  }

  return res.json({ success: true, description: '' });
});

function fetchDescriptionFromYtdlp(videoId) {
  return new Promise((resolve, reject) => {
    let db;
    try { db = readDb(); } catch(e) { db = {}; }
    const settings = db.settings || {};
    const cookieArgs = typeof getCookieArgs === 'function' ? getCookieArgs(settings) : [];

    const args = [
      '--encoding', 'utf-8',
      '--no-playlist',
      ...cookieArgs,
      '--get-description',
      `https://www.youtube.com/watch?v=${videoId}`
    ];
    
    // Windows ve diğer platformlarda UTF-8 kodlamasını garanti altına al
    const localTemp = getLocalTempDir();
    const spawnOptions = {
      env: { ...process.env, PYTHONIOENCODING: 'utf-8', LANG: 'en_US.UTF-8', TEMP: localTemp, TMP: localTemp }
    };
    if (process.platform === 'win32') {
      spawnOptions.windowsVerbatimArguments = false;
      spawnOptions.windowsHide = true;
    }

    const proc = spawnYtdlp(args, spawnOptions);

    const stdoutChunks = [];
    const stderrChunks = [];

    proc.stdout.on('data', (data) => {
      stdoutChunks.push(data);
    });

    proc.stderr.on('data', (data) => {
      stderrChunks.push(data);
    });

    proc.on('close', (code) => {
      cleanMeiForPid(proc.pid);
      const stdoutStr = Buffer.concat(stdoutChunks).toString('utf8');
      const stderrStr = Buffer.concat(stderrChunks).toString('utf8');
      
      if (code === 0) {
        resolve(stdoutStr.trim());
      } else {
        reject(new Error(stderrStr.trim() || `Exit code ${code}`));
      }
    });
  });
}

/**
 * Belirtilen video için açıklama dosyasını ve yorumlarını YouTube'dan tazeleyip günceller.
 * 
 * @name POST /api/video/:videoId/refresh-details
 */
router.post('/video/:videoId/refresh-details', localhostOnly, async (req, res) => {
  const { videoId } = req.params;
  if (!/^[a-zA-Z0-9_-]{11,64}$/.test(videoId)) {
    return res.status(400).json({ error: 'Geçersiz Video ID formatı' });
  }

  try {
    const db = readDb();
    const item = db.history.find(h => h.id === videoId || h.originalId === videoId);

    // 1. YouTube'dan güncel açıklamayı çek
    let updatedDesc = '';
    try {
      updatedDesc = await fetchDescriptionFromYtdlp(videoId);
    } catch (e) {
      console.warn(`[Refresh Details] Description fetch warning for ${videoId}:`, e.message);
    }

    // .description dosyasını diske kaydet
    if (item && item.filePath && updatedDesc) {
      try {
        const ext = path.extname(item.filePath);
        const basePath = item.filePath.slice(0, -ext.length);
        const descPath = basePath + '.description';
        await fs.promises.writeFile(descPath, updatedDesc, 'utf8');
      } catch (e) {}
    }

    // 2. Güncel İzlenme Sayısını Çek (RYD API)
    let latestViews = (item && item.viewCount) || 0;
    try {
      const rydRes = await fetch(`https://returnyoutubedislikeapi.com/votes?videoId=${encodeURIComponent(videoId)}`, {
        headers: { 'User-Agent': 'HaYTooL-YT-Downloader/1.0' }
      });
      if (rydRes.ok) {
        const rydData = await rydRes.json();
        if (rydData && rydData.viewCount) {
          latestViews = rydData.viewCount;
          if (item) item.viewCount = latestViews;
        }
      }
    } catch (e) {}

    // 3. Kanal Abone Sayısını Güncelle
    let updatedChannel = null;
    let targetChannelId = item ? item.channelId : null;
    let targetChannelName = item ? item.channelName : null;

    if (db.channels && db.channels.length > 0) {
      let channel = db.channels.find(c => (targetChannelId && c.id === targetChannelId) || (targetChannelName && c.name === targetChannelName));
      if (channel) {
        try {
          await updateChannelFullInfo(channel);
          updatedChannel = channel;
        } catch (err) {
          console.warn(`[Refresh Details] Channel update warning for ${channel.name}:`, err.message);
        }
      }
    }

    writeDb(db);
    broadcast('db_update', db);

    res.json({
      success: true,
      description: updatedDesc,
      viewCount: latestViews,
      channelId: updatedChannel ? updatedChannel.id : targetChannelId,
      channelName: updatedChannel ? updatedChannel.name : targetChannelName,
      subscriberCount: updatedChannel ? updatedChannel.subscriberCount : null
    });
  } catch (err) {
    console.error(`Error refreshing description/comments for ${videoId}:`, err.message);
    res.status(500).json({ error: `Detaylar güncellenemedi: ${err.message}` });
  }
});

/**
 * Belirtilen video için indirilmiş altyazı dosyalarını arar ve listeler.
 * 
 * @name GET /api/video/:videoId/subtitles
 * @function
 * @inner
 * @param {object} req - Express istek nesnesi
 * @param {string} req.params.videoId - Hedef videonun YouTube ID'si (11 karakter)
 * @param {object} res - Express yanıt nesnesi
 * @returns {void}
 */
router.get('/video/:videoId/subtitles', (req, res) => {
  const { videoId } = req.params;
  const db = readDb();
  const video = db.history.find(h => h.id === videoId || h.originalId === videoId);
  
  if (!video || !video.filePath) {
    return res.json({ success: true, subtitles: [] });
  }

  const subtitles = [];
  try {
    const filePath = video.filePath;
    const dir = path.dirname(filePath);
    const fileNameWithoutExt = path.basename(filePath, path.extname(filePath));

    if (fs.existsSync(dir)) {
      const files = fs.readdirSync(dir);
      const escapedName = fileNameWithoutExt.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const subRegex = new RegExp(`^${escapedName}\\.([a-zA-Z0-9_-]+)\\.(srt|vtt)$`, 'i');
      const fallbackRegex = new RegExp(`\\[${videoId}\\]\\.([a-zA-Z0-9_-]+)\\.(srt|vtt)$`, 'i');

      const foundLangs = new Set();
      for (const file of files) {
        let match = file.match(subRegex);
        if (!match) {
          match = file.match(fallbackRegex);
        }

        if (match) {
          const langCode = match[1].toLowerCase();
          const ext = match[2].toLowerCase();

          if (!foundLangs.has(langCode)) {
            foundLangs.add(langCode);
            const baseLang = langCode.split(/[-_]/)[0];
            let label = langCode.toUpperCase();
            try {
              const displayNames = new Intl.DisplayNames(['tr', 'en'], { type: 'language' });
              const name = displayNames.of(baseLang);
              if (name) {
                label = name.charAt(0).toUpperCase() + name.slice(1);
                if (langCode.includes('orig')) {
                  label += ' (Orijinal)';
                }
              }
            } catch (e) {
              const staticMap = {
                tr: 'Türkçe', en: 'English', ar: 'Arapça', de: 'Almanca',
                es: 'İspanyolca', fr: 'Fransızca', ru: 'Rusça', ja: 'Japonca',
                pt: 'Portekizce', it: 'İtalyanca', zh: 'Çince', ko: 'Korece'
              };
              if (staticMap[baseLang]) {
                label = staticMap[baseLang] + (langCode.includes('orig') ? ' (Orijinal)' : '');
              }
            }

            subtitles.push({
              lang: langCode,
              label: label,
              ext: ext,
              url: `/api/video/${videoId}/subtitle/${langCode}`
            });
          }
        }
      }
    }
  } catch (err) {
    console.error('[Get Subtitles Error]:', err.message);
  }

  res.json({ success: true, subtitles });
});

/**
 * Google Translate API kullanarak tek bir metin satırını çevirir.
 * 
 * @param {string} text - Çevrilecek metin içeriği
 * @param {string} [fromLang='en'] - Kaynak dil kodu
 * @param {string} [toLang='tr'] - Hedef dil kodu
 * @returns {Promise<string>} Çevrilmiş metin veya hata durumunda orijinal metin
 */
async function translateText(text, fromLang = 'en', toLang = 'tr') {
  if (!text || !text.trim()) return '';
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${fromLang}&tl=${toLang}&dt=t&q=${encodeURIComponent(text)}`;
  try {
    const res = await fetch(url);
    const json = await res.json();
    if (json && json[0]) {
      return json[0].map(item => item[0]).join('');
    }
  } catch (err) {
    console.error('[Translate API Error]:', err.message);
  }
  return text;
}

/**
 * SRT veya WebVTT altyazı dosyasının içeriğini zaman damgalarını koruyarak satır satır çevirir.
 * 
 * @param {string} content - Altyazı dosyasının tüm metin içeriği
 * @param {boolean} [isVtt=false] - WebVTT formatında olup olmadığı
 * @param {string} [fromLang='en'] - Kaynak dil kodu
 * @param {string} [toLang='tr'] - Hedef dil kodu
 * @returns {Promise<string>} Çevrilmiş altyazı içeriği
 */
async function translateSrtOrVttContent(content, isVtt = false, fromLang = 'en', toLang = 'tr') {
  const lines = content.split(/\r?\n/);
  const resultLines = [];
  const translateQueue = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    if (
      line === '' ||
      /^\d+$/.test(line) ||
      line.includes('-->') ||
      line.startsWith('WEBVTT') ||
      line.startsWith('NOTE') ||
      line.startsWith('STYLE') ||
      line.startsWith('REGION')
    ) {
      resultLines.push({ type: 'copy', content: lines[i] });
    } else {
      resultLines.push({ type: 'translate', content: lines[i], index: translateQueue.length });
      translateQueue.push(lines[i]);
    }
  }

  const batchSize = 15;
  const translatedTexts = new Array(translateQueue.length);

  for (let i = 0; i < translateQueue.length; i += batchSize) {
    const batch = translateQueue.slice(i, i + batchSize);
    const promises = batch.map(async (text, batchIndex) => {
      const globalIndex = i + batchIndex;
      const translated = await translateText(text, fromLang, toLang);
      translatedTexts[globalIndex] = translated;
    });
    await Promise.all(promises);
    await new Promise(resolve => setTimeout(resolve, 50));
  }

  const outputLines = resultLines.map(line => {
    if (line.type === 'copy') {
      return line.content;
    } else {
      return translatedTexts[line.index] || line.content;
    }
  });

  return outputLines.join('\n');
}

/**
 * Videoya ait belirli bir dil kodundaki altyazı dosyasını diskte bulur.
 * Hem tam dosya adı hem de [videoId] etiketi üzerinden .vtt veya .srt arar.
 * 
 * @param {string} filePath - Videonun yerel dosya yolu
 * @param {string} videoId - YouTube video ID
 * @param {string} lang - Dil kodu (örn: 'tr', 'en', 'tr-orig')
 * @returns {{ path: string, isVtt: boolean } | null}
 */
function findSubtitleFile(filePath, videoId, lang) {
  const dir = path.dirname(filePath);
  const ext = path.extname(filePath);
  const basePath = filePath.slice(0, -ext.length);

  const exactVtt = basePath + `.${lang}.vtt`;
  const exactSrt = basePath + `.${lang}.srt`;
  if (fs.existsSync(exactVtt)) return { path: exactVtt, isVtt: true };
  if (fs.existsSync(exactSrt)) return { path: exactSrt, isVtt: false };

  // Dizin tarayarak esnek eşleme
  if (fs.existsSync(dir)) {
    const files = fs.readdirSync(dir);
    const escapedLang = lang.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const fileNameWithoutExt = path.basename(filePath, ext);
    const escapedName = fileNameWithoutExt.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    const exactMatch = files.find(f => 
      new RegExp(`^${escapedName}\\.${escapedLang}\\.(vtt|srt)$`, 'i').test(f)
    );
    if (exactMatch) {
      const full = path.join(dir, exactMatch);
      return { path: full, isVtt: exactMatch.toLowerCase().endsWith('.vtt') };
    }

    const fallbackMatch = files.find(f => 
      new RegExp(`\\[${videoId}\\]\\.${escapedLang}\\.(vtt|srt)$`, 'i').test(f)
    );
    if (fallbackMatch) {
      const full = path.join(dir, fallbackMatch);
      return { path: full, isVtt: fallbackMatch.toLowerCase().endsWith('.vtt') };
    }
  }

  return null;
}

/**
 * Belirtilen videonun altyazısını Google Translate aracılığıyla kaynak dilden hedef dile çevirip kaydeder.
 * 
 * @name POST /api/video/:videoId/translate-subtitle
 * @function
 * @inner
 * @param {object} req - Express istek nesnesi
 * @param {string} req.params.videoId - Hedef videonun YouTube ID'si (11 karakter)
 * @param {string} req.body.fromLang - Kaynak dil kodu (örn. 'en')
 * @param {string} req.body.toLang - Hedef dil kodu (örn. 'tr')
 * @param {object} res - Express yanıt nesnesi
 * @returns {Promise<void>}
 */
router.post('/video/:videoId/translate-subtitle', localhostOnly, async (req, res) => {
  const { videoId } = req.params;
  const { fromLang, toLang } = req.body;
  const db = readDb();
  const video = db.history.find(h => h.id === videoId || h.originalId === videoId);

  if (!video || !video.filePath) {
    return res.status(404).json({ success: false, error: 'Video veya dosya konumu bulunamadı.' });
  }

  if (!fromLang || !toLang) {
    return res.status(400).json({ success: false, error: 'Kaynak dil (fromLang) ve hedef dil (toLang) belirtilmelidir.' });
  }

  try {
    const filePath = video.filePath;
    const ext = path.extname(filePath);
    const basePath = filePath.slice(0, -ext.length);

    const sourceFile = findSubtitleFile(filePath, videoId, fromLang);
    if (!sourceFile) {
      return res.status(400).json({ success: false, error: `Çevrilecek (${fromLang}) altyazı dosyası bulunamadı.` });
    }

    const targetExt = sourceFile.isVtt ? 'vtt' : 'srt';
    const targetPath = basePath + `.${toLang}.${targetExt}`;

    console.log(`[Subtitle Translation] Translating ${sourceFile.path} (${fromLang}) to ${targetPath} (${toLang})...`);
    const content = await fs.promises.readFile(sourceFile.path, 'utf8');
    const translatedContent = await translateSrtOrVttContent(content, sourceFile.isVtt, fromLang, toLang);
    await fs.promises.writeFile(targetPath, translatedContent, 'utf8');
    console.log(`[Subtitle Translation] Successfully saved translated subtitle to ${targetPath}`);

    return res.json({ success: true });
  } catch (err) {
    console.error('[Subtitle Translation Error]:', err);
    return res.status(500).json({ success: false, error: 'Altyazı çevrilirken sunucuda bir hata oluştu: ' + err.message });
  }
});

/**
 * Belirtilen dildeki SRT altyazısını okuyup dinamik olarak WebVTT formatına dönüştürerek tarayıcıya/oynatıcıya servis eder.
 * 
 * @name GET /api/video/:videoId/subtitle/:lang
 * @function
 * @inner
 * @param {object} req - Express istek nesnesi
 * @param {string} req.params.videoId - Hedef videonun YouTube ID'si (11 karakter)
 * @param {string} req.params.lang - Altyazı dil kodu (örn. 'tr', 'en')
 * @param {object} res - Express yanıt nesnesi
 * @returns {void}
 */
router.get('/video/:videoId/subtitle/:lang', (req, res) => {
  const { videoId, lang } = req.params;
  const db = readDb();
  const video = db.history.find(h => h.id === videoId || h.originalId === videoId);

  if (!video || !video.filePath) {
    return res.status(404).send('Video bulunamadı.');
  }

  try {
    const subFile = findSubtitleFile(video.filePath, videoId, lang);
    if (!subFile) {
      return res.status(404).send('Altyazı dosyası bulunamadı.');
    }

    if (subFile.isVtt) {
      res.setHeader('Content-Type', 'text/vtt; charset=utf-8');
      return fs.createReadStream(subFile.path).pipe(res);
    }

    const srtContent = fs.readFileSync(subFile.path, 'utf8');
    const timestampRegex = /(\d{2}:\d{2}:\d{2}),(\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}),(\d{3})/g;
    const vttContent = 'WEBVTT\n\n' + srtContent.replace(timestampRegex, '$1.$2 --> $3.$4');
    
    res.setHeader('Content-Type', 'text/vtt; charset=utf-8');
    return res.send(vttContent);
  } catch (err) {
    console.error('[Get Subtitle Track Error]:', err.message);
    res.status(500).send('Altyazı okunurken hata oluştu.');
  }
});

/**
 * Belirtilen videonun altyazı içeriğini yapay zeka (veya yerel NLP) ile özetler.
 * Desteklenen modlar: 'narrative' (süresiz, akıcı paragraflar, başlıksız ve maddesiz) veya 'timestamped' (süreli anlar [mm:ss]).
 * 
 * @name GET /api/video/:videoId/ai-summary
 * @function
 * @inner
 * @param {object} req - Express istek nesnesi
 * @param {string} req.params.videoId - Hedef video ID'si
 * @param {string} [req.query.provider] - AI sağlayıcısı ('auto', 'lmstudio', 'groq', 'gemini', 'deepseek', 'openai', 'ollama', 'local')
 * @param {string} [req.query.mode] - 'narrative' (varsayılan) veya 'timestamped'
 * @param {string} [req.query.lang] - Tercih edilen altyazı dili (varsayılan 'tr')
 * @param {string} [req.query.model] - Özel model adı
 * @param {number} [req.query.port] - LM Studio portu (varsayılan 1234)
 * @param {boolean} [req.query.forceRefresh] - Önbelleği atlayıp yeniden özetle
 * @param {object} res - Express yanıt nesnesi
 * @returns {Promise<void>}
 */
router.get('/video/:videoId/ai-summary', localhostOnly, async (req, res) => {
  const { videoId } = req.params;
  const {
    provider = 'auto',
    mode = 'narrative',
    lang = 'tr',
    subLang = 'auto',
    outputLang = 'app',
    model,
    port,
    forceRefresh = 'false'
  } = req.query;

  try {
    const summaryResult = await generateVideoSummary(videoId, {
      provider,
      mode,
      lang,
      subLang,
      outputLang,
      model,
      port: port ? parseInt(port, 10) : undefined,
      forceRefresh: forceRefresh === 'true'
    });

    return res.json({
      success: true,
      ...summaryResult
    });
  } catch (err) {
    console.error('[AI Summary Route Error]:', err.message);
    return res.status(500).json({
      success: false,
      error: err.message || 'Özet oluşturulurken bir hata meydana geldi.'
    });
  }
});

/**
 * LM Studio yerel sunucusundaki mevcut yüklü modelleri listeler.
 * 
 * @name GET /api/lmstudio/models
 */
router.get('/lmstudio/models', localhostOnly, async (req, res) => {
  const db = readDb();
  const port = parseInt(req.query.port, 10) || db.settings?.lmStudioPort || 1234;
  try {
    const models = await getLmStudioModels(port);
    return res.json({ success: true, models, port });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Taşınabilir LLaMA motorunun (bin/llama/llama-cli.exe) sistemdeki durumunu döndürür.
 * 
 * @name GET /api/llama/status
 */
router.get('/llama/status', localhostOnly, (req, res) => {
  try {
    const status = checkLlamaEngineStatus();
    return res.json({ success: true, ...status });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Çalışmakta olan llama-cli.exe özet sürecini anında sonlandırır (örn. "Yeniden Özetle" tıklanınca).
 * 
 * @name POST /api/llama/stop
 */
router.post('/llama/stop', localhostOnly, (req, res) => {
  try {
    const stopped = stopLlamaEngine();
    return res.json({ success: true, stopped });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Önerilen başlangıç modelini (Gemma 3 1B QAT GGUF) indirmeyi arka planda başlatır.
 * 
 * @name POST /api/gguf/model/download
 */
router.post('/gguf/model/download', localhostOnly, (req, res) => {
  try {
    return res.json({ success: true, ...startRecommendedModelDownload() });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Önerilen model indirmesinin güncel durumunu döndürür (istemci ~1 sn'de bir yoklar).
 * 
 * @name GET /api/gguf/model/download-status
 */
router.get('/gguf/model/download-status', localhostOnly, (req, res) => {
  try {
    return res.json({ success: true, ...getRecommendedModelDownloadStatus() });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Devam eden önerilen model indirmesini iptal eder.
 * 
 * @name POST /api/gguf/model/download-cancel
 */
router.post('/gguf/model/download-cancel', localhostOnly, (req, res) => {
  try {
    return res.json({ success: true, ...cancelRecommendedModelDownload() });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Yerel TTS (Piper) motor durumu + kurulu sesler + ses kataloğu.
 * 
 * @name GET /api/tts/status
 */
router.get('/tts/status', localhostOnly, (req, res) => {
  try {
    const customDir = typeof readDb().settings?.ttsVoicesDir === 'string' ? readDb().settings.ttsVoicesDir : '';
    const status = getTtsStatus(customDir);
    return res.json({ success: true, ...status, voices: [...VOICE_CATALOG, ...(status.customVoices || [])] });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Piper ses motorunu (~23 MB) indirip kurar.
 * 
 * @name POST /api/tts/engine/download
 */
router.post('/tts/engine/download', localhostOnly, async (req, res) => {
  try {
    return res.json(await downloadPiperEngine());
  } catch (err) {
    console.error('[TTS Engine Install API Error]:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Katalogdan seçilen ses paketini (~63 MB) indirip kurar.
 * 
 * @name POST /api/tts/voice/download
 */
router.post('/tts/voice/download', localhostOnly, async (req, res) => {
  try {
    const voiceId = typeof req.body?.voiceId === 'string' ? req.body.voiceId : '';
    return res.json(await downloadPiperVoice(voiceId));
  } catch (err) {
    console.error('[TTS Voice Install API Error]:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Özet metnini Piper ile WAV'a sesler (önbellekli; sentez bitince döner).
 * 
 * @name POST /api/tts/speak
 */
router.post('/tts/speak', localhostOnly, async (req, res) => {
  try {
    const { text, voiceId, speed } = req.body || {};
    if (typeof text !== 'string' || !text.trim()) {
      return res.status(400).json({ success: false, error: 'Okunacak metin boş.' });
    }
    const customDir = typeof readDb().settings?.ttsVoicesDir === 'string' ? readDb().settings.ttsVoicesDir : '';
    const result = await speakText({ text: text.slice(0, 50000), voiceId, speed, customDir });
    return res.json({ success: true, ...result });
  } catch (err) {
    console.error('[TTS Speak API Error]:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Üretilen WAV dosyasını cache'ten sunar (yalnızca 40 haneli hex kimlikler).
 * 
 * @name GET /api/tts/audio/:id
 */
router.get('/tts/audio/:id', localhostOnly, (req, res) => {
  const id = String(req.params.id || '');
  if (!/^[a-f0-9]{40}$/.test(id)) {
    return res.status(400).json({ success: false, error: 'Geçersiz ses kimliği.' });
  }
  const wavPath = path.join(getTtsCacheDir(), `${id}.wav`);
  if (!fs.existsSync(wavPath)) {
    return res.status(404).json({ success: false, error: 'Ses dosyası bulunamadı.' });
  }
  res.set('Cache-Control', 'private, max-age=604800');
  return res.type('audio/wav').sendFile(wavPath);
});

/**
 * Çalışmakta olan piper.exe sentez sürecini anında sonlandırır.
 * 
 * @name POST /api/tts/stop
 */
router.post('/tts/stop', localhostOnly, (req, res) => {
  try {
    return res.json({ success: true, stopped: stopTtsEngine() });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Seçilen klasördeki (ve alt klasörlerindeki) .gguf model dosyalarını listeler.
 * dir verilmezse kayıtlı ggufModelPath'in klasörü, o da yoksa indirme klasörü taranır.
 * 
 * @name GET /api/gguf/models
 */
router.get('/gguf/models', localhostOnly, (req, res) => {
  try {
    const db = readDb();
    let dir = (typeof req.query.dir === 'string') ? req.query.dir.trim() : '';
    if (!dir && db.settings?.ggufModelPath) {
      dir = path.dirname(db.settings.ggufModelPath);
    }
    if (!dir && db.settings?.downloadPath) {
      dir = db.settings.downloadPath;
    }
    const result = scanGgufModels(dir);
    return res.status(result.success ? 200 : 400).json(result);
  } catch (err) {
    console.error('[GGUF Models Scan Error]:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Resmi GitHub b12058 sürümünden taşınabilir LLaMA motorunu indirip kurar.
 * Gövdedeki variant: 'cpu' (23 MB, varsayılan) | 'gpu' (Vulkan, 36 MB).
 * 
 * @name POST /api/llama/install
 */
router.post('/llama/install', localhostOnly, async (req, res) => {
  try {
    const variant = req.body?.variant === 'gpu' ? 'gpu' : 'cpu';
    const result = await downloadAndInstallLlamaEngine(variant);
    return res.json(result);
  } catch (err) {
    console.error('[Llama Install API Error]:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * YouTube'un dahili Innertube API'sini simüle ederek bir videoya ait kullanıcı yorumlarını ve sayfalama belirteçlerini çeker.
 * 
 * @name GET /api/video/:videoId/comments
 * @function
 * @inner
 * @param {object} req - Express istek nesnesi
 * @param {string} req.params.videoId - Yorumları istenecek videonun YouTube ID'si (11 karakter)
 * @param {string} [req.query.token] - Sonraki yorum sayfalarını çekmek için sayfalama belirteci
 * @param {object} res - Express yanıt nesnesi
 * @returns {Promise<void>}
 */
router.get('/video/:videoId/comments', localhostOnly, async (req, res) => {
  const { videoId } = req.params;
  const { token } = req.query;
  if (!videoId) {
    return res.status(400).json({ error: 'Video ID gereklidir.' });
  }

  try {
    let apiKey = cachedYoutubeApiKey;
    let continuationToken = token;
    let totalComments = null;
    let watchHtml = '';

    if (!apiKey || !continuationToken) {
      const watchUrl = `https://www.youtube.com/watch?v=${videoId}`;
      const watchRes = await fetch(watchUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      });
      const html = await watchRes.text();
      watchHtml = html;
      
      const keyRegex = /"INNERTUBE_API_KEY":"([^"]+)"/;
      const keyMatch = html.match(keyRegex);
      if (keyMatch) {
        apiKey = keyMatch[1];
        cachedYoutubeApiKey = apiKey;
      }
      
      if (!continuationToken) {
        const dataRegex = /var ytInitialData = ({.*?});<\/script>/s;
        const dataMatch = html.match(dataRegex);
        if (dataMatch) {
          const ytInitialData = JSON.parse(dataMatch[1]);
          const contents = ytInitialData.contents?.twoColumnWatchNextResults?.results?.results?.contents || [];
          for (const item of contents) {
            if (item.itemSectionRenderer && item.itemSectionRenderer.sectionIdentifier === 'comment-item-section') {
              const header = item.itemSectionRenderer.header?.commentsHeaderRenderer;
              const countRuns = header?.commentsCount?.runs || header?.countText?.runs;
              if (countRuns && countRuns[0]?.text) {
                totalComments = countRuns[0].text;
              }
              const continuation = item.itemSectionRenderer.contents?.[0]?.continuationItemRenderer;
              continuationToken = continuation?.continuationEndpoint?.continuationCommand?.token;
              break;
            }
          }
          
          if (!continuationToken) {
            for (const item of contents) {
              if (item.itemSectionRenderer) {
                const contents2 = item.itemSectionRenderer.contents || [];
                for (const c of contents2) {
                  if (c.continuationItemRenderer) {
                    continuationToken = c.continuationItemRenderer.continuationEndpoint?.continuationCommand?.token;
                    break;
                  }
                }
              }
              if (continuationToken) break;
            }
          }
        }
      }
    }

    if (!apiKey || !continuationToken) {
      return res.json({ success: true, comments: [], nextPageToken: null, totalCount: totalComments });
    }

    const apiEndpoint = `https://www.youtube.com/youtubei/v1/next?key=${apiKey}`;
    const payload = {
      context: {
        client: {
          clientName: "WEB",
          clientVersion: "2.20240101.01.00"
        }
      },
      continuation: continuationToken
    };
    
    const apiRes = await fetch(apiEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      },
      body: JSON.stringify(payload)
    });
    
    const responseJson = await apiRes.json();
    const mutations = responseJson.frameworkUpdates?.entityBatchUpdate?.mutations || [];
    
    const commentsList = [];
    mutations.forEach(m => {
      if (m.payload && m.payload.commentEntityPayload) {
        const p = m.payload.commentEntityPayload;
        const author = p.author?.displayName || "Unknown";
        const authorAvatar = p.author?.avatarThumbnailUrl || "";
        const text = p.properties?.content?.content || "";
        const publishedTime = p.properties?.publishedTime || "";
        
        let likeCount = "0";
        if (p.toolbar) {
          likeCount = p.toolbar.likeCountNotliked || p.toolbar.likeCountLiked || "0";
        }
        
        commentsList.push({ author, authorAvatar, text, publishedTime, likeCount });
      }
    });

    let nextToken = null;
    if (responseJson.onResponseReceivedEndpoints) {
      responseJson.onResponseReceivedEndpoints.forEach(endpoint => {
        const items = (endpoint.reloadContinuationItemsCommand?.continuationItems) || 
                      (endpoint.appendContinuationItemsAction?.continuationItems) || [];
        
        for (const item of items) {
          if (item.commentsHeaderRenderer) {
            const countRuns = item.commentsHeaderRenderer.commentsCount?.runs || item.commentsHeaderRenderer.countText?.runs;
            if (countRuns && countRuns[0]?.text) {
              totalComments = countRuns[0].text;
            }
          }
          if (item.continuationItemRenderer) {
            nextToken = item.continuationItemRenderer.continuationEndpoint?.continuationCommand?.token ||
                        item.continuationItemRenderer.button?.buttonRenderer?.command?.continuationCommand?.token;
          }
        }
      });
    }

    if (!totalComments && watchHtml) {
      const countMatch = watchHtml.match(/"commentsCount":\{"runs":\[\{"text":"([^"]+)"\}\]\}/) ||
                         watchHtml.match(/"totalComments":"?([0-9,.]+)"?/);
      if (countMatch) totalComments = countMatch[1];
    }
    
    return res.json({ success: true, comments: commentsList, nextPageToken: nextToken, totalCount: totalComments });
  } catch (err) {
    console.error('[Get Comments Error]:', err.message);
    res.json({ success: false, error: err.message, comments: [], nextPageToken: null });
  }
});

/**
 * Kullanıcı yorumlarını yapay zekâ veya kural tabanlı NLP ile analiz ederek kitle duygu ve konu özetini üretir.
 * 
 * @name POST /api/video/:videoId/comments/ai-summary
 * @param {string} req.params.videoId - Video YouTube ID'si
 * @param {object} req.body - İstek gövdesi ({ provider, lang, outputLang, comments })
 * @returns {Promise<void>}
 */
router.post('/video/:videoId/comments/ai-summary', localhostOnly, async (req, res) => {
  const { videoId } = req.params;
  const {
    provider = 'auto',
    lang = 'tr',
    outputLang = 'app',
    model,
    comments = []
  } = req.body;

  try {
    const summaryResult = await generateCommentsSummary(videoId, comments, {
      provider,
      lang,
      outputLang,
      model
    });

    return res.json({
      success: true,
      ...summaryResult
    });
  } catch (err) {
    console.error('[AI Comments Summary Route Error]:', err.message);
    return res.status(500).json({
      success: false,
      error: err.message || 'Yorumlar özetlenirken bir hata meydana geldi.'
    });
  }
});

/**
 * Belirtilen videonun YouTube sayfasını işletim sisteminin varsayılan web tarayıcısında açar.
 * 
 * @name POST /api/open-youtube
 * @function
 * @inner
 * @param {object} req - Express istek nesnesi
 * @param {string} req.body.videoId - Açılacak videonun YouTube ID'si (11 karakter)
 * @param {object} res - Express yanıt nesnesi
 * @returns {void}
 */
router.post('/open-youtube', localhostOnly, (req, res) => {
  const { videoId, time, url } = req.body;
  if (!videoId && !url) return res.status(400).json({ error: 'Video ID veya URL gereklidir.' });
  
  const db = readDb();
  const item = db.history.find(h => h.id === videoId);
  const targetWebUrl = url || (item && (item.webUrl || item.url)) || '';

  if (targetWebUrl && (targetWebUrl.startsWith('http://') || targetWebUrl.startsWith('https://')) && !targetWebUrl.includes('youtube.com/watch?v=ext_')) {
    open(targetWebUrl);
    return res.json({ success: true });
  }

  const timeNum = Number(time);
  const timeQuery = (!isNaN(timeNum) && timeNum > 0) ? `&t=${Math.floor(timeNum)}s` : '';
  open(`https://www.youtube.com/watch?v=${videoId}${timeQuery}`);
  res.json({ success: true });
});

/**
 * Belirtilen harici URL'yi işletim sisteminin varsayılan web tarayıcısında açar.
 * 
 * @name POST /api/open-url
 * @function
 * @inner
 * @param {object} req - Express istek nesnesi
 * @param {string} req.body.url - Açılacak tam URL (https://...)
 * @param {object} res - Express yanıt nesnesi
 * @returns {void}
 */
router.post('/open-url', localhostOnly, (req, res) => {
  const { url } = req.body;
  if (!url || (!url.startsWith('https://') && !url.startsWith('http://'))) {
    return res.status(400).json({ error: 'Geçerli bir URL gereklidir.' });
  }
  open(url);
  res.json({ success: true });
});

/**
 * İndirilmiş olan videoyu işletim sisteminin varsayılan yerel medya oynatıcısında (örn. VLC, Windows Media Player) başlatır.
 * 
 * @name POST /api/play-video
 * @function
 * @inner
 * @param {object} req - Express istek nesnesi
 * @param {string} req.body.videoId - Oynatılacak videonun YouTube ID'si (11 karakter)
 * @param {object} res - Express yanıt nesnesi
 * @returns {void}
 */
router.post('/play-video', localhostOnly, (req, res) => {
  const rawId = req.body?.videoId;
  const cleanId = String(rawId || '').replace(/^fakap_/, '');
  if (!rawId || !/^[a-zA-Z0-9_-]{11,64}$/.test(cleanId)) {
    return res.status(400).json({ error: 'Geçersiz veya eksik Video ID.' });
  }
  const db = readDb();
  const item = db.history.find(h => h.id === rawId || h.id === cleanId);

  let fileToPlay = item ? item.filePath : null;
  if (!fileToPlay || !fs.existsSync(fileToPlay)) {
    fileToPlay = findVideoFileInDownloadDir(cleanId, db.settings.downloadPath);
  }

  if (!fileToPlay && !item) {
    console.error(`[Play Video Hatası] Video kaydı geçmişte bulunamadı. ID: ${rawId}`);
    return res.status(404).json({ error: 'Video kaydı bulunamadı.' });
  }

  if (fileToPlay && fs.existsSync(fileToPlay)) {
    const resolvedTarget = path.resolve(fileToPlay);
    console.log(`[Oynat] Dosya oynatılıyor: ${resolvedTarget}`);
    if (process.platform === 'win32') {
      const resolvedDir = path.dirname(resolvedTarget);
      const escapedTarget = resolvedTarget.replace(/'/g, "''");
      const escapedDir = resolvedDir.replace(/'/g, "''");
      const psScript = `$psi = New-Object System.Diagnostics.ProcessStartInfo; $psi.FileName = '${escapedTarget}'; $psi.WorkingDirectory = '${escapedDir}'; $psi.UseShellExecute = $true; [System.Diagnostics.Process]::Start($psi) | Out-Null; Start-Sleep -Milliseconds 250`;
      const encodedCmd = Buffer.from(psScript, 'utf16le').toString('base64');
      execFile('powershell.exe', [
        '-NoProfile',
        '-NonInteractive',
        '-ExecutionPolicy',
        'Bypass',
        '-EncodedCommand',
        encodedCmd
      ], { windowsHide: true }, (err) => {
        if (err) {
          console.error(`[Play Video Fallback] PowerShell hatası (${err.message}), explorer.exe deneniyor...`);
          try {
            const child2 = spawn('explorer.exe', [`"${path.normalize(resolvedTarget)}"`], {
              windowsVerbatimArguments: true
            });
            child2.on('error', () => {});
            child2.unref();
          } catch (e) {
            open(resolvedTarget).catch(() => {});
          }
        }
      });
    } else {
      open(resolvedTarget);
    }
    res.json({ success: true });
  } else {
    const errorMsg = `Video dosyası bulunamadı. Aranan Konum: ${fileToPlay || path.join(db.settings.downloadPath, `*[${cleanId}]*`)}`;
    console.error(`[Play Video Hatası] ${errorMsg}`);
    res.status(404).json({ error: errorMsg });
  }
});

/**
 * Kullanıcının sisteminde yapılandırılmış olan yerel DNS sunucularını ve internet çıkışında aktif olarak kullanılan
 * üst DNS çözümleyicisini (Google DNS, Cloudflare, Quad9, AdGuard, ISP vb.) tespit ederek döndürür.
 * 
 * @name GET /api/system-dns
 * @function
 * @inner
 * @param {object} req - Express istek nesnesi
 * @param {object} res - Express yanıt nesnesi
 * @returns {void}
 */
router.get('/system-dns', localhostOnly, async (req, res) => {
  try {
    const localServers = dns.getServers() || [];
    let resolverIp = '';
    let resolverGeo = '';
    let resolverHost = '';
    let clientIp = '';
    let providerName = 'Bilinmeyen Sağlayıcı';

    // 1. EDNS servisi ile gerçek DNS çözümleyici IP ve çıkış noktası tespiti
    try {
      const ednsRes = await fetch('https://edns.ip-api.com/json', {
        signal: AbortSignal.timeout(4000)
      });
      if (ednsRes.ok) {
        const ednsData = await ednsRes.json();
        if (ednsData.dns) {
          resolverIp = ednsData.dns.ip || '';
          resolverGeo = ednsData.dns.geo || '';
        }
        if (ednsData.edns && ednsData.edns.ip) {
          clientIp = ednsData.edns.ip;
        }
      }
    } catch (e) {
      console.warn('[System DNS] EDNS sorgusu zaman aşımı veya hata:', e.message);
    }

    // 1.1 EDNS istemci alt ağını gizlediyse veya boş döndüyse doğrudan genel IP tespiti fallback'i
    if (!clientIp) {
      try {
        const ipRes = await Promise.any([
          fetch('https://api.ipify.org?format=json', { signal: AbortSignal.timeout(3000) }).then(r => r.json()).then(d => d.ip),
          fetch('https://ifconfig.me/ip', { signal: AbortSignal.timeout(3000) }).then(r => r.text())
        ]);
        if (ipRes) clientIp = String(ipRes).trim();
      } catch (e) {
        console.warn('[System DNS] Genel IP tespiti fallback hatası:', e.message);
      }
    }

    // 2. Çözümleyici IP'sine ters DNS (PTR) sorgusu yaparak ana makine adını bul
    if (resolverIp) {
      try {
        const hostnames = await dns.promises.reverse(resolverIp);
        if (hostnames && hostnames.length > 0) {
          resolverHost = hostnames[0];
        }
      } catch (e) {}
    }

    // 3. Tespit edilen yerel IP, çözümleyici IP, konum ve ana makine adına göre tanınan sağlayıcıyı eşle
    const combinedStr = `${resolverIp} ${resolverHost} ${resolverGeo} ${localServers.join(' ')}`.toLowerCase();

    if (combinedStr.includes('adguard') || resolverHost.includes('adguard-dns')) {
      providerName = 'AdGuard DNS';
    } else if (combinedStr.includes('cloudflare') || combinedStr.includes('1.1.1.1') || resolverHost.includes('one.one.one.one')) {
      providerName = 'Cloudflare DNS';
    } else if (combinedStr.includes('dns.google') || combinedStr.includes('google') || combinedStr.includes('8.8.8.8') || combinedStr.includes('8.8.4.4')) {
      providerName = 'Google Public DNS';
    } else if (combinedStr.includes('quad9') || resolverHost.includes('quad9')) {
      providerName = 'Quad9 DNS';
    } else if (combinedStr.includes('opendns') || combinedStr.includes('208.67.222.222')) {
      providerName = 'Cisco OpenDNS';
    } else if (combinedStr.includes('comodo') || combinedStr.includes('secureanywhere')) {
      providerName = 'Comodo Secure DNS';
    } else if (combinedStr.includes('ttnet') || combinedStr.includes('turk telekom') || combinedStr.includes('turktelekom')) {
      providerName = 'Türk Telekom DNS (İSS)';
    } else if (combinedStr.includes('superonline') || combinedStr.includes('turkcell')) {
      providerName = 'Turkcell Superonline DNS (İSS)';
    } else if (combinedStr.includes('vodafone')) {
      providerName = 'Vodafone DNS (İSS)';
    } else if (combinedStr.includes('turknet')) {
      providerName = 'TurkNet DNS (İSS)';
    } else if (resolverGeo) {
      providerName = resolverGeo.split('-').pop()?.trim() || resolverGeo;
    }

    res.json({
      success: true,
      provider: providerName,
      resolverIp: resolverIp || (localServers[0] || '127.0.0.1'),
      resolverGeo: resolverGeo || 'Yerel Ağ / Bilinmiyor',
      resolverHost: resolverHost || '-',
      localServers,
      clientIp: clientIp || ''
    });
  } catch (err) {
    console.error('[System DNS] Genel Hata:', err);
    res.status(500).json({ error: 'DNS bilgisi alınamadı: ' + err.message });
  }
});

/**
 * Return YouTube Dislike (RYD) API entegrasyonu.
 * Verilen videoya ait tahmini dislike, like, rating ve görüntülenme oranlarını getirir.
 * 
 * @name GET /api/video/:videoId/votes
 * @function
 * @inner
 * @param {object} req - Express istek nesnesi
 * @param {string} req.params.videoId - YouTube video ID
 * @param {object} res - Express yanıt nesnesi
 */
const rydCache = new Map();
router.get('/video/:videoId/votes', localhostOnly, async (req, res) => {
  const { videoId } = req.params;
  if (!videoId || videoId.length < 5) {
    return res.status(400).json({ error: 'Geçersiz Video ID.' });
  }

  const cached = rydCache.get(videoId);
  if (cached && (Date.now() - cached.timestamp < 1000 * 60 * 15)) { // 15 dakika önbellek
    return res.json(cached.data);
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);
    const rydRes = await fetch(`https://returnyoutubedislikeapi.com/votes?videoId=${encodeURIComponent(videoId)}`, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'HaYTooL-YT-Downloader/1.0'
      }
    });
    clearTimeout(timeout);

    if (!rydRes.ok) {
      if (rydRes.status === 404) {
        return res.json({ available: false, message: 'Dislike verisi bulunamadı.' });
      }
      return res.status(rydRes.status).json({ error: 'RYD API hatası: ' + rydRes.statusText });
    }

    const data = await rydRes.json();
    const result = {
      available: true,
      id: data.id,
      likes: data.likes || 0,
      dislikes: data.dislikes || 0,
      rating: data.rating ? Number(data.rating.toFixed(2)) : null,
      viewCount: data.viewCount || 0
    };

    rydCache.set(videoId, { timestamp: Date.now(), data: result });
    res.json(result);
  } catch (err) {
    res.json({ available: false, error: err.message });
  }
});

/**
 * Return YouTube Dislike (RYD) Sistemine Oy Gönderme (PoW Korumalı)
 * @name POST /api/video/:videoId/vote
 * @param {number} req.body.value - 1 (Like), -1 (Dislike), 0 (Nötr)
 */
let storedRydUserId = null;

function generateRydUserId(length = 36) {
  const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const values = new Uint32Array(length);
  globalThis.crypto.getRandomValues(values);
  let result = '';
  for (const v of values) {
    result += charset[v % charset.length];
  }
  return result;
}

function countLeadingZeroes(bytes, limit = Infinity) {
  let zeroes = 0;
  for (const originalValue of bytes) {
    let value = originalValue;
    if (value === 0) {
      zeroes += 8;
    } else {
      let count = 1;
      if (value >>> 4 === 0) { count += 4; value <<= 4; }
      if (value >>> 6 === 0) { count += 2; value <<= 2; }
      zeroes += count - (value >>> 7);
      break;
    }
    if (zeroes >= limit) break;
  }
  return zeroes;
}

async function solveRydPuzzle(puzzle, maxAttempts) {
  const challenge = Uint8Array.from(atob(puzzle.challenge), c => c.charCodeAt(0));
  const attempts = maxAttempts ?? Math.pow(2, puzzle.difficulty) * 10;
  const buffer = new ArrayBuffer(20);
  const byteView = new Uint8Array(buffer);
  const integerView = new Uint32Array(buffer);
  byteView.set(challenge, 4);

  for (let counter = 0; counter < attempts; counter++) {
    integerView[0] = counter;
    const hash = await globalThis.crypto.subtle.digest('SHA-512', buffer);
    if (countLeadingZeroes(new Uint8Array(hash), puzzle.difficulty) >= puzzle.difficulty) {
      return { solution: btoa(String.fromCharCode(...byteView.slice(0, 4))) };
    }
  }
  return null;
}

async function ensureRydRegistration(force = false) {
  if (!force && storedRydUserId) {
    return storedRydUserId;
  }
  const userId = generateRydUserId(36);
  const regRes = await fetch(`https://returnyoutubedislikeapi.com/puzzle/registration?userId=${encodeURIComponent(userId)}`, {
    headers: { 'Accept': 'application/json' }
  });
  if (!regRes.ok) throw new Error('RYD kayıt bulmacası alınamadı: ' + regRes.status);
  const puzzle = await regRes.json();
  const solved = await solveRydPuzzle(puzzle);
  if (!solved) throw new Error('RYD kayıt bulmacası çözülemedi');

  const confirmRes = await fetch(`https://returnyoutubedislikeapi.com/puzzle/registration?userId=${encodeURIComponent(userId)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(solved)
  });
  if (!confirmRes.ok) throw new Error('RYD kayıt onayı başarısız');
  storedRydUserId = userId;
  return storedRydUserId;
}

router.post('/video/:videoId/vote', localhostOnly, async (req, res) => {
  const { videoId } = req.params;
  const value = parseInt(req.body.value, 10); // 1 = Like, -1 = Dislike, 0 = Nötr
  if (!videoId || isNaN(value)) {
    return res.status(400).json({ error: 'Geçersiz parametreler.' });
  }

  try {
    let userId = await ensureRydRegistration();

    // 1. Oy Gönderme (İlk aşama)
    let voteRes = await fetch('https://returnyoutubedislikeapi.com/interact/vote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, videoId, value })
    });

    if (voteRes.status === 401) {
      // Token/kayıt düşmüşse yeniden kaydol
      userId = await ensureRydRegistration(true);
      voteRes = await fetch('https://returnyoutubedislikeapi.com/interact/vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, videoId, value })
      });
    }

    if (!voteRes.ok) {
      return res.status(voteRes.status).json({ error: 'RYD oy isteği reddedildi.' });
    }

    // 2. Oy Bulmacası Çözme (İkinci aşama)
    const votePuzzle = await voteRes.json();
    const solvedVote = await solveRydPuzzle(votePuzzle);
    if (!solvedVote) {
      return res.status(500).json({ error: 'Oy doğrulama bulmacası çözülemedi.' });
    }

    // 3. Oyu Onaylama (Üçüncü aşama)
    const confirmRes = await fetch('https://returnyoutubedislikeapi.com/interact/confirmVote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...solvedVote, userId, videoId })
    });

    if (!confirmRes.ok) {
      return res.status(confirmRes.status).json({ error: 'Oy onaylanamadı.' });
    }

    // Önbelleği temizle ki güncel veriler yeniden çekilebilsin
    rydCache.delete(videoId);

    res.json({ success: true, message: 'Oy başarıyla RYD sistemine iletildi!', value });
  } catch (err) {
    console.error('[RYD Vote Error]:', err);
    res.status(500).json({ error: 'Oy iletilemedi: ' + err.message });
  }
});

// Türkçe Açıklama: Harici web sitelerindeki (Dizipal, dizi/film siteleri) video akışını (.m3u8, .mp4, embed) çözümler.
router.post('/tools/extract-web-stream', localhostOnly, async (req, res) => {
  try {
    const { url } = req.body || {};
    if (!url) {
      return res.status(400).json({ success: false, error: 'Lütfen geçerli bir web sitesi veya dizi bağlantısı girin.' });
    }
    const result = await extractStreamFromUrl(url);
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Türkçe Açıklama: Referer veya CORS korumalı video akış parçalarını ve m3u8 bildirimlerini tarayıcıya güvenle ileten proxy köprüsü.
router.get('/tools/web-stream-proxy', async (req, res) => {
  try {
    const targetUrl = req.query.url;
    const referer = req.query.referer || targetUrl;
    if (!targetUrl) return res.status(400).send('URL parametresi zorunludur.');

    const fetchHeaders = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36'
    };
    if (referer) fetchHeaders['Referer'] = referer;
    if (req.headers.range) fetchHeaders['Range'] = req.headers.range;

    const response = await fetch(targetUrl, { headers: fetchHeaders });
    res.status(response.status);

    const contentType = response.headers.get('content-type');
    if (contentType) res.setHeader('Content-Type', contentType);
    res.setHeader('Access-Control-Allow-Origin', '*');

    // Eğer m3u8 manifest ise içerisindeki göreceli URI linklerini proxy formatına dönüştür
    if (targetUrl.includes('.m3u8') || (contentType && contentType.includes('mpegurl'))) {
      const text = await response.text();
      const baseUrl = targetUrl.substring(0, targetUrl.lastIndexOf('/') + 1);
      const rewritten = text.replace(/^(?!#)(?!\s*$)(.+)$/gm, (line) => {
        let fullLine = line.trim();
        if (!fullLine.startsWith('http')) {
          fullLine = baseUrl + fullLine;
        }
        return `/api/tools/web-stream-proxy?url=${encodeURIComponent(fullLine)}&referer=${encodeURIComponent(referer)}`;
      });
      return res.send(rewritten);
    }

    // Video segmentleri / ts dosyaları için binary pipe
    const arrayBuffer = await response.arrayBuffer();
    res.send(Buffer.from(arrayBuffer));
  } catch (err) {
    res.status(500).send('Proxy hatası: ' + err.message);
  }
});

// Türkçe Açıklama: Tarayıcı eklentisinden veya harici istemcilerden gelen video bağlantısını HaYTooL Web İzle sekmesine iletir.
router.post('/tools/open-web-stream', localhostOnly, (req, res) => {
  try {
    const { url } = req.body || {};
    const cleanUrl = typeof url === 'string' ? url.trim() : '';

    if (cleanUrl) {
      broadcast('open_webstream', { url: cleanUrl });
    } else {
      broadcast('switch_tab', 'webstream');
    }

    // Windows üzerinde masaüstü uygulamasını (Multimedia HaYTooL.exe) öne getir
    try {
      const dir = path.dirname(fileURLToPath(import.meta.url));
      const candidates = [
        path.resolve(dir, '..', '..', 'Multimedia HaYTooL.exe'),
        path.resolve(process.cwd(), 'main', 'Multimedia HaYTooL.exe'),
        path.resolve(process.cwd(), 'Multimedia HaYTooL.exe')
      ];
      for (const p of candidates) {
        if (fs.existsSync(p)) {
          execFile(p, ['show'], { windowsHide: true }, () => {});
          break;
        }
      }
    } catch {}

    res.json({ success: true, message: 'Web İzle sekmesine iletildi.', url: cleanUrl });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
