/**
 * HaYTooL YouTube Downloader - İstemci Mantığı (Frontend)
 * 
 * Yapımcı: HaYTo
 * İletişim: korazhayto@gmail.com
 */

import { translations } from './utils/i18n.js';
import { escapeHtml, formatDate, getDaysAgoText, parseSizeToBytes, isShortVideo, parseTimeToSeconds, formatDescriptionTimestamps, parseLikes, parseRelativeTime, debounce, isMembersOnlyVideo } from './utils/helpers.js';
import { showToast } from './components/toast.js';
import { renderVideoGrid } from './components/videoCard.js';
import { renderChannelsList } from './components/channelRow.js';

// Geliştirici log kontrolü. Localhost haricinde tarayıcı konsol çıktısını devre dışı bırakır.
const isDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
function devLog(...args) {
  if (isDev) console.log('[DEV]', ...args);
}
function devWarn(...args) {
  if (isDev) console.warn('[DEV_WARN]', ...args);
}


// Expose to window for inline event handlers and global state
window.escapeHtml = escapeHtml;
window.formatDate = formatDate;
window.getDaysAgoText = getDaysAgoText;
window.isShortVideo = isShortVideo;
window.showToast = showToast;
window.translations = translations;
window.renderVideoGrid = renderVideoGrid;
window.renderChannelsList = renderChannelsList;
window.devLog = devLog;
window.devWarn = devWarn;

/**
 * İndirme motorunu ve askıdaki tüm süreç kilitlerini manuel olarak sıfırlar (Restart ihtiyacını kaldırır).
 */
window.resetDownloadEngine = async function() {
  const currentLang = localStorage.getItem('haytool_user_lang') || 'tr';
  const t = translations[currentLang] || translations.tr;
  const msg = t.reset_engine_confirm || 'İndirme motoru ve askıdaki süreç kilitleri sıfırlanacak. Devam etmek istiyor musunuz?';
  if (!confirm(msg)) return;

  try {
    const res = await fetch('/api/queue/reset-engine', { method: 'POST' });
    const data = await res.json();
    if (data.success) {
      showToast(t.reset_engine_success || 'İndirme motoru başarıyla sıfırlandı.', 'success');
    } else {
      showToast(data.error || 'Sıfırlama sırasında bir hata oluştu.', 'error');
    }
  } catch (err) {
    showToast(`Hata: ${err.message}`, 'error');
  }
};
let localDb = { channels: [], history: [], settings: {} };
window.localDb = localDb;
let eventSource = null;
let currentLang = 'tr';
window.isDownloadedBulkDeleteMode = false;
window.isHistoryBulkHideMode = false;
window.historyFilterChannel = 'all';
window.downloadedFilterChannel = 'all';
window.historyFilterDays = 'all';
window.historyOnlyNoAutoDownload = false;
window.historyOnlyNotDownloaded = false;
window.historyShowHidden = false;
window.historyViewMode = 'grid';
window.downloadedViewMode = 'grid';

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

;

// Türkçe Açıklama: Seçilen dil paketine (TR veya EN) göre sayfadaki tüm metin etiketlerini ve açıklamaları dinamik olarak günceller.
/**
 * Arayüz dilini seçilen dile göre günceller.
 * 
 * @param {string} lang Seçilen dil kodu ('tr' veya 'en')
 */
