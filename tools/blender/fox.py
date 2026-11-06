# 여우 모델: 메타볼로 몸을 빚고 → 복셀 재메시 → 칠하기 → 저폴리 + 텍스처 굽기 → 스킨드 뼈대 → 동작 → glb.
# 실행: blender -b --factory-startup -P tools/blender/fox.py -- <출력 폴더> [preview]
import bpy, bmesh, math, sys, os
from mathutils import Vector, Quaternion, Matrix

argv = sys.argv[sys.argv.index('--') + 1:]
OUT = os.path.abspath(argv[0])
STAGE = argv[1] if len(argv) > 1 else 'all'
os.makedirs(OUT, exist_ok=True)

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene

def P(f, z, x=0.0):
    """앞(f), 높이(z), 옆(x) → 블렌더 좌표. 여우는 -Y를 본다 (glTF에서 +Z가 앞)."""
    return Vector((x, -f, z))

def link(o):
    scene.collection.objects.link(o)
    return o

def select_only(*objs):
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[-1]

# ---------------- 몸 덩어리 ----------------
# 부위마다 단면 곡면(sweep)으로 짓고, 복셀 재메시로 하나로 합친 뒤 이음새를 부드럽게 녹인다.
BM = bmesh.new()

def cr(a, b, c, d, t):
    return 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (-a + 3 * b - 3 * c + d) * t ** 3)

def sweep(pts, secs, up_ref=Vector((0, 0, 1)), around=18, sub=4):
    """pts: 중심점들, secs: (옆, 위, 아래) 반지름. 위는 up_ref 쪽."""
    n = len(pts)
    rows = []
    for i in range(n - 1):
        for k in range(sub):
            t = k / sub
            ia, ib, ic, id_ = max(0, i - 1), i, i + 1, min(n - 1, i + 2)
            p = Vector([cr(pts[ia][q], pts[ib][q], pts[ic][q], pts[id_][q], t) for q in range(3)])
            sc = [max(0.0005, cr(secs[ia][q], secs[ib][q], secs[ic][q], secs[id_][q], t)) for q in range(3)]
            rows.append((p, sc))
    rows.append((pts[-1], [max(0.0005, v) for v in secs[-1]]))
    ring = []
    for i, (p, (w, up, dn)) in enumerate(rows):
        a = rows[max(0, i - 1)][0]
        b = rows[min(len(rows) - 1, i + 1)][0]
        tan = (b - a).normalized()
        side = up_ref.cross(tan)
        if side.length < 1e-6:
            side = Vector((1, 0, 0))
        side.normalize()
        upv = tan.cross(side).normalized()
        vs = []
        for j in range(around):
            an = j / around * math.tau
            c, sn = math.cos(an), math.sin(an)
            vs.append(BM.verts.new(p + side * (c * w) + upv * (sn * (up if sn > 0 else dn))))
        ring.append(vs)
    for i in range(len(ring) - 1):
        for j in range(around):
            j2 = (j + 1) % around
            BM.faces.new((ring[i][j], ring[i][j2], ring[i + 1][j2], ring[i + 1][j]))
    BM.faces.new(list(reversed(ring[0])))
    BM.faces.new(ring[-1])

def ball(c, rx, ry, rz):
    k = 8
    pts, secs = [], []
    for i in range(k + 1):
        u = -1 + 2 * i / k
        r = math.sqrt(max(0, 1 - u * u))
        pts.append(c + Vector((0, -u * ry, 0)))
        secs.append((rx * r, rz * r, rz * r))
    sweep(pts, secs, sub=2)

def path(rows, x=0.0):
    return [P(f, z, x) for f, z in rows]

# 몸통: 엉덩이 → 넓적다리 → 잘록한 허리 → 갈비 → 깊은 가슴
sweep(path([(-0.235, 0.372), (-0.19, 0.385), (-0.14, 0.388), (-0.04, 0.38), (0.06, 0.376), (0.15, 0.372), (0.21, 0.378), (0.235, 0.39)]),
      [(0.03, 0.03, 0.03), (0.06, 0.055, 0.06), (0.075, 0.068, 0.085), (0.062, 0.06, 0.066), (0.07, 0.064, 0.09), (0.074, 0.066, 0.108), (0.066, 0.062, 0.1), (0.04, 0.045, 0.06)])
