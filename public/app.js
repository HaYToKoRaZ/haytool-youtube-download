/**
 * HaYTool Youtube Download - İstemci Mantığı (Frontend)
 * 
 * Yapımcı: HaYTo
 * İletişim: korazhayto@gmail.com
 */

let localDb = { channels: [], history: [], settings: {} };
let eventSource = null;

// YouTube SVG İkon Şablonu (Lucide bağımlılığı olmadan her ortamda çalışması için yerel SVG kullanıyoruz)
const youtubeSvgIcon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" style="display:inline-block !important;vertical-align:middle !important;fill:#ff0000 !important;stroke:none !important;width:16px !important;height:16px !important;"><path d="M23.498 6.163a3.003 3.003 0 0 0-2.11-2.11C19.517 3.545 12 3.545 12 3.545s-7.516 0-9.388.508a3.003 3.003 0 0 0-2.11 2.11C0 8.033 0 12 0 12s0 3.967.502 5.837a3.003 3.003 0 0 0 2.11 2.11c1.872.508 9.388.508 9.388.508s7.517 0 9.388-.508a3.003 3.003 0 0 0 2.11-2.11C24 15.967 24 12 24 12s0-3.967-.502-5.837zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" style="fill:#ff0000 !important;stroke:none !important;"/></svg>`;

// Çoklu Dil Sözlüğü (İngilizce & Türkçe)
const translations = {
  tr: {
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
    // Türkçe Açıklama: Toplu güncelleme butonu dil etiketi eklendi.
    btn_update_all_logos: 'Tüm Logoları Güncelle',
    empty_channels_title: 'Henüz takip edilen kanal yok',
    empty_channels_desc: 'Yukarıdaki formdan YouTube kanal linki veya kullanıcı adı girerek kanal ekleyebilirsiniz.',
    select_quality_default: 'Varsayılan Kalite',
    select_quality_best: 'En Yüksek',
    select_quality_1080p: '1080p FHD',
    select_quality_720p: '720p HD',
    select_shorts_true: 'Shorts İndir',
    select_shorts_false: 'Shorts İndirme',
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
    show_shorts: 'Shorts Videolarını Göster',
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
    // Türkçe Açıklama: Ayarlar sekmesindeki hız sınırı etiket ismi KB/s olarak güncellendi.
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
    opt_player_html5: 'Standart HTML5 Player (Hızlı & Sade)',
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
    // Türkçe Açıklama: Kuyruk sekmesindeki hız sınırı etiket ismi güncellendi.
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
    cli_info_desc: "Hız sınırlarını konsoldan veya terminal/CLI üzerinden kontrol edebilirsiniz (Windows'ta <code>HaYTool.exe &lt;komut&gt;</code> veya <code>haytool &lt;komut&gt;</code> kullanabilirsiniz):<br>• <b>Hız Sınırını Ayarlama:</b> <code>HaYTool.exe speed &lt;değer&gt;</code> (örn: <code>HaYTool.exe speed 2500</code>)<br>• <b>Hız Sınırını Açma/Kapatma:</b> <code>HaYTool.exe speed off</code> (kapatır) / <code>HaYTool.exe speed on</code> (son değere açar)<br>• <b>Alternatif Sınırı Belirleme:</b> <code>HaYTool.exe altspeed &lt;değer&gt;</code> (örn: <code>HaYTool.exe altspeed 500</code>)<br>• <b>Alternatif Sınırı Kesin Aç/Kapat (Turtle):</b> <code>HaYTool.exe turtleon / turtleac</code> (açar) / <code>HaYTool.exe turtleoff / turtlekapat</code> (kapatır)<br>• <b>Alternatif Sınır Profil Geçişi (Toggle):</b> <code>HaYTool.exe toggle</code> veya <code>HaYTool.exe altspeed toggle</code><br>• <b>Durum Sorgulama:</b> <code>HaYTool.exe status</code> (limit durumunu yazdırır)",
    cli_info_note: "(Tray \"Konsol Çıktısını Göster\" penceresinde \'HaYTool.exe\' veya \'node\' yazmadan doğrudan komutu girin: \'speed 2500\', \'speed off\', \'turtleon\', \'turtleoff\', \'toggle\' vb.)",
    desc_channel_check_interval: 'Sıradaki kanalı denetlemek için beklenecek süre.',
    desc_rss_limit: 'Kanal başına RSS akışındaki en yeni kaç video kontrol edilsin?',
    desc_auto_delete: 'Kaç gün sonra otomatik silinsin? (Kapatmak için 0 yazın)',
    opt_browser_none: 'Çerez Kullanma (Sadece Açık Videolar)',
    desc_browser: 'YouTube Premium hesabınızın açık olduğu tarayıcıyı seçin. Bu sayede Premium yüksek indirme hızı ve yüksek kalite kullanılabilir.',
    settings_status_text: 'Değişiklikler anında otomatik kaydedilir.'
  },
  en: {
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
    // Türkçe Açıklama: İngilizce toplu güncelleme butonu dil etiketi eklendi.
    btn_update_all_logos: 'Update All Logos',
    empty_channels_title: 'No monitored channels yet',
    empty_channels_desc: 'You can add channels by entering a YouTube channel link or username from the form above.',
    select_quality_default: 'Default Quality',
    select_quality_best: 'Highest',
    select_quality_1080p: '1080p FHD',
    select_quality_720p: '720p HD',
    select_shorts_true: 'Download Shorts',
    select_shorts_false: 'Ignore Shorts',
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
    queue_empty: 'No videos waiting in the queue.',
    library_history_title: 'Library & History',
    filter_all_channels: 'All Channels',
    show_shorts: 'Show Shorts Videos',
    view_grid: 'Cards',
    view_list: 'Simple List',
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
    // Türkçe Açıklama: İngilizce ayarlar sekmesindeki hız sınırı etiketi KB/s yapıldı.
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
    opt_player_html5: 'Standard HTML5 Player (Fast & Simple)',
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
    // Türkçe Açıklama: İngilizce kuyruk sekmesindeki hız sınırı etiketi güncellendi.
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
    cli_info_desc: "You can control speed limits from the console or terminal/CLI (you can use <code>HaYTool.exe &lt;command&gt;</code> or <code>haytool &lt;command&gt;</code> on Windows):<br>• <b>Set Speed Limit:</b> <code>HaYTool.exe speed &lt;value&gt;</code> (e.g. <code>HaYTool.exe speed 2500</code>)<br>• <b>Speed Limit On/Off:</b> <code>HaYTool.exe speed off</code> (disables) / <code>HaYTool.exe speed on</code> (restores to last value)<br>• <b>Set Alt Speed Limit:</b> <code>HaYTool.exe altspeed &lt;value&gt;</code> (e.g. <code>HaYTool.exe altspeed 500</code>)<br>• <b>Alt Speed Limit Forced On/Off (Turtle):</b> <code>HaYTool.exe turtleon / turtleac</code> (enables) / <code>HaYTool.exe turtleoff / turtlekapat</code> (disables)<br>• <b>Alt Speed Profile Toggle:</b> <code>HaYTool.exe toggle</code> or <code>HaYTool.exe altspeed toggle</code><br>• <b>Query Status:</b> <code>HaYTool.exe status</code> (prints limit status)",
    cli_info_note: "(In the Tray 'Show Console Output' window, enter the command directly without writing 'HaYTool.exe' or 'node': 'speed 2500', 'speed off', 'turtleon', 'turtleoff', 'toggle' etc.)",
    desc_channel_check_interval: 'Waiting time to check the next channel.',
    desc_rss_limit: 'How many of the latest videos in the RSS feed should be checked per channel?',
    desc_auto_delete: 'After how many days should it be deleted automatically? (Write 0 to disable)',
    opt_browser_none: 'Do Not Use Cookies (Public Videos Only)',
    desc_browser: 'Select the browser where your YouTube Premium account is logged in. This enables Premium high download speed and high quality.',
    settings_status_text: 'Changes are automatically saved instantly.'
  }
};

