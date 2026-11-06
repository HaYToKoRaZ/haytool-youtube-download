// Türkçe Açıklama: İndirme işlemlerini sırayla gerçekleştiren kuyruk yapısını (DownloadQueue), bildirim seslerini ve masaüstü bildirimlerini yöneten motor modülü.
import fs from 'fs';
import { dataRootDir } from '../config.js';
import path from 'path';
import os from 'os';
import dns from 'dns';
import { spawn, exec } from 'child_process';
import { 
  readDb, 
  writeDb, 
  acquireDbLock, 
  updateHistoryItem, 
  defaultDownloadDir 
} from '../database.js';
import { broadcast, addTerminalLog } from './sse.js';
import { ytdlpPath, testFfmpegSync, getFfmpegPath, detectHwaccel, getLocalTempDir, getStagingTempDir, cleanMeiForPid, spawnYtdlp, execYtdlp, getVideoResolution, getVideoDurationFromFile } from './paths.js';
import { getWorkingProxy, rotateProxy } from './proxyManager.js';
import { getTempSpaceInfo, isTempExtractionError, buildDiskFullMessage, DISK_FULL_ERROR_CODE } from './diskGuard.js';
import { isInsideFakap } from './fakapPaths.js';
import { mergeQueue, getItemStagingDir } from './mergeQueue.js';
import { playAppSound } from './soundService.js';

// Türkçe Açıklama: İndirmeleri gerçekleştiren yt-dlp motorunun varlığını kontrol eder, yoksa GitHub üzerinden otomatik indirir.
export async function ensureYtdlp() {
  const isWin = os.platform() === 'win32';
  const filename = isWin ? 'yt-dlp.exe' : 'yt-dlp';
  if (fs.existsSync(ytdlpPath)) {
    return ytdlpPath;
  }

  console.log(`[yt-dlp] ${filename} bulunamadı, GitHub üzerinden en güncel Nightly sürümü otomatik indiriliyor...`);
  addTerminalLog(`[yt-dlp] ${filename} bulunamadı, GitHub üzerinden en güncel sürüm otomatik indiriliyor...`, 'info');

  const targetDir = path.dirname(ytdlpPath);
  if (!fs.existsSync(targetDir)) {
    try { fs.mkdirSync(targetDir, { recursive: true }); } catch (e) {}
  }

  const downloadUrl = isWin
    ? 'https://github.com/yt-dlp/yt-dlp-nightly-builds/releases/latest/download/yt-dlp.exe'
    : 'https://github.com/yt-dlp/yt-dlp-nightly-builds/releases/latest/download/yt-dlp';

  try {
    const res = await fetch(downloadUrl, {
      headers: { 'User-Agent': 'HaYTooL-YT-Downloader' },
      redirect: 'follow'
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    const buffer = Buffer.from(await res.arrayBuffer());
    fs.writeFileSync(ytdlpPath, buffer);
    if (!isWin) {
      try { fs.chmodSync(ytdlpPath, '755'); } catch (e) {}
    }
    console.log(`[yt-dlp] ${filename} başarıyla indirildi ve kullanıma hazır.`);
    addTerminalLog(`[yt-dlp] ${filename} başarıyla indirildi ve kullanıma hazır.`, 'success');
    return ytdlpPath;
  } catch (err) {
    console.error(`[yt-dlp] Otomatik indirme başarısız:`, err.message);
    addTerminalLog(`[yt-dlp] Motor indirme hatası: ${err.message}`, 'error');
    throw err;
  }
}

/**
 * yt-dlp motorunu belirtilen hedefe günceller.
 * 
 * @param {string} [target='nightly'] 'nightly' | 'stable' | 'nightly@tag' | 'stable@tag'
 * @returns {Promise<{ success: boolean, output: string, newVersion?: string, error?: string }>}
 */
export async function performYtdlpUpdate(target = 'nightly') {
  const isWin = os.platform() === 'win32';
  const targetDir = path.dirname(ytdlpPath);
  const cleanTarget = (target || 'nightly').trim();

  const db = readDb();
  const runMode = db.settings?.ytdlpRunMode || 'exe';

  if (!fs.existsSync(targetDir)) {
    try { fs.mkdirSync(targetDir, { recursive: true }); } catch (e) {}
  }

  let pipOutput = '';
  if (runMode === 'python') {
    const pythonCmd = db.settings?.pythonCmd || (isWin ? 'python' : 'python3');
    let pipTarget = 'yt-dlp';
    if (cleanTarget === 'nightly' || cleanTarget.startsWith('nightly')) {
      pipTarget = '--pre yt-dlp';
    } else if (cleanTarget.includes('@')) {
      const tag = cleanTarget.split('@')[1];
      pipTarget = `yt-dlp==${tag}`;
    }
    const pipCmd = `"${pythonCmd}" -m pip install -U ${pipTarget}`;
    console.log(`[yt-dlp Pip Update] Komut çalıştırılıyor: ${pipCmd}`);
    addTerminalLog(`[yt-dlp] Python pip üzerinden güncelleniyor: ${pipTarget}...`, 'info');

    try {
      await new Promise((resolve) => {
        exec(pipCmd, { timeout: 120000 }, (err, stdout, stderr) => {
          pipOutput = ((stdout || '') + '\n' + (stderr || '')).trim();
          resolve();
        });
      });
    } catch (_) {}
  }

  let binaryUpdated = false;
  if (runMode !== 'python' && fs.existsSync(ytdlpPath)) {
    try {
      const updateCmd = `"${ytdlpPath}" --update-to ${cleanTarget}`;
      console.log(`[yt-dlp Binary Update] Komut çalıştırılıyor: ${updateCmd}`);
      addTerminalLog(`[yt-dlp] Yerel motor güncelleniyor (${cleanTarget})...`, 'info');

      await new Promise((resolve, reject) => {
        exec(updateCmd, { timeout: 120000 }, (err, stdout, stderr) => {
          if (err) return reject(new Error((stderr || stdout || err.message).trim()));
          binaryUpdated = true;
          resolve();
        });
      });
    } catch (selfUpdateErr) {
      console.warn('[yt-dlp] --update-to başarısız oldu, doğrudan indirme deneniyor:', selfUpdateErr.message);
    }
  }

  if (!binaryUpdated) {
    let dlUrl = '';
    if (cleanTarget === 'nightly' || cleanTarget === 'latest' || !cleanTarget) {
      dlUrl = isWin
        ? 'https://github.com/yt-dlp/yt-dlp-nightly-builds/releases/latest/download/yt-dlp.exe'
        : 'https://github.com/yt-dlp/yt-dlp-nightly-builds/releases/latest/download/yt-dlp';
    } else if (cleanTarget === 'stable') {
      dlUrl = isWin
        ? 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe'
        : 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp';
    } else if (cleanTarget.startsWith('nightly@')) {
      const tag = cleanTarget.replace('nightly@', '');
      dlUrl = isWin
        ? `https://github.com/yt-dlp/yt-dlp-nightly-builds/releases/download/${tag}/yt-dlp.exe`
        : `https://github.com/yt-dlp/yt-dlp-nightly-builds/releases/download/${tag}/yt-dlp`;
    } else if (cleanTarget.startsWith('stable@')) {
      const tag = cleanTarget.replace('stable@', '');
      dlUrl = isWin
        ? `https://github.com/yt-dlp/yt-dlp/releases/download/${tag}/yt-dlp.exe`
        : `https://github.com/yt-dlp/yt-dlp/releases/download/${tag}/yt-dlp`;
    } else {
      dlUrl = isWin
        ? `https://github.com/yt-dlp/yt-dlp/releases/download/${cleanTarget}/yt-dlp.exe`
        : `https://github.com/yt-dlp/yt-dlp/releases/download/${cleanTarget}/yt-dlp`;
    }

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
        throw new Error('İndirilen dosya boyutu beklenenden çok küçük.');
      }

      const tempFilePath = `${ytdlpPath}.downloading_${Date.now()}`;
      fs.writeFileSync(tempFilePath, buffer);

      if (fs.existsSync(ytdlpPath)) {
        try {
          fs.unlinkSync(ytdlpPath);
        } catch (_) {
          const oldBackupPath = `${ytdlpPath}.old_${Date.now()}`;
          try { fs.renameSync(ytdlpPath, oldBackupPath); } catch (e) {}
        }
      }

      try {
        fs.renameSync(tempFilePath, ytdlpPath);
      } catch (rnErr) {
        fs.copyFileSync(tempFilePath, ytdlpPath);
        try { fs.unlinkSync(tempFilePath); } catch (_) {}
      }

      if (!isWin) {
        try { fs.chmodSync(ytdlpPath, '755'); } catch (e) {}
      }
    } catch (dlErr) {
      if (runMode !== 'python') {
        return { success: false, error: 'Güncelleme başarısız: ' + dlErr.message };
      }
    }
  }

  return new Promise((resolve) => {
    execYtdlp(`"${ytdlpPath}" --version`, { timeout: 10000 }, (verErr, verStdout) => {
      const newVersion = verErr ? '' : (verStdout || '').trim();
      const successMsg = `yt-dlp başarıyla ${newVersion || cleanTarget} sürümüne güncellendi.`;
      addTerminalLog(`[yt-dlp] ${successMsg}`, 'success');
      resolve({ success: true, output: successMsg + (pipOutput ? '\n' + pipOutput : ''), newVersion });
    });
  });
}


// Türkçe Açıklama: İndirme başarısız olduğunda veya yeniden deneneceğinde diske yazılmış bozuk fragment ve part dosyalarını temizler.
export function cleanupResidualFiles(videoId, channelName, downloadPath, skipChannelFolder = false) {
  if (!videoId || !downloadPath) return;
  try {
    const rawId = videoId.replace(/^fakap_/, '');
    const candidateDirs = [];
    if (skipChannelFolder) {
      candidateDirs.push(downloadPath);
    } else {
      if (channelName) {
        candidateDirs.push(path.join(downloadPath, channelName));
        const sanitized = channelName.replace(/[. ]+$/, '#');
        if (sanitized !== channelName) candidateDirs.push(path.join(downloadPath, sanitized));
      }
      candidateDirs.push(downloadPath);
    }

    for (const dir of candidateDirs) {
      if (!fs.existsSync(dir)) continue;
      try {
        const files = fs.readdirSync(dir);
        for (const file of files) {
          if (file.includes(`[${rawId}]`) && (
            file.endsWith('.part') ||
            file.endsWith('.ytdl') ||
            file.includes('.part-Frag') ||
            /\.f\d+\.(mp4|m4a|webm|mkv)$/i.test(file) ||
            /\.temp\./i.test(file)
          )) {
            try {
              fs.unlinkSync(path.join(dir, file));
              console.log(`[Disk Temizliği] Bozuk artık dosya silindi: ${file}`);
            } catch (_) {}
          }
        }
      } catch (_) {}
    }
  } catch (err) {
    console.error('[Disk Temizliği Hatası]', err.message);
  }
}

// Türkçe Açıklama: İndirme ve kuyruk durumlarına göre kullanıcı ayarlı özel sesleri (chime, bell, fanfare vb.) çalar.
export function playSystemSound(type = 'notification') {
  if (type === 'start') {
    playAppSound('download_start');
  } else if (type === 'success') {
    playAppSound('download_complete');
  } else if (type === 'error' || type === 'warning') {
    playAppSound('error');
  } else {
    playAppSound('download_start');
  }
}

