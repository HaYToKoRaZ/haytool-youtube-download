// Türkçe Açıklama: IPTV önbelleği yükleme, M3U dosya ayrıştırma, HLS kütüphanesini indirme ve IPTV filtrelerini yönetme modülü.
import fs from 'fs';
import path from 'path';
import https from 'https';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..', '..');
import { dataRootDir } from '../config.js';

export const iptvCachePath = path.join(dataRootDir, 'iptv_cache.json');

export const iptvUpdateStatus = {
  status: 'idle',
  error: null,
  totalChannels: 0,
  lastUpdated: null
};

export let iptvChannelsMemory = [];
export let iptvCountriesList = [];
export let iptvCategoriesList = [];
let iptvCacheLoaded = false;

/**
 * IPTV kanal önbelleğini yalnızca ilk ihtiyaç anında (Lazy-Load) diskten belleğe yükler.
 * IPTV sekmesi açılmadıkça 2.6 MB JSON dosyasını RAM'de tutmaz.
 */
export function ensureIptvChannelsLoaded() {
  if (iptvCacheLoaded) return;
  iptvCacheLoaded = true;
  loadIptvCache();
}

/**
 * Türkçe Açıklama: IPTV oynatımında kullanılan hls.min.js kütüphanesi yerelde yoksa CDN üzerinden indirip kaydeder.
 * 
 * @returns {Promise<void>}
 */
export function downloadHlsJsIfNeeded() {
  return new Promise((resolve) => {
    const publicDir = path.join(rootDir, 'public');
    const hlsPath = path.join(publicDir, 'hls.min.js');
    if (fs.existsSync(hlsPath)) {
      console.log('[IPTV] hls.min.js zaten mevcut.');
      return resolve();
    }

    console.log('[IPTV] hls.min.js bulunamadı, CDN üzerinden indiriliyor...');
    const url = 'https://cdnjs.cloudflare.com/ajax/libs/hls.js/1.5.8/hls.min.js';
    
    https.get(url, (res) => {
      if (res.statusCode !== 200) {
        console.error(`[IPTV] hls.min.js indirilemedi: HTTP ${res.statusCode}`);
        return resolve();
      }

      const fileStream = fs.createWriteStream(hlsPath);
      res.pipe(fileStream);
      fileStream.on('finish', () => {
        fileStream.close();
        console.log('[IPTV] hls.min.js başarıyla indirildi.');
        resolve();
      });
      fileStream.on('error', (err) => {
        fileStream.close();
        fs.unlink(hlsPath, () => {});
        console.error('[IPTV] hls.min.js yazılırken hata oluştu:', err.message);
        resolve();
      });
    }).on('error', (err) => {
      console.error('[IPTV] hls.min.js indirilirken bağlantı hatası oluştu:', err.message);
      resolve();
    });
  });
}

/**
 * Türkçe Açıklama: Bellekteki IPTV kanallarını tarayarak benzersiz ülke ve kategori listelerini oluşturur ve sıralar.
 * 
 * @returns {void}
 */
export function computeIptvFilters() {
  const countries = new Set();
  const categories = new Set();
  for (const ch of iptvChannelsMemory) {
    if (ch.country) countries.add(ch.country.toUpperCase());
    if (ch.category) categories.add(ch.category);
  }
  iptvCountriesList = Array.from(countries).sort();
  iptvCategoriesList = Array.from(categories).sort();
}

/**
 * Başlangıçta cache'i diskten yükleyen fonksiyon.
 */
function loadIptvCache() {
  try {
    if (fs.existsSync(iptvCachePath)) {
      const data = JSON.parse(fs.readFileSync(iptvCachePath, 'utf8'));
      const rawChannels = Array.isArray(data.channels) ? data.channels : [];
      rawChannels.forEach(function(ch) {
        if (!ch.country && ch.id) {
          const m = ch.id.match(/\.([a-z]{2})(?:@|$)/i);
          if (m) ch.country = m[1].toUpperCase();
        }
      });
      iptvChannelsMemory = rawChannels;
      iptvUpdateStatus.lastUpdated = data.lastUpdated || fs.statSync(iptvCachePath).mtime.toISOString();
      iptvUpdateStatus.totalChannels = iptvChannelsMemory.length;
      computeIptvFilters();
      console.log(`[IPTV] Belleğe ${iptvChannelsMemory.length} adet IPTV kanalı yüklendi.`);
    }
  } catch (e) {
    console.error('[IPTV] Cache yüklenirken hata:', e.message);
  }
}

/**
 * IPTV Bellek verilerini güncelleyen yardımcı fonksiyon.
 */
export function setIptvChannels(channels) {
  iptvChannelsMemory = channels;
  iptvCacheLoaded = true;
  computeIptvFilters();
}
