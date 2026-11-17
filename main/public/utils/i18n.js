import { tr } from './language/tr.js';

const SUPPORTED_LANGS = ['tr', 'en', 'es', 'de', 'pt', 'ar', 'ru'];

export const translations = { tr };

export async function ensureLanguageLoaded(code) {
  if (!SUPPORTED_LANGS.includes(code) || translations[code]) return translations[code];
  const mod = await import(`./language/${code}.js`);
  translations[code] = mod[code] || {};
  return translations[code];
}

// Eğer kullanıcı Türkçe dışında bir dil seçtiyse arka planda lazy-load et (top-level await olmadan)
try {
  const initialLang = (typeof localStorage !== 'undefined' && localStorage.getItem('haytool_user_lang')) || 'tr';
  if (initialLang !== 'tr' && SUPPORTED_LANGS.includes(initialLang)) {
    ensureLanguageLoaded(initialLang).then(() => {
      if (typeof window.applyLanguage === 'function') {
        window.applyLanguage(initialLang);
      }
    }).catch(() => {});
  }
} catch {}
