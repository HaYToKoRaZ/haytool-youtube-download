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
    this.isReady = false;
    this.reconnectTimeout = null;
    this.currentActivity = null;
    this.incomingBuffer = Buffer.alloc(0);
    this.currentPipeIndex = 0;
  }

  /**
   * Türkçe Açıklama: Discord Named Pipe kanalına bağlanır ve olay dinleyicilerini kurar.
   * 
   * @param {number} [pipeIndex=0] - Taranacak pipe indeksi (0-9)
   * @returns {void}
   */
  connect(pipeIndex = 0) {
    if (this.connected || this.client) return;
    if (os.platform() !== 'win32') return;

    this.currentPipeIndex = pipeIndex;
    const pipeName = `\\\\.\\pipe\\discord-ipc-${this.currentPipeIndex}`;
    this.incomingBuffer = Buffer.alloc(0);

    const socket = net.createConnection(pipeName);
    this.client = socket;

    socket.on('connect', () => {
      this.connected = true;
      this.sendHandshake();
    });

    socket.on('data', (chunk) => {
      this.handleIncomingData(chunk);
    });

    socket.on('error', (err) => {
      // Eğer ilk denenen pipe bulunamadıysa (ENOENT), sonraki pipe indeksini dene (0-9)
      const shouldTryNext = (err && (err.code === 'ENOENT' || err.code === 'ECONNREFUSED')) && this.currentPipeIndex < 9 && !this.connected;
      this.cleanup();
      if (shouldTryNext) {
        this.connect(this.currentPipeIndex + 1);
      }
    });

    socket.on('close', () => {
      this.cleanup();
      this.scheduleReconnect();
    });
  }

  /**
   * Türkçe Açıklama: Named Pipe'tan gelen akışı 8 baytlık başlık (opcode + uzunluk) ile tam JSON paketlerine dönüştürür.
   * 
   * @param {Buffer} chunk
   */
  handleIncomingData(chunk) {
    this.incomingBuffer = Buffer.concat([this.incomingBuffer, chunk]);

    while (this.incomingBuffer.length >= 8) {
      const op = this.incomingBuffer.readInt32LE(0);
      const len = this.incomingBuffer.readInt32LE(4);

      if (this.incomingBuffer.length < 8 + len) {
        break; // Paketin tamamı henüz gelmedi
      }

      const payloadBuf = this.incomingBuffer.subarray(8, 8 + len);
      this.incomingBuffer = this.incomingBuffer.subarray(8 + len);

      try {
        const message = JSON.parse(payloadBuf.toString('utf8'));
        if (message.cmd === 'DISPATCH' && message.evt === 'READY') {
          this.isReady = true;
          // El sıkışma başarıyla tamamlandı, bekleyen bir aktivite varsa hemen gönder
          if (this.currentActivity && (this.currentActivity.title || this.currentActivity.channelName)) {
            this.updateActivity(this.currentActivity.title, this.currentActivity.channelName);
          }
        }
      } catch (e) {
        // Geçersiz paketler sessizce yutulur
      }
    }
  }

  /**
   * Türkçe Açıklama: Named Pipe bağlantısını sıfırlar ve kaynakları temizler.
   * 
   * @returns {void}
   */
  cleanup() {
    this.connected = false;
    this.isReady = false;
    this.incomingBuffer = Buffer.alloc(0);
    if (this.client) {
      try {
        this.client.destroy();
      } catch (e) {}
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
      this.connect(0);
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
      this.connect(0);
      return;
    }

    if (!this.isReady) {
      // Bağlantı kuruldu ancak henüz Discord READY yanıtı gelmediyse, aktivite READY gelince gönderilecek
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
    if (!this.connected || !this.isReady) return;

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
              large_text: 'Multimedia HaYTooL'
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

export const discordRpc = new DiscordRPC('1552027056383074314');