# 목
sweep(path([(0.17, 0.4), (0.22, 0.44), (0.265, 0.495), (0.29, 0.53)]), [(0.06, 0.055, 0.075), (0.056, 0.052, 0.07), (0.048, 0.046, 0.055), (0.04, 0.04, 0.042)])
# 머리: 둥근 두개골에서 가늘고 긴 주둥이로
sweep(path([(0.245, 0.535), (0.28, 0.548), (0.315, 0.547), (0.35, 0.535), (0.39, 0.518), (0.425, 0.505), (0.448, 0.498)]),
      [(0.04, 0.04, 0.04), (0.062, 0.058, 0.052), (0.064, 0.054, 0.05), (0.044, 0.038, 0.036), (0.028, 0.024, 0.025), (0.017, 0.016, 0.017), (0.006, 0.006, 0.006)])
# 아래턱
sweep(path([(0.3, 0.508), (0.36, 0.494), (0.415, 0.486), (0.432, 0.485)]), [(0.032, 0.014, 0.02), (0.024, 0.01, 0.016), (0.013, 0.007, 0.01), (0.005, 0.004, 0.005)])
# 볼털: 머리 옆에서 뒤아래로 뻗친다
for s in (1, -1):
    sweep([P(0.335, 0.522, s * 0.035), P(0.305, 0.512, s * 0.058), P(0.272, 0.5, s * 0.078)], [(0.022, 0.024, 0.022), (0.018, 0.02, 0.018), (0.003, 0.003, 0.003)], Vector((0, 0, 1)), around=12)
# 꼬리: 굵은 붓
sweep(path([(-0.215, 0.375), (-0.27, 0.345), (-0.35, 0.31), (-0.45, 0.28), (-0.54, 0.268), (-0.6, 0.27), (-0.625, 0.272)]),
      [(0.022, 0.022, 0.022), (0.042, 0.042, 0.042), (0.06, 0.06, 0.058), (0.064, 0.064, 0.062), (0.05, 0.05, 0.05), (0.026, 0.026, 0.026), (0.004, 0.004, 0.004)])
# 다리: 앞쪽이 '위'가 되도록 up_ref를 앞으로 둔다
FWD = Vector((0, -1, 0))
for s in (1, -1):
    x = s * 0.05
    # 앞다리: 어깨뼈 → 위팔 → 팔꿈치 → 아래팔 → 발목 → 발
    sweep([P(0.2, 0.44, x * 0.8), P(0.19, 0.38, x), P(0.18, 0.33, x * 1.05)], [(0.0450, 0.0674, 0.0600), (0.0480, 0.0630, 0.0630), (0.0420, 0.0480, 0.0510)], FWD)
    sweep([P(0.18, 0.34, x * 1.05), P(0.165, 0.27, x * 1.08), P(0.155, 0.215, x * 1.1)], [(0.0450, 0.0450, 0.0510), (0.0374, 0.0374, 0.0420), (0.0300, 0.0300, 0.0360)], FWD)
    sweep([P(0.155, 0.225, x * 1.1), P(0.163, 0.14, x * 1.1), P(0.172, 0.065, x * 1.1)], [(0.0286, 0.0270, 0.0330), (0.0224, 0.0210, 0.0240), (0.0180, 0.0180, 0.0196)], FWD)
    sweep([P(0.172, 0.07, x * 1.1), P(0.185, 0.035, x * 1.1), P(0.2, 0.018, x * 1.1)], [(0.0180, 0.0180, 0.0196), (0.0180, 0.0180, 0.0180), (0.0196, 0.0180, 0.0180)], FWD)
    ball(P(0.215, 0.014, x * 1.1), 0.017, 0.024, 0.012)
    # 뒷다리: 넓적다리(앞으로 불룩) → 정강이 → 뒤꿈치 → 발허리 → 발
    sweep([P(-0.13, 0.39, x * 0.9), P(-0.1, 0.32, x * 1.1), P(-0.07, 0.25, x * 1.15), P(-0.065, 0.225, x * 1.15)], [(0.0600, 0.0900, 0.0826), (0.0630, 0.0976, 0.0780), (0.0450, 0.0600, 0.0526), (0.0360, 0.0390, 0.0390)], FWD)
    sweep([P(-0.065, 0.235, x * 1.15), P(-0.11, 0.17, x * 1.12), P(-0.165, 0.105, x * 1.1)], [(0.0330, 0.0360, 0.0390), (0.0256, 0.0240, 0.0330), (0.0180, 0.0164, 0.0240)], FWD)
    sweep([P(-0.165, 0.11, x * 1.1), P(-0.16, 0.06, x * 1.1), P(-0.155, 0.022, x * 1.1)], [(0.0180, 0.0164, 0.0240), (0.0164, 0.0164, 0.0180), (0.0180, 0.0180, 0.0180)], FWD)
    ball(P(-0.14, 0.014, x * 1.1), 0.017, 0.026, 0.012)

