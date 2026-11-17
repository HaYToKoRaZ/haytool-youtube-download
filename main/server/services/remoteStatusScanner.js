// Türkçe Açıklama: İndirilmiş YouTube videolarının uzak sunucu durumunu (Silindi, Gizli, Liste Dışı, Üyelere Özel, Herkese Açık) kontrol eden tarayıcı servisi.
import { readDb, updateHistoryItem } from '../database.js';
import { broadcast, addTerminalLog } from './sse.js';
import { fetchVideoDuration } from './rss.js';

const CONCURRENCY_LIMIT = 4;

let scanState = {
  running: false,
  total: 0,
  processed: 0,
  changed: 0,
  deleted: 0,
  unlisted: 0,
  privateCount: 0,
  membersOnly: 0,
  publicCount: 0,
  unknown: 0,
  startedAt: null,
  finishedAt: null,
  cancelled: false,
  currentTitle: '',
  error: null
};

let cancelRequested = false;
let startupScanScheduled = false;
let pendingStartupRemoteAlerts = [];

/**
 * Bir videonun uzak sunucu durumu değiştiği (silindi, gizlendi, liste dışı veya üyelere özel olduğu)
 * için otomatik silme ve kanal video sınırı kurallarından muaf olup olmadığını döndürür.
 *
 * @param {object} item - Veritabanı history öğesi
 * @returns {boolean}
 */
export function isRemoteStatusProtected(item) {
  return Boolean(item && ['deleted', 'unlisted', 'private', 'members_only'].includes(item.remoteStatus));
}

/**
 * Sunucu açılışında uzak durum taramasının planlandığını işaretler (otomatik silmenin tarama bitimini beklemesi için).
 *
 * @param {boolean} scheduled
 */
export function setStartupRemoteScanScheduled(scheduled) {
  startupScanScheduled = Boolean(scheduled);
}

/**
 * Açılış uzak durum taraması henüz tamamlanmadıysa otomatik silmenin bekletilmesi gerektiğini bildirir.
 *
 * @returns {boolean}
 */
export function isStartupRemoteScanPendingOrRunning() {
  return Boolean(startupScanScheduled || scanState.running);
}

/**
 * Açılış taramasında tespit edilen ve henüz kullanıcı tarafından kapatılmamış uzak durum uyarılarını döndürür.
 *
 * @returns {Array<object>}
 */
export function getPendingStartupRemoteAlerts() {
  return Array.isArray(pendingStartupRemoteAlerts) ? [...pendingStartupRemoteAlerts] : [];
}

/**
 * Açılış uzak durum uyarı penceresindeki videoları onaylar veya bu oturum için kapatır.
 *
 * @param {object} [options]
 * @param {Array<string>|null} [options.videoIds=null]
 * @param {boolean} [options.permanent=false] - true ise aynı durum için sonraki açılışlarda tekrar uyarmaz
 * @returns {{ acknowledged: number, remaining: number }}
 */
export function acknowledgeStartupRemoteAlerts(options = {}) {
  const { videoIds = null, permanent = false } = options;
  const targetSet = Array.isArray(videoIds) && videoIds.length > 0 ? new Set(videoIds.map(String)) : null;
  let acknowledged = 0;

  if (permanent) {
    const db = readDb();
    const candidates = (db.history || []).filter(item =>
      isRemoteStatusProtected(item) && (!targetSet || targetSet.has(String(item.id)))
    );
    for (const item of candidates) {
      updateHistoryItem(item.id, { remoteNotifiedStatus: item.remoteStatus });
      acknowledged++;
    }
  } else {
    acknowledged = targetSet ? pendingStartupRemoteAlerts.filter(v => targetSet.has(String(v.id))).length : pendingStartupRemoteAlerts.length;
  }

  if (targetSet) {
    pendingStartupRemoteAlerts = pendingStartupRemoteAlerts.filter(v => !targetSet.has(String(v.id)));
  } else {
    pendingStartupRemoteAlerts = [];
  }

  return {
    acknowledged,
    remaining: pendingStartupRemoteAlerts.length
  };
}

