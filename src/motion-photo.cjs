'use strict';

// Motion photos are still images with an ISO BMFF movie appended. Samsung
// files may also contain a small metadata MP4 *before* the actual movie, and
// a SEF trailer after it. Do not simply take the first ftyp or last N bytes.
function boxAt(data, offset, limit) {
  if (offset < 0 || offset + 8 > limit) return null;
  let size = data.readUInt32BE(offset);
  let header = 8;
  const type = data.toString('ascii', offset + 4, offset + 8);
  if (!/^[\w \xa9]{4}$/.test(type)) return null;
  if (size === 1) {
    if (offset + 16 > limit) return null;
    const big = data.readBigUInt64BE(offset + 8);
    if (big > BigInt(Number.MAX_SAFE_INTEGER)) return null;
    size = Number(big);
    header = 16;
  } else if (size === 0) size = limit - offset;
  if (size < header || offset + size > limit) return null;
  return { type, start: offset, body: offset + header, end: offset + size };
}

function containsVideoTrack(data, start, end, depth = 0) {
  if (depth > 6) return false;
  for (let offset = start; offset < end;) {
    const box = boxAt(data, offset, end);
    if (!box) break;
    if (box.type === 'hdlr' && box.body + 12 <= box.end &&
        data.toString('ascii', box.body + 8, box.body + 12) === 'vide') return true;
    if (['moov', 'trak', 'mdia'].includes(box.type) &&
        containsVideoTrack(data, box.body, box.end, depth + 1)) return true;
    offset = box.end;
  }
  return false;
}

function movieAt(data, start) {
  const first = boxAt(data, start, data.length);
  if (!first || first.type !== 'ftyp' || first.end - first.body < 8) return null;
  let end = start;
  let hasMedia = false;
  let hasVideo = false;
  const topLevel = new Set(['ftyp', 'moov', 'mdat', 'free', 'skip', 'wide', 'uuid', 'pdin', 'sidx', 'styp', 'moof', 'mfra']);
  for (let count = 0; count < 10000;) {
    const box = boxAt(data, end, data.length);
    if (!box || !topLevel.has(box.type) || (count > 0 && box.type === 'ftyp')) break;
    count++;
    if (box.type === 'mdat') hasMedia = true;
    if (box.type === 'moov') hasVideo ||= containsVideoTrack(data, box.body, box.end);
    end = box.end;
  }
  return hasMedia && hasVideo ? { start, end, length: end - start } : null;
}

function inspectMotionPhoto(data) {
  if (!Buffer.isBuffer(data)) throw new TypeError('Expected a file buffer.');
  const isJpeg = data.length >= 3 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff;
  const candidates = [];
  for (let pos = data.indexOf('ftyp'); pos !== -1; pos = data.indexOf('ftyp', pos + 4)) {
    const candidate = movieAt(data, pos - 4);
    if (candidate) candidates.push(candidate);
    if (candidates.length > 100) throw new Error('This file contains too many embedded movies.');
  }
  const samsung = data.indexOf('MotionPhoto_Data');
  const preferredStart = samsung === -1 ? -1 : samsung + Buffer.byteLength('MotionPhoto_Data');
  candidates.sort((a, b) => (b.start === preferredStart) - (a.start === preferredStart) || b.length - a.length);
  const movie = candidates[0] || null;
  if (!isJpeg && (!movie || movie.start !== 0)) {
    throw new Error('Open a Samsung or Google Motion Photo (.jpg), or a video (.mp4/.mov). HEIC and Apple Live Photo pairs are not supported yet.');
  }
  const header = isJpeg ? data.subarray(0, Math.min(data.length, 512 * 1024)).toString('latin1') : '';
  const match = header.match(/(?:MotionPhotoPresentationTimestampUs|MicroVideoPresentationTimestampUs)\s*=\s*["'](-?\d+)["']/);
  const microseconds = match ? Number(match[1]) : -1;
  return {
    kind: isJpeg ? (movie ? 'motion' : 'still') : 'video',
    movie,
    presentationSeconds: microseconds >= 0 ? microseconds / 1e6 : null
  };
}

module.exports = { inspectMotionPhoto, movieAt };
