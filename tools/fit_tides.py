"""Fits the tide station constants used in src/core.js (TIDE_STATIONS).

Each station's published high/low predictions (tools/tides/*.csv, times in Maldives time,
heights in feet) are fitted with five harmonic groups: M2, S2(+K2), N2, K1(+P1), O1(+Q1).
The fit matches both the heights at each high/low and a zero rate of change there.
Run: python3 tools/fit_tides.py   (needs numpy)
"""
import os, math, json, datetime as dt
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
D2R, FT = math.pi / 180, 0.3048
SPEED = {'M2': 28.9841042, 'S2': 30.0, 'N2': 28.4397295, 'K2': 30.0821373, 'K1': 15.0410686, 'O1': 13.9430356, 'P1': 14.9589314, 'Q1': 13.3986609}
GROUPS = {'M2': [('M2', 1)], 'S2': [('S2', 1), ('K2', 0.272)], 'N2': [('N2', 1)], 'K1': [('K1', 1), ('P1', 0.331)], 'O1': [('O1', 1), ('Q1', 0.194)]}
STATIONS = {
    'Dhidhdhoo': (6.8875, 73.1139, ['dhidhdhoo.csv', 'dhidhdhoo_jun.csv']),
    'Naifaru': (5.4444, 73.3658, ['naifaru.csv', 'naifaru_jun.csv']),
    'Malé': (4.1755, 73.5093, ['male.csv', 'extra/st_male_jan2027.csv', 'extra/st_male_mar2027.csv', 'extra/st_male_apr2027.csv', 'extra/st_male_jun2027.csv']),
    'Gan': (-0.6930, 73.1556, ['gan.csv', 'gan_jun.csv']),
}

def args(t):
    T_ = ((t - dt.datetime(2000, 1, 1, 12)).total_seconds() / 86400) / 36525
    s, h, p, N = 218.3165 + 481267.8813 * T_, 280.4661 + 36000.7698 * T_, 83.3535 + 4069.0137 * T_, (125.0445 - 1934.1363 * T_) * D2R
    T = 180 + 15 * (t.hour + t.minute / 60 + t.second / 3600)
    c, sn = math.cos, math.sin
    fM2, uM2 = 1.0004 - 0.0373 * c(N) + 0.0002 * c(2 * N), -2.14 * sn(N)
    fK1, uK1 = 1.0060 + 0.1150 * c(N) - 0.0088 * c(2 * N) + 0.0006 * c(3 * N), -8.86 * sn(N) + 0.68 * sn(2 * N) - 0.07 * sn(3 * N)
    fO1, uO1 = 1.0089 + 0.1871 * c(N) - 0.0147 * c(2 * N) + 0.0014 * c(3 * N), 10.80 * sn(N) - 1.34 * sn(2 * N) + 0.19 * sn(3 * N)
    fK2, uK2 = 1.0241 + 0.2863 * c(N) + 0.0083 * c(2 * N) - 0.0015 * c(3 * N), -17.74 * sn(N) + 0.68 * sn(2 * N) - 0.04 * sn(3 * N)
    return {'M2': (2 * T - 2 * s + 2 * h, fM2, uM2), 'S2': (2 * T, 1, 0), 'N2': (2 * T - 3 * s + 2 * h + p, fM2, uM2), 'K2': (2 * T + 2 * h, fK2, uK2),
            'K1': (T + h - 90, fK1, uK1), 'O1': (T - 2 * s + h + 90, fO1, uO1), 'P1': (T - h + 90, 1, 0), 'Q1': (T - 3 * s + h + p + 90, fO1, uO1)}

def basis(t):
    V, row, drow = args(t), [1.0], [0.0]
    for g in GROUPS:
        c = s_ = dc = ds = 0
        for name, r in GROUPS[g]:
            th, f, u = V[name]; th = (th + u) * D2R; w = SPEED[name] * D2R
            c += r * f * math.cos(th); s_ += r * f * math.sin(th); dc -= r * f * w * math.sin(th); ds += r * f * w * math.cos(th)
        row += [c, s_]; drow += [dc, ds]
    return row, drow

def load(path):
    out = []
    for line in open(path):
        if line.strip():
            d, tm, typ, hgt = line.strip().split(',')
            out.append((dt.datetime.fromisoformat(d + 'T' + tm) - dt.timedelta(hours=5), typ, float(hgt) * FT))
    return out

def fit(obs, wd=3.0):
    A, b = [], []
    for t, _, hgt in obs:
        r, dr = basis(t); A.append(r); b.append(hgt); A.append([x * wd for x in dr]); b.append(0)
    x, *_ = np.linalg.lstsq(np.array(A), np.array(b), rcond=None)
    out = {'Z0': round(float(x[0]), 4)}
    for i, g in enumerate(GROUPS):
        a, bb = x[1 + 2 * i], x[2 + 2 * i]
        out[g] = [round(float(math.hypot(a, bb)), 4), round(float(math.degrees(math.atan2(bb, a)) % 360), 2)]
    return out

if __name__ == '__main__':
    res = {}
    for name, (lat, lon, files) in STATIONS.items():
        obs = sum([load(os.path.join(HERE, 'tides', f)) for f in files], [])
        res[name] = {'lat': lat, 'lon': lon, **fit(obs)}
        print(f'{name}: {len(obs)} highs and lows')
    print(json.dumps(res, ensure_ascii=False, indent=1))
