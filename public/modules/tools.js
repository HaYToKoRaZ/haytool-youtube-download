/**
 * Araçlar (Tools) Modülü - HaYTooL YouTube Downloader
 *
 * Yapımcı: HaYTo
 * Açıklama: Dosya Karşılaştırma & Senkronizasyon, Kategori Yönetimi,
 *            APE İzlendi İşaretleme ve Araçlar Sekmesi Mantığı.
 * Bağımlılıklar: app.js getState() fonksiyonu ile localDb, currentLang, translations erişimi sağlanır.
 */

import { escapeHtml } from '../utils/helpers.js';
import { showToast } from '../components/toast.js';

let _getState = null;

let untrackedFilesList = [];
let unrelatedFilesList = [];
let missingFilesList = [];
let scanProgressToast = null;

export function initTools(getState) {
  _getState = getState;

  const compareBtn = document.getElementById('start-compare-btn');
  if (compareBtn) {
    compareBtn.addEventListener('click', runFileComparison);
  }

  const toolsBtn = document.getElementById('tools-btn');
  if (toolsBtn) {
    toolsBtn.addEventListener('click', toggleToolsDropdown);
  }

  document.addEventListener('click', (e) => {
    const dropdown = document.getElementById('tools-dropdown');
    if (dropdown && !dropdown.contains(e.target)) {
      dropdown.classList.remove('open');
    }
  });

  const toolsCompareBtn = document.getElementById('nav-tools-compare-btn');
  if (toolsCompareBtn) {
    toolsCompareBtn.addEventListener('click', (e) => {
      e.preventDefault();
      window.currentToolsSubSection = 'compare';
      if (window.switchTab) window.switchTab('tools');
      showToolsSubSection('compare');
      runFileComparison();
      document.getElementById('tools-dropdown')?.classList.remove('open');
    });
  }

  const toolsCategoriesBtn = document.getElementById('nav-tools-categories-btn');
  if (toolsCategoriesBtn) {
    toolsCategoriesBtn.addEventListener('click', (e) => {
      e.preventDefault();
      window.currentToolsSubSection = 'categories';
      if (window.switchTab) window.switchTab('tools');
      showToolsSubSection('categories');
      document.getElementById('tools-dropdown')?.classList.remove('open');
    });
  }

  const toolsApeBtn = document.getElementById('nav-tools-ape-btn');
  if (toolsApeBtn) {
    toolsApeBtn.addEventListener('click', (e) => {
      e.preventDefault();
      window.currentToolsSubSection = 'ape';
      if (window.switchTab) window.switchTab('tools');
      showToolsSubSection('ape');
      document.getElementById('tools-dropdown')?.classList.remove('open');
    });
  }
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

export async function runFileComparison() {
  const compareBtn = document.getElementById('start-compare-btn');
  const compareLoading = document.getElementById('compare-loading');
  const noIssuesFound = document.getElementById('compare-no-issues');
  const untrackedSection = document.getElementById('untracked-section');
  const unrelatedSection = document.getElementById('unrelated-section');
  const missingSection = document.getElementById('missing-section');
  const compareResults = document.getElementById('compare-results');
  
  if (!compareBtn) return;
  compareBtn.disabled = true;
  
  const isEn = localDb.settings && localDb.settings.lang === 'en';
  const t = translations[localDb.settings?.lang || 'tr'] || translations.tr;
  
  // Show toast when starting comparison
  showToast(isEn ? 'Folder comparison started, scanning physical files...' : 'Dosya karşılaştırması başlatıldı, fiziksel dosyalar taranıyor...', 'info');
  
  // Set button state to comparing
  const compareBtnText = compareBtn.querySelector('#compare-btn-text');
  if (compareBtnText) {
    compareBtnText.textContent = t.compare_btn_running || 'Comparing...';
  }
  if (compareLoading) compareLoading.classList.remove('hidden');
  if (compareResults) compareResults.classList.add('hidden');
  if (noIssuesFound) noIssuesFound.classList.add('hidden');
  if (untrackedSection) untrackedSection.classList.add('hidden');
  if (unrelatedSection) unrelatedSection.classList.add('hidden');
  if (missingSection) missingSection.classList.add('hidden');
  
  try {
    const res = await fetch('/api/tools/compare-files');
    const data = await res.json();
    if (data.success) {
      untrackedFilesList = data.untrackedFiles || [];
      unrelatedFilesList = data.unrelatedFiles || [];
      missingFilesList = data.missingFiles || [];
      
      renderComparisonResults();
    } else {
      showToast(data.error || (isEn ? 'Comparison failed.' : 'Karşılaştırma başarısız.'), 'error');
    }
  } catch (err) {
    showToast(isEn ? 'Connection error.' : 'Bağlantı hatası.', 'error');
  } finally {
    compareBtn.disabled = false;
    if (compareBtnText) {
      compareBtnText.textContent = t.compare_btn || 'Start Comparison';
    }
    if (compareLoading) compareLoading.classList.add('hidden');
  }
}

export async function openFileLocation(filePath) {
  const isEn = localDb.settings && localDb.settings.lang === 'en';
  try {
    const res = await fetch('/api/tools/open-file-location', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filePath })
    });
    const data = await res.json();
    if (!data.success) {
      showToast(data.error || (isEn ? 'Could not open folder.' : 'Klasör açılamadı.'), 'error');
    }
  } catch (err) {
    showToast(isEn ? 'Connection error.' : 'Bağlantı hatası.', 'error');
  }
}

