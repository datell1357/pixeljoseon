# 덩치 큰 짐승: 호랑이, 반달가슴곰, 멧돼지. 종마다 해부 좌표를 따로 잡는다.
# 실행: Blender -b --factory-startup -P tools/blender/big.py -- <종> <출력 폴더> [paint]
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


# ---------------- 종별 해부 ----------------
# 각 종은 몸통·목·머리·턱·꼬리 경로와 단면, 다리 관절 점, 귀를 정한다.
if SP == 'horangi':
    D = dict(
        torso=(pts([(-0.33, 0.33), (-0.28, 0.345), (-0.2, 0.35), (-0.08, 0.335), (0.04, 0.335), (0.14, 0.345), (0.23, 0.355), (0.29, 0.36)]),
               [(0.03, 0.03, 0.03), (0.07, 0.065, 0.075), (0.09, 0.075, 0.095), (0.078, 0.066, 0.076), (0.088, 0.07, 0.105), (0.098, 0.076, 0.125), (0.094, 0.074, 0.12), (0.06, 0.06, 0.08)]),
        neck=(pts([(0.22, 0.37), (0.28, 0.375), (0.33, 0.375)]), [(0.085, 0.08, 0.1), (0.08, 0.075, 0.09), (0.065, 0.065, 0.07)]),
        head=(pts([(0.32, 0.375), (0.36, 0.39), (0.41, 0.39), (0.45, 0.375), (0.48, 0.355), (0.497, 0.348)]),
              [(0.05, 0.05, 0.05), (0.098, 0.088, 0.078), (0.102, 0.082, 0.076), (0.082, 0.06, 0.062), (0.056, 0.036, 0.042), (0.022, 0.016, 0.018)]),
        jaw=(pts([(0.41, 0.335), (0.46, 0.328), (0.49, 0.326)]), [(0.05, 0.016, 0.025), (0.034, 0.012, 0.018), (0.012, 0.006, 0.008)]),
        cheek=[(P(0.43, 0.35, 0.07), P(0.4, 0.33, 0.115), 0.03)],
        tail=(pts([(-0.31, 0.335), (-0.4, 0.3), (-0.48, 0.23), (-0.55, 0.16), (-0.62, 0.12), (-0.69, 0.125), (-0.74, 0.15)]), 0.027, 0.022),
        legx=0.068,
        F=dict(scap0=(0.24, 0.39, 0.7), shoulder=(0.21, 0.27, 1.0), elbow=(0.17, 0.165, 1.05), wrist=(0.19, 0.05, 1.05), toeF=(0.235, 0.016, 1.05)),
        H=dict(hip=(-0.23, 0.33, 0.9), knee=(-0.15, 0.185, 1.1), hock=(-0.255, 0.095, 1.05), ankle=(-0.235, 0.022, 1.05), toeH=(-0.19, 0.014, 1.05)),
        legr=dict(scap=0.06, up=0.06, fore=0.036, wrist=0.03, thigh=0.085, shin=0.042, meta=0.03),
        paw=(0.036, 0.046, 0.022),
        ears=dict(base=(0.39, 0.455, 0.055), tip=(0.385, 0.5, 0.075), w=0.05, round=True),
        jawb=((0.41, 0.34), (0.49, 0.326)), headb=((0.33, 0.375), (0.49, 0.36)), neckb=((0.22, 0.37), (0.33, 0.375)),
        hipsb=((-0.3, 0.34), (-0.12, 0.34)), spineb=(0.06, 0.335), chestb=(0.22, 0.355),
        eyes=(0.452, 0.4, 0.045), eye_r=0.011,
    )
