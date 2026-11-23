// Türkçe Açıklama: İndirme hatalarını (yt-dlp, Python, FFmpeg, Disk, Çerez, Ağ vb.) analiz ederek
// kullanıcı dostu, çok dilli (i18n) kısa rozet başlığına ve çözüm ipucu içeren açıklamaya dönüştüren modül.

/**
 * Ham hata metninden gürültülü WARNING ve Python path satırlarını ayıklayarak tek satırlık teknik özet üretir.
 * @param {string} rawError
 * @returns {string}
 */
export function extractTechnicalSummary(rawError) {
  if (!rawError || typeof rawError !== 'string') return '';
  const lines = rawError
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(Boolean);

  if (lines.length === 0) return '';

  const fatalPythonLine = lines.find(l => /^Fatal Python error:|^ModuleNotFoundError:/i.test(l));
  if (fatalPythonLine) {
    const modLine = lines.find(l => /^ModuleNotFoundError:/i.test(l));
    return modLine && modLine !== fatalPythonLine ? `${fatalPythonLine} (${modLine})` : fatalPythonLine;
  }

  const pyiLine = lines.find(l => /^\[PYI-\d+:ERROR\]/i.test(l));
  if (pyiLine) return pyiLine;

  const errorLines = lines.filter(l => /^ERROR:/i.test(l) || /\bERROR:\s/i.test(l));
  if (errorLines.length > 0) {
    const lastErr = errorLines[errorLines.length - 1];
    return lastErr.length > 160 ? lastErr.substring(0, 160) + '...' : lastErr;
  }

  const nonWarningLines = lines.filter(l => !/^WARNING:/i.test(l));
  const candidate = nonWarningLines.length > 0 ? nonWarningLines[0] : lines[lines.length - 1];
  return candidate.length > 160 ? candidate.substring(0, 160) + '...' : candidate;
}

/**
 * Ham indirme hatasını sınıflandırır ve aktif dil sözlüğüne (t) göre anlaşılır mesaj döndürür.
 * @param {string} rawError
 * @param {Record<string, string>} [t={}]
 * @returns {{ code: string, shortLabel: string, hint: string, techSummary: string, fullTooltip: string }}
 */
