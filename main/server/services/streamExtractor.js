// Türkçe Açıklama: Harici web sitelerinden (Dizipal, Vidmoly, Filemoon vb.) video akışı (.m3u8, .mp4) ve gömülü oynatıcıları tespit eden akıllı çözümleme servisi.
import { spawn } from 'child_process';
import vm from 'vm';
import fs from 'fs';
import path from 'path';
import { ytdlpPath } from './paths.js';

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36';

const AD_PATTERNS = [/hitbet/i, /1xbet/i, /betting/i, /bahis/i, /reklam/i, /banner/i, /sponsor/i, /casino/i, /popunder/i, /adserver/i];
export function isAdMedia(url) {
  return AD_PATTERNS.some(pat => pat.test(url));
}

/**
 * Dean Edwards tarafından geliştirilen packed (p,a,c,k,e,d) JavaScript kodlarını çözer.
 * Birçok video sağlayıcı m3u8 linkini bu yöntemle gizler.
 *
 * @param {string} html - İncelenecek HTML veya script içeriği
 * @returns {string[]} Çözülen script blokları
 */
export function unpackAllPackedJs(html) {
  const unpackedList = [];
  if (!html || typeof html !== 'string') return unpackedList;

  const packedRegex = /eval\(function\(p,a,c,k,e,[rd]\)\{[\s\S]*?\}\('(.*?)',\s*(\d+),\s*(\d+),\s*'([^']*)'\.split\('\|'\)/g;
  let match;
  while ((match = packedRegex.exec(html)) !== null) {
    try {
      let [ , p, a, c, k ] = match;
      a = parseInt(a, 10);
      c = parseInt(c, 10);
      const kArray = k.split('|');
      function eFunc(val) {
        return (val < a ? '' : eFunc(parseInt(val / a, 10))) + ((val = val % a) > 35 ? String.fromCharCode(val + 29) : val.toString(36));
      }
      while (c--) {
        if (kArray[c]) {
          p = p.replace(new RegExp('\\b' + eFunc(c) + '\\b', 'g'), kArray[c]);
        }
      }
      unpackedList.push(p);
    } catch {
      // Hatalı paketlenmiş blokları atla
    }
  }
  return unpackedList;
}

/**
 * Bir metin veya HTML bloğundaki doğrudan video ve m3u8 bağlantılarını ayıklar.
 *
 * @param {string} text - Taranacak içerik
 * @returns {string[]} Bulunan video akış URL'leri
 */
