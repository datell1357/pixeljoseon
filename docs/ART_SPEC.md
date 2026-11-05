# 등불길 아트 명세

모든 그림은 이 저장소의 코드로 직접 만든다. 외부 에셋을 쓰지 않는다.

## 좌표와 카메라

- 월드 좌표 `(u, v)`, 1칸 = 1 유닛. 화면 변환: `x = (u - v) * 32`, `y = (u + v) * 16` (타일 64×32).
- 3D 굽기 카메라: 직교, 방위각 45°, 앙각 30°. `+u`는 화면 오른쪽 아래, `+v`는 화면 왼쪽 아래.
- 배율: 수평 1 유닛 = 45.25px, 높이 1 유닛 = 39.2px. 사람 키는 약 1.4 유닛(약 55px).
- 방향 순서(시계 방향): `S, SW, W, NW, N, NE, E, SE`. `S`는 화면 아래(`+u+v`), `E`는 화면 오른쪽(`+u-v`).
- 빛: 화면 왼쪽 위에서 오는 따뜻한 주광 + 차가운 약한 환경광. 모든 에셋이 같은 빛을 쓴다.

## 출력 위치와 형식

모두 `client/public/art/` 아래에 쓴다. PNG는 투명 배경, 격자 칸 안에 그린다.

### 캐릭터 `chars/<id>.png` + `chars/<id>.json`

```json
{
  "cell": [96, 96],
  "anchor": [48, 76],
  "cols": 22,
  "dirs": ["S","SW","W","NW","N","NE","E","SE"],
  "mirror": false,
  "anims": {
    "idle": { "start": 0, "frames": 6, "dur": 1.2, "loop": true }
  }
}
```

- 프레임 번호 = `start + dirIndex * frames + f`. 격자는 행 우선, 한 줄에 `cols`칸.
- `anchor`는 칸 안에서 발이 닿는 지점.
- `mirror: true`면 `dirs`는 `S,SW,W,NW,N` 5개만 굽고, 게임이 `SE,E,NE`를 좌우 뒤집어 쓴다.
- 칸 크기: 사람·일반 몬스터 96×96 앵커 (48,76). 보스 192×192 앵커 (96,150), `mirror: true`.
- 모든 시트 폭·높이는 4096px 이하.

### 소품 `props/props.png` + `props/props.json`

```json
{ "house_a": { "x":0, "y":0, "w":200, "h":220, "ax":100, "ay":180, "fp":[-1.5,-1.5,1.5,1.5], "solid":true, "hu":3 } }
```

- `ax, ay`: 그림 안에서 월드 좌표 기준점(바닥 중심)의 픽셀 위치.
- `fp`: 기준점 기준 바닥 차지 영역 `[u0, v0, u1, v1]`(유닛). `solid`면 충돌.
- `h`: 그림 높이(픽셀). `hu`: 높이(유닛), 깊이 정렬 참고용.

### 지형 `terrain/terrain.png` + `terrain/terrain.json`

```json
{ "tw":64, "th":32, "cols":16, "full": { "grass":[0,1,2,3] }, "edge": { "dirt": 96 } }
```

- 타일은 정확한 2:1 마름모 계단(`y<16: 반폭 (y+1)*2`, `y>=16: 반폭 (32-y)*2`). 이웃 타일이 빈틈 없이 맞물리고, 변을 따라 2px 겹치는 픽셀은 값이 같다.
- `full[이름]`: 지형당 변형 4장(칸 번호).
- `edge[이름]`: 겹침 지형의 시작 칸 번호. 이어지는 16칸은 모서리 마스크 `n = N*1 + E*2 + S*4 + W*8`에 대응한다(마름모의 네 꼭짓점 중 해당 지형인 곳). 부드럽고 불규칙한 가장자리를 가진 알파 그림이고, `n=15`는 꽉 찬 칸이다.
- 지형 이름: `grass meadow forest dirt cobble ash scorch cave stone water lava`.
- `full`은 전부, `edge`는 `meadow forest dirt cobble ash scorch stone water lava`.
- 물과 용암은 게임에서 색이 밝게 깜빡이도록 처리하니 바탕만 그린다.

### 아이콘 `icons/items.png` + `icons/items.json`, `icons/skills.png` + `icons/skills.json`

`{ "cell":32, "cols":8, "ids":["sword_1", ...] }`. 칸 번호는 `ids`의 순서. 32×32 도트.

## 목록

### 플레이어 (사람 비율, 큰 머리의 2.5등신)

`pc_warrior_a|b|c`, `pc_mage_a|b|c`, `pc_archer_a|b|c`. a·b·c는 머리·옷 색 변형.

- warrior: 강철 판금, 망토, 왼손 원형 방패, 오른손 한손검.
- mage: 두건 달린 로브, 오른손 끝에 작은 등불이 달린 지팡이.
- archer: 가죽 두건과 조끼, 등에 화살통, 왼손 활.

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
- 도트 느낌: 고해상도로 렌더한 뒤 최근접으로 줄이고 알파를 이진화한다. 색 단계 3~4개의 셀 셰이딩, 1px 어두운 외곽선.
- 반복 동작에서 키가 튀지 않는다. 발은 앵커에 붙어 있다.
- 방향 전환 시 몸 크기와 위치가 일정하다.
- 애니메이션은 부드럽고 무게감이 있다. 공격은 준비→빠른 타격→회수.
