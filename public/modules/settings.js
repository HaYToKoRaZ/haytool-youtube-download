/**
 * Ayarlar, Tema, Sistem Yedekleme ve GitHub Gist Modülü (settings.js)
 * 
 * Yapımcı: HaYTo
 * Açıklama: Tema yönetimi, ayarlar formu otomatik kaydetme, alt sekme geçişleri,
 *            sistem yedekleme/geri yükleme ve GitHub Gist senkronizasyon işlevleri.
 * Bağımlılıklar: app.js getState() fonksiyonu ile localDb, currentLang, translations erişimi sağlanır.
 */

import { translations } from '../utils/i18n.js';
import { showToast } from '../components/toast.js';

let _getState = null;

export function initSettings(getState) {
  _getState = getState;
}

const localDb = new Proxy({}, {
  get(target, prop) {
    const db = (_getState?.().localDb) || window.localDb || { history: [], channels: [], settings: {}, categories: [] };
    return db[prop];
  },
  set(target, prop, value) {
    const db = (_getState?.().localDb) || window.localDb || {};
    db[prop] = value;
    return true;
  }
});

let currentLang = 'tr';

// ==========================================
// Tema Yönetimi
// ==========================================

export function applyTheme(themeName) {
  document.body.classList.remove('light-theme', 'matrix-theme', 'discord-theme', 'youtube-theme');
  if (themeName !== 'dark') {
    document.body.classList.add(themeName + '-theme');
  }
  localStorage.setItem('haytool_theme', themeName);

  document.querySelectorAll('.theme-btn').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-theme') === themeName);
  });

  const headerThemeBtn = document.getElementById('btn-header-theme-toggle');
  if (headerThemeBtn) {
    const icon = headerThemeBtn.querySelector('i');
    if (icon) {
      icon.setAttribute('data-lucide', themeName === 'light' ? 'moon' : 'sun');
      if (typeof lucide !== 'undefined' && lucide.createIcons) {
        lucide.createIcons();
      }
    }
  }
}
window.applyTheme = applyTheme;

export function toggleQuickTheme() {
  const current = localStorage.getItem('haytool_theme') || 'dark';
  const next = current === 'light' ? 'dark' : 'light';
  applyTheme(next);
}
window.toggleQuickTheme = toggleQuickTheme;

// ==========================================
// Ayarlar Otomatik Kaydetme (Auto-Save)
// ==========================================

let autoSaveTimer = null;

export function triggerAutoSave(immediate = false) {
  if (autoSaveTimer) clearTimeout(autoSaveTimer);
  if (immediate) {
    performAutoSave();
  } else {
    autoSaveTimer = setTimeout(performAutoSave, 500);
  }
}
window.triggerAutoSave = triggerAutoSave;

