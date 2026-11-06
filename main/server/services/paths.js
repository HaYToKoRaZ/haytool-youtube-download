// Türkçe Açıklama: Proje genelinde kullanılan yt-dlp, FFmpeg ve ffprobe gibi harici araçların yollarını ve çalışabilirlik durumlarını yöneten modül.
import os from 'os';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { execSync, execFileSync, spawn, exec } from 'child_process';
import { dataRootDir } from '../config.js';
import { readDb } from '../database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..', '..');
const writableRootDir = process.env.APPIMAGE && process.platform === 'linux' ? dataRootDir : rootDir;

/**
 * Sistemdeki yt-dlp ikili dosyasının konumunu işletim sistemine göre belirler ve çalıştırma izni verir.
 * 
 * @returns {string} yt-dlp dosya yolu
 */
export function getYtdlpPath() {
  const isWin = os.platform() === 'win32';
  const filename = isWin ? 'yt-dlp.exe' : 'yt-dlp';
  const localPath = path.join(rootDir, 'yt-dlp', filename);

  if (process.env.APPIMAGE && process.platform === 'linux') {
    const writablePath = path.join(dataRootDir, 'bin', filename);
    if (!fs.existsSync(writablePath) && fs.existsSync(localPath)) {
      try {
        fs.mkdirSync(path.dirname(writablePath), { recursive: true });
        fs.copyFileSync(localPath, writablePath);
        fs.chmodSync(writablePath, 0o755);
      } catch (e) {
        console.warn('[AppImage] yt-dlp kullanıcı dizinine kopyalanamadı:', e.message);
      }
    }
    if (fs.existsSync(writablePath)) return writablePath;
  }
  
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
 * Sistemdeki belirtilen binary yürütülebilir dosyasının (ffmpeg, ffprobe vb.) konumunu belirler.
 * 
 * @param {string} binaryName Dosya adı ('ffmpeg' veya 'ffprobe')
 * @returns {string} İlgili binary dosya yolu
 */
export function getBinaryPath(binaryName) {
  const isWin = os.platform() === 'win32';
  const ext = isWin ? '.exe' : '';
  const writablePath = path.join(dataRootDir, 'ffmpeg', `${binaryName}${ext}`);
  if (process.env.APPIMAGE && process.platform === 'linux' && fs.existsSync(writablePath)) {
    try { fs.chmodSync(writablePath, 0o755); } catch (e) {}
    return writablePath;
  }
  const pathInSubfolder = path.join(rootDir, 'ffmpeg', `${binaryName}${ext}`);
  
  if (fs.existsSync(pathInSubfolder)) {
    if (!isWin) {
      try { fs.chmodSync(pathInSubfolder, '755'); } catch (e) {}
    }
    return pathInSubfolder;
  }
  
  const pathInRoot = path.join(rootDir, `${binaryName}${ext}`);
  if (fs.existsSync(pathInRoot)) {
    if (!isWin) {
      try { fs.chmodSync(pathInRoot, '755'); } catch (e) {}
    }
    return pathInRoot;
  }
  
  if (!isWin) {
    try {
      const systemBin = execSync(`which ${binaryName} 2>/dev/null`, { encoding: 'utf-8' }).trim();
      if (systemBin) return systemBin;
    } catch (e) {}
  }
  
  return pathInSubfolder;
}

/**
 * Sistemdeki FFmpeg yürütülebilir dosyasının konumunu işletim sistemine göre belirler.
 * 
 * @returns {string} FFmpeg dosya yolu
 */
export function getFfmpegPath() {
  return getBinaryPath('ffmpeg');
}

/**
 * Sistemdeki ffprobe yürütülebilir dosyasının konumunu işletim sistemine göre belirler.
 * 
 * @returns {string} ffprobe dosya yolu
 */
export function getFfprobePath() {
  return getBinaryPath('ffprobe');
}

/**
 * Belirtilen video dosyasının gerçek çözünürlüğünü ffprobe ile analiz eder ve standart kalite etiketi döndürür.
 * 
 * @param {string} filePath - Video dosyasının tam yolu
 * @returns {string|null} Kalite etiketi (ör: '1080p', '4K', '720p', '480p', '360p') veya null
 */
export function getVideoResolution(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return null;

  // Ses dosyalarında (MP3 vb.) gömülü albüm kapağının video çözünürlüğü (720p vb.) olarak algılanmasını önle
  const fileExt = path.extname(filePath).toLowerCase();
  const audioExtensions = ['.mp3', '.m4a', '.aac', '.opus', '.wav', '.flac', '.ogg'];
  if (audioExtensions.includes(fileExt)) {
    return 'MP3';
  }

  try {
    let height = 0;
    let bitRate = 0;

    const ffprobe = getFfprobePath();
    if (fs.existsSync(ffprobe)) {
      try {
        const out = execFileSync(ffprobe, [
          '-v', 'error',
          '-select_streams', 'v:0',
          '-show_entries', 'stream=height,bit_rate:format=bit_rate',
          '-of', 'json',
          filePath
        ], { encoding: 'utf-8', timeout: 5000 }).trim();

        const data = JSON.parse(out);
        const stream = (data.streams && data.streams[0]) ? data.streams[0] : null;
        height = stream && stream.height ? parseInt(stream.height, 10) : 0;
        if (stream && stream.bit_rate) bitRate = parseInt(stream.bit_rate, 10);
        if ((!bitRate || isNaN(bitRate)) && data.format && data.format.bit_rate) {
          bitRate = parseInt(data.format.bit_rate, 10);
        }
      } catch (errProbe) {}
    }

    // FFprobe yoksa veya okuyamadıysa doğrudan FFmpeg ile çözümle (-1 EXE bağımlılığı)
    if (!height || isNaN(height)) {
      const ffmpeg = getFfmpegPath();
      if (fs.existsSync(ffmpeg)) {
        try {
          let out = '';
          try {
            execFileSync(ffmpeg, ['-i', filePath], { encoding: 'utf-8', timeout: 5000, stdio: ['pipe', 'pipe', 'pipe'] });
          } catch (eFfmpeg) {
            out = (eFfmpeg.stderr || '') + (eFfmpeg.stdout || '');
          }

          const resMatch = out.match(/Stream #\d+:\d+.*Video:.*,\s*(\d{3,5})x(\d{3,5})/i);
          if (resMatch) {
            height = parseInt(resMatch[2], 10);
          }

          const bitrateMatch = out.match(/bitrate:\s*(\d+)\s*kb\/s/i);
          if (bitrateMatch) {
            bitRate = parseInt(bitrateMatch[1], 10) * 1000;
          }
        } catch (eFfmpegErr) {}
      }
    }

    if (isNaN(height) || height <= 0) return null;

    if (height >= 4320) return '8K';
    if (height >= 2160) return '4K';
    if (height >= 1440) return '2K';
    if (height >= 1080) {
      if (bitRate > 6200000) {
        return '1080pPre';
      }
      return '1080p';
    }
    if (height >= 720) return '720p';
    if (height >= 480) return '480p';
    if (height >= 360) return '360p';
    if (height >= 240) return '240p';
    return '144p';
  } catch (err) {
    return null;
  }
}

/**
 * Belirtilen medya dosyasının (video veya ses) süresini FFmpeg ile analiz eder.
 * 
 * @param {string} filePath - Medya dosyasının tam yolu
 * @returns {{ duration: string, durationSeconds: number } | null} Formatlanmış süre ve saniye bilgisi veya null
 */
export function getVideoDurationFromFile(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return null;
  const ffmpeg = getFfmpegPath();
  if (!fs.existsSync(ffmpeg)) return null;

  try {
    let out = '';
    try {
      execFileSync(ffmpeg, ['-i', filePath], { encoding: 'utf-8', timeout: 5000, stdio: ['pipe', 'pipe', 'pipe'] });
    } catch (eFfmpeg) {
      out = (eFfmpeg.stderr || '') + (eFfmpeg.stdout || '');
    }

    const match = out.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/i);
    if (match) {
      const hrs = parseInt(match[1], 10);
      const mins = parseInt(match[2], 10);
      const secs = Math.round(parseFloat(match[3]));
      const totalSecs = hrs * 3600 + mins * 60 + secs;
      const formatted = hrs > 0
        ? `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
        : `${mins}:${secs.toString().padStart(2, '0')}`;
      return { duration: formatted, durationSeconds: totalSecs };
    }
  } catch (err) {}
  return null;
}

/**
 * Sayısal veya ham süre dizesini standart 'MM:SS' veya 'H:MM:SS' biçimine dönüştürür.
 * 
 * @param {string|number} raw - Sayısal saniye veya süre dizesi (örn: '57', '1:23')
 * @returns {string} Formatlanmış süre
 */
export function formatDurationStr(raw) {
  if (!raw || raw === 'NA' || raw === 'null' || raw === '-') return '';
  const str = String(raw).trim();
  if (str.includes(':')) return str;
  const totalSecs = parseInt(str, 10);
  if (isNaN(totalSecs) || totalSecs <= 0) return '';
  const hrs = Math.floor(totalSecs / 3600);
  const mins = Math.floor((totalSecs % 3600) / 60);
  const secs = totalSecs % 60;
  return hrs > 0 
    ? `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
    : `${mins}:${secs.toString().padStart(2, '0')}`;
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

export let hwaccelStatusCache = null;

/**
 * Sistemdeki GPU ve FFmpeg donanım hızlandırma yeteneklerini tespit eder.
 * NVIDIA NVENC, Intel QSV ve AMD AMF desteğini test eder ve önbelleğe alır.
 * 
 * @param {boolean} forceRecheck Önbelleği atlayıp yeniden test etmeye zorlar
 * @returns {{ nvenc: boolean, qsv: boolean, amf: boolean, recommended: string, gpuName: string }}
 */
export function detectHwaccel(forceRecheck = false) {
  if (!forceRecheck && hwaccelStatusCache !== null) {
    return hwaccelStatusCache;
  }

  const result = {
    nvenc: false,
    qsv: false,
    amf: false,
    recommended: 'cpu',
    gpuName: ''
  };

  const ffmpegPath = getFfmpegPath();
  if (!fs.existsSync(ffmpegPath) || !testFfmpegSync()) {
    hwaccelStatusCache = result;
    return result;
  }

  // Windows'ta GPU adını tespit et
  if (os.platform() === 'win32') {
    try {
      const gpuOut = execSync('powershell -NoProfile -Command "Get-CimInstance Win32_VideoController | Select-Object -ExpandProperty Name"', {
        encoding: 'utf-8',
        timeout: 3000,
        stdio: ['ignore', 'pipe', 'ignore']
      });
      if (gpuOut) result.gpuName = gpuOut.trim();
    } catch (e) {
      // GPU adı sorgulanamazsa devam et
    }
  }

  // FFmpeg ile 256x256 lavfi testi yaparak gerçek donanım/sürücü kodlayıcısını doğrula
  const testEncoder = (encoderName) => {
    try {
      execFileSync(ffmpegPath, [
        '-hide_banner',
        '-loglevel', 'error',
        '-f', 'lavfi',
        '-i', 'color=c=black:s=256x256:d=0.04',
        '-c:v', encoderName,
        '-f', 'null',
        '-'
      ], { timeout: 3000, stdio: 'ignore' });
      return true;
    } catch (err) {
      return false;
    }
  };

  result.nvenc = testEncoder('h264_nvenc');
  result.qsv = !result.nvenc && testEncoder('h264_qsv');
  result.amf = !result.nvenc && !result.qsv && testEncoder('h264_amf');

  if (result.nvenc) {
    result.recommended = 'nvenc';
  } else if (result.qsv) {
    result.recommended = 'qsv';
  } else if (result.amf) {
    result.recommended = 'amf';
  } else {
    result.recommended = 'cpu';
  }

  hwaccelStatusCache = result;
  return result;
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
      tempDir = path.join(writableRootDir, 'Temp');
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

export function getStagingTempDir() {
  let stagingDir;
  try {
    const db = readDb();
    if (db.settings && db.settings.tempDirType === 'local') {
      stagingDir = path.join(writableRootDir, 'Temp', 'HaYTooL-Convert');
    } else {
      stagingDir = path.join(os.tmpdir(), 'HaYTooL-YT-Downloader-Convert');
    }
  } catch (e) {
    stagingDir = path.join(os.tmpdir(), 'HaYTooL-YT-Downloader-Convert');
  }

  if (!fs.existsSync(stagingDir)) {
    try {
      fs.mkdirSync(stagingDir, { recursive: true });
    } catch (e) {
      console.error('[Staging Temp] Convert/Staging klasörü oluşturulamadı:', e.message);
    }
  }
  return stagingDir;
}

/**
 * TTS seslendirme önbelleği için Temp altındaki dizin yolunu döner.
 * Eski 'cache/tts' dizini varsa dosyaları buraya taşır ve eskiyi temizler.
 * @returns {string} Temp/tts dizin yolu
 */
export function getTtsCacheDir() {
  const ttsDir = path.join(getLocalTempDir(), 'tts');
  if (!fs.existsSync(ttsDir)) {
    try {
      fs.mkdirSync(ttsDir, { recursive: true });
    } catch (_) {}
  }

  try {
    const legacyCacheDir = path.join(writableRootDir, 'cache', 'tts');
    if (fs.existsSync(legacyCacheDir)) {
      const files = fs.readdirSync(legacyCacheDir);
      for (const file of files) {
        const src = path.join(legacyCacheDir, file);
        const dest = path.join(ttsDir, file);
        if (!fs.existsSync(dest)) {
          fs.copyFileSync(src, dest);
        }
        try { fs.unlinkSync(src); } catch (_) {}
      }
      try { fs.rmdirSync(legacyCacheDir); } catch (_) {}
      const parentCache = path.join(writableRootDir, 'cache');
      try { fs.rmdirSync(parentCache); } catch (_) {}
    }
  } catch (_) {}

  return ttsDir;
}

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Uygulama kök 'bin' klasörü (motorlar: llama, piper, ahenk...). CWD = kurulum dizini (main/).
 * @returns {string} Mutlak bin yolu
 */
export function getAppBinDir() {
  return path.join(process.cwd(), 'bin');
}

/**
 * Eski sürümlerde motorlar iç içe 'main/main/bin/<engine>' altına indiriliyordu.
 * Bu fonksiyon eski konumu yeni 'bin/<engine>' konumuna tek seferde taşır (birleştirmez, taşır).
 * @param {string} engineName - Motor klasör adı (llama, piper...)
 * @param {string} markerFile - Taşımanın doğrulanması için aranan dosya (ör. llama-cli.exe)
 * @returns {string} Motorun güncel mutlak yolu
 */
export function migrateLegacyEngineDir(engineName, markerFile) {
  const targetDir = path.join(getAppBinDir(), engineName);
  const legacyDir = path.join(process.cwd(), 'main', 'bin', engineName);

  try {
    const legacyReady = fs.existsSync(path.join(legacyDir, markerFile));
    if (!legacyReady) return targetDir;

    // Hedefte eski/kısmi kopya varsa temizle, sonra taşı (kopyala+yeniden adlandır başarısız olursa)
    if (fs.existsSync(targetDir)) {
      fs.rmSync(targetDir, { recursive: true, force: true });
    }
    fs.mkdirSync(path.dirname(targetDir), { recursive: true });
    try {
      fs.renameSync(legacyDir, targetDir);
    } catch (_) {
      fs.cpSync(legacyDir, targetDir, { recursive: true, force: true });
      fs.rmSync(legacyDir, { recursive: true, force: true });
    }
    // Boşalan eski iç içe klasörleri temizle (main/main/bin, main/main)
    for (const dir of [path.dirname(legacyDir), path.dirname(path.dirname(legacyDir))]) {
      try {
        if (fs.existsSync(dir) && fs.readdirSync(dir).length === 0) fs.rmdirSync(dir);
      } catch (_) {}
    }
    console.log(`[Migration] ${engineName} motoru "${legacyDir}" -> "${targetDir}" taşındı.`);
  } catch (e) {
    console.warn(`[Migration] ${engineName} taşınamadı:`, e.message);
  }
  return targetDir;
}

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
    const sysTemp = os.tmpdir();
    try {
      const sysFiles = await fs.promises.readdir(sysTemp);
      for (const f of sysFiles) {
        if (f.startsWith('_MEI')) {
          try {
            await fs.promises.rm(path.join(sysTemp, f), { recursive: true, force: true });
            cleanedCount++;
          } catch (_) {}
        }
      }
    } catch (_) {}
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
  const sysTempDir = os.tmpdir();
  const checkDirs = Array.from(new Set([tempDir, sysTempDir]));
  
  try {
    for (const dir of checkDirs) {
      const dirExists = await fs.promises.access(dir).then(() => true).catch(() => false);
      if (!dirExists) continue;
      const files = await fs.promises.readdir(dir);
      for (const pid of Array.from(pendingMeiPids)) {
        const prefix = '_MEI' + pid;
        const targets = files.filter(f => f.startsWith(prefix));
        for (const target of targets) {
          const targetPath = path.join(dir, target);
          try {
            await fs.promises.rm(targetPath, { recursive: true, force: true });
            await sleep(300);
          } catch (err) {}
        }
      }
    }
    for (const pid of Array.from(pendingMeiPids)) {
      const prefix = '_MEI' + pid;
      let stillExists = false;
      for (const dir of checkDirs) {
        try {
          const files = await fs.promises.readdir(dir);
          if (files.some(f => f.startsWith(prefix))) {
            stillExists = true;
            break;
          }
        } catch (_) {}
      }
      if (!stillExists) {
        pendingMeiPids.delete(pid);
      }
    }
  } catch (err) {
    // Kasıtlı sessiz
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
  // Otomatik temp yönlendirmesi: _MEI ve part dosyalarını kullanıcının seçtiği klasöre zorlar
  const activeTemp = getLocalTempDir();
  const existingEnv = options.env || process.env;
  options = { ...options, env: { ...existingEnv, TEMP: activeTemp, TMP: activeTemp, TMPDIR: activeTemp } };
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
  const activeTemp = getLocalTempDir();
  const existingEnv = options.env || process.env;
  options = { ...options, env: { ...existingEnv, TEMP: activeTemp, TMP: activeTemp, TMPDIR: activeTemp } };
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

