'use strict';
// electron-builder already extracts unsigned NSIS uninstallers in pure JS on
// macOS. Reuse that same reader on Linux, where its bundled Wine 1.0.1 lacks
// the required Windows DLL layout. This shim is scoped to this build process:
// it never edits dependencies, system Wine, or installer/uninstaller scripts.
// Internal API contract is pinned and must be rechecked on builder upgrades.
if (process.platform === 'linux') {
  const path = require('node:path');
  const assert = require('node:assert/strict');
  const { WineVmManager } = require('app-builder-lib/out/vm/WineVm');
  const { UninstallerReader } = require('app-builder-lib/out/targets/nsis/nsisUtil');
  const pkg = require('../package.json');
  assert.equal(require('app-builder-lib/package.json').version, '26.15.3');
  assert.equal(pkg.build.win.signAndEditExecutable, false, 'reader is for our unsigned build only');
  const original = WineVmManager.prototype.exec;
  WineVmManager.prototype.exec = async function (file, args, options, ...rest) {
    const expected = `Motion-Frame-Setup-${pkg.version}-Windows-x64.exe`;
    if (path.basename(file) !== expected || args?.length || options?.env?.__COMPAT_LAYER !== 'RunAsInvoker') {
      return original.call(this, file, args, options, ...rest);
    }
    const output = path.join(path.dirname(file), `${path.basename(file, 'exe')}__uninstaller.exe`);
    await UninstallerReader.exec(file, output);
    console.log('Generated unsigned NSIS uninstaller with electron-builder’s own binary reader');
    return '';
  };
}
