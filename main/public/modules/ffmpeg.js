/**
 * HaYTooL YT Downloader - FFmpeg Management Module
 * public/modules/ffmpeg.js
 */

export async function checkFfmpegStatus() {
  const langKey = window.currentLang || (window.localDb?.settings?.lang) || 'tr';
  const t = window.translations?.[langKey] || window.translations?.tr || {};
  try {
    const res = await fetch('/api/ffmpeg/status');
    const data = await res.json();
    
    const banner = document.getElementById('ffmpeg-info-banner');
    const statusIndicator = document.getElementById('settings-ffmpeg-status');
    const settingsBtn = document.getElementById('settings-ffmpeg-btn');
    const syncBtn = document.getElementById('settings-ffmpeg-sync-btn');
    const sourceBadge = document.getElementById('settings-ffmpeg-source-badge');
    const versionBadge = document.getElementById('settings-ffmpeg-version-info');
    const detailBox = document.getElementById('settings-ffmpeg-detail-box');
    
    const isEn = langKey === 'en';

    if (sourceBadge) {
      if (data.activeSource === 'app') {
        sourceBadge.style.display = 'inline-block';
        sourceBadge.innerText = t.ffmpeg_source_app || 'Uygulama İçi (Aktif)';
        sourceBadge.style.color = '#10b981';
        sourceBadge.style.background = 'rgba(16, 185, 129, 0.12)';
        sourceBadge.style.borderColor = 'rgba(16, 185, 129, 0.3)';
      } else if (data.activeSource === 'system') {
        sourceBadge.style.display = 'inline-block';
        sourceBadge.innerText = t.ffmpeg_source_system || 'Sistem Geneli (WinGet / PATH)';
        sourceBadge.style.color = '#38bdf8';
        sourceBadge.style.background = 'rgba(56, 189, 248, 0.12)';
        sourceBadge.style.borderColor = 'rgba(56, 189, 248, 0.3)';
      } else {
        sourceBadge.style.display = 'none';
      }
    }

    if (versionBadge) {
      if (data.installed && data.localVersion) {
        versionBadge.style.display = 'inline-block';
        versionBadge.innerText = `v${data.localVersion.replace(/^v/i, '')}`;
      } else {
        versionBadge.style.display = 'none';
      }
    }

    if (detailBox) {
      const appText = data.appFfmpeg?.exists 
        ? `<span style="color:#10b981;">📁 ${isEn ? 'App Dir' : 'Uygulama İçi'}: v${(data.appFfmpeg.version || '').replace(/^v/i, '')} (${data.appFfmpeg.path})</span>` 
        : `<span style="color:var(--text-muted);">📁 ${isEn ? 'App Dir' : 'Uygulama İçi'}: ${isEn ? 'Not found' : 'Klasörde yok'}</span>`;
      const sysText = data.systemFfmpeg?.exists 
        ? `<span style="color:#38bdf8;">💻 ${isEn ? 'System (WinGet)' : 'Sistem (WinGet)'}: v${(data.systemFfmpeg.version || '').replace(/^v/i, '')} (${data.systemFfmpeg.path})</span>` 
        : `<span style="color:var(--text-muted);">💻 ${isEn ? 'System' : 'Sistem'}: ${isEn ? 'Not in PATH' : 'PATH üzerinde yok'}</span>`;
      detailBox.innerHTML = `${appText} &nbsp;|&nbsp; ${sysText}`;
      detailBox.style.display = 'block';
    }

    if (syncBtn) {
      if (data.systemFfmpeg?.exists && data.activeSource !== 'app') {
        syncBtn.style.display = 'inline-block';
        syncBtn.innerText = t.ffmpeg_btn_sync || 'Sistemdekini Eşitle';
      } else {
        syncBtn.style.display = 'none';
      }
    }

    if (data.installed) {
      if (banner) banner.classList.add('hidden');
      if (statusIndicator) {
        statusIndicator.innerText = t.ffmpeg_status_installed || 'Kurulu';
        statusIndicator.className = 'ffmpeg-status-indicator installed';
      }
      if (settingsBtn) {
        settingsBtn.innerText = t.ffmpeg_btn_update || 'En Son Sürümü İndir';
      }
    } else {
      if (banner && localStorage.getItem('ffmpeg_banner_dismissed') !== 'true') {
        banner.classList.remove('hidden');
      }
      if (statusIndicator) {
        statusIndicator.innerText = t.ffmpeg_status_not_installed || 'Kurulu Değil';
        statusIndicator.className = 'ffmpeg-status-indicator not-installed';
      }
      if (settingsBtn) {
        settingsBtn.innerText = t.ffmpeg_btn_install || 'Kur';
      }
    }

    const gpuBadge = document.getElementById('settings-gpu-detected');
    if (gpuBadge && data.hwaccel) {
      const gpuName = data.hwaccel.gpuName || '';
      const rec = (data.hwaccel.recommended || 'cpu').toUpperCase();
      if (data.hwaccel.recommended && data.hwaccel.recommended !== 'cpu') {
        const supportedText = t.hwaccel_supported || 'Destekleniyor';
        gpuBadge.textContent = `${gpuName ? gpuName + ' • ' : ''}${rec} ${supportedText}`;
        gpuBadge.style.color = '#34d399';
        gpuBadge.style.borderColor = 'rgba(52, 211, 153, 0.3)';
        gpuBadge.style.background = 'rgba(52, 211, 153, 0.1)';
      } else {
        gpuBadge.textContent = gpuName ? `${gpuName} • ${t.hwaccel_cpu_mode || 'CPU Modu'}` : (t.hwaccel_cpu_mode || 'Yalnızca CPU');
        gpuBadge.style.color = 'var(--text-muted)';
        gpuBadge.style.borderColor = 'var(--border-color)';
        gpuBadge.style.background = 'rgba(255, 255, 255, 0.05)';
      }
    }
  } catch (err) {
    console.error('Error checking FFmpeg status:', err);
  }
}

