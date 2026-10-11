'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { inspectMotionPhoto, movieAt } = require('../src/motion-photo.cjs');

function box(type, body = Buffer.alloc(0)) {
  const header = Buffer.alloc(8);
  header.writeUInt32BE(8 + body.length);
  header.write(type, 4);
  return Buffer.concat([header, body]);
}
function movie(kind = 'vide', bytes = 40) {
  const handler = Buffer.alloc(24); handler.write(kind, 8);
  return Buffer.concat([
    box('ftyp', Buffer.from('isom\0\0\0\0isommp42')),
    box('mdat', Buffer.alloc(bytes)),
    box('moov', box('trak', box('mdia', box('hdlr', handler))))
  ]);
}
const jpg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 2, 0xff, 0xd9]);

test('plain JPEG is a still, not a missing-codec error', () => {
  assert.equal(inspectMotionPhoto(jpg).kind, 'still');
});
test('Google-style JPEG followed by MP4', () => {
  const video = movie();
  const info = inspectMotionPhoto(Buffer.concat([jpg, video]));
  assert.equal(info.kind, 'motion');
  assert.equal(info.movie.start, jpg.length);
  assert.equal(info.movie.length, video.length);
});
test('Samsung metadata MP4 is not mistaken for the motion video; footer excluded', () => {
  const prefix = Buffer.concat([jpg, movie('meta'), Buffer.from('MotionPhoto_Data')]);
  const video = movie();
  const info = inspectMotionPhoto(Buffer.concat([prefix, video, Buffer.from('SEFT-trailer')]));
  assert.equal(info.movie.start, prefix.length);
  assert.equal(info.movie.length, video.length);
});
test('Samsung marker takes precedence even when another video is larger', () => {
  const prefix = Buffer.concat([jpg, movie('vide', 200), Buffer.from('MotionPhoto_Data')]);
  assert.equal(inspectMotionPhoto(Buffer.concat([prefix, movie()])).movie.start, prefix.length);
});
test('without a marker use the largest valid video, not first ftyp bytes', () => {
  const prefix = Buffer.concat([jpg, Buffer.from('bogusftypgarbage'), movie()]);
  assert.equal(inspectMotionPhoto(Buffer.concat([prefix, movie('vide', 200)])).movie.start, prefix.length);
});
test('standalone MP4 is recognized', () => assert.equal(inspectMotionPhoto(movie()).kind, 'video'));
test('truncated movie cannot escape file boundaries', () => assert.equal(movieAt(movie().subarray(0, 50), 0), null));
test('untrusted extended box sizes are rejected', () => {
  const data = Buffer.alloc(24); data.writeUInt32BE(1); data.write('ftyp', 4); data.writeBigUInt64BE(2n ** 63n, 8);
  assert.equal(movieAt(data, 0), null);
});
test('invalid and unsupported files get an actionable error', () => {
  assert.throws(() => inspectMotionPhoto(Buffer.from('not a photo')), /Samsung or Google/);
});
test('presentation timestamp is read without making file-length assumptions', () => {
  const data = Buffer.concat([jpg, Buffer.from('GCamera:MotionPhotoPresentationTimestampUs="1975402"'), movie()]);
  assert.equal(inspectMotionPhoto(data).presentationSeconds, 1.975402);
});
test('unknown presentation timestamp remains null', () => {
  assert.equal(inspectMotionPhoto(Buffer.concat([jpg, Buffer.from('GCamera:MicroVideoPresentationTimestampUs="-1"'), movie()])).presentationSeconds, null);
});
