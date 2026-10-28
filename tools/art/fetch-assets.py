# itch.io 무료/PWYW 에셋 팩 다운로드 → <out>/<slug>/ 아래 원본 저장 (저장소에 넣지 말 것)
# 사용: python3 -I tools/art/fetch-assets.py <out>  →  python3 -I tools/art/build-sprites.py <out> .
import re, sys, os, time, zipfile, requests

PACKS = [
    'https://pingupollas.itch.io/knowledge-temple',
    'https://arex-v.itch.io/damp-dungeons',
    'https://kaishido.itch.io/dark-world',
    'https://kosinaz.itch.io/16x16-dark-dungeon-tileset',
    'https://pingupollas.itch.io/crawling-depths',
    'https://hypnobius.itch.io/dark-ages-ui',
    'https://0x72.itch.io/dungeontileset-ii',
]

def fetch(page, outdir):
    os.makedirs(outdir, exist_ok=True)
    s = requests.Session(); s.headers['User-Agent'] = 'Mozilla/5.0'
    def get(u):
        for i in range(6):
            r = s.get(u)
            if r.status_code == 200: return r.text
            time.sleep(15 * (i + 1))
        raise SystemExit('rate limited: ' + u)
    html = get(page)
    csrf = re.search(r'name="csrf_token" value="([^"]+)"', html).group(1)
    dl = s.post(page + '/download_url', data={'csrf_token': csrf}, headers={'X-Requested-With': 'XMLHttpRequest'}).json()['url']
    html2 = get(dl)
    csrf2 = re.search(r'name="csrf_token" value="([^"]+)"', html2).group(1)
    ups = list(dict.fromkeys(re.findall(r'data-upload_id="(\d+)"', html2)))
    names = [a or b for a, b in re.findall(r'class="name" title="([^"]+)"|<strong title="([^"]+)" class="name"', html2)]
    for uid, name in zip(ups, names):
        if 'RPGMaker' in name: continue
        j = s.post(f'{page}/file/{uid}', params={'source': 'game_download'}, data={'csrf_token': csrf2}, headers={'X-Requested-With': 'XMLHttpRequest'}).json()
        if 'url' not in j: print('실패', name, j); continue
        fn = os.path.join(outdir, name.replace('/', '_'))
        open(fn, 'wb').write(s.get(j['url']).content)
        if fn.endswith('.zip'):
            with zipfile.ZipFile(fn) as z: z.extractall(fn[:-4] + '_x')
        print('받음', fn)
        time.sleep(2)

out = sys.argv[1]
for p in PACKS:
    fetch(p, os.path.join(out, p.rstrip('/').split('/')[-1]))
