// Türkçe Açıklama: API rotalarını yetkisiz harici erişimlere karşı koruyan, sadece localhost (127.0.0.1, ::1) üzerinden gelen isteklere izin veren güvenlik ara yazılımı.
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
