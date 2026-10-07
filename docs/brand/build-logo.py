import sys, re
import numpy as np
from PIL import Image, ImageFilter
import vtracer

out = sys.argv[1]
src = Image.open(out + '/src.png').convert('RGBA')
a = np.asarray(src).astype(np.int32)
H, W = a.shape[:2]
PAD = 40
COL = {'white': (255, 255, 255), 'navy': (0x1E, 0x3F, 0x7B), 'red': (0xEA, 0x26, 0x42)}

opaque = a[..., 3] >= 128
rgb = a[..., :3]
names = list(COL)
dists = np.stack([((rgb - np.array(COL[n])) ** 2).sum(-1) for n in names], -1)
label = np.argmin(dists, -1)
masks = {n: opaque & (label == i) for i, n in enumerate(names)}

def padded(m):
    p = np.zeros((H + 2 * PAD, W + 2 * PAD), bool)
    p[PAD:PAD + H, PAD:PAD + W] = m
    return p

silhouette = padded(opaque)
# Keyline: dilate the silhouette by ~PAD px with a round-ish structuring element.
img = Image.fromarray((silhouette * 255).astype(np.uint8))
for _ in range(PAD // 4):
    img = img.filter(ImageFilter.MaxFilter(9))
keyline = np.asarray(img) > 127

def trace(m):
    h, w = m.shape
    rgba = np.zeros((h, w, 4), np.uint8)
    rgba[m] = (0, 0, 0, 255)
    rgba[~m] = (255, 255, 255, 255)
    svg = vtracer.convert_pixels_to_svg(
        [tuple(int(v) for v in px) for px in rgba.reshape(-1, 4)], size=(w, h),
        colormode='binary', mode='spline', filter_speckle=8, corner_threshold=60,
        length_threshold=4.0, splice_threshold=45, path_precision=2)
    paths = re.findall(r'<path d="([^"]+)"[^>]*transform="translate\(([-\d.]+),([-\d.]+)\)"', svg)
    return ' '.join(f'<path d="{d}" transform="translate({x},{y})"/>' for d, x, y in paths), len(paths)

layers = {'silhouette': silhouette, 'red': padded(masks['red']), 'navy': padded(masks['navy'])}
traced = {k: trace(v) for k, v in layers.items()}
kl, kn = trace(keyline)
for k, (_, n) in traced.items(): print(k, n, 'paths')
print('keyline', kn, 'paths')

w, h = W + 2 * PAD, H + 2 * PAD
hexc = lambda c: '#%02X%02X%02X' % c
def doc(with_keyline):
    body = ''
    if with_keyline:
        body += f'<g fill="#FFFFFF">{kl}</g>'
    body += f'<g fill="#FFFFFF">{traced["silhouette"][0]}</g>'
    body += f'<g fill="{hexc(COL["red"])}">{traced["red"][0]}</g>'
    body += f'<g fill="{hexc(COL["navy"])}">{traced["navy"][0]}</g>'
    title = 'Team IMPACT' 
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" role="img" aria-label="{title}">'
            f'<title>{title}</title>{body}</svg>\n')
open(out + '/logo.svg', 'w').write(doc(False))
open(out + '/logo-dark.svg', 'w').write(doc(True))

# Raster exports from the source pixels (not the trace), on the shared padded canvas.
canvas = Image.new('RGBA', (w, h), (0, 0, 0, 0))
canvas.paste(src, (PAD, PAD), src)
dark = Image.new('RGBA', (w, h), (0, 0, 0, 0))
k = Image.fromarray((keyline * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.2))
dark.paste(Image.new('RGBA', (w, h), (255, 255, 255, 255)), (0, 0), k)
dark = Image.alpha_composite(dark, canvas)
canvas.save(out + '/full-light.png'); dark.save(out + '/full-dark.png')
print('canvas', w, h, 'aspect', w / h)
