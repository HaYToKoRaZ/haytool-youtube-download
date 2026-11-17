// Türkçe Açıklama: CLI & Konsol komutları için katalog ve yazım hatası (typo) öneri motoru (Levenshtein + ön ek eşleşmesi).

export const CLI_CANONICAL_COMMANDS = [
  'status', 'info', 'durum',
  'diag', 'health', 'sistem',
  'queue', 'kuyruk',
  'errors', 'hatalar',
  'verbose', 'log-api',
  'gton', 'gtoff',
  'gameon', 'gameoff', 'game',
  'merge', 'merge-pause',
  'pause', 'duraklat',
  'resume', 'devam',
  'ton', 'toff', 'toggle', 'turtle',
  'speed', 'altspeed',
  'pd', 'paste', 'pano',
  'check', 'scan', 'tara',
  'backup', 'yedek',
  'fakap', 'fakap-run',
  'play', 'oynat',
  'open', 'show', 'hide', 'tray',
  'stop', 'exit', 'clear', 'help'
];

/**
 * İki metin arasındaki Levenshtein düzenleme mesafesini hesaplar.
 * @param {string} a
 * @param {string} b
 * @returns {number}
 */
export function levenshteinDistance(a, b) {
  const s1 = String(a || '').toLowerCase();
  const s2 = String(b || '').toLowerCase();
  const m = s1.length;
  const n = s2.length;
  if (m === 0) return n;
  if (n === 0) return m;

  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  let curr = new Array(n + 1);

  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        prev[j] + 1,
        curr[j - 1] + 1,
        prev[j - 1] + cost
      );
    }
    [prev, curr] = [curr, prev];
  }
  return prev[n];
}

/**
 * Bilinmeyen veya hatalı yazılmış bir CLI komutu için en yakın geçerli komut önerilerini döndürür.
 * @param {string} rawCommand
 * @param {number} [maxResults=3]
 * @returns {string[]}
 */
export function suggestClosestCliCommands(rawCommand, maxResults = 3) {
  const cmd = String(rawCommand || '').trim().toLowerCase();
  if (!cmd) return [];

  const maxDist = cmd.length <= 3 ? 1 : (cmd.length <= 6 ? 2 : 3);
  const scored = [];

  for (const candidate of CLI_CANONICAL_COMMANDS) {
    if (candidate === cmd) continue;
    const dist = levenshteinDistance(cmd, candidate);
    const isPrefix = candidate.startsWith(cmd) || (cmd.length >= 3 && cmd.startsWith(candidate));
    if (dist <= maxDist || isPrefix) {
      const score = isPrefix ? Math.min(dist, 1) - 0.25 : dist;
      scored.push({ candidate, score, dist });
    }
  }

  scored.sort((a, b) => a.score - b.score || a.dist - b.dist || a.candidate.localeCompare(b.candidate));
  return scored.slice(0, maxResults).map(s => s.candidate);
}
