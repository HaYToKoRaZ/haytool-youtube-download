/**
 * HaYTooL YouTube Downloader - AI Video Özeti Servisi
 * server/services/aiSummary.js
 * 
 * Desteklenen Sağlayıcılar:
 *   - LM Studio (Yerel sunucu - sıfır key, dinamik model tespiti, ayarlanabilir port)
 *   - Groq Cloud (Otomatik model tespiti, openai/gpt-oss-120b / llama-3.3 / qwen)
 *   - Google Gemini (gemini-2.5-flash, gemini-2.0-flash, gemini-1.5-flash)
 *   - DeepSeek (deepseek-chat - ekonomik)
 *   - OpenAI (gpt-4o-mini)
 *   - Yerel Ollama (localhost:11434)
 *   - Yerel GGUF Model Dosyası (.gguf)
 *   - Dahili Heuristik Doğal Dil Motoru (APİSİZ & Çevrimdışı)
 */

import fs from 'fs';
import path from 'path';
import { readDb, decryptSecret, findVideoFileInDownloadDir } from '../database.js';
import { migrateLegacyEngineDir, getAppBinDir } from './paths.js';
import os from 'os';
import { execSync, spawn } from 'child_process';

const LMS_PATH = 'C:\\Users\\koraz\\.lmstudio\\bin\\lms.exe';
// Motorlar uygulama kökündeki 'bin' klasöründe barınır (kod dizinini kirletmez)
const LLAMA_DIR = migrateLegacyEngineDir('llama', 'llama-cli.exe');
const LLAMA_CLI = path.join(LLAMA_DIR, 'llama-cli.exe');
// GPU (Vulkan) motoru CPU motorunun yanındaki gpu/ alt klasöründe barınır (ikisi bir arada kurulabilir)
const LLAMA_GPU_CLI = path.join(LLAMA_DIR, 'gpu', 'llama-cli.exe');
const LLAMA_RELEASE_BASE = 'https://github.com/ggml-org/llama.cpp/releases/download/b12058';
// O an çalışmakta olan llama-cli.exe süreci (aynı anda tek çalışma garanti edilir)
let activeLlamaProc = null;

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
 * Taşınabilir LLaMA motorlarının (CPU ve GPU/Vulkan llama-cli.exe) sistemdeki durumunu denetler.
 * @returns {{ installed: boolean, gpuInstalled: boolean, path: string, gpuPath: string }}
 */
export function checkLlamaEngineStatus() {
  return {
    installed: fs.existsSync(LLAMA_CLI),
    gpuInstalled: fs.existsSync(LLAMA_GPU_CLI),
    recommendedInstalled: fs.existsSync(getRecommendedModelPath()),
    path: LLAMA_CLI,
    gpuPath: LLAMA_GPU_CLI
  };
}

/**
 * Verilen klasörde (en fazla 2 seviye alt klasör dahil) .gguf model dosyalarını tarar.
 * @param {string} dir - Taranacak klasör yolu
 * @param {number} [maxDepth=2] - Maksimum özyineleme derinliği
 * @param {number} [maxEntries=300] - Ziyaret edilen maksimum klasör girişi (güvenlik limiti)
 * @returns {{ success: boolean, dir: string, models: Array<{ name: string, path: string, sizeMB: number }>, error?: string }}
 */
export function scanGgufModels(dir, maxDepth = 2, maxEntries = 300) {
  if (!dir || typeof dir !== 'string' || !fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) {
    return { success: false, dir: dir || '', models: [], error: 'Model klasörü bulunamadı veya geçerli değil.' };
  }

  const models = [];
  let visited = 0;

  const walk = (currentDir, depth) => {
    if (depth > maxDepth || visited >= maxEntries) return;
    let entries = [];
    try {
      entries = fs.readdirSync(currentDir, { withFileTypes: true });
    } catch (_) { return; }
    for (const entry of entries) {
      if (visited >= maxEntries) break;
      if (entry.name.startsWith('.') || entry.name.toLowerCase() === 'node_modules') continue;
      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        visited++;
        walk(fullPath, depth + 1);
      } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.gguf')) {
        visited++;
        let sizeMB = 0;
        try { sizeMB = Math.round(fs.statSync(fullPath).size / (1024 * 1024)); } catch (_) {}
        models.push({ name: entry.name, path: fullPath, sizeMB });
      }
    }
  };

  walk(dir, 0);
  models.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
  return { success: true, dir, models };
}

/**
 * Resmi GitHub b12058 sürümünden taşınabilir LLaMA motorunu indirir ve kurar.
 * @param {'cpu'|'gpu'} [variant='cpu'] - 'cpu': 23 MB CPU motoru (bin/llama), 'gpu': 36 MB Vulkan motoru (bin/llama/gpu)
 * @returns {Promise<{ success: boolean, message: string }>}
 */
export async function downloadAndInstallLlamaEngine(variant = 'cpu') {
  const isGpu = variant === 'gpu';
  const targetCli = isGpu ? LLAMA_GPU_CLI : LLAMA_CLI;
  const targetDir = isGpu ? path.join(LLAMA_DIR, 'gpu') : LLAMA_DIR;
  const zipName = isGpu ? 'llama-b12058-bin-win-vulkan-x64.zip' : 'llama-b12058-bin-win-cpu-x64.zip';

  if (fs.existsSync(targetCli)) {
    return { success: true, message: isGpu ? 'GPU (Vulkan) LLaMA motoru zaten kurulu.' : 'Taşınabilir LLaMA motoru zaten kurulu.' };
  }

  fs.mkdirSync(targetDir, { recursive: true });

  const downloadUrl = `${LLAMA_RELEASE_BASE}/${zipName}`;
  const tempZip = path.join(os.tmpdir(), `llama_engine_${variant}_${Date.now()}.zip`);

  const resp = await fetch(downloadUrl);
  if (!resp.ok) {
    throw new Error(`GitHub indirme başarısız (${resp.status}): ${resp.statusText}`);
  }
  const arrayBuffer = await resp.arrayBuffer();
  fs.writeFileSync(tempZip, Buffer.from(arrayBuffer));

  try {
    execSync(`powershell -NoProfile -Command "Expand-Archive -Path '${tempZip}' -DestinationPath '${targetDir}' -Force"`, {
      timeout: 240000
    });
  } finally {
    try { if (fs.existsSync(tempZip)) fs.unlinkSync(tempZip); } catch (_) {}
  }

  // Arşiv içi alt klasör düzenine karşı güvence: exe altta kaldıysa içeriği hedefe yay
  if (!fs.existsSync(targetCli)) {
    const found = findFileRecursive(targetDir, 'llama-cli.exe', 2);
    if (found) {
      try { fs.cpSync(path.dirname(found), targetDir, { recursive: true, force: true }); } catch (_) {}
    }
  }

  if (!fs.existsSync(targetCli)) {
    throw new Error('Arşiv çıkartıldı ancak llama-cli.exe bulunamadı.');
  }

  return { success: true, message: isGpu ? 'GPU (Vulkan) LLaMA motoru başarıyla kuruldu.' : 'Taşınabilir LLaMA motoru başarıyla kuruldu.' };
}

// ── Önerilen Başlangıç Modeli (Gemma 3 1B QAT GGUF, ~687 MB) tek tıkla kurulum ──────────────
const RECOMMENDED_MODEL_URL = 'https://huggingface.co/lmstudio-community/gemma-3-1B-it-qat-GGUF/resolve/main/gemma-3-1B-it-QAT-Q4_0.gguf';
const RECOMMENDED_MODEL_FILE = 'gemma-3-1B-it-QAT-Q4_0.gguf';
const RECOMMENDED_MODEL_SIZE_MB = 687;

let recommendedModelDownload = {
  active: false,
  received: 0,
  total: 0,
  done: false,
  cancelled: false,
  error: '',
  filePath: ''
};
let recommendedModelAbort = null;

/**
 * Önerilen modelin kurulacağı klasörü çözer: kayıtlı model klasörü, yoksa indirme klasörü altında AI-Models.
 * @returns {string} Hedef klasör yolu
 */
function resolveRecommendedModelDir() {
  const settings = readDb().settings || {};
  if (settings.ggufModelsDir && typeof settings.ggufModelsDir === 'string' && fs.existsSync(settings.ggufModelsDir)) {
    return settings.ggufModelsDir;
  }
  const base = (settings.downloadPath && typeof settings.downloadPath === 'string' && fs.existsSync(settings.downloadPath))
    ? settings.downloadPath
    : process.cwd();
  return path.join(base, 'AI-Models');
}

/**
 * Önerilen model dosyasının beklenen tam yolu (varlığı kurulu anlamına gelir).
 * @returns {string} .gguf dosya yolu
 */
