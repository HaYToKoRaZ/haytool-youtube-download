// Türkçe Açıklama: YouTube RSS XML beslemelerini, kanalları yt-dlp ile taramayı ve videoların sürelerini/yüklenme tarihlerini çözme işlemlerini yöneten RSS servisi.
import fs from 'fs';
import path from 'path';
import https from 'https';
import http from 'http';
import os from 'os';
import { spawn } from 'child_process';
import Parser from 'rss-parser';
import { 
  readDb, 
  writeDb, 
  acquireDbLock, 
  createHistoryItem, 
  isShortDuration, 
  updateHistoryItem 
} from '../database.js';
import { broadcast, addTerminalLog } from './sse.js';
import { ytdlpPath, getLocalTempDir, cleanMeiForPid, spawnYtdlp, getVideoDurationFromFile, formatDurationStr } from './paths.js';
import { downloadQueue, getCookieArgs } from './downloader.js';

const parser = new Parser({
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7'
  }
});

export let isRssChecking = false;
let rssCheckStartTime = 0;
export let isResolvingDurations = false;
export let hasDeferredChannelCheck = false;
export let deferredChannelCheckSource = null;


/**
 * Verilen URL'yi doğrudan çekmeyi dener. Hata veya HTTP >= 400 durumunda,
 * tanımlı proxy listesini sırayla kullanarak içeriği çekmeye çalışır.
 * 
 * @param {string} targetUrl Çekilmek istenen orijinal URL
 * @returns {Promise<string>} Yanıt içeriği
 */
export function fetchWithProxyWaterfall(targetUrl) {
  const proxies = [
    url => url,
    url => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
    url => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`
  ];

  return new Promise((resolve, reject) => {
    let index = 0;

    function tryNext() {
      if (index >= proxies.length) {
        return reject(new Error(`Orijinal ve proxy sunucuları üzerinden ${targetUrl} adresi çekilemedi.`));
      }

      const activeUrl = proxies[index](targetUrl);
      
      let urlObj;
      try {
        urlObj = new URL(activeUrl);
      } catch (e) {
        index++;
        tryNext();
        return;
      }

      function performRequest(requestUrl, redirectCount = 0) {
        if (redirectCount > 5) {
          index++;
          tryNext();
          return;
        }

        const reqOptions = {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7',
            'Cache-Control': 'no-cache'
          }
        };

        const currentUrlObj = new URL(requestUrl);
        const currentGetter = currentUrlObj.protocol === 'https:' ? https : http;

        let reqEnded = false;
        const req = currentGetter.get(currentUrlObj, reqOptions, (res) => {
          if (res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 307 || res.statusCode === 308) {
            let location = res.headers.location;
            if (location) {
              if (!location.startsWith('http')) {
                location = currentUrlObj.origin + location;
              }
              performRequest(location, redirectCount + 1);
              return;
            }
          }

          if (res.statusCode !== 200) {
            if (!reqEnded) {
              reqEnded = true;
              index++;
              tryNext();
            }
            return;
          }

          let data = '';
          res.on('data', chunk => { data += chunk; });
          res.on('end', () => {
            if (!reqEnded) {
              reqEnded = true;
              resolve(data);
            }
          });
        });

        req.on('error', () => {
          if (!reqEnded) {
            reqEnded = true;
            index++;
            tryNext();
          }
        });

        req.setTimeout(4000, () => {
          if (!reqEnded) {
            reqEnded = true;
            try { req.destroy(); } catch (e) {}
            index++;
            tryNext();
          }
        });
      }

      performRequest(activeUrl);
    }

    tryNext();
  });
}

/**
 * Belirtilen URL'deki kanal logosunu yerel diskteki kanal klasörüne kaydeder.
 * 
 * @param {string} url Profil resmi uzak URL'si
 * @param {string} channelName Kanal ismi
 * @returns {Promise<string>} Yerel dosya yolu veya hata durumunda boş dize
 */
export function downloadChannelAvatar(url, channelName) {
  return new Promise((resolve) => {
    if (!url || !channelName) return resolve('');
    const db = readDb();
    const channelDir = path.join(db.settings.downloadPath, channelName);
    const destPath = path.join(channelDir, 'avatar.jpg');

    if (!fs.existsSync(channelDir)) {
      try {
        fs.mkdirSync(channelDir, { recursive: true });
      } catch (err) {
        console.error('Kanal klasörü oluşturulamadı:', err.message);
        return resolve('');
      }
    }

    const proxies = [
      u => u,
      u => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
      u => `https://corsproxy.io/?${encodeURIComponent(u)}`,
      u => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(u)}`
    ];

    let proxyIdx = 0;
    function tryDownload() {
      if (proxyIdx >= proxies.length) {
        console.error(`Kanal avatarı indirilemedi (Tüm proxyler denendi): ${channelName}`);
        return resolve('');
      }
      
      const activeUrl = proxies[proxyIdx](url);
      let urlObj;
      try {
        urlObj = new URL(activeUrl);
      } catch (e) {
        proxyIdx++;
        tryDownload();
        return;
      }

      const getter = urlObj.protocol === 'https:' ? https : http;
      getter.get(activeUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      }, (res) => {
        if (res.statusCode !== 200) {
          proxyIdx++;
          tryDownload();
          return;
        }

        const fileStream = fs.createWriteStream(destPath);
        res.pipe(fileStream);
        fileStream.on('finish', () => {
          fileStream.close();
          console.log(`Kanal avatarı başarıyla indirildi: ${channelName}`);
          resolve(`/api/channels/${encodeURIComponent(channelName)}/avatar`);
        });
        fileStream.on('error', (err) => {
          fileStream.close();
          fs.unlink(destPath, () => {});
          proxyIdx++;
          tryDownload();
        });
      }).on('error', () => {
        proxyIdx++;
        tryDownload();
      });
    }

    tryDownload();
  });
}

/**
 * Belirtilen videonun süresini, yüklenme tarihini, kanal ID'sini ve başlığını YouTube'dan çeker.
 * 
 * @param {string} videoId Çekilecek videonun YouTube ID'si
 * @returns {Promise<object>} Videonun süre, tarih, başlık ve kanal detayları
 */
/**
 * HTML sayfa içeriğinden video detaylarını (süre, yayınlanma tarihi, başlık ve kanal adı) ayıklar.
 * 
 * @param {string} html - Sayfa HTML içeriği
 * @param {boolean} isShortFallback - Yalnızca Shorts yönlendirmesi tespit edildiğinde varsayılan süre verilsin mi?
 * @returns {object} { duration, publishedAt, title, channelName }
 */
export function parseDurationFromHtml(html, isShortFallback = false) {
  let duration = '';
  let publishedAt = '';
  let title = '';
  let channelName = '';
  let channelId = '';
  let viewCount = 0;
  let isUnavailable = false;
  let isUnlisted = false;
  let reason = '';
  let endTimestamp = null;
  let startTimestamp = null;
  let upcomingStartTimestamp = null;
  let isLiveNow = false;
  let isUpcoming = false;
  let isLiveProcessing = false;
  let parsedPlayerResponse = false;

  if (isShortFallback) {
    duration = '0:30';
  }

  const playerResponseMatch = html.match(/ytInitialPlayerResponse\s*=\s*({.+?});/);
  if (playerResponseMatch) {
    try {
      const playerResponse = JSON.parse(playerResponseMatch[1]);
      parsedPlayerResponse = true;
      const playability = playerResponse.playabilityStatus;
      let pStatus = '';
      let rawPlayReason = '';
      if (playability) {
        pStatus = playability.status || '';
        const offlineSlateRuns = playability.liveStreamability?.liveStreamabilityRenderer?.offlineSlate?.liveStreamOfflineSlateRenderer?.mainText?.runs;
        const offlineSlateText = Array.isArray(offlineSlateRuns) ? offlineSlateRuns.map(r => r?.text || '').join(' ') : '';
        rawPlayReason =
          playability.reason ||
          playability.errorScreen?.playerErrorMessageRenderer?.reason?.simpleText ||
          playability.errorScreen?.playerErrorMessageRenderer?.subreason?.simpleText ||
          playability.errorScreen?.playerInterstitialRenderer?.content?.interstitialViewModel?.description?.content ||
          offlineSlateText ||
          '';

        if (pStatus === 'UNPLAYABLE' || pStatus === 'LOGIN_REQUIRED' || pStatus === 'ERROR') {
          const hasMembersOffer = Boolean(
            playability.errorScreen?.playerLegacyDesktopYpcOfferRenderer ||
            playability.errorScreen?.ypcTrailerRenderer
          );
          isUnavailable = true;
          if (hasMembersOffer || /members-only|üyelere özel|uyelere ozel|join this channel|katıl/i.test(rawPlayReason)) {
            reason = 'Video üyelere özel (Katıl) içeriğidir.';
          } else {
            reason = rawPlayReason || 'Video gizli, üyelere özel veya erişilemez.';
          }
        }
      }

      const videoDetails = playerResponse.videoDetails;
      const microformat = playerResponse.microformat?.playerMicroformatRenderer;

      if (microformat && microformat.isUnlisted === true) {
        isUnlisted = true;
      }
      if (videoDetails && videoDetails.isUnlisted === true) {
        isUnlisted = true;
      }

      if (videoDetails) {
        const seconds = videoDetails.lengthSeconds ? parseInt(videoDetails.lengthSeconds, 10) : 0;
        const liveBroadcastDetails = microformat?.liveBroadcastDetails;
        const upcomingEventData = microformat?.upcomingEventData;

        if (liveBroadcastDetails) {
          if (liveBroadcastDetails.startTimestamp) startTimestamp = liveBroadcastDetails.startTimestamp;
          if (liveBroadcastDetails.endTimestamp) endTimestamp = liveBroadcastDetails.endTimestamp;
        }
        if (upcomingEventData?.startTimestamp) {
          const epochSec = parseInt(upcomingEventData.startTimestamp, 10);
          if (!isNaN(epochSec) && epochSec > 0) {
            upcomingStartTimestamp = new Date(epochSec * 1000).toISOString();
          }
        }

        isLiveNow = (videoDetails.isLive === true) ||
                    (liveBroadcastDetails?.isLiveNow === true);

        const endedOfflineStream =
          !isLiveNow &&
          seconds === 0 &&
          (Boolean(endTimestamp) || (pStatus === 'LIVE_STREAM_OFFLINE' && /has ended|sona erdi|süresi doldu|stream offline/i.test(rawPlayReason)));

        if (endedOfflineStream) {
          isLiveProcessing = true;
          duration = 'live';
        } else {
          isUpcoming = (upcomingEventData !== undefined) ||
                       (liveBroadcastDetails && liveBroadcastDetails.isLiveNow === false && !liveBroadcastDetails.endTimestamp) ||
                       (videoDetails.isUpcoming === true) ||
                       (pStatus === 'LIVE_STREAM_OFFLINE' && seconds === 0);

          if (isLiveNow) {
            duration = 'live';
          } else if (isUpcoming || (seconds === 0 && liveBroadcastDetails && !liveBroadcastDetails.endTimestamp)) {
            duration = 'upcoming';
          } else if (seconds > 0) {
            const hrs = Math.floor(seconds / 3600);
            const mins = Math.floor((seconds % 3600) / 60);
            const secs = seconds % 60;
            if (hrs > 0) {
              duration = `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
            } else {
              duration = `${mins}:${secs.toString().padStart(2, '0')}`;
            }
          }
        }
        if (videoDetails.title) {
          title = videoDetails.title;
        }
        if (videoDetails.author) {
          channelName = videoDetails.author;
        }
        if (videoDetails.channelId) {
          channelId = videoDetails.channelId;
        }
        if (videoDetails.viewCount) {
          const parsedVc = parseInt(videoDetails.viewCount, 10);
          if (!isNaN(parsedVc) && parsedVc >= 0) viewCount = parsedVc;
        }
      }

      if (microformat) {
        if (microformat.publishDate) {
          publishedAt = new Date(microformat.publishDate).toISOString();
        } else if (microformat.uploadDate) {
          publishedAt = new Date(microformat.uploadDate).toISOString();
        } else if (microformat.liveBroadcastDetails?.startTimestamp) {
          publishedAt = new Date(microformat.liveBroadcastDetails.startTimestamp).toISOString();
        }
      }
    } catch (e) {
      // Hata yoksayılabilir
    }
  }

  if (!isUnlisted && /"isUnlisted"\s*:\s*true/i.test(html)) {
    isUnlisted = true;
  }

  // Türkçe Açıklama: Yalnızca ytInitialPlayerResponse ayrıştırılamadığında yedek HTML kontrolü yap.
  // Kanalın genel "Katıl" butonu metinleri ("üyelere özel" / "join this channel") veya VOD işleme aşamasındaki
  // "Canlı yayın sona erdi" metni açık videoları sahte olarak erişilemez işaretlememelidir.
  if (!parsedPlayerResponse && !isUnavailable && html) {
    if (/"playerLegacyDesktopYpcOfferRenderer"\s*:/i.test(html)) {
      isUnavailable = true;
      reason = 'Video üyelere özel (Katıl) içeriğidir.';
    } else if (/This video is private|Bu video gizli|Özel video|Private video/i.test(html)) {
      isUnavailable = true;
      reason = 'Bu video gizlidir.';
    } else if (/This live stream has ended|Canlı yayın sona erdi|Yayının süresi doldu|Stream offline/i.test(html)) {
      isLiveProcessing = true;
      if (!duration) duration = 'live';
    } else if (/Video unavailable|Bu video kaldırıldı|removed by the uploader|Bu içerik kullanılamıyor/i.test(html)) {
      isUnavailable = true;
      reason = 'Video kaldırılmış veya kullanılamıyor.';
    }
  }

  if (!duration && !isUnavailable) {
    const lengthMatch = html.match(/"lengthSeconds"\s*:\s*"(\d+)"/);
    if (lengthMatch) {
      const seconds = parseInt(lengthMatch[1], 10);
      if (seconds > 0) {
        const hrs = Math.floor(seconds / 3600);
        const mins = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;
        if (hrs > 0) {
          duration = `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        } else {
          duration = `${mins}:${secs.toString().padStart(2, '0')}`;
        }
      }
    }
  }

  if (!publishedAt) {
    const dateMatch = html.match(/"publishDate"\s*:\s*"([^"]+)"/) || html.match(/"uploadDate"\s*:\s*"([^"]+)"/);
    if (dateMatch) {
      publishedAt = new Date(dateMatch[1]).toISOString();
    }
  }

  if (!title) {
    const titleM = html.match(/<meta\s+name="title"\s+content="([^"]+)"/i) || html.match(/<title>([^<]+)<\/title>/);
    if (titleM) {
      title = titleM[1].replace(' - YouTube', '').trim();
    }
  }

  if (!channelName) {
    const channelM = html.match(/<link\s+itemprop="name"\s+content="([^"]+)"/i);
    if (channelM) {
      channelName = channelM[1].trim();
    }
  }

  if (!channelId) {
    const chIdM = html.match(/"externalChannelId"\s*:\s*"(UC[a-zA-Z0-9_-]{20,})"/) || html.match(/"channelId"\s*:\s*"(UC[a-zA-Z0-9_-]{20,})"/);
    if (chIdM) {
      channelId = chIdM[1];
    }
  }

  return { duration, publishedAt, title, channelName, channelId, viewCount, isUnavailable, isUnlisted, reason, endTimestamp, startTimestamp, upcomingStartTimestamp, isLiveNow, isUpcoming, isLiveProcessing };
}

export function fetchVideoDuration(videoId) {
  return new Promise((resolve) => {
    const db = readDb();
    const hl = db.settings?.lang || 'tr';
    const startUrl = `https://www.youtube.com/watch?v=${videoId}&hl=${hl}`;
    const mapping = {
      'tr': 'tr-TR,tr;q=0.9',
      'en': 'en-US,en;q=0.9',
      'es': 'es-ES,es;q=0.9',
      'de': 'de-DE,de;q=0.9',
      'pt': 'pt-PT,pt;q=0.9',
      'ru': 'ru-RU,ru;q=0.9',
      'ar': 'ar-AE,ar;q=0.9'
    };
    const langHeader = mapping[hl] || `${hl}-${hl.toUpperCase()},${hl};q=0.9,en-US;q=0.8,en;q=0.7`;
    const maxRedirects = 5;
    let redirectCount = 0;
    let isShortRedirect = false;

    async function tryWaterfall() {
      try {
        const proxyHtml = await fetchWithProxyWaterfall(startUrl);
        const parsed = parseDurationFromHtml(proxyHtml, false);
        resolve(parsed);
      } catch (err) {
        resolve({ duration: '', publishedAt: '' });
      }
    }

    function getRequest(url) {
      if (redirectCount > maxRedirects) {
        return tryWaterfall();
      }

      https.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Accept-Language': langHeader
        }
      }, (res) => {
        if (res.statusCode >= 400) {
          return tryWaterfall();
        }

        if (res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 307 || res.statusCode === 308) {
          let redirectUrl = res.headers.location;
          if (redirectUrl) {
            if (!redirectUrl.startsWith('http')) {
              redirectUrl = 'https://www.youtube.com' + redirectUrl;
            }
            if (redirectUrl.includes('/shorts/')) {
              isShortRedirect = true;
            }
            if (!redirectUrl.includes('hl=')) {
              redirectUrl += (redirectUrl.includes('?') ? '&' : '?') + `hl=${hl}`;
            }
            redirectCount++;
            return getRequest(redirectUrl);
          }
        }

        let html = '';
        res.on('data', chunk => { html += chunk; });
        res.on('end', () => {
          const parsed = parseDurationFromHtml(html, isShortRedirect);
          resolve(parsed);
        });
      }).on('error', () => {
        tryWaterfall();
      });
    }

    getRequest(startUrl);
  });
}

