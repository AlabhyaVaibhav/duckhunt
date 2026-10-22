# extract.py sheet.gif boxes.json outdir
# Cuts the scenery (tree, bush, grass), HUD duck icon and title logo out of the
# Super Duck Hunt sheet into transparent PNGs. The dog and ducks come from a
# real NES rip instead: see extract_nes.py.
import sys, json
import numpy as np
from PIL import Image
from scipy import ndimage
src, bj, out = sys.argv[1:4]
sheet = np.asarray(Image.open(src).convert('RGB'))
boxes = json.load(open(bj))
BG = (0, 136, 255)

def crop(i, half=False, off=(0, 0)):
    x, y, w, h = boxes[i]
    a = sheet[y:y + h, x:x + w]
    if half:
        a = a[off[1]::2, off[0]::2]
    rgba = np.dstack([a, np.where(np.all(a == BG, axis=-1), 0, 255)]).astype(np.uint8)
    return rgba

def save(a, name):
    Image.fromarray(a, 'RGBA').save(f'{out}/{name}.png')
    return a

save(crop(369, half=True, off=(1, 1)), 'tree')
save(crop(475), 'bush')
save(crop(313), 'grass')
logo = crop(904, half=True, off=(1, 1))
logo[np.all(logo[:, :, :3] == (4, 4, 4), axis=-1)] = 0  # its near-black box, so it sits on any background
save(logo, 'logo')

# One white duck icon from the HIT box (2x on the sheet).
hit = crop(371, half=True)
white = np.all(hit[:, :, :3] == (255, 255, 255), axis=-1)
lab, n = ndimage.label(white, structure=np.ones((3, 3)))
objs = sorted(ndimage.find_objects(lab), key=lambda s: s[1].start)
icons = [s for s in objs if 5 <= s[1].stop - s[1].start <= 12 and s[1].start > 20]
sy, sx = icons[0]
icon = np.zeros((sy.stop - sy.start, sx.stop - sx.start, 4), np.uint8)
icon[white[sy, sx]] = (255, 255, 255, 255)
save(icon, 'icon')


