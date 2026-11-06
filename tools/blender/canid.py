# 개과 짐승: 여우, 늑대, 승냥이, 너구리, 구미호. 여우 해부 좌표를 기준으로 종마다 비율·색·특징을 바꾼다.
# 실행: Blender -b --factory-startup -P tools/blender/canid.py -- <종> <출력 폴더> [preview|paint]
import sys, os, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import beastlib as B
from beastlib import P, X, Y, Z, lin, mixc
from mathutils import Vector

argv = sys.argv[sys.argv.index('--') + 1:]
SP = argv[0]
OUT = os.path.abspath(argv[1])
STAGE = argv[2] if len(argv) > 2 else 'all'
os.makedirs(OUT, exist_ok=True)

SPECS = {
    'fox': dict(),
    'wolf': dict(body_w=1.22, body_d=1.18, leg_k=1.3, neck_k=1.45, head_k=1.22, muzzle=1.0, ear_h=0.62, ear_w=1.1, tail_k=0.82, tail_droop=22, cheek=1.6),
    'dhole': dict(body_w=1.06, body_d=1.05, leg_k=1.08, neck_k=1.08, head_k=1.05, muzzle=0.8, ear_h=0.68, ear_w=1.15, ear_round=True, tail_k=1.0, tail_droop=14),
    'raccoon': dict(body_w=1.5, body_d=1.32, leg_len=0.62, leg_k=1.3, neck_k=1.5, head_k=1.18, muzzle=0.72, ear_h=0.5, ear_w=0.95, ear_round=True, tail_k=1.2, tail_len=0.55, tail_droop=34, cheek=2.0, chest=0.78),
    'gumiho': dict(body_w=1.05, leg_k=1.1, neck_k=1.15, head_k=1.08, muzzle=1.05, ear_h=0.92, ear_w=1.05, tails=9, cheek=1.2),
}
S = dict(body_w=1.0, body_d=1.0, chest=1.0, leg_len=1.0, leg_k=1.0, neck_k=1.0, head_k=1.0, muzzle=1.0, ear_h=1.0, ear_w=1.0, ear_round=False, tail_k=1.0, tail_len=1.0, tail_droop=0, cheek=1.0, tails=1)
S.update(SPECS[SP])

B.reset()
ZB = 0.38  # 여우 몸통 높이

def up(v):
    """몸통·머리·꼬리 점: 다리 길이에 맞춰 위아래로 옮긴다"""
    return v + Vector((0, 0, ZB * (S['leg_len'] - 1)))

def legp(f, z, x):
    return P(f, z * S['leg_len'], x)

def Pb(f, z, x=0.0):
    return up(P(f, z, x))

# 머리 기준점: 두개골 가운데. 머리 점은 여기서 head_k로 키우고, 주둥이 쪽은 muzzle로 늘인다
HC = Pb(0.3, 0.545)

def Ph(f, z, x=0.0):
    p = Pb(f, z, x) - HC
    p *= S['head_k']
    if p.y < 0:  # 앞쪽(주둥이)
        p.y *= S['muzzle']
    return HC + p

# 목 끝을 머리 크기에 맞춰 조금 들어 올린다
def neck_end(f, z):
    return Pb(f, z) + Vector((0, 0, 0.012 * (S['head_k'] - 1) * 4))

# 꼬리: 뿌리 둘레로 아래로 늘어뜨리고 길이를 바꾼다
TR = Pb(-0.215, 0.375)

def Pt(f, z):
    p = Pb(f, z) - TR
    p.y *= S['tail_len']
    p.z *= S['tail_len']
    a = math.radians(S['tail_droop'])
    y, zz = p.y, p.z
    p.y, p.z = y * math.cos(a) + zz * math.sin(a) * 0, zz * math.cos(a) - abs(y) * math.sin(a)
    return TR + p

