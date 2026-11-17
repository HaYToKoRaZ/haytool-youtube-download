// Türkçe Açıklama: Güvenilmeyen embed sayfalarındaki JWPlayer/obfuscated scriptleri Node Permission Model (--permission) altında izole çalıştıran alt süreç işçisi.
import vm from 'vm';

function readStdin() {
  return new Promise((resolve, reject) => {
    const chunks = [];
    process.stdin.on('data', chunk => chunks.push(chunk));
    process.stdin.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    process.stdin.on('error', reject);
  });
}

async function main() {
  const rawInput = await readStdin();
  if (!rawInput || !rawInput.trim()) {
    process.stdout.write(JSON.stringify({ capturedSources: [], capturedTracks: [] }));
    return;
  }

  const { scripts = [], embedUrl = '', userAgent = '' } = JSON.parse(rawInput);

  let hostname = '';
  let origin = '';
  try {
    const u = new URL(embedUrl);
    hostname = u.hostname;
    origin = u.origin;
  } catch {}

  const capturedSources = [];
  const capturedTracks = [];

  const loc = { hostname, href: embedUrl, origin };
  const storageMock = new Proxy({}, {
    get: (target, prop) => target[prop] || '',
    set: (target, prop, val) => { target[prop] = val; return true; }
  });

  const dummyDomEl = {
    addEventListener: () => {},
    style: {},
    classList: { add: () => {}, remove: () => {} },
    dataset: {},
    hidden: false
  };

  const noop = () => {};
  const sandbox = {
    location: loc,
    window: { location: loc },
    self: { location: loc },
    top: { location: loc },
    parent: { location: loc },
    document: {
      location: loc,
      referrer: embedUrl,
      cookie: '',
      addEventListener: noop,
      removeEventListener: noop,
      getElementById: () => dummyDomEl,
      querySelector: () => dummyDomEl,
      querySelectorAll: () => [dummyDomEl],
      getElementsByTagName: () => [dummyDomEl],
      getElementsByClassName: () => [dummyDomEl],
      documentElement: { setAttribute: noop, style: { setProperty: noop } },
      body: dummyDomEl,
      head: dummyDomEl,
      createElement: () => dummyDomEl
    },
    navigator: { userAgent },
    localStorage: storageMock,
    sessionStorage: storageMock,
    setTimeout: (fn) => { if (typeof fn === 'function') { try { fn(); } catch {} } return 1; },
    clearTimeout: noop,
    setInterval: noop,
    clearInterval: noop,
    requestAnimationFrame: noop,
    cancelAnimationFrame: noop,
    fetch: () => Promise.resolve({ ok: false, json: () => Promise.resolve({}), text: () => Promise.resolve('') }),
    XMLHttpRequest: function() {
      return {
        open: noop,
        send: noop,
        setRequestHeader: noop,
        addEventListener: noop
      };
    },
    atob: (s) => Buffer.from(s, 'base64').toString('binary'),
    btoa: (s) => Buffer.from(s, 'binary').toString('base64'),
    jwplayer: function() {
      return {
        setup: function(cfg) {
          if (cfg && Array.isArray(cfg.sources)) {
            capturedSources.push(...cfg.sources);
          } else if (cfg && cfg.file) {
            capturedSources.push({ file: cfg.file, type: cfg.type || 'hls' });
          }
          if (cfg && Array.isArray(cfg.tracks)) {
            capturedTracks.push(...cfg.tracks);
          }
          return this;
        },
        key: '',
        on: noop,
        once: noop
      };
    },
    $: function() { return { ready: (fn) => { try { fn(); } catch {} }, on: noop, once: noop, ajax: noop }; },
    jQuery: function() { return { ready: (fn) => { try { fn(); } catch {} }, on: noop, once: noop, ajax: noop }; },
    console: { log: noop, error: noop, warn: noop },
    String, Math, Number, parseInt, parseFloat, Date
  };

  const context = vm.createContext(sandbox);
  for (const code of scripts) {
    if (typeof code === 'string' && code.trim().length > 0) {
      try {
        vm.runInContext(code, context, { timeout: 2500 });
      } catch {}
    }
  }

  process.stdout.write(JSON.stringify({ capturedSources, capturedTracks }));
}

main().catch(() => {
  process.stdout.write(JSON.stringify({ capturedSources: [], capturedTracks: [] }));
});
