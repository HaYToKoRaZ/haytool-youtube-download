// public/modules/terminal.js
// Türkçe Açıklama: Canlı sistem terminal günlüğü (log), konsol modalı ve renkli log akışını yöneten bağımsız ES modülü.

/**
 * Sistem konsolu modalını açar, arka plan kaydırmasını kilitler ve sunucudan geçmiş logları yükler.
 */
export function openConsoleModal() {
  const consoleModal = document.getElementById('console-modal');
  const consoleOutput = document.getElementById('console-output');

  if (consoleModal) {
    consoleModal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    
    // Geçmiş logları sunucudan çek
    fetch('/api/logs')
      .then(res => res.json())
      .then(logs => {
        if (!consoleOutput) return;
        consoleOutput.innerHTML = ''; // Temizle
        if (logs && logs.length > 0) {
          logs.forEach(log => appendLogToConsoleModal(log));
        } else {
          consoleOutput.innerHTML = '<div style="color: #a3a3a3; margin-bottom: 8px;">> Geçmiş log bulunamadı, yeni olaylar bekleniyor...</div>';
        }
      })
      .catch(err => console.error('Log geçmişi alınamadı:', err));
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
}
window.initTerminalEvents = initTerminalEvents;

document.addEventListener('DOMContentLoaded', () => {
  initTerminalEvents();
});
