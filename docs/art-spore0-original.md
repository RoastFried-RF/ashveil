# 포자 인간 첫 원본

v0.287에 자체 정수 좌표로 그린 살아 있는 순례자 원본을 적용했다. 얼굴/목/손/두 다리와 낡은 순례복을 남기고 비대칭 회녹색/자주색 포자 피막을 그렸다. 거대한 버섯 모자/마법 발광/새 장비·능력을 추가하지 않았다.

Root가 원본 접촉 시트를 직접 열어 검토하고 원본 public9개/격리 제작12파일 전체와 제작 원문·검사를 tools/art/spore0에 보존했다. 보행12개 키와 idle는 그대로, 공격16개는 신규다. 전용 시트2개/28프레임/char만 함께 병합했고 공용시트와 다른char는 보존했다.

24×32 동작 셀의 원본 배율1, 양쪽앵커30/32, 실제발바닥29행/지면30, 머리상단3행/headOffset27이다. 공격도 같은 셀이므로 몸 오프셋은 없다. 과거 walk-only 조각의0.92 앵커는 당시 제안 원문으로 보존했으며 적용한 것은 전체28프레임 조각이다.

`python3 tools/art/spore0/draw-spore0.py --check`의9개 결정적 산출물 재현을 Root에서 통과했다. 실제 게임 동작/광원/저장 복원과 전체 검증은 별도로 남아 있다. 제작 출처·전체해시는 [원문](../tools/art/spore0/SOURCE.md), [프레임](../public/sprites/original/ashveil-spore0-frames.json), [무결성](../public/sprites/original/ashveil-spore0-integrity.json)에 있다.
