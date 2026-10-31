// Multimedia HaYTooL Chromium Extension Background Service Worker
chrome.runtime.onInstalled.addListener(() => {
  // Sağ tuş menüleri
  chrome.contextMenus.create({
    id: 'haytool-open-website',
    title: 'HaYTooL Resmi Web Sitesini Aç',
    contexts: ['action']
  });

  chrome.contextMenus.create({
    id: 'haytool-open-settings',
    title: 'Eklenti Ayarları (Port & Dil)',
    contexts: ['action']
  });
});

chrome.contextMenus.onClicked.addListener((info) => {
  if (info.menuItemId === 'haytool-open-website') {
    chrome.tabs.create({ url: 'https://haytokoraz.github.io/haytool-youtube-download/' });
  } else if (info.menuItemId === 'haytool-open-settings') {
    chrome.runtime.openOptionsPage();
  }
});