export function extractDirectVideoUrls(text) {
  if (!text || typeof text !== 'string') return [];
  const found = new Set();

  // 1. .m3u8, .mp4 ve /master.txt URL kalıpları
  const urlRegex = /(https?:\/\/[^\s"'<>\\]+?(?:\.(?:m3u8|mp4)|\/txt\/master\.txt|master\.txt)(?:\?[^\s"'<>\\]*)?)/gi;
  let m;
  while ((m = urlRegex.exec(text)) !== null) {
    let cleanUrl = m[1].replace(/\\/g, '');
    if (!cleanUrl.includes('thumb') && !cleanUrl.includes('preview') && !isAdMedia(cleanUrl)) {
      found.add(cleanUrl);
    }
  }

  // 2. JS Nesnesi içindeki file / source / src kalıpları
  const jsSourceRegex = /(?:file|source|src|url)\s*:\s*["'](https?:\/\/[^"']+)["']/gi;
  while ((m = jsSourceRegex.exec(text)) !== null) {
    let cleanUrl = m[1].replace(/\\/g, '');
    if ((cleanUrl.includes('.m3u8') || cleanUrl.includes('.mp4') || cleanUrl.includes('master.txt')) && !isAdMedia(cleanUrl)) {
      found.add(cleanUrl);
    }
  }

  return Array.from(found);
}

/**
 * Iframe veya sayfa içindeki şifreli/dinamik JWPlayer konfigürasyonlarını sandbox ortamında çözer.
 * (HDfilmcehennemi, CloseLoad, Rapidrame gibi sağlayıcıların cpe3e, rk5, ai73 vb. dinamik şifrelerini çözer).
 *
 * @param {string} html - HTML içeriği
 * @param {string} embedUrl - Iframe veya sayfa URL'si
 * @returns {Array<{ url: string, type: string }>} Bulunan akış nesneleri
 */
export function extractJwplayerFromSandbox(html, embedUrl) {
  if (!html || typeof html !== 'string') return [];
  const found = [];

  let hostname = '';
  let origin = '';
  try {
    const u = new URL(embedUrl);
    hostname = u.hostname;
    origin = u.origin;
  } catch {}

  const capturedSources = [];
  const capturedTracks = [];

  const loc = { hostname, href: embedUrl, origin };
  const storageMock = new Proxy({}, {
    get: (target, prop) => target[prop] || '',
    set: (target, prop, val) => { target[prop] = val; return true; }
  });

  const dummyDomEl = {
    addEventListener: () => {},
    style: {},
    classList: { add: () => {}, remove: () => {} },
    dataset: {},
    hidden: false
  };

  const noop = () => {};
  const sandbox = {
    location: loc,
    window: { location: loc },
    self: { location: loc },
    top: { location: loc },
    parent: { location: loc },
    document: {
      location: loc,
      referrer: embedUrl,
      cookie: '',
      addEventListener: noop,
      removeEventListener: noop,
      getElementById: () => dummyDomEl,
      querySelector: () => dummyDomEl,
      querySelectorAll: () => [dummyDomEl],
      getElementsByTagName: () => [dummyDomEl],
      getElementsByClassName: () => [dummyDomEl],
      documentElement: { setAttribute: noop, style: { setProperty: noop } },
      body: dummyDomEl,
      head: dummyDomEl,
      createElement: () => dummyDomEl
    },
    navigator: { userAgent: USER_AGENT },
    localStorage: storageMock,
    sessionStorage: storageMock,
    setTimeout: (fn) => { if (typeof fn === 'function') { try { fn(); } catch {} } return 1; },
    clearTimeout: noop,
    setInterval: noop,
    clearInterval: noop,
    requestAnimationFrame: noop,
    cancelAnimationFrame: noop,
    fetch: () => Promise.resolve({ ok: false, json: () => Promise.resolve({}), text: () => Promise.resolve('') }),
    XMLHttpRequest: function() {
      return {
        open: noop,
        send: noop,
        setRequestHeader: noop,
        addEventListener: noop
      };
    },
    atob: (s) => Buffer.from(s, 'base64').toString('binary'),
    btoa: (s) => Buffer.from(s, 'binary').toString('base64'),
    jwplayer: function() {
      return {
        setup: function(cfg) {
          if (cfg && Array.isArray(cfg.sources)) {
            capturedSources.push(...cfg.sources);
          } else if (cfg && cfg.file) {
            capturedSources.push({ file: cfg.file, type: cfg.type || 'hls' });
          }
          if (cfg && Array.isArray(cfg.tracks)) {
            capturedTracks.push(...cfg.tracks);
          }
          return this;
        },
        key: '',
        on: noop,
        once: noop
      };
    },
    $: function() { return { ready: (fn) => { try { fn(); } catch {} }, on: noop, once: noop, ajax: noop }; },
    jQuery: function() { return { ready: (fn) => { try { fn(); } catch {} }, on: noop, once: noop, ajax: noop }; },
    console: { log: noop, error: noop, warn: noop },
    String, Math, Number, parseInt, parseFloat, Date
  };

  const context = vm.createContext(sandbox);

  // Harici kaynak olmayan tüm inline scriptleri sırayla sandbox içinde çalıştır
  const scriptRegex = /<script(?![^>]*\bsrc\b)[^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  while ((match = scriptRegex.exec(html)) !== null) {
    const code = match[1];
    if (code && code.trim().length > 0) {
      try {
        vm.runInContext(code, context, { timeout: 2500 });
      } catch {}
    }
  }

  // Rapidvid / Atom player window._p8 şifreli akış kontrolü
  const p8Match = html.match(/window\._p8\s*=\s*['"]([^'"]+)['"]/i);
  if (p8Match) {
    const p8Data = decodeRapidvidP8(p8Match[1]);
    if (p8Data) {
      if (p8Data.cm) {
        capturedSources.push({ file: p8Data.cm, type: 'hls' });
      }
      if (p8Data.tm && p8Data.tm !== p8Data.cm) {
        capturedSources.push({ file: p8Data.tm, type: 'hls' });
      }
      if (Array.isArray(p8Data.ct)) {
        p8Data.ct.forEach(c => {
          if (c && c.file) {
            capturedTracks.push({
              kind: c.kind || 'captions',
              file: c.file,
              label: (c.label || 'Altyazı').trim()
            });
          }
        });
      }
    }
  }

  for (const item of capturedSources) {
    if (item && item.file && typeof item.file === 'string') {
      const fileUrl = item.file.trim();
      const isM3u8 = fileUrl.includes('.m3u8') || fileUrl.includes('/txt/master.txt') || fileUrl.includes('master.txt') || fileUrl.includes('/mm/') || fileUrl.includes('/mx/') || item.type === 'hls';
      found.push({
        url: fileUrl,
        type: isM3u8 ? 'm3u8' : 'mp4'
      });
    }
  }

  return { streams: found, tracks: capturedTracks };
}

/**
 * Rot13 şifrelemesini çözer.
 *
 * @param {string} str
 * @returns {string}
 */
export function rot13(str) {
  return String(str || '').replace(/[a-zA-Z]/g, (c) =>
    String.fromCharCode(c.charCodeAt(0) + (c.toLowerCase() < 'n' ? 13 : -13))
  );
}

/**
 * Rapidvid / Atom player window._p8 şifreli nesnesini çözer.
 *
 * @param {string} p8
 * @returns {object|null}
 */
export function decodeRapidvidP8(p8) {
  try {
    const e = Buffer.from(String(p8 || '').split('').reverse().join(''), 'base64').toString('binary');
    let n = '';
    for (let t = 0; t < e.length; t++) {
      const a = 'K9L'[t % 3];
      const i = e.charCodeAt(t) - (a.charCodeAt(0) % 5 + 1);
      n += String.fromCharCode(i);
    }
    return JSON.parse(Buffer.from(n, 'base64').toString('utf-8'));
  } catch {
    return null;
  }
}

/**
 * HTML içindeki iframe embed kaynaklarını ayıklar.
 *
 * @param {string} html - Sayfa HTML'i
 * @param {string} baseUrl - Göreceli linkleri çözmek için ana sayfa linki
 * @returns {string[]} Bulunan iframe oynatıcı URL'leri
 */
export function extractIframeSources(html, baseUrl) {
  if (!html || typeof html !== 'string') return [];
  const iframes = new Set();
  const ignoredExts = /\.(?:webp|svg|png|jpg|jpeg|gif|ico|css|js|woff2?)(?:\?|$)/i;

  // 1. Standart iframe src
  const iframeRegex = /<iframe[^>]+src=["']([^"']+)["']/gi;
  let m;
  while ((m = iframeRegex.exec(html)) !== null) {
    let src = m[1].trim();
    if (src.startsWith('//')) {
      src = 'https:' + src;
    } else if (src.startsWith('/')) {
      try {
        const u = new URL(baseUrl);
        src = `${u.protocol}//${u.host}${src}`;
      } catch {}
    }

    if (src.startsWith('http') && !ignoredExts.test(src)) {
      if (!src.includes('google') && !src.includes('facebook') && !src.includes('recaptcha')) {
        iframes.add(src);
      }
    }
  }

  // 2. data-video_url, data-video, data-src ve data-embed nitelikleri (filmmakinesi, dizipal alternatifleri)
  const dataVideoRegex = /(?:data-video_url|data-video|data-embed)=["']([^"']+)["']/gi;
  while ((m = dataVideoRegex.exec(html)) !== null) {
    let src = m[1].trim();
    if (src.startsWith('//')) {
      src = 'https:' + src;
    } else if (src.startsWith('/')) {
      try {
        const u = new URL(baseUrl);
        src = `${u.protocol}//${u.host}${src}`;
      } catch {}
    }

    if (src.startsWith('http') && !ignoredExts.test(src)) {
      if (!src.includes('google') && !src.includes('facebook') && !src.includes('recaptcha')) {
        iframes.add(src);
      }
    }
  }

  return Array.from(iframes);
}

/**
 * Başlıktaki dizi/film sitesi sloganlarını ve dosya adı için geçersiz karakterleri temizler.
 *
 * @param {string} raw 
 * @returns {string}
 */
export function cleanWebStreamTitle(raw) {
  if (!raw) return 'Web Video Akışı';
  return raw
    .replace(/\s*[-–|•]\s*Dizipal.*$/i, '')
    .replace(/\s*[-–|•]\s*FullHDFilmizlesene.*$/i, '')
    .replace(/\s*[-–|•]\s*HDFilmcehennemi.*$/i, '')
    .replace(/\s*[-–|•]\s*JetFilm.*$/i, '')
    .replace(/\s*[-–|•]\s*Film\s*Makinesi.*$/i, '')
    .replace(/\s*[-–|•]\s*Film\s*izle.*$/i, '')
    .replace(/\s*[-–|•]\s*Dizi\s*izle.*$/i, '')
    .replace(/\s*[-–|•]\s*Full\s*HD.*$/i, '')
    .replace(/\s*[-–|•]\s*HD\s*izle.*$/i, '')
    .replace(/\s+Full\s*HD\s*Film\s*izle\b/gi, '')
    .replace(/\s+HD\s*Film\s*izle\b/gi, '')
    .replace(/\s+Film\s*izle\b/gi, '')
    .replace(/[/\\:*?"<>|｜]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Sayfadan video başlığını ve poster görselini çeker.
 *
 * @param {string} html 
 * @returns {{ title: string, poster: string }}
 */
export function extractPageMeta(html) {
  let title = 'Web Video Akışı';
  let poster = '';

  if (!html) return { title, poster };

  const ogTitleMatch = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i);
  if (ogTitleMatch && ogTitleMatch[1]) {
    title = cleanWebStreamTitle(ogTitleMatch[1]);
  } else {
    const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
    if (titleMatch && titleMatch[1]) {
      title = cleanWebStreamTitle(titleMatch[1]);
    }
  }

  const ogImageMatch = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i);
  if (ogImageMatch && ogImageMatch[1]) {
    poster = ogImageMatch[1].trim();
  }

  return { title, poster };
}

/**
 * yt-dlp kullanarak sayfayı veya embed linkini çözmeyi dener.
 *
 * @param {string} targetUrl 
 * @returns {Promise<{ title?: string, streamUrl?: string, streamType?: string }|null>}
 */
export function tryExtractWithYtdlp(targetUrl) {
  return new Promise((resolve) => {
    try {
      const args = [
        '--dump-single-json',
        '--no-warnings',
        '--no-playlist',
        '--no-check-certificates',
        '--user-agent', USER_AGENT,
        targetUrl
      ];

      const proc = spawn(ytdlpPath, args);
      let stdout = '';
      let stderr = '';

      const timer = setTimeout(() => {
        try { proc.kill(); } catch {}
        resolve(null);
      }, 25000);

      proc.stdout.on('data', (d) => { stdout += d.toString(); });
      proc.stderr.on('data', (d) => { stderr += d.toString(); });

      proc.on('close', (code) => {
        clearTimeout(timer);
        if (code === 0 && stdout) {
          try {
            const data = JSON.parse(stdout);
            let streamUrl = null;
            let streamType = 'mp4';

            // 1. Öncelik: manifest_url veya doğrudan m3u8 url
            if (data.manifest_url) {
              streamUrl = data.manifest_url;
              streamType = 'm3u8';
            } else if (data.url && typeof data.url === 'string') {
              streamUrl = data.url;
              streamType = (streamUrl.includes('.m3u8') || streamUrl.includes('master.txt')) ? 'm3u8' : 'mp4';
            } else if (Array.isArray(data.formats) && data.formats.length > 0) {
              // 2. Formatlar içinden en iyi oynatılabilir akışı seç
              // 2a. HLS master manifest veya m3u8 formatı
              const hlsFormat = data.formats.find(f => (f.url && f.url.includes('.m3u8')) || f.manifest_url || f.protocol?.includes('m3u8'));
              if (hlsFormat) {
                streamUrl = hlsFormat.manifest_url || hlsFormat.url;
                streamType = 'm3u8';
              } else {
                // 2b. Hem ses hem video içeren (progressive) mp4 formatı
                const comboFormat = data.formats
                  .filter(f => f.url && f.vcodec !== 'none' && f.acodec !== 'none')
                  .sort((a, b) => (b.height || 0) - (a.height || 0))[0];
                if (comboFormat) {
                  streamUrl = comboFormat.url;
                  streamType = 'mp4';
                } else {
                  // 2c. En azından video içeren bir format (asla audio-only alma)
                  const videoOnlyFormat = data.formats
                    .filter(f => f.url && f.vcodec !== 'none')
                    .sort((a, b) => (b.height || 0) - (a.height || 0))[0];
                  if (videoOnlyFormat) {
                    streamUrl = videoOnlyFormat.url;
                    streamType = videoOnlyFormat.url.includes('.m3u8') ? 'm3u8' : 'mp4';
                  }
                }
              }
            }

            if (streamUrl) {
              return resolve({
                title: data.title || '',
                streamUrl,
                streamType
              });
            }
          } catch {}
        }
        resolve(null);
      });

      proc.on('error', () => {
        clearTimeout(timer);
        resolve(null);
      });
    } catch {
      resolve(null);
    }
  });
}

/**
 * HTML ve sayfa URL'sinden dinamik stream API çağrılarını (/dl?op=get_stream vb.) çözümler.
 *
 * @param {string} html 
 * @param {string} pageUrl 
 * @returns {Promise<Array<{ url: string, type: string }>>} Bulunan doğrudan stream linkleri
 */
async function resolveDynamicApiStreams(html, pageUrl) {
  const foundStreams = [];
  if (!html || typeof html !== 'string') return foundStreams;

  // 1. /dl?op=get_stream deseni (Dizipal, Vidmoly, Doodstream türevleri)
  const dlMatch = html.match(/['"](\/dl\?op=get_stream[^'"]+)['"]/i) || 
                  html.match(/(https?:\/\/[^'"]+\/dl\?op=get_stream[^'"]+)/i);
  if (dlMatch) {
    try {
      let dlEndpoint = dlMatch[1];
      const pageU = new URL(pageUrl);
      if (dlEndpoint.startsWith('/')) {
        dlEndpoint = `${pageU.origin}${dlEndpoint}`;
      }
      const apiRes = await fetch(dlEndpoint, {
        headers: {
          'User-Agent': USER_AGENT,
          'Referer': pageUrl,
          'Origin': pageU.origin,
          'X-Requested-With': 'XMLHttpRequest',
          'Accept': 'application/json, text/javascript, */*; q=0.01'
        }
      });
      if (apiRes.ok) {
        const data = await apiRes.json();
        if (data && data.url && typeof data.url === 'string') {
          foundStreams.push({ url: data.url, type: 'hls' });
        }
      }
    } catch (_) {}
  }

  // 2. /api/source/ veya /ajax/get_link gibi yaygın JSON API desenleri
  const apiMatch = html.match(/['"](\/(?:api\/source|ajax\/get_link|player\/index\.php)[^'"]+)['"]/i);
  if (apiMatch) {
    try {
      let apiEndpoint = apiMatch[1];
      const pageU = new URL(pageUrl);
      if (apiEndpoint.startsWith('/')) {
        apiEndpoint = `${pageU.origin}${apiEndpoint}`;
      }
      const apiRes = await fetch(apiEndpoint, {
        headers: {
          'User-Agent': USER_AGENT,
          'Referer': pageUrl,
          'Origin': pageU.origin,
          'X-Requested-With': 'XMLHttpRequest',
          'Accept': 'application/json, text/javascript, */*; q=0.01'
        }
      });
      if (apiRes.ok) {
        const data = await apiRes.json();
        if (data) {
          if (data.url && typeof data.url === 'string') foundStreams.push({ url: data.url, type: 'hls' });
          if (Array.isArray(data.sources)) {
            data.sources.forEach(s => {
              if (s && s.file && typeof s.file === 'string') {
                foundStreams.push({ url: s.file, type: s.type || 'hls' });
              }
            });
          }
        }
      }
    } catch (_) {}
  }

  // 3. dplayer / videopark.top stream worker API deseni
  const workerMatch = html.match(/const\s+WORKER_URL\s*=\s*['"]([^'"]+)['"]/i);
  const pubMatch = html.match(/const\s+PUB_ID\s*=\s*['"]([^'"]+)['"]/i);
  const titleMatch = html.match(/const\s+VIDEO_TITLE\s*=\s*['"]([^'"]+)['"]/i) || html.match(/const\s+VIDEO_ID\s*=\s*['"]([^'"]+)['"]/i);
  const publisherMatch = html.match(/const\s+PUBLISHER_ID\s*=\s*['"]([^'"]+)['"]/i);

  if (workerMatch && pubMatch) {
    try {
      const workerUrl = workerMatch[1];
      const pubId = pubMatch[1];
      const title = titleMatch ? titleMatch[1] : '';
      const publisherId = publisherMatch ? publisherMatch[1] : '';
      let apiUrl = `${workerUrl}/api/stream?pubId=${encodeURIComponent(pubId)}&title=${encodeURIComponent(title)}`;
      if (publisherId) apiUrl += `&publisherId=${encodeURIComponent(publisherId)}`;

      const pageU = new URL(pageUrl);
      const apiRes = await fetch(apiUrl, {
        headers: {
          'User-Agent': USER_AGENT,
          'Referer': pageUrl,
          'Origin': pageU.origin,
          'Accept': 'application/json'
        }
      });
      if (apiRes.ok) {
        const data = await apiRes.json();
        if (data && data.hlsSource && data.hlsSource.file) {
          foundStreams.push({ url: data.hlsSource.file, type: 'hls' });
        } else if (data && Array.isArray(data.sources)) {
          data.sources.forEach(s => {
            if (s && s.file && typeof s.file === 'string') {
              foundStreams.push({ url: s.file, type: s.type || 'hls' });
            }
          });
        }
      }
    } catch (_) {}
  }

  return foundStreams;
}

/**
 * Cloudflare veya bot korumalı sayfaların tam HTML içeriğini yt-dlp üzerinden çeker.
 *
 * @param {string} url 
 * @returns {Promise<string|null>}
 */
export function dumpPageHtmlWithYtdlp(url, referer = null) {
  return new Promise((resolve) => {
    try {
      const args = [
        '--dump-pages',
        '--no-playlist',
        '--no-warnings',
        '--no-check-certificates',
        '--user-agent', USER_AGENT
      ];
      if (referer) {
        args.push('--referer', referer);
      }
      args.push(url);

      const proc = spawn(ytdlpPath, args);
      let stdout = '';
      const timer = setTimeout(() => {
        try { proc.kill(); } catch {}
        resolve(null);
      }, 15000);

      proc.stdout.on('data', (d) => { stdout += d.toString(); });
      proc.stderr.on('data', () => {});

      proc.on('close', () => {
        clearTimeout(timer);
        const match = stdout.match(/\[generic\] Dumping request to [^\n]+\n([A-Za-z0-9+/=]+)/);
        if (match && match[1]) {
          try {
            const html = Buffer.from(match[1], 'base64').toString('utf8');
            return resolve(html);
          } catch {}
        }
        resolve(null);
      });

      proc.on('error', () => {
        clearTimeout(timer);
        resolve(null);
      });
    } catch {
      resolve(null);
    }
  });
}

function getHostLabel(url) {
  try {
    const u = new URL(url);
    return u.hostname.replace(/^www\./, '');
  } catch {
    return 'sunucu';
  }
}

function getEmbedLabel(url) {
  const lower = url.toLowerCase();
  if (lower.includes('closeload')) return 'Embed Oynatıcı (CloseLoad - DUAL Ses / Altyazı)';
  if (lower.includes('rapid')) return 'Embed Oynatıcı (Rapidrame - DUAL)';
  if (lower.includes('hdfilmcehennemi')) return 'Embed Oynatıcı (HDFilmCehennemi - DUAL)';
  if (lower.includes('youtube.com') || lower.includes('youtu.be')) return 'Fragman / Tanıtım (YouTube)';
  return `Embed Oynatıcı (${getHostLabel(url)})`;
}

/**
 * videopark.top, playerx.info, vidmoly ve benzeri aracı iframe oynatıcılarını doğrudan akışa (.m3u8, .mp4) veya temiz gömülü linke dönüştürür.
 *
 * @param {string} iframeUrl 
 * @param {string} referer 
 * @returns {Promise<{ url: string, type: 'm3u8' | 'mp4' | 'embed', label?: string, tracks?: Array<object> }|null>}
 */
export async function resolveVideoparkSource(iframeUrl, referer) {
  if (!iframeUrl) return null;

  try {
    // 0. PlayerX kaynağı (playerx.info/?id=...) -> initialPlayback JSON'dan doğrudan HLS + altyazı
    if (iframeUrl.includes('playerx.info')) {
      const pxRes = await fetch(iframeUrl, {
        headers: { 'User-Agent': USER_AGENT, 'Referer': referer },
        signal: AbortSignal.timeout(6000)
      });
      if (pxRes.ok) {
        const pxHtml = await pxRes.text();
        const initMatch = pxHtml.match(/var\s+initialPlayback\s*=\s*({[\s\S]*?});/i);
        if (initMatch) {
          try {
            const data = JSON.parse(initMatch[1]);
            const sources = data?.item?.sources;
            if (Array.isArray(sources) && sources.length > 0 && sources[0].file) {
              let hlsFile = sources[0].file;
              if (hlsFile.startsWith('/')) {
                hlsFile = `https://playerx.info${hlsFile}`;
              } else if (!hlsFile.startsWith('http')) {
                hlsFile = `https://playerx.info/${hlsFile}`;
              }
              const tracks = Array.isArray(data?.item?.tracks) ? data.item.tracks : [];
              return { url: hlsFile, type: 'm3u8', label: 'PlayerX (Dual Ses)', tracks };
            }
          } catch (_) {}
        }
      }
    }

    // 0b. Vidmoly embed kaynağı (vidmoly.biz / vidmoly.to / embed-*.html) -> master.m3u8 doğrudan akış
    if (iframeUrl.includes('vidmoly.')) {
      const vmRes = await fetch(iframeUrl, {
        headers: { 'User-Agent': USER_AGENT, 'Referer': referer },
        signal: AbortSignal.timeout(6000)
      });
      if (vmRes.ok) {
        const vmHtml = await vmRes.text();
        const m3u8Match = vmHtml.match(/file\s*:\s*["']([^"']+\.m3u8[^"']*)["']/i);
        if (m3u8Match && m3u8Match[1]) {
          let m3u8Url = m3u8Match[1];
          if (m3u8Url.startsWith('//')) m3u8Url = 'https:' + m3u8Url;
          return { url: m3u8Url, type: 'm3u8', label: 'Vidmoly' };
        }
      }
    }

    // 1. Apollo kaynağı (/apollo/?id=...) -> get_video.php üzerinden doğrudan HLS m3u8
    const apolloMatch = iframeUrl.match(/apollo\/\?id=(\d+)/i);
    if (apolloMatch) {
      const apolloId = apolloMatch[1];
      const res = await fetch('https://videopark.top/apollo/get_video.php', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'X-Requested-With': 'XMLHttpRequest',
          'User-Agent': USER_AGENT,
          'Referer': iframeUrl
        },
        body: `id=${apolloId}`,
        signal: AbortSignal.timeout(6000)
      });
      if (res.ok) {
        const data = await res.json();
        if (data && data.hlsUrl) {
          const hlsUrl = data.hlsUrl.startsWith('http') ? data.hlsUrl : `https://videopark.top/apollo/${data.hlsUrl.replace(/^\//, '')}`;
          return { url: hlsUrl, type: 'm3u8', label: 'Apollo' };
        }
      }
    }

    // 1b. Videopark VIP kaynağı (/vip/?id=...) -> stream API üzerinden doğrudan HLS m3u8
    if (iframeUrl.includes('/vip/')) {
      const vipRes = await fetch(iframeUrl, {
        headers: { 'User-Agent': USER_AGENT, 'Referer': referer },
        signal: AbortSignal.timeout(6000)
      });
      if (vipRes.ok) {
        const vipHtml = await vipRes.text();
        const workerMatch = vipHtml.match(/const\s+WORKER_URL\s*=\s*['"]([^'"]+)['"]/i);
        const pubMatch = vipHtml.match(/const\s+PUB_ID\s*=\s*['"]([^'"]+)['"]/i);
        const titleMatch = vipHtml.match(/const\s+VIDEO_TITLE\s*=\s*['"]([^'"]+)['"]/i);
        if (workerMatch && pubMatch) {
          try {
            const apiUrl = `${workerMatch[1]}/api/stream?pubId=${pubMatch[1]}&title=${encodeURIComponent(titleMatch ? titleMatch[1] : '')}`;
            const sRes = await fetch(apiUrl, {
              headers: { 'User-Agent': USER_AGENT, 'Referer': iframeUrl },
              signal: AbortSignal.timeout(6000)
            });
            if (sRes.ok) {
              const sData = await sRes.json();
              if (sData?.hlsSource?.file) {
                return { url: sData.hlsSource.file, type: 'm3u8', label: 'VIP' };
              }
            }
          } catch (_) {}
        }
      }
    }

    // 2. Gold kaynağı (/go/?id=...) -> workers.dev üzerinden doğrudan MP4
    const goMatch = iframeUrl.match(/\/go\/\?id=(\d+)/i);
    if (goMatch) {
      const goRes = await fetch(iframeUrl, {
        headers: { 'User-Agent': USER_AGENT, 'Referer': referer },
        signal: AbortSignal.timeout(6000)
      });
      if (goRes.ok) {
        const goHtml = await goRes.text();
        const wb = goHtml.match(/const\s+WORKER_BASE\s*=\s*"([^"]+)"/i);
        const vid = goHtml.match(/const\s+VIDEO_ID\s*=\s*(\d+)/i);
        if (wb && vid) {
          const base = wb[1].replace(/\\/g, '');
          return { url: `${base}/v/${vid[1]}`, type: 'mp4', label: 'Gold' };
        }
      }
    }

    // 3. VK kaynağı (/vk/?id=...) -> Doğrudan VK iframe
    if (iframeUrl.includes('/vk/')) {
      const vkRes = await fetch(iframeUrl, {
        headers: { 'User-Agent': USER_AGENT, 'Referer': referer },
        signal: AbortSignal.timeout(6000)
      });
      if (vkRes.ok) {
        const vkHtml = await vkRes.text();
        const vkIframe = vkHtml.match(/<iframe[^>]+src=["']([^"']+)["']/i);
        if (vkIframe && vkIframe[1]) {
          return { url: vkIframe[1], type: 'embed', label: 'VK' };
        }
      }
    }

    // 4. Mail kaynağı (/mail/embed-...) -> Doğrudan Mail.ru iframe
    if (iframeUrl.includes('/mail/')) {
      const mailRes = await fetch(iframeUrl, {
        headers: { 'User-Agent': USER_AGENT, 'Referer': referer },
        signal: AbortSignal.timeout(6000)
      });
      if (mailRes.ok) {
        const mailHtml = await mailRes.text();
        const mailIframe = mailHtml.match(/<iframe[^>]+src=["']([^"']+)["']/i);
        if (mailIframe && mailIframe[1]) {
          return { url: mailIframe[1], type: 'embed', label: 'Mail' };
        }
      }
    }

    // 5. JetGlobal kaynağı (/jetembed/tt...) -> API sources
    if (iframeUrl.includes('/jetembed/')) {
      const ttMatch = iframeUrl.match(/tt\d+/i);
      if (ttMatch) {
        const apiRes = await fetch(`https://videopark.top/jetembed/backend/api_sources.php?imdb=${ttMatch[0]}&type=movie`, {
          headers: { 'User-Agent': USER_AGENT, 'Referer': iframeUrl },
          signal: AbortSignal.timeout(6000)
        });
        if (apiRes.ok) {
          const data = await apiRes.json();
          if (data && Array.isArray(data.sources) && data.sources.length > 0) {
            return { url: data.sources[0].url, type: 'embed', label: 'JetGlobal' };
          }
        }
      }
    }
  } catch {}

  return null;
}

/**
 * Verilen bir URL'yi analiz edip oynatılabilir stream/iframe kaynaklarını tespit eder.
 *
 * @param {string} rawUrl - Kullanıcının girdiği web sayfası linki
 * @param {string} [preferredMethod='auto'] - Tercih edilen çözümleme yöntemi ('auto', 'sandbox', 'ytdlp', 'direct', 'embed')
 * @returns {Promise<object>} Çözümleme sonucu
 */
export async function extractStreamFromUrl(rawUrl, preferredMethod = 'auto') {
  if (!rawUrl || typeof rawUrl !== 'string') {
    return { success: false, error: 'Geçersiz bağlantı adresi.' };
  }

  let targetUrl = rawUrl.trim();
  if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
    targetUrl = 'https://' + targetUrl;
  }

  try {
    // 0. Eğer kullanıcı doğrudan bir .m3u8 veya .mp4 linki verdiyse
    if (targetUrl.includes('.m3u8') || targetUrl.includes('.mp4') || targetUrl.includes('master.txt')) {
      const streamType = (targetUrl.includes('.m3u8') || targetUrl.includes('master.txt')) ? 'm3u8' : 'mp4';
      return {
        success: true,
        title: 'Doğrudan Medya Akışı',
        sourceUrl: targetUrl,
        streamUrl: targetUrl,
        streamType,
        embedUrl: null,
        allStreams: [{ label: `Doğrudan Akış (${streamType.toUpperCase()})`, url: targetUrl, type: streamType, referer: targetUrl }],
        poster: '',
        referer: targetUrl,
        streamReferer: targetUrl
      };
    }

    // 0b. Kullanıcı doğrudan yt-dlp motorunu seçtiyse öncelikle yt-dlp'yi dene
    if (preferredMethod === 'ytdlp') {
      const ytdlpResult = await tryExtractWithYtdlp(targetUrl);
      if (ytdlpResult && ytdlpResult.streamUrl) {
        return {
          success: true,
          title: cleanWebStreamTitle(ytdlpResult.title) || 'Web Video Akışı (yt-dlp)',
          sourceUrl: targetUrl,
          streamUrl: ytdlpResult.streamUrl,
          streamType: ytdlpResult.streamType,
          embedUrl: null,
          directStreamUrl: ytdlpResult.streamUrl,
          streamReferer: targetUrl,
          allStreams: [{ label: `yt-dlp Akışı (${ytdlpResult.streamType.toUpperCase()})`, url: ytdlpResult.streamUrl, rawUrl: ytdlpResult.streamUrl, type: ytdlpResult.streamType, referer: targetUrl }],
          tracks: [],
          poster: '',
          referer: targetUrl
        };
      }
    }

    // Akışların kaynak referer ve tür eşleştirmesi
    const streamRefererMap = new Map();
    const streamTypeMap = new Map();
    const allTracks = [];
    const namedStreams = [];

    function isHlsUrl(u) {
      if (!u) return false;
      const mapped = streamTypeMap.get(u);
      if (mapped === 'hls' || mapped === 'm3u8') return true;
      if (mapped === 'mp4') return false;
      return u.includes('.m3u8') || u.includes('master.txt') || u.includes('/m/') || u.includes('/mm/') || u.includes('/mx/') || u.includes('workers.dev') || u.includes('cdnimage') || /\/m[0-9a-z]\//i.test(u);
    }

    // 1. Ana sayfayı fetch et
    const pageRes = await fetch(targetUrl, {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7',
        'Referer': targetUrl
      },
      redirect: 'follow'
    });

    let html = '';
    if (!pageRes.ok) {
      // 1. HTTP 403 veya Cloudflare koruması varsa yt-dlp ile sayfa HTML'ini çekmeyi dene
      const dumpedHtml = await dumpPageHtmlWithYtdlp(targetUrl);
      if (dumpedHtml && dumpedHtml.length > 500) {
        html = dumpedHtml;
      } else {
        // HTML alınamadıysa doğrudan yt-dlp akış çözümlemesini dene
        const ytdlpResult = await tryExtractWithYtdlp(targetUrl);
        if (ytdlpResult && ytdlpResult.streamUrl) {
          return {
            success: true,
            title: cleanWebStreamTitle(ytdlpResult.title) || 'Web Video Akışı',
            sourceUrl: targetUrl,
            streamUrl: ytdlpResult.streamUrl,
            streamType: ytdlpResult.streamType,
            embedUrl: null,
            directStreamUrl: ytdlpResult.streamUrl,
            allStreams: [{ label: `Çözümlenen Akış (${ytdlpResult.streamType.toUpperCase()})`, url: ytdlpResult.streamUrl, type: ytdlpResult.streamType, referer: targetUrl }],
            poster: '',
            referer: targetUrl,
            streamReferer: targetUrl
          };
        }

        const isCf = pageRes.status === 403;
        const errorMsg = isCf
          ? 'Bu site Cloudflare koruması (Turnstile / Bot Gate) kullanmaktadır. Akış koruma arkasında kaldığından dahili tarayıcı veya HaYTooL uzantısı ile sayfayı açıp oynatmayı deneyebilirsiniz.'
          : `Sayfaya erişilemedi (HTTP ${pageRes.status}).`;

        return {
          success: false,
          isCloudflare: isCf,
          error: errorMsg
        };
      }
    } else {
      html = await pageRes.text();
    }

    // 1b. Eğer kullanıcı bir dizi ana sayfası verdi ise (örn: /dizi/gibi/), sayfadaki ilk bölümü otomatik tespit et ve ona yönlendir
    if (html && (targetUrl.includes('/dizi/') && !targetUrl.includes('/bolum/') && !targetUrl.includes('sezon-'))) {
      const firstEpMatch = html.match(/href=["']([^"'\s]*\/bolum\/[^"'\s]+)["']/i);
      if (firstEpMatch && firstEpMatch[1]) {
        try {
          targetUrl = new URL(firstEpMatch[1], rawUrl).href;
          const epRes = await fetch(targetUrl, {
            headers: { 'User-Agent': USER_AGENT, 'Referer': rawUrl }
          });
          if (epRes.ok) {
            html = await epRes.text();
          }
        } catch {}
      }
    }

    const { title, poster } = extractPageMeta(html);

    // 2. Sayfada doğrudan m3u8 veya mp4 var mı kontrol et
    let directStreams = extractDirectVideoUrls(html);
    directStreams.forEach(u => streamRefererMap.set(u, targetUrl));

    // 3. Ana sayfadaki dinamik API çağrılarını çöz (Sayfa doğrudan embed oynatıcı olabilir)
    const directApiStreams = await resolveDynamicApiStreams(html, targetUrl);
    for (const item of directApiStreams) {
      const u = typeof item === 'string' ? item : item.url;
      const t = typeof item === 'object' && item.type ? item.type : 'hls';
      directStreams.push(u);
      streamRefererMap.set(u, targetUrl);
      if (t === 'hls' || t === 'm3u8' || isHlsUrl(u)) {
        streamTypeMap.set(u, 'm3u8');
      }
    }

    // 4. Ana sayfadaki dinamik / şifreli JWPlayer kodlarını sandbox ile çöz
    const mainSandboxResult = extractJwplayerFromSandbox(html, targetUrl);
    if (mainSandboxResult && Array.isArray(mainSandboxResult.streams)) {
      for (const s of mainSandboxResult.streams) {
        directStreams.push(s.url);
        streamRefererMap.set(s.url, targetUrl);
        if (s.type === 'hls' || isHlsUrl(s.url)) {
          streamTypeMap.set(s.url, 'm3u8');
        }
      }
      if (Array.isArray(mainSandboxResult.tracks)) {
        allTracks.push(...mainSandboxResult.tracks);
      }
    }

    // 5. Packed JS kodlarını açıp orada ara
    const unpackedBlocks = unpackAllPackedJs(html);
    for (const code of unpackedBlocks) {
      const fromPacked = extractDirectVideoUrls(code);
      fromPacked.forEach(u => streamRefererMap.set(u, targetUrl));
      directStreams.push(...fromPacked);
    }

    // Tekilleştir
    directStreams = Array.from(new Set(directStreams));

    // 6. Iframe embed kaynaklarını topla ve filmleri fragmandan ayır
    const rawIframes = extractIframeSources(html, targetUrl);
    const movieIframes = [];
    const trailerIframes = [];

    for (const u of rawIframes) {
      const lower = u.toLowerCase();
      if (lower.includes('youtube.com') || lower.includes('youtu.be') || lower.includes('trailer') || lower.includes('fragman') || lower.includes('tanitim') || lower.includes('teaser') || lower.includes('preview')) {
        trailerIframes.push(u);
      } else {
        movieIframes.push(u);
      }
    }

    // 6b. jetfilmizle ve benzeri AJAX ile player çeken siteler (POST /jetplayer veya film_id)
    const filmIdMatch = html.match(/name=["']film_id["'][^>]*value=["']([^"']+)["']/i) ||
                        html.match(/value=["']([^"']+)["'][^>]*name=["']film_id["']/i);
    if (filmIdMatch && (html.includes('player-source-btn') || html.includes('jetplayer') || html.includes('film_id'))) {
      const filmId = filmIdMatch[1];
      try {
        const targetOrigin = new URL(targetUrl).origin;
        const endpoint = `${targetOrigin}/jetplayer`;

        // Sayfadaki kaynak butonlarını tespit et
        const rawBtns = [...html.matchAll(/<button[^>]*class="[^"]*player-source-btn[^"]*"[^>]*data-source-index="(\d+)"[^>]*data-player-type="([^"]+)"[^>]*>([\s\S]*?)<\/button>/gi)];
        let buttons = rawBtns.map(b => ({
          index: parseInt(b[1], 10),
          type: b[2].trim(),
          label: b[3].replace(/<[^>]+>/g, '').trim()
        }));

        if (buttons.length === 0) {
          ['dublaj', 'altyazili', 'genel'].forEach(pt => {
            for (let i = 0; i < 6; i++) {
              buttons.push({ index: i, type: pt, label: `Kaynak ${i + 1}` });
            }
          });
        }

        for (const btn of buttons) {
          try {
            const jetRes = await fetch(endpoint, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'X-Requested-With': 'XMLHttpRequest',
                'User-Agent': USER_AGENT,
                'Referer': targetUrl
              },
              body: `film_id=${filmId}&source_index=${btn.index}&player_type=${btn.type}`,
              signal: AbortSignal.timeout(6000)
            });
            if (jetRes.ok) {
              const jetHtml = await jetRes.text();
              const iframeMatch = jetHtml.match(/<iframe[^>]+src=["']([^"']+)["']/i);
              if (iframeMatch && iframeMatch[1]) {
                let iframeSrc = iframeMatch[1].trim();
                if (iframeSrc.startsWith('//')) iframeSrc = 'https:' + iframeSrc;
                else if (iframeSrc.startsWith('/')) iframeSrc = `${targetOrigin}${iframeSrc}`;

                const typeLabel = (btn.type === 'dublaj') ? 'Dublaj' : ((btn.type === 'altyazili') ? 'Altyazılı' : (btn.type === 'genel' ? 'Dil+' : btn.type));
                const cleanBtnLabel = btn.label || `Kaynak ${btn.index + 1}`;

                // videopark resolver ile doğrudan stream veya embed linkini çöz
                const resolved = await resolveVideoparkSource(iframeSrc, targetUrl);
                if (resolved && (resolved.type === 'm3u8' || resolved.type === 'mp4')) {
                  directStreams.push(resolved.url);
                  streamRefererMap.set(resolved.url, iframeSrc);
                  streamTypeMap.set(resolved.url, resolved.type);
                  if (Array.isArray(resolved.tracks)) {
                    allTracks.push(...resolved.tracks);
                  }
                  namedStreams.push({
                    label: `▶ ${cleanBtnLabel} (${typeLabel} - ${resolved.type.toUpperCase()})`,
                    url: resolved.url,
                    rawUrl: resolved.url,
                    type: resolved.type,
                    referer: iframeSrc
                  });
                } else if (resolved && resolved.type === 'embed') {
                  movieIframes.push(resolved.url);
                  namedStreams.push({
                    label: `📺 ${cleanBtnLabel} (${typeLabel} - Embed)`,
                    url: resolved.url,
                    rawUrl: resolved.url,
                    type: 'embed',
                    referer: targetUrl
                  });
                } else {
                  if (iframeSrc.toLowerCase().includes('youtube.com') || iframeSrc.toLowerCase().includes('youtu.be')) {
                    trailerIframes.push(iframeSrc);
                  } else {
                    movieIframes.push(iframeSrc);
                    namedStreams.push({
                      label: `📺 ${cleanBtnLabel} (${typeLabel} - Embed)`,
                      url: iframeSrc,
                      rawUrl: iframeSrc,
                      type: 'embed',
                      referer: targetUrl
                    });
                  }
                }
              }
            }
          } catch (_) {}
        }
      } catch (_) {}
    }

    // 6d. filmmakinesi ve benzeri sitelerdeki video-parts kaynak butonları
    const partsMatch = html.match(/class=["'][^"']*video-parts[^"']*["']([\s\S]*?)<\/div>/i);
    if (partsMatch) {
      const partLinks = [...partsMatch[1].matchAll(/<a[^>]*data-video_url=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)];
      for (const pl of partLinks) {
        let vUrl = pl[1].trim();
        const pLabel = pl[2].replace(/<[^>]+>/g, '').trim() || 'Kaynak';
        if (vUrl.startsWith('//')) vUrl = 'https:' + vUrl;
        if (!movieIframes.includes(vUrl)) {
          movieIframes.push(vUrl);
        }
      }
    }
    const scxMatch = html.match(/var\s+scx\s*=\s*({[\s\S]*?});/i);
    if (scxMatch) {
      try {
        const scxObj = JSON.parse(scxMatch[1]);
        for (const sKey in scxObj) {
          const sVal = scxObj[sKey];
          if (sVal && sVal.sx) {
            const allItems = [...(sVal.sx.p || []), ...(sVal.sx.t || [])];
            for (const item of allItems) {
              if (typeof item === 'string') {
                if (item.startsWith('http')) {
                  if (!movieIframes.includes(item)) movieIframes.push(item);
                } else {
                  try {
                    const decoded = Buffer.from(rot13(item), 'base64').toString('utf-8').trim();
                    if (decoded.startsWith('http') && !movieIframes.includes(decoded)) {
                      movieIframes.push(decoded);
                    }
                  } catch {}
                }
              }
            }
          }
        }
      } catch (_) {}
    }

    const iframes = [...movieIframes, ...trailerIframes];
    let chosenEmbedUrl = movieIframes[0] || iframes[0] || null;

    // Eğer kullanıcı doğrudan 'embed' oynatıcı modunu seçtiyse hemen döndür
    if (preferredMethod === 'embed' && movieIframes.length > 0) {
      const allEmbedStreams = movieIframes.map((emb, idx) => ({
        label: getEmbedLabel(emb),
        url: emb,
        rawUrl: emb,
        type: 'embed',
        referer: targetUrl
      }));
      return {
        success: true,
        title: title || 'Gömülü Video Oynatıcı',
        sourceUrl: targetUrl,
        streamUrl: movieIframes[0],
        streamType: 'embed',
        embedUrl: movieIframes[0],
        directStreamUrl: movieIframes[0],
        streamReferer: targetUrl,
        allStreams: allEmbedStreams,
        tracks: [],
        poster,
        referer: targetUrl
      };
    }

    // 7. Iframe'lerin içine girip doğrudan akış ve dinamik API çağrılarını tara (direct modunda iframe sandboxing atlanır)
    if (movieIframes.length > 0 && preferredMethod !== 'direct') {
      for (const iframeUrl of movieIframes.slice(0, 4)) {
        try {
          let iframeHtml = null;
          try {
            const iframeRes = await fetch(iframeUrl, {
              headers: {
                'User-Agent': USER_AGENT,
                'Referer': targetUrl
              },
              redirect: 'follow'
            });
            if (iframeRes.ok) {
              iframeHtml = await iframeRes.text();
            }
          } catch {}

          // Cloudflare Turnstile / 403 korumalı embed sayfaları (CloseLoad, Rapidrame vb.) için yt-dlp ile referer'lı dump al
          if (!iframeHtml && (iframeUrl.includes('closeload') || iframeUrl.includes('rapid') || iframeUrl.includes('filmmakinesi') || iframeUrl.includes('hdfilmcehennemi'))) {
            try {
              iframeHtml = await dumpPageHtmlWithYtdlp(iframeUrl, targetUrl);
            } catch {}
          }

          if (iframeHtml) {
            // 7a. Sandbox ile JWPlayer / dinamik şifreli kaynakları çöz (cpe3e, rk5, ai73, v54, w6wf vb.)
            const sandboxResult = extractJwplayerFromSandbox(iframeHtml, iframeUrl);
            if (sandboxResult && Array.isArray(sandboxResult.streams)) {
              for (const s of sandboxResult.streams) {
                directStreams.push(s.url);
                streamRefererMap.set(s.url, iframeUrl);
                if (s.type === 'hls' || isHlsUrl(s.url)) {
                  streamTypeMap.set(s.url, 'm3u8');
                }
              }
              if (Array.isArray(sandboxResult.tracks)) {
                allTracks.push(...sandboxResult.tracks);
              }
            }

            // 7b. Iframe içindeki dinamik stream API (/dl?op=get_stream, worker /api/stream vb.)
            const apiStreams = await resolveDynamicApiStreams(iframeHtml, iframeUrl);
            for (const item of apiStreams) {
              const u = typeof item === 'string' ? item : item.url;
              const t = typeof item === 'object' && item.type ? item.type : 'hls';
              directStreams.push(u);
              streamRefererMap.set(u, iframeUrl);
              if (t === 'hls' || t === 'm3u8' || isHlsUrl(u)) {
                streamTypeMap.set(u, 'm3u8');
              }
            }

            // 7c. Iframe içindeki doğrudan akışlar
            const fromIframe = extractDirectVideoUrls(iframeHtml);
            fromIframe.forEach(u => streamRefererMap.set(u, iframeUrl));
            directStreams.push(...fromIframe);

            // 7d. Iframe içindeki packed JS
            const iframePacked = unpackAllPackedJs(iframeHtml);
            for (const code of iframePacked) {
              const fromPack = extractDirectVideoUrls(code);
              fromPack.forEach(u => streamRefererMap.set(u, iframeUrl));
              directStreams.push(...fromPack);
            }

            if ((directStreams.length > 0 || apiStreams.length > 0) && !chosenEmbedUrl) {
              chosenEmbedUrl = iframeUrl;
            }
          }
        } catch {}
      }
    }

    directStreams = Array.from(new Set(directStreams));

    // 8. Hala bulunamadıysa yt-dlp ile dene (fragman değilse)
    if (directStreams.length === 0 && chosenEmbedUrl && !chosenEmbedUrl.includes('youtube.com') && !chosenEmbedUrl.includes('youtu.be')) {
      const ytdlpResult = await tryExtractWithYtdlp(chosenEmbedUrl);
      if (ytdlpResult && ytdlpResult.streamUrl) {
        directStreams.push(ytdlpResult.streamUrl);
        streamRefererMap.set(ytdlpResult.streamUrl, chosenEmbedUrl);
        if (ytdlpResult.streamType === 'm3u8' || isHlsUrl(ytdlpResult.streamUrl)) {
          streamTypeMap.set(ytdlpResult.streamUrl, 'm3u8');
        }
      }
    }

    // 9. Sonuçları derle
    const allStreams = [];

    function makePlayableUrl(u, ref) {
      if (ref && (isHlsUrl(u) || u.includes('.mp4') || u.includes('.ts'))) {
        return `/api/tools/web-stream-proxy?url=${encodeURIComponent(u)}&referer=${encodeURIComponent(ref)}`;
      }
      return u;
    }

    let primaryDirectUrl = null;
    let primaryDirectType = null;
    let primaryDirectReferer = null;
    let effectiveEmbedUrl = null;

    if (namedStreams.length > 0) {
      const firstDirect = namedStreams.find(s => s.type === 'm3u8' || s.type === 'mp4');
      if (firstDirect) {
        primaryDirectUrl = firstDirect.url;
        primaryDirectType = firstDirect.type;
        primaryDirectReferer = firstDirect.referer || targetUrl;
      } else {
        effectiveEmbedUrl = namedStreams[0].url;
      }

      // Adlandırılmış kaynakları doğrudan allStreams içine ekle
      const seen = new Set();
      for (const ns of namedStreams) {
        if (!seen.has(ns.url)) {
          seen.add(ns.url);
          const isDirect = (ns.type === 'm3u8' || ns.type === 'mp4');
          allStreams.push({
            label: ns.label,
            url: isDirect ? makePlayableUrl(ns.url, ns.referer) : ns.url,
            rawUrl: ns.rawUrl || ns.url,
            type: ns.type,
            referer: ns.referer || targetUrl,
            isTrailer: false
          });
        }
      }

      // Varsa YouTube fragmanını da ekle
      if (trailerIframes.length > 0) {
        trailerIframes.slice(0, 1).forEach((emb) => {
          allStreams.push({
            label: `🎬 Fragman / Tanıtım (YouTube)`,
            url: emb,
            rawUrl: emb,
            type: 'embed',
            referer: targetUrl,
            isTrailer: true
          });
        });
      }
    } else {
      if (directStreams.length > 0) {
        const sorted = directStreams.sort((a, b) => {
          const aM3u8 = isHlsUrl(a);
          const bM3u8 = isHlsUrl(b);
          return (bM3u8 ? 1 : 0) - (aM3u8 ? 1 : 0);
        });
        primaryDirectUrl = sorted[0];
        primaryDirectType = isHlsUrl(primaryDirectUrl) ? 'm3u8' : 'mp4';
        primaryDirectReferer = streamRefererMap.get(primaryDirectUrl) || chosenEmbedUrl || targetUrl;
      }

      effectiveEmbedUrl = movieIframes[0] || (directStreams.length === 0 ? iframes[0] : null);

      // 1. Önce doğrudan oynatılabilir HLS / MP4 akışlarını ekle (Filmler)
      let movieStreamCount = 0;
      if (directStreams.length > 0) {
        const sorted = directStreams.sort((a, b) => {
          const aM3u8 = isHlsUrl(a);
          const bM3u8 = isHlsUrl(b);
          return (bM3u8 ? 1 : 0) - (aM3u8 ? 1 : 0);
        });
        sorted.forEach((u) => {
          movieStreamCount++;
          const isM3u8 = isHlsUrl(u);
          const stRef = streamRefererMap.get(u) || chosenEmbedUrl || targetUrl;
          const host = getHostLabel(stRef || u);
          allStreams.push({
            label: `▶ ${movieStreamCount}. Film (${isM3u8 ? 'HLS' : 'MP4'} - ${host})`,
            url: makePlayableUrl(u, stRef),
            rawUrl: u,
            type: isM3u8 ? 'm3u8' : 'mp4',
            referer: stRef,
            isTrailer: false
          });
        });
      }

      // 2. Ardından alternatif olarak site yerleşik Embed oynatıcılarını ekle (Film Embedleri)
      if (movieIframes.length > 0) {
        movieIframes.slice(0, 6).forEach((emb) => {
          allStreams.push({
            label: `📺 Gömülü Film (${getEmbedLabel(emb)})`,
            url: emb,
            rawUrl: emb,
            type: 'embed',
            referer: targetUrl,
            isTrailer: false
          });
        });
      }

      // 3. Varsa YouTube fragman / tanıtım videolarını en sona ekle
      if (trailerIframes.length > 0) {
        trailerIframes.slice(0, 2).forEach((emb) => {
          allStreams.push({
            label: `🎬 Fragman / Tanıtım (YouTube)`,
            url: emb,
            rawUrl: emb,
            type: 'embed',
            referer: targetUrl,
            isTrailer: true
          });
        });
      }
    }

    const playerUrl = primaryDirectUrl 
      ? makePlayableUrl(primaryDirectUrl, primaryDirectReferer)
      : (effectiveEmbedUrl || null);
    const playerType = primaryDirectUrl ? primaryDirectType : (effectiveEmbedUrl ? 'embed' : null);

    if (!playerUrl) {
      return {
        success: false,
        error: 'Sayfada oynatılabilir video akışı veya embed oynatıcı tespit edilemedi.',
        title,
        sourceUrl: targetUrl
      };
    }

    const activeReferer = primaryDirectReferer || effectiveEmbedUrl || targetUrl;

    // Altyazı VTT dosyalarını proxy üzerinden geçirerek CORS ve Referer engellerini aş
    const processedTracks = allTracks.map(t => {
      if (t && t.file && t.file.startsWith('http')) {
        return {
          ...t,
          file: `/api/tools/web-stream-proxy?url=${encodeURIComponent(t.file)}&referer=${encodeURIComponent(activeReferer)}`
        };
      }
      return t;
    });

    return {
      success: true,
      title,
      sourceUrl: targetUrl,
      streamUrl: playerUrl,
      streamType: playerType,
      embedUrl: effectiveEmbedUrl,
      directStreamUrl: primaryDirectUrl || playerUrl,
      streamReferer: activeReferer,
      allStreams,
      hasMultipleStreams: allStreams.length > 1,
      promptUserSelection: preferredMethod === 'prompt',
      tracks: processedTracks,
      poster,
      referer: activeReferer
    };

  } catch (err) {
    return {
      success: false,
      error: `Çözümleme sırasında hata oluştu: ${err.message}`
    };
  }
}

// --- KAYNAK SİTELERDE ARAMA SİSTEMİ (MULTI-SITE SEARCH) ---

let cachedDizipalParams = null;
let cachedDizipalTime = 0;

async function getDizipalSearchParams() {
  const now = Date.now();
  if (cachedDizipalParams && (now - cachedDizipalTime) < 10 * 60 * 1000) {
    return cachedDizipalParams;
  }
  try {
    const homeRes = await fetch('https://dizipal3009.com/', {
      headers: { 'User-Agent': USER_AGENT }
    });
    if (!homeRes.ok) return null;
    const html = await homeRes.text();
    const m = html.match(/var\s+live_search_params\s*=\s*({[\s\S]*?});/i);
    if (m) {
      cachedDizipalParams = JSON.parse(m[1]);
      cachedDizipalTime = now;
      return cachedDizipalParams;
    }
  } catch {}
  return null;
}

export async function searchJetfilmizle(query) {
  try {
    const res = await fetch(`https://jetfilmizle.app/arama-json?q=${encodeURIComponent(query)}`, {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'application/json',
        'X-Requested-With': 'XMLHttpRequest'
      },
      signal: AbortSignal.timeout(8000)
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.results || []).map(r => ({
      title: r.title,
      originalTitle: r.original_title || '',
      url: r.url.startsWith('http') ? r.url : `https://jetfilmizle.app/${r.url.replace(/^\//, '')}`,
      poster: r.poster || '',
      year: r.year || '',
      rating: r.rating || '',
      type: r.type === 'dizi' ? 'dizi' : 'film',
      source: 'Jetfilmizle'
    }));
  } catch {
    return [];
  }
}

export async function searchDizipal(query) {
  try {
    const params = await getDizipalSearchParams();
    if (!params || !params.ajax_url) return [];

    const res = await fetch(params.ajax_url, {
      method: 'POST',
      headers: {
        'User-Agent': USER_AGENT,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Referer': 'https://dizipal3009.com/',
        'X-Requested-With': 'XMLHttpRequest'
      },
      body: `action=keremiya_live_search&nonce=${params.nonce}&query=${encodeURIComponent(query)}`,
      signal: AbortSignal.timeout(8000)
    });
    if (!res.ok) return [];
    const resHtml = await res.text();
    const results = [];
    const itemRegex = /<div class="flex items-start gap-3">[\s\S]*?<a href="([^"]+)" class="search-item-poster[^"]*"[\s\S]*?<img[^>]+src="([^"]+)"[\s\S]*?<h4 class="search-item-title[^"]*"[\s\S]*?<a[^>]*>([^<]+)<\/a>/gi;
    let match;
    while ((match = itemRegex.exec(resHtml)) !== null) {
      const itemUrl = match[1];
      const poster = match[2];
      const title = match[3].trim();
      results.push({
        title,
        url: itemUrl,
        poster,
        year: '',
        type: itemUrl.includes('/dizi/') ? 'dizi' : 'film',
        source: 'Dizipal'
      });
    }
    return results;
  } catch {
    return [];
  }
}

export async function searchFullHDFilmizlesene(query) {
  try {
    const url = `https://www.fullhdfilmizlesene.now/arama/${encodeURIComponent(query)}`;
    const html = await dumpPageHtmlWithYtdlp(url);
    if (!html) return [];
    const results = [];
    const itemRegex = /<li class="film">([\s\S]*?)<\/li>/gi;
    let match;
    while ((match = itemRegex.exec(html)) !== null) {
      const block = match[1];
      const linkMatch = block.match(/<a class="tt" href="([^"]+)">([^<]+)<\/a>/i);
      if (!linkMatch) continue;
      const itemUrl = linkMatch[1];
      const rawTitle = linkMatch[2];
      const yearMatch = block.match(/class="film-yil">([^<]+)<\/span>/i);
      const imgMatch = block.match(/(?:srcset|src)="([^"'\s]+)/i);
      results.push({
        title: cleanWebStreamTitle(rawTitle.trim()),
        url: itemUrl,
        year: yearMatch ? yearMatch[1].trim() : '',
        poster: imgMatch ? imgMatch[1] : '',
        type: 'film',
        source: 'FullHDFilmizlesene'
      });
    }
    return results;
  } catch {
    return [];
  }
}

export async function searchHdfilmcehennemi(query) {
  return new Promise((resolve) => {
    try {
      const url = `https://www.hdfilmcehennemi.nl/search/?q=${encodeURIComponent(query)}`;
      const outDir = path.resolve('.agents');
      const outTemplate = path.join(outDir, `temp_hdfc_${Date.now()}_%(id)s.json`);
      const args = [
        '--no-playlist',
        '--no-warnings',
        '--no-check-certificates',
        '--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        '--referer', 'https://www.hdfilmcehennemi.nl/',
        '--add-header', 'X-Requested-With:fetch',
        '--add-header', 'Content-Type:application/json',
        '-o', outTemplate,
        url
      ];

      const proc = spawn(ytdlpPath, args);
      const timer = setTimeout(() => {
        try { proc.kill(); } catch {}
        resolve([]);
      }, 15000);

      proc.on('close', () => {
        clearTimeout(timer);
        try {
          const files = fs.readdirSync(outDir).filter(f => f.startsWith('temp_hdfc_'));
          for (const f of files) {
            const filePath = path.join(outDir, f);
            try {
              const content = fs.readFileSync(filePath, 'utf8');
              try { fs.unlinkSync(filePath); } catch {}
              const data = JSON.parse(content);
              if (data && Array.isArray(data.results)) {
                const parsed = [];
                for (const htmlBlock of data.results) {
                  const linkMatch = htmlBlock.match(/<a[^>]+href=["']([^"']+)["'][^>]*class=["'][^"']*search-result[^"']*["']/i);
                  const titleMatch = htmlBlock.match(/<h4 class=["']title["']>([^<]+)<\/h4>/i);
                  const imgMatch = htmlBlock.match(/<img[^>]+src=["']([^"']+)["']/i);
                  const yearMatch = htmlBlock.match(/<span class=["']year["']>([^<]+)<\/span>/i);
                  const typeMatch = htmlBlock.match(/<span class=["']type["']>([^<]+)<\/span>/i);

                  if (linkMatch && titleMatch) {
                    let itemUrl = linkMatch[1].trim();
                    if (!itemUrl.startsWith('http')) {
                      itemUrl = `https://www.hdfilmcehennemi.nl${itemUrl.startsWith('/') ? '' : '/'}${itemUrl}`;
                    }
                    parsed.push({
                      title: titleMatch[1].trim(),
                      url: itemUrl,
                      poster: imgMatch ? imgMatch[1].trim() : '',
                      year: yearMatch ? yearMatch[1].trim() : '',
                      type: (typeMatch && typeMatch[1].toLowerCase().includes('dizi')) ? 'dizi' : 'film',
                      source: 'HDFilmcehennemi'
                    });
                  }
                }
                return resolve(parsed);
              }
            } catch (_) {}
          }
        } catch (_) {}
        resolve([]);
      });

      proc.on('error', () => {
        clearTimeout(timer);
        resolve([]);
      });
    } catch {
      resolve([]);
    }
  });
}

export async function searchDdgSite(domain, siteLabel, query) {
  try {
    const url = `https://html.duckduckgo.com/html/?q=site:${domain}+${encodeURIComponent(query)}`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'text/html'
      },
      signal: AbortSignal.timeout(8000)
    });
    if (!res.ok) return [];
    const html = await res.text();
    const aLinks = [...html.matchAll(/<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)];
    const snippets = [...html.matchAll(/<a[^>]+class="result__snippet"[^>]*>([\s\S]*?)<\/a>/gi)].map(m => m[1].replace(/<[^>]+>/g, '').trim());
    const results = [];
    aLinks.forEach((m, idx) => {
      let target = m[1];
      const uddg = target.match(/uddg=([^&]+)/);
      if (uddg) target = decodeURIComponent(uddg[1]);
      const title = m[2].replace(/<[^>]+>/g, '').trim();
      if (target.includes(domain) && !target.endsWith(domain + '/') && !target.endsWith(domain)) {
        results.push({
          title: cleanWebStreamTitle(title),
          url: target,
          poster: '',
          snippet: snippets[idx] || '',
          type: target.includes('/dizi/') ? 'dizi' : 'film',
          source: siteLabel
        });
      }
    });
    return results.slice(0, 8);
  } catch {
    return [];
  }
}

/**
 * Belirtilen kaynakta veya tüm kaynaklarda film/dizi araması yapar.
 *
 * @param {string} query - Aranacak terim
 * @param {string} source - 'all' | 'jetfilmizle' | 'dizipal' | 'fullhdfilmizlesene' | 'hdfilmcehennemi' | 'filmmakinesi'
 * @returns {Promise<Array<object>>} Bulunan film/dizi sonuçları
 */
export async function searchWebStreams(query, source = 'all') {
  const cleanQ = (query || '').trim();
  if (!cleanQ || cleanQ.length < 2) return [];

  const targetSource = (source || 'all').toLowerCase();

  if (targetSource === 'jetfilmizle') {
    return await searchJetfilmizle(cleanQ);
  }
  if (targetSource === 'dizipal') {
    return await searchDizipal(cleanQ);
  }
  if (targetSource === 'fullhdfilmizlesene') {
    return await searchFullHDFilmizlesene(cleanQ);
  }
  if (targetSource === 'hdfilmcehennemi') {
    return await searchHdfilmcehennemi(cleanQ);
  }
  if (targetSource === 'filmmakinesi') {
    return await searchDdgSite('filmmakinesi.to', 'Filmmakinesi', cleanQ);
  }

  // Varsayılan: 'all' (Tüm kaynaklarda eşzamanlı ara)
  const [jetRes, dizipalRes, fhdfRes, hdfcRes] = await Promise.allSettled([
    searchJetfilmizle(cleanQ),
    searchDizipal(cleanQ),
    searchFullHDFilmizlesene(cleanQ),
    searchHdfilmcehennemi(cleanQ)
  ]);

  const allItems = [];
  if (jetRes.status === 'fulfilled' && Array.isArray(jetRes.value)) allItems.push(...jetRes.value);
  if (dizipalRes.status === 'fulfilled' && Array.isArray(dizipalRes.value)) allItems.push(...dizipalRes.value);
  if (fhdfRes.status === 'fulfilled' && Array.isArray(fhdfRes.value)) allItems.push(...fhdfRes.value);
  if (hdfcRes.status === 'fulfilled' && Array.isArray(hdfcRes.value)) allItems.push(...hdfcRes.value);

  // URL bazlı tekilleştirme
  const seenUrls = new Set();
  const deduped = [];
  for (const item of allItems) {
    if (item.url && !seenUrls.has(item.url)) {
      seenUrls.add(item.url);
      deduped.push(item);
    }
  }

  return deduped;
}
