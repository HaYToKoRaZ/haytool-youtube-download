import express from 'express';
import fs from 'fs';
import path from 'path';
import { exec, spawn } from 'child_process';
import { ytdlpPath, getLocalTempDir, cleanMeiForPid, spawnYtdlp, execYtdlp } from '../services/paths.js';
import { downloadQueue } from '../services/downloader.js';
import { readDb } from '../database.js';
import { fetchVideoDuration, resolveMissingDurations } from '../services/rss.js';
import { addTerminalLog } from '../services/sse.js';
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
  const isWin = process.platform === 'win32';
  const targetDir = path.dirname(ytdlpPath);
  const target = (req.body && req.body.target) ? req.body.target.trim() : 'nightly';

  const db = readDb();
  const runMode = db.settings?.ytdlpRunMode || 'exe';

  if (!fs.existsSync(targetDir)) {
    try { fs.mkdirSync(targetDir, { recursive: true }); } catch (e) {}
  }

  // Eğer Python modunda çalışıyorsa pip ile güncelle
  if (runMode === 'python') {
    const pythonCmd = db.settings?.pythonCmd || (isWin ? 'python' : 'python3');
    let pipTarget = 'yt-dlp';
    if (target === 'nightly' || target.startsWith('nightly')) {
      pipTarget = '--pre yt-dlp';
    } else if (target.includes('@')) {
      const tag = target.split('@')[1];
      pipTarget = `yt-dlp==${tag}`;
    }
    const pipCmd = `"${pythonCmd}" -m pip install -U ${pipTarget}`;
    console.log(`[yt-dlp Pip Update] Komut çalıştırılıyor: ${pipCmd}`);
    addTerminalLog(`[yt-dlp] Python pip üzerinden güncelleniyor: ${pipTarget}...`, 'info');

    return execYtdlp(pipCmd, { timeout: 120000 }, (pipErr, stdout, stderr) => {
      const output = (stdout || '') + '\n' + (stderr || '');
      if (pipErr) {
        return res.json({ success: false, error: output || pipErr.message });
      }
      execYtdlp(`"${ytdlpPath}" --version`, { timeout: 10000 }, (verErr, verStdout) => {
        const newVersion = verErr ? '' : (verStdout || '').trim();
        addTerminalLog(`[yt-dlp] Sürüm başarıyla güncellendi: ${newVersion}`, 'success');
        res.json({ success: true, output, newVersion });
      });
    });
  }

  // Exe / Binary Modu: Doğrudan GitHub üzerinden binary indirerek en güvenilir şekilde güncelle
  let dlUrl = '';
  if (target === 'nightly' || target === 'latest' || !target) {
    dlUrl = isWin
      ? 'https://github.com/yt-dlp/yt-dlp-nightly-builds/releases/latest/download/yt-dlp.exe'
      : 'https://github.com/yt-dlp/yt-dlp-nightly-builds/releases/latest/download/yt-dlp';
  } else if (target === 'stable') {
    dlUrl = isWin
      ? 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe'
      : 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp';
  } else if (target.startsWith('nightly@')) {
    const tag = target.replace('nightly@', '');
    dlUrl = isWin
      ? `https://github.com/yt-dlp/yt-dlp-nightly-builds/releases/download/${tag}/yt-dlp.exe`
      : `https://github.com/yt-dlp/yt-dlp-nightly-builds/releases/download/${tag}/yt-dlp`;
  } else if (target.startsWith('stable@')) {
    const tag = target.replace('stable@', '');
    dlUrl = isWin
      ? `https://github.com/yt-dlp/yt-dlp/releases/download/${tag}/yt-dlp.exe`
      : `https://github.com/yt-dlp/yt-dlp/releases/download/${tag}/yt-dlp`;
  } else {
    // Özel tag veya bilinmeyen format
    dlUrl = isWin
      ? `https://github.com/yt-dlp/yt-dlp/releases/download/${target}/yt-dlp.exe`
      : `https://github.com/yt-dlp/yt-dlp/releases/download/${target}/yt-dlp`;
  }

  console.log(`[yt-dlp Update] Doğrudan GitHub indirmesi başlatılıyor: ${dlUrl}`);
  addTerminalLog(`[yt-dlp] Sürüm indiriliyor (${target})...`, 'info');

  try {
    const response = await fetch(dlUrl, {
      headers: { 'User-Agent': 'HaYTooL-YT-Downloader' },
      redirect: 'follow'
    });

    if (!response.ok) {
      throw new Error(`GitHub HTTP ${response.status}: ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    if (buffer.length < 100000) {
      throw new Error('İndirilen dosya boyutu beklenenden çok küçük (geçersiz binary).');
    }

    // Dosyayı geçici bir isme yazıp ardından asıl konuma taşı (Atomik ve güvenli)
    const tempFilePath = `${ytdlpPath}.downloading_${Date.now()}`;
    fs.writeFileSync(tempFilePath, buffer);

    if (fs.existsSync(ytdlpPath)) {
      try {
        fs.unlinkSync(ytdlpPath);
      } catch (delErr) {
        // Eğer Windows dosyayı kilitlediyse eski dosyayı .old yapıp yenisini taşı
        const oldBackupPath = `${ytdlpPath}.old_${Date.now()}`;
        try { fs.renameSync(ytdlpPath, oldBackupPath); } catch (_) {}
      }
    }

    fs.renameSync(tempFilePath, ytdlpPath);

    if (!isWin) {
      try { fs.chmodSync(ytdlpPath, '755'); } catch (e) {}
    }

    // Yeni sürümü kontrol et
    execYtdlp(`"${ytdlpPath}" --version`, { timeout: 10000 }, (verErr, verStdout) => {
      const newVersion = verErr ? '' : (verStdout || '').trim();
      const successMsg = `yt-dlp başarıyla ${newVersion || target} sürümüne güncellendi.`;
      console.log(`[yt-dlp Update] ${successMsg}`);
      addTerminalLog(`[yt-dlp] ${successMsg}`, 'success');
      res.json({ success: true, output: successMsg, newVersion });
    });

  } catch (err) {
    console.error('[yt-dlp Update] Doğrudan indirme hatası, fallback komutu deneniyor:', err.message);
    
    // Fallback: yt-dlp --update-to veya --update dene
    const fallbackCmd = `"${ytdlpPath}" --update-to ${target}`;
    execYtdlp(fallbackCmd, { timeout: 120000 }, (updateErr, updateStdout, updateStderr) => {
      const output = ((updateStdout || '') + '\n' + (updateStderr || '')).trim();
      if (updateErr) {
        return res.json({ success: false, error: err.message + ' | Fallback: ' + output });
      }
      execYtdlp(`"${ytdlpPath}" --version`, { timeout: 10000 }, (verErr, verStdout) => {
        const newVersion = verErr ? '' : (verStdout || '').trim();
        addTerminalLog(`[yt-dlp] Sürüm başarıyla güncellendi: ${newVersion}`, 'success');
        res.json({ success: true, output, newVersion });
      });
    });
  }
});
