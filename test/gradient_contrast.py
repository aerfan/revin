import json, sys, glob, re
import numpy as np
from PIL import Image
def lin(c):
    c = c / 255.0
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)
def lum(rgb):
    r, g, b = lin(rgb[..., 0]), lin(rgb[..., 1]), lin(rgb[..., 2])
    return 0.2126 * r + 0.7152 * g + 0.0722 * b
def parse(c):
    m = re.findall(r'[\d.]+', c)
    v = [float(x) for x in m]
    return v[:3], (v[3] if len(v) > 3 else 1.0)
for png in sorted(x for x in glob.glob(sys.argv[1] + '/card-*.png') if not x.endswith('.text.png')):
    img = np.asarray(Image.open(png).convert('RGB')).astype(float)
    txt = np.asarray(Image.open(png.replace('.png', '.text.png')).convert('RGB')).astype(float)
    els = json.load(open(png + '.json'))
    out = []
    for e in els:
        x0, y0 = int(e['x']), int(e['y']); x1, y1 = int(e['x'] + e['w']), int(e['y'] + e['h'])
        bgall = img[y0:y1, x0:x1].reshape(-1, 3); tx = txt[y0:y1, x0:x1].reshape(-1, 3)
        glyph = np.abs(bgall - tx).sum(axis=1) > 60
        bg = bgall[glyph] if glyph.sum() > 10 else bgall
        (r, g, b), a = parse(e['color'])
        fg = np.array([r, g, b], dtype=float)
        # text colour with alpha is composited over each background pixel
        comp = fg * a + bg * (1 - a)
        lf, lb = lum(comp), lum(bg)
        ratio = (np.maximum(lf, lb) + 0.05) / (np.minimum(lf, lb) + 0.05)
        out.append(f"{e['sel'][:22]:22s} glyph px {int(glyph.sum()):5d}  worst {ratio.min():.2f}  p5 {np.percentile(ratio, 5):.2f}")
    print(png.split('/')[-1], '\n   ' + '\n   '.join(out))
worst = []
for png in sorted(x for x in glob.glob(sys.argv[1] + '/card-*.png') if not x.endswith('.text.png')):
    img = np.asarray(Image.open(png).convert('RGB')).astype(float)
    txt = np.asarray(Image.open(png.replace('.png', '.text.png')).convert('RGB')).astype(float)
    for e in json.load(open(png + '.json')):
        x0, y0, x1, y1 = int(e['x']), int(e['y']), int(e['x'] + e['w']), int(e['y'] + e['h'])
        bgall = img[y0:y1, x0:x1].reshape(-1, 3); tx = txt[y0:y1, x0:x1].reshape(-1, 3)
        glyph = np.abs(bgall - tx).sum(axis=1) > 60
        bg = bgall[glyph] if glyph.sum() > 10 else bgall
        (r, g, b), a = parse(e['color']); fg = np.array([r, g, b], dtype=float)
        lf, lb = lum(fg * a + bg * (1 - a)), lum(bg)
        worst.append(((np.maximum(lf, lb) + 0.05) / (np.minimum(lf, lb) + 0.05)).min())
low = min(worst)
print(f"gradient card text: {len(worst)} text elements across light/dark and desktop/phone, worst contrast {low:.2f}:1 (AA needs 4.5)")
sys.exit(0 if low >= 4.5 else 1)
