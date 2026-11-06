# 블렌더 짐승 공용 도구: 단면 곡면 → 복셀 합치기 → 부위별 칠하기 → 저폴리 + 텍스처 굽기 → 스킨드 뼈대(IK) → 동작 → glb.
# 종별 스크립트가 이 파일을 불러 쓴다. 블렌더 내장 파이썬에서만 돈다.
import bpy, bmesh, math, os
from mathutils import Vector, Quaternion, kdtree, noise

scene = None


def reset():
    global scene
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    return scene


def P(f, z, x=0.0):
    """앞(f), 높이(z), 옆(x) → 블렌더 좌표. 짐승은 -Y를 본다 (glTF에서 +Z가 앞)."""
    return Vector((x, -f, z))


def link(o):
    scene.collection.objects.link(o)
    return o


def select_only(*objs):
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[-1]


def lin(h):
    """sRGB 16진 → 선형"""
    return [(((h >> s) & 255) / 255) ** 2.2 for s in (16, 8, 0)]


def mixc(a, b, t):
    t = max(0.0, min(1.0, t))
    return [a[i] + (b[i] - a[i]) * t for i in range(3)]


def cr(a, b, c, d, t):
    return 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (-a + 3 * b - 3 * c + d) * t ** 3)


class Builder:
    """단면 곡면을 한 bmesh에 모은다. 부위 이름과 길이 방향 위치(t)를 표본으로 남겨 칠할 때 쓴다."""

    def __init__(self):
        self.bm = bmesh.new()
        self.samples = []  # (점, 부위, t, 반지름)

    def sweep(self, pts, secs, part, up_ref=Vector((0, 0, 1)), around=18, sub=4):
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
        m = len(rows)
        for i, (p, (w, up, dn)) in enumerate(rows):
            self.samples.append((p.copy(), part, i / max(1, m - 1), (w + up + dn) / 3))
            a = rows[max(0, i - 1)][0]
            b = rows[min(m - 1, i + 1)][0]
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
                vs.append(self.bm.verts.new(p + side * (c * w) + upv * (sn * (up if sn > 0 else dn))))
            ring.append(vs)
        for i in range(len(ring) - 1):
            for j in range(around):
                j2 = (j + 1) % around
                self.bm.faces.new((ring[i][j], ring[i][j2], ring[i + 1][j2], ring[i + 1][j]))
        self.bm.faces.new(list(reversed(ring[0])))
        self.bm.faces.new(ring[-1])

    def ball(self, c, rx, ry, rz, part):
        k = 8
        pts, secs = [], []
        for i in range(k + 1):
            u = -1 + 2 * i / k
            r = math.sqrt(max(0, 1 - u * u))
            pts.append(c + Vector((0, -u * ry, 0)))
            secs.append((rx * r, rz * r, rz * r))
        self.sweep(pts, secs, part, sub=2)

    def poly(self, ring, part, ts=None):
        """납작한 막: 점들을 한 면으로 잇는다 (박쥐 날개). 칠하기 표본도 남긴다"""
        vs = [self.bm.verts.new(p) for p in ring]
        self.bm.faces.new(vs)
        for i, p in enumerate(ring):
            self.samples.append((p.copy(), part, (ts[i] if ts else 0.5), 0.0))

    def to_object(self, name):
        me = bpy.data.meshes.new(name)
        self.bm.to_mesh(me)
        self.bm.free()
        return link(bpy.data.objects.new(name, me))


def merge_smooth(o, passes=((0.007, 24), (0.0035, 4))):
    """복셀 재메시로 겹친 부위를 하나로 합치고, 거칠게 녹여 이음새를 둥글게 한 뒤 다시 고르게 짠다."""
    select_only(o)
    for vs, it in passes:
        m = o.modifiers.new('rm', 'REMESH')
        m.mode = 'VOXEL'
        m.voxel_size = vs
        m = o.modifiers.new('sm', 'SMOOTH')
        m.factor = 0.9
        m.iterations = it
        for mod in list(o.modifiers):
            bpy.ops.object.modifier_apply(modifier=mod.name)
    return o


