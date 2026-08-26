// Türkçe Açıklama: Sunucu tarafındaki olayları (SSE) bağlı olan tüm tarayıcılara ileten ve terminal günlüklerini yöneten yayın modülü.
export let clients = [];
export let terminalLogs = [];
const MAX_LOGS = 300;

export function addClient(client) {
  clients.push(client);
}

export function removeClient(client) {
  clients = clients.filter(c => c !== client);
}

/**
 * Sunucu tarafındaki olayları (SSE) bağlı olan tüm istemci tarayıcılara iletir.
 * 
 * @param {string} event Olay ismi (Örn: 'db_update', 'progress')
 * @param {*} data Gönderilecek olay verisi
 */
export function broadcast(event, data) {
  let dataToSend = data;
  clients.forEach(client => {
    try {
      client.write(`event: ${event}\ndata: ${JSON.stringify(dataToSend)}\n\n`);
    } catch (e) {
      // Hatalı/kopmuş bağlantıları sessizce yut
    }
  });
}

/**
 * Tek bir geçmiş kaydının güncellendiğini hedefli olarak bildirir (tüm veritabanı yerine).
 * 
 * @param {string} id - YouTube Video ID
 * @param {object} updates - Güncellenen alanlar
 */
export function broadcastHistoryUpdate(id, updates) {
  const payload = { id, updates };
  clients.forEach(client => {
    try {
      client.write(`event: history_updated\ndata: ${JSON.stringify(payload)}\n\n`);
    } catch (e) {
      // Hatalı/kopmuş bağlantıları sessizce yut
    }
  });
}

/**
 * Terminal çıktılarını in-memory log buffer'ına ekler ve istemciye anlık yayınlar.
 * 
 * @param {string} message Günlük mesajı
 * @param {string} type Günlük kategorisi ('info', 'success', 'warning', 'error')
 */
export function addTerminalLog(message, type = 'info') {
  const trimmed = message.trim();
  if (!trimmed) return;

  // Process stdout'a yazarak Tray "Konsol Çıktısını Göster" penceresine iletilmesini sağla
  console.log(`[${type.toUpperCase()}] ${trimmed}`);
  
  const timestamp = new Date().toISOString();
  const logItem = { timestamp, message: trimmed, type };
  terminalLogs.push(logItem);
  if (terminalLogs.length > MAX_LOGS) {
    terminalLogs.shift();
  }
  // Not: terminal_log SSE broadcast'i hiçbir istemcide dinlenmediği için kaldırıldı.
  // Log geçmişi GET /api/... endpoint'i üzerinden servis edilir; tray konsolu stdout'u gösterir.
}
