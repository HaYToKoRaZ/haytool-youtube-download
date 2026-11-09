/**
 * HaYTooL YouTube Downloader - Video Yapay Zekâ Özeti Modülü
 * public/modules/videoSummary.js
 * 
 * Sorumluluklar:
 *   - Video altyazısından AI destekli özet alma (/api/video/:id/ai-summary)
 *   - İki mod desteği:
 *       1) 'narrative' (Süresiz Tam Özet): Kesintisiz, başlıksız ve maddesiz akıcı paragraflar.
 *       2) 'timestamped' (Süreli Anlar): [mm:ss] zaman damgalı, tıklanabilir atlama butonları.
 *   - LM Studio (yerel port + dinamik model seçimi), Groq, Gemini, DeepSeek, OpenAI, Ollama ve dahili yerel NLP
 *   - Özet panelini açma / kapama ve durum kontrolü
 *   - Panoya temiz kopyalama ve video zamanına sarma (seek)
 * 
 * Yapımcı: HaYTo
 * İletişim: korazhayto@gmail.com
 */

import { escapeHtml } from '../utils/helpers.js';
import { toastSuccess, toastError, toastWarning, toastInfo } from '../components/toast.js';

let currentSummaryVideoId = null;
let currentSummaryData = null;
let isSummaryLoading = false;
// Bekleyen özet isteğini iptal etmek için kullanılan AbortController (yeni istek eskiyi devralır)
let summaryAbortController = null;

// ── Sesli Okuma (Piper TTS) durumu ──
let ttsAvailable = null;   // null = henüz sorgulanmadı; true/false = motor+ses durumu (önbellek)
let speakBusy = false;     // sentez sürüyor mu
let speakAbortController = null;
let summaryAudioHooksInit = false;

// ── AI Sağlayıcı Seçici UI Yönetimi (Kapalıyken kısa & ferah, açıldığında detaylı) ──
const SUMMARY_PROVIDER_LABELS = {
  tr: {
    auto: { short: '⚡ Otomatik', full: '⚡ Otomatik (Önerilen)' },
    lmstudio: { short: '🖥️ LM Studio', full: '🖥️ LM Studio (Yerel & Ücretsiz)' },
    groq: { short: '🚀 Groq', full: '🚀 Groq (Llama 3.3 - Hızlı)' },
    gemini: { short: '✨ Gemini', full: '✨ Gemini Flash (Google - Hızlı)' },
    deepseek: { short: '🐋 DeepSeek', full: '🐋 DeepSeek (En Ucuz API)' },
    ollama: { short: '🦙 Ollama', full: '🦙 Ollama (Yerel)' },
    openai: { short: '🤖 OpenAI', full: '🤖 OpenAI (GPT-4o-mini)' },
    gguf: { short: '📁 GGUF', full: '📁 Yerel GGUF Modeli' },
    local: { short: '🧠 Yerel NLP', full: '🧠 Yerel NLP (Apisiz - Kural Tabanlı)' }
  },
  en: {
    auto: { short: '⚡ Auto', full: '⚡ Auto (Recommended)' },
    lmstudio: { short: '🖥️ LM Studio', full: '🖥️ LM Studio (Local & Free)' },
    groq: { short: '🚀 Groq', full: '🚀 Groq (Llama 3.3 - Fast)' },
    gemini: { short: '✨ Gemini', full: '✨ Gemini Flash (Google - Fast)' },
    deepseek: { short: '🐋 DeepSeek', full: '🐋 DeepSeek (Lowest Cost API)' },
    ollama: { short: '🦙 Ollama', full: '🦙 Ollama (Local)' },
    openai: { short: '🤖 OpenAI', full: '🤖 OpenAI (GPT-4o-mini)' },
    gguf: { short: '📁 GGUF', full: '📁 Local GGUF Model' },
    local: { short: '🧠 Local NLP', full: '🧠 Local NLP (Offline - Rule Based)' }
  }
};

let summaryProviderSelectInit = false;

export function initSummaryProviderSelect() {
  const select = document.getElementById('summary-provider-select');
  if (!select) return;

  const getLang = () => (window.localDb?.settings?.lang === 'en' ? 'en' : 'tr');

  const setLabels = (mode = 'short') => {
    const lang = getLang();
    const map = SUMMARY_PROVIDER_LABELS[lang] || SUMMARY_PROVIDER_LABELS.tr;
    Array.from(select.options).forEach(opt => {
      const item = map[opt.value];
      if (item) {
        opt.textContent = mode === 'full' ? item.full : item.short;
      }
    });
  };

  setLabels('short');

  if (!summaryProviderSelectInit) {
    summaryProviderSelectInit = true;

    // Tıklanıp liste açıldığında detaylı tercihleri göster
    select.addEventListener('focus', () => setLabels('full'));
    select.addEventListener('mousedown', () => setLabels('full'));
    select.addEventListener('pointerdown', () => setLabels('full'));

    // Liste kapandığında veya seçim yapıldığında kompakt başlığa dön
    select.addEventListener('change', () => setLabels('short'));
    select.addEventListener('blur', () => setLabels('short'));
  }
}

/**
 * AI Özet panelini açar veya kapatır.
 */

let currentSelectedSubLang = 'auto';

/**
 * Belirtilen videoya ait diskteki altyazı dosyalarını çeker ve seçim kutusunu doldurur.
 */
export async function loadAvailableSubtitlesForSummary(videoId) {
  const select = document.getElementById('summary-subtitle-lang-select');
  const wrap = document.getElementById('summary-subtitle-lang-wrap');
  if (!select) return;

  select.innerHTML = '<option value="auto">🌐 Otomatik Altyazı</option>';
  if (!videoId) return;

  try {
    const res = await fetch(`/api/video/${encodeURIComponent(videoId)}/subtitles`);
    const data = await res.json();
    if (data.success && Array.isArray(data.subtitles) && data.subtitles.length > 0) {
      let opts = '<option value="auto">🌐 Otomatik Altyazı</option>';
      data.subtitles.forEach(s => {
        const isSelected = s.lang === currentSelectedSubLang ? ' selected' : '';
        opts += `<option value="${escapeHtml(s.lang)}"${isSelected}>${escapeHtml(s.label || s.lang)} (${s.lang})</option>`;
      });
      select.innerHTML = opts;
      if (wrap) wrap.style.display = 'inline-flex';
    } else {
      if (wrap) wrap.style.display = 'inline-flex';
    }
  } catch (err) {
    console.warn('[Subtitles Fetch Warn]:', err);
  }
}

/**
 * Kaynak altyazı dili değiştiğinde çalışır.
 */
export async function onSummarySubtitleLangChange(newSubLang) {
  currentSelectedSubLang = newSubLang || 'auto';
  await regenerateSummary();
}