/**
 * Türkçe Açıklama: yt-dlp kullanarak video süresini dakika:saniye formatında çeker.
 * fetchVideoDuration HTTP kontrolü başarısız olduğunda yedek mekanizma olarak kullanılır.
 * 
 * @param {string} videoId YouTube video ID'si
 * @returns {Promise<string>} Süre metni (örn: '3:45', '1:02:30') veya boş string
 */
export function fetchDurationViaYtdlp(videoId, targetUrl = null) {
  return new Promise((resolve) => {
    const db = readDb();
    const settings = db.settings || {};
    const args = [];

    const urlToQuery = targetUrl || (
      (/^[a-zA-Z0-9_-]{11}$/.test(videoId))
        ? `https://www.youtube.com/watch?v=${videoId}`
        : null
    );
    if (!urlToQuery) return resolve('');

    args.push(
      '--no-playlist',
      '--skip-download',
      '--print', '%(duration_string)s',
      urlToQuery
    );

    const localTemp = getLocalTempDir();
    const spawnOptions = {
      env: { ...process.env, TEMP: localTemp, TMP: localTemp },
      ...(process.platform === 'win32' ? { windowsVerbatimArguments: false, windowsHide: true } : {})
    };

    const proc = spawnYtdlp(args, spawnOptions);

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => { stdout += data.toString(); });
    proc.stderr.on('data', (data) => { stderr += data.toString(); });

    proc.on('close', (code) => {
      cleanMeiForPid(proc.pid);
      const raw = stdout.trim().split('\n')[0]?.trim() || '';
      if (raw && /^\d+(:\d+)*$/.test(raw)) {
        resolve(formatDurationStr(raw));
      } else {
        resolve('');
      }
    });

    proc.on('error', () => resolve(''));
  });
}


/**
 * YouTube kanalının en son videolarını XML RSS akışından doğrudan ve hızlıca çeker.
 * 
 * @param {string} channelId YouTube kanal kimliği (ID)
 * @returns {Promise<object>} Video listesini içeren nesne
 */
export function fetchChannelVideosXml(channelId) {
  return new Promise((resolve, reject) => {
    const db = readDb();
    const hl = db.settings?.lang || 'tr';
    const feedUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}&hl=${hl}`;

    const reqOptions = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': hl === 'en' ? 'en-US,en;q=0.9' : 'tr-TR,tr;q=0.9,en-US;q=0.8',
        'Cache-Control': 'no-cache'
      }
    };

    let reqEnded = false;
    const req = https.get(feedUrl, reqOptions, (res) => {
      if (res.statusCode !== 200) {
        if (!reqEnded) {
          reqEnded = true;
          return reject(new Error(`YouTube RSS XML yanıt kodu: ${res.statusCode}`));
        }
        return;
      }

      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', async () => {
        if (!reqEnded) {
          reqEnded = true;
          try {
            const parsed = await parser.parseString(data);
            resolve(parsed);
          } catch (pErr) {
            reject(new Error(`XML ayrıştırma hatası: ${pErr.message}`));
          }
        }
      });
    });

    req.on('error', (err) => {
      if (!reqEnded) {
        reqEnded = true;
        reject(err);
      }
    });

    req.setTimeout(5000, () => {
      if (!reqEnded) {
        reqEnded = true;
        try { req.destroy(); } catch (e) {}
        reject(new Error('YouTube RSS XML zaman aşımı (5s)'));
      }
    });
  });
}

/**
 * YouTube kanalının en son videolarını flat-playlist modunda json olarak çeker.
 * 
 * @param {string} channelId YouTube kanal kimliği (ID)
 * @param {number} limit Alınacak maksimum video sayısı
 * @returns {Promise<object>} Video listesini içeren nesne
 */
export function fetchChannelVideosYtdlp(channelId, limit) {
  return new Promise(async (resolve, reject) => {
    const db = readDb();
    const settings = db.settings || {};
    
    const dateMap = new Map();
    try {
      const xmlFeed = await fetchChannelVideosXml(channelId);
      if (xmlFeed && xmlFeed.items) {
        for (const item of xmlFeed.items) {
          const videoId = item.link?.match(/v=([^&]+)/)?.[1] || item.id?.replace('yt:video:', '');
          const isoDate = item.isoDate || item.pubDate;
          if (videoId && isoDate) {
            dateMap.set(videoId, isoDate);
          }
        }
      }
    } catch (rssErr) {
      // XML RSS tarih eşleme isteğe bağlıdır, hata durumunda sessizce devam edilir
    }

    const args = [];
    args.push('--js-runtimes', `node:${process.execPath}`);
    
    args.push(
      '--ignore-errors',
      '--flat-playlist',
      '--playlist-end', limit.toString(),
      '--dump-json',
      '--socket-timeout', '5',
      '--retries', '1'
    );
    if (settings.lang) {
      args.push('--extractor-args', `youtube:lang=${settings.lang}`);
    }
    // Oturum & Azerbaycan/Bölge çerezlerini kanal taramasına bağla (Bölgesel engelleri aşar)
    const cookieArgs = getCookieArgs(settings);
    if (cookieArgs && cookieArgs.length > 0) {
      args.push(...cookieArgs);
    }
    let targetUrl;
    if (channelId.startsWith('http://') || channelId.startsWith('https://')) {
      targetUrl = channelId.replace(/\/videos$/, '') + '/videos';
    } else if (channelId.startsWith('@')) {
      targetUrl = `https://www.youtube.com/${channelId}/videos`;
    } else {
      targetUrl = `https://www.youtube.com/channel/${channelId}/videos`;
    }
    
    args.push(targetUrl);
    
    const localTemp = getLocalTempDir();
    const spawnOptions = {
      env: { ...process.env, TEMP: localTemp, TMP: localTemp },
      ...(process.platform === 'win32' ? { windowsVerbatimArguments: false, windowsHide: true } : {})
    };
    const proc = spawnYtdlp(args, spawnOptions);
    
    let isSettled = false;
    const timeoutTimer = setTimeout(() => {
      if (!isSettled) {
        isSettled = true;
        try { proc.kill(); } catch (e) {}
        reject(new Error('bölge kısıtlaması/zaman aşımı (Geo-blocked)'));
      }
    }, 15000);
    
    let stdout = '';
    let stderr = '';
    
    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    
    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    proc.on('close', (code) => {
      cleanMeiForPid(proc.pid);
      clearTimeout(timeoutTimer);
      if (isSettled) return;
      isSettled = true;

      const items = [];
      const lines = stdout.split('\n');
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const video = JSON.parse(line.trim());
          if (video && video.id) {
            let isoDate = '';
            
            if (dateMap.has(video.id)) {
              isoDate = dateMap.get(video.id);
            }
            if (!isoDate && db.history) {
              const histMatch = db.history.find(h => h.id === video.id);
              if (histMatch && histMatch.publishedAt) {
                isoDate = histMatch.publishedAt;
              }
            }
            if (!isoDate) {
              if (video.timestamp) {
                isoDate = new Date(video.timestamp * 1000).toISOString();
              } else if (video.upload_date) {
                const yr = video.upload_date.slice(0, 4);
                const mo = video.upload_date.slice(4, 6);
                const dy = video.upload_date.slice(6, 8);
                isoDate = new Date(`${yr}-${mo}-${dy}T00:00:00.000Z`).toISOString();
              }
            }
            
            items.push({
              title: video.title || 'Video',
              link: `https://www.youtube.com/watch?v=${video.id}`,
              id: `yt:video:${video.id}`,
              isoDate: isoDate
            });
          }
        } catch (e) {
          // Yoksay
        }
      }

      if (items.length === 0 && code !== 0) {
        const isGeoBlocked = /Bu kanal kullan|This channel is not available|Geo-blocked|Private video|Sign in/i.test(stderr);
        const cleanMsg = isGeoBlocked 
          ? 'Bölgesel erişim kısıtlaması (Geo-blocked)'
          : (stderr.trim().split('\n').filter(l => l.includes('ERROR:') || l.includes('Error')).pop() || `Exit code ${code}`).trim();
        return reject(new Error(cleanMsg));
      }
      
      items.sort((a, b) => new Date(b.isoDate || 0).getTime() - new Date(a.isoDate || 0).getTime());
      resolve({ items });
    });
  });
}