export async function performAutoSave() {
  const settings = localDb.settings || {};
  const isEn = settings.lang === 'en';

  const downloadPathInput = document.getElementById('settings-download-path');
  const tempDirTypeSelect = document.getElementById('settings-temp-dir-type');
  const durationFetchMethodSelect = document.getElementById('settings-duration-fetch-method');
  const ytdlpRunModeSelect = document.getElementById('settings-ytdlp-run-mode');
  const pythonCmdInput = document.getElementById('settings-python-cmd');
  const browserSelect = document.getElementById('settings-browser');
  const qualitySelect = document.getElementById('settings-quality');
  const maxResSelect = document.getElementById('settings-max-resolution');
  const embedSubsCheckbox = document.getElementById('settings-embed-subs');
  const preferIdSubtitleCheckbox = document.getElementById('settings-prefer-id-subtitle');
  const checkIntervalInput = document.getElementById('settings-check-interval');
  const autoDownloadCheckbox = document.getElementById('settings-auto-download');
  const limitInput = document.getElementById('settings-history-limit');
  const queueConcurrencySelect = document.getElementById('queue-concurrent-limit');

  if (downloadPathInput) settings.downloadPath = downloadPathInput.value.trim();
  if (tempDirTypeSelect) settings.tempDirType = tempDirTypeSelect.value;
  if (durationFetchMethodSelect) settings.durationFetchMethod = durationFetchMethodSelect.value;
  if (ytdlpRunModeSelect) settings.ytdlpRunMode = ytdlpRunModeSelect.value;
  if (pythonCmdInput) settings.pythonCmd = pythonCmdInput.value.trim();
  if (browserSelect) settings.browser = browserSelect.value;
  if (qualitySelect) settings.quality = qualitySelect.value;
  if (maxResSelect) settings.maxResolution = maxResSelect.value;
  if (embedSubsCheckbox) settings.embedSubtitles = embedSubsCheckbox.checked;
  if (preferIdSubtitleCheckbox) settings.preferIdSubtitle = preferIdSubtitleCheckbox.checked;
  if (checkIntervalInput) settings.checkInterval = parseInt(checkIntervalInput.value, 10) || 15;
  if (autoDownloadCheckbox) settings.autoDownload = autoDownloadCheckbox.checked;
  if (limitInput) settings.historyLimitPerChannel = parseInt(limitInput.value, 10) || 30;
  if (queueConcurrencySelect) settings.maxConcurrentDownloads = parseInt(queueConcurrencySelect.value, 10) || 2;

  try {
    const res = await fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings)
    });
    const result = await res.json();
    if (result.success) {
      const autoSaveIndicator = document.getElementById('settings-auto-save-indicator');
      if (autoSaveIndicator) {
        autoSaveIndicator.classList.remove('hidden');
        setTimeout(() => autoSaveIndicator.classList.add('hidden'), 2000);
      }
    }
  } catch (err) {
    console.error('performAutoSave error:', err);
  }
}
window.performAutoSave = performAutoSave;

// ==========================================
// Ayarlar Alt Sekmeleri (Subtabs)
// ==========================================

export function initSettingsSubtabs() {
  const subtabButtons = document.querySelectorAll('.settings-subtab-btn');
  const subtabPanels = document.querySelectorAll('.settings-subtab-panel');

  subtabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetSubtab = btn.getAttribute('data-subtab');
      subtabButtons.forEach(b => b.classList.toggle('active', b === btn));
      subtabPanels.forEach(p => {
        p.classList.toggle('active', p.id === 'settings-subtab-' + targetSubtab);
      });
      if (typeof lucide !== 'undefined' && lucide.createIcons) {
        lucide.createIcons();
      }
    });
  });
}

// ==========================================
// Sistem Yedekleme & Geri Yükleme
// ==========================================

export async function createSystemBackup() {
  const isEn = localDb.settings?.lang === 'en';
  try {
    showToast(isEn ? 'Creating backup...' : 'Yedek oluşturuluyor...', 'info');
    const res = await fetch('/api/backup', { method: 'POST' });
    const data = await res.json();
    if (data.success) {
      showToast(isEn ? 'Backup created successfully!' : 'Yedek başarıyla oluşturuldu!', 'success');
      loadSystemBackupsList();
    } else {
      showToast(data.error || (isEn ? 'Failed to create backup.' : 'Yedek oluşturulamadı.'), 'error');
    }
  } catch (err) {
    showToast(isEn ? 'Connection error.' : 'Bağlantı hatası.', 'error');
  }
}
window.createSystemBackup = createSystemBackup;

