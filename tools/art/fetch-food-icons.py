"""고정 원본 음식 아이콘: --fetch로 내려받고 기본 동작은 보관 파일을 검증한다."""
import hashlib
import json
import struct
import sys
import urllib.request
from pathlib import Path

root = Path(__file__).resolve().parents[2]
manifest = json.loads((root / 'tools/art/food-sources.json').read_text())
for icon in manifest['icons']:
    dest = root / icon['file']
    if '--fetch' in sys.argv:
        with urllib.request.urlopen(icon['source'], timeout=30) as response:
            data = response.read()
        if hashlib.sha256(data).hexdigest() != icon['sha256']:
            raise SystemExit('고정 원본 SHA-256 불일치: ' + icon['sprite'])
        dest.write_bytes(data)
    data = dest.read_bytes()
    assert hashlib.sha256(data).hexdigest() == icon['sha256'], icon['sprite']
    assert data[:8] == b'\x89PNG\r\n\x1a\n', icon['sprite']
    assert struct.unpack('>II', data[16:24]) == (icon['width'], icon['height']), icon['sprite']
assert (root / manifest['licenseFile']).is_file()
print('음식 원본 아이콘: ' + str(len(manifest['icons'])) + '개 · 고정 SHA-256/PNG 크기/라이선스 파일 확인')
