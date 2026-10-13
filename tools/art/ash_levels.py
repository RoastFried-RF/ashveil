# 재 쌓인 땅/도로 타일 생성: 거의 검은 원본(grey_dirt)을 회백색 재 톤으로 레벨 조정
import sys, os
from PIL import Image
d = sys.argv[1]
def level(src, dst, base, gain, tint):
    im = Image.open(os.path.join(d, src)).convert('RGBA')
    px = im.load()
    for y in range(im.height):
        for x in range(im.width):
            r, g, b, a = px[x, y]
            v = (r + g + b) / 3
            nv = min(255, base + v * gain)
            px[x, y] = (int(nv * tint[0]), int(nv * tint[1]), int(nv * tint[2]), a)
    im.save(os.path.join(d, dst))
for i in range(4):
    level(f'ash{i}.png', f'ash{i}.png', 62, 1.5, (1.0, 0.97, 0.92))
level('ash2.png', 'road0.png', 30, 1.1, (0.93, 0.95, 1.0))
level('ash3.png', 'road1.png', 30, 1.1, (0.93, 0.95, 1.0))
print('ok')
