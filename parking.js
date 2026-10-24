/* Parking scene and portable-item state. Gameplay art is integrated separately. */
(function(root){
  'use strict';
  const common=typeof module!=='undefined'&&module.exports;
  const P=common?require('./parking-data.js'):root.ParkingData;
  const S=common?require('./expansion.js'):root.Survival,D=S.Expansion,Base=S.Game;
  const {dist,pointRect,segmentHits,screenDirection}=S,copy=x=>JSON.parse(JSON.stringify(x));
  const key=p=>`${Math.round(p.x)},${Math.round(p.y)}`;
  const sceneKeys=['seconds','minutes','devices','zombies','drops','visitors','projectiles','zones','effects','spawned','deviceId','acidTime','fireTime'];
  const actionNames={travel:'切换场景',parking_search:'搜索',parking_open:'开启宝箱',parking_gate:'安装保险丝',lamp:'操作灯具',lamp_throw:'投掷灯具'};
  Object.entries(P.enemies).forEach(([k,d])=>S.NAMES[k]=d.name);
  class ParkingGame extends Base{
    constructor(options={}){
      super(options);this.scene='surface';this.parking=null;this.surfaceState=null;this.heldLightId=null;this.headLightId=null;this.lampSerial=0;
      this.skill={unlocked:false,active:false,until:0,cooldown:0};this.weaknessUntil=0;this.lampThrowAt=0;
      this.parkingUnlockPending=false;
    }
    dawn(){const previous=this.day;super.dawn();if(previous===14&&this.day===15&&!this.parking)this.parkingUnlockPending=true;}
    ensureParking(){
      if(this.day<15||this.scene==='parking')return;
      const spacing=S.RULES.lotSpacing,road=v=>Math.round((v-14)/spacing)*spacing+14,axis=p=>Math.abs(p.x-road(p.x))<=Math.abs(p.y-road(p.y))?'y':'x';
      if(this.parking){if(!this.parking.entrance.axis){this.parking.entrance.axis=axis(this.parking.entrance);this.parking.layoutVersion=4;this.parking.introSeen=true;this.autosaveRequested=true;}return;}
      this.parkingUnlockPending=true;
      const territory={x:0,y:-1,w:10,h:10},now=()=>root.performance?.now?.()??Date.now(),deadline=now()+4;
      const job=this._parkingPlacement||(this._parkingPlacement={queue:[{x:0,y:5}],seen:new Set(['0,5']),cursor:0,pool:null});
      // Explore reachable ground in small slices; openable doors do not make a
      // neighbourhood permanently unreachable while the camera is elsewhere.
      let budget=384;
      while(!job.pool&&job.cursor<job.queue.length&&budget-->0&&now()<deadline){
        const p=job.queue[job.cursor++];
        for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const n={x:p.x+dx,y:p.y+dy},k=key(n);if(job.seen.has(k)||pointRect(n,territory)>75)continue;job.seen.add(k);if(!super.obstacles(p,n,.24).some(o=>o.type!=='door'))job.queue.push(n);}
      }
      if(!job.pool&&job.cursor>=job.queue.length)job.pool=job.queue.slice();
      if(!job.pool)return;
      const overlap=(a,b)=>Math.abs(a.x-b.x)<(a.w+(b.w||.7))/2&&Math.abs(a.y-b.y)<(a.h+(b.h||.7))/2;
      let entrance=null,toolbox=null;budget=48;
      while(job.pool.length&&budget-->0&&now()<deadline){
        const i=Math.floor(this.random()*job.pool.length),p={...job.pool[i]};job.pool[i]=job.pool[job.pool.length-1];job.pool.pop();p.axis=axis(p);
        if(p.axis==='y'&&Math.abs(p.x-road(p.x))<=2.5)p.x=road(p.x);else if(p.axis==='x'&&Math.abs(p.y-road(p.y))<=2.5)p.y=road(p.y);
        if(pointRect(p,territory)<=0||pointRect(p,territory)>75||dist(p,this.player)<5)continue;
        const box=p.axis==='y'?{x:p.x,y:p.y-3,w:5.8,h:6.8}:{x:p.x-3,y:p.y,w:6.8,h:5.8};
        if(overlap(box,territory)||overlap(box,{...this.player,w:1,h:1}))continue;
        if(this.nearbyHomes(box,8).some(h=>overlap(box,{x:h.x,y:h.y-3,w:12,h:8})||[...h.objects,...h.sites].some(o=>o.hp>0&&overlap(box,o)))||this.devices.some(o=>o.hp>0&&overlap(box,o)))continue;
        const offRoad=q=>Math.abs(q.x-road(q.x))>3.15&&Math.abs(q.y-road(q.y))>3.15;
        const site=[[4,0],[-4,0],[0,4],[0,-4],[3,3],[-3,3],[3,-3],[-3,-3]].map(([x,y])=>({x:p.x+x,y:p.y+y})).find(q=>offRoad(q)&&!overlap(box,{...q,w:.7,h:.7})&&!super.obstacles(q,q,.5).length&&super.clearLine(p,q));
        if(site){entrance=p;toolbox=site;break;}
      }
      if(!entrance){if(job.pool.length)return;this._parkingPlacement=null;this.parkingUnlockPending=false;this._entryRetry=this.seconds+10;this.announce('领地75米内没有可达且足够宽的入口位置，请清理附近通路。');return;}
      this._parkingPlacement=null;
      this.parking={layoutVersion:4,introSeen:false,entrance:{...entrance,id:'parking:entrance',type:'parking',kind:'entrance',hp:1},toolbox:{...toolbox,id:'parking:toolbox',type:'parking',kind:'toolbox',hp:1,opened:false,loot:{torch:2,cloth:1}},elapsed:0,nextBatch:1,pending:[],planned:0,generated:0,explored:[],layer:null,state:null};
      this.autosaveRequested=true;this.announce('地下传来震动……领地75米内出现停车场入口。');
    }
    createLayer(){
      const layer={objects:[],cars:[],points:[],gateOpen:false,bossDead:false,nextUnlocked:false,chest:null};
      const solid=(id,x,y,w,h,kind)=>layer.objects.push({id,type:'parking_solid',kind,x,y,w,h,hp:1,indestructible:true});
      solid('parking:left',-24,30,.5,60,'wall');solid('parking:right',24,30,.5,60,'wall');solid('parking:front',0,0,48,.5,'wall');solid('parking:back',0,60,48,.5,'wall');
      // A side enclosure holds exactly two existing vehicles; the Boss remains reachable.
      solid('parking:store-left',11,51,.35,18,'wall');solid('parking:store-top',17.5,42,13,.35,'wall');
      solid('parking:store-front-left',12.5,57,3,.35,'wall');solid('parking:store-front-right',21,57,6,.35,'wall');
      solid('parking:gate',16,57,4,.35,'fuse_gate');
      for(const y of [18,28,38,52])for(const x of [-9,9])solid(`parking:column:${x},${y}`,x,y,.8,.8,'column');
      const kinds=[...Array(16).fill('civilian'),...Array(4).fill('repair'),...Array(2).fill('supply'),...Array(2).fill('security')];
      const positions=[];for(const y of [12,22,32,48])for(const x of [-19,-12,-5,4,12,19])positions.push({x,y});
      // Supply #21 and security #23 are the only cars in the locked enclosure.
      const order=[...Array.from({length:20},(_,i)=>i),20,22,21,23];
      for(let i=0;i<24;i++){
        const vehicle=kinds[i],p={...positions[order[i]]},id=`parking:car:${i}`;if(i===21)p.x=14.5;if(i===23)p.x=20.5;
        const loot=vehicle==='civilian'?{iron:2,scrap:1}:vehicle==='repair'?{iron:3,scrap:2,parts:1,wire:1}:vehicle==='supply'?{canned_food:3,clean_water:3,cloth:2,battery:1}:{iron:2,battery:1,wire:1};
        if(vehicle==='civilian'){const r=this.random();loot[r<.4?'cloth':r<.7?'canned_food':'clean_water']=1;}
        if(vehicle==='security'){const bolts=this.random()<.5;loot[bolts?'bolt':'shotgun_shell']=bolts?6:4;}
        if(i===19)loot.fuse=1;
        const car={...p,id,type:'parking_solid',kind:'car',vehicle,w:2.4,h:4.2,hp:1,indestructible:true};layer.cars.push(car);layer.objects.push(car);
        layer.points.push({id:id+':cargo',type:'parking',kind:'cargo',carId:id,x:p.x-1.7,y:p.y,hp:1,opened:false,loot,time:4});
        if([0,3,6,9,12,15,17,19].includes(i))layer.points.push({id:id+':tank',type:'parking',kind:'tank',carId:id,x:p.x+1.7,y:p.y,hp:1,opened:false,loot:{fuel_oil:2},time:6});
      }
      layer.points.push({id:'parking:exit',type:'parking',kind:'exit',...P.exit,hp:1},{id:'parking:gate-control',type:'parking',kind:'gate_control',x:16,y:58.4,hp:1},{id:'parking:next',type:'parking',kind:'next_floor',x:-16,y:57,hp:1});
      this.parking.layer=layer;
      this.normalizeParkingCargo();
    }
    normalizeParkingCargo(){
      const layer=this.parking?.layer;if(!layer)return;
      for(const o of layer.points)if(o.kind==='cargo'){const car=layer.objects.find(c=>c.id===o.carId);if(car)Object.assign(o,{x:car.x,y:car.y,w:car.w,h:car.h});}
    }
    parkingAccess(o){
      const car=o.kind==='cargo'&&this.parking?.layer?.objects.find(c=>c.id===o.carId);
      if(!car)return {distance:dist(this.player,o),point:o,ignore:o};
      return {distance:pointRect(this.player,car),point:{x:Math.max(car.x-car.w/2,Math.min(car.x+car.w/2,this.player.x)),y:Math.max(car.y-car.h/2,Math.min(car.y+car.h/2,this.player.y))},ignore:car};
    }
    captureScene(){return Object.fromEntries(sceneKeys.map(k=>[k,this[k]]));}
    shiftPersonalClock(delta){
      if(this.playerLampVisual)this.playerLampVisual.until+=delta;
      if(this.playerSkillVisual)this.playerSkillVisual.until+=delta;
      for(const k of ['attackAt','foodAt','waterAt','throwAt','nextRecoveryAt','lastSpent','lastRecoveryAt','weaknessUntil','lampThrowAt'])if(Number.isFinite(this[k]))this[k]+=delta;
      for(const k of ['hurtUntil','invulnerableUntil'])if(Number.isFinite(this.player[k]))this.player[k]+=delta;
      for(const b of [this.mainBuff,this.teaBuff])if(b)b.until+=delta;
      for(const b of [this.foodRegen,this.bandage])if(b)b.next+=delta;
      this.skill.until+=delta;this.skill.cooldown+=delta;if(Number.isFinite(this.skill.startedAt))this.skill.startedAt+=delta;
      for(const s of this.inventory)if(s?.lampId&&Number.isFinite(s.lastToggle))s.lastToggle+=delta;
    }
    switchScene(){
      this.endStealth();this.playerAttack=null;this.playerLampVisual=null;this.playerSkillVisual=null;this.player.indoorHome=null;this.player.running=false;
      if(this.scene==='surface'){
        this.surfaceState={...this.captureScene(),position:{x:this.player.x,y:this.player.y}};
        if(!this.parking.layer)this.createLayer();
        const state=this.parking.state||{seconds:0,minutes:this.minutes,devices:[],zombies:[],drops:[],visitors:[],projectiles:[],zones:[],effects:[],spawned:0,deviceId:0,acidTime:0,fireTime:0};
        this.shiftPersonalClock(state.seconds-this.seconds);Object.assign(this,state);this.parking.state=null;this.scene='parking';Object.assign(this.player,P.exit);
        if(!this.parking.initialized){
          this.parking.initialized=true;this.parking.initialPending=[];
          for(let i=0;i<P.initial.length;i++){
            const region=i<8?[8,19]:i<16?[20,37]:[39,54],p=this.spawnPoint(false,region);
            if(p)this.spawnUnderground(P.initial[i],p,'initial');else this.parking.initialPending.push({kind:P.initial[i],region});
          }
          this.zombies.push({id:'parking:boss',kind:'lurker',x:0,y:50,hp:25,maxHP:25,state:'burrowed',phase:'normal',nextAttack:0,rootUntil:0,path:[],lastSeen:null,summonNext:null,summonPending:[],nextBurrow:null,lastRoar:null,noticed:false});
        }
        this.announce('地下首层：基础视距8米，视野不驱怪。每60秒持续刷新6只，地面时间暂停。');
      }else{
        this.parking.elapsed=this.seconds;this.parking.state=this.captureScene();const state=this.surfaceState;
        this.shiftPersonalClock(state.seconds-this.seconds);Object.assign(this,state);Object.assign(this.player,state.position);this.scene='surface';this.surfaceState=null;this.updateIndoorHome();
        this.announce('已返回地面，地面时钟从进入时刻继续。');
      }
      this._nav=null;this._parkingCollision=null;this._flowCache=new Map();this._pathJobs=new Map();this._pathQueue=[];this._lights=null;this._gunSound=null;this._exploreNext=0;this.navigationChanged();this._sceneJustChanged=true;this.autosaveRequested=true;
    }
    nearbyHomes(p,r){return this.scene==='parking'?[]:super.nearbyHomes(p,r);}
    updateDoors(){if(this.scene!=='parking')super.updateDoors();}
    updateIndoorHome(){if(this.scene==='parking')this.player.indoorHome=null;else super.updateIndoorHome();}
    obstacles(a,b=a,padding=.22){
      if(this.scene!=='parking')return super.obstacles(a,b,padding);
      let index=this._parkingCollision;
      if(!index||index.devices!==this.devices||index.count!==this.devices.length){
        const cells=new Map();let order=0;
        for(const o of [...this.parking.layer.objects,...this.devices]){const entry={o,order:order++};
          for(let x=Math.floor((o.x-o.w/2)/4);x<=Math.floor((o.x+o.w/2)/4);x++)for(let y=Math.floor((o.y-o.h/2)/4);y<=Math.floor((o.y+o.h/2)/4);y++){const k=`${x},${y}`;if(!cells.has(k))cells.set(k,[]);cells.get(k).push(entry);}
        }this._parkingCollision=index={devices:this.devices,count:this.devices.length,cells};
      }
      const hits=new Set();for(let x=Math.floor((Math.min(a.x,b.x)-padding)/4);x<=Math.floor((Math.max(a.x,b.x)+padding)/4);x++)for(let y=Math.floor((Math.min(a.y,b.y)-padding)/4);y<=Math.floor((Math.max(a.y,b.y)+padding)/4);y++)for(const entry of index.cells.get(`${x},${y}`)||[])hits.add(entry);
      return [...hits].sort((a,b)=>a.order-b.order).map(e=>e.o).filter(o=>o.hp>0&&!(o.kind==='fuse_gate'&&this.parking.layer.gateOpen)&&!(o.type==='device'&&!this.blocking(o))&&segmentHits(a,b,o,padding));
    }
    find(id){
      if(this.scene==='parking')return this.devices.find(d=>d.id===id)||this.parking.layer.points.find(p=>p.id===id)||(this.parking.layer.chest?.id===id?this.parking.layer.chest:null)||this.parking.layer.objects.find(o=>o.id===id);
      return this.parking?.entrance.id===id?this.parking.entrance:this.parking?.toolbox.id===id?this.parking.toolbox:super.find(id);
    }
    canPlace(kind,p){
      if(P.lamps[kind]?.fixed&&!this.stationNear('workbench'))return '建造灯具需要附近的工作台';
      if(this.scene!=='parking')return super.canPlace(kind,p);
      const d=D.builds[kind];if(!d)return '未知建筑';if(this.day<d.day)return `第${d.day}天开放`;
      if(!p||!Number.isFinite(p.x)||!Number.isFinite(p.y)||dist(p,this.player)>2)return '请靠近放置点（2米内）';
      for(const [k,n] of Object.entries(d.cost))if(this.count(k)<n)return `${S.NAMES[k]}不足，需要${n}`;
      if(kind==='planter')return '地下混凝土地面不支持种植';
      if(p.y<8||p.y>55||Math.abs(p.x)>22||Math.abs(p.x)<1.8||dist(p,{x:16,y:57})<3)return '请为主通道、出口和配电门保留空间';
      if(this.obstacles(p,p,.5).length||this.devices.some(d=>d.hp>0&&dist(d,p)<1)||this.parking.layer.points.some(o=>dist(o,p)<1.2))return '请避开车辆、物资点和其他装置';
      if(!this.clearLine(this.player,p))return '不能隔着障碍建造';
      if(dist(p,this.player)<.5||this.zombies.some(z=>z.hp>0&&dist(z,p)<.6))return '这里有生物';
      if(!d.ground&&!this.parkingRouteSafe({...p,w:d.w||.7,h:d.h||.7,hp:1,type:'device',kind}))return '建造会堵塞现有通路';return null;
    }
    plant(o,k){if(this.scene==='parking'){this.announce('地下不能种植。');return false;}return super.plant(o,k);}
    beginAction(type,duration,data={}){if(this.skill?.active)this.endStealth();return super.beginAction(type,duration,data);}
    nearbyInteraction(){
      if(this.scene!=='parking'){
        const current=super.nearbyInteraction(),points=this.parking?[this.parking.entrance,this.parking.toolbox]:[];
        const p=points.filter(p=>dist(p,this.player)<1.8&&this.clearLine(this.player,p)).sort((a,b)=>dist(a,this.player)-dist(b,this.player))[0];
        if(p&&(!current||dist(p,this.player)<current.distance))return {type:'parking',object:p,distance:dist(p,this.player)};
        if(current?.type==='device'&&P.lamps[current.object.kind])current.type='lamp';return current;
      }
      const layer=this.parking.layer,points=[...layer.points,...(layer.chest?[layer.chest]:[])],choices=[];
      for(const o of points){const access=this.parkingAccess(o);if(access.distance<1.8&&this.clearLine(this.player,access.point,access.ignore))choices.push({type:'parking',object:o,distance:access.distance,access});}
      for(const o of this.devices)if(o.hp>0&&dist(o,this.player)<1.8)choices.push({type:P.lamps[o.kind]?'lamp':'device',object:o,distance:dist(o,this.player)});
      for(const o of this.drops)if(dist(o,this.player)<1.5)choices.push({type:'drop',object:o,distance:dist(o,this.player)});
      return choices.filter(c=>c.access||this.clearLine(this.player,c.object,c.object)).sort((a,b)=>a.distance-b.distance)[0]||null;
    }
    interact(target){
      if(target)this.endStealth();
      if(target?.type==='parking')return this.parkingInteract(target.object);
      if(target?.type==='drop'&&target.object.lampId){
        const i=this.inventory.indexOf(null);if(i<0){this.announce('背包已满。');return false;}
        this.inventory[i]={...target.object};delete this.inventory[i].x;delete this.inventory[i].y;this.drops=this.drops.filter(d=>d!==target.object);return true;
      }return super.interact(target);
    }
    parkingInteract(o){
      if(o.kind==='entrance'||o.kind==='exit')return this.beginAction('travel',2,{target:o.id});
      if(o.kind==='next_floor'){this.announce(this.parking.layer.nextUnlocked?'下一层入口已解锁，下一层地图与规则尚未开放。':'需击败潜伏者并打开Boss宝箱。');return false;}
      if(o.kind==='gate_control'){
        if(this.parking.layer.gateOpen){this.announce('配电门已永久打开。');return false;}
        if(!this.count('fuse')){this.announce('需要1份保险丝，门外远端维修车保底提供。');return false;}return this.beginAction('parking_gate',2,{target:o.id});
      }
      if(o.kind==='boss_chest'&&!o.opened)return this.beginAction('parking_open',2,{target:o.id});
      if(o.opened)return this.takeParkingLoot(o);return this.beginAction('parking_search',o.time||2,{target:o.id});
    }
    takeParkingLoot(o,onlyKind=null){
      this.endStealth();
      let taken=0;for(const [k,amount] of Object.entries(o.loot||{}))if(!onlyKind||onlyKind===k){let left=amount;while(left>0&&this.add(k,1)){left--;taken++;}o.loot[k]=left;}
      this.announce(taken?'已领取物资，装不下的部分留在原处。':Object.values(o.loot||{}).some(n=>n>0)?'背包空间不足，物资已保留。':'这里的物资已全部领取。');return taken>0;
    }
    updateAction(dt){
      const a=this.action;if(!a||!actionNames[a.type])return super.updateAction(dt);
      if(dist(a.start,this.player)>.025){this.cancelAction('移动中断了操作。');return;}
      const o=a.target?this.find(a.target):null;
      const access=o&&this.parkingAccess(o);
      if(a.target&&(!o||o.hp<=0||access.distance>2||!this.clearLine(this.player,access.point,access.ignore))){this.cancelAction('目标无法操作。');return;}
      a.elapsed+=dt;if(a.elapsed+1e-8<a.duration)return;this.action=null;
      if(a.type==='travel'){this.switchScene();return;}
      if(a.type==='lamp'||a.type==='lamp_throw'){this.finishLampAction(a);return;}
      if(a.type==='parking_gate'){if(!this.parking.layer.gateOpen&&this.remove('fuse',1)){this.parking.layer.gateOpen=true;this.navigationChanged();this.announce('配电门已永久打开。');}return;}
      if(a.type==='parking_open'){
        if(!o.opened){o.opened=true;this.parking.layer.nextUnlocked=true;this.skill.unlocked=true;this.parkingVisual('reward_unlock_icon',o,.8,30);this.autosaveRequested=true;this.announce('打开Boss宝箱！获得潜伏技能，下一层入口解锁。');}
      }else {o.opened=true;this.stats.searches++;}
      this.takeParkingLoot(o);
    }
    toggleStealth(){
      if(!this.skill.unlocked){this.announce('打开潜伏者宝箱后解锁技能。');return false;}
      if(this.skill.active){this.endStealth();return true;}
      if(this.action||this.playerAttack||this.result||this.seconds<this.skill.cooldown||this.player.hunger<=0||this.player.stamina<2){this.announce('需要2体力、饱食及完成的20秒冷却；操作期间不能启动。');return false;}
      if(!this.spendStamina(2))return false;this.skill.active=true;this.skill.startedAt=this.seconds;this.skill.until=this.seconds+7;this.parkingVisual('stealth_start',this.player,.3,36);this.announce('潜伏启动：黑暗中隐身，7秒内不能奔跑，每秒额外消耗1.5饱食。');return true;
    }
    parkingVisual(asset,p,duration=.4,height=40){this.effects.push({kind:'parking_art_fx',asset,x:p.x,y:p.y,startedAt:this.seconds,duration,height,until:this.seconds+duration});}
    endStealth(reason='end'){if(this.skill?.active){this.skill.active=false;this.skill.cooldown=this.seconds+20;this.playerSkillVisual={state:reason==='hurt'?'hurt_interrupt':'end',until:this.seconds+.25};this.parkingVisual('stealth_break',this.player,.3,36);}}
    get hidden(){return !!this.skill?.active&&this.isDark(this.player);}
    enemyTarget(z){
      if(!this.hidden){if(dist(z,this.player)<=12&&this.clearLine(z,this.player))z.lastSeen={x:this.player.x,y:this.player.y};return this.player;}
      return z.lastSeen||{x:z.x,y:z.y};
    }
    movePlayer(dt,input){
      if(!this.skill?.active&&this.weaknessUntil<=this.seconds)return super.movePlayer(dt,input);
      const sx=(input.right?1:0)-(input.left?1:0)+(input.moveX||0),sy=(input.down?1:0)-(input.up?1:0)+(input.moveY||0),length=Math.hypot(sx,sy),f=screenDirection(sx,sy);
      const run=!this.skill.active&&input.run&&this.player.stamina>0,base=this.skill.active?3.4:run?4:2,speed=Math.max(.1,base-(this.weaknessUntil>this.seconds?.7:0)),before={x:this.player.x,y:this.player.y};
      // Original recovery code still runs; running skips recovery in the override hook.
      this._skipRecovery=!!run;super.movePlayer(dt,{});this._skipRecovery=false;
      if(length&&this.action?.type!=='medkit'){
        const n=Math.hypot(f.x,f.y)||1;this.player.facing={x:f.x/n,y:f.y/n};
        for(const axis of ['x','y']){const next={x:this.player.x,y:this.player.y};next[axis]+=f[axis]*Math.min(1,length)*speed*dt;if(!this.obstacles(this.player,next).length)this.player[axis]=next[axis];}
      }
      this.player.running=!!run&&dist(before,this.player)>1e-8;
      if(this.player.running){this.spendStamina(Math.min(this.player.stamina,dt*(this.teaBuff?.until>this.seconds?.8:1)));this.interruptBandage('奔跑');}
    }
    updateVitals(dt){
      super.updateVitals(dt);
      if(this.skill.active){const used=Math.min(dt,Math.max(0,this.skill.until-(this.seconds-dt)));this.player.hunger=Math.max(0,this.player.hunger-1.5*used);if(this.seconds>=this.skill.until||!this.player.hunger||this.result)this.endStealth();}
    }
    damagePlayer(n,source,ground){const hit=super.damagePlayer(n,source,ground);if(hit)this.endStealth('hurt');return hit;}
    attack(){if(this.skill?.active)this.endStealth();const ok=super.attack();if(ok&&this.scene==='parking'&&this.playerAttack?.weapon==='shotgun')this._gunSound={x:this.player.x,y:this.player.y,until:this.seconds+1};return ok;}
    throwMolotov(){this.endStealth();return super.throwMolotov();}
    directDamage(n){return this.weaknessUntil>this.seconds?Math.max(.1,n-.7):n;}
    snapshot(){
      const data=super.snapshot();data.scene=this.scene;data.parking=copy(this.parking);data.parkingUnlockPending=!!this.parkingUnlockPending;if(this.scene==='parking')data.parking.state=null;
      data.surfaceState=copy(this.surfaceState);data.heldLightId=this.heldLightId;data.headLightId=this.headLightId;data.lampSerial=this.lampSerial;data.skill=copy(this.skill);data.weaknessUntil=this.weaknessUntil;data.lampThrowAt=this.lampThrowAt;data.playerLampVisual=this.playerLampVisual||null;data.playerSkillVisual=this.playerSkillVisual||null;return data;
    }
    static restore(data){
      const game=Base.restore(data);Object.setPrototypeOf(game,ParkingGame.prototype);
      game.scene=data.scene||'surface';game.parking=data.parking||null;game.surfaceState=data.surfaceState||null;game.skill=data.skill||{unlocked:false,active:false,until:0,cooldown:0};
      game.weaknessUntil=data.weaknessUntil||0;game.heldLightId=data.heldLightId||null;game.headLightId=data.headLightId||null;game.lampSerial=data.lampSerial||0;game.lampThrowAt=data.lampThrowAt||0;
      game.parkingUnlockPending=!!data.parkingUnlockPending||game.parking?.introSeen===false;
      if(game.parking&&!game.parking.entrance.axis&&game.scene==='surface')game.ensureParking();
      game.normalizeParkingCargo();game._lights=null;game._nav=null;game._flowCache=new Map();return game;
    }
    step(dt,input={}){
      if(this.result||dt<=0||this.parkingUnlockPending)return;this._sceneJustChanged=false;this.seconds+=dt;this.pathBudget=2;
      if(this.scene==='parking')this.advanceParkingNavigation();
      this.updateLamps(dt);this.updateDoors();this.movePlayer(dt,input);this._lights=this.lightSources();this.updateDoors();this.updateIndoorHome();this.updateVitals(dt);if(this.result)return;
      this.updateAction(dt);if(this._sceneJustChanged)return;this._lights=this.lightSources();
      this.updatePlayerAttack();this.updateProduction(dt);this.advanceClock(dt);
      if(this.parkingUnlockPending)return;
      if(this.scene==='parking'){const boss=this.zombies.find(z=>z.kind==='lurker'&&z.hp>0);if(boss)this.updateBoss(boss,dt);}
      this.updateDevices(dt);this.updateZombies(dt);this.updateProjectiles(dt);this.updateZones(dt);if(this.scene==='parking')this.flushBossSummons();this.effects=this.effects.filter(e=>e.until>this.seconds);
      if(this.devices.some(d=>d.hp<=0))this.devices=this.devices.filter(d=>d.hp>0);this.zombies=this.zombies.filter(z=>z.hp>0);
      if(this.scene==='parking'){
        const p=this.parking;p.elapsed=this.seconds;
        if(this.seconds>=(this._exploreNext||0)){this._exploreNext=this.seconds+.5;const known=new Set(p.explored);
          for(let x=Math.floor(this.player.x/2)*2-16;x<=this.player.x+16;x+=2)for(let y=Math.floor(this.player.y/2)*2-16;y<=this.player.y+16;y+=2)if(this.canSee({x,y}))known.add(`${x},${y}`);p.explored=[...known];}
      }
    }
  }
  S.Game=ParkingGame;S.Parking=P;S.parkingActionNames=actionNames;
  S.ParkingBase=Base;S.parkingKey=key;
  if(common)module.exports=S;else root.Survival=S;
})(typeof globalThis!=='undefined'?globalThis:this);
