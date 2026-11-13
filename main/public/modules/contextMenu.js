// Türkçe Açıklama: Modern ve temalarla uyumlu Özel Sağ Tık Bağlam Menüsü (Custom Context Menu) ve Fare Orta Tuşu Tam Ekran Yönetim Modülü.

let contextMenuEl = null;
let activeTargetEl = null;

/**
 * Mevcut aktif dil çevirisini getirir.
 * @param {string} key - Dil anahtarı
 * @param {string} fallback - Varsayılan metin
 * @returns {string}
 */
function t(key, fallback = '') {
  try {
    const lang = window.localDb?.settings?.lang || localStorage.getItem('haytool_lang') || 'tr';
    const tr = window.translations?.[lang] || window.translations?.['tr'] || {};
    return tr[key] || fallback;
  } catch {
    return fallback;
  }
}

/**
 * Bağlam menüsünü oluşturur ve DOM'a ekler.
 */
function ensureContextMenuElement() {
  if (contextMenuEl && document.body.contains(contextMenuEl)) return contextMenuEl;

  contextMenuEl = document.createElement('div');
  contextMenuEl.id = 'app-custom-context-menu';
  contextMenuEl.className = 'custom-context-menu';
  contextMenuEl.style.display = 'none';
  document.body.appendChild(contextMenuEl);

  return contextMenuEl;
}

/**
 * Bağlam menüsünü kapatır.
 */
export function closeContextMenu() {
  if (contextMenuEl && contextMenuEl.style.display !== 'none') {
    contextMenuEl.style.display = 'none';
    contextMenuEl.innerHTML = '';
    activeTargetEl = null;
  }
}

/**
 * Tam ekran durumunu açar/kapatır (F11 / Fare Orta Tuşu senkronu).
 */
export function toggleAppFullscreen() {
  try {
    if (!document.fullscreenElement) {
      if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch(() => {});
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
    }
  } catch (err) {
    console.warn('[ContextMenu] Tam ekran geçiş hatası:', err);
  }
}

/**
 * Panodaki metni okuyarak indirme işlemini tetikler.
 */
async function handleDownloadFromClipboard() {
  closeContextMenu();
  if (typeof window.pasteAndDownload === 'function') {
    await window.pasteAndDownload();
    return;
  }
  try {
    const text = await navigator.clipboard.readText();
    if (text && text.trim()) {
      const urlInput = document.getElementById('downloader-url-input');
      if (urlInput) {
        urlInput.value = text.trim();
        const navDownloaderBtn = document.getElementById('downloader-action-btn') || document.querySelector('[data-tab="downloader"]');
        if (navDownloaderBtn) navDownloaderBtn.click();
      }
    }
  } catch (e) {
    console.warn('[ContextMenu] Pano okunamadı:', e);
  }
}

/**
 * İndirme klasörünü açar.
 */
async function handleOpenDownloadFolder() {
  closeContextMenu();
  if (typeof window.openFolder === 'function') {
    window.openFolder();
    return;
  }
  try {
    await fetch('/api/open-folder', { method: 'POST' });
  } catch (e) {
    console.warn('[ContextMenu] Klasör açılamadı:', e);
  }
}

/**
 * Kanalları hemen tarar.
 */
function handleScanChannels() {
  closeContextMenu();
  const syncBtn = document.getElementById('sync-now-btn');
  if (syncBtn) {
    syncBtn.click();
  }
}

/**
 * Diski veritabanıyla senkronize eder.
 */
function handleSyncDisk() {
  closeContextMenu();
  if (typeof window.triggerDiskSyncFromPopover === 'function') {
    window.triggerDiskSyncFromPopover();
  } else {
    fetch('/api/settings/sync-disk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'smart' })
    }).catch(() => {});
  }
}

/**
 * Temayı değiştirir.
 */
function handleToggleTheme() {
  closeContextMenu();
  if (typeof window.toggleQuickTheme === 'function') {
    window.toggleQuickTheme();
  }
}

