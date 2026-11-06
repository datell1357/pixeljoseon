# 사람 인물: MPFB(블렌더용 MakeHuman, CC0 기본 몸)로 7등신 몸과 게임용 뼈대를 만들고,
# 몸을 복사해 옷을 짓는다. 복사한 옷은 몸의 뼈 가중치를 그대로 물려받는다.
# 실행: Blender -b --factory-startup --addons bl_ext.user_default.mpfb -P tools/blender/human.py -- <인물> <출력 폴더> [shape|all]
import sys, os, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy, bmesh
import beastlib as B
from beastlib import lin, mixc
from mathutils import Vector, Matrix, Quaternion, kdtree, noise

argv = sys.argv[sys.argv.index('--') + 1:]
WHO = argv[0]
OUT = os.path.abspath(argv[1])
STAGE = argv[2] if len(argv) > 2 else 'all'
os.makedirs(OUT, exist_ok=True)

import addon_utils
addon_utils.enable('bl_ext.user_default.mpfb', default_set=True)
from bl_ext.user_default.mpfb.services.humanservice import HumanService
from bl_ext.user_default.mpfb.services.targetservice import TargetService

scene = B.reset()

# ---------------- 인물 설정 ----------------
# 옷 구성 값: sleeve 아래팔 소매 넉넉함(m), vest 소매 없는 겉옷, skirt 자락(밑단 높이 기준·트임), belt 허리띠 반폭,
# head 'band' 머리띠 / 'gat' 갓, wrap 행전
LOOK = {
    'musa': dict(
        macro=dict(gender=1.0, age=0.5, muscle=0.68, weight=0.48, proportions=1.0, height=0.62),
        skin=0xe8bf98, hair=0x1c1616, under=0x8a2c2c, coat=0x2c3f66, trim=0xc9913e, collar=0xe8e2d4,
        belt=0x3a2418, band=0xa8302c, pants=0x38333e, wrap=0xd8d2c4, boots=0x2a221e,
        sleeve=0.016, vest=True, skirt=dict(hem='knee', drop=0.17, open='front', flare=0.55, color='coat'),
        beltw=0.022, head='band', wraps=True,
    ),
    'dosa': dict(
        # 흰 도포에 갓. 소매가 넓고 자락이 발목까지 온다
        macro=dict(gender=1.0, age=0.56, muscle=0.45, weight=0.42, proportions=1.0, height=0.6),
        skin=0xe8c09c, hair=0x1a1618, under=0xe6e0d0, coat=0xe6e0d0, trim=0x2c4a6e, collar=0x2c4a6e,
        belt=0x8a2f35, band=0x1e1c22, pants=0xd8d2c4, wrap=0xd8d2c4, boots=0x1e1c22,
        sleeve=0.05, vest=False, skirt=dict(hem='ankle', drop=-0.1, open='back', flare=0.7, color='under'),
        beltw=0.009, head='gat', wraps=False,
    ),
    'gungsa': dict(
        # 짧은 동달이에 가죽 조끼, 행전. 날렵한 몸
        macro=dict(gender=1.0, age=0.47, muscle=0.6, weight=0.4, proportions=1.0, height=0.6),
        skin=0xe0b48c, hair=0x1e1814, under=0x56683e, coat=0x6e4c30, trim=0xc9a65a, collar=0xe4dccc,
        belt=0x2c2018, band=0xa8382e, pants=0x4a4436, wrap=0xd8d0be, boots=0x2c241e,
        sleeve=0.004, vest=True, skirt=dict(hem='knee', drop=-0.12, open='side', flare=0.35, color='under'),
        beltw=0.018, head='band', wraps=True,
    ),
    # ---- 마을 사람 ----
    'npc_elder': dict(
        # 담우: 흰 머리·수염의 마을 어른. 초록 두루마기, 갓, 지팡이
        macro=dict(gender=1.0, age=0.95, muscle=0.35, weight=0.45, proportions=0.8, height=0.45),
        skin=0xeabf9a, hair=0xdcdad2, brow=0xe6e4dc, under=0x4e6e54, coat=0x4e6e54, trim=0xd8cdb0, collar=0xeeeae0,
        belt=0xd8cdb0, band=0x1e1c22, pants=0xd8d2c4, wrap=0xd8d2c4, boots=0x2a2428,
        sleeve=0.03, vest=False, skirt=dict(hem='knee', drop=0.12, open='back', flare=0.5, color='under'),
        beltw=0.01, head='gat', wraps=False, beard=0xefeee8, item='cane',
    ),
    'npc_merchant': dict(
        # 보따: 보부상 아낙. 노란 저고리, 붉은 치마, 패랭이, 등짐
        macro=dict(gender=0.0, age=0.45, muscle=0.45, weight=0.5, proportions=1.0, height=0.45),
        skin=0xf0c8a4, hair=0x2c1e1a, under=0xd2a84c, coat=0xd2a84c, trim=0x9a3a30, collar=0xf0ead8, cuff=0x9a3a30,
        belt=0x7a3c34, band=0xc4a464, pants=0x7a3c34, wrap=0x7a3c34, boots=0x3a2a20,
        sleeve=0.012, vest=False, skirt=dict(hem='ankle', drop=-0.06, open='none', flare=0.6, color='pants', top='chest'),
        beltw=0, head='straw', wraps=False, pack=True,
    ),
    'npc_smith': dict(
        # 철구: 맨팔에 가죽 앞치마, 머릿수건, 망치
        macro=dict(gender=1.0, age=0.6, muscle=0.95, weight=0.62, proportions=0.9, height=0.55),
        skin=0xd8a57e, hair=0x1c1614, under=0x54382a, coat=0x54382a, trim=0x3a2a20, collar=0x8a6a4a,
        belt=0x2c221c, band=0xe4dcc4, pants=0x45404a, wrap=0x45404a, boots=0x2a2020,
        sleeve=0.0, vest=False, skirt=dict(hem='knee', drop=0.05, open='apron', flare=0.2, color='under'),
        beltw=0.02, head='band', wraps=False, bare=True, item='hammer',
    ),
    'npc_guard': dict(
        # 하진: 포교. 붉은 철릭, 쪽빛 소매·바지, 전립, 창
        macro=dict(gender=1.0, age=0.5, muscle=0.7, weight=0.5, proportions=1.0, height=0.62),
        skin=0xecbc92, hair=0x1c1614, under=0x263a5e, coat=0xa42e2c, trim=0xd2a24a, collar=0xe9e2d0,
        belt=0x2c221c, band=0x26242c, pants=0x263a5e, wrap=0x4a3a2c, boots=0x241c1c,
        sleeve=0.006, vest=True, skirt=dict(hem='knee', drop=-0.02, open='front', flare=0.45, color='coat'),
        beltw=0.02, head='jeonrip', wraps=True, item='spear',
    ),
    'npc_keeper': dict(
        # 유림: 곳간지기. 흰 저고리, 보라 치마, 쪽머리에 금비녀
        macro=dict(gender=0.0, age=0.5, muscle=0.4, weight=0.45, proportions=1.0, height=0.5),
        skin=0xf2cba6, hair=0x2a2028, under=0xe9e2d0, coat=0xe9e2d0, trim=0xd2a24a, collar=0x5c4670, cuff=0x5c4670,
        belt=0x5c4670, band=0xd2a24a, pants=0x5c4670, wrap=0xe9e2d0, boots=0xe9e2d0,
        sleeve=0.012, vest=False, skirt=dict(hem='ankle', drop=-0.06, open='none', flare=0.7, color='pants', top='chest'),
        beltw=0, head='bun', wraps=False, keys=True,
    ),
}[WHO]
NPC = WHO.startswith('npc_')


def make_body():
    m = dict(LOOK['macro'])
    m.update(cupsize=0.2 if LOOK['macro']['gender'] < 0.5 else 0.45, firmness=0.5, race=dict(asian=1.0, caucasian=0.0, african=0.0))
    for o in list(bpy.data.objects):
        bpy.data.objects.remove(o)
    h = HumanService.create_human(macro_detail_dict=m)
    rig = HumanService.add_builtin_rig(h, 'game_engine')
    TargetService.bake_targets(h)
    for md in list(h.modifiers):
        if md.type == 'MASK':
            h.modifiers.remove(md)
    return h, rig


body, rig = make_body()
BONES = [b.name for b in rig.data.bones]


def gidx(o):
    return {g.index: g.name for g in o.vertex_groups}


def dominant(o):
    """정점마다 가장 크게 끄는 뼈 이름"""
    names = gidx(o)
    out = []
    for v in o.data.vertices:
        best, bw = None, 0.0
        for g in v.groups:
            nm = names[g.group]
            if nm in BONES and g.weight > bw:
                best, bw = nm, g.weight
        out.append(best)
    return out


def in_group(o, name, th=0.5):
    gi = o.vertex_groups[name].index
    return [any(g.group == gi and g.weight >= th for g in v.groups) for v in o.data.vertices]


def dup(src, name):
    o = src.copy()
    o.data = src.data.copy()
    o.name = name
    B.link(o)
    for md in list(o.modifiers):
        if md.type != 'ARMATURE':
            o.modifiers.remove(md)
    return o


def keep_verts(o, keep):
    """keep[i]가 거짓인 정점을 지운다"""
    bm = bmesh.new()
    bm.from_mesh(o.data)
    bm.verts.ensure_lookup_table()
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if not keep[v.index]], context='VERTS')
    bm.to_mesh(o.data)
    bm.free()


