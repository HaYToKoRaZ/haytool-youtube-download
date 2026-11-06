// Türkçe Açıklama: Önyüz hata köprüsü — window hataları, yakalanmamış promise reddetmeleri ve
// console.error çıktılarını toplayıp /api/client-log üzerinden sunucu oturum loguna aktarır.
// index.html <head>'indeki erken yakalayıcı (window.__htErr / __htErrQ) bu modül yüklenene
// kadar olayları kuyrukta bekletir; bu modül devraldığında kuyruk boşaltılır.
(function () {
  var EARLY_QUEUE = Array.isArray(window.__htErrQ) ? window.__htErrQ : (window.__htErrQ = []);
  var BATCH = [];
  var timer = null;
  var sending = false;

  function makeEvent(message, stack) {
    return {
      m: String(message == null ? '' : message).slice(0, 4000),
      s: String(stack == null ? '' : stack).slice(0, 4000),
      u: String(location.pathname + location.hash).slice(0, 300),
      t: Date.now()
    };
  }

  function push(ev) {
    if (BATCH.length >= 60) BATCH.shift();
    BATCH.push(ev);
    schedule();
  }

  function schedule() {
    if (timer === null) timer = setTimeout(flush, 2000);
  }

  function flush() {
    timer = null;
    while (EARLY_QUEUE.length) push(EARLY_QUEUE.shift());
    if (sending || BATCH.length === 0) return;
    var events = BATCH.splice(0, 12);
    sending = true;
    fetch('/api/client-log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ events: events }),
      keepalive: true
    }).catch(function () {
      // Türkçe Açıklama: Köprü asla hata fırlatmaz; sunucu ulaşılamazsa sessizce geç.
    }).finally(function () {
      sending = false;
      if (BATCH.length) schedule();
    });
  }

  // Türkçe Açıklama: Erken yakalayıcıyı devral — sonraki hatalar doğrudan bu kuyruğa düşer.
  window.__htErr = function (message, stack) {
    push(makeEvent(message, stack));
  };

  // Türkçe Açıklama: console.error'ı sarmala; orijinal konsol çıktısını da koru.
  var originalError = console.error;
  console.error = function () {
    try {
      var parts = [];
      var stack = '';
      for (var i = 0; i < arguments.length; i++) {
        var arg = arguments[i];
        if (arg && arg.stack) {
          stack = arg.stack;
          parts.push(arg.message || String(arg));
        } else if (typeof arg === 'string') {
          parts.push(arg);
        } else {
          try { parts.push(JSON.stringify(arg)); } catch (e) { parts.push(String(arg)); }
        }
      }
      var msg = parts.join(' ');
      if (msg) push(makeEvent(msg, stack));
    } catch (e) { /* köprü kendi hatasını yutmak zorundadır */ }
    return originalError.apply(console, arguments);
  };

  // Türkçe Açıklama: Sayfa kapanırken bekleyen olayları sendBeacon ile gönder.
  window.addEventListener('beforeunload', function () {
    while (EARLY_QUEUE.length) push(EARLY_QUEUE.shift());
    if (BATCH.length) {
      try {
        navigator.sendBeacon('/api/client-log', new Blob(
          [JSON.stringify({ events: BATCH.splice(0, 20) })],
          { type: 'application/json' }
        ));
      } catch (e) {}
    }
  });

  // Türkçe Açıklama: Erken kuyrukta birikmiş olaylar için ilk gönderimi planla.
  setTimeout(flush, 3000);
})();
