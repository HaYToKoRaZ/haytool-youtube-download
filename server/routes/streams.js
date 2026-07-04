// Türkçe Açıklama: Video oynatma (HTTP 206 akışı), video kapağı (thumbnail), altyazı listeleme/okuma, otomatik Google Translate altyazı çevirisi, YouTube yorumları çekme ve YouTube'u tarayıcıda açma API rotaları modülü.
import express from 'express';
import fs from 'fs';
import path from 'path';
import open from 'open';
import { readDb, findVideoFileInDownloadDir } from '../database.js';
import { localhostOnly } from '../middleware/security.js';

export const router = express.Router();

let cachedYoutubeApiKey = null;

// Gömülü Oynatıcı için Video Akışı (Stream)
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

// Video Kapak Resmi (Thumbnail) Sunumu
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

// Video Açıklaması (Description) Okuma
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

// Altyazı dosyalarının varlığını denetler ve listeler
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
    const ext = path.extname(filePath);
    const basePath = filePath.slice(0, -ext.length);

    const languages = [
      { lang: 'tr', label: 'Türkçe' },
      { lang: 'en', label: 'English' }
    ];

    for (const item of languages) {
      const srtPath = basePath + `.${item.lang}.srt`;
      const vttPath = basePath + `.${item.lang}.vtt`;
      if (fs.existsSync(srtPath) || fs.existsSync(vttPath)) {
        subtitles.push({
          lang: item.lang,
          label: item.label,
          url: `/api/video/${videoId}/subtitle/${item.lang}`
        });
      }
    }
  } catch (err) {
    console.error('[Get Subtitles Error]:', err.message);
  }

  res.json({ success: true, subtitles });
});

// Google Translate ile metin çeviren yardımcı fonksiyon
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

// SRT veya WebVTT altyazı içeriğini satır satır çeviren fonksiyon
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

// Altyazıyı manuel olarak seçilen dilden hedef dile çeviren endpoint
router.post('/video/:videoId/translate-subtitle', async (req, res) => {
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
    const content = fs.readFileSync(sourcePath, 'utf8');
    const translatedContent = await translateSrtOrVttContent(content, isVtt, fromLang, toLang);
    fs.writeFileSync(targetPath, translatedContent, 'utf8');
    console.log(`[Subtitle Translation] Successfully saved translated subtitle to ${targetPath}`);

    return res.json({ success: true });
  } catch (err) {
    console.error('[Subtitle Translation Error]:', err);
    return res.status(500).json({ success: false, error: 'Altyazı çevrilirken sunucuda bir hata oluştu: ' + err.message });
  }
});

// SRT dosyasını okuyup WebVTT formatında tarayıcıya sunar
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

// YouTube videosuna ait yorumları Innertube API'si kullanarak çeken endpoint
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

// YouTube Linkini Tarayıcıda Aç
router.post('/open-youtube', (req, res) => {
  const { videoId } = req.body;
  if (!videoId) return res.status(400).json({ error: 'Video ID gereklidir.' });
  
  open(`https://www.youtube.com/watch?v=${videoId}`);
  res.json({ success: true });
});

// Videoyu Yerel Medya Oynatıcıda Aç
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
