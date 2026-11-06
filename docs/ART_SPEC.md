# 등불길 아트 명세

모든 그림은 이 저장소의 코드로 직접 만든다. 외부 에셋을 쓰지 않는다.

## 방향

가을 해 질 녘의 한옥 마을과 그 너머 지역. 큰 머리 인형 대신 5등신 인물, 파스텔 동화풍 집 대신 곡선 기와와 돌담, 평평한 색면 대신 잎·풀·돌 하나하나의 결. 찰흙처럼 둥글고 매끈한 면을 피한다.

## 그리는 방법

- 실시간 3D. `client/src/render3d`가 three.js로 960×540 안팎의 낮은 해상도에 그리고 최근접으로 키운다.
- 모델은 전부 코드로 짓는다(`geo.ts`). 둥근 덩어리 대신 각진 면, 줄지은 기와, 쌓은 돌, 잎 카드.
- 빛: 끊어지는 띠로 나눈 해와 등불, 실제 그림자, 지역별 공기(`atmos.ts`). 어두운 윤곽은 검정이 아니라 물체 색의 진한 그늘이다.
- 흔들림: 옷자락과 머리카락은 스프링으로, 나무와 풀은 바람으로 움직인다.
- 인물은 따로 비춘다(`USE_BONES`): 면을 나누지 않은 둥근 빛, 앞에서 오는 보조광, 가장자리 빛으로 배경에서 떠오르게 한다.
- 도트가 떨리지 않게: 카메라와 인물은 화면 픽셀에 맞춰 놓고, 그림자는 그림자 격자에 맞춘다.
- 점검: `node tools/lookdev/run.mjs <폴더> town:30:30:이름`, 움직임은 `node tools/lookdev/film.mjs <파일.mp4>`. 둘 다 헤드리스다.

## 좌표와 카메라

- 월드 좌표 `(u, v)`, 1칸 = 1 유닛. 화면 변환: `x = u * 50`, `y = v * 27.5`, 높이 1유닛 = 41.75px (`shared/core.ts`).
- 카메라: 직교, 정면에서 약 33도 내려다본다. 화면 오른쪽이 `+u`, 아래가 `+v`.
- 해: 화면 왼쪽 앞에서 낮게 들어오는 금빛. 사람 키는 약 2 유닛(약 85px).
- 방향 번호는 서버와 같다(`DIR_VEC`). 모델은 방향 사이를 부드럽게 돈다.

## 구워서 쓰는 것

아이콘만 굽는다. `client/public/art/icons/items.png`, `skills.png`는 `icons/*.json`의 `{ "cell":32, "cols":8, "ids":[...] }` 순서를 따른다. 32×32 도트.

`art/props/props.json`은 그림이 아니라 소품의 바닥 차지 영역(`fp`)과 충돌(`solid`) 표다. `tools/genmaps.ts`가 읽는다. `fp`를 바꾸면 지도를 다시 만든다.

`tools/bake/page`의 `rig.js`와 동작 표는 실시간 모델이 그대로 쓴다. 옛 비율로 만든 사람 동작은 `chars.ts`의 `retarget`이 새 비율로 옮긴다.

## 블렌더 짐승 (스킨드 모델)

짐승은 블렌더에서 만든 스킨드 모델(glb)로 바꾸는 중이다. glb가 있는 짐승은 그 모델을, 없는 짐승은 코드로 지은 모델(`beasts.ts`)을 쓴다.

- 만드는 법: `tools/blender/beastlib.py`(공용) + 종별 스크립트. 개과(여우·늑대·승냥이·너구리·구미호)는 `tools/blender/canid.py <종> client/public/models`, 덩치 큰 짐승(호랑이·반달가슴곰·멧돼지)은 `tools/blender/big.py <종> client/public/models`.
  1. 부위마다 단면 곡면을 짓고 복셀 재메시로 하나로 합친 뒤 이음새를 녹인다.
  2. 정점마다 겉면이 가장 가까운 부위(몸통·머리·꼬리·다리 마디)를 찾아 부위 기준으로 털 무늬를 칠한다.
  3. 약 3천 개 삼각형으로 줄이고 128px 텍스처로 굽는다 (`Closest` 보간).
  4. 표준 네발 뼈대를 심고 자동 가중치로 붙인다. 다리는 발 목표점(IK)으로 움직인다.
  5. 서기·걷기·물기·맞기·쓰러지기(보스는 sweep·slam·cast)를 키프레임으로 넣고 12fps로 뽑아 glb로 내보낸다.
