# 그늘 우두머리 원본

v0.287에서 실제 Creature.ShadeChief/char shade_chief에 작은 인간 후손 원본을 적용했다. 일반4종과 같은 native22px 체형에 묶은 천·해진 옷깃·비대칭 꿰맨 앞자락으로 구분한다. 실제 장비는 선택/해제 가능하므로 고정 칼·왕관·갑옷을 추가하지 않았다.

Root가 전체 접촉 시트를 직접 열고 기존12보행 키/idle·신규16공격·전용2시트/char를 함께 병합했다. native24×32/공격32×40·몸offset4,8·배율1, 실제머리y9/발y30/지면31, 양쪽anchor31/32·39/40, head22다. 공용시트/다른char는 보존했다.

격리제작12파일 전체를 tools/art/shade-chief에 보존하고 아트9파일은 public에 그대로 복사했다. `python3 tools/art/shade-chief/draw-shade-chief.py --check`로 재현한다. 실제게임 브라우저·광원·복원 검사는 별도로 남아 있다. [출처와 재현](../tools/art/shade-chief/SOURCE.md).