const LANG_FLAG_SRC = {
  tr: 'flags/tr.png',
  en: 'flags/gb.png',
  de: 'flags/de.png',
  es: 'flags/es.png',
  pt: 'flags/pt.png',
  ru: 'flags/ru.png',
  ar: 'flags/sa.png'
};

let summaryFlagClickOutsideInit = false;

export function updateSummaryOutputLangUI(lang) {
  const currentSpan = document.getElementById('summary-output-lang-current');
  const hiddenInput = document.getElementById('summary-output-lang-select');
  const dropdown = document.getElementById('summary-flag-dropdown');
  const effectiveLang = lang || (hiddenInput && hiddenInput.value) || localStorage.getItem('haytool_summary_out_lang') || 'app';

  if (hiddenInput) hiddenInput.value = effectiveLang;

  if (currentSpan) {
    if (effectiveLang === 'app' || !LANG_FLAG_SRC[effectiveLang]) {
      currentSpan.innerHTML = '<i data-lucide="globe" style="width: 13px; height: 13px; color: #a855f7;"></i>';
      if (window.lucide && typeof window.lucide.createIcons === 'function') {
        window.lucide.createIcons({ root: currentSpan });
      }
    } else {
      currentSpan.innerHTML = `<img src="${LANG_FLAG_SRC[effectiveLang]}" alt="${effectiveLang.toUpperCase()}" class="summary-flag-img">`;
    }
  }

  if (dropdown) {
    dropdown.querySelectorAll('.summary-flag-item').forEach(btn => {
      if (btn.getAttribute('data-lang') === effectiveLang) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
  }
}

export function toggleSummaryFlagDropdown(e) {
  if (e) e.stopPropagation();
  const dropdown = document.getElementById('summary-flag-dropdown');
  if (!dropdown) return;
  const isShown = dropdown.style.display !== 'none';
  dropdown.style.display = isShown ? 'none' : 'grid';

  if (!summaryFlagClickOutsideInit) {
    summaryFlagClickOutsideInit = true;
    document.addEventListener('click', (ev) => {
      const wrap = document.getElementById('summary-output-lang-wrap');
      if (wrap && !wrap.contains(ev.target)) {
        const dd = document.getElementById('summary-flag-dropdown');
        if (dd) dd.style.display = 'none';
      }
    });
  }
}

export async function selectSummaryOutputLang(lang) {
  const dropdown = document.getElementById('summary-flag-dropdown');
  if (dropdown) dropdown.style.display = 'none';
  updateSummaryOutputLangUI(lang);
  await onSummaryOutputLangChange(lang);
}

/**
 * Özet çıktı dili değiştiğinde çalışır.
 */
export async function onSummaryOutputLangChange(newOutLang) {
  localStorage.setItem('haytool_summary_out_lang', newOutLang || 'app');
  await regenerateSummary();
}

export async function toggleSummaryPanel() {
  const container = document.getElementById('inline-player-summary-container');
  const btn = document.getElementById('inline-btn-summary');
  if (!container) return;

  const isHidden = container.classList.contains('hidden');
  const isEn = window.localDb?.settings?.lang === 'en';

  // Ayarlardaki varsayılan sağlayıcıyı seç
  const providerSelect = document.getElementById('summary-provider-select');
  const currentProvider = window.localDb?.settings?.aiProvider || 'auto';
  if (providerSelect) {
    providerSelect.value = currentProvider;
  }
  initSummaryProviderSelect();
  updateLmStudioModelWrapVisibility(currentProvider);

  // Hafızadaki özet modunu seç (narrative | timestamped)
  const modeSelect = document.getElementById('summary-mode-select');
  if (modeSelect) {
    const savedMode = localStorage.getItem('haytool_summary_mode') || 'narrative';
    modeSelect.value = savedMode;
  }

  if (isHidden) {
    container.classList.remove('hidden');
    if (btn) {
      btn.classList.add('active');
      btn.title = isEn ? 'Hide AI Summary' : 'Yapay Zekâ Özetini Gizle';
    }

    if (currentProvider === 'lmstudio') {
      await refreshLmStudioModelsInSummary();
    }

    if (currentProvider === 'gguf') {
      await refreshGgufModelsInSummary();
    }

    const targetVideoId = window.currentPlayingVideoId;

    const outSelect = document.getElementById('summary-output-lang-select');
    if (outSelect) {
      outSelect.value = localStorage.getItem('haytool_summary_out_lang') || 'app';
    }
    updateSummaryOutputLangUI(outSelect ? outSelect.value : 'app');

    if (window.lucide && typeof window.lucide.createIcons === 'function') {
      window.lucide.createIcons({ root: container });
    }

    await loadAvailableSubtitlesForSummary(targetVideoId);

    // Eğer video değişmişse veya henüz özet çekilmemişse API'den getir
    if (!currentSummaryData || currentSummaryVideoId !== targetVideoId) {
      await fetchAndRenderSummary(targetVideoId);
    }
  } else {
    container.classList.add('hidden');
    if (btn) {
      btn.classList.remove('active');
      btn.title = isEn ? 'Generate AI Summary' : 'Yapay Zekâ ile Özet Çıkar';
    }
  }
}

/**
 * Özet kutusundaki model seçim açılır menülerinin (LM Studio / GGUF) görünürlüğünü yönetir.
 */
function updateLmStudioModelWrapVisibility(provider) {
  const wrap = document.getElementById('summary-lmstudio-model-wrap');
  if (wrap) {
    wrap.style.display = provider === 'lmstudio' ? 'inline-flex' : 'none';
  }
  const ggufWrap = document.getElementById('summary-gguf-model-wrap');
  if (ggufWrap) {
    ggufWrap.style.display = provider === 'gguf' ? 'inline-flex' : 'none';
  }
}

/**
 * LM Studio'daki modelleri sunucudan çekip özet kutusundaki model menüsüne doldurur.
 */
export async function refreshLmStudioModelsInSummary() {
  const select = document.getElementById('summary-lmstudio-model-select');
  if (!select) return;

  const port = window.localDb?.settings?.lmStudioPort || 1234;
  try {
    const res = await fetch(`/api/lmstudio/models?port=${encodeURIComponent(port)}`);
    const data = await res.json();
    if (data.success && Array.isArray(data.models) && data.models.length > 0) {
      const savedModel = window.localDb?.settings?.lmStudioModel || '';
      let opts = `<option value="auto">⚡ Otomatik (${data.models[0]})</option>`;
      data.models.forEach(m => {
        const isSelected = m === savedModel ? ' selected' : '';
        opts += `<option value="${escapeHtml(m)}"${isSelected}>${escapeHtml(m)}</option>`;
      });
      select.innerHTML = opts;
    }
  } catch (err) {
    console.warn('[LM Studio Models Fetch Warn]:', err);
  }
}

/**
 * Seçili model klasöründeki .gguf modellerini sunucudan çekip özet kutusundaki GGUF model menüsüne doldurur.
 */
export async function refreshGgufModelsInSummary() {
  const select = document.getElementById('summary-gguf-model-select');
  if (!select) return;

  const t = window.translations?.[window.localDb?.settings?.lang || 'tr'] || window.translations?.tr || {};
  const settings = window.localDb?.settings || {};
  const savedPath = settings.ggufModelPath || '';
  let dir = (settings.ggufModelsDir || '').trim();
  if (!dir && savedPath) dir = savedPath.replace(/[\\/][^\\/]*$/, '');

  try {
    const res = await fetch(`/api/gguf/models?dir=${encodeURIComponent(dir)}`);
    const data = await res.json();
    if (data.success && Array.isArray(data.models) && data.models.length > 0) {
      let opts = '';
      data.models.forEach(m => {
        const isSelected = m.path === savedPath ? ' selected' : '';
        const sizeStr = m.sizeMB >= 1024
          ? (m.sizeMB / 1024).toFixed(1) + ' GB'
          : (m.sizeMB > 0 ? m.sizeMB + ' MB' : '');
        const label = sizeStr ? `[${sizeStr}] ${m.name}` : m.name;
        opts += `<option value="${escapeHtml(m.path)}"${isSelected} title="${escapeHtml(m.path)}">${escapeHtml(label)}</option>`;
      });
      select.innerHTML = opts;
    } else {
      select.innerHTML = `<option value="none">${escapeHtml(t.summary_gguf_pick_folder || '⚠️ Ayarlar\'dan model klasörü seçin')}</option>`;
    }
  } catch (err) {
    console.warn('[GGUF Models Summary Fetch Warn]:', err);
  }
}

/**
 * Sunucudan belirtilen videonun altyazı özetini çeker ve paneli render eder.
 * @param {string} videoId - Hedef video ID'si
 * @param {boolean} [forceRefresh=false] - Önbelleği atlayıp yeni API ile taze özet çıkarır
 */
export async function fetchAndRenderSummary(videoId, forceRefresh = false) {
  if (!videoId) return;

  const loadingEl = document.getElementById('summary-loading');
  const emptyEl = document.getElementById('summary-empty');
  const contentEl = document.getElementById('summary-content-body');
  const metaBadge = document.getElementById('summary-engine-badge');
  const wordCountEl = document.getElementById('summary-word-count-text');
  const btn = document.getElementById('inline-btn-summary');

  // Yeni özet başlıyor: sesli okumayı durdur (hem ses hem süren piper.exe varsa)
  stopSpeakPlayback();

  // Yeni istek eskiyi iptal eder: bekleyen fetch abort edilir, sunucudaki llama-cli süreci anında öldürülür
  if (isSummaryLoading && summaryAbortController) {
    try { summaryAbortController.abort(); } catch (_) {}
    fetch('/api/llama/stop', { method: 'POST' }).catch(() => {});
  }
  const myController = new AbortController();
  summaryAbortController = myController;
  isSummaryLoading = true;
  currentSummaryVideoId = videoId;

  const statusChip = document.getElementById('summary-status-chip');
  const progressBar = document.getElementById('summary-progress-bar');
  const elapsedChip = document.getElementById('summary-elapsed-chip');

  if (btn) btn.classList.add('loading');
  if (loadingEl) loadingEl.style.display = 'flex';
  if (statusChip) statusChip.style.display = 'inline-flex';
  if (progressBar) progressBar.style.display = 'block';
  if (emptyEl) emptyEl.style.display = 'none';
  if (contentEl) contentEl.style.display = 'none';
  if (metaBadge) metaBadge.style.display = 'none';
  if (wordCountEl) wordCountEl.style.display = 'none';
  if (elapsedChip) elapsedChip.style.display = 'none';

  try {
    const providerSelect = document.getElementById('summary-provider-select');
    const chosenProvider = (providerSelect && providerSelect.value) || window.localDb?.settings?.aiProvider || 'auto';

    const modeSelect = document.getElementById('summary-mode-select');
    const chosenMode = (modeSelect && modeSelect.value) || localStorage.getItem('haytool_summary_mode') || 'narrative';

    const modelSelect = document.getElementById('summary-lmstudio-model-select');
    const chosenModel = (modelSelect && modelSelect.value !== 'auto') ? modelSelect.value : (window.localDb?.settings?.lmStudioModel || '');

    const ggufModelSelect = document.getElementById('summary-gguf-model-select');
    const chosenGgufModel = (ggufModelSelect && ggufModelSelect.value && ggufModelSelect.value !== 'none')
      ? ggufModelSelect.value
      : (window.localDb?.settings?.ggufModelPath || '');

    const lmPort = window.localDb?.settings?.lmStudioPort || 1234;
    const currentAppLang = window.localDb?.settings?.lang || localStorage.getItem('haytool_lang') || 'tr';

    const subLangSelect = document.getElementById('summary-subtitle-lang-select');
    const chosenSubLang = (subLangSelect && subLangSelect.value) || currentSelectedSubLang || 'auto';

    const outLangSelect = document.getElementById('summary-output-lang-select');
    const chosenOutLang = (outLangSelect && outLangSelect.value) || localStorage.getItem('haytool_summary_out_lang') || 'app';

    const queryParts = [
      'provider=' + encodeURIComponent(chosenProvider),
      'mode=' + encodeURIComponent(chosenMode),
      'lang=' + encodeURIComponent(currentAppLang),
      'subLang=' + encodeURIComponent(chosenSubLang),
      'outputLang=' + encodeURIComponent(chosenOutLang),
      'port=' + encodeURIComponent(lmPort)
    ];

    if (chosenProvider === 'gguf') {
      // GGUF: seçili tam model yolu sunucuya taşınır (ayar kaydıyla yarış koşmasını engeller)
      if (chosenGgufModel) {
        queryParts.push('model=' + encodeURIComponent(chosenGgufModel));
      }
    } else if (chosenModel && chosenModel !== 'auto') {
      queryParts.push('model=' + encodeURIComponent(chosenModel));
    }

    if (forceRefresh) {
      queryParts.push('forceRefresh=true');
      queryParts.push('_t=' + Date.now());
    }

    // GGUF sağlayıcısında önce olası eski llama-cli çalışması öldürülür (en yeni istek her zaman kazanır)
    if (chosenProvider === 'gguf') {
      fetch('/api/llama/stop', { method: 'POST' }).catch(() => {});
    }

    const url = `/api/video/${videoId}/ai-summary?${queryParts.join('&')}`;
    const res = await fetch(url, { signal: myController.signal });
    const data = await res.json();

    if (data.success) {
      currentSummaryData = data;
      renderSummaryUI(data);
    } else {
      currentSummaryData = null;
      if (emptyEl) {
        emptyEl.style.display = 'block';
        const errorMsg = data.error || 'Özet oluşturulamadı.';
        emptyEl.innerHTML = `
          <div style="color: #f87171; font-weight: 600; margin-bottom: 8px; font-size: 0.88rem;">
            ⚠️ ${escapeHtml(errorMsg)}
          </div>
          <div style="display: flex; gap: 8px; justify-content: center; align-items: center; margin-top: 10px;">
            <button type="button" class="btn btn-secondary btn-xs" onclick="useFallbackLocalNlp()" style="font-size: 0.78rem; padding: 4px 10px;">
              🧠 Apisiz Dahili NLP ile Özetle
            </button>
            <button type="button" class="btn btn-secondary btn-xs" onclick="regenerateSummary()" style="font-size: 0.78rem; padding: 4px 10px;">
              🔄 Tekrar Dene
            </button>
          </div>
        `;
      }
    }
  } catch (err) {
    if (err && err.name === 'AbortError') {
      // Yeni bir özet isteği bu isteği devraldı: hata göstermeden sessizce çık
      return;
    }
    console.error('[AI Summary Fetch Error]:', err);
    currentSummaryData = null;
    if (emptyEl) {
      emptyEl.style.display = 'block';
      emptyEl.innerHTML = `
        <div style="color: #f87171; font-size: 0.85rem;">
          ⚠️ Bağlantı hatası: ${escapeHtml(err.message)}
        </div>
        <button type="button" class="btn btn-secondary btn-xs" onclick="useFallbackLocalNlp()" style="margin-top: 8px;">
          🧠 Apisiz Dahili NLP ile Özetle
        </button>
      `;
    }
  } finally {
    // Sadece en güncel istek durumları sıfırlar; iptal edilen eski istek yeni isteğin UI'ını bozamaz
    if (summaryAbortController === myController) {
      isSummaryLoading = false;
      summaryAbortController = null;
      if (btn) btn.classList.remove('loading');
      if (loadingEl) loadingEl.style.display = 'none';
      if (statusChip) statusChip.style.display = 'none';
      if (progressBar) progressBar.style.display = 'none';
    }
  }
}

/**
 * Çekilen özet verisini HTML kartı içerisine formatlar.
 * @param {object} data - Sunucudan dönen özet nesnesi
 */
export function renderSummaryUI(data) {
  if (ttsAvailable === null) refreshTtsAvailability();
  // Yeni özet render ediliyor: eski özetin sesi geçersiz kılınır (bayat ses çalınmasını engeller)
  const staleAudio = document.getElementById('summary-audio-el');
  if (staleAudio) {
    stopSpeakPlayback();
    try { staleAudio.removeAttribute('src'); staleAudio.load(); } catch (_) {}
    staleAudio.dataset.ready = '';
  }
  const contentEl = document.getElementById('summary-content-body');
  const emptyEl = document.getElementById('summary-empty');
  const metaBadge = document.getElementById('summary-engine-badge');
  const wordCountEl = document.getElementById('summary-word-count-text');
  const isEn = window.localDb?.settings?.lang === 'en';

  if (!contentEl) return;
  if (emptyEl) emptyEl.style.display = 'none';
  contentEl.style.display = 'flex';

  // Sağlayıcı Rozeti
  if (metaBadge) {
    metaBadge.style.display = 'inline-flex';
    let badgeText = '';
    const modelTag = data.model ? ` (${data.model})` : '';

    if (data.engine === 'lmstudio' || data.provider === 'lmstudio') {
      badgeText = `🖥️ LM Studio${modelTag}`;
    } else if (data.engine === 'gguf' || data.provider === 'gguf') {
      badgeText = `📁 Yerel GGUF${modelTag}`;
    } else if (data.engine === 'groq' || data.provider === 'groq') {
      badgeText = `🚀 Groq${modelTag}`;
    } else if (data.engine === 'gemini' || data.provider === 'gemini') {
      badgeText = `✨ Gemini${modelTag}`;
    } else if (data.engine === 'deepseek' || data.provider === 'deepseek') {
      badgeText = `🐋 DeepSeek${modelTag}`;
    } else if (data.engine === 'openai' || data.provider === 'openai') {
      badgeText = `🤖 OpenAI${modelTag}`;
    } else if (data.engine === 'ollama' || data.provider === 'ollama') {
      badgeText = `🦙 Ollama${modelTag}`;
    } else {
      badgeText = `🧠 Yerel NLP (APİSİZ)`;
    }
    metaBadge.textContent = badgeText;
  }

  // Kelime ve Kaynak Bilgisi
  if (wordCountEl && data.wordCount) {
    const suffix = isEn ? 'words analyzed' : 'kelimelik altyazı işlendi';
    wordCountEl.textContent = `${data.wordCount} ${suffix}`;
    wordCountEl.style.display = 'inline-flex';
  }

  // Üretim Süresi Rozeti (dahili yerel NLP hariç)
  const elapsedChip = document.getElementById('summary-elapsed-chip');
  if (elapsedChip) {
    const t = window.translations?.[window.localDb?.settings?.lang || 'tr'] || window.translations?.tr || {};
    if (data.tookMs && data.tookMs > 500 && data.engine !== 'local-ai') {
      elapsedChip.textContent = `⏱ ${(data.tookMs / 1000).toFixed(1)} ${t.summary_gen_seconds || 'sn'}`;
      elapsedChip.style.display = 'inline-flex';
    } else {
      elapsedChip.style.display = 'none';
    }
  }

  const mode = data.mode || 'narrative';

  // ==========================================
  // MOD 1: SÜRESİZ TAM ÖZET (NARRATIVE)
  // Katı kural: Başlık yok, madde imi yok. Akıcı, kesintisiz paragraflar.
  // ==========================================
  if (mode === 'narrative') {
    let formattedHtml = '';

    if (data.summary) {
      const rawText = data.summary.trim();
      const blocks = rawText.split(/\n\s*\n/);

      formattedHtml = blocks.map(block => {
        const lines = block.split('\n').map(l => l.trim()).filter(Boolean);

        // Başlık blokları (Örn: **Özet:**, **Kritik Noktalar:**, ## Başlık)
        if (lines.length === 1 && (/^#{1,4}\s+/.test(lines[0]) || /^\*\*[^*]+\*\*:?$/.test(lines[0]))) {
          const headerText = lines[0].replace(/^#{1,4}\s+/, '').replace(/^\*\*|\*\*:?$/g, '');
          return `<div style="font-weight: 700; font-size: 0.95rem; color: #c084fc; margin: 14px 0 6px 0; border-bottom: 1px dashed rgba(168,85,247,0.25); padding-bottom: 4px;">${escapeHtml(headerText)}</div>`;
        }

        // Liste blokları (1. Madde, * Madde, - Madde, • Madde)
        const isList = lines.some(l => /^(\d+\.|[-*•])\s+/.test(l));
        if (isList) {
          const listItems = lines.map(line => {
            const isItem = /^(\d+\.|[-*•])\s+/.test(line);
            if (isItem) {
              const numMatch = line.match(/^(\d+)\.\s+/);
              const clean = line.replace(/^(\d+\.|[-*•])\s+/, '').trim();
              const withBold = escapeHtml(clean).replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
              const badge = numMatch 
                ? `<span style="display: inline-flex; align-items: center; justify-content: center; width: 18px; height: 18px; border-radius: 50%; background: rgba(168, 85, 247, 0.2); color: #c084fc; font-size: 0.72rem; font-weight: 700; margin-right: 6px; flex-shrink: 0;">${numMatch[1]}</span>`
                : `<span style="color: #a855f7; margin-right: 6px; font-size: 1rem;">•</span>`;
              return `<li style="margin-bottom: 8px; line-height: 1.6; color: var(--text-main); font-size: 0.88rem; display: flex; align-items: baseline;">${badge}<span>${withBold}</span></li>`;
            } else {
              return `<div style="margin-bottom: 6px; line-height: 1.6; font-size: 0.88rem;">${escapeHtml(line)}</div>`;
            }
          }).join('');
          return `<ul style="margin: 8px 0 14px 0; padding: 0; list-style: none;">${listItems}</ul>`;
        }

        // Normal giriş paragrafları
        const cleanPara = escapeHtml(block)
          .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
          .replace(/\n/g, '<br>');
        return `<p class="summary-paragraph" style="line-height: 1.75; font-size: 0.90rem; color: var(--text-main); margin: 0 0 12px 0; text-align: justify;">${cleanPara}</p>`;
      }).join('');
    }

    if (!formattedHtml) {
      formattedHtml = '<div class="text-muted">Bu video için özet oluşturulamadı.</div>';
    }

    contentEl.innerHTML = `
      <div class="summary-narrative-container" style="background: rgba(255, 255, 255, 0.02); padding: 14px 16px; border-radius: 8px; border: 1px solid var(--border-color);">
        ${formattedHtml}
      </div>
    `;
    return;
  }

  // ==========================================
  // MOD 2: SÜRELİ ANLAR (TIMESTAMPED)
  // Tıklanabilir [mm:ss] zaman hapları
  // ==========================================
  if (mode === 'timestamped') {
    let itemsHtml = '';

    if (data.summary) {
      let formatted = escapeHtml(data.summary)
        // [01:23] veya (01:23) butonlaştır
        .replace(/(?:\[|\()(\d{1,2}:\d{2}(?::\d{2})?)(?:\]|\))/g, '<button type="button" class="summary-time-pill" onclick="seekSummaryVideo(\'$1\')" title="Videoyu bu süreye sar: $1">⏱️ $1</button>')
        // Satır başındaki 01:23 butonlaştır
        .replace(/(?:^|\n)\s*[-*•]?\s*(\d{1,2}:\d{2}(?::\d{2})?)\s*[-:–]?\s*/g, '\n<button type="button" class="summary-time-pill" onclick="seekSummaryVideo(\'$1\')" title="Videoyu bu süreye sar: $1">⏱️ $1</button> ')
        // Metin içindeki açıkta kalan dd:ss butonlaştır (eğer buton içinde değilse)
        .replace(/\b(\d{1,2}:\d{2}(?::\d{2})?)\b/g, (m, p1, offset, str) => {
          const pre = str.slice(Math.max(0, offset - 30), offset);
          if (pre.includes('seekSummaryVideo')) return m;
          return `<button type="button" class="summary-time-pill" onclick="seekSummaryVideo('${p1}')" title="Videoyu bu süreye sar: ${p1}">⏱️ ${p1}</button>`;
        })
        .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
        .replace(/^##\s+(.*$)/gim, '<div style="font-weight: 700; font-size: 0.95rem; color: #c084fc; margin-top: 10px; margin-bottom: 4px;">$1</div>')
        .replace(/^\*\s+(.*$)/gim, '<div style="display: flex; gap: 8px; margin-bottom: 4px; align-items: baseline;"><span>•</span><span>$1</span></div>')
        .replace(/^- (.*$)/gim, '<div style="display: flex; gap: 8px; margin-bottom: 4px; align-items: baseline;"><span>•</span><span>$1</span></div>')
        .replace(/\n/g, '<br>');

      itemsHtml = `<div style="line-height: 1.7; font-size: 0.88rem; color: var(--text-main);">${formatted}</div>`;
    }

    contentEl.innerHTML = `
      <div class="summary-timestamped-container" style="display: flex; flex-direction: column; gap: 8px;">
        ${itemsHtml || '<div class="text-muted">Zaman damgalı an bulunamadı.</div>'}
      </div>
    `;

    if (window.lucide && typeof window.lucide.createIcons === 'function') {
      window.lucide.createIcons({ root: contentEl });
    }

    if (contentEl && !contentEl._hasTimePillDelegate) {
      contentEl._hasTimePillDelegate = true;
      contentEl.addEventListener('click', (e) => {
        const btn = e.target.closest('.summary-time-pill');
        if (btn) {
          e.preventDefault();
          const t = btn.getAttribute('data-seek-time') || btn.textContent.replace(/[^\d:]/g, '');
          if (t && typeof window.seekSummaryVideo === 'function') {
            window.seekSummaryVideo(t);
          }
        }
      });
    }
  }
}

/**
 * Özet kutusundaki özet modu değiştiğinde (Süresiz / Süreli) çalışır.
 * @param {string} newMode - 'narrative' | 'timestamped'
 */
export async function onSummaryModeChange(newMode) {
  localStorage.setItem('haytool_summary_mode', newMode);
  await regenerateSummary();
}

/**
 * Özet kutusundaki AI motor seçimi değiştiğinde çalışır.
 * @param {string} newProvider
 */
export async function onSummaryProviderChange(newProvider) {
  if (window.localDb && window.localDb.settings) {
    window.localDb.settings.aiProvider = newProvider;
  }
  const settingsSelect = document.getElementById('settings-ai-provider');
  if (settingsSelect) settingsSelect.value = newProvider;

  updateLmStudioModelWrapVisibility(newProvider);

  if (newProvider === 'lmstudio') {
    await refreshLmStudioModelsInSummary();
  }

  if (newProvider === 'gguf') {
    await refreshGgufModelsInSummary();
  }

  if (typeof window.triggerAutoSave === 'function') {
    window.triggerAutoSave(true);
  }

  await regenerateSummary();
}

/**
 * LM Studio model seçimi değiştiğinde çalışır.
 */
export async function onSummaryModelChange(newModel) {
  if (window.localDb && window.localDb.settings) {
    window.localDb.settings.lmStudioModel = newModel;
  }
  const settingsModelInput = document.getElementById('settings-lmstudio-model');
  if (settingsModelInput) settingsModelInput.value = newModel === 'auto' ? '' : newModel;

  if (typeof window.triggerAutoSave === 'function') {
    window.triggerAutoSave(true);
  }

  await regenerateSummary();
}

/**
 * Özet kutusundaki GGUF model seçimi değiştiğinde çalışır: ayarı günceller, kaydeder ve özeti yeni modelle üretir.
 * @param {string} newPath - Seçilen .gguf dosyasının tam yolu
 */
export async function onSummaryGgufModelChange(newPath) {
  if (!newPath || newPath === 'none') return;
  if (window.localDb && window.localDb.settings) {
    window.localDb.settings.ggufModelPath = newPath;
  }
  const settingsPathInput = document.getElementById('settings-gguf-model-path');
  if (settingsPathInput) settingsPathInput.value = newPath;
  const settingsModelSelect = document.getElementById('settings-gguf-model-select');
  if (settingsModelSelect && Array.from(settingsModelSelect.options).some(o => o.value === newPath)) {
    settingsModelSelect.value = newPath;
  }

  if (typeof window.triggerAutoSave === 'function') {
    window.triggerAutoSave(true);
  }

  await regenerateSummary();
}

/**
 * Kullanıcı hata aldığında tek tıkla yerel apisiz NLP özetine geçer.
 */
export async function useFallbackLocalNlp() {
  const providerSelect = document.getElementById('summary-provider-select');
  if (providerSelect) providerSelect.value = 'local';
  await onSummaryProviderChange('local');
}

/**
 * Mevcut özet verisini sıfırlayıp taze özet oluşturur.
 */
export async function regenerateSummary() {
  const videoId = window.currentPlayingVideoId || currentSummaryVideoId;
  if (!videoId) return;

  currentSummaryData = null;
  const regenBtn = document.getElementById('summary-btn-regenerate');
  if (regenBtn) {
    const icon = regenBtn.querySelector('i');
    if (icon) icon.classList.add('animate-spin');
  }

  await fetchAndRenderSummary(videoId, true);

  if (regenBtn) {
    const icon = regenBtn.querySelector('i');
    if (icon) icon.classList.remove('animate-spin');
  }
}

/**
 * Mevcut özeti temiz bir metin olarak panoya kopyalar.
 */
export function copySummaryText() {
  if (!currentSummaryData) return;
  const isEn = window.localDb?.settings?.lang === 'en';

  let textToCopy = '';
  const mode = currentSummaryData.mode || 'narrative';

  if (mode === 'narrative') {
    if (Array.isArray(currentSummaryData.paragraphs) && currentSummaryData.paragraphs.length > 0) {
      textToCopy = currentSummaryData.paragraphs.join('\n\n');
    } else if (currentSummaryData.summary) {
      textToCopy = currentSummaryData.summary
        .replace(/^#{1,6}\s*(.*)$/gm, '$1')
        .replace(/^\s*[\*\-•]\s+/gm, '')
        .trim();
    }
  } else if (mode === 'timestamped') {
    textToCopy = currentSummaryData.summary || '';
  }

  if (!textToCopy) {
    textToCopy = currentSummaryData.summary || '';
  }

  navigator.clipboard.writeText(textToCopy).then(() => {
    toastSuccess(isEn ? 'Summary copied to clipboard!' : 'Özet panoya kopyalandı!');
  }).catch(() => {
    toastInfo(isEn ? 'Could not copy summary.' : 'Özet kopyalanamadı.');
  });
}

// ── Sesli Okuma (Piper TTS): Özeti Dinle ──────────────────────────────

/**
 * Mevcut özetten seslendirilecek düz metni üretir (copySummaryText ile aynı mantık).
 * @returns {string} Okunacak düz metin
 */
function getSummarySpeakText() {
  if (!currentSummaryData) return '';
  const mode = currentSummaryData.mode || 'narrative';
  let text = '';
  if (mode === 'narrative') {
    if (Array.isArray(currentSummaryData.paragraphs) && currentSummaryData.paragraphs.length > 0) {
      text = currentSummaryData.paragraphs.join('\n\n');
    } else if (currentSummaryData.summary) {
      text = currentSummaryData.summary
        .replace(/^#{1,6}\s*(.*)$/gm, '$1')
        .replace(/^\s*[\*\-•]\s+/gm, '')
        .trim();
    }
  } else {
    text = currentSummaryData.summary || '';
  }
  return text || '';
}

/**
 * 🔊 butonunun simgesini ayarlar (volume-2 | pause | volume-x).
 * @param {string} iconName - lucide simge adı
 */
function setSpeakIcon(iconName) {
  const btn = document.getElementById('summary-btn-speak');
  if (!btn) return;
  const iconEl = btn.querySelector('i');
  if (iconEl) iconEl.setAttribute('data-lucide', iconName);
  if (window.lucide && typeof window.lucide.createIcons === 'function') {
    window.lucide.createIcons({ root: btn });
  }
}

/**
 * Piper motor + ses durumunu bir kez sorgular; kurulu değilse butonu soluk gösterir.
 * @returns {Promise<boolean>} Sesli okuma kullanılabilir mi
 */
async function refreshTtsAvailability() {
  const btn = document.getElementById('summary-btn-speak');
  try {
    const res = await fetch('/api/tts/status');
    const data = await res.json();
    ttsAvailable = !!(data.success && data.engineInstalled && Array.isArray(data.installedVoices) && data.installedVoices.length > 0);
  } catch (_) {
    ttsAvailable = false;
  }
  if (btn) {
    btn.style.opacity = ttsAvailable ? '1' : '0.45';
    btn.style.cursor = ttsAvailable ? 'pointer' : 'help';
  }
  return ttsAvailable;
}

/**
 * Ses çalmayı ve süren sentezi durdurur (sunucudaki piper.exe'ye de /api/tts/stop gönderilir).
 */
export function stopSpeakPlayback() {
  const audio = document.getElementById('summary-audio-el');
  if (audio && !audio.paused) {
    try { audio.pause(); } catch (_) {}
  }
  if (speakAbortController) {
    try { speakAbortController.abort(); } catch (_) {}
    speakAbortController = null;
  }
  if (speakBusy) {
    fetch('/api/tts/stop', { method: 'POST' }).catch(() => {});
    speakBusy = false;
  }
  setSpeakIcon('volume-2');
  updateStopButtonState();
}

/**
 * 🔊 Durdur: çalmayı, hazır sesi ve süren sentezi tamamen sıfırlar.
 */
export function onSummaryStopClick() {
  const isEn = window.localDb?.settings?.lang === 'en';
  const audio = document.getElementById('summary-audio-el');
  const busyBefore = speakBusy;
  stopSpeakPlayback();
  if (audio) {
    try {
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
    } catch (_) {}
    audio.dataset.ready = '';
  }
  updateStopButtonState();
  if (busyBefore) {
    toastInfo(isEn ? 'Speech synthesis stopped.' : 'Sesli okuma durduruldu.');
  }
}

/**
 * Seslendirilecek metni belirler: önce modül verisi, yoksa panelde görünen metinden yeniden kurar.
 * @returns {{ text: string, source: string }}
 */
function resolveSpeakText() {
  const fromData = getSummarySpeakText();
  if (fromData && fromData.trim().length > 10) return { text: fromData, source: 'data' };

  const contentEl = document.getElementById('summary-content-body');
  if (contentEl) {
    const clone = contentEl.cloneNode(true);
    clone.querySelectorAll('button, .summary-time-pill, script, style').forEach(n => n.remove());
    const domText = (clone.innerText || clone.textContent || '').trim();
    if (domText.length > 10) return { text: domText, source: 'dom' };
  }
  return { text: '', source: 'none' };
}

/**
 * 🔊 butonunun durumunu sıfırlar (sentez iptali/hatası sonrası kilit kalmaması için).
 */
function resetSpeakUi() {
  speakBusy = false;
  try {
    const btn = document.getElementById('summary-btn-speak');
    if (btn) btn.classList.remove('loading');
  } catch (_) {}
  setSpeakIcon('volume-2');
}

/**
 * 🔊 butonu davranışı: Çal ↔ Duraklat; ses yoksa sentezle ve çal.
 * Sentez sürerken tıklanırsa işlemi iptal eder. Hiçbir dal sessizce çıkmaz (kullanıcıya sebep gösterilir).
 */
export async function onSummarySpeakClick() {
  const isEn = window.localDb?.settings?.lang === 'en';
  const btn = document.getElementById('summary-btn-speak');
  let audio = document.getElementById('summary-audio-el');

  // Ses öğesi yoksa (panel yeniden basıldıysa) dinamik olarak oluştur
  if (!audio) {
    audio = document.createElement('audio');
    audio.id = 'summary-audio-el';
    audio.preload = 'none';
    audio.style.display = 'none';
    (document.getElementById('inline-player-summary-container') || document.body).appendChild(audio);
  }
  if (!btn) {
    console.error('[TTS] 🔊 butonu DOM\'da bulunamadı.');
    toastError(isEn ? 'Play button not found on the page.' : 'Dinle butonu sayfada bulunamadı.');
    return;
  }

  initSummaryAudioHooks();

  // Ses çalıyor → duraklat
  if (audio.src && !audio.paused) {
    audio.pause();
    return;
  }
  // Hazır ses var → devam ettir / baştan çal
  if (audio.dataset.ready === '1' && audio.src) {
    if (audio.ended) audio.currentTime = 0;
    audio.play().catch((err) => {
      console.error('[TTS] play() başarısız:', err && err.name);
      toastError(isEn ? 'Could not start audio playback.' : 'Ses çalınamadı.');
    });
    return;
  }

  // Sentez sürerken tıklanırsa iptal et
  if (speakBusy) {
    stopSpeakPlayback();
    toastInfo(isEn ? 'Speech synthesis cancelled.' : 'Ses sentezi iptal edildi.');
    return;
  }

  const resolved = resolveSpeakText();
  if (!resolved.text.trim()) {
    console.warn('[TTS] Okunacak metin bulunamadı (veri ve panel boş).');
    toastInfo(isEn ? 'No summary text to read yet.' : 'Okunacak özet metni henüz yok.');
    return;
  }
  if (resolved.source === 'dom') {
    console.log('[TTS] Özet metni panelden yeniden kuruldu (modül verisi boştu).');
  }

  speakBusy = true;
  speakAbortController = new AbortController();
  btn.classList.add('loading');
  setSpeakIcon('volume-x');
  updateStopButtonState();

  try {
    // Motor durumu: yalnız bilgilendirme amaçlı; sentez yine denenir (sunucu karar verir)
    const available = ttsAvailable === true ? true : await refreshTtsAvailability();
    if (!available) {
      console.warn('[TTS] /api/tts/status hazır değil, yine de sentez denenecek.');
    }

    const speed = Number(window.localDb?.settings?.ttsSpeed) > 0 ? Number(window.localDb.settings.ttsSpeed) : 1;
    const voiceId = typeof window.localDb?.settings?.ttsVoiceId === 'string' ? window.localDb.settings.ttsVoiceId : '';
    const res = await fetch('/api/tts/speak', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: resolved.text, voiceId: voiceId || undefined, speed }),
      signal: speakAbortController.signal
    });
    let data = null;
    try { data = await res.json(); } catch (_) { data = null; }
    if (!res.ok || !data || !data.success) {
      const msg = (data && data.error) || `HTTP ${res.status}`;
      throw new Error(msg);
    }

    audio.src = `/api/tts/audio/${encodeURIComponent(data.audioId)}`;
    audio.dataset.ready = '1';
    try {
      await audio.play();
    } catch (playErr) {
      // Otomatik oynatma engeli: kullanıcı tekrar basınca çalar
      console.error('[TTS] play() engellendi:', playErr && playErr.name);
      toastWarning(isEn ? 'Audio is ready — press 🔊 again to play.' : 'Ses hazır — çalmak için 🔊 butonuna tekrar bas.');
      return;
    }
    if (data.truncated) {
      toastInfo(isEn ? 'Long summary was read truncated.' : 'Uzun özet kısaltılarak seslendirildi.');
    }
  } catch (err) {
    if (err && err.name === 'AbortError') return;
    console.error('[TTS Speak Error]:', err);
    toastError(isEn ? `Text-to-speech failed: ${err.message}` : `Sesli okuma başarısız: ${err.message}`);
  } finally {
    // Kilit her durumda açılır (eski sürümde hata sonrası buton kilitli kalıyordu)
    resetSpeakUi();
    updateStopButtonState();
  }
}

// Teşhis kancası: sorun bildirildiğinde durumu tek satırda görmek için
window.__ttsDebug = () => {
  const audio = document.getElementById('summary-audio-el');
  const resolved = resolveSpeakText();
  return {
    speakBusy,
    ttsAvailable,
    hasSummaryData: !!currentSummaryData,
    speakTextLen: resolved.text.length,
    speakTextSource: resolved.source,
    audioSrc: audio ? audio.src : null,
    audioPaused: audio ? audio.paused : null,
    voiceId: window.localDb?.settings?.ttsVoiceId || null,
    speed: window.localDb?.settings?.ttsSpeed ?? null
  };
};

/**
 * Durdur butonunun soluk/aktif görünümünü çalma veya sentez durumuna göre ayarlar.
 */
function updateStopButtonState() {
  const stopBtn = document.getElementById('summary-btn-stop');
  const audio = document.getElementById('summary-audio-el');
  if (!stopBtn) return;
  const active = speakBusy || (audio && audio.src && !audio.paused) || (audio && audio.dataset.ready === '1' && !audio.ended);
  stopBtn.style.opacity = active ? '1' : '0.45';
  stopBtn.style.cursor = active ? 'pointer' : 'default';
}

/**
 * Ses öğesinin çal/duraklat/bitti olaylarında simgeyi senkron tutar (bir kez bağlanır).
 */
function initSummaryAudioHooks() {
  if (summaryAudioHooksInit) return;
  const audio = document.getElementById('summary-audio-el');
  if (!audio) return;
  summaryAudioHooksInit = true;
  audio.addEventListener('play', () => { setSpeakIcon('pause'); updateStopButtonState(); });
  audio.addEventListener('pause', () => { if (!audio.ended) setSpeakIcon('volume-2'); updateStopButtonState(); });
  audio.addEventListener('ended', () => { setSpeakIcon('volume-2'); updateStopButtonState(); });
  audio.addEventListener('error', () => { audio.dataset.ready = ''; setSpeakIcon('volume-2'); updateStopButtonState(); });
}

/**
 * Oynatılan video değiştiğinde veya kapatıldığında özet panelini sıfırlar.
 */
export function resetSummaryState() {
  stopSpeakPlayback();
  currentSummaryVideoId = null;
  currentSummaryData = null;
  // Bekleyen özet isteğini iptal et; sunucudaki üretim sürer ve sonuç önbelleğe yazılır
  if (summaryAbortController) {
    try { summaryAbortController.abort(); } catch (_) {}
    summaryAbortController = null;
  }
  isSummaryLoading = false;

  const container = document.getElementById('inline-player-summary-container');
  const btn = document.getElementById('inline-btn-summary');
  const contentEl = document.getElementById('summary-content-body');
  const emptyEl = document.getElementById('summary-empty');
  const loadingEl = document.getElementById('summary-loading');

  if (container) container.classList.add('hidden');
  if (btn) {
    btn.classList.remove('active');
    btn.classList.remove('loading');
  }
  if (contentEl) contentEl.innerHTML = '';
  if (emptyEl) emptyEl.style.display = 'none';
  if (loadingEl) loadingEl.style.display = 'none';
}

/**
 * Özet kutusundaki bir zaman damgasına tıklandığında videoyu o saniyeye sarar.
 */
export function seekSummaryVideo(timeStr) {
  if (!timeStr) return;
  const clean = timeStr.trim().replace(/[\[\]\(\)]/g, '');
  const parts = clean.split(':').map(n => parseInt(n, 10));
  let seconds = 0;
  if (parts.length === 3) {
    seconds = (parts[0] || 0) * 3600 + (parts[1] || 0) * 60 + (parts[2] || 0);
  } else if (parts.length === 2) {
    seconds = (parts[0] || 0) * 60 + (parts[1] || 0);
  } else {
    seconds = parseInt(clean, 10) || 0;
  }

  let sought = false;

  // 1. Plyr Oynatıcı Örneği Senkronizasyonu
  if (window.videoPlayerInstance) {
    try {
      window.videoPlayerInstance.currentTime = seconds;
      window.videoPlayerInstance.play();
      sought = true;
    } catch (_) {}
  }

  // 2. Doğrudan video DOM elementi
  const playerEl = document.getElementById('embedded-video-player');
  const targetVideo = (playerEl && playerEl.tagName === 'VIDEO')
    ? playerEl
    : document.querySelector('#downloaded-inline-player-container video, #player-modal video, video');

  if (targetVideo) {
    try {
      targetVideo.currentTime = seconds;
      targetVideo.play().catch(() => {});
      sought = true;
    } catch (_) {}
  }

  // 3. Oynatıcı henüz açık değilse videoyu bu sürede başlat
  const targetVid = currentSummaryVideoId || window.currentPlayingVideoId;
  if (!sought && targetVid && typeof window.playVideoEmbedded === 'function') {
    window.playVideoEmbedded(targetVid, seconds, false);
    sought = true;
  }

  const inlineContainer = document.getElementById('downloaded-inline-player-container');
  if (inlineContainer && !inlineContainer.classList.contains('hidden')) {
    inlineContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  const isEn = window.localDb?.settings?.lang === 'en';
  toastSuccess(isEn ? `⏱️ Jumped to ${clean}` : `⏱️ ${clean} anına gidildi`);
}

// Global window erişim köprüleri
window.toggleSummaryPanel = toggleSummaryPanel;
window.initSummaryProviderSelect = initSummaryProviderSelect;
window.fetchAndRenderSummary = fetchAndRenderSummary;
window.renderSummaryUI = renderSummaryUI;
window.onSummaryModeChange = onSummaryModeChange;
window.onSummaryProviderChange = onSummaryProviderChange;
window.onSummaryModelChange = onSummaryModelChange;
window.useFallbackLocalNlp = useFallbackLocalNlp;
window.refreshLmStudioModelsInSummary = refreshLmStudioModelsInSummary;
window.refreshGgufModelsInSummary = refreshGgufModelsInSummary;
window.onSummaryGgufModelChange = onSummaryGgufModelChange;
window.regenerateSummary = regenerateSummary;
window.copySummaryText = copySummaryText;
window.onSummarySpeakClick = onSummarySpeakClick;
window.onSummaryStopClick = onSummaryStopClick;
window.stopSpeakPlayback = stopSpeakPlayback;
window.invalidateTtsAvailability = () => { ttsAvailable = null; };
window.resetSummaryState = resetSummaryState;
window.seekSummaryVideo = seekSummaryVideo;
window.loadAvailableSubtitlesForSummary = loadAvailableSubtitlesForSummary;
window.onSummarySubtitleLangChange = onSummarySubtitleLangChange;
window.onSummaryOutputLangChange = onSummaryOutputLangChange;
window.toggleSummaryFlagDropdown = toggleSummaryFlagDropdown;
window.selectSummaryOutputLang = selectSummaryOutputLang;
window.updateSummaryOutputLangUI = updateSummaryOutputLangUI;

// CSS Stilleri
if (typeof document !== 'undefined' && document.head && !document.getElementById('summary-time-pill-style')) {
  const style = document.createElement('style');
  style.id = 'summary-time-pill-style';
  style.textContent = `
    .summary-time-pill {
      display: inline-flex;
      align-items: center;
      padding: 1px 7px;
      margin: 0 4px 0 0;
      border-radius: 6px;
      font-size: 0.76rem;
      font-weight: 700;
      font-family: monospace, sans-serif;
      background: rgba(168, 85, 247, 0.16);
      color: #c084fc;
      border: 1px solid rgba(168, 85, 247, 0.35);
      cursor: pointer;
      transition: all 0.15s ease-in-out;
      vertical-align: middle;
    }
    .summary-time-pill:hover {
      background: #a855f7;
      color: #ffffff;
      transform: translateY(-1px);
      box-shadow: 0 2px 8px rgba(168, 85, 247, 0.35);
    }
  `;
  document.head.appendChild(style);
}
