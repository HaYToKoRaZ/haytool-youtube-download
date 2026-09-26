/**
 * HaYTooL YouTube Downloader - yt-dlp Motor Sürüm Yöneticisi
 *
 * Sorumluluklar:
 *   - fetchYtdlpVersion() : Mevcut yt-dlp sürümünü, kanalını ve GitHub sürüm listesini sorgular
 *   - updateYtdlp()       : Seçilen hedef sürüme göre yt-dlp motorunu günceller / geri alır
 *
 * Bağımlılıklar: showToast (global), translations (global), currentLang (global)
 *
 * Yapımcı: HaYTo
 * İletişim: korazhayto@gmail.com
 */

/**
 * yt-dlp motor sürümünü ve mevcut tüm sürümleri API'den sorgular, arayüzü günceller.
 */
export async function fetchYtdlpVersion() {
  const versionEl = document.getElementById('ytdlp-current-version');
  const latestEl = document.getElementById('ytdlp-latest-version');
  const badgeEl = document.getElementById('ytdlp-channel-badge');
  const selectEl = document.getElementById('ytdlp-target-select');
  if (!versionEl) return;

  try {
    const res = await fetch('/api/downloader/ytdlp-version');
    const data = await res.json();

    // Yerel Sürüm
    if (data.version) {
      versionEl.textContent = data.version;
    } else {
      versionEl.textContent = '?';
    }

    // Kanal Rozeti
    if (badgeEl) {
      if (data.channel === 'nightly') {
        badgeEl.textContent = '🌙 Nightly (Önerilen)';
        badgeEl.style.background = 'rgba(147, 51, 234, 0.15)';
        badgeEl.style.color = '#c084fc';
        badgeEl.style.borderColor = 'rgba(147, 51, 234, 0.3)';
      } else if (data.channel === 'stable') {
        badgeEl.textContent = '⭐ Kararlı (Stable)';
        badgeEl.style.background = 'rgba(59, 130, 246, 0.15)';
        badgeEl.style.color = '#60a5fa';
        badgeEl.style.borderColor = 'rgba(59, 130, 246, 0.3)';
      } else {
        badgeEl.textContent = 'Bilinmiyor';
      }
    }

    // En Son Sürüm (Uzak Sunucu)
    if (latestEl) {
      if (data.latestNightly) {
        latestEl.textContent = data.latestNightly + ' (Nightly)';
      } else if (data.latestStable) {
        latestEl.textContent = data.latestStable + ' (Stable)';
      } else {
        latestEl.textContent = '-';
      }
    }

    // Sürüm Seçim Dropdown'ını Doldur
    if (selectEl) {
      const nightlyGroup = document.getElementById('optgroup-nightly-history');
      const stableGroup = document.getElementById('optgroup-stable-history');

      if (nightlyGroup) {
        nightlyGroup.innerHTML = '';
        if (data.recentNightly && data.recentNightly.length > 0) {
          data.recentNightly.forEach(item => {
            const opt = document.createElement('option');
            opt.value = `nightly@${item.tag}`;
            opt.textContent = `🌙 Nightly ${item.tag}`;
            nightlyGroup.appendChild(opt);
          });
        }
      }

      if (stableGroup) {
        stableGroup.innerHTML = '';
        if (data.recentStable && data.recentStable.length > 0) {
          data.recentStable.forEach(item => {
            const opt = document.createElement('option');
            opt.value = `stable@${item.tag}`;
            opt.textContent = `⭐ Stable ${item.tag}`;
            stableGroup.appendChild(opt);
          });
        }
      }
    }
  } catch (err) {
    versionEl.textContent = '?';
    if (latestEl) latestEl.textContent = '-';
  }
}

/**
 * Seçilen hedef sürüme göre yt-dlp motorunu günceller.
 */
export async function updateYtdlp() {
  const btn = document.getElementById('ytdlp-update-btn');
  const selectEl = document.getElementById('ytdlp-target-select');
  const icon = btn ? btn.querySelector('i') : null;
  const t = translations[currentLang] || translations.tr;

  const target = selectEl ? selectEl.value : 'nightly';

  if (btn) btn.disabled = true;
  if (icon) icon.style.animation = 'spin 1s linear infinite';

  showToast(t.toast_ytdlp_updating || 'yt-dlp güncelleniyor...', 'info');

  try {
    const res = await fetch('/api/downloader/ytdlp-update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target })
    });
    const data = await res.json();

    if (data.success) {
      showToast((t.toast_ytdlp_success || 'yt-dlp başarıyla güncellendi') + (data.newVersion ? ': ' + data.newVersion : ''), 'success');
      fetchYtdlpVersion();
    } else {
      showToast((t.toast_ytdlp_fail || 'yt-dlp güncellemesi başarısız oldu') + (data.error ? ': ' + data.error : ''), 'error');
    }
  } catch (err) {
    showToast((t.toast_ytdlp_fail || 'yt-dlp güncellemesi başarısız oldu') + ': ' + err.message, 'error');
  } finally {
    if (btn) btn.disabled = false;
    if (icon) icon.style.animation = '';
  }
}

// Geriye dönük window.* köprüsü (HTML inline onclick bağlamı için)
window.fetchYtdlpVersion = fetchYtdlpVersion;
window.updateYtdlp = updateYtdlp;