def keep_faces(o, fn):
    """fn(면의 정점 번호들) → 남길지. 남은 면에 안 쓰인 정점은 지운다"""
    bm = bmesh.new()
    bm.from_mesh(o.data)
    bmesh.ops.delete(bm, geom=[f for f in bm.faces if not fn([v.index for v in f.verts])], context='FACES_ONLY')
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context='VERTS')
    bm.to_mesh(o.data)
    bm.free()


def smooth(o, n=2, f=0.5):
    bm = bmesh.new()
    bm.from_mesh(o.data)
    for _ in range(n):
        bmesh.ops.smooth_vert(bm, verts=bm.verts, factor=f, use_axis_x=True, use_axis_y=True, use_axis_z=True)
    bm.to_mesh(o.data)
    bm.free()


def solidify(o, t):
    md = o.modifiers.new('sol', 'SOLIDIFY')
    md.thickness = t
    md.offset = -1
    B.select_only(o)
    bpy.ops.object.modifier_move_to_index(modifier='sol', index=0)
    bpy.ops.object.modifier_apply(modifier='sol')


# 몸의 기준 높이(블렌더 미터, 발바닥 0)
def bone_head(n):
    return rig.matrix_world @ rig.data.bones[n].head_local


def bone_tail(n):
    return rig.matrix_world @ rig.data.bones[n].tail_local


Z_HEAD = bone_head('head').z
Z_NECK = bone_head('neck_01').z
Z_WAIST = bone_head('spine_01').z
Z_HIP = bone_head('pelvis').z
Z_KNEE = bone_head('calf_l').z
Z_ANKLE = bone_head('foot_l').z
TOP = max((body.matrix_world @ v.co).z for v in body.data.vertices)
print('heights', round(TOP, 3), 'head', round(Z_HEAD, 3), 'waist', round(Z_WAIST, 3), 'knee', round(Z_KNEE, 3))

DOM = dominant(body)
IS_BODY = in_group(body, 'body')
TORSO = {'pelvis', 'spine_01', 'spine_02', 'spine_03', 'clavicle_l', 'clavicle_r'}
ARM = {'upperarm_l', 'upperarm_r', 'lowerarm_l', 'lowerarm_r'}
LEG = {'thigh_l', 'thigh_r', 'calf_l', 'calf_r'}
FOOT = {'foot_l', 'foot_r', 'ball_l', 'ball_r'}

parts = []  # (물체, 칠하기 함수)

# ---------------- 몸(맨살: 머리·목·손) ----------------
skin = dup(body, 'skin')
eyes = dup(body, 'eyes')
keep_verts(eyes, [a or b for a, b in zip(in_group(body, 'helper-l-eye'), in_group(body, 'helper-r-eye'))])

V = [body.matrix_world @ v.co for v in body.data.vertices]


def covered(i):
    d = DOM[i]
    z = V[i].z
    if LOOK.get('bare'):
        # 맨몸 윗도리: 다리와 엉덩이만 옷에 덮인다
        return d in LEG or d in FOOT or (d == 'pelvis' and z < Z_HIP + 0.03)
    if d in TORSO or d in LEG or d in FOOT or d == 'upperarm_l' or d == 'upperarm_r':
        return True
    if d in ('lowerarm_l', 'lowerarm_r'):
        return True
    if d == 'neck_01' and z < Z_NECK + 0.02:
        return True
    return False


# 옷에 덮이는 살은 지운다(옷을 뚫고 나오지 않게, 삼각형도 아낀다)
keep_faces(skin, lambda vs: all(IS_BODY[i] for i in vs) and not all(covered(i) for i in vs))

LIPS = in_group(body, 'lips')
EAR = in_group(body, 'ears')

# 눈 위치(눈썹·눈 칠하기용)
EYE_C = []
for gname in ('helper-l-eye', 'helper-r-eye'):
    sel = in_group(body, gname)
    pts_ = [V[i] for i in range(len(V)) if sel[i]]
    EYE_C.append(sum(pts_, Vector()) / len(pts_))
EYE_R = max((V[i] - EYE_C[0]).length for i in range(len(V)) if in_group(body, 'helper-l-eye')[i])
print('eyes', [tuple(round(c, 3) for c in e) for e in EYE_C], 'r', round(EYE_R, 4))
HEAD_C = Vector((0, (EYE_C[0].y + EYE_C[1].y) / 2 + 0.085, (EYE_C[0].z + Z_HEAD) / 2))

# ---------------- 옷 ----------------
# 경계는 면을 잘라 내지 않는다. 넉넉히 복사한 뒤 경계 밖 정점을 살 속으로 밀어 넣으면 선이 매끄럽다.


def sstep(a, b, x):
    t = max(0.0, min(1.0, (x - a) / (b - a)))
    return t * t * (3 - 2 * t)


def wsum(names):
    idx = {body.vertex_groups[n].index for n in names if n in body.vertex_groups}
    return [sum(g.weight for g in v.groups if g.group in idx) for v in body.data.vertices]


W_UARM = wsum(['upperarm_l', 'upperarm_r'])
W_LARM = wsum(['lowerarm_l', 'lowerarm_r', 'hand_l', 'hand_r'])
NECK_Y = bone_head('neck_01').y


def shell(name, sel, amt, smooth_n=0, smooth_f=0.5):
    """sel(정점 번호) → 복사할지, amt(정점 번호, 좌표) → 법선 방향 거리(음수면 살 속으로)"""
    o = dup(body, name)
    keep_faces(o, lambda vs: all(IS_BODY[i] for i in vs) and all(sel(i) for i in vs))
    # 복사 뒤 정점 번호가 바뀌므로 원래 몸 정점을 가까운 점으로 되찾는다
    src = [bkd.find(o.matrix_world @ v.co)[1] for v in o.data.vertices]
    if smooth_n:
        smooth(o, smooth_n, smooth_f)
    me = o.data
    me.update()
    new = [v.co + v.normal * amt(src[k], v.co) for k, v in enumerate(me.vertices)]
    for v, c in zip(me.vertices, new):
        v.co = c
    return o


bkd = kdtree.KDTree(len(V))
for i, p in enumerate(V):
    bkd.insert(p, i)
bkd.balance()


def collar_line(p, drop=0.0):
    """깃 선 높이: 앞은 V자로 깊게, 뒤는 목덜미까지"""
    front = max(0.0, NECK_Y - p.y)
    v = 0.075 * max(0.0, 1 - abs(p.x - 0.012) / 0.075) * sstep(0.0, 0.05, front)
    return Z_NECK + 0.012 - v - drop


belt_z = Z_WAIST - 0.01

# 저고리(속옷 소매): 몸통과 팔. 소매는 손목으로 갈수록 넉넉하다
shirt = None
if not LOOK.get('bare'):
  shirt = shell('shirt',
              lambda i: DOM[i] in TORSO | ARM or (DOM[i] == 'neck_01' and V[i].z < Z_NECK + 0.05),
              lambda i, co: (0.009 + LOOK['sleeve'] * sstep(0.2, 1.0, W_LARM[i])) * sstep(-0.004, 0.004, collar_line(V[i]) - V[i].z) - 0.004 * (1 - sstep(-0.004, 0.004, collar_line(V[i]) - V[i].z)),
              smooth_n=6)

# 쾌자(남색 겉옷): 소매 없는 몸판. 진동둘레와 깃은 매끄럽게 파묻는다
coat = None
if LOOK['vest']:
  coat = shell('coat',
             lambda i: (DOM[i] in TORSO or (DOM[i] in ('upperarm_l', 'upperarm_r') and W_UARM[i] < 0.8)) and belt_z - 0.05 < V[i].z < Z_NECK + 0.05,
             lambda i, co: 0.02 * sstep(0.5, 0.3, W_UARM[i]) * sstep(-0.004, 0.004, collar_line(V[i], 0.02) - V[i].z) - 0.006 * (1 - sstep(0.5, 0.3, W_UARM[i]) * sstep(-0.004, 0.004, collar_line(V[i], 0.02) - V[i].z)),
             smooth_n=10)

# 자락: 허리띠 아래로 퍼진다. 고리마다 몸(다리 포함)보다 넉넉하게, 주름을 준다
SK = LOOK['skirt']
bm = bmesh.new()
rings = 16 if SK['hem'] == 'knee' else 22
seg = 48
hem = (Z_KNEE if SK['hem'] == 'knee' else Z_ANKLE) - SK['drop']
top = bone_head('spine_02').z + 0.02 if SK.get('top') == 'chest' else belt_z - 0.01
radii = []
for r in range(rings):
    z = top + (hem - top) * r / (rings - 1)
    ps = [V[i] for i in range(len(V)) if IS_BODY[i] and abs(V[i].z - z) < 0.02 and (DOM[i] in TORSO | LEG)]
    rx = max(abs(p.x) for p in ps) + 0.035
    ymin = min(p.y for p in ps) - 0.035
    ymax = max(p.y for p in ps) + 0.035
    if radii:
        prx, pmn, pmx = radii[-1]
        rx, ymin, ymax = max(rx, prx + 0.004), min(ymin, pmn - 0.003), max(ymax, pmx + 0.003)
    radii.append((rx, ymin, ymax))
grid = []
for r in range(rings):
    t = r / (rings - 1)
    z = top + (hem - top) * t
    rx, ymin, ymax = radii[r]
    cy, ry = (ymin + ymax) / 2, (ymax - ymin) / 2
    fl = 1 + (SK['flare'] - 0.55) * 0.3 * t
    row = []
    for s_ in range(seg):
        a = (s_ + 0.5) / seg * math.tau
        pleat = 1 + 0.035 * t * math.sin(a * 16)
        row.append(bm.verts.new((math.sin(a) * rx * pleat * fl, cy - math.cos(a) * ry * pleat * fl, z)))
    grid.append(row)
