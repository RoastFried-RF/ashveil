# 잿빛 갓버섯 아이콘 (자체 제작, CC0): 16×16 → 32×32. 실행: python3 tools/art/ashcap.py
from PIL import Image

ART = [
    "................",
    "................",
    "....######......",
    "...#gggggg#.....",
    "..#gGggGggg#....",
    "..#ggggggGg#....",
    "...########.....",
    ".....#ss#...###.",
    ".....#ss#..#gGg#",
    ".....#ss#..#ggg#",
    ".....#ss#...###.",
    "....#ssss#...#s#",
    "....######...#s#",
    "..............#.",
    "................",
    "................",
]
PAL = {'#': (40, 38, 34, 255), 'g': (132, 128, 116, 255), 'G': (176, 170, 150, 255), 's': (198, 186, 160, 255)}

im = Image.new('RGBA', (16, 16), (0, 0, 0, 0))
for y, row in enumerate(ART):
    for x, ch in enumerate(row):
        if ch in PAL:
            im.putpixel((x, y), PAL[ch])
im.resize((32, 32), Image.NEAREST).save('public/tiles/ash_cap.png')
