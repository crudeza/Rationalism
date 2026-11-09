#!/usr/bin/env python3
"""Reachability validator. usage: validate_cuemap.py cuemap.json [--tier easy|normal|elite]
Pairs of consecutive ring cues (pulses need no movement). Required speed = distance/gap must be <= BASE_SPEED*MARGIN."""
import sys, json, math
BASE_SPEED=1.6   # normalised corridor units/s the baseline ship can move [TUNE]
MARGIN=0.6       # safety factor
LEVEL={'easy':{'easy'},'normal':{'easy','normal'},'elite':{'easy','normal','elite'}}
def check(cm,tier):
    cues=[c for c in cm['cues'] if c.get('tier','easy') in LEVEL[tier]]
    errs=[];worst=0;prev=None
    for c in cues:
        pos=(c['x'],c['y']) if c['type']=='ring' else None
        if c['t']<cm['startMark']: errs.append(('before-mark',c['t']))
        if pos:
            if not(-1<=pos[0]<=1 and -1<=pos[1]<=1): errs.append(('out-of-corridor',c['t']))
            if prev:
                gap=c['t']-prev[0]; d=math.dist(pos,prev[1]); need=d/max(gap,1e-6); worst=max(worst,need/BASE_SPEED)
                if need>BASE_SPEED*MARGIN: errs.append(('unreachable',round(c['t'],3),round(need,2)))
            prev=(c['t'],pos)
    ph={p['id'] for p in cm['phrases']}
    for c in cues:
        if c['phrase'] not in ph: errs.append(('bad-phrase',c['t']))
    return len(cues),round(worst,3),errs
if __name__=='__main__':
    cm=json.load(open(sys.argv[1])); ok=True
    for tier in('easy','normal','elite'):
        n,w,e=check(cm,tier); ok&=not e
        print(f"{tier:6} cues={n:4d} worst speed ratio={w} errors={len(e)} {e[:3]}")
    print('PASS' if ok else 'FAIL'); sys.exit(0 if ok else 1)
