/**
 * HaYTooL YT Downloader - Active DNS Lookup Module
 * public/modules/dnsLookup.js
 */

import { showToast } from '../components/toast.js';

let _lastDnsInfo = null;

/**
 * Backend üzerinden kullanıcının aktif DNS çözümleyicisini ve yerel ağ DNS IP'lerini çeker.
 * @returns {Promise<void>}
 */
export async function detectActiveDns() {
  const loadingEl = document.getElementById('dns-loading');
  const errorEl = document.getElementById('dns-error');
  const errorText = document.getElementById('dns-error-text');
  const resultsEl = document.getElementById('dns-results');
  const providerNameEl = document.getElementById('dns-provider-name');
  const resolverIpEl = document.getElementById('dns-resolver-ip');
  const resolverGeoEl = document.getElementById('dns-resolver-geo');
  const localServersEl = document.getElementById('dns-local-servers');
  const clientIpEl = document.getElementById('dns-client-ip');

  if (loadingEl) loadingEl.classList.remove('hidden');
  if (errorEl) errorEl.classList.add('hidden');
  if (resultsEl) resultsEl.classList.add('hidden');

  try {
    const res = await fetch('/api/system-dns');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    _lastDnsInfo = data;

    if (loadingEl) loadingEl.classList.add('hidden');

    if (providerNameEl) providerNameEl.textContent = data.provider || 'Bilinmeyen DNS Sağlayıcısı';
    if (resolverIpEl) resolverIpEl.textContent = data.resolverIp ? `${data.resolverIp} ${data.resolverHost && data.resolverHost !== '-' ? '(' + data.resolverHost + ')' : ''}` : '--';
    if (resolverGeoEl) resolverGeoEl.textContent = data.resolverGeo || '--';
    if (localServersEl) {
      localServersEl.textContent = (data.localServers && data.localServers.length > 0)
        ? data.localServers.join(', ')
        : 'Varsayılan Sistem Gateway';
    }
    if (clientIpEl) clientIpEl.textContent = data.clientIp || '--';

    if (resultsEl) resultsEl.classList.remove('hidden');
    try { if (typeof window.lucide !== 'undefined') window.lucide.createIcons(); } catch (e) {}
  } catch (err) {
    if (loadingEl) loadingEl.classList.add('hidden');
    if (errorEl) errorEl.classList.remove('hidden');
    if (errorText) errorText.textContent = `DNS sunucusu analiz edilemedi: ${err.message}`;
    console.error('[HaYTooL System DNS]', err);
  }
}

/**
 * Aktif DNS Sunucusu modalını açar ve analiz sorgusunu başlatır.
 * @returns {void}
 */
export function openDnsLookupModal() {
  const modal = document.getElementById('dns-lookup-modal');
  if (modal) {
    modal.classList.remove('hidden');
    try { if (typeof window.lucide !== 'undefined') window.lucide.createIcons(); } catch (e) {}
    
    // Araçlar dropdown'ı kapat
    const toolsDropdown = document.getElementById('tools-dropdown');
    if (toolsDropdown) toolsDropdown.classList.remove('active');

    // Otomatik olarak aktif DNS sunucusunu tara ve göster
    detectActiveDns();
  }
}

/**
 * Aktif DNS Sunucusu modalını kapatır.
 * @returns {void}
 */
export function closeDnsLookupModal() {
  const modal = document.getElementById('dns-lookup-modal');
  if (modal) modal.classList.add('hidden');
}

/**
 * Tespit edilen DNS bilgilerini panoya metin olarak kopyalar.
 * @returns {void}
 */
export function copyDnsInfo() {
  if (!_lastDnsInfo) {
    showToast('Kopyalanacak DNS bilgisi bulunamadı', 'warning');
    return;
  }
  const text = [
    `Sağlayıcı: ${_lastDnsInfo.provider}`,
    `Çözümleyici IP: ${_lastDnsInfo.resolverIp}`,
    `Host: ${_lastDnsInfo.resolverHost}`,
    `Konum/ASN: ${_lastDnsInfo.resolverGeo}`,
    `Sistem DNS: ${(_lastDnsInfo.localServers || []).join(', ')}`,
    `İstemci Dış IP: ${_lastDnsInfo.clientIp}`
  ].join('\n');

  navigator.clipboard.writeText(text).then(() => {
    showToast('DNS bilgileri panoya kopyalandı', 'success');
  }).catch(() => {
    showToast('Panoya kopyalama başarısız oldu', 'error');
  });
}

/**
 * DNS modülü olay dinleyicilerini başlatır.
 */
export function initDnsLookupEvents() {
  document.addEventListener('click', (e) => {
    const modal = document.getElementById('dns-lookup-modal');
    if (modal && !modal.classList.contains('hidden')) {
      if (e.target === modal) closeDnsLookupModal();
    }
  });
}

// Global window bindings for inline HTML attribute callers
window.detectActiveDns = detectActiveDns;
window.openDnsLookupModal = openDnsLookupModal;
window.closeDnsLookupModal = closeDnsLookupModal;
window.copyDnsInfo = copyDnsInfo;
