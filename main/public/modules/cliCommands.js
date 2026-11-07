// Türkçe Açıklama: Ayarlar > İndirme & Kalite sekmesindeki tek tıkla kopyalanabilir CLI ve Konsol komut rehberi modülü.
import { translations } from '../utils/i18n.js';
import { escapeHtml } from '../utils/helpers.js';
import { showToast } from '../components/toast.js';

const CLI_COMMANDS = [
  // İlk 6 temel komut (varsayılan görünür: Birleşik Oyun+Hız, Duraklatma & Oyun Modu)
  { raw: 'gton', descKey: 'cli_cmd_gton', tag: 'game', exeOnly: false },
  { raw: 'gtoff', descKey: 'cli_cmd_gtoff', tag: 'game', exeOnly: false },
  { raw: 'pause', descKey: 'cli_cmd_pause', tag: 'queue', exeOnly: false },
  { raw: 'resume', descKey: 'cli_cmd_resume', tag: 'queue', exeOnly: false },
  { raw: 'gameon', descKey: 'cli_cmd_gameon', tag: 'game', exeOnly: false },
  { raw: 'gameoff', descKey: 'cli_cmd_gameoff', tag: 'game', exeOnly: false },

  // Genişletilmiş komutlar (Tümünü Göster ile açılır)
  { raw: 'merge', descKey: 'cli_cmd_merge', tag: 'game', exeOnly: false },
  { raw: 'ton', descKey: 'cli_cmd_ton', tag: 'speed', exeOnly: false },
  { raw: 'toff', descKey: 'cli_cmd_toff', tag: 'speed', exeOnly: false },
  { raw: 'speed 2500', descKey: 'cli_cmd_speed_set', tag: 'speed', exeOnly: false },
  { raw: 'speed off', descKey: 'cli_cmd_speed_off', tag: 'speed', exeOnly: false },
  { raw: 'speed on', descKey: 'cli_cmd_speed_on', tag: 'speed', exeOnly: false },
  { raw: 'altspeed 500', descKey: 'cli_cmd_altspeed', tag: 'speed', exeOnly: false },
  { raw: 'paste', descKey: 'cli_cmd_paste', tag: 'queue', exeOnly: true },
  { raw: 'pd "https://youtu.be/dQw4w9WgXcQ"', descKey: 'cli_cmd_pd_url', tag: 'queue', exeOnly: false },
  { raw: 'pd', descKey: 'cli_cmd_pd_toggle', tag: 'queue', exeOnly: false },
  { raw: 'check', descKey: 'cli_cmd_check', tag: 'sys', exeOnly: false },
  { raw: 'status', descKey: 'cli_cmd_status', tag: 'sys', exeOnly: false },
  { raw: 'hide', descKey: 'cli_cmd_hide', tag: 'sys', exeOnly: true },
  { raw: 'stop', descKey: 'cli_cmd_stop', tag: 'sys', exeOnly: false }
];

let cliPrefixMode = localStorage.getItem('haytool_cli_prefix_mode') || 'haytool';
let cliExpanded = false;
let cliPathState = { loaded: false, supported: true, inPath: false, appDir: '', loading: false };
const copyTimers = new WeakMap();

function getT() {
  const lang = localStorage.getItem('haytool_user_lang')
    || document.documentElement.lang
    || (window.localDb && window.localDb.settings && window.localDb.settings.lang)
    || 'tr';
  return translations[lang] || translations.tr || {};
}

export async function fetchCliPathStatus() {
  try {
    const res = await fetch('/api/settings/cli-path-status');
    const data = await res.json();
    if (data && data.success) {
      cliPathState.loaded = true;
      cliPathState.supported = data.supported !== false;
      cliPathState.inPath = !!data.inPath;
      cliPathState.appDir = data.appDir || '';
      window.haytoolCliInPath = cliPathState.inPath;
      if (typeof window.checkCliPathStatus === 'function') {
        window.checkCliPathStatus();
      }
      renderCliCommandsPanel();
    }
  } catch (_) {
    cliPathState.loaded = true;
  }
}

