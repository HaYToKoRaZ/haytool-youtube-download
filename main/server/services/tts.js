/**
 * HaYTooL YouTube Downloader - Yerel Sesli Okuma (TTS) Servisi
 * server/services/tts.js
 *
 * Motor: Piper TTS (tamamen çevrimdışı, tek exe + .onnx ses dosyaları)
 *   - Motor:  https://github.com/rhasspy/piper  (piper_windows_amd64.zip, ~23 MB)
 *   - Sesler: https://huggingface.co/rhasspy/piper-voices (her biri ~63 MB)
 * Desen: aiSummary.js'deki kanıtlanmış spawn + tek-süreç + iptal kalıbı kullanılır.
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import { execSync, spawn } from 'child_process';
import { migrateLegacyEngineDir, getTtsCacheDir } from './paths.js';

// Motorlar uygulama kökündeki 'bin' klasöründe barınır (kod dizinini kirletmez)
const PIPER_DIR = migrateLegacyEngineDir('piper', 'piper.exe');
const PIPER_CLI = path.join(PIPER_DIR, 'piper.exe');
const PIPER_ESPEAK_DATA = path.join(PIPER_DIR, 'espeak-ng-data');
const PIPER_VOICES_DIR = path.join(PIPER_DIR, 'voices');
export { getTtsCacheDir };

const PIPER_ENGINE_URL = 'https://github.com/rhasspy/piper/releases/download/2023.11.14-2/piper_windows_amd64.zip';
const PIPER_VOICE_BASE = 'https://huggingface.co/rhasspy/piper-voices/resolve/main';

/** Uygulamanın desteklediği 7 dil için doğrulanmış Piper ses kataloğu (tümü HF API ile teyitli). */
export const VOICE_CATALOG = [
  { id: 'tr_TR-dfki-medium', lang: 'tr', hfPath: 'tr/tr_TR/dfki/medium/tr_TR-dfki-medium', sizeMB: 63, label: '🇹🇷 Türkçe · dfki (erkek)' },
  { id: 'en_US-lessac-medium', lang: 'en', hfPath: 'en/en_US/lessac/medium/en_US-lessac-medium', sizeMB: 63, label: '🇬🇧 English · lessac (kadın)' },
  { id: 'de_DE-thorsten-medium', lang: 'de', hfPath: 'de/de_DE/thorsten/medium/de_DE-thorsten-medium', sizeMB: 63, label: '🇩🇪 Deutsch · thorsten (erkek)' },
  { id: 'es_ES-davefx-medium', lang: 'es', hfPath: 'es/es_ES/davefx/medium/es_ES-davefx-medium', sizeMB: 63, label: '🇪🇸 Español · davefx (erkek)' },
  { id: 'pt_BR-faber-medium', lang: 'pt', hfPath: 'pt/pt_BR/faber/medium/pt_BR-faber-medium', sizeMB: 63, label: '🇵🇹 Português · faber (erkek)' },
  { id: 'ru_RU-dmitri-medium', lang: 'ru', hfPath: 'ru/ru_RU/dmitri/medium/ru_RU-dmitri-medium', sizeMB: 63, label: '🇷🇺 Русский · dmitri (erkek)' },
  { id: 'ar_JO-kareem-low', lang: 'ar', hfPath: 'ar/ar_JO/kareem/low/ar_JO-kareem-low', sizeMB: 63, label: '🇸🇦 العربية · kareem (erkek)' }
];

const DEFAULT_VOICE_ID = 'tr_TR-dfki-medium';
const MAX_SPEAK_CHARS = 8000;
const SPEAK_TIMEOUT_MS = 120000;

// O an çalışmakta olan piper.exe süreci (aynı anda tek sentez garantisi)
let activePiperProc = null;

/**
 * Bir klasör ağacında (sınırlı derinlikte) adla dosya arar.
 * @param {string} dir - Aranacak kök klasör
 * @param {string} fileName - Küçük harfe çevrilmiş hedef dosya adı
 * @param {number} maxDepth - Maksimum derinlik
 * @returns {string|null} Bulunan dosyanın tam yolu
 */
