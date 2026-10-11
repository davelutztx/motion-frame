'use strict';
const { app, BrowserWindow, dialog, ipcMain, protocol, net, shell, Menu, nativeImage } = require('electron');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { randomUUID } = require('node:crypto');
const { loadMedia, exportFrame } = require('./media.cjs');

protocol.registerSchemesAsPrivileged([{ scheme: 'motion', privileges: { standard: true, secure: true, supportFetchAPI: true } }]);
let window;
let session;
let pending;
let tempRoot;
let lastSaved;
let exiting = false;
const operations = new Set();
function ffmpegPath() {
  if (app.isPackaged) return path.join(process.resourcesPath, 'bin', process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg');
  return process.env.FFMPEG_PATH || require('ffmpeg-static');
}
function trusted(event) {
  if (!window || event.sender !== window.webContents || event.senderFrame !== window.webContents.mainFrame) throw new Error('Untrusted request.');
}
function register(channel, handler) {
  ipcMain.handle(channel, async (event, ...args) => {
    trusted(event);
    try { return { ok: true, value: await handler(...args) }; }
    catch (error) { return { ok: false, error: error.name === 'AbortError' ? 'Loading cancelled.' : error.message }; }
  });
}
function describe(current) {
  const dimensionPath = current.frames[0] || current.original;
  const size = nativeImage.createFromPath(dimensionPath).getSize();
  return {
    id: current.id, name: current.name, kind: current.kind, width: size.width, height: size.height,
    count: current.frames.length, timestamps: current.timestamps,
    presentationSeconds: current.presentationSeconds,
    original: current.original ? `motion://asset/${current.id}/original` : null,
    frames: current.frames.map((_, index) => `motion://asset/${current.id}/${index}`)
  };
}
async function openPhoto(filePath) {
  pending?.abort();
  const controller = new AbortController();
  pending = controller;
  const task = loadMedia(filePath, {
    ffmpeg: ffmpegPath(), tempRoot, signal: controller.signal,
    onProgress: count => {
      if (pending === controller && !window.isDestroyed()) window.webContents.send('photo:progress', count);
    }
  });
  operations.add(task);
  try {
    const loaded = await task;
    if (pending !== controller || controller.signal.aborted) {
      await fs.rm(loaded.dir, { recursive: true, force: true });
      throw new Error('Loading cancelled.');
    }
    loaded.id = randomUUID();
    const old = session;
    session = loaded;
    lastSaved = null;
    // Windows may briefly retain an image read handle; root cleanup retries
    // on exit. A locked old cache must not invalidate a successful new load.
    if (old) await fs.rm(old.dir, { recursive: true, force: true }).catch(() => {});
    return describe(loaded);
  } finally {
    operations.delete(task);
    if (pending === controller) pending = null;
  }
}

app.whenReady().then(async () => {
  app.setAppUserModelId('com.davelutz.motionframe');
  tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'motion-frame-'));
  protocol.handle('motion', async request => {
    try {
      const url = new URL(request.url);
      const [, id, part, extra] = url.pathname.split('/');
      if (url.hostname !== 'asset' || extra || !session || id !== session.id || request.method !== 'GET') return new Response('', { status: 404 });
      const filename = part === 'original' ? session.original : (/^\d+$/.test(part) ? session.frames[Number(part)] : null);
      if (!filename) return new Response('', { status: 404 });
      return net.fetch(pathToFileURL(filename).href);
    } catch { return new Response('', { status: 404 }); }
  });
  Menu.setApplicationMenu(null);
  window = new BrowserWindow({ width: 1240, height: 860, minWidth: 820, minHeight: 650,
    title: 'Motion Frame', backgroundColor: '#101214', show: false,
    icon: path.join(__dirname, 'assets', process.platform === 'win32' ? 'icon.ico' : 'icon.png'),
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, sandbox: true, nodeIntegration: false }
  });
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', event => event.preventDefault());
  window.webContents.session.setPermissionRequestHandler((_wc, _permission, callback) => callback(false));
  window.once('ready-to-show', () => window.show());
  register('photo:choose', async () => {
    const result = await dialog.showOpenDialog(window, {
      title: 'Open a motion photo', properties: ['openFile'],
      filters: [{ name: 'Motion photos and videos', extensions: ['jpg', 'jpeg', 'mp4', 'mov'] }]
    });
    return result.canceled ? null : openPhoto(result.filePaths[0]);
  });
  register('photo:load', filePath => openPhoto(filePath));
  register('photo:cancel', () => { pending?.abort(); });
  register('photo:save', async (id, index) => {
    const current = session;
    if (!current || id !== current.id || pending) throw new Error('Wait for the photo to finish loading.');
    if (!Number.isInteger(index) || index < 0 || index >= current.frames.length) throw new Error('Select a valid frame.');
    const stem = path.parse(current.name).name;
    const result = await dialog.showSaveDialog(window, {
      title: 'Save selected frame',
      defaultPath: path.join(path.dirname(current.sourcePath), `${stem}-frame-${String(index + 1).padStart(3, '0')}.jpg`),
      filters: [{ name: 'JPEG image', extensions: ['jpg'] }], properties: ['showOverwriteConfirmation', 'createDirectory']
    });
    if (result.canceled || !result.filePath) return null;
    if (session !== current || pending) throw new Error('The photo changed. Select a frame and try again.');
    const destination = /\.jpe?g$/i.test(result.filePath) ? result.filePath : `${result.filePath}.jpg`;
    // If we added a suffix, the native dialog did not check this exact path.
    if (destination !== result.filePath) {
      const exists = await fs.stat(destination).then(() => true, () => false);
      if (exists) {
        const choice = await dialog.showMessageBox(window, { type: 'question', buttons: ['Cancel', 'Replace'], defaultId: 0, cancelId: 0, message: `Replace ${path.basename(destination)}?` });
        if (choice.response !== 1) return null;
      }
    }
    lastSaved = await exportFrame(current, index, destination);
    return { name: path.basename(lastSaved), path: lastSaved };
  });
  register('photo:reveal', () => { if (lastSaved) shell.showItemInFolder(lastSaved); });
  await window.loadFile(path.join(__dirname, 'index.html'));
});

app.on('window-all-closed', () => app.quit());
app.on('before-quit', event => {
  if (exiting) return;
  event.preventDefault();
  exiting = true;
  pending?.abort();
  Promise.allSettled([...operations]).then(async () => {
    if (tempRoot) await fs.rm(tempRoot, { recursive: true, force: true }).catch(() => {});
    app.quit();
  });
});
