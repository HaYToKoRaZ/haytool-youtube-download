// Türkçe Açıklama: Fakap (otomatik yedek) klasörünün diğer disk tarama modüllerinden (karşılaştırma, senkronizasyon, silme)
// dışlanması için bağımsız yardımcı modül. Hiçbir bağımlılığı yoktur (döngüsel import oluşmaması için).
import path from 'path';

let fakapDirGetter = null;

/**
 * Güncel Fakap klasörünü döndüren fonksiyonu kaydeder (fakapService tarafından çağrılır).
 * @param {function(): string} getter
 */
export function registerFakapDirGetter(getter) {
  fakapDirGetter = typeof getter === 'function' ? getter : null;
}

/**
 * Verilen yolun Fakap klasörünün içinde (veya kendisi) olup olmadığını döner.
 * @param {string} targetPath
 * @returns {boolean}
 */
export function isInsideFakap(targetPath) {
  try {
    if (!fakapDirGetter || !targetPath) return false;
    const fakapDir = fakapDirGetter();
    if (!fakapDir) return false;
    const a = path.resolve(fakapDir).toLowerCase();
    const b = path.resolve(targetPath).toLowerCase();
    return b === a || b.startsWith(a + path.sep);
  } catch (e) {
    return false;
  }
}
