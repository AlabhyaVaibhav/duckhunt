import sys
from PIL import Image, ImageDraw, ImageFont
root, font = sys.argv[1:3]
A = f'{root}/assets'
W, H = 1200, 630
img = Image.new('RGBA', (W, H), (100, 176, 255, 255))
def put(name, scale, x, y):
    im = Image.open(f'{A}/{name}').convert('RGBA')
    im = im.resize((im.width * scale, im.height * scale), Image.NEAREST)
    img.alpha_composite(im, (x, y))
    return im
# scenery strip at the bottom
ImageDraw.Draw(img).rectangle([0, H - 80, W, H], fill=(176, 88, 28))
grass = Image.open(f'{A}/grass.png').convert('RGBA')
g = grass.resize((grass.width * 3, grass.height * 3), Image.NEAREST)
for x in range(0, W, g.width): img.alpha_composite(g, (x, H - g.height - 60))
d = ImageDraw.Draw(img)
d.rectangle([0, H - 60, W, H], fill=(176, 88, 28))
put('tree.png', 3, 40, H - 60 - 357 + 30)
put('nes/duck_red_fly_0.png', 4, 880, 90)
put('nes/duck_blue_diag_1.png', 4, 1010, 230)
dg = Image.open(f'{A}/nes/dog_hold2.png').convert('RGBA')
dg = dg.resize((dg.width * 4, dg.height * 4), Image.NEAREST)
img.alpha_composite(dg, (870, H - 60 - dg.height - 20))
logo = Image.open(f'{A}/logo.png').convert('RGBA')
logo = logo.resize((logo.width * 2, logo.height * 2), Image.NEAREST)
img.alpha_composite(logo, (300, 40))
f1 = ImageFont.truetype(font, 34); f2 = ImageFont.truetype(font, 20)
def t(s, y, f, fill, x=300 + logo.width // 2):
    d.text((x + 4, y + 4), s, font=f, fill=(0, 0, 0), anchor='mt')
    d.text((x, y), s, font=f, fill=fill, anchor='mt')
t('FINGER GUN', 280, f1, (252, 124, 60))
t('SHOOT WITH YOUR HAND', 340, f2, (252, 252, 252))
img.convert('RGB').save(f'{A}/og.png', optimize=True)
