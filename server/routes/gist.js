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
let gistDebounceTimer = null;

/**
 * Otomatik Gist senkronizasyonunu arka planda tetikler.
 * Kanal eklendiğinde, silindiğinde veya güncellendiğinde çağrılır.
 * Peş peşe gelen çağrılarda 5 saniyelik debounce uygulayarak tek bir Gist güncellemesi yapar.
 * 
 * @param {boolean} [immediate=false] Debounce uygulamadan hemen çalıştırma bayrağı
 * @returns {Promise<void>}
 */
export async function triggerAutoGistSync(immediate = false) {
  if (gistDebounceTimer) {
    clearTimeout(gistDebounceTimer);
    gistDebounceTimer = null;
  }

  if (!immediate) {
    gistDebounceTimer = setTimeout(() => {
      gistDebounceTimer = null;
      executeAutoGistSync().catch(() => {});
    }, 5000);
    return;
  }

  await executeAutoGistSync();
}

async function executeAutoGistSync() {
  try {
    const db = readDb();
    const { githubToken, githubGistId, autoSyncGist } = db.settings || {};
    
    if (!autoSyncGist || !githubToken || !githubGistId) return;
    if (!fs.existsSync(channelsIniPath)) return;

    const rootDir = process.cwd();
    const catIniPath = `${rootDir}/categories.ini`;
    const configWinPath = `${rootDir}/configwin.ini`;
    const configUnixPath = `${rootDir}/configunix.ini`;
    const configPath = fs.existsSync(configWinPath) ? configWinPath : configUnixPath;

    const channelsContent = await fs.promises.readFile(channelsIniPath, 'utf-8');
    let catContent = '';
    try { if (fs.existsSync(catIniPath)) catContent = await fs.promises.readFile(catIniPath, 'utf-8'); } catch (e) {}
    let configContent = '';
    try { if (fs.existsSync(configPath)) configContent = await fs.promises.readFile(configPath, 'utf-8'); } catch (e) {}

    // db.json içeriğindeki githubToken alanını temizle (GitHub secret scanner iptalini önler)
    const dbSanitized = JSON.parse(JSON.stringify(db));
    if (dbSanitized.settings) {
      delete dbSanitized.settings.githubToken;
    }
    const dbContent = JSON.stringify(dbSanitized, null, 2).replace(/[\u200E\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/g, '');

    const url = `https://api.github.com/gists/${githubGistId}`;
    
    const response = await fetch(url, {
      method: 'PATCH',
      headers: getGithubHeaders(githubToken),
      body: JSON.stringify({
        description: 'HaYTooL YT Downloader - Tam Sistem Veritabanı & Ayar Yedeği',
        files: {
          'channels.ini': { content: channelsContent || '; empty' },
          'db.json': { content: dbContent },
          'categories.ini': { content: catContent || '; empty' },
          [fs.existsSync(configWinPath) ? 'configwin.ini' : 'configunix.ini']: { content: configContent || '; empty' }
        }
      })
    });

    if (response.ok) {
      console.log('[Gist] Otomatik sistem yedeği GitHub Gist üzerine aktarıldı.');
      addTerminalLog('[Gist] Otomatik sistem yedeği GitHub Gist üzerine aktarıldı.', 'success');
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
 * Tüm sistem veritabanı ve ayarlarını GitHub Gist üzerine yükler (Push).
 * db.json Gist'e gönderilmeden önce içindeki githubToken temizlenerek GitHub botunun token'ı iptal etmesi engellenir.
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

  try {
    const rootDir = process.cwd();
    const catIniPath = `${rootDir}/categories.ini`;
    const configWinPath = `${rootDir}/configwin.ini`;
    const configUnixPath = `${rootDir}/configunix.ini`;
    const configPath = fs.existsSync(configWinPath) ? configWinPath : configUnixPath;

    const channelsContent = fs.existsSync(channelsIniPath) ? fs.readFileSync(channelsIniPath, 'utf-8') : '';
    const catContent = fs.existsSync(catIniPath) ? fs.readFileSync(catIniPath, 'utf-8') : '';
    const configContent = fs.existsSync(configPath) ? fs.readFileSync(configPath, 'utf-8') : '';

    // Gist'e atılan db.json içerisinden githubToken bilgisini kaldır ve görünmez bidi unicode karakterlerini temizle
    const currentDb = readDb();
    const dbSanitized = JSON.parse(JSON.stringify(currentDb));
    if (dbSanitized.settings) {
      delete dbSanitized.settings.githubToken;
    }
    const dbContent = JSON.stringify(dbSanitized, null, 2).replace(/[\u200E\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/g, '');

    const targetGistId = gistId || (currentDb.settings || {}).githubGistId;

    let response;
    let payload = {
      description: 'HaYTooL YT Downloader - Tam Sistem Veritabanı & Ayar Yedeği',
      files: {
        'channels.ini': { content: channelsContent || '; empty' },
        'db.json': { content: dbContent },
        'categories.ini': { content: catContent || '; empty' },
        [fs.existsSync(configWinPath) ? 'configwin.ini' : 'configunix.ini']: { content: configContent || '; empty' }
      }
    };

    if (targetGistId) {
      response = await fetch(`https://api.github.com/gists/${targetGistId}`, {
        method: 'PATCH',
        headers: getGithubHeaders(token),
        body: JSON.stringify(payload)
      });
    } else {
      payload.public = false;
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

    const db = readDb();
    db.settings.githubToken = token;
    db.settings.githubGistId = finalGistId;
    if (autoSync !== undefined) {
      db.settings.autoSyncGist = !!autoSync;
    }
    writeDb(db);

    console.log('[Gist] Tam sistem yedeği başarıyla GitHub Gist üzerine kaydedildi (Token gizlendi).');
    addTerminalLog('[Gist] Tam sistem yedeği başarıyla GitHub Gist üzerine aktarıldı.', 'success');
    res.json({ 
      success: true, 
      gistId: finalGistId, 
      gistUrl: gistData.html_url,
      message: 'Tam sistem yedeği başarıyla GitHub Gist üzerine kaydedildi.' 
    });
  } catch (err) {
    console.error('[Gist Hata]: Push istisnası:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GitHub Gist üzerindeki sistem dosyalarını (db.json, channels.ini, vb.) indirir ve yerel veritabanıyla eşitler (Pull).
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
    const files = gistData.files || {};
    const rootDir = process.cwd();

    // 1. db.json (Yerel aktif token'ı koru)
    if (files['db.json'] && files['db.json'].content) {
      try {
        const parsedDb = JSON.parse(files['db.json'].content);
        const currentDb = readDb();
        if (parsedDb.settings) {
          parsedDb.settings.githubToken = token || (currentDb.settings || {}).githubToken;
          parsedDb.settings.githubGistId = gistId || (currentDb.settings || {}).githubGistId;
        }
        await fs.promises.writeFile(`${rootDir}/db.json`, JSON.stringify(parsedDb, null, 2), 'utf-8');
      } catch (e) {
        console.error('[Gist Pull Error] db.json ayrıştırılamadı:', e.message);
      }
    }

    // 2. channels.ini
    const chanFile = files['channels.ini'] || Object.values(files).find(f => f.filename && f.filename.endsWith('.ini'));
    if (chanFile && chanFile.content) {
      await fs.promises.writeFile(channelsIniPath, chanFile.content, 'utf-8');
    }

    // 3. categories.ini
    if (files['categories.ini'] && files['categories.ini'].content) {
      await fs.promises.writeFile(`${rootDir}/categories.ini`, files['categories.ini'].content, 'utf-8');
    }

    // 4. config ini
    const configFile = files['configwin.ini'] || files['configunix.ini'];
    if (configFile && configFile.content) {
      const cfgPath = `${rootDir}/${configFile.filename}`;
      await fs.promises.writeFile(cfgPath, configFile.content, 'utf-8');
    }

    const db = readDb();
    db.settings.githubToken = token;
    db.settings.githubGistId = gistId;
    syncWithIni(db);
    writeDb(db);

    broadcast('db_update', db);
    broadcast('status_log', { message: 'Sistem yedeği GitHub Gist üzerinden başarıyla güncellendi.', type: 'success' });
    console.log('[Gist] Tam sistem yedeği GitHub Gist üzerinden başarıyla çekildi.');
    addTerminalLog('[Gist] Tam sistem yedeği GitHub Gist üzerinden başarıyla içe aktarıldı.', 'success');

    res.json({ success: true, message: 'Sistem yedeği Gist üzerinden çekildi ve veriler güncellendi.' });
  } catch (err) {
    console.error('[Gist Hata]: Pull istisnası:', err.message);
    res.status(500).json({ error: err.message });
  }
});
