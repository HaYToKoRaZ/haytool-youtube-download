/**
 * HaYTooL YouTube Downloader - Sistem Yedek Yöneticisi
 *
 * Sorumluluklar:
 *   - createSystemBackup()        : Sunucudan sıkıştırılmış 7z yedek oluşturur
 *   - loadSystemBackupsList()     : Mevcut yedekleri listeler (settings sekmesi)
 *   - downloadSystemBackup()      : Seçili yedeği tarayıcı ile indirir
 *   - deleteSystemBackup()        : Seçili yedeği sunucudan siler
 *   - triggerUploadBackupFile()   : Yedek yükleme file-input'unu tetikler
 *   - uploadBackupFile()          : Yüklenen yedeği geri yükler
 *   - restoreSystemBackup()       : Sunucudaki yedeği geri yükler
 *
 * Bağımlılıklar: showToast (global), localDb (global), window.lucide (global)
 *
 * Yapımcı: HaYTo
 * İletişim: korazhayto@gmail.com
 */

export async function createSystemBackup() {
  const isEn = localDb.settings && localDb.settings.lang === 'en';
  try {
    showToast(isEn ? 'Creating compressed system backup...' : 'Sıkıştırılmış sistem yedeği oluşturuluyor...', 'info');
    const res = await fetch('/api/backup', { method: 'POST' });
    const data = await res.json();
    if (data.success) {
      showToast(isEn ? `Backup created successfully (${data.size}).` : `Sıkıştırılmış yedek oluşturuldu (${data.size}).`, 'success');
      const container = document.getElementById('system-backups-container');
      if (container && !container.classList.contains('hidden')) {
        loadSystemBackupsList(true);
      }
    } else {
      showToast(data.error || (isEn ? 'Failed to create backup.' : 'Yedek oluşturulamadı.'), 'error');
    }
  } catch (err) {
    showToast(isEn ? 'Connection error.' : 'Bağlantı hatası.', 'error');
  }
}

export async function loadSystemBackupsList(forceOpen = false) {
  const isEn = localDb.settings && localDb.settings.lang === 'en';
  const container = document.getElementById('system-backups-container');
  const tbody = document.getElementById('system-backups-list');
  if (!container || !tbody) return;

  if (!forceOpen && !container.classList.contains('hidden')) {
    container.classList.add('hidden');
    return;
  }

  try {
    const res = await fetch('/api/backups');
    const data = await res.json();
    if (data.success) {
      tbody.innerHTML = '';
      if (data.backups.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" style="padding: 10px; text-align: center; color: var(--text-muted);">${isEn ? 'No backups found.' : 'Henüz saklanan yedek bulunmuyor.'}</td></tr>`;
      } else {
        data.backups.forEach(backup => {
          const tr = document.createElement('tr');
          tr.style.borderBottom = '1px solid rgba(255,255,255,0.05)';
          const isAutoBackup = backup.isAuto || backup.filename.startsWith('auto_') || backup.filename.startsWith('daily_');
          let badgeHtml = '';
          if (backup.isDailyProtected) {
            badgeHtml = `<span style="background: rgba(16, 185, 129, 0.15); border: 1px solid rgba(16, 185, 129, 0.3); color: #10b981; font-size: 0.7rem; padding: 2px 6px; border-radius: 4px; font-weight: 600;">🛡️ ${isEn ? 'Daily Protected' : 'Günlük Korunan'}</span>`;
          } else if (isAutoBackup) {
            badgeHtml = `<span style="background: rgba(168, 85, 247, 0.15); border: 1px solid rgba(168, 85, 247, 0.3); color: #a855f7; font-size: 0.7rem; padding: 2px 6px; border-radius: 4px; font-weight: 600;">🤖 ${isEn ? 'Automatic' : 'Otomatik'}</span>`;
          } else {
            badgeHtml = `<span style="background: rgba(56, 189, 248, 0.15); border: 1px solid rgba(56, 189, 248, 0.3); color: #38bdf8; font-size: 0.7rem; padding: 2px 6px; border-radius: 4px; font-weight: 600;">🖐️ ${isEn ? 'Manual' : 'Manuel'}</span>`;
          }

          tr.innerHTML = `
            <td style="padding: 6px 8px;" title="${backup.filename}">${backup.filename}</td>
            <td style="padding: 6px 8px; color: var(--text-muted);">${backup.size}</td>
            <td style="padding: 6px 8px;">${badgeHtml}</td>
            <td style="padding: 6px 8px; text-align: right; display: flex; gap: 4px; justify-content: flex-end;">
              <button type="button" class="btn btn-secondary btn-xs" onclick="downloadSystemBackup('${backup.filename}')" title="${isEn ? 'Download' : 'İndir'}" style="padding: 2px 6px; font-size: 0.75rem;">
                <i data-lucide="download" style="width:12px;height:12px;"></i>
              </button>
              <button type="button" class="btn btn-secondary btn-xs" onclick="restoreSystemBackup('${backup.filename}')" title="${isEn ? 'Restore' : 'Geri Yükle'}" style="padding: 2px 6px; font-size: 0.75rem; background: rgba(56, 189, 248, 0.1); border-color: rgba(56, 189, 248, 0.2); color: var(--accent-color);">
                ${isEn ? 'Geri Yükle' : 'Geri Yükle'}
              </button>
              <button type="button" class="btn btn-secondary btn-xs" onclick="deleteSystemBackup('${backup.filename}')" title="${isEn ? 'Delete' : 'Sil'}" style="padding: 2px 6px; font-size: 0.75rem; color: #ef4444; border-color: rgba(239, 68, 68, 0.3);">
                <i data-lucide="trash-2" style="width:12px;height:12px;"></i>
              </button>
            </td>
          `;
          tbody.appendChild(tr);
        });
        if (window.lucide) window.lucide.createIcons();
      }
      container.classList.remove('hidden');
    } else {
      showToast(data.error || (isEn ? 'Failed to load backups list.' : 'Yedek listesi yüklenemedi.'), 'error');
    }
  } catch (err) {
    showToast(isEn ? 'Connection error.' : 'Bağlantı hatası.', 'error');
  }
}

