// Türkçe Açıklama: Sistem Temp sürücüsünün boş alanını denetler ve yt-dlp (PyInstaller) açılış hatalarını tanır.
// yt-dlp.exe her çalışışında dosyalarını Temp'e açar; sürücü dolarsa "Failed to extract" hatası verip hiç başlamaz.
import fs from 'fs';
import os from 'os';
import path from 'path';
import { readDb } from '../database.js';

export const DEFAULT_MIN_TEMP_FREE_MB = 500;
export const DISK_FULL_ERROR_CODE = 'DISK_FULL_TEMP';

const EXTRACTION_ERROR_REGEX = /Failed to extract|decompression resulted in return code|\[PYI-\d+:ERROR\]/i;

/**
 * Ayarlardaki minimum Temp boş alan eşiğini (MB) döner; geçersizse varsayılanı kullanır.
 * @returns {number}
 */
export function getMinTempFreeMB() {
  try {
    const value = parseInt(readDb()?.settings?.minTempFreeMB, 10);
    if (Number.isFinite(value) && value >= 50 && value <= 20000) return value;
  } catch (e) {
    // Kasıtlı sessiz: Varsayılan eşiğe düş
  }
  return DEFAULT_MIN_TEMP_FREE_MB;
}

/**
 * yt-dlp çıktısının Temp'e açılamama (disk dolu) hatası içerip içermediğini söyler.
 * @param {string} text
 * @returns {boolean}
 */
export function isTempExtractionError(text) {
  return EXTRACTION_ERROR_REGEX.test(String(text || ''));
}

/**
 * Temp sürücüsünün boş alan bilgisini döner.
 * @returns {{ok: boolean, freeMB: number, totalMB: number, minMB: number, low: boolean, drive: string, tempDir: string}}
 */
export function getTempSpaceInfo() {
  const tempDir = os.tmpdir();
  const minMB = getMinTempFreeMB();
  const drive = (path.resolve(tempDir).match(/^([a-zA-Z]):/) || [])[1]?.toUpperCase() || '';
  try {
    const stats = fs.statfsSync(tempDir);
    const freeMB = Math.floor((stats.bavail * stats.bsize) / (1024 * 1024));
    const totalMB = Math.floor((stats.blocks * stats.bsize) / (1024 * 1024));
    return { ok: true, freeMB, totalMB, minMB, low: freeMB < minMB, drive, tempDir };
  } catch (e) {
    return { ok: false, freeMB: 0, totalMB: 0, minMB, low: false, drive, tempDir };
  }
}

/**
 * Kullanıcıya gösterilecek anlaşılır "Temp sürücüsü dolu" mesajını üretir (tr/en).
 * @param {string} lang
 * @param {{freeMB: number, minMB: number, drive: string}} info
 * @returns {string}
 */
export function buildDiskFullMessage(lang, info) {
  const drive = info?.drive ? `${info.drive}:` : 'C:';
  const free = info?.freeMB ?? 0;
  const min = info?.minMB ?? DEFAULT_MIN_TEMP_FREE_MB;
  return lang === 'en'
    ? `Disk full: Temp drive (${drive}) has only ${free} MB free (min ${min} MB), so yt-dlp cannot start. Free up space or clean the Temp folder, then resume the queue.`
    : `Disk dolu: Temp sürücüsünde (${drive}) yalnızca ${free} MB boş alan var (en az ${min} MB gerekli), yt-dlp başlatılamadı. Temp klasörünü temizleyip kuyruğu yeniden başlatın.`;
}
