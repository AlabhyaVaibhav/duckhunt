// Static scenery, composed once into offscreen canvases at the NES resolution.
// Tree, bush and grass are NES art from the sprite sheet; the dirt is drawn here.

// The view is always 240 NES pixels tall; its width follows the screen's
// aspect ratio (never narrower than the NES's 256) so it fills the screen
// without stretching. W and OX are live bindings updated by setViewWidth.
export const NES_W = 256;
export let W = NES_W;
export let OX = 0; // left edge of a centred 256-wide block, for fixed layouts like the HUD
export const H = 240;

export function setViewWidth(w) {
  W = Math.max(NES_W, Math.round(w));
  OX = Math.round((W - NES_W) / 2);
}
export const GRASS_TIPS = 144; // highest grass blade
export const GRASS_TOP = 158;  // grass is solid below this line
export const DIRT_TOP = 186;

export const SKY = '#64b0ff';
export const SKY_PINK = '#fcbcb0';

function rng(seed) {
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

function layer() {
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  return [c, c.getContext('2d')];
}

// Last row of an image that is (almost) fully opaque, so the strip can sit
// flush on the dirt without a gap of sky showing through.
function lastSolidRow(img) {
  const c = document.createElement('canvas');
  c.width = img.width; c.height = img.height;
  const ctx = c.getContext('2d');
  ctx.drawImage(img, 0, 0);
  const { data } = ctx.getImageData(0, 0, img.width, img.height);
  for (let y = img.height - 1; y >= 0; y--) {
    let opaque = 0;
    for (let x = 0; x < img.width; x++) if (data[(y * img.width + x) * 4 + 3] > 0) opaque++;
    if (opaque > img.width * 0.9) return y;
  }
  return img.height - 1;
}

export function buildBackdrop({ tree, bush }) {
  const [c, ctx] = layer();
  ctx.drawImage(tree, 18, GRASS_TOP + 6 - tree.height);
  ctx.drawImage(bush, W - bush.width - 14, GRASS_TIPS + 18 - bush.height);
  return c;
}

export function buildGround({ grass }) {
  const [c, ctx] = layer();
  const rand = rng(42);

  const top = DIRT_TOP - lastSolidRow(grass) - 1;
  for (let x = 0; x < W; x += grass.width) ctx.drawImage(grass, x, top);

  ctx.fillStyle = '#b0581c';
  ctx.fillRect(0, DIRT_TOP, W, H - DIRT_TOP);
  ctx.fillStyle = '#783008';
  ctx.fillRect(0, DIRT_TOP, W, 1);
  for (let i = 0; i < 260 * W / NES_W; i++) {
    ctx.fillRect(Math.floor(rand() * W), DIRT_TOP + 2 + Math.floor(rand() * (H - DIRT_TOP)), 2, 1);
  }
  return c;
}
