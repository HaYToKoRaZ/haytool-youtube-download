// Türkçe Açıklama: Proje genelinde kullanılan yt-dlp, FFmpeg ve ffprobe gibi harici araçların yollarını ve çalışabilirlik durumlarını yöneten modül.
import os from 'os';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { execSync, execFileSync, spawn, exec } from 'child_process';
import { readDb } from '../database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..', '..');

/**
 * Sistemdeki yt-dlp ikili dosyasının konumunu işletim sistemine göre belirler ve çalıştırma izni verir.
 * 
 * @returns {string} yt-dlp dosya yolu
 */
export function getYtdlpPath() {
  const isWin = os.platform() === 'win32';
  const filename = isWin ? 'yt-dlp.exe' : 'yt-dlp';
  const localPath = path.join(rootDir, 'yt-dlp', filename);
  
  if (fs.existsSync(localPath)) {
    if (!isWin) {
      try { fs.chmodSync(localPath, '755'); } catch (e) {}
    }
    return localPath;
  }
  
  // Yerel ikili yoksa Linux/Unix üzerinde sistem PATH'indeki yt-dlp'yi kullan
  if (!isWin) {
    try {
      const systemYtdlp = execSync('which yt-dlp 2>/dev/null', { encoding: 'utf-8' }).trim();
      if (systemYtdlp) return systemYtdlp;
    } catch (e) {}
  }
  return localPath;
}

export const ytdlpPath = getYtdlpPath();

/**
 * Sistemdeki FFmpeg yürütülebilir dosyasının konumunu işletim sistemine göre belirler.
 * 
 * @returns {string} FFmpeg dosya yolu
 */
export function getFfmpegPath() {
  const isWin = os.platform() === 'win32';
  const ext = isWin ? '.exe' : '';
  const pathInSubfolder = path.join(rootDir, 'ffmpeg', `ffmpeg${ext}`);
  
  if (fs.existsSync(pathInSubfolder)) {
    if (!isWin) {
      try { fs.chmodSync(pathInSubfolder, '755'); } catch (e) {}
    }
    return pathInSubfolder;
  }
  
  const pathInRoot = path.join(rootDir, `ffmpeg${ext}`);
  if (fs.existsSync(pathInRoot)) {
    if (!isWin) {
      try { fs.chmodSync(pathInRoot, '755'); } catch (e) {}
    }
    return pathInRoot;
  }
  
  if (!isWin) {
    try {
      const systemFfmpeg = execSync('which ffmpeg 2>/dev/null', { encoding: 'utf-8' }).trim();
      if (systemFfmpeg) return systemFfmpeg;
    } catch (e) {}
  }
  
  return pathInSubfolder;
}

/**
 * Sistemdeki ffprobe yürütülebilir dosyasının konumunu işletim sistemine göre belirler.
 * 
 * @returns {string} ffprobe dosya yolu
 */
export function getFfprobePath() {
  const isWin = os.platform() === 'win32';
  const ext = isWin ? '.exe' : '';
  const pathInSubfolder = path.join(rootDir, 'ffmpeg', `ffprobe${ext}`);
  
  if (fs.existsSync(pathInSubfolder)) {
    if (!isWin) {
      try { fs.chmodSync(pathInSubfolder, '755'); } catch (e) {}
    }
    return pathInSubfolder;
  }
  
  const pathInRoot = path.join(rootDir, `ffprobe${ext}`);
  if (fs.existsSync(pathInRoot)) {
    if (!isWin) {
      try { fs.chmodSync(pathInRoot, '755'); } catch (e) {}
    }
    return pathInRoot;
  }
  
  if (!isWin) {
    try {
      const systemFfprobe = execSync('which ffprobe 2>/dev/null', { encoding: 'utf-8' }).trim();
      if (systemFfprobe) return systemFfprobe;
    } catch (e) {}
  }
  
  return pathInSubfolder;
}

/**
 * Belirtilen video dosyasının gerçek çözünürlüğünü ffprobe ile analiz eder ve standart kalite etiketi döndürür.
 * 
 * @param {string} filePath - Video dosyasının tam yolu
 * @returns {string|null} Kalite etiketi (ör: '1080p', '4K', '720p', '480p', '360p') veya null
 */
export function getVideoResolution(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return null;
  try {
    const ffprobe = getFfprobePath();
    if (!fs.existsSync(ffprobe)) return null;

    const out = execFileSync(ffprobe, [
      '-v', 'error',
      '-select_streams', 'v:0',
      '-show_entries', 'stream=height',
      '-of', 'csv=p=0',
      filePath
    ], { encoding: 'utf-8', timeout: 5000 }).trim();

    const height = parseInt(out, 10);
    if (isNaN(height) || height <= 0) return null;

    if (height >= 4320) return '8K';
    if (height >= 2160) return '4K';
    if (height >= 1440) return '2K';
    if (height >= 1080) return '1080p';
    if (height >= 720) return '720p';
    if (height >= 480) return '480p';
    if (height >= 360) return '360p';
    if (height >= 240) return '240p';
    return '144p';
  } catch (err) {
    return null;
  }
}

