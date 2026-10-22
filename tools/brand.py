# brand.py path/to/PressStart2P-Regular.ttf
# Builds the favicons (into the site root and assets/icons/) and the X/Twitter
# images (into brand/) from the game's own sprites. Everything is drawn at NES
# scale and blown up with nearest-neighbour, so every pixel stays square.
# Run from the repo root; needs Pillow.
import json, os, random, sys
from PIL import Image, ImageDraw, ImageFont

sys.path.insert(0, os.path.dirname(__file__))
from pixelhand import hand  # noqa: E402

FONT = sys.argv[1]
A = 'assets'
os.makedirs('brand', exist_ok=True)
os.makedirs(f'{A}/icons', exist_ok=True)

SKY = (100, 176, 255)
DIRT = (176, 88, 28)
DIRT_DARK = (120, 48, 8)
WHITE = (252, 252, 252)
BLACK = (0, 0, 0)
ORANGE = (252, 124, 60)
BLUE = (60, 188, 252)
GREEN = (128, 208, 16)
URL = 'duckhunt-two.vercel.app'


def img(name):
    return Image.open(f'{A}/{name}.png').convert('RGBA')


def up(im, k):
    return im.resize((im.width * k, im.height * k), Image.NEAREST)


def flip(im):
    return im.transpose(Image.FLIP_LEFT_RIGHT)


def canvas(w, h, color=SKY):
    return Image.new('RGBA', (w, h), color + (255,))