export async function deleteAllUnrelated() {
  const isEn = localDb.settings && localDb.settings.lang === 'en';
  if (unrelatedFilesList.length === 0) return;
  if (!confirm(isEn ? 'Are you sure you want to delete all unrelated files from disk?' : 'Tüm alakasız dosyaları diskten silmek istediğinize emin misiniz?')) {
    return;
  }
  
  try {
    const res = await fetch('/api/tools/fix-files', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'delete-untracked-file',
        filePaths: unrelatedFilesList.map(f => f.filePath)
      })
    });
    const data = await res.json();
    if (data.success) {
      showToast(data.message || (isEn ? 'Operation successful.' : 'İşlem başarılı.'), 'success');
      runFileComparison();
    } else {
      showToast(data.error || (isEn ? 'Operation failed.' : 'İşlem başarısız.'), 'error');
    }
  } catch (err) {
    showToast(isEn ? 'Connection error.' : 'Bağlantı hatası.', 'error');
  }
}

export function renderComparisonResults() {
  const isEn = localDb.settings && localDb.settings.lang === 'en';
  const t = translations[localDb.settings?.lang || 'tr'] || translations.tr;
  
  const noIssuesFound = document.getElementById('compare-no-issues');
  const untrackedSection = document.getElementById('untracked-section');
  const unrelatedSection = document.getElementById('unrelated-section');
  const missingSection = document.getElementById('missing-section');
  const compareResults = document.getElementById('compare-results');
  
  const untrackedBody = document.getElementById('untracked-files-list');
  const unrelatedBody = document.getElementById('unrelated-files-list');
  const missingBody = document.getElementById('missing-files-list');
  
  if (untrackedBody) untrackedBody.innerHTML = '';
  if (unrelatedBody) unrelatedBody.innerHTML = '';
  if (missingBody) missingBody.innerHTML = '';
  
  if (compareResults) compareResults.classList.remove('hidden');
  
  if (untrackedFilesList.length === 0 && unrelatedFilesList.length === 0 && missingFilesList.length === 0) {
    if (noIssuesFound) noIssuesFound.classList.remove('hidden');
    if (untrackedSection) untrackedSection.classList.add('hidden');
    if (unrelatedSection) unrelatedSection.classList.add('hidden');
    if (missingSection) missingSection.classList.add('hidden');
    showToast(isEn ? 'Folder comparison completed. No issues found!' : 'Dosya karşılaştırması tamamlandı. Sorun bulunamadı!', 'success');
    return;
  }
  
  if (noIssuesFound) noIssuesFound.classList.add('hidden');
  
  const summaryBox = document.getElementById('compare-summary-box');
  if (summaryBox) {
    summaryBox.innerHTML = isEn 
      ? `Found ${untrackedFilesList.length} untracked files, ${unrelatedFilesList.length} unrelated files, and ${missingFilesList.length} missing records.`
      : `${untrackedFilesList.length} yetim dosya, ${unrelatedFilesList.length} alakasız dosya ve ${missingFilesList.length} eksik kayıt bulundu.`;
  }
  
  showToast(isEn ? 'Folder comparison completed.' : 'Dosya karşılaştırması tamamlandı.', 'success');
  
  // Untracked Files (Orphans)
  if (untrackedFilesList.length > 0) {
    if (untrackedSection) untrackedSection.classList.remove('hidden');
    untrackedFilesList.forEach(file => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>
          <div class="file-name-cell" title="${file.filePath}">
            <i data-lucide="file-video" class="file-icon"></i>
            <span>${file.filename}</span>
          </div>
        </td>
        <td>${file.channelName || '<span class="text-muted">--</span>'}</td>
        <td class="text-nowrap">${file.fileSize || '--'}</td>
        <td>
          <div class="action-buttons-cell" style="text-align: right;">
            <button class="btn btn-secondary btn-sm" onclick="openFileLocation('${file.filePath.replace(/\\/g, '\\\\')}')" title="${isEn ? 'Open File Location' : 'Dosya Konumunu Aç'}">
              <i data-lucide="external-link"></i>
              <span>${isEn ? 'Open Location' : 'Konumu Aç'}</span>
            </button>
            ${file.id ? `
              <button class="btn btn-primary btn-sm" onclick="fixFileIssue('import', '${file.filePath.replace(/\\/g, '\\\\')}', '${file.id}')">
                <i data-lucide="plus"></i>
                <span>${t.btn_import || 'Import'}</span>
              </button>
            ` : ''}
            <button class="btn btn-danger btn-sm" onclick="fixFileIssue('delete', '${file.filePath.replace(/\\/g, '\\\\')}', '')">
              <i data-lucide="trash-2"></i>
              <span>${t.btn_delete_file || 'Delete'}</span>
            </button>
          </div>
        </td>
      `;
      untrackedBody.appendChild(tr);
    });
  } else {
    if (untrackedSection) untrackedSection.classList.add('hidden');
  }
  
  // Unrelated Files
  if (unrelatedFilesList.length > 0) {
    if (unrelatedSection) unrelatedSection.classList.remove('hidden');
    unrelatedFilesList.forEach(file => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>
          <div class="file-name-cell" title="${file.filePath}">
            <i data-lucide="file" class="file-icon" style="color: var(--text-muted);"></i>
            <span>${file.filename}</span>
          </div>
        </td>
        <td class="text-nowrap">${file.fileSize || '--'}</td>
        <td>
          <div class="action-buttons-cell" style="text-align: right;">
            <button class="btn btn-secondary btn-sm" onclick="openFileLocation('${file.filePath.replace(/\\/g, '\\\\')}')" title="${isEn ? 'Open File Location' : 'Dosya Konumunu Aç'}">
              <i data-lucide="external-link"></i>
              <span>${isEn ? 'Open Location' : 'Konumu Aç'}</span>
            </button>
            <button class="btn btn-danger btn-sm" onclick="fixFileIssue('delete', '${file.filePath.replace(/\\/g, '\\\\')}', '')">
              <i data-lucide="trash-2"></i>
              <span>${t.btn_delete_file || 'Delete'}</span>
            </button>
          </div>
        </td>
      `;
      unrelatedBody.appendChild(tr);
    });
  } else {
    if (unrelatedSection) unrelatedSection.classList.add('hidden');
  }
  
  // Missing Files
  if (missingFilesList.length > 0) {
    if (missingSection) missingSection.classList.remove('hidden');
    missingFilesList.forEach(file => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>
          <div class="file-name-cell" title="${file.filePath || ''}">
            <i data-lucide="video-off" class="file-icon"></i>
            <span>${file.title}</span>
          </div>
        </td>
        <td>${file.channelName || '<span class="text-muted">--</span>'}</td>
        <td>
          <div class="action-buttons-cell" style="text-align: right;">
            <button class="btn btn-primary btn-sm" onclick="downloadMissingVideo('${file.id}', '${escapeHtml(file.title)}', '${escapeHtml(file.channelName || '')}', '${file.channelId || ''}')" title="${isEn ? 'Redownload Video' : 'Videoyu Tekrar İndir'}">
              <i data-lucide="download"></i>
              <span>${isEn ? 'Redownload' : 'Tekrar İndir'}</span>
            </button>
            <button class="btn btn-warning btn-sm" onclick="fixFileIssue('mark_not_downloaded', '', '${file.id}')">
              <i data-lucide="refresh-cw"></i>
              <span>${t.btn_mark_not_downloaded || 'Mark Not Downloaded'}</span>
            </button>
            <button class="btn btn-danger btn-sm" onclick="fixFileIssue('delete_history', '', '${file.id}')">
              <i data-lucide="trash-2"></i>
              <span>${t.btn_delete_history || 'Delete History'}</span>
            </button>
          </div>
        </td>
      `;
      missingBody.appendChild(tr);
    });
  } else {
    if (missingSection) missingSection.classList.add('hidden');
  }
  
  lucide.createIcons();
}

export async function fixFileIssue(actionType, filePath, id) {
  const isEn = localDb.settings && localDb.settings.lang === 'en';
  let body = {};
  
  if (actionType === 'import') {
    const file = untrackedFilesList.find(f => f.filePath === filePath);
    if (!file) return;
    body = {
      action: 'import-untracked-file',
      filesToImport: [{
        id: file.id,
        title: file.title,
        channelName: file.channelName,
        fileSize: file.fileSize,
        filePath: file.filePath
      }]
    };
  } else if (actionType === 'delete') {
    body = {
      action: 'delete-untracked-file',
      filePaths: [filePath]
    };
  } else if (actionType === 'mark_not_downloaded') {
    body = {
      action: 'mark-missing-as-not-downloaded',
      videoIds: [id]
    };
  } else if (actionType === 'delete_history') {
    body = {
      action: 'delete-history-item',
      videoIds: [id]
    };
  }
  
  try {
    const res = await fetch('/api/tools/fix-files', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await res.json();
    if (data.success) {
      showToast(data.message || (isEn ? 'Operation successful.' : 'İşlem başarılı.'), 'success');
      // Refresh comparison
      runFileComparison();
    } else {
      showToast(data.error || (isEn ? 'Operation failed.' : 'İşlem başarısız.'), 'error');
    }
  } catch (err) {
    showToast(isEn ? 'Connection error.' : 'Bağlantı hatası.', 'error');
  }
}

export async function fixAllUntracked(actionType) {
  const isEn = localDb.settings && localDb.settings.lang === 'en';
  if (untrackedFilesList.length === 0) return;
  
  let body = {};
  if (actionType === 'import') {
    // Only import files that have a valid ID
    const filesToImport = untrackedFilesList.filter(f => f.id).map(file => ({
      id: file.id,
      title: file.title,
      channelName: file.channelName,
      fileSize: file.fileSize,
      filePath: file.filePath
    }));
    if (filesToImport.length === 0) {
      showToast(isEn ? 'No files with valid video IDs to import.' : 'İçe aktarılacak geçerli video ID\'sine sahip dosya yok.', 'info');
      return;
    }
    body = {
      action: 'import-untracked-file',
      filesToImport
    };
  } else if (actionType === 'delete') {
    if (!confirm(isEn ? 'Are you sure you want to delete all untracked files from disk?' : 'Tüm yetim dosyaları diskten silmek istediğinize emin misiniz?')) {
      return;
    }
    body = {
      action: 'delete-untracked-file',
      filePaths: untrackedFilesList.map(f => f.filePath)
    };
  }
  
  try {
    const res = await fetch('/api/tools/fix-files', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await res.json();
    if (data.success) {
      showToast(data.message || (isEn ? 'Operation successful.' : 'İşlem başarılı.'), 'success');
      runFileComparison();
    } else {
      showToast(data.error || (isEn ? 'Operation failed.' : 'İşlem başarısız.'), 'error');
    }
  } catch (err) {
    showToast(isEn ? 'Connection error.' : 'Bağlantı hatası.', 'error');
  }
}

export async function fixAllMissing(actionType) {
  const isEn = localDb.settings && localDb.settings.lang === 'en';
  if (missingFilesList.length === 0) return;
  
  let body = {};
  if (actionType === 'mark' || actionType === 'mark_not_downloaded') {
    body = {
      action: 'mark-missing-as-not-downloaded',
      videoIds: missingFilesList.map(f => f.id)
    };
  } else if (actionType === 'delete') {
    if (!confirm(isEn ? 'Are you sure you want to delete all missing videos from history?' : 'Tüm eksik videoları geçmişten silmek istediğinize emin misiniz?')) {
      return;
    }
    body = {
      action: 'delete-history-item',
      videoIds: missingFilesList.map(f => f.id)
    };
  }
  
  try {
    const res = await fetch('/api/tools/fix-files', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await res.json();
    if (data.success) {
      showToast(data.message || (isEn ? 'Operation successful.' : 'İşlem başarılı.'), 'success');
      runFileComparison();
    } else {
      showToast(data.error || (isEn ? 'Operation failed.' : 'İşlem başarısız.'), 'error');
    }
  } catch (err) {
    showToast(isEn ? 'Connection error.' : 'Bağlantı hatası.', 'error');
  }
}

// Hide video from library
window.hideVideo = async function(videoId) {
  if (!videoId) return;
  const isEn = localDb.settings && localDb.settings.lang === 'en';
  try {
    const res = await fetch(`/api/history/${videoId}/hide`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    const data = await res.json();
    if (data.success) {
      showToast(isEn ? 'Video hidden from library.' : 'Video kütüphaneden gizlendi.', 'success');
    } else {
      showToast(data.error || (isEn ? 'Failed to hide video.' : 'Video gizlenemedi.'), 'error');
    }
  } catch (err) {
    showToast(isEn ? 'Connection error.' : 'Bağlantı hatası.', 'error');
  }
};

// Unhide video from library
window.unhideVideo = async function(videoId) {
  if (!videoId) return;
  const isEn = localDb.settings && localDb.settings.lang === 'en';
  try {
    const res = await fetch(`/api/history/${videoId}/unhide`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    const data = await res.json();
    if (data.success) {
      showToast(isEn ? 'Video is now visible in library.' : 'Video kütüphanede tekrar görünür yapıldı.', 'success');
    } else {
      showToast(data.error || (isEn ? 'Failed to unhide video.' : 'Video görünür yapılamadı.'), 'error');
    }
  } catch (err) {
    showToast(isEn ? 'Connection error.' : 'Bağlantı hatası.', 'error');
  }
};

// Filter library/downloaded grid by channel name click
window.filterByChannel = function(channelId, gridId) {
  if (!channelId) return;
  
  if (gridId === 'downloaded-grid') {
    const downloadedChannelFilter = document.getElementById('downloaded-channel-filter');
    if (downloadedChannelFilter) {
      downloadedChannelFilter.value = channelId;
      downloadedFilterChannel = channelId;
      updateUI(localDb);
    }
  } else {
    const historyChannelFilter = document.getElementById('history-channel-filter');
    if (historyChannelFilter) {
      historyChannelFilter.value = channelId;
      historyFilterChannel = channelId;
      updateUI(localDb);
    }
  }
};

// SSE Channel Scan progress toast
export function updateScanProgressToast(data) {
  const isEn = localDb.settings && localDb.settings.lang === 'en';
  if (!data.active) {
    if (scanProgressToast) {
      scanProgressToast.style.animation = 'slideIn 0.3s reverse forwards';
      const toastRef = scanProgressToast;
      setTimeout(() => toastRef.remove(), 300);
      scanProgressToast = null;
      showToast(isEn ? 'Channel scan completed.' : 'Kanal denetimi tamamlandı.', 'success');
    }
    return;
  }

  const container = document.getElementById('toast-container');
  if (!container) return;

  const msg = isEn 
    ? `${data.current}/${data.total} - Checking ${data.channelName}` 
    : `${data.current}/${data.total} - ${data.channelName} denetleniyor`;

  if (!scanProgressToast) {
    scanProgressToast = document.createElement('div');
    scanProgressToast.className = 'toast toast-info toast-persistent';
    container.appendChild(scanProgressToast);
  }

  scanProgressToast.innerHTML = `
    <i data-lucide="loader" class="toast-icon spin"></i>
    <div class="toast-message">${msg}</div>
  `;
  lucide.createIcons();
}

// Make functions globally accessible
window.fixFileIssue = fixFileIssue;
window.fixAllUntracked = fixAllUntracked;
window.fixAllMissing = fixAllMissing;
window.runFileComparison = runFileComparison;
window.openFileLocation = openFileLocation;
window.deleteAllUnrelated = deleteAllUnrelated;

document.addEventListener('DOMContentLoaded', () => {
  const compareBtn = document.getElementById('start-compare-btn');
  if (compareBtn) {
    compareBtn.addEventListener('click', runFileComparison);
  }
  
  // Header Settings button click handler
  const headerSettingsBtn = document.getElementById('header-settings-btn');
  if (headerSettingsBtn) {
    headerSettingsBtn.addEventListener('click', () => {
      if (window.switchTab) {
        window.switchTab('settings');
      }
    });
  }
  


  // Initialize Downloader Tab and Dropdown Elements
  initDownloaderUI();
});

// === DOWNLISTER / DOWNLOADER FRONTEND MANTIĞI ===
let activePlaylistVideos = [];

export function toggleToolsDropdown(e) {
  e.stopPropagation();
  const dropdown = document.getElementById('tools-dropdown');
  if (dropdown) {
    dropdown.classList.toggle('open');
  }
}

// Dışarı tıklayınca dropdown kapatma
document.addEventListener('click', (e) => {
  const dropdown = document.getElementById('tools-dropdown');
  if (dropdown && !dropdown.contains(e.target)) {
    dropdown.classList.remove('open');
  }
});

export function initDownloaderUI() {
  const toolsBtn = document.getElementById('tools-btn');
  if (toolsBtn) {
    toolsBtn.addEventListener('click', toggleToolsDropdown);
  }

  const downloaderActionBtn = document.getElementById('downloader-action-btn');
  if (downloaderActionBtn) {
    downloaderActionBtn.addEventListener('click', (e) => {
      e.preventDefault();
      switchTab('downloader');
      const dropdown = document.getElementById('tools-dropdown');
      if (dropdown) dropdown.classList.remove('open');
    });
  }

  const toolsCompareBtn = document.getElementById('nav-tools-compare-btn');
  if (toolsCompareBtn) {
    toolsCompareBtn.addEventListener('click', (e) => {
      e.preventDefault();
      window.currentToolsSubSection = 'compare';
      switchTab('tools');
      showToolsSubSection('compare');
      runFileComparison();
      const dropdown = document.getElementById('tools-dropdown');
      if (dropdown) dropdown.classList.remove('open');
    });
  }

  const toolsCategoriesBtn = document.getElementById('nav-tools-categories-btn');
  if (toolsCategoriesBtn) {
    toolsCategoriesBtn.addEventListener('click', (e) => {
      e.preventDefault();
      window.currentToolsSubSection = 'categories';
      switchTab('tools');
      showToolsSubSection('categories');
      const dropdown = document.getElementById('tools-dropdown');
      if (dropdown) dropdown.classList.remove('open');
    });
  }

  const toolsApeBtn = document.getElementById('nav-tools-ape-btn');
  if (toolsApeBtn) {
    toolsApeBtn.addEventListener('click', (e) => {
      e.preventDefault();
      window.currentToolsSubSection = 'ape';
      switchTab('tools');
      showToolsSubSection('ape');
      const dropdown = document.getElementById('tools-dropdown');
      if (dropdown) dropdown.classList.remove('open');
    });
  }

  const formatSelect = document.getElementById('downloader-format-select');
  const bitrateGroup = document.getElementById('downloader-bitrate-group');
  if (formatSelect && bitrateGroup) {
    formatSelect.addEventListener('change', () => {
      if (formatSelect.value === 'audio-mp3') {
        bitrateGroup.style.display = 'block';
      } else {
        bitrateGroup.style.display = 'none';
      }
    });
  }

  const startBtn = document.getElementById('downloader-start-btn');
  if (startBtn) {
    startBtn.addEventListener('click', handleDownloaderStart);
  }

  const downloadAllBtn = document.getElementById('downloader-download-all-btn');
  if (downloadAllBtn) {
    downloadAllBtn.addEventListener('click', handleDownloaderAll);
  }

  const toggleAllCheckbox = document.getElementById('downloader-toggle-all-checkbox');
  if (toggleAllCheckbox) {
    toggleAllCheckbox.addEventListener('change', (e) => {
      const checked = e.target.checked;
      document.querySelectorAll('.playlist-item-checkbox').forEach(cb => {
        cb.checked = checked;
      });
    });
  }
}

export function showToolsSubSection(section) {
  const compareContainer = document.getElementById('tools-compare-container');
  const bulkContainer = document.getElementById('tools-bulk-delete-container');
  const categoriesContainer = document.getElementById('tools-categories-container');
  const apeContainer = document.getElementById('tools-ape-container');
  const toolsHeaderTitle = document.querySelector('#tab-tools .content-header h2 span');
  const toolsHeaderDesc = document.getElementById('tools-modal-desc');
  const toolsHeaderIcon = document.getElementById('tools-modal-icon');

  if (compareContainer) compareContainer.classList.add('hidden');
  if (bulkContainer) bulkContainer.classList.add('hidden');
  if (categoriesContainer) categoriesContainer.classList.add('hidden');
  if (apeContainer) apeContainer.classList.add('hidden');

  const isEn = localDb.settings?.lang === 'en';

  if (section === 'categories' && categoriesContainer) {
    categoriesContainer.classList.remove('hidden');
    if (toolsHeaderTitle) toolsHeaderTitle.textContent = isEn ? 'Edit Channel Categories' : 'Kanal Kategorilerini Düzenleme';
    if (toolsHeaderDesc) toolsHeaderDesc.textContent = isEn ? 'Create, edit, or delete categories to group your channels.' : 'Kanallarınızı gruplandırmak için kategoriler oluşturabilir, düzenleyebilir veya silebilirsiniz.';
    if (toolsHeaderIcon) toolsHeaderIcon.setAttribute('data-lucide', 'tag');
    if (typeof loadCategoriesToTools === 'function') loadCategoriesToTools(localDb.categories);
  } else if (section === 'ape' && apeContainer) {
    apeContainer.classList.remove('hidden');
    if (toolsHeaderTitle) toolsHeaderTitle.textContent = isEn ? 'APE (Direct Video/Channel Watched Marker)' : 'APE (Hızlı İzlendi İşaretleme Aracı)';
    if (toolsHeaderDesc) toolsHeaderDesc.textContent = isEn ? 'Mark videos as watched in library and YouTube history by entering video or channel links.' : 'Video veya kanal linki girerek kütüphanede ve YouTube geçmişinizde videoları anında izlendi olarak işaretleyin.';
    if (toolsHeaderIcon) toolsHeaderIcon.setAttribute('data-lucide', 'check-check');
  } else if (section === 'bulk-delete' && bulkContainer) {
    bulkContainer.classList.remove('hidden');
    if (toolsHeaderTitle) toolsHeaderTitle.textContent = isEn ? 'Bulk Video Deletion' : 'Toplu Video Silme';
    if (toolsHeaderDesc) toolsHeaderDesc.textContent = isEn ? 'List and bulk delete your downloaded videos along with their physical files from disk.' : 'Kütüphanenizdeki indirilen videoları seçerek diskten veya veritabanından toplu olarak silebilirsiniz.';
    if (toolsHeaderIcon) toolsHeaderIcon.setAttribute('data-lucide', 'trash-2');
  } else {
    if (compareContainer) compareContainer.classList.remove('hidden');
    if (toolsHeaderTitle) toolsHeaderTitle.textContent = isEn ? 'Advanced File Comparison & Sync' : 'Gelişmiş Dosya Karşılaştırma & Senkronizasyon';
    if (toolsHeaderDesc) toolsHeaderDesc.textContent = isEn ? 'Compares physical files in your download folder with database records.' : 'İndirme klasörünüzdeki fiziksel dosyaları veritabanı kayıtları ile karşılaştırarak eksik, yetim veya alakasız dosyaları listeler.';
    if (toolsHeaderIcon) toolsHeaderIcon.setAttribute('data-lucide', 'folder-sync');
  }

  try {
    if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
  } catch (e) {}
}
window.showToolsSubSection = showToolsSubSection;




// ─── KATEGORİ YÖNETİMİ VE APE FONKSİYONLARI ───

export async function changeChannelCategory(channelId, categoryId) {
  const isEn = localDb.settings && localDb.settings.lang === 'en';
  const catInt = parseInt(categoryId, 10);
  if (!catInt) return;

  const channel = localDb.channels.find(c => c.id === channelId);
  if (!channel) return;

  let currentIds = channel.categoryIds || (channel.categoryId !== undefined ? [channel.categoryId] : [1]);
  if (currentIds.includes(catInt)) return; // Zaten ekliyse ekleme

  let newIds = [...currentIds, catInt];
  if (catInt !== 1 && newIds.includes(1)) {
    newIds = newIds.filter(id => id !== 1);
  }

  try {
    const res = await fetch(`/api/channels/${channelId}/category`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ categoryIds: newIds })
    });
    const result = await res.json();
    if (result.success) {
      showToast(isEn ? 'Category added to channel.' : 'Kategori kanala eklendi.', 'success');
    } else {
      showToast(result.error || (isEn ? 'Failed to add category.' : 'Kategori eklenemedi.'), 'error');
    }
  } catch (err) {
    console.error('changeChannelCategory error:', err);
    showToast(isEn ? 'Failed to add category.' : 'Kategori eklenemedi.', 'error');
  }
}
window.changeChannelCategory = changeChannelCategory;

/**
 * Kanaldan kategori kaldırır (Çoklu Kategori).
 */
export async function removeChannelCategory(channelId, catId) {
  const isEn = localDb.settings && localDb.settings.lang === 'en';
  const catInt = parseInt(catId, 10);
  if (!catInt) return;

  const channel = localDb.channels.find(c => c.id === channelId);
  if (!channel) return;

  let currentIds = channel.categoryIds || (channel.categoryId !== undefined ? [channel.categoryId] : [1]);
  let newIds = currentIds.filter(id => id !== catInt);

  if (newIds.length === 0) {
    newIds = [1];
  }

  try {
    const res = await fetch(`/api/channels/${channelId}/category`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ categoryIds: newIds })
    });
    const result = await res.json();
    if (result.success) {
      showToast(isEn ? 'Category removed from channel.' : 'Kategori kanaldan kaldırıldı.', 'success');
    } else {
      showToast(result.error || (isEn ? 'Failed to remove category.' : 'Kategori kaldırılamadı.'), 'error');
    }
  } catch (err) {
    console.error('removeChannelCategory error:', err);
    showToast(isEn ? 'Failed to remove category.' : 'Kategori kaldırılamadı.', 'error');
  }
}
window.removeChannelCategory = removeChannelCategory;

/**
 * Araçlar sekmesindeki kategori listesini render eder.
 */
export function loadCategoriesToTools(categories) {
  const listEl = document.getElementById('tools-categories-list');
  if (!listEl) return;
  listEl.innerHTML = '';
  
  const isEn = localDb.settings && localDb.settings.lang === 'en';
  const lang = localDb.settings?.lang || currentLang || 'tr';
  const t = translations[lang] || translations.tr;

  const cats = categories || [];
  const defaultNames = {
    1: ["Genel", "General"],
    2: ["Oyun", "Gaming"],
    3: ["Eğitim", "Education"],
    4: ["Müzik", "Music"],
    5: ["Teknoloji", "Technology"],
    6: ["Spor", "Sports"],
    7: ["Sinema & Film", "Movies & Cinema"],
    8: ["Haberler & Siyaset", "News & Politics"],
    9: ["Eğlence", "Entertainment"],
    10: ["Bilim", "Science"],
    11: ["Gezi & Yaşam", "Travel & Life"],
    12: ["Komedi", "Comedy"],
    13: ["Belgesel", "Documentary"],
    14: ["Anime & Çizgi Film", "Anime & Cartoon"],
    15: ["Finans & Ekonomi", "Finance & Economy"],
    16: ["League of Legends", "League of Legends"],
    17: ["Podcast", "Podcast"]
  };

  const getCatTranslatedName = (cat) => {
    let catName = cat.name;
    if (cat.id >= 1 && cat.id <= 17) {
      const list = defaultNames[cat.id];
      if (list && (cat.name === list[0] || cat.name === list[1] || !cat.name)) {
        catName = t[`category_${cat.id}`] || cat.name;
      }
    }
    return catName;
  };

  const sortedCats = [...cats].sort((a, b) => {
    if (a.id === 1) return -1;
    if (b.id === 1) return 1;
    const nameA = getCatTranslatedName(a);
    const nameB = getCatTranslatedName(b);
    return nameA.localeCompare(nameB, lang, { sensitivity: 'base' });
  });

  sortedCats.forEach(cat => {
    const catName = getCatTranslatedName(cat);

    const tr = document.createElement('tr');
    tr.style.borderBottom = '1px solid var(--border-color)';
    
    const deleteBtnDisabled = cat.id === 1 ? 'disabled style="opacity: 0.5; cursor: not-allowed;"' : '';
    
    tr.innerHTML = `
      <td style="padding:10px 12px; font-weight: 600; color: var(--text-muted);">${cat.id}</td>
      <td style="padding:10px 12px;" id="cat-name-text-${cat.id}">${escapeHtml(catName)}</td>
      <td style="padding:10px 12px; text-align:right;">
        <div style="display:flex; justify-content:flex-end; gap:8px;">
          <button class="btn-icon" onclick="editCategoryName(${cat.id}, '${escapeHtml(cat.name)}')" title="${t.category_edit_tooltip || 'Kategoriyi Düzenle'}">
            <i data-lucide="edit-3" style="width: 14px; height: 14px; color: var(--accent-color);"></i>
          </button>
          <button class="btn-icon" onclick="deleteCategory(${cat.id})" ${deleteBtnDisabled} title="${t.category_delete_tooltip || 'Kategoriyi Sil'}">
            <i data-lucide="trash-2" style="width: 14px; height: 14px; color: var(--accent-red);"></i>
          </button>
        </div>
      </td>
    `;
    listEl.appendChild(tr);
  });

  try {
    lucide.createIcons();
  } catch (e) {}
}
window.loadCategoriesToTools = loadCategoriesToTools;

/**
 * Araçlar sekmesinden yeni kategori ekler.
 */
export async function addCategoryFromTools() {
  const input = document.getElementById('new-category-input');
  if (!input) return;
  const name = input.value.trim();
  const isEn = localDb.settings && localDb.settings.lang === 'en';

  if (!name) {
    showToast(isEn ? 'Category name cannot be empty.' : 'Kategori adı boş olamaz.', 'warning');
    return;
  }

  try {
    const res = await fetch('/api/channels/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name })
    });
    const result = await res.json();
    if (result.success) {
      input.value = '';
      showToast(isEn ? 'Category added.' : 'Kategori başarıyla eklendi.', 'success');
    } else {
      showToast(result.error || (isEn ? 'Failed to add category.' : 'Kategori eklenemedi.'), 'error');
    }
  } catch (err) {
    console.error('addCategoryFromTools error:', err);
    showToast(isEn ? 'Failed to add category.' : 'Kategori eklenemedi.', 'error');
  }
}
window.addCategoryFromTools = addCategoryFromTools;

/**
 * Kategori adını düzenler (inline input alanı oluşturarak).
 */
export function editCategoryName(id, currentName) {
  const cell = document.getElementById(`cat-name-text-${id}`);
  if (!cell) return;

  const isEn = localDb.settings && localDb.settings.lang === 'en';
  const input = document.createElement('input');
  input.type = 'text';
  input.value = currentName;
  input.style.cssText = 'padding: 4px 8px; border-radius: 4px; border: 1px solid var(--border-color); background: var(--bg-input); color: var(--text-main); font-size: 0.85rem; width: 80%;';
  
  const saveBtn = document.createElement('button');
  saveBtn.innerHTML = '✓';
  saveBtn.className = 'btn btn-primary';
  saveBtn.style.cssText = 'padding: 4px 8px; margin-left: 6px; font-size: 0.8rem;';
  
  cell.innerHTML = '';
  cell.appendChild(input);
  cell.appendChild(saveBtn);
  input.focus();

  const performSave = async () => {
    const newName = input.value.trim();
    if (!newName) {
      showToast(isEn ? 'Category name cannot be empty.' : 'Kategori adı boş olamaz.', 'warning');
      cell.textContent = currentName;
      return;
    }
    if (newName === currentName) {
      cell.textContent = currentName;
      return;
    }

    try {
      const res = await fetch(`/api/channels/categories/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName })
      });
      const result = await res.json();
      if (result.success) {
        showToast(isEn ? 'Category updated.' : 'Kategori güncellendi.', 'success');
      } else {
        showToast(result.error || (isEn ? 'Failed to update category.' : 'Kategori güncellenemedi.'), 'error');
        cell.textContent = currentName;
      }
    } catch (err) {
      console.error('editCategoryName error:', err);
      showToast(isEn ? 'Failed to update category.' : 'Kategori güncellenemedi.', 'error');
      cell.textContent = currentName;
    }
  };

  saveBtn.onclick = performSave;
  input.onkeydown = (e) => {
    if (e.key === 'Enter') performSave();
    if (e.key === 'Escape') cell.textContent = currentName;
  };
}
window.editCategoryName = editCategoryName;