me = bpy.data.meshes.new('body_hi')
BM.to_mesh(me)
BM.free()
body = link(bpy.data.objects.new('body_hi', me))
select_only(body)
# 거칠게 합쳐 크게 녹이고(이음새를 둥글게) 다시 고르게 짠다
for vs, it in ((0.007, 24), (0.0035, 4)):
    m = body.modifiers.new('rm', 'REMESH')
    m.mode = 'VOXEL'
    m.voxel_size = vs
    m = body.modifiers.new('sm', 'SMOOTH')
    m.factor = 0.9
    m.iterations = it
    for mod in list(body.modifiers):
        bpy.ops.object.modifier_apply(modifier=mod.name)

# 귀: 납작한 삼각뿔
def ear(s):
    bm = bmesh.new()
    base = P(0.288, 0.575, s * 0.04)
    tip = P(0.268, 0.735, s * 0.082)
    fwd = Vector((s * 0.6, -1, 0)).normalized()
    side = Vector((1, 0, 0)) * s
    w, t = 0.056, 0.03
    a = bm.verts.new(base + side * w)
    b = bm.verts.new(base - side * w * 0.9)
    c = bm.verts.new(base - fwd * t * 2)
    d = bm.verts.new(base + fwd * t)
    tp = bm.verts.new(tip)
    for f in [(a, d, tp), (d, b, tp), (b, c, tp), (c, a, tp), (a, c, b, d)]:
        bm.faces.new(f)
    me = bpy.data.meshes.new(f'ear{s}')
    bm.to_mesh(me)
    o = link(bpy.data.objects.new(f'ear{s}', me))
    sd = o.modifiers.new('sd', 'SUBSURF')
    sd.levels = 1
    select_only(o)
    bpy.ops.object.modifier_apply(modifier='sd')
    return o

ears = [ear(1), ear(-1)]
print('dense tris', sum(len(p.vertices) - 2 for p in body.data.polygons))

# ---------------- 미리보기 ----------------
def preview(name, objs):
    for o in scene.objects:
        o.hide_render = o not in objs
    cam = bpy.data.cameras.new('cam')
    cam.type = 'ORTHO'
    cam.ortho_scale = 1.4
    co = link(bpy.data.objects.new('cam', cam))
    scene.camera = co
    scene.render.engine = 'BLENDER_WORKBENCH'
    scene.display.shading.light = 'STUDIO'
    scene.display.shading.color_type = 'VERTEX' if any(o.data.color_attributes for o in objs if o.type == 'MESH') else 'MATERIAL'
    scene.display.shading.show_cavity = True
    scene.render.film_transparent = False
    shots = []
    scene.render.resolution_x, scene.render.resolution_y = 1000, 640
    cam.ortho_scale = 1.45
    for i, yaw in enumerate([0, -40, 40]):
        el = math.radians(33)
        yw = math.radians(yaw)
        target = Vector((0, 0.08, 0.3))
        d = 3.0
        pos = target + Vector((math.cos(el) * math.cos(yw), math.cos(el) * math.sin(yw), math.sin(el))) * d
        co.location = pos
        co.rotation_euler = (target - pos).to_track_quat('-Z', 'Y').to_euler()
        f = os.path.join(OUT, f'{name}_{i}.png')
        scene.render.filepath = f
        bpy.ops.render.render(write_still=True)
        shots.append(f)
    bpy.data.objects.remove(co)
    return shots

