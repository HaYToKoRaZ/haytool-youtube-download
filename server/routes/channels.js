// Türkçe Açıklama: Kanal listesi, kanal arama, kanal ekleme/silme, avatar yönetimi ve kanalları tek tek manuel eşitleme API rotaları modülü.
import express from 'express';
import fs from 'fs';
import path from 'path';
import https from 'https';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { 
  readDb, 
  writeDb, 
  acquireDbLock, 
  saveChannelsToIni 
} from '../database.js';
import { channelsIniPath } from '../config.js';
import { localhostOnly } from '../middleware/security.js';
import { 
  fetchWithProxyWaterfall, 
  downloadChannelAvatar, 
  checkSingleChannelRss, 
  resolveMissingDurations 
} from '../services/rss.js';
import { broadcast, addTerminalLog } from '../services/sse.js';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..', '..');
const ytdlpPath = path.join(rootDir, 'yt-dlp', process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp');

export const router = express.Router();

// Kanal Listesini Getir
router.get('/', (req, res) => {
  const db = readDb();
  res.json(db.channels || []);
});

// Kanalları dışa aktar (Parametreli rotalardan önce olmalı)
router.get('/export', (req, res) => {
  if (!fs.existsSync(channelsIniPath)) {
    return res.status(404).send('channels.ini bulunamadı.');
  }
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename=channels.ini');
  res.sendFile(channelsIniPath);
});

// Kanalları içe aktar (Parametreli rotalardan önce olmalı)
router.post('/import', (req, res) => {
  let data = '';
  req.on('data', chunk => { data += chunk; });
  req.on('end', async () => {
    try {
      fs.writeFileSync(channelsIniPath, data, 'utf-8');
      
      const db = readDb();
      const { syncWithIni } = await import('../database.js');
      syncWithIni(db);
      writeDb(db);
      
      broadcast('db_update', db);
      broadcast('status_log', { message: 'Kanallar channels.ini dosyasından başarıyla aktarıldı.', type: 'success' });
      addTerminalLog('[Kanal] channels.ini dosyasından içe aktarma tamamlandı.', 'success');
      
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
});

// YouTube Üzerinden Kanal Arama (Parametreli rotalardan önce olmalı)
router.get('/search', async (req, res) => {
  const { q } = req.query;
  if (!q) {
    return res.status(400).json({ error: 'Arama sorgusu boş olamaz.' });
  }
  try {
    const results = await searchChannelsOnYoutube(q);
    res.json(results);
  } catch (err) {
    console.error('[Channel Search Error]:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Kanal Ekle
router.post('/', async (req, res) => {
  const { input, name, handle, avatar, downloadShorts } = req.body;
  if (!input) return res.status(400).json({ error: 'Kanal adı veya adresi boş olamaz.' });

  try {
    let channelInfo;

    if (name && handle && /^UC[a-zA-Z0-9_-]{22}$/.test(input)) {
      channelInfo = {
        id: input,
        name: name,
        avatar: avatar || '',
        handle: handle
      };
    } else {
      channelInfo = await resolveChannelId(input);
    }

    const release = await acquireDbLock();
    let newChannel;
    try {
      const db = readDb();
      if (db.channels.some(c => c.id === channelInfo.id)) {
        return res.status(400).json({ error: 'Bu kanal zaten takip listesinde.' });
      }

      let extractedHandle = channelInfo.handle || '';
      if (!extractedHandle) {
        const decodedInput = decodeURIComponent(input);
        const handleMatch = decodedInput.match(/@([^/?\s]+)/);
        if (handleMatch) {
          extractedHandle = `@${handleMatch[1]}`;
        } else {
          extractedHandle = decodedInput.startsWith('@') ? decodedInput : `@${channelInfo.name.replace(/\s+/g, '')}`;
        }
      }

      newChannel = {
        id: channelInfo.id,
        name: channelInfo.name,
        handle: extractedHandle,
        addedAt: new Date().toISOString(),
        quality: 'default',
        downloadShorts: downloadShorts === true || downloadShorts === 'true',
        avatar: channelInfo.avatar || '',
        shortsDurationLimit: 180,
        autoDownload: true,
        subscriberCount: channelInfo.subscriberCount || ''
      };
      db.channels.push(newChannel);
      writeDb(db);
    } finally {
      release();
    }

    if (channelInfo.avatar) {
      try {
        await downloadChannelAvatar(channelInfo.avatar, channelInfo.name);
      } catch (avatarErr) {
        console.error(`[Kanal] Avatar indirme hatası:`, avatarErr.message);
      }
    }

    try {
      await checkSingleChannelRss(newChannel, true);
    } catch (rssErr) {
      console.error(`[Kanal] İlk RSS taraması başarısız oldu:`, rssErr.message);
      addTerminalLog(`[Kanal] "${newChannel.name}" için ilk taramada hata oluştu: ${rssErr.message}.`, 'warning');
    }

    const finalDb = readDb();
    broadcast('db_update', finalDb);
    broadcast('status_log', { message: `${channelInfo.name} kanalı başarıyla eklendi.`, type: 'success' });
    addTerminalLog(`[Kanal] Kanal takip listesine eklendi: "${channelInfo.name}" (ID: ${channelInfo.id})`, 'success');

    res.json({ success: true, channel: channelInfo });
  } catch (err) {
    addTerminalLog(`[Kanal] Kanal ekleme hatası (Giriş: "${input}") - Hata: ${err.message}`, 'error');
    res.status(500).json({ error: err.message || 'Kanal eklenemedi.' });
  }
});

// Kanal Sil
router.delete('/:id', (req, res) => {
  const { id } = req.params;
  if (!/^UC[a-zA-Z0-9_-]{22}$/.test(id)) {
    return res.status(400).json({ error: 'Geçersiz Kanal ID formatı.' });
  }
  const db = readDb();
  const channel = db.channels.find(c => c.id === id);
  
  if (!channel) return res.status(404).json({ error: 'Kanal bulunamadı.' });

  db.channels = db.channels.filter(c => c.id !== id);
  db.history = db.history.filter(h => h.channelId !== id);

  writeDb(db);
  broadcast('db_update', db);
  broadcast('status_log', { message: `${channel.name} kanalı takipten çıkarıldı.`, type: 'info' });
  addTerminalLog(`[Kanal] Kanal takip listesinden çıkarıldı: "${channel.name}" (ID: ${id})`, 'warning');
  res.json({ success: true });
});

// Tek bir kanalı manuel tara
router.post('/:id/sync', async (req, res) => {
  const { id } = req.params;
  if (!/^UC[a-zA-Z0-9_-]{22}$/.test(id)) {
    return res.status(400).json({ error: 'Geçersiz Kanal ID formatı.' });
  }
  try {
    const db = readDb();
    const channel = db.channels.find(c => c.id === id);
    if (!channel) return res.status(404).json({ error: 'Kanal bulunamadı.' });
    
    addTerminalLog(`[RSS] Tekil manuel tetikleme: "${channel.name}" denetleniyor...`, 'info');
    broadcast('channel_scan_progress', { current: 1, total: 1, channelName: channel.name, active: true });
    
    await checkSingleChannelRss(channel, false);
    resolveMissingDurations();
    
    broadcast('channel_scan_progress', { active: false });
    addTerminalLog(`[RSS] Tekil manuel tetikleme: "${channel.name}" denetimi tamamlandı.`, 'success');
    broadcast('status_log', { message: `"${channel.name}" kanalı başarıyla denetlendi.`, type: 'success' });
    res.json({ success: true, message: 'Kanal başarıyla denetlendi.' });
  } catch (err) {
    broadcast('channel_scan_progress', { active: false });
    res.status(500).json({ error: err.message });
  }
});

// Kanala özel kalite ayarla
router.post('/:id/quality', (req, res) => {
  const { id } = req.params;
  if (!/^UC[a-zA-Z0-9_-]{22}$/.test(id)) {
    return res.status(400).json({ error: 'Geçersiz Kanal ID formatı.' });
  }
  const { quality } = req.body;
  const db = readDb();
  const channel = db.channels.find(c => c.id === id);
  if (!channel) return res.status(404).json({ error: 'Kanal bulunamadı.' });

  channel.quality = quality;
  writeDb(db);
  broadcast('db_update', db);
  res.json({ success: true });
});

// Kanala özel Shorts indirme ayarını değiştir
router.post('/:id/shorts', (req, res) => {
  const { id } = req.params;
  if (!/^UC[a-zA-Z0-9_-]{22}$/.test(id)) {
    return res.status(400).json({ error: 'Geçersiz Kanal ID formatı.' });
  }
  const { downloadShorts } = req.body;
  const db = readDb();
  const channel = db.channels.find(c => c.id === id);
  if (!channel) return res.status(404).json({ error: 'Kanal bulunamadı.' });

  channel.downloadShorts = downloadShorts === true || downloadShorts === 'true';
  writeDb(db);
  broadcast('db_update', db);
  res.json({ success: true });
});

// Kanala özel otomatik video indirme ayarını değiştir
router.post('/:id/auto-download', (req, res) => {
  const { id } = req.params;
  if (!/^UC[a-zA-Z0-9_-]{22}$/.test(id)) {
    return res.status(400).json({ error: 'Geçersiz Kanal ID formatı.' });
  }
  const { autoDownload } = req.body;
  const db = readDb();
  const channel = db.channels.find(c => c.id === id);
  if (!channel) return res.status(404).json({ error: 'Kanal bulunamadı.' });

  channel.autoDownload = autoDownload === true || autoDownload === 'true';
  writeDb(db);
  broadcast('db_update', db);
  res.json({ success: true });
});

// Kanala özel Shorts limit süresini değiştir
router.post('/:id/shorts-limit', (req, res) => {
  const { id } = req.params;
  if (!/^UC[a-zA-Z0-9_-]{22}$/.test(id)) {
    return res.status(400).json({ error: 'Geçersiz Kanal ID formatı.' });
  }
  const { limit } = req.body;
  const db = readDb();
  const channel = db.channels.find(c => c.id === id);
  if (!channel) return res.status(404).json({ error: 'Kanal bulunamadı.' });

  channel.shortsDurationLimit = parseInt(limit, 10) || 180;
  writeDb(db);
  broadcast('db_update', db);
  res.json({ success: true });
});

// Tüm kanalların logolarını YouTube'dan yeniden çözümle, güncelle ve yerel diske indir
router.post('/update-all-avatars', localhostOnly, async (req, res) => {
  const db = readDb();
  if (db.channels.length === 0) {
    return res.json({ success: true, message: 'İzlenen kanal bulunmuyor.' });
  }

  addTerminalLog('[Kanal] Toplu kanal logosu güncellemesi başlatıldı...', 'info');
  console.log('[Kanal] Toplu kanal logosu güncellemesi başlatıldı...');
  
  let updatedCount = 0;
  let failedCount = 0;

  for (const channel of db.channels) {
    try {
      const channelUrl = channel.handle && channel.handle.startsWith('http') 
        ? channel.handle 
        : `https://www.youtube.com/${channel.handle && channel.handle.startsWith('@') ? channel.handle : '@' + channel.name.replace(/\s+/g, '')}`;
        
      console.log(`[Kanal] Logo güncelleniyor: ${channel.name}`);
      const info = await resolveChannelId(channelUrl);
      if (info && info.avatar) {
        channel.avatar = info.avatar;
        await downloadChannelAvatar(info.avatar, channel.name);
        updatedCount++;
      } else {
        failedCount++;
      }
      // Bot engellemesini önlemek için 500ms bekletiyoruz
      await new Promise(r => setTimeout(r, 500));
    } catch (e) {
      console.error(`[Kanal] Logo güncelleme hatası (${channel.name}):`, e.message);
      failedCount++;
    }
  }

  writeDb(db);
  broadcast('db_update', db);
  broadcast('status_log', { message: `Toplu logo güncelleme tamamlandı. Başarılı: ${updatedCount}, Başarısız: ${failedCount}`, type: 'success' });
  addTerminalLog(`[Kanal] Toplu logo güncelleme tamamlandı. Başarılı: ${updatedCount}, Başarısız: ${failedCount}`, 'success');

  res.json({ success: true, updatedCount, failedCount });
});

// Kanala özel profil resmi güncelle
router.post('/:id/update-avatar', async (req, res) => {
  const { id } = req.params;
  if (!/^UC[a-zA-Z0-9_-]{22}$/.test(id)) {
    return res.status(400).json({ error: 'Geçersiz Kanal ID formatı.' });
  }
  
  try {
    const db = readDb();
    const channel = db.channels.find(c => c.id === id);
    if (!channel) return res.status(404).json({ error: 'Kanal bulunamadı.' });
    
    const channelUrl = channel.handle && channel.handle.startsWith('http') 
      ? channel.handle 
      : `https://www.youtube.com/${channel.handle && channel.handle.startsWith('@') ? channel.handle : '@' + channel.name.replace(/\s+/g, '')}`;
      
    addTerminalLog(`[Kanal] Kanal logosu güncelleniyor: "${channel.name}"`, 'info');
    const info = await resolveChannelId(channelUrl);
    if (info && info.avatar) {
      channel.avatar = info.avatar;
      
      // Logo güncellendiğinde yerel avatar dosyasını ve klasör simgesini güncelleriz.
      await downloadChannelAvatar(info.avatar, channel.name);
      
      writeDb(db);
      broadcast('db_update', db);
      broadcast('status_log', { message: `${channel.name} kanal logosu güncellendi.`, type: 'success' });
      addTerminalLog(`[Kanal] Kanal logosu başarıyla güncellendi: "${channel.name}"`, 'success');
      return res.json({ success: true, avatar: channel.avatar });
    }
    res.status(400).json({ error: 'Avatar güncellenemedi.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Tüm kanalların abone sayılarını güncelle
router.post('/update-all-subscribers', localhostOnly, async (req, res) => {
  const db = readDb();
  if (db.channels.length === 0) {
    return res.json({ success: true, message: 'İzlenen kanal bulunmuyor.' });
  }

  addTerminalLog('[Kanal] Toplu abone sayısı güncellemesi başlatıldı...', 'info');
  console.log('[Kanal] Toplu abone sayısı güncellemesi başlatıldı...');
  
  let updatedCount = 0;
  let failedCount = 0;

  for (const channel of db.channels) {
    try {
      const channelUrl = channel.handle && channel.handle.startsWith('http') 
        ? channel.handle 
        : `https://www.youtube.com/${channel.handle && channel.handle.startsWith('@') ? channel.handle : '@' + channel.name.replace(/\s+/g, '')}`;
        
      console.log(`[Kanal] Abone sayısı güncelleniyor: ${channel.name}`);
      const info = await resolveChannelId(channelUrl, channel.id);
      channel.subscriberCount = info && info.subscriberCount ? info.subscriberCount : (channel.subscriberCount || '?');
      updatedCount++;
      // Bot engellemesini önlemek için 500ms bekletiyoruz
      await new Promise(r => setTimeout(r, 500));
    } catch (e) {
      console.error(`[Kanal] Abone sayısı güncelleme hatası (${channel.name}):`, e.message);
      channel.subscriberCount = channel.subscriberCount || '?';
      failedCount++;
    }
  }

  writeDb(db);
  broadcast('db_update', db);
  broadcast('status_log', { message: `Toplu abone sayısı güncelleme tamamlandı. Güncellenen: ${updatedCount}, Alınamayan: ${failedCount}`, type: 'success' });
  addTerminalLog(`[Kanal] Toplu abone sayısı güncelleme tamamlandı. Güncellenen: ${updatedCount}, Alınamayan: ${failedCount}`, 'success');

  res.json({ success: true, updatedCount, failedCount });
});

// Kanala özel abone sayısı güncelle
router.post('/:id/update-subscribers', async (req, res) => {
  const { id } = req.params;
  if (!/^UC[a-zA-Z0-9_-]{22}$/.test(id)) {
    return res.status(400).json({ error: 'Geçersiz Kanal ID formatı.' });
  }
  
  try {
    const db = readDb();
    const channel = db.channels.find(c => c.id === id);
    if (!channel) return res.status(404).json({ error: 'Kanal bulunamadı.' });
    
    const channelUrl = channel.handle && channel.handle.startsWith('http') 
      ? channel.handle 
      : `https://www.youtube.com/${channel.handle && channel.handle.startsWith('@') ? channel.handle : '@' + channel.name.replace(/\s+/g, '')}`;
      
    addTerminalLog(`[Kanal] Kanal abone sayısı güncelleniyor: "${channel.name}"`, 'info');
    const info = await resolveChannelId(channelUrl, id);
    
    const subCount = info && info.subscriberCount ? info.subscriberCount : (channel.subscriberCount || '?');
    channel.subscriberCount = subCount;
    
    writeDb(db);
    broadcast('db_update', db);
    
    const displayMsg = subCount === '?'
      ? `${channel.name} kanal abone sayısı alınamadı, "?" olarak belirlendi.`
      : `${channel.name} kanal abone sayısı güncellendi: ${subCount}`;
      
    broadcast('status_log', { message: displayMsg, type: subCount === '?' ? 'warning' : 'success' });
    addTerminalLog(`[Kanal] Kanal abone sayısı güncellendi: "${channel.name}" (${subCount})`, subCount === '?' ? 'warning' : 'success');
    
    return res.json({ success: true, subscriberCount: subCount });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Kanal Profil Resmi Sunumu (ID ile)
router.get('/:id/avatar', (req, res) => {
  const { id } = req.params;
  const db = readDb();
  const channel = db.channels.find(c => c.id === id);
  if (!channel) return res.status(404).send('Kanal bulunamadı.');
  
  const avatarPath = path.join(db.settings.downloadPath, channel.name, 'avatar.jpg');
  if (fs.existsSync(avatarPath)) {
    return res.sendFile(avatarPath);
  }
  
  if (channel.avatar) {
    return res.redirect(channel.avatar);
  }
  
  res.status(404).send('Avatar bulunamadı.');
});

// YouTube Arama Fonksiyonu
export function searchChannelsOnYoutube(query) {
  const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}&sp=EgIQAg%3D%3D`;
  return new Promise((resolve, reject) => {
    https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7'
      }
    }, (res) => {
      if (res.statusCode !== 200) {
        return reject(new Error(`YouTube sunucu hatası: HTTP ${res.statusCode}`));
      }

      let html = '';
      res.on('data', chunk => { html += chunk; });
      res.on('end', () => {
        try {
          const match = html.match(/ytInitialData\s*=\s*({.+?})\s*(?:<\/script>|;)/);
          if (!match) {
            return resolve([]);
          }

          const data = JSON.parse(match[1]);
          const results = [];
          const contents = data.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents?.[0]?.itemSectionRenderer?.contents || [];

          for (const item of contents) {
            if (item.channelRenderer) {
              const r = item.channelRenderer;
              const channelId = r.channelId;
              const title = r.title?.simpleText || r.title?.runs?.[0]?.text;
              
              let handleName = '';
              const navEndpoint = r.navigationEndpoint?.commandMetadata?.webCommandMetadata?.url;
              if (navEndpoint && navEndpoint.includes('/@')) {
                handleName = decodeURIComponent(navEndpoint.replace('/', ''));
              } else {
                handleName = `@${channelId}`;
              }

              const avatarSources = r.thumbnail?.thumbnails || [];
              const avatar = avatarSources[avatarSources.length - 1]?.url || '';
              const subscriberCount = r.subscriberCountText?.simpleText || '';

              results.push({
                id: channelId,
                name: title,
                handle: handleName,
                avatar: avatar.startsWith('//') ? 'https:' + avatar : avatar,
                subscribers: subscriberCount
              });
            }
          }
          resolve(results);
        } catch (err) {
          reject(err);
        }
      });
    }).on('error', reject);
  });
}

// YouTube Kanal ID'sini ve Bilgilerini Çözümleme Fonksiyonu
export async function resolveChannelId(input, existingChannelId = null) {
  const decodedInput = decodeURIComponent(input.trim());
  let targetUrl = decodedInput;
  let isVideoUrl = false;

  if (/^UC[a-zA-Z0-9_-]{22}$/.test(decodedInput)) {
    targetUrl = `https://www.youtube.com/channel/${decodedInput}`;
  } else {
    const videoMatch = decodedInput.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/))([^?&"'>\s]{11})/);
    if (videoMatch) {
      const videoId = videoMatch[1];
      targetUrl = `https://www.youtube.com/watch?v=${videoId}`;
      isVideoUrl = true;
      console.log(`Video URL'si tespit edildi. Video ID: ${videoId}`);
    } else if (!decodedInput.startsWith('http')) {
      if (decodedInput.startsWith('@')) {
        targetUrl = `https://www.youtube.com/${decodedInput}`;
      } else {
        targetUrl = `https://www.youtube.com/@${decodedInput}`;
      }
    }
  }

  console.log(`Çözümlenecek adres: ${targetUrl}`);
  
  let fallbackChannelId = existingChannelId;
  const directIdMatch = targetUrl.match(/\/channel\/(UC[a-zA-Z0-9_-]{22})/);
  if (directIdMatch) {
    fallbackChannelId = directIdMatch[1];
  } else if (/^UC[a-zA-Z0-9_-]{22}$/.test(decodedInput)) {
    fallbackChannelId = decodedInput;
  }

  async function tryRssFallback(channelId) {
    try {
      console.log(`[RSS Fallback] ${channelId} için RSS XML çekilmeye çalışılıyor...`);
      const db = readDb();
      const hl = db.settings?.lang === 'en' ? 'en' : 'tr';
      const xml = await fetchWithProxyWaterfall(`https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}&hl=${hl}`);
      
      const titleMatch = xml.match(/<title>([^<]+)<\/title>/);
      let channelName = titleMatch ? titleMatch[1].replace(' - YouTube', '').trim() : `Kanal ${channelId}`;
      const authorMatch = xml.match(/<author>\s*<name>([^<]+)<\/name>/);
      if (authorMatch) {
        channelName = authorMatch[1].trim();
      }

      let avatarUrl = '';
      try {
        const db = readDb();
        const args = [];
        args.push('--js-runtimes', `node:${process.execPath}`);
        if (db.settings.browser && db.settings.browser !== 'none') {
          const browserName = db.settings.browser === 'msedge' ? 'edge' : db.settings.browser;
          args.push('--cookies-from-browser', browserName);
        }
        args.push('--dump-json', '--playlist-items', '0', `https://www.youtube.com/channel/${channelId}`);
        
        const spawnOptions = process.platform === 'win32' ? { windowsVerbatimArguments: false, windowsHide: true } : {};
        
        const ytdlpOutput = await new Promise((resDl, rejDl) => {
          const proc = spawn(ytdlpPath, args, spawnOptions);
          let out = '';
          let err = '';
          proc.stdout.on('data', (d) => { out += d.toString(); });
          proc.stderr.on('data', (d) => { err += d.toString(); });
          proc.on('close', (code) => {
            if (code !== 0) return rejDl(new Error(`Exit code ${code}. Stderr: ${err}`));
            resDl(out);
          });
        });

        const parsedData = JSON.parse(ytdlpOutput);
        if (parsedData.thumbnails && parsedData.thumbnails.length > 0) {
          const sortedThumbs = [...parsedData.thumbnails].sort((a, b) => (b.width || 0) - (a.width || 0));
          avatarUrl = sortedThumbs[0].url || '';
        }
        let subCount = '';
        if (parsedData.subscriber_count) {
          const subs = parsedData.subscriber_count;
          if (subs >= 1000000) {
            subCount = (subs / 1000000).toFixed(1) + 'M';
          } else if (subs >= 1000) {
            subCount = (subs / 1000).toFixed(1) + 'K';
          } else {
            subCount = subs.toString();
          }
        }
        return {
          id: channelId,
          name: channelName,
          avatar: avatarUrl,
          subscriberCount: subCount
        };
      } catch (avatarErr) {
        console.log(`[RSS Fallback] yt-dlp ile logo çekilemedi: ${avatarErr.message}`);
      }

      return {
        id: channelId,
        name: channelName,
        avatar: avatarUrl,
        subscriberCount: ''
      };
    } catch (err) {
      console.log(`[RSS Fallback] RSS XML de başarısız oldu: ${err.message}. Varsayılan isimle ekleniyor.`);
      return {
        id: channelId,
        name: `Kanal ${channelId}`,
        avatar: ''
      };
    }
  }

  try {
    let html = '';
    try {
      html = await fetchWithProxyWaterfall(targetUrl);
    } catch (fetchErr) {
      console.warn(`[Scraper] HTML fetch başarısız oldu: ${fetchErr.message}. yt-dlp yedek mekanizmasıyla devam edilecek.`);
    }
    let channelId = null;
    let channelName = null;

    if (isVideoUrl) {
      channelId = html.match(/"externalChannelId"\s*:\s*"(UC[a-zA-Z0-9_-]{22})"/)?.[1] ||
                  html.match(/"channelId"\s*:\s*"(UC[a-zA-Z0-9_-]{22})"/)?.[1] ||
                  html.match(/\/channel\/(UC[a-zA-Z0-9_-]{22})/)?.[1];
      
      channelName = html.match(/<link itemprop="name" content="([^"]+)"/)?.[1] ||
                    html.match(/"author"\s*:\s*"([^"]+)"/)?.[1];
    } else {
      channelId = html.match(/<meta itemprop="channelId" content="(UC[a-zA-Z0-9_-]{22})"/)?.[1] ||
                  html.match(/<link rel="canonical" href="[^"]*youtube\.com\/channel\/(UC[a-zA-Z0-9_-]{22})"/)?.[1] ||
                  html.match(/youtube\.com\/feeds\/videos\.xml\?channel_id=(UC[a-zA-Z0-9_-]{22})/)?.[1] ||
                  html.match(/"browseId"\s*:\s*"(UC[a-zA-Z0-9_-]{22})"/)?.[1] ||
                  html.match(/"channelId"\s*:\s*"(UC[a-zA-Z0-9_-]{22})"/)?.[1] ||
                  html.match(/\/channel\/(UC[a-zA-Z0-9_-]{22})/)?.[1];
      
      const ogTitleMatch = html.match(/<meta property="og:title" content="([^"]+)"/);
      const titleMatch = html.match(/<title>([^<]+)<\/title>/);
      channelName = ogTitleMatch?.[1] || titleMatch?.[1];
    }

    if (channelName) {
      channelName = channelName.replace(' - YouTube', '').trim();
    }

    let avatarUrl = '';
    const ogImageMatch = html.match(/<meta property="og:image" content="([^"]+)"/);
    const linkImageMatch = html.match(/<link rel="image_src" href="([^"]+)"/);
    if (ogImageMatch) {
      avatarUrl = ogImageMatch[1];
    } else if (linkImageMatch) {
      avatarUrl = linkImageMatch[1];
    } else {
      const avatarMatch = html.match(/"avatarViewModel"\s*:\s*\{\s*"image"\s*:\s*\{\s*"sources"\s*:\s*\[\s*\{\s*"url"\s*:\s*"([^"]+)"/);
      avatarUrl = avatarMatch ? avatarMatch[1] : '';
    }

    let subCount = '';
    
    // 1. Yöntem: subtitle objesi (Örn: "377 B abone")
    const subTitleMatch = html.match(/"subtitle"\s*:\s*\{\s*"content"\s*:\s*"[^"]*(?:•|·|\\u2022)[^\d]*([\d.,\s\u00a0\u202f]+(?:bin|B|milyon|M|K|abone|subscriber|subscribers|subs)[^"⁩]*)/i);
    if (subTitleMatch) {
      subCount = subTitleMatch[1].trim();
    }
    
    // 2. Yöntem: accessibilityLabel (Örn: "377 bin abone")
    if (!subCount) {
      const accessLabelMatch = html.match(/"accessibilityLabel"\s*:\s*"([^"]*(?:abone|subscriber|subscribers)[^"]*)"/i);
      if (accessLabelMatch) {
        subCount = accessLabelMatch[1].trim();
      }
    }

    // 3. Yöntem: Geleneksel subscriberCountText objesi
    if (!subCount) {
      const idx = html.indexOf('"subscriberCountText"');
      if (idx !== -1) {
        const subChunk = html.slice(idx, idx + 500);
        const simpleMatch = subChunk.match(/"simpleText"\s*:\s*"([^"]+)"/);
        const labelMatch = subChunk.match(/"label"\s*:\s*"([^"]+)"/);
        if (simpleMatch) {
          subCount = simpleMatch[1];
        } else if (labelMatch) {
          subCount = labelMatch[1];
        }
      }
    }

    // 4. Yöntem: Meta Description
    if (!subCount) {
      const descMatch = html.match(/<meta\s+name="description"\s+content="([^"]+)"/i) ||
                        html.match(/<meta\s+property="og:description"\s+content="([^"]+)"/i);
      if (descMatch) {
        const descContent = descMatch[1];
        const trSub = descContent.match(/([\d.,]+\s*(?:bin|B|milyon|M)?)\s*abone/i);
        const enSub = descContent.match(/([\d.,]+\s*(?:[KMB]?))\s*subscribers/i);
        if (trSub) {
          subCount = trSub[1].trim() + ' abone';
        } else if (enSub) {
          subCount = enSub[1].trim() + ' subs';
        }
      }
    }

    // 5. Yöntem: Yedek olarak yt-dlp
    if (!subCount) {
      console.log(`[Scraper] HTML üzerinden abone sayısı bulunamadı. yt-dlp ile yedek sorgulama deneniyor...`);
      subCount = await getChannelSubscribersViaYtdlp(targetUrl);
    }
    
    // Eğer hâlâ yoksa "?" yapalım
    if (!subCount) {
      subCount = '?';
    }

    const vanityMatch = html.match(/"vanityChannelUrl"\s*:\s*"https?:\/\/www\.youtube\.com\/(@[^"]+)"/);
    const handleVal = vanityMatch ? vanityMatch[1] : '';

    if (channelId) {
      console.log(`[Scraper] Kanal ID bulundu: ${channelId}. Gerçek kanal adını doğrulamak için RSS beslemesi sorgulanıyor...`);
      try {
        const rssInfo = await tryRssFallback(channelId);
        console.log(`[Scraper] RSS ile doğrulanan Kanal: ${rssInfo.name} (ID: ${channelId})`);
        return {
          id: channelId,
          name: rssInfo.name || channelName || `Kanal ${channelId}`,
          avatar: avatarUrl || rssInfo.avatar || '',
          handle: handleVal || '',
          subscriberCount: subCount || rssInfo.subscriberCount || ''
        };
      } catch (err) {
        console.log(`[Scraper] RSS sorgusu başarısız oldu, kazınan verilerle devam ediliyor: ${err.message}`);
        return {
          id: channelId,
          name: channelName || `Kanal ${channelId}`,
          avatar: avatarUrl || '',
          handle: handleVal || '',
          subscriberCount: subCount || ''
        };
      }
    } else {
      if (fallbackChannelId) {
        const rssInfo = await tryRssFallback(fallbackChannelId);
        return {
          ...rssInfo,
          subscriberCount: subCount || rssInfo.subscriberCount || ''
        };
      }
      throw new Error('Kanal ID veya kanal adı tespit edilemedi. Lütfen adresi kontrol edin.');
    }
  } catch (err) {
    if (fallbackChannelId) {
      return await tryRssFallback(fallbackChannelId);
    }
    throw err;
  }
}

// yt-dlp ile kanal abone sayısını çekme yedek fonksiyonu
export function getChannelSubscribersViaYtdlp(channelUrl) {
  return new Promise((resolve) => {
    const db = readDb();
    const args = [
      '--js-runtimes', `node:${process.execPath}`,
      '--print', 'subscriber_count'
    ];
    if (db.settings.browser && db.settings.browser !== 'none') {
      const browserName = db.settings.browser === 'msedge' ? 'edge' : db.settings.browser;
      args.push('--cookies-from-browser', browserName);
    }
    args.push(channelUrl);

    const spawnOptions = process.platform === 'win32' ? { windowsVerbatimArguments: false, windowsHide: true } : {};
    const proc = spawn(ytdlpPath, args, spawnOptions);
    
    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', (d) => { stdout += d.toString(); });
    proc.stderr.on('data', (d) => { stderr += d.toString(); });
    proc.on('close', (code) => {
      if (code === 0) {
        const subs = parseInt(stdout.trim(), 10);
        if (!isNaN(subs)) {
          let subCount = '';
          if (subs >= 1000000) {
            subCount = (subs / 1000000).toFixed(1) + 'M';
          } else if (subs >= 1000) {
            subCount = (subs / 1000).toFixed(1) + 'K';
          } else {
            subCount = subs.toString();
          }
          return resolve(subCount);
        }
      }
      console.error(`[yt-dlp Subscriber Fetch Error]:`, stderr);
      resolve('');
    });
  });
}
