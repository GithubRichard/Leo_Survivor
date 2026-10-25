/* Local English male narration plus procedural effects; no network playback. */
(() => {
  'use strict';let context=null,master=null,rain=null,staticNoise=null,noiseBuffer=null,active=false,current=null;
  let enabled=true;try{enabled=localStorage.getItem('survivor-audio-enabled')!=='false';}catch{}
  const voices=new Map(),V=Survival.BroadcastVoice;
  for(const [id,line] of Object.entries(V)){const a=new Audio(`audio/broadcast/${line.file}?v=0.12.2`);a.preload='auto';a.volume=.85;voices.set(id,a);}
  function noise(){if(noiseBuffer)return noiseBuffer;noiseBuffer=context.createBuffer(1,context.sampleRate*2,context.sampleRate);const d=noiseBuffer.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;return noiseBuffer;}
  function loop(type,frequency){const source=context.createBufferSource(),filter=context.createBiquadFilter(),gain=context.createGain();source.buffer=noise();source.loop=true;filter.type=type;filter.frequency.value=frequency;gain.gain.value=0;source.connect(filter).connect(gain).connect(master);source.start();return gain;}
  function unlock(){
    try{if(!context){context=new (window.AudioContext||window.webkitAudioContext)();master=context.createGain();master.connect(context.destination);rain=loop('lowpass',4200);staticNoise=loop('bandpass',2100);}if(context.state==='suspended')context.resume().catch(()=>{});master.gain.value=enabled&&!document.hidden&&document.hasFocus()?1:0;}catch{}
    if(active&&current&&current.paused&&!current.ended)current.play().catch(()=>{});
  }
  function setActive(next){if(master)master.gain.value=enabled&&!document.hidden&&document.hasFocus()?1:0;if(active===next)return;active=next;if(!active){current?.pause();ambience(0,0);}else if(current&&!current.ended)current.play().catch(()=>{});}
  function stopVoice(){if(current){current.pause();current.currentTime=0;}current=null;}
  function playVoice(id){stopVoice();current=voices.get(id)||null;if(!current)return;current.muted=!enabled;current.currentTime=0;if(active)current.play().catch(()=>{});}
  function voiceTime(id){return current===voices.get(id)?current.currentTime:0;}
  function burst(duration,volume,frequency,delay=0){
    if(!context||!active||!enabled)return;const at=context.currentTime+delay,s=context.createBufferSource(),f=context.createBiquadFilter(),g=context.createGain();s.buffer=noise();f.type='lowpass';f.frequency.value=frequency;g.gain.setValueAtTime(Math.max(.0001,volume),at);g.gain.exponentialRampToValueAtTime(.0001,at+duration);s.connect(f).connect(g).connect(master);s.start(at);s.stop(at+duration+.01);s.onended=()=>{s.disconnect();f.disconnect();g.disconnect();};
  }
  function tone(frequency,duration,volume,type='sine',delay=0){if(!context||!active||!enabled)return;const at=context.currentTime+delay,o=context.createOscillator(),g=context.createGain();o.type=type;o.frequency.setValueAtTime(frequency,at);o.frequency.exponentialRampToValueAtTime(Math.max(25,frequency*.55),at+duration);g.gain.setValueAtTime(volume,at);g.gain.exponentialRampToValueAtTime(.0001,at+duration);o.connect(g).connect(master);o.start(at);o.stop(at+duration+.01);o.onended=()=>{o.disconnect();g.disconnect();};}
  function openContainer(){burst(.12,.14,2200);tone(380,.1,.055,'triangle');burst(.3,.045,700,.07);tone(125,.2,.035,'triangle',.1);}
  function ambience(rainAmount,noiseAmount){if(!context)return;rain.gain.setTargetAtTime(active?Math.max(0,rainAmount):0,context.currentTime,.25);staticNoise.gain.setTargetAtTime(active?Math.max(0,noiseAmount):0,context.currentTime,.08);}
  function toggle(){enabled=!enabled;try{localStorage.setItem('survivor-audio-enabled',String(enabled));}catch{}if(current)current.muted=!enabled;unlock();syncButton();}
  function syncButton(){const b=document.getElementById('sound-toggle');if(b){b.textContent=enabled?'声音：开':'声音：关';b.setAttribute('aria-pressed',String(enabled));}}
  document.getElementById('sound-toggle').addEventListener('click',toggle);syncButton();
  addEventListener('pointerdown',unlock,{passive:true});addEventListener('keydown',unlock,{passive:true});
  addEventListener('blur',()=>setActive(false));document.addEventListener('visibilitychange',()=>{if(document.hidden)setActive(false);});
  window.GameSound={unlock,setActive,playVoice,stopVoice,voiceTime,openContainer,ambience,burst,tone,get enabled(){return enabled;}};
})();