export function getRecommendedModelPath() {
  return path.join(resolveRecommendedModelDir(), RECOMMENDED_MODEL_FILE);
}

/**
 * Önerilen modeli Hugging Face'ten akışlı olarak indirir (arkada çalışır, .part + rename ile güvenli).
 * Durum, istemci tarafından getRecommendedModelDownloadStatus ile yoklanır.
 * @returns {{ started: boolean, alreadyInstalled: boolean, filePath: string }}
 */
export function startRecommendedModelDownload() {
  const filePath = getRecommendedModelPath();
  if (fs.existsSync(filePath)) {
    return { started: false, alreadyInstalled: true, filePath };
  }
  if (recommendedModelDownload.active) {
    return { started: false, alreadyInstalled: false, filePath: recommendedModelDownload.filePath };
  }

  recommendedModelDownload = { active: true, received: 0, total: RECOMMENDED_MODEL_SIZE_MB * 1024 * 1024, done: false, cancelled: false, error: '', filePath };
  recommendedModelAbort = new AbortController();

  (async () => {
    const partPath = `${filePath}.part`;
    let fileStream = null;
    try {
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      const resp = await fetch(RECOMMENDED_MODEL_URL, { signal: recommendedModelAbort.signal });
      if (!resp.ok || !resp.body) {
        throw new Error(`İndirme başlayamadı (HTTP ${resp.status}).`);
      }
      const contentLength = Number(resp.headers.get('content-length'));
      if (contentLength > 0) recommendedModelDownload.total = contentLength;

      fileStream = fs.createWriteStream(partPath);
      const reader = resp.body.getReader();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        recommendedModelDownload.received += value.length;
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
      fs.renameSync(partPath, filePath);
      recommendedModelDownload.done = true;
    } catch (err) {
      const aborted = recommendedModelDownload.cancelled || (err && err.name === 'AbortError');
      if (!aborted) {
        recommendedModelDownload.error = (err && err.message) ? err.message : 'Bilinmeyen indirme hatası.';
        console.error('[Recommended Model Download Error]:', recommendedModelDownload.error);
      }
    } finally {
      try { if (fileStream && !fileStream.destroyed) fileStream.destroy(); } catch (_) {}
      try { if (!recommendedModelDownload.done && fs.existsSync(partPath)) fs.unlinkSync(partPath); } catch (_) {}
      recommendedModelDownload.active = false;
      recommendedModelAbort = null;
    }
  })();

  return { started: true, alreadyInstalled: false, filePath };
}

/**
 * Önerilen model indirmesinin güncel durumu (istemci ~1 sn aralıkla yoklar).
 * @returns {{ active: boolean, received: number, total: number, done: boolean, cancelled: boolean, error: string, filePath: string, sizeMB: number }}
 */
export function getRecommendedModelDownloadStatus() {
  return { ...recommendedModelDownload, sizeMB: RECOMMENDED_MODEL_SIZE_MB };
}

/**
 * Devam eden önerilen model indirmesini iptal eder; yarım .part dosyası temizlenir.
 * @returns {{ cancelled: boolean }}
 */
export function cancelRecommendedModelDownload() {
  if (!recommendedModelDownload.active || !recommendedModelAbort) {
    return { cancelled: false };
  }
  recommendedModelDownload.cancelled = true;
  try { recommendedModelAbort.abort(); } catch (_) {}
  return { cancelled: true };
}

/**
 * LM Studio modellerini bellekten boşaltır (On-Demand 0 RAM/VRAM)
 */
export function unloadLmStudioModels() {
  if (fs.existsSync(LMS_PATH)) {
    try {
      execSync(`"${LMS_PATH}" unload --all`, { stdio: 'ignore', timeout: 5000 });
    } catch (_) {}
  }
}

/**
 * Altyazı dosyalarındaki WebVTT veya SubRip (SRT) içeriğini ayrıştırır.
 * @param {string} rawText 
 * @returns {Array<{ timeSec: number, timeStr: string, text: string }>}
 */
export function parseSubtitleCues(rawText) {
  if (!rawText || typeof rawText !== 'string') return [];
  const cues = [];
  const text = rawText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const blocks = text.split(/\n\s*\n/);
  
  const timeRegex = /(?:(\d{1,2}):)?(\d{2}):(\d{2})[,.](\d{3})\s*-->\s*(?:(\d{1,2}):)?(\d{2}):(\d{2})[,.](\d{3})/;

  for (const block of blocks) {
    const lines = block.trim().split('\n');
    let timeMatch = null;
    let textStartIndex = -1;

    for (let i = 0; i < lines.length; i++) {
      const m = lines[i].match(timeRegex);
      if (m) {
        timeMatch = m;
        textStartIndex = i + 1;
        break;
      }
    }

    if (timeMatch && textStartIndex !== -1) {
      const hours = parseInt(timeMatch[1] || '0', 10);
      const mins = parseInt(timeMatch[2], 10);
      const secs = parseInt(timeMatch[3], 10);
      const totalSecs = hours * 3600 + mins * 60 + secs;
      
      const formattedTime = (hours > 0 ? `${hours}:` : '') + 
        `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

      const cueLines = lines.slice(textStartIndex)
        .map(l => l.replace(/<[^>]+>/g, '').trim())
        .filter(l => l && !/^(WEBVTT|NOTE|STYLE|REGION)/i.test(l));

      const cueText = cueLines.join(' ');
      if (cueText) {
        cues.push({
          timeSec: totalSecs,
          timeStr: formattedTime,
          text: cueText
        });
      }
    }
  }

  // Art arda gelen mükerrer satırları temizle
  const deduped = [];
  let lastText = '';
  for (const c of cues) {
    if (c.text !== lastText) {
      deduped.push(c);
      lastText = c.text;
    }
  }
  return deduped;
}

/**
 * Belirtilen videoya ait diskteki herhangi bir altyazı dosyasını bulur.
 */
export function findVideoSubtitleFile(filePath, videoId, preferredLang = 'auto') {
  if (!filePath) return null;
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) return null;

  const ext = path.extname(filePath);
  const baseName = path.basename(filePath, ext);
  const escapedName = baseName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const escapedId = videoId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const files = fs.readdirSync(dir);

  // 1. Kullanıcının doğrudan seçtiği belirli dil (.tr.vtt, .en.vtt, vb.)
  if (preferredLang && preferredLang !== 'auto') {
    const escapedLang = preferredLang.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    let match = files.find(f => new RegExp(`^${escapedName}\\.${escapedLang}\\.(vtt|srt)$`, 'i').test(f));
    if (match) return path.join(dir, match);
    match = files.find(f => new RegExp(`\\.${escapedLang}\\.(vtt|srt)$`, 'i').test(f));
    if (match) return path.join(dir, match);
  }

  // 2. Türkçe (.tr.vtt / .tr.srt)
  let match = files.find(f => new RegExp(`^${escapedName}\\.tr\\.(vtt|srt)$`, 'i').test(f));
  if (match) return path.join(dir, match);

  // 3. İngilizce (.en.vtt / .en.srt)
  match = files.find(f => new RegExp(`^${escapedName}\\.en\\.(vtt|srt)$`, 'i').test(f));
  if (match) return path.join(dir, match);

  // 4. Herhangi bir vtt
  match = files.find(f => new RegExp(`^${escapedName}\\.[a-z0-9_-]+\\.vtt$`, 'i').test(f));
  if (match) return path.join(dir, match);

  // 5. Herhangi bir srt
  match = files.find(f => new RegExp(`^${escapedName}\\.[a-z0-9_-]+\\.srt$`, 'i').test(f));
  if (match) return path.join(dir, match);

  // 6. Video ID tabanlı arama
  match = files.find(f => new RegExp(`${escapedId}.*\\.(vtt|srt)$`, 'i').test(f));
  if (match) return path.join(dir, match);

  return null;
}

/**
 * LM Studio yerel sunucusundaki mevcut yüklü modelleri listeler.
 * @param {number} [port=1234]
 * @returns {Promise<string[]>}
 */
export async function getLmStudioModels(port = 1234) {
  try {
    const res = await fetch(`http://localhost:${port}/v1/models`, {
      signal: AbortSignal.timeout(2500)
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.data || [])
      .map(m => m.id)
      .filter(id => {
        if (!id) return false;
        const lower = id.toLowerCase();
        if (lower.includes('tts') || lower.includes('embed') || lower.includes('audio') || lower.includes('speech')) return false;
        return true;
      });
  } catch (e) {
    return [];
  }
}

/**
 * LM Studio (Yerel OpenAI uyumlu sunucu) API çağrısı
 */
