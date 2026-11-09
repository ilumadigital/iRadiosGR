import { parseMusicMetadata } from './musicMetadata';

export const STORY_SIZE = Object.freeze({ width: 1080, height: 1920 });
const ACCENT = '#ccff00';

// All entry points use the same validated track metadata and artwork priority.
// Never label a live show, loading hint or advertisement as a recognized song.
export function resolveStoryContent({ station, nowPlaying, artworkUrl, show, showImageUrl } = {}) {
  const track = parseMusicMetadata(nowPlaying, station?.name);
  const showTitle = show?.title || show?.name || '';
  const showHost = show?.host || show?.producer || '';
  const imageCandidates = [
    ...(track && artworkUrl ? [artworkUrl] : []),
    showImageUrl || show?.imageUrl || show?.image || '',
    station?.logo || ''
  ].filter(Boolean);
  return {
    title: track?.title || showTitle || station?.name || 'Ζωντανό ραδιόφωνο',
    subtitle: track?.artist || showHost || station?.slogan || 'Ζωντανά στο iRadiosGR',
    stationName: station?.name || 'iRadiosGR',
    category: station?.genre || station?.category || station?.secondaryGenre || 'Radio',
    label: track ? 'NOW PLAYING' : (showTitle ? 'ON AIR NOW' : 'LIVE RADIO'),
    stationLogo: station?.logo || '',
    imageCandidates
  };
}

function rounded(ctx, x, y, width, height, radius) {
  const r = Math.max(0, Math.min(radius, width / 2, height / 2));
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

function imageUrl(source) {
  if (typeof source !== 'string' || !source.trim()) return '';
  try {
    const url = new URL(source.trim(), window.location.origin);
    return /^https?:$/.test(url.protocol) ? url.href : '';
  } catch {
    return '';
  }
}

function loadOne(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    let complete = false;
    const finish = (error) => {
      if (complete) return;
      complete = true;
      clearTimeout(timer);
      image.onload = null;
      image.onerror = null;
      error ? reject(error) : resolve(image);
    };
    const timer = setTimeout(() => finish(new Error('Image load timed out')), 6500);
    image.onload = () => finish();
    image.onerror = () => finish(new Error('Image unavailable'));
    image.src = url;
  });
}

// Try normal CORS first; only remote public images may use a CORS image proxy.
// Missing artwork/branding never blocks Story generation.
async function loadImage(source) {
  const url = imageUrl(source);
  if (!url) return null;
  try {
    return await loadOne(url);
  } catch {
    if (new URL(url).origin === window.location.origin) return null;
    try {
      const proxy = 'https://images.weserv.nl/?url=' + encodeURIComponent(url);
      return await loadOne(proxy);
    } catch {
      return null;
    }
  }
}

async function firstAvailable(sources) {
  for (const source of sources) {
    const result = await loadImage(source);
    if (result) return result;
  }
  return null;
}

function cover(ctx, image, x, y, width, height) {
  if (!image) return;
  const scale = Math.max(width / image.width, height / image.height);
  const dw = image.width * scale;
  const dh = image.height * scale;
  ctx.drawImage(image, x + (width - dw) / 2, y + (height - dh) / 2, dw, dh);
}

function contain(ctx, image, x, y, width, height) {
  if (!image) return;
  const scale = Math.min(width / image.width, height / image.height);
  const dw = image.width * scale;
  const dh = image.height * scale;
  ctx.drawImage(image, x + (width - dw) / 2, y + (height - dh) / 2, dw, dh);
}

// Match the ambient accent used by the mobile station logo frame. Use the
// already-loaded, CORS-safe image; if pixel reading is disallowed, keep the
// same deterministic neutral-lime fallback as useStationAmbient.
function stationLogoAccent(image) {
  const fallback = [134, 165, 56];
  if (!image) return fallback;
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 32;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) return fallback;
    context.drawImage(image, 0, 0, 32, 32);
    const { data } = context.getImageData(0, 0, 32, 32);
    let best = null;
    let strength = 0;
    for (let i = 0; i < data.length; i += 4) {
      const [r, g, b, a] = data.slice(i, i + 4);
      if (a < 210) continue;
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const chroma = max - min;
      const lum = (r + g + b) / 3;
      if (chroma < 32 || lum < 42 || lum > 223) continue;
      const score = chroma * (1 - Math.abs(138 - lum) / 240);
      if (score > strength) {
        strength = score;
        best = [r, g, b];
      }
    }
    return best ? best.map(value => Math.max(55, Math.min(210, value))) : fallback;
  } catch {
    return fallback;
  }
}

