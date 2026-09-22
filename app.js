/**
 * HaYTooL MeowTube Landing Page Logic
 * Interactive Tabs, Multi-Language, and Lightbox Gallery
 */

// Dil Sözlüğü (TR & EN)
const i18n = {
  tr: {
    nav_features: "Özellikler",
    nav_screenshots: "Ekran Görüntüleri",
    nav_shortcuts: "Kısayollar",
    nav_install: "Kurulum",
    nav_portal: "🌟 Tüm Uygulamalar",
    footer_portal: "🌐 Ana Portföy (Tüm Uygulamalar)",
    footer_terms: "Hizmet Koşulları",
    footer_privacy: "Gizlilik Politikası",
    hero_badge: "🐱 HaYTooL Meow Edition • Algoritmalara Meydan Okuyun!",
    hero_title_1: "Algoritma Pençesinden Kurtulun,",
    hero_title_2: "Kendi Özel Kütüphanenizi Kurun.",
    hero_sub: "İstenmeyen öneriler ve sonsuz video tuzakları yok! Sadece takip ettiğiniz kanalları arka planda otomatik indirin, %100 reklamsız ve çevrimdışı izleyin.",
    btn_download: "Hemen İndir",
    btn_github: "GitHub'da İncele",
    btn_all_apps: "Tüm Uygulamalar",
    stat_adfree: "%100 Reklamsız",
    stat_adfree_sub: "SponsorBlock Entegre",
    stat_portable: "Sıfır Bağımlılık",
    stat_portable_sub: "Node + yt-dlp + FFmpeg Dahil",
    stat_languages: "7 Dil Desteği",
    stat_languages_sub: "Otomatik Altyazı Çevirisi",
    cat_quote: "Miyav! Reklamsız izlemek harika!",
    mascot_tooltip: "Bana tıkla, miyavlayayım! 🐾",
    features_tag: "🐾 Neden HaYTooL?",
    features_title: "Özgürlüğünüzü Geri Kazanın",
    features_desc: "Tüm kontroller sizin elinizde. Arka planda sessizce çalışan otomasyon motoru.",
    gallery_tag: "📸 Arayüz & Görseller",
    gallery_title: "Zarif, Güçlü ve Kullanıcı Dostu Arayüz",
    gallery_desc: "Modern koyu tema, çift oynatıcı deneyimi ve gelişmiş yönetim paneli.",
    shortcuts_tag: "🎹 Klavye Kısayolları",
    shortcuts_title: "Oynatıcıyı Parmaklarınızla Yönetin",
    shortcuts_desc: "Gelişmiş yerel oynatıcımızda farenize dokunmadan her şeyi kontrol edin.",
    install_tag: "🚀 Hızlı Başlangıç",
    install_title: "Kurulum Gerektirmez, Hemen Başlayın",
    install_desc: "Tüm bağımlılıklar paket içinde hazır gelir; ek kurulumla uğraşmayın.",
    install_win_title: "Windows İçin Başlatma",
    install_win_desc: "Klasör içindeki <b>Multimedia HaYTooL.exe</b> dosyasını çift tıklatarak sistem tepsisinde başlatabilirsiniz.",
    install_win_player: "Veya bağımsız masaüstü C# oynatıcısını çalıştırmak için:",
    install_win_port: "Dashboard varsayılan olarak <span style=\"color: #FFB703;\">http://localhost:4141</span> adresinde açılır.",
    install_linux_title: "Linux / macOS (Unix)",
    install_linux_desc: "Terminalden çalıştırma izni verin ve başlatma scriptini çalıştırın:",
    install_linux_note: "Çift işletim sistemli (Dual-boot) sistemlerde config parametreleri otomatik izole edilir.",
    cli_title: "Gelişmiş CLI & Terminal Komut Desteği",
    cli_desc: "HaYTooL'u arayüz açmadan terminalden (CMD / PowerShell / Bash) veya Sistem Tepsisi 'Konsol Çıktısı' penceresinden doğrudan kontrol edebilirsiniz:",
    cli_pd_desc: "Verilen video veya çalma listesini doğrudan indirme sırasına ekler.",
    cli_status_desc: "Aktif indirmeleri, hız sınırlarını ve kuyruk durumunu listeler.",
    cli_turtle_desc: "Kaplumbağa modunu (alternatif düşük hız profilini) açar, kapatır veya değiştirir.",
    cli_speed_desc: "Normal veya kaplumbağa indirme hız sınırını KB/s olarak anında ayarlar.",
    cli_example_label: "Terminalden doğrudan indirme başlatma örneği:"
  },
  en: {
    nav_features: "Features",
    nav_screenshots: "Screenshots",
    nav_shortcuts: "Shortcuts",
    nav_install: "Installation",
    nav_portal: "🌟 All Apps",
    footer_portal: "🌐 Main Hub (All Apps)",
    footer_terms: "Terms of Service",
    footer_privacy: "Privacy Policy",
    hero_badge: "🐱 HaYTooL Meow Edition • Reclaim Your Feed!",
    hero_title_1: "Break Free from the Algorithm,",
    hero_title_2: "Build Your Private Library.",
    hero_sub: "No distractions, no addictive traps! Monitor followed channels via RSS, auto-download newly released videos, and enjoy 100% ad-free offline playback.",
    btn_download: "Download Now",
    btn_github: "View on GitHub",
    btn_all_apps: "All Apps",
    stat_adfree: "100% Ad-Free",
    stat_adfree_sub: "SponsorBlock Integrated",
    stat_portable: "Zero Dependencies",
    stat_portable_sub: "Node + yt-dlp + FFmpeg Bundled",
    stat_languages: "7 Languages",
    stat_languages_sub: "Auto Subtitle Translation",
    cat_quote: "Meow! Watching ad-free is purrfect!",
    mascot_tooltip: "Click me to hear a meow! 🐾",
    features_tag: "🐾 Why HaYTooL?",
    features_title: "Reclaim Your Digital Freedom",
    features_desc: "Total control in your hands. A quiet, resilient automation daemon working in the background.",
    gallery_tag: "📸 Interface & Snapshots",
    gallery_title: "Elegant, Powerful & Modern UI",
    gallery_desc: "Sleek dark theme, split playlist viewer, and comprehensive management dashboard.",
    shortcuts_tag: "🎹 Shortcuts",
    shortcuts_title: "Control Playback with Keystrokes",
    shortcuts_desc: "Navigate videos effortlessly with high-performance hotkeys.",
    install_tag: "🚀 Quick Start",
    install_title: "No Setup Required, Run Instantly",
    install_desc: "All dependencies are pre-packaged in the repository. It works out of the box.",
    install_win_title: "Running on Windows",
    install_win_desc: "Double-click <b>Multimedia HaYTooL.exe</b> in the folder to start the app in the system tray.",
    install_win_player: "Or run the standalone native desktop C# player directly:",
    install_win_port: "Dashboard opens by default at <span style=\"color: #FFB703;\">http://localhost:4141</span>.",
    install_linux_title: "Linux / macOS (Unix)",
    install_linux_desc: "Grant executable permission in terminal and execute the start script:",
    install_linux_note: "Configuration parameters are safely isolated across dual-boot environments.",
    cli_title: "Advanced CLI & Terminal Command Support",
    cli_desc: "Control HaYTooL headless from your terminal (CMD / PowerShell / Bash) or via the System Tray 'Console Output' window:",
    cli_pd_desc: "Directly enqueues given video or playlist URL for immediate download.",
    cli_status_desc: "Displays active downloads, speed limits, and queue status.",
    cli_turtle_desc: "Turns on, turns off, or toggles Turtle Mode (alternative low-speed profile).",
    cli_speed_desc: "Sets standard or turtle download speed limit in KB/s on the fly.",
    cli_example_label: "Example CLI download command directly from terminal:"
  }
};