def classifier(samples):
    kd = kdtree.KDTree(len(samples))
    for i, sm in enumerate(samples):
        kd.insert(sm[0], i)
    kd.balance()

    def find(co):
        # 중심이 아니라 겉면이 가장 가까운 부위: (거리 - 두께)가 작은 쪽. 몸에 묻힌 다리 뿌리가 몸통 겉면을 가져가지 않게
        best, bi = 1e9, 0
        for _, i, d in kd.find_n(co, 24):
            v = d - samples[i][3]
            if v < best:
                best, bi = v, i
        return samples[bi][1], samples[bi][2]

    return find


def fur_grain(co, k=1.0):
    """털결: 몸 방향(앞뒤)으로 길게 늘인 잡음"""
    x, y, z = co.x, co.y, co.z
    return 1 + k * (0.09 * noise.noise(Vector((x * 160, y * 45, z * 160))) + 0.05 * noise.noise(Vector((x * 420, y * 110, z * 420))))


def paint(objs, samples, fn, grain=1.0):
    """fn(부위, t, 좌표, 법선) → 선형 색"""
    find = classifier(samples)
    for o in objs:
        me = o.data
        attr = me.color_attributes.new('Col', 'FLOAT_COLOR', 'POINT')
        mw = o.matrix_world
        nm = mw.to_3x3()
        for v in me.vertices:
            co = mw @ v.co
            n = (nm @ v.normal).normalized()
            part, t = find(co)
            c = fn(part, t, co, n)
            k = fur_grain(co, grain)
            attr.data[v.index].color = (min(1, c[0] * k), min(1, c[1] * k), min(1, c[2] * k), 1)
        me.color_attributes.active_color = attr


def make_low(body, extras, tris=3200, name='beast'):
    low = body.copy()
    low.data = body.data.copy()
    low.name = name
    link(low)
    select_only(low)
    m = low.modifiers.new('dc', 'DECIMATE')
    m.ratio = min(1.0, tris / max(1, sum(len(p.vertices) - 2 for p in low.data.polygons)))
    bpy.ops.object.modifier_apply(modifier='dc')
    cps = []
    for e in extras:
        c = e.copy()
        c.data = e.data.copy()
        link(c)
        cps.append(c)
    select_only(*cps, low)
    if cps:
        bpy.ops.object.join()
    low = bpy.context.view_layer.objects.active
    for a in list(low.data.color_attributes):
        low.data.color_attributes.remove(a)
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(angle_limit=math.radians(60), island_margin=0.02)
    bpy.ops.object.mode_set(mode='OBJECT')
    print('low tris', sum(len(p.vertices) - 2 for p in low.data.polygons))
    return low


def bake(src_objs, low, out_png, size=128):
    img = bpy.data.images.new(low.name + '_tex', size, size, alpha=False)
    mat = bpy.data.materials.new('src')
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    em = nt.nodes.new('ShaderNodeEmission')
    at = nt.nodes.new('ShaderNodeVertexColor')
    at.layer_name = 'Col'
    nt.links.new(at.outputs['Color'], em.inputs['Color'])
    nt.links.new(em.outputs['Emission'], out.inputs['Surface'])
    for o in src_objs:
        o.data.materials.clear()
        o.data.materials.append(mat)
    lm = bpy.data.materials.new(low.name + '_mat')
    lm.use_nodes = True
    nt = lm.node_tree
    tex = nt.nodes.new('ShaderNodeTexImage')
    tex.image = img
    tex.interpolation = 'Closest'
    nt.links.new(tex.outputs['Color'], nt.nodes.get('Principled BSDF').inputs['Base Color'])
    nt.nodes.active = tex
    low.data.materials.clear()
    low.data.materials.append(lm)
    scene.render.engine = 'CYCLES'
    scene.cycles.device = 'CPU'
    scene.cycles.samples = 1
    bk = scene.render.bake
    bk.use_selected_to_active = True
    bk.cage_extrusion = 0.01
    bk.max_ray_distance = 0.03
    bk.margin = 3
    select_only(*src_objs, low)
    bpy.ops.object.bake(type='EMIT')
    if out_png:
        img.filepath_raw = out_png
        img.file_format = 'PNG'
        img.save()
    img.pack()
    print('baked')


