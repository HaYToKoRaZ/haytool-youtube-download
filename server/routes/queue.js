// Türkçe Açıklama: İndirme kuyruğunu yöneten (duraklatma, sürdürme, yeniden sıralama), aktif indirmeleri iptal eden ve SSE event istemcilerini kaydeden API rotaları modülü.
import express from 'express';
import { exec } from 'child_process';
import { 
  readDb, 
  writeDb, 
  updateHistoryItem 
} from '../database.js';
import { localhostOnly } from '../middleware/security.js';
import { downloadQueue } from '../services/downloader.js';
import { testFfmpegSync } from '../services/paths.js';
import { broadcast, addTerminalLog, addClient, removeClient } from '../services/sse.js';

export const router = express.Router();

/**
 * İstemcilere gerçek zamanlı durum ve güncellemeleri göndermek için SSE (Server-Sent Events) bağlantısı açar.
 * 
 * @name GET /api/events
 * @function
 * @inner
 * @param {object} req - Express istek nesnesi
 * @param {object} res - Express yanıt nesnesi
 * @returns {void}
 */
router.get('/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  addClient(res);
  
  res.write(`event: db_update\ndata: ${JSON.stringify(readDb())}\n\n`);

  // SSE bağlantı canlılığı: 25 saniyede bir heartbeat yorum satırı gönder
  // (proxy / ara katman zaman aşımlarının bağlantıyı koparmasını önler)
  const heartbeat = setInterval(() => {
    try { res.write(': ping\n\n'); } catch (e) {}
  }, 25000);

  req.on('close', () => {
    clearInterval(heartbeat);
    removeClient(res);
  });
});

/**
 * İndirme kuyruğunu duraklatır ve çalışan aktif indirmeleri sonlandırarak kuyruğa iade eder.
 * 
 * @name POST /api/queue/pause
 * @function
 * @inner
 * @param {object} req - Express istek nesnesi
 * @param {object} res - Express yanıt nesnesi
 * @returns {void}
 */
router.post('/queue/pause', localhostOnly, (req, res) => {
  downloadQueue.isPaused = true;
  
  const db = readDb();
  db.settings.isPaused = true;
  writeDb(db);
  
  console.log('[Kuyruk] Kullanıcı isteği ile kuyruk duraklatıldı.');
  addTerminalLog('[Kuyruk] İndirme sırası duraklatıldı.', 'warning');
  
  if (downloadQueue.activeProcess && downloadQueue.activeVideoId) {
    const videoId = downloadQueue.activeVideoId;
    const historyItem = db.history.find(h => h.id === videoId);
    
    if (historyItem) {
      console.log(`[Kuyruk] Aktif indirme durduruldu ve kuyruğa iade edildi: ${historyItem.title}`);
      addTerminalLog(`[Kuyruk] Aktif indirme durduruldu ve kuyruğa iade edildi: "${historyItem.title}"`, 'info');
      
      downloadQueue.queue.unshift({
        id: videoId,
        title: historyItem.title,
        channelId: historyItem.channelId,
        channelName: historyItem.channelName,
        url: `https://www.youtube.com/watch?v=${videoId}`,
        publishedAt: historyItem.publishedAt || ''
      });
      
      updateHistoryItem(videoId, {
        status: 'waiting',
        progress: historyItem.progress || 0,
        speed: '',
        eta: ''
      });
      
      const proc = downloadQueue.activeProcess;
      const pid = proc.pid;
      
      downloadQueue.activeProcess = null;
      downloadQueue.activeVideoId = null;
      if (downloadQueue.activeDownloads > 0) {
        downloadQueue.activeDownloads--;
      }
      
      if (pid) {
        exec(`taskkill /F /T /PID ${pid}`, (err) => {
          try {
            proc.kill('SIGKILL');
          } catch (e) {
            // Kasıtlı sessiz: Süreç zaten kapanmış veya bulunamamış olabilir
          }
        });
      }
    }
  }
  
  broadcast('db_update', readDb());
  res.json({ success: true, isPaused: true });
});

/**
 * Duraklatılmış indirme kuyruğunu sürdürür ve işlemleri başlatır.
 * 
 * @name POST /api/queue/resume
 * @function
 * @inner
 * @param {object} req - Express istek nesnesi
 * @param {object} res - Express yanıt nesnesi
 * @returns {void}
 */