- 게임(`client/src/render3d/skinned.ts`): 정점마다 뼈 4개를 섞는 스키닝, 텍스처 색, 뼈 가중치로 나눈 안쪽 외곽선(몸·머리·꼬리·다리 넷), 동작은 12fps로 끊어 재생. `fire`로 시작하는 뼈에 붙은 정점은 스스로 빛난다.
- 작은 덧붙이(발톱 등)는 자동 가중치가 엉뚱한 뼈에 붙여 걸을 때 떨어져 보이므로 넣지 않는다.
- 블렌더는 `/Applications/Blender.app/Contents/MacOS/Blender`로 직접 부른다 (홈브루 링크 경로로 부르면 내장 파이썬이 뜨지 않았다).
- 그림 점검 도구에서 `이름@old`로 부르면 예전 코드 모델이 나와 나란히 비교할 수 있다.

## 목록

### 플레이어 (4.5등신, 한복풍)

`pc_warrior_a|b|c`, `pc_mage_a|b|c`, `pc_archer_a|b|c`. a·b·c는 얼굴·머리·옷 색 변형. 뒤에 `#<gearVisualKey>`를 붙이면 그 장비를 입은 모델이 된다 (`render3d/pc.ts`). 장비 조합마다 모델 하나를 지어 함께 쓰므로 인물 하나는 그리기 호출 하나다.

입은 장비는 겉모습을 바꾼다. 비교 사진: `node tools/lookdev/gear.mjs <폴더>`.

| 슬롯 | 없음 | 1단계 | 2단계 | 3단계 |
|---|---|---|---|---|
| 투구 | 머리와 머리띠 | 가죽 모자, 갓, 벙거지 (직업별) | 철 투구: 챙, 볼끼, 붉은 술 | 재 강철 투구: 날개 판, 달아오른 이음매, 긴 깃 |
| 갑옷 | 흰 저고리와 바지 | 누빈 옷 | 쇠사슬과 앞치마 또는 어깨걸이 | 찰갑, 큰 어깨 판, 망토 또는 가슴판 |
| 신발 | 맨발 | 버선과 짚신, 행전 | 무릎까지 오는 가죽 장화 | 푸른 바람 신발, 날리는 끈, 뒤꿈치 날개 |
| 반지 | - | 구리 띠와 보석 | 호박 띠, 빛나는 보석 | - |
| 목걸이 | - | 작은 등불 | 구슬 줄과 푸른 등불 | - |

무기는 4단계다. 전사의 방패는 막기의 일부라 늘 들고, 칼 단계를 따라 좋아진다.

- 칼: 견습(짧고 무딤) → 철날(환도) → 이끼왕(이끼 낀 돌날, 초록 빛) → 등불지기(넓은 대검, 푸른 불꽃, 자루 끝 등불)
- 지팡이: 등잔(곧은 막대) → 구리(구부러진 끝, 초롱) → 이끼왕(굽은 가지, 초록 빛) → 꺼지지 않는 등잔(키 큰 검은 자루, 금테, 큰 등불)
- 활: 사냥꾼(짧은 나무) → 곡궁(각궁) → 이끼왕(덩굴, 초록 끝) → 새벽(크고 흰 활, 금 장식)

등급과 강화도 보인다.

- 등급: 테두리·앞치마·투구 술이 등급 색(고급 초록, 희귀 파랑, 영웅 보라)으로 물든다. 희귀부터 테두리가 빛난다.
- 강화: 값은 +4, +7, +10에서 단계가 오른다. 칼날은 빛의 날이 생기고 커지며, +10에는 불꽃 조각이 인다. 지팡이는 빛 고리가 1·2·3개, 활은 활대를 따라 빛줄기가 굵어진다.

