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
import { broadcast, addTerminalLog, addClient, removeClient } from '../services/sse.js';

export const router = express.Router();

// Real-time Event Stream (SSE) bağlantı kaydı
router.get('/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  addClient(res);
  
  res.write(`event: db_update\ndata: ${JSON.stringify(readDb())}\n\n`);

  req.on('close', () => {
    removeClient(res);
  });
});

// Kuyruğu Duraklat
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

// Duraklatılmış kuyruğu sürdür
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

// İndirme kuyruğunu sürükle-bırak sıralamasına göre yeniden sıralar
router.post('/queue/reorder', localhostOnly, (req, res) => {
  const { ids } = req.body;
  if (!ids || !Array.isArray(ids)) {
    return res.status(400).json({ error: 'Geçersiz veri formatı. ID listesi gereklidir.' });
  }
  
  console.log('[Kuyruk] Drag-and-drop kuyruk yeniden sıralama isteği alındı.');
  
  const reorderedQueue = [];
  for (const id of ids) {
    const item = downloadQueue.queue.find(x => x.id === id);
    if (item) {
      reorderedQueue.push(item);
    }
  }
  for (const item of downloadQueue.queue) {
    if (!reorderedQueue.some(x => x.id === item.id)) {
      reorderedQueue.push(item);
    }
  }
  downloadQueue.queue = reorderedQueue;
  
  const db = readDb();
  const waitingItems = db.history.filter(h => h.status === 'waiting');
  const otherItems = db.history.filter(h => h.status !== 'waiting');
  
  waitingItems.sort((a, b) => {
    const indexA = downloadQueue.queue.findIndex(x => x.id === a.id);
    const indexB = downloadQueue.queue.findIndex(x => x.id === b.id);
    const valA = indexA === -1 ? 999999 : indexA;
    const valB = indexB === -1 ? 999999 : indexB;
    return valA - valB;
  });
  
  db.history = [...otherItems, ...waitingItems];
  writeDb(db);
  
  addTerminalLog('[Kuyruk] İndirme sırası yeniden yapılandırıldı.', 'info');
  broadcast('db_update', db);
  res.json({ success: true });
});

// Kuyruktaki tüm bekleyen videoları iptal et
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

// Belirli bir videonun indirilmesini/işlemini iptal et
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
    if (procInfo.status === 'downloading' && downloadQueue.activeDownloads > 0) {
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
    broadcast('db_update', readDb());
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
      if (procInfo.status === 'downloading' && downloadQueue.activeDownloads > 0) {
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

// Tüm aktif ve bekleyen indirmeleri iptal et
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
