// Türkçe Açıklama: Fakap (otomatik kanal yedeği) servisi.
// ÖNEMLİ MİMARİ NOTU: Fakap'ın KENDİ tarama ve indirme motoru YOKTUR.
// Yeni videolar mevcut RSS taramasında (rss.js -> checkSingleChannelRss) yakalanır ve kanalda Fakap açıksa
// ana indirme kuyruğuna `fakap_<videoId>` olarak eklenir; indirmeyi downloader.js yapar
// (düşük öncelik + ayarlardaki Fakap klasörü + Fakap çözünürlüğü).
// Bu servis yalnızca kayıt sahipliğini (db.history içindeki fakap_ kayıtları), saklama süresi temizliğini,
// klasör yönetimini ve arayüz listesini üstlenir. Böylece tek tarama, tek kuyruk, tek kayıt kaynağı olur.
// NOT: Tüm yazma işlemleri db.updateDb() üzerinden yapılır; kilit zaten alındığı için writeDb() çağrılmaz.
import fs from 'fs';
import path from 'path';
import { readDb, updateDb } from '../database.js';
import { addTerminalLog } from './sse.js';
import { physicallyDeleteVideoFiles } from './autoDeleteService.js';
import { registerFakapDirGetter } from './fakapPaths.js';

const VALID_QUALITIES = ['144', '240', '360'];
const CLEANUP_INTERVAL_MS = 30 * 60 * 1000;

let cleanupTimer = null;
let startTimer = null;

/**
 * Fakap kayıt yapısını (db.fakap) garanti eder.
 */
function ensureFakapState(db) {
  if (!db.fakap || typeof db.fakap !== 'object') db.fakap = {};
  if (!Array.isArray(db.fakap.channelIds)) db.fakap.channelIds = [];
  if (!db.fakap.enabledAt || typeof db.fakap.enabledAt !== 'object') db.fakap.enabledAt = {};
  return db.fakap;
}

/**
 * Fakap ana klasörünü döner. Özel yol seçilmemişse [İndirme Klasörü]/Fakap kullanılır.
 */
export function getFakapDir(db = readDb()) {
  const custom = (db.settings?.fakapPath || '').trim();
  if (custom) return custom;
  const base = db.settings?.downloadPath || '';
  return base ? path.join(base, 'Fakap') : '';
}

registerFakapDirGetter(() => getFakapDir(readDb()));

export function getFakapQuality(db = readDb()) {
  const q = String(db.settings?.fakapQuality || '144').replace(/p$/i, '');
  return VALID_QUALITIES.includes(q) ? q : '144';
}

export function getRetentionDays(db) {
  const raw = db.settings?.fakapRetentionDays;
  if (raw === undefined || raw === null || raw === 'never') return 0;
  const n = parseInt(raw, 10);
  if (isNaN(n) || n < 1) return 0;
  return Math.min(n, 30);
}

/**
 * Fakap klasörünü (gerekiyorsa) oluşturur. Boş olsa da klasör var olur.
 */
export function ensureFakapDir(db = readDb()) {
  const dir = getFakapDir(db);
  if (!dir) return '';
  try {
    fs.mkdirSync(dir, { recursive: true });
    return dir;
  } catch (e) {
    if (e && e.code !== 'EEXIST') addTerminalLog(`[Fakap] Klasör oluşturulamadı: ${e.message}`, 'warning');
    return '';
  }
}

/**
 * Bir geçmiş kaydının Fakap kaydı olup olmadığını döner.
 */
function isFakapItem(item) {
  if (!item) return false;
  return item.isFakap === true || String(item.id || '').startsWith('fakap_');
}

/**
 * Kuyruk durumlarını Fakap arayüzünün beklediği değerlere çevirir.
 */
function mapStatus(status) {
  switch (status) {
    case 'completed': return 'completed';
    case 'downloading':
    case 'merging': return 'downloading';
    case 'failed': return 'failed';
    case 'ignored': return 'failed';
    case 'waiting': return 'queued';
    default: return 'queued';
  }
}

/**
 * Arayüz için Fakap video listesini ve ayarları döner.
 * Tek kaynak: db.history içindeki fakap_ kayıtları.
 */
export function getFakapSnapshot() {
  const db = readDb();
  ensureFakapState(db);
  const videos = (db.history || [])
    .filter(isFakapItem)
    .map(v => ({
      id: v.id,
      originalId: v.originalId || String(v.id || '').replace(/^fakap_/, ''),
      title: v.title || '',
      channelId: v.channelId || '',
      channelName: v.channelName || '',
      publishedAt: v.publishedAt || '',
      status: mapStatus(v.status),
      progress: v.status === 'completed' ? 100 : (Number(v.progress) || 0),
      speed: v.speed || '',
      eta: v.eta || '',
      filePath: v.filePath || '',
      fileSize: v.fileSize || '',
      downloadedAt: v.downloadedAt || '',
      quality: v.actualQuality || v.quality || '',
      error: v.error || ''
    }));
  return {
    dir: getFakapDir(db),
    quality: getFakapQuality(db),
    retentionDays: getRetentionDays(db),
    channelIds: (db.fakap?.channelIds || []),
    videos
  };
}

/**
 * Bir kanal için Fakap'ı açar/kapatır. Açıldığı andan itibaren yayınlanan videolar yedeklenir.
 */
export async function setFakapChannel(channelId, enabled) {
  await updateDb((db) => {
    const state = ensureFakapState(db);
    const has = state.channelIds.includes(channelId);
    if (enabled && !has) {
      state.channelIds.push(channelId);
      state.enabledAt[channelId] = new Date().toISOString();
    } else if (!enabled && has) {
      state.channelIds = state.channelIds.filter(id => id !== channelId);
      delete state.enabledAt[channelId];
    }
  });
}