def text(im, s, x, y, color, size=8, anchor='la', shadow=True):
    d = ImageDraw.Draw(im)
    d.fontmode = '1'  # no anti-aliasing: crisp pixels once scaled
    f = ImageFont.truetype(FONT, size)
    if shadow:
        d.text((x + max(1, size // 8), y + max(1, size // 8)), s, font=f, fill=BLACK, anchor=anchor)
    d.text((x, y), s, font=f, fill=color, anchor=anchor)


def ground(im, dirt_top, seed=7):
    """Grass strip sitting on dirt, like the game."""
    w, h = im.size
    d = ImageDraw.Draw(im)
    d.rectangle([0, dirt_top, w, h], fill=DIRT)
    d.rectangle([0, dirt_top, w, dirt_top], fill=DIRT_DARK)
    rnd = random.Random(seed)
    for _ in range(w * (h - dirt_top) // 40):
        x, y = rnd.randrange(w), rnd.randrange(dirt_top + 2, h)
        d.rectangle([x, y, x + 1, y], fill=DIRT_DARK)
    grass = img('grass')
    # Sit the strip's last (almost) fully opaque row on the dirt line, as scene.js does.
    alpha = grass.getchannel('A').load()
    solid = max(y for y in range(grass.height)
                if sum(alpha[x, y] > 0 for x in range(grass.width)) > grass.width * 0.9)
    top = dirt_top - solid - 1
    for x in range(0, w, grass.width):
        im.alpha_composite(grass, (x, top))
    d.rectangle([0, dirt_top, w, dirt_top], fill=DIRT_DARK)
    return top


def crosshair(im, cx, cy, color=WHITE):
    d = ImageDraw.Draw(im)
    for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        for k in range(3, 8):
            x, y = cx + dx * k, cy + dy * k
            d.rectangle([x - 1, y - 1, x + 1, y + 1], fill=BLACK)
    for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        for k in range(3, 8):
            d.point((cx + dx * k, cy + dy * k), fill=color)
    d.point((cx, cy), fill=color)


def put(im, sprite, x, y):
    im.alpha_composite(sprite, (int(x), int(y)))


def save(im, path, k=1):
    up(im, k).convert('RGB').save(path, optimize=True)
    print(path, up(im, k).size)


meta = json.load(open(f'{A}/nes.json'))
SHOT = img('nes/duck_black_shot_0')
FALL = img('nes/duck_black_fall_0')
FLY = [img(f'nes/duck_black_fly_{i}') for i in range(3)]
BLUE_DIAG = img('nes/duck_blue_diag_1')
RED_FLY = img('nes/duck_red_fly_0')
DOG_HOLD1, DOG_HOLD2 = img('nes/dog_hold1'), img('nes/dog_hold2')
LOGO, TREE, BUSH = img('logo'), img('tree'), img('bush')
HAND_UP, HAND_DOWN = hand(True), hand(False)


# ---------------------------------------------------------------- favicons
# The mark: the startled black duck from the moment it's hit, on NES sky.

def mark(size, pad, radius=0):
    im = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    ImageDraw.Draw(im).rounded_rectangle([0, 0, size - 1, size - 1], radius=radius, fill=SKY + (255,))
    k = (size - 2 * pad) // max(SHOT.size)
    s = up(SHOT, k)
    im.alpha_composite(s, ((size - s.width) // 2, (size - s.height) // 2 + (1 if size <= 32 else 0)))
    return im


def head16():
    # The duck's head and beak only: the whole bird is unreadable at 16px.
    im = Image.new('RGBA', (16, 16), (0, 0, 0, 0))
    ImageDraw.Draw(im).rounded_rectangle([0, 0, 15, 15], radius=2, fill=SKY + (255,))
    im.alpha_composite(SHOT.crop((12, 0, 28, 16)), (0, 1))
    return im


fav32 = mark(32, 1, radius=4)
fav16 = head16()
fav16.save('favicon.ico', sizes=[(16, 16), (32, 32)], append_images=[fav32])
fav32.save(f'{A}/icons/favicon-32.png')
fav16.save(f'{A}/icons/favicon-16.png')
mark(180, 15).convert('RGB').save(f'{A}/icons/apple-touch-icon.png')  # iOS rounds the corners itself
mark(192, 16, radius=24).save(f'{A}/icons/icon-192.png')
mark(512, 46, radius=64).save(f'{A}/icons/icon-512.png')

# Vector favicon: the 32px mark as one path per colour.
px, by_color = fav32.load(), {}
for y in range(32):
    for x in range(32):
        r, g, b, a = px[x, y]
        if a:
            by_color.setdefault('#%02x%02x%02x' % (r, g, b), []).append(f'M{x} {y}h1v1h-1z')
svg = ['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" shape-rendering="crispEdges">']
svg += [f'<path fill="{c}" d="{"".join(p)}"/>' for c, p in by_color.items()]
open('favicon.svg', 'w').write('\n'.join(svg + ['</svg>']) + '\n')
print('favicon.ico, favicon.svg, assets/icons/*')


# ---------------------------------------------------------------- X avatar (400x400)
# Circle-safe: the duck sits centred with crosshair ticks inside the circle.

av = canvas(40, 40)
put(av, SHOT, 5, 6)
d = ImageDraw.Draw(av)
for x0, y0, x1, y1 in ((3, 19, 6, 20), (33, 19, 36, 20), (19, 3, 20, 6), (19, 33, 20, 36)):
    d.rectangle([x0 - 1, y0 - 1, x1 + 1, y1 + 1], fill=BLACK)
    d.rectangle([x0, y0, x1, y1], fill=WHITE)
save(av, 'brand/x-avatar-400.png', 10)


# ---------------------------------------------------------------- X header (1500x500)
# X lays the avatar over the bottom-left, so the left edge is just scenery.

hd = canvas(750, 250)
put(hd, BUSH, 690, 150)
put(hd, TREE, 22, 222 + 6 - TREE.height)
put(hd, DOG_HOLD2, 560, 158)
ground(hd, 222)
put(hd, LOGO, 168, 12)
text(hd, 'FINGER GUN', 274, 134, ORANGE, 16, 'ma')
text(hd, 'SHOOT DUCKS WITH YOUR HAND', 274, 160, WHITE, 8, 'ma')
put(hd, up(HAND_UP, 2), 418, 84)
put(hd, BLUE_DIAG, 520, 26)
put(hd, SHOT, 640, 52)
crosshair(hd, 655, 66)
put(hd, flip(RED_FLY), 700, 112)
text(hd, URL, 742, 234, WHITE, 8, 'ra')
save(hd, 'brand/x-header-1500x500.png', 2)


# ---------------------------------------------------------------- launch post (1600x900)

lp = canvas(400, 225)
put(lp, TREE, 8, 196 + 6 - TREE.height)
put(lp, BUSH, 350, 128)
ground(lp, 196)
put(lp, LOGO, 94, 6)
text(lp, 'FINGER GUN', 200, 120, ORANGE, 16, 'ma')
text(lp, 'NO CONTROLLER. JUST YOUR HAND.', 200, 144, WHITE, 8, 'ma')
put(lp, BLUE_DIAG, 318, 24)
put(lp, SHOT, 330, 76)
crosshair(lp, 345, 90)
put(lp, up(HAND_UP, 3), 4, 152)
text(lp, f'PLAY FREE: {URL}', 392, 208, WHITE, 8, 'ra')
save(lp, 'brand/x-post-launch-1600x900.png', 4)


# ---------------------------------------------------------------- how-to post (1600x900)

ht = canvas(400, 225, BLACK)
text(ht, 'HOW TO PLAY', 200, 12, BLUE, 16, 'ma')
panels = [
    ('1', ['MAKE A', 'FINGER GUN'], 'pose'),
    ('2', ['POINT AT', 'THE DUCK'], 'aim'),
    ('3', ['DROP THUMB', 'TO SHOOT'], 'fire'),
]
for i, (num, caption, kind) in enumerate(panels):
    x0, y0, w, h = 10 + i * 130, 40, 120, 150
    d = ImageDraw.Draw(ht)
    d.rectangle([x0, y0, x0 + w - 1, y0 + h - 1], fill=WHITE)
    d.rectangle([x0 + 2, y0 + 2, x0 + w - 3, y0 + h - 3], fill=BLACK)
    scene = canvas(w - 8, 96)
    ground(scene, 86, seed=i)
    if kind == 'pose':
        put(scene, up(HAND_UP, 2), 24, 30)
    elif kind == 'aim':
        put(scene, FLY[0], 72, 10)
        crosshair(scene, 86, 22)
        put(scene, up(HAND_UP, 2), 4, 46)
    else:
        put(scene, SHOT, 72, 6)
        put(scene, up(HAND_DOWN, 2), 4, 46)
        text(scene, 'BANG!', 70, 42, ORANGE, 8)
    put(ht, scene, x0 + 4, y0 + 4)
    text(ht, num, x0 + 10, y0 + 108, GREEN, 16)
    text(ht, caption[0], x0 + 34, y0 + 108, WHITE, 8)
    text(ht, caption[1], x0 + 34, y0 + 122, WHITE, 8)
text(ht, f'PLAY FREE: {URL}', 200, 204, ORANGE, 8, 'ma')
save(ht, 'brand/x-post-howto-1600x900.png', 4)


# ---------------------------------------------------------------- animated post (640x360 GIF)
# A duck flies up, the crosshair follows, the thumb drops, NES flash, the duck
# falls and the dog shows it off. Loops.

GW, GH, DIRT_TOP, K, FPS = 320, 180, 160, 2, 15
bg = canvas(GW, GH)
put(bg, TREE, 14, DIRT_TOP + 6 - TREE.height)
put(bg, BUSH, 262, 96)
fg = Image.new('RGBA', (GW, GH), (0, 0, 0, 0))
grass_top = ground(fg, DIRT_TOP)
fg = fg.crop((0, grass_top, GW, GH))


def lerp(a, b, t):
    return a + (b - a) * max(0, min(1, t))


frames = []
fly_cycle = [0, 1, 2, 1]
T_SHOT, T_FALL, T_LAND, T_DOG, T_END = 1.8, 2.3, 3.0, 3.1, 4.6
for f in range(int(T_END * FPS)):
    t = f / FPS
    im = bg.copy()
    flash = T_SHOT <= t < T_SHOT + 2 / FPS
    # duck path: rises from the grass, banks right
    dx, dy = lerp(90, 210, t / T_SHOT), lerp(150, 50, t / T_SHOT)
    if t < T_SHOT:
        duck = FLY[fly_cycle[f % 4]]
    elif t < T_FALL:
        duck = SHOT
    else:
        duck = FALL if (f // 2) % 2 else flip(FALL)
        dy = lerp(50, 150, (t - T_FALL) / (T_LAND - T_FALL))
    if t < T_LAND:
        put(im, duck, dx - duck.width // 2, dy - duck.height // 2)
    if t >= T_DOG:  # dog rises, holds, sinks
        p = t - T_DOG
        rise = min(1, p / 0.3) if p < 1.1 else max(0, 1 - (p - 1.1) / 0.3)
        put(im, DOG_HOLD1, dx - 15, grass_top + 6 - DOG_HOLD1.height * 0.85 * rise)
    im.alpha_composite(fg, (0, grass_top))
    if T_SHOT + 2 / FPS <= t < T_SHOT + 0.9:
        text(im, '500', dx, dy - 26, WHITE, 8, 'ma')
    # crosshair trails the duck until the shot
    if t < T_SHOT + 0.4:
        lag = 0.25
        cx, cy = lerp(60, 210, (t - lag) / (T_SHOT - lag)), lerp(110, 50, (t - lag) / (T_SHOT - lag))
        crosshair(im, int(cx), int(cy))
    thumb_down = T_SHOT - 1 / FPS <= t < T_SHOT + 0.35
    put(im, up(HAND_DOWN if thumb_down else HAND_UP, 2), 6, GH - 46)
    text(im, 'DUCK HUNT: FINGER GUN', GW - 6, 6, WHITE, 8, 'ra')
    text(im, URL, GW - 6, GH - 12, WHITE, 8, 'ra')
    if flash:
        # The Zapper's trick: black screen, white box where each duck is.
        im = canvas(GW, GH, BLACK)
        ImageDraw.Draw(im).rectangle([dx - 14, dy - 13, dx + 14, dy + 13], fill=WHITE)
    frames.append(up(im, K).convert('RGB').quantize(colors=64, method=Image.Quantize.MEDIANCUT))
frames[0].save('brand/x-post-shot.gif', save_all=True, append_images=frames[1:],
               duration=int(1000 / FPS), loop=0, optimize=True, disposal=1)
print('brand/x-post-shot.gif', frames[0].size, len(frames), 'frames')
