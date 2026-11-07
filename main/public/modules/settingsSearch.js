// Türkçe Açıklama: Ayarlar sayfası arama kutusu. Yazılan metne göre ayar bloklarını (birimleri) süzer;
// eşleşmeyen bloklar ve boş kalan kartlar gizlenir. Arama sırasında tüm kategoriler birlikte gösterilir,
// arama temizlenince önceki kategori geri yüklenir. Hiçbir ayar öğesinin id'sine veya değerine dokunmaz.
// Description: Settings search box. Filters setting blocks by typed text without touching any control.
import { translations } from '../utils/i18n.js';

const HIDDEN_CLASS = 'settings-search-hidden';
let previousSubtab = null;
let bound = false;

function norm(s) {
  return (s || '').toLocaleLowerCase('tr').replace(/\s+/g, ' ').trim();
}

/** Bir kartın aranabilir birimlerini döner: kart çocukları, form-grid ise onun çocukları. */
function getUnits(card) {
  const units = [];
  Array.from(card.children).forEach(el => {
    if (el.tagName === 'H3') return;
    if (el.classList.contains('form-grid')) units.push(...Array.from(el.children));
    else units.push(el);
  });
  return units;
}

function unitText(el) {
  let txt = el.textContent || '';
  el.querySelectorAll('select option').forEach(o => { txt += ' ' + o.textContent; });
  el.querySelectorAll('input[placeholder]').forEach(i => { txt += ' ' + i.getAttribute('placeholder'); });
  return norm(txt);
}

function applyFilter(query) {
  const q = norm(query);
  const layout = document.getElementById('settings-layout-container');
  const empty = document.getElementById('settings-search-empty');
  if (!layout) return;

  const cards = Array.from(layout.querySelectorAll('.settings-card'));
  // Arama bitti: her şeyi geri aç
  if (!q) {
    layout.querySelectorAll('.' + HIDDEN_CLASS).forEach(e => e.classList.remove(HIDDEN_CLASS));
    if (empty) empty.hidden = true;
    if (previousSubtab && typeof window.switchSettingsSubtab === 'function') {
      window.switchSettingsSubtab(previousSubtab);
    }
    previousSubtab = null;
    return;
  }

  // Arama başladı: tüm kategorileri göster (önceki seçimi hatırla)
  if (previousSubtab === null) {
    const active = document.querySelector('.settings-subtab-btn.active');
    previousSubtab = active ? (active.getAttribute('data-subtab') || 'all') : 'all';
    if (typeof window.switchSettingsSubtab === 'function') {
      window.switchSettingsSubtab('all');
      // switchSettingsSubtab kayıtlı sekmeyi 'all' yapar; arama bitince gerçek seçim geri yüklenir.
    }
  }

  let totalVisible = 0;
  cards.forEach(card => {
    const units = getUnits(card);
    let cardVisible = 0;
    units.forEach(u => {
      const match = unitText(u).includes(q);
      u.classList.toggle(HIDDEN_CLASS, !match);
      if (match) cardVisible++;
    });
    // İç içe kart (Fakap) kendi sarmalayıcısıyla birlikte gizlenir
    const holder = card.parentElement && card.parentElement.classList.contains('settings-subtab-panel') ? card : card;
    holder.classList.toggle(HIDDEN_CLASS, cardVisible === 0);
    totalVisible += cardVisible;
  });
  // İçindeki tüm kartları gizli kalan paneli de gizle
  layout.querySelectorAll('.settings-subtab-panel').forEach(p => {
    const anyCard = Array.from(p.querySelectorAll('.settings-card')).some(c => !c.classList.contains(HIDDEN_CLASS));
    p.classList.toggle(HIDDEN_CLASS, !anyCard);
  });
  if (empty) empty.hidden = totalVisible > 0;
}

function applyPlaceholders() {
  const input = document.getElementById('settings-search-input');
  if (!input) return;
  const lang = (window.localDb && window.localDb.settings && window.localDb.settings.lang) || localStorage.getItem('haytool_user_lang') || 'tr';
  const t = translations[lang] || translations.tr || {};
  if (t.settings_search_placeholder) input.placeholder = t.settings_search_placeholder;
  if (t.settings_search_placeholder) input.setAttribute('aria-label', t.settings_search_placeholder);
  const empty = document.getElementById('settings-search-empty');
  if (empty && t.settings_search_empty) empty.textContent = t.settings_search_empty;
}

export function initSettingsSearch() {
  const input = document.getElementById('settings-search-input');
  if (!input) return;
  applyPlaceholders();
  if (bound) return;
  bound = true;
  let timer = null;
  input.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(() => applyFilter(input.value), 120);
  });
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); return; } // form gönderimini ve kaydı tetikleme
    if (e.key === 'Escape' && input.value) {
      input.value = '';
      applyFilter('');
    }
  });
  // Kategori butonuna basılırsa aramayı sıfırla
  document.querySelectorAll('.settings-subtab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (input.value) {
        input.value = '';
        previousSubtab = null;
        document.querySelectorAll('#settings-layout-container .' + HIDDEN_CLASS).forEach(e => e.classList.remove(HIDDEN_CLASS));
        const empty = document.getElementById('settings-search-empty');
        if (empty) empty.hidden = true;
      }
    });
  });
}
window.initSettingsSearch = initSettingsSearch;
window.applySettingsSearchLang = applyPlaceholders;