export let isFfmpegWorkingCached = null;

export function testFfmpegSync(forceRecheck = false) {
  if (!forceRecheck && isFfmpegWorkingCached !== null) return isFfmpegWorkingCached;
  const ffmpegPath = getFfmpegPath();
  if (!fs.existsSync(ffmpegPath)) {
    isFfmpegWorkingCached = false;
    return false;
  }
  
  // Antivirüs / Defender taraması için ilk denemeyi 10 saniye zaman aşımıyla yapıyoruz
  try {
    execFileSync(ffmpegPath, ['-version'], { stdio: 'ignore', timeout: 10000 });
    isFfmpegWorkingCached = true;
    return true;
  } catch (err) {
    console.error("[FFmpeg] Ilk doğrulama testi basarisiz oldu veya zaman aşımına ugradi. Ayrintilar:", err.message || err);
    
    const isTimeout = err.code === 'ETIMEDOUT' || (err.message && err.message.includes('ETIMEDOUT'));
    if (isTimeout) {
      console.log("[FFmpeg] Zaman aşımı (ETIMEDOUT) algilandi. Windows Defender taraması suruyor olabilir. 5 saniye bekleniyor ve yeniden denenecek...");
      
      // 5 saniye senkron bekleme
      try {
        if (os.platform() === 'win32') {
          execSync('powershell -Command "Start-Sleep -Seconds 5"', { stdio: 'ignore' });
        } else {
          execSync('sleep 5', { stdio: 'ignore' });
        }
      } catch (sleepErr) {
        console.warn("[FFmpeg] Bekleme sırasında hata:", sleepErr.message);
      }

      // 5 saniye zaman aşımı ile yeniden deneme
      try {
        console.log("[FFmpeg] Yeniden deneme testi baslatiliyor...");
        execFileSync(ffmpegPath, ['-version'], { stdio: 'ignore', timeout: 5000 });
        console.log("[FFmpeg] Yeniden deneme testi basarili oldu.");
        isFfmpegWorkingCached = true;
        return true;
      } catch (retryErr) {
        console.error("[FFmpeg] Yeniden deneme testi de basarisiz oldu. Ayrintilar:", retryErr.message || retryErr);
      }
    }
    isFfmpegWorkingCached = false;
    return false;
  }
}

export function setFfmpegWorkingCached(val) {
  isFfmpegWorkingCached = val;
}

/**
 * Uygulamanın ana dizinindeki 'Temp' klasörünün dinamik yolunu döner.
 * Klasör yoksa otomatik oluşturur.
 * 
 * @returns {string} Ana dizindeki Temp klasörünün mutlak yolu
 */
export function getLocalTempDir() {
  let tempDir;
  try {
    const db = readDb();
    if (db.settings && db.settings.tempDirType === 'local') {
      tempDir = path.join(rootDir, 'Temp');
    } else {
      tempDir = path.join(os.tmpdir(), 'HaYTooL-YT-Downloader');
    }
  } catch (e) {
    tempDir = path.join(os.tmpdir(), 'HaYTooL-YT-Downloader');
  }

  if (!fs.existsSync(tempDir)) {
    try {
      fs.mkdirSync(tempDir, { recursive: true });
    } catch (e) {
      console.error('[Temp] Temp klasörü oluşturulamadı:', e.message);
    }
  }
  return tempDir;
}

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Sunucu başlatıldığında ana dizindeki 'Temp' klasöründeki eski geçici dosyaları temizler.
 */
export async function cleanLocalTempDir() {
  const tempDir = getLocalTempDir();
  try {
    const files = await fs.promises.readdir(tempDir);
    let cleanedCount = 0;
    for (const file of files) {
      const filePath = path.join(tempDir, file);
      try {
        await fs.promises.rm(filePath, { recursive: true, force: true });
        cleanedCount++;
        // Disk I/O darboğazını önlemek için her silme işleminden sonra 300ms bekle
        await sleep(300);
      } catch (err) {
        // Aktif işlem tarafından kilitli tutulan geçici dosyalar varsa yoksay
      }
    }
    if (cleanedCount > 0) {
      console.log(`[Temp] Ana dizindeki Temp klasörü temizlendi (${cleanedCount} öge silindi).`);
    }
  } catch (err) {
    console.error('[Temp] Temizlik sırasında hata oluştu:', err.message);
  }
}

// Temizlenmeyi bekleyen _MEI klasörlerine ait PID listesi
const pendingMeiPids = new Set();
let isCleanupWorkerRunning = false;

/**
 * Bekleyen PID'lere ait yetim _MEI klasörlerini sırayla temizleyen merkezi işçi.
 * Eş zamanlı yüzlerce dosya sistemi (readdir/rm) çağrısı yapıp 
 * libuv thread pool'unu tıkamamak için temizlik tek bir kuyruktan yürütülür.
 */