for r in range(rings - 1):
    for s_ in range(seg):
        # 트임: 앞(무사 쾌자), 뒤(도포), 양옆(동달이)
        if SK['open'] == 'apron':
            # 앞치마: 앞쪽 3분의 1만
            a_ = (s_ + 1) / seg * math.tau
            if min(a_, math.tau - a_) > 1.0:
                continue
        else:
            slit = {'front': (0, seg - 1), 'back': (seg // 2 - 1, seg // 2), 'side': (seg // 4 - 1, seg // 4, 3 * seg // 4 - 1, 3 * seg // 4), 'none': ()}[SK['open']]
            if s_ in slit and r > rings * (0.2 if SK['open'] == 'front' else 0.55):
                continue
        bm.faces.new((grid[r][s_], grid[r + 1][s_], grid[r + 1][(s_ + 1) % seg], grid[r][(s_ + 1) % seg]))
bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
me = bpy.data.meshes.new('skirt')
bm.to_mesh(me)
bm.free()
skirt = B.link(bpy.data.objects.new('skirt', me))
solidify(skirt, 0.005)
SKIRT_HEM = hem

# 허리띠
BW = LOOK['beltw']
belt = None
if BW > 0:
  belt = shell('belt', lambda i: DOM[i] in TORSO and abs(V[i].z - belt_z) < 0.06,
             lambda i, co: 0.034 * sstep(BW + 0.003, BW - 0.003, abs(V[i].z - belt_z)) - 0.006 * (1 - sstep(BW + 0.003, BW - 0.003, abs(V[i].z - belt_z))),
             smooth_n=4)

# 바지: 허벅지는 넉넉하게, 종아리 아래는 행전으로 조인다


def pants_amt(i, co):
    z = V[i].z
    w = 0.026 if z > Z_KNEE + 0.05 else 0.009 + 0.017 * sstep(Z_KNEE - 0.12, Z_KNEE + 0.05, z)
    return w * sstep(Z_ANKLE + 0.06, Z_ANKLE + 0.075, z) - 0.004 * (1 - sstep(Z_ANKLE + 0.06, Z_ANKLE + 0.075, z))


pants = shell('pants', lambda i: (DOM[i] in LEG or (DOM[i] == 'pelvis' and V[i].z < Z_HIP + 0.04)) and V[i].z > Z_ANKLE + 0.03,
              pants_amt, smooth_n=6)

# 신발(목 있는 가죽신): 발 정점의 볼록 껍질이라 발가락이 드러나지 않는다
bm = bmesh.new()
for sd in ('l', 'r'):
    pts_ = [V[i] for i in range(len(V)) if IS_BODY[i] and (DOM[i] in ('foot_' + sd, 'ball_' + sd) or (DOM[i] == 'calf_' + sd and V[i].z < Z_ANKLE + 0.13))]
    cen = sum(pts_, Vector()) / len(pts_)
    vs = [bm.verts.new(p + (p - Vector((cen.x, cen.y, p.z))).normalized() * 0.008 + Vector((0, 0, 0.002 if p.z > 0.02 else -0.0))) for p in pts_]
    bmesh.ops.convex_hull(bm, input=vs)
bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context='VERTS')
# 위쪽 뚜껑(신발 목 안) 면은 지운다
bmesh.ops.delete(bm, geom=[f for f in bm.faces if f.normal.z > 0.9 and f.calc_center_median().z > Z_ANKLE + 0.1], context='FACES')
bmesh.ops.triangulate(bm, faces=bm.faces)
bmesh.ops.subdivide_edges(bm, edges=[e for e in bm.edges if e.calc_length() > 0.03], cuts=1, use_grid_fill=True)
me = bpy.data.meshes.new('boots')
bm.to_mesh(me)
bm.free()
boots = B.link(bpy.data.objects.new('boots', me))

# 머리카락: 두피를 덮는다. 이마 선은 매끄럽게 파묻는다
brow_z = EYE_C[0].z + 0.03


def hairline(p):
    back = p.y - HEAD_C.y
    side = abs(p.x)
    return max(brow_z + 0.024 + 0.08 * max(0.0, side - 0.045) - max(0.0, back + 0.03) * 1.7, Z_NECK + 0.03)


hair = shell('hair', lambda i: DOM[i] in ('head', 'neck_01') and not EAR[i] and V[i].z > Z_NECK + 0.0,
             lambda i, co: 0.011 * sstep(-0.004, 0.004, V[i].z - hairline(V[i])) - 0.004 * (1 - sstep(-0.004, 0.004, V[i].z - hairline(V[i]))),
             smooth_n=2)

# 머리띠: 이마를 두른다


def band_d(p):
    return abs(p.z - (brow_z + 0.05 - max(0.0, p.y - HEAD_C.y) * 0.2))


band = shell('band', lambda i: DOM[i] == 'head' and band_d(V[i]) < 0.03 and not EAR[i],
             lambda i, co: 0.018 * sstep(0.014, 0.01, band_d(V[i])) - 0.004 * (1 - sstep(0.014, 0.01, band_d(V[i]))),
             smooth_n=2)

# 갓: 넓은 챙과 높은 모자집(도사). 머리띠(망건) 위에 얹는다
gat = None
if LOOK['head'] == 'gat':
    bm = bmesh.new()
    hz = brow_z + 0.06
    hc = Vector((0, HEAD_C.y + 0.005, hz))
    tilt = Matrix.Rotation(math.radians(-6), 4, 'X')
    bmesh.ops.create_cone(bm, cap_ends=True, segments=40, radius1=0.21, radius2=0.2, depth=0.006, matrix=Matrix.Translation(hc) @ tilt)
    bmesh.ops.create_cone(bm, cap_ends=True, segments=28, radius1=0.085, radius2=0.075, depth=0.13, matrix=Matrix.Translation(hc + Vector((0, 0, 0.068))) @ tilt)
    me = bpy.data.meshes.new('gat')
    bm.to_mesh(me)
    bm.free()
    gat = B.link(bpy.data.objects.new('gat', me))

# 상투(남자) 또는 쪽머리와 비녀(여자)
bm = bmesh.new()
if LOOK['head'] == 'bun' or LOOK['macro']['gender'] < 0.5:
    nape = Vector((0, HEAD_C.y + 0.085, Z_HEAD + 0.02))
    bmesh.ops.create_uvsphere(bm, u_segments=20, v_segments=12, radius=0.045, matrix=Matrix.Translation(nape) @ Matrix.Diagonal((1.25, 0.8, 0.85, 1)))
else:
    crown = Vector((0, HEAD_C.y + 0.01, TOP + 0.005))
    bmesh.ops.create_uvsphere(bm, u_segments=20, v_segments=12, radius=0.032, matrix=Matrix.Translation(crown + Vector((0, 0, 0.022))) @ Matrix.Diagonal((1, 1, 1.2, 1)))
me = bpy.data.meshes.new('topknot')
bm.to_mesh(me)
bm.free()
topknot = B.link(bpy.data.objects.new('topknot', me))

# 머리 위 쓰개: 전립(포교), 패랭이(보부상), 비녀(쪽머리)
hat = None
if LOOK['head'] in ('jeonrip', 'straw', 'bun'):
    bm = bmesh.new()
    hc = Vector((0, HEAD_C.y + 0.005, brow_z + 0.055))
    tilt = Matrix.Rotation(math.radians(-6), 4, 'X')
    if LOOK['head'] == 'jeonrip':
        bmesh.ops.create_cone(bm, cap_ends=True, segments=36, radius1=0.2, radius2=0.17, depth=0.012, matrix=Matrix.Translation(hc) @ tilt)
        bmesh.ops.create_uvsphere(bm, u_segments=20, v_segments=10, radius=0.1, matrix=Matrix.Translation(hc + Vector((0, 0, 0.02))) @ tilt @ Matrix.Diagonal((1, 1, 0.95, 1)))
        bmesh.ops.create_uvsphere(bm, u_segments=10, v_segments=6, radius=0.035, matrix=Matrix.Translation(hc + Vector((0, 0.01, 0.13))))
    elif LOOK['head'] == 'straw':
        bmesh.ops.create_cone(bm, cap_ends=True, segments=36, radius1=0.2, radius2=0.075, depth=0.075, matrix=Matrix.Translation(hc + Vector((0, 0, 0.03))) @ tilt)
    else:
        nape = Vector((0, HEAD_C.y + 0.09, Z_HEAD + 0.02))
        bmesh.ops.create_cone(bm, cap_ends=True, segments=8, radius1=0.006, radius2=0.006, depth=0.15, matrix=Matrix.Translation(nape + Vector((0, 0.01, 0))) @ Matrix.Rotation(math.radians(90), 4, 'Y'))
    me = bpy.data.meshes.new('hat')
    bm.to_mesh(me)
    bm.free()
    hat = B.link(bpy.data.objects.new('hat', me))
    HAT_C = hc
if LOOK['head'] in ('jeonrip', 'straw', 'bun', 'gat') or LOOK['macro']['gender'] < 0.5:
    # 쓰개 아래나 여자 머리에는 머리띠를 두르지 않는다
    if LOOK['head'] != 'gat':
        bpy.data.objects.remove(band)
        band = None

# 수염(어른): 턱과 입가를 덮는다
beard = None
if LOOK.get('beard'):
    MOUTH_Z = EYE_C[0].z - 0.075

    def beard_amt(i, co):
        p = V[i]
        k = sstep(MOUTH_Z + 0.03, MOUTH_Z - 0.0, p.z) if not LIPS[i] else 0.0
        # 콧수염: 입술 바로 위 가는 띠
        if abs(p.z - (MOUTH_Z + 0.022)) < 0.006 and abs(p.x) < 0.03:
            k = 1.0
        return 0.009 * k - 0.004 * (1 - k)

    beard = shell('beard', lambda i: DOM[i] in ('head', 'neck_01') and V[i].y < HEAD_C.y - 0.03 and V[i].z < MOUTH_Z + 0.04 and V[i].z > Z_NECK + 0.02,
                  beard_amt, smooth_n=2)

# ---------------- 가중치: 새로 지은 물체 ----------------


def weight_from_body(o, only=None):
    """가장 가까운 몸 정점의 가중치를 옮긴다"""
    md = o.modifiers.new('dt', 'DATA_TRANSFER')
    md.object = body
    md.use_vert_data = True
    md.data_types_verts = {'VGROUP_WEIGHTS'}
    md.vert_mapping = 'POLYINTERP_NEAREST'
    md.layers_vgroup_select_src = 'ALL'
    md.layers_vgroup_select_dst = 'NAME'
    B.select_only(o)
    bpy.ops.object.datalayout_transfer(modifier='dt')
    bpy.ops.object.modifier_apply(modifier='dt')


def weight_all(o, bone):
    g = o.vertex_groups.new(name=bone)
    g.add(list(range(len(o.data.vertices))), 1.0, 'REPLACE')


weight_from_body(skirt)
weight_from_body(boots)
weight_all(topknot, 'head')
for o in (gat, hat):
    if o:
        weight_all(o, 'head')

# ---------------- 칠하기 ----------------
C = {k: lin(v) for k, v in LOOK.items() if isinstance(v, int) and not isinstance(v, bool)}


def grain(co, k=1.0, s=90):
    return 1 + k * 0.06 * noise.noise(co * s)


def paint(o, fn):
    me = o.data
    attr = me.color_attributes.new('Col', 'FLOAT_COLOR', 'POINT')
    mw = o.matrix_world
    me.update()
    for v in me.vertices:
        co = mw @ v.co
        c = fn(co, v.normal, v.index)
        attr.data[v.index].color = (min(1, c[0]), min(1, c[1]), min(1, c[2]), 1)
    me.color_attributes.active_color = attr




def skin_col(co, n, i):
    c = C['skin']
    _, j, _ = bkd.find(co)
    # 입술
    if LIPS[j]:
        c = mixc(c, lin(0xb06a60), 0.3)
    # 눈썹: 눈 위 띠 (어른은 흰 눈썹)
    for e in EYE_C:
        dx = abs(co.x - e.x)
        dz = co.z - (e.z + 0.022 - (dx - 0.0) ** 2 * 6)
        if co.y < e.y + 0.01 and dx < 0.032 and abs(dz) < 0.0045 and abs(co.x) > 0.008:
            c = mixc(c, C.get('brow', C['hair']), 0.9)
    # 눈두덩 살짝 어둡게, 볼 붉게
    for e in EYE_C:
        d = (co - e).length
        if d < EYE_R * 1.5:
            c = mixc(c, [x * 0.86 for x in C['skin']], 0.3)
    k = grain(co, 0.5, 140)
    return [x * k for x in c]


def eye_col(co, n, i):
    e = EYE_C[0] if co.x * EYE_C[0].x > 0 else EYE_C[1]
    d = co - e
    fwd = -d.y / max(1e-6, d.length)
    if fwd > 0.975:
        return lin(0x14100e)
    if fwd > 0.93:
        return lin(0x3a2418)
    return lin(0xe8e2d8)


def cloth(base, k=1.0):
    def f(co, n, i):
        g = grain(co, k, 220) * (1 + 0.04 * noise.noise(co * 35))
        return [x * g for x in base]
    return f


def coat_col(co, n, i):
    c = C['coat']
    _, j, _ = bkd.find(co)
    # 깃과 진동둘레에 금빛 선
    if collar_line(V[j], 0.02) - V[j].z < 0.014 or W_UARM[j] > 0.28:
        c = C['trim']
    # 옷깃 테두리(앞섶·목둘레·진동둘레)
    g = grain(co, 0.8, 220)
    return [x * g for x in c]


def skirt_col(co, n, i):
    c = C[SK['color']]
    # 밑단에 선, 무사는 앞트임에도
    if co.z < SKIRT_HEM + 0.025:
        c = C['trim']
    a = math.atan2(co.x, -(co.y - 0.0))
    if SK['open'] == 'front' and abs(a) < 0.2:
        c = C['trim']
    g = grain(co, 0.8, 220)
    return [x * g for x in c]


def pants_col(co, n, i):
    if LOOK['wraps'] and co.z < Z_KNEE - 0.06:
        c = C['wrap']
        # 행전 끈
        if abs((co.z - Z_ANKLE) % 0.05 - 0.025) < 0.004:
            c = mixc(c, lin(0x6a5a48), 0.7)
        return [x * grain(co, 0.8, 220) for x in c]
    return [x * grain(co, 0.8, 220) for x in C['pants']]


def hair_col(co, n, i):
    k = 1 + 0.14 * noise.noise(Vector((co.x * 400, co.y * 400, co.z * 40)))
    return [x * k for x in C['hair']]


paint(skin, skin_col)
paint(eyes, eye_col)
def shirt_col(co, n, i):
    _, j, _ = bkd.find(co)
    c = C['under']
    # 깃 띠(무사·궁사는 흰 동정, 도사는 쪽빛 깃)
    if collar_line(V[j]) - V[j].z < 0.008:
        c = C['collar']
    # 소매 끝동: 도포는 쪽빛 수구, 저고리는 끝동 색
    if 'cuff' in LOOK and W_LARM[j] > 0.5 and (co - (bone_head('hand_l') if co.x > 0 else bone_head('hand_r'))).length < 0.07:
        c = C['cuff']
    if LOOK['sleeve'] > 0.03 and W_LARM[j] > 0.5 and (co - (bone_head('hand_l') if co.x > 0 else bone_head('hand_r'))).length < 0.06:
        c = C['trim']
    return [x * grain(co, 0.8, 220) for x in c]


if shirt:
    paint(shirt, shirt_col)
if coat:
    paint(coat, coat_col)
paint(skirt, skirt_col)
if belt:
    paint(belt, cloth(C['belt']))
paint(pants, pants_col)
paint(boots, cloth(C['boots'], 0.5))
paint(hair, hair_col)
paint(topknot, hair_col)
if band:
    paint(band, cloth(C['band']))
if hat:
    if LOOK['head'] == 'jeonrip':
        paint(hat, lambda co, n, i: lin(0xb5302a) if co.z > HAT_C.z + 0.1 else [x * grain(co, 0.5, 200) for x in lin(0x26242c)])
    elif LOOK['head'] == 'straw':
        paint(hat, lambda co, n, i: [x * (1 + 0.18 * math.sin(math.atan2(co.x, co.y) * 60)) for x in lin(0xc4a464)])
    else:
        paint(hat, lambda co, n, i: lin(0xd2a24a))
if beard:
    paint(beard, lambda co, n, i: [x * (1 + 0.12 * noise.noise(Vector((co.x * 500, co.y * 500, co.z * 60)))) for x in C['beard']])
if gat:
    # 갓은 반쯤 비치는 검은 대나무 결
    paint(gat, lambda co, n, i: [x * (1 + 0.25 * noise.noise(Vector((co.x * 300, co.y * 300, co.z * 20)))) for x in lin(0x1e1c22)])

PARTS = [o for o in (skin, eyes, shirt, coat, skirt, belt, pants, boots, hair, topknot, band, gat, hat, beard) if o]
for o in PARTS:
    for pl in o.data.polygons:
        pl.use_smooth = True
for o in (body,):
    o.hide_render = True
    o.hide_viewport = True

def preview(name, objs, scale, target, yaws=(0, 35, 90), el=12):
    """사람은 -Y를 본다. yaw 0이 정면"""
    for o in scene.objects:
        o.hide_render = o not in objs
    cam = bpy.data.cameras.new('cam')
    cam.type = 'ORTHO'
    cam.ortho_scale = scale
    co = B.link(bpy.data.objects.new('cam', cam))
    scene.camera = co
    scene.render.engine = 'BLENDER_WORKBENCH'
    scene.display.shading.light = 'STUDIO'
    scene.display.shading.color_type = 'VERTEX'
    scene.display.shading.show_cavity = True
    scene.render.resolution_x, scene.render.resolution_y = 640, 900
    out = []
    for i, yaw in enumerate(yaws):
        e, y = math.radians(el), math.radians(yaw)
        pos = target + Vector((math.cos(e) * math.sin(y), -math.cos(e) * math.cos(y), math.sin(e))) * 4
        co.location = pos
        co.rotation_euler = (target - pos).to_track_quat('-Z', 'Y').to_euler()
        f = os.path.join(OUT, f'{name}_{i}.png')
        scene.render.filepath = f
        bpy.ops.render.render(write_still=True)
        out.append(f)
    bpy.data.objects.remove(co)
    return out


shots = preview(WHO, PARTS, 2.0, Vector((0, 0, 0.9)))
shots += preview(WHO + '_face', PARTS, 0.36, Vector((0, EYE_C[0].y, EYE_C[0].z - 0.01)), yaws=(0, 30))
print('SHOTS', shots)
if STAGE == 'shape':
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT, WHO + '_shape.blend'))
    sys.exit(0)