# ---------------- 뼈대 ----------------

class Rig:
    def __init__(self, name):
        data = bpy.data.armatures.new(name)
        self.obj = link(bpy.data.objects.new(name, data))
        select_only(self.obj)
        bpy.ops.object.mode_set(mode='EDIT')
        self.eb = data.edit_bones

    def bone(self, name, h, t, parent=None, connect=False, deform=True):
        b = self.eb.new(name)
        b.head, b.tail = h, t
        b.roll = 0
        if parent:
            b.parent = self.eb[parent]
            b.use_connect = connect
        b.use_deform = deform
        return b

    def finish(self, legs=True):
        bpy.ops.object.mode_set(mode='POSE')
        self.pb = self.obj.pose.bones
        if legs:
            for side in ('L', 'R'):
                c = self.pb[f'farm.{side}'].constraints.new('IK')
                c.target, c.subtarget, c.chain_count = self.obj, f'ikF.{side}', 2
                c = self.pb[f'paw.{side}'].constraints.new('COPY_ROTATION')
                c.target, c.subtarget = self.obj, f'ikF.{side}'
                c.mix_mode = 'ADD'
                c.target_space = c.owner_space = 'LOCAL'
                c = self.pb[f'meta.{side}'].constraints.new('IK')
                c.target, c.subtarget, c.chain_count = self.obj, f'ikH.{side}', 3
        for pb in self.pb:
            pb.rotation_mode = 'QUATERNION'
        bpy.ops.object.mode_set(mode='OBJECT')
        return self

    def skin(self, low):
        select_only(low, self.obj)
        bpy.ops.object.parent_set(type='ARMATURE_AUTO')
        # 자동 가중치(bone heat)는 메시에 따라 일부 또는 전부 실패한다. 가중치 없는 정점은 가장 가까운 뼈 마디에 붙인다
        deform = [b for b in self.obj.data.bones if b.use_deform]
        for b in deform:
            if b.name not in low.vertex_groups:
                low.vertex_groups.new(name=b.name)
        mw = self.obj.matrix_world
        segs = [(b.name, mw @ b.head_local, mw @ b.tail_local) for b in deform]

        def dist(p, a, c):
            ac = c - a
            t = max(0.0, min(1.0, (p - a).dot(ac) / max(ac.length_squared, 1e-12)))
            return (a + ac * t - p).length

        lw = low.matrix_world
        fixed = 0
        for v in low.data.vertices:
            if sum(g.weight for g in v.groups) > 1e-4:
                continue
            p = lw @ v.co
            ds = sorted((dist(p, a, c), n) for n, a, c in segs)[:2]
            w0 = 1.0 / max(ds[0][0], 1e-4) ** 2
            w1 = 1.0 / max(ds[1][0], 1e-4) ** 2
            low.vertex_groups[ds[0][1]].add([v.index], w0 / (w0 + w1), 'REPLACE')
            low.vertex_groups[ds[1][1]].add([v.index], w1 / (w0 + w1), 'REPLACE')
            fixed += 1
        if fixed:
            # 거리로 붙인 가중치는 경계가 딱딱하다. 이웃 정점끼리 펴서 관절이 부드럽게 구부러지게 한다
            me = low.data
            nv = len(me.vertices)
            nb = [[] for _ in range(nv)]
            for e in me.edges:
                a0, a1 = e.vertices
                nb[a0].append(a1)
                nb[a1].append(a0)
            W = [{g.group: g.weight for g in v.groups if g.weight > 1e-4} for v in me.vertices]
            for _ in range(4):
                W2 = []
                for i in range(nv):
                    acc = {k: w * 0.5 for k, w in W[i].items()}
                    if nb[i]:
                        k2 = 0.5 / len(nb[i])
                        for j in nb[i]:
                            for k, w in W[j].items():
                                acc[k] = acc.get(k, 0.0) + w * k2
                    tot = sum(acc.values()) or 1.0
                    top = sorted(acc.items(), key=lambda kv: -kv[1])[:4]
                    t4 = sum(w for _, w in top) or 1.0
                    W2.append({k: w / t4 for k, w in top})
                W = W2
            groups = low.vertex_groups
            for i in range(nv):
                for g in list(me.vertices[i].groups):
                    groups[g.group].remove([i])
                for k, w in W[i].items():
                    groups[k].add([i], w, 'REPLACE')
        if not any(m.type == 'ARMATURE' for m in low.modifiers):
            m = low.modifiers.new('arm', 'ARMATURE')
            m.object = self.obj
        if low.parent != self.obj:
            low.parent = self.obj
        print('weights groups', len(low.vertex_groups), 'filled', fixed, 'of', len(low.data.vertices))

    def pin(self, low, prefix, bone):
        """이름이 prefix로 시작하는 정점 그룹을 bone 하나에 온전히 붙인다 (불꽃 같은 장식)."""
        pass