/**
 * Belirtilen kanalın RSS akışını kontrol eder ve yeni videolar varsa kuyruğa ekler.
 * 
 * @param {object} channel RSS akışı denetlenecek kanal nesnesi
 * @param {boolean} isFirstStart Kanalın ilk kez eklenip eklenmediği bilgisi (İlk eklemede eski videolar indirilmez)
 * @returns {Promise<void>}
 */
export async function checkSingleChannelRss(channel, isFirstStart = false) {
  try {
    const db = readDb();
    const rssLimit = db.settings.rssLimit || 5;
    let feed = null;

    try {
      feed = await fetchChannelVideosXml(channel.id);
    } catch (xmlErr) {
      console.log(`[RSS] "${channel.name}" için XML denemesi başarısız (${xmlErr.message}), yt-dlp yedeğine geçiliyor...`);
      try {
        feed = await fetchChannelVideosYtdlp(channel.id, rssLimit);
      } catch (ytdlpErr) {
        if (!/does not have a (videos|streams|shorts) tab/i.test(ytdlpErr.message || '')) {
          console.error(`[RSS] [HATA] ${channel.name} taranamadı:`, ytdlpErr.message);
          addTerminalLog(`[RSS] "${channel.name}" taranamadı (${ytdlpErr.message}).`, 'warn');
        }
      }
    }

    if (feed && feed.items) {
      feed.items.sort((a, b) => {
        const dateA = new Date(a.isoDate || a.pubDate || 0).getTime();
        const dateB = new Date(b.isoDate || b.pubDate || 0).getTime();
        return dateB - dateA;
      });
      
      const itemsToCheck = feed.items.slice(0, rssLimit);
      const reversedItems = [...itemsToCheck].reverse();

      for (const item of reversedItems) {
        const videoId = item.link.match(/v=([^&]+)/)?.[1] || item.id.replace('yt:video:', '');
        
        let db = readDb();
        const existingHistory = db.history.find(h => h.id === videoId);
        const isAlreadyProcessed = !!existingHistory;

        if (isAlreadyProcessed) {
          // Türkçe Açıklama: Eğer video zaten indirilmişse (completed) veya mevcut başlık Türkçe karakter içerip 
          // gelen RSS başlığı ham İngilizce ise, Türkçe başlığın İngilizce ile ezilmesini engelle.
          const hasLocalChars = /[ığüşöçİĞÜŞÖÇ]/.test(existingHistory.title || '');
          const newHasLocalChars = /[ığüşöçİĞÜŞÖÇ]/.test(item.title || '');
          const isCompleted = existingHistory.status === 'completed';

          if (item.title && existingHistory.title !== item.title && !isCompleted && !(hasLocalChars && !newHasLocalChars)) {
            const release = await acquireDbLock();
            try {
              const freshDb = readDb();
              const freshHistory = freshDb.history.find(h => h.id === videoId);
              if (freshHistory && freshHistory.title !== item.title && freshHistory.status !== 'completed') {
                const freshHasLocalChars = /[ığüşöçİĞÜŞÖÇ]/.test(freshHistory.title || '');
                if (!(freshHasLocalChars && !newHasLocalChars)) {
                  console.log(`[RSS] Video başlığı güncelleniyor: "${freshHistory.title}" -> "${item.title}"`);
                  freshHistory.title = item.title;
                  writeDb(freshDb);
                  broadcast('db_update', freshDb);
                }
              }
            } finally {
              release();
            }
          }

          if (
            existingHistory.status === 'upcoming' ||
            existingHistory.duration === 'upcoming' ||
            existingHistory.status === 'live' ||
            existingHistory.duration === 'live' ||
            existingHistory.status === 'waiting_live_processing'
          ) {
            try {
              const liveHandling = db.settings?.liveStreamHandling || 'instant_retry';
              if (liveHandling !== 'ignore_live') {
                const result = await fetchVideoDuration(videoId);
                if (result && !result.isUnavailable && result.duration) {
                  if (result.duration === 'live' && !result.isLiveProcessing && (existingHistory.duration !== 'live' || existingHistory.status === 'upcoming')) {
                    console.log(`[RSS] Upcoming video is now LIVE: ${item.title}`);
                    addTerminalLog(`[RSS] "${item.title}" yayını CANLI olarak başladı! (${channel.name})`, 'info');
                    const release = await acquireDbLock();
                    try {
                      const freshDb = readDb();
                      const freshHistory = freshDb.history.find(h => h.id === videoId);
                      if (freshHistory) {
                        freshHistory.duration = 'live';
                        freshHistory.status = liveHandling === 'vod_only' ? 'waiting_live_processing' : 'live';
                        delete freshHistory.error;
                        writeDb(freshDb);
                        broadcast('db_update', freshDb);
                      }
                    } finally {
                      release();
                    }
                  } else if (result.duration !== 'upcoming' && result.duration !== 'live') {
                    console.log(`[RSS] Upcoming/live video is now published/completed: ${item.title}`);
                    addTerminalLog(`[RSS] Yaklaşan/Canlı yayın artık normal video halinde yayında: "${item.title}" (${channel.name})`, 'info');

                    let lockReleased = false;
                    const release = await acquireDbLock();
                    try {
                      const freshDb = readDb();
                      const freshHistory = freshDb.history.find(h => h.id === videoId);
                      if (
                        freshHistory &&
                        freshHistory.status !== 'completed' &&
                        freshHistory.status !== 'downloading' &&
                        freshHistory.status !== 'waiting'
                      ) {
                        freshHistory.duration = result.duration;
                        delete freshHistory.error;
                        if (result.publishedAt) {
                          freshHistory.publishedAt = result.publishedAt;
                        }

                        const channelConfig = freshDb.channels.find(c => c.id === channel.id);
                        if (freshDb.settings.autoDownload && (channelConfig ? channelConfig.autoDownload !== false : true)) {
                          const downloadShorts = channelConfig ? channelConfig.downloadShorts !== false : true;
                          const shortsLimit = (channelConfig && channelConfig.shortsDurationLimit !== undefined) ? channelConfig.shortsDurationLimit : 180;

                          let shouldDownload = true;
                          if (!downloadShorts && isShortDuration(result.duration, shortsLimit)) {
                            shouldDownload = false;
                            freshHistory.status = 'ignored';
                            console.log(`Short video detected and channel doesn't allow shorts. Ignoring: ${item.title}`);
                          }

                          if (shouldDownload) {
                            freshHistory.status = 'waiting';
                            const convertedQueueObj = {
                              id: videoId,
                              title: item.title,
                              channelId: channel.id,
                              channelName: channel.name,
                              url: item.link,
                              publishedAt: freshHistory.publishedAt,
                              duration: result.duration || ''
                            };
                            let convertedFakap = null;
                            const fakapPair = buildFakapPairIfEligible(freshDb, convertedQueueObj);
                            if (fakapPair) {
                              freshDb.history.push(fakapPair.historyObj);
                              convertedFakap = fakapPair.queueObj;
                            }
                            writeDb(freshDb);
                            broadcast('db_update', freshDb);

                            lockReleased = true;
                            release();

                            await downloadQueue.add(convertedQueueObj);
                            if (convertedFakap) {
                              await downloadQueue.add(convertedFakap);
                            }
                          } else {
                            writeDb(freshDb);
                            broadcast('db_update', freshDb);
                          }
                        } else {
                          freshHistory.status = 'ignored';
                          writeDb(freshDb);
                          broadcast('db_update', freshDb);
                        }
                      }
                    } finally {
                      if (!lockReleased) {
                        release();
                      }
                    }
                  }
                }
              }
            } catch (e) {
              console.error(`Error checking upcoming/live video status for ${videoId}:`, e.message);
            }
          }
        } else {
          let publishDateStr = item.isoDate || item.pubDate;
          let duration = '';

          // Türkçe Açıklama: Eğer yayınlanma tarihi boş gelirse (yt-dlp flat-playlist sınırlaması nedeniyle),
          // tarih kontrolünden önce YouTube'dan detayları çekerek eski video olup olmadığını doğrula.
          if (!publishDateStr) {
            try {
              const result = await fetchVideoDuration(videoId);
              if (result) {
                if (result.publishedAt) publishDateStr = result.publishedAt;
                if (result.duration) duration = result.duration;
              }
            } catch (e) {
              console.error(`[RSS] Detayları önceden çekme hatası (${videoId}):`, e.message);
            }
          }

          const channelHist = db.history.filter(h => (h.channelId === channel.id || h.channelName === channel.name) && h.publishedAt && h.publishedAt !== '-');
          let latestHistTime = 0;
          if (channelHist.length > 0) {
            const valid = channelHist.map(h => new Date(h.publishedAt).getTime()).filter(t => !isNaN(t) && t > 0);
            if (valid.length > 0) latestHistTime = Math.max(...valid);
          }

          let isHistoricalVideo = false;
          if (publishDateStr) {
            const pubTime = new Date(publishDateStr).getTime();
            if (latestHistTime > 0) {
              if (pubTime < (latestHistTime - 60000)) {
                isHistoricalVideo = true;
              }
            } else if (channel.addedAt) {
              const addedTime = new Date(channel.addedAt).getTime();
              if (pubTime < (addedTime - 60000)) {
                isHistoricalVideo = true;
              }
            } else if ((Date.now() - pubTime) > (48 * 60 * 60 * 1000)) {
              isHistoricalVideo = true;
            }
          }

          if (isFirstStart || isHistoricalVideo) {
            const release = await acquireDbLock();
            try {
              const freshDb = readDb();
              const existingItem = freshDb.history.find(h => h.id === videoId);
              if (!existingItem) {
                freshDb.history.push(createHistoryItem(
                  videoId,
                  item.title,
                  channel.id,
                  channel.name,
                  publishDateStr,
                  duration,
                  freshDb.settings
                ));
                writeDb(freshDb);
              } else if (item.title && existingItem.title !== item.title && existingItem.status !== 'completed') {
                const histIsTr = /[ığüşöçİĞÜŞÖÇ]/.test(existingItem.title || '');
                const itemIsTr = /[ığüşöçİĞÜŞÖÇ]/.test(item.title || '');
                if (!histIsTr || itemIsTr) {
                  console.log(`[RSS İlk Ekleme] Video başlığı Türkçe ile güncelleniyor: "${existingItem.title}" -> "${item.title}"`);
                  existingItem.title = item.title;
                  writeDb(freshDb);
                  broadcast('db_update', freshDb);
                }
              }
            } finally {
              release();
            }
          } else {
            console.log(`[RSS] Yeni video keşfedildi: ${item.title}`);
            addTerminalLog(`[RSS] Yeni video keşfedildi: "${item.title}" (${channel.name})`, 'success');
            
            let publishedAt = publishDateStr;
            
            // Eğer süre hala alınmamışsa (başlangıçta publishDateStr vardı ama süresi yoksa) detayları çek
            if (!duration) {
              try {
                const result = await fetchVideoDuration(videoId);
                if (result) {
                  if (result.duration) duration = result.duration;
                  if (result.publishedAt) publishedAt = result.publishedAt;
                }
              } catch (e) {
                console.error('Error fetching duration for newly discovered video:', e.message);
              }
            }

            // Türkçe Açıklama: fetchVideoDuration başarısız olduysa ve waterfall modu aktif değilse yt-dlp ile yedek süre kontrolü yap.
            // Bu sayede Shorts kanalında downloadShorts=false olan videoların kuyruğa alınmadan önce
            // süresi kesin olarak bilinir ve atlama işlemi doğru çalışır.
            const freshDb = readDb();
            const method = freshDb.settings?.durationFetchMethod || 'auto';
            if (!duration && method !== 'waterfall') {
              try {
                const ytdlpDuration = await fetchDurationViaYtdlp(videoId);
                if (ytdlpDuration) {
                  duration = ytdlpDuration;
                  console.log(`[RSS] yt-dlp yedek süre tespiti başarılı: ${translatedTitle} -> ${duration}`);
                  addTerminalLog(`[RSS] yt-dlp yedek süre tespiti: "${translatedTitle}" -> ${duration}`, 'info');
                }
              } catch (ytdlpErr) {
                console.error(`[RSS] yt-dlp yedek süre tespiti de başarısız: ${translatedTitle}:`, ytdlpErr.message);
              }
            }


            const release = await acquireDbLock();
            let addedVideo = null;
            try {
              const freshDb = readDb();
              const historyItem = createHistoryItem(
                videoId,
                translatedTitle,
                channel.id,
                channel.name,
                publishedAt,
                duration,
                freshDb.settings
              );

              const channelConfig = freshDb.channels.find(c => c.id === channel.id);
              const downloadShorts = channelConfig ? channelConfig.downloadShorts !== false : true;
              const shortsLimit = (channelConfig && channelConfig.shortsDurationLimit !== undefined) ? channelConfig.shortsDurationLimit : 180;

              const liveHandling = freshDb.settings.liveStreamHandling || 'instant_retry';

              const isAutoDownloadDisabled = !freshDb.settings.autoDownload || (channelConfig ? channelConfig.autoDownload === false : false);

              if (isAutoDownloadDisabled) {
                shouldDownload = false;
                historyItem.status = 'ignored';
                console.log(`Auto-download disabled. Ignoring: ${item.title}`);
              } else if (liveHandling === 'ignore_live' && (duration === 'upcoming' || duration === 'live')) {
                shouldDownload = false;
                historyItem.status = 'ignored';
                console.log(`Live stream / premiere ignored per user settings: ${item.title}`);
              } else if (liveHandling === 'vod_only' && (duration === 'upcoming' || duration === 'live')) {
                shouldDownload = false;
                historyItem.status = duration === 'upcoming' ? 'upcoming' : 'waiting_live_processing';
                console.log(`Live stream detected. Deferring download until VOD conversion: ${item.title}`);
              } else if (duration === 'upcoming') {
                shouldDownload = false;
                historyItem.status = 'upcoming';
                console.log(`Upcoming premiere/stream detected. Tracking until broadcast finishes: ${item.title}`);
              } else if (duration === 'live') {
                shouldDownload = true;
                historyItem.status = 'waiting';
                console.log(`Live stream detected. Queueing for instant download attempt: ${item.title}`);
              } else if (!downloadShorts && !duration) {
                shouldDownload = false;
                historyItem.status = 'waiting_duration';
                console.log(`[RSS] Video süresi henüz çözülmedi ve kanal shorts istemiyor. Süre analizi bekleniyor: ${item.title}`);
              } else if (!downloadShorts && isShortDuration(duration, shortsLimit)) {
                shouldDownload = false;
                historyItem.status = 'ignored';
                console.log(`Short video detected and channel doesn't allow shorts. Ignoring: ${item.title}`);
              } else {
                historyItem.status = 'waiting';
              }

              let addedFakapVideo = null;
              if (!freshDb.history.some(h => h.id === videoId)) {
                freshDb.history.push(historyItem);
                if (shouldDownload) {
                  addedVideo = {
                    id: videoId,
                    title: item.title,
                    channelId: channel.id,
                    channelName: channel.name,
                    url: item.link,
                    publishedAt: publishedAt,
                    duration: duration || ''
                  };
                  const fakapPair = buildFakapPairIfEligible(freshDb, addedVideo);
                  if (fakapPair) {
                    freshDb.history.push(fakapPair.historyObj);
                    addedFakapVideo = fakapPair.queueObj;
                  }
                }
                writeDb(freshDb);
              }

            if (addedVideo) {
              await downloadQueue.add(addedVideo);
            }
            if (addedFakapVideo) {
              await downloadQueue.add(addedFakapVideo);
              addTerminalLog(`[RSS Fakap] Kuyruğa alındı: "${addedFakapVideo.title}" (${channel.name})`, 'info');
            }
          } finally {
            release();
          }
          }
        }
      }
    }
  } catch (err) {
    console.error(`[RSS Loop Error] ${channel.name} RSS check failed:`, err.message);
    addTerminalLog(`[RSS HATA] ${channel.name} kontrolü başarısız oldu: ${err.message}`, 'error');
  }
}

