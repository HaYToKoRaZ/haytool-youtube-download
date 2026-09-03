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
    hero_badge: "🐱 HaYTooL Meow Edition • Algoritmalara Meydan Okuyun!",
    hero_title_1: "Algoritma Pençesinden Kurtulun,",
    hero_title_2: "Kendi Özel Kütüphanenizi Kurun.",
    hero_sub: "İstenmeyen öneriler ve sonsuz video tuzakları yok! Sadece takip ettiğiniz kanalları arka planda otomatik indirin, %100 reklamsız ve çevrimdışı izleyin.",
    btn_download: "Hemen İndir (v9.8.18)",
    btn_github: "GitHub'da İncele",
    stat_adfree: "%100 Reklamsız",
    stat_adfree_sub: "SponsorBlock Entegre",
    stat_portable: "Sıfır Bağımlılık",
    stat_portable_sub: "Node + yt-dlp + FFmpeg Dahil",
    stat_languages: "7 Dil Desteği",
    stat_languages_sub: "Otomatik Altyazı Çevirisi",
    cat_quote: "Miyav! Reklamsız izlemek harika!",
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
    install_desc: "Tüm bağımlılıklar paket içinde hazır gelir; ek kurulumla uğraşmayın."
  },
  en: {
    nav_features: "Features",
    nav_screenshots: "Screenshots",
    nav_shortcuts: "Shortcuts",
    nav_install: "Installation",
    nav_portal: "🌟 All Apps",
    footer_portal: "🌐 Main Hub (All Apps)",
    hero_badge: "🐱 HaYTooL Meow Edition • Reclaim Your Feed!",
    hero_title_1: "Break Free from the Algorithm,",
    hero_title_2: "Build Your Private Library.",
    hero_sub: "No distractions, no addictive traps! Monitor followed channels via RSS, auto-download newly released videos, and enjoy 100% ad-free offline playback.",
    btn_download: "Download Now (v9.8.18)",
    btn_github: "View on GitHub",
    stat_adfree: "100% Ad-Free",
    stat_adfree_sub: "SponsorBlock Integrated",
    stat_portable: "Zero Dependencies",
    stat_portable_sub: "Node + yt-dlp + FFmpeg Bundled",
    stat_languages: "7 Languages",
    stat_languages_sub: "Auto Subtitle Translation",
    cat_quote: "Meow! Watching ad-free is purrfect!",
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
    install_desc: "All dependencies are pre-packaged in the repository. It works out of the box."
  }
};

let currentLang = 'tr';

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
}

// Kedi Maskotu Tıklama & Pati Etkileşimi
function setupMascotInteractions() {
  const mascot = document.querySelector('.mascot-container');
  const bubble = document.querySelector('.cat-bubble');
  const meows = currentLang === 'tr' 
    ? ['Miyav! 🐾', 'Pati gücü! 🐱', 'Reklamlar engellendi! 🛡️', 'Sıradaki video iniyor! 🚀', 'Patili günler! 🐾'] 
    : ['Meow! 🐾', 'Paw power! 🐱', 'Ads blocked! 🛡️', 'Downloading next! 🚀', 'Purrfect day! 🐾'];

  if (mascot && bubble) {
    mascot.addEventListener('click', () => {
      const randomMeow = meows[Math.floor(Math.random() * meows.length)];
      bubble.textContent = randomMeow;
      bubble.style.transform = 'scale(1.2) rotate(4deg)';
      setTimeout(() => {
        bubble.style.transform = 'scale(1) rotate(0deg)';
      }, 300);
    });
  }
}
