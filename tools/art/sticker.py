"""Cut the generated bird out of its white background and give it a paper sticker edge, like the mock-up."""
import sys
from PIL import Image, ImageDraw, ImageFilter, ImageChops

SRC, OUT, WIDTH = sys.argv[1], sys.argv[2], int(sys.argv[3])
PAPER = (251, 246, 234)
INK = (29, 35, 52)

im = Image.open(SRC).convert('RGB')
w, h = im.size

# 1. background = near-white region connected to the image border
probe = im.copy()
SENTINEL = (255, 0, 255)
for x in range(0, w, 24):
    for y in (0, h - 1):
        if sum(probe.getpixel((x, y))) > 3 * 225:
            ImageDraw.floodfill(probe, (x, y), SENTINEL, thresh=38)
for y in range(0, h, 24):
    for x in (0, w - 1):
        if sum(probe.getpixel((x, y))) > 3 * 225:
            ImageDraw.floodfill(probe, (x, y), SENTINEL, thresh=38)
r, g, b = probe.split()
bg = ImageChops.multiply(
    r.point(lambda v: 255 if v == 255 else 0),
    ImageChops.multiply(g.point(lambda v: 255 if v == 0 else 0), b.point(lambda v: 255 if v == 255 else 0)),
)
alpha = ImageChops.invert(bg)
# drop specks, soften the cut by half a pixel
alpha = alpha.filter(ImageFilter.MedianFilter(5)).filter(ImageFilter.GaussianBlur(0.7))

# 2. crop to the bird with room for the sticker edge
PAD = int(w * 0.045)
bbox = alpha.point(lambda v: 255 if v > 40 else 0).getbbox()
x0, y0, x1, y1 = bbox
x0, y0, x1, y1 = max(0, x0 - PAD), max(0, y0 - PAD), min(w, x1 + PAD), min(h, y1 + PAD)
canvas_box = (x1 - x0 + 2 * PAD, y1 - y0 + 2 * PAD)
bird = im.crop((x0, y0, x1, y1))
a = alpha.crop((x0, y0, x1, y1))
full_a = Image.new('L', canvas_box, 0)
full_a.paste(a, (PAD, PAD))
full_bird = Image.new('RGB', canvas_box, PAPER)
full_bird.paste(bird, (PAD, PAD))

# 3. sticker edge: dilate the silhouette, round it off
edge = int(w * 0.018)
sticker = full_a.point(lambda v: 255 if v > 60 else 0)
for _ in range(3):
    sticker = sticker.filter(ImageFilter.MaxFilter(2 * (edge // 3) + 1))
sticker = sticker.filter(ImageFilter.GaussianBlur(edge * 0.35)).point(lambda v: 255 if v > 110 else 0).filter(ImageFilter.GaussianBlur(0.8))

# 4. soft cut-paper shadow, offset down-right
shadow = sticker.filter(ImageFilter.GaussianBlur(edge * 0.6)).point(lambda v: int(v * 0.28))
off = max(2, edge // 3)

out = Image.new('RGBA', canvas_box, (0, 0, 0, 0))
sh = Image.new('RGBA', canvas_box, INK + (0,))
sh.putalpha(ImageChops.offset(shadow, off, off + 1))
out.alpha_composite(sh)
paper = Image.new('RGBA', canvas_box, PAPER + (0,))
paper.putalpha(sticker)
out.alpha_composite(paper)
b2 = full_bird.convert('RGBA')
b2.putalpha(full_a)
out.alpha_composite(b2)

out = out.crop(out.getbbox())
ratio = WIDTH / out.width
out = out.resize((WIDTH, round(out.height * ratio)), Image.LANCZOS)
out.save(OUT, 'WEBP', quality=86, method=6)
print(OUT, out.size)
