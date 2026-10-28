// Türkçe Açıklama: Fakap (otomatik kanal yedeği) API rotaları: liste, kanal aç/kapat, manuel tarama,
// silme, tümünü temizleme, oynatma, klasör seçme/açma.
// NOT: Fakap'ın kendi taraması yoktur; /scan mevcut RSS taramasını (triggerChannelCheck) tetikler.
import express from 'express';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { readDb, writeDb } from '../database.js';
import { broadcast } from '../services/sse.js';
import { localhostOnly } from '../middleware/security.js';
import {
  getFakapDir,
  getFakapSnapshot,
  setFakapChannel,
  deleteFakapVideo,
  resetFakap,
  ensureFakapDir,
  disableAllFakapChannels,
  enableAllFakapChannels
} from '../services/fakapService.js';
import { triggerChannelCheck } from '../services/rss.js';

export const router = express.Router();

/** Fakap listesi, ayarlar ve etkin kanal kimlikleri */
router.get('/list', localhostOnly, (req, res) => {
  res.json({ success: true, ...getFakapSnapshot() });
});

/** Bir kanal için Fakap aç/kapat */
router.post('/channel/:id', localhostOnly, async (req, res) => {
  const { id } = req.params;
  if (!/^UC[a-zA-Z0-9_-]{22}$/.test(id)) {
    return res.status(400).json({ error: 'Geçersiz Kanal ID formatı.' });
  }
  const db = readDb();
  if (!(db.channels || []).some(c => c.id === id)) {
    return res.status(404).json({ error: 'Kanal bulunamadı.' });
  }
  const enabled = req.body?.enabled === true || req.body?.enabled === 'true';
  await setFakapChannel(id, enabled);
  broadcast('db_update', readDb());
  // Fakap açıldığında mevcut RSS taramasını tetikle (yeni tarama motoru yok)
  if (enabled) {
    setTimeout(() => { triggerChannelCheck('fakap-enable').catch(() => {}); }, 1500);
  }
  res.json({ success: true, enabled });
});