if STAGE == 'preview':
    print(preview('shape', [body] + ears))
    sys.exit(0)

# ---------------- 칠하기 ----------------
from mathutils import noise

def lin(h):
    """sRGB 16진 → 선형"""
    r, g, b = ((h >> 16) & 255) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255
    return [c ** 2.2 for c in (r, g, b)]

def mixc(a, b, t):
    return [a[i] + (b[i] - a[i]) * t for i in range(3)]

RED, RED_D, CREAM, WHITE, BLACK, NOSE = lin(0xcf6424), lin(0x9a3e16), lin(0xead6b8), lin(0xf4efe4), lin(0x241814), lin(0x100c0c)
EYE_C = [(P(0.338, 0.552, 0.043)), (P(0.338, 0.552, -0.043))]

def fox_color(co, n):
    f, z, x = -co.y, co.z, co.x
    ax = abs(x)
    c = RED
    if n.z > 0.55:
        c = mixc(RED, RED_D, min(1, (n.z - 0.55) * 2.2))
    # 배와 다리 안쪽은 옅게
    if n.z < -0.45 and -0.2 < f < 0.15 and z > 0.22:
        c = mixc(RED, CREAM, min(1, (-n.z - 0.45) * 3))
    # 목·가슴의 흰 털: 턱 밑에서 앞가슴까지
    if 0.16 < f < 0.36 and 0.27 < z < 0.53 and (n.z < 0.25 and (n.y < -0.25 or n.z < -0.2)):
        c = WHITE
    # 머리: 볼과 윗입술 아래쪽은 희다
    if f > 0.27 and z > 0.47:
        mid = 0.545 - (f - 0.3) * 0.32
        if z < mid - 0.012 or (ax > 0.05 and f < 0.34):
            c = WHITE
        # 눈에서 코로 이어지는 검붉은 줄
        if 0.35 < f < 0.43 and abs(z - (mid - 0.004)) < 0.006 and ax > 0.012:
            c = mixc(RED_D, BLACK, 0.4)
    if f > 0.442:
        c = NOSE
    for e in EYE_C:
        d = (co - e).length
        if d < 0.012:
            c = BLACK if d < 0.009 else mixc(BLACK, RED_D, 0.5)
    # 검은 버선: 앞다리는 팔꿈치 아래 앞쪽부터, 뒷다리는 뒤꿈치 아래
    if z < 0.2 and 0.12 < f < 0.24:
        c = BLACK
    if z < 0.12 and -0.2 < f < -0.1:
        c = BLACK
    # 꼬리: 등쪽이 짙고 끝은 희다
    if f < -0.22 and z > 0.2:
        c = mixc(RED, RED_D, 0.35) if n.z > 0.3 else RED
        if f < -0.545:
            c = WHITE
    # 털결: 몸 방향(앞뒤)으로 길게 늘인 잡음
    k = 1 + 0.09 * noise.noise(Vector((x * 160, -co.y * 45, z * 160))) + 0.05 * noise.noise(Vector((x * 420, -co.y * 110, z * 420)))
    return [min(1, v * k) for v in c]

def ear_color(co, n, s):
    f, z = -co.y, co.z
    if n.y < -0.2:
        return CREAM if z < 0.69 else BLACK  # 귀 안쪽
    return BLACK if z > 0.63 else RED_D

