import express from 'express';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { exec, spawn } from 'child_process';
import { ytdlpPath, getLocalTempDir, cleanMeiForPid, spawnYtdlp, execYtdlp, formatDurationStr } from '../services/paths.js';
import { downloadQueue, performYtdlpUpdate } from '../services/downloader.js';
import { readDb, writeDb } from '../database.js';
import { fetchVideoDuration, resolveMissingDurations } from '../services/rss.js';
import { addTerminalLog } from '../services/sse.js';
import { localhostOnly } from '../middleware/security.js';
import { getTempSpaceInfo, isTempExtractionError } from '../services/diskGuard.js';

export const router = express.Router();

// Helper to extract video ID from YouTube URL
/**
 * YouTube video bağlantısından veya adresinden 11 karakterli video ID'sini ayıklar.
 * 
 * @param {string} url - YouTube video bağlantı adresi
 * @returns {string|null} Bulunan video ID'si veya null
 */
function extractVideoId(url) {
  if (!url) return null;
  const youtubeRegex = /(?:youtu\.be\/|(?:music\.)?youtube\.com\/(?:embed\/|v\/|live\/|watch\?v=|watch\?.+&v=|shorts\/))([^?&"'>\s]{11})/;
  const match = url.match(youtubeRegex);
  return match ? match[1] : null;
}

/**
 * yt-dlp kullanarak videonun başlık, kanal adı ve kanal ID bilgilerini çeker.
 * 
 * @param {string} videoId YouTube Video ID'si
 * @returns {Promise<object|null>} Çözümlenen bilgiler veya null
 */
function fetchMetadataViaYtdlp(target, isDirectUrl = false) {
  return new Promise((resolve) => {
    const targetUrl = isDirectUrl ? target : `https://www.youtube.com/watch?v=${target}`;
    const args = [
      '--no-playlist',
      '--skip-download',
      '--encoding', 'utf-8',
      '--replace-in-metadata', 'description', '[\\r\\n]+', ' ',
      '--print', '%(title)s\t%(uploader)s\t%(uploader_id)s\t%(channel_id,id)s\t%(duration_string)s\t%(id)s\t%(thumbnail)s\t%(webpage_url)s\t%(description).120s\t%(view_count)s',
      targetUrl
    ];
    const localTemp = getLocalTempDir();
    const spawnOptions = {
      env: { ...process.env, TEMP: localTemp, TMP: localTemp, PYTHONIOENCODING: 'utf-8', LC_ALL: 'en_US.UTF-8' },
      ...(process.platform === 'win32' ? { windowsVerbatimArguments: false, windowsHide: true } : {})
    };
    
    const proc = spawnYtdlp(args, spawnOptions);
    let stdout = '';
    if (proc.stdout) {
      proc.stdout.setEncoding('utf8');
      proc.stdout.on('data', (data) => { stdout += data; });
    }
    proc.on('close', (code) => {
      cleanMeiForPid(proc.pid);
      if (code === 0 && stdout.trim()) {
        const parts = stdout.trim().split('\t');
        if (parts.length >= 3) {
          let rawTitle = parts[0]?.trim() || '';
          let uploader = parts[1]?.trim() || '';
          let uploaderId = parts[2]?.trim() || '';
          let channelId = parts[3]?.trim() || '';
          let rawDur = parts[4]?.trim() || '';
          let extractedId = parts[5]?.trim() || '';
          let thumbnail = parts[6]?.trim() || '';
          let webpageUrl = parts[7]?.trim() || '';
          let rawDesc = parts[8]?.trim() || '';

          let cleanTitle = rawTitle;
          let channelName = uploader || '';

          const isInstagram = isDirectUrl && (targetUrl.includes('instagram.com') || targetUrl.includes('/reel/') || targetUrl.includes('/p/'));
          const isX = isDirectUrl && (targetUrl.includes('x.com') || targetUrl.includes('twitter.com'));
          const isTikTok = isDirectUrl && targetUrl.includes('tiktok.com');

          if (isInstagram) {
            const igMatch = rawTitle.match(/^(?:Video|Post) by ([a-zA-Z0-9._]+)/i);
            const igUsername = (igMatch && igMatch[1]) ? igMatch[1] : (uploaderId || uploader);
            if (igUsername && igUsername.toLowerCase() !== 'instagram') {
              channelName = '@' + igUsername.replace(/^@+/, '');
            }
            if (rawDesc && rawDesc.length > 2 && !rawDesc.startsWith('http')) {
              cleanTitle = rawDesc;
            } else if (rawTitle && !rawTitle.startsWith('Video by ') && !rawTitle.startsWith('Post by ') && rawTitle !== 'NA') {
              cleanTitle = rawTitle;
            } else {
              cleanTitle = igUsername ? `${igUsername} Instagram Videosu` : 'Instagram Videosu';
            }
          } else if (isX) {
            const xHandle = uploaderId || uploader;
            if (xHandle) {
              channelName = '@' + xHandle.replace(/^@+/, '');
            }
            if ((!cleanTitle || cleanTitle === 'NA') && rawDesc) {
              cleanTitle = rawDesc;
            }
          } else if (isTikTok) {
            const ttUser = uploader || uploaderId;
            if (ttUser) {
              channelName = '@' + ttUser.replace(/^@+/, '');
            }
            if ((!cleanTitle || cleanTitle.startsWith('TikTok video') || cleanTitle === 'NA') && rawDesc) {
              cleanTitle = rawDesc;
            }
          }

          const rawViews = parts[9]?.trim();
          const parsedViews = parseInt(rawViews, 10);
          const viewCount = (!isNaN(parsedViews) && parsedViews >= 0) ? parsedViews : 0;

          return resolve({
            title: cleanTitle,
            channelName: channelName || parts[1]?.trim(),
            channelId: channelName ? channelName : channelId,
            duration: formatDurationStr(rawDur),
            extractedId: extractedId,
            thumbnail: thumbnail || '',
            webUrl: webpageUrl || targetUrl,
            viewCount: viewCount
          });
        }
      }
      resolve(null);
    });
    proc.on('error', () => resolve(null));
  });
}

/**
 * Belirtilen YouTube videosunu elle (manuel) indirme kuyruğuna ekler.
 * 
 * @name POST /api/downloader/download
 * @function
 * @inner
 * @param {object} req - Express istek nesnesi
 * @param {string} req.body.url - YouTube video URL'si veya video ID'si
 * @param {string} [req.body.format] - İstenen video formatı (örn. 'video-best', 'mp3')
 * @param {string} [req.body.bitrate] - MP3 formatı için ses bit hızı (örn. '320', '192')
 * @param {string} [req.body.title] - Özel video başlığı
 * @param {string} [req.body.channelName] - Kanal adı
 * @param {string} [req.body.channelId] - Kanal ID'si
 * @param {object} res - Express yanıt nesnesi
 * @returns {Promise<void>}
 */
router.post('/download', localhostOnly, async (req, res) => {
  const { url, format, bitrate, quality } = req.body;

  // Format ve Kalite eşleştirmesini normalize et
  let customFormat = format || 'video-best';
  let audioBitrate = bitrate || '192';

  if (format === 'audio' || format === 'mp3' || format === 'audio-mp3') {
    customFormat = 'audio-mp3';
    audioBitrate = bitrate || quality || '320';
  } else if (format === 'video-best' || format === 'best' || format === '4k' || format === 'video-4k' || format === '2160' || quality === 'best' || quality === '4k' || quality === '2160') {
    customFormat = 'video-best';
  } else if (format === 'video-1440p' || format === '1440' || format === '2k' || quality === '1440' || quality === '2k') {
    customFormat = 'video-1440p';
  } else if (format === 'video-1080p' || format === '1080' || quality === '1080') {
    customFormat = 'video-1080p';
  } else if (format === 'video-720p' || format === '720' || quality === '720') {
    customFormat = 'video-720p';
  } else if (format === 'video-480p' || format === '480' || quality === '480') {
    customFormat = 'video-480p';
  } else if (format === 'video') {
    customFormat = 'video-best';
  }
  let { title, channelName, channelId } = req.body;
  let duration = req.body.duration || '';
  let thumbnail = req.body.thumbnail || '';

  let targetVideoId = extractVideoId(url);
  let isDirectUrl = false;
  let finalDownloadUrl = '';

  if (!targetVideoId) {
    // 11 haneli salt ID mi?
    if (/^[a-zA-Z0-9_-]{11}$/.test(url)) {
      targetVideoId = url;
      finalDownloadUrl = `https://www.youtube.com/watch?v=${targetVideoId}`;
    } else if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
      // Çoklu platform (TikTok, Twitter/X, Instagram veya diğer yt-dlp destekli URL'ler)
      isDirectUrl = true;
      finalDownloadUrl = url;
      // Benzersiz ID üret
      const hashId = crypto.createHash('md5').update(url).digest('hex').slice(0, 11);
      targetVideoId = 'ext_' + hashId;
    }
  } else {
    finalDownloadUrl = `https://www.youtube.com/watch?v=${targetVideoId}`;
  }

  if (!targetVideoId) {
    return res.status(400).json({ error: 'Geçersiz video bağlantısı veya Video ID.' });
  }

  // Varsayılan platform ismi ve platform tipi tespiti
  let defaultChannelName = 'Manuel İndirme';
  let detectedPlatform = 'youtube';
  const lowerUrl = (url || '').toLowerCase();
  if (lowerUrl.includes('tiktok.com')) {
    defaultChannelName = 'TikTok';
    detectedPlatform = 'tiktok';
  } else if (lowerUrl.includes('twitter.com') || lowerUrl.includes('x.com')) {
    defaultChannelName = 'Twitter / X';
    detectedPlatform = 'x';
  } else if (lowerUrl.includes('instagram.com')) {
    defaultChannelName = 'Instagram';
    detectedPlatform = 'instagram';
  } else if (isDirectUrl) {
    detectedPlatform = 'other';
  }

  // URL'den kullanıcı adı ön tespiti (Fallback)
  let extractedHandle = '';
  if (detectedPlatform === 'x') {
    const m = url.match(/(?:twitter|x)\.com\/([a-zA-Z0-9_]+)\/status/i);
    if (m && m[1] && m[1].toLowerCase() !== 'i') extractedHandle = '@' + m[1];
  } else if (detectedPlatform === 'tiktok') {
    const m = url.match(/tiktok\.com\/@([a-zA-Z0-9_.-]+)/i);
    if (m && m[1]) extractedHandle = '@' + m[1];
  } else if (detectedPlatform === 'instagram') {
    const m = url.match(/instagram\.com\/([a-zA-Z0-9_.-]+)\/(?:reel|p)\//i);
    if (m && m[1] && !['reels', 'p', 'stories', 'tv'].includes(m[1].toLowerCase())) extractedHandle = '@' + m[1];
  }
  if (extractedHandle) defaultChannelName = extractedHandle;

  let metadata = null;
  let resolvedPublishedAt = '';
  let resolvedViewCount = 0;

  // Eğer başlık veya kanal bilgisi yoksa veya başlık hatalı bir URL ise metadata çek
  if (!title || !channelName || title.startsWith('http')) {
    try {
      if (!isDirectUrl) {
        const details = await fetchVideoDuration(targetVideoId);
        if (details && details.title && !details.title.startsWith('http')) {
          title = title || details.title;
          channelName = channelName || details.channelName;
          channelId = channelId || details.channelId;
          if (!duration && details.duration) {
            duration = details.duration;
          }
          if (details.publishedAt) {
            resolvedPublishedAt = details.publishedAt;
          }
          if (details.viewCount) {
            resolvedViewCount = details.viewCount;
          }
        }
      }
      
      // Eğer hâlâ başlık yoksa veya doğrudan URL ise yt-dlp ile çözmeyi dene
      if (!title || !channelName || title.startsWith('http') || !duration) {
        metadata = await fetchMetadataViaYtdlp(isDirectUrl ? url : targetVideoId, isDirectUrl);
        if (metadata) {
          title = metadata.title || title;
          channelName = metadata.channelName || channelName;
          channelId = metadata.channelId || channelId;
          if (metadata.duration) {
            duration = metadata.duration;
          }
          if (metadata.thumbnail) {
            thumbnail = metadata.thumbnail;
          }
          if (isDirectUrl && metadata.extractedId) {
            targetVideoId = 'ext_' + String(metadata.extractedId).replace(/[^a-zA-Z0-9_-]/g, '_').slice(-16);
          }
        }
      }
    } catch (err) {
      console.error(`[Downloader API] Video detayları çekilemedi:`, err.message);
    }
  }

  // Harici platformlar için kullanıcı adı ve başlık temizliği güvencesi
  if (detectedPlatform !== 'youtube') {
    if (detectedPlatform === 'instagram') {
      const m = (title || '').match(/^(?:Video|Post) by ([a-zA-Z0-9._]+)/i);
      if (m && m[1]) {
        if (!channelName || channelName === 'Instagram' || channelName === 'Manuel İndirme') {
          channelName = '@' + m[1];
          channelId = channelName;
        }
        title = title.replace(/^(?:Video|Post) by [a-zA-Z0-9._]+[:\s-]*/i, '').trim() || `${m[1]} Instagram Videosu`;
      }
      if (title === 'NA' || !title) {
        title = (channelName && channelName !== 'Instagram') ? `${channelName} Instagram Videosu` : 'Instagram Videosu';
      }
    }
    if (!channelName || channelName === 'Instagram' || channelName === 'TikTok' || channelName === 'Twitter / X' || channelName === 'Manuel İndirme') {
      if (extractedHandle) channelName = extractedHandle;
    }
    if (channelName && (!channelId || channelId === 'manual')) {
      channelId = channelName;
    }
  }
  // Eğer kuyruk duraklatılmışsa, manuel indirme isteğinde otomatik devam ettir
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

  // Kuyruğa ekle
  await downloadQueue.add({
    id: targetVideoId,
    title: title || 'Bilinmeyen Video',
    channelId: channelId || 'manual',
    channelName: channelName || defaultChannelName,
    url: finalDownloadUrl,
    webUrl: url || finalDownloadUrl,
    platform: detectedPlatform,
    publishedAt: resolvedPublishedAt || new Date().toISOString(),
    skipChannelFolder: false, // 0- klasörlerine düzgün dağıtılması için false
    customFormat: customFormat,
    audioBitrate: audioBitrate,
    isStandalone: true,
    duration: duration || '',
    thumbnail: thumbnail || '',
    viewCount: Number(req.body.viewCount) || (metadata && metadata.viewCount) || resolvedViewCount || 0
  });

  // Eksik süreleri tamamla (yalnızca süre çözümlenemediyse tetikle)
  if (!isDirectUrl && !duration && typeof resolveMissingDurations === 'function') {
    resolveMissingDurations();
  }

  res.json({ success: true, message: 'İndirme kuyruğuna eklendi.', videoId: targetVideoId });
});

/**
 * Gönderilen YouTube oynatma listesini (playlist) hızlıca çözümler ve videoları listeler.
 * 
 * @name POST /api/downloader/resolve-playlist
 * @function
 * @inner
 * @param {object} req - Express istek nesnesi
 * @param {string} req.body.url - Oynatma listesi (playlist) bağlantı adresi
 * @param {object} res - Express yanıt nesnesi
 * @returns {void}
 */
router.post('/resolve-playlist', localhostOnly, (req, res) => {
  const { url } = req.body;

  if (!url) {
    return res.status(400).json({ error: 'Playlist URL gereklidir.' });
  }

  const db = readDb();
  const settings = db.settings || {};
  let langArg = '';
  if (settings.lang) {
    langArg = `--extractor-args "youtube:lang=${settings.lang}"`;
  }

  // flat-playlist ve dump-json ile hızlıca playlist içeriğini alıyoruz
  const cmd = `"${ytdlpPath}" ${langArg} --flat-playlist --dump-json --ignore-errors "${url}"`;

  const localTemp = getLocalTempDir();
  const execProc = execYtdlp(cmd, { maxBuffer: 1024 * 1024 * 10, env: { ...process.env, TEMP: localTemp, TMP: localTemp } }, (error, stdout, stderr) => {
    cleanMeiForPid(execProc.pid);
    if (error) {
      console.error(`[Playlist Resolve Error]:`, error);
      return res.status(500).json({ error: 'Playlist çözümlenirken bir hata oluştu.' });
    }

    const lines = stdout.split('\n').filter(line => line.trim() !== '');
    const videos = [];

    for (const line of lines) {
      try {
        const item = JSON.parse(line);
        // yt-dlp flat-playlist modunda genelde id, title, duration ve uploader alanlarını döner
        if (item.id) {
          videos.push({
            id: item.id,
            title: item.title || 'Bilinmeyen Video',
            duration: item.duration || 0,
            uploader: item.uploader || 'Bilinmeyen Kanal',
            thumbnail: item.thumbnail || `https://i.ytimg.com/vi/${item.id}/hqdefault.jpg`
          });
        }
      } catch (e) {
        // Hatalı satırları yoksay
      }
    }

    if (videos.length === 0) {
      return res.status(400).json({ error: 'Playlist içerisinde geçerli video bulunamadı.' });
    }

    res.json({ success: true, videos });
  });
});

// Türkçe Açıklama: Temp sürücüsünün boş alan durumunu döner (yt-dlp açılışı için gerekli); arayüz uyarı bannerı bunu kullanır.
router.get('/temp-space', localhostOnly, (req, res) => {
  res.json({ success: true, ...getTempSpaceInfo() });
});

// Türkçe Açıklama: Mevcut yt-dlp sürümünü, kanalını (nightly/stable) ve GitHub üzerindeki en güncel sürümleri sorgular ve döner.
/**
  * Gömülü yt-dlp motorunun yerel sürümünü, kanalını ve uzak sürümleri döndürür.
  * 
  * @route GET /api/downloader/ytdlp-version
  * @returns {{ version: string, channel: string, latestVersion: string|null, latestNightly: string|null, latestStable: string|null, recentNightly: Array, recentStable: Array }}
  */
router.get('/ytdlp-version', localhostOnly, (req, res) => {
  execYtdlp(`"${ytdlpPath}" --version`, { timeout: 10000 }, async (err, stdout, stderr) => {
    if (err && !fs.existsSync(ytdlpPath)) {
      return res.json({ version: 'Yüklü Değil', channel: 'none', latestNightly: null, latestStable: null, recentNightly: [], recentStable: [] });
    } else if (err && (isTempExtractionError(stderr) || isTempExtractionError(err.message))) {
      return res.json({ version: 'DISK_FULL', channel: 'none', diskFull: true, tempInfo: getTempSpaceInfo(), latestNightly: null, latestStable: null, recentNightly: [], recentStable: [] });
    } else if (err) {
      return res.status(500).json({ error: 'yt-dlp sürümü alınamadı: ' + (err.message || '') });
    }
    
    const localVersion = (stdout || '').trim();
    let latestStable = null;
    let latestNightly = null;
    let recentNightly = [];
    let recentStable = [];

    const isNightlyLocal = localVersion.includes('.') && (localVersion.split('.').length >= 4 || localVersion.includes('dev') || localVersion.length > 10);
    const currentChannel = isNightlyLocal ? 'nightly' : 'stable';

    try {
      const db = readDb();
      const token = db.settings?.githubToken;
      const headers = { 'User-Agent': 'HaYTooL-YT-Downloader' };
      if (token) headers['Authorization'] = `Bearer ${token.trim()}`;

      // 1. En son Nightly sürümleri çek (Tavsiye Edilen kanal)
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 6000);
        const nightlyRes = await fetch('https://api.github.com/repos/yt-dlp/yt-dlp-nightly-builds/releases?per_page=6', {
          headers,
          signal: controller.signal
        });
        clearTimeout(timeoutId);
        if (nightlyRes.ok) {
          const nightlyData = await nightlyRes.json();
          if (Array.isArray(nightlyData)) {
            recentNightly = nightlyData.map(r => ({
              tag: r.tag_name ? r.tag_name.replace(/^v/, '') : '',
              name: r.name || r.tag_name,
              publishedAt: r.published_at
            })).filter(r => r.tag);
            if (recentNightly.length > 0) {
              latestNightly = recentNightly[0].tag;
            }
          }
        }
      } catch (e) {
        console.warn('[yt-dlp] Nightly releases could not be fetched:', e.message);
      }

      // 2. En son Stable sürümleri çek
      try {
        const controller2 = new AbortController();
        const timeoutId2 = setTimeout(() => controller2.abort(), 6000);
        const stableRes = await fetch('https://api.github.com/repos/yt-dlp/yt-dlp/releases?per_page=6', {
          headers,
          signal: controller2.signal
        });
        clearTimeout(timeoutId2);
        if (stableRes.ok) {
          const stableData = await stableRes.json();
          if (Array.isArray(stableData)) {
            recentStable = stableData.map(r => ({
              tag: r.tag_name ? r.tag_name.replace(/^v/, '') : '',
              name: r.name || r.tag_name,
              publishedAt: r.published_at
            })).filter(r => r.tag);
            if (recentStable.length > 0) {
              latestStable = recentStable[0].tag;
            }
          }
        }
      } catch (e) {
        console.warn('[yt-dlp] Stable releases could not be fetched:', e.message);
      }
    } catch (apiErr) {
      console.warn('[yt-dlp] GitHub API error:', apiErr.message);
    }

    res.json({
      version: localVersion,
      channel: currentChannel,
      latestNightly,
      latestStable,
      latestVersion: latestNightly || latestStable,
      recentNightly,
      recentStable
    });
  });
});

