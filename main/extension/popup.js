// Multimedia HaYTooL Chromium Extension Popup Script
let BACKEND_PORT = 4141;
let BACKEND_URL = 'http://127.0.0.1:4141';
const CURRENT_EXT_VERSION = (chrome.runtime && chrome.runtime.getManifest && chrome.runtime.getManifest().version) || '12.4.2';

async function loadSettings() {
  try {
    if (chrome.storage && chrome.storage.sync) {
      const data = await chrome.storage.sync.get(['haytoolPort', 'haytoolLang']);
      if (data && data.haytoolPort) {
        BACKEND_PORT = parseInt(data.haytoolPort, 10) || 4141;
        BACKEND_URL = `http://127.0.0.1:${BACKEND_PORT}`;
      }
    }
    if (chrome.storage && chrome.storage.local) {
      const localData = await chrome.storage.local.get(['lastDownloadFormat', 'lastAudioBitrate']);
      if (localData && localData.lastDownloadFormat) {
        const fmtSelect = document.getElementById('sel-format');
        const vRow = document.getElementById('row-video-quality');
        const aRow = document.getElementById('row-audio-quality');
        if (fmtSelect) {
          fmtSelect.value = localData.lastDownloadFormat;
          if (localData.lastDownloadFormat === 'audio') {
            if (vRow) vRow.classList.add('hidden');
            if (aRow) aRow.classList.remove('hidden');
          }
        }
      }
      if (localData && localData.lastAudioBitrate) {
        const aSelect = document.getElementById('sel-audio-quality');
        if (aSelect) aSelect.value = localData.lastAudioBitrate;
      }
    }
  } catch (e) {}
  return {};
}

function getMessage(key, fallback) {
  return (chrome.i18n && chrome.i18n.getMessage(key)) || fallback;
}

const statusDot = document.getElementById('status-dot');
const statusText = document.getElementById('status-text');
const detectTypeLabel = document.getElementById('detect-type-label');
const targetTitleEl = document.getElementById('target-title');
const targetUrlEl = document.getElementById('target-url');
const btnAction = document.getElementById('btn-action');
const btnActionText = document.getElementById('btn-action-text');
const btnWebstream = document.getElementById('btn-webstream');
const feedbackBox = document.getElementById('feedback-box');
const versionWarningBox = document.getElementById('version-warning-box');
const btnOpenInstallGuide = document.getElementById('btn-open-install-guide');
const extVersionBadge = document.getElementById('ext-version-badge');
if (extVersionBadge) {
  extVersionBadge.textContent = `v${CURRENT_EXT_VERSION}`;
}

// Kaplumbağa Hız Modu (Turtle Speed)
const cbTurtleMode = document.getElementById('cb-turtle-mode');
const turtleStatusText = document.getElementById('turtle-status-text');
const turtleToolbar = document.getElementById('turtle-toolbar');
const inpAltSpeed = document.getElementById('inp-alt-speed');

let isTogglingTurtle = false;

async function updateTurtleModeState(preloadedSettings) {
  if (!cbTurtleMode || !turtleStatusText) return;
  try {
    let settings = preloadedSettings;
    if (!settings) {
      try {
        const res = await fetch(`${BACKEND_URL}/api/settings`, { method: 'GET' });
        if (res.ok) {
          const json = await res.json();
          settings = json.settings || json;
        }
      } catch {}

      if (!settings) {
        try {
          const resDb = await fetch(`${BACKEND_URL}/api/db`, { method: 'GET' });
          if (resDb.ok) {
            const jsonDb = await resDb.json();
            settings = jsonDb.settings;
          }
        } catch {}
      }
    }

    if (settings) {
      const isActive = !!settings.useAlternativeSpeed;
      const limit = settings.alternativeSpeedLimit || 500;
      cbTurtleMode.checked = isActive;
      cbTurtleMode.disabled = false;
      if (inpAltSpeed && document.activeElement !== inpAltSpeed) {
        inpAltSpeed.value = limit;
      }
      turtleStatusText.textContent = isActive ? '(Açık)' : '(Kapalı)';
      turtleStatusText.style.color = isActive ? 'var(--warning)' : 'var(--muted)';
      return;
    }
  } catch (e) {}
  turtleStatusText.textContent = '(Belirlenemedi)';
}