function applyLanguage(lang) {
  currentLang = lang || localStorage.getItem('haytool_user_lang') || 'tr';
  try { localStorage.setItem('haytool_user_lang', currentLang); } catch (e) {}
  const t = translations[currentLang] || translations.tr;
  
  const el = (id, key, prop = 'textContent') => {
    const element = document.getElementById(id);
    const val = t[key] || (translations.tr && translations.tr[key]);
    if (element && val) {
      element[prop] = val;
    }
  };
  
  const elQuery = (selector, key, prop = 'textContent') => {
    const element = document.querySelector(selector);
    const val = t[key] || (translations.tr && translations.tr[key]);
    if (element && val) {
      element[prop] = val;
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
  elQuery('#btn-update-all-subs-text', 'btn_update_all_subscribers');

  // İndirme Sırası Sekmesi
  elQuery('#tab-queue-title', 'tab_queue_title');
  elQuery('#tab-queue-desc', 'tab_queue_desc');
  el('lbl-queue-view-table', 'queue_view_table');
  el('lbl-queue-view-cards', 'queue_view_cards');
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
  elQuery('#queue-completed-title', 'queue_completed_title');

  // Kütüphane Sekmesi
  elQuery('label[for="history-show-shorts"] + span', 'show_shorts');
  el('lbl-history-only-no-auto-download', 'lbl_history_only_no_auto_download');
  el('lbl-history-only-not-downloaded', 'lbl_history_only_not_downloaded');
  el('lbl-history-show-members', 'lbl_history_show_members');

  el('opt-date-all', 'filter_all');
  el('opt-date-today', 'filter_today');
  el('opt-date-yesterday', 'filter_yesterday');
  el('opt-date-2days', 'filter_last_2_days');
  el('opt-date-3days', 'filter_last_3_days');
  el('opt-date-4days', 'filter_last_4_days');
  el('opt-date-5days', 'filter_last_5_days');
  elQuery('#view-grid-btn span', 'view_grid');
  elQuery('#view-list-btn span', 'view_list');

  // İndirilen Videolar Sekmesi
  elQuery('#tab-downloaded .content-header h2', 'downloaded_title');
  elQuery('#tab-downloaded .content-header p', 'downloaded_desc');
  elQuery('#tab-downloaded .content-header button span', 'btn_open_downloads');
  elQuery('label[for="downloaded-show-shorts"]:not(.toggle-label)', 'show_shorts');
  elQuery('#downloaded-view-grid-btn span', 'view_grid');
  elQuery('#downloaded-view-list-btn span', 'view_list');
  elQuery('#inline-btn-description', 'inline_btn_description', 'title');
  elQuery('#description-title-text', 'inline_description_title');
  el('btn-update-metadata-dl', 'btn_update_metadata_dl');
  el('btn-bulk-delete-dl-toggle', 'btn_bulk_delete_dl_toggle');

  // Ayarlar Sekmesi Kart Başlıkları
  el('settings-title-general-text', 'settings_title_general_text');
  el('settings-title-media-text', 'settings_title_media_text');
  el('settings-title-system-text', 'settings_title_system_text');
  el('settings-title-download-text', 'settings_title_download_text');
  el('settings-title-notifications-text', 'settings_title_notifications_text');
  el('settings-title-automation-text', 'settings_title_automation_text');

  elQuery('#tab-settings .content-header h2', 'settings_title');
  elQuery('#tab-settings .content-header p', 'settings_desc');
  elQuery('label[for="settings-download-path"]', 'label_download_path');
  elQuery('#select-folder-btn span', 'btn_select_folder');
  elQuery('#test-folder-btn span', 'btn_test_folder');
  el('label-youtube-auth-title', 'label_youtube_auth_title');
  el('cookie-tray-hint', 'cookie_tray_hint', 'innerHTML');
  el('btn-text-test-cookies', 'btn_text_test_cookies');
  el('btn-text-logout-youtube', 'btn_text_logout_youtube');
  el('cookie-info-title', 'cookie_info_title');
  el('cookie-info-desc', 'cookie_info_desc');
  el('text-autosync-watchtime-title', 'text_autosync_watchtime_title');
  el('desc-autosync-watchtime', 'desc_autosync_watchtime');
  el('text-auto-disk-sync-title', 'text_auto_disk_sync_title');
  el('desc-auto-disk-sync', 'desc_auto_disk_sync');
  el('btn-sync-disk-now-text', 'btn_sync_disk_now');
  elQuery('label[for="settings-quality"]', 'label_quality');
  elQuery('label[for="settings-mergetype"]', 'label_merge_type');
  elQuery('label[for="settings-channelcheckinterval"]', 'label_interval');
  el('label-live-stream-handling', 'label_live_stream_handling');
  el('label-live-stream-retry-interval', 'label_live_stream_retry_interval');
  el('opt-live-instant-retry', 'opt_live_instant_retry');
  el('opt-live-vod-only', 'opt_live_vod_only');
  el('opt-live-ignore', 'opt_live_ignore');
  elQuery('label[for="settings-autodownload"]:not(.toggle-label)', 'label_auto_download');
  elQuery('label[for="settings-autodownload"] + span', 'desc_auto_download');
  elQuery('label[for="settings-writethumbnail"]:not(.toggle-label)', 'label_write_thumbnail');
  elQuery('label[for="settings-writethumbnail"] + span', 'desc_write_thumbnail');
  elQuery('label[for="settings-showshorts"]:not(.toggle-label)', 'label_show_shorts');
  elQuery('label[for="settings-showshorts"] + span', 'desc_show_shorts');
  elQuery('label[for="settings-hideondelete"]:not(.toggle-label)', 'label_hide_on_delete');
  elQuery('label[for="settings-hideondelete"] + span', 'desc_hide_on_delete');
  elQuery('label[for="settings-theme"]', 'label_theme');
  el('opt-theme-dark', 'opt_theme_dark');
  el('opt-theme-light', 'opt_theme_light');
  el('opt-theme-matrix', 'opt_theme_matrix');
  el('opt-theme-discord', 'opt_theme_discord');
  el('opt-theme-youtube', 'opt_theme_youtube');

  elQuery('label[for="settings-autodelete"]', 'label_auto_delete');
  elQuery('label[for="settings-rsslimit"]', 'label_rss_limit');
  elQuery('label[for="settings-speedlimit"]', 'label_settings_speed_limit');
  el('label-settings-alt-speed-limit-text', 'label_settings_alt_speed_limit');
  elQuery('label[for="settings-port"]', 'label_port');
  elQuery('label[for="settings-playsounds"]:not(.toggle-label)', 'label_play_sounds');
  elQuery('label[for="settings-playsounds"] + span', 'desc_play_sounds');
  elQuery('label[for="settings-shownotifications"]:not(.toggle-label)', 'label_show_notifications');
  elQuery('label[for="settings-shownotifications"] + span', 'desc_show_notifications');
  elQuery('label[for="settings-autoopenbrowser"]:not(.toggle-label)', 'label_auto_open_browser');
  elQuery('label[for="settings-autoopenbrowser"] + span', 'desc_auto_open_browser');
  elQuery('label[for="settings-checkonstartup"]', 'label_check_on_startup');
  elQuery('label[for="settings-checkonstartup"] + span', 'desc_check_on_startup');
  elQuery('label[for="settings-discordrpc"]:not(.toggle-label)', 'label_discord_rpc');
  elQuery('label[for="settings-discordrpc"] + span', 'desc_discord_rpc');
  elQuery('#btn-search-channel-text', 'btn_search_channel');
  elQuery('#btn-add-channel-text', 'btn_add_channel');
  el('text-filter-auto-title', 'filter_auto_download_title');
  el('opt-filter-auto-all', 'filter_all');
  el('opt-filter-auto-enabled', 'filter_auto_download_on');
  el('opt-filter-auto-disabled', 'filter_auto_download_off');
  el('text-filter-shorts-title', 'filter_shorts_download_title');
  el('opt-filter-shorts-all', 'filter_all');
  el('opt-filter-shorts-enabled', 'filter_shorts_on');
  el('opt-filter-shorts-disabled', 'filter_shorts_off');
  const searchInputEl = document.getElementById('channel-list-search-input');
  if (searchInputEl) {
    searchInputEl.placeholder = t.filter_channels_search_placeholder || 'Kanal listesinde ara...';
  }
  elQuery('label[for="settings-lang"]', 'label_lang');
  el('label-temp-dir-type', 'label_temp_dir_type');
  el('desc-temp-dir-type', 'desc_temp_dir_type');
  el('opt-temp-local', 'opt_temp_local');
  el('opt-temp-system', 'opt_temp_system');
  el('btn-open-temp-text', 'btn_open_temp_text');
  el('label-duration-fetch-method', 'label_duration_fetch_method');
  el('opt-duration-auto', 'opt_duration_auto');
  el('opt-duration-waterfall', 'opt_duration_waterfall');
  el('opt-duration-ytdlp', 'opt_duration_ytdlp');
  el('desc-duration-method-info', 'desc_duration_method_info', 'innerHTML');
  el('label-ytdlp-run-mode', 'label_ytdlp_run_mode');
  el('opt-ytdlp-exe', 'opt_ytdlp_exe');
  el('opt-ytdlp-python', 'opt_ytdlp_python');
  el('desc-ytdlp-mode-info', 'desc_ytdlp_mode_info', 'innerHTML');
  el('label-python-cmd', 'label_python_cmd');
  el('desc-python-cmd', 'desc_python_cmd', 'innerHTML');
  el('btn-download-python-text', 'btn_download_python_text');
  el('btn-install-pip-text', 'btn_install_pip_text');
  el('label-preferred-audio-lang', 'label_preferred_audio_lang');
  el('desc-preferred-audio-lang', 'desc_preferred_audio_lang');
  el('label-ytdlp-version', 'label_ytdlp_version');
  el('ytdlp-version-prefix', 'ytdlp_version_prefix');
  el('ytdlp-latest-version-prefix', 'ytdlp_latest_version_prefix');
  el('opt-ytdlp-nightly', 'opt_ytdlp_nightly');
  el('opt-ytdlp-stable', 'opt_ytdlp_stable');
  el('btn-ytdlp-update-text', 'btn_ytdlp_update_text');
  el('desc-ytdlp-version', 'desc_ytdlp_version', 'innerHTML');

  // Hava Durumu Çevirileri
  el('badge-weather', 'badge_weather_title', 'title');
  el('label-weather-title', 'label_weather_title');
  el('label-weather-city', 'label_weather_city');
  el('desc-weather-city', 'desc_weather_city');
  el('btn-weather-search-text', 'btn_weather_search_text');
  el('label-weather-unit', 'label_weather_unit');
  el('desc-weather-unit', 'desc_weather_unit');
  el('opt-weather-celsius', 'opt_weather_celsius');
  el('opt-weather-fahrenheit', 'opt_weather_fahrenheit');
  el('label-weather-lat', 'label_weather_lat');
  el('desc-weather-lat', 'desc_weather_lat');
  el('label-weather-lon', 'label_weather_lon');
  el('desc-weather-lon', 'desc_weather_lon');

  // Sistem Veritabanı & Ayar Yedekleme Kartı Çevirileri
  el('settings-title-backup-text', 'settings_title_backup_text');
  el('desc-system-backup-info', 'desc_system_backup_info');
  el('backup-auto-info-title', 'backup_auto_info_title');
  el('backup-auto-info-desc', 'backup_auto_info_desc');
  el('label-local-backup-title', 'label_local_backup_title');
  el('label-backup-policy-badge', 'label_backup_policy_badge');
  el('btn-create-backup-text', 'btn_create_backup_text');
  el('btn-upload-backup-text', 'btn_upload_backup_text');
  el('btn-list-backups-text', 'btn_list_backups_text');
  el('text-gist-sync-title', 'text_gist_sync_title');
  el('desc-gist-sync-info', 'desc_gist_sync_info');
  el('label-gist-token', 'label_gist_token');
  el('label-gist-id', 'label_gist_id');
  el('btn-gist-get-token-text', 'btn_gist_get_token_text');
  el('btn-gist-save-text', 'btn_gist_save_text');
  el('btn-gist-test-text', 'btn_gist_test_text');
  el('btn-gist-push-text', 'btn_gist_push_text');
  el('btn-gist-pull-text', 'btn_gist_pull_text');
  el('btn-gist-push-registered-text', 'btn_gist_push_text');
  el('btn-gist-pull-registered-text', 'btn_gist_pull_text');
  el('gist-status-connected-text', 'gist_status_connected_text');
  el('text-gist-online-link', 'text_gist_online_link');
  el('btn-gist-delete-text', 'btn_gist_delete_text');
  el('label-gist-auto-sync', 'label_gist_auto_sync');
  el('label-ffmpeg-status-text', 'label_ffmpeg_status_text');
  if (typeof checkFfmpegStatus === 'function') {
    checkFfmpegStatus();
  }
  elQuery('label[for="settings-playsounds"] + span', 'desc_play_sounds');
  elQuery('label[for="settings-shownotifications"]:not(.toggle-label)', 'label_show_notifications');
  elQuery('label[for="settings-shownotifications"] + span', 'desc_show_notifications');
  elQuery('label[for="settings-autoopenbrowser"]:not(.toggle-label)', 'label_auto_open_browser');
  elQuery('label[for="settings-autoopenbrowser"] + span', 'desc_auto_open_browser');
  elQuery('label[for="settings-checkonstartup"]', 'label_check_on_startup');
  elQuery('label[for="settings-checkonstartup"] + span', 'desc_check_on_startup');
  elQuery('label[for="settings-discordrpc"]:not(.toggle-label)', 'label_discord_rpc');
  elQuery('label[for="settings-discordrpc"] + span', 'desc_discord_rpc');
  elQuery('#btn-search-channel-text', 'btn_search_channel');
  elQuery('#btn-add-channel-text', 'btn_add_channel');
  elQuery('label[for="settings-lang"]', 'label_lang');
  el('label-temp-dir-type', 'label_temp_dir_type');
  el('desc-temp-dir-type', 'desc_temp_dir_type');
  el('opt-temp-local', 'opt_temp_local');
  el('opt-temp-system', 'opt_temp_system');
  el('btn-open-temp-text', 'btn_open_temp_text');
  el('label-duration-fetch-method', 'label_duration_fetch_method');
  el('opt-duration-auto', 'opt_duration_auto');
  el('opt-duration-waterfall', 'opt_duration_waterfall');
  el('opt-duration-ytdlp', 'opt_duration_ytdlp');
  el('desc-duration-method-info', 'desc_duration_method_info', 'innerHTML');
  el('label-ytdlp-run-mode', 'label_ytdlp_run_mode');
  el('opt-ytdlp-exe', 'opt_ytdlp_exe');
  el('opt-ytdlp-python', 'opt_ytdlp_python');
  el('desc-ytdlp-mode-info', 'desc_ytdlp_mode_info', 'innerHTML');
  el('label-python-cmd', 'label_python_cmd');
  el('desc-python-cmd', 'desc_python_cmd', 'innerHTML');
  el('btn-download-python-text', 'btn_download_python_text');
  el('btn-install-pip-text', 'btn_install_pip_text');
  el('label-preferred-audio-lang', 'label_preferred_audio_lang');
  el('desc-preferred-audio-lang', 'desc_preferred_audio_lang');
  
  // Tepsi Çift Tıklama Eylemi çevirileri
  el('label-doubleclickaction', 'label_doubleclickaction');
  el('desc-doubleclickaction', 'desc_doubleclickaction');
  el('opt-doubleclick-system', 'opt_doubleclick_system');
  el('opt-doubleclick-embedded', 'opt_doubleclick_embedded');
  el('opt-doubleclick-player', 'opt_doubleclick_player');
  
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

  el('label-alt-thumbnails-hover', 'label_alt_thumbnails_hover');
  el('desc-alt-thumbnails-hover', 'desc_alt_thumbnails_hover');

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
  const inlineBtnSyncWatchtime = document.getElementById('inline-btn-sync-watchtime');
  if (inlineBtnSyncWatchtime) {
    inlineBtnSyncWatchtime.title = t.inline_btn_sync_watchtime;
    inlineBtnSyncWatchtime.setAttribute('aria-label', t.inline_btn_sync_watchtime);
  }
  el('text-autosync-watchtime-title', 'text_autosync_watchtime_title');
  el('desc-autosync-watchtime', 'desc_autosync_watchtime');

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
  el('label-delete-file-modal', 'label_delete_file_modal');
  el('label-mark-watched-modal', 'label_mark_watched_modal');
  
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
  el('opt-theme-matrix', 'opt_theme_matrix');
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
  el('desc-system-backup-info', 'desc_system_backup_info');
  el('backup-auto-info-title', 'backup_auto_info_title');
  el('backup-auto-info-desc', 'backup_auto_info_desc');
  el('label-backup-policy-badge', 'label_backup_policy_badge');
  el('btn-export-text', 'btn_export_backup');
  el('btn-import-text', 'btn_import_backup');
  el('opt-import-append', 'opt_import_append');
  el('opt-import-overwrite', 'opt_import_overwrite');
  el('label-ytdlp-version', 'label_ytdlp_version');
  el('desc-ytdlp-version', 'desc_ytdlp_version');
  el('btn-ytdlp-update-text', 'btn_ytdlp_update');
  el('ytdlp-version-prefix', 'ytdlp_version_prefix');
  el('ytdlp-latest-version-prefix', 'ytdlp_latest_version_prefix');


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

  // Tools ve Downloader i18n Güncellemeleri
  el('nav-tools-text', 'nav_tools_text');
  el('nav-hdown-pd-text', 'nav_hdown_pd');
  el('nav-hdown-downloader-text', 'nav_hdown_downloader');
  el('nav-tools-compare-text', 'compare_title');
  el('nav-tools-categories-text', 'category_manage_title');
  el('nav-tools-ape-text', 'nav_tools_ape');




  // Süre Filtresi i18n
  const durationSelect = document.getElementById('history-duration-filter');
  if (durationSelect && durationSelect.options.length >= 11) {
    durationSelect.options[0].text = t.duration_filter_off || 'Kapalı';
    durationSelect.options[1].text = t.duration_filter_1 || '< 1 dk';
    durationSelect.options[2].text = t.duration_filter_2 || '< 2 dk';
    durationSelect.options[3].text = t.duration_filter_3 || '< 3 dk';
    durationSelect.options[4].text = t.duration_filter_4 || '< 4 dk';
    durationSelect.options[5].text = t.duration_filter_5 || '< 5 dk';
    durationSelect.options[6].text = t.duration_filter_10 || '< 10 dk';
    durationSelect.options[7].text = t.duration_filter_15 || '< 15 dk';
    durationSelect.options[8].text = t.duration_filter_20 || '< 20 dk';
    durationSelect.options[9].text = t.duration_filter_25 || '< 25 dk';
    durationSelect.options[10].text = t.duration_filter_30 || '< 30 dk';
  }

  // Toplu Silme Kartı i18n
  el('tools-bulk-delete-title', 'bulk_delete_title');
  el('tools-bulk-delete-files-label', 'bulk_delete_also_file');
  el('tools-bulk-delete-select-all-label', 'bulk_delete_select_all');
  el('tools-bulk-delete-btn-text', 'bulk_delete_btn');
  el('tools-bulk-delete-selected-text', 'bulk_delete_selected_text');

  // Kütüphane Toplu Gizleme Barı i18n
  el('btn-bulk-hide-history-toggle', 'history_bulk_hide_toggle');
  el('lbl-history-bh-select-all', 'history_bulk_hide_select_all');
  el('lbl-history-bh-selected-count', 'history_bulk_hide_selected_count');
  el('lbl-history-bh-execute', 'history_bulk_hide_execute');
  el('lbl-history-bh-cancel', 'history_bulk_hide_cancel');


  // Kategori Yönetimi i18n
  // Araçlar Akordiyon & Sayfa Başlıkları i18n
  el('tools-main-title', 'nav_tools');
  el('tools-accordion-compare-title', 'tools_compare_accordion_title');
  el('tools-accordion-categories-title', 'category_manage_title');
  el('tools-accordion-ape-title', 'ape_accordion_title');

  // Kategori Yönetimi i18n
  el('tools-categories-desc', 'category_manage_desc');
  
  const newCatInput = document.getElementById('new-category-input');
  if (newCatInput) {
    newCatInput.placeholder = t.category_name_placeholder || 'Yeni kategori adı yazın...';
  }
  el('btn-add-category-text', 'btn_add_category');
  el('col-category-id', 'category_id_col');
  el('col-category-name', 'category_name_col');
  el('col-category-actions', 'category_actions_col');

  // APE Aracı i18n
  el('tools-ape-title', 'ape_title');
  el('tools-ape-badge', 'ape_badge');
  el('tools-ape-desc', 'ape_desc');
  const apeInputEl = document.getElementById('ape-target-input');
  if (apeInputEl) {
    apeInputEl.placeholder = t.ape_input_placeholder || 'YouTube Video veya Kanal Linki / ID girin (Örn: https://youtu.be/... veya @KanalAdi)';
  }
  el('btn-ape-mark-text', 'btn_ape_mark_text');
  el('label-ape-sync-youtube', 'label_ape_sync_youtube');



  el('downloader-header-title', 'downloader_title');
  el('downloader-header-desc', 'downloader_desc');
  el('downloader-format-label', 'downloader_format_label');
  el('downloader-bitrate-label-text', 'downloader_bitrate_label');
  el('downloader-info-text', 'downloader_no_channel_folder');
  el('downloader-start-btn-text', 'downloader_start_btn');
  el('downloader-playlist-title-text', 'downloader_playlist_title');
  el('downloader-download-all-text', 'downloader_download_all');

  const urlInput = document.getElementById('downloader-url-input');
  if (urlInput && t.downloader_url_placeholder) {
    urlInput.placeholder = t.downloader_url_placeholder;
  }

  // Format seçeneklerinin metinlerini güncelle
  const formatSelect = document.getElementById('downloader-format-select');
  if (formatSelect && formatSelect.options.length >= 8) {
    formatSelect.options[0].text = t.downloader_format_video_best || 'En İyi Kalite (Best)';
    formatSelect.options[1].text = t.downloader_format_video_1080p || '1080p FHD';
    formatSelect.options[2].text = t.downloader_format_video_720p || '720p HD';
    formatSelect.options[3].text = t.downloader_format_video_480p || '480p';
    formatSelect.options[4].text = t.downloader_format_video_360p || '360p';
    formatSelect.options[5].text = t.downloader_format_video_240p || '240p';
    formatSelect.options[6].text = t.downloader_format_video_144p || '144p';
    formatSelect.options[7].text = t.downloader_format_audio_mp3 || 'MP3';
  }

  // Bitrate seçeneklerinin metinlerini güncelle
  const bitrateSelect = document.getElementById('downloader-bitrate-select');
  if (bitrateSelect && bitrateSelect.options.length >= 3) {
    bitrateSelect.options[0].text = t.downloader_bitrate_320 || '320 kbps (En Yüksek)';
    bitrateSelect.options[1].text = t.downloader_bitrate_192 || '192 kbps (Önerilen)';
    bitrateSelect.options[2].text = t.downloader_bitrate_128 || '128 kbps';
  }
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
  
  // İndirilenler sekmesinden çıkış yapılıyorsa ve video oynatılıyorsa mini oynatıcıya KESİNTİSİZ (0ms) geç
  if (activeTab === 'downloaded' && targetTab !== 'downloaded') {
    const inlineContainer = document.getElementById('downloaded-inline-player-container');
    const isInlineOpen = inlineContainer && !inlineContainer.classList.contains('hidden');
    if (isInlineOpen && currentPlayingVideoId) {
      const video = (localDb.history || []).find(h => h.id === currentPlayingVideoId);
      const isShort = isShortVideo(video?.duration, video?.title, video?.channelId);
      
      const inlineBody = document.getElementById('inline-player-body');
      const modal = document.getElementById('player-modal');
      const modalBody = modal ? modal.querySelector('.player-modal-body') : null;
      const modalTitle = document.getElementById('player-modal-title');
      const modalLogo = document.getElementById('player-modal-logo');

      if (modal && modalBody && inlineBody && inlineBody.firstElementChild) {
        // Modal başlık ve logoyu güncelle
        if (modalTitle) modalTitle.textContent = video ? video.title : 'Gömülü Video Oynatıcı';
        if (modalLogo && video?.channelId) {
          modalLogo.src = `/api/channels/${video.channelId}/avatar`;
          modalLogo.style.display = 'block';
        } else if (modalLogo) {
          modalLogo.style.display = 'none';
        }

        // Canlı DOM elementini (Artplayer veya Plyr/Video) doğrudan modala taşı
        while (inlineBody.firstChild) {
          modalBody.appendChild(inlineBody.firstChild);
        }

        // Yerleşik alanı gizle
        inlineContainer.classList.add('hidden');
        const listContainer = document.getElementById('downloaded-list-container');
        if (listContainer) listContainer.classList.remove('hidden');

        // Modalı göster ve boyutlandır
        modal.classList.remove('hidden');
        if (typeof resetAndApplyPlayerDimensions === 'function') {
          resetAndApplyPlayerDimensions(isShort, true); // Minimized modunda aç
        }

        const minBtn = document.getElementById('minimize-player-modal-btn');
        if (minBtn) {
          const icon = minBtn.querySelector('i') || minBtn.querySelector('[data-lucide]');
          if (icon) icon.setAttribute('data-lucide', 'maximize-2');
          minBtn.title = localDb.settings && localDb.settings.lang === 'en' ? 'Maximize' : 'Büyüt';
        }
        try {
          if (typeof lucide !== 'undefined') lucide.createIcons();
        } catch (e) {}

        if (videoPlayerInstance && typeof videoPlayerInstance.resize === 'function') {
          setTimeout(() => videoPlayerInstance.resize(), 50);
        }

        performTabSwitchUI(targetTab);

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
  
  // Başka sekmeden İndirilenler sekmesine geçiş yapılıyorsa ve modal oynatıcı açıksa
  if (targetTab === 'downloaded') {
    const modal = document.getElementById('player-modal');
    const isModalOpen = modal && !modal.classList.contains('hidden');
    if (isModalOpen && currentPlayingVideoId) {
      const video = (localDb.history || []).find(h => h.id === currentPlayingVideoId);
      const isCompleted = video && video.status === 'completed';
      const isMissing = video && video.fileMissing === true;
      const isDownloaded = isCompleted && !isMissing;
      
      if (isDownloaded) {
        const inlineContainer = document.getElementById('downloaded-inline-player-container');
        const inlineBody = document.getElementById('inline-player-body');
        const modalBody = modal.querySelector('.player-modal-body');

        if (inlineContainer && inlineBody && modalBody && modalBody.firstElementChild) {
          // Canlı DOM elementini yerleşik gövdeye geri taşı
          while (modalBody.firstChild) {
            inlineBody.appendChild(modalBody.firstChild);
          }

          modal.classList.add('hidden');
          inlineContainer.classList.remove('hidden');
          const listContainer = document.getElementById('downloaded-list-container');
          if (listContainer) listContainer.classList.add('hidden');

          performTabSwitchUI(targetTab);

          if (videoPlayerInstance && typeof videoPlayerInstance.resize === 'function') {
            setTimeout(() => videoPlayerInstance.resize(), 50);
          }

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

  if (targetTab === 'tools') {
    if (typeof loadCategoriesToTools === 'function') loadCategoriesToTools(localDb.categories);
    if (typeof showToolsSubSection === 'function') {
      showToolsSubSection(window.currentToolsSubSection || 'compare');
    }
  }

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
const historyDateFilter = document.getElementById('history-date-filter');
const viewGridBtn = document.getElementById('view-grid-btn');
const viewListBtn = document.getElementById('view-list-btn');

let historyViewMode = 'grid'; // grid veya list
let historyFilterChannel = 'all'; // all veya kanalId
let historyFilterDays = 'all'; // all, 0, 1, 2, 3, 4, 5
let historyOnlyNoAutoDownload = false;
let historyOnlyNotDownloaded = false;
let historyShowHidden = false;
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

// Türkçe Açıklama: SPA yönlendirmeleri için sekmeler arası gezinme ve HTML5 History API entegrasyonu.
const tabPathMap = {
  history: '/home',
  queue: '/download',
  downloaded: '/downlist',
  channels: '/channels',
  settings: '/settings',
  iptv: '/iptv',
  tools: '/tools',
  downloader: '/downloader'
};

const pathTabMap = {
  '/home': 'history',
  '/download': 'queue',
  '/downlist': 'downloaded',
  '/channels': 'channels',
  '/settings': 'settings',
  '/iptv': 'iptv',
  '/tools': 'tools',
  '/downloader': 'downloader'
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
  const toolsDropdown = document.getElementById('tools-dropdown');
  if (toolsDropdown) {
    if (targetTab === 'downloader' || targetTab === 'tools') {
      toolsDropdown.classList.add('active');
    } else {
      toolsDropdown.classList.remove('active');
    }
  }

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
    if (typeof renderChannels === 'function' && document.getElementById('channels-view')?.classList.contains('active')) {
      renderChannels();
    }
    if (typeof renderHistory === 'function' && document.getElementById('history-view')?.classList.contains('active')) {
      renderHistory();
    }
  });

  // İndirme İlerleme Bildirimi
  eventSource.addEventListener('progress', (e) => {
    const data = JSON.parse(e.data);
    updateActiveDownloadProgress(data);
  });

  // Kanal Tarama İlerleme Bildirimi
  eventSource.addEventListener('channel_scan_progress', (e) => {
    const data = JSON.parse(e.data);
    updateScanProgressToast(data);
  });

  // Sistem Log Bildirimi (Toast ve Masaüstü Bildirimi)
  eventSource.addEventListener('status_log', (e) => {
    const log = JSON.parse(e.data);
    showToast(log.message, log.type, log.thumbnail);

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

async function loadAppVersion() {
  try {
    const res = await fetch('/api/version');
    const data = await res.json();
    if (data && data.version) {
      const verStr = 'v' + data.version;
      
      // Topbar version badge
      const topbarVer = document.getElementById('topbar-version');
      if (topbarVer) {
        const link = topbarVer.querySelector('a');
        if (link) {
          link.textContent = verStr;
          link.href = 'https://github.com/HaYToKoRaZ/haytool-youtube-download';
        } else {
          topbarVer.textContent = verStr;
        }
      }
      
      // Settings version label
      const settingsVer = document.getElementById('settings-version');
      if (settingsVer) {
        const link = settingsVer.querySelector('a');
        if (link) {
          link.textContent = verStr;
          link.href = 'https://github.com/HaYToKoRaZ/haytool-youtube-download';
        } else {
          settingsVer.textContent = verStr;
        }
      }
    }
  } catch (err) {
    console.warn('Failed to load version:', err);
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


// Türkçe Açıklama: Sunucudan veya SSE bağlantısından gelen güncel veritabanı verilerine göre tüm ekran kartlarını, istatistikleri ve listeleri günceller.
/**
 * Veritabanı nesnesine göre arayüzdeki istatistikleri, video listelerini ve ayar formlarını günceller.
 * 
 * @param {object} db Veritabanı veri nesnesi
 */
function updateUI(db) {
  if (!db) return;
  localDb = db;
  window.localDb = db;

  if (typeof restoreHistoryFilterState === 'function') restoreHistoryFilterState();
  if (typeof restoreDownloadedFilterState === 'function') restoreDownloadedFilterState();

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
  const lang = db.settings?.lang || currentLang || 'tr';
  const t = translations[lang] || translations.tr;
  
  // YouTube Oturum ve Çerez Rozeti Durumunu Güncelle
  if (typeof window.checkYouTubeAuthStatus === 'function') {
    window.checkYouTubeAuthStatus();
  }
  
  const qualityNames = {
    best: t.status_best_quality || 'En Yüksek',
    '1080p': '1080p FHD',
    '720p': '720p HD'
  };
  if (qualityStatus && db.settings) {
    qualityStatus.textContent = qualityNames[db.settings.quality] || (t.status_automatic || 'Otomatik');
  }

  // Eşzamanlı İndirme Limiti Dropdown Eşleme
  const concurrentSelect = document.getElementById('queue-concurrent-limit');
  if (concurrentSelect && db.settings && db.settings.maxConcurrentDownloads !== undefined) {
    concurrentSelect.value = db.settings.maxConcurrentDownloads.toString();
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
    // 4. Kuyruk Listesi
    if (queueList) {
      queueList.innerHTML = '';
      const isEn = db.settings && db.settings.lang === 'en';
      const t = translations[lang] || translations.tr;
      const viewMode = (db.settings && db.settings.queueViewMode) || localStorage.getItem('haytool_queue_view_mode') || 'table';

      // Header butonlarını senkronize et
      const tableBtn = document.getElementById('queue-view-table-btn');
      const cardsBtn = document.getElementById('queue-view-cards-btn');
      if (tableBtn && cardsBtn) {
        tableBtn.classList.toggle('active', viewMode === 'table');
        cardsBtn.classList.toggle('active', viewMode === 'cards');
      }

      const mergingVideos = db.history.filter(h => h.status === 'merging');
      const downloadingVideos = db.history.filter(h => h.status === 'downloading');
      const waitingVideos = db.history.filter(h => h.status === 'waiting');
      const allActiveQueue = [...downloadingVideos, ...waitingVideos];
      
      const totalQueueCount = allActiveQueue.length + mergingVideos.length;
      const navQueueCountBadge = document.getElementById('nav-queue-count-badge');
      if (navQueueCountBadge) {
        navQueueCountBadge.textContent = totalQueueCount;
      }
      
      const statWaitingCount = document.getElementById('stat-waiting-count');
      if (statWaitingCount) {
        statWaitingCount.textContent = totalQueueCount;
      }
      
      if (allActiveQueue.length === 0 && mergingVideos.length === 0) {
        queueList.innerHTML = `
          <div class="text-center text-muted" id="queue-list-empty" style="padding: 30px 0; font-size: 0.85rem;">${isEn ? 'No videos waiting in the queue.' : 'Kuyrukta bekleyen video yok.'}</div>
        `;
      } else {
        // Tablo görünümüyse sütun başlıklarını ekle
        if (viewMode === 'table') {
          const headerEl = document.createElement('div');
          headerEl.className = 'queue-table-header';
          headerEl.innerHTML = `
            <div style="display:flex; align-items:center; gap:4px;"><span>${t.queue_col_order || '#'}</span></div>
            <div>${t.queue_col_cover || 'Kapak'}</div>
            <div>${t.queue_col_title || 'Video Başlığı'}</div>
            <div>${t.queue_col_channel || 'Kanal'}</div>
            <div>${t.queue_col_duration || 'Süre'}</div>
            <div>${t.queue_col_size || 'Boyut'}</div>
            <div style="text-align:right;">${t.queue_col_actions || 'Sıralama & İşlem'}</div>
          `;
          queueList.appendChild(headerEl);
        }

        const combinedList = [...mergingVideos, ...allActiveQueue];
        const totalItems = combinedList.length;

        combinedList.forEach((video, idx) => {
          const isMerging = video.status === 'merging';
          const isDownloading = video.status === 'downloading';
          const orderNoStr = `#${(idx + 1).toString().padStart(2, '0')}`;
          const durationStr = video.duration || '--:--';
          const sizeStr = video.fileSize || '';
          const upDisabled = (idx === 0 || isMerging) ? 'disabled' : '';
          const downDisabled = (idx === totalItems - 1 || isMerging) ? 'disabled' : '';
          const cancelOnClick = isDownloading ? `cancelDownload('${video.id}')` : `cancelQueuedVideo('${video.id}')`;

          const item = document.createElement('div');
          item.setAttribute('data-id', video.id);

          if (viewMode === 'table') {
            item.className = 'queue-table-row';
            if (isMerging) {
              item.className += ' queue-item-merging';
              item.setAttribute('draggable', 'false');
              item.style.borderColor = 'rgba(234, 179, 8, 0.3)';
              item.style.background = 'rgba(234, 179, 8, 0.03)';
            } else {
              item.setAttribute('draggable', 'true');
              if (isDownloading) {
                item.className += ' queue-item-downloading';
                item.style.borderColor = 'rgba(16, 185, 129, 0.3)';
                item.style.background = 'rgba(16, 185, 129, 0.03)';
              }
            }

            item.innerHTML = `
              <div style="display:flex; align-items:center; gap:6px;">
                <div class="queue-item-drag-handle" style="cursor: ${isMerging ? 'not-allowed' : 'grab'}; color: var(--text-muted);" title="${isMerging ? (isEn ? 'Merging process cannot be reordered' : 'Birleştirme işlemi sıralanamaz') : (t.drag_drop_hint || 'Sürükleyin')}">
                  ${isMerging ? '<i data-lucide="loader" class="spin-animation" style="width:14px; height:14px; color: #eab308;"></i>' : '<i data-lucide="grip-vertical" style="width:14px; height:14px;"></i>'}
                </div>
                <span class="queue-order-badge">${orderNoStr}</span>
              </div>
              <div class="queue-thumb-container video-thumbnail-wrapper" data-video-id="${video.id}" onmouseenter="handleThumbMouseEnter(this)" onmouseleave="handleThumbMouseLeave(this)" title="${escapeHtml(video.title)}">
                <img src="https://i.ytimg.com/vi/${video.id}/mqdefault.jpg" class="video-thumbnail queue-item-thumbnail" onerror="this.src='logo.png'">
              </div>
              <div class="queue-item-title" title="${escapeHtml(video.title)}" style="font-weight:600; color:var(--text-main); overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
                ${escapeHtml(video.title)}
              </div>
              <div class="queue-item-channel" style="color:var(--text-muted); font-size:0.75rem; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; display:flex; align-items:center; gap:4px;" title="${escapeHtml(video.channelName || '')}">
                <i data-lucide="tv" style="width:12px; height:12px; flex-shrink:0;"></i>
                <span>${escapeHtml(video.channelName || '')}</span>
              </div>
              <div>
                <span class="queue-meta-pill queue-meta-pill-duration" title="${t.queue_col_duration || 'Süre'}">
                  <i data-lucide="clock" style="width:10px; height:10px;"></i>
                  <span>${durationStr}</span>
                </span>
              </div>
              <div>
                ${sizeStr ? `
                  <span class="queue-meta-pill queue-meta-pill-size" title="${t.queue_col_size || 'Boyut'}">
                    <i data-lucide="hard-drive" style="width:10px; height:10px;"></i>
                    <span>${sizeStr}</span>
                  </span>
                ` : `
                  <span class="queue-meta-pill queue-meta-pill-calc" title="${t.queue_calculating || 'Hesaplanıyor...'}">
                    <i data-lucide="loader" class="spin-animation" style="width:10px; height:10px;"></i>
                    <span>${t.queue_calculating || 'Hesaplanıyor...'}</span>
                  </span>
                `}
              </div>
              <div style="display:flex; align-items:center; justify-content:flex-end; gap:6px;">
                ${!isMerging ? `
                <div class="queue-move-btn-group">
                  <button class="queue-move-btn queue-btn-up ${upDisabled ? 'disabled' : ''}" onclick="moveQueueItem('${video.id}', 'up')" ${upDisabled} title="${t.queue_move_up || 'Yukarı Taşı'}">
                    <i data-lucide="chevron-up" style="width:12px; height:12px;"></i>
                  </button>
                  <button class="queue-move-btn queue-btn-down ${downDisabled ? 'disabled' : ''}" onclick="moveQueueItem('${video.id}', 'down')" ${downDisabled} title="${t.queue_move_down || 'Aşağı Taşı'}">
                    <i data-lucide="chevron-down" style="width:12px; height:12px;"></i>
                  </button>
                </div>` : ''}
                ${isDownloading ? `
                  <span class="queue-item-status-badge" style="font-size:0.68rem; display:inline-flex; align-items:center; gap:4px; padding: 2px 6px; border-radius: 4px; background: rgba(16, 185, 129, 0.1); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.2); font-weight: 600;">
                    <i class="spin-animation" style="width: 8px; height: 8px; display:inline-block; border: 1.5px solid #10b981; border-top-color: transparent; border-radius:50%;"></i>
                    <span>%${video.progress || 0}</span>
                  </span>` : ''}
                ${isMerging ? `
                  <span class="queue-item-status-badge" style="font-size:0.68rem; display:inline-flex; align-items:center; gap:4px; padding: 2px 6px; border-radius: 4px; background: rgba(234, 179, 8, 0.1); color: #eab308; border: 1px solid rgba(234, 179, 8, 0.2); font-weight: 600;">
                    <i data-lucide="cog" class="spin-animation" style="width: 10px; height: 10px;"></i>
                    <span>${t.status_merging || 'Birleştiriliyor'}</span>
                  </span>` : ''}
                <button class="btn-cancel-queue" onclick="${isMerging ? `cancelDownload('${video.id}')` : cancelOnClick}" title="${isEn ? 'Cancel' : 'İptal Et'}">
                  <i data-lucide="x" style="width: 12px; height: 12px;"></i>
                  <span>${isEn ? 'Cancel' : 'İptal'}</span>
                </button>
              </div>
            `;
          } else {
            // Cards View
            item.className = 'queue-item';
            if (isMerging) {
              item.className += ' queue-item-merging';
              item.setAttribute('draggable', 'false');
              item.style.borderColor = 'rgba(234, 179, 8, 0.3)';
              item.style.background = 'rgba(234, 179, 8, 0.03)';
            } else {
              item.setAttribute('draggable', 'true');
              if (isDownloading) {
                item.className += ' queue-item-downloading';
                item.style.borderColor = 'rgba(16, 185, 129, 0.3)';
                item.style.background = 'rgba(16, 185, 129, 0.03)';
              }
            }

            item.innerHTML = `
              <div style="display:flex; align-items:center; gap:8px;">
                <div class="queue-item-drag-handle" style="cursor: ${isMerging ? 'not-allowed' : 'grab'}; color: var(--text-muted);" title="${isMerging ? (isEn ? 'Merging process cannot be reordered' : 'Birleştirme işlemi sıralanamaz') : (t.drag_drop_hint || 'Sürükleyin')}">
                  ${isMerging ? '<i data-lucide="loader" class="spin-animation" style="width:16px; height:16px; color: #eab308;"></i>' : '<i data-lucide="grip-vertical" style="width:16px; height:16px;"></i>'}
                </div>
                <span class="queue-order-badge">${orderNoStr}</span>
                ${!isMerging ? `
                <div class="queue-move-btn-group">
                  <button class="queue-move-btn queue-btn-up ${upDisabled ? 'disabled' : ''}" onclick="moveQueueItem('${video.id}', 'up')" ${upDisabled} title="${t.queue_move_up || 'Yukarı Taşı'}">
                    <i data-lucide="chevron-up" style="width:12px; height:12px;"></i>
                  </button>
                  <button class="queue-move-btn queue-btn-down ${downDisabled ? 'disabled' : ''}" onclick="moveQueueItem('${video.id}', 'down')" ${downDisabled} title="${t.queue_move_down || 'Aşağı Taşı'}">
                    <i data-lucide="chevron-down" style="width:12px; height:12px;"></i>
                  </button>
                </div>` : ''}
              </div>
              <div class="queue-thumb-container video-thumbnail-wrapper" data-video-id="${video.id}" onmouseenter="handleThumbMouseEnter(this)" onmouseleave="handleThumbMouseLeave(this)" title="${escapeHtml(video.title)}">
                <img src="https://i.ytimg.com/vi/${video.id}/mqdefault.jpg" class="video-thumbnail queue-item-thumbnail" onerror="this.src='logo.png'">
              </div>
              <div class="queue-item-info" style="flex:1; min-width:0;">
                <div class="queue-item-title" title="${escapeHtml(video.title)}" style="font-weight:600; color:var(--text-main); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; margin-bottom:4px;">
                  ${escapeHtml(video.title)}
                </div>
                <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                  <span class="queue-meta-pill queue-meta-pill-channel" title="${escapeHtml(video.channelName || '')}">
                    <i data-lucide="tv" style="width:10px; height:10px;"></i>
                    <span>${escapeHtml(video.channelName || '')}</span>
                  </span>
                  <span class="queue-meta-pill queue-meta-pill-duration" title="${t.queue_col_duration || 'Süre'}">
                    <i data-lucide="clock" style="width:10px; height:10px;"></i>
                    <span>${durationStr}</span>
                  </span>
                  ${sizeStr ? `
                    <span class="queue-meta-pill queue-meta-pill-size" title="${t.queue_col_size || 'Boyut'}">
                      <i data-lucide="hard-drive" style="width:10px; height:10px;"></i>
                      <span>${sizeStr}</span>
                    </span>
                  ` : `
                    <span class="queue-meta-pill queue-meta-pill-calc" title="${t.queue_calculating || 'Hesaplanıyor...'}">
                      <i data-lucide="loader" class="spin-animation" style="width:10px; height:10px;"></i>
                      <span>${t.queue_calculating || 'Hesaplanıyor...'}</span>
                    </span>
                  `}
                  ${isDownloading ? `
                    <span class="queue-item-status-badge" style="font-size:0.68rem; display:inline-flex; align-items:center; gap:4px; padding: 2px 6px; border-radius: 4px; background: rgba(16, 185, 129, 0.1); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.2); font-weight: 600;">
                      <i class="spin-animation" style="width: 8px; height: 8px; display:inline-block; border: 1.5px solid #10b981; border-top-color: transparent; border-radius:50%;"></i>
                      <span>%${video.progress || 0}</span>
                    </span>` : ''}
                  ${isMerging ? `
                    <span class="queue-item-status-badge" style="font-size:0.68rem; display:inline-flex; align-items:center; gap:4px; padding: 2px 6px; border-radius: 4px; background: rgba(234, 179, 8, 0.1); color: #eab308; border: 1px solid rgba(234, 179, 8, 0.2); font-weight: 600;">
                      <i data-lucide="cog" class="spin-animation" style="width: 10px; height: 10px;"></i>
                      <span>${t.status_merging || 'Birleştiriliyor'}</span>
                    </span>` : ''}
                </div>
              </div>
              <div class="queue-item-actions">
                <button class="btn-cancel-queue" onclick="${isMerging ? `cancelDownload('${video.id}')` : cancelOnClick}" title="${isEn ? 'Cancel' : 'İptal Et'}">
                  <i data-lucide="x" style="width: 12px; height: 12px;"></i>
                  <span>${isEn ? 'Cancel' : 'İptal'}</span>
                </button>
              </div>
            `;
          }

          if (!isMerging) {
            item.addEventListener('dragstart', handleDragStart);
            item.addEventListener('dragover', handleDragOver);
            item.addEventListener('drop', handleDrop);
            item.addEventListener('dragend', handleDragEnd);
          }

          queueList.appendChild(item);
        });
      }
    }

    // 4.2. Son İndirilen Videolar (Son 20)
    const queueCompletedList = document.getElementById('queue-completed-list');
    if (queueCompletedList && db.history) {
      queueCompletedList.innerHTML = '';
      const isEn = db.settings && db.settings.lang === 'en';
      const t = translations[lang] || translations.tr;
      const viewMode = (db.settings && db.settings.queueViewMode) || localStorage.getItem('haytool_queue_view_mode') || 'table';
      
      const completedVideos = db.history
        .filter(h => h.status === 'completed' && h.manualDownloader !== true)
        .sort((a, b) => new Date(b.downloadedAt || 0).getTime() - new Date(a.downloadedAt || 0).getTime())
        .slice(0, 20);

      if (completedVideos.length === 0) {
        queueCompletedList.innerHTML = `
          <div class="text-center text-muted" id="queue-completed-list-empty" style="padding: 30px 0; font-size: 0.85rem;">
            ${t.queue_completed_empty || (isEn ? 'No completed downloads yet.' : 'Henüz tamamlanan indirme yok.')}
          </div>
        `;
      } else {
        if (viewMode === 'table') {
          const compHeader = document.createElement('div');
          compHeader.className = 'queue-table-header completed-header';
          compHeader.innerHTML = `
            <div style="display:flex; align-items:center; gap:4px;"><span>${t.queue_col_order || '#'}</span></div>
            <div>${t.queue_col_cover || 'Kapak'}</div>
            <div>${t.queue_col_title || 'Video Başlığı'}</div>
            <div>${t.queue_col_channel || 'Kanal'}</div>
            <div>${t.queue_col_duration || 'Süre'}</div>
            <div>${t.queue_col_size || 'Boyut'}</div>
            <div>${t.queue_col_downloaded_at || 'İndirilme Zamanı'}</div>
            <div style="text-align:right;">${t.queue_col_actions || 'İşlemler'}</div>
          `;
          queueCompletedList.appendChild(compHeader);
        }

        completedVideos.forEach((video, idx) => {
          const item = document.createElement('div');
          item.setAttribute('data-id', video.id);
          const orderNoStr = `#${(idx + 1).toString().padStart(2, '0')}`;
          const durationStr = video.duration || '--:--';
          const sizeStr = video.fileSize || '-- MB';
          const dateStr = formatDate(video.downloadedAt || video.publishedAt);

          if (viewMode === 'table') {
            item.className = 'queue-table-row completed-row queue-item-completed';
            item.setAttribute('draggable', 'false');
            item.style.borderColor = 'rgba(16, 185, 129, 0.2)';
            item.style.background = 'rgba(16, 185, 129, 0.02)';
            item.innerHTML = `
              <div style="display:flex; align-items:center; gap:4px;">
                <span class="queue-order-badge" style="background: rgba(16, 185, 129, 0.1); color: #10b981; border-color: rgba(16, 185, 129, 0.25);">${orderNoStr}</span>
              </div>
              <div class="queue-thumb-container video-thumbnail-wrapper" data-video-id="${video.id}" onmouseenter="handleThumbMouseEnter(this)" onmouseleave="handleThumbMouseLeave(this)" title="${escapeHtml(video.title)}">
                <img src="https://i.ytimg.com/vi/${video.id}/mqdefault.jpg" class="video-thumbnail queue-item-thumbnail" onerror="this.src='logo.png'">
              </div>
              <div class="queue-item-title" title="${escapeHtml(video.title)}" style="font-weight:600; color:var(--text-main); overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
                ${escapeHtml(video.title)}
              </div>
              <div class="queue-item-channel" style="color:var(--text-muted); font-size:0.75rem; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; display:flex; align-items:center; gap:4px;" title="${escapeHtml(video.channelName || '')}">
                <i data-lucide="tv" style="width:12px; height:12px; flex-shrink:0;"></i>
                <span>${escapeHtml(video.channelName || '')}</span>
              </div>
              <div>
                <span class="queue-meta-pill queue-meta-pill-duration" title="${t.queue_col_duration || 'Süre'}">
                  <i data-lucide="clock" style="width:10px; height:10px;"></i>
                  <span>${durationStr}</span>
                </span>
              </div>
              <div>
                <span class="queue-meta-pill queue-meta-pill-size" title="${t.queue_col_size || 'Boyut'}">
                  <i data-lucide="hard-drive" style="width:10px; height:10px;"></i>
                  <span>${sizeStr}</span>
                </span>
              </div>
              <div>
                <span class="queue-meta-pill queue-meta-pill-date" title="${t.queue_col_downloaded_at || 'İndirilme Zamanı'}">
                  <i data-lucide="calendar" style="width:10px; height:10px;"></i>
                  <span>${dateStr}</span>
                </span>
              </div>
              <div style="display:flex; align-items:center; justify-content:flex-end; gap:6px;">
                <button class="btn-play-queue" onclick="playVideoEmbedded('${video.id}')" title="${isEn ? 'Play' : 'Oynat'}">
                  <i data-lucide="play" style="width:10px; height:10px;"></i>
                  <span>${isEn ? 'Play' : 'Oynat'}</span>
                </button>
                <button class="btn-cancel-queue" onclick="showDeleteModal('${video.id}')" title="${isEn ? 'Delete' : 'Sil'}" style="padding: 4px 8px;">
                  <i data-lucide="trash-2" style="width: 10px; height: 10px;"></i>
                  <span>${isEn ? 'Delete' : 'Sil'}</span>
                </button>
              </div>
            `;
          } else {
            // Cards View
            item.className = 'queue-item queue-item-completed';
            item.setAttribute('draggable', 'false');
            item.style.borderColor = 'rgba(16, 185, 129, 0.2)';
            item.style.background = 'rgba(16, 185, 129, 0.02)';
            item.innerHTML = `
              <div style="display:flex; align-items:center; gap:8px;">
                <div class="queue-item-status-icon" style="display:flex; align-items:center; justify-content:center; color:#10b981;" title="${isEn ? 'Downloaded' : 'İndirildi'}">
                  <i data-lucide="check-circle" style="width:16px; height:16px; color:#10b981;"></i>
                </div>
                <span class="queue-order-badge" style="background: rgba(16, 185, 129, 0.1); color: #10b981; border-color: rgba(16, 185, 129, 0.25);">${orderNoStr}</span>
              </div>
              <div class="queue-thumb-container video-thumbnail-wrapper" data-video-id="${video.id}" onmouseenter="handleThumbMouseEnter(this)" onmouseleave="handleThumbMouseLeave(this)" title="${escapeHtml(video.title)}">
                <img src="https://i.ytimg.com/vi/${video.id}/mqdefault.jpg" class="video-thumbnail queue-item-thumbnail" onerror="this.src='logo.png'">
              </div>
              <div class="queue-item-info" style="flex:1; min-width:0;">
                <div class="queue-item-title" title="${escapeHtml(video.title)}" style="font-weight:600; color:var(--text-main); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; margin-bottom:4px;">
                  ${escapeHtml(video.title)}
                </div>
                <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                  <span class="queue-meta-pill queue-meta-pill-channel" title="${escapeHtml(video.channelName || '')}">
                    <i data-lucide="tv" style="width:10px; height:10px;"></i>
                    <span>${escapeHtml(video.channelName || '')}</span>
                  </span>
                  <span class="queue-meta-pill queue-meta-pill-duration" title="${t.queue_col_duration || 'Süre'}">
                    <i data-lucide="clock" style="width:10px; height:10px;"></i>
                    <span>${durationStr}</span>
                  </span>
                  <span class="queue-meta-pill queue-meta-pill-size" title="${t.queue_col_size || 'Boyut'}">
                    <i data-lucide="hard-drive" style="width:10px; height:10px;"></i>
                    <span>${sizeStr}</span>
                  </span>
                  <span class="queue-meta-pill queue-meta-pill-date" title="${t.queue_col_downloaded_at || 'İndirilme Zamanı'}">
                    <i data-lucide="calendar" style="width:10px; height:10px;"></i>
                    <span>${dateStr}</span>
                  </span>
                </div>
              </div>
              <div class="queue-item-actions" style="display:flex; gap:6px;">
                <button class="btn-play-queue" onclick="playVideoEmbedded('${video.id}')" title="${isEn ? 'Play' : 'Oynat'}">
                  <i data-lucide="play" style="width: 10px; height: 10px;"></i>
                  <span>${isEn ? 'Play' : 'Oynat'}</span>
                </button>
                <button class="btn-cancel-queue" onclick="showDeleteModal('${video.id}')" title="${isEn ? 'Delete' : 'Sil'}" style="padding: 4px 8px;">
                  <i data-lucide="trash-2" style="width: 10px; height: 10px;"></i>
                  <span>${isEn ? 'Delete' : 'Sil'}</span>
                </button>
              </div>
            `;
          }

          queueCompletedList.appendChild(item);
        });

        try {
          if (typeof lucide !== 'undefined') {
            lucide.createIcons();
          }
        } catch (e) {}
      }
    }
  }

  // 5. Kanallar Listesi (Alfabetik Sıralı & Filtreli)
  if (channelsList && db.channels) {
    const channelFilters = typeof getChannelActiveFilters === 'function' ? getChannelActiveFilters() : {};
    renderChannelsList(channelsList, db.channels, t, db.categories, channelFilters);
  }

  // Kategori Yönetimi Arayüzünü Yükle (Araçlar Sekmesinde)
  if (typeof loadCategoriesToTools === 'function') {
    loadCategoriesToTools(db.categories);
  }

  // 6. Kanal Filtresi Seçeneklerini Doldur (Standart Doğal Seçim Listesi)
  populateChannelFilters(db);



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
    historyOnlyNotDownloadedCheck.checked = !!window.historyOnlyNotDownloaded;
    syncFilterChipUI('history-only-not-downloaded');
  }
  const historyOnlyNoAutoDownloadCheck = document.getElementById('history-only-no-auto-download');
  if (historyOnlyNoAutoDownloadCheck) {
    historyOnlyNoAutoDownloadCheck.checked = !!window.historyOnlyNoAutoDownload;
    syncFilterChipUI('history-only-no-auto-download');
  }
  const historyShowHiddenCheck = document.getElementById('history-show-hidden');
  if (historyShowHiddenCheck) {
    historyShowHiddenCheck.checked = !!window.historyShowHidden;
    syncFilterChipUI('history-show-hidden');
  }
  const historyShowShortsCheck = document.getElementById('history-show-shorts');
  if (historyShowShortsCheck) {
    historyShowShortsCheck.checked = localDb.settings?.showShorts !== false;
    syncFilterChipUI('history-show-shorts');
  }
  const historyShowLiveCheck = document.getElementById('history-show-live');
  if (historyShowLiveCheck) {
    syncFilterChipUI('history-show-live');
  }
  const historyShowMembersCheck = document.getElementById('history-show-members');
  if (historyShowMembersCheck) {
    historyShowMembersCheck.checked = window.historyShowMembers !== false;
    syncFilterChipUI('history-show-members');
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
      if (historyFilterChannel.startsWith('category:')) {
        const catId = parseInt(historyFilterChannel.split(':')[1], 10);
        const channelIdsInCat = (db.channels || []).filter(c => (c.categoryIds || [c.categoryId || 1]).includes(catId)).map(c => c.id);
        const channelIdsInCatSet = new Set(channelIdsInCat);
        filteredHistory = filteredHistory.filter(item => channelIdsInCatSet.has(item.channelId));
      } else {
        filteredHistory = filteredHistory.filter(item => item.channelId === historyFilterChannel);
      }
    }
    
    if (window.historyOnlyNoAutoDownload) {
      const disabledChannelIds = new Set((db.channels || []).filter(c => c.autoDownload === false).map(c => c.id));
      filteredHistory = filteredHistory.filter(item => disabledChannelIds.has(item.channelId));
    }
    
    if (window.historyOnlyNotDownloaded) {
      filteredHistory = filteredHistory.filter(item => item.status !== 'completed');
    }

    if (window.historyOnlyLiveProcessing) {
      filteredHistory = filteredHistory.filter(item => item.status === 'waiting_live_processing' || item.status === 'live_processing');
    }

    const showMembers = window.historyShowMembers !== false;
    if (!showMembers) {
      filteredHistory = filteredHistory.filter(item => !isMembersOnlyVideo(item));
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

    // Süre filtresi: seçilen dakikadan kısa veya eşit olan videoları gizle
    const durationFilterVal = db.settings.historyDurationFilter || 'off';
    if (durationFilterVal !== 'off') {
      const maxSeconds = parseInt(durationFilterVal, 10) * 60;
      filteredHistory = filteredHistory.filter(item => {
        const sec = parseDurationToSeconds(item.duration);
        // Süresi bilinmeyen videoları göster, süresi maxSeconds'tan büyük olanları da göster
        return sec === null || sec > maxSeconds;
      });
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

    // Silinen/gizlenen videoları limit uygulandıktan sonra filtrele ki
    // gizlenmiş videolar son videolar kontenjanını kaplasın ve yerine eski videolar sızmasın.
    if (!window.historyShowHidden) {
      filteredHistory = filteredHistory.filter(item => item.hidden !== true);
    }
    
    renderVideoGrid(historyGrid, filteredHistory, historyViewMode);
  }

  // İndirilen Videoları filtrele ve çiz
  if (downloadedGrid && db.history && db.settings) {
    let filteredDownloaded = db.history.filter(item => item.status === 'completed');
    
    if (downloadedFilterChannel !== 'all') {
      if (downloadedFilterChannel.startsWith('category:')) {
        const catId = parseInt(downloadedFilterChannel.split(':')[1], 10);
        const channelIdsInCat = (db.channels || []).filter(c => (c.categoryIds || [c.categoryId || 1]).includes(catId)).map(c => c.id);
        const channelIdsInCatSet = new Set(channelIdsInCat);
        filteredDownloaded = filteredDownloaded.filter(item => channelIdsInCatSet.has(item.channelId));
      } else {
        filteredDownloaded = filteredDownloaded.filter(item => item.channelId === downloadedFilterChannel);
      }
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
    const settingsTempDirType = document.getElementById('settings-temp-dir-type');
    if (settingsTempDirType && document.activeElement !== settingsTempDirType) settingsTempDirType.value = db.settings.tempDirType || 'system';

    const settingsDurationFetchMethod = document.getElementById('settings-duration-fetch-method');
    if (settingsDurationFetchMethod && document.activeElement !== settingsDurationFetchMethod) {
      settingsDurationFetchMethod.value = db.settings.durationFetchMethod || 'auto';
    }

    const settingsYtdlpRunMode = document.getElementById('settings-ytdlp-run-mode');
    if (settingsYtdlpRunMode && document.activeElement !== settingsYtdlpRunMode) {
      settingsYtdlpRunMode.value = db.settings.ytdlpRunMode || 'exe';
    }

    const settingsPythonCmd = document.getElementById('settings-python-cmd');
    if (settingsPythonCmd && document.activeElement !== settingsPythonCmd) {
      settingsPythonCmd.value = db.settings.pythonCmd || 'python';
    }
    
    if (typeof window.togglePythonSettingsVisibility === 'function') {
      window.togglePythonSettingsVisibility();
    }
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

    const settingsHideOnDelete = document.getElementById('settings-hideondelete');
    if (settingsHideOnDelete && document.activeElement !== settingsHideOnDelete) settingsHideOnDelete.checked = db.settings.hideOnDelete !== false;

    const historyShowShorts = document.getElementById('history-show-shorts');
    if (historyShowShorts && document.activeElement !== historyShowShorts) historyShowShorts.checked = db.settings.showShorts !== false;

    const downloadedShowShorts = document.getElementById('downloaded-show-shorts');
    if (downloadedShowShorts && document.activeElement !== downloadedShowShorts) downloadedShowShorts.checked = db.settings.showShorts !== false;

    const inlinePlaylistShowShorts = document.getElementById('inline-playlist-show-shorts');
    if (inlinePlaylistShowShorts && document.activeElement !== inlinePlaylistShowShorts) inlinePlaylistShowShorts.checked = db.settings.showShorts !== false;

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

    const settingsLiveStreamHandling = document.getElementById('settings-livestreamhandling');
    if (settingsLiveStreamHandling && document.activeElement !== settingsLiveStreamHandling) settingsLiveStreamHandling.value = db.settings.liveStreamHandling || 'instant_retry';

    const settingsLiveStreamRetryInterval = document.getElementById('settings-livestreamretryinterval');
    if (settingsLiveStreamRetryInterval && document.activeElement !== settingsLiveStreamRetryInterval) settingsLiveStreamRetryInterval.value = String(db.settings.liveStreamRetryInterval || 30);

    const settingsPort = document.getElementById('settings-port');
    if (settingsPort && document.activeElement !== settingsPort) settingsPort.value = db.settings.port || 4141;

    const settingsHistoryLimit = document.getElementById('settings-history-limit');
    if (settingsHistoryLimit && document.activeElement !== settingsHistoryLimit) settingsHistoryLimit.value = db.settings.historyLimitPerChannel || 30;

    const settingsPlaySounds = document.getElementById('settings-playsounds');
    if (settingsPlaySounds && document.activeElement !== settingsPlaySounds) settingsPlaySounds.checked = db.settings.playSounds !== false;

    const settingsAutoSyncWatchtime = document.getElementById('settings-autosync-watchtime');
    if (settingsAutoSyncWatchtime && document.activeElement !== settingsAutoSyncWatchtime) settingsAutoSyncWatchtime.checked = db.settings.autoSyncWatchtime !== false;

    const settingsAutoDiskSync = document.getElementById('settings-auto-disk-sync');
    if (settingsAutoDiskSync && document.activeElement !== settingsAutoDiskSync) settingsAutoDiskSync.checked = db.settings.autoDiskSync !== false;

    const settingsShowNotifications = document.getElementById('settings-shownotifications');
    if (settingsShowNotifications && document.activeElement !== settingsShowNotifications) settingsShowNotifications.checked = db.settings.showNotifications !== false;

    const settingsCheckOnStartup = document.getElementById('settings-checkonstartup');
    if (settingsCheckOnStartup && document.activeElement !== settingsCheckOnStartup) settingsCheckOnStartup.checked = db.settings.checkChannelsOnStartup === true;

    const settingsChannelScanMode = document.getElementById('settings-channel-scan-mode');
    if (settingsChannelScanMode && document.activeElement !== settingsChannelScanMode) settingsChannelScanMode.value = db.settings.channelScanMode || 'fast';

    const settingsAutoOpenBrowser = document.getElementById('settings-autoopenbrowser');
    if (settingsAutoOpenBrowser && document.activeElement !== settingsAutoOpenBrowser) settingsAutoOpenBrowser.checked = db.settings.autoOpenBrowser !== false;

    const settingsLang = document.getElementById('settings-lang');
    const effectiveLang = db.settings.lang || localStorage.getItem('haytool_user_lang') || 'tr';
    if (settingsLang && document.activeElement !== settingsLang) {
      settingsLang.value = effectiveLang;
      setCustomSelectValue(effectiveLang);
    }

    const settingsPrefAudioLang = document.getElementById('settings-preferredaudiolang');
    if (settingsPrefAudioLang && document.activeElement !== settingsPrefAudioLang) {
      settingsPrefAudioLang.value = db.settings.preferredAudioLang || 'auto';
    }

    const settingsPlayerType = document.getElementById('settings-player-type');
    if (settingsPlayerType && document.activeElement !== settingsPlayerType) settingsPlayerType.value = db.settings.playerType || 'plyr';

    const settingsDoubleClickAction = document.getElementById('settings-doubleclickaction');
    if (settingsDoubleClickAction && document.activeElement !== settingsDoubleClickAction) {
      settingsDoubleClickAction.value = db.settings.doubleClickAction || 'system';
    }

    const settingsSubtitleColor = document.getElementById('settings-subtitle-color');
    if (settingsSubtitleColor && document.activeElement !== settingsSubtitleColor) {
      settingsSubtitleColor.value = db.settings.subtitleColor || '#ffffff';
    }

    const settingsSponsorBlock = document.getElementById('settings-sponsorblock');
    if (settingsSponsorBlock && document.activeElement !== settingsSponsorBlock) settingsSponsorBlock.checked = db.settings.sponsorBlockEnabled === true;

    const settingsAltThumbnailsHover = document.getElementById('settings-alt-thumbnails-hover');
    if (settingsAltThumbnailsHover && document.activeElement !== settingsAltThumbnailsHover) settingsAltThumbnailsHover.checked = db.settings.enableAltThumbnailsHover !== false;

    const settingsDiscordRpc = document.getElementById('settings-discordrpc');
    if (settingsDiscordRpc && document.activeElement !== settingsDiscordRpc) settingsDiscordRpc.checked = db.settings.discordRpcEnabled === true;

    // Hava Durumu Ayarları
    const settingsWeatherEnabled = document.getElementById('settings-weatherenabled');
    if (settingsWeatherEnabled && document.activeElement !== settingsWeatherEnabled) {
      settingsWeatherEnabled.checked = db.settings.weatherEnabled !== false;
      const details = document.getElementById('weather-settings-details');
      if (details) details.style.display = settingsWeatherEnabled.checked ? 'block' : 'none';
    }

    const settingsWeatherCity = document.getElementById('settings-weathercity');
    if (settingsWeatherCity && document.activeElement !== settingsWeatherCity) {
      settingsWeatherCity.value = db.settings.weatherCity || 'İstanbul';
    }

    const settingsWeatherUnit = document.getElementById('settings-weatherunit');
    if (settingsWeatherUnit && document.activeElement !== settingsWeatherUnit) {
      settingsWeatherUnit.value = db.settings.weatherUnit || 'celsius';
    }

    const settingsWeatherLat = document.getElementById('settings-weatherlatitude');
    if (settingsWeatherLat && document.activeElement !== settingsWeatherLat) {
      settingsWeatherLat.value = db.settings.weatherLatitude !== undefined ? db.settings.weatherLatitude : 41.0082;
    }

    const settingsWeatherLon = document.getElementById('settings-weatherlongitude');
    if (settingsWeatherLon && document.activeElement !== settingsWeatherLon) {
      settingsWeatherLon.value = db.settings.weatherLongitude !== undefined ? db.settings.weatherLongitude : 28.9784;
    }

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
    applyTheme(db.settings.theme || 'dark');
    
    // Dil Çevirisini Uygula
    if (db.settings.lang) {
      applyLanguage(db.settings.lang);
    }
    
    // YouTube Oturumu ve Çerez durumunu kontrol et
    checkYouTubeAuthStatus();
  }

  // Gist alanlarını ve bağlantılarını doldur
  populateGistFields();

  // İkonları yeniden yükle
  lucide.createIcons();

  // URL'deki play parametresini kontrol et ve ilk yüklemede otomatik oynat
  if (!window.hasProcessedUrlPlayParam) {
    window.hasProcessedUrlPlayParam = true;
    const urlParams = new URLSearchParams(window.location.search);
    const playVideoId = urlParams.get('play');
    if (playVideoId) {
      switchTab('downloaded', true);
      setTimeout(() => {
        playVideoEmbedded(playVideoId);
      }, 150);
    }
  }

  // (eski renderBulkHideList çağrısı kaldırıldı - artık Kütüphane tabında inline mod kullanılıyor)
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
window.updateAllChannelInfo = async function() {
  const isEn = localDb.settings && localDb.settings.lang === 'en';
  showToast(isEn ? 'Updating subscriber counts & avatars for all channels...' : 'Tüm kanal abone sayıları ve avatarları güncelleniyor...', 'info');
  
  const btn = document.getElementById('update-all-channels-btn');
  if (btn) btn.disabled = true;
  
  try {
    const res = await fetch('/api/channels/update-all-info', { method: 'POST' });
    const data = await res.json();
    if (data.success) {
      showToast(isEn ? 'All channel info updated successfully.' : 'Tüm kanal bilgileri başarıyla güncellendi.', 'success');
      if (typeof fetchDb === 'function') {
        await fetchDb();
      }
      if (typeof renderChannels === 'function') renderChannels();
      if (typeof renderHistory === 'function') renderHistory();
    } else {
      showToast(data.error || (isEn ? 'Process failed.' : 'İşlem başarısız oldu.'), 'error');
    }
  } catch (err) {
    showToast(isEn ? 'Server connection error.' : 'Sunucu ile iletişim hatası.', 'error');
  } finally {
    if (btn) btn.disabled = false;
  }
};

window.updateChannelInfo = async function(id) {
  const isEn = localDb.settings && localDb.settings.lang === 'en';
  try {
    showToast(isEn ? 'Updating channel info (subscribers & avatar)...' : 'Kanal bilgileri (abone sayısı & avatar) güncelleniyor...', 'info');
    const res = await fetch(`/api/channels/${id}/update-info`, { method: 'POST' });
    const data = await res.json();
    if (data.success) {
      showToast(isEn ? 'Channel info updated successfully.' : 'Kanal bilgileri başarıyla güncellendi.', 'success');
      
      const targetChannel = localDb.channels?.find(c => c.id === id);
      if (targetChannel) {
        if (data.subscriberCount) targetChannel.subscriberCount = data.subscriberCount;
        if (data.avatar) targetChannel.avatar = data.avatar;
      }

      if (typeof fetchDb === 'function') {
        await fetchDb();
      }
      if (typeof renderChannels === 'function') renderChannels();
      if (typeof renderHistory === 'function') renderHistory();
    } else {
      showToast(data.error || (isEn ? 'Error occurred.' : 'Hata oluştu.'), 'error');
    }
  } catch (err) {
    showToast(isEn ? 'Server communication error.' : 'Sunucu ile iletişim hatası.', 'error');
  }
};

window.updateAllChannelAvatars = async function() {
  return window.updateAllChannelInfo();
};

window.updateChannelSubscribers = async function(id) {
  return window.updateChannelInfo(id);
};

window.updateAllChannelSubscribers = async function() {
  return window.updateAllChannelInfo();
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
    tempDirType: document.getElementById('settings-temp-dir-type') ? document.getElementById('settings-temp-dir-type').value : 'system',
    durationFetchMethod: document.getElementById('settings-duration-fetch-method') ? document.getElementById('settings-duration-fetch-method').value : 'auto',
    ytdlpRunMode: document.getElementById('settings-ytdlp-run-mode') ? document.getElementById('settings-ytdlp-run-mode').value : 'exe',
    pythonCmd: document.getElementById('settings-python-cmd') ? document.getElementById('settings-python-cmd').value : 'python',
    browser: settingsBrowser ? settingsBrowser.value : 'none',
    quality: settingsQuality.value,
    channelCheckInterval: parseInt(settingsChannelCheckInterval.value, 10) || 60,
    autoDownload: settingsAutoDownload.checked,
    mergeType: document.getElementById('settings-mergetype').value,
    writeThumbnail: document.getElementById('settings-writethumbnail').checked,
    showShorts: document.getElementById('settings-showshorts').checked,
    hideOnDelete: document.getElementById('settings-hideondelete').checked,
    theme: document.getElementById('settings-theme').value,
    autoDeleteDays: parseInt(document.getElementById('settings-autodelete').value, 10) || 0,
    rssLimit: parseInt(document.getElementById('settings-rsslimit').value, 10) || 5,
    liveStreamHandling: document.getElementById('settings-livestreamhandling') ? document.getElementById('settings-livestreamhandling').value : 'instant_retry',
    liveStreamRetryInterval: document.getElementById('settings-livestreamretryinterval') ? (parseInt(document.getElementById('settings-livestreamretryinterval').value, 10) || 30) : 30,
    downloadSpeedLimit: parseInt(document.getElementById('settings-speedlimit').value, 10) || 0,
    alternativeSpeedLimit: parseInt(document.getElementById('settings-altspeedlimit').value, 10) || 500,
     port: port,
    playerType: document.getElementById('settings-player-type').value,
    subtitleColor: document.getElementById('settings-subtitle-color').value,
    subtitleOpacity: localDb.settings.subtitleOpacity || '0.7',
    subtitleSize: localDb.settings.subtitleSize || '26px',
    sponsorBlockEnabled: document.getElementById('settings-sponsorblock').checked,
    playSounds: document.getElementById('settings-playsounds').checked,
    autoSyncWatchtime: document.getElementById('settings-autosync-watchtime') ? document.getElementById('settings-autosync-watchtime').checked : (localDb.settings.autoSyncWatchtime !== false),
    autoDiskSync: document.getElementById('settings-auto-disk-sync') ? document.getElementById('settings-auto-disk-sync').checked : (localDb.settings.autoDiskSync !== false),
    showNotifications: document.getElementById('settings-shownotifications').checked,
    autoOpenBrowser: document.getElementById('settings-autoopenbrowser').checked,
    checkChannelsOnStartup: document.getElementById('settings-checkonstartup') ? document.getElementById('settings-checkonstartup').checked : false,
    discordRpcEnabled: document.getElementById('settings-discordrpc').checked,
    enableAltThumbnailsHover: document.getElementById('settings-alt-thumbnails-hover') ? document.getElementById('settings-alt-thumbnails-hover').checked : true,
    lang: document.getElementById('settings-lang').value,
    preferredAudioLang: document.getElementById('settings-preferredaudiolang') ? document.getElementById('settings-preferredaudiolang').value : 'auto',
    doubleClickAction: document.getElementById('settings-doubleclickaction').value,
    historyLimitPerChannel: parseInt(document.getElementById('settings-history-limit').value, 10) || 30,
    shortsDurationLimit: settingsShortsDurationLimit ? (parseInt(settingsShortsDurationLimit.value, 10) || 180) : (localDb.settings.shortsDurationLimit || 180),
    githubToken: (document.getElementById('gist-token-input') && document.getElementById('gist-token-input').value.trim()) || (localDb.settings && localDb.settings.githubToken) || '',
    githubGistId: (document.getElementById('gist-id-input') && document.getElementById('gist-id-input').value.trim()) || (localDb.settings && localDb.settings.githubGistId) || '',
    autoSyncGist: document.getElementById('gist-auto-sync-checkbox') ? document.getElementById('gist-auto-sync-checkbox').checked : (localDb.settings.autoSyncGist || false),
    channelScanMode: document.getElementById('settings-channel-scan-mode') ? document.getElementById('settings-channel-scan-mode').value : 'fast',
    weatherEnabled: document.getElementById('settings-weatherenabled') ? document.getElementById('settings-weatherenabled').checked : true,
    weatherCity: document.getElementById('settings-weathercity') ? document.getElementById('settings-weathercity').value.trim() : 'İstanbul',
    weatherUnit: document.getElementById('settings-weatherunit') ? document.getElementById('settings-weatherunit').value : 'celsius',
    weatherLatitude: document.getElementById('settings-weatherlatitude') ? (parseFloat(document.getElementById('settings-weatherlatitude').value) || 41.0082) : 41.0082,
    weatherLongitude: document.getElementById('settings-weatherlongitude') ? (parseFloat(document.getElementById('settings-weatherlongitude').value) || 28.9784) : 28.9784
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
      const isEn = localDb.settings && localDb.settings.lang === 'en';
      if (statusSpan) {
        statusSpan.innerHTML = `<i data-lucide="check-circle" style="width:16px; height:16px; margin-right:4px; color:var(--success-color);"></i><span style="color:var(--success-color);">${isEn ? 'All changes saved.' : 'Tüm değişiklikler kaydedildi.'}</span>`;
        lucide.createIcons();
      }
      showToast(isEn ? 'Settings saved successfully' : 'Ayarlar başarıyla kaydedildi', 'success');
      if (port !== oldPort) {
        showToast(isEn ? 'Port changed. Please restart the app to apply.' : 'Port değiştirildi. Yeni portun aktif olması için uygulamayı yeniden başlatın.', 'warning');
      }
      updateDiskSpace();
      updateWeatherBadge(true);
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

/**
 * Tema Değiştirme ve Uygulama Yardımcı Fonksiyonu
 * 
 * @param {string} themeName - 'dark' | 'light' | 'matrix'
 * @returns {void}
 */
function applyTheme(themeName) {
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
window.applyTheme = applyTheme;

/**
 * Hızlı Tema Değiştir (Quick Theme Toggle Cycle)
 * Koyu -> Açık -> Matrix -> Discord -> YouTube -> Koyu temaları arasında sıralı hızlı geçiş yapar.
 * 
 * @returns {Promise<void>}
 */
async function toggleQuickTheme() {
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
    const payload = { ...window.localDb.settings, theme: newTheme };
    await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  } catch (err) {
    devWarn('Tema değişikliği sunucuya kaydedilemedi:', err);
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
  
  showToast(toastText, 'info');
}
window.toggleQuickTheme = toggleQuickTheme;

/**
 * Tema Buton İkon ve Başlık Arayüzünü Günceller
 * 
 * @param {string} themeName - Mevcut aktif tema
 * @returns {void}
 */
function updateThemeToggleUI(themeName) {
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
window.updateThemeToggleUI = updateThemeToggleUI;

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

/**
 * Disk senkronizasyonunu manuel olarak tetikler ve arayüz bildirimlerini yönetir.
 * 
 * @returns {Promise<void>}
 */
async function triggerManualDiskSync() {
  const btn = document.getElementById('btn-manual-disk-sync');
  const lang = (localDb && localDb.settings && localDb.settings.lang) || currentLang || 'tr';
  const t = translations[lang] || translations.tr;
  const isEn = lang === 'en';

  let originalHtml = '';
  if (btn) {
    originalHtml = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = `<i data-lucide="loader" class="pulse-animation" style="width:13px;height:13px;"></i> <span>${isEn ? 'Syncing...' : 'Senkronize Ediliyor...'}</span>`;
    try { lucide.createIcons(); } catch(e) {}
  }

  showToast(t.msg_disk_sync_started || (isEn ? 'Disk sync started...' : 'Disk senkronizasyonu başlatıldı...'), 'info');

  try {
    const res = await fetch('/api/settings/sync-disk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    const data = await res.json();
    if (data.success) {
      if (data.busy) {
        showToast(data.message || (isEn ? 'Downloads active, sync deferred.' : 'Aktif indirme olduğu için senkronizasyon ertelendi.'), 'warning');
      } else {
        const successMsg = isEn 
          ? `Disk synced: ${data.totalVerified || 0} videos verified, ${data.updatedCount || 0} updated.`
          : `Disk eşitlendi: ${data.totalVerified || 0} video doğrulandı, ${data.updatedCount || 0} kayıt güncellendi.`;
        showToast(successMsg, 'success');
      }
    } else {
      showToast(data.error || (isEn ? 'Disk sync failed.' : 'Disk senkronizasyonu başarısız oldu.'), 'error');
    }
  } catch (err) {
    showToast(isEn ? 'Connection error.' : 'Bağlantı hatası.', 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = originalHtml;
      try { lucide.createIcons(); } catch(e) {}
    }
  }
}
window.triggerManualDiskSync = triggerManualDiskSync;

const btnManualDiskSync = document.getElementById('btn-manual-disk-sync');
if (btnManualDiskSync) {
  btnManualDiskSync.onclick = triggerManualDiskSync;
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
let lastAutoSyncedTime = 0;
let lastAutoSyncedVideoId = null;

/**
 * İzleme süresini YouTube hesabına otomatik olarak arka planda senkronize eder.
 * 
 * @param {string} vid - Video ID
 * @param {number} curTime - Saniye cinsinden süre
 * @param {boolean} [force=false] - Süre farkı gözetmeksizin zorla gönder (pause/close anında)
 */
function autoSyncWatchtimeHelper(vid, curTime, force = false) {
  if (!vid || typeof curTime !== 'number' || isNaN(curTime) || curTime < 2) return;
  if (localDb?.settings?.autoSyncWatchtime === false) return;

  if (!force) {
    if (lastAutoSyncedVideoId === vid && Math.abs(curTime - lastAutoSyncedTime) < 30) {
      return;
    }
  }

  lastAutoSyncedTime = curTime;
  lastAutoSyncedVideoId = vid;

  fetch(`/api/video/${vid}/sync-watchtime`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ currentTime: curTime, silent: true })
  }).catch(() => {});
}

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
// Türkçe Açıklama: Yüzen oynatıcı modalının boyut ve konum stillerini temizleyip video formatına (Shorts / Geniş Ekran) ve kayıtlı ayarlara göre orantılı uygular.
/**
 * Oynatıcı modalının boyut ve en-boy oranını video türüne göre yapılandırır.
 * 
 * @param {boolean} isShort Videonun Shorts/dikey olup olmadığı
 * @param {boolean} [isMinimized=false] Modalın küçültülmüş PiP modunda olup olmadığı
 */
function resetAndApplyPlayerDimensions(isShort = false, isMinimized = false) {
  const modal = document.getElementById('player-modal');
  if (!modal) return;

  const modalContent = modal.querySelector('.player-modal-content');
  const modalBody = modal.querySelector('.player-modal-body');
  if (!modalContent || !modalBody) return;

  if (isShort) {
    modal.classList.add('is-short-player');
  } else {
    modal.classList.remove('is-short-player');
  }

  if (isMinimized) {
    modal.classList.add('minimized');
  } else {
    modal.classList.remove('minimized');
  }

  const suffix = isShort ? '-short' : '-wide';
  const savedWidth = localStorage.getItem(`player-modal${suffix}-width`);
  const savedHeight = localStorage.getItem(`player-modal${suffix}-height`);
  const savedLeft = localStorage.getItem(`player-modal${suffix}-left`);
  const savedTop = localStorage.getItem(`player-modal${suffix}-top`);

  if (!isMinimized && savedWidth && savedHeight) {
    modalContent.style.width = savedWidth;
    modalContent.style.height = savedHeight;
    modalContent.style.left = savedLeft || '';
    modalContent.style.top = savedTop || '';
    modalContent.style.right = savedLeft ? 'auto' : '20px';
    modalContent.style.bottom = savedTop ? 'auto' : '20px';

    const headerEl = modalContent.querySelector('.player-modal-header') || modalContent.querySelector('.modal-header');
    const headerHeight = headerEl ? headerEl.offsetHeight : 38;
    const bodyHeight = parseInt(savedHeight, 10) - headerHeight;
    if (bodyHeight > 50) {
      modalBody.style.height = `${bodyHeight}px`;
    } else {
      modalBody.style.height = '';
    }
  } else {
    // Varsayılan temiz boyutlandırma (inline stilleri temizle, CSS kurallarına bırak)
    modalContent.style.width = '';
    modalContent.style.height = '';
    modalContent.style.left = '';
    modalContent.style.top = '';
    modalContent.style.right = '20px';
    modalContent.style.bottom = '20px';
    modalBody.style.height = '';
  }

  if (isShort) {
    modalBody.style.aspectRatio = '9 / 16';
  } else {
    modalBody.style.aspectRatio = '16 / 9';
  }
}
window.resetAndApplyPlayerDimensions = resetAndApplyPlayerDimensions;

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
  const isShort = modal.classList.contains('is-short-player');

  resetAndApplyPlayerDimensions(isShort, isMinimized);

  if (btn) {
    const icon = btn.querySelector('i') || btn.querySelector('[data-lucide]');
    if (icon) {
      icon.setAttribute('data-lucide', isMinimized ? 'maximize-2' : 'minus');
    }
    btn.title = isMinimized ? (localDb.settings && localDb.settings.lang === 'en' ? 'Maximize' : 'Büyüt') : (localDb.settings && localDb.settings.lang === 'en' ? 'Minimize' : 'Küçült');
  }
  try {
    if (typeof lucide !== 'undefined') lucide.createIcons();
  } catch (e) {}

  if (videoPlayerInstance && typeof videoPlayerInstance.resize === 'function') {
    setTimeout(() => videoPlayerInstance.resize(), 50);
  }
};

let currentVideoSponsorSegments = [];
let lastSkippedSegmentStart = -1;
let playerResizeObserver = null;

// Türkçe Açıklama: Gömülü video oynatıcı modalının başlık çubuğundan tutularak ekranda serbestçe ve ekran sınırları içinde taşınmasını sağlar.
/**
 * Oynatıcı modalını başlık barından taşınabilir hale getirir.
 * 
 * @param {HTMLElement} modalContent Taşınacak modal içerik elementi
 * @param {HTMLElement} dragHeader Sürükleme tutamacı olarak kullanılacak başlık elementi
 */
function makeElementDraggable(modalContent, dragHeader) {
  if (!modalContent || !dragHeader) return;
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
    const suffix = isShort ? '-short' : '-wide';
    localStorage.setItem(`player-modal${suffix}-left`, modalContent.style.left);
    localStorage.setItem(`player-modal${suffix}-top`, modalContent.style.top);
  }
}

// Türkçe Açıklama: Gömülü video oynatıcı modalının köşelerinden veya kenarlarından en-boy oranını (16:9 veya 9:16) bozmadan orantılı olarak yeniden boyutlandırılmasını sağlar.
/**
 * Oynatıcı modalını en-boy oranı kilitli olarak orantılı boyutlandırılabilir hale getirir.
 * 
 * @param {HTMLElement} modalContent Boyutlandırılacak modal içerik elementi
 */
function makeElementResizable(modalContent) {
  if (!modalContent) return;
  const handles = modalContent.querySelectorAll('.resize-handle');
  
  handles.forEach(handle => {
    handle.onmousedown = resizeMouseDown;
    
    function resizeMouseDown(e) {
      e.preventDefault();
      e.stopPropagation();

      const modal = modalContent.closest('#player-modal');
      const isShort = modal ? modal.classList.contains('is-short-player') : false;
      
      // Video elementinden veya sınıftan gerçek en-boy oranını al
      const rawVideo = modalContent.querySelector('video') || (window.videoPlayerInstance && window.videoPlayerInstance.video);
      let ratio = 16 / 9;
      if (rawVideo && rawVideo.videoWidth && rawVideo.videoHeight) {
        ratio = rawVideo.videoWidth / rawVideo.videoHeight;
      } else if (isShort) {
        ratio = 9 / 16;
      }

      const isRight = handle.classList.contains('bottom-right') || handle.classList.contains('top-right') || handle.classList.contains('edge-right');
      const isLeft = handle.classList.contains('bottom-left') || handle.classList.contains('top-left') || handle.classList.contains('edge-left');
      const isBottom = handle.classList.contains('bottom-left') || handle.classList.contains('bottom-right') || handle.classList.contains('edge-bottom');
      const isTop = handle.classList.contains('top-left') || handle.classList.contains('top-right') || handle.classList.contains('edge-top');
      
      const startRect = modalContent.getBoundingClientRect();
      const startWidth = startRect.width;
      const startHeight = startRect.height;
      const startX = e.clientX;
      const startY = e.clientY;
      const startLeft = startRect.left;
      const startTop = startRect.top;
      
      const headerEl = modalContent.querySelector('.player-modal-header') || modalContent.querySelector('.modal-header');
      const headerHeight = headerEl ? headerEl.offsetHeight : 38;

      document.onmousemove = elementResize;
      document.onmouseup = closeResizeElement;
      
      function elementResize(e) {
        e.preventDefault();
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;

        let newWidth = startWidth;

        if (isRight) {
          newWidth = startWidth + dx;
        } else if (isLeft) {
          newWidth = startWidth - dx;
        } else if (isBottom) {
          const newBodyHeight = (startHeight - headerHeight) + dy;
          newWidth = newBodyHeight * ratio;
        } else if (isTop) {
          const newBodyHeight = (startHeight - headerHeight) - dy;
          newWidth = newBodyHeight * ratio;
        }

        // Minimum ve maksimum sınır kontrolleri
        const minWidth = isShort ? 200 : 280;
        const maxWidth = Math.min(1000, window.innerWidth - 20);
        newWidth = Math.max(minWidth, Math.min(newWidth, maxWidth));

        let newBodyHeight = Math.round(newWidth / ratio);
        let newTotalHeight = newBodyHeight + headerHeight;

        // Ekran yüksekliğini aşmama kontrolü
        const maxHeight = window.innerHeight - 20;
        if (newTotalHeight > maxHeight) {
          newTotalHeight = maxHeight;
          newBodyHeight = newTotalHeight - headerHeight;
          newWidth = Math.round(newBodyHeight * ratio);
        }

        // Yeni konum hesaplama (Sol veya Üstten çekildiyse başlangıç konumunu kaydır)
        let newLeft = startLeft;
        let newTop = startTop;

        if (isLeft) {
          newLeft = startLeft + (startWidth - newWidth);
        }
        if (isTop) {
          newTop = startTop + (startHeight - newTotalHeight);
        }

        // Ekran dışına taşmayı sınırla
        newLeft = Math.max(10, Math.min(newLeft, window.innerWidth - newWidth - 10));
        newTop = Math.max(10, Math.min(newTop, window.innerHeight - newTotalHeight - 10));

        modalContent.style.width = `${Math.round(newWidth)}px`;
        modalContent.style.height = `${Math.round(newTotalHeight)}px`;
        modalContent.style.left = `${Math.round(newLeft)}px`;
        modalContent.style.top = `${Math.round(newTop)}px`;
        modalContent.style.right = 'auto';
        modalContent.style.bottom = 'auto';

        const bodyEl = modalContent.querySelector('.player-modal-body');
        if (bodyEl) {
          bodyEl.style.height = `${Math.round(newBodyHeight)}px`;
        }
      }
      
      function closeResizeElement() {
        document.onmousemove = null;
        document.onmouseup = null;
        
        const suffix = isShort ? '-short' : '-wide';
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
    const ratio = `${videoElement.videoWidth} / ${videoElement.videoHeight}`;

    if (modal) {
      const isMinimized = modal.classList.contains('minimized');
      resetAndApplyPlayerDimensions(isVertical, isMinimized);
      const modalBody = modal.querySelector('.player-modal-body');
      if (modalBody) {
        modalBody.style.aspectRatio = ratio;
      }
    }

    if (inlineWrapper) {
      if (isVertical) {
        inlineWrapper.classList.add('is-short-player');
      } else {
        inlineWrapper.classList.remove('is-short-player');
      }
      inlineWrapper.style.aspectRatio = ratio;
    }

    if (videoPlayerInstance && typeof videoPlayerInstance.resize === 'function') {
      setTimeout(() => videoPlayerInstance.resize(), 50);
    }
  }
}

async function fetchSponsorSegments(videoId) {
  currentVideoSponsorSegments = [];
  lastSkippedSegmentStart = -1;
  
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
        devLog(`[SponsorBlock] Found ${currentVideoSponsorSegments.length} segments:`, currentVideoSponsorSegments);
      }
    }
  } catch (err) {
    clearTimeout(timeoutId);
    devWarn('[SponsorBlock] Failed to fetch segments or request timed out:', err);
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

  const isActive = localDb.settings && localDb.settings.sponsorBlockEnabled === true;

  if (!isActive) {
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
    w.style.opacity = '1';
  });
}

function checkAndSkipSponsor(currentTime, videoElementOrPlayer) {
  if (!currentVideoSponsorSegments || currentVideoSponsorSegments.length === 0) return;
  if (!localDb.settings || localDb.settings.sponsorBlockEnabled !== true) return;

  let insideAnySegment = false;
  for (const seg of currentVideoSponsorSegments) {
    if (currentTime >= seg.start && currentTime < (seg.end - 0.1)) {
      insideAnySegment = true;
      if (lastSkippedSegmentStart !== seg.start) {
        lastSkippedSegmentStart = seg.start;
        devLog(`[SponsorBlock] Skipping segment from ${seg.start} to ${seg.end}`);
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

/**
 * Türkçe Açıklama: Oynatılan videonun başlığını ve kanal adını Discord RPC durumuna yansıtmak üzere backend API'ye gönderir.
 * 
 * @param {boolean} isPlaying - Oynatım durumu (true: oynatılıyor, false: durduruldu)
 * @returns {void}
 */
function sendPlayerActivity(isPlaying) {
  if (localDb.settings && localDb.settings.discordRpcEnabled === false) return;

  let title = null;
  let channelName = null;
  if (isPlaying && currentPlayingVideoId) {
    const video = (localDb.history || []).find(h => h.id === currentPlayingVideoId);
    if (video) {
      title = video.title || null;
      channelName = video.channelName || null;
    }
  }

  fetch('/api/player/activity', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, channelName })
  }).catch(e => console.error('[Discord RPC] Durum gönderim hatası:', e));
}

window.cleanupAllPlayers = function() {
  sendPlayerActivity(false);
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
  // C# PlayerWindow açılmasını devredışı bıraktık, artık her şey tek pencerede arayüz içinde oynatılacak.

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
    if (titleEl) {
      const titleText = videoTitle || 'Yerleşik Oynatıcı';
      titleEl.textContent = titleText;
      titleEl.title = titleText; // Hover tooltip showing full title

      // Karakter sayısına göre yazı boyutunu dinamik ayarla (2. satıra taşmayı engellemek için)
      if (titleText.length > 80) {
        titleEl.style.fontSize = '0.85rem';
      } else if (titleText.length > 60) {
        titleEl.style.fontSize = '0.95rem';
      } else if (titleText.length > 40) {
        titleEl.style.fontSize = '1.1rem';
      } else {
        titleEl.style.fontSize = '1.25rem';
      }
    }

    const channelNameEl = document.getElementById('inline-player-channel-name');
    if (channelNameEl) channelNameEl.textContent = videoChannelName || '';

    const avatarEl = document.getElementById('inline-player-channel-avatar');
    const logoDividerEl = document.getElementById('inline-player-logo-divider');
    if (avatarEl) {
      if (videoChannelId) {
        avatarEl.src = `/api/channels/${videoChannelId}/avatar`;
        avatarEl.style.display = 'block';
        if (logoDividerEl) logoDividerEl.style.display = 'inline';
      } else {
        avatarEl.style.display = 'none';
        if (logoDividerEl) logoDividerEl.style.display = 'none';
      }
    }

    const subsEl = document.getElementById('inline-player-channel-subs');
    const subsTextEl = document.getElementById('inline-player-channel-subs-text');
    const dividerEl = document.getElementById('inline-player-channel-divider');
    if (subsEl && subsTextEl) {
      const channel = localDb.channels?.find(c => c.id === videoChannelId || (videoChannelName && c.name === videoChannelName));
      const subVal = channel && channel.subscriberCount ? channel.subscriberCount : '?';
      
      subsTextEl.textContent = subVal;
      subsEl.style.display = 'inline-flex';
      if (dividerEl) dividerEl.style.display = 'inline';
      try {
        if (typeof lucide !== 'undefined') {
          lucide.createIcons();
        }
      } catch (e) {}
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
      btnSBToggle.style.display = 'inline-flex';
      updateSBToggleButtonUI();

      btnSBToggle.onclick = async () => {
        const isCurrentlyActive = localDb.settings && localDb.settings.sponsorBlockEnabled === true;
        const newStatus = !isCurrentlyActive;
        
        if (!localDb.settings) localDb.settings = {};
        localDb.settings.sponsorBlockEnabled = newStatus;

        const settingsSB = document.getElementById('settings-sponsorblock');
        if (settingsSB) settingsSB.checked = newStatus;

        updateSBToggleButtonUI();

        try {
          await fetch('/api/settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sponsorBlockEnabled: newStatus })
          });
        } catch(err) {
          console.error('[SponsorBlock] Setting save error:', err);
        }

        if (typeof updateSponsorBlockStatusUI === 'function') {
          updateSponsorBlockStatusUI();
        }
        
        const lang = (localDb && localDb.settings && localDb.settings.lang) || currentLang || 'tr';
        const t = translations[lang] || translations.tr;
        const icon = newStatus ? 'shield' : 'shield-off';
        const title = newStatus 
          ? (t.sponsorblock_active_toast || 'SponsorBlock Aktif') 
          : (t.sponsorblock_disabled_toast || 'SponsorBlock Devre Dışı');
        const desc = newStatus 
          ? (t.sponsorblock_active_toast_desc || 'Sponsorlu alanlar otomatik atlanacak') 
          : (t.sponsorblock_disabled_toast_desc || 'Sponsorlu alan atlamaları durduruldu');

        const html = `
          <div class="player-transient-card">
            <i data-lucide="${icon}" style="width: 36px; height: 36px; color: ${newStatus ? '#4ade80' : '#ef4444'};"></i>
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

    // Açıklama ve Yorumları Güncelleme Butonu logic
    const btnRefreshDetails = document.getElementById('inline-btn-refresh-details');
    if (btnRefreshDetails) {
      btnRefreshDetails.onclick = async () => {
        const lang = (localDb && localDb.settings && localDb.settings.lang) || currentLang || 'tr';
        const isEn = lang === 'en';
        
        // İlk yükleniyor bildirimi
        const loadingHtml = `
          <div class="player-transient-card">
            <i data-lucide="refresh-cw" style="width: 36px; height: 36px; color: #38bdf8; animation: spin 1s linear infinite;"></i>
            <div class="transient-title">${isEn ? 'Refreshing...' : 'Güncelleniyor...'}</div>
            <div class="transient-desc">${isEn ? 'Updating description and comments from YouTube' : 'Açıklama ve yorumlar YouTube\'dan tazelemekte'}</div>
          </div>
        `;
        if (typeof showPlayerTransientOverlay === 'function') {
          showPlayerTransientOverlay(loadingHtml, 6000);
        }
        try {
          lucide.createIcons();
        } catch(e) {}

        try {
          // Açıklamayı güncelle
          const descRes = await fetch(`/api/video/${videoId}/refresh-details`, {
            method: 'POST'
          });
          const descData = await descRes.json();

          if (descData.success) {
            // Açıklama alanını tazele
            const descContent = document.getElementById('description-content');
            if (descContent && descData.description) {
              descContent.innerHTML = formatDescriptionTimestamps(descData.description);
            }
            
            const descBtn = document.getElementById('inline-btn-description');
            if (descBtn) {
              descBtn.style.display = 'inline-flex';
              descBtn.classList.add('active');
              descBtn.title = isEn ? 'Hide Description' : 'Açıklamayı Gizle';
            }
            
            const descContainer = document.getElementById('inline-player-description-container');
            if (descContainer) {
              descContainer.classList.remove('hidden');
            }

            // Yorumları yeniden yükle
            loadComments(videoId);

            // Başarılı bildirimi göster
            const successHtml = `
              <div class="player-transient-card">
                <i data-lucide="check-circle" style="width: 36px; height: 36px; color: #4ade80;"></i>
                <div class="transient-title">${isEn ? 'Details Updated' : 'Detaylar Güncellendi'}</div>
                <div class="transient-desc">${isEn ? 'Description and comments updated successfully.' : 'Açıklama ve yorumlar başarıyla yenilendi.'}</div>
              </div>
            `;
            if (typeof showPlayerTransientOverlay === 'function') {
              showPlayerTransientOverlay(successHtml, 2000);
            }
          } else {
            throw new Error(descData.error || 'API Error');
          }
        } catch (err) {
          console.error("Refresh details error:", err);
          const errorHtml = `
            <div class="player-transient-card">
              <i data-lucide="alert-circle" style="width: 36px; height: 36px; color: #ef4444;"></i>
              <div class="transient-title">${isEn ? 'Update Failed' : 'Güncelleme Başarısız'}</div>
              <div class="transient-desc">${err.message || 'Error occurred.'}</div>
            </div>
          `;
          if (typeof showPlayerTransientOverlay === 'function') {
            showPlayerTransientOverlay(errorHtml, 2500);
          }
        }
        try {
          lucide.createIcons();
        } catch(e) {}
      };
    }

    // Kaldığım Yeri YouTube'a Eşitle Butonu logic
    const btnSyncWatchtime = document.getElementById('inline-btn-sync-watchtime');
    if (btnSyncWatchtime) {
      btnSyncWatchtime.onclick = async () => {
        const lang = (localDb && localDb.settings && localDb.settings.lang) || currentLang || 'tr';
        const isEn = lang === 'en';
        
        let currentTime = 0;
        if (videoPlayerInstance && typeof videoPlayerInstance.currentTime === 'number') {
          currentTime = videoPlayerInstance.currentTime;
        } else {
          const v = document.querySelector('#inline-player-container video, #inline-player-body video');
          if (v) currentTime = v.currentTime || 0;
        }

        const mins = Math.floor(currentTime / 60);
        const secs = Math.floor(currentTime % 60);
        const timeStr = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;

        // Görsel transient kart göster
        const loadingHtml = `
          <div class="player-transient-card">
            <i data-lucide="bookmark-check" style="width: 36px; height: 36px; color: #a855f7; animation: pulse 1s infinite;"></i>
            <div class="transient-title">${isEn ? 'Syncing to YouTube...' : 'YouTube\'a Eşitleniyor...'}</div>
            <div class="transient-desc">${isEn ? `Syncing current position (${timeStr}) with YouTube Watch History` : `Kaldığınız yer (${timeStr}) YouTube izleme geçmişinize kaydediliyor...`}</div>
          </div>
        `;
        if (typeof showPlayerTransientOverlay === 'function') {
          showPlayerTransientOverlay(loadingHtml, 3000);
        }
        try { lucide.createIcons(); } catch(e) {}

        try {
          const targetVideoId = videoId || currentPlayingVideoId;
          if (!targetVideoId) {
            showToast(isEn ? 'No active video found.' : 'Aktif video bulunamadı.', 'error');
            return;
          }
          const item = localDb?.history?.find(h => h.id === targetVideoId);
          const res = await fetch(`/api/video/${targetVideoId}/sync-watchtime`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              currentTime,
              title: item ? item.title : '',
              silent: false
            })
          });
          const data = await res.json();
          if (data.success) {
            const successHtml = `
              <div class="player-transient-card">
                <i data-lucide="check-circle" style="width: 36px; height: 36px; color: #4ade80;"></i>
                <div class="transient-title">${isEn ? 'Position Synced!' : 'YouTube Eşitlendi!'}</div>
                <div class="transient-desc">${isEn ? `Saved at ${timeStr} in your YouTube Watch History.` : `YouTube izleme geçmişinizde ${timeStr} olarak kaydedildi.`}</div>
              </div>
            `;
            if (typeof showPlayerTransientOverlay === 'function') {
              showPlayerTransientOverlay(successHtml, 3000);
            }
          } else {
            showToast(data.error || (isEn ? 'Failed to sync position.' : 'Eşitleme başarısız oldu.'), 'error');
          }
        } catch (err) {
          console.error('Watchtime sync error:', err);
          showToast(isEn ? 'Communication error.' : 'Sunucu ile iletişim hatası.', 'error');
        }
        try { lucide.createIcons(); } catch(e) {}
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

      const isShort = isShortVideo(videoDuration, videoTitle, videoChannelId);
      modal.classList.remove('hidden');
      resetAndApplyPlayerDimensions(isShort, false);

      const minBtn = document.getElementById('minimize-player-modal-btn');
      if (minBtn) {
        const icon = minBtn.querySelector('i') || minBtn.querySelector('[data-lucide]');
        if (icon) {
          icon.setAttribute('data-lucide', 'minus');
        }
        minBtn.title = localDb.settings && localDb.settings.lang === 'en' ? 'Minimize' : 'Küçült';
      }
      try {
        if (typeof lucide !== 'undefined') lucide.createIcons();
      } catch (e) {}

      playerContainer = modal.querySelector('.player-modal-body');
    }
  }

  seekedForCurrentVideo = false;
  currentPlayingVideoId = videoId;

  const isCompleted = video && video.status === 'completed';
  const isMissing = video && video.fileMissing === true;
  let streamUrl = `/api/video-stream?videoId=${videoId}`;

  // Eğer WPF Player (WebView2) içindeysek ve video indirilmesi tamamlanmış yerel bir video ise doğrudan sanal yerel disk yolunu kullan
  if (isCompleted && !isMissing && window.chrome?.webview && video.filePath) {
    const pathNormalized = video.filePath.replace(/\\/g, '/');
    const match = pathNormalized.match(/^([a-zA-Z]):\/(.*)$/);
    if (match) {
      const driveLetter = match[1].toLowerCase();
      const relativePath = match[2];
      const encodedPath = relativePath.split('/').map(seg => encodeURIComponent(seg)).join('/');
      streamUrl = `http://haytool-${driveLetter}.local/${encodedPath}`;
    } else {
      streamUrl = `file:///${encodeURI(pathNormalized)}`;
    }
  }

  const playerType = (localDb.settings && localDb.settings.playerType) || 'plyr';
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
          rawVideo.addEventListener('play', () => sendPlayerActivity(true));
          rawVideo.addEventListener('pause', () => {
            sendPlayerActivity(false);
            autoSyncWatchtimeHelper(currentPlayingVideoId, rawVideo.currentTime, true);
          });
          rawVideo.addEventListener('ended', () => {
            sendPlayerActivity(false);
            autoSyncWatchtimeHelper(currentPlayingVideoId, rawVideo.currentTime, true);
          });
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

            // Periyodik (her 30sn) YouTube izleme süresi senkronizasyonu
            autoSyncWatchtimeHelper(currentPlayingVideoId, currentTime, false);

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

          videoPlayerInstance.on('play', () => sendPlayerActivity(true));
          videoPlayerInstance.on('pause', () => {
            sendPlayerActivity(false);
            autoSyncWatchtimeHelper(currentPlayingVideoId, videoPlayerInstance.currentTime, true);
          });
          videoPlayerInstance.on('ended', () => {
            sendPlayerActivity(false);
            autoSyncWatchtimeHelper(currentPlayingVideoId, videoPlayerInstance.currentTime, true);
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

            // Periyodik (her 30sn) YouTube izleme süresi senkronizasyonu
            autoSyncWatchtimeHelper(currentPlayingVideoId, currentTime, false);

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

            // Periyodik (her 30sn) YouTube izleme süresi senkronizasyonu
            autoSyncWatchtimeHelper(currentPlayingVideoId, currentTime, false);

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

          player.addEventListener('play', () => sendPlayerActivity(true));
          player.addEventListener('pause', () => {
            sendPlayerActivity(false);
            autoSyncWatchtimeHelper(currentPlayingVideoId, player.currentTime, true);
          });
          player.addEventListener('ended', () => {
            sendPlayerActivity(false);
            autoSyncWatchtimeHelper(currentPlayingVideoId, player.currentTime, true);
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

  // Otomatik izleme süresi senkronizasyonu
  if (currentPlayingVideoId && localDb?.settings?.autoSyncWatchtime !== false) {
    let lastTime = 0;
    if (videoPlayerInstance && typeof videoPlayerInstance.currentTime === 'number') {
      lastTime = videoPlayerInstance.currentTime;
    } else {
      const v = document.querySelector('#inline-player-container video, #inline-player-body video');
      if (v) lastTime = v.currentTime || 0;
    }
    if (lastTime > 5) {
      fetch(`/api/video/${currentPlayingVideoId}/sync-watchtime`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentTime: lastTime, silent: true })
      }).catch(() => {});
    }
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
    if (downloadedFilterChannel.startsWith('category:')) {
      const catId = parseInt(downloadedFilterChannel.split(':')[1], 10);
      const channelIdsInCat = (localDb.channels || []).filter(c => (c.categoryIds || [c.categoryId || 1]).includes(catId)).map(c => c.id);
      const channelIdsInCatSet = new Set(channelIdsInCat);
      filteredDownloaded = filteredDownloaded.filter(item => channelIdsInCatSet.has(item.channelId));
    } else {
      filteredDownloaded = filteredDownloaded.filter(item => item.channelId === downloadedFilterChannel);
    }
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
    const playlistQualityHtml = item.actualQuality ? `<span class="playlist-item-quality quality-${item.actualQuality.toLowerCase()}">${item.actualQuality}</span>` : '';

    itemEl.innerHTML = `
      <div class="playlist-item-thumbnail-wrapper">
        <img class="playlist-item-thumbnail" src="/api/video/${item.id}/thumbnail" alt="${escapeHtml(item.title)}" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22100%22 height=%2256%22><rect width=%22100%22 height=%2256%22 fill=%22%2316142a%22/><text x=%2250%25%22 y=%2250%25%22 dominant-baseline=%22middle%22 text-anchor=%22middle%22 fill=%22%2394a3b8%22 font-family=%22sans-serif%22 font-size=%228%22>No Image</text></svg>'">
        ${playlistQualityHtml}
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

// Türkçe Açıklama: Fare video kapağı üzerine geldiğinde yüksek çözünürlüklü (HQ) 7 farklı kapak karesi arasında 400ms aralıklarla akıcı geçiş yapar.
window.handleThumbMouseEnter = function(wrapperEl) {
  if (!wrapperEl || (window.dbSettings && window.dbSettings.enableAltThumbnailsHover === false)) return;
  const videoId = wrapperEl.getAttribute('data-video-id');
  if (!videoId) return;

  const imgEl = wrapperEl.querySelector('.video-thumbnail');
  if (!imgEl) return;

  if (!wrapperEl.dataset.origSrc) {
    wrapperEl.dataset.origSrc = imgEl.src;
  }

  // 4 Yüksek Çözünürlüklü (HQ/HD) kapak ve frame döngü listesi
  // Sıralama: Orijinal Kapak -> HQ Kare 1 -> HQ Kare 2 -> HQ Kare 3 -> Tekrar Başa (Orijinal Kapak)
  const altUrls = [
    wrapperEl.dataset.origSrc,
    `https://img.youtube.com/vi/${videoId}/hq1.jpg`,
    `https://img.youtube.com/vi/${videoId}/hq2.jpg`,
    `https://img.youtube.com/vi/${videoId}/hq3.jpg`
  ];

  // HD görselleri önceden yükle (Belirli bir kare açılmazsa otomatik orijinal resme düşer)
  altUrls.forEach((url, idx) => {
    if (idx === 0) return;
    const pImg = new Image();
    pImg.onerror = () => {
      altUrls[idx] = wrapperEl.dataset.origSrc;
    };
    pImg.src = url;
  });

  let currentIndex = 0;
  if (wrapperEl._thumbTimer) clearInterval(wrapperEl._thumbTimer);

  wrapperEl._thumbTimer = setInterval(() => {
    currentIndex = (currentIndex + 1) % altUrls.length;
    imgEl.src = altUrls[currentIndex];
  }, 666);
};

window.handleThumbMouseLeave = function(wrapperEl) {
  if (!wrapperEl) return;
  if (wrapperEl._thumbTimer) {
    clearInterval(wrapperEl._thumbTimer);
    wrapperEl._thumbTimer = null;
  }
  const imgEl = wrapperEl.querySelector('.video-thumbnail');
  if (imgEl && wrapperEl.dataset.origSrc) {
    imgEl.src = wrapperEl.dataset.origSrc;
    imgEl.style.opacity = '1';
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

  // Otomatik izleme süresi senkronizasyonu
  if (currentPlayingVideoId) {
    let lastTime = 0;
    if (videoPlayerInstance && typeof videoPlayerInstance.currentTime === 'number') {
      lastTime = videoPlayerInstance.currentTime;
    } else {
      const v = document.querySelector('#player-modal video, #embedded-video-player');
      if (v) lastTime = v.currentTime || 0;
    }
    autoSyncWatchtimeHelper(currentPlayingVideoId, lastTime, true);
  }

  if (modal) {
    modal.classList.add('hidden');
    modal.classList.remove('is-short-player');
    modal.classList.remove('minimized');
    
    // Reset position & dimensions to default bottom-right
    const modalContent = modal.querySelector('.player-modal-content');
    const modalBody = modal.querySelector('.player-modal-body');
    if (modalContent) {
      modalContent.style.left = '';
      modalContent.style.top = '';
      modalContent.style.bottom = '';
      modalContent.style.right = '';
      modalContent.style.width = '';
      modalContent.style.height = '';
    }
    if (modalBody) {
      modalBody.style.height = '';
      modalBody.style.aspectRatio = '';
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
window.openYouTube = async function(videoId) {
  try {
    await fetch('/api/open-youtube', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ videoId })
    });
  } catch (err) {
    window.open(`https://www.youtube.com/watch?v=${videoId}`, '_blank');
  }
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
  const isEn = localDb.settings && localDb.settings.lang === 'en';
  deleteModalMsg.innerHTML = isEn 
    ? `Are you sure you want to remove <strong>"${escapeHtml(item.title)}"</strong> from download history?`
    : `<strong>"${escapeHtml(item.title)}"</strong> başlıklı videoyu geçmişten kaldırmak istediğinize emin misiniz?`;
  
  // Bilgisayardan dosya silme kutusunu göster
  const checkboxContainers = deleteModal.querySelectorAll('.checkbox-container');
  checkboxContainers.forEach(c => c.classList.remove('hidden'));
  if (deleteFileCheckbox) deleteFileCheckbox.checked = true;
  
  // YouTube'da izlendi olarak işaretleme tercihi (settings / localStorage)
  const markWatchedCb = document.getElementById('mark-watched-checkbox');
  if (markWatchedCb) {
    let savedPreference = true;
    if (localDb.settings && typeof localDb.settings.markWatchedOnDelete === 'boolean') {
      savedPreference = localDb.settings.markWatchedOnDelete;
    } else {
      const stored = localStorage.getItem('haytool_mark_watched_on_delete');
      if (stored !== null) savedPreference = (stored === 'true');
    }
    markWatchedCb.checked = savedPreference;
  }

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
    const deleteFile = deleteFileCheckbox ? deleteFileCheckbox.checked : true;
    const markWatchedCb = document.getElementById('mark-watched-checkbox');
    const markWatched = markWatchedCb ? markWatchedCb.checked : false;

    // Tercihi kalıcı olarak sakla
    localStorage.setItem('haytool_mark_watched_on_delete', String(markWatched));
    if (localDb.settings && localDb.settings.markWatchedOnDelete !== markWatched) {
      localDb.settings.markWatchedOnDelete = markWatched;
      try {
        fetch('/api/settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(localDb.settings)
        }).catch(() => {});
      } catch (e) {}
    }

    hideDeleteModal();
    
    try {
      const isEn = localDb.settings && localDb.settings.lang === 'en';
      showToast(isEn ? 'Processing deletion...' : 'İşlem gerçekleştiriliyor...', 'info');
      const res = await fetch(`/api/history/${id}?deleteFile=${deleteFile}&markWatched=${markWatched}`, {
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
        showToast(data.error || (isEn ? 'Deletion failed.' : 'Silme işlemi başarısız oldu.'), 'error');
      }
    } catch (err) {
      showToast(isEn ? 'Communication error.' : 'Sunucu ile iletişim hatası.', 'error');
    }
  });
}

// === FILTER PERSISTENCE SYSTEM (KÜTÜPHANE & İNDİRİLENLER) ===
function saveHistoryFilterState() {
  try {
    const channelSelect = document.getElementById('history-channel-filter');
    const durationSelect = document.getElementById('history-duration-filter');
    const dateSelect = document.getElementById('history-date-filter');
    const showShortsCb = document.getElementById('history-show-shorts');
    const showLiveCb = document.getElementById('history-show-live');
    const showMembersCb = document.getElementById('history-show-members');
    const noAutoDlCb = document.getElementById('history-only-no-auto-download');
    const notDownloadedCb = document.getElementById('history-only-not-downloaded');
    const showHiddenCb = document.getElementById('history-show-hidden');

    const state = {
      channel: channelSelect ? channelSelect.value : (window.historyFilterChannel || 'all'),
      duration: durationSelect ? durationSelect.value : 'off',
      date: dateSelect ? dateSelect.value : (window.historyFilterDays || 'all'),
      showShorts: showShortsCb ? showShortsCb.checked : false,
      showLive: showLiveCb ? showLiveCb.checked : true,
      showMembers: showMembersCb ? showMembersCb.checked : (window.historyShowMembers !== false),
      noAutoDownload: noAutoDlCb ? noAutoDlCb.checked : !!window.historyOnlyNoAutoDownload,
      notDownloaded: notDownloadedCb ? notDownloadedCb.checked : !!window.historyOnlyNotDownloaded,
      showHidden: showHiddenCb ? showHiddenCb.checked : !!window.historyShowHidden,
      viewMode: typeof historyViewMode !== 'undefined' ? historyViewMode : 'grid'
    };

    localStorage.setItem('haytool_history_filters_v2', JSON.stringify(state));
  } catch (err) {
    console.error('saveHistoryFilterState error:', err);
  }
}
window.saveHistoryFilterState = saveHistoryFilterState;

function restoreHistoryFilterState() {
  try {
    const raw = localStorage.getItem('haytool_history_filters_v2');
    if (!raw) return;
    const state = JSON.parse(raw);

    if (state.channel !== undefined) {
      window.historyFilterChannel = state.channel;
      const channelSelect = document.getElementById('history-channel-filter');
      if (channelSelect) channelSelect.value = state.channel;
    }

    if (state.duration !== undefined) {
      const durationSelect = document.getElementById('history-duration-filter');
      if (durationSelect) durationSelect.value = state.duration;
      if (!localDb.settings) localDb.settings = {};
      localDb.settings.historyDurationFilter = state.duration;
    }

    if (state.date !== undefined) {
      window.historyFilterDays = state.date;
      const dateSelect = document.getElementById('history-date-filter');
      if (dateSelect) dateSelect.value = state.date;
    }

    if (state.noAutoDownload !== undefined) window.historyOnlyNoAutoDownload = !!state.noAutoDownload;
    if (state.notDownloaded !== undefined) window.historyOnlyNotDownloaded = !!state.notDownloaded;
    if (state.showMembers !== undefined) window.historyShowMembers = state.showMembers !== false;
    if (state.showHidden !== undefined) window.historyShowHidden = !!state.showHidden;

    const checkMap = {
      'history-show-shorts': state.showShorts,
      'history-show-live': state.showLive,
      'history-show-members': window.historyShowMembers !== false,
      'history-only-no-auto-download': window.historyOnlyNoAutoDownload,
      'history-only-not-downloaded': window.historyOnlyNotDownloaded,
      'history-show-hidden': window.historyShowHidden
    };

    for (const [id, val] of Object.entries(checkMap)) {
      if (val !== undefined) {
        const cb = document.getElementById(id);
        if (cb) cb.checked = !!val;
        if (typeof syncFilterChipUI === 'function') syncFilterChipUI(id);
      }
    }

    if (state.viewMode) {
      window.historyViewMode = state.viewMode;
      const viewGridBtn = document.getElementById('view-grid-btn');
      const viewListBtn = document.getElementById('view-list-btn');
      if (viewGridBtn && viewListBtn) {
        viewGridBtn.classList.toggle('active', state.viewMode === 'grid');
        viewListBtn.classList.toggle('active', state.viewMode === 'list');
      }
    }
  } catch (err) {
    console.error('restoreHistoryFilterState error:', err);
  }
}
window.restoreHistoryFilterState = restoreHistoryFilterState;

function saveDownloadedFilterState() {
  try {
    const channelSelect = document.getElementById('downloaded-channel-filter');
    const showShortsCb = document.getElementById('downloaded-show-shorts');

    const state = {
      channel: channelSelect ? channelSelect.value : 'all',
      sortVal: typeof downloadedSortVal !== 'undefined' ? downloadedSortVal : 'date-desc',
      showShorts: showShortsCb ? showShortsCb.checked : false,
      viewMode: typeof downloadedViewMode !== 'undefined' ? downloadedViewMode : 'grid'
    };

    localStorage.setItem('haytool_downloaded_filters_v2', JSON.stringify(state));
  } catch (err) {
    console.error('saveDownloadedFilterState error:', err);
  }
}
window.saveDownloadedFilterState = saveDownloadedFilterState;

function restoreDownloadedFilterState() {
  try {
    const raw = localStorage.getItem('haytool_downloaded_filters_v2');
    if (!raw) return;
    const state = JSON.parse(raw);

    const channelSelect = document.getElementById('downloaded-channel-filter');
    if (channelSelect && state.channel) {
      channelSelect.value = state.channel;
      window.downloadedFilterChannel = state.channel;
    }

    if (state.sortVal) {
      window.downloadedSortVal = state.sortVal;
      localStorage.setItem('downloaded-sort-val', state.sortVal);
      const group = document.getElementById('downloaded-sort-group');
      if (group) {
        group.querySelectorAll('.sort-btn').forEach(b => {
          b.classList.toggle('active', b.getAttribute('data-sort') === state.sortVal);
        });
      }
    }

    const showShortsCb = document.getElementById('downloaded-show-shorts');
    if (showShortsCb && state.showShorts !== undefined) {
      showShortsCb.checked = !!state.showShorts;
      const inlineCb = document.getElementById('inline-playlist-show-shorts');
      if (inlineCb) inlineCb.checked = !!state.showShorts;
    }

    if (state.viewMode) {
      window.downloadedViewMode = state.viewMode;
      const gridBtn = document.getElementById('downloaded-view-grid-btn');
      const listBtn = document.getElementById('downloaded-view-list-btn');
      if (gridBtn && listBtn) {
        gridBtn.classList.toggle('active', state.viewMode === 'grid');
        listBtn.classList.toggle('active', state.viewMode === 'list');
      }
    }
  } catch (err) {
    console.error('restoreDownloadedFilterState error:', err);
  }
}
window.restoreDownloadedFilterState = restoreDownloadedFilterState;

if (viewGridBtn) {
  viewGridBtn.addEventListener('click', () => {
    historyViewMode = 'grid';
    saveHistoryFilterState();
    updateUI(localDb);
  });
}

if (viewListBtn) {
  viewListBtn.addEventListener('click', () => {
    historyViewMode = 'list';
    saveHistoryFilterState();
    updateUI(localDb);
  });
}

if (historyChannelFilter) {
  historyChannelFilter.addEventListener('change', () => {
    historyFilterChannel = historyChannelFilter.value;
    saveHistoryFilterState();
    updateUI(localDb);
  });
}

// Hızlı Tarih Filtreleme Seçim Dinleyicisi
if (historyDateFilter) {
  historyDateFilter.addEventListener('change', () => {
    historyFilterDays = historyDateFilter.value;
    saveHistoryFilterState();
    updateUI(localDb);
  });
}

const historyClearDateFilterBtn = document.getElementById('history-clear-date-filter');
if (historyClearDateFilterBtn) {
  historyClearDateFilterBtn.addEventListener('click', () => {
    if (historyDateFilter) {
      historyDateFilter.value = 'all';
    }
    historyFilterDays = 'all';
    saveHistoryFilterState();
    updateUI(localDb);
  });
}

if (downloadedViewGridBtn) {
  downloadedViewGridBtn.addEventListener('click', () => {
    downloadedViewMode = 'grid';
    saveDownloadedFilterState();
    updateUI(localDb);
  });
}

if (downloadedViewListBtn) {
  downloadedViewListBtn.addEventListener('click', () => {
    downloadedViewMode = 'list';
    saveDownloadedFilterState();
    updateUI(localDb);
  });
}

if (downloadedChannelFilter) {
  downloadedChannelFilter.addEventListener('change', () => {
    downloadedFilterChannel = downloadedChannelFilter.value;
    saveDownloadedFilterState();
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
    saveDownloadedFilterState();
    
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
  const savedLang = localStorage.getItem('haytool_user_lang');
  if (savedLang) {
    applyLanguage(savedLang);
  }
  restoreHistoryFilterState();
  restoreDownloadedFilterState();

  const historyOnlyNoAutoDownloadCheck = document.getElementById('history-only-no-auto-download');
  if (historyOnlyNoAutoDownloadCheck) {
    historyOnlyNoAutoDownloadCheck.addEventListener('change', () => {
      historyOnlyNoAutoDownload = historyOnlyNoAutoDownloadCheck.checked;
      syncFilterChipUI('history-only-no-auto-download');
      saveHistoryFilterState();
      updateUI(localDb);
    });
  }

  const historyOnlyNotDownloadedCheck = document.getElementById('history-only-not-downloaded');
  if (historyOnlyNotDownloadedCheck) {
    historyOnlyNotDownloadedCheck.addEventListener('change', () => {
      historyOnlyNotDownloaded = historyOnlyNotDownloadedCheck.checked;
      syncFilterChipUI('history-only-not-downloaded');
      saveHistoryFilterState();
      updateUI(localDb);
    });
  }

  const historyOnlyLiveProcessingCheck = document.getElementById('history-only-live-processing');
  if (historyOnlyLiveProcessingCheck) {
    historyOnlyLiveProcessingCheck.addEventListener('change', () => {
      window.historyOnlyLiveProcessing = historyOnlyLiveProcessingCheck.checked;
      syncFilterChipUI('history-only-live-processing');
      saveHistoryFilterState();
      updateUI(localDb);
    });
  }

  const historyShowMembersCheck = document.getElementById('history-show-members');
  if (historyShowMembersCheck) {
    historyShowMembersCheck.addEventListener('change', () => {
      window.historyShowMembers = historyShowMembersCheck.checked;
      syncFilterChipUI('history-show-members');
      saveHistoryFilterState();
      updateUI(localDb);
    });
  }

  const historyShowHiddenCheck = document.getElementById('history-show-hidden');
  if (historyShowHiddenCheck) {
    historyShowHiddenCheck.addEventListener('change', () => {
      historyShowHidden = historyShowHiddenCheck.checked;
      syncFilterChipUI('history-show-hidden');
      saveHistoryFilterState();
      updateUI(localDb);
    });
  }

// === FILTER CHIP HELPERS ===
function toggleFilterChip(checkboxId) {
  const cb = document.getElementById(checkboxId);
  if (!cb) return;
  cb.checked = !cb.checked;
  cb.dispatchEvent(new Event('change'));
  syncFilterChipUI(checkboxId);
}
window.toggleFilterChip = toggleFilterChip;

function syncFilterChipUI(checkboxId) {
  const cb = document.getElementById(checkboxId);
  if (!cb) return;
  const chipMap = {
    'history-show-hidden': 'btn-filter-show-hidden',
    'history-only-not-downloaded': 'btn-filter-not-downloaded',
    'history-only-live-processing': 'btn-filter-live-processing',
    'history-show-members': 'btn-filter-show-members',
    'history-show-shorts': 'btn-filter-show-shorts',
    'history-show-live': 'btn-filter-show-live',
    'history-only-no-auto-download': 'btn-filter-no-auto-download'
  };
  const btnId = chipMap[checkboxId];
  if (btnId) {
    const chipBtn = document.getElementById(btnId);
    if (chipBtn) chipBtn.classList.toggle('active', cb.checked);
  }
}
window.syncFilterChipUI = syncFilterChipUI;

  const historyShowShorts = document.getElementById('history-show-shorts');
  if (historyShowShorts) {
    historyShowShorts.addEventListener('change', async () => {
      const showShorts = historyShowShorts.checked;
      syncFilterChipUI('history-show-shorts');
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
      if (inlineCheckbox) inlineCheckbox.checked = showShorts;

      const histCheckbox = document.getElementById('history-show-shorts');
      if (histCheckbox) histCheckbox.checked = showShorts;

      const settCheckbox = document.getElementById('settings-showshorts');
      if (settCheckbox) settCheckbox.checked = showShorts;

      if (typeof saveDownloadedFilterState === 'function') saveDownloadedFilterState();
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

// Türkçe Açıklama: Üst bardaki hava durumu rozetini API'den çekilen anlık sıcaklık ve ikon verileriyle günceller.
/**
 * Hava durumu bilgilerini /api/weather üzerinden sorgular ve üst bardaki rozete yansıtır.
 * 
 * @param {boolean} [force=false] Önbelleği atlayarak taze veri isteği
 * @returns {Promise<void>}
 */
async function updateWeatherBadge(force = false) {
  const badge = document.getElementById('badge-weather');
  const display = document.getElementById('weather-display');
  const iconEl = document.getElementById('weather-icon');
  if (!badge || !display) return;

  if (localDb.settings && localDb.settings.weatherEnabled === false) {
    badge.style.display = 'none';
    return;
  }
  badge.style.display = 'inline-flex';

  try {
    const res = await fetch(`/api/weather${force ? '?force=true' : ''}`);
    const data = await res.json();
    if (data.success && data.enabled !== false) {
      display.textContent = `${data.temp}${data.unit}`;
      
      if (iconEl) {
        iconEl.setAttribute('data-lucide', data.icon || 'sun');
        lucide.createIcons();
      }

      const langKey = data.descKey || 'weather_partly_cloudy';
      const desc = (typeof i18n !== 'undefined' && i18n.t) ? i18n.t(langKey) : data.defaultDesc;
      const feelsLikeLabel = (typeof i18n !== 'undefined' && i18n.t) ? i18n.t('weather_feels_like') : 'Hissedilen';
      const humidityLabel = (typeof i18n !== 'undefined' && i18n.t) ? i18n.t('weather_humidity') : 'Nem';
      const windLabel = (typeof i18n !== 'undefined' && i18n.t) ? i18n.t('weather_wind') : 'Rüzgar';

      badge.title = `${data.city}: ${desc} (${data.temp}${data.unit})\n${feelsLikeLabel}: ${data.feelsLike}${data.unit} | ${humidityLabel}: %${data.humidity} | ${windLabel}: ${data.windSpeed} km/s\n(Tıklayarak Yenileyin)`;
    } else if (data.enabled === false) {
      badge.style.display = 'none';
    } else {
      display.textContent = '--°';
    }
  } catch (err) {
    display.textContent = '--°';
  }
}

// Hava Durumu Rozeti ve Ayar Butonları Dinleyicileri
document.addEventListener('DOMContentLoaded', () => {
  const badgeWeather = document.getElementById('badge-weather');
  if (badgeWeather) {
    badgeWeather.addEventListener('click', async () => {
      showToast('Hava durumu güncelleniyor...', 'info');
      await updateWeatherBadge(true);
      showToast('Hava durumu güncellendi.', 'success');
    });
  }

  const weatherToggle = document.getElementById('settings-weatherenabled');
  if (weatherToggle) {
    weatherToggle.addEventListener('change', () => {
      const details = document.getElementById('weather-settings-details');
      if (details) details.style.display = weatherToggle.checked ? 'block' : 'none';
      const badge = document.getElementById('badge-weather');
      if (badge) badge.style.display = weatherToggle.checked ? 'inline-flex' : 'none';
    });
  }

  // Şehir Arama Butonu
  const btnWeatherSearch = document.getElementById('btn-weather-search');
  const cityInput = document.getElementById('settings-weathercity');
  const suggestionsBox = document.getElementById('weather-city-suggestions');

  async function performCitySearch() {
    if (!cityInput || !suggestionsBox) return;
    const query = cityInput.value.trim();
    if (!query || query.length < 2) {
      showToast('Lütfen en az 2 karakterli bir şehir adı girin.', 'warning');
      return;
    }

    try {
      suggestionsBox.innerHTML = '<div style="padding: 8px 12px; color: var(--text-muted); font-size: 0.8rem;">Aranıyor...</div>';
      suggestionsBox.classList.remove('hidden');

      const res = await fetch(`/api/weather/geocode?query=${encodeURIComponent(query)}`);
      const data = await res.json();
      
      if (!data.results || data.results.length === 0) {
        suggestionsBox.innerHTML = '<div style="padding: 8px 12px; color: var(--text-muted); font-size: 0.8rem;">Sonuç bulunamadı.</div>';
        return;
      }

      suggestionsBox.innerHTML = '';
      data.results.forEach(item => {
        const row = document.createElement('div');
        row.style.padding = '8px 12px';
        row.style.cursor = 'pointer';
        row.style.fontSize = '0.85rem';
        row.style.borderBottom = '1px solid rgba(255,255,255,0.05)';
        row.style.color = 'var(--text-main)';
        row.style.transition = 'background 0.2s';
        row.innerHTML = `<strong>${item.name}</strong> <span style="color: var(--text-muted); font-size: 0.75rem;">(${item.admin1 ? item.admin1 + ', ' : ''}${item.country})</span> <span style="float: right; color: #00f2fe; font-size: 0.75rem;">${item.latitude.toFixed(2)}, ${item.longitude.toFixed(2)}</span>`;

        row.addEventListener('mouseenter', () => { row.style.background = 'rgba(255,255,255,0.08)'; });
        row.addEventListener('mouseleave', () => { row.style.background = 'transparent'; });

        row.addEventListener('click', () => {
          cityInput.value = item.name;
          const latInput = document.getElementById('settings-weatherlatitude');
          const lonInput = document.getElementById('settings-weatherlongitude');
          if (latInput) latInput.value = item.latitude;
          if (lonInput) lonInput.value = item.longitude;
          suggestionsBox.classList.add('hidden');

          if (typeof triggerAutoSave === 'function') {
            triggerAutoSave(true);
          }
        });

        suggestionsBox.appendChild(row);
      });
    } catch (err) {
      suggestionsBox.innerHTML = '<div style="padding: 8px 12px; color: var(--danger-color); font-size: 0.8rem;">Arama başarısız oldu.</div>';
    }
  }

  if (btnWeatherSearch) {
    btnWeatherSearch.addEventListener('click', performCitySearch);
  }
  if (cityInput) {
    cityInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        performCitySearch();
      }
    });
  }

  // Dışarı tıklandığında öneri kutusunu kapat
  document.addEventListener('click', (e) => {
    if (suggestionsBox && !suggestionsBox.contains(e.target) && e.target !== btnWeatherSearch && e.target !== cityInput) {
      suggestionsBox.classList.add('hidden');
    }
  });

  // GPS Butonu
  const btnWeatherGps = document.getElementById('btn-weather-gps');
  if (btnWeatherGps) {
    btnWeatherGps.addEventListener('click', () => {
      if (!navigator.geolocation) {
        showToast('Tarayıcınız konum servisini desteklemiyor.', 'warning');
        return;
      }

      showToast('Mevcut GPS konumu alınıyor...', 'info');
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = parseFloat(pos.coords.latitude.toFixed(4));
          const lon = parseFloat(pos.coords.longitude.toFixed(4));
          const latInput = document.getElementById('settings-weatherlatitude');
          const lonInput = document.getElementById('settings-weatherlongitude');
          if (latInput) latInput.value = lat;
          if (lonInput) lonInput.value = lon;

          showToast(`Konum alındı: ${lat}, ${lon}`, 'success');
          if (typeof triggerAutoSave === 'function') {
            triggerAutoSave(true);
          }
        },
        (err) => {
          showToast('GPS konumu alınamadı. Lütfen tarayıcı konum iznini kontrol edin veya şehir arayın.', 'error');
        },
        { timeout: 10000 }
      );
    });
  }
});

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

/**
 * Kanallar sekmesindeki aktif arama ve filtre seçimlerini nesne olarak döner.
 * @returns {{ searchQuery: string, autoDownload: string, shortsDownload: string }}
 */
export function getChannelActiveFilters() {
  const searchInput = document.getElementById('channel-list-search-input');
  const autoSelect = document.getElementById('filter-channel-auto-download');
  const shortsSelect = document.getElementById('filter-channel-shorts-download');

  return {
    searchQuery: searchInput ? searchInput.value : '',
    autoDownload: autoSelect ? autoSelect.value : 'all',
    shortsDownload: shortsSelect ? shortsSelect.value : 'all'
  };
}
window.getChannelActiveFilters = getChannelActiveFilters;

/**
 * Kanallar sekmesinde arama veya filtreler değiştiğinde kanal listesini anlık yeniden render eder.
 */
export function handleChannelFilterChange() {
  if (!window.localDb || !window.localDb.channels) return;
  const channelsList = document.getElementById('channels-list');
  if (!channelsList) return;
  const lang = (window.localDb.settings && window.localDb.settings.lang) || currentLang || 'tr';
  const t = translations[lang] || translations.tr;
  const filters = getChannelActiveFilters();
  renderChannelsList(channelsList, window.localDb.channels, t, window.localDb.categories, filters);
  try {
    if (typeof lucide !== 'undefined' && lucide.createIcons) {
      lucide.createIcons();
    }
  } catch (e) {}
}
window.handleChannelFilterChange = handleChannelFilterChange;

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

let dragSrcEl = null;

// Türkçe Açıklama: Kuyruk sekmesinin görünüm modunu (table veya cards) değiştirir, buton durumunu günceller, ayarları INI'ye kaydeder ve listeyi yeniden çizer.
/**
 * Kuyruk sekmesi görünüm modunu ayarlar.
 * 
 * @param {'table' | 'cards'} mode Seçilen görünüm modu
 */
window.setQueueViewMode = function(mode) {
  if (mode !== 'table' && mode !== 'cards') mode = 'table';
  
  const tableBtn = document.getElementById('queue-view-table-btn');
  const cardsBtn = document.getElementById('queue-view-cards-btn');
  if (tableBtn && cardsBtn) {
    tableBtn.classList.toggle('active', mode === 'table');
    cardsBtn.classList.toggle('active', mode === 'cards');
  }

  if (window.localDb && window.localDb.settings) {
    window.localDb.settings.queueViewMode = mode;
  }

  localStorage.setItem('haytool_queue_view_mode', mode);

  // Arayüzü güncelle
  if (window.localDb) {
    updateUI(window.localDb);
  }

  try {
    if (typeof lucide !== 'undefined') {
      lucide.createIcons();
    }
  } catch (e) {}

  // Ayarları backend ve config.ini'ye kaydet
  fetch('/api/settings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...(window.localDb ? window.localDb.settings : {}), queueViewMode: mode })
  }).catch(err => console.error('Error saving queueViewMode:', err));
};

// Türkçe Açıklama: Kuyruktaki bir videonun sırasını yukarı veya aşağı yönde bir basamak kaydırır ve sunucuya bildirir.
/**
 * Kuyruk listesindeki videoyu yukarı veya aşağı taşır.
 * 
 * @param {string} videoId Taşınacak videonun ID'si
 * @param {'up' | 'down'} direction Taşıma yönü
 */
window.moveQueueItem = function(videoId, direction) {
  const list = document.getElementById('queue-list');
  if (!list) return;

  const items = Array.from(list.querySelectorAll('[data-id]'));
  const currentIndex = items.findIndex(el => el.getAttribute('data-id') === videoId);
  if (currentIndex === -1) return;

  const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
  if (targetIndex < 0 || targetIndex >= items.length) return;

  const currentEl = items[currentIndex];
  const targetEl = items[targetIndex];

  // Birleştirme (merging) durumundaki video taşınamaz
  if (currentEl.classList.contains('queue-item-merging') || targetEl.classList.contains('queue-item-merging')) {
    return;
  }

  if (direction === 'up') {
    list.insertBefore(currentEl, targetEl);
  } else {
    targetEl.after(currentEl);
  }

  const newOrderIds = Array.from(list.querySelectorAll('[data-id]')).map(el => el.getAttribute('data-id'));

  // Sıra numaralarını ve ok butonlarının aktif/pasif durumlarını hemen güncelle
  updateQueueOrderDOM(list);

  fetch('/api/queue/reorder', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids: newOrderIds })
  }).catch(err => console.error('Error reordering queue via arrow:', err));
};

// Türkçe Açıklama: DOM üzerindeki sıra numarası rozetlerini (#01, #02..) ve ilk/son elemanın ok butonlarının pasiflik durumunu anında senkronize eder.
function updateQueueOrderDOM(listEl) {
  if (!listEl) return;
  const items = Array.from(listEl.querySelectorAll('[data-id]'));
  const total = items.length;

  items.forEach((item, idx) => {
    const badge = item.querySelector('.queue-order-badge');
    if (badge) {
      badge.textContent = `#${(idx + 1).toString().padStart(2, '0')}`;
    }
    const upBtn = item.querySelector('.queue-btn-up');
    const downBtn = item.querySelector('.queue-btn-down');
    if (upBtn) {
      upBtn.disabled = (idx === 0);
      upBtn.classList.toggle('disabled', idx === 0);
    }
    if (downBtn) {
      downBtn.disabled = (idx === total - 1);
      downBtn.classList.toggle('disabled', idx === total - 1);
    }
  });
}
window.updateQueueOrderDOM = updateQueueOrderDOM;

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
window.handleDragStart = handleDragStart;

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
window.handleDragOver = handleDragOver;

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
    if (!list) return false;
    const children = Array.from(list.querySelectorAll('[data-id]'));
    const fromIndex = children.indexOf(dragSrcEl);
    const toIndex = children.indexOf(this);
    
    if (fromIndex < toIndex) {
      this.after(dragSrcEl);
    } else {
      this.before(dragSrcEl);
    }
    
    const newOrderIds = Array.from(list.querySelectorAll('[data-id]')).map(el => el.getAttribute('data-id'));
    
    updateQueueOrderDOM(list);

    fetch('/api/queue/reorder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: newOrderIds })
    }).catch(err => console.error('Error reordering queue:', err));
  }
  
  return false;
}
window.handleDrop = handleDrop;

// Türkçe Açıklama: Sürükleme işlemi bittiğinde elemanların şeffaflıklarını sıfırlayarak görünümü normale döndürür.
/**
 * Sürükleme işlemi bittiğinde tetiklenen olay yöneticisi.
 * 
 * @param {DragEvent} e Sürükleme olayı nesnesi
 */
function handleDragEnd(e) {
  this.style.opacity = '1';
  document.querySelectorAll('#queue-list [data-id]').forEach(item => {
    item.style.opacity = '1';
  });
}
window.handleDragEnd = handleDragEnd;

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

      // Dil değişikliğini anında tüm arayüze canlı olarak uygula
      if (window.localDb && window.localDb.settings) {
        window.localDb.settings.lang = val;
      }
      if (typeof applyLanguage === 'function') {
        applyLanguage(val);
      }

      // Otomatik kaydetmeyi tetikle
      performAutoSave();

      // Üst bildirim mesajı göster
      const langNames = { tr: 'Türkçe', en: 'English', es: 'Español', de: 'Deutsch', pt: 'Português', ar: 'العربية', ru: 'Русский' };
      const chosenLangName = langNames[val] || val;
      const toastMsg = val === 'en' ? `App language updated: ${chosenLangName}` : `Uygulama dili güncellendi: ${chosenLangName}`;
      showToast(toastMsg, 'success');
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

async function checkFfmpegStatus() {
  const langKey = currentLang || (localDb.settings && localDb.settings.lang) || 'tr';
  const t = translations[langKey] || translations.tr;
  try {
    const res = await fetch('/api/ffmpeg/status');
    const data = await res.json();
    
    const banner = document.getElementById('ffmpeg-info-banner');
    const statusIndicator = document.getElementById('settings-ffmpeg-status');
    const settingsBtn = document.getElementById('settings-ffmpeg-btn');
    const versionBadge = document.getElementById('settings-ffmpeg-version-info');
    
    const isEn = langKey === 'en';
    const isAr = langKey === 'ar';
    const isEs = langKey === 'es';
    const isDe = langKey === 'de';
    const isPt = langKey === 'pt';
    const isRu = langKey === 'ru';

    let localPrefix = 'Yerel:';
    let remotePrefix = 'Uzak:';
    if (isEn) { localPrefix = 'Local:'; remotePrefix = 'Remote:'; }
    else if (isEs) { localPrefix = 'Local:'; remotePrefix = 'Remoto:'; }
    else if (isDe) { localPrefix = 'Lokal:'; remotePrefix = 'Remote:'; }
    else if (isPt) { localPrefix = 'Local:'; remotePrefix = 'Remoto:'; }
    else if (isAr) { localPrefix = 'المحلي:'; remotePrefix = 'البعيد:'; }
    else if (isRu) { localPrefix = 'Локально:'; remotePrefix = 'Удаленно:'; }

    if (versionBadge) {
      if (data.installed && data.localVersion) {
        versionBadge.style.display = 'inline-block';
        versionBadge.innerText = `${localPrefix} ${data.localVersion} | ${remotePrefix} ${data.remoteVersion || 'v6.1'}`;
      } else if (data.remoteVersion) {
        versionBadge.style.display = 'inline-block';
        versionBadge.innerText = `${remotePrefix} ${data.remoteVersion}`;
      } else {
        versionBadge.style.display = 'none';
      }
    }

    if (data.installed) {
      if (banner) banner.classList.add('hidden');
      if (statusIndicator) {
        statusIndicator.innerText = t.ffmpeg_status_installed || 'Kurulu';
        statusIndicator.className = 'ffmpeg-status-indicator installed';
      }
      if (settingsBtn) {
        settingsBtn.innerText = t.ffmpeg_btn_reinstall || 'Yeniden Kur';
      }
    } else {
      if (banner && localStorage.getItem('ffmpeg_banner_dismissed') !== 'true') {
        banner.classList.remove('hidden');
      }
      if (statusIndicator) {
        statusIndicator.innerText = t.ffmpeg_status_not_installed || 'Kurulu Değil';
        statusIndicator.className = 'ffmpeg-status-indicator not-installed';
      }
      if (settingsBtn) {
        settingsBtn.innerText = t.ffmpeg_btn_install || 'Kur';
      }
    }
  } catch (err) {
    console.error('Error checking FFmpeg status:', err);
  }
}
window.checkFfmpegStatus = checkFfmpegStatus;

async function installPythonDependencies() {
  const isEn = localDb.settings && localDb.settings.lang === 'en';
  const btn = document.getElementById('btn-install-pip-deps');
  if (btn) btn.disabled = true;
  
  showToast(isEn ? 'Installing pip dependencies (yt-dlp)...' : 'pip bağımlılıkları (yt-dlp) kuruluyor...', 'info');
  
  try {
    const res = await fetch('/api/settings/install-python-dep', { method: 'POST' });
    const data = await res.json();
    if (res.ok && data.success) {
      showToast(isEn ? 'Dependencies installed successfully!' : 'Bağımlılıklar başarıyla kuruldu/güncellendi!', 'success');
    } else {
      showToast(data.error || (isEn ? 'Installation failed.' : 'Kurulum başarısız oldu.'), 'error');
    }
  } catch (err) {
    showToast(isEn ? 'Connection error.' : 'Bağlantı hatası.', 'error');
  } finally {
    if (btn) btn.disabled = false;
  }
}
// FFmpeg Installer Logic
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
updateWeatherBadge();
loadAppVersion();
checkApplicationUpdates();
setInterval(updateDiskSpace, 60 * 60 * 1000); // Her 60 dakikada bir güncelle
setInterval(() => updateWeatherBadge(), 15 * 60 * 1000); // Her 15 dakikada bir hava durumunu güncelle

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
    if (downloadedFilterChannel.startsWith('category:')) {
      const catId = parseInt(downloadedFilterChannel.split(':')[1], 10);
      const channelIdsInCat = (localDb.channels || []).filter(c => (c.categoryIds || [c.categoryId || 1]).includes(catId)).map(c => c.id);
      const channelIdsInCatSet = new Set(channelIdsInCat);
      filteredDownloaded = filteredDownloaded.filter(item => channelIdsInCatSet.has(item.channelId));
    } else {
      filteredDownloaded = filteredDownloaded.filter(item => item.channelId === downloadedFilterChannel);
    }
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


// State variables for folder comparison
let untrackedFilesList = [];
let unrelatedFilesList = [];
let missingFilesList = [];
let scanProgressToast = null;

// Download Folder Comparison tool
async function runFileComparison() {
  const compareBtn = document.getElementById('start-compare-btn');
  const compareLoading = document.getElementById('compare-loading');
  const noIssuesFound = document.getElementById('compare-no-issues');
  const untrackedSection = document.getElementById('untracked-section');
  const unrelatedSection = document.getElementById('unrelated-section');
  const missingSection = document.getElementById('missing-section');
  const compareResults = document.getElementById('compare-results');
  
  if (!compareBtn) return;
  compareBtn.disabled = true;
  
  const isEn = localDb.settings && localDb.settings.lang === 'en';
  const t = translations[localDb.settings?.lang || 'tr'] || translations.tr;
  
  // Show toast when starting comparison
  showToast(isEn ? 'Folder comparison started, scanning physical files...' : 'Dosya karşılaştırması başlatıldı, fiziksel dosyalar taranıyor...', 'info');
  
  // Set button state to comparing
  const compareBtnText = compareBtn.querySelector('#compare-btn-text');
  if (compareBtnText) {
    compareBtnText.textContent = t.compare_btn_running || 'Comparing...';
  }
  if (compareLoading) compareLoading.classList.remove('hidden');
  if (compareResults) compareResults.classList.add('hidden');
  if (noIssuesFound) noIssuesFound.classList.add('hidden');
  if (untrackedSection) untrackedSection.classList.add('hidden');
  if (unrelatedSection) unrelatedSection.classList.add('hidden');
  if (missingSection) missingSection.classList.add('hidden');
  
  try {
    const res = await fetch('/api/tools/compare-files');
    const data = await res.json();
    if (data.success) {
      untrackedFilesList = data.untrackedFiles || [];
      unrelatedFilesList = data.unrelatedFiles || [];
      missingFilesList = data.missingFiles || [];
      
      renderComparisonResults();
    } else {
      showToast(data.error || (isEn ? 'Comparison failed.' : 'Karşılaştırma başarısız.'), 'error');
    }
  } catch (err) {
    showToast(isEn ? 'Connection error.' : 'Bağlantı hatası.', 'error');
  } finally {
    compareBtn.disabled = false;
    if (compareBtnText) {
      compareBtnText.textContent = t.compare_btn || 'Start Comparison';
    }
    if (compareLoading) compareLoading.classList.add('hidden');
  }
}

async function openFileLocation(filePath) {
  const isEn = localDb.settings && localDb.settings.lang === 'en';
  try {
    const res = await fetch('/api/tools/open-file-location', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filePath })
    });
    const data = await res.json();
    if (!data.success) {
      showToast(data.error || (isEn ? 'Could not open folder.' : 'Klasör açılamadı.'), 'error');
    }
  } catch (err) {
    showToast(isEn ? 'Connection error.' : 'Bağlantı hatası.', 'error');
  }
}

async function deleteAllUnrelated() {
  const isEn = localDb.settings && localDb.settings.lang === 'en';
  if (unrelatedFilesList.length === 0) return;
  if (!confirm(isEn ? 'Are you sure you want to delete all unrelated files from disk?' : 'Tüm alakasız dosyaları diskten silmek istediğinize emin misiniz?')) {
    return;
  }
  
  try {
    const res = await fetch('/api/tools/fix-files', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'delete-untracked-file',
        filePaths: unrelatedFilesList.map(f => f.filePath)
      })
    });
    const data = await res.json();
    if (data.success) {
      showToast(data.message || (isEn ? 'Operation successful.' : 'İşlem başarılı.'), 'success');
      runFileComparison();
    } else {
      showToast(data.error || (isEn ? 'Operation failed.' : 'İşlem başarısız.'), 'error');
    }
  } catch (err) {
    showToast(isEn ? 'Connection error.' : 'Bağlantı hatası.', 'error');
  }
}

function renderComparisonResults() {
  const isEn = localDb.settings && localDb.settings.lang === 'en';
  const t = translations[localDb.settings?.lang || 'tr'] || translations.tr;
  
  const noIssuesFound = document.getElementById('compare-no-issues');
  const untrackedSection = document.getElementById('untracked-section');
  const unrelatedSection = document.getElementById('unrelated-section');
  const missingSection = document.getElementById('missing-section');
  const compareResults = document.getElementById('compare-results');
  
  const untrackedBody = document.getElementById('untracked-files-list');
  const unrelatedBody = document.getElementById('unrelated-files-list');
  const missingBody = document.getElementById('missing-files-list');
  
  if (untrackedBody) untrackedBody.innerHTML = '';
  if (unrelatedBody) unrelatedBody.innerHTML = '';
  if (missingBody) missingBody.innerHTML = '';
  
  if (compareResults) compareResults.classList.remove('hidden');
  
  if (untrackedFilesList.length === 0 && unrelatedFilesList.length === 0 && missingFilesList.length === 0) {
    if (noIssuesFound) noIssuesFound.classList.remove('hidden');
    if (untrackedSection) untrackedSection.classList.add('hidden');
    if (unrelatedSection) unrelatedSection.classList.add('hidden');
    if (missingSection) missingSection.classList.add('hidden');
    showToast(isEn ? 'Folder comparison completed. No issues found!' : 'Dosya karşılaştırması tamamlandı. Sorun bulunamadı!', 'success');
    return;
  }
  
  if (noIssuesFound) noIssuesFound.classList.add('hidden');
  
  const summaryBox = document.getElementById('compare-summary-box');
  if (summaryBox) {
    summaryBox.innerHTML = isEn 
      ? `Found ${untrackedFilesList.length} untracked files, ${unrelatedFilesList.length} unrelated files, and ${missingFilesList.length} missing records.`
      : `${untrackedFilesList.length} yetim dosya, ${unrelatedFilesList.length} alakasız dosya ve ${missingFilesList.length} eksik kayıt bulundu.`;
  }
  
  showToast(isEn ? 'Folder comparison completed.' : 'Dosya karşılaştırması tamamlandı.', 'success');
  
  // Untracked Files (Orphans)
  if (untrackedFilesList.length > 0) {
    if (untrackedSection) untrackedSection.classList.remove('hidden');
    untrackedFilesList.forEach(file => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>
          <div class="file-name-cell" title="${file.filePath}">
            <i data-lucide="file-video" class="file-icon"></i>
            <span>${file.filename}</span>
          </div>
        </td>
        <td>${file.channelName || '<span class="text-muted">--</span>'}</td>
        <td class="text-nowrap">${file.fileSize || '--'}</td>
        <td>
          <div class="action-buttons-cell" style="text-align: right;">
            <button class="btn btn-secondary btn-sm" onclick="openFileLocation('${file.filePath.replace(/\\/g, '\\\\')}')" title="${isEn ? 'Open File Location' : 'Dosya Konumunu Aç'}">
              <i data-lucide="external-link"></i>
              <span>${isEn ? 'Open Location' : 'Konumu Aç'}</span>
            </button>
            ${file.id ? `
              <button class="btn btn-primary btn-sm" onclick="fixFileIssue('import', '${file.filePath.replace(/\\/g, '\\\\')}', '${file.id}')">
                <i data-lucide="plus"></i>
                <span>${t.btn_import || 'Import'}</span>
              </button>
            ` : ''}
            <button class="btn btn-danger btn-sm" onclick="fixFileIssue('delete', '${file.filePath.replace(/\\/g, '\\\\')}', '')">
              <i data-lucide="trash-2"></i>
              <span>${t.btn_delete_file || 'Delete'}</span>
            </button>
          </div>
        </td>
      `;
      untrackedBody.appendChild(tr);
    });
  } else {
    if (untrackedSection) untrackedSection.classList.add('hidden');
  }
  
  // Unrelated Files
  if (unrelatedFilesList.length > 0) {
    if (unrelatedSection) unrelatedSection.classList.remove('hidden');
    unrelatedFilesList.forEach(file => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>
          <div class="file-name-cell" title="${file.filePath}">
            <i data-lucide="file" class="file-icon" style="color: var(--text-muted);"></i>
            <span>${file.filename}</span>
          </div>
        </td>
        <td class="text-nowrap">${file.fileSize || '--'}</td>
        <td>
          <div class="action-buttons-cell" style="text-align: right;">
            <button class="btn btn-secondary btn-sm" onclick="openFileLocation('${file.filePath.replace(/\\/g, '\\\\')}')" title="${isEn ? 'Open File Location' : 'Dosya Konumunu Aç'}">
              <i data-lucide="external-link"></i>
              <span>${isEn ? 'Open Location' : 'Konumu Aç'}</span>
            </button>
            <button class="btn btn-danger btn-sm" onclick="fixFileIssue('delete', '${file.filePath.replace(/\\/g, '\\\\')}', '')">
              <i data-lucide="trash-2"></i>
              <span>${t.btn_delete_file || 'Delete'}</span>
            </button>
          </div>
        </td>
      `;
      unrelatedBody.appendChild(tr);
    });
  } else {
    if (unrelatedSection) unrelatedSection.classList.add('hidden');
  }
  
  // Missing Files
  if (missingFilesList.length > 0) {
    if (missingSection) missingSection.classList.remove('hidden');
    missingFilesList.forEach(file => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>
          <div class="file-name-cell" title="${file.filePath || ''}">
            <i data-lucide="video-off" class="file-icon"></i>
            <span>${file.title}</span>
          </div>
        </td>
        <td>${file.channelName || '<span class="text-muted">--</span>'}</td>
        <td>
          <div class="action-buttons-cell" style="text-align: right;">
            <button class="btn btn-primary btn-sm" onclick="downloadMissingVideo('${file.id}', '${escapeHtml(file.title)}', '${escapeHtml(file.channelName || '')}', '${file.channelId || ''}')" title="${isEn ? 'Redownload Video' : 'Videoyu Tekrar İndir'}">
              <i data-lucide="download"></i>
              <span>${isEn ? 'Redownload' : 'Tekrar İndir'}</span>
            </button>
            <button class="btn btn-warning btn-sm" onclick="fixFileIssue('mark_not_downloaded', '', '${file.id}')">
              <i data-lucide="refresh-cw"></i>
              <span>${t.btn_mark_not_downloaded || 'Mark Not Downloaded'}</span>
            </button>
            <button class="btn btn-danger btn-sm" onclick="fixFileIssue('delete_history', '', '${file.id}')">
              <i data-lucide="trash-2"></i>
              <span>${t.btn_delete_history || 'Delete History'}</span>
            </button>
          </div>
        </td>
      `;
      missingBody.appendChild(tr);
    });
  } else {
    if (missingSection) missingSection.classList.add('hidden');
  }
  
  lucide.createIcons();
}

async function fixFileIssue(actionType, filePath, id) {
  const isEn = localDb.settings && localDb.settings.lang === 'en';
  let body = {};
  
  if (actionType === 'import') {
    const file = untrackedFilesList.find(f => f.filePath === filePath);
    if (!file) return;
    body = {
      action: 'import-untracked-file',
      filesToImport: [{
        id: file.id,
        title: file.title,
        channelName: file.channelName,
        fileSize: file.fileSize,
        filePath: file.filePath
      }]
    };
  } else if (actionType === 'delete') {
    body = {
      action: 'delete-untracked-file',
      filePaths: [filePath]
    };
  } else if (actionType === 'mark_not_downloaded') {
    body = {
      action: 'mark-missing-as-not-downloaded',
      videoIds: [id]
    };
  } else if (actionType === 'delete_history') {
    body = {
      action: 'delete-history-item',
      videoIds: [id]
    };
  }
  
  try {
    const res = await fetch('/api/tools/fix-files', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await res.json();
    if (data.success) {
      showToast(data.message || (isEn ? 'Operation successful.' : 'İşlem başarılı.'), 'success');
      // Refresh comparison
      runFileComparison();
    } else {
      showToast(data.error || (isEn ? 'Operation failed.' : 'İşlem başarısız.'), 'error');
    }
  } catch (err) {
    showToast(isEn ? 'Connection error.' : 'Bağlantı hatası.', 'error');
  }
}

async function fixAllUntracked(actionType) {
  const isEn = localDb.settings && localDb.settings.lang === 'en';
  if (untrackedFilesList.length === 0) return;
  
  let body = {};
  if (actionType === 'import') {
    // Only import files that have a valid ID
    const filesToImport = untrackedFilesList.filter(f => f.id).map(file => ({
      id: file.id,
      title: file.title,
      channelName: file.channelName,
      fileSize: file.fileSize,
      filePath: file.filePath
    }));
    if (filesToImport.length === 0) {
      showToast(isEn ? 'No files with valid video IDs to import.' : 'İçe aktarılacak geçerli video ID\'sine sahip dosya yok.', 'info');
      return;
    }
    body = {
      action: 'import-untracked-file',
      filesToImport
    };
  } else if (actionType === 'delete') {
    if (!confirm(isEn ? 'Are you sure you want to delete all untracked files from disk?' : 'Tüm yetim dosyaları diskten silmek istediğinize emin misiniz?')) {
      return;
    }
    body = {
      action: 'delete-untracked-file',
      filePaths: untrackedFilesList.map(f => f.filePath)
    };
  }
  
  try {
    const res = await fetch('/api/tools/fix-files', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await res.json();
    if (data.success) {
      showToast(data.message || (isEn ? 'Operation successful.' : 'İşlem başarılı.'), 'success');
      runFileComparison();
    } else {
      showToast(data.error || (isEn ? 'Operation failed.' : 'İşlem başarısız.'), 'error');
    }
  } catch (err) {
    showToast(isEn ? 'Connection error.' : 'Bağlantı hatası.', 'error');
  }
}

async function fixAllMissing(actionType) {
  const isEn = localDb.settings && localDb.settings.lang === 'en';
  if (missingFilesList.length === 0) return;
  
  let body = {};
  if (actionType === 'mark' || actionType === 'mark_not_downloaded') {
    body = {
      action: 'mark-missing-as-not-downloaded',
      videoIds: missingFilesList.map(f => f.id)
    };
  } else if (actionType === 'delete') {
    if (!confirm(isEn ? 'Are you sure you want to delete all missing videos from history?' : 'Tüm eksik videoları geçmişten silmek istediğinize emin misiniz?')) {
      return;
    }
    body = {
      action: 'delete-history-item',
      videoIds: missingFilesList.map(f => f.id)
    };
  }
  
  try {
    const res = await fetch('/api/tools/fix-files', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await res.json();
    if (data.success) {
      showToast(data.message || (isEn ? 'Operation successful.' : 'İşlem başarılı.'), 'success');
      runFileComparison();
    } else {
      showToast(data.error || (isEn ? 'Operation failed.' : 'İşlem başarısız.'), 'error');
    }
  } catch (err) {
    showToast(isEn ? 'Connection error.' : 'Bağlantı hatası.', 'error');
  }
}

// Hide video from library
window.hideVideo = async function(videoId) {
  if (!videoId) return;
  const isEn = localDb.settings && localDb.settings.lang === 'en';
  try {
    const res = await fetch(`/api/history/${videoId}/hide`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    const data = await res.json();
    if (data.success) {
      showToast(isEn ? 'Video hidden from library.' : 'Video kütüphaneden gizlendi.', 'success');
    } else {
      showToast(data.error || (isEn ? 'Failed to hide video.' : 'Video gizlenemedi.'), 'error');
    }
  } catch (err) {
    showToast(isEn ? 'Connection error.' : 'Bağlantı hatası.', 'error');
  }
};

// Unhide video from library
window.unhideVideo = async function(videoId) {
  if (!videoId) return;
  const isEn = localDb.settings && localDb.settings.lang === 'en';
  try {
    const res = await fetch(`/api/history/${videoId}/unhide`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    const data = await res.json();
    if (data.success) {
      showToast(isEn ? 'Video is now visible in library.' : 'Video kütüphanede tekrar görünür yapıldı.', 'success');
    } else {
      showToast(data.error || (isEn ? 'Failed to unhide video.' : 'Video görünür yapılamadı.'), 'error');
    }
  } catch (err) {
    showToast(isEn ? 'Connection error.' : 'Bağlantı hatası.', 'error');
  }
};

// Filter library/downloaded grid by channel name click
window.filterByChannel = function(channelId, gridId) {
  if (!channelId) return;
  
  if (gridId === 'downloaded-grid') {
    const downloadedChannelFilter = document.getElementById('downloaded-channel-filter');
    if (downloadedChannelFilter) {
      downloadedChannelFilter.value = channelId;
      downloadedFilterChannel = channelId;
      updateUI(localDb);
    }
  } else {
    const historyChannelFilter = document.getElementById('history-channel-filter');
    if (historyChannelFilter) {
      historyChannelFilter.value = channelId;
      historyFilterChannel = channelId;
      updateUI(localDb);
    }
  }
};

// SSE Channel Scan progress toast
function updateScanProgressToast(data) {
  const isEn = localDb.settings && localDb.settings.lang === 'en';
  if (!data.active) {
    if (scanProgressToast) {
      scanProgressToast.style.animation = 'slideIn 0.3s reverse forwards';
      const toastRef = scanProgressToast;
      setTimeout(() => toastRef.remove(), 300);
      scanProgressToast = null;
      showToast(isEn ? 'Channel scan completed.' : 'Kanal denetimi tamamlandı.', 'success');
    }
    return;
  }

  const container = document.getElementById('toast-container');
  if (!container) return;

  const msg = isEn 
    ? `${data.current}/${data.total} - Checking ${data.channelName}` 
    : `${data.current}/${data.total} - ${data.channelName} denetleniyor`;

  if (!scanProgressToast) {
    scanProgressToast = document.createElement('div');
    scanProgressToast.className = 'toast toast-info toast-persistent';
    container.appendChild(scanProgressToast);
  }

  scanProgressToast.innerHTML = `
    <i data-lucide="loader" class="toast-icon spin"></i>
    <div class="toast-message">${msg}</div>
  `;
  lucide.createIcons();
}

// Make functions globally accessible
window.fixFileIssue = fixFileIssue;
window.fixAllUntracked = fixAllUntracked;
window.fixAllMissing = fixAllMissing;
window.runFileComparison = runFileComparison;
window.openFileLocation = openFileLocation;
window.deleteAllUnrelated = deleteAllUnrelated;

document.addEventListener('DOMContentLoaded', () => {
  const compareBtn = document.getElementById('start-compare-btn');
  if (compareBtn) {
    compareBtn.addEventListener('click', runFileComparison);
  }
  
  // Header Settings button click handler
  const headerSettingsBtn = document.getElementById('header-settings-btn');
  if (headerSettingsBtn) {
    headerSettingsBtn.addEventListener('click', () => {
      if (window.switchTab) {
        window.switchTab('settings');
      }
    });
  }
  


  // Initialize Downloader Tab and Dropdown Elements
  initDownloaderUI();
});

// === DOWNLISTER / DOWNLOADER FRONTEND MANTIĞI ===
let activePlaylistVideos = [];

function toggleToolsDropdown(e) {
  e.stopPropagation();
  const dropdown = document.getElementById('tools-dropdown');
  if (dropdown) {
    dropdown.classList.toggle('open');
  }
}

// Dışarı tıklayınca dropdown kapatma
document.addEventListener('click', (e) => {
  const dropdown = document.getElementById('tools-dropdown');
  if (dropdown && !dropdown.contains(e.target)) {
    dropdown.classList.remove('open');
  }
});

function initDownloaderUI() {
  const toolsBtn = document.getElementById('tools-btn');
  if (toolsBtn) {
    toolsBtn.addEventListener('click', toggleToolsDropdown);
  }

  const downloaderActionBtn = document.getElementById('downloader-action-btn');
  if (downloaderActionBtn) {
    downloaderActionBtn.addEventListener('click', (e) => {
      e.preventDefault();
      switchTab('downloader');
      const dropdown = document.getElementById('tools-dropdown');
      if (dropdown) dropdown.classList.remove('open');
    });
  }

  const toolsCompareBtn = document.getElementById('nav-tools-compare-btn');
  if (toolsCompareBtn) {
    toolsCompareBtn.addEventListener('click', (e) => {
      e.preventDefault();
      window.currentToolsSubSection = 'compare';
      switchTab('tools');
      showToolsSubSection('compare');
      runFileComparison();
      const dropdown = document.getElementById('tools-dropdown');
      if (dropdown) dropdown.classList.remove('open');
    });
  }

  const toolsCategoriesBtn = document.getElementById('nav-tools-categories-btn');
  if (toolsCategoriesBtn) {
    toolsCategoriesBtn.addEventListener('click', (e) => {
      e.preventDefault();
      window.currentToolsSubSection = 'categories';
      switchTab('tools');
      showToolsSubSection('categories');
      const dropdown = document.getElementById('tools-dropdown');
      if (dropdown) dropdown.classList.remove('open');
    });
  }

  const toolsApeBtn = document.getElementById('nav-tools-ape-btn');
  if (toolsApeBtn) {
    toolsApeBtn.addEventListener('click', (e) => {
      e.preventDefault();
      window.currentToolsSubSection = 'ape';
      switchTab('tools');
      showToolsSubSection('ape');
      const dropdown = document.getElementById('tools-dropdown');
      if (dropdown) dropdown.classList.remove('open');
    });
  }

  const formatSelect = document.getElementById('downloader-format-select');
  const bitrateGroup = document.getElementById('downloader-bitrate-group');
  if (formatSelect && bitrateGroup) {
    formatSelect.addEventListener('change', () => {
      if (formatSelect.value === 'audio-mp3') {
        bitrateGroup.style.display = 'block';
      } else {
        bitrateGroup.style.display = 'none';
      }
    });
  }

  const startBtn = document.getElementById('downloader-start-btn');
  if (startBtn) {
    startBtn.addEventListener('click', handleDownloaderStart);
  }

  const downloadAllBtn = document.getElementById('downloader-download-all-btn');
  if (downloadAllBtn) {
    downloadAllBtn.addEventListener('click', handleDownloaderAll);
  }

  const toggleAllCheckbox = document.getElementById('downloader-toggle-all-checkbox');
  if (toggleAllCheckbox) {
    toggleAllCheckbox.addEventListener('change', (e) => {
      const checked = e.target.checked;
      document.querySelectorAll('.playlist-item-checkbox').forEach(cb => {
        cb.checked = checked;
      });
    });
  }
}

function showToolsSubSection(section) {
  const compareContainer = document.getElementById('tools-compare-container');
  const bulkContainer = document.getElementById('tools-bulk-delete-container');
  const categoriesContainer = document.getElementById('tools-categories-container');
  const apeContainer = document.getElementById('tools-ape-container');
  const toolsHeaderTitle = document.querySelector('#tab-tools .content-header h2 span');
  const toolsHeaderDesc = document.getElementById('tools-modal-desc');
  const toolsHeaderIcon = document.getElementById('tools-modal-icon');

  if (compareContainer) compareContainer.classList.add('hidden');
  if (bulkContainer) bulkContainer.classList.add('hidden');
  if (categoriesContainer) categoriesContainer.classList.add('hidden');
  if (apeContainer) apeContainer.classList.add('hidden');

  const isEn = localDb.settings?.lang === 'en';

  if (section === 'categories' && categoriesContainer) {
    categoriesContainer.classList.remove('hidden');
    if (toolsHeaderTitle) toolsHeaderTitle.textContent = isEn ? 'Edit Channel Categories' : 'Kanal Kategorilerini Düzenleme';
    if (toolsHeaderDesc) toolsHeaderDesc.textContent = isEn ? 'Create, edit, or delete categories to group your channels.' : 'Kanallarınızı gruplandırmak için kategoriler oluşturabilir, düzenleyebilir veya silebilirsiniz.';
    if (toolsHeaderIcon) toolsHeaderIcon.setAttribute('data-lucide', 'tag');
    if (typeof loadCategoriesToTools === 'function') loadCategoriesToTools(localDb.categories);
  } else if (section === 'ape' && apeContainer) {
    apeContainer.classList.remove('hidden');
    if (toolsHeaderTitle) toolsHeaderTitle.textContent = isEn ? 'APE (Direct Video/Channel Watched Marker)' : 'APE (Hızlı İzlendi İşaretleme Aracı)';
    if (toolsHeaderDesc) toolsHeaderDesc.textContent = isEn ? 'Mark videos as watched in library and YouTube history by entering video or channel links.' : 'Video veya kanal linki girerek kütüphanede ve YouTube geçmişinizde videoları anında izlendi olarak işaretleyin.';
    if (toolsHeaderIcon) toolsHeaderIcon.setAttribute('data-lucide', 'check-check');
  } else if (section === 'bulk-delete' && bulkContainer) {
    bulkContainer.classList.remove('hidden');
    if (toolsHeaderTitle) toolsHeaderTitle.textContent = isEn ? 'Bulk Video Deletion' : 'Toplu Video Silme';
    if (toolsHeaderDesc) toolsHeaderDesc.textContent = isEn ? 'List and bulk delete your downloaded videos along with their physical files from disk.' : 'Kütüphanenizdeki indirilen videoları seçerek diskten veya veritabanından toplu olarak silebilirsiniz.';
    if (toolsHeaderIcon) toolsHeaderIcon.setAttribute('data-lucide', 'trash-2');
  } else {
    if (compareContainer) compareContainer.classList.remove('hidden');
    if (toolsHeaderTitle) toolsHeaderTitle.textContent = isEn ? 'Advanced File Comparison & Sync' : 'Gelişmiş Dosya Karşılaştırma & Senkronizasyon';
    if (toolsHeaderDesc) toolsHeaderDesc.textContent = isEn ? 'Compares physical files in your download folder with database records.' : 'İndirme klasörünüzdeki fiziksel dosyaları veritabanı kayıtları ile karşılaştırarak eksik, yetim veya alakasız dosyaları listeler.';
    if (toolsHeaderIcon) toolsHeaderIcon.setAttribute('data-lucide', 'folder-sync');
  }

  try {
    if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
  } catch (e) {}
}
window.showToolsSubSection = showToolsSubSection;

// === DOWNLOADED BULK DELETE FUNCTIONS ===
function toggleDownloadedBulkDeleteMode() {
  const isEn = localDb.settings?.lang === 'en';
  const toggleBtn = document.getElementById('downloaded-bulk-delete-toggle-btn');
  const bar = document.getElementById('downloaded-bulk-delete-bar');
  
  window.isDownloadedBulkDeleteMode = !window.isDownloadedBulkDeleteMode;
  
  if (window.isDownloadedBulkDeleteMode) {
    if (toggleBtn) {
      toggleBtn.classList.add('active');
      toggleBtn.style.background = 'var(--primary)';
      toggleBtn.style.color = '#fff';
    }
    if (bar) bar.classList.remove('hidden');
    const filesCb = document.getElementById('downloaded-bulk-delete-files-checkbox');
    if (filesCb) filesCb.checked = true;
  } else {
    if (toggleBtn) {
      toggleBtn.classList.remove('active');
      toggleBtn.style.background = '';
      toggleBtn.style.color = '';
    }
    if (bar) bar.classList.add('hidden');
    // Clear selections
    const selectAllCb = document.getElementById('downloaded-bulk-delete-select-all');
    if (selectAllCb) selectAllCb.checked = false;
  }
  
  // Update counts
  updateDownloadedBulkDeleteCount();
  
  // Re-render UI to apply isDownloadedBulkDeleteMode state to cards
  if (typeof updateUI === 'function') {
    updateUI(localDb);
  }
}
window.toggleDownloadedBulkDeleteMode = toggleDownloadedBulkDeleteMode;

function cancelDownloadedBulkDeleteMode() {
  window.isDownloadedBulkDeleteMode = false;
  const toggleBtn = document.getElementById('downloaded-bulk-delete-toggle-btn');
  const bar = document.getElementById('downloaded-bulk-delete-bar');
  if (toggleBtn) {
    toggleBtn.classList.remove('active');
    toggleBtn.style.background = '';
    toggleBtn.style.color = '';
  }
  if (bar) bar.classList.add('hidden');
  
  const selectAllCb = document.getElementById('downloaded-bulk-delete-select-all');
  if (selectAllCb) selectAllCb.checked = false;
  
  updateDownloadedBulkDeleteCount();
  if (typeof updateUI === 'function') {
    updateUI(localDb);
  }
}
window.cancelDownloadedBulkDeleteMode = cancelDownloadedBulkDeleteMode;

function toggleSelectAllDownloadedBulkDelete(masterCb) {
  const cbs = document.querySelectorAll('.downloaded-bulk-delete-cb');
  cbs.forEach(cb => {
    cb.checked = masterCb.checked;
    const card = cb.closest('.video-card');
    if (card) {
      card.classList.toggle('bulk-delete-selected', cb.checked);
    }
  });
  updateDownloadedBulkDeleteCount();
}
window.toggleSelectAllDownloadedBulkDelete = toggleSelectAllDownloadedBulkDelete;

function toggleDownloadedCardSelection(id) {
  const cb = document.querySelector(`.downloaded-bulk-delete-cb[data-id="${id}"]`);
  if (cb) {
    cb.checked = !cb.checked;
    
    const card = cb.closest('.video-card');
    if (card) {
      card.classList.toggle('bulk-delete-selected', cb.checked);
    }
    
    // Sync Select All checkbox
    const allCbs = document.querySelectorAll('.downloaded-bulk-delete-cb');
    const checkedCbs = document.querySelectorAll('.downloaded-bulk-delete-cb:checked');
    const selectAllCb = document.getElementById('downloaded-bulk-delete-select-all');
    if (selectAllCb) {
      selectAllCb.checked = allCbs.length > 0 && allCbs.length === checkedCbs.length;
    }
    
    updateDownloadedBulkDeleteCount();
  }
}
window.toggleDownloadedCardSelection = toggleDownloadedCardSelection;

function updateDownloadedBulkDeleteCount(e) {
  if (e) {
    e.stopPropagation();
    const cb = e.target;
    const card = cb.closest('.video-card');
    if (card) {
      card.classList.toggle('bulk-delete-selected', cb.checked);
    }
    // Sync Select All checkbox
    const allCbs = document.querySelectorAll('.downloaded-bulk-delete-cb');
    const checkedCbs = document.querySelectorAll('.downloaded-bulk-delete-cb:checked');
    const selectAllCb = document.getElementById('downloaded-bulk-delete-select-all');
    if (selectAllCb) {
      selectAllCb.checked = allCbs.length > 0 && allCbs.length === checkedCbs.length;
    }
  }
  const checkedCount = document.querySelectorAll('.downloaded-bulk-delete-cb:checked').length;
  const countEl = document.getElementById('downloaded-bulk-delete-selected-count');
  if (countEl) countEl.textContent = checkedCount;
}
window.updateDownloadedBulkDeleteCount = updateDownloadedBulkDeleteCount;

async function executeDownloadedBulkDelete() {
  const isEn = localDb.settings?.lang === 'en';
  const checked = document.querySelectorAll('.downloaded-bulk-delete-cb:checked');
  if (checked.length === 0) {
    showToast(isEn ? 'Please select at least one video to delete.' : 'Lütfen silmek için en az bir video seçin.', 'error');
    return;
  }
  
  const videoIds = Array.from(checked).map(cb => cb.getAttribute('data-id'));
  const alsoDeleteFiles = document.getElementById('downloaded-bulk-delete-files-checkbox')?.checked || false;
  
  const confirmMsg = isEn 
    ? `Are you sure you want to delete the selected ${videoIds.length} video(s)?`
    : `Seçilen ${videoIds.length} videoyu silmek istediğinize emin misiniz?`;
    
  if (!confirm(confirmMsg)) return;
  
  try {
    const response = await fetch('/api/history/bulk-delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: videoIds, deleteFiles: alsoDeleteFiles })
    });
    
    if (response.ok) {
      showToast(isEn ? `${videoIds.length} video(s) deleted successfully.` : `${videoIds.length} video başarıyla silindi.`, 'success');
      cancelDownloadedBulkDeleteMode();
      
      if (typeof loadDb === 'function') {
        await loadDb();
      }
    } else {
      showToast(isEn ? 'Failed to delete videos.' : 'Videolar silinirken bir hata oluştu.', 'error');
    }
  } catch (err) {
    console.error('[executeDownloadedBulkDelete] Hata:', err);
    showToast(isEn ? 'An error occurred during deletion.' : 'Silme işlemi sırasında bir hata oluştu.', 'error');
  }
}
window.executeDownloadedBulkDelete = executeDownloadedBulkDelete;

// === HISTORY BULK HIDE FUNCTIONS ===
function toggleHistoryBulkHideMode() {
  const toggleBtn = document.getElementById('history-bulk-hide-toggle-btn');
  const bar = document.getElementById('history-bulk-hide-bar');
  
  window.isHistoryBulkHideMode = !window.isHistoryBulkHideMode;
  
  if (window.isHistoryBulkHideMode) {
    if (toggleBtn) {
      toggleBtn.classList.add('active');
    }
    if (bar) bar.classList.remove('hidden');
  } else {
    if (toggleBtn) {
      toggleBtn.classList.remove('active');
    }
    if (bar) bar.classList.add('hidden');
    // Clear selections
    const selectAllCb = document.getElementById('history-bulk-hide-select-all');
    if (selectAllCb) selectAllCb.checked = false;
  }
  
  updateHistoryBulkHideCount();
  
  // Re-render UI to apply isHistoryBulkHideMode state to history cards
  if (typeof updateUI === 'function') {
    updateUI(localDb);
  }
}
window.toggleHistoryBulkHideMode = toggleHistoryBulkHideMode;

function cancelHistoryBulkHideMode() {
  window.isHistoryBulkHideMode = false;
  const toggleBtn = document.getElementById('history-bulk-hide-toggle-btn');
  const bar = document.getElementById('history-bulk-hide-bar');
  if (toggleBtn) {
    toggleBtn.classList.remove('active');
  }
  if (bar) bar.classList.add('hidden');
  
  const selectAllCb = document.getElementById('history-bulk-hide-select-all');
  if (selectAllCb) selectAllCb.checked = false;
  
  updateHistoryBulkHideCount();
  if (typeof updateUI === 'function') {
    updateUI(localDb);
  }
}
window.cancelHistoryBulkHideMode = cancelHistoryBulkHideMode;

function toggleSelectAllHistoryBulkHide(masterCb) {
  const cbs = document.querySelectorAll('.history-bulk-hide-cb');
  cbs.forEach(cb => {
    cb.checked = masterCb.checked;
    const card = cb.closest('.video-card');
    if (card) {
      card.classList.toggle('bulk-hide-selected', cb.checked);
    }
  });
  updateHistoryBulkHideCount();
}
window.toggleSelectAllHistoryBulkHide = toggleSelectAllHistoryBulkHide;

function toggleHistoryBulkHideCardSelection(id) {
  const cb = document.querySelector(`.history-bulk-hide-cb[data-id="${id}"]`);
  if (cb) {
    cb.checked = !cb.checked;
    
    const card = cb.closest('.video-card');
    if (card) {
      card.classList.toggle('bulk-hide-selected', cb.checked);
    }
    
    // Sync Select All checkbox
    const allCbs = document.querySelectorAll('.history-bulk-hide-cb');
    const checkedCbs = document.querySelectorAll('.history-bulk-hide-cb:checked');
    const selectAllCb = document.getElementById('history-bulk-hide-select-all');
    if (selectAllCb) {
      selectAllCb.checked = allCbs.length > 0 && allCbs.length === checkedCbs.length;
    }
    
    updateHistoryBulkHideCount();
  }
}
window.toggleHistoryBulkHideCardSelection = toggleHistoryBulkHideCardSelection;

function updateHistoryBulkHideCount(e) {
  if (e) {
    e.stopPropagation();
    const cb = e.target;
    const card = cb.closest('.video-card');
    if (card) {
      card.classList.toggle('bulk-hide-selected', cb.checked);
    }
    // Sync Select All checkbox
    const allCbs = document.querySelectorAll('.history-bulk-hide-cb');
    const checkedCbs = document.querySelectorAll('.history-bulk-hide-cb:checked');
    const selectAllCb = document.getElementById('history-bulk-hide-select-all');
    if (selectAllCb) {
      selectAllCb.checked = allCbs.length > 0 && allCbs.length === checkedCbs.length;
    }
  }
  const checkedCount = document.querySelectorAll('.history-bulk-hide-cb:checked').length;
  const countEl = document.getElementById('history-bulk-hide-selected-count');
  if (countEl) countEl.textContent = checkedCount;
}
window.updateHistoryBulkHideCount = updateHistoryBulkHideCount;

async function executeHistoryBulkHide() {
  const isEn = localDb.settings?.lang === 'en';
  const checked = document.querySelectorAll('.history-bulk-hide-cb:checked');
  if (checked.length === 0) {
    showToast(isEn ? 'Please select at least one video to hide.' : 'Lütfen gizlemek için en az bir video seçin.', 'warning');
    return;
  }
  
  const videoIds = Array.from(checked).map(cb => cb.getAttribute('data-id'));
  
  const confirmMsg = isEn 
    ? `Are you sure you want to hide the selected ${videoIds.length} video(s)?`
    : `Seçilen ${videoIds.length} videoyu gizlemek istediğinize emin misiniz?`;
    
  if (!confirm(confirmMsg)) return;
  
  try {
    const response = await fetch('/api/history/bulk-hide', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: videoIds })
    });
    
    const result = await response.json();
    if (result.success) {
      const count = result.count || videoIds.length;
      showToast(isEn ? `${count} video(s) hidden successfully.` : `${count} video başarıyla gizlendi.`, 'success');
      cancelHistoryBulkHideMode();
      
      if (typeof loadDb === 'function') {
        await loadDb();
      }
    } else {
      showToast(result.error || (isEn ? 'Failed to hide videos.' : 'Videolar gizlenirken bir hata oluştu.'), 'error');
    }
  } catch (err) {
    console.error('[executeHistoryBulkHide] Hata:', err);
    showToast(isEn ? 'An error occurred while hiding videos.' : 'Gizleme işlemi sırasında bir hata oluştu.', 'error');
  }
}
window.executeHistoryBulkHide = executeHistoryBulkHide;

async function handleDownloaderStart() {
  const urlInput = document.getElementById('downloader-url-input');
  if (!urlInput) return;

  const url = urlInput.value.trim();
  const isEn = localDb.settings && localDb.settings.lang === 'en';

  if (!url) {
    showToast(isEn ? 'Please enter a valid URL.' : 'Lütfen geçerli bir URL girin.', 'error');
    return;
  }

  const formatSelect = document.getElementById('downloader-format-select');
  const bitrateSelect = document.getElementById('downloader-bitrate-select');
  const format = formatSelect ? formatSelect.value : 'video-best';
  const bitrate = (format === 'audio-mp3' && bitrateSelect) ? bitrateSelect.value : null;

  const startBtn = document.getElementById('downloader-start-btn');
  if (startBtn) {
    startBtn.disabled = true;
    const originalText = startBtn.innerHTML;
    startBtn.innerHTML = `<i class="toast-icon spin" data-lucide="loader" style="width:14px;height:14px;display:inline-block;vertical-align:middle;margin-right:5px;"></i> <span>${isEn ? 'Processing...' : 'İşleniyor...'}</span>`;
    lucide.createIcons();
  }

  try {
    // Playlist URL kontrolü
    const isPlaylist = url.includes('list=') && !url.includes('watch?v=');
    
    if (isPlaylist) {
      // Playlist'i çözümle
      showToast(isEn ? 'Resolving playlist, please wait...' : 'Playlist çözümleniyor, lütfen bekleyin...', 'info');
      const res = await fetch('/api/downloader/resolve-playlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      });
      const data = await res.json();
      
      if (data.success && data.videos && data.videos.length > 0) {
        activePlaylistVideos = data.videos;
        renderPlaylistResults(data.videos);
        showToast(isEn ? `${data.videos.length} videos found.` : `${data.videos.length} video bulundu.`, 'success');
      } else {
        showToast(data.error || (isEn ? 'Failed to resolve playlist.' : 'Playlist çözümlenemedi.'), 'error');
      }
    } else {
      // Tekil video indir
      const res = await fetch('/api/downloader/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, format, bitrate })
      });
      const data = await res.json();
      if (data.success) {
        showToast(isEn ? 'Added to download queue.' : 'Kuyruğa başarıyla eklendi.', 'success');
        urlInput.value = '';
        switchTab('queue');
      } else {
        showToast(data.error || (isEn ? 'Failed to start download.' : 'İndirme başlatılamadı.'), 'error');
      }
    }
  } catch (err) {
    showToast(isEn ? 'Connection error.' : 'Bağlantı hatası.', 'error');
  } finally {
    if (startBtn) {
      startBtn.disabled = false;
      startBtn.innerHTML = `<i data-lucide="download"></i> <span>${isEn ? 'Start Download' : 'İndirmeyi Başlat'}</span>`;
      lucide.createIcons();
    }
  }
}
window.handleDownloaderStart = handleDownloaderStart;
window.initDownloaderUI = initDownloaderUI;

async function handleDownloaderAll() {
  if (activePlaylistVideos.length === 0) return;
  const isEn = localDb.settings && localDb.settings.lang === 'en';
  
  const checkboxes = document.querySelectorAll('.playlist-item-checkbox:checked');
  if (checkboxes.length === 0) {
    showToast(isEn ? 'Please select at least one video.' : 'Lütfen en az bir video seçin.', 'error');
    return;
  }

  const selectedIds = Array.from(checkboxes).map(cb => cb.getAttribute('data-id'));
  const targetVideos = activePlaylistVideos.filter(v => selectedIds.includes(v.id));

  const formatSelect = document.getElementById('downloader-format-select');
  const bitrateSelect = document.getElementById('downloader-bitrate-select');
  const format = formatSelect ? formatSelect.value : 'video-best';
  const bitrate = (format === 'audio-mp3' && bitrateSelect) ? bitrateSelect.value : null;

  const downloadAllBtn = document.getElementById('downloader-download-all-btn');
  if (downloadAllBtn) {
    downloadAllBtn.disabled = true;
  }

  let addedCount = 0;
  for (const video of targetVideos) {
    try {
      const videoUrl = `https://www.youtube.com/watch?v=${video.id}`;
      const res = await fetch('/api/downloader/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          url: videoUrl, 
          format, 
          bitrate, 
          title: video.title,
          channelId: 'manual',
          channelName: video.uploader || 'Manuel İndirme'
        })
      });
      const data = await res.json();
      if (data.success) {
        addedCount++;
      }
    } catch (e) {
      console.error('Playlist video ekleme hatası:', e);
    }
  }

  showToast(isEn ? `${addedCount} videos added to queue.` : `${addedCount} video kuyruğa eklendi.`, 'success');
  
  // Temizle ve Kuyruğa yönlendir
  document.getElementById('downloader-playlist-results').classList.add('hidden');
  document.getElementById('downloader-url-input').value = '';
  activePlaylistVideos = [];
  
  if (downloadAllBtn) {
    downloadAllBtn.disabled = false;
  }
  
  switchTab('queue');
}

