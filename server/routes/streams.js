// Türkçe Açıklama: Video oynatma (HTTP 206 akışı), video kapağı (thumbnail), altyazı listeleme/okuma, otomatik Google Translate altyazı çevirisi, YouTube yorumları çekme ve YouTube'u tarayıcıda açma API rotaları modülü.
import express from 'express';
import fs from 'fs';
import path from 'path';
import open from 'open';
import { spawn } from 'child_process';
import { ytdlpPath, getLocalTempDir, cleanMeiForPid, spawnYtdlp } from '../services/paths.js';
import { readDb, findVideoFileInDownloadDir } from '../database.js';
import { localhostOnly } from '../middleware/security.js';

export const router = express.Router();

let cachedYoutubeApiKey = null;

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
router.get('/video-stream', (req, res) => {
  const { videoId } = req.query;
  if (!videoId) return res.status(400).send('Video ID is required');
  if (!/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
    return res.status(400).send('Invalid Video ID format');
  }

  const db = readDb();
  const item = db.history.find(h => h.id === videoId);
  let fileToPlay = item ? item.filePath : null;

  if (!fileToPlay || !fs.existsSync(fileToPlay)) {
    fileToPlay = findVideoFileInDownloadDir(videoId, db.settings.downloadPath);
  }

  if (fileToPlay && fs.existsSync(fileToPlay)) {
    console.log(`[Stream] Video akıtılıyor: ${fileToPlay}`);
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
router.get('/video/:videoId/thumbnail', (req, res) => {
  const { videoId } = req.params;
  if (!/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
    return res.status(400).send('Invalid Video ID format');
  }

  const db = readDb();
  const item = db.history.find(h => h.id === videoId);
  
  if (item && item.filePath) {
    try {
      const ext = path.extname(item.filePath);
      const basePath = item.filePath.slice(0, -ext.length);
      
      const possibleExtensions = ['.jpg', '.jpeg', '.webp', '.png'];
      for (const tExt of possibleExtensions) {
        const thumbPath = basePath + tExt;
        if (fs.existsSync(thumbPath)) {
          return res.sendFile(thumbPath);
        }
      }
    } catch (err) {
      console.error(`Error reading thumbnail for ${videoId}:`, err.message);
    }
  }

  // Fallback to youtube public thumbnail URL
  res.redirect(`https://img.youtube.com/vi/${videoId}/mqdefault.jpg`);
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
  if (!/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
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
  if (!/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
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
    const args = ['--encoding', 'utf-8', '--get-description', `https://www.youtube.com/watch?v=${videoId}`];
    
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
  if (!/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
    return res.status(400).json({ error: 'Geçersiz Video ID formatı' });
  }

  try {
    const db = readDb();
    const item = db.history.find(h => h.id === videoId);

    // YouTube'dan güncel açıklamayı çek
    const updatedDesc = await fetchDescriptionFromYtdlp(videoId);

    // .description dosyasını diske kaydet
    if (item && item.filePath) {
      const ext = path.extname(item.filePath);
      const basePath = item.filePath.slice(0, -ext.length);
      const descPath = basePath + '.description';
      await fs.promises.writeFile(descPath, updatedDesc, 'utf8');
    }

    res.json({ success: true, description: updatedDesc });
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
  const video = db.history.find(h => h.id === videoId);
  
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
      const subRegex = new RegExp(`^${escapedName}\\.([a-z]{2}(?:-[a-z0-9]+)?)\\.(srt|vtt)$`, 'i');

      const foundLangs = new Set();
      for (const file of files) {
        const match = file.match(subRegex);
        if (match) {
          const langCode = match[1].toLowerCase();
          if (!foundLangs.has(langCode)) {
            foundLangs.add(langCode);
            let label = langCode.toUpperCase();
            try {
              const displayNames = new Intl.DisplayNames(['tr', 'en'], { type: 'language' });
              const name = displayNames.of(langCode);
              if (name) {
                label = name.charAt(0).toUpperCase() + name.slice(1);
              }
            } catch (e) {
              const staticMap = {
                tr: 'Türkçe', en: 'English', ar: 'Arapça', de: 'Almanca',
                es: 'İspanyolca', fr: 'Fransızca', ru: 'Rusça', ja: 'Japonca',
                pt: 'Portekizce', it: 'İtalyanca', zh: 'Çince', ko: 'Korece'
              };
              if (staticMap[langCode]) label = staticMap[langCode];
            }

            subtitles.push({
              lang: langCode,
              label: label,
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
  const video = db.history.find(h => h.id === videoId);

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

    const sourceSrtPath = basePath + `.${fromLang}.srt`;
    const sourceVttPath = basePath + `.${fromLang}.vtt`;
    const targetSrtPath = basePath + `.${toLang}.srt`;
    const targetVttPath = basePath + `.${toLang}.vtt`;

    let sourcePath = null;
    let targetPath = null;
    let isVtt = false;

    if (fs.existsSync(sourceVttPath)) {
      sourcePath = sourceVttPath;
      targetPath = targetVttPath;
      isVtt = true;
    } else if (fs.existsSync(sourceSrtPath)) {
      sourcePath = sourceSrtPath;
      targetPath = targetSrtPath;
      isVtt = false;
    }

    if (!sourcePath) {
      return res.status(400).json({ success: false, error: `Çevrilecek (${fromLang}) altyazı dosyası bulunamadı.` });
    }

    console.log(`[Subtitle Translation] Translating ${sourcePath} (${fromLang}) to ${targetPath} (${toLang})...`);
    const content = await fs.promises.readFile(sourcePath, 'utf8');
    const translatedContent = await translateSrtOrVttContent(content, isVtt, fromLang, toLang);
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
  const video = db.history.find(h => h.id === videoId);

  if (!video || !video.filePath) {
    return res.status(404).send('Video bulunamadı.');
  }

  try {
    const filePath = video.filePath;
    const ext = path.extname(filePath);
    const basePath = filePath.slice(0, -ext.length);
    const srtPath = basePath + `.${lang}.srt`;
    const vttPath = basePath + `.${lang}.vtt`;

    if (fs.existsSync(vttPath)) {
      res.setHeader('Content-Type', 'text/vtt; charset=utf-8');
      return fs.createReadStream(vttPath).pipe(res);
    }

    if (fs.existsSync(srtPath)) {
      const srtContent = fs.readFileSync(srtPath, 'utf8');
      const timestampRegex = /(\d{2}:\d{2}:\d{2}),(\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}),(\d{3})/g;
      const vttContent = 'WEBVTT\n\n' + srtContent.replace(timestampRegex, '$1.$2 --> $3.$4');
      
      res.setHeader('Content-Type', 'text/vtt; charset=utf-8');
      return res.send(vttContent);
    }

    return res.status(404).send('Altyazı dosyası bulunamadı.');
  } catch (err) {
    console.error('[Get Subtitle Track Error]:', err.message);
    res.status(500).send('Altyazı okunurken hata oluştu.');
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
router.get('/video/:videoId/comments', async (req, res) => {
  const { videoId } = req.params;
  const { token } = req.query;
  if (!videoId) {
    return res.status(400).json({ error: 'Video ID gereklidir.' });
  }

  try {
    let apiKey = cachedYoutubeApiKey;
    let continuationToken = token;

    if (!apiKey || !continuationToken) {
      const watchUrl = `https://www.youtube.com/watch?v=${videoId}`;
      const watchRes = await fetch(watchUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      });
      const html = await watchRes.text();
      
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
      return res.json({ success: true, comments: [], nextPageToken: null });
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
          if (item.continuationItemRenderer) {
            nextToken = item.continuationItemRenderer.continuationEndpoint?.continuationCommand?.token ||
                        item.continuationItemRenderer.button?.buttonRenderer?.command?.continuationCommand?.token;
          }
        }
      });
    }
    
    return res.json({ success: true, comments: commentsList, nextPageToken: nextToken });
  } catch (err) {
    console.error('[Get Comments Error]:', err.message);
    res.json({ success: false, error: err.message, comments: [], nextPageToken: null });
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
  const { videoId } = req.body;
  if (!videoId) return res.status(400).json({ error: 'Video ID gereklidir.' });
  
  open(`https://www.youtube.com/watch?v=${videoId}`);
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
  const { videoId } = req.body;
  if (!videoId || !/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
    return res.status(400).json({ error: 'Geçersiz veya eksik Video ID.' });
  }
  const db = readDb();
  const item = db.history.find(h => h.id === videoId);
  
  if (!item) {
    console.error(`[Play Video Hatası] Video kaydı geçmişte bulunamadı. ID: ${videoId}`);
    return res.status(404).json({ error: 'Video kaydı bulunamadı.' });
  }

  let fileToPlay = item.filePath;
  if (!fileToPlay || !fs.existsSync(fileToPlay)) {
    fileToPlay = findVideoFileInDownloadDir(videoId, db.settings.downloadPath);
  }

  if (fileToPlay && fs.existsSync(fileToPlay)) {
    console.log(`[Oynat] Dosya oynatılıyor: ${fileToPlay}`);
    open(fileToPlay);
    res.json({ success: true });
  } else {
    const errorMsg = `Video dosyası bulunamadı. Aranan Konum: ${fileToPlay || path.join(db.settings.downloadPath, `*[${videoId}]*`)}`;
    console.error(`[Play Video Hatası] ${errorMsg}`);
    res.status(404).json({ error: errorMsg });
  }
});