elif SP in ('bandalgom', 'bulgasari'):
    D = dict(
        torso=(pts([(-0.32, 0.3), (-0.27, 0.32), (-0.18, 0.33), (-0.06, 0.325), (0.06, 0.335), (0.15, 0.35), (0.23, 0.345), (0.29, 0.33)]),
               [(0.05, 0.05, 0.05), (0.11, 0.1, 0.11), (0.14, 0.12, 0.14), (0.14, 0.12, 0.14), (0.145, 0.13, 0.15), (0.145, 0.14, 0.15), (0.13, 0.12, 0.14), (0.08, 0.08, 0.09)]),
        neck=(pts([(0.24, 0.35), (0.3, 0.345), (0.34, 0.34)]), [(0.115, 0.11, 0.12), (0.1, 0.1, 0.1), (0.08, 0.08, 0.08)]),
        head=(pts([(0.31, 0.34), (0.35, 0.36), (0.4, 0.36), (0.445, 0.335), (0.48, 0.315), (0.5, 0.31)]),
              [(0.069, 0.069, 0.069), (0.115, 0.104, 0.092), (0.113, 0.092, 0.086), (0.074, 0.06, 0.06), (0.05, 0.041, 0.044), (0.025, 0.021, 0.023)]),
        jaw=(pts([(0.41, 0.305), (0.46, 0.298), (0.49, 0.296)]), [(0.05, 0.016, 0.026), (0.035, 0.012, 0.018), (0.012, 0.006, 0.008)]),
        cheek=[],
        tail=(pts([(-0.32, 0.31), (-0.35, 0.3), (-0.37, 0.28)]), 0.03, 0.02),
        legx=0.09,
        F=dict(scap0=(0.22, 0.38, 0.65), shoulder=(0.2, 0.25, 1.0), elbow=(0.16, 0.15, 1.05), wrist=(0.175, 0.05, 1.05), toeF=(0.225, 0.014, 1.05)),
        H=dict(hip=(-0.21, 0.3, 0.9), knee=(-0.13, 0.17, 1.05), hock=(-0.2, 0.065, 1.05), ankle=(-0.17, 0.022, 1.05), toeH=(-0.1, 0.014, 1.05)),
        legr=dict(scap=0.08, up=0.075, fore=0.052, wrist=0.045, thigh=0.095, shin=0.058, meta=0.045),
        paw=(0.05, 0.065, 0.024),
        ears=dict(base=(0.37, 0.445, 0.078), tip=(0.365, 0.5, 0.1), w=0.066, round=True),
        jawb=((0.41, 0.31), (0.49, 0.296)), headb=((0.32, 0.34), (0.49, 0.315)), neckb=((0.24, 0.35), (0.33, 0.34)),
        hipsb=((-0.29, 0.31), (-0.1, 0.325)), spineb=(0.06, 0.335), chestb=(0.22, 0.345),
        eyes=(0.43, 0.38, 0.05), eye_r=0.01,
    )
    if SP == 'bulgasari':
        # 설화의 불가사리: 곰의 몸, 코끼리 코, 코뿔소 눈과 뿔, 소꼬리, 범의 다리, 쇠바늘 털
        D['torso'] = (D['torso'][0], [(w * 1.08, u * 1.05, d * 1.05) for w, u, d in D['torso'][1]])
        D['head'] = (pts([(0.31, 0.34), (0.35, 0.365), (0.4, 0.365), (0.44, 0.345), (0.47, 0.33), (0.485, 0.325)]),
                     [(0.07, 0.07, 0.07), (0.11, 0.1, 0.09), (0.108, 0.09, 0.085), (0.075, 0.062, 0.06), (0.05, 0.045, 0.045), (0.04, 0.038, 0.038)])
        D['tail'] = (pts([(-0.32, 0.31), (-0.39, 0.28), (-0.45, 0.21), (-0.475, 0.13), (-0.48, 0.09)]), 0.018, 0.012)
        D['trunk'] = (pts([(0.47, 0.33), (0.515, 0.3), (0.545, 0.23), (0.55, 0.15), (0.53, 0.085), (0.505, 0.065)]), [(0.04, 0.04, 0.04), (0.036, 0.036, 0.036), (0.031, 0.031, 0.031), (0.026, 0.026, 0.026), (0.021, 0.021, 0.021), (0.02, 0.02, 0.02)])
        D['legr'] = dict(D['legr'], paw=0)
        D['eyes'] = (0.44, 0.375, 0.052)
