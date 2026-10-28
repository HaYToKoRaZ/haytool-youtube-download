// Türkçe Açıklama: Veritabanı bakım servisi. db.json'un sınırsız şişmesini önler.
// Sadece "ignored" (görüldü ama indirilmedi) kayıtları budar; indirilen (completed), hatalı (failed)
// ve bekleyen (waiting/downloading) kayıtlara ASLA dokunmaz.
// Güvenlik kuralı: kanal başına tutulan kayıt sayısı her zaman RSS besleme penceresinden büyüktür,
// böylece silinen bir kayıt beslemede tekrar görünüp "yeni video" sanılamaz.
import { readDb, updateDb } from '../database.js';
import { addTerminalLog } from './sse.js';

const PRUNE_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 saat
const START_DELAY_MS = 45 * 1000;
const MIN_KEEP_PER_CHANNEL = 30;
const GRACE_DAYS = 7;

// ignored kaydından atılan AĞIR alanlar. Bunlar dışındaki her alan KORUNUR (örn. hidden,
// lastWatchedAt, isStandalone) — çünkü gizleme ve izleme durumu kütüphane görünümünü etkiler.
const IGNORED_DROP_FIELDS = ['thumbnail', 'filePath', 'fileSize', 'speed', 'eta', 'progress', 'error', 'resolveAttempts'];

let pruneTimer = null;
let startTimer = null;

/**
 * Kanal başına tutulacak ignored kayıt sayısı. RSS penceresinin en az 3 katı olacak şekilde
 * ve kullanıcı ayarından (historyLimitPerChannel) küçük olmayacak şekilde hesaplanır.
 */
export function resolveKeepPerChannel(db) {
  const rssLimit = Math.max(1, parseInt(db?.settings?.rssLimit, 10) || 15);
  const userLimit = parseInt(db?.settings?.historyLimitPerChannel, 10) || MIN_KEEP_PER_CHANNEL;
  return Math.max(MIN_KEEP_PER_CHANNEL, userLimit, rssLimit * 3);
}

function slimIgnored(rec) {
  const out = { ...rec };
  for (const key of IGNORED_DROP_FIELDS) delete out[key];
  return out;
}

/**
 * Budama planını hesaplar (yan etkisiz). Test edilebilir olması için ayrı tutuldu.
 * @returns {{history: Array, removed: number, slimmed: number, keepPerChannel: number}}
 */
export function computePrunePlan(db, now = Date.now()) {
  const keepPerChannel = resolveKeepPerChannel(db);
  const graceMs = GRACE_DAYS * 86400000;
  const groups = new Map();
  const keep = [];

  for (const item of (db.history || [])) {
    if (!item || item.status !== 'ignored') {
      keep.push(item);
      continue;
    }
    const key = item.channelId || '__none__';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  }

  let removed = 0;
  let slimmed = 0;

  for (const list of groups.values()) {
    // Yeniden eskiye sırala (tarih yoksa en eski kabul edilir)
    list.sort((a, b) => {
      const da = new Date(a.downloadedAt || a.publishedAt || 0).getTime() || 0;
      const db_ = new Date(b.downloadedAt || b.publishedAt || 0).getTime() || 0;
      return db_ - da;
    });

    list.forEach((item, index) => {
      const stamp = new Date(item.downloadedAt || item.publishedAt || 0).getTime() || 0;
      const isFresh = stamp > 0 && (now - stamp) < graceMs;

      if (index >= keepPerChannel && !isFresh) {
        removed++;
        return; // at
      }
      const slim = slimIgnored(item);
      if (Object.keys(item).length !== Object.keys(slim).length) slimmed++;
      keep.push(slim);
    });
  }

  return { history: keep, removed, slimmed, keepPerChannel };
}

/**
 * Budamayı şimdi uygular ve özet döner.
 */
export async function pruneHistoryNow() {
  let summary = { removed: 0, slimmed: 0, before: 0, after: 0, keepPerChannel: 0 };
  try {
    summary = await updateDb((db) => {
      const before = (db.history || []).length;
      const plan = computePrunePlan(db);
      if (plan.removed === 0 && plan.slimmed === 0) {
        return { removed: 0, slimmed: 0, before, after: before, keepPerChannel: plan.keepPerChannel };
      }
      db.history = plan.history;
      return {
        removed: plan.removed,
        slimmed: plan.slimmed,
        before,
        after: db.history.length,
        keepPerChannel: plan.keepPerChannel
      };
    });
  } catch (e) {
    console.error('[Bakım] Geçmiş budama hatası:', e.message);
    return summary;
  }

  if (summary.removed > 0 || summary.slimmed > 0) {
    addTerminalLog(`[Bakım] Geçmiş budandı: ${summary.removed} eski "görüldü" kaydı silindi, ${summary.slimmed} kayıt sadeleştirildi (${summary.before} → ${summary.after}).`, 'info');
  }
  return summary;
}

/**
 * Bakım zamanlayıcısını başlatır (sunucu açılışında bir kez).
 */
export function startMaintenanceService() {
  if (pruneTimer || startTimer) return;
  startTimer = setTimeout(async () => {
    startTimer = null;
    await pruneHistoryNow();
    pruneTimer = setInterval(() => { pruneHistoryNow().catch(() => {}); }, PRUNE_INTERVAL_MS);
  }, START_DELAY_MS);
}