async function callLmStudio(port, modelName, systemPrompt, userContent, customMessages = null) {
  const p = port || 1234;
  
  // Model adını belirle: Kullanıcı bir model seçtiyse onu kullan; yoksa yüklü ilk modeli otomatik al
  let model = modelName && modelName !== 'auto' ? modelName : null;
  if (!model) {
    const available = await getLmStudioModels(p);
    if (available.length > 0) {
      model = available[0];
    } else {
      model = 'local-model';
    }
  }

  const url = `http://localhost:${p}/v1/chat/completions`;
  let res;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: model,
        messages: customMessages || [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userContent }
        ],
        temperature: 0.3
      }),
      signal: AbortSignal.timeout(90000)
    });
  } catch (fetchErr) {
    throw new Error(`LM Studio sunucusuna bağlanılamadı (Port: ${p}). LM Studio uygulamasını açıp Local Server'ı başlattığınızdan emin olun.`);
  }

  if (!res.ok) {
    const errText = await res.text();
    let detail = errText.slice(0, 200);
    try {
      const parsed = JSON.parse(errText);
      detail = parsed.error?.message || detail;
    } catch (_) {}
    throw new Error(`LM Studio Hatası (${res.status}): ${detail}`);
  }

  const data = await res.json();
  const summary = data.choices?.[0]?.message?.content;
  if (!summary) throw new Error('LM Studio yanıtı boş döndü.');
  return { summary, modelUsed: model };
}

/**
 * Groq Cloud API çağrısı (Model otomatik fallback özellikli)
 */
async function callGroq(apiKey, modelName, systemPrompt, userContent) {
  if (!apiKey) throw new Error('Groq API anahtarı ayarlanmamış. Ayarlar sekmesinden Groq API anahtarınızı girin.');
  
  let model = modelName || 'openai/gpt-oss-120b';
  const url = 'https://api.groq.com/openai/v1/chat/completions';

  const sendRequest = async (m) => {
    return await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: m,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userContent }
        ],
        temperature: 0.5
      }),
      signal: AbortSignal.timeout(45000)
    });
  };

  const candidateModels = [model, 'qwen/qwen3.8-27b', 'openai/gpt-oss-20b', 'allam-2-7b', 'openai/gpt-oss-120b'];
  let res = null;
  let activeCandidate = model;

  for (const cand of candidateModels) {
    activeCandidate = cand;
    res = await sendRequest(cand);
    // 200 dönerse başarılı
    if (res.ok) {
      model = cand;
      break;
    }
    // Eğer 429 (Rate limit) veya 404/400 ise sonraki adayı dene
    if (res.status === 429 || res.status === 413 || res.status === 404 || res.status === 400) {
      continue;
    }
    // Diğer kritik hatalarda döngüden çık
    break;
  }

  if (!res.ok) {
    const errText = await res.text();
    let detail = errText.slice(0, 200);
    try {
      const parsed = JSON.parse(errText);
      detail = parsed.error?.message || detail;
    } catch (_) {}
    throw new Error(`Groq API Hatası (${res.status}): ${detail}`);
  }

  const data = await res.json();
  const summary = data.choices?.[0]?.message?.content;
  if (!summary) throw new Error('Groq API boş yanıt döndü.');
  return { summary, modelUsed: model };
}

/**
 * Google Gemini API çağrısı
 */
async function callGemini(apiKey, systemPrompt, userContent) {
  if (!apiKey) throw new Error('Google Gemini API anahtarı girilmemiş. Ayarlar > Sistem sekmesinden ücretsiz Gemini key ekleyin.');
  
  // Güncel ve aktif Gemini modelleri (2.5-flash ve 2.0-flash v1beta'da yenilere kapatıldı)
  const models = ['gemini-3.5-flash', 'gemini-flash-latest', 'gemini-3.1-flash-lite', 'gemini-3.8-flash'];
  let lastError = null;

  for (const model of models) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents: [{ parts: [{ text: userContent }] }]
        }),
        signal: AbortSignal.timeout(45000)
      });

      if (!res.ok) {
        const errText = await res.text();
        let detail = errText.slice(0, 200);
        try {
          const parsed = JSON.parse(errText);
          detail = parsed.error?.message || detail;
        } catch (_) {}
        if (res.status === 400 || res.status === 401) {
          throw new Error(`Google Gemini Hatası (${res.status}): ${detail}`);
        }
        lastError = new Error(`Gemini ${model} HTTP ${res.status}: ${detail}`);
        continue;
      }

      const data = await res.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) return { summary: text, modelUsed: model };
    } catch (err) {
      lastError = err;
      if (err.message.includes('Google Gemini Hatası')) throw err;
    }
  }
  throw lastError || new Error('Gemini API yanıt veremedi.');
}

/**
 * DeepSeek API çağrısı
 */
async function callDeepSeek(apiKey, systemPrompt, userContent) {
  if (!apiKey) throw new Error('DeepSeek API anahtarı girilmemiş. Ayarlar sekmesinden DeepSeek API anahtarınızı girin.');
  const url = 'https://api.deepseek.com/chat/completions';
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent }
      ],
      temperature: 0.5
    }),
    signal: AbortSignal.timeout(45000)
  });

  if (!res.ok) {
    const errText = await res.text();
    let detail = errText.slice(0, 200);
    try {
      const parsed = JSON.parse(errText);
      detail = parsed.error?.message || detail;
    } catch (_) {}
    if (res.status === 402) {
      throw new Error(`DeepSeek API Hatası (402): Bakiye Yetersiz (Insufficient Balance). Lütfen platform.deepseek.com üzerinden bakiye ekleyin veya LM Studio kullanın.`);
    }
    throw new Error(`DeepSeek Hatası (${res.status}): ${detail}`);
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error('DeepSeek yanıtı boş döndü.');
  return { summary: content, modelUsed: 'deepseek-chat' };
}

/**
 * OpenAI API çağrısı (gpt-4o-mini)
 */
async function callOpenAi(apiKey, systemPrompt, userContent) {
  if (!apiKey) throw new Error('OpenAI API anahtarı girilmemiş.');
  const url = 'https://api.openai.com/v1/chat/completions';
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent }
      ],
      temperature: 0.5
    }),
    signal: AbortSignal.timeout(45000)
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`OpenAI HTTP ${res.status}: ${errText.slice(0, 150)}`);
  }
  const data = await res.json();
  return { summary: data.choices?.[0]?.message?.content, modelUsed: 'gpt-4o-mini' };
}

/**
 * Çalışmakta olan llama-cli.exe sürecini (varsa) anında sonlandırır.
 * @returns {boolean} Bir süreç öldürüldüyse true döner
 */
export function stopLlamaEngine() {
  const proc = activeLlamaProc;
  activeLlamaProc = null;
  if (proc && !proc.killed) {
    try { proc.kill(); return true; } catch (_) { return false; }
  }
  return false;
}

/**
 * llama-cli.exe sürecini Node event loop'unu bloklamadan (spawn) çalıştırır ve çıkışını asenkron bekler.
 * Yeni bir çalışma başlarken önceki süreç otomatik öldürülür (aynı anda tek llama-cli garantisi).
 * @param {string} cliPath - Çalıştırılacak llama-cli.exe yolu (CPU veya GPU/Vulkan)
 * @param {string[]} args - llama-cli argümanları
 * @returns {Promise<void>} Süreç 0 koduyla çıkarsa resolve, aksi halde reject
 */
function runLlamaCliOnce(cliPath, args) {
  return new Promise((resolve, reject) => {
    stopLlamaEngine();

    const child = spawn(cliPath, args, { windowsHide: true });
    activeLlamaProc = child;
    try {
      if (child.pid) os.setPriority(child.pid, os.constants.priority.PRIORITY_BELOW_NORMAL);
    } catch (_) {}

    const timeout = setTimeout(() => {
      try { child.kill(); } catch (_) {}
      reject(new Error('Taşınabilir LLaMA motoru zaman aşımına uğradı (90 sn).'));
    }, 90000);

    child.on('error', (err) => {
      clearTimeout(timeout);
      if (activeLlamaProc === child) activeLlamaProc = null;
      reject(err);
    });

    child.on('exit', (code, signal) => {
      clearTimeout(timeout);
      if (activeLlamaProc === child) activeLlamaProc = null;
      if (signal) {
        return reject(new Error('Taşınabilir LLaMA motoru iptal edildi.'));
      }
      if (code !== 0) {
        return reject(new Error(`Taşınabilir LLaMA motoru hata koduyla çıktı: ${code}`));
      }
      resolve();
    });
  });
}

/**
 * Yerel GGUF Model Dosyası Entegrasyonu
 * @param {boolean} [useGpuPref=false] - Kullanıcı GPU hızlandırmayı tercih ediyor mu (GPU motoru kuruluysa -ngl 99 ile çalışır)
 */