else:  # metdwaeji
    D = dict(
        torso=(pts([(-0.32, 0.25), (-0.28, 0.265), (-0.2, 0.27), (-0.08, 0.275), (0.04, 0.29), (0.13, 0.3), (0.21, 0.285), (0.27, 0.26)]),
               [(0.04, 0.04, 0.04), (0.08, 0.075, 0.08), (0.095, 0.085, 0.09), (0.105, 0.1, 0.1), (0.118, 0.125, 0.115), (0.12, 0.135, 0.12), (0.105, 0.115, 0.11), (0.07, 0.07, 0.07)]),
        neck=(pts([(0.22, 0.27), (0.27, 0.255), (0.3, 0.24)]), [(0.1, 0.11, 0.1), (0.09, 0.095, 0.09), (0.08, 0.085, 0.08)]),
        head=(pts([(0.27, 0.245), (0.32, 0.235), (0.39, 0.205), (0.45, 0.17), (0.5, 0.15), (0.522, 0.145), (0.528, 0.145)]),
              [(0.075, 0.085, 0.08), (0.08, 0.08, 0.072), (0.062, 0.058, 0.052), (0.044, 0.042, 0.04), (0.035, 0.034, 0.034), (0.035, 0.034, 0.034), (0.002, 0.002, 0.002)]),
        jaw=(pts([(0.38, 0.17), (0.45, 0.145), (0.5, 0.132)]), [(0.04, 0.014, 0.022), (0.03, 0.01, 0.016), (0.014, 0.006, 0.008)]),
        cheek=[],
        tail=(pts([(-0.32, 0.26), (-0.35, 0.235), (-0.365, 0.2), (-0.37, 0.17)]), 0.012, 0.009),
        legx=0.07,
        F=dict(scap0=(0.17, 0.3, 0.65), shoulder=(0.16, 0.2, 1.0), elbow=(0.14, 0.13, 1.05), wrist=(0.155, 0.045, 1.05), toeF=(0.175, 0.01, 1.05)),
        H=dict(hip=(-0.23, 0.26, 0.9), knee=(-0.17, 0.155, 1.05), hock=(-0.235, 0.075, 1.05), ankle=(-0.225, 0.02, 1.05), toeH=(-0.205, 0.008, 1.05)),
        legr=dict(scap=0.06, up=0.05, fore=0.026, wrist=0.02, thigh=0.07, shin=0.032, meta=0.021),
        paw=(0.018, 0.024, 0.014),
        ears=dict(base=(0.3, 0.315, 0.045), tip=(0.285, 0.395, 0.07), w=0.042, round=False),
        jawb=((0.38, 0.18), (0.5, 0.135)), headb=((0.28, 0.245), (0.5, 0.15)), neckb=((0.2, 0.27), (0.29, 0.245)),
        hipsb=((-0.3, 0.26), (-0.1, 0.275)), spineb=(0.05, 0.29), chestb=(0.2, 0.285),
        eyes=(0.39, 0.245, 0.05), eye_r=0.008,
    )

# ---------------- 모양 ----------------
b = B.Builder()
b.sweep(*D['torso'], 'torso')
b.sweep(*D['neck'], 'neck')
b.sweep(*D['head'], 'head')
b.sweep(*D['jaw'], 'jaw')
for p0, p1, r in D['cheek']:
    for s in (1, -1):
        a = Vector((p0.x * s, p0.y, p0.z))
        c = Vector((p1.x * s, p1.y, p1.z))
        b.sweep([a, a.lerp(c, 0.5), c], [(r, r, r), (r * 0.8, r * 0.8, r * 0.8), (0.003, 0.003, 0.003)], 'cheek', UP, around=12)
tp, r0, r1 = D['tail']
n = len(tp)
b.sweep(tp, [(r0 + (r1 - r0) * i / (n - 1),) * 3 for i in range(n)], 'tail', UP, around=12)

LEG = {}
lr = D['legr']
for s, side in ((1, 'L'), (-1, 'R')):
    x = s * D['legx']
    J = {k: P(f, z, x * k2) for k, (f, z, k2) in {**D['F'], **D['H']}.items()}
    LEG[side] = J
    b.sweep([J['scap0'], J['scap0'].lerp(J['shoulder'], 0.5), J['shoulder']], [(lr['scap'] * 0.7, lr['scap'], lr['scap']), (lr['scap'] * 0.8, lr['scap'], lr['scap']), (lr['up'] * 0.8, lr['up'], lr['up'])], 'legF0', FWD)
    b.sweep([J['shoulder'], J['shoulder'].lerp(J['elbow'], 0.5), J['elbow']], [(lr['up'] * 0.8, lr['up'], lr['up']), (lr['up'] * 0.7, lr['up'] * 0.8, lr['up'] * 0.85), (lr['fore'] * 0.9, lr['fore'], lr['fore'] * 1.1)], 'legF1', FWD)
    b.sweep([J['elbow'], J['elbow'].lerp(J['wrist'], 0.5), J['wrist']], [(lr['fore'] * 0.9, lr['fore'], lr['fore'] * 1.1), (lr['fore'] * 0.75, lr['fore'] * 0.8, lr['fore'] * 0.85), (lr['wrist'], lr['wrist'], lr['wrist'])], 'legF2', FWD)
    b.sweep([J['wrist'], J['wrist'].lerp(J['toeF'], 0.5), J['toeF']], [(lr['wrist'],) * 3, (lr['wrist'],) * 3, (lr['wrist'] * 0.9,) * 3], 'legF3', FWD)
    b.ball(J['toeF'] + Vector((0, 0, 0.0)), *D['paw'], 'pawF')
    b.sweep([J['hip'], J['hip'].lerp(J['knee'], 0.45), J['knee']], [(lr['thigh'] * 0.7, lr['thigh'] * 1.05, lr['thigh']), (lr['thigh'] * 0.75, lr['thigh'] * 1.1, lr['thigh'] * 0.9), (lr['shin'] * 1.1, lr['shin'] * 1.15, lr['shin'] * 1.15)], 'legH0', FWD)
    b.sweep([J['knee'], J['knee'].lerp(J['hock'], 0.5), J['hock']], [(lr['shin'],) * 3, (lr['shin'] * 0.8, lr['shin'] * 0.75, lr['shin'] * 0.95), (lr['meta'] * 0.9, lr['meta'] * 0.8, lr['meta'] * 1.1)], 'legH1', FWD)
    b.sweep([J['hock'], J['hock'].lerp(J['ankle'], 0.5), J['ankle'], J['toeH']], [(lr['meta'] * 0.9, lr['meta'] * 0.8, lr['meta'] * 1.1), (lr['meta'],) * 3, (lr['meta'],) * 3, (lr['meta'] * 0.9,) * 3], 'legH2', FWD)
    b.ball(J['toeH'], *D['paw'], 'pawH')