// Türkçe Açıklama: Seçilen dil paketine (TR veya EN) göre sayfadaki tüm metin etiketlerini ve açıklamaları dinamik olarak günceller.
/**
 * Arayüz dilini seçilen dile göre günceller.
 * 
 * @param {string} lang Seçilen dil kodu ('tr' veya 'en')
 */
function applyLanguage(lang) {
  const t = translations[lang] || translations.tr;
  
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
  document.documentElement.lang = lang;

  // Header Navigasyon ve Başlıklar
  // elQuery('.brand-text span', 'premium_automation');
  elQuery('button[data-tab="history"] span', 'tab_library');
  elQuery('button[data-tab="queue"] span', 'tab_queue');
  elQuery('button[data-tab="downloaded"] span', 'tab_downloaded');
  elQuery('button[data-tab="channels"] span', 'tab_channels');
  elQuery('button[data-tab="settings"] span', 'tab_settings');

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
  elQuery('#tab-history .content-header h2', 'library_title');
  elQuery('#tab-history .content-header p', 'library_desc');
  elQuery('#open-folder-btn span', 'btn_open_downloads');
  elQuery('#tab-history > .card-title-bar h3', 'library_history_title');
  elQuery('label[for="history-show-shorts"] + span', 'show_shorts');
  elQuery('#view-grid-btn span', 'view_grid');
  elQuery('#view-list-btn span', 'view_list');

  // İndirilen Videolar Sekmesi
  elQuery('#tab-downloaded .content-header h2', 'downloaded_title');
  elQuery('#tab-downloaded .content-header p', 'downloaded_desc');
  elQuery('#tab-downloaded .content-header button span', 'btn_open_downloads');
  elQuery('label[for="downloaded-show-shorts"] + span', 'show_shorts');
  elQuery('#downloaded-view-grid-btn span', 'view_grid');
  elQuery('#downloaded-view-list-btn span', 'view_list');

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

  elQuery('.form-actions button span', 'btn_save_settings');

  // Onay Modalları
  elQuery('#delete-modal h3', 'modal_delete_title');
  elQuery('#delete-modal-msg', 'modal_delete_desc');
  elQuery('#delete-file-checkbox + label + span', 'modal_delete_file_checkbox');
  elQuery('#confirm-delete-btn', 'modal_delete_btn');
  elQuery('#cancel-delete-btn', 'modal_cancel_btn');
  elQuery('#player-modal-title', 'modal_player_title');

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
    sortBtnDateDesc.title = lang === 'en' ? 'Date: Newest to Oldest' : 'Tarih: Yeniden Eskiye';
  }
  if (sortBtnDateAsc) {
    sortBtnDateAsc.textContent = t.sort_btn_date_asc;
    sortBtnDateAsc.title = lang === 'en' ? 'Date: Oldest to Newest' : 'Tarih: Eskiden Yeniye';
  }
  if (sortBtnSizeDesc) {
    sortBtnSizeDesc.textContent = t.sort_btn_size_desc;
    sortBtnSizeDesc.title = lang === 'en' ? 'Size: Largest to Smallest' : 'Boyut: Büyükten Küçüğe';
  }
  if (sortBtnSizeAsc) {
    sortBtnSizeAsc.textContent = t.sort_btn_size_asc;
    sortBtnSizeAsc.title = lang === 'en' ? 'Size: Smallest to Largest' : 'Boyut: Küçükten Büyüğe';
  }

  // Ayarlar alt sekmeleri ve açıklamaları
  el('settings-desc', 'settings_desc');
  el('settings-version-title', 'settings_version_title');
  
  elQuery('.settings-tab-btn[data-subtab="general"] span', 'settings_tab_general');
  elQuery('.settings-tab-btn[data-subtab="download"] span', 'settings_tab_download');
  elQuery('.settings-tab-btn[data-subtab="automation"] span', 'settings_tab_automation');
  elQuery('.settings-tab-btn[data-subtab="notifications"] span', 'settings_tab_notifications');
  elQuery('.feedback-btn span', 'settings_tab_feedback');

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

  // CLI açıklama HTML kutusu dinamik güncellemesi
  const cliInfoDesc = document.getElementById('cli-info-desc');
  if (cliInfoDesc) {
    cliInfoDesc.innerHTML = t.cli_info_desc + `<br><small style="color: var(--accent-color); opacity: 0.8; font-weight: bold;" id="cli-info-note">${t.cli_info_note}</small>`;
  }
}

