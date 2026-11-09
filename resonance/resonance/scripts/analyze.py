#!/usr/bin/env python3
"""RESONANCE W1 analysis: BPM, beat grid, sections, silences. numpy/scipy + ffmpeg only.
usage: analyze.py master.wav out.json"""
import sys, json, subprocess, numpy as np
from scipy.signal import find_peaks, medfilt
SR=22050; N=2048; H=256

def load(path):
    raw=subprocess.run(['ffmpeg','-v','error','-i',path,'-ac','1','-ar',str(SR),'-f','f32le','-'],capture_output=True,check=True).stdout
    return np.frombuffer(raw,dtype=np.float32)

def stft_mag(x):
    w=np.hanning(N); n=1+(len(x)-N)//H
    idx=np.arange(N)[None,:]+H*np.arange(n)[:,None]
    return np.abs(np.fft.rfft(x[idx]*w,axis=1))

def band(mag,lo,hi):
    f=np.fft.rfftfreq(N,1/SR); return mag[:,(f>=lo)&(f<hi)]

def flux(m):
    l=np.log1p(m*20); d=np.diff(l,axis=0,prepend=l[:1]); return np.maximum(d,0).sum(1)

def norm(e):
    e=e-medfilt(e,31) if len(e)>31 else e; e=np.maximum(e,0); return e/(np.percentile(e,99)+1e-9)

def tempo(kick,fps):
    # score each bpm by mean env sampled on a comb of beats, best offset; coarse then fine
    T=len(kick)/fps
    def score(b,ofs_n=40):
        per=60/b; best=(-1,0)
        for o in np.linspace(0,per,ofs_n,endpoint=False):
            t=np.arange(o,T,per); i=np.clip((t*fps).astype(int),0,len(kick)-1)
            s=np.maximum.reduce([kick[np.clip(i+k,0,len(kick)-1)] for k in(-1,0,1)]).mean()
            if s>best[0]: best=(s,o)
        return best
    cs=[(score(b)[0],b) for b in np.arange(90,181,0.5)]
    b0=max(cs)[1]
    fine=[(score(b,80)[0],b) for b in np.arange(b0-1,b0+1,0.01)]
    sc,b=max(fine); _,o=score(b,200)
    # octave sanity: prefer 120-150 if half/double scores close
    return float(round(b,2)),float(o),cs

def main(path,out):
    x=load(path); dur=len(x)/SR; fps=SR/H
    m=stft_mag(x)
    full=norm(flux(m)); kick=norm(flux(band(m,30,140)))
    bpm,off,cs=tempo(kick,fps)
    per=60/bpm; bar=4*per
    # downbeat phase: which of 4 beats has most low-end energy+kick
    lowe=band(m,30,140).sum(1)
    beats=np.arange(off,dur,per)
    bi=np.clip((beats*fps).astype(int),0,len(lowe)-1)
    ph=[kick[bi[k::4]].mean() for k in range(4)]
    dphase=int(np.argmax(ph))
    # bar-synchronous features
    bar0=off+dphase*per
    bar_t=np.arange(bar0-int(bar0//bar)*bar,dur-bar,bar)
    f=np.fft.rfftfreq(N,1/SR); edges=np.geomspace(40,9000,25)
    feats=[]
    for t in bar_t:
        a=int(t*fps); b=int((t+bar)*fps); seg=m[a:b]
        feats.append([np.log1p(seg[:,(f>=edges[k])&(f<edges[k+1])].mean()*50) for k in range(24)])
    F=np.array(feats); F=(F-F.mean(0))/(F.std(0)+1e-6)
    # novelty via checkerboard kernel (4 bars each side)
    K=4; nov=np.zeros(len(F))
    for i in range(K,len(F)-K):
        a=F[i-K:i].mean(0); b=F[i:i+K].mean(0); nov[i]=np.linalg.norm(a-b)
    pk,_=find_peaks(nov,height=np.percentile(nov,75),distance=4)
    # silences: short-window RMS
    win=int(0.05*SR); nw=len(x)//win
    rms=np.sqrt((x[:nw*win].reshape(nw,win)**2).mean(1)+1e-12); db=20*np.log10(rms)
    ref=np.percentile(db,90)
    def runs(mask,minlen):
        r=[];s=None
        for i,v in enumerate(mask):
            if v and s is None:s=i
            if (not v) and s is not None:
                if (i-s)*0.05>=minlen:r.append((s*0.05,i*0.05))
                s=None
        if s is not None and (nw-s)*0.05>=minlen:r.append((s*0.05,nw*0.05))
        return r
    quiet=runs(db<ref-30,1.0)
    # breakdown = kick absent (low band weak) for >=1.5 s, per beat
    kb=np.array([kick[min(int(t*fps),len(kick)-1)] for t in beats]); lowd=np.array([lowe[min(int(t*fps),len(lowe)-1)] for t in beats])
    nokick=runs(np.repeat(lowd<np.percentile(lowd,30)*0.5,int(per/0.05)+1)[:nw] if False else (np.interp(np.arange(nw)*0.05,beats,lowd)<np.percentile(lowd,90)*0.12),1.5)
    # energy per bar (dB) for the report
    barE=[float(20*np.log10(np.sqrt((x[int(t*SR):int((t+bar)*SR)]**2).mean()+1e-12))) for t in bar_t]
    res=dict(file=path,duration=round(dur,3),bpm=bpm,beatOffset=round(off,4),downbeatPhase=dphase,
      barStart0=round(float(bar_t[0]),3),barSec=round(bar,4),
      sectionBars=[int(i) for i in pk],sectionTimes=[round(float(bar_t[i]),2) for i in pk],
      noveltyAt=[round(float(nov[i]),2) for i in pk],
      nearSilence=[[round(a,2),round(b,2)] for a,b in quiet],
      lowEnergy=[[round(a,2),round(b,2)] for a,b in nokick],
      barEnergyDb=[round(v,1) for v in barE],
      tempoTop=[(round(s,3),b) for s,b in sorted(cs,reverse=True)[:5]],
      peakDb=round(float(20*np.log10(np.abs(x).max()+1e-9)),2),rmsRefDb=round(float(ref),1))
    json.dump(res,open(out,'w'),indent=1)
    print(json.dumps({k:v for k,v in res.items() if k!='barEnergyDb'},indent=1))
if __name__=='__main__': main(sys.argv[1],sys.argv[2])