function textLines(ctx, value, maxWidth, maxLines) {
  const tokens = String(value || '').trim().split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  for (const word of tokens) {
    const candidate = line ? line + ' ' + word : word;
    if (ctx.measureText(candidate).width <= maxWidth || !line) {
      line = candidate;
    } else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  const limited = lines.slice(0, maxLines);
  if (lines.length > maxLines && limited.length) {
    let last = limited[limited.length - 1];
    while (last.length > 1 && ctx.measureText(last + '…').width > maxWidth) last = last.slice(0, -1);
    limited[limited.length - 1] = last.trim() + '…';
  }
  return limited;
}

function multiline(ctx, value, x, y, maxWidth, maxLines, fontSize, lineHeight) {
  let lines = [];
  let size = fontSize;
  do {
    ctx.font = '800 ' + size + 'px system-ui, sans-serif';
    lines = textLines(ctx, value, maxWidth, maxLines);
    if (lines.every(line => ctx.measureText(line).width <= maxWidth)) break;
    size -= 3;
  } while (size > 40);
  lines.forEach((line, index) => ctx.fillText(line, x, y + index * lineHeight));
  return y + (lines.length - 1) * lineHeight;
}

export async function generateStationStory({ station, nowPlaying, artworkUrl, show, showImageUrl } = {}) {
  if (!station?.name) throw new Error('Δεν βρέθηκε ο σταθμός.');
  const data = resolveStoryContent({ station, nowPlaying, artworkUrl, show, showImageUrl });
  const canvas = document.createElement('canvas');
  canvas.width = STORY_SIZE.width;
  canvas.height = STORY_SIZE.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Ο browser δεν υποστηρίζει δημιουργία Story.');

  const [mainImage, stationLogo, brandLogo] = await Promise.all([
    firstAvailable(data.imageCandidates),
    loadImage(data.stationLogo),
    loadImage('/iradios-app-logo.png')
  ]);
  const background = ctx.createLinearGradient(0, 0, 1080, 1920);
  background.addColorStop(0, '#122027');
  background.addColorStop(0.54, '#0b121a');
  background.addColorStop(1, '#030509');
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, 1080, 1920);

  if (mainImage) {
    ctx.save();
    ctx.globalAlpha = 0.23;
    ctx.filter = 'blur(92px) saturate(130%)';
    cover(ctx, mainImage, -170, 170, 1420, 1480);
    ctx.restore();
  }
  const veil = ctx.createLinearGradient(0, 0, 0, 1920);
  veil.addColorStop(0, 'rgba(0,0,0,.18)');
  veil.addColorStop(0.55, 'rgba(0,0,0,.04)');
  veil.addColorStop(1, 'rgba(0,0,0,.70)');
  ctx.fillStyle = veil;
  ctx.fillRect(0, 0, 1080, 1920);

  // Logos sit below Instagram's top overlays, with safe edge spacing.
  if (brandLogo) {
    contain(ctx, brandLogo, 82, 206, 330, 120);
  } else {
    ctx.textAlign = 'left';
    ctx.fillStyle = '#ffffff';
    ctx.font = '800 57px system-ui, sans-serif';
    ctx.fillText('iRadios', 88, 290);
    ctx.fillStyle = ACCENT;
    ctx.fillText('GR', 294, 290);
  }
  // Match .ir-mobile-station-logo-frame: the image itself is clipped to a
  // 20px-equivalent radius, with its station-derived border and soft glow.
  // No gray outer square, inset white padding or extra logo container.
  const [accentR, accentG, accentB] = stationLogoAccent(stationLogo);
  const accent = `${accentR},${accentG},${accentB}`;
  const logoX = 846, logoY = 208, logoSize = 148, logoRadius = 25;
  ctx.save();
  ctx.shadowColor = `rgba(${accent},.32)`;
  ctx.shadowBlur = 42;
  rounded(ctx, logoX, logoY, logoSize, logoSize, logoRadius);
  ctx.fillStyle = `rgba(${accent},.64)`;
  ctx.fill();
  ctx.restore();
  ctx.save();
  rounded(ctx, logoX, logoY, logoSize, logoSize, logoRadius);
  ctx.clip();
  if (stationLogo) {
    contain(ctx, stationLogo, logoX, logoY, logoSize, logoSize);
  } else {
    ctx.textAlign = 'center';
    ctx.font = '800 40px system-ui, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(data.stationName.slice(0, 3).toUpperCase(), logoX + logoSize / 2, logoY + 90);
  }
  ctx.restore();
  ctx.save();
  ctx.lineWidth = 3;
  ctx.strokeStyle = `rgba(${accent},.95)`;
  rounded(ctx, logoX + 1.5, logoY + 1.5, logoSize - 3, logoSize - 3, logoRadius);
  ctx.stroke();
  ctx.restore();

  // Compact overlapping status pill, as on the mobile Station Profile.
  const offline = station.isOffline === true;
  const badgeWidth = offline ? 104 : 86;
  const badgeX = logoX + (logoSize - badgeWidth) / 2;
  const badgeY = logoY + logoSize - 10;
  ctx.save();
  ctx.shadowColor = offline ? 'transparent' : 'rgba(204,255,0,.28)';
  ctx.shadowBlur = offline ? 0 : 14;
  rounded(ctx, badgeX, badgeY, badgeWidth, 29, 15);
  ctx.fillStyle = offline ? '#cc3434' : ACCENT;
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = offline ? '#ffffff' : '#111b00';
  ctx.beginPath();
  ctx.arc(badgeX + 14, badgeY + 14.5, 3.5, 0, 2 * Math.PI);
  ctx.fill();
  ctx.font = '900 16px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(offline ? 'OFFLINE' : 'LIVE', badgeX + badgeWidth / 2 + 5, badgeY + 20);

  ctx.textAlign = 'left';
  ctx.font = '800 30px system-ui, sans-serif';
  ctx.fillStyle = ACCENT;
  ctx.fillRect(91, 395, 8, 45);
  ctx.fillText(data.label, 123, 431);

  // Prominent square artwork. Show image and station logo are supported fallbacks.
  ctx.save();
  ctx.shadowBlur = 76;
  ctx.shadowColor = 'rgba(204,255,0,.22)';
  rounded(ctx, 107, 480, 866, 866, 48);
  ctx.fillStyle = '#17202a';
  ctx.fill();
  ctx.restore();
  ctx.save();
  rounded(ctx, 107, 480, 866, 866, 48);
  ctx.clip();
  if (mainImage) contain(ctx, mainImage, 107, 480, 866, 866);
  else {
    ctx.fillStyle = '#18242f';
    ctx.fillRect(107, 480, 866, 866);
    ctx.textAlign = 'center';
    ctx.font = '900 102px system-ui, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText('iRadiosGR', 540, 955);
  }
  ctx.restore();
  ctx.save();
  rounded(ctx, 107, 480, 866, 866, 48);
  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(255,255,255,.24)';
  ctx.stroke();
  ctx.restore();

  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffffff';
  const lastTitleY = multiline(ctx, data.title, 540, 1460, 900, 2, 78, 88);
  ctx.font = '500 44px system-ui, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,.76)';
  const subtitle = data.subtitle.length > 46 ? data.subtitle.slice(0, 45) + '…' : data.subtitle;
  ctx.fillText(subtitle, 540, Math.min(lastTitleY + 76, 1610), 900);

  ctx.fillStyle = ACCENT;
  ctx.fillRect(126, 1685, 828, 3);
  ctx.fillStyle = '#ffffff';
  ctx.font = '800 46px system-ui, sans-serif';
  ctx.fillText(data.stationName, 540, 1750, 900);
  ctx.font = '600 31px system-ui, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,.65)';
  ctx.fillText(data.category, 540, 1800, 900);

  ctx.fillStyle = 'rgba(255,255,255,.36)';
  ctx.font = '500 22px system-ui, sans-serif';
  ctx.fillText('Powered by ILUMA Digital Agency', 540, 1860);

  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob(value => value ? resolve(value) : reject(new Error('Αποτυχία εξαγωγής εικόνας.')), 'image/png');
  });
  const slug = String(station.slug || station._id || 'radio').replace(/[^a-zA-Z0-9_-]/g, '-');
  return new File([blob], 'iradios-story-' + slug + '.png', { type: 'image/png' });
}

export function downloadStory(file) {
  const url = URL.createObjectURL(file);
  const link = document.createElement('a');
  link.href = url;
  link.download = file.name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Safari may start saving after the click handler ends.
  setTimeout(() => URL.revokeObjectURL(url), 45000);
}

export async function shareStationStory(file, stationName) {
  if (typeof navigator.share === 'function' && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({
        files: [file],
        title: 'iRadiosGR Story',
        text: 'Ακούω ' + stationName + ' στο iRadiosGR'
      });
      return 'shared';
    } catch (error) {
      if (error?.name === 'AbortError') return 'cancelled';
      // Share API can fail after async canvas work (Safari user activation).
      // Always offer a real image rather than silently doing nothing.
    }
  }
  downloadStory(file);
  return 'downloaded';
}