function renderPlaylistResults(videos) {
  const container = document.getElementById('downloader-playlist-results');
  const listContainer = document.getElementById('downloader-playlist-list');
  if (!container || !listContainer) return;

  listContainer.innerHTML = '';
  videos.forEach((video, index) => {
    const item = document.createElement('div');
    item.className = 'downloader-playlist-item';
    item.setAttribute('data-video-id', video.id);
    
    let durationStr = '';
    if (video.duration) {
      const min = Math.floor(video.duration / 60);
      const sec = Math.floor(video.duration % 60);
      durationStr = `${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
    }

    const thumbUrl = video.thumbnail || `https://i.ytimg.com/vi/${video.id}/hqdefault.jpg`;

    item.innerHTML = `
      <input type="checkbox" class="playlist-item-checkbox" checked data-id="${video.id}" onclick="event.stopPropagation();" />
      <span class="item-index">${index + 1}</span>
      <div class="playlist-item-thumb-wrap">
        <img src="${thumbUrl}" class="playlist-item-thumb" onerror="this.src='logo.png';" />
      </div>
      <span class="item-title" title="${escapeHtml(video.title)}">${escapeHtml(video.title)}</span>
      <span class="item-duration">${durationStr}</span>
    `;

    item.addEventListener('click', (e) => {
      if (e.target.tagName !== 'INPUT') {
        const cb = item.querySelector('.playlist-item-checkbox');
        if (cb) cb.checked = !cb.checked;
      }
    });

    listContainer.appendChild(item);
  });

  container.classList.remove('hidden');
}

async function downloadMissingVideo(videoId, title, channelName, channelId) {
  const isEn = localDb.settings && localDb.settings.lang === 'en';
  try {
    showToast(isEn ? 'Adding video to download queue...' : 'Video indirme kuyruğuna ekleniyor...', 'info');
    const res = await fetch('/api/downloader/download', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: videoId,
        title: title,
        channelName: channelName,
        channelId: channelId
      })
    });
    const data = await res.json();
    if (data.success) {
      showToast(isEn ? 'Video added to queue successfully.' : 'Video kuyruğa başarıyla eklendi.', 'success');
      runFileComparison();
    } else {
      showToast(data.error || (isEn ? 'Failed to queue video.' : 'Kuyruğa eklenemedi.'), 'error');
    }
  } catch (err) {
    showToast(isEn ? 'Connection error.' : 'Bağlantı hatası.', 'error');
  }
}
window.downloadMissingVideo = downloadMissingVideo;

