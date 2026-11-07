// Türkçe Açıklama: İndirilenler sekmesi ve yerleşik oynatıcı yan listesi (inline-player-sidebar) için
// ortak kullanıcı sıralaması, güvenli alt-küme birleştirme, sunucu kalıcılığı ve otomatik geçiş yardımcı modülü.
// Description: Shared user-defined ordering, safe subset merging, server persistence, and autoplay playlist module.

import { parseSizeToBytes, getVideoRemainingInfo } from '../utils/helpers.js';

const STORAGE_KEY = 'downloaded-user-order';
let syncMigrationDone = false;

/**
 * Kullanıcı tanımlı video sıralama dizisini döner.
 * Öncelik sunucu veritabanındaki (`localDb.settings.downloadedUserOrder`) dizidedir;
 * sunucuda henüz kayıt yoksa `localStorage` okunur ve arka planda sunucuya taşınır.
 *
 * @param {object} [db] - Veritabanı nesnesi (varsayılan window.localDb)
 * @returns {string[]} Sıralı video ID dizisi
 */
export function getDownloadedUserOrder(db = window.localDb) {
  let localArr = [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) localArr = parsed.filter(id => typeof id === 'string' && id);
    }
  } catch (_) {}

  const serverArr = Array.isArray(db?.settings?.downloadedUserOrder)
    ? db.settings.downloadedUserOrder.filter(id => typeof id === 'string' && id)
    : [];

  if (serverArr.length > 0) {
    // localStorage'ı da güncel tut
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(serverArr));
    } catch (_) {}
    return serverArr;
  }

  if (localArr.length > 0 && !syncMigrationDone && db?.settings) {
    syncMigrationDone = true;
    db.settings.downloadedUserOrder = localArr;
    fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ downloadedUserOrder: localArr })
    }).catch(() => {});
  }

  return localArr;
}

/**
 * Ekranda görünen (filtrelenmiş olabilen) video ID listesinin yeni sırasını,
 * tüm videoların mevcut sırasıyla güvenli biçimde birleştirir ve kaydeder.
 * Böylece kanal/arama/Shorts filtresi açıkken sıralama yapıldığında filtre dışındaki videoların sırası silinmez.
 *
 * @param {string[]} visibleOrderedIds - Kullanıcının ekranda oluşturduğu yeni ID sırası
 * @param {object} [db] - Veritabanı nesnesi (varsayılan window.localDb)
 * @returns {string[]} Birleştirilmiş tam sıra dizisi
 */
export function saveDownloadedUserOrder(visibleOrderedIds, db = window.localDb) {
  const cleanVisible = (Array.isArray(visibleOrderedIds) ? visibleOrderedIds : [])
    .filter(id => typeof id === 'string' && id);
  const currentFull = getDownloadedUserOrder(db);

  // Eğer mevcut tam sıra henüz boşsa, tüm tamamlanmış videoları mevcut tarih sırasıyla temel al
  let baseOrder = currentFull.slice();
  if (baseOrder.length === 0 && Array.isArray(db?.history)) {
    const completed = db.history
      .filter(h => h.status === 'completed')
      .slice()
      .sort((a, b) => {
        const dA = new Date(a.publishedAt || a.downloadedAt || 0).getTime();
        const dB = new Date(b.publishedAt || b.downloadedAt || 0).getTime();
        return dB - dA;
      });
    baseOrder = completed.map(h => h.id);
  }

  const visibleSet = new Set(cleanVisible);

  // baseOrder içinde görünür kümede olmayanların konumlarını koruyarak görünür kümenin yeni sırasını yerleştir
  const merged = [];
  let visibleIdx = 0;
  const seen = new Set();

  for (const id of baseOrder) {
    if (visibleSet.has(id)) {
      if (visibleIdx < cleanVisible.length) {
        const nextVis = cleanVisible[visibleIdx++];
        if (!seen.has(nextVis)) {
          merged.push(nextVis);
          seen.add(nextVis);
        }
      }
    } else if (!seen.has(id)) {
      merged.push(id);
      seen.add(id);
    }
  }

  // baseOrder'da daha önce hiç bulunmayan yeni görünür öğeleri sona ekle
  while (visibleIdx < cleanVisible.length) {
    const nextVis = cleanVisible[visibleIdx++];
    if (!seen.has(nextVis)) {
      merged.push(nextVis);
      seen.add(nextVis);
    }
  }

  // Tamamlanmış ama hala listede olmayan videoları da en sona ekle (tam kapsama)
  if (Array.isArray(db?.history)) {
    for (const h of db.history) {
      if (h && h.status === 'completed' && h.id && !seen.has(h.id)) {
        merged.push(h.id);
        seen.add(h.id);
      }
    }
  }

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
  } catch (_) {}

  if (db && db.settings) {
    db.settings.downloadedUserOrder = merged;
  }

  fetch('/api/settings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ downloadedUserOrder: merged })
  }).catch(() => {});

  return merged;
}

