// Génère les icônes PNG à partir de tools/icon.svg (à relancer seulement si l'icône change).
import sharp from 'sharp';
import { readFileSync, writeFileSync } from 'node:fs';

const svg = readFileSync(new URL('./icon.svg', import.meta.url));
const out = f => new URL('../src/icons/' + f, import.meta.url).pathname;
writeFileSync(out('icon.svg'), svg);
await sharp(svg).resize(192, 192).png().toFile(out('icon-192.png'));
await sharp(svg).resize(512, 512).png().toFile(out('icon-512.png'));
await sharp(svg).resize(180, 180).png().toFile(out('apple-touch-icon.png'));
// Maskable : Android recadre en cercle, on réduit l'assiette dans la zone sûre (80 %).
const inner = await sharp(svg).resize(410, 410).png().toBuffer();
await sharp({ create: { width: 512, height: 512, channels: 4, background: '#dde4fa' } })
  .composite([{ input: inner, top: 51, left: 51 }]).png().toFile(out('icon-maskable-512.png'));
console.log('icônes générées dans src/icons/');
