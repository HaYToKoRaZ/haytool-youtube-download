// Türkçe Açıklama: Klavye kısayollarını yöneten, Ayarlar > Kısayollar sekmesini ve '?' Kısayol Rehberi modalını canlı senkronize eden bağımsız modül.
import { showToast, toastWarning, toastSuccess } from '../components/toast.js';
import { translations } from '../utils/i18n.js';

export const SHORTCUT_DEFINITIONS = [
  // 1. Video Oynatıcı (Ana Oynatıcı, Satır İçi & Web İzle)
  {
    id: 'player_play_pause',
    group: 'player',
    labelKey: 'shortcut_play_pause',
    fallbackLabel: 'Oynat / Duraklat',
    defaultBinding: { code: 'Space', key: ' ', shiftKey: false, ctrlKey: false, altKey: false, numpad: false, label: 'Space' }
  },
  {
    id: 'player_fullscreen',
    group: 'player',
    labelKey: 'shortcut_fullscreen',
    fallbackLabel: 'Tam Ekran Aç / Kapat',
    defaultBinding: { code: 'KeyF', key: 'f', shiftKey: false, ctrlKey: false, altKey: false, numpad: false, label: 'F' }
  },
  {
    id: 'player_theater',
    group: 'player',
    labelKey: 'shortcut_theater',
    fallbackLabel: 'Sinema Modu (Geniş Ekran)',
    defaultBinding: { code: 'KeyT', key: 't', shiftKey: false, ctrlKey: false, altKey: false, numpad: false, label: 'T' }
  },
  {
    id: 'player_mute',
    group: 'player',
    labelKey: 'shortcut_mute',
    fallbackLabel: 'Sesi Kapat / Aç',
    defaultBinding: { code: 'KeyM', key: 'm', shiftKey: false, ctrlKey: false, altKey: false, numpad: false, label: 'M' }
  },
  {
    id: 'player_captions',
    group: 'player',
    labelKey: 'shortcut_captions',
    fallbackLabel: 'Altyazıları Aç / Kapat',
    defaultBinding: { code: 'KeyC', key: 'c', shiftKey: false, ctrlKey: false, altKey: false, numpad: false, label: 'C' }
  },
  {
    id: 'player_sponsorblock',
    group: 'player',
    labelKey: 'shortcut_sponsorblock',
    fallbackLabel: 'SponsorBlock Aç / Kapat',
    defaultBinding: { code: 'KeyS', key: 's', shiftKey: false, ctrlKey: false, altKey: false, numpad: false, label: 'S' }
  },
  {
    id: 'player_speed_up',
    group: 'player',
    labelKey: 'shortcut_speed_up',
    fallbackLabel: 'Video Hızını Artır',
    defaultBinding: { code: 'NumpadAdd', key: '+', shiftKey: false, ctrlKey: false, altKey: false, numpad: true, label: 'Num +' }
  },
  {
    id: 'player_speed_down',
    group: 'player',
    labelKey: 'shortcut_speed_down',
    fallbackLabel: 'Video Hızını Düşür',
    defaultBinding: { code: 'NumpadSubtract', key: '-', shiftKey: false, ctrlKey: false, altKey: false, numpad: true, label: 'Num -' }
  },
  {
    id: 'player_vol_up',
    group: 'player',
    labelKey: 'shortcut_vol_up',
    fallbackLabel: 'Sesi Artır',
    defaultBinding: { code: 'ArrowUp', key: 'ArrowUp', shiftKey: false, ctrlKey: false, altKey: false, numpad: false, label: '↑' }
  },
  {
    id: 'player_vol_down',
    group: 'player',
    labelKey: 'shortcut_vol_down',
    fallbackLabel: 'Sesi Azalt',
    defaultBinding: { code: 'ArrowDown', key: 'ArrowDown', shiftKey: false, ctrlKey: false, altKey: false, numpad: false, label: '↓' }
  },
  {
    id: 'player_seek_back_5',
    group: 'player',
    labelKey: 'shortcut_seek_back_5',
    fallbackLabel: '5 Saniye Geri Sar',
    defaultBinding: { code: 'ArrowLeft', key: 'ArrowLeft', shiftKey: false, ctrlKey: false, altKey: false, numpad: false, label: '←' }
  },
  {
    id: 'player_seek_fwd_5',
    group: 'player',
    labelKey: 'shortcut_seek_fwd_5',
    fallbackLabel: '5 Saniye İleri Sar',
    defaultBinding: { code: 'ArrowRight', key: 'ArrowRight', shiftKey: false, ctrlKey: false, altKey: false, numpad: false, label: '→' }
  },
  {
    id: 'player_seek_back_10',
    group: 'player',
    labelKey: 'shortcut_seek_back_10',
    fallbackLabel: '10 Saniye Geri Sar',
    defaultBinding: { code: 'KeyJ', key: 'j', shiftKey: false, ctrlKey: false, altKey: false, numpad: false, label: 'J' }
  },
  {
    id: 'player_seek_fwd_10',
    group: 'player',
    labelKey: 'shortcut_seek_fwd_10',
    fallbackLabel: '10 Saniye İleri Sar',
    defaultBinding: { code: 'KeyL', key: 'l', shiftKey: false, ctrlKey: false, altKey: false, numpad: false, label: 'L' }
  },
  {
    id: 'player_seek_start',
    group: 'player',
    labelKey: 'shortcut_seek_start',
    fallbackLabel: 'Videonun Başına Git',
    defaultBinding: { code: 'Home', key: 'Home', shiftKey: false, ctrlKey: false, altKey: false, numpad: false, label: 'Home' }
  },
  {
    id: 'player_seek_end',
    group: 'player',
    labelKey: 'shortcut_seek_end',
    fallbackLabel: 'Videonun Sonuna Git',
    defaultBinding: { code: 'End', key: 'End', shiftKey: false, ctrlKey: false, altKey: false, numpad: false, label: 'End' }
  },

  // 2. IPTV & Canlı TV
  {
    id: 'iptv_play_pause',
    group: 'iptv',
    labelKey: 'shortcut_play_pause',
    fallbackLabel: 'Oynat / Duraklat',
    defaultBinding: { code: 'Space', key: ' ', shiftKey: false, ctrlKey: false, altKey: false, numpad: false, label: 'Space' }
  },
  {
    id: 'iptv_next_channel',
    group: 'iptv',
    labelKey: 'shortcut_next_channel',
    fallbackLabel: 'Sıradaki Kanal',
    defaultBinding: { code: 'PageDown', key: 'PageDown', shiftKey: false, ctrlKey: false, altKey: false, numpad: false, label: 'PageDown' }
  },
  {
    id: 'iptv_prev_channel',
    group: 'iptv',
    labelKey: 'shortcut_prev_channel',
    fallbackLabel: 'Önceki Kanal',
    defaultBinding: { code: 'PageUp', key: 'PageUp', shiftKey: false, ctrlKey: false, altKey: false, numpad: false, label: 'PageUp' }
  },
  {
    id: 'iptv_fullscreen',
    group: 'iptv',
    labelKey: 'shortcut_fullscreen',
    fallbackLabel: 'Tam Ekran Aç / Kapat',
    defaultBinding: { code: 'KeyF', key: 'f', shiftKey: false, ctrlKey: false, altKey: false, numpad: false, label: 'F' }
  },
  {
    id: 'iptv_theater',
    group: 'iptv',
    labelKey: 'shortcut_theater',
    fallbackLabel: 'Sinema Modu (Geniş Ekran)',
    defaultBinding: { code: 'KeyT', key: 't', shiftKey: false, ctrlKey: false, altKey: false, numpad: false, label: 'T' }
  },
  {
    id: 'iptv_mute',
    group: 'iptv',
    labelKey: 'shortcut_mute',
    fallbackLabel: 'Sesi Kapat / Aç',
    defaultBinding: { code: 'KeyM', key: 'm', shiftKey: false, ctrlKey: false, altKey: false, numpad: false, label: 'M' }
  },
  {
    id: 'iptv_vol_up',
    group: 'iptv',
    labelKey: 'shortcut_vol_up',
    fallbackLabel: 'Sesi Artır',
    defaultBinding: { code: 'ArrowUp', key: 'ArrowUp', shiftKey: false, ctrlKey: false, altKey: false, numpad: false, label: '↑' }
  },
  {
    id: 'iptv_vol_down',
    group: 'iptv',
    labelKey: 'shortcut_vol_down',
    fallbackLabel: 'Sesi Azalt',
    defaultBinding: { code: 'ArrowDown', key: 'ArrowDown', shiftKey: false, ctrlKey: false, altKey: false, numpad: false, label: '↓' }
  },
  {
    id: 'iptv_dvr_back',
    group: 'iptv',
    labelKey: 'shortcut_dvr_back',
    fallbackLabel: 'Canlı DVR Geri Sar (10s)',
    defaultBinding: { code: 'ArrowLeft', key: 'ArrowLeft', shiftKey: false, ctrlKey: false, altKey: false, numpad: false, label: '←' }
  },
  {
    id: 'iptv_dvr_fwd',
    group: 'iptv',
    labelKey: 'shortcut_dvr_fwd',
    fallbackLabel: 'Canlı DVR İleri Sar (10s)',
    defaultBinding: { code: 'ArrowRight', key: 'ArrowRight', shiftKey: false, ctrlKey: false, altKey: false, numpad: false, label: '→' }
  },
  {
    id: 'iptv_live_edge',
    group: 'iptv',
    labelKey: 'shortcut_live_edge',
    fallbackLabel: 'Canlı Yayına Dön',
    defaultBinding: { code: 'Home', key: 'Home', shiftKey: false, ctrlKey: false, altKey: false, numpad: false, label: 'Home' }
  },
  {
    id: 'iptv_random',
    group: 'iptv',
    labelKey: 'shortcut_random_channel',
    fallbackLabel: 'Rastgele Kanal Aç',
    defaultBinding: { code: 'KeyR', key: 'r', shiftKey: false, ctrlKey: false, altKey: false, numpad: false, label: 'R' }
  },
  {
    id: 'iptv_pip',
    group: 'iptv',
    labelKey: 'shortcut_pip',
    fallbackLabel: 'Resim İçinde Resim (PiP)',
    defaultBinding: { code: 'KeyP', key: 'p', shiftKey: false, ctrlKey: false, altKey: false, numpad: false, label: 'P' }
  },

  // 3. Genel
  {
    id: 'global_shortcuts_help',
    group: 'global',
    labelKey: 'shortcut_open_cheatsheet',
    fallbackLabel: 'Klavye Kısayolları Rehberini Aç',
    defaultBinding: { code: 'Slash', key: '?', shiftKey: true, ctrlKey: false, altKey: false, numpad: false, label: '?' }
  }
];