def quad_bones(r, L, tails, extra=None):
    """네발짐승 표준 뼈대. L: 이름 → 점. tails: 꼬리 마디 점 목록들 [[p0,p1..], ...]"""
    r.bone('root', P(0, 0), P(0, 0) + Vector((0, 0, 0.06)), deform=False)
    r.bone('hips', L['hips0'], L['hips1'], 'root')
    r.bone('spine', L['hips1'], L['spine1'], 'hips', True)
    r.bone('chest', L['spine1'], L['chest1'], 'spine', True)
    r.bone('neck', L['neck0'], L['neck1'], 'chest')
    r.bone('head', L['neck1'], L['head1'], 'neck', True)
    r.bone('jaw', L['jaw0'], L['jaw1'], 'head')
    for ti, pts in enumerate(tails):
        pre = 'tail' if len(tails) == 1 else f't{ti}_'
        for i in range(len(pts) - 1):
            r.bone(f'{pre}{i + 1}', pts[i], pts[i + 1], 'hips' if i == 0 else f'{pre}{i}', i > 0)
    for side, s in (('L', 1), ('R', -1)):
        S = lambda k: L[k + side]
        r.bone(f'ear.{side}', S('ear0'), S('ear1'), 'head')
        r.bone(f'scap.{side}', S('scap0'), S('shoulder'), 'chest')
        r.bone(f'uarm.{side}', S('shoulder'), S('elbow'), f'scap.{side}', True)
        r.bone(f'farm.{side}', S('elbow'), S('wrist'), f'uarm.{side}', True)
        r.bone(f'paw.{side}', S('wrist'), S('toeF'), f'farm.{side}', True)
        r.bone(f'thigh.{side}', S('hip'), S('knee'), 'hips')
        r.bone(f'shin.{side}', S('knee'), S('hock'), f'thigh.{side}', True)
        r.bone(f'meta.{side}', S('hock'), S('ankle'), f'shin.{side}', True)
        r.bone(f'hpaw.{side}', S('ankle'), S('toeH'), f'meta.{side}', True)
        r.bone(f'ikF.{side}', S('wrist'), S('wrist') + Vector((0, 0, 0.03)), 'root', deform=False)
        r.bone(f'ikH.{side}', S('ankle'), S('ankle') + Vector((0, 0, 0.03)), 'root', deform=False)
    if extra:
        extra(r)


# ---------------- 동작 ----------------

X = (1, 0, 0)   # 옆축: +면 머리를 숙인다 (앞이 -Y)
Y = (0, 1, 0)   # 앞뒤축: 몸을 옆으로 굴린다
Z = (0, 0, 1)   # 위축: 좌우로 돈다


