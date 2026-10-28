// Türkçe Açıklama: Sunucu tarafındaki olayları (SSE) bağlı olan tüm tarayıcılara ileten ve terminal günlüklerini yöneten yayın modülü.
export let clients = [];
export let terminalLogs = [];
const MAX_LOGS = 300;

// ─── Ham konsol akışı (tray konsoluyla aynı içerik) ───
// Node sürecinin stdout/stderr'ine yazılan HER satır burada tutulur ve SSE ile
// 'terminal_raw' olayı olarak yayınlanır. Canlı konsoldaki "Ham Çıktı" modu bunu kullanır.
export let rawLogs = [];
const MAX_RAW_LOGS = 2000;
let consoleBridgeAttached = false;
let rawBudget = 40; // saniyede en fazla 40 satır
let lastBudgetReset = Date.now();
let droppedSinceReset = 0;

/**
 * console.log/warn/error çıktılarını yakalayıp ham tampona ve SSE'ye aktarır.
 * Tray menüsündeki "Konsol Çıktısını Göster" penceresiyle aynı kaynağı besler.
 */
export function attachConsoleBridge() {
  if (consoleBridgeAttached) return;
  consoleBridgeAttached = true;

  const wrap = (level, original) => function (...args) {
    try {
      original.apply(console, args);
    } catch (e) {}
    try {
      const message = args.map(a => (typeof a === 'string' ? a : (() => {
        try { return JSON.stringify(a); } catch (e) { return String(a); }
      })())).join(' ');
      pushRawLog(level, message);
    } catch (e) {}
  };

  console.log = wrap('log', console.log);
  console.info = wrap('info', console.info);
  console.warn = wrap('warn', console.warn);
  console.error = wrap('error', console.error);
  console.debug = wrap('debug', console.debug);
}

function pushRawLog(level, message) {
  const trimmed = String(message == null ? '' : message).replace(/\r$/, '');
  if (!trimmed.trim()) return;

  const now = Date.now();
  if (now - lastBudgetReset > 1000) {
    lastBudgetReset = now;
    rawBudget = 40;
    droppedSinceReset = 0;
  }
  if (rawBudget <= 0) { droppedSinceReset++; return; }
  rawBudget--;

  const item = { timestamp: new Date().toISOString(), type: level, message: trimmed, raw: true };
  rawLogs.push(item);
  if (rawLogs.length > MAX_RAW_LOGS) rawLogs.shift();

  // Taşan satırlar için tek bir özet satırı bırak
  if (droppedSinceReset === 1) {
    const notice = { timestamp: new Date().toISOString(), type: 'warn', message: '... ham çıktı hız sınırı: bazı satırlar atlandı ...', raw: true };
    rawLogs.push(notice);
    if (rawLogs.length > MAX_RAW_LOGS) rawLogs.shift();
    broadcast('terminal_raw', notice);
  }
  broadcast('terminal_raw', item);
}


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
  broadcast('terminal_log', logItem);
}
