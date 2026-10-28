// Türkçe Açıklama: Kullanıcıya ekranın sağ köşesinde anlık durum bildirimleri (toast) gösteren UI bileşeni.

/**
 * Kullanıcı arayüzünde kayan (slide-in) bildirim balonu (toast) görüntüler.
 * 
 * @param {string} message Gösterilecek mesaj metni
 * @param {'info'|'success'|'error'} [type='info'] Bildirim tipi
 * @param {string|null} [thumbnail=null] İsteğe bağlı küçük resim (thumbnail) URL'si
 * @returns {void}
 */
export function showToast(message, type = 'info', thumbnail = null, action = null) {
  const container = document.getElementById('toast-container');
  if (!container) return;
  
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}${thumbnail ? ' toast-has-thumbnail' : ''}`;
  
  let iconName = 'info';
  if (type === 'success') iconName = 'check-circle';
  if (type === 'error') iconName = 'alert-triangle';
  if (type === 'warning') iconName = 'alert-circle';

  let thumbnailHtml = '';
  if (thumbnail) {
    thumbnailHtml = `<img src="${thumbnail}" class="toast-thumbnail" alt="thumbnail">`;
  }

  let actionHtml = '';
  if (action && action.text) {
    actionHtml = `<button class="toast-action-btn" type="button" style="margin-left: 8px; background: rgba(255,255,255,0.25); border: 1px solid rgba(255,255,255,0.45); color: #fff; padding: 4px 10px; border-radius: 6px; font-size: 0.78rem; font-weight: 700; cursor: pointer; white-space: nowrap; box-shadow: 0 2px 6px rgba(0,0,0,0.25); transition: all 0.2s ease;">${action.text}</button>`;
  }

  toast.innerHTML = `
    ${thumbnailHtml}
    <div class="toast-icon">
      <i data-lucide="${iconName}"></i>
    </div>
    <div class="toast-message" style="display:flex; align-items:center; justify-content:space-between; width:100%; gap:8px;">
      <span>${message}</span>
      <div style="display:flex; align-items:center; gap:4px; flex-shrink:0;">
        ${actionHtml}
        <button type="button" class="toast-close-btn" aria-label="Kapat" style="background:transparent; border:none; color:inherit; opacity:0.6; cursor:pointer; padding:2px 4px; line-height:1; display:flex; align-items:center;">
          <i data-lucide="x" style="width:12px; height:12px;"></i>
        </button>
      </div>
    </div>
  `;

  let timer = null;
  const closeToast = () => {
    toast.style.animation = 'slideIn 0.3s reverse forwards';
    setTimeout(() => toast.remove(), 300);
  };

  const startTimer = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(closeToast, 4000);
  };

  startTimer();

  toast.addEventListener('mouseenter', () => {
    if (timer) clearTimeout(timer);
  });
  toast.addEventListener('mouseleave', () => {
    startTimer();
  });

  const closeBtn = toast.querySelector('.toast-close-btn');
  if (closeBtn) {
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (timer) clearTimeout(timer);
      closeToast();
    });
  }

  if (action && typeof action.onClick === 'function') {
    const actBtn = toast.querySelector('.toast-action-btn');
    if (actBtn) {
      actBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (timer) clearTimeout(timer);
        action.onClick();
        closeToast();
      });
    }
  }
  
  container.appendChild(toast);
  
  try {
    lucide.createIcons();
  } catch (e) {
    // Kasıtlı sessiz: Lucide kütüphanesi yüklenmemişse hata yutulur
  }
}

// ─── Typed Wrapper'lar ──────────────────────────────────────────────────────
// Kullanım: toastSuccess('İşlem tamam'), toastError('Bir hata oluştu') vb.
// Tekrar eden showToast(msg, 'error') kalıplarını ortadan kaldırır.

/**
 * Başarı bildirimi gösterir.
 * @param {string} message Gösterilecek mesaj
 * @param {string|null} [thumbnail=null] İsteğe bağlı küçük resim URL'si
 */
export const toastSuccess = (message, thumbnail = null) => showToast(message, 'success', thumbnail);

/**
 * Hata bildirimi gösterir.
 * @param {string} message Gösterilecek mesaj
 * @param {string|null} [thumbnail=null] İsteğe bağlı küçük resim URL'si
 */
export const toastError = (message, thumbnail = null) => showToast(message, 'error', thumbnail);

/**
 * Uyarı bildirimi gösterir.
 * @param {string} message Gösterilecek mesaj
 * @param {string|null} [thumbnail=null] İsteğe bağlı küçük resim URL'si
 */
export const toastWarning = (message, thumbnail = null) => showToast(message, 'warning', thumbnail);

/**
 * Bilgi bildirimi gösterir.
 * @param {string} message Gösterilecek mesaj
 * @param {string|null} [thumbnail=null] İsteğe bağlı küçük resim URL'si
 */
export const toastInfo = (message, thumbnail = null) => showToast(message, 'info', thumbnail);

/**
 * Geri alma (Undo) özellikli bilgi bildirimi gösterir.
 * @param {string} message Gösterilecek mesaj
 * @param {Function} onUndo Geri Al butonuna tıklandığında çalışacak geri çağırma
 */
export function showUndoToast(message, onUndo) {
  const isEn = (typeof localDb !== 'undefined' && localDb.settings && localDb.settings.lang === 'en') || localStorage.getItem('haytool_user_lang') === 'en';
  showToast(message, 'info', null, {
    text: isEn ? 'Undo ↺' : 'Geri Al ↺',
    onClick: onUndo
  });
}

// Global erişim (window.xxx) — HTML onclick ve eski modüller için
if (typeof window !== 'undefined') {
  window.showToast = showToast;
  window.showUndoToast = showUndoToast;
  window.toastSuccess = toastSuccess;
  window.toastError   = toastError;
  window.toastWarning = toastWarning;
  window.toastInfo    = toastInfo;
}