/**
 * Kategoriyi siler.
 */
export async function deleteCategory(id) {
  const isEn = localDb.settings && localDb.settings.lang === 'en';
  const confirmMsg = isEn 
    ? 'Are you sure you want to delete this category? Channels in this category will be moved to General.' 
    : 'Bu kategoriyi silmek istediğinize emin misiniz? Bu kategorideki kanallar Genel kategorisine taşınacaktır.';
  
  if (!confirm(confirmMsg)) return;

  try {
    const res = await fetch(`/api/channels/categories/${id}`, {
      method: 'DELETE'
    });
    const result = await res.json();
    if (result.success) {
      showToast(isEn ? 'Category deleted.' : 'Kategori silindi.', 'success');
    } else {
      showToast(result.error || (isEn ? 'Failed to delete category.' : 'Kategori silinemedi.'), 'error');
    }
  } catch (err) {
    console.error('deleteCategory error:', err);
    showToast(isEn ? 'Failed to delete category.' : 'Kategori silinemedi.', 'error');
  }
}
window.deleteCategory = deleteCategory;


document.addEventListener('DOMContentLoaded', () => {
  if (typeof initDownloaderUI === 'function') initDownloaderUI();
  if (typeof restoreHistoryFilterState === 'function') restoreHistoryFilterState();
  if (typeof restoreDownloadedFilterState === 'function') restoreDownloadedFilterState();

  const durationFilterEl = document.getElementById('history-duration-filter');
  if (durationFilterEl) {
    durationFilterEl.addEventListener('change', onHistoryDurationFilterChange);
  }

  // Kanal Filtrelerini Sayfa Yüklenince Otomatik Doldur
  setTimeout(() => {
    if (typeof populateChannelFilters === 'function') {
      populateChannelFilters(localDb);
    }
  }, 300);
});

