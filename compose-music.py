"""Render three original instrumental scores; no external samples or services."""
import json
import wave
from pathlib import Path
import numpy as np

ROOT=Path(__file__).resolve().parent
OUT=ROOT/'audio/music'
OUT.mkdir(parents=True,exist_ok=True)
SR=24000
SCORES=[
    ('morning-light','晨光',72,[50,55,47,57,50,54,55,57],[0,2,4,7,9,7,4,2],False),
    ('rain-window','雨窗',64,[45,53,48,55,45,50,53,52],[0,3,7,10,7,5,3,0],True),
    ('quiet-watch','静夜守望',60,[52,48,55,50,52,57,48,50],[0,2,7,10,7,2,0,-2],True),
]
manifest=[]
for ident,title,bpm,roots,motif,minor in SCORES:
    beat=60/bpm; bar=4*beat; duration=32*bar+4
    mix=np.zeros((int(duration*SR),2),dtype=np.float64)
    def note(midi,start,length,amp,pan=0,pad=False):
        i=int(start*SR);n=min(int(length*SR),len(mix)-i)
        if n<=0:return
        t=np.arange(n)/SR;f=440*2**((midi-69)/12)
        if pad:
            signal=(np.sin(2*np.pi*f*t)+.3*np.sin(2*np.pi*f*1.002*t)+.12*np.sin(2*np.pi*f*2*t))
            env=(1-np.exp(-t/.45))*np.minimum(1,np.maximum(0,(length-t)/.7))
        else:
            signal=(np.sin(2*np.pi*f*t)+.25*np.sin(2*np.pi*2*f*t)*np.exp(-t*2)+.08*np.sin(2*np.pi*3*f*t)*np.exp(-t*4))
            env=(1-np.exp(-t/.012))*np.exp(-t/(1.1 if ident=='rain-window' else 1.6))*np.minimum(1,np.maximum(0,(length-t)/.13))
        signal*=amp*env
        mix[i:i+n,0]+=signal*np.sqrt((1-pan)/2);mix[i:i+n,1]+=signal*np.sqrt((1+pan)/2)
    for b in range(32):
        root=roots[b%8];section=b//8;start=b*bar
        third=([4,4,3,4,4,3,4,4] if ident=='morning-light' else [3,4,4,4,3,3,4,3] if ident=='rain-window' else [3,4,4,4,3,3,4,4])[b%8]
        for j,interval in enumerate([0,third,7,14]):note(root+12+interval,start,bar+.65,.018,(-.45+j*.3),True)
        note(root-12,start,bar*.8,.045,0)
        for k in range(8):
            interval=[0,7,12,third+12,7,14,12,7][k]
            note(root+interval,start+k*.5*beat,beat*1.6,.038 if section!=2 else .029,(-1 if k%2 else 1)*.3)
        for k in range(4):
            if (b+k)%7==5:continue
            degree=motif[(b*2+k+(2 if section==2 else 0))%len(motif)]
            anchor=62 if ident=='morning-light' else 69 if ident=='rain-window' else 64
            note(anchor+degree+(12 if section==3 and k==3 else 0),start+k*beat+(.06 if k%2 else 0),beat*(1.8 if k==3 else 1.3),.065 if section in (1,3) else .05,.12)
    # Short stereo room reflections, no feedback or playback-time synthesis.
    dry=mix.copy()
    for seconds,amount in [(.097,.11),(.193,.075),(.317,.05),(.521,.035)]:
        d=int(seconds*SR);mix[d:]+=dry[:-d,::-1]*amount
    t=np.arange(len(mix))/SR
    mix*=np.minimum(1,t/2)[:,None]*np.minimum(1,np.maximum(0,(duration-t)/4))[:,None]
    mix-=mix.mean(axis=0);peak=float(np.max(np.abs(mix)));mix*=.65/max(peak,1e-9)
    pcm=np.round(np.clip(mix,-1,1)*32767).astype('<i2')
    path=OUT/(ident+'.wav')
    with wave.open(str(path),'wb') as w:w.setnchannels(2);w.setsampwidth(2);w.setframerate(SR);w.writeframes(pcm.tobytes())
    manifest.append({'id':ident,'title':title,'file':path.relative_to(ROOT).as_posix(),'seconds':round(duration,3),'bpm':bpm,'channels':2,'sampleRate':SR,'peak':.65})
(OUT/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(manifest,ensure_ascii=False))

# Encode the WAV master to the MP3 the game loads.
import subprocess,sys
subprocess.run([sys.executable,str(ROOT/'encode-music.py')],check=True)