// Türkçe Açıklama: Seçilen tarayıcıya ait çerezlerin geçerli olup olmadığını backend'e sorarak arayüzdeki çerez durum lambasını günceller.
/**
 * Tarayıcı çerezlerinin geçerliliğini test eder ve durum göstergesini günceller.
 * 
 * @returns {Promise<void>}
 */
async function testCookies() {
  const indicator = document.getElementById('cookie-test-indicator');
  if (!indicator) return;
  
  const isEn = localDb.settings && localDb.settings.lang === 'en';
  
  if (!localDb.settings || !localDb.settings.browser || localDb.settings.browser === 'none') {
    indicator.style.backgroundColor = 'var(--text-muted)';
    indicator.title = isEn ? 'Cookies not used' : 'Çerez kullanılmıyor';
    return;
  }
  
  indicator.style.backgroundColor = 'var(--warning)';
  indicator.title = isEn ? 'Testing cookies...' : 'Çerezler test ediliyor...';
  
  try {
    const res = await fetch('/api/test-cookies');
    const data = await res.json();
    if (data.success) {
      indicator.style.backgroundColor = '#10b981'; // Green
      indicator.title = isEn ? 'Cookies are active and valid' : 'Çerezler aktif ve geçerli';
    } else {
      indicator.style.backgroundColor = '#ef4444'; // Red
      indicator.title = (isEn ? 'Cookie error: ' : 'Çerez hatası: ') + (data.error || 'Unknown error');
      console.error('[Çerez Testi Hata]:', data.error);
    }
  } catch (err) {
    indicator.style.backgroundColor = '#ef4444'; // Red
    indicator.title = isEn ? 'Failed to communicate with server for cookie test' : 'Çerez testi için sunucuyla iletişim kurulamadı';
  }
}

// Sayfa açıldığında masaüstü bildirim izni talep et
if ('Notification' in window && Notification.permission === 'default') {
  Notification.requestPermission();
}

// DOM Elemanları
const statusIndicator = document.getElementById('status-indicator');
const connectionStatus = document.getElementById('connection-status');
const cookieStatus = document.getElementById('cookie-status');
const qualityStatus = document.getElementById('quality-status');

const navItems = document.querySelectorAll('.nav-item');
const tabContents = document.querySelectorAll('.tab-content');

// Dashboard Tab Elemanları
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
  settings: '/settings'
};

const pathTabMap = {
  '/home': 'history',
  '/download': 'queue',
  '/downlist': 'downloaded',
  '/channels': 'channels',
  '/settings': 'settings'
};