const DEF_MAP = new Map(SHORTCUT_DEFINITIONS.map(d => [d.id, d]));

let activeCaptureCleanup = null;

function getLangDict() {
  const lang = (typeof window !== 'undefined' && window.localDb?.settings?.lang)
    || (typeof window !== 'undefined' && window.currentLang)
    || (typeof localStorage !== 'undefined' && localStorage.getItem('haytool_user_lang'))
    || 'tr';
  return translations[lang] || translations.tr || {};
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Kullanıcı ayarlarındaki customShortcuts nesnesini güvenli biçimde döndürür.
 * @returns {Record<string, object>}
 */
export function getCustomShortcutsMap() {
  const raw = (typeof window !== 'undefined' && window.localDb?.settings?.customShortcuts);
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  return raw;
}

/**
 * Kaydetme (performAutoSave) sırasında gönderilecek temiz customShortcuts nesnesini döndürür.
 */
export function getCustomShortcutsForSave() {
  const map = getCustomShortcutsMap();
  const clean = {};
  for (const [k, v] of Object.entries(map)) {
    if (!DEF_MAP.has(k) || !v || typeof v !== 'object') continue;
    clean[k] = {
      code: String(v.code || ''),
      key: String(v.key || ''),
      shiftKey: Boolean(v.shiftKey),
      ctrlKey: Boolean(v.ctrlKey),
      altKey: Boolean(v.altKey),
      numpad: Boolean(v.numpad),
      label: String(v.label || '')
    };
  }
  return clean;
}

/**
 * Bir kısayol eyleminin aktif (özelleştirilmiş veya varsayılan) tuş bağlamasını döndürür.
 * @param {string} actionId
 */
export function getEffectiveShortcut(actionId) {
  const def = DEF_MAP.get(actionId);
  if (!def) return null;
  const custom = getCustomShortcutsMap()[actionId];
  if (custom && typeof custom === 'object' && (custom.code || custom.key)) {
    return {
      code: String(custom.code || ''),
      key: String(custom.key || ''),
      shiftKey: Boolean(custom.shiftKey),
      ctrlKey: Boolean(custom.ctrlKey),
      altKey: Boolean(custom.altKey),
      numpad: Boolean(custom.numpad),
      label: String(custom.label || custom.key || custom.code)
    };
  }
  return { ...def.defaultBinding };
}

/**
 * Bir kısayolun varsayılandan değiştirilmiş olup olmadığını döndürür.
 * @param {string} actionId
 */
export function isShortcutCustomized(actionId) {
  const def = DEF_MAP.get(actionId);
  if (!def) return false;
  const custom = getCustomShortcutsMap()[actionId];
  if (!custom || typeof custom !== 'object') return false;
  return !areBindingsEqual(custom, def.defaultBinding);
}

export function areBindingsEqual(a, b) {
  if (!a || !b) return false;
  if (Boolean(a.ctrlKey) !== Boolean(b.ctrlKey)) return false;
  if (Boolean(a.altKey) !== Boolean(b.altKey)) return false;
  if (Boolean(a.numpad) !== Boolean(b.numpad)) return false;
  if (a.numpad || b.numpad) {
    return a.code === b.code && Boolean(a.shiftKey) === Boolean(b.shiftKey);
  }
  if (a.code && b.code && a.code === b.code && Boolean(a.shiftKey) === Boolean(b.shiftKey)) {
    return true;
  }
  return String(a.key || '').toLowerCase() === String(b.key || '').toLowerCase() &&
         Boolean(a.shiftKey) === Boolean(b.shiftKey);
}

/**
 * KeyboardEvent'ten okunabilir etiket ve standart bağlama nesnesi üretir.
 * @param {KeyboardEvent} e
 */
export function buildBindingFromEvent(e) {
  const code = String(e.code || '');
  const key = String(e.key || '');
  const isNumpad = code.startsWith('Numpad');

  const NUMPAD_LABELS = {
    NumpadAdd: 'Num +',
    NumpadSubtract: 'Num -',
    NumpadMultiply: 'Num *',
    NumpadDivide: 'Num /',
    NumpadDecimal: 'Num .',
    NumpadEnter: 'Num Enter',
    Numpad0: 'Num 0',
    Numpad1: 'Num 1',
    Numpad2: 'Num 2',
    Numpad3: 'Num 3',
    Numpad4: 'Num 4',
    Numpad5: 'Num 5',
    Numpad6: 'Num 6',
    Numpad7: 'Num 7',
    Numpad8: 'Num 8',
    Numpad9: 'Num 9'
  };

  const SPECIAL_KEY_LABELS = {
    ' ': 'Space',
    ArrowUp: '↑',
    ArrowDown: '↓',
    ArrowLeft: '←',
    ArrowRight: '→',
    PageUp: 'PageUp',
    PageDown: 'PageDown',
    Home: 'Home',
    End: 'End',
    Backspace: 'Backspace',
    Delete: 'Delete',
    Tab: 'Tab',
    Enter: 'Enter'
  };

  let baseLabel = '';
  if (isNumpad && NUMPAD_LABELS[code]) {
    baseLabel = NUMPAD_LABELS[code];
  } else if (SPECIAL_KEY_LABELS[key]) {
    baseLabel = SPECIAL_KEY_LABELS[key];
  } else if (key.length === 1) {
    baseLabel = key.toUpperCase();
  } else {
    baseLabel = key || code;
  }

  const isShiftedSymbol = key.length === 1 && e.shiftKey && !/^[a-zA-Z]$/.test(key) && !isNumpad;
  const parts = [];
  if (e.ctrlKey) parts.push('Ctrl');
  if (e.altKey) parts.push('Alt');
  if (e.shiftKey && !isShiftedSymbol) parts.push('Shift');
  parts.push(baseLabel);

  return {
    code,
    key: key.length === 1 ? key.toLowerCase() : key,
    shiftKey: Boolean(e.shiftKey),
    ctrlKey: Boolean(e.ctrlKey),
    altKey: Boolean(e.altKey),
    numpad: isNumpad,
    label: parts.join(' + ')
  };
}

/**
 * Bir klavye olayının belirtilen kısayol eylemiyle eşleşip eşleşmediğini kontrol eder.
 * @param {KeyboardEvent} e
 * @param {string} actionId
 * @returns {boolean}
 */
export function matchesShortcut(e, actionId) {
  if (!e || (typeof window !== 'undefined' && window.isCapturingShortcut)) return false;
  const b = getEffectiveShortcut(actionId);
  if (!b) return false;

  if (Boolean(e.ctrlKey) !== Boolean(b.ctrlKey)) return false;
  if (Boolean(e.altKey) !== Boolean(b.altKey)) return false;

  const eventCode = String(e.code || '');
  const eventKey = String(e.key || '');
  const isEventNumpad = eventCode.startsWith('Numpad');

  // Numpad kısayolu ise yalnızca aynı Numpad code ile eşleşsin
  if (b.numpad) {
    if (!isEventNumpad) return false;
    return eventCode === b.code && Boolean(e.shiftKey) === Boolean(b.shiftKey);
  }

  // Numpad olmayan bir kısayol Numpad tuşuyla tetiklenmesin (+ / - karışıklığını önler)
  if (isEventNumpad && b.code && !b.code.startsWith('Numpad')) {
    return false;
  }

  // Shift kontrolü: '?' veya '>' gibi Shift ile üretilen sembollerde key doğrudan eşleşebilir
  const isShiftedSymbol = b.key && b.key.length === 1 && !/^[a-zA-Z0-9 ]$/.test(b.key);
  if (b.shiftKey) {
    if (!e.shiftKey && eventKey !== b.key) return false;
  } else {
    if (e.shiftKey && !(isShiftedSymbol && eventKey === b.key)) return false;
  }

  if (b.code && eventCode === b.code) {
    if (!isShiftedSymbol || !b.shiftKey) return true;
  }

  if (b.key && eventKey) {
    if (eventKey.toLowerCase() === b.key.toLowerCase()) return true;
  }

  return false;
}

async function persistShortcutsToServer() {
  if (typeof window === 'undefined') return;
  if (!window.localDb) window.localDb = { settings: {} };
  if (!window.localDb.settings) window.localDb.settings = {};

  const customShortcuts = getCustomShortcutsForSave();
  window.localDb.settings.customShortcuts = customShortcuts;

  if (typeof window.triggerAutoSave === 'function' && window._settingsFormPopulated) {
    window.triggerAutoSave(true);
    return;
  }

  try {
    await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customShortcuts })
    });
  } catch (_) {}
}

