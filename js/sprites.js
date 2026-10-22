// Sprites. The dog and ducks are the original NES frames (assets/nes, cut by
// tools/extract_nes.py); scenery, HUD icon and logo come from assets/*.png
// (tools/extract.py). The bullet icon is a tiny character grid drawn here.

function toGrid(rows) {
  const w = Math.max(...rows.map(r => r.length));
  return rows.map(r => r.padEnd(w, '.').split(''));
}

function render(g, pal) {
  const c = canvasOf(g[0].length, g.length);
  const ctx = c.getContext('2d');
  g.forEach((row, y) => row.forEach((ch, x) => {
    if (ch === '.') return;
    ctx.fillStyle = pal[ch];
    ctx.fillRect(x, y, 1, 1);
  }));
  return c;
}

function canvasOf(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

function flipX(src) {
  const c = canvasOf(src.width, src.height);
  const ctx = c.getContext('2d');
  ctx.translate(c.width, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(src, 0, 0);
  return c;
}

// Places frames on one canvas size so their head anchors line up.
function alignFrames(imgs, anchors) {
  const ax = Math.max(...anchors.map(a => a[0]));
  const ay = Math.max(...anchors.map(a => a[1]));
  const w = Math.max(...imgs.map((im, i) => ax - anchors[i][0] + im.width));
  const h = Math.max(...imgs.map((im, i) => ay - anchors[i][1] + im.height));
  return imgs.map((im, i) => {
    const c = canvasOf(w, h);
    c.getContext('2d').drawImage(im, ax - anchors[i][0], ay - anchors[i][1]);
    return c;
  });
}

function tint(src, color) {
  const c = canvasOf(src.width, src.height);
  const ctx = c.getContext('2d');
  ctx.drawImage(src, 0, 0);
  ctx.globalCompositeOperation = 'source-in';
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, c.width, c.height);
  return c;
}

function loadImage(path) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load ${path}`));
    img.src = path;
  });
}

const loadAll = async (names, prefix) => Object.fromEntries(
  await Promise.all(names.map(async n => [n, await loadImage(`${prefix}${n}.png`)])));

// ---------------------------------------------------------------- ducks

export const DUCK_KINDS = ['black', 'blue', 'red'];

// Wing cycles go up, level, down, level.
const cycle = ([a, b, c]) => [a, b, c, b];

async function buildDuck(kind, meta) {
  const poses = meta.ducks[kind];
  const load = (pose, n) => Promise.all(
    Array.from({ length: n }, (_, f) => loadImage(`assets/nes/duck_${kind}_${pose}_${f}.png`)));
  const [fly, diag, away, [shot], [fall]] = await Promise.all(
    ['fly', 'diag', 'away', 'shot', 'fall'].map(p => load(p, poses[p])));
  const right = cycle(alignFrames(fly, meta.duckAnchors.fly));
  const diagRight = cycle(alignFrames(diag, meta.duckAnchors.diag));
  return {
    right,
    left: right.map(flipX),
    diagRight,
    diagLeft: diagRight.map(flipX),
    away: cycle(alignFrames(away, meta.duckAnchors.away)),
    shot,
    fall: [fall, flipX(fall)], // alternated, so the duck spins as it drops
  };
}

// ---------------------------------------------------------------- dog

async function buildDog(meta) {
  const img = await loadAll(Object.keys(meta.dog), 'assets/nes/dog_');
  return {
    walk: [img.walk_0, img.walk_1, img.walk_2, img.walk_3],
    sniff: [img.sniff_0, img.walk_3],
    alert: img.alert,
    jump: img.jump,
    dive: img.dive,
    laugh: [img.laugh_0, img.laugh_1],
    hold1: img.hold1,
    hold2: img.hold2,
    // Body centre per pose, so a popup centres on the dog, not on a raised arm.
    cx: Object.fromEntries(Object.entries(meta.dog).map(([k, v]) => [k, v.cx])),
  };
}

// ---------------------------------------------------------------- HUD bits

const BULLET = toGrid([
  '.T.',
  'TTT',
  'BBB',
  'BBB',
  'BBB',
  'BBB',
  'RRR',
]);

export let SPR = null;

export async function buildSprites() {
  const meta = await fetch('assets/nes.json').then(r => r.json());
  const [art, dog, ...ducks] = await Promise.all([
    loadAll(['tree', 'bush', 'grass', 'logo', 'icon'], 'assets/'),
    buildDog(meta),
    ...DUCK_KINDS.map(k => buildDuck(k, meta)),
  ]);
  SPR = {
    art,
    dog,
    ducks: Object.fromEntries(DUCK_KINDS.map((k, i) => [k, ducks[i]])),
    icon: { white: art.icon, red: tint(art.icon, '#f83800') },
    bullet: render(BULLET, { T: '#fcfcfc', B: '#f0a040', R: '#a84000' }),
  };
  return SPR;
}