export async function loadSystemBackupsList() {
  const container = document.getElementById('system-backups-list');
  if (!container) return;
  const isEn = localDb.settings?.lang === 'en';

  try {
    const res = await fetch('/api/backups');
    const data = await res.json();
    if (!data.success || !data.backups || data.backups.length === 0) {
      container.innerHTML = `<div class="text-center text-muted" style="padding:20px 0; font-size:0.85rem;">${isEn ? 'No backups available.' : 'Kayıtlı sistem yedeği bulunamadı.'}</div>`;
      return;
    }

    container.innerHTML = data.backups.map(b => {
      const dateStr = b.date ? new Date(b.date).toLocaleString('tr-TR') : b.name;
      const sizeStr = b.size ? (b.size / 1024).toFixed(1) + ' KB' : '';
      return `
        <div class="backup-item card" style="display:flex; justify-content:space-between; align-items:center; padding:10px 14px; margin-bottom:8px;">
          <div>
            <div style="font-weight:600; font-size:0.9rem; color:var(--text-main);">${b.name}</div>
            <div style="font-size:0.75rem; color:var(--text-muted);">${dateStr} ${sizeStr ? '• ' + sizeStr : ''}</div>
          </div>
          <div style="display:flex; gap:6px;">
            <button class="btn btn-secondary btn-xs" onclick="downloadSystemBackup('${b.name}')" title="${isEn ? 'Download' : 'İndir'}">
              <i data-lucide="download" style="width:12px; height:12px;"></i>
            </button>
            <button class="btn btn-primary btn-xs" onclick="restoreSystemBackup('${b.name}')" title="${isEn ? 'Restore' : 'Geri Yükle'}">
              <i data-lucide="rotate-ccw" style="width:12px; height:12px;"></i>
            </button>
            <button class="btn btn-danger btn-xs" onclick="deleteSystemBackup('${b.name}')" title="${isEn ? 'Delete' : 'Sil'}">
              <i data-lucide="trash-2" style="width:12px; height:12px;"></i>
            </button>
          </div>
        </div>
      `;
    }).join('');

    if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
  } catch (err) {
    console.error('loadSystemBackupsList error:', err);
  }
}
window.loadSystemBackupsList = loadSystemBackupsList;

export async function restoreSystemBackup(filename) {
  const isEn = localDb.settings?.lang === 'en';
  if (!confirm(isEn ? `Are you sure you want to restore "${filename}"? Current data will be replaced.` : `"${filename}" yedeğini geri yüklemek istediğinize emin misiniz? Mevcut verilerin üzerine yazılacaktır.`)) return;

  try {
    showToast(isEn ? 'Restoring backup...' : 'Yedek geri yükleniyor...', 'info');
    const res = await fetch('/api/restore', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename })
    });
    const data = await res.json();
    if (data.success) {
      showToast(isEn ? 'Backup restored! Reloading...' : 'Yedek başarıyla geri yüklendi! Sayfa yenileniyor...', 'success');
      setTimeout(() => window.location.reload(), 1500);
    } else {
      showToast(data.error || (isEn ? 'Failed to restore backup.' : 'Yedek geri yüklenemedi.'), 'error');
    }
  } catch (err) {
    showToast(isEn ? 'Connection error.' : 'Bağlantı hatası.', 'error');
  }
}
window.restoreSystemBackup = restoreSystemBackup;

export function downloadSystemBackup(filename) {
  window.open('/api/backups/' + encodeURIComponent(filename), '_blank');
}
window.downloadSystemBackup = downloadSystemBackup;

export async function deleteSystemBackup(filename) {
  const isEn = localDb.settings?.lang === 'en';
  if (!confirm(isEn ? `Are you sure you want to delete "${filename}"?` : `"${filename}" yedeğini silmek istediğinize emin misiniz?`)) return;

  try {
    const res = await fetch('/api/backups/' + encodeURIComponent(filename), { method: 'DELETE' });
    const data = await res.json();
    if (data.success) {
      showToast(isEn ? 'Backup deleted.' : 'Yedek silindi.', 'success');
      loadSystemBackupsList();
    } else {
      showToast(data.error || (isEn ? 'Failed to delete backup.' : 'Yedek silinemedi.'), 'error');
    }
  } catch (err) {
    showToast(isEn ? 'Connection error.' : 'Bağlantı hatası.', 'error');
  }
}
window.deleteSystemBackup = deleteSystemBackup;

export function triggerUploadBackupFile() {
  const fileInput = document.getElementById('backup-upload-input');
  if (fileInput) fileInput.click();
}
window.triggerUploadBackupFile = triggerUploadBackupFile;

