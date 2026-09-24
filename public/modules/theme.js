/**
 * Multimedia HaYTooL - Tema Yönetimi Modülü
 * Geliştirici: HaYTo
 * Açıklama: Koyu, Açık, Matrix, Discord ve YouTube temalarının uygulanması ve döngüsel geçişi.
 */

import { showToast } from './toast.js';

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

  if (currentTheme === 'light') {
    btn.setAttribute('title', isEn ? 'Switch to Matrix Theme (Cyber Green)' : 'Matrix Temasına Geç (Siber Yeşil)');
    btn.innerHTML = `<i data-lucide="terminal" id="quick-theme-icon"></i>`;
  } else if (currentTheme === 'matrix') {
    btn.setAttribute('title', isEn ? 'Switch to Discord Theme (Blurple)' : 'Discord Temasına Geç (Blurple)');
    btn.innerHTML = `<i data-lucide="message-square" id="quick-theme-icon"></i>`;
  } else if (currentTheme === 'discord') {
    btn.setAttribute('title', isEn ? 'Switch to YouTube Theme (Obsidian Red)' : 'YouTube Temasına Geç (Koyu Kırmızı)');
    btn.innerHTML = `<i data-lucide="play-circle" id="quick-theme-icon"></i>`;
  } else if (currentTheme === 'youtube') {
    btn.setAttribute('title', isEn ? 'Switch to Dark Theme' : 'Koyu Temaya Geç (Karanlık)');
    btn.innerHTML = `<i data-lucide="moon" id="quick-theme-icon"></i>`;
  } else {
    btn.setAttribute('title', isEn ? 'Switch to Light Theme' : 'Açık Temaya Geç (Aydınlık)');
    btn.innerHTML = `<i data-lucide="sun" id="quick-theme-icon"></i>`;
  }
  try { if (typeof lucide !== 'undefined') lucide.createIcons(); } catch (e) {}
}

// Window Köprüleri
window.applyTheme = applyTheme;
window.toggleQuickTheme = toggleQuickTheme;
window.updateThemeToggleUI = updateThemeToggleUI;