동작: `idle 6f 1.2s 반복`, `walk 8f 0.64s 반복`, `attack1 6f 0.32s`, `attack2 6f 0.32s`, `attack3 7f 0.46s`, `cast 7f 0.5s`, `spin 6f 0.5s`, `dodge 6f 0.38s`, `guard 3f 0.12s`(마지막 프레임 유지), `hit 3f 0.24s`, `death 8f 0.8s`.

- warrior `attack1~3`: 베기→되베기→내려치기, `spin`: 팽이 회전베기.
- mage `attack1~3`: 지팡이 찌르기→휘두르기→두 손 뻗기, `spin`: 지팡이 땅 찍기.
- archer `attack1~3`: 빠른 활쏘기(3번은 크게 당기기), `spin`: 뒤로 몸을 돌리며 쏘기.
- `dodge`: warrior·archer는 구르기·뛰어오르기, mage는 몸을 웅크렸다 펴기(순간이동 앞뒤).

### NPC (idle 6f 1.2s, 8방향)

`npc_elder`(담우, 마을 어른: 갓, 흰 수염, 지팡이), `npc_merchant`(보따, 보부상: 지게와 봇짐), `npc_smith`(철구, 대장장이: 앞치마, 망치), `npc_guard`(하진, 포교: 전립, 창), `npc_keeper`(유림, 곳간지기: 열쇠 꾸러미).

### 일반 몬스터: 조선 땅의 짐승

설화 속 요괴는 보스만 맡는다. 짐승마다 제 체형의 뼈대·걸음·털 무늬를 갖는다(`beasts.ts`, 공통 도구는 `beastkit.ts`). 몸통은 엉덩이·허리·깊은 가슴·비스듬히 솟는 목 순서의 단면을 이어 짓고(`torso`), 다리는 어깨·넓적다리가 굵고 관절을 덮는 표준 단면(`legProf`)을 쓴다. 털 무늬는 정점마다 칠한다. 내부 id는 지도·퀘스트·저장 데이터 때문에 예전 이름 그대로이고, 보이는 이름과 모델은 `shared/monsters.ts`의 `name`, `sheet`가 정한다.

| 순서 | 이름 | 모델(sheet) | 내부 id | 지역 | 기준 레벨 |
|---|---|---|---|---|---|
| 1 | 다람쥐 | squirrel | mushroom | 솔모루 숲 서쪽 | 1 |
| 2 | 너구리 | raccoon | wisp | 솔모루 숲 북쪽 | 3 |
| 3 | 멧돼지 | boar | boar | 솔모루 숲 남쪽 | 5 |
| 4 | 여우 | fox | fox | 여우굴 | 6 |
| 5 | 늑대 | wolf | ashwolf | 화전골 | 9 |
| 6 | 승냥이 (무리) | dhole | emberbug | 화전골 | 10 |
| 7 | 반달가슴곰 | bear | golem | 화전골 | 12 |
| 8 | 호랑이 | tiger | cultist | 화전골 서쪽 바위산 | 14 |
| 9 | 박쥐 | bat | shade | 옛 쇠부리터 | 15 |