export async function uploadBackupFile(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  const isEn = localDb.settings?.lang === 'en';

  if (!confirm(isEn ? `Are you sure you want to restore from "${file.name}"? Current data will be replaced.` : `"${file.name}" dosyasındaki yedeği geri yüklemek istediğinize emin misiniz? Mevcut verilerin üzerine yazılacaktır.`)) {
    event.target.value = '';
    return;
  }

  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      showToast(isEn ? 'Uploading and restoring backup...' : 'Yedek dosyası aktarılıyor ve geri yükleniyor...', 'info');
      const fileData = e.target.result;
      const res = await fetch('/api/restore-upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileData, filename: file.name })
      });
      const data = await res.json();
      if (data.success) {
        showToast(isEn ? 'Backup restored! Reloading...' : 'Yedek başarıyla yüklendi ve geri yüklendi! Sayfa yenileniyor...', 'success');
        setTimeout(() => window.location.reload(), 1500);
      } else {
        showToast(data.error || (isEn ? 'Failed to restore backup.' : 'Yedek dosyası geri yüklenemedi.'), 'error');
      }
    } catch (err) {
      showToast(isEn ? 'Connection error.' : 'Bağlantı hatası.', 'error');
    } finally {
      event.target.value = '';
    }
  };
  reader.readAsDataURL(file);
}
window.uploadBackupFile = uploadBackupFile;

// ==========================================
// GitHub Gist Senkronizasyon İşlevleri
// ==========================================

export function toggleGistTokenVisibility() {
  const input = document.getElementById('gist-token-input');
  const icon = document.getElementById('gist-token-eye-icon');
  if (!input) return;

  if (input.type === 'password') {
    input.type = 'text';
    if (icon) icon.setAttribute('data-lucide', 'eye-off');
  } else {
    input.type = 'password';
    if (icon) icon.setAttribute('data-lucide', 'eye');
  }
  try { if (typeof lucide !== 'undefined') lucide.createIcons(); } catch (e) {}
}
window.toggleGistTokenVisibility = toggleGistTokenVisibility;

export async function testGistToken() {
  const input = document.getElementById('gist-token-input');
  const token = input ? input.value.trim() : '';
  const isEn = localDb.settings?.lang === 'en';

  if (!token) {
    showToast(isEn ? 'Please enter a GitHub Token.' : 'Lütfen bir GitHub Token girin.', 'error');
    return;
  }

  try {
    showToast(isEn ? 'Verifying GitHub Token...' : 'GitHub Token doğrulanıyor...', 'info');
    const res = await fetch('/api/gist/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token })
    });
    const data = await res.json();

    if (data.success) {
      if (data.warning) {
        showToast(data.warning, 'warning');
      } else {
        showToast(isEn ? `Token verified! Connected as: ${data.username}` : `Token doğrulandı! Bağlanan kullanıcı: ${data.username}`, 'success');
      }
    } else {
      showToast(data.error || (isEn ? 'Token verification failed.' : 'Token doğrulaması başarısız.'), 'error');
    }
  } catch (err) {
    showToast(isEn ? 'Connection error.' : 'Bağlantı hatası.', 'error');
  }
}
window.testGistToken = testGistToken;

export async function pushGistChannels() {
  const tokenInput = document.getElementById('gist-token-input');
  const idInput = document.getElementById('gist-id-input');
  const autoSyncCheckbox = document.getElementById('gist-auto-sync-checkbox');

  let token = tokenInput && tokenInput.value ? tokenInput.value.trim() : '';
  if (!token && localDb.settings?.githubToken) token = localDb.settings.githubToken;
  let gistId = idInput && idInput.value ? idInput.value.trim() : '';
  if (!gistId && localDb.settings?.githubGistId) gistId = localDb.settings.githubGistId;
  const autoSync = autoSyncCheckbox ? autoSyncCheckbox.checked : false;
  const isEn = localDb.settings?.lang === 'en';

  if (!token) {
    showToast(isEn ? 'GitHub Token missing. Please enter a new token.' : 'GitHub Token bulunamadı. Lütfen yeni bir token girin veya Token\'ı Sil\'e basıp tekrar kaydedin.', 'error');
    return;
  }

  try {
    showToast(isEn ? 'Uploading system data to GitHub Gist...' : 'Sistem verileri GitHub Gist üzerine aktarılıyor...', 'info');
    const res = await fetch('/api/gist/push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, gistId, autoSync })
    });
    const data = await res.json();

    if (data.success) {
      if (idInput && data.gistId) idInput.value = data.gistId;
      if (localDb.settings) {
        localDb.settings.githubToken = token;
        localDb.settings.githubGistId = data.gistId || gistId;
        localDb.settings.autoSyncGist = autoSync;
      }
      populateGistFields();
      triggerAutoSave(true);
      showToast(isEn ? 'System data uploaded to GitHub Gist successfully!' : 'Sistem verileri başarıyla GitHub Gist üzerine yüklendi!', 'success');
    } else {
      let errMsg = data.error || (isEn ? 'Push failed.' : 'Gist yüklemesi başarısız.');
      if (errMsg.toLowerCase().includes('bad credentials') || errMsg.includes('401')) {
        errMsg = isEn ? 'Invalid or revoked GitHub Token. Please delete and save a new token.' : 'GitHub Token\'ı geçersiz veya iptal edilmiş. Lütfen "Token\'ı Sil"e basıp yeni bir token kaydedin.';
      }
      showToast(errMsg, 'error');
    }
  } catch (err) {
    showToast(isEn ? 'Connection error.' : 'Bağlantı hatası.', 'error');
  }
}
window.pushGistChannels = pushGistChannels;