class Anim:
    def __init__(self, rig, fps=24):
        self.obj = rig.obj
        self.pb = rig.obj.pose.bones
        scene.render.fps = fps
        self.obj.animation_data_create()
        self.all = [b.name for b in self.pb]
        self.locs = ['hips', 'root'] + [n for n in self.all if n.startswith('ik')]

    def lr(self, name):
        return self.pb[name].bone.matrix_local.to_3x3()

    def begin(self, name):
        act = bpy.data.actions.new(name)
        act.use_fake_user = True
        self.obj.animation_data.action = act
        for pb in self.pb:
            pb.rotation_quaternion = Quaternion()
            pb.location = Vector()

    def frame(self, f, p):
        """p: 뼈이름 → [(세계축, 도)], 'hipsL'·'rootL' → 위치, 'feet' → {ik이름: (앞, 위)}"""
        for n in self.all:
            pb = self.pb[n]
            q = Quaternion()
            inv = self.lr(n).inverted()
            for ax, deg in p.get(n, []):
                q = Quaternion(inv @ Vector(ax), math.radians(deg)) @ q
            pb.rotation_quaternion = q
            pb.keyframe_insert('rotation_quaternion', frame=f)
        feet = p.get('feet', {})
        for n in self.locs:
            if n == 'hips':
                w = p.get('hipsL', (0, 0, 0))
            elif n == 'root':
                w = p.get('rootL', (0, 0, 0))
            else:
                a, b = feet.get(n, (0, 0))
                w = (0, -a, b)
            self.pb[n].location = self.lr(n).inverted() @ Vector(w)
            self.pb[n].keyframe_insert('location', frame=f)


def tail_wave(names, t, amp, droop=0.0, lag=0.7):
    return {n: [(Z, amp * math.sin(t - i * lag)), (X, droop + i * 2)] for i, n in enumerate(names)}


