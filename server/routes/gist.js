// Türkçe Açıklama: GitHub Gist üzerinden kanallar (channels.ini) senkronizasyonu, token doğrulaması, Gist push ve pull API rotaları modülü.
import express from 'express';
import fs from 'fs';
import { readDb, writeDb, syncWithIni } from '../database.js';
import { channelsIniPath } from '../config.js';
import { localhostOnly } from '../middleware/security.js';
import { broadcast, addTerminalLog } from '../services/sse.js';

export const router = express.Router();

/**
 * GitHub API istekleri için ortak HTTP başlıkları (Header) üretir.
 * 
 * @param {string} token GitHub Personal Access Token
 * @returns {object} HTTP başlıkları
 */
function getGithubHeaders(token) {
  return {
    'User-Agent': 'HaYTooL-YT-Downloader',
    'Authorization': `Bearer ${token.trim()}`,
    'Accept': 'application/vnd.github+json',
    'Content-Type': 'application/json'
  };
}

/**
 * Otomatik Gist senkronizasyonunu arka planda tetikler.
 * Kanal eklendiğinde, silindiğinde veya güncellendiğinde çağrılır.
 * 
 * @returns {Promise<void>}
 */
let lastAutoSyncErrorTime = 0;

/**
 * Otomatik Gist senkronizasyonunu arka planda tetikler.
 * Kanal eklendiğinde, silindiğinde veya güncellendiğinde çağrılır.
 * 
 * @returns {Promise<void>}
 */
export async function triggerAutoGistSync() {
  try {
    const db = readDb();
    const { githubToken, githubGistId, autoSyncGist } = db.settings || {};
    
    if (!autoSyncGist || !githubToken || !githubGistId) return;
    if (!fs.existsSync(channelsIniPath)) return;

    const channelsContent = fs.readFileSync(channelsIniPath, 'utf-8');
    const url = `https://api.github.com/gists/${githubGistId}`;
    
    const response = await fetch(url, {
      method: 'PATCH',
      headers: getGithubHeaders(githubToken),
      body: JSON.stringify({
        description: 'HaYTooL YT Downloader - channels.ini Yedeği',
        files: {
          'channels.ini': {
            content: channelsContent
          }
        }
      })
    });

    if (response.ok) {
      console.log('[Gist] Otomatik kanal yedeği GitHub Gist üzerine aktarıldı.');
      addTerminalLog('[Gist] Otomatik kanal yedeği GitHub Gist üzerine aktarıldı.', 'success');
    } else {
      const now = Date.now();
      // Her 60 saniyede bir en fazla 1 defa hata uyarısı günlüğe yazılarak konsol kirliliği önlenir
      if (now - lastAutoSyncErrorTime > 60000) {
        lastAutoSyncErrorTime = now;
        if (response.status === 403) {
          console.warn('[Gist Hata]: 403 Forbidden - GitHub Token yetkisi yetersiz ("gist" izni gereklidir) veya Gist ID geçersiz.');
          addTerminalLog('[Gist] Otomatik yedekleme başarısız (403 Forbidden). Lütfen GitHub Token yetkinizde "gist" iznini kontrol edin.', 'warning');
        } else if (response.status === 404) {
          console.warn('[Gist Hata]: 404 Not Found - Belirtilen Gist ID bulunamadı.');
        } else {
          console.warn(`[Gist Hata]: ${response.status} ${response.statusText}`);
        }
      }
    }
  } catch (err) {
    const now = Date.now();
    if (now - lastAutoSyncErrorTime > 60000) {
      lastAutoSyncErrorTime = now;
      console.warn('[Gist Hata]:', err.message);
    }
  }
}

/**
 * Girilen GitHub Personal Access Token (PAT) geçerliliğini doğrular.
 * 
 * @name POST /api/gist/test
 * @function
 * @inner
 * @param {object} req - Express istek nesnesi
 * @param {string} req.body.token - GitHub Token
 * @param {object} res - Express yanıt nesnesi
 * @returns {Promise<void>}
 */
