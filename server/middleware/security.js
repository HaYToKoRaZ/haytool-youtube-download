// Türkçe Açıklama: API rotalarını yetkisiz harici erişimlere karşı koruyan, sadece localhost (127.0.0.1, ::1) üzerinden gelen isteklere izin veren güvenlik ara yazılımı.
/**
 * Gelen HTTP isteğinin yalnızca localhost'tan (127.0.0.1 veya ::1) geldiğini doğrular.
 * Harici IP adreslerinden gelen istekleri 403 Forbidden hatası ile reddeder.
 * CSRF saldırılarına karşı temel koruma katmanıdır.
 *
 * @param {import('express').Request} req - Express istek nesnesi
 * @param {import('express').Response} res - Express yanıt nesnesi
 * @param {import('express').NextFunction} next - Sonraki middleware'e geçiş fonksiyonu
 * @returns {void}
 */
export function localhostOnly(req, res, next) {
  const ip = req.ip || req.connection.remoteAddress;
  const isLocal = ip === '127.0.0.1' || 
                  ip === '::1' || 
                  ip === '::ffff:127.0.0.1' || 
                  req.hostname === 'localhost' || 
                  req.hostname === '127.0.0.1';
                  
  if (!isLocal) {
    console.warn(`[Güvenlik] Yetkisiz harici istek engellendi! IP: ${ip}, Yol: ${req.originalUrl}`);
    return res.status(403).json({ error: 'Güvenlik Nedeniyle Erişim Engellendi. Sadece localhost üzerinden erişim sağlanabilir.' });
  }
  next();
}
