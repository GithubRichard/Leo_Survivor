/* Local English male narration plus procedural effects; no network playback. */
(() => {
  'use strict';let context=null,master=null,rain=null,staticNoise=null,noiseBuffer=null,active=false,current=null;
  let enabled=true;try{enabled=localStorage.getItem('survivor-audio-enabled')!=='false';}catch{}
  const voices=new Map(),V=Survival.BroadcastVoice;
  for(const [id,line] of Object.entries(V)){const a=new Audio(`audio/broadcast/${line.file}?v=0.12.2`);a.preload='auto';a.volume=.85;voices.set(id,a);}
  function noise(){if(noiseBuffer)return noiseBuffer;noiseBuffer=context.createBuffer(1,context.sampleRate*2,context.sampleRate);const d=noiseBuffer.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;return noiseBuffer;}
  function loop(type,frequency){const source=context.createBufferSource(),filter=context.createBiquadFilter(),gain=context.createGain();source.buffer=noise();source.loop=true;filter.type=type;filter.frequency.value=frequency;gain.gain.value=0;source.connect(filter).connect(gain).connect(master);source.start();return gain;}
  function unlock(){
    try{if(!context){context=new (window.AudioContext||window.webkitAudioContext)();master=context.createGain();master.connect(context.destination);rain=loop('lowpass',4200);staticNoise=loop('bandpass',2100);}if(context.state==='suspended')context.resume().catch(()=>{});master.gain.value=enabled&&active&&!document.hidden&&document.hasFocus()?1:0;}catch{}
    if(active&&current&&current.paused&&!current.ended)current.play().catch(()=>{});
  }
  function setActive(next){if(master)master.gain.value=enabled&&next&&!document.hidden&&document.hasFocus()?1:0;if(active===next)return;active=next;if(!active){current?.pause();ambience(0,0);}else if(current&&!current.ended)current.play().catch(()=>{});}
  function stopVoice(){if(current){current.pause();current.currentTime=0;}current=null;}
  function playVoice(id){stopVoice();current=voices.get(id)||null;if(!current)return;current.muted=!enabled;current.currentTime=0;if(active)current.play().catch(()=>{});}
  function voiceTime(id){return current===voices.get(id)?current.currentTime:0;}
  function burst(duration,volume,frequency,delay=0){
    if(!context||!active||!enabled)return;const at=context.currentTime+delay,s=context.createBufferSource(),f=context.createBiquadFilter(),g=context.createGain();s.buffer=noise();f.type='lowpass';f.frequency.value=frequency;g.gain.setValueAtTime(Math.max(.0001,volume),at);g.gain.exponentialRampToValueAtTime(.0001,at+duration);s.connect(f).connect(g).connect(master);s.start(at);s.stop(at+duration+.01);s.onended=()=>{s.disconnect();f.disconnect();g.disconnect();};
  }
  function tone(frequency,duration,volume,type='sine',delay=0){if(!context||!active||!enabled)return;const at=context.currentTime+delay,o=context.createOscillator(),g=context.createGain();o.type=type;o.frequency.setValueAtTime(frequency,at);o.frequency.exponentialRampToValueAtTime(Math.max(25,frequency*.55),at+duration);g.gain.setValueAtTime(volume,at);g.gain.exponentialRampToValueAtTime(.0001,at+duration);o.connect(g).connect(master);o.start(at);o.stop(at+duration+.01);o.onended=()=>{o.disconnect();g.disconnect();};}
  function openContainer(){burst(.12,.14,2200);tone(380,.1,.055,'triangle');burst(.3,.045,700,.07);tone(125,.2,.035,'triangle',.1);}
  function ambience(rainAmount,noiseAmount){if(!context)return;rain.gain.setTargetAtTime(active?Math.max(0,rainAmount):0,context.currentTime,.25);staticNoise.gain.setTargetAtTime(active?Math.max(0,noiseAmount):0,context.currentTime,.08);}
  const lastEffect=new Map();
  function effect(kind,volume=1){
    if(!context||!active||!enabled)return;const now=context.currentTime,interval=kind==='gun'?.055:kind==='impact'?.09:kind==='door'?.18:.12;if(now-(lastEffect.get(kind)??-10)<interval)return;lastEffect.set(kind,now);
    const v=Math.max(0,Math.min(1,volume));
    if(kind==='gun'){burst(.09,.15*v,3000);tone(110,.1,.055*v,'triangle');}
    else if(kind==='rocket'){burst(.28,.1*v,800);tone(95,.22,.055*v,'sawtooth');}
    else if(kind==='explosion'||kind==='ignite'){burst(kind==='explosion'?.7:.4,.16*v,650);tone(70,.4,.06*v,'sine');}
    else if(kind==='hurt'){tone(150,.15,.06*v,'triangle');burst(.07,.045*v,650);}
    else if(kind==='swing'||kind==='throw'||kind==='bow'){burst(.16,.045*v,kind==='bow'?3000:1400);if(kind==='bow')tone(460,.1,.025*v,'triangle');}
    else if(kind==='impact'){burst(.065,.065*v,1600);tone(180,.07,.025*v,'triangle');}
    else if(kind==='door'){burst(.16,.05*v,900);tone(180,.1,.025*v,'triangle');}
    else if(kind==='craft'||kind==='build'||kind==='repair'){tone(440,.13,.035*v,'sine');tone(660,.2,.035*v,'sine',.12);burst(.08,.03*v,1800);}
    else if(kind==='dismantle'){burst(.16,.075*v,2000);tone(180,.13,.025*v,'triangle');}
    else if(kind==='aed'){tone(660,.22,.045*v,'sine');tone(880,.3,.045*v,'sine',.16);}
    else if(kind==='heal'){tone(420,.16,.025*v,'sine');tone(620,.2,.025*v,'sine',.12);}
    else if(kind==='pickup'){tone(700,.1,.025*v,'triangle');tone(930,.13,.025*v,'sine',.08);}
  }
  function toggle(){enabled=!enabled;try{localStorage.setItem('survivor-audio-enabled',String(enabled));}catch{}if(current)current.muted=!enabled;unlock();syncButton();}
  function syncButton(){const b=document.getElementById('sound-toggle');if(b){b.textContent=enabled?'音效/配音：开':'音效/配音：关';b.setAttribute('aria-pressed',String(enabled));}}
  document.getElementById('sound-toggle').addEventListener('click',toggle);syncButton();
  addEventListener('pointerdown',unlock,{passive:true});addEventListener('keydown',unlock,{passive:true});
  addEventListener('blur',()=>setActive(false));document.addEventListener('visibilitychange',()=>{if(document.hidden)setActive(false);});
  window.GameSound={unlock,setActive,playVoice,stopVoice,voiceTime,openContainer,ambience,burst,tone,effect,get enabled(){return enabled;}};
})();