/**
 * Bir geçmiş kaydının taranabilir tamamlanmış bir YouTube videosu olup olmadığını belirler.
 * Fakap yedekleri ve YouTube dışı (TikTok, X, Instagram, WebStream vb.) kaynakları hariç tutar.
 *
 * @param {object} item - Veritabanı history öğesi
 * @returns {boolean}
 */
export function isYouTubeHistoryItem(item) {
  if (!item || item.status !== 'completed') return false;
  if (item.isFakap === true || String(item.id || '').startsWith('fakap_')) return false;

  const rawYtId = String(item.originalId || item.id || '').trim();
  if (rawYtId.startsWith('ext_') || !/^[a-zA-Z0-9_-]{11}$/.test(rawYtId)) {
    return false;
  }

  if (item.platform && String(item.platform).toLowerCase() !== 'youtube') {
    return false;
  }

  if (
    item.sourceUrl &&
    typeof item.sourceUrl === 'string' &&
    item.sourceUrl.trim() !== '' &&
    !/(?:youtube\.com|youtu\.be)/i.test(item.sourceUrl)
  ) {
    return false;
  }

  return true;
}

/**
 * Sahte PoToken "Sayfanın yeniden yüklenmesi gerekiyor" silindi kayıtlarını otomatik temizler.
 *
 * @param {object} db - Veritabanı nesnesi
 */
export function sanitizeFalseReloadStatuses(db) {
  for (const item of (db?.history || [])) {
    if (
      item &&
      item.remoteStatus === 'deleted' &&
      /yeniden yüklenmesi|page needs to be reloaded|reload the page/i.test(item.remoteReason || '')
    ) {
      item.remoteStatus = '';
      item.remoteReason = '';
      item.remoteCheckedAt = '';
      try {
        updateHistoryItem(item.id, { remoteStatus: '', remoteReason: '', remoteCheckedAt: '' });
      } catch {}
    }
  }
}

/**
 * Veritabanından yalnızca tamamlanmış YouTube video kayıtlarını döndürür.
 *
 * @param {object} db - Veritabanı nesnesi
 * @returns {Array<object>}
 */
export function getDownloadedYouTubeItems(db) {
  sanitizeFalseReloadStatuses(db);
  return (db?.history || []).filter(isYouTubeHistoryItem);
}

/**
 * YouTube InnerTube player yanıtını analiz ederek videonun uzak sunucu durumunu sınıflandırır.
 *
 * @param {object} playerData - InnerTube player JSON nesnesi
 * @param {string} [lang='tr'] - Dil kodu
 * @returns {{ remoteStatus: string, remoteReason: string, remoteTitle: string }}
 */