# ---------------- 무기: 환도(오른손)와 둥근 방패(왼팔) ----------------


def bone_frame(n):
    b = rig.data.bones[n]
    m = rig.matrix_world @ b.matrix_local
    return m.to_translation(), m.to_3x3()


def make_obj(name, bm):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    return B.link(bpy.data.objects.new(name, me))


def fist(sd):
    """주먹 좌표계: grip(쥔 곳), M 열 = (두께, 주먹을 가로지르는 축(엄지 쪽), 손바닥 쪽), along(손목→손가락)"""
    h0, hm = bone_frame('hand_' + sd)
    along = (hm @ Vector((0, 1, 0))).normalized()
    k_i, k_p = bone_head('index_01_' + sd), bone_head('pinky_01_' + sd)
    axis = (k_i - k_p)
    axis = (axis - along * axis.dot(along)).normalized()
    palm = along.cross(axis).normalized()
    if palm.dot(bone_head('thumb_02_' + sd) - h0) < 0:
        palm = -palm
    grip = (k_i + k_p) / 2 + along * 0.035 + palm * 0.028
    side = axis.cross(palm).normalized()
    return grip, Matrix((side, axis, palm)).transposed(), along


def loft_into(bm, grip, M, secs, n=4):
    """secs: [(축 위치, 두께, 너비, 손바닥 쪽 휨)] → 단면을 이은 막대. n=4 사각, 그 이상은 둥근 단면"""
    rings_ = []
    for y, tx, wz, cz in secs:
        ring = []
        for k in range(n):
            a = (k + 0.5) / n * math.tau
            ring.append(bm.verts.new(grip + M @ Vector((math.cos(a) * tx / 2 * (1.41 if n == 4 else 1), y, cz + math.sin(a) * wz / 2 * (1.41 if n == 4 else 1)))))
        rings_.append(ring)
    for r0, r1 in zip(rings_, rings_[1:]):
        for k in range(n):
            bm.faces.new((r0[k], r0[(k + 1) % n], r1[(k + 1) % n], r1[k]))
    bm.faces.new(rings_[0][::-1])
    bm.faces.new(rings_[-1])


