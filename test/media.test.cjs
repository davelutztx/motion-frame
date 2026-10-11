'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { loadMedia, exportFrame } = require('../src/media.cjs');
const fixture = process.env.MOTION_PHOTO_FIXTURE;

test('sample motion photo decodes all 107 frames; selected JPG exports unchanged', { skip: !fixture }, async () => {
  const root = await fs.mkdtemp(path.join(process.env.MOTION_TEST_TMP || os.tmpdir(), 'motion-test-'));
  try {
    const source = await fs.readFile(fixture);
    const hash = data => createHash('sha256').update(data).digest('hex');
    const progress = [];
    const loaded = await loadMedia(fixture, { tempRoot: root, ffmpeg: require('ffmpeg-static'), onProgress: n => progress.push(n) });
    assert.equal(loaded.kind, 'motion');
    assert.equal(loaded.frames.length, 107);
    assert.equal(loaded.timestamps.length, 107);
    assert.equal(loaded.timestamps[0], 0);
    assert.ok(Math.abs(loaded.timestamps[106] - 3.53333) < 0.001);
    assert.ok(progress.length > 0);
    const output = path.join(root, 'Selected frame ü with spaces.jpg');
    await exportFrame(loaded, 59, output);
    assert.equal(hash(await fs.readFile(output)), hash(await fs.readFile(loaded.frames[59])));
    assert.equal(hash(await fs.readFile(fixture)), hash(source));
    await assert.rejects(exportFrame(loaded, -1, output), /valid frame/);
    await assert.rejects(exportFrame(loaded, 107, output), /valid frame/);
    await assert.rejects(exportFrame(loaded, 1.5, output), /valid frame/);
    await assert.rejects(exportFrame(loaded, 59, fixture), /original photo safe/);
    const alias = path.join(root, 'alias.jpg');
    await fs.link(fixture, alias);
    await assert.rejects(exportFrame(loaded, 59, alias), /original photo safe/);
    const controller = new AbortController(); controller.abort();
    await assert.rejects(loadMedia(fixture, { tempRoot: root, signal: controller.signal }), /cancelled/);
    const before = (await fs.readdir(root)).sort();
    const during = new AbortController();
    await assert.rejects(loadMedia(fixture, {
      tempRoot: root, ffmpeg: require('ffmpeg-static'), signal: during.signal,
      onProgress: () => during.abort()
    }), /cancelled/);
    assert.deepEqual((await fs.readdir(root)).sort(), before, 'cancelled decode removes its temporary files');
  } finally { await fs.rm(root, { recursive: true, force: true }); }
});
