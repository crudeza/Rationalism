#!/usr/bin/env python3
"""Cut each master into 60 s MP3 chunks starting at musicStart. usage: encode_audio.py masters_dir"""
import json,subprocess,sys,os
M={'cry-me-a-reverb':'Cry_me_a_Reverb_-_MASTER.wav','nueva-anormalidad':'Nueva_Anormalidad-_MASTER.wav','ganimedes':'Ganimedes_MASTER-16441.wav'}
CH=60
d=sys.argv[1]; root=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
man={}
for w,f in M.items():
    cm=json.load(open(f'{root}/cuemaps/{w}.json')); ms=cm['startMark']-cm['leadInBars']*cm['beatsPerBar']*60/cm['bpm']
    n=int((cm['duration']-ms)//CH)+1; man[w]={'musicStart':round(ms,4),'chunk':CH,'n':n}
    for i in range(n):
        subprocess.run(['ffmpeg','-y','-v','error','-ss',str(ms+i*CH),'-t',str(CH),'-i',f'{d}/{f}','-ac','2','-ar','44100','-c:a','libmp3lame','-b:a','128k',f'{root}/audio/{w}_{i}.mp3'],check=True)
json.dump(man,open(f'{root}/audio/manifest.json','w'),indent=1); print(man)