WEAPONS = []
if WHO == 'musa':
    grip, M, along = fist('r')
    blade = M.col[1]
    bm = bmesh.new()

    def loft(secs):
        loft_into(bm, grip, M, secs)

    loft([(-0.13, 0.03, 0.034, 0), (0.05, 0.03, 0.034, 0)])                # 자루
    loft([(0.05, 0.075, 0.08, 0), (0.065, 0.075, 0.08, 0)])                 # 코등이
    L = 0.72
    loft([(0.065 + L * t, 0.008 * (1 - 0.4 * t), 0.036 * (1 - 0.35 * t ** 2) if t < 0.97 else 0.004, 0.05 * t * t) for t in [i / 10 for i in range(11)]])
    sword = make_obj('sword', bm)
    weight_all(sword, 'hand_r')

    def sword_col(co, n, i):
        d = (co - grip).dot(blade)
        if d < 0.049:
            return lin(0x3a2418)
        if d < 0.066:
            return lin(0xc9913e)
        return [x * (1.0 + 0.2 * max(0, n.z)) for x in lin(0xb8bcc4)]
    paint(sword, sword_col)

    a0, am = bone_frame('lowerarm_l')
    a1 = bone_tail('lowerarm_l')
    arm = (a1 - a0).normalized()
    out = Vector((1, 0, 0))
    out = (out - arm * out.dot(arm)).normalized()
    c = a0.lerp(a1, 0.55) + out * 0.07
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=28, radius1=0.25, radius2=0.25, depth=0.025,
                          matrix=Matrix.Translation(c) @ out.to_track_quat('Z', 'Y').to_matrix().to_4x4())
    bmesh.ops.create_uvsphere(bm, u_segments=12, v_segments=6, radius=0.05,
                              matrix=Matrix.Translation(c + out * 0.015) @ out.to_track_quat('Z', 'Y').to_matrix().to_4x4() @ Matrix.Diagonal((1, 1, 0.5, 1)))
    shield = make_obj('shield', bm)
    weight_all(shield, 'lowerarm_l')
    SH_C, SH_N = c, out

    def shield_col(co, n, i):
        r = (co - SH_C - SH_N * (co - SH_C).dot(SH_N)).length
        if r < 0.055:
            return lin(0xc9913e)
        if r > 0.225:
            return lin(0x6a5038)
        # 태극 비슷한 두 색 대신 붉은 판에 쇠 띠
        if abs(r - 0.15) < 0.012:
            return lin(0x6a5038)
        return [x * grain(co, 0.6, 120) for x in lin(0x8a2c28)]
    paint(shield, shield_col)
    WEAPONS = [sword, shield]

if WHO == 'dosa':
    # 초롱대: 주먹을 꿰뚫는 긴 지팡이, 꼭대기에 초롱
    grip, M, along = fist('r')
    bm = bmesh.new()
    loft_into(bm, grip, M, [(-0.62, 0.026, 0.026, 0), (1.05, 0.022, 0.022, 0)], n=8)
    loft_into(bm, grip, M, [(1.02, 0.03, 0.03, 0), (1.06, 0.03, 0.03, 0), (1.1, 0.012, 0.012, 0.04), (1.12, 0.012, 0.012, 0.08)], n=6)
    top = grip + M @ Vector((0, 1.06, 0.1))
    bmesh.ops.create_cone(bm, cap_ends=True, segments=8, radius1=0.055, radius2=0.055, depth=0.12, matrix=Matrix.Translation(top + Vector((0, 0, -0.1))))
    bmesh.ops.create_cone(bm, cap_ends=True, segments=8, radius1=0.07, radius2=0.02, depth=0.04, matrix=Matrix.Translation(top + Vector((0, 0, -0.02))))
    staff = make_obj('staff', bm)
    weight_all(staff, 'hand_r')
    LANTERN = top + Vector((0, 0, -0.1))

    def staff_col(co, n, i):
        if (co - LANTERN).length < 0.075 and abs(co.z - LANTERN.z) < 0.055:
            # 한지 초롱: 붉은 갓에 노란 불빛
            return lin(0xf2c06a) if abs(co.z - LANTERN.z) < 0.045 else lin(0x8a2f35)
        if co.z > LANTERN.z + 0.05:
            return lin(0x8a2f35)
        return [x * grain(co, 0.8, 200) for x in lin(0x5a3a26)]
    paint(staff, staff_col)
    WEAPONS = [staff]

if WHO == 'gungsa':
    # 각궁(왼손): 줌통에서 두 고자로 뻗고, 고자는 사수 쪽으로 휜다. 시위는 두 끝을 곧게 잇는다
    grip, M, along = fist('l')
    bm = bmesh.new()
    back = -1.0  # 손바닥 쪽(M 셋째 열)과 사수 쪽의 관계는 미리보기로 맞춘다
    secs_up, secs_dn = [], []
    for k in range(13):
        u = k / 12
        bend = -0.13 * u ** 1.6 + (0.035 * ((u - 0.82) / 0.18) ** 2 if u > 0.82 else 0)
        w = 0.03 * (1 - 0.55 * u)
        secs_up.append((0.05 + 0.55 * u, 0.018, w, bend))
        secs_dn.append((-0.05 - 0.55 * u, 0.018, w, bend))
    loft_into(bm, grip, M, [(-0.06, 0.03, 0.04, 0), (0.06, 0.03, 0.04, 0)], n=6)
    loft_into(bm, grip, M, secs_up, n=4)
    loft_into(bm, grip, M, secs_dn, n=4)
    tip_u = grip + M @ Vector((0, secs_up[-1][0], secs_up[-1][3]))
    tip_d = grip + M @ Vector((0, secs_dn[-1][0], secs_dn[-1][3]))
    loft_into(bm, grip, M, [(secs_dn[-1][0], 0.004, 0.004, secs_dn[-1][3] - 0.004), (secs_up[-1][0], 0.004, 0.004, secs_up[-1][3] - 0.004)], n=4)
    bow = make_obj('bow', bm)
    weight_all(bow, 'hand_l')
    BOW_G = grip

    def bow_col(co, n, i):
        d = (co - BOW_G).length
        if d < 0.065:
            return lin(0x6a2c24)
        return [x * grain(co, 0.6, 160) for x in lin(0x3a2a1e)] if n.dot(M.col[2]) > 0 else [x * grain(co, 0.6, 160) for x in lin(0xb8925a)]
    paint(bow, bow_col)

    # 화살통: 오른 어깨 뒤에서 왼 허리로 비스듬히
    bm = bmesh.new()
    sh = bone_head('clavicle_r') + Vector((0, 0.14, 0.02))
    hip = Vector((0.12, bone_head('spine_01').y + 0.13, Z_WAIST - 0.05))
    d = (sh - hip)
    q = d.normalized().to_track_quat('Z', 'Y').to_matrix().to_4x4()
    mid = (sh + hip) / 2
    bmesh.ops.create_cone(bm, cap_ends=True, segments=12, radius1=0.05, radius2=0.06, depth=d.length * 0.85, matrix=Matrix.Translation(mid) @ q)
    for k in range(5):
        off = Vector(((k - 2) * 0.016, (k % 2) * 0.012, 0))
        base_ = sh + d.normalized() * 0.0 + off
        bmesh.ops.create_cone(bm, cap_ends=True, segments=4, radius1=0.012, radius2=0.002, depth=0.1, matrix=Matrix.Translation(base_ + d.normalized() * 0.07) @ q)
    quiver = make_obj('quiver', bm)
    weight_all(quiver, 'spine_03')
    QV_TOP = sh

    def quiver_col(co, n, i):
        if (co - QV_TOP).dot(d.normalized()) > -0.01:
            return lin(0xe8e2d4)  # 깃
        return [x * grain(co, 0.8, 200) for x in lin(0x5a3a26)]
    paint(quiver, quiver_col)
    WEAPONS = [bow, quiver]