/**
 * Kanalın kendi filtrelerinden (Otomatik İndir, Shorts / Süre Sınırı vb.) geçerek
 * normal indirme kuyruğuna girmeye hak kazanmış bir video için,
 * eğer Genel Fakap Anahtarı (settings.fakapEnabled !== false) VE kanalın Fakap ayarı açıksa
 * Fakap geçmiş ve kuyruk nesnelerini oluşturur.
 */
function buildFakapPairIfEligible(db, videoInfo, extraHistoryList = []) {
  if (!db || !videoInfo || !videoInfo.id || !videoInfo.channelId) return null;
  // 1. Genel Fakap Anahtarı (Master Switch) kapalıysa hiçbir kanal Fakap indirmesi yapamaz
  if (db.settings && db.settings.fakapEnabled === false) return null;

  const rawId = String(videoInfo.id).replace(/^fakap_/, '');
  const fakapId = `fakap_${rawId}`;
  const fakapChannelIds = db.fakap?.channelIds || [];
  const fakapDeletedIds = db.fakap?.deletedIds || [];

  // 2. Kanalın kendi Fakap seçeneği açık olmalı ve video daha önce silinmemiş olmalı
  if (!fakapChannelIds.includes(videoInfo.channelId) || fakapDeletedIds.includes(rawId)) {
    return null;
  }

  // 3. Kanalın Fakap'a açıldığı tarihten önceki eski videoları alma
  const enabledAtStr = db.fakap?.enabledAt?.[videoInfo.channelId];
  const enabledAtMs = enabledAtStr ? new Date(enabledAtStr).getTime() : 0;
  const pubStr = videoInfo.publishedAt || new Date().toISOString();
  const fakapPubMs = new Date(pubStr).getTime();
  const isEligibleTime = !enabledAtMs || isNaN(fakapPubMs) || (fakapPubMs >= (enabledAtMs - 60000));
  if (!isEligibleTime) return null;

  // 4. Zaten Fakap geçmişinde varsa tekrar ekleme
  const alreadyInFakap = (db.history || []).some(h => h.id === fakapId) ||
    extraHistoryList.some(h => h.id === fakapId);
  if (alreadyInFakap) return null;

  const historyObj = {
    id: fakapId,
    originalId: rawId,
    isFakap: true,
    title: videoInfo.title || '',
    channelId: videoInfo.channelId,
    channelName: videoInfo.channelName || '',
    thumbnail: `https://i.ytimg.com/vi/${rawId}/mqdefault.jpg`,
    downloadedAt: new Date().toISOString(),
    publishedAt: pubStr,
    status: 'waiting',
    progress: 0,
    speed: '',
    eta: '',
    fileSize: '',
    filePath: '',
    isStandalone: false,
    duration: videoInfo.duration || ''
  };

  const queueObj = {
    id: fakapId,
    originalId: rawId,
    isFakap: true,
    title: videoInfo.title || '',
    channelId: videoInfo.channelId,
    channelName: videoInfo.channelName || '',
    url: videoInfo.url || `https://www.youtube.com/watch?v=${rawId}`,
    publishedAt: pubStr,
    duration: videoInfo.duration || ''
  };

  return { historyObj, queueObj };
}

/**
 * Veritabanındaki süresi veya yayınlanma tarihi eksik olan videoların detaylarını arka planda tamamlar.
 */
