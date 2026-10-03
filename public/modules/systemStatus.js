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
    if (data.success) {
      if (data.busy) {
        showToast(data.message || (isEn ? 'Downloads active, sync deferred.' : 'Aktif indirme olduğu için senkronizasyon ertelendi.'), 'warning');
      } else {
        const successMsg = isEn 
          ? `Disk synced: ${data.totalVerified || 0} videos verified, ${data.updatedCount || 0} updated.`
          : `Disk eşitlendi: ${data.totalVerified || 0} video doğrulandı, ${data.updatedCount || 0} kayıt güncellendi.`;
        showToast(successMsg, 'success');
      }
    } else {
      showToast(data.error || (isEn ? 'Disk sync failed.' : 'Disk senkronizasyonu başarısız oldu.'), 'error');
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
}

// Global window bindings for inline HTML or SSE handlers
window.updateDiskSpace = updateDiskSpace;
window.triggerDiskSync = triggerDiskSync;
window.triggerManualDiskSync = triggerManualDiskSync;

