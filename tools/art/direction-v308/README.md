# 생목 원본

새 SVG 경로·줄기 좌표·가지·솔잎/잎 무리를 직접 구성했다. 입력 이미지는 없다. 이미지 생성 도구는 HTTP400 `Unknown parameter: 'reasoning'.`으로 두 번 실패했으며 생성된 이미지는 없었다. SVG 원본과 Inkscape 래스터 출력을 사용한다. 새 PNG를 만든 뒤 픽셀은 편집하지 않는다.

```sh
node tools/art/direction-v308/draw-living.mjs
inkscape tools/art/direction-v308/living-trees.svg --export-type=png --export-filename=public/sprites/original/direction-v308/living-trees.png
python3 tools/art/direction-v308/install.py --check
```

`living-frames.json`은 검토한 프레임·접지점·월드 높이·기본 종별 매핑이다. `--write`는 이 메타데이터를 설치하며 이미지를 바꾸지 않는다. 원본을 수정했으면 새 생성 결과를 실제 화면에서 검토한 뒤 출처 SHA를 명시 갱신한다. [CC0](LICENSE.txt).