if SP == 'bulgasari':
    b.sweep(*D['trunk'], 'trunk', Vector((0, -1, 0)), around=14)
    b.ball(P(-0.48, 0.07), 0.03, 0.03, 0.04, 'tuft')
    # 등줄기의 쇠바늘: 가운데 줄과 양옆 줄
    for i in range(16):
        f = 0.24 - i * 0.034
        top = 0.33 + 0.15 * math.sin(min(1, max(0, (f + 0.32) / 0.56)) * math.pi * 0.9)
        l = 0.07 + 0.06 * math.sin(min(1, max(0, (f + 0.3) / 0.54)) * math.pi)
        for side in (-1, 0, 1):
            if side and i % 2:
                continue
            x0 = side * 0.07
            b.sweep([P(f, top - 0.03, x0), P(f - 0.02, top + l * 0.55, x0 * 1.3), P(f - 0.035, top + l, x0 * 1.55)], [(0.016, 0.016, 0.016), (0.009, 0.009, 0.009), (0.0015, 0.0015, 0.0015)], 'spike', UP, around=8, sub=2)
if SP == 'metdwaeji':
    # 등 갈기: 어깨에서 엉덩이까지 억센 털이 솟는다
    for i in range(14):
        f = 0.24 - i * 0.038
        top = 0.29 + 0.13 * math.sin(min(1, max(0, (f + 0.3) / 0.5)) * math.pi * 0.62) + (0.015 if f > 0.02 else 0)
        l = 0.05 + 0.035 * (1 if f > 0.0 else 0.4)
        b.sweep([P(f, top - 0.03), P(f - 0.02, top + l * 0.6), P(f - 0.04, top + l)], [(0.02, 0.012, 0.012), (0.012, 0.008, 0.008), (0.002, 0.002, 0.002)], 'mane', UP, around=8, sub=2)
    # 납작한 코
    b.sweep([P(0.515, 0.145), P(0.535, 0.145), P(0.54, 0.145)], [(0.038, 0.036, 0.036), (0.038, 0.036, 0.036), (0.001, 0.001, 0.001)], 'snout', UP, around=16, sub=2)

body = B.merge_smooth(b.to_object('body_hi'))

# 덧붙이는 것: 귀, 엄니, 발톱 (녹여 붙이지 않는다)
eb = B.Builder()
E = D['ears']
for s in (1, -1):
    base = P(E['base'][0], E['base'][1], s * E['base'][2])
    tip = P(E['tip'][0], E['tip'][1], s * E['tip'][2])
    ws = [1, 1.0, 0.92, 0.65, 0.0] if E['round'] else [1, 0.82, 0.58, 0.3, 0.0]
    secs = []
    for i, k in enumerate([0, 0.25, 0.55, 0.82, 1]):
        secs.append((E['w'] * ws[i] * 0.5, 0.016 * (1 - k * 0.4), 0.02 * (1 - k * 0.4)))
    eb.sweep([base.lerp(tip, k) for k in [0, 0.25, 0.55, 0.82, 1]], secs, 'ear', Vector((s * 0.5, -1, 0)).normalized(), around=10, sub=2)
