import { buildSprites } from './sprites.js';
import { W, H, setViewWidth } from './scene.js';
import { Sfx } from './audio.js';
import { HandGun } from './hand.js';
import { Game, tutorialDone } from './game.js';
import { SharePanel, challengeFromUrl } from './share.js';

const $ = s => document.querySelector(s);
const canvas = $('#game');
const ctx = canvas.getContext('2d');

await document.fonts.load('8px "Press Start 2P"').catch(() => {});
await buildSprites();

const sfx = new Sfx();
const game = new Game(sfx);
const share = new SharePanel();
// While the share panel is up, finger-gun shots shouldn't start a game behind it.
const hand = new HandGun({ width: W, height: H, onFire: (x, y) => { if (!share.visible) game.fire(x, y); } });

// ---- sharing: a friend's link sets a score to beat; game over offers to share ours.
game.challenge = challengeFromUrl();
if (game.challenge) {
  $('#challenge').textContent = `A friend scored ${game.challenge.toLocaleString('en-US')}. Can you beat it?`;
}
game.onGameOver = result => {
  // Wait for the dog's laugh before taking the picture for the score card.
  setTimeout(() => {
    const shot = document.createElement('canvas');
    shot.width = canvas.width; shot.height = canvas.height;
    shot.getContext('2d').drawImage(canvas, 0, 0);
    share.show(result, shot, game.challenge);
  }, 1500);
};

// ---- layout: 240 NES pixels tall, as wide as the screen's shape allows, so
// the game fills the window edge to edge with square pixels.
function fit() {
  setViewWidth(H * window.innerWidth / window.innerHeight);
  if (canvas.width !== W) {
    canvas.width = W;
    game.resize();
    hand.width = W;
  }
  const s = Math.min(window.innerWidth / W, window.innerHeight / H);
  canvas.style.width = `${Math.round(W * s)}px`;
  canvas.style.height = `${Math.round(H * s)}px`;
}
window.addEventListener('resize', fit);
document.addEventListener('fullscreenchange', fit);
fit();

function toggleFullscreen(on = !document.fullscreenElement) {
  if (on && !document.fullscreenElement) document.documentElement.requestFullscreen?.().catch(() => {});
  else if (!on && document.fullscreenElement) document.exitFullscreen?.();
}

// ---- mouse / keyboard fallback
let mouse = null;
let mouseAt = 0;
function toGame(e) {
  const r = canvas.getBoundingClientRect();
  return { x: (e.clientX - r.left) * W / r.width, y: (e.clientY - r.top) * H / r.height };
}
canvas.addEventListener('pointermove', e => { mouse = toGame(e); mouseAt = performance.now(); });
canvas.addEventListener('pointerdown', e => {
  mouse = toGame(e);
  mouseAt = performance.now();
  game.fire(mouse.x, mouse.y);
});

let currentAim = null;
window.addEventListener('keydown', e => {
  if ($('#start').hidden === false) return;
  if (share.visible) {
    if (e.key === 'Escape') share.hide();
    return;
  }
  switch (e.key) {
    case ' ':
      e.preventDefault();
      if (currentAim) game.fire(currentAim.x, currentAim.y);
      break;
    case '1': case 'a': if (game.state === 'title') game.newGame(1); break;
    case '2': case 'b': if (game.state === 'title') game.newGame(2); break;
    case 't': if (game.state === 'title') game.startTutorial(); break;
    case 's': if (game.state === 'tutorial') game.tutorial.skip(); break;
    case 'Escape':
      if (game.state === 'tutorial') game.quitTutorial();
      else if (game.state !== 'title') game.paused = !game.paused;
      break;
    case 'p': if (game.state !== 'title') game.paused = !game.paused; break;
    case 'm': sfx.toggleMute(); break;
    case 'f': toggleFullscreen(); break;
    case 'c': if (hand.ready) $('#cam').hidden = !$('#cam').hidden; break;
  }
});

// ---- start overlay
const startMsg = $('#startMsg');
$('#btnMouse').addEventListener('click', () => {
  sfx.unlock();
  toggleFullscreen(true);
  $('#start').hidden = true;
});
$('#btnHand').addEventListener('click', async () => {
  sfx.unlock();
  toggleFullscreen(true);
  for (const b of document.querySelectorAll('.buttons button')) b.disabled = true;
  try {
    $('#cam').hidden = false;
    await hand.start($('#video'), $('#camOverlay'), s => { startMsg.textContent = s; $('#camStatus').textContent = s; });
    $('#start').hidden = true;
    // First time with the finger gun: practise before the real game.
    if (!tutorialDone()) game.startTutorial();
  } catch (err) {
    console.error(err);
    $('#cam').hidden = true;
    startMsg.textContent = err?.name === 'NotAllowedError'
      ? 'Camera permission denied. Allow it, or play with the mouse.'
      : `Hand tracking failed to start (${err?.message ?? err}). Try the mouse.`;
    for (const b of document.querySelectorAll('.buttons button')) b.disabled = false;
  }
});

// ---- main loop
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
  last = now;

  hand.update(now);
  if (hand.ready && hand.visible) {
    currentAim = { x: hand.x, y: hand.y, armed: hand.cocked && hand.gunPose };
  } else if (mouse && now - mouseAt < 3000) {
    currentAim = { ...mouse, armed: true };
  } else {
    currentAim = null;
  }
  game.setAim(currentAim);
  game.input = {
    hand: hand.ready,
    visible: hand.visible,
    gunPose: hand.gunPose,
    cocked: hand.cocked,
    thumb: hand.thumb,
    cockLevel: hand.cockLevel,
    fireLevel: hand.fireLevel,
  };

  if (hand.ready) {
    // Thumb meter, scale 0..1 of palm length; the marks follow the learned levels.
    $('#meterFill').style.width = `${Math.min(1, hand.visible ? hand.thumb : 0) * 100}%`;
    $('.meter .fire').style.left = `${Math.min(1, hand.fireLevel) * 100}%`;
    $('.meter .cock').style.left = `${Math.min(1, hand.cockLevel) * 100}%`;
    $('#camStatus').textContent = hand.status;
  }

  game.update(dt);
  game.draw(ctx);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
