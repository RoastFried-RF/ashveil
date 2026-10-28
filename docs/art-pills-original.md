# 실제 정제와 캡슐6종 원본

v0.288에서 흰/노란/푸른/검은/초록/자홍 알약의 실제1×1 외형을 직접 그린 무광 정제/캡슐로 연결했다. 효과를 뜻하는 그림/글자·병/포장·조건부 변질단서를 기본 그림에 넣지 않았다. 원래 pill_* sprite명6개와 Def는 그대로이며 기존 tiles의PNG6개도 보존했다. 새 manifest frame6개와 전용시트6개가 같은sprite명을 우선해석한다. 이전manifest frame교체라고 주장하지 않는다.

Root가32px/16px도형을 보여 주는contact를 직접 열고 원문25파일을tools/art/pills에 복사했다.22개 산출물은 public/sprites/original/items에 원본바이트로 보존한다. `python3 tools/art/pills/draw-pills.py --check`로 재현한다. [출처/해시](../tools/art/pills/SOURCE.md). 실제게임/부분정제/저장/전체검증은 별도로 남아 있다.