export async function pullGistChannels() {
  const tokenInput = document.getElementById('gist-token-input');
  const idInput = document.getElementById('gist-id-input');

  let token = tokenInput && tokenInput.value ? tokenInput.value.trim() : '';
  if (!token && localDb.settings?.githubToken) token = localDb.settings.githubToken;
  let gistId = idInput && idInput.value ? idInput.value.trim() : '';
  if (!gistId && localDb.settings?.githubGistId) gistId = localDb.settings.githubGistId;
  const isEn = localDb.settings?.lang === 'en';

  if (!token || !gistId) {
    showToast(isEn ? 'Please enter both GitHub Token and Gist ID.' : 'Lütfen hem GitHub Token hem de Gist ID girin.', 'error');
    return;
  }

  try {
    showToast(isEn ? 'Downloading system data from GitHub Gist...' : 'Sistem verileri GitHub Gist üzerinden indiriliyor...', 'info');
    const res = await fetch('/api/gist/pull', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, gistId })
    });
    const data = await res.json();

    if (data.success) {
      if (localDb.settings) {
        localDb.settings.githubToken = token;
        localDb.settings.githubGistId = gistId;
      }
      populateGistFields();
      triggerAutoSave(true);
      showToast(isEn ? 'System data pulled from Gist successfully!' : 'Sistem verileri Gist üzerinden başarıyla yüklendi!', 'success');
      setTimeout(() => window.location.reload(), 1200);
    } else {
      let errMsg = data.error || (isEn ? 'Pull failed.' : 'Gist indirmesi başarısız.');
      if (errMsg.toLowerCase().includes('bad credentials') || errMsg.includes('401')) {
        errMsg = isEn ? 'Invalid or revoked GitHub Token. Please delete and save a new token.' : 'GitHub Token\'ı geçersiz veya iptal edilmiş. Lütfen "Token\'ı Sil"e basıp yeni bir token kaydedin.';
      }
      showToast(errMsg, 'error');
    }
  } catch (err) {
    showToast(isEn ? 'Connection error.' : 'Bağlantı hatası.', 'error');
  }
}
window.pullGistChannels = pullGistChannels;

export function toggleAutoSyncGist(checked) {
  if (localDb.settings) {
    localDb.settings.autoSyncGist = checked;
  }
}
window.toggleAutoSyncGist = toggleAutoSyncGist;

export function populateGistFields() {
  if (!localDb.settings) return;
  const tokenInput = document.getElementById('gist-token-input');
  const idInput = document.getElementById('gist-id-input');
  const autoSyncCheckbox = document.getElementById('gist-auto-sync-checkbox');
  const linkContainer = document.getElementById('gist-online-link-container');
  const linkEl = document.getElementById('gist-online-link');

  const unregState = document.getElementById('gist-unregistered-state');
  const regState = document.getElementById('gist-registered-state');
  const hasSavedToken = !!(localDb.settings.githubToken && localDb.settings.githubToken.trim());

  if (unregState && regState) {
    if (hasSavedToken) {
      unregState.style.display = 'none';
      regState.style.display = 'block';
    } else {
      unregState.style.display = 'block';
      regState.style.display = 'none';
    }
  }

  if (tokenInput && localDb.settings.githubToken !== undefined) {
    if (document.activeElement !== tokenInput) {
      tokenInput.value = localDb.settings.githubToken || '';
    }
  }
  if (idInput && localDb.settings.githubGistId !== undefined) {
    if (document.activeElement !== idInput) {
      idInput.value = localDb.settings.githubGistId || '';
    }
  }
  if (autoSyncCheckbox && localDb.settings.autoSyncGist !== undefined) {
    if (document.activeElement !== autoSyncCheckbox) {
      autoSyncCheckbox.checked = !!localDb.settings.autoSyncGist;
    }
  }

  const gistId = (idInput && idInput.value ? idInput.value.trim() : '') || (localDb.settings && localDb.settings.githubGistId) || '';
  if (linkContainer && linkEl) {
    if (gistId) {
      linkEl.href = 'https://gist.github.com/' + gistId;
      linkContainer.style.display = 'block';
    } else {
      linkContainer.style.display = 'none';
    }
  }
}
window.populateGistFields = populateGistFields;

