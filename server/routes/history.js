// Türkçe Açıklama: Kütüphane, video geçmişi, dosya karşılaştırma, konum açma, video silme ve gizleme API rotaları modülü.
import express from 'express';
import fs from 'fs';
import path from 'path';
import open from 'open';
import { exec } from 'child_process';
import { 
  readDb, 
  writeDb, 
  acquireDbLock, 
  updateHistoryItem 
} from '../database.js';
import { localhostOnly } from '../middleware/security.js';
import { downloadQueue } from '../services/downloader.js';
import { resolveMissingDurations, fetchVideoDuration, checkSingleChannelRss } from '../services/rss.js';
import { broadcast, addTerminalLog } from '../services/sse.js';

export const router = express.Router();

// Helper function to get files recursively
function getFilesRecursively(dir) {
  let results = [];
  if (!fs.existsSync(dir)) return results;
  try {
    const list = fs.readdirSync(dir);
    for (const file of list) {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);
      if (stat && stat.isDirectory()) {
        results = results.concat(getFilesRecursively(filePath));
      } else {
        results.push(filePath);
      }
    }
  } catch (err) {
    console.error(`Error scanning directory ${dir}:`, err.message);
  }
  return results;
}

// Veritabanını Dışarıya Ver
router.get('/db', (req, res) => {
  res.json(readDb());
});