def paint(o, fn):
    me = o.data
    attr = me.color_attributes.new('Col', 'FLOAT_COLOR', 'POINT')
    mw = o.matrix_world
    for v in me.vertices:
        c = fn(mw @ v.co, (mw.to_3x3() @ v.normal).normalized())
        attr.data[v.index].color = (c[0], c[1], c[2], 1)
    me.color_attributes.active_color = attr

paint(body, fox_color)
for e, s in zip(ears, (1, -1)):
    paint(e, lambda co, n, s=s: ear_color(co, n, s))

if STAGE == 'paint':
    print(preview('paint', [body] + ears))
    sys.exit(0)

# ---------------- 저폴리 + 텍스처 굽기 ----------------
low = body.copy()
low.data = body.data.copy()
low.name = 'fox'
link(low)
select_only(low)
m = low.modifiers.new('dc', 'DECIMATE')
m.ratio = 3200 / max(1, len(low.data.polygons))
bpy.ops.object.modifier_apply(modifier='dc')
ear_low = []
for e in ears:
    c = e.copy(); c.data = e.data.copy(); link(c); ear_low.append(c)
select_only(*ear_low, low)
bpy.ops.object.join()
low = bpy.context.view_layer.objects.active
for a in list(low.data.color_attributes):
    low.data.color_attributes.remove(a)
bpy.ops.object.mode_set(mode='EDIT')
bpy.ops.mesh.select_all(action='SELECT')
bpy.ops.uv.smart_project(angle_limit=math.radians(60), island_margin=0.02)
bpy.ops.object.mode_set(mode='OBJECT')
print('low tris', sum(len(p.vertices) - 2 for p in low.data.polygons))

TEX = 128
img = bpy.data.images.new('fox_tex', TEX, TEX, alpha=False)

def emit_mat(name):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    em = nt.nodes.new('ShaderNodeEmission')
    at = nt.nodes.new('ShaderNodeVertexColor')
    at.layer_name = 'Col'
    nt.links.new(at.outputs['Color'], em.inputs['Color'])
    nt.links.new(em.outputs['Emission'], out.inputs['Surface'])
    return mat

src_mat = emit_mat('src')
for o in [body] + ears:
    o.data.materials.clear()
    o.data.materials.append(src_mat)
lowmat = bpy.data.materials.new('fox_mat')
lowmat.use_nodes = True
nt = lowmat.node_tree
tex = nt.nodes.new('ShaderNodeTexImage')
tex.image = img
tex.interpolation = 'Closest'
bsdf = nt.nodes.get('Principled BSDF')
nt.links.new(tex.outputs['Color'], bsdf.inputs['Base Color'])
nt.nodes.active = tex
low.data.materials.clear()
low.data.materials.append(lowmat)

scene.render.engine = 'CYCLES'
scene.cycles.device = 'CPU'
scene.cycles.samples = 1
scene.render.bake.use_selected_to_active = True
scene.render.bake.cage_extrusion = 0.01
scene.render.bake.max_ray_distance = 0.03
scene.render.bake.margin = 3
select_only(body, *ears, low)
bpy.ops.object.bake(type='EMIT')
img.filepath_raw = os.path.join(OUT, 'fox_tex.png')
img.file_format = 'PNG'
img.save()
img.pack()
print('baked')

# ---------------- 뼈대 ----------------
arm_data = bpy.data.armatures.new('fox_rig')
arm = link(bpy.data.objects.new('fox_rig', arm_data))
select_only(arm)
bpy.ops.object.mode_set(mode='EDIT')
EB = arm_data.edit_bones

def bone(name, h, t, parent=None, connect=False, deform=True):
    b = EB.new(name)
    b.head, b.tail = h, t
    b.roll = 0
    if parent:
        b.parent = EB[parent]
        b.use_connect = connect
    b.use_deform = deform
    return b