function findFileRecursive(dir, fileName, maxDepth) {
  if (maxDepth < 0) return null;
  let entries = [];
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (_) { return null; }
  for (const e of entries) {
    if (e.isFile() && e.name.toLowerCase() === fileName) return path.join(dir, e.name);
  }
  for (const e of entries) {
    if (e.isDirectory()) {
      const found = findFileRecursive(path.join(dir, e.name), fileName, maxDepth - 1);
      if (found) return found;
    }
  }
  return null;
}

/**
 * Kayıtlı bir sesin .onnx yolunu döndürür (kuruluysa).
 * @param {string} voiceId - Katalog ses kimliği
 * @returns {string|null} .onnx dosya yolu veya null
 */
function voiceOnnxPath(voiceId) {
  const entry = VOICE_CATALOG.find(v => v.id === voiceId);
  if (!entry) return null;
  const onnx = path.join(PIPER_VOICES_DIR, `${entry.id}.onnx`);
  return fs.existsSync(onnx) ? onnx : null;
}

// Özel klasör ses dosyası adları için güvenli karakter deseni (yol kaçışlarını engeller)
const SAFE_VOICE_ID_RE = /^[A-Za-z0-9._-]{3,120}$/;

/**
 * Kullanıcının gösterdiği klasördeki Piper uyumlu sesleri (.onnx + .onnx.json çifti) listeler.
 * @param {string} dir - Kullanıcı klasör yolu (boşsa boş dizi)
 * @returns {Array<{id: string, lang: string, label: string, sizeMB: number, custom: boolean}>}
 */
export function listCustomVoices(dir) {
  if (!dir || typeof dir !== 'string') return [];
  let entries = [];
  try { entries = fs.readdirSync(dir); } catch (_) { return []; }
  const catalogIds = new Set(VOICE_CATALOG.map(v => v.id));
  const found = [];
  for (const f of entries) {
    if (!f.toLowerCase().endsWith('.onnx')) continue;
    const id = f.slice(0, -'.onnx'.length);
    if (!SAFE_VOICE_ID_RE.test(id) || catalogIds.has(id)) continue;
    const onnx = path.join(dir, f);
    const json = `${onnx}.json`;
    if (!fs.existsSync(json)) continue;
    let lang = '??';
    try {
      const cfg = JSON.parse(fs.readFileSync(json, 'utf8'));
      lang = cfg?.audio?.language?.code || cfg?.language || '??';
    } catch (_) {}
    let sizeMB = 0;
    try { sizeMB = Math.round(fs.statSync(onnx).size / (1024 * 1024)); } catch (_) {}
    found.push({ id, lang, label: `📁 ${id} (${lang})`, sizeMB, custom: true });
  }
  return found;
}

/**
 * Ses kimliğini (katalog veya özel klasör) çözüp .onnx yolunu döndürür.
 * @param {string} voiceId - Ses kimliği
 * @param {string} customDir - Kullanıcının özel ses klasörü (opsiyonel)
 * @returns {string|null} .onnx yolu veya null
 */
function resolveVoicePath(voiceId, customDir) {
  const builtIn = voiceOnnxPath(voiceId);
  if (builtIn) return builtIn;
  if (customDir && SAFE_VOICE_ID_RE.test(String(voiceId || ''))) {
    const onnx = path.join(customDir, `${voiceId}.onnx`);
    if (fs.existsSync(onnx) && fs.existsSync(`${onnx}.json`)) return onnx;
  }
  return null;
}

/**
 * Piper motorunun ve kurulu seslerin durumunu döndürür (özel klasör sesleri dahil).
 * @param {string} [customDir] - Kullanıcının özel ses klasörü
 * @returns {{ engineInstalled: boolean, installedVoices: string[], defaultVoiceId: string, customVoices: Array }}
 */
export function getTtsStatus(customDir) {
  const customVoices = listCustomVoices(customDir);
  const installedVoices = VOICE_CATALOG
    .filter(v => fs.existsSync(path.join(PIPER_VOICES_DIR, `${v.id}.onnx`)))
    .map(v => v.id)
    .concat(customVoices.map(v => v.id));
  return {
    engineInstalled: fs.existsSync(PIPER_CLI),
    installedVoices,
    defaultVoiceId: DEFAULT_VOICE_ID,
    customVoices
  };
}

