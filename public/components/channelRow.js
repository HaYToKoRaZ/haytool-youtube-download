// Türkçe Açıklama: Takip edilen YouTube kanallarını 9'lu modern kart (card) düzeninde ve A-Z alfabetik indeksleme ile listeleyen UI bileşeni.

import { escapeHtml } from '../utils/helpers.js';
import { youtubeSvgIcon } from './videoCard.js';

const ALPHABET = 'A B C Ç D E F G H I İ J K L M N O Ö P R S Ş T U Ü V Y Z'.split(' ');

/**
 * Takip edilen kanal listesini hedef DOM elemanı içerisine modern grid ve A-Z rehberi ile render eder.
 * 
 * @param {HTMLElement} channelsList Hedef liste DOM elemanı (channels-list)
 * @param {Array<object>} channels Takip edilen kanalların veri dizisi
 * @param {object} translations Türkçe/İngilizce dil çeviri nesnesi
 * @returns {void}
 */
export function renderChannelsList(channelsList, channels, translations) {
  if (!channelsList) return;
  channelsList.innerHTML = '';

  const t = translations || {};

  if (channels.length === 0) {
    channelsList.innerHTML = `
      <div class="channels-empty-state">
        <div class="channels-empty-icon">
          <i data-lucide="tv-2"></i>
        </div>
        <h3>${t.channels_grid_empty || 'Henüz takip edilen kanal yok'}</h3>
        <p>${t.empty_channels_desc || 'Yukarıdaki formdan YouTube kanal linki veya kullanıcı adı girerek kanal ekleyebilirsiniz.'}</p>
      </div>
    `;
    return;
  }

  // Kanalları alfabetik olarak sırala
  const sortedChannels = [...channels].sort((a, b) => 
    (a.name || '').localeCompare(b.name || '', 'tr', { sensitivity: 'base' })
  );

  // Harf grupları oluştur
  const groups = {};
  sortedChannels.forEach(channel => {
    const firstChar = (channel.name || 'Y').charAt(0).toUpperCase('tr');
    let groupLetter = 'Y'; // varsayılan fallback
    
    // Alfabedeki uygun harfi bul
    const matchedLetter = ALPHABET.find(l => l === firstChar || l.localeCompare(firstChar, 'tr', { sensitivity: 'base' }) === 0);
    if (matchedLetter) {
      groupLetter = matchedLetter;
    } else {
      groupLetter = firstChar.match(/[A-ZÇĞİÖŞÜ]/i) ? firstChar : '#';
    }

    if (!groups[groupLetter]) {
      groups[groupLetter] = [];
    }
    groups[groupLetter].push(channel);
  });

  // Ana layout yapısını oluştur
  const layout = document.createElement('div');
  layout.className = 'channels-layout-container';

  const mainContent = document.createElement('div');
  mainContent.className = 'channels-main-content';
  layout.appendChild(mainContent);

  // Harf şeridi (Sidebar) container
  const sidebar = document.createElement('div');
  sidebar.className = 'channels-alpha-sidebar';
  sidebar.id = 'channels-alpha-nav';
  layout.appendChild(sidebar);

  // Hangi harflerde kanal olduğunu bul
  const activeLetters = Object.keys(groups);

  // A-Z sidebar'ı oluştur
  const fullAlphabet = [...ALPHABET];
  if (activeLetters.includes('#')) {
    fullAlphabet.push('#');
  }

  fullAlphabet.forEach(letter => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'alpha-letter';
    btn.textContent = letter;

    const hasChannels = activeLetters.includes(letter);
    if (hasChannels) {
      btn.classList.add('has-content');
      btn.addEventListener('click', () => {
        // Aktif butonu güncelle
        sidebar.querySelectorAll('.alpha-letter').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        // Hedef harf grubuna kaydır
        const targetSection = document.getElementById(`group-${letter}`);
        if (targetSection) {
          targetSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      });
    } else {
      btn.style.opacity = '0.25';
      btn.style.cursor = 'default';
      btn.disabled = true;
    }
    sidebar.appendChild(btn);
  });

  // Her harf grubunu render et
  const sortedLetters = Object.keys(groups).sort((a, b) => {
    if (a === '#') return 1;
    if (b === '#') return -1;
    return a.localeCompare(b, 'tr', { sensitivity: 'base' });
  });

  sortedLetters.forEach(letter => {
    const groupSection = document.createElement('div');
    groupSection.className = 'channel-group-section';
    groupSection.id = `group-${letter}`;

    const header = document.createElement('h3');
    header.className = 'channel-group-header';
    header.innerHTML = `<span>${letter}</span>`;
    groupSection.appendChild(header);

    const grid = document.createElement('div');
    grid.className = 'channels-grid-container';

    groups[letter].forEach(channel => {
      const channelInitial = (channel.name || 'Y').split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
      const channelUrl = channel.handle 
        ? (channel.handle.startsWith('http') ? channel.handle : `https://www.youtube.com/${channel.handle.startsWith('@') ? channel.handle : '@' + channel.handle}`)
        : `https://www.youtube.com/channel/${channel.id}`;

      let displayHandle = channel.handle || '';
      if (displayHandle.includes('youtube.com/')) {
        displayHandle = displayHandle.substring(displayHandle.lastIndexOf('/') + 1);
      }
      if (displayHandle && !displayHandle.startsWith('@') && !displayHandle.startsWith('UC')) {
        displayHandle = '@' + displayHandle;
      }

      const avatarImgId = `ch-avatar-${channel.id}`;

      const card = document.createElement('div');
      card.className = 'channel-card';

      card.innerHTML = `
        <div class="channel-card-avatar-wrap">
          <img 
            id="${avatarImgId}"
            class="channel-card-avatar-img"
            src="/api/channels/${channel.id}/avatar"
            alt="${escapeHtml(channel.name)}"
            onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';"
          />
          <div class="channel-card-avatar-fallback" style="display:none;">${channelInitial}</div>
        </div>

        <a class="channel-card-name" href="${channelUrl}" target="_blank" rel="noopener noreferrer" title="${escapeHtml(channel.name)} (YouTube'da Aç)">
          ${escapeHtml(channel.name)}
        </a>
        <div class="channel-card-handle" style="display: flex; align-items: center; flex-wrap: wrap; gap: 6px;">
          <span>${escapeHtml(displayHandle)}</span>
          <span id="ch-subs-badge-${channel.id}" class="channel-card-subscribers" style="font-size: 0.72rem; color: var(--accent-primary); background: rgba(168, 85, 247, 0.08); padding: 1px 6px; border-radius: 10px; font-weight: 600; border: 1px solid rgba(168, 85, 247, 0.15); display: inline-flex; align-items: center; vertical-align: middle; gap: 2px;">
            <i data-lucide="users" style="width:10px; height:10px;"></i>
            <span class="subs-count-val">${escapeHtml(channel.subscriberCount || '?')}</span>
          </span>
        </div>

        <div class="channel-card-settings">
          <!-- İndirme Kalitesi -->
          <select onchange="changeChannelQuality('${channel.id}', this.value)" class="channel-card-select" title="${t.channel_quality_title || 'İndirme Kalitesi'}">
            <option value="default" ${(!channel.quality || channel.quality === 'default') ? 'selected' : ''}>${t.select_quality_default || 'Varsayılan Kalite'}</option>
            <option value="best" ${channel.quality === 'best' ? 'selected' : ''}>${t.select_quality_best || 'En Yüksek'}</option>
            <option value="1080p" ${channel.quality === '1080p' ? 'selected' : ''}>${t.select_quality_1080p || '1080p FHD'}</option>
            <option value="720p" ${channel.quality === '720p' ? 'selected' : ''}>${t.select_quality_720p || '720p HD'}</option>
          </select>

          <!-- Otomatik İndirme -->
          <select onchange="changeChannelAutoDownload('${channel.id}', this.value)" class="channel-card-select" title="${t.select_auto_download_title || 'Otomatik İndirme Durumu'}">
            <option value="true" ${channel.autoDownload !== false ? 'selected' : ''}>${t.select_auto_download_true || 'Otomatik İndir'}</option>
            <option value="false" ${channel.autoDownload === false ? 'selected' : ''}>${t.select_auto_download_false || 'Otomatik İndirme'}</option>
          </select>

          <!-- Shorts İndir -->
          <select onchange="changeChannelShorts('${channel.id}', this.value)" class="channel-card-select" title="${t.channel_shorts_title || 'Shorts İndirme Durumu'}">
            <option value="true" ${channel.downloadShorts !== false ? 'selected' : ''}>${t.select_shorts_true || 'Shorts İndir'}</option>
            <option value="false" ${channel.downloadShorts === false ? 'selected' : ''}>${t.select_shorts_false || 'Shorts İndirme'}</option>
          </select>

          <!-- Shorts Süre Sınırı -->
          <select onchange="changeChannelShortsLimit('${channel.id}', this.value)" class="channel-card-select" title="${t.channel_shorts_limit_title || 'Shorts Süre Sınırı'}">
            <option value="30" ${channel.shortsDurationLimit == 30 ? 'selected' : ''}>Shorts &lt; 30${t.shorts_limit_seconds || 'sn'}</option>
            <option value="60" ${channel.shortsDurationLimit == 60 ? 'selected' : ''}>Shorts &lt; 60${t.shorts_limit_seconds || 'sn'} (1 ${t.shorts_limit_minutes || 'dk'})</option>
            <option value="120" ${channel.shortsDurationLimit == 120 ? 'selected' : ''}>Shorts &lt; 120${t.shorts_limit_seconds || 'sn'} (2 ${t.shorts_limit_minutes || 'dk'})</option>
            <option value="180" ${(!channel.shortsDurationLimit || channel.shortsDurationLimit == 180) ? 'selected' : ''}>Shorts &lt; 180${t.shorts_limit_seconds || 'sn'} (3 ${t.shorts_limit_minutes || 'dk'})</option>
            <option value="240" ${channel.shortsDurationLimit == 240 ? 'selected' : ''}>Shorts &lt; 240${t.shorts_limit_seconds || 'sn'} (4 ${t.shorts_limit_minutes || 'dk'})</option>
            <option value="300" ${channel.shortsDurationLimit == 300 ? 'selected' : ''}>Shorts &lt; 300${t.shorts_limit_seconds || 'sn'} (5 ${t.shorts_limit_minutes || 'dk'})</option>
            <option value="600" ${channel.shortsDurationLimit == 600 ? 'selected' : ''}>Shorts &lt; 600${t.shorts_limit_seconds || 'sn'} (10 ${t.shorts_limit_minutes || 'dk'})</option>
            <option value="900" ${channel.shortsDurationLimit == 900 ? 'selected' : ''}>Shorts &lt; 15 ${t.shorts_limit_minutes || 'dk'}</option>
            <option value="1200" ${channel.shortsDurationLimit == 1200 ? 'selected' : ''}>Shorts &lt; 20 ${t.shorts_limit_minutes || 'dk'}</option>
            <option value="1800" ${channel.shortsDurationLimit == 1800 ? 'selected' : ''}>Shorts &lt; 30 ${t.shorts_limit_minutes || 'dk'}</option>
            <option value="2700" ${channel.shortsDurationLimit == 2700 ? 'selected' : ''}>Shorts &lt; 45 ${t.shorts_limit_minutes || 'dk'}</option>
            <option value="3600" ${channel.shortsDurationLimit == 3600 ? 'selected' : ''}>Shorts &lt; 1 ${t.shorts_limit_hours || 'sa'}</option>
            <option value="5400" ${channel.shortsDurationLimit == 5400 ? 'selected' : ''}>Shorts &lt; 1.5 ${t.shorts_limit_hours || 'sa'} (1:30 ${t.shorts_limit_hours || 'sa'})</option>
          </select>
        </div>

        <div class="channel-card-actions">
          <button class="btn-icon channel-rss-update-btn" onclick="syncSingleChannelRss('${channel.id}')" title="${t.channel_btn_sync_title || 'Kanalı Şimdi Denetle / RSS Güncelle'}">
            <i data-lucide="refresh-cw" style="width: 14px; height: 14px; color:#a855f7;"></i>
          </button>
          <button class="btn-icon channel-logo-update-btn" onclick="updateChannelAvatar('${channel.id}')" title="${t.channel_btn_update_logo_title || 'Logoyu Güncelle'}">
            <i data-lucide="image" style="width: 14px; height: 14px; color:#38bdf8;"></i>
          </button>
          <button class="btn-icon channel-subs-update-btn" onclick="updateChannelSubscribers('${channel.id}')" title="${t.channel_btn_update_subscribers_title || 'Abone Sayısını Güncelle'}">
            <i data-lucide="users" style="width: 14px; height: 14px; color:#10b981;"></i>
          </button>
          <a href="${channelUrl}" target="_blank" rel="noopener noreferrer" class="btn-icon channel-open-btn" title="${t.inline_btn_youtube || 'YouTube\'da Aç'}">
            ${youtubeSvgIcon}
          </a>
          <button class="btn-icon channel-delete-btn" onclick="deleteChannel('${channel.id}')" title="${t.channel_btn_unfollow_title || 'Takipten Çıkar'}">
            <i data-lucide="trash-2" style="width: 14px; height: 14px;"></i>
          </button>
        </div>
      `;

      grid.appendChild(card);
    });

    groupSection.appendChild(grid);
    mainContent.appendChild(groupSection);
  });

  channelsList.appendChild(layout);

  try {
    lucide.createIcons();
  } catch (e) {
    // Kasıtlı sessiz
  }
}