async function handleTurtleToggle() {
  if (isTogglingTurtle) return;
  isTogglingTurtle = true;
  try {
    if (turtleStatusText) turtleStatusText.textContent = '(Güncelleniyor...)';
    const res = await fetch(`${BACKEND_URL}/api/settings/toggle-alt-speed`, { method: 'POST' });
    if (res.ok) {
      const data = await res.json();
      await updateTurtleModeState(data.settings);
    } else {
      await updateTurtleModeState();
    }
  } catch (e) {
    if (turtleStatusText) turtleStatusText.textContent = '(Hata)';
  } finally {
    isTogglingTurtle = false;
  }
}

if (cbTurtleMode) {
  cbTurtleMode.addEventListener('change', handleTurtleToggle);
}

if (inpAltSpeed) {
  inpAltSpeed.addEventListener('click', (e) => e.stopPropagation());
  inpAltSpeed.addEventListener('change', async (e) => {
    e.stopPropagation();
    const val = parseInt(inpAltSpeed.value, 10);
    if (!val || val < 10) return;
    try {
      const res = await fetch(`${BACKEND_URL}/api/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alternativeSpeedLimit: val })
      });
      if (res.ok) {
        const data = await res.json();
        await updateTurtleModeState(data.settings);
      }
    } catch (err) {
      console.error('Speed update error:', err);
    }
  });
  inpAltSpeed.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      inpAltSpeed.blur();
    }
  });
}

if (turtleToolbar) {
  turtleToolbar.addEventListener('click', (e) => {
    if (e.target.closest('#inp-alt-speed') || e.target.closest('.switch')) {
      return;
    }
    cbTurtleMode.checked = !cbTurtleMode.checked;
    handleTurtleToggle();
  });
}

// Seçenek Panelleri
const videoOptionsPanel = document.getElementById('video-options-panel');
const selFormat = document.getElementById('sel-format');
const rowVideoQuality = document.getElementById('row-video-quality');
const selQuality = document.getElementById('sel-quality');
const rowAudioQuality = document.getElementById('row-audio-quality');
const selAudioQuality = document.getElementById('sel-audio-quality');

const channelOptionsPanel = document.getElementById('channel-options-panel');
const cbChannelAutoDl = document.getElementById('cb-channel-autodl');
const cbChannelShorts = document.getElementById('cb-channel-shorts');
const inpShortsLimit = document.getElementById('inp-shorts-limit');
const cbChannelFakap = document.getElementById('cb-channel-fakap');

let currentDetected = null; // { type: 'video' | 'channel' | 'none', url: string, platform: string, videoId?: string }

// Format Değişimi Dinleyicisi (MP4 vs MP3)
selFormat.addEventListener('change', () => {
  if (selFormat.value === 'audio') {
    rowVideoQuality.classList.add('hidden');
    rowAudioQuality.classList.remove('hidden');
  } else {
    rowVideoQuality.classList.remove('hidden');
    rowAudioQuality.classList.add('hidden');
  }
  try {
    if (chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({ lastDownloadFormat: selFormat.value });
    }
  } catch (e) {}
});

selAudioQuality.addEventListener('change', () => {
  try {
    if (chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({ lastAudioBitrate: selAudioQuality.value });
    }
  } catch (e) {}
});

// Sürüm kontrolü (yalnızca popup açıldığında tek seferlik kontrol)
async function checkBackendAndVersion() {
  try {
    const res = await fetch(`${BACKEND_URL}/api/version`, { method: 'GET' });
    if (res.ok) {
      const data = await res.json();
      statusDot.className = 'status-dot online';
      statusText.textContent = getMessage('statusConnected', `Uygulamaya Bağlı (${BACKEND_PORT})`);

      const serverVer = data.version || CURRENT_EXT_VERSION;
      if (serverVer !== CURRENT_EXT_VERSION) {
        versionWarningBox.classList.remove('hidden');
        versionWarningBox.querySelector('span').textContent = `Yeni sürüm mevcut: v${serverVer} (Sizdeki: v${CURRENT_EXT_VERSION})`;
      }
      return true;
    }
  } catch (e) {}
  statusDot.className = 'status-dot offline';
  statusText.textContent = getMessage('statusDisconnected', 'Uygulama Kapalı');
  return false;
}

// Aktif Sekmeyi Analiz Et (YouTube, TikTok, X, Instagram)
function analyzeUrl(url) {
  if (!url) return { type: 'none', platform: 'other' };

  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();

    // 1. YouTube
    if (host.includes('youtube.com') || host.includes('youtu.be')) {
      if (host.includes('youtu.be')) {
        const vid = u.pathname.slice(1).split(/[?#&]/)[0];
        if (vid && vid.length >= 11) return { type: 'video', url, platform: 'YouTube', videoId: vid.slice(0, 11) };
      }
      if (u.pathname === '/watch' && u.searchParams.has('v')) {
        return { type: 'video', url, platform: 'YouTube', videoId: u.searchParams.get('v') };
      }
      if (u.pathname.startsWith('/shorts/')) {
        const vid = u.pathname.split('/shorts/')[1]?.split(/[?#&]/)[0];
        if (vid) return { type: 'video', url, platform: 'YouTube', videoId: vid };
      }
      if (
        u.pathname.startsWith('/@') || 
        u.pathname.startsWith('/channel/') || 
        u.pathname.startsWith('/c/') || 
        u.pathname.startsWith('/user/')
      ) {
        return { type: 'channel', url, platform: 'YouTube' };
      }
    }

    // 2. TikTok
    if (host.includes('tiktok.com')) {
      if (u.pathname.includes('/video/') || u.pathname.includes('/v/')) {
        return { type: 'video', url, platform: 'TikTok' };
      }
    }

    // 3. Twitter / X
    if (host.includes('twitter.com') || host.includes('x.com')) {
      if (u.pathname.includes('/status/')) {
        return { type: 'video', url, platform: 'X' };
      }
    }

    // 4. Instagram
    if (host.includes('instagram.com')) {
      if (
        u.pathname.includes('/reel/') || 
        u.pathname.includes('/reels/') || 
        u.pathname.includes('/p/') || 
        u.pathname.includes('/tv/')
      ) {
        return { type: 'video', url, platform: 'Instagram' };
      }
    }

    return { type: 'none', platform: 'other', url };
  } catch (e) {
    return { type: 'none', platform: 'other', url };
  }
}

// Arayüzü Başlat
async function init() {
  await loadSettings();
  const isServerOnline = await checkBackendAndVersion();
  if (isServerOnline) {
    await updateTurtleModeState();
  } else {
    if (cbTurtleMode) cbTurtleMode.disabled = true;
    if (turtleStatusText) turtleStatusText.textContent = '(Bağlantı Yok)';
  }

  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tabs || !tabs[0]) return;
    const tab = tabs[0];
    const detected = analyzeUrl(tab.url);
    detected.url = tab.url;
    currentDetected = detected;

    targetTitleEl.textContent = tab.title || detected.platform;
    targetUrlEl.textContent = tab.url;

    videoOptionsPanel.classList.add('hidden');
    channelOptionsPanel.classList.add('hidden');

    if (btnWebstream) btnWebstream.classList.add('hidden');

    if (detected.type === 'video') {
      detectTypeLabel.textContent = `${detected.platform} Videosu Algılandı`;
      btnActionText.textContent = getMessage('btnDownloadVideo', 'Videoyu İndir');
      btnAction.disabled = !isServerOnline;
      btnAction.className = 'btn btn-primary';
      btnAction.style.background = '';
      btnAction.style.color = '';
      videoOptionsPanel.classList.remove('hidden');
      if (btnWebstream) btnWebstream.classList.remove('hidden');
    } else if (detected.type === 'channel') {
      detectTypeLabel.textContent = `${detected.platform} Kanalı Algılandı`;
      btnActionText.textContent = getMessage('btnAddChannel', 'Ayarlarla Takibe Al');
      btnAction.disabled = !isServerOnline;
      btnAction.className = 'btn btn-primary';
      btnAction.style.background = '';
      btnAction.style.color = '';
      channelOptionsPanel.classList.remove('hidden');
    } else {
      // Dizi / Web video izleme siteleri (Dizipal, genel web siteleri)
      detectTypeLabel.textContent = 'Web Sayfası / Video Akışı';
      btnActionText.textContent = '📺 Web İzle\'de Aç (HaYTooL)';
      btnAction.disabled = !isServerOnline;
      btnAction.className = 'btn btn-primary';
      btnAction.style.background = 'linear-gradient(135deg, #ef4444, #dc2626)';
      btnAction.style.color = '#ffffff';
    }
  } catch (e) {
    console.error('Tab query error:', e);
  }
}

// Eylem Butonu
btnAction.addEventListener('click', async () => {
  if (!currentDetected) return;

  feedbackBox.className = 'feedback';
  feedbackBox.style.display = 'none';

  if (currentDetected.type === 'video') {
    btnAction.disabled = true;
    btnActionText.textContent = 'İşleniyor...';

    const isAudio = selFormat.value === 'audio';
    let reqFormat = 'video-best';
    let reqBitrate = undefined;

    if (isAudio) {
      reqFormat = 'audio-mp3';
      reqBitrate = selAudioQuality.value || '320';
    } else {
      const q = selQuality.value;
      if (q === 'default') {
        reqFormat = undefined;
      } else if (q === 'best' || q === '2160') {
        reqFormat = 'video-best';
      } else if (q === '1440') {
        reqFormat = 'video-1440p';
      } else if (q === '1080') {
        reqFormat = 'video-1080p';
      } else if (q === '720') {
        reqFormat = 'video-720p';
      } else if (q === '480') {
        reqFormat = 'video-480p';
      }
    }

    try {
      const res = await fetch(`${BACKEND_URL}/api/downloader/download`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: currentDetected.url,
          format: reqFormat,
          bitrate: reqBitrate
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showFeedback(getMessage('msgSuccessDownload', 'İndirme kuyruğuna eklendi!'), 'success');
      } else {
        showFeedback(data.error || getMessage('msgError', 'Hata oluştu.'), 'error');
      }
    } catch (err) {
      showFeedback(getMessage('msgError', 'Bağlantı kurulamadı.'), 'error');
    } finally {
      btnAction.disabled = false;
      btnActionText.textContent = getMessage('btnDownloadVideo', 'Videoyu İndir');
    }

  } else if (currentDetected.type === 'channel') {
    btnAction.disabled = true;
    btnActionText.textContent = 'Ekleniyor...';

    const autoDownload = cbChannelAutoDl.checked;
    const downloadShorts = cbChannelShorts.checked;
    const shortsDurationLimit = parseInt(inpShortsLimit.value, 10) || 180;
    const isFakap = cbChannelFakap.checked;

    try {
      const res = await fetch(`${BACKEND_URL}/api/channels`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          input: currentDetected.url,
          autoDownload,
          downloadShorts,
          shortsDurationLimit,
          isFakap
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showFeedback(getMessage('msgSuccessChannel', 'Kanal özel ayarlarıyla takibe alındı!'), 'success');
      } else {
        showFeedback(data.error || getMessage('msgError', 'Kanal eklenemedi.'), 'error');
      }
    } catch (err) {
      showFeedback(getMessage('msgError', 'Bağlantı kurulamadı.'), 'error');
    } finally {
      btnAction.disabled = false;
      btnActionText.textContent = getMessage('btnAddChannel', 'Ayarlarla Takibe Al');
    }

  } else {
    // Web sitesi / Dizi izleme sayfası: Doğrudan HaYTooL Web İzle'ye gönder
    const targetUrl = (currentDetected && currentDetected.url) || (targetUrlEl && targetUrlEl.textContent);
    if (targetUrl && targetUrl.startsWith('http')) {
      await sendToWebStream(targetUrl);
    } else {
      showFeedback('Geçerli bir sayfa bağlantısı bulunamadı.', 'error');
    }
  }
});

async function sendToWebStream(url) {
  if (!url) return;
  showFeedback('Masaüstü uygulamasına aktarılıyor...', 'warning');
  try {
    const res = await fetch(`${BACKEND_URL}/api/tools/open-web-stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url })
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.success) {
      showFeedback('HaYTooL uygulamasında açıldı!', 'success');
      setTimeout(() => {
        window.close();
      }, 500);
    } else {
      showFeedback(data.error || 'Uygulamaya iletilemedi.', 'error');
    }
  } catch (err) {
    showFeedback('HaYTooL uygulaması kapalı! Lütfen uygulamayı başlatın.', 'error');
  }
}

if (btnWebstream) {
  btnWebstream.addEventListener('click', async () => {
    const targetUrl = (currentDetected && currentDetected.url) || (targetUrlEl && targetUrlEl.textContent);
    if (targetUrl && targetUrl.startsWith('http')) {
      await sendToWebStream(targetUrl);
    }
  });
}

// Kurulum modalını masaüstü arayüzünde açma köprüsü
if (btnOpenInstallGuide) {
  btnOpenInstallGuide.addEventListener('click', () => {
    chrome.tabs.create({ url: `${BACKEND_URL}#extension-guide` });
  });
}

function showFeedback(text, type) {
  feedbackBox.textContent = text;
  feedbackBox.className = `feedback ${type}`;
  feedbackBox.style.display = 'block';
}

document.addEventListener('DOMContentLoaded', init);