if SP == 'bulgasari':
    # 코뿔소 같은 쇠뿔: 콧등에 하나, 이마에 둘
    eb.sweep([P(0.455, 0.37), P(0.465, 0.41), P(0.46, 0.455)], [(0.018, 0.018, 0.018), (0.012, 0.012, 0.012), (0.002, 0.002, 0.002)], 'horn', UP, around=8, sub=3)
    for s in (1, -1):
        eb.sweep([P(0.39, 0.43, s * 0.045), P(0.375, 0.48, s * 0.06), P(0.35, 0.51, s * 0.065)], [(0.014, 0.014, 0.014), (0.01, 0.01, 0.01), (0.002, 0.002, 0.002)], 'horn', UP, around=8, sub=3)
if SP == 'metdwaeji':
    for s in (1, -1):
        eb.sweep([P(0.43, 0.15, s * 0.04), P(0.47, 0.18, s * 0.058), P(0.47, 0.225, s * 0.052)], [(0.011, 0.011, 0.011), (0.008, 0.008, 0.008), (0.002, 0.002, 0.002)], 'tusk', UP, around=8, sub=3)
# 발톱은 자동 가중치가 엉뚱한 뼈에 붙여 걸을 때 떨어져 보여서 넣지 않는다 (화면에서 1픽셀 남짓)
if False:
    for side in ('L', 'R'):
        for key in ('toeF', 'toeH'):
            c = LEG[side][key]
            pw = D['paw']
            for i in range(4 if SP == 'horangi' else 5):
                ox = (i / (3 if SP == 'horangi' else 4) - 0.5) * pw[0] * 1.4
                a = c + Vector((ox, -pw[1] * 0.8, 0.0))
                eb.sweep([a, a + Vector((0, -0.012, -0.008)), a + Vector((0, -0.018, -0.02))], [(0.005, 0.005, 0.005), (0.004, 0.004, 0.004), (0.001, 0.001, 0.001)], 'claw', UP, around=6, sub=2)
extras = [eb.to_object('extras')]
samples = b.samples + eb.samples
ex, ez, eyx = D['eyes']
EYES = [P(ex, ez, s * eyx) for s in (1, -1)]


def near_eye(co, r):
    return min((co - e).length for e in EYES) < r


# ---------------- 색 ----------------
def horangi_color(part, t, co, n):
    OR, ORD, W, BK = lin(0xd06c22), lin(0xb05418), lin(0xf2ece0), lin(0x1a1412)
    f, z, x = -co.y, co.z, co.x
    c = mixc(OR, ORD, (n.z - 0.4) * 1.5) if n.z > 0.4 else OR

    def stripe(u, width):
        w = noise.noise(co * 18) * 0.25
        v = abs(((u + w) % 1.0) - 0.5) * 2
        return v < width

    if part == 'torso' or part in ('legF0', 'legH0'):
        if n.z < -0.4:
            return W
        # 몸을 두르는 줄: 앞뒤 방향으로 반복하고, 배 쪽으로 가늘어진다
        if stripe(f * 13 + (0.2 if x > 0 else 0.55) + z * 2.5, 0.22 * min(1, (n.z + 0.5) * 1.2)):
            return BK
    elif part == 'neck':
        if n.z < 0.0:
            return W
        if stripe(f * 13 + z * 3, 0.18):
            return BK
    elif part in ('head', 'jaw', 'cheek'):
        if part != 'head' or n.z < -0.2 or (t > 0.62 and n.z < 0.4):
            c = W
        if part == 'head' and n.z > 0.45 and t < 0.6 and stripe(abs(x) * 30 + f * 6, 0.25):
            c = BK
        if part == 'head' and abs(n.x) > 0.6 and t < 0.55 and stripe(z * 40, 0.25):
            c = BK
        if part == 'head' and t > 0.94:
            c = lin(0xc87870)
        for e in EYES:
            d = co - e
            if 0.012 < (d - Vector((0, 0, 0.012))).length < 0.02 and n.z > 0.2:
                c = W  # 눈 위 흰 점
        if near_eye(co, D['eye_r']):
            c = lin(0x0c0808) if near_eye(co, D['eye_r'] * 0.6) else lin(0xe0a830)
    elif part.startswith('leg'):
        if n.y > 0.3 or n.z < -0.3:
            c = mixc(OR, W, 0.6)
        if part in ('legF1', 'legH1') and stripe(z * 22, 0.2):
            c = BK
    elif part.startswith('paw') or part == 'legF3':
        c = mixc(OR, W, 0.55)
    elif part == 'tail':
        c = BK if (stripe(t * 7, 0.25) or t > 0.88) else (mixc(OR, W, 0.4) if n.z < -0.3 else OR)
    elif part == 'ear':
        c = W if n.y < -0.3 else (BK if t > 0.25 else OR)
    elif part == 'claw':
        c = lin(0xe8e0d0)
    return c


