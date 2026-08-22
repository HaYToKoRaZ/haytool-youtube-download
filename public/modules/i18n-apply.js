/**
 * Dinamik Dil ve Arayüz Çevirisi Uygulama Modülü (i18n-apply.js)
 * 
 * Yapımcı: HaYTo
 * Açıklama: Seçilen dil paketine (TR, EN vb.) göre sayfadaki tüm metin etiketlerini,
 *            buton başlıklarını, form placeholder ve açıklamalarını dinamik olarak DOM'a uygular.
 * Bağımlılıklar: translations (utils/i18n.js) ve app.js getState() getter'ı.
 */

import { translations } from '../utils/i18n.js';

let _getState = null;

let currentLang = 'tr';

const localDb = new Proxy({}, {
  get(target, prop) {
    const db = (_getState?.().localDb) || window.localDb || { history: [], channels: [], settings: {}, categories: [] };
    return db[prop];
  },
  set(target, prop, value) {
    const db = (_getState?.().localDb) || window.localDb || {};
    db[prop] = value;
    return true;
  }
});

export function initI18nApply(getState) {
  _getState = getState;
}

export function applyLanguage(lang) {
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
  if (inlineSubColor && inlineSubColor.options && inlineSubColor.options.length >= 12) {
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


  // Ust bar baglanti ve cerez durumu baslik ve metin cevirisi
  const statusIndicator2 = document.getElementById('status-indicator');
  const statusText = document.getElementById('topbar-status-text');
  const badgeConn = document.getElementById('badge-connection');
  if (statusIndicator2) {
    let connTitle = t.connection_connecting || 'Bağlanıyor...';
    if (statusIndicator2.classList.contains('online')) {
      connTitle = t.connection_active || 'Bağlantı: Aktif';
    } else if (statusIndicator2.classList.contains('offline')) {
      connTitle = t.connection_lost || 'Bağlantı Kesildi';
    }
    if (statusText) statusText.textContent = connTitle;
    if (badgeConn) badgeConn.title = connTitle;
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

if (typeof window !== 'undefined') {
  window.applyLanguage = applyLanguage;
}