bw, bd, lk, nk, tk = S['body_w'], S['body_d'], S['leg_k'], S['neck_k'], S['tail_k']
b = B.Builder()
# 몸통
b.sweep([Pb(f, z) for f, z in [(-0.235, 0.372), (-0.19, 0.385), (-0.14, 0.388), (-0.04, 0.38), (0.06, 0.376), (0.15, 0.372), (0.21, 0.378), (0.235, 0.39)]],
        [(w * bw, u * bd, d * bd * (S['chest'] if i >= 4 else 1)) for i, (w, u, d) in enumerate([(0.03, 0.03, 0.03), (0.06, 0.055, 0.06), (0.075, 0.068, 0.085), (0.062, 0.06, 0.066), (0.07, 0.064, 0.09), (0.074, 0.066, 0.108), (0.066, 0.062, 0.1), (0.04, 0.045, 0.06)])], 'torso')
# 목
b.sweep([Pb(0.17, 0.4), Pb(0.22, 0.44), neck_end(0.265, 0.495), neck_end(0.29, 0.53)], [(w * nk, u * nk, d * nk) for w, u, d in [(0.06, 0.055, 0.075), (0.056, 0.052, 0.07), (0.048, 0.046, 0.055), (0.04, 0.04, 0.042)]], 'neck')
# 머리
hk = S['head_k']
b.sweep([Ph(f, z) for f, z in [(0.245, 0.535), (0.28, 0.548), (0.315, 0.547), (0.35, 0.535), (0.39, 0.518), (0.425, 0.505), (0.448, 0.498)]],
        [(w * hk, u * hk, d * hk) for w, u, d in [(0.04, 0.04, 0.04), (0.062, 0.058, 0.052), (0.064, 0.054, 0.05), (0.044, 0.038, 0.036), (0.028, 0.024, 0.025), (0.017, 0.016, 0.017), (0.006, 0.006, 0.006)]], 'head')
b.sweep([Ph(f, z) for f, z in [(0.3, 0.508), (0.36, 0.494), (0.415, 0.486), (0.432, 0.485)]], [(w * hk, u * hk, d * hk) for w, u, d in [(0.032, 0.014, 0.02), (0.024, 0.01, 0.016), (0.013, 0.007, 0.01), (0.005, 0.004, 0.005)]], 'jaw')
ck = S['cheek']
for s in (1, -1):
    b.sweep([Ph(0.335, 0.522, s * 0.035), Ph(0.305, 0.512, s * (0.035 + 0.023 * ck)), Ph(0.272, 0.5, s * (0.035 + 0.043 * ck))], [(0.022 * ck ** 0.5, 0.024 * ck ** 0.5, 0.022 * ck ** 0.5), (0.018 * ck ** 0.5, 0.02 * ck ** 0.5, 0.018 * ck ** 0.5), (0.003, 0.003, 0.003)], 'cheek', Vector((0, 0, 1)), around=12)
# 꼬리 (하나일 때만 몸에 녹여 붙인다)
TAIL = [(-0.215, 0.375), (-0.27, 0.345), (-0.35, 0.31), (-0.45, 0.28), (-0.54, 0.268), (-0.6, 0.27), (-0.625, 0.272)]
if S['tails'] == 1:
    b.sweep([Pt(f, z) for f, z in TAIL], [(r * tk, r * tk, r * tk * 0.97) for r in (0.022, 0.042, 0.06, 0.064, 0.05, 0.026, 0.004)], 'tail')
