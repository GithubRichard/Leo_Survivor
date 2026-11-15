"""Original night siege score: pulse bass, ostinato strings, low percussion."""
import json
import wave
from pathlib import Path
import numpy as np
ROOT=Path(__file__).resolve().parent
OUT=ROOT/'audio/music'
SR=24000
BPM=112
beat=60/BPM
duration=64*4*beat+4
mix=np.zeros((int(duration*SR),2),dtype=np.float64)

def voice(midi,start,length,amp,pan=0,style='pluck'):
    at=int(start*SR);n=min(int(length*SR),len(mix)-at)
    if n<=0:return
    t=np.arange(n)/SR;f=440*2**((midi-69)/12)
    if style=='strings':
        signal=sum(np.sin(2*np.pi*f*k*t+0.002*np.sin(2*np.pi*.7*t))/k**1.5 for k in range(1,6))
        env=(1-np.exp(-t/.08))*np.minimum(1,np.maximum(0,(length-t)/.2))
    elif style=='bass':
        signal=np.sin(2*np.pi*f*t)+.24*np.sin(2*np.pi*f*2*t)
        env=(1-np.exp(-t/.009))*np.exp(-t/.18)*np.minimum(1,np.maximum(0,(length-t)/.03))
    else:
        signal=np.sin(2*np.pi*f*t)+.35*np.sin(2*np.pi*f*2*t)+.12*np.sin(2*np.pi*f*3*t)
        env=(1-np.exp(-t/.006))*np.exp(-t/.21)*np.minimum(1,np.maximum(0,(length-t)/.04))
    signal*=env*amp
    mix[at:at+n,0]+=signal*np.sqrt((1-pan)/2);mix[at:at+n,1]+=signal*np.sqrt((1+pan)/2)

def drum(start,kind,amp):
    at=int(start*SR);n=min(int(.48*SR),len(mix)-at);t=np.arange(n)/SR
    signal=np.sin(2*np.pi*(46*t+1.5*(1-np.exp(-t*24))))*np.exp(-t*13)
    signal*=amp*(1-np.exp(-t/.002));signal[-200:]*=np.linspace(1,0,200)
    mix[at:at+n]+=signal[:,None]*.707

roots=[40,40,36,38,40,43,36,35] # E minor, restrained semitone tension at cadences.
for b in range(64):
    start=b*4*beat;root=roots[b%8];section=b//16;energy=[.65,.9,.72,1][section]
    third=4 if root in [36,43,35] else 3
    for j,interval in enumerate([0,7,12,third+12]):voice(root+interval,start,4*beat+.2,.018*energy,-.45+j*.3,'strings')
    for k in range(8):
        voice(root-12,start+k*.5*beat,.42*beat,.09*energy,0,'bass')
        interval=[0,7,12,7,third+12,7,12,7][(k+(b%4)*2)%8]
        voice(root+12+interval,start+k*.5*beat,.65*beat,.052*energy,(-1 if k%2 else 1)*.4)
        if k in [0,4] or section==3 and k==6:drum(start+k*.5*beat,'low',.12*energy)
    if b%4 in [2,3]:
        for k,interval in enumerate([19,15,14,12]):voice(root+12+interval,start+k*beat,1.1*beat,.036*energy,.18,'strings')
dry=mix.copy()
for seconds,amp in [(.135,.09),(.27,.05),(.41,.03)]:
    d=int(seconds*SR);mix[d:]+=dry[:-d,::-1]*amp
t=np.arange(len(mix))/SR
mix-=mix.mean(axis=0)
mix*=np.minimum(1,t/1.2)[:,None]*np.minimum(1,np.maximum(0,(duration-t)/3))[:,None]
mix*=.65/max(float(np.abs(mix).max()),1e-9)
pcm=np.round(np.clip(mix,-1,1)*32767).astype('<i2')
path=OUT/'night-siege.wav'
with wave.open(str(path),'wb') as w:w.setnchannels(2);w.setsampwidth(2);w.setframerate(SR);w.writeframes(pcm.tobytes())
manifest=json.loads((OUT/'manifest.json').read_text(encoding='utf-8'))
manifest=[x for x in manifest if x['id']!='night-siege']+[{'id':'night-siege','title':'危夜围城','file':'audio/music/night-siege.wav','seconds':round(duration,3),'bpm':BPM,'channels':2,'sampleRate':SR,'peak':.65,'use':'night'}]
(OUT/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
print('Night score rendered:',round(duration,3),'seconds')

# Encode the WAV master to the MP3 the game loads.
import subprocess,sys
subprocess.run([sys.executable,str(ROOT/'encode-music.py')],check=True)