router.post('/queue/resume', localhostOnly, (req, res) => {
  downloadQueue.isPaused = false;
  
  const db = readDb();
  db.settings.isPaused = false;
  writeDb(db);
  
  console.log('[Kuyruk] Kullanıcı isteği ile kuyruk devam ettiriliyor.');
  addTerminalLog('[Kuyruk] İndirme sırası devam ettiriliyor.', 'success');
  
  broadcast('db_update', readDb());
  downloadQueue.process();
  res.json({ success: true, isPaused: false });
});

/**
 * Drag-and-drop (sürükle-bırak) eylemi sonrası indirme kuyruğundaki videoların sırasını yeniden yapılandırır.
 * Sıralama sonrasında aktif indirme sınırına göre gerekiyorsa bazı indirmeleri duraklatıp beklemeye alır veya bekleyenleri başlatır.
 * 
 * @name POST /api/queue/reorder
 * @function
 * @inner
 * @param {object} req - Express istek nesnesi
 * @param {Array<string>} req.body.ids - Yeniden sıralanmış video ID'lerinin sıralı dizisi
 * @param {object} res - Express yanıt nesnesi
 * @returns {void}
 */
router.post('/queue/reorder', localhostOnly, (req, res) => {
  const { ids } = req.body;
  if (!ids || !Array.isArray(ids)) {
    return res.status(400).json({ error: 'Geçersiz veri formatı. ID listesi gereklidir.' });
  }
  
  console.log('[Kuyruk] Drag-and-drop kuyruk yeniden sıralama isteği alındı.');
  
  const db = readDb();
  const maxConcurrent = parseInt(db.settings.maxConcurrentDownloads) || 1;

  // 1. O an aktif olan indirmeler ile kuyruktaki bekleyen videoların listesini topla
  const activeDownloadingIds = [];
  for (const [vid, procInfo] of downloadQueue.activeProcesses.entries()) {
    if (procInfo.status === 'downloading' || procInfo.status === 'merging') {
      activeDownloadingIds.push(vid);
    }
  }

  // Hem downloading, merging hem waiting videoları db.history'den çekelim
  const activeAndWaitingItems = db.history.filter(h => h.status === 'downloading' || h.status === 'merging' || h.status === 'waiting');
  
  // Gelen 'ids' sırasına göre sıralayalım
  activeAndWaitingItems.sort((a, b) => {
    const idxA = ids.indexOf(a.id);
    const idxB = ids.indexOf(b.id);
    const valA = idxA === -1 ? 999999 : idxA;
    const valB = idxB === -1 ? 999999 : idxB;
    return valA - valB;
  });

  // İlk 'maxConcurrent' kadar olan videolar çalışmalı, kalanlar beklemeli
  const shouldBeDownloading = activeAndWaitingItems.slice(0, maxConcurrent);
  const shouldBeWaiting = activeAndWaitingItems.slice(maxConcurrent);

  // 2. Şu an aktif indirilmekte olup da 'shouldBeWaiting' listesinde yer alanları durdurup sıraya iade edelim
  shouldBeWaiting.forEach(item => {
    if (item.status === 'downloading' || item.status === 'merging') {
      console.log(`[Kuyruk] Sırası geriye kayan aktif indirme/birleştirme durduruluyor: ${item.title}`);
      addTerminalLog(`[Kuyruk] Sırası geriye kayan aktif işlem durduruldu ve kuyruğa iade edildi: "${item.title}"`, 'info');
      
      const procInfo = downloadQueue.activeProcesses.get(item.id);
      if (procInfo) {
        const proc = procInfo.process;
        const pid = proc.pid;
        
        if (procInfo.timeoutTimer) {
          clearTimeout(procInfo.timeoutTimer);
        }
        
        downloadQueue.activeProcesses.delete(item.id);
        if (downloadQueue.activeDownloads > 0) {
          downloadQueue.activeDownloads--;
        }
        
        if (pid) {
          if (process.platform === 'win32') {
            exec(`taskkill /F /T /PID ${pid}`, () => { try { proc.kill('SIGKILL'); } catch(e){} });
          } else {
            try { process.kill(-pid, 'SIGKILL'); } catch(e) { try { proc.kill('SIGKILL'); } catch(err){} }
          }
        }
      }
      item.status = 'waiting';
      item.progress = item.progress || 0;
      item.speed = '';
      item.eta = '';
    }
  });

  // 3. 'shouldBeDownloading' listesinde olup da şu an 'waiting' olanları indirmeye hazırlayalım
  // Bunları activeProcesses'e değil, downloadQueue.queue'nun en önüne yerleştirelim ki process() çağrıldığında çalışsınlar
  const startList = [];
  shouldBeDownloading.forEach(item => {
    if (item.status === 'waiting') {
      startList.push({
        id: item.id,
        title: item.title,
        channelId: item.channelId,
        channelName: item.channelName,
        url: `https://www.youtube.com/watch?v=${item.id}`,
        publishedAt: item.publishedAt || ''
      });
    }
  });

  // Kalan tüm waiting öğeleri de olmaları gereken sırayla downloadQueue.queue'ya dolduralım
  const remainingWaitingList = [];
  shouldBeWaiting.forEach(item => {
    remainingWaitingList.push({
      id: item.id,
      title: item.title,
      channelId: item.channelId,
      channelName: item.channelName,
      url: `https://www.youtube.com/watch?v=${item.id}`,
      publishedAt: item.publishedAt || ''
    });
  });

  // downloadQueue'yu sıfırlayıp yeni sırasına göre dolduruyoruz
  downloadQueue.queue = [...startList, ...remainingWaitingList];

  // db.history listesindeki sıralamayı da güncelleyelim
  const otherItems = db.history.filter(h => h.status !== 'waiting' && h.status !== 'downloading' && h.status !== 'merging');
  
  // downloading ve waiting olanların güncel durumlarıyla db.history'e yerleşmesi
  db.history = [...otherItems, ...shouldBeDownloading, ...shouldBeWaiting];
  writeDb(db);
  
  addTerminalLog('[Kuyruk] İndirme sırası yeniden yapılandırıldı.', 'info');
  broadcast('db_update', db);
  
  // Kuyruğu tetikle
  downloadQueue.process();
  
  res.json({ success: true });
});

