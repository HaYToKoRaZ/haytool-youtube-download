// public/modules/terminal.js
// Türkçe Açıklama: Canlı sistem terminal günlüğü (log), konsol modalı ve renkli log akışını yöneten bağımsız ES modülü.

// Konsol modu: 'app' = süzülmüş uygulama günlüğü, 'raw' = Node sürecinin ham stdout/stderr çıktısı
let consoleMode = 'app';

function consoleModeUrl() {
  return consoleMode === 'raw' ? '/api/logs?raw=1' : '/api/logs';
}

function updateConsoleModeButton() {
  const btn = document.getElementById('console-mode-btn');
  if (!btn) return;
  if (consoleMode === 'raw') {
    btn.textContent = 'Ham Çıktı ✓';
    btn.style.color = '#4af626';
    btn.style.borderColor = '#4af626';
  } else {
    btn.textContent = 'Ham Çıktı';
    btn.style.color = '#a3a3a3';
    btn.style.borderColor = '#444';
  }
}

function reloadConsoleContent() {
  const consoleOutput = document.getElementById('console-output');
  if (!consoleOutput) return;
  consoleOutput.innerHTML = '<div style="color: #a3a3a3; margin-bottom: 8px;">> Yükleniyor...</div>';
  fetch(consoleModeUrl())
    .then(res => res.json())
    .then(logs => {
      consoleOutput.innerHTML = '';
      if (logs && logs.length > 0) {
        logs.forEach(log => appendLogToConsoleModal(log));
      } else {
        const msg = consoleMode === 'raw'
          ? '> Ham çıktı henüz boş. Sunucu yeni bir satır yazdığında burada görünecek.'
          : '> Geçmiş log bulunamadı, yeni olaylar bekleniyor...';
        consoleOutput.innerHTML = `<div style="color: #a3a3a3; margin-bottom: 8px;">${msg}</div>`;
      }
    })
    .catch(err => console.error('Log geçmişi alınamadı:', err));
}

/**
 * Uygulama günlüğü ile ham sistem çıktısı arasında geçiş yapar.
 */
export function toggleConsoleMode() {
  consoleMode = consoleMode === 'raw' ? 'app' : 'raw';
  updateConsoleModeButton();
  reloadConsoleContent();
}
window.toggleConsoleMode = toggleConsoleMode;

/**
 * Ham çıktı olayını (SSE: terminal_raw) yalnızca ham mod açıkken konsola ekler.
 */
export function appendRawLogToConsole(log) {
  if (consoleMode !== 'raw' || !log) return;
  appendLogToConsoleModal(log);
}
window.appendRawLogToConsole = appendRawLogToConsole;

/**
 * Sistem konsolu modalını açar, arka plan kaydırmasını kilitler ve sunucudan geçmiş logları yükler.
 */
export function openConsoleModal() {
  const consoleModal = document.getElementById('console-modal');
  const consoleOutput = document.getElementById('console-output');

  if (consoleModal) {
    consoleModal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    updateConsoleModeButton();
    reloadConsoleContent();
  }

  // Varsa açık araçlar menüsünü kapat
  const toolsMenu = document.getElementById('tools-menu');
  if (toolsMenu && toolsMenu.classList.contains('show')) {
    toolsMenu.classList.remove('show');
  }
}
window.openConsoleModal = openConsoleModal;

/**
 * Sistem konsolu modalını kapatır ve sayfa kaydırmasını geri açar.
 */
export function closeConsoleModal() {
  const consoleModal = document.getElementById('console-modal');
  if (consoleModal) {
    consoleModal.classList.add('hidden');
    document.body.style.overflow = '';
  }
}
window.closeConsoleModal = closeConsoleModal;

/**
 * Konsol modalındaki tüm metinleri temizler.
 */
export function clearConsoleModal() {
  const consoleOutput = document.getElementById('console-output');
  if (consoleOutput) {
    consoleOutput.innerHTML = '<div style="color: #a3a3a3; margin-bottom: 8px;">> Konsol temizlendi.</div>';
  }
}
window.clearConsoleModal = clearConsoleModal;

/**
 * Yeni bir log satırını renklendirip biçimlendirerek konsol ekranına ekler ve otomatik aşağı kaydırır.
 * 
 * @param {object} log Log nesnesi ({ timestamp, type, message })
 */
export function appendLogToConsoleModal(log) {
  const consoleOutput = document.getElementById('console-output');
  if (!consoleOutput || !log) return;

  const div = document.createElement('div');
  div.style.marginBottom = '4px';
  div.style.wordBreak = 'break-all';
  
  // Renk kodlaması
  let color = '#d4d4d4'; // Varsayılan info
  if (log.type === 'error') color = '#ff4d4d';
  else if (log.type === 'warning' || log.type === 'warn') color = '#ffcc00';
  else if (log.type === 'success') color = '#4af626';
  
  const timeStr = log.timestamp ? new Date(log.timestamp).toLocaleTimeString() : new Date().toLocaleTimeString();
  div.innerHTML = `<span style="color: #666;">[${timeStr}]</span> <span style="color: ${color};">${log.message}</span>`;
  
  consoleOutput.appendChild(div);
  
  // Otomatik aşağı kaydır
  consoleOutput.scrollTop = consoleOutput.scrollHeight;
}
window.appendLogToConsoleModal = appendLogToConsoleModal;

/**
 * Konsol butonlarına ait olay dinleyicilerini ilklendirir.
 */
export function initTerminalEvents() {
  const navToolsConsoleBtn = document.getElementById('nav-tools-console-btn');
  const closeConsoleBtn = document.getElementById('close-console-modal-btn');
  const clearConsoleBtn = document.getElementById('clear-console-btn');

  if (navToolsConsoleBtn && !navToolsConsoleBtn.dataset.initialized) {
    navToolsConsoleBtn.dataset.initialized = 'true';
    navToolsConsoleBtn.addEventListener('click', openConsoleModal);
  }

  if (closeConsoleBtn && !closeConsoleBtn.dataset.initialized) {
    closeConsoleBtn.dataset.initialized = 'true';
    closeConsoleBtn.addEventListener('click', closeConsoleModal);
  }

  if (clearConsoleBtn && !clearConsoleBtn.dataset.initialized) {
    clearConsoleBtn.dataset.initialized = 'true';
    clearConsoleBtn.addEventListener('click', clearConsoleModal);
  }

  const modeBtn = document.getElementById('console-mode-btn');
  if (modeBtn && !modeBtn.dataset.initialized) {
    modeBtn.dataset.initialized = 'true';
    modeBtn.addEventListener('click', toggleConsoleMode);
    updateConsoleModeButton();
  }
}
window.initTerminalEvents = initTerminalEvents;

document.addEventListener('DOMContentLoaded', () => {
  initTerminalEvents();
});