/**
 * Aynı grup içinde başka bir eylemle çakışma olup olmadığını denetler.
 * @param {string} actionId
 * @param {object} candidateBinding
 * @returns {object|null} Çakışan tanım veya null
 */
export function findConflictingShortcut(actionId, candidateBinding) {
  const targetDef = DEF_MAP.get(actionId);
  if (!targetDef) return null;

  for (const def of SHORTCUT_DEFINITIONS) {
    if (def.id === actionId) continue;
    if (def.group !== targetDef.group && def.group !== 'global' && targetDef.group !== 'global') continue;
    const existing = getEffectiveShortcut(def.id);
    if (areBindingsEqual(existing, candidateBinding)) {
      return def;
    }
  }
  return null;
}

/**
 * Ayarlar > Kısayollar sekmesindeki bir tuş kutusuna tıklandığında yeni tuş dinleme modunu başlatır.
 * @param {string} actionId
 * @param {HTMLElement} btnEl
 */
export function startShortcutCapture(actionId, btnEl) {
  if (activeCaptureCleanup) {
    activeCaptureCleanup();
    activeCaptureCleanup = null;
  }

  const def = DEF_MAP.get(actionId);
  if (!def || !btnEl) return;

  const t = getLangDict();
  window.isCapturingShortcut = true;
  btnEl.classList.add('listening');
  btnEl.textContent = t.shortcuts_press_key || 'Tuşa basın... (Esc: İptal)';

  const onKeyDown = (e) => {
    e.preventDefault();
    e.stopPropagation();

    // Tek başına modifier tuşlarını yoksay
    if (['Shift', 'Control', 'Alt', 'Meta', 'CapsLock', 'NumLock'].includes(e.key)) {
      return;
    }

    if (e.key === 'Escape') {
      cleanup();
      renderShortcutsSettingsPanel();
      return;
    }

    const candidate = buildBindingFromEvent(e);
    const conflictDef = findConflictingShortcut(actionId, candidate);
    if (conflictDef) {
      const conflictName = t[conflictDef.labelKey] || conflictDef.fallbackLabel;
      const warnTemplate = t.shortcuts_conflict_warn || '"{key}" tuşu zaten "{action}" için kullanılıyor!';
      const msg = warnTemplate
        .replace('{key}', candidate.label)
        .replace('{action}', conflictName);
      toastWarning(msg);
      cleanup();
      renderShortcutsSettingsPanel();
      return;
    }

    if (!window.localDb) window.localDb = { settings: {} };
    if (!window.localDb.settings) window.localDb.settings = {};
    if (!window.localDb.settings.customShortcuts || typeof window.localDb.settings.customShortcuts !== 'object') {
      window.localDb.settings.customShortcuts = {};
    }

    if (areBindingsEqual(candidate, def.defaultBinding)) {
      delete window.localDb.settings.customShortcuts[actionId];
    } else {
      window.localDb.settings.customShortcuts[actionId] = candidate;
    }

    cleanup();
    renderShortcutsSettingsPanel();
    renderShortcutsCheatsheetModal();
    persistShortcutsToServer();
  };

  const onOutsideClick = (e) => {
    if (btnEl.contains(e.target)) return;
    cleanup();
    renderShortcutsSettingsPanel();
  };

  function cleanup() {
    window.isCapturingShortcut = false;
    window.removeEventListener('keydown', onKeyDown, true);
    window.removeEventListener('mousedown', onOutsideClick, true);
    activeCaptureCleanup = null;
  }

  activeCaptureCleanup = cleanup;
  window.addEventListener('keydown', onKeyDown, true);
  setTimeout(() => {
    if (activeCaptureCleanup === cleanup) {
      window.addEventListener('mousedown', onOutsideClick, true);
    }
  }, 50);
}

