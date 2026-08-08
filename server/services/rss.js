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
import { ytdlpPath, getLocalTempDir, cleanMeiForPid, spawnYtdlp } from './paths.js';
import { downloadQueue } from './downloader.js';

const parser = new Parser({
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7'
  }
});

export let isRssChecking = false;
export let currentChannelIndex = 0;
export let isResolvingDurations = false;


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
    url => `https://corsproxy.io/?${encodeURIComponent(url)}`,
    url => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`
  ];

  return new Promise((resolve, reject) => {
    let index = 0;

    function tryNext() {
      if (index >= proxies.length) {
        return reject(new Error(`Orijinal ve proxy sunucuları üzerinden ${targetUrl} adresi çekilemedi.`));
      }

      const activeUrl = proxies[index](targetUrl);
      const isDirect = index === 0;

      console.log(`[Waterfall] Istek gonderiliyor (Index: ${index}, Direct: ${isDirect}): ${activeUrl}`);
      
      let urlObj;
      try {
        urlObj = new URL(activeUrl);
      } catch (e) {
        console.log(`[Waterfall] Gecersiz URL formati (Index: ${index}): ${activeUrl}`);
        index++;
        tryNext();
        return;
      }

      function performRequest(requestUrl, redirectCount = 0) {
        if (redirectCount > 5) {
          console.log(`[Waterfall] Cok fazla yonlendirme (Index: ${index})`);
          index++;
          tryNext();
          return;
        }

        const reqOptions = {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept-Language': 'tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7'
          }
        };

        const currentUrlObj = new URL(requestUrl);
        const currentGetter = currentUrlObj.protocol === 'https:' ? https : http;

        currentGetter.get(currentUrlObj, reqOptions, (res) => {
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
            console.log(`[Waterfall] Hata kodu (Index: ${index}): HTTP ${res.statusCode}`);
            index++;
            tryNext();
            return;
          }

          let data = '';
          res.on('data', chunk => { data += chunk; });
          res.on('end', () => {
            resolve(data);
          });
        }).on('error', (err) => {
          console.log(`[Waterfall] Istek hatasi (Index: ${index}): ${err.message}`);
          index++;
          tryNext();
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
function parseDurationFromHtml(html, isShortFallback = false) {
  let duration = '';
  let publishedAt = '';
  let title = '';
  let channelName = '';

  if (isShortFallback) {
    duration = '0:30';
  }

  const playerResponseMatch = html.match(/ytInitialPlayerResponse\s*=\s*({.+?});/);
  if (playerResponseMatch) {
    try {
      const playerResponse = JSON.parse(playerResponseMatch[1]);
      const videoDetails = playerResponse.videoDetails;
      if (videoDetails) {
        if (videoDetails.lengthSeconds) {
          const seconds = parseInt(videoDetails.lengthSeconds, 10);
          if (playerResponse.microformat?.playerMicroformatRenderer?.isLiveContent) {
            duration = 'live';
          } else if (seconds === 0 && playerResponse.microformat?.playerMicroformatRenderer?.liveBroadcastDetails) {
            duration = 'upcoming';
          } else {
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
      }

      const microformat = playerResponse.microformat?.playerMicroformatRenderer;
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

  if (!duration) {
    const lengthMatch = html.match(/"lengthSeconds"\s*:\s*"(\d+)"/);
    if (lengthMatch) {
      const seconds = parseInt(lengthMatch[1], 10);
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

  return { duration, publishedAt, title, channelName };
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
      console.log(`[fetchVideoDuration] Dogrudan istek basarisiz veya engellendi, vekil sunucu (Proxy Waterfall) denetimi baslatiliyor: ${videoId}`);
      try {
        const proxyHtml = await fetchWithProxyWaterfall(startUrl);
        const parsed = parseDurationFromHtml(proxyHtml, false);
        resolve(parsed);
      } catch (err) {
        console.error(`[fetchVideoDuration] Proxy waterfall sorgusu da basarisiz oldu: ${err.message}`);
        resolve({ duration: '', publishedAt: '' });
      }
    }

    function getRequest(url) {
      if (redirectCount > maxRedirects) {
        console.log(`[fetchVideoDuration] Too many redirects for ${videoId}`);
        return tryWaterfall();
      }

      https.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept-Language': langHeader
        }
      }, (res) => {
        if (res.statusCode >= 400) {
          console.log(`[fetchVideoDuration] Dogrudan istek HTTP ${res.statusCode} hatasi aldi: ${videoId}`);
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
          if (!parsed.duration && !parsed.publishedAt) {
            return tryWaterfall();
          }
          resolve(parsed);
        });
      }).on('error', (e) => {
        console.log(`[fetchVideoDuration] Dogrudan baglanti hatasi: ${e.message}`);
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
export function fetchDurationViaYtdlp(videoId) {
  return new Promise((resolve) => {
    const db = readDb();
    const settings = db.settings || {};
    const args = [];

    if (settings.browser && settings.browser !== 'none') {
      const browserName = settings.browser === 'msedge' ? 'edge' : settings.browser;
      args.push('--cookies-from-browser', browserName);
    }

    args.push(
      '--no-playlist',
      '--skip-download',
      '--print', '%(duration_string)s',
      `https://www.youtube.com/watch?v=${videoId}`
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
      // Türkçe Açıklama: Süre formatı '45', '1:20' veya '1:23:45' gibi sayısal ifadeleri içermelidir.
      if (raw && /^\d+(:\d+)*$/.test(raw)) {
        resolve(raw);
      } else {
        resolve('');
      }
    });

    proc.on('error', () => resolve(''));
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
      const hl = db.settings?.lang || 'tr';
      const feedUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}&hl=${hl}`;
      const xmlData = await fetchWithProxyWaterfall(feedUrl);
      const xmlFeed = await parser.parseString(xmlData);
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
      console.log(`[RSS] [XML Tarih Eşleme] ${channelId} için XML RSS tarihleri okunamadı:`, rssErr.message);
    }

    const args = [];
    args.push('--js-runtimes', `node:${process.execPath}`);
    
    if (settings.browser && settings.browser !== 'none') {
      const browserName = settings.browser === 'msedge' ? 'edge' : settings.browser;
      args.push('--cookies-from-browser', browserName);
    }
    
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
    args.push(
      `https://www.youtube.com/channel/${channelId}/videos`,
      `https://www.youtube.com/channel/${channelId}/streams`
    );
    
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
    }, 10000);
    
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

      if (code !== 0 && items.length === 0) {
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

    console.log(`[RSS] ${channel.name} denetleniyor (yt-dlp)...`);
    addTerminalLog(`[RSS] ${channel.name} yt-dlp ile denetleniyor...`, 'info');
    try {
      feed = await fetchChannelVideosYtdlp(channel.id, rssLimit);
    } catch (ytdlpErr) {
      console.log(`[RSS] "${channel.name}" için yedek Proxy köprüsü devreye giriyor (${ytdlpErr.message})...`);
      addTerminalLog(`[RSS] "${channel.name}" bölge kısıtlaması/engeli nedeniyle Proxy yedeğine yönlendirildi.`, 'info');
      try {
        const hl = db.settings?.lang || 'tr';
        const feedUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${channel.id}&hl=${hl}`;
        const xmlData = await fetchWithProxyWaterfall(feedUrl);
        feed = await parser.parseString(xmlData);
      } catch (rssErr) {
        console.error(`[RSS] [HATA] ${channel.name} RSS XML ile de denetlenemedi:`, rssErr.message);
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

          if (existingHistory.status === 'upcoming' || existingHistory.duration === 'upcoming' || existingHistory.status === 'live' || existingHistory.duration === 'live') {
            try {
              const result = await fetchVideoDuration(videoId);
              if (result && result.duration && result.duration !== 'upcoming' && result.duration !== 'live') {
                console.log(`[RSS] Upcoming/live video is now published/completed: ${item.title}`);
                addTerminalLog(`[RSS] Yaklaşan/Canlı yayın artık normal video halinde yayında: "${item.title}" (${channel.name})`, 'info');
                
                let lockReleased = false;
                const release = await acquireDbLock();
                try {
                  const freshDb = readDb();
                  const freshHistory = freshDb.history.find(h => h.id === videoId);
                  if (freshHistory && (freshHistory.status === 'upcoming' || freshHistory.duration === 'upcoming' || freshHistory.status === 'live' || freshHistory.duration === 'live')) {
                    freshHistory.duration = result.duration;
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
                        writeDb(freshDb);
                        
                        lockReleased = true;
                        release();
                        
                        await downloadQueue.add({
                          id: videoId,
                          title: item.title,
                          channelId: channel.id,
                          channelName: channel.name,
                          url: item.link,
                          publishedAt: freshHistory.publishedAt,
                          duration: result.duration || ''
                        });
                      } else {
                        writeDb(freshDb);
                      }
                    } else {
                      freshHistory.status = 'ignored';
                      writeDb(freshDb);
                    }
                  }
                } finally {
                  if (!lockReleased) {
                    release();
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

          let isHistoricalVideo = false;
          if (publishDateStr && channel.addedAt) {
            const pubTime = new Date(publishDateStr).getTime();
            const addedTime = new Date(channel.addedAt).getTime();
            if (pubTime < addedTime - 60000) {
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

              let shouldDownload = true;
              if (duration === 'upcoming') {
                shouldDownload = false;
                historyItem.status = 'upcoming';
                console.log(`Upcoming video detected. Adding to database but skipping download: ${item.title}`);
              } else if (duration === 'live') {
                shouldDownload = false;
                historyItem.status = 'live';
                console.log(`Live stream detected. Adding to database but skipping download: ${item.title}`);
              } else if (!downloadShorts && !duration) {
                shouldDownload = false;
                historyItem.status = 'waiting_duration';
                console.log(`[RSS] Video süresi henüz çözülmedi ve kanal shorts istemiyor. Süre analizi bekleniyor: ${item.title}`);
              } else if (!downloadShorts && isShortDuration(duration, shortsLimit)) {
                shouldDownload = false;
                historyItem.status = 'ignored';
                console.log(`Short video detected and channel doesn't allow shorts. Ignoring: ${item.title}`);
              } else if (!freshDb.settings.autoDownload || (channelConfig ? channelConfig.autoDownload === false : false)) {
                shouldDownload = false;
                historyItem.status = 'ignored';
                console.log(`Auto-download disabled. Ignoring: ${item.title}`);
              } else {
                historyItem.status = 'waiting';
              }

              if (!freshDb.history.some(h => h.id === videoId)) {
                freshDb.history.push(historyItem);
                writeDb(freshDb);
                if (shouldDownload) {
                  addedVideo = {
                    id: videoId,
                    title: item.title,
                    channelId: channel.id,
                    channelName: channel.name,
                    url: item.link,
                    publishedAt: publishedAt
                  };
                }
              }
            } finally {
              release();
            }

            if (addedVideo) {
              await downloadQueue.add(addedVideo);
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
 * Sıradaki kanalı alfabetik olarak bulup RSS kontrolünü gerçekleştirir.
 */
export async function checkNextChannelRss() {
  if (isRssChecking) {
    console.log('[RSS] Bir önceki kanal RSS kontrolü henüz tamamlanmadı, yeni tarama atlandı.');
    return;
  }
  isRssChecking = true;
  try {
    const db = readDb();
    if (db.channels.length === 0) {
      console.log('İzlenen kanal bulunmuyor.');
      return;
    }

    const sortedChannels = [...db.channels].sort((a, b) => 
      (a.name || '').localeCompare(b.name || '', 'tr', { sensitivity: 'base' })
    );

    if (currentChannelIndex >= sortedChannels.length) {
      currentChannelIndex = 0;
    }

    const channel = sortedChannels[currentChannelIndex];
    const checkMsg = `[RSS] Checking channel ${currentChannelIndex + 1} out of ${sortedChannels.length}: "${channel.name}"`;
    console.log(checkMsg);
    addTerminalLog(checkMsg, 'info');

    await checkSingleChannelRss(channel, false);

    currentChannelIndex = (currentChannelIndex + 1) % sortedChannels.length;

    resolveMissingDurations();
  } finally {
    isRssChecking = false;
  }
}

/**
 * Veritabanındaki süresi veya yayınlanma tarihi eksik olan videoların detaylarını arka planda tamamlar.
 */
export async function resolveMissingDurations() {
  if (isResolvingDurations) return;
  isResolvingDurations = true;
  
  const db = readDb();
  let updated = false;

  for (const item of db.history) {
    // Türkçe Açıklama: Göz ardı edilmiş (ignored) videoların sürelerini sorgulayarak sistemi yormaya ve logları kirletmeye gerek yok.
    if (item.status === 'ignored' && item.duration && item.duration !== '-') continue;

    // Recovery check for waiting_duration items that already have a duration or '-'
    if (item.status === 'waiting_duration' && (item.duration || item.publishedAt)) {
      const dbChannels = db.channels || [];
      const channelConfig = dbChannels.find(c => c.id === item.channelId);
      const downloadShorts = channelConfig ? channelConfig.downloadShorts !== false : true;
      const shortsLimit = (channelConfig && channelConfig.shortsDurationLimit !== undefined) ? channelConfig.shortsDurationLimit : 180;
      
      const finalDuration = item.duration || '-';
      const isShort = finalDuration !== '-' && isShortDuration(finalDuration, shortsLimit);
      
      if (!downloadShorts && isShort) {
        item.status = 'ignored';
      } else {
        item.status = 'waiting';
        updated = true;
        console.log(`[resolveMissingDurations Recovery] Video kuyruğa ekleniyor: ${item.title}`);
        downloadQueue.add({
          id: item.id,
          title: item.title,
          channelId: item.channelId,
          channelName: item.channelName,
          url: `https://www.youtube.com/watch?v=${item.id}`,
          publishedAt: item.publishedAt || '',
          duration: finalDuration
        });
      }
      continue;
    }

    const needsDuration = !item.duration;
    const needsPublishDate = !item.publishedAt;
    if (needsDuration || needsPublishDate) {
      console.log(`Eksik bilgiler çözümleniyor: ${item.title}`);
      try {
        const result = await fetchVideoDuration(item.id);
        let duration = result ? result.duration : '';
        let publishedAt = result ? result.publishedAt : '';

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
          } else {
            item.status = 'waiting';
            itemUpdated = true;
            console.log(`[resolveMissingDurations] Süre analizi tamamlandı (Süre: ${finalDuration}), video kuyruğa ekleniyor: ${item.title}`);
            downloadQueue.add({
              id: item.id,
              title: item.title,
              channelId: item.channelId,
              channelName: item.channelName,
              url: `https://www.youtube.com/watch?v=${item.id}`,
              publishedAt: item.publishedAt || '',
              duration: finalDuration
            });
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

  if (updated) {
    writeDb(db);
    broadcast('db_update', readDb());
  }
  isResolvingDurations = false;
}

/**
 * Eksik kanal avatarlarını (logolarını) arka planda otomatik tamamlar.
 */
export async function resolveMissingChannelAvatars() {
  const db = readDb();
  let updated = false;

  for (const channel of db.channels) {
    if (!channel.avatar || channel.avatar.startsWith('http')) {
      const channelFolder = path.join(db.settings.downloadPath, channel.name);
      const localAvatar = path.join(channelFolder, 'avatar.jpg');
      
      if (fs.existsSync(localAvatar)) {
        channel.avatar = `/api/channels/${encodeURIComponent(channel.name)}/avatar`;
        updated = true;
      } else if (channel.avatar && channel.avatar.startsWith('http')) {
        try {
          const localPath = await downloadChannelAvatar(channel.avatar, channel.name);
          if (localPath) {
            channel.avatar = localPath;
            updated = true;
          }
        } catch (e) {
          console.error(`Avatar indirilemedi (${channel.name}):`, e.message);
        }
      }
    }
  }

  if (updated) {
    writeDb(db);
    broadcast('db_update', readDb());
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
  addTerminalLog(`[RSS] ${total} kanal için paralel RSS taraması başlatılıyor...`, 'info');
  console.log(`[RSS] ${total} kanal için paralel RSS taraması başlatılıyor...`);

  const rssLimit = db.settings.rssLimit || 5;

  // 1. Paralel İstekler (Önce yt-dlp ile Türkçe başlıkları çek, hata durumunda XML yedekle)
  const promises = db.channels.map(async (channel) => {
    let feed = null;
    try {
      feed = await fetchChannelVideosYtdlp(channel.id, rssLimit);
    } catch (ytdlpErr) {
      console.log(`[RSS Paralel] "${channel.name}" için yedek Proxy köprüsü devreye giriyor (${ytdlpErr.message})...`);
      try {
        const hl = db.settings?.lang || 'tr';
        const feedUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${channel.id}&hl=${hl}`;
        const xmlData = await fetchWithProxyWaterfall(feedUrl);
        feed = await parser.parseString(xmlData);
      } catch (xmlErr) {
        console.error(`[RSS Paralel] ${channel.name} için XML çekilemedi: ${xmlErr.message}`);
      }
    }
    return { channel, feed };
  });

  const results = await Promise.allSettled(promises);

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
    const channelHistory = freshDb.history.filter(h => h.channelId === channel.id && h.publishedAt && h.publishedAt !== '-');
    let latestHistoryTime = 0;
    if (channelHistory.length > 0) {
      latestHistoryTime = Math.max(...channelHistory.map(h => new Date(h.publishedAt).getTime()));
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
        if (existingHistory.status === 'upcoming' || existingHistory.duration === 'upcoming' || existingHistory.status === 'live' || existingHistory.duration === 'live') {
          try {
            const result = await fetchVideoDuration(videoId);
            if (result && result.duration && result.duration !== 'upcoming' && result.duration !== 'live') {
              console.log(`[RSS Paralel] Yaklaşan/Canlı yayın artık normal video halinde yayında: ${item.title}`);
              addTerminalLog(`[RSS Paralel] Yaklaşan/Canlı yayın artık normal video halinde yayında: "${item.title}" (${channel.name})`, 'info');
              
              let duration = result.duration;
              let publishedAt = result.publishedAt || existingHistory.publishedAt;
              
              const channelConfig = freshDb.channels.find(c => c.id === channel.id);
              const autoDownload = freshDb.settings.autoDownload && (channelConfig ? channelConfig.autoDownload !== false : true);
              const downloadShorts = channelConfig ? channelConfig.downloadShorts !== false : true;
              const shortsLimit = (channelConfig && channelConfig.shortsDurationLimit !== undefined) ? channelConfig.shortsDurationLimit : 180;
              
              let shouldDownload = false;
              let newStatus = 'ignored';
              
              if (autoDownload) {
                if (!downloadShorts && isShortDuration(duration, shortsLimit)) {
                  console.log(`[RSS Paralel] Kısa video algılandı ve kanal shorts'a izin vermiyor. Göz ardı ediliyor: ${item.title}`);
                } else {
                  shouldDownload = true;
                  newStatus = 'waiting';
                }
              }
              
              historyToUpdate.push({
                id: videoId,
                duration: duration,
                publishedAt: publishedAt,
                status: newStatus
              });
              
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
              }
            }
          } catch (e) {
            console.error(`[RSS Paralel] Yaklaşan/Canlı yayın durumu kontrolünde hata (${item.title}):`, e.message);
          }
        }
      } else {
        // Yeni video keşfedildi
        let publishDateStr = item.isoDate || item.pubDate || new Date().toISOString();
        
        let isHistoricalVideo = false;
        const pubTime = new Date(publishDateStr).getTime();
        const nowTime = Date.now();
        
        if (latestHistoryTime > 0) {
          // Geçmişte video varsa: Geçmişteki en yeni videodan eski ise tarihi geçmiş say
          if (pubTime < latestHistoryTime - 60000) {
            isHistoricalVideo = true;
          }
        } else {
          // Geçmiş boşsa: addedAt kontrolü yap veya en son 48 saati baz al
          if (channel.addedAt) {
            const addedTime = new Date(channel.addedAt).getTime();
            if (pubTime < addedTime - 60000) {
              isHistoricalVideo = true;
            }
          } else {
            const isTooOld = (nowTime - pubTime) > (48 * 60 * 60 * 1000);
            if (isTooOld) {
              isHistoricalVideo = true;
            }
          }
        }

        const historyItem = createHistoryItem(
          videoId,
          item.title,
          channel.id,
          channel.name,
          publishDateStr,
          '', // Süreyi şimdilik boş geçiyoruz, resolveMissingDurations halledecek
          freshDb.settings
        );

        const channelConfig = freshDb.channels.find(c => c.id === channel.id);
        
        // İlk başlangıç veya tarihi geçmiş video ise indirme kuyruğuna almayacağız, sadece geçmişe ekleyeceğiz
        if (isHistoricalVideo) {
          historyItem.status = 'ignored';
          historyToAdd.push(historyItem);
        } else {
          // İndirme kontrolü
          const autoDownload = freshDb.settings.autoDownload && (channelConfig ? channelConfig.autoDownload !== false : true);
          
          if (autoDownload) {
            let duration = '';
            let publishedAt = publishDateStr;

            // Eğer süre henüz alınmamışsa detayları çek
            try {
              const result = await fetchVideoDuration(videoId);
              if (result) {
                if (result.duration) duration = result.duration;
                if (result.publishedAt) publishedAt = result.publishedAt;
              }
            } catch (e) {
              console.error(`[RSS Paralel] Error fetching duration for newly discovered video:`, e.message);
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

            let shouldDownload = true;
            if (duration === 'upcoming') {
              shouldDownload = false;
              historyItem.status = 'upcoming';
              console.log(`[RSS Paralel] Upcoming video detected. Skipping download: ${item.title}`);
            } else if (duration === 'live') {
              shouldDownload = false;
              historyItem.status = 'live';
              console.log(`[RSS Paralel] Live stream detected. Skipping download: ${item.title}`);
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
  addTerminalLog(`[RSS] Paralel denetim tamamlandı: ${total} kanal ${durationSec} saniyede kontrol edildi. ${newVideosCount} yeni video bulundu.`, 'success');
  console.log(`[RSS] Paralel denetim tamamlandı: ${total} kanal ${durationSec} saniyede kontrol edildi. ${newVideosCount} yeni video bulundu.`);

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
  if (isRssChecking) {
    const msg = `[Kanal Kontrolü] Zaten devam eden bir RSS taraması var (Kaynak: ${source}). Yeni istek atlandı.`;
    console.log(msg);
    addTerminalLog(msg, 'info');
    return { success: false, inProgress: true, message: 'Tarama zaten devam ediyor.' };
  }

  // Aktif indirme veya FFmpeg birleştirmesi varsa otomatik zamanlayıcı taramasını ertele
  if (source === 'timer' && downloadQueue && (downloadQueue.activeDownloads > 0 || (downloadQueue.activeProcesses && downloadQueue.activeProcesses.size > 0))) {
    const msg = `[Kanal Kontrolü] Aktif indirme veya FFmpeg birleştirmesi devam ettiği için arka plan zamanlayıcı taraması ertelendi.`;
    console.log(msg);
    addTerminalLog(msg, 'info');
    return { success: false, deferred: true, message: 'Aktif indirme nedeniyle tarama ertelendi.' };
  }

  isRssChecking = true;
  try {
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

    return result;
  } catch (err) {
    console.error(`[Kanal Kontrolü Hata] ${source} tetikleme hatası:`, err.message);
    addTerminalLog(`[Kanal Kontrolü Hata] Tarama başarısız oldu: ${err.message}`, 'error');
    return { success: false, error: err.message };
  } finally {
    isRssChecking = false;
  }
}