async function createSystemBackup() {
  const isEn = localDb.settings && localDb.settings.lang === 'en';
  try {
    showToast(isEn ? 'Creating compressed system backup...' : 'Sıkıştırılmış sistem yedeği oluşturuluyor...', 'info');
    const res = await fetch('/api/backup', { method: 'POST' });
    const data = await res.json();
    if (data.success) {
      showToast(isEn ? `Backup created successfully (${data.size}).` : `Sıkıştırılmış yedek oluşturuldu (${data.size}).`, 'success');
      const container = document.getElementById('system-backups-container');
      if (container && !container.classList.contains('hidden')) {
        loadSystemBackupsList(true);
      }
    } else {
      showToast(data.error || (isEn ? 'Failed to create backup.' : 'Yedek oluşturulamadı.'), 'error');
    }
  } catch (err) {
    showToast(isEn ? 'Connection error.' : 'Bağlantı hatası.', 'error');
  }
}

async function loadSystemBackupsList(forceOpen = false) {
  const isEn = localDb.settings && localDb.settings.lang === 'en';
  const container = document.getElementById('system-backups-container');
  const tbody = document.getElementById('system-backups-list');
  if (!container || !tbody) return;

  if (!forceOpen && !container.classList.contains('hidden')) {
    container.classList.add('hidden');
    return;
  }

  try {
    const res = await fetch('/api/backups');
    const data = await res.json();
    if (data.success) {
      tbody.innerHTML = '';
      if (data.backups.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" style="padding: 10px; text-align: center; color: var(--text-muted);">${isEn ? 'No backups found.' : 'Henüz saklanan yedek bulunmuyor.'}</td></tr>`;
      } else {
        data.backups.forEach(backup => {
          const tr = document.createElement('tr');
          tr.style.borderBottom = '1px solid rgba(255,255,255,0.05)';
          const isAutoBackup = backup.isAuto || backup.filename.startsWith('auto_') || backup.filename.startsWith('daily_');
          let badgeHtml = '';
          if (backup.isDailyProtected) {
            badgeHtml = `<span style="background: rgba(16, 185, 129, 0.15); border: 1px solid rgba(16, 185, 129, 0.3); color: #10b981; font-size: 0.7rem; padding: 2px 6px; border-radius: 4px; font-weight: 600;">🛡️ ${isEn ? 'Daily Protected' : 'Günlük Korunan'}</span>`;
          } else if (isAutoBackup) {
            badgeHtml = `<span style="background: rgba(168, 85, 247, 0.15); border: 1px solid rgba(168, 85, 247, 0.3); color: #a855f7; font-size: 0.7rem; padding: 2px 6px; border-radius: 4px; font-weight: 600;">🤖 ${isEn ? 'Automatic' : 'Otomatik'}</span>`;
          } else {
            badgeHtml = `<span style="background: rgba(56, 189, 248, 0.15); border: 1px solid rgba(56, 189, 248, 0.3); color: #38bdf8; font-size: 0.7rem; padding: 2px 6px; border-radius: 4px; font-weight: 600;">🖐️ ${isEn ? 'Manual' : 'Manuel'}</span>`;
          }

          tr.innerHTML = `
            <td style="padding: 6px 8px;" title="${backup.filename}">${backup.filename}</td>
            <td style="padding: 6px 8px; color: var(--text-muted);">${backup.size}</td>
            <td style="padding: 6px 8px;">${badgeHtml}</td>
            <td style="padding: 6px 8px; text-align: right; display: flex; gap: 4px; justify-content: flex-end;">
              <button type="button" class="btn btn-secondary btn-xs" onclick="downloadSystemBackup('${backup.filename}')" title="${isEn ? 'Download' : 'İndir'}" style="padding: 2px 6px; font-size: 0.75rem;">
                <i data-lucide="download" style="width:12px;height:12px;"></i>
              </button>
              <button type="button" class="btn btn-secondary btn-xs" onclick="restoreSystemBackup('${backup.filename}')" title="${isEn ? 'Restore' : 'Geri Yükle'}" style="padding: 2px 6px; font-size: 0.75rem; background: rgba(56, 189, 248, 0.1); border-color: rgba(56, 189, 248, 0.2); color: var(--accent-color);">
                ${isEn ? 'Geri Yükle' : 'Geri Yükle'}
              </button>
              <button type="button" class="btn btn-secondary btn-xs" onclick="deleteSystemBackup('${backup.filename}')" title="${isEn ? 'Delete' : 'Sil'}" style="padding: 2px 6px; font-size: 0.75rem; color: #ef4444; border-color: rgba(239, 68, 68, 0.3);">
                <i data-lucide="trash-2" style="width:12px;height:12px;"></i>
              </button>
            </td>
          `;
          tbody.appendChild(tr);
        });
        if (window.lucide) window.lucide.createIcons();
      }
      container.classList.remove('hidden');
    } else {
      showToast(data.error || (isEn ? 'Failed to load backups list.' : 'Yedek listesi yüklenemedi.'), 'error');
    }
  } catch (err) {
    showToast(isEn ? 'Connection error.' : 'Bağlantı hatası.', 'error');
  }
}