# 다리
FWD = Vector((0, -1, 0))
LEG = {}
for s, side in ((1, 'L'), (-1, 'R')):
    x = s * 0.05 * (1 + (bw - 1) * 0.6)
    F = lambda f, z, k: legp(f, z, x * k) if z < ZB - 0.02 else up(P(f, z, x * k))
    LEG[side] = dict(scap0=F(0.2, 0.44, 0.8), shoulder=F(0.18, 0.33, 1.05), elbow=legp(0.155, 0.215, x * 1.1), wrist=legp(0.172, 0.065, x * 1.1), toeF=legp(0.215, 0.014, x * 1.1),
                     hip=F(-0.13, 0.39, 0.9), knee=legp(-0.065, 0.225, x * 1.15), hock=legp(-0.165, 0.105, x * 1.1), ankle=legp(-0.155, 0.022, x * 1.1), toeH=legp(-0.12, 0.012, x * 1.1))
    sec = lambda rows: [(a * lk, c * lk, d * lk) for a, c, d in rows]
    b.sweep([F(0.2, 0.44, 0.8), F(0.19, 0.38, 1.0), F(0.18, 0.33, 1.05)], sec([(0.045, 0.0674, 0.06), (0.048, 0.063, 0.063), (0.042, 0.048, 0.051)]), 'legF0', FWD)
    b.sweep([F(0.18, 0.34, 1.05), legp(0.165, 0.27, x * 1.08), legp(0.155, 0.215, x * 1.1)], sec([(0.045, 0.045, 0.051), (0.0374, 0.0374, 0.042), (0.03, 0.03, 0.036)]), 'legF1', FWD)
    b.sweep([legp(0.155, 0.225, x * 1.1), legp(0.163, 0.14, x * 1.1), legp(0.172, 0.065, x * 1.1)], sec([(0.0286, 0.027, 0.033), (0.0224, 0.021, 0.024), (0.018, 0.018, 0.0196)]), 'legF2', FWD)
    b.sweep([legp(0.172, 0.07, x * 1.1), legp(0.185, 0.035, x * 1.1), legp(0.2, 0.018, x * 1.1)], sec([(0.018, 0.018, 0.0196), (0.018, 0.018, 0.018), (0.0196, 0.018, 0.018)]), 'legF3', FWD)
    b.ball(legp(0.215, 0.014, x * 1.1), 0.017 * lk, 0.024 * lk, 0.012 * lk, 'pawF')
    b.sweep([F(-0.13, 0.39, 0.9), F(-0.1, 0.32, 1.1), legp(-0.07, 0.25, x * 1.15), legp(-0.065, 0.225, x * 1.15)], sec([(0.06, 0.09, 0.0826), (0.063, 0.0976, 0.078), (0.045, 0.06, 0.0526), (0.036, 0.039, 0.039)]), 'legH0', FWD)
    b.sweep([legp(-0.065, 0.235, x * 1.15), legp(-0.11, 0.17, x * 1.12), legp(-0.165, 0.105, x * 1.1)], sec([(0.033, 0.036, 0.039), (0.0256, 0.024, 0.033), (0.018, 0.0164, 0.024)]), 'legH1', FWD)
    b.sweep([legp(-0.165, 0.11, x * 1.1), legp(-0.16, 0.06, x * 1.1), legp(-0.155, 0.022, x * 1.1)], sec([(0.018, 0.0164, 0.024), (0.0164, 0.0164, 0.018), (0.018, 0.018, 0.018)]), 'legH2', FWD)
    b.ball(legp(-0.14, 0.014, x * 1.1), 0.017 * lk, 0.026 * lk, 0.012 * lk, 'pawH')

body = B.merge_smooth(b.to_object('body_hi'))

# 귀: 앞뒤 두께가 있는 뿔 모양. 둥근 귀는 끝을 둥글게
def ear_geo(e, s):
    base = Ph(0.288, 0.575, s * 0.04)
    tip = Ph(0.288 - 0.02 * S['ear_h'], 0.575 + 0.16 * S['ear_h'], s * (0.04 + 0.042 * S['ear_h']))
    w = 0.056 * S['ear_w'] * hk
    t = 0.017 * hk
    ws = [1, 0.95, 0.85, 0.6, 0.0] if S['ear_round'] else [1, 0.82, 0.58, 0.3, 0.0]
    pts, secs = [], []
    for i, k in enumerate([0, 0.25, 0.55, 0.82, 1]):
        pts.append(base.lerp(tip, k))
        secs.append((w * ws[i] * 0.5, t * (1 - k * 0.4), t * 1.1 * (1 - k * 0.4)))
    e.sweep(pts, secs, 'ear', Vector((s * 0.6, -1, 0)).normalized(), around=10, sub=2)

eb = B.Builder()
for s in (1, -1):
    ear_geo(eb, s)
extras_obj = [eb.to_object('ears')]