/**
 * Arayüzü yeniler.
 */
function handleRefreshApp() {
  closeContextMenu();
  window.location.reload();
}

/**
 * Geliştirici Araçlarını (DevTools) veya Sistem Konsolunu açar.
 */
function handleOpenDevTools() {
  closeContextMenu();
  try {
    if (window.chrome?.webview?.hostObjects?.playerBridge?.openDevTools) {
      window.chrome.webview.hostObjects.playerBridge.openDevTools();
      return;
    }
  } catch (e) {}

  // Masaüstü köprüsü yoksa arayüz içi Canlı Sistem Konsolunu aç
  const consoleBtn = document.getElementById('nav-tools-console-btn');
  if (consoleBtn) {
    consoleBtn.click();
  }
}

/**
 * Menü öğesi HTML şablonunu üretir.
 */
function renderMenuItem({ id, icon, label, kbd, onClick }) {
  const item = document.createElement('div');
  item.className = 'context-menu-item';
  if (id) item.id = id;

  item.innerHTML = `
    <div class="context-item-left">
      <i data-lucide="${icon}" class="context-item-icon"></i>
      <span class="context-item-text">${label}</span>
    </div>
    ${kbd ? `<span class="context-menu-kbd">${kbd}</span>` : ''}
  `;

  item.addEventListener('click', (e) => {
    e.stopPropagation();
    onClick(e);
  });

  return item;
}

/**
 * Bölücü çizgi üretir.
 */
function renderDivider() {
  const div = document.createElement('div');
  div.className = 'context-menu-divider';
  return div;
}

/**
 * Sağ tık menüsünü oluşturup ekranda konumlandırır.
 */
