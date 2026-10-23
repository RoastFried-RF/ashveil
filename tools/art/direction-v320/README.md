# 원본 장비320

50종(의복23/생활 도구25/장신구2)을 실제 정의의 가방 크기×24px로 직접 그린다. 다른 게임의 이미지 입력이나 트레이싱은 없다. 기존 논리 그림 키를 재사용한다.

1. `node tools/art/direction-v320/draw-equipment.mjs --install`
2. `node tools/art/update-sheet-sizes.mjs`
3. `node --import tsx tools/art/export-public-artbook.ts`

Inkscape가 필요하다. 개별 SVG 좌표는 draw-equipment.mjs와 equipment.svg, 출처/개별 디자인은 provenance.json, 실제 이전/현재 경로는 usage-audit.json에 있다. [CC0](LICENSE.txt) · [조사/적용과 제한](../../../docs/equipment-art-v320.md).