# 구미호: 꼬리 아홉과 여우불 (몸에 녹이지 않는다)
TAILS = []
if S['tails'] > 1:
    tb = B.Builder()
    n = S['tails']
    for i in range(n):
        a = (i - (n - 1) / 2) / ((n - 1) / 2) * 1.55
        sx = math.sin(a)
        lift = math.cos(a)
        ln = 1.0 + 0.16 * (1 if i % 2 else -1) + 0.06 * math.cos(i * 2.3)
        bk = 0.06 * (1 - lift)
        pts = [Pb(-0.205, 0.385, 0), Pb(-0.28 - bk, 0.41 + 0.03 * lift, sx * 0.08), Pb(-0.38 - bk * 1.5, 0.46 + 0.12 * lift * ln, sx * 0.2 * ln),
               Pb(-0.44 - bk * 2, 0.55 + 0.18 * lift * ln, sx * 0.3 * ln), Pb(-0.42 - bk * 2, 0.64 + 0.2 * lift * ln, sx * 0.35 * ln)]
        tb.sweep(pts, [(0.022, 0.022, 0.022), (0.042, 0.042, 0.042), (0.054, 0.054, 0.054), (0.04, 0.04, 0.04), (0.006, 0.006, 0.006)], f'tail{i}', Vector((1, 0, 0)), around=12, sub=3)
        tip = pts[-1]
        # 여우불: 아래가 둥글고 위로 뾰족한 불꽃
        fp = [tip + Vector((0, 0, -0.02)), tip + Vector((0, 0, 0.005)), tip + Vector((0, 0, 0.04)), tip + Vector((0, 0, 0.085)), tip + Vector((0, 0, 0.12))]
        tb.sweep(fp, [(0.001, 0.001, 0.001), (0.04, 0.04, 0.04), (0.034, 0.034, 0.034), (0.014, 0.014, 0.014), (0.001, 0.001, 0.001)], 'fire', Vector((0, -1, 0)), around=8, sub=2)
        TAILS.append(pts)
    extras_obj.append(tb.to_object('tails'))
    samples_extra = tb.samples
else:
    samples_extra = []

samples = b.samples + eb.samples + samples_extra
EYES = [Ph(0.338, 0.552, s * 0.043) for s in (1, -1)]

# ---------------- 색 ----------------
def eyes(co, c, ring):
    for e in EYES:
        d = (co - e).length
        if d < 0.012 * hk:
            return lin(0x0c0808) if d < 0.0085 * hk else ring
    return c

def fox_color(part, t, co, n):
    RED, RED_D, CREAM, WHITE, BLACK = lin(0xcf6424), lin(0x9a3e16), lin(0xead6b8), lin(0xf4efe4), lin(0x241814)
    c = mixc(RED, RED_D, (n.z - 0.55) * 2.2) if n.z > 0.55 else RED
    if part == 'torso':
        if n.z < -0.45:
            c = mixc(RED, CREAM, (-n.z - 0.45) * 3)
        if t > 0.8 and n.z < 0.25 and n.y < -0.1:
            c = WHITE
    elif part == 'neck':
        if n.z < 0.25:
            c = WHITE
    elif part in ('head', 'jaw', 'cheek'):
        if part != 'head' or n.z < -0.15 or (t < 0.5 and abs(n.x) > 0.6 and n.z < 0.3):
            c = WHITE
        if part == 'head' and t > 0.93:
            c = lin(0x100c0c)
        c = eyes(co, c, mixc(BLACK, RED_D, 0.5))
    elif part in ('legF2', 'legF3', 'pawF', 'legH2', 'pawH'):
        c = BLACK
    elif part == 'legF1' and n.y > 0.2:
        c = mixc(RED, BLACK, 0.6)
    elif part == 'tail':
        c = mixc(RED, RED_D, 0.35) if n.z > 0.3 else RED
        if t > 0.82:
            c = WHITE
    elif part == 'ear':
        c = (CREAM if t < 0.7 else BLACK) if n.y < -0.2 else (BLACK if t > 0.45 else RED_D)
    return c

