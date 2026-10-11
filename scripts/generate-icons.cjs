'use strict';
// Editable SVG is the source; resvg renders consistent Windows icon sizes.
const fs = require('node:fs');
const path = require('node:path');
const { Resvg } = require('@resvg/resvg-js');
const { Data } = require('resedit');
const directory = path.resolve(__dirname, '../src/assets');
const svg = fs.readFileSync(path.join(directory, 'icon.svg'));
const ico = new Data.IconFile();
for (const size of [16, 20, 24, 32, 40, 48, 64, 128, 256]) {
  const png = new Resvg(svg, { fitTo: { mode: 'width', value: size } }).render().asPng();
  ico.icons.push({ data: Data.RawIconItem.from(png, size, size, 32) });
}
fs.writeFileSync(path.join(directory, 'icon.ico'), Buffer.from(ico.generate()));
fs.writeFileSync(path.join(directory, 'icon.png'), new Resvg(svg).render().asPng());
console.log('Generated nine-size Windows ICO and 512px PNG from icon.svg');
