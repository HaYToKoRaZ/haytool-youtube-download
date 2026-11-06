// Türkçe Açıklama: Önyüz (WebView2) hata köprüsü rotası.
// error-bridge.js tarayıcı tarafında yakaladığı hataları buraya POST eder;
// olaylar console.log sarmalayıcısı (server.js) üzerinden oturum log dosyasına yazılır.
import express from 'express';
import { localhostOnly } from '../middleware/security.js';

export const router = express.Router();

const MAX_EVENTS_PER_REQUEST = 30; // Tek istekte kabul edilen en fazla olay sayısı
const MAX_EVENTS_PER_MINUTE = 120; // Dakikalık taşma koruması (önyüzdeki sonsuz hata döngüsüne karşı)
const MAX_MSG = 4000;
const MAX_STACK = 1500;
const MAX_URL = 300;

let minuteStart = Date.now();
let minuteCount = 0;

// Türkçe Açıklama: Metni tek satıra indirir ve uzunluğu sınırlar (log enjeksiyonuna karşı).
function cleanText(value, max) {
  if (typeof value !== 'string') return '';
  return value.replace(/\s+/g, ' ').trim().slice(0, max);
}

// Türkçe Açıklama: Önyüzden gelen hata olaylarını oturum loguna yazar.
router.post('/client-log', localhostOnly, (req, res) => {
  const now = Date.now();
  if (now - minuteStart > 60000) {
    minuteStart = now;
    minuteCount = 0;
  }
  minuteCount += 1;
  if (minuteCount > MAX_EVENTS_PER_MINUTE) {
    return res.status(429).end();
  }

  const body = req.body || {};
  const events = Array.isArray(body.events) ? body.events.slice(0, MAX_EVENTS_PER_REQUEST) : [];
  for (const ev of events) {
    if (!ev || typeof ev !== 'object') continue;
    const msg = cleanText(ev.m, MAX_MSG);
    if (!msg) continue;
    const stack = cleanText(ev.s, MAX_STACK);
    const url = cleanText(ev.u, MAX_URL);
    const ts = (typeof ev.t === 'number' && ev.t > 0) ? ` ${new Date(ev.t).toLocaleTimeString('tr-TR')}` : '';
    const line = `[CLIENT${ts}] ${msg}` + (stack ? ` | ${stack}` : '') + (url ? ` | ${url}` : '');
    // Türkçe Açıklama: server.js'deki console.log sarmalayıcısı bu satırı haytool_session_*.log'a da yazar.
    console.log(line);
  }
  res.status(204).end();
});