def wolf_color(part, t, co, n):
    G, GD, TAN, CR, DK = lin(0x7a7268), lin(0x34302c), lin(0x9a8268), lin(0xd8ccb8), lin(0x1c1a18)
    c = mixc(TAN, G, (n.z + 0.1) * 1.5)
    if part == 'torso':
        if n.z > 0.35 and 0.15 < t < 0.85:
            c = mixc(G, GD, (n.z - 0.35) * 2.5)
        if n.z < -0.4:
            c = CR
        if t > 0.8 and n.z < 0.2:
            c = CR
    elif part == 'neck':
        c = CR if n.z < 0.0 else mixc(G, GD, 0.35)
    elif part in ('head', 'jaw', 'cheek'):
        c = mixc(G, TAN, 0.3)
        if part != 'head' or n.z < -0.05 or (abs(n.x) > 0.55 and t < 0.55):
            c = CR
        if part == 'head' and n.z > 0.5 and t > 0.4:
            c = mixc(G, GD, 0.5)
        if part == 'head' and t > 0.93:
            c = lin(0x100c0c)
        c = eyes(co, c, lin(0xb08a3a))
    elif part.startswith('leg') or part.startswith('paw'):
        c = mixc(TAN, CR, 0.4) if n.y > 0.1 or n.z < -0.2 else TAN
        if part in ('legF0', 'legH0') and n.z > 0.2:
            c = G
    elif part == 'tail':
        c = mixc(G, GD, 0.5) if n.z > 0.3 else G
        if t > 0.8:
            c = DK
    elif part == 'ear':
        c = CR if (n.y < -0.4 and t < 0.6) else GD
    return c

def dhole_color(part, t, co, n):
    R, RD, CR, BK = lin(0xb85a26), lin(0x7e3a1a), lin(0xe4cfac), lin(0x1e1614)
    c = mixc(R, RD, (n.z - 0.5) * 2) if n.z > 0.5 else R
    if part == 'torso':
        if n.z < -0.35:
            c = CR
        if t > 0.8 and n.z < 0.2:
            c = CR
    elif part == 'neck':
        if n.z < 0.1:
            c = CR
    elif part in ('head', 'jaw', 'cheek'):
        if part != 'head' or n.z < -0.15:
            c = CR
        if part == 'head' and t > 0.62:
            c = mixc(RD, BK, 0.45) if n.z > -0.15 else CR
        if part == 'head' and t > 0.93:
            c = lin(0x100c0c)
        c = eyes(co, c, lin(0x8a5a2a))
    elif part.startswith('leg') or part.startswith('paw'):
        c = mixc(R, CR, 0.35) if n.y > 0.2 else RD
    elif part == 'tail':
        c = mixc(RD, BK, 0.5) if t < 0.18 else BK
    elif part == 'ear':
        c = lin(0xf4ece0) if n.y < -0.2 else R
    return c

def raccoon_color(part, t, co, n):
    BUFF, GRIZ, PALE, BK = lin(0xa88c62), lin(0x5a4e40), lin(0xddd2bc), lin(0x1a1614)
    from mathutils import noise as nz
    sp = nz.noise(co * 140)
    c = mixc(BUFF, GRIZ, 0.65 if sp > 0.15 else 0.15)
    if n.z > 0.6:
        c = mixc(c, BK, 0.4)
    if part == 'torso':
        if t > 0.72 and n.z > -0.2:
            c = mixc(c, BK, 0.55)  # 어깨를 가로지르는 검은 띠
        if n.z < -0.3 and t > 0.45:
            c = BK
    elif part == 'neck':
        if n.z < 0.2:
            c = BK
    elif part in ('head', 'jaw', 'cheek'):
        c = PALE if part != 'cheek' else mixc(PALE, BUFF, 0.35)
        if part == 'head':
            # 눈을 감싼 검은 털이 볼로 흘러내린다
            for e in EYES:
                d = co - e
                if (d.x * d.x) / 0.0012 + (d.y * d.y) / 0.0016 + (d.z * d.z) / 0.0009 < 1 or (abs(n.x) > 0.5 and -0.6 < n.z < 0.2 and 0.25 < t < 0.65):
                    c = BK
            if t > 0.92:
                c = lin(0x100c0c)
        c = eyes(co, c, lin(0x6a4a24))
    elif part.startswith('leg') or part.startswith('paw'):
        c = BK
    elif part == 'tail':
        c = BK if n.z > 0.35 else mixc(BUFF, GRIZ, 0.4)
    elif part == 'ear':
        c = PALE if (n.y < -0.2 and t < 0.6) else BK
    return c