def bandalgom_color(part, t, co, n):
    BK, BK2, MZ, W = lin(0x1c1818), lin(0x2c2626), lin(0x8a6a4a), lin(0xeee6d6)
    f, z, x = -co.y, co.z, co.x
    c = BK2 if n.z > 0.4 else BK
    if part == 'torso' or part == 'neck':
        # 가슴의 흰 반달(V): 앞가슴에서 가운데로 모인다
        if f > 0.2 and n.y < -0.3:
            v = z - 0.2
            if 0 < v < 0.13 and abs(abs(x) - v * 0.85) < 0.02:
                c = W
    elif part in ('head', 'jaw'):
        if t > 0.58 or part == 'jaw':
            c = MZ if n.z > -0.6 else mixc(MZ, BK, 0.4)
        if part == 'head' and t > 0.94:
            c = lin(0x0a0808)
        if near_eye(co, D['eye_r']):
            c = lin(0x2a1a10)
    elif part == 'ear':
        c = mixc(BK, MZ, 0.35) if n.y < -0.3 else BK
    elif part == 'claw':
        c = lin(0xd8d0c0)
    return c


def metdwaeji_color(part, t, co, n):
    H, HD, G, PK = lin(0x5a4636), lin(0x34281e), lin(0x7c6c5a), lin(0x9a7068)
    sp = noise.noise(co * 120)
    c = mixc(H, G, 0.6 if sp > 0.2 else 0.12)
    if n.z > 0.55:
        c = mixc(c, HD, 0.6)
    if part == 'mane':
        c = lin(0x241a14) if t > 0.3 else HD
    elif part in ('head', 'jaw'):
        if part == 'head' and abs(n.x) > 0.55 and t < 0.45 and n.z < 0.3:
            c = mixc(G, lin(0xb8a890), 0.45)  # 볼의 희끗한 털
        if part == 'head' and n.z > 0.4:
            c = HD
        if near_eye(co, D['eye_r']):
            c = lin(0x1a0e08)
    elif part == 'snout':
        c = PK if t > 0.4 else mixc(PK, H, 0.5)
        if t > 0.6 and abs(co.x) > 0.01 and abs(co.x) < 0.025 and abs(co.z - 0.145) < 0.012:
            c = lin(0x1a0e0a)
    elif part == 'tusk':
        c = lin(0xeee2c8)
    elif part.startswith('paw') or part in ('legF3',):
        c = lin(0x161012)
    elif part.startswith('leg') and part not in ('legF0', 'legH0'):
        c = HD
    elif part == 'ear':
        c = mixc(PK, H, 0.4) if n.y < -0.3 else HD
    elif part == 'tail':
        c = HD if t < 0.75 else lin(0x1e1610)
    return c


def bulgasari_color(part, t, co, n):
    IRON, IROND, RUST, HOT = lin(0x4e5058), lin(0x2c2e36), lin(0x7a5640), lin(0xff7a2a)
    f, z, x = -co.y, co.z, co.x
    r = noise.noise(co * 22)
    c = RUST if r > 0.38 else (IROND if n.z > 0.5 else IRON)
    # 쇳물처럼 달아오른 틈: 가는 균열 무늬 (게임에서 스스로 빛난다)
    crack = abs(noise.noise(co * 9 + Vector((3, 1, 7)))) < 0.035
    if part in ('torso', 'neck', 'legF0', 'legH0') and crack and n.z < 0.75:
        return HOT
    if part.startswith('leg') and part not in ('legF0', 'legH0'):
        # 범의 다리: 녹슨 가로 줄
        c = RUST if abs((z * 30) % 1.0 - 0.5) < 0.18 else IRON
    elif part in ('head', 'jaw', 'trunk'):
        c = IRON if part != 'trunk' or abs((t * 14) % 1.0 - 0.5) > 0.15 else IROND
        if part == 'head' and min((co - P(D['eyes'][0], D['eyes'][1], s * D['eyes'][2])).length for s in (1, -1)) < 0.013:
            c = HOT
    elif part == 'spike':
        # 바늘은 끝으로 갈수록 밝다. 뿌리 쪽은 몸통 쇳빛이라 등판에 밝은 얼룩이 번지지 않는다
        c = IROND if t < 0.6 else mixc(lin(0x6a6c76), lin(0xb8bac4), (t - 0.6) / 0.4)
    elif part == 'horn':
        c = mixc(lin(0x8a8c96), lin(0xc8cad2), t)
    elif part in ('tail', 'tuft'):
        c = IROND if part == 'tail' else lin(0x8a8c96)
    elif part == 'ear':
        c = IROND
    return c