/**
 * Çalışmakta olan piper.exe sentez sürecini anında sonlandırır.
 * @returns {boolean} Öldürülen süreç var mıydı
 */
export function stopTtsEngine() {
  const proc = activePiperProc;
  activePiperProc = null;
  if (proc) {
    try { proc.kill('SIGKILL'); } catch (_) {}
    return true;
  }
  return false;
}

/**
 * Piper motorunu (Windows x64, ~23 MB) indirip bin/piper dizinine kurar.
 * @returns {Promise<{ success: boolean, message: string }>}
 */
export async function downloadPiperEngine() {
  if (fs.existsSync(PIPER_CLI)) {
    return { success: true, message: 'Piper ses motoru zaten kurulu.' };
  }

  fs.mkdirSync(PIPER_DIR, { recursive: true });

  const tempZip = path.join(os.tmpdir(), `piper_engine_${Date.now()}.zip`);
  const resp = await fetch(PIPER_ENGINE_URL);
  if (!resp.ok) {
    throw new Error(`GitHub indirme başarısız (${resp.status}): ${resp.statusText}`);
  }
  const arrayBuffer = await resp.arrayBuffer();
  fs.writeFileSync(tempZip, Buffer.from(arrayBuffer));

  try {
    execSync(`powershell -NoProfile -Command "Expand-Archive -Path '${tempZip}' -DestinationPath '${PIPER_DIR}' -Force"`, {
      timeout: 180000
    });
  } finally {
    try { if (fs.existsSync(tempZip)) fs.unlinkSync(tempZip); } catch (_) {}
  }

  // Arşiv içi alt klasör (piper/) düzenini ana dizine yay (espeak-ng-data dahil)
  if (!fs.existsSync(PIPER_CLI)) {
    const found = findFileRecursive(PIPER_DIR, 'piper.exe', 2);
    if (found) {
      try { fs.cpSync(path.dirname(found), PIPER_DIR, { recursive: true, force: true }); } catch (_) {}
    }
  }

  if (!fs.existsSync(PIPER_CLI)) {
    throw new Error('Arşiv çıkartıldı ancak piper.exe bulunamadı.');
  }

  return { success: true, message: 'Piper ses motoru başarıyla kuruldu.' };
}

/**
 * Katalogdaki bir ses dosyasını (.onnx + .onnx.json) indirip voices/ klasörüne kurar.
 * @param {string} voiceId - VOICE_CATALOG kimliği
 * @returns {Promise<{ success: boolean, message: string }>}
 */
export async function downloadPiperVoice(voiceId) {
  const entry = VOICE_CATALOG.find(v => v.id === voiceId);
  if (!entry) {
    throw new Error('Geçersiz ses kimliği.');
  }

  const onnxPath = path.join(PIPER_VOICES_DIR, `${entry.id}.onnx`);
  const jsonPath = `${onnxPath}.json`;
  if (fs.existsSync(onnxPath) && fs.existsSync(jsonPath)) {
    return { success: true, message: `${entry.id} sesi zaten kurulu.` };
  }

  fs.mkdirSync(PIPER_VOICES_DIR, { recursive: true });

  // Önce küçük .json, sonra büyük .onnx (.part + rename ile güvenli)
  const jsonResp = await fetch(`${PIPER_VOICE_BASE}/${entry.hfPath}.onnx.json`);
  if (!jsonResp.ok) throw new Error(`Ses yapılandırması indirilemedi (${jsonResp.status}).`);
  fs.writeFileSync(jsonPath, Buffer.from(await jsonResp.arrayBuffer()));

  const partPath = `${onnxPath}.part`;
  const resp = await fetch(`${PIPER_VOICE_BASE}/${entry.hfPath}.onnx`);
  if (!resp.ok || !resp.body) throw new Error(`Ses indirilemedi (HTTP ${resp.status}).`);

  let fileStream = null;
  try {
    fileStream = fs.createWriteStream(partPath);
    const reader = resp.body.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!fileStream.write(value)) {
        await new Promise((resolve, reject) => {
          fileStream.once('drain', resolve);
          fileStream.once('error', reject);
        });
      }
    }
    fileStream.end();
    await new Promise((resolve) => fileStream.once('close', resolve));
    fileStream = null;
    fs.renameSync(partPath, onnxPath);
  } catch (err) {
    try { if (fs.existsSync(partPath)) fs.unlinkSync(partPath); } catch (_) {}
    throw err;
  } finally {
    try { if (fileStream && !fileStream.destroyed) fileStream.destroy(); } catch (_) {}
  }

  return { success: true, message: `${entry.id} sesi kuruldu.` };
}