async function runCentralizedCleanup() {
  if (isCleanupWorkerRunning || pendingMeiPids.size === 0) return;
  isCleanupWorkerRunning = true;
  
  const tempDir = getLocalTempDir();
  
  try {
    const dirExists = await fs.promises.access(tempDir).then(() => true).catch(() => false);
    if (dirExists) {
      const files = await fs.promises.readdir(tempDir);
      
      for (const pid of Array.from(pendingMeiPids)) {
        const prefix = `_MEI${pid}`;
        const targets = files.filter(f => f.startsWith(prefix));
        
        if (targets.length === 0) {
          // Klasör zaten silinmiş veya hiç oluşmamışsa listeden çıkar
          pendingMeiPids.delete(pid);
          continue;
        }
        
        let allDeleted = true;
        for (const target of targets) {
          const targetPath = path.join(tempDir, target);
          try {
            await fs.promises.rm(targetPath, { recursive: true, force: true });
            // Disk I/O yükünü hafifletmek için 5 saniye (5000ms) bekle
            await sleep(5000);
          } catch (err) {
            allDeleted = false;
          }
        }
        
        if (allDeleted) {
          pendingMeiPids.delete(pid);
        }
      }
    }
  } catch (err) {
    // Kasıtlı sessiz: Hataları yoksay
  }
  
  isCleanupWorkerRunning = false;
  
  // Hala temizlenemeyen (kilitli) klasörler varsa diski yormamak için 10 saniye sonra tekrar dene
  if (pendingMeiPids.size > 0) {
    setTimeout(runCentralizedCleanup, 10000);
  }
}

/**
 * Belirtilen PID'ye ait yetim _MEI klasörünü temizlik kuyruğuna ekler.
 * PyInstaller (yt-dlp.exe) her çalıştığında TEMP'e _MEI{PID} klasörü açar.
 * 
 * @param {number} pid - Temizlenecek yt-dlp işleminin PID numarası
 */
export function cleanMeiForPid(pid) {
  if (!pid) return;
  pendingMeiPids.add(pid);
  
  // Windows'un dosya kilitlerini bırakması için ilk denemeyi 500ms sonra tetikle
  setTimeout(runCentralizedCleanup, 500);
}

/**
 * Veritabanı ayarlarındaki ytdlpRunMode seçeneğine göre yt-dlp sürecini başlatır.
 * 'python' ise: python -m yt_dlp <args> şeklinde çalıştırır.
 * 'exe' ise: Paketlenen yt-dlp.exe dosyasını doğrudan çalıştırır.
 * 
 * @param {Array<string>} args - yt-dlp argümanları
 * @param {object} options - spawn seçenekleri
 * @returns {ChildProcess} Başlatılan süreç
 */
export function spawnYtdlp(args, options = {}) {
  let db;
  try {
    db = readDb();
  } catch (e) {
    db = {};
  }
  const settings = db.settings || {};
  const runMode = settings.ytdlpRunMode || 'exe';

  if (runMode === 'python') {
    const pythonCmd = settings.pythonCmd || (os.platform() === 'win32' ? 'python' : 'python3');
    const finalArgs = ['-m', 'yt_dlp', ...args];
    return spawn(pythonCmd, finalArgs, options);
  } else {
    return spawn(ytdlpPath, args, options);
  }
}

/**
 * Veritabanı ayarlarındaki ytdlpRunMode seçeneğine göre yt-dlp komutunu exec ile çalıştırır.
 * 
 * @param {string} cmdString - Çalıştırılacak yt-dlp komutu
 * @param {object} options - exec seçenekleri
 * @param {function} callback - Geri çağırma fonksiyonu
 * @returns {ChildProcess} Başlatılan süreç
 */
export function execYtdlp(cmdString, options = {}, callback = null) {
  let db;
  try {
    db = readDb();
  } catch (e) {
    db = {};
  }
  const settings = db.settings || {};
  const runMode = settings.ytdlpRunMode || 'exe';

  let finalCmd = cmdString;
  if (runMode === 'python') {
    const pythonCmd = settings.pythonCmd || (os.platform() === 'win32' ? 'python' : 'python3');
    const replacement = `"${pythonCmd}" -m yt_dlp`;
    
    const escapedPath = ytdlpPath.replace(/\\/g, '\\\\');
    const regexQuote = new RegExp(`"${escapedPath}"`, 'g');
    const regexNoQuote = new RegExp(escapedPath, 'g');
    
    if (finalCmd.includes(`"${ytdlpPath}"`)) {
      finalCmd = finalCmd.replace(regexQuote, replacement);
    } else {
      finalCmd = finalCmd.replace(regexNoQuote, replacement);
    }
  }

  if (typeof options === 'function') {
    return exec(finalCmd, {}, options);
  }
  return exec(finalCmd, options, callback);
}

