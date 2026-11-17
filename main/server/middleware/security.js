// Türkçe Açıklama: API rotalarını yetkisiz harici erişimlere karşı koruyan, sadece localhost (127.0.0.1, ::1) üzerinden gelen isteklere izin veren güvenlik ara yazılımı.
import dns from 'dns/promises';
import net from 'net';

/**
 * Verilen Origin veya Referer başlığının yerel uygulama ya da tarayıcı eklentisine ait olup olmadığını kontrol eder.
 *
 * @param {string} originHeader - Origin veya Referer başlık değeri
 * @returns {boolean} Güvenilir yerel kaynak ise true
 */
export function isAllowedLocalOrigin(originHeader) {
  if (!originHeader || typeof originHeader !== 'string') return false;
  try {
    const parsedOrigin = new URL(originHeader);
    const originHost = parsedOrigin.hostname.toLowerCase();
    return originHost === 'localhost' ||
           originHost === '127.0.0.1' ||
           originHost === '[::1]' ||
           originHost === '::1' ||
           originHost.endsWith('.local') ||
           parsedOrigin.protocol === 'chrome-extension:' ||
           parsedOrigin.protocol === 'moz-extension:';
  } catch {
    return false;
  }
}

/**
 * Bir IP adresinin loopback, özel ağ (RFC1918), link-local veya dahili yönlendirilemez adres olup olmadığını sınar.
 *
 * @param {string} ip - IPv4 veya IPv6 adresi
 * @returns {boolean} Dahili/özel ağ adresi ise true
 */
export function isPrivateOrLoopbackIp(ip) {
  if (!ip || typeof ip !== 'string') return true;
  let normalized = ip.trim().toLowerCase();
  if (normalized.startsWith('::ffff:')) {
    normalized = normalized.slice(7);
  }
  const zoneIdx = normalized.indexOf('%');
  if (zoneIdx !== -1) {
    normalized = normalized.slice(0, zoneIdx);
  }

  if (net.isIPv4(normalized)) {
    const parts = normalized.split('.').map(Number);
    if (parts.length !== 4 || parts.some(n => Number.isNaN(n))) return true;
    const [a, b] = parts;
    if (a === 0 || a === 10 || a === 127) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
    return false;
  }

  if (net.isIPv6(normalized)) {
    if (normalized === '::' || normalized === '::1') return true;
    if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true;
    if (normalized.startsWith('fe8') || normalized.startsWith('fe9') || normalized.startsWith('fea') || normalized.startsWith('feb')) return true;
    return false;
  }

  return true;
}

/**
 * Proxy isteklerinde hedef URL'nin yalnızca dış http/https kaynaklarına yönelik olduğunu doğrulayarak SSRF saldırılarını engeller.
 *
 * @param {string} rawUrl - Doğrulanacak harici URL
 * @returns {Promise<{ ok: boolean, url?: URL, error?: string }>}
 */
export async function validateSafeExternalUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') {
    return { ok: false, error: 'Geçersiz URL parametresi.' };
  }

  let parsed;
  try {
    parsed = new URL(rawUrl.trim());
  } catch {
    return { ok: false, error: 'Geçersiz URL formatı.' };
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { ok: false, error: 'Yalnızca HTTP/HTTPS protokollerine izin verilir.' };
  }

  const host = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (!host || host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal')) {
    return { ok: false, error: 'Yerel ağ veya localhost hedeflerine proxy izni yoktur.' };
  }

  if (net.isIP(host)) {
    if (isPrivateOrLoopbackIp(host)) {
      return { ok: false, error: 'Özel IP / loopback adreslerine proxy izni yoktur.' };
    }
    return { ok: true, url: parsed };
  }

  try {
    const resolved = await dns.lookup(host, { all: true });
    if (Array.isArray(resolved) && resolved.some(entry => isPrivateOrLoopbackIp(entry.address))) {
      return { ok: false, error: 'Hedef alan adı yerel veya özel bir IP adresine çözümlendi.' };
    }
  } catch {
    // Çevrimdışı veya özel DNS çözümleme hatalarında sonraki fetch adımı standart ağ hatası döndürecektir.
  }

  return { ok: true, url: parsed };
}

/**
 * Gelen HTTP isteğinin yalnızca localhost'tan (127.0.0.1 veya ::1) geldiğini doğrular.
 * Ayrıca harici web sitelerinden (Cross-Origin) gelen yetkisiz CSRF/Rebinding isteklerini engeller.
 *
 * @param {import('express').Request} req - Express istek nesnesi
 * @param {import('express').Response} res - Express yanıt nesnesi
 * @param {import('express').NextFunction} next - Sonraki middleware'e geçiş fonksiyonu
 * @returns {void}
 */
export function localhostOnly(req, res, next) {
  const ip = req.ip || req.socket?.remoteAddress || req.connection?.remoteAddress;
  const isLocalIp = !ip || 
                    ip === '127.0.0.1' || 
                    ip === '::1' || 
                    ip === '::ffff:127.0.0.1' ||
                    (typeof ip === 'string' && (ip.endsWith('127.0.0.1') || ip === '::1'));
                    
  // Hostname kontrolü (DNS rebinding saldırılarını önlemek için katı kontrol)
  const host = (req.headers.host || '').split(':')[0].toLowerCase();
  const isLocalHost = host === 'localhost' || host === '127.0.0.1' || host === '[::1]';

  if (!isLocalIp || !isLocalHost) {
    console.warn(`[Güvenlik] Yetkisiz harici istek engellendi! IP: ${ip}, Host: ${host}, Yol: ${req.originalUrl}`);
    return res.status(403).json({ error: 'Güvenlik Nedeniyle Erişim Engellendi. Sadece yerel uygulama üzerinden erişim sağlanabilir.' });
  }

  // Cross-Origin (CSRF) Koruması: Dış sitelerden tetiklenen istekleri (POST/PUT/DELETE/PATCH) engelle
  const origin = req.headers.origin || req.headers.referer;
  if (origin && !['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    if (!isAllowedLocalOrigin(origin)) {
      console.warn(`[Güvenlik] Harici siteden (CSRF) gelen istek engellendi! Kaynak: ${origin}, Yol: ${req.originalUrl}`);
      return res.status(403).json({ error: 'Güvenlik Nedeniyle Erişim Engellendi (Geçersiz Kaynak).' });
    }
  }

  next();
}
