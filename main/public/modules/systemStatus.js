/**
 * HaYTooL YT Downloader - System & Disk Status Module
 * public/modules/systemStatus.js
 */

import { showToast } from '../components/toast.js';

/**
 * Üst bardaki ve durum çubuğundaki disk alanı bilgilerini günceller.
 * @returns {Promise<void>}
 */
export async function updateDiskSpace() {
  const diskStatusFree = document.getElementById('disk-status-free');
  const diskStatusFolder = document.getElementById('disk-status-folder');
  if (!diskStatusFree) return;
  
  try {
    const res = await fetch('/api/disk-space');
    const data = await res.json();
    if (data.success) {
      const freeGB = Math.round(data.freeBytes / (1024 * 1024 * 1024));
      const totalGB = Math.round(data.totalBytes / (1024 * 1024 * 1024));
      const folderGB = Math.round(data.folderSizeBytes / (1024 * 1024 * 1024));
      
      const isEn = window.localDb?.settings?.lang === 'en';
      diskStatusFree.textContent = `${freeGB} GB`;
      if (diskStatusFolder) {
        diskStatusFolder.textContent = `${folderGB} GB`;
      }
      
      diskStatusFree.title = isEn 
        ? `Drive Free Space: ${freeGB} GB / Total: ${totalGB} GB (${data.driveLetter}:)`
        : `Sürücü Boş Alanı: ${freeGB} GB / Toplam: ${totalGB} GB (${data.driveLetter}:)`;
      if (diskStatusFolder) {
        diskStatusFolder.title = isEn
          ? `Main Download Folder Total Size: ${folderGB} GB`
          : `Ana İndirme Klasörü Toplam Boyutu: ${folderGB} GB`;
      }

      updateDiskPopoverData(data);
    } else {
      const isEn = window.localDb?.settings?.lang === 'en';
      diskStatusFree.textContent = isEn ? 'Unknown' : 'Bilinmiyor';
      if (diskStatusFolder) diskStatusFolder.textContent = isEn ? 'Unknown' : 'Bilinmiyor';
    }
  } catch (err) {
    const isEn = window.localDb?.settings?.lang === 'en';
    diskStatusFree.textContent = isEn ? 'Error' : 'Hata';
    if (diskStatusFolder) diskStatusFolder.textContent = isEn ? 'Error' : 'Hata';
  }
}

/**
 * Ayarlar sekmesindeki Disk Eşitle butonlarının tetikleyicisi.
 * @param {string} mode - 'fast' (varlık), 'smart' (eksikler), 'full' (tüm videolar FFprobe ile)
 * @returns {Promise<void>}
 */
export async function triggerDiskSync(mode = 'fast') {
  // Geriye dönük boolean desteği
  if (mode === true) mode = 'full';
  if (mode === false) mode = 'fast';

  let btnId = 'btn-manual-disk-sync';
  if (mode === 'smart') btnId = 'btn-smart-disk-sync';
  else if (mode === 'full') btnId = 'btn-deep-disk-sync';

  const btn = document.getElementById(btnId);
  const lang = (window.localDb?.settings?.lang) || window.currentLang || 'tr';
  const t = window.translations?.[lang] || window.translations?.tr || {};
  const isEn = lang === 'en';

  if (mode === 'full') {
    const confirmMsg = isEn
      ? "Full Media Analysis will force FFprobe inspection on ALL videos on disk. On mechanical HDDs, this will cause heavy disk read activity and may take several minutes. Do you want to proceed?"
      : "Tam FFprobe Analizi, diskteki TÜM videoları tek tek baştan sona okuyarak FFprobe ile tarar. Mekanik HDD sürücülerde yoğun disk okuması oluşturur ve birkaç dakika sürebilir. Devam etmek istiyor musunuz?";
    if (!window.confirm(confirmMsg)) {
      return;
    }
  }

  let originalHtml = '';
  if (btn) {
    originalHtml = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = `<i data-lucide="loader" class="pulse-animation" style="width:13px;height:13px;"></i> <span>${isEn ? 'Syncing...' : 'Senkronize Ediliyor...'}</span>`;
    try { window.lucide?.createIcons(); } catch(e) {}
  }

  let startMsg = t.msg_disk_sync_started || (isEn ? 'Disk sync started...' : 'Disk senkronizasyonu başlatıldı...');
  if (mode === 'full') {
    startMsg = isEn ? 'Full media analysis started (FFprobe - all videos)...' : 'Tam medya analizi başlatıldı (FFprobe - tüm videolar)...';
  } else if (mode === 'smart') {
    startMsg = isEn ? 'Smart media analysis started (FFprobe - missing only)...' : 'Akıllı medya analizi başlatıldı (FFprobe - sadece eksikler)...';
  }
  showToast(startMsg, 'info');

  try {
    const res = await fetch('/api/settings/sync-disk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode })
    });
    const data = await res.json();
    if (data.busy) {
      showToast(data.message || (isEn ? 'Downloads active, sync deferred.' : 'Aktif indirme olduğu için senkronizasyon ertelendi.'), 'warning');
    } else if (data.success) {
      const successMsg = isEn 
        ? `Disk synced: ${data.totalVerified || 0} videos verified, ${data.updatedCount || 0} updated.`
        : `Disk eşitlendi: ${data.totalVerified || 0} video doğrulandı, ${data.updatedCount || 0} kayıt güncellendi.`;
      showToast(successMsg, 'success');
    } else {
      showToast(data.error || data.message || (isEn ? 'Disk sync failed.' : 'Disk senkronizasyonu başarısız oldu.'), 'error');
    }
  } catch (err) {
    showToast(isEn ? 'Connection error.' : 'Bağlantı hatası.', 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = originalHtml;
      try { window.lucide?.createIcons(); } catch(e) {}
    }
  }
}

