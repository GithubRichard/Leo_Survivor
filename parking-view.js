/* Parking models share world anchors with collision, interaction and lighting. */
(function(){
  'use strict';const S=Survival,P=S.Parking,A=GameArt;
  const names={entrance:'停车场入口',exit:'返回地面',toolbox:'入口工具箱',cargo:'搜索车辆',tank:'油箱',gate_control:'维修区配电门',next_floor:'下一层入口',boss_chest:'潜伏者宝箱'};
  const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const button=(command,label,data='',disabled=false)=>`<button data-command="${command}" ${data} ${disabled?'disabled':''}>${label}</button>`;
  const iconTag=(asset,state='default')=>A.parkingIcon(asset,state)||'';
  function lampModel(ctx,o,q,scale=27){
    if(!P.lamps[o.kind])return false;
    const asset={oil_lantern:'fuel_lantern',fixed_oil_lamp:'fixed_fuel_light'}[o.kind]||o.kind;
    const damaged=o.hp<(o.maxHP||P.lamps[o.kind].hp),fixed=P.lamps[o.kind].fixed;
    let state=!o.active||o.energy<=0?'off':damaged?(fixed?'damaged_on':o.kind==='flashlight'?'ground_on':'ground_damaged'):(fixed||o.kind==='headlamp'?'on':'ground_on');
    const states=window.PARKING_ART?.assets[asset]?.states;if(states&&!states[state]&&o.active&&o.energy>0)state=states.ground_on?'ground_on':'on';
    return A.parkingSprite(ctx,asset,state,q.x,q.y,(o.kind==='torch'?36:28)*scale/27);
  }
  const lampButtons=(game,o)=>{
    const d=P.lamps[o.kind],id=o.lampId||o.id,attr=`data-lamp="${esc(id)}"`,carried=game.isCarried(o);
    return (carried?button('lamp-equip','装备 / 手持',attr):!d.fixed?button('lamp-pickup','拿起（保留剩余能源）',attr):'')+
      button('lamp-toggle',o.active?'熄灭':'点亮',attr,!o.active&&o.energy<=0)+
      (d.fuel?button('lamp-refuel',`装入1${S.NAMES[d.fuel]}`,attr,o.energy>0||!game.count(d.fuel)):'')+
      (carried?button('lamp-drop','放到地面',attr)+(d.throwable?button('lamp-throw',iconTag('throw_light_icon')+'投向前方6米（准备0.5秒）',attr,!o.active||o.energy<=0):''):'')+
      (!carried&&o.hp<o.maxHP&&o.kind!=='torch'?button('repair','维修1秒 · 1铁恢复6血'):'')+
      (!carried&&d.fixed?button('dismantle','拆除灯体（已装能源会丢失）'):'');
  };
  function context(game,target){
    const o=target.object;if(target.type!=='parking'&&target.type!=='lamp')return null;
    let title=names[o.kind]||S.NAMES[o.kind],description='',commands='';
    if(target.type==='lamp'){
      const d=P.lamps[o.kind];description=`${d.name}：${o.active?'已点亮':'已熄灭'}，剩余${Math.ceil(o.energy||0)}秒。${d.angle?`前方${d.angle}°、最远${d.radius}米`:`圆形半径${d.radius}米`}。血量${Number(o.hp.toFixed(1))}/${o.maxHP}。开关、拿放需0.5秒，移动或受伤会中断。`;
      commands=lampButtons(game,o);
    }else{
      if(o.kind==='entrance'||o.kind==='exit'){description='交互2秒切换场景；移动或受伤中断。地面时间在地下探索期间冻结。';commands=button('parking-interact',o.kind==='exit'?'返回地面（2秒）':'进入地下首层（2秒）');}
      else if(o.kind==='next_floor'){description=game.parking.layer.nextUnlocked?'入口已解锁，下一层地图与数值尚未开放。':'击败潜伏者并打开宝箱后解锁。';}
      else if(o.kind==='gate_control'){description=game.parking.layer.gateOpen?'配电门已永久打开。':'消耗1份保险丝，2秒打开；保险丝在门外远端维修车。';commands=button('parking-interact','安装保险丝并开门','',game.parking.layer.gateOpen||!game.count('fuse'));}
      else{
        const cargo=o.carId&&game.parking.layer.cars.find(c=>c.id===o.carId);if(cargo)title=`${{civilian:'民用车',repair:'维修车',supply:'补给车',security:'保安车'}[cargo.vehicle]} · ${title}`;
        description=o.opened?'已搜索，剩余物资保留在此处，离开或读档不补货。':o.kind==='boss_chest'?'打开2秒：获得潜伏技能并解锁下一层；背包满也能完成解锁。':`搜索${o.time||2}秒，移动或受伤中断；不会额外触发刷怪。`;
        if(!o.opened)commands=button('parking-interact',o.kind==='boss_chest'?'开启Boss宝箱':'搜索');
        else for(const [kind,n] of Object.entries(o.loot||{}))if(n>0)commands+=button('parking-take',`领取${S.NAMES[kind]} × ${n}`,`data-kind="${kind}"`);
        if(o.opened&&!Object.values(o.loot||{}).some(n=>n>0))description='物资已领完，不会重复补货。';
      }
    }
    return `<div class="eyebrow">暂停中 · E交互</div><h2>${esc(title)}</h2><p>${esc(description)}</p><div class="context-actions">${commands}</div><div class="overlay-actions"><button data-key="escape">返回游戏</button></div>`;
  }
  function inventoryExtras(game){
    const o=game.inventory[game.selectedSlot];let html='';
    if(o&&P.lamps[o.kind]){game.newLamp(o);const d=P.lamps[o.kind];html=`<section class="parking-lamp-controls"><h3>${esc(d.name)} · ${o.active?'点亮':'熄灭'} · ${Math.ceil(o.energy)}秒</h3><p>${d.angle?`前方${d.angle}°扇形`:'360°圆形'}，距离${d.radius}米。${d.hand?'占一只手，只能搭配徒手、木棍、铁斧。':'不占手。'}${d.fuel?'灯体不赠送能源，每次只装入一份。':'燃尽消失，拿放不会恢复寿命。'}</p>${lampButtons(game,o)}</section>`;}
    if(game.skill.unlocked)html+=`<p>潜伏：启动2体力，最多7秒，移速3.4；黑暗中隐身，不能奔跑，每秒额外消耗1.5饱食。结束后冷却20秒。Q或触屏技能按钮使用。</p>`;
    return html;
  }
  function command(game,name,button,o){
    if(name.startsWith('lamp-'))return {handled:true,ok:game.lampAction(name.slice(5),button.dataset.lamp),leave:true};
    if(name==='parking-interact')return {handled:true,ok:game.parkingInteract(o),leave:!o.opened};
    if(name==='parking-take')return {handled:true,ok:game.takeParkingLoot(o,button.dataset.kind),leave:false};
    return {handled:false};
  }
  function rayPolygon(game,origin,radius,angle=360,facing={x:0,y:1}){
    const result=[],start=Math.atan2(facing.y,facing.x)-angle*Math.PI/360,count=Math.max(32,Math.ceil(angle/3));
    if(angle<360)result.push({...origin});
    for(let i=0;i<=count;i++){
      const a=start+i/count*angle*Math.PI/180,end={x:origin.x+Math.cos(a)*radius,y:origin.y+Math.sin(a)*radius};
      const blockers=game.obstacles(origin,end,0).filter(o=>o!==origin.lamp);let lo=0,hi=1;
      if(blockers.length){for(let n=0;n<10;n++){const t=(lo+hi)/2,p={x:origin.x+(end.x-origin.x)*t,y:origin.y+(end.y-origin.y)*t};if(blockers.some(o=>S.segmentHits(origin,p,o,0)))hi=t;else lo=t;}}
      result.push({x:origin.x+(end.x-origin.x)*(blockers.length?lo:1),y:origin.y+(end.y-origin.y)*(blockers.length?lo:1)});
    }return result;
  }
  function path(ctx,points,project){ctx.beginPath();points.forEach((p,i)=>{const q=project(p.x,p.y);i?ctx.lineTo(q.x,q.y):ctx.moveTo(q.x,q.y);});ctx.closePath();}
  let floorCache=null;
  function groundModel(ctx,asset,x,y,w,h,project,source){
    return A.parkingSurface(ctx,asset,'default',source||[[.5,.055],[.93,.493],[.49,.948],[.07,.486]],
      [project(x-w/2,y-h/2),project(x+w/2,y-h/2),project(x+w/2,y+h/2),project(x-w/2,y+h/2)]);
  }
  function carModel(ctx,car,layer,v){
    const asset={civilian:'civilian_car',repair:'maintenance_van',supply:'supply_van',security:'security_car'}[car.vehicle],searched=layer.points.some(p=>p.carId===car.id&&p.kind==='cargo'&&p.opened),q=v.project(car.x,car.y);
    return A.parkingSprite(ctx,asset,`south_${searched?'searched':'unsearched'}`,q.x,q.y,88*v.scale/27);
  }
  function floor(game,v){
    const {ctx,project,scale}=v,layer=game.parking.layer;
    const signature=`${scale}:${A.parkingRevision}`;
    if(!floorCache||floorCache.layer!==layer||floorCache.scale!==scale||!floorCache.ready&&floorCache.signature!==signature){
      const canvas=floorCache?.canvas||document.createElement('canvas');canvas.width=Math.ceil(108*scale+2);canvas.height=Math.ceil(54*scale+2);
      const c=canvas.getContext('2d'),p=(x,y)=>({x:(x-y+84)*scale+1,y:(x+y+24)*scale/2+1});
      for(let y=2;y<60;y+=4)for(let x=-22;x<24;x+=4)groundModel(c,'concrete_floor',x,y,4,4,p);
      for(const car of layer.cars){
        groundModel(c,'parking_bay_lines',car.x,car.y,3.8,5.6,p,[[.443,.125],[.901,.653],[.561,.899],[.107,.356]]);
        const q=p(car.x,car.y-2.45);A.parkingSprite(c,'wheel_stop','default',q.x,q.y,9*scale/27);
      }
      for(const y of [7,18,29,40,51])groundModel(c,'parking_direction_arrow',0,y,1.3,2.1,p,[[.5,.12],[.94,.5],[.5,.9],[.1,.5]]);
      const ready=['concrete_floor','parking_bay_lines','parking_direction_arrow','wheel_stop'].every(id=>A.available('parking_atlas_'+id));
      floorCache={canvas,layer,signature,scale,ready};
    }
    const q=project(0,0);ctx.drawImage(floorCache.canvas,q.x-84*scale-1,q.y-12*scale-1);
  }
  function wallModel(o,v,game){
    const {ctx,project,box}=v;ctx.save();if(/^parking:(left|right|front|back)$/.test(o.id)&&S.pointRect(game.player,o)<2.4)ctx.globalAlpha*=.28;box(o,2.1,'#777a6e','#424a47','#58605b');
    const id=window.PARKING_ART?.assets.concrete_wall?.states.south,m=window.PARKING_ART?.frames[id];if(!m){ctx.restore();return;}
    const [l,t,r,b]=m.bounds,[,,w,h]=m.rect,point=(x,y)=>[(l+(r-l)*x)/w,(t+(b-t)*y)/h];
    const source=[point(.13,.7),point(.85,.7),point(.85,.1),point(.14,.1)];
    const face=(a,b)=>A.parkingSurface(ctx,'concrete_wall','south',source,[project(...a),project(...b),project(...b,2.1),project(...a,2.1)]);
    face([o.x-o.w/2,o.y+o.h/2],[o.x+o.w/2,o.y+o.h/2]);
    face([o.x+o.w/2,o.y-o.h/2],[o.x+o.w/2,o.y+o.h/2]);
    ctx.restore();
  }
  function effectModel(ctx,fx,seconds,q,scale=27){
    if(fx.kind==='parking_lamp_fx')return A.parkingSprite(ctx,fx.asset,fx.state,q.x,q.y,(fx.asset==='torch'?36:28)*scale/27,{alpha:Math.min(1,(fx.until-seconds)/.2)});
    if(fx.kind!=='parking_art_fx')return false;
    return A.parkingSequence(ctx,fx.asset,seconds-fx.startedAt,fx.duration,q.x,q.y,(fx.height||40)*scale/27,{alpha:Math.min(1,(fx.until-seconds)/.15)});
  }
  let fogCanvas=null,sightCanvas=null,softCanvas=null,carCanvas=null,visibility=null;
  function fog(game,v){
    const {ctx,project,width,height,scale}=v,lights=game.lightSources().filter(l=>S.dist(l,game.player)<=P.lightSight+l.radius);
    if(!fogCanvas){fogCanvas=document.createElement('canvas');sightCanvas=document.createElement('canvas');softCanvas=document.createElement('canvas');carCanvas=document.createElement('canvas');}
    let resized=false;for(const canvas of [fogCanvas,sightCanvas,softCanvas,carCanvas])if(canvas.width!==width||canvas.height!==height){canvas.width=width;canvas.height=height;resized=true;}
    const signature=`${Math.floor(game.seconds*8)}:${Math.round(game.player.x*2)},${Math.round(game.player.y*2)}:${game._navigationRevision}:${scale}:${lights.map(l=>`${l.lamp?.lampId||'exit'}:${l.angle?Math.round(Math.atan2(l.facing.y,l.facing.x)*16):0}`).join('|')}`;
    const f=fogCanvas.getContext('2d');
    if(resized||visibility?.game!==game||visibility.signature!==signature){
      visibility={game,signature,origin:{x:game.player.x,y:game.player.y},cars:game.parking.layer.objects.filter(car=>car.kind==='car'&&game.canSeeCar(car))};
      const m=sightCanvas.getContext('2d');m.clearRect(0,0,width,height);m.fillStyle='#fff';path(m,rayPolygon(game,game.player,P.baseSight),project);m.fill();
      m.save();path(m,rayPolygon(game,game.player,P.lightSight),project);m.clip();for(const l of lights){path(m,rayPolygon(game,l,l.radius,l.angle||360,l.facing),project);m.fill();}m.restore();
      const s=softCanvas.getContext('2d');s.clearRect(0,0,width,height);s.filter='blur(12px)';s.drawImage(sightCanvas,0,0);s.filter='none';
      f.globalCompositeOperation='source-over';f.clearRect(0,0,width,height);f.drawImage(softCanvas,0,0);f.globalCompositeOperation='destination-in';
      for(let i=0;i<3;i++)f.drawImage(softCanvas,0,0);f.drawImage(sightCanvas,0,0);f.globalCompositeOperation='source-over';
      s.clearRect(0,0,width,height);s.drawImage(fogCanvas,0,0);
      // Car silhouettes can bypass their own ground shadow, within sight only.
      // Reuse the temporary sight canvas for this bounded reveal stencil.
      m.clearRect(0,0,width,height);m.drawImage(softCanvas,0,0);
      const centre=project(game.player.x,game.player.y);m.save();m.translate(centre.x,centre.y);m.scale(scale*Math.SQRT2,scale/Math.SQRT2);
      const edge=m.createRadialGradient(0,0,P.baseSight-.6,0,0,P.baseSight);edge.addColorStop(0,'#fff');edge.addColorStop(1,'#fff0');m.fillStyle=edge;m.beginPath();m.arc(0,0,P.baseSight,0,Math.PI*2);m.fill();m.restore();
    }
    f.globalCompositeOperation='source-over';f.clearRect(0,0,width,height);f.fillStyle='#030608';f.fillRect(0,0,width,height);
    const old=project(visibility.origin.x,visibility.origin.y),q=project(game.player.x,game.player.y);f.globalCompositeOperation='destination-out';f.drawImage(softCanvas,old.x-width/2,old.y-height*.56);
    // Protect the complete player silhouette where a nearby wall truncates ground sight rays.
    f.save();f.translate(q.x,q.y-24);f.scale(26,38);const playerMask=f.createRadialGradient(0,0,.72,0,0,1);playerMask.addColorStop(0,'#fff');playerMask.addColorStop(1,'#fff0');f.fillStyle=playerMask;f.beginPath();f.arc(0,0,1,0,Math.PI*2);f.fill();f.restore();
    // Clip model completion to the same visible distance and lit areas. Never
    // punch a complete, isolated car-shaped hole into unexplored blackness.
    const c=carCanvas.getContext('2d');c.globalCompositeOperation='source-over';c.clearRect(0,0,width,height);
    for(const car of visibility.cars)carModel(c,car,game.parking.layer,v);
    c.globalCompositeOperation='destination-in';c.drawImage(sightCanvas,old.x-width/2,old.y-height*.56);c.globalCompositeOperation='source-over';f.drawImage(carCanvas,0,0);
    f.globalCompositeOperation='source-over';ctx.drawImage(fogCanvas,0,0);
  }
  const entrancePoint=(e,across=0,along=0)=>e.axis==='x'?{x:e.x+along,y:e.y+across}:{x:e.x+across,y:e.y+along};
  const smooth=n=>{const t=Math.max(0,Math.min(1,n));return t*t*(3-2*t);};
  function surface(game,v){
    if(!game.parking)return;const {ctx,project,plane,label,items}=v,e=game.parking.entrance,t=game.parking.toolbox;
    const rise=game.parking.introSeen===false?(v.intro?smooth((v.intro.time-2.7)/4.5):0):1;
    const entry=()=>{
      const q=project(e.x,e.y),left=entrancePoint(e,-2.5),right=entrancePoint(e,2.5),rear=entrancePoint(e,0,-6);
      // The third anchor follows the painted centre line, rather than the
      // raised side wall: the ramp and both possible road axes now share it.
      const anchors=[[139/1536,775/1024],[832/1536,1005/1024],[1195/1536,474/1024]],dest=[left,right,rear].map(p=>project(p.x,p.y,-14*(1-rise)));
      ctx.save();
      if(rise<1){const a=project(left.x,left.y),b=project(right.x,right.y),dx=b.x-a.x,dy=b.y-a.y;ctx.beginPath();ctx.moveTo(a.x-dx*100,a.y-dy*100);ctx.lineTo(b.x+dx*100,b.y+dy*100);ctx.lineTo(b.x+dx*100,b.y+dy*100-10000);ctx.lineTo(a.x-dx*100,a.y-dy*100-10000);ctx.closePath();ctx.clip();}
      if(rise>0&&!A.parkingSprite(ctx,'parking_entrance','default',q.x,q.y,1,{anchors,dest})){const c=entrancePoint(e,0,-3);plane(c.x,c.y,e.axis==='x'?6:5,e.axis==='x'?5:6,'#383d3f','#aa9b65');}ctx.restore();
      if(rise>=1)label('P · 地下停车场',q.x,q.y+17,'#d8bb68',12);
    };
    const toolbox=()=>{const q=project(t.x,t.y),state=!t.opened?'closed':Object.values(t.loot).some(n=>n>0)?'open_supplied':'open_empty';if(!A.parkingSprite(ctx,'entrance_toolbox',state,q.x,q.y,24)&&!A.sprite(ctx,t.opened?'storage_chest_open':'storage_chest_closed',q.x,q.y,24))plane(t.x,t.y,.5,.5,t.opened?'#555747':'#9b844e','#d0ba72');};
    // The ramp is ground beneath actors, not a foreground picture covering them.
    if(items){items.push({depth:e.x+e.y-6.1,draw:entry});if(rise>=1)items.push({depth:t.x+t.y,draw:toolbox});}else{entry();if(rise>=1)toolbox();}
  }
  function drawEntranceIntro(game,intro,v){
    const {ctx,project,width,height,scale}=v,time=intro.time,e=game.parking?.entrance;
    if(e&&time>=2.7&&time<8.2){
      const strength=time<7.2?Math.min(1,(time-2.7)*2):Math.max(0,8.2-time);
      ctx.save();
      for(let i=0;i<64;i++){
        const life=((time-2.7)*.65+i*.6180339)%1,side=i%2?1:-1,p=entrancePoint(e,side*(2.5+Math.sin(i*7)*life*.65),-6*(i%17)/16);
        const q=project(p.x+Math.sin(i*3)*life*.5,p.y+Math.cos(i*3)*life*.5,life*(i%3?1.2:.65));
        ctx.globalAlpha=strength*(1-life)*.65;ctx.fillStyle=i%3?'#baa88a':'#776b53';ctx.beginPath();ctx.ellipse(q.x,q.y,(i%3?3+life*12:2)*scale/27,(i%3?2+life*6:2)*scale/27,0,0,Math.PI*2);ctx.fill();
      }ctx.restore();
    }
    ctx.save();ctx.fillStyle='#000';ctx.fillRect(0,0,width,height*.065);ctx.fillRect(0,height*.935,width,height*.065);
    if(time>=2.1&&time<8.2){ctx.globalAlpha=Math.min(smooth((time-2.1)/.6),smooth((8.2-time)/.5));ctx.fillStyle='#e7d7ac';ctx.font='22px "Microsoft YaHei",sans-serif';ctx.textAlign='center';ctx.fillText(time<7.2?'地底传来震动……':'地下停车场已出现',width/2,height*.88);}
    const black=time<1.4?smooth(time/1.4):time<2.7?1-smooth((time-1.4)/1.3):time<8.2?0:time<9.3?smooth((time-8.2)/1.1):1-smooth((time-9.3)/1.3);
    ctx.globalAlpha=black;ctx.fillStyle='#000';ctx.fillRect(0,0,width,height);ctx.restore();
  }
  function groundSight(game,v){
    if(game.minutes<1320)return;
    const {ctx,project,width,height,scale}=v,q=project(game.player.x,game.player.y);
    // Ground reference R=24m; parking uses R/3=8m in the same world metric.
    ctx.save();ctx.translate(q.x,q.y);ctx.scale(scale*Math.SQRT2,scale/Math.SQRT2);const shade=ctx.createRadialGradient(0,0,P.groundSight-1.5,0,0,P.groundSight);shade.addColorStop(0,'#03060800');shade.addColorStop(1,'#030608');ctx.fillStyle=shade;ctx.fillRect(-width/scale-100,-height/scale-100,width/scale*2+200,height/scale*2+200);ctx.restore();
  }
  function draw(game,v){
    const {ctx,project,plane,box,actor,label,drawDevice,drawMolotovAim,width,height,placement,buildKind,nearby,mode}=v,layer=game.parking.layer;
    ctx.clearRect(0,0,width,height);ctx.fillStyle='#030608';ctx.fillRect(0,0,width,height);plane(0,30,48,60,'#373b39','#777761');floor(game,v);
    if(!floorCache?.ready)for(const car of layer.cars)plane(car.x,car.y,3.8,5.6,null,'#9b925d');
    const items=[];
    for(const o of layer.objects){
      if(o.kind==='wall'){
        const horizontal=o.w>o.h,length=horizontal?o.w:o.h,n=Math.ceil(length/4),part=length/n;
        for(let i=0;i<n;i++){const s={...o,x:o.x+(horizontal?-length/2+part*(i+.5):0),y:o.y+(horizontal?0:-length/2+part*(i+.5)),w:horizontal?part:o.w,h:horizontal?o.h:part};items.push({depth:s.x+s.y,draw:()=>wallModel(s,v,game)});}continue;
      }
      const q0=project(o.x,o.y);if(q0.x<-170||q0.x>width+170||q0.y<-170||q0.y>height+170)continue;
      items.push({depth:o.x+o.y,draw:()=>{
      const q=project(o.x,o.y);
      if(o.kind==='car'){
        if(carModel(ctx,o,layer,v))return;
        const color={civilian:'#6c7169',repair:'#8c7a4a',supply:'#677e77',security:'#555b67'}[o.vehicle];box(o,1.2,color,'#393f3d','#505753');const window=project(o.x,o.y,.9);ctx.fillStyle='#1e292b';ctx.fillRect(window.x-12,window.y-9,24,8);
      }else if(o.kind==='fuse_gate'){
        if(A.parkingSprite(ctx,'fuse_gate',layer.gateOpen?'open':'locked',q.x,q.y,60*v.scale/27)||layer.gateOpen)return;
        box(o,1.6,'#777a6e','#424a47','#58605b');
      }else if(o.kind==='column'){
        if(!A.parkingSprite(ctx,'load_bearing_pillar','default',q.x,q.y,66*v.scale/27))box(o,2.4,'#777a6e','#424a47','#58605b');
      }else box(o,2.1,'#777a6e','#424a47','#58605b');
    }});}
    for(const [x,y,state] of [[-24,0,'NE'],[24,0,'SE'],[-24,60,'NW'],[24,60,'SW']])items.push({depth:x+y+.01,draw:()=>{const q=project(x,y);ctx.save();if(Math.hypot(game.player.x-x,game.player.y-y)<3)ctx.globalAlpha*=.28;A.parkingSprite(ctx,'concrete_corner',state,q.x,q.y,2.1*v.scale);ctx.restore();}});
    const emergency=project(P.exit.x,P.exit.y);items.push({depth:P.exit.x+P.exit.y-.01,draw:()=>A.parkingSprite(ctx,'emergency_light','default',emergency.x+24,emergency.y-43,16*v.scale/27)});
    for(const p of [...layer.points,...(layer.chest?[layer.chest]:[])])if(p.kind!=='cargo'&&game.canSee(p))items.push({depth:p.x+p.y+.03,draw:()=>{
      const q=project(p.x,p.y);let modeled=false;
      if(p.kind==='boss_chest')modeled=A.parkingSprite(ctx,'boss_chest',game.action?.type==='parking_open'?'opening':!p.opened?'closed':Object.values(p.loot).some(n=>n>0)?'open_loot':'open_empty',q.x,q.y,32);
      if(p.kind==='exit')modeled=A.parkingSprite(ctx,'underground_exit','default',q.x,q.y,58);
      if(p.kind==='next_floor')modeled=A.parkingSprite(ctx,'next_floor_entrance',layer.nextUnlocked?'unlocked':'locked',q.x,q.y,55);
      if(p.kind==='cargo'||p.kind==='tank')modeled=A.parkingSprite(ctx,p.kind==='cargo'?'cargo_marker':'fuel_marker',p.opened?(p.kind==='cargo'?'searched':'drained'):'available',q.x,q.y,16);
      if(!modeled)plane(p.x,p.y,p.kind==='exit'?2:.55,p.kind==='exit'?2:.55,p.opened?'#4e5c4c':p.kind==='boss_chest'?'#b2914d':'#849b83','#c2b67a');
      if(['exit','next_floor','gate_control','boss_chest'].includes(p.kind))label(names[p.kind],q.x,q.y-16,'#d8c786',11);
      else if(p.opened)label(Object.values(p.loot||{}).some(n=>n>0)?'有剩余':'已搜空',q.x,q.y-6,'#aca98c',9);
    }});
    for(const d of game.devices)if(d.hp>0&&game.canSee(d))items.push({depth:d.x+d.y,draw:()=>{
      if(P.lamps[d.kind]){const foot=project(d.x,d.y);if(!lampModel(ctx,d,foot,v.scale))box({...d,w:.4,h:.4},d.kind==='torch'?.7:1,'#94875a','#41483f','#696d4d');const q=project(d.x,d.y,.7);label(`${S.NAMES[d.kind]} ${Math.ceil(d.energy||0)}秒`,q.x,q.y-13,d.active?'#efcd70':'#a5a58b',10);}else drawDevice(d);
    }});
    for(const z of game.zombies)if(z.hp>0&&game.canSee(z))items.push({depth:z.x+z.y,draw:()=>{
      if(z.kind==='lurker'&&z.state==='burrowed'){
        const q=project(z.x,z.y),asset=z.windup?'lurker_hidden_attack':'lurker_hidden_move';
        if(!A.parkingSequence(ctx,asset,z.windup?.until?game.seconds-(z.windup.until-.6):z.visualDistance||0,z.windup?.until ? .6 : 1.2,q.x,q.y,25,{loop:!z.windup})){
          ctx.strokeStyle=z.windup?'#efad70':'#9d8f68';ctx.lineWidth=z.windup?4:2;ctx.beginPath();ctx.ellipse(q.x,q.y,20,9,0,0,Math.PI*2);ctx.stroke();
        }label(z.windup?'隆起·攻击预警':'隆起痕迹',q.x,q.y-13,'#d2bb7f',10);
      }else{actor(z,'zombie');if(z.kind==='lurker'){const q=project(z.x,z.y);label(z.state==='stunned'?'眩晕':z.state==='charging'?'蓄力怒吼':z.burrowWarning?'准备潜伏':z.phase==='cowering'?'畏缩阶段':'潜伏者',q.x,q.y-72,z.phase==='cowering'?'#e6a36f':'#e3b379',12);}}
      if(['lurker','lamp_smasher'].includes(z.kind)){
        const q=project(z.x,z.y),f=z.visualAttack?.until>game.seconds?z.visualAttack.facing:z.facing;
        if(f){const n=Math.hypot(f.x,f.y)||1,end=project(z.x+f.x/n*.8,z.y+f.y/n*.8);ctx.strokeStyle=z.phase==='cowering'?'#dc9c6f':'#c4b986';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(q.x,q.y);ctx.lineTo(end.x,end.y);ctx.stroke();}
        if(z.phase==='cowering'){ctx.strokeStyle='#c28758';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(q.x,q.y,23,10,0,0,Math.PI*2);ctx.stroke();}
      }
      if(z.kind==='lurker'&&z.state==='charging'){
        ctx.save();path(ctx,rayPolygon(game,z,2),project);ctx.clip();
        if(!A.parkingMask(ctx,'roar_telegraph',z,2,project)){const q=project(z.x,z.y);ctx.strokeStyle='#ed9b68';ctx.beginPath();ctx.ellipse(q.x,q.y,2*v.scale*Math.SQRT2,2*v.scale/Math.SQRT2,0,0,Math.PI*2);ctx.stroke();}ctx.restore();
      }
      if(z.windup&&z.kind==='lamp_smasher'){const q=project(z.x,z.y);label('投石准备',q.x,q.y-54,'#d8b877',11);}
      if(z.summonWarned){const q=project(z.x,z.y);A.parkingSequence(ctx,'lurker_summon',game.seconds-(z.summonNext-1),1,q.x,q.y,32);}
      if(z.burrowWarning!=null){const q=project(z.x,z.y);A.parkingSequence(ctx,'lurker_burrow',game.seconds-z.burrowWarning,.6,q.x,q.y,30);}
    }});
    for(const d of game.drops)if(game.canSee(d))items.push({depth:d.x+d.y,draw:()=>{const q=project(d.x,d.y),alias=window.PARKING_ART?.aliases[d.kind];if(!(alias&&A.parkingSprite(ctx,...alias,q.x,q.y,20))&&!A.sprite(ctx,d.kind,q.x,q.y,20))plane(d.x,d.y,.3,.3,'#b9ae76');}});
    items.push({depth:game.player.x+game.player.y,draw:()=>actor(game.player,'player')});
    for(const p of game.projectiles)if(game.canSee(p))items.push({depth:p.x+p.y+.2,draw:()=>{const q=project(p.x,p.y,p.z||.6),lamp=p.kind==='lamp_flight';
      const modeled=lamp?A.parkingSprite(ctx,p.lamp.kind==='oil_lantern'?'fuel_lantern':p.lamp.kind,p.lamp.active&&p.lamp.energy>0?'flight':'off',q.x,q.y,p.lamp.kind==='torch'?25:20):p.kind==='stone_projectile'&&A.parkingSprite(ctx,'thrown_stone','default',q.x,q.y,10);
      if(!modeled&&!A.sprite(ctx,lamp?p.lamp.kind:p.kind==='molotov_projectile'?'molotov':p.kind,q.x,q.y,18)){ctx.fillStyle='#d6bc77';ctx.beginPath();ctx.arc(q.x,q.y,4,0,Math.PI*2);ctx.fill();}
    }});
    for(const fx of game.effects)if(fx.kind==='parking_corpse'&&game.canSee(fx))items.push({depth:fx.x+fx.y-.01,draw:()=>{
      const q=project(fx.x,fx.y);if(fx.wasBurrowed){ctx.strokeStyle='#827653';ctx.beginPath();ctx.ellipse(q.x,q.y,19,8,0,0,Math.PI*2);ctx.stroke();}
      else A.parkingActor(ctx,{...fx,kind:fx.enemyKind,hp:0,state:'exposed'},game.seconds,q.x,q.y,fx.enemyKind==='lurker'?64:53);
    }});
    for(const fx of game.effects)if(['parking_lamp_fx','parking_art_fx','boss_roar'].includes(fx.kind)&&game.canSee(fx))items.push({depth:fx.x+fx.y+.01,draw:()=>{
      const q=project(fx.x,fx.y);if(fx.kind!=='boss_roar'){effectModel(ctx,fx,game.seconds,q,v.scale);return;}
      ctx.save();ctx.globalAlpha=Math.min(1,(fx.until-game.seconds)/.3);ctx.strokeStyle='#dda56e';ctx.lineWidth=2;
      const r=2*Math.max(.01,1-(fx.until-game.seconds)/.6);path(ctx,rayPolygon(game,fx,2),project);ctx.clip();if(!A.parkingMask(ctx,'roar_wave',fx,r,project)){ctx.beginPath();ctx.ellipse(q.x,q.y,r*v.scale*Math.SQRT2,r*v.scale/Math.SQRT2,0,0,Math.PI*2);ctx.stroke();}ctx.restore();
    }});
    for(const zone of game.zones)if(game.canSee(zone)){const q=project(zone.x,zone.y);A.sprite(ctx,zone.kind,q.x,q.y,zone.radius*v.scale,{width:zone.radius*v.scale*2,anchorY:.5});}
    items.sort((a,b)=>a.depth-b.depth);for(const item of items)item.draw();
    // Draw only visual tints; gameplay lighting is evaluated by the rule module.
    ctx.save();ctx.fillStyle='#e5cd7f';for(const l of game.lightSources()){
      ctx.save();path(ctx,rayPolygon(game,l,l.radius,l.angle||360,l.facing),project);ctx.clip();ctx.globalAlpha=.45;
      const mask=l.angle===70?'flashlight_70':l.angle===90?'headlamp_90':'light_circle';
      if(!A.parkingMask(ctx,mask,l,l.radius,project,l.angle?l.facing:undefined)){ctx.globalAlpha=.12;path(ctx,rayPolygon(game,l,l.radius,l.angle||360,l.facing),project);ctx.fill();}ctx.restore();
    }ctx.restore();
    drawMolotovAim();
    if(placement){const p=game.placementPoint(),error=game.canPlace(buildKind,p);plane(p.x,p.y,1,1,error?'#ad5b5666':'#ceb56755',error?'#d1917b':'#e5d99b');drawDevice({...p,kind:buildKind,readyAt:0},true);}
    if(nearby&&mode==='play'){const q=project(nearby.object.x,nearby.object.y);label('E / 交互',q.x,q.y-25,'#ebd290',12);}
    fog(game,v);
  }
  function drawMap(game,canvas){
    const ctx=canvas.getContext('2d'),scale=5.1,cx=275,top=20,p=o=>({x:cx+o.x*scale,y:top+o.y*scale});
    ctx.fillStyle='#070b0d';ctx.fillRect(0,0,550,350);
    for(const k of game.parking.explored){const [x,y]=k.split(',').map(Number),q=p({x,y});ctx.fillStyle='#414844';ctx.fillRect(q.x-5,q.y-5,10,10);}
    for(const o of game.parking.layer.objects){const known=game.parking.explored.some(k=>{const [x,y]=k.split(',').map(Number);return Math.hypot(x-o.x,y-o.y)<3;});if(!known)continue;const q=p(o);ctx.fillStyle=o.kind==='car'?'#858477':'#646b66';ctx.fillRect(q.x-o.w*scale/2,q.y-o.h*scale/2,o.w*scale,o.h*scale);}
    for(const o of game.parking.layer.points){if(o.kind==='cargo'||!game.canSee(o)&&!o.opened&&o.kind!=='exit')continue;const q=p(o);if(o.kind==='exit'&&A.parkingSprite(ctx,'exit_marker','default',q.x,q.y,16))continue;ctx.fillStyle=o.opened?'#8a947d':'#d1b964';ctx.fillRect(q.x-2,q.y-2,4,4);}
    for(const z of game.zombies)if(game.canSee(z)){const q=p(z);if(z.kind==='lurker'&&A.parkingSprite(ctx,'boss_marker','default',q.x,q.y,16))continue;ctx.fillStyle='#c77a68';ctx.fillRect(q.x-2,q.y-2,4,4);}
    const q=p(game.player);ctx.fillStyle='#ffe0a0';ctx.beginPath();ctx.arc(q.x,q.y,4,0,Math.PI*2);ctx.fill();
  }
  let lastCue=0,audio=null;
  function unlockAudio(){try{audio=audio||new (window.AudioContext||window.webkitAudioContext)();if(audio.state==='suspended')audio.resume();}catch{}}
  function hideCombatHUD(){
    const bar=document.getElementById('boss-status');bar.classList.add('hidden');bar.replaceChildren();bar._parkingHtml=null;document.getElementById('parking-skill').classList.add('hidden');
  }
  function hud(game,mode='play'){
    const alive=!game.result&&game.player.hp>0;
    const skill=document.getElementById('parking-skill');skill.classList.toggle('hidden',!alive||mode!=='play'||!game.skill.unlocked);const skillText=game.skill.active?'结束潜伏':game.seconds<game.skill.cooldown?`潜伏 ${Math.ceil(game.skill.cooldown-game.seconds)}秒`:'潜伏 Q';
    const skillState=!game.skill.unlocked?'locked':game.skill.active?(game.hidden?'active_dark':'active_lit'):game.seconds<game.skill.cooldown?'cooldown':game.player.hunger<=0?'hunger_warning':game.player.stamina<2?'no_stamina':'ready';
    const icon=game.skill.unlocked&&A.parkingIcon('stealth_skill',skillState),skillHtml=(icon||'')+`<span>${skillText}</span>`;if(skill._parkingHtml!==skillHtml){skill._parkingHtml=skillHtml;skill.innerHTML=skillHtml;}
    const boss=alive&&!['menu','result'].includes(mode)&&game.scene==='parking'&&game.zombies.find(z=>z.kind==='lurker'&&z.hp>0&&z.noticed),bar=document.getElementById('boss-status');bar.classList.toggle('hidden',!boss);
    if(!boss&&bar._parkingHtml){bar.replaceChildren();bar._parkingHtml=null;}
    if(boss){
      const portrait=A.parkingIcon('boss_portrait'),badge=boss.state==='burrowed'?'burrow_immunity_icon':boss.state==='stunned'?'stun_icon':boss.phase==='cowering'?'boss_phase_icon':null,badgeImage=badge&&A.parkingIcon(badge);
      const text=`潜伏者 ${boss.hp.toFixed(1)} / 25 · ${boss.phase==='cowering'?'畏缩阶段':'常规阶段'} · ${{burrowed:'潜伏免疫（燃烧瓶除外）',stunned:'眩晕，可攻击',charging:'蓄力怒吼，可攻击',exposed:'显形，可攻击'}[boss.state]}`;
      const html=`<div class="parking-boss-heading">${portrait||''}<span>${text}</span>${badgeImage||''}</div><div class="parking-boss-health"><i style="width:${Math.max(0,Math.min(100,boss.hp/25*100))}%"></i></div>`;
      if(bar._parkingHtml!==html){bar._parkingHtml=html;bar.innerHTML=html;}
    }
    if(game.scene==='parking'){
      document.getElementById('day-label').textContent='地下停车场 · 首层';document.getElementById('clock').textContent=`${Math.floor(game.seconds/60)}:${String(Math.floor(game.seconds%60)).padStart(2,'0')}`;
      document.getElementById('phase').textContent=`常规刷新 ${Math.max(0,Math.ceil(game.parking.nextBatch*60-game.seconds))}秒 · 存活${game.zombies.length}`;
      document.getElementById('wave-warning').classList.add('hidden');document.getElementById('objective').innerHTML='<b>照明与撤退</b><br>灯光驱赶近战怪，暗处弹体仍能射入。入口可随时返回。';
    }
    if(game.weaknessUntil>game.seconds)document.getElementById('buffs').textContent+=` · 虚弱 ${Math.ceil(game.weaknessUntil-game.seconds)}秒（伤害/移速-0.7）`;
    for(const id of [game.heldLightId,game.headLightId]){const l=game.lampById(id);if(l)document.getElementById('buffs').textContent+=` · ${S.NAMES[l.kind]} ${l.active?'亮':'灭'} ${Math.ceil(l.energy)}秒`;}
    if(game.skill.active)document.getElementById('buffs').textContent+=` · 潜伏 ${Math.ceil(game.skill.until-game.seconds)}秒（${game.hidden?'已隐身':'有光，未隐身'}）`;
    if(game.audioCueSerial!==lastCue){lastCue=game.audioCueSerial;if(audio?.state==='running'){const o=audio.createOscillator(),gain=audio.createGain();o.connect(gain);gain.connect(audio.destination);o.frequency.value=330;gain.gain.setValueAtTime(.035,audio.currentTime);gain.gain.exponentialRampToValueAtTime(.001,audio.currentTime+.18);o.start();o.stop(audio.currentTime+.18);}}
  }
  const developer=game=>`<div class="dev-section"><h3>停车场模型接入</h3><p>已索引${window.PARKING_ART?.coverage.availableAtlases||0}/${window.PARKING_ART?.coverage.plannedAtlases||115}张图集、${window.PARKING_ART?.coverage.availableFrames||0}帧；包含两阶段与八方向动作。以下操作仅影响测试存档。</p><div class="dev-row"><button data-dev="parking">前往地下首层（第15天）</button><button data-dev="parking-boss" ${game.scene==='parking'?'':'disabled'}>前往Boss战区</button><button data-dev="parking-return" ${game.scene==='parking'?'':'disabled'}>返回地面</button></div></div>`;
  window.ParkingView={context,inventoryExtras,command,draw,surface,groundSight,drawMap,hud,hideCombatHUD,names,unlockAudio,developer,lampModel,effectModel,entrancePoint,drawEntranceIntro};
})();
