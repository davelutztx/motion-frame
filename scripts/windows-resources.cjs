'use strict';
// Resource editing through resedit works on Linux without Wine. Only the
// intermediate unsigned app is modified, before NSIS/ZIP packaging.
const fs = require('node:fs/promises');
const path = require('node:path');
const { NtExecutable, NtExecutableResource, Data, Resource } = require('resedit');
module.exports = async context => {
  if (context.electronPlatformName !== 'win32') return;
  const pkg = require('../package.json');
  const executablePath = path.join(context.appOutDir, `${pkg.productName}.exe`);
  const executable = NtExecutable.from(await fs.readFile(executablePath));
  const resources = NtExecutableResource.from(executable);
  const icons = Data.IconFile.from(await fs.readFile(path.resolve(__dirname, '../src/assets/icon.ico')));
  // Remove Electron's default icons, including every language variant.
  resources.entries = resources.entries.filter(entry => entry.type !== 3 && entry.type !== 14);
  Resource.IconGroupEntry.replaceIconsForResource(resources.entries, 1, 1033, icons.icons.map(icon => icon.data));
  const versions = Resource.VersionInfo.fromEntries(resources.entries);
  if (!versions.length) throw new Error('Missing Electron version resource');
  for (const info of versions) {
    info.setFileVersion(`${pkg.version}.0`, 1033);
    info.setProductVersion(`${pkg.version}.0`, 1033);
    info.setStringValues({ lang: 1033, codepage: 1200 }, {
      CompanyName: pkg.author, FileDescription: pkg.productName,
      ProductName: pkg.productName, InternalName: pkg.name,
      OriginalFilename: `${pkg.productName}.exe`, LegalCopyright: `Copyright © 2026 ${pkg.author}`
    });
    info.outputToResourceEntries(resources.entries);
  }
  resources.outputResource(executable);
  await fs.writeFile(executablePath, Buffer.from(executable.generate()));
  console.log('Embedded Motion Frame icon and version metadata in Windows executable');
};