// Manuel Video İndirmeyi Başlat (Kuyruğa yeni video ekler ve eksik süre/tarih çözücüyü tetikler)
router.post('/download-video', async (req, res) => {
  const { videoId, url } = req.body;
  let { title, channelName, channelId } = req.body;

  let targetVideoId = videoId;

  if (!targetVideoId && url) {
    const youtubeRegex = /(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/))([^?&"'>\s]{11})/;
    const match = url.match(youtubeRegex);
    if (match) {
      targetVideoId = match[1];
    }
  }

  if (!targetVideoId) return res.status(400).json({ error: 'Video ID veya URL gereklidir.' });
  if (!/^[a-zA-Z0-9_-]{11}$/.test(targetVideoId)) {
    return res.status(400).json({ error: 'Geçersiz Video ID formatı.' });
  }

  if (!channelName || !title) {
    try {
      console.log(`[Manual Download] Fetching video details from YouTube: ${targetVideoId}`);
      const details = await fetchVideoDuration(targetVideoId);
      if (details) {
        if (details.title) title = details.title;
        if (details.channelName) channelName = details.channelName;
        if (details.channelId) channelId = details.channelId;
      }
    } catch (err) {
      console.error(`[Manual Download] Error occurred:`, err.message);
    }
  }

  downloadQueue.add({
    id: targetVideoId,
    title: title || 'Bilinmeyen Video',
    channelId: channelId || 'manual',
    channelName: channelName || 'Manuel İndirme',
    url: `https://www.youtube.com/watch?v=${targetVideoId}`,
    publishedAt: ''
  });

  resolveMissingDurations();

  res.json({ success: true, message: 'İndirme kuyruğuna eklendi.', videoId: targetVideoId });
});

// Metadataları (süre, boyut vb.) toplu güncelle/onar
router.post('/library/update-metadata', localhostOnly, (req, res) => {
  try {
    const db = readDb();
    const type = req.body.type;
    let updated = false;
    let count = 0;

    if (type === 'downloaded') {
      db.history.forEach(item => {
        if (item.status === 'completed') {
          if (item.duration === '-') item.duration = '';
          if (item.publishedAt === '-') item.publishedAt = '';
          item.resolveAttempts = 0;
          updated = true;
          count++;
        }
      });
    } else {
      db.history.forEach(item => {
        if (item.duration === '-') item.duration = '';
        if (item.publishedAt === '-') item.publishedAt = '';
        item.resolveAttempts = 0;
        updated = true;
        count++;
      });
    }

    if (updated) {
      writeDb(db);
      broadcast('db_update', readDb());
    }

    resolveMissingDurations();
    res.json({ success: true, count });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Tüm İndirmeleri İptal Et / Sıfırla
router.post('/sync', (req, res) => {
  try {
    const db = readDb();
    if (db.channels.length === 0) {
      return res.json({ success: true, message: 'İzlenen kanal bulunmuyor.' });
    }
    
    addTerminalLog('[RSS] Manuel tetikleme: Tüm kanallar sırayla denetleniyor...', 'info');
    
    // Arka planda kanalları sırayla denetle
    (async () => {
      try {
        let count = 0;
        const total = db.channels.length;
        for (const channel of db.channels) {
          count++;
          broadcast('status_log', { message: `Kanal denetleniyor: ${channel.name} (${count}/${total})`, type: 'info' });
          await checkSingleChannelRss(channel, false);
          await new Promise(r => setTimeout(r, 1000));
        }
        
        resolveMissingDurations();
        addTerminalLog('[RSS] Manuel tetikleme: Tüm kanalların denetimi tamamlandı.', 'success');
        broadcast('status_log', { message: 'Tüm kanalların denetimi tamamlandı.', type: 'success' });
      } catch (err) {
        addTerminalLog(`[RSS] [HATA] Manuel tetikleme sırasında hata oluştu: ${err.message}`, 'error');
      }
    })();
    
    res.json({ success: true, message: 'Kanal denetimi arka planda başlatıldı.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Dosya Karşılaştırma API'si
router.get('/tools/compare-files', localhostOnly, (req, res) => {
  const db = readDb();
  const folder = db.settings.downloadPath;
  
  if (!fs.existsSync(folder)) {
    return res.json({ success: true, untrackedFiles: [], unrelatedFiles: [], missingFiles: [] });
  }

  const allFiles = getFilesRecursively(folder);
  const videoExtensions = ['.mp4', '.mkv', '.webm', '.avi', '.ts', '.3gp', '.flv'];
  
  const formatBytes = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const completedHistory = db.history.filter(h => h.status === 'completed');
  const completedHistoryIds = new Set(completedHistory.map(h => h.id));
  
  const untrackedFiles = [];
  const unrelatedFiles = [];
  const diskVideos = [];

  for (const filePath of allFiles) {
    const filename = path.basename(filePath);
    const filenameLower = filename.toLowerCase();
    
    if (filenameLower === 'avatar.ico' || filenameLower === 'avatar.jpg' || filenameLower === 'desktop.ini') {
      continue;
    }

    const ext = path.extname(filePath).toLowerCase();
    const idMatch = filename.match(/\[([a-zA-Z0-9_-]{11})\]/);
    let videoId = null;
    if (idMatch) {
      videoId = idMatch[1];
    }
    
    if (videoId && videoExtensions.includes(ext)) {
      diskVideos.push(videoId);
    }
    
    try {
      const stat = fs.statSync(filePath);
      const fileData = {
        id: videoId,
        title: filename,
        filename: filename,
        filePath: filePath,
        fileSize: formatBytes(stat.size)
      };
      
      if (videoId) {
        if (completedHistoryIds.has(videoId)) {
          continue;
        } else {
          if (videoExtensions.includes(ext)) {
            const nameWithoutExt = filename.slice(0, filename.length - ext.length);
            const bracketIndex = nameWithoutExt.lastIndexOf(' [');
            let channelName = '';
            let title = nameWithoutExt;
            if (bracketIndex !== -1) {
              const titleAndChannel = nameWithoutExt.slice(0, bracketIndex);
              const dashIndex = titleAndChannel.indexOf(' - ');
              if (dashIndex !== -1) {
                channelName = titleAndChannel.slice(0, dashIndex).trim();
                title = titleAndChannel.slice(dashIndex + 3).trim();
              } else {
                title = titleAndChannel.trim();
              }
            }
            fileData.channelName = channelName;
            fileData.title = title;
            untrackedFiles.push(fileData);
          } else {
            unrelatedFiles.push(fileData);
          }
        }
      } else {
        unrelatedFiles.push(fileData);
      }
    } catch (e) {
      // Kasıtlı sessiz: Bozuk veya erişilemeyen bir dosya karşılaştırmayı durdurmasın, atla ve devam et.
    }
  }

  const missingFiles = [];
  for (const item of completedHistory) {
    const existsOnDisk = diskVideos.includes(item.id);
    if (!existsOnDisk) {
      missingFiles.push({
        id: item.id,
        title: item.title,
        channelName: item.channelName,
        channelId: item.channelId,
        filePath: item.filePath,
        publishedAt: item.publishedAt,
        downloadedAt: item.downloadedAt
      });
    }
  }

  res.json({
    success: true,
    untrackedFiles,
    unrelatedFiles,
    missingFiles
  });
});

// Dosya Konumunu Aç API'si
router.post('/tools/open-file-location', localhostOnly, (req, res) => {
  const { filePath } = req.body;
  if (!filePath) return res.status(400).json({ error: 'filePath parametresi gereklidir.' });
  
  const resolvedFile = path.resolve(filePath);
  const db = readDb();
  const downloadPathResolved = path.resolve(db.settings.downloadPath);
  
  if (!resolvedFile.toLowerCase().startsWith(downloadPathResolved.toLowerCase())) {
    return res.status(403).json({ error: 'Güvenlik hatası: İndirme klasörü dışındaki bir dosya açılamaz.' });
  }
  
  if (!fs.existsSync(resolvedFile)) {
    return res.status(404).json({ error: 'Dosya bulunamadı.' });
  }
  
  try {
    if (process.platform === 'win32') {
      exec(`explorer.exe /select,"${resolvedFile}"`);
      const folderName = path.basename(path.dirname(resolvedFile));
      const folderNameSafe = folderName.replace(/'/g, "''");
      setTimeout(() => {
        exec(`powershell -Command "(New-Object -ComObject wscript.shell).AppActivate('${folderNameSafe}')"`, (err) => {});
      }, 500);
    } else {
      exec(`open "${path.dirname(resolvedFile)}"`);
    }
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// Dosya Düzeltme / Onarma İşlemleri
router.post('/tools/fix-files', localhostOnly, async (req, res) => {
  const { action, videoIds, filePaths, filesToImport } = req.body;
  const release = await acquireDbLock();
  
  try {
    const db = readDb();
    const downloadPathResolved = path.resolve(db.settings.downloadPath);
    let deletedCount = 0;
    let importedCount = 0;

    if (action === 'delete-untracked' || action === 'delete-unrelated' || action === 'delete-untracked-file' || action === 'delete-unrelated-file') {
      if (filePaths && filePaths.length > 0) {
        for (const f of filePaths) {
          const resolvedFile = path.resolve(f);
          if (!resolvedFile.toLowerCase().startsWith(downloadPathResolved.toLowerCase())) continue;
          
          try {
            if (!fs.existsSync(resolvedFile)) continue;
            
            if (action === 'delete-untracked' || action === 'delete-untracked-file') {
              const baseName = path.basename(resolvedFile);
              const ext = path.extname(resolvedFile);
              const baseNameWithoutExt = baseName.slice(0, baseName.length - ext.length);
              
              const idMatch = baseName.match(/\[([a-zA-Z0-9_-]{11})\]/);
              const targetToken = idMatch ? `[${idMatch[1]}]` : null;

              const parentDir = path.dirname(resolvedFile);
              const siblings = fs.readdirSync(parentDir);

              for (const sibling of siblings) {
                const fullSibling = path.join(parentDir, sibling);
                let shouldDelete = false;
                
                if (targetToken && sibling.includes(targetToken)) {
                  shouldDelete = true;
                } else if (!targetToken && sibling.startsWith(baseNameWithoutExt)) {
                  shouldDelete = true;
                }

                if (shouldDelete) {
                  try {
                    if (fullSibling.toLowerCase().startsWith(downloadPathResolved.toLowerCase())) {
                      fs.unlinkSync(fullSibling);
                    }
                  } catch (e) {
                    // Kasıtlı sessiz: Companion dosyası silinemezse ana silme işlemi devam etsin.
                  }
                }
              }
            }

            if (fs.existsSync(resolvedFile)) {
              fs.unlinkSync(resolvedFile);
              deletedCount++;
            }
          } catch (err) {
            console.error(`Dosya silinemedi: ${resolvedFile}`, err.message);
          }
        }
      }
    } else if (action === 'import-untracked') {
      if (filesToImport && filesToImport.length > 0) {
        for (const fileData of filesToImport) {
          if (!fileData.id || !fileData.filePath) continue;
          const resolvedFile = path.resolve(fileData.filePath);
          if (!resolvedFile.toLowerCase().startsWith(downloadPathResolved.toLowerCase())) continue;
          if (!fs.existsSync(resolvedFile)) continue;

          const existsInDb = db.history.some(h => h.id === fileData.id);
          if (!existsInDb) {
            let title = fileData.title || fileData.filename;
            let channelName = fileData.channelName || 'İçe Aktarılan Kanal';
            let channelId = 'imported';

            const matchingChannel = db.channels.find(c => c.name.toLowerCase() === channelName.toLowerCase());
            if (matchingChannel) {
              channelId = matchingChannel.id;
              channelName = matchingChannel.name;
            }

            let publishedAt = new Date().toISOString();
            let duration = '';
            
            try {
              const details = await fetchVideoDuration(fileData.id);
              if (details) {
                if (details.publishedAt) publishedAt = details.publishedAt;
                if (details.duration) duration = details.duration;
              }
            } catch (err) {
              // Kasıtlı sessiz: Süre çözümlenemese de işleme devam edilir
            }

            try {
              const stats = fs.statSync(resolvedFile);
              const sizeInBytes = stats.size;
              let fileSizeStr = '';
              if (sizeInBytes >= 1024 * 1024 * 1024) {
                fileSizeStr = Math.round(sizeInBytes / (1024 * 1024 * 1024)) + ' GB';
              } else {
                fileSizeStr = Math.round(sizeInBytes / (1024 * 1024)) + ' MB';
              }

              db.history.push({
                id: fileData.id,
                title: title,
                channelId: channelId,
                channelName: channelName,
                downloadedAt: new Date().toISOString(),
                publishedAt: publishedAt,
                status: 'completed',
                progress: 100,
                fileSize: fileSizeStr,
                filePath: resolvedFile,
                duration: duration
              });
              importedCount++;
            } catch (err) {
              // Kasıtlı sessiz: Dosya istatistiği alınamazsa işlem devam eder
            }
          }
        }
        if (importedCount > 0) {
          writeDb(db);
        }
      }
    } else if (action === 'clean-missing') {
      if (videoIds && videoIds.length > 0) {
        const idSet = new Set(videoIds);
        db.history = db.history.filter(item => {
          if (item.status === 'completed' && idSet.has(item.id)) {
            const diskPath = item.filePath;
            if (!diskPath || !fs.existsSync(diskPath)) {
              deletedCount++;
              return false;
            }
          }
          return true;
        });
        if (deletedCount > 0) {
          writeDb(db);
        }
      }
    } else if (action === 'delete-history-item') {
      if (videoIds && videoIds.length > 0) {
        const idSet = new Set(videoIds);
        db.history = db.history.filter(item => {
          if (idSet.has(item.id)) {
            deletedCount++;
            return false;
          }
          return true;
        });
        if (deletedCount > 0) {
          writeDb(db);
        }
      }
    } else if (action === 'mark-missing-as-not-downloaded') {
      if (videoIds && videoIds.length > 0) {
        const idSet = new Set(videoIds);
        db.history.forEach(item => {
          if (idSet.has(item.id)) {
            item.status = 'ignored';
            item.filePath = '';
            item.fileSize = '';
            item.progress = 0;
            deletedCount++;
          }
        });
        if (deletedCount > 0) {
          writeDb(db);
        }
      }
    }

    broadcast('db_update', readDb());
    res.json({ success: true, deletedCount, importedCount });
  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    release();
  }
});

// Klasör Seçim Diyaloğu (Windows Native)
router.post('/select-folder', localhostOnly, (req, res) => {
  const db = readDb();
  const currentPath = db.settings.downloadPath || '';
  const escapedPath = currentPath.replace(/'/g, "''");
  
  const psCommand = `powershell -NoProfile -STA -Command "Add-Type -AssemblyName System.Windows.Forms; $dialog = New-Object System.Windows.Forms.FolderBrowserDialog; $dialog.Description = 'Please select a download folder'; $dialog.SelectedPath = '${escapedPath}'; $dialog.ShowNewFolderButton = $true; $form = New-Object System.Windows.Forms.Form; $form.TopMost = $true; $form.Opacity = 0; $form.Show(); $form.Activate(); $result = $dialog.ShowDialog($form); $form.Close(); if ($result -eq 'OK') { Write-Output $dialog.SelectedPath } else { Write-Output 'CANCEL' }"`;
  
  exec(psCommand, (err, stdout, stderr) => {
    if (err) {
      console.error('Folder selection error:', err.message || stderr);
      return res.status(500).json({ error: 'Klasör seçim penceresi açılamadı.' });
    }
    const selectedPath = stdout.trim();
    if (selectedPath && selectedPath !== 'CANCEL') {
      res.json({ success: true, path: selectedPath });
    } else {
      res.json({ success: false, message: 'Klasör seçimi iptal edildi.' });
    }
  });
});

// İndirme Klasörünü Aç
router.post('/open-folder', localhostOnly, (req, res) => {
  const db = readDb();
  let folder = db.settings.downloadPath;
  
  const { channelName } = req.body || {};
  if (channelName && typeof channelName === 'string') {
    const baseDownloadPath = path.resolve(db.settings.downloadPath);
    const targetFolder = path.resolve(baseDownloadPath, channelName);
    const relative = path.relative(baseDownloadPath, targetFolder);
    const isSafe = relative && !relative.startsWith('..') && !path.isAbsolute(relative);
    
    if (isSafe && fs.existsSync(targetFolder)) {
      folder = targetFolder;
    }
  }

  if (!fs.existsSync(folder)) {
    try {
      fs.mkdirSync(folder, { recursive: true });
    } catch (err) {
      return res.status(500).json({ error: 'Klasör oluşturulamadı.' });
    }
  }

  if (process.platform === 'win32') {
    const resolvedFolder = path.resolve(folder);
    exec(`explorer.exe "${resolvedFolder}"`);
    const folderName = path.basename(resolvedFolder);
    const folderNameSafe = folderName.replace(/'/g, "''");
    setTimeout(() => {
      exec(`powershell -Command "(New-Object -ComObject wscript.shell).AppActivate('${folderNameSafe}')"`, (err) => {});
    }, 500);
  } else {
    open(folder);
  }
  res.json({ success: true });
});

// Kütüphane / Geçmiş Elemanı Sil
router.delete('/history/:id', localhostOnly, async (req, res) => {
  const { id } = req.params;
  if (!/^[a-zA-Z0-9_-]{11}$/.test(id)) {
    return res.status(400).json({ error: 'Geçersiz Video ID formatı.' });
  }
  const deleteFile = req.query.deleteFile === 'true';
  
  console.log(`\n--- SİLME İŞLEMİ BAŞLATILDI ---`);
  console.log(`Tarih/Saat: ${new Date().toLocaleString('tr-TR')}`);
  console.log(`Target Video ID: ${id}`);
  console.log(`Bilgisayardan dosya silinsin mi: ${deleteFile}`);

  const db = readDb();
  const itemIndex = db.history.findIndex(h => h.id === id);

  if (itemIndex !== -1) {
    const item = db.history[itemIndex];
    console.log(`Video Adı: ${item.title}`);
    console.log(`Kanal: ${item.channelName}`);
    console.log(`Kayıtlı Yol: ${item.filePath}`);
    
    if (deleteFile) {
      try {
        let deletedAny = false;
        let failedToDelete = [];
        const targetPattern = `[${id}]`;

        if (item.filePath) {
          try {
            const ext = path.extname(item.filePath);
            const baseName = path.basename(item.filePath, ext);
            const dirName = path.dirname(item.filePath);
            
            console.log(`Yol tabanlı akıllı silme bașlatıldı. Klasör: ${dirName}, Dosya öneki: ${baseName}`);
            
            if (fs.existsSync(dirName)) {
              const files = fs.readdirSync(dirName);
              for (const file of files) {
                if (file === path.basename(item.filePath) || file.startsWith(baseName + '.')) {
                  const fullPath = path.join(dirName, file);
                  console.log(`Akıllı eșleșen dosya bulundu ve siliniyor: ${file}`);
                  try {
                    if (fs.existsSync(fullPath)) {
                      fs.unlinkSync(fullPath);
                      console.log(`BAȘARI: Dosya silindi: ${file}`);
                      deletedAny = true;
                    }
                  } catch (e) {
                    console.error(`HATA: Dosya silinemedi: ${file}`, e.message);
                    failedToDelete.push(`${file} (${e.message})`);
                  }
                }
              }
            }
          } catch (pathErr) {
            console.error('[Akıllı Silme Hata]:', pathErr.message);
          }
        }

        const folder = db.settings.downloadPath;
        const foldersToSearch = [folder];
        if (item.channelName) {
          foldersToSearch.push(path.join(folder, item.channelName));
        }

        console.log(`Silme ișlemi için aranan klasörler:`, foldersToSearch);

        for (const fld of foldersToSearch) {
          if (fs.existsSync(fld)) {
            const files = fs.readdirSync(fld);
            for (const file of files) {
              if (file.includes(targetPattern)) {
                const fullPath = path.join(fld, file);
                if (fs.existsSync(fullPath)) {
                  console.log(`Eșleșen dosya bulundu (ID yedek): ${file}. Silinmeye çalıșılıyor...`);
                  try {
                    fs.unlinkSync(fullPath);
                    console.log(`BAȘARI: Dosya silindi (ID yedek): ${file}`);
                    deletedAny = true;
                  } catch (e) {
                    if (e.code !== 'ENOENT') {
                      console.error(`HATA: Dosya silinemedi (ID yedek): ${file}`, e.message);
                      if (!failedToDelete.some(f => f.startsWith(file))) {
                        failedToDelete.push(`${file} (${e.message})`);
                      }
                    }
                  }
                }
              }
            }
          }
        }

        if (failedToDelete.length > 0) {
          const errorMsg = `Video dosyası silinemedi (Dosya kilitli veya açık olabilir): ${failedToDelete.join(', ')}`;
          console.error(`[DELETE ERROR] ${errorMsg}`);
          console.log(`--- SİLME İŞLEMİ BAŞARISIZ ---\n`);
          return res.status(500).json({ error: errorMsg });
        }
        if (deletedAny) {
          broadcast('status_log', { message: `İlgili video dosyaları bilgisayarınızdan silindi: ${item.title}`, type: 'info' });
        } else {
          console.log(`BİLGİ: Klasörlerde '${targetPattern}' içeren herhangi bir dosya bulunamadı.`);
        }
      } catch (err) {
        console.error(`[DELETE ERROR] Genel hata: ${err.message}`);
        console.log(`--- SİLME İŞLEMİ BAŞARISIZ ---\n`);
        return res.status(500).json({ error: `Dosya silme hatası: ${err.message}` });
      }
    }

    db.history.splice(itemIndex, 1);

    db.history.push({
      id: item.id,
      title: item.title,
      channelId: item.channelId,
      channelName: item.channelName,
      downloadedAt: new Date().toISOString(),
      publishedAt: item.publishedAt || '',
      status: 'ignored',
      progress: 0,
      fileSize: '',
      filePath: '',
      speed: '',
      eta: '',
      duration: item.duration || ''
    });
    console.log(`BİLGİ: Video '${item.title}' RSS'in tekrar indirmemesi için 'ignored' olarak işaretlendi.`);

    writeDb(db);
    broadcast('db_update', db);
    broadcast('status_log', { message: `Video geçmişten temizlendi: ${item.title}`, type: 'success' });
    console.log(`BAŞARI: Video geçmiş kaydı veri tabanından silindi.`);
    console.log(`--- SİLME İŞLEMİ TAMAMLANDI ---\n`);
    res.json({ success: true });
  } else {
    console.error(`HATA: ID '${id}' video kaydı veri tabanında bulunamadı.`);
    console.log(`--- SİLME İŞLEMİ BAŞARISIZ ---\n`);
    res.status(404).json({ error: 'Video kaydı bulunamadı.' });
  }
});

// Videoyu sil ve tekrar kuyruğa ekle (Tekrar İndir)
router.post('/history/:id/redownload', localhostOnly, async (req, res) => {
  const { id } = req.params;
  if (!/^[a-zA-Z0-9_-]{11}$/.test(id)) {
    return res.status(400).json({ error: 'Geçersiz Video ID formatı.' });
  }

  const db = readDb();
  const item = db.history.find(h => h.id === id);
  if (!item) {
    return res.status(404).json({ error: 'Video geçmişte bulunamadı.' });
  }

  try {
    const targetPattern = `[${id}]`;
    if (item.filePath) {
      const ext = path.extname(item.filePath);
      const baseName = path.basename(item.filePath, ext);
      const dirName = path.dirname(item.filePath);
      if (fs.existsSync(dirName)) {
        const files = fs.readdirSync(dirName);
        for (const file of files) {
          if (file === path.basename(item.filePath) || file.startsWith(baseName + '.')) {
            const fullPath = path.join(dirName, file);
            if (fs.existsSync(fullPath)) {
              try {
                fs.unlinkSync(fullPath);
              } catch (e) {
                console.error(`Tekrar İndir silme hatası: ${file}`, e.message);
              }
            }
          }
        }
      }
    }

    const folder = db.settings.downloadPath;
    const foldersToSearch = [folder];
    if (item.channelName) {
      foldersToSearch.push(path.join(folder, item.channelName));
    }
    for (const fld of foldersToSearch) {
      if (fs.existsSync(fld)) {
        const files = fs.readdirSync(fld);
        for (const file of files) {
          if (file.includes(targetPattern)) {
            const fullPath = path.join(fld, file);
            if (fs.existsSync(fullPath)) {
              try {
                fs.unlinkSync(fullPath);
              } catch (e) {
                if (e.code !== 'ENOENT') {
                  console.error(`Tekrar İndir yedek silme hatası: ${file}`, e.message);
                }
              }
            }
          }
        }
      }
    }
  } catch (err) {
    console.error(`Tekrar İndirme öncesi temizleme hatası:`, err.message);
  }

  await downloadQueue.add({
    id: item.id,
    title: item.title,
    channelId: item.channelId,
    channelName: item.channelName,
    url: `https://www.youtube.com/watch?v=${item.id}`,
    publishedAt: item.publishedAt || ''
  });

  resolveMissingDurations();

  res.json({ success: true, message: 'Video silindi ve tekrar indirilmek üzere kuyruğa eklendi.' });
});

// Videoyu geçmişte gizle (Kütüphaneden gizleme)
router.post('/history/:id/hide', localhostOnly, async (req, res) => {
  const { id } = req.params;
  if (!/^[a-zA-Z0-9_-]{11}$/.test(id)) {
    return res.status(400).json({ error: 'Geçersiz Video ID formatı.' });
  }

  const release = await acquireDbLock();
  try {
    const db = readDb();
    const item = db.history.find(h => h.id === id);
    if (!item) {
      return res.status(404).json({ error: 'Video geçmişte bulunamadı.' });
    }

    item.hidden = true;
    writeDb(db);
    
    broadcast('db_update', readDb());
    res.json({ success: true, message: 'Video kütüphaneden gizlendi.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    release();
  }
});

// Videoyu geçmişte tekrar görünür kıl
router.post('/history/:id/unhide', localhostOnly, async (req, res) => {
  const { id } = req.params;
  if (!/^[a-zA-Z0-9_-]{11}$/.test(id)) {
    return res.status(400).json({ error: 'Geçersiz Video ID formatı.' });
  }

  const release = await acquireDbLock();
  try {
    const db = readDb();
    const item = db.history.find(h => h.id === id);
    if (!item) {
      return res.status(404).json({ error: 'Video geçmişte bulunamadı.' });
    }

    item.hidden = false;
    writeDb(db);
    
    broadcast('db_update', readDb());
    res.json({ success: true, message: 'Video kütüphanede görünür yapıldı.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    release();
  }
});
