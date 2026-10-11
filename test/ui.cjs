'use strict';
const { _electron: electron } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { createHash } = require('node:crypto');
const fixture = process.env.MOTION_PHOTO_FIXTURE;
if (!fixture) throw new Error('Set MOTION_PHOTO_FIXTURE to the original sample JPG.');
const scratch = process.env.MOTION_TEST_TMP || os.tmpdir();

(async () => {
  const directory = await fs.mkdtemp(path.join(scratch, 'motion-ui-'));
  const output = path.join(directory, 'Chosen frame ü.jpg');
  const corrupted = path.join(directory, 'broken.jpg');
  await fs.writeFile(corrupted, 'not a jpg');
  const env = { ...process.env }; delete env.ELECTRON_RUN_AS_NODE;
  const app = await electron.launch({ args: ['--no-sandbox', '--disable-gpu', '--ozone-platform=x11', `--user-data-dir=${path.join(directory, 'profile')}`, path.resolve(__dirname, '..')], env, timeout: 30000 });
  const page = await app.firstWindow();
  page.setDefaultTimeout(20000);
  console.log('Electron window opened');
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const sourceHash = createHash('sha256').update(await fs.readFile(fixture)).digest('hex');
  try {
    await page.waitForSelector('#dropzone');
    assert.equal(await page.evaluate(() => typeof window.require), 'undefined');
    assert.equal(await page.evaluate(() => typeof window.process), 'undefined');
    await page.screenshot({ path: path.join(directory, '01-empty.png') });

    // A native file input supplies a disk-backed File, exercising the same
    // Electron webUtils.getPathForFile + preload + IPC path as a real OS drop.
    await page.evaluate(() => {
      const input = document.createElement('input'); input.type = 'file'; input.id = 'test-file'; input.hidden = true; document.body.append(input);
    });
    await page.setInputFiles('#test-file', fixture);
    await page.evaluate(() => {
      const transfer = new DataTransfer(); transfer.items.add(document.getElementById('test-file').files[0]);
      window.dispatchEvent(new DragEvent('drop', { dataTransfer: transfer, bubbles: true, cancelable: true }));
    });
    await page.waitForFunction(() => document.querySelectorAll('.thumbnail').length === 107 && !document.getElementById('save').disabled);
    assert.match(await page.locator('#summary').innerText(), /107 frames · 3\.57 s/);
    assert.equal(await page.locator('#dimensions').innerText(), '598 × 1142');
    assert.equal(await page.locator('#selection-title').innerText(), 'Frame 60');
    assert.equal(await page.evaluate(() => document.getElementById('preview').naturalWidth), 598);
    await page.screenshot({ path: path.join(directory, '02-loaded.png') });
    console.log('PASS: actual Electron File drop, 107 frames, preview, dimensions, capture-frame default, renderer isolation');

    await page.locator('#viewer').focus();
    await page.keyboard.press('ArrowRight');
    assert.equal(await page.locator('#selection-title').innerText(), 'Frame 61');
    await page.keyboard.press('Home');
    assert.equal(await page.locator('#selection-title').innerText(), 'Frame 1');
    await page.keyboard.press('End');
    assert.equal(await page.locator('#selection-title').innerText(), 'Frame 107');
    await page.locator('#jump').fill('17');
    await page.locator('#jump').press('Tab');
    assert.equal(await page.locator('#selection-title').innerText(), 'Frame 17');
    await page.locator('.thumbnail').nth(9).click();
    assert.equal(await page.locator('#selection-title').innerText(), 'Frame 10');
    await page.locator('#scrubber').fill('29');
    assert.equal(await page.locator('#selection-title').innerText(), 'Frame 30');
    await page.locator('#viewer').dispatchEvent('wheel', { deltaY: 100 });
    assert.equal(await page.locator('#selection-title').innerText(), 'Frame 31');
    console.log('PASS: arrows, first/last, frame-number entry, thumbnail click, slider, wheel');

    await page.locator('#play').click();
    await page.waitForFunction(() => Number(document.getElementById('jump').value) > 36);
    await page.locator('#play').click();
    assert.equal(await page.locator('#play').getAttribute('aria-label'), 'Play motion');
    await page.locator('#original-tab').click();
    await page.waitForFunction(() => document.getElementById('preview').naturalWidth === 1371);
    assert.equal(await page.locator('#save').isDisabled(), true);
    await page.locator('#motion-tab').click();
    await page.locator('#jump').fill('17');
    await page.locator('#jump').press('Tab');
    await page.waitForFunction(() => !document.getElementById('save').disabled);
    console.log('PASS: playback, pause, original-still resolution, export only from selected motion frame');

    await app.evaluate(({ dialog }, destination) => {
      dialog.showSaveDialog = async () => ({ canceled: false, filePath: destination });
    }, output);
    await page.locator('#save').click();
    await page.waitForFunction(() => document.getElementById('notice-text').textContent.startsWith('Saved '));
    const bytes = await fs.readFile(output);
    assert.equal(bytes[0], 0xff); assert.equal(bytes[1], 0xd8);
    assert.ok(bytes.length > 10000);
    const previewUrl = await page.locator('#preview').getAttribute('src');
    const previewBytes = await app.evaluate(async ({ net }, url) => {
      const response = await net.fetch(url);
      return Array.from(new Uint8Array(await response.arrayBuffer()));
    }, previewUrl);
    const imageHash = createHash('sha256').update(Buffer.from(previewBytes)).digest('hex');
    assert.equal(createHash('sha256').update(bytes).digest('hex'), imageHash);
    console.log('PASS: native Save dialog route, Unicode output path, exported bytes exactly match selected frame');

    await app.evaluate(({ dialog }, destination) => {
      dialog.showSaveDialog = async () => ({ canceled: false, filePath: destination });
    }, fixture);
    await page.locator('#save').click();
    await page.waitForFunction(() => document.getElementById('notice-text').textContent.includes('original photo safe'));
    assert.equal(createHash('sha256').update(await fs.readFile(fixture)).digest('hex'), sourceHash);
    console.log('PASS: source-overwrite protection through the actual Save UI');

    await app.evaluate(({ dialog }, source) => {
      dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [source] });
    }, corrupted);
    await page.locator('#open').click();
    await page.waitForFunction(() => document.getElementById('notice-text').textContent.includes('Samsung or Google'));
    assert.equal(await page.locator('.thumbnail').count(), 107);
    assert.equal(await page.locator('#save').isDisabled(), false);
    console.log('PASS: corrupt import shows a useful error and preserves the previous photo');

    await app.evaluate(({ dialog }, source) => {
      dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [source] });
    }, output);
    await page.locator('#open').click();
    await page.waitForFunction(() => document.getElementById('kind').textContent === 'STILL PHOTO');
    assert.equal(await page.locator('#save').isDisabled(), true);
    assert.match(await page.locator('#selection-description').innerText(), /no embedded motion/);
    assert.deepEqual(errors, []);
    console.log('PASS: ordinary JPEG loads as a still, no renderer errors');
    console.log(`UI test artifacts: ${directory}`);
  } catch (error) {
    await page.screenshot({ path: path.join(directory, 'failure.png') }).catch(() => {});
    console.error(`UI test failure artifacts: ${directory}`);
    throw error;
  } finally { await app.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