function downloadSystemBackup(filename) {
  window.open(`/api/backup/download/${encodeURIComponent(filename)}`, '_blank');
}

async function deleteSystemBackup(filename) {
  const isEn = localDb.settings && localDb.settings.lang === 'en';
  if (!confirm(isEn ? `Are you sure you want to delete the backup file "${filename}"?` : `"${filename}" yedek dosyasını silmek istediğinize emin misiniz?`)) {
    return;
  }

  try {
    const res = await fetch(`/api/backup/${encodeURIComponent(filename)}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.success) {
      showToast(isEn ? 'Backup file deleted.' : 'Yedek dosyası silindi.', 'success');
      loadSystemBackupsList(true);
    } else {
      showToast(data.error || (isEn ? 'Failed to delete backup.' : 'Yedek dosyası silinemedi.'), 'error');
    }
  } catch (err) {
    showToast(isEn ? 'Connection error.' : 'Bağlantı hatası.', 'error');
  }
}

function triggerUploadBackupFile() {
  const input = document.getElementById('backup-file-upload-input');
  if (input) input.click();
}

async function uploadBackupFile(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;
  const isEn = localDb.settings && localDb.settings.lang === 'en';

  if (!confirm(isEn ? `Are you sure you want to restore from "${file.name}"? Current settings and database will be replaced.` : `"${file.name}" dosyasındaki yedeği geri yüklemek istediğinize emin misiniz? Mevcut verilerin üzerine yazılacaktır.`)) {
    event.target.value = '';
    return;
  }

  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      showToast(isEn ? 'Uploading and restoring backup...' : 'Yedek dosyası aktarılıyor ve geri yükleniyor...', 'info');
      const fileData = e.target.result;
      const res = await fetch('/api/restore-upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileData, filename: file.name })
      });
      const data = await res.json();
      if (data.success) {
        showToast(isEn ? 'Backup restored successfully! Reloading...' : 'Yedek başarıyla yüklendi ve geri yüklendi! Sayfa yenileniyor...', 'success');
        setTimeout(() => { window.location.reload(); }, 1500);
      } else {
        showToast(data.error || (isEn ? 'Failed to restore backup file.' : 'Yedek dosyası geri yüklenemedi.'), 'error');
      }
    } catch (err) {
      showToast(isEn ? 'Connection error.' : 'Bağlantı hatası.', 'error');
    } finally {
      event.target.value = '';
    }
  };
  reader.readAsDataURL(file);
}

async function restoreSystemBackup(filename) {
  const isEn = localDb.settings && localDb.settings.lang === 'en';
  if (!confirm(isEn ? `Are you sure you want to restore the backup "${filename}"? Current data will be overwritten.` : `"${filename}" yedeğini geri yüklemek istediğinize emin misiniz? Mevcut verilerin üzerine yazılacaktır.`)) {
    return;
  }

  try {
    showToast(isEn ? 'Restoring backup, please wait...' : 'Yedek geri yükleniyor, lütfen bekleyin...', 'info');
    const res = await fetch('/api/restore', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename })
    });
    const data = await res.json();
    if (data.success) {
      showToast(isEn ? 'Backup restored successfully! Reloading page...' : 'Yedek başarıyla geri yüklendi! Sayfa yenileniyor...', 'success');
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } else {
      showToast(data.error || (isEn ? 'Failed to restore backup.' : 'Yedek geri yüklenemedi.'), 'error');
    }
  } catch (err) {
    showToast(isEn ? 'Connection error.' : 'Bağlantı hatası.', 'error');
  }
}

window.createSystemBackup = createSystemBackup;
window.loadSystemBackupsList = loadSystemBackupsList;
window.restoreSystemBackup = restoreSystemBackup;
window.downloadSystemBackup = downloadSystemBackup;
window.deleteSystemBackup = deleteSystemBackup;
window.triggerUploadBackupFile = triggerUploadBackupFile;
window.uploadBackupFile = uploadBackupFile;

async function updateConcurrentLimit() {
  const select = document.getElementById('queue-concurrent-limit');
  if (!select) return;

  const val = parseInt(select.value, 10);
  const isEn = localDb.settings?.lang === 'en';

  try {
    const res = await fetch('/api/settings/concurrent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ limit: val })
    });
    const data = await res.json();
    if (data.success) {
      showToast(isEn ? `Concurrent downloads limit set to ${val}!` : `Eşzamanlı indirme limiti ${val} olarak ayarlandı!`, 'success');
    }
  } catch (err) {
    console.error('Error updating concurrent limit:', err);
    showToast(isEn ? 'Failed to update concurrent limit.' : 'Eşzamanlı limit güncellenemedi.', 'error');
  }
}

window.updateConcurrentLimit = updateConcurrentLimit;

// Türkçe Açıklama: Mevcut yt-dlp motor sürümünü, kanalını ve tüm GitHub sürümlerini sorgulayarak ayarlar sayfasındaki seçim listesini doldurur.
/**
 * yt-dlp motor sürümünü ve mevcut tüm sürümleri API'den sorgular, arayüzü günceller.
 */
async function fetchYtdlpVersion() {
  const versionEl = document.getElementById('ytdlp-current-version');
  const latestEl = document.getElementById('ytdlp-latest-version');
  const badgeEl = document.getElementById('ytdlp-channel-badge');
  const selectEl = document.getElementById('ytdlp-target-select');
  const btn = document.getElementById('ytdlp-update-btn');
  if (!versionEl) return;

  try {
    const res = await fetch('/api/downloader/ytdlp-version');
    const data = await res.json();
    
    // Yerel Sürüm
    if (data.version) {
      versionEl.textContent = data.version;
    } else {
      versionEl.textContent = '?';
    }

    // Kanal Rozeti
    if (badgeEl) {
      if (data.channel === 'nightly') {
        badgeEl.textContent = '🌙 Nightly (Önerilen)';
        badgeEl.style.background = 'rgba(147, 51, 234, 0.15)';
        badgeEl.style.color = '#c084fc';
        badgeEl.style.borderColor = 'rgba(147, 51, 234, 0.3)';
      } else if (data.channel === 'stable') {
        badgeEl.textContent = '⭐ Kararlı (Stable)';
        badgeEl.style.background = 'rgba(59, 130, 246, 0.15)';
        badgeEl.style.color = '#60a5fa';
        badgeEl.style.borderColor = 'rgba(59, 130, 246, 0.3)';
      } else {
        badgeEl.textContent = 'Bilinmiyor';
      }
    }

    // En Son Sürüm (Uzak Sunucu)
    if (latestEl) {
      if (data.latestNightly) {
        latestEl.textContent = data.latestNightly + ' (Nightly)';
      } else if (data.latestStable) {
        latestEl.textContent = data.latestStable + ' (Stable)';
      } else {
        latestEl.textContent = '-';
      }
    }

    // Sürüm Seçim Dropdown'ını Doldur
    if (selectEl) {
      const nightlyGroup = document.getElementById('optgroup-nightly-history');
      const stableGroup = document.getElementById('optgroup-stable-history');

      if (nightlyGroup) {
        nightlyGroup.innerHTML = '';
        if (data.recentNightly && data.recentNightly.length > 0) {
          data.recentNightly.forEach(item => {
            const opt = document.createElement('option');
            opt.value = `nightly@${item.tag}`;
            opt.textContent = `🌙 Nightly ${item.tag}`;
            nightlyGroup.appendChild(opt);
          });
        }
      }

      if (stableGroup) {
        stableGroup.innerHTML = '';
        if (data.recentStable && data.recentStable.length > 0) {
          data.recentStable.forEach(item => {
            const opt = document.createElement('option');
            opt.value = `stable@${item.tag}`;
            opt.textContent = `⭐ Stable ${item.tag}`;
            stableGroup.appendChild(opt);
          });
        }
      }
    }
  } catch (err) {
    versionEl.textContent = '?';
    if (latestEl) latestEl.textContent = '-';
  }
}

// Türkçe Açıklama: Seçilen yt-dlp sürümüne veya en güncel sürüme günceller / geri alır.
/**
 * Seçilen hedef sürüme göre yt-dlp motorunu günceller.
 */
async function updateYtdlp() {
  const btn = document.getElementById('ytdlp-update-btn');
  const selectEl = document.getElementById('ytdlp-target-select');
  const icon = btn ? btn.querySelector('i') : null;
  const t = translations[currentLang] || translations.tr;

  const target = selectEl ? selectEl.value : 'nightly';

  if (btn) btn.disabled = true;
  if (icon) icon.style.animation = 'spin 1s linear infinite';

  showToast(t.toast_ytdlp_updating || 'yt-dlp güncelleniyor...', 'info');

  try {
    const res = await fetch('/api/downloader/ytdlp-update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target })
    });
    const data = await res.json();

    if (data.success) {
      showToast((t.toast_ytdlp_success || 'yt-dlp başarıyla güncellendi') + (data.newVersion ? ': ' + data.newVersion : ''), 'success');
      fetchYtdlpVersion();
    } else {
      showToast((t.toast_ytdlp_fail || 'yt-dlp güncellemesi başarısız oldu') + (data.error ? ': ' + data.error : ''), 'error');
    }
  } catch (err) {
    showToast((t.toast_ytdlp_fail || 'yt-dlp güncellemesi başarısız oldu') + ': ' + err.message, 'error');
  } finally {
    if (btn) btn.disabled = false;
    if (icon) icon.style.animation = '';
  }
}

window.updateYtdlp = updateYtdlp;
window.fetchYtdlpVersion = fetchYtdlpVersion;

// Sayfa yüklendiğinde yt-dlp sürümünü ve Gist alanlarını otomatik sorgula
document.addEventListener('DOMContentLoaded', () => {
  fetchYtdlpVersion();
  setTimeout(() => {
    populateGistFields();
  }, 500);
});

/**
 * Türkçe Açıklama: Video süre stringini (HH:MM:SS, MM:SS, veya saniye) saniyeye çevirir.
 * Bilinmeyen formatlar için null döner.
 * @param {string|number|undefined} duration - Video süresi
 * @returns {number|null} Saniye cinsinden süre veya null
 */
function parseDurationToSeconds(duration) {
  if (duration === undefined || duration === null || duration === '' || duration === '-') return null;
  if (typeof duration === 'number') return duration;
  const str = String(duration).trim();
  if (!str) return null;
  // HH:MM:SS veya MM:SS formatı
  const parts = str.split(':');
  if (parts.length === 3) {
    return parseInt(parts[0], 10) * 3600 + parseInt(parts[1], 10) * 60 + parseInt(parts[2], 10);
  }
  if (parts.length === 2) {
    return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
  }
  // Düz sayı (saniye)
  const num = parseInt(str, 10);
  return isNaN(num) ? null : num;
}

/**
 * Türkçe Açıklama: Kütüphane süre filtresi dropdown değiştiğinde tetiklenir.
 */
function onHistoryDurationFilterChange() {
  const sel = document.getElementById('history-duration-filter');
  if (!sel) return;
  const val = sel.value;
  if (!localDb.settings) localDb.settings = {};
  localDb.settings.historyDurationFilter = val;
  saveHistoryFilterState();
  updateUI(localDb);
  // Backend'e kaydet
  fetch('/api/settings', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ historyDurationFilter: val })
  }).catch(err => console.error('Duration filter save error:', err));
}
window.onHistoryDurationFilterChange = onHistoryDurationFilterChange;

function onHistoryChannelFilterChange() {
  const sel = document.getElementById('history-channel-filter');
  if (!sel) return;
  window.historyFilterChannel = sel.value;
  saveHistoryFilterState();
  updateUI(localDb);
}
window.onHistoryChannelFilterChange = onHistoryChannelFilterChange;

function onHistoryDateFilterChange() {
  const sel = document.getElementById('history-date-filter');
  if (!sel) return;
  window.historyFilterDays = sel.value;
  saveHistoryFilterState();
  updateUI(localDb);
}
window.onHistoryDateFilterChange = onHistoryDateFilterChange;

/**
 * Türkçe Açıklama: Süre filtresini sıfırlar (kapalı konumuna getirir).
 */
function resetHistoryDurationFilter() {
  const sel = document.getElementById('history-duration-filter');
  if (sel) {
    sel.value = 'off';
    onHistoryDurationFilterChange();
  }
}
window.resetHistoryDurationFilter = resetHistoryDurationFilter;
function formatFileSize(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + units[i];
}

// Türkçe Açıklama: İndirilenler ve Kütüphane genelindeki videoların eksik süre ve dosya boyutu (MB/GB) bilgilerini backend'de yeniler.
async function executeRefreshMetadata() {
  const dlBtn = document.getElementById('dl-refresh-metadata-btn');
  const startBtn = document.getElementById('start-refresh-metadata-btn');
  const loading = document.getElementById('refresh-metadata-loading');
  const lang = localDb.settings?.lang || 'tr';
  const t = translations[lang] || translations.tr;
  const isEn = lang === 'en';

  console.log('[Metadata Refresh] İndirilen videolar için metadata güncelleme başlatılıyor...');

  if (dlBtn) dlBtn.disabled = true;
  if (startBtn) startBtn.disabled = true;
  if (loading) loading.classList.remove('hidden');

  const originalDlHtml = dlBtn ? dlBtn.innerHTML : '';
  if (dlBtn) {
    dlBtn.innerHTML = `<i data-lucide="loader" class="spin" style="width:14px;height:14px;display:inline-block;vertical-align:middle;margin-right:4px;"></i> <span>${isEn ? 'Refreshing...' : 'Güncelleniyor...'}</span>`;
    try { lucide.createIcons(); } catch(e) {}
  }

  try {
    const res = await fetch('/api/tools/refresh-metadata', {
      method: 'POST'
    });
    const result = await res.json();
    console.log('[Metadata Refresh] Sunucu yanıtı alındı:', result);

    if (result.success) {
      const successMsg = result.message || (isEn ? 'Metadata refresh started in background.' : 'İndirilen videoların metadata taraması arka planda başlatıldı.');
      showToast(successMsg, 'success');
      
      if (typeof loadDb === 'function') {
        await loadDb();
      }
    } else {
      console.warn('[Metadata Refresh] Hata:', result.error);
      showToast(result.error || t.refresh_metadata_error || (isEn ? 'Metadata refresh failed.' : 'Metadata yenileme başarısız.'), 'error');
    }
  } catch (err) {
    console.error('[Metadata Refresh] İstek hatası:', err);
    showToast(isEn ? 'Metadata refresh request failed.' : 'Metadata yenileme isteği başarısız.', 'error');
  } finally {
    if (dlBtn) {
      dlBtn.disabled = false;
      dlBtn.innerHTML = originalDlHtml;
      try { lucide.createIcons(); } catch(e) {}
    }
    if (startBtn) startBtn.disabled = false;
    if (loading) loading.classList.add('hidden');
  }
}
window.executeRefreshMetadata = executeRefreshMetadata;


/**
 * Kanala yeni bir kategori ekler (Çoklu Kategori).
 */
async function changeChannelCategory(channelId, categoryId) {
  const isEn = localDb.settings && localDb.settings.lang === 'en';
  const catInt = parseInt(categoryId, 10);
  if (!catInt) return;

  const channel = localDb.channels.find(c => c.id === channelId);
  if (!channel) return;

  let currentIds = channel.categoryIds || (channel.categoryId !== undefined ? [channel.categoryId] : [1]);
  if (currentIds.includes(catInt)) return; // Zaten ekliyse ekleme

  let newIds = [...currentIds, catInt];
  if (catInt !== 1 && newIds.includes(1)) {
    newIds = newIds.filter(id => id !== 1);
  }

  try {
    const res = await fetch(`/api/channels/${channelId}/category`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ categoryIds: newIds })
    });
    const result = await res.json();
    if (result.success) {
      showToast(isEn ? 'Category added to channel.' : 'Kategori kanala eklendi.', 'success');
    } else {
      showToast(result.error || (isEn ? 'Failed to add category.' : 'Kategori eklenemedi.'), 'error');
    }
  } catch (err) {
    console.error('changeChannelCategory error:', err);
    showToast(isEn ? 'Failed to add category.' : 'Kategori eklenemedi.', 'error');
  }
}
window.changeChannelCategory = changeChannelCategory;

/**
 * Kanaldan kategori kaldırır (Çoklu Kategori).
 */
async function removeChannelCategory(channelId, catId) {
  const isEn = localDb.settings && localDb.settings.lang === 'en';
  const catInt = parseInt(catId, 10);
  if (!catInt) return;

  const channel = localDb.channels.find(c => c.id === channelId);
  if (!channel) return;

  let currentIds = channel.categoryIds || (channel.categoryId !== undefined ? [channel.categoryId] : [1]);
  let newIds = currentIds.filter(id => id !== catInt);

  if (newIds.length === 0) {
    newIds = [1];
  }

  try {
    const res = await fetch(`/api/channels/${channelId}/category`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ categoryIds: newIds })
    });
    const result = await res.json();
    if (result.success) {
      showToast(isEn ? 'Category removed from channel.' : 'Kategori kanaldan kaldırıldı.', 'success');
    } else {
      showToast(result.error || (isEn ? 'Failed to remove category.' : 'Kategori kaldırılamadı.'), 'error');
    }
  } catch (err) {
    console.error('removeChannelCategory error:', err);
    showToast(isEn ? 'Failed to remove category.' : 'Kategori kaldırılamadı.', 'error');
  }
}
window.removeChannelCategory = removeChannelCategory;

/**
 * Araçlar sekmesindeki kategori listesini render eder.
 */
function loadCategoriesToTools(categories) {
  const listEl = document.getElementById('tools-categories-list');
  if (!listEl) return;
  listEl.innerHTML = '';
  
  const isEn = localDb.settings && localDb.settings.lang === 'en';
  const lang = localDb.settings?.lang || currentLang || 'tr';
  const t = translations[lang] || translations.tr;

  const cats = categories || [];
  const defaultNames = {
    1: ["Genel", "General"],
    2: ["Oyun", "Gaming"],
    3: ["Eğitim", "Education"],
    4: ["Müzik", "Music"],
    5: ["Teknoloji", "Technology"],
    6: ["Spor", "Sports"],
    7: ["Sinema & Film", "Movies & Cinema"],
    8: ["Haberler & Siyaset", "News & Politics"],
    9: ["Eğlence", "Entertainment"],
    10: ["Bilim", "Science"],
    11: ["Gezi & Yaşam", "Travel & Life"],
    12: ["Komedi", "Comedy"],
    13: ["Belgesel", "Documentary"],
    14: ["Anime & Çizgi Film", "Anime & Cartoon"],
    15: ["Finans & Ekonomi", "Finance & Economy"],
    16: ["League of Legends", "League of Legends"],
    17: ["Podcast", "Podcast"]
  };

  const getCatTranslatedName = (cat) => {
    let catName = cat.name;
    if (cat.id >= 1 && cat.id <= 17) {
      const list = defaultNames[cat.id];
      if (list && (cat.name === list[0] || cat.name === list[1] || !cat.name)) {
        catName = t[`category_${cat.id}`] || cat.name;
      }
    }
    return catName;
  };

  const sortedCats = [...cats].sort((a, b) => {
    if (a.id === 1) return -1;
    if (b.id === 1) return 1;
    const nameA = getCatTranslatedName(a);
    const nameB = getCatTranslatedName(b);
    return nameA.localeCompare(nameB, lang, { sensitivity: 'base' });
  });

  sortedCats.forEach(cat => {
    const catName = getCatTranslatedName(cat);

    const tr = document.createElement('tr');
    tr.style.borderBottom = '1px solid var(--border-color)';
    
    const deleteBtnDisabled = cat.id === 1 ? 'disabled style="opacity: 0.5; cursor: not-allowed;"' : '';
    
    tr.innerHTML = `
      <td style="padding:10px 12px; font-weight: 600; color: var(--text-muted);">${cat.id}</td>
      <td style="padding:10px 12px;" id="cat-name-text-${cat.id}">${escapeHtml(catName)}</td>
      <td style="padding:10px 12px; text-align:right;">
        <div style="display:flex; justify-content:flex-end; gap:8px;">
          <button class="btn-icon" onclick="editCategoryName(${cat.id}, '${escapeHtml(cat.name)}')" title="${t.category_edit_tooltip || 'Kategoriyi Düzenle'}">
            <i data-lucide="edit-3" style="width: 14px; height: 14px; color: var(--accent-color);"></i>
          </button>
          <button class="btn-icon" onclick="deleteCategory(${cat.id})" ${deleteBtnDisabled} title="${t.category_delete_tooltip || 'Kategoriyi Sil'}">
            <i data-lucide="trash-2" style="width: 14px; height: 14px; color: var(--accent-red);"></i>
          </button>
        </div>
      </td>
    `;
    listEl.appendChild(tr);
  });

  try {
    lucide.createIcons();
  } catch (e) {}
}
window.loadCategoriesToTools = loadCategoriesToTools;

/**
 * Araçlar sekmesinden yeni kategori ekler.
 */
async function addCategoryFromTools() {
  const input = document.getElementById('new-category-input');
  if (!input) return;
  const name = input.value.trim();
  const isEn = localDb.settings && localDb.settings.lang === 'en';

  if (!name) {
    showToast(isEn ? 'Category name cannot be empty.' : 'Kategori adı boş olamaz.', 'warning');
    return;
  }

  try {
    const res = await fetch('/api/channels/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name })
    });
    const result = await res.json();
    if (result.success) {
      input.value = '';
      showToast(isEn ? 'Category added.' : 'Kategori başarıyla eklendi.', 'success');
    } else {
      showToast(result.error || (isEn ? 'Failed to add category.' : 'Kategori eklenemedi.'), 'error');
    }
  } catch (err) {
    console.error('addCategoryFromTools error:', err);
    showToast(isEn ? 'Failed to add category.' : 'Kategori eklenemedi.', 'error');
  }
}
window.addCategoryFromTools = addCategoryFromTools;

/**
 * Kategori adını düzenler (inline input alanı oluşturarak).
 */
function editCategoryName(id, currentName) {
  const cell = document.getElementById(`cat-name-text-${id}`);
  if (!cell) return;

  const isEn = localDb.settings && localDb.settings.lang === 'en';
  const input = document.createElement('input');
  input.type = 'text';
  input.value = currentName;
  input.style.cssText = 'padding: 4px 8px; border-radius: 4px; border: 1px solid var(--border-color); background: var(--bg-input); color: var(--text-main); font-size: 0.85rem; width: 80%;';
  
  const saveBtn = document.createElement('button');
  saveBtn.innerHTML = '✓';
  saveBtn.className = 'btn btn-primary';
  saveBtn.style.cssText = 'padding: 4px 8px; margin-left: 6px; font-size: 0.8rem;';
  
  cell.innerHTML = '';
  cell.appendChild(input);
  cell.appendChild(saveBtn);
  input.focus();

  const performSave = async () => {
    const newName = input.value.trim();
    if (!newName) {
      showToast(isEn ? 'Category name cannot be empty.' : 'Kategori adı boş olamaz.', 'warning');
      cell.textContent = currentName;
      return;
    }
    if (newName === currentName) {
      cell.textContent = currentName;
      return;
    }

    try {
      const res = await fetch(`/api/channels/categories/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName })
      });
      const result = await res.json();
      if (result.success) {
        showToast(isEn ? 'Category updated.' : 'Kategori güncellendi.', 'success');
      } else {
        showToast(result.error || (isEn ? 'Failed to update category.' : 'Kategori güncellenemedi.'), 'error');
        cell.textContent = currentName;
      }
    } catch (err) {
      console.error('editCategoryName error:', err);
      showToast(isEn ? 'Failed to update category.' : 'Kategori güncellenemedi.', 'error');
      cell.textContent = currentName;
    }
  };

  saveBtn.onclick = performSave;
  input.onkeydown = (e) => {
    if (e.key === 'Enter') performSave();
    if (e.key === 'Escape') cell.textContent = currentName;
  };
}
window.editCategoryName = editCategoryName;

