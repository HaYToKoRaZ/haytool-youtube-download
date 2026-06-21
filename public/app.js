/**
 * HaYTooL YouTube Downloader - İstemci Mantığı (Frontend)
 * 
 * Yapımcı: HaYTo
 * İletişim: korazhayto@gmail.com
 */

let localDb = { channels: [], history: [], settings: {} };
let eventSource = null;
let currentLang = 'tr';

// IPTV Global Variables (Initialized early to avoid temporal dead zone issues)
let iptvPlayers = [null, null, null, null];
let activeIptvSlot = 0;
let iptvIsLoading = false;
let iptvSearchQuery = '';
let iptvSelectedCountry = '';
let iptvSelectedCategory = '';
let iptvStatusInterval = null;
let isRestoringIptv = false;

// YouTube SVG İkon Şablonu (Lucide bağımlılığı olmadan her ortamda çalışması için yerel SVG kullanıyoruz)
const youtubeSvgIcon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" style="display:inline-block !important;vertical-align:middle !important;fill:#ff0000 !important;stroke:none !important;width:16px !important;height:16px !important;"><path d="M23.498 6.163a3.003 3.003 0 0 0-2.11-2.11C19.517 3.545 12 3.545 12 3.545s-7.516 0-9.388.508a3.003 3.003 0 0 0-2.11 2.11C0 8.033 0 12 0 12s0 3.967.502 5.837a3.003 3.003 0 0 0 2.11 2.11c1.872.508 9.388.508 9.388.508s7.517 0 9.388-.508a3.003 3.003 0 0 0 2.11-2.11C24 15.967 24 12 24 12s0-3.967-.502-5.837zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" style="fill:#ff0000 !important;stroke:none !important;"/></svg>`;

const translations = {
  tr: {
    status_merging: 'Birleştiriliyor (FFmpeg)...',
    tab_iptv: 'IPTV',
    inline_btn_description: 'Açıklamayı Göster',
    inline_description_title: 'Video Açıklaması',
    premium_automation: 'Premium Otomasyonu',
    tab_library: 'Kütüphane',
    tab_downloaded: 'İndirilenler',
    tab_channels: 'Kanallar',
    tab_settings: 'Ayarlar',
    cookie_yes: 'Çerez: Evet',
    cookie_no: 'Çerez: Hayır',
    cookie_status_active: 'Çerez Aktif ve Geçerli',
    cookie_status_locked: 'Çerez Kilitli veya Hatalı',
    cookie_status_none: 'Çerez Kullanılmıyor',
    channels_title: 'Kanallar',
    channels_desc: 'Yeni yüklenen videolarını otomatik indirmek istediğiniz YouTube kanallarını buradan yönetin.',
    input_channel_placeholder: 'YouTube Kanal linki veya kullanıcı adı girin (Örn: @BarisOzcan veya youtube.com/@GezenAdam)',
    btn_follow_channel: 'Kanalı Takip Et',
    btn_update_all_logos: 'Tüm Logoları Güncelle',
    empty_channels_title: 'Henüz takip edilen kanal yok',
    empty_channels_desc: 'Yukarıdaki formdan YouTube kanal linki veya kullanıcı adı girerek kanal ekleyebilirsiniz.',
    select_quality_default: 'Varsayılan Kalite',
    select_quality_best: 'En Yüksek',
    select_quality_1080p: '1080p FHD',
    select_quality_720p: '720p HD',
    select_shorts_true: 'Shorts İndir',
    select_shorts_false: 'Shorts İndirme',
    channel_quality_title: 'İndirme Kalitesi',
    channel_shorts_title: 'Shorts İndirme Durumu',
    channel_shorts_limit_title: 'Shorts Süre Sınırı',
    channel_btn_sync_title: 'Kanalı Şimdi Denetle / RSS Güncelle',
    channel_btn_update_logo_title: 'Logoyu Güncelle',
    channel_btn_unfollow_title: 'Takipten Çıkar',
    shorts_limit_seconds: 'sn',
    shorts_limit_minutes: 'dk',
    inline_sub_color_title: 'Altyazı Rengi',
    inline_sub_opacity_title: 'Altyazı Saydamlığı',
    inline_sub_size_title: 'Altyazı Boyutu',
    library_title: 'Kütüphane & Geçmiş',
    library_desc: 'Tüm video geçmişini, indirme durumlarını ve kuyruğu tek ekrandan takip edin.',
    btn_open_downloads: 'İndirilenler Klasörünü Aç',
    badge_active_download: 'Aktif İndirme',
    queue_empty_title: 'Kuyruk Boş',
    queue_empty_desc: 'Aktif indirme bulunmuyor. Yeni videolar çıktığında otomatik indirilecektir.',
    active_download_progress: 'İlerleme',
    active_download_size: 'Boyut',
    active_download_eta: 'Kalan',
    active_download_cancel: 'İptal Et',
    queue_title: 'İndirme Sırası',
    queue_empty: 'Kuyrukta bekleyen video yok.',
    library_history_title: 'Kütüphane & Geçmiş',
    filter_all_channels: 'Tüm Kanallar',
    show_shorts: 'Shorts Göster',
    view_grid: 'Kartlar',
    view_list: 'Sade Liste',
    no_videos_filter: 'Filtreye uygun video kaydı bulunmuyor.',
    downloaded_title: 'İndirilenler',
    downloaded_desc: 'Sisteme başarıyla indirilmiş ve çevrimdışı izlemeye hazır videolar.',
    settings_title: 'Sistem Ayarları',
    settings_desc: 'Otomasyon parametrelerini, indirme kalitesini, çerez tarayıcısını ve genel sistem tercihlerini özelleştirin.',
    label_download_path: 'İndirme Klasörü Konumu',
    btn_select_folder: 'Klasör Seç',
    btn_test_folder: 'Test Et',
    label_browser: 'Premium Çerez Tarayıcısı',
    label_quality: 'Varsayılan İndirme Kalitesi',
    label_merge_type: 'İndirme Yöntemi (FFmpeg / Dosya Yapısı)',
    label_interval: 'Kanal Kontrol Sıklığı (Saniye)',
    label_auto_download: 'Otomatik İndirme',
    label_write_thumbnail: 'Kapak Resmi',
    label_show_shorts: 'Shorts Videoları',
    label_theme: 'Görünüm Teması',
    label_auto_delete: 'Videoları Otomatik Sil (Gün)',
    label_rss_limit: 'RSS Denetleme Limiti (Video)',
    label_settings_speed_limit: 'Maksimum İndirme Hızı (KB/s)',
    label_port: 'Uygulama Port Numarası',
    label_play_sounds: 'Sesli Bildirimler',
    desc_play_sounds: 'Video indirme durumlarında (başlama, başarı, hata) sesli uyarı çal',
    label_show_notifications: 'Masaüstü Bildirimleri',
    desc_show_notifications: 'İndirme başlama ve bitişlerinde Windows bildirimleri göster',
    label_auto_open_browser: 'Tarayıcıyı Otomatik Aç',
    desc_auto_open_browser: 'Uygulama başladığında tarayıcıda localhost sayfasını otomatik aç',
    btn_search_channel: 'Kanal Ara',
    btn_add_channel: 'Kanalı Takip Et',
    desc_auto_download: 'Yeni videolar algılandığında hemen indirmeyi başlat',
    desc_write_thumbnail: 'Videoların kapak resimlerini (thumbnail) yanına indir',
    desc_show_shorts: 'Geçmiş video listesinde Shorts videolarını göster',
    label_lang: 'Uygulama Dili / App Language',
    label_settings_player_type: 'Gömülü Oynatıcı Türü',
    desc_settings_player_type: 'Gömülü video oynatıcı arayüz tipini seçin.',
    opt_player_plyr: 'Plyr Player (Modern & Özelleştirilmiş)',
    opt_player_artplayer: 'ArtPlayer (Gelişmiş & Şık Oynatıcı)',
    opt_player_html5: 'Standart HTML5 Player (Hızlı & Sade - SponsorBlock Görsel Şeritleri Desteklemez)',
    label_sponsorblock: 'SponsorBlock (Oynatıcı)',
    desc_sponsorblock: 'Video oynatılırken sponsorlu veya tanıtım alanlarını otomatik atla.',
    cookie_warning_title: 'Önemli Çerez Kilidi Uyarısı:',
    cookie_warning_desc: 'İndirme işlemleri başlamadan önce seçtiğiniz tarayıcıyı (Chrome, Edge vb.) tamamen kapattığınızdan emin olun. Aksi takdirde tarayıcı çerez dosyasını (SQLite) kilitleyeceğinden indirmeler hata verecektir.',
    btn_save_settings: 'Ayarları Kaydet',
    modal_delete_title: 'Videoyu Geçmişten Kaldır',
    modal_delete_desc: 'Bu videoyu indirme geçmişinden kaldırmak istediğinize emin misiniz?',
    modal_delete_file_checkbox: 'İndirilen video dosyasını bilgisayardan da kalıcı olarak sil',
    modal_delete_btn: 'Sil',
    modal_cancel_btn: 'İptal',
    modal_player_title: 'Gömülü Video Oynatıcı',
    tab_queue: 'Kuyruk',
    tab_queue_title: 'İndirme Sırası & Kontrol',
    tab_queue_desc: 'Aktif indirmeyi izleyin, sıradaki videoları sürükleyip bırakarak önceliklerini değiştirin.',
    btn_pause_queue: 'Kuyruğu Duraklat',
    btn_resume_queue: 'Kuyruğu Devam Ettir',
    label_queue_speed_limit: 'Hız Sınırı:',
    btn_speed_limit_set: 'Ayarla',
    active_progress: 'İlerleme',
    active_size: 'Boyut',
    active_eta: 'Kalan Süre',
    queue_empty_title: 'Kuyruk Beklemede',
    queue_empty_desc: 'Aktif indirme bulunmuyor. Yeni videolar çıktığında veya kuyruğa video eklendiğinde otomatik indirilecektir.',
    queue_list_title: 'Sıradaki Videolar',
    drag_drop_hint: 'Sürükleyip bırakarak sırayı değiştirin',
    queue_list_empty: 'Kuyrukta bekleyen video yok.',
    settings_desc: 'Otomasyon seçeneklerini, çerez tarayıcısını ve indirme klasörünü yapılandırın.',
    settings_tab_general: 'Genel Ayarlar',
    settings_tab_download: 'İndirme ve Kalite',
    settings_tab_automation: 'Otomasyon & RSS',
    settings_tab_notifications: 'Çerez & Bildirim',
    settings_tab_feedback: 'Geri Bildirim Gönder',
    sort_btn_date_desc: 'Tarih ▼',
    sort_btn_date_asc: 'Tarih ▲',
    sort_btn_size_desc: 'Boyut ▼',
    sort_btn_size_asc: 'Boyut ▲',
    topbar_cookie_title: 'Çerez',
    topbar_quality_title: 'Kalite',
    topbar_disk_title_free: 'Boş',
    topbar_disk_title_folder: 'Alan',
    settings_version_title: 'Sürüm',
    desc_download_path: 'Videoların kaydedileceği bilgisayarınızdaki klasör yolu.',
    desc_lang: 'Arayüz dilini ve video başlıklarının indirileceği dili seçin.',
    opt_theme_dark: 'Koyu Tema (Karanlık)',
    opt_theme_light: 'Açık Tema (Aydınlık)',
    desc_theme: 'Arayüzün görünüm rengini buradan değiştirebilirsiniz.',
    desc_port: 'Uygulama arayüzünün portu (Yeniden başlatma gerektirir).',
    opt_quality_best: 'En Yüksek Kalite (Otomatik)',
    opt_quality_1080p: 'Maksimum 1080p Full HD',
    opt_quality_720p: 'Maksimum 720p HD',
    desc_quality: 'Kanala özel ayar yapılmadığında bu varsayılan kalite kullanılacaktır.',
    opt_merge_single: 'Tek Hazır Dosya (En Fazla 720p, ffmpeg gerektirmez)',
    opt_merge_merge: 'Otomatik Birleştir (Yüksek Çözünürlük, ffmpeg gerektirir)',
    opt_merge_separate: 'Ses ve Videoyu Ayrı İndir (ffmpeg gerektirmez)',
    desc_merge_type: 'Yüksek çözünürlükleri tek dosya yapmak için FFmpeg gereklidir.',
    desc_speed_limit: 'Bant genişliğini sınırlamak için değer girin (Sınırsız için 0 yazın).',
    desc_alt_speed_limit: 'Alternatif hız profili aktifken kullanılacak limit (varsayılan 500).',
    cli_info_title: 'CLI ve Konsol Hız Komutları',
    cli_info_desc: "Hız sınırlarını konsoldan veya terminal/CLI üzerinden kontrol edebilirsiniz (Windows'ta <code>HaYTooL YT Downloader.exe &lt;komut&gt;</code> veya <code>haytool &lt;komut&gt;</code> kullanabilirsiniz):<br>• <b>Hız Sınırını Ayarlama:</b> <code>HaYTooL YT Downloader.exe speed &lt;değer&gt;</code> (örn: <code>HaYTooL YT Downloader.exe speed 2500</code>)<br>• <b>Hız Sınırını Açma/Kapatma:</b> <code>HaYTooL YT Downloader.exe speed off</code> (kapatır) / <code>HaYTooL YT Downloader.exe speed on</code> (son değere açar)<br>• <b>Alternatif Sınırı Belirleme:</b> <code>HaYTooL YT Downloader.exe altspeed &lt;değer&gt;</code> (örn: <code>HaYTooL YT Downloader.exe altspeed 500</code>)<br>• <b>Alternatif Sınırı Kesin Aç/Kapat (Turtle):</b> <code>HaYTooL YT Downloader.exe turtleon / turtleac</code> (açar) / <code>HaYTooL YT Downloader.exe turtleoff / turtlekapat</code> (kapatır)<br>• <b>Alternatif Sınır Profil Geçişi (Toggle):</b> <code>HaYTooL YT Downloader.exe toggle</code> veya <code>HaYTooL YT Downloader.exe altspeed toggle</code><br>• <b>Durum Sorgulama:</b> <code>HaYTooL YT Downloader.exe status</code> (limit durumunu yazdırır)",
    cli_info_note: "(Tray \"Konsol Çıktısını Göster\" penceresinde 'HaYTooL YT Downloader.exe' veya 'node' yazmadan doğrudan komutu girin: 'speed 2500', 'speed off', 'turtleon', 'turtleoff', 'toggle' vb.)",
    desc_channel_check_interval: 'Sıradaki kanalı denetlemek için beklenecek süre.',
    desc_rss_limit: 'Kanal başına RSS akışındaki en yeni kaç video kontrol edilsin?',
    desc_auto_delete: 'Kaç gün sonra otomatik silinsin? (Kapatmak için 0 yazın)',
    opt_browser_none: 'Çerez Kullanma (Sadece Açık Videolar)',
    desc_browser: 'YouTube Premium hesabınızın açık olduğu tarayıcıyı seçin. Bu sayede Premium yüksek indirme hızı ve yüksek kalite kullanılabilir.',
    settings_status_text: 'Değişiklikler anında otomatik kaydedilir.',
    connection_connecting: 'Bağlantı: Bağlanıyor...',
    connection_active: 'Bağlantı: Aktif',
    connection_lost: 'Bağlantı: Kesildi',
    label_history_limit: 'Kanal Başına Geçmiş Videosu Sınırı',
    desc_history_limit: 'Kütüphanede kanal başına listelenecek maksimum video limiti (Arayüz performansını artırır).',
    opt_limit_10: '10 Video',
    opt_limit_20: '20 Video (Önerilen)',
    opt_limit_50: '50 Video',
    opt_limit_100: '100 Video',
    opt_limit_200: '200 Video',
    label_data_management: 'Veri ve Yedek Yönetimi',
    desc_data_management: 'Takip ettiğiniz kanalların listesini yedekleyebilir veya yedeğinizi geri yükleyebilirsiniz.',
    btn_export_backup: 'Yedeği Dışarı Aktar',
    btn_import_backup: 'Yedeği İçeri Aktar',
    opt_import_append: 'Üzerine Ekle (Append)',
    opt_import_overwrite: 'Tamamen Üzerine Yaz (Overwrite)',
    lbl_quick_filter: 'Hızlı Filtre:',
    filter_all: 'Tümü',
    filter_today: 'Bugün',
    filter_yesterday: 'Dün',
    filter_last_2_days: 'Son 2 Gün',
    filter_last_3_days: 'Son 3 Gün',
    filter_last_4_days: 'Son 4 Gün',
    filter_last_5_days: 'Son 5 Gün',
    label_subtitle_color: 'Altyazı Rengi',
    desc_subtitle_color: 'Gömülü video oynatıcılarda altyazı rengini seçin.',
    opt_sub_white: 'Beyaz',
    opt_sub_yellow: 'Sarı',
    opt_sub_green: 'Yeşil',
    opt_sub_cyan: 'Turkuaz',
    opt_sub_magenta: 'Pembe',
    opt_sub_red: 'Kırmızı',
    opt_sub_blue: 'Mavi',
    opt_sub_orange: 'Turuncu',
    opt_sub_purple: 'Mor',
    opt_sub_black: 'Siyah',
    opt_sub_gray: 'Gri',
    opt_sub_lightyellow: 'Açık Sarı',
    inline_btn_youtube: 'YouTube\'da Aç',
    inline_btn_system: 'Sistem Oynatıcısında Aç',
    inline_btn_folder: 'Klasör Aç',
    inline_btn_comments: 'Yorumları Göster',
    inline_btn_translate_sub: 'Türkçe\'ye Çevir',
    opt_sub_opacity_0: 'Saydam (%0)',
    opt_sub_opacity_10: 'Saydamlık (%10)',
    opt_sub_opacity_20: 'Saydamlık (%20)',
    opt_sub_opacity_30: 'Saydamlık (%30)',
    opt_sub_opacity_40: 'Saydamlık (%40)',
    opt_sub_opacity_50: 'Saydamlık (%50)',
    opt_sub_opacity_60: 'Saydamlık (%60)',
    opt_sub_opacity_70: 'Saydamlık (%70)',
    opt_sub_opacity_80: 'Saydamlık (%80)',
    opt_sub_opacity_90: 'Saydamlık (%90)',
    opt_sub_opacity_95: 'Saydamlık (%95)',
    opt_sub_opacity_100: 'Mat (%100)',
    overlay_translating_title: 'Altyazı Çeviriliyor...',
    overlay_translating_desc: 'Lütfen bekleyin, API üzerinden satır satır çeviri yapılıyor...',
    modal_translate_title: 'Altyazı Çevirisi',
    modal_translate_no_subs: 'Bu video için indirilmiş altyazı bulunamadı. Çeviri yapabilmek için en az bir altyazı dosyası indirilmiş olmalıdır.',
    modal_translate_source: 'Çevrilecek Altyazı (Kaynak)',
    modal_translate_target: 'Hedef Dil',
    btn_translate_action: 'Çevir',
    select_auto_download_title: 'Otomatik Video İndirme Durumu',
    select_auto_download_true: 'Otomatik İndir',
    select_auto_download_false: 'Otomatik İndirme',
    sponsorblock_active: 'SponsorBlock Aktif (Geçici olarak kapatmak için tıklayın)',
    sponsorblock_disabled: 'SponsorBlock Devre Dışı (Tekrar açmak için tıklayın)',
    lbl_history_only_no_auto_download: 'Oto-İndirme Kapalı',
    lbl_history_only_not_downloaded: 'Sadece İndirilmeyenler',
    sponsorblock_active_toast: 'SponsorBlock Aktif',
    sponsorblock_active_toast_desc: 'Sponsorlu alanlar otomatik atlanacak',
    sponsorblock_disabled_toast: 'SponsorBlock Devre Dışı',
    sponsorblock_disabled_toast_desc: 'Sponsorlu alan atlamaları geçici olarak durduruldu',
    lbl_single_view: 'Tekli Ekran',
    lbl_dual_view: 'İkili Ekran (2 Kanal)',
    lbl_quad_view: 'Çoklu Ekran (4 Kanal)',
    lbl_sport_view: 'Spor Modu (PiP)',
    lbl_select_channel: 'Kanal Seçin',
    lbl_update_channels: 'Kanalları Güncelle',
    lbl_loading_more: 'Daha fazla kanal yükleniyor...',
    opt_all_countries: 'Tüm Ülkeler',
    opt_all_categories: 'Tüm Kategoriler',
    lbl_swap_screens: 'Yer Değiştir'
  },
  en: {
    status_merging: 'Merging (FFmpeg)...',
    tab_iptv: 'IPTV',
    inline_btn_description: 'Show Description',
    inline_description_title: 'Video Description',
    premium_automation: 'Premium Automation',
    tab_library: 'Library',
    tab_downloaded: 'Downloads',
    tab_channels: 'Channels',
    tab_settings: 'Settings',
    cookie_yes: 'Cookies: Yes',
    cookie_no: 'Cookies: No',
    cookie_status_active: 'Cookies Active and Valid',
    cookie_status_locked: 'Cookies Locked or Invalid',
    cookie_status_none: 'Cookies Disabled',
    channels_title: 'Channels',
    channels_desc: 'Manage YouTube channels you want to monitor and download videos from automatically.',
    input_channel_placeholder: 'Enter YouTube channel link or username (e.g. @BarisOzcan or youtube.com/@GezenAdam)',
    btn_follow_channel: 'Follow Channel',
    btn_update_all_logos: 'Update All Logos',
    empty_channels_title: 'No monitored channels yet',
    empty_channels_desc: 'You can add channels by entering a YouTube channel link or username from the form above.',
    select_quality_default: 'Default Quality',
    select_quality_best: 'Highest',
    select_quality_1080p: '1080p FHD',
    select_quality_720p: '720p HD',
    select_shorts_true: 'Download Shorts',
    select_shorts_false: 'Ignore Shorts',
    channel_quality_title: 'Download Quality',
    channel_shorts_title: 'Shorts Download Status',
    channel_shorts_limit_title: 'Shorts Duration Limit',
    channel_btn_sync_title: 'Check Channel Now / Update RSS',
    channel_btn_update_logo_title: 'Update Logo',
    channel_btn_unfollow_title: 'Unfollow Channel',
    shorts_limit_seconds: 's',
    shorts_limit_minutes: 'min',
    inline_sub_color_title: 'Subtitle Color',
    inline_sub_opacity_title: 'Subtitle Opacity',
    inline_sub_size_title: 'Subtitle Size',
    library_title: 'Library & History',
    library_desc: 'Track download queue, active progress, and complete history in one place.',
    btn_open_downloads: 'Open Downloads Folder',
    badge_active_download: 'Active Download',
    queue_empty_title: 'Queue Empty',
    queue_empty_desc: 'No active download. New videos will be downloaded automatically when published.',
    active_download_progress: 'Progress',
    active_download_size: 'Size',
    active_download_eta: 'Remaining',
    active_download_cancel: 'Cancel',
    queue_title: 'Download Queue',
    queue_empty: 'No waiting videos in queue.',
    library_history_title: 'Library & History',
    filter_all_channels: 'All Channels',
    show_shorts: 'Show Shorts',
    view_grid: 'Cards',
    no_videos_filter: 'No video records match the filter.',
    downloaded_title: 'Downloads',
    downloaded_desc: 'List of all videos successfully downloaded and ready for offline playback.',
    settings_title: 'System Settings',
    settings_desc: 'Configure automation options, download quality, cookie browser, and system preferences.',
    label_download_path: 'Downloads Folder Path',
    btn_select_folder: 'Select Folder',
    btn_test_folder: 'Test Folder',
    label_browser: 'Premium Cookie Browser',
    label_quality: 'Default Download Quality',
    label_merge_type: 'Download Method (FFmpeg / File Structure)',
    label_interval: 'Channel Check Interval (Seconds)',
    label_auto_download: 'Auto Download',
    label_write_thumbnail: 'Cover Image',
    label_show_shorts: 'Shorts Videos',
    label_theme: 'UI Theme',
    label_auto_delete: 'Auto Delete Videos (Days)',
    label_rss_limit: 'RSS Check Limit (Videos)',
    label_settings_speed_limit: 'Maximum Download Speed (KB/s)',
    label_port: 'Application Port Number',
    label_play_sounds: 'Audio Notifications',
    desc_play_sounds: 'Play sound notifications for video download events (start, success, error)',
    label_show_notifications: 'Desktop Notifications',
    desc_show_notifications: 'Show Windows desktop notifications when downloads start and finish',
    label_auto_open_browser: 'Auto-Open Browser',
    desc_auto_open_browser: 'Automatically open the localhost page in browser when application starts',
    btn_search_channel: 'Search Channel',
    btn_add_channel: 'Follow Channel',
    desc_auto_download: 'Start downloading immediately when new videos are detected',
    desc_write_thumbnail: 'Download video cover images (thumbnails) alongside them',
    desc_show_shorts: 'Show Shorts videos in the history library list',
    label_lang: 'App Language',
    label_settings_player_type: 'Embedded Player Type',
    desc_settings_player_type: 'Select the embedded video player interface style.',
    opt_player_plyr: 'Plyr Player (Modern & Customized)',
    opt_player_artplayer: 'ArtPlayer (Advanced & Sleek Player)',
    opt_player_html5: 'Standard HTML5 Player (Fast & Simple - SponsorBlock Visual Timelines Not Supported)',
    label_sponsorblock: 'SponsorBlock (Player)',
    desc_sponsorblock: 'Automatically skip sponsored segments or self-promotions during playback.',
    cookie_warning_title: 'Important Cookie Lock Warning:',
    cookie_warning_desc: 'Please make sure to completely CLOSE your selected browser (Chrome, Edge, etc.) before downloading. Otherwise, the browser locks the cookie database (SQLite) and causes download errors.',
    btn_save_settings: 'Save Settings',
    modal_delete_title: 'Remove Video from History',
    modal_delete_desc: 'Are you sure you want to remove this video from download history?',
    modal_delete_file_checkbox: 'Permanently delete the downloaded video file from computer as well',
    modal_delete_btn: 'Delete',
    modal_cancel_btn: 'Cancel',
    modal_player_title: 'Embedded Video Player',
    tab_queue: 'Queue',
    tab_queue_title: 'Download Queue & Control',
    tab_queue_desc: 'Monitor active downloads, drag and drop videos in the queue to change their priority.',
    btn_pause_queue: 'Pause Queue',
    btn_resume_queue: 'Resume Queue',
    label_queue_speed_limit: 'Speed Limit:',
    btn_speed_limit_set: 'Set Limit',
    active_progress: 'Progress',
    active_size: 'Size',
    active_eta: 'Remaining',
    queue_empty_title: 'Queue Idle',
    queue_empty_desc: 'No active download. It will start automatically when new videos are published or added to the queue.',
    queue_list_title: 'Queue Videos',
    drag_drop_hint: 'Drag and drop items to reorder the queue',
    queue_list_empty: 'No videos waiting in the queue.',
    settings_desc: 'Configure automation options, cookie browser, and download folder.',
    settings_tab_general: 'General Settings',
    settings_tab_download: 'Download & Quality',
    settings_tab_automation: 'Automation & RSS',
    settings_tab_notifications: 'Cookie & Notification',
    settings_tab_feedback: 'Send Feedback',
    sort_btn_date_desc: 'Date ▼',
    sort_btn_date_asc: 'Date ▲',
    sort_btn_size_desc: 'Size ▼',
    sort_btn_size_asc: 'Size ▲',
    topbar_cookie_title: 'Cookie',
    topbar_quality_title: 'Quality',
    topbar_disk_title_free: 'Free',
    topbar_disk_title_folder: 'Size',
    settings_version_title: 'Version',
    desc_download_path: 'The directory path on your computer where videos will be saved.',
    desc_lang: 'Choose the interface language and the language for video titles.',
    opt_theme_dark: 'Dark Theme',
    opt_theme_light: 'Light Theme',
    desc_theme: 'You can change the interface color theme here.',
    desc_port: 'Application port number (Requires restart).',
    opt_quality_best: 'Highest Quality (Automatic)',
    opt_quality_1080p: 'Maximum 1080p Full HD',
    opt_quality_720p: 'Maximum 720p HD',
    desc_quality: 'This default quality will be used unless a channel-specific setting is set.',
    opt_merge_single: 'Single Ready File (Max 720p, no ffmpeg required)',
    opt_merge_merge: 'Auto Merge (High Resolution, requires ffmpeg)',
    opt_merge_separate: 'Download Audio & Video Separately (no ffmpeg required)',
    desc_merge_type: 'FFmpeg is required to merge high resolutions into a single file.',
    desc_speed_limit: 'Enter value to limit bandwidth (Write 0 for unlimited).',
    desc_alt_speed_limit: 'Limit to be used when alternative speed profile is active (default 500).',
    cli_info_title: 'CLI and Console Speed Commands',
    cli_info_desc: "You can control speed limits from the console or terminal/CLI (you can use <code>HaYTooL YT Downloader.exe &lt;command&gt;</code> or <code>haytool &lt;command&gt;</code> on Windows):<br>• <b>Set Speed Limit:</b> <code>HaYTooL YT Downloader.exe speed &lt;value&gt;</code> (e.g. <code>HaYTooL YT Downloader.exe speed 2500</code>)<br>• <b>Speed Limit On/Off:</b> <code>HaYTooL YT Downloader.exe speed off</code> (disables) / <code>HaYTooL YT Downloader.exe speed on</code> (restores to last value)<br>• <b>Set Alt Speed Limit:</b> <code>HaYTooL YT Downloader.exe altspeed &lt;value&gt;</code> (e.g. <code>HaYTooL YT Downloader.exe altspeed 500</code>)<br>• <b>Alt Speed Limit Forced On/Off (Turtle):</b> <code>HaYTooL YT Downloader.exe turtleon / turtleac</code> (enables) / <code>HaYTooL YT Downloader.exe turtleoff / turtlekapat</code> (disables)<br>• <b>Alt Speed Profile Toggle:</b> <code>HaYTooL YT Downloader.exe toggle</code> or <code>HaYTooL YT Downloader.exe altspeed toggle</code><br>• <b>Query Status:</b> <code>HaYTooL YT Downloader.exe status</code> (prints limit status)",
    cli_info_note: "(In the Tray 'Show Console Output' window, enter the command directly without writing 'HaYTooL YT Downloader.exe' or 'node': 'speed 2500', 'speed off', 'turtleon', 'turtleoff', 'toggle' etc.)",
    desc_channel_check_interval: 'Waiting time to check the next channel.',
    desc_rss_limit: 'How many of the latest videos in the RSS feed should be checked per channel?',
    desc_auto_delete: 'After how many days should it be deleted automatically? (Write 0 to disable)',
    opt_browser_none: 'Do Not Use Cookies (Public Videos Only)',
    desc_browser: 'Select the browser where your YouTube Premium account is logged in. This enables Premium high download speed and high quality.',
    settings_status_text: 'Changes are automatically saved instantly.',
    connection_connecting: 'Connection: Connecting...',
    connection_active: 'Connection: Connected',
    connection_lost: 'Connection: Lost',
    label_history_limit: 'History Limit per Channel',
    desc_history_limit: 'Maximum video limit to list in the library per channel (Improves UI performance).',
    opt_limit_10: '10 Videos',
    opt_limit_20: '20 Videos (Recommended)',
    opt_limit_50: '50 Videos',
    opt_limit_100: '100 Videos',
    opt_limit_200: '200 Videos',
    label_data_management: 'Data & Backup Management',
    desc_data_management: 'You can backup your followed channels list or restore from a backup file.',
    btn_export_backup: 'Export Backup',
    btn_import_backup: 'Import Backup',
    opt_import_append: 'Append to Existing (Append)',
    opt_import_overwrite: 'Overwrite Completely (Overwrite)',
    lbl_quick_filter: 'Quick Filter:',
    filter_all: 'All',
    filter_today: 'Today',
    filter_yesterday: 'Yesterday',
    filter_last_2_days: 'Last 2 Days',
    filter_last_3_days: 'Last 3 Days',
    filter_last_4_days: 'Last 4 Days',
    filter_last_5_days: 'Last 5 Days',
    label_subtitle_color: 'Subtitle Color',
    desc_subtitle_color: 'Select the subtitle color in embedded video players.',
    opt_sub_white: 'White',
    opt_sub_yellow: 'Yellow',
    opt_sub_green: 'Green',
    opt_sub_cyan: 'Cyan',
    opt_sub_magenta: 'Pink',
    opt_sub_red: 'Red',
    opt_sub_blue: 'Blue',
    opt_sub_orange: 'Orange',
    opt_sub_purple: 'Purple',
    opt_sub_black: 'Black',
    opt_sub_gray: 'Gray',
    opt_sub_lightyellow: 'Light Yellow',
    inline_btn_youtube: 'Open on YouTube',
    inline_btn_system: 'Open in System Player',
    inline_btn_folder: 'Open Folder',
    inline_btn_comments: 'Show Comments',
    inline_btn_translate_sub: 'Translate to Turkish',
    opt_sub_opacity_0: 'Transparent (%0)',
    opt_sub_opacity_10: 'Opacity (%10)',
    opt_sub_opacity_20: 'Opacity (%20)',
    opt_sub_opacity_30: 'Opacity (%30)',
    opt_sub_opacity_40: 'Opacity (%40)',
    opt_sub_opacity_50: 'Opacity (%50)',
    opt_sub_opacity_60: 'Opacity (%60)',
    opt_sub_opacity_70: 'Opacity (%70)',
    opt_sub_opacity_80: 'Opacity (%80)',
    opt_sub_opacity_90: 'Opacity (%90)',
    opt_sub_opacity_95: 'Opacity (%95)',
    opt_sub_opacity_100: 'Solid (%100)',
    overlay_translating_title: 'Translating Subtitles...',
    overlay_translating_desc: 'Please wait, translating track line-by-line using API...',
    modal_translate_title: 'Subtitle Translation',
    modal_translate_no_subs: 'No downloaded subtitles found for this video. You need at least one downloaded subtitle track to translate.',
    modal_translate_source: 'Source Subtitle',
    modal_translate_target: 'Target Language',
    btn_translate_action: 'Translate',
    select_auto_download_title: 'Auto Download Status',
    select_auto_download_true: 'Auto Download',
    select_auto_download_false: 'No Auto Download',
    sponsorblock_active: 'SponsorBlock Active (Click to temporarily disable)',
    sponsorblock_disabled: 'SponsorBlock Disabled (Click to re-enable)',
    lbl_history_only_no_auto_download: 'Auto-Download Off',
    lbl_history_only_not_downloaded: 'Only Undownloaded',
    sponsorblock_active_toast: 'SponsorBlock Active',
    sponsorblock_active_toast_desc: 'Sponsor segments will be automatically skipped',
    sponsorblock_disabled_toast: 'SponsorBlock Disabled',
    sponsorblock_disabled_toast_desc: 'Sponsor segment skipping is temporarily paused',
    lbl_single_view: 'Single View',
    lbl_dual_view: 'Dual View (2 Channels)',
    lbl_quad_view: 'Quad View (4 Channels)',
    lbl_sport_view: 'Sport Mode (PiP)',
    lbl_select_channel: 'Select a Channel',
    lbl_update_channels: 'Update Channels',
    lbl_loading_more: 'Loading more channels...',
    opt_all_countries: 'All Countries',
    opt_all_categories: 'All Categories',
    lbl_swap_screens: 'Swap Screens'
  },
  es: {
    status_merging: 'Fusionando (FFmpeg)...',
    premium_automation: 'Automatización Premium',
    tab_library: 'Biblioteca',
    tab_downloaded: 'Descargas',
    tab_channels: 'Canales',
    tab_settings: 'Ajustes',
    cookie_yes: 'Cookies: Sí',
    cookie_no: 'Cookies: No',
    cookie_status_active: 'Cookies Activas y Válidas',
    cookie_status_locked: 'Cookies Bloqueadas o Inválidas',
    cookie_status_none: 'Cookies Desactivadas',
    channels_title: 'Canales',
    channels_desc: 'Gestione los canales de YouTube que desea monitorear y descargar automáticamente.',
    input_channel_placeholder: 'Ingrese enlace o usuario de canal (Ej: @BarisOzcan)',
    btn_follow_channel: 'Seguir Canal',
    btn_update_all_logos: 'Actualizar Logos',
    empty_channels_title: 'Sin canales monitoreados',
    empty_channels_desc: 'Agregue canales ingresando un enlace o usuario de YouTube arriba.',
    select_quality_default: 'Calidad por Defecto',
    select_quality_best: 'La Mejor',
    select_quality_1080p: '1080p FHD',
    select_quality_720p: '720p HD',
    select_shorts_true: 'Descargar Shorts',
    select_shorts_false: 'Ignorar Shorts',
    channel_quality_title: 'Calidad de Descarga',
    channel_shorts_title: 'Estado de Descarga de Shorts',
    channel_shorts_limit_title: 'Límite de Duración de Shorts',
    channel_btn_sync_title: 'Comprobar Canal Ahora / Actualizar RSS',
    channel_btn_update_logo_title: 'Actualizar Logo',
    channel_btn_unfollow_title: 'Dejar de Seguir Canal',
    shorts_limit_seconds: 's',
    shorts_limit_minutes: 'min',
    inline_sub_color_title: 'Color de Subtítulos',
    inline_sub_opacity_title: 'Opacidad de Subtítulos',
    inline_sub_size_title: 'Tamaño de Subtítulos',
    library_title: 'Biblioteca y Historial',
    library_desc: 'Monitoree la cola de descargas y el historial completo.',
    btn_open_downloads: 'Abrir Carpeta de Descargas',
    badge_active_download: 'Descarga Activa',
    queue_empty_title: 'Cola Vacía',
    queue_empty_desc: 'No hay descargas activas.',
    active_download_progress: 'Progreso',
    active_download_size: 'Tamaño',
    active_download_eta: 'Restante',
    active_download_cancel: 'Cancelar',
    queue_title: 'Cola de Descarga',
    queue_empty: 'No hay videos en espera en la cola.',
    library_history_title: 'Biblioteca e Historial',
    filter_all_channels: 'Todos los Canales',
    show_shorts: 'Mostrar Shorts',
    view_grid: 'Tarjetas',
    view_list: 'Lista Simple',
    no_videos_filter: 'Sin registros de video.',
    downloaded_title: 'Descargas',
    downloaded_desc: 'Videos descargados listos para reproducir sin conexión.',
    settings_title: 'Ajustes del Sistema',
    settings_desc: 'Configure automatización, calidad, cookies y preferencias.',
    label_download_path: 'Ruta de Carpeta de Descargas',
    btn_select_folder: 'Seleccionar Carpeta',
    btn_test_folder: 'Probar Carpeta',
    label_browser: 'Navegador de Cookies Premium',
    label_quality: 'Calidad de Descarga por Defecto',
    label_merge_type: 'Método de Descarga (FFmpeg)',
    label_interval: 'Intervalo de Comprobación (Segundos)',
    label_auto_download: 'Descarga Automática',
    label_write_thumbnail: 'Imagen de Portada',
    label_show_shorts: 'Videos Shorts',
    label_theme: 'Tema de la Interfaz',
    label_auto_delete: 'Eliminación Automática (Días)',
    label_rss_limit: 'Límite de RSS (Videos)',
    label_settings_speed_limit: 'Velocidad Máxima de Descarga (KB/s)',
    label_port: 'Número de Puerto',
    label_play_sounds: 'Notificaciones de Audio',
    desc_play_sounds: 'Reproducir sonidos para eventos de descarga',
    label_show_notifications: 'Notificaciones de Escritorio',
    desc_show_notifications: 'Mostrar notificaciones cuando las descargas comiencen/terminen',
    label_auto_open_browser: 'Abrir Navegador Automáticamente',
    desc_auto_open_browser: 'Abrir localhost al iniciar la aplicación',
    btn_search_channel: 'Buscar Canal',
    btn_add_channel: 'Seguir Canal',
    desc_auto_download: 'Descargar inmediatamente al detectar videos nuevos',
    desc_write_thumbnail: 'Descargar miniaturas junto a los videos',
    desc_show_shorts: 'Mostrar Shorts en el historial',
    label_lang: 'Idioma de la App',
    label_settings_player_type: 'Tipo de Reproductor Integrado',
    desc_settings_player_type: 'Seleccione el estilo del reproductor integrado.',
    opt_player_plyr: 'Reproductor Plyr',
    opt_player_artplayer: 'Reproductor ArtPlayer',
    opt_player_html5: 'Reproductor HTML5 Estándar (Rápido y simple - No admite líneas de tiempo de SponsorBlock)',
    label_sponsorblock: 'SponsorBlock (Reproductor)',
    desc_sponsorblock: 'Omitir automáticamente los segmentos patrocinados durante la reproducción.',
    cookie_warning_title: 'Advertencia Importante de Cookies:',
    cookie_warning_desc: 'Cierre completamente el navegador seleccionado antes de descargar.',
    btn_save_settings: 'Guardar Ajustes',
    modal_delete_title: 'Eliminar Video del Historial',
    modal_delete_desc: '¿Seguro que desea eliminar este video del historial?',
    modal_delete_file_checkbox: 'Eliminar permanentemente el archivo del ordenador',
    modal_delete_btn: 'Eliminar',
    modal_cancel_btn: 'Cancelar',
    modal_player_title: 'Reproductor de Video Integrado',
    tab_queue: 'Cola',
    tab_queue_title: 'Control de la Cola de Descargas',
    tab_queue_desc: 'Monitoree descargas activas y organice la prioridad.',
    btn_pause_queue: 'Pausar Cola',
    btn_resume_queue: 'Reanudar Cola',
    label_queue_speed_limit: 'Límite de Velocidad:',
    btn_speed_limit_set: 'Establecer Límite',
    active_progress: 'Progreso',
    active_size: 'Tamaño',
    active_eta: 'Restante',
    queue_empty_title: 'Cola en Espera',
    queue_empty_desc: 'No hay descargas activas.',
    queue_list_title: 'Videos en Cola',
    drag_drop_hint: 'Arrastre y suelte para reordenar la cola',
    queue_list_empty: 'Sin videos en cola.',
    settings_desc: 'Configure automatización, cookie browser, y carpeta de descargas.',
    settings_tab_general: 'Ajustes Generales',
    settings_tab_download: 'Descarga y Calidad',
    settings_tab_automation: 'Automatización y RSS',
    settings_tab_notifications: 'Cookies y Notificación',
    settings_tab_feedback: 'Enviar Comentarios',
    sort_btn_date_desc: 'Fecha ▼',
    sort_btn_date_asc: 'Fecha ▲',
    sort_btn_size_desc: 'Tamaño ▼',
    sort_btn_size_asc: 'Tamaño ▲',
    topbar_cookie_title: 'Cookies',
    topbar_quality_title: 'Calidad',
    topbar_disk_title_free: 'Libre',
    topbar_disk_title_folder: 'Tamaño',
    settings_version_title: 'Versión',
    desc_download_path: 'Carpeta donde se guardarán los videos.',
    desc_lang: 'Seleccione el idioma de la interfaz y de los títulos.',
    opt_theme_dark: 'Tema Oscuro',
    opt_theme_light: 'Tema Claro',
    desc_theme: 'Cambie el tema de color de la interfaz aquí.',
    desc_port: 'Puerto de la aplicación (Requiere reiniciar).',
    opt_quality_best: 'Mejor Calidad (Automático)',
    opt_quality_1080p: 'Máximo 1080p FHD',
    opt_quality_720p: 'Máximo 720p HD',
    desc_quality: 'Calidad por defecto a usar.',
    opt_merge_single: 'Archivo Único (Max 720p, sin ffmpeg)',
    opt_merge_merge: 'Fusión Automática (Alta resolución, requiere ffmpeg)',
    opt_merge_separate: 'Descargar Audio y Video por Separado',
    desc_merge_type: 'Se requiere FFmpeg para fusionar altas resoluciones.',
    desc_speed_limit: 'Límite de velocidad (0 para ilimitado).',
    desc_alt_speed_limit: 'Límite de velocidad alternativo.',
    cli_info_title: 'Comandos de Consola y CLI',
    cli_info_desc: "Puede controlar los límites de velocidad desde la consola o terminal/CLI (puede usar <code>HaYTooL YT Downloader.exe &lt;comando&gt;</code> o <code>haytool &lt;comando&gt;</code> en Windows):<br>• <b>Ajustar Límite:</b> <code>HaYTooL YT Downloader.exe speed &lt;valor&gt;</code><br>• <b>Límite On/Off:</b> <code>HaYTooL YT Downloader.exe speed off / on</code><br>• <b>Límite Alt:</b> <code>HaYTooL YT Downloader.exe altspeed &lt;valor&gt;</code><br>• <b>Límite Alt Forzado (Turtle):</b> <code>HaYTooL YT Downloader.exe turtleon / turtleoff</code><br>• <b>Perfil Alt Toggle:</b> <code>HaYTooL YT Downloader.exe toggle</code><br>• <b>Consultar Estado:</b> <code>HaYTooL YT Downloader.exe status</code>",
    cli_info_note: "(Ingrese comandos en la consola directamente: speed, toggle, etc.)",
    desc_channel_check_interval: 'Tiempo para revisar el siguiente canal.',
    desc_rss_limit: 'Número de videos RSS a revisar por canal.',
    desc_auto_delete: 'Silenciar automáticamente tras días (0 para desactivar).',
    opt_browser_none: 'No Usar Cookies',
    desc_browser: 'Seleccione el navegador para acceder a Premium.',
    settings_status_text: 'Los cambios se guardan automáticamente.',
    connection_connecting: 'Conexión: Conectando...',
    connection_active: 'Conexión: Conectada',
    connection_lost: 'Conexión: Perdida',
    label_history_limit: 'Límite por Canal',
    desc_history_limit: 'Límite máximo de videos a listar por canal.',
    opt_limit_10: '10 Videos',
    opt_limit_20: '20 Videos (Recomendado)',
    opt_limit_50: '50 Videos',
    opt_limit_100: '100 Videos',
    opt_limit_200: '200 Videos',
    label_data_management: 'Gestión de Datos y Copias',
    desc_data_management: 'Puede exportar su lista de canales o restaurarla desde un archivo.',
    btn_export_backup: 'Exportar Copia',
    btn_import_backup: 'Importar Copia',
    opt_import_append: 'Añadir a lo Existente (Append)',
    opt_import_overwrite: 'Sobrescribir Completamente (Overwrite)',
    lbl_quick_filter: 'Filtro Rápido:',
    filter_all: 'Todos',
    filter_today: 'Hoy',
    filter_yesterday: 'Ayer',
    filter_last_2_days: 'Últimos 2 Días',
    filter_last_3_days: 'Últimos 3 Días',
    filter_last_4_days: 'Últimos 4 Días',
    filter_last_5_days: 'Últimos 5 Días',
    label_subtitle_color: 'Color de Subtítulos',
    desc_subtitle_color: 'Seleccione el color de los subtítulos en los reproductores de video.',
    opt_sub_white: 'Blanco',
    opt_sub_yellow: 'Amarillo',
    opt_sub_green: 'Verde',
    opt_sub_cyan: 'Cian',
    opt_sub_magenta: 'Rosa',
    opt_sub_red: 'Rojo',
    opt_sub_blue: 'Azul',
    opt_sub_orange: 'Naranja',
    opt_sub_purple: 'Morado',
    opt_sub_black: 'Negro',
    opt_sub_gray: 'Gris',
    opt_sub_lightyellow: 'Amarillo Claro',
    inline_btn_youtube: 'Abrir en YouTube',
    inline_btn_system: 'Abrir en Reproductor del Sistema',
    inline_btn_folder: 'Abrir Carpeta',
    inline_btn_comments: 'Mostrar Comentarios',
    inline_btn_translate_sub: 'Traducir al Turco',
    opt_sub_opacity_0: 'Transparente (%0)',
    opt_sub_opacity_10: 'Opacidad (%10)',
    opt_sub_opacity_20: 'Opacidad (%20)',
    opt_sub_opacity_30: 'Opacidad (%30)',
    opt_sub_opacity_40: 'Opacidad (%40)',
    opt_sub_opacity_50: 'Opacidad (%50)',
    opt_sub_opacity_60: 'Opacidad (%60)',
    opt_sub_opacity_70: 'Opacidad (%70)',
    opt_sub_opacity_80: 'Opacidad (%80)',
    opt_sub_opacity_90: 'Opacidad (%90)',
    opt_sub_opacity_95: 'Opacidad (%95)',
    opt_sub_opacity_100: 'Sólido (%100)',
    overlay_translating_title: 'Traduciendo subtítulos...',
    overlay_translating_desc: 'Por favor espere, traduciendo la pista línea por línea usando la API...',
    modal_translate_title: 'Traducción de Subtítulos',
    modal_translate_no_subs: 'No se encontraron subtítulos descargados para este video. Necesita al menos una pista de subtítulos descargada para traducir.',
    modal_translate_source: 'Subtítulo de Origen',
    modal_translate_target: 'Idioma de Destino',
    btn_translate_action: 'Traducir',
    select_auto_download_title: 'Estado de descarga automática',
    select_auto_download_true: 'Descarga automática',
    select_auto_download_false: 'Sin descarga automática',
    sponsorblock_active: 'SponsorBlock Activo (Haga clic para desactivar temporalmente)',
    sponsorblock_disabled: 'SponsorBlock Desactivado (Haga clic para volver a activar)',
    lbl_history_only_no_auto_download: 'Descarga Auto. Desactivada',
    lbl_history_only_not_downloaded: 'Solo no descargados',
    sponsorblock_active_toast: 'SponsorBlock Activo',
    sponsorblock_active_toast_desc: 'Los segmentos patrocinados se omitirán automáticamente',
    sponsorblock_disabled_toast: 'SponsorBlock Desactivado',
    sponsorblock_disabled_toast_desc: 'La omisión de segmentos patrocinados está pausada temporalmente'
  },
  de: {
    status_merging: 'Zusammenführen (FFmpeg)...',
    premium_automation: 'Premium Automatisierung',
    tab_library: 'Bibliothek',
    tab_downloaded: 'Downloads',
    tab_channels: 'Kanäle',
    tab_settings: 'Einstellungen',
    cookie_yes: 'Cookies: Ja',
    cookie_no: 'Cookies: Nein',
    cookie_status_active: 'Cookies Aktiv und Gültig',
    cookie_status_locked: 'Cookies Gesperrt oder Ungültig',
    cookie_status_none: 'Cookies Deaktiviert',
    channels_title: 'Kanäle',
    channels_desc: 'Kanäle verwalten, die Sie automatisch überwachen und herunterladen möchten.',
    input_channel_placeholder: 'Kanal-Link oder Benutzernamen eingeben (Z.B. @BarisOzcan)',
    btn_follow_channel: 'Kanal Folgen',
    btn_update_all_logos: 'Logos Aktualisieren',
    empty_channels_title: 'Noch keine überwachten Kanäle',
    empty_channels_desc: 'Fügen Sie Kanäle hinzu, indem Sie oben einen YouTube-Link eingeben.',
    select_quality_default: 'Standardqualität',
    select_quality_best: 'Beste Qualität',
    select_quality_1080p: '1080p FHD',
    select_quality_720p: '720p HD',
    select_shorts_true: 'Shorts Herunterladen',
    select_shorts_false: 'Shorts Ignorieren',
    channel_quality_title: 'Download-Qualität',
    channel_shorts_title: 'Shorts-Download-Status',
    channel_shorts_limit_title: 'Shorts-Dauerbegrenzung',
    channel_btn_sync_title: 'Kanal jetzt prüfen / RSS aktualisieren',
    channel_btn_update_logo_title: 'Logo aktualisieren',
    channel_btn_unfollow_title: 'Kanal entfolgen',
    shorts_limit_seconds: 's',
    shorts_limit_minutes: 'Min',
    inline_sub_color_title: 'Untertitel-Farbe',
    inline_sub_opacity_title: 'Untertitel-Deckkraft',
    inline_sub_size_title: 'Untertitel-Größe',
    library_title: 'Bibliothek & Verlauf',
    library_desc: 'Überwachen Sie die Warteschlange und den vollständigen Verlauf.',
    btn_open_downloads: 'Download-Ordner Öffnen',
    badge_active_download: 'Aktiver Download',
    queue_empty_title: 'Warteschlange Leer',
    queue_empty_desc: 'Keine aktiven Downloads.',
    active_download_progress: 'Fortschritt',
    active_download_size: 'Größe',
    active_download_eta: 'Verbleibend',
    active_download_cancel: 'Abbrechen',
    queue_title: 'Warteschlange',
    queue_empty: 'Keine wartenden Videos in der Warteschlange.',
    library_history_title: 'Bibliothek & Verlauf',
    filter_all_channels: 'Alle Kanäle',
    show_shorts: 'Shorts Anzeigen',
    view_grid: 'Karten',
    view_list: 'Einfache Liste',
    no_videos_filter: 'Keine Videoeinträge.',
    downloaded_title: 'Downloads',
    downloaded_desc: 'Erfolgreich heruntergeladene Videos für die Offline-Wiedergabe.',
    settings_title: 'Systemeinstellungen',
    settings_desc: 'Konfigurieren Sie Automatisierung, Qualität, Cookies und Präferenzen.',
    label_download_path: 'Download-Pfad',
    btn_select_folder: 'Ordner Auswählen',
    btn_test_folder: 'Ordner Testen',
    label_browser: 'Premium-Cookie-Browser',
    label_quality: 'Standard-Download-Qualität',
    label_merge_type: 'Download-Methode (FFmpeg)',
    label_interval: 'Überprüfungsintervall (Sekunden)',
    label_auto_download: 'Automatischer Download',
    label_write_thumbnail: 'Cover-Bild',
    label_show_shorts: 'Shorts-Videos',
    label_theme: 'UI-Theme',
    label_auto_delete: 'Videos automatisch löschen (Tage)',
    label_rss_limit: 'RSS-Limit (Videos)',
    label_settings_speed_limit: 'Maximale Geschwindigkeit (KB/s)',
    label_port: 'Portnummer',
    label_play_sounds: 'Audio-Benachrichtigungen',
    desc_play_sounds: 'Töne bei Download-Ereignissen abspielen',
    label_show_notifications: 'Desktop-Benachrichtigungen',
    desc_show_notifications: 'Desktop-Benachrichtigungen anzeigen, wenn Downloads starten/enden',
    label_auto_open_browser: 'Browser automatisch öffnen',
    desc_auto_open_browser: 'Localhost beim Start der Anwendung öffnen',
    btn_search_channel: 'Kanal Suchen',
    btn_add_channel: 'Kanal Folgen',
    desc_auto_download: 'Sofort herunterladen, wenn neue Videos erkannt werden',
    desc_write_thumbnail: 'Vorschaubilder mit herunterladen',
    desc_show_shorts: 'Shorts im Verlauf anzeigen',
    label_lang: 'App-Sprache',
    label_settings_player_type: 'Integrierter Player-Typ',
    desc_settings_player_type: 'Wählen Sie den Stil des integrierten Players.',
    opt_player_plyr: 'Plyr-Player',
    opt_player_artplayer: 'ArtPlayer-Player',
    opt_player_html5: 'Standard HTML5-Player (Schnell & Einfach - SponsorBlock Visuelle Zeitleisten nicht unterstützt)',
    label_sponsorblock: 'SponsorBlock (Player)',
    desc_sponsorblock: 'Sponsorierte Segmente oder Eigenwerbung während der Wiedergabe automatisch überspringen.',
    cookie_warning_title: 'Wichtiger Cookie-Warnhinweis:',
    cookie_warning_desc: 'Schließen Sie den ausgewählten Browser vor dem Herunterladen vollständig.',
    btn_save_settings: 'Einstellungen Speichern',
    modal_delete_title: 'Video aus Verlauf entfernen',
    modal_delete_desc: 'Möchten Sie dieses Video aus dem Verlauf löschen?',
    modal_delete_file_checkbox: 'Datei dauerhaft vom Computer löschen',
    modal_delete_btn: 'Löschen',
    modal_cancel_btn: 'Abbrechen',
    modal_player_title: 'Integrierter Videoplayer',
    tab_queue: 'Warteschlange',
    tab_queue_title: 'Steuerung der Warteschlange',
    tab_queue_desc: 'Überwachen Sie aktive Downloads und organisieren Sie Prioritäten.',
    btn_pause_queue: 'Warteschlange Pausieren',
    btn_resume_queue: 'Warteschlange Fortsetzen',
    label_queue_speed_limit: 'Geschwindigkeitsbegrenzung:',
    btn_speed_limit_set: 'Begrenzung Festlegen',
    active_progress: 'Fortschritt',
    active_size: 'Größe',
    active_eta: 'Verbleibend',
    queue_empty_title: 'Warteschlange im Standby',
    queue_empty_desc: 'Keine aktiven Downloads.',
    queue_list_title: 'Videos in Warteschlange',
    drag_drop_hint: 'Ziehen und Ablegen zum Neuordnen',
    queue_list_empty: 'Keine Videos in der Warteschlange.',
    settings_desc: 'Konfigurieren Sie die Optionen, den Cookie-Browser und den Download-Ordner.',
    settings_tab_general: 'Allgemeine Einstellungen',
    settings_tab_download: 'Download & Qualität',
    settings_tab_automation: 'Automatisierung & RSS',
    settings_tab_notifications: 'Cookies & Benachrichtigung',
    settings_tab_feedback: 'Feedback Senden',
    sort_btn_date_desc: 'Datum ▼',
    sort_btn_date_asc: 'Datum ▲',
    sort_btn_size_desc: 'Größe ▼',
    sort_btn_size_asc: 'Größe ▲',
    topbar_cookie_title: 'Cookies',
    topbar_quality_title: 'Qualität',
    topbar_disk_title_free: 'Frei',
    topbar_disk_title_folder: 'Größe',
    settings_version_title: 'Version',
    desc_download_path: 'Ordner, in dem Videos gespeichert werden.',
    desc_lang: 'Wählen Sie die Sprache für die Oberfläche und die Titel.',
    opt_theme_dark: 'Dunkles Theme',
    opt_theme_light: 'Helles Theme',
    desc_theme: 'Ändern Sie das Farbschema der Benutzeroberfläche hier.',
    desc_port: 'Anwendungsport (Erfordert Neustart).',
    opt_quality_best: 'Beste Qualität (Automatisch)',
    opt_quality_1080p: 'Maximal 1080p FHD',
    opt_quality_720p: 'Maximal 720p HD',
    desc_quality: 'Standardmäßig zu verwendende Qualität.',
    opt_merge_single: 'Einzelne Datei (Max 720p, kein ffmpeg)',
    opt_merge_merge: 'Zusammenführen (Hohe Auflösung, erfordert ffmpeg)',
    opt_merge_separate: 'Audio und Video separat herunterladen',
    desc_merge_type: 'FFmpeg ist für hohe Auflösungen erforderlich.',
    desc_speed_limit: 'Geschwindigkeit begrenzen (0 für unbegrenzt).',
    desc_alt_speed_limit: 'Alternative Geschwindigkeitsbegrenzung.',
    cli_info_title: 'Konsolen- und CLI-Befehle',
    cli_info_desc: "Sie können die Geschwindigkeitsbegrenzung über die Konsole oder das Terminal steuern (Sie können <code>HaYTooL YT Downloader.exe &lt;Befehl&gt;</code> oder <code>haytool &lt;Befehl&gt;</code> unter Windows verwenden):<br>• <b>Begrenzung Festlegen:</b> <code>HaYTooL YT Downloader.exe speed &lt;Wert&gt;</code><br>• <b>Begrenzung Ein/Aus:</b> <code>HaYTooL YT Downloader.exe speed off / on</code><br>• <b>Alternative Begrenzung:</b> <code>HaYTooL YT Downloader.exe altspeed &lt;Wert&gt;</code><br>• <b>Alternative Begrenzung Erzwingen (Turtle):</b> <code>HaYTooL YT Downloader.exe turtleon / turtleoff</code><br>• <b>Alternative Begrenzung Umschalten (Toggle):</b> <code>HaYTooL YT Downloader.exe toggle</code><br>• <b>Status Abfragen:</b> <code>HaYTooL YT Downloader.exe status</code>",
    cli_info_note: "(Geben Sie Befehle direkt in das Konsolenfenster ein: speed, toggle usw.)",
    desc_channel_check_interval: 'Wartezeit vor dem Überprüfen des nächsten Kanals.',
    desc_rss_limit: 'Anzahl der RSS-Videos pro Kanal.',
    desc_auto_delete: 'Nach wie vielen Tagen automatisch löschen? (0 zum Deaktivieren)',
    opt_browser_none: 'Keine Cookies Verwenden',
    desc_browser: 'Wählen Sie den Browser für den Premium-Zugriff aus.',
    settings_status_text: 'Änderungen werden sofort automatisch gespeichert.',
    connection_connecting: 'Verbindung: Verbinden...',
    connection_active: 'Verbindung: Aktiv',
    connection_lost: 'Verbindung: Getrennt',
    label_history_limit: 'Limit pro Kanal',
    desc_history_limit: 'Maximale Anzahl an Videos, die pro Kanal aufgelistet werden.',
    opt_limit_10: '10 Videos',
    opt_limit_20: '20 Videos (Empfohlen)',
    opt_limit_50: '50 Videos',
    opt_limit_100: '100 Videos',
    opt_limit_200: '200 Videos',
    label_data_management: 'Daten- & Backup-Verwaltung',
    desc_data_management: 'Sie können Ihre Kanalliste sichern oder aus einer Backup-Datei wiederherstellen.',
    btn_export_backup: 'Backup Exportieren',
    btn_import_backup: 'Backup Importieren',
    opt_import_append: 'An Vorhandenes Anfügen (Append)',
    opt_import_overwrite: 'Vollständig Überschreiben (Overwrite)',
    lbl_quick_filter: 'Schnellfilter:',
    filter_all: 'Alle',
    filter_today: 'Heute',
    filter_yesterday: 'Gestern',
    filter_last_2_days: 'Letzte 2 Tage',
    filter_last_3_days: 'Letzte 3 Tage',
    filter_last_4_days: 'Letzte 4 Tage',
    filter_last_5_days: 'Letzte 5 Tage',
    label_subtitle_color: 'Untertitel-Farbe',
    desc_subtitle_color: 'Wählen Sie die Untertitelfarbe in eingebetteten Videoplayern.',
    opt_sub_white: 'Weiß',
    opt_sub_yellow: 'Gelb',
    opt_sub_green: 'Grün',
    opt_sub_cyan: 'Cyan',
    opt_sub_magenta: 'Rosa',
    opt_sub_red: 'Rot',
    opt_sub_blue: 'Blau',
    opt_sub_orange: 'Orange',
    opt_sub_purple: 'Lila',
    opt_sub_black: 'Schwarz',
    opt_sub_gray: 'Grau',
    opt_sub_lightyellow: 'Hellgelb',
    inline_btn_youtube: 'Auf YouTube öffnen',
    inline_btn_system: 'Im Systemplayer öffnen',
    inline_btn_folder: 'Ordner öffnen',
    inline_btn_comments: 'Kommentare anzeigen',
    inline_btn_translate_sub: 'Ins Türkische übersetzen',
    opt_sub_opacity_0: 'Transparent (%0)',
    opt_sub_opacity_10: 'Deckkraft (%10)',
    opt_sub_opacity_20: 'Deckkraft (%20)',
    opt_sub_opacity_30: 'Deckkraft (%30)',
    opt_sub_opacity_40: 'Deckkraft (%40)',
    opt_sub_opacity_50: 'Deckkraft (%50)',
    opt_sub_opacity_60: 'Deckkraft (%60)',
    opt_sub_opacity_70: 'Deckkraft (%70)',
    opt_sub_opacity_80: 'Deckkraft (%80)',
    opt_sub_opacity_90: 'Deckkraft (%90)',
    opt_sub_opacity_95: 'Deckkraft (%95)',
    opt_sub_opacity_100: 'Undurchsichtig (%100)',
    overlay_translating_title: 'Untertitel übersetzen...',
    overlay_translating_desc: 'Bitte warten, der Track wird Zeile für Zeile über die API übersetzt...',
    modal_translate_title: 'Untertitel Übersetzung',
    modal_translate_no_subs: 'Keine heruntergeladenen Untertitel für dieses Video gefunden. Sie benötigen mindestens eine heruntergeladene Untertitelspur zum Übersetzen.',
    modal_translate_source: 'Quelluntertitel',
    modal_translate_target: 'Zielsprache',
    btn_translate_action: 'Übersetzen',
    select_auto_download_title: 'Auto-Download-Status',
    select_auto_download_true: 'Auto-Download',
    select_auto_download_false: 'Kein Auto-Download',
    sponsorblock_active: 'SponsorBlock Aktiv (Klicken, um vorübergehend zu deaktivieren)',
    sponsorblock_disabled: 'SponsorBlock Deaktiviert (Klicken, um wieder zu aktivieren)',
    lbl_history_only_no_auto_download: 'Auto-Download Aus',
    lbl_history_only_not_downloaded: 'Nur nicht heruntergeladen',
    sponsorblock_active_toast: 'SponsorBlock Aktiv',
    sponsorblock_active_toast_desc: 'Sponsor-Segmente werden automatisch übersprungen',
    sponsorblock_disabled_toast: 'SponsorBlock Deaktiviert',
    sponsorblock_disabled_toast_desc: 'Das Überspringen von Sponsor-Segmenten ist vorübergehend pausiert'
  },
  pt: {
    status_merging: 'Mesclando (FFmpeg)...',
    premium_automation: 'Automatização Premium',
    tab_library: 'Biblioteca',
    tab_downloaded: 'Downloads',
    tab_channels: 'Canais',
    tab_settings: 'Ajustes',
    cookie_yes: 'Cookies: Sim',
    cookie_no: 'Cookies: Não',
    cookie_status_active: 'Cookies Ativos e Válidos',
    cookie_status_locked: 'Cookies Bloqueados ou Inválidos',
    cookie_status_none: 'Cookies Desativados',
    channels_title: 'Canais',
    channels_desc: 'Gerencie os canais do YouTube que deseja monitorar e baixar automaticamente.',
    input_channel_placeholder: 'Insira o link ou usuário do canal (Ex: @BarisOzcan)',
    btn_follow_channel: 'Seguir Canal',
    btn_update_all_logos: 'Atualizar Logos',
    empty_channels_title: 'Nenhum canal monitorado ainda',
    empty_channels_desc: 'Adicione canais inserindo um link ou usuário do YouTube acima.',
    select_quality_default: 'Qualidade Padrão',
    select_quality_best: 'A Melhor',
    select_quality_1080p: '1080p FHD',
    select_quality_720p: '720p HD',
    select_shorts_true: 'Baixar Shorts',
    select_shorts_false: 'Ignorar Shorts',
    channel_quality_title: 'Qualidade de Download',
    channel_shorts_title: 'Status de Download de Shorts',
    channel_shorts_limit_title: 'Limite de Duração de Shorts',
    channel_btn_sync_title: 'Verificar Canal Agora / Atualizar RSS',
    channel_btn_update_logo_title: 'Atualizar Logo',
    channel_btn_unfollow_title: 'Deixar de Seguir Canal',
    shorts_limit_seconds: 's',
    shorts_limit_minutes: 'min',
    inline_sub_color_title: 'Cor da Legenda',
    inline_sub_opacity_title: 'Opacidade da Legenda',
    inline_sub_size_title: 'Tamanho da Legenda',
    library_title: 'Biblioteca e Histórico',
    library_desc: 'Monitore a fila de downloads e o histórico completo.',
    btn_open_downloads: 'Abrir Pasta de Downloads',
    badge_active_download: 'Download Ativo',
    queue_empty_title: 'Fila Vazia',
    queue_empty_desc: 'Sem downloads ativos.',
    active_download_progress: 'Progresso',
    active_download_size: 'Tamanho',
    active_download_eta: 'Restante',
    active_download_cancel: 'Cancelar',
    queue_title: 'Fila de Download',
    queue_empty: 'Nenhum vídeo aguardando na fila.',
    library_history_title: 'Biblioteca e Histórico',
    filter_all_channels: 'Todos os Canais',
    show_shorts: 'Mostrar Shorts',
    view_grid: 'Cartões',
    view_list: 'Lista Simples',
    no_videos_filter: 'Sem registros de vídeo.',
    downloaded_title: 'Downloads',
    downloaded_desc: 'Vídeos baixados prontos para assistir offline.',
    settings_title: 'Ajustes do Sistema',
    settings_desc: 'Configure automatização, qualidade, cookies e preferências.',
    label_download_path: 'Caminho da Pasta de Downloads',
    btn_select_folder: 'Selecionar Pasta',
    btn_test_folder: 'Testar Pasta',
    label_browser: 'Navegador de Cookies Premium',
    label_quality: 'Qualidade de Download Padrão',
    label_merge_type: 'Método de Download (FFmpeg)',
    label_interval: 'Intervalo de Verificação (Segundos)',
    label_auto_download: 'Download Automático',
    label_write_thumbnail: 'Imagem de Capa',
    label_show_shorts: 'Vídeos Shorts',
    label_theme: 'Tema da Interface',
    label_auto_delete: 'Exclusão Automática (Dias)',
    label_rss_limit: 'Limite de RSS (Vídeos)',
    label_settings_speed_limit: 'Velocidade Máxima de Download (KB/s)',
    label_port: 'Número da Porta',
    label_play_sounds: 'Notificações de Áudio',
    desc_play_sounds: 'Tocar sons para eventos de download',
    label_show_notifications: 'Notificações de Área de Trabalho',
    desc_show_notifications: 'Mostrar notificações quando os downloads começarem/terminarem',
    label_auto_open_browser: 'Abrir Navegador Automaticamente',
    desc_auto_open_browser: 'Abrir localhost ao iniciar a aplicação',
    btn_search_channel: 'Buscar Canal',
    btn_add_channel: 'Seguir Canal',
    desc_auto_download: 'Baixar imediatamente ao detectar novos vídeos',
    desc_write_thumbnail: 'Baixar miniaturas junto com os vídeos',
    desc_show_shorts: 'Mostrar Shorts no histórico',
    label_lang: 'Idioma da App',
    label_settings_player_type: 'Tipo de Reprodutor Integrado',
    desc_settings_player_type: 'Selecione o estilo do reprodutor integrado.',
    opt_player_plyr: 'Reprodutor Plyr',
    opt_player_artplayer: 'Reprodutor ArtPlayer',
    opt_player_html5: 'Reprodutor HTML5 Padrão (Rápido e simples - Não suporta linhas de tempo visuais do SponsorBlock)',
    label_sponsorblock: 'SponsorBlock (Reprodutor)',
    desc_sponsorblock: 'Pular automaticamente segmentos patrocinados ou de auto-promoção durante a reprodução.',
    cookie_warning_title: 'Aviso Importante sobre Cookies:',
    cookie_warning_desc: 'Feche completamente o navegador selecionado antes de baixar.',
    btn_save_settings: 'Salvar Configurações',
    modal_delete_title: 'Remover Vídeo do Histórico',
    modal_delete_desc: 'Tem certeza que deseja remover este vídeo do histórico?',
    modal_delete_file_checkbox: 'Excluir permanentemente o arquivo do computador',
    modal_delete_btn: 'Excluir',
    modal_cancel_btn: 'Cancelar',
    modal_player_title: 'Reprodutor de Vídeo Integrado',
    tab_queue: 'Fila',
    tab_queue_title: 'Controle da Fila de Downloads',
    tab_queue_desc: 'Monitore downloads ativos e organize a prioridade.',
    btn_pause_queue: 'Pausar Fila',
    btn_resume_queue: 'Retomar Fila',
    label_queue_speed_limit: 'Limite de Velocidade:',
    btn_speed_limit_set: 'Definir Limite',
    active_progress: 'Progresso',
    active_size: 'Tamanho',
    active_eta: 'Restante',
    queue_empty_title: 'Fila em Espera',
    queue_empty_desc: 'Sem downloads ativos.',
    queue_list_title: 'Vídeos na Fila',
    drag_drop_hint: 'Arraste e solte para reordenar a fila',
    queue_list_empty: 'Sem vídeos na fila.',
    settings_desc: 'Configure opções de automação, navegador de cookies e pasta de downloads.',
    settings_tab_general: 'Configurações Gerais',
    settings_tab_download: 'Download & Qualidade',
    settings_tab_automation: 'Automação & RSS',
    settings_tab_notifications: 'Cookies & Notificação',
    settings_tab_feedback: 'Enviar Comentários',
    sort_btn_date_desc: 'Data ▼',
    sort_btn_date_asc: 'Data ▲',
    sort_btn_size_desc: 'Tamanho ▼',
    sort_btn_size_asc: 'Tamanho ▲',
    topbar_cookie_title: 'Cookies',
    topbar_quality_title: 'Qualidade',
    topbar_disk_title_free: 'Livre',
    topbar_disk_title_folder: 'Tamanho',
    settings_version_title: 'Versão',
    desc_download_path: 'Pasta onde os vídeos serão salvos.',
    desc_lang: 'Selecione o idioma da interface e dos títulos.',
    opt_theme_dark: 'Tema Escuro',
    opt_theme_light: 'Tema Claro',
    desc_theme: 'Altere o tema de cor da interface aqui.',
    desc_port: 'Porta da aplicação (Requer reiniciar).',
    opt_quality_best: 'Melhor Qualidade (Automático)',
    opt_quality_1080p: 'Máximo 1080p FHD',
    opt_quality_720p: 'Máximo 720p HD',
    desc_quality: 'Qualidade padrão a ser usada.',
    opt_merge_single: 'Arquivo Único (Max 720p, sem ffmpeg)',
    opt_merge_merge: 'Fusão Automática (Alta resolução, requer ffmpeg)',
    opt_merge_separate: 'Baixar Áudio e Vídeo Separadamente',
    desc_merge_type: 'O FFmpeg é necessário para fundir altas resoluções.',
    desc_speed_limit: 'Limite de velocidade (0 para ilimitado).',
    desc_alt_speed_limit: 'Limite de velocidade alternativo.',
    cli_info_title: 'Comandos de Console e CLI',
    cli_info_desc: "Pode controlar os limites de velocidade a partir da consola ou do terminal/CLI (pode utilizar o comando <code>HaYTooL YT Downloader.exe &lt;comando&gt;</code> ou <code>haytool &lt;comando&gt;</code> no Windows):<br>• <b>Definir Limite:</b> <code>HaYTooL YT Downloader.exe speed &lt;valor&gt;</code><br>• <b>Limite On/Off:</b> <code>HaYTooL YT Downloader.exe speed off / on</code><br>• <b>Limite Alt:</b> <code>HaYTooL YT Downloader.exe altspeed &lt;valor&gt;</code><br>• <b>Limite Alt Forçado (Turtle):</b> <code>HaYTooL YT Downloader.exe turtleon / turtleoff</code><br>• <b>Alternar Perfil Alt (Toggle):</b> <code>HaYTooL YT Downloader.exe toggle</code><br>• <b>Consultar Estado:</b> <code>HaYTooL YT Downloader.exe status</code>",
    cli_info_note: "(Insira comandos diretamente no console: speed, toggle, etc.)",
    desc_channel_check_interval: 'Tempo para verificar o próximo canal.',
    desc_rss_limit: 'Número de vídeos RSS a verificar por canal.',
    desc_auto_delete: 'Excluir automaticamente após dias (0 para desativar).',
    opt_browser_none: 'Não Usar Cookies',
    desc_browser: 'Selecione o navegador para acessar ao Premium.',
    settings_status_text: 'As alterações são salvas automaticamente.',
    connection_connecting: 'Conexão: Conectando...',
    connection_active: 'Conexão: Ativa',
    connection_lost: 'Conexão: Perdida',
    label_history_limit: 'Limite por Canal',
    desc_history_limit: 'Limite máximo de vídeos a listar por canal.',
    opt_limit_10: '10 Vídeos',
    opt_limit_20: '20 Vídeos (Recomendado)',
    opt_limit_50: '50 Vídeos',
    opt_limit_100: '100 Vídeos',
    opt_limit_200: '200 Vídeos',
    label_data_management: 'Gestão de Dados e Cópias',
    desc_data_management: 'Pode exportar a sua lista de canais ou restaurá-la a partir de um ficheiro de cópia de segurança.',
    btn_export_backup: 'Exportar Cópia',
    btn_import_backup: 'Importar Cópia',
    opt_import_append: 'Adicionar ao Existente (Append)',
    opt_import_overwrite: 'Substituir Completamente (Overwrite)',
    lbl_quick_filter: 'Filtro Rápido:',
    filter_all: 'Todos',
    filter_today: 'Hoje',
    filter_yesterday: 'Ontem',
    filter_last_2_days: 'Últimos 2 Dias',
    filter_last_3_days: 'Últimos 3 Dias',
    filter_last_4_days: 'Últimos 4 Dias',
    filter_last_5_days: 'Últimos 5 Dias',
    label_subtitle_color: 'Cor da Legenda',
    desc_subtitle_color: 'Selecione a cor da legenda nos players de vídeo incorporados.',
    opt_sub_white: 'Branco',
    opt_sub_yellow: 'Amarelo',
    opt_sub_green: 'Verde',
    opt_sub_cyan: 'Ciano',
    opt_sub_magenta: 'Rosa',
    opt_sub_red: 'Vermelho',
    opt_sub_blue: 'Azul',
    opt_sub_orange: 'Laranja',
    opt_sub_purple: 'Roxo',
    opt_sub_black: 'Preto',
    opt_sub_gray: 'Cinza',
    opt_sub_lightyellow: 'Amarelo Claro',
    inline_btn_youtube: 'Abrir no YouTube',
    inline_btn_system: 'Abrir no Reprodutor do Sistema',
    inline_btn_folder: 'Abrir Pasta',
    inline_btn_comments: 'Mostrar Comentários',
    inline_btn_translate_sub: 'Traduzir para o Turco',
    opt_sub_opacity_0: 'Transparente (%0)',
    opt_sub_opacity_10: 'Opacidade (%10)',
    opt_sub_opacity_20: 'Opacidade (%20)',
    opt_sub_opacity_30: 'Opacidade (%30)',
    opt_sub_opacity_40: 'Opacidade (%40)',
    opt_sub_opacity_50: 'Opacidade (%50)',
    opt_sub_opacity_60: 'Opacidade (%60)',
    opt_sub_opacity_70: 'Opacidade (%70)',
    opt_sub_opacity_80: 'Opacidade (%80)',
    opt_sub_opacity_90: 'Opacidade (%90)',
    opt_sub_opacity_95: 'Opacidade (%95)',
    opt_sub_opacity_100: 'Sólido (%100)',
    overlay_translating_title: 'Traduzindo legendas...',
    overlay_translating_desc: 'Aguarde, traduzindo a faixa linha por linha usando a API...',
    modal_translate_title: 'Tradução de Legendas',
    modal_translate_no_subs: 'Nenhuma legenda baixada encontrada para este vídeo. Você precisa de pelo menos uma faixa de legenda baixada para traduzir.',
    modal_translate_source: 'Legenda de Origem',
    modal_translate_target: 'Idioma de Destino',
    btn_translate_action: 'Traduzir',
    select_auto_download_title: 'Estado de download automático',
    select_auto_download_true: 'Download automático',
    select_auto_download_false: 'Sem download automático',
    sponsorblock_active: 'SponsorBlock Ativo (Clique para desativar temporariamente)',
    sponsorblock_disabled: 'SponsorBlock Desactivado (Clique para reativar)',
    lbl_history_only_no_auto_download: 'Download Auto. Desativado',
    lbl_history_only_not_downloaded: 'Apenas não baixados',
    sponsorblock_active_toast: 'SponsorBlock Ativo',
    sponsorblock_active_toast_desc: 'Os segmentos patrocinados serão ignorados automaticamente',
    sponsorblock_disabled_toast: 'SponsorBlock Desactivado',
    sponsorblock_disabled_toast_desc: 'A omissão de segmentos patrocinados está pausada temporariamente'
  },
  ar: {
    status_merging: 'دمج (FFmpeg)...',
    premium_automation: 'التحكم التلقائي المميز',
    tab_library: 'المكتبة',
    tab_downloaded: 'التنزيلات',
    tab_channels: 'القنوات',
    tab_settings: 'الإعدادات',
    cookie_yes: 'ملفات تعريف الارتباط: نعم',
    cookie_no: 'ملفات تعريف الارتباط: لا',
    cookie_status_active: 'ملفات تعريف الارتباط نشطة وصالحة',
    cookie_status_locked: 'ملفات تعريف الارتباط مقفلة أو غير صالحة',
    cookie_status_none: 'ملفات تعريف الارتباط غير مستخدمة',
    channels_title: 'القنوات',
    channels_desc: 'إدارة قنوات YouTube التي تريد مراقبتها وتنزيل مقاطع الفيديو منها تلقائيًا.',
    input_channel_placeholder: 'أدخل رابط القناة أو اسم المستخدم (مثال: BarisOzcan@)',
    btn_follow_channel: 'متابعة القناة',
    btn_update_all_logos: 'تحديث جميع الشعارات',
    empty_channels_title: 'لا توجد قنوات مراقبة بعد',
    empty_channels_desc: 'يمكنك إضافة قنوات عن طريق إدخال رابط أو اسم مستخدم YouTube أعلاه.',
    select_quality_default: 'الجودة الافتراضية',
    select_quality_best: 'الأعلى',
    select_quality_1080p: '1080p FHD',
    select_quality_720p: '720p HD',
    select_shorts_true: 'تنزيل مقاطع Shorts',
    select_shorts_false: 'تجاهل مقاطع Shorts',
    channel_quality_title: 'جودة التنزيل',
    channel_shorts_title: 'حالة تنزيل مقاطع Shorts',
    channel_shorts_limit_title: 'حد مدة مقاطع Shorts',
    channel_btn_sync_title: 'فحص القناة الآن / تحديث RSS',
    channel_btn_update_logo_title: 'تحديث الشعار',
    channel_btn_unfollow_title: 'إلغاء متابعة القناة',
    shorts_limit_seconds: 'ثانية',
    shorts_limit_minutes: 'دقيقة',
    inline_sub_color_title: 'لون الترجمة',
    inline_sub_opacity_title: 'شفافية الترجمة',
    inline_sub_size_title: 'حجم الترجمة',
    library_title: 'المكتبة والسجل',
    library_desc: 'مراقبة قائمة انتظار التنزيل والتقدم النشط والسجل الكامل.',
    btn_open_downloads: 'فتح مجلد التنزيلات',
    badge_active_download: 'تنزيل نشط',
    queue_empty_title: 'قائمة الانتظار فارغة',
    queue_empty_desc: 'لا يوجد تنزيل نشط حالياً.',
    active_download_progress: 'التقدم',
    active_download_size: 'الحجم',
    active_download_eta: 'المتبقي',
    active_download_cancel: 'إلغاء',
    queue_title: 'قائمة تنزيل',
    queue_empty: 'لا توجد مقاطع فيديو قيد الانتظار في قائمة الانتظار.',
    library_history_title: 'المكتبة والسجل',
    filter_all_channels: 'جميع القنوات',
    show_shorts: 'عرض Shorts',
    view_grid: 'بطاقات',
    no_videos_filter: 'لا توجد سجلات فيديو تطابق الفلتر.',
    downloaded_title: 'التنزيلات',
    downloaded_desc: 'مقاطع الفيديو التي تم تنزيلها بنجاح وجاهزة للتشغيل دون اتصال بالإنترنت.',
    settings_title: 'إعدادات النظام',
    settings_desc: 'تكوين خيارات التشغيل التلقائي وجودة التنزيل ومتصفح ملفات تعريف الارتباط وتفضيلات النظام.',
    label_download_path: 'مسار مجلد التنزيلات',
    btn_select_folder: 'اختر مجلد',
    btn_test_folder: 'اختبار المجلد',
    label_browser: 'متصفح ملفات تعريف الارتباط المميز',
    label_quality: 'جودة التنزيل الافتراضية',
    label_merge_type: 'طريقة التنزيل (FFmpeg / بنية الملف)',
    label_interval: 'فترة فحص القناة (بالثواني)',
    label_auto_download: 'تنزيل تلقائي',
    label_write_thumbnail: 'صورة الغلاف',
    label_show_shorts: 'مقاطع فيديو Shorts',
    label_theme: 'مظهر واجهة المستخدم',
    label_auto_delete: 'حذف مقاطع الفيديو تلقائيًا (أيام)',
    label_rss_limit: 'حد فحص RSS (مقاطع فيديو)',
    label_settings_speed_limit: 'السرعة القصوى للتنزيل (كيلوبايت/ثانية)',
    label_port: 'رقم المنفذ',
    label_play_sounds: 'التنبيهات الصوتية',
    desc_play_sounds: 'تشغيل تنبيهات صوتية لأحداث تنزيل الفيديو',
    label_show_notifications: 'تنبيهات سطح المكتب',
    desc_show_notifications: 'عرض تنبيهات سطح المكتب عند بدء التنزيل وانتهائه',
    label_auto_open_browser: 'فتح المتصفح تلقائياً',
    desc_auto_open_browser: 'فتح localhost في المتصفح تلقائياً عند بدء التطبيق',
    btn_search_channel: 'بحث عن قناة',
    btn_add_channel: 'متابعة القناة',
    desc_auto_download: 'بدء التنزيل فورًا عند اكتشاف مقاطع فيديو جديدة',
    desc_write_thumbnail: 'تنزيل صور غلاف الفيديو (الصور المصغرة) معها',
    desc_show_shorts: 'عرض مقاطع فيديو Shorts في قائمة مكتبة السجل',
    label_lang: 'لغة التطبيق',
    label_settings_player_type: 'نوع المشغل المدمج',
    desc_settings_player_type: 'اختر نمط واجهة مشغل الفيديو المدمج.',
    opt_player_plyr: 'مشغل Plyr',
    opt_player_artplayer: 'مشغل ArtPlayer',
    opt_player_html5: 'مشغل HTML5 القياسي (سريع وبسيط - لا يدعم الأشرطة المرئية لـ SponsorBlock)',
    label_sponsorblock: 'SponsorBlock (المشغل)',
    desc_sponsorblock: 'تخطي المقاطع الإعلانية أو الترويجية تلقائيًا أثناء التشغيل.',
    cookie_warning_title: 'تحذير هام بشأن قفل ملفات تعريف الارتباط:',
    cookie_warning_desc: 'يرجى إغلاق المتصفح المختار تمامًا قبل التنزيل لتجنب أخطاء قفل قاعدة البيانات.',
    btn_save_settings: 'حفظ الإعدادات',
    modal_delete_title: 'إزالة الفيديو من السجل',
    modal_delete_desc: 'هل أنت متأكد من رغبتك في إزالة هذا الفيديو من السجل؟',
    modal_delete_file_checkbox: 'حذف ملف الفيديو الذي تم تنزيله نهائياً من الكمبيوتر أيضاً',
    modal_delete_btn: 'حذف',
    modal_cancel_btn: 'إلغاء',
    modal_player_title: 'مشغل الفيديو المدمج',
    tab_queue: 'قائمة الانتظار',
    tab_queue_title: 'التحكم في قائمة انتظار التنزيل',
    tab_queue_desc: 'مراقبة التنزيلات النشطة وسحب وإفلات مقاطع الفيديو لتغيير أولويتها.',
    btn_pause_queue: 'إيقاف مؤقت لقائمة الانتظار',
    btn_resume_queue: 'استئناف قائمة الانتظار',
    label_queue_speed_limit: 'حد السرعة:',
    btn_speed_limit_set: 'تعيين الحد',
    active_progress: 'التقدم',
    active_size: 'الحجم',
    active_eta: 'الوقت المتبقي',
    queue_empty_title: 'قائمة الانتظار في وضع الاستعداد',
    queue_empty_desc: 'لا يوجد تنزيل نشط.',
    queue_list_title: 'فيديوهات قائمة الانتظار',
    drag_drop_hint: 'السحب والإفلات لإعادة ترتيب قائمة الانتظار',
    queue_list_empty: 'لا توجد مقاطع فيديو تنتظر في قائمة الانتظار.',
    settings_desc: 'تكوين خيارات التشغيل التلقائي، ومتصفح ملفات تعريف الارتباط، ومجلد التنزيلات.',
    settings_tab_general: 'الإعدادات العامة',
    settings_tab_download: 'التنزيل والجودة',
    settings_tab_automation: 'التشغيل التلقائي و RSS',
    settings_tab_notifications: 'ملفات تعريف الارتباط والتنبيهات',
    settings_tab_feedback: 'إرسال ملاحظات',
    sort_btn_date_desc: 'التاريخ ▼',
    sort_btn_date_asc: 'التاريخ ▲',
    sort_btn_size_desc: 'الحجم ▼',
    sort_btn_size_asc: 'الحجم ▲',
    topbar_cookie_title: 'ملفات تعريف الارتباط',
    topbar_quality_title: 'الجودة',
    topbar_disk_title_free: 'خالي',
    topbar_disk_title_folder: 'الحجم',
    settings_version_title: 'الإصدار',
    desc_download_path: 'مجلد حفظ مقاطع الفيديو على جهاز الكمبيوتر الخاص بك.',
    desc_lang: 'اختر لغة واجهة المستخدم ولغة عناوين الفيديو.',
    opt_theme_dark: 'مظهر داكن',
    opt_theme_light: 'مظهر فاتح',
    desc_theme: 'يمكنك تغيير مظهر لون واجهة المستخدم من هنا.',
    desc_port: 'منفذ التطبيق (يتطلب إعادة التشغيل).',
    opt_quality_best: 'أعلى جودة (تلقائي)',
    opt_quality_1080p: 'الحد الأقصى 1080p FHD',
    opt_quality_720p: 'الحد الأقصى 720p HD',
    desc_quality: 'الجودة الافتراضية التي سيتم استخدامها.',
    opt_merge_single: 'ملف جاهز واحد (720p كحد أقصى، لا يتطلب ffmpeg)',
    opt_merge_merge: 'دمج تلقائي (دقة عالية، يتطلب ffmpeg)',
    opt_merge_separate: 'تنزيل الصوت والفيديو بشكل منفصل',
    desc_merge_type: 'يتطلب FFmpeg لدمج الدقة العالية في ملف واحد.',
    desc_speed_limit: 'حد السرعة (0 لغير محدود).',
    desc_alt_speed_limit: 'حد السرعة البديل.',
    cli_info_title: 'أوامر وحدة التحكم و CLI',
    cli_info_desc: "يمكنك التحكم في حدود السرعة من خلال وحدة التحكم أو موجه الأوامر (يمكنك استخدام <code>HaYTooL YT Downloader.exe &lt;الأمر&gt;</code> أو <code>haytool &lt;الأمر&gt;</code> على نظام Windows):<br>• <b>تعيين السرعة:</b> <code>HaYTooL YT Downloader.exe speed &lt;القيمة&gt;</code><br>• <b>تشغيل/إيقاف الحد:</b> <code>HaYTooL YT Downloader.exe speed off / on</code><br>• <b>الحد البديل:</b> <code>HaYTooL YT Downloader.exe altspeed &lt;القيمة&gt;</code><br>• <b>تشغيل/إيقاف الحد البديل (السلحفاة):</b> <code>HaYTooL YT Downloader.exe turtleon / turtleoff</code><br>• <b>تبديل ملف التعريف البديل (Toggle):</b> <code>HaYTooL YT Downloader.exe toggle</code><br>• <b>الاستعلام عن الحالة:</b> <code>HaYTooL YT Downloader.exe status</code>",
    cli_info_note: "(أدخل الأوامر مباشرة في نافذة وحدة التحكم: speed ، toggle ، إلخ.)",
    desc_channel_check_interval: 'وقت الانتظار لفحص القناة التالية.',
    desc_rss_limit: 'عدد مقاطع الفيديو RSS التي يتم فحصها لكل قناة.',
    desc_auto_delete: 'حذف تلقائي بعد أيام (0 للتعطيل).',
    opt_browser_none: 'عدم استخدام ملفات تعريف الارتباط',
    desc_browser: 'اختر المتصفح للوصول إلى الحساب المميز.',
    settings_status_text: 'يتم حفظ التغييرات تلقائيًا على الفور.',
    connection_connecting: 'الاتصال: جاري الاتصال...',
    connection_active: 'الاتصال: نشط',
    connection_lost: 'الاتصال: مقطوع',
    label_history_limit: 'الحد لكل قناة',
    desc_history_limit: 'الحد الأقصى لمقاطع الفيديو التي يتم سردها لكل قناة.',
    opt_limit_10: '10 مقاطع فيديو',
    opt_limit_20: '20 مقاطع فيديو (موصى به)',
    opt_limit_50: '50 مقاطع فيديو',
    opt_limit_100: '100 مقاطع فيديو',
    opt_limit_200: '200 مقاطع فيديو',
    label_data_management: 'إدارة البيانات والنسخ الاحتياطي',
    desc_data_management: 'يمكنك تصدير قائمة قنواتك أو استعادتها من ملف نسخة احتياطية.',
    btn_export_backup: 'تصدير النسخة الاحتياطية',
    btn_import_backup: 'استيراد النسخة الاحتياطية',
    opt_import_append: 'إضافة إلى الموجود (Append)',
    opt_import_overwrite: 'الكتابة فوق الكل (Overwrite)',
    lbl_quick_filter: 'تصفية سريعة:',
    filter_all: 'الكل',
    filter_today: 'اليوم',
    filter_yesterday: 'أمس',
    filter_last_2_days: 'آخر يومين',
    filter_last_3_days: 'آخر 3 أيام',
    filter_last_4_days: 'آخر 4 أيام',
    filter_last_5_days: 'آخر 5 أيام',
    label_subtitle_color: 'لون الترجمة',
    desc_subtitle_color: 'اختر لون الترجمة في مشغلات الفيديو المدمجة.',
    opt_sub_white: 'أبيض',
    opt_sub_yellow: 'أصفر',
    opt_sub_green: 'أخضر',
    opt_sub_cyan: 'سماوي',
    opt_sub_magenta: 'وردي',
    opt_sub_red: 'أحمر',
    opt_sub_blue: 'أزرق',
    opt_sub_orange: 'برتقالي',
    opt_sub_purple: 'أرجواني',
    opt_sub_black: 'أسود',
    opt_sub_gray: 'رمادي',
    opt_sub_lightyellow: 'أصفر فاتح',
    inline_btn_youtube: 'فتح في YouTube',
    inline_btn_system: 'فتح في مشغل النظام',
    inline_btn_folder: 'فتح المجلد',
    inline_btn_comments: 'عرض التعليقات',
    inline_btn_translate_sub: 'ترجمة إلى التركية',
    opt_sub_opacity_0: 'شفاف (%0)',
    opt_sub_opacity_10: 'شفافية (%10)',
    opt_sub_opacity_20: 'شفافية (%20)',
    opt_sub_opacity_30: 'شفافية (%30)',
    opt_sub_opacity_40: 'شفافية (%40)',
    opt_sub_opacity_50: 'شفافية (%50)',
    opt_sub_opacity_60: 'شفافية (%60)',
    opt_sub_opacity_70: 'شفافية (%70)',
    opt_sub_opacity_80: 'شفافية (%80)',
    opt_sub_opacity_90: 'شفافية (%90)',
    opt_sub_opacity_95: 'شفافية (%95)',
    opt_sub_opacity_100: 'معتم (%100)',
    overlay_translating_title: 'ترجمة الترجمة المصاحبة...',
    overlay_translating_desc: 'يرجى الانتظار، جاري ترجمة المسار سطرًا بسطر باستخدام واجهة برمجة التطبيقات...',
    modal_translate_title: 'ترجمة الترجمة المصاحبة',
    modal_translate_no_subs: 'لم يتم العثور على ترجمات مصاحبة تم تنزيلها لهذا الفيديو. تحتاج إلى مسار ترجمة مصاحبة واحد على الأقل تم تنزيله لترجمته.',
    modal_translate_source: 'الترجمة المصاحبة المصدر',
    modal_translate_target: 'اللغة الهدف',
    btn_translate_action: 'ترجمة',
    select_auto_download_title: 'حالة التنزيل التلقائي',
    select_auto_download_true: 'تنزيل تلقائي',
    select_auto_download_false: 'بدون تنزيل تلقائي',
    sponsorblock_active: 'SponsorBlock نشط (انقر للتعطيل مؤقتًا)',
    sponsorblock_disabled: 'SponsorBlock معطل (انقر للتفعيل)',
    lbl_history_only_no_auto_download: 'تعطيل التنزيل التلقائي',
    lbl_history_only_not_downloaded: 'غير المحملة فقط',
    sponsorblock_active_toast: 'SponsorBlock نشط',
    sponsorblock_active_toast_desc: 'سيتم تخطي الأقسام الممولة تلقائيًا',
    sponsorblock_disabled_toast: 'SponsorBlock معطل',
    sponsorblock_disabled_toast_desc: 'تم إيقاف تخطي الأقسام الممولة مؤقتًا'
  },
  ru: {
    status_merging: 'Слияние (FFmpeg)...',
    premium_automation: 'Премиум Автоматизация',
    tab_library: 'Библиотека',
    tab_downloaded: 'Загрузки',
    tab_channels: 'Каналы',
    tab_settings: 'Настройки',
    cookie_yes: 'Куки: Да',
    cookie_no: 'Куки: Нет',
    cookie_status_active: 'Куки активны и действительны',
    cookie_status_locked: 'Куки заблокированы или недействительны',
    cookie_status_none: 'Куки отключены',
    channels_title: 'Каналы',
    channels_desc: 'Управление YouTube-каналами, видео с которых вы хотите скачивать автоматически.',
    input_channel_placeholder: 'Введите ссылку на канал YouTube или имя пользователя (например, @BarisOzcan или youtube.com/@GezenAdam)',
    btn_follow_channel: 'Подписаться на канал',
    btn_update_all_logos: 'Обновить все логотипы',
    empty_channels_title: 'Нет отслеживаемых каналов',
    empty_channels_desc: 'Вы можете добавить каналы, введя ссылку на канал YouTube или имя пользователя в форму выше.',
    select_quality_default: 'Качество по умолчанию',
    select_quality_best: 'Максимальное',
    select_quality_1080p: '1080p FHD',
    select_quality_720p: '720p HD',
    select_shorts_true: 'Скачивать Shorts',
    select_shorts_false: 'Игнорировать Shorts',
    channel_quality_title: 'Качество загрузки',
    channel_shorts_title: 'Статус загрузки Shorts',
    channel_shorts_limit_title: 'Лимит длительности Shorts',
    channel_btn_sync_title: 'Проверить канал сейчас / Обновить RSS',
    channel_btn_update_logo_title: 'Обновить логотип',
    channel_btn_unfollow_title: 'Отписаться от канала',
    shorts_limit_seconds: 'сек',
    shorts_limit_minutes: 'мин',
    inline_sub_color_title: 'Цвет субтитров',
    inline_sub_opacity_title: 'Прозрачность субтитров',
    inline_sub_size_title: 'Размер субтитров',
    library_title: 'Библиотека и история',
    library_desc: 'Отслеживайте очередь загрузки, текущий прогресс и полную историю в одном месте.',
    btn_open_downloads: 'Открыть папку загрузок',
    badge_active_download: 'Активная загрузка',
    queue_empty_title: 'Очередь пуста',
    queue_empty_desc: 'Активных загрузок нет. Новые видео будут загружаться автоматически при публикации.',
    active_download_progress: 'Прогресс',
    active_download_size: 'Размер',
    active_download_eta: 'Осталось',
    active_download_cancel: 'Отмена',
    queue_title: 'Очередь загрузки',
    queue_empty: 'Нет видео в очереди.',
    library_history_title: 'Библиотека и история',
    filter_all_channels: 'Все каналы',
    show_shorts: 'Показывать Shorts',
    view_grid: 'Плитка',
    no_videos_filter: 'Нет видео, соответствующих фильтру.',
    downloaded_title: 'Загрузки',
    downloaded_desc: 'Список всех видео, успешно загруженных и готовых к офлайн-просмотру.',
    settings_title: 'Системные настройки',
    settings_desc: 'Настройте параметры автоматизации, качество загрузки, браузер куки и системные настройки.',
    label_download_path: 'Путь к папке загрузок',
    btn_select_folder: 'Выбрать папку',
    btn_test_folder: 'Тестировать папку',
    label_browser: 'Браузер для куки',
    label_quality: 'Качество загрузки по умолчанию',
    label_merge_type: 'Метод загрузки (FFmpeg / Структура файлов)',
    label_interval: 'Интервал проверки каналов (секунды)',
    label_auto_download: 'Автоматическая загрузка',
    label_write_thumbnail: 'Обложка видео',
    label_show_shorts: 'Shorts видео',
    label_theme: 'Тема интерфейса',
    label_auto_delete: 'Автоудаление видео (дней)',
    label_rss_limit: 'Лимит проверки RSS (видео)',
    label_settings_speed_limit: 'Максимальная скорость (КБ/с)',
    label_port: 'Порт приложения',
    label_play_sounds: 'Звуковые уведомления',
    desc_play_sounds: 'Воспроизводить звуковые сигналы при событиях загрузки (старт, успех, ошибка)',
    label_show_notifications: 'Системные уведомления',
    desc_show_notifications: 'Показывать уведомления Windows при начале и завершении загрузок',
    label_auto_open_browser: 'Автооткрытие браузера',
    desc_auto_open_browser: 'Автоматически открывать страницу localhost в браузере при запуске приложения',
    btn_search_channel: 'Искать канал',
    btn_add_channel: 'Подписаться на канал',
    desc_auto_download: 'Начинавать загрузку сразу при обнаружении новых видео',
    desc_write_thumbnail: 'Скачивать обложки видео (миниатюры) вместе с ними',
    desc_show_shorts: 'Показывать Shorts видео в списке библиотеки',
    label_lang: 'Язык приложения',
    label_settings_player_type: 'Тип встроенного плеера',
    desc_settings_player_type: 'Выберите стиль интерфейса встроенного видеоплеера.',
    opt_player_plyr: 'Плеер Plyr (Модернизированный)',
    opt_player_artplayer: 'ArtPlayer (Продвинутый и стильный)',
    opt_player_html5: 'Стандартный HTML5 плеер (Быстрый и простой - визуальные полосы SponsorBlock не поддерживаются)',
    label_sponsorblock: 'SponsorBlock (Плеер)',
    desc_sponsorblock: 'Автоматически пропускать спонсорские сегменты и самопиар во время воспроизведения.',
    cookie_warning_title: 'Важное предупреждение о блокировке куки:',
    cookie_warning_desc: 'Пожалуйста, убедитесь, что полностью ЗАКРЫЛИ выбранный браузер (Chrome, Edge и др.) перед загрузкой. В противном случае браузер блокирует базу данных куки (SQLite), что приводит к ошибкам загрузки.',
    btn_save_settings: 'Сохранить настройки',
    modal_delete_title: 'Удалить видео из истории',
    modal_delete_desc: 'Вы уверены, что хотите удалить это видео из истории загрузок?',
    modal_delete_file_checkbox: 'Также безвозвратно удалить загруженный файл видео с компьютера',
    modal_delete_btn: 'Удалить',
    modal_cancel_btn: 'Отмена',
    modal_player_title: 'Встроенный видеоплеер',
    tab_queue: 'Очередь',
    tab_queue_title: 'Очередь загрузки и управление',
    tab_queue_desc: 'Следите за активными загрузками, перетаскивайте видео в очереди для изменения приоритета.',
    btn_pause_queue: 'Приостановить очередь',
    btn_resume_queue: 'Возобновить очередь',
    label_queue_speed_limit: 'Лимит скорости:',
    btn_speed_limit_set: 'Установить лимит',
    active_progress: 'Прогресс',
    active_size: 'Размер',
    active_eta: 'Осталось',
    queue_empty_title: 'Очередь свободна',
    queue_empty_desc: 'Активных загрузок нет. Загрузка начнется автоматически при появлении новых видео.',
    queue_list_title: 'Видео в очереди',
    drag_drop_hint: 'Перетаскивайте элементы для изменения порядка очереди',
    queue_list_empty: 'В очереди нет видео.',
    settings_desc: 'Настройте автоматизацию, браузер куки и папку загрузок.',
    settings_tab_general: 'Основные настройки',
    settings_tab_download: 'Загрузка и качество',
    settings_tab_automation: 'Автоматизация и RSS',
    settings_tab_notifications: 'Куки и уведомления',
    settings_tab_feedback: 'Отправить отзыв',
    sort_btn_date_desc: 'Дата ▼',
    sort_btn_date_asc: 'Дата ▲',
    sort_btn_size_desc: 'Размер ▼',
    sort_btn_size_asc: 'Размер ▲',
    topbar_cookie_title: 'Куки',
    topbar_quality_title: 'Качество',
    topbar_disk_title_free: 'Свободно',
    topbar_disk_title_folder: 'Размер',
    settings_version_title: 'Версия',
    desc_download_path: 'Путь к директории на вашем компьютере, где будут сохраняться видео.',
    desc_lang: 'Выберите язык интерфейса и язык для названий видео.',
    opt_theme_dark: 'Темная тема',
    opt_theme_light: 'Светлая тема',
    desc_theme: 'Здесь вы можете изменить цветовую тему интерфейса.',
    desc_port: 'Номер порта приложения (Требуется перезапуск).',
    opt_quality_best: 'Максимальное качество (Автоматически)',
    opt_quality_1080p: 'Максимум 1080p Full HD',
    opt_quality_720p: 'Максимум 720p HD',
    desc_quality: 'Это качество будет использоваться по умолчанию, если не заданы настройки для конкретного канала.',
    opt_merge_single: 'Один готовый файл (Макс 720p, ffmpeg не требуется)',
    opt_merge_merge: 'Автослияние (Высокое разрешение, требуется ffmpeg)',
    opt_merge_separate: 'Скачивать аудио и видео отдельно (ffmpeg не требуется)',
    desc_merge_type: 'FFmpeg требуется для объединения видео и аудио высокого качества в один файл.',
    desc_speed_limit: 'Введите значение для ограничения скорости (0 для безлимитного).',
    desc_alt_speed_limit: 'Лимит скорости при активном альтернативном профиле (по умолчанию 500).',
    cli_info_title: 'Команды CLI и консоли скорости',
    cli_info_desc: "Вы можете управлять лимитами скорости из консоли или терминала (используйте &lt;code&gt;HaYTooL YT Downloader.exe &amp;lt;команда&amp;gt;&lt;/code&gt; или &lt;code&gt;haytool &amp;lt;команда&amp;gt;&lt;/code&gt; в Windows):&lt;br&gt;• &lt;b&gt;Установить лимит:&lt;/b&gt; &lt;code&gt;HaYTooL YT Downloader.exe speed &amp;lt;значение&amp;gt;&lt;/code&gt; (например, &lt;code&gt;HaYTooL YT Downloader.exe speed 2500&lt;/code&gt;)&lt;br&gt;• &lt;b&gt;Вкл/Выкл лимит:&lt;/b&gt; &lt;code&gt;HaYTooL YT Downloader.exe speed off&lt;/code&gt; (отключить) / &lt;code&gt;HaYTooL YT Downloader.exe speed on&lt;/code&gt; (восстановить последнее значение)&lt;br&gt;• &lt;b&gt;Установить альт. лимит:&lt;/b&gt; &lt;code&gt;HaYTooL YT Downloader.exe altspeed &amp;lt;значение&amp;gt;&lt;/code&gt; (например, &lt;code&gt;HaYTooL YT Downloader.exe altspeed 500&lt;/code&gt;)&lt;br&gt;• &lt;b&gt;Принудительно включить альт. скорость (Черепаха):&lt;/b&gt; &lt;code&gt;HaYTooL YT Downloader.exe turtleon&lt;/code&gt; (включить) / &lt;code&gt;HaYTooL YT Downloader.exe turtleoff&lt;/code&gt; (выключить)&lt;br&gt;• &lt;b&gt;Переключить альт. скорость:&lt;/b&gt; &lt;code&gt;HaYTooL YT Downloader.exe toggle&lt;/code&gt; или &lt;code&gt;HaYTooL YT Downloader.exe altspeed toggle&lt;/code&gt;&lt;br&gt;• &lt;b&gt;Запрос статуса:&lt;/b&gt; &lt;code&gt;HaYTooL YT Downloader.exe status&lt;/code&gt; (выводит состояние лимитов)",
    cli_info_note: "(В окне Tray 'Показать вывод консоли' вводите команду напрямую без 'HaYTooL YT Downloader.exe' или 'node': 'speed 2500', 'speed off', 'turtleon', 'turtleoff', 'toggle' и т. д.)",
    desc_channel_check_interval: 'Время ожидания перед проверкой следующего канала.',
    desc_rss_limit: 'Сколько последних видео из RSS-ленты должно проверяться для каждого канала?',
    desc_auto_delete: 'Через сколько дней видео должно удаляться автоматически? (0 для отключения)',
    opt_browser_none: 'Не использовать куки (Только публичные видео)',
    desc_browser: 'Выберите браузер, в котором выполнен вход в ваш аккаунт YouTube Premium. Это активирует высокую скорость скачивания Premium и высокое качество.',
    settings_status_text: 'Изменения автоматически сохраняются мгновенно.',
    connection_connecting: 'Подключение: Соединение...',
    connection_active: 'Подключение: Соединено',
    connection_lost: 'Подключение: Разорвано',
    label_history_limit: 'Лимит истории на канал',
    desc_history_limit: 'Максимальный лимит видео для отображения в библиотеке на канал (Улучшает производительность интерфейса).',
    opt_limit_10: '10 видео',
    opt_limit_20: '20 видео (Рекомендуется)',
    opt_limit_50: '50 видео',
    opt_limit_100: '100 видео',
    opt_limit_200: '200 видео',
    label_data_management: 'Управление данными и бэкапом',
    desc_data_management: 'Вы можете сделать бэкап списка подписок или восстановить его из файла резервной копии.',
    btn_export_backup: 'Экспорт бэкапа',
    btn_import_backup: 'Импорт бэкапа',
    opt_import_append: 'Добавить к существующим (Append)',
    opt_import_overwrite: 'Перезаписать полностью (Overwrite)',
    lbl_quick_filter: 'Быстрый фильтр:',
    filter_all: 'Все',
    filter_today: 'Сегодня',
    filter_yesterday: 'Вчера',
    filter_last_2_days: 'За последние 2 дня',
    filter_last_3_days: 'За последние 3 дня',
    filter_last_4_days: 'За последние 4 дня',
    filter_last_5_days: 'За последние 5 дней',
    label_subtitle_color: 'Цвет субтитров',
    desc_subtitle_color: 'Выберите цвет субтитров во встроенных видеоплеерах.',
    opt_sub_white: 'Белый',
    opt_sub_yellow: 'Желтый',
    opt_sub_green: 'Зеленый',
    opt_sub_cyan: 'Голубой',
    opt_sub_magenta: 'Розовый',
    opt_sub_red: 'Красный',
    opt_sub_blue: 'Синий',
    opt_sub_orange: 'Оранжевый',
    opt_sub_purple: 'Фиолетовый',
    opt_sub_black: 'Черный',
    opt_sub_gray: 'Серый',
    opt_sub_lightyellow: 'Светло-желтый',
    inline_btn_youtube: 'Открыть на YouTube',
    inline_btn_system: 'Открыть в системном плеере',
    inline_btn_folder: 'Открыть папку',
    inline_btn_comments: 'Показать комментарии',
    inline_btn_translate_sub: 'Перевести на турецкий',
    opt_sub_opacity_0: 'Прозрачный (%0)',
    opt_sub_opacity_10: 'Прозрачность (%10)',
    opt_sub_opacity_20: 'Прозрачность (%20)',
    opt_sub_opacity_30: 'Прозрачность (%30)',
    opt_sub_opacity_40: 'Прозрачность (%40)',
    opt_sub_opacity_50: 'Прозрачность (%50)',
    opt_sub_opacity_60: 'Прозрачность (%60)',
    opt_sub_opacity_70: 'Прозрачность (%70)',
    opt_sub_opacity_80: 'Прозрачность (%80)',
    opt_sub_opacity_90: 'Прозрачность (%90)',
    opt_sub_opacity_95: 'Прозрачность (%95)',
    opt_sub_opacity_100: 'Непрозрачный (%100)',
    overlay_translating_title: 'Перевод субтитров...',
    overlay_translating_desc: 'Пожалуйста, подождите, идет перевод дорожки строка за строкой через API...',
    modal_translate_title: 'Перевод субтитров',
    modal_translate_no_subs: 'Для этого видео не найдено скачанных субтитров. Для перевода вам нужна как минимум одна скачанная дорожка субтитров.',
    modal_translate_source: 'Исходные субтитры',
    modal_translate_target: 'Целевой язык',
    btn_translate_action: 'Перевести',
    select_auto_download_title: 'Статус автоскачивания',
    select_auto_download_true: 'Автоскачивание',
    select_auto_download_false: 'Без автоскачивания',
    sponsorblock_active: 'SponsorBlock Активен (Нажмите для временного отключения)',
    sponsorblock_disabled: 'SponsorBlock Отключен (Нажмите для включения)',
    lbl_history_only_no_auto_download: 'Только без автозагрузки',
    lbl_history_only_not_downloaded: 'Только не скачанные',
    sponsorblock_active_toast: 'SponsorBlock Активен',
    sponsorblock_active_toast_desc: 'Спонсорские сегменты будут автоматически пропущены',
    sponsorblock_disabled_toast: 'SponsorBlock Отключен',
    sponsorblock_disabled_toast_desc: 'Пропуск спонсорских сегментов временно приостановлен'
  }
};

// Türkçe Açıklama: Seçilen dil paketine (TR veya EN) göre sayfadaki tüm metin etiketlerini ve açıklamaları dinamik olarak günceller.
/**
 * Arayüz dilini seçilen dile göre günceller.
 * 
 * @param {string} lang Seçilen dil kodu ('tr' veya 'en')
 */
function applyLanguage(lang) {
  currentLang = lang || 'tr';
  const t = translations[currentLang] || translations.tr;
  
  const el = (id, key, prop = 'textContent') => {
    const element = document.getElementById(id);
    if (element && t[key]) {
      element[prop] = t[key];
    }
  };
  
  const elQuery = (selector, key, prop = 'textContent') => {
    const element = document.querySelector(selector);
    if (element && t[key]) {
      element[prop] = t[key];
    }
  };

  // HTML lang attribute
  document.documentElement.lang = currentLang;

  // Header Navigasyon ve Başlıklar
  // elQuery('.brand-text span', 'premium_automation');
  elQuery('button[data-tab="history"] span', 'tab_library');
  elQuery('button[data-tab="queue"] span', 'tab_queue');
  elQuery('button[data-tab="downloaded"] span', 'tab_downloaded');
  elQuery('button[data-tab="channels"] span', 'tab_channels');
  elQuery('button[data-tab="settings"] span', 'tab_settings');
  elQuery('#nav-iptv-btn span', 'tab_iptv');

  // Kanallar Sekmesi
  elQuery('#tab-channels .content-header h2', 'channels_title');
  elQuery('#tab-channels .content-header p', 'channels_desc');
  const channelInput = document.getElementById('channel-input');
  if (channelInput) channelInput.placeholder = t.input_channel_placeholder;
  elQuery('#add-channel-btn span', 'btn_follow_channel');
  // Türkçe Açıklama: Toplu güncelleme butonu dil etiketine bağlandı.
  elQuery('#btn-update-all-logos-text', 'btn_update_all_logos');

  // İndirme Sırası Sekmesi
  elQuery('#tab-queue-title', 'tab_queue_title');
  elQuery('#tab-queue-desc', 'tab_queue_desc');
  elQuery('#queue-pause-text', localDb.settings && localDb.settings.isPaused ? 'btn_resume_queue' : 'btn_pause_queue');
  // Türkçe Açıklama: Kuyruk sekmesindeki hız sınırı etiketi yeni dil anahtarına bağlandı.
  elQuery('#speed-limit-label', 'label_queue_speed_limit');
  elQuery('#speed-limit-set-btn', 'btn_speed_limit_set');
  elQuery('#queue-active-badge', 'badge_active_download');
  elQuery('#no-active-download h3', 'queue_empty_title');
  elQuery('#no-active-download p', 'queue_empty_desc');
  elQuery('#active-progress-label', 'active_progress');
  elQuery('#active-size-label', 'active_size');
  elQuery('#active-eta-label', 'active_eta');
  elQuery('#cancel-active-btn span', 'active_download_cancel');
  elQuery('#queue-list-title', 'queue_list_title');
  elQuery('#drag-drop-hint', 'drag_drop_hint');
  elQuery('#queue-list-empty', 'queue_list_empty');

  // Kütüphane Sekmesi
  elQuery('label[for="history-show-shorts"] + span', 'show_shorts');
  el('lbl-history-only-no-auto-download', 'lbl_history_only_no_auto_download');
  el('lbl-history-only-not-downloaded', 'lbl_history_only_not_downloaded');

  el('lbl-quick-filter', 'lbl_quick_filter');
  el('btn-filter-all', 'filter_all');
  el('btn-filter-today', 'filter_today');
  el('btn-filter-yesterday', 'filter_yesterday');
  el('btn-filter-2days', 'filter_last_2_days');
  el('btn-filter-3days', 'filter_last_3_days');
  el('btn-filter-4days', 'filter_last_4_days');
  el('btn-filter-5days', 'filter_last_5_days');
  elQuery('#view-grid-btn span', 'view_grid');
  elQuery('#view-list-btn span', 'view_list');

  // İndirilen Videolar Sekmesi
  elQuery('#tab-downloaded .content-header h2', 'downloaded_title');
  elQuery('#tab-downloaded .content-header p', 'downloaded_desc');
  elQuery('#tab-downloaded .content-header button span', 'btn_open_downloads');
  elQuery('label[for="downloaded-show-shorts"] + span', 'show_shorts');
  elQuery('#downloaded-view-grid-btn span', 'view_grid');
  elQuery('#downloaded-view-list-btn span', 'view_list');
  elQuery('#inline-btn-description', 'inline_btn_description', 'title');
  elQuery('#description-title-text', 'inline_description_title');

  // Ayarlar Sekmesi
  elQuery('#tab-settings .content-header h2', 'settings_title');
  elQuery('#tab-settings .content-header p', 'settings_desc');
  elQuery('label[for="settings-download-path"]', 'label_download_path');
  elQuery('#select-folder-btn span', 'btn_select_folder');
  elQuery('#test-folder-btn span', 'btn_test_folder');
  elQuery('label[for="settings-browser"]', 'label_browser');
  elQuery('label[for="settings-quality"]', 'label_quality');
  elQuery('label[for="settings-mergetype"]', 'label_merge_type');
  elQuery('label[for="settings-channelcheckinterval"]', 'label_interval');
  elQuery('label[for="settings-autodownload"]:not(.toggle-label)', 'label_auto_download');
  elQuery('label[for="settings-autodownload"] + span', 'desc_auto_download');
  elQuery('label[for="settings-writethumbnail"]:not(.toggle-label)', 'label_write_thumbnail');
  elQuery('label[for="settings-writethumbnail"] + span', 'desc_write_thumbnail');
  elQuery('label[for="settings-showshorts"]:not(.toggle-label)', 'label_show_shorts');
  elQuery('label[for="settings-showshorts"] + span', 'desc_show_shorts');
  elQuery('label[for="settings-theme"]', 'label_theme');
  elQuery('label[for="settings-autodelete"]', 'label_auto_delete');
  elQuery('label[for="settings-rsslimit"]', 'label_rss_limit');
  // Türkçe Açıklama: Ayarlar sekmesindeki hız sınırı etiketi yeni dil anahtarına bağlandı.
  elQuery('label[for="settings-speedlimit"]', 'label_settings_speed_limit');
  elQuery('label[for="settings-port"]', 'label_port');
  elQuery('label[for="settings-playsounds"]:not(.toggle-label)', 'label_play_sounds');
  elQuery('label[for="settings-playsounds"] + span', 'desc_play_sounds');
  elQuery('label[for="settings-shownotifications"]:not(.toggle-label)', 'label_show_notifications');
  elQuery('label[for="settings-shownotifications"] + span', 'desc_show_notifications');
  elQuery('label[for="settings-autoopenbrowser"]:not(.toggle-label)', 'label_auto_open_browser');
   elQuery('label[for="settings-autoopenbrowser"] + span', 'desc_auto_open_browser');
  elQuery('#btn-search-channel-text', 'btn_search_channel');
  elQuery('#btn-add-channel-text', 'btn_add_channel');
  elQuery('label[for="settings-lang"]', 'label_lang');
  
  // Oynatıcı tipi ve Çerez kilitleme uyarısı çevirileri
  el('label-settings-player-type', 'label_settings_player_type');
  el('desc-settings-player-type', 'desc_settings_player_type');
  el('opt-player-plyr', 'opt_player_plyr');
  el('opt-player-artplayer', 'opt_player_artplayer');
  el('opt-player-html5', 'opt_player_html5');
  el('cookie-warning-title', 'cookie_warning_title');
  el('cookie-warning-desc', 'cookie_warning_desc');

  el('label-sponsorblock', 'label_sponsorblock');
  elQuery('label[for="settings-sponsorblock"] + span', 'desc_sponsorblock');

  el('label-subtitle-color', 'label_subtitle_color');
  el('desc-subtitle-color', 'desc_subtitle_color');
  el('opt-sub-white', 'opt_sub_white');
  el('opt-sub-yellow', 'opt_sub_yellow');
  el('opt-sub-green', 'opt_sub_green');
  el('opt-sub-cyan', 'opt_sub_cyan');
  el('opt-sub-magenta', 'opt_sub_magenta');
  el('opt-sub-red', 'opt_sub_red');

  // Gömülü oynatıcı eylemleri title'ları
  const inlineBtnYoutube = document.getElementById('inline-btn-youtube');
  if (inlineBtnYoutube) {
    inlineBtnYoutube.title = t.inline_btn_youtube;
    inlineBtnYoutube.setAttribute('aria-label', t.inline_btn_youtube);
  }
  const inlineBtnSystem = document.getElementById('inline-btn-system');
  if (inlineBtnSystem) {
    inlineBtnSystem.title = t.inline_btn_system;
    inlineBtnSystem.setAttribute('aria-label', t.inline_btn_system);
  }
  const inlineBtnFolder = document.getElementById('inline-btn-folder');
  if (inlineBtnFolder) {
    inlineBtnFolder.title = t.inline_btn_folder;
    inlineBtnFolder.setAttribute('aria-label', t.inline_btn_folder);
  }
  const inlineBtnComments = document.getElementById('inline-btn-comments');
  if (inlineBtnComments) {
    inlineBtnComments.title = t.inline_btn_comments;
    inlineBtnComments.setAttribute('aria-label', t.inline_btn_comments);
  }
  const inlineBtnTranslate = document.getElementById('inline-btn-translate-sub');
  if (inlineBtnTranslate) {
    inlineBtnTranslate.title = t.inline_btn_translate_sub;
  }

  if (typeof updateSBToggleButtonUI === 'function') {
    updateSBToggleButtonUI();
  }

  // Altyazı Rengi Option Çevirileri
  const inlineSubColor = document.getElementById('inline-subtitle-color');
  if (inlineSubColor && inlineSubColor.options.length >= 12) {
    inlineSubColor.title = t.inline_sub_color_title;
    inlineSubColor.options[0].text = t.opt_sub_white;
    inlineSubColor.options[1].text = t.opt_sub_yellow;
    inlineSubColor.options[2].text = t.opt_sub_green;
    inlineSubColor.options[3].text = t.opt_sub_cyan;
    inlineSubColor.options[4].text = t.opt_sub_magenta;
    inlineSubColor.options[5].text = t.opt_sub_red;
    inlineSubColor.options[6].text = t.opt_sub_blue;
    inlineSubColor.options[7].text = t.opt_sub_orange;
    inlineSubColor.options[8].text = t.opt_sub_purple;
    inlineSubColor.options[9].text = t.opt_sub_black;
    inlineSubColor.options[10].text = t.opt_sub_gray;
    inlineSubColor.options[11].text = t.opt_sub_lightyellow;
  }

  // Altyazı Saydamlığı Option Çevirileri
  const inlineSubOpacity = document.getElementById('inline-subtitle-opacity');
  if (inlineSubOpacity && inlineSubOpacity.options.length >= 12) {
    inlineSubOpacity.title = t.inline_sub_opacity_title;
    inlineSubOpacity.options[0].text = t.opt_sub_opacity_0;
    inlineSubOpacity.options[1].text = t.opt_sub_opacity_10;
    inlineSubOpacity.options[2].text = t.opt_sub_opacity_20;
    inlineSubOpacity.options[3].text = t.opt_sub_opacity_30;
    inlineSubOpacity.options[4].text = t.opt_sub_opacity_40;
    inlineSubOpacity.options[5].text = t.opt_sub_opacity_50;
    inlineSubOpacity.options[6].text = t.opt_sub_opacity_60;
    inlineSubOpacity.options[7].text = t.opt_sub_opacity_70;
    inlineSubOpacity.options[8].text = t.opt_sub_opacity_80;
    inlineSubOpacity.options[9].text = t.opt_sub_opacity_90;
    inlineSubOpacity.options[10].text = t.opt_sub_opacity_95;
    inlineSubOpacity.options[11].text = t.opt_sub_opacity_100;
  }

  // Altyazı Boyutu Option Çevirileri
  const inlineSubSize = document.getElementById('inline-subtitle-size');
  if (inlineSubSize) {
    inlineSubSize.title = t.inline_sub_size_title;
  }

  elQuery('.form-actions button span', 'btn_save_settings');

  // Onay Modalları
  elQuery('#delete-modal h3', 'modal_delete_title');
  elQuery('#delete-modal-msg', 'modal_delete_desc');
  elQuery('#delete-file-checkbox + label + span', 'modal_delete_file_checkbox');
  elQuery('#confirm-delete-btn', 'modal_delete_btn');
  elQuery('#cancel-delete-btn', 'modal_cancel_btn');
  
  if (currentPlayingVideoId) {
    const activeVideo = localDb?.history?.find(h => h.id === currentPlayingVideoId);
    if (activeVideo && activeVideo.title) {
      const titleEl = document.getElementById('player-modal-title');
      if (titleEl) titleEl.textContent = activeVideo.title;
    } else {
      elQuery('#player-modal-title', 'modal_player_title');
    }
  } else {
    elQuery('#player-modal-title', 'modal_player_title');
  }

  // Üst bar badges çevirileri
  el('topbar-cookie-title', 'topbar_cookie_title');
  el('topbar-quality-title', 'topbar_quality_title');
  el('topbar-disk-title-free', 'topbar_disk_title_free');
  el('topbar-disk-title-folder', 'topbar_disk_title_folder');

  // Sıralama butonları ve başlıkları (title)
  const sortBtnDateDesc = document.getElementById('sort-btn-date-desc');
  const sortBtnDateAsc = document.getElementById('sort-btn-date-asc');
  const sortBtnSizeDesc = document.getElementById('sort-btn-size-desc');
  const sortBtnSizeAsc = document.getElementById('sort-btn-size-asc');

  if (sortBtnDateDesc) {
    sortBtnDateDesc.textContent = t.sort_btn_date_desc;
    sortBtnDateDesc.title = currentLang === 'en' ? 'Date: Newest to Oldest' : 'Tarih: Yeniden Eskiye';
  }
  if (sortBtnDateAsc) {
    sortBtnDateAsc.textContent = t.sort_btn_date_asc;
    sortBtnDateAsc.title = currentLang === 'en' ? 'Date: Oldest to Newest' : 'Tarih: Eskiden Yeniye';
  }
  if (sortBtnSizeDesc) {
    sortBtnSizeDesc.textContent = t.sort_btn_size_desc;
    sortBtnSizeDesc.title = currentLang === 'en' ? 'Size: Largest to Smallest' : 'Boyut: Büyükten Küçüğe';
  }
  if (sortBtnSizeAsc) {
    sortBtnSizeAsc.textContent = t.sort_btn_size_asc;
    sortBtnSizeAsc.title = currentLang === 'en' ? 'Size: Smallest to Largest' : 'Boyut: Küçükten Büyüğe';
  }

  // Ayarlar alt sekmeleri ve açıklamaları
  el('settings-desc', 'settings_desc');
  el('settings-version-title', 'settings_version_title');
  
  elQuery('.settings-tab-btn[data-subtab="general"] span', 'settings_tab_general');
  elQuery('.settings-tab-btn[data-subtab="download"] span', 'settings_tab_download');
  elQuery('.settings-tab-btn[data-subtab="automation"] span', 'settings_tab_automation');
  elQuery('.settings-tab-btn[data-subtab="notifications"] span', 'settings_tab_notifications');
  elQuery('.feedback-btn span', 'settings_tab_feedback');

  el('settings-title-general-text', 'settings_tab_general');
  el('settings-title-download-text', 'settings_tab_download');
  el('settings-title-automation-text', 'settings_tab_automation');
  el('settings-title-notifications-text', 'settings_tab_notifications');

  // Yeni eklenen Ayarlar alanı etiket, option ve açıklama çevirileri
  el('desc-download-path', 'desc_download_path');
  el('desc-lang', 'desc_lang');
  el('opt-theme-dark', 'opt_theme_dark');
  el('opt-theme-light', 'opt_theme_light');
  el('desc-theme', 'desc_theme');
  el('desc-port', 'desc_port');
  el('opt-quality-best', 'opt_quality_best');
  el('opt-quality-1080p', 'opt_quality_1080p');
  el('opt-quality-720p', 'opt_quality_720p');
  el('desc-quality', 'desc_quality');
  el('opt-merge-single', 'opt_merge_single');
  el('opt-merge-merge', 'opt_merge_merge');
  el('opt-merge-separate', 'opt_merge_separate');
  el('desc-merge-type', 'desc_merge_type');
  el('desc-speed-limit', 'desc_speed_limit');
  el('desc-alt-speed-limit', 'desc_alt_speed_limit');
  el('cli-info-title', 'cli_info_title');
  el('desc-channel-check-interval', 'desc_channel_check_interval');
  el('desc-rss-limit', 'desc_rss_limit');
  el('desc-auto-delete', 'desc_auto_delete');
  el('opt-browser-none', 'opt_browser_none');
  el('desc-browser', 'desc_browser');
  el('settings-status-text', 'settings_status_text');

  // Geçmiş limit ve veri yönetimi çevirileri
  el('label-history-limit', 'label_history_limit');
  el('desc-history-limit', 'desc_history_limit');
  el('opt-limit-10', 'opt_limit_10');
  el('opt-limit-20', 'opt_limit_20');
  el('opt-limit-50', 'opt_limit_50');
  el('opt-limit-100', 'opt_limit_100');
  el('opt-limit-200', 'opt_limit_200');
  el('label-data-management', 'label_data_management');
  el('desc-data-management', 'desc_data_management');
  el('btn-export-text', 'btn_export_backup');
  el('btn-import-text', 'btn_import_backup');
  el('opt-import-append', 'opt_import_append');
  el('opt-import-overwrite', 'opt_import_overwrite');

  // Ust bar baglanti durumu metni cevirisi
  const statusIndicator2 = document.getElementById('status-indicator');
  const statusText = document.getElementById('topbar-status-text');
  if (statusText && statusIndicator2) {
    if (statusIndicator2.classList.contains('online')) {
      statusText.textContent = t.connection_active;
    } else if (statusIndicator2.classList.contains('offline')) {
      statusText.textContent = t.connection_lost;
    } else {
      statusText.textContent = t.connection_connecting;
    }
  }

  // CLI aciklama HTML kutusu dinamik guncellemesi
  const cliInfoDesc = document.getElementById('cli-info-desc');
  if (cliInfoDesc) {
    cliInfoDesc.innerHTML = t.cli_info_desc + `<br><small style="color: var(--accent-color); opacity: 0.8; font-weight: bold;" id="cli-info-note">${t.cli_info_note}</small>`;
  }

  // IPTV Cevirileri
  el('lbl-single-view', 'lbl_single_view');
  el('lbl-dual-view', 'lbl_dual_view');
  el('lbl-quad-view', 'lbl_quad_view');
  el('lbl-sport-view', 'lbl_sport_view');
  el('lbl-swap-screens', 'lbl_swap_screens');
  el('lbl-update-channels', 'lbl_update_channels');
  el('lbl-loading-more', 'lbl_loading_more');
  el('opt-all-countries', 'opt_all_countries');
  el('opt-all-categories', 'opt_all_categories');
  document.querySelectorAll('.lbl-select-channel').forEach(item => {
    if (t.lbl_select_channel) item.textContent = t.lbl_select_channel;
  });
}

function switchTab(targetTab, triggerPushState = true) {
  window.switchTab = switchTab;
  
  // Gecersiz veya bos tab kontrolu (pd-btn gibi data-tab olmayan nav-itemlar)
  if (!targetTab || !tabPathMap[targetTab]) {
    if (targetTab) console.warn('[switchTab] Bilinmeyen tab:', targetTab);
    return;
  }

  try {
  const activeTab = document.querySelector('.nav-item.active')?.getAttribute('data-tab') || 'history';
  
  // İndirilenler sekmesinden çıkış yapılıyorsa ve video oynatılıyorsa mini oynatıcıya geç
  if (activeTab === 'downloaded' && targetTab !== 'downloaded') {
    const inlineContainer = document.getElementById('downloaded-inline-player-container');
    const isInlineOpen = inlineContainer && !inlineContainer.classList.contains('hidden');
    if (isInlineOpen && currentPlayingVideoId) {
      const { currentTime, paused } = getCurrentPlaybackState();
      const videoId = currentPlayingVideoId;
      
      // Yerleşik oynatıcıyı kapat
      if (window.closeInlinePlayer) window.closeInlinePlayer();
      
      // UI sekmesini değiştir
      performTabSwitchUI(targetTab);
      
      // Modal oynatıcıyı minimized modunda aç
      const modal = document.getElementById('player-modal');
      if (modal) {
        modal.classList.add('minimized');
        const btn = document.getElementById('minimize-player-modal-btn');
        if (btn) {
          const icon = btn.querySelector('i') || btn.querySelector('[data-lucide]');
          if (icon) icon.setAttribute('data-lucide', 'maximize-2');
          btn.title = localDb.settings && localDb.settings.lang === 'en' ? 'Maximize' : 'Büyüt';
        }
        lucide.createIcons();
      }
      
      // Modalda videoyu başlat
      playVideoEmbedded(videoId, currentTime, paused);
      
      if (triggerPushState) {
        const targetPath = tabPathMap[targetTab];
        if (targetPath && window.location.pathname !== targetPath) {
          history.pushState({ tab: targetTab }, '', targetPath);
        }
      }
      return;
    }
  }
  
  // Başka sekmeden İndirilenler sekmesine geçiş yapılıyorsa ve modal oynatıcı açıksa ve video indirilmişse
  if (targetTab === 'downloaded') {
    const modal = document.getElementById('player-modal');
    const isModalOpen = modal && !modal.classList.contains('hidden');
    if (isModalOpen && currentPlayingVideoId) {
      const video = (localDb.history || []).find(h => h.id === currentPlayingVideoId);
      const isCompleted = video && video.status === 'completed';
      const isMissing = video && video.fileMissing === true;
      const isDownloaded = isCompleted && !isMissing;
      
      if (isDownloaded) {
        const { currentTime, paused } = getCurrentPlaybackState();
        const videoId = currentPlayingVideoId;
        
        // Modal oynatıcıyı kapat
        if (window.closePlayerModal) window.closePlayerModal();
        
        // UI sekmesini değiştir
        performTabSwitchUI(targetTab);
        
        // Yerleşik oynatıcıda videoyu başlat
        playVideoEmbedded(videoId, currentTime, paused);
        
        if (triggerPushState) {
          const targetPath = tabPathMap[targetTab];
          if (targetPath && window.location.pathname !== targetPath) {
            history.pushState({ tab: targetTab }, '', targetPath);
          }
        }
        return;
      }
    }
  }

  // Normal sekme geçişi
  if (targetTab !== 'downloaded') {
    if (window.closeInlinePlayer) window.closeInlinePlayer();
  }
  
  if (targetTab === 'iptv') {
    // IPTV sekmesine gecince her turlu video player'i tamamen kapat (mini-player'a gitmeden)
    const modal = document.getElementById('player-modal');
    if (modal && !modal.classList.contains('hidden')) {
      if (window.closePlayerModal) window.closePlayerModal();
    }
    if (window.closeInlinePlayer) window.closeInlinePlayer();
    // IPTV kanallarini yukle ve durum kontrolunu baslat
    if (typeof loadIptvChannels === 'function') loadIptvChannels();
    if (typeof checkIptvStatus === 'function') checkIptvStatus();
    // IPTV kayitli sekmeleri ve yerlesimi yukle
    if (typeof restoreIptvState === 'function') restoreIptvState();
  } else {
    // IPTV sekmesinden cikinca: tum IPTV playerlar + arkaplan interval temizle
    if (window.stopAllIptvPlayers) window.stopAllIptvPlayers();
    if (window.clearIptvChannelList) window.clearIptvChannelList();
    // IPTV durum kontrol interval'ini durdur
    if (typeof iptvStatusInterval !== 'undefined' && iptvStatusInterval) {
      clearInterval(iptvStatusInterval);
      iptvStatusInterval = null;
    }
  }

  performTabSwitchUI(targetTab);

  if (triggerPushState) {
    const targetPath = tabPathMap[targetTab];
    if (targetPath && window.location.pathname !== targetPath) {
      history.pushState({ tab: targetTab }, '', targetPath);
    }
  }
  } catch (err) {
    console.error('[switchTab] Hata olustu, tab:', targetTab, err);
    // Hata olsa bile UI'yi guncelle
    try { performTabSwitchUI(targetTab); } catch(e2) { console.error('[switchTab] performTabSwitchUI hatasi:', e2); }
  }
}

// Sekme Degistirme - switchTab fonksiyonu tanimli, navItems henuz tanimsiz
// Bu yuzden forEach'i navItems tanimlandiktan sonra cagiriyoruz (asagida)

// DOM Elemanlari
const statusIndicator = document.getElementById('status-indicator');
const connectionStatus = document.getElementById('connection-status');
const cookieStatus = document.getElementById('cookie-status');
const qualityStatus = document.getElementById('quality-status');

const navItems = document.querySelectorAll('.nav-item');
const tabContents = document.querySelectorAll('.tab-content');

// Sekme Degistirme - data-tab olmayan nav-itemleri (pd-btn gibi) atla
// navItems burada tanimlandiktan sonra click handler'lari kayit ediyoruz
document.querySelectorAll('.nav-item[data-tab]').forEach(item => {
  item.addEventListener('click', () => {
    const targetTab = item.getAttribute('data-tab');
    switchTab(targetTab, true);
  });
});

// Dashboard Tab Elemanlari
const noActiveDownload = document.getElementById('no-active-download');
const activeDownloadDetails = document.getElementById('active-download-details');
const activeSpeed = document.getElementById('active-speed');
const activeTitle = document.getElementById('active-title');
const activeChannel = document.getElementById('active-channel');
const activeProgressBar = document.getElementById('active-progress-bar');
const activePercent = document.getElementById('active-percent');
const activeSize = document.getElementById('active-size');
const activeEta = document.getElementById('active-eta');

const statChannelCount = document.getElementById('stat-channel-count');
const statDownloadedCount = document.getElementById('stat-downloaded-count');
const statWaitingCount = document.getElementById('stat-waiting-count');
const queueList = document.getElementById('queue-list');

// Kanallar Tab Elemanları
const addChannelForm = document.getElementById('add-channel-form');
const channelInput = document.getElementById('channel-input');
const channelsList = document.getElementById('channels-list');
const addChannelBtn = document.getElementById('add-channel-btn');

// Geçmiş Tab Elemanları
const historyGrid = document.getElementById('history-grid');
const historyChannelFilter = document.getElementById('history-channel-filter');
const viewGridBtn = document.getElementById('view-grid-btn');
const viewListBtn = document.getElementById('view-list-btn');

let historyViewMode = 'grid'; // grid veya list
let historyFilterChannel = 'all'; // all veya kanalId
let historyFilterDays = 'all'; // all, 0, 1, 2, 3, 4, 5
let historyOnlyNoAutoDownload = false;
let historyOnlyNotDownloaded = false;
let downloadedViewMode = 'grid'; // grid veya list
let downloadedFilterChannel = 'all'; // all veya kanalId

// İndirilen Videolar Tab Elemanları
const downloadedGrid = document.getElementById('downloaded-grid');
const downloadedChannelFilter = document.getElementById('downloaded-channel-filter');
const downloadedViewGridBtn = document.getElementById('downloaded-view-grid-btn');
const downloadedViewListBtn = document.getElementById('downloaded-view-list-btn');

// Silme Modalı Elemanları
const deleteModal = document.getElementById('delete-modal');
const closeDeleteModalBtn = document.getElementById('close-delete-modal-btn');
const cancelDeleteBtn = document.getElementById('cancel-delete-btn');
const confirmDeleteBtn = document.getElementById('confirm-delete-btn');
const deleteFileCheckbox = document.getElementById('delete-file-checkbox');
const deleteModalMsg = document.getElementById('delete-modal-msg');
let videoIdToDelete = null;

// Ayarlar Tab Elemanları
const settingsForm = document.getElementById('settings-form');
const settingsDownloadPath = document.getElementById('settings-download-path');
const settingsBrowser = document.getElementById('settings-browser');
const settingsQuality = document.getElementById('settings-quality');
const settingsChannelCheckInterval = document.getElementById('settings-channelcheckinterval');
const settingsAutoDownload = document.getElementById('settings-autodownload');
const settingsShortsDurationLimit = document.getElementById('settings-shortsdurationlimit');

// Diğer Butonlar
const syncNowBtn = document.getElementById('sync-now-btn');
const openFolderBtn = document.getElementById('open-folder-btn');
const selectFolderBtn = document.getElementById('select-folder-btn');
const testFolderBtn = document.getElementById('test-folder-btn');

/**
 * Ekranda anlık bildirim (toast) mesajı gösterir.
 * 
 * @param {string} message Gösterilecek mesaj metni
 * @param {string} type Bildirim tipi ('info', 'success', 'error')
 */
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  
  let iconName = 'info';
  if (type === 'success') iconName = 'check-circle';
  if (type === 'error') iconName = 'alert-triangle';

  toast.innerHTML = `
    <div class="toast-icon">
      <i data-lucide="${iconName}"></i>
    </div>
    <div class="toast-message">${message}</div>
  `;
  
  container.appendChild(toast);
  lucide.createIcons(); // Yeni ikonu işle

  // 4 saniye sonra bildirimi kaldır
  setTimeout(() => {
    toast.style.animation = 'slideIn 0.3s reverse forwards';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// Türkçe Açıklama: SPA yönlendirmeleri için sekmeler arası gezinme ve HTML5 History API entegrasyonu.
const tabPathMap = {
  history: '/home',
  queue: '/download',
  downloaded: '/downlist',
  channels: '/channels',
  settings: '/settings',
  iptv: '/iptv'
};

const pathTabMap = {
  '/home': 'history',
  '/download': 'queue',
  '/downlist': 'downloaded',
  '/channels': 'channels',
  '/settings': 'settings',
  '/iptv': 'iptv'
};

// Türkçe Açıklama: Aktif oynatıcı tipine (ArtPlayer, Plyr, HTML5) göre oynatım saniyesini ve paused durumunu alır.
/**
 * Aktif oynatıcının zamanını ve oynatılma durumunu döndürür.
 * 
 * @returns {{currentTime: number, paused: boolean}}
 */
function getCurrentPlaybackState() {
  const pType = (localDb.settings && localDb.settings.playerType) || 'plyr';
  const player = document.getElementById('embedded-video-player');
  
  let currentTime = 0;
  let paused = true;
  
  if (pType === 'artplayer' && videoPlayerInstance) {
    currentTime = videoPlayerInstance.currentTime || 0;
    paused = videoPlayerInstance.paused;
  } else if (pType === 'html5' && player) {
    currentTime = player.currentTime || 0;
    paused = player.paused;
  } else if (videoPlayerInstance) {
    currentTime = videoPlayerInstance.currentTime || 0;
    paused = videoPlayerInstance.paused;
  } else if (player) {
    currentTime = player.currentTime || 0;
    paused = player.paused;
  }
  
  return { currentTime, paused };
}

// Türkçe Açıklama: Arayüzdeki sekme başlıklarını ve sekme içeriklerini aktif/pasif yapar.
/**
 * Sekme elemanlarının CSS sınıflarını günceller.
 * 
 * @param {string} targetTab Hedef sekme adı
 */
function performTabSwitchUI(targetTab) {
  navItems.forEach(n => {
    if (n.getAttribute('data-tab') === targetTab) {
      n.classList.add('active');
    } else {
      n.classList.remove('active');
    }
  });

  tabContents.forEach(content => {
    if (content.id === `tab-${targetTab}`) {
      content.classList.add('active');
    } else {
      content.classList.remove('active');
    }
  });

  // Sekme değiştirildiğinde ana içerik alanını en yukarı kaydır
  const mainContent = document.querySelector('.main-content');
  if (mainContent) {
    mainContent.scrollTop = 0;
  }
}

// Tarayıcı Geri/İleri Buton Dinleyicisi
window.addEventListener('popstate', (event) => {
  const tabId = (event.state && event.state.tab) || pathTabMap[window.location.pathname] || 'history';
  switchTab(tabId, false);
});

/**
 * Sunucu ile Server-Sent Events (SSE) bağlantısı kurar,
 * canlı indirme ilerlemelerini, veritabanı güncellemelerini ve bildirimleri dinler.
 */
function connectSSE() {
  if (eventSource) {
    eventSource.close();
  }

  eventSource = new EventSource('/api/events');

  eventSource.onopen = () => {
    if (statusIndicator) statusIndicator.className = 'status-dot online';
    if (connectionStatus) {
      connectionStatus.textContent = currentLang === 'en' ? 'Connected' : 'Bağlandı';
      connectionStatus.className = 'value text-muted';
    }
    const statusText = document.getElementById('topbar-status-text');
    const t = translations[currentLang] || translations.tr;
    if (statusText) statusText.textContent = t.connection_active;
    updateDiskSpace();
  };

  eventSource.onerror = (err) => {
    if (statusIndicator) statusIndicator.className = 'status-dot offline';
    if (connectionStatus) {
      connectionStatus.textContent = currentLang === 'en' ? 'Connection Lost' : 'Bağlantı Kesildi';
      connectionStatus.className = 'value text-muted';
    }
    const statusText = document.getElementById('topbar-status-text');
    const t = translations[currentLang] || translations.tr;
    if (statusText) statusText.textContent = t.connection_lost;
  };

  // Veritabanı Güncelleme Bildirimi
  eventSource.addEventListener('db_update', (e) => {
    const db = JSON.parse(e.data);
    localDb = db;
    updateUI(db);
  });

  // İndirme İlerleme Bildirimi
  eventSource.addEventListener('progress', (e) => {
    const data = JSON.parse(e.data);
    updateActiveDownloadProgress(data);
  });

  // Sistem Log Bildirimi (Toast ve Masaüstü Bildirimi)
  eventSource.addEventListener('status_log', (e) => {
    const log = JSON.parse(e.data);
    showToast(log.message, log.type);

    // Masaüstü Bildirimi (Sadece indirme tamamlanma başarısında ve ayarlarda izin verilmişse)
    if (localDb.settings.showNotifications !== false &&
        log.type === 'success' && 
        'Notification' in window && 
        Notification.permission === 'granted' &&
        !log.message.includes('silindi') &&
        !log.message.includes('temizlendi') &&
        !log.message.includes('deleted') &&
        !log.message.includes('cleared')) {
      const isEn = localDb.settings.lang === 'en';
      new Notification(isEn ? 'HaYTool Download Completed' : 'HaYTool İndirme Tamamlandı', {
        body: log.message,
        icon: '/logo.png'
      });
    }
  });

  // Sunucudan gelen sekme geçiş bildirimini dinler
  eventSource.addEventListener('switch_tab', (e) => {
    try {
      const tabName = JSON.parse(e.data);
      if (window.switchTab) window.switchTab(tabName);
    } catch (err) {
      console.error('Sekme geçiş hatası:', err);
    }
  });

  // FFmpeg İndirme İlerleme Bildirimi
  eventSource.addEventListener('ffmpeg_download', (e) => {
    try {
      const data = JSON.parse(e.data);
      updateFfmpegInstallUI(data);
    } catch (err) {
      console.error('FFmpeg progress parse error:', err);
    }
  });

  // GitHub Güncelleme Durumu Bildirimi
  eventSource.addEventListener('update_status', (e) => {
    try {
      const update = JSON.parse(e.data);
      if (update && update.updateAvailable) {
        showUpdateNotification(update);
      }
    } catch (err) {
      console.error('Update status event parse error:', err);
    }
  });
}

/**
 * Sunucudan GitHub güncelleme durumunu sorgular.
 */
async function checkApplicationUpdates() {
  try {
    const res = await fetch('/api/updates/check');
    if (!res.ok) return;
    const update = await res.json();
    if (update && update.updateAvailable) {
      showUpdateNotification(update);
    }
  } catch (err) {
    console.warn('Update check failed:', err);
  }
}

/**
 * Kullanıcıya yeni sürüm olduğunu bildiren animasyonlu bir kart gösterir.
 */
function showUpdateNotification(update) {
  if (sessionStorage.getItem('hide_update_notification') === 'true') {
    return;
  }
  
  const existing = document.getElementById('github-update-notification');
  if (existing) existing.remove();
  
  const isEn = localDb.settings?.lang === 'en';
  const title = isEn ? 'New Version Available!' : 'Yeni Sürüm Mevcut!';
  const desc = isEn ? `v${update.latestVersion.replace(/^v/, '')} version is ready to download.` : `v${update.latestVersion.replace(/^v/, '')} sürümü indirilebilir durumda.`;
  const btnText = isEn ? 'View on GitHub' : 'GitHub\'da İncele';
  
  const card = document.createElement('div');
  card.id = 'github-update-notification';
  card.className = 'github-update-card';
  card.innerHTML = `
    <div class="update-card-content">
      <div class="update-card-icon">
        <i data-lucide="sparkles"></i>
      </div>
      <div class="update-card-body">
        <h4>${title}</h4>
        <p>${desc}</p>
        <div class="update-card-actions">
          <a href="${update.releaseUrl}" target="_blank" class="update-btn-action">${btnText}</a>
          <button class="update-btn-close" id="github-update-close-btn"><i data-lucide="x"></i></button>
        </div>
      </div>
    </div>
  `;
  
  document.body.appendChild(card);
  
  if (window.lucide) {
    window.lucide.createIcons();
  }
  
  document.getElementById('github-update-close-btn').addEventListener('click', () => {
    card.classList.add('fade-out');
    sessionStorage.setItem('hide_update_notification', 'true');
    setTimeout(() => card.remove(), 400);
  });

  // Ayarlar sekmesindeki sürüm numarasının yanına yeşil bir badge ekle
  const settingsVersion = document.getElementById('settings-version');
  if (settingsVersion && !document.getElementById('settings-update-badge')) {
    const badge = document.createElement('span');
    badge.id = 'settings-update-badge';
    badge.className = 'update-badge-settings';
    badge.textContent = isEn ? 'Update Available' : 'Güncelleme Var';
    badge.style.cssText = 'font-size: 0.75rem; background: #22c55e; color: #fff; padding: 2px 6px; border-radius: 4px; margin-left: 8px; font-weight: 600; display: inline-block; cursor: pointer;';
    badge.onclick = () => window.open(update.releaseUrl, '_blank');
    settingsVersion.parentNode.appendChild(badge);
  }
}


/**
 * Aktif indirme ilerlemesini (yüzde, hız, boyut vb.) canlı olarak arayüzde günceller.
 * 
 * @param {object} data İlerleme veri nesnesi
 */
function updateActiveDownloadProgress(data) {
  noActiveDownload.classList.add('hidden');
  activeDownloadDetails.classList.remove('hidden');

  activeProgressBar.style.width = `${data.progress}%`;
  activePercent.textContent = `${data.progress}%`;
  activeSize.textContent = data.fileSize || '-- MB';
  activeEta.textContent = data.eta || '--:--';
  activeSpeed.textContent = data.speed || '0 KB/s';
}

// Türkçe Açıklama: ISO formatındaki tarih dizgelerini Türkiye saat dilimi ve formatına uygun şekilde (GG.AA.YYYY SS:DK) biçimlendirir.
/**
 * ISO tarih dizgesini Türkçe yerel tarih ve saat formatına çevirir (GG.AA.YYYY SS:DK).
 * 
 * @param {string} isoString ISO tarih dizgesi
 * @returns {string} Biçimlendirilmiş tarih metni
 */
function formatDate(isoString) {
  if (!isoString) return '--';
  const date = new Date(isoString);
  return date.toLocaleString('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

/**
 * Verilen ISO tarih dizgesine göre bugünden geriye kaç gün geçtiğini hesaplar ve Türkçe/İngilizce metin döner.
 * 
 * @param {string} dateStr ISO tarih dizgesi
 * @param {boolean} isEn İngilizce dil desteği aktif mi
 * @returns {string} Kaç gün geçtiğini belirten metin
 */
function getDaysAgoText(dateStr, isEn = false) {
  if (!dateStr || dateStr === '-') return '';
  try {
    const pubDate = new Date(dateStr);
    const now = new Date();
    
    // Saat, dakika, saniyeleri sıfırlayarak sadece gün farkını al
    const pubZero = new Date(pubDate.getFullYear(), pubDate.getMonth(), pubDate.getDate());
    const nowZero = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    const diffMs = nowZero - pubZero;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays <= 0) {
      return isEn ? 'Today' : 'Bugün';
    } else if (diffDays === 1) {
      return isEn ? 'Yest.' : 'Dün';
    } else {
      return isEn ? `${diffDays}d` : `${diffDays}g`;
    }
  } catch (e) {
    return '';
  }
}

// Türkçe Açıklama: Dosya boyutu metnini (Örn: 15.4 MB, 1.2 GB) karşılaştırma yapabilmek için sayısal byte değerine çevirir.
/**
 * Dosya boyutu dizgesini byte cinsinden sayısal değere çevirir.
 * 
 * @param {string} sizeStr Dosya boyutu dizgesi (Örn: "15.4 MB")
 * @returns {number} Byte cinsinden sayısal değer
 */
function parseSizeToBytes(sizeStr) {
  if (!sizeStr || sizeStr === '--' || sizeStr === '-- MB') return 0;
  const cleanStr = sizeStr.replace(/[^0-9.,a-zA-Z]/g, '').trim();
  const match = cleanStr.match(/^([0-9.,]+)\s*([a-zA-Z]+)$/i) || cleanStr.match(/^([0-9.,]+)$/);
  if (!match) return 0;
  const numStr = match[1].replace(',', '.');
  const val = parseFloat(numStr);
  if (isNaN(val)) return 0;
  const unit = (match[2] || '').toUpperCase();
  if (unit.includes('G')) return val * 1024 * 1024 * 1024;
  if (unit.includes('M')) return val * 1024 * 1024;
  if (unit.includes('K')) return val * 1024;
  return val;
}

// Türkçe Açıklama: Arayüzdeki kütüphane veya indirilenler listesindeki video kartlarını grid (ızgara) ya da liste görünümünde dinamik olarak çizer.
/**
 * Video listesini belirtilen grid elementi içerisine kart veya liste düzeninde çizer.
 * 
 * @param {HTMLElement} gridElement Hedef DOM elemanı
 * @param {Array<object>} videosList Çizilecek videoların dizisi
 * @param {string} viewMode Görünüm modu ('grid' veya 'list')
 */
function renderVideoGrid(gridElement, videosList, viewMode) {
  if (!gridElement) return;
  gridElement.innerHTML = '';
  
  if (viewMode === 'list') {
    gridElement.classList.add('compact-list');
  } else {
    gridElement.classList.remove('compact-list');
  }

  const isEn = localDb.settings && localDb.settings.lang === 'en';

  if (videosList.length === 0) {
    gridElement.innerHTML = `
      <div class="card text-center" style="grid-column: 1 / -1; padding: 40px; background-color: var(--bg-card); border: 1px solid var(--border-color); border-radius: 16px;">
        <p class="text-muted">${isEn ? 'No video records match the filter.' : 'Filtreye uygun video kaydı bulunmuyor.'}</p>
      </div>
    `;
    return;
  }

  videosList.forEach(item => {
    const isShort = isShortVideo(item.duration, item.title, item.channelId);
    const card = document.createElement('div');
    card.className = 'video-card' + (isShort ? ' is-short' : '');
    card.setAttribute('data-id', item.id);
    if (typeof downloadedSortVal !== 'undefined' && downloadedSortVal === 'user' && gridElement === downloadedGrid) {
      card.setAttribute('draggable', 'true');
    }
    
    let statusHtml = '';
    let actionsHtml = '';

    const isMissing = item.fileMissing === true;
    const isCompleted = item.status === 'completed';
    const canPlayEmbedded = isCompleted && !isMissing;

    const clickAction = `playVideoEmbedded('${item.id}')`;
    const clickTitle = isEn ? 'Play video' : 'Videoyu Gömülü Oynatıcıda Aç';

    if (item.status === 'completed') {
      if (isMissing) {
        statusHtml = `<span class="status-dot-warning" title="${isEn ? 'File not found on disk!' : 'Dosya disk üzerinde bulunamadı!'}"></span>`;
        actionsHtml = `
          <button class="btn-icon" onclick="openYouTube('${item.id}')" title="${isEn ? 'Open on YouTube' : 'YouTube\'da Aç'}">
            ${youtubeSvgIcon}
          </button>
          <button class="btn-icon btn-icon-primary" disabled title="${isEn ? 'File missing on disk' : 'Dosya diskte mevcut değil'}" style="opacity:0.4; cursor:not-allowed;">
            <i data-lucide="tv"></i>
          </button>
          <button class="btn-icon" disabled title="${isEn ? 'File missing on disk' : 'Dosya diskte mevcut değil'}" style="opacity:0.4; cursor:not-allowed;">
            <i data-lucide="folder-open"></i>
          </button>
        `;
      } else {
        statusHtml = `<span class="status-dot-completed" title="${isEn ? 'Downloaded' : 'İndirildi'}"></span>`;
        actionsHtml = `
          <button class="btn-icon" onclick="openYouTube('${item.id}')" title="${isEn ? 'Open on YouTube' : 'YouTube\'da Aç'}">
            ${youtubeSvgIcon}
          </button>
          <button class="btn-icon btn-icon-primary" onclick="playVideoSystem('${item.id}')" title="${isEn ? 'Open in System Player' : 'Sistem Oynatıcısında Aç'}">
            <i data-lucide="tv"></i>
          </button>
          <button class="btn-icon" onclick="openFolder(decodeURIComponent('${encodeURIComponent(item.channelName)}'))" title="${isEn ? 'Open Channel Folder' : 'Kanal Klasörünü Aç'}">
            <i data-lucide="folder-open"></i>
          </button>
        `;
      }
    } else if (item.status === 'downloading') {
      statusHtml = `<span class="status-pill downloading"><i data-lucide="loader" class="pulse-animation" style="width:12px;height:12px;margin-right:4px;"></i> ${isEn ? 'Downloading' : 'İndiriliyor'} (${item.progress}%)</span>`;
      actionsHtml = `
        <button class="btn-icon" onclick="cancelDownload('${item.id}')" title="${isEn ? 'Cancel Download' : 'İndirmeyi İptal Et'}" style="color: var(--accent-red); background: rgba(255, 0, 85, 0.05); border: 1px solid rgba(255, 0, 85, 0.15);">
          <i data-lucide="square"></i>
        </button>
        <button class="btn-icon" onclick="openYouTube('${item.id}')" title="YouTube'da Aç">
          ${youtubeSvgIcon}
        </button>
      `;
    } else if (item.status === 'waiting') {
      statusHtml = `<span class="status-pill waiting"><i data-lucide="clock" style="width:12px;height:12px;margin-right:4px;"></i> ${isEn ? 'In Queue' : 'Kuyrukta'}</span>`;
      actionsHtml = `
        <button class="btn-icon" onclick="cancelQueuedVideo('${item.id}')" title="${isEn ? 'Cancel' : 'İptal Et'}" style="color: var(--accent-red); background: rgba(255, 0, 85, 0.05); border: 1px solid rgba(255, 0, 85, 0.15);">
          <i data-lucide="square"></i>
        </button>
        <button class="btn-icon" onclick="openYouTube('${item.id}')" title="YouTube'da Aç">
          ${youtubeSvgIcon}
        </button>
      `;
    } else if (item.status === 'failed') {
      statusHtml = `<span class="status-pill failed" title="${item.error || ''}"><i data-lucide="alert-circle" style="width:12px;height:12px;margin-right:4px;"></i> ${isEn ? 'Error' : 'Hata'}</span>`;
      actionsHtml = `
        <button class="btn-icon" onclick="downloadVideoManual('${item.id}')" title="${isEn ? 'Retry Download' : 'Yeniden İndirmeyi Dene'}">
          <i data-lucide="rotate-ccw"></i>
        </button>
        <button class="btn-icon" onclick="openYouTube('${item.id}')" title="YouTube'da Aç">
          ${youtubeSvgIcon}
        </button>
      `;
    } else if (item.status === 'ignored') {
      statusHtml = `<span class="status-dot-warning" style="background-color: var(--accent-red); box-shadow: 0 0 8px rgba(255, 0, 85, 0.8);" title="${isEn ? 'Ignored' : 'Göz Ardı Edildi'}"></span>`;
      actionsHtml = `
        <button class="btn-icon" onclick="downloadVideoManual('${item.id}')" title="${isEn ? 'Download Now' : 'Videoyu Şimdi İndir'}">
          <i data-lucide="download"></i>
        </button>
        <button class="btn-icon" onclick="openYouTube('${item.id}')" title="YouTube'da Aç">
          ${youtubeSvgIcon}
        </button>
      `;
    }

    if (item.status === 'completed') {
      actionsHtml += `
        <button class="btn-icon video-action-delete" onclick="showDeleteModal('${item.id}')" title="${isEn ? 'Delete from History/Disk' : 'Geçmişten/Diskten Sil'}">
          <i data-lucide="trash-2"></i>
        </button>
      `;
    }

    let durationText = item.duration || '';
    if (durationText === 'upcoming') {
      durationText = isEn ? 'Upcoming' : 'Yakında';
    } else if (durationText === 'live') {
      durationText = isEn ? 'Live' : 'Canlı';
    }

    const durationBadgeHtml = durationText 
      ? `<div class="video-duration-badge">${durationText}</div>` 
      : '';

    const shortsBadgeHtml = isShort 
      ? `<div class="video-shorts-badge"><i data-lucide="zap" style="width:10px;height:10px;margin-right:2px;"></i> Shorts</div>` 
      : '';

    const shortsTagHtml = isShort 
      ? `<span class="video-card-shorts-tag"><i data-lucide="zap" style="width:10px;height:10px;margin-right:2px;"></i> Shorts</span>` 
      : '';

    card.innerHTML = `
      <div class="video-thumbnail-wrapper" onclick="${clickAction}" style="cursor: pointer;" title="${clickTitle}">
        <img class="video-thumbnail" src="/api/video/${item.id}/thumbnail" alt="Video Resmi" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22320%22 height=%22180%22><rect width=%22320%22 height=%22180%22 fill=%22%2316142a%22/><text x=%2250%25%22 y=%2250%25%22 dominant-baseline=%22middle%22 text-anchor=%22middle%22 fill=%22%2394a3b8%22 font-family=%22sans-serif%22 font-size=%2214%22>Kapak Resmi Yok</text></svg>'">
        ${durationBadgeHtml}
        ${shortsBadgeHtml}
      </div>
      <div class="video-card-content">
        <h3 class="video-card-title" onclick="${clickAction}" style="cursor: pointer;" title="${clickTitle}: ${escapeHtml(item.title)}">${escapeHtml(item.title)}</h3>
        <div style="display:flex; align-items:center; gap:8px; margin-bottom:8px;">
          <span class="video-card-duration-text">${durationText || (isEn ? 'Duration Not Specified' : 'Süre Belirtilmedi')}</span>
          ${shortsTagHtml}
        </div>
        <div class="video-card-metadata">
          <span class="video-card-channel">
            ${item.channelId 
              ? `<img src="/api/channels/${item.channelId}/avatar" class="video-card-channel-avatar" onerror="this.style.display='none';" />` 
              : ''}
            ${escapeHtml(item.channelName)}
          </span>
          <span>${isEn ? 'Date' : 'Tarih'}: ${formatDate(item.publishedAt || item.downloadedAt)}</span>
          ${item.status === 'completed' ? `<span>${isEn ? 'Size' : 'Boyut'}: ${item.fileSize || '-- MB'}</span>` : ''}
        </div>
        <div class="video-card-bottom">
          <div style="display: flex; align-items: center; gap: 8px;">
            ${statusHtml}
            <span class="video-card-age-text" style="font-size: 0.75rem; color: var(--text-muted); font-weight: 500; display: inline-block;">
              ${getDaysAgoText(item.publishedAt || item.downloadedAt, isEn)}
            </span>
          </div>
          <div class="video-card-actions">
            ${actionsHtml}
          </div>
        </div>
      </div>
    `;
    gridElement.appendChild(card);
  });
  
  lucide.createIcons();
}

// Türkçe Açıklama: Sunucudan veya SSE bağlantısından gelen güncel veritabanı verilerine göre tüm ekran kartlarını, istatistikleri ve listeleri günceller.
/**
 * Veritabanı nesnesine göre arayüzdeki istatistikleri, video listelerini ve ayar formlarını günceller.
 * 
 * @param {object} db Veritabanı veri nesnesi
 */
function updateUI(db) {
  if (!db) return;

  if (db.settings && db.settings.subtitleColor) {
    document.documentElement.style.setProperty('--subtitle-color', db.settings.subtitleColor);
  }
  if (db.settings && db.settings.subtitleOpacity !== undefined) {
    document.documentElement.style.setProperty('--subtitle-bg-opacity', db.settings.subtitleOpacity);
  }
  if (db.settings && db.settings.subtitleSize !== undefined) {
    document.documentElement.style.setProperty('--subtitle-font-size', db.settings.subtitleSize);
  }

  // 1. Sistem Durum Detayları
  const isEn = db.settings && db.settings.lang === 'en';
  const lang = db.settings?.lang || currentLang || 'tr';
  const t = translations[lang] || translations.tr;
  const browserNames = isEn ? {
    chrome: 'Google Chrome',
    edge: 'Microsoft Edge',
    msedge: 'Microsoft Edge',
    firefox: 'Mozilla Firefox',
    brave: 'Brave',
    opera: 'Opera',
    none: 'Disabled'
  } : {
    chrome: 'Google Chrome',
    edge: 'Microsoft Edge',
    msedge: 'Microsoft Edge',
    firefox: 'Mozilla Firefox',
    brave: 'Brave',
    opera: 'Opera',
    none: 'Devre Dışı'
  };
  
  if (cookieStatus && db.settings) {
    cookieStatus.textContent = browserNames[db.settings.browser] || (isEn ? 'Not Specified' : 'Belirtilmedi');
  }
  
  const qualityNames = isEn ? {
    best: 'Best Quality',
    '1080p': '1080p FHD',
    '720p': '720p HD'
  } : {
    best: 'En Yüksek',
    '1080p': '1080p FHD',
    '720p': '720p HD'
  };
  if (qualityStatus && db.settings) {
    qualityStatus.textContent = qualityNames[db.settings.quality] || (isEn ? 'Automatic' : 'Otomatik');
  }

  // 2. İstatistik Sayıcılar
  if (statChannelCount && db.channels) statChannelCount.textContent = db.channels.length;
  const channelsTotalCount = document.getElementById('channels-total-count');
  if (channelsTotalCount && db.channels) channelsTotalCount.textContent = `${db.channels.length} Kanal`;
  
  if (db.history) {
    const downloadedVideos = db.history.filter(h => h.status === 'completed');
    if (statDownloadedCount) statDownloadedCount.textContent = downloadedVideos.length;

    const waitingVideos = db.history.filter(h => h.status === 'waiting');
    if (statWaitingCount) statWaitingCount.textContent = waitingVideos.length;

    // 3. Aktif İndirme ve İndirme Sırası
    const activeDownload = db.history.find(h => h.status === 'downloading');
    const activeMerging = db.history.find(h => h.status === 'merging');
    
    if (activeDownload) {
      if (noActiveDownload) noActiveDownload.classList.add('hidden');
      if (activeDownloadDetails) {
        activeDownloadDetails.classList.remove('hidden');
        if (activeTitle) activeTitle.textContent = activeDownload.title;
        if (activeChannel) activeChannel.textContent = activeDownload.channelName;
        if (activeProgressBar) activeProgressBar.style.width = `${activeDownload.progress}%`;
        if (activePercent) activePercent.textContent = `${activeDownload.progress}%`;
        if (activeSize) activeSize.textContent = activeDownload.fileSize || '-- MB';
        if (activeEta) activeEta.textContent = activeDownload.eta || '--:--';
      }
      if (activeSpeed) activeSpeed.textContent = activeDownload.speed || '0 KB/s';
    } else if (activeMerging) {
      if (noActiveDownload) noActiveDownload.classList.add('hidden');
      if (activeDownloadDetails) {
        activeDownloadDetails.classList.remove('hidden');
        if (activeTitle) activeTitle.textContent = activeMerging.title;
        if (activeChannel) activeChannel.textContent = activeMerging.channelName;
        if (activeProgressBar) activeProgressBar.style.width = `100%`;
        if (activePercent) activePercent.textContent = t.status_merging || 'Birleştiriliyor (FFmpeg)...';
        if (activeSize) activeSize.textContent = activeMerging.fileSize || '-- MB';
        if (activeEta) activeEta.textContent = '--:--';
      }
      if (activeSpeed) activeSpeed.textContent = 'FFmpeg...';
    } else {
      if (noActiveDownload) noActiveDownload.classList.remove('hidden');
      if (activeDownloadDetails) activeDownloadDetails.classList.add('hidden');
      if (activeSpeed) activeSpeed.textContent = '0 MB/s';
    }

    // 4. Kuyruk Listesi
    if (queueList) {
      queueList.innerHTML = '';
      const isEn = db.settings && db.settings.lang === 'en';
      const mergingVideos = db.history.filter(h => h.status === 'merging');
      
      if (waitingVideos.length === 0 && mergingVideos.length === 0) {
        queueList.innerHTML = `
          <div class="text-center text-muted" id="queue-list-empty" style="padding: 30px 0; font-size: 0.85rem;">${isEn ? 'No videos waiting in the queue.' : 'Kuyrukta bekleyen video yok.'}</div>
        `;
      } else {
        // Önce birleştirilen videoları ekle (en üstte dursunlar, sürüklenemezler)
        mergingVideos.forEach(video => {
          const item = document.createElement('div');
          item.className = 'queue-item queue-item-merging';
          item.setAttribute('draggable', 'false');
          item.setAttribute('data-id', video.id);
          item.style.borderColor = 'rgba(234, 179, 8, 0.3)';
          item.style.background = 'rgba(234, 179, 8, 0.03)';
          item.innerHTML = `
            <div class="queue-item-drag-handle" style="display: flex; align-items: center; justify-content: center; padding-right: 12px; color: var(--text-muted); cursor: not-allowed;" title="${isEn ? 'Merging process cannot be reordered' : 'Birleştirme işlemi sıralanamaz'}">
              <i data-lucide="loader" class="spin-animation" style="width:16px; height:16px; color: #eab308;"></i>
            </div>
            <img src="https://i.ytimg.com/vi/${video.id}/mqdefault.jpg" class="queue-item-thumbnail" onerror="this.src='logo.png'">
            <div class="queue-item-info" style="flex:1;">
              <div class="queue-item-title" title="${escapeHtml(video.title)}" style="font-weight:600; color:var(--text-main);">${escapeHtml(video.title)}</div>
              <div style="display: flex; align-items: center; gap: 8px; margin-top: 2px;">
                <span class="queue-item-channel" style="font-size:0.7rem; display: flex; align-items: center; gap: 2px;">
                  <i data-lucide="tv" style="width: 10px; height: 10px;"></i>
                  ${escapeHtml(video.channelName)}
                </span>
                <span class="queue-item-status-badge" style="font-size:0.68rem; display:inline-flex; align-items:center; gap:4px; padding: 1px 6px; border-radius: 4px; background: rgba(234, 179, 8, 0.1); color: #eab308; border: 1px solid rgba(234, 179, 8, 0.2); font-weight: 600;">
                  <i data-lucide="cog" class="spin-animation" style="width: 10px; height: 10px;"></i>
                  <span>${t.status_merging || 'Birleştiriliyor...'}</span>
                </span>
              </div>
            </div>
            <div class="queue-item-actions">
              <button class="btn-cancel-queue" onclick="cancelDownload('${video.id}')" title="${isEn ? 'Cancel' : 'İptal Et'}">
                <i data-lucide="x" style="width: 12px; height: 12px;"></i>
                <span>${isEn ? 'Cancel' : 'İptal Et'}</span>
              </button>
            </div>
          `;
          queueList.appendChild(item);
        });

        // Sonra bekleyen videoları ekle
        waitingVideos.forEach(video => {
          const item = document.createElement('div');
          item.className = 'queue-item';
          item.setAttribute('draggable', 'true');
          item.setAttribute('data-id', video.id);
          item.innerHTML = `
            <div class="queue-item-drag-handle" style="cursor: grab; display: flex; align-items: center; justify-content: center; padding-right: 12px; color: var(--text-muted);" title="${isEn ? 'Drag to reorder' : 'Sürükleyip sıralayın'}">
              <i data-lucide="grip-vertical" style="width:16px; height:16px;"></i>
            </div>
            <img src="https://i.ytimg.com/vi/${video.id}/mqdefault.jpg" class="queue-item-thumbnail" onerror="this.src='logo.png'">
            <div class="queue-item-info" style="flex:1;">
              <div class="queue-item-title" title="${escapeHtml(video.title)}" style="font-weight:600; color:var(--text-main);">${escapeHtml(video.title)}</div>
              <div class="queue-item-channel" style="font-size:0.78rem;">
                <i data-lucide="tv" style="width: 10px; height: 10px; display: inline-block; vertical-align: middle; margin-right: 2px;"></i>
                ${escapeHtml(video.channelName)}
              </div>
            </div>
            <div class="queue-item-actions">
              <button class="btn-cancel-queue" onclick="cancelQueuedVideo('${video.id}')" title="${isEn ? 'Cancel' : 'İptal Et'}">
                <i data-lucide="x" style="width: 12px; height: 12px;"></i>
                <span>${isEn ? 'Cancel' : 'İptal Et'}</span>
              </button>
            </div>
          `;
          
          // Drag and drop olaylarını ekle
          item.addEventListener('dragstart', handleDragStart);
          item.addEventListener('dragover', handleDragOver);
          item.addEventListener('drop', handleDrop);
          item.addEventListener('dragend', handleDragEnd);
          
          queueList.appendChild(item);
        });
      }
    }
  }

  // 5. Kanallar Listesi (Alfabetik Sıralı)
  if (channelsList && db.channels) {
    channelsList.innerHTML = '';
    if (db.channels.length === 0) {
      channelsList.innerHTML = `
        <div class="channels-empty-state">
          <div class="channels-empty-icon">
            <i data-lucide="tv-2"></i>
          </div>
          <h3>${t.empty_channels_title || 'Henüz takip edilen kanal yok'}</h3>
          <p>${t.empty_channels_desc || 'Yukarıdaki formdan YouTube kanal linki veya kullanıcı adı girerek kanal ekleyebilirsiniz.'}</p>
        </div>
      `;
    } else {
      // Alfabetik sıralama
      const sortedChannels = [...db.channels].sort((a, b) => 
        (a.name || '').localeCompare(b.name || '', 'tr', { sensitivity: 'base' })
      );
      
      sortedChannels.forEach((channel, index) => {
        const channelInitial = (channel.name || 'Y').split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
        
        // YouTube kanal URL'si oluştur
        const channelUrl = channel.handle 
          ? (channel.handle.startsWith('http') ? channel.handle : `https://www.youtube.com/${channel.handle.startsWith('@') ? channel.handle : '@' + channel.handle}`)
          : `https://www.youtube.com/channel/${channel.id}`;
        
        // Kanal profil resmi URL'si (YouTube thumbnail API)
        const avatarImgId = `ch-avatar-${channel.id}`;
        
        const row = document.createElement('div');
        row.className = 'channel-list-item';
        row.style.animationDelay = `${index * 0.04}s`;
        row.innerHTML = `
          <div class="channel-list-rank">${index + 1}</div>
          <div class="channel-list-avatar-wrap">
            <img 
              id="${avatarImgId}"
              class="channel-list-avatar-img"
              // Türkçe Açıklama: Kanal logosu yerel sunucu API'si üzerinden linklendi.
              src="/api/channels/${channel.id}/avatar"
              alt="${escapeHtml(channel.name)}"
              onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';"
            />
            <div class="channel-list-avatar-fallback" style="display:none;">${channelInitial}</div>
          </div>
          <div class="channel-list-info">
            <a class="channel-list-name" href="${channelUrl}" target="_blank" rel="noopener noreferrer" title="YouTube'da Aç: ${escapeHtml(channel.name)}">
              ${escapeHtml(channel.name)}
              <i data-lucide="external-link" style="width:13px;height:13px;display:inline-block;vertical-align:middle;margin-left:5px;opacity:0.5;"></i>
            </a>
            <span class="channel-list-handle">${escapeHtml(channel.handle || '')}</span>
          </div>
          <div class="channel-list-quality">
            <select onchange="changeChannelQuality('${channel.id}', this.value)" class="channel-quality-select" title="${t.channel_quality_title || 'İndirme Kalitesi'}">
              <option value="default" ${(!channel.quality || channel.quality === 'default') ? 'selected' : ''}>${t.select_quality_default || 'Varsayılan Kalite'}</option>
              <option value="best" ${channel.quality === 'best' ? 'selected' : ''}>${t.select_quality_best || 'En Yüksek'}</option>
              <option value="1080p" ${channel.quality === '1080p' ? 'selected' : ''}>${t.select_quality_1080p || '1080p FHD'}</option>
              <option value="720p" ${channel.quality === '720p' ? 'selected' : ''}>${t.select_quality_720p || '720p HD'}</option>
            </select>
          </div>
          <div class="channel-list-auto-download">
            <select onchange="changeChannelAutoDownload('${channel.id}', this.value)" class="channel-auto-download-select" title="${t.select_auto_download_title || 'Otomatik İndirme Durumu'}">
              <option value="true" ${channel.autoDownload !== false ? 'selected' : ''}>${t.select_auto_download_true || 'Otomatik İndir'}</option>
              <option value="false" ${channel.autoDownload === false ? 'selected' : ''}>${t.select_auto_download_false || 'Otomatik İndirme'}</option>
            </select>
          </div>
          <div class="channel-list-shorts">
            <select onchange="changeChannelShorts('${channel.id}', this.value)" class="channel-shorts-select" title="${t.channel_shorts_title || 'Shorts İndirme Durumu'}">
              <option value="true" ${channel.downloadShorts !== false ? 'selected' : ''}>${t.select_shorts_true || 'Shorts İndir'}</option>
              <option value="false" ${channel.downloadShorts === false ? 'selected' : ''}>${t.select_shorts_false || 'Shorts İndirme'}</option>
            </select>
          </div>
          <div class="channel-list-shorts-limit">
            <select onchange="changeChannelShortsLimit('${channel.id}', this.value)" class="channel-shorts-limit-select" title="${t.channel_shorts_limit_title || 'Shorts Süre Sınırı'}">
              <option value="30" ${channel.shortsDurationLimit == 30 ? 'selected' : ''}>Shorts &lt; 30${t.shorts_limit_seconds || 'sn'}</option>
              <option value="60" ${channel.shortsDurationLimit == 60 ? 'selected' : ''}>Shorts &lt; 60${t.shorts_limit_seconds || 'sn'} (1 ${t.shorts_limit_minutes || 'dk'})</option>
              <option value="120" ${channel.shortsDurationLimit == 120 ? 'selected' : ''}>Shorts &lt; 120${t.shorts_limit_seconds || 'sn'} (2 ${t.shorts_limit_minutes || 'dk'})</option>
              <option value="180" ${(!channel.shortsDurationLimit || channel.shortsDurationLimit == 180) ? 'selected' : ''}>Shorts &lt; 180${t.shorts_limit_seconds || 'sn'} (3 ${t.shorts_limit_minutes || 'dk'})</option>
              <option value="240" ${channel.shortsDurationLimit == 240 ? 'selected' : ''}>Shorts &lt; 240${t.shorts_limit_seconds || 'sn'} (4 ${t.shorts_limit_minutes || 'dk'})</option>
              <option value="300" ${channel.shortsDurationLimit == 300 ? 'selected' : ''}>Shorts &lt; 300${t.shorts_limit_seconds || 'sn'} (5 ${t.shorts_limit_minutes || 'dk'})</option>
              <option value="600" ${channel.shortsDurationLimit == 600 ? 'selected' : ''}>Shorts &lt; 600${t.shorts_limit_seconds || 'sn'} (10 ${t.shorts_limit_minutes || 'dk'})</option>
              <option value="900" ${channel.shortsDurationLimit == 900 ? 'selected' : ''}>Shorts &lt; 900${t.shorts_limit_seconds || 'sn'} (15 ${t.shorts_limit_minutes || 'dk'})</option>
            </select>
          </div>
          <div class="channel-list-meta">
            <span class="channel-list-date">
              <i data-lucide="calendar" style="width:11px;height:11px;vertical-align:middle;margin-right:3px;"></i>
              ${formatDate(channel.addedAt).split(' ')[0]}
            </span>
          </div>
          <div class="channel-list-actions">
            <button class="btn-icon channel-rss-update-btn" onclick="syncSingleChannelRss('${channel.id}')" title="${t.channel_btn_sync_title || 'Kanalı Şimdi Denetle / RSS Güncelle'}">
              <i data-lucide="refresh-cw" style="color:#a855f7;"></i>
            </button>
            <button class="btn-icon channel-logo-update-btn" onclick="updateChannelAvatar('${channel.id}')" title="${t.channel_btn_update_logo_title || 'Logoyu Güncelle'}">
              <i data-lucide="image" style="color:#38bdf8;"></i>
            </button>
            <a href="${channelUrl}" target="_blank" rel="noopener noreferrer" class="btn-icon channel-open-btn" title="${t.inline_btn_youtube || 'YouTube\'da Aç'}">
              ${youtubeSvgIcon}
            </a>
            <button class="btn-icon channel-delete-icon-btn" onclick="deleteChannel('${channel.id}')" title="${t.channel_btn_unfollow_title || 'Takipten Çıkar'}">
              <i data-lucide="trash-2"></i>
            </button>
          </div>
        `;
        channelsList.appendChild(row);
      });
    }
  }

  // 6. Geçmiş Kanal Filtresi Seçeneklerini Doldur (Alfabetik Sıralı)
  if (historyChannelFilter && db.channels) {
    const currentFilterVal = historyChannelFilter.value || 'all';
    historyChannelFilter.innerHTML = `<option value="all">${t.filter_all_channels || 'Tüm Kanallar'}</option>`;
    
    // Kanalları alfabetik olarak sırala
    const sortedFilterChannels = [...db.channels].sort((a, b) => a.name.localeCompare(b.name, 'tr'));
    sortedFilterChannels.forEach(channel => {
      const opt = document.createElement('option');
      opt.value = channel.id;
      opt.textContent = channel.name;
      historyChannelFilter.appendChild(opt);
    });
    historyChannelFilter.value = currentFilterVal;
    historyFilterChannel = historyChannelFilter.value; // Senkronize et
  }

  // İndirilen Videolar Kanal Filtresi Seçeneklerini Doldur
  if (downloadedChannelFilter && db.channels) {
    const currentFilterVal = downloadedChannelFilter.value || 'all';
    downloadedChannelFilter.innerHTML = `<option value="all">${t.filter_all_channels || 'Tüm Kanallar'}</option>`;
    
    // Kanalları alfabetik olarak sırala
    const sortedFilterChannels = [...db.channels].sort((a, b) => a.name.localeCompare(b.name, 'tr'));
    sortedFilterChannels.forEach(channel => {
      const opt = document.createElement('option');
      opt.value = channel.id;
      opt.textContent = channel.name;
      downloadedChannelFilter.appendChild(opt);
    });
    downloadedChannelFilter.value = currentFilterVal;
    downloadedFilterChannel = downloadedChannelFilter.value; // Senkronize et
  }

  // Yerleşik oynatma listesi sidebar filtrelerini doldur ve senkronize et
  if (typeof updateSidebarSortButtons === 'function') {
    updateSidebarSortButtons();
  }

  // Normal sayfadaki sıralama butonlarının aktifliğini güncelle
  const downloadedSortGroup = document.getElementById('downloaded-sort-group');
  if (downloadedSortGroup) {
    downloadedSortGroup.querySelectorAll('.sort-btn').forEach(b => {
      if (b.getAttribute('data-sort') === downloadedSortVal) {
        b.classList.add('active');
      } else {
        b.classList.remove('active');
      }
    });
  }

  const inlinePlaylistShowShorts = document.getElementById('inline-playlist-show-shorts');
  if (inlinePlaylistShowShorts) {
    inlinePlaylistShowShorts.checked = db.settings?.showShorts !== false;
  }

  const historyOnlyNotDownloadedCheck = document.getElementById('history-only-not-downloaded');
  if (historyOnlyNotDownloadedCheck) {
    historyOnlyNotDownloadedCheck.checked = historyOnlyNotDownloaded;
  }
  const historyOnlyNoAutoDownloadCheck = document.getElementById('history-only-no-auto-download');
  if (historyOnlyNoAutoDownloadCheck) {
    historyOnlyNoAutoDownloadCheck.checked = historyOnlyNoAutoDownload;
  }

  // Görünüm butonlarının aktiflik durumunu güncelle
  if (viewGridBtn) viewGridBtn.classList.toggle('active', historyViewMode === 'grid');
  if (viewListBtn) viewListBtn.classList.toggle('active', historyViewMode === 'list');
  
  if (downloadedViewGridBtn) downloadedViewGridBtn.classList.toggle('active', downloadedViewMode === 'grid');
  if (downloadedViewListBtn) downloadedViewListBtn.classList.toggle('active', downloadedViewMode === 'list');
  
  if (historyGrid) {
    if (historyViewMode === 'list') {
      historyGrid.classList.add('compact-list');
    } else {
      historyGrid.classList.remove('compact-list');
    }
  }

  if (downloadedGrid) {
    if (downloadedViewMode === 'list') {
      downloadedGrid.classList.add('compact-list');
    } else {
      downloadedGrid.classList.remove('compact-list');
    }
  }

  // Geçmişi filtrele ve çiz
  if (historyGrid && db.history && db.settings) {
    // Sadece takip edilen kanalları Kütüphane listesinde göster (PD/elle eklenen takip dışı kanallar elenir)
    const trackedChannelIds = new Set((db.channels || []).map(c => c.id));
    let filteredHistory = db.history.filter(item => item.channelId && trackedChannelIds.has(item.channelId));
    
    if (historyFilterChannel !== 'all') {
      filteredHistory = filteredHistory.filter(item => item.channelId === historyFilterChannel);
    }
    
    if (historyOnlyNoAutoDownload) {
      const disabledChannelIds = new Set((db.channels || []).filter(c => c.autoDownload === false).map(c => c.id));
      filteredHistory = filteredHistory.filter(item => disabledChannelIds.has(item.channelId));
    }
    
    if (historyOnlyNotDownloaded) {
      filteredHistory = filteredHistory.filter(item => item.status !== 'completed');
    }
    
    if (historyFilterDays !== 'all') {
      filteredHistory = filteredHistory.filter(item => {
        const dateStr = item.publishedAt || item.downloadedAt;
        if (!dateStr || dateStr === '-') return false;
        try {
          const pubDate = new Date(dateStr);
          const now = new Date();
          
          const pubZero = new Date(pubDate.getFullYear(), pubDate.getMonth(), pubDate.getDate());
          const nowZero = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          
          const diffMs = nowZero - pubZero;
          const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
          
          if (historyFilterDays === '0') {
            return diffDays <= 0;
          } else if (historyFilterDays === '1') {
            return diffDays === 1;
          } else {
            const maxDays = parseInt(historyFilterDays, 10);
            return diffDays <= maxDays;
          }
        } catch (e) {
          return false;
        }
      });
    }
    
    const showShorts = db.settings.showShorts !== false;
    if (!showShorts) {
      filteredHistory = filteredHistory.filter(item => !isShortVideo(item.duration, item.title, item.channelId));
    }
    
    // Yüklenme tarihine göre sırala (Yeni olan en üstte)
    filteredHistory.sort((a, b) => {
      const dateA = new Date(a.publishedAt || a.downloadedAt || 0).getTime();
      const dateB = new Date(b.publishedAt || b.downloadedAt || 0).getTime();
      return dateB - dateA;
    });

    // Kanal başına geçmiş limiti sadece Kütüphane sayfasında uygula
    const limit = db.settings.historyLimitPerChannel || 30;
    const limitedHistory = [];
    const channelCounts = {};
    for (const item of filteredHistory) {
      const channelId = item.channelId || 'manual';
      if (!channelCounts[channelId]) {
        channelCounts[channelId] = 0;
      }
      if (channelCounts[channelId] < limit) {
        limitedHistory.push(item);
        channelCounts[channelId]++;
      }
    }
    filteredHistory = limitedHistory;
    
    renderVideoGrid(historyGrid, filteredHistory, historyViewMode);
  }

  // İndirilen Videoları filtrele ve çiz
  if (downloadedGrid && db.history && db.settings) {
    let filteredDownloaded = db.history.filter(item => item.status === 'completed');
    
    if (downloadedFilterChannel !== 'all') {
      filteredDownloaded = filteredDownloaded.filter(item => item.channelId === downloadedFilterChannel);
    }
    
    const showShorts = db.settings.showShorts !== false;
    if (!showShorts) {
      filteredDownloaded = filteredDownloaded.filter(item => !isShortVideo(item.duration, item.title, item.channelId));
    }
    
    // Seçilen kritere göre sırala (Tarih, Boyut veya Kullanıcı)
    const sortVal = downloadedSortVal || 'date-desc';
    filteredDownloaded.sort((a, b) => {
      if (sortVal === 'user') {
        const customOrder = JSON.parse(localStorage.getItem('downloaded-user-order') || '[]');
        let indexA = customOrder.indexOf(a.id);
        let indexB = customOrder.indexOf(b.id);
        
        if (indexA === -1 && indexB === -1) {
          const dateA = new Date(a.publishedAt || a.downloadedAt || 0).getTime();
          const dateB = new Date(b.publishedAt || b.downloadedAt || 0).getTime();
          return dateB - dateA;
        }
        if (indexA === -1) return -1;
        if (indexB === -1) return 1;
        
        return indexA - indexB;
      } else if (sortVal.startsWith('size-')) {
        const sizeA = parseSizeToBytes(a.fileSize);
        const sizeB = parseSizeToBytes(b.fileSize);
        return sortVal === 'size-desc' ? sizeB - sizeA : sizeA - sizeB;
      } else {
        const dateA = new Date(a.publishedAt || a.downloadedAt || 0).getTime();
        const dateB = new Date(b.publishedAt || b.downloadedAt || 0).getTime();
        return sortVal === 'date-asc' ? dateA - dateB : dateB - dateA;
      }
    });
    
    renderVideoGrid(downloadedGrid, filteredDownloaded, downloadedViewMode);

    const inlineContainer = document.getElementById('downloaded-inline-player-container');
    if (inlineContainer && !inlineContainer.classList.contains('hidden') && currentPlayingVideoId) {
      renderDownloadedPlaylist(currentPlayingVideoId);
    }
  }

  // 7. Ayarlar Değerleri (Sadece alan odaklanılmamışsa doldur)
  if (db.settings) {
    if (settingsDownloadPath && document.activeElement !== settingsDownloadPath) settingsDownloadPath.value = db.settings.downloadPath || '';
    if (settingsBrowser && document.activeElement !== settingsBrowser) settingsBrowser.value = db.settings.browser || 'none';
    if (settingsQuality && document.activeElement !== settingsQuality) settingsQuality.value = db.settings.quality || 'best';
    if (settingsChannelCheckInterval && document.activeElement !== settingsChannelCheckInterval) settingsChannelCheckInterval.value = db.settings.channelCheckInterval || 60;
    if (settingsAutoDownload && document.activeElement !== settingsAutoDownload) settingsAutoDownload.checked = !!db.settings.autoDownload;
    if (settingsShortsDurationLimit && document.activeElement !== settingsShortsDurationLimit) settingsShortsDurationLimit.value = db.settings.shortsDurationLimit || 180;

    const settingsMergeType = document.getElementById('settings-mergetype');
    const settingsWriteThumbnail = document.getElementById('settings-writethumbnail');
    if (settingsMergeType && document.activeElement !== settingsMergeType) settingsMergeType.value = db.settings.mergeType || 'single';
    if (settingsWriteThumbnail && document.activeElement !== settingsWriteThumbnail) settingsWriteThumbnail.checked = db.settings.writeThumbnail !== false;

    const settingsShowShorts = document.getElementById('settings-showshorts');
    if (settingsShowShorts && document.activeElement !== settingsShowShorts) settingsShowShorts.checked = db.settings.showShorts !== false;

    const historyShowShorts = document.getElementById('history-show-shorts');
    if (historyShowShorts && document.activeElement !== historyShowShorts) historyShowShorts.checked = db.settings.showShorts !== false;

    // Yeni Ayarlar: Tema, Otomatik Silme, RSS Limiti ve Hız Limiti
    const settingsTheme = document.getElementById('settings-theme');
    const settingsAutoDelete = document.getElementById('settings-autodelete');
    const settingsRssLimit = document.getElementById('settings-rsslimit');
    const settingsSpeedLimit = document.getElementById('settings-speedlimit');
    const settingsAltSpeedLimit = document.getElementById('settings-altspeedlimit');
    if (settingsTheme && document.activeElement !== settingsTheme) settingsTheme.value = db.settings.theme || 'dark';
    if (settingsAutoDelete && document.activeElement !== settingsAutoDelete) settingsAutoDelete.value = db.settings.autoDeleteDays || 0;
    if (settingsRssLimit && document.activeElement !== settingsRssLimit) settingsRssLimit.value = db.settings.rssLimit || 5;
    if (settingsSpeedLimit && document.activeElement !== settingsSpeedLimit) settingsSpeedLimit.value = db.settings.downloadSpeedLimit || 0;
    if (settingsAltSpeedLimit && document.activeElement !== settingsAltSpeedLimit) settingsAltSpeedLimit.value = db.settings.alternativeSpeedLimit || 500;

    const settingsPort = document.getElementById('settings-port');
    if (settingsPort && document.activeElement !== settingsPort) settingsPort.value = db.settings.port || 4141;

    const settingsHistoryLimit = document.getElementById('settings-history-limit');
    if (settingsHistoryLimit && document.activeElement !== settingsHistoryLimit) settingsHistoryLimit.value = db.settings.historyLimitPerChannel || 30;

    const settingsPlaySounds = document.getElementById('settings-playsounds');
    if (settingsPlaySounds && document.activeElement !== settingsPlaySounds) settingsPlaySounds.checked = db.settings.playSounds !== false;

    const settingsShowNotifications = document.getElementById('settings-shownotifications');
    if (settingsShowNotifications && document.activeElement !== settingsShowNotifications) settingsShowNotifications.checked = db.settings.showNotifications !== false;

    const settingsAutoOpenBrowser = document.getElementById('settings-autoopenbrowser');
    if (settingsAutoOpenBrowser && document.activeElement !== settingsAutoOpenBrowser) settingsAutoOpenBrowser.checked = db.settings.autoOpenBrowser !== false;

    const settingsLang = document.getElementById('settings-lang');
    if (settingsLang && document.activeElement !== settingsLang) {
      settingsLang.value = db.settings.lang || 'tr';
      setCustomSelectValue(db.settings.lang || 'tr');
    }

    const settingsPlayerType = document.getElementById('settings-player-type');
    if (settingsPlayerType && document.activeElement !== settingsPlayerType) settingsPlayerType.value = db.settings.playerType || 'plyr';

    const settingsSubtitleColor = document.getElementById('settings-subtitle-color');
    if (settingsSubtitleColor && document.activeElement !== settingsSubtitleColor) {
      settingsSubtitleColor.value = db.settings.subtitleColor || '#ffffff';
    }

    const settingsSponsorBlock = document.getElementById('settings-sponsorblock');
    if (settingsSponsorBlock && document.activeElement !== settingsSponsorBlock) settingsSponsorBlock.checked = db.settings.sponsorBlockEnabled === true;

    // Kuyruk duraklatma butonu görünümü ve ikonu
    const pauseBtn = document.getElementById('queue-pause-btn');
    if (pauseBtn) {
      const iconEl = pauseBtn.querySelector('i') || pauseBtn.querySelector('[data-lucide]');
      if (db.settings.isPaused) {
        pauseBtn.classList.add('btn-warning');
        if (iconEl) iconEl.setAttribute('data-lucide', 'play');
      } else {
        pauseBtn.classList.remove('btn-warning');
        if (iconEl) iconEl.setAttribute('data-lucide', 'pause');
      }
    }

    // Sıradaki hız sınırı giriş kutusu senkronizasyonu ve etiket güncellemesi
    const queueSpeedLimitInput = document.getElementById('queue-speed-limit-input');
    const speedLimitLabel = document.getElementById('speed-limit-label');
    const altSpeedToggleBtn = document.getElementById('alt-speed-toggle-btn');
    const isEn = db.settings.lang === 'en';

    if (db.settings.useAlternativeSpeed) {
      if (queueSpeedLimitInput && document.activeElement !== queueSpeedLimitInput) {
        queueSpeedLimitInput.value = db.settings.alternativeSpeedLimit || 500;
      }
      if (speedLimitLabel) {
        speedLimitLabel.textContent = isEn ? 'Alt. Speed Limit:' : 'Alt. Hız Sınırı:';
        speedLimitLabel.style.color = 'var(--accent-color)';
      }
      if (altSpeedToggleBtn) {
        altSpeedToggleBtn.classList.add('btn-warning');
        altSpeedToggleBtn.classList.remove('btn-secondary');
        altSpeedToggleBtn.setAttribute('title', isEn ? 'Disable Alternative Speed Limit' : 'Alternatif Hız Sınırını Kapat');
      }
    } else {
      if (queueSpeedLimitInput && document.activeElement !== queueSpeedLimitInput) {
        queueSpeedLimitInput.value = db.settings.downloadSpeedLimit || 0;
      }
      if (speedLimitLabel) {
        speedLimitLabel.textContent = isEn ? 'Speed Limit:' : 'Hız Sınırı:';
        speedLimitLabel.style.color = 'var(--text-muted)';
      }
      if (altSpeedToggleBtn) {
        altSpeedToggleBtn.classList.remove('btn-warning');
        altSpeedToggleBtn.classList.add('btn-secondary');
        altSpeedToggleBtn.setAttribute('title', isEn ? 'Enable Alternative Speed Limit' : 'Alternatif Hız Sınırını Aç');
      }
    }

    // Tema Sınıfı Eşitlemesi
    document.body.classList.toggle('light-theme', db.settings.theme === 'light');
    
    // Dil Çevirisini Uygula
    if (db.settings.lang) {
      applyLanguage(db.settings.lang);
    }
    
    // Çerez canlılık testini tetikle
    if (db.settings.browser) {
      const currentBrowser = db.settings.browser;
      if (window.lastTestedBrowser !== currentBrowser) {
        window.lastTestedBrowser = currentBrowser;
        testCookies();
      }
    }
  }

  // İkonları yeniden yükle
  lucide.createIcons();
}

/**
 * XSS açıklarını önlemek amacıyla metin içerisindeki tehlikeli HTML karakterlerini kaçış dizgilerine çevirir.
 * 
 * @param {string} str Kaçış yapılacak metin
 * @returns {string} Güvenli hale getirilmiş metin
 */
function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Türkçe Açıklama: Video başlığında '#shorts' etiketi olup olmamasına veya video süresinin 3 dakikadan kısa olup olmamasına bakarak Shorts videosu ayrımı yapar.
/**
 * Süre değerine ve başlığına bakarak bir videonun Shorts olup olmadığını belirler.
 * 
 * @param {string} durationStr Biçimlendirilmiş süre metni (Örn: 1:30)
 * @param {string} title Video başlığı
 * @returns {boolean} Video Shorts ise true
 */
function isShortVideo(durationStr, title, channelId) {
  if (title) {
    const lowerTitle = title.toLowerCase();
    if (lowerTitle.includes('#shorts') || lowerTitle.includes('#short')) {
      return true;
    }
  }
  if (!durationStr) return false;
  
  let limit = 180;
  if (channelId && localDb && localDb.channels) {
    const chan = localDb.channels.find(c => c.id === channelId);
    if (chan && chan.shortsDurationLimit !== undefined) {
      limit = chan.shortsDurationLimit;
    }
  } else if (localDb && localDb.settings && localDb.settings.shortsDurationLimit !== undefined) {
    limit = localDb.settings.shortsDurationLimit;
  }

  const parts = durationStr.split(':').map(Number);
  let totalSeconds = 0;
  
  if (parts.length === 1) {
    totalSeconds = parts[0];
  } else if (parts.length === 2) {
    totalSeconds = (parts[0] * 60) + parts[1];
  } else if (parts.length === 3) {
    totalSeconds = (parts[0] * 3600) + (parts[1] * 60) + parts[2];
  }
  
  // To avoid false positives (e.g. standard landscape videos that are under 60 seconds,
  // or videos with "short" adjective in their title like "React short tutorial"),
  // we ONLY classify as Short if:
  // 1. The title contains hashtag "#shorts" or "#short" (checked above).
  // 2. OR the title contains the isolated word "shorts" (plural) and the duration is within the limit.
  // Note: For downloaded local videos, the aspect ratio is dynamically checked and corrected on load.
  if (title && totalSeconds <= limit) {
    const lowerTitle = title.toLowerCase();
    if (/\bshorts\b/.test(lowerTitle)) {
      return true;
    }
  }
  return false;
}

// Türkçe Açıklama: Belirtilen kanal ID'sini backend API'sine ileterek kanalı izleme listesinden çıkarır ve geçmiş verilerini siler.
/**
 * Belirtilen kanalı takipten çıkarır ve veritabanından siler.
 * 
 * @param {string} id Silinecek kanal ID'si
 */
window.resetHistoryChannelFilter = function() {
  const filterSelect = document.getElementById('history-channel-filter');
  if (filterSelect) {
    filterSelect.value = 'all';
    historyFilterChannel = 'all';
    updateUI(localDb);
  }
};

window.resetDownloadedChannelFilter = function() {
  const filterSelect = document.getElementById('downloaded-channel-filter');
  if (filterSelect) {
    filterSelect.value = 'all';
    downloadedFilterChannel = 'all';
    updateUI(localDb);
  }
};

window.deleteChannel = async function(id) {
  if (!confirm('Bu kanalı takipten çıkarmak istediğinizden emin misiniz?')) return;
  
  try {
    const res = await fetch(`/api/channels/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.success) {
      showToast('Kanal takipten çıkarıldı.', 'info');
    } else {
      showToast(data.error || 'Hata oluştu.', 'error');
    }
  } catch (err) {
    showToast('Sunucu ile iletişim hatası.', 'error');
  }
};

// Türkçe Açıklama: Belirtilen kanalın güncel profil resmini YouTube üzerinden indirip yerel diske kaydetmek üzere backend rotasını tetikler.
/**
 * Belirtilen kanalın profil resmini (logosunu) YouTube'dan yeniden çözümler ve günceller.
 * 
 * @param {string} id Güncellenecek kanal ID'si
 */
window.updateChannelAvatar = async function(id) {
  try {
    showToast('Kanal logosu güncelleniyor...', 'info');
    const res = await fetch(`/api/channels/${id}/update-avatar`, { method: 'POST' });
    const data = await res.json();
    if (data.success) {
      showToast('Kanal logosu başarıyla güncellendi.', 'success');
      // Logo güncellendikten sonra resmi yenilemek için cache-busting yapıyoruz
      const img = document.getElementById(`ch-avatar-${id}`);
      if (img) {
        img.src = `/api/channels/${id}/avatar?t=${Date.now()}`;
      }
    } else {
      showToast(data.error || 'Hata oluştu.', 'error');
    }
  } catch (err) {
    showToast('Sunucu ile iletişim hatası.', 'error');
  }
};

/**
 * Takip edilen tüm kanalların logolarını arka planda toplu olarak günceller.
 */
// Türkçe Açıklama: Arayüzden toplu kanal logosu güncelleme API'sini çağırır.
window.updateAllChannelAvatars = async function() {
  const isEn = localDb.settings && localDb.settings.lang === 'en';
  if (!confirm(isEn ? 'Are you sure you want to update all channel logos? This may take some time.' : 'Tüm kanal logolarını güncellemek istediğinize emin misiniz? Bu işlem biraz zaman alabilir.')) return;
  
  showToast(isEn ? 'Updating all channel logos...' : 'Tüm kanal logoları güncelleniyor...', 'info');
  
  const btn = document.getElementById('update-all-logos-btn');
  if (btn) btn.disabled = true;
  
  try {
    const res = await fetch('/api/channels/update-all-avatars', { method: 'POST' });
    const data = await res.json();
    if (data.success) {
      // Başarı logları SSE kanalıyla sunucudan gelecektir.
      // Her resim için cache-busting uygulayarak arayüzü yenileriz
      setTimeout(() => {
        document.querySelectorAll('.channel-list-avatar-img').forEach(img => {
          const idMatch = img.id.match(/ch-avatar-(UC[a-zA-Z0-9_-]{22})/);
          if (idMatch) {
            img.src = `/api/channels/${idMatch[1]}/avatar?t=${Date.now()}`;
          }
        });
      }, 2000);
    } else {
      showToast(data.error || 'İşlem başarısız oldu.', 'error');
    }
  } catch (err) {
    showToast('Sunucu ile iletişim hatası.', 'error');
  } finally {
    if (btn) btn.disabled = false;
  }
};

/**
 * Belirtilen videoyu manuel olarak indirme sırasına (kuyruğa) ekler.
 * 
 * @param {string} videoId İndirilecek video ID'si
 */
window.downloadVideoManual = async function(videoId) {
  const item = localDb.history.find(h => h.id === videoId);
  const title = item ? item.title : 'Bilinmeyen Video';
  const channelName = item ? item.channelName : 'Manuel İndirme';
  const channelId = item ? item.channelId : 'manual';

  try {
    showToast(`İndirme başlatılıyor: ${title}`, 'info');
    const res = await fetch('/api/download-video', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ videoId, title, channelName, channelId })
    });
    const data = await res.json();
    if (data.success) {
      showToast('Kuyruğa eklendi.', 'success');
    } else {
      showToast(data.error || 'İndirme tetiklenemedi.', 'error');
    }
  } catch (err) {
    showToast('Sunucu ile iletişim hatası.', 'error');
  }
};

// Türkçe Açıklama: Sunucuya istek göndererek, indirilen videoların bulunduğu klasörü Windows Dosya Gezgini'nde otomatik olarak açar.
/**
 * Sunucuya istek atarak indirme klasörünü (varsa kanal klasörünü) Windows Gezgini'nde açar.
 * 
 * @param {string} channelName Açılacak kanal klasörünün ismi
 */
window.openFolder = async function(channelName) {
  // Eğer parametre bir PointerEvent vb. ise temizle
  if (typeof channelName !== 'string') {
    channelName = '';
  }
  try {
    const res = await fetch('/api/open-folder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channelName })
    });
    const data = await res.json();
    if (!data.success) {
      showToast(data.error || 'Klasör açılamadı.', 'error');
    }
  } catch (err) {
    showToast('Sunucu ile iletişim hatası.', 'error');
  }
};

// Form Gönderimleri
if (addChannelForm) {
  addChannelForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const inputVal = channelInput.value.trim();
    if (!inputVal) return;

    const downloadShorts = confirm('Bu kanal için Shorts videoları da otomatik indirilsin mi? (İptal seçilirse Shorts videoları otomatik indirilmeyecektir)');

    addChannelBtn.disabled = true;
    addChannelBtn.querySelector('span').textContent = 'Kanal Çözümleniyor...';
    showToast('Kanal sorgulanıyor, lütfen bekleyin...', 'info');

    try {
      const res = await fetch('/api/channels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: inputVal, downloadShorts })
      });
      
      const data = await res.json();
      
      if (data.success) {
        channelInput.value = '';
        showToast('Kanal başarıyla takip listesine eklendi!', 'success');
      } else {
        showToast(data.error || 'Kanal eklenirken bir hata oluştu.', 'error');
      }
    } catch (err) {
      showToast('Bağlantı hatası.', 'error');
    } finally {
      addChannelBtn.disabled = false;
      addChannelBtn.querySelector('span').textContent = 'Kanalı Takip Et';
      lucide.createIcons();
    }
  });
}

let autoSaveTimeout = null;

async function triggerAutoSave(immediate = false) {
  if (autoSaveTimeout) {
    clearTimeout(autoSaveTimeout);
    autoSaveTimeout = null;
  }
  
  if (immediate) {
    await performAutoSave();
  } else {
    autoSaveTimeout = setTimeout(performAutoSave, 500);
  }
}

async function updateMetadata(type) {
  const isEn = localDb.settings && localDb.settings.lang === 'en';
  showToast(isEn ? 'Metadata update started...' : 'Metadata güncellemesi başlatıldı...', 'info');
  try {
    const res = await fetch('/api/library/update-metadata', { 
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type })
    });
    const data = await res.json();
    if (data.success) {
      showToast(isEn ? `Metadata updated! Evaluated ${data.count} items.` : `Metadata güncellendi! ${data.count} öğe denetlendi.`, 'success');
      loadDb(); // refresh the UI
    } else {
      showToast(data.message || (isEn ? 'Update failed' : 'Güncelleme başarısız'), 'error');
    }
  } catch (err) {
    showToast(isEn ? 'Error occurred' : 'Hata oluştu', 'error');
    console.error(err);
  }
}

async function performAutoSave() {
  if (!settingsForm) return;
  
  const settingsPortInput = document.getElementById('settings-port');
  const port = settingsPortInput ? parseInt(settingsPortInput.value, 10) : 4141;
  
  const settings = {
    downloadPath: settingsDownloadPath.value.trim(),
    browser: settingsBrowser.value,
    quality: settingsQuality.value,
    channelCheckInterval: parseInt(settingsChannelCheckInterval.value, 10) || 60,
    autoDownload: settingsAutoDownload.checked,
    mergeType: document.getElementById('settings-mergetype').value,
    writeThumbnail: document.getElementById('settings-writethumbnail').checked,
    showShorts: document.getElementById('settings-showshorts').checked,
    theme: document.getElementById('settings-theme').value,
    autoDeleteDays: parseInt(document.getElementById('settings-autodelete').value, 10) || 0,
    rssLimit: parseInt(document.getElementById('settings-rsslimit').value, 10) || 5,
    downloadSpeedLimit: parseInt(document.getElementById('settings-speedlimit').value, 10) || 0,
    alternativeSpeedLimit: parseInt(document.getElementById('settings-altspeedlimit').value, 10) || 500,
     port: port,
    playerType: document.getElementById('settings-player-type').value,
    subtitleColor: document.getElementById('settings-subtitle-color').value,
    subtitleOpacity: localDb.settings.subtitleOpacity || '0.7',
    subtitleSize: localDb.settings.subtitleSize || '26px',
    sponsorBlockEnabled: document.getElementById('settings-sponsorblock').checked,
    playSounds: document.getElementById('settings-playsounds').checked,
    showNotifications: document.getElementById('settings-shownotifications').checked,
    autoOpenBrowser: document.getElementById('settings-autoopenbrowser').checked,
    lang: document.getElementById('settings-lang').value,
    historyLimitPerChannel: parseInt(document.getElementById('settings-history-limit').value, 10) || 30,
    shortsDurationLimit: settingsShortsDurationLimit ? (parseInt(settingsShortsDurationLimit.value, 10) || 180) : (localDb.settings.shortsDurationLimit || 180)
  };

  const oldPort = localDb.settings.port || 4141;
  const statusSpan = document.getElementById('settings-status');
  if (statusSpan) {
    const isEn = localDb.settings && localDb.settings.lang === 'en';
    statusSpan.innerHTML = `<i data-lucide="loader" class="pulse-animation" style="width:16px; height:16px; margin-right:4px;"></i><span>${isEn ? 'Saving changes...' : 'Ayarlar kaydediliyor...'}</span>`;
    lucide.createIcons();
  }

  try {
    const res = await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings)
    });
    const data = await res.json();
    if (data.success) {
      if (statusSpan) {
        const isEn = localDb.settings && localDb.settings.lang === 'en';
        statusSpan.innerHTML = `<i data-lucide="check-circle" style="width:16px; height:16px; margin-right:4px; color:var(--success-color);"></i><span style="color:var(--success-color);">${isEn ? 'All changes saved.' : 'Tüm değişiklikler kaydedildi.'}</span>`;
        lucide.createIcons();
      }
      if (port !== oldPort) {
        showToast(localDb.settings.lang === 'en' ? 'Port changed. Please restart the app to apply.' : 'Port değiştirildi. Yeni portun aktif olması için uygulamayı yeniden başlatın.', 'warning');
      }
      updateDiskSpace();
    }
  } catch (err) {
    console.error('Otomatik kaydetme hatası:', err);
    if (statusSpan) {
      const isEn = localDb.settings && localDb.settings.lang === 'en';
      statusSpan.innerHTML = `<i data-lucide="alert-circle" style="width:16px; height:16px; margin-right:4px; color:var(--danger-color);"></i><span style="color:var(--danger-color);">${isEn ? 'Save error!' : 'Kaydedilemedi!'}</span>`;
      lucide.createIcons();
    }
  }
}

if (settingsForm) {
  settingsForm.addEventListener('submit', (e) => {
    e.preventDefault();
    triggerAutoSave(true);
  });

  // Form içindeki tüm girdi elemanlarını dinle
  const inputs = settingsForm.querySelectorAll('input, select, textarea');
  inputs.forEach(input => {
    if (input.type === 'checkbox' || input.tagName.toLowerCase() === 'select') {
      input.addEventListener('change', () => triggerAutoSave(true));
    } else {
      input.addEventListener('input', () => triggerAutoSave(false));
    }
  });
}

if (syncNowBtn) {
  syncNowBtn.addEventListener('click', async () => {
    syncNowBtn.disabled = true;
    const isEn = localDb.settings && localDb.settings.lang === 'en';
    showToast(isEn ? 'Scanning all channels in the background...' : 'Tüm kanallar arka planda taranıyor...', 'info');
    
    try {
      const res = await fetch('/api/sync', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        showToast(isEn ? 'Channel scan started in the background.' : 'Kanal denetimi arka planda başlatıldı.', 'success');
      } else {
        showToast(data.error || (isEn ? 'Error occurred.' : 'Hata oluştu.'), 'error');
      }
    } catch (err) {
      showToast(isEn ? 'Connection error.' : 'Bağlantı hatası.', 'error');
    } finally {
      syncNowBtn.disabled = false;
    }
  });
}

if (openFolderBtn) {
  openFolderBtn.addEventListener('click', openFolder);
}

if (selectFolderBtn) {
  selectFolderBtn.addEventListener('click', async () => {
    showToast('Klasör seçim penceresi açılıyor, lütfen bekleyin...', 'info');
    try {
      const res = await fetch('/api/select-folder', { method: 'POST' });
      const data = await res.json();
      if (data.success && data.path) {
        settingsDownloadPath.value = data.path;
        showToast(`Yeni indirme dizini seçildi: ${data.path}`, 'success');
      } else if (data.message) {
        showToast(data.message, 'warning');
      }
    } catch (err) {
      showToast('Klasör seçilirken bir bağlantı hatası oluştu.', 'error');
    }
  });
}

if (testFolderBtn) {
  testFolderBtn.addEventListener('click', async () => {
    // Klasör yolu geçerliliğini test etmek için backend'i tetikleyelim
    const folder = settingsDownloadPath.value.trim();
    if (!folder) return showToast('Klasör yolu boş bırakılamaz.', 'error');
    
    try {
      const res = await fetch('/api/open-folder', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        showToast('Klasör yolu geçerli ve başarıyla açıldı!', 'success');
      } else {
        showToast(data.error || 'Klasör açılamadı.', 'error');
      }
    } catch (err) {
      showToast('Test hatası.', 'error');
    }
  });
}

/**
 * Belirli bir kanal için varsayılan indirme kalitesini günceller.
 * 
 * @param {string} id Kanal ID'si
 * @param {string} quality Kalite değeri ('default', 'best', '1080p', '720p')
 */
window.changeChannelQuality = async function(id, quality) {
  try {
    const res = await fetch(`/api/channels/${id}/quality`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quality })
    });
    const data = await res.json();
    if (data.success) {
      showToast('Kanal kalitesi başarıyla güncellendi.', 'success');
    } else {
      showToast(data.error || 'Hata oluştu.', 'error');
    }
  } catch (err) {
    showToast('Sunucu bağlantı hatası.', 'error');
  }
};

// Türkçe Açıklama: Belirtilen kanal için Shorts videolarının indirilip indirilmeyeceğini güncelleyen backend rotasını tetikler.
/**
 * Belirli bir kanal için Shorts videolarının indirilip indirilmeyeceğini günceller.
 * 
 * @param {string} id Kanal ID'si
 * @param {string} downloadShorts Shorts indirme durumu ('true' veya 'false')
 */
window.changeChannelShorts = async function(id, downloadShorts) {
  try {
    const res = await fetch(`/api/channels/${id}/shorts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ downloadShorts: downloadShorts === 'true' })
    });
    const data = await res.json();
    if (data.success) {
      showToast('Kanal Shorts indirme ayarı başarıyla güncellendi.', 'success');
    } else {
      showToast(data.error || 'Hata oluştu.', 'error');
    }
  } catch (err) {
    showToast('Sunucu bağlantı hatası.', 'error');
  }
};

window.changeChannelAutoDownload = async function(id, autoDownload) {
  try {
    const res = await fetch(`/api/channels/${id}/auto-download`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ autoDownload: autoDownload === 'true' })
    });
    const data = await res.json();
    if (data.success) {
      const isEn = localDb.settings && localDb.settings.lang === 'en';
      showToast(isEn ? 'Channel auto download setting successfully updated.' : 'Kanal otomatik indirme ayarı başarıyla güncellendi.', 'success');
    } else {
      showToast(data.error || 'Hata oluştu.', 'error');
    }
  } catch (err) {
    showToast('Sunucu bağlantı hatası.', 'error');
  }
};

window.changeChannelShortsLimit = async function(id, limit) {
  try {
    const res = await fetch(`/api/channels/${id}/shorts-limit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ limit: parseInt(limit, 10) })
    });
    const data = await res.json();
    if (data.success) {
      const isEn = localDb.settings && localDb.settings.lang === 'en';
      showToast(isEn ? 'Channel Shorts duration limit successfully updated.' : 'Kanal Shorts süre sınırı başarıyla güncellendi.', 'success');
    } else {
      showToast(data.error || 'Hata oluştu.', 'error');
    }
  } catch (err) {
    showToast('Sunucu bağlantı hatası.', 'error');
  }
};

window.syncSingleChannelRss = async function(id) {
  const isEn = localDb.settings && localDb.settings.lang === 'en';
  showToast(isEn ? 'Checking channel RSS feed...' : 'Kanal RSS yayını taranıyor...', 'info');
  try {
    const res = await fetch(`/api/channels/${id}/sync`, { method: 'POST' });
    const data = await res.json();
    if (data.success) {
      showToast(isEn ? 'Channel RSS checked successfully.' : 'Kanal RSS denetimi başarıyla tamamlandı.', 'success');
    } else {
      showToast(data.error || (isEn ? 'Error occurred.' : 'Hata oluştu.'), 'error');
    }
  } catch (err) {
    showToast(isEn ? 'Connection error.' : 'Bağlantı hatası.', 'error');
  }
};

let videoPlayerInstance = null;
let currentPlayingVideoId = null;
let seekedForCurrentVideo = false;

// Türkçe Açıklama: Gömülü video oynatıcı açıkken YouTube klavye kısayollarını (Space, F, M, yön tuşları, sayılar vb.) etkinleştirir.
/**
 * Video oynatıcı modalı açıkken YouTube klavye kısayollarını dinler ve yürütür.
 */
document.addEventListener('keydown', (e) => {
  const modal = document.getElementById('player-modal');
  const inlineContainer = document.getElementById('downloaded-inline-player-container');
  const isModalOpen = modal && !modal.classList.contains('hidden');
  const isInlineOpen = inlineContainer && !inlineContainer.classList.contains('hidden');

  if (isModalOpen || isInlineOpen) {
    // Input veya textarea üzerinde yazı yazılıyorsa kısayolları çalıştırma
    const activeEl = document.activeElement;
    const isTyping = activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.isContentEditable);
    if (isTyping) return;

    const player = document.getElementById('embedded-video-player');
    const pType = (localDb.settings && localDb.settings.playerType) || 'plyr';

    // Oynatıcı kontrollerini soyutlayan ortak nesne
    const activePlayer = {
      get paused() {
        if (pType === 'artplayer' && videoPlayerInstance) return videoPlayerInstance.paused;
        if (pType === 'html5' && player) return player.paused;
        return videoPlayerInstance ? videoPlayerInstance.paused : (player ? player.paused : true);
      },
      play() {
        if (pType === 'artplayer' && videoPlayerInstance) return videoPlayerInstance.play();
        if (pType === 'html5' && player) return player.play();
        return videoPlayerInstance ? videoPlayerInstance.play() : (player ? player.play() : Promise.resolve());
      },
      pause() {
        if (pType === 'artplayer' && videoPlayerInstance) videoPlayerInstance.pause();
        else if (pType === 'html5' && player) player.pause();
        else if (videoPlayerInstance) videoPlayerInstance.pause();
        else if (player) player.pause();
      },
      get duration() {
        if (pType === 'artplayer' && videoPlayerInstance) return videoPlayerInstance.duration || 0;
        if (pType === 'html5' && player) return player.duration || 0;
        return videoPlayerInstance ? (videoPlayerInstance.duration || 0) : (player ? (player.duration || 0) : 0);
      },
      get currentTime() {
        if (pType === 'artplayer' && videoPlayerInstance) return videoPlayerInstance.currentTime || 0;
        if (pType === 'html5' && player) return player.currentTime || 0;
        return videoPlayerInstance ? (videoPlayerInstance.currentTime || 0) : (player ? (player.currentTime || 0) : 0);
      },
      set currentTime(val) {
        if (pType === 'artplayer' && videoPlayerInstance) videoPlayerInstance.currentTime = val;
        else if (pType === 'html5' && player) player.currentTime = val;
        else if (videoPlayerInstance) videoPlayerInstance.currentTime = val;
        else if (player) player.currentTime = val;
      },
      get volume() {
        if (pType === 'artplayer' && videoPlayerInstance) return videoPlayerInstance.volume || 0;
        if (pType === 'html5' && player) return player.volume || 0;
        return videoPlayerInstance ? (videoPlayerInstance.volume || 0) : (player ? (player.volume || 0) : 0);
      },
      set volume(val) {
        if (pType === 'artplayer' && videoPlayerInstance) videoPlayerInstance.volume = val;
        else if (pType === 'html5' && player) player.volume = val;
        else if (videoPlayerInstance) videoPlayerInstance.volume = val;
        else if (player) player.volume = val;
      },
      get muted() {
        if (pType === 'artplayer' && videoPlayerInstance) return videoPlayerInstance.muted || false;
        if (pType === 'html5' && player) return player.muted || false;
        return videoPlayerInstance ? (videoPlayerInstance.muted || false) : (player ? (player.muted || false) : false);
      },
      set muted(val) {
        if (pType === 'artplayer' && videoPlayerInstance) videoPlayerInstance.muted = val;
        else if (pType === 'html5' && player) player.muted = val;
        else if (videoPlayerInstance) videoPlayerInstance.muted = val;
        else if (player) player.muted = val;
      },
      get speed() {
        if (pType === 'artplayer' && videoPlayerInstance) return videoPlayerInstance.playbackRate || 1;
        if (pType === 'html5' && player) return player.playbackRate || 1;
        return videoPlayerInstance ? (videoPlayerInstance.speed || 1) : (player ? (player.playbackRate || 1) : 1);
      },
      set speed(val) {
        if (pType === 'artplayer' && videoPlayerInstance) videoPlayerInstance.playbackRate = val;
        else if (pType === 'html5' && player) player.playbackRate = val;
        else if (videoPlayerInstance) videoPlayerInstance.speed = val;
        else if (player) player.playbackRate = val;
      },
      toggleFullscreen() {
        if (pType === 'artplayer' && videoPlayerInstance) {
          videoPlayerInstance.fullscreen = !videoPlayerInstance.fullscreen;
        } else if (pType === 'html5' && player) {
          if (!document.fullscreenElement) {
            player.requestFullscreen().catch(err => console.error(err));
          } else {
            document.exitFullscreen().catch(err => console.error(err));
          }
        } else {
          if (videoPlayerInstance && videoPlayerInstance.fullscreen) {
            videoPlayerInstance.fullscreen.toggle();
          }
        }
      },
      toggleCaptions() {
        if (pType === 'artplayer' && videoPlayerInstance) {
          if (videoPlayerInstance.subtitle) {
            videoPlayerInstance.subtitle.show = !videoPlayerInstance.subtitle.show;
          }
        } else if (pType === 'plyr' && videoPlayerInstance) {
          if (typeof videoPlayerInstance.toggleCaptions === 'function') {
            videoPlayerInstance.toggleCaptions();
          } else if (videoPlayerInstance.captions) {
            videoPlayerInstance.captions.active = !videoPlayerInstance.captions.active;
          }
        } else if (player) {
          const tracks = player.textTracks;
          if (tracks && tracks.length > 0) {
            const isShowing = Array.from(tracks).some(t => t.mode === 'showing');
            for (let i = 0; i < tracks.length; i++) {
              if (isShowing) {
                tracks[i].mode = 'disabled';
              } else {
                tracks[i].mode = i === 0 ? 'showing' : 'disabled';
              }
            }
          }
        }
      }
    };

    const duration = activePlayer.duration;
    const speeds = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];

    switch (e.key) {
      case ' ':
      case 'k':
      case 'K':
        e.preventDefault();
        if (activePlayer.paused) {
          activePlayer.play().catch(() => {});
        } else {
          activePlayer.pause();
        }
        break;

      case 'f':
      case 'F':
        e.preventDefault();
        activePlayer.toggleFullscreen();
        break;

      case 'm':
      case 'M':
        e.preventDefault();
        activePlayer.muted = !activePlayer.muted;
        break;

      case 'c':
      case 'C':
        e.preventDefault();
        activePlayer.toggleCaptions();
        break;

      case 'ArrowRight':
        e.preventDefault();
        activePlayer.currentTime = Math.min(duration, activePlayer.currentTime + 5);
        break;

      case 'ArrowLeft':
        e.preventDefault();
        activePlayer.currentTime = Math.max(0, activePlayer.currentTime - 5);
        break;

      case 'l':
      case 'L':
        e.preventDefault();
        activePlayer.currentTime = Math.min(duration, activePlayer.currentTime + 10);
        break;

      case 'j':
      case 'J':
        e.preventDefault();
        activePlayer.currentTime = Math.max(0, activePlayer.currentTime - 10);
        break;

      case 'ArrowUp':
        e.preventDefault();
        activePlayer.volume = Math.min(1, activePlayer.volume + 0.05);
        break;

      case 'ArrowDown':
        e.preventDefault();
        activePlayer.volume = Math.max(0, activePlayer.volume - 0.05);
        break;

      case 'Home':
        e.preventDefault();
        activePlayer.currentTime = 0;
        break;

      case 'End':
        e.preventDefault();
        activePlayer.currentTime = duration;
        break;

      case '>':
        e.preventDefault();
        {
          const idx = speeds.indexOf(activePlayer.speed);
          if (idx !== -1 && idx < speeds.length - 1) {
            activePlayer.speed = speeds[idx + 1];
          }
        }
        break;

      case '<':
        e.preventDefault();
        {
          const idx = speeds.indexOf(activePlayer.speed);
          if (idx !== -1 && idx > 0) {
            activePlayer.speed = speeds[idx - 1];
          }
        }
        break;

      default:
        // Sayı tuşları (0-9) ile videonun %0 ila %90'ına atlama
        if (e.key >= '0' && e.key <= '9') {
          e.preventDefault();
          const percent = parseInt(e.key, 10) * 10;
          activePlayer.currentTime = duration * (percent / 100);
        }
        if (e.key === '.' && e.shiftKey) {
          e.preventDefault();
          const idx = speeds.indexOf(activePlayer.speed);
          if (idx !== -1 && idx < speeds.length - 1) {
            activePlayer.speed = speeds[idx + 1];
          }
        } else if (e.key === ',' && e.shiftKey) {
          e.preventDefault();
          const idx = speeds.indexOf(activePlayer.speed);
          if (idx !== -1 && idx > 0) {
            activePlayer.speed = speeds[idx - 1];
          }
        }
        break;
    }
  }
});

// Türkçe Açıklama: İndirilen videoyu arayüz içerisindeki gömülü video oynatıcı (Plyr) modalında açarak yürütür.
/**
 * Videoyu gömülü tarayıcı oynatıcısında (Plyr) açar.
 * Shorts videoları dikey gösterilir ve kalınan izleme süresinden devam eder.
 * 
 * @param {string} videoId Oynatılacak video ID'si
 */
// Türkçe Açıklama: Gömülü video oynatıcı modalının boyutunu küçültür veya eski boyutuna geri getirir.
/**
 * Oynatıcı modalını küçültür (minimize) veya geri yükler.
 */
window.togglePlayerMinimize = function() {
  const modal = document.getElementById('player-modal');
  const btn = document.getElementById('minimize-player-modal-btn');
  if (!modal) return;
  
  modal.classList.toggle('minimized');
  const isMinimized = modal.classList.contains('minimized');
  
  const modalContent = modal.querySelector('.player-modal-content');
  if (modalContent) {
    if (isMinimized) {
      modalContent.style.width = '';
      modalContent.style.height = '';
      modalContent.style.left = '';
      modalContent.style.top = '';
    } else {
      const isShort = modal.classList.contains('is-short-player');
      const suffix = isShort ? '-short' : '';
      const w = localStorage.getItem(`player-modal${suffix}-width`);
      const h = localStorage.getItem(`player-modal${suffix}-height`);
      const l = localStorage.getItem(`player-modal${suffix}-left`);
      const t = localStorage.getItem(`player-modal${suffix}-top`);
      if (w) modalContent.style.width = w;
      if (h) modalContent.style.height = h;
      if (l) modalContent.style.left = l;
      if (t) modalContent.style.top = t;
    }
  }

  if (btn) {
    const icon = btn.querySelector('i') || btn.querySelector('[data-lucide]');
    if (icon) {
      icon.setAttribute('data-lucide', isMinimized ? 'maximize-2' : 'minus');
    }
    btn.title = isMinimized ? (localDb.settings && localDb.settings.lang === 'en' ? 'Maximize' : 'Büyüt') : (localDb.settings && localDb.settings.lang === 'en' ? 'Minimize' : 'Küçült');
  }
  lucide.createIcons();
};

let currentVideoSponsorSegments = [];
let lastSkippedSegmentStart = -1;
let playerResizeObserver = null;

function makeElementDraggable(modalContent, dragHeader) {
  let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;

  dragHeader.onmousedown = dragMouseDown;

  function dragMouseDown(e) {
    e = e || window.event;
    if (e.target.closest('button') || e.target.closest('a') || e.target.closest('input') || e.target.closest('select')) {
      return;
    }
    e.preventDefault();
    pos3 = e.clientX;
    pos4 = e.clientY;
    document.onmouseup = closeDragElement;
    document.onmousemove = elementDrag;
  }

  function elementDrag(e) {
    e = e || window.event;
    e.preventDefault();
    pos1 = pos3 - e.clientX;
    pos2 = pos4 - e.clientY;
    pos3 = e.clientX;
    pos4 = e.clientY;
    
    const newTop = modalContent.offsetTop - pos2;
    const newLeft = modalContent.offsetLeft - pos1;

    const maxLeft = window.innerWidth - modalContent.offsetWidth - 10;
    const maxTop = window.innerHeight - modalContent.offsetHeight - 10;

    modalContent.style.bottom = 'auto';
    modalContent.style.right = 'auto';
    modalContent.style.left = `${Math.max(10, Math.min(newLeft, maxLeft))}px`;
    modalContent.style.top = `${Math.max(10, Math.min(newTop, maxTop))}px`;
  }

  function closeDragElement() {
    document.onmouseup = null;
    document.onmousemove = null;
    const isShort = modalContent.closest('#player-modal')?.classList.contains('is-short-player');
    const suffix = isShort ? '-short' : '';
    localStorage.setItem(`player-modal${suffix}-left`, modalContent.style.left);
    localStorage.setItem(`player-modal${suffix}-top`, modalContent.style.top);
  }
}

function makeElementResizable(modalContent) {
  const handles = modalContent.querySelectorAll('.resize-handle');
  
  handles.forEach(handle => {
    handle.onmousedown = resizeMouseDown;
    
    function resizeMouseDown(e) {
      e.preventDefault();
      
      const isRight = handle.classList.contains('bottom-right') || handle.classList.contains('top-right');
      const isBottom = handle.classList.contains('bottom-left') || handle.classList.contains('bottom-right');
      const isLeft = handle.classList.contains('bottom-left') || handle.classList.contains('top-left');
      const isTop = handle.classList.contains('top-left') || handle.classList.contains('top-right');
      
      const startWidth = modalContent.offsetWidth;
      const startHeight = modalContent.offsetHeight;
      const startX = e.clientX;
      const startY = e.clientY;
      const startLeft = modalContent.offsetLeft;
      const startTop = modalContent.offsetTop;
      
      document.onmousemove = elementResize;
      document.onmouseup = closeResizeElement;
      
      function elementResize(e) {
        let width = startWidth;
        let height = startHeight;
        let left = startLeft;
        let top = startTop;
        
        if (isRight) {
          width = startWidth + (e.clientX - startX);
        } else if (isLeft) {
          width = startWidth - (e.clientX - startX);
          left = startLeft + (e.clientX - startX);
        }
        
        if (isBottom) {
          height = startHeight + (e.clientY - startY);
        } else if (isTop) {
          height = startHeight - (e.clientY - startY);
          top = startTop + (e.clientY - startY);
        }
        
        const minWidth = 320;
        const minHeight = 180;
        
        if (width >= minWidth) {
          modalContent.style.width = `${width}px`;
          if (isLeft) {
            modalContent.style.left = `${left}px`;
          }
        }
        
        if (height >= minHeight) {
          modalContent.style.height = `${height}px`;
          if (isTop) {
            modalContent.style.top = `${top}px`;
          }
        }
      }
      
      function closeResizeElement() {
        document.onmousemove = null;
        document.onmouseup = null;
        
        const isShort = modalContent.closest('#player-modal')?.classList.contains('is-short-player');
        const suffix = isShort ? '-short' : '';
        localStorage.setItem(`player-modal${suffix}-width`, modalContent.style.width);
        localStorage.setItem(`player-modal${suffix}-height`, modalContent.style.height);
        localStorage.setItem(`player-modal${suffix}-left`, modalContent.style.left);
        localStorage.setItem(`player-modal${suffix}-top`, modalContent.style.top);
        
        if (videoPlayerInstance && typeof videoPlayerInstance.resize === 'function') {
          videoPlayerInstance.resize();
        }
      }
    }
  });
}

function drawSponsorSegmentsOnTimeline(duration, playerType) {
  if (!duration || !currentVideoSponsorSegments || currentVideoSponsorSegments.length === 0) return;
  if (!localDb.settings || localDb.settings.sponsorBlockEnabled !== true) return;

  let container = null;
  if (playerType === 'artplayer') {
    container = document.querySelector('#embedded-artplayer .art-progress');
  } else if (playerType === 'plyr') {
    const inlineContainer = document.getElementById('downloaded-inline-player-container');
    if (inlineContainer && !inlineContainer.classList.contains('hidden')) {
      container = inlineContainer.querySelector('.plyr__progress');
    } else {
      container = document.querySelector('#player-modal .plyr__progress');
    }
  }

  if (!container) return;

  let wrapper = container.querySelector('.player-sponsor-markers-wrapper');
  if (wrapper) {
    wrapper.remove();
  }

  wrapper = document.createElement('div');
  wrapper.className = 'player-sponsor-markers-wrapper';
  wrapper.style.position = 'absolute';
  wrapper.style.left = '0';
  wrapper.style.right = '0';
  wrapper.style.top = '0';
  wrapper.style.bottom = '0';
  wrapper.style.pointerEvents = 'none';
  wrapper.style.zIndex = '5';

  if (playerType === 'artplayer') {
    wrapper.style.height = '100%';
  } else if (playerType === 'plyr') {
    wrapper.style.height = '6px';
    wrapper.style.top = '50%';
    wrapper.style.transform = 'translateY(-50%)';
    wrapper.style.borderRadius = '3px';
    wrapper.style.overflow = 'hidden';
  }

  const categoryColors = {
    sponsor: 'rgba(74, 222, 128, 0.65)',      // Green
    selfpromo: 'rgba(250, 204, 21, 0.65)',     // Yellow
    interaction: 'rgba(56, 189, 248, 0.65)',   // Blue
    intro: 'rgba(45, 212, 191, 0.65)',         // Teal
    outro: 'rgba(192, 132, 252, 0.65)',        // Purple
    preview: 'rgba(244, 63, 94, 0.65)',        // Pink/Red
    music_offtopic: 'rgba(244, 63, 94, 0.65)'
  };

  currentVideoSponsorSegments.forEach(seg => {
    const leftPercent = (seg.start / duration) * 100;
    const widthPercent = ((seg.end - seg.start) / duration) * 100;
    const color = categoryColors[seg.category] || 'rgba(255, 255, 255, 0.5)';

    const marker = document.createElement('div');
    marker.style.position = 'absolute';
    marker.style.left = `${leftPercent}%`;
    marker.style.width = `${widthPercent}%`;
    marker.style.height = '100%';
    marker.style.backgroundColor = color;
    marker.style.pointerEvents = 'none';
    marker.style.borderRadius = playerType === 'plyr' ? '0' : '2px';

    wrapper.appendChild(marker);
  });

  container.appendChild(wrapper);
}

/**
 * Videonun en-boy oranına göre oynatıcının yönelimini (dikey/yatay) ayarlar.
 * Dikey videolar için hem modal hem de inline wrapper'a 'is-short-player' sınıfı ekler ve gerçek video oranını atar.
 * 
 * @param {HTMLVideoElement} videoElement Kontrol edilecek video DOM elementi
 */
function adjustPlayerOrientation(videoElement) {
  const modal = document.getElementById('player-modal');
  const inlineWrapper = document.querySelector('.inline-player-wrapper');
  if (!videoElement) return;
  
  if (videoElement.videoWidth && videoElement.videoHeight) {
    const isVertical = videoElement.videoHeight > videoElement.videoWidth;
    if (isVertical) {
      if (modal) {
        modal.classList.add('is-short-player');
        const modalBody = modal.querySelector('.player-modal-body');
        if (modalBody) {
          modalBody.style.aspectRatio = `${videoElement.videoWidth} / ${videoElement.videoHeight}`;
        }
      }
      if (inlineWrapper) {
        inlineWrapper.classList.add('is-short-player');
        inlineWrapper.style.aspectRatio = `${videoElement.videoWidth} / ${videoElement.videoHeight}`;
      }
    } else {
      if (modal) {
        modal.classList.remove('is-short-player');
        const modalBody = modal.querySelector('.player-modal-body');
        if (modalBody) modalBody.style.aspectRatio = '';
      }
      if (inlineWrapper) {
        inlineWrapper.classList.remove('is-short-player');
        inlineWrapper.style.aspectRatio = '';
      }
    }
  }
}

async function fetchSponsorSegments(videoId) {
  currentVideoSponsorSegments = [];
  lastSkippedSegmentStart = -1;
  
  if (!localDb.settings || localDb.settings.sponsorBlockEnabled !== true) {
    return;
  }
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 1500);

  try {
    const categories = '["sponsor","selfpromo","interaction","intro","outro","preview"]';
    const url = `https://sponsor.ajay.app/api/skipSegments?videoID=${videoId}&categories=${encodeURIComponent(categories)}`;
    
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) {
        currentVideoSponsorSegments = data.map(item => ({
          start: item.segment[0],
          end: item.segment[1],
          category: item.category
        }));
        console.log(`[SponsorBlock] Found ${currentVideoSponsorSegments.length} segments:`, currentVideoSponsorSegments);
      }
    }
  } catch (err) {
    clearTimeout(timeoutId);
    console.warn('[SponsorBlock] Failed to fetch segments or request timed out:', err);
  }
}

function updateSponsorBlockStatusUI() {
  const statusEl = document.getElementById('player-sponsorblock-status');
  if (statusEl) statusEl.style.display = 'none';
  const inlineStatusEl = document.getElementById('inline-player-sponsorblock-status');
  if (inlineStatusEl) inlineStatusEl.style.display = 'none';
}

function updateSBToggleButtonUI() {
  const btnSBToggle = document.getElementById('inline-btn-sponsorblock-toggle');
  if (!btnSBToggle) return;

  const lang = (localDb && localDb.settings && localDb.settings.lang) || currentLang || 'tr';
  const t = translations[lang] || translations.tr;

  if (window.sponsorBlockTemporarilyDisabled) {
    btnSBToggle.title = t.sponsorblock_disabled || 'SponsorBlock Devre Dışı';
    btnSBToggle.style.color = '#ef4444';
    btnSBToggle.style.background = 'rgba(239, 68, 68, 0.1)';
    btnSBToggle.style.borderColor = 'rgba(239, 68, 68, 0.2)';
    btnSBToggle.innerHTML = '<i data-lucide="shield-off" style="width: 16px; height: 16px;"></i>';
  } else {
    btnSBToggle.title = t.sponsorblock_active || 'SponsorBlock Aktif';
    btnSBToggle.style.color = '#4ade80';
    btnSBToggle.style.background = 'rgba(74, 222, 128, 0.1)';
    btnSBToggle.style.borderColor = 'rgba(74, 222, 128, 0.2)';
    btnSBToggle.innerHTML = '<i data-lucide="shield" style="width: 16px; height: 16px;"></i>';
  }
  try {
    lucide.createIcons();
  } catch (e) {}

  const wrappers = document.querySelectorAll('.player-sponsor-markers-wrapper');
  wrappers.forEach(w => {
    w.style.opacity = window.sponsorBlockTemporarilyDisabled ? '0.15' : '1';
  });
}

function checkAndSkipSponsor(currentTime, videoElementOrPlayer) {
  if (window.sponsorBlockTemporarilyDisabled) return;
  if (!currentVideoSponsorSegments || currentVideoSponsorSegments.length === 0) return;
  if (!localDb.settings || localDb.settings.sponsorBlockEnabled !== true) return;

  let insideAnySegment = false;
  for (const seg of currentVideoSponsorSegments) {
    if (currentTime >= seg.start && currentTime < (seg.end - 0.1)) {
      insideAnySegment = true;
      if (lastSkippedSegmentStart !== seg.start) {
        lastSkippedSegmentStart = seg.start;
        console.log(`[SponsorBlock] Skipping segment from ${seg.start} to ${seg.end}`);
        showToast(
          currentLang === 'en' 
            ? `Skipped sponsor section (${Math.round(seg.start)}s - ${Math.round(seg.end)}s)` 
            : `Sponsor alanı otomatik atlandı (${Math.round(seg.start)}. sn - ${Math.round(seg.end)}. sn)`, 
          'info'
        );
        videoElementOrPlayer.currentTime = seg.end;
      } else {
        videoElementOrPlayer.currentTime = seg.end;
      }
      break;
    }
  }
  
  if (!insideAnySegment) {
    lastSkippedSegmentStart = -1;
  }
}

window.showPlayerTransientOverlay = function(htmlContent, durationMs = 1200) {
  const activeTab = document.querySelector('.nav-item.active')?.getAttribute('data-tab') || 'history';
  const isInline = (activeTab === 'downloaded');
  let container = null;
  if (isInline) {
    container = document.getElementById('inline-player-body');
  } else if (activeTab === 'iptv') {
    const activeSlotEl = document.querySelector(`.iptv-slot[data-slot="${activeIptvSlot}"]`);
    if (activeSlotEl) {
      container = activeSlotEl.querySelector('.slot-body');
    }
  } else {
    const modal = document.getElementById('player-modal');
    if (modal && !modal.classList.contains('hidden')) {
      container = modal.querySelector('.player-modal-body');
    }
  }
  
  if (!container) return;

  let overlay = container.querySelector('.player-transient-overlay');
  if (overlay) {
    if (overlay._fadeOutTimer) clearTimeout(overlay._fadeOutTimer);
  } else {
    overlay = document.createElement('div');
    overlay.className = 'player-transient-overlay';
    container.appendChild(overlay);
  }

  overlay.innerHTML = htmlContent;
  
  overlay._fadeOutTimer = setTimeout(() => {
    overlay.style.animation = 'fadeOut 0.25s ease-in forwards';
    setTimeout(() => {
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
    }, 250);
  }, durationMs);
};

window.triggerVolumeHUD = function(volume) {
  const volPercent = Math.round(volume * 100);
  const icon = volPercent === 0 ? 'volume-x' : (volPercent < 33 ? 'volume' : (volPercent < 66 ? 'volume-1' : 'volume-2'));
  const html = `
    <div class="player-transient-card volume-hud-card">
      <i data-lucide="${icon}" style="width: 32px; height: 32px; color: var(--accent-primary);"></i>
      <div class="transient-title">${volPercent}%</div>
    </div>
  `;
  if (typeof showPlayerTransientOverlay === 'function') {
    showPlayerTransientOverlay(html, 800);
  }
  try { lucide.createIcons(); } catch(e) {}
};

window.cleanupAllPlayers = function() {
  if (videoPlayerInstance) {
    try {
      if (typeof videoPlayerInstance.destroy === 'function') {
        videoPlayerInstance.destroy();
      }
    } catch (e) {
      console.error("Error destroying videoPlayerInstance:", e);
    }
    videoPlayerInstance = null;
  }

  const videoElements = document.querySelectorAll('video');
  videoElements.forEach(video => {
    try {
      video.pause();
      video.src = '';
      video.load();
    } catch (e) {
      console.error("Error pausing video element:", e);
    }
  });

  const iframes = document.querySelectorAll('.inline-player-body iframe, .player-modal-body iframe');
  iframes.forEach(iframe => {
    try {
      iframe.src = 'about:blank';
      iframe.remove();
    } catch (e) {}
  });

  const inlineBody = document.getElementById('inline-player-body');
  if (inlineBody) {
    inlineBody.innerHTML = '';
  }
  const modalBody = document.querySelector('.player-modal-body');
  if (modalBody) {
    modalBody.innerHTML = '';
    modalBody.style.aspectRatio = '';
  }
  const inlineWrapper = document.querySelector('.inline-player-wrapper');
  if (inlineWrapper) {
    inlineWrapper.classList.remove('is-short-player');
    inlineWrapper.style.aspectRatio = '';
  }
};

// Türkçe Açıklama: İndirilen videoyu arayüz içerisindeki gömülü video oynatıcı (Plyr) modalında açarak yürütür.
/**
 * Videoyu gömülü tarayıcı oynatıcısında (Plyr) açar.
 * Shorts videoları dikey gösterilir ve kalınan izleme süresinden devam eder.
 * 
 * @param {string} videoId Oynatılacak video ID'si
 */
window.playVideoEmbedded = async function(videoId, startSeconds = null, forcePaused = null) {
  cleanupAllPlayers();
  const activeTab = document.querySelector('.nav-item.active')?.getAttribute('data-tab') || 'history';
  const isInline = (activeTab === 'downloaded');

  let video = localDb.history.find(h => h.id === videoId);
  let videoTitle = video ? video.title : '';
  let videoChannelId = video ? video.channelId : '';
  let videoChannelName = video ? video.channelName : '';
  let videoDuration = video ? video.duration : '';
  let fileSizeStr = video ? video.fileSize : '';
  let publishDateStr = video ? (video.publishedAt || video.downloadedAt || '') : '';

  // Fetch SponsorBlock segments
  await fetchSponsorSegments(videoId);
  updateSponsorBlockStatusUI();

  // Fetch available subtitles
  let availableSubtitles = [];
  try {
    const subRes = await fetch(`/api/video/${videoId}/subtitles`);
    const subData = await subRes.json();
    if (subData.success && subData.subtitles) {
      availableSubtitles = subData.subtitles;
    }
  } catch (err) {
    console.error("Error loading subtitles:", err);
  }

  // DOM Fallback
  if (!videoTitle) {
    const cardTitleEl = document.querySelector(`.video-card-title[title*="${videoId}"], .video-card-title[onclick*="${videoId}"]`);
    if (cardTitleEl) {
      videoTitle = cardTitleEl.textContent.trim();
    }
  }
  if (!videoChannelId) {
    const cardEl = document.querySelector(`.video-thumbnail-wrapper[onclick*="${videoId}"]`)?.closest('.video-card');
    if (cardEl) {
      const channelNameEl = cardEl.querySelector('.video-card-channel');
      if (channelNameEl) {
        const nameText = channelNameEl.textContent.trim();
        const chan = localDb.channels?.find(c => c.name === nameText);
        if (chan) videoChannelId = chan.id;
      }
    }
  }

  // Önceki oynatıcılar cleanupAllPlayers ile temizlendi

  let playerContainer = null;

  if (isInline) {
    // 1. Modal oynatıcıyı kapat/gizle
    const modal = document.getElementById('player-modal');
    if (modal) modal.classList.add('hidden');

    // 2. Inline player UI göster/gizle
    const inlineContainer = document.getElementById('downloaded-inline-player-container');
    const listContainer = document.getElementById('downloaded-list-container');
    if (inlineContainer) inlineContainer.classList.remove('hidden');
    if (listContainer) listContainer.classList.add('hidden');

    // Video oynatılmaya başladığında sayfayı en yukarı kaydır (böylece oynatıcı tam olarak görünür olur)
    const mainContent = document.querySelector('.main-content');
    if (mainContent) {
      mainContent.scrollTop = 0;
    }

    playerContainer = document.getElementById('inline-player-body');

    // 3. Bilgileri yerleştir
    const titleEl = document.getElementById('inline-player-title');
    if (titleEl) titleEl.textContent = videoTitle || 'Yerleşik Oynatıcı';

    const channelNameEl = document.getElementById('inline-player-channel-name');
    if (channelNameEl) channelNameEl.textContent = videoChannelName || '';

    const avatarEl = document.getElementById('inline-player-channel-avatar');
    if (avatarEl) {
      if (videoChannelId) {
        avatarEl.src = `/api/channels/${videoChannelId}/avatar`;
        avatarEl.style.display = 'block';
      } else {
        avatarEl.style.display = 'none';
      }
    }

    const channelContainer = document.querySelector('.inline-player-channel');
    if (channelContainer) {
      if (videoChannelId) {
        channelContainer.style.cursor = 'pointer';
        channelContainer.title = localDb.settings?.lang === 'en' ? 'Go to Channel Videos' : 'Kanala Git';
        channelContainer.onclick = (e) => {
          e.preventDefault();
          window.open(`https://www.youtube.com/channel/${videoChannelId}/videos`, '_blank');
        };
      } else {
        channelContainer.style.cursor = 'default';
        channelContainer.title = '';
        channelContainer.onclick = null;
      }
    }

    const publishDateEl = document.getElementById('inline-player-publish-date');
    if (publishDateEl) {
      const isEn = localDb.settings?.lang === 'en';
      const pubDate = video && video.publishedAt ? formatDate(video.publishedAt) : '--';
      publishDateEl.textContent = (isEn ? 'Published: ' : 'Yüklenme: ') + pubDate;
    }

    const downloadDateEl = document.getElementById('inline-player-download-date');
    if (downloadDateEl) {
      const isEn = localDb.settings?.lang === 'en';
      const dlDate = video && video.downloadedAt ? formatDate(video.downloadedAt) : '--';
      downloadDateEl.textContent = (isEn ? 'Downloaded: ' : 'İndirilme: ') + dlDate;
    }

    const fileSizeEl = document.getElementById('inline-player-file-size');
    if (fileSizeEl) {
      const isEn = localDb.settings?.lang === 'en';
      fileSizeEl.textContent = (isEn ? 'Size: ' : 'Boyut: ') + (fileSizeStr || '--');
    }

    // Auto show comments panel
    const commentsContainer = document.getElementById('inline-player-comments-container');
    if (commentsContainer) {
      commentsContainer.classList.remove('hidden');
    }
    const commentsBtn = document.getElementById('inline-btn-comments');
    const isEn = localDb.settings?.lang === 'en';
    if (commentsBtn) {
      commentsBtn.classList.add('active');
      commentsBtn.title = isEn ? 'Hide Comments' : 'Yorumları Gizle';
    }
    loadComments(videoId);

    // Reset and Fetch description panel
    const descContainer = document.getElementById('inline-player-description-container');
    const descContent = document.getElementById('description-content');
    const descBtn = document.getElementById('inline-btn-description');
    
    if (descContainer) descContainer.classList.add('hidden');
    if (descBtn) {
      descBtn.classList.remove('active');
      descBtn.style.display = 'none';
    }
    if (descContent) descContent.innerHTML = '';

    fetch(`/api/video/${videoId}/description`)
      .then(res => res.json())
      .then(data => {
        if (data.success && data.description) {
          if (descContent) {
            descContent.innerHTML = formatDescriptionTimestamps(data.description);
          }
          if (descBtn) {
            descBtn.style.display = 'inline-flex';
            descBtn.classList.add('active');
            descBtn.title = isEn ? 'Hide Description' : 'Açıklamayı Gizle';
          }
          if (descContainer) {
            descContainer.classList.remove('hidden');
          }
        }
      })
      .catch(err => {
        console.error("Error fetching description:", err);
      });

    // Toggle SponsorBlock legend if SponsorBlock is enabled
    const sbLegend = document.getElementById('inline-player-sponsorblock-legend');
    const sbSep = document.getElementById('inline-player-sb-sep');
    if (sbLegend) {
      if (localDb.settings && localDb.settings.sponsorBlockEnabled === true) {
        sbLegend.style.display = 'flex';
        if (sbSep) sbSep.style.display = 'inline';
      } else {
        sbLegend.style.display = 'none';
        if (sbSep) sbSep.style.display = 'none';
      }
    }

    // 4. Eylemleri bağla
    const btnYoutube = document.getElementById('inline-btn-youtube');
    if (btnYoutube) btnYoutube.onclick = () => openYouTube(videoId);

    const btnSystem = document.getElementById('inline-btn-system');
    if (btnSystem) {
      const isCompleted = video && video.status === 'completed';
      const isMissing = video && video.fileMissing === true;
      if (isCompleted && !isMissing) {
        btnSystem.disabled = false;
        btnSystem.style.opacity = '1';
        btnSystem.style.cursor = 'pointer';
        btnSystem.onclick = () => playVideoSystem(videoId);
      } else {
        btnSystem.disabled = true;
        btnSystem.style.opacity = '0.4';
        btnSystem.style.cursor = 'not-allowed';
      }
    }

    const btnFolder = document.getElementById('inline-btn-folder');
    if (btnFolder) {
      const isCompleted = video && video.status === 'completed';
      const isMissing = video && video.fileMissing === true;
      if (isCompleted && !isMissing) {
        btnFolder.disabled = false;
        btnFolder.style.opacity = '1';
        btnFolder.style.cursor = 'pointer';
        btnFolder.onclick = () => openFolder(decodeURIComponent(encodeURIComponent(videoChannelName)));
      } else {
        btnFolder.disabled = true;
        btnFolder.style.opacity = '0.4';
        btnFolder.style.cursor = 'not-allowed';
      }
    }

    const btnDelete = document.getElementById('inline-btn-delete');
    if (btnDelete) {
      const isCompleted = video && video.status === 'completed';
      if (isCompleted) {
        btnDelete.style.display = 'inline-flex';
        btnDelete.onclick = () => showDeleteModal(videoId);
      } else {
        btnDelete.style.display = 'none';
      }
    }

    const btnTranslate = document.getElementById('inline-btn-translate-sub');
    if (btnTranslate) {
      const isCompleted = video && video.status === 'completed';

      if (isCompleted) {
        btnTranslate.style.display = 'inline-flex';
        btnTranslate.onclick = async () => {
          try {
            const lang = localDb.settings?.lang || currentLang || 'tr';
            const t = translations[lang] || translations.tr;

            // Defensive helper function for language names
            const getLangName = (code) => {
              if (!code) return 'Bilinmeyen Dil / Unknown';
              const map = {
                tr: 'Türkçe (TR)',
                en: 'English (EN)',
                es: 'Español (ES)',
                de: 'Deutsch (DE)',
                pt: 'Português (PT)',
                ar: 'العربية (AR)',
                ru: 'Русский (RU)',
                fr: 'Français (FR)',
                it: 'Italiano (IT)',
                ja: '日本語 (JA)',
                zh: '中文 (ZH)'
              };
              const codeLower = String(code).toLowerCase();
              return map[codeLower] || String(code).toUpperCase();
            };

            // Create Modal element
            const modal = document.createElement('div');
            modal.className = 'modal';
            modal.id = 'translate-sub-modal';
            modal.style.zIndex = '15000';
            
            let modalHtml = `
              <div class="modal-content" style="border-radius: 12px; padding: 24px; box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
                <div class="modal-header">
                  <h3>${t.modal_translate_title || 'Altyazı Çevirisi'}</h3>
                  <button class="modal-close-btn" id="close-translate-modal-btn">
                    <i data-lucide="x" style="width: 18px; height: 18px;"></i>
                  </button>
                </div>
                <div class="modal-body">
            `;

            if (!availableSubtitles || availableSubtitles.length === 0) {
              modalHtml += `
                <div style="text-align: center; padding: 12px; color: var(--accent-red); font-size: 0.9rem;">
                  <i data-lucide="alert-triangle" style="width: 32px; height: 32px; margin-bottom: 8px; stroke: var(--accent-red); display: inline-block;"></i>
                  <div>${t.modal_translate_no_subs || 'Bu video için indirilmiş altyazı bulunamadı. Çeviri yapabilmek için en az bir altyazı dosyası indirilmiş olmalıdır.'}</div>
                </div>
              `;
            } else {
              modalHtml += `
                <div class="form-group" style="margin-bottom: 16px;">
                  <label style="display: block; font-size: 0.85rem; color: var(--text-muted); margin-bottom: 6px;">
                    ${t.modal_translate_source || 'Çevrilecek Altyazı (Kaynak)'}
                  </label>
                  <select id="translate-source-lang" class="custom-select-trigger" style="width: 100%; height: 40px; background: var(--bg-sidebar); border: 1px solid var(--border-color); color: var(--text-main); border-radius: 8px; padding: 0 12px; outline: none; font-size: 0.9rem;">
                    ${availableSubtitles.map(s => {
                      const sLang = s && s.lang ? s.lang : '';
                      const sExt = s && s.ext ? String(s.ext).toUpperCase() : 'SRT';
                      return `<option value="${sLang}">${getLangName(sLang)} (${sExt})</option>`;
                    }).join('')}
                  </select>
                </div>
                <div class="form-group" style="margin-bottom: 24px;">
                  <label style="display: block; font-size: 0.85rem; color: var(--text-muted); margin-bottom: 6px;">
                    ${t.modal_translate_target || 'Hedef Dil'}
                  </label>
                  <select id="translate-target-lang" class="custom-select-trigger" style="width: 100%; height: 40px; background: var(--bg-sidebar); border: 1px solid var(--border-color); color: var(--text-main); border-radius: 8px; padding: 0 12px; outline: none; font-size: 0.9rem;">
                    <option value="tr" ${lang === 'tr' ? 'selected' : ''}>Türkçe (TR)</option>
                    <option value="en" ${lang === 'en' ? 'selected' : ''}>English (EN)</option>
                    <option value="es" ${lang === 'es' ? 'selected' : ''}>Español (ES)</option>
                    <option value="de" ${lang === 'de' ? 'selected' : ''}>Deutsch (DE)</option>
                    <option value="pt" ${lang === 'pt' ? 'selected' : ''}>Português (PT)</option>
                    <option value="ar" ${lang === 'ar' ? 'selected' : ''}>العربية (AR)</option>
                    <option value="ru" ${lang === 'ru' ? 'selected' : ''}>Русский (RU)</option>
                    <option value="fr">Français (FR)</option>
                    <option value="it">Italiano (IT)</option>
                    <option value="ja">日本語 (JA)</option>
                    <option value="zh">中文 (ZH)</option>
                  </select>
                </div>
              `;
            }

            modalHtml += `
                </div>
                <div class="modal-actions" style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 20px;">
                  <button class="btn btn-secondary" id="translate-modal-cancel" style="padding: 8px 16px; border-radius: 8px; font-size: 0.85rem; cursor: pointer; background: rgba(255,255,255,0.05); border: 1px solid var(--border-color); color: var(--text-main);">
                    ${t.modal_cancel_btn || 'İptal'}
                  </button>
                  ${availableSubtitles && availableSubtitles.length > 0 ? `
                    <button class="btn btn-primary" id="translate-modal-submit" style="padding: 8px 20px; border-radius: 8px; font-size: 0.85rem; cursor: pointer; font-weight: 600; background: linear-gradient(135deg, var(--accent-primary), var(--accent-secondary)); color: white; border: none;">
                      ${t.btn_translate_action || 'Çevir'}
                    </button>
                  ` : ''}
                </div>
              </div>
            `;

            modal.innerHTML = modalHtml;
            document.body.appendChild(modal);

            try {
              lucide.createIcons();
            } catch (e) {
              console.warn("Lucide icons rendering failed inside modal:", e);
            }

            const closeModal = () => {
              if (modal && modal.parentNode) {
                modal.parentNode.removeChild(modal);
              }
            };

            const closeBtn = document.getElementById('close-translate-modal-btn');
            if (closeBtn) closeBtn.onclick = closeModal;

            const cancelBtn = document.getElementById('translate-modal-cancel');
            if (cancelBtn) cancelBtn.onclick = closeModal;

            const submitBtn = document.getElementById('translate-modal-submit');
            if (submitBtn) {
              submitBtn.onclick = async () => {
                try {
                  const fromLang = document.getElementById('translate-source-lang').value;
                  const toLang = document.getElementById('translate-target-lang').value;

                  if (fromLang === toLang) {
                    showToast(lang === 'en' ? 'Source and target languages cannot be the same.' : 'Kaynak ve hedef dil aynı olamaz.', 'error');
                    return;
                  }

                  closeModal();

                  btnTranslate.disabled = true;
                  btnTranslate.style.opacity = '0.5';
                  const icon = btnTranslate.querySelector('i');
                  if (icon) icon.style.animation = 'spin 1s linear infinite';

                  // Show Toast for translation start
                  showToast(lang === 'en' ? 'Translating subtitles...' : 'Altyazılar çevriliyor...', 'info');

                  // Create and append visual loading overlay
                  const overlay = document.createElement('div');
                  overlay.className = 'subtitle-translation-overlay';
                  overlay.innerHTML = `
                    <div class="subtitle-translation-spinner"></div>
                    <div style="font-weight: 600; font-size: 1.15rem; margin-bottom: 6px; font-family: 'Outfit', sans-serif;">
                      ${t.overlay_translating_title || 'Altyazı Çeviriliyor...'}
                    </div>
                    <div style="font-size: 0.85rem; opacity: 0.8; color: #a1a1aa; max-width: 80%; text-align: center; line-height: 1.4;">
                      ${t.overlay_translating_desc || 'Lütfen bekleyin, altyazı çevirisi yapılıyor...'}
                    </div>
                  `;
                  const targetContainer = playerContainer || document.getElementById('inline-player-body');
                  if (targetContainer) {
                    targetContainer.appendChild(overlay);
                  }

                  try {
                    const res = await fetch(`/api/video/${videoId}/translate-subtitle`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ fromLang, toLang })
                    });
                    const data = await res.json();
                    if (data.success) {
                      showToast(lang === 'en' ? 'Subtitles successfully translated!' : 'Altyazılar başarıyla çevrildi!', 'success');
                      playVideoEmbedded(videoId, videoPlayerInstance ? videoPlayerInstance.currentTime : null);
                    } else {
                      showToast(data.error || 'Translation failed.', 'error');
                    }
                  } catch (err) {
                    console.error('Subtitle translation error:', err);
                    showToast('Translation error occurred.', 'error');
                  } finally {
                    btnTranslate.disabled = false;
                    btnTranslate.style.opacity = '1';
                    if (icon) icon.style.animation = '';
                    if (overlay && overlay.parentNode) {
                      overlay.parentNode.removeChild(overlay);
                    }
                  }
                } catch (submitErr) {
                  console.error("Submit translation click error:", submitErr);
                  showToast("Hata: " + submitErr.message, "error");
                }
              };
            }
          } catch (clickErr) {
            console.error("Translate click error:", clickErr);
            showToast(localDb.settings?.lang === 'en' ? 'An error occurred while opening the translation tool.' : 'Çeviri aracı açılırken bir hata oluştu.', 'error');
          }
        };
      } else {
        btnTranslate.style.display = 'none';
      }
    }

    // SponsorBlock toggle button logic
    const btnSBToggle = document.getElementById('inline-btn-sponsorblock-toggle');
    if (btnSBToggle) {
      if (localDb.settings && localDb.settings.sponsorBlockEnabled === true) {
        btnSBToggle.style.display = 'inline-flex';
        // Reset state on load of new video
        window.sponsorBlockTemporarilyDisabled = false;
        if (typeof updateSBToggleButtonUI === 'function') {
          updateSBToggleButtonUI();
        }

        btnSBToggle.onclick = () => {
          window.sponsorBlockTemporarilyDisabled = !window.sponsorBlockTemporarilyDisabled;
          if (typeof updateSBToggleButtonUI === 'function') {
            updateSBToggleButtonUI();
          }
          if (typeof updateSponsorBlockStatusUI === 'function') {
            updateSponsorBlockStatusUI();
          }
          
          const lang = (localDb && localDb.settings && localDb.settings.lang) || currentLang || 'tr';
          const t = translations[lang] || translations.tr;
          const active = !window.sponsorBlockTemporarilyDisabled;
          const icon = active ? 'shield' : 'shield-off';
          const title = active 
            ? (t.sponsorblock_active_toast || 'SponsorBlock Aktif') 
            : (t.sponsorblock_disabled_toast || 'SponsorBlock Devre Dışı');
          const desc = active 
            ? (t.sponsorblock_active_toast_desc || 'Sponsorlu alanlar otomatik atlanacak') 
            : (t.sponsorblock_disabled_toast_desc || 'Sponsorlu alan atlamaları geçici olarak durduruldu');

          const html = `
            <div class="player-transient-card">
              <i data-lucide="${icon}" style="width: 36px; height: 36px; color: ${active ? '#4ade80' : '#ef4444'};"></i>
              <div class="transient-title">${title}</div>
              <div class="transient-desc">${desc}</div>
            </div>
          `;
          if (typeof showPlayerTransientOverlay === 'function') {
            showPlayerTransientOverlay(html, 1500);
          }
          try {
            lucide.createIcons();
          } catch(e) {}
        };
      } else {
        btnSBToggle.style.display = 'none';
      }
    }

    const btnClose = document.getElementById('inline-btn-close');
    if (btnClose) btnClose.onclick = () => closeInlinePlayer();

    // Autoplay toggle button logic
    const btnAutoplay = document.getElementById('inline-btn-autoplay-toggle');
    if (btnAutoplay) {
      const isAutoplayEnabled = localStorage.getItem('inline-autoplay-enabled') === 'true';
      if (isAutoplayEnabled) {
        btnAutoplay.classList.add('active');
      } else {
        btnAutoplay.classList.remove('active');
      }

      btnAutoplay.onclick = () => {
        const currentlyActive = btnAutoplay.classList.contains('active');
        const nextActive = !currentlyActive;
        localStorage.setItem('inline-autoplay-enabled', nextActive ? 'true' : 'false');
        
        if (nextActive) {
          btnAutoplay.classList.add('active');
        } else {
          btnAutoplay.classList.remove('active');
        }

        const lang = (localDb && localDb.settings && localDb.settings.lang) || currentLang || 'tr';
        const isEn = lang === 'en';
        const title = isEn 
          ? (nextActive ? 'Autoplay: ON' : 'Autoplay: OFF') 
          : (nextActive ? 'Otomatik Geçiş: AÇIK' : 'Otomatik Geçiş: KAPALI');
        const desc = isEn
          ? (nextActive ? 'Next video will play automatically.' : 'Continuous playback disabled.')
          : (nextActive ? 'Sıradaki video otomatik olarak oynatılacak.' : 'Otomatik video geçişi devre dışı bırakıldı.');
        const icon = nextActive ? 'repeat' : 'repeat';
        const color = nextActive ? '#4ade80' : '#ef4444';

        const html = `
          <div class="player-transient-card">
            <i data-lucide="${icon}" style="width: 36px; height: 36px; color: ${color};"></i>
            <div class="transient-title">${title}</div>
            <div class="transient-desc">${desc}</div>
          </div>
        `;
        if (typeof showPlayerTransientOverlay === 'function') {
          showPlayerTransientOverlay(html, 1500);
        }
        try {
          lucide.createIcons();
        } catch(e) {}
      };
    }

    // Subtitle Color & Opacity & Redownload bindings
    const inlineSubColor = document.getElementById('inline-subtitle-color');
    if (inlineSubColor) {
      inlineSubColor.value = (localDb.settings && localDb.settings.subtitleColor) || '#ffffff';
      inlineSubColor.onchange = async (e) => {
        const val = e.target.value;
        localDb.settings.subtitleColor = val;
        document.documentElement.style.setProperty('--subtitle-color', val);
        const globalDropdown = document.getElementById('settings-subtitle-color');
        if (globalDropdown) globalDropdown.value = val;
        
        if (videoPlayerInstance && typeof videoPlayerInstance.subtitle?.style === 'function') {
          videoPlayerInstance.subtitle.style({ color: val });
        }
        
        try {
          await fetch('/api/settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(localDb.settings)
          });
        } catch (err) {
          console.error('subtitleColor save error:', err);
        }
      };
    }

    const inlineSubOpacity = document.getElementById('inline-subtitle-opacity');
    if (inlineSubOpacity) {
      inlineSubOpacity.value = (localDb.settings && localDb.settings.subtitleOpacity) || '0.7';
      inlineSubOpacity.onchange = async (e) => {
        const val = e.target.value;
        localDb.settings.subtitleOpacity = val;
        document.documentElement.style.setProperty('--subtitle-bg-opacity', val);
        
        if (videoPlayerInstance && typeof videoPlayerInstance.subtitle?.style === 'function') {
          videoPlayerInstance.subtitle.style({
            backgroundColor: `rgba(0, 0, 0, ${val})`
          });
        }
        
        try {
          await fetch('/api/settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(localDb.settings)
          });
        } catch (err) {
          console.error('subtitleOpacity save error:', err);
        }
      };
    }

    const inlineSubSize = document.getElementById('inline-subtitle-size');
    if (inlineSubSize) {
      inlineSubSize.value = (localDb.settings && localDb.settings.subtitleSize) || '26px';
      inlineSubSize.onchange = async (e) => {
        const val = e.target.value;
        localDb.settings.subtitleSize = val;
        document.documentElement.style.setProperty('--subtitle-font-size', val);
        
        if (videoPlayerInstance && typeof videoPlayerInstance.subtitle?.style === 'function') {
          videoPlayerInstance.subtitle.style({
            fontSize: val
          });
        }
        
        try {
          await fetch('/api/settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(localDb.settings)
          });
        } catch (err) {
          console.error('subtitleSize save error:', err);
        }
      };
    }

    const btnRedownload = document.getElementById('inline-btn-redownload');
    if (btnRedownload) {
      const isCompleted = video && video.status === 'completed';
      if (isCompleted) {
        btnRedownload.style.display = 'inline-flex';
        btnRedownload.onclick = async () => {
          if (!confirm(localDb.settings?.lang === 'en' 
            ? 'Are you sure you want to delete this video and download it again from scratch?' 
            : 'Bu videoyu silip baştan indirmek istediğinizden emin misiniz?')) {
            return;
          }
          
          try {
            showToast(localDb.settings?.lang === 'en' ? 'Redownload triggered...' : 'Tekrar indirme başlatıldı...', 'info');
            const res = await fetch(`/api/history/${videoId}/redownload`, {
              method: 'POST'
            });
            const data = await res.json();
            if (data.success) {
              showToast(localDb.settings?.lang === 'en' ? 'Video queued for download.' : 'Video tekrar indirilmek üzere kuyruğa eklendi.', 'success');
              if (typeof closeInlinePlayer === 'function') {
                closeInlinePlayer();
              }
            } else {
              showToast(data.error || 'Hata oluştu.', 'error');
            }
          } catch (err) {
            showToast('Sunucu ile iletişim hatası.', 'error');
          }
        };
      } else {
        btnRedownload.style.display = 'none';
      }
    }

    // 5. Çalma listesini oluştur
    renderDownloadedPlaylist(videoId);

  } else {
    // Floating Modal player
    const inlineContainer = document.getElementById('downloaded-inline-player-container');
    const listContainer = document.getElementById('downloaded-list-container');
    if (inlineContainer) inlineContainer.classList.add('hidden');
    if (listContainer) listContainer.classList.remove('hidden');

    const modal = document.getElementById('player-modal');
    const titleEl = document.getElementById('player-modal-title');
    if (modal) {
      if (titleEl) {
        titleEl.textContent = videoTitle || 'Gömülü Video Oynatıcı';
      }
      
      const logoEl = document.getElementById('player-modal-logo');
      if (logoEl && videoChannelId) {
        logoEl.src = `/api/channels/${videoChannelId}/avatar`;
        logoEl.style.display = 'block';
        logoEl.style.cursor = 'pointer';
        logoEl.title = localDb.settings?.lang === 'en' ? 'Go to Channel Videos' : 'Kanala Git';
        logoEl.onclick = (e) => {
          e.preventDefault();
          window.open(`https://www.youtube.com/channel/${videoChannelId}/videos`, '_blank');
        };
        logoEl.onerror = function() {
          this.src = 'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2224%22 height=%2224%22><rect width=%2224%22 height=%2224%22 fill=%22%2316142a%22/><text x=%2250%25%22 y=%2250%25%22 dominant-baseline=%22middle%22 text-anchor=%22middle%22 fill=%22%2394a3b8%22 font-family=%22sans-serif%22 font-size=%2210%22>?</text></svg>';
        };
      } else if (logoEl) {
        logoEl.style.display = 'none';
        logoEl.style.cursor = 'default';
        logoEl.onclick = null;
      }

      modal.classList.remove('minimized');
      const minBtn = document.getElementById('minimize-player-modal-btn');
      if (minBtn) {
        const icon = minBtn.querySelector('i') || minBtn.querySelector('[data-lucide]');
        if (icon) {
          icon.setAttribute('data-lucide', 'minus');
        }
        minBtn.title = localDb.settings && localDb.settings.lang === 'en' ? 'Minimize' : 'Küçült';
      }
      lucide.createIcons();

      const isShort = isShortVideo(videoDuration, videoTitle, videoChannelId);
      if (isShort) {
        modal.classList.add('is-short-player');
      } else {
        modal.classList.remove('is-short-player');
      }
      
      modal.classList.remove('hidden');
      playerContainer = modal.querySelector('.player-modal-body');
      const modalContent = modal.querySelector('.player-modal-content');
      if (modalContent) {
        const suffix = isShort ? '-short' : '';
        const w = localStorage.getItem(`player-modal${suffix}-width`);
        const h = localStorage.getItem(`player-modal${suffix}-height`);
        const l = localStorage.getItem(`player-modal${suffix}-left`);
        const t = localStorage.getItem(`player-modal${suffix}-top`);
        
        modalContent.style.width = w || '';
        modalContent.style.height = h || '';
        modalContent.style.left = l || '';
        modalContent.style.top = t || '';
      }
    }
  }

  seekedForCurrentVideo = false;
  currentPlayingVideoId = videoId;

  const streamUrl = `/api/video-stream?videoId=${videoId}`;
  const playerType = (localDb.settings && localDb.settings.playerType) || 'plyr';
  
  const isCompleted = video && video.status === 'completed';
  const isMissing = video && video.fileMissing === true;
  const playRemote = !isCompleted || isMissing;

  if (playRemote) {
    if (playerContainer) {
      const autoplayVal = (forcePaused === true) ? '0' : '1';
      playerContainer.innerHTML = `<iframe src="https://www.youtube.com/embed/${videoId}?autoplay=${autoplayVal}" style="width: 100%; height: 100%; border: none; display: block;" allow="autoplay; encrypted-media" allowfullscreen></iframe>`;
    }
    videoPlayerInstance = null;
  } else {
    if (playerContainer) {
      if (playerType === 'artplayer') {
        playerContainer.innerHTML = '<div id="embedded-artplayer" style="width: 100%; height: 100%; display: block; outline: none;"></div>';
      } else {
        const autoplayAttr = (forcePaused === true) ? '' : 'autoplay';
        playerContainer.innerHTML = `<video id="embedded-video-player" controls ${autoplayAttr} style="width: 100%; height: 100%; display: block; outline: none;"></video>`;
      }
    }

    if (playerType === 'artplayer' && typeof Artplayer !== 'undefined') {
      let artHighlight = [];
      if (localDb.settings && localDb.settings.sponsorBlockEnabled === true) {
        artHighlight = currentVideoSponsorSegments.map(seg => ({
          time: seg.start,
          text: localDb.settings.lang === 'en' ? `Sponsor Block (${seg.category})` : `Sponsor Alanı (${seg.category})`
        }));
      }

      let defaultSubtitle = null;
      if (availableSubtitles && availableSubtitles.length > 0) {
        defaultSubtitle = availableSubtitles.find(s => s.lang === 'tr') || 
                          availableSubtitles.find(s => s.lang === 'en') || 
                          availableSubtitles[0];
      }

      const artSettings = [];
      if (availableSubtitles && availableSubtitles.length > 0) {
        const isEn = localDb.settings?.lang === 'en';
        const subtitleSelector = [
          {
            default: !defaultSubtitle,
            html: isEn ? 'Off' : 'Kapalı',
            url: ''
          }
        ];
        
        availableSubtitles.forEach(sub => {
          subtitleSelector.push({
            default: defaultSubtitle && defaultSubtitle.lang === sub.lang,
            html: sub.label,
            url: sub.url
          });
        });

        artSettings.push({
          width: 200,
          html: isEn ? 'Subtitle' : 'Altyazı',
          tooltip: defaultSubtitle ? defaultSubtitle.label : (isEn ? 'Off' : 'Kapalı'),
          selector: subtitleSelector,
          onSelect: function (item) {
            if (item.url) {
              videoPlayerInstance.subtitle.show = true;
              videoPlayerInstance.subtitle.url = item.url;
            } else {
              videoPlayerInstance.subtitle.show = false;
            }
            return item.html;
          }
        });
      }

      // Altyazı Rengi Ayarı
      const artIsEn = localDb.settings?.lang === 'en';
      const colors = [
        { value: '#ffffff', nameEn: 'White', nameTr: 'Beyaz' },
        { value: '#ffff00', nameEn: 'Yellow', nameTr: 'Sarı' },
        { value: '#00ff00', nameEn: 'Green', nameTr: 'Yeşil' },
        { value: '#00ffff', nameEn: 'Cyan', nameTr: 'Turkuaz' },
        { value: '#ff00ff', nameEn: 'Pink', nameTr: 'Pembe' },
        { value: '#ff0000', nameEn: 'Red', nameTr: 'Kırmızı' },
        { value: '#0000ff', nameEn: 'Blue', nameTr: 'Mavi' },
        { value: '#ffa500', nameEn: 'Orange', nameTr: 'Turuncu' },
        { value: '#800080', nameEn: 'Purple', nameTr: 'Mor' },
        { value: '#000000', nameEn: 'Black', nameTr: 'Siyah' },
        { value: '#808080', nameEn: 'Gray', nameTr: 'Gri' },
        { value: '#ffffe0', nameEn: 'Light Yellow', nameTr: 'Açık Sarı' }
      ];
      
      const currentColor = (localDb.settings && localDb.settings.subtitleColor) || '#ffffff';
      const colorSelector = colors.map(c => ({
        default: currentColor === c.value,
        html: artIsEn ? c.nameEn : c.nameTr,
        value: c.value
      }));

      artSettings.push({
        width: 200,
        html: artIsEn ? 'Subtitle Color' : 'Altyazı Rengi',
        tooltip: artIsEn 
          ? (colors.find(c => c.value === currentColor)?.nameEn || 'White')
          : (colors.find(c => c.value === currentColor)?.nameTr || 'Beyaz'),
        selector: colorSelector,
        onSelect: function (item) {
          if (videoPlayerInstance && videoPlayerInstance.subtitle) {
            videoPlayerInstance.subtitle.style({
              color: item.value,
              textShadow: '0 0 4px #000000'
            });
          }
          if (localDb && localDb.settings) {
            localDb.settings.subtitleColor = item.value;
            const selectEl = document.getElementById('settings-subtitle-color');
            if (selectEl) selectEl.value = item.value;
            
            // Arka planda ayarları kaydet
            fetch('/api/settings', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ ...localDb.settings, subtitleColor: item.value })
            })
            .catch(err => console.error(err));
          }
          return item.html;
        }
      });

      videoPlayerInstance = new Artplayer({
        container: '#embedded-artplayer',
        url: streamUrl,
        autoplay: forcePaused === true ? false : true,
        autoSize: false,
        autoMini: false,
        playbackRate: true,
        aspectRatio: true,
        setting: true,
        hotkey: false,
        pip: true,
        fullscreen: true,
        mutex: true,
        theme: '#ff0055',
        highlight: artHighlight,
        subtitle: defaultSubtitle ? {
          url: defaultSubtitle.url,
          type: 'vtt',
          style: {
            color: (localDb.settings && localDb.settings.subtitleColor) || '#ffffff',
            backgroundColor: `rgba(0, 0, 0, ${(localDb.settings && localDb.settings.subtitleOpacity) || '0.7'})`,
            fontSize: (localDb.settings && localDb.settings.subtitleSize) || '26px',
            textShadow: '0 0 4px #000000',
          },
        } : undefined,
        settings: artSettings
      });

      if (playerResizeObserver) {
        playerResizeObserver.disconnect();
      }
      playerResizeObserver = new ResizeObserver(() => {
        if (videoPlayerInstance && typeof videoPlayerInstance.resize === 'function') {
          videoPlayerInstance.resize();
        }
      });
      playerResizeObserver.observe(playerContainer);

      // Volume wheel control
      const artContainer = document.getElementById('embedded-artplayer');
      if (artContainer) {
        artContainer.addEventListener('wheel', (e) => {
          e.preventDefault();
          let currentVolume = videoPlayerInstance.volume;
          let newVolume;
          if (e.deltaY < 0) {
            newVolume = Math.min(1, currentVolume + 0.02);
          } else {
            newVolume = Math.max(0, currentVolume - 0.02);
          }
          videoPlayerInstance.volume = newVolume;
          if (typeof triggerVolumeHUD === 'function') {
            triggerVolumeHUD(newVolume);
          }
        }, { passive: false });
      }

      videoPlayerInstance.on('ready', () => {
        const rawVideo = videoPlayerInstance.video;
        if (rawVideo) {
          adjustPlayerOrientation(rawVideo);
          if (rawVideo.duration) {
            drawSponsorSegmentsOnTimeline(rawVideo.duration, 'artplayer');
          }
          rawVideo.addEventListener('loadedmetadata', () => {
            adjustPlayerOrientation(rawVideo);
            drawSponsorSegmentsOnTimeline(rawVideo.duration, 'artplayer');
          });

          rawVideo.addEventListener('timeupdate', () => {
            if (!currentPlayingVideoId) return;
            const currentTime = rawVideo.currentTime;

            if (localDb.settings && localDb.settings.sponsorBlockEnabled === true) {
              checkAndSkipSponsor(currentTime, rawVideo);
            }

            const duration = rawVideo.duration || 0;
            if (currentTime > 2 && duration > 10 && (duration - currentTime) > 5) {
              const resumeData = JSON.parse(localStorage.getItem('haytool_playback_resume') || '{}');
              resumeData[currentPlayingVideoId] = currentTime;
              localStorage.setItem('haytool_playback_resume', JSON.stringify(resumeData));
            } else if (duration > 0 && (duration - currentTime) <= 5) {
              const resumeData = JSON.parse(localStorage.getItem('haytool_playback_resume') || '{}');
              delete resumeData[currentPlayingVideoId];
              localStorage.setItem('haytool_playback_resume', JSON.stringify(resumeData));
            }
          });

          if (!seekedForCurrentVideo && currentPlayingVideoId) {
            const targetTime = (startSeconds !== null) ? startSeconds : (JSON.parse(localStorage.getItem('haytool_playback_resume') || '{}')[currentPlayingVideoId] || 0);
            if (targetTime > 0) {
              rawVideo.currentTime = targetTime;
            }
            seekedForCurrentVideo = true;
          }
          if (forcePaused === true) {
            videoPlayerInstance.pause();
          } else if (forcePaused === false) {
            videoPlayerInstance.play().catch(e => console.warn(e));
          }
          
          rawVideo.addEventListener('ended', () => {
            const isAutoplayEnabled = localStorage.getItem('inline-autoplay-enabled') === 'true';
            if (isAutoplayEnabled) {
              playNextVideoInPlaylist();
            }
          });
        }
      });

    } else {
      const player = document.getElementById('embedded-video-player');
      if (player) {
        // Clear old track tags
        const oldTracks = player.querySelectorAll('track');
        oldTracks.forEach(t => t.remove());

        // Add track tags if available
        if (availableSubtitles && availableSubtitles.length > 0) {
          availableSubtitles.forEach(sub => {
            const track = document.createElement('track');
            track.kind = 'subtitles';
            track.label = sub.label;
            track.srclang = sub.lang;
            track.src = sub.url;
            
            const isDefault = (sub.lang === 'tr' && availableSubtitles.some(s => s.lang === 'tr')) ||
                              (sub.lang === 'en' && !availableSubtitles.some(s => s.lang === 'tr') && sub.lang === 'en') ||
                              (!availableSubtitles.some(s => s.lang === 'tr' || s.lang === 'en') && sub === availableSubtitles[0]);
            
            if (isDefault) {
              track.default = true;
            }
            player.appendChild(track);
          });
        }

        if (playerType === 'plyr' && typeof Plyr !== 'undefined') {
          player.src = streamUrl;
          videoPlayerInstance = new Plyr('#embedded-video-player', {
            iconUrl: '/plyr.svg',
            controls: [
              'play-large', 'restart', 'rewind', 'play', 'fast-forward',
              'progress', 'current-time', 'duration', 'mute', 'volume',
              'captions', 'settings', 'pip', 'fullscreen'
            ],
            settings: ['captions', 'speed', 'loop'],
            speed: { selected: 1, options: [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2] }
          });

          videoPlayerInstance.on('ready', () => {
            adjustPlayerOrientation(videoPlayerInstance.media);
            if (videoPlayerInstance.duration) {
              drawSponsorSegmentsOnTimeline(videoPlayerInstance.duration, 'plyr');
            }
          });
          videoPlayerInstance.on('loadedmetadata', () => {
            adjustPlayerOrientation(videoPlayerInstance.media);
            if (videoPlayerInstance.duration) {
              drawSponsorSegmentsOnTimeline(videoPlayerInstance.duration, 'plyr');
            }
          });

          // Volume wheel control
          const containerSelector = isInline ? '#downloaded-inline-player-container' : '#player-modal';
          const outerContainer = document.querySelector(containerSelector);
          const plyrContainer = outerContainer?.querySelector('.plyr');
          if (plyrContainer) {
            plyrContainer.addEventListener('wheel', (e) => {
              e.preventDefault();
              let currentVolume = videoPlayerInstance.volume;
              let newVolume;
              if (e.deltaY < 0) {
                newVolume = Math.min(1, currentVolume + 0.02);
              } else {
                newVolume = Math.max(0, currentVolume - 0.02);
              }
              videoPlayerInstance.volume = newVolume;
              if (typeof triggerVolumeHUD === 'function') {
                triggerVolumeHUD(newVolume);
              }
            }, { passive: false });
          }

          videoPlayerInstance.on('timeupdate', () => {
            if (!currentPlayingVideoId) return;
            const currentTime = videoPlayerInstance.currentTime;

            if (localDb.settings && localDb.settings.sponsorBlockEnabled === true) {
              checkAndSkipSponsor(currentTime, videoPlayerInstance);
            }

            const duration = videoPlayerInstance.duration || 0;
            if (currentTime > 2 && duration > 10 && (duration - currentTime) > 5) {
              const resumeData = JSON.parse(localStorage.getItem('haytool_playback_resume') || '{}');
              resumeData[currentPlayingVideoId] = currentTime;
              localStorage.setItem('haytool_playback_resume', JSON.stringify(resumeData));
            } else if (duration > 0 && (duration - currentTime) <= 5) {
              const resumeData = JSON.parse(localStorage.getItem('haytool_playback_resume') || '{}');
              delete resumeData[currentPlayingVideoId];
              localStorage.setItem('haytool_playback_resume', JSON.stringify(resumeData));
            }
          });

          videoPlayerInstance.on('canplay', () => {
            if (!seekedForCurrentVideo && currentPlayingVideoId) {
              const targetTime = (startSeconds !== null) ? startSeconds : (JSON.parse(localStorage.getItem('haytool_playback_resume') || '{}')[currentPlayingVideoId] || 0);
              if (targetTime > 0) {
                videoPlayerInstance.currentTime = targetTime;
              }
              seekedForCurrentVideo = true;
            }
          });

          if (forcePaused === true) {
            videoPlayerInstance.pause();
          } else if (forcePaused === false) {
            videoPlayerInstance.play().catch(err => console.warn(err));
          } else {
            videoPlayerInstance.play().catch(err => {
              console.warn('Otomatik oynatma engellendi:', err);
            });
          }

          videoPlayerInstance.on('ended', () => {
            const isAutoplayEnabled = localStorage.getItem('inline-autoplay-enabled') === 'true';
            if (isAutoplayEnabled) {
              playNextVideoInPlaylist();
            }
          });
        } else {
          // HTML5 standard
          player.src = streamUrl;
          player.controls = true;

          player.addEventListener('loadedmetadata', () => {
            adjustPlayerOrientation(player);
          });
          if (player.duration) {
            adjustPlayerOrientation(player);
          }

          player.addEventListener('wheel', (e) => {
            e.preventDefault();
            let currentVolume = player.volume;
            let newVolume;
            if (e.deltaY < 0) {
              newVolume = Math.min(1, currentVolume + 0.02);
            } else {
              newVolume = Math.max(0, currentVolume - 0.02);
            }
            player.volume = newVolume;
            if (typeof triggerVolumeHUD === 'function') {
              triggerVolumeHUD(newVolume);
            }
          }, { passive: false });

          player.addEventListener('timeupdate', () => {
            if (!currentPlayingVideoId) return;
            const currentTime = player.currentTime;

            if (localDb.settings && localDb.settings.sponsorBlockEnabled === true) {
              checkAndSkipSponsor(currentTime, player);
            }

            const duration = player.duration || 0;
            if (currentTime > 2 && duration > 10 && (duration - currentTime) > 5) {
              const resumeData = JSON.parse(localStorage.getItem('haytool_playback_resume') || '{}');
              resumeData[currentPlayingVideoId] = currentTime;
              localStorage.setItem('haytool_playback_resume', JSON.stringify(resumeData));
            } else if (duration > 0 && (duration - currentTime) <= 5) {
              const resumeData = JSON.parse(localStorage.getItem('haytool_playback_resume') || '{}');
              delete resumeData[currentPlayingVideoId];
              localStorage.setItem('haytool_playback_resume', JSON.stringify(resumeData));
            }
          });

          player.addEventListener('canplay', () => {
            if (!seekedForCurrentVideo && currentPlayingVideoId) {
              const targetTime = (startSeconds !== null) ? startSeconds : (JSON.parse(localStorage.getItem('haytool_playback_resume') || '{}')[currentPlayingVideoId] || 0);
              if (targetTime > 0) {
                player.currentTime = targetTime;
              }
              seekedForCurrentVideo = true;
            }
          });

          player.load();
          if (forcePaused === true) {
            player.pause();
          } else if (forcePaused === false) {
            player.play().catch(err => console.warn(err));
          } else {
            player.play().catch(err => {
              console.warn('Otomatik oynatma engellendi:', err);
            });
          }

          player.addEventListener('ended', () => {
            const isAutoplayEnabled = localStorage.getItem('inline-autoplay-enabled') === 'true';
            if (isAutoplayEnabled) {
              playNextVideoInPlaylist();
            }
          });
        }
      }
    }
  }
};

// Türkçe Açıklama: İndirilenler sekmesindeki yerleşik video oynatıcıyı kapatır, çalmakta olan videoyu durdurup kaynağını temizler.
/**
 * Yerleşik video oynatıcıyı kapatır ve çalmakta olan videoyu durdurur.
 * 
 * @returns {void}
 */
window.closeInlinePlayer = function() {
  const inlineContainer = document.getElementById('downloaded-inline-player-container');
  const listContainer = document.getElementById('downloaded-list-container');
  if (inlineContainer && inlineContainer.classList.contains('hidden')) {
    return;
  }
  if (inlineContainer) inlineContainer.classList.add('hidden');
  if (listContainer) listContainer.classList.remove('hidden');

  cleanupAllPlayers();

  currentPlayingVideoId = null;
  seekedForCurrentVideo = false;
};

/**
 * Yerleşik oynatıcı çalma listesi sidebar sıralama butonlarının aktiflik ve yön durumlarını günceller.
 */
function updateSidebarSortButtons() {
  const btnDate = document.getElementById('inline-btn-sort-date');
  const btnSize = document.getElementById('inline-btn-sort-size');
  const btnUser = document.getElementById('inline-btn-sort-user');
  const txtDate = document.getElementById('inline-btn-sort-date-text');
  const txtSize = document.getElementById('inline-btn-sort-size-text');

  if (!btnDate || !btnSize) return;

  const isEn = localDb.settings?.lang === 'en';

  btnDate.classList.remove('active');
  btnSize.classList.remove('active');
  if (btnUser) btnUser.classList.remove('active');

  if (downloadedSortVal === 'user') {
    if (btnUser) btnUser.classList.add('active');
    if (txtDate) txtDate.textContent = isEn ? 'Date ▼' : 'Tarih ▼';
    if (txtSize) txtSize.textContent = isEn ? 'Size ▼' : 'Boyut ▼';
  } else if (downloadedSortVal.startsWith('date-')) {
    btnDate.classList.add('active');
    if (downloadedSortVal === 'date-asc') {
      if (txtDate) txtDate.textContent = isEn ? 'Date ▲' : 'Tarih ▲';
    } else {
      if (txtDate) txtDate.textContent = isEn ? 'Date ▼' : 'Tarih ▼';
    }
    if (txtSize) txtSize.textContent = isEn ? 'Size ▼' : 'Boyut ▼';
  } else if (downloadedSortVal.startsWith('size-')) {
    btnSize.classList.add('active');
    if (downloadedSortVal === 'size-asc') {
      if (txtSize) txtSize.textContent = isEn ? 'Size ▲' : 'Boyut ▲';
    } else {
      if (txtSize) txtSize.textContent = isEn ? 'Size ▼' : 'Boyut ▼';
    }
    if (txtDate) txtDate.textContent = isEn ? 'Date ▼' : 'Tarih ▼';
  }
}

// Türkçe Açıklama: Yerleşik oynatıcının sağ tarafındaki dikey oynatma listesinde indirilmiş diğer videoları kartlar halinde listeler.
/**
 * Yerleşik oynatıcı için çalma listesi sidebar içeriğini render eder.
 * 
 * @param {string} currentVideoId Aktif oynatılan video ID'si
 * @returns {void}
 */
function renderDownloadedPlaylist(currentVideoId) {
  const playlistGrid = document.getElementById('downloaded-playlist-grid');
  if (!playlistGrid) return;
  playlistGrid.innerHTML = '';

  const titleEl = document.getElementById('inline-sidebar-title');
  if (titleEl) {
    titleEl.textContent = currentLang === 'en' ? 'Downloads' : 'İndirilenler';
  }

  // Update sorting buttons state
  if (typeof updateSidebarSortButtons === 'function') {
    updateSidebarSortButtons();
  }

  // Update Shorts label text if exists
  const labelShortsText = document.getElementById('inline-label-shorts-text');
  if (labelShortsText) {
    labelShortsText.textContent = currentLang === 'en' ? 'Shorts' : 'Shorts';
  }

  let filteredDownloaded = localDb.history.filter(item => item.status === 'completed');
  if (downloadedFilterChannel !== 'all') {
    filteredDownloaded = filteredDownloaded.filter(item => item.channelId === downloadedFilterChannel);
  }
  const showShorts = localDb.settings?.showShorts !== false;
  if (!showShorts) {
    filteredDownloaded = filteredDownloaded.filter(item => !isShortVideo(item.duration, item.title, item.channelId));
  }
  
  const sortVal = downloadedSortVal || 'date-desc';
  filteredDownloaded.sort((a, b) => {
    if (sortVal === 'user') {
      const customOrder = JSON.parse(localStorage.getItem('downloaded-user-order') || '[]');
      let indexA = customOrder.indexOf(a.id);
      let indexB = customOrder.indexOf(b.id);
      
      if (indexA === -1 && indexB === -1) {
        const dateA = new Date(a.publishedAt || a.downloadedAt || 0).getTime();
        const dateB = new Date(b.publishedAt || b.downloadedAt || 0).getTime();
        return dateB - dateA;
      }
      if (indexA === -1) return -1;
      if (indexB === -1) return 1;
      
      return indexA - indexB;
    } else if (sortVal.startsWith('size-')) {
      const sizeA = parseSizeToBytes(a.fileSize);
      const sizeB = parseSizeToBytes(b.fileSize);
      return sortVal === 'size-desc' ? sizeB - sizeA : sizeA - sizeB;
    } else {
      const dateA = new Date(a.publishedAt || a.downloadedAt || 0).getTime();
      const dateB = new Date(b.publishedAt || b.downloadedAt || 0).getTime();
      return sortVal === 'date-asc' ? dateA - dateB : dateB - dateA;
    }
  });

  if (filteredDownloaded.length === 0) {
    playlistGrid.innerHTML = `<p class="text-muted" style="font-size:0.8rem; padding: 10px;">${currentLang === 'en' ? 'No other videos found' : 'Başka video bulunamadı'}</p>`;
    return;
  }

  filteredDownloaded.forEach(item => {
    const isCurrent = item.id === currentVideoId;
    const itemEl = document.createElement('div');
    itemEl.className = `playlist-item${isCurrent ? ' active' : ''}`;
    itemEl.setAttribute('data-id', item.id);
    if (sortVal === 'user') {
      itemEl.setAttribute('draggable', 'true');
    }
    
    itemEl.onclick = () => {
      if (!isCurrent) {
        playVideoEmbedded(item.id);
      }
    };

    const durationHtml = item.duration ? `<span class="playlist-item-duration">${item.duration}</span>` : '';

    itemEl.innerHTML = `
      <div class="playlist-item-thumbnail-wrapper">
        <img class="playlist-item-thumbnail" src="/api/video/${item.id}/thumbnail" alt="${escapeHtml(item.title)}" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22100%22 height=%2256%22><rect width=%22100%22 height=%2256%22 fill=%22%2316142a%22/><text x=%2250%25%22 y=%2250%25%22 dominant-baseline=%22middle%22 text-anchor=%22middle%22 fill=%22%2394a3b8%22 font-family=%22sans-serif%22 font-size=%228%22>No Image</text></svg>'">
        ${durationHtml}
      </div>
      <div class="playlist-item-details">
        <h5 class="playlist-item-title" title="${escapeHtml(item.title)}">${escapeHtml(item.title)}</h5>
        <div class="playlist-item-channel" style="font-size:0.75rem; color:var(--text-muted); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${escapeHtml(item.channelName || '')} • ${item.fileSize || '-- MB'} • ${formatDate(item.publishedAt || item.downloadedAt)}">
          ${escapeHtml(item.channelName || '')} • ${item.fileSize || '-- MB'} • ${formatDate(item.publishedAt || item.downloadedAt)}
        </div>
      </div>
    `;
    playlistGrid.appendChild(itemEl);
  });
}

// Türkçe Açıklama: İndirilen video dosyasını işletim sisteminin (Windows) varsayılan medya oynatıcısında (VLC, Windows Media Player vb.) açar.
/**
 * Videoyu işletim sisteminin varsayılan medya oynatıcısında (VLC, KMPlayer vb.) çalıştırır.
 * 
 * @param {string} videoId Oynatılacak video ID'si
 */
window.playVideoSystem = async function(videoId) {
  try {
    showToast('Video oynatıcıda açılıyor...', 'info');
    const res = await fetch('/api/play-video', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ videoId })
    });
    const data = await res.json();
    if (!data.success) {
      showToast(data.error || 'Video oynatılamadı. Dosya taşınmış veya silinmiş olabilir.', 'error');
    }
  } catch (err) {
    showToast('Sunucu ile iletişim hatası.', 'error');
  }
};

// Türkçe Açıklama: Arayüzdeki gömülü Plyr video oynatıcı modalını kapatır ve çalmakta olan videoyu durdurup kaynağını temizler.
/**
 * Gömülü video oynatıcı modalını kapatır ve çalmakta olan videoyu durdurur.
 */
window.closePlayerModal = function() {
  const modal = document.getElementById('player-modal');
  if (modal && modal.classList.contains('hidden')) {
    return;
  }
  if (modal) {
    modal.classList.add('hidden');
    modal.classList.remove('is-short-player');
    modal.classList.remove('minimized');
    
    // Reset drag position to default bottom-right
    const modalContent = modal.querySelector('.player-modal-content');
    if (modalContent) {
      modalContent.style.left = '';
      modalContent.style.top = '';
      modalContent.style.bottom = '';
      modalContent.style.right = '';
    }
  }

  // Disconnect ResizeObserver
  if (playerResizeObserver) {
    playerResizeObserver.disconnect();
    playerResizeObserver = null;
  }
  cleanupAllPlayers();
  currentPlayingVideoId = null;
  seekedForCurrentVideo = false;
  
  const minBtn = document.getElementById('minimize-player-modal-btn');
  if (minBtn) {
    const icon = minBtn.querySelector('i') || minBtn.querySelector('[data-lucide]');
    if (icon) {
      icon.setAttribute('data-lucide', 'minus');
    }
  }
  lucide.createIcons();
};

// Türkçe Açıklama: Belirtilen video ID'sine ait YouTube izleme sayfasını tarayıcıda yeni bir sekmede açar.
/**
 * Belirtilen videonun YouTube sayfasını yeni tarayıcı sekmesinde açar.
 * 
 * @param {string} videoId Açılacak video ID'si
 */
window.openYouTube = function(videoId) {
  window.open(`https://www.youtube.com/watch?v=${videoId}`, '_blank');
};

// Türkçe Açıklama: Seçilen videoyu geçmişten veya diskteki dosyasından silmek üzere kullanıcıya onay modalı (penceresi) gösterir.
/**
 * Geçmişten veya diskten video silmek için onay modalını açar.
 * 
 * @param {string} id Silinecek video ID'si
 */
window.showDeleteModal = function(id) {
  const item = localDb.history.find(h => h.id === id);
  if (!item) return;

  videoIdToDelete = id;
  deleteModalMsg.innerHTML = `<strong>"${escapeHtml(item.title)}"</strong> başlıklı videoyu geçmişten kaldırmak istediğinize emin misiniz?`;
  
  // Bilgisayardan dosya silme kutusunu her zaman gösterelim (kullanıcı diskteki dosyayı da temizlemek isteyebilir)
  const checkboxContainer = deleteModal.querySelector('.checkbox-container');
  checkboxContainer.classList.remove('hidden');
  deleteFileCheckbox.checked = true;
  
  deleteModal.classList.remove('hidden');
};

/**
 * Silme onay modalını kapatır ve seçili video ID'sini sıfırlar.
 */
function hideDeleteModal() {
  deleteModal.classList.add('hidden');
  videoIdToDelete = null;
}

if (closeDeleteModalBtn) closeDeleteModalBtn.addEventListener('click', hideDeleteModal);
if (cancelDeleteBtn) cancelDeleteBtn.addEventListener('click', hideDeleteModal);

// Silme Onaylama Butonu Dinleyicisi
if (confirmDeleteBtn) {
  confirmDeleteBtn.addEventListener('click', async () => {
    if (!videoIdToDelete) return;
    
    const id = videoIdToDelete;
    const deleteFile = deleteFileCheckbox.checked;
    hideDeleteModal();
    
    try {
      showToast('İşlem gerçekleştiriliyor...', 'info');
      const res = await fetch(`/api/history/${id}?deleteFile=${deleteFile}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (data.success) {
        if (id === currentPlayingVideoId) {
          if (window.closePlayerModal) window.closePlayerModal();
          if (window.closeInlinePlayer) window.closeInlinePlayer();
        }
        // Başarı bildirimi sunucudan (SSE status_log) gelecek
        setTimeout(updateDiskSpace, 1500); // Dosya silinmesinin tamamlanması için kısa bir süre bekle
      } else {
        showToast(data.error || 'Silme işlemi başarısız oldu.', 'error');
      }
    } catch (err) {
      showToast('Sunucu ile iletişim hatası.', 'error');
    }
  });
}

// Görünüm ve Filtre Olay Dinleyicileri
// Görünüm ve Filtre Olay Dinleyicileri
if (viewGridBtn) {
  viewGridBtn.addEventListener('click', () => {
    historyViewMode = 'grid';
    updateUI(localDb);
  });
}

if (viewListBtn) {
  viewListBtn.addEventListener('click', () => {
    historyViewMode = 'list';
    updateUI(localDb);
  });
}

if (historyChannelFilter) {
  historyChannelFilter.addEventListener('change', () => {
    historyFilterChannel = historyChannelFilter.value;
    updateUI(localDb);
  });
}

// Hızlı Tarih Filtreleme Buton Dinleyicileri
document.querySelectorAll('.btn-filter').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.btn-filter').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    historyFilterDays = btn.getAttribute('data-days');
    updateUI(localDb);
  });
});

if (downloadedViewGridBtn) {
  downloadedViewGridBtn.addEventListener('click', () => {
    downloadedViewMode = 'grid';
    updateUI(localDb);
  });
}

if (downloadedViewListBtn) {
  downloadedViewListBtn.addEventListener('click', () => {
    downloadedViewMode = 'list';
    updateUI(localDb);
  });
}

if (downloadedChannelFilter) {
  downloadedChannelFilter.addEventListener('change', () => {
    downloadedFilterChannel = downloadedChannelFilter.value;
    updateUI(localDb);
  });
}

// Sıralama Butonları Dinleyicisi
let downloadedSortVal = localStorage.getItem('downloaded-sort-val') || 'date-desc';
document.addEventListener('click', (e) => {
  const btn = e.target.closest('.sort-btn');
  if (btn && btn.closest('#downloaded-sort-group')) {
    const sortVal = btn.getAttribute('data-sort');
    downloadedSortVal = sortVal;
    localStorage.setItem('downloaded-sort-val', downloadedSortVal);
    
    // Aktif sınıfını güncelle
    const group = document.getElementById('downloaded-sort-group');
    if (group) {
      group.querySelectorAll('.sort-btn').forEach(b => b.classList.remove('active'));
    }
    btn.classList.add('active');
    
    updateUI(localDb);
  }
});

// Shorts Göster/Gizle Değiştiğinde Sunucuya Kaydet
document.addEventListener('DOMContentLoaded', () => {
  const historyOnlyNoAutoDownloadCheck = document.getElementById('history-only-no-auto-download');
  if (historyOnlyNoAutoDownloadCheck) {
    historyOnlyNoAutoDownloadCheck.addEventListener('change', () => {
      historyOnlyNoAutoDownload = historyOnlyNoAutoDownloadCheck.checked;
      updateUI(localDb);
    });
  }

  const historyOnlyNotDownloadedCheck = document.getElementById('history-only-not-downloaded');
  if (historyOnlyNotDownloadedCheck) {
    historyOnlyNotDownloadedCheck.addEventListener('change', () => {
      historyOnlyNotDownloaded = historyOnlyNotDownloadedCheck.checked;
      updateUI(localDb);
    });
  }

  const historyShowShorts = document.getElementById('history-show-shorts');
  if (historyShowShorts) {
    historyShowShorts.addEventListener('change', async () => {
      const showShorts = historyShowShorts.checked;
      try {
        const res = await fetch('/api/settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...localDb.settings, showShorts })
        });
        const data = await res.json();
        if (data.success) {
          showToast(showShorts ? 'Shorts videoları gösteriliyor.' : 'Shorts videoları gizlendi.', 'success');
        }
      } catch (err) {
        showToast('Ayarlar kaydedilemedi.', 'error');
      }
    });
  }

  const downloadedShowShorts = document.getElementById('downloaded-show-shorts');
  if (downloadedShowShorts) {
    downloadedShowShorts.addEventListener('change', async () => {
      const showShorts = downloadedShowShorts.checked;
      
      if (!localDb.settings) localDb.settings = {};
      localDb.settings.showShorts = showShorts;
      
      const inlineCheckbox = document.getElementById('inline-playlist-show-shorts');
      if (inlineCheckbox) {
        inlineCheckbox.checked = showShorts;
      }
      
      updateUI(localDb);
      if (currentPlayingVideoId) {
        renderDownloadedPlaylist(currentPlayingVideoId);
      }
      
      try {
        const res = await fetch('/api/settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...localDb.settings, showShorts })
        });
        const data = await res.json();
        if (data.success) {
          showToast(showShorts ? 'Shorts videoları gösteriliyor.' : 'Shorts videoları gizlendi.', 'success');
        }
      } catch (err) {
        showToast('Ayarlar kaydedilemedi.', 'error');
      }
    });
  }

  // Playlist Sidebar Sıralama Butonları Dinleyicileri
  const btnSortDate = document.getElementById('inline-btn-sort-date');
  if (btnSortDate) {
    btnSortDate.addEventListener('click', () => {
      if (downloadedSortVal === 'date-desc') {
        downloadedSortVal = 'date-asc';
      } else {
        downloadedSortVal = 'date-desc';
      }
      localStorage.setItem('downloaded-sort-val', downloadedSortVal);
      // UI güncelle
      updateUI(localDb);
      if (currentPlayingVideoId) {
        renderDownloadedPlaylist(currentPlayingVideoId);
      }
    });
  }

  const btnSortSize = document.getElementById('inline-btn-sort-size');
  if (btnSortSize) {
    btnSortSize.addEventListener('click', () => {
      if (downloadedSortVal === 'size-desc') {
        downloadedSortVal = 'size-asc';
      } else {
        downloadedSortVal = 'size-desc';
      }
      localStorage.setItem('downloaded-sort-val', downloadedSortVal);
      // UI güncelle
      updateUI(localDb);
      if (currentPlayingVideoId) {
        renderDownloadedPlaylist(currentPlayingVideoId);
      }
    });
  }

  const btnSortUser = document.getElementById('inline-btn-sort-user');
  if (btnSortUser) {
    btnSortUser.addEventListener('click', () => {
      downloadedSortVal = 'user';
      localStorage.setItem('downloaded-sort-val', downloadedSortVal);
      // UI güncelle
      updateUI(localDb);
      if (currentPlayingVideoId) {
        renderDownloadedPlaylist(currentPlayingVideoId);
      }
    });
  }

  // Playlist Sidebar Shorts Göster/Gizle Dinleyicisi
  const inlinePlaylistShowShorts = document.getElementById('inline-playlist-show-shorts');
  if (inlinePlaylistShowShorts) {
    inlinePlaylistShowShorts.addEventListener('change', async () => {
      const showShorts = inlinePlaylistShowShorts.checked;
      
      // Local state'i ve normal checkbox'ı güncelle
      if (!localDb.settings) localDb.settings = {};
      localDb.settings.showShorts = showShorts;
      
      const normalCheckbox = document.getElementById('downloaded-show-shorts');
      if (normalCheckbox) {
        normalCheckbox.checked = showShorts;
      }
      
      // UI'yı yerel olarak güncelle
      updateUI(localDb);
      if (currentPlayingVideoId) {
        renderDownloadedPlaylist(currentPlayingVideoId);
      }
      
      try {
        const res = await fetch('/api/settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...localDb.settings, showShorts })
        });
        const data = await res.json();
        if (data.success) {
          showToast(showShorts ? 'Shorts videoları gösteriliyor.' : 'Shorts videoları gizlendi.', 'success');
        }
      } catch (err) {
        showToast('Ayarlar kaydedilemedi.', 'error');
      }
    });
  }
});

// Türkçe Açıklama: Devam eden veya kuyrukta bekleyen bir indirme işlemini durdurup iptal etmesi için backend API'sine istek yollar.
/**
 * Devam etmekte olan aktif bir video indirme işlemini iptal eder.
 * 
 * @param {string} videoId İptal edilecek video ID'si
 */
window.cancelDownload = async function(videoId) {
  if (!confirm('Bu indirme işlemini iptal etmek istediğinizden emin misiniz?')) return;
  
  try {
    showToast('İndirme iptal ediliyor...', 'info');
    const res = await fetch('/api/cancel-download', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ videoId })
    });
    const data = await res.json();
    if (data.success) {
      // Başarı durumunda sunucu bildirim gönderecektir
    } else {
      showToast(data.error || 'İptal işlemi başarısız oldu.', 'error');
    }
  } catch (err) {
    showToast('Sunucu ile iletişim hatası.', 'error');
  }
};

/**
 * Tüm aktif ve kuyruktaki indirmeleri iptal eder.
 */
window.cancelAllDownloads = async function() {
  if (!confirm('Tüm aktif ve kuyruktaki indirmeleri iptal etmek istediğinize emin misiniz?')) return;
  
  try {
    showToast('Tüm indirmeler iptal ediliyor...', 'info');
    const res = await fetch('/api/cancel-all-downloads', {
      method: 'POST'
    });
    const data = await res.json();
    if (data.success) {
      showToast('Tüm indirmeler iptal edildi.', 'success');
    } else {
      showToast(data.error || 'İptal işlemi başarısız oldu.', 'error');
    }
  } catch (err) {
    showToast('Sunucu ile iletişim hatası.', 'error');
  }
};

/**
 * İndirme kuyruğunda (sırasında) bekleyen bir videoyu sıradan çıkarır.
 * 
 * @param {string} videoId Sıradan çıkarılacak video ID'si
 */
window.cancelQueuedVideo = async function(videoId) {
  if (!confirm('Bu videoyu indirme sırasından çıkarmak istediğinizden emin misiniz?')) return;
  
  try {
    showToast('Sıradan çıkarılıyor...', 'info');
    const res = await fetch('/api/cancel-download', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ videoId })
    });
    const data = await res.json();
    if (data.success) {
      // Başarı durumunda sunucu bildirim gönderecektir (SSE ile)
    } else {
      showToast(data.error || 'İptal işlemi başarısız oldu.', 'error');
    }
  } catch (err) {
    showToast('Sunucu ile iletişim hatası.', 'error');
  }
};

window.cancelAllQueued = async function() {
  const isEn = localDb.settings && localDb.settings.lang === 'en';
  if (!confirm(isEn ? 'Are you sure you want to cancel all queued videos?' : 'Kuyruktaki tüm videoları iptal etmek istediğinizden emin misiniz?')) return;
  
  try {
    showToast(isEn ? 'Cancelling all queued videos...' : 'Tüm kuyruk iptal ediliyor...', 'info');
    const res = await fetch('/api/cancel-all-queued', { method: 'POST' });
    const data = await res.json();
    if (data.success) {
      // Server broadcasts update
    } else {
      showToast(data.error || (isEn ? 'Cancel failed.' : 'İptal işlemi başarısız oldu.'), 'error');
    }
  } catch (err) {
    showToast(isEn ? 'Communication error.' : 'Sunucu ile iletişim hatası.', 'error');
  }
};

// Aktif İndirme İptal Butonu Dinleyicisi
document.addEventListener('DOMContentLoaded', () => {
  const cancelActiveBtn = document.getElementById('cancel-active-btn');
  if (cancelActiveBtn) {
    cancelActiveBtn.addEventListener('click', () => {
      const activeDownload = localDb.history.find(h => h.status === 'downloading');
      const activeMerging = localDb.history.find(h => h.status === 'merging');
      const target = activeDownload || activeMerging;
      if (target) {
        cancelDownload(target.id);
      } else {
        showToast('Şu anda aktif bir işlem bulunmuyor.', 'info');
      }
    });
  }

  // Türkçe Açıklama: Ayarlar sayfasında alt sekmeler arasında tıklama ile geçiş yapılmasını ve ilgili ayar gruplarının görüntülenmesini sağlar.
  const settingsTabBtns = document.querySelectorAll('.settings-tab-btn');
  settingsTabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      settingsTabBtns.forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.settings-subtab-content').forEach(c => c.classList.remove('active'));
      
      btn.classList.add('active');
      const targetSubtab = btn.getAttribute('data-subtab');
      const targetContent = document.getElementById(`subtab-${targetSubtab}`);
      if (targetContent) {
        targetContent.classList.add('active');
      }
    });
  });
});

// Türkçe Açıklama: İndirme yapılan disk bölümündeki boş alan miktarı ile indirme klasörünün toplam boyutunu API'den sorgulayarak sağ üst köşedeki durum çubuğuna yansıtır.
/**
 * Disk boş alanını ve indirme klasörü boyutunu sunucudan çekip durum çubuğunu günceller.
 * 
 * @returns {Promise<void>}
 */
async function updateDiskSpace() {
  const diskStatusFree = document.getElementById('disk-status-free');
  const diskStatusFolder = document.getElementById('disk-status-folder');
  if (!diskStatusFree) return;
  
  try {
    const res = await fetch('/api/disk-space');
    const data = await res.json();
    if (data.success) {
      const freeGB = Math.round(data.freeBytes / (1024 * 1024 * 1024));
      const totalGB = Math.round(data.totalBytes / (1024 * 1024 * 1024));
      const folderGB = Math.round(data.folderSizeBytes / (1024 * 1024 * 1024));
      
      const isEn = localDb.settings && localDb.settings.lang === 'en';
      diskStatusFree.textContent = `${freeGB} GB`;
      if (diskStatusFolder) {
        diskStatusFolder.textContent = `${folderGB} GB`;
      }
      
      diskStatusFree.title = isEn 
        ? `Drive Free Space: ${freeGB} GB / Total: ${totalGB} GB (${data.driveLetter}:)`
        : `Sürücü Boş Alanı: ${freeGB} GB / Toplam: ${totalGB} GB (${data.driveLetter}:)`;
      if (diskStatusFolder) {
        diskStatusFolder.title = isEn
          ? `Main Download Folder Total Size: ${folderGB} GB`
          : `Ana İndirme Klasörü Toplam Boyutu: ${folderGB} GB`;
      }
    } else {
      const isEn = localDb.settings && localDb.settings.lang === 'en';
      diskStatusFree.textContent = isEn ? 'Unknown' : 'Bilinmiyor';
      if (diskStatusFolder) diskStatusFolder.textContent = isEn ? 'Unknown' : 'Bilinmiyor';
    }
  } catch (err) {
    const isEn = localDb.settings && localDb.settings.lang === 'en';
    diskStatusFree.textContent = isEn ? 'Error' : 'Hata';
    if (diskStatusFolder) diskStatusFolder.textContent = isEn ? 'Error' : 'Hata';
  }
}

// Türkçe Açıklama: Kanal ekleme kutusundaki arama sorgusunu alarak YouTube'da arama yapar ve sonuçları kart yapısında listeler.
/**
 * YouTube kanal arama işlemini tetikler ve arayüzde sonuçları gösterir.
 */
window.triggerChannelSearch = async function() {
  const inputEl = document.getElementById('channel-input');
  if (!inputEl) return;
  
  const query = inputEl.value.trim();
  const isEn = localDb.settings && localDb.settings.lang === 'en';
  
  if (!query) {
    showToast(isEn ? 'Please enter a search query.' : 'Lütfen aramak için bir metin girin.', 'error');
    return;
  }
  
  // Eğer girilen değer bir URL ise doğrudan eklemeyi önerebilir veya aramayı durdurabiliriz
  if (query.startsWith('http') || query.includes('youtube.com') || query.includes('youtu.be')) {
    showToast(isEn ? 'This is a URL. Please click "Follow Channel" button instead.' : 'Bu bir adres. Lütfen "Kanalı Takip Et" butonunu kullanın.', 'info');
    return;
  }
  
  const resultsContainer = document.getElementById('channel-search-results');
  const resultsList = document.getElementById('search-results-list');
  const searchBtn = document.getElementById('search-channel-btn');
  
  if (!resultsContainer || !resultsList) return;
  
  try {
    if (searchBtn) searchBtn.disabled = true;
    showToast(isEn ? 'Searching channels on YouTube...' : 'YouTube üzerinde kanallar aranıyor...', 'info');
    
    const res = await fetch(`/api/channels/search?q=${encodeURIComponent(query)}`);
    const data = await res.json();
    
    resultsList.innerHTML = '';
    
    if (data && data.length > 0) {
      data.forEach(channel => {
        const item = document.createElement('div');
        item.className = 'channel-item card';
        item.style.display = 'flex';
        item.style.justifyContent = 'space-between';
        item.style.alignItems = 'center';
        item.style.padding = '10px 15px';
        item.style.background = 'var(--bg-card-hover)';
        item.style.border = '1px solid var(--border-color)';
        item.style.borderRadius = '6px';
        
        // Kanala daha önce ekli mi kontrolü
        const isFollowed = localDb.channels.some(c => c.id === channel.id);
        
        item.innerHTML = `
          <div style="display:flex; align-items:center; gap:12px;">
            <img src="${channel.avatar || '/api/channels/' + channel.id + '/avatar'}" style="width:40px; height:40px; border-radius:50%; object-fit:cover; border:1px solid var(--border-color);" onerror="this.src='https://www.youtube.com/s/desktop/9c83acbb/img/avatar_placeholder_40.png'">
            <div>
              <div style="font-weight:600; color:var(--text-color);">${channel.name}</div>
              <div style="font-size:0.8rem; color:var(--text-muted);">${channel.handle} • ${channel.subscribers}</div>
            </div>
          </div>
          <div>
            ${isFollowed 
              ? `<button class="btn btn-secondary btn-sm" disabled style="opacity: 0.6;">${isEn ? 'Following' : 'Takip Ediliyor'}</button>`
              : `<button class="btn btn-primary btn-sm" onclick="followChannelFromSearch('${channel.id}', '${channel.name.replace(/'/g, "\\'")}', '${channel.handle}', '${channel.avatar}')">${isEn ? 'Follow' : 'Takip Et'}</button>`
            }
          </div>
        `;
        resultsList.appendChild(item);
      });
      resultsContainer.style.display = 'block';
      showToast(isEn ? 'Search completed.' : 'Arama tamamlandı.', 'success');
    } else {
      resultsList.innerHTML = `<div style="text-align:center; padding:15px; color:var(--text-muted);">${isEn ? 'No channels found.' : 'Kanal bulunamadı.'}</div>`;
      resultsContainer.style.display = 'block';
      showToast(isEn ? 'No results found.' : 'Sonuç bulunamadı.', 'warning');
    }
  } catch (err) {
    showToast(isEn ? 'Search error.' : 'Arama sırasında hata oluştu.', 'error');
  } finally {
    if (searchBtn) searchBtn.disabled = false;
  }
};

// Türkçe Açıklama: YouTube arama sonuçları panelini kapatarak görünürlüğünü gizler.
/**
 * Arama sonuçları panelini kapatır.
 */
window.closeChannelSearchResults = function() {
  const resultsContainer = document.getElementById('channel-search-results');
  if (resultsContainer) {
    resultsContainer.style.display = 'none';
  }
};

// Türkçe Açıklama: Arama sonuçlarındaki kanalı backend'e isim, handle, avatar ve ID ile hızlıca takip listesine eklemek üzere gönderir.
/**
 * Arama sonuçlarındaki bir kanalı takip listesine ekler.
 * 
 * @param {string} id Kanal ID'si
 * @param {string} name Kanal adı
 * @param {string} handle Kanal handle adı (@ ile başlayan)
 * @param {string} avatar Kanal profil resmi URL'si
 */
window.followChannelFromSearch = async function(id, name, handle, avatar) {
  const isEn = localDb.settings && localDb.settings.lang === 'en';
  try {
    showToast(isEn ? 'Following channel...' : 'Kanal takibe alınıyor...', 'info');
    const res = await fetch('/api/channels', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        input: id, 
        name: name,
        handle: handle,
        avatar: avatar,
        downloadShorts: false 
      })
    });
    const data = await res.json();
    if (data.success) {
      showToast(isEn ? `Following ${name}!` : `"${name}" başarıyla takibe alındı!`, 'success');
      closeChannelSearchResults();
    } else {
      showToast(data.error || 'Hata oluştu.', 'error');
    }
  } catch (err) {
    showToast(isEn ? 'Connection error.' : 'Bağlantı hatası.', 'error');
  }
};

// Türkçe Açıklama: Sağ üst köşedeki sistem durumu ikonuna tıklandığında disk/çerez durumu özet menüsünün açılıp kapanmasını sağlar.
/**
 * Sistem durumu açılır kutusunun (dropdown) görünürlüğünü değiştirir.
 * 
 * @param {Event} e Olay nesnesi
 */
window.toggleStatusDropdown = function(e) {
  if (e) e.stopPropagation();
  const dropdown = document.getElementById('status-dropdown');
  if (dropdown) {
    dropdown.classList.toggle('hidden');
  }
};

// Dışarı tıklanınca dropdown menüyü kapat
window.addEventListener('click', (e) => {
  const dropdown = document.getElementById('status-dropdown');
  const summary = document.querySelector('.status-summary');
  if (dropdown && !dropdown.classList.contains('hidden')) {
    if (!dropdown.contains(e.target) && !summary.contains(e.target)) {
      dropdown.classList.add('hidden');
    }
  }
});

/**
 * Pano içeriğini veya girilen YouTube linkini okuyarak doğrudan indirme kuyruğuna ekler.
 */
window.pasteAndDownload = async function() {
  let urlText = '';
  try {
    // Tarayıcı panosundaki metni okumayı dene
    urlText = await navigator.clipboard.readText();
    urlText = urlText.trim();
  } catch (err) {
    console.warn('Pano okuma izni alınamadı:', err);
  }

  const youtubeRegex = /(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/))([^?&"'>\s]{11})/;
  
  // Eğer panoda geçerli bir youtube linki yoksa kullanıcıya girdi kutusu göster
  if (!urlText || !youtubeRegex.test(urlText)) {
    urlText = prompt('Lütfen indirmek istediğiniz YouTube video linkini buraya yapıştırın:');
    if (!urlText) return;
    urlText = urlText.trim();
  }

  const match = urlText.match(youtubeRegex);
  if (match) {
    const videoId = match[1];
    showToast('Video çözümleniyor ve kuyruğa ekleniyor...', 'info');
    try {
      const res = await fetch('/api/download-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoId })
      });
      const data = await res.json();
      if (data.success) {
        showToast('Video kuyruğa başarıyla eklendi!', 'success');
        if (window.switchTab) window.switchTab('queue');
      } else {
        showToast(data.error || 'İndirme eklenemedi.', 'error');
      }
    } catch (err) {
      showToast('Sunucu ile iletişim hatası.', 'error');
    }
  } else {
    showToast('Geçersiz YouTube video linki girildi.', 'error');
  }
};

// Türkçe Açıklama: Kuyruk indirme sırasını duraklatır veya kaldığı yerden devam ettirir. Aktif indirme varsa süreci güvenle durdurup kuyruğun başına alır.
/**
 * Kuyruk duraklatma ve devam ettirme durumunu değiştirir.
 */
window.toggleQueuePause = async function() {
  const isPaused = localDb.settings && localDb.settings.isPaused;
  const endpoint = isPaused ? '/api/queue/resume' : '/api/queue/pause';
  const actionText = isPaused 
    ? (localDb.settings.lang === 'en' ? 'Resuming queue...' : 'Kuyruk devam ettiriliyor...')
    : (localDb.settings.lang === 'en' ? 'Pausing queue...' : 'Kuyruk duraklatılıyor...');
    
  showToast(actionText, 'info');
  
  try {
    const res = await fetch(endpoint, { method: 'POST' });
    const data = await res.json();
    if (data.success) {
      localDb.settings.isPaused = data.isPaused;
      updateUI(localDb);
    } else {
      showToast(data.error || 'İşlem başarısız.', 'error');
    }
  } catch (err) {
    showToast('Sunucu bağlantı hatası.', 'error');
  }
};

// Türkçe Açıklama: Alternatif hız sınırı (kaplumbağa) profilini açıp kapatır.
window.toggleAlternativeSpeed = async function() {
  const isEn = localDb.settings && localDb.settings.lang === 'en';
  showToast(isEn ? 'Toggling speed limit profile...' : 'Hız sınırı profili değiştiriliyor...', 'info');
  try {
    const res = await fetch('/api/settings/toggle-alt-speed', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    const data = await res.json();
    if (data.success) {
      showToast(isEn ? 'Speed profile changed successfully!' : 'Hız profili başarıyla değiştirildi!', 'success');
    } else {
      showToast(data.error || 'Hata oluştu.', 'error');
    }
  } catch (err) {
    showToast('Bağlantı hatası.', 'error');
  }
};

// Türkçe Açıklama: Kullanıcının girdiği hız limitini (KB/s) sunucuya göndererek kaydeder ve indirme sırasına anlık uygular.
/**
 * İndirme hız limitini günceller.
 */
window.updateQueueSpeedLimit = async function() {
  const input = document.getElementById('queue-speed-limit-input');
  if (!input) return;
  
  const limit = parseInt(input.value, 10);
  if (isNaN(limit) || limit < 0) {
    showToast('Lütfen geçerli bir hız sınırı değeri girin (0 veya daha büyük).', 'error');
    return;
  }
  
  const isEn = localDb.settings && localDb.settings.lang === 'en';
  showToast(isEn ? 'Updating speed limit...' : 'Hız sınırı güncelleniyor...', 'info');
  
  try {
    const updatedSettings = { ...localDb.settings };
    if (localDb.settings.useAlternativeSpeed) {
      updatedSettings.alternativeSpeedLimit = limit;
    } else {
      updatedSettings.downloadSpeedLimit = limit;
    }
    
    const res = await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updatedSettings)
    });
    const data = await res.json();
    if (data.success) {
      showToast(isEn ? 'Speed limit updated successfully!' : 'Hız sınırı başarıyla güncellendi!', 'success');
    } else {
      showToast(data.error || 'Hata oluştu.', 'error');
    }
  } catch (err) {
    showToast('Bağlantı hatası.', 'error');
  }
};

let dragSrcEl = null;

// Türkçe Açıklama: Liste elemanı sürüklenmeye başlandığında şeffaflığı azaltarak görsel bildirim verir ve sürükleme verilerini ayarlar.
/**
 * Sürükleme başladığında tetiklenen olay yöneticisi.
 * 
 * @param {DragEvent} e Sürükleme olayı nesnesi
 */
function handleDragStart(e) {
  this.style.opacity = '0.4';
  dragSrcEl = this;
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/html', this.innerHTML);
}

// Türkçe Açıklama: Sürüklenen eleman diğer elemanın üzerine geldiğinde tarayıcının varsayılan sürükleme davranışını engelleyerek taşımaya izin verir.
/**
 * Sürüklenen öğe başka bir öğenin üzerine geldiğinde tetiklenir.
 * 
 * @param {DragEvent} e Sürükleme olayı nesnesi
 */
function handleDragOver(e) {
  if (e.preventDefault) {
    e.preventDefault();
  }
  e.dataTransfer.dropEffect = 'move';
  return false;
}

// Türkçe Açıklama: Sürüklenen eleman hedef konum üzerine bırakıldığında DOM üzerindeki sırasını değiştirir ve güncel sıralamayı backend API'sine kaydeder.
/**
 * Sürüklenen öğe bırakıldığında tetiklenen olay yöneticisi.
 * Sıralamayı DOM üzerinde günceller ve sunucuya bildirir.
 * 
 * @param {DragEvent} e Sürükleme olayı nesnesi
 */
function handleDrop(e) {
  if (e.stopPropagation) {
    e.stopPropagation();
  }
  
  if (dragSrcEl !== this) {
    const list = document.getElementById('queue-list');
    const children = Array.from(list.children);
    const fromIndex = children.indexOf(dragSrcEl);
    const toIndex = children.indexOf(this);
    
    if (fromIndex < toIndex) {
      this.after(dragSrcEl);
    } else {
      this.before(dragSrcEl);
    }
    
    const newOrderIds = Array.from(list.querySelectorAll('.queue-item')).map(el => el.getAttribute('data-id'));
    
    fetch('/api/queue/reorder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: newOrderIds })
    }).catch(err => console.error('Error reordering queue:', err));
  }
  
  return false;
}

// Türkçe Açıklama: Sürükleme işlemi bittiğinde elemanların şeffaflıklarını sıfırlayarak görünümü normale döndürür.
/**
 * Sürükleme işlemi bittiğinde tetiklenen olay yöneticisi.
 * 
 * @param {DragEvent} e Sürükleme olayı nesnesi
 */
function handleDragEnd(e) {
  this.style.opacity = '1';
  document.querySelectorAll('.queue-item').forEach(item => {
    item.style.opacity = '1';
  });
}

// Türkçe Açıklama: Takip edilen kanallar yedek listesini dışarı aktarmak için browser download tetikler.
function exportChannels() {
  window.location.href = '/api/channels/export';
}

// Türkçe Açıklama: Dosya seçici input penceresini tetikler.
function triggerImportFile() {
  const fileInput = document.getElementById('import-file-input');
  if (fileInput) {
    fileInput.click();
  }
}

// Türkçe Açıklama: Seçilen yedek JSON dosyasını okuyup backend'e aktararak kanalları içe aktarır.
async function importChannels(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async function(e) {
    try {
      const backupData = JSON.parse(e.target.result);
      if (!backupData || !Array.isArray(backupData.channels)) {
        showToast(localDb.settings.lang === 'en' ? 'Invalid backup file structure.' : 'Geçersiz yedek dosyası yapısı.', 'error');
        return;
      }

      const importMode = document.getElementById('import-mode').value;
      const overwrite = importMode === 'overwrite';

      const res = await fetch('/api/channels/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          overwrite: overwrite,
          channels: backupData.channels
        })
      });

      const data = await res.json();
      if (data.success) {
        const msg = localDb.settings.lang === 'en'
          ? `Backup imported successfully! Added: ${data.added}, Updated: ${data.updated}`
          : `Yedek başarıyla içeri aktarıldı! Eklenen: ${data.added}, Güncellenen: ${data.updated}`;
        showToast(msg, 'success');
      } else {
        showToast(data.error || (localDb.settings.lang === 'en' ? 'Import failed.' : 'İçeri aktarma başarısız.'), 'error');
      }
    } catch (err) {
      console.error('Yedek okuma hatası:', err);
      showToast(localDb.settings.lang === 'en' ? 'Failed to read backup file.' : 'Yedek dosyası okunamadı.', 'error');
    } finally {
      event.target.value = '';
    }
  };
  reader.readAsText(file);
}

// Custom Select Dropdown with Flags (Windows Compatibility)
function initCustomSelect() {
  const trigger = document.getElementById('lang-select-trigger');
  const optionsContainer = document.getElementById('lang-custom-options');
  const hiddenInput = document.getElementById('settings-lang');
  const selectedFlag = document.getElementById('selected-lang-flag');
  const selectedText = document.getElementById('selected-lang-text');

  if (!trigger || !optionsContainer || !hiddenInput) return;

  // Dil seçeneklerini visual olarak alfabetik sıraya göre sırala
  const options = Array.from(optionsContainer.querySelectorAll('.custom-option'));
  options.sort((a, b) => {
    const textA = a.querySelector('span').innerText.trim();
    const textB = b.querySelector('span').innerText.trim();
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
      selectedFlag.src = opt.querySelector('img').src;
      selectedText.innerText = opt.querySelector('span').innerText;

      // Update active option class
      options.forEach(o => o.classList.remove('selected'));
      opt.classList.add('selected');

      // Close options
      optionsContainer.classList.remove('open');

      // Trigger auto save
      performAutoSave();
    });
  });
}

function setCustomSelectValue(val) {
  const hiddenInput = document.getElementById('settings-lang');
  const selectedFlag = document.getElementById('selected-lang-flag');
  const selectedText = document.getElementById('selected-lang-text');
  const optionsContainer = document.getElementById('lang-custom-options');
  if (!hiddenInput || !selectedFlag || !selectedText || !optionsContainer) return;

  hiddenInput.value = val;

  const opt = optionsContainer.querySelector(`.custom-option[data-value="${val}"]`);
  if (opt) {
    selectedFlag.src = opt.querySelector('img').src;
    selectedText.innerText = opt.querySelector('span').innerText;
    
    const options = optionsContainer.querySelectorAll('.custom-option');
    options.forEach(o => o.classList.remove('selected'));
    opt.classList.add('selected');
  }
}

// Global scope'a bağla
window.exportChannels = exportChannels;
window.triggerImportFile = triggerImportFile;
window.importChannels = importChannels;

// FFmpeg Installer Logic
async function checkFfmpegStatus() {
  const isEn = localDb.settings && localDb.settings.lang === 'en';
  try {
    const res = await fetch('/api/ffmpeg/status');
    const data = await res.json();
    
    const banner = document.getElementById('ffmpeg-info-banner');
    const statusIndicator = document.getElementById('settings-ffmpeg-status');
    const settingsBtn = document.getElementById('settings-ffmpeg-btn');
    
    if (data.installed) {
      if (banner) banner.classList.add('hidden');
      if (statusIndicator) {
        statusIndicator.innerText = isEn ? 'Installed' : 'Kurulu';
        statusIndicator.className = 'ffmpeg-status-indicator installed';
      }
      if (settingsBtn) {
        settingsBtn.innerText = isEn ? 'Reinstall' : 'Yeniden Kur';
      }
    } else {
      if (banner && localStorage.getItem('ffmpeg_banner_dismissed') !== 'true') {
        banner.classList.remove('hidden');
      }
      if (statusIndicator) {
        statusIndicator.innerText = isEn ? 'Not Installed' : 'Kurulu Değil';
        statusIndicator.className = 'ffmpeg-status-indicator not-installed';
      }
      if (settingsBtn) {
        settingsBtn.innerText = isEn ? 'Install' : 'Kur';
      }
      
      // If currently downloading/extracting on reload, show modal
      if (data.status === 'downloading' || data.status === 'extracting') {
        openFfmpegModal();
        updateFfmpegInstallUI(data);
      }
    }
  } catch (err) {
    console.error('Error checking FFmpeg status:', err);
  }
}

function openFfmpegModal() {
  const modal = document.getElementById('ffmpeg-installer-modal');
  if (modal) {
    modal.classList.remove('hidden');
    // Hide close actions until finished or failed
    const closeActionBtn = document.getElementById('ffmpeg-modal-close-action-btn');
    if (closeActionBtn) closeActionBtn.classList.add('hidden');
  }
}

function closeFfmpegModal() {
  const modal = document.getElementById('ffmpeg-installer-modal');
  if (modal) modal.classList.add('hidden');
}

function updateFfmpegInstallUI(data) {
  const isEn = localDb.settings && localDb.settings.lang === 'en';
  const progressBar = document.getElementById('ffmpeg-progress-bar');
  const statusText = document.getElementById('ffmpeg-status-text');
  const closeActionBtn = document.getElementById('ffmpeg-modal-close-action-btn');
  
  if (progressBar) {
    progressBar.style.width = `${data.progress}%`;
    progressBar.style.background = ''; // reset color
  }
  
  if (statusText) {
    if (data.status === 'downloading') {
      statusText.innerText = isEn ? `Downloading: %${data.progress}` : `İndiriliyor: %${data.progress}`;
      statusText.style.color = 'var(--primary)';
    } else if (data.status === 'extracting') {
      statusText.innerText = isEn ? 'Extracting archive...' : 'Arşivden Çıkarılıyor...';
      statusText.style.color = 'var(--secondary)';
    } else if (data.status === 'completed') {
      statusText.innerText = isEn ? 'Installation Completed Successfully!' : 'Kurulum Başarıyla Tamamlandı!';
      statusText.style.color = 'var(--success-color)';
      if (closeActionBtn) closeActionBtn.classList.remove('hidden');
      checkFfmpegStatus();
    } else if (data.status === 'failed') {
      statusText.innerText = isEn ? `Installation Failed: ${data.error}` : `Kurulum Başarısız: ${data.error}`;
      statusText.style.color = 'var(--danger-color)';
      if (progressBar) progressBar.style.background = 'var(--danger-color)';
      if (closeActionBtn) closeActionBtn.classList.remove('hidden');
    }
  }
}

async function startFfmpegDownload() {
  const isEn = localDb.settings && localDb.settings.lang === 'en';
  openFfmpegModal();
  
  const progressBar = document.getElementById('ffmpeg-progress-bar');
  const statusText = document.getElementById('ffmpeg-status-text');
  if (progressBar) progressBar.style.width = '0%';
  if (statusText) statusText.innerText = isEn ? 'Starting installation...' : 'Kurulum başlatılıyor...';
  
  try {
    const res = await fetch('/api/ffmpeg/download', { method: 'POST' });
    const data = await res.json();
    if (data.success) {
      if (data.state) {
        updateFfmpegInstallUI(data.state);
      }
    } else {
      if (statusText) {
        statusText.innerText = data.message || (isEn ? 'Failed to start download' : 'İndirme başlatılamadı');
        statusText.style.color = 'var(--danger-color)';
      }
    }
  } catch (err) {
    console.error('Error starting FFmpeg download:', err);
    if (statusText) {
      statusText.innerText = isEn ? 'Connection error' : 'Bağlantı hatası';
      statusText.style.color = 'var(--danger-color)';
    }
  }
}

// Event Listeners for FFmpeg UI
const bannerInstallBtn = document.getElementById('ffmpeg-banner-install-btn');
const bannerCloseBtn = document.getElementById('ffmpeg-banner-close-btn');
const settingsFfmpegBtn = document.getElementById('settings-ffmpeg-btn');
const closeFfmpegModalBtn = document.getElementById('close-ffmpeg-modal-btn');
const ffmpegModalCloseActionBtn = document.getElementById('ffmpeg-modal-close-action-btn');
const banner = document.getElementById('ffmpeg-info-banner');

if (bannerInstallBtn) {
  bannerInstallBtn.addEventListener('click', startFfmpegDownload);
}

if (bannerCloseBtn) {
  bannerCloseBtn.addEventListener('click', () => {
    if (banner) banner.classList.add('hidden');
    localStorage.setItem('ffmpeg_banner_dismissed', 'true');
  });
}

if (settingsFfmpegBtn) {
  settingsFfmpegBtn.addEventListener('click', startFfmpegDownload);
}

if (closeFfmpegModalBtn) {
  closeFfmpegModalBtn.addEventListener('click', closeFfmpegModal);
}

if (ffmpegModalCloseActionBtn) {
  ffmpegModalCloseActionBtn.addEventListener('click', closeFfmpegModal);
}

// Başlangıç
connectSSE();
initCustomSelect();
checkFfmpegStatus();
updateDiskSpace();
checkApplicationUpdates();
setInterval(updateDiskSpace, 60 * 60 * 1000); // Her 60 dakikada bir güncelle

// Türkçe Açıklama: Sayfa yüklendiğinde mevcut URL path'ine göre doğru sekmeyi aktif ediyoruz.
const currentPath = window.location.pathname;
const initialTab = pathTabMap[currentPath] || 'history';
history.replaceState({ tab: initialTab }, '', currentPath === '/' ? '/home' : currentPath);
switchTab(initialTab, false);

// Oynatıcıyı sürüklenebilir ve yeniden boyutlandırılabilir yap
const modalContent = document.querySelector('#player-modal .player-modal-content');
const modalHeader = document.querySelector('#player-modal .modal-header');
if (modalContent && modalHeader) {
  makeElementDraggable(modalContent, modalHeader);
  makeElementResizable(modalContent);
}

// Türkçe Açıklama: Yorumlar panelini açar/kapatır ve kapatıldığında veya açıldığında yorumları sunucudan çeker.
window.toggleCommentsPanel = async function() {
  const container = document.getElementById('inline-player-comments-container');
  if (!container) return;
  
  const isHidden = container.classList.contains('hidden');
  const btn = document.getElementById('inline-btn-comments');
  const isEn = localDb.settings?.lang === 'en';
  
  if (isHidden) {
    container.classList.remove('hidden');
    if (btn) {
      btn.classList.add('active');
      btn.title = isEn ? 'Hide Comments' : 'Yorumları Gizle';
    }
    await loadComments(currentPlayingVideoId);
  } else {
    container.classList.add('hidden');
    if (btn) {
      btn.classList.remove('active');
      btn.title = isEn ? 'Show Comments' : 'Yorumları Göster';
    }
  }
};

/**
 * Türkçe Açıklama: "1:23:45" veya "02:15" formatındaki süre metnini saniyeye dönüştürür.
 * 
 * @param {string} timeStr - Dönüştürülecek süre metni (örn: "01:23")
 * @returns {number} Saniye cinsinden karşılığı
 */
function parseTimeToSeconds(timeStr) {
  const parts = timeStr.split(':').map(Number);
  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  } else if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  }
  return 0;
}

/**
 * Türkçe Açıklama: Aktif video oynatıcının süresini belirtilen saniyeye atlatır (Plyr, Artplayer, HTML5 uyumlu).
 * 
 * @param {number} seconds - Atlanacak saniye değeri
 * @returns {void}
 */
window.seekVideoToSeconds = function(seconds) {
  const pType = (localDb.settings && localDb.settings.playerType) || 'plyr';
  const player = document.getElementById('embedded-video-player');
  
  if (pType === 'artplayer' && videoPlayerInstance) {
    videoPlayerInstance.currentTime = seconds;
  } else if (pType === 'html5' && player) {
    player.currentTime = seconds;
  } else if (videoPlayerInstance) {
    videoPlayerInstance.currentTime = seconds;
  } else if (player) {
    player.currentTime = seconds;
  }
};

/**
 * Türkçe Açıklama: Açıklama metnindeki zaman damgalarını (01:23 vb.) bulup tıklanabilir bağlantılara dönüştürür.
 * 
 * @param {string} text - Düzenlenecek açıklama metni
 * @returns {string} Zaman damgaları linke dönüştürülmüş HTML metni
 */
function formatDescriptionTimestamps(text) {
  const regex = /\b(?:(\d{1,2}):)?([0-5]?\d):([0-5]\d)\b/g;
  
  let html = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  return html.replace(regex, (match) => {
    const seconds = parseTimeToSeconds(match);
    return `<a href="#" class="timestamp-link" onclick="event.preventDefault(); seekVideoToSeconds(${seconds});" style="color: var(--accent-primary); font-weight: 600; text-decoration: underline; cursor: pointer;">${match}</a>`;
  });
}

/**
 * Türkçe Açıklama: Video açıklama panelini açar/kapatır ve yorum panelini gizler.
 * 
 * @returns {void}
 */
window.toggleDescriptionPanel = function() {
  const container = document.getElementById('inline-player-description-container');
  if (!container) return;

  const isHidden = container.classList.contains('hidden');
  const btn = document.getElementById('inline-btn-description');
  const isEn = localDb.settings?.lang === 'en';
  
  if (isHidden) {
    container.classList.remove('hidden');
    if (btn) {
      btn.classList.add('active');
      btn.title = isEn ? 'Hide Description' : 'Açıklamayı Gizle';
    }
  } else {
    container.classList.add('hidden');
    if (btn) {
      btn.classList.remove('active');
      btn.title = isEn ? 'Show Description' : 'Açıklamayı Göster';
    }
  }
};

let nextCommentsToken = null;
let loadedCommentsList = [];

// Helper to parse like counts (e.g. "1.2K", "250K", "15", "0")
function parseLikes(likeStr) {
  if (!likeStr) return 0;
  const clean = String(likeStr).trim().toUpperCase();
  if (clean === '0' || clean === '') return 0;
  
  let multiplier = 1;
  let numStr = clean;
  
  if (clean.endsWith('K')) {
    multiplier = 1000;
    numStr = clean.slice(0, -1);
  } else if (clean.endsWith('M')) {
    multiplier = 1000000;
    numStr = clean.slice(0, -1);
  } else if (clean.endsWith('B')) {
    multiplier = 1000000000;
    numStr = clean.slice(0, -1);
  }
  
  const val = parseFloat(numStr);
  return isNaN(val) ? 0 : val * multiplier;
}

// Helper to parse relative times (e.g. "2 hours ago", "En Yeni") to seconds
function parseRelativeTime(timeStr) {
  if (!timeStr) return Infinity;
  const s = String(timeStr).toLowerCase().trim();
  
  if (s.includes('now') || s.includes('şimdi') || s.includes('just')) return 0;
  
  const numMatch = s.match(/\d+/);
  const val = numMatch ? parseInt(numMatch[0], 10) : 1;
  
  let multiplier = 1;
  if (s.includes('second') || s.includes('saniye') || s.includes('sn')) {
    multiplier = 1;
  } else if (s.includes('minute') || s.includes('dakika') || s.includes('dk')) {
    multiplier = 60;
  } else if (s.includes('hour') || s.includes('saat')) {
    multiplier = 3600;
  } else if (s.includes('day') || s.includes('gün')) {
    multiplier = 86400;
  } else if (s.includes('week') || s.includes('hafta')) {
    multiplier = 604800;
  } else if (s.includes('month') || s.includes('ay')) {
    multiplier = 2592000;
  } else if (s.includes('year') || s.includes('yıl')) {
    multiplier = 31536000;
  }
  return val * multiplier;
}

// IPTV Sayfalama durumu
let iptvCurrentPage = 1;
let iptvTotalPages = 1;
let iptvTotalCount = 0;
let iptvIsAppending = false;

async function loadIptvChannels(append = false) {

  if (!append) {
    iptvIsLoading = true;
    iptvCurrentPage = 1;
    const listContainer = document.getElementById('iptv-channel-list');
    if (listContainer) listContainer.innerHTML = '';
  } else {
    iptvIsAppending = true;
  }

  const loadingIndicator = document.getElementById('iptv-list-loading');
  if (loadingIndicator) loadingIndicator.classList.remove('hidden');

  try {
    const hasFilter = (iptvSelectedCountry || iptvSearchQuery || iptvSelectedCategory);
    // Filtre varsa tum listeyi (limit=0), yoksa sayfalı (200)
    const limitParam = hasFilter ? 0 : 200;
    const url = `/api/iptv/channels?limit=${limitParam}&page=${iptvCurrentPage}&search=${encodeURIComponent(iptvSearchQuery)}&country=${encodeURIComponent(iptvSelectedCountry)}&category=${encodeURIComponent(iptvSelectedCategory)}`;
    const res = await fetch(url);
    const data = await res.json();

    if (loadingIndicator) loadingIndicator.classList.add('hidden');

    iptvTotalPages = data.pagination?.totalPages || 1;
    iptvTotalCount = data.pagination?.totalCount || 0;

    renderIptvChannels(data.channels, append);
    populateIptvFilters(data.filters);
    updateLoadMoreBtn();
  } catch (err) {
    console.error('Error loading IPTV channels:', err);
    showToast(currentLang === 'en' ? 'Failed to load IPTV channels.' : 'IPTV kanalları yüklenemedi.', 'error');
    if (loadingIndicator) loadingIndicator.classList.add('hidden');
  } finally {
    iptvIsLoading = false;
    iptvIsAppending = false;
  }
}

function updateLoadMoreBtn() {
  const btn = document.getElementById('iptv-load-more-btn');
  if (!btn) return;
  const hasFilter = (iptvSelectedCountry || iptvSearchQuery || iptvSelectedCategory);
  if (hasFilter || iptvCurrentPage >= iptvTotalPages) {
    btn.classList.add('hidden');
  } else {
    btn.classList.remove('hidden');
    const isEn = currentLang === 'en';
    const shown = Math.min(iptvCurrentPage * 200, iptvTotalCount);
    btn.textContent = `${isEn ? 'Load More' : 'Daha Fazla'} (${shown} / ${iptvTotalCount})`;
  }
}

// Render comments list with sorting
function renderCommentsList() {
  const list = document.getElementById('comments-list');
  if (!list) return;
  list.innerHTML = '';
  
  const sortVal = document.getElementById('comments-sort')?.value || 'default';
  let sorted = [...loadedCommentsList];
  
  if (sortVal === 'likes-desc') {
    sorted.sort((a, b) => parseLikes(b.likeCount) - parseLikes(a.likeCount));
  } else if (sortVal === 'date-new') {
    sorted.sort((a, b) => parseRelativeTime(a.publishedTime) - parseRelativeTime(b.publishedTime));
  } else if (sortVal === 'date-old') {
    sorted.sort((a, b) => parseRelativeTime(b.publishedTime) - parseRelativeTime(a.publishedTime));
  }
  
  sorted.forEach(c => {
    const item = document.createElement('div');
    item.className = 'comment-item';
    
    const avatarUrl = c.authorAvatar || 'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2240%22 height=%2240%22><circle cx=%2220%22 cy=%2220%22 r=%2220%22 fill=%22%2316142a%22/></svg>';
    
    item.innerHTML = `
      <img class="comment-avatar" src="${avatarUrl}" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2240%22 height=%2240%22><circle cx=%2220%22 cy=%2220%22 r=%2220%22 fill=%22%2316142a%22/></svg>';" />
      <div class="comment-content">
        <div class="comment-meta">
          <span class="comment-author">${escapeHtml(c.author)}</span>
          <span class="comment-time">${escapeHtml(c.publishedTime)}</span>
        </div>
        <div class="comment-text">${escapeHtml(c.text)}</div>
        <div class="comment-likes-row">
          <i data-lucide="thumbs-up"></i>
          <span>${escapeHtml(c.likeCount)}</span>
        </div>
      </div>
    `;
    list.appendChild(item);
  });
  lucide.createIcons();
}

window.sortAndRenderComments = function() {
  renderCommentsList();
};

async function loadComments(videoId) {
  const list = document.getElementById('comments-list');
  const loading = document.getElementById('comments-loading');
  const empty = document.getElementById('comments-list-empty');
  const moreContainer = document.getElementById('comments-more-container');
  
  if (!list || !loading || !empty) return;
  
  list.innerHTML = '';
  loading.style.display = 'block';
  empty.style.display = 'none';
  if (moreContainer) moreContainer.style.display = 'none';
  nextCommentsToken = null;
  loadedCommentsList = [];
  
  // Translation
  const commentsSort = document.getElementById('comments-sort');
  if (commentsSort) {
    const isEn = localDb.settings?.lang === 'en';
    commentsSort.options[0].text = isEn ? 'Default' : 'Varsayılan';
    commentsSort.options[1].text = isEn ? 'Likes (High to Low)' : 'Beğeni (Çoktan Aza)';
    commentsSort.options[2].text = isEn ? 'Newest' : 'En Yeni';
    commentsSort.options[3].text = isEn ? 'Oldest' : 'En Eski';
  }

  try {
    const res = await fetch(`/api/video/${videoId}/comments`);
    const data = await res.json();
    loading.style.display = 'none';
    
    if (data.success && data.comments && data.comments.length > 0) {
      loadedCommentsList = data.comments;
      renderCommentsList();
      if (data.nextPageToken) {
        nextCommentsToken = data.nextPageToken;
        if (moreContainer) moreContainer.style.display = 'block';
      }
    } else {
      empty.style.display = 'block';
    }
  } catch (err) {
    loading.style.display = 'none';
    empty.style.display = 'block';
    console.error("Error loading comments:", err);
  }
}

window.loadMoreComments = async function() {
  if (!currentPlayingVideoId || !nextCommentsToken) return;
  
  const moreBtn = document.getElementById('btn-load-more-comments');
  const moreText = document.getElementById('btn-load-more-comments-text');
  const isEn = localDb.settings?.lang === 'en';
  
  if (moreBtn) moreBtn.disabled = true;
  if (moreText) {
    moreText.textContent = isEn ? 'Loading...' : 'Yükleniyor...';
  }
  
  try {
    const res = await fetch(`/api/video/${currentPlayingVideoId}/comments?token=${encodeURIComponent(nextCommentsToken)}`);
    const data = await res.json();
    
    if (data.success && data.comments && data.comments.length > 0) {
      loadedCommentsList = loadedCommentsList.concat(data.comments);
      renderCommentsList();
      if (data.nextPageToken) {
        nextCommentsToken = data.nextPageToken;
        if (moreBtn) moreBtn.disabled = false;
        if (moreText) {
          moreText.textContent = isEn ? 'Show More' : 'Daha Fazla Göster';
        }
      } else {
        nextCommentsToken = null;
        const moreContainer = document.getElementById('comments-more-container');
        if (moreContainer) moreContainer.style.display = 'none';
      }
    } else {
      nextCommentsToken = null;
      const moreContainer = document.getElementById('comments-more-container');
      if (moreContainer) moreContainer.style.display = 'none';
    }
  } catch (err) {
    console.error("Error loading more comments:", err);
    if (moreBtn) moreBtn.disabled = false;
    if (moreText) {
      moreText.textContent = isEn ? 'Show More' : 'Daha Fazla Göster';
    }
  }
};

lucide.createIcons();

// ==========================================
// IPTV Oynatıcı ve Çoklu Ekran Yönetimi
// ==========================================

// Slot tıklama ve aktif slot değiştirme
document.querySelectorAll('.iptv-slot').forEach(slot => {
  slot.addEventListener('click', (e) => {
    if (e.target.closest('.slot-controls')) return;
    const slotIndex = parseInt(slot.getAttribute('data-slot'), 10);
    selectIptvSlot(slotIndex);
  });
});

function selectIptvSlot(slotIndex) {
  activeIptvSlot = slotIndex;
  
  document.querySelectorAll('.iptv-slot').forEach(slot => {
    const idx = parseInt(slot.getAttribute('data-slot'), 10);
    if (idx === slotIndex) {
      slot.classList.add('active');
    } else {
      slot.classList.remove('active');
    }
  });

  const activeSlotLabel = document.getElementById('active-slot-label');
  if (activeSlotLabel) {
    const isEn = localDb.settings?.lang === 'en';
    activeSlotLabel.textContent = isEn ? `Active Slot: Slot ${slotIndex + 1}` : `Aktif Slot: Slot ${slotIndex + 1}`;
  }
}

// Mute, Swap ve Clear butonlarını bağla
document.querySelectorAll('.iptv-slot').forEach(slot => {
  const slotIndex = parseInt(slot.getAttribute('data-slot'), 10);
  const muteBtn = slot.querySelector('.mute-btn');
  const swapBtn = slot.querySelector('.swap-slot-btn');
  const clearBtn = slot.querySelector('.clear-btn');

  if (muteBtn) {
    muteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleIptvMute(slotIndex);
    });
  }

  if (swapBtn) {
    swapBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      swapIptvSportModePlayers();
    });
  }

  if (clearBtn) {
    clearBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      clearIptvSlot(slotIndex);
    });
  }
});

function toggleIptvMute(slotIndex) {
  const current = iptvPlayers[slotIndex];
  if (!current) return;

  const slotEl = document.querySelector(`.iptv-slot[data-slot="${slotIndex}"]`);
  const muteBtn = slotEl?.querySelector('.mute-btn');
  
  let isMuted = false;
  if (current.type === 'artplayer' && current.player) {
    isMuted = current.player.muted;
    current.player.muted = !isMuted;
    isMuted = !isMuted;
  } else if (current.type === 'plyr' && current.player) {
    isMuted = current.player.muted;
    current.player.muted = !isMuted;
    isMuted = !isMuted;
  } else if (current.videoElement) {
    isMuted = current.videoElement.muted;
    current.videoElement.muted = !isMuted;
    isMuted = !isMuted;
  }

  if (muteBtn) {
    muteBtn.innerHTML = isMuted ? '<i data-lucide="volume-x"></i>' : '<i data-lucide="volume-2"></i>';
    lucide.createIcons();
  }
}

function clearIptvSlot(slotIndex) {
  const slotEl = document.querySelector(`.iptv-slot[data-slot="${slotIndex}"]`);
  if (!slotEl) return;

  const current = iptvPlayers[slotIndex];
  if (current) {
    try {
      if (current.type === 'artplayer' && current.player) {
        current.player.destroy();
      } else if (current.type === 'plyr' && current.player) {
        current.player.destroy();
      }
      
      if (current.hls) {
        current.hls.destroy();
      }
      
      if (current.videoElement) {
        current.videoElement.pause();
        current.videoElement.src = '';
        current.videoElement.load();
      }
    } catch (e) {
      console.error(`Error cleaning up IPTV slot ${slotIndex}:`, e);
    }
    iptvPlayers[slotIndex] = null;
  }

  const playerContainer = slotEl.querySelector('.slot-player-instance');
  if (playerContainer) playerContainer.innerHTML = '';
  
  slotEl.classList.remove('has-video');
  
  const titleEl = slotEl.querySelector('.slot-title');
  if (titleEl) {
    titleEl.textContent = `Slot ${slotIndex + 1}: Boş`;
  }

  const muteBtn = slotEl.querySelector('.mute-btn');
  if (muteBtn) {
    muteBtn.innerHTML = '<i data-lucide="volume-x"></i>';
    lucide.createIcons();
  }

  updateIptvPlayingStatus();
  if (!isRestoringIptv && typeof saveIptvState === 'function') saveIptvState();
}

function stopAllIptvPlayers() {
  if (typeof saveIptvState === 'function') saveIptvState();
  const prevRestoring = isRestoringIptv;
  isRestoringIptv = true;
  try {
    for (let i = 0; i < 4; i++) {
      clearIptvSlot(i);
    }
  } finally {
    isRestoringIptv = prevRestoring;
  }
}
window.stopAllIptvPlayers = stopAllIptvPlayers;

// IPTV sekmesinden cikinca kanal listesini DOM'dan temizle (RAM tasarrufu)
window.clearIptvChannelList = function() {
  const listContainer = document.getElementById('iptv-channel-list');
  if (listContainer) listContainer.innerHTML = '';
  // Loading indicator'u gizle
  const loadingEl = document.getElementById('iptv-list-loading');
  if (loadingEl) loadingEl.classList.add('hidden');
  // Filtreleri sifirla ki tekrar girildiginde dolu gelsin
  iptvSearchQuery = '';
  iptvSelectedCountry = '';
  iptvSelectedCategory = '';
  // Search input ve select'leri temizle
  const searchEl = document.getElementById('iptv-search-input');
  if (searchEl) searchEl.value = '';
  const cEl = document.getElementById('iptv-country-filter');
  if (cEl) cEl.value = '';
  const catEl = document.getElementById('iptv-category-filter');
  if (catEl) catEl.value = '';
};

// Tekli / İkili / Çoklu ekran mod butonları & Spor Modu (PiP)
const singleBtn = document.getElementById('iptv-single-view-btn');
const dualBtn = document.getElementById('iptv-dual-view-btn');
const quadBtn = document.getElementById('iptv-quad-view-btn');
const sportBtn = document.getElementById('iptv-sport-view-btn');
const gridEl = document.getElementById('iptv-players-grid');

if (singleBtn && dualBtn && quadBtn && sportBtn && gridEl) {
  singleBtn.addEventListener('click', () => {
    if (typeof resetIptvSlotStyles === 'function') resetIptvSlotStyles();
    gridEl.classList.remove('swapped-mode');
    singleBtn.classList.add('active');
    if (dualBtn) dualBtn.classList.remove('active');
    quadBtn.classList.remove('active');
    sportBtn.classList.remove('active');
    gridEl.classList.remove('dual-mode', 'quad-mode', 'sport-mode');
    gridEl.classList.add('single-mode');
    if (typeof updateIptvSwapBtnVisibility === 'function') updateIptvSwapBtnVisibility();
    resizeAllArtplayers();
    if (!isRestoringIptv && typeof saveIptvState === 'function') saveIptvState();
  });

  dualBtn.addEventListener('click', () => {
    if (typeof resetIptvSlotStyles === 'function') resetIptvSlotStyles();
    gridEl.classList.remove('swapped-mode');
    dualBtn.classList.add('active');
    singleBtn.classList.remove('active');
    quadBtn.classList.remove('active');
    sportBtn.classList.remove('active');
    gridEl.classList.remove('single-mode', 'quad-mode', 'sport-mode');
    gridEl.classList.add('dual-mode');
    if (activeIptvSlot > 1) {
      selectIptvSlot(0);
    }
    if (typeof updateIptvSwapBtnVisibility === 'function') updateIptvSwapBtnVisibility();
    resizeAllArtplayers();
    if (!isRestoringIptv && typeof saveIptvState === 'function') saveIptvState();
  });

  quadBtn.addEventListener('click', () => {
    if (typeof resetIptvSlotStyles === 'function') resetIptvSlotStyles();
    gridEl.classList.remove('swapped-mode');
    quadBtn.classList.add('active');
    singleBtn.classList.remove('active');
    if (dualBtn) dualBtn.classList.remove('active');
    sportBtn.classList.remove('active');
    gridEl.classList.remove('single-mode', 'dual-mode', 'sport-mode');
    gridEl.classList.add('quad-mode');
    if (typeof updateIptvSwapBtnVisibility === 'function') updateIptvSwapBtnVisibility();
    resizeAllArtplayers();
    if (!isRestoringIptv && typeof saveIptvState === 'function') saveIptvState();
  });

  sportBtn.addEventListener('click', () => {
    if (typeof resetIptvSlotStyles === 'function') resetIptvSlotStyles();
    gridEl.classList.remove('swapped-mode');
    sportBtn.classList.add('active');
    singleBtn.classList.remove('active');
    if (dualBtn) dualBtn.classList.remove('active');
    quadBtn.classList.remove('active');
    gridEl.classList.remove('single-mode', 'dual-mode', 'quad-mode');
    gridEl.classList.add('sport-mode');
    if (activeIptvSlot > 1) {
      selectIptvSlot(0);
    }
    if (typeof updateIptvSwapBtnVisibility === 'function') updateIptvSwapBtnVisibility();
    resizeAllArtplayers();
    if (!isRestoringIptv && typeof saveIptvState === 'function') saveIptvState();
  });
}

// Grid Fullscreen Toggle
const gridFullscreenBtn = document.getElementById('iptv-grid-fullscreen-btn');
if (gridFullscreenBtn && gridEl) {
  gridFullscreenBtn.addEventListener('click', () => {
    if (!document.fullscreenElement) {
      gridEl.requestFullscreen().catch((err) => {
        console.error('Error entering fullscreen for grid:', err);
      });
    } else {
      document.exitFullscreen().catch((err) => {
        console.error('Error exiting fullscreen:', err);
      });
    }
  });

  document.addEventListener('fullscreenchange', () => {
    const icon = gridFullscreenBtn.querySelector('i');
    if (icon) {
      if (document.fullscreenElement === gridEl) {
        icon.setAttribute('data-lucide', 'minimize');
      } else {
        icon.setAttribute('data-lucide', 'maximize');
        // Reset slot styles when exiting fullscreen so they don't overflow the standard layout container
        if (typeof resetIptvSlotStyles === 'function') resetIptvSlotStyles();
      }
      if (window.lucide) lucide.createIcons();
    }
    // Trigger window resize and player resize to adjust dimensions
    setTimeout(() => {
      window.dispatchEvent(new Event('resize'));
      if (typeof resizeAllArtplayers === 'function') {
        resizeAllArtplayers();
      }
    }, 150);
  });
}

/**
 * Türkçe Açıklama: Aktif tüm ArtPlayer oynatıcı örneklerinin boyutlarını yeniden hesaplar ve arayüze sığdırır.
 * 
 * @returns {void}
 */
function resizeAllArtplayers() {
  iptvPlayers.forEach(p => {
    if (p && p.type === 'artplayer' && p.player && typeof p.player.resize === 'function') {
      setTimeout(() => {
        p.player.resize();
      }, 100);
    }
  });
}

/**
 * Türkçe Açıklama: Mevcut IPTV slotlarının durumunu (aktif kanal URL'si ve adı) ve geçerli yerleşim modunu localStorage'a kaydeder.
 * 
 * @returns {void}
 */
function saveIptvState() {
  const slotsData = {};
  iptvPlayers.forEach((playerRef, idx) => {
    if (playerRef) {
      slotsData[idx] = {
        streamUrl: playerRef.streamUrl,
        displayName: playerRef.displayName
      };
    } else {
      slotsData[idx] = null;
    }
  });

  const gridEl = document.getElementById('iptv-players-grid');
  let layout = 'single-mode';
  if (gridEl) {
    if (gridEl.classList.contains('dual-mode')) layout = 'dual-mode';
    else if (gridEl.classList.contains('quad-mode')) layout = 'quad-mode';
    else if (gridEl.classList.contains('sport-mode')) layout = 'sport-mode';
  }

  const state = {
    layout: layout,
    slots: slotsData
  };

  localStorage.setItem('iptv_saved_state', JSON.stringify(state));
}

/**
 * Türkçe Açıklama: Tarayıcı hafızasında (localStorage) kayıtlı olan IPTV yerleşimini ve slotlarda çalan kanalları geri yükler.
 * 
 * @returns {void}
 */
function restoreIptvState() {
  const saved = localStorage.getItem('iptv_saved_state');
  if (!saved) return;

  try {
    if (typeof resetIptvSlotStyles === 'function') resetIptvSlotStyles();
    isRestoringIptv = true;
    const state = JSON.parse(saved);
    
    // 1. Restore layout mode
    const gridEl = document.getElementById('iptv-players-grid');
    const singleBtn = document.getElementById('iptv-single-view-btn');
    const dualBtn = document.getElementById('iptv-dual-view-btn');
    const quadBtn = document.getElementById('iptv-quad-view-btn');
    const sportBtn = document.getElementById('iptv-sport-view-btn');

    if (gridEl) {
      gridEl.classList.remove('single-mode', 'dual-mode', 'quad-mode', 'sport-mode', 'swapped-mode');
      gridEl.classList.add(state.layout || 'single-mode');

      // Update button active state
      if (singleBtn) singleBtn.classList.remove('active');
      if (dualBtn) dualBtn.classList.remove('active');
      if (quadBtn) quadBtn.classList.remove('active');
      if (sportBtn) sportBtn.classList.remove('active');

      if (state.layout === 'dual-mode' && dualBtn) dualBtn.classList.add('active');
      else if (state.layout === 'quad-mode' && quadBtn) quadBtn.classList.add('active');
      else if (state.layout === 'sport-mode' && sportBtn) sportBtn.classList.add('active');
      else if (singleBtn) singleBtn.classList.add('active');
    }

    // 2. Play channels in slots
    if (state.slots) {
      Object.keys(state.slots).forEach(slotIndexStr => {
        const slotIndex = parseInt(slotIndexStr, 10);
        const chan = state.slots[slotIndexStr];
        if (chan && chan.streamUrl && chan.displayName) {
          playIptvChannel(slotIndex, chan.streamUrl, chan.displayName);
        }
      });
    }

    // 3. Make sure active slot is valid for this layout mode
    if (state.layout === 'dual-mode' || state.layout === 'sport-mode') {
      if (activeIptvSlot > 1) {
        selectIptvSlot(0);
      }
    } else if (state.layout === 'single-mode') {
      if (activeIptvSlot !== 0) {
        let playingSlot = 0;
        if (state.slots) {
          for (let i = 0; i < 4; i++) {
            if (state.slots[i]) {
              playingSlot = i;
              break;
            }
          }
        }
        selectIptvSlot(playingSlot);
      }
    }

    isRestoringIptv = false;
    if (typeof updateIptvSwapBtnVisibility === 'function') updateIptvSwapBtnVisibility();
    saveIptvState();
    resizeAllArtplayers();
  } catch (e) {
    isRestoringIptv = false;
    console.error('Error restoring IPTV state:', e);
  }
}

// Kanal listesini cek ve render et (append=true ise listeye ekle, false ise temizle)
// Not: Yeni loadIptvChannels artik yukarda (6916) tanimli - burasi eski versiyonu kaldirmak icin temizlendi

/**
 * Türkçe Açıklama: IPTV kanal listesini alır ve arayüzde dinamik kartlar olarak render eder.
 * 
 * @param {Array<Object>} channels - Render edilecek IPTV kanal nesneleri dizisi
 * @param {boolean} [append=false] - Kanalların mevcut listede birikerek mi ekleneceği yoksa listenin temizlenip sıfırdan mı yazılacağı
 * @returns {void}
 */
function renderIptvChannels(channels, append = false) {
  const listContainer = document.getElementById('iptv-channel-list');
  if (!listContainer) return;

  if (!append) {
    listContainer.innerHTML = '';
  }

  if (channels.length === 0 && !append) {
    const isEn = currentLang === 'en';
    listContainer.innerHTML = `<div class="text-center text-muted" style="padding: 20px 0; font-size: 0.85rem;">${isEn ? 'No channels found.' : 'Kanal bulunamad\u0131.'}</div>`;
    return;
  }

  // DocumentFragment ile tek seferde DOM'a yaz (performans)
  const fragment = document.createDocumentFragment();

  channels.forEach(ch => {
    const div = document.createElement('div');
    div.className = 'iptv-channel-item';
    div.dataset.url = ch.url;

    const isPlaying = iptvPlayers.some(p => p && p.streamUrl === ch.url);
    if (isPlaying) div.classList.add('playing');

    const fallbackLogo = `<i data-lucide="monitor"></i>`;
    const logoHtml = ch.logo
      ? `<img src="${ch.logo}" alt="" loading="lazy" onerror="this.outerHTML='<i data-lucide=\\'monitor\\'></i>'; lucide.createIcons();">`
      : fallbackLogo;

    const badges = [];
    if (ch.category) badges.push(`<span class="iptv-channel-badge iptv-channel-category">${ch.category}</span>`);
    if (ch.country) badges.push(`<span class="iptv-channel-badge iptv-channel-country">${ch.country}</span>`);

    div.innerHTML = `
      <div class="iptv-channel-logo">${logoHtml}</div>
      <div class="iptv-channel-details">
        <div class="iptv-channel-name">${ch.displayName}</div>
        <div class="iptv-channel-sub">${badges.join('')}</div>
      </div>
    `;

    div.addEventListener('click', () => {
      playIptvChannel(activeIptvSlot, ch.url, ch.displayName);
    });

    fragment.appendChild(div);
  });

  listContainer.appendChild(fragment);
  lucide.createIcons();
}

/**
 * Türkçe Açıklama: IPTV kanal listesindeki oynatılan kanalların aktiflik (playing) sınıfını günceller.
 * 
 * @returns {void}
 */
function updateIptvPlayingStatus() {
  const listContainer = document.getElementById('iptv-channel-list');
  if (!listContainer) return;

  const items = listContainer.querySelectorAll('.iptv-channel-item');
  items.forEach(item => {
    const url = item.dataset.url;
    const isPlaying = iptvPlayers.some(p => p && p.streamUrl === url);
    if (isPlaying) {
      item.classList.add('playing');
    } else {
      item.classList.remove('playing');
    }
  });
}

/**
 * Türkçe Açıklama: IPTV kanal listesindeki ülke ve kategori filtre dropdown seçeneklerini doldurur.
 * Kategorileri maksimum 40 karakter ile sınırlandırır.
 * 
 * @param {Object} filters - Filtre seçeneklerini (countries, categories) içeren nesne
 * @returns {void}
 */
function populateIptvFilters(filters) {
  if (!filters) return;

  const countryFilter = document.getElementById('iptv-country-filter');
  const categoryFilter = document.getElementById('iptv-category-filter');
  const isEn = currentLang === 'en';

  // Mevcut seçili değerleri sakla
  const currentCountry = countryFilter ? countryFilter.value : '';
  const currentCategory = categoryFilter ? categoryFilter.value : '';

  if (countryFilter && filters.countries) {
    countryFilter.innerHTML = `<option value="">${isEn ? 'All Countries' : 'Tüm Ülkeler'}</option>`;
    filters.countries.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c;
      opt.textContent = c;
      countryFilter.appendChild(opt);
    });
    // Seçimi koru
    if (currentCountry) countryFilter.value = currentCountry;
  }

  if (categoryFilter && filters.categories) {
    categoryFilter.innerHTML = `<option value="">${isEn ? 'All Categories' : 'Tüm Kategoriler'}</option>`;
    filters.categories.forEach(cat => {
      const opt = document.createElement('option');
      opt.value = cat;
      const dispText = cat.length > 40 ? cat.substring(0, 40) + '...' : cat;
      opt.textContent = dispText;
      categoryFilter.appendChild(opt);
    });
    // Seçimi koru
    if (currentCategory) categoryFilter.value = currentCategory;
  }
}

// Filtre Dinleyicileri
const iptvSearchInput = document.getElementById('iptv-search-input');
const iptvCountryFilter = document.getElementById('iptv-country-filter');
const iptvCategoryFilter = document.getElementById('iptv-category-filter');

if (iptvSearchInput) {
  iptvSearchInput.addEventListener('input', debounce(() => {
    iptvSearchQuery = iptvSearchInput.value.trim();
    loadIptvChannels();
  }, 300));
}

if (iptvCountryFilter) {
  iptvCountryFilter.addEventListener('change', () => {
    iptvSelectedCountry = iptvCountryFilter.value;
    loadIptvChannels();
  });
}

if (iptvCategoryFilter) {
  iptvCategoryFilter.addEventListener('change', () => {
    iptvSelectedCategory = iptvCategoryFilter.value;
    loadIptvChannels();
  });
}

// TR Hizli Erisim Butonu
const iptvTrBtn = document.getElementById('iptv-tr-quick-btn');
if (iptvTrBtn) {
  iptvTrBtn.addEventListener('click', () => {
    iptvSelectedCountry = 'TR';
    if (iptvCountryFilter) iptvCountryFilter.value = 'TR';
    loadIptvChannels();
  });
}

// Daha Fazla Yukle butonu
const iptvLoadMoreBtn = document.getElementById('iptv-load-more-btn');
if (iptvLoadMoreBtn) {
  iptvLoadMoreBtn.addEventListener('click', () => {
    iptvCurrentPage++;
    loadIptvChannels(true);
  });
}

/**
 * Türkçe Açıklama: Bir fonksiyonun ardışık tetiklenmesini geciktirerek belirtilen süre sonunda bir kez çalışmasını sağlar.
 * 
 * @param {Function} func - Geciktirilecek fonksiyon
 * @param {number} delay - Milisaniye cinsinden gecikme süresi
 * @returns {Function} Debounced fonksiyon sarmalayıcısı
 */
function debounce(func, delay) {
  let timer;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => func.apply(this, args), delay);
  };
}

// IPTV Güncelleme ve Durum Denetimleri
/**
 * Türkçe Açıklama: Sunucudan güncel IPTV yükleme/güncelleme durumunu sorgular ve arayüzü günceller.
 * 
 * @returns {Promise<void>}
 */
async function checkIptvStatus() {
  try {
    const res = await fetch('/api/iptv/status');
    const data = await res.json();
    updateIptvStatusUI(data);
  } catch (err) {
    console.error('Error checking IPTV status:', err);
  }
}

/**
 * Türkçe Açıklama: IPTV güncelleme durumuna göre durum metnini ve güncelle butonunun yükleniyor durumunu yönetir.
 * 
 * @param {Object} status - Sunucudan gelen IPTV durumu nesnesi (status, lastUpdated, totalChannels vb.)
 * @returns {void}
 */
function updateIptvStatusUI(status) {
  const statusInfo = document.getElementById('iptv-status-info');
  const updateBtn = document.getElementById('iptv-update-btn');
  
  if (!statusInfo) return;

  const isEn = localDb.settings?.lang === 'en';

  if (status.status === 'updating') {
    statusInfo.textContent = isEn ? 'Updating channel list...' : 'Kanal listesi güncelleniyor...';
    if (updateBtn) {
      updateBtn.disabled = true;
      const icon = updateBtn.querySelector('i');
      if (icon) icon.classList.add('spin-animation');
    }
    startIptvStatusPolling();
  } else {
    if (updateBtn) {
      updateBtn.disabled = false;
      const icon = updateBtn.querySelector('i');
      if (icon) icon.classList.remove('spin-animation');
    }

    if (status.lastUpdated) {
      const date = new Date(status.lastUpdated);
      const formattedDate = date.toLocaleString();
      statusInfo.textContent = isEn 
        ? `Last Updated: ${formattedDate} (${status.totalChannels} channels)`
        : `Son Güncelleme: ${formattedDate} (${status.totalChannels} Kanal)`;
    } else {
      statusInfo.textContent = isEn ? 'Not updated yet.' : 'Henüz güncellenmedi.';
    }
  }
}

/**
 * Türkçe Açıklama: IPTV listesinin arka planda güncellenme sürecini takip etmek amacıyla periyodik durum sorgulama (polling) başlatır.
 * 
 * @returns {void}
 */
function startIptvStatusPolling() {
  if (iptvStatusInterval) return;
  iptvStatusInterval = setInterval(async () => {
    try {
      const res = await fetch('/api/iptv/status');
      const data = await res.json();
      updateIptvStatusUI(data);
      
      if (data.status !== 'updating') {
        clearInterval(iptvStatusInterval);
        iptvStatusInterval = null;
        loadIptvChannels();
      }
    } catch (e) {
      console.error(e);
    }
  }, 3000);
}

const iptvUpdateBtn = document.getElementById('iptv-update-btn');
if (iptvUpdateBtn) {
  iptvUpdateBtn.addEventListener('click', async () => {
    const isEn = localDb.settings?.lang === 'en';
    try {
      showToast(isEn ? 'IPTV list update requested...' : 'IPTV listesi güncellemesi istendi...', 'info');
      const res = await fetch('/api/iptv/update', { method: 'POST' });
      const data = await res.json();
      
      if (data.success) {
        checkIptvStatus();
      } else {
        showToast(data.error || 'Update request failed.', 'error');
      }
    } catch (err) {
      showToast('Connection error.', 'error');
    }
  });
}

/**
 * Türkçe Açıklama: Belirli bir IPTV slotu içerisinde HLS(.m3u8) veya mp4 yayın streamini oynatıcı (Plyr, ArtPlayer veya HTML5) ile başlatır.
 * 
 * @param {number} slotIndex - Yayının oynatılacağı slot indeksi (0-3)
 * @param {string} streamUrl - Yayının akış (M3U8 / MP4 vb.) adresi
 * @param {string} displayName - Slot başlığında gösterilecek kanal adı
 * @returns {void}
 */
function playIptvChannel(slotIndex, streamUrl, displayName) {
  clearIptvSlot(slotIndex);

  const slotEl = document.querySelector(`.iptv-slot[data-slot="${slotIndex}"]`);
  if (!slotEl) return;

  const playerContainer = slotEl.querySelector('.slot-player-instance');
  playerContainer.innerHTML = '';

  const video = document.createElement('video');
  video.id = `iptv-video-player-${slotIndex}`;
  video.style.width = '100%';
  video.style.height = '100%';
  video.style.display = 'block';
  video.style.outline = 'none';
  video.controls = true;
  video.autoplay = true;
  video.muted = true;

  playerContainer.appendChild(video);
  slotEl.classList.add('has-video');
  
  const titleEl = slotEl.querySelector('.slot-title');
  if (titleEl) {
    titleEl.textContent = `Slot ${slotIndex + 1}: ${displayName}`;
  }

  const muteBtn = slotEl.querySelector('.mute-btn');
  if (muteBtn) {
    muteBtn.innerHTML = '<i data-lucide="volume-x"></i>';
    lucide.createIcons();
  }

  const playerType = (localDb.settings && localDb.settings.playerType) || 'plyr';
  
  let hlsInstance = null;
  let playerInstance = null;

  if (streamUrl.includes('.m3u8') || streamUrl.includes('m3u8') || streamUrl.includes('stream') || streamUrl.startsWith('http')) {
    if (typeof Hls !== 'undefined' && Hls.isSupported()) {
      hlsInstance = new Hls();
      hlsInstance.loadSource(streamUrl);
      hlsInstance.attachMedia(video);
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = streamUrl;
    }
  } else {
    video.src = streamUrl;
  }

  if (playerType === 'artplayer' && typeof Artplayer !== 'undefined') {
    playerContainer.innerHTML = `<div id="iptv-artplayer-${slotIndex}" style="width: 100%; height: 100%;"></div>`;
    playerInstance = new Artplayer({
      container: `#iptv-artplayer-${slotIndex}`,
      url: streamUrl,
      autoplay: true,
      muted: true,
      controls: true,
      setting: false,
      hotkey: false,
      pip: false,
      fullscreen: true,
      mutex: false,
      type: 'm3u8',
      customType: {
        m3u8: function (videoEl, url, art) {
          if (typeof Hls !== 'undefined' && Hls.isSupported()) {
            if (art.hls) art.hls.destroy();
            const hls = new Hls();
            hls.loadSource(url);
            hls.attachMedia(videoEl);
            art.hls = hls;
            hlsInstance = hls;
            art.on('destroy', () => hls.destroy());
          } else if (videoEl.canPlayType('application/vnd.apple.mpegurl')) {
            videoEl.src = url;
          }
        }
      }
    });
  } else if (playerType === 'plyr' && typeof Plyr !== 'undefined') {
    playerInstance = new Plyr(video, {
      controls: ['play', 'mute', 'volume', 'fullscreen'],
      keyboard: { global: false, focused: false }
    });
  } else {
    playerInstance = video;
  }

  // IPTV kanalı baslatildi, player referanslarini kaydet
  const playerRef = {
    player: playerInstance,
    hls: hlsInstance,
    type: playerType,
    videoElement: video,
    streamUrl: streamUrl,
    displayName: displayName
  };
  iptvPlayers[slotIndex] = playerRef;

  // IPTV Kisayollar: Mouse Scroll (Ses) + Klavye (M/F/Bosluk/Yukari/Asagi Ok)
  const getIptvVideo = () => playerRef.videoElement || document.getElementById(`iptv-video-player-${slotIndex}`);

  // Mouse scroll ses degistir
  playerContainer.addEventListener('wheel', (e) => {
    e.preventDefault();
    const vid = getIptvVideo();
    if (!vid) return;
    const delta = e.deltaY < 0 ? 0.05 : -0.05;
    const newVol = Math.min(1, Math.max(0, (vid.volume || 0) + delta));
    vid.volume = newVol;
    if (vid.muted && newVol > 0) vid.muted = false;
    if (typeof triggerVolumeHUD === 'function') triggerVolumeHUD(newVol);
    const muteB = slotEl.querySelector('.mute-btn');
    if (muteB) {
      muteB.innerHTML = (vid.muted || newVol === 0)
        ? '<i data-lucide="volume-x"></i>'
        : '<i data-lucide="volume-2"></i>';
      lucide.createIcons();
    }
  }, { passive: false });

  // Klavye kısayolları – slot'a focus geldiğinde çalışır
  slotEl.setAttribute('tabindex', '0');
  slotEl.addEventListener('keydown', (e) => {
    const activeEl = document.activeElement;
    if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA')) return;
    const vid = getIptvVideo();
    if (!vid) return;
    switch (e.key) {
      case ' ': case 'k': case 'K':
        e.preventDefault();
        if (vid.paused) vid.play().catch(() => {}); else vid.pause();
        break;
      case 'm': case 'M':
        e.preventDefault();
        vid.muted = !vid.muted;
        if (typeof triggerVolumeHUD === 'function') triggerVolumeHUD(vid.muted ? 0 : vid.volume);
        break;
      case 'f': case 'F':
        e.preventDefault();
        if (!document.fullscreenElement) slotEl.requestFullscreen().catch(() => {});
        else document.exitFullscreen().catch(() => {});
        break;
      case 'ArrowUp':
        e.preventDefault(); {
          const v = Math.min(1, (vid.volume || 0) + 0.05);
          vid.volume = v;
          if (vid.muted && v > 0) vid.muted = false;
          if (typeof triggerVolumeHUD === 'function') triggerVolumeHUD(v);
        }
        break;
      case 'ArrowDown':
        e.preventDefault(); {
          const v = Math.max(0, (vid.volume || 0) - 0.05);
          vid.volume = v;
          if (typeof triggerVolumeHUD === 'function') triggerVolumeHUD(v);
        }
        break;
    }
  });
  // ─── Kısayollar Sonu ───

  updateIptvPlayingStatus();
  if (!isRestoringIptv && typeof saveIptvState === 'function') saveIptvState();
}

function resetIptvSlotStyles(slotIdx = null) {
  const resetSlot = (idx) => {
    const slot = document.querySelector(`.iptv-slot[data-slot="${idx}"]`);
    if (slot) {
      slot.classList.remove('is-dragging', 'is-resizing');
      slot.style.left = '';
      slot.style.top = '';
      slot.style.right = '';
      slot.style.bottom = '';
      slot.style.width = '';
      slot.style.height = '';
      slot.style.aspectRatio = '';
    }
  };

  if (slotIdx !== null) {
    resetSlot(slotIdx);
  } else {
    resetSlot(0);
    resetSlot(1);
    resetSlot(2);
    resetSlot(3);
  }
}

/**
 * Türkçe Açıklama: IPTV spor modunda Slot 2'nin (PiP ekranı) sürüklenebilmesini ve yeniden boyutlandırılabilmesini başlatan olay dinleyicilerini kurar.
 * 
 * @returns {void}
 */
function initIptvSportModeDragAndResize() {
  const setupSlotDragAndResize = (slotIndex) => {
    const slot = document.querySelector(`.iptv-slot[data-slot="${slotIndex}"]`);
    if (!slot) return;

    const header = slot.querySelector('.slot-header');
    const resizeHandle = slot.querySelector('.slot-resize-handle');
    if (!header || !resizeHandle) return;

    let isDragging = false;
    let isResizing = false;
    let startX, startY;
    let startLeft, startTop;
    let startWidth, startHeight;
    const gridEl = document.getElementById('iptv-players-grid');

    // Dragging logic
    header.addEventListener('mousedown', (e) => {
      // Only drag in sport mode
      if (!gridEl || !gridEl.classList.contains('sport-mode')) return;

      // Only drag Slot 2 (index 1) in sport mode
      if (slotIndex !== 1) return;
      
      // Ignore if clicked on buttons
      if (e.target.closest('.slot-btn') || e.target.closest('button')) return;

      e.preventDefault();
      isDragging = true;
      slot.classList.add('is-dragging');
      
      // Get initial position relative to parent
      const rect = slot.getBoundingClientRect();
      const parentRect = gridEl.getBoundingClientRect();
      
      // Set left and top explicitly so we transition from bottom/right absolute positioning
      slot.style.right = 'auto';
      slot.style.bottom = 'auto';
      slot.style.left = `${rect.left - parentRect.left}px`;
      slot.style.top = `${rect.top - parentRect.top}px`;
      
      // Remove aspect-ratio so resizing/dragging doesn't fight it
      slot.style.aspectRatio = 'auto';
      slot.style.height = `${rect.height}px`;
      slot.style.width = `${rect.width}px`;

      startX = e.clientX;
      startY = e.clientY;
      startLeft = parseFloat(slot.style.left) || 0;
      startTop = parseFloat(slot.style.top) || 0;

      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    });

    // Resizing logic
    resizeHandle.addEventListener('mousedown', (e) => {
      if (!gridEl || !gridEl.classList.contains('sport-mode')) return;

      // Only resize Slot 2 (index 1) in sport mode
      if (slotIndex !== 1) return;

      e.preventDefault();
      e.stopPropagation(); // Prevent triggering dragging
      isResizing = true;
      slot.classList.add('is-resizing');

      const rect = slot.getBoundingClientRect();
      const parentRect = gridEl.getBoundingClientRect();

      // Set left/top explicitly if not already
      slot.style.right = 'auto';
      slot.style.bottom = 'auto';
      slot.style.left = `${rect.left - parentRect.left}px`;
      slot.style.top = `${rect.top - parentRect.top}px`;
      
      slot.style.aspectRatio = 'auto';
      slot.style.height = `${rect.height}px`;
      slot.style.width = `${rect.width}px`;

      startX = e.clientX;
      startY = e.clientY;
      startWidth = rect.width;
      startHeight = rect.height;

      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    });

    function onMouseMove(e) {
      if (isDragging) {
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        
        const parentRect = gridEl.getBoundingClientRect();
        const slotRect = slot.getBoundingClientRect();
        
        let newLeft = startLeft + dx;
        let newTop = startTop + dy;

        // Bound within the parent grid
        const maxLeft = parentRect.width - slotRect.width;
        const maxTop = parentRect.height - slotRect.height;

        newLeft = Math.max(0, Math.min(newLeft, maxLeft));
        newTop = Math.max(0, Math.min(newTop, maxTop));

        slot.style.left = `${newLeft}px`;
        slot.style.top = `${newTop}px`;
      } else if (isResizing) {
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;

        // Maintain 16/9 aspect ratio during resize
        let newWidth = startWidth + dx;
        
        // Bounding width between min and max (min-width: 150px, max: 80% of parent width)
        const parentRect = gridEl.getBoundingClientRect();
        const minW = 150;
        const maxW = parentRect.width * 0.8;
        newWidth = Math.max(minW, Math.min(newWidth, maxW));

        let newHeight = newWidth * (9 / 16);
        
        // Ensure it doesn't overflow parent bottom
        const slotRect = slot.getBoundingClientRect();
        const currentTop = parseFloat(slot.style.top) || 0;
        if (currentTop + newHeight > parentRect.height) {
          newHeight = parentRect.height - currentTop;
          newWidth = newHeight * (16 / 9);
        }

        slot.style.width = `${newWidth}px`;
        slot.style.height = `${newHeight}px`;

        // Trigger resize for player instance if any
        resizeAllArtplayers();
      }
    }

    function onMouseUp() {
      isDragging = false;
      isResizing = false;
      slot.classList.remove('is-dragging', 'is-resizing');
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    }
  };

  setupSlotDragAndResize(0);
  setupSlotDragAndResize(1);
}

/**
 * Türkçe Açıklama: Belirli bir IPTV slotunun sessize alma (mute) butonunun ikonunu günceller.
 * 
 * @param {number} slotIndex - Güncellenecek slotun indeksi (0-3)
 * @param {boolean} isMuted - Slotun sessizde olup olmadığı bilgisi
 * @returns {void}
 */
function updateSlotMuteIcon(slotIndex, isMuted) {
  const slotEl = document.querySelector(`.iptv-slot[data-slot="${slotIndex}"]`);
  if (!slotEl) return;
  const muteBtn = slotEl.querySelector('.mute-btn');
  if (muteBtn) {
    muteBtn.innerHTML = isMuted
      ? '<i data-lucide="volume-x"></i>'
      : '<i data-lucide="volume-2"></i>';
    if (window.lucide) lucide.createIcons();
  }
}

/**
 * Türkçe Açıklama: IPTV spor modunda Slot 1 (ana ekran) ve Slot 2 (PiP ekranı) kanallarını yer değiştirir.
 * 
 * @returns {void}
 */
function swapIptvSportModePlayers() {
  const gridEl = document.getElementById('iptv-players-grid');
  if (!gridEl || !gridEl.classList.contains('sport-mode')) return;

  const player0 = iptvPlayers[0];
  const player1 = iptvPlayers[1];

  const url0 = player0 ? player0.streamUrl : null;
  const name0 = player0 ? player0.displayName : null;

  const url1 = player1 ? player1.streamUrl : null;
  const name1 = player1 ? player1.displayName : null;

  // Swap Slot 1's channel into Slot 0
  if (url1 && name1) {
    playIptvChannel(0, url1, name1);
    // Unmute Slot 0 (background)
    const p0 = iptvPlayers[0];
    if (p0) {
      if (p0.videoElement) p0.videoElement.muted = false;
      if (p0.player) p0.player.muted = false;
      updateSlotMuteIcon(0, false);
    }
  } else {
    clearIptvSlot(0);
  }

  // Swap Slot 0's channel into Slot 1
  if (url0 && name0) {
    playIptvChannel(1, url0, name0);
    // Mute Slot 1 (PiP overlay)
    const p1 = iptvPlayers[1];
    if (p1) {
      if (p1.videoElement) p1.videoElement.muted = true;
      if (p1.player) p1.player.muted = true;
      updateSlotMuteIcon(1, true);
    }
  } else {
    clearIptvSlot(1);
  }

  saveIptvState();
  resizeAllArtplayers();
}

// Global keydown event to support swapping screens via keys (s/S/y/Y) when in sports mode
document.addEventListener('keydown', (e) => {
  const activeEl = document.activeElement;
  if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA')) return;
  
  const gridEl = document.getElementById('iptv-players-grid');
  if (!gridEl || !gridEl.classList.contains('sport-mode')) return;

  if (e.key === 's' || e.key === 'S' || e.key === 'y' || e.key === 'Y') {
    e.preventDefault();
    swapIptvSportModePlayers();
  }
});

/**
 * Türkçe Açıklama: Yer değiştirme (Swap) butonunun görünürlüğünü aktif yerleşim moduna göre günceller (Sadece spor modunda görünür).
 * 
 * @returns {void}
 */
function updateIptvSwapBtnVisibility() {
  const gridEl = document.getElementById('iptv-players-grid');
  const swapBtn = document.getElementById('iptv-swap-btn');
  if (gridEl && swapBtn) {
    if (gridEl.classList.contains('sport-mode')) {
      swapBtn.classList.remove('hidden');
    } else {
      swapBtn.classList.add('hidden');
    }
  }
}

// Bind swap button listener
const iptvSwapBtn = document.getElementById('iptv-swap-btn');
if (iptvSwapBtn) {
  iptvSwapBtn.addEventListener('click', swapIptvSportModePlayers);
}

// Initial Sport Mode drag & resize setup
initIptvSportModeDragAndResize();

// Initial drag-and-drop list sortable containers setup
initDragAndDrop();

// Initial icons trigger
lucide.createIcons();

function playNextVideoInPlaylist() {
  if (!currentPlayingVideoId) return;

  let filteredDownloaded = localDb.history.filter(item => item.status === 'completed');
  if (downloadedFilterChannel !== 'all') {
    filteredDownloaded = filteredDownloaded.filter(item => item.channelId === downloadedFilterChannel);
  }
  const showShorts = localDb.settings?.showShorts !== false;
  if (!showShorts) {
    filteredDownloaded = filteredDownloaded.filter(item => !isShortVideo(item.duration, item.title, item.channelId));
  }
  const sortVal = downloadedSortVal || 'date-desc';
  
  filteredDownloaded.sort((a, b) => {
    if (sortVal === 'user') {
      const customOrder = JSON.parse(localStorage.getItem('downloaded-user-order') || '[]');
      let indexA = customOrder.indexOf(a.id);
      let indexB = customOrder.indexOf(b.id);
      
      if (indexA === -1 && indexB === -1) {
        const dateA = new Date(a.publishedAt || a.downloadedAt || 0).getTime();
        const dateB = new Date(b.publishedAt || b.downloadedAt || 0).getTime();
        return dateB - dateA;
      }
      if (indexA === -1) return -1;
      if (indexB === -1) return 1;
      
      return indexA - indexB;
    } else if (sortVal.startsWith('size-')) {
      const sizeA = parseSizeToBytes(a.fileSize);
      const sizeB = parseSizeToBytes(b.fileSize);
      return sortVal === 'size-desc' ? sizeB - sizeA : sizeA - sizeB;
    } else {
      const dateA = new Date(a.publishedAt || a.downloadedAt || 0).getTime();
      const dateB = new Date(b.publishedAt || b.downloadedAt || 0).getTime();
      return sortVal === 'date-asc' ? dateA - dateB : dateB - dateA;
    }
  });

  const currentIndex = filteredDownloaded.findIndex(item => item.id === currentPlayingVideoId);
  if (currentIndex !== -1 && currentIndex + 1 < filteredDownloaded.length) {
    const nextVideo = filteredDownloaded[currentIndex + 1];
    playVideoEmbedded(nextVideo.id);
  }
}

function initDragAndDrop() {
  setupSortableContainer(document.getElementById('downloaded-grid'), '.video-card', 'downloaded-user-order');
  setupSortableContainer(document.getElementById('downloaded-playlist-grid'), '.playlist-item', 'downloaded-user-order');
}

function setupSortableContainer(container, itemSelector, storageKey) {
  if (!container) return;
  let draggingElement = null;

  container.addEventListener('dragstart', (e) => {
    if (typeof downloadedSortVal === 'undefined' || downloadedSortVal !== 'user') return;
    const item = e.target.closest(itemSelector);
    if (!item) return;
    draggingElement = item;
    item.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
  });

  container.addEventListener('dragover', (e) => {
    if (typeof downloadedSortVal === 'undefined' || downloadedSortVal !== 'user') return;
    e.preventDefault();
    const target = e.target.closest(itemSelector);
    if (!target || target === draggingElement) return;

    const rect = target.getBoundingClientRect();
    const next = (e.clientY - rect.top) / (rect.bottom - rect.top) > 0.5 || (e.clientX - rect.left) / (rect.right - rect.left) > 0.5;

    if (next) {
      target.after(draggingElement);
    } else {
      target.before(draggingElement);
    }
  });

  container.addEventListener('dragend', () => {
    if (draggingElement) {
      draggingElement.classList.remove('dragging');
      draggingElement = null;
    }
    
    if (typeof downloadedSortVal === 'undefined' || downloadedSortVal !== 'user') return;
    
    const items = Array.from(container.querySelectorAll(itemSelector));
    const newOrder = items.map(el => el.getAttribute('data-id')).filter(Boolean);
    localStorage.setItem(storageKey, JSON.stringify(newOrder));
    
    updateUI(localDb);
  });
}
