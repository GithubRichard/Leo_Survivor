/* Stateful survival systems. Rendering and browser storage stay in game.js. */
(function(root){
  const S=typeof module!=='undefined'&&module.exports?require('./simulation.js'):root.Survival;
  const D=typeof module!=='undefined'&&module.exports?require('./expansion-data.js'):root.ExpansionData;
  const {dist,pointRect,segmentHits,screenDirection}=S,Base=S.Game;
  const copy=x=>JSON.parse(JSON.stringify(x)),limit=k=>D.weapons[k]?1:D.items[k]?.[1]||99;
  Object.entries(D.items).forEach(([k,v])=>S.NAMES[k]=v[0]);
  for(const group of [D.weapons,D.builds,D.crafts])for(const [k,v] of Object.entries(group))if(!D.items[k])S.NAMES[k]=v.name;
  const cloneSlots=a=>a.map(s=>s?{...s}:null);
  function put(slots,kind,amount){
    let left=amount;for(const s of slots)if(s?.kind===kind){const n=Math.min(left,limit(kind)-s.amount);s.amount+=n;left-=n;}
    for(let i=0;i<slots.length&&left;i++)if(!slots[i]){const n=Math.min(left,limit(kind));slots[i]={kind,amount:n};left-=n;}return left===0;
  }
  function transaction(slots,cost={},gain={}){
    const next=cloneSlots(slots);
    for(const [kind,amount] of Object.entries(cost)){
      if(next.reduce((n,s)=>n+(s?.kind===kind?s.amount:0),0)<amount)return false;
      let left=amount;for(let i=0;i<next.length&&left;i++)if(next[i]?.kind===kind){const n=Math.min(left,next[i].amount);left-=n;next[i].amount-=n;if(!next[i].amount)next[i]=null;}
    }
    for(const [k,n] of Object.entries(gain))if(n>0&&!put(next,k,n))return false;
    slots.splice(0,slots.length,...next);return true;
  }
  const hash=(x,y,n=0)=>{let v=Math.imul(x+104729,374761393)^Math.imul(y+130363,668265263)^Math.imul(n+1,1274126177);v=Math.imul(v^(v>>>13),1274126177);return (v^(v>>>16))>>>0;};
  const total=d=>Math.min(180,36+6*(d-1))+(d%7===0?12:0);
  class MinHeap{
    constructor(){this.a=[];}get length(){return this.a.length;}
    push(v){const a=this.a;a.push(v);let i=a.length-1;while(i){const p=(i-1)>>1;if(a[p].f<=v.f)break;a[i]=a[p];i=p;}a[i]=v;}
    pop(){const a=this.a,first=a[0],last=a.pop();if(a.length){let i=0;while(i*2+1<a.length){let c=i*2+1;if(c+1<a.length&&a[c+1].f<a[c].f)c++;if(a[c].f>=last.f)break;a[i]=a[c];i=c;}a[i]=last;}return first;}
  }
  // Index static bounds once. Health and door state remain live at query time.
  const COLLISION_CELL=2;
  function collisionGrid(objects){
    const cells=new Map();let order=0,minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
    for(const object of objects){
      const entry={object,order:order++,stamp:0},w=object.w||0,h=object.h||0;
      for(let x=Math.floor((object.x-w/2)/COLLISION_CELL);x<=Math.floor((object.x+w/2)/COLLISION_CELL);x++)for(let y=Math.floor((object.y-h/2)/COLLISION_CELL);y<=Math.floor((object.y+h/2)/COLLISION_CELL);y++){
        minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);
        const key=`${x},${y}`;if(!cells.has(key))cells.set(key,[]);cells.get(key).push(entry);
      }
    }
    return {cells,stamp:0,minX,maxX,minY,maxY};
  }
  function gridHits(game,index,a,b,padding,out){
    const stamp=++index.stamp,hits=[];
    const minX=Math.max(index.minX,Math.floor((Math.min(a.x,b.x)-padding)/COLLISION_CELL)),maxX=Math.min(index.maxX,Math.floor((Math.max(a.x,b.x)+padding)/COLLISION_CELL));
    const minY=Math.max(index.minY,Math.floor((Math.min(a.y,b.y)-padding)/COLLISION_CELL)),maxY=Math.min(index.maxY,Math.floor((Math.max(a.y,b.y)+padding)/COLLISION_CELL));
    for(let x=minX;x<=maxX;x++)for(let y=minY;y<=maxY;y++){
      const bucket=index.cells.get(`${x},${y}`);if(!bucket)continue;
      for(const entry of bucket){
        if(entry.stamp===stamp)continue;entry.stamp=stamp;const o=entry.object;
        if(!game.active(o)||o.type==='site'&&!o.blocking||o.type==='device'&&!game.blocking(o))continue;
        if(segmentHits(a,b,o,padding))hits.push(entry);
      }
    }
    hits.sort((a,b)=>a.order-b.order);for(const entry of hits)out.push(entry.object);
  }
  function nightPlan(day){
    const types=Object.keys(D.enemies),N=total(day);
    const pct=day<3?[100,0,0,0,0,0]:day<5?[85,15,0,0,0,0]:day<8?[70,20,10,0,0,0]:day<10?[60,20,15,5,0,0]:day<12?[55,20,15,5,5,0]:[50,20,15,5,5,5];
    if(day%7===0){pct[0]-=10;pct[2]+=10;}
    const counts=pct.map(p=>Math.floor(N*p/100)),remainders=pct.map((p,i)=>({i,r:N*p%100})).sort((a,b)=>b.r-a.r||a.i-b.i);
    for(let i=0,left=N-counts.reduce((a,b)=>a+b,0);i<left;i++)counts[remainders[i].i]++;
    for(const [i,cap] of [[3,10],[4,10],[5,5]])if(counts[i]>cap){counts[0]+=counts[i]-cap;counts[i]=cap;}
    const batches=Array.from({length:6},()=>[]),capacity=N/6;
    for(let t=2;t<types.length;t++)for(let n=0;n<counts[t];n++){const b=[0,1,2,3,4].filter(b=>batches[b].length<capacity&&batches[b].filter(k=>k===types[t]).length<(t===5?1:t>=3?2:capacity)).sort((a,b)=>batches[a].length-batches[b].length||a-b)[0];if(b!==undefined)batches[b].push(types[t]);else counts[0]++;}
    const rest=[...Array(counts[1]).fill('runner'),...Array(counts[0]).fill('normal')];
    for(let b=5;b>=0;b--)while(batches[b].length<capacity)batches[b].push(rest.shift());
    return {N,counts:Object.fromEntries(types.map((k,i)=>[k,counts[i]])),batches};
  }
  class SurvivalGame extends Base{
    constructor(options={}){
      super(options);this.day=1;this.player.hunger=100;this.player.weapon='fists';this.player.invulnerableUntil=0;
      this.lastSpent=-Infinity;this.lastRecoveryAt=null;this.recoveryInterval=2;this.attackAt=0;this.foodAt=0;this.waterAt=0;this.throwAt=0;this.mainBuff=null;this.teaBuff=null;this.foodRegen=null;this.bandage=null;
      this.action=null;this.playerAttack=null;this.projectiles=[];this.zones=[];this.effects=[];this.helper=null;this.visitFailures=0;this.visitDay=null;
      this.history=[];this.stats={planned:0,spawned:0,arrived:0,kills:{},damage:{},lost:0,searches:0,food:[],resourceStart:{iron:6,wood:13}};
      this.pendingSpawn=[];this.waveDirections=[];this.warnedWaves=[];this.plan=nightPlan(1);this.nextWave=0;this.initVisit();this.pathBudget=2;this.autosaveRequested=false;
    }
    get maxHP(){return 12+(this.mainBuff?.type==='health'?2:0);}
    get maxStamina(){return 10+(this.mainBuff?.type==='stamina2'?2:this.mainBuff?.type==='stamina4'?4:0);}
    countIn(slots,k){return slots.reduce((n,s)=>n+(s?.kind===k?s.amount:0),0);}
    recordResource(key,values){if(!this.stats)return;const bucket=this.stats[key]||(this.stats[key]={});for(const [k,n] of Object.entries(values))bucket[k]=(bucket[k]||0)+n;}
    add(k,n=1){const ok=transaction(this.inventory,{}, {[k]:n});if(ok)this.recordResource('income',{[k]:n});return ok;}
    remove(k,n){const ok=transaction(this.inventory,{[k]:n});if(ok)this.recordResource('spent',{[k]:n});return ok;}
    resources(){const out={};for(const s of this.inventory)if(s)out[s.kind]=(out[s.kind]||0)+s.amount;return out;}
    pay(cost={},gain={}){if(transaction(this.inventory,cost,gain)){this.recordResource('spent',cost);this.recordResource('income',gain);return true;}this.announce('材料不足或背包空间不足，物品未改变。');return false;}
    getHome(cx,cy){
      const h=super.getHome(cx,cy);if(h.expanded)return h;h.expanded=true;
      h.kind=cx===1&&cy===0?'food_shop':cx===-1&&cy===0?'repair_shop':cx===0&&cy===-1?'pharmacy':cx===0&&cy===2?'security_room':(!h.own&&hash(cx,cy)%13===0?['food_shop','repair_shop','pharmacy','security_room'][hash(cx,cy,1)%4]:'house');
      h.title={house:h.own?'你的家':'民居',food_shop:'食品商店',repair_shop:'维修铺',pharmacy:'药店',security_room:'保安室'}[h.kind];
      const wallParts=[];for(const o of h.objects.filter(o=>o.type==='wall')){const length=Math.max(o.w,o.h),n=Math.ceil(length);for(let i=0;i<n;i++){const alongX=o.w>o.h;wallParts.push({...o,x:o.x+(alongX?(-length/2+(i+.5)*length/n):0),y:o.y+(!alongX?(-length/2+(i+.5)*length/n):0),w:alongX?length/n:o.w,h:alongX?o.h:length/n,hp:30,maxHP:30,material:'stone'});}}
      h.objects=h.objects.filter(o=>o.type!=='wall');h.objects.unshift(...wallParts);
      h.objects.forEach((o,i)=>{o.id=`home:${cx},${cy}:${i}`;o.maxHP=o.maxHP||o.hp;o.material=o.material||'wood';o.invested={};});
      h.sites=[];const site=(kind,dx,dy,loot={},time=3,repeat=false)=>{const o={id:`site:${cx},${cy}:${h.sites.length}`,type:'site',kind,x:h.x+dx,y:h.y+dy,w:.65,h:.65,hp:Infinity,loot,time,repeat,searched:false,home:h};h.sites.push(o);return o;};
      if(h.kind==='house'){
        const groups=[{potato:2},{vegetable:2},{grain:2},{raw_meat:1},{canned_food:1}],r=hash(cx,cy,2)%100,index=r<25?0:r<50?1:r<70?2:r<85?3:4;
        site('kitchen',0,-4,{clean_water:1,...groups[index]});site('misc',1,-1,{[hash(cx,cy,3)%2?'cloth':'scrap']:1});
        if(h.own)site('supply',-1,-4,{canned_food:2,potato:2,clean_water:3});
      }else{
        h.objects=h.objects.filter(o=>o.type!=='furniture');h.furniture=[];
        const loot={food_shop:[{potato:3,vegetable:3,grain:3},{raw_meat:2,canned_food:2,clean_water:4}],repair_shop:[{iron:4,scrap:4,parts:2,wood:2}],pharmacy:[{cloth:4,herb:3,alcohol:2}],security_room:[{gunpowder:3,iron:3,parts:1}]}[h.kind];
        loot.forEach((l,i)=>site(h.kind=== 'food_shop'?'freezer':h.kind,-2+i*3,-3,l));
      }
      if(h.own){for(const [x,y] of [[-9,6],[9,6],[-9,-9],[9,-9]])site('stone_pile',x,y,{stone:3},4);site('water_point',8,-7,{raw_water:4},5,true);site('herb_bed',-8,7,{herb:2},4);}
      else {site('stone_pile',8,6,{stone:3},4);if(hash(cx,cy,4)%8===0)site('water_point',-8,6,{raw_water:4},5,true);if(hash(cx,cy,5)%4===0)site('herb_bed',8,-8,{herb:2},4);}
      for(const s of h.sites)if(!['stone_pile','water_point','herb_bed'].includes(s.kind)){s.blocking=true;s.hp=18;s.maxHP=18;s.material='wood';s.invested={};}
      return h;
    }
    active(o){return o.hp>0&&!(o.type==='door'&&o.open);}
    blocking(o){return !D.builds[o.kind]?.ground;}
    obstacles(a,b=a,padding=.22){
      const out=[],spacing=S.RULES.lotSpacing;this._collisionHomes=this._collisionHomes||new WeakMap();
      const minX=Math.round((Math.min(a.x,b.x)-padding)/spacing),maxX=Math.round((Math.max(a.x,b.x)+padding)/spacing);
      const minY=Math.round((Math.min(a.y,b.y)-padding)/spacing),maxY=Math.round((Math.max(a.y,b.y)+padding)/spacing);
      for(let cx=minX;cx<=maxX;cx++)for(let cy=minY;cy<=maxY;cy++){
        const h=this.getHome(cx,cy);let cached=this._collisionHomes.get(h);
        if(!cached||cached.objects!==h.objects||cached.sites!==h.sites||cached.objectCount!==h.objects.length||cached.siteCount!==h.sites.length){
          cached={objects:h.objects,sites:h.sites,objectCount:h.objects.length,siteCount:h.sites.length,index:collisionGrid([...h.objects,...h.sites])};this._collisionHomes.set(h,cached);
        }
        gridHits(this,cached.index,a,b,padding,out);
      }
      if(this.devices.length){let devices=this._collisionDevices;
        if(!devices||devices.objects!==this.devices||devices.count!==this.devices.length)this._collisionDevices=devices={objects:this.devices,count:this.devices.length,index:collisionGrid(this.devices)};
        gridHits(this,devices.index,a,b,padding,out);
      }return out;
    }
    clearLine(a,b,ignore=null){return a.x===b.x&&a.y===b.y||!this.obstacles(a,b,0).some(o=>o!==ignore);}
    navigationChanged(){this._navigationRevision=(this._navigationRevision||0)+1;}
    updateDoors(){for(const h of this.homes.values())for(const door of h.doors){if(door.hp<=0)continue;const wasOpen=door.open,d=pointRect(this.player,door);if(d<1.25)door.open=true;else if(door.open&&d>1.6&&!this.zombies.some(z=>z.hp>0&&pointRect(z,door)<.3))door.open=false;if(wasOpen!==door.open)this.navigationChanged();}}
    canPlace(kind,p){
      const def=D.builds[kind];if(!def)return '未知建筑';if(this.day<def.day)return `第${def.day}天开放`;
      if(!p||!Number.isFinite(p.x)||!Number.isFinite(p.y))return '请选择有效的放置位置';
      if(dist(this.player,p)>2)return '请靠近建造位置（2米内）';
      for(const [k,n] of Object.entries(def.cost))if(this.count(k)<n)return `${S.NAMES[k]}不足，需要${n}`;
      const spacing=S.RULES.lotSpacing,home=this.getHome(Math.round(p.x/spacing),Math.round(p.y/spacing));
      if(home.doors.some(o=>o.hp>0&&pointRect(p,o)<.45))return '这里是门的位置，不能重叠建造';
      if(this.obstacles(p,p,.45).length||this.devices.some(d=>d.hp>0&&dist(d,p)<1))return '建筑或装置太近（至少1米）';
      if(!this.clearLine(this.player,p))return '无法隔着墙或障碍物建造';
      if(this.zombies.some(z=>z.hp>0&&dist(z,p)<.5)||dist(this.player,p)<.5)return '这里有生物';return null;
    }
    placementPoint(){const p=super.placementPoint();return {x:Math.round(p.x*2)/2,y:Math.round(p.y*2)/2};}
    place(kind,p){const error=this.canPlace(kind,p);if(error){this.announce(error);return false;}return this.beginAction('build',3,{kind,p});}
    stationNear(kind){return this.devices.find(d=>d.kind===kind&&d.hp>0&&dist(d,this.player)<2&&this.clearLine(this.player,d,d));}
    find(id){const device=this.devices.find(d=>d.id===id);if(device)return device;const match=/^(home|site):(-?\d+),(-?\d+):\d+$/.exec(id);if(!match)return undefined;const h=this.homes.get(`${match[2]},${match[3]}`);return h&&(match[1]==='site'?h.sites:h.objects).find(o=>o.id===id);}
    beginAction(type,duration,data={}){
      if(this.action){this.announce('正在操作，请先取消。');return false;}
      this.action={type,duration,elapsed:0,start:{x:this.player.x,y:this.player.y},...data};return true;
    }
    cancelAction(reason='操作已取消'){if(this.action){this.action=null;this.announce(reason);}}
    dismantle(o){return o&&o.hp>0&&this.beginAction('dismantle',3,{target:o.id});}
    repair(o){return o&&o.hp>0&&o.hp<o.maxHP&&this.beginAction('repair',1,{target:o.id});}
    upgrade(o){const key=o.type==='door'?'door':o.kind==='ballista'&&o.level===1?'repeating':o.kind,def=D.upgrades[key];if(!def||o.level===(def.level)||this.day<def.day||(!this.stationNear('workbench')&&o.type!=='door')){this.announce('需要对应天数、工作台及可升级的装置。');return false;}return this.beginAction('upgrade',5,{target:o.id,key});}
    craft(kind){const def=D.weapons[kind]||D.crafts[kind];if(!def||this.day<def.day||def.station&&!this.stationNear(def.station)){this.announce('配方未开放，或请靠近工作台。');return false;}if(kind==='backpack_upgrade'&&this.inventory.length>=30)return false;return this.beginAction('craft',3,{kind});}
    updateAction(dt){
      const a=this.action;if(!a)return;if(dist(a.start,this.player)>.025){this.cancelAction('移动中断了操作。');return;}
      const o=a.target?this.find(a.target):null;if(a.target&&(!o||o.hp<=0||dist(o,this.player)>2||!this.clearLine(this.player,o,o))){this.cancelAction('目标无法操作。');return;}
      a.elapsed+=dt;if(a.elapsed+1e-8<a.duration)return;this.action=null;
      if(a.type==='build'){
        const def=D.builds[a.kind],error=this.canPlace(a.kind,a.p);if(error){this.announce(error);return;}if(!this.pay(def.cost))return;
        const horizontal=Math.abs(this.player.facing.x)>=Math.abs(this.player.facing.y);this.devices.push({...a.p,id:`device:${this.deviceId++}`,kind:a.kind,type:'device',hp:def.hp,maxHP:def.hp,w:horizontal?(def.w||.7):(def.h||.7),h:horizontal?(def.h||.7):(def.w||.7),level:0,invested:{...def.cost},readyAt:this.seconds+(D.combatStats(a.kind)?.interval||(a.kind==='spike_floor'?2:1)),target:null,output:Array(6).fill(null),storage:Array(20).fill(null),jobs:[],fuel:0});this.navigationChanged();this.announce(`${def.name}建造完成。`);
      }else if(a.type==='dismantle'){
        const gain=o.type==='furniture'?{[o.material]:1}:o.invested||{};
        const extra={...gain},lamps=[];for(const slots of [o.storage||[],o.output||[]])for(const s of slots)if(s){if(s.lampId)lamps.push({...s,active:false});else extra[s.kind]=(extra[s.kind]||0)+s.amount;}
        for(const j of o.jobs||[])for(const [k,n] of Object.entries(j.cost))extra[k]=(extra[k]||0)+n;
        if(o.crop)extra[o.crop.kind]=(extra[o.crop.kind]||0)+1;
        const refund=cloneSlots(this.inventory);if(!transaction(refund,{},extra)||refund.filter(s=>!s).length<lamps.length){this.announce('背包空间不足，建筑及其中物资保留。');return;}
        for(const lamp of lamps)refund[refund.indexOf(null)]=lamp;this.inventory=refund;this.recordResource('income',extra);
        o.hp=0;this.devices=this.devices.filter(d=>d!==o);this.navigationChanged();if(this.player.weapon!=='fists'&&!this.count(this.player.weapon))this.player.weapon='fists';this.announce(o.type==='site'&&o.searched?'空容器已拆除。':'拆除完成，已返还全部投入材料。');
      }else if(a.type==='repair'){
        const k=o.material==='stone'||o.kind==='brick_wall'?'stone':o.kind==='trap'||o.kind==='iron_fence'?'iron':'wood';if(o.hp>=o.maxHP)return;if(this.pay({[k]:1}))o.hp=Math.min(o.maxHP,o.hp+(k==='stone'?10:6));
      }else if(a.type==='upgrade'){
        const def=D.upgrades[a.key];if(this.day<def.day||o.level===def.level||o.type!=='door'&&!this.stationNear('workbench'))return;
        if(this.pay(def.cost)){
          const ratio=o.hp/o.maxHP,oldCombat=D.combatStats(o.kind,o.level),newCombat=D.combatStats(o.kind,def.level);
          if(oldCombat&&newCombat)o.readyAt=this.seconds+Math.max(0,(o.readyAt||0)-this.seconds)*newCombat.interval/oldCombat.interval;
          o.level=def.level;o.maxHP=def.hp;o.hp=ratio*def.hp;for(const [k,n] of Object.entries(def.cost))o.invested[k]=(o.invested[k]||0)+n;
          this.announce(newCombat?`${newCombat.name}改造完成：${newCombat.damage}伤害，每${newCombat.interval}秒一次，保留原血量比例。`:'改造完成，保留原血量比例。');
        }
      }else if(a.type==='craft'){
        const def=D.weapons[a.kind]||D.crafts[a.kind];if(this.day<def.day||def.station&&!this.stationNear(def.station))return;
        if(a.kind==='backpack_upgrade'){if(this.inventory.length===20&&this.pay(def.cost))this.inventory.push(...Array(10).fill(null));}
        else if(this.pay(def.cost,{[a.kind]:def.amount||1}))this.announce(`${S.NAMES[a.kind]}制作完成。`);
      }else if(a.type==='search'){
        if(!o.repeat&&o.searched)return;if(this.pay({},o.loot)){o.searched=true;this.stats.searches++;this.announce('收集完成。');}
      }else if(a.type==='eat')this.completeFood(a.kind);
      else if(a.type==='medkit'){
        if(this.player.hp>=this.maxHP){this.announce('血量已满，急救包已保留。');return;}
        if(this.day>=8&&this.pay({medkit:1}))this.player.hp=Math.min(this.maxHP,this.player.hp+8);
      }
    }
    spendStamina(n){if(n<=0)return true;if(this.developer?.enabled&&this.developer.infiniteStamina){this.player.stamina=this.maxStamina;return true;}if(this.player.stamina+1e-8<n)return false;this.player.stamina=Math.max(0,this.player.stamina-n);this.lastSpent=this.seconds;this.lastRecoveryAt=null;this.nextRecoveryAt=this.seconds+2;return true;}
    movePlayer(dt,input){
      let sx=(input.right?1:0)-(input.left?1:0)+(input.moveX||0),sy=(input.down?1:0)-(input.up?1:0)+(input.moveY||0);
      const length=Math.hypot(sx,sy),before={x:this.player.x,y:this.player.y};this.player.running=false;
      if(length&&this.action?.type!=='medkit'){
        const movement=screenDirection(sx,sy),n=Math.hypot(movement.x,movement.y);this.player.facing={x:movement.x/n,y:movement.y/n};
        const running=input.run&&this.player.stamina>0,speed=(running?4:2)*Math.min(1,length),nx={x:this.player.x+movement.x*speed*dt,y:this.player.y};
        if(!this.obstacles(this.player,nx).length)this.player.x=nx.x;const ny={x:this.player.x,y:this.player.y+movement.y*speed*dt};if(!this.obstacles(this.player,ny).length)this.player.y=ny.y;
        this.player.running=Boolean(running&&dist(before,this.player)>1e-8);
      }
      if(this.player.running){this.spendStamina(Math.min(this.player.stamina,dt*(this.teaBuff?.until>this.seconds ? .8 : 1)));this.interruptBandage('奔跑');}
      else if(!this._skipRecovery){
        const interval=this.player.hunger<20?3:this.mainBuff?.type==='recovery'?1.5:2;
        if(this.recoveryInterval!==interval&&this.lastRecoveryAt!==null)this.nextRecoveryAt=this.lastRecoveryAt+interval;
        this.recoveryInterval=interval;
        while(this.seconds+1e-8>=this.nextRecoveryAt&&this.player.stamina<this.maxStamina){this.player.stamina=Math.min(this.maxStamina,this.player.stamina+1);this.lastRecoveryAt=this.nextRecoveryAt;this.nextRecoveryAt+=interval;}
        if(this.player.stamina>=this.maxStamina){this.nextRecoveryAt=Infinity;this.lastRecoveryAt=null;}
      }
    }
    damagePlayer(amount,source='normal',ground=false){
      if(this.developer?.enabled&&this.developer.invincible)return false;
      if(amount<=0||this.result||!ground&&this.player.invulnerableUntil>this.seconds)return false;
      if(this.mainBuff?.type==='armor'&&amount>=1)amount=Math.max(1,amount-1);
      this.player.hp=Math.max(0,this.player.hp-amount);this.player.hurtUntil=this.seconds+1;if(!ground)this.player.invulnerableUntil=this.seconds+.5;
      this.cancelAction('受伤中断了操作。');this.interruptBandage('受伤');this.stats.damage[source]=(this.stats.damage[source]||0)+amount;
      if(this.player.hp<=0){this.result='dead';this.deathReason=source;this.finishStats();this.autosaveRequested=true;}return true;
    }
    damageZombie(z,n){if(z.hp<=0)return;z.hp=Math.max(0,z.hp-n);if(!z.hp){this.kills++;this.stats.kills[z.kind]=(this.stats.kills[z.kind]||0)+1;z.windup=null;}}
    damageBuilding(o,n){if(o.hp<=0)return;o.hp=Math.max(0,o.hp-n);if(o.hp>0)return;this.navigationChanged();this.stats.lost++;
      const gain={};for(const [k,v] of Object.entries(o.invested||{})){const n=Math.floor(v/2);if(n)gain[k]=(gain[k]||0)+n;}
      if(o.type==='site'&&!o.searched)for(const [k,n] of Object.entries(o.loot||{}))gain[k]=(gain[k]||0)+n;
      for(const slots of [o.storage||[],o.output||[]])for(const s of slots)if(s){if(s.lampId)this.drops.push({...s,active:false,x:o.x,y:o.y});else gain[s.kind]=(gain[s.kind]||0)+s.amount;}
      for(const j of o.jobs||[])for(const [k,n] of Object.entries(j.cost))gain[k]=(gain[k]||0)+n;
      for(const [kind,amount] of Object.entries(gain))this.drops.push({kind,amount,x:o.x,y:o.y});o.jobs=[];o.output=[];o.storage=[];
      this.effects.push({kind:o.material==='stone'||o.kind==='brick_wall'?'rubble_stone':o.kind==='trap'||o.kind==='iron_fence'?'rubble_metal':'rubble_wood',x:o.x,y:o.y,until:this.seconds+30});this.announce('防线被摧毁，部分材料留在原地。');
    }
    nearbyInteraction(){
      const choices=[];for(const h of this.nearbyHomes(this.player,10)){
        for(const s of h.sites)if(s.hp>0&&dist(s,this.player)<1.8&&(s.blocking||!s.searched||s.repeat))choices.push({type:s.searched&&!s.repeat&&s.blocking?'container':'site',object:s,distance:dist(s,this.player)});
        for(const o of h.objects)if(o.hp>0&&dist(o,this.player)<1.6)choices.push({type:o.type==='furniture'?'furniture':'structure',object:o,distance:dist(o,this.player)});
      }
      for(const o of this.devices)if(o.hp>0&&dist(o,this.player)<1.8)choices.push({type:'device',object:o,distance:dist(o,this.player)});
      for(const o of this.drops)if(dist(o,this.player)<1.5)choices.push({type:'drop',object:o,distance:dist(o,this.player)});
      for(const o of this.visitors)if(dist(o,this.player)<1.8)choices.push({type:o.recruited?'helper':'visitor',object:o,distance:dist(o,this.player)});
      return choices.filter(c=>this.clearLine(this.player,c.object,c.object)).sort((a,b)=>a.distance-b.distance)[0]||null;
    }
    interact(target){if(target?.type==='site'){const o=target.object;if(o.hp<=0||o.searched&&!o.repeat)return false;return this.beginAction('search',o.time,{target:o.id});}if(target?.type==='drop')return super.interact(target);if(target?.type==='furniture')return this.dismantle(target.object);return false;}
    drop(){if(this.action){this.announce('操作中无法丢弃。');return false;}const kind=this.inventory[this.selectedSlot]?.kind,result=super.drop();if(result)this.recordResource('spent',{[kind]:1});if(!this.count(this.player.weapon))this.player.weapon='fists';return result;}
    equip(kind){if(kind==='fists'||this.count(kind)&&(D.weapons[kind]||kind==='molotov')){this.player.weapon=kind;this.announce(kind==='molotov'?'已手持燃烧瓶，调整朝向后按交互投掷。':`已装备${S.NAMES[kind]||'徒手'}。`);return true;}return false;}
    interruptBandage(reason){if(!this.bandage)return;this.bandage=null;this.announce(`${reason}中断了绷带治疗，剩余恢复已停止。`);}
    use(kind){
      if(!this.count(kind))return false;
      if(D.weapons[kind]||kind==='molotov')return this.equip(kind);
      if(D.foods[kind]){const f=D.foods[kind];if(this.seconds<(f.water?this.waterAt:this.foodAt)){this.announce('食用冷却尚未结束。');return false;}return this.beginAction('eat',1.5,{kind});}
      if(kind==='bandage'){if(this.bandage||this.player.hp>=this.maxHP||!this.remove(kind,1))return false;this.bandage={next:this.seconds+2,left:4};this.announce('绷带治疗中：可以步行。一旦奔跑、攻击或受伤，剩余治疗立即停止。');return true;}
      if(kind==='medkit'){if(this.player.hp>=this.maxHP){this.announce('血量已满，无需急救。');return false;}return this.day>=8&&this.beginAction('medkit',3);}
      this.announce('这件物品不能直接食用。');return false;
    }
    completeFood(kind){
      const f=D.foods[kind];if(this.seconds<(f.water?this.waterAt:this.foodAt)||!this.remove(kind,1))return;
      if(f.buff)this.mainBuff={type:f.buff,until:this.seconds+360};if(f.tea)this.teaBuff={until:this.seconds+360};
      if(f.regen)this.foodRegen={left:f.regen,next:this.seconds+30};
      this.player.hp=Math.min(this.maxHP,this.player.hp+(f.heal||0));this.player.stamina=Math.min(this.maxStamina,this.player.stamina+(f.stamina||0));this.player.hunger=Math.min(100,this.player.hunger+f.hunger);
      this.foodAt=f.water?this.foodAt:this.seconds+20;this.waterAt=f.water?this.seconds+30:this.waterAt;this.stats.food.push(kind);this.announce(`${S.NAMES[kind]}已使用。`);
      if(!Number.isFinite(this.nextRecoveryAt)&&this.player.stamina<this.maxStamina)this.nextRecoveryAt=this.seconds+2;
    }
    updateVitals(dt){
      for(const key of ['mainBuff','teaBuff'])if(this[key]?.until<=this.seconds)this[key]=null;
      this.player.hp=Math.min(this.player.hp,this.maxHP);this.player.stamina=Math.min(this.player.stamina,this.maxStamina);this.player.hunger=Math.max(0,this.player.hunger-dt/.75/60*3);
      if(!this.player.hunger){this.starving=(this.starving||0)+dt;if(this.starving>=60){this.starving-=60;this.damagePlayer(1,'hunger',true);}}else this.starving=0;
      for(const [key,interval] of [['foodRegen',30],['bandage',2]]){const heal=this[key];if(heal&&this.seconds>=heal.next){this.player.hp=Math.min(this.maxHP,this.player.hp+1);heal.left--;heal.next+=interval;if(!heal.left)this[key]=null;}}
    }
    attack(){
      if(this.player.weapon==='molotov')return this.throwMolotov();
      const w=D.weapons[this.player.weapon]||D.weapons.fists;if(this.action||this.playerAttack||this.seconds<this.attackAt)return false;
      const facing=this.player.facing,aim=Math.hypot(facing.x,facing.y)||1;
      const targets=this.zombies.filter(z=>z.hp>0&&(!this.canSee||this.canSee(z))&&dist(z,this.player)<=w.range&&((z.x-this.player.x)*facing.x+(z.y-this.player.y)*facing.y)/Math.max(.001,dist(z,this.player))/aim>.35&&this.clearLine(this.player,z)).sort((a,b)=>dist(a,this.player)-dist(b,this.player));
      if(!targets.length){this.announce('朝向范围内没有敌人。');return false;}
      if(this.player.stamina<w.stamina||w.ammo&&!this.count(w.ammo)){this.announce(w.ammo&&!this.count(w.ammo)?'弹药不足。':'体力不足。');return false;}
      if(w.ammo)this.remove(w.ammo,1);this.spendStamina(w.stamina);this.interruptBandage('攻击');this.attackAt=this.seconds+w.interval;
      const damage=w.damage+(!w.ammo&&this.mainBuff?.type==='melee'?1:0),duration=D.attackAnimations[this.player.weapon];
      if(!duration){this.damageZombie(targets[0],this.directDamage?this.directDamage(damage):damage,'weapon');this.effects.push({kind:'melee_arc',x:targets[0].x,y:targets[0].y,until:this.seconds+.25});return true;}
      this.playerAttack={weapon:this.player.weapon,kind:w.ammo?'ranged':'melee',facing:{x:facing.x/aim,y:facing.y/aim},targetId:targets[0].id,damage,startedAt:this.seconds,releaseAt:this.seconds+duration/3,endsAt:this.seconds+duration,released:false};return true;
    }
    updatePlayerAttack(){
      const a=this.playerAttack;if(!a)return;
      if(!a.released&&this.seconds+1e-8>=a.releaseAt){
        a.released=true;
        if(a.kind==='throw'){
          const start={x:this.player.x,y:this.player.y};
          this.projectiles.push({kind:'molotov_projectile',...start,z:.9,start,end:a.end,duration:.65,elapsed:0,owner:'player'});
        }else {
          const w=D.weapons[a.weapon];
          if(a.kind==='ranged'){
            for(let n=0;n<(w.pellets||1);n++){const angle=Math.atan2(a.facing.y,a.facing.x)+(w.pellets?(n-1.5)*.11:0);this.projectiles.push({kind:w.ammo==='shotgun_shell'?'shot_pellet':w.ammo,x:this.player.x,y:this.player.y,vx:Math.cos(angle)*18,vy:Math.sin(angle)*18,range:w.range,damage:a.damage,owner:'player'});}
          }else {
            const target=this.zombies.find(z=>z.id===a.targetId),distance=target?dist(target,this.player):Infinity;
            if(target&&target.hp>0&&distance<=w.range&&((target.x-this.player.x)*a.facing.x+(target.y-this.player.y)*a.facing.y)/Math.max(.001,distance)>.35&&this.clearLine(this.player,target)){
              this.damageZombie(target,this.directDamage?this.directDamage(a.damage):a.damage,'weapon');this.effects.push({kind:a.weapon==='wood_spear'?'thrust_line':'melee_arc',x:target.x,y:target.y,until:this.seconds+.25});
            }
          }
        }
      }
      if(this.seconds+1e-8>=a.endsAt)this.playerAttack=null;
    }
    molotovAim(){
      const f=this.player.facing,length=Math.hypot(f.x,f.y);
      const start={x:this.player.x,y:this.player.y},end={x:start.x+(length?f.x/length:0)*4,y:start.y+(length?f.y/length:1)*4};
      let reason='';
      if(this.player.weapon!=='molotov'||!this.count('molotov'))reason='请先从背包装备燃烧瓶';
      else if(this.day<5)reason='第5天开放燃烧瓶';
      else if(this.action)reason='正在操作，请先完成或取消';
      else if(this.playerAttack)reason='投掷动作进行中';
      else if(!this.clearLine(start,end))reason='投掷路径被墙或装置挡住';
      else if(this.seconds<this.throwAt)reason=`投掷冷却 ${Math.ceil(this.throwAt-this.seconds)}秒`;
      return {start,end,duration:.65,radius:1.5,valid:!reason,reason};
    }
    molotovPoint(trajectory,t){
      t=Math.max(0,Math.min(1,t));
      return {x:trajectory.start.x+(trajectory.end.x-trajectory.start.x)*t,y:trajectory.start.y+(trajectory.end.y-trajectory.start.y)*t,z:.9*(1-t)+1.4*4*t*(1-t)};
    }
    throwMolotov(){
      const aim=this.molotovAim();if(!aim.valid){this.announce(aim.reason+'。');return false;}
      if(!this.remove('molotov',1))return false;
      this.throwAt=this.seconds+2;this.interruptBandage('投掷攻击');
      const duration=D.attackAnimations.molotov,f=this.player.facing,length=Math.hypot(f.x,f.y);
      this.playerAttack={weapon:'molotov',kind:'throw',facing:{x:length?f.x/length:0,y:length?f.y/length:1},end:aim.end,startedAt:this.seconds,releaseAt:this.seconds+duration/3,endsAt:this.seconds+duration,released:false};
      if(!this.count('molotov'))this.player.weapon='fists';return true;
    }
    igniteMolotov(p){
      this.zones.push({x:p.x,y:p.y,kind:'fire_pool',source:'molotov',radius:1.5,until:this.seconds+6,id:`fire:${this.seconds}`});
      for(const z of this.zombies)if(z.hp>0&&dist(z,p)<=1.5&&this.clearLine(p,z)){this.damageZombie(z,this.directDamage?this.directDamage(1):1,'molotov');z.burningUntil=this.seconds+6;z.burnNext=this.seconds+1;z.burnSource='molotov';}
    }
    startProduction(o,kind){
      if(o.hp<=0||dist(o,this.player)>2)return false;let cost,time,fuel=false;
      if(kind==='clean_water'){if(o.kind!=='water_purifier')return false;cost={raw_water:4};time=20;}
      else {const f=D.foods[kind];if(!f?.cost||this.day<f.day||!(o.kind===f.station||o.kind==='stove'&&['grill','stove'].includes(f.station)))return false;cost=f.cost;time=f.time;fuel=f.station!=='drying_rack';}
      if((o.jobs||[]).length>=(o.kind==='drying_rack'?3:1)){this.announce('制作队列已满。');return false;}
      const output=cloneSlots(o.output);if(!put(output,kind,kind==='clean_water'?4:1)){this.announce('输出格已满，请先领取。');return false;}
      if(fuel&&!o.fuel){this.announce('请先投入1木，获得3份燃料额度。');return false;}
      if(!this.pay(cost))return false;if(fuel)o.fuel--;o.jobs.push({kind,cost:{...cost},fuel,time,remaining:time,amount:kind==='clean_water'?4:1});return true;
    }
    fuel(o){if(o.hp>0&&this.pay({wood:1})){o.fuel+=3;return true;}return false;}
    cancelProduction(o){const j=o.jobs?.[0];if(!j)return false;if(!this.pay({},j.cost))return false;if(j.fuel)o.fuel++;o.jobs.shift();return true;}
    updateProduction(dt){for(const o of this.devices)if(o.hp>0){for(const job of [...o.jobs]){job.remaining=Math.max(0,job.remaining-dt);if(!job.remaining&&transaction(o.output,{}, {[job.kind]:job.amount}))o.jobs.splice(o.jobs.indexOf(job),1);}}}
    takeOutput(o){const gain={};for(const s of o.output||[])if(s)gain[s.kind]=(gain[s.kind]||0)+s.amount;if(this.pay({},gain)){o.output.fill(null);return true;}return false;}
    transfer(o,index,toStorage){const from=toStorage?this.inventory:o.storage,to=toStorage?o.storage:this.inventory,s=from[index];if(!s)return false;const a=cloneSlots(from),b=cloneSlots(to);if(!transaction(b,{}, {[s.kind]:s.amount}))return false;a[index]=null;from.splice(0,from.length,...a);to.splice(0,to.length,...b);if(!this.count(this.player.weapon))this.player.weapon='fists';return true;}
    plant(o,kind){if(o.kind!=='planter'||o.crop||!['potato','vegetable'].includes(kind)||!this.remove(kind,1))return false;o.crop={kind,dawns:0};return true;}
    harvest(o){if(o.crop?.dawns<2||!o.crop)return false;if(this.pay({}, {[o.crop.kind]:3})){o.crop=null;return true;}return false;}
    initVisit(){const allowed=this.day>=2&&(this.visitFailures>=2||this.random()<.4);this.visitDay={arrive:allowed?600+this.random()*360:null,arrived:false};}
    updateVisit(){
      if(this.minutes<1320&&this.visitDay?.arrive!==null&&!this.visitDay.arrived&&this.minutes>=this.visitDay.arrive){this.visitDay.arrived=true;this.visitFailures=0;this.visitors.push({id:`visitor:${this.day}`,x:0,y:6,name:'来访幸存者',recruited:false,trades:Array(5).fill(0)});this.announce('幸存者来访，20:00前可以交易。');}
      if(this.minutes>=1200)this.visitors=this.visitors.filter(v=>v.recruited);
      if(this.helper&&this.helper.fedDay===this.day&&this.minutes>=720&&!this.helper.collected)this.helper.ready=true;
    }
    tradeOffer(visitor,index){const t=D.trades[index];if(!this.visitors.includes(visitor)||visitor.recruited||visitor.trades[index]>=2)return false;if(this.pay(t.cost,t.gain)){visitor.trades[index]++;return true;}return false;}
    recruit(visitor){if(this.helper||visitor.recruited)return false;visitor.recruited=true;visitor.x=2;visitor.y=2;this.helper={joinedDay:this.day,fedDay:this.day,collected:false,food:'canned_food'};this.announce('助手已收留，从次日05:00消耗指定食物。');return true;}
    collectHelper(){if(!this.helper?.ready||this.helper.collected)return false;if(this.pay({}, {wood:2,iron:1})){this.helper.collected=true;this.helper.ready=false;return true;}return false;}
    feedHelper(){if(!this.helper)return;const h=this.helper;h.ready=false;h.collected=false;const kind=h.food||'canned_food';h.fedDay=this.day;let paid=this.remove(kind,1);if(!paid){for(const o of this.devices)if(o.kind==='storage_chest'&&o.hp>0&&transaction(o.storage,{[kind]:1})){paid=true;break;}}if(!paid){h.fedDay=0;this.announce('助手没有补给，今天休息。');}}
    finishStats(){this.stats.day=this.day;this.stats.resourceEnd=this.resources();this.stats.realSeconds=this.seconds;this.stats.reason=this.deathReason||'dawn';this.history.push(copy(this.stats));}
    dawn(){
      this.finishStats();if(this.day===7)this.reward={parts:2,cloth:2};if(this.day===14)this.reward={parts:3,canned_food:2};
      if(this.reward){for(const [kind,amount] of Object.entries(this.reward))this.drops.push({kind,amount,x:0,y:2});this.reward=null;}
      if(this.day>=2&&!this.visitDay.arrived)this.visitFailures++;this.day++;this.minutes-=1440;this.zombies=[];this.pendingSpawn=[];this.playerAttack=null;this.projectiles=[];this.zones=[];this.nextWave=0;this.plan=nightPlan(this.day);this.waveDirections=[];this.warnedWaves=[];
      this.stats={planned:0,spawned:0,arrived:0,kills:{},damage:{},lost:0,searches:0,food:[],resourceStart:this.resources()};
      for(const d of this.devices)if(d.hp>0&&d.crop)d.crop.dawns++;
      this.feedHelper();this.initVisit();this.autosaveRequested=true;this.announce(`第${this.day}天05:00，剩余丧尸已清除，准备下一晚。${this.day===8||this.day===15?'尸潮奖励留在院子里。':''}`);
      const unlock={3:'疾跑者出现。可制作铁斧和简易弓。',4:'菜箱开放。',5:'厚皮者出现。锯齿捕兽夹、加强巨弩、晾晒架和燃烧瓶开放。',7:'尸潮夜，可制作手弩并扩容背包。',8:'酸液者出现，急救包开放。',10:'拆墙者出现，连射巨弩和土豆肉派开放。',12:'尖啸者出现，散弹枪开放。',14:'第二次尸潮，准备备用防线与料理。'}[this.day];if(unlock)this.announce(unlock);
    }
    advanceClock(dt){
      this.minutes+=dt/.75;while(this.minutes>=1740)this.dawn();this.updateVisit();
      const elapsed=(this.minutes-1320)*.75,interval=this.day===1?60:50;
      for(let b=0;b<6;b++)if(elapsed>=b*interval-10&&!this.warnedWaves[b]){this.warnedWaves[b]=true;this.waveDirections[b]=Math.floor(this.random()*4);this.announce(`第${b+1}批将从${['东','南','西','北'][this.waveDirections[b]]}侧接近（提前10秒预警）。`);}
      if(elapsed>=0){this.stats.planned=this.plan.N;while(this.nextWave<6&&elapsed+1e-8>=this.nextWave*interval){this.spawnWave();this.nextWave++;}}
      if(elapsed>=0&&this.pendingSpawn.length)this.retrySpawns();
    }
    spawnWave(){const b=this.nextWave,types=this.plan.batches[b],dir=this.waveDirections[b]??Math.floor(this.random()*4),major=this.day%7===0?.75:.5;types.forEach((kind,i)=>this.pendingSpawn.push({kind,dir,major:i<Math.ceil(types.length*major)}));this.announce(`第${this.day}晚第${b+1}批：计划${types.length}只。`);}
    retrySpawns(){
      let attempts=0;for(let i=this.pendingSpawn.length-1;i>=0&&attempts++<40;i--){const request=this.pendingSpawn[i];let p=null;
        for(let n=0;n<30;n++){const angle=request.major?request.dir*Math.PI/2-Math.PI/4+(this.random()-.5)*Math.PI/3:this.random()*Math.PI*2,c={x:this.player.x+Math.cos(angle)*80,y:this.player.y+Math.sin(angle)*80};if(!(Math.abs(c.x)<=5&&c.y>=-6&&c.y<=4)&&!this.obstacles(c,c,.25).length){p=c;break;}}
        if(!p)continue;const def=D.enemies[request.kind];this.zombies.push({...p,kind:request.kind,hp:def.hp,maxHP:def.hp,id:this.spawned++,nextAttack:0,path:[],repathAt:0,rootUntil:0,boostUntil:0,screamAt:0,rangedAt:0});this.stats.spawned++;this.pendingSpawn.splice(i,1);
      }
    }
    *pathSearch(z,target){
      const start={x:Math.round(z.x),y:Math.round(z.y)},goal={x:Math.round(target.x),y:Math.round(target.y)},key=p=>`${p.x},${p.y}`;
      const heap=new MinHeap(),cost=new Map([[key(start),0]]),nodes=new Map([[key(start),start]]),parents=new Map();heap.push({...start,g:0,f:dist(start,goal)});
      let best=start,bestH=dist(start,goal),expanded=0;const def=D.enemies[z.kind];
      while(heap.length&&expanded++<1800){yield;const cur=heap.pop(),k=key(cur);if(cur.g!==cost.get(k))continue;const h=dist(cur,goal);if(h<bestH){best=cur;bestH=h;}if(h<.5){best=cur;break;}
        for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++)if(dx||dy){const next={x:cur.x+dx,y:cur.y+dy};if(Math.abs(next.x-start.x)>100||Math.abs(next.y-start.y)>100)continue;
          const blockers=this.obstacles(cur,next,.24),crossing=blockers.reduce((n,o)=>n+Math.ceil(o.hp/def.building)*def.interval*def.speed,0),g=cur.g+Math.hypot(dx,dy)+crossing,nk=key(next);
          if(g<(cost.get(nk)??Infinity)){cost.set(nk,g);parents.set(nk,k);nodes.set(nk,next);heap.push({...next,g,f:g+dist(next,goal)});}
        }
      }
      const path=[];let k=key(best);while(k!==key(start)&&parents.has(k)){path.push(nodes.get(k));k=parents.get(k);}return path.reverse();
    }
    // Retain the synchronous helper; live enemy AI uses the bounded queue below.
    pathToTarget(z,target){const search=this.pathSearch(z,target);let result;do{result=search.next();}while(!result.done);return result.value;}
    requestPath(z,target){
      this._pathJobs=this._pathJobs||new Map();this._pathQueue=this._pathQueue||[];
      if(this._pathJobs.has(z)||this._pathQueue.length>=8)return false;
      if(!this.obstacles(z,target,.24).some(o=>o!==target)){z.path=[];return true;}
      const start={x:z.x,y:z.y,kind:z.kind},goal={x:target.x,y:target.y};
      const job={z,target,start,goal,revision:this._navigationRevision||0,search:this.pathSearch(start,goal)};
      this._pathJobs.set(z,job);this._pathQueue.push(job);return true;
    }
    updatePaths(){
      const queue=this._pathQueue;if(!queue?.length)return;
      const alive=new Set(this.zombies),now=()=>root.performance?.now?.()??Date.now();
      const deadline=this._frameManaged?(this._pathFrameDeadline??=now()+3):now()+3;
      let remaining=this._pathFrameBudget??256;
      while(queue.length&&remaining>0&&now()<deadline){
        const job=queue.shift(),{z,target}=job;
        if(!alive.has(z)||z.hp<=0||target.hp<=0||job.revision!==(this._navigationRevision||0)||dist(target,job.goal)>12||dist(z,job.start)>4){
          this._pathJobs.delete(z);z.repathAt=Math.min(z.repathAt,this.seconds);continue;
        }
        let result;
        for(let n=0;n<32&&remaining>0;n++,remaining--){result=job.search.next();if(result.done){remaining--;break;}}
        if(result?.done){
          const path=result.value;let closest=0,distance=Infinity;
          for(let i=0;i<path.length;i++){const d=dist(z,path[i]);if(d<=distance){closest=i;distance=d;}}
          z.path=path.slice(closest);this._pathJobs.delete(z);
        }else queue.push(job);
      }
      this._pathFrameBudget=remaining;
    }
    beginFrame(){this._frameManaged=true;this._pathFrameBudget=256;this._pathFrameDeadline=null;}
    endFrame(){this._frameManaged=false;}
    updateDevices(){
      const ordered=this.zombies.filter(z=>z.hp>0).sort((a,b)=>a.id-b.id);
      for(const z of ordered)z.slowUntil=0;
      for(const d of this.devices){if(d.hp<=0)continue;
        if(d.kind==='trap'){
          const combat=D.combatStats(d.kind,d.level);
          if(this.seconds<d.readyAt)continue;const z=ordered.find(z=>z.hp>0&&dist(z,d)<.6);if(z){this.damageZombie(z,combat.damage);d.readyAt=this.seconds+combat.interval;d.flashUntil=this.seconds+.35;if(z.hp>0)z.rootUntil=Math.max(z.rootUntil,this.seconds+(z.kind==='brute'?.5:1));}
        }else if(d.kind==='ballista'){
          const combat=D.combatStats(d.kind,d.level),valid=z=>z.hp>0&&dist(z,d)<=combat.radius&&this.clearLine(d,z,d);
          const candidates=ordered.filter(valid),visibleIds=new Set(candidates.map(z=>String(z.id)));
          d.entered=d.entered||{};for(const id of Object.keys(d.entered))if(!visibleIds.has(id))delete d.entered[id];for(const z of candidates)if(d.entered[z.id]===undefined)d.entered[z.id]=this.seconds;
          let z=candidates.find(z=>z.id===d.targetId);if(!z){for(const candidate of candidates)if(!z||d.entered[candidate.id]<d.entered[z.id]||d.entered[candidate.id]===d.entered[z.id]&&candidate.id<z.id)z=candidate;d.targetId=z?.id;}
          if(z&&this.seconds>=d.readyAt){this.damageZombie(z,combat.damage);d.readyAt=this.seconds+combat.interval;d.flashUntil=this.seconds+.15;d.shot={x:z.x,y:z.y};}
        }else if(d.kind==='spike_floor'){
          const affected=ordered.filter(z=>z.hp>0&&dist(z,d)<.7).slice(0,3);for(const z of affected){z.slowUntil=Math.max(z.slowUntil||0,this.seconds+.08);if(this.seconds>=d.readyAt&&this.seconds>=(z.spikeNext||0)){this.damageZombie(z,1);z.spikeNext=this.seconds+2;}}
        }
      }
    }
    reachableDevice(z,d){
      if(dist(z,d)>6)return false;if(this.clearLine(z,d,d))return true;
      this._deviceReachability=this._deviceReachability||new WeakMap();let cache=this._deviceReachability.get(z);
      if(!cache){cache=new WeakMap();this._deviceReachability.set(z,cache);}
      const x=Math.round(z.x),y=Math.round(z.y),revision=this._navigationRevision||0,previous=cache.get(d);
      if(previous&&previous.until>this.seconds&&previous.x===x&&previous.y===y&&previous.revision===revision)return previous.reachable;
      const reachable=this.searchDeviceReachability(z,d);cache.set(d,{x,y,revision,reachable,until:this.seconds+.5});return reachable;
    }
    searchDeviceReachability(z,d){
      const start={x:Math.round(z.x),y:Math.round(z.y)},queue=[start],seen=new Set([`${start.x},${start.y}`]);
      for(let i=0;i<queue.length&&i<200;i++){const p=queue[i];if(pointRect(p,d)<=1&&this.clearLine(p,d,d))return true;
        for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const next={x:p.x+dx,y:p.y+dy},k=`${next.x},${next.y}`;if(seen.has(k)||dist(next,z)>7||this.obstacles(p,next,.24).some(o=>o!==d))continue;seen.add(k);queue.push(next);}
      }return false;
    }
    updateZombies(dt){
      if(!this._frameManaged)this._pathFrameBudget=256;
      this.updatePaths();
      for(const z of this.zombies){if(z.hp<=0)continue;const def=D.enemies[z.kind];
        if(!z.arrived&&dist(z,this.player)<=10){z.arrived=true;this.stats.arrived++;}
        if(z.windup){if(this.seconds>=z.windup.until){const attack=z.windup;z.windup=null;
          if(attack.type==='scream'){for(const other of this.zombies)if(other!==z&&other.hp>0&&other.kind!=='screamer'&&dist(other,z)<=6)other.boostUntil=Math.max(other.boostUntil,this.seconds+8);this.effects.push({kind:'scream_ring',x:z.x,y:z.y,radius:6,until:this.seconds+.8});}
          else if(attack.type==='spit'){const target=attack.target==='player'?(this.hidden?null:this.player):this.find(attack.target);if(target&&target.hp>0&&dist(z,target)<=7&&this.clearLine(z,target,target)){const dx=target.x-z.x,dy=target.y-z.y,length=Math.hypot(dx,dy)||1;this.projectiles.push({kind:'acid_projectile',x:z.x,y:z.y,vx:dx/length*5,vy:dy/length*5,range:7,damage:2,owner:'enemy'});}}
          else {const target=attack.target==='player'?(this.hidden?null:this.player):this.find(attack.target);if(target&&target.hp>0&&(attack.target==='player'?dist(z,target):pointRect(z,target))<=1&&this.clearLine(z,target,target)){if(attack.target==='player')this.damagePlayer(def.damage,z.kind);else this.damageBuilding(target,def.building);}}
        }continue;}
        if(z.rootUntil>this.seconds)continue;
        if(z.kind==='screamer'&&this.seconds>=z.screamAt&&this.zombies.some(o=>o!==z&&o.kind!=='screamer'&&o.hp>0&&dist(o,z)<=6)){z.screamAt=this.seconds+20;z.windup={type:'scream',until:this.seconds+1.5};continue;}
        let target=this.enemyTarget?this.enemyTarget(z):this.player;
        if(z.kind==='demolisher'){const devices=this.devices.filter(d=>d.hp>0&&dist(d,z)<=6).sort((a,b)=>dist(a,z)-dist(b,z)),device=devices.find(d=>this.reachableDevice(z,d));if(device)target=device;}
        if(z.kind==='spitter'&&(target===this.player||target.id)&&this.seconds>=z.rangedAt&&this.seconds>=z.nextAttack&&dist(z,target)<=7&&dist(z,target)>1&&this.clearLine(z,target,target)){z.rangedAt=this.seconds+4;z.nextAttack=this.seconds+4;z.facing={x:target.x-z.x,y:target.y-z.y};z.windup={type:'spit',target:target===this.player?'player':target.id,until:this.seconds+1};continue;}
        const attack=obstacle=>{if(this.seconds<z.nextAttack)return;z.nextAttack=this.seconds+def.interval;z.facing={x:obstacle.x-z.x,y:obstacle.y-z.y};const id=obstacle===this.player?'player':obstacle.id;
          if(['brute','demolisher'].includes(z.kind))z.windup={type:'melee',target:id,until:this.seconds+def.windup};else if(id==='player')this.damagePlayer(def.damage,z.kind);else this.damageBuilding(obstacle,def.building);
        };
        const distanceToTarget=target.type?pointRect(z,target):dist(z,target);
        if((target===this.player||target.id)&&distanceToTarget<=1&&this.clearLine(z,target,target)){attack(target);continue;}
        if(this.seconds>=z.repathAt&&this.pathBudget>0&&this.requestPath(z,target)){this.pathBudget--;z.repathAt=this.seconds+3+z.id%7*.15;}
        while(z.path.length&&dist(z,z.path[0])<.15)z.path.shift();
        const waypoint=z.path[0]||target,distance=dist(z,waypoint);if(!distance)continue;
        const speed=def.speed*(z.boostUntil>this.seconds?1.2:1)*(z.slowUntil>this.seconds ? .7 : 1),step=Math.min(distance,speed*dt),next={x:z.x+(waypoint.x-z.x)/distance*step,y:z.y+(waypoint.y-z.y)/distance*step};
        z.facing={x:waypoint.x-z.x,y:waypoint.y-z.y};const blockers=this.obstacles(z,next,.24).filter(o=>o.hp>0);
        if(!blockers.length){z.x=next.x;z.y=next.y;}
        else {const priority=o=>o.type==='fence'||['wood_fence','iron_fence'].includes(o.kind)?0:o.type==='door'?1:o.type==='wall'||o.kind==='brick_wall'?2:3;
          const o=blockers.sort((a,b)=>priority(a)-priority(b)||pointRect(z,a)-pointRect(z,b))[0];if(pointRect(z,o)<=1&&this.clearLine(z,o,o))attack(o);}
        if(this.result)return;
      }
    }
    updateProjectiles(dt){
      for(const shot of this.projectiles){if(shot.dead)continue;
        if(shot.kind==='molotov_projectile'){
          shot.elapsed=Math.min(shot.duration,shot.elapsed+dt);const next=this.molotovPoint(shot,shot.elapsed/shot.duration);
          if(this.obstacles(shot,next,0).length){shot.dead=true;this.igniteMolotov(shot);}
          else {Object.assign(shot,next);if(shot.elapsed>=shot.duration){shot.dead=true;this.igniteMolotov(shot);}}
          continue;
        }
        const from={x:shot.x,y:shot.y},length=Math.min(shot.range,Math.hypot(shot.vx,shot.vy)*dt),speed=Math.hypot(shot.vx,shot.vy),to={x:from.x+shot.vx/speed*length,y:from.y+shot.vy/speed*length};
        const hits=this.obstacles(from,to,0).map(o=>({object:o,distance:dist(from,o),type:'building'}));
        const targets=shot.owner==='enemy'?[this.player]:this.zombies.filter(z=>z.hp>0);for(const o of targets)if(segmentHits(from,to,{x:o.x,y:o.y,w:.45,h:.45},.05))hits.push({object:o,distance:dist(from,o),type:shot.owner==='enemy'?'player':'zombie'});
        // Sort by first intersection along the segment, rather than object centers.
        for(const hit of hits){let lo=0,hi=1;for(let i=0;i<12;i++){const t=(lo+hi)/2,p={x:from.x+(to.x-from.x)*t,y:from.y+(to.y-from.y)*t},o=hit.object,r=hit.type==='building'?o:{x:o.x,y:o.y,w:.45,h:.45};if(segmentHits(from,p,r,0))hi=t;else lo=t;}hit.t=hi;}
        hits.sort((a,b)=>a.t-b.t);const hit=hits[0];shot.x=to.x;shot.y=to.y;shot.range-=length;
        if(hit){shot.x=from.x+(to.x-from.x)*hit.t;shot.y=from.y+(to.y-from.y)*hit.t;shot.dead=true;if(hit.type==='zombie')this.damageZombie(hit.object,this.directDamage?this.directDamage(shot.damage):shot.damage,'weapon');else if(shot.owner==='enemy'){if(hit.type==='player')this.damagePlayer(shot.damage??2,shot.source||'spitter');else this.damageBuilding(hit.object,(this.ParkingLampKind?.(hit.object.kind)?shot.lampDamage:null)??shot.buildingDamage??1);}}
        if(shot.range<=.001)shot.dead=true;
        if(shot.dead&&shot.kind==='stone_projectile')this.parkingVisual?.('stone_impact',shot,.35,22);
        if(shot.dead&&shot.kind==='acid_projectile')this.zones.push({kind:'acid_pool',x:shot.x,y:shot.y,radius:1,until:this.seconds+3});
      }
      this.projectiles=this.projectiles.filter(p=>!p.dead);
    }
    updateZones(dt){
      this.zones=this.zones.filter(z=>z.until>this.seconds);
      for(const [kind,amount] of [['acid_pool',1],['fire_pool',.5]]){const inside=this.zones.some(z=>z.kind===kind&&dist(z,this.player)<=z.radius&&this.clearLine(z,this.player));const key=kind==='acid_pool'?'acidTime':'fireTime';if(!inside)this[key]=0;else{this[key]=(this[key]||0)+dt;if(this[key]>=1){this[key]-=1;this.damagePlayer(amount,kind,true);}}}
      for(const z of this.zombies)if(z.hp>0){
        const pool=this.zones.find(p=>p.kind==='fire_pool'&&dist(z,p)<=p.radius&&this.clearLine(p,z));
        if(pool&&!z.burningUntil){z.burningUntil=pool.until;z.burnNext=this.seconds+1;z.burnSource=pool.source||'molotov';}
        if(z.burningUntil&&z.burnNext<=z.burningUntil+1e-8&&this.seconds+1e-8>=z.burnNext){this.damageZombie(z,.5,z.burnSource||'molotov');z.burnNext+=1;}
        if(z.burningUntil+1e-8<this.seconds&&z.burnNext>z.burningUntil+1e-8)z.burningUntil=0;
      }
    }
    snapshot(){
      const homeData=[...this.homes.values()].map(h=>({format:'delta',cx:h.cx,cy:h.cy,
        objects:h.objects.filter(o=>o.hp!==o.maxHP||o.level||o.open).map(o=>({id:o.id,hp:o.hp,maxHP:o.maxHP,level:o.level||0,open:!!o.open,invested:o.invested})),
        sites:h.sites.filter(s=>s.searched||s.blocking&&s.hp!==s.maxHP).map(s=>({id:s.id,searched:s.searched,hp:Number.isFinite(s.hp)?s.hp:null}))
      })).filter(h=>h.objects.length||h.sites.length);
      return copy({version:1,developerUsed:!!this.developerUsed,day:this.day,seconds:this.seconds,minutes:this.minutes,player:this.player,playerAttack:this.playerAttack,inventory:this.inventory,drops:this.drops,homes:homeData,devices:this.devices.map(({target,...d})=>d),zombies:this.zombies,visitors:this.visitors,projectiles:this.projectiles,zones:this.zones,effects:this.effects,nextWave:this.nextWave,plan:this.plan,pendingSpawn:this.pendingSpawn,waveDirections:this.waveDirections,warnedWaves:this.warnedWaves,spawned:this.spawned,kills:this.kills,deviceId:this.deviceId,visitFailures:this.visitFailures,visitDay:this.visitDay,helper:this.helper,mainBuff:this.mainBuff,teaBuff:this.teaBuff,foodRegen:this.foodRegen,bandage:this.bandage,nextRecoveryAt:Number.isFinite(this.nextRecoveryAt)?this.nextRecoveryAt:null,lastSpent:Number.isFinite(this.lastSpent)?this.lastSpent:null,lastRecoveryAt:this.lastRecoveryAt,recoveryInterval:this.recoveryInterval,attackAt:this.attackAt,foodAt:this.foodAt,waterAt:this.waterAt,throwAt:this.throwAt,starving:this.starving||0,acidTime:this.acidTime||0,fireTime:this.fireTime||0,history:this.history,stats:this.stats,result:this.result,deathReason:this.deathReason||null});
    }
    static restore(data){
      if(!data||data.version!==1||!Array.isArray(data.inventory)||!data.player||!Number.isFinite(data.day))throw new Error('存档格式不兼容');
      const game=new SurvivalGame();for(const [key,value] of Object.entries(data))if(!['version','homes','drops'].includes(key))game[key]=copy(value);
      game.drops=Array.isArray(data.drops)?copy(data.drops):[];
      game.homes=new Map();for(const saved of data.homes){const h=game.getHome(saved.cx,saved.cy);
        if(saved.format==='delta'){for(const state of saved.objects){const o=h.objects.find(o=>o.id===state.id);if(o)Object.assign(o,state);}for(const state of saved.sites){const s=h.sites.find(s=>s.id===state.id);if(s)Object.assign(s,state,{hp:state.hp===null?Infinity:state.hp});}}
        else {h.objects=saved.objects.map(o=>({...o,home:h}));h.sites=saved.sites.map(o=>({...o,hp:o.hp===null?Infinity:o.hp,home:h}));}
        h.furniture=h.objects.filter(o=>o.type==='furniture');h.doors=h.objects.filter(o=>o.type==='door');
      }
      for(const z of game.zombies)if(!z.path?.length)z.repathAt=Math.min(z.repathAt??0,game.seconds);
      game.nextRecoveryAt=data.nextRecoveryAt===null?Infinity:data.nextRecoveryAt;game.lastSpent=data.lastSpent===null?-Infinity:data.lastSpent;game.action=null;game.events=[];game.selectedSlot=0;game.pathBudget=2;game.autosaveRequested=false;game.announce('存档已恢复。');return game;
    }
    step(dt,input={}){
      if(this.result||dt<=0)return;this.seconds+=dt;this.pathBudget=2;this.updateDoors();this.movePlayer(dt,input);this.updateDoors();this.updateIndoorHome();this.updateVitals(dt);if(this.result)return;
      this.updateAction(dt);this.updatePlayerAttack();this.updateProduction(dt);this.advanceClock(dt);this.updateDevices(dt);this.updateZombies(dt);this.updateProjectiles(dt);this.updateZones(dt);this.effects=this.effects.filter(e=>e.until>this.seconds);if(this.devices.some(d=>d.hp<=0))this.devices=this.devices.filter(d=>d.hp>0);this.zombies=this.zombies.filter(z=>z.hp>0);
    }
  }
  S.Game=SurvivalGame;S.RECIPES=Object.fromEntries(Object.entries(D.builds).map(([k,d])=>[k,d.cost]));S.Expansion=D;S.nightPlan=nightPlan;S.transaction=transaction;
  if(typeof module!=='undefined'&&module.exports)module.exports=S;else root.Survival=S;
})(typeof globalThis!=='undefined'?globalThis:this);
