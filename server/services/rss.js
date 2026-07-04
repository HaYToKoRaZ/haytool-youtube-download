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
import { ytdlpPath } from './paths.js';
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
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
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
export function fetchVideoDuration(videoId) {
  return new Promise((resolve) => {
    const db = readDb();
    const langHeader = db.settings.lang === 'en' ? 'en-US,en;q=0.9' : 'tr-TR,tr;q=0.9';
    const maxRedirects = 5;
    let redirectCount = 0;
    let isShortRedirect = false;

    function getRequest(url) {
      if (redirectCount > maxRedirects) {
        console.log(`[fetchVideoDuration] Too many redirects for ${videoId}`);
        return resolve({ duration: '', publishedAt: '' });
      }

      https.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept-Language': langHeader
        }
      }, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 307 || res.statusCode === 308) {
          let redirectUrl = res.headers.location;
          if (redirectUrl) {
            if (!redirectUrl.startsWith('http')) {
              redirectUrl = 'https://www.youtube.com' + redirectUrl;
            }
            if (redirectUrl.includes('/shorts/')) {
              isShortRedirect = true;
            }
            const hl = db.settings.lang === 'en' ? 'en' : 'tr';
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
          let duration = '';
          let publishedAt = '';
          let title = '';
          let channelName = '';

          // 1. YouTube Shorts kontrolü
          if (isShortRedirect || url.includes('/shorts/')) {
            duration = '0:30'; // Shorts için varsayılan ortalama süre
          }

          // 2. JSON-LD veya ytInitialPlayerResponse verilerini ayrıştır
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

          // 3. Regex Fallback
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

          resolve({ duration, publishedAt, title, channelName });
        });
      }).on('error', () => {
        resolve({ duration: '', publishedAt: '' });
      });
    }

    const hl = db.settings.lang === 'en' ? 'en' : 'tr';
    const startUrl = `https://www.youtube.com/watch?v=${videoId}&hl=${hl}`;
    getRequest(startUrl);
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
      const hl = db.settings?.lang === 'en' ? 'en' : 'tr';
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
    
    args.push('--ignore-errors', '--flat-playlist', '--playlist-end', limit.toString(), '--dump-json');
    args.push(
      `https://www.youtube.com/channel/${channelId}/videos`,
      `https://www.youtube.com/channel/${channelId}/streams`
    );
    
    const spawnOptions = process.platform === 'win32' ? { windowsVerbatimArguments: false, windowsHide: true } : {};
    const proc = spawn(ytdlpPath, args, spawnOptions);
    
    let stdout = '';
    let stderr = '';
    
    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    
    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    proc.on('close', (code) => {
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
        return reject(new Error(`yt-dlp exited with code ${code}. Stderr: ${stderr}`));
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
      console.log(`[RSS] ${channel.name} için yt-dlp taraması başarısız oldu (${ytdlpErr.message}). Standart RSS XML yedek mekanizması başlatılıyor...`);
      addTerminalLog(`[RSS] ${channel.name} yt-dlp hatası aldı (${ytdlpErr.message}). Standart RSS XML ile denetleniyor...`, 'info');
      try {
        const hl = db.settings?.lang === 'en' ? 'en' : 'tr';
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
                          publishedAt: freshHistory.publishedAt
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
          const publishDateStr = item.isoDate || item.pubDate;
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
              if (!freshDb.history.some(h => h.id === videoId)) {
                freshDb.history.push(createHistoryItem(
                  videoId,
                  item.title,
                  channel.id,
                  channel.name,
                  publishDateStr,
                  '',
                  freshDb.settings
                ));
                writeDb(freshDb);
              }
            } finally {
              release();
            }
          } else {
            console.log(`[RSS] Yeni video keşfedildi: ${item.title}`);
            addTerminalLog(`[RSS] Yeni video keşfedildi: "${item.title}" (${channel.name})`, 'success');
            
            let duration = '';
            let publishedAt = publishDateStr;
            
            try {
              const result = await fetchVideoDuration(videoId);
              if (result) {
                if (result.duration) duration = result.duration;
                if (result.publishedAt) publishedAt = result.publishedAt;
              }
            } catch (e) {
              console.error('Error fetching duration for newly discovered video:', e.message);
            }

            const release = await acquireDbLock();
            let addedVideo = null;
            try {
              const freshDb = readDb();
              const historyItem = createHistoryItem(
                videoId,
                item.title,
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
    const needsDuration = !item.duration;
    const needsPublishDate = !item.publishedAt;
    if (needsDuration || needsPublishDate) {
      console.log(`Eksik bilgiler çözümleniyor: ${item.title}`);
      try {
        const result = await fetchVideoDuration(item.id);
        let itemUpdated = false;
        if (result) {
          if (result.duration && needsDuration) {
            item.duration = result.duration;
            itemUpdated = true;
          }
          if (result.publishedAt) {
            item.publishedAt = result.publishedAt;
            itemUpdated = true;
          }
          if (result.title && item.title !== result.title) {
            item.title = result.title;
            itemUpdated = true;
          }
          if (result.channelName && item.channelName !== result.channelName) {
            item.channelName = result.channelName;
            itemUpdated = true;
          }
          
          if ((!result.duration && needsDuration) || (!result.publishedAt && needsPublishDate)) {
            item.resolveAttempts = (item.resolveAttempts || 0) + 1;
            if (item.resolveAttempts >= 3) {
              if (needsDuration) item.duration = '-';
              if (needsPublishDate) item.publishedAt = '-';
            }
            itemUpdated = true;
          }
        } else {
          item.resolveAttempts = (item.resolveAttempts || 0) + 1;
          if (item.resolveAttempts >= 3) {
            if (needsDuration) item.duration = '-';
            if (needsPublishDate) item.publishedAt = '-';
          }
          itemUpdated = true;
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