/**
 * APE Aracı: Girilen video veya kanal linkindeki videoları izlendi/gizlendi işaretler.
 */
export async function handleApeMarkWatched() {
  const inputEl = document.getElementById('ape-target-input');
  const syncCb = document.getElementById('ape-sync-youtube-checkbox');
  const resultBox = document.getElementById('ape-result-box');
  const resultText = document.getElementById('ape-result-text');
  const resultIcon = document.getElementById('ape-result-icon');
  const btn = document.getElementById('btn-ape-mark-watched');

  if (!inputEl) return;
  const target = inputEl.value.trim();
  const lang = localStorage.getItem('haytool_user_lang') || 'tr';
  const t = translations[lang] || translations.tr;

  if (!target) {
    showToast(t.ape_empty_input || 'Lütfen bir video veya kanal linki girin.', 'warning');
    if (inputEl) inputEl.focus();
    return;
  }

  const syncYouTube = syncCb ? syncCb.checked : true;

  try {
    if (btn) btn.disabled = true;
    showToast(t.ape_processing || 'İşleniyor...', 'info');

    const res = await fetch('/api/tools/ape-mark-watched', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target, syncYouTube })
    });

    const data = await res.json();
    if (data.success) {
      showToast(data.message || 'Başarıyla işaretlendi.', 'success');
      if (resultBox && resultText) {
        resultBox.classList.remove('hidden');
        resultBox.style.background = 'rgba(34, 197, 94, 0.1)';
        resultBox.style.border = '1px solid rgba(34, 197, 94, 0.3)';
        resultBox.style.color = '#22c55e';
        resultText.innerHTML = `<strong>${t.ape_success_title || 'Başarılı:'}</strong> ${escapeHtml(data.message)}`;
        if (resultIcon) resultIcon.setAttribute('data-lucide', 'check-circle');
      }
      inputEl.value = '';
    } else {
      showToast(data.error || 'İşlem başarısız oldu.', 'error');
      if (resultBox && resultText) {
        resultBox.classList.remove('hidden');
        resultBox.style.background = 'rgba(239, 68, 68, 0.1)';
        resultBox.style.border = '1px solid rgba(239, 68, 68, 0.3)';
        resultBox.style.color = '#ef4444';
        resultText.innerHTML = `<strong>${t.ape_error_title || 'Hata:'}</strong> ${escapeHtml(data.error || 'Bilinmeyen hata')}`;
        if (resultIcon) resultIcon.setAttribute('data-lucide', 'alert-triangle');
      }
    }
    if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
  } catch (err) {
    showToast(err.message || 'Bağlantı hatası.', 'error');
  } finally {
    if (btn) btn.disabled = false;
  }
};

/**
 * Araçlar sekmesindeki akordiyon menü ögelerinin açılıp kapanmasını kontrol eder.
 * @param {'compare'|'categories'|'ape'} itemKey Akordiyon öge anahtarı
 */
export function toggleToolsAccordion(itemKey) {
  const itemEl = document.getElementById(`accordion-item-${itemKey}`);
  if (!itemEl) return;
  const isCurrentlyActive = itemEl.classList.contains('active');
  
  if (isCurrentlyActive) {
    itemEl.classList.remove('active');
  } else {
    itemEl.classList.add('active');
  }
  try {
    if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
  } catch (e) {}
};



window.handleApeMarkWatched = handleApeMarkWatched;
window.toggleToolsAccordion = toggleToolsAccordion;