bone('root', P(0, 0), P(0, 0, 0) + Vector((0, 0, 0.06)), deform=False)
bone('hips', P(-0.2, 0.38), P(-0.08, 0.385), 'root')
bone('spine', P(-0.08, 0.385), P(0.05, 0.378), 'hips', True)
bone('chest', P(0.05, 0.378), P(0.18, 0.385), 'spine', True)
bone('neck', P(0.18, 0.40), P(0.27, 0.51), 'chest')
bone('head', P(0.27, 0.51), P(0.42, 0.51), 'neck', True)
bone('jaw', P(0.3, 0.5), P(0.42, 0.487), 'head')
tail_pts = [P(-0.215, 0.375), P(-0.3, 0.335), P(-0.4, 0.298), P(-0.5, 0.272), P(-0.625, 0.27)]
for i in range(4):
    bone(f'tail{i + 1}', tail_pts[i], tail_pts[i + 1], 'hips' if i == 0 else f'tail{i}', i > 0)
for side, s in (('L', 1), ('R', -1)):
    x = s * 0.05
    bone(f'ear.{side}', P(0.29, 0.585, s * 0.036), P(0.275, 0.71, s * 0.07), 'head')
    bone(f'scap.{side}', P(0.2, 0.44, x * 0.8), P(0.18, 0.33, x * 1.05), 'chest')
    bone(f'uarm.{side}', P(0.18, 0.33, x * 1.05), P(0.155, 0.215, x * 1.1), f'scap.{side}', True)
    bone(f'farm.{side}', P(0.155, 0.215, x * 1.1), P(0.172, 0.065, x * 1.1), f'uarm.{side}', True)
    bone(f'paw.{side}', P(0.172, 0.065, x * 1.1), P(0.215, 0.014, x * 1.1), f'farm.{side}', True)
    bone(f'thigh.{side}', P(-0.13, 0.39, x * 0.9), P(-0.065, 0.225, x * 1.15), 'hips')
    bone(f'shin.{side}', P(-0.065, 0.225, x * 1.15), P(-0.165, 0.105, x * 1.1), f'thigh.{side}', True)
    bone(f'meta.{side}', P(-0.165, 0.105, x * 1.1), P(-0.155, 0.022, x * 1.1), f'shin.{side}', True)
    bone(f'hpaw.{side}', P(-0.155, 0.022, x * 1.1), P(-0.12, 0.012, x * 1.1), f'meta.{side}', True)
    # 발 목표점: 위를 향한 뼈. 지역 축이 (옆, 위, 앞)이 된다
    bone(f'ikF.{side}', P(0.172, 0.065, x * 1.1), P(0.172, 0.095, x * 1.1), 'root', deform=False)
    bone(f'ikH.{side}', P(-0.155, 0.022, x * 1.1), P(-0.155, 0.052, x * 1.1), 'root', deform=False)
bpy.ops.object.mode_set(mode='POSE')
PB = arm.pose.bones
for side in ('L', 'R'):
    c = PB[f'farm.{side}'].constraints.new('IK')
    c.target, c.subtarget, c.chain_count = arm, f'ikF.{side}', 2
    c = PB[f'paw.{side}'].constraints.new('COPY_ROTATION')
    c.target, c.subtarget = arm, f'ikF.{side}'
    c.mix_mode = 'ADD'
    c.target_space = c.owner_space = 'LOCAL'
    c = PB[f'meta.{side}'].constraints.new('IK')
    c.target, c.subtarget, c.chain_count = arm, f'ikH.{side}', 3
for pb in PB:
    pb.rotation_mode = 'QUATERNION'
bpy.ops.object.mode_set(mode='OBJECT')

# 자동 가중치로 살을 뼈에 붙인다
select_only(low, arm)
bpy.ops.object.parent_set(type='ARMATURE_AUTO')
print('weights groups', len(low.vertex_groups))

# ---------------- 동작 ----------------
FPS = 24
scene.render.fps = FPS
arm.animation_data_create()

def lr(name):
    return PB[name].bone.matrix_local.to_3x3()

def key_rot(name, f, axes):
    """axes: [(세계축, 도)]. 뼈 쉬는 방향 기준으로 바꿔 넣는다."""
    pb = PB[name]
    q = Quaternion()
    inv = lr(name).inverted()
    for ax, deg in axes:
        q = Quaternion(inv @ Vector(ax), math.radians(deg)) @ q
    pb.rotation_quaternion = q
    pb.keyframe_insert('rotation_quaternion', frame=f)