export function classifyPlayability(playerData, lang = 'tr') {
  const isTr = lang === 'tr';
  const playability = playerData?.playabilityStatus;
  const videoDetails = playerData?.videoDetails;
  const microformat = playerData?.microformat?.playerMicroformatRenderer;

  const remoteTitle = String(
    videoDetails?.title ||
    microformat?.title?.simpleText ||
    ''
  ).trim();

  if (!playability || typeof playability !== 'object') {
    return { remoteStatus: 'unknown', remoteReason: '', remoteTitle };
  }

  const pStatus = String(playability.status || '');
  const offlineSlateRuns = playability.liveStreamability?.liveStreamabilityRenderer?.offlineSlate?.liveStreamOfflineSlateRenderer?.mainText?.runs;
  const offlineSlateText = Array.isArray(offlineSlateRuns) ? offlineSlateRuns.map(r => r?.text || '').join(' ') : '';
  const errMsgRenderer = playability.errorScreen?.playerErrorMessageRenderer;
  const extractRuns = (field) => {
    if (!field) return '';
    if (field.simpleText) return String(field.simpleText);
    if (Array.isArray(field.runs)) return field.runs.map(r => r?.text || '').join('');
    return '';
  };
  const primaryReason = String(
    playability.reason ||
    extractRuns(errMsgRenderer?.reason) ||
    ''
  ).trim();
  const subReason = String(
    extractRuns(errMsgRenderer?.subreason) ||
    playability.errorScreen?.playerInterstitialRenderer?.content?.interstitialViewModel?.description?.content ||
    ''
  ).trim();
  const isGenericReason = /^(bu video kullan[ıi]lam[ıi]yor|video unavailable)\.?$/i.test(primaryReason);
  let rawReason = '';
  if (subReason && (!primaryReason || isGenericReason)) {
    rawReason = subReason;
  } else if (primaryReason && subReason && primaryReason !== subReason) {
    rawReason = `${primaryReason} — ${subReason}`;
  } else {
    rawReason = primaryReason || subReason || offlineSlateText || '';
  }
  rawReason = rawReason.trim();

  const isUnlisted = Boolean(microformat?.isUnlisted === true || videoDetails?.isUnlisted === true);
  const isPrivate = Boolean(videoDetails?.isPrivate === true) || (pStatus === 'LOGIN_REQUIRED' && /private|gizli|özel video/i.test(rawReason));
  const hasMembersOffer = Boolean(
    playability.errorScreen?.playerLegacyDesktopYpcOfferRenderer ||
    playability.errorScreen?.ypcTrailerRenderer
  ) || /members-only|üyelere özel|uyelere ozel|join this channel|katıl/i.test(rawReason);
  const isReloadPrompt = Boolean(playability.errorScreen?.playerErrorMessageRenderer?.proceedButton) ||
    /yeniden yüklenmesi|page needs to be reloaded|reload the page|not a bot|bot olmadığınızı/i.test(rawReason);
  const hasValidVideoMetadata = Boolean(videoDetails?.videoId && videoDetails?.title && microformat);

  if (isPrivate) {
    return {
      remoteStatus: 'private',
      remoteReason: rawReason || (isTr ? 'Bu video gizliye alınmış.' : 'This video is private.'),
      remoteTitle
    };
  }

  if (hasMembersOffer) {
    return {
      remoteStatus: 'members_only',
      remoteReason: rawReason || (isTr ? 'Video üyelere özel (Katıl) içeriğine dönüştürülmüş.' : 'Video is now members-only.'),
      remoteTitle
    };
  }

  if (isUnlisted) {
    return {
      remoteStatus: 'unlisted',
      remoteReason: isTr ? 'Video liste dışı (Unlisted) durumuna alınmış.' : 'Video is now unlisted.',
      remoteTitle
    };
  }

  if (
    pStatus === 'OK' ||
    pStatus === 'LIVE_STREAM_OFFLINE' ||
    (pStatus === 'LOGIN_REQUIRED' && /age|yaş/i.test(rawReason)) ||
    (pStatus === 'UNPLAYABLE' && (isReloadPrompt || hasValidVideoMetadata))
  ) {
    return {
      remoteStatus: 'public',
      remoteReason: '',
      remoteTitle
    };
  }

  if (pStatus === 'ERROR' || pStatus === 'UNPLAYABLE') {
    return {
      remoteStatus: 'deleted',
      remoteReason: rawReason || (isTr ? 'Video YouTube üzerinden silinmiş veya kaldırılmış.' : 'Video has been deleted or removed from YouTube.'),
      remoteTitle
    };
  }

  return {
    remoteStatus: 'unknown',
    remoteReason: rawReason,
    remoteTitle
  };
}

/**
 * Tek bir YouTube videosunun uzak durumunu InnerTube Player API (ve yedek olarak watch HTML) ile kontrol eder.
 *
 * @param {string} videoId - 11 haneli YouTube video ID'si
 * @param {string} [lang='tr'] - Dil kodu
 * @returns {Promise<{ remoteStatus: string, remoteReason: string, remoteTitle: string }>}
 */