COLORS = dict(horangi=horangi_color, bandalgom=bandalgom_color, metdwaeji=metdwaeji_color, bulgasari=bulgasari_color)
B.paint([body] + extras, samples, COLORS[SP], grain={'bandalgom': 0.7}.get(SP, 1.0))

if STAGE == 'paint':
    print(B.preview(OUT, f'{SP}_paint', [body] + extras, scale=1.6, target=Vector((0, 0.05, 0.25))))
    sys.exit(0)

low = B.make_low(body, extras, tris=3600, name=SP)
B.bake([body] + extras, low, None, size=256 if SP == 'bulgasari' else 128)

# ---------------- 뼈대 ----------------
def Pf(fz):
    return P(fz[0], fz[1])

L = dict(hips0=Pf(D['hipsb'][0]), hips1=Pf(D['hipsb'][1]), spine1=Pf(D['spineb']), chest1=Pf(D['chestb']), neck0=Pf(D['neckb'][0]), neck1=Pf(D['headb'][0]),
         head1=Pf(D['headb'][1]), jaw0=Pf(D['jawb'][0]), jaw1=Pf(D['jawb'][1]))
for side, s in (('L', 1), ('R', -1)):
    L['ear0' + side] = P(E['base'][0], E['base'][1], s * E['base'][2])
    L['ear1' + side] = P(E['tip'][0], E['tip'][1], s * E['tip'][2])
    for k, v in LEG[side].items():
        L[k + side] = v
tail_bones = [tp[0]] + [tp[i] for i in range(2, len(tp), 2)] + ([tp[-1]] if (len(tp) - 1) % 2 else [])


def trunk_bones(r):
    tr = D['trunk'][0]
    r.bone('trunk1', tr[0], tr[2], 'head')
    r.bone('trunk2', tr[2], tr[4], 'trunk1', True)
    r.bone('trunk3', tr[4], tr[5], 'trunk2', True)

r = B.Rig(SP + '_rig')
B.quad_bones(r, L, [tail_bones], trunk_bones if SP == 'bulgasari' else None)
r.finish()
r.skin(low)

# ---------------- 동작 ----------------
A = B.Anim(r)
tails = [[f'tail{i + 1}' for i in range(len(tail_bones) - 1)]]
if SP == 'horangi':
    attack = [
        (1, {}),
        (4, {'hipsL': (0, 0.03, -0.05), 'hips': [(X, 4)], 'neck': [(X, 12)], 'head': [(X, 6)], 'feet': {'ikH.L': (-0.04, 0), 'ikH.R': (-0.04, 0)}}),
        (7, {'hipsL': (0, -0.12, 0.1), 'hips': [(X, -16)], 'neck': [(X, -10)], 'jaw': [(X, -30)], 'feet': {'ikF.L': (0.15, 0.14), 'ikF.R': (0.13, 0.12), 'ikH.L': (-0.07, 0.0), 'ikH.R': (-0.06, 0.0)}}),
        (9, {'hipsL': (0, -0.15, -0.02), 'hips': [(X, 8)], 'neck': [(X, 12)], 'jaw': [(X, -34)], 'feet': {'ikF.L': (0.17, 0), 'ikF.R': (0.16, 0.01)}}),
        (13, {'hipsL': (0, -0.07, -0.01), 'neck': [(X, 5)], 'jaw': [(X, -6)], 'feet': {'ikF.L': (0.08, 0), 'ikF.R': (0.07, 0)}}),
        (16, {}),
    ]
    opt = dict(gait='walk', stride=0.08, lift=0.05, bob=0.004, roll=2, tailAmp=8, tailDroop=4, attack=attack, walk_n=20)
elif SP in ('bandalgom', 'bulgasari'):
    attack = [
        (1, {}),
        (6, {'hipsL': (0, 0.06, 0.1), 'hips': [(X, -34)], 'neck': [(X, -8)], 'head': [(X, -6)], 'jaw': [(X, -26)], 'feet': {'ikF.L': (0.03, 0.26), 'ikF.R': (0.06, 0.24)}}),
        (10, {'hipsL': (0, -0.07, -0.04), 'hips': [(X, 8)], 'neck': [(X, 12)], 'jaw': [(X, -10)], 'feet': {'ikF.L': (0.14, 0), 'ikF.R': (0.12, 0)}}),
        (15, {'hipsL': (0, -0.03, -0.01), 'neck': [(X, 4)], 'feet': {'ikF.L': (0.06, 0), 'ikF.R': (0.05, 0)}}),
        (18, {}),
    ]
    opt = dict(gait='walk', stride=0.075, lift=0.05, bob=0.01, roll=5, tailAmp=3, attack=attack, walk_n=20)