/**
 * İndirme kuyruğunda bekleyen tüm videoları iptal eder ve kuyruğu boşaltır.
 * 
 * @name POST /api/cancel-all-queued
 * @function
 * @inner
 * @param {object} req - Express istek nesnesi
 * @param {object} res - Express yanıt nesnesi
 * @returns {void}
 */
router.post('/cancel-all-queued', localhostOnly, (req, res) => {
  const db = readDb();
  let cancelledCount = 0;
  
  db.history.forEach(item => {
    if (item.status === 'waiting') {
      item.status = 'ignored';
      item.error = 'Kullanıcı tarafından iptal edildi.';
      
      const qIndex = downloadQueue.queue.findIndex(x => x.id === item.id);
      if (qIndex !== -1) {
        downloadQueue.queue.splice(qIndex, 1);
      }
      cancelledCount++;
    }
  });

  if (cancelledCount > 0) {
    writeDb(db);
    addTerminalLog(`[Kuyruk] Kullanıcı isteği ile kuyruktaki ${cancelledCount} video iptal edildi.`, 'warning');
    broadcast('db_update', db);
  }

  res.json({ success: true, count: cancelledCount });
});

/**
 * Belirli bir videonun indirilmesini/işlemini (aktif indirme, birleştirme veya bekleme) iptal eder.
 * 
 * @name POST /api/cancel-download
 * @function
 * @inner
 * @param {object} req - Express istek nesnesi
 * @param {string} req.body.videoId - İptal edilecek videonun YouTube ID'si (11 karakter)
 * @param {object} res - Express yanıt nesnesi
 * @returns {void}
 */
