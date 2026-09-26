/**
 * HaYTooL YT Downloader - Custom Select & Flag Dropdowns Module
 * public/modules/uiDropdowns.js
 */

import { showToast } from '../components/toast.js';

/**
 * Windows uyumlu bayraklı özel dil seçici dropdown bileşenini başlatır.
 * Alfabetik sıralama, dış tıklamada kapatma ve seçim olaylarını yönetir.
 */
export function initCustomSelect() {
  const trigger = document.getElementById('lang-select-trigger');
  const optionsContainer = document.getElementById('lang-custom-options');
  const hiddenInput = document.getElementById('settings-lang');
  const selectedFlag = document.getElementById('selected-lang-flag');
  const selectedText = document.getElementById('selected-lang-text');

  if (!trigger || !optionsContainer || !hiddenInput) return;

  // Dil seçeneklerini visual olarak alfabetik sıraya göre sırala
  const options = Array.from(optionsContainer.querySelectorAll('.custom-option'));
  options.sort((a, b) => {
    const spanA = a.querySelector('span');
    const spanB = b.querySelector('span');
    const textA = spanA ? spanA.innerText.trim() : '';
    const textB = spanB ? spanB.innerText.trim() : '';
    return textA.localeCompare(textB, 'tr', { sensitivity: 'base' });
  });

  // Seçenekleri temizleyip sıralı şekilde yeniden ekle
  optionsContainer.innerHTML = '';
  options.forEach(opt => optionsContainer.appendChild(opt));

  trigger.addEventListener('click', (e) => {
    e.stopPropagation();
    optionsContainer.classList.toggle('open');
  });

  document.addEventListener('click', () => {
    optionsContainer.classList.remove('open');
  });

  const allOptions = optionsContainer.querySelectorAll('.custom-option');
  allOptions.forEach(opt => {
    opt.addEventListener('click', () => {
      const val = opt.getAttribute('data-value');
      hiddenInput.value = val;
      
      // Update trigger UI
      const img = opt.querySelector('img');
      const span = opt.querySelector('span');
      if (img && selectedFlag) selectedFlag.src = img.src;
      if (span && selectedText) selectedText.innerText = span.innerText;

      // Update active option class
      options.forEach(o => o.classList.remove('selected'));
      opt.classList.add('selected');

      // Close options
      optionsContainer.classList.remove('open');

      // Dil değişikliğini anında tüm arayüze canlı olarak uygula
      if (window.localDb && window.localDb.settings) {
        window.localDb.settings.lang = val;
      }
      if (typeof window.applyLanguage === 'function') {
        window.applyLanguage(val);
      }

      // Otomatik kaydetmeyi tetikle
      if (typeof window.performAutoSave === 'function') {
        window.performAutoSave();
      }

      // Üst bildirim mesajı göster
      const langNames = { tr: 'Türkçe', en: 'English', es: 'Español', de: 'Deutsch', pt: 'Português', ar: 'العربية', ru: 'Русский' };
      const chosenLangName = langNames[val] || val;
      const toastMsg = val === 'en' ? `App language updated: ${chosenLangName}` : `Uygulama dili güncellendi: ${chosenLangName}`;
      showToast(toastMsg, 'success');
    });
  });
}

/**
 * Dropdown seçimini programatik olarak günceller (Veritabanından ayarlar yüklendiğinde çağrılır).
 * @param {string} val - Seçilecek dil kodu (tr, en, de, vb.)
 */
export function setCustomSelectValue(val) {
  const hiddenInput = document.getElementById('settings-lang');
  const selectedFlag = document.getElementById('selected-lang-flag');
  const selectedText = document.getElementById('selected-lang-text');
  const optionsContainer = document.getElementById('lang-custom-options');
  if (!hiddenInput || !selectedFlag || !selectedText || !optionsContainer) return;

  hiddenInput.value = val;

  const opt = optionsContainer.querySelector(`.custom-option[data-value="${val}"]`);
  if (opt) {
    const img = opt.querySelector('img');
    const span = opt.querySelector('span');
    if (img) selectedFlag.src = img.src;
    if (span) selectedText.innerText = span.innerText;
    
    const options = optionsContainer.querySelectorAll('.custom-option');
    options.forEach(o => o.classList.remove('selected'));
    opt.classList.add('selected');
  }
}

// Global window bindings for backward compatibility
window.initCustomSelect = initCustomSelect;
window.setCustomSelectValue = setCustomSelectValue;
