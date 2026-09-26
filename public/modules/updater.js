/**
 * HaYTooL YouTube Downloader - Güncelleme Kontrolü & Sürüm Yönetimi
 *
 * Sorumluluklar:
 *   - loadAppVersion()           : /api/version → topbar & settings sürüm rozetlerini günceller
 *   - checkApplicationUpdates()  : /api/updates/check → GitHub release durumunu sorgular
 *   - showUpdateNotification()   : Yeni sürüm varsa animasyonlu kart gösterir
 *
 * Yapımcı: HaYTo
 * İletişim: korazhayto@gmail.com
 */

/**
 * Sunucudan güncel uygulama sürümünü alır ve arayüzdeki
 * topbar (#topbar-version) ile ayarlar (#settings-version) rozetlerini günceller.
 */
export async function loadAppVersion() {
  try {
    const res = await fetch('/api/version');
    const data = await res.json();
    if (data && data.version) {
      const verStr = 'v' + data.version;
      const releasesUrl = 'https://github.com/HaYToKoRaZ/haytool-youtube-download/releases';

      // Topbar version badge
      const topbarVer = document.getElementById('topbar-version');
      if (topbarVer) {
        const link = topbarVer.querySelector('a');
        if (link) {
          link.textContent = verStr;
          link.href = releasesUrl;
        } else {
          topbarVer.textContent = verStr;
        }
      }

      // Settings version label
      const settingsVer = document.getElementById('settings-version');
      if (settingsVer) {
        const link = settingsVer.querySelector('a');
        if (link) {
          link.textContent = verStr;
          link.href = releasesUrl;
        } else {
          settingsVer.textContent = verStr;
        }
      }
    }
  } catch (err) {
    console.warn('Failed to load version:', err);
  }
}

/**
 * Sunucudan GitHub güncelleme durumunu sorgular ve rozeti günceller.
 * Yeni sürüm varsa topbar rozetine 'update-pulsing' efekti ekler
 * ve animasyonlu bildirim kartı gösterir.
 */
export async function checkApplicationUpdates() {
  try {
    const res = await fetch('/api/updates/check');
    if (!res.ok) return;
    const update = await res.json();
    const topbarVer = document.getElementById('topbar-version');
    if (update && update.updateAvailable) {
      if (topbarVer) {
        topbarVer.classList.add('update-pulsing');
        topbarVer.title = `Yeni sürüm mevcut (${update.latestVersion})! İndirmek için tıklayın.`;
      }
      showUpdateNotification(update);
    } else {
      if (topbarVer) {
        topbarVer.classList.remove('update-pulsing');
      }
    }
  } catch (err) {
    console.warn('Update check failed:', err);
  }
}

/**
 * Kullanıcıya yeni sürüm olduğunu bildiren animasyonlu bir kart gösterir.
 * Kapatıldığında sessionStorage ile o oturumda tekrar rahatsız etmez.
 *
 * @param {object} update - { updateAvailable, latestVersion, releaseUrl }
 */
export function showUpdateNotification(update) {
  if (sessionStorage.getItem('hide_update_notification') === 'true') {
    return;
  }

  const existing = document.getElementById('github-update-notification');
  if (existing) existing.remove();

  const isEn = window.localDb?.settings?.lang === 'en';
  const title = isEn ? 'New Version Available!' : 'Yeni Sürüm Mevcut!';
  const desc = isEn
    ? `v${update.latestVersion.replace(/^v/, '')} version is ready to download.`
    : `v${update.latestVersion.replace(/^v/, '')} sürümü indirilebilir durumda.`;
  const btnText = isEn ? 'View on GitHub' : 'GitHub\'da İncele';

  const card = document.createElement('div');
  card.id = 'github-update-notification';
  card.className = 'github-update-card';
  card.innerHTML = `
    <div class="update-card-content">
      <div class="update-card-icon">
        <i data-lucide="sparkles"></i>
      </div>
      <div class="update-card-body">
        <h4>${title}</h4>
        <p>${desc}</p>
        <div class="update-card-actions">
          <a href="${update.releaseUrl}" target="_blank" class="update-btn-action">${btnText}</a>
          <button class="update-btn-close" id="github-update-close-btn"><i data-lucide="x"></i></button>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(card);

  if (window.lucide) {
    window.lucide.createIcons();
  }

  document.getElementById('github-update-close-btn').addEventListener('click', () => {
    card.classList.add('fade-out');
    sessionStorage.setItem('hide_update_notification', 'true');
    setTimeout(() => card.remove(), 400);
  });

  // Ayarlar sekmesindeki sürüm numarasının yanına yeşil bir badge ekle
  const settingsVersion = document.getElementById('settings-version');
  if (settingsVersion && !document.getElementById('settings-update-badge')) {
    const badge = document.createElement('span');
    badge.id = 'settings-update-badge';
    badge.className = 'update-badge-settings';
    badge.textContent = isEn ? 'Update Available' : 'Güncelleme Var';
    badge.style.cssText = 'font-size: 0.75rem; background: #22c55e; color: #fff; padding: 2px 6px; border-radius: 4px; margin-left: 8px; font-weight: 600; display: inline-block; cursor: pointer;';
    badge.onclick = () => window.open(update.releaseUrl, '_blank');
    settingsVersion.parentNode.appendChild(badge);
  }
}

// Geriye dönük window.* köprüsü (HTML inline onclick bağlamı için)
window.loadAppVersion = loadAppVersion;
window.checkApplicationUpdates = checkApplicationUpdates;
window.showUpdateNotification = showUpdateNotification;
