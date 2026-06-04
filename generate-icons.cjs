// Regenerates icon-192.png and icon-512.png using resvg-js + Pacifico TTF
// Run: node generate-icons.cjs
const { Resvg } = require('@resvg/resvg-js');
const fs = require('fs');
const path = require('path');
const fontPath = path.join(__dirname, 'pacifico.ttf');
[192, 512].forEach(size => {
  const r = Math.round(size * 0.195);
  const fontSize = Math.round(size * 0.21);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><rect width="${size}" height="${size}" rx="${r}" fill="#6BAEE0"/><text x="${size/2}" y="${size/2}" text-anchor="middle" dominant-baseline="middle" font-family="Pacifico" font-size="${fontSize}" fill="white">Pantry</text></svg>`;
  const resvg = new Resvg(svg, { font: { fontFiles: [fontPath], loadSystemFonts: false } });
  const buf = resvg.render().asPng();
  fs.writeFileSync(path.join(__dirname, 'public', `icon-${size}.png`), buf);
  console.log(`Wrote icon-${size}.png`);
});