export const triggerManualDiskSync = () => triggerDiskSync('fast');

/**
 * Kompakt Depolama Popover verilerini günceller.
 * @param {object} data - /api/disk-space yanıtı
 */
export function updateDiskPopoverData(data) {
  if (!data) return;
  const driveBadge = document.getElementById('disk-popover-drive-badge');
  const percentText = document.getElementById('disk-popover-percent');
  const progressBar = document.getElementById('disk-popover-progress-bar');
  const freeVal = document.getElementById('disk-popover-free');
  const totalVal = document.getElementById('disk-popover-total');
  const folderSizeVal = document.getElementById('disk-popover-folder-size');
  const mediaCountVal = document.getElementById('disk-popover-media-count');
  const pathBox = document.getElementById('disk-popover-path');

  const freeGB = (data.freeBytes / (1024 * 1024 * 1024)).toFixed(1);
  const totalGB = (data.totalBytes / (1024 * 1024 * 1024)).toFixed(1);
  const folderGB = (data.folderSizeBytes / (1024 * 1024 * 1024)).toFixed(2);
  
  let usedPercent = 0;
  if (data.totalBytes > 0) {
    usedPercent = Math.min(100, Math.max(0, Math.round(((data.totalBytes - data.freeBytes) / data.totalBytes) * 100)));
  }

  if (driveBadge) driveBadge.textContent = data.driveLetter ? `${data.driveLetter}:` : 'DISK';
  if (percentText) percentText.textContent = `%${usedPercent}`;
  if (progressBar) {
    progressBar.style.width = `${usedPercent}%`;
    if (usedPercent >= 90) {
      progressBar.style.background = 'linear-gradient(90deg, #f59e0b, #ef4444)';
    } else if (usedPercent >= 75) {
      progressBar.style.background = 'linear-gradient(90deg, #38bdf8, #f59e0b)';
    } else {
      progressBar.style.background = 'linear-gradient(90deg, #38bdf8, #a855f7)';
    }
  }

  if (freeVal) freeVal.textContent = `${freeGB} GB`;
  if (totalVal) totalVal.textContent = `${totalGB} GB`;
  if (folderSizeVal) folderSizeVal.textContent = `${folderGB} GB`;
  if (mediaCountVal) mediaCountVal.textContent = `${data.mediaCount ?? '--'}`;
  if (pathBox) {
    pathBox.textContent = data.downloadPath || '--';
    pathBox.title = data.downloadPath || '';
  }
}

/**
 * Kompakt Depolama Popover'ını açar veya kapatır.
 * @param {MouseEvent} [e]
 */
export function toggleDiskPopover(e) {
  if (e) e.stopPropagation();
  const popover = document.getElementById('disk-popover');
  if (!popover) return;
  const isOpening = !popover.classList.contains('active');
  if (isOpening) {
    // Açık olan hava durumu popover'ı varsa kapat
    const weatherPop = document.getElementById('weather-popover');
    if (weatherPop) weatherPop.classList.remove('active');

    popover.classList.add('active');
    try { window.lucide?.createIcons(); } catch(_) {}
    updateDiskSpace();
  } else {
    popover.classList.remove('active');
  }
}

/**
 * Kompakt Depolama Popover'ını kapatır.
 */
export function closeDiskPopover() {
  const popover = document.getElementById('disk-popover');
  if (popover) popover.classList.remove('active');
}

/**
 * Popover içerisindeki Diski Eşitle butonunun tetikleyicisi.
 * Araçlar / İndirme Klasörü Karşılaştırması'ndaki "Tek Tıkla Senkronize Et" işlevini yürütür.
 */