/**
 * Kategoriyi siler.
 */
async function deleteCategory(id) {
  const isEn = localDb.settings && localDb.settings.lang === 'en';
  const confirmMsg = isEn 
    ? 'Are you sure you want to delete this category? Channels in this category will be moved to General.' 
    : 'Bu kategoriyi silmek istediğinize emin misiniz? Bu kategorideki kanallar Genel kategorisine taşınacaktır.';
  
  if (!confirm(confirmMsg)) return;

  try {
    const res = await fetch(`/api/channels/categories/${id}`, {
      method: 'DELETE'
    });
    const result = await res.json();
    if (result.success) {
      showToast(isEn ? 'Category deleted.' : 'Kategori silindi.', 'success');
    } else {
      showToast(result.error || (isEn ? 'Failed to delete category.' : 'Kategori silinemedi.'), 'error');
    }
  } catch (err) {
    console.error('deleteCategory error:', err);
    showToast(isEn ? 'Failed to delete category.' : 'Kategori silinemedi.', 'error');
  }
}
window.deleteCategory = deleteCategory;


document.addEventListener('DOMContentLoaded', () => {
  if (typeof initDownloaderUI === 'function') initDownloaderUI();
  if (typeof restoreHistoryFilterState === 'function') restoreHistoryFilterState();
  if (typeof restoreDownloadedFilterState === 'function') restoreDownloadedFilterState();

  const durationFilterEl = document.getElementById('history-duration-filter');
  if (durationFilterEl) {
    durationFilterEl.addEventListener('change', onHistoryDurationFilterChange);
  }

  // Kanal Filtrelerini Sayfa Yüklenince Otomatik Doldur
  setTimeout(() => {
    if (typeof populateChannelFilters === 'function') {
      populateChannelFilters(localDb);
    }
  }, 300);
});