/**
 * Tüm kanallarda Fakap'ı açar. Açılma anı tek zaman damgası olarak yazılır;
 * böylece yalnızca bu andan SONRA yayınlanan videolar yedeklenir.
 */
export async function enableAllFakapChannels() {
  return await updateDb((db) => {
    const state = ensureFakapState(db);
    const nowIso = new Date().toISOString();
    const ids = (db.channels || []).map(c => c.id).filter(Boolean);
    state.channelIds = ids;
    state.enabledAt = {};
    for (const id of ids) state.enabledAt[id] = nowIso;
    return ids.length;
  });
}

/**
 * Tüm kanallarda Fakap'ı kapatır.
 */
export async function disableAllFakapChannels() {
  return await updateDb((db) => {
    const state = ensureFakapState(db);
    const count = state.channelIds.length;
    state.channelIds = [];
    state.enabledAt = {};
    return count;
  });
}

/**
 * Tek bir Fakap kaydını (ve dosyasını) siler.
 */
export async function deleteFakapVideo(videoId) {
  const target = await updateDb((db) => {
    const state = ensureFakapState(db);
    const found = (db.history || []).find(h => isFakapItem(h) && String(h.id) === String(videoId)) || null;
    if (found) {
      db.history = db.history.filter(h => h.id !== found.id);
      // Mezar taşı: silinen yedek, RSS/Fakap taraması tarafından yeniden kuyruğa alınmasın.
      if (!Array.isArray(state.deletedIds)) state.deletedIds = [];
      const raw = found.originalId || String(found.id).replace(/^fakap_/, '');
      if (raw && !state.deletedIds.includes(raw)) {
        state.deletedIds.push(raw);
        if (state.deletedIds.length > 800) state.deletedIds = state.deletedIds.slice(-800);
      }
    }
    return found;
  });
  if (!target) return false;
  removeVideoFiles(target);
  return true;
}

/**
 * Fakap'taki TÜM kayıtları ve dosyaları siler (kuyruktakiler dahil).
 */
export async function resetFakap() {
  const removed = await updateDb((db) => {
    const state = ensureFakapState(db);
    const items = (db.history || []).filter(isFakapItem);
    db.history = (db.history || []).filter(h => !isFakapItem(h));
    state.deletedIds = [];
    return items;
  });
  for (const item of removed) removeVideoFiles(item);
  addTerminalLog(`[Fakap] ${removed.length} kayıt ve dosya temizlendi.`, 'info');
  return removed.length;
}

function removeVideoFiles(video) {
  if (!video || !video.filePath) return;
  try {
    physicallyDeleteVideoFiles({ id: video.id, title: video.title, filePath: video.filePath });
  } catch (e) {}
  try {
    const dir = path.dirname(video.filePath);
    if (fs.existsSync(dir) && fs.readdirSync(dir).length === 0) fs.rmdirSync(dir);
  } catch (e) {}
}

/**
 * Saklama süresi dolan / dosyası kaybolmuş Fakap kayıtlarını temizler.
 */
export async function cleanupExpired() {
  const days = getRetentionDays(readDb());
  const now = Date.now();

  const removed = await updateDb((db) => {
    const toRemove = [];
    for (const v of (db.history || [])) {
      if (!isFakapItem(v) || v.status !== 'completed') continue;
      const missing = !v.filePath || !fs.existsSync(v.filePath);
      // Saklama süresi dosyanın GERÇEK indirilme zamanından (mtime) hesaplanır.
      let doneMs = 0;
      if (!missing) {
        try { doneMs = fs.statSync(v.filePath).mtimeMs; } catch (e) { doneMs = 0; }
      }
      if (!doneMs && v.downloadedAt) doneMs = new Date(v.downloadedAt).getTime();
      const expired = days > 0 && doneMs > 0 && (now - doneMs) > days * 86400000;
      if (missing || expired) toRemove.push(v);
    }
    if (toRemove.length === 0) return [];
    const ids = new Set(toRemove.map(v => v.id));
    db.history = db.history.filter(h => !ids.has(h.id));
    return toRemove;
  });

  if (!removed || removed.length === 0) return 0;
  for (const v of removed) removeVideoFiles(v);
  addTerminalLog(`[Fakap] ${removed.length} eski yedek kaydı temizlendi (saklama: ${days > 0 ? days + ' gün' : 'asla'}).`, 'info');
  return removed.length;
}

/**
 * Artık var olmayan kanalların Fakap kayıtlarını temizler.
 */
export async function pruneMissingChannels() {
  return await updateDb((db) => {
    const state = ensureFakapState(db);
    const liveIds = new Set((db.channels || []).map(c => c.id));
    const before = state.channelIds.length;
    state.channelIds = state.channelIds.filter(id => liveIds.has(id));
    for (const id of Object.keys(state.enabledAt)) {
      if (!liveIds.has(id)) delete state.enabledAt[id];
    }
    return before - state.channelIds.length;
  });
}

/**
 * Fakap bakım zamanlayıcısını başlatır (sunucu açılışında bir kez çağrılır).
 * NOT: Tarama YAPMAZ; tarama mevcut RSS döngüsünün işidir.
 */
export function startFakapService() {
  if (cleanupTimer || startTimer) return;
  startTimer = setTimeout(async () => {
    startTimer = null;
    try {
      ensureFakapDir();
      await pruneMissingChannels();
      await cleanupExpired();
    } catch (e) {
      console.error('[Fakap] Bakım hatası:', e.message);
    }
    cleanupTimer = setInterval(async () => {
      try {
        ensureFakapDir();
        await cleanupExpired();
      } catch (e) {}
    }, CLEANUP_INTERVAL_MS);
  }, 20 * 1000);
}