export async function saveGistToken() {
  const tokenInput = document.getElementById('gist-token-input');
  const idInput = document.getElementById('gist-id-input');
  const token = tokenInput ? tokenInput.value.trim() : '';
  const gistId = idInput ? idInput.value.trim() : '';
  const isEn = localDb.settings?.lang === 'en';

  if (!token) {
    showToast(isEn ? 'Please enter a GitHub Token.' : 'Lütfen geçerli bir GitHub Token girin.', 'error');
    return;
  }

  showToast(isEn ? 'Verifying token...' : 'Token doğrulanıyor...', 'info');

  try {
    const res = await fetch('/api/gist/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token })
    });
    const data = await res.json();

    if (data.success) {
      if (localDb.settings) {
        localDb.settings.githubToken = token;
        localDb.settings.githubGistId = gistId;
      }
      populateGistFields();
      triggerAutoSave(true);
      const username = data.username || data.user || '';
      showToast(isEn ? `Token verified and saved! Account: @${username}` : `Token başarıyla doğrulandı ve kaydedildi! Kullanıcı: @${username}`, 'success');
    } else {
      showToast(data.error || (isEn ? 'Token is invalid.' : 'Token geçersiz.'), 'error');
    }
  } catch (err) {
    showToast(isEn ? 'Connection error.' : 'Bağlantı hatası.', 'error');
  }
}
window.saveGistToken = saveGistToken;

export async function deleteGistToken() {
  const isEn = localDb.settings?.lang === 'en';
  if (!confirm(isEn ? 'Are you sure you want to remove your GitHub Token credentials from this device?' : 'GitHub Token ve bağlantı bilgilerinizi bu bilgisayardan silmek istediğinize emin misiniz?')) return;

  if (localDb.settings) {
    localDb.settings.githubToken = '';
    localDb.settings.githubGistId = '';
  }

  const tokenInput = document.getElementById('gist-token-input');
  const idInput = document.getElementById('gist-id-input');
  if (tokenInput) tokenInput.value = '';
  if (idInput) idInput.value = '';

  populateGistFields();
  triggerAutoSave(true);
  showToast(isEn ? 'GitHub Token removed.' : 'GitHub Token ve bağlantı bilgileri silindi.', 'info');
}
window.deleteGistToken = deleteGistToken;

// ==========================================
// YouTube Oturum ve Çerez Durumu
// ==========================================

