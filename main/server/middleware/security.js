// Türkçe Açıklama: API rotalarını yetkisiz harici erişimlere karşı koruyan, sadece localhost (127.0.0.1, ::1) üzerinden gelen isteklere izin veren güvenlik ara yazılımı.
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
  const ip = req.ip || req.connection.remoteAddress;
  const isLocalIp = ip === '127.0.0.1' || 
                    ip === '::1' || 
                    ip === '::ffff:127.0.0.1';
                    
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
    try {
      const parsedOrigin = new URL(origin);
      const originHost = parsedOrigin.hostname.toLowerCase();
      const isAllowedOrigin = originHost === 'localhost' || 
                              originHost === '127.0.0.1' || 
                              originHost.endsWith('.local') ||
                              parsedOrigin.protocol === 'chrome-extension:' ||
                              parsedOrigin.protocol === 'moz-extension:';
      if (!isAllowedOrigin) {
        console.warn(`[Güvenlik] Harici siteden (CSRF) gelen istek engellendi! Kaynak: ${origin}, Yol: ${req.originalUrl}`);
        return res.status(403).json({ error: 'Güvenlik Nedeniyle Erişim Engellendi (Geçersiz Kaynak).' });
      }
    } catch {
      // Geçersiz formatlı Origin/Referer başlığı
      return res.status(403).json({ error: 'Geçersiz istek başlığı.' });
    }
  }

  next();
}
