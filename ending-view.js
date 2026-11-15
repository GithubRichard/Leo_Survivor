/* In-game Day 21 shots, composed from the delivered atlas anchors and timeline. */
(() => {
'use strict';
const art=window.DAY21_ART,story=window.DAY21_STORY,root='art/2d/day21-endings-v1/';
const frames=new Map(art.frames.map(frame=>[frame.id,frame])),images=new Map();
const shots=new Map(story.shots.map(shot=>[shot.id,shot]));
const characterRate=1.25;
let loading,ctx,shot,current,caption='';
function preload(){
  return loading??=Promise.all([...new Set(art.frames.map(frame=>frame.file))].map(file=>new Promise(resolve=>{
    const image=new Image();
    image.onload=()=>{images.set(file,image);resolve();};
    image.onerror=()=>resolve();
    image.src=root+file;
  })));
}
const clamp = n => Math.max(0, Math.min(1, n));
const mix = (a,b,t) => a + (b-a) * clamp(t);
const height = id => {
  const [,top,,bottom] = frames.get(id).visibleBounds;
  return bottom-top;
};

function draw(id, x, y, scale, options = {}) {
  const frame = frames.get(id);
  const [left,top,right,bottom] = frame.visibleBounds;
  const [anchorX,anchorY] = frame.anchor;
  const bitmap=images.get(frame.file);
  if (!bitmap) return;
  ctx.save();
  ctx.translate(x,y);
  if (options.flip) ctx.scale(-1,1);
  ctx.globalAlpha = options.alpha ?? 1;
  ctx.drawImage(bitmap,frame.rect[0]+left,frame.rect[1]+top,right-left,bottom-top,
    (left-anchorX)*scale,(top-anchorY)*scale,(right-left)*scale,(bottom-top)*scale);
  ctx.restore();
}
function actor(id,x,y,wantedHeight,reference = id,options = {}) {
  draw(id,x,y,wantedHeight/height(reference),options);
}
function plate(id, y = 0) {
  const frame = frames.get(id);
  const bitmap=images.get(frame.file);
  if (!bitmap) return;
  ctx.drawImage(bitmap, ...frame.rect, 0,0,960,540+y*2.3);
}
function subtitle(text) { caption=text||''; }
function fade(alpha) {
  ctx.fillStyle = 'rgba(18,19,16,'+clamp(alpha)+')';
  ctx.fillRect(0,0,960,540);
}
function sequence(scene,time) {
  let end = 0;
  return scene.frames.find((_,i) => { end += scene.times[i]; return time < end; }) || scene.frames.at(-1);
}
const hero = 'rise_clean__horizon';
const leader = 'rescue_clean__wait';
function outdoor(lift = 0) {
  ctx.fillStyle = '#b2986e';
  ctx.fillRect(0,0,960,540);
  plate('dawn_back__landscape',lift*.3);
  actor('sunrise__sun',742,229+lift*.3,104+lift*.18);
}
function horizontalBounds({id,x,scale}) {
  const frame = frames.get(id);
  const [left,,right] = frame.visibleBounds;
  return [x+(left-frame.anchor[0])*scale,x+(right-frame.anchor[0])*scale];
}
function convoyLayout(progress, leaving = false, lift = 0, leadPose) {
  const p = clamp(progress);
  const depth = leaving ? 1-p : p;
  const rearDepth = Math.max(0,depth-.15);
  const heading = leaving ? 'convoy__northeast' : 'convoy__southwest';
  const lead = {
    id:leadPose || heading,
    x:mix(804,575,depth),
    y:mix(224,376,depth)+lift*.3,
    scale:leadPose ? .39 : mix(.045,.50,depth)
  };
  const rear = {
    id:heading,
    x:0,
    y:mix(220,348,rearDepth)+lift*.3,
    scale:mix(.045,.50,rearDepth)
  };
  const minimumGap = story.convoy.minimumHorizontalGap;
  rear.x = horizontalBounds(lead)[1] + minimumGap - horizontalBounds(rear)[0];
  return [rear,lead];
}
function convoy(progress, leaving = false, lift = 0, leadPose) {
  for (const {id,x,y,scale} of convoyLayout(progress,leaving,lift,leadPose)) draw(id,x,y,scale);
}
function friends(lift = 0, close = false) {
  const x = close ? 286 : 320;
  for (const [i,id] of ['C01','C00','C02'].entries()) {
    actor('friend__'+id,x+i*56,397+i*9+lift,close?157:123,undefined,{flip:true});
  }
}
function tvLight(time) {
  const flicker = .22+.075*Math.sin(time/455)+.04*Math.sin(time/133);
  const frame = frames.get('shelter__rest');
  const project = ([x,y]) => [x*960/frame.rect[2],y*540/frame.rect[3]];
  const points = art.anchors['shelter__rest'].screenQuad.map(project);
  ctx.beginPath();
  for (const [i,point] of points.entries()) i ? ctx.lineTo(...point) : ctx.moveTo(...point);
  ctx.closePath();
  ctx.fillStyle = 'rgba(126,167,184,'+flicker+')';
  ctx.fill();
  const [x,y] = project(art.anchors['shelter__rest'].lightSpillCenter);
  const glow = ctx.createRadialGradient(x,y,0,x,y,220);
  glow.addColorStop(0,'rgba(138,177,183,'+(flicker*.43)+')');
  glow.addColorStop(1,'rgba(138,177,183,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0,0,960,540);
}
const renderers = {
  dawn(time) {
    outdoor();
    const id = sequence(shot,time);
    const burn = id === 'dawn_burn__burn';
    const scale = burn ? 107/height(id) : .244;
    draw(id,438,371,scale,{flip:current.zombie?.facing?.x<0,alpha:id.endsWith('embers') ? 1-clamp((time-2350)/650) : 1});
    if (burn) {
      const light = ctx.createLinearGradient(960,20,290,435);
      light.addColorStop(0,'#ffdc8c45');
      light.addColorStop(1,'#ffdc8c00');
      ctx.fillStyle = light;
      ctx.fillRect(0,0,960,540);
    }
  },
  rise(time) {
    outdoor();
    actor(sequence(shot,time*characterRate),364,432,202,hero);
  },
  arrival(time) {
    outdoor();
    const leadPose = time >= 2700 && time < 3750 ? 'boarding__open_empty' : undefined;
    convoy(time/2700,false,0,leadPose);
    actor(hero,355,431,160);
    if (time < 3100) return;
    const walking = time >= 3750 && time < 5500;
    const pose = time < 3450 ? 'step_down' : time < 3750 ? 'land' :
      walking ? (Math.floor((time-3750)*characterRate/160)%2 ? 'walk_a' : 'walk_b') : 'wait';
    actor('rescue_clean__'+pose,mix(606,499,(time-3750)/1750),
      time < 3750 ? mix(358,403,(time-3100)/650) : mix(403,431,(time-3750)/1750),
      132,leader,{flip:pose==='walk_b'});
    if (time >= 3750) actor('rescue_clean__land',754,397,113,leader);
  },
  choice() {
    outdoor();
    convoy(1);
    actor(hero,357,420,202);
    actor(leader,579,420,202);
    subtitle(shot.subtitle);
  },
  departure(time) {
    outdoor();
    if (time < 1860) {
      const actionTime=time*characterRate;
      const pose = actionTime < 450 ? 'open_empty' : actionTime < 820 ? 'reach' :
        actionTime < 1200 ? 'step_in' : actionTime < 1620 ? 'seated_open' : 'closed_seated';
      convoy(1,false,0,'boarding__'+pose);
      if (actionTime < 450) actor(hero,mix(420,637,actionTime/450),391,113);
    } else convoy((time-1860)/1500,true);
    fade((time-3250)/750);
  },
  refusal(time) {
    outdoor();
    friends(0,true);
    const actionTime=time*characterRate;
    actor(sequence(shot,actionTime),518,432,180);
    if (actionTime>2350) actor(leader,704,430,176);
    if (actionTime>2930) subtitle(shot.subtitle);
  },
  farewell(time) {
    const lift = mix(0,272,(time-3200)/2900);
    outdoor(lift);
    convoy((time-1830)/3600,true,lift);
    friends(lift);
    actor(time < 1050 ? 'hero_radio__receive' : 'hero_radio__hold',515,431+lift,155);
    if (time < 1830) actor(time < 1050 ? 'rescue_clean__offer' : leader,597,431,155);
    if (time >= 6100) subtitle('已进入无尽模式 · 已获得对讲机');
  },
  recall(time) {
    if(current.underground)fade(1);else outdoor();
    actor(time < 1100 ? 'hero_radio__speak' : 'hero_radio__listen',414,432,190);
    if (time < 2200) {
      const step = ['one','two','three'][Math.floor(time/200)%3];
      const scale = 58/height('radio_signal__three');
      const frame = frames.get('radio_signal__'+step);
      draw(frame.id,458+(frame.anchor[0]-frame.visibleBounds[0])*scale,292,scale);
      if (time >= 1100) subtitle('收到。接应车辆正在赶来。');
    } else if(current.underground)subtitle('接应已就绪，正在前往庇护所。');else convoy((time-2200)/1900);
    fade((time-4250)/750);
  },
  shelter(time) {
    plate('shelter__rest');
    tvLight(time);
    if (time>1400) subtitle(shot.subtitle);
  }
};

class Sequence{
  constructor(phase,ending){
    this.queue=story.branches[{intro:'common',recall:'endlessExtraction'}[phase]||phase]||['choice'];
    this.ending=ending;this.index=0;this.time=0;this.ready=false;
    preload().then(()=>{this.ready=true;});
  }
  get shot(){return shots.get(this.queue[this.index]);}
  advance(dt){
    if(!this.ready||this.shot.hold)return false;
    this.time+=dt*1000*story.playbackRate;
    if(this.time<this.shot.duration)return false;
    if(this.index===this.queue.length-1)return true;
    this.time-=this.shot.duration;this.index++;return false;
  }
  draw(canvas,width,height){
    ctx=canvas;shot=this.shot;current=this.ending;caption='';
    ctx.fillStyle='#131410';ctx.fillRect(0,0,width,height);
    if(this.ready){
      const scale=Math.min(width/960,height/540);
      ctx.save();ctx.translate((width-960*scale)/2,(height-540*scale)/2);ctx.scale(scale,scale);
      renderers[shot.id](this.time);ctx.restore();
    }
    if(shot.hold)return shot.subtitle;
    return this.ready?caption:'正在载入撤离画面…';
  }
}
const radioIcon=()=>root+frames.get('radio_item__inventory').file;
window.EndingView={preload,Sequence,radioIcon};
})();