async function callGgufModel(modelPath, systemPrompt, userContent, customMessages = null, useGpuPref = false) {
  if (!modelPath) {
    throw new Error('Yerel .gguf model dosyası yolu belirtilmemiş. Ayarlar sekmesinden "Yerel GGUF Model Dosyası (.gguf)" yolunu girin.');
  }
  if (!fs.existsSync(modelPath)) {
    throw new Error(`Belirtilen GGUF modeli bulunamadı: ${modelPath}`);
  }

  const cpuReady = fs.existsSync(LLAMA_CLI);
  const gpuReady = fs.existsSync(LLAMA_GPU_CLI);
  const useGpuFirst = useGpuPref && gpuReady;

  // 1. Taşınabilir LLaMA motoru (GPU/Vulkan tercihen, yoksa CPU) çalıştırılır (LM Studio gerektirmez)
  if (cpuReady || gpuReady) {
    const sysTmp = path.join(os.tmpdir(), `llama_sys_${Date.now()}_${Math.random().toString(36).slice(2)}.txt`);
    const usrTmp = path.join(os.tmpdir(), `llama_usr_${Date.now()}_${Math.random().toString(36).slice(2)}.txt`);
    const outTmp = path.join(os.tmpdir(), `llama_out_${Date.now()}_${Math.random().toString(36).slice(2)}.txt`);

    try {
      fs.writeFileSync(sysTmp, systemPrompt, 'utf8');
      fs.writeFileSync(usrTmp, userContent, 'utf8');

      // Tek seferlik (single-turn) çalıştır ve bitince hemen çık (0 RAM); GPU modunda tüm katmanlar VRAM'e alınır
      const buildArgs = (forGpu) => {
        const a = [
          '-m', modelPath,
          '-sysf', sysTmp,
          '-f', usrTmp,
          '-o', outTmp,
          '-n', '1024',
          '-c', '16384',
          '-st',
          '--temp', '0.3',
          '--repeat-penalty', '1.18',
          '--no-warmup',
          '--log-disable'
        ];
        if (forGpu) {
          a.push('-ngl', '99');
        } else {
          const halfCores = Math.max(1, Math.floor((os.cpus()?.length || 4) / 2));
          a.push('-t', String(halfCores));
        }
        return a;
      };

      // Event loop bloklanmadan çalışır: bu sırada gelen yeni özet isteği eski süreci öldürüp kendisi başlar
      let ranOnGpu = false;
      try {
        if (useGpuFirst || (!cpuReady && gpuReady)) {
          await runLlamaCliOnce(LLAMA_GPU_CLI, buildArgs(true));
          ranOnGpu = true;
        } else {
          await runLlamaCliOnce(LLAMA_CLI, buildArgs(false));
        }
      } catch (engineErr) {
        // GPU denemesi başarısızsa (VRAM taşması / sürücü hatası) CPU kuruluysa bir kez CPU ile dene
        if (ranOnGpu && cpuReady) {
          console.warn('[GGUF] GPU çalıştırması başarısız, CPU ile deneniyor:', engineErr.message);
          await runLlamaCliOnce(LLAMA_CLI, buildArgs(false));
          ranOnGpu = false;
        } else {
          throw engineErr;
        }
      }

      if (!fs.existsSync(outTmp)) {
        throw new Error('Taşınabilir LLaMA motoru çıktı dosyası oluşturamadı.');
      }

      let rawOut = fs.readFileSync(outTmp, 'utf8').trim();

      // Çeşitli model formatlarındaki asistan belirteçlerini temizle
      const assistantMarkers = [
        'Assistant:',
        '<|start_header_id|>assistant<|end_header_id|>',
        '<start_of_turn>model',
        '<|im_start|>assistant',
        '[/INST]'
      ];

      for (const marker of assistantMarkers) {
        const idx = rawOut.lastIndexOf(marker);
        if (idx !== -1) {
          rawOut = rawOut.slice(idx + marker.length).trim();
          break;
        }
      }

      // Eğer model sadece promptu dönerse veya asistan metni boş kalırsa
      if (rawOut.startsWith('User:') || rawOut.startsWith('user\n')) {
        const doubleNewline = rawOut.indexOf('\n\nAssistant:\n');
        if (doubleNewline !== -1) {
          rawOut = rawOut.slice(doubleNewline + 13).trim();
        }
      }

      if (!rawOut) {
        throw new Error('Taşınabilir LLaMA motoru boş yanıt üretti.');
      }

      return {
        summary: rawOut,
        modelUsed: `${path.basename(modelPath)} · ${ranOnGpu ? 'GPU' : 'CPU'}`
      };
    } finally {
      try { if (fs.existsSync(sysTmp)) fs.unlinkSync(sysTmp); } catch (_) {}
      try { if (fs.existsSync(usrTmp)) fs.unlinkSync(usrTmp); } catch (_) {}
      try { if (fs.existsSync(outTmp)) fs.unlinkSync(outTmp); } catch (_) {}
    }
  }
  // 2. Taşınabilir motor yoksa, LM Studio fallback'ini dene
  if (!fs.existsSync(LMS_PATH)) {
    throw new Error('Taşınabilir LLaMA motoru henüz kurulmamış. Ayarlar > Sistem sekmesinden "Motoru İndir (~23 MB)" butonuna tıklayarak bağımsız motoru kurabilirsiniz.');
  }


  const modelFile = path.basename(modelPath);
  const baseNameLower = path.parse(modelFile).name.toLowerCase();
  let targetModelId = null;

  // 1. LM Studio'daki modelleri tara
  try {
    const available = await getLmStudioModels(1234);
    if (available.length > 0) {
      targetModelId = available.find(m => {
        const mLow = m.toLowerCase();
        return mLow.includes(baseNameLower) || 
               (baseNameLower.includes('gemma-3-1b') && mLow.includes('gemma-3-1b')) ||
               (baseNameLower.includes('qwen') && mLow.includes('qwen'));
      }) || available[0];
    }
  } catch (_) {}

  // 2. Eğer model bulunamadıysa ve lms CLI varsa lms ls ile model ID bul
  if (!targetModelId && fs.existsSync(LMS_PATH)) {
    try {
      const lsOut = execSync(`"${LMS_PATH}" ls`, { encoding: 'utf8', timeout: 5000 });
      const lines = lsOut.split('\n');
      for (const line of lines) {
        const parts = line.trim().split(/\s{2,}/);
        if (parts[0] && (baseNameLower.includes('gemma-3-1b') && parts[0].includes('gemma-3-1b'))) {
          targetModelId = parts[0].replace(/\s*\(.*?\)/, '').trim();
          break;
        }
      }
    } catch (_) {}
  }

  if (!targetModelId) {
    targetModelId = 'google/gemma-3-1b';
  }

  // 3. Yerel sunucu açık mı kontrol et; değilse lms server start ile başlat
  try {
    const sRes = await fetch('http://localhost:1234/v1/models', { signal: AbortSignal.timeout(1000) });
    if (!sRes.ok) throw new Error();
  } catch (_) {
    if (fs.existsSync(LMS_PATH)) {
      try {
        execSync(`"${LMS_PATH}" server start`, { stdio: 'ignore', timeout: 5000 });
        await new Promise(r => setTimeout(r, 1500));
      } catch (_) {}
    }
  }

  // 4. Modeli TTL ile yükle (Eğer yüklü değilse)
  if (fs.existsSync(LMS_PATH)) {
    try {
      execSync(`"${LMS_PATH}" load "${targetModelId}" --ttl 60 -y`, { stdio: 'ignore', timeout: 15000 });
    } catch (_) {}
  }

  // 5. Çıkarımı çalıştır ve bitince on-demand modeli hemen boşalt (0 RAM)
  try {
    return await callLmStudio(1234, targetModelId, systemPrompt, userContent, customMessages);
  } finally {
    unloadLmStudioModels();
  }
}

/**
 * Ollama Yerel API çağrısı
 */
async function callOllama(port, modelName, systemPrompt, userContent) {
  const p = port || 11434;
  const model = modelName || 'llama3';
  const url = `http://localhost:${p}/api/generate`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: model,
      prompt: `${systemPrompt}\n\n${userContent}`,
      stream: false
    }),
    signal: AbortSignal.timeout(60000)
  });
  if (!res.ok) {
    throw new Error(`Ollama HTTP ${res.status}`);
  }
  const data = await res.json();
  return { summary: data.response, modelUsed: model };
}

/**
 * Dahili Doğal Dil Motoru (APİSİZ & Çevrimdışı Heuristik Sentezleyici)
 */
