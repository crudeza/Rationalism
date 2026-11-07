#!/usr/bin/env python3
"""Cue map v1 builder. usage: build_cuemap.py analysis.json master.wav world-id title startMark out.json
Detects onsets, picks downbeats/kicks from the beat grid, lays out cue positions with a seeded smooth path."""
import sys, json, math, random, numpy as np
sys.path.insert(0,__file__.rsplit('/',1)[0]); import analyze as A
from scipy.signal import find_peaks
GRID_BIAS=0.0  # seconds; set from drift check if hits feel early/late
def main(ana,wav,world,title,mark,out):
    r=json.load(open(ana)); x=A.load(wav); dur=len(x)/A.SR; fps=A.SR/A.H
    bpm=r['bpm']; per=60/bpm; bar=4*per
    # downbeat grid: bar starts at barStart0 + k*bar
    m=A.stft_mag(x); kick=A.norm(A.flux(A.band(m,30,140))); full=A.norm(A.flux(m))
    mark=float(mark)
    # snap mark to nearest bar line
    k0=round((mark-r['barStart0'])/bar); mark=r['barStart0']+k0*bar
    bars=np.arange(mark,dur-bar,bar)
    # phrases: 4 bars each (last one extended to the end)
    ph=[]; 
    for i in range(0,len(bars),4):
        t0=float(bars[i]); t1=float(bars[i+4]) if i+4<len(bars) else float(dur)
        ph.append(dict(id=len(ph),t0=round(t0,3),t1=round(t1,3)))
    def phase_of(t):
        for p in ph:
            if p['t0']<=t<p['t1']: return p['id']
        return ph[-1]['id']
    # silences: sustained low energy inside the level (smoothed 0.5 s RMS)
    w=int(0.5*A.SR); nw=len(x)//w; e=20*np.log10(np.sqrt((x[:nw*w].reshape(nw,w)**2).mean(1))+1e-9)
    main=np.percentile(e[int(mark/0.5):],70); low=e<main-7; sil=[];s=None
    for i,v in enumerate(list(low)+[False]):
        if v and s is None:s=i
        if not v and s is not None:
            t0,t1=s*.5,i*.5
            if t1-t0>=1.5 and t0>=mark: sil.append((t0,min(t1,dur)))
            s=None
    # snap silence starts/ends to nearest beat
    snap=lambda t: r['beatOffset']+round((t-r['beatOffset'])/per)*per
    sil=[(round(snap(a),3),round(snap(b),3)) for a,b in sil]
    def in_sil(t): return any(a-0.2<=t<=b+0.2 for a,b in sil)
    # candidate times
    down=[float(t) for t in bars if not in_sil(t)]
    beats=np.arange(r['beatOffset'],dur,per)
    kp,_=find_peaks(kick,height=0.45,distance=int(0.2*fps)); kt=(kp/fps)
    # snap kick onsets to the beat grid (16th resolution), keep those within 35 ms
    sixteenth=per/4; kicks=[]
    for t in kt:
        if t<mark or in_sil(t): continue
        g=r['beatOffset']+round((t-r['beatOffset'])/sixteenth)*sixteenth
        if abs(g-t)<0.045 and (round((g-r['beatOffset'])/per*4)%4==0): kicks.append(float(g))
    op,_=find_peaks(full,height=0.55,distance=int(0.12*fps)); on=[float(t) for t in op/fps if t>=mark and not in_sil(t)]
    on=[r['beatOffset']+round((t-r['beatOffset'])/sixteenth)*sixteenth for t in on]
    tiers={'easy':down,'normal':sorted(set(round(t,3) for t in down+kicks)),'elite':sorted(set(round(t,3) for t in down+kicks+on))}
    # layout: "normal" tier is the stored cue list (easy/elite are filters via tag); tag each cue with tier
    allt={}
    for name in ('easy','normal','elite'):
        for t in tiers[name]: allt.setdefault(round(t,3),name)
    # merge near-duplicates (<20 ms apart): keep the one from the more basic tier (easy > normal > elite)
    rank={'easy':0,'normal':1,'elite':2}; merged=[]
    for t in sorted(allt):
        if merged and t-merged[-1]<0.02:
            if rank[allt[t]]<rank[allt[merged[-1]]]: del allt[merged[-1]]; merged[-1]=t
            else: del allt[t]
        else: merged.append(t)
    times=merged
    rng=random.Random(world); x_,y_=0.0,0.0; ang=0.0; cues=[]; last=None
    for t in times:
        gap=(t-last) if last is not None else 2.0
        # max travel limited by baseline speed (units/s in normalised space) with margin
        vmax=1.6*0.6; reach=min(1.0,vmax*gap)
        ang+=rng.uniform(-1.3,1.3); L=reach*rng.uniform(.3,.85)  # step length <= 85% of the reachable distance
        dx=math.cos(ang)*L; dy=math.sin(ang)*L*0.7
        nx=max(-0.9,min(0.9,x_+dx)); ny=max(-0.8,min(0.8,y_+dy))
        if nx!=x_+dx: ang=math.pi-ang   # bounce off the corridor edge
        if ny!=y_+dy: ang=-ang
        x_,y_=nx,ny; last=t
        tier=allt[t]; pid=phase_of(t)
        is_down=any(abs(t-b)<0.002 for b in bars)
        typ='pulse' if (not is_down and tier!='easy' and rng.random()<0.25) else 'ring'
        c=dict(t=round(t,3),type=typ,phrase=pid,tier=tier)
        if typ=='ring': c.update(x=round(x_,3),y=round(y_,3))
        cues.append(c)
    cm=dict(schema=1,world=world,title=title,artist="Martin Bellomo",duration=round(dur,3),bpm=bpm,beatOffset=r['beatOffset'],
        beatsPerBar=4,startMark=round(mark,3),leadInBars=4,phrases=ph,cues=cues,
        silences=[dict(t0=a,t1=b) for a,b in sil],difficulty=dict(easy="downbeats",normal="kick",elite="onsets"))
    json.dump(cm,open(out,'w'),indent=1)
    cnt={t:sum(1 for c in cues if c['tier']==t) for t in('easy','normal','elite')}
    print(world,'mark',cm['startMark'],'musicStart',round(mark-4*4*per,3),'phrases',len(ph),'silences',cm['silences'],'cues by first-tier',cnt)
if __name__=='__main__': main(*sys.argv[1:7])
