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
    features_tag: "🐾 Neden Multimedia HaYTooL?",
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
    cli_title: "Gelişmiş CLI, Konsol & Görev Çubuğu (Jump List) Desteği",
    cli_desc: "HaYTooL'u arayüz açmadan terminalden (haytool, .\\haytool veya \"Multimedia HaYTooL.exe\"), Windows Görev Çubuğu sağ tık menüsünden (Jump List) veya Sistem Tepsisi konsolundan yönetin:",
    cli_gt_desc: "Oyun Modu + Kaplumbağa hız limitini tek komutla aynı anda açar veya kapatır.",
    cli_pause_desc: "Aktif indirmeleri güvenle beklemeye alarak kuyruğu duraklatır veya devam ettirir.",
    cli_game_desc: "Oyun Modunu açar (%0 FFmpeg yüküyle tam hızda indirir) veya kapattığınızda sırayla birleştirir.",
    cli_pd_desc: "Panodaki veya verilen video/çalma listesi bağlantısını doğrudan indirme kuyruğuna ekler.",
    cli_status_desc: "Aktif kuyruğu, bekleyen birleştirmeleri ve Oyun Modu durumunu gösterir veya servisi yönetir.",
    cli_turtle_desc: "Kaplumbağa modunu (alternatif düşük hız profilini) tek komutla açar, kapatır veya değiştirir.",
    cli_speed_desc: "Normal veya kaplumbağa (altspeed) hız sınırını KB/s olarak ayarlar, kapatır veya geri açar.",
    cli_check_desc: "Takip edilen kanalları anında RSS ile tarar veya sistem veritabanı yedeğini alır.",
    cli_copy_btn: "Kopyala",
    cli_copied_btn: "Kopyalandı ✓",
    cli_example_label: "Terminalden doğrudan indirme başlatma örneği (tıklayıp kopyalayın):",
    feat_iptv_title: "IPTV Çoklu Canlı TV",
    feat_iptv_desc: "4 ekrana kadar eşzamanlı canlı yayın izleme, otomatik m3u8 oynatıcı ve özel kategori filtreleme ile televizyon deneyimi.",
    feat_ryd_title: "Return YouTube Dislike",
    feat_ryd_desc: "YouTube'un gizlediği dislike istatistiklerini RYD API ile anında görün, topluluk beğeni oranlarını doğrudan takip edin.",
    feat_themes_title: "5 Farklı Dinamik Tema",
    feat_themes_desc: "Matrix, Discord, YouTube Koyu, Aydınlık ve Koyu temalar arasında tek tıkla geçiş yapın, tam kontrast konforunu yaşayın.",
    feat_webstream_title: "Web Video & Dizi Çözücü",
    feat_webstream_desc: "Dizipal ve popüler dizi/film sitelerindeki şifreli video akışlarını otomatik tespit edin; reklamsız doğrudan yerleşik oynatıcıda izleyin.",
    feat_ext_title: "Akıllı Tarayıcı Eklentisi (MV3)",
    feat_ext_desc: "YouTube videosu izlerken doğrudan kanalı takibe alın, tek tıkla video indirin veya Kaplumbağa hız sınırını değiştirin.",
    nav_toolkit: "Araçlar & Ayarlar",
    mockup_live_badge: "Canlı Oynatıcı · Uzak Durum Koruması · Oyun Modu",
    telemetry_merge_label: "FFmpeg Birleştiriliyor: %84",
    telemetry_shield_label: "🛡️ Oto-Silmeden Muaf",
    feat_1_title: "Arka Planda Otomasyon",
    feat_1_desc: "Takip ettiğiniz kanalların RSS akışlarını periyodik kontrol eder. Yeni bir video yüklendiğinde anında yerel diskinize indirir.",
    feat_2_title: "100% Reklamsız & SponsorBlock",
    feat_2_desc: "Sponsorlu bölümleri, introları ve abonelik hatırlatmalarını zaman tünelinde otomatik atlar. Sıfır reklam, sıfır dikkat dağınıklığı.",
    feat_3_title: "Taşınabilir & Sıfır Bağımlılık",
    feat_3_desc: "Node.js, yt-dlp ve FFmpeg arşivin içinde hazır gelir. Harici hiçbir kurulum veya paket yöneticisi gerekmez.",
    feat_4_title: "Çift Oynatıcı & C# Desktop Player",
    feat_4_desc: "İster tarayıcıda Plyr ile izleyin, ister yerleşik C# WebView2 masaüstü oynatıcıyla diskten sıfır gecikmeyle yürütün.",
    feat_5_title: "Çok Dilli Altyazı & Çeviri",
    feat_5_desc: "Türkçe/İngilizce altyazıları otomatik çeker. 11 hedef dilde anlık çeviri ve 12 farklı altyazı renk/boyut özelleştirmesi sunar.",
    feat_6_title: "APE & Gerçek Geçmiş Senkronu",
    feat_6_desc: "İzleme konumunuzu otomatik gerçek YouTube izleme geçmişinize senkronize eder. Toplu video işaretleme (1-200) desteği sağlar.",
    feat_7_title: "Discord Rich Presence (RPC)",
    feat_7_desc: "İzlediğiniz videoyu, kanal adını ve süresini Discord durumunuzda şık bir şekilde otomatik gösterir.",
    feat_8_title: "Kanal Bazlı Kurallar & Kota",
    feat_8_desc: "Her kanala özel otomatik indirme, Shorts engelleme, saklama günü ve kanal başına maksimum video sınırı belirleyin.",
    feat_12_title: "Windows Sistem Tepsisi & Konsol",
    feat_12_desc: "Sistem tepsisinde sessiz çalışır, gizlendiğinde RAM/GPU belleğini uyutur. Canlı konsol ve CLI komutları ile yönetilir.",
    feat_remote_title: "Uzak Durum Tarayıcısı & 🛡️ Muafiyet",
    feat_remote_desc: "Açılışta indirilen YouTube videolarının silinme, gizlenme ve liste dışı durumunu tarar; uyarı penceresiyle bildirir ve otomatik silmeden muaf tutar.",
    feat_gamemode_title: "Oyun Modu & Canlı Merge (%0–%100)",
    feat_gamemode_desc: "Oyun oynarken %0 FFmpeg yüküyle tam hızda indirin. Kuyrukta canlı FFmpeg birleştirme yüzdesini görün ve hız değişiminde %0'a düşmeden devam edin.",
    feat_ai_title: "Yapay Zekâ (AI) Video Özeti & TTS",
    feat_ai_desc: "LM Studio, Ollama/GGUF, Groq, Gemini Flash veya Apisiz NLP motoruyla altyazılardan konu özeti çıkarın ve sesli dinleyin.",
    feat_sqlite_title: "SQLite Motoru, Fakap & Gist Bulut",
    feat_sqlite_desc: "AES-256 şifreli yerel SQLite (WAL) veritabanı, Fakap düşük çözünürlüklü otomatik yedek arşivi, 17 slotlu günlük ZIP yedeği ve GitHub Gist senkronu.",
    toolkit_tag: "🧰 Komuta Merkezi",
    toolkit_title: "12 Entegre Araç & 10 Kategorili Ayar Mimarisi",
    toolkit_desc: "Üst bardaki Hızlı Araçlar açılır menüsü ve anlık arama destekli modern ayarlar paneliyle her detay elinizin altında.",
    toolkit_tab_tools: "12 Hızlı Araç Menüsü",
    toolkit_tab_settings: "10 Kategorili Ayarlar Paneli",
    tool_1_t: "PD (Yapıştır & İndir)",
    tool_1_d: "Panodaki bağlantıyı tek tıkla okuyup doğrudan kuyruğa ekler.",
    tool_2_t: "Çoklu Platform Downloader",
    tool_2_d: "YouTube, TikTok, X, Instagram, Kick, Twitch, Reddit özel format & MP3 indirici.",
    tool_3_t: "Web Video & Dizi Çözücü",
    tool_3_d: "Akıllı Sandbox (CloseLoad/JWPlayer), film/dizi arama ve dublaj/orijinal ses seçimi.",
    tool_4_t: "Dosya Karşılaştırma & Senkron",
    tool_4_d: "Disk ile SQLite veritabanını karşılaştırır; yetim dosyaları tek tıkla içeri aktarır.",
    tool_5_t: "Uzak Durum Kontrolü (YT)",
    tool_5_d: "Silinen, gizlenen ve liste dışı kalan videoları tespit eder; 🛡️ oto-silmeden muaf tutar.",
    tool_6_t: "Kanal Kategorileri",
    tool_6_d: "Kanalları özel kategorilere ayırarak Kütüphane ve İndirilenler'de filtreler.",
    tool_7_t: "APE — İzlendi İşaretleme",
    tool_7_d: "Tekil videoları veya kanalın son 1–200 videosunu gerçek YouTube geçmişinde izlendi işaretler.",
    tool_8_t: "Tarayıcı Eklentisi (MV3)",
    tool_8_d: "Video sayfasından doğrudan kanal takibi, tek tıkla indirme ve hız profili kontrolü.",
    tool_9_t: "YouTube Abonelikleri",
    tool_9_d: "YouTube hesabınızdaki abonelikleri çekerek tek tıkla takibe almanızı sağlar.",
    tool_10_t: "Silinen Videolar Geçmişi",
    tool_10_d: "Son 100 silinen videoyu listeler ve tek tıkla yeniden kuyruğa ekler.",
    tool_11_t: "Fakap (Otomatik Yedekler)",
    tool_11_d: "144p/240p/360p düşük çözünürlüklü otomatik yedek arşivini yönetir ve oynatır.",
    tool_12_t: "Canlı Konsol & Aktif DNS",
    tool_12_d: "Canlı SSE log terminali, CLI komut satırı ve aktif ağ/DNS gecikme analizi.",
    set_1_t: "1. Genel & Görünüm",
    set_1_d: "7 dil, 5 tema, çerçevesiz pencere, Tepside RAM/GPU Uyutma ve Üst Bar Canlı Hava Durumu.",
    set_2_t: "2. İndirme & GPU Hızlandırma",
    set_2_d: "SSD Tamponlama (HDD Koruma), NVENC/QSV/AMF GPU birleştirme, Oyun Modu ve kayıpsız hız sınırı.",
    set_3_t: "3. Kütüphane & Depolama",
    set_3_d: "Gün ve Maksimum Video Sınırı ile oto-silme, erteleme penceresi ve 3 kademeli FFprobe disk senkronu.",
    set_4_t: "4. Otomasyon & Kanallar",
    set_4_d: "RSS sıklığı, Canlı Yayın/Prömiyer VOD yönetimi, Açılış Uzak Durum Taraması ve Fakap anahtarı.",
    set_5_t: "5. Oynatıcı & Altyazı",
    set_5_d: "Sıfır gecikmeli C# WebView2 disk oynatımı, SponsorBlock, RYD dislike ve 11 dil çeviri.",
    set_6_t: "6. YouTube Hesabı & Çerez",
    set_6_d: "Yerleşik WebView2 oturum açma, periyodik çerez sağlık denetimi ve izleme geçmişi senkronu.",
    set_7_t: "7. Bildirim & Entegrasyon",
    set_7_d: "Kapak görselli bildirimler, haytool://play protokolü, 7 ses profili, Windows PATH ve Discord RPC.",
    set_8_t: "8. Sistem & Motor",
    set_8_d: "SSD dostu Proxy Waterfall süre sorgulama, yt-dlp Nightly/Stable kanal seçici ve otomatik güncelleme.",
    set_9_t: "9. Yedekleme & Gist Bulut",
    set_9_d: "Günlük otomatik ZIP yedeği (Maks 17 rotasyon) ve GitHub Gist çevrimiçi bulut senkronizasyonu.",
    set_10_t: "10. Yapay Zekâ & Ses (TTS)",
    set_10_d: "LM Studio, Ollama, Groq, Gemini Flash veya Apisiz NLP ile altyazı özeti ve sesli okuma.",
    gallery_tab_all: "Tümü / All",
    gallery_tab_tr: "Türkçe Arayüz",
    gallery_tab_en: "English Interface"
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
    features_tag: "🐾 Why Multimedia HaYTooL?",
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
    cli_title: "Advanced CLI, Console & Taskbar Jump List Support",
    cli_desc: "Control HaYTooL headless from your terminal (haytool, .\\haytool or \"Multimedia HaYTooL.exe\"), via the Windows Taskbar Jump List, or via the System Tray Console:",
    cli_gt_desc: "Enables or disables both Game Mode and Turtle speed limit together in a single command.",
    cli_pause_desc: "Safely pauses active downloads and holds the queue, or resumes downloads.",
    cli_game_desc: "Enables Game Mode (full-speed download with 0% FFmpeg load) or auto-merges sequentially when turned off.",
    cli_pd_desc: "Enqueues clipboard URL or any given video/playlist URL directly for download.",
    cli_status_desc: "Displays active queue, pending FFmpeg merges, and Game Mode state, or manages the service.",
    cli_turtle_desc: "Turns on, turns off, or toggles Turtle Mode (alternative low-speed profile) instantly.",
    cli_speed_desc: "Sets standard or Turtle (altspeed) download speed limit in KB/s, disables, or restores it.",
    cli_check_desc: "Scans followed channels via RSS immediately or triggers an instant DB backup.",
    cli_copy_btn: "Copy",
    cli_copied_btn: "Copied ✓",
    cli_example_label: "Direct CLI download example from terminal (click to copy):",
    feat_iptv_title: "IPTV Multi-Screen Live TV",
    feat_iptv_desc: "Watch up to 4 concurrent live streams, automatic m3u8 player, and custom category filtering for a true TV experience.",
    feat_ryd_title: "Return YouTube Dislike",
    feat_ryd_desc: "Reveal hidden YouTube dislike metrics via RYD API integration and monitor community sentiment directly.",
    feat_themes_title: "5 Dynamic Interface Themes",
    feat_themes_desc: "Seamlessly switch between Matrix, Discord, YouTube Dark, Light, and Dark themes with full high-contrast readability.",
    feat_webstream_title: "Web Video & Series Streamer",
    feat_webstream_desc: "Extract encrypted video streams from Dizipal and external movie sites; watch ad-free right inside the embedded player.",
    feat_ext_title: "Smart Browser Extension (MV3)",
    feat_ext_desc: "Follow channels directly from any YouTube video page, download with 1 click, or toggle Turtle speed limit.",
    nav_toolkit: "Tools & Settings",
    mockup_live_badge: "Live Player · Remote Status Guard · Game Mode",
    telemetry_merge_label: "FFmpeg Merging: 84%",
    telemetry_shield_label: "🛡️ Exempt from Auto-Delete",
    feat_1_title: "Background Automation",
    feat_1_desc: "Periodically monitors RSS feeds of your followed channels and downloads newly uploaded videos directly to disk.",
    feat_2_title: "100% Ad-Free & SponsorBlock",
    feat_2_desc: "Automatically skips sponsor segments, intros, outros, and reminders on the timeline. Zero ads, zero distractions.",
    feat_3_title: "Portable & Zero Dependencies",
    feat_3_desc: "Node.js, yt-dlp, and FFmpeg come pre-bundled inside the archive. No external setup or package manager required.",
    feat_4_title: "Dual Player & C# Desktop App",
    feat_4_desc: "Watch in your browser with Plyr or inside the native C# WebView2 desktop player with zero-lag disk streaming.",
    feat_5_title: "Multi-Language Subtitles",
    feat_5_desc: "Automatically grabs TR/EN subtitles. Instant translation across 11 languages plus 12 color/size styling options.",
    feat_6_title: "APE & Real Watch History Sync",
    feat_6_desc: "Syncs playback position to your real YouTube watch history and supports bulk marking (last 1–200 channel videos).",
    feat_7_title: "Discord Rich Presence (RPC)",
    feat_7_desc: "Displays the currently watched video title and creator channel name cleanly on your Discord profile.",
    feat_8_title: "Per-Channel Rules & Quotas",
    feat_8_desc: "Configure per-channel auto-download, Shorts filtering, retention days, and maximum video count limits.",
    feat_12_title: "Windows System Tray & Console",
    feat_12_desc: "Runs quietly in the system tray, sleeps WebView2 RAM/GPU when hidden, and offers an interactive live CLI console.",
    feat_remote_title: "Remote Status Scanner & 🛡️ Exempt",
    feat_remote_desc: "Scans downloaded YouTube videos on startup for Deleted, Unlisted, or Private changes; alerts you and exempts them from Auto-Delete.",
    feat_gamemode_title: "Game Mode & Live Merge (0%–100%)",
    feat_gamemode_desc: "Download at full speed with 0% FFmpeg load while gaming. View live FFmpeg merge % in the Queue and change speed limits without resetting.",
    feat_ai_title: "AI Video Summary & Voice TTS",
    feat_ai_desc: "Generate clean narrative summaries from subtitles via LM Studio, Ollama/GGUF, Groq, Gemini Flash, or API-free NLP + TTS.",
    feat_sqlite_title: "SQLite Engine, Fakap & Gist Cloud",
    feat_sqlite_desc: "AES-256 encrypted local SQLite (WAL) database, Fakap low-res auto-backup archive, 17-slot daily ZIP backups, and GitHub Gist sync.",
    toolkit_tag: "🧰 Command Deck",
    toolkit_title: "12 Built-in Tools & 10-Category Settings Architecture",
    toolkit_desc: "Every power tool and granular engine preference organized cleanly with instant search.",
    toolkit_tab_tools: "12 Quick Tools Menu",
    toolkit_tab_settings: "10-Category Settings Panel",
    tool_1_t: "PD (Paste & Download)",
    tool_1_d: "Reads clipboard URL with one click and enqueues it immediately.",
    tool_2_t: "Multi-Platform Downloader",
    tool_2_d: "YouTube, TikTok, X, Instagram, Kick, Twitch & Reddit custom quality & MP3 downloader.",
    tool_3_t: "Web Video & Series Streamer",
    tool_3_d: "Smart Sandbox (CloseLoad/JWPlayer), cross-site search, and dubbed/original audio selector.",
    tool_4_t: "Folder Comparison & Sync",
    tool_4_d: "Compares physical disk files against SQLite records; imports orphaned files in one click.",
    tool_5_t: "Remote Status Check (YT)",
    tool_5_d: "Detects deleted, private, and unlisted videos; protects them with 🛡️ Auto-Delete Exemption.",
    tool_6_t: "Channel Categories",
    tool_6_d: "Organize followed channels into custom categories for multi-tag filtering.",
    tool_7_t: "APE — Mark as Watched",
    tool_7_d: "Marks single videos or a channel's last 1–200 videos as watched on YouTube.",
    tool_8_t: "Browser Extension (MV3)",
    tool_8_d: "Follow channels directly from video pages, 1-click download, and Turtle speed toggle.",
    tool_9_t: "YouTube Subscriptions",
    tool_9_d: "Fetches your real YouTube subscriptions list for one-click following.",
    tool_10_t: "Deleted Videos History",
    tool_10_d: "Lists the last 100 deleted videos with one-click re-download support.",
    tool_11_t: "Fakap (Auto-Backups)",
    tool_11_d: "Manages and plays 144p/240p/360p low-resolution automatic backup copies.",
    tool_12_t: "Live Console & Active DNS",
    tool_12_d: "Real-time SSE log terminal, interactive CLI runner, and DNS latency inspector.",
    set_1_t: "1. General & Appearance",
    set_1_d: "7 languages, 5 themes, frameless window, Tray RAM/GPU Sleep Mode, and Live Weather popover.",
    set_2_t: "2. Download & GPU Accel",
    set_2_d: "SSD Temp Staging (HDD guard), NVENC/QSV/AMF GPU muxing, Game Mode, and lossless speed limits.",
    set_3_t: "3. Library & Storage",
    set_3_d: "Auto-delete by days & Max Video Count, postpone modal, and 3-tier FFprobe disk sync.",
    set_4_t: "4. Automation & Channels",
    set_4_d: "RSS interval, Live/Premiere VOD handling, Startup Remote Status Scan, and Fakap master switch.",
    set_5_t: "5. Player & Subtitles",
    set_5_d: "Zero-lag C# WebView2 disk playback, SponsorBlock, RYD dislikes, and 11-language translation.",
    set_6_t: "6. YouTube Account & Cookies",
    set_6_d: "Built-in WebView2 sign-in, periodic cookie health check, and bidirectional watchtime sync.",
    set_7_t: "7. Notifications & Integration",
    set_7_d: "Hero-image toasts, haytool://play protocol, 7 sound profiles, Windows PATH, and Discord RPC.",
    set_8_t: "8. System & Engine",
    set_8_d: "SSD-friendly Proxy Waterfall duration lookup, yt-dlp Nightly/Stable switcher, and auto-update.",
    set_9_t: "9. Backup & Gist Cloud",
    set_9_d: "Automatic daily ZIP backup rotation (Max 17) and GitHub Gist online cloud sync.",
    set_10_t: "10. AI Summary & Voice (TTS)",
    set_10_d: "Subtitle narrative summaries via LM Studio, Ollama, Groq, Gemini Flash, or API-free NLP + TTS.",
    gallery_tab_all: "All / Tümü",
    gallery_tab_tr: "Turkish UI",
    gallery_tab_en: "English UI"
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
    switchBtn.innerHTML = currentLang === 'tr'
      ? '<img src="https://flagcdn.com/w20/gb.png" width="18" height="12" alt="EN" style="border-radius: 2px;" /> <span>English</span>'
      : '<img src="https://flagcdn.com/w20/tr.png" width="18" height="12" alt="TR" style="border-radius: 2px;" /> <span>Türkçe</span>';
    updateTexts();
    // Aktif tab'a göre galeriyi tekrar render et
    const activeTab = document.querySelector('.tab-btn.active')?.dataset.tab || 'all';
    renderGallery(activeTab);
  });
}

window.switchToolkitTab = function(tabName) {
  document.querySelectorAll('.toolkit-tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-toolkit-tab') === tabName);
  });
  const toolsPanel = document.getElementById('toolkit-panel-tools');
  const settingsPanel = document.getElementById('toolkit-panel-settings');
  if (toolsPanel && settingsPanel) {
    toolsPanel.classList.toggle('active', tabName === 'tools');
    settingsPanel.classList.toggle('active', tabName === 'settings');
  }
};

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

window.copyWebCli = function(cmd, el) {
  if (!cmd) return;
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(cmd).catch(() => {});
  }
  if (el) {
    el.classList.add('copied');
    const badge = el.querySelector('.web-cli-copy-badge');
    const dict = i18n[currentLang] || i18n.tr;
    if (badge) badge.textContent = dict.cli_copied_btn || 'Copied ✓';
    setTimeout(() => {
      el.classList.remove('copied');
      if (badge) badge.textContent = dict.cli_copy_btn || 'Copy';
    }, 1400);
  }
};