export async function triggerDiskSyncFromPopover() {
  const syncBtn = document.getElementById('disk-popover-sync-btn');
  const syncIcon = document.getElementById('disk-sync-btn-icon');
  if (syncIcon) syncIcon.classList.add('spin-animation');
  if (syncBtn) syncBtn.disabled = true;

  const lang = (window.localDb?.settings?.lang) || window.currentLang || 'tr';
  const t = window.translations?.[lang] || window.translations?.tr || {};
  const isEn = lang === 'en';

  showToast(t.disk_sync_comparing || (isEn ? 'Scanning disk and folders...' : 'Disk ve klasörler taranıyor...'), 'info');

  try {
    // 1. Araçlar modülündeki gibi klasör ve kayıt sağlığını karşılaştır
    const compareRes = await fetch('/api/tools/compare-files');
    const compareData = await compareRes.json();

    if (compareData && compareData.success) {
      const unrelated = compareData.unrelatedFiles || [];
      const missing = compareData.missingFiles || [];
      const emptyFolders = compareData.emptyFolders || [];
      const totalIssues = unrelated.length + missing.length + emptyFolders.length;

      if (totalIssues > 0) {
        const confirmMsg = isEn
          ? (`⚡ One-Click Synchronization & Cleanup:\n\n` +
             `• ${unrelated.length} orphan/unrelated file(s) will be permanently deleted\n` +
             `• ${missing.length} missing video record(s) will be removed from history\n` +
             `• ${emptyFolders.length} empty channel folder(s) will be cleaned up\n\n` +
             `Do you want to proceed with this cleanup?`)
          : (`⚡ Tek Tıkla Senkronizasyon ve Temizlik:\n\n` +
             `• ${unrelated.length} adet artık/yetim dosya diskten kalıcı olarak silinecek\n` +
             `• ${missing.length} adet diskte bulunamayan video kaydı geçmişinizden kaldırılacak\n` +
             `• ${emptyFolders.length} adet boş kanal klasörü diskten kaldırılacak\n\n` +
             `Bu toplu işlemi onaylıyor musunuz?`);

        if (confirm(confirmMsg)) {
          const fixRes = await fetch('/api/tools/fix-files', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'sync-all',
              unrelatedFilePaths: unrelated.map(f => f.filePath),
              missingVideoIds: missing.map(f => f.id),
              emptyFolderPaths: emptyFolders.map(f => f.folderPath)
            })
          });
          const fixData = await fixRes.json();
          if (fixData && fixData.success) {
            const successText = (t.disk_sync_synced_success || 'Senkronizasyon tamamlandı: {count} sorun giderildi.').replace('{count}', totalIssues);
            showToast(successText, 'success');
            if (typeof window.runFileComparison === 'function') {
              try { window.runFileComparison(); } catch(_) {}
            }
          }
        }
      } else {
        showToast(t.disk_sync_already_synced || (isEn ? 'Disk and database are fully in sync, no leftover records.' : 'Disk ve veritabanı tam senkronize (0 artık dosya, 0 eksik kayıt).'), 'info');
      }
    }

    // 2. Varlık denetimini ve popover alan verilerini güncelle
    await triggerDiskSync('fast');
    await updateDiskSpace();
  } catch (err) {
    showToast(isEn ? 'Sync error occurred.' : 'Senkronizasyon sırasında hata oluştu.', 'error');
  } finally {
    if (syncIcon) syncIcon.classList.remove('spin-animation');
    if (syncBtn) syncBtn.disabled = false;
  }
}

/**
 * Disk ve sistem durumu olay dinleyicilerini başlatır.
 */
export function initSystemStatusEvents() {
  const btnManualDiskSync = document.getElementById('btn-manual-disk-sync');
  if (btnManualDiskSync) {
    btnManualDiskSync.onclick = () => triggerDiskSync('fast');
  }
  const btnSmartDiskSync = document.getElementById('btn-smart-disk-sync');
  if (btnSmartDiskSync) {
    btnSmartDiskSync.onclick = () => triggerDiskSync('smart');
  }
  const btnDeepDiskSync = document.getElementById('btn-deep-disk-sync');
  if (btnDeepDiskSync) {
    btnDeepDiskSync.onclick = () => triggerDiskSync('full');
  }

  // Dışarı tıklayınca disk popover'ı kapat
  document.addEventListener('click', (e) => {
    const badgeDisk = document.getElementById('badge-disk');
    const popover = document.getElementById('disk-popover');
    if (popover && badgeDisk && !badgeDisk.contains(e.target)) {
      popover.classList.remove('active');
    }
  });
}

// Global window bindings for inline HTML or SSE handlers
window.updateDiskSpace = updateDiskSpace;
window.triggerDiskSync = triggerDiskSync;
window.triggerManualDiskSync = triggerManualDiskSync;
window.updateDiskPopoverData = updateDiskPopoverData;
window.toggleDiskPopover = toggleDiskPopover;
window.closeDiskPopover = closeDiskPopover;
window.triggerDiskSyncFromPopover = triggerDiskSyncFromPopover;

