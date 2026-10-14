/* 画面、键盘和界面。实际规则集中在 simulation.js。 */
(() => {
  'use strict';
  const {Game,RULES,NAMES,dist}=Survival;
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
  art.loading.then(()=>{$('start-game').disabled=false;$('start-game').textContent='开始游戏';$('asset-status').textContent=art.failed.length?`${art.failed.length}个素材未能加载，请检查美术文件。`:'美术素材已加载 · 可以开始';uiKey='';});
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
    const spriteKey=visitor?'survivor':`${hero?'player':'zombie'}_${art.direction(p.facing)}`;
    const animated=hero&&playerMotion.moving&&art.animatedPlayer(ctx,playerMotion.facing||p.facing,q.x,q.y,playerMotion.phase,50);
    if(!animated&&!art.sprite(ctx,spriteKey,q.x,q.y,50)){
    ctx.strokeStyle=hero?'#c5b88c':visitor?'#8d9181':'#465344';ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(q.x-3,q.y-12);ctx.lineTo(q.x-5,q.y-2);ctx.moveTo(q.x+3,q.y-12);ctx.lineTo(q.x+5,q.y-2);ctx.stroke();
    ctx.fillStyle=hero?'#bd9f55':visitor?'#6c8790':'#79845e';ctx.fillRect(q.x-7,q.y-26,14,16);
    ctx.strokeStyle=ctx.fillStyle;ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(q.x-7,q.y-23);ctx.lineTo(q.x-12,q.y-(hero?13:21));ctx.moveTo(q.x+7,q.y-23);ctx.lineTo(q.x+12,q.y-(hero?13:21));ctx.stroke();
    ctx.fillStyle=hero?'#d0bf92':visitor?'#b5ab8c':'#a2a77f';ctx.beginPath();ctx.arc(q.x,q.y-33,6,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#3a4032';ctx.fillRect(q.x-6,q.y-38,12,4);
    }
    if(hero)label(game.player.name,q.x,q.y-48,'#e4d599');
    if(visitor)label(p.recruited?'已收留':p.name,q.x,q.y-48,'#a5bec4',11);
    if(!hero&&!visitor&&p.hp<3){ctx.fillStyle='#292519';ctx.fillRect(q.x-10,q.y-47,20,3);ctx.fillStyle='#b8775d';ctx.fillRect(q.x-10,q.y-47,20*p.hp/3,3);}
  }
  function drawDevice(d,ghost=false){
    const q=project(d.x,d.y);ctx.save();if(ghost)ctx.globalAlpha=.65;
    const asset=d.kind==='trap'?(d.readyAt>game.seconds?'bear_trap_hit':'bear_trap'):'ballista';
    const drawn=art.sprite(ctx,asset,q.x,q.y+8,d.kind==='trap'?32:42,{width:d.kind==='trap'?50:52});
    if(d.kind==='trap'&&!drawn){
      plane(d.x,d.y,.8,.8,'#606657','#969b83');ctx.strokeStyle=d.readyAt>game.seconds?'#55594d':'#c5c6a8';ctx.lineWidth=3;ctx.beginPath();ctx.ellipse(q.x,q.y-4,12,6,0,0,Math.PI*2);ctx.stroke();
      for(let i=-2;i<=2;i++){ctx.beginPath();ctx.moveTo(q.x+i*4,q.y-9);ctx.lineTo(q.x+i*4+2,q.y-4);ctx.stroke();}
    }else if(d.kind!=='trap'){
      if(!drawn){
      box({x:d.x,y:d.y,w:.6,h:.6},.45,'#9a8151','#605538','#75643f');
      ctx.strokeStyle='#c4b079';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(q.x-17,q.y-17);ctx.quadraticCurveTo(q.x,q.y-30,q.x+17,q.y-17);ctx.moveTo(q.x-17,q.y-17);ctx.lineTo(q.x+17,q.y-17);ctx.moveTo(q.x,q.y-8);ctx.lineTo(q.x,q.y-30);ctx.stroke();
      }
      if(d.target||ghost){ctx.strokeStyle='#b7a05b55';ctx.lineWidth=1;ctx.beginPath();ctx.ellipse(q.x,q.y,RULES.bowRadius*scale*Math.SQRT2,RULES.bowRadius*scale/Math.SQRT2,0,0,Math.PI*2);ctx.stroke();}
      if(d.shot&&d.flashUntil>game.seconds){const end=project(d.shot.x,d.shot.y,.5);ctx.strokeStyle='#eedb83';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(q.x,q.y-22);ctx.lineTo(end.x,end.y);ctx.stroke();}
    }
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
      plane(home.x,home.y-3,10,6,'#817f64','#333d2e');

      if(home.own){plane(home.x,home.y-1,10,10,null,'#c0b072');const p=project(home.x,home.y+2.4);label('你的领地',p.x,p.y,'#cbc490',12);}
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
        if(o.type==='wall'){if(!art.available('house_base'))box(o,1.8,'#b9b7a4','#777d6b','#969b88');}
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
      if(!inside)items.push({depth:home.x+home.y+.02,draw:()=>roof(home)});
    }
    for(const d of game.devices)items.push({depth:d.x+d.y,draw:()=>drawDevice(d)});
    for(const z of game.zombies)if(z.hp>0)items.push({depth:actorDepth(z),draw:()=>visibleOutside(z,()=>actor(z,'zombie'))});
    for(const v of game.visitors)items.push({depth:actorDepth(v),draw:()=>visibleOutside(v,()=>actor(v,'visitor'))});
    for(const d of game.drops)items.push({depth:d.x+d.y,draw:()=>visibleOutside(d,()=>{const p=project(d.x,d.y);if(!art.sprite(ctx,d.kind,p.x,p.y+5,20,{width:25}))box({x:d.x,y:d.y,w:.35,h:.35},.18,'#a9ae9a','#4d5846','#7c7952');})});
    items.push({depth:actorDepth(game.player),draw:()=>actor(game.player,'player')});
    items.sort((a,b)=>a.depth-b.depth);for(const item of items)item.draw();
    if(placement){const p=game.placementPoint(),error=game.canPlace(buildKind,p);plane(p.x,p.y,1,1,error?'#ad5b5666':'#ceb56755',error?'#d1917b':'#e5d99b');drawDevice({...p,kind:buildKind,readyAt:0},true);}
    if(nearby&&mode==='play'&&!placement){const p=project(nearby.object.x,nearby.object.y,.95);label(touch.enabled?'交互':'E',p.x,p.y-10,'#f0d88b',16);}
    const night=game.minutes>=1320&&game.minutes<1740;
    if(night){const p=project(game.player.x,game.player.y),g=ctx.createRadialGradient(p.x,p.y,80,p.x,p.y,Math.max(width,height)*.8);g.addColorStop(0,'#0a142519');g.addColorStop(1,'#07101eae');ctx.fillStyle=g;ctx.fillRect(0,0,width,height);}
    if(mode==='menu'){const p=project(0,0);label('红屋顶 · 你的第一处庇护所',p.x,p.y+50,'#d5c594');}
  }
  function showMenu(){playerMotion={moving:false,phase:0,facing:null};mode='menu';placement=false;keys.clear();touch.clear();$('run-edge').style.opacity=0;$('hurt-edge').style.opacity=0;$('menu').classList.remove('hidden');$('overlay').classList.add('hidden');for(const id of ['hud','controls','objective','interaction'])$(id).classList.add('hidden');uiKey='';updateMenu();}
  function updateMenu(){document.querySelectorAll('.menu-option').forEach((el,i)=>el.classList.toggle('selected',i===menuChoice));}
  document.querySelectorAll('.menu-option').forEach((el,i)=>el.addEventListener('pointerenter',()=>{if(mode==='menu'){menuChoice=i;updateMenu();}}));
  function start(){
    playerMotion={moving:false,phase:0,facing:null};
    if(!art.ready)return;
    const name=$('name-input').value||'幸存者';$('name-input').blur();
    game=new Game({name:name.trim().slice(0,12)||'幸存者',startMinutes:menuChoice===1?1260:300});
    mode='play';placement=false;buildKind='trap';keys.clear();touch.clear();notifications=[];uiKey='';lastTime=performance.now();
    $('menu').classList.add('hidden');$('overlay').classList.add('hidden');for(const id of ['hud','controls','objective'])$(id).classList.remove('hidden');
    $('player-name').textContent=game.player.name;game.announce(touch.enabled?'进入屋内找家具，靠近后点交互拆除。点建造部署装置。':'进入屋内找家具，靠近按E拆除。按F开始部署装置。');
  }
  function openOverlay(next){mode=next;placement=false;keys.clear();touch.clear();$('overlay').classList.remove('hidden');$('interaction').classList.add('hidden');uiKey='';renderOverlay();}
  function closeOverlay(){mode='play';keys.clear();touch.clear();$('overlay').classList.add('hidden');lastTime=performance.now();uiKey='';}
  function inventoryOverlay(){
    const thumb=(key,cls='')=>`<div class="item-thumb ${cls}" style="background-image:url('${art.entries[key].src}')"></div>`;
    return `<div class="eyebrow">暂停中 · 20格背包</div><h2>随身物资</h2><p>${touch.enabled?'点选物品格或装置，再点部署。':'WASD选择格子，E选择材料；F用该材料部署装置。'}</p><div class="inventory-grid">${game.inventory.map((s,i)=>`<button type="button" data-slot="${i}" class="slot ${i===game.selectedSlot?'selected':''}">${s?thumb(s.kind):''}<div>${s?`${NAMES[s.kind]} × ${s.amount}`:'空'}</div><span>${String(i+1).padStart(2,'0')}</span></button>`).join('')}</div><div class="recipe"><button type="button" data-recipe="trap" class="recipe-item">${thumb('bear_trap')}<span>捕兽夹：3铁</span></button><button type="button" data-recipe="ballista" class="recipe-item">${thumb('ballista')}<span>巨弩：5木头</span></button>当前部署：${NAMES[buildKind]}；巨弩攻击面积9平方米（圆形）。</div><div class="overlay-actions"><button data-key="g">丢弃一份</button><button data-key="f" class="primary">部署装置</button><button data-key="tab">返回游戏</button></div><div class="key-hint keyboard-hint">E 选择　·　G 丢弃　·　F 部署　·　Tab 返回</div>`;
  }
  function renderOverlay(){
    let html='',key=mode;
    if(mode==='inventory'){key+=game.selectedSlot+JSON.stringify(game.inventory)+buildKind;html=inventoryOverlay();}
    else if(mode==='pause'){html='<div class="eyebrow">已暂停</div><h2>休息一下</h2><p>点继续游戏，回到你的领地。</p><div class="overlay-actions"><button data-key="escape" class="primary">继续游戏</button></div>';}
    else if(mode==='map'){html='<div class="eyebrow">暂停中 · 以玩家为中心</div><h2>附近的小区</h2><p>金色：玩家与家　｜　红色：丧尸　｜　灰色：邻居房屋</p><canvas id="map-canvas" class="map-view" width="550" height="350"></canvas><div class="overlay-actions"><button data-key="m">返回游戏</button></div>';}
    else if(mode==='dialog'){key+=dialogChoice;const choices=['3木头 → 1铁','3铁 → 1木头','收留这位幸存者','结束交谈'];html=`<div class="eyebrow">暂停中 · 来访幸存者</div><h2>交换物资，或给予庇护</h2><p>以下交换比例与来访概率是初版演示规则，等待你试玩后确定。</p>${choices.map((s,i)=>`<button data-dialog="${i}" class="dialog-option ${i===dialogChoice?'selected':''}">${escapeText(s)}</button>`).join('')}<div class="key-hint keyboard-hint">W / S 选择　·　E 确认</div>`;}
    else if(mode==='result'){key+=game.result;html=`<div class="eyebrow">第一晚 · ${game.result==='win'?'完成':'结束'}</div><h2>${game.result==='win'?'你守到了天明。':'幸存者倒下了。'}</h2><p>${game.result==='win'?'05:00到了，所有剩余丧尸已经消失。':'下一次可以改变陷阱位置，也可以利用院门与房屋安排路线。'}</p><div class="result-number">${game.kills} <span style="font-size:16px">只丧尸被击败</span></div><p>已布置${game.devices.length}个装置，夜间出现${game.spawned}只丧尸。</p><div class="overlay-actions"><button data-key="e">返回开始画面</button></div>`;}
    if(key!==uiKey){$('overlay-card').innerHTML=html;uiKey=key;}
    if(mode==='map')drawMap();
  }
  function drawMap(){const c=$('map-canvas');if(!c)return;const m=c.getContext('2d'),s=2.5,cx=275,cy=175;const p=o=>({x:cx+(o.x-game.player.x)*s,y:cy+(o.y-game.player.y)*s});m.fillStyle='#1e281e';m.fillRect(0,0,550,350);for(const h of game.nearbyHomes(game.player,90)){const q=p(h);m.fillStyle=h.own?'#b7a05b':'#63705b';m.fillRect(q.x-12.5,q.y-15,25,15);m.strokeStyle=h.own?'#cfbd7c':'#485c43';m.strokeRect(q.x-12.5,q.y,25,10);}for(const z of game.zombies){const q=p(z);m.fillStyle='#d18673';m.beginPath();m.arc(q.x,q.y,3,0,Math.PI*2);m.fill();}m.fillStyle='#f0da91';m.beginPath();m.arc(cx,cy,5,0,Math.PI*2);m.fill();}
  function updateHUD(){
    $('run-edge').style.opacity=mode==='play'&&focused&&game.player.running?'1':'0';
    $('hurt-edge').style.opacity=mode==='play'&&game.player.hurtUntil>game.seconds?'1':'0';
    $('hp-label').textContent=`${game.player.hp} / 12`;$('hp-fill').style.width=`${game.player.hp/12*100}%`;
    $('stamina-label').textContent=`${game.player.stamina.toFixed(1)} / 10`;$('stamina-fill').style.width=`${game.player.stamina/10*100}%`;
    $('resources').textContent=`铁 ${game.count('iron')}　木头 ${game.count('wood')}　击败 ${game.kills}`;
    const t=Math.floor(game.minutes)%1440;$('clock').textContent=`${String(Math.floor(t/60)).padStart(2,'0')}:${String(t%60).padStart(2,'0')}`;
    const night=game.minutes>=1320&&game.minutes<1740;$('phase').textContent=night?`夜间 · ${game.zombies.length}只丧尸在附近`:game.result?'天明':'白天 · 探索与部署';
    $('objective').innerHTML=night?'<b>活到05:00</b><br>丧尸受阻会攻击护栏。可以移动、奔跑和继续部署。':(touch.enabled?'<b>22:00前做好准备</b><br>收集材料，布置防御。普通门自动开关。':'<b>22:00前做好准备</b><br>进屋拆家具；Tab查看材料，F布置防御。普通门自动开关。');
    let text='';
    if(!focused&&mode==='play')text='游戏已暂停，回到此窗口继续。';
    else if(mode==='play'&&placement){const error=game.canPlace(buildKind,game.placementPoint());text=`${NAMES[buildKind]} · ${error||'可放置'}　｜　E切换　F确认　Tab打开背包并取消`;}
    else if(mode==='play'&&nearby){const {type,object}=nearby;text=type==='furniture'?`E 拆除${object.name} → 1${NAMES[object.material]}`:type==='device'?`E 拆除${NAMES[object.kind]} → 返还${object.kind==='trap'?'3铁':'5木头'}`:type==='drop'?`E 拾取${object.amount}份${NAMES[object.kind]}`:'E 与来访幸存者交谈';}
    if(touch.enabled)text=text.replace(/E /g,'交互：').replace('E切换　F确认　Tab打开背包并取消','点切换装置 / 确认放置；点背包取消').replace('按F','点建造');
    $('interaction').textContent=text;$('interaction').classList.toggle('hidden',!text);
    while(game.events.length){notifications.push({text:game.events.shift(),until:performance.now()+6500});}
    notifications=notifications.filter(n=>n.until>performance.now()).slice(-4);
    const next=notifications.map(n=>`<div>${escapeText(n.text)}</div>`).join('');if($('messages').innerHTML!==next)$('messages').innerHTML=next;
  }
  function chooseSlot(dx,dy){const row=Math.floor(game.selectedSlot/5),col=game.selectedSlot%5;game.selectedSlot=((row+dy+4)%4)*5+(col+dx+5)%5;}
  function handleKey(event){
    if(event.target instanceof HTMLInputElement){if(event.key==='Enter'){event.target.blur();if(mode==='menu')start();}return;}
    const k=event.key.toLowerCase();if(['tab',' ','arrowup','arrowdown','arrowleft','arrowright'].includes(k))event.preventDefault();
    keys.add(k);if(event.repeat)return;performAction(k);
  }
  function performAction(k){
    if(k==='escape'){if(mode==='play')openOverlay('pause');else if(['pause','inventory','map'].includes(mode))closeOverlay();return;}
    if(mode==='menu'){if(k==='w'||k==='s'){menuChoice=1-menuChoice;updateMenu();}if(k==='e')start();return;}
    if(mode==='result'){if(k==='e'){game=new Game();showMenu();}return;}
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
    if(mode==='map'||mode==='pause')return;
    if(mode==='inventory'){
      if(k==='w')chooseSlot(0,-1);if(k==='s')chooseSlot(0,1);if(k==='a')chooseSlot(-1,0);if(k==='d')chooseSlot(1,0);
      if(k==='e'){const slot=game.inventory[game.selectedSlot];if(slot)buildKind=slot.kind==='iron'?'trap':'ballista';}
      if(k==='g')game.drop();
      if(k==='f'){closeOverlay();placement=true;}
      return;
    }
    if(k==='g'){game.drop();return;}
    if(k==='f'){if(!placement)placement=true;else if(game.place(buildKind,game.placementPoint()))placement=false;return;}
    if(k==='e'){
      if(placement){buildKind=buildKind==='trap'?'ballista':'trap';return;}
      const target=game.nearbyInteraction();
      if(target?.type==='visitor'){dialogVisitor=target.object;dialogChoice=0;openOverlay('dialog');}
      else if(target)game.interact(target);
    }
  }
  $('start-game').addEventListener('click',start);
  $('touch-toggle').addEventListener('click',resize);
  document.querySelectorAll('.menu-option').forEach((el,i)=>{el.tabIndex=0;el.setAttribute('role','button');el.addEventListener('click',()=>{menuChoice=i;updateMenu();});});
  $('touch-controls').addEventListener('click',event=>{const button=event.target.closest('[data-key]');if(button)performAction(button.dataset.key);});
  $('overlay-card').addEventListener('click',event=>{
    const button=event.target.closest('button');if(!button)return;
    if(button.dataset.slot!==undefined){game.selectedSlot=Number(button.dataset.slot);performAction('e');}
    else if(button.dataset.recipe){buildKind=button.dataset.recipe;uiKey='';}
    else if(button.dataset.dialog!==undefined){dialogChoice=Number(button.dataset.dialog);performAction('e');}
    else if(button.dataset.key)performAction(button.dataset.key);
  });
  addEventListener('keydown',handleKey);addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));
  addEventListener('blur',()=>{focused=false;keys.clear();touch.clear();});addEventListener('focus',()=>{focused=true;lastTime=performance.now();});
  document.addEventListener('visibilitychange',()=>{keys.clear();touch.clear();lastTime=performance.now();});
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
    drawWorld();if(mode!=='menu')updateHUD();if(['inventory','map','dialog','result','pause'].includes(mode))renderOverlay();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
