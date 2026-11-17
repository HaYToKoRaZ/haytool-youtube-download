// Türkçe Açıklama: Yerleşik Node.js SQLite (node:sqlite) motoru üzerinden WAL modlu veritabanı depolama ve atomik yazma katmanı.
import fs from 'fs';
import path from 'path';
import { DatabaseSync, backup as sqliteNativeBackup } from 'node:sqlite';
import { dataRootDir } from '../config.js';

let _db = null;
let _openedPath = null;

/**
 * Aktif SQLite veritabanı dosya yolunu döndürür.
 * @returns {string}
 */
export function getSqliteDbPath() {
  return path.join(process.env.HAYTOOL_DATA_DIR || dataRootDir, 'haytool.db');
}

/**
 * SQLite veritabanı bağlantısını WAL modunda açar veya mevcut bağlantıyı döndürür.
 * Testlerde HAYTOOL_DATA_DIR değişirse eski bağlantıyı kapatıp yenisini açar.
 * @returns {DatabaseSync}
 */
export function getSqliteConnection() {
  const targetPath = getSqliteDbPath();
  if (_db && _openedPath === targetPath) {
    return _db;
  }

  if (_db) {
    try { _db.close(); } catch (_) {}
    _db = null;
  }

  const dir = path.dirname(targetPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const conn = new DatabaseSync(targetPath, { timeout: 10000 });
  conn.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA synchronous = NORMAL;
    PRAGMA foreign_keys = ON;
    PRAGMA temp_store = MEMORY;
    PRAGMA busy_timeout = 10000;

    CREATE TABLE IF NOT EXISTS channels (
      id TEXT PRIMARY KEY,
      sort_order INTEGER NOT NULL DEFAULT 0,
      name TEXT NOT NULL DEFAULT '',
      handle TEXT NOT NULL DEFAULT '',
      added_at TEXT NOT NULL DEFAULT '',
      category_id INTEGER NOT NULL DEFAULT 1,
      json_extra TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS history (
      id TEXT PRIMARY KEY,
      sort_order INTEGER NOT NULL DEFAULT 0,
      video_id TEXT NOT NULL DEFAULT '',
      channel_id TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'ignored',
      published_at TEXT NOT NULL DEFAULT '',
      downloaded_at TEXT NOT NULL DEFAULT '',
      deleted_flag INTEGER NOT NULL DEFAULT 0,
      file_path TEXT NOT NULL DEFAULT '',
      json_extra TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_history_status ON history(status);
    CREATE INDEX IF NOT EXISTS idx_history_channel ON history(channel_id);
    CREATE INDEX IF NOT EXISTS idx_history_published ON history(published_at);
    CREATE INDEX IF NOT EXISTS idx_history_sort ON history(sort_order);

    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value_json TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS deleted_videos (
      row_key TEXT PRIMARY KEY,
      sort_order INTEGER NOT NULL DEFAULT 0,
      video_id TEXT NOT NULL DEFAULT '',
      deleted_at TEXT NOT NULL DEFAULT '',
      reason TEXT NOT NULL DEFAULT 'manual',
      json_extra TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_deleted_sort ON deleted_videos(sort_order);

    CREATE TABLE IF NOT EXISTS kv_extra (
      key TEXT PRIMARY KEY,
      value_json TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  _db = conn;
  _openedPath = targetPath;
  return _db;
}

/**
 * Açık SQLite bağlantısını güvenle kapatır (test temizliği veya kapatma anı).
 */
export function closeSqliteConnection() {
  if (_db) {
    try { _db.close(); } catch (_) {}
    _db = null;
    _openedPath = null;
  }
}

/**
 * Tek bir SQLite meta anahtarını okur.
 * @param {string} key
 * @returns {string|null}
 */
export function getMetaValue(key) {
  const conn = getSqliteConnection();
  const row = conn.prepare('SELECT value FROM meta WHERE key = ?').get(key);
  return row ? row.value : null;
}

/**
 * Tek bir SQLite meta anahtarını yazar/günceller.
 * @param {string} key
 * @param {string} value
 */
export function setMetaValue(key, value) {
  const conn = getSqliteConnection();
  conn.prepare('INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(key, String(value));
}

/**
 * İlk kurulumda boş SQLite veritabanını varsayılan şema ile başlatır.
 *
 * @param {object} opts
 * @param {object} opts.defaultDb
 * @param {Function} opts.prepareDbForDisk
 * @returns {boolean} İlk kez başlatıldıysa true
 */
export function ensureSqliteInitialized({ defaultDb, prepareDbForDisk }) {
  const conn = getSqliteConnection();
  const alreadyInit = getMetaValue('initialized_at');
  if (alreadyInit) return false;

  const chCount = conn.prepare('SELECT COUNT(*) AS cnt FROM channels').get().cnt;
  const histCount = conn.prepare('SELECT COUNT(*) AS cnt FROM history').get().cnt;
  const setCount = conn.prepare('SELECT COUNT(*) AS cnt FROM settings').get().cnt;

  const nowIso = new Date().toISOString();
  if (chCount > 0 || histCount > 0 || setCount > 0) {
    setMetaValue('schema_version', '1');
    setMetaValue('initialized_at', nowIso);
    return false;
  }

  const initialPayload = JSON.parse(JSON.stringify(defaultDb));
  saveFullDbToSqlite(initialPayload, prepareDbForDisk, { skipWipeGuard: true });

  setMetaValue('schema_version', '1');
  setMetaValue('initialized_at', nowIso);
  return true;
}

/**
 * Veritabanındaki tüm tabloları uygulama içi JS veritabanı yapısında bellek nesnesine yükler.
 *
 * @param {object} defaultDb
 * @param {Function} decryptSecret
 * @param {Array<string>} sensitiveKeys
 * @returns {object}
 */
export function loadFullDbFromSqlite(defaultDb, decryptSecret, sensitiveKeys = []) {
  const conn = getSqliteConnection();

  const result = {
    channels: [],
    history: [],
    categories: [],
    settings: { ...(defaultDb.settings || {}) },
    deletedVideos: []
  };

  const extraRows = conn.prepare('SELECT key, value_json FROM kv_extra').all();
  for (const row of extraRows) {
    try {
      result[row.key] = JSON.parse(row.value_json);
    } catch (_) {}
  }

  const channelRows = conn.prepare('SELECT json_extra FROM channels ORDER BY sort_order ASC, rowid ASC').all();
  for (const row of channelRows) {
    try {
      result.channels.push(JSON.parse(row.json_extra));
    } catch (_) {}
  }

  const historyRows = conn.prepare('SELECT json_extra FROM history ORDER BY sort_order ASC, rowid ASC').all();
  for (const row of historyRows) {
    try {
      result.history.push(JSON.parse(row.json_extra));
    } catch (_) {}
  }

  const categoryRows = conn.prepare('SELECT id, name FROM categories ORDER BY id ASC').all();
  for (const row of categoryRows) {
    result.categories.push({ id: row.id, name: row.name });
  }
  if (result.categories.length === 0 && Array.isArray(defaultDb.categories)) {
    result.categories = defaultDb.categories.map(c => ({ ...c }));
  }

  const settingRows = conn.prepare('SELECT key, value_json FROM settings').all();
  for (const row of settingRows) {
    try {
      let parsedVal = JSON.parse(row.value_json);
      if (typeof parsedVal === 'string' && sensitiveKeys.includes(row.key) && decryptSecret) {
        parsedVal = decryptSecret(parsedVal);
      }
      result.settings[row.key] = parsedVal;
    } catch (_) {}
  }

  const deletedRows = conn.prepare('SELECT json_extra FROM deleted_videos ORDER BY sort_order ASC, rowid ASC').all();
  for (const row of deletedRows) {
    try {
      result.deletedVideos.push(JSON.parse(row.json_extra));
    } catch (_) {}
  }

  return result;
}

/**
 * Toplu veri kaybı / yanlışlıkla sıfırlama koruyucusu (SQLite sürümü).
 * @param {object} incomingData
 */
export function guardAgainstMassWipeSqlite(incomingData) {
  try {
    const conn = getSqliteConnection();
    const prevChannels = conn.prepare('SELECT COUNT(*) AS cnt FROM channels').get().cnt;
    const prevHistory = conn.prepare('SELECT COUNT(*) AS cnt FROM history').get().cnt;

    const nextChannels = Array.isArray(incomingData?.channels) ? incomingData.channels.length : 0;
    const nextHistory = Array.isArray(incomingData?.history) ? incomingData.history.length : 0;

    if ((prevChannels >= 3 && nextChannels === 0) || (prevHistory >= 10 && nextHistory === 0)) {
      const dbFile = getSqliteDbPath();
      if (fs.existsSync(dbFile)) {
        const emergencyBackup = path.join(path.dirname(dbFile), `haytool.pre_wipe.${Date.now()}.db`);
        try { fs.copyFileSync(dbFile, emergencyBackup); } catch (_) {}
        const walFile = `${dbFile}-wal`;
        if (fs.existsSync(walFile)) {
          try { fs.copyFileSync(walFile, `${emergencyBackup}-wal`); } catch (_) {}
        }
        console.warn(
          `[Sanity Guard] ⚠️ Ani veri azalması tespit edildi (Kanallar: ${prevChannels}->${nextChannels}, Geçmiş: ${prevHistory}->${nextHistory}). Acil durum yedeği alındı: ${path.basename(emergencyBackup)}`
        );
      }
    }
  } catch (_) {}
}

/**
 * Tüm veritabanı nesnesini tek bir atomik IMMEDIATE SQLite transaction içinde kaydeder.
 *
 * @param {object} data
 * @param {Function} prepareDbForDisk - Hassas ayarları şifreleyip temiz kopya üreten fonksiyon
 * @param {object} [options]
 * @param {boolean} [options.skipWipeGuard=false]
 */
export function saveFullDbToSqlite(data, prepareDbForDisk, options = {}) {
  const conn = getSqliteConnection();
  if (!options.skipWipeGuard) {
    guardAgainstMassWipeSqlite(data);
  }

  const safeData = prepareDbForDisk ? prepareDbForDisk(data) : data;
  const knownTopKeys = new Set(['channels', 'history', 'categories', 'settings', 'deletedVideos']);

  conn.exec('BEGIN IMMEDIATE');
  try {
    conn.exec('DELETE FROM channels');
    conn.exec('DELETE FROM history');
    conn.exec('DELETE FROM categories');
    conn.exec('DELETE FROM settings');
    conn.exec('DELETE FROM deleted_videos');
    conn.exec('DELETE FROM kv_extra');

    const insertChannel = conn.prepare(
      'INSERT OR REPLACE INTO channels (id, sort_order, name, handle, added_at, category_id, json_extra) VALUES (?, ?, ?, ?, ?, ?, ?)'
    );
    const channels = Array.isArray(safeData.channels) ? safeData.channels : [];
    for (let i = 0; i < channels.length; i++) {
      const ch = channels[i];
      if (!ch || !ch.id) continue;
      insertChannel.run(
        String(ch.id),
        i,
        String(ch.name || ''),
        String(ch.handle || ''),
        String(ch.addedAt || ''),
        Number.isFinite(Number(ch.categoryId)) ? Number(ch.categoryId) : 1,
        JSON.stringify(ch)
      );
    }

    const insertHistory = conn.prepare(
      'INSERT OR REPLACE INTO history (id, sort_order, video_id, channel_id, status, published_at, downloaded_at, deleted_flag, file_path, json_extra) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    );
    const history = Array.isArray(safeData.history) ? safeData.history : [];
    for (let i = 0; i < history.length; i++) {
      const item = history[i];
      if (!item || !item.id) continue;
      insertHistory.run(
        String(item.id),
        i,
        String(item.id),
        String(item.channelId || ''),
        String(item.status || 'ignored'),
        String(item.publishedAt || ''),
        String(item.downloadedAt || ''),
        item.deleted ? 1 : 0,
        String(item.filePath || ''),
        JSON.stringify(item)
      );
    }

    const insertCat = conn.prepare('INSERT OR REPLACE INTO categories (id, name) VALUES (?, ?)');
    const categories = Array.isArray(safeData.categories) ? safeData.categories : [];
    for (const cat of categories) {
      if (!cat || cat.id === undefined) continue;
      insertCat.run(Number(cat.id), String(cat.name || ''));
    }

    const insertSetting = conn.prepare('INSERT OR REPLACE INTO settings (key, value_json) VALUES (?, ?)');
    const settingsObj = safeData.settings && typeof safeData.settings === 'object' ? safeData.settings : {};
    for (const [k, v] of Object.entries(settingsObj)) {
      if (v === undefined || typeof v === 'function') continue;
      insertSetting.run(String(k), JSON.stringify(v));
    }

    const insertDeleted = conn.prepare(
      'INSERT OR REPLACE INTO deleted_videos (row_key, sort_order, video_id, deleted_at, reason, json_extra) VALUES (?, ?, ?, ?, ?, ?)'
    );
    const deletedVideos = Array.isArray(safeData.deletedVideos) ? safeData.deletedVideos : [];
    for (let i = 0; i < deletedVideos.length; i++) {
      const entry = deletedVideos[i];
      if (!entry || typeof entry !== 'object') continue;
      const rowKey = String(entry.id || entry.videoId || `del_${i}`);
      insertDeleted.run(
        rowKey,
        i,
        String(entry.id || entry.videoId || ''),
        String(entry.deletedAt || ''),
        String(entry.deleteReason || 'manual'),
        JSON.stringify(entry)
      );
    }

    const insertExtra = conn.prepare('INSERT OR REPLACE INTO kv_extra (key, value_json) VALUES (?, ?)');
    for (const [k, v] of Object.entries(safeData)) {
      if (knownTopKeys.has(k) || v === undefined || typeof v === 'function') continue;
      insertExtra.run(String(k), JSON.stringify(v));
    }

    conn.exec('COMMIT');
  } catch (err) {
    try { conn.exec('ROLLBACK'); } catch (_) {}
    throw err;
  }
}

/**
 * Tekil bir history kaydını tüm veritabanını yeniden serileştirmeden indeksli olarak günceller (<1ms).
 *
 * @param {object} item - Güncellenmiş video geçmişi nesnesi
 * @returns {boolean}
 */
export function upsertHistoryItemInSqlite(item) {
  if (!item || !item.id) return false;
  const conn = getSqliteConnection();
  const id = String(item.id);
  const existing = conn.prepare('SELECT sort_order FROM history WHERE id = ?').get(id);
  let sortOrder;
  if (existing) {
    sortOrder = existing.sort_order;
  } else {
    const minRow = conn.prepare('SELECT COALESCE(MIN(sort_order), 1) AS min_order FROM history').get();
    sortOrder = (minRow?.min_order ?? 1) - 1;
  }

  conn.prepare(`
    INSERT INTO history (id, sort_order, video_id, channel_id, status, published_at, downloaded_at, deleted_flag, file_path, json_extra)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      video_id = excluded.video_id,
      channel_id = excluded.channel_id,
      status = excluded.status,
      published_at = excluded.published_at,
      downloaded_at = excluded.downloaded_at,
      deleted_flag = excluded.deleted_flag,
      file_path = excluded.file_path,
      json_extra = excluded.json_extra
  `).run(
    id,
    sortOrder,
    id,
    String(item.channelId || ''),
    String(item.status || 'ignored'),
    String(item.publishedAt || ''),
    String(item.downloadedAt || ''),
    item.deleted ? 1 : 0,
    String(item.filePath || ''),
    JSON.stringify(item)
  );
  return true;
}

/**
 * Silinen video kaydını tekil olarak deleted_videos tablosuna ekler.
 * @param {object} entry
 * @returns {boolean}
 */
export function upsertDeletedVideoInSqlite(entry) {
  if (!entry || typeof entry !== 'object') return false;
  const conn = getSqliteConnection();
  const rowKey = String(entry.id || entry.videoId || `del_${Date.now()}`);
  const minRow = conn.prepare('SELECT COALESCE(MIN(sort_order), 1) AS min_order FROM deleted_videos').get();
  const sortOrder = (minRow?.min_order ?? 1) - 1;

  conn.prepare(`
    INSERT INTO deleted_videos (row_key, sort_order, video_id, deleted_at, reason, json_extra)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(row_key) DO UPDATE SET
      sort_order = excluded.sort_order,
      deleted_at = excluded.deleted_at,
      reason = excluded.reason,
      json_extra = excluded.json_extra
  `).run(
    rowKey,
    sortOrder,
    String(entry.id || entry.videoId || ''),
    String(entry.deletedAt || ''),
    String(entry.deleteReason || 'manual'),
    JSON.stringify(entry)
  );
  conn.exec(`
    DELETE FROM deleted_videos
    WHERE row_key NOT IN (
      SELECT row_key FROM deleted_videos ORDER BY sort_order ASC, rowid ASC LIMIT 100
    )
  `);
  return true;
}

/**
 * Yerleşik Online SQLite Backup API kullanarak haytool.db yedeği alır.
 * @param {string} destPath
 * @returns {Promise<number>}
 */
export async function backupSqliteDatabase(destPath) {
  const conn = getSqliteConnection();
  return sqliteNativeBackup(conn, destPath);
}