export async function checkYouTubeRemoteStatus(videoId, lang = 'tr') {
  const isTr = lang === 'tr';
  let result = { remoteStatus: 'unknown', remoteReason: '', remoteTitle: '' };

  try {
    const resp = await fetch('https://www.youtube.com/youtubei/v1/player', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept-Language': isTr ? 'tr-TR,tr;q=0.9,en;q=0.7' : 'en-US,en;q=0.9'
      },
      body: JSON.stringify({
        context: {
          client: {
            hl: isTr ? 'tr' : 'en',
            gl: 'TR',
            clientName: 'WEB',
            clientVersion: '2.20240501.00.00'
          }
        },
        videoId
      }),
      signal: AbortSignal.timeout(8000)
    });

    if (resp.ok) {
      const playerData = await resp.json();
      result = classifyPlayability(playerData, lang);
    }
  } catch {
    // Yedek HTML kontrolüne düşülür
  }

  if (result.remoteStatus !== 'unknown' && result.remoteStatus !== 'deleted') {
    return result;
  }

  try {
    const htmlParsed = await fetchVideoDuration(videoId);
    if (htmlParsed) {
      const fallbackTitle = String(htmlParsed.title || result.remoteTitle || '').trim();
      const rawReason = String(htmlParsed.reason || '').trim();

      if (htmlParsed.isUnavailable) {
        if (/gizli|private/i.test(rawReason)) {
          return {
            remoteStatus: 'private',
            remoteReason: rawReason || (isTr ? 'Bu video gizliye alınmış.' : 'This video is private.'),
            remoteTitle: fallbackTitle
          };
        }
        if (/üyelere özel|uyelere ozel|members-only|katıl|join this channel/i.test(rawReason)) {
          return {
            remoteStatus: 'members_only',
            remoteReason: rawReason || (isTr ? 'Video üyelere özel (Katıl) içeriğine dönüştürülmüş.' : 'Video is now members-only.'),
            remoteTitle: fallbackTitle
          };
        }
        return {
          remoteStatus: 'deleted',
          remoteReason: rawReason || (isTr ? 'Video YouTube üzerinden silinmiş veya kaldırılmış.' : 'Video has been deleted or removed from YouTube.'),
          remoteTitle: fallbackTitle
        };
      }

      if (htmlParsed.isUnlisted) {
        return {
          remoteStatus: 'unlisted',
          remoteReason: isTr ? 'Video liste dışı (Unlisted) durumuna alınmış.' : 'Video is now unlisted.',
          remoteTitle: fallbackTitle
        };
      }

      if (htmlParsed.duration || htmlParsed.title || htmlParsed.publishedAt) {
        return {
          remoteStatus: 'public',
          remoteReason: '',
          remoteTitle: fallbackTitle
        };
      }
    }
  } catch {
    // Bilinmiyor olarak bırakılır
  }

  return result;
}

/**
 * İndirilmiş YouTube videolarının kayıtlı uzak durum özet istatistiklerini hesaplar.
 *
 * @param {object} db - Veritabanı nesnesi
 * @returns {object}
 */
export function getRemoteStatusSummary(db) {
  const items = getDownloadedYouTubeItems(db);
  const summary = {
    total: items.length,
    checked: 0,
    unchecked: 0,
    changed: 0,
    deleted: 0,
    unlisted: 0,
    private: 0,
    members_only: 0,
    public: 0,
    unknown: 0
  };

  for (const item of items) {
    const st = item.remoteStatus || '';
    if (!st) {
      summary.unchecked++;
      continue;
    }
    summary.checked++;
    if (st === 'deleted') {
      summary.deleted++;
      summary.changed++;
    } else if (st === 'unlisted') {
      summary.unlisted++;
      summary.changed++;
    } else if (st === 'private') {
      summary.private++;
      summary.changed++;
    } else if (st === 'members_only') {
      summary.members_only++;
      summary.changed++;
    } else if (st === 'public') {
      summary.public++;
    } else {
      summary.unknown++;
    }
  }

  return summary;
}