let currentLang = 'tr';

// Kedi Maskotu Tıklama Cümleleri & Pati Sesleri (Dile göre dinamik havuz)
const catMeowDict = {
  tr: [
    'Miyav! 🐾',
    'Pati gücü! 🐱',
    'Reklamlar engellendi! 🛡️',
    'Sıradaki video iniyor! 🚀',
    'Patili günler! 🐾',
    'Mırıltı modu aktif! 😻',
    'Algoritmalar patilendi! ✨',
    'Kütüphanen güvende! 📦'
  ],
  en: [
    'Meow! 🐾',
    'Paw power! 🐱',
    'Ads blocked! 🛡️',
    'Downloading next video! 🚀',
    'Purrfect day! 🐾',
    'Purr mode active! 😻',
    'Algorithms paw-struck! ✨',
    'Your library is safe! 📦'
  ]
};

// Ekran Görüntüsü Verileri
const galleryItems = [
  {
    id: 'libry',
    category: 'tr',
    title: 'Kütüphane Görünümü',
    title_en: 'Library (Home) View',
    desc: 'Takip edilen kanallardan otomatik indirilen videoların ızgara görünümü.',
    desc_en: 'Grid view of auto-downloaded videos from your subscriptions.',
    src: 'assets/screenshots/tr-kutuphane.png'
  },
  {
    id: 'downlist',
    category: 'tr',
    title: 'İndirilenler & Çift Sütun Oynatıcı',
    title_en: 'Inline Player & Playlist',
    desc: 'Sol tarafta video oynatılırken sağ tarafta sıradaki videoları listeleme.',
    desc_en: 'Watch videos on the left while browsing your downloads sidebar on the right.',
    src: 'assets/screenshots/tr-indirilenler.png'
  },
  {
    id: 'queue',
    category: 'tr',
    title: 'İndirme Kuyruğu',
    title_en: 'Download Queue',
    desc: 'Aktif indirmeler, hız göstergeleri ve indirme öncelik yönetimi.',
    desc_en: 'Active downloads, progress bars, and queue reordering.',
    src: 'assets/screenshots/tr-kuyruk.png'
  },
  {
    id: 'channels',
    category: 'tr',
    title: 'Kanal Yönetimi',
    title_en: 'Followed Channels',
    desc: 'Her kanal için özel indirme kuralları (Shorts engelleme, süre filtreleri).',
    desc_en: 'Per-channel download rules, shorts toggles, and duration filters.',
    src: 'assets/screenshots/tr-kanallar.png'
  },
  {
    id: 'settings',
    category: 'tr',
    title: 'Gelişmiş Ayarlar Paneli',
    title_en: 'Settings Panel',
    desc: 'Port ayarları, altyazı renkleri, SponsorBlock ve Discord RPC kontrolü.',
    desc_en: 'Port, subtitle styles, SponsorBlock categories, and Discord RPC.',
    src: 'assets/screenshots/tr-ayarlar.png'
  },
  // EN Versiyonları
  {
    id: 'en-libry',
    category: 'en',
    title: 'Library (Home)',
    title_en: 'Library (Home)',
    desc: 'Offline library with thumbnail cards and quick action badges.',
    desc_en: 'Offline library with thumbnail cards and quick action badges.',
    src: 'assets/screenshots/en-libry.png'
  },
  {
    id: 'en-downlist',
    category: 'en',
    title: 'Split Playlist Viewer',
    title_en: 'Split Playlist Viewer',
    desc: 'Dual-column YouTube-like layout with auto-play sequentially.',
    desc_en: 'Dual-column YouTube-like layout with auto-play sequentially.',
    src: 'assets/screenshots/en-downlist.png'
  },
  {
    id: 'en-channels',
    category: 'en',
    title: 'Channel Rules',
    title_en: 'Channel Rules',
    desc: 'Individual auto-download preferences and filter settings.',
    desc_en: 'Individual auto-download preferences and filter settings.',
    src: 'assets/screenshots/en-channels.png'
  },
  {
    id: 'en-settings',
    category: 'en',
    title: 'Preferences Panel',
    title_en: 'Preferences Panel',
    desc: 'Theme, Discord presence, download speed caps, and backup controls.',
    desc_en: 'Theme, Discord presence, download speed caps, and backup controls.',
    src: 'assets/screenshots/en-setting.png'
  }
];