export async function syncFfmpegFromSystem() {
  const syncBtn = document.getElementById('settings-ffmpeg-sync-btn');
  const originalText = syncBtn ? syncBtn.innerText : '';
  if (syncBtn) {
    syncBtn.disabled = true;
    syncBtn.innerText = 'Kopyalanıyor...';
  }
  try {
    const res = await fetch('/api/ffmpeg/sync-from-system', { method: 'POST' });
    const data = await res.json();
    if (data.success) {
      if (typeof window.showToast === 'function') {
        window.showToast('Sistem FFmpeg başarıyla uygulama klasörüne kopyalandı ve aktif edildi.', 'success');
      }
      await checkFfmpegStatus();
    } else {
      if (typeof window.showToast === 'function') {
        window.showToast(data.error || 'FFmpeg kopyalanamadı.', 'error');
      }
    }
  } catch (err) {
    console.error('Error syncing FFmpeg:', err);
    if (typeof window.showToast === 'function') {
      window.showToast(err.message, 'error');
    }
  } finally {
    if (syncBtn) {
      syncBtn.disabled = false;
      syncBtn.innerText = originalText;
    }
  }
}

export function openFfmpegModal() {
  const modal = document.getElementById('ffmpeg-installer-modal');
  if (modal) {
    modal.classList.remove('hidden');
    // Hide close actions until finished or failed
    const closeActionBtn = document.getElementById('ffmpeg-modal-close-action-btn');
    if (closeActionBtn) closeActionBtn.classList.add('hidden');
  }
}

export function closeFfmpegModal() {
  const modal = document.getElementById('ffmpeg-installer-modal');
  if (modal) modal.classList.add('hidden');
}

