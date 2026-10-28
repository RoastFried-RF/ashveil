# 장막 아래 색감: 지형 타일 채도 낮추기/밝기 보정 (원본 CC0 타일을 가공)
import sys, os, glob
from PIL import Image, ImageEnhance
d = sys.argv[1]
def proc(pattern, sat, bright):
    for p in glob.glob(os.path.join(d, pattern)):
        im = Image.open(p).convert('RGBA')
        a = im.getchannel('A')
        rgb = im.convert('RGB')
        rgb = ImageEnhance.Color(rgb).enhance(sat)
        rgb = ImageEnhance.Brightness(rgb).enhance(bright)
        out = rgb.convert('RGBA'); out.putalpha(a)
        out.save(p)
        print('ok', os.path.basename(p))
proc('grass?.png', 0.45, 1.05)
proc('grassdirt?.png', 0.5, 1.05)
proc('dirt?.png', 0.6, 0.95)
proc('mud?.png', 0.6, 1.0)
proc('tree?.png', 0.55, 0.95)
proc('ash?.png', 0.9, 1.6)
proc('concrete?.png', 1.0, 1.35)
proc('water_*.png', 0.5, 0.9)