/**
 * APE Aracı: Girilen video veya kanal linkindeki videoları izlendi/gizlendi işaretler.
 */
window.handleApeMarkWatched = async function() {
  const inputEl = document.getElementById('ape-target-input');
  const syncCb = document.getElementById('ape-sync-youtube-checkbox');
  const resultBox = document.getElementById('ape-result-box');
  const resultText = document.getElementById('ape-result-text');
  const resultIcon = document.getElementById('ape-result-icon');
  const btn = document.getElementById('btn-ape-mark-watched');

  if (!inputEl) return;
  const target = inputEl.value.trim();
  const lang = localStorage.getItem('haytool_user_lang') || 'tr';
  const t = translations[lang] || translations.tr;

  if (!target) {
    showToast(t.ape_empty_input || 'Lütfen bir video veya kanal linki girin.', 'warning');
    if (inputEl) inputEl.focus();
    return;
  }

  const syncYouTube = syncCb ? syncCb.checked : true;

  try {
    if (btn) btn.disabled = true;
    showToast(t.ape_processing || 'İşleniyor...', 'info');

    const res = await fetch('/api/tools/ape-mark-watched', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target, syncYouTube })
    });

    const data = await res.json();
    if (data.success) {
      showToast(data.message || 'Başarıyla işaretlendi.', 'success');
      if (resultBox && resultText) {
        resultBox.classList.remove('hidden');
        resultBox.style.background = 'rgba(34, 197, 94, 0.1)';
        resultBox.style.border = '1px solid rgba(34, 197, 94, 0.3)';
        resultBox.style.color = '#22c55e';
        resultText.innerHTML = `<strong>${t.ape_success_title || 'Başarılı:'}</strong> ${escapeHtml(data.message)}`;
        if (resultIcon) resultIcon.setAttribute('data-lucide', 'check-circle');
      }
      inputEl.value = '';
    } else {
      showToast(data.error || 'İşlem başarısız oldu.', 'error');
      if (resultBox && resultText) {
        resultBox.classList.remove('hidden');
        resultBox.style.background = 'rgba(239, 68, 68, 0.1)';
        resultBox.style.border = '1px solid rgba(239, 68, 68, 0.3)';
        resultBox.style.color = '#ef4444';
        resultText.innerHTML = `<strong>${t.ape_error_title || 'Hata:'}</strong> ${escapeHtml(data.error || 'Bilinmeyen hata')}`;
        if (resultIcon) resultIcon.setAttribute('data-lucide', 'alert-triangle');
      }
    }
    if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
  } catch (err) {
    showToast(err.message || 'Bağlantı hatası.', 'error');
  } finally {
    if (btn) btn.disabled = false;
  }
};