def key_loc(name, f, world):
    pb = PB[name]
    pb.location = lr(name).inverted() @ Vector(world)
    pb.keyframe_insert('location', frame=f)

X = (1, 0, 0)   # 옆축: +면 머리를 숙인다(앞이 -Y이므로)
Y = (0, 1, 0)   # 앞뒤축: 몸을 옆으로 굴린다
Z = (0, 0, 1)   # 위축: 좌우로 돈다
ALL = [b.name for b in PB]

def begin(name):
    act = bpy.data.actions.new(name)
    act.use_fake_user = True
    arm.animation_data.action = act
    for pb in PB:
        pb.rotation_quaternion = Quaternion()
        pb.location = Vector()
    return act

def rest(f, skip=()):
    for n in ALL:
        if n in skip:
            continue
        PB[n].rotation_quaternion = Quaternion()
        PB[n].keyframe_insert('rotation_quaternion', frame=f)
    for n in ('hips', 'root') + tuple(f'ik{k}.{s}' for k in 'FH' for s in 'LR'):
        if n in skip:
            continue
        PB[n].location = Vector()
        PB[n].keyframe_insert('location', frame=f)

def foot(name, f, fwd, up):
    """발 목표: 앞으로 fwd, 위로 up (세계 기준)"""
    key_loc(name, f, (0, -fwd, up))

def pose_frame(f, p):
    """p: 사전 하나로 한 프레임. 키: 뼈이름 → [(축,도)], 'hipsL' → 위치, 'feet' → {이름:(앞,위)}"""
    for n in ALL:
        key_rot(n, f, p.get(n, []))
    key_loc('hips', f, p.get('hipsL', (0, 0, 0)))
    key_loc('root', f, p.get('rootL', (0, 0, 0)))
    feet = p.get('feet', {})
    for n in ('ikF.L', 'ikF.R', 'ikH.L', 'ikH.R'):
        a, b = feet.get(n, (0, 0))
        foot(n, f, a, b)

def tail_wave(t, amp, droop=0):
    return {f'tail{i + 1}': [(Z, amp * math.sin(t - i * 0.7)), (X, droop + (i * 2))] for i in range(4)}

# 서 있기: 숨쉬기, 고개 돌리기, 꼬리 흔들기, 귀 쫑긋
begin('idle')
N = 48
for k in range(0, N + 1, 2):
    t = k / N * math.tau
    p = {'hipsL': (0, 0, -0.003 * (0.5 - 0.5 * math.cos(t)))}
    p['chest'] = [(X, -1.0 * math.sin(t))]
    p['neck'] = [(Z, 8 * math.sin(t * 0.5) ** 3)]
    p['head'] = [(X, 2 * math.sin(t + 1)), (Z, 4 * math.sin(t * 0.5) ** 3)]
    p.update(tail_wave(t, 6, 4))
    tw = 18 if 20 <= k <= 24 else 0
    p['ear.L'] = [(Y, tw)]
    p['ear.R'] = [(Y, -tw * 0.5)]
    p['jaw'] = [(X, -2)]
    pose_frame(k + 1, p)

# 걷기: 대각선 다리끼리 (종종걸음)
begin('walk')
N = 16
S = 0.075
for k in range(N + 1):
    t = k / N * math.tau
    feet = {}
    for n, ph in (('ikF.L', 0), ('ikH.R', 0), ('ikF.R', math.pi), ('ikH.L', math.pi)):
        a = t + ph
        feet[n] = (S * math.cos(a), 0.045 * max(0, -math.sin(a)))
    p = {'feet': feet, 'hipsL': (0, 0, -0.006 * math.cos(2 * t))}
    p['hips'] = [(Y, 2 * math.sin(t)), (Z, 2.5 * math.cos(t))]
    p['chest'] = [(Y, -2 * math.sin(t)), (Z, -2.5 * math.cos(t))]
    p['head'] = [(X, 2.5 * math.cos(2 * t))]
    p.update(tail_wave(t, 9, 6))
    pose_frame(k + 1, p)

