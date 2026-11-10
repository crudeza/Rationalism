#!/usr/bin/env python3
"""RESONANCE musical cue layout (replaces the random-walk x of build_cuemap.py). Schema v1 unchanged.
usage: relayout_cues.py in.json out.json [--human 0.6]

Idea: the ring path is ONE continuous curve x(t) driven by the song's own structure, and each ring just samples it.
- One anchor per bar line. Four anchors make a phrase motif: sweep, answer, zigzag, resolve (call and response).
- Lane amplitude follows how busy each phrase is (cue density, smoothed): quiet phrases stay near the centre,
  drops use the whole road.
- A small beat bounce adds rhythm without adding speed.
- Because every ring samples the same bounded-slope curve, ANY subset of rings (easy / normal / elite) is
  reachable by construction. Speed is checked against a human limit (default 0.6 u/s), stricter than the 0.96
  of validate_cuemap.py.
Only x of rings changes. Types, tiers, times, phrases and silences are untouched."""
import sys, json, math
import numpy as np

W = {'easy': 1.0, 'normal': 1.0, 'elite': 0.5}   # density weight per tier
LIM = 0.88                                        # lane limit (cues were -0.9..0.9)
BOUNCE = 0.02                                     # beat bounce amplitude [TUNE]
PATTERNS = [                                      # 4 anchors per phrase, in units of amplitude
    lambda s: [-0.9 * s, -0.3 * s, 0.3 * s, 0.9 * s],    # sweep
    lambda s: [0.9 * s, 0.5 * s, -0.2 * s, -0.7 * s],    # answer
    lambda s: [0.55 * s, -0.55 * s, 0.55 * s, -0.55 * s],  # zigzag
    lambda s: [-0.4 * s, 0.25 * s, -0.1 * s, 0.0],       # resolve
]

def layout(cm, human=0.6):
    bar = cm['beatsPerBar'] * 60 / cm['bpm']; per = 60 / cm['bpm']; mark = cm['startMark']
    ph = cm['phrases']; n = len(ph)
    dens = np.zeros(n)
    for c in cm['cues']:
        dens[c['phrase']] += W.get(c.get('tier', 'easy'), 1.0)
    dens /= np.array([max(p['t1'] - p['t0'], 1e-6) for p in ph])
    hi = np.percentile(dens[dens > 0], 90) if (dens > 0).any() else 1.0
    d = np.clip(dens / hi, 0, 1)
    d = np.convolve(np.pad(d, 1, mode='edge'), [0.25, 0.5, 0.25], mode='valid')   # smooth between phrases
    amp = 0.30 + 0.55 * d
    # anchors: one per bar, 4 per phrase
    anchors = []
    for i in range(n):
        side = 1 if (i // 4) % 2 == 0 else -1
        anchors += [max(-LIM, min(LIM, amp[i] * v)) for v in PATTERNS[i % 4](side)]
    dmax = 0.5   # biggest anchor-to-anchor step (per bar): keeps the curve slow enough for people
    for k in range(1, len(anchors)):
        step = anchors[k] - anchors[k - 1]
        if abs(step) > dmax: anchors[k] = anchors[k - 1] + math.copysign(dmax, step)
    def x_at(t):
        u = (t - mark) / bar; k = int(math.floor(u)); f = u - k
        k = max(0, min(k, len(anchors) - 1)); k2 = min(k + 1, len(anchors) - 1)
        e = (1 - math.cos(math.pi * f)) / 2
        x = anchors[k] + (anchors[k2] - anchors[k]) * e
        x += BOUNCE * math.sin(2 * math.pi * (t - mark) / (2 * per))
        return max(-LIM, min(LIM, x))
    for c in cm['cues']:
        if c['type'] == 'ring': c['x'] = round(x_at(c['t']), 3)
    return amp

LEVEL = {'easy': {'easy'}, 'normal': {'easy', 'normal'}, 'elite': {'easy', 'normal', 'elite'}}
def speeds(cm, tier):
    prev = None; worst = 0.0; worst_t = 0; big = 0.0
    for c in cm['cues']:
        if c.get('tier', 'easy') not in LEVEL[tier] or c['type'] != 'ring': continue
        if prev:
            gap = max(c['t'] - prev['t'], 1e-6); dx = abs(c['x'] - prev['x'])
            if dx / gap > worst: worst, worst_t = dx / gap, c['t']
            big = max(big, dx)
        prev = c
    return worst, worst_t, big

if __name__ == '__main__':
    src, dst = sys.argv[1], sys.argv[2]
    human = float(sys.argv[sys.argv.index('--human') + 1]) if '--human' in sys.argv else 0.6
    cm = json.load(open(src)); amp = layout(cm, human)
    json.dump(cm, open(dst, 'w'), indent=1)
    xs = [c['x'] for c in cm['cues'] if c['type'] == 'ring']
    print(f"{cm['world']}: rings={len(xs)} x range {min(xs):+.2f}..{max(xs):+.2f} amp {amp.min():.2f}..{amp.max():.2f}")
    ok = True
    for tier in ('easy', 'normal', 'elite'):
        w, wt, big = speeds(cm, tier); ok &= w <= human
        print(f"  {tier:6} worst speed {w:.3f} u/s at t={wt:.2f}  biggest single jump {big:.3f}  {'ok' if w <= human else 'OVER human limit ' + str(human)}")
    sys.exit(0 if ok else 1)
