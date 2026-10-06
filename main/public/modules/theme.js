/**
 * Multimedia HaYTooL - Tema Yönetimi Modülü
 * Geliştirici: HaYTo
 * Açıklama: Koyu, Açık, Matrix, Discord ve YouTube temalarının uygulanması ve döngüsel geçişi.
 */

import { showToast } from '../components/toast.js';

/**
 * Tema Değiştirme ve Uygulama Yardımcı Fonksiyonu
 * 
 * @param {string} themeName - 'dark' | 'light' | 'matrix' | 'discord' | 'youtube'
 * @returns {void}
 */
export function applyTheme(themeName) {
  const targetTheme = themeName || 'dark';
  document.body.classList.remove('light-theme', 'matrix-theme', 'discord-theme', 'youtube-theme');
  
  if (targetTheme === 'light') {
    document.body.classList.add('light-theme');
  } else if (targetTheme === 'matrix') {
    document.body.classList.add('matrix-theme');
  } else if (targetTheme === 'discord') {
    document.body.classList.add('discord-theme');
  } else if (targetTheme === 'youtube') {
    document.body.classList.add('youtube-theme');
  }
  
  try {
    localStorage.setItem('haytool_theme', targetTheme);
  } catch(e) {}

  if (window.localDb && window.localDb.settings) {
    window.localDb.settings.theme = targetTheme;
  }

  const settingsThemeEl = document.getElementById('settings-theme');
  if (settingsThemeEl) {
    settingsThemeEl.value = targetTheme;
  }

  updateThemeToggleUI(targetTheme);
}

/**
 * Hızlı Tema Değiştir (Quick Theme Toggle Cycle)
 * Koyu -> Açık -> Matrix -> Discord -> YouTube -> Koyu temaları arasında sıralı hızlı geçiş yapar.
 * 
 * @returns {Promise<void>}
 */
export async function toggleQuickTheme() {
  const isLight = document.body.classList.contains('light-theme');
  const isMatrix = document.body.classList.contains('matrix-theme');
  const isDiscord = document.body.classList.contains('discord-theme');
  const isYoutube = document.body.classList.contains('youtube-theme');
  
  let newTheme = 'dark';
  if (!isLight && !isMatrix && !isDiscord && !isYoutube) {
    newTheme = 'light';
  } else if (isLight) {
    newTheme = 'matrix';
  } else if (isMatrix) {
    newTheme = 'discord';
  } else if (isDiscord) {
    newTheme = 'youtube';
  } else {
    newTheme = 'dark';
  }

  applyTheme(newTheme);

  try {
    const payload = { ...(window.localDb && window.localDb.settings ? window.localDb.settings : {}), theme: newTheme };
    await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  } catch (err) {
    if (typeof window.devWarn === 'function') {
      window.devWarn('Tema değişikliği sunucuya kaydedilemedi:', err);
    }
  }

  const isEn = window.localDb && window.localDb.settings && window.localDb.settings.lang === 'en';
  let toastText = '';
  if (newTheme === 'light') {
    toastText = isEn ? 'Light Theme Activated' : 'Açık Tema (Aydınlık) Aktifleştirildi';
  } else if (newTheme === 'matrix') {
    toastText = isEn ? 'Matrix Theme Activated (Cyber Green)' : 'Matrix Teması (Siber Yeşil) Aktifleştirildi 🟢';
  } else if (newTheme === 'discord') {
    toastText = isEn ? 'Discord Theme Activated (Blurple)' : 'Discord Teması (Koyu Blurple) Aktifleştirildi 💬';
  } else if (newTheme === 'youtube') {
    toastText = isEn ? 'YouTube Theme Activated (Obsidian Red)' : 'YouTube Teması (Koyu Kırmızı) Aktifleştirildi ▶️';
  } else {
    toastText = isEn ? 'Dark Theme Activated' : 'Koyu Tema (Karanlık) Aktifleştirildi 🌙';
  }
  
  if (typeof showToast === 'function') {
    showToast(toastText, 'info');
  } else if (typeof window.showToast === 'function') {
    window.showToast(toastText, 'info');
  }
}

/**
 * Tema Buton İkon ve Başlık Arayüzünü Günceller
 * 
 * @param {string} [themeName] - Mevcut aktif tema
 * @returns {void}
 */
export function updateThemeToggleUI(themeName) {
  const btn = document.getElementById('quick-theme-toggle-btn');
  if (!btn) return;

  const isEn = window.localDb && window.localDb.settings && window.localDb.settings.lang === 'en';
  let currentTheme = 'dark';
  if (typeof themeName === 'string') {
    currentTheme = themeName;
  } else if (document.body.classList.contains('light-theme')) {
    currentTheme = 'light';
  } else if (document.body.classList.contains('matrix-theme')) {
    currentTheme = 'matrix';
  } else if (document.body.classList.contains('discord-theme')) {
    currentTheme = 'discord';
  } else if (document.body.classList.contains('youtube-theme')) {
    currentTheme = 'youtube';
  }

  // Döngü sırası toggleQuickTheme ile aynıdır: Koyu -> Açık -> Matrix -> Discord -> YouTube -> Koyu
  const order = ['dark', 'light', 'matrix', 'discord', 'youtube'];
  const icons = { dark: 'moon', light: 'sun', matrix: 'terminal', discord: 'message-square', youtube: 'play' };
  const namesTr = { dark: 'Koyu', light: 'Açık', matrix: 'Matrix', discord: 'Discord', youtube: 'YouTube' };
  const namesEn = { dark: 'Dark', light: 'Light', matrix: 'Matrix', discord: 'Discord', youtube: 'YouTube' };
  const names = isEn ? namesEn : namesTr;

  if (!order.includes(currentTheme)) currentTheme = 'dark';
  const nextTheme = order[(order.indexOf(currentTheme) + 1) % order.length];

  const label = isEn
    ? `Theme: ${names[currentTheme]} • Next: ${names[nextTheme]} (click)`
    : `Tema: ${names[currentTheme]} • Sonraki: ${names[nextTheme]} (tıkla)`;

  btn.setAttribute('title', label);
  btn.setAttribute('aria-label', label);
  btn.setAttribute('data-theme-current', currentTheme);
  btn.innerHTML = `<i data-lucide="${icons[currentTheme]}" id="quick-theme-icon"></i>`;

  // Geçiş animasyonunu her değişimde yeniden tetikle
  btn.classList.remove('theme-toggle-spin');
  void btn.offsetWidth;
  btn.classList.add('theme-toggle-spin');

  try { if (typeof lucide !== 'undefined') lucide.createIcons(); } catch (e) {}
}

// Window Köprüleri
window.applyTheme = applyTheme;
window.toggleQuickTheme = toggleQuickTheme;
window.updateThemeToggleUI = updateThemeToggleUI;