export async function resolveMissingDurations() {
  if (isResolvingDurations) return;
  isResolvingDurations = true;
  
  const db = readDb();
  let updated = false;
  const newFakapHistoryItems = [];
  const newFakapQueueItems = [];

  for (const item of db.history) {
    // Fakap kayıtları için ağdan tekrar süre sorgulama; ana kayıttan eşitle ve atla
    if (item.isFakap || String(item.id || '').startsWith('fakap_')) {
      const rawId = item.originalId || String(item.id || '').replace(/^fakap_/, '');
      const parentItem = db.history.find(h => h.id === rawId);
      if (parentItem) {
        if (!item.duration && parentItem.duration) {
          item.duration = parentItem.duration;
          updated = true;
        }
        if (!item.publishedAt && parentItem.publishedAt) {
          item.publishedAt = parentItem.publishedAt;
          updated = true;
        }
      }
      continue;
    }

    // YouTube harici kaynaklar (X, Instagram, TikTok, Facebook vb.) RSS/Süre çözümleme döngüsünden tamamen hariç tutulur
    const isExternal = String(item.id || '').startsWith('ext_') || (item.source && item.source !== 'youtube') || item.isExternal;
    if (isExternal) {
      continue;
    }

    // Türkçe Açıklama: Gizlenmiş (hidden: true) olan göz ardı edilmiş (ignored) videoların sürelerini sorgulamaya gerek yok;
    // ancak Kütüphane sekmesinde görünür olan (hidden !== true) videoların süresi veya yayın tarihi eksikse mutlaka çözülür.
    if (item.status === 'ignored' && item.hidden === true) continue;
    if (item.duration === '-' && item.publishedAt && item.publishedAt !== '-') continue;

    // Türkçe Açıklama: Süresi çözümlenmeyi bekleyen (waiting_duration) videolardan süresi netleşmiş olanları denetler.
    // Eğer süresi çözülmüşse veya '-' olarak işaretlenmişse ve kanal Shorts istemiyorsa göz ardı eder, aksi halde kuyruğa alır.
    if (item.status === 'waiting_duration' && item.duration) {
      const dbChannels = db.channels || [];
      const channelConfig = dbChannels.find(c => c.id === item.channelId);
      const downloadShorts = channelConfig ? channelConfig.downloadShorts !== false : true;
      const shortsLimit = (channelConfig && channelConfig.shortsDurationLimit !== undefined) ? channelConfig.shortsDurationLimit : 180;
      
      const finalDuration = item.duration;
      const isShort = finalDuration !== '-' && isShortDuration(finalDuration, shortsLimit);
      
      if (!downloadShorts && isShort) {
        item.status = 'ignored';
        updated = true;
        console.log(`[resolveMissingDurations Recovery] Kısa video tespit edildi ve kanal Shorts istemiyor. Göz ardı ediliyor: ${item.title}`);
      } else if (!downloadShorts && finalDuration === '-') {
        item.status = 'ignored';
        updated = true;
        console.log(`[resolveMissingDurations Recovery] Süresi çözümlenemeyen video, kanal Shorts istemediği için güvenlik amacıyla göz ardı ediliyor: ${item.title}`);
      } else {
        item.status = 'waiting';
        updated = true;
        console.log(`[resolveMissingDurations Recovery] Video kuyruğa ekleniyor: ${item.title}`);
        const videoToQueue = {
          id: item.id,
          title: item.title,
          channelId: item.channelId,
          channelName: item.channelName,
          url: `https://www.youtube.com/watch?v=${item.id}`,
          publishedAt: item.publishedAt || '',
          duration: finalDuration
        };
        downloadQueue.add(videoToQueue);
        if (!channelConfig || channelConfig.autoDownload !== false) {
          const fakapPair = buildFakapPairIfEligible(db, videoToQueue, newFakapHistoryItems);
          if (fakapPair) {
            newFakapHistoryItems.push(fakapPair.historyObj);
            newFakapQueueItems.push(fakapPair.queueObj);
          }
        }
      }
      continue;
    }

    const needsDuration = !item.duration;
    const needsPublishDate = !item.publishedAt;
    if (needsDuration || needsPublishDate) {
      console.log(`Eksik bilgiler çözümleniyor: ${item.title}`);
      try {
        let duration = '';
        let publishedAt = '';
        let result = null;

        // 1. Dosya diskte mevcutsa en kesin ve hızlı süre tespiti
        if (item.filePath && fs.existsSync(item.filePath)) {
          const fileDur = getVideoDurationFromFile(item.filePath);
          if (fileDur && fileDur.duration) {
            duration = fileDur.duration;
            item.durationSeconds = fileDur.durationSeconds;
          }
        }

        // 2. YouTube videosu ise HTTP / yt-dlp ile çöz
        const isYouTube = !String(item.id).startsWith('ext_') && /^[a-zA-Z0-9_-]{11}$/.test(String(item.id).replace(/^fakap_/, ''));
        if (isYouTube) {
          result = await fetchVideoDuration(item.id);
          if (result && result.duration) duration = duration || result.duration;
          if (result && result.publishedAt) publishedAt = result.publishedAt;

          const method = db.settings?.durationFetchMethod || 'auto';
          if (!duration && needsDuration && method !== 'waterfall') {
            try {
              const ytdlpDuration = await fetchDurationViaYtdlp(item.id);
              if (ytdlpDuration) {
                duration = ytdlpDuration;
                console.log(`[resolveMissingDurations] yt-dlp yedek süre çözümü başarılı: ${item.title} -> ${duration}`);
              }
            } catch (ytdlpErr) {
              console.error(`[resolveMissingDurations] yt-dlp yedek süre alma hatası (${item.title}):`, ytdlpErr.message);
            }
          }
        }

        let itemUpdated = false;
        if (duration && needsDuration) {
          item.duration = duration;
          itemUpdated = true;
        }
        if (publishedAt && needsPublishDate) {
          item.publishedAt = publishedAt;
          itemUpdated = true;
        }
        if (result && result.title && item.title !== result.title) {
          const itemIsTr = /[ığüşöçİĞÜŞÖÇ]/.test(item.title || '');
          const resultIsTr = /[ığüşöçİĞÜŞÖÇ]/.test(result.title || '');
          if (!itemIsTr || resultIsTr) {
            item.title = result.title;
            itemUpdated = true;
          }
        }
        if (result && result.channelName && item.channelName !== result.channelName) {
          item.channelName = result.channelName;
          itemUpdated = true;
        }
        
        if ((!duration && needsDuration) || (!publishedAt && needsPublishDate)) {
          item.resolveAttempts = (item.resolveAttempts || 0) + 1;
          if (item.resolveAttempts >= 3) {
            if (needsDuration) item.duration = '-';
            if (needsPublishDate) item.publishedAt = '-';
          }
          itemUpdated = true;
        }


        if (item.status === 'waiting_duration' && (duration || item.duration === '-')) {
          const dbChannels = db.channels || [];
          const channelConfig = dbChannels.find(c => c.id === item.channelId);
          const downloadShorts = channelConfig ? channelConfig.downloadShorts !== false : true;
          const shortsLimit = (channelConfig && channelConfig.shortsDurationLimit !== undefined) ? channelConfig.shortsDurationLimit : 180;
          
          const finalDuration = duration || item.duration || '-';
          const isShort = finalDuration !== '-' && isShortDuration(finalDuration, shortsLimit);
          
          if (!downloadShorts && isShort) {
            item.status = 'ignored';
            itemUpdated = true;
            console.log(`[resolveMissingDurations] Kısa video tespit edildi ve kanal Shorts izin vermiyor. Göz ardı ediliyor: ${item.title}`);
          } else if (!downloadShorts && finalDuration === '-') {
            item.status = 'ignored';
            itemUpdated = true;
            console.log(`[resolveMissingDurations] Süresi çözümlenemeyen video, kanal Shorts izin vermediği için güvenlik amacıyla göz ardı ediliyor: ${item.title}`);
          } else {
            item.status = 'waiting';
            itemUpdated = true;
            console.log(`[resolveMissingDurations] Süre analizi tamamlandı (Süre: ${finalDuration}), video kuyruğa ekleniyor: ${item.title}`);
            const videoToQueue = {
              id: item.id,
              title: item.title,
              channelId: item.channelId,
              channelName: item.channelName,
              url: `https://www.youtube.com/watch?v=${item.id}`,
              publishedAt: item.publishedAt || '',
              duration: finalDuration
            };
            downloadQueue.add(videoToQueue);
            if (!channelConfig || channelConfig.autoDownload !== false) {
              const fakapPair = buildFakapPairIfEligible(db, videoToQueue, newFakapHistoryItems);
              if (fakapPair) {
                newFakapHistoryItems.push(fakapPair.historyObj);
                newFakapQueueItems.push(fakapPair.queueObj);
              }
            }
          }
        }

        if (itemUpdated) {
          updated = true;
        }
      } catch (err) {
        console.error(`Eksik bilgi çözümleme hatası (${item.title}):`, err.message);
      }
    }
  }

  if (newFakapHistoryItems.length > 0) {
    for (const fh of newFakapHistoryItems) {
      if (!db.history.some(h => h.id === fh.id)) {
        db.history.push(fh);
        updated = true;
      }
    }
  }

  if (updated) {
    writeDb(db);
    broadcast('db_update', readDb());
  }

  if (newFakapQueueItems.length > 0) {
    for (const fq of newFakapQueueItems) {
      await downloadQueue.add(fq);
      addTerminalLog(`[RSS Fakap] Süre filtresinden geçti, kuyruğa alındı: "${fq.title}" (${fq.channelName})`, 'info');
    }
  }
  isResolvingDurations = false;

  // Türkçe Açıklama: Süre çözümü bittiğinde ertelenmiş bir kanal taraması varsa otomatik olarak başlatılır.
  if (hasDeferredChannelCheck) {
    const nextSource = deferredChannelCheckSource || 'startup';
    hasDeferredChannelCheck = false;
    deferredChannelCheckSource = null;
    const resumeMsg = `[Kanal Kontrolü] Bekleyen süre analizleri tamamlandı. Ertelenen kanal taraması (${nextSource}) otomatik başlatılıyor...`;
    console.log(resumeMsg);
    addTerminalLog(resumeMsg, 'info');
    setTimeout(() => {
      triggerChannelCheck(nextSource);
    }, 1500);
  }
}

/**
 * Takip edilen tüm kanalların RSS beslemelerini paralel olarak denetler,
 * yeni videoları tespit edip veritabanına kaydeder ve indirme kuyruğuna ekler.
 * 
 * @returns {Promise<object>} Denetleme sonuç özetini içeren nesne
 */
