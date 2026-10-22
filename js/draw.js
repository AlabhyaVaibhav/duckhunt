// Shared drawing helpers and palette for the 256x240 game canvas.
import { W } from './scene.js';

const FONT = '"Press Start 2P", monospace';
export const GREEN = '#80d010';
export const BLUE = '#3cbcfc';
export const WHITE = '#fcfcfc';
export const ORANGE = '#fc7c3c';
export const RED = '#d82800';

export const rand = (a, b) => a + Math.random() * (b - a);
export const pick = arr => arr[Math.floor(Math.random() * arr.length)];

export function text(ctx, s, x, y, color, { size = 8, align = 'left' } = {}) {
  ctx.font = `${size}px ${FONT}`;
  ctx.textAlign = align;
  ctx.textBaseline = 'top';
  ctx.fillStyle = color;
  ctx.fillText(String(s), x, y);
}

export function box(ctx, x, y, w, h, border = WHITE) {
  ctx.fillStyle = '#000';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = border;
  ctx.fillRect(x + 1, y + 1, w - 2, 1);
  ctx.fillRect(x + 1, y + h - 2, w - 2, 1);
  ctx.fillRect(x + 1, y + 1, 1, h - 2);
  ctx.fillRect(x + w - 2, y + 1, 1, h - 2);
}

// A box of centred text lines; `cy` is the box's vertical centre, or its top with { top: true }.
export function centeredBox(ctx, lines, cy, color = WHITE, { top = false, border = WHITE } = {}) {
  const w = Math.max(...lines.map(l => l.length)) * 8 + 16;
  const h = lines.length * 12 + 8;
  const x = Math.round((W - w) / 2), y = Math.round(top ? cy : cy - h / 2);
  box(ctx, x, y, w, h, border);
  lines.forEach((l, i) => text(ctx, l, W / 2, y + 6 + i * 12, color, { align: 'center' }));
  return { x, y, w, h };
}

export function blit(ctx, img, cx, cy) {
  ctx.drawImage(img, Math.round(cx - img.width / 2), Math.round(cy - img.height / 2));
}

// Aliased disc, so shapes stay crisp pixel art.
export function disc(ctx, cx, cy, r, color) {
  ctx.fillStyle = color;
  for (let y = -r; y <= r; y++) {
    const w = Math.floor(Math.sqrt(r * r - y * y));
    ctx.fillRect(Math.round(cx - w), Math.round(cy + y), w * 2 + 1, 1);
  }
}