export async function checkYouTubeAuthStatus() {
  const badgeEl = document.getElementById('cookie-status-badge');
  const topbarCookieBadge = document.getElementById('badge-cookie');
  const topbarCookieIndicator = document.getElementById('cookie-test-indicator');

  const currentLang = localStorage.getItem('haytool_user_lang') || 'tr';
  const t = translations[currentLang] || translations.tr;

  try {
    const res = await fetch('/api/youtube-auth-status');
    const data = await res.json();
    const isAuthActive = data.success && data.activeSource && data.activeSource !== 'none';

    if (isAuthActive) {
      if (badgeEl) {
        badgeEl.style.background = 'rgba(34, 197, 94, 0.15)';
        badgeEl.style.color = '#22c55e';
        badgeEl.style.border = '1px solid rgba(34, 197, 94, 0.3)';
        badgeEl.innerHTML = `<i data-lucide="shield-check" style="width: 12px; height: 12px;"></i> <span>${t.cookie_status_active || 'Oturum Aktif (Bot Koruması Devre Dışı)'}</span>`;
      }

      if (topbarCookieBadge) {
        topbarCookieBadge.title = t.topbar_cookie_active || 'YouTube Oturumu Aktif (4K/1080p ve Bot Koruması Devrede)';
      }
      if (topbarCookieIndicator) {
        topbarCookieIndicator.style.backgroundColor = '#22c55e';
        topbarCookieIndicator.style.boxShadow = '0 0 6px rgba(34, 197, 94, 0.8)';
        topbarCookieIndicator.title = 'YouTube Oturumu Doğrulandı';
      }
    } else {
      if (badgeEl) {
        badgeEl.style.background = 'rgba(239, 68, 68, 0.15)';
        badgeEl.style.color = '#ef4444';
        badgeEl.style.border = '1px solid rgba(239, 68, 68, 0.3)';
        badgeEl.innerHTML = `<i data-lucide="shield-alert" style="width: 12px; height: 12px;"></i> <span>${t.cookie_status_anon || 'Oturum Açılmamış (Anonim Mod)'}</span>`;
      }

      if (topbarCookieBadge) {
        topbarCookieBadge.title = t.topbar_cookie_inactive || 'YouTube Oturumu Açılmamış (Anonim Mod - 360p veya Bot Riski)';
      }
      if (topbarCookieIndicator) {
        topbarCookieIndicator.style.backgroundColor = '#ef4444';
        topbarCookieIndicator.style.boxShadow = 'none';
        topbarCookieIndicator.title = 'YouTube Oturumu Bulunamadı';
      }
    }
    if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
  } catch (e) {
    console.error('YouTube auth status error:', e);
  }
}
window.checkYouTubeAuthStatus = checkYouTubeAuthStatus;

export async function testCookies() {
  const currentLang = localStorage.getItem('haytool_user_lang') || 'tr';
  showToast(currentLang === 'en' ? 'Verifying YouTube cookies...' : 'YouTube çerezleri doğrulanıyor...', 'info');

  try {
    const res = await fetch('/api/test-cookies');
    const data = await res.json();
    if (data.success) {
      showToast(data.message || 'Çerezler başarıyla doğrulandı.', 'success');
    } else {
      showToast(data.error || 'Çerez doğrulama başarısız.', 'warning');
    }
    checkYouTubeAuthStatus();
  } catch (e) {
    showToast('Sunucu ile iletişim hatası.', 'error');
  }
}
window.testCookies = testCookies;

export async function logoutYouTube() {
  const currentLang = localStorage.getItem('haytool_user_lang') || 'tr';
  const t = translations[currentLang] || translations.tr;

  const confirmMsg = t.logout_youtube_confirm || 'YouTube oturumunu kapatmak ve yerel çerezleri temizlemek istediğinizden emin misiniz?';
  if (!confirm(confirmMsg)) return;

  showToast(currentLang === 'en' ? 'Signing out of YouTube...' : 'YouTube oturumu kapatılıyor...', 'info');

  try {
    const res = await fetch('/api/logout-youtube', { method: 'POST' });
    const data = await res.json();
    if (data.success) {
      showToast(t.logout_youtube_success || 'YouTube oturumu başarıyla kapatıldı.', 'success');
    } else {
      showToast(data.error || 'Oturum kapatılırken hata oluştu.', 'error');
    }
    checkYouTubeAuthStatus();
  } catch (e) {
    showToast('Sunucu ile iletişim hatası.', 'error');
  }
}
window.logoutYouTube = logoutYouTube;

export async function openYouTubeLogin() {
  const currentLang = localStorage.getItem('haytool_user_lang') || 'tr';
  const loginUrl = 'https://accounts.google.com/ServiceLogin?service=youtube&continue=https%3A%2F%2Fwww.youtube.com';
  showToast(currentLang === 'en' ? 'Opening YouTube login window...' : 'YouTube oturum açma sayfası açılıyor...', 'info');

  try {
    window.open(loginUrl, '_blank');
  } catch (e) {}

  try {
    await fetch('/api/open-youtube-login', { method: 'POST' });
  } catch (e) {}
}
window.openYouTubeLogin = openYouTubeLogin;