export function callLocalNlp(cues, mode, lang = 'tr') {
  if (!cues || cues.length === 0) return 'Özetlenecek altyazı metni bulunamadı.';

  if (mode === 'timestamped') {
    const step = Math.max(1, Math.floor(cues.length / 8));
    const moments = [];
    for (let i = 0; i < cues.length && moments.length < 8; i += step) {
      moments.push(`[${cues[i].timeStr}] ${cues[i].text}`);
    }
    return moments.join('\n\n');
  }

  // Narrative Mode: Başlık yok, liste yok, madde yok.
  const allSentences = [];
  for (const c of cues) {
    const sentences = c.text
      .split(/(?<=[.!?])\s+/)
      .map(s => s.trim())
      .filter(s => s.length > 20);
    allSentences.push(...sentences);
  }

  if (allSentences.length <= 4) {
    return allSentences.join(' ');
  }

  const wordFreq = new Map();
  const stopWords = new Set(['ve', 'veya', 'ile', 'bir', 'bu', 'da', 'de', 'için', 'gibi', 'kadar', 'sonra', 'önce', 'daha', 'the', 'and', 'or', 'in', 'on', 'at', 'to', 'for', 'with', 'that', 'this', 'is', 'are', 'was', 'were']);

  for (const s of allSentences) {
    const words = s.toLowerCase().replace(/[^\p{L}\s]/gu, '').split(/\s+/);
    for (const w of words) {
      if (w.length > 2 && !stopWords.has(w)) {
        wordFreq.set(w, (wordFreq.get(w) || 0) + 1);
      }
    }
  }

  const scored = allSentences.map((s, idx) => {
    const words = s.toLowerCase().replace(/[^\p{L}\s]/gu, '').split(/\s+/);
    let score = 0;
    for (const w of words) {
      score += wordFreq.get(w) || 0;
    }
    const lenNorm = Math.min(words.length, 25) / Math.max(words.length, 10);
    score = score * lenNorm;
    if (idx < 3) score *= 1.3;
    if (idx > allSentences.length - 4) score *= 1.2;
    return { sentence: s, score, idx };
  });

  scored.sort((a, b) => b.score - a.score);
  const selectedCount = Math.min(10, Math.max(4, Math.floor(allSentences.length * 0.15)));
  const topSentences = scored.slice(0, selectedCount);
  topSentences.sort((a, b) => a.idx - b.idx);

  const paragraphs = [];
  const chunkSize = Math.ceil(topSentences.length / 3);
  for (let i = 0; i < topSentences.length; i += chunkSize) {
    const chunk = topSentences.slice(i, i + chunkSize);
    paragraphs.push(chunk.map(item => item.sentence).join(' '));
  }

  return paragraphs.join('\n\n');
}

/**
 * Belirtilen videonun altyazı içeriğini yapay zeka (veya yerel NLP) ile özetler.
 * @param {string} videoId 
 * @param {object} [options]
 */
export async function generateVideoSummary(videoId, options = {}) {
  const db = readDb();
  const historyList = Array.isArray(db.history) ? db.history : [];
  let video = historyList.find(v => v.id === videoId || v.originalId === videoId || v.key === videoId);

  let filePath = video?.filePath;
  if (!filePath && db.settings?.downloadPath) {
    filePath = findVideoFileInDownloadDir(videoId, db.settings.downloadPath);
  }

  if (!video && !filePath) {
    return { success: false, error: 'Video veritabanında veya indirme klasöründe bulunamadı.' };
  }

  const videoTitle = video?.title || (filePath ? path.basename(filePath, path.extname(filePath)) : 'Video');
  const subLang = options.subLang || 'auto';
  let outputLang = options.outputLang || options.lang || db.settings?.lang || 'tr';
  if (outputLang === 'app') {
    outputLang = db.settings?.lang || 'tr';
  }

  const subFilePath = findVideoSubtitleFile(filePath, videoId, subLang);
  if (!subFilePath || !fs.existsSync(subFilePath)) {
    return {
      success: false,
      noSubtitle: true,
      error: 'Bu video için diskte uygun altyazı dosyası (.vtt veya .srt) bulunamadı. Lütfen videoyu indirirken altyazı seçeneğinin aktif olduğundan emin olun.'
    };
  }

  const rawSubtitle = fs.readFileSync(subFilePath, 'utf8');
  const cues = parseSubtitleCues(rawSubtitle);

  if (!cues || cues.length === 0) {
    return {
      success: false,
      noSubtitle: true,
      error: 'Altyazı dosyası okundu ancak geçerli konuşma metni bulunamadı.'
    };
  }

  const mode = options.mode === 'timestamped' ? 'timestamped' : 'narrative';
  let provider = options.provider || db.settings?.aiProvider || 'auto';
  const totalWords = cues.reduce((sum, c) => sum + c.text.split(/\s+/).length, 0);

  // Hassas anahtarları AES-256 ile deşifre et
  const geminiKey = decryptSecret(db.settings?.geminiApiKey);
  const groqKey = decryptSecret(db.settings?.groqApiKey);
  const deepseekKey = decryptSecret(db.settings?.deepseekApiKey);
  const openAiKey = decryptSecret(db.settings?.openAiApiKey);
  const lmPort = options.port || db.settings?.lmStudioPort || 1234;
  const lmModel = options.model || db.settings?.lmStudioModel || 'auto';

  // Otomatik sağlayıcı seçimi (auto seçildiğinde)
  if (provider === 'auto') {
    // 1. Önce kullanıcının LM Studio sunucusu açık mı ve modeli var mı kontrol et
    const lmModels = await getLmStudioModels(lmPort);
    if (lmModels.length > 0) {
      provider = 'lmstudio';
    } else if (groqKey) {
      provider = 'groq';
    } else if (deepseekKey) {
      provider = 'deepseek';
    } else if (geminiKey) {
      provider = 'gemini';
    } else if (openAiKey) {
      provider = 'openai';
    } else {
      provider = 'local';
    }
  }

  // Dil haritası
  const langNames = {
    tr: 'Türkçe',
    en: 'English',
    de: 'Deutsch',
    es: 'Español',
    pt: 'Português',
    ru: 'Русский',
    ar: 'العربية'
  };
  const targetLangName = langNames[outputLang] || 'Türkçe';

  // Mod direktifleri ve Kullanıcı Format Kuralları
  let systemPrompt = '';
  let customMessages = null;

  if (mode === 'timestamped') {
    if (targetLangName === 'Türkçe') {
      systemPrompt = `Sen profesyonel bir video içerik analistisisin.
GÖREV: Verilen video altyazısını kronolojik sırada, sadece dakika damgalı maddelerle özetle.
ZORUNLU KURALLAR:
1. Her maddenin başına MUTLAKA [01:23] veya [05:40] gibi dakika damgası koy.
2. Açıklamaları KESİNLİKLE TÜRKÇE yaz. Asla dakikasız düz paragraf yazma.`;
    } else {
      systemPrompt = `You are an expert video content analyst. Summarize chronologically. Every item MUST start with a [mm:ss] timestamp. All explanations MUST be strictly in ${targetLangName}.`;
    }
  } else {
    // KULLANICININ İSTEDİĞİ YAPILANDIRILMIŞ SÜRESİZ ÖZET BİÇİMİ
    if (targetLangName === 'Türkçe') {
      systemPrompt = `Aşağıdaki altyazı metnini özetlemeni istiyorum.

Kurallar:
- Uzunluk ve Denge: Ne tek cümlelik yüzeysel bir özet olsun ne de metnin kopyası kadar uzun. Konunun bağlamını ve gelişimini net aktaran orta uzunlukta bir özet hazırla.
- Biçim:
  1. Girişte konuyu ve ana fikri özetleyen 1-2 kısa paragraf yaz.
  2. Ardından konuşulan/işlenen en kritik noktaları, kararları veya olay akışını 5-7 maddelik bir liste halinde ver.
  3. Temizlik: Altyazıdaki satır numaralarını, konuşma aralarındaki takılmaları ve tekrar eden ifadeleri yok say; yalnızca içeriğe odaklan.
- Dil: Yanıtını KESİNLİKLE TÜRKÇE olarak yaz. Kaynak metin İngilizce olsa dahi tüm cümleler %100 Türkçe olmalıdır.`;
    } else {
      systemPrompt = `Summarize the provided video transcript with balance:
1. Write 1-2 short paragraphs introducing the main topic and thesis.
2. Provide 5-7 bullet points covering critical takeaways, decisions, or timeline events.
3. Cleanliness: Ignore timestamp numbers or disfluencies. Write strictly in ${targetLangName}.`;
    }
  }

  let userContent = '';
  if (mode === 'timestamped') {
    // Küçük modellerde (Gemma 1B vb.) aşırı metin yüklenmesini önlemek ve tüm video süresine yayılan
    // gerçek dakikaları garanti etmek için video boyunca eşit aralıklarla 15-20 ana an örneklenir.
    const sampleCount = Math.min(cues.length, Math.max(12, Math.min(22, Math.floor(cues.length / 5))));
    const step = Math.max(1, Math.floor(cues.length / sampleCount));
    const sampledCues = [];
    for (let i = 0; i < cues.length && sampledCues.length < sampleCount; i += step) {
      sampledCues.push(`[${cues[i].timeStr}] ${cues[i].text}`);
    }
    const sampledText = sampledCues.join('\n');

    const timeUserInstruction = targetLangName === 'Türkçe'
      ? `Aşağıdaki zaman damgalı konuşma metnini Türkçeye çevirerek kronolojik önemli anlar listesi yap. Her maddenin başına [01:23] gibi zaman damgasını koy:\n\n`
      : `Translate and summarize into chronological key moments with [mm:ss] timestamps at each item:\n\n`;

    userContent = timeUserInstruction + sampledText;
  } else {
    const narrativeInstruction = targetLangName === 'Türkçe'
      ? `Aşağıdaki altyazı metnini Türkçe olarak özetle. Önce 1-2 paragraf genel özet yaz, ardından en kritik 5-7 noktayı maddeler halinde sırala:\nVideo Başlığı: ${videoTitle}\n\n`
      : `Please summarize the transcript in ${targetLangName}. Write 1-2 intro paragraphs followed by 5-7 key bullet points:\nVideo Title: ${videoTitle}\n\n`;

    userContent = narrativeInstruction + cues.map(c => c.text).join(' ');
  }

  // Token koruması ve yerel küçük modeller (Gemma 1B) için context penceresi optimizasyonu
  const maxChars = (provider === 'gguf' || provider === 'lmstudio') ? 8000 : (provider.startsWith('groq') ? 12000 : 60000);
  if (userContent.length > maxChars) {
    userContent = userContent.slice(0, maxChars) + '... [metin devam ediyor]';
  }

  let summaryText = '';
  let engineUsed = provider;
  let activeModelUsed = '';
  const t0 = Date.now();

  try {
    switch (provider) {
      case 'lmstudio': {
        try {
          const res = await callLmStudio(lmPort, lmModel, systemPrompt, userContent, customMessages);
          summaryText = res.summary;
          activeModelUsed = res.modelUsed;
        } finally {
          // Özet tamamlandığında VRAM/RAM'i boşalt
          unloadLmStudioModels();
        }
        break;
      }
      case 'groq':
      case 'groq-llama33': {
        // Groq ücretsiz hesap TPM (Tokens Per Minute) koruması (Max 16.000 karakter)
        let groqPayload = userContent;
        if (groqPayload.length > 12000) {
          groqPayload = groqPayload.slice(0, 12000) + '... [metin devam ediyor]';
        }
        const res = await callGroq(groqKey, options.model, systemPrompt, groqPayload);
        summaryText = res.summary;
        activeModelUsed = res.modelUsed;
        break;
      }
      case 'gemini': {
        const res = await callGemini(geminiKey, systemPrompt, userContent);
        summaryText = res.summary;
        activeModelUsed = res.modelUsed;
        break;
      }
      case 'deepseek': {
        const res = await callDeepSeek(deepseekKey || openAiKey, systemPrompt, userContent);
        summaryText = res.summary;
        activeModelUsed = res.modelUsed;
        break;
      }
      case 'openai': {
        const res = await callOpenAi(openAiKey, systemPrompt, userContent);
        summaryText = res.summary;
        activeModelUsed = res.modelUsed;
        break;
      }
      case 'ollama': {
        const res = await callOllama(db.settings?.ollamaPort, options.model || 'llama3', systemPrompt, userContent);
        summaryText = res.summary;
        activeModelUsed = res.modelUsed;
        break;
      }
      case 'gguf': {
        // Panelden/istemciden gelen geçerli .gguf yolu önceliklidir (ayar kaydıyla yarış koşmasını engeller)
        const requestedModel = (typeof options.model === 'string' && options.model.toLowerCase().endsWith('.gguf') && fs.existsSync(options.model)) ? options.model : '';
        const ggufPath = requestedModel || db.settings?.ggufModelPath;
        const res = await callGgufModel(ggufPath, systemPrompt, userContent, customMessages, db.settings?.ggufGpuMode === true);
        summaryText = res.summary;
        activeModelUsed = res.modelUsed || path.basename(ggufPath || 'gguf');
        break;
      }
      case 'local':
      default: {
        summaryText = callLocalNlp(cues, mode, outputLang);
        engineUsed = 'local-ai';
        break;
      }
    }
  } catch (apiErr) {
    // KULLANICI AÇIKÇA BİR SAĞLAYICI SEÇTİYSE HATAYI GİZLEME
    if (provider !== 'auto') {
      console.error(`[AI Summary Error] ${provider} çağrısı başarısız oldu:`, apiErr.message);
      return {
        success: false,
        error: apiErr.message,
        provider: provider
      };
    }
    // Sadece 'auto' modunda sessizce yerel motora geç
    console.warn(`[AI Summary Auto-Fallback] ${provider} başarısız oldu, yerel NLP motoruna devrediliyor:`, apiErr.message);
    summaryText = callLocalNlp(cues, mode, outputLang);
    engineUsed = 'local-ai';
  }

// Narrative maddeleri ve paragrafları korunur

  return {
    success: true,
    summary: summaryText,
    mode: mode,
    engine: engineUsed,
    model: activeModelUsed,
    tookMs: Date.now() - t0,
    wordCount: totalWords,
    title: videoTitle
  };
}

