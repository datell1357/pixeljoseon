# 작은 짐승: 다람쥐(네발, 깡충 걸음)와 박쥐(날개 뼈대, 날갯짓).
# 실행: Blender -b --factory-startup -P tools/blender/small.py -- <종> <출력 폴더> [paint]
import sys, os, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import beastlib as B
from beastlib import P, X, Y, Z, lin, mixc
from mathutils import Vector, noise

argv = sys.argv[sys.argv.index('--') + 1:]
SP = argv[0]
OUT = os.path.abspath(argv[1])
STAGE = argv[2] if len(argv) > 2 else 'all'
os.makedirs(OUT, exist_ok=True)
B.reset()
FWD = Vector((0, -1, 0))
UP = Vector((0, 0, 1))


def pts(rows, x=0.0):
    return [P(f, z, x) for f, z in rows]


def eye_hit(co, eyes, r):
    return min((co - e).length for e in eyes) < r


if SP == 'daramjwi':
    # ---------------- 다람쥐 ----------------
    b = B.Builder()
    b.sweep(pts([(-0.125, 0.1), (-0.095, 0.115), (-0.045, 0.126), (0.015, 0.126), (0.065, 0.12), (0.1, 0.13)]),
            [(0.02, 0.02, 0.02), (0.05, 0.05, 0.045), (0.06, 0.058, 0.05), (0.055, 0.055, 0.045), (0.045, 0.045, 0.04), (0.03, 0.03, 0.03)], 'torso')
    b.sweep(pts([(0.075, 0.13), (0.1, 0.145), (0.115, 0.155)]), [(0.036, 0.036, 0.036), (0.034, 0.034, 0.034), (0.03, 0.03, 0.03)], 'neck')
    b.sweep(pts([(0.09, 0.155), (0.11, 0.17), (0.14, 0.173), (0.17, 0.165), (0.19, 0.153), (0.202, 0.149)]),
            [(0.03, 0.03, 0.03), (0.05, 0.046, 0.04), (0.052, 0.044, 0.04), (0.04, 0.034, 0.03), (0.024, 0.02, 0.02), (0.008, 0.007, 0.007)], 'head')
    for s in (1, -1):
        b.ball(P(0.155, 0.152, s * 0.032), 0.022, 0.024, 0.02, 'cheek')
    # 세운 털꼬리: 납작하고 풍성하다
    b.sweep(pts([(-0.11, 0.12), (-0.14, 0.17), (-0.155, 0.24), (-0.14, 0.3), (-0.105, 0.325), (-0.07, 0.31)]),
            [(0.018, 0.016, 0.016), (0.038, 0.026, 0.026), (0.05, 0.032, 0.032), (0.052, 0.032, 0.032), (0.042, 0.026, 0.026), (0.008, 0.006, 0.006)], 'tail', Vector((0, -1, 0)), around=14)
    D = dict(F=dict(scap0=(0.075, 0.14, 0.6), shoulder=(0.07, 0.09, 1.0), elbow=(0.06, 0.058, 1.05), wrist=(0.075, 0.02, 1.05), toeF=(0.09, 0.006, 1.05)),
             H=dict(hip=(-0.08, 0.105, 0.9), knee=(-0.03, 0.062, 1.15), hock=(-0.1, 0.03, 1.1), ankle=(-0.085, 0.01, 1.1), toeH=(-0.05, 0.005, 1.1)))
    LEG = {}
    for s, side in ((1, 'L'), (-1, 'R')):
        x = s * 0.035
        J = {k: P(f, z, x * k2) for k, (f, z, k2) in {**D['F'], **D['H']}.items()}
        LEG[side] = J
        b.sweep([J['scap0'], J['shoulder'], J['elbow']], [(0.014, 0.018, 0.018), (0.014, 0.016, 0.016), (0.01, 0.01, 0.011)], 'legF0', FWD)
        b.sweep([J['elbow'], J['wrist'], J['toeF']], [(0.009, 0.009, 0.01), (0.008, 0.008, 0.008), (0.008, 0.007, 0.007)], 'legF2', FWD)
        b.sweep([J['hip'], J['hip'].lerp(J['knee'], 0.5), J['knee']], [(0.032, 0.04, 0.036), (0.034, 0.042, 0.034), (0.016, 0.018, 0.018)], 'legH0', FWD)
        b.sweep([J['knee'], J['hock'], J['ankle'], J['toeH']], [(0.014, 0.014, 0.016), (0.009, 0.009, 0.011), (0.008, 0.008, 0.008), (0.009, 0.008, 0.008)], 'legH2', FWD)
    body = B.merge_smooth(b.to_object('body_hi'), passes=((0.0045, 16), (0.0025, 4)))
    eb = B.Builder()
    for s in (1, -1):
        base, tip = P(0.13, 0.205, s * 0.024), P(0.124, 0.232, s * 0.032)
        eb.sweep([base.lerp(tip, k) for k in (0, 0.4, 0.8, 1)], [(0.011, 0.005, 0.006), (0.011, 0.004, 0.005), (0.008, 0.003, 0.004), (0.001, 0.001, 0.001)], 'ear', Vector((s * 0.4, -1, 0)).normalized(), around=10, sub=2)
    extras = [eb.to_object('extras')]
    samples = b.samples + eb.samples
    EYES = [P(0.163, 0.176, s * 0.03) for s in (1, -1)]

    def color(part, t, co, n):
        OR, RUST, CR, DK, GR = lin(0xa88660), lin(0x9a6a44), lin(0xeee4d0), lin(0x1e1612), lin(0x7a6a58)
        c = mixc(OR, GR, (n.z - 0.3) * 1.5) if n.z > 0.3 else OR
        if part == 'torso':
            if n.z < -0.35:
                return CR
            if co.y > 0.09 and n.z > -0.3:
                c = mixc(c, RUST, 0.6)  # 엉덩이 쪽 붉은 기
            # 등의 줄: 가운데 검은 줄, 회갈색, 검은 줄, 흰 줄, 검은 줄
            if -0.11 < -co.y < 0.08 and n.z > 0.0:
                a = abs(math.atan2(n.x, n.z))
                for lo, hi, col in ((0, 0.16, DK), (0.16, 0.34, GR), (0.34, 0.52, DK), (0.52, 0.74, CR), (0.74, 0.92, DK)):
                    if lo <= a < hi:
                        return col
        elif part in ('head', 'cheek', 'neck'):
            if part == 'cheek' or n.z < -0.3:
                c = CR if n.z < 0.2 else OR
            if part == 'head':
                # 눈을 지나는 검은 줄과 그 위아래 흰 줄
                ez = co.z - (0.176 - (-co.y - 0.163) * 0.15)
                if abs(n.x) > 0.3 and 0.12 < -co.y < 0.2:
                    if abs(ez) < 0.006:
                        c = DK
                    elif 0.006 <= ez < 0.013 or -0.014 < ez <= -0.006:
                        c = CR
                if n.z > 0.85 and t < 0.6:
                    c = DK
                if t > 0.95:
                    c = lin(0x3a2420)
                if eye_hit(co, EYES, 0.011):
                    c = lin(0x0a0606) if eye_hit(co, EYES, 0.008) else CR
        elif part.startswith('leg'):
            c = CR if (part == 'legF2' or n.y > 0.3) else OR
        elif part == 'tail':
            ax = abs(n.x)
            c = lin(0xd8c8b0) if ax > 0.8 else (DK if ax > 0.55 else mixc(GR, RUST, 0.3))
        elif part == 'ear':
            c = lin(0xd8a888) if n.y < -0.3 else RUST
        return c

    B.paint([body] + extras, samples, color, grain=0.8)
    if STAGE == 'paint':
        print(B.preview(OUT, f'{SP}_paint', [body] + extras, scale=0.6, target=Vector((0, 0.0, 0.14))))
        sys.exit(0)
    low = B.make_low(body, extras, tris=2400, name=SP)
    B.bake([body] + extras, low, None)
    L = dict(hips0=P(-0.11, 0.11), hips1=P(-0.04, 0.125), spine1=P(0.02, 0.126), chest1=P(0.08, 0.13), neck0=P(0.08, 0.135), neck1=P(0.1, 0.16), head1=P(0.195, 0.152),
             jaw0=P(0.15, 0.145), jaw1=P(0.195, 0.143))
    for side, s in (('L', 1), ('R', -1)):
        L['ear0' + side] = P(0.13, 0.205, s * 0.024)
        L['ear1' + side] = P(0.124, 0.232, s * 0.032)
        for k, v in LEG[side].items():
            L[k + side] = v
    tb = [P(-0.11, 0.12), P(-0.15, 0.2), P(-0.145, 0.29), P(-0.07, 0.31)]
    r = B.Rig(SP + '_rig')
    B.quad_bones(r, L, [tb])
    r.finish()
    r.skin(low)
    A = B.Anim(r)
    attack = [(1, {}),
              (3, {'hipsL': (0, 0.015, -0.012), 'hips': [(X, 6)], 'neck': [(X, 10)], 'feet': {'ikH.L': (-0.015, 0), 'ikH.R': (-0.015, 0)}}),
              (5, {'hipsL': (0, -0.04, 0.04), 'hips': [(X, -14)], 'neck': [(X, -8)], 'feet': {'ikF.L': (0.04, 0.03), 'ikF.R': (0.04, 0.03)}}),
              (7, {'hipsL': (0, -0.045, 0.0), 'hips': [(X, 10)], 'neck': [(X, 16)], 'head': [(X, 10)], 'feet': {'ikF.L': (0.045, 0), 'ikF.R': (0.04, 0)}}),
              (10, {'hipsL': (0, -0.02, 0), 'feet': {'ikF.L': (0.02, 0), 'ikF.R': (0.02, 0)}}),
              (12, {})]
    B.quad_anims(A, [['tail1', 'tail2', 'tail3']], dict(gait='bound', walk_n=10, stride=0.035, lift=0.03, hop=0.035, size=0.35, tailAmp=10, attack=attack, drop=0.03))
    B.export(low, r, os.path.join(OUT, f'{SP}.glb'))