/**
 * Aktif veya son tarama durumunun anlık kopyasını döndürür.
 *
 * @returns {object}
 */
export function getRemoteStatusScanState() {
  return { ...scanState };
}

/**
 * Çalışan uzak durum taramasını iptal eder.
 *
 * @returns {object}
 */
export function cancelRemoteStatusScan() {
  if (scanState.running) {
    cancelRequested = true;
    addTerminalLog('[Uzak Durum] Tarama kullanıcı tarafından iptal ediliyor...', 'warning');
  }
  return getRemoteStatusScanState();
}

function broadcastScanProgress() {
  broadcast('remote_status_scan_progress', getRemoteStatusScanState());
}

/**
 * İndirilmiş YouTube videoları için uzak durum taramasını başlatır.
 *
 * @param {object} [options]
 * @param {boolean} [options.onlyUnchecked=false] - Yalnızca henüz taranmamış videoları tara
 * @param {string|null} [options.videoId=null] - Yalnızca tek bir video ID tara
 * @returns {{ started: boolean, error?: string, scanState: object }}
 */
export function startRemoteStatusScan(options = {}) {
  const { onlyUnchecked = false, videoId = null, isStartupScan = false, onComplete = null } = options;

  if (scanState.running) {
    return {
      started: false,
      error: 'Uzak durum taraması zaten devam ediyor.',
      scanState: getRemoteStatusScanState()
    };
  }

  const db = readDb();
  const lang = db.settings?.lang || 'tr';
  let targets = getDownloadedYouTubeItems(db);

  if (videoId) {
    targets = targets.filter(item => item.id === videoId || item.originalId === videoId);
  } else if (onlyUnchecked) {
    targets = targets.filter(item => !item.remoteStatus || item.remoteStatus === 'unknown');
  }

  cancelRequested = false;
  scanState = {
    running: targets.length > 0,
    total: targets.length,
    processed: 0,
    changed: 0,
    deleted: 0,
    unlisted: 0,
    privateCount: 0,
    membersOnly: 0,
    publicCount: 0,
    unknown: 0,
    startedAt: new Date().toISOString(),
    finishedAt: targets.length === 0 ? new Date().toISOString() : null,
    cancelled: false,
    currentTitle: '',
    error: null
  };

  broadcastScanProgress();

  if (targets.length === 0) {
    if (isStartupScan) {
      startupScanScheduled = false;
    }
    addTerminalLog('[Uzak Durum] Taranacak uygun indirilmiş YouTube videosu bulunamadı.', 'info');
    if (typeof onComplete === 'function') {
      try { onComplete(); } catch (_) {}
    }
    return { started: true, scanState: getRemoteStatusScanState() };
  }

  addTerminalLog(`[Uzak Durum] İndirilmiş YouTube videoları taranıyor (Toplam: ${targets.length})...`, 'info');

  (async () => {
    let cursor = 0;

    async function worker() {
      while (!cancelRequested) {
        const index = cursor++;
        if (index >= targets.length) break;

        const item = targets[index];
        const rawYtId = String(item.originalId || item.id).trim();
        scanState.currentTitle = item.title || rawYtId;

        try {
          const checkRes = await checkYouTubeRemoteStatus(rawYtId, lang);
          const remoteCheckedAt = new Date().toISOString();
          const updates = {
            remoteStatus: checkRes.remoteStatus,
            remoteReason: checkRes.remoteReason || '',
            remoteTitle: checkRes.remoteTitle || '',
            remoteCheckedAt
          };

          updateHistoryItem(item.id, updates);

          if (checkRes.remoteStatus === 'deleted') {
            scanState.deleted++;
            scanState.changed++;
          } else if (checkRes.remoteStatus === 'unlisted') {
            scanState.unlisted++;
            scanState.changed++;
          } else if (checkRes.remoteStatus === 'private') {
            scanState.privateCount++;
            scanState.changed++;
          } else if (checkRes.remoteStatus === 'members_only') {
            scanState.membersOnly++;
            scanState.changed++;
          } else if (checkRes.remoteStatus === 'public') {
            scanState.publicCount++;
          } else {
            scanState.unknown++;
          }

          if (['deleted', 'unlisted', 'private', 'members_only'].includes(checkRes.remoteStatus)) {
            addTerminalLog(
              `[Uzak Durum] Değişiklik tespit edildi: "${item.title || rawYtId}" -> ${checkRes.remoteStatus.toUpperCase()}${checkRes.remoteReason ? ` (${checkRes.remoteReason})` : ''} (Oto-silmeden muaf tutuldu)`,
              'warning'
            );
          }
        } catch (err) {
          scanState.unknown++;
          console.warn(`[Uzak Durum] "${item.title || rawYtId}" kontrol hatası:`, err.message);
        } finally {
          scanState.processed++;
          broadcastScanProgress();
        }
      }
    }

    try {
      const workerCount = Math.min(CONCURRENCY_LIMIT, targets.length);
      await Promise.all(Array.from({ length: workerCount }, () => worker()));

      scanState.cancelled = cancelRequested;
      scanState.running = false;
      scanState.finishedAt = new Date().toISOString();
      scanState.currentTitle = '';

      if (scanState.cancelled) {
        addTerminalLog(
          `[Uzak Durum] Tarama iptal edildi (${scanState.processed}/${scanState.total} kontrol edildi, ${scanState.changed} değişiklik).`,
          'warning'
        );
      } else {
        addTerminalLog(
          `[Uzak Durum] Tarama tamamlandı: ${scanState.processed} video kontrol edildi, ${scanState.changed} değişiklik (Silinen: ${scanState.deleted}, Liste Dışı: ${scanState.unlisted}, Gizli: ${scanState.privateCount}, Üyelere Özel: ${scanState.membersOnly}).`,
          scanState.changed > 0 ? 'warning' : 'success'
        );

        const freshDb = readDb();
        broadcast('db_update', freshDb);

        if (isStartupScan) {
          const alertVideos = getDownloadedYouTubeItems(freshDb)
            .filter(item => isRemoteStatusProtected(item) && item.remoteNotifiedStatus !== item.remoteStatus)
            .map(item => ({
              id: item.id,
              originalId: item.originalId || item.id,
              title: item.title || item.id,
              channelId: item.channelId || '',
              channelName: item.channelName || '',
              fileSize: item.fileSize || '',
              fileMissing: Boolean(item.fileMissing),
              remoteStatus: item.remoteStatus,
              remoteReason: item.remoteReason || '',
              remoteTitle: item.remoteTitle || '',
              remoteCheckedAt: item.remoteCheckedAt || '',
              thumbnail: `/api/video/${item.id}/thumbnail`
            }));

          if (alertVideos.length > 0) {
            pendingStartupRemoteAlerts = alertVideos;
            broadcast('remote_status_startup_alert', {
              videos: alertVideos,
              count: alertVideos.length,
              summary: getRemoteStatusSummary(freshDb)
            });
          }
        }
      }
    } catch (err) {
      scanState.running = false;
      scanState.finishedAt = new Date().toISOString();
      scanState.error = err.message;
      addTerminalLog(`[Uzak Durum] [HATA] Tarama sırasında hata: ${err.message}`, 'error');
    } finally {
      if (isStartupScan) {
        startupScanScheduled = false;
      }
      cancelRequested = false;
      broadcastScanProgress();
      if (typeof onComplete === 'function') {
        try { onComplete(); } catch (_) {}
      }
    }
  })();

  return { started: true, scanState: getRemoteStatusScanState() };
}