// Türkçe Açıklama: Windows 10/11 WinRT Toast bildirim motoru (saat yanında geçici tepsi balonu açmaz, gerçek İşlem Merkezi masaüstü kartı gösterir).
export function showWindowsNotification(title, message, eventType = 'download_complete') {
  const db = readDb();
  const settings = db.settings || {};
  if (settings.showNotifications === false) return;
  if (os.platform() !== 'win32') return;

  // Aşama bazlı görsel bildirim açma/kapatma kontrolleri
  if (eventType === 'download_start' && settings.notifyDownloadStartToast === false) return;
  if (eventType === 'download_complete' && settings.notifyDownloadCompleteToast === false) return;
  if (eventType === 'merge_start' && settings.notifyMergeStartToast === false) return;
  if (eventType === 'merge_complete' && settings.notifyMergeCompleteToast === false) return;

  const cleanTitle = String(title || 'Multimedia HaYTooL').replace(/[’‘]/g, "'").replace(/[“”]/g, '"');
  const cleanMessage = String(message || '').replace(/[’‘]/g, "'").replace(/[“”]/g, '"');

  const escapedTitle = cleanTitle.replace(/'/g, "''");
  const escapedMessage = cleanMessage.replace(/'/g, "''");

  const psScript = `
    try {
      $appId = 'com.haytool.ytdownloader';
      [Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null;
      $template = [Windows.UI.Notifications.ToastTemplateType]::ToastText02;
      $xml = [Windows.UI.Notifications.ToastNotificationManager]::GetTemplateContent($template);
      $textNodes = $xml.GetElementsByTagName('text');
      $textNodes.Item(0).AppendChild($xml.CreateTextNode('${escapedTitle}')) | Out-Null;
      $textNodes.Item(1).AppendChild($xml.CreateTextNode('${escapedMessage}')) | Out-Null;
      $toast = [Windows.UI.Notifications.ToastNotification]::new($xml);
      $notifier = [Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier($appId);
      $notifier.Show($toast);
    } catch {
      try {
        $appIdFallback = '{1AC14E77-02E7-4E5D-B744-2EB1AE5198B7}\\WindowsPowerShell\\v1.0\\powershell.exe';
        $notifier2 = [Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier($appIdFallback);
        $notifier2.Show($toast);
      } catch {}
    }
  `;

  const base64Script = Buffer.from(psScript, 'utf16le').toString('base64');

  exec(`powershell -NoProfile -NonInteractive -EncodedCommand ${base64Script}`, (err) => {
    if (err) console.error('Windows masaüstü bildirimi gönderilemedi:', err.message);
  });
}

// Türkçe Açıklama: Kök ve bin/ çerez dosyalarını tek bir Netscape dosyasında birleştirip yt-dlp argümanlarını döner.
// Kök "cookies.txt" (yt-dlp dışa aktarımı) çoğu zaman yalnızca 3. taraf (__Secure-3P*) çerezleri tutar;
// tam oturum (SAPISID/SID/HSID/SSID/APISID/LOGIN_INFO/__Secure-1PSID) "bin/cookies.txt" içindedir.
// "izlendi olarak işaretle" (--mark-watched) gibi kimlik doğrulama isteyen işlemler eksik çerezlerle sessizce
// başarısız olur. Bu yüzden iki dosyayı birleştirip eksiksiz seti yt-dlp'ye veriyoruz.
export function getCookieArgs(settings = {}) {
  const rootCookiesTxt = path.join(dataRootDir, 'cookies.txt');
  const binCookiesTxt = path.join(dataRootDir, 'bin', 'cookies.txt');

  const merged = mergeCookieFiles([rootCookiesTxt, binCookiesTxt]);
  if (merged) {
    return ['--cookies', merged];
  }

  return [];
}

// Türkçe Açıklama: Birden çok Netscape çerez dosyasını tek dosyada birleştirir. Aynı (alan adı + isim)
// çerezinde son dosya öncekini ezer; bu yüzden bin/ (tam oturum) kök dosyanın üzerine yazılır.
// Sonuç her çağrıda taze üretilir; hiçbir çerez yoksa null döner.
function mergeCookieFiles(filePaths) {
  const cookieMap = new Map();
  for (const fp of filePaths) {
    if (!fp || !fs.existsSync(fp)) continue;
    const content = fs.readFileSync(fp, 'utf8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const parts = trimmed.split('\t');
      if (parts.length < 7) continue;
      const key = `${parts[0]}\t${parts[5]}`; // alan adı + çerez adı
      cookieMap.set(key, trimmed);
    }
  }

  if (cookieMap.size === 0) return null;

  const mergedPath = path.join(getLocalTempDir(), 'haytool_cookies_merged.txt');
  const merged = '# Netscape HTTP Cookie File\n' + Array.from(cookieMap.values()).join('\n') + '\n';
  fs.writeFileSync(mergedPath, merged, 'utf8');
  return mergedPath;
}

// Türkçe Açıklama: Etkin indirme hız sınırını belirler.
export function getEffectiveSpeedLimit(settings) {
  if (settings.useAlternativeSpeed) {
    return settings.alternativeSpeedLimit || 0;
  }
  return settings.downloadSpeedLimit || 0;
}

/**
 * Verilen hata metninin internet/ağ kesintisi olup olmadığını denetler.
 * Windows WSA socket kodları, DNS çözümleme hataları, TransportError ve Türkçe yerel Windows soket hata mesajlarını kapsar.
 * @param {string} text - Hata metni
 * @returns {boolean}
 */
export function isNetworkDisconnectError(text) {
  if (!text || typeof text !== 'string') return false;
  return /getaddrinfo failed|WinError (10013|10014|10022|10035|10036|10037|10038|10040|10048|10049|10050|10051|10052|10053|10054|10055|10056|10057|10058|10060|10061|10064|10065|11001|11002|11003|11004)|Errno (10013|10048|10049|10051|10053|10054|10060|10065|11001|11002|11003|11004)|WSAE\w+|Failed to establish a new connection|Failed to resolve|Giving up after \d+ retries|TransportError|Eri[sş\uFFFD]im izinlerince|yuvaya eri[sş\uFFFD]ilmeye|Network is unreachable|Temporary failure in name resolution|Name or service not known|Connection refused|Connection reset|Unable to download API page|Unable to download webpage|urlopen error|socket\.gaierror|RemoteDisconnected|IncompleteRead|Read timed out|ENETUNREACH|ECONNRESET|ECONNREFUSED|ETIMEDOUT|EHOSTUNREACH|No route to host/i.test(text);
}

/**
 * Gerçek internet bağlantısının aktif olup olmadığını doğrular (<1-3.5sn).
 * @returns {Promise<boolean>}
 */
export async function checkInternetConnection() {
  try {
    const res = await fetch('http://connectivitycheck.gstatic.com/generate_204', {
      method: 'GET',
      signal: AbortSignal.timeout(3500)
    });
    if (res.ok || res.status === 204) return true;
  } catch (e) {}

  try {
    const res2 = await fetch('http://detectportal.firefox.com/success.txt', {
      method: 'GET',
      signal: AbortSignal.timeout(3500)
    });
    if (res2.ok) return true;
  } catch (e) {}

  return new Promise((resolve) => {
    dns.lookup('dns.google', (err) => {
      if (!err) return resolve(true);
      dns.lookup('one.one.one.one', (err2) => {
        resolve(!err2);
      });
    });
  });
}

/**
 * Verilen veritabanı veya geçmiş kaydından indirilebilir orijinal URL'yi tespit eder.
 * Harici platformlar (Instagram, TikTok, Twitter/X) ve YouTube videoları için doğru URL'yi döner.
 *
 * @param {object} item - db.history veya video nesnesi
 * @returns {string} - Geçerli indirme bağlantısı veya boş metin
 */
export function resolveItemDownloadUrl(item) {
  if (!item) return '';

  // 1. Doğrudan geçerli bir webUrl tanımlıysa (ve sahte youtube watch URL'si değilse)
  if (item.webUrl && typeof item.webUrl === 'string' && (item.webUrl.startsWith('http://') || item.webUrl.startsWith('https://'))) {
    if (!item.webUrl.includes('youtube.com/watch?v=ext_')) {
      return item.webUrl;
    }
  }

  // 2. Doğrudan geçerli bir url tanımlıysa
  if (item.url && typeof item.url === 'string' && (item.url.startsWith('http://') || item.url.startsWith('https://'))) {
    if (!item.url.includes('youtube.com/watch?v=ext_')) {
      return item.url;
    }
  }

  const rawId = String(item.id || '');
  const cleanId = String(item.originalId || rawId).replace(/^fakap_/, '');

  // 3. YouTube standart 11 karakter ID kontrolü
  if (/^[a-zA-Z0-9_-]{11}$/.test(cleanId) && !rawId.startsWith('ext_')) {
    return `https://www.youtube.com/watch?v=${cleanId}`;
  }

  // 4. Harici platform kimlikleri (ext_...) için yedek çözümleme
  if (rawId.startsWith('ext_')) {
    const extId = rawId.replace(/^ext_/, '');
    const isInsta = item.platform === 'instagram' || (item.filePath && item.filePath.includes('0-Instagram'));
    if (isInsta && /^[a-zA-Z0-9_-]{9,15}$/.test(extId)) {
      return `https://www.instagram.com/reels/${extId}/`;
    }
  }

  return '';
}

export class DownloadQueue {
  constructor() {
    this.queue = [];
    this.activeDownloads = 0;
    this.maxConcurrent = 1;
    this.activeProcesses = new Map(); // videoId -> { process, status, video }
    this.isPaused = false;
    this.isNetworkWaiting = false;
    this.networkRecoveryTimer = null;
  }

  get activeProcess() {
    return this.getActiveDownloadingProcess();
  }

  set activeProcess(val) {
    if (val === null) {
      const activeVideoId = this.getActiveDownloadingVideoId();
      if (activeVideoId) {
        this.activeProcesses.delete(activeVideoId);
      }
    }
  }

  get activeVideoId() {
    return this.getActiveDownloadingVideoId();
  }

  set activeVideoId(val) {
    if (val === null) {
      const activeVideoId = this.getActiveDownloadingVideoId();
      if (activeVideoId) {
        this.activeProcesses.delete(activeVideoId);
      }
    }
  }

  getActiveDownloadingVideoId() {
    for (const [id, item] of this.activeProcesses.entries()) {
      if (item.status === 'downloading' || item.status === 'merging') {
        return id;
      }
    }
    return null;
  }

  getActiveDownloadingProcess() {
    for (const [id, item] of this.activeProcesses.entries()) {
      if (item.status === 'downloading' || item.status === 'merging') {
        return item.process;
      }
    }
    return null;
  }

  notifyTrayState() {
    try {
      const active = (typeof this.activeDownloads === 'number') ? this.activeDownloads : 0;
      console.log(`[TRAY_CMD] download_state=${active}`);
    } catch (e) {}
  }

  async add(video) {
    if (this.queue.some(item => item.id === video.id)) return;

    // Türkçe Açıklama: Eğer bu video ID'sine ait aktif süreç askıda kalmışsa, bayat süreci sonlandırıp temizleyelim
    if (this.activeProcesses.has(video.id)) {
      const staleProcInfo = this.activeProcesses.get(video.id);
      if (staleProcInfo) {
        if (staleProcInfo.timeoutTimer) clearTimeout(staleProcInfo.timeoutTimer);
        try {
          if (staleProcInfo.process && staleProcInfo.process.pid) {
            if (process.platform === 'win32') {
              exec(`taskkill /pid ${staleProcInfo.process.pid} /T /F`);
            } else {
              staleProcInfo.process.kill();
            }
          }
        } catch (e) {}
        this.activeProcesses.delete(video.id);
        console.log(`[Kuyruk Auto-Healing] "${video.title}" için eski askıdaki indirme süreci sonlandırıldı ve temizlendi.`);
      }
    }

    const release = await acquireDbLock();
    try {
      const db = readDb();
      
      // Klasör oluşturulmasını sağla
      if (!fs.existsSync(db.settings.downloadPath)) {
        try {
          fs.mkdirSync(db.settings.downloadPath, { recursive: true });
        } catch (err) {
          console.error('İndirme klasörü oluşturulamadı:', err);
        }
      }

      const rawYtId = video.originalId || (video.id.startsWith('fakap_') ? video.id.replace(/^fakap_/, '') : video.id);
      let historyItem = db.history.find(h => h.id === video.id);
      if (!historyItem) {
        historyItem = {
          id: video.id,
          originalId: rawYtId,
          isFakap: !!video.isFakap,
          title: video.title,
          channelId: video.channelId,
          channelName: video.channelName,
          thumbnail: video.thumbnail || (/^[a-zA-Z0-9_-]{11}$/.test(rawYtId) ? 'https://i.ytimg.com/vi/' + rawYtId + '/mqdefault.jpg' : '/logo.png'),
          downloadedAt: new Date().toISOString(),
          publishedAt: video.publishedAt || new Date().toISOString(),
          status: 'waiting',
          progress: 0,
          speed: '',
          eta: '',
          fileSize: '',
          filePath: '',
          isStandalone: video.isStandalone || false,
          duration: video.duration || '',
          platform: video.platform || (video.url && (video.url.includes('tiktok.com') ? 'tiktok' : (video.url.includes('twitter.com') || video.url.includes('x.com') ? 'x' : (video.url.includes('instagram.com') ? 'instagram' : 'youtube')))) || 'youtube',
          webUrl: video.webUrl || video.url || '',
          viewCount: video.viewCount || 0
        };
        db.history.push(historyItem);
        writeDb(db);
      } else {
        historyItem.status = 'waiting';
        historyItem.progress = 0;
        historyItem.speed = '';
        historyItem.eta = '';
        if (video.isFakap !== undefined) historyItem.isFakap = video.isFakap;
        if (video.originalId) historyItem.originalId = video.originalId;
        delete historyItem.error;
        delete historyItem.retryCount;
        delete historyItem.hidden;
        historyItem.resolveAttempts = 0;
        historyItem.downloadedAt = new Date().toISOString();
        if (video.publishedAt) {
          historyItem.publishedAt = video.publishedAt;
        }
        if (video.duration) {
          historyItem.duration = video.duration;
        }
        if (video.viewCount !== undefined) {
          historyItem.viewCount = video.viewCount;
        }
        writeDb(db);
      }

      // Fakap indirmeleri her zaman en sonda olsun (normal indirmeler öncelikli)
      if (video.isFakap) {
        this.queue.push(video);
      } else {
        const firstFakapIndex = this.queue.findIndex(item => item.isFakap);
        if (firstFakapIndex !== -1) {
          this.queue.splice(firstFakapIndex, 0, video);
        } else {
          this.queue.push(video);
        }
      }
      broadcast('db_update', readDb());
    } finally {
      release();
    }
    
    // Arka planda asenkron olarak boyut ve süre metadata'sını sorgula
    this.fetchMetadataAsync(video.id);
    
    this.process();
  }

  async fetchMetadataAsync(videoId) {
    try {
      // 1-2 saniye gecikmeyle arka planda sorgula (indirme kuyruğu performansını etkilememek için)
      setTimeout(() => {
        const db = readDb();
        const item = db.history.find(h => h.id === videoId);
        if (!item) return;

        // Boyut veya süre eksikse yt-dlp ile sorgulayalım
        if (!item.fileSize || !item.duration || item.duration === '-') {
          const isFakapItem = item.isFakap || String(videoId || '').startsWith('fakap_');
          const rawYtId = item.originalId || String(videoId || '').replace(/^fakap_/, '');
          const quality = isFakapItem
            ? (String(db.settings?.fakapQuality || '144').replace(/p$/i, '') + 'p')
            : (db.settings.quality || 'best');
          let formatSel = 'bestvideo+bestaudio/best';
          if (quality !== 'best') {
            const h = quality.replace('p', '');
            formatSel = `bestvideo[height<=${h}]+bestaudio/best`;
          }
          
          const targetMetaUrl = (/^[a-zA-Z0-9_-]{11}$/.test(rawYtId)) 
            ? `https://www.youtube.com/watch?v=${rawYtId}` 
            : (item.webUrl || item.url || '');
          if (!targetMetaUrl) return;
          const cmd = `"${ytdlpPath}" --simulate --format "${formatSel}" --print "%(filesize,filesize_approx)s|%(duration)s" "${targetMetaUrl}"`;
          const localTemp = getLocalTempDir();
          const execProc = execYtdlp(cmd, { env: { ...process.env, TEMP: localTemp, TMP: localTemp } }, (error, stdout, stderr) => {
            cleanMeiForPid(execProc.pid);
            if (!error && stdout) {
              const parts = stdout.trim().split('|');
              if (parts.length >= 2) {
                const rawSize = parts[0];
                const rawDuration = parseInt(parts[1], 10);
                
                const updateData = {};
                if (rawSize && rawSize !== 'NA' && rawSize !== 'null') {
                  const bytes = parseInt(rawSize, 10);
                  if (!isNaN(bytes)) {
                    updateData.fileSize = (bytes / (1024 * 1024)).toFixed(1) + ' MB';
                  }
                }
                if (rawDuration && !isNaN(rawDuration)) {
                  const hrs = Math.floor(rawDuration / 3600);
                  const mins = Math.floor((rawDuration % 3600) / 60);
                  const secs = rawDuration % 60;
                  updateData.duration = hrs > 0 
                    ? `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
                    : `${mins}:${secs.toString().padStart(2, '0')}`;
                }
                
                if (Object.keys(updateData).length > 0) {
                  updateHistoryItem(videoId, updateData);
                }
              }
            }
          });
        }
      }, 500);
    } catch (e) {
      console.warn('Metadata async fetch error:', e);
    }
  }

  handleNetworkDisconnection(video) {
    if (this.activeProcesses.has(video.id)) {
      const procInfo = this.activeProcesses.get(video.id);
      if (procInfo && procInfo.timeoutTimer) clearTimeout(procInfo.timeoutTimer);
      this.activeProcesses.delete(video.id);
    }
    this.activeDownloads = Math.max(0, this.activeDownloads - 1);
    this.notifyTrayState();

    // Videoyu kuyruğa iade et (Fakap ise sona, normal ise Fakap'ların önüne)
    if (!this.queue.some(item => item.id === video.id)) {
      if (video.isFakap) {
        this.queue.push(video);
      } else {
        const firstFakapIndex = this.queue.findIndex(item => item.isFakap);
        if (firstFakapIndex !== -1) {
          this.queue.splice(firstFakapIndex, 0, video);
        } else {
          this.queue.unshift(video);
        }
      }
    }

    const db = readDb();
    const settings = db?.settings || {};
    const lang = settings.lang || 'tr';

    const waitMsg = lang === 'en'
      ? 'Waiting for internet connection...'
      : 'İnternet bağlantısı bekleniyor...';

    updateHistoryItem(video.id, {
      status: 'waiting',
      progress: 0,
      speed: '',
      eta: '',
      error: waitMsg
    });

    this.isNetworkWaiting = true;

    const notifyMsg = lang === 'en'
      ? 'Internet connection lost. Download queue paused, will auto-resume when online.'
      : 'İnternet bağlantısı kesildi. İndirme kuyruğu beklemeye alındı, bağlantı gelince otomatik devam edecek.';

    console.warn(`[Kuyruk Ağ Koruma] ${notifyMsg}`);
    addTerminalLog(`[Kuyruk Ağ Koruma] ${notifyMsg}`, 'warning');
    broadcast('status_log', { message: notifyMsg, type: 'warning' });
    broadcast('db_update', readDb());
    playSystemSound('warning');
    showWindowsNotification(
      lang === 'en' ? 'Internet Disconnected' : 'İnternet Bağlantısı Kesildi',
      notifyMsg
    );

    try {
      const skipChannelFolder = video.skipChannelFolder === true;
      const targetDir = skipChannelFolder
        ? settings.downloadPath
        : path.join(settings.downloadPath, video.channelName);
      if (fs.existsSync(targetDir)) {
        const files = fs.readdirSync(targetDir);
        for (const file of files) {
          if (file.includes(`[${video.id}]`) && (file.endsWith('.part') || file.endsWith('.ytdl') || file.includes('.part-Frag'))) {
            try { fs.unlinkSync(path.join(targetDir, file)); } catch (e) {}
          }
        }
      }
    } catch (e) {}

    this.startNetworkRecoveryMonitor();
  }

  startNetworkRecoveryMonitor() {
    if (this.networkRecoveryTimer) return;
    const db = readDb();
    const intervalSec = parseInt(db?.settings?.networkRetryIntervalSeconds, 10) || 120;
    const intervalMs = Math.max(5, intervalSec) * 1000;
    console.log(`[Kuyruk Ağ Koruma] Otomatik kurtarma monitörü devrede. ${intervalSec} saniyede bir bağlantı denetlenecek...`);

    this.networkRecoveryTimer = setInterval(async () => {
      try {
        const online = await checkInternetConnection();
        if (online) {
          console.log('[Kuyruk Ağ Koruma] İnternet bağlantısı yeniden sağlandı! İndirmeler devam ettiriliyor.');
          clearInterval(this.networkRecoveryTimer);
          this.networkRecoveryTimer = null;
          this.isNetworkWaiting = false;

          const currentDb = readDb();
          const lang = currentDb?.settings?.lang || 'tr';
          const resumeMsg = lang === 'en'
            ? 'Internet connection restored! Resuming download queue...'
            : 'İnternet bağlantısı geri geldi! İndirme kuyruğu kaldığı yerden devam ediyor...';

          addTerminalLog(`[Kuyruk Ağ Koruma] ${resumeMsg}`, 'success');
          broadcast('status_log', { message: resumeMsg, type: 'success' });
          broadcast('db_update', readDb());
          playSystemSound('success');
          showWindowsNotification(
            lang === 'en' ? 'Internet Restored' : 'İnternet Bağlantısı Sağlandı',
            resumeMsg
          );

          this.process();
        }
      } catch (e) {}
    }, intervalMs);
  }

  process() {
    if (this.isPaused) {
      console.log('[Kuyruk] Queue paused. Bir sonraki indirme bekliyor.');
      return;
    }

    if (this.isNetworkWaiting) {
      console.log('[Kuyruk Ağ Koruma] İnternet bağlantısı bekleniyor. Kuyruk beklemeye alındı.');
      return;
    }

    const db = readDb();
    if (db && db.settings) {
      this.maxConcurrent = parseInt(db.settings.maxConcurrentDownloads, 10) || 1;
    }

    // Türkçe Açıklama: Auto-Healing - Kapanmış/ölmüş ancak haritada kalmış süreçleri otomatik temizle
    for (const [vid, procInfo] of this.activeProcesses.entries()) {
      if (!procInfo.process || procInfo.process.killed || procInfo.process.exitCode !== null) {
        if (procInfo.timeoutTimer) clearTimeout(procInfo.timeoutTimer);
        this.activeProcesses.delete(vid);
        console.log(`[Kuyruk Auto-Healing] Kapanmış süreç haritadan temizlendi: ${vid}`);
      }
    }

    if (this.activeProcesses.size === 0) {
      this.activeDownloads = 0;
    } else if (!this.activeProcess && this.activeDownloads > 0) {
      console.log(`[Kuyruk Safety] Aktif süreç bulunamadı, activeDownloads sıfırlanıyor.`);
      this.activeDownloads = 0;
    }

    if (this.activeDownloads >= this.maxConcurrent || this.queue.length === 0) return;

    // Normal indirmeler her zaman Fakap'tan önce çalışır; Fakap yalnızca normal indirmeler bitince alınır
    const normalIndex = this.queue.findIndex(v => !v.isFakap);
    const fakapMasterEnabled = db?.settings?.fakapEnabled !== false;
    if (normalIndex === -1 && !fakapMasterEnabled) {
      // Genel Fakap Anahtarı (Master Switch) kapalıysa bekleyen Fakap indirmeleri durdurulur
      return;
    }
    const nextIndex = normalIndex !== -1 ? normalIndex : 0;
    const [nextVideo] = this.queue.splice(nextIndex, 1);
    this.activeDownloads++;
    this.notifyTrayState();
    this.download(nextVideo);
  }

  async download(video) {
    try {
      await ensureYtdlp();
    } catch (err) {
      updateHistoryItem(video.id, {
        status: 'failed',
        error: 'yt-dlp motoru yüklenemedi.'
      });
      this.activeDownloads = Math.max(0, this.activeDownloads - 1);
      this.notifyTrayState();
      broadcast('db_update', readDb());
      this.process();
      return;
    }

    const db = readDb();
    const settings = db.settings;

    // Türkçe Açıklama: Temp sürücüsü doluysa yt-dlp açılamaz; indirmeyi başlatmadan uyar ve kuyruğu duraklat (toplu hata zincirini önler).
    const tempInfo = getTempSpaceInfo();
    if (tempInfo.low) {
      const diskMsg = buildDiskFullMessage(settings.lang, tempInfo);
      updateHistoryItem(video.id, { status: 'failed', progress: 0, speed: '', eta: '', error: diskMsg, errorCode: DISK_FULL_ERROR_CODE });
      this.isPaused = true;
      this.activeDownloads = Math.max(0, this.activeDownloads - 1);
      this.notifyTrayState();
      addTerminalLog(`[Kuyruk] ${diskMsg}`, 'error');
      broadcast('disk_warning', tempInfo);
      broadcast('db_update', readDb());
      return;
    }

    updateHistoryItem(video.id, { status: 'downloading', progress: 0 });
    addTerminalLog(`[Kuyruk] "${video.title}" videosu için indirme süreci başlatıldı.`, 'info');
    playSystemSound('start');
    showWindowsNotification(
      settings.lang === 'en' ? 'Download Started' : 'İndirme Başlatıldı',
      settings.lang === 'en' ? `"${video.title}" download process has started.` : `"${video.title}" videosunun indirme işlemi başladı.`,
      'download_start'
    );

    const skipChannelFolder = video.skipChannelFolder === true;
    let targetBaseDir = settings.downloadPath;
    if (video.isFakap) {
      targetBaseDir = (settings.fakapPath || '').trim() || path.join(settings.downloadPath, 'Fakap');
    }

    // Özel 0- ön ekli klasör tespiti
    let folderSubName = video.channelName || '';
    const vUrl = (video.url || '').toLowerCase();
    const isFollowedChannel = video.channelId && db.channels && db.channels.some(c => c.id === video.channelId);

    if (!video.isFakap && !skipChannelFolder) {
      if (vUrl.includes('tiktok.com') || video.platform === 'tiktok') {
        folderSubName = '0-TikTok';
      } else if (vUrl.includes('twitter.com') || vUrl.includes('x.com') || video.platform === 'x' || video.platform === 'twitter') {
        folderSubName = '0-X';
      } else if (vUrl.includes('instagram.com') || video.platform === 'instagram') {
        folderSubName = '0-Instagram';
      } else if (!isFollowedChannel) {
        folderSubName = '0-Unfollowed';
      }
    }

    const outputDir = skipChannelFolder
      ? targetBaseDir
      : path.join(targetBaseDir, folderSubName);

    const ytVideoId = video.originalId || (video.id ? video.id.replace(/^fakap_/, '') : '');

    if (!fs.existsSync(outputDir)) {
      try {
        fs.mkdirSync(outputDir, { recursive: true });
      } catch (err) {
        console.error('İndirme klasörü oluşturulamadı:', err);
      }
    } else {
      // Türkçe Açıklama: Önceki başarısız/yarım kalmış indirmelerden kalan birleşmemiş parçaları (.f137.mp4, .part vb.) temizle
      try {
        const filesInDir = fs.readdirSync(outputDir);
        for (const f of filesInDir) {
          if (f.includes(`[${ytVideoId}]`) && (f.endsWith('.part') || f.endsWith('.ytdl') || f.includes('.part-Frag') || /\.f\d+\.(mp4|m4a|webm)$/i.test(f))) {
            try { fs.unlinkSync(path.join(outputDir, f)); } catch (e) {}
          }
        }
      } catch (e) {}
    }

    const outputFilename = skipChannelFolder
      ? `%(title)s [${ytVideoId}].%(ext)s`
      : `${video.channelName} - %(title)s [${ytVideoId}].%(ext)s`;
    
    const isMp3 = (video.customFormat === 'audio-mp3');

    const userLang = settings.lang || 'tr';
    const subLangs = userLang === 'en'
      ? 'en,en-orig'
      : `${userLang},${userLang}-orig,en,en-orig`;

    const args = [
      video.url,
      '--no-playlist',
      '--no-mtime',
      '--ignore-errors',
      '--geo-bypass',
      '--windows-filenames',
      '--js-runtimes', `node:${process.execPath}`,
      '--replace-in-metadata', 'title', '[#?%]', '',
      '--replace-in-metadata', 'title', '[/\\\\:\\*\\?\"<>|｜|]', '-',
            '--newline',
      '--write-subs',
      '--write-auto-subs',
      '--sub-langs', subLangs,
      '--sub-format', 'srt/vtt/best',
      '--encoding', 'utf-8'
    ];

    const hasWorkingFfmpegEarly = testFfmpegSync();
    const isLiveStreamNow = (video.duration === 'live' || video.status === 'live');
    const isDeferMerge = Boolean(settings.deferMerge) && hasWorkingFfmpegEarly && (settings.mergeType || 'single') !== 'separate' && !isLiveStreamNow;
    const deferStagingDir = isDeferMerge ? getItemStagingDir(targetBaseDir, video.id) : '';
    if (isDeferMerge) {
      try {
        if (fs.existsSync(deferStagingDir)) {
          fs.rmSync(deferStagingDir, { recursive: true, force: true });
        }
        fs.mkdirSync(deferStagingDir, { recursive: true });
      } catch (e) {}
      args.push('--fixup', 'never');
    }

    // SSD / Hızlı Geçici Klasörde İndir ve Birleştir (Tamamlanınca Hedefe Taşı)
    if (isDeferMerge) {
      if (settings.useTempDownloadStaging === true) {
        const stagingDir = getStagingTempDir();
        args.push('-P', `home:${deferStagingDir}`);
        args.push('-P', `temp:${stagingDir}`);
        args.push('-o', outputFilename);
      } else {
        args.push('-o', path.join(deferStagingDir, outputFilename));
      }
    } else if (settings.useTempDownloadStaging === true) {
      const stagingDir = getStagingTempDir();
      args.push('-P', `home:${outputDir}`);
      args.push('-P', `temp:${stagingDir}`);
      args.push('-o', outputFilename);
    } else {
      args.push('-o', path.join(outputDir, outputFilename));
    }

    if (!isMp3) {
      args.push('--write-description');
    }

    const prefLang = (settings.preferredAudioLang && settings.preferredAudioLang !== 'auto')
      ? settings.preferredAudioLang
      : (settings.lang || 'tr');

    args.push('--add-header', `Accept-Language:${prefLang}-${prefLang.toUpperCase()},${prefLang};q=0.9,en-US;q=0.8,en;q=0.7`);
    
    const cookieArgs = getCookieArgs(settings);
    const hasCookies = cookieArgs.length > 0;

    const isYouTubeUrl = vUrl.includes('youtube.com') || vUrl.includes('youtu.be');
    if (isYouTubeUrl) {
      if (video._fallbackClient) {
        args.push('--extractor-args', `youtube:lang=${prefLang},${prefLang}-${prefLang.toUpperCase()};player_client=${video._fallbackClient}`);
      } else if (hasCookies) {
        // Çerez aktifken: visionos, ios, android, web_creator, mweb, web
        args.push('--extractor-args', `youtube:lang=${prefLang},${prefLang}-${prefLang.toUpperCase()};player_client=visionos,ios,android,web_creator,mweb,web`);
      } else {
        // Anonim modda: visionos, ios, android, web
        args.push('--extractor-args', `youtube:lang=${prefLang},${prefLang}-${prefLang.toUpperCase()};player_client=visionos,ios,android,web`);
      }
    }

    args.push('--remote-components', 'ejs:github');
    if (video._fallbackCodec || video.retryAttempt === 2) {
      // 2. Deneme (Son Şans) Güvenli Mod: Bozuk AV01 akışlarını atlayıp kararlı AVC1 (h264) veya VP9 formatına öncelik verir
      args.push('--format-sort', 'hasvid,res,fps,hdr,vcodec:h264:vp9');
    } else {
      args.push('--format-sort', 'hasvid,res,fps,hdr,vcodec');
    }

    const effectiveSpeed = getEffectiveSpeedLimit(settings);
    if (effectiveSpeed && effectiveSpeed > 0) {
      args.push('--limit-rate', `${effectiveSpeed}K`);
    }

    // Çerez kaynağını ekle (cookies.txt -> Dahili WebView2 -> Harici Tarayıcı)
    if (hasCookies) {
      args.push(...cookieArgs);
    }

    if (video._proxy) {
      args.push('--proxy', video._proxy);
    }

    const channelConfig = db.channels.find(c => c.id === video.channelId);
    const videoQuality = (channelConfig && channelConfig.quality && channelConfig.quality !== 'default') 
      ? channelConfig.quality 
      : settings.quality;

    const hasWorkingFfmpeg = testFfmpegSync();
    let actualMergeType = settings.mergeType || 'single';

    if (actualMergeType === 'merge' && !hasWorkingFfmpeg) {
      actualMergeType = 'single';
      console.log(`[Warning] FFmpeg is not found or not working. Falling back to 'single' download mode.\n`);
      addTerminalLog(`[Warning] FFmpeg not found or not working. Falling back to single file download (best pre-merged quality).`, 'warning');
    }

    const audioPrefChain = `bestaudio[language^=${prefLang}]/bestaudio[language=original]/bestaudio`;

    if (video.isFakap) {
      // Türkçe Açıklama: Fakap yedeği istenen çözünürlükte yoksa sırayla bir üst basamağa çıkar
      // (144 -> 240 -> 360). Hiçbiri yoksa mevcut en düşük akışa düşer; böylece video asla boşta kalmaz.
      const LADDER = [144, 240, 360];
      let maxH = 144;
      const fakapQ = String(settings.fakapQuality || '144').replace(/p$/i, '');
      if (fakapQ === 'best') maxH = 4320;
      else maxH = parseInt(fakapQ, 10) || 144;
      const steps = LADDER.filter(h => h >= maxH);
      if (steps.length === 0) steps.push(maxH);
      const fakapParts = [];
      if (isDeferMerge) {
        for (const h of steps) {
          fakapParts.push(`((bestvideo[height<=${h}]),(${audioPrefChain}))`);
          fakapParts.push(`best[height<=${h}]`);
        }
        fakapParts.push('((worstvideo),(worstaudio))/worst');
        args.push('-f', fakapParts.join('/'));
      } else {
        for (const h of steps) {
          fakapParts.push(`bestvideo[height<=${h}]+bestaudio[language^=${prefLang}]`);
          fakapParts.push(`bestvideo[height<=${h}]+bestaudio[language=original]`);
          fakapParts.push(`bestvideo[height<=${h}]+bestaudio`);
          fakapParts.push(`best[height<=${h}]`);
        }
        fakapParts.push('worstvideo+worstaudio/worst');
        args.push('-f', fakapParts.join('/'));
        if (hasWorkingFfmpeg) {
          args.push('--merge-output-format', 'mp4');
        }
      }
    } else if (video.customFormat) {
      const fmt = video.customFormat;
      if (fmt === 'audio-mp3') {
        const bitrate = video.audioBitrate || '192';
        if (isDeferMerge) {
          args.push('-f', audioPrefChain);
        } else {
          args.push('-f', audioPrefChain, '--extract-audio', '--audio-format', 'mp3', '--audio-quality', `${bitrate}K`, '--embed-thumbnail');
        }
      } else {
        let maxH = 1080;
        if (fmt === 'video-720p') maxH = 720;
        else if (fmt === 'video-480p') maxH = 480;
        else if (fmt === 'video-360p') maxH = 360;
        else if (fmt === 'video-240p') maxH = 240;
        else if (fmt === 'video-144p') maxH = 144;
        else if (fmt === 'video-best' || fmt === 'video-4k' || fmt === 'video-2160p') maxH = 4320;
        else if (fmt === 'video-1440p' || fmt === 'video-2k') maxH = 1440;
        else if (fmt === 'video-1080p') maxH = 1080;

        const excludeAv01 = (video._fallbackCodec || video.retryAttempt === 2) ? '[vcodec!^=av01]' : '';
        const vSpec = `bestvideo[height<=${maxH}]${excludeAv01}`;
        if (isDeferMerge) {
          args.push('-f', `((${vSpec}),(${audioPrefChain}))/best[height<=${maxH}]/best`);
        } else {
          const fmtCombo = `${vSpec}+bestaudio[language^=${prefLang}]/${vSpec}+bestaudio[language=original]/${vSpec}+bestaudio/best[height<=${maxH}]/best`;
          args.push('-f', fmtCombo);
          if (hasWorkingFfmpeg) {
            args.push('--merge-output-format', 'mp4');
          }
        }
      }
    } else {
      let maxH = (videoQuality === '1080p') ? 1080 : ((videoQuality === '720p') ? 720 : 4320);
      const excludeAv01 = (video._fallbackCodec || video.retryAttempt === 2) ? '[vcodec!^=av01]' : '';
      const vSpec = `bestvideo[height<=${maxH}]${excludeAv01}`;
      const fmtCombo = `${vSpec}+bestaudio[language^=${prefLang}]/${vSpec}+bestaudio[language=original]/${vSpec}+bestaudio/best[height<=${maxH}]/best`;
      
      if (actualMergeType === 'separate') {
        args.push('-f', `${vSpec},${audioPrefChain}`);
      } else if (isDeferMerge) {
        args.push('-f', `((${vSpec}),(${audioPrefChain}))/best[height<=${maxH}]/best`);
      } else {
        args.push('-f', fmtCombo);
        if (hasWorkingFfmpeg) {
          args.push('--merge-output-format', 'mp4');
        }
      }
    }

    if (settings.writeThumbnail || isMp3) {
      args.push('--write-thumbnail');
      if (hasWorkingFfmpeg && !isDeferMerge) {
        args.push('--convert-thumbnails', 'jpg');
      }
    }

    if (isDeferMerge) {
      const deferLog = `[OYUN MODU] Birleştirme ertelendi — yalnızca ham akışlar indiriliyor (0% FFmpeg yükü): "${video.title}"`;
      console.log(deferLog);
      addTerminalLog(deferLog, 'info');
    } else if (hasWorkingFfmpeg) {
      args.push('--ffmpeg-location', path.dirname(getFfmpegPath()));

      const hwMode = settings.hardwareAcceleration || 'auto';
      const hwInfo = detectHwaccel();
      const effectiveHw = (hwMode === 'auto') ? hwInfo.recommended : hwMode;

      if (effectiveHw === 'nvenc' && (hwInfo.nvenc || hwMode === 'nvenc')) {
        args.push('--postprocessor-args', 'VideoConvertor:-c:v h264_nvenc');
        const logMsg = '[DONANIM HIZLANDIRMA] NVIDIA NVENC GPU hızlandırması devrede.';
        console.log(logMsg);
        addTerminalLog(logMsg, 'info');
      } else if (effectiveHw === 'qsv' && (hwInfo.qsv || hwMode === 'qsv')) {
        args.push('--postprocessor-args', 'VideoConvertor:-c:v h264_qsv');
        const logMsg = '[DONANIM HIZLANDIRMA] Intel Quick Sync (QSV) hızlandırması devrede.';
        console.log(logMsg);
        addTerminalLog(logMsg, 'info');
      } else if (effectiveHw === 'amf' && (hwInfo.amf || hwMode === 'amf')) {
        args.push('--postprocessor-args', 'VideoConvertor:-c:v h264_amf');
        const logMsg = '[DONANIM HIZLANDIRMA] AMD AMF GPU hızlandırması devrede.';
        console.log(logMsg);
        addTerminalLog(logMsg, 'info');
      } else {
        args.push('--postprocessor-args', 'VideoConvertor:-c:v libx264');
      }
    }
    // Canlı Yayın Garantili İndirme: Sadece aktif canlı yayınlarda --live-from-start kullan, normal ve sonlanmış yayınlarda kullanma
    if (video.duration === 'live' || video.status === 'live') {
      args.push('--live-from-start', '--concurrent-fragments', '4', '--hls-use-mpegts');
    } else if (video._singleFragmentMode || video.retryAttempt === 2) {
      // 2. Deneme (Son Şans) Güvenli Mod: Mükerrer DASH başlık bozulmasını önlemek için tek parça akışı kullanılır
      args.push('--concurrent-fragments', '1');
    } else {
      args.push('--concurrent-fragments', '4');
    }
    args.push('--fragment-retries', '10', '--retries', '5', '--retry-sleep', 'fragment:exp=1:20', '--skip-unavailable-fragments');

    const startLogMsg = `[İNDİRME] İndirme başlatılıyor: "${video.title}"`;
    const cmdLogMsg = `[KOMUT] yt-dlp ${args.join(' ')}`;
    console.log(startLogMsg);
    console.log(cmdLogMsg);
    addTerminalLog(startLogMsg, 'info');
    addTerminalLog(cmdLogMsg, 'info');

    const localTemp = getLocalTempDir();
    const spawnOptions = {
      env: { ...process.env, TEMP: localTemp, TMP: localTemp, PYTHONIOENCODING: 'utf-8', LC_ALL: 'en_US.UTF-8' },
      ...(process.platform === 'win32' 
        ? { stdio: ['ignore', 'pipe', 'pipe'] } 
        : { stdio: ['ignore', 'pipe', 'pipe'], detached: true })
    };
    const timeoutDuration = 30 * 60 * 1000;
    const downloadProc = spawnYtdlp(args, spawnOptions);
    if (downloadProc.stdout) downloadProc.stdout.setEncoding('utf8');
    if (downloadProc.stderr) downloadProc.stderr.setEncoding('utf8');
    
    const timeoutTimer = setTimeout(() => {
      const procInfo = this.activeProcesses.get(video.id);
      if (procInfo && procInfo.process) {
        console.error(`[Zaman Aşımı] "${video.title}" indirme/birleştirme işlemi 30 dakikayı geçtiği için sonlandırılıyor.`);
        addTerminalLog(`[Zaman Aşımı] "${video.title}" işlemi 30 dakikayı geçtiği için otomatik sonlandırıldı.`, 'error');
        
        try {
          if (process.platform === 'win32') {
            exec(`taskkill /pid ${procInfo.process.pid} /T /F`);
          } else {
            process.kill(-procInfo.process.pid);
          }
        } catch (e) {
          procInfo.process.kill();
        }
        
        updateHistoryItem(video.id, {
          status: 'error',
          error: 'İndirme zaman aşımına uğradı (Takıldı).'
        });
      }
    }, timeoutDuration);

    // %0 Takılma Koruması (Yeni sonlanmış VOD işleme sürecindeki canlı yayınlar için 45sn zaman aşımı)
    const isLiveTarget = (video.duration === 'live' || video.status === 'live');
    const stallTimer = isLiveTarget ? setTimeout(() => {
      const procInfo = this.activeProcesses.get(video.id);
      if (procInfo && procInfo.status === 'downloading' && (!procInfo.progress || procInfo.progress === 0)) {
        console.warn(`[Canlı Yayın Koruması] "${video.title}" 45 saniyedir %0'da takıldı. Canlı yayın VOD işleme aşamasında olduğu için indirme ertelendi.`);
        addTerminalLog(`[Canlı Yayın Koruması] "${video.title}" %0'da takıldı. Canlı yayın henüz yeni sonlandı, YouTube VOD işlemesi bekleniyor.`, 'warning');
        
        try {
          if (process.platform === 'win32') {
            exec(`taskkill /pid ${procInfo.process.pid} /T /F`);
          } else {
            procInfo.process.kill();
          }
        } catch (e) {}

        if (procInfo.timeoutTimer) clearTimeout(procInfo.timeoutTimer);
        this.activeProcesses.delete(video.id);
        this.activeDownloads = Math.max(0, this.activeDownloads - 1);

        updateHistoryItem(video.id, {
          status: 'waiting_live_processing',
          error: 'Canlı yayın yeni sonlandı, YouTube VOD işlemesi bekleniyor.'
        });
        this.process();
      }
    }, 45000) : null;

    this.activeProcesses.set(video.id, {
      process: downloadProc,
      status: 'downloading',
      video: video,
      timeoutTimer: timeoutTimer,
      stallTimer: stallTimer,
      progress: 0
    });

    downloadProc.stdout.on('data', (data) => {
      const output = data.toString();
      
      // \r ayracı da satır sonu kabul edilir (yt-dlp/ffmpeg ilerleme satırları birleşmesin)
      const lines = output.split(/[\r\n]+/);
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed) {
          const isProgressSpam = trimmed.includes('[download]') && trimmed.includes('%') && (trimmed.includes('at') || trimmed.includes('ETA'));
          const isFragmentRetrySpam = trimmed.includes('Got error: HTTP Error 403') || trimmed.includes('Retrying fragment');
          if (!isProgressSpam && !isFragmentRetrySpam) {
            let logType = 'info';
            if (trimmed.startsWith('[download]')) logType = 'success';
            else if (trimmed.startsWith('[ffmpeg]') || trimmed.startsWith('[Merger]')) logType = 'warning';
            addTerminalLog(`[yt-dlp] ${trimmed}`, logType);
          }
        }
      }

      const isMergingOutput = output.includes('[Merger]') || 
                              output.includes('[ffmpeg]') || 
                              output.includes('[VideoConvertor]') || 
                              output.includes('[postprocess]') || 
                              output.includes('[ExtractAudio]');
      
      let isProgress100 = false;
      const progressMatch = output.match(/\[download\]\s+(\d+\.\d+)%\s+of/);
      if (progressMatch) {
        const percent = parseFloat(progressMatch[1]);
        if (percent >= 100.0) {
          isProgress100 = true;
        }
      }

      if (!isDeferMerge && (isMergingOutput || isProgress100)) {
        const procInfo = this.activeProcesses.get(video.id);
        if (procInfo && procInfo.status === 'downloading') {
          procInfo.status = 'merging';
          console.log(`[Kuyruk] "${video.title}" videosunun indirmesi bitti, FFmpeg birleştirme (merge) aşamasına geçildi.`);
          addTerminalLog(`[Kuyruk] "${video.title}" videosunun indirmesi bitti, FFmpeg birleştirme (merge) aşamasına geçildi.`, 'warning');
          
          updateHistoryItem(video.id, {
            status: 'merging',
            progress: 100,
            speed: '',
            eta: ''
          });
          broadcast('db_update', readDb());
        }
      }

      // 2. Detaylı İlerleme Bilgisi (Yüzde, Boyut, Hız, Kalan Süre - tilde ~ ve DASH parçaları destekli)
      const detailMatch = output.match(/\[download\]\s+(\d+(?:\.\d+)?)%\s+of\s+~?\s*([\d\.]+\s*[a-zA-Z]+|\d+\s*fragments)\s+at\s+([^\s]+)\s+ETA\s+([^\s]+)/i);
      if (detailMatch) {
        const percent = parseFloat(detailMatch[1]);
        const rawSize = detailMatch[2];
        const speed = detailMatch[3];
        const eta = detailMatch[4];

        const procInfo = this.activeProcesses.get(video.id);
        if (procInfo && procInfo.status === 'downloading') {
          procInfo.progress = percent;
          if (percent > 0 && procInfo.stallTimer) {
            clearTimeout(procInfo.stallTimer);
            delete procInfo.stallTimer;
          }
          updateHistoryItem(video.id, {
            progress: percent,
            fileSize: rawSize,
            speed: speed,
            eta: eta
          }, { persist: false });

          broadcast('progress', {
            id: video.id,
            progress: percent,
            speed: speed,
            eta: eta,
            fileSize: rawSize
          });
        }
      } else {
        // 3. DASH Parça İlerleme Desteği (Örn: Fragment 164 of 1618)
        const fragMatch = output.match(/(?:fragment|chunk)\s+(\d+)\s+of\s+(\d+)/i);
        if (fragMatch) {
          const currentFrag = parseInt(fragMatch[1], 10);
          const totalFrags = parseInt(fragMatch[2], 10);
          if (totalFrags > 0) {
            const percent = parseFloat(((currentFrag / totalFrags) * 100).toFixed(1));
            const procInfo = this.activeProcesses.get(video.id);
            if (procInfo && procInfo.status === 'downloading') {
              if (percent > 0 && procInfo.stallTimer) {
                clearTimeout(procInfo.stallTimer);
                delete procInfo.stallTimer;
              }
              updateHistoryItem(video.id, {
                progress: percent,
                speed: 'DASH Stream',
                eta: `${currentFrag}/${totalFrags} Parça`
              }, { persist: false });

              broadcast('progress', {
                id: video.id,
                progress: percent,
                speed: 'DASH Stream',
                eta: `${currentFrag}/${totalFrags} Parça`,
                fileSize: `${totalFrags} Parça`
              });
            }
          }
        }
      }
    });

    let errorOutput = '';
    let stderrBuffer = '';
    // Gerçek hata satırları: WARNING ve zararsız ffmpeg çıktıları hariç yalnızca gerçek hatalar toplanır
    let realErrorLines = [];

    function handleStderrLine(line) {
      const trimmed = line.trim();
      if (!trimmed) return;

      const lowerTrimmed = trimmed.toLowerCase();
      // HLS/TS ilerleme satırları (size=... time=... bitrate=...) ilerleme spamı sayılır
      const isFfmpegProgress = lowerTrimmed.startsWith('frame=') || (lowerTrimmed.includes('fps=') && lowerTrimmed.includes('size=') && lowerTrimmed.includes('time=')) || (lowerTrimmed.includes('size=') && lowerTrimmed.includes('time=') && lowerTrimmed.includes('bitrate='));
      const isFfmpegOpening = lowerTrimmed.includes('opening \'http') || /\[[a-z0-9]+ @ [0-9a-fx]+\] opening/i.test(trimmed);
      const isFfmpegInfo = lowerTrimmed.includes('last message repeated') ||
                           lowerTrimmed.startsWith('input #') ||
                           lowerTrimmed.startsWith('duration:') ||
                           lowerTrimmed.startsWith('program ') ||
                           lowerTrimmed.startsWith('metadata:') ||
                           lowerTrimmed.includes('variant_bitrate') ||
                           lowerTrimmed.includes('stream #') ||
                           lowerTrimmed.includes('stream mapping:') ||
                           lowerTrimmed.startsWith('output #') ||
                           lowerTrimmed.includes('encoder') ||
                           lowerTrimmed.includes('press [q] to stop') ||
                           lowerTrimmed.includes('id3v2_priv') ||
                           lowerTrimmed.includes('transportstreamtimestamp') ||
                           lowerTrimmed.includes('thread message queue blocking');
      const isFfmpegConnection = /^\[[a-z0-9#_/.-]+ @ 0x?[0-9a-f]+\]/i.test(trimmed) && (
        lowerTrimmed.includes('cannot reuse') ||
        lowerTrimmed.includes('keepalive') ||
        lowerTrimmed.includes('retry') ||
        lowerTrimmed.includes('http connection')
      );

      const isFfmpegSkip = /^\[[a-z0-9#_/.-]+ @ 0x?[0-9a-f]+\]/i.test(trimmed) && (
        lowerTrimmed.includes('skip') ||
        lowerTrimmed.includes('daterange') ||
        lowerTrimmed.includes('#ext-x-')
      );

      if (
        isFfmpegProgress ||
        isFfmpegOpening ||
        isFfmpegInfo ||
        isFfmpegConnection ||
        isFfmpegSkip ||
        lowerTrimmed.includes('no impersonate target is available') ||
        lowerTrimmed.includes('impersonation for this download')
      ) {
        return;
      }

      const isWarning = lowerTrimmed.includes('warning:') || lowerTrimmed.includes('uyari:');

      if (lowerTrimmed.includes('unable to download video subtitles') || lowerTrimmed.includes('http error 429')) {
        const cleanMsg = `[yt-dlp Uyarı] Altyazı uyarısı (YouTube sunucusu 429 kısıtlaması verdi - Video indirmesi kesintisiz devam ediyor).`;
        addTerminalLog(cleanMsg, 'warning');
      } else if (isWarning) {
        addTerminalLog(`[yt-dlp Uyarı] ${trimmed}`, 'warning');
      } else {
        addTerminalLog(`[yt-dlp Error] ${trimmed}`, 'error');
        realErrorLines.push(trimmed);
      }
    }

    downloadProc.stderr.on('data', (data) => {
      const output = data.toString();
      errorOutput += output;
      if (errorOutput.length > 50000) {
        errorOutput = errorOutput.slice(-50000);
      }
      stderrBuffer += output;
      
      // \r ayracı da satır sonu kabul edilir (ffmpeg ilerleme/HLS satırları birleşmesin)
      const lines = stderrBuffer.split(/[\r\n]+/);
      stderrBuffer = lines.pop();
      
      for (const line of lines) {
        handleStderrLine(line);
      }
    });

    downloadProc.stderr.on('end', () => {
      if (stderrBuffer) {
        handleStderrLine(stderrBuffer);
      }
    });

    downloadProc.on('close', async (code) => {
      cleanMeiForPid(downloadProc.pid);
      const procInfo = this.activeProcesses.get(video.id);
      if (!procInfo) return;

      if (procInfo.timeoutTimer) {
        clearTimeout(procInfo.timeoutTimer);
      }
      if (procInfo.stallTimer) {
        clearTimeout(procInfo.stallTimer);
      }

      this.activeProcesses.delete(video.id);

      this.activeDownloads = Math.max(0, this.activeDownloads - 1);
      this.notifyTrayState();

      const db = readDb();
      const currentItem = db.history.find(h => h.id === video.id);
      const isCancelled = currentItem && currentItem.error === 'Kullanıcı tarafından iptal edildi.';

      if (isCancelled) {
        if (isDeferMerge && deferStagingDir && fs.existsSync(deferStagingDir)) {
          try { fs.rmSync(deferStagingDir, { recursive: true, force: true }); } catch (_) {}
        }
        broadcast('status_log', { message: `İndirme iptal edildi: ${video.title}`, type: 'info', thumbnail: `/api/video/${video.id}/thumbnail` });
        addTerminalLog(`[Kuyruk] İndirme kullanıcı tarafından iptal edildi: "${video.title}"`, 'warning');
        broadcast('db_update', readDb());
        this.process();
        return;
      }

      if (code === 0 && isDeferMerge) {
        const skipChannelFolder = video.skipChannelFolder === true;
        const ytVideoId = video.originalId || (video.id ? video.id.replace(/^fakap_/, '') : '');
        const nonMediaExts = new Set(['.jpg', '.jpeg', '.webp', '.png', '.json', '.temp', '.part', '.ytdl', '.srt', '.vtt', '.description', '.txt']);

        let stagedFiles = [];
        try {
          if (fs.existsSync(deferStagingDir)) {
            stagedFiles = fs.readdirSync(deferStagingDir).filter(f => f !== 'manifest.json');
          }
        } catch (_) {}

        const mediaFiles = stagedFiles.filter(f => !nonMediaExts.has(path.extname(f).toLowerCase()));
        const companionFiles = stagedFiles.filter(f => ['.srt', '.vtt', '.description', '.jpg', '.jpeg', '.webp', '.png'].includes(path.extname(f).toLowerCase()));

        if (mediaFiles.length === 0) {
          updateHistoryItem(video.id, {
            status: 'failed',
            progress: 0,
            speed: '',
            eta: '',
            error: settings.lang === 'en' ? 'Video stream files not found.' : 'İndirilen ham video akışları bulunamadı.'
          });
          addTerminalLog(`[Kuyruk] İndirme FAILED: "${video.title}" - Ham akış dosyaları bulunamadı.`, 'error');
          playSystemSound('error');
        } else {
          // Başlığı ilk medya dosyasından çözümle (.fXXX eki ve [id] ayıklanarak)
          let resolvedTitle = video.title;
          try {
            const firstFile = mediaFiles[0];
            const baseNoExt = path.basename(firstFile, path.extname(firstFile)).replace(/\.f[a-zA-Z0-9_-]+$/, '');
            const idPattern = ` [${ytVideoId}]`;
            if (baseNoExt.endsWith(idPattern)) {
              const withoutId = baseNoExt.substring(0, baseNoExt.length - idPattern.length);
              if (skipChannelFolder) {
                resolvedTitle = withoutId;
              } else {
                const prefix = `${video.channelName} - `;
                if (withoutId.startsWith(prefix)) {
                  resolvedTitle = withoutId.substring(prefix.length);
                } else {
                  const dashIdx = withoutId.indexOf(' - ');
                  resolvedTitle = dashIdx !== -1 ? withoutId.substring(dashIdx + 3) : withoutId;
                }
              }
            }
          } catch (_) {}

          // Zaten tek parça hazır .mp4 ise (örn. TikTok/Instagram/X) bekletmeden doğrudan hedefe taşı
          const isAlreadySingleMp4 = !isMp3 &&
            !settings.writeThumbnail &&
            mediaFiles.length === 1 &&
            path.extname(mediaFiles[0]).toLowerCase() === '.mp4' &&
            !/\.f[a-zA-Z0-9_-]+\.mp4$/i.test(mediaFiles[0]);

          if (isAlreadySingleMp4) {
            if (!fs.existsSync(outputDir)) {
              fs.mkdirSync(outputDir, { recursive: true });
            }
            const finalDirectPath = path.join(outputDir, mediaFiles[0]);
            try {
              if (fs.existsSync(finalDirectPath)) fs.unlinkSync(finalDirectPath);
              fs.renameSync(path.join(deferStagingDir, mediaFiles[0]), finalDirectPath);
            } catch (_) {
              fs.copyFileSync(path.join(deferStagingDir, mediaFiles[0]), finalDirectPath);
            }
            for (const cf of companionFiles) {
              try {
                const destCf = path.join(outputDir, cf);
                if (fs.existsSync(destCf)) fs.unlinkSync(destCf);
                fs.renameSync(path.join(deferStagingDir, cf), destCf);
              } catch (_) {}
            }
            try {
              fs.rmSync(deferStagingDir, { recursive: true, force: true });
              const pRoot = path.dirname(deferStagingDir);
              if (path.basename(pRoot) === '.pending_merge' && fs.existsSync(pRoot) && fs.readdirSync(pRoot).length === 0) {
                fs.rmdirSync(pRoot);
              }
            } catch (_) {}

            const stats = fs.statSync(finalDirectPath);
            const sizeStr = stats.size >= 1024 * 1024 * 1024
              ? (stats.size / (1024 * 1024 * 1024)).toFixed(2) + ' GB'
              : Math.max(1, Math.round(stats.size / (1024 * 1024))) + ' MB';
            const actualQuality = getVideoResolution(finalDirectPath);
            const actualDurationInfo = getVideoDurationFromFile(finalDirectPath);

            updateHistoryItem(video.id, {
              status: 'completed',
              progress: 100,
              filePath: finalDirectPath,
              title: resolvedTitle,
              ...(video.channelName ? { channelName: video.channelName } : {}),
              ...(video.channelId ? { channelId: video.channelId } : {}),
              ...(video.platform ? { platform: video.platform } : {}),
              ...(video.webUrl ? { webUrl: video.webUrl } : {}),
              speed: '',
              eta: '',
              fileSize: sizeStr,
              ...(actualQuality ? { actualQuality } : {}),
              ...(actualDurationInfo ? { duration: actualDurationInfo.duration, durationSeconds: actualDurationInfo.durationSeconds } : {})
            });
            broadcast('status_log', { message: `İndirme tamamlandı (Tek Akış): ${resolvedTitle}`, type: 'success', thumbnail: `/api/video/${video.id}/thumbnail` });
            addTerminalLog(`[Oyun Modu] Tek akışlı hazır MP4 indirildi (FFmpeg gerekmedi): "${resolvedTitle}"`, 'success');
          } else {
            // Ham parçaları birleştirme kuyruğuna (pending_merge) kaydet
            let totalRawBytes = 0;
            for (const mf of mediaFiles) {
              try { totalRawBytes += fs.statSync(path.join(deferStagingDir, mf)).size; } catch (_) {}
            }
            const rawSizeStr = totalRawBytes >= 1024 * 1024 * 1024
              ? (totalRawBytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB'
              : Math.max(1, Math.round(totalRawBytes / (1024 * 1024))) + ' MB';

            const manifestData = {
              id: video.id,
              ytVideoId,
              title: resolvedTitle,
              channelName: video.channelName || '',
              channelId: video.channelId || '',
              platform: video.platform || '',
              webUrl: video.webUrl || '',
              isFakap: !!video.isFakap,
              skipChannelFolder,
              outputDir,
              isMp3,
              audioBitrate: video.audioBitrate || '192',
              writeThumbnail: !!settings.writeThumbnail,
              mediaFiles,
              companionFiles,
              createdAt: new Date().toISOString()
            };
            fs.writeFileSync(path.join(deferStagingDir, 'manifest.json'), JSON.stringify(manifestData, null, 2), 'utf8');

            updateHistoryItem(video.id, {
              status: 'pending_merge',
              progress: 100,
              title: resolvedTitle,
              ...(video.channelName ? { channelName: video.channelName } : {}),
              ...(video.channelId ? { channelId: video.channelId } : {}),
              ...(video.platform ? { platform: video.platform } : {}),
              ...(video.webUrl ? { webUrl: video.webUrl } : {}),
              speed: '',
              eta: '',
              stagingDir: deferStagingDir,
              targetFormat: isMp3 ? 'MP3' : 'MP4',
              fileSize: rawSizeStr
            });

            const queuedMsg = settings.lang === 'en'
              ? `Downloaded (Awaiting Merge): ${resolvedTitle} (${rawSizeStr})`
              : `İndirildi (Birleştirme Bekliyor): ${resolvedTitle} (${rawSizeStr})`;
            broadcast('status_log', { message: queuedMsg, type: 'info', thumbnail: `/api/video/${video.id}/thumbnail` });
            addTerminalLog(`[Oyun Modu] Ham akışlar indirildi ve Birleştirme Kuyruğuna alındı: "${resolvedTitle}" (${rawSizeStr})`, 'success');

            // İndirme sürerken kullanıcı Oyun Modunu kapattıysa bekletmeden otomatik sıraya al
            const freshDb = readDb();
            if (!freshDb.settings?.deferMerge) {
              setTimeout(() => mergeQueue.startAllAutoIfIdle(), 100);
            }
          }
        }
      } else if (code === 0) {
        let actualPath = '';
        let resolvedTitle = video.title;
        const skipChannelFolder = video.skipChannelFolder === true;
        const ytVideoId = video.originalId || (video.id ? video.id.replace(/^fakap_/, '') : '');
        try {
          const sanitizedChannelName = (video.channelName || '').replace(/[. ]+$/, '#');
          const candidateDirs = [];

          let targetBaseDir = settings.downloadPath;
          if (video.isFakap) {
            targetBaseDir = (settings.fakapPath || '').trim() || path.join(settings.downloadPath, 'Fakap');
          }

          if (skipChannelFolder) {
            candidateDirs.push(targetBaseDir);
          } else {
            candidateDirs.push(path.join(targetBaseDir, folderSubName));
            if (folderSubName !== video.channelName) {
              candidateDirs.push(path.join(targetBaseDir, video.channelName));
            }
            if (sanitizedChannelName !== video.channelName) {
              candidateDirs.push(path.join(targetBaseDir, sanitizedChannelName));
            }
            try {
              const rootEntries = fs.readdirSync(targetBaseDir, { withFileTypes: true });
              for (const entry of rootEntries) {
                if (entry.isDirectory() && (!video.isFakap ? !isInsideFakap(path.join(targetBaseDir, entry.name)) : true)) {
                  const fullSubDir = path.join(targetBaseDir, entry.name);
                  if (!candidateDirs.includes(fullSubDir)) {
                    candidateDirs.push(fullSubDir);
                  }
                }
              }
            } catch (errRoot) {}
          }

          let matchedFile = null;
          let matchedDir = '';

          for (const targetDir of candidateDirs) {
            if (!fs.existsSync(targetDir)) continue;
            try {
              const files = fs.readdirSync(targetDir);
              const match = files.find(f => {
                if (!f.includes(`[${ytVideoId}]`)) return false;
                const ext = path.extname(f).toLowerCase();
                return !['.jpg', '.jpeg', '.webp', '.png', '.json', '.temp', '.part', '.ytdl', '.srt', '.vtt', '.description'].includes(ext);
              });
              if (match) {
                matchedFile = match;
                matchedDir = targetDir;
                break;
              }
            } catch (eDir) {}
          }

          if (matchedFile && matchedDir) {
            actualPath = path.join(matchedDir, matchedFile);
            const baseName = path.basename(matchedFile, path.extname(matchedFile));
            const idPattern = ` [${ytVideoId}]`;
            if (baseName.endsWith(idPattern)) {
              const withoutId = baseName.substring(0, baseName.length - idPattern.length);
              if (skipChannelFolder) {
                resolvedTitle = withoutId;
              } else {
                const prefix = `${video.channelName} - `;
                if (withoutId.startsWith(prefix)) {
                  resolvedTitle = withoutId.substring(prefix.length);
                } else {
                  const dashIdx = withoutId.indexOf(' - ');
                  if (dashIdx !== -1) {
                    resolvedTitle = withoutId.substring(dashIdx + 3);
                  } else {
                    resolvedTitle = withoutId;
                  }
                  if (!resolvedTitle || resolvedTitle === 'NA' || /^(?:Video|Post) by/i.test(resolvedTitle)) {
                    if (video.title && video.title !== 'NA' && !/^(?:Video|Post) by/i.test(video.title)) {
                      resolvedTitle = video.title;
                    } else if (resolvedTitle && /^(?:Video|Post) by/i.test(resolvedTitle)) {
                      const stripped = resolvedTitle.replace(/^(?:Video|Post) by [a-zA-Z0-9._]+[:\s-]*/i, '').trim();
                      resolvedTitle = stripped || (video.channelName ? `${video.channelName} Videosu` : 'Instagram Videosu');
                    } else {
                      resolvedTitle = video.channelName ? `${video.channelName} Videosu` : 'Instagram Videosu';
                    }
                  }
                }
              }
            }
          } else {
            const primaryDir = candidateDirs[0] || targetBaseDir;
            actualPath = skipChannelFolder
              ? path.join(primaryDir, `${video.title} [${ytVideoId}].mp4`)
              : path.join(primaryDir, `${video.channelName} - ${video.title} [${ytVideoId}].mp4`);
          }
        } catch (e) {
          const fallbackBaseDir = video.isFakap
            ? ((settings.fakapPath || '').trim() || path.join(settings.downloadPath, 'Fakap'))
            : settings.downloadPath;
          actualPath = skipChannelFolder
            ? path.join(fallbackBaseDir, `${video.title} [${ytVideoId}].mp4`)
            : path.join(fallbackBaseDir, video.channelName, `${video.channelName} - ${video.title} [${ytVideoId}].mp4`);
        }

        let fileExists = false;
        try {
          fileExists = fs.existsSync(actualPath);
        } catch (e) {
          // Kasıtlı sessiz: Dosya varlığı sorgulanamadıysa yok varsayılır
        }

        if (!fileExists) {
          updateHistoryItem(video.id, {
            status: 'failed',
            progress: 0,
            speed: '',
            eta: '',
            error: settings.lang === 'en' ? 'Video file not found.' : 'Video dosyası bulunamadı.'
          });
          console.error(`İndirme Başarısız (Dosya bulunamadı): ${video.title}`);
          broadcast('status_log', { message: `İndirme başarısız (Dosya bulunamadı): ${video.title}`, type: 'error', thumbnail: `/api/video/${video.id}/thumbnail` });
          addTerminalLog(`[Kuyruk] İndirme FAILED: "${video.title}" - Hata: Video dosyası bulunamadı.`, 'error');
          playSystemSound('error');
          showWindowsNotification(
            settings.lang === 'en' ? 'Download Failed' : 'İndirme Başarısız',
            settings.lang === 'en' ? `"${video.title}" download failed (video file not found).` : `"${video.title}" videosunun indirilmesi başarısız oldu (video dosyası bulunamadı).`
          );
        } else {
          let calculatedSize = '';
          try {
            if (fs.existsSync(actualPath)) {
              const stats = fs.statSync(actualPath);
              const sizeInBytes = stats.size;
              if (sizeInBytes >= 1024 * 1024 * 1024) {
                calculatedSize = Math.round(sizeInBytes / (1024 * 1024 * 1024)) + ' GB';
              } else {
                calculatedSize = Math.round(sizeInBytes / (1024 * 1024)) + ' MB';
              }
            }
          } catch (err) {
            console.error(`Boyut okuma hatası: ${resolvedTitle}`, err.message);
          }

          const actualQuality = actualPath ? getVideoResolution(actualPath) : null;
          const actualDurationInfo = actualPath ? getVideoDurationFromFile(actualPath) : null;

          updateHistoryItem(video.id, {
            status: 'completed',
            progress: 100,
            filePath: actualPath,
            title: resolvedTitle,
            ...(video.channelName ? { channelName: video.channelName } : {}),
            ...(video.channelId ? { channelId: video.channelId } : {}),
            ...(video.platform ? { platform: video.platform } : {}),
            ...(video.webUrl ? { webUrl: video.webUrl } : {}),
            speed: '',
            eta: '',
            fileSize: calculatedSize,
            ...(actualQuality ? { actualQuality } : {}),
            ...(actualDurationInfo ? { duration: actualDurationInfo.duration, durationSeconds: actualDurationInfo.durationSeconds } : {})
          });
          console.log(`İndirme tamamlandı: ${resolvedTitle}`);
          broadcast('status_log', { message: `İndirme tamamlandı: ${resolvedTitle}`, type: 'success', thumbnail: `/api/video/${video.id}/thumbnail` });
          addTerminalLog(`[Kuyruk] İndirme SUCCESSFUL: "${resolvedTitle}" -> Dosya Yolu: ${actualPath}`, 'success');
          playSystemSound('success');
          showWindowsNotification(
            settings.lang === 'en' ? 'Download Completed' : 'İndirme Tamamlandı',
            settings.lang === 'en' ? `"${resolvedTitle}" downloaded successfully.` : `"${resolvedTitle}" videosu başarıyla indirildi.`,
            'download_complete'
          );
        }
      } else {
        // Gerçek hata satırları toplandıysa onları kullan; yoksa ham stderr'e düş (güvenli geri dönüş)
        let userFriendlyError = realErrorLines.length > 0 ? realErrorLines.join('\n') : errorOutput.trim();
        if (isTempExtractionError(userFriendlyError) || isTempExtractionError(errorOutput)) {
          const diskInfo = getTempSpaceInfo();
          userFriendlyError = buildDiskFullMessage(settings.lang, diskInfo);
          this.isPaused = true;
          broadcast('disk_warning', diskInfo);
        }
        if (userFriendlyError.includes('Could not copy Chrome cookie database') || userFriendlyError.includes('Could not copy Edge cookie database')) {
          userFriendlyError = `Tarayıcı çerez dosyası kilitli! Edge/Chrome tarayıcınız arka planda çalışmaya devam ediyor olabilir. Lütfen tarayıcınızı tamamen kapatıp tekrar deneyin veya Ayarlar sekmesinden çerez seçeneğini 'Çerez Kullanma (Sadece Açık Videolar)' olarak ayarlayın.`;
        } else if ((userFriendlyError.includes('Could not find browser') || userFriendlyError.includes('cookie')) && !/no longer valid|cookies? are? (no longer valid|expired)|WARNING:/i.test(userFriendlyError)) {
          userFriendlyError = `YouTube oturum çerezleri okunamadı. Lütfen Ayarlar sekmesinden "YouTube'da Oturum Aç" ile oturumunuzu yenileyip tekrar deneyin.`;
        } else if (/yeler|üyeler|members-only|katıl|katil|join this channel|ayrıcalık|ayrcal/i.test(userFriendlyError)) {
          userFriendlyError = settings.lang === 'en'
            ? `This video is Members-Only content. To download it, you must be a joined member of this channel and set 'Premium Browser Cookies' in Settings.`
            : `Bu video Katıl (Üyelere Özel) içeriğidir. İndirebilmek için kanala Katıl üyesi olmanız ve Ayarlar sekmesinden "Premium Çerez Tarayıcısı" seçeneğini aktif yapmanız gerekmektedir.`;
        }

        let isLiveProcessingError = /live stream (has ended|recording is still processing|is currently live)|this live event will begin|this video is a live stream|processing stream|The downloaded file is empty|Post-Live Manifestless mode|No such file or directory.*\.part-Frag|canl[ıi] etkinlik.*ba[şs]layacak|canl[ıi] yay[ıi]n.*(ba[şs]layacak|i[şs]leniyor|i[şs]len|devam ediyor|s[üu]r[üu]yor)|bu canl[ıi]|yay[ıi]n.*sonra ba[şs]layacak/i.test(userFriendlyError);
        let isTransientHttpError = /HTTP Error 403|HTTP Error 503|HTTP Error 429|Service Unavailable|Forbidden/i.test(userFriendlyError);
        let isGeoBlockedVideo = (/yasal|alan ad|country\'s domain|not available in your country|Geo-blocked|b[öo\uFFFD]lge|unavailable|kullan[ıi\uFFFD]lam/i.test(userFriendlyError) || /yasal|alan ad|country\'s domain|not available in your country|Geo-blocked|unavailable/i.test(errorOutput)) && !/Private video|Gizli video|This is a private video/i.test(userFriendlyError);
        let isNetworkDisconnected = isNetworkDisconnectError(userFriendlyError) || isNetworkDisconnectError(errorOutput);

        // Ağ kesintisi koruması:
        // Eğer hata ağ kesintisi/soket hatası ise VEYA kuyruk zaten internet bekliyor durumundaysa:
        // Video ASLA 'failed' statüsüne düşürülmez! Kuyruğa geri konur ve bağlantı beklenir.
        if (isNetworkDisconnected || this.isNetworkWaiting) {
          const isStillOnline = await checkInternetConnection();
          if (!isStillOnline || this.isNetworkWaiting) {
            console.warn(`[Kuyruk Ağ Koruma] "${video.title}" videosu indirilirken internet bağlantısı kesildi!`);
            this.handleNetworkDisconnection(video);
            return;
          } else {
            // İnternet şu an aktif görünüyor ancak indirme sırasında anlık kopma/dalgalanma yaşanmış:
            // 5 saniye sonra kuyruk başına tekrar eklenip denenir; ASLA 'failed' yapılmaz.
            video.networkRetryCount = (video.networkRetryCount || 0) + 1;
            console.warn(`[Kuyruk Ağ Dalgalanması] "${video.title}" için anlık bağlantı hatası algılandı. 5 saniye sonra yeniden denenecek (${video.networkRetryCount})...`);
            addTerminalLog(`[Ağ Koruması] "${video.title}" anlık ağ dalgalanması sonrası yeniden deneniyor (${video.networkRetryCount})...`, 'warning');
            setTimeout(() => {
              this.add(video);
              this.process();
            }, 5000);
            return;
          }
        }

        if (isLiveProcessingError) {
          updateHistoryItem(video.id, {
            status: 'waiting_live_processing',
            progress: 0,
            speed: '',
            eta: '',
            error: 'YouTube Canlı Yayın İşleniyor'
          });
          console.log(`[Downloader] Live stream is processing on YouTube. Deferred to waiting_live_processing: ${video.title}`);
          addTerminalLog(`[Kuyruk] Canlı yayın henüz işleniyor: "${video.title}" - YouTube VOD dönüştürmesi tamamlandığında otomatik indirilecek.`, 'info');
        } else if (isGeoBlockedVideo && (!video._geoRetryCount || video._geoRetryCount < 2)) {
          video._geoRetryCount = (video._geoRetryCount || 0) + 1;
          try {
            console.log(`[YASAKLI VİDEO] "${video.title}" için bölgesel/yasal kısıtlama tespit edildi. Proxy havuzundan tünel aranıyor...`);
            addTerminalLog(`[YASAKLI VİDEO] "${video.title}" bölgesel/yasal kısıtlamalı içerik algılandı. Çalışan Proxy tüneli aranıyor...`, 'warning');
            const workingProxy = await getWorkingProxy();
            if (workingProxy) {
              video._proxy = workingProxy;
              console.log(`[YASAKLI VİDEO] "${video.title}" Proxy tüneli (${workingProxy.replace('http://', '')}) üzerinden otomatik yeniden indiriliyor...`);
              addTerminalLog(`[YASAKLI VİDEO] "${video.title}" Proxy tüneli (${workingProxy.replace('http://', '')}) üzerinden otomatik indirme kuyruğuna alındı.`, 'info');
              updateHistoryItem(video.id, {
                status: 'waiting',
                progress: 0,
                speed: '',
                eta: '',
                error: 'Proxy Tüneli ile İndiriliyor'
              });
              broadcast('db_update', readDb());
              setTimeout(() => {
                this.add(video);
                this.process();
              }, 1000);
              return;
            }
          } catch (proxyErr) {
            console.error('[YASAKLI VİDEO] Proxy tünel hatası:', proxyErr.message);
          }
        } else if (isTransientHttpError && (!video.retryCount || video.retryCount < 3)) {
          video.retryCount = (video.retryCount || 0) + 1;
          delete video._fallbackClient;
          if (video._proxy) {
            const nextProxy = rotateProxy();
            if (nextProxy) {
              video._proxy = nextProxy;
              console.log(`[Proxy Havuzu] HTTP kısıtlaması sonrası yeni proxy ile deneniyor: ${nextProxy}`);
              addTerminalLog(`[Proxy Havuzu] Sıradaki Proxy tüneline (${nextProxy.replace('http://', '')}) geçiş yapılıyor...`, 'info');
            }
          }
          const waitSec = video.retryCount * 4;
          console.warn(`[Kuyruk Auto-Retry] "${video.title}" için geçici YouTube CDN kısıtlaması (403/503/429) algılandı. ${waitSec} saniye beklenip en yüksek kalitede otomatik yeniden denenecek (${video.retryCount}/3)...`);
          addTerminalLog(`[403 Koruması] "${video.title}" için geçici YouTube CDN kısıtlaması algılandı. ${waitSec} sn sonra en yüksek kalitede (1080p/4K) otomatik yeniden deneniyor (${video.retryCount}/3)...`, 'warning');
          setTimeout(() => {
            this.add(video);
            this.process();
          }, waitSec * 1000);
          return;
        } else {
          // --- Auto-Healing (2. Deneme / Son Şans Mimarisi) ---
          const isMergeOrCorruptError = /Invalid data found|Error opening input files|muxing failed|Conversion failed|moov atom not found|error reading header|Invalid argument|Corrupt/i.test(userFriendlyError) || /Invalid data found|Error opening input files|muxing failed|Conversion failed|moov atom not found|error reading header/i.test(errorOutput);
          const hasNotRetriedHealing = !video.retryAttempt || video.retryAttempt < 2;

          if (isMergeOrCorruptError && hasNotRetriedHealing) {
            video.retryAttempt = 2;
            video._singleFragmentMode = true;
            video._fallbackCodec = true;

            const healMsg = settings.lang === 'en'
              ? `[Auto-Healing] Initial download encountered corrupt fragments. Cleaned cache, retrying 2/2 in safe mode: "${video.title}"`
              : `[Kuyruk Auto-Healing] "${video.title}" için birleştirme/akış bozulması tespit edildi. Bozuk parçalar temizlendi, 2. deneme (Son Şans) güvenli modda başlatılıyor...`;

            console.warn(healMsg);
            addTerminalLog(healMsg, 'warning');
            broadcast('status_log', { message: healMsg, type: 'warning', thumbnail: `/api/video/${video.id}/thumbnail` });

            // Diskteki bozuk/yarım kalan parçaları anında temizle
            cleanupResidualFiles(video.id, video.channelName, settings.downloadPath, video.skipChannelFolder === true);

            updateHistoryItem(video.id, {
              status: 'waiting',
              retryAttempt: 2,
              progress: 0,
              speed: '',
              eta: '',
              error: settings.lang === 'en' ? 'Retrying (Safe Mode 2/2)...' : 'Yeniden Deneniyor (Güvenli Mod 2/2)...'
            });

            broadcast('db_update', readDb());

            // Kuyruğun en başına al ve 2 saniye sonra başlat
            setTimeout(() => {
              this.queue.unshift(video);
              this.process();
            }, 2000);
            return;
          }

          // 2. Denemede de başarısız olduysa veya kurtarılamaz hataysa: artık dosyaları temizle ve 'failed' yap
          cleanupResidualFiles(video.id, video.channelName, settings.downloadPath, video.skipChannelFolder === true);

          updateHistoryItem(video.id, {
            status: 'failed',
            progress: 0,
            speed: '',
            eta: '',
            failedAt: new Date().toISOString(),
            error: userFriendlyError || `Hata Kodu: ${code}`
          });
          console.error(`İndirme Başarısız: ${video.title} - Kod: ${code}`);
          broadcast('status_log', { message: `İndirme başarısız: ${video.title}`, type: 'error', thumbnail: `/api/video/${video.id}/thumbnail` });
          addTerminalLog(`[Kuyruk] İndirme FAILED: "${video.title}" - Hata: ${userFriendlyError || `Hata Kodu: ${code}`}`, 'error');
          playSystemSound('error');
          showWindowsNotification(
            settings.lang === 'en' ? 'Download Failed' : 'İndirme Başarısız',
            settings.lang === 'en' ? `"${video.title}" download failed.` : `"${video.title}" videosunun indirilmesi başarısız oldu.`
          );
        }

        // Başarısız veya Ertelenmiş İndirmelerde Disk Temizliği: Artık kalan tüm .part/.ytdl geçici dosyalarını sil
        try {
          const skipChannelFolder = video.skipChannelFolder === true;
          const targetDir = skipChannelFolder
            ? settings.downloadPath
            : path.join(settings.downloadPath, video.channelName);
          if (fs.existsSync(targetDir)) {
            const files = fs.readdirSync(targetDir);
            for (const file of files) {
              if (file.includes(`[${video.id}]`) && (file.endsWith('.part') || file.endsWith('.ytdl') || file.includes('.part-Frag'))) {
                try { fs.unlinkSync(path.join(targetDir, file)); } catch (e) {}
              }
            }
          }
        } catch (e) {}
      }

      broadcast('db_update', readDb());
      
      // RSS modülünü dinamik yükleyip eksik süreleri çözmeyi tetikle
      try {
        const { resolveMissingDurations } = await import('./rss.js');
        resolveMissingDurations();
      } catch (err) {
        console.error('RSS modülü dinamik yüklenemedi:', err);
      }

      this.process();
    });
  }
}

export const downloadQueue = new DownloadQueue();
try {
  const initDb = readDb();
  downloadQueue.isPaused = !!initDb.settings.isPaused;
} catch (e) {
  downloadQueue.isPaused = false;
}
