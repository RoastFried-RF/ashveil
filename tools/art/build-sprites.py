# 원본 에셋 팩 → 게임용 스프라이트 시트 + manifest
# 사용: python3 -I tools/art/build-sprites.py <원본 루트(dl/)> <프로젝트 루트>
# 원본 팩은 저장소에 넣지 않는다(재배포 금지 조항). fetch-assets.py 로 받은 뒤 이 스크립트로 재생성.
import sys, os, json, colorsys
from PIL import Image, ImageDraw

SRC, ROOT = sys.argv[1], sys.argv[2]
OUT = os.path.join(ROOT, 'public', 'sprites')
os.makedirs(OUT, exist_ok=True)

KT = os.path.join(SRC, 'knowledge-temple', 'KNOWLEDGE TEMPLE_x', 'KNOWLEDGE TEMPLE')
DD = os.path.join(SRC, 'damp-dungeons', 'DampDungeons_x', 'DampDungeons')
DW = os.path.join(SRC, 'dark-world', 'Dark World - Free Asset Pack - v1.0_x', 'Dark World - Free Asset Pack - v1.0')
CD = os.path.join(SRC, 'crawling-depths', 'CRAWLING DEPTHS_x', 'CRAWLING DEPTHS')
UI = os.path.join(SRC, 'dark-ages-ui', 'DarkAgesUi_v1.0_x', 'DarkAgesUi_v1.0')
X72 = os.path.join(SRC, 'dungeontileset-ii', '0x72_DungeonTilesetII_v1.7_x', '0x72_DungeonTilesetII_v1.7', 'frames')

manifest = {'sheets': {}, 'frames': {}, 'anims': {}, 'chars': {}, 'ui': {}}

def load(p):
    return Image.open(p).convert('RGBA')

def save_sheet(name, im):
    im.save(os.path.join(OUT, name + '.png'))
    manifest['sheets'][name] = f'sprites/{name}.png'

def frame(name, sheet, x, y, w, h):
    manifest['frames'][name] = [sheet, x, y, w, h]

def anim(name, frames, fps):
    manifest['anims'][name] = {'frames': frames, 'fps': fps}

def recolor(im, rules):
    """rules: [(hue_lo, hue_hi, min_sat, fn(h,s,v)->(h,s,v))] 색조 범위별 치환"""
    px = im.load()
    for y in range(im.height):
        for x in range(im.width):
            r, g, b, a = px[x, y]
            if a == 0: continue
            h, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
            for lo, hi, ms, fn in rules:
                if lo <= h * 360 <= hi and s >= ms:
                    h, s, v = fn(h, s, v)
                    break
            r2, g2, b2 = colorsys.hsv_to_rgb(h % 1, max(0, min(1, s)), max(0, min(1, v)))
            px[x, y] = (int(r2 * 255), int(g2 * 255), int(b2 * 255), a)
    return im