router.post('/cancel-download', localhostOnly, (req, res) => {
  const { videoId } = req.body;
  if (!videoId) return res.status(400).json({ error: 'Video ID gereklidir.' });
  if (!/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
    return res.status(400).json({ error: 'Geçersiz Video ID formatı.' });
  }

  if (downloadQueue.activeProcesses.has(videoId)) {
    console.log(`Aktif işlem (indirme/birleştirme) iptal ediliyor: ${videoId}`);
    
    updateHistoryItem(videoId, {
      status: 'ignored',
      progress: 0,
      speed: '',
      eta: '',
      error: 'Kullanıcı tarafından iptal edildi.'
    });

    const procInfo = downloadQueue.activeProcesses.get(videoId);
    const proc = procInfo.process;
    const pid = proc.pid;

    downloadQueue.activeProcesses.delete(videoId);
    if ((procInfo.status === 'downloading' || procInfo.status === 'merging') && downloadQueue.activeDownloads > 0) {
      downloadQueue.activeDownloads = Math.max(0, downloadQueue.activeDownloads - 1);
    }

    if (pid) {
      if (process.platform === 'win32') {
        exec(`taskkill /F /T /PID ${pid}`, (err) => {
          try {
            proc.kill('SIGKILL');
          } catch (e) {
            // Kasıtlı sessiz: Süreç sonlandırılmış olabilir
          }
        });
      } else {
        try {
          process.kill(-pid, 'SIGKILL');
        } catch (e) {
          try {
            proc.kill('SIGKILL');
          } catch (err2) {
            // Kasıtlı sessiz: Süreç öldürme hatası
          }
        }
      }
    }

    broadcast('status_log', { message: 'Aktif işlem iptal edildi.', type: 'info' });
    broadcast('db_update', readDb());
    downloadQueue.process();

    return res.json({ success: true });
  }

  const queueIndex = downloadQueue.queue.findIndex(item => item.id === videoId);
  if (queueIndex !== -1) {
    console.log(`Sıradaki indirme kuyruktan kaldırılıyor: ${videoId}`);
    downloadQueue.queue.splice(queueIndex, 1);

    updateHistoryItem(videoId, {
      status: 'ignored',
      progress: 0,
      speed: '',
      eta: '',
      error: 'Kuyruktan kaldırıldı (kullanıcı iptal etti).'
    });

    broadcast('status_log', { message: 'Video indirme kuyruğundan çıkarıldı.', type: 'info' });
    return res.json({ success: true });
  }

  const db = readDb();
  const historyItem = db.history.find(h => h.id === videoId);
  if (historyItem && (historyItem.status === 'waiting' || historyItem.status === 'downloading' || historyItem.status === 'merging')) {
    updateHistoryItem(videoId, {
      status: 'ignored',
      progress: 0,
      speed: '',
      eta: '',
      error: 'İptal edildi.'
    });

    if (downloadQueue.activeProcesses.has(videoId)) {
      const procInfo = downloadQueue.activeProcesses.get(videoId);
      downloadQueue.activeProcesses.delete(videoId);
      if ((procInfo.status === 'downloading' || procInfo.status === 'merging') && downloadQueue.activeDownloads > 0) {
        downloadQueue.activeDownloads = Math.max(0, downloadQueue.activeDownloads - 1);
      }
    }

    broadcast('status_log', { message: 'Video indirme iptal edildi ve durumu temizlendi.', type: 'info' });
    broadcast('db_update', readDb());
    downloadQueue.process();
    return res.json({ success: true });
  }

  res.status(400).json({ error: 'İptal edilebilecek aktif veya bekleyen bir indirme bulunamadı.' });
});

/**
 * Aktif olarak çalışan ve kuyrukta bekleyen tüm video indirme işlemlerini iptal eder.
 * 
 * @name POST /api/cancel-all-downloads
 * @function
 * @inner
 * @param {object} req - Express istek nesnesi
 * @param {object} res - Express yanıt nesnesi
 * @returns {void}
 */