/**
 * Araçlar sekmesindeki akordiyon menü ögelerinin açılıp kapanmasını kontrol eder.
 * @param {'compare'|'categories'|'ape'} itemKey Akordiyon öge anahtarı
 */
window.toggleToolsAccordion = function(itemKey) {
  const itemEl = document.getElementById(`accordion-item-${itemKey}`);
  if (!itemEl) return;
  const isCurrentlyActive = itemEl.classList.contains('active');
  
  if (isCurrentlyActive) {
    itemEl.classList.remove('active');
  } else {
    itemEl.classList.add('active');
  }
  try {
    if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
  } catch (e) {}
};

/* ===== Global Custom Channel Avatar Dropdown Component ===== */
function toggleCustomChannelPicker(type, event) {
  if (event) {
    event.stopPropagation();
    if (typeof event.preventDefault === 'function') event.preventDefault();
  }
  const dropdown = document.getElementById(`${type}-custom-dropdown`);
  if (!dropdown) return;
  const isOpen = dropdown.classList.contains('open');
  document.querySelectorAll('.custom-channel-dropdown').forEach(d => d.classList.remove('open'));
  if (!isOpen) {
    dropdown.classList.add('open');
  }
}
window.toggleCustomChannelPicker = toggleCustomChannelPicker;

document.addEventListener('click', (e) => {
  if (!e.target.closest('.custom-channel-dropdown')) {
    document.querySelectorAll('.custom-channel-dropdown').forEach(d => d.classList.remove('open'));
  }
});

function selectCustomChannelOption(type, value, event) {
  if (event) {
    event.stopPropagation();
  }
  const selectEl = document.getElementById(`${type}-channel-filter`);
  const dropdown = document.getElementById(`${type}-custom-dropdown`);

  if (selectEl) selectEl.value = value;
  if (dropdown) dropdown.classList.remove('open');

  if (type === 'history') {
    historyFilterChannel = value;
  } else if (type === 'downloaded') {
    downloadedFilterChannel = value;
  }

  // Yeniden render et ve arayüzü güncelle
  if (typeof updateUI === 'function') {
    updateUI(localDb);
  } else {
    populateChannelFilters(localDb);
  }
}
window.selectCustomChannelOption = selectCustomChannelOption;

function populateChannelFilters(db) {
  const targetDb = db || localDb || {};
  const channels = targetDb.channels || [];
  const categories = targetDb.categories || [];
  const lang = localDb.settings?.lang || currentLang || 'tr';
  const t = translations[lang] || translations.tr;

  const defaultNames = {
    1: ["Genel", "General"], 2: ["Oyun", "Gaming"], 3: ["Eğitim", "Education"],
    4: ["Müzik", "Music"], 5: ["Teknoloji", "Technology"], 6: ["Spor", "Sports"],
    7: ["Sinema & Film", "Movies & Cinema"], 8: ["Haberler & Siyaset", "News & Politics"],
    9: ["Eğlence", "Entertainment"], 10: ["Bilim", "Science"], 11: ["Gezi & Yaşam", "Travel & Life"],
    12: ["Komedi", "Comedy"], 13: ["Belgesel", "Documentary"], 14: ["Anime & Çizgi Film", "Anime & Cartoon"],
    15: ["Finans & Ekonomi", "Finance & Economy"], 16: ["League of Legends", "League of Legends"], 17: ["Podcast", "Podcast"]
  };

  const getCatTranslatedName = (cat) => {
    let catName = cat.name;
    if (cat.id >= 1 && cat.id <= 17) {
      const list = defaultNames[cat.id];
      if (list && (cat.name === list[0] || cat.name === list[1] || !cat.name)) {
        catName = t[`category_${cat.id}`] || cat.name;
      }
    }
    return catName;
  };

  ['history', 'downloaded'].forEach(type => {
    const panel = document.getElementById(`${type}-channel-options-panel`);
    const triggerContent = document.getElementById(`${type}-channel-trigger-content`);
    const selectEl = document.getElementById(`${type}-channel-filter`);
    if (!panel) return;

    const currentValue = (type === 'history' ? historyFilterChannel : downloadedFilterChannel) || (selectEl ? selectEl.value : 'all');

    let html = '';
    let activeTriggerHtml = `<i data-lucide="globe" style="width:14px;height:14px;color:var(--accent-color);"></i><span>${escapeHtml(t.filter_all_channels || 'Tüm Kanallar')}</span>`;

    // 1. Tüm Kanallar
    const allText = t.filter_all_channels || 'Tüm Kanallar';
    const allIcon = `<i data-lucide="globe" style="width:16px;height:16px;color:var(--accent-color);"></i>`;
    if (currentValue === 'all') {
      activeTriggerHtml = `${allIcon}<span>${escapeHtml(allText)}</span>`;
    }
    html += `
      <div class="custom-dropdown-item ${currentValue === 'all' ? 'active' : ''}" onclick="selectCustomChannelOption('${type}', 'all', event)">
        ${allIcon}
        <span>${escapeHtml(allText)}</span>
      </div>
    `;

    // 2. Kategoriler (Tek Kategori İkonu)
    if (categories && categories.length > 0) {
      const sortedFilterCats = [...categories].sort((a, b) => {
        if (a.id === 1) return -1;
        if (b.id === 1) return 1;
        return getCatTranslatedName(a).localeCompare(getCatTranslatedName(b), lang, { sensitivity: 'base' });
      });

      sortedFilterCats.forEach(cat => {
        const catName = getCatTranslatedName(cat);
        const hasChannel = channels.some(c => (c.categoryIds || [c.categoryId || 1]).includes(cat.id));
        if (hasChannel) {
          const catValue = `category:${cat.id}`;
          const catText = catName;
          const catIcon = `<i data-lucide="folder" style="width:16px;height:16px;color:var(--accent-color);"></i>`;
          const isSel = currentValue === catValue;
          if (isSel) {
            activeTriggerHtml = `${catIcon}<span>${escapeHtml(catText)}</span>`;
          }
          html += `
            <div class="custom-dropdown-item ${isSel ? 'active' : ''}" onclick="selectCustomChannelOption('${type}', '${catValue}', event)">
              ${catIcon}
              <span>${escapeHtml(catText)}</span>
            </div>
          `;
        }
      });

      html += `<div class="custom-dropdown-divider"></div>`;
    }

    // 3. Kanallar (GERÇEK YOUTUBE KANAL LOGOLARI/AVATARLARI İLE)
    const sortedChannels = [...channels].sort((a, b) => a.name.localeCompare(b.name, 'tr'));
    sortedChannels.forEach(channel => {
      const avatarUrl = `/api/channels/${channel.id}/avatar`;
      const isSel = currentValue === channel.id;
      const avatarImgHtml = `<img src="${avatarUrl}" class="custom-dropdown-avatar" onerror="this.src='/logo.png'">`;
      
      if (isSel) {
        activeTriggerHtml = `${avatarImgHtml}<span>${escapeHtml(channel.name)}</span>`;
      }

      html += `
        <div class="custom-dropdown-item ${isSel ? 'active' : ''}" onclick="selectCustomChannelOption('${type}', '${channel.id}', event)">
          ${avatarImgHtml}
          <span>${escapeHtml(channel.name)}</span>
        </div>
      `;
    });

    panel.innerHTML = html;
    if (triggerContent) {
      triggerContent.innerHTML = activeTriggerHtml;
    }
  });

  try { if (typeof lucide !== 'undefined') lucide.createIcons(); } catch (e) {}
}
window.populateChannelFilters = populateChannelFilters;

// ==========================================
// GitHub Gist Senkronizasyon İşlevleri
// ==========================================

/**
 * GitHub Token (PAT) şifreli alanının görünürlüğünü açık/kapalı yapar.
 */
function toggleGistTokenVisibility() {
  const input = document.getElementById('gist-token-input');
  const icon = document.getElementById('gist-token-eye-icon');
  if (!input) return;

  if (input.type === 'password') {
    input.type = 'text';
    if (icon) icon.setAttribute('data-lucide', 'eye-off');
  } else {
    input.type = 'password';
    if (icon) icon.setAttribute('data-lucide', 'eye');
  }
  try { if (typeof lucide !== 'undefined') lucide.createIcons(); } catch (e) {}
}
window.toggleGistTokenVisibility = toggleGistTokenVisibility;

/**
 * GitHub Token'ının geçerliliğini test eder.
 */
async function testGistToken() {
  const input = document.getElementById('gist-token-input');
  const token = input ? input.value.trim() : '';
  const isEn = window.localDb && window.localDb.settings && window.localDb.settings.lang === 'en';

  if (!token) {
    showToast(isEn ? 'Please enter a GitHub Token.' : 'Lütfen bir GitHub Token girin.', 'error');
    return;
  }

  try {
    showToast(isEn ? 'Verifying GitHub Token...' : 'GitHub Token doğrulanıyor...', 'info');
    const res = await fetch('/api/gist/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token })
    });
    const data = await res.json();

    if (data.success) {
      if (data.warning) {
        showToast(data.warning, 'warning');
      } else {
        showToast(isEn ? `Token verified! Connected as: ${data.username}` : `Token doğrulandı! Bağlanan kullanıcı: ${data.username}`, 'success');
      }
    } else {
      showToast(data.error || (isEn ? 'Token verification failed.' : 'Token doğrulaması başarısız.'), 'error');
    }
  } catch (err) {
    showToast(isEn ? 'Connection error.' : 'Bağlantı hatası.', 'error');
  }
}
window.testGistToken = testGistToken;

/**
 * Yerel channels.ini dosyasını GitHub Gist'e aktarır (Push).
 */
async function pushGistChannels() {
  const tokenInput = document.getElementById('gist-token-input');
  const idInput = document.getElementById('gist-id-input');
  const autoSyncCheckbox = document.getElementById('gist-auto-sync-checkbox');

  let token = tokenInput && tokenInput.value ? tokenInput.value.trim() : '';
  if (!token && window.localDb && window.localDb.settings && window.localDb.settings.githubToken) {
    token = window.localDb.settings.githubToken;
  }
  let gistId = idInput && idInput.value ? idInput.value.trim() : '';
  if (!gistId && window.localDb && window.localDb.settings && window.localDb.settings.githubGistId) {
    gistId = window.localDb.settings.githubGistId;
  }
  const autoSync = autoSyncCheckbox ? autoSyncCheckbox.checked : false;
  const isEn = window.localDb && window.localDb.settings && window.localDb.settings.lang === 'en';

  if (!token) {
    showToast(isEn ? 'GitHub Token missing. Please enter a new token.' : 'GitHub Token bulunamadı. Lütfen yeni bir token girin veya Token\'ı Sil\'e basıp tekrar kaydedin.', 'error');
    return;
  }

  try {
    showToast(isEn ? 'Uploading system data to GitHub Gist...' : 'Sistem verileri GitHub Gist üzerine aktarılıyor...', 'info');
    const res = await fetch('/api/gist/push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, gistId, autoSync })
    });
    const data = await res.json();

    if (data.success) {
      if (idInput && data.gistId) {
        idInput.value = data.gistId;
      }
      if (window.localDb && window.localDb.settings) {
        window.localDb.settings.githubToken = token;
        window.localDb.settings.githubGistId = data.gistId || gistId;
        window.localDb.settings.autoSyncGist = autoSync;
      }
      populateGistFields();
      if (typeof triggerAutoSave === 'function') {
        await triggerAutoSave(true);
      }
      showToast(isEn ? 'System data uploaded to GitHub Gist successfully!' : 'Sistem verileri başarıyla GitHub Gist üzerine yüklendi!', 'success');
    } else {
      let errMsg = data.error || (isEn ? 'Push failed.' : 'Gist yüklemesi başarısız.');
      if (errMsg.toLowerCase().includes('bad credentials') || errMsg.includes('401')) {
        errMsg = isEn ? 'Invalid or revoked GitHub Token. Please delete and save a new token.' : 'GitHub Token\'ı geçersiz veya iptal edilmiş. Lütfen "Token\'ı Sil"e basıp yeni bir token kaydedin.';
      }
      showToast(errMsg, 'error');
    }
  } catch (err) {
    showToast(isEn ? 'Connection error.' : 'Bağlantı hatası.', 'error');
  }
}
window.pushGistChannels = pushGistChannels;

/**
 * GitHub Gist üzerindeki channels.ini dosyasını indirir (Pull).
 */
async function pullGistChannels() {
  const tokenInput = document.getElementById('gist-token-input');
  const idInput = document.getElementById('gist-id-input');

  let token = tokenInput && tokenInput.value ? tokenInput.value.trim() : '';
  if (!token && window.localDb && window.localDb.settings && window.localDb.settings.githubToken) {
    token = window.localDb.settings.githubToken;
  }
  let gistId = idInput && idInput.value ? idInput.value.trim() : '';
  if (!gistId && window.localDb && window.localDb.settings && window.localDb.settings.githubGistId) {
    gistId = window.localDb.settings.githubGistId;
  }
  const isEn = window.localDb && window.localDb.settings && window.localDb.settings.lang === 'en';

  if (!token || !gistId) {
    showToast(isEn ? 'Please enter both GitHub Token and Gist ID.' : 'Lütfen hem GitHub Token hem de Gist ID girin.', 'error');
    return;
  }

  try {
    showToast(isEn ? 'Downloading system data from GitHub Gist...' : 'Sistem verileri GitHub Gist üzerinden indiriliyor...', 'info');
    const res = await fetch('/api/gist/pull', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, gistId })
    });
    const data = await res.json();

    if (data.success) {
      if (window.localDb && window.localDb.settings) {
        window.localDb.settings.githubToken = token;
        window.localDb.settings.githubGistId = gistId;
      }
      populateGistFields();
      if (typeof triggerAutoSave === 'function') {
        await triggerAutoSave(true);
      }
      showToast(isEn ? 'System data pulled from Gist successfully!' : 'Sistem verileri Gist üzerinden başarıyla yüklendi!', 'success');
      setTimeout(() => {
        window.location.reload();
      }, 1200);
    } else {
      let errMsg = data.error || (isEn ? 'Pull failed.' : 'Gist indirmesi başarısız.');
      if (errMsg.toLowerCase().includes('bad credentials') || errMsg.includes('401')) {
        errMsg = isEn ? 'Invalid or revoked GitHub Token. Please delete and save a new token.' : 'GitHub Token\'ı geçersiz veya iptal edilmiş. Lütfen "Token\'ı Sil"e basıp yeni bir token kaydedin.';
      }
      showToast(errMsg, 'error');
    }
  } catch (err) {
    showToast(isEn ? 'Connection error.' : 'Bağlantı hatası.', 'error');
  }
}
window.pullGistChannels = pullGistChannels;

/**
 * Otomatik Gist senkronizasyon ayarını günceller.
 */
function toggleAutoSyncGist(checked) {
  if (window.localDb && window.localDb.settings) {
    window.localDb.settings.autoSyncGist = checked;
  }
}
window.toggleAutoSyncGist = toggleAutoSyncGist;

/**
 * Ayarlar yüklendiğinde Gist alanlarını doldurur.
 */
function populateGistFields() {
  if (!window.localDb || !window.localDb.settings) return;
  const tokenInput = document.getElementById('gist-token-input');
  const idInput = document.getElementById('gist-id-input');
  const autoSyncCheckbox = document.getElementById('gist-auto-sync-checkbox');
  const linkContainer = document.getElementById('gist-online-link-container');
  const linkEl = document.getElementById('gist-online-link');

  const unregState = document.getElementById('gist-unregistered-state');
  const regState = document.getElementById('gist-registered-state');
  const hasSavedToken = !!(window.localDb.settings.githubToken && window.localDb.settings.githubToken.trim());

  if (unregState && regState) {
    if (hasSavedToken) {
      unregState.style.display = 'none';
      regState.style.display = 'block';
    } else {
      unregState.style.display = 'block';
      regState.style.display = 'none';
    }
  }

  if (tokenInput && window.localDb.settings.githubToken !== undefined) {
    if (document.activeElement !== tokenInput) {
      tokenInput.value = window.localDb.settings.githubToken || '';
    }
  }
  if (idInput && window.localDb.settings.githubGistId !== undefined) {
    if (document.activeElement !== idInput) {
      idInput.value = window.localDb.settings.githubGistId || '';
    }
  }
  if (autoSyncCheckbox && window.localDb.settings.autoSyncGist !== undefined) {
    if (document.activeElement !== autoSyncCheckbox) {
      autoSyncCheckbox.checked = !!window.localDb.settings.autoSyncGist;
    }
  }

  const gistId = idInput ? idInput.value.trim() : (window.localDb.settings.githubGistId || '');
  if (linkContainer && linkEl) {
    if (gistId) {
      linkEl.href = `https://gist.github.com/${gistId}`;
      linkContainer.style.display = 'block';
    } else {
      linkContainer.style.display = 'none';
    }
  }

  // Input değişimlerinde otomatik kaydetme dinleyicileri
  if (tokenInput && !tokenInput.dataset.listenerAttached) {
    tokenInput.dataset.listenerAttached = 'true';
    tokenInput.addEventListener('input', () => {
      if (window.localDb && window.localDb.settings) {
        window.localDb.settings.githubToken = tokenInput.value.trim();
      }
      if (typeof triggerAutoSave === 'function') triggerAutoSave();
    });
  }
  if (idInput && !idInput.dataset.listenerAttached) {
    idInput.dataset.listenerAttached = 'true';
    idInput.addEventListener('input', () => {
      const val = idInput.value.trim();
      if (window.localDb && window.localDb.settings) {
        window.localDb.settings.githubGistId = val;
      }
      if (linkContainer && linkEl) {
        if (val) {
          linkEl.href = `https://gist.github.com/${val}`;
          linkContainer.style.display = 'block';
        } else {
          linkContainer.style.display = 'none';
        }
      }
      if (typeof triggerAutoSave === 'function') triggerAutoSave();
    });
  }
}
window.populateGistFields = populateGistFields;

/**
 * Kullanıcının girdiği Token ve Gist ID bilgilerini doğrular ve db.json'a kaydeder.
 */
async function saveGistToken() {
  const tokenInput = document.getElementById('gist-token-input');
  const idInput = document.getElementById('gist-id-input');
  const token = tokenInput ? tokenInput.value.trim() : '';
  const gistId = idInput ? idInput.value.trim() : '';
  const isEn = window.localDb && window.localDb.settings && window.localDb.settings.lang === 'en';

  if (!token) {
    showToast(isEn ? 'Please enter a GitHub Token.' : 'Lütfen geçerli bir GitHub Token girin.', 'error');
    return;
  }

  showToast(isEn ? 'Verifying token...' : 'Token doğrulanıyor...', 'info');

  try {
    const res = await fetch('/api/gist/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token })
    });
    const data = await res.json();

    if (data.success) {
      if (window.localDb && window.localDb.settings) {
        window.localDb.settings.githubToken = token;
        window.localDb.settings.githubGistId = gistId;
      }
      populateGistFields();
      if (typeof triggerAutoSave === 'function') {
        await triggerAutoSave(true);
      }
      const username = data.username || data.user || '';
      showToast(isEn ? `Token verified and saved! Account: @${username}` : `Token başarıyla doğrulandı ve kaydedildi! Kullanıcı: @${username}`, 'success');
    } else {
      showToast(data.error || (isEn ? 'Token is invalid.' : 'Token geçersiz.'), 'error');
    }
  } catch (err) {
    showToast(isEn ? 'Connection error.' : 'Bağlantı hatası.', 'error');
  }
}
window.saveGistToken = saveGistToken;

/**
 * Kayıtlı Token ve Gist ID bilgilerini siler ve düzenleme moduna döner.
 */
async function deleteGistToken() {
  const isEn = window.localDb && window.localDb.settings && window.localDb.settings.lang === 'en';
  const confirmMsg = isEn 
    ? 'Are you sure you want to remove your GitHub Token credentials from this device?' 
    : 'GitHub Token ve bağlantı bilgilerinizi bu bilgisayardan silmek istediğinize emin misiniz?';

  if (!confirm(confirmMsg)) return;

  if (window.localDb && window.localDb.settings) {
    window.localDb.settings.githubToken = '';
    window.localDb.settings.githubGistId = '';
  }

  const tokenInput = document.getElementById('gist-token-input');
  const idInput = document.getElementById('gist-id-input');
  if (tokenInput) tokenInput.value = '';
  if (idInput) idInput.value = '';

  populateGistFields();

  if (typeof triggerAutoSave === 'function') {
    await triggerAutoSave(true);
  }

  showToast(isEn ? 'GitHub Token removed.' : 'GitHub Token ve bağlantı bilgileri silindi.', 'info');
}
window.deleteGistToken = deleteGistToken;

/**
 * YouTube Oturumu ve Çerez Durumunu Sorgular ve UI'da gösterir.
 */
window.checkYouTubeAuthStatus = async function() {
  const badgeEl = document.getElementById('cookie-status-badge');
  const topbarCookieBadge = document.getElementById('badge-cookie');
  const topbarCookieIndicator = document.getElementById('cookie-test-indicator');

  const currentLang = localStorage.getItem('haytool_user_lang') || 'tr';
  const t = translations[currentLang] || translations.tr;

  try {
    const res = await fetch('/api/youtube-auth-status');
    const data = await res.json();
    const isAuthActive = data.success && data.activeSource && data.activeSource !== 'none';

    if (isAuthActive) {
      if (badgeEl) {
        badgeEl.style.background = 'rgba(34, 197, 94, 0.15)';
        badgeEl.style.color = '#22c55e';
        badgeEl.style.border = '1px solid rgba(34, 197, 94, 0.3)';
        badgeEl.innerHTML = `<i data-lucide="shield-check" style="width: 12px; height: 12px;"></i> <span>${t.cookie_status_active || 'Oturum Aktif (Bot Koruması Devre Dışı)'}</span>`;
      }

      if (topbarCookieBadge) {
        topbarCookieBadge.title = t.topbar_cookie_active || 'YouTube Oturumu Aktif (4K/1080p ve Bot Koruması Devrede)';
      }
      if (topbarCookieIndicator) {
        topbarCookieIndicator.style.backgroundColor = '#22c55e';
        topbarCookieIndicator.style.boxShadow = '0 0 6px rgba(34, 197, 94, 0.8)';
        topbarCookieIndicator.title = 'YouTube Oturumu Doğrulandı';
      }
    } else {
      if (badgeEl) {
        badgeEl.style.background = 'rgba(239, 68, 68, 0.15)';
        badgeEl.style.color = '#ef4444';
        badgeEl.style.border = '1px solid rgba(239, 68, 68, 0.3)';
        badgeEl.innerHTML = `<i data-lucide="shield-alert" style="width: 12px; height: 12px;"></i> <span>${t.cookie_status_anon || 'Oturum Açılmamış (Anonim Mod)'}</span>`;
      }

      if (topbarCookieBadge) {
        topbarCookieBadge.title = t.topbar_cookie_inactive || 'YouTube Oturumu Açılmamış (Anonim Mod - 360p veya Bot Riski)';
      }
      if (topbarCookieIndicator) {
        topbarCookieIndicator.style.backgroundColor = '#ef4444';
        topbarCookieIndicator.style.boxShadow = 'none';
        topbarCookieIndicator.title = 'YouTube Oturumu Bulunamadı';
      }
    }
    if (typeof lucide !== 'undefined') lucide.createIcons();
  } catch (e) {
    console.error('YouTube auth status error:', e);
  }
};

/**
 * YouTube çerezlerini canlı test eder.
 */
window.testCookies = async function() {
  const currentLang = localStorage.getItem('haytool_user_lang') || 'tr';
  showToast(currentLang === 'en' ? 'Verifying YouTube cookies...' : 'YouTube çerezleri doğrulanıyor...', 'info');

  try {
    const res = await fetch('/api/test-cookies');
    const data = await res.json();
    if (data.success) {
      showToast(data.message || 'Çerezler başarıyla doğrulandı.', 'success');
    } else {
      showToast(data.error || 'Çerez doğrulama başarısız.', 'warning');
    }
    window.checkYouTubeAuthStatus();
  } catch (e) {
    showToast('Sunucu ile iletişim hatası.', 'error');
  }
};

/**
 * YouTube oturumunu kapatır ve yerel çerezleri sıfırlar.
 */
window.logoutYouTube = async function() {
  const currentLang = localStorage.getItem('haytool_user_lang') || 'tr';
  const t = translations[currentLang] || translations.tr;

  const confirmMsg = t.logout_youtube_confirm || 'YouTube oturumunu kapatmak ve yerel çerezleri temizlemek istediğinizden emin misiniz?';
  if (!confirm(confirmMsg)) return;

  showToast(currentLang === 'en' ? 'Signing out of YouTube...' : 'YouTube oturumu kapatılıyor...', 'info');

  try {
    const res = await fetch('/api/logout-youtube', { method: 'POST' });
    const data = await res.json();
    if (data.success) {
      showToast(t.logout_youtube_success || 'YouTube oturumu başarıyla kapatıldı.', 'success');
    } else {
      showToast(data.error || 'Oturum kapatılırken hata oluştu.', 'error');
    }
    window.checkYouTubeAuthStatus();
  } catch (e) {
    showToast('Sunucu ile iletişim hatası.', 'error');
  }
};

/**
 * YouTube oturum açma penceresini başlatır.
 */
window.openYouTubeLogin = async function() {
  const currentLang = localStorage.getItem('haytool_user_lang') || 'tr';
  const loginUrl = 'https://accounts.google.com/ServiceLogin?service=youtube&continue=https%3A%2F%2Fwww.youtube.com';
  showToast(currentLang === 'en' ? 'Opening YouTube login window...' : 'YouTube oturum açma sayfası açılıyor...', 'info');

  // 1. Doğrudan tarayıcı/WebView2 penceresinde aç
  try {
    window.open(loginUrl, '_blank');
  } catch (e) {}

  // 2. Sistem düzeyinde varsayılan tarayıcıda da tetikle
  try {
    await fetch('/api/open-youtube-login', { method: 'POST' });
  } catch (e) {}
};

// Event listener bağlantıları
document.addEventListener('DOMContentLoaded', () => {
  const btnYtLogin = document.getElementById('btn-open-yt-login');
  if (btnYtLogin) {
    btnYtLogin.addEventListener('click', window.openYouTubeLogin);
  }

  const btnTestCookies = document.getElementById('btn-test-cookies-live');
  if (btnTestCookies) {
    btnTestCookies.addEventListener('click', window.testCookies);
  }

  const btnLogoutYt = document.getElementById('btn-logout-youtube');
  if (btnLogoutYt) {
    btnLogoutYt.addEventListener('click', window.logoutYouTube);
  }
});