export async function checkAllChannelsRssParallel() {
  const startTime = Date.now();
  const db = readDb();
  if (!db.channels || db.channels.length === 0) {
    return { success: true, totalChannels: 0, newVideos: 0, duration: 0 };
  }

  const total = db.channels.length;
  
  addTerminalLog(`[RSS] ${total} kanal için ⚡ Hızlı Tarama başlatılıyor...`, 'info');
  console.log(`[RSS] ${total} kanal için ⚡ Hızlı Tarama başlatılıyor...`);

  const rssLimit = db.settings.rssLimit || 5;
  
  const checkSingleChannel = async (channel) => {
    let feed = null;
    try {
      feed = await fetchChannelVideosXml(channel.id);
    } catch (xmlErr) {
      try {
        feed = await fetchChannelVideosYtdlp(channel.id, rssLimit);
      } catch (ytdlpErr) {
        if (!/does not have a (videos|streams|shorts) tab/i.test(ytdlpErr.message || '')) {
          console.log(`[RSS] "${channel.name}" atlandı (${ytdlpErr.message})`);
          addTerminalLog(`[RSS] "${channel.name}" atlandı (${ytdlpErr.message}).`, 'warn');
        }
      }
    }
    return { channel, feed };
  };

  // 15'erli gruplar halinde paralel tarama (101 kanalın aynı anda sunucuya yük bindirip engellenmesini ve kilitlenmesini önler)
  const BATCH_SIZE = 15;
  const results = [];
  let processedCount = 0;
  for (let i = 0; i < db.channels.length; i += BATCH_SIZE) {
    // Türkçe Açıklama: Yalnızca fiziksel olarak aktif bir indirme/dönüştürme sürüyorsa kanal taramasını beklet. Liste duraklatılmışken kuyrukta bekleyen videolar taramayı engellemez.
    let pausedLogged = false;
    while (downloadQueue && !downloadQueue.isPaused && (downloadQueue.activeDownloads > 0 || (downloadQueue.activeProcesses && downloadQueue.activeProcesses.size > 0))) {
      if (!pausedLogged) {
        console.log(`[RSS] Aktif video indirmesi tespit edildi. Kanal taraması indirme bitene kadar duraklatıldı...`);
        addTerminalLog(`[RSS] Aktif video indirmesi nedeniyle kanal taraması duraklatıldı (İndirme bitince devam edecek).`, 'info');
        pausedLogged = true;
      }
      await new Promise(res => setTimeout(res, 2000));
    }
    if (pausedLogged) {
      console.log(`[RSS] Video indirmesi tamamlandı, kanal taramasına kaldığı yerden devam ediliyor...`);
      addTerminalLog(`[RSS] Video indirmesi bitti, kanal taramasına devam ediliyor.`, 'info');
    }

    const batch = db.channels.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.allSettled(batch.map(checkSingleChannel));
    results.push(...batchResults);
    processedCount += batch.length;

    const percent = Math.min(100, Math.round((processedCount / total) * 100));
    const logMsg = `[RSS] Kanallar kontrol ediliyor... (${processedCount}/${total} - %${percent})`;
    addTerminalLog(logMsg, 'info');
    console.log(logMsg);
    broadcast('rss_progress', { processed: processedCount, total, percent });
  }

  let newVideosCount = 0;
  const videosToQueue = [];
  const historyToAdd = [];
  const historyToUpdate = [];

  // Veritabanı durumunu tek seferde kilitlemek için okuyalım
  const freshDb = readDb();

  for (const result of results) {
    if (result.status !== 'fulfilled' || !result.value || !result.value.feed) {
      continue;
    }

    const { channel, feed } = result.value;
    if (!feed.items || feed.items.length === 0) continue;


    // Türkçe Açıklama: Kanal geçmişindeki en son videonun yayınlanma tarihini referans almak için bul
    const channelHistory = freshDb.history.filter(h => (h.channelId === channel.id || h.channelName === channel.name) && h.publishedAt && h.publishedAt !== '-');
    let latestHistoryTime = 0;
    if (channelHistory.length > 0) {
      const validTimes = channelHistory.map(h => new Date(h.publishedAt).getTime()).filter(t => !isNaN(t) && t > 0);
      if (validTimes.length > 0) {
        latestHistoryTime = Math.max(...validTimes);
      }
    }

    // RSS limitini ayardan çekelim
    const rssLimit = freshDb.settings.rssLimit || 5;
    
    // Tarihe göre sıralayıp limit kadarını alalım
    const sortedItems = [...feed.items].sort((a, b) => {
      const dateA = new Date(a.isoDate || a.pubDate || 0).getTime();
      const dateB = new Date(b.isoDate || b.pubDate || 0).getTime();
      return dateB - dateA;
    });

    const itemsToCheck = sortedItems.slice(0, rssLimit);
    const reversedItems = [...itemsToCheck].reverse();

    for (const item of reversedItems) {
      const videoId = item.link?.match(/v=([^&]+)/)?.[1] || item.id?.replace('yt:video:', '');
      if (!videoId) continue;

      const existingHistory = freshDb.history.find(h => h.id === videoId);

      if (existingHistory) {
        // Başlık güncellenmişse ve mevcut Türkçe başlığı bozmayacaksa listeye alalım
        if (item.title && existingHistory.title !== item.title) {
          const existingIsTr = /[ığüşöçİĞÜŞÖÇ]/.test(existingHistory.title);
          const newIsTr = /[ığüşöçİĞÜŞÖÇ]/.test(item.title);
          if (!existingIsTr || newIsTr) {
            historyToUpdate.push({ id: videoId, title: item.title });
          }
        }

        // Türkçe Açıklama: Yaklaşan veya Canlı yayın durumundaki videoların yayınlanıp yayınlanmadığını kontrol et
        if (
          existingHistory.status === 'upcoming' ||
          existingHistory.duration === 'upcoming' ||
          existingHistory.status === 'live' ||
          existingHistory.duration === 'live' ||
          existingHistory.status === 'waiting_live_processing'
        ) {
          try {
            const liveHandling = freshDb.settings?.liveStreamHandling || 'instant_retry';
            if (liveHandling !== 'ignore_live') {
              const result = await fetchVideoDuration(videoId);
              if (result && !result.isUnavailable && result.duration) {
                if (result.duration === 'live' && !result.isLiveProcessing && (existingHistory.duration !== 'live' || existingHistory.status === 'upcoming')) {
                  addTerminalLog(`[RSS Paralel] "${item.title}" yayını CANLI olarak başladı! (${channel.name})`, 'info');
                  const release = await acquireDbLock();
                  try {
                    const latestDb = readDb();
                    const freshHistory = latestDb.history.find(h => h.id === videoId);
                    if (freshHistory) {
                      freshHistory.duration = 'live';
                      freshHistory.status = liveHandling === 'vod_only' ? 'waiting_live_processing' : 'live';
                      delete freshHistory.error;
                      writeDb(latestDb);
                      broadcast('db_update', latestDb);
                    }
                  } finally {
                    release();
                  }
                } else if (result.duration !== 'upcoming' && result.duration !== 'live') {
                  addTerminalLog(`[RSS Paralel] Yaklaşan/Canlı yayın videoya dönüştü: "${item.title}" (${channel.name})`, 'info');
                  let videoToAdd = null;
                  let fakapToAdd = null;
                  const release = await acquireDbLock();
                  try {
                    const latestDb = readDb();
                    const freshHistory = latestDb.history.find(h => h.id === videoId);
                    const channelConfig = latestDb.channels.find(c => c.id === channel.id);
                    const autoDownload = latestDb.settings.autoDownload && (channelConfig ? channelConfig.autoDownload !== false : true);
                    const downloadShorts = channelConfig ? channelConfig.downloadShorts !== false : true;
                    const shortsLimit = (channelConfig && channelConfig.shortsDurationLimit !== undefined) ? channelConfig.shortsDurationLimit : 180;

                    if (
                      freshHistory &&
                      freshHistory.status !== 'completed' &&
                      freshHistory.status !== 'downloading' &&
                      freshHistory.status !== 'waiting'
                    ) {
                      freshHistory.duration = result.duration;
                      delete freshHistory.error;
                      if (result.publishedAt) {
                        freshHistory.publishedAt = result.publishedAt;
                      }
                      if (!autoDownload) {
                        freshHistory.status = 'ignored';
                        writeDb(latestDb);
                        broadcast('db_update', latestDb);
                        console.log(`[RSS Paralel] Auto-download disabled for channel ${channel.name}. Ignoring converted video: ${item.title}`);
                      } else if (!downloadShorts && isShortDuration(result.duration, shortsLimit)) {
                        freshHistory.status = 'ignored';
                        writeDb(latestDb);
                        broadcast('db_update', latestDb);
                        console.log(`[RSS Paralel] Short video detected. Ignoring converted video: ${item.title}`);
                      } else {
                        freshHistory.status = 'waiting';
                        videoToAdd = {
                          id: videoId,
                          title: item.title,
                          channelId: channel.id,
                          channelName: channel.name,
                          url: item.link,
                          publishedAt: freshHistory.publishedAt,
                          duration: result.duration || ''
                        };
                        const fakapPair = buildFakapPairIfEligible(latestDb, videoToAdd);
                        if (fakapPair) {
                          latestDb.history.push(fakapPair.historyObj);
                          fakapToAdd = fakapPair.queueObj;
                        }
                        writeDb(latestDb);
                        broadcast('db_update', latestDb);
                      }
                    }
                  } finally {
                    release();
                  }

                  if (videoToAdd) {
                    await downloadQueue.add(videoToAdd);
                  }
                  if (fakapToAdd) {
                    await downloadQueue.add(fakapToAdd);
                    addTerminalLog(`[RSS Fakap] Kuyruğa alındı: "${item.title}" (${channel.name})`, 'info');
                  }
                }
              }
            }
          } catch (e) {
            console.error(`[RSS Paralel] Yaklaşan/Canlı yayın durumu kontrolünde hata (${item.title}):`, e.message);
          }
        }
      } else {
        // Yeni video keşfedildi
        const checkIsHistorical = (dateStr) => {
          if (!dateStr) return true; // Tarih yoksa güvenli mod: eski video kabul edilir
          const pTime = new Date(dateStr).getTime();
          if (isNaN(pTime)) return true;
          const nowTime = Date.now();
          if (latestHistoryTime > 0) {
            return pTime < (latestHistoryTime - 60000);
          }
          if (channel.addedAt) {
            const addedTime = new Date(channel.addedAt).getTime();
            if (!isNaN(addedTime) && pTime < (addedTime - 60000)) {
              return true;
            }
          }
          return (nowTime - pTime) > (48 * 60 * 60 * 1000);
        };

        let initialDate = item.isoDate || item.pubDate || '';
        let duration = '';

        // Türkçe Açıklama: Eğer yayınlanma tarihi boş gelirse (yt-dlp flat-playlist sınırlaması nedeniyle),
        // sahte "bugün" tarihi basmak yerine YouTube'dan gerçek yayın tarihini ve süresini çek.
        if (!initialDate) {
          try {
            const result = await fetchVideoDuration(videoId);
            if (result) {
              if (result.publishedAt) initialDate = result.publishedAt;
              if (result.duration) duration = result.duration;
            }
          } catch (e) {
            console.error(`[RSS Paralel] Detayları önceden çekme hatası (${videoId}):`, e.message);
          }
        }

        let isHistoricalVideo = checkIsHistorical(initialDate);
        let publishDateStr = initialDate || '';

        const historyItem = createHistoryItem(
          videoId,
          item.title,
          channel.id,
          channel.name,
          publishDateStr,
          duration, // Süre henüz çözülmediyse resolveMissingDurations arka planda tamamlayacak
          freshDb.settings
        );

        const channelConfig = freshDb.channels.find(c => c.id === channel.id);

        // Tarihi geçmiş video ise indirme kuyruğuna almayacağız, sadece geçmişe ekleyeceğiz
        if (isHistoricalVideo && initialDate) {
          historyItem.status = 'ignored';
          historyToAdd.push(historyItem);
        } else {
          // İndirme veya detay kontrolü (tarihi bilinmeyen veya yeni videolar)
          const autoDownload = freshDb.settings.autoDownload && (channelConfig ? channelConfig.autoDownload !== false : true);

          if (autoDownload) {
            let publishedAt = publishDateStr;

            // Eğer süre veya tarih henüz netleşmediyse detayları çek
            if (!duration || !publishedAt) {
              try {
                const result = await fetchVideoDuration(videoId);
                if (result) {
                  if (result.duration) duration = result.duration;
                  if (result.publishedAt) {
                    publishedAt = result.publishedAt;
                    publishDateStr = result.publishedAt;
                    // Gerçek yayın tarihine göre tarihi geçmişlik kontrolünü güncelle
                    isHistoricalVideo = checkIsHistorical(publishedAt);
                  }
                }
              } catch (e) {
                console.error(`[RSS Paralel] Error fetching duration for newly discovered video:`, e.message);
              }
            }

            // Eğer fetchVideoDuration başarısız olduysa ve waterfall modu aktif değilse yt-dlp ile yedek süre kontrolü yap
            const freshDb = readDb();
            const method = freshDb.settings?.durationFetchMethod || 'auto';
            if (!duration && method !== 'waterfall') {
              try {
                const ytdlpDuration = await fetchDurationViaYtdlp(videoId);
                if (ytdlpDuration) {
                  duration = ytdlpDuration;
                  console.log(`[RSS Paralel] yt-dlp yedek süre tespiti başarılı: ${item.title} -> ${duration}`);
                  addTerminalLog(`[RSS Paralel] yt-dlp yedek süre tespiti: "${item.title}" -> ${duration}`, 'info');
                }
              } catch (ytdlpErr) {
                console.error(`[RSS Paralel] yt-dlp yedek süre tespiti de başarısız: ${item.title}:`, ytdlpErr.message);
              }
            }

            const downloadShorts = channelConfig ? channelConfig.downloadShorts !== false : true;
            const shortsLimit = (channelConfig && channelConfig.shortsDurationLimit !== undefined) ? channelConfig.shortsDurationLimit : 180;
            const liveHandling = freshDb.settings?.liveStreamHandling || 'instant_retry';

            let shouldDownload = true;
            if (isHistoricalVideo) {
              // Tarihi geçmiş olduğu teyit edildiyse asla indirilmez
              shouldDownload = false;
              historyItem.status = 'ignored';
              console.log(`[RSS Paralel] Tarihi geçmiş eski video tespit edildi, kuyruğa alınmadı: ${item.title} (${publishedAt})`);
            } else if (liveHandling === 'ignore_live' && (duration === 'upcoming' || duration === 'live')) {
              shouldDownload = false;
              historyItem.status = 'ignored';
              console.log(`[RSS Paralel] Live stream / premiere ignored per user settings: ${item.title}`);
            } else if (liveHandling === 'vod_only' && (duration === 'upcoming' || duration === 'live')) {
              shouldDownload = false;
              historyItem.status = duration === 'upcoming' ? 'upcoming' : 'waiting_live_processing';
              console.log(`[RSS Paralel] Live stream detected. Deferring download until VOD conversion: ${item.title}`);
            } else if (duration === 'upcoming') {
              shouldDownload = false;
              historyItem.status = 'upcoming';
              console.log(`[RSS Paralel] Upcoming video detected. Tracking until broadcast finishes: ${item.title}`);
            } else if (duration === 'live') {
              shouldDownload = true;
              historyItem.status = 'waiting';
              console.log(`[RSS Paralel] Live stream detected. Queueing for instant download attempt: ${item.title}`);
            } else if (!downloadShorts && !duration) {
              shouldDownload = false;
              historyItem.status = 'waiting_duration';
              console.log(`[RSS Paralel] Video süresi henüz çözülmedi ve kanal shorts istemiyor. Süre analizi bekleniyor: ${item.title}`);
            } else if (!downloadShorts && isShortDuration(duration, shortsLimit)) {
              shouldDownload = false;
              historyItem.status = 'ignored';
              console.log(`[RSS Paralel] Short video detected and channel doesn't allow shorts. Ignoring: ${item.title}`);
            } else {
              historyItem.status = 'waiting';
            }

            historyItem.duration = duration;
            historyItem.publishedAt = publishedAt;
            historyToAdd.push(historyItem);

            if (shouldDownload) {
              videosToQueue.push({
                id: videoId,
                title: item.title,
                channelId: channel.id,
                channelName: channel.name,
                url: item.link,
                publishedAt: publishedAt,
                duration: duration
              });
              newVideosCount++;

              // Fakap yedeği: AYNI karara bağlı. Genel Fakap Anahtarı açık + kanalda Fakap açık +
              // kanalın kendi filtrelerinden (Oto-İndir, Shorts / Süre Sınırı vb.) geçen video yedeklenir.
              const fakapPair = buildFakapPairIfEligible(freshDb, {
                id: videoId,
                title: item.title,
                channelId: channel.id,
                channelName: channel.name,
                url: item.link || `https://www.youtube.com/watch?v=${videoId}`,
                publishedAt: publishedAt || publishDateStr,
                duration: duration || ''
              }, historyToAdd);

              if (fakapPair) {
                historyToAdd.push(fakapPair.historyObj);
                videosToQueue.push(fakapPair.queueObj);
                newVideosCount++;
                addTerminalLog(`[RSS Fakap] Kuyruğa alındı: "${item.title}" (${channel.name})`, 'info');
              }
            }
          } else {
            historyItem.status = 'ignored';
            historyToAdd.push(historyItem);
          }
        }
      }
    }
  }

  // Veritabanını güncelleme
  if (historyToAdd.length > 0 || historyToUpdate.length > 0) {
    const release = await acquireDbLock();
    try {
      const finalDb = readDb();
      
      // Yeni geçmiş kayıtlarını ekle (yarış durumunu önlemek için tekrar teyit et)
      for (const item of historyToAdd) {
        if (!finalDb.history.some(h => h.id === item.id)) {
          finalDb.history.push(item);
        }
      }

      // Başlık ve Canlı/Yaklaşan Yayın güncellemelerini yansıt
      for (const update of historyToUpdate) {
        const hItem = finalDb.history.find(h => h.id === update.id);
        if (hItem) {
          if (update.title !== undefined) hItem.title = update.title;
          if (update.duration !== undefined) hItem.duration = update.duration;
          if (update.publishedAt !== undefined) hItem.publishedAt = update.publishedAt;
          if (update.status !== undefined) hItem.status = update.status;
        }
      }

      writeDb(finalDb);
      broadcast('db_update', finalDb);
    } finally {
      release();
    }
  }

  // Videoları indirme kuyruğuna paralel ekleme
  if (videosToQueue.length > 0) {
    for (const video of videosToQueue) {
      console.log(`[RSS Paralel] Yeni video keşfedildi ve kuyruğa ekleniyor: ${video.title}`);
      addTerminalLog(`[RSS Paralel] Yeni video keşfedildi: "${video.title}" (${video.channelName})`, 'success');
      await downloadQueue.add(video);
    }
  }

  const durationSec = ((Date.now() - startTime) / 1000).toFixed(2);
  addTerminalLog(`[RSS] Hızlı Tarama tamamlandı: ${total} kanal ${durationSec} saniyede kontrol edildi. ${newVideosCount} yeni video bulundu.`, 'success');
  console.log(`[RSS] Hızlı Tarama tamamlandı: ${total} kanal ${durationSec} saniyede kontrol edildi. ${newVideosCount} yeni video bulundu.`);

  return {
    success: true,
    totalChannels: total,
    newVideos: newVideosCount,
    duration: durationSec
  };
}

