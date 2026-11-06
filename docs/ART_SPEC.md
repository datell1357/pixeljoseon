# 등불길 아트 명세

모든 그림은 이 저장소의 코드로 직접 만든다. 외부 에셋을 쓰지 않는다.

## 방향

가을 해 질 녘의 한옥 마을과 그 너머 지역. 큰 머리 인형 대신 5등신 인물, 파스텔 동화풍 집 대신 곡선 기와와 돌담, 평평한 색면 대신 잎·풀·돌 하나하나의 결. 찰흙처럼 둥글고 매끈한 면을 피한다.

## 그리는 방법

- 실시간 3D. `client/src/render3d`가 three.js로 960×540 안팎의 낮은 해상도에 그리고 최근접으로 키운다.
- 모델은 전부 코드로 짓는다(`geo.ts`). 둥근 덩어리 대신 각진 면, 줄지은 기와, 쌓은 돌, 잎 카드.
- 빛: 끊어지는 띠로 나눈 해와 등불, 실제 그림자, 지역별 공기(`atmos.ts`). 어두운 윤곽은 검정이 아니라 물체 색의 진한 그늘이다.
- 흔들림: 옷자락과 머리카락은 스프링으로, 나무와 풀은 바람으로 움직인다.
- 도트가 떨리지 않게: 카메라와 인물은 화면 픽셀에 맞춰 놓고, 그림자는 그림자 격자에 맞춘다.
- 점검: `node tools/lookdev/run.mjs <폴더> town:30:30:이름`, 움직임은 `node tools/lookdev/film.mjs <파일.mp4>`. 둘 다 헤드리스다.

## 좌표와 카메라

- 월드 좌표 `(u, v)`, 1칸 = 1 유닛. 화면 변환: `x = u * 40`, `y = v * 22`, 높이 1유닛 = 33.4px (`shared/core.ts`).
- 카메라: 직교, 정면에서 약 33도 내려다본다. 화면 오른쪽이 `+u`, 아래가 `+v`.
- 해: 화면 왼쪽 앞에서 낮게 들어오는 금빛. 사람 키는 약 1.8 유닛(약 60px).
- 방향 번호는 서버와 같다(`DIR_VEC`). 모델은 방향 사이를 부드럽게 돈다.

## 구워서 쓰는 것

아이콘만 굽는다. `client/public/art/icons/items.png`, `skills.png`는 `icons/*.json`의 `{ "cell":32, "cols":8, "ids":[...] }` 순서를 따른다. 32×32 도트.

`art/props/props.json`은 그림이 아니라 소품의 바닥 차지 영역(`fp`)과 충돌(`solid`) 표다. `tools/genmaps.ts`가 읽는다. `fp`를 바꾸면 지도를 다시 만든다.

`tools/bake/page`의 `rig.js`와 동작 표는 실시간 모델이 그대로 쓴다. 옛 비율로 만든 사람 동작은 `chars.ts`의 `retarget`이 새 비율로 옮긴다.

## 목록

### 플레이어 (5등신, 한복풍)

`pc_warrior_a|b|c`, `pc_mage_a|b|c`, `pc_archer_a|b|c`. a·b·c는 머리·옷 색 변형.

- warrior: 금빛 징을 박은 두정갑, 어깨 판, 왼손 원형 방패, 오른손 환도.
- mage: 도포와 넓은 소매, 갓 또는 쪽 찐 머리, 끝에 초롱을 매단 지팡이.
- archer: 철릭과 가죽 조끼, 벙거지, 목도리, 등에 화살통, 왼손 각궁.

동작: `idle 6f 1.2s 반복`, `walk 8f 0.64s 반복`, `attack1 6f 0.32s`, `attack2 6f 0.32s`, `attack3 7f 0.46s`, `cast 7f 0.5s`, `spin 6f 0.5s`, `dodge 6f 0.38s`, `guard 3f 0.12s`(마지막 프레임 유지), `hit 3f 0.24s`, `death 8f 0.8s`.

- warrior `attack1~3`: 베기→되베기→내려치기, `spin`: 팽이 회전베기.
- mage `attack1~3`: 지팡이 찌르기→휘두르기→두 손 뻗기, `spin`: 지팡이 땅 찍기.
- archer `attack1~3`: 빠른 활쏘기(3번은 크게 당기기), `spin`: 뒤로 몸을 돌리며 쏘기.
- `dodge`: warrior·archer는 구르기·뛰어오르기, mage는 몸을 웅크렸다 펴기(순간이동 앞뒤).

### NPC (idle 6f 1.2s, 8방향)

`npc_elder`(지팡이 든 흰 수염 노인, 초록 옷), `npc_merchant`(큰 배낭의 행상, 노란 옷), `npc_smith`(앞치마, 망치), `npc_guard`(붉은 망토, 창), `npc_keeper`(열쇠 꾸러미, 보라 옷).