/**
 * Tek bir kısayolu varsayılan değerine sıfırlar.
 * @param {string} actionId
 */
export function resetSingleShortcut(actionId) {
  if (activeCaptureCleanup) activeCaptureCleanup();
  if (window.localDb?.settings?.customShortcuts) {
    delete window.localDb.settings.customShortcuts[actionId];
  }
  renderShortcutsSettingsPanel();
  renderShortcutsCheatsheetModal();
  persistShortcutsToServer();
}

/**
 * Tüm kısayolları varsayılan değerlerine sıfırlar.
 */
export function resetAllShortcuts() {
  if (activeCaptureCleanup) activeCaptureCleanup();
  if (window.localDb?.settings) {
    window.localDb.settings.customShortcuts = {};
  }
  const t = getLangDict();
  renderShortcutsSettingsPanel();
  renderShortcutsCheatsheetModal();
  persistShortcutsToServer();
  toastSuccess(t.shortcuts_reset_done || 'Tüm klavye kısayolları varsayılana sıfırlandı.');
}

/**
 * Ayarlar > Kısayollar panelini oluşturur ve günceller.
 */
export function renderShortcutsSettingsPanel() {
  if (typeof document === 'undefined') return;
  const container = document.getElementById('shortcuts-settings-list-container');
  if (!container) return;

  const t = getLangDict();
  const resetSingleTitle = escapeHtml(t.shortcuts_reset_single_title || 'Varsayılana Sıfırla');
  const clickToChangeHint = escapeHtml(t.shortcuts_click_to_change || 'Değiştirmek için tıklayın');

  const groups = [
    {
      key: 'player',
      icon: 'play-square',
      title: t.shortcuts_tab_player || 'Video Oynatıcı (Ana & Web İzle)'
    },
    {
      key: 'iptv',
      icon: 'monitor-play',
      title: t.shortcuts_tab_iptv || 'IPTV & Canlı TV'
    },
    {
      key: 'global',
      icon: 'globe',
      title: t.shortcuts_group_global || 'Genel Uygulama Kısayolları'
    }
  ];

  container.innerHTML = groups.map(g => {
    const items = SHORTCUT_DEFINITIONS.filter(d => d.group === g.key);
    const rowsHtml = items.map(def => {
      const binding = getEffectiveShortcut(def.id);
      const isCustom = isShortcutCustomized(def.id);
      const labelText = escapeHtml(t[def.labelKey] || def.fallbackLabel);
      const keyLabel = escapeHtml(binding.label);
      const defaultLabel = escapeHtml(def.defaultBinding.label);

      return `
        <div class="shortcut-config-row ${isCustom ? 'is-customized' : ''}" data-action-id="${def.id}">
          <div class="shortcut-config-info">
            <span class="shortcut-config-label">${labelText}</span>
            ${isCustom ? `<span class="shortcut-config-default-hint">(${defaultLabel})</span>` : ''}
          </div>
          <div class="shortcut-config-actions">
            <button type="button"
                    class="shortcut-capture-btn ${isCustom ? 'customized' : ''}"
                    title="${clickToChangeHint}"
                    onclick="window.startShortcutCapture('${def.id}', this)">
              ${keyLabel}
            </button>
            <button type="button"
                    class="shortcut-reset-btn"
                    title="${resetSingleTitle} (${defaultLabel})"
                    ${isCustom ? '' : 'disabled'}
                    onclick="window.resetSingleShortcut('${def.id}')">
              <i data-lucide="rotate-ccw" style="width: 13px; height: 13px;"></i>
            </button>
          </div>
        </div>
      `;
    }).join('');

    return `
      <div class="form-group shortcut-group-block" style="grid-column: 1 / -1;">
        <div class="shortcut-group-header">
          <i data-lucide="${g.icon}" style="width: 16px; height: 16px; color: var(--accent-color);"></i>
          <span>${escapeHtml(g.title)}</span>
        </div>
        <div class="shortcut-config-grid">
          ${rowsHtml}
        </div>
      </div>
    `;
  }).join('');

  if (typeof window.lucide !== 'undefined' && window.lucide.createIcons) {
    try { window.lucide.createIcons(); } catch (_) {}
  }
}