def quad_anims(A, tails, o):
    """네발짐승 기본 동작. o: stride, lift, bob, walk_n, gait('trot'|'walk'), tailAmp, tailDroop, extra(name, k, t) → 사전"""
    ex = o.get('extra', lambda name, k, t: {})
    S = o.get('stride', 0.075)
    LIFT = o.get('lift', 0.045)

    def tw(t, amp, droop=0.0):
        d = {}
        for names in tails:
            d.update(tail_wave(names, t, amp, droop + o.get('tailDroop', 0)))
        return d

    A.begin('idle')
    N = 48
    for k in range(0, N + 1, 2):
        t = k / N * math.tau
        p = {'hipsL': (0, 0, -0.003 * (0.5 - 0.5 * math.cos(t))), 'chest': [(X, -1.0 * math.sin(t))],
             'neck': [(Z, 8 * math.sin(t * 0.5) ** 3)], 'head': [(X, 2 * math.sin(t + 1)), (Z, 4 * math.sin(t * 0.5) ** 3)], 'jaw': [(X, -2)]}
        p.update(tw(t, o.get('tailAmp', 6), 4))
        tws = 18 if 20 <= k <= 24 else 0
        p['ear.L'] = [(Y, tws)]
        p['ear.R'] = [(Y, -tws * 0.5)]
        p.update(ex('idle', k, t))
        A.frame(k + 1, p)

    A.begin('walk')
    N = o.get('walk_n', 16)
    walk4 = o.get('gait') == 'walk'
    for k in range(N + 1):
        t = k / N * math.tau
        feet = {}
        if o.get('gait') == 'bound':
            # 깡충: 뒷발로 차고 날아 앞발로 내려앉는다
            f = k / N
            air = math.sin(math.pi * f / 0.45) if f < 0.45 else 0.0
            gather = math.sin(math.pi * (f - 0.45) / 0.55) if f >= 0.45 else 0.0
            for n in ('ikF.L', 'ikF.R'):
                feet[n] = (S * (air * 0.9 - gather * 0.5), LIFT * air * 0.6)
            for n in ('ikH.L', 'ikH.R'):
                feet[n] = (S * (-air * 0.8 + gather * 0.6), LIFT * air)
            p = {'feet': feet, 'hipsL': (0, -S * 0.2 * air, o.get('hop', 0.03) * air - 0.006 * gather),
                 'hips': [(X, -12 * air * (1 if f < 0.22 else -0.6) + 6 * gather)], 'head': [(X, 6 * air - 4 * gather)]}
            p.update(tw(t, o.get('tailAmp', 6) * 1.5, 6))
            p.update(ex('walk', k, t))
            A.frame(k + 1, p)
            continue
        if walk4:
            # 네 박자: 뒷발이 먼저, 같은 쪽 앞발이 뒤따른다
            for n, ph in (('ikH.L', 0), ('ikF.L', 0.25), ('ikH.R', 0.5), ('ikF.R', 0.75)):
                q = (k / N - ph) % 1
                sw = 0.36
                if q < sw:
                    u = q / sw
                    feet[n] = (-S + 2 * S * (u * u * (3 - 2 * u)), LIFT * math.sin(math.pi * u))
                else:
                    u = (q - sw) / (1 - sw)
                    feet[n] = (S - 2 * S * u, 0)
        else:
            for n, ph in (('ikF.L', 0), ('ikH.R', 0), ('ikF.R', math.pi), ('ikH.L', math.pi)):
                a = t + ph
                feet[n] = (S * math.cos(a), LIFT * max(0, -math.sin(a)))
        bob = o.get('bob', 0.006)
        roll = o.get('roll', 2)
        p = {'feet': feet, 'hipsL': (0, 0, -bob * math.cos(2 * t)),
             'hips': [(Y, roll * math.sin(t)), (Z, 2.5 * math.cos(t))], 'chest': [(Y, -roll * math.sin(t)), (Z, -2.5 * math.cos(t))],
             'head': [(X, 2.5 * math.cos(2 * t))]}
        p.update(tw(t, o.get('tailAmp', 6) * 1.5, 6))
        p.update(ex('walk', k, t))
        A.frame(k + 1, p)

    A.begin('attack')
    sc = o.get('size', 1.0)
    for f, p in o.get('attack') or [
        (1, {}),
        (4, {'hipsL': (0, 0.03 * sc, -0.035 * sc), 'hips': [(X, -4)], 'neck': [(X, 10)], 'head': [(X, 6)], 'feet': {'ikH.L': (-0.03 * sc, 0), 'ikH.R': (-0.03 * sc, 0)}, **tw(0, 0, -10), 'jaw': [(X, -6)]}),
        (6, {'hipsL': (0, -0.06 * sc, 0.03 * sc), 'hips': [(X, 6)], 'neck': [(X, -16)], 'head': [(X, -6)], 'jaw': [(X, -32)], 'feet': {'ikF.L': (0.08 * sc, 0.05 * sc), 'ikF.R': (0.07 * sc, 0.04 * sc), 'ikH.L': (-0.04 * sc, 0.0), 'ikH.R': (-0.03 * sc, 0.0)}, **tw(0, 0, 6)}),
        (8, {'hipsL': (0, -0.08 * sc, -0.01 * sc), 'neck': [(X, 8)], 'head': [(X, 10)], 'jaw': [(X, -4)], 'feet': {'ikF.L': (0.09 * sc, 0), 'ikF.R': (0.08 * sc, 0)}}),
        (12, {'hipsL': (0, -0.03 * sc, 0), 'neck': [(X, 3)], 'feet': {'ikF.L': (0.03 * sc, 0), 'ikF.R': (0.03 * sc, 0)}}),
        (14, {}),
    ]:
        A.frame(f, {**p, **ex('attack', f, 0)})

    A.begin('hit')
    for f, p in [(1, {'hipsL': (0, 0.04 * sc, 0.01 * sc), 'chest': [(X, -6), (Y, 6)], 'neck': [(X, -14), (Z, 10)], 'jaw': [(X, -20)], **tw(0, 0, -16)}),
                 (3, {'hipsL': (0, 0.045 * sc, -0.01 * sc), 'chest': [(X, -3)], 'neck': [(X, -6), (Z, 4)], 'jaw': [(X, -8)]}),
                 (6, {})]:
        A.frame(f, {**p, **ex('hit', f, 0)})

    A.begin('death')
    dz = o.get('drop', 0.1)
    for f, p in [(1, {'neck': [(X, -16)], 'jaw': [(X, -18)]}),
                 (4, {'hipsL': (0, 0.02 * sc, -0.04 * sc), 'neck': [(X, -6)], 'jaw': [(X, -10)], 'feet': {'ikF.L': (0.02 * sc, 0)}}),
                 (9, {'root': [(Y, 60)], 'rootL': (0.06 * sc, 0, 0.0), 'hipsL': (0, 0, -dz * 0.8), 'neck': [(X, 8)], 'head': [(X, 6)]}),
                 (12, {'root': [(Y, 88)], 'rootL': (0.1 * sc, 0, 0.0), 'hipsL': (0, 0, -dz), 'neck': [(X, 14)], 'head': [(X, 10)], 'jaw': [(X, -10)], **tw(0, 0, 10),
                       'feet': {'ikF.L': (0.05 * sc, 0.06 * sc), 'ikH.L': (-0.05 * sc, 0.06 * sc)}}),
                 (18, {'root': [(Y, 86)], 'rootL': (0.1 * sc, 0, 0.0), 'hipsL': (0, 0, -dz), 'neck': [(X, 16)], 'head': [(X, 12)], 'jaw': [(X, -8)], **tw(0, 0, 12),
                       'feet': {'ikF.L': (0.05 * sc, 0.05 * sc), 'ikH.L': (-0.05 * sc, 0.05 * sc)}})]:
        A.frame(f, {**p, **ex('death', f, 0)})


