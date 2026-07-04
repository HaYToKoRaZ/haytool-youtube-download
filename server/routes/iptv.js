// Türkçe Açıklama: IPTV durumunu sorgulayan, M3U çalma listesini güncelleyip diske kaydeden ve IPTV kanallarını filtreleme/sayfalama özellikleri ile sunan API rotaları modülü.
import express from 'express';
import fs from 'fs';
import https from 'https';
import http from 'http';
import { localhostOnly } from '../middleware/security.js';
import { 
  iptvUpdateStatus, 
  iptvChannelsMemory, 
  iptvCountriesList, 
  iptvCategoriesList, 
  setIptvChannels, 
  iptvCachePath 
} from '../services/iptv.js';
import { broadcast } from '../services/sse.js';

export const router = express.Router();

// IPTV Durum Endpoint'i
router.get('/status', (req, res) => {
  res.json(iptvUpdateStatus);
});

// IPTV Guncelleme Endpoint'i - Streaming M3U indirici (RAM tasarrufu icin)
router.post('/update', localhostOnly, async (req, res) => {
  if (iptvUpdateStatus.status === 'updating') {
    return res.status(400).json({ success: false, error: 'Update already in progress' });
  }

  iptvUpdateStatus.status = 'updating';
  iptvUpdateStatus.error = null;
  res.json({ success: true, message: 'Update started' });

  try {
    console.log('[IPTV] Calisma listesi stream ile indiriliyor...');
    const m3uUrl = 'https://iptv-org.github.io/iptv/index.m3u';
    
    // Stream-based M3U indirme + satir satir parse (buyuk dosyalarda RAM tasarrufu)
    const channels = await new Promise((resolve, reject) => {
      function tryFetch(requestUrl, redirectCount = 0) {
        if (redirectCount > 5) return reject(new Error('Cok fazla yonlendirme'));
        let urlObj;
        try {
          urlObj = new URL(requestUrl);
        } catch (e) {
          return reject(new Error('Gecersiz URL formatı'));
        }
        
        const getter = urlObj.protocol === 'https:' ? https : http;
        const req2 = getter.get(urlObj, {
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; HaYTooL/5.1)' }
        }, (res2) => {
          if ([301, 302, 307, 308].includes(res2.statusCode) && res2.headers.location) {
            let loc = res2.headers.location;
            if (!loc.startsWith('http')) loc = urlObj.origin + loc;
            res2.resume();
            return tryFetch(loc, redirectCount + 1);
          }
          if (res2.statusCode !== 200) {
            res2.resume();
            return reject(new Error(`HTTP ${res2.statusCode}`));
          }

          const parsed = [];
          let partial = '';
          let currentItem = null;

          res2.setEncoding('utf8');
          res2.on('data', (chunk) => {
            partial += chunk;
            const lines = partial.split(/\r?\n/);
            partial = lines.pop(); // Son eksik satiri bir sonraki chunk'a birak

            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed) continue;

              if (trimmed.startsWith('#EXTINF:')) {
                currentItem = {};
                const tvgIdMatch = trimmed.match(/tvg-id="([^"]*)"/i);
                const tvgNameMatch = trimmed.match(/tvg-name="([^"]*)"/i);
                const tvgLogoMatch = trimmed.match(/tvg-logo="([^"]*)"/i);
                const tvgCountryMatch = trimmed.match(/tvg-country="([^"]*)"/i);
                const groupTitleMatch = trimmed.match(/group-title="([^"]*)"/i);

                if (tvgIdMatch) currentItem.id = tvgIdMatch[1];
                if (tvgNameMatch) currentItem.name = tvgNameMatch[1];
                if (tvgLogoMatch) currentItem.logo = tvgLogoMatch[1];
                if (groupTitleMatch) currentItem.category = groupTitleMatch[1];

                // Ulke kodu
                if (tvgCountryMatch && tvgCountryMatch[1]) {
                  currentItem.country = tvgCountryMatch[1].toUpperCase();
                } else if (tvgIdMatch && tvgIdMatch[1]) {
                  const idM = tvgIdMatch[1].match(/\.([a-z]{2})(?:@|$)/i);
                  if (idM) currentItem.country = idM[1].toUpperCase();
                }

                const commaIdx = trimmed.lastIndexOf(',');
                currentItem.displayName = commaIdx !== -1
                  ? trimmed.substring(commaIdx + 1).trim()
                  : (currentItem.name || 'Unnamed');

              } else if (!trimmed.startsWith('#') && currentItem) {
                if (trimmed.startsWith('http')) {
                  currentItem.url = trimmed;
                  parsed.push(currentItem);
                }
                currentItem = null;
              }
            }
          });

          res2.on('end', () => {
            if (partial.trim() && currentItem) {
              const t = partial.trim();
              if (t.startsWith('http')) {
                currentItem.url = t;
                parsed.push(currentItem);
              }
            }
            resolve(parsed);
          });
          res2.on('error', reject);
        });
        req2.on('error', reject);
      }
      tryFetch(m3uUrl);
    });
    
    console.log(`[IPTV] ${channels.length} kanal bulundu. Diske kaydediliyor...`);
    
    const cacheData = { lastUpdated: new Date().toISOString(), channels };
    fs.writeFileSync(iptvCachePath, JSON.stringify(cacheData), 'utf8');
    
    setIptvChannels(channels);
    
    iptvUpdateStatus.status = 'success';
    iptvUpdateStatus.lastUpdated = cacheData.lastUpdated;
    iptvUpdateStatus.totalChannels = channels.length;
    console.log('[IPTV] Kanal listesi basariyla guncellendi.');
    broadcast('status_log', { message: `IPTV kanal listesi güncellendi. Toplam ${channels.length} kanal.`, type: 'success' });
  } catch (err) {
    console.error('[IPTV] Güncelleme hatası:', err.message);
    iptvUpdateStatus.status = 'error';
    iptvUpdateStatus.error = err.message;
    broadcast('status_log', { message: `IPTV güncellenirken hata oluştu: ${err.message}`, type: 'error' });
  }
});