else:
    attack = [
        (1, {}),
        (4, {'hipsL': (0, 0.05, -0.03), 'hips': [(X, 6)], 'neck': [(X, 14)], 'head': [(X, 10)], 'feet': {'ikH.L': (-0.03, 0), 'ikH.R': (-0.03, 0)}}),
        (7, {'hipsL': (0, -0.1, 0.0), 'hips': [(X, -4)], 'neck': [(X, -10)], 'head': [(X, -18)], 'feet': {'ikF.L': (0.09, 0.03), 'ikF.R': (0.06, 0), 'ikH.L': (0.02, 0), 'ikH.R': (-0.01, 0)}}),
        (10, {'hipsL': (0, -0.07, 0), 'neck': [(X, -2)], 'head': [(X, -4)], 'feet': {'ikF.L': (0.07, 0), 'ikF.R': (0.06, 0)}}),
        (13, {}),
    ]
    opt = dict(stride=0.06, lift=0.035, bob=0.007, tailAmp=14, attack=attack)
if SP == 'bulgasari':
    opt.update(stride=0.08, roll=6, bob=0.012)
    TR = ['trunk1', 'trunk2', 'trunk3']

    def trunk(ph, amp, lift=0.0, side=0.0):
        return {n: [(X, -lift * (1 if i == 0 else 0.6) + amp * math.sin(ph - i * 0.9)), (Z, side * (1 if i == 0 else 0.5))] for i, n in enumerate(TR)}

    opt['extra'] = lambda name, k, t: trunk(t, 8 if name == 'idle' else 12)
B.quad_anims(A, tails, opt)
if SP == 'bulgasari':
    # 머리와 코를 옆으로 휘둘러 쓸어 버린다
    A.begin('sweep')
    for f, p in [(1, trunk(0, 6)),
                 (5, {'hips': [(Z, -16)], 'neck': [(Z, 30), (X, 8)], 'hipsL': (0, 0, -0.03), **trunk(1, 6, 20, 30)}),
                 (9, {'hips': [(Z, 22)], 'neck': [(Z, -36), (X, 4)], 'jaw': [(X, -16)], 'hipsL': (0, 0, -0.015), **trunk(2, 10, 40, -60)}),
                 (13, {'hips': [(Z, 10)], 'neck': [(Z, -14)], **trunk(3, 8, 10, -20)}),
                 (17, trunk(4, 6))]:
        A.frame(f, p)
    # 일어서 짓밟는다
    A.begin('slam')
    for f, p in [(1, trunk(0, 6)),
                 (7, {'hipsL': (0, 0.07, 0.12), 'hips': [(X, -36)], 'neck': [(X, -10)], 'jaw': [(X, -24)], 'feet': {'ikF.L': (0.03, 0.28), 'ikF.R': (0.06, 0.26)}, **trunk(1, 6, 60)}),
                 (11, {'hipsL': (0, -0.08, -0.05), 'hips': [(X, 10)], 'neck': [(X, 14)], 'feet': {'ikF.L': (0.15, 0), 'ikF.R': (0.13, 0)}, **trunk(2, 16, -20)}),
                 (16, {'hipsL': (0, -0.03, -0.01), 'feet': {'ikF.L': (0.06, 0), 'ikF.R': (0.05, 0)}, **trunk(3, 8)}),
                 (20, trunk(4, 6))]:
        A.frame(f, p)
    # 코를 높이 쳐들고 울부짖는다
    A.begin('cast')
    for f, p in [(1, trunk(0, 6)),
                 (5, {'hipsL': (0, 0, -0.04), 'neck': [(X, 10)], **trunk(1, 4, -10)}),
                 (9, {'hipsL': (0, 0, 0.02), 'hips': [(X, -10), (Y, 4)], 'neck': [(X, -30)], 'head': [(X, -10)], 'jaw': [(X, -30)], **trunk(2, 4, 80)}),
                 (11, {'hipsL': (0, 0, 0.02), 'hips': [(X, -10), (Y, -4)], 'neck': [(X, -28)], 'jaw': [(X, -32)], **trunk(3, 4, 84)}),
                 (13, {'hipsL': (0, 0, 0.015), 'hips': [(X, -8), (Y, 4)], 'neck': [(X, -24)], 'jaw': [(X, -26)], **trunk(4, 4, 70)}),
                 (16, trunk(5, 6, 10))]:
        A.frame(f, p)
B.export(low, r, os.path.join(OUT, f'{SP}.glb'))