export async function toggleCliPath(action) {
  if (cliPathState.loading) return;
  const t = getT();
  cliPathState.loading = true;
  renderCliCommandsPanel();

  try {
    const res = await fetch('/api/settings/cli-path-toggle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action })
    });
    const data = await res.json();
    if (data && data.success) {
      cliPathState.inPath = data.inPath;
      window.haytoolCliInPath = data.inPath;
      if (typeof window.checkCliPathStatus === 'function') {
        window.checkCliPathStatus();
      }
      const msg = action === 'enable'
        ? (t.cli_path_toast_enabled || 'Windows PATH güncellendi! Yeni açılacak CMD/PowerShell pencerelerinde "haytool" komutunu doğrudan kullanabilirsiniz.')
        : (t.cli_path_toast_disabled || 'Uygulama dizini Windows PATH değişkeninden başarıyla kaldırıldı.');
      showToast(msg, 'success');
    } else {
      showToast(data.error || 'İşlem başarısız oldu.', 'error');
    }
  } catch (err) {
    showToast(err.message || 'Bağlantı hatası.', 'error');
  } finally {
    cliPathState.loading = false;
    renderCliCommandsPanel();
  }
}

function formatCommand(item, mode) {
  if (mode === 'console' && !item.exeOnly) {
    return item.raw;
  }
  if (mode === 'exe') {
    return `"Multimedia HaYTooL.exe" ${item.raw}`;
  }
  if (cliPathState.inPath) {
    return `haytool ${item.raw}`;
  }
  return `.\\haytool ${item.raw}`;
}

async function writeClipboardText(text) {
  if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (_) {}
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    return true;
  } catch (_) {
    return false;
  }
}

export function setCliPrefixMode(mode) {
  if (!['haytool', 'exe', 'console'].includes(mode)) return;
  cliPrefixMode = mode;
  try { localStorage.setItem('haytool_cli_prefix_mode', mode); } catch (_) {}
  renderCliCommandsPanel();
}

export function toggleCliCommandsExpand() {
  cliExpanded = !cliExpanded;
  renderCliCommandsPanel();
}

export async function copyCliCommandRow(index, btnEl) {
  const item = CLI_COMMANDS[index];
  if (!item) return;
  const t = getT();
  const cmdText = formatCommand(item, cliPrefixMode);
  const ok = await writeClipboardText(cmdText);
  if (!ok) return;

  if (btnEl) {
    btnEl.classList.add('is-copied');
    const badge = btnEl.querySelector('.cli-copy-label');
    if (badge) badge.textContent = t.cli_btn_copied || 'Kopyalandı';
    const prevTimer = copyTimers.get(btnEl);
    if (prevTimer) clearTimeout(prevTimer);
    copyTimers.set(btnEl, setTimeout(() => {
      btnEl.classList.remove('is-copied');
      if (badge) badge.textContent = t.cli_btn_copy || 'Kopyala';
    }, 1500));
  }

  showToast(`${t.cli_toast_copied || 'Komut kopyalandı'}: ${cmdText}`, 'success');
}

