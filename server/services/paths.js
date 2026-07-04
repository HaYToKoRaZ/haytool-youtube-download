// Türkçe Açıklama: Proje genelinde kullanılan yt-dlp, FFmpeg ve ffprobe gibi harici araçların yollarını ve çalışabilirlik durumlarını yöneten modül.
import os from 'os';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { execSync, execFileSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..', '..');

export const ytdlpPath = path.join(rootDir, 'yt-dlp', os.platform() === 'win32' ? 'yt-dlp.exe' : 'yt-dlp');

/**
 * Sistemdeki FFmpeg yürütülebilir dosyasının konumunu işletim sistemine göre belirler.
 * 
 * @returns {string} FFmpeg dosya yolu
 */
export function getFfmpegPath() {
  const ext = os.platform() === 'win32' ? '.exe' : '';
  const pathInSubfolder = path.join(rootDir, 'ffmpeg', `ffmpeg${ext}`);
  if (fs.existsSync(pathInSubfolder)) return pathInSubfolder;
  return path.join(rootDir, `ffmpeg${ext}`);
}

export let isFfmpegWorkingCached = null;

export function testFfmpegSync() {
  if (isFfmpegWorkingCached !== null) return isFfmpegWorkingCached;
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