router.post('/cancel-all-downloads', localhostOnly, (req, res) => {
  const videosInQueue = downloadQueue.queue.map(item => item.id);
  downloadQueue.queue = [];
  videosInQueue.forEach(vid => {
    updateHistoryItem(vid, { status: 'ignored', progress: 0, speed: '', eta: '', error: 'Kullanıcı tarafından iptal edildi (Tümü).' });
  });

  for (const [vid, procInfo] of downloadQueue.activeProcesses.entries()) {
    updateHistoryItem(vid, { status: 'ignored', progress: 0, speed: '', eta: '', error: 'Kullanıcı tarafından iptal edildi (Tümü).' });
    const proc = procInfo.process;
    const pid = proc.pid;
    
    if (pid) {
      if (process.platform === 'win32') {
        exec(`taskkill /F /T /PID ${pid}`, () => { try { proc.kill('SIGKILL'); } catch(e){ /* Kasıtlı sessiz */ } });
      } else {
        try { process.kill(-pid, 'SIGKILL'); } catch(e) { try { proc.kill('SIGKILL'); } catch(e){ /* Kasıtlı sessiz */ } }
      }
    }
  }
  downloadQueue.activeProcesses.clear();
  downloadQueue.activeDownloads = 0;

  const db = readDb();
  let updated = false;
  db.history.forEach(h => {
    if (h.status === 'waiting' || h.status === 'downloading' || h.status === 'merging') {
      h.status = 'ignored';
      h.error = 'Kullanıcı tarafından iptal edildi (Tümü).';
      h.progress = 0;
      h.speed = '';
      h.eta = '';
      updated = true;
    }
  });
  if (updated) {
    writeDb(db);
  }

  broadcast('status_log', { message: 'Tüm indirmeler iptal edildi.', type: 'info' });
  broadcast('db_update', readDb());
  res.json({ success: true });
});

/**
 * Eşzamanlı maksimum video indirme limitini ayarlar.
 * 
 * @name POST /api/settings/concurrent
 * @function
 * @inner
 * @param {object} req - Express istek nesnesi
 * @param {number} req.body.limit - Eşzamanlı indirilecek maksimum video sayısı (1 ile 5 arası)
 * @param {object} res - Express yanıt nesnesi
 * @returns {void}
 */
router.post('/settings/concurrent', localhostOnly, (req, res) => {
  const { limit } = req.body;
  const intLimit = parseInt(limit, 10);
  if (isNaN(intLimit) || intLimit < 1 || intLimit > 5) {
    return res.status(400).json({ error: 'Geçersiz limit değeri. 1 ile 5 arasında olmalıdır.' });
  }

  const db = readDb();
  db.settings.maxConcurrentDownloads = intLimit;
  writeDb(db);

  downloadQueue.maxConcurrent = intLimit;
  downloadQueue.process();

  addTerminalLog(`[Kuyruk] Eşzamanlı indirme limiti ${intLimit} olarak güncellendi.`, 'success');
  broadcast('db_update', db);
  res.json({ success: true, limit: intLimit });
});

/**
 * İndirme motorunu, askıdaki tüm süreç kilitlerini ve aktif indirme sayaçlarını sıfırlar (Restart gerektirmeden).
 * 
 * @name POST /api/queue/reset-engine
 * @function
 * @inner
 * @param {object} req - Express istek nesnesi
 * @param {object} res - Express yanıt nesnesi
 * @returns {void}
 */
router.post('/queue/reset-engine', localhostOnly, (req, res) => {
  console.log('[Kuyruk Engine] İndirme motoru sıfırlama isteği tetiklendi.');
  addTerminalLog('[Kuyruk Engine] İndirme motoru ve süreç kilitleri manuel olarak sıfırlanıyor...', 'warning');

  if (downloadQueue.activeProcesses) {
    for (const [videoId, procInfo] of downloadQueue.activeProcesses.entries()) {
      if (procInfo.timeoutTimer) clearTimeout(procInfo.timeoutTimer);
      if (procInfo.process && procInfo.process.pid) {
        try {
          if (process.platform === 'win32') {
            exec(`taskkill /pid ${procInfo.process.pid} /T /F`);
          } else {
            procInfo.process.kill();
          }
        } catch (e) {}
      }
    }
    downloadQueue.activeProcesses.clear();
  }

  downloadQueue.activeDownloads = 0;
  downloadQueue.isPaused = false;

  testFfmpegSync(true);

  const db = readDb();
  if (db && db.settings) {
    db.settings.isPaused = false;
    writeDb(db);
  }

  addTerminalLog('[Kuyruk Engine] İndirme motoru sıfırlandı, kuyruk yeniden başlatıldı.', 'success');
  broadcast('db_update', readDb());

  downloadQueue.process();
  res.json({ success: true, message: 'İndirme motoru sıfırlandı ve kuyruk yeniden başlatıldı.' });
});