/**
 * Tüm kanalların denetlenmesi işlemini başlatan tek ve modüler kapı (giriş noktası).
 * Zamanlayıcı, Web Arayüzü, Tray Menüsü ve Açılış Taraması gibi tüm tetikleyiciler bu fonksiyonu çağırır.
 * 
 * @param {string} source Tetikleyici kaynağı ('timer' | 'ui' | 'tray' | 'startup' | 'manual')
 * @returns {Promise<object>} Tarama sonuç nesnesi
 */
export async function triggerChannelCheck(source = 'manual') {
  // 1. Kanal bilgileri (abone/avatar) güncellemesi devam ediyorsa video RSS taramasını ertele
  try {
    const { isChannelScanInProgress, channelScanStartTime, setChannelScanInProgress } = await import('../routes/channels.js');
    if (isChannelScanInProgress) {
      const elapsedSec = channelScanStartTime > 0 ? (Date.now() - channelScanStartTime) / 1000 : 0;
      if (channelScanStartTime > 0 && elapsedSec > 300) {
        console.warn(`[Kanal Kontrolü UYARI] Önceki kanal bilgisi taraması zaman aşımına uğradı (${elapsedSec.toFixed(0)} sn). Kilit sıfırlandı.`);
        setChannelScanInProgress(false);
      } else {
        const msg = `[Kanal Kontrolü] Kanal bilgisi (abone/avatar) güncellemesi devam ettiği için video RSS taraması ertelendi (Kaynak: ${source}).`;
        console.log(msg);
        addTerminalLog(msg, 'info');
        return { success: false, deferred: true, message: 'Kanal güncellemesi nedeniyle video RSS taraması ertelendi.' };
      }
    }
  } catch (e) {}

  if (isRssChecking) {
    const elapsedSec = rssCheckStartTime > 0 ? (Date.now() - rssCheckStartTime) / 1000 : 0;
    // 5 dakikadan (300 sn) uzun süredir takılı kalmışsa kilit otomatik sıfırlanır
    if (rssCheckStartTime > 0 && elapsedSec > 300) {
      console.warn(`[Kanal Kontrolü UYARI] Önceki RSS taraması zaman aşımına uğradı (${elapsedSec.toFixed(0)} sn). Kilit otomatik sıfırlandı.`);
      addTerminalLog(`[Kanal Kontrolü UYARI] Önceki RSS taraması zaman aşımına uğradığı için kilit sıfırlandı.`, 'warning');
      isRssChecking = false;
    } else {
      const msg = `[Kanal Kontrolü] Zaten devam eden bir RSS taraması var (Kaynak: ${source}). Yeni istek atlandı.`;
      console.log(msg);
      addTerminalLog(msg, 'info');
      return { success: false, inProgress: true, message: 'Tarama zaten devam ediyor.' };
    }
  }

  // Türkçe Açıklama: YouTube Ban Koruması 1 - Aktif indirme veya dönüştürme işlemi varsa kanal taramasını ertele.
  const hasActiveDownloads = downloadQueue && (
    downloadQueue.activeDownloads > 0 || 
    (downloadQueue.activeProcesses && downloadQueue.activeProcesses.size > 0)
  );

  if (hasActiveDownloads) {
    const msg = `[Kanal Kontrolü] Aktif video indirmesi veya dönüştürme devam ettiği için kanal taraması ertelendi (YouTube ban koruması).`;
    console.log(msg);
    addTerminalLog(msg, 'warning');
    return { success: false, deferred: true, message: msg };
  }

  // Türkçe Açıklama: YouTube Ban Koruması 2 - Süresi henüz çözülmemiş video varsa veya süre analizi sürüyorsa taramayı ertele ve analizi tetikle.
  const checkDb = readDb();
  const hasPendingDurations = isResolvingDurations || (checkDb.history && checkDb.history.some(h => h.status === 'waiting_duration'));

  if (hasPendingDurations) {
    hasDeferredChannelCheck = true;
    deferredChannelCheckSource = source;
    const msg = `[Kanal Kontrolü] Süresi çözümlenmemiş videolar bulunduğu için kanal taraması ertelendi (YouTube ban koruması). Eksik süreler analiz ediliyor...`;
    console.log(msg);
    addTerminalLog(msg, 'info');
    resolveMissingDurations();
    return { success: false, deferred: true, message: msg };
  }

  isRssChecking = true;
  rssCheckStartTime = Date.now();
  try {
    const db = readDb();
    const sourceLabels = {
      timer: 'Zamanlayıcı (Arka Plan)',
      ui: 'Arayüz Butonu (Sağ Üst)',
      tray: 'Sistem Tepsisi / Sağ Tık Menüsü',
      startup: 'Sistem Açılış Taraması',
      manual: 'Manuel Tetikleme'
    };
    const label = sourceLabels[source] || source;
    console.log(`[Kanal Kontrolü] Tüm kanallar denetleniyor (Kaynak: ${label})...`);
    addTerminalLog(`[Kanal Kontrolü] Tüm kanallar denetleniyor (${label})...`, 'info');

    const result = await checkAllChannelsRssParallel();
    
    // Eksik video sürelerini ve beklemedeki videoları çözümle
    resolveMissingDurations();
    checkPendingLiveStreams();

    return result;
  } catch (err) {
    console.error(`[Kanal Kontrolü Hata] ${source} tetikleme hatası:`, err.message);
    addTerminalLog(`[Kanal Kontrolü Hata] Tarama başarısız oldu: ${err.message}`, 'error');
    return { success: false, error: err.message };
  } finally {
    isRssChecking = false;
    rssCheckStartTime = 0;
  }
}

/**
 * Türkçe Açıklama: Canlı yayın işlenmesi beklenen (waiting_live_processing) videoların 
 * YouTube tarafında VOD videoya dönüşüp dönüşmediğini sadece 2KB boyutunda hafif 
 * metadata sorgusuyla (0 kotayla) denetler. İşlenen videoları indirme kuyruğuna aktarır.
 * 
 * @returns {Promise<void>}
 */