def gumiho_color(part, t, co, n):
    W, GOLD, RED, BLUE = lin(0xf6f1e8), lin(0xe0c896), lin(0xd02a36), lin(0x8fd8ff)
    c = mixc(W, GOLD, (n.z - 0.4) * 1.8) if n.z > 0.4 else W
    if part == 'head':
        # 이마의 붉은 불꽃 무늬, 눈가의 붉은 선
        if n.z > 0.55 and 0.25 < t < 0.55 and abs(co.x) < 0.012 + (0.55 - t) * 0.03:
            c = RED
        if abs(n.x) > 0.5 and -0.1 < n.z < 0.4 and 0.45 < t < 0.62:
            c = RED
        if t > 0.93:
            c = lin(0x201418)
        for e in EYES:
            d = (co - e).length
            if d < 0.012 * hk:
                c = lin(0xff2a3a) if d < 0.0085 * hk else RED
    elif part.startswith('leg') or part.startswith('paw'):
        c = GOLD if part in ('legF3', 'pawF', 'legH2', 'pawH') else W
    elif part.startswith('tail'):
        c = mixc(GOLD, W, t * 2.5) if t < 0.4 else W
        if t > 0.86:
            c = mixc(W, BLUE, (t - 0.86) * 7)
    elif part == 'fire':
        c = mixc(lin(0xdff4ff), lin(0x3a9aff), 0.55 if t < 0.45 else 0.9)
    elif part == 'ear':
        c = lin(0xf8d0d0) if n.y < -0.2 else (RED if t > 0.75 else GOLD)
    return c

COLORS = dict(fox=fox_color, wolf=wolf_color, dhole=dhole_color, raccoon=raccoon_color, gumiho=gumiho_color)

def colorize(part, t, co, n):
    # 어깨와 넓적다리는 몸통 털로 칠한다 (너구리는 다리 전체가 검다)
    if part in ('legF0', 'legH0') and SP != 'raccoon':
        part, t = 'torso', 0.5
    return COLORS[SP](part, t, co, n)

B.paint([body] + extras_obj, samples, colorize, grain={'gumiho': 0.5}.get(SP, 1.0))

if STAGE in ('preview', 'paint'):
    print(B.preview(OUT, f'{SP}_paint', [body] + extras_obj))
    sys.exit(0)

low = B.make_low(body, extras_obj, tris=3200 if S['tails'] == 1 else 3000, name=SP)
B.bake([body] + extras_obj, low, None)

# ---------------- 뼈대 ----------------
L = dict(hips0=Pb(-0.2, 0.38), hips1=Pb(-0.08, 0.385), spine1=Pb(0.05, 0.378), chest1=Pb(0.18, 0.385), neck0=Pb(0.18, 0.40), neck1=Ph(0.27, 0.51), head1=Ph(0.42, 0.51), jaw0=Ph(0.3, 0.5), jaw1=Ph(0.42, 0.487))
for side, s in (('L', 1), ('R', -1)):
    L['ear0' + side] = Ph(0.29, 0.585, s * 0.036)
    L['ear1' + side] = Ph(0.288 - 0.02 * S['ear_h'], 0.575 + 0.16 * S['ear_h'], s * (0.04 + 0.042 * S['ear_h']))
    for k, v in LEG[side].items():
        L[k + side] = v
if S['tails'] == 1:
    tails = [[Pt(f, z) for f, z in [(-0.215, 0.375), (-0.3, 0.335), (-0.4, 0.298), (-0.5, 0.272), (-0.625, 0.27)]]]
else:
    tails = [[pts[0], pts[1], pts[2], pts[4]] for pts in TAILS]

def fire_bones(r):
    for i, pts in enumerate(TAILS):
        r.bone(f'fire{i}', pts[-1], pts[-1] + Vector((0, 0, 0.12)), f't{i}_3')

