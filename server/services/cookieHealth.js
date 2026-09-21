// Türkçe Açıklama: YouTube oturum çerezlerinin geçerliliğini periyodik olarak kontrol eden,
// geçersizse otomatik sessiz yenileme tetikleyen ve kullanıcıya net bildirim gösteren modül.
// Description: Periodically validates YouTube session cookies, triggers silent refresh when
// invalid, and notifies the user with a clear message when automatic renewal fails.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { triggerSilentCookieRefresh } from '../routes/settings.js';
import { addTerminalLog, broadcast } from './sse.js';
import { readDb } from '../database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..', '..');

// YouTube izleme geçmişi sayfası kontrolü:
// Oturum açıkken HTML içinde "LOGGED_IN":true veya "SESSION_INDEX" bulunur.
// Anonim modda ise "LOGGED_IN":false döner veya giriş sayfasına yönlendirir.
const CHECK_INTERVAL_MS = 30 * 60 * 1000; // 30 dakika
const FIRST_CHECK_DELAY_MS = 45 * 1000;   // Sunucu açılışında arka plan yenilemesinin tamamlanması için 45 sn bekle
const REFRESH_VERIFY_DELAY_MS = 25 * 1000; // Sessiz yenileme sonrası doğrulama beklemesi

let cookieHealthTimer = null;

/**
 * Türkçe Açıklama: Kök ve bin/ çerez dosyalarını birleştirip tek Cookie header'ı üretir.
 * 
 * @returns {string} Cookie header değeri (çerez yoksa boş string)
 */
export function buildCookieHeader() {
  const rootCookiesTxt = path.resolve(rootDir, 'cookies.txt');
  const binCookiesTxt = path.resolve(rootDir, 'bin', 'cookies.txt');
  const cookiesObj = {};
  for (const cookieFile of [rootCookiesTxt, binCookiesTxt]) {
    if (!fs.existsSync(cookieFile)) continue;
    const content = fs.readFileSync(cookieFile, 'utf8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const parts = trimmed.split('\t');
      if (parts.length >= 7) {
        cookiesObj[parts[5]] = parts[6];
      }
    }
  }
  return Object.entries(cookiesObj).map(([k, v]) => `${k}=${v}`).join('; ');
}

/**
 * Türkçe Açıklama: Mevcut çerezlerle YouTube izleme geçmişi sayfasını çekip oturumun
 * gerçekten tanınıp tanınmadığını YouTube ytcfg değişkenlerine göre doğrular.
 * 
 * @returns {Promise<boolean>} Oturum geçerliyse true
 */
export async function isYouTubeSessionHealthy() {
  const cookieHeader = buildCookieHeader();
  if (!cookieHeader) return false;
  try {
    const res = await fetch('https://www.youtube.com/feed/history', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Cookie': cookieHeader,
        'Accept-Language': 'tr-TR,tr;q=0.9,en;q=0.8'
      },
      redirect: 'follow'
    });
    if (res.status !== 200) return false;
    const html = await res.text();

    // 1. Kesin kontrol: ytcfg içinde "LOGGED_IN":true bulunması
    if (/"LOGGED_IN"\s*:\s*true/.test(html)) {
      return true;
    }

    // 2. Yedek kontrol: Eğer "LOGGED_IN":false ise oturum kesinlikle kapalıdır
    if (/"LOGGED_IN"\s*:\s*false/.test(html)) {
      return false;
    }

    // 3. Ek göstergeler: SESSION_INDEX veya zengin içerik
    if (html.includes('"SESSION_INDEX"') || (html.length >= 800000 && html.includes('ytInitialData'))) {
      return true;
    }

    return false;
  } catch (e) {
    return false;
  }
}

/**
 * Türkçe Açıklama: Çerez sağlık kontrolünü tek seferlik çalıştırır; geçersizse sessiz yenileme
 * dener, o da başarısız olursa kullanıcıya net bir bildirim gösterir.
 */
export async function runCookieHealthCheck() {
  const healthy = await isYouTubeSessionHealthy();
  if (healthy) return true;

  addTerminalLog('[Çerez Sağlık] YouTube oturum çerezleri geçersiz tespit edildi. Sessiz yenileme deneniyor...', 'warning');
  try {
    await triggerSilentCookieRefresh();
  } catch (e) {}

  // Sessiz yenilemenin çerezleri yazmasını bekle, sonra tekrar doğrula
  await new Promise(r => setTimeout(r, REFRESH_VERIFY_DELAY_MS));
  const healthyAfter = await isYouTubeSessionHealthy();
  if (healthyAfter) {
    addTerminalLog('[Çerez Sağlık] YouTube çerezleri otomatik olarak yenilendi.', 'success');
    return true;
  }

  addTerminalLog('[Çerez Sağlık] Otomatik yenileme başarısız. Lütfen Ayarlar → "YouTube\'da Oturum Aç" ile oturumunuzu yenileyin.', 'error');
  broadcast('status_log', {
    message: 'YouTube oturum çerezleriniz geçersiz! Ayarlar sekmesinden "YouTube\'da Oturum Aç" ile oturumunuzu yenileyin.',
    type: 'error'
  });
  return false;
}

/**
 * Türkçe Açıklama: Sunucu başlangıcında ve ayar değişikliklerinde çerez sağlık kontrolünü yapılandırır.
 * autoCookieRefresh kapalıysa zamanlayıcıyı durdurur; açıksa belirlenen dakika aralığında çalıştırır.
 * 
 * @param {object} [customSettings=null] - İsteğe bağlı güncel ayarlar nesnesi
 */
export function restartCookieHealthCheck(customSettings = null) {
  if (cookieHealthTimer) {
    clearInterval(cookieHealthTimer);
    cookieHealthTimer = null;
  }

  let autoRefresh = true;
  let intervalMins = 30;

  try {
    const db = readDb();
    const settings = customSettings || db.settings || {};
    autoRefresh = settings.autoCookieRefresh !== false;
    intervalMins = parseInt(settings.cookieRefreshInterval, 10) || 30;
  } catch (e) {
    if (customSettings) {
      autoRefresh = customSettings.autoCookieRefresh !== false;
      intervalMins = parseInt(customSettings.cookieRefreshInterval, 10) || 30;
    }
  }

  if (!autoRefresh) {
    console.log('[Çerez Sağlık] Otomatik YouTube çerez yenileme devre dışı bırakıldı (Kapalı).');
    return;
  }

  const intervalMs = Math.max(5, intervalMins) * 60 * 1000;
  console.log(`[Çerez Sağlık] Otomatik çerez denetleme ve yenileme devrede. Aralık: ${intervalMins} dakika.`);
  cookieHealthTimer = setInterval(() => { runCookieHealthCheck().catch(() => {}); }, intervalMs);
}

/**
 * Türkçe Açıklama: Sunucu başlangıcında gecikmeli ilk kontrolü yapar ve periyodik zamanlayıcıyı başlatır.
 */
export function startCookieHealthCheck() {
  let autoRefresh = true;
  let intervalMins = 30;

  try {
    const db = readDb();
    autoRefresh = db.settings?.autoCookieRefresh !== false;
    intervalMins = parseInt(db.settings?.cookieRefreshInterval, 10) || 30;
  } catch (e) {}

  if (!autoRefresh) {
    console.log('[Çerez Sağlık] Otomatik YouTube çerez yenileme açılışta kapalı.');
    return;
  }

  setTimeout(() => { runCookieHealthCheck().catch(() => {}); }, FIRST_CHECK_DELAY_MS);
  restartCookieHealthCheck({ autoCookieRefresh: autoRefresh, cookieRefreshInterval: intervalMins });
}