/**
 * Sesli okuma için metni temizler: zaman damgaları, markdown kalıntıları, emoji ve URL'ler ayıklanır.
 * @param {string} raw - Ham özet metni
 * @returns {string} Temizlenmiş (ve uzunsa kırpılmış) metin
 */
export function cleanSpeakText(raw) {
  if (!raw || typeof raw !== 'string') return '';
  let text = raw
    .replace(/\[\d{1,2}:\d{2}(?::\d{2})?\]/g, ' ')          // [mm:ss] zaman damgaları
    .replace(/https?:\/\/\S+/g, ' ')                          // URL'ler
    .replace(/[*_#>`~]+/g, ' ')                               // markdown işaretleri
    .replace(/\p{Extended_Pictographic}/gu, ' ')              // emoji ve piktograf
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  if (text.length > MAX_SPEAK_CHARS) {
    // Cümle ortasında değil mümkünse cümle sonunda kırp
    const cut = text.slice(0, MAX_SPEAK_CHARS);
    const lastSentence = Math.max(cut.lastIndexOf('.'), cut.lastIndexOf('!'), cut.lastIndexOf('?'), cut.lastIndexOf('.'));
    text = (lastSentence > MAX_SPEAK_CHARS * 0.6 ? cut.slice(0, lastSentence + 1) : cut) + ' ...';
  }
  return text;
}

/**
 * Metni Piper ile WAV dosyasına sesler (cache'li). Aynı metin+ses+hız tekrar üretilmez.
 * @param {{ text: string, voiceId?: string, speed?: number }} opts
 * @returns {Promise<{ audioId: string, cached: boolean, voiceId: string, truncated: boolean }>}
 */
export async function speakText({ text, voiceId, speed, customDir }) {
  if (!fs.existsSync(PIPER_CLI)) {
    throw new Error('Piper ses motoru kurulu değil. Ayarlar > Sesli Okuma bölümünden indirin.');
  }

  let resolvedVoice = voiceId ? resolveVoicePath(voiceId, customDir) : null;
  // İstenen ses yoksa/bulunamadıysa varsayılan Türkçe sese düş (o da kuruluysa)
  if (!resolvedVoice) resolvedVoice = resolveVoicePath(DEFAULT_VOICE_ID, customDir);
  const usedVoiceId = resolvedVoice ? path.basename(resolvedVoice, '.onnx') : null;
  if (!resolvedVoice) {
    throw new Error('Hiçbir ses paketi kurulu değil. Ayarlar > Sesli Okuma bölümünden bir ses indirin.');
  }

  const cleaned = cleanSpeakText(text);
  if (cleaned.length < 10) {
    throw new Error('Okunacak metin boş veya çok kısa.');
  }
  const truncated = cleaned.includes(' ...');

  const rate = Math.min(2, Math.max(0.5, Number(speed) > 0 ? Number(speed) : 1));
  const lengthScale = (1 / rate).toFixed(2);

  const key = crypto.createHash('sha1').update(`${usedVoiceId}|${lengthScale}|${cleaned}`, 'utf8').digest('hex');
  const cacheDir = getTtsCacheDir();
  const wavPath = path.join(cacheDir, `${key}.wav`);

  fs.mkdirSync(cacheDir, { recursive: true });
  if (fs.existsSync(wavPath) && fs.statSync(wavPath).size > 1024) {
    return { audioId: key, cached: true, voiceId: usedVoiceId, truncated };
  }

  stopTtsEngine();

  const outWavTmp = path.join(cacheDir, `${key}.${process.pid}.tmp.wav`);

  // Bayraklar piper.exe --help ile doğrulandı: stdin girdi, --output_file ve --length_scale alt çizgili
  const args = [
    '--model', resolvedVoice,
    '--config', `${resolvedVoice}.json`,
    '--output_file', outWavTmp,
    '--quiet'
  ];
  if (fs.existsSync(PIPER_ESPEAK_DATA)) {
    args.push('--espeak_data', PIPER_ESPEAK_DATA);
  }
  if (rate !== 1) {
    args.push('--length_scale', lengthScale);
  }

  try {
    await runPiperOnce(args, outWavTmp, cleaned);

    if (!fs.existsSync(outWavTmp) || fs.statSync(outWavTmp).size < 1024) {
      throw new Error('Piper ses dosyası üretemedi.');
    }
    fs.renameSync(outWavTmp, wavPath);
    return { audioId: key, cached: false, voiceId: usedVoiceId, truncated };
  } finally {
    try { if (fs.existsSync(outWavTmp)) fs.unlinkSync(outWavTmp); } catch (_) {}
  }
}

/**
 * piper.exe sürecini event loop'u bloklamadan çalıştırır; metni stdin'den verir.
 * @param {string[]} args - Piper argümanları
 * @param {string} expectFile - Beklenen çıktı WAV yolu
 * @param {string} stdinText - Seslendirilecek temiz metin
 * @returns {Promise<void>}
 */
function runPiperOnce(args, expectFile, stdinText) {
  return new Promise((resolve, reject) => {
    let settled = false;
    let stderrBuf = '';

    const child = spawn(PIPER_CLI, args, { windowsHide: true, cwd: PIPER_DIR });
    activePiperProc = child;

    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        try { child.kill('SIGKILL'); } catch (_) {}
        if (activePiperProc === child) activePiperProc = null;
        reject(new Error('Piper sentezi zaman aşımına uğradı (120 sn).'));
      }
    }, SPEAK_TIMEOUT_MS);

    child.stderr && child.stderr.on('data', (chunk) => {
      stderrBuf = (stderrBuf + chunk.toString()).slice(-400);
    });

    // Piper erken çıkarsa stdin yazımı EPIPE vermesin (sessizce yut, hata stderr'de zaten)
    child.stdin && child.stdin.on('error', () => {});
    try {
      child.stdin && child.stdin.write(stdinText, 'utf8');
      child.stdin && child.stdin.end();
    } catch (_) {}

    child.on('error', (err) => {
      clearTimeout(timer);
      if (activePiperProc === child) activePiperProc = null;
      if (!settled) { settled = true; reject(new Error(`Piper başlatılamadı: ${err.message}`)); }
    });

    child.on('close', (code, signal) => {
      clearTimeout(timer);
      if (activePiperProc === child) activePiperProc = null;
      if (settled) return;
      settled = true;
      if (signal) {
        reject(new Error('Piper sentezi iptal edildi.'));
      } else if (code !== 0) {
        reject(new Error(`Piper hatası (kod ${code}): ${stderrBuf || 'çıktı yok'}`));
      } else if (expectFile && fs.existsSync(expectFile)) {
        resolve();
      } else {
        reject(new Error('Piper çıktı dosyası oluşturamadı.'));
      }
    });
  });
}

/**
 * 7 günden eski ses önbelleği dosyalarını siler (modül yüklenince bir kez denenir).
 */
function sweepTtsCache() {
  try {
    const cacheDir = getTtsCacheDir();
    if (!fs.existsSync(cacheDir)) return;
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
    for (const f of fs.readdirSync(cacheDir)) {
      const full = path.join(cacheDir, f);
      try {
        const st = fs.statSync(full);
        if (st.isFile() && st.mtimeMs < cutoff) fs.unlinkSync(full);
      } catch (_) {}
    }
  } catch (_) {}
}
setTimeout(sweepTtsCache, 5000).unref?.();
