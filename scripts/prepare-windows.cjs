'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const vendor = path.join(root, 'vendor', 'win');
fs.mkdirSync(vendor, { recursive: true });
const executable = path.join(vendor, 'ffmpeg.exe');
const installer = require.resolve('ffmpeg-static/install.js');
const result = spawnSync(process.execPath, [installer], {
  env: { ...process.env, FFMPEG_BIN: executable, npm_config_platform: 'win32', npm_config_arch: 'x64' },
  stdio: 'inherit'
});
if (result.status !== 0) process.exit(result.status || 1);
const header = fs.openSync(executable, 'r');
const bytes = Buffer.alloc(2);
fs.readSync(header, bytes, 0, 2, 0);
fs.closeSync(header);
if (bytes.toString() !== 'MZ') throw new Error('The Windows FFmpeg binary is missing or invalid.');
for (const suffix of ['.LICENSE', '.README']) {
  if (!fs.existsSync(executable + suffix)) throw new Error(`Missing FFmpeg ${suffix} notice.`);
}
console.log('Windows x64 FFmpeg and license notices are ready.');