# 물기: 웅크렸다가 덮치며 턱을 벌린다
begin('attack')
keys = [
    (1, {}),
    (4, {'hipsL': (0, 0.03, -0.035), 'hips': [(X, -4)], 'neck': [(X, 10)], 'head': [(X, 6)], 'feet': {'ikH.L': (-0.03, 0), 'ikH.R': (-0.03, 0)}, **tail_wave(0, 0, -10), 'jaw': [(X, -6)]}),
    (6, {'hipsL': (0, -0.06, 0.03), 'hips': [(X, 6)], 'neck': [(X, -16)], 'head': [(X, -6)], 'jaw': [(X, -32)], 'feet': {'ikF.L': (0.08, 0.05), 'ikF.R': (0.07, 0.04), 'ikH.L': (-0.04, 0.0), 'ikH.R': (-0.03, 0.0)}, **tail_wave(0, 0, 6)}),
    (8, {'hipsL': (0, -0.08, -0.01), 'neck': [(X, 8)], 'head': [(X, 10)], 'jaw': [(X, -4)], 'feet': {'ikF.L': (0.09, 0), 'ikF.R': (0.08, 0)}}),
    (12, {'hipsL': (0, -0.03, 0), 'neck': [(X, 3)], 'feet': {'ikF.L': (0.03, 0), 'ikF.R': (0.03, 0)}}),
    (14, {}),
]
for f, p in keys:
    pose_frame(f, p)

begin('hit')
for f, p in [(1, {'hipsL': (0, 0.04, 0.01), 'chest': [(X, -6), (Y, 6)], 'neck': [(X, -14), (Z, 10)], 'jaw': [(X, -20)], **tail_wave(0, 0, -16)}),
             (3, {'hipsL': (0, 0.045, -0.01), 'chest': [(X, -3)], 'neck': [(X, -6), (Z, 4)], 'jaw': [(X, -8)]}),
             (6, {})]:
    pose_frame(f, p)

begin('death')
for f, p in [(1, {'neck': [(X, -16)], 'jaw': [(X, -18)]}),
             (4, {'hipsL': (0, 0.02, -0.04), 'neck': [(X, -6)], 'jaw': [(X, -10)], 'feet': {'ikF.L': (0.02, 0)}}),
             (9, {'root': [(Y, 60)], 'rootL': (0.06, 0, 0.0), 'hipsL': (0, 0, -0.08), 'neck': [(X, 8)], 'head': [(X, 6)]}),
             (12, {'root': [(Y, 88)], 'rootL': (0.1, 0, 0.0), 'hipsL': (0, 0, -0.1), 'neck': [(X, 14)], 'head': [(X, 10)], 'jaw': [(X, -10)], **tail_wave(0, 0, 10),
                   'feet': {'ikF.L': (0.05, 0.06), 'ikH.L': (-0.05, 0.06)}}),
             (18, {'root': [(Y, 86)], 'rootL': (0.1, 0, 0.0), 'hipsL': (0, 0, -0.1), 'neck': [(X, 16)], 'head': [(X, 12)], 'jaw': [(X, -8)], **tail_wave(0, 0, 12),
                   'feet': {'ikF.L': (0.05, 0.05), 'ikH.L': (-0.05, 0.05)}})]:
    pose_frame(f, p)

arm.animation_data.action = bpy.data.actions['idle']

# ---------------- 내보내기 ----------------
for o in list(scene.objects):
    if o not in (low, arm):
        bpy.data.objects.remove(o)
select_only(low, arm)
glb = os.path.join(OUT, 'fox.glb')
bpy.ops.export_scene.gltf(
    filepath=glb, export_format='GLB', use_selection=True,
    export_animations=True, export_animation_mode='ACTIONS', export_force_sampling=True,
    export_def_bones=True, export_optimize_animation_size=False, export_frame_step=1,
    export_yup=True, export_apply=False, export_skins=True, export_morph=False,
)
print('exported', glb, os.path.getsize(glb))
