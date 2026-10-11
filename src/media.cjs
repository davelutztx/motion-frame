'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { inspectMotionPhoto } = require('./motion-photo.cjs');

const MAX_BYTES = 512 * 1024 * 1024;
const MAX_FRAMES = 1800;

function decodeFrames(ffmpeg, input, directory, { signal, onProgress = () => {} } = {}) {
  return new Promise((resolve, reject) => {
    const args = ['-hide_banner', '-nostdin', '-y', '-threads', '2', '-i', input,
      '-map', '0:v:0', '-an', '-sn', '-dn', '-vf', 'showinfo', '-fps_mode', 'passthrough',
      '-frames:v', String(MAX_FRAMES + 1), '-q:v', '1', '-threads', '2', path.join(directory, 'frame-%06d.jpg')];
    const child = spawn(ffmpeg, args, { windowsHide: true, signal, shell: false });
    let pending = '';
    let diagnostic = '';
    let processError = null;
    const timestamps = [];
    const timer = setTimeout(() => child.kill(), 120000);
    child.stderr.on('data', chunk => {
      const text = chunk.toString();
      diagnostic = (diagnostic + text).slice(-12000);
      pending += text;
      const lines = pending.split(/[\r\n]/);
      pending = lines.pop();
      for (const line of lines) {
        const found = line.match(/\bn:\s*(\d+).*?pts_time:\s*([\d.eE+\-]+)/);
        if (found) {
          timestamps[Number(found[1])] = Number(found[2]);
          if (timestamps.length === 1 || timestamps.length % 10 === 0) onProgress(timestamps.length);
        }
      }
    });
    // Wait for close even on abort, so Windows releases output file handles
    // before the caller removes the temporary directory.
    child.on('error', error => { processError = error; });
    child.on('close', code => {
      clearTimeout(timer);
      if (signal?.aborted) return reject(new Error('Loading cancelled.'));
      if (processError) return reject(processError);
      if (code !== 0) return reject(new Error(`The embedded video could not be decoded. It may be damaged or unsupported. ${diagnostic.split('\n').filter(Boolean).slice(-2).join(' ').slice(0, 350)}`));
      resolve(timestamps);
    });
  });
}

async function loadMedia(filePath, { ffmpeg, tempRoot, signal, onProgress } = {}) {
  if (typeof filePath !== 'string' || !filePath) throw new Error('Choose a photo first.');
  if (!['.jpg', '.jpeg', '.mp4', '.mov'].includes(path.extname(filePath).toLowerCase())) {
    throw new Error('Choose a JPG Motion Photo, MP4, or MOV file.');
  }
  const stat = await fs.stat(filePath);
  if (!stat.isFile()) throw new Error('Drop a file, not a folder.');
  if (stat.size > MAX_BYTES) throw new Error('This file is too large. The limit is 512 MB.');
  if (signal?.aborted) throw new Error('Loading cancelled.');
  const data = await fs.readFile(filePath, { signal });
  const info = inspectMotionPhoto(data);
  const dir = await fs.mkdtemp(path.join(tempRoot, 'photo-'));
  try {
    let original = null;
    if (info.kind !== 'video') {
      original = path.join(dir, 'original.jpg');
      await fs.writeFile(original, data);
    }
    let timestamps = [];
    let frames = [];
    if (info.movie) {
      const video = path.join(dir, 'motion.mp4');
      await fs.writeFile(video, data.subarray(info.movie.start, info.movie.end));
      const frameDir = path.join(dir, 'frames');
      await fs.mkdir(frameDir);
      timestamps = await decodeFrames(ffmpeg, video, frameDir, { signal, onProgress });
      frames = (await fs.readdir(frameDir)).filter(name => /^frame-\d{6}\.jpg$/.test(name)).sort().map(name => path.join(frameDir, name));
      if (frames.length > MAX_FRAMES) throw new Error('This clip has more than 1,800 frames. Please use a shorter clip.');
      if (!frames.length) throw new Error('No readable frames were found in this video.');
      // showinfo provides presentation timestamps, including variable-rate clips.
      if (timestamps.length !== frames.length || timestamps.some(t => !Number.isFinite(t))) {
        throw new Error('The frame timing could not be read reliably.');
      }
      const first = timestamps[0];
      timestamps = timestamps.map(t => t - first);
    }
    if (signal?.aborted) throw new Error('Loading cancelled.');
    return { ...info, dir, original, frames, timestamps, sourcePath: path.resolve(filePath), name: path.basename(filePath) };
  } catch (error) {
    await fs.rm(dir, { force: true, recursive: true });
    throw error;
  }
}

async function exportFrame(session, index, destination) {
  if (!Number.isInteger(index) || index < 0 || index >= session.frames.length) throw new Error('Select a valid frame first.');
  if (path.resolve(destination).toLowerCase() === session.sourcePath.toLowerCase()) throw new Error('Choose a different name to keep your original photo safe.');
  // Also reject aliases and hard links to the imported source.
  try {
    const [source, target] = await Promise.all([fs.stat(session.sourcePath), fs.stat(destination)]);
    if (source.dev === target.dev && source.ino === target.ino) throw new Error('Choose a different file to keep your original photo safe.');
  } catch (error) { if (error.code !== 'ENOENT') throw error; }
  await fs.copyFile(session.frames[index], destination);
  return destination;
}

module.exports = { loadMedia, decodeFrames, exportFrame, MAX_FRAMES };
