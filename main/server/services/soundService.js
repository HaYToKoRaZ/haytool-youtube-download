/**
 * HaYTooL YouTube Downloader - Sistem & Uygulama Ses Motoru
 * Vanilla, sıfır harici bağımlılık.
 * Windows SoundPlayer ve Web Audio/HTML5 desteği.
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import { exec } from 'child_process';
import { fileURLToPath } from 'url';
import { readDb } from '../database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SOUNDS_DIR = path.resolve(__dirname, '../../public/sounds');

export const AVAILABLE_SOUNDS = [
  'chime',    // Yumuşak Zil
  'bell',     // Klasik Zil
  'pop',      // Minimal Pop
  'fanfare',  // Başarı Akoru
  'melodic',  // Melodik
  'subtle',   // Hafif
  'silent'    // Sessiz
];

/**
 * Belirtilen ses dosyasını Windows SoundPlayer üzerinden native çalar.
 * @param {string} soundName 'chime' | 'bell' | 'pop' | 'fanfare' | 'melodic' | 'subtle' | 'error' | 'silent'
 */
export function playWavSound(soundName = 'chime') {
  if (!soundName || soundName === 'silent') return;
  if (os.platform() !== 'win32') return;

  const wavFile = path.join(SOUNDS_DIR, `${soundName}.wav`);
  if (!fs.existsSync(wavFile)) return;

  const safePath = wavFile.replace(/\\/g, '\\\\').replace(/'/g, "''");
  const psCmd = `powershell -NoProfile -NonInteractive -Command "(New-Object System.Media.SoundPlayer('${safePath}')).PlaySync()"`;

  exec(psCmd, () => {});
}

/**
 * İndirme veya Birleştirme durumuna göre kullanıcının ayarlarını okuyup sesi çalar.
 * @param {'download_start'|'download_complete'|'merge_start'|'merge_complete'|'error'|'cli'} eventType
 * @param {string} [overrideSound] Test veya doğrudan çağrı için ses adı
 */
export function playAppSound(eventType, overrideSound = null) {
  if (overrideSound) {
    playWavSound(overrideSound);
    return;
  }

  const db = readDb();
  const settings = db.settings || {};

  // Genel sesli bildirim anahtarı kapalıysa çalma
  if (settings.playSounds === false) return;

  let chosenSound = 'chime';

  switch (eventType) {
    case 'download_start':
      chosenSound = settings.soundDownloadStart || 'pop';
      break;
    case 'download_complete':
      chosenSound = settings.soundDownloadComplete || settings.downloadSound || 'chime';
      break;
    case 'merge_start':
      chosenSound = settings.soundMergeStart || 'subtle';
      break;
    case 'merge_complete':
      chosenSound = settings.soundMergeComplete || settings.mergeSound || 'fanfare';
      break;
    case 'cli':
      chosenSound = settings.soundCli || 'pop';
      break;
    case 'error':
      chosenSound = 'error';
      break;
    default:
      chosenSound = 'chime';
  }

  if (chosenSound && chosenSound !== 'silent') {
    playWavSound(chosenSound);
  }
}
