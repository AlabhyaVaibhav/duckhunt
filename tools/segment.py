# Finds sprites on the flat background and writes their boxes as JSON,
# plus a labelled overview image per region.
import sys, json
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage
src, outdir = sys.argv[1], sys.argv[2]
im = Image.open(src).convert('RGB')
a = np.asarray(im)
bg = np.all(a == (0, 136, 255), axis=-1)
mask = ndimage.binary_dilation(~bg, iterations=2)
lab, n = ndimage.label(mask)
boxes = []
for i, sl in enumerate(ndimage.find_objects(lab)):
    y, x = sl
    w, h = x.stop - x.start, y.stop - y.start
    if w * h < 30: continue
    # shrink back the dilation
    sub = ~bg[y, x]
    ys, xs = np.nonzero(sub)
    boxes.append([int(x.start + xs.min()), int(y.start + ys.min()), int(xs.max() - xs.min() + 1), int(ys.max() - ys.min() + 1)])
boxes.sort(key=lambda b: (b[1] // 40, b[0]))
json.dump(boxes, open(f'{outdir}/boxes.json', 'w'))
print(len(boxes), 'sprites')
# Overview tiles with ids.
T = 1100
for ty in range(0, im.height, T):
    for tx in range(0, im.width, 1320):
        tile = im.crop((tx, ty, tx + 1320, ty + T)).copy()
        d = ImageDraw.Draw(tile)
        for k, (x, y, w, h) in enumerate(boxes):
            if tx <= x < tx + 1320 and ty <= y < ty + T:
                d.rectangle([x - tx, y - ty, x - tx + w, y - ty + h], outline=(255, 255, 0))
                d.text((x - tx, y - ty - 10), str(k), fill=(255, 255, 255))
        tile.save(f'{outdir}/tile_{ty}_{tx}.png')
