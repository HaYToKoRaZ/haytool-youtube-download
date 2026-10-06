// Türkçe Açıklama: Coğrafi kısıtlamalı veya yasaklı YouTube kanalları için dinamik çalışan proxy havuzu ve Piped/Invidious arama/bilgi çözümleme modülü.
import https from 'https';
import http from 'http';
import { spawn } from 'child_process';
import { ytdlpPath, getLocalTempDir, cleanMeiForPid } from './paths.js';

let cachedWorkingProxies = [];
let lastProxyCheck = 0;
const PROXY_CACHE_TTL = 30 * 60 * 1000; // 30 dakika önbellek

/**
 * Açık kaynaklı güvenilir listelerden ham HTTP proxy adreslerini çeker.
 * 
 * @returns {Promise<string[]>} Proxy IP:Port listesi
 */
export async function fetchProxyList() {
  const sources = [
    'https://raw.githubusercontent.com/monosans/proxy-list/main/proxies/http.txt',
    'https://raw.githubusercontent.com/TheSpeedX/PROXY-List/master/http.txt',
    'https://raw.githubusercontent.com/roosterkid/openproxylist/main/HTTPS_RAW.txt'
  ];

  for (const src of sources) {
    try {
      const text = await new Promise((resolve, reject) => {
        const getter = src.startsWith('https') ? https : http;
        getter.get(src, { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 6000 }, res => {
          if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}`));
          let d = '';
          res.on('data', c => d += c);
          res.on('end', () => resolve(d));
        }).on('error', reject);
      });
      const list = text.trim().split('\n').map(p => p.trim()).filter(Boolean);
      if (list.length > 0) return list;
    } catch (e) {
      // Bir sonraki kaynağı dene
    }
  }
  return [];
}

/**
 * Belirtilen proxy adresinin yt-dlp ile YouTube'a erişip erişemediğini test eder.
 * 
 * @param {string} proxy - Test edilecek proxy ('ip:port' veya 'http://ip:port')
 * @param {string} [testUrl='https://www.youtube.com/channel/UCnyDauIsUmvr-9Q3H0Eq74g'] - Test adresi
 * @param {number} [timeoutMs=6000] - Zaman aşımı süresi
 * @returns {Promise<{proxy: string, title?: string}|null>} Başarılı ise nesne, değilse null
 */
export async function testProxyWithYtdlp(proxy, testUrl = 'https://www.youtube.com/watch?v=dvk_ZLPyNBE', timeoutMs = 7000) {
  return new Promise(resolve => {
    const formattedProxy = proxy.startsWith('http') ? proxy : `http://${proxy}`;
    const args = [
      '--dump-json',
      '--proxy', formattedProxy,
      '--socket-timeout', '4',
      '--retries', '1',
      testUrl
    ];

    const localTemp = getLocalTempDir();
    const spawnOptions = {
      env: { ...process.env, TEMP: localTemp, TMP: localTemp },
      ...(process.platform === 'win32' ? { windowsVerbatimArguments: false, windowsHide: true } : {})
    };

    const proc = spawn(ytdlpPath, args, spawnOptions);
    let out = '';
    const timer = setTimeout(() => {
      try { proc.kill(); } catch (e) {}
      cleanMeiForPid(proc.pid);
      resolve(null);
    }, timeoutMs);

    proc.stdout.on('data', d => out += d);
    proc.on('close', code => {
      clearTimeout(timer);
      cleanMeiForPid(proc.pid);
      if (code === 0 && out.trim()) {
        try {
          const lines = out.trim().split('\n');
          const v = JSON.parse(lines[0]);
          if (v && v.id) return resolve({ proxy: formattedProxy, title: v.title });
        } catch (e) {}
      }
      resolve(null);
    });
  });
}

/**
 * Doğrulanmış ve çalışan bir proxy adresini havuza ekleyerek döndürür.
 * 
 * @param {boolean} [forceRefresh=false] - Önbelleği yok sayarak yeni proxy bulmaya zorla
 * @returns {Promise<string|null>} Çalışan proxy URL'si veya bulunamazsa null
 */
export async function getWorkingProxy(forceRefresh = false) {
  const now = Date.now();
  if (!forceRefresh && cachedWorkingProxies.length > 0 && (now - lastProxyCheck < PROXY_CACHE_TTL)) {
    return cachedWorkingProxies[0];
  }

  console.log('[Proxy Havuzu] Coğrafi kısıtlamaları aşmak için çalışan proxy aranıyor...');
  const allProxies = await fetchProxyList();
  if (allProxies.length === 0) return null;

  const batchSize = 15;
  for (let i = 0; i < Math.min(allProxies.length, 60); i += batchSize) {
    const batch = allProxies.slice(i, i + batchSize);
    const results = await Promise.all(batch.map(p => testProxyWithYtdlp(p)));
    const working = results.filter(Boolean);
    if (working.length > 0) {
      cachedWorkingProxies = working.map(w => w.proxy);
      lastProxyCheck = Date.now();
      console.log(`[Proxy Havuzu] ${working.length} adet çalışan proxy tespit edildi! Seçilen: ${cachedWorkingProxies[0]}`);
      return cachedWorkingProxies[0];
    }
  }

  return null;
}

/**
 * Başarısız olan proxy'yi havuzdan çıkarıp sıradaki çalışan proxy'yi döndürür.
 * 
 * @returns {string|null} Sıradaki proxy veya null
 */
export function rotateProxy() {
  if (cachedWorkingProxies.length > 1) {
    const failed = cachedWorkingProxies.shift();
    console.log(`[Proxy Havuzu] Başarısız proxy havuzdan çıkarıldı: ${failed}, yeni seçilen: ${cachedWorkingProxies[0]}`);
    return cachedWorkingProxies[0];
  }
  cachedWorkingProxies = [];
  lastProxyCheck = 0;
  return null;
}

/**
 * Piped API kullanarak YouTube kanallarını arar.
 * 
 * @param {string} query - Aranacak kanal adı
 * @returns {Promise<Array<{id: string, name: string, handle: string, avatar: string, subscribers: string}>>}
 */
export async function fetchPipedChannels(query) {
  const mirrors = [
    'https://api.piped.private.coffee',
    'https://pipedapi.kavin.rocks'
  ];

  for (const mirror of mirrors) {
    try {
      const url = `${mirror}/search?q=${encodeURIComponent(query)}&filter=channels`;
      const data = await new Promise((resolve, reject) => {
        https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 6000 }, res => {
          if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}`));
          let d = '';
          res.on('data', c => d += c);
          res.on('end', () => {
            try { resolve(JSON.parse(d)); } catch (e) { reject(e); }
          });
        }).on('error', reject);
      });

      if (data && Array.isArray(data.items)) {
        const results = [];
        for (const item of data.items) {
          const channelId = item.url ? item.url.replace('/channel/', '') : '';
          if (!channelId || !channelId.startsWith('UC')) continue;

          let formattedSub = '';
          if (typeof item.subscribers === 'number') {
            if (item.subscribers >= 1000000) formattedSub = (item.subscribers / 1000000).toFixed(1) + 'M';
            else if (item.subscribers >= 1000) formattedSub = (item.subscribers / 1000).toFixed(1) + 'K';
            else formattedSub = item.subscribers.toString();
          }

          results.push({
            id: channelId,
            name: item.name || `Kanal ${channelId}`,
            handle: `@${item.name ? item.name.replace(/\s+/g, '') : channelId}`,
            avatar: item.thumbnail || '',
            subscribers: formattedSub
          });
        }
        if (results.length > 0) return results;
      }
    } catch (err) {
      console.warn(`[Piped Arama] ${mirror} aynası yanıt vermedi: ${err.message}`);
    }
  }

  return [];
}

/**
 * Piped API üzerinden kanal detaylarını çeker.
 * 
 * @param {string} channelId - Kanal ID'si (UC...)
 * @returns {Promise<{id: string, name: string, handle: string, avatar: string, subscriberCount: string}|null>}
 */
export async function fetchPipedChannelInfo(channelId) {
  const mirrors = [
    'https://api.piped.private.coffee',
    'https://pipedapi.kavin.rocks'
  ];

  for (const mirror of mirrors) {
    try {
      const url = `${mirror}/channel/${channelId}`;
      const data = await new Promise((resolve, reject) => {
        https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 6000 }, res => {
          if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}`));
          let d = '';
          res.on('data', c => d += c);
          res.on('end', () => {
            try { resolve(JSON.parse(d)); } catch (e) { reject(e); }
          });
        }).on('error', reject);
      });

      if (data && data.name) {
        let formattedSub = '';
        if (typeof data.subscriberCount === 'number') {
          if (data.subscriberCount >= 1000000) formattedSub = (data.subscriberCount / 1000000).toFixed(1) + 'M';
          else if (data.subscriberCount >= 1000) formattedSub = (data.subscriberCount / 1000).toFixed(1) + 'K';
          else formattedSub = data.subscriberCount.toString();
        }

        return {
          id: channelId,
          name: data.name,
          handle: `@${data.name.replace(/\s+/g, '')}`,
          avatar: data.avatarUrl || '',
          subscriberCount: formattedSub
        };
      }
    } catch (err) {
      console.warn(`[Piped Kanal Bilgisi] ${mirror} aynası yanıt vermedi: ${err.message}`);
    }
  }

  return null;
}