/** Tüm kanallarda Fakap'ı açar (yalnızca bu andan sonraki videolar yedeklenir) */
router.post('/channels/enable-all', localhostOnly, async (req, res) => {
  try {
    const count = await enableAllFakapChannels();
    broadcast('db_update', readDb());
    res.json({ success: true, enabled: count });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

/** Tüm kanallarda Fakap'ı kapatır */
router.post('/channels/disable-all', localhostOnly, async (req, res) => {
  try {
    const count = await disableAllFakapChannels();
    broadcast('db_update', readDb());
    res.json({ success: true, disabled: count });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

/** Fakap ayarlarını (klasör, çözünürlük, saklama süresi) kaydeder */
router.post('/settings', localhostOnly, (req, res) => {
  const db = readDb();
  const body = req.body || {};

  if (body.fakapPath !== undefined) {
    const p = String(body.fakapPath || '').trim();
    if (p) {
      try {
        fs.mkdirSync(p, { recursive: true });
      } catch (e) {
        return res.status(400).json({ error: `Klasör oluşturulamadı: ${e.message}` });
      }
    }
    db.settings.fakapPath = p;
  }
  if (body.fakapQuality !== undefined) {
    const q = String(body.fakapQuality).replace(/p$/i, '');
    if (['144', '240', '360'].includes(q)) db.settings.fakapQuality = q;
  }
  if (body.fakapRetentionDays !== undefined) {
    const raw = body.fakapRetentionDays;
    if (raw === 'never') {
      db.settings.fakapRetentionDays = 'never';
    } else {
      const n = parseInt(raw, 10);
      db.settings.fakapRetentionDays = isNaN(n) ? 'never' : String(Math.max(1, Math.min(n, 30)));
    }
  }
  writeDb(db);
  ensureFakapDir(db);
  broadcast('db_update', db);
  res.json({ success: true, dir: getFakapDir(db) });
});

/** Mevcut RSS taramasını hemen başlatır (Fakap kancası aynı taramanın içindedir) */
router.post('/scan', localhostOnly, async (req, res) => {
  try {
    const result = await triggerChannelCheck('fakap-manual');
    res.json({ success: true, ...result, found: result?.newVideosCount || result?.found || 0 });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

/** Fakap'taki TÜM kayıtları ve dosyaları siler */
router.post('/reset', localhostOnly, async (req, res) => {
  try {
    const removed = await resetFakap();
    broadcast('db_update', readDb());
    res.json({ success: true, removed });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

/** Tek bir Fakap videosunu siler */
router.delete('/video/:id', localhostOnly, async (req, res) => {
  const raw = req.params.id;
  if (!/^(?:fakap_)?[A-Za-z0-9_-]{11}$/.test(raw)) return res.status(400).json({ error: 'Geçersiz video ID.' });
  const fullId = raw.startsWith('fakap_') ? raw : `fakap_${raw}`;
  const ok = await deleteFakapVideo(fullId);
  res.json({ success: ok });
});

function findVideo(id) {
  const db = readDb();
  const raw = String(id).replace(/^fakap_/, '');
  return (db.history || []).find(h => (h.isFakap || String(h.id).startsWith('fakap_')) &&
    (String(h.id) === String(id) || String(h.id) === `fakap_${raw}`)) || null;
}

/** Fakap videosunu (Range destekli) oynatır */
router.get('/stream/:id', localhostOnly, (req, res) => {
  const v = findVideo(req.params.id);
  if (!v || !v.filePath || !fs.existsSync(v.filePath)) return res.status(404).end();
  res.sendFile(path.resolve(v.filePath));
});

/** Fakap küçük resmi (yerel dosya yoksa YouTube'a yönlendirir) */
router.get('/thumb/:id', localhostOnly, (req, res) => {
  const v = findVideo(req.params.id);
  const raw = String(req.params.id).replace(/^fakap_/, '');
  if (v && v.filePath) {
    const base = v.filePath.slice(0, v.filePath.length - path.extname(v.filePath).length);
    for (const ext of ['.jpg', '.webp', '.png']) {
      if (fs.existsSync(base + ext)) return res.sendFile(path.resolve(base + ext));
    }
  }
  res.redirect(`https://i.ytimg.com/vi/${encodeURIComponent(raw)}/mqdefault.jpg`);
});

/** Fakap klasörü seçme diyaloğu (Windows) */
router.post('/select-folder', localhostOnly, (req, res) => {
  const db = readDb();
  const current = getFakapDir(db) || '';
  const escapedPath = current.replace(/'/g, "''");
  const psCommand = `powershell -NoProfile -STA -Command "Add-Type -AssemblyName System.Windows.Forms; $dialog = New-Object System.Windows.Forms.FolderBrowserDialog; $dialog.Description = 'Select Fakap folder'; $dialog.SelectedPath = '${escapedPath}'; $dialog.ShowNewFolderButton = $true; $form = New-Object System.Windows.Forms.Form; $form.TopMost = $true; $form.Opacity = 0; $form.Show(); $form.Activate(); $result = $dialog.ShowDialog($form); $form.Close(); if ($result -eq 'OK') { Write-Output $dialog.SelectedPath } else { Write-Output 'CANCEL' }"`;
  exec(psCommand, (err, stdout) => {
    if (err) return res.status(500).json({ error: 'Klasör seçim penceresi açılamadı.' });
    const selected = stdout.trim();
    if (selected && selected !== 'CANCEL') res.json({ success: true, path: selected });
    else res.json({ success: false });
  });
});

/** Fakap klasörünü dosya yöneticisinde açar */
router.post('/open-folder', localhostOnly, (req, res) => {
  const folder = ensureFakapDir(readDb()) || getFakapDir(readDb());
  if (!folder) return res.status(400).json({ error: 'Fakap klasörü tanımlı değil.' });
  if (process.platform === 'win32') exec(`explorer.exe "${path.resolve(folder)}"`);
  else if (process.platform === 'darwin') exec(`open "${folder}"`);
  else exec(`xdg-open "${folder}"`);
  res.json({ success: true });
});
