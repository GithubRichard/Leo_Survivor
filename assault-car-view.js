/* A visual-only trip. Fuel and player position commit once after the film. */
(() => {
  'use strict';const A=GameArt,D=ASSAULT_CAR_ART,rig=D.rig.boarding;
  const clamp=n=>Math.max(0,Math.min(1,n)),mix=(a,b,t)=>({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t});
  const origin=c=>({x:c.x+D.groundOffset.x,y:c.y+D.groundOffset.y});
  function registered(ctx,id,p,v,alpha=1,ppm){const m=D.frames[id];if(!m)return false;const [asset,state]=id.split('__'),q=v.project(p.x,p.y);return A.worldSprite(ctx,'transport_'+asset,state,q.x,q.y,m.bodyHeight*v.scale/(ppm||m.pixelsPerMeter),{alpha});}
  function ready(){let ok=true;const keys=Object.keys(D.atlases).filter(k=>!k.endsWith('assault_car_sw'));for(const side of ['north','south'])for(const [asset,state] of [['west_gate_posts',side+'_outside'],['west_gate_leaf_'+side+'_outside','angle_0']]){const id=WEST_GATE_ART.assets['west_'+asset]?.states[state];if(id)keys.push(WEST_GATE_ART.frames[id].atlas);}for(const key of new Set(keys))if(!A.available(key))ok=false;return ok;}
  function context(game,target){
    if(target?.object?.kind==='armory_departure_sign')return `<div class="eyebrow">原出发路牌</div><h2>前往军备库</h2><p>这块远处路牌永久保留，突击车的出发和返回都使用这里。${!game.assaultCar()?'车辆停位正在确认，请返回场景继续。':game.armory.transport?.side==='inside'?'车辆现停在军备区内，乘车返回后会回到此处。':'车辆停在路牌旁，请靠近车身加油、上车。'}</p><p>${game.armory.southBreach?.breached?'南门已撞开，可自行步行进出。':'首次必须乘车撞开南侧大门，此后可步行进出。'}</p><button data-key="escape">返回场景</button>`;
    if(target?.object?.kind!=='assault_car')return null;const t=game.armory.transport,need=4-t.quarters,inside=t.side==='inside',loaded=ready();
    return `<div class="eyebrow">军备区运输</div><h2>军用突击车</h2><p>油箱 ${(t.quarters*.25).toFixed(2)} / 1升 · ${inside?'军备区内':'原来的远处路牌旁'}</p><p>${game.armory.southBreach?.breached?'南门已撞开，可步行进出，也可选择乘车。':'首次必须乘车撞开南侧大门，此后可步行进出。'}满油出发，每次往返共消耗0.5升，返程不重复扣油。每份汽车燃油为0.25升。</p>${need?`<button data-command="vehicle-refuel" ${game.count('fuel_oil')<need?'disabled':''}>注入${need}份燃油，加满油箱</button>`:'<p>油箱已满。</p>'}${inside?`<button data-command="vehicle-return" ${t.returnPaid?'':'disabled'}>返回原来的远处路牌旁（无动画，不再扣油）</button>`:`<button data-command="vehicle-drive" ${need||!loaded?'disabled':''}>${loaded?'乘车前往军备区':'车辆素材载入中…'}</button>`}<button data-key="escape">返回场景</button>`;
  }
  const select=(clip,ms)=>{let end=0;for(let i=0;i<clip.frames.length;i++){end+=clip.durationsMs[i];if(ms<end)return clip.frames[i];}return clip.frames.at(-1);};
  class Trip{
    constructor(game){const c=game.assaultCar();this.time=0;this.ram=!game.armory.southBreach?.breached;this.gate={x:game.armory.entrance.x,y:game.armory.entrance.y};this.start={x:c.x,y:c.y};this.position={...this.start};this.player={x:game.player.x,y:game.player.y};this.camera=mix(this.player,this.start,.65);const o=origin(c),dx=(rig.approachFoot[0]-rig.ground[0])/90,dy=(rig.approachFoot[1]-rig.ground[1])/90;this.approach={x:o.x+(dx+2*dy)/2,y:o.y+(2*dy-dx)/2};this.update(0);}
    update(dt){
      const previous=this.time;this.time+=dt;const t=this.time;
      this.hidePlayer=t>=.65+.18;this.actor=mix(this.player,this.approach,clamp(t/.65));const n=Math.hypot(this.approach.x-this.player.x,this.approach.y-this.player.y);this.actor.facing=n?{x:(this.approach.x-this.player.x)/n,y:(this.approach.y-this.player.y)/n}:{x:0,y:-1};
      if(t<.65){this.frame=D.clips.park.frame;this.position={...this.start};}
      else if(t<1.85){this.frame=select(D.clips.boarding,(t-.65)*1000);this.position={...this.start};}
      else if(t<2.1){this.frame='assault_car_boarding__closed_seated';this.position={x:this.start.x,y:this.start.y+(t-1.85)*1.3};}
      else if(t<2.62){const u=clamp((t-2.1)/.52);this.frame=select(D.clips.drift,(t-2.1)*1000);this.position={x:this.start.x+3*u*u,y:this.start.y+.325+1.5*Math.sin(u*Math.PI/2)};}
      else{const u=clamp((t-2.62)/.8);this.frame=D.clips.depart.frame;this.position={x:this.start.x+3+55*u*u,y:this.start.y+1.825};}
      if(previous<.65+.18&&t>=.65+.18)GameSound.effect('door',.7);
      if(previous<1.85&&t>=1.85)GameSound.effect('engine',.8);
      if(previous<2.1&&t>=2.1)GameSound.effect('skid',.65);
      this.fade=clamp((t-3.17)/.25);
      if(this.ram&&t>=3.42){
        this.camera={x:this.gate.x,y:this.gate.y+1};this.frame='assault_car_directions__northeast';
        this.position={x:this.gate.x,y:this.gate.y+(t<4.02?8*(1-clamp((t-3.42)/.6)):-13*clamp((t-4.02)/.88))};
        this.fade=t<3.67?1-clamp((t-3.42)/.25):clamp((t-4.85)/.25);
        if(previous<4.02&&t>=4.02)GameSound.effect('gate_crash',1);
      }
      return t>=(this.ram?5.1:3.42);
    }
    draw(ctx,v){ctx.save();ctx.fillStyle='#050807';ctx.globalAlpha=this.fade;ctx.fillRect(0,0,v.width,v.height);ctx.globalAlpha=1;ctx.fillStyle='#fff1cc';ctx.textAlign='center';ctx.font='16px "Microsoft YaHei",sans-serif';ctx.fillText(this.ram&&this.time>=3.42?'撞开军备区大门 · 此后可步行进出':'前往军备区 · 本次往返消耗0.5升',v.width/2,v.height-72);ctx.restore();}
  }
  function gateItems(game,v,movie){
    if(!game.armory?.worldIntegrated)return;const e=game.armory.entrance,broken=!!game.armory.southBreach?.breached,age=movie?.ram&&movie.time>=4.02?movie.time-4.02:-1;
    const q=v.project(e.x,e.y);if(Math.abs(q.x-innerWidth/2)>innerWidth/2+300||Math.abs(q.y-innerHeight/2)>innerHeight/2+300)return;
    for(const [i,side] of ['north','south'].entries()){
      const sign=i?1:-1,post={x:e.x+sign*3.2,y:e.y};
      v.items.push({depth:post.x+post.y+.05,draw:()=>{const p=v.project(post.x,post.y);A.worldSprite(v.ctx,'west_west_gate_posts',side+'_outside',p.x,p.y,2.3*v.scale);}});
      if(broken||age>=.9)continue;
      const u=age<0?0:clamp(age/.9),angle=sign*u*3.6,lift=age<0?0:Math.sin(u*Math.PI)*3,hinge={x:e.x+sign*(3+u*7),y:e.y-u*6},tip={x:hinge.x-sign*3*Math.cos(angle),y:hinge.y+sign*3*Math.sin(angle)},asset='west_gate_leaf_'+side+'_outside',meta=WEST_GATE_ART.frames[WEST_GATE_ART.assets['west_'+asset].states.angle_0];
      v.items.push({depth:(hinge.x+hinge.y+tip.x+tip.y)/2+.1,draw:()=>{const a=v.project(hinge.x,hinge.y,lift),b=v.project(tip.x,tip.y,lift),top=v.project(hinge.x,hinge.y+u*2.3,lift+2.3*(1-u));v.ctx.save();v.ctx.globalAlpha=1-clamp((u-.7)/.3);A.worldFrameSurface(v.ctx,'west_'+asset,'angle_0',meta.surfacePoints,[a,b,top]);v.ctx.restore();}});
    }
    if(age>=0&&age<.9)v.items.push({depth:e.x+e.y+.2,draw:()=>{const alpha=1-age/.9;registered(v.ctx,'assault_dust__expand',e,v,.27*alpha,90);v.ctx.save();v.ctx.fillStyle='#d3b774';v.ctx.globalAlpha=alpha;for(let i=0;i<18;i++){const a=i*2.4,p=v.project(e.x+Math.cos(a)*age*6,e.y+Math.sin(a)*age*4,Math.max(0,.2+Math.sin(i)*.1+age*(3+i%4)-age*age*6));v.ctx.fillRect(p.x,p.y,2,2);}v.ctx.restore();}});
  }
  function hubs(ctx,id,p,v,time){
    const m=D.frames['assault_wheel_spin__spin'+Math.floor(time/.07)%3];if(!A.available(m.atlas))return;
    const img=A.images[m.atlas],ratio=img.width/A.entries[m.atlas].size[0],r=m.rect,s=D.rig.wheelHubSourceRectInCell,q=v.project(p.x,p.y),f=v.scale/90;
    for(const [hub,size] of [[rig.frontWheel,rig.frontWheelHubSize],[rig.rearWheel,rig.rearWheelHubSize]]){const x=q.x+(hub[0]-rig.ground[0])*f,y=q.y+(hub[1]-rig.ground[1])*f,w=size[0]*f,h=size[1]*f;ctx.save();ctx.beginPath();ctx.ellipse(x,y,w/2,h/2,0,0,Math.PI*2);ctx.clip();ctx.drawImage(img,(r[0]+s[0])*ratio,(r[1]+s[1])*ratio,s[2]*ratio,s[3]*ratio,x-w/2,y-h/2,w,h);ctx.restore();}
  }
  function items(game,v,movie){
    if(game.scene!=='surface')return;gateItems(game,v,movie);const c=game.assaultCar();if(!c)return;
    const p=origin(movie?.position||c),id=movie?.frame||D.clips.park.frame,t=movie?.time||0;
    if(t>=2.1&&t<3.42){const age=t-2.1,u=clamp(age/1.07),fx=origin(movie.start),skid=D.clips.drift.skidFrames[Math.min(2,Math.floor(age/.18))],dust=D.clips.drift.dustFrames[Math.min(2,Math.floor(age/.2))];v.items.push({layer:-1,depth:fx.x+fx.y,draw:()=>{v.ctx.save();v.ctx.globalCompositeOperation='multiply';registered(v.ctx,skid,fx,v,.35*(1-u),90);v.ctx.restore();registered(v.ctx,dust,fx,v,.27*(1-u),90);}});}
    v.items.push({depth:(movie?.position||c).x+(movie?.position||c).y+1.5,draw:()=>{registered(v.ctx,id,p,v);if(t>=1.85&&t<2.1)hubs(v.ctx,id,p,v,t);}});
  }
  window.AssaultCarView={ready,context,Trip,items};
})();
