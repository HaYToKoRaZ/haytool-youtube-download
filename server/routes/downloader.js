import express from 'express';
import { exec } from 'child_process';
import { ytdlpPath } from '../services/paths.js';
import { downloadQueue } from '../services/downloader.js';
import { readDb } from '../database.js';
import { fetchVideoDuration, resolveMissingDurations } from '../services/rss.js';

export const router = express.Router();

// Helper to extract video ID from YouTube URL
function extractVideoId(url) {
  if (!url) return null;
  const youtubeRegex = /(?:youtu\.be\/|(?:music\.)?youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/))([^?&"'>\s]{11})/;
  const match = url.match(youtubeRegex);
  return match ? match[1] : null;
}

// 1. POST /api/downloader/download
router.post('/download', async (req, res) => {
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

  // Eğer başlık veya kanal bilgisi yoksa YouTube'dan çekmeye çalışalım
  if (!title || !channelName) {
    try {
      const details = await fetchVideoDuration(targetVideoId);
      if (details) {
        title = title || details.title;
        channelName = channelName || details.channelName;
        channelId = channelId || details.channelId;
      }
    } catch (err) {
      console.error(`[Downloader API] Video detayları çekilemedi:`, err.message);
    }
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

// 2. POST /api/downloader/resolve-playlist
router.post('/resolve-playlist', (req, res) => {
  const { url } = req.body;

  if (!url) {
    return res.status(400).json({ error: 'Playlist URL gereklidir.' });
  }

  // flat-playlist ve dump-json ile hızlıca playlist içeriğini alıyoruz
  const cmd = `"${ytdlpPath}" --flat-playlist --dump-json --ignore-errors "${url}"`;

  exec(cmd, { maxBuffer: 1024 * 1024 * 10 }, (error, stdout, stderr) => {
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
