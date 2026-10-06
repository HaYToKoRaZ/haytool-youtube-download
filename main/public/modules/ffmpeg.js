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
    const versionBadge = document.getElementById('settings-ffmpeg-version-info');
    
    const isEn = langKey === 'en';
    const isAr = langKey === 'ar';
    const isEs = langKey === 'es';
    const isDe = langKey === 'de';
    const isPt = langKey === 'pt';
    const isRu = langKey === 'ru';

    let localPrefix = 'Yerel:';
    let remotePrefix = 'Uzak:';
    if (isEn) { localPrefix = 'Local:'; remotePrefix = 'Remote:'; }
    else if (isEs) { localPrefix = 'Local:'; remotePrefix = 'Remoto:'; }
    else if (isDe) { localPrefix = 'Lokal:'; remotePrefix = 'Remote:'; }
    else if (isPt) { localPrefix = 'Local:'; remotePrefix = 'Remoto:'; }
    else if (isAr) { localPrefix = 'المحلي:'; remotePrefix = 'البعيد:'; }
    else if (isRu) { localPrefix = 'Локально:'; remotePrefix = 'Удаленно:'; }

    if (versionBadge) {
      if (data.installed && data.localVersion) {
        versionBadge.style.display = 'inline-block';
        versionBadge.innerText = `${localPrefix} ${data.localVersion} | ${remotePrefix} ${data.remoteVersion || 'v6.1'}`;
      } else if (data.remoteVersion) {
        versionBadge.style.display = 'inline-block';
        versionBadge.innerText = `${remotePrefix} ${data.remoteVersion}`;
      } else {
        versionBadge.style.display = 'none';
      }
    }

    if (data.installed) {
      if (banner) banner.classList.add('hidden');
      if (statusIndicator) {
        statusIndicator.innerText = t.ffmpeg_status_installed || 'Kurulu';
        statusIndicator.className = 'ffmpeg-status-indicator installed';
      }
      if (settingsBtn) {
        settingsBtn.innerText = t.ffmpeg_btn_reinstall || 'Yeniden Kur';
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
  } catch (err) {
    console.error('Error checking FFmpeg status:', err);
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

  if (closeFfmpegModalBtn) {
    closeFfmpegModalBtn.addEventListener('click', closeFfmpegModal);
  }

  if (ffmpegModalCloseActionBtn) {
    ffmpegModalCloseActionBtn.addEventListener('click', closeFfmpegModal);
  }
}

// Global window bindings for inline HTML or SSE handlers
window.checkFfmpegStatus = checkFfmpegStatus;
window.openFfmpegModal = openFfmpegModal;
window.closeFfmpegModal = closeFfmpegModal;
window.updateFfmpegInstallUI = updateFfmpegInstallUI;
window.startFfmpegDownload = startFfmpegDownload;