// Sayfa Yüklendiğinde
document.addEventListener('DOMContentLoaded', () => {
  renderGallery('all');
  setupTabs();
  setupLightbox();
  setupLangSwitcher();
  setupMascotInteractions();
});

// Galeri Render Fonksiyonu
function renderGallery(filter) {
  const container = document.getElementById('gallery-container');
  if (!container) return;

  const items = galleryItems.filter(item => {
    if (filter === 'all') return true;
    return item.category === filter;
  });

  container.innerHTML = items.map(item => `
    <div class="screenshot-card" data-src="${item.src}">
      <div class="screenshot-img-wrap">
        <img src="${item.src}" alt="${currentLang === 'tr' ? item.title : item.title_en}" loading="lazy" />
        <div class="screenshot-overlay">
          <button class="zoom-btn">
            🔍 <span>${currentLang === 'tr' ? 'Büyüt' : 'Zoom'}</span>
          </button>
        </div>
      </div>
      <div class="screenshot-info">
        <h4>${currentLang === 'tr' ? item.title : item.title_en}</h4>
        <p>${currentLang === 'tr' ? item.desc : item.desc_en}</p>
      </div>
    </div>
  `).join('');

  // Tıklama olaylarını kartlara bağla
  container.querySelectorAll('.screenshot-card').forEach(card => {
    card.addEventListener('click', () => {
      openLightbox(card.dataset.src);
    });
  });
}

