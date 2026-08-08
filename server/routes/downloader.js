import express from 'express';
import { exec, spawn } from 'child_process';
import { ytdlpPath, getLocalTempDir, cleanMeiForPid, spawnYtdlp, execYtdlp } from '../services/paths.js';
import { downloadQueue } from '../services/downloader.js';
import { readDb } from '../database.js';
import { fetchVideoDuration, resolveMissingDurations } from '../services/rss.js';
import { localhostOnly } from '../middleware/security.js';

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
  const youtubeRegex = /(?:youtu\.be\/|(?:music\.)?youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/))([^?&"'>\s]{11})/;
  const match = url.match(youtubeRegex);
  return match ? match[1] : null;
}

/**
 * yt-dlp kullanarak videonun başlık, kanal adı ve kanal ID bilgilerini çeker.
 * 
 * @param {string} videoId YouTube Video ID'si
 * @returns {Promise<object|null>} Çözümlenen bilgiler veya null
 */
function fetchMetadataViaYtdlp(videoId) {
  return new Promise((resolve) => {
    const args = [
      '--no-playlist',
      '--skip-download',
      '--print', '%(title)s|%(uploader)s|%(channel_id)s|%(duration_string)s',
      `https://www.youtube.com/watch?v=${videoId}`
    ];
    const localTemp = getLocalTempDir();
    const spawnOptions = {
      env: { ...process.env, TEMP: localTemp, TMP: localTemp },
      ...(process.platform === 'win32' ? { windowsVerbatimArguments: false, windowsHide: true } : {})
    };
    
    const proc = spawnYtdlp(args, spawnOptions);
    let stdout = '';
    proc.stdout.on('data', (data) => { stdout += data.toString(); });
    proc.on('close', (code) => {
      cleanMeiForPid(proc.pid);
      if (code === 0 && stdout.trim()) {
        const parts = stdout.trim().split('|');
        if (parts.length >= 3) {
          return resolve({
            title: parts[0]?.trim(),
            channelName: parts[1]?.trim(),
            channelId: parts[2]?.trim(),
            duration: parts[3]?.trim()
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
  const { url, format, bitrate } = req.body;
  let { title, channelName, channelId } = req.body;

  let targetVideoId = extractVideoId(url);
  if (!targetVideoId) {
    // URL'in kendisi 11 haneli bir video ID'si olabilir
    if (/^[a-zA-Z0-9_-]{11}$/.test(url)) {
      targetVideoId = url;
    }
  }

  if (!targetVideoId) {
    return res.status(400).json({ error: 'Geçersiz YouTube URL veya Video ID.' });
  }

  // Eğer başlık veya kanal bilgisi yoksa veya başlık hatalı bir URL ise YouTube'dan çekmeye çalışalım
  if (!title || !channelName || title.startsWith('http')) {
    try {
      const details = await fetchVideoDuration(targetVideoId);
      if (details && details.title && !details.title.startsWith('http')) {
        title = title || details.title;
        channelName = channelName || details.channelName;
        channelId = channelId || details.channelId;
      }
      
      // Eğer hâlâ başlık yoksa veya URL ise yt-dlp ile çözmeyi dene
      if (!title || !channelName || title.startsWith('http')) {
        const metadata = await fetchMetadataViaYtdlp(targetVideoId);
        if (metadata) {
          title = metadata.title || title;
          channelName = metadata.channelName || channelName;
          channelId = metadata.channelId || channelId;
        }
      }
    } catch (err) {
      console.error(`[Downloader API] Video detayları çekilemedi:`, err.message);
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
  downloadQueue.add({
    id: targetVideoId,
    title: title || 'Bilinmeyen Video',
    channelId: channelId || 'manual',
    channelName: channelName || 'Manuel İndirme',
    url: `https://www.youtube.com/watch?v=${targetVideoId}`,
    publishedAt: new Date().toISOString(),
    skipChannelFolder: true,
    customFormat: format || 'video-best',
    audioBitrate: bitrate || '192',
    isStandalone: true
  });

  // Eksik süreleri tamamla
  if (typeof resolveMissingDurations === 'function') {
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

// Türkçe Açıklama: Mevcut yt-dlp sürümünü ve uzak sunucudaki (GitHub) en son sürümü sorgular ve döner.
/**
 * Gömülü yt-dlp motorunun yerel sürümünü ve resmi en son sürümünü döndürür.
 * 
 * @route GET /api/downloader/ytdlp-version
 * @returns {{ version: string, latestVersion: string|null }} Mevcut ve en son sürüm bilgileri
 */
router.get('/ytdlp-version', localhostOnly, (req, res) => {
    execYtdlp(`"${ytdlpPath}" --version`, { timeout: 10000 }, async (err, stdout, stderr) => {
    if (err) {
      return res.status(500).json({ error: 'yt-dlp sürümü alınamadı: ' + (err.message || '') });
    }
    
    const localVersion = (stdout || '').trim();
    let latestVersion = null;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      const db = readDb();
      const token = db.settings?.githubToken;
      const headers = { 'User-Agent': 'HaYTooL-YT-Downloader' };
      if (token) headers['Authorization'] = `Bearer ${token.trim()}`;

      const apiRes = await fetch('https://api.github.com/repos/yt-dlp/yt-dlp/releases/latest', {
        headers,
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      
      if (apiRes.ok) {
        const apiData = await apiRes.json();
        if (apiData && apiData.tag_name) {
          // 'v2026.03.17' -> '2026.03.17'
          latestVersion = apiData.tag_name.replace(/^v/, '');
        }
      }
    } catch (apiErr) {
      console.warn('[yt-dlp] GitHub release API could not be fetched:', apiErr.message);
    }

    res.json({ version: localVersion, latestVersion });
  });
});

// Türkçe Açıklama: yt-dlp motorunu en son sürüme günceller.
/**
 * Gömülü yt-dlp motorunu --update komutuyla en son sürüme günceller.
 * 
 * @route POST /api/download/ytdlp-update
 * @returns {{ success: boolean, output: string, newVersion?: string }}
 */
router.post('/ytdlp-update', localhostOnly, async (req, res) => {
  const isWin = process.platform === 'win32';
  const targetDir = path.dirname(ytdlpPath);

  if (!fs.existsSync(targetDir)) {
    try { fs.mkdirSync(targetDir, { recursive: true }); } catch (e) {}
  }

  // Eğer Linux ortamında yerel yt-dlp ikili dosyası hiç yoksa GitHub'dan en son Linux sürümünü indir
  if (!isWin && !fs.existsSync(ytdlpPath)) {
    try {
      console.log('[yt-dlp Update] Linux ikilisi bulunamadı. GitHub üzerinden indiriliyor...');
      const response = await fetch('https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp', {
        headers: { 'User-Agent': 'HaYTooL-YT-Downloader' }
      });
      if (!response.ok) throw new Error(`HTTP ${response.status} ${response.statusText}`);
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      fs.writeFileSync(ytdlpPath, buffer);
      fs.chmodSync(ytdlpPath, '755');
      console.log('[yt-dlp Update] Linux ikilisi başarıyla indirildi ve chmod +x verildi.');

      execYtdlp(`"${ytdlpPath}" --version`, { timeout: 10000 }, (verErr, verStdout) => {
        const newVersion = verErr ? '' : (verStdout || '').trim();
        return res.json({ success: true, output: 'yt-dlp Linux motoru indirildi.', newVersion });
      });
      return;
    } catch (dlErr) {
      console.error('[yt-dlp Update] Linux indirme hatası:', dlErr.message);
    }
  }

  execYtdlp(`"${ytdlpPath}" --update`, { timeout: 120000 }, (updateErr, updateStdout, updateStderr) => {
    const output = ((updateStdout || '') + '\n' + (updateStderr || '')).trim();

    if (!isWin && fs.existsSync(ytdlpPath)) {
      try { fs.chmodSync(ytdlpPath, '755'); } catch (e) {}
    }

    if (updateErr) {
      return res.json({ success: false, error: output || updateErr.message });
    }

    // Güncelleme sonrası yeni sürümü sorgula
    execYtdlp(`"${ytdlpPath}" --version`, { timeout: 10000 }, (verErr, verStdout) => {
      const newVersion = verErr ? '' : (verStdout || '').trim();
      res.json({ success: true, output, newVersion });
    });
  });
});
