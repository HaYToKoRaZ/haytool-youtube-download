// Türkçe Açıklama: Kullanıcıya ekranın sağ köşesinde anlık durum bildirimleri (toast) gösteren UI bileşeni.

/**
 * Kullanıcı arayüzünde kayan (slide-in) bildirim balonu (toast) görüntüler.
 * 
 * @param {string} message Gösterilecek mesaj metni
 * @param {'info'|'success'|'error'} [type='info'] Bildirim tipi
 * @param {string|null} [thumbnail=null] İsteğe bağlı küçük resim (thumbnail) URL'si
 * @returns {void}
 */
export function showToast(message, type = 'info', thumbnail = null) {
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

  toast.innerHTML = `
    ${thumbnailHtml}
    <div class="toast-icon">
      <i data-lucide="${iconName}"></i>
    </div>
    <div class="toast-message">${message}</div>
  `;
  
  container.appendChild(toast);
  
  try {
    lucide.createIcons();
  } catch (e) {
    // Kasıtlı sessiz: Lucide kütüphanesi yüklenmemişse hata yutulur
  }

  // 4 saniye sonra bildirimi kaldır
  setTimeout(() => {
    toast.style.animation = 'slideIn 0.3s reverse forwards';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}
