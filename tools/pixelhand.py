# Pixel-art finger-gun hands (NES palette), shared by tools/brand.py.
from PIL import Image

SKIN = (252, 188, 148)
SHADE = (228, 128, 92)
INK = (0, 0, 0)
NAIL = (252, 228, 212)
CUFF = (60, 188, 252)
CUFF_DARK = (0, 112, 236)


def hand(thumb_up=True):
    """A right hand pointing right as a finger gun: 32x20, transparent background."""
    w, h = 32, 20
    mask = [[0] * w for _ in range(h)]

    def fill(x0, y0, x1, y1, v=1):
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                mask[y][x] = v

    fill(4, 6, 15, 18)        # palm and curled fingers
    fill(15, 6, 29, 11)       # index finger
    mask[6][29] = mask[11][29] = 0  # round the fingertip
    if thumb_up:
        fill(9, 0, 14, 6)     # thumb raised: the hammer is cocked
        mask[0][9] = mask[0][14] = 0
    else:
        fill(9, 2, 21, 6)     # thumb dropped onto the index finger: fire
        mask[2][9] = mask[2][21] = 0
    fill(0, 6, 4, 19, 2)      # sleeve cuff

    im = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    px = im.load()
    for y in range(h):
        for x in range(w):
            v = mask[y][x]
            if not v:
                continue
            edge = any(not (0 <= x + dx < w and 0 <= y + dy < h) or mask[y + dy][x + dx] == 0
                       for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))
            px[x, y] = INK + (255,) if edge else (CUFF if v == 2 else SKIN) + (255,)
    # sleeve detail
    for y in range(7, 19):
        px[2, y] = CUFF_DARK + (255,)
    # curled fingers: knuckle creases and shading
    for y in (11, 14, 17):
        for x in range(9, 15):
            px[x, y] = INK + (255,)
    for y in (12, 15):
        for x in range(10, 15):
            px[x, y] = SHADE + (255,)
    px[15, 11] = px[15, 14] = INK + (255,)
    # index finger: underside shade, knuckle line, nail
    for x in range(16, 28):
        px[x, 10] = SHADE + (255,)
    px[22, 8] = px[22, 9] = SHADE + (255,)
    px[27, 8] = px[28, 8] = px[28, 9] = NAIL + (255,)
    # thumb: crease
    if thumb_up:
        for y in range(2, 6):
            px[13, y] = SHADE + (255,)
        px[10, 1] = px[11, 1] = NAIL + (255,)
    else:
        for x in range(11, 20):
            px[x, 5] = SHADE + (255,)
        px[19, 3] = px[20, 3] = px[20, 4] = NAIL + (255,)
    return im