def export(low, rig, path):
    for o in list(scene.objects):
        if o not in (low, rig.obj):
            bpy.data.objects.remove(o)
    rig.obj.animation_data.action = bpy.data.actions['idle']
    select_only(low, rig.obj)
    bpy.ops.export_scene.gltf(
        filepath=path, export_format='GLB', use_selection=True,
        export_animations=True, export_animation_mode='ACTIONS', export_force_sampling=True,
        export_def_bones=True, export_optimize_animation_size=True, export_frame_step=2,
        export_yup=True, export_apply=False, export_skins=True, export_morph=False,
    )
    # 스킨이 실제로 실렸는지 확인한다 (없으면 게임이 예전 모델로 돌아간다)
    import json, struct
    with open(path, 'rb') as fh:
        fh.read(12)
        ln, _ = struct.unpack('<II', fh.read(8))
        gj = json.loads(fh.read(ln))
    if not gj.get('skins') or not any('skin' in nd for nd in gj.get('nodes', [])):
        raise RuntimeError(f'스킨 없이 내보내짐: {path}')
    print('exported', path, os.path.getsize(path), 'skins', len(gj['skins']))


def preview(out, name, objs, scale=1.45, target=Vector((0, 0.08, 0.3))):
    for o in scene.objects:
        o.hide_render = o not in objs
    cam = bpy.data.cameras.new('cam')
    cam.type = 'ORTHO'
    cam.ortho_scale = scale
    co = link(bpy.data.objects.new('cam', cam))
    scene.camera = co
    scene.render.engine = 'BLENDER_WORKBENCH'
    scene.display.shading.light = 'STUDIO'
    scene.display.shading.color_type = 'VERTEX'
    scene.display.shading.show_cavity = True
    scene.render.resolution_x, scene.render.resolution_y = 1000, 640
    shots = []
    for i, yaw in enumerate([0, -40, 40]):
        el = math.radians(33)
        yw = math.radians(yaw)
        d = 3.0
        pos = target + Vector((math.cos(el) * math.cos(yw), math.cos(el) * math.sin(yw), math.sin(el))) * d
        co.location = pos
        co.rotation_euler = (target - pos).to_track_quat('-Z', 'Y').to_euler()
        f = os.path.join(out, f'{name}_{i}.png')
        scene.render.filepath = f
        bpy.ops.render.render(write_still=True)
        shots.append(f)
    bpy.data.objects.remove(co)
    return shots
