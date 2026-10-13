# 쪽지 아이콘 (자체 제작, CC0): 16×16 픽셀을 2배로 키워 32×32 타일. 실행: python3 tools/art/note.py
from PIL import Image

ART = [
    "................",
    "................",
    "...#########....",
    "..#ppppppppp#...",
    "..#pllllllpp##..",
    "..#ppppppppppp#.",
    "..#plllllllllp#.",
    "..#ppppppppppp#.",
    "..#pllllllllpp#.",
    "..#ppppppppppp#.",
    "..#pllllllppppd.",
    "..#pppppppppddd.",
    "..#ppppppppd#...",
    "...#########....",
    "................",
    "................",
]
PAL = {'#': (58, 46, 32, 255), 'p': (196, 178, 136, 255), 'l': (96, 80, 60, 255), 'd': (150, 128, 92, 255)}

im = Image.new('RGBA', (16, 16), (0, 0, 0, 0))
for y, row in enumerate(ART):
    for x, ch in enumerate(row):
        if ch in PAL:
            im.putpixel((x, y), PAL[ch])
im.resize((32, 32), Image.NEAREST).save('public/tiles/note.png')