export function renderCliCommandsPanel() {
  const container = document.getElementById('cli-commands-panel');
  if (!container) return;

  if (!cliPathState.loaded) {
    fetchCliPathStatus();
  }

  const t = getT();
  const visibleList = cliExpanded ? CLI_COMMANDS : CLI_COMMANDS.slice(0, 6);

  const rowsHtml = visibleList.map((item, idx) => {
    const formatted = formatCommand(item, cliPrefixMode);
    const desc = t[item.descKey] || item.raw;
    return `
      <button type="button" class="cli-cmd-row" data-tag="${escapeHtml(item.tag)}" onclick="copyCliCommandRow(${idx}, this)" title="${escapeHtml(t.cli_btn_copy || 'Kopyala')}: ${escapeHtml(formatted)}">
        <div class="cli-cmd-meta">
          <span class="cli-cmd-dot cli-dot-${escapeHtml(item.tag)}"></span>
          <span class="cli-cmd-desc">${escapeHtml(desc)}</span>
        </div>
        <div class="cli-cmd-code-wrap">
          <code class="cli-cmd-code" dir="ltr">${escapeHtml(formatted)}</code>
          <span class="cli-copy-pill">
            <svg class="cli-icon-copy" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
            <svg class="cli-icon-check" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
            <span class="cli-copy-label">${escapeHtml(t.cli_btn_copy || 'Kopyala')}</span>
          </span>
        </div>
      </button>
    `;
  }).join('');

  const toggleText = cliExpanded
    ? (t.cli_btn_show_less || 'Daha Az Göster')
    : `${t.cli_btn_show_more || 'Tüm CLI Komutlarını Göster'} (${CLI_COMMANDS.length})`;

  const haytoolBtnLabel = cliPathState.inPath
    ? (t.cli_mode_haytool_global || 'haytool (Global PATH)')
    : (t.cli_mode_haytool || '.\\haytool');

  let pathBarHtml = '';
  if (cliPathState.supported) {
    const isAct = cliPathState.inPath;
    const badgeCls = isAct ? 'active' : 'inactive';
    const badgeText = isAct ? (t.cli_path_status_active || 'PATH: Aktif') : (t.cli_path_status_inactive || 'PATH: Pasif');

    let btnHtml = '';
    if (cliPathState.loading) {
      btnHtml = `<button type="button" class="cli-path-toggle-btn" disabled><span class="cli-path-spinner"></span> ${escapeHtml(t.cli_path_loading || 'İşleniyor...')}</button>`;
    } else if (isAct) {
      btnHtml = `<button type="button" class="cli-path-toggle-btn btn-remove" onclick="toggleCliPath('disable')" title="${escapeHtml(t.cli_path_btn_disable_tip || 'main klasörünü Windows Kullanıcı PATH değişkeninden çıkarır')}"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg> ${escapeHtml(t.cli_path_btn_disable || 'PATH\'ten Kaldır')}</button>`;
    } else {
      btnHtml = `<button type="button" class="cli-path-toggle-btn" onclick="toggleCliPath('enable')" title="${escapeHtml(t.cli_path_btn_enable_tip || 'Herhangi bir CMD veya PowerShell penceresinden doğrudan haytool komutunu çalıştırabilmek için kullanıcı PATH ortam değişkenine ekler')}"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14"></path></svg> ${escapeHtml(t.cli_path_btn_enable || 'Windows PATH\'e Ekle')}</button>`;
    }

    pathBarHtml = `
      <div class="cli-path-bar">
        <div class="cli-path-info">
          <span class="cli-path-status-badge ${badgeCls}">
            <span class="cli-path-status-dot"></span>
            ${escapeHtml(badgeText)}
          </span>
          <div class="cli-path-details">
            <span class="cli-path-title-text">${escapeHtml(t.cli_path_bar_title || 'Global Terminal Erişimi (Windows PATH)')}</span>
            <span class="cli-path-meta-text" title="HKCU\\Environment\\Path &bull; ${escapeHtml(cliPathState.appDir)}">HKCU\\Environment\\Path &bull; ${escapeHtml(cliPathState.appDir || 'main')}</span>
          </div>
        </div>
        <div class="cli-path-actions">
          ${btnHtml}
        </div>
      </div>
    `;
  }

  container.innerHTML = `
    <div class="cli-panel-header">
      <div class="cli-panel-heading">
        <div class="cli-panel-title-row">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" class="cli-terminal-icon"><polyline points="4 17 10 11 4 5"></polyline><line x1="12" y1="19" x2="20" y2="19"></line></svg>
          <span class="cli-panel-title">${escapeHtml(t.cli_panel_title || 'CLI & Konsol Komut Örnekleri')}</span>
        </div>
        <span class="cli-panel-subtitle">${escapeHtml(t.cli_panel_subtitle || 'Herhangi bir satıra tıklayarak komutu kopyalayın')}</span>
      </div>
      <div class="cli-mode-segmented" role="group">
        <button type="button" class="cli-mode-btn ${cliPrefixMode === 'haytool' ? 'active' : ''}" onclick="setCliPrefixMode('haytool')">${escapeHtml(haytoolBtnLabel)}</button>
        <button type="button" class="cli-mode-btn ${cliPrefixMode === 'exe' ? 'active' : ''}" onclick="setCliPrefixMode('exe')">${escapeHtml(t.cli_mode_exe || 'Tam Exe')}</button>
        <button type="button" class="cli-mode-btn ${cliPrefixMode === 'console' ? 'active' : ''}" onclick="setCliPrefixMode('console')">${escapeHtml(t.cli_mode_console || 'Tepsi Konsolu')}</button>
      </div>
    </div>
    ${pathBarHtml}
    <div class="cli-cmd-grid">
      ${rowsHtml}
    </div>
    <button type="button" class="cli-expand-btn" onclick="toggleCliCommandsExpand()">
      <span>${escapeHtml(toggleText)}</span>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="transform: rotate(${cliExpanded ? '180deg' : '0deg'}); transition: transform 0.2s ease;"><polyline points="6 9 12 15 18 9"></polyline></svg>
    </button>
  `;
}

if (typeof window !== 'undefined') {
  window.setCliPrefixMode = setCliPrefixMode;
  window.toggleCliCommandsExpand = toggleCliCommandsExpand;
  window.copyCliCommandRow = copyCliCommandRow;
  window.renderCliCommandsPanel = renderCliCommandsPanel;
  window.fetchCliPathStatus = fetchCliPathStatus;
  window.toggleCliPath = toggleCliPath;
}
