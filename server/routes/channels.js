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
  resolveMissingDurations,
  fetchVideoDuration,
  fetchDurationViaYtdlp,
  isRssChecking
} from '../services/rss.js';
import { broadcast, addTerminalLog } from '../services/sse.js';
import { getLocalTempDir, cleanMeiForPid, spawnYtdlp, ytdlpPath } from '../services/paths.js';
import { fetchPipedChannels, fetchPipedChannelInfo } from '../services/proxyManager.js';

export const router = express.Router();

export let isChannelScanInProgress = false;
export let channelScanStartTime = 0;

/**
 * Kanal taraması durumunu ayarlar.
 * @param {boolean} status 
 */
export function setChannelScanInProgress(status) {
  isChannelScanInProgress = !!status;
  channelScanStartTime = isChannelScanInProgress ? Date.now() : 0;
}

/**
 * Takip edilen YouTube kanallarının listesini veritabanından çeker.
 * 
 * @name GET /api/channels
 * @function
 * @inner
 * @param {object} req - Express istek nesnesi
 * @param {object} res - Express yanıt nesnesi
 * @returns {void}
 */
router.get('/', (req, res) => {
  const db = readDb();
  res.json(db.channels || []);
});

/**
 * channels.ini yapılandırma dosyasını istemciye indirilebilir olarak gönderir.
 * 
 * @name GET /api/channels/export
 * @function
 * @inner
 * @param {object} req - Express istek nesnesi
 * @param {object} res - Express yanıt nesnesi
 * @returns {void}
 */
router.get('/export', (req, res) => {
  if (!fs.existsSync(channelsIniPath)) {
    return res.status(404).send('channels.ini bulunamadı.');
  }
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename=channels.ini');
  res.sendFile(channelsIniPath);
});

/**
 * Gönderilen raw ini verisini channels.ini olarak kaydeder ve veritabanı ile eşitler.
 * 
 * @name POST /api/channels/import
 * @function
 * @inner
 * @param {object} req - Express istek nesnesi
 * @param {object} res - Express yanıt nesnesi
 * @returns {void}
 */