function openContextMenu(e) {
  const menu = ensureContextMenuElement();
  menu.innerHTML = '';

  const target = e.target;
  activeTargetEl = target;

  const isInputOrTextarea = target.matches('input, textarea') || target.closest('input, textarea');
  const targetInput = isInputOrTextarea ? (target.matches('input, textarea') ? target : target.closest('input, textarea')) : null;

  const selection = window.getSelection ? window.getSelection().toString().trim() : '';

  // 1. Durum: Metin Kutusu (Input / Textarea) İçinde Sağ Tıklama
  if (targetInput && !targetInput.disabled && !targetInput.readOnly) {
    // Kes
    menu.appendChild(renderMenuItem({
      icon: 'scissors',
      label: t('ctx_cut', 'Kes'),
      kbd: 'Ctrl+X',
      onClick: () => {
        closeContextMenu();
        targetInput.focus();
        document.execCommand('cut');
      }
    }));

    // Kopyala
    menu.appendChild(renderMenuItem({
      icon: 'copy',
      label: t('ctx_copy', 'Kopyala'),
      kbd: 'Ctrl+C',
      onClick: () => {
        closeContextMenu();
        targetInput.focus();
        document.execCommand('copy');
      }
    }));

    // Yapıştır
    menu.appendChild(renderMenuItem({
      icon: 'clipboard-paste',
      label: t('ctx_paste', 'Yapıştır'),
      kbd: 'Ctrl+V',
      onClick: async () => {
        closeContextMenu();
        targetInput.focus();
        try {
          const text = await navigator.clipboard.readText();
          if (text) {
            const start = targetInput.selectionStart ?? targetInput.value.length;
            const end = targetInput.selectionEnd ?? targetInput.value.length;
            targetInput.setRangeText(text, start, end, 'end');
            targetInput.dispatchEvent(new Event('input', { bubbles: true }));
          }
        } catch {
          document.execCommand('paste');
        }
      }
    }));

    menu.appendChild(renderDivider());

    // Tümünü Seç
    menu.appendChild(renderMenuItem({
      icon: 'check-square',
      label: t('ctx_select_all', 'Tümünü Seç'),
      kbd: 'Ctrl+A',
      onClick: () => {
        closeContextMenu();
        targetInput.focus();
        targetInput.select();
      }
    }));
  }
  // 2. Durum: Herhangi bir alanda metin seçiliyken sağ tıklama
  else if (selection && selection.length > 0) {
    const truncatedSelection = selection.length > 25 ? selection.substring(0, 25) + '…' : selection;

    // Kopyala
    menu.appendChild(renderMenuItem({
      icon: 'copy',
      label: t('ctx_copy', 'Kopyala'),
      kbd: 'Ctrl+C',
      onClick: async () => {
        closeContextMenu();
        try {
          await navigator.clipboard.writeText(selection);
        } catch {
          document.execCommand('copy');
        }
      }
    }));

    // Google'da Ara
    menu.appendChild(renderMenuItem({
      icon: 'search',
      label: `${t('ctx_search_google', "Google'da Ara")}: "${truncatedSelection}"`,
      onClick: () => {
        closeContextMenu();
        window.open(`https://www.google.com/search?q=${encodeURIComponent(selection)}`, '_blank');
      }
    }));

    menu.appendChild(renderDivider());

    // Panodaki Linki İndir
    menu.appendChild(renderMenuItem({
      icon: 'download',
      label: t('ctx_download_clipboard', 'Panodaki Linki İndir'),
      kbd: 'Ctrl+V',
      onClick: handleDownloadFromClipboard
    }));
  }
  // 3. Durum: Genel Boş Alan Menüsü
  else {
    // Panodaki Linki İndir
    menu.appendChild(renderMenuItem({
      icon: 'download',
      label: t('ctx_download_clipboard', 'Panodaki Linki İndir'),
      kbd: 'Ctrl+V',
      onClick: handleDownloadFromClipboard
    }));

    // İndirme Klasörünü Aç
    menu.appendChild(renderMenuItem({
      icon: 'folder-open',
      label: t('ctx_open_folder', 'İndirme Klasörünü Aç'),
      onClick: handleOpenDownloadFolder
    }));

    menu.appendChild(renderDivider());

    // Kanalları Şimdi Tara
    menu.appendChild(renderMenuItem({
      icon: 'refresh-cw',
      label: t('ctx_scan_channels', 'Kanalları Şimdi Tara'),
      kbd: 'Ctrl+R',
      onClick: handleScanChannels
    }));

    // Diski Veritabanıyla Eşitle
    menu.appendChild(renderMenuItem({
      icon: 'database',
      label: t('ctx_sync_disk', 'Diski Veritabanıyla Eşitle'),
      onClick: handleSyncDisk
    }));

    menu.appendChild(renderDivider());

    // Tam Ekran
    menu.appendChild(renderMenuItem({
      icon: 'maximize-2',
      label: t('ctx_toggle_fullscreen', 'Tam Ekran'),
      kbd: 'F11',
      onClick: () => {
        closeContextMenu();
        toggleAppFullscreen();
      }
    }));

    // Temayı Değiştir
    menu.appendChild(renderMenuItem({
      icon: 'sun-moon',
      label: t('ctx_toggle_theme', 'Temayı Değiştir'),
      onClick: handleToggleTheme
    }));

    menu.appendChild(renderDivider());

    // Arayüzü Yenile
    menu.appendChild(renderMenuItem({
      icon: 'rotate-cw',
      label: t('ctx_refresh', 'Arayüzü Yenile'),
      kbd: 'F5',
      onClick: handleRefreshApp
    }));

    // Geliştirici Araçları (İncele)
    menu.appendChild(renderMenuItem({
      icon: 'code-2',
      label: t('ctx_devtools', 'Geliştirici Araçları (İncele)'),
      kbd: 'Ctrl+Shift+I',
      onClick: handleOpenDevTools
    }));
  }

  // Lucide ikonlarını oluştur
  try {
    if (typeof lucide !== 'undefined' && lucide.createIcons) {
      lucide.createIcons({ root: menu });
    }
  } catch (err) {}

  // Menüyü görünür yapıp ölçüm al
  menu.style.visibility = 'hidden';
  menu.style.display = 'block';

  const menuWidth = menu.offsetWidth || 230;
  const menuHeight = menu.offsetHeight || 280;

  let posX = e.clientX;
  let posY = e.clientY;

  const windowWidth = window.innerWidth;
  const windowHeight = window.innerHeight;

  // Sağ kenara çarpıyorsa sola aç
  if (posX + menuWidth > windowWidth - 12) {
    posX = Math.max(12, windowWidth - menuWidth - 12);
  }

  // Alt kenara çarpıyorsa yukarı aç
  if (posY + menuHeight > windowHeight - 12) {
    posY = Math.max(12, windowHeight - menuHeight - 12);
  }

  menu.style.left = `${posX}px`;
  menu.style.top = `${posY}px`;
  menu.style.visibility = 'visible';
}