export function downloadSystemBackup(filename) {
  window.open(`/api/backup/download/${encodeURIComponent(filename)}`, '_blank');
}

export async function deleteSystemBackup(filename) {
  const isEn = localDb.settings && localDb.settings.lang === 'en';
  if (!confirm(isEn ? `Are you sure you want to delete the backup file "${filename}"?` : `"${filename}" yedek dosyasını silmek istediğinize emin misiniz?`)) {
    return;
  }

  try {
    const res = await fetch(`/api/backup/${encodeURIComponent(filename)}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.success) {
      showToast(isEn ? 'Backup file deleted.' : 'Yedek dosyası silindi.', 'success');
      loadSystemBackupsList(true);
    } else {
      showToast(data.error || (isEn ? 'Failed to delete backup.' : 'Yedek dosyası silinemedi.'), 'error');
    }
  } catch (err) {
    showToast(isEn ? 'Connection error.' : 'Bağlantı hatası.', 'error');
  }
}

export function triggerUploadBackupFile() {
  const input = document.getElementById('backup-file-upload-input');
  if (input) input.click();
}

export async function uploadBackupFile(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;
  const isEn = localDb.settings && localDb.settings.lang === 'en';

  if (!confirm(isEn ? `Are you sure you want to restore from "${file.name}"? Current settings and database will be replaced.` : `"${file.name}" dosyasındaki yedeği geri yüklemek istediğinize emin misiniz? Mevcut verilerin üzerine yazılacaktır.`)) {
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
        showToast(isEn ? 'Backup restored successfully! Reloading...' : 'Yedek başarıyla yüklendi ve geri yüklendi! Sayfa yenileniyor...', 'success');
        setTimeout(() => { window.location.reload(); }, 1500);
      } else {
        showToast(data.error || (isEn ? 'Failed to restore backup file.' : 'Yedek dosyası geri yüklenemedi.'), 'error');
      }
    } catch (err) {
      showToast(isEn ? 'Connection error.' : 'Bağlantı hatası.', 'error');
    } finally {
      event.target.value = '';
    }
  };
  reader.readAsDataURL(file);
}

export async function restoreSystemBackup(filename) {
  const isEn = localDb.settings && localDb.settings.lang === 'en';
  if (!confirm(isEn ? `Are you sure you want to restore the backup "${filename}"? Current data will be overwritten.` : `"${filename}" yedeğini geri yüklemek istediğinize emin misiniz? Mevcut verilerin üzerine yazılacaktır.`)) {
    return;
  }

  try {
    showToast(isEn ? 'Restoring backup, please wait...' : 'Yedek geri yükleniyor, lütfen bekleyin...', 'info');
    const res = await fetch('/api/restore', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename })
    });
    const data = await res.json();
    if (data.success) {
      showToast(isEn ? 'Backup restored successfully! Reloading page...' : 'Yedek başarıyla geri yüklendi! Sayfa yenileniyor...', 'success');
      setTimeout(() => { window.location.reload(); }, 1500);
    } else {
      showToast(data.error || (isEn ? 'Failed to restore backup.' : 'Yedek geri yüklenemedi.'), 'error');
    }
  } catch (err) {
    showToast(isEn ? 'Connection error.' : 'Bağlantı hatası.', 'error');
  }
}

// Geriye dönük window.* köprüsü (HTML inline onclick bağlamı için)
window.createSystemBackup = createSystemBackup;
window.loadSystemBackupsList = loadSystemBackupsList;
window.downloadSystemBackup = downloadSystemBackup;
window.deleteSystemBackup = deleteSystemBackup;
window.triggerUploadBackupFile = triggerUploadBackupFile;
window.uploadBackupFile = uploadBackupFile;
window.restoreSystemBackup = restoreSystemBackup;