/**
 * '?' ile açılan Klavye Kısayolları Rehberi (#shortcuts-modal) içeriğini güncel tuşlarla senkronize eder.
 */
export function renderShortcutsCheatsheetModal() {
  if (typeof document === 'undefined') return;
  const t = getLangDict();

  const playerPanel = document.querySelector('#shortcuts-panel-player .shortcuts-grid');
  if (playerPanel) {
    const playerDefs = SHORTCUT_DEFINITIONS.filter(d => d.group === 'player');
    const dynamicItemsHtml = playerDefs.map(def => {
      const b = getEffectiveShortcut(def.id);
      const label = escapeHtml(t[def.labelKey] || def.fallbackLabel);
      return `
        <div class="shortcut-item">
          <span class="shortcut-desc">${label}</span>
          <div class="shortcut-keys"><kbd>${escapeHtml(b.label)}</kbd></div>
        </div>
      `;
    }).join('');

    const jumpPercentLabel = escapeHtml(t.shortcut_jump_percent || "Videonun %0 - %90'ına Atla");
    playerPanel.innerHTML = dynamicItemsHtml + `
      <div class="shortcut-item">
        <span class="shortcut-desc">${jumpPercentLabel}</span>
        <div class="shortcut-keys"><kbd>0</kbd> ... <kbd>9</kbd></div>
      </div>
    `;
  }

  const iptvPanel = document.querySelector('#shortcuts-panel-iptv .shortcuts-grid');
  if (iptvPanel) {
    const iptvDefs = SHORTCUT_DEFINITIONS.filter(d => d.group === 'iptv');
    const dynamicIptvHtml = iptvDefs.map(def => {
      const b = getEffectiveShortcut(def.id);
      const label = escapeHtml(t[def.labelKey] || def.fallbackLabel);
      return `
        <div class="shortcut-item">
          <span class="shortcut-desc">${label}</span>
          <div class="shortcut-keys"><kbd>${escapeHtml(b.label)}</kbd></div>
        </div>
      `;
    }).join('');

    const slotSelectLabel = escapeHtml(t.shortcut_slot_select || 'Çoklu Ekranda Slot Seç');
    iptvPanel.innerHTML = dynamicIptvHtml + `
      <div class="shortcut-item">
        <span class="shortcut-desc">${slotSelectLabel}</span>
        <div class="shortcut-keys"><kbd>1</kbd> <kbd>2</kbd> <kbd>3</kbd> <kbd>4</kbd></div>
      </div>
    `;
  }
}

export function initShortcutsManager() {
  renderShortcutsSettingsPanel();
  renderShortcutsCheatsheetModal();
}

if (typeof window !== 'undefined') {
  window.initShortcutsManager = initShortcutsManager;
  window.renderShortcutsSettingsPanel = renderShortcutsSettingsPanel;
  window.renderShortcutsCheatsheetModal = renderShortcutsCheatsheetModal;
  window.startShortcutCapture = startShortcutCapture;
  window.resetSingleShortcut = resetSingleShortcut;
  window.resetAllShortcuts = resetAllShortcuts;
  window.matchesShortcut = matchesShortcut;
  window.getEffectiveShortcut = getEffectiveShortcut;
  window.getCustomShortcutsForSave = getCustomShortcutsForSave;
}