router.post('/import', localhostOnly, (req, res) => {
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

/**
 * YouTube üzerinde kanal araması yapar.
 * 
 * @name GET /api/channels/search
 * @function
 * @inner
 * @param {object} req - Express istek nesnesi
 * @param {string} req.query.q - Arama sorgusu
 * @param {object} res - Express yanıt nesnesi
 * @returns {Promise<void>}
 */
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
router.post('/', localhostOnly, async (req, res) => {
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

    // Yeni eklenen kanalın süresi eksik videolarını çözmek için arka planda süre çözücüyü tetikle
    resolveMissingDurations();

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

/**
 * Belirtilen kanalı manuel olarak hemen tarar / RSS akışını kontrol eder.
 * 
 * @name POST /api/channels/:id/sync
 * @function
 * @inner
 * @param {object} req - Express istek nesnesi
 * @param {string} req.params.id - Kanalın YouTube kimliği (ID)
 * @param {object} res - Express yanıt nesnesi
 * @returns {Promise<void>}
 */
router.post('/:id/sync', localhostOnly, async (req, res) => {
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
    
    // Arayüze ilerlemeyi bildir ve süresiz/boyutsuz videoların metadatalarını çöz
    addTerminalLog(`[Metadata] "${channel.name}" kanalı için süre ve boyut bilgileri yenileniyor...`, 'info');
    
    const releaseWrite = await acquireDbLock();
    try {
      const freshDb = readDb();
      let updatedCount = 0;
      for (const item of freshDb.history) {
        if (item.channelId !== id) continue;
        
        let itemUpdated = false;

        // Dosya boyutu kontrolü
        if (item.status === 'completed' && item.filePath) {
          try {
            if (fs.existsSync(item.filePath)) {
              const stats = fs.statSync(item.filePath);
              const sizeInBytes = stats.size;
              let calculatedSize = '';
              if (sizeInBytes >= 1024 * 1024 * 1024) {
                calculatedSize = Math.round(sizeInBytes / (1024 * 1024 * 1024)) + ' GB';
              } else {
                calculatedSize = Math.round(sizeInBytes / (1024 * 1024)) + ' MB';
              }
              if (item.fileSize !== calculatedSize) {
                item.fileSize = calculatedSize;
                itemUpdated = true;
              }
            }
          } catch (err) {
            console.error(`[RSS Metadata] Boyut hatası (${item.title}):`, err.message);
          }
        }

        // Süre kontrolü
        const needsDuration = !item.duration || item.duration === '-' || item.duration === 'unknown';
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
            console.error(`[RSS Metadata] Süre hatası (${item.title}):`, err.message);
          }
        }

        if (itemUpdated) {
          updatedCount++;
        }
      }

      if (updatedCount > 0) {
        writeDb(freshDb);
        broadcast('db_update', freshDb);
      }
    } finally {
      releaseWrite();
    }
    
    resolveMissingDurations();
    
    broadcast('channel_scan_progress', { active: false });
    addTerminalLog(`[RSS] Tekil manuel tetikleme: "${channel.name}" denetimi ve metadata yenilemesi tamamlandı.`, 'success');
    broadcast('status_log', { message: `"${channel.name}" kanalı başarıyla denetlendi ve güncellendi.`, type: 'success' });
    res.json({ success: true, message: 'Kanal başarıyla denetlendi ve güncellendi.' });
  } catch (err) {
    broadcast('channel_scan_progress', { active: false });
    res.status(500).json({ error: err.message });
  }
});

/**
 * Belirtilen kanalın indirme kalitesi tercihini günceller.
 * 
 * @name POST /api/channels/:id/quality
 * @function
 * @inner
 * @param {object} req - Express istek nesnesi
 * @param {string} req.params.id - Kanalın YouTube kimliği (ID)
 * @param {string} req.body.quality - Hedef video kalitesi (örn. 'best', '1080p')
 * @param {object} res - Express yanıt nesnesi
 * @returns {void}
 */
router.post('/:id/quality', localhostOnly, (req, res) => {
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

/**
 * Belirtilen kanal için Shorts videolarının indirilip indirilmeyeceğini günceller.
 * 
 * @name POST /api/channels/:id/shorts
 * @function
 * @inner
 * @param {object} req - Express istek nesnesi
 * @param {string} req.params.id - Kanalın YouTube kimliği (ID)
 * @param {boolean} req.body.downloadShorts - Shorts indirme durumu
 * @param {object} res - Express yanıt nesnesi
 * @returns {void}
 */
router.post('/:id/shorts', localhostOnly, (req, res) => {
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

/**
 * Belirtilen kanal için otomatik indirme özelliğini açıp kapatır.
 * 
 * @name POST /api/channels/:id/auto-download
 * @function
 * @inner
 * @param {object} req - Express istek nesnesi
 * @param {string} req.params.id - Kanalın YouTube kimliği (ID)
 * @param {boolean} req.body.autoDownload - Otomatik indirme durumu
 * @param {object} res - Express yanıt nesnesi
 * @returns {void}
 */
router.post('/:id/auto-download', localhostOnly, (req, res) => {
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

/**
 * Belirtilen kanal için indirilecek Shorts videolarının maksimum süre limitini günceller.
 * 
 * @name POST /api/channels/:id/shorts-limit
 * @function
 * @inner
 * @param {object} req - Express istek nesnesi
 * @param {string} req.params.id - Kanalın YouTube kimliği (ID)
 * @param {number} req.body.limit - Saniye cinsinden Shorts süre sınırı
 * @param {object} res - Express yanıt nesnesi
 * @returns {void}
 */
router.post('/:id/shorts-limit', localhostOnly, (req, res) => {
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

/**
 * Belirtilen kanalın kategori kimliğini (ID) günceller.
 */
router.post('/:id/category', localhostOnly, (req, res) => {
  const { id } = req.params;
  if (!/^UC[a-zA-Z0-9_-]{22}$/.test(id)) {
    return res.status(400).json({ error: 'Geçersiz Kanal ID formatı.' });
  }
  const { categoryId, categoryIds } = req.body;
  const db = readDb();
  const channel = db.channels.find(c => c.id === id);
  if (!channel) return res.status(404).json({ error: 'Kanal bulunamadı.' });

  if (categoryIds && Array.isArray(categoryIds)) {
    channel.categoryIds = categoryIds.map(x => parseInt(x, 10) || 1);
    channel.categoryId = channel.categoryIds[0] || 1;
  } else if (categoryId !== undefined) {
    channel.categoryId = parseInt(categoryId, 10) || 1;
    channel.categoryIds = [channel.categoryId];
  }
  writeDb(db);
  broadcast('db_update', db);
  res.json({ success: true });
});

/**
 * Kategorilerin listesini döner.
 */
router.get('/categories', (req, res) => {
  const db = readDb();
  res.json(db.categories || []);
});

/**
 * Yeni kategori ekler.
 */
router.post('/categories', localhostOnly, (req, res) => {
  const { name } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Kategori adı boş olamaz.' });
  }
  const db = readDb();
  db.categories = db.categories || [];
  
  const maxId = db.categories.reduce((max, cat) => cat.id > max ? cat.id : max, 0);
  const newCat = {
    id: maxId + 1,
    name: name.trim()
  };
  
  db.categories.push(newCat);
  writeDb(db);
  broadcast('db_update', db);
  res.json({ success: true, category: newCat });
});

/**
 * Kategori günceller (adını değiştirir).
 */
router.put('/categories/:id', localhostOnly, (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { name } = req.body;
  if (isNaN(id) || !name || !name.trim()) {
    return res.status(400).json({ error: 'Geçersiz parametreler.' });
  }
  const db = readDb();
  db.categories = db.categories || [];
  const cat = db.categories.find(c => c.id === id);
  if (!cat) return res.status(404).json({ error: 'Kategori bulunamadı.' });
  
  cat.name = name.trim();
  writeDb(db);
  broadcast('db_update', db);
  res.json({ success: true });
});

/**
 * Kategori siler. Kategori silindiğinde o kategoriye ait kanalların kategorisi 1 (Genel) yapılır.
 */
router.delete('/categories/:id', localhostOnly, (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    return res.status(400).json({ error: 'Geçersiz Kategori ID.' });
  }
  if (id === 1) {
    return res.status(400).json({ error: 'Varsayılan kategori silinemez.' });
  }
  const db = readDb();
  db.categories = db.categories || [];
  db.categories = db.categories.filter(c => c.id !== id);
  
  if (db.channels) {
    db.channels.forEach(c => {
      if (c.categoryIds && Array.isArray(c.categoryIds)) {
        c.categoryIds = c.categoryIds.filter(cid => cid !== id);
        if (c.categoryIds.length === 0) {
          c.categoryIds = [1];
        }
        c.categoryId = c.categoryIds[0] || 1;
      } else {
        if (c.categoryId === id) {
          c.categoryId = 1;
        }
        c.categoryIds = [c.categoryId || 1];
      }
    });
  }
  
  writeDb(db);
  broadcast('db_update', db);
  res.json({ success: true });
});

/**
 * Takip edilen tüm kanalların logolarını YouTube'dan çekip günceller.
 * 
 * @name POST /api/channels/update-all-avatars
 * @function
 * @inner
 * @param {object} req - Express istek nesnesi
 * @param {object} res - Express yanıt nesnesi
 * @returns {Promise<void>}
 */
/**
 * Belirtilen kanalın abone sayısı ve avatarını YouTube üzerinden günceller.
 * 1. Seçenek: Resmi ve kalıcı YouTube Kanal ID URL'si (Örn: https://www.youtube.com/channel/UC...)
 * 2. Seçenek: Yedek olarak Kanal Handle veya İsim URL'si
 * 
 * @param {object} channel Kanal nesnesi
 * @returns {Promise<object>} Güncellenen kanal nesnesi
 */
async function updateChannelFullInfo(channel) {
  // 1. Birincil ve en güvenilir kaynak: Doğrudan resmi YouTube UC Kanal ID URL'si
  const channelIdUrl = `https://www.youtube.com/channel/${channel.id}`;
  let info = await resolveChannelId(channelIdUrl, channel.id);

  // 2. Yedek kaynak: Eğer kanal ID üzerinden abone sayısı/avatar alınamadıysa Handle veya İsim URL'sini dene
  if (!info || !info.subscriberCount || info.subscriberCount === '?') {
    const handleUrl = channel.handle && channel.handle.startsWith('http') 
      ? channel.handle 
      : `https://www.youtube.com/${channel.handle && channel.handle.startsWith('@') ? channel.handle : '@' + channel.name.replace(/\s+/g, '')}`;
    const fallbackInfo = await resolveChannelId(handleUrl, channel.id);
    if (fallbackInfo) {
      if (fallbackInfo.subscriberCount && fallbackInfo.subscriberCount !== '?') {
        if (!info) info = {};
        info.subscriberCount = fallbackInfo.subscriberCount;
      }
      if (fallbackInfo.avatar && (!info || !info.avatar)) {
        if (!info) info = {};
        info.avatar = fallbackInfo.avatar;
      }
    }
  }

  if (info) {
    if (info.subscriberCount && info.subscriberCount !== '?') {
      channel.subscriberCount = info.subscriberCount;
    }
    if (info.avatar && typeof info.avatar === 'string' && info.avatar.startsWith('http')) {
      channel.avatar = info.avatar;
      try {
        await downloadChannelAvatar(info.avatar, channel.name);
      } catch (e) {}
    }
  }
  return channel;
}

router.post('/update-all-info', localhostOnly, async (req, res) => {
  if (isChannelScanInProgress) {
    const elapsed = channelScanStartTime > 0 ? (Date.now() - channelScanStartTime) / 1000 : 0;
    if (channelScanStartTime > 0 && elapsed > 300) {
      console.warn(`[Kanal Kontrolü UYARI] Önceki kanal bilgisi taraması zaman aşımına uğradı (${elapsed.toFixed(0)} sn). Kilit sıfırlandı.`);
      setChannelScanInProgress(false);
    } else {
      return res.status(409).json({ success: false, inProgress: true, message: 'Zaten devam eden bir kanal bilgisi güncellemesi var.' });
    }
  }

  if (isRssChecking) {
    return res.status(409).json({ success: false, inProgress: true, message: 'Video RSS taraması devam ettiği için kanal güncellemesi başlatılamadı. Lütfen RSS taramasının bitmesini bekleyin.' });
  }

  const db = readDb();
  if (db.channels.length === 0) {
    return res.json({ success: true, message: 'İzlenen kanal bulunmuyor.' });
  }

  setChannelScanInProgress(true);
  addTerminalLog('[Kanal] Toplu abone ve avatar güncellemesi başlatıldı...', 'info');
  console.log('[Kanal] Toplu abone ve avatar güncellemesi başlatıldı...');
  
  let updatedCount = 0;
  let failedCount = 0;
  const totalChannels = db.channels.length;
  let currentIndex = 0;

  try {
    for (const channel of db.channels) {
      currentIndex++;
      try {
        const statusMsg = `[Abone & Avatar ${currentIndex}/${totalChannels}] Güncelleniyor: "${channel.name}"`;
        console.log(statusMsg);
        broadcast('status_log', { message: statusMsg, type: 'info' });
        addTerminalLog(statusMsg, 'info');

        await updateChannelFullInfo(channel);
        updatedCount++;
        await new Promise(r => setTimeout(r, 600));
      } catch (e) {
        console.error(`[Kanal] Abone ve avatar güncelleme hatası (${channel.name}):`, e.message);
        failedCount++;
      }
    }

    writeDb(db);
    broadcast('db_update', db);
    import('./gist.js').then(m => m.triggerAutoGistSync()).catch(() => {});

    const doneMsg = `[Abone & Avatar ${totalChannels}/${totalChannels}] Toplu kanal güncelleme tamamlandı. Başarılı: ${updatedCount}, Başarısız: ${failedCount}`;
    broadcast('status_log', { message: doneMsg, type: 'success' });
    addTerminalLog(doneMsg, 'success');

    res.json({ success: true, updatedCount, failedCount });
  } finally {
    setChannelScanInProgress(false);
  }
});

router.post('/:id/update-info', localhostOnly, async (req, res) => {
  const { id } = req.params;
  if (!/^UC[a-zA-Z0-9_-]{22}$/.test(id)) {
    return res.status(400).json({ error: 'Geçersiz Kanal ID formatı.' });
  }
  
  try {
    const db = readDb();
    const channel = db.channels.find(c => c.id === id);
    if (!channel) return res.status(404).json({ error: 'Kanal bulunamadı.' });
    
    addTerminalLog(`[Kanal] Kanal abone sayısı ve avatarı güncelleniyor: "${channel.name}"`, 'info');
    await updateChannelFullInfo(channel);
    
    writeDb(db);
    broadcast('db_update', db);
    
    const displayMsg = `${channel.name} kanal bilgileri (abone sayısı & avatar) güncellendi.`;
    broadcast('status_log', { message: displayMsg, type: 'success' });
    addTerminalLog(`[Kanal] Kanal bilgileri güncellendi: "${channel.name}"`, 'success');
    
    return res.json({ success: true, subscriberCount: channel.subscriberCount, avatar: channel.avatar });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/update-all-avatars', localhostOnly, async (req, res) => {
  if (isChannelScanInProgress) {
    const elapsed = channelScanStartTime > 0 ? (Date.now() - channelScanStartTime) / 1000 : 0;
    if (channelScanStartTime > 0 && elapsed > 300) {
      console.warn(`[Kanal Kontrolü UYARI] Önceki kanal bilgisi taraması zaman aşımına uğradı (${elapsed.toFixed(0)} sn). Kilit sıfırlandı.`);
      setChannelScanInProgress(false);
    } else {
      return res.status(409).json({ success: false, inProgress: true, message: 'Zaten devam eden bir kanal bilgisi güncellemesi var.' });
    }
  }

  if (isRssChecking) {
    return res.status(409).json({ success: false, inProgress: true, message: 'Video RSS taraması devam ettiği için kanal güncellemesi başlatılamadı. Lütfen RSS taramasının bitmesini bekleyin.' });
  }

  const db = readDb();
  if (db.channels.length === 0) {
    return res.json({ success: true, message: 'İzlenen kanal bulunmuyor.' });
  }

  setChannelScanInProgress(true);
  let updatedCount = 0;
  let failedCount = 0;
  const totalChannels = db.channels.length;
  let currentIndex = 0;

  try {
    for (const channel of db.channels) {
      currentIndex++;
      try {
        const statusMsg = `[Kanal Logosu ${currentIndex}/${totalChannels}] Güncelleniyor: "${channel.name}"`;
        console.log(statusMsg);
        broadcast('status_log', { message: statusMsg, type: 'info' });
        addTerminalLog(statusMsg, 'info');

        await updateChannelFullInfo(channel);
        updatedCount++;
        await new Promise(r => setTimeout(r, 500));
      } catch (e) {
        console.error(`[Kanal] Logo güncelleme hatası (${channel.name}):`, e.message);
        failedCount++;
      }
    }

    writeDb(db);
    broadcast('db_update', db);
    import('./gist.js').then(m => m.triggerAutoGistSync()).catch(() => {});

    broadcast('status_log', { message: `[Kanal Logosu ${totalChannels}/${totalChannels}] Toplu logo güncelleme tamamlandı. Başarılı: ${updatedCount}, Başarısız: ${failedCount}`, type: 'success' });
    addTerminalLog(`[Kanal Logosu ${totalChannels}/${totalChannels}] Toplu logo güncelleme tamamlandı. Başarılı: ${updatedCount}, Başarısız: ${failedCount}`, 'success');

    res.json({ success: true, updatedCount, failedCount });
  } finally {
    setChannelScanInProgress(false);
  }
});

router.post('/:id/update-avatar', localhostOnly, async (req, res) => {
  const { id } = req.params;
  if (!/^UC[a-zA-Z0-9_-]{22}$/.test(id)) {
    return res.status(400).json({ error: 'Geçersiz Kanal ID formatı.' });
  }
  
  try {
    const db = readDb();
    const channel = db.channels.find(c => c.id === id);
    if (!channel) return res.status(404).json({ error: 'Kanal bulunamadı.' });
    
    await updateChannelFullInfo(channel);
    writeDb(db);
    broadcast('db_update', db);
    return res.json({ success: true, avatar: channel.avatar });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

async function fetchChannelSubscriberCount(channel) {
  const channelIdUrl = `https://www.youtube.com/channel/${channel.id}`;
  let info = await resolveChannelId(channelIdUrl, channel.id);
  if (!info || !info.subscriberCount || info.subscriberCount === '?') {
    const handleUrl = channel.handle && channel.handle.startsWith('http') 
      ? channel.handle 
      : `https://www.youtube.com/${channel.handle && channel.handle.startsWith('@') ? channel.handle : '@' + channel.name.replace(/\s+/g, '')}`;
    const fallbackInfo = await resolveChannelId(handleUrl, channel.id);
    if (fallbackInfo && fallbackInfo.subscriberCount && fallbackInfo.subscriberCount !== '?') {
      info = fallbackInfo;
    }
  }
  return (info && info.subscriberCount) ? info.subscriberCount : (channel.subscriberCount || '?');
}

router.post('/update-all-subscribers', localhostOnly, async (req, res) => {
  if (isChannelScanInProgress) {
    const elapsed = channelScanStartTime > 0 ? (Date.now() - channelScanStartTime) / 1000 : 0;
    if (channelScanStartTime > 0 && elapsed > 300) {
      console.warn(`[Kanal Kontrolü UYARI] Önceki kanal bilgisi taraması zaman aşımına uğradı (${elapsed.toFixed(0)} sn). Kilit sıfırlandı.`);
      setChannelScanInProgress(false);
    } else {
      return res.status(409).json({ success: false, inProgress: true, message: 'Zaten devam eden bir kanal bilgisi güncellemesi var.' });
    }
  }

  if (isRssChecking) {
    return res.status(409).json({ success: false, inProgress: true, message: 'Video RSS taraması devam ettiği için kanal güncellemesi başlatılamadı. Lütfen RSS taramasının bitmesini bekleyin.' });
  }

  const db = readDb();
  if (db.channels.length === 0) {
    return res.json({ success: true, message: 'İzlenen kanal bulunmuyor.' });
  }

  setChannelScanInProgress(true);
  let updatedCount = 0;
  let failedCount = 0;
  const totalChannels = db.channels.length;
  let currentIndex = 0;

  try {
    for (const channel of db.channels) {
      currentIndex++;
      try {
        const statusMsg = `[Abone Sayısı ${currentIndex}/${totalChannels}] Güncelleniyor: "${channel.name}"`;
        console.log(statusMsg);
        broadcast('status_log', { message: statusMsg, type: 'info' });
        addTerminalLog(statusMsg, 'info');

        await updateChannelFullInfo(channel);
        updatedCount++;
        await new Promise(r => setTimeout(r, 400));
      } catch (e) {
        console.error(`[Kanal] Abone sayısı güncelleme hatası (${channel.name}):`, e.message);
        failedCount++;
      }
    }

    writeDb(db);
    broadcast('db_update', db);
    import('./gist.js').then(m => m.triggerAutoGistSync()).catch(() => {});

    broadcast('status_log', { message: `[Abone Sayısı ${totalChannels}/${totalChannels}] Toplu abone sayısı güncelleme tamamlandı. Güncellenen: ${updatedCount}, Alınamayan: ${failedCount}`, type: 'success' });
    addTerminalLog(`[Abone Sayısı ${totalChannels}/${totalChannels}] Toplu abone sayısı güncelleme tamamlandı. Güncellenen: ${updatedCount}, Alınamayan: ${failedCount}`, 'success');

    res.json({ success: true, updatedCount, failedCount });
  } finally {
    setChannelScanInProgress(false);
  }
});

router.post('/:id/update-subscribers', localhostOnly, async (req, res) => {
  const { id } = req.params;
  if (!/^UC[a-zA-Z0-9_-]{22}$/.test(id)) {
    return res.status(400).json({ error: 'Geçersiz Kanal ID formatı.' });
  }
  
  try {
    const db = readDb();
    const channel = db.channels.find(c => c.id === id);
    if (!channel) return res.status(404).json({ error: 'Kanal bulunamadı.' });
    
    await updateChannelFullInfo(channel);
    writeDb(db);
    broadcast('db_update', db);
    return res.json({ success: true, subscriberCount: channel.subscriberCount });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Belirtilen kanalın yerel avatar/profil resmi dosyasını sunar.
 * Yerelde dosya yoksa orijinal YouTube avatar URL'sine yönlendirir.
 * 
 * @name GET /api/channels/:id/avatar
 * @function
 * @inner
 * @param {object} req - Express istek nesnesi
 * @param {string} req.params.id - Kanalın YouTube kimliği (ID)
 * @param {object} res - Express yanıt nesnesi
 * @returns {void}
 */
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
/**
 * Verilen arama sorgusunu YouTube kanal arama sayfasına göndererek
 * bulunan kanalların listesini döner. HTML parse ederek çalışır.
 * Kısıtlamalı/engelli kanallar için otomatik Piped ayna aramasına geçer.
 *
 * @param {string} query - Aranacak kanal adı veya anahtar kelime
 * @returns {Promise<Array<{id: string, name: string, handle: string, avatar: string, subscribers: string}>>}
 *   Bulunan kanalların listesi; her eleman id, name, handle, avatar ve subscribers içerir
 */
export async function searchChannelsOnYoutube(query) {
  const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}&sp=EgIQAg%3D%3D`;
  let results = [];
  try {
    results = await new Promise((resolve, reject) => {
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
            const list = [];
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

                list.push({
                  id: channelId,
                  name: title,
                  handle: handleName,
                  avatar: avatar.startsWith('//') ? 'https:' + avatar : avatar,
                  subscribers: subscriberCount
                });
              }
            }
            resolve(list);
          } catch (err) {
            reject(err);
          }
        });
      }).on('error', reject);
    });
  } catch (err) {
    console.warn(`[YouTube Arama] Standart HTML arama başarısız (${err.message}), yedek arama deneniyor...`);
  }

  // Eğer Türkiye'deki coğrafi engeller nedeniyle kanal bulunamadıysa veya boş döndüyse Piped / Ayna aramasını devreye sok
  if (!results || results.length === 0) {
    try {
      console.log(`[YouTube Arama] "${query}" için Piped yedek arama motoru sorgulanıyor...`);
      const pipedResults = await fetchPipedChannels(query);
      if (pipedResults && pipedResults.length > 0) {
        return pipedResults;
      }
    } catch (e) {
      console.warn(`[YouTube Arama] Piped arama hatası: ${e.message}`);
    }
  }

  return results || [];
}

// YouTube Kanal ID'sini ve Bilgilerini Çözümleme Fonksiyonu
/**
 * YouTube kanal URL'si, @handle, kanal ismi veya video URL'si gibi farklı giriş
 * biçimlerini alıp kanal ID'sini ve temel bilgilerini çözümler.
 * Önce yt-dlp, bulamazsa RSS ve API yedekleme zinciri denenir.
 *
 * @param {string} input - Kanal URL'si, @handle, isim veya video URL'si
 * @param {string|null} [existingChannelId=null] - Daha önce çözülmüş kanal ID'si (yeniden çözüm atlama için)
 * @returns {Promise<{id: string, name: string, handle: string, avatar: string, subscriberCount: string}>}
 *   Kanalın temel bilgilerini içeren nesne
 * @throws {Error} Kanal bulunamazsa hata fırlatir
 */
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

  if (!targetUrl.includes('hl=')) {
    targetUrl += (targetUrl.includes('?') ? '&' : '?') + 'hl=tr';
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
      let channelName = '';
      let avatarUrl = '';
      let subCount = '';

      try {
        const xml = await fetchWithProxyWaterfall(`https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}&hl=${hl}`);
        const titleMatch = xml.match(/<title>([^<]+)<\/title>/);
        channelName = titleMatch ? titleMatch[1].replace(' - YouTube', '').trim() : '';
        const authorMatch = xml.match(/<author>\s*<name>([^<]+)<\/name>/);
        if (authorMatch) {
          channelName = authorMatch[1].trim();
        }
      } catch (xmlErr) {
        console.log(`[RSS Fallback] Doğrudan XML başarısız: ${xmlErr.message}`);
      }

      // Eğer kanal adı alınamadıysa veya saçma/boşsa Piped Channel API ile sorgula (Yasaklı kanalları mükemmel çözer)
      if (!channelName || channelName === 'YouTube' || channelName.includes('Video - YouTube') || channelName.startsWith('Kanal UC')) {
        try {
          const pipedInfo = await fetchPipedChannelInfo(channelId);
          if (pipedInfo && pipedInfo.name) {
            channelName = pipedInfo.name;
            avatarUrl = pipedInfo.avatar || avatarUrl;
            subCount = pipedInfo.subscriberCount || subCount;
            console.log(`[RSS Fallback] Piped API ile kanal adı ve görseli çözümlendi: ${channelName}`);
          }
        } catch (pipedErr) {
          console.log(`[RSS Fallback] Piped API sorgu hatası: ${pipedErr.message}`);
        }
      }

      if (!channelName) {
        channelName = `Kanal ${channelId}`;
      }

      if (!avatarUrl) {
        try {
          const db = readDb();
          const args = [];
          args.push('--js-runtimes', `node:${process.execPath}`);
          args.push('--dump-single-json', '--flat-playlist', '--playlist-items', '1', `https://www.youtube.com/channel/${channelId}`);
          
          const localTemp = getLocalTempDir();
          const spawnOptions = {
            env: { ...process.env, TEMP: localTemp, TMP: localTemp },
            ...(process.platform === 'win32' ? { windowsVerbatimArguments: false, windowsHide: true } : {})
          };
          
          const ytdlpOutput = await new Promise((resDl, rejDl) => {
            const proc = spawnYtdlp(args, spawnOptions);
            let out = '';
            let err = '';
            proc.stdout.on('data', (d) => { out += d.toString(); });
            proc.stderr.on('data', (d) => { err += d.toString(); });
            proc.on('close', (code) => {
              cleanMeiForPid(proc.pid);
              if (code !== 0) return rejDl(new Error(`Exit code ${code}. Stderr: ${err}`));
              if (!out || !out.trim()) return rejDl(new Error('yt-dlp boş çıktı döndürdü'));
              resDl(out);
            });
          });

          const parsedData = JSON.parse(ytdlpOutput);
          if (parsedData.channel || parsedData.uploader) {
            channelName = parsedData.channel || parsedData.uploader || channelName;
          }
          if (parsedData.thumbnails && parsedData.thumbnails.length > 0) {
            const sortedThumbs = [...parsedData.thumbnails].sort((a, b) => (b.width || 0) - (a.width || 0));
            avatarUrl = sortedThumbs[0].url || '';
          }
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
        } catch (avatarErr) {
          console.log(`[RSS Fallback] yt-dlp ile logo çekilemedi: ${avatarErr.message}. Proxy yedek görseli deneniyor...`);
        }
      }

      if (!avatarUrl) {
        try {
          const unavatarRes = await fetchWithProxyWaterfall(`https://unavatar.io/youtube/${channelId}?json=true`);
          const parsedUnavatar = JSON.parse(unavatarRes);
          if (parsedUnavatar && parsedUnavatar.url) {
            avatarUrl = parsedUnavatar.url;
            console.log(`[RSS Fallback] unavatar.io ile orijinal kanal logosu çekildi: ${avatarUrl}`);
          }
        } catch (unavatarErr) {
          console.log(`[RSS Fallback] unavatar.io logo sorgusu başarısız: ${unavatarErr.message}`);
        }
      }

      return {
        id: channelId,
        name: channelName,
        avatar: avatarUrl,
        subscriberCount: subCount
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

    // Eğer isim bozuk/genel ise (YouTube, Video - YouTube vb.) temizle
    if (channelName && (channelName === 'YouTube' || channelName.includes('Video - YouTube'))) {
      channelName = null;
    }

    if (channelId) {
      // Eğer HTML üzerinden kanal adı, avatar ve abone bilgisi zaten eksiksiz ve geçerli alındıysa doğrudan dön
      if (channelName && avatarUrl && subCount && subCount !== '?') {
        return {
          id: channelId,
          name: channelName,
          avatar: avatarUrl,
          handle: handleVal || '',
          subscriberCount: subCount
        };
      }

      console.log(`[Scraper] Kanal ID bulundu: ${channelId}. Eksik bilgileri tamamlamak için RSS/Piped beslemesi sorgulanıyor...`);
      try {
        const rssInfo = await tryRssFallback(channelId);
        console.log(`[Scraper] Doğrulanan Kanal: ${rssInfo.name} (ID: ${channelId})`);
        return {
          id: channelId,
          name: (channelName && channelName !== 'YouTube') ? channelName : (rssInfo.name || `Kanal ${channelId}`),
          avatar: avatarUrl || rssInfo.avatar || '',
          handle: handleVal || '',
          subscriberCount: (subCount && subCount !== '?') ? subCount : (rssInfo.subscriberCount || subCount || '')
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

      // Handle veya isim girilmiş ama YouTube 404/Block vermişse Piped aramasıyla çöz
      if (decodedInput) {
        console.log(`[Scraper] Kanal ID bulunamadı, Piped API araması ile çözümleniyor: ${decodedInput}`);
        const pipedResults = await fetchPipedChannels(decodedInput.replace(/^@/, ''));
        if (pipedResults && pipedResults.length > 0) {
          const first = pipedResults[0];
          return {
            id: first.id,
            name: first.name,
            avatar: first.avatar,
            handle: first.handle,
            subscriberCount: first.subscribers
          };
        }
      }

      throw new Error('Kanal ID veya kanal adı tespit edilemedi. Lütfen adresi kontrol edin.');
    }
  } catch (err) {
    if (fallbackChannelId) {
      return await tryRssFallback(fallbackChannelId);
    }
    if (decodedInput) {
      const pipedResults = await fetchPipedChannels(decodedInput.replace(/^@/, ''));
      if (pipedResults && pipedResults.length > 0) {
        const first = pipedResults[0];
        return {
          id: first.id,
          name: first.name,
          avatar: first.avatar,
          handle: first.handle,
          subscriberCount: first.subscribers
        };
      }
    }
    throw err;
  }
}

// yt-dlp ile kanal abone sayısını çekme yedek fonksiyonu
/**
 * yt-dlp kullanarak belirtilen YouTube kanalının abone sayısını çeker.
 * Sayıyı okunaklı kısaltılmış biçime dönüştürür (1500 → '1.5K', 2000000 → '2.0M').
 * Başarısız olursa boş string döner, hata fırlatmaz.
 *
 * @param {string} channelUrl - Kanalın tam YouTube URL'si
 * @returns {Promise<string>} Kısaltılmış abone sayısı ('1.5K', '2.0M' vb.) veya boş string
 */
export function getChannelSubscribersViaYtdlp(channelUrl) {
  return new Promise((resolve) => {
    const db = readDb();
    const args = [
      '--js-runtimes', `node:${process.execPath}`,
      '--print', 'subscriber_count'
    ];
    args.push(channelUrl);

    const localTemp = getLocalTempDir();
    const spawnOptions = {
      env: { ...process.env, TEMP: localTemp, TMP: localTemp },
      ...(process.platform === 'win32' ? { windowsVerbatimArguments: false, windowsHide: true } : {})
    };
    const proc = spawnYtdlp(args, spawnOptions);
    
    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', (d) => { stdout += d.toString(); });
    proc.stderr.on('data', (d) => { stderr += d.toString(); });
    proc.on('close', (code) => {
      cleanMeiForPid(proc.pid);
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