else:
    # ---------------- 박쥐 ----------------
    H = 0.42  # 떠 있는 높이
    b = B.Builder()
    b.sweep(pts([(-0.07, H - 0.01), (-0.05, H), (0.0, H + 0.005), (0.04, H + 0.01), (0.065, H + 0.012)]), [(0.012, 0.012, 0.012), (0.035, 0.034, 0.036), (0.045, 0.042, 0.045), (0.038, 0.036, 0.04), (0.02, 0.02, 0.02)], 'torso')
    b.sweep(pts([(0.055, H + 0.012), (0.075, H + 0.015), (0.1, H + 0.008), (0.115, H + 0.002), (0.122, H)]), [(0.024, 0.024, 0.024), (0.034, 0.03, 0.03), (0.028, 0.024, 0.024), (0.014, 0.012, 0.012), (0.004, 0.004, 0.004)], 'head')
    for s in (1, -1):
        b.sweep([P(-0.05, H - 0.02, s * 0.018), P(-0.075, H - 0.045, s * 0.022), P(-0.09, H - 0.06, s * 0.024)], [(0.007, 0.007, 0.007), (0.005, 0.005, 0.005), (0.003, 0.003, 0.003)], 'foot', UP, around=8)
    body = B.merge_smooth(b.to_object('body_hi'), passes=((0.004, 12), (0.0025, 3)))
    eb = B.Builder()
    WING = {}
    for s, side in ((1, 'L'), (-1, 'R')):
        sh = P(0.03, H + 0.015, s * 0.03)
        el = P(0.04, H + 0.03, s * 0.13)
        wr = P(0.02, H + 0.02, s * 0.22)
        f1 = P(0.04, H + 0.03, s * 0.34)
        f2 = P(-0.04, H + 0.005, s * 0.33)
        f3 = P(-0.1, H - 0.01, s * 0.26)
        hip = P(-0.06, H - 0.015, s * 0.02)
        WING[side] = dict(sh=sh, el=el, wr=wr, f1=f1, f2=f2, f3=f3)
        # 팔과 손가락 뼈 (가는 관)
        for a, c in ((sh, el), (el, wr), (wr, f1), (wr, f2), (wr, f3)):
            eb.sweep([a, a.lerp(c, 0.5), c], [(0.006, 0.006, 0.006), (0.005, 0.005, 0.005), (0.003, 0.003, 0.003)], 'bone', UP, around=6, sub=2)
        # 막: 몸 옆구리에서 손가락 끝까지. 가장자리는 손가락 사이로 파인다
        mid = lambda a, c, k: a.lerp(c, 0.5) + (wr - a.lerp(c, 0.5)) * k
        ring = [sh, el, wr, f1, mid(f1, f2, 0.25), f2, mid(f2, f3, 0.25), f3, mid(f3, hip, 0.2), hip]
        eb.poly(ring if s > 0 else list(reversed(ring)), 'wing', [0, 0.2, 0.4, 1, 0.8, 1, 0.8, 1, 0.6, 0])
        # 큰 귀
        base, tip = P(0.085, H + 0.035, s * 0.015), P(0.075, H + 0.085, s * 0.035)
        eb.sweep([base.lerp(tip, k) for k in (0, 0.35, 0.75, 1)], [(0.014, 0.004, 0.005), (0.014, 0.004, 0.005), (0.009, 0.003, 0.004), (0.001, 0.001, 0.001)], 'ear', Vector((s * 0.4, -1, 0)).normalized(), around=10, sub=2)
    extras = [eb.to_object('extras')]
    samples = b.samples + eb.samples
    EYES = [P(0.105, H + 0.015, s * 0.016) for s in (1, -1)]

    def color(part, t, co, n):
        FUR, FURL, WINGC, BONE = lin(0x4a3a34), lin(0x6a5446), lin(0x2c2228), lin(0x3e3036)
        sp = noise.noise(co * 160)
        c = mixc(FUR, FURL, 0.5 if sp > 0.2 else 0.0)
        if part == 'torso' and n.z < -0.3:
            c = FURL
        if part == 'head':
            if t > 0.92:
                c = lin(0x2a1a1e)
            if eye_hit(co, EYES, 0.008):
                c = lin(0xff5a3a)
        elif part == 'wing':
            c = WINGC
        elif part == 'bone':
            c = BONE
        elif part == 'ear':
            c = lin(0x8a5a5a) if n.y < -0.3 else lin(0x3a2a2e)
        elif part == 'foot':
            c = lin(0x2a2024)
        return c

    B.paint([body] + extras, samples, color, grain=0.6)
    if STAGE == 'paint':
        print(B.preview(OUT, f'{SP}_paint', [body] + extras, scale=0.9, target=Vector((0, 0.0, H))))
        sys.exit(0)
    low = B.make_low(body, extras, tris=1500, name=SP)
    B.bake([body] + extras, low, None)

    r = B.Rig(SP + '_rig')
    r.bone('root', P(0, 0), P(0, 0) + Vector((0, 0, 0.06)), deform=False)
    r.bone('body', P(-0.06, H), P(0.05, H + 0.01), 'root')
    r.bone('head', P(0.05, H + 0.01), P(0.12, H), 'body', True)
    for side, s in (('L', 1), ('R', -1)):
        W = WING[side]
        r.bone(f'uarm.{side}', W['sh'], W['el'], 'body')
        r.bone(f'farm.{side}', W['el'], W['wr'], f'uarm.{side}', True)
        for i, k in enumerate(('f1', 'f2', 'f3')):
            r.bone(f'fing{i}.{side}', W['wr'], W[k], f'farm.{side}')
        r.bone(f'ear.{side}', P(0.085, H + 0.035, s * 0.015), P(0.075, H + 0.085, s * 0.035), 'head')
        r.bone(f'leg.{side}', P(-0.05, H - 0.02, s * 0.018), P(-0.09, H - 0.06, s * 0.024), 'body')
    r.finish(legs=False)
    r.skin(low)

    A = B.Anim(r)
    A.locs = ['body', 'root']

    def flap(ph, amp, tilt=0.0, extra=None):
        w = math.sin(ph)
        p = {'rootL': (0, 0, 0.025 * math.sin(ph + 1.6))}
        for side, s in (('L', 1), ('R', -1)):
            p[f'uarm.{side}'] = [(Y, -s * amp * w), (Z, s * 8 * math.cos(ph))]
            p[f'farm.{side}'] = [(Y, -s * amp * 0.5 * math.sin(ph - 0.8))]
            for i in range(3):
                p[f'fing{i}.{side}'] = [(Y, -s * amp * 0.35 * math.sin(ph - 1.3)), (Z, s * 6 * (i - 1) * (0.5 - 0.5 * w))]
        p['body'] = [(X, tilt + 5 * math.cos(ph))]
        p['head'] = [(X, -3 * math.cos(ph))]
        if extra:
            p.update(extra)
        return p

    def frame(f, p):
        # body 위치는 'hipsL' 대신 rootL로만 움직인다
        A.frame(f, p)

    A.begin('idle')
    for k in range(13):
        frame(k + 1, flap(k / 12 * math.tau, 50))
    A.begin('walk')
    for k in range(11):
        frame(k + 1, flap(k / 10 * math.tau, 58, 12))
    A.begin('attack')
    for f, p in [(1, flap(0, 50)), (4, flap(1.2, 70, -20, {'rootL': (0, 0.05, 0.07)})), (7, flap(3.6, 40, 34, {'rootL': (0, -0.1, -0.08), 'head': [(X, 14)]})),
                 (10, flap(4.8, 45, 10, {'rootL': (0, -0.06, -0.03)})), (13, flap(6.2, 50))]:
        frame(f, p)
    A.begin('hit')
    for f, p in [(1, flap(0.3, 70, -24, {'rootL': (0, 0.06, 0.03), 'body': [(X, -24), (Y, 14)]})), (3, flap(1.3, 40, -10, {'rootL': (0, 0.07, 0.0)})), (6, flap(2.3, 45))]:
        frame(f, p)
    A.begin('death')
    for f, p in [(1, flap(0, 70, -20)),
                 (5, flap(1.5, 30, 20, {'body': [(Y, 40), (X, 20)], 'rootL': (0, 0, -0.1)})),
                 (9, flap(3, 10, 40, {'body': [(Y, 120), (X, 30)], 'rootL': (0.02, 0, -0.3)})),
                 (12, {'body': [(Y, 170)], 'rootL': (0.03, 0, -H + 0.03), 'uarm.L': [(Y, 40)], 'uarm.R': [(Y, -40)]}),
                 (18, {'body': [(Y, 175)], 'rootL': (0.03, 0, -H + 0.03), 'uarm.L': [(Y, 50)], 'uarm.R': [(Y, -50)], 'farm.L': [(Y, 30)], 'farm.R': [(Y, -30)]})]:
        frame(f, p)
    B.export(low, r, os.path.join(OUT, f'{SP}.glb'))
