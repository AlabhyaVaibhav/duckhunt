# extract_nes.py nes_sheet.png assets/
# Cuts the original NES dog and ducks out of a 1:1 Duck Hunt rip (white
# background) into assets/nes/*.png, with alignment data in assets/nes.json.
import sys, json, os
import numpy as np
from PIL import Image
from scipy import ndimage

src, out = sys.argv[1:3]
sheet = np.asarray(Image.open(src).convert('RGB'))
BG = (255, 255, 255)  # sprite white is (252, 252, 252), so this keys out cleanly
os.makedirs(f'{out}/nes', exist_ok=True)

fg = ~np.all(sheet == BG, axis=-1)
lab, _ = ndimage.label(ndimage.binary_dilation(fg, iterations=1), structure=np.ones((3, 3)))
boxes = []
for y, x in ndimage.find_objects(lab):
    ys, xs = np.nonzero(fg[y, x])
    if len(ys) >= 15:
        boxes.append((x.start + xs.min(), y.start + ys.min(), xs.max() - xs.min() + 1, ys.max() - ys.min() + 1))
boxes.sort(key=lambda b: (b[1] // 20, b[0]))  # reading order; ids below refer to this


def crop(i):
    x, y, w, h = boxes[i]
    a = sheet[y:y + h, x:x + w]
    return np.dstack([a, np.where(np.all(a == BG, axis=-1), 0, 255)]).astype(np.uint8)


def save(a, name):
    Image.fromarray(np.ascontiguousarray(a), 'RGBA').save(f'{out}/nes/{name}.png')
    return a


meta = {'ducks': {}, 'dog': {}}

# Ducks: the three colours share shapes, so anchors come from the black duck's
# green head and apply to all of them.
DUCKS = {
    'blue':  {'fly': [12, 16, 15], 'diag': [21, 22, 23], 'away': [30, 31, 32], 'shot': 39, 'fall': 40},
    'black': {'fly': [13, 18, 17], 'diag': [24, 25, 26], 'away': [33, 34, 35], 'shot': 41, 'fall': 42},
    'red':   {'fly': [14, 20, 19], 'diag': [27, 28, 29], 'away': [36, 37, 38], 'shot': 43, 'fall': 44},
}
HEAD = (0, 80, 0)
anchors = {}
for pose in ('fly', 'diag', 'away'):
    anchors[pose] = []
    for i in DUCKS['black'][pose]:
        a = crop(i)
        ys, xs = np.nonzero(np.all(a[:, :, :3] == HEAD, axis=-1))
        anchors[pose].append([int(round(xs.mean())), int(round(ys.mean()))])
meta['duckAnchors'] = anchors
for kind, poses in DUCKS.items():
    meta['ducks'][kind] = {}
    for pose, ids in poses.items():
        ids = ids if isinstance(ids, list) else [ids]
        for f, i in enumerate(ids):
            save(crop(i), f'duck_{kind}_{pose}_{f}')
        meta['ducks'][kind][pose] = len(ids)

# Dog. `cx` is the body's centre column, used to centre popups on the body
# rather than on a canvas that includes a raised arm.
DOG = {
    'walk_0': 0, 'walk_1': 1, 'walk_2': 2, 'walk_3': 3, 'sniff_0': 4,
    'alert': 6, 'jump': 7, 'dive': 8, 'laugh_0': 9, 'laugh_1': 10,
    'hold1': 5, 'hold2': 11,
}
CX = {'hold1': 15, 'hold2': 28}  # hold2 is mirror-symmetric about x=28; hold1 matches its right half shifted by 13
for name, i in DOG.items():
    a = save(crop(i), f'dog_{name}')
    meta['dog'][name] = {'cx': CX.get(name, a.shape[1] // 2)}

json.dump(meta, open(f'{out}/nes.json', 'w'), indent=1)
print(json.dumps(meta['duckAnchors']))
