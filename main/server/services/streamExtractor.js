// Türkçe Açıklama: Harici web sitelerinden (Dizipal, Vidmoly, Filemoon vb.) video akışı (.m3u8, .mp4) ve gömülü oynatıcıları tespit eden akıllı çözümleme servisi.
import { spawn } from 'child_process';
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

  // 1. .m3u8 ve .mp4 URL kalıpları
  const urlRegex = /(https?:\/\/[^\s"'<>\\]+?\.(?:m3u8|mp4)(?:\?[^\s"'<>\\]*)?)/gi;
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
    if ((cleanUrl.includes('.m3u8') || cleanUrl.includes('.mp4')) && !isAdMedia(cleanUrl)) {
      found.add(cleanUrl);
    }
  }

  return Array.from(found);
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

    if (src.startsWith('http')) {
      if (!src.includes('google') && !src.includes('facebook') && !src.includes('recaptcha')) {
        iframes.add(src);
      }
    }
  }

  return Array.from(iframes);
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
    title = ogTitleMatch[1].trim();
  } else {
    const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
    if (titleMatch && titleMatch[1]) {
      title = titleMatch[1].replace(/ - Dizipal.*$/i, '').replace(/ - Film izle.*$/i, '').trim();
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
      }, 12000);

      proc.stdout.on('data', (d) => { stdout += d.toString(); });
      proc.stderr.on('data', (d) => { stderr += d.toString(); });

      proc.on('close', (code) => {
        clearTimeout(timer);
        if (code === 0 && stdout) {
          try {
            const data = JSON.parse(stdout);
            const streamUrl = data.url || (data.formats && data.formats.slice(-1)[0]?.url);
            if (streamUrl) {
              const streamType = streamUrl.includes('.m3u8') ? 'm3u8' : 'mp4';
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
 * Verilen bir URL'yi analiz edip oynatılabilir stream/iframe kaynaklarını tespit eder.
 *
 * @param {string} rawUrl - Kullanıcının girdiği web sayfası linki
 * @returns {Promise<object>} Çözümleme sonucu
 */
export async function extractStreamFromUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') {
    return { success: false, error: 'Geçersiz bağlantı adresi.' };
  }

  let targetUrl = rawUrl.trim();
  if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
    targetUrl = 'https://' + targetUrl;
  }

  try {
    // 0. Eğer kullanıcı doğrudan bir .m3u8 veya .mp4 linki verdiyse
    if (targetUrl.includes('.m3u8') || targetUrl.includes('.mp4')) {
      const streamType = targetUrl.includes('.m3u8') ? 'm3u8' : 'mp4';
      return {
        success: true,
        title: 'Doğrudan Medya Akışı',
        sourceUrl: targetUrl,
        streamUrl: targetUrl,
        streamType,
        embedUrl: null,
        allStreams: [{ label: `Doğrudan Akış (${streamType.toUpperCase()})`, url: targetUrl, type: streamType }],
        poster: '',
        referer: targetUrl
      };
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

    if (!pageRes.ok) {
      // Sayfa açılamazsa doğrudan yt-dlp dene
      const ytdlpResult = await tryExtractWithYtdlp(targetUrl);
      if (ytdlpResult && ytdlpResult.streamUrl) {
        return {
          success: true,
          title: ytdlpResult.title || 'Web Video Akışı',
          sourceUrl: targetUrl,
          streamUrl: ytdlpResult.streamUrl,
          streamType: ytdlpResult.streamType,
          embedUrl: null,
          allStreams: [{ label: 'Çözümlenen Akış', url: ytdlpResult.streamUrl, type: ytdlpResult.streamType }],
          poster: '',
          referer: targetUrl
        };
      }
      return { success: false, error: `Sayfaya erişilemedi (HTTP ${pageRes.status}).` };
    }

    const html = await pageRes.text();
    const { title, poster } = extractPageMeta(html);

    // 2. Sayfada doğrudan m3u8 veya mp4 var mı kontrol et
    let directStreams = extractDirectVideoUrls(html);

    // 3. Packed JS kodlarını açıp orada ara
    const unpackedBlocks = unpackAllPackedJs(html);
    for (const code of unpackedBlocks) {
      const fromPacked = extractDirectVideoUrls(code);
      directStreams.push(...fromPacked);
    }

    // Tekilleştir
    directStreams = Array.from(new Set(directStreams));

    // 4. Iframe embed kaynaklarını topla
    const iframes = extractIframeSources(html, targetUrl);
    let chosenEmbedUrl = iframes[0] || null;

    // 5. Eğer doğrudan m3u8 bulunamadıysa, bulunan iframe'lerin içine gir ve tara
    if (directStreams.length === 0 && iframes.length > 0) {
      for (const iframeUrl of iframes.slice(0, 3)) {
        try {
          const iframeRes = await fetch(iframeUrl, {
            headers: {
              'User-Agent': USER_AGENT,
              'Referer': targetUrl
            },
            redirect: 'follow'
          });

          if (iframeRes.ok) {
            const iframeHtml = await iframeRes.text();
            const fromIframe = extractDirectVideoUrls(iframeHtml);
            directStreams.push(...fromIframe);

            const iframePacked = unpackAllPackedJs(iframeHtml);
            for (const code of iframePacked) {
              directStreams.push(...extractDirectVideoUrls(code));
            }

            if (directStreams.length > 0) {
              chosenEmbedUrl = iframeUrl;
              break;
            }
          }
        } catch {}
      }
    }

    directStreams = Array.from(new Set(directStreams));

    // 6. Hala bulunamadıysa yt-dlp ile dene
    if (directStreams.length === 0) {
      const ytdlpResult = await tryExtractWithYtdlp(chosenEmbedUrl || targetUrl);
      if (ytdlpResult && ytdlpResult.streamUrl) {
        directStreams.push(ytdlpResult.streamUrl);
      }
    }

    // 7. Sonuçları derle
    const allStreams = [];
    let primaryStreamUrl = null;
    let primaryStreamType = null;

    if (directStreams.length > 0) {
      // Tercihen m3u8'i ilk sıraya koy
      const sorted = directStreams.sort((a, b) => (b.includes('.m3u8') ? 1 : 0) - (a.includes('.m3u8') ? 1 : 0));
      primaryStreamUrl = sorted[0];
      primaryStreamType = primaryStreamUrl.includes('.m3u8') ? 'm3u8' : 'mp4';

      sorted.forEach((u, idx) => {
        const isM3u8 = u.includes('.m3u8');
        allStreams.push({
          label: isM3u8 ? `HLS Canlı Akış (${idx + 1})` : `MP4 Doğrudan Video (${idx + 1})`,
          url: u,
          type: isM3u8 ? 'm3u8' : 'mp4'
        });
      });
    }

    if (chosenEmbedUrl) {
      allStreams.push({
        label: 'Reklamsız Korumalı Oynatıcı (Embed)',
        url: chosenEmbedUrl,
        type: 'embed'
      });
      if (!primaryStreamUrl) {
        primaryStreamUrl = chosenEmbedUrl;
        primaryStreamType = 'embed';
      }
    }

    if (!primaryStreamUrl) {
      return {
        success: false,
        error: 'Sayfada oynatılabilir video akışı veya embed oynatıcı tespit edilemedi.',
        title,
        sourceUrl: targetUrl
      };
    }

    return {
      success: true,
      title,
      sourceUrl: targetUrl,
      streamUrl: primaryStreamUrl,
      streamType: primaryStreamType,
      embedUrl: chosenEmbedUrl,
      allStreams,
      poster,
      referer: targetUrl
    };

  } catch (err) {
    return {
      success: false,
      error: `Çözümleme sırasında hata oluştu: ${err.message}`
    };
  }
}