# ---------------- 마을 사람 소지품 ----------------
IT = LOOK.get('item')
if IT:
    grip, M, along = fist('r')
    bm = bmesh.new()
    if IT == 'cane':
        # 마디진 지팡이: 주먹 아래로 땅까지, 위는 손잡이 혹
        loft_into(bm, grip, M, [(-0.95, 0.022, 0.022, 0), (-0.4, 0.026, 0.026, 0.01), (0.06, 0.028, 0.028, 0)], n=8)
        bmesh.ops.create_uvsphere(bm, u_segments=10, v_segments=6, radius=0.03, matrix=Matrix.Translation(grip + M @ Vector((0, 0.08, 0))))
        cols = (0x5e3d28, 0x704a30)
    elif IT == 'hammer':
        # 자루 끝을 쥐고 쇠머리는 아래로
        loft_into(bm, grip, M, [(0.06, 0.026, 0.026, 0), (-0.42, 0.024, 0.024, 0)], n=8)
        loft_into(bm, grip, M, [(-0.4, 0.08, 0.1, 0), (-0.5, 0.08, 0.1, 0)], n=4)
        cols = (0x5e3d28, 0x3e3e48)
    else:
        # 창: 붉은 술과 날
        loft_into(bm, grip, M, [(-0.85, 0.024, 0.024, 0), (1.15, 0.022, 0.022, 0)], n=8)
        loft_into(bm, grip, M, [(1.15, 0.012, 0.05, 0), (1.25, 0.012, 0.06, 0), (1.42, 0.004, 0.004, 0)], n=4)
        bmesh.ops.create_uvsphere(bm, u_segments=10, v_segments=6, radius=0.045, matrix=Matrix.Translation(grip + M @ Vector((0, 1.11, 0))))
        cols = (0x5e3d28, 0xdce4ee)
    item = make_obj('item', bm)
    weight_all(item, 'hand_r')
    G_, AX_ = grip, M.col[1]

    def item_col(co, n, i):
        y = (co - G_).dot(AX_)
        if IT == 'spear':
            if 1.07 < y < 1.16:
                return lin(0xb5302a)
            if y >= 1.16:
                return lin(0xdce4ee)
        if IT == 'hammer' and y < -0.39:
            return lin(0x3e3e48)
        return [x * grain(co, 0.8, 200) for x in lin(cols[0])]
    paint(item, item_col)
    WEAPONS.append(item)

if LOOK.get('pack'):
    # 등짐: 지게 틀에 얹은 보따리
    bm = bmesh.new()
    back_c = Vector((0, bone_head('spine_02').y + 0.2, bone_head('spine_02').z + 0.05))
    bmesh.ops.create_cube(bm, size=1.0, matrix=Matrix.Translation(back_c) @ Matrix.Diagonal((0.36, 0.22, 0.34, 1)))
    bmesh.ops.create_uvsphere(bm, u_segments=12, v_segments=8, radius=0.13, matrix=Matrix.Translation(back_c + Vector((0, 0.0, 0.26))) @ Matrix.Diagonal((1.3, 0.9, 0.8, 1)))
    for sx in (-0.2, 0.2):
        bmesh.ops.create_cone(bm, cap_ends=True, segments=6, radius1=0.018, radius2=0.018, depth=0.9,
                              matrix=Matrix.Translation(Vector((sx, back_c.y + 0.02, back_c.z - 0.2))))
    pack = make_obj('pack', bm)
    weight_all(pack, 'spine_03')
    PK = back_c

    def pack_col(co, n, i):
        if co.z > PK.z + 0.17:
            return [x * grain(co, 0.8, 120) for x in lin(0x3e5e7a)]
        if abs(co.x) > 0.17 and co.y > PK.y + 0.0:
            return lin(0x5a3f2c)
        return [x * grain(co, 0.8, 120) for x in lin(0x7d6448)]
    paint(pack, pack_col)
    WEAPONS.append(pack)

if LOOK.get('keys'):
    # 허리춤의 열쇠 꾸러미
    bm = bmesh.new()
    kc = Vector((0.1, bone_head('spine_01').y - 0.13, bone_head('spine_02').z - 0.02))
    for k in range(4):
        bmesh.ops.create_cube(bm, size=1.0, matrix=Matrix.Translation(kc + Vector((k * 0.018, 0, -0.03 * (k % 2)))) @ Matrix.Diagonal((0.012, 0.012, 0.07, 1)))
    keys = make_obj('item', bm)
    weight_all(keys, 'spine_01')
    paint(keys, lambda co, n, i: lin(0xd2a24a))
    WEAPONS.append(keys)

for o in WEAPONS:
    for pl in o.data.polygons:
        pl.use_smooth = True

ALL = PARTS + WEAPONS
preview(WHO + '_armed', ALL, 2.0, Vector((0, 0, 0.9)), yaws=(0, 40))

# ---------------- 저폴리 + 질감 굽기 ----------------
# 부위마다 따로 줄이고, 한 장에 UV를 모은 뒤 부위끼리만 굽는다(겹친 옷끼리 색이 새지 않게)
BUDGET = dict(skin=3600, eyes=240, shirt=1500, coat=1100, skirt=1300, belt=260, pants=1200, boots=500,
              hair=900, topknot=200, band=260, sword=200, shield=160, gat=300, staff=260, bow=360, quiver=200,
              hat=300, beard=500, item=300, pack=300)
if LOOK.get('bare'):
    BUDGET['skin'] = 5200
TEX = 512
lows = []
for i, o in enumerate(ALL):
    lo = o.copy()
    lo.data = o.data.copy()
    lo.name = o.name + '_lo'
    B.link(lo)
    tris = sum(len(p.vertices) - 2 for p in lo.data.polygons)
    goal = BUDGET.get(o.name, 400)
    if tris > goal:
        md = lo.modifiers.new('dc', 'DECIMATE')
        md.ratio = goal / tris
        B.select_only(lo)
        bpy.ops.object.modifier_apply(modifier='dc')
    for a in list(lo.data.color_attributes):
        lo.data.color_attributes.remove(a)
    lo.data.materials.clear()
    mt = bpy.data.materials.new('part_' + o.name)
    lo.data.materials.append(mt)
    lows.append(lo)

B.select_only(*lows)
bpy.ops.object.join()
J = bpy.context.view_layer.objects.active
J.name = WHO
bpy.ops.object.mode_set(mode='EDIT')
bpy.ops.mesh.select_all(action='SELECT')
bpy.ops.uv.smart_project(angle_limit=math.radians(66), island_margin=0.006)
bpy.ops.object.mode_set(mode='OBJECT')
print('low tris', sum(len(p.vertices) - 2 for p in J.data.polygons))

img = bpy.data.images.new(WHO + '_tex', TEX, TEX, alpha=False)
emat = bpy.data.materials.new('src')
emat.use_nodes = True
nt = emat.node_tree
nt.nodes.clear()
o_ = nt.nodes.new('ShaderNodeOutputMaterial')
em = nt.nodes.new('ShaderNodeEmission')
vc = nt.nodes.new('ShaderNodeVertexColor')
vc.layer_name = 'Col'
nt.links.new(vc.outputs['Color'], em.inputs['Color'])
nt.links.new(em.outputs['Emission'], o_.inputs['Surface'])
for o in ALL:
    o.data.materials.clear()
    o.data.materials.append(emat)
    o.hide_render = False
    o.hide_viewport = False
# 부위별로 떼어 낸다(재질 번호 = 부위)
B.select_only(J)
bpy.ops.object.mode_set(mode='EDIT')
bpy.ops.mesh.select_all(action='SELECT')
bpy.ops.mesh.separate(type='MATERIAL')
bpy.ops.object.mode_set(mode='OBJECT')
pieces = [o for o in scene.objects if o.type == 'MESH' and o.data.materials and o.data.materials[0].name.startswith('part_')]
lm = bpy.data.materials.new(WHO + '_mat')
lm.use_nodes = True
tn = lm.node_tree.nodes.new('ShaderNodeTexImage')
tn.image = img
tn.interpolation = 'Closest'
lm.node_tree.links.new(tn.outputs['Color'], lm.node_tree.nodes.get('Principled BSDF').inputs['Base Color'])
lm.node_tree.nodes.active = tn
scene.render.engine = 'CYCLES'
scene.cycles.device = 'CPU'
scene.cycles.samples = 1
bk = scene.render.bake
bk.use_selected_to_active = True
bk.cage_extrusion = 0.012
bk.max_ray_distance = 0.04
bk.margin = 2
bk.use_clear = False
by_name = {o.name: o for o in ALL}
for pc in pieces:
    src = by_name[pc.data.materials[0].name[5:]]
    pc.data.materials.clear()
    pc.data.materials.append(lm)
    B.select_only(src, pc)
    bpy.ops.object.bake(type='EMIT')
img.filepath_raw = os.path.join(OUT, WHO + '_tex.png')
img.file_format = 'PNG'
img.save()
img.pack()
B.select_only(*pieces)
bpy.ops.object.join()
low = bpy.context.view_layer.objects.active
low.name = WHO
for g in list(low.vertex_groups):
    if g.name not in BONES:
        low.vertex_groups.remove(g)