// IPTV Kanalları Listeleme ve Arama Endpoint'i
router.get('/channels', (req, res) => {
  let { page = 1, limit = 200, search = '', country = '', category = '' } = req.query;
  page = parseInt(page, 10) || 1;
  limit = parseInt(limit, 10);
  const requestedAll = limit <= 0;

  let filtered = iptvChannelsMemory;

  if (search) {
    const q = search.toLowerCase();
    filtered = filtered.filter(ch => 
      (ch.displayName && ch.displayName.toLowerCase().includes(q)) ||
      (ch.name && ch.name.toLowerCase().includes(q))
    );
  }

  if (country) {
    const c = country.toUpperCase();
    filtered = filtered.filter(ch => ch.country && ch.country.toUpperCase() === c);
  }

  if (category) {
    const cat = category.toLowerCase();
    filtered = filtered.filter(ch => ch.category && ch.category.toLowerCase() === cat);
  }

  const totalCount = filtered.length;

  let resultChannels;
  let effectiveLimit;
  let totalPages;

  if (requestedAll) {
    const hasFilter = (country || search || category);
    if (hasFilter) {
      resultChannels = filtered;
      effectiveLimit = totalCount;
      totalPages = 1;
    } else {
      effectiveLimit = 300;
      resultChannels = filtered.slice(0, effectiveLimit);
      totalPages = Math.ceil(totalCount / effectiveLimit);
    }
  } else {
    effectiveLimit = limit > 0 ? limit : 200;
    resultChannels = filtered.slice((page - 1) * effectiveLimit, page * effectiveLimit);
    totalPages = Math.ceil(totalCount / effectiveLimit);
  }

  res.json({
    channels: resultChannels,
    pagination: {
      page,
      limit: effectiveLimit,
      totalCount,
      totalPages
    },
    filters: {
      countries: iptvCountriesList,
      categories: iptvCategoriesList
    }
  });
});
