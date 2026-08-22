// Türkçe Açıklama: Windows Named Pipe IPC üzerinden yerel Discord istemcisine durum (Rich Presence) bildirimleri gönderen hafif istemci sınıfı.
import os from 'os';
import net from 'net';
import { readDb } from '../database.js';

export class DiscordRPC {
  /**
   * @param {string} clientId - Discord Developer portalından alınan uygulama kimliği
   */
  constructor(clientId) {
    this.clientId = clientId;
    this.client = null;
    this.connected = false;
    this.reconnectTimeout = null;
    this.currentActivity = null;
  }

  /**
   * Türkçe Açıklama: Discord Named Pipe kanalına bağlanır ve olay dinleyicilerini kurar.
   * 
   * @returns {void}
   */
  connect() {
    if (this.connected || this.client) return;
    if (os.platform() !== 'win32') return;

    const pipeName = '\\\\.\\pipe\\discord-ipc-0';
    this.client = net.createConnection(pipeName);

    this.client.on('connect', () => {
      this.connected = true;
      this.sendHandshake();
      if (this.currentActivity) {
        this.updateActivity(this.currentActivity.title, this.currentActivity.channelName);
      }
    });

    this.client.on('data', (data) => {
      // Yanıtlar sessizce geçilir
    });

    this.client.on('error', (err) => {
      this.cleanup();
    });

    this.client.on('close', () => {
      this.cleanup();
      this.scheduleReconnect();
    });
  }

  /**
   * Türkçe Açıklama: Named Pipe bağlantısını sıfırlar ve kaynakları temizler.
   * 
   * @returns {void}
   */
  cleanup() {
    this.connected = false;
    if (this.client) {
      this.client.destroy();
      this.client = null;
    }
  }

  /**
   * Türkçe Açıklama: Bağlantı koptuğunda belirli aralıklarla yeniden bağlanma zamanlayıcısı kurar.
   * 
   * @returns {void}
   */
  scheduleReconnect() {
    const db = readDb();
    if (!db || db.settings.discordRpcEnabled === false) return;

    if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);
    this.reconnectTimeout = setTimeout(() => {
      this.connect();
    }, 15000);
  }

  /**
   * Türkçe Açıklama: Discord istemcisine Named Pipe el sıkışma paketini gönderir.
   * 
   * @returns {void}
   */
  sendHandshake() {
    const payload = JSON.stringify({ v: 1, client_id: this.clientId });
    this.send(0, payload);
  }

  /**
   * Türkçe Açıklama: Named Pipe bağlantısına veri paketi yazar.
   * 
   * @param {number} op - İşlem kodu (opcode)
   * @param {string} payload - Gönderilecek JSON paket verisi
   * @returns {void}
   */
  send(op, payload) {
    if (!this.connected || !this.client) return;

    try {
      const payloadBuffer = Buffer.from(payload, 'utf8');
      const headerBuffer = Buffer.alloc(8);
      headerBuffer.writeInt32LE(op, 0);
      headerBuffer.writeInt32LE(payloadBuffer.length, 4);
      this.client.write(Buffer.concat([headerBuffer, payloadBuffer]));
    } catch (e) {
      console.error('[Discord RPC] Gönderim hatası:', e.message);
    }
  }

  /**
   * Türkçe Açıklama: Oynatılan videonun bilgilerini belleğe kaydeder ve durum güncellemesini tetikler.
   * 
   * @param {string|null} title - Video başlığı
   * @param {string|null} channelName - YouTube kanal adı
   * @returns {void}
   */
  setActivity(title, channelName) {
    this.currentActivity = { title, channelName };
    const db = readDb();
    if (!db || db.settings.discordRpcEnabled === false) {
      this.disconnect();
      return;
    }

    if (!this.connected) {
      this.connect();
      return;
    }

    this.updateActivity(title, channelName);
  }

  /**
   * Türkçe Açıklama: Discord istemcisine güncel SET_ACTIVITY paketini gönderir.
   * 
   * @param {string|null} title - Video başlığı
   * @param {string|null} channelName - YouTube kanal adı
   * @returns {void}
   */
  updateActivity(title, channelName) {
    let payload;
    if (title) {
      let detailsText = channelName || 'YouTube';

      payload = JSON.stringify({
        cmd: 'SET_ACTIVITY',
        args: {
          pid: process.pid,
          activity: {
            state: title,
            details: detailsText,
            assets: {
              large_image: 'logo',
              large_text: 'HaYTooL YouTube Downloader'
            },
            buttons: [
              {
                label: 'Uygulamayı İndir / Download',
                url: 'https://github.com/HaYToKoRaZ/haytool-youtube-download'
              }
            ]
          }
        },
        nonce: Math.random().toString(36).substring(2)
      });
    } else {
      payload = JSON.stringify({
        cmd: 'SET_ACTIVITY',
        args: {
          pid: process.pid,
          activity: null
        },
        nonce: Math.random().toString(36).substring(2)
      });
    }

    this.send(1, payload);
  }

  /**
   * Türkçe Açıklama: Discord RPC bağlantısını kapatır ve yeniden bağlanma sürecini durdurur.
   * 
   * @returns {void}
   */
  disconnect() {
    if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);
    this.cleanup();
  }
}

export const discordRpc = new DiscordRPC('1518713595477622794');
