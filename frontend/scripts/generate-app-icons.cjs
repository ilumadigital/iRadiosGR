#!/usr/bin/env node
// Generate browser, Apple and PWA icons from the single source-of-truth favicon.
// No third-party image-processing dependency is required by the build.
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');

const PUBLIC_DIR = path.resolve(__dirname, '../public');
const SOURCE = path.join(PUBLIC_DIR, 'favicon.png');
const OUTPUT_DIR = path.join(PUBLIC_DIR, 'icons');
const ICON_SIZES = [16, 32, 180, 192, 512];
const PNG_SIGNATURE = Buffer.from('89504e470d0a1a0a', 'hex');

function decodePng(buffer) {
  if (!buffer.subarray(0, 8).equals(PNG_SIGNATURE)) {
    throw new Error(`${SOURCE} must be a PNG`);
  }
  let width, height, bitDepth, colorType, interlace;
  const idat = [];
  for (let offset = 8; offset < buffer.length;) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString('ascii', offset + 4, offset + 8);
    const data = buffer.subarray(offset + 8, offset + 8 + length);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
      interlace = data[12];
    } else if (type === 'IDAT') {
      idat.push(data);
    } else if (type === 'IEND') {
      break;
    }
    offset += length + 12;
  }
  if (!width || !height || bitDepth !== 8 || colorType !== 6 || interlace !== 0) {
    throw new Error('favicon.png must be a non-interlaced 8-bit RGBA PNG');
  }
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = width * 4;
  if (raw.length !== height * (stride + 1)) {
    throw new Error('Invalid PNG scanline length');
  }
  const pixels = Buffer.alloc(height * stride);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    if (filter > 4) throw new Error(`Unsupported PNG row filter ${filter}`);
    const rawStart = y * (stride + 1) + 1;
    const rowStart = y * stride;
    for (let x = 0; x < stride; x++) {
      const a = x >= 4 ? pixels[rowStart + x - 4] : 0;
      const b = y > 0 ? pixels[rowStart - stride + x] : 0;
      const c = y > 0 && x >= 4 ? pixels[rowStart - stride + x - 4] : 0;
      let predictor = 0;
      if (filter === 1) predictor = a;
      if (filter === 2) predictor = b;
      if (filter === 3) predictor = Math.floor((a + b) / 2);
      if (filter === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
        predictor = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      pixels[rowStart + x] = (raw[rawStart + x] + predictor) & 0xff;
    }
  }
  return { width, height, pixels };
}

// Area filtering keeps the 16px/32px icons legible; premultiplied alpha
// prevents dark halos along transparent logo edges.
function resizeSquare({ width, height, pixels }, size) {
  const output = Buffer.alloc(size * size * 4);
  const sx = width / size, sy = height / size;
  for (let y = 0; y < size; y++) {
    const top = y * sy, bottom = (y + 1) * sy;
    for (let x = 0; x < size; x++) {
      const left = x * sx, right = (x + 1) * sx;
      let area = 0, alpha = 0, red = 0, green = 0, blue = 0;
      for (let yy = Math.floor(top); yy < Math.ceil(bottom); yy++) {
        const wy = Math.min(bottom, yy + 1) - Math.max(top, yy);
        if (wy <= 0) continue;
        for (let xx = Math.floor(left); xx < Math.ceil(right); xx++) {
          const wx = Math.min(right, xx + 1) - Math.max(left, xx);
          if (wx <= 0) continue;
          const weight = wx * wy;
          const index = (yy * width + xx) * 4;
          const opaqueWeight = weight * pixels[index + 3] / 255;
          area += weight;
          alpha += opaqueWeight;
          red += opaqueWeight * pixels[index];
          green += opaqueWeight * pixels[index + 1];
          blue += opaqueWeight * pixels[index + 2];
        }
      }
      const dest = (y * size + x) * 4;
      output[dest] = alpha ? Math.round(red / alpha) : 0;
      output[dest + 1] = alpha ? Math.round(green / alpha) : 0;
      output[dest + 2] = alpha ? Math.round(blue / alpha) : 0;
      output[dest + 3] = Math.round(255 * alpha / area);
    }
  }
  return output;
}

function crc32(data) {
  let crc = 0xffffffff;
  for (const value of data) {
    crc ^= value;
    for (let bit = 0; bit < 8; bit++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const name = Buffer.from(type, 'ascii');
  const size = Buffer.alloc(4), checksum = Buffer.alloc(4);
  size.writeUInt32BE(data.length);
  checksum.writeUInt32BE(crc32(Buffer.concat([name, data])));
  return Buffer.concat([size, name, data, checksum]);
}

function encodePng(size, pixels) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const scanlines = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    pixels.copy(scanlines, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  return Buffer.concat([
    PNG_SIGNATURE,
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(scanlines, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const original = decodePng(fs.readFileSync(SOURCE));
fs.mkdirSync(OUTPUT_DIR, { recursive: true });
for (const size of ICON_SIZES) {
  const destination = path.join(OUTPUT_DIR, `icon-${size}.png`);
  fs.writeFileSync(destination, encodePng(size, resizeSquare(original, size)));
  console.log(`Generated ${path.relative(PUBLIC_DIR, destination)} from favicon.png`);
}
