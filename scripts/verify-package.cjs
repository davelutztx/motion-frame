'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { NtExecutable, NtExecutableResource, Data, Resource } = require('resedit');

(async () => {
  const asar = await import('@electron/asar');
  const root = path.resolve(__dirname, '..');
  const directory = path.resolve(process.argv[2] || path.join(root, 'dist', 'win-unpacked'));
  const archive = path.join(directory, 'resources', 'app.asar');
  const hash = bytes => createHash('sha256').update(bytes).digest('hex');
  for (const filename of await fs.readdir(path.join(root, 'src'), { recursive: true })) {
    if (!(await fs.stat(path.join(root, 'src', filename))).isFile()) continue;
    assert.equal(hash(asar.extractFile(archive, `src/${filename.replaceAll(path.sep, '/')}`)), hash(await fs.readFile(path.join(root, 'src', filename))), `packaged ${filename} must match source`);
  }
  const files = asar.listPackage(archive);
  assert.ok(!files.some(name => /\.(jpg|jpeg|mp4|mov)$/i.test(name)), 'no private photos packaged');
  for (const filename of ['Motion Frame.exe', 'resources/bin/ffmpeg.exe']) {
    const bytes = await fs.readFile(path.join(directory, filename));
    assert.equal(bytes.toString('ascii', 0, 2), 'MZ');
    const pe = bytes.readUInt32LE(0x3c);
    assert.equal(bytes.readUInt16LE(pe + 4), 0x8664, `${filename} must be Windows x64`);
  }
  assert.equal(hash(await fs.readFile(path.join(directory, 'resources/bin/ffmpeg.exe'))), hash(await fs.readFile(path.join(root, 'vendor/win/ffmpeg.exe'))));
  for (const filename of ['README.md', 'LICENSE', 'THIRD-PARTY-NOTICES.md', 'LICENSE.electron.txt', 'LICENSES.chromium.html', 'resources/bin/ffmpeg.exe.LICENSE', 'resources/bin/ffmpeg.exe.README']) {
    assert.ok((await fs.stat(path.join(directory, filename))).size > 0, `${filename} included`);
  }
  const expectedIcon = Data.IconFile.from(await fs.readFile(path.join(root, 'src/assets/icon.ico')));
  assert.deepEqual(expectedIcon.icons.map(icon => icon.data.width), [16, 20, 24, 32, 40, 48, 64, 128, 256]);
  const pkg = require('../package.json');
  const packaged = JSON.parse(asar.extractFile(archive, 'package.json'));
  assert.equal(packaged.version, pkg.version);
  assert.equal(packaged.license, 'MIT');
  assert.equal(hash(asar.extractFile(archive, 'LICENSE')), hash(await fs.readFile(path.join(root, 'LICENSE'))));
  assert.equal(hash(await fs.readFile(path.join(directory, 'LICENSE'))), hash(await fs.readFile(path.join(root, 'LICENSE'))));
  const resources = NtExecutableResource.from(NtExecutable.from(await fs.readFile(path.join(directory, 'Motion Frame.exe'))));
  const groups = Resource.IconGroupEntry.fromEntries(resources.entries);
  assert.equal(groups.length, 1, 'Electron icons replaced');
  const actualIcons = groups[0].getIconItemsFromEntries(resources.entries);
  assert.deepEqual(actualIcons.map(icon => hash(Buffer.from(icon.bin))), expectedIcon.icons.map(icon => hash(Buffer.from(icon.data.bin))), 'embedded icons match source at every size');
  const version = Resource.VersionInfo.fromEntries(resources.entries)[0].getStringValues({ lang: 1033, codepage: 1200 });
  assert.equal(version.ProductName, 'Motion Frame');
  assert.equal(version.FileVersion, `${pkg.version}.0`);
  const installerPath = process.argv[3];
  if (installerPath) {
    const setup = await fs.readFile(installerPath);
    assert.equal(setup.toString('ascii', 0, 2), 'MZ');
    const installerResources = NtExecutableResource.from(NtExecutable.from(setup));
    const installerGroups = Resource.IconGroupEntry.fromEntries(installerResources.entries);
    assert.ok(installerGroups.some(group => group.getIconItemsFromEntries(installerResources.entries).some(icon => hash(Buffer.from(icon.bin)) === hash(Buffer.from(expectedIcon.icons.at(-1).data.bin)))), 'setup includes our 256px icon');
    console.log('PASS: NSIS installer PE and custom icon');
  }
  console.log('PASS: nine embedded app icon sizes and Motion Frame version metadata');
  console.log('PASS: Windows x64 Electron and FFmpeg binaries; packaged source matches; licenses and quick start included; no personal photos');
})().catch(error => { console.error(error); process.exitCode = 1; });