# ── Knowledge Temple: 바닥 ─────────────────────────────
fp = load(os.path.join(KT, 'Terrain', 'Floor Patterns.png'))
floor = Image.new('RGBA', (256, 256))
for i, (sx, sy) in enumerate([(0, 0), (144, 0), (0, 144), (144, 144)]):
    floor.paste(fp.crop((sx, sy, sx + 128, sy + 128)), ((i % 2) * 128, (i // 2) * 128))
save_sheet('kt_floor', floor)
for q in range(4):
    manifest['frames'][f'kt_floor_q{q}'] = ['kt_floor', (q % 2) * 128, (q // 2) * 128, 128, 128]

tiles = load(os.path.join(KT, 'Terrain', 'Tiles.png'))
save_sheet('kt_moss', tiles)
moss = []
for gy in range(4):
    for gx in range(3):
        n = f'moss_s{gy * 3 + gx}'; frame(n, 'kt_moss', gx * 16, gy * 16, 16, 16); moss.append(n)
for gy in range(6):
    n = f'moss_t{gy}'; frame(n, 'kt_moss', 48, gy * 16, 16, 16)
for gy in range(3):
    for gx in range(3):
        frame(f'moss_l{gy * 3 + gx}', 'kt_moss', 64 + gx * 32, gy * 32, 32, 32)

# ── Knowledge Temple: 벽 ───────────────────────────────
walls = load(os.path.join(KT, 'Walls', 'Walls.png'))
wt = Image.new('RGBA', (16 * 8, 16 * 6))
# 벽면(위/아래 2단) 변형: 32px 폭 벽돌 무늬에서 16px 조각
for i in range(2):
    for j in range(4):
        wt.paste(walls.crop((48 + i * 16, 48 + j * 16, 64 + i * 16, 64 + j * 16)), (i * 16 + j * 32, 0))
# 벽 윗면: 원본 가장 어두운 색 + 미세 노이즈
base = (18, 20, 14, 255)
top = Image.new('RGBA', (16, 16), base)
d = ImageDraw.Draw(top)
for k in range(9):
    x, y = (k * 7) % 16, (k * 5) % 16
    d.point((x, y), fill=(24, 27, 19, 255))
wt.paste(top, (0, 16))
# 윗면 테두리(남·북·동·서): 원본 테두리 색
edge = (58, 64, 40, 255)
for idx, side in enumerate('NSEW'):
    t = Image.new('RGBA', (16, 16), (0, 0, 0, 0)); dd = ImageDraw.Draw(t)
    if side == 'N': dd.line([(0, 0), (15, 0)], fill=edge)
    if side == 'S': dd.line([(0, 15), (15, 15)], fill=edge); dd.line([(0, 14), (15, 14)], fill=(34, 38, 25, 255))
    if side == 'E': dd.line([(15, 0), (15, 15)], fill=edge)
    if side == 'W': dd.line([(0, 0), (0, 15)], fill=edge)
    wt.paste(t, (16 + idx * 16, 16))
# 벽면 아래 턱(바닥과 만나는 선)
wt.paste(walls.crop((48, 112, 64, 128)), (0, 32)); wt.paste(walls.crop((64, 112, 80, 128)), (16, 32))
# 서가(도서관 벽면)
ts = load(os.path.join(KT, 'Tileset.png'))
for k in range(12):
    for c in range(6):
        if k * 6 + c >= 48: break
        wt.paste(ts.crop((c * 16, 1598 + k * 16, c * 16 + 16, 1614 + k * 16)), ((k * 6 + c) % 8 * 16, 48 + (k * 6 + c) // 8 * 16))
save_sheet('kt_walls', wt)
for i in range(8): frame(f'wall_face{i}', 'kt_walls', i * 16, 0, 16, 16)
frame('wall_top', 'kt_walls', 0, 16, 16, 16)
for idx, side in enumerate('NSEW'): frame(f'wall_edge_{side}', 'kt_walls', 16 + idx * 16, 16, 16, 16)
frame('wall_ledge0', 'kt_walls', 0, 32, 16, 16); frame('wall_ledge1', 'kt_walls', 16, 32, 16, 16)
for n in range(24): frame(f'shelf{n}', 'kt_walls', (n % 8) * 16, 48 + (n // 8) * 16, 16, 16)

# ── Knowledge Temple: 소품 ─────────────────────────────
props = Image.new('RGBA', (400, 260))
x = 0
def put(name, im, fw=None, fh=None):
    global x
    props.paste(im, (x, 0))
    frame(name, 'kt_props', x, 0, im.width, im.height)
    x += im.width + 2
put('pot0', load(os.path.join(KT, 'Structures & Details', 'Pot.png')).crop((0, 0, 16, 32)))
put('pot1', load(os.path.join(KT, 'Structures & Details', 'Pot.png')).crop((16, 0, 32, 32)))
put('pot2', load(os.path.join(KT, 'Structures & Details', 'Pot.png')).crop((32, 0, 48, 32)))
put('statue', load(os.path.join(KT, 'Structures & Details', 'Statue.png')))
put('sarcophagus', load(os.path.join(KT, 'Structures & Details', 'Sarcophagus.png')))
put('broken_column', load(os.path.join(KT, 'Structures & Details', 'Broken Column.png')))
put('niche_statue', load(os.path.join(KT, 'Walls', 'Statue.png')))
put('chain0', load(os.path.join(KT, 'Walls', 'Chains.png')).crop((0, 0, 16, 64)))
put('seat', load(os.path.join(KT, 'Structures & Details', 'Seat.png')))
books = load(os.path.join(KT, 'Structures & Details', 'Books & Scrolls.png'))
put('books0', books.crop((0, 0, 32, 20))); put('books1', books.crop((64, 0, 96, 20)))
save_sheet('kt_props', props.crop((0, 0, x, 260)))
torch = load(os.path.join(KT, 'Structures & Details', 'Torch Sheet.png'))
save_sheet('kt_brazier', torch)
anim('brazier', [f'brazier{i}' for i in range(8)], 8)
for i in range(8): frame(f'brazier{i}', 'kt_brazier', i * 48, 0, 48, 64)

# ── Damp Dungeons: 캐릭터 (24×32, 3프레임 × 4방향) ─────
DIRS = ['down', 'left', 'right', 'up']
def char_sheet(name, im, ox, oy, cw=24, ch=32):
    """ox,oy: 블록 좌상단 셀 좌표"""
    walk = {}
    for di, dn in enumerate(DIRS):
        fr = []
        for f in range(3):
            fn = f'{name}_w_{dn}{f}'
            frame(fn, sheet_of[name], (ox + f) * cw, (oy + di) * ch, cw, ch)
            fr.append(fn)
        walk[dn] = fr
    manifest['chars'][name] = {'walk': walk, 'idle': {d: [walk[d][1]] for d in DIRS}, 'anchor': [0.5, 0.92]}

sheet_of = {}
hero = load(os.path.join(DD, 'Animations', 'Dungeon_HeroMan1.png'))
sword = load(os.path.join(DD, 'Animations', 'Dungeon_HeroManSword1.png'))
save_sheet('hero', hero); sheet_of['hero'] = 'hero'
char_sheet('hero', hero, 0, 0)
save_sheet('hero_atk', sword)
atk = {}
for di, dn in enumerate(DIRS):
    atk[dn] = []
    for f in range(4):
        fn = f'hero_a_{dn}{f}'; frame(fn, 'hero_atk', f * 47, di * 63, 47, 63); atk[dn].append(fn)
manifest['chars']['hero']['attack'] = atk
manifest['chars']['hero']['attackAnchor'] = [0.5, 0.72]

# 약탈자: 주인공 팔레트 정확 치환 (셔츠·그림자·머리/바지)
def remap(im, table):
    px = im.load()
    for y in range(im.height):
        for x in range(im.width):
            c = px[x, y]
            if c[3] and c[:3] in table: px[x, y] = table[c[:3]] + (c[3],)
    return im
REAVER_PALETTES = [
    {(141, 163, 127): (118, 62, 52), (34, 95, 102): (58, 28, 26), (127, 92, 53): (66, 60, 54), (81, 34, 34): (40, 30, 28)},
    {(141, 163, 127): (104, 100, 90), (34, 95, 102): (46, 44, 40), (127, 92, 53): (92, 70, 44), (196, 150, 66): (120, 100, 70)},
]
for vi, pal in enumerate(REAVER_PALETTES):
    nm = f'reaver{vi}'
    save_sheet(nm, remap(hero.copy(), pal)); sheet_of[nm] = nm
    walk = {}
    for di, dn in enumerate(DIRS):
        walk[dn] = []
        for f in range(3):
            fn = f'{nm}_w_{dn}{f}'; frame(fn, nm, f * 24, di * 32, 24, 32); walk[dn].append(fn)
    sa = f'{nm}_atk'
    save_sheet(sa, remap(sword.copy(), pal))
    a2 = {}
    for di, dn in enumerate(DIRS):
        a2[dn] = []
        for f in range(4):
            fn = f'{nm}_a_{dn}{f}'; frame(fn, sa, f * 47, di * 63, 47, 63); a2[dn].append(fn)
    manifest['chars'][nm] = {'walk': walk, 'idle': {d: [walk[d][1]] for d in DIRS}, 'attack': a2, 'attackAnchor': [0.5, 0.72], 'anchor': [0.5, 0.92]}

mon1 = load(os.path.join(DD, 'Animations', 'Dungeon_Monsters1.png'))
mon2 = load(os.path.join(DD, 'Animations', 'Dungeon_Monsters2.png'))
save_sheet('mon1', mon1); save_sheet('mon2', mon2)
# 말라붙은 자: 해골을 회녹색으로 (회색열)
withered = recolor(mon1.copy(), [(0, 360, 0.0, lambda h, s, v: (0.22, min(0.25, s + 0.12), v * 0.85))])
save_sheet('mon1_withered', withered)
for nm, sh, ox, oy in [
    ('shade0', 'mon1', 0, 0), ('shade1', 'mon1', 6, 0), ('shade2', 'mon1', 9, 0), ('shade_chief', 'mon1', 3, 0),
    ('shade3', 'mon1', 0, 4), ('withered', 'mon1_withered', 3, 4), ('withered_priest', 'mon1_withered', 6, 4),
    ('spore0', 'mon2', 0, 4), ('spore1', 'mon2', 3, 4),
]:
    sheet_of[nm] = sh
    char_sheet(nm, None, ox, oy)

# ── Damp Dungeons: 오브젝트 (16px 격자) ────────────────
obj = load(os.path.join(DD, 'Animations', 'Dungeon_ObjectsDungeon.png'))
save_sheet('objects', obj)
for f in range(3):
    frame(f'chest{f}', 'objects', f * 16, 16, 16, 16)
    frame(f'chest_red{f}', 'objects', f * 16, 48, 16, 16)
    frame(f'crate{f}', 'objects', f * 16, 80, 16, 16)
    frame(f'torch_stand{f}', 'objects', f * 16, 104, 16, 32)
    frame(f'lantern_hang{f}', 'objects', f * 16, 128, 16, 32)
    frame(f'spikes{f}', 'objects', 48 + f * 16, 16, 16, 16)
anim('torch_stand', ['torch_stand0', 'torch_stand1', 'torch_stand2'], 7)
anim('lantern_hang', ['lantern_hang0', 'lantern_hang1', 'lantern_hang2'], 6)
anim('chest_open', ['chest0', 'chest1', 'chest2'], 10)
frame('door_closed', 'objects', 144, 0, 16, 32)
frame('door_open', 'objects', 144, 96, 16, 16)

# ── Dark World: 지상 ───────────────────────────────────
env = Image.new('RGBA', (240, 96))
env.paste(load(os.path.join(DW, 'Environment', 'tree.png')), (0, 0)); frame('tree', 'dw_env', 0, 0, 80, 96)
env.paste(load(os.path.join(DW, 'Environment', 'rock.png')), (82, 0)); frame('rock', 'dw_env', 82, 0, 48, 32)
env.paste(load(os.path.join(DW, 'Environment', 'mushrooms.png')), (132, 0)); frame('mushrooms', 'dw_env', 132, 0, 80, 64)
# 죽은 나무(열매 제거·회갈색)
dead = recolor(load(os.path.join(DW, 'Environment', 'tree.png')), [(280, 360, 0.2, lambda h, s, v: (0.08, 0.2, v * 0.6)), (0, 20, 0.2, lambda h, s, v: (0.08, 0.2, v * 0.6))])
save_sheet('dw_env', env)
deadsheet = Image.new('RGBA', (80, 96)); deadsheet.paste(dead, (0, 0)); save_sheet('dw_tree_dead', deadsheet); frame('tree_dead', 'dw_tree_dead', 0, 0, 80, 96)

# ── Crawling Depths: 최심부 ─────────────────────────────
cdt = load(os.path.join(CD, 'Terrain', 'Tiles.png'))
save_sheet('cd_tiles', cdt)
for gy in range(4):
    for gx in range(5): frame(f'cd_floor{gy * 5 + gx}', 'cd_tiles', gx * 16, gy * 16, 16, 16)
am = load(os.path.join(CD, 'Creatures', 'Amalgam 1 Sheet.png'))
save_sheet('amalgam', am)
anim('amalgam', [f'amalgam{i}' for i in range(am.width // 96)], 6)
for i in range(am.width // 96): frame(f'amalgam{i}', 'amalgam', i * 96, 0, 96, 64)
for nm in ['Vein A1 Sheet', 'Little Eyes 1 Sheet']:
    im = load(os.path.join(CD, 'Structures & Details', nm + '.png'))
    key = 'cd_' + nm.split()[0].lower() + nm.split()[1].lower()
    save_sheet(key, im)
    n = max(1, im.width // im.height) if im.width > im.height else 1
    fw = im.width // n
    anim(key, [f'{key}_{i}' for i in range(n)], 6)
    for i in range(n): frame(f'{key}_{i}', key, i * fw, 0, fw, im.height)
for nm in ['Urn 1', 'Statue B1']:
    im = load(os.path.join(CD, 'Structures & Details', nm + '.png'))
    key = 'cd_' + nm.replace(' ', '_').lower(); save_sheet(key, im); frame(key, key, 0, 0, im.width, im.height)

# ── 0x72: 계단·가시 함정 (어둡게) ───────────────────────
misc = Image.new('RGBA', (64, 16))
for i, nm in enumerate(['floor_stairs', 'floor_ladder', 'skull']):
    p = os.path.join(X72, nm + '.png')
    if os.path.exists(p):
        im = recolor(load(p), [(0, 360, 0.0, lambda h, s, v: (0.2, s * 0.4, v * 0.55))])
        misc.paste(im, (i * 16, 0)); frame(nm, 'x72_misc', i * 16, 0, 16, 16)
save_sheet('x72_misc', misc)

# ── Dark Ages UI (DOM border-image 용 개별 PNG) ─────────
ui = load(os.path.join(UI, '32x32-Tilesheet.png'))
os.makedirs(os.path.join(OUT, 'ui'), exist_ok=True)
for nm, box in {
    'frame': (0, 0, 96, 96), 'parchment': (96, 0, 192, 96), 'celtic': (204, 14, 276, 86), 'celtic2': (300, 14, 372, 86),
    'btn': (0, 96, 64, 128), 'btn_olive': (64, 96, 128, 128), 'btn_sel': (128, 96, 192, 128),
    'slot': (192, 96, 224, 128), 'slot_olive': (224, 96, 256, 128), 'slot_sel': (256, 96, 288, 128),
    'tab': (288, 96, 320, 128), 'tab_olive': (320, 96, 352, 128), 'tab_sel': (352, 96, 384, 128),
    'bar_frame': (96, 144, 192, 160), 'bar_frame2': (96, 176, 192, 192), 'bar_frame_gold': (192, 136, 288, 160),
    'bar_blue': (288, 144, 384, 152), 'bar_red': (192, 176, 288, 184), 'bar_green': (288, 176, 384, 184),
    'warn': (96, 224, 128, 256), 'xmark': (64, 224, 96, 256), 'diamond': (0, 256, 32, 288), 'diamond_dim': (0, 288, 32, 320),
    'ornament': (320, 192, 384, 224), 'divider': (288, 256, 384, 272), 'parchment_small': (0, 320, 64, 352),
}.items():
    ui.crop(box).save(os.path.join(OUT, 'ui', nm + '.png'))
    manifest['ui'][nm] = f'sprites/ui/{nm}.png'

with open(os.path.join(ROOT, 'src', 'client', 'sprites.json'), 'w') as f:
    json.dump(manifest, f, ensure_ascii=False, indent=1)
print('sheets', len(manifest['sheets']), 'frames', len(manifest['frames']), 'anims', len(manifest['anims']), 'chars', len(manifest['chars']))