export async function checkPendingLiveStreams() {
  try {
    const db = readDb();
    const liveHandling = db.settings?.liveStreamHandling || 'instant_retry';
    if (liveHandling === 'ignore_live') return;

    const pendingItems = (db.history || []).filter(h =>
      !h.hidden &&
      h.status !== 'downloaded' &&
      h.status !== 'completed' &&
      h.status !== 'unavailable' &&
      h.status !== 'downloading' &&
      h.status !== 'waiting' &&
      (
        h.status === 'upcoming' ||
        h.duration === 'upcoming' ||
        h.status === 'waiting_live_processing' ||
        h.status === 'live' ||
        h.duration === 'live' ||
        (h.status !== 'ignored' && h.error && h.error.includes('Canlı Yayın'))
      )
    );

    if (pendingItems.length === 0) return;

    console.log(`[CANLI YAYIN] ${pendingItems.length} beklemedeki yaklaşan/canlı yayın denetleniyor...`);

    for (const item of pendingItems) {
      try {
        const result = await fetchVideoDuration(item.id);

        // 1. Durum: Video gerçekten Gizli, Üyelere Özel, Silinmiş veya Erişilemez durumda
        if (result && result.isUnavailable) {
          if (item.status !== 'ignored') {
            addTerminalLog(`[CANLI YAYIN] "${item.title}" (${item.channelName || 'Kanal'}) yayını gizli/üyelere özel veya silinmiş olduğu için takipten çıkarıldı.`, 'warning');
          }
          const release = await acquireDbLock();
          try {
            const freshDb = readDb();
            const target = freshDb.history.find(h => h.id === item.id);
            if (target) {
              target.status = 'ignored';
              target.error = result.reason || 'Video gizli, üyelere özel veya kaldırılmış.';
              if (result.duration && result.duration !== 'live' && result.duration !== 'upcoming') {
                target.duration = result.duration;
              } else if (target.duration === 'upcoming' || target.duration === 'live') {
                // Sonsuz uyarı döngüsünü önlemek için takipten düşen kayıtta 'upcoming'/'live' süresini temizle
                target.duration = '';
              }
              if (result.isUnlisted) {
                target.isUnlisted = true;
              }
              writeDb(freshDb);
              broadcast('db_update', freshDb);
            }
          } finally {
            release();
          }
          continue;
        }

        // 2. Durum: Süre veya yayın durumu başarılı çözümlendi
        if (result && result.duration) {
          const SIX_HOURS_MS = 6 * 60 * 60 * 1000;
          const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;
          const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

          // A) Yayın sona ermiş ve VOD işlemesi bekleniyorsa: endTimestamp'ten itibaren 6 saat tanı
          // B) Aktif canlı yayın 24 saati aştıysa (7/24 radyo yayınları): takipten düşür
          // C) Hiç başlamamış bekleme odası ("Stream Now" / planlı prömiyer): planlı başlama saati geçmişse veya 7 günü doldurmuşsa sessizce düşür
          let isTimedOut = false;
          let timeoutSilent = false;
          if (result.endTimestamp) {
            const endedElapsed = Date.now() - new Date(result.endTimestamp).getTime();
            if (endedElapsed > SIX_HOURS_MS && (result.duration === 'live' || result.duration === 'upcoming')) {
              isTimedOut = true;
            }
          } else if (result.duration === 'live') {
            const liveRef = result.startTimestamp || item.publishedAt || item.downloadedAt || item.addedAt;
            const liveElapsed = liveRef ? (Date.now() - new Date(liveRef).getTime()) : 0;
            const limitMs = result.isLiveProcessing ? SIX_HOURS_MS : TWENTY_FOUR_HOURS_MS;
            if (liveRef && liveElapsed > limitMs) {
              isTimedOut = true;
            }
          } else if (result.duration === 'upcoming') {
            if (result.upcomingStartTimestamp) {
              const schedElapsed = Date.now() - new Date(result.upcomingStartTimestamp).getTime();
              if (schedElapsed > TWENTY_FOUR_HOURS_MS) {
                isTimedOut = true;
                timeoutSilent = true;
              }
            } else {
              const createdRef = item.publishedAt || item.downloadedAt || item.addedAt;
              const createdElapsed = createdRef ? (Date.now() - new Date(createdRef).getTime()) : 0;
              if (createdRef && createdElapsed > SEVEN_DAYS_MS) {
                isTimedOut = true;
                timeoutSilent = true;
              }
            }
          }

          if (isTimedOut) {
            if (!timeoutSilent) {
              addTerminalLog(`[CANLI YAYIN] "${item.title}" yayını zaman aşımı içinde VOD videoya dönüşmediği için takipten çıkarıldı.`, 'warning');
            }
            const release = await acquireDbLock();
            try {
              const freshDb = readDb();
              const target = freshDb.history.find(h => h.id === item.id);
              if (target) {
                target.status = 'ignored';
                target.duration = '';
                target.error = 'Canlı yayın zaman aşımı içinde VOD videoya dönüşmedi (Takipten çıkarıldı).';
                writeDb(freshDb);
                broadcast('db_update', freshDb);
              }
            } finally {
              release();
            }
            continue;
          }

          if (result.duration === 'upcoming') {
            // Geçmişte sahte "Üyelere özel" hatasıyla 'ignored' kalmış bekleme odalarını temizle
            if (item.status === 'ignored' || item.error) {
              const release = await acquireDbLock();
              try {
                const freshDb = readDb();
                const target = freshDb.history.find(h => h.id === item.id);
                if (target) {
                  target.status = 'upcoming';
                  target.duration = 'upcoming';
                  delete target.error;
                  target.liveCheckFailCount = 0;
                  writeDb(freshDb);
                  broadcast('db_update', freshDb);
                }
              } finally {
                release();
              }
            }
          } else if (result.duration === 'live') {
            if (result.isLiveProcessing) {
              if (item.status !== 'waiting_live_processing') {
                addTerminalLog(`[CANLI YAYIN] "${item.title}" yayını sona erdi, YouTube VOD işlemesi bekleniyor...`, 'info');
                const release = await acquireDbLock();
                try {
                  const freshDb = readDb();
                  const target = freshDb.history.find(h => h.id === item.id);
                  if (target) {
                    target.duration = 'live';
                    target.status = 'waiting_live_processing';
                    target.error = 'Canlı yayın yeni sonlandı, YouTube VOD işlemesi bekleniyor.';
                    target.liveCheckFailCount = 0;
                    writeDb(freshDb);
                    broadcast('db_update', freshDb);
                  }
                } finally {
                  release();
                }
              }
            } else {
              const channelConfig = db.channels.find(c => c.id === item.channelId);
              const autoDownload = db.settings.autoDownload && (channelConfig ? channelConfig.autoDownload !== false : true);
              const desiredLiveStatus = (autoDownload && liveHandling === 'vod_only') ? 'waiting_live_processing' : 'live';

              if (item.duration !== 'live' || (item.status !== desiredLiveStatus && item.status !== 'waiting_live_processing')) {
                addTerminalLog(`[CANLI YAYIN] "${item.title}" yayını CANLI olarak başladı!`, 'info');
                let instantLiveVideo = null;
                const release = await acquireDbLock();
                try {
                  const freshDb = readDb();
                  const target = freshDb.history.find(h => h.id === item.id);
                  if (target) {
                    target.duration = 'live';
                    delete target.error;
                    target.liveCheckFailCount = 0;
                    if (autoDownload && liveHandling === 'instant_retry' && item.status !== 'waiting_live_processing') {
                      target.status = 'waiting';
                      instantLiveVideo = {
                        id: item.id,
                        title: target.title,
                        channelId: target.channelId,
                        channelName: target.channelName,
                        url: `https://www.youtube.com/watch?v=${item.id}`,
                        publishedAt: target.publishedAt,
                        duration: 'live'
                      };
                    } else {
                      target.status = desiredLiveStatus;
                    }
                    writeDb(freshDb);
                    broadcast('db_update', freshDb);
                  }
                } finally {
                  release();
                }
                if (instantLiveVideo) {
                  await downloadQueue.add(instantLiveVideo);
                }
              }
            }
          } else if (result.duration !== 'upcoming') {
            const channelConfig = db.channels.find(c => c.id === item.channelId);
            const autoDownload = db.settings.autoDownload && (channelConfig ? channelConfig.autoDownload !== false : true);
            const downloadShorts = channelConfig ? channelConfig.downloadShorts !== false : true;
            const shortsLimit = (channelConfig && channelConfig.shortsDurationLimit !== undefined) ? channelConfig.shortsDurationLimit : 180;
            const isShort = !downloadShorts && isShortDuration(result.duration, shortsLimit);
            const shouldAutoDownload = autoDownload && !isShort;

            let convertedVideo = null;
            let convertedFakap = null;
            const release = await acquireDbLock();
            try {
              const freshDb = readDb();
              const target = freshDb.history.find(h => h.id === item.id);
              if (
                target &&
                target.status !== 'completed' &&
                target.status !== 'downloading' &&
                target.status !== 'waiting'
              ) {
                target.duration = result.duration;
                delete target.error;
                if (result.publishedAt) target.publishedAt = result.publishedAt;
                target.liveCheckFailCount = 0;

                if (shouldAutoDownload) {
                  target.status = 'waiting';
                  convertedVideo = {
                    id: item.id,
                    title: target.title,
                    channelId: target.channelId,
                    channelName: target.channelName,
                    url: `https://www.youtube.com/watch?v=${item.id}`,
                    publishedAt: target.publishedAt,
                    duration: result.duration || ''
                  };
                  const fakapPair = buildFakapPairIfEligible(freshDb, convertedVideo);
                  if (fakapPair) {
                    freshDb.history.push(fakapPair.historyObj);
                    convertedFakap = fakapPair.queueObj;
                  }
                  addTerminalLog(`[CANLI YAYIN / PRÖMİYER] "${item.title}" yayını tamamlandı ve videoya dönüştü (${result.duration}), indirme kuyruğuna alındı.`, 'success');
                } else {
                  target.status = 'ignored';
                  addTerminalLog(`[CANLI YAYIN / PRÖMİYER] "${item.title}" yayını tamamlandı ve videoya dönüştü (${result.duration}). Kütüphanede indirmeye hazır.`, 'info');
                }

                writeDb(freshDb);
                broadcast('db_update', freshDb);
              }
            } finally {
              release();
            }

            if (convertedVideo) {
              await downloadQueue.add(convertedVideo);
            }
            if (convertedFakap) {
              await downloadQueue.add(convertedFakap);
            }
          }
        } else {
          // 3. Durum: Süre dönmedi veya sayfa çekilemedi (Eski/Kapanmış/VOD dönüşmemiş yayınlar için Zaman Aşımı)
          const release = await acquireDbLock();
          try {
            const freshDb = readDb();
            const target = freshDb.history.find(h => h.id === item.id);
            if (target) {
              target.liveCheckFailCount = (target.liveCheckFailCount || 0) + 1;
              const refTime = target.publishedAt || target.downloadedAt || target.addedAt;
              const itemAgeHours = refTime ? (Date.now() - new Date(refTime).getTime()) / (1000 * 60 * 60) : 0;
              if (target.liveCheckFailCount >= 3 && itemAgeHours > 6) {
                target.status = 'ignored';
                target.duration = '';
                target.error = 'Canlı yayın 6 saat içinde VOD videoya dönüşmedi veya erişilemedi (Takipten çıkarıldı).';
                addTerminalLog(`[CANLI YAYIN] "${item.title}" yayını 6 saat içinde VOD videoya dönüşmediği için takipten çıkarıldı.`, 'warning');
                broadcast('db_update', freshDb);
              }
              writeDb(freshDb);
            }
          } finally {
            release();
          }
        }
      } catch (err) {
        console.warn(`[Canlı Yayın Denetleyici] ${item.id} metadata kontrol hatası:`, err.message);
      }
    }
  } catch (err) {
    console.error('[Canlı Yayın Denetleyici] Hata:', err.message);
  }
}