/**
 * Özel Sağ Tık Bağlam Menüsü ve Fare Orta Tuşu Dinleyicilerini Başlatır.
 */
export function initContextMenu() {
  // 1. Sağ Tık (contextmenu) Olayı
  window.addEventListener('contextmenu', (e) => {
    // Video player (Plyr veya HTML5 video) veya özel kontroller üzerindeyken varsayılan/oynatıcı menüsüne izin ver
    if (e.target.closest('.plyr, video, audio')) {
      closeContextMenu();
      return;
    }

    e.preventDefault();
    openContextMenu(e);
  });

  // 2. Tıklama Olayları (Dışa Tıklama ile Kapatma ve Fare Orta Tuşu Kontrolü)
  window.addEventListener('mousedown', (e) => {
    // Menü açıksa ve dışına tıklandıysa menüyü kapat
    if (contextMenuEl && contextMenuEl.style.display !== 'none') {
      if (!contextMenuEl.contains(e.target)) {
        closeContextMenu();
      }
    }

    // Fare Orta Tuşu (Button 1 / Tekerlek Tıklaması) -> SADECE masaüstü uygulamasında (WPF / WebView2) tam ekran yap
    // Normal web tarayıcılarında (Chrome/Edge vb.) varsayılan tarayıcı davranışını bozmamak için devre dışıdır
    if (e.button === 1) {
      const isDesktop = !!(window.__IS_HAYTOOL_DESKTOP__ || (typeof window.chrome !== 'undefined' && typeof window.chrome.webview !== 'undefined'));
      if (isDesktop) {
        // Yazı alanları (input, textarea, select) veya context menu üzerinde değilse
        const isInput = e.target.closest('input, textarea, select, .custom-context-menu');
        if (!isInput) {
          e.preventDefault();
          e.stopPropagation();
          if (typeof window.toggleActiveVideoFullscreen === 'function') {
            window.toggleActiveVideoFullscreen();
          } else if (typeof toggleAppFullscreen === 'function') {
            toggleAppFullscreen();
          }
        }
      }
    }
  }, true);

  // 3. Tarayıcının otomatik kaydırma (autoscroll) dairesini SADECE masaüstü uygulamasında engelle
  window.addEventListener('auxclick', (e) => {
    if (e.button === 1) {
      const isDesktop = !!(window.__IS_HAYTOOL_DESKTOP__ || (typeof window.chrome !== 'undefined' && typeof window.chrome.webview !== 'undefined'));
      if (isDesktop) {
        e.preventDefault();
        e.stopPropagation();
      }
    }
  }, true);

  // 4. Escape Tuşuna basıldığında menüyü kapat
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeContextMenu();
    }
  });

  // 5. Pencere boyutu değiştiğinde veya kaydırıldığında menüyü kapat
  window.addEventListener('resize', closeContextMenu);
  window.addEventListener('scroll', closeContextMenu, true);
}