### 일반 몬스터 (96×96, 8방향)

동작: `idle 4f 0.8s 반복`, `walk 6f 0.6s 반복`, `attack 6f 0.5s`, `hit 3f 0.24s`, `death 7f 0.7s`.

- `mushroom`: 빨간 갓의 걷는 버섯 병사, 나무 곤봉.
- `boar`: 등에 가시가 돋은 멧돼지(네 발). `attack`은 머리 들이받기.
- `wisp`: 떠다니는 초록 도깨비불, 작은 이끼 덩어리 몸. 발이 없고 공중에 떠 있다.
- `ashwolf`: 재색 늑대, 붉게 빛나는 눈과 등줄기.
- `emberbug`: 낮게 기는 작은 불씨 딱정벌레(몸집 작게).
- `golem`: 금 간 돌덩이 골렘, 틈새로 주황빛. 큰 팔.
- `cultist`: 찢어진 검은 로브에 꺼진 등불을 든 사람. `attack`은 등불을 들어 올리는 시전 동작.
- `shade`: 반투명 보랏빛 그림자 인간형, 긴 손톱.

### 보스 (192×192, 5방향 + 뒤집기)

동작: `idle 6f 1.4s 반복`, `walk 8f 1.0s 반복`, `slam 8f 0.9s`, `sweep 8f 0.8s`, `cast 8f 1.0s`, `hit 3f 0.3s`, `death 12f 1.6s`.

- `elder`: 걸어 다니는 거대한 이끼 고목. 큰 나뭇가지 팔, 가슴에 빛나는 호박색 옹이 눈.
- `warden`: 거대한 갑옷 기사, 머리 대신 꺼져 가는 등불, 쇠사슬 달린 큰 철퇴. 푸른빛 불꽃.

### 소품 (`props/`)

마을: `house_a house_b house_c tavern smithy shop_stall well big_lantern lantern_post fence_u fence_v crate barrel sign bench tree_oak tree_pine bush rock_s rock_l stump log hay cart`
숲: `tree_moss_l tree_moss_s tree_moss_dead mush_cluster mossy_rock fallen_log ruin_pillar ruin_arch fern`
잿벌판: `tree_dead ash_rock_s ash_rock_l ember_vent broken_cart bone_pile`
던전: `wall_stone wall_ash pillar torch door_arch chest chest_open rubble statue`
공통: `portal_arch waystone`

- `wall_stone`, `wall_ash`: 정확히 1×1칸을 채우는 높이 1.4 유닛의 벽 덩어리. 이웃과 붙여 놓으면 이어진 벽처럼 보인다. `fp [-0.5,-0.5,0.5,0.5]`.
- `fence_u`는 `u`축 방향, `fence_v`는 `v`축 방향. 이어 붙일 수 있는 1칸 길이.
- `portal_arch`: 돌 아치, 안쪽은 비워 둔다(게임이 빛 효과를 얹는다).
- `waystone`: 꼭대기에 유리 등불이 달린 돌 기둥.
- 건물 `fp`는 3×3칸 안팎, 집 문은 화면 앞쪽(왼쪽 아래 또는 오른쪽 아래)으로.

### 아이템 아이콘

`sword_1 sword_2 sword_3 sword_4 staff_1 staff_2 staff_3 staff_4 bow_1 bow_2 bow_3 bow_4 helm_1 helm_2 helm_3 armor_1 armor_2 armor_3 boots_1 boots_2 boots_3 ring_1 ring_2 amulet_1 amulet_2 potion_hp_s potion_hp_l potion_mp_s potion_mp_l scroll_home ember_shard moss_core boar_tusk ash_core warden_seal gold rift_token key`

숫자가 클수록 더 화려하게.

### 스킬 아이콘

`w_whirl w_charge w_slam w_cry w_judge m_fireball m_nova m_meteor m_shield m_starfall a_fan a_pierce a_trap a_hawk a_rain roll blink leap guard_w guard_m guard_a`

`w_` 전사 회전베기·돌진·대지 강타·함성·심판의 일격, `m_` 화염구·서리 고리·운석·마나 보호막·별똥비, `a_` 부채꼴 사격·관통 화살·올가미 덫·매의 눈·화살비.

## 품질 기준

- 실루엣만 봐도 누군지 알 수 있어야 한다. 머리와 손에 든 물건이 눈에 띄게.
- 재질이 달라 보여야 한다: 옻칠한 옹기와 금속은 반짝이고, 짚과 돌은 거칠다.
- 애니메이션은 부드럽고 무게감이 있다. 공격은 준비→빠른 타격→회수.
- 저사양 대비: 설정의 그래픽 `낮음`은 그림자와 풀을 끄고 잎을 줄인다. `자동`은 느리면 스스로 낮춘다.