for md in list(low.modifiers):
    low.modifiers.remove(md)
low.parent = rig
low.matrix_parent_inverse = rig.matrix_world.inverted()
amd = low.modifiers.new('arm', 'ARMATURE')
amd.object = rig
print('final tris', sum(len(p.vertices) - 2 for p in low.data.polygons), 'verts', len(low.data.vertices))

# ---------------- 동작 ----------------
X_, Y_, Z_ = Vector((1, 0, 0)), Vector((0, 1, 0)), Vector((0, 0, 1))
for pb in rig.pose.bones:
    pb.rotation_mode = 'QUATERNION'
scene.render.fps = 24
rig.animation_data_create()


def hang_angle(side):
    a = bone_head('upperarm_' + side)
    b = bone_tail('lowerarm_' + side)
    d = (b - a).normalized()
    return math.degrees(math.atan2(abs(d.x), -d.z))


HANG = hang_angle('l') - 10
FINGERS = [b for b in BONES if b.split('_')[0] in ('index', 'middle', 'ring', 'pinky')]
THUMBS = [b for b in BONES if b.startswith('thumb')]


def base():
    """쉬는 자세: 팔을 내리고 팔꿈치를 살짝 굽힌다"""
    return {
        'upperarm_l': [0, HANG, 0], 'upperarm_r': [0, -HANG, 0],
        'lowerarm_l': [-18, 0, 0], 'lowerarm_r': [-14, 0, 0],
    }


def add(p, q):
    r = {k: list(v) for k, v in p.items()}
    for k, v in q.items():
        if k in r:
            r[k] = [a + b for a, b in zip(r[k], v)]
        else:
            r[k] = list(v)
    return r


def lerp_pose(a, b, t):
    keys = set(a) | set(b)
    z = [0, 0, 0]
    return {k: [x + (y - x) * t for x, y in zip(a.get(k, z), b.get(k, z))] for k in keys}


def ease(t):
    return t * t * (3 - 2 * t)


def keyed(keys, t):
    """keys: [(시점 0~1, 자세)] 사이를 부드럽게 잇는다"""
    for (t0, p0), (t1, p1) in zip(keys, keys[1:]):
        if t <= t1:
            return lerp_pose(p0, p1, ease((t - t0) / max(1e-6, t1 - t0)))
    return keys[-1][1]


CURL = 62


def set_pose(f, p):
    for pb in rig.pose.bones:
        n = pb.name
        inv = pb.bone.matrix_local.to_3x3().inverted()
        r = p.get(n, [0, 0, 0])
        q = Quaternion(inv @ Z_, math.radians(r[2])) @ Quaternion(inv @ X_, math.radians(r[0])) @ Quaternion(inv @ Y_, math.radians(r[1]))
        if n in FINGERS:
            q = q @ Quaternion((1, 0, 0), math.radians((CURL + p.get('curl', [0])[0]) * (0.8 if n.endswith(('_01_l', '_01_r')) else 1.0)))
        if n in THUMBS:
            q = q @ Quaternion((1, 0, 0), math.radians((CURL + p.get('curl', [0])[0]) * 0.35))
        pb.rotation_quaternion = q
        pb.keyframe_insert('rotation_quaternion', frame=f)
        if n == 'pelvis':
            pb.location = inv @ Vector(p.get('loc', (0, 0, 0)))
            pb.keyframe_insert('location', frame=f)


def clip(name, dur, fn):
    act = bpy.data.actions.new(name)
    act.use_fake_user = True
    rig.animation_data.action = act
    n = max(2, round(dur * 24))
    for f in range(n + 1):
        set_pose(f, fn(f / n))
    print('clip', name, n)


B0 = base()


def idle(t):
    s = math.sin(t * math.tau)
    return add(B0, {'spine_02': [1.5 * s, 0, 0], 'neck_01': [-1.0 * s, 0, 0], 'loc': [0, 0, -0.004 + 0.004 * s],
                    'upperarm_l': [0, 1.5 * s, 0], 'upperarm_r': [0, -1.5 * s, 0]})


def walk(t):
    ph = t * math.tau
    s, c = math.sin(ph), math.cos(ph)
    tl, tr = -26 * s, 26 * s
    cl = 6 + 42 * max(0.0, c) ** 1.3
    cr_ = 6 + 42 * max(0.0, -c) ** 1.3
    return add(B0, {
        'thigh_l': [tl, 0, 0], 'thigh_r': [tr, 0, 0],
        'calf_l': [cl, 0, 0], 'calf_r': [cr_, 0, 0],
        'foot_l': [-(tl + cl) * 0.7, 0, 0], 'foot_r': [-(tr + cr_) * 0.7, 0, 0],
        'loc': [0, 0, -0.012 + 0.012 * math.cos(2 * ph)],
        'spine_01': [4, 0, 0], 'spine_02': [0, 0, 5 * s], 'pelvis': [0, 0, -4 * s],
        'upperarm_l': [10 * s, 0, 0], 'upperarm_r': [-20 * s, 0, 0],
        'lowerarm_r': [-10 - 8 * max(0, -s), 0, 0],
    })


ARM_UP_R = -HANG  # 오른팔을 옆으로 드는 쪽은 +Y


def attack1(t):
    wind = add(B0, {'spine_02': [0, 0, -28], 'spine_01': [0, 0, -10], 'upperarm_r': [-30, HANG + 55, 0], 'lowerarm_r': [-75, 0, 0], 'hand_r': [0, 0, 30]})
    hit = add(B0, {'spine_02': [6, 0, 30], 'spine_01': [0, 0, 12], 'upperarm_r': [-80, HANG + 15, 0], 'lowerarm_r': [-5, 0, 0], 'hand_r': [0, 0, -30],
                   'thigh_r': [-18, 0, 0], 'calf_r': [12, 0, 0], 'loc': [0, -0.04, -0.03]})
    return keyed([(0, B0), (0.3, wind), (0.55, hit), (1.0, add(hit, {}))], t)


def attack2(t):
    wind = add(B0, {'spine_02': [0, 0, 30], 'upperarm_r': [-75, HANG + 5, 0], 'lowerarm_r': [-100, 0, 0], 'hand_r': [0, 0, -40]})
    hit = add(B0, {'spine_02': [6, 0, -30], 'spine_01': [0, 0, -10], 'upperarm_r': [-60, HANG + 60, 0], 'lowerarm_r': [-8, 0, 0], 'hand_r': [0, 0, 30],
                   'thigh_l': [-15, 0, 0], 'calf_l': [10, 0, 0], 'loc': [0, -0.04, -0.03]})
    return keyed([(0, B0), (0.3, wind), (0.55, hit), (1.0, hit)], t)


def attack3(t):
    up = add(B0, {'spine_02': [-10, 0, -8], 'upperarm_r': [-165, HANG - 10, 0], 'lowerarm_r': [-55, 0, 0], 'upperarm_l': [-40, 0, 0],
                  'loc': [0, 0.02, 0.0]})
    down = add(B0, {'spine_02': [24, 0, 4], 'spine_01': [10, 0, 0], 'neck_01': [-14, 0, 0], 'upperarm_r': [-55, HANG - 5, 0], 'lowerarm_r': [-5, 0, 0],
                    'thigh_l': [-38, 0, 0], 'calf_l': [30, 0, 0], 'foot_l': [8, 0, 0], 'thigh_r': [18, 0, 0], 'calf_r': [14, 0, 0], 'loc': [0, -0.1, -0.09]})
    return keyed([(0, B0), (0.38, up), (0.6, down), (1.0, down)], t)


def cast(t):
    raise_ = add(B0, {'spine_02': [-8, 0, 0], 'neck_01': [-10, 0, 0], 'upperarm_r': [-150, HANG - 20, 0], 'lowerarm_r': [-20, 0, 0],
                      'upperarm_l': [-60, 0, 0], 'lowerarm_l': [-50, 0, 0], 'loc': [0, 0, 0.01]})
    return keyed([(0, B0), (0.35, raise_), (0.8, raise_), (1.0, add(raise_, {'upperarm_r': [20, 0, 0]}))], t)


def spin(t):
    arms = add(B0, {'upperarm_r': [-60, HANG + 30, 0], 'lowerarm_r': [-5, 0, 0], 'upperarm_l': [0, -25, 0], 'thigh_l': [-8, 0, 0], 'calf_l': [10, 0, 0], 'thigh_r': [-8, 0, 0], 'calf_r': [10, 0, 0], 'loc': [0, 0, -0.04]})
    p = keyed([(0, B0), (0.15, arms), (0.85, arms), (1.0, B0)], t)
    p['pelvis'] = [p.get('pelvis', [0, 0, 0])[0], 0, 360 * ease(t)]
    return p


def dodge(t):
    tuck = add(B0, {'thigh_l': [-105, 0, 0], 'thigh_r': [-105, 0, 0], 'calf_l': [125, 0, 0], 'calf_r': [125, 0, 0], 'spine_01': [25, 0, 0], 'spine_02': [25, 0, 0],
                    'neck_01': [25, 0, 0], 'upperarm_l': [-60, 0, 0], 'upperarm_r': [-60, 0, 0], 'lowerarm_l': [-70, 0, 0], 'lowerarm_r': [-70, 0, 0]})
    k = math.sin(min(1, t / 0.9) * math.pi)
    p = keyed([(0, B0), (0.2, tuck), (0.75, tuck), (1.0, B0)], t)
    p['pelvis'] = [360 * ease(min(1, t / 0.9)), 0, 0]
    p['loc'] = [0, 0, -0.5 * k]
    return p