// Türkçe Açıklama: yt-dlp motorunu seçilen kanala veya belirtilen özel sürüme günceller / geri alır.
/**
  * Gömülü yt-dlp motorunu belirtilen hedefe (Nightly, Stable veya spesifik tag) günceller.
  * 
  * @route POST /api/downloader/ytdlp-update
  * @param {string} target - 'nightly' | 'stable' | 'nightly@tag' | 'stable@tag'
  * @returns {{ success: boolean, output: string, newVersion?: string }}
  */
router.post('/ytdlp-update', localhostOnly, async (req, res) => {
  const target = (req.body && req.body.target) ? req.body.target.trim() : 'nightly';
  try {
    const result = await performYtdlpUpdate(target);
    res.json(result);
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

/**
 * Tray ve harici istemciler için anlık aktif indirme sayısını ve indirme durumunu döner.
 * 
 * @route GET /api/downloader/active-status
 * @returns {{ activeDownloads: number, isDownloading: boolean, queueLength: number }}
 */
router.get('/active-status', (req, res) => {
  const activeDownloads = (downloadQueue && typeof downloadQueue.activeDownloads === 'number') 
    ? downloadQueue.activeDownloads 
    : 0;
  const queueLength = (downloadQueue && Array.isArray(downloadQueue.queue))
    ? downloadQueue.queue.length
    : 0;
  res.json({
    activeDownloads,
    isDownloading: activeDownloads > 0,
    preventSleep: readDb()?.settings?.preventSleepOnDownload !== false,
    queueLength
  });
});

