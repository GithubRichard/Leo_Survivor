/* 画面、键盘和界面。实际规则集中在 simulation.js。 */
(() => {
  'use strict';
  const {Game,RULES,NAMES,dist}=Survival;
  const D=Survival.Expansion,UI=window.ExpansionUI;
  const SAVE_KEY="survivor-save-v1";
  let inventoryPane="bag",contextTarget=null,contextChoice=0,overlayNotice="";
  const art=window.GameArt;
  const $=id=>document.getElementById(id);
  const canvas=$('world'),ctx=canvas.getContext('2d');
  const keys=new Set();let scale=27;
  const touch=window.TouchControls;
  let width=innerWidth,height=innerHeight,game=new Game(),mode='menu',menuChoice=0;
  let placement=false,buildKind='trap',dialogVisitor=null,dialogChoice=0,focused=true;
  let lastTime=performance.now(),uiKey='',nearby=null,notifications=[];
  let playerMotion={moving:false,phase:0,facing:null};
  const escapeText=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function resize(){width=innerWidth;height=innerHeight;scale=touch?.enabled?Math.min(27,Math.max(19,width/18)):27;const ratio=Math.min(devicePixelRatio||1,2);canvas.width=Math.round(width*ratio);canvas.height=Math.round(height*ratio);ctx.setTransform(ratio,0,0,ratio,0,0);}
  addEventListener('resize',resize);resize();
  art.loading.then(()=>{$('start-game').disabled=false;$('start-game').textContent=savedData()&&!savedData().result?'开始新游戏':'开始游戏';$('asset-status').textContent=art.failed.length?`${art.failed.length}个素材未能加载，请检查美术文件。`:'美术素材已加载 · 可以开始';uiKey='';});
  const project=(x,y,z=0)=>({x:width/2+(x-game.player.x-y+game.player.y)*scale,y:height*.56+(x-game.player.x+y-game.player.y)*scale*.5-z*scale});
  function polygon(points,fill,stroke){ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();if(fill){ctx.fillStyle=fill;ctx.fill();}if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=1;ctx.stroke();}}
  function plane(x,y,w,h,color,stroke){polygon([project(x-w/2,y-h/2),project(x+w/2,y-h/2),project(x+w/2,y+h/2),project(x-w/2,y+h/2)],color,stroke);}
  function box(o,h,top,side,front){
    const a=project(o.x-o.w/2,o.y-o.h/2),b=project(o.x+o.w/2,o.y-o.h/2),c=project(o.x+o.w/2,o.y+o.h/2),d=project(o.x-o.w/2,o.y+o.h/2);
    const lift=p=>({x:p.x,y:p.y-h*scale}),aa=lift(a),bb=lift(b),cc=lift(c),dd=lift(d);
    polygon([b,c,cc,bb],side,'#20261c');polygon([c,d,dd,cc],front,'#20261c');polygon([aa,bb,cc,dd],top,'#303729');
  }
  function label(text,x,y,color='#d6d0b8',size=12){ctx.font=`${size}px "Microsoft YaHei",sans-serif`;ctx.textAlign='center';ctx.lineWidth=3;ctx.strokeStyle='#172016';ctx.strokeText(text,x,y);ctx.fillStyle=color;ctx.fillText(text,x,y);}
  function actor(p,type){
    const q=project(p.x,p.y),hero=type==='player',visitor=type==='visitor';
    ctx.fillStyle='#10180e66';ctx.beginPath();ctx.ellipse(q.x,q.y,10,5,0,0,Math.PI*2);ctx.fill();
    if(hero){ctx.strokeStyle='#cab57099';ctx.lineWidth=1;ctx.beginPath();ctx.ellipse(q.x,q.y,14,7,0,0,Math.PI*2);ctx.stroke();}
    const spriteKey=visitor?'survivor':hero?`player_${art.direction(p.facing)}`:p.kind&&p.kind!=='normal'?`zombie_${p.kind}_${art.direction(p.facing)}${p.windup?'_windup':''}`:`zombie_${art.direction(p.facing)}`;
    const animated=hero&&playerMotion.moving&&art.animatedPlayer(ctx,playerMotion.facing||p.facing,q.x,q.y,playerMotion.phase,50);
    if(!animated&&!art.sprite(ctx,spriteKey,q.x,q.y,p.kind==='brute'?62:50)){
    ctx.strokeStyle=hero?'#c5b88c':visitor?'#8d9181':'#465344';ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(q.x-3,q.y-12);ctx.lineTo(q.x-5,q.y-2);ctx.moveTo(q.x+3,q.y-12);ctx.lineTo(q.x+5,q.y-2);ctx.stroke();
    ctx.fillStyle=hero?'#bd9f55':visitor?'#6c8790':'#79845e';ctx.fillRect(q.x-7,q.y-26,14,16);
    ctx.strokeStyle=ctx.fillStyle;ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(q.x-7,q.y-23);ctx.lineTo(q.x-12,q.y-(hero?13:21));ctx.moveTo(q.x+7,q.y-23);ctx.lineTo(q.x+12,q.y-(hero?13:21));ctx.stroke();
    ctx.fillStyle=hero?'#d0bf92':visitor?'#b5ab8c':'#a2a77f';ctx.beginPath();ctx.arc(q.x,q.y-33,6,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#3a4032';ctx.fillRect(q.x-6,q.y-38,12,4);
    }
    if(hero&&game.player.weapon!=='fists'){art.sprite(ctx,game.player.weapon,q.x+9,q.y-16,21,{width:28,flip:p.facing.x-p.facing.y<0});}
    if(hero)label(game.player.name,q.x,q.y-48,'#e4d599');
    if(visitor)label(p.recruited?'已收留':p.name,q.x,q.y-48,'#a5bec4',11);
    if(p.rootUntil>game.seconds)art.sprite(ctx,'root_marker',q.x,q.y+9,15,{width:25});
    if(p.boostUntil>game.seconds)art.sprite(ctx,'speed_buff',q.x+15,q.y-35,18);
    if(!hero&&!visitor&&p.hp<p.maxHP){ctx.fillStyle='#292519';ctx.fillRect(q.x-10,q.y-47,20,3);ctx.fillStyle='#b8775d';ctx.fillRect(q.x-10,q.y-47,20*p.hp/p.maxHP,3);}
  }
  function drawDevice(d,ghost=false){
    if(ghost){const def=D.builds[d.kind],horizontal=Math.abs(game.player.facing.x)>=Math.abs(game.player.facing.y);d={...d,w:horizontal?(def?.w||.7):(def?.h||.7),h:horizontal?(def?.h||.7):(def?.w||.7)};}
    const q=project(d.x,d.y);ctx.save();if(ghost)ctx.globalAlpha=.65;
    if(!['trap','ballista'].includes(d.kind)){
      let asset=D.builds[d.kind]?.asset;
      if(d.kind==='planter'&&d.crop)asset=`planter_${d.crop.kind}_${d.crop.dawns>=2?'mature':'seedling'}`;
      if(d.kind==='drying_rack'&&d.jobs?.length)asset='drying_rack_full';
      if(d.kind==='storage_chest'&&contextTarget?.object===d&&mode==='context')asset='storage_chest_open';
      const fence=['wood_fence','iron_fence','brick_wall'].includes(d.kind);
      if(!art.sprite(ctx,asset,q.x,q.y+4,d.kind==='spike_floor'?22:fence?37:44,{width:fence?46:d.kind==='spike_floor'?48:60,flip:fence&&d.w>d.h}))box({...d,w:d.w||.7,h:d.h||.7},.7,'#8b825e','#4e5847','#686c50');
      if(d.hp<d.maxHP)label(`${d.hp.toFixed(1)}/${d.maxHP}`,q.x,q.y-46,'#d1b080',10);
      if(d.jobs?.length&&['grill','stove'].includes(d.kind))art.sprite(ctx,'stove_fire',q.x,q.y-12,20,{width:26});
      ctx.restore();return;
    }
    const asset=d.kind==='trap'?(d.level?(d.readyAt>game.seconds?'serrated_trap_hit':'serrated_trap_open'):(d.readyAt>game.seconds?'bear_trap_hit':'bear_trap')):d.level===2?'ballista_repeating':d.level===1?'ballista_strong':'ballista';
    const drawn=art.sprite(ctx,asset,q.x,q.y+8,d.kind==='trap'?32:42,{width:d.kind==='trap'?50:52});
    if(d.kind==='trap'&&!drawn){
      plane(d.x,d.y,.8,.8,'#606657','#969b83');ctx.strokeStyle=d.readyAt>game.seconds?'#55594d':'#c5c6a8';ctx.lineWidth=3;ctx.beginPath();ctx.ellipse(q.x,q.y-4,12,6,0,0,Math.PI*2);ctx.stroke();
      for(let i=-2;i<=2;i++){ctx.beginPath();ctx.moveTo(q.x+i*4,q.y-9);ctx.lineTo(q.x+i*4+2,q.y-4);ctx.stroke();}
    }else if(d.kind!=='trap'){
      if(!drawn){
      box({x:d.x,y:d.y,w:.6,h:.6},.45,'#9a8151','#605538','#75643f');
      ctx.strokeStyle='#c4b079';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(q.x-17,q.y-17);ctx.quadraticCurveTo(q.x,q.y-30,q.x+17,q.y-17);ctx.moveTo(q.x-17,q.y-17);ctx.lineTo(q.x+17,q.y-17);ctx.moveTo(q.x,q.y-8);ctx.lineTo(q.x,q.y-30);ctx.stroke();
      }
      if(d.target||ghost){ctx.strokeStyle='#b7a05b55';ctx.lineWidth=1;ctx.beginPath();ctx.ellipse(q.x,q.y,(d.level===2?4:d.level===1?3:RULES.bowRadius)*scale*Math.SQRT2,(d.level===2?4:d.level===1?3:RULES.bowRadius)*scale/Math.SQRT2,0,0,Math.PI*2);ctx.stroke();}
      if(d.shot&&d.flashUntil>game.seconds){const end=project(d.shot.x,d.shot.y,.5);ctx.strokeStyle='#eedb83';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(q.x,q.y-22);ctx.lineTo(end.x,end.y);ctx.stroke();}
    }
    if(d.hp<d.maxHP)label(`${d.hp.toFixed(1)}/${d.maxHP}`,q.x,q.y-40,'#d1b080',10);
    if(d.flashUntil>game.seconds){ctx.strokeStyle='#e1c477';ctx.lineWidth=2;ctx.beginPath();ctx.arc(q.x,q.y-8,18,0,Math.PI*2);ctx.stroke();}
    ctx.restore();
  }
  function roof(home){
    if(art.available('house_roof')&&art.available('house_base')){art.roof(ctx,home,project);return;}
    const x=home.x,y=home.y-3;
    const a=project(x-5.2,y-3.2,2.25),b=project(x+5.2,y-3.2,2.25),c=project(x+5.2,y+3.2,2.25),d=project(x-5.2,y+3.2,2.25);
    const p=project(x-5.2,y,3.5),q=project(x+5.2,y,3.5);
    polygon([a,b,q,p],'#755146','#3a342b');polygon([p,q,c,d],'#946052','#3a342b');polygon([a,p,d],'#65483b','#3a342b');
  }
  function drawWorld(){
    ctx.clearRect(0,0,width,height);ctx.fillStyle='#4d5740';ctx.fillRect(0,0,width,height);
    const homes=game.nearbyHomes(game.player,45).filter(h=>{const p=project(h.x,h.y);return Math.abs(p.x-width/2)<width/2+480&&Math.abs(p.y-height/2)<height/2+380;});
    // 每条路划分为不重叠的平面路段；交叉口单独画，去掉素材中的凸起侧面。
    for(const home of homes){
      art.ground(ctx,'road',home.x,home.y+14,23,5,project);
      art.ground(ctx,'road',home.x+14,home.y,5,23,project,true);
      art.ground(ctx,'road',home.x+14,home.y+14,5,5,project);
      // 标线使用世界坐标，跨路段不再重复叠画素材中的路缘。
      for(let offset=-10.5;offset<=10.5;offset+=3.5){
        plane(home.x+offset,home.y+14,1.6,.14,'#b89b51');
        plane(home.x+14,home.y+offset,.14,1.6,'#b89b51');
      }
    }
    for(const home of homes){
      for(const offset of [-2.5,2.5])art.ground(ctx,'grass',home.x+offset,home.y+2,5,4,project);
      plane(home.x,home.y-3,10,6,home.kind==='house'?'#817f64':'#666969','#333d2e');

      if(home.own){plane(home.x,home.y-1,10,10,null,'#c0b072');const p=project(home.x,home.y+2.4);label('你的领地',p.x,p.y,'#cbc490',12);}
      if(home.kind!=='house'){const title=project(home.x,home.y+1);label(home.title,title.x,title.y,'#d4bd7d',13);}
      const p=project(home.x+9,home.y+9);ctx.fillStyle='#626d4880';ctx.beginPath();ctx.ellipse(p.x,p.y,18,7,0,0,Math.PI*2);ctx.fill();
    }
    const items=[];
    const indoor=homes.find(h=>game.player.indoorHome===`${h.cx},${h.cy}`);
    const roomOf=o=>homes.find(h=>Math.abs(o.x-h.x)<5&&o.y>h.y-6&&o.y<h.y);
    // 整面前墙共用一个绘制层，墙外角色也必须排在整面墙之后。
    const actorDepth=o=>{
      let depth=o.x+o.y+.2;
      for(const h of homes){
        if(Math.abs(o.x-h.x)<=5.3&&o.y>=h.y&&o.y<=h.y+4.3)depth=Math.max(depth,h.x+h.y+.06);
        else if(roomOf(o)===h)depth=Math.min(depth,h.x+h.y-.05);
      }
      return depth;
    };
    const visibleOutside=(o,draw)=>{ctx.save();if(indoor&&roomOf(o)!==indoor){ctx.beginPath();ctx.rect(-2000,-2000,width+4000,height+4000);const corners=[project(indoor.x-5,indoor.y-6),project(indoor.x+5,indoor.y-6),project(indoor.x+5,indoor.y),project(indoor.x-5,indoor.y)];corners.forEach((q,i)=>i?ctx.lineTo(q.x,q.y):ctx.moveTo(q.x,q.y));ctx.closePath();ctx.clip('evenodd');}draw();ctx.restore();};
    for(const home of homes){
      const inside=game.player.indoorHome===`${home.cx},${home.cy}`;
      items.push({depth:home.x+home.y-6,draw:()=>art.house(ctx,home,project,inside,false)});
      for(const o of home.objects){if(o.hp<=0||(o.type==='furniture'&&!inside))continue;items.push({depth:o.type==='furniture'?Math.min(o.x+o.y,home.x+home.y-.1):o.x+o.y+(o.type==='door'?.04:0),draw:()=>{
        if(o.type==='wall'){if(!art.available('house_base'))box(o,1.8,'#b9b7a4','#777d6b','#969b88');if(o.hp<o.maxHP){const q=project(o.x,o.y,1);art.sprite(ctx,'damage_stone',q.x,q.y,20,{width:24});}}
        else if(o.type==='furniture'){
          const file={'铁柜':'metal_cabinet','铁架':'metal_shelf','木桌':'wood_table','木椅':'wood_chair','木柜':'wood_cabinet'}[o.name],p=project(o.x,o.y);
          if(!art.sprite(ctx,file,p.x,p.y+4,o.name.includes('桌')?29:o.name.includes('椅')?32:45))box(o,.8,'#818876','#535f51','#687663');
        }
        else if(o.type==='fence'){
          const p=project(o.x,o.y);if(!art.sprite(ctx,'fence',p.x,p.y,37,{width:46,flip:o.w>o.h,anchorY:.82}))box(o,.7,'#808975','#465142','#5d6a53');
          if(o.hp<6){const p=project(o.x,o.y,.95);label(`${o.hp}/6`,p.x,p.y,'#d5a389',10);}
        }else if(o.type==='door'){
          const q=project(o.x,o.y),roomDoor=o===home.doors[0],key=`${roomDoor?'house_door':'yard_gate'}_${o.open?'open':'closed'}`;
          if(art.door(ctx,o,roomDoor,project))return;
          if(o.open){const q=project(o.x-o.w/2,o.y);ctx.strokeStyle='#ad9860';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(q.x,q.y);ctx.lineTo(q.x-12,q.y-24);ctx.stroke();}
          else box(o,o.y===home.y?1.6:.8,'#a59059','#625539','#88764a');
        }
      }});}
      items.push({depth:home.x+home.y+.01,draw:()=>art.house(ctx,home,project,inside,true)});
      if(!inside&&home.objects.some(o=>o.type==='wall'&&o.hp>0))items.push({depth:home.x+home.y+.02,draw:()=>roof(home)});
      for(const site of home.sites){
        if(site.hp<=0)continue;
        const outside=['stone_pile','water_point','herb_bed'].includes(site.kind);
        if(!outside&&!inside||site.searched&&!site.repeat&&site.kind==='stone_pile')continue;
        const key=site.kind==='supply'?`supply_box_${site.searched?'open':'closed'}`:site.kind==='freezer'?`freezer_${site.searched?'open':'closed'}`:site.kind==='herb_bed'?`herb_bed_${site.searched?'empty':'full'}`:site.kind==='misc'?'wood_cabinet':site.kind==='kitchen'?'stove':['repair_shop','security_room','pharmacy'].includes(site.kind)?'storage_chest_closed':site.kind;
        items.push({depth:Math.min(site.x+site.y,home.x+home.y-.1),draw:()=>{const q=project(site.x,site.y);if(!art.sprite(ctx,key,q.x,q.y,site.kind==='water_point'?45:30,{width:44}))box({...site},.4,'#8c8a69','#505948','#767e5a');}});
      }
    }
    for(const d of game.devices.filter(d=>d.hp>0&&(game.player.indoorHome||!(d.x>-5&&d.x<5&&d.y<0&&d.y>-6))))items.push({depth:roomOf(d)?Math.min(d.x+d.y,roomOf(d).x+roomOf(d).y-.1):d.x+d.y,draw:()=>drawDevice(d)});
    for(const z of game.zombies)if(z.hp>0)items.push({depth:actorDepth(z),draw:()=>visibleOutside(z,()=>actor(z,'zombie'))});
    for(const v of game.visitors)items.push({depth:actorDepth(v),draw:()=>visibleOutside(v,()=>actor(v,'visitor'))});
    for(const d of game.drops)items.push({depth:roomOf(d)?Math.min(d.x+d.y,roomOf(d).x+roomOf(d).y-.1):d.x+d.y,draw:()=>visibleOutside(d,()=>{const p=project(d.x,d.y);if(!art.sprite(ctx,d.kind,p.x,p.y+5,20,{width:25}))box({x:d.x,y:d.y,w:.35,h:.35},.18,'#a9ae9a','#4d5846','#7c7952');})});
    items.push({depth:actorDepth(game.player),draw:()=>actor(game.player,'player')});
    for(const zone of game.zones){const q=project(zone.x,zone.y);art.sprite(ctx,zone.kind,q.x,q.y,zone.radius*scale*Math.SQRT2,{width:zone.radius*scale*2*Math.SQRT2,anchorY:.5});}
    for(const effect of game.effects){const q=project(effect.x,effect.y);art.sprite(ctx,effect.kind,q.x,q.y,effect.radius?effect.radius*scale:25,{width:effect.radius?effect.radius*scale*2:35,anchorY:.5});}
    for(const shot of game.projectiles)items.push({depth:shot.x+shot.y+.3,draw:()=>{const q=project(shot.x,shot.y,.6);art.sprite(ctx,shot.kind,q.x,q.y,14,{width:20,anchorY:.5});}});
    items.sort((a,b)=>a.depth-b.depth);for(const item of items)item.draw();
    if(placement){const p=game.placementPoint(),error=game.canPlace(buildKind,p);plane(p.x,p.y,1,1,error?'#ad5b5666':'#ceb56755',error?'#d1917b':'#e5d99b');drawDevice({...p,kind:buildKind,readyAt:0},true);}
    if(nearby&&mode==='play'&&!placement){const p=project(nearby.object.x,nearby.object.y,.95);label(touch.enabled?'交互':'E',p.x,p.y-10,'#f0d88b',16);}
    const night=game.minutes>=1320&&game.minutes<1740;
    if(night){const p=project(game.player.x,game.player.y),g=ctx.createRadialGradient(p.x,p.y,80,p.x,p.y,Math.max(width,height)*.8);g.addColorStop(0,'#0a142519');g.addColorStop(1,'#07101eae');ctx.fillStyle=g;ctx.fillRect(0,0,width,height);}
    if(mode==='menu'){const p=project(0,0);label('红屋顶 · 你的第一处庇护所',p.x,p.y+50,'#d5c594');}
  }
  function showMenu(){playerMotion={moving:false,phase:0,facing:null};mode='menu';placement=false;keys.clear();touch.clear();$('run-edge').style.opacity=0;$('hurt-edge').style.opacity=0;$('menu').classList.remove('hidden');$('overlay').classList.add('hidden');for(const id of ['hud','controls','objective','interaction'])$(id).classList.add('hidden');uiKey='';updateMenu();}
  function updateMenu(){document.querySelectorAll('.menu-option').forEach((el,i)=>el.classList.toggle('selected',i===menuChoice));}
  function savedData(){try{const value=JSON.parse(localStorage.getItem(SAVE_KEY)||'null');return value?.version===1?value:null;}catch{return null;}}
  function saveGame(announce=true){
    if(mode==='menu')return false;
    try{localStorage.setItem(SAVE_KEY,JSON.stringify(game.snapshot()));$('continue-game').disabled=!!game.result;if(announce)game.announce('进度已保存到当前浏览器。');return true;}
    catch{game.announce('无法保存：浏览器存储不可用或已满。请保留本页，暂勿刷新。');return false;}
  }
  function enterGame(){
    mode='play';placement=false;playerMotion={moving:false,phase:0,facing:null};keys.clear();touch.clear();uiKey='';overlayNotice='';notifications=[];lastTime=performance.now();
    $('menu').classList.add('hidden');$('overlay').classList.add('hidden');for(const id of ['hud','controls','objective'])$(id).classList.remove('hidden');$('player-name').textContent=game.player.name;
  }
  function resumeGame(){if(!art.ready)return;try{const data=savedData();if(!data||data.result)return;game=Game.restore(data);enterGame();}catch{$('asset-status').textContent='此存档无法恢复，请保留存档并重新开始。';}}
  document.querySelectorAll('.menu-option').forEach((el,i)=>el.addEventListener('pointerenter',()=>{if(mode==='menu'){menuChoice=i;updateMenu();}}));
  function start(){
    playerMotion={moving:false,phase:0,facing:null};
    if(!art.ready)return;
    const name=$('name-input').value||'幸存者';$('name-input').blur();
    game=new Game({name:name.trim().slice(0,12)||'幸存者',startMinutes:menuChoice===1?1260:300});
    mode='play';placement=false;buildKind='trap';keys.clear();touch.clear();notifications=[];uiKey='';lastTime=performance.now();
    $('menu').classList.add('hidden');$('overlay').classList.add('hidden');for(const id of ['hud','controls','objective'])$(id).classList.remove('hidden');
    $('player-name').textContent=game.player.name;game.announce(touch.enabled?'进入屋内找家具，靠近后点交互拆除。点建造部署装置。':'进入屋内找家具，靠近按E拆除。按F开始部署装置。');
    overlayNotice='';inventoryPane='bag';contextTarget=null;game.announce('先搜索家中的补给箱；Tab里可以制作武器和建筑。E攻击朝向范围内的敌人。');saveGame(false);
  }
  function openOverlay(next){mode=next;overlayNotice='';placement=false;keys.clear();touch.clear();$('overlay').classList.remove('hidden');$('interaction').classList.add('hidden');uiKey='';renderOverlay();}
  function closeOverlay(){mode='play';keys.clear();touch.clear();$('overlay').classList.add('hidden');lastTime=performance.now();uiKey='';}
  function inventoryOverlay(){return UI.inventory(game,buildKind,inventoryPane);}
  function statsOverlay(){
    const damageNames={hunger:'饥饿',acid_pool:'酸液区',fire_pool:'燃烧区'};
    const rows=game.history.map(h=>{
      const kills=Object.entries(h.kills).map(([k,n])=>`${D.enemies[k]?.name||k}${n}`).join('、')||'无';
      const damage=Object.entries(h.damage).map(([k,n])=>`${D.enemies[k]?.name||damageNames[k]||k}${Number(n.toFixed(1))}`).join('、')||'无';
      const kinds=[...new Set([...Object.keys(h.income||{}),...Object.keys(h.spent||{})])];
      const net=kinds.map(k=>{const n=(h.income?.[k]||0)-(h.spent?.[k]||0);return `${NAMES[k]||k}${n>0?'+':''}${n}`;}).join('、')||'无';
      return `<div class="history-row"><b>第${h.day}晚</b><p>计划${h.planned} · 刷新${h.spawned} · 接近玩家10米内${h.arrived} · 建筑损失${h.lost} · 搜索${h.searches}</p><small>击败：${escapeText(kills)}<br>受伤：${escapeText(damage)}<br>食物：${escapeText(h.food.map(k=>NAMES[k]).join('、')||'无')}<br>资源净变化：${escapeText(net)}<br>累计游玩：${Math.floor(h.realSeconds/60)}分钟</small></div>`;
    }).join('');
    return `<div class="eyebrow">暂停中 · 生存记录</div><h2>每晚战况</h2>${rows||'<p>度过第一晚后会出现记录。</p>'}<div class="overlay-actions"><button data-key="escape">返回游戏</button></div>`;
  }
  function renderOverlay(){
    let html='',key=mode;
    if(mode==='inventory'){key+=game.selectedSlot+JSON.stringify(game.inventory)+buildKind+inventoryPane;html=inventoryOverlay();}
    else if(mode==='context'){key+=contextTarget?.object.id+JSON.stringify(game.inventory);html=UI.context(game,contextTarget);}
    else if(mode==='stats'){html=statsOverlay();}
    else if(mode==='pause'){html='<div class="eyebrow">已暂停</div><h2>休息一下</h2><p>点继续游戏，回到你的领地。</p><div class="overlay-actions"><button data-key="escape" class="primary">继续游戏</button><button data-command="save">保存进度</button><button data-command="stats">查看生存记录</button></div>';}
    else if(mode==='map'){html='<div class="eyebrow">暂停中 · 以玩家为中心</div><h2>附近的小区</h2><p>金色：玩家与家　｜　红色：丧尸　｜　灰色：民居 · 食/修/药/保：商店 · 灰点：石头 · 蓝点：水 · 绿点：药草</p><canvas id="map-canvas" class="map-view" width="550" height="350"></canvas><div class="overlay-actions"><button data-key="m">返回游戏</button></div>';}
    else if(mode==='dialog'){key+=dialogChoice;const choices=['3木头 → 1铁','3铁 → 1木头','收留这位幸存者','结束交谈'];html=`<div class="eyebrow">暂停中 · 来访幸存者</div><h2>交换物资，或给予庇护</h2><p>以下交换比例与来访概率是初版演示规则，等待你试玩后确定。</p>${choices.map((s,i)=>`<button data-dialog="${i}" class="dialog-option ${i===dialogChoice?'selected':''}">${escapeText(s)}</button>`).join('')}<div class="key-hint keyboard-hint">W / S 选择　·　E 确认</div>`;}
    else if(mode==='result'){key+=game.result;html=`<div class="eyebrow">第${game.day}晚 · ${game.result==='win'?'完成':'结束'}</div><h2>${game.result==='win'?'你守到了天明。':'幸存者倒下了。'}</h2><p>${game.result==='win'?'05:00到了，所有剩余丧尸已经消失。':'下次可以先搜补给箱、做武器和料理、修补受损的防线。'}</p><div class="result-number">${game.kills} <span style="font-size:16px">只丧尸被击败</span></div><p>已布置${game.devices.length}个装置，夜间出现${game.spawned}只丧尸。</p><div class="overlay-actions"><button data-key="e">返回开始画面</button></div>`;}
    if(overlayNotice)html+=`<p class="inline-notice">${escapeText(overlayNotice)}</p>`;key+=overlayNotice;
    if(key!==uiKey){$('overlay-card').innerHTML=html;uiKey=key;}
    if(mode==='context')$('overlay-card').querySelectorAll('[data-command]:not([disabled])').forEach((b,i)=>b.classList.toggle('selected',i===contextChoice));
    if(mode==='map')drawMap();
  }
  function drawMap(){const c=$('map-canvas');if(!c)return;const m=c.getContext('2d'),s=.65,cx=275,cy=175;const p=o=>({x:cx+(o.x-game.player.x)*s,y:cy+(o.y-game.player.y)*s});m.fillStyle='#1e281e';m.fillRect(0,0,550,350);for(const h of game.nearbyHomes(game.player,300)){const q=p(h);m.fillStyle=h.own?'#b7a05b':h.kind==='house'?'#63705b':'#81aabc';m.fillRect(q.x-3.25,q.y-3.9,6.5,3.9);m.strokeStyle=h.own?'#cfbd7c':'#485c43';m.strokeRect(q.x-3.25,q.y,6.5,2.6);if(h.kind!=='house'){m.fillStyle='#dfd8b7';m.font='10px sans-serif';m.fillText(({food_shop:'食',repair_shop:'修',pharmacy:'药',security_room:'保'})[h.kind],q.x+5,q.y);}for(const site of h.sites)if(['stone_pile','water_point','herb_bed'].includes(site.kind)&&(!site.searched||site.repeat)){const a=p(site);m.fillStyle=site.kind==='water_point'?'#82bfd7':site.kind==='herb_bed'?'#90bb67':'#91958e';m.fillRect(a.x,a.y,3,3);}}for(const z of game.zombies){const q=p(z);m.fillStyle='#d18673';m.beginPath();m.arc(q.x,q.y,3,0,Math.PI*2);m.fill();}m.fillStyle='#f0da91';m.beginPath();m.arc(cx,cy,5,0,Math.PI*2);m.fill();}
  function updateHUD(){
    $('run-edge').style.opacity=mode==='play'&&focused&&game.player.running?'1':'0';
    $('hurt-edge').style.opacity=mode==='play'&&game.player.hurtUntil>game.seconds?'1':'0';
    $('hp-label').textContent=`${Number(game.player.hp.toFixed(1))} / ${game.maxHP}`;$('hp-fill').style.width=`${game.player.hp/game.maxHP*100}%`;
    $('stamina-label').textContent=`${game.player.stamina.toFixed(1)} / ${game.maxStamina}`;$('stamina-fill').style.width=`${game.player.stamina/game.maxStamina*100}%`;
    $('hunger-label').textContent=`${Math.round(game.player.hunger)} / 100`;$('hunger-fill').style.width=`${game.player.hunger}%`;
    $('day-label').textContent=`第${game.day}天 · ${game.day%7===0?'尸潮夜':'生存'}`;
    $('buffs').textContent=[game.mainBuff?`${{health:'血量上限+2',stamina2:'体力上限+2',stamina4:'体力上限+4',melee:'近战+1',recovery:'恢复加快',armor:'减伤'}[game.mainBuff.type]} ${Math.ceil(game.mainBuff.until-game.seconds)}秒`:'',game.teaBuff?'茶：奔跑节省体力':'',`装备：${NAMES[game.player.weapon]||'徒手'}`].filter(Boolean).join(' · ');
    const action=game.action;document.documentElement.classList.toggle('working',!!action);$('action-progress').classList.toggle('hidden',!action);
    if(action){const names={build:'建造',craft:'制作',search:'收集',dismantle:'拆除',repair:'维修',upgrade:'改造',eat:'食用',medkit:'急救'};$('action-progress').innerHTML=`${names[action.type]} · 剩余${Math.max(0,action.duration-action.elapsed).toFixed(1)}秒<div class="bar"><i style="width:${action.elapsed/action.duration*100}%"></i></div><button data-command="cancel">取消操作</button>`;}
    const wave=game.warnedWaves[game.nextWave]&&game.nextWave<6,dir=game.waveDirections[game.nextWave];$('wave-warning').classList.toggle('hidden',!wave);$('wave-warning').innerHTML=wave?`${UI.thumb('wave_arrow')}下一批：${['东','南','西','北'][dir]}侧 · 第${game.nextWave+1}/6批`:'';
    $('resources').textContent=`铁 ${game.count('iron')}　木头 ${game.count('wood')}　击败 ${game.kills}`;
    const t=Math.floor(game.minutes)%1440;$('clock').textContent=`${String(Math.floor(t/60)).padStart(2,'0')}:${String(t%60).padStart(2,'0')}`;
    const night=game.minutes>=1320&&game.minutes<1740;$('phase').textContent=night?`夜间 · ${game.zombies.length}只丧尸在附近`:game.result?'天明':'白天 · 探索与部署';
    $('objective').innerHTML=night?'<b>活到05:00</b><br>丧尸受阻会攻击护栏。可以移动、奔跑和继续部署。':(touch.enabled?'<b>22:00前做好准备</b><br>收集材料，布置防御。普通门自动开关。':'<b>22:00前做好准备</b><br>进屋搜补给；Tab制作武器和设备。E攻击/交互。普通门自动开关。');
    let text='';
    if(!focused&&mode==='play')text='游戏已暂停，回到此窗口继续。';
    else if(mode==='play'&&placement){const error=game.canPlace(buildKind,game.placementPoint());text=`${NAMES[buildKind]} · ${error||'可放置'}　｜　E切换　F确认　Tab打开背包并取消`;}
    else if(mode==='play'&&game.action)text='正在操作，移动或受伤会中断；可点取消操作。';
    else if(mode==='play'&&nearby){const {type,object}=nearby;text=type==='furniture'?`E 拆除${object.name} → 1${NAMES[object.material]}`:type==='device'||type==='structure'?`E 管理${NAMES[object.kind]||'防线'}（维修 / 升级 / 使用）`:type==='site'?`E 搜索 / 采集（${object.time}秒）`:type==='drop'?`E 拾取${object.amount}份${NAMES[object.kind]}`:'E 与来访幸存者交谈';}
    if(!text&&mode==='play')text=`E 攻击 · ${NAMES[game.player.weapon]||'徒手'} · 朝向前方敌人`;
    if(touch.enabled)text=text.replace(/E /g,'交互：').replace('E切换　F确认　Tab打开背包并取消','点切换装置 / 确认放置；点背包取消').replace('按F','点建造');
    $('interaction').textContent=text;$('interaction').classList.toggle('hidden',!text);
    while(game.events.length){notifications.push({text:game.events.shift(),until:performance.now()+6500});}
    notifications=notifications.filter(n=>n.until>performance.now()).slice(-4);
    const next=notifications.map(n=>`<div>${escapeText(n.text)}</div>`).join('');if($('messages').innerHTML!==next)$('messages').innerHTML=next;
  }
  function chooseSlot(dx,dy){const row=Math.floor(game.selectedSlot/5),col=game.selectedSlot%5;game.selectedSlot=((row+dy+Math.ceil(game.inventory.length/5))%Math.ceil(game.inventory.length/5))*5+(col+dx+5)%5;}
  function handleKey(event){
    if(event.target instanceof HTMLInputElement){if(event.key==='Enter'){event.target.blur();if(mode==='menu')start();}return;}
    const k=event.key.toLowerCase();if(['tab',' ','arrowup','arrowdown','arrowleft','arrowright'].includes(k))event.preventDefault();
    keys.add(k);if(event.repeat)return;performAction(k);
  }
  function performAction(k){
    if(k==='escape'){if(mode==='play')openOverlay('pause');else if(['pause','inventory','map','context','stats'].includes(mode))closeOverlay();return;}
    if(mode==='menu'){if(k==='w'||k==='s'){menuChoice=1-menuChoice;updateMenu();}if(k==='e')start();return;}
    if(mode==='result'){if(k==='e'){game=new Game();showMenu();}return;}
    if(mode==='context'){const buttons=[...$('overlay-card').querySelectorAll('[data-command]:not([disabled])')];if(k==='w'||k==='s'){contextChoice=(contextChoice+(k==='w'?-1:1)+buttons.length)%Math.max(1,buttons.length);buttons[contextChoice]?.focus();}if(k==='e')buttons[contextChoice]?.click();return;}
    if(mode==='dialog'){
      if(k==='w')dialogChoice=(dialogChoice+3)%4;if(k==='s')dialogChoice=(dialogChoice+1)%4;
      if(k==='e'){
        if(dialogChoice===0)game.trade('wood','iron');if(dialogChoice===1)game.trade('iron','wood');
        if(dialogChoice===2){dialogVisitor.recruited=true;dialogVisitor.x=2;dialogVisitor.y=2;game.announce('幸存者已留在你的院子。初版中暂不参与战斗。');closeOverlay();}
        if(dialogChoice===3)closeOverlay();
      }return;
    }
    if(k==='tab'){mode==='inventory'?closeOverlay():openOverlay('inventory');return;}
    if(k==='m'){mode==='map'?closeOverlay():openOverlay('map');return;}
    if(mode==='map'||mode==='pause'||mode==='stats')return;
    if(mode==='inventory'){
      if(inventoryPane!=='bag'&&(k==='w'||k==='s'||k==='e')){const buttons=[...$('overlay-card').querySelectorAll('.recipe-card:not([disabled])')];if(k==='w'||k==='s')contextChoice=(contextChoice+(k==='w'?-1:1)+buttons.length)%Math.max(1,buttons.length);if(k==='e')buttons[contextChoice]?.click();else buttons[contextChoice]?.focus();return;}
      if(k==='w')chooseSlot(0,-1);if(k==='s')chooseSlot(0,1);if(k==='a')chooseSlot(-1,0);if(k==='d')chooseSlot(1,0);
      if(k==='e'){const slot=game.inventory[game.selectedSlot];if(slot&&game.use(slot.kind))closeOverlay();}
      if(k==='g')game.drop();
      if(k==='f'){closeOverlay();placement=true;}
      return;
    }
    if(k==='g'){game.drop();return;}
    if(k==='f'){if(!placement)placement=true;else if(game.place(buildKind,game.placementPoint()))placement=false;return;}
    if(k==='e'){
      if(placement){const kinds=Object.keys(D.builds).filter(k=>game.day>=D.builds[k].day);buildKind=kinds[(kinds.indexOf(buildKind)+1)%kinds.length];return;}
      if(game.action){game.cancelAction();return;}
      if(game.attack())return;
      const target=game.nearbyInteraction();
      if(target&&['visitor','helper','device','structure'].includes(target.type)){contextTarget=target;contextChoice=0;openOverlay('context');}
      else if(target)game.interact(target);
    }
  }
  function handleCommand(button){
    const command=button.dataset.command,kind=button.dataset.kind,o=contextTarget?.object;let ok=false,leave=false;
    if(command==='use'){const s=game.inventory[game.selectedSlot];ok=s&&game.use(s.kind);leave=ok;}
    else if(command==='fists')ok=game.equip('fists');
    else if(command==='drop')ok=game.drop();
    else if(command==='choose-build'){buildKind=kind;closeOverlay();placement=true;return;}
    else if(command==='craft'){ok=game.craft(kind);leave=ok;}
    else if(command==='cancel'){game.cancelAction();return;}
    else if(command==='save'){ok=saveGame();}
    else if(command==='stats'){openOverlay('stats');return;}
    else if(o){
      if(command==='repair')ok=game.repair(o),leave=ok;
      if(command==='upgrade')ok=game.upgrade(o),leave=ok;
      if(command==='dismantle')ok=game.dismantle(o),leave=ok;
      if(command==='fuel')ok=game.fuel(o);
      if(command==='produce')ok=game.startProduction(o,kind);
      if(command==='cancel-job')ok=game.cancelProduction(o);
      if(command==='take-output')ok=game.takeOutput(o);
      if(command==='plant')ok=game.plant(o,kind);
      if(command==='harvest')ok=game.harvest(o);
      if(command==='store'||command==='retrieve')ok=game.transfer(o,Number(button.dataset.index),command==='store');
      if(command==='trade')ok=game.tradeOffer(o,Number(button.dataset.index));
      if(command==='recruit')ok=game.recruit(o);
      if(command==='helper-collect')ok=game.collectHelper();
      if(command==='helper-food'){game.helper.food=kind;ok=true;}
    }
    if(leave){closeOverlay();return;}
    overlayNotice=ok?'操作完成。':game.events.at(-1)||'条件不足或空间不够，未完成操作。';uiKey='';
  }
  $('start-game').addEventListener('click',start);
  $('continue-game').addEventListener('click',resumeGame);
  art.loading.then(()=>{$('continue-game').disabled=!savedData()||!!savedData()?.result;});
  $('action-progress').addEventListener('pointerdown',event=>{if(event.target.closest('[data-command="cancel"]')){event.preventDefault();game.cancelAction();}});
  $('touch-toggle').addEventListener('click',resize);
  document.querySelectorAll('.menu-option').forEach((el,i)=>{el.tabIndex=0;el.setAttribute('role','button');el.addEventListener('click',()=>{menuChoice=i;updateMenu();});});
  $('touch-controls').addEventListener('click',event=>{const button=event.target.closest('[data-key]');if(button)performAction(button.dataset.key);});
  $('overlay-card').addEventListener('click',event=>{
    const button=event.target.closest('button');if(!button)return;
    if(button.dataset.slot!==undefined){game.selectedSlot=Number(button.dataset.slot);uiKey='';}
    else if(button.dataset.pane){inventoryPane=button.dataset.pane;contextChoice=0;overlayNotice='';uiKey='';}
    else if(button.dataset.command){handleCommand(button);}
    else if(button.dataset.recipe){buildKind=button.dataset.recipe;uiKey='';}
    else if(button.dataset.dialog!==undefined){dialogChoice=Number(button.dataset.dialog);performAction('e');}
    else if(button.dataset.key)performAction(button.dataset.key);
  });
  addEventListener('keydown',handleKey);addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));
  addEventListener('blur',()=>{focused=false;keys.clear();touch.clear();});addEventListener('focus',()=>{focused=true;lastTime=performance.now();});
  document.addEventListener('visibilitychange',()=>{keys.clear();touch.clear();lastTime=performance.now();if(document.hidden)saveGame(false);});
  addEventListener('pagehide',()=>saveGame(false));
  canvas.addEventListener('pointerdown',event=>{
    if(touch.enabled||mode!=='play'||game.player.running)return;
    const sx=(event.clientX-width/2)/scale,sy=(event.clientY-height*.56)/scale;
    const x=(sx+2*sy)/2,y=(2*sy-sx)/2,n=Math.hypot(x,y);if(n)game.player.facing={x:x/n,y:y/n};
  });
  function frame(now){
    const dt=Math.min((now-lastTime)/1000,.05);lastTime=now;
    if(mode==='play'&&focused&&!document.hidden){
      const before={x:game.player.x,y:game.player.y};
      game.step(dt,{up:keys.has('w'),down:keys.has('s'),left:keys.has('a'),right:keys.has('d'),run:keys.has('shift')||touch.input.run,moveX:touch.input.moveX,moveY:touch.input.moveY});
      const moved=dist(before,game.player),moving=moved>1e-7;
      if(moving){
        if(!playerMotion.moving)playerMotion.phase=0;
        playerMotion.phase=(playerMotion.phase+moved/(window.PLAYER_ANIMATION?.metersPerFrame||.4))%4;
        playerMotion.facing={x:(game.player.x-before.x)/moved,y:(game.player.y-before.y)/moved};
      }else playerMotion.phase=0;
      playerMotion.moving=moving;
      if(game.result)openOverlay('result');
    }
    touch.setContext(mode,placement);
    nearby=mode==='play'&&!placement?game.nearbyInteraction():null;
    if(game.autosaveRequested){game.autosaveRequested=false;saveGame(false);}
    drawWorld();if(mode!=='menu')updateHUD();if(['inventory','map','dialog','result','pause','context','stats'].includes(mode))renderOverlay();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