router.post('/test', localhostOnly, async (req, res) => {
  const { token } = req.body;
  if (!token) {
    return res.status(400).json({ error: 'GitHub Token alanı zorunludur.' });
  }

  try {
    const response = await fetch('https://api.github.com/user', {
      headers: getGithubHeaders(token)
    });

    if (!response.ok) {
      if (response.status === 401) {
        console.error('[Gist Hata]: Geçersiz veya süresi dolmuş GitHub Token.');
        return res.status(401).json({ error: 'Geçersiz veya süresi dolmuş GitHub Token.' });
      }
      console.error(`[Gist Hata]: GitHub API (${response.status} ${response.statusText})`);
      return res.status(response.status).json({ error: `GitHub API Hatası: ${response.statusText}` });
    }

    const data = await response.json();
    const scopesHeader = response.headers.get('x-oauth-scopes') || '';
    const hasGistScope = scopesHeader.includes('gist');

    console.log(`[Gist] Token başarıyla doğrulandı. Bağlanan kullanıcı: ${data.login}`);

    if (scopesHeader && !hasGistScope) {
      console.warn('[Gist Uyarı]: Token geçerli fakat "gist" izni yok!');
      return res.json({
        success: true,
        username: data.login,
        avatarUrl: data.avatar_url,
        warning: 'Token geçerli fakat "gist" izni yok! Lütfen Token alırken "gist" kutucuğunu işaretleyin.'
      });
    }

    res.json({ success: true, username: data.login, avatarUrl: data.avatar_url });
  } catch (err) {
    console.error('[Gist Hata]:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * Yerel channels.ini dosyasını GitHub Gist üzerine yükler (Push).
 * Gist ID yoksa yeni bir gizli (private) Gist oluşturur.
 * 
 * @name POST /api/gist/push
 * @function
 * @inner
 * @param {object} req - Express istek nesnesi
 * @param {string} req.body.token - GitHub Token
 * @param {string} [req.body.gistId] - Mevcut Gist ID (Opsiyonel)
 * @param {boolean} [req.body.autoSync] - Otomatik senkronizasyon açık mı
 * @param {object} res - Express yanıt nesnesi
 * @returns {Promise<void>}
 */
router.post('/push', localhostOnly, async (req, res) => {
  const { token, gistId, autoSync } = req.body;
  if (!token) {
    return res.status(400).json({ error: 'GitHub Token alanı zorunludur.' });
  }

  if (!fs.existsSync(channelsIniPath)) {
    return res.status(404).json({ error: 'Yerel channels.ini dosyası bulunamadı.' });
  }

  try {
    const channelsContent = fs.readFileSync(channelsIniPath, 'utf-8');
    const targetGistId = gistId || (readDb().settings || {}).githubGistId;

    let response;
    let payload = {
      description: 'HaYTooL YT Downloader - channels.ini Yedeği',
      files: {
        'channels.ini': {
          content: channelsContent
        }
      }
    };

    if (targetGistId) {
      // Güncelle (PATCH)
      response = await fetch(`https://api.github.com/gists/${targetGistId}`, {
        method: 'PATCH',
        headers: getGithubHeaders(token),
        body: JSON.stringify(payload)
      });
    } else {
      // Yeni Oluştur (POST)
      payload.public = false; // Gizli (Private) Gist
      response = await fetch('https://api.github.com/gists', {
        method: 'POST',
        headers: getGithubHeaders(token),
        body: JSON.stringify(payload)
      });
    }

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      console.error(`[Gist Hata]: Push başarısız - ${errData.message || response.statusText}`);
      return res.status(response.status).json({ 
        error: errData.message || `Gist yükleme hatası (${response.status})` 
      });
    }

    const gistData = await response.json();
    const finalGistId = gistData.id;

    // Ayarları db.json içine güvenle kaydet (configwin.ini'ye yansıtılmayacak)
    const db = readDb();
    db.settings.githubToken = token;
    db.settings.githubGistId = finalGistId;
    if (autoSync !== undefined) {
      db.settings.autoSyncGist = !!autoSync;
    }
    writeDb(db);

    console.log('[Gist] Kanallar başarıyla GitHub Gist üzerine kaydedildi.');
    addTerminalLog('[Gist] Kanallar başarıyla GitHub Gist üzerine aktarıldı.', 'success');
    res.json({ 
      success: true, 
      gistId: finalGistId, 
      gistUrl: gistData.html_url,
      message: 'Kanallar başarıyla GitHub Gist üzerine kaydedildi.' 
    });
  } catch (err) {
    console.error('[Gist Hata]: Push istisnası:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GitHub Gist üzerindeki channels.ini dosyasını indirir ve yerel kanallarla eşitler (Pull).
 * 
 * @name POST /api/gist/pull
 * @function
 * @inner
 * @param {object} req - Express istek nesnesi
 * @param {string} req.body.token - GitHub Token
 * @param {string} req.body.gistId - Gist ID
 * @param {object} res - Express yanıt nesnesi
 * @returns {Promise<void>}
 */
router.post('/pull', localhostOnly, async (req, res) => {
  const { token, gistId } = req.body;
  if (!token || !gistId) {
    return res.status(400).json({ error: 'GitHub Token ve Gist ID alanları zorunludur.' });
  }

  try {
    const response = await fetch(`https://api.github.com/gists/${gistId}`, {
      headers: getGithubHeaders(token)
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      console.error(`[Gist Hata]: Pull başarısız - ${errData.message || response.statusText}`);
      return res.status(response.status).json({ 
        error: errData.message || `Gist çekme hatası (${response.status})` 
      });
    }

    const gistData = await response.json();
    const fileObj = gistData.files && (gistData.files['channels.ini'] || Object.values(gistData.files)[0]);

    if (!fileObj || !fileObj.content) {
      console.error('[Gist Hata]: Gist içerisinde channels.ini dosyası bulunamadı.');
      return res.status(400).json({ error: 'Gist içerisinde channels.ini dosyası bulunamadı.' });
    }

    // Yerel channels.ini dosyasına yaz
    fs.writeFileSync(channelsIniPath, fileObj.content, 'utf-8');

    // Veritabanını eşitle
    const db = readDb();
    db.settings.githubToken = token;
    db.settings.githubGistId = gistId;
    syncWithIni(db);
    writeDb(db);

    broadcast('db_update', db);
    broadcast('status_log', { message: 'Kanallar GitHub Gist üzerinden başarıyla güncellendi.', type: 'success' });
    console.log('[Gist] Kanallar GitHub Gist üzerinden başarıyla çekildi ve yerel veritabanı güncellendi.');
    addTerminalLog('[Gist] Kanallar GitHub Gist üzerinden başarıyla içe aktarıldı.', 'success');

    res.json({ success: true, message: 'Kanallar Gist üzerinden çekildi ve veritabanı güncellendi.' });
  } catch (err) {
    console.error('[Gist Hata]: Pull istisnası:', err.message);
    res.status(500).json({ error: err.message });
  }
});
