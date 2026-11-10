// Multimedia HaYTooL Chromium Extension Background Service Worker
let BACKEND_PORT = 4141;

async function getBackendUrl() {
  try {
    if (chrome.storage && chrome.storage.sync) {
      const data = await chrome.storage.sync.get(['haytoolPort']);
      if (data && data.haytoolPort) {
        BACKEND_PORT = parseInt(data.haytoolPort, 10) || 4141;
      }
    }
  } catch {}
  return `http://127.0.0.1:${BACKEND_PORT}`;
}

async function sendUrlToWebStream(url) {
  const backendUrl = await getBackendUrl();
  try {
    await fetch(`${backendUrl}/api/tools/open-web-stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: url || '' })
    });
  } catch (err) {
    console.error('[HaYTooL Extension] Gönderim hatası:', err);
  }
}

function setupContextMenus() {
  chrome.contextMenus.removeAll(() => {
    // 1. Sayfa veya Linki Doğrudan HaYTooL Web İzle'ye Gönder
    chrome.contextMenus.create({
      id: 'haytool-send-webstream',
      title: '📺 HaYTooL Web İzle\'ye Gönder',
      contexts: ['page', 'link', 'video', 'selection']
    });

    // 2. YouTube Ana Sayfası (Eklenti simgesi sağ tık)
    chrome.contextMenus.create({
      id: 'haytool-open-youtube',
      title: '▶️ YouTube Ana Sayfasını Aç',
      contexts: ['action']
    });

    // 3. HaYTooL Web İzle Sekmesini Aç (Eklenti simgesi sağ tık)
    chrome.contextMenus.create({
      id: 'haytool-open-webstream-tab',
      title: '📺 Web İzle Sekmesini Aç',
      contexts: ['action']
    });

    // 4. HaYTooL Resmi Web Sitesi
    chrome.contextMenus.create({
      id: 'haytool-open-website',
      title: '🌐 HaYTooL Resmi Web Sitesini Aç',
      contexts: ['action']
    });

    // 5. Eklenti Ayarları
    chrome.contextMenus.create({
      id: 'haytool-open-settings',
      title: '⚙️ Eklenti Ayarları (Port & Dil)',
      contexts: ['action']
    });
  });
}

chrome.runtime.onInstalled.addListener(() => {
  setupContextMenus();
});

chrome.runtime.onStartup.addListener(() => {
  setupContextMenus();
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === 'haytool-send-webstream') {
    let targetUrl = info.linkUrl || info.srcUrl;
    if (!targetUrl && info.selectionText && info.selectionText.trim().startsWith('http')) {
      targetUrl = info.selectionText.trim();
    }
    if (!targetUrl) {
      targetUrl = info.pageUrl || (tab && tab.url);
    }
    if (targetUrl) {
      sendUrlToWebStream(targetUrl);
    }
  } else if (info.menuItemId === 'haytool-open-webstream-tab') {
    sendUrlToWebStream('');
  } else if (info.menuItemId === 'haytool-open-youtube') {
    chrome.tabs.create({ url: 'https://www.youtube.com' });
  } else if (info.menuItemId === 'haytool-open-website') {
    chrome.tabs.create({ url: 'https://haytokoraz.github.io/haytool-youtube-download/' });
  } else if (info.menuItemId === 'haytool-open-settings') {
    chrome.runtime.openOptionsPage();
  }
});