// Türkçe Açıklama: Sekmeler arası geçişi sağlar, aktif sekmeyi görsel olarak vurgular ve tarayıcının adres satırını History API ile günceller.
/**
 * Sekme geçişini yönetir ve tarayıcı geçmişini günceller.
 * 
 * @param {string} targetTab Hedef sekme adı
 * @param {boolean} triggerPushState Adres satırı geçmişine kaydedilip kaydedilmeyeceği (varsayılan: true)
 */
function switchTab(targetTab, triggerPushState = true) {
  window.switchTab = switchTab;
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

  if (triggerPushState) {
    const targetPath = tabPathMap[targetTab];
    if (targetPath && window.location.pathname !== targetPath) {
      history.pushState({ tab: targetTab }, '', targetPath);
    }
  }
}

// Sekme Değiştirme
navItems.forEach(item => {
  item.addEventListener('click', () => {
    const targetTab = item.getAttribute('data-tab');
    switchTab(targetTab, true);
  });
});

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
      connectionStatus.textContent = 'Bağlandı';
      connectionStatus.className = 'value text-muted';
    }
    const statusText = document.getElementById('topbar-status-text');
    if (statusText) statusText.textContent = 'Bağlantı: Aktif';
    updateDiskSpace();
  };

  eventSource.onerror = (err) => {
    if (statusIndicator) statusIndicator.className = 'status-dot offline';
    if (connectionStatus) {
      connectionStatus.textContent = 'Bağlantı Kesildi';
      connectionStatus.className = 'value text-muted';
    }
    const statusText = document.getElementById('topbar-status-text');
    if (statusText) statusText.textContent = 'Bağlantı: Kesildi';
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

    // Masaüstü Bildirimi (Sadece indirme tamamlanma başarısında)
    if (log.type === 'success' && 'Notification' in window && Notification.permission === 'granted') {
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
    const isShort = isShortVideo(item.duration, item.title);
    const card = document.createElement('div');
    card.className = 'video-card' + (isShort ? ' is-short' : '');
    
    let statusHtml = '';
    let actionsHtml = '';

    const isMissing = item.fileMissing === true;
    const isCompleted = item.status === 'completed';
    const canPlayEmbedded = isCompleted && !isMissing;

    const clickAction = canPlayEmbedded 
      ? `playVideoEmbedded('${item.id}')` 
      : `openYouTube('${item.id}')`;
      
    const clickTitle = canPlayEmbedded
      ? (isEn ? 'Play video' : 'Videoyu Gömülü Oynatıcıda Aç')
      : (isEn ? 'Open on YouTube' : 'YouTube\'da Aç');

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
      statusHtml = `<span class="status-pill ignored"><i data-lucide="skip-forward" style="width:12px;height:12px;margin-right:4px;"></i> ${isEn ? 'Ignored' : 'Göz Ardı Edildi'}</span>`;
      actionsHtml = `
        <button class="btn-icon" onclick="downloadVideoManual('${item.id}')" title="${isEn ? 'Download Now' : 'Videoyu Şimdi İndir'}">
          <i data-lucide="download"></i>
        </button>
        <button class="btn-icon" onclick="openYouTube('${item.id}')" title="YouTube'da Aç">
          ${youtubeSvgIcon}
        </button>
      `;
    }

    if (item.status !== 'downloading') {
      actionsHtml += `
        <button class="btn-icon video-action-delete" onclick="showDeleteModal('${item.id}')" title="${isEn ? 'Delete from History/Disk' : 'Geçmişten/Diskten Sil'}">
          <i data-lucide="trash-2"></i>
        </button>
      `;
    }

    const durationBadgeHtml = item.duration 
      ? `<div class="video-duration-badge">${item.duration}</div>` 
      : '';

    const shortsBadgeHtml = isShort 
      ? `<div class="video-shorts-badge"><i data-lucide="zap" style="width:10px;height:10px;margin-right:2px;"></i> Shorts</div>` 
      : '';

    const shortsTagHtml = isShort 
      ? `<span class="video-card-shorts-tag"><i data-lucide="zap" style="width:10px;height:10px;margin-right:2px;"></i> Shorts</span>` 
      : '';

    card.innerHTML = `
      <div class="video-thumbnail-wrapper" onclick="${clickAction}" style="cursor: pointer;" title="${clickTitle}">
        <img class="video-thumbnail" src="https://img.youtube.com/vi/${item.id}/mqdefault.jpg" alt="Video Resmi" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22320%22 height=%22180%22><rect width=%22320%22 height=%22180%22 fill=%22%2316142a%22/><text x=%2250%25%22 y=%2250%25%22 dominant-baseline=%22middle%22 text-anchor=%22middle%22 fill=%22%2394a3b8%22 font-family=%22sans-serif%22 font-size=%2214%22>Kapak Resmi Yok</text></svg>'">
        ${durationBadgeHtml}
        ${shortsBadgeHtml}
      </div>
      <div class="video-card-content">
        <h3 class="video-card-title" onclick="${clickAction}" style="cursor: pointer;" title="${clickTitle}: ${escapeHtml(item.title)}">${escapeHtml(item.title)}</h3>
        <div style="display:flex; align-items:center; gap:8px; margin-bottom:8px;">
          <span class="video-card-duration-text">${item.duration || 'Süre Belirtilmedi'}</span>
          ${shortsTagHtml}
        </div>
        <div class="video-card-metadata">
          <span class="video-card-channel"><i data-lucide="tv" style="width:12px;height:12px;display:inline-block;vertical-align:middle;margin-right:4px;"></i> ${escapeHtml(item.channelName)}</span>
          <span>${isEn ? 'Date' : 'Tarih'}: ${formatDate(item.publishedAt || item.downloadedAt)}</span>
          <span>${isEn ? 'Size' : 'Boyut'}: ${item.fileSize || '-- MB'}</span>
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

  // 1. Sistem Durum Detayları
  const isEn = db.settings && db.settings.lang === 'en';
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
    } else {
      if (noActiveDownload) noActiveDownload.classList.remove('hidden');
      if (activeDownloadDetails) activeDownloadDetails.classList.add('hidden');
      if (activeSpeed) activeSpeed.textContent = '0 MB/s';
    }

    // 4. Kuyruk Listesi
    if (queueList) {
      queueList.innerHTML = '';
      const isEn = db.settings && db.settings.lang === 'en';
      if (waitingVideos.length === 0) {
        queueList.innerHTML = `
          <div class="text-center text-muted" id="queue-list-empty" style="padding: 30px 0; font-size: 0.85rem;">${isEn ? 'No videos waiting in the queue.' : 'Kuyrukta bekleyen video yok.'}</div>
        `;
      } else {
        waitingVideos.forEach(video => {
          const item = document.createElement('div');
          item.className = 'queue-item';
          item.setAttribute('draggable', 'true');
          item.setAttribute('data-id', video.id);
          item.innerHTML = `
            <div class="queue-item-drag-handle" style="cursor: grab; display: flex; align-items: center; justify-content: center; padding-right: 12px; color: var(--text-muted);" title="${isEn ? 'Drag to reorder' : 'Sürükleyip sıralayın'}">
              <i data-lucide="grip-vertical" style="width:16px; height:16px;"></i>
            </div>
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
          <h3>Henüz takip edilen kanal yok</h3>
          <p>Yukarıdaki formdan YouTube kanal linki veya kullanıcı adı girerek kanal ekleyebilirsiniz.</p>
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
            <select onchange="changeChannelQuality('${channel.id}', this.value)" class="channel-quality-select" title="İndirme Kalitesi">
              <option value="default" ${(!channel.quality || channel.quality === 'default') ? 'selected' : ''}>Varsayılan Kalite</option>
              <option value="best" ${channel.quality === 'best' ? 'selected' : ''}>En Yüksek</option>
              <option value="1080p" ${channel.quality === '1080p' ? 'selected' : ''}>1080p FHD</option>
              <option value="720p" ${channel.quality === '720p' ? 'selected' : ''}>720p HD</option>
            </select>
          </div>
          <div class="channel-list-shorts">
            <select onchange="changeChannelShorts('${channel.id}', this.value)" class="channel-shorts-select" title="Shorts İndirme Durumu">
              <option value="true" ${channel.downloadShorts !== false ? 'selected' : ''}>Shorts İndir</option>
              <option value="false" ${channel.downloadShorts === false ? 'selected' : ''}>Shorts İndirme</option>
            </select>
          </div>
          <div class="channel-list-meta">
            <span class="channel-list-date">
              <i data-lucide="calendar" style="width:11px;height:11px;vertical-align:middle;margin-right:3px;"></i>
              ${formatDate(channel.addedAt).split(' ')[0]}
            </span>
          </div>
          <div class="channel-list-actions">
            <button class="btn-icon channel-logo-update-btn" onclick="updateChannelAvatar('${channel.id}')" title="Logoyu Güncelle">
              <i data-lucide="image" style="color:#38bdf8;"></i>
            </button>
            <a href="${channelUrl}" target="_blank" rel="noopener noreferrer" class="btn-icon channel-open-btn" title="YouTube'da Aç">
              ${youtubeSvgIcon}
            </a>
            <button class="btn-icon channel-delete-icon-btn" onclick="deleteChannel('${channel.id}')" title="Takipten Çıkar">
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
    historyChannelFilter.innerHTML = '<option value="all">Tüm Kanallar</option>';
    
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
    downloadedChannelFilter.innerHTML = '<option value="all">Tüm Kanallar</option>';
    
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
    let filteredHistory = [...db.history];
    if (historyFilterChannel !== 'all') {
      filteredHistory = filteredHistory.filter(item => item.channelId === historyFilterChannel);
    }
    
    const showShorts = db.settings.showShorts !== false;
    if (!showShorts) {
      filteredHistory = filteredHistory.filter(item => !isShortVideo(item.duration, item.title));
    }
    
    // Yüklenme tarihine göre sırala (Yeni olan en üstte)
    filteredHistory.sort((a, b) => {
      const dateA = new Date(a.publishedAt || a.downloadedAt || 0).getTime();
      const dateB = new Date(b.publishedAt || b.downloadedAt || 0).getTime();
      return dateB - dateA;
    });
    
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
      filteredDownloaded = filteredDownloaded.filter(item => !isShortVideo(item.duration, item.title));
    }
    
    // Seçilen kritere göre sırala (Tarih veya Boyut)
    const sortVal = downloadedSortVal || 'date-desc';
    filteredDownloaded.sort((a, b) => {
      if (sortVal.startsWith('size-')) {
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
  }

  // 7. Ayarlar Değerleri (Sadece alan odaklanılmamışsa doldur)
  if (db.settings) {
    if (settingsDownloadPath && document.activeElement !== settingsDownloadPath) settingsDownloadPath.value = db.settings.downloadPath || '';
    if (settingsBrowser && document.activeElement !== settingsBrowser) settingsBrowser.value = db.settings.browser || 'none';
    if (settingsQuality && document.activeElement !== settingsQuality) settingsQuality.value = db.settings.quality || 'best';
    if (settingsChannelCheckInterval && document.activeElement !== settingsChannelCheckInterval) settingsChannelCheckInterval.value = db.settings.channelCheckInterval || 60;
    if (settingsAutoDownload && document.activeElement !== settingsAutoDownload) settingsAutoDownload.checked = !!db.settings.autoDownload;

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
    if (settingsPort && document.activeElement !== settingsPort) settingsPort.value = db.settings.port || 3000;

    const settingsPlaySounds = document.getElementById('settings-playsounds');
    if (settingsPlaySounds && document.activeElement !== settingsPlaySounds) settingsPlaySounds.checked = db.settings.playSounds !== false;

    const settingsShowNotifications = document.getElementById('settings-shownotifications');
    if (settingsShowNotifications && document.activeElement !== settingsShowNotifications) settingsShowNotifications.checked = db.settings.showNotifications !== false;

    const settingsAutoOpenBrowser = document.getElementById('settings-autoopenbrowser');
    if (settingsAutoOpenBrowser && document.activeElement !== settingsAutoOpenBrowser) settingsAutoOpenBrowser.checked = db.settings.autoOpenBrowser !== false;

    const settingsLang = document.getElementById('settings-lang');
    if (settingsLang && document.activeElement !== settingsLang) settingsLang.value = db.settings.lang || 'tr';

    const settingsPlayerType = document.getElementById('settings-player-type');
    if (settingsPlayerType && document.activeElement !== settingsPlayerType) settingsPlayerType.value = db.settings.playerType || 'plyr';

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
function isShortVideo(durationStr, title) {
  if (title && (title.toLowerCase().includes('#shorts') || title.toLowerCase().includes('shorts'))) {
    return true;
  }
  if (!durationStr) return false;
  const parts = durationStr.split(':').map(Number);
  
  if (parts.length === 1) {
    return parts[0] <= 180;
  } else if (parts.length === 2) {
    const minutes = parts[0];
    const seconds = parts[1];
    const totalSeconds = (minutes * 60) + seconds;
    return totalSeconds <= 180;
  }
  return false;
}

// Türkçe Açıklama: Belirtilen kanal ID'sini backend API'sine ileterek kanalı izleme listesinden çıkarır ve geçmiş verilerini siler.
/**
 * Belirtilen kanalı takipten çıkarır ve veritabanından siler.
 * 
 * @param {string} id Silinecek kanal ID'si
 */
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

async function performAutoSave() {
  if (!settingsForm) return;
  
  const settingsPortInput = document.getElementById('settings-port');
  const port = settingsPortInput ? parseInt(settingsPortInput.value, 10) : 3000;
  
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
    playSounds: document.getElementById('settings-playsounds').checked,
    showNotifications: document.getElementById('settings-shownotifications').checked,
    autoOpenBrowser: document.getElementById('settings-autoopenbrowser').checked,
    lang: document.getElementById('settings-lang').value
  };

  const oldPort = localDb.settings.port || 3000;
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
    showToast('Tüm kanallar manuel taranıyor...', 'info');
    
    try {
      const res = await fetch('/api/sync', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        showToast('Kanallar başarıyla denetlendi.', 'success');
      } else {
        showToast(data.error || 'Hata oluştu.', 'error');
      }
    } catch (err) {
      showToast('Bağlantı hatası.', 'error');
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

let videoPlayerInstance = null;
let currentPlayingVideoId = null;
let seekedForCurrentVideo = false;

// Türkçe Açıklama: Gömülü video oynatıcı açıkken YouTube klavye kısayollarını (Space, F, M, yön tuşları, sayılar vb.) etkinleştirir.
/**
 * Video oynatıcı modalı açıkken YouTube klavye kısayollarını dinler ve yürütür.
 */
document.addEventListener('keydown', (e) => {
  const modal = document.getElementById('player-modal');
  if (modal && !modal.classList.contains('hidden')) {
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
        // Shift + . veya Shift + , durumları için hız kontrolü
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
  
  if (btn) {
    const icon = btn.querySelector('i') || btn.querySelector('[data-lucide]');
    if (icon) {
      icon.setAttribute('data-lucide', isMinimized ? 'maximize-2' : 'minus');
    }
    btn.title = isMinimized ? (localDb.settings && localDb.settings.lang === 'en' ? 'Maximize' : 'Büyüt') : (localDb.settings && localDb.settings.lang === 'en' ? 'Minimize' : 'Küçült');
  }
  lucide.createIcons();
};

// Türkçe Açıklama: İndirilen videoyu arayüz içerisindeki gömülü video oynatıcı (Plyr) modalında açarak yürütür.
/**
 * Videoyu gömülü tarayıcı oynatıcısında (Plyr) açar.
 * Shorts videoları dikey gösterilir ve kalınan izleme süresinden devam eder.
 * 
 * @param {string} videoId Oynatılacak video ID'si
 */
window.playVideoEmbedded = function(videoId) {
  const modal = document.getElementById('player-modal');
  const titleEl = document.getElementById('player-modal-title');
  if (modal) {
    const video = localDb.history.find(h => h.id === videoId);
    if (titleEl && video) {
      titleEl.textContent = video.title;
    } else if (titleEl) {
      titleEl.textContent = 'Gömülü Video Oynatıcı';
    }
    
    // Kanal logosunu güncelle
    const logoEl = document.getElementById('player-modal-logo');
    if (logoEl && video && video.channelId) {
      logoEl.src = `/api/channels/${video.channelId}/avatar`;
      logoEl.style.display = 'block';
      logoEl.onerror = function() {
        this.src = 'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2224%22 height=%2224%22><rect width=%2224%22 height=%2224%22 fill=%22%2316142a%22/><text x=%2250%25%22 y=%2250%25%22 dominant-baseline=%22middle%22 text-anchor=%22middle%22 fill=%22%2394a3b8%22 font-family=%22sans-serif%22 font-size=%2210%22>?</text></svg>';
      };
    } else if (logoEl) {
      logoEl.style.display = 'none';
    }

    // Küçültme (minimize) durumunu sıfırla
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

    // Kısa video (Shorts) kontrolü ve dikey arayüz sınıfı eklenmesi
    const isShort = video ? isShortVideo(video.duration, video.title) : false;
    if (isShort) {
      modal.classList.add('is-short-player');
    } else {
      modal.classList.remove('is-short-player');
    }
    
    const streamUrl = `/api/video-stream?videoId=${videoId}`;
    modal.classList.remove('hidden');

    seekedForCurrentVideo = false;
    currentPlayingVideoId = videoId;

    // Önceki oynatıcıyı yok et ve temiz video elementi oluştur
    if (videoPlayerInstance) {
      try {
        if (typeof videoPlayerInstance.destroy === 'function') {
          videoPlayerInstance.destroy();
        }
      } catch (e) {
        console.error("Error destroying video player instance:", e);
      }
      videoPlayerInstance = null;
    }

    const modalBody = modal.querySelector('.player-modal-body');
    const playerType = (localDb.settings && localDb.settings.playerType) || 'plyr';

    if (modalBody) {
      if (playerType === 'artplayer') {
        modalBody.innerHTML = '<div id="embedded-artplayer" style="width: 100%; height: 100%; display: block; outline: none;"></div>';
      } else {
        modalBody.innerHTML = '<video id="embedded-video-player" controls autoplay style="width: 100%; height: 100%; display: block; outline: none;"></video>';
      }
    }

    if (playerType === 'artplayer' && typeof Artplayer !== 'undefined') {
      videoPlayerInstance = new Artplayer({
        container: '#embedded-artplayer',
        url: streamUrl,
        autoplay: true,
        autoSize: false,
        autoMini: false,
        playbackRate: true,
        aspectRatio: true,
        setting: true,
        hotkey: true,
        pip: true,
        fullscreen: true,
        mutex: true,
        theme: '#ff0055',
      });

      // Volume wheel control on ArtPlayer
      const artContainer = document.getElementById('embedded-artplayer');
      if (artContainer) {
        artContainer.addEventListener('wheel', (e) => {
          e.preventDefault();
          let currentVolume = videoPlayerInstance.volume;
          if (e.deltaY < 0) {
            videoPlayerInstance.volume = Math.min(1, currentVolume + 0.01);
          } else {
            videoPlayerInstance.volume = Math.max(0, currentVolume - 0.01);
          }
        }, { passive: false });
      }

      // Restore playback watch position and track time using raw video element
      videoPlayerInstance.on('ready', () => {
        const rawVideo = videoPlayerInstance.video;
        if (rawVideo) {
          rawVideo.addEventListener('timeupdate', () => {
            if (!currentPlayingVideoId) return;
            const currentTime = rawVideo.currentTime;
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
            const resumeData = JSON.parse(localStorage.getItem('haytool_playback_resume') || '{}');
            const savedTime = resumeData[currentPlayingVideoId];
            if (savedTime && savedTime > 0) {
              rawVideo.currentTime = savedTime;
            }
            seekedForCurrentVideo = true;
          }
        }
      });

    } else {
      const player = document.getElementById('embedded-video-player');
      if (player) {
        if (playerType === 'plyr' && typeof Plyr !== 'undefined') {
          player.src = streamUrl;
          videoPlayerInstance = new Plyr('#embedded-video-player', {
            iconUrl: '/plyr.svg',
            controls: [
              'play-large', 'restart', 'rewind', 'play', 'fast-forward',
              'progress', 'current-time', 'duration', 'mute', 'volume',
              'settings', 'pip', 'fullscreen'
            ],
            settings: ['speed', 'loop'],
            speed: { selected: 1, options: [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2] }
          });

          // Volume wheel control
          const plyrContainer = modal.querySelector('.plyr');
          if (plyrContainer) {
            plyrContainer.addEventListener('wheel', (e) => {
              e.preventDefault();
              let currentVolume = videoPlayerInstance.volume;
              if (e.deltaY < 0) {
                videoPlayerInstance.volume = Math.min(1, currentVolume + 0.01);
              } else {
                videoPlayerInstance.volume = Math.max(0, currentVolume - 0.01);
              }
            }, { passive: false });
          }

          // İzleme süresini tarayıcı belleğine kaydet
          videoPlayerInstance.on('timeupdate', () => {
            if (!currentPlayingVideoId) return;
            const currentTime = videoPlayerInstance.currentTime;
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

          // Kaldığı yerden oynatmaya devam et
          videoPlayerInstance.on('canplay', () => {
            if (!seekedForCurrentVideo && currentPlayingVideoId) {
              const resumeData = JSON.parse(localStorage.getItem('haytool_playback_resume') || '{}');
              const savedTime = resumeData[currentPlayingVideoId];
              if (savedTime && savedTime > 0) {
                videoPlayerInstance.currentTime = savedTime;
              }
              seekedForCurrentVideo = true;
            }
          });

          videoPlayerInstance.play().catch(err => {
            console.warn('Otomatik oynatma engellendi:', err);
          });
        } else {
          // Standart HTML5 Video Player
          player.src = streamUrl;
          player.controls = true;

          // Volume wheel control
          player.addEventListener('wheel', (e) => {
            e.preventDefault();
            let currentVolume = player.volume;
            if (e.deltaY < 0) {
              player.volume = Math.min(1, currentVolume + 0.01);
            } else {
              player.volume = Math.max(0, currentVolume - 0.01);
            }
          }, { passive: false });

          // İzleme süresini tarayıcı belleğine kaydet
          player.addEventListener('timeupdate', () => {
            if (!currentPlayingVideoId) return;
            const currentTime = player.currentTime;
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

          // Kaldığı yerden oynatmaya devam et
          player.addEventListener('canplay', () => {
            if (!seekedForCurrentVideo && currentPlayingVideoId) {
              const resumeData = JSON.parse(localStorage.getItem('haytool_playback_resume') || '{}');
              const savedTime = resumeData[currentPlayingVideoId];
              if (savedTime && savedTime > 0) {
                player.currentTime = savedTime;
              }
              seekedForCurrentVideo = true;
            }
          });

          player.load();
          player.play().catch(err => {
            console.warn('Otomatik oynatma engellendi:', err);
          });
        }
      }
    }
  }
};

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
  if (modal) {
    modal.classList.add('hidden');
    modal.classList.remove('is-short-player');
    modal.classList.remove('minimized');
  }
  if (videoPlayerInstance) {
    try {
      if (typeof videoPlayerInstance.destroy === 'function') {
        videoPlayerInstance.destroy();
      }
    } catch (e) {
      console.error("Error destroying video player instance on close:", e);
    }
    videoPlayerInstance = null;
  }
  const modalBody = document.querySelector('.player-modal-body');
  if (modalBody) {
    modalBody.innerHTML = '<video id="embedded-video-player" controls autoplay style="width: 100%; height: 100%; display: block; outline: none;"></video>';
  }
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
let downloadedSortVal = 'date-desc';
document.addEventListener('click', (e) => {
  const btn = e.target.closest('.sort-btn');
  if (btn && btn.closest('#downloaded-sort-group')) {
    const sortVal = btn.getAttribute('data-sort');
    downloadedSortVal = sortVal;
    
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

// Aktif İndirme İptal Butonu Dinleyicisi
document.addEventListener('DOMContentLoaded', () => {
  const cancelActiveBtn = document.getElementById('cancel-active-btn');
  if (cancelActiveBtn) {
    cancelActiveBtn.addEventListener('click', () => {
      const activeDownload = localDb.history.find(h => h.status === 'downloading');
      if (activeDownload) {
        cancelDownload(activeDownload.id);
      } else {
        showToast('Şu anda aktif bir indirme bulunmuyor.', 'info');
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

// Başlangıç
connectSSE();
updateDiskSpace();
setInterval(updateDiskSpace, 60 * 60 * 1000); // Her 60 dakikada bir güncelle

// Türkçe Açıklama: Sayfa yüklendiğinde mevcut URL path'ine göre doğru sekmeyi aktif ediyoruz.
const currentPath = window.location.pathname;
const initialTab = pathTabMap[currentPath] || 'history';
history.replaceState({ tab: initialTab }, '', currentPath === '/' ? '/home' : currentPath);
switchTab(initialTab, false);

lucide.createIcons();