export function classifyDownloadError(rawError, t = {}) {
  const raw = String(rawError || '').trim();
  const techSummary = extractTechnicalSummary(raw);

  // WARNING satırlarındaki "Skipping client ... since it does not support cookies" ifadelerini çerez hatası saymamak için
  // uyarı satırlarından arındırılmış metin:
  const nonWarningText = raw
    .split(/\r?\n/)
    .filter(line => !/^\s*WARNING:/i.test(line))
    .join('\n')
    .trim();

  let code = 'unknown';

  if (
    /Could not find platform independent libraries|No module named ['"]?encodings['"]?|Fatal Python error|Failed to import encodings module/i.test(raw)
  ) {
    code = 'python_broken';
  } else if (
    /is not recognized as an internal or external command.*python|spawn python.*ENOENT|python3?: command not found|No module named ['"]?yt_dlp['"]?/i.test(raw)
  ) {
    code = 'python_missing';
  } else if (
    /Disk dolu|\[PYI-\d+:ERROR\]\s*Failed to extract|decompression resulted in return code|No space left on device|ENOSPC|yeterli boş alan yok/i.test(raw)
  ) {
    code = 'disk_full';
  } else if (
    /yeler|üyeler|members-only|katıl|katil|join this channel|ayrıcalık|ayrcal/i.test(nonWarningText || raw)
  ) {
    code = 'members_only';
  } else if (
    /Could not copy (Chrome|Edge|Brave|Firefox) cookie database|oturum çerezleri okunamadı|çerez dosyası kilitli|sign in to confirm your age|cookies? are? (no longer valid|expired)|Could not find browser/i.test(raw) ||
    (/çerez|cookie/i.test(nonWarningText) && !/does not support cookies/i.test(nonWarningText))
  ) {
    code = 'cookies';
  } else if (
    /Error opening input files|Invalid data found when processing input|Conversion failed|Postprocessing:.*error|ffmpeg.*error/i.test(raw)
  ) {
    code = 'ffmpeg_merge';
  } else if (
    /Failed to resolve|getaddrinfo failed|incorrect header check|Error -3 while decompressing|Connection reset|timed out|ECONNRESET|ETIMEDOUT| Network is unreachable/i.test(raw)
  ) {
    code = 'network_stream';
  } else if (
    /\b(403|503|429)\b|Forbidden|Service Unavailable|Too Many Requests/i.test(nonWarningText || raw)
  ) {
    code = 'cdn_403';
  } else if (
    /private video|video unavailable|gizli video|silinmiş|kaldırılmış|has been removed|account associated with this video has been terminated/i.test(nonWarningText || raw)
  ) {
    code = 'private_removed';
  } else if (
    /canl[ıi]\s*(yay[ıi]n|etkinlik)|live stream|live event|waiting_live/i.test(nonWarningText || raw)
  ) {
    code = 'live_stream';
  } else if (
    /n challenge solving failed|addOnDisposeCallback|Only images are available|Requested format is not available/i.test(raw)
  ) {
    code = 'youtube_js_challenge';
  } else if (
    /bulunamadı|not found|No such file or directory/i.test(nonWarningText || raw)
  ) {
    code = 'file_not_found';
  }

  const defaults = {
    python_broken: {
      title: t.err_python_broken_title || 'Python Kurulum Hatası',
      hint: t.err_python_broken_hint || 'Sistemdeki Python kurulumu bozuk veya eksik. Python\'u onarın/yeniden kurun ya da Ayarlar\'dan yt-dlp çalışma modunu "exe" yapın.'
    },
    python_missing: {
      title: t.err_python_missing_title || 'Python / yt-dlp Modülü Eksik',
      hint: t.err_python_missing_hint || 'Python veya yt-dlp paketi bulunamadı. "pip install -U yt-dlp" çalıştırın ya da Ayarlar\'dan "exe" moduna geçin.'
    },
    disk_full: {
      title: t.err_disk_full_title || 'Temp / Disk Dolu',
      hint: t.err_disk_full_hint || 'Geçici (Temp) sürücüde yeterli boş alan yok veya yt-dlp bileşenleri çıkartılamadı. Temp klasörünü temizleyip tekrar deneyin.'
    },
    members_only: {
      title: t.err_members_only_title || t.card_members_only || 'Katıl / Üyelere Özel',
      hint: t.err_members_only_hint || 'Bu video kanala özel (Katıl) içeriktir. İndirmek için kanala üye olmalı ve Ayarlar\'dan Premium Çerez seçmelisiniz.'
    },
    cookies: {
      title: t.err_cookies_title || 'Oturum / Çerez Gerekli',
      hint: t.err_cookies_hint || 'YouTube oturum çerezleri geçersiz, süresi dolmuş veya tarayıcı tarafından kilitlenmiş. Ayarlar\'dan oturumu yenileyin.'
    },
    ffmpeg_merge: {
      title: t.err_ffmpeg_merge_title || 'Birleştirme (FFmpeg) Hatası',
      hint: t.err_ffmpeg_merge_hint || 'İndirilen video/ses akışları bozuk indi veya FFmpeg ile birleştirilemedi. Videoyu yeniden indirmeyi deneyin.'
    },
    network_stream: {
      title: t.err_network_stream_title || 'Bağlantı / Akış Hatası',
      hint: t.err_network_stream_hint || 'Sunucu bağlantısı koptu, DNS çözümlenemedi veya bozuk veri paketi alındı. İnternet bağlantınızı kontrol edip tekrar deneyin.'
    },
    cdn_403: {
      title: t.err_cdn_403_title || '403 CDN Kısıtı',
      hint: t.err_cdn_403_hint || 'YouTube CDN erişimi geçici olarak reddetti (HTTP 403/429/503). Çerezleri yenileyip veya kısa süre bekleyip tekrar deneyin.'
    },
    private_removed: {
      title: t.err_private_removed_title || 'Video Gizli / Silinmiş',
      hint: t.err_private_removed_hint || 'Bu video YouTube üzerinden kaldırılmış, gizliye alınmış veya bölge kısıtlamasına takılmış.'
    },
    live_stream: {
      title: t.err_live_stream_title || 'Canlı Yayın İşleniyor',
      hint: t.err_live_stream_hint || 'Canlı yayın henüz devam ediyor veya YouTube tarafından işleniyor. Tamamlandığında otomatik indirilecektir.'
    },
    youtube_js_challenge: {
      title: t.err_js_challenge_title || 'YouTube Player JS Hatası',
      hint: t.err_js_challenge_hint || 'YouTube player güncellemesi yt-dlp JS çözücüsünü kırdı. Kuyruk sekmesinden "YT Kurtarma" modunu "Otomatik" veya "TV Modu (Acil)" yapın ya da yt-dlp\'yi güncelleyin.'
    },
    file_not_found: {
      title: t.err_file_not_found_title || 'Dosya Bulunamadı',
      hint: t.err_file_not_found_hint || 'İndirilen ham medya dosyası diskte bulunamadı. Tekrar indirmeyi deneyin.'
    },
    unknown: {
      title: t.err_unknown_title || t.downloader_invalid_url || 'İndirme Hatası',
      hint: t.err_unknown_hint || 'İndirme işlemi beklenmeyen bir hata nedeniyle tamamlanamadı.'
    }
  };

  const selected = defaults[code] || defaults.unknown;
  const shortLabel = selected.title;
  const hint = selected.hint;

  let fullTooltip = hint;
  if (techSummary && techSummary !== hint && techSummary !== shortLabel) {
    fullTooltip = `${hint}\n\n[${t.err_technical_detail_label || 'Teknik Detay'}] ${techSummary}`;
  }

  return {
    code,
    shortLabel,
    hint,
    techSummary,
    fullTooltip
  };
}

if (typeof window !== 'undefined') {
  window.classifyDownloadError = classifyDownloadError;
}
