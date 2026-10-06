/**
 * HaYTooL YouTube Downloader - Hava Durumu Modülü (Weather Service)
 * 
 * Yapımcı: HaYTo
 * Sorumluluklar:
 * - Üst paneldeki hava durumu rozetini ve popover kartını güncelleme
 * - Popover açma/kapama, dış tıklama ve çift tıklamada yenileme olayları
 */

import { showToast } from '../components/toast.js';

/**
 * Hava durumu bilgilerini /api/weather üzerinden sorgular, üst bardaki rozete ve popover kartına yansıtır.
 * 
 * @param {boolean} [force=false] Önbelleği atlayarak taze veri isteği
 * @returns {Promise<void>}
 */
export async function updateWeatherBadge(force = false) {
  const badge = document.getElementById('badge-weather');
  const display = document.getElementById('weather-display');
  const iconEl = document.getElementById('weather-icon');
  const cityLabel = document.getElementById('weather-city-display');
  if (!badge || !display) return;

  const localDb = window.localDb || {};
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
      
      // Badge üzerinde şehir adı göster (max 12 karakter)
      if (cityLabel && data.city) {
        const shortCity = data.city.length > 12 ? data.city.substring(0, 11) + '…' : data.city;
        cityLabel.textContent = shortCity;
      }
      
      if (iconEl) {
        iconEl.setAttribute('data-lucide', data.icon || 'sun');
        if (typeof lucide !== 'undefined' && lucide.createIcons) {
          lucide.createIcons();
        }
      }

      const langKey = data.descKey || 'weather_partly_cloudy';
      const t = (typeof i18n !== 'undefined' && i18n.t) ? i18n.t.bind(i18n) : null;
      const desc = t ? t(langKey) : data.defaultDesc;
      const feelsLikeLabel = t ? t('weather_feels_like') : 'Hissedilen';
      const humidityLabel = t ? t('weather_humidity') : 'Nem';
      const windLabel = t ? t('weather_wind') : 'Rüzgar';
      const precipLabel = t ? t('weather_precipitation') : 'Yağış İhtimali';
      const refreshLabel = t ? t('weather_click_refresh') : 'Çift tıklayarak yenileyin';
      const precipProb = data.precipitationProbability !== undefined ? data.precipitationProbability : 0;

      // Üst bardaki doğrudan yağış ihtimali rozetini güncelle
      const badgePrecipVal = document.getElementById('weather-precip-val');
      const badgePrecipWrapper = document.getElementById('weather-precip-badge');
      if (badgePrecipVal) {
        badgePrecipVal.textContent = `%${precipProb}`;
      }
      if (badgePrecipWrapper) {
        badgePrecipWrapper.title = `${precipLabel}: %${precipProb}`;
      }

      badge.title = `${data.city}: ${desc} (${data.temp}${data.unit}, ${precipLabel}: %${precipProb})`;

      // Ayarlar sekmesindeki ipucu metnini güncelle
      const usageTipEl = document.getElementById('desc-weather-usage-tip');
      if (usageTipEl && t && t('weather_usage_tip')) {
        usageTipEl.innerHTML = t('weather_usage_tip');
      }

      // Popover kartını güncelle
      const popTemp = document.getElementById('weather-popover-temp');
      const popDesc = document.getElementById('weather-popover-desc');
      const popCity = document.getElementById('weather-popover-city');
      const popFeels = document.getElementById('weather-popover-feels');
      const popHumidity = document.getElementById('weather-popover-humidity');
      const popWind = document.getElementById('weather-popover-wind');
      const popPrecip = document.getElementById('weather-popover-precip');
      const popFeelsLabel = document.getElementById('weather-popover-feels-label');
      const popHumidityLabel = document.getElementById('weather-popover-humidity-label');
      const popWindLabel = document.getElementById('weather-popover-wind-label');
      const popPrecipLabel = document.getElementById('weather-popover-precip-label');
      const popRefreshText = document.getElementById('weather-popover-refresh-text');
      const popIcon = document.getElementById('weather-popover-icon');

      if (popTemp) popTemp.textContent = `${data.temp}${data.unit}`;
      if (popDesc) popDesc.textContent = desc;
      if (popCity) popCity.textContent = data.city || '--';
      if (popFeels) popFeels.textContent = `${data.feelsLike}${data.unit}`;
      if (popHumidity) popHumidity.textContent = `%${data.humidity}`;
      if (popWind) popWind.textContent = `${data.windSpeed} km/s`;
      if (popPrecip) popPrecip.textContent = `%${precipProb}`;
      if (popFeelsLabel) popFeelsLabel.textContent = feelsLikeLabel;
      if (popHumidityLabel) popHumidityLabel.textContent = humidityLabel;
      if (popWindLabel) popWindLabel.textContent = windLabel;
      if (popPrecipLabel) popPrecipLabel.textContent = precipLabel;
      if (popRefreshText) popRefreshText.textContent = refreshLabel;
      if (popIcon) {
        popIcon.setAttribute('data-lucide', data.icon || 'sun');
      }

      // İkonları render et
      if (typeof lucide !== 'undefined' && lucide.createIcons) {
        lucide.createIcons();
      }

      // Popover olay dinleyicilerini garantiye al
      initWeatherPopoverEvents();
    } else if (data.enabled === false) {
      badge.style.display = 'none';
    } else {
      display.textContent = '--°';
    }
  } catch (err) {
    display.textContent = '--°';
  }
}

/**
 * Hava durumu rozeti tıklama ve popover aç/kapa/yenile mantığını kurar.
 */
export function initWeatherPopoverEvents() {
  const badgeWeather = document.getElementById('badge-weather');
  const weatherPopover = document.getElementById('weather-popover');

  if (!badgeWeather || !weatherPopover) return;
  if (badgeWeather._popoverInitialized) return;
  badgeWeather._popoverInitialized = true;

  // Sol tık: popover aç/kapa
  badgeWeather.addEventListener('click', (e) => {
    if (weatherPopover.contains(e.target)) return;

    e.stopPropagation();
    const isActive = weatherPopover.classList.contains('active');
    if (isActive) {
      weatherPopover.classList.remove('active');
    } else {
      weatherPopover.classList.add('active');
      if (typeof lucide !== 'undefined' && lucide.createIcons) {
        lucide.createIcons();
      }
    }
  });

  // Popover içi tıklama: yayılmayı durdur
  weatherPopover.addEventListener('click', (e) => {
    e.stopPropagation();
  });

  // Dışarı tıklayınca popover'ı kapat
  document.addEventListener('click', (e) => {
    if (!badgeWeather.contains(e.target)) {
      weatherPopover.classList.remove('active');
    }
  });

  // Çift tıklama: veriyi yenile
  badgeWeather.addEventListener('dblclick', async (e) => {
    e.stopPropagation();
    showToast('Hava durumu güncelleniyor...', 'info');
    await updateWeatherBadge(true);
    showToast('Hava durumu güncellendi.', 'success');
  });
}

// Global window erişimi
if (typeof window !== 'undefined') {
  window.updateWeatherBadge = updateWeatherBadge;
  window.initWeatherPopoverEvents = initWeatherPopoverEvents;
}

if (typeof document !== 'undefined' && document.readyState !== 'loading') {
  initWeatherPopoverEvents();
}