// Sekme Değiştirici
function setupTabs() {
  const tabBtns = document.querySelectorAll('.tab-btn');
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      tabBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const filter = btn.dataset.tab;
      renderGallery(filter);
    });
  });
}

// Lightbox Yönetimi
function setupLightbox() {
  const lightbox = document.getElementById('lightbox');
  const closeBtn = document.getElementById('lightbox-close');
  if (!lightbox) return;

  closeBtn?.addEventListener('click', closeLightbox);
  lightbox.addEventListener('click', (e) => {
    if (e.target === lightbox) closeLightbox();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeLightbox();
  });
}

function openLightbox(src) {
  const lightbox = document.getElementById('lightbox');
  const img = document.getElementById('lightbox-img');
  if (lightbox && img) {
    img.src = src;
    lightbox.classList.add('active');
  }
}

function closeLightbox() {
  const lightbox = document.getElementById('lightbox');
  if (lightbox) {
    lightbox.classList.remove('active');
  }
}

// Dil Değiştirici
function setupLangSwitcher() {
  const switchBtn = document.getElementById('lang-switch-btn');
  if (!switchBtn) return;

  switchBtn.addEventListener('click', () => {
    currentLang = currentLang === 'tr' ? 'en' : 'tr';
    switchBtn.innerHTML = currentLang === 'tr' ? '🌐 English' : '🌐 Türkçe';
    updateTexts();
    // Aktif tab'a göre galeriyi tekrar render et
    const activeTab = document.querySelector('.tab-btn.active')?.dataset.tab || 'all';
    renderGallery(activeTab);
  });
}

function updateTexts() {
  const dict = i18n[currentLang];
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (dict[key]) {
      el.textContent = dict[key];
    }
  });

  document.querySelectorAll('[data-i18n-title]').forEach(el => {
    const key = el.getAttribute('data-i18n-title');
    if (dict[key]) {
      el.title = dict[key];
    }
  });

  const mascot = document.querySelector('.mascot-container');
  if (mascot && dict.mascot_tooltip) {
    mascot.title = dict.mascot_tooltip;
  }

  // Kedi konuşma baloncuğunu da anında yeni seçilen dile senkronize et
  const bubble = document.querySelector('.cat-bubble');
  if (bubble) {
    const prevLang = currentLang === 'tr' ? 'en' : 'tr';
    const prevMeows = catMeowDict[prevLang] || [];
    const currentMeows = catMeowDict[currentLang] || [];
    const currentText = bubble.textContent.trim();
    const idx = prevMeows.indexOf(currentText);
    if (idx !== -1 && currentMeows[idx]) {
      bubble.textContent = currentMeows[idx];
    } else {
      bubble.textContent = dict.cat_quote || currentMeows[0];
    }
  }
}

// Kedi Maskotu Tıklama & Pati Etkileşimi
function setupMascotInteractions() {
  const mascot = document.querySelector('.mascot-container');
  const bubble = document.querySelector('.cat-bubble');

  if (mascot && bubble) {
    mascot.addEventListener('click', () => {
      // O anki aktif dile göre dinamik havuzdan seçim yap
      const meows = catMeowDict[currentLang] || catMeowDict.tr;
      const currentText = bubble.textContent.trim();
      let availableMeows = meows.filter(m => m !== currentText);
      if (availableMeows.length === 0) availableMeows = meows;

      const randomMeow = availableMeows[Math.floor(Math.random() * availableMeows.length)];
      bubble.textContent = randomMeow;
      bubble.style.transform = 'scale(1.2) rotate(4deg)';
      setTimeout(() => {
        bubble.style.transform = 'scale(1) rotate(0deg)';
      }, 300);
    });
  }
}