GUARD = add(B0, {'upperarm_l': [-62, -HANG + 20, 0], 'lowerarm_l': [-85, 0, 0], 'spine_02': [4, 0, 10], 'upperarm_r': [-15, 0, 0], 'lowerarm_r': [-35, 0, 0],
                 'thigh_l': [-12, 0, 0], 'calf_l': [14, 0, 0], 'thigh_r': [8, 0, 0], 'calf_r': [10, 0, 0], 'loc': [0, 0, -0.04]})


def guard(t):
    return keyed([(0, B0), (1.0, GUARD)], t)


def hit(t):
    flinch = add(B0, {'spine_02': [-14, 0, 6], 'spine_01': [-6, 0, 0], 'neck_01': [-12, 0, 0], 'upperarm_l': [-10, -10, 0], 'upperarm_r': [-10, 10, 0], 'loc': [0, 0.05, -0.02]})
    return keyed([(0, B0), (0.3, flinch), (1.0, B0)], t)


def death(t):
    kneel = add(B0, {'thigh_l': [-30, 0, 0], 'thigh_r': [-20, 0, 0], 'calf_l': [60, 0, 0], 'calf_r': [50, 0, 0], 'spine_02': [-15, 0, 0], 'neck_01': [-15, 0, 0], 'loc': [0, 0.05, -0.25]})
    down = add(B0, {'pelvis': [-88, 0, 0], 'thigh_l': [-10, 0, 0], 'thigh_r': [-25, 0, 0], 'calf_l': [15, 0, 0], 'calf_r': [35, 0, 0],
                    'upperarm_l': [0, -50, 0], 'upperarm_r': [0, 50, 0], 'lowerarm_l': [-10, 0, 0], 'neck_01': [10, 0, 0], 'loc': [0, 0.45, -0.85], 'curl': [20 - CURL, 0, 0]})
    return keyed([(0, B0), (0.35, kneel), (0.8, down), (1.0, down)], t)


# ---------------- 직업별 동작 ----------------
if WHO == 'dosa':
    # 오른손은 초롱대를 세워 든다
    B0 = add(base(), {'lowerarm_r': [-58, 0, 0], 'hand_r': [0, 0, 0]})
    GUARD = add(B0, {'upperarm_r': [-45, 10, 0], 'lowerarm_r': [-40, 0, 0], 'upperarm_l': [-55, -15, 0], 'lowerarm_l': [-70, 0, 0], 'spine_02': [4, 0, -8], 'loc': [0, 0, -0.03]})

    def attack1(t):
        wind = add(B0, {'spine_02': [0, 0, -18], 'upperarm_r': [10, 0, 0], 'lowerarm_r': [-40, 0, 0]})
        hit = add(B0, {'spine_02': [8, 0, 18], 'upperarm_r': [-70, 10, 0], 'lowerarm_r': [30, 0, 0], 'thigh_r': [-15, 0, 0], 'calf_r': [10, 0, 0], 'loc': [0, -0.04, -0.02]})
        return keyed([(0, B0), (0.3, wind), (0.55, hit), (1.0, hit)], t)

    def attack2(t):
        wind = add(B0, {'spine_02': [0, 0, -20], 'upperarm_l': [-40, -20, 0], 'lowerarm_l': [-100, 0, 0], 'curl': [-50, 0, 0]})
        hit = add(B0, {'spine_02': [6, 0, 22], 'upperarm_l': [-85, -HANG + 15, 0], 'lowerarm_l': [-5, 0, 0], 'hand_l': [-50, 0, 0], 'thigh_l': [-15, 0, 0], 'calf_l': [10, 0, 0], 'loc': [0, -0.04, -0.02], 'curl': [-55, 0, 0]})
        return keyed([(0, B0), (0.3, wind), (0.55, hit), (1.0, hit)], t)

    def cast(t):
        up = add(B0, {'spine_02': [-8, 0, 0], 'neck_01': [-10, 0, 0], 'upperarm_r': [-120, 0, 0], 'lowerarm_r': [-10, 0, 0],
                      'upperarm_l': [-80, -HANG + 20, 0], 'lowerarm_l': [-20, 0, 0], 'hand_l': [-40, 0, 0], 'curl': [-50, 0, 0]})
        return keyed([(0, B0), (0.35, up), (0.8, up), (1.0, up)], t)

if WHO == 'gungsa':
    # 왼손에 활을 비스듬히 든다
    B0 = add(base(), {'lowerarm_l': [-38, 0, 0]})
    AIM = add(B0, {'upperarm_l': [-82, -HANG + 12, 0], 'lowerarm_l': [38, 0, 0], 'spine_01': [0, 0, -14], 'spine_02': [0, 0, -14], 'neck_01': [0, 0, 22],
                   'upperarm_r': [-82, HANG - 30, 0], 'lowerarm_r': [-150, 0, 0], 'thigh_l': [-10, 0, 0], 'thigh_r': [8, 0, 0]})
    LOOSE = add(AIM, {'upperarm_r': [0, 22, 0], 'lowerarm_r': [40, 0, 0], 'curl': [-50, 0, 0]})
    GUARD = add(B0, {'upperarm_l': [-55, -10, 0], 'lowerarm_l': [-60, 0, 0], 'upperarm_r': [-30, 0, 0], 'lowerarm_r': [-60, 0, 0], 'spine_02': [4, 0, 8], 'loc': [0, 0, -0.04]})

    def attack1(t):
        return keyed([(0, B0), (0.45, AIM), (0.6, LOOSE), (1.0, LOOSE)], t)

    def attack2(t):
        return keyed([(0, AIM), (0.2, AIM), (0.35, LOOSE), (1.0, LOOSE)], t)

    def attack3(t):
        up = add(AIM, {'spine_02': [-14, 0, 0], 'neck_01': [-12, 0, 0]})
        return keyed([(0, B0), (0.4, up), (0.55, add(up, {'upperarm_r': [0, 22, 0], 'lowerarm_r': [40, 0, 0], 'curl': [-50, 0, 0]})), (1.0, add(up, {'upperarm_r': [0, 22, 0], 'lowerarm_r': [40, 0, 0]}))], t)

    def cast(t):
        sky = add(AIM, {'spine_02': [-28, 0, 0], 'spine_01': [-8, 0, 0], 'neck_01': [-20, 0, 0], 'loc': [0, 0.03, 0]})
        return keyed([(0, B0), (0.4, sky), (0.75, sky), (1.0, add(sky, {'upperarm_r': [0, 22, 0], 'lowerarm_r': [40, 0, 0]}))], t)

if NPC:
    # 마을 사람: 서기와 걷기만. 서는 자세가 사람마다 다르다
    STANCE = {
        'npc_elder': {'lowerarm_r': [-50, 0, 0], 'hand_r': [-15, 0, 0], 'spine_02': [8, 0, 0], 'spine_03': [6, 0, 0], 'neck_01': [-10, 0, 0], 'upperarm_l': [-8, 0, 0], 'lowerarm_l': [-40, 0, 0]},
        'npc_merchant': {'upperarm_l': [-12, -8, 0], 'lowerarm_l': [-70, 0, 0], 'upperarm_r': [-12, 8, 0], 'lowerarm_r': [-70, 0, 0]},
        'npc_smith': {'upperarm_l': [0, -6, 0], 'lowerarm_l': [-25, 0, 0], 'spine_02': [-3, 0, 0]},
        'npc_guard': {'upperarm_r': [8, 0, 0], 'lowerarm_r': [-62, 0, 0], 'hand_r': [40, 0, 0], 'spine_02': [-3, 0, 0]},
        'npc_keeper': {'lowerarm_l': [-10, 0, 0], 'lowerarm_r': [-10, 0, 0], 'curl': [-35, 0, 0]},
    }[WHO]
    B0 = add(base(), STANCE)

    def idle(t):
        s_ = math.sin(t * math.tau)
        return add(B0, {'spine_02': [1.2 * s_, 0, 0], 'neck_01': [-0.8 * s_, 0, 2 * math.sin(t * math.tau * 0.5 + 1)], 'loc': [0, 0, -0.003 + 0.003 * s_]})

    CLIPS = [('idle', 1.5, idle), ('walk', 0.7, walk)]
else:
    CLIPS = [('idle', 1.2, idle), ('walk', 0.64, walk), ('attack1', 0.32, attack1), ('attack2', 0.32, attack2), ('attack3', 0.46, attack3),
             ('cast', 0.5, cast), ('spin', 0.5, spin), ('dodge', 0.38, dodge), ('guard', 0.12, guard), ('hit', 0.24, hit), ('death', 0.8, death)]
for nm, d, fn in CLIPS:
    clip(nm, d, fn)

# 동작 확인용: 각 동작의 대표 자세를 찍는다
scene.render.engine = 'BLENDER_WORKBENCH'
scene.display.shading.color_type = 'TEXTURE'
for o in scene.objects:
    if o.type == 'MESH' and o is not low:
        o.hide_render = True
low.hide_render = False
pose_shots = []
for nm, d, fn in CLIPS:
    rig.animation_data.action = bpy.data.actions[nm]
    n = max(2, round(d * 24))
    for frac in ((0.5,) if nm in ('idle', 'guard') else (0.25, 0.6)):
        scene.frame_set(round(n * frac))
        f = preview(f'pose_{nm}_{int(frac * 100)}', [low], 2.4, Vector((0, 0, 0.8)), yaws=(30,), el=25)
        pose_shots += f


class R:
    obj = rig


B.export(low, R, os.path.join(OUT, f'{WHO}.glb' if NPC else f'pc_{WHO}.glb'))