| 짐승 | 알아보는 표시 | 걸음·공격 |
|---|---|---|
| 다람쥐 | 등의 검은 줄 다섯, 눈 위아래 흰 줄, 볼주머니, 세운 털꼬리 | 깡충 뛰기, 뛰어올라 물기 |
| 너구리 | 눈가를 감싼 검은 털, 흰 콧등, 볼털, 검은 다리·가슴·어깨 띠, 짧고 굵은 꼬리 | 종종걸음, 물기 |
| 멧돼지 | 솟은 어깨와 등 갈기, 쐐기 머리와 납작한 코, 위로 휜 엄니, 갈라진 굽 | 종종걸음, 들이받기 |
| 여우 | 붉은 털, 흰 볼·가슴, 검은 버선과 귀 끝, 흰 끝 굵은 꼬리 | 종종걸음, 덮쳐 물기 |
| 늑대 | 짙은 안장 무늬, 밝은 주둥이·볼털, 굵은 목, 검은 끝 꼬리 | 종종걸음, 덮쳐 물기 |
| 승냥이 | 녹슨 붉은 털, 둥근 귀, 짧은 주둥이, 검고 풍성한 꼬리 | 종종걸음, 물기 |
| 반달가슴곰 | 검은 털, 둥근 큰 귀, 갈색 주둥이, 가슴의 흰 V, 발톱 | 어깨를 흔드는 네 박자 걸음, 일어서 내려치기 |
| 호랑이 | 몸을 두르는 검은 줄, 둥근 얼굴과 흰 주둥이·볼털, 흰 점 있는 검은 귀, 고리 무늬 꼬리 | 머리를 낮춘 네 박자 걸음, 앞발로 덮치기 |
| 박쥐 | 큰 귀, 붉은 눈, 손가락 뼈 사이 막 날개 | 날갯짓, 급강하 |

### 보스: 설화 속 요괴

- 구미호(`elder`, sheet `gumiho`): 금빛이 도는 흰 여우. 이마의 붉은 불꽃 무늬, 목의 붉은 끈과 방울, 부채처럼 펼친 꼬리 아홉, 꼬리 끝마다 푸른 여우불. 여우굴 끝에 있다.
- 불가사리(`warden`, sheet `bulgasari`): 쇠를 먹고 자란 짐승. 설화대로 곰의 몸에 코끼리 코(두 마디), 코뿔소 같은 쇠뿔, 소꼬리, 녹슨 줄무늬의 범 다리. 등줄기에 쇠바늘, 몸 곳곳에 쇳물처럼 달아오른 틈. 옛 쇠부리터에 있다.

보스는 전용 동작을 갖는다. 구미호: 몸을 비틀어 꼬리로 후려치기(sweep), 뛰어올라 짓누르기(slam), 꼬리를 펼치고 울부짖기(cast). 불가사리: 머리와 코 휘두르기(sweep), 일어서 짓밟기(slam), 코를 쳐들고 울부짖기(cast).

### 소품 (`props/`)

마을·지역: `stone_pagoda seonang house_a house_b house_c hall gate_tall pavilion tavern smithy shop_stall well big_lantern lantern_post fence_u fence_v crate barrel jars sign bench dangsan jangseung sotdae scarecrow hongsal bridge_u bridge_v plank_u plank_v tree_oak tree_pine tree_persimmon bush rock_s rock_l stump log hay cart`
숲: `tree_moss_l tree_moss_s tree_moss_dead mush_cluster mossy_rock fallen_log ruin_pillar ruin_arch fern`
잿벌판: `tree_dead ash_rock_s ash_rock_l ember_vent broken_cart bone_pile`
던전: `wall_stone wall_ash pillar torch door_arch chest chest_open rubble statue`
공통: `portal_arch waystone`

- `wall_stone`, `wall_ash`: 정확히 1×1칸을 채우는 높이 1.4 유닛의 벽 덩어리. 이웃과 붙여 놓으면 이어진 벽처럼 보인다. `fp [-0.5,-0.5,0.5,0.5]`.
- `fence_u`는 `u`축 방향, `fence_v`는 `v`축 방향. 이어 붙일 수 있는 1칸 길이.
- `portal_arch`: 돌 아치, 안쪽은 비워 둔다(게임이 빛 효과를 얹는다).
- `waystone`: 꼭대기에 유리 등불이 달린 돌 기둥.
- 건물 `fp`는 3×3칸 안팎, 집 문은 화면 앞쪽으로.
- 카메라가 화면 아래쪽에서 보므로, 키 큰 것은 길의 위쪽(화면 뒤)에 둔다. 화면 앞쪽 가장자리에는 낮은 덤불만 둔다.
- 다리는 물 위에 걸린다. 걷는 구역은 지도의 `bridges`에 적고, 상판 높이는 `terrain.ts`의 `bridgeDeck`과 모델이 같은 곡선을 쓴다.

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
