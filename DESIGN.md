# HaYTooL YT-Downloader - Web Design Specification (DESIGN.md)
*Standardized via xiaopu-ai/web-design spec-first methodology*
*Architect: HaYTo*

---

## 1. Executive Summary & Brand Identity
- **Product**: HaYTooL YT-Downloader Official Landing & Showcase Page
- **Tagline**: Modern, ultra-hızlı, çok işlevli masaüstü medya yönetim merkezi.
- **Atmosphere**: Cyber-sleek, premium obsidian, neon akışları ve kristal cam moru dokusu. Güçlü, güvenli ve profesyonel mühendislik hissi.

---

## 2. Color System & Tokens
- **Surface & Backgrounds**:
  - `--bg-canvas`: `#0a0b10` (Derin uzay siyahı)
  - `--bg-surface`: `rgba(18, 20, 29, 0.72)` (Kristal cam yüzey)
  - `--bg-surface-elevated`: `rgba(28, 31, 46, 0.85)` (Yükseltilmiş kart yüzeyi)
  - `--border-subtle`: `rgba(255, 255, 255, 0.08)`
  - `--border-glow`: `rgba(255, 0, 51, 0.35)`
- **Brand Accents**:
  - `--accent-primary`: `#ff0033` (Neon YouTube Kırmızısı)
  - `--accent-gradient`: `linear-gradient(135deg, #ff0033 0%, #ff5252 50%, #7b2cbf 100%)`
  - `--accent-secondary`: `#9d4edd` (Lüks Ametist Moru)
  - `--accent-matrix`: `#00ff88` (Matrix Yeşil Vurgusu)
  - `--accent-catgold`: `#ffb703` (Sıcak Amber/Gold)
- **Text & Foreground**:
  - `--text-main`: `#f8f9fa` (Kristal beyaz)
  - `--text-muted`: `#94a3b8` (Dengeli arduvaz grisi)
  - `--text-accent`: `#ff3366`

---

## 3. Typography
- **Primary Font**: `'Outfit', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`
- **Monospace Font**: `'JetBrains Mono', 'Fira Code', monospace` (Sürüm etiketleri ve kod blokları için)
- **Scale**:
  - Hero Display: `clamp(2.5rem, 6vw, 4.25rem)` (Ağırlık: 800)
  - Section Headings: `clamp(1.75rem, 3.5vw, 2.5rem)` (Ağırlık: 700)
  - Feature Titles: `1.25rem` (Ağırlık: 600)
  - Body: `1rem` (Ağırlık: 400, Satır yüksekliği: 1.6)

---

## 4. Layout Architecture & Hierarchy
1. **Glassmorphic Navigation Bar**: Sabit, logo rozeti, çoklu dil seçici (TR/EN), doğrudan GitHub & İndir butonları.
2. **Hero Presentation**:
   - Etkileyici tipografi + hareketli ışık lekesi (radial glow).
   - "v9.8.100 - Tam Bağımsız Medya Gücü" canlı rozeti.
   - Doğrudan İndirme CTA + Ekran Görüntüleri Keşif butonu.
   - Canlı İstatistik Şeridi: Süper hızlı indirme, 1080p/4K/8K, IPTV Entegre, 5 Özel Tema.
3. **Yeni Nesil Yetenekler (Featured Innovations - Grid)**:
   - **IPTV Çoklu Ekran Oynatıcı**: 4 ekrana kadar eşzamanlı canlı TV, özel kategoriler ve akıcı M3U8 motoru.
   - **Return YouTube Dislike (RYD)**: Gizlenen YouTube beğenmeme istatistiklerini doğrudan yakalayan oylama motoru.
   - **Dinamik 5 Tema Motoru**: Matrix, Discord, YouTube Koyu, Aydınlık ve Koyu temalarla tam renk uyumu.
   - **Gelişmiş Kanal Otomasyonu**: Otomatik video indirme, periyodik silme ve kütüphane senkronizasyonu.
   - **Zengin Masaüstü Entegrasyonu**: Discord Rich Presence, Sistem Tepsisi ve Canlı Hava Durumu rozeti.
   - **Dahili Medya Dönüştürücü & Kırpıcı**: FFmpeg destekli kayıpsız ses/video dönüştürme ve kesme.
4. **Etkileşimli Ekran Görüntüleri Galerisi**: Kart geçişleri ve tam ekran görüntüleyici.
5. **Kurulum & Hızlı Başlangıç**: Tek tıkla installer veya portable seçenekleri.
6. **Footer**: Geliştirici imzası ("Made with ❤️ by HaYTo"), telif ve bağlantılar.

---

## 5. Micro-Interactions & Animation
- **Cam Derinliği (Glassmorphism)**: `backdrop-filter: blur(16px)` + hafif 1px parlak sınır çizgisi.
- **Hover Efektleri**: Kart üzerine gelindiğinde `transform: translateY(-6px)` ve dinamik renk yansıması (`box-shadow: 0 12px 30px rgba(...)`).
- **Glow Pulse**: Hero CTA butonunda nabız gibi atan yumuşak kırmızı neon ışıma efekti.

---

## 6. Accessibility & Performance
- Kontrast standartları: AAA uyumlu metin/arka plan dengesi.
- Semantik HTML5 (`<header>`, `<main>`, `<section>`, `<article>`, `<footer>`).
- CSS Değişkenleri üzerinden tam kontrol ve sıfır harici ağır kütüphane bağımlılığı (Vanilla CSS & JS).