/**
 * İndirilenler listesini seçili sıralama moduna (`user`, `date-desc`, `date-asc`, `size-desc`, `size-asc`, `auto-delete`) göre yerinde sıralar.
 * `user` modunda henüz sırası olmayan (yeni indirilen) videolar listenin EN SONUNA yerleşir; böylece kullanıcının dizdiği sıra bozulmaz.
 *
 * @param {Array<object>} items - Sıralanacak video dizisi
 * @param {string} sortVal - Sıralama modu
 * @param {object} [db] - Veritabanı nesnesi
 * @returns {Array<object>} Sıralanmış dizi
 */
export function sortDownloadedItems(items, sortVal = 'date-desc', db = window.localDb) {
  if (!Array.isArray(items)) return [];
  const mode = sortVal || 'date-desc';
  const customOrder = mode === 'user' ? getDownloadedUserOrder(db) : [];
  const indexMap = new Map();
  if (mode === 'user') {
    customOrder.forEach((id, idx) => indexMap.set(id, idx));
  }

  items.sort((a, b) => {
    if (mode === 'user') {
      const hasA = indexMap.has(a.id);
      const hasB = indexMap.has(b.id);

      if (!hasA && !hasB) {
        const dateA = new Date(a.publishedAt || a.downloadedAt || 0).getTime();
        const dateB = new Date(b.publishedAt || b.downloadedAt || 0).getTime();
        return dateB - dateA;
      }
      // Sırası olmayan yeni videolar en sona gider (kullanıcının mevcut sırasını bozmaz)
      if (!hasA) return 1;
      if (!hasB) return -1;

      return indexMap.get(a.id) - indexMap.get(b.id);
    } else if (mode === 'auto-delete') {
      const infoA = getVideoRemainingInfo(a, db);
      const infoB = getVideoRemainingInfo(b, db);
      const remA = infoA ? infoA.remainingMs : Infinity;
      const remB = infoB ? infoB.remainingMs : Infinity;
      return remA - remB;
    } else if (mode.startsWith('size-')) {
      const sizeA = parseSizeToBytes(a.fileSize);
      const sizeB = parseSizeToBytes(b.fileSize);
      return mode === 'size-desc' ? sizeB - sizeA : sizeA - sizeB;
    } else {
      const dateA = new Date(a.publishedAt || a.downloadedAt || 0).getTime();
      const dateB = new Date(b.publishedAt || b.downloadedAt || 0).getTime();
      return mode === 'date-asc' ? dateA - dateB : dateB - dateA;
    }
  });

  return items;
}

/**
 * Bir videoyu mevcut görünür listede yukarı (`up`), aşağı (`down`) veya en üste (`top`) taşır,
 * yeni sırayı kaydeder ve hem ana ızgarayı hem de yerleşik oynatıcı yan listesini yeniler.
 *
 * @param {string} videoId - Taşınacak video ID'si
 * @param {'up'|'down'|'top'} direction - Taşıma yönü
 * @param {string} [containerSelector] - Mevcut görünür kartların bulunduğu DOM seçicisi
 */
export function moveDownloadedItemInUserOrder(videoId, direction, containerSelector = '#downloaded-playlist-grid .playlist-item, #downloaded-grid .video-card') {
  if (!videoId) return;

  // Eğer şu an kullanıcı sıralamasında değilsek otomatik olarak 'user' moduna geç
  if (typeof window.applyDownloadedSort === 'function' && window.downloadedSortVal !== 'user') {
    window.applyDownloadedSort('user');
  }

  // Hangi konteyner görünürse oradaki mevcut sırayı baz al
  const inlineContainer = document.getElementById('downloaded-inline-player-container');
  const isInlineOpen = inlineContainer && !inlineContainer.classList.contains('hidden');
  const activeSelector = isInlineOpen
    ? '#downloaded-playlist-grid .playlist-item'
    : '#downloaded-grid .video-card';

  let elements = Array.from(document.querySelectorAll(activeSelector));
  if (elements.length === 0) {
    elements = Array.from(document.querySelectorAll(containerSelector));
  }

  const ids = elements.map(el => el.getAttribute('data-id')).filter(Boolean);
  const idx = ids.indexOf(videoId);
  if (idx === -1) return;

  let targetIdx = idx;
  if (direction === 'up') targetIdx = Math.max(0, idx - 1);
  else if (direction === 'down') targetIdx = Math.min(ids.length - 1, idx + 1);
  else if (direction === 'top') targetIdx = 0;

  if (targetIdx === idx) return;

  ids.splice(idx, 1);
  ids.splice(targetIdx, 0, videoId);

  saveDownloadedUserOrder(ids, window.localDb);

  if (typeof window.updateUI === 'function' && window.localDb) {
    window.updateUI(window.localDb);
  }
  if (window.currentPlayingVideoId && typeof window.renderDownloadedPlaylist === 'function') {
    window.renderDownloadedPlaylist(window.currentPlayingVideoId);
  }
}

if (typeof window !== 'undefined') {
  window.getDownloadedUserOrder = getDownloadedUserOrder;
  window.saveDownloadedUserOrder = saveDownloadedUserOrder;
  window.sortDownloadedItems = sortDownloadedItems;
  window.moveDownloadedItemInUserOrder = moveDownloadedItemInUserOrder;
}