r = B.Rig(SP + '_rig')
B.quad_bones(r, L, tails, fire_bones if TAILS else None)
r.finish()
r.skin(low)

# ---------------- 동작 ----------------
A = B.Anim(r)
tail_names = [['tail1', 'tail2', 'tail3', 'tail4']] if S['tails'] == 1 else [[f't{i}_1', f't{i}_2', f't{i}_3'] for i in range(S['tails'])]
opt = dict(size=S['leg_len'], stride=0.075 * S['leg_len'], lift=0.045 * S['leg_len'], tailAmp=6 if S['tails'] == 1 else 4)
if SP == 'raccoon':
    opt.update(bob=0.008, roll=4)
B.quad_anims(A, tail_names, opt)

if SP == 'gumiho':
    def tails_fan(phase, amp, lift=0.0, side=0.0):
        d = {}
        for i, names in enumerate(tail_names):
            for j, nm in enumerate(names):
                d[nm] = [(X, -lift * (1 if j == 0 else 0.4) + amp * 0.5 * math.sin(phase + i * 0.7 + j)), (Z, side * (1 if j == 0 else 0.5) + amp * 0.6 * math.sin(phase * 0.5 + i * 0.5))]
        return d
    # 몸을 비틀어 꼬리로 후려친다
    A.begin('sweep')
    for f, p in [(1, tails_fan(0, 6)),
                 (5, {'hips': [(Z, -22)], 'chest': [(Z, -10)], 'neck': [(Z, 24)], 'hipsL': (0, 0, -0.03), **tails_fan(1, 8, -10, -30)}),
                 (9, {'hips': [(Z, 32)], 'chest': [(Z, 14)], 'neck': [(Z, -26)], 'hipsL': (0, 0, -0.015), **tails_fan(2, 18, 10, 55)}),
                 (13, {'hips': [(Z, 16)], 'neck': [(Z, -10)], **tails_fan(3, 10, 0, 25)}),
                 (17, tails_fan(4, 6))]:
        A.frame(f, p)
    # 뛰어올라 짓누른다
    A.begin('slam')
    for f, p in [(1, tails_fan(0, 6)),
                 (6, {'hipsL': (0, 0.08, 0.1), 'hips': [(X, -30)], 'neck': [(X, -16)], 'jaw': [(X, -26)], 'feet': {'ikF.L': (0.02, 0.22), 'ikF.R': (0.05, 0.2), 'ikH.L': (0.04, 0), 'ikH.R': (0.04, 0)}, **tails_fan(1, 10, 20)}),
                 (10, {'hipsL': (0, -0.08, -0.04), 'hips': [(X, 8)], 'neck': [(X, 14)], 'jaw': [(X, -10)], 'feet': {'ikF.L': (0.12, 0), 'ikF.R': (0.11, 0)}, **tails_fan(2, 16, -10)}),
                 (15, {'hipsL': (0, -0.04, -0.02), 'neck': [(X, 6)], 'feet': {'ikF.L': (0.06, 0), 'ikF.R': (0.05, 0)}, **tails_fan(3, 8)}),
                 (19, tails_fan(4, 6))]:
        A.frame(f, p)
    # 고개를 쳐들고 꼬리를 활짝 펼쳐 여우불을 부른다
    A.begin('cast')
    for f, p in [(1, tails_fan(0, 6)),
                 (5, {'hipsL': (0, 0, -0.04), 'neck': [(X, 10)], 'jaw': [(X, -4)], **tails_fan(1, 4, -12)}),
                 (9, {'hipsL': (0, 0, 0.02), 'hips': [(X, -10)], 'neck': [(X, -36)], 'head': [(X, -14)], 'jaw': [(X, -34)], 'feet': {'ikF.L': (0, 0.04)}, **tails_fan(2, 4, 36)}),
                 (13, {'hipsL': (0, 0, 0.015), 'hips': [(X, -8)], 'neck': [(X, -30)], 'head': [(X, -10)], 'jaw': [(X, -26)], **tails_fan(3, 8, 30)}),
                 (16, tails_fan(4, 6, 8))]:
        A.frame(f, p)

B.export(low, r, os.path.join(OUT, f'{SP}.glb'))
