/* Pointer controls support simultaneous movement and held sprint. */
(() => {
  const root=document.documentElement,stick=document.getElementById('touch-stick'),knob=document.getElementById('stick-knob');
  const panel=document.getElementById('touch-controls'),run=document.getElementById('touch-run'),toggle=document.getElementById('touch-toggle');
  let enabled=matchMedia('(any-pointer:coarse)').matches||navigator.maxTouchPoints>0,context='menu',stickId=null,runIds=new Set();
  const input={moveX:0,moveY:0,run:false};
  function clear(){input.moveX=0;input.moveY=0;input.run=false;stickId=null;runIds.clear();knob.style.transform='translate(-50%,-50%)';stick.classList.remove('active');run.classList.remove('held');}
  function sync(){root.classList.toggle('touch-mode',enabled);toggle.setAttribute('aria-pressed',String(enabled));toggle.textContent=enabled?'触屏：已开启':'触屏操作';panel.classList.toggle('hidden',!enabled||context!=='play');}
  function setContext(next,placement){if(context!==next){context=next;clear();sync();}document.getElementById('touch-interact').textContent=placement?'切换装置':'交互';document.getElementById('touch-build').textContent=placement?'确认放置':'建造';}
  function move(e){if(e.pointerId!==stickId)return;e.preventDefault();const r=stick.getBoundingClientRect(),radius=r.width*.33;let x=e.clientX-r.left-r.width/2,y=e.clientY-r.top-r.height/2;const distance=Math.hypot(x,y),amount=Math.min(1,distance/radius);if(distance>radius){x*=radius/distance;y*=radius/distance;}const power=amount<.14?0:(amount-.14)/.86;input.moveX=distance?x/Math.max(1,Math.hypot(x,y))*power:0;input.moveY=distance?y/Math.max(1,Math.hypot(x,y))*power:0;knob.style.transform=`translate(calc(-50% + ${x}px),calc(-50% + ${y}px))`;}
  stick.addEventListener('pointerdown',e=>{if(!enabled||context!=='play'||stickId!==null)return;e.preventDefault();stickId=e.pointerId;stick.setPointerCapture(e.pointerId);stick.classList.add('active');move(e);});
  stick.addEventListener('pointermove',move);
  const releaseStick=e=>{if(e.pointerId!==stickId)return;input.moveX=0;input.moveY=0;stickId=null;knob.style.transform='translate(-50%,-50%)';stick.classList.remove('active');};
  for(const event of ['pointerup','pointercancel','lostpointercapture'])stick.addEventListener(event,releaseStick);
  run.addEventListener('pointerdown',e=>{if(context!=='play')return;e.preventDefault();runIds.add(e.pointerId);run.setPointerCapture(e.pointerId);input.run=true;run.classList.add('held');});
  const releaseRun=e=>{runIds.delete(e.pointerId);input.run=runIds.size>0;run.classList.toggle('held',input.run);};
  for(const event of ['pointerup','pointercancel','lostpointercapture'])run.addEventListener(event,releaseRun);
  toggle.addEventListener('click',()=>{enabled=!enabled;clear();sync();});
  addEventListener('blur',clear);addEventListener('resize',clear);document.addEventListener('visibilitychange',clear);
  const fullscreen=document.getElementById('fullscreen-button');fullscreen.hidden=!document.documentElement.requestFullscreen;
  fullscreen.addEventListener('click',()=>{const result=document.fullscreenElement?document.exitFullscreen():document.documentElement.requestFullscreen();result?.catch(()=>{});});
  window.TouchControls={input,clear,setContext,get enabled(){return enabled;}};sync();
})();