export function updateFfmpegInstallUI(data) {
  const isEn = window.localDb?.settings?.lang === 'en';
  const progressBar = document.getElementById('ffmpeg-progress-bar');
  const statusText = document.getElementById('ffmpeg-status-text');
  const closeActionBtn = document.getElementById('ffmpeg-modal-close-action-btn');
  
  if (progressBar) {
    progressBar.style.width = `${data.progress}%`;
    progressBar.style.background = ''; // reset color
  }
  
  if (statusText) {
    if (data.status === 'downloading') {
      statusText.innerText = isEn ? `Downloading: %${data.progress}` : `İndiriliyor: %${data.progress}`;
      statusText.style.color = 'var(--primary)';
    } else if (data.status === 'extracting') {
      statusText.innerText = isEn ? 'Extracting archive...' : 'Arşivden Çıkarılıyor...';
      statusText.style.color = 'var(--secondary)';
    } else if (data.status === 'completed') {
      statusText.innerText = isEn ? 'Installation Completed Successfully!' : 'Kurulum Başarıyla Tamamlandı!';
      statusText.style.color = 'var(--success-color)';
      if (closeActionBtn) closeActionBtn.classList.remove('hidden');
      checkFfmpegStatus();
    } else if (data.status === 'failed') {
      statusText.innerText = isEn ? `Installation Failed: ${data.error}` : `Kurulum Başarısız: ${data.error}`;
      statusText.style.color = 'var(--danger-color)';
      if (progressBar) progressBar.style.background = 'var(--danger-color)';
      if (closeActionBtn) closeActionBtn.classList.remove('hidden');
    }
  }
}

export async function startFfmpegDownload() {
  const isEn = window.localDb?.settings?.lang === 'en';
  openFfmpegModal();
  
  const progressBar = document.getElementById('ffmpeg-progress-bar');
  const statusText = document.getElementById('ffmpeg-status-text');
  if (progressBar) progressBar.style.width = '0%';
  if (statusText) statusText.innerText = isEn ? 'Starting installation...' : 'Kurulum başlatılıyor...';
  
  try {
    const res = await fetch('/api/ffmpeg/download', { method: 'POST' });
    const data = await res.json();
    if (data.success) {
      if (data.state) {
        updateFfmpegInstallUI(data.state);
      }
    } else {
      if (statusText) {
        statusText.innerText = data.message || (isEn ? 'Failed to start download' : 'İndirme başlatılamadı');
        statusText.style.color = 'var(--danger-color)';
      }
    }
  } catch (err) {
    console.error('Error starting FFmpeg download:', err);
    if (statusText) {
      statusText.innerText = isEn ? 'Connection error' : 'Bağlantı hatası';
      statusText.style.color = 'var(--danger-color)';
    }
  }
}

export function initFfmpegEvents() {
  const bannerInstallBtn = document.getElementById('ffmpeg-banner-install-btn');
  const bannerCloseBtn = document.getElementById('ffmpeg-banner-close-btn');
  const settingsFfmpegBtn = document.getElementById('settings-ffmpeg-btn');
  const settingsFfmpegSyncBtn = document.getElementById('settings-ffmpeg-sync-btn');
  const closeFfmpegModalBtn = document.getElementById('close-ffmpeg-modal-btn');
  const ffmpegModalCloseActionBtn = document.getElementById('ffmpeg-modal-close-action-btn');
  const banner = document.getElementById('ffmpeg-info-banner');

  if (bannerInstallBtn) {
    bannerInstallBtn.addEventListener('click', startFfmpegDownload);
  }

  if (bannerCloseBtn) {
    bannerCloseBtn.addEventListener('click', () => {
      if (banner) banner.classList.add('hidden');
      localStorage.setItem('ffmpeg_banner_dismissed', 'true');
    });
  }

  if (settingsFfmpegBtn) {
    settingsFfmpegBtn.addEventListener('click', startFfmpegDownload);
  }

  if (settingsFfmpegSyncBtn) {
    settingsFfmpegSyncBtn.addEventListener('click', syncFfmpegFromSystem);
  }

  if (closeFfmpegModalBtn) {
    closeFfmpegModalBtn.addEventListener('click', closeFfmpegModal);
  }

  if (ffmpegModalCloseActionBtn) {
    ffmpegModalCloseActionBtn.addEventListener('click', closeFfmpegModal);
  }
}

// Global window bindings for inline HTML or SSE handlers
window.checkFfmpegStatus = checkFfmpegStatus;
window.syncFfmpegFromSystem = syncFfmpegFromSystem;
window.openFfmpegModal = openFfmpegModal;
window.closeFfmpegModal = closeFfmpegModal;
window.updateFfmpegInstallUI = updateFfmpegInstallUI;
window.startFfmpegDownload = startFfmpegDownload;
