// Türkçe Açıklama: YouTube oturum çerezlerinin geçerliliğini periyodik olarak kontrol eden,
// geçersizse otomatik sessiz yenileme tetikleyen ve kullanıcıya net bildirim gösteren modül.
// Description: Periodically validates YouTube session cookies, triggers silent refresh when
// invalid, and notifies the user with a clear message when automatic renewal fails.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { triggerSilentCookieRefresh } from '../routes/settings.js';
import { addTerminalLog, broadcast } from './sse.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..', '..');

// History sayfası oturum açıkken ~3MB, kapalıyken ~780KB içerik döndürür.
// 1.5MB eşiği iki durumu güvenilir şekilde ayırır.
const HEALTHY_MIN_BYTES = 1500000;
const CHECK_INTERVAL_MS = 30 * 60 * 1000; // 30 dakika
const FIRST_CHECK_DELAY_MS = 10 * 1000;   // Sunucu açılışında 10 sn sonra ilk kontrol
const REFRESH_VERIFY_DELAY_MS = 20 * 1000; // Sessiz yenileme sonrası doğrulama beklemesi

let cookieHealthTimer = null;

/**
 * Türkçe Açıklama: Kök ve bin/ çerez dosyalarını birleştirip tek Cookie header'ı üretir.
 * 
 * @returns {string} Cookie header değeri (çerez yoksa boş string)
 */
function buildCookieHeader() {
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
 * gerçekten tanınıp tanınmadığını içerik boyutuna göre doğrular.
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
    return html.length >= HEALTHY_MIN_BYTES;
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
 * Türkçe Açıklama: Sunucu başlangıcında ve sonrasında 30 dakikada bir çerez sağlık kontrolünü başlatır.
 * Yalnızca bir kez çağrılmalıdır (server.js başlangıcında).
 */
export function startCookieHealthCheck() {
  if (cookieHealthTimer) return;
  setTimeout(() => { runCookieHealthCheck().catch(() => {}); }, FIRST_CHECK_DELAY_MS);
  cookieHealthTimer = setInterval(() => { runCookieHealthCheck().catch(() => {}); }, CHECK_INTERVAL_MS);
}