/**
 * Kullanıcı yorumları listesini seçilen yapay zekâ motoru ile analiz edip kitle duygu ve konu özetini çıkarır.
 * @param {string} videoId 
 * @param {Array<{author: string, text: string, likeCount: string}>} comments 
 * @param {object} options 
 * @returns {Promise<{success: boolean, summary: string, engine: string, model: string, tookMs: number, commentCount: number}>}
 */
export async function generateCommentsSummary(videoId, comments = [], options = {}) {
  const t0 = Date.now();
  const db = readDb();
  const historyList = Array.isArray(db.history) ? db.history : [];
  const video = historyList.find(v => v.id === videoId || v.originalId === videoId || v.key === videoId);
  const videoTitle = video?.title || options.videoTitle || 'Video';

  if (!Array.isArray(comments) || comments.length === 0) {
    return {
      success: false,
      error: 'Özetlenecek yorum bulunamadı. Lütfen önce yorumları yükleyin.'
    };
  }

  const provider = options.provider || db.settings?.aiProvider || 'auto';

  // Yorumları beğeni sayısına göre çoktan aza sırala; böylece en etkili yorumlar başta yer alır
  const sortedComments = [...comments].sort((a, b) => {
    const bLikes = parseInt(String(b.likeCount || '').replace(/[^0-9]/g, '') || 0, 10);
    const aLikes = parseInt(String(a.likeCount || '').replace(/[^0-9]/g, '') || 0, 10);
    return bLikes - aLikes;
  });
  // Tüm yüklenmiş yorumları analize dahil et (herhangi bir yapay 30/100 sınırı olmaksızın)
  const targetComments = sortedComments;

  let outputLang = options.outputLang || options.lang || db.settings?.lang || 'tr';
  if (outputLang === 'app') {
    outputLang = db.settings?.lang || 'tr';
  }

  const totalLikes = targetComments.reduce((sum, c) => {
    return sum + (parseInt(String(c.likeCount || '').replace(/[^0-9]/g, '') || 0, 10));
  }, 0);

  // Yorumları özet içeriği için detaylı ve temiz formatla
  const formattedCommentsText = targetComments.map((c, i) => {
    const author = c.author || `İzleyici ${i + 1}`;
    const likes = (c.likeCount && c.likeCount !== '0') ? ` [👍 ${c.likeCount} Beğeni]` : '';
    const cleanText = (c.text || '').replace(/\s+/g, ' ').trim();
    return `${i + 1}. ${author}${likes}: "${cleanText}"`;
  }).join('\n');

  const langInstruction = outputLang === 'en' 
    ? 'Write the entire analysis in fluent, analytical English.' 
    : (outputLang === 'de' ? 'Verfasse die gesamte Analyse in fließendem, professionellem Deutsch.'
    : (outputLang === 'es' ? 'Escribe todo el análisis en un español analítico y profesional.'
    : (outputLang === 'pt' ? 'Escreva toda a análise em português profissional e aprofundado.'
    : (outputLang === 'ru' ? 'Напишите весь анализ на грамотном и глубоком русском языке.'
    : (outputLang === 'ar' ? 'اكتب التحليل بالكامل بلغة عربية فصحى وتحليلية عميقة.' : 'Analizin tamamını zengin, akıcı ve derinlikli bir Türkçe ile oluştur.')))));

  const systemPrompt = `Sen kıdemli bir YouTube izleyici analisti, topluluk yöneticisi ve kitle psikolojisi uzmanısın.
Görevin, bir videoya yapılan kullanıcı yorumlarını derinlemesine inceleyerek topluluğun gerçek nabzını, videonun kitle üzerinde bıraktığı etkiyi, izleyicilerin ortak paylaştığı deneyimleri ve öne çıkan yapıcı eleştirileri kapsamlı bir analiz raporu halinde sunmaktır.

${langInstruction}

Lütfen yanıtını Markdown formatında, net, profesyonel ve ilgi çekici başlıklarla tam olarak şu hiyerarşik yapıda hazırla:

### 🎭 Topluluk Hissi & Genel Değerlendirme
- **Kitle Atmosferi**: [Örn: %85 Coşkulu ve Destekleyici, %15 Merak / Yapıcı Soru Odaklı]
- **Genel Değerlendirme**: İzleyicilerin videoya genel yaklaşımını, topluluğun ortak duygu durumunu ve videodan aldıkları temel faydayı anlatan 2-3 cümlelik akıcı ve nitelikli özet.

### 💡 Öne Çıkan Ana Temalar & Ortak Görüşler
- **1. [Ana Konu Başlığı]**: İzleyicilerin bu konuda ne söylediği, ortak paylaşılan deneyimler veya takdir edilen çözümler.
- **2. [Tartışılan veya Merak Edilen Nokta]**: Çokça sorulan sorular, anlaşılmayan kısımlar veya farklı izleyici yaklaşımları.
- **3. [Videonun En Çok Etki Yaratan Kısmı]**: İzleyicilerin en çok atıfta bulunduğu bölüm, yöntem veya açıklama.

### 🏆 En Çok Beğeni (Like) Alan 3 Yorum
1. **[Kullanıcı Adı]** (👍 [Beğeni Sayısı] Beğeni): "[Tam veya en çarpıcı yorum alıntısı]"
2. **[Kullanıcı Adı]** (👍 [Beğeni Sayısı] Beğeni): "[Tam veya en çarpıcı yorum alıntısı]"
3. **[Kullanıcı Adı]** (👍 [Beğeni Sayısı] Beğeni): "[Tam veya en çarpıcı yorum alıntısı]"

### ⚡ En Çok Eleştiri / Tepki (Dislike/Kritik) Alan 3 Yorum
1. **[Kullanıcı Adı]**: "[İtiraz, eksik görülen nokta, tartışmalı görüş veya eleştiri metni]" - *(Eleştiri Nedeni / Odak)*
2. **[Kullanıcı Adı]**: "[İtiraz, eksik görülen nokta, tartışmalı görüş veya eleştiri metni]" - *(Eleştiri Nedeni / Odak)*
3. **[Kullanıcı Adı]**: "[İtiraz, eksik görülen nokta, tartışmalı görüş veya eleştiri metni]" - *(Eleştiri Nedeni / Odak)*
*(Not: Açıkça sert bir olumsuz yorum bulunmuyorsa topluluktaki en sorgulayıcı, alternatif bakış açısı sunan veya soru içeren 3 yorumu seç)*

### 🎯 Çıkarımlar & İzleyici Talepleri
- İzleyicilerin video sahibinden talep ettiği devam konuları, merak edilen ek sorular veya videoya dair yapıcı geri bildirimler.`;

  let userContent = `Aşağıda incelenmesi gereken YouTube videosuna ait izleyici yorumları yer almaktadır:

📌 Video Başlığı: "${videoTitle}"
📊 İncelenen Yorum Sayısı: ${targetComments.length}
❤️ Toplam Tespit Edilen Beğeni: ${totalLikes}

İzleyici Yorumları Listesi (En Çok Beğenilenlerden Başlayarak):
${formattedCommentsText}`;

  // Büyük yorum yığınlarında bağlam koruması (16k token ~70.000 karakter destekler)
  const maxChars = 75000;
  if (userContent.length > maxChars) {
    userContent = userContent.slice(0, maxChars) + '... [yorumlar devam ediyor]';
  }

  // Hassas anahtarları AES-256 ile deşifre et
  const geminiKey = decryptSecret(db.settings?.geminiApiKey);
  const groqKey = decryptSecret(db.settings?.groqApiKey);
  const deepseekKey = decryptSecret(db.settings?.deepseekApiKey);
  const openAiKey = decryptSecret(db.settings?.openAiApiKey);
  const lmPort = options.port || db.settings?.lmStudioPort || 1234;

  let summaryText = '';
  let engineUsed = provider;
  let activeModelUsed = options.model || '';

  // Local fallback fonksiyonu (Offline/Apisiz kural tabanlı özet)
  const generateLocalCommentsSummary = () => {
    const isEn = outputLang === 'en';
    
    // Basit anahtar kelime ve duygu analizi
    const stopWords = new Set(['ve', 'bir', 'bu', 'da', 'de', 'için', 'ile', 'çok', 'daha', 'gibi', 'kadar', 'ne', 'ya', 'ama', 'fakat', 'the', 'and', 'a', 'to', 'of', 'in', 'is', 'it', 'you', 'that', 'was', 'for', 'on', 'are', 'with', 'as', 'at']);
    const wordCounts = {};
    targetComments.forEach(c => {
      const words = (c.text || '').toLowerCase().replace(/[^a-z0-9ğüşıöç\s]/g, '').split(/\s+/);
      words.forEach(w => {
        if (w.length > 3 && !stopWords.has(w)) {
          wordCounts[w] = (wordCounts[w] || 0) + 1;
        }
      });
    });
    const topKeywords = Object.entries(wordCounts).sort((a, b) => b[1] - a[1]).slice(0, 5).map(e => `\`#${e[0]}\``).join(' ');

    const posWords = ['harika', 'süper', 'mükemmel', 'teşekkür', 'eline sağlık', 'başarılı', 'efsane', 'güzel', 'yararlı', 'faydalı', 'great', 'awesome', 'good', 'thanks', 'love', 'helpful', 'best'];
    const negWords = ['kötü', 'berbat', 'yanlış', 'ses yok', 'çalışmıyor', 'hata', 'sorun', 'bozuk', 'bad', 'worst', 'wrong', 'issue', 'problem', 'fake'];
    
    let posCount = 0;
    let negCount = 0;
    targetComments.forEach(c => {
      const lower = (c.text || '').toLowerCase();
      posWords.forEach(w => { if (lower.includes(w)) posCount++; });
      negWords.forEach(w => { if (lower.includes(w)) negCount++; });
    });

    let sentimentRatio = isEn ? '%85 Positive & Supportive, %15 Inquiries' : '%85 Olumlu & Destekleyici, %15 Soru/Merak';
    let sentimentDesc = isEn 
      ? 'The vast majority of viewers found the content highly valuable, educational, and engaging.' 
      : 'İzleyicilerin ezici çoğunluğu videoyu son derece bilgilendirici, faydalı ve kaliteli bularak teşekkürlerini iletmiştir.';
    if (negCount > posCount) {
      sentimentRatio = isEn ? '%60 Critical / Feedback, %40 Neutral' : '%60 Eleştirel / Sorun Bildiren, %40 Nötr';
      sentimentDesc = isEn 
        ? 'A notable portion of the community encountered issues or shared critical feedback on specific points.' 
        : 'İzleyici kitlesinin bir bölümü videodaki belirli adımlarda veya anlatımda sorun yaşadığını belirten geri bildirimlerde bulunmuştur.';
    } else if (negCount > 0) {
      sentimentRatio = isEn ? '%75 Supportive, %25 Constructive Inquiries' : '%75 Destekleyici, %25 Soru & Yapıcı Geri Bildirim';
      sentimentDesc = isEn 
        ? 'The community actively engaged with the video while asking insightful questions about specific details.' 
        : 'Topluluk genel olarak videoyu takdir etmekle birlikte, belirli detaylar üzerinde merak ettikleri soruları yöneltmiştir.';
    }

    // En çok beğeni alan 3 yorum
    const topLiked = targetComments.slice(0, 3);

    // En çok eleştiri, itiraz veya sorgulama içeren (dislike/kritik) 3 yorum
    const scoredCritical = targetComments
      .filter(c => !topLiked.some(tl => tl.text === c.text))
      .map(c => {
        const lower = (c.text || '').toLowerCase();
        let critScore = 0;
        negWords.forEach(w => { if (lower.includes(w)) critScore += 3; });
        if (lower.includes('?') || lower.includes('neden') || lower.includes('ama') || lower.includes('fakat') || lower.includes('keşke') || lower.includes('eksik')) critScore += 1;
        const likes = parseInt(String(c.likeCount || '').replace(/[^0-9]/g, '') || 0, 10);
        return { ...c, critScore, likes };
      })
      .sort((a, b) => b.critScore - a.critScore || a.likes - b.likes);
    
    const topCritical = scoredCritical.slice(0, 3);

    const topLikedFormatted = topLiked.map((c, i) => {
      const likesBadge = c.likeCount && c.likeCount !== '0' ? `(👍 ${c.likeCount} ${isEn ? 'likes' : 'beğeni'})` : '';
      const textPreview = (c.text || '').slice(0, 180).trim();
      return `${i + 1}. **${c.author || (isEn ? 'Viewer' : 'İzleyici')}** ${likesBadge}: "${textPreview}"`;
    }).join('\n');

    const topCriticalFormatted = topCritical.length > 0 && topCritical[0].critScore > 0
      ? topCritical.map((c, i) => {
          const textPreview = (c.text || '').slice(0, 180).trim();
          return `${i + 1}. **${c.author || (isEn ? 'Viewer' : 'İzleyici')}**: "${textPreview}"`;
        }).join('\n')
      : (isEn 
          ? '- No strong negative feedback detected; audience reception is overwhelmingly positive.' 
          : '- Belirgin bir olumsuz eleştiri tespit edilmedi; izleyici kitlesi genel olarak oldukça memnun ve destekleyici.');

    return isEn
      ? `### 🎭 Audience Sentiment & Overall Feedback\n- **Community Atmosphere**: ${sentimentRatio}\n- **Summary**: ${sentimentDesc} Analyzed **${targetComments.length}** comments with a total of **${totalLikes}** likes.\n\n### 💡 Key Discussions & Topics\n- **Core Highlights**: Viewers actively highlighted practical takeaways and appreciated the clear explanation.\n- **Frequent Keywords**: ${topKeywords || '`#video` `#content`'}\n- **Discussion Points**: Common questions revolved around application tips and further recommendations.\n\n### 🏆 Top 3 Liked Comments\n${topLikedFormatted}\n\n### ⚡ Top 3 Critical / Questioning Comments\n${topCriticalFormatted}\n\n### 🎯 Takeaways & Suggestions\n- Viewers expressed high interest in follow-up tutorials and practical demonstrations on related topics.`
      : `### 🎭 Topluluk Hissi & Genel Değerlendirme\n- **Kitle Atmosferi**: ${sentimentRatio}\n- **Genel Değerlendirme**: ${sentimentDesc} Toplam **${targetComments.length}** yorum incelenmiş ve **${totalLikes}** beğeni tespit edilmiştir.\n\n### 💡 Öne Çıkan Ana Temalar & Ortak Görüşler\n- **Öne Çıkan Vurgular**: İzleyiciler videodaki net anlatımı ve pratik ipuçlarını takdir etti.\n- **Sık Geçen Kavramlar**: ${topKeywords || '`#video` `#içerik`'}\n- **Merak Edilenler**: Yöntemin farklı senaryolarda nasıl uygulanacağı hakkında yapıcı sorular soruldu.\n\n### 🏆 En Çok Beğeni (Like) Alan 3 Yorum\n${topLikedFormatted}\n\n### ⚡ En Çok Eleştiri / Tepki (Dislike/Kritik) Alan 3 Yorum\n${topCriticalFormatted}\n\n### 🎯 Çıkarımlar & İzleyici Talepleri\n- Topluluk benzer konularda devam videoları ve detaylı uygulama rehberleri talep etmektedir.`;
  };

  try {
    switch (provider) {
      case 'lmstudio': {
        const lmModel = options.model || db.settings?.lmStudioModel || 'auto';
        try {
          const res = await callLmStudio(lmPort, lmModel, systemPrompt, userContent);
          summaryText = res.summary;
          activeModelUsed = res.modelUsed;
          engineUsed = 'lmstudio';
        } finally {
          unloadLmStudioModels();
        }
        break;
      }
      case 'groq':
      case 'groq-llama33': {
        if (!groqKey) throw new Error('Groq API anahtarı ayarlanmamış.');
        let groqPayload = userContent;
        if (groqPayload.length > 12000) {
          groqPayload = groqPayload.slice(0, 12000) + '... [metin devam ediyor]';
        }
        const res = await callGroq(groqKey, options.model, systemPrompt, groqPayload);
        summaryText = res.summary;
        activeModelUsed = res.modelUsed;
        engineUsed = 'groq';
        break;
      }
      case 'gemini': {
        if (!geminiKey) throw new Error('Gemini API anahtarı ayarlanmamış.');
        const res = await callGemini(geminiKey, systemPrompt, userContent);
        summaryText = res.summary;
        activeModelUsed = res.modelUsed;
        engineUsed = 'gemini';
        break;
      }
      case 'deepseek': {
        if (!deepseekKey && !openAiKey) throw new Error('DeepSeek API anahtarı ayarlanmamış.');
        const res = await callDeepSeek(deepseekKey || openAiKey, systemPrompt, userContent);
        summaryText = res.summary;
        activeModelUsed = res.modelUsed;
        engineUsed = 'deepseek';
        break;
      }
      case 'openai': {
        if (!openAiKey) throw new Error('OpenAI API anahtarı ayarlanmamış.');
        const res = await callOpenAi(openAiKey, systemPrompt, userContent);
        summaryText = res.summary;
        activeModelUsed = res.modelUsed;
        engineUsed = 'openai';
        break;
      }
      case 'ollama': {
        const res = await callOllama(db.settings?.ollamaPort, options.model || 'llama3', systemPrompt, userContent);
        summaryText = res.summary;
        activeModelUsed = res.modelUsed;
        engineUsed = 'ollama';
        break;
      }
      case 'gguf': {
        const requestedModel = (typeof options.model === 'string' && options.model.toLowerCase().endsWith('.gguf') && fs.existsSync(options.model)) ? options.model : '';
        const ggufPath = requestedModel || db.settings?.ggufModelPath;
        try {
          const res = await callGgufModel(ggufPath, systemPrompt, userContent, null, db.settings?.ggufGpuMode === true);
          summaryText = res.summary;
          activeModelUsed = res.modelUsed || path.basename(ggufPath || 'gguf');
          engineUsed = 'gguf';
        } catch (ggufErr) {
          console.warn('[AI Comments Summary GGUF Engine Warn, using Local NLP fallback]:', ggufErr.message);
          summaryText = generateLocalCommentsSummary();
          activeModelUsed = `GGUF (${path.basename(ggufPath || 'model')}) [NLP Yedek]`;
          engineUsed = 'gguf-fallback';
        }
        break;
      }
      case 'local': {
        summaryText = generateLocalCommentsSummary();
        engineUsed = 'local-nlp';
        break;
      }
      case 'auto':
      default: {
        let done = false;
        if (groqKey) {
          try {
            let groqPayload = userContent;
            if (groqPayload.length > 12000) groqPayload = groqPayload.slice(0, 12000) + '...';
            const res = await callGroq(groqKey, options.model, systemPrompt, groqPayload);
            summaryText = res.summary;
            activeModelUsed = res.modelUsed;
            engineUsed = 'groq';
            done = true;
          } catch (e) {
            console.warn('[Auto-Comments Groq Error, trying next]:', e.message);
          }
        }
        if (!done && geminiKey) {
          try {
            const res = await callGemini(geminiKey, systemPrompt, userContent);
            summaryText = res.summary;
            activeModelUsed = res.modelUsed;
            engineUsed = 'gemini';
            done = true;
          } catch (e) {
            console.warn('[Auto-Comments Gemini Error, trying next]:', e.message);
          }
        }
        if (!done) {
          try {
            const res = await callLmStudio(lmPort, options.model || 'auto', systemPrompt, userContent);
            summaryText = res.summary;
            activeModelUsed = res.modelUsed;
            engineUsed = 'lmstudio';
            done = true;
          } catch (e) {
            // ignore
          } finally {
            unloadLmStudioModels();
          }
        }
        if (!done) {
          summaryText = generateLocalCommentsSummary();
          engineUsed = 'local-nlp';
        }
        break;
      }
    }
  } catch (err) {
    console.warn(`[AI Comments Summary Error with ${provider}]:`, err.message);
    if (provider !== 'auto') {
      return {
        success: false,
        error: err.message,
        provider: provider
      };
    }
    summaryText = generateLocalCommentsSummary();
    engineUsed = 'local-nlp';
  }

  return {
    success: true,
    summary: summaryText,
    engine: engineUsed,
    model: activeModelUsed,
    tookMs: Date.now() - t0,
    commentCount: targetComments.length,
    title: videoTitle
  };
}
