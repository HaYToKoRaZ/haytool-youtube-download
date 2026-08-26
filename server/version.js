// Türkçe Açıklama: Uygulama sürüm numarasını package.json dosyasından okuyan tek kaynak modülü.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const packageJsonPath = path.join(__dirname, '..', 'package.json');

/**
 * package.json içindeki sürüm alanını okur.
 *
 * @returns {string} Semantik sürüm numarası (örn. 7.2.0)
 */
function readPackageVersion() {
  const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  return pkg.version || '0.0.0';
}

export const appVersion = readPackageVersion();
