/* 游戏规则与场景计算。这里不操作画面，方便单独检查游戏逻辑。 */
(function (root) {
  'use strict';
  const RULES = Object.freeze({ hp: 12, stamina: 10, walk: 2, run: 4,
    staminaRecoveryDelay: 2, staminaRecoveryInterval: 2,
    zombieHP: 3, zombieDamage: 3, zombieSpeed: 1.5, attackDistance: 1,
    attackInterval: 2, waveInterval: 60, waveSize: 6, spawnRadius: 80,
    realSecondsPerMinute: .75, fenceHP: 6, trapDamage: 3, trapInterval: 7,
    bowInterval: 1, bowDamage: 1, bowRadius: Math.sqrt(9 / Math.PI),
    lotSpacing: 28, stackLimit: 99, slots: 20 });
  const RECIPES = { trap: { iron: 3 }, ballista: { wood: 5 } };
  const NAMES = { iron: '铁', wood: '木头', trap: '捕兽夹', ballista: '巨弩' };
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const pointRect = (p, r) => Math.hypot(p.x - clamp(p.x, r.x-r.w/2, r.x+r.w/2), p.y-clamp(p.y, r.y-r.h/2, r.y+r.h/2));
  function segmentHits(a, b, r, padding = 0) {
    let lo = 0, hi = 1;
    for (const [axis, size] of [['x', 'w'], ['y', 'h']]) {
      const min = r[axis]-r[size]/2-padding, max = r[axis]+r[size]/2+padding;
      const d = b[axis]-a[axis];
      if (Math.abs(d) < 1e-8) { if (a[axis] < min || a[axis] > max) return false; }
      else { const t1=(min-a[axis])/d, t2=(max-a[axis])/d; lo=Math.max(lo,Math.min(t1,t2)); hi=Math.min(hi,Math.max(t1,t2)); if(lo>hi)return false; }
    }
    return true;
  }
  class Heap {
    constructor(){this.items=[];}
    push(v){const a=this.items;a.push(v);let i=a.length-1;while(i>0){const p=(i-1)>>1;if(a[p].f<=v.f)break;a[i]=a[p];i=p;}a[i]=v;}
    pop(){const a=this.items, first=a[0], last=a.pop();if(a.length){let i=0;while(i*2+1<a.length){let c=i*2+1;if(c+1<a.length&&a[c+1].f<a[c].f)c++;if(a[c].f>=last.f)break;a[i]=a[c];i=c;}a[i]=last;}return first;}
    get length(){return this.items.length;}
  }
  class Game {
    constructor(options = {}) {
      this.random = options.random || Math.random;
      this.player = { x:0, y:2, hp:RULES.hp, stamina:RULES.stamina, name:options.name || '幸存者', facing:{x:0,y:1}, running:false, hurtUntil:0, indoorHome:null };
      this.minutes = options.startMinutes ?? 300;
      this.seconds = 0; this.nextRecoveryAt = Infinity;
      this.nextWave = 0; this.lastVisitorHour = Math.floor(this.minutes/60);
      this.homes = new Map(); this.zombies=[]; this.devices=[]; this.drops=[]; this.visitors=[];
      this.inventory = Array(RULES.slots).fill(null);
      this.inventory[0]={kind:'iron',amount:6}; this.inventory[1]={kind:'wood',amount:13};
      this.events=[]; this.result=null; this.kills=0; this.spawned=0; this.deviceId=0; this.selectedSlot=0;
      this.getHome(0,0);
    }
    announce(text){this.events.push(text);}
    count(kind){return this.inventory.reduce((n,s)=>n+(s?.kind===kind?s.amount:0),0);}
    add(kind, amount=1){
      const available=this.inventory.reduce((n,s)=>n+(!s?RULES.stackLimit:s.kind===kind?RULES.stackLimit-s.amount:0),0);
      if(available<amount)return false;
      let left=amount;
      for(const s of this.inventory){if(s?.kind===kind){const take=Math.min(left,RULES.stackLimit-s.amount);s.amount+=take;left-=take;if(!left)return true;}}
      for(let i=0;i<this.inventory.length&&left;i++){if(!this.inventory[i]){const take=Math.min(left,RULES.stackLimit);this.inventory[i]={kind,amount:take};left-=take;}}
      return true;
    }
    remove(kind,amount){if(this.count(kind)<amount)return false;for(let i=0;i<this.inventory.length&&amount;i++){const s=this.inventory[i];if(s?.kind===kind){const take=Math.min(amount,s.amount);s.amount-=take;amount-=take;if(!s.amount)this.inventory[i]=null;}}return true;}
    getHome(cx,cy){
      const key=`${cx},${cy}`;if(this.homes.has(key))return this.homes.get(key);
      const x=cx*RULES.lotSpacing,y=cy*RULES.lotSpacing;
      const home={cx,cy,x,y,objects:[],furniture:[],doors:[],own:cx===0&&cy===0};
      const rect=(type,dx,dy,w,h,hp=Infinity)=>({type,x:x+dx,y:y+dy,w,h,hp,home});
      home.objects.push(rect('wall',0,-6,10,.24),rect('wall',-5,-3,.24,6),rect('wall',5,-3,.24,6),rect('wall',-2.9,0,4.2,.24),rect('wall',2.9,0,4.2,.24));
      const door=rect('door',0,0,1.6,.22,6), gate=rect('door',0,4,2,.22,6);
      door.open=false;gate.open=false;home.doors.push(door,gate);home.objects.push(door,gate);
      for(let n=0;n<4;n++)home.objects.push(rect('fence',-5,n+.5,.16,1,6),rect('fence',5,n+.5,.16,1,6));
      for(let n=0;n<10;n++){const fx=-4.5+n;if(Math.abs(fx)>.9)home.objects.push(rect('fence',fx,4,1,.16,6));}
      const fixtures=[['铁柜','iron',-3,-4],['铁架','iron',3,-4],['木桌','wood',-2,-2],['木椅','wood',-3,-1],['木柜','wood',3,-2]];
      for(const [name,material,dx,dy]of fixtures){const f=rect('furniture',dx,dy,.65,.65,1);f.name=name;f.material=material;home.furniture.push(f);home.objects.push(f);}
      this.homes.set(key,home);return home;
    }
    nearbyHomes(p, radius=35){const n=Math.ceil(radius/RULES.lotSpacing),cx=Math.round(p.x/RULES.lotSpacing),cy=Math.round(p.y/RULES.lotSpacing),out=[];for(let x=cx-n;x<=cx+n;x++)for(let y=cy-n;y<=cy+n;y++)out.push(this.getHome(x,y));return out;}
    active(o){return o.hp>0&&!(o.type==='door'&&o.open);}
    obstacles(a,b=a,padding=.22){
      const mid={x:(a.x+b.x)/2,y:(a.y+b.y)/2};
      const home=this.getHome(Math.round(mid.x/RULES.lotSpacing),Math.round(mid.y/RULES.lotSpacing));
      return home.objects.filter(o=>this.active(o)&&segmentHits(a,b,o,padding));
    }
    clearLine(a,b,ignore=null){
      const steps=Math.ceil(dist(a,b)/.6);
      for(let i=0;i<steps;i++){const p={x:a.x+(b.x-a.x)*i/steps,y:a.y+(b.y-a.y)*i/steps},q={x:a.x+(b.x-a.x)*(i+1)/steps,y:a.y+(b.y-a.y)*(i+1)/steps};if(this.obstacles(p,q,0).some(o=>o!==ignore))return false;}
      return true;
    }
    updateDoors(){for(const home of this.homes.values())for(const door of home.doors){if(door.hp<=0)continue;const d=pointRect(this.player,door);if(d<1.25)door.open=true;else if(d>1.6){const occupied=this.zombies.some(z=>z.hp>0&&pointRect(z,door)<.3);if(!occupied)door.open=false;}}}
    movePlayer(dt,input){
      let sx=(input.right?1:0)-(input.left?1:0)+(input.moveX||0),sy=(input.down?1:0)-(input.up?1:0)+(input.moveY||0);
      const length=Math.hypot(sx,sy),moving=length>0,running=moving&&input.run&&this.player.stamina>0;
      const before={x:this.player.x,y:this.player.y},wasRunning=this.player.running;
      if(moving){
        sx/=length;sy/=length;const direction={x:(sx+sy)/Math.SQRT2,y:(sy-sx)/Math.SQRT2};this.player.facing=direction;
        const speed=(running?RULES.run:RULES.walk)*Math.min(1,length);
        const nx={x:this.player.x+direction.x*speed*dt,y:this.player.y};if(!this.obstacles(this.player,nx).length)this.player.x=nx.x;
        const ny={x:this.player.x,y:this.player.y+direction.y*speed*dt};if(!this.obstacles(this.player,ny).length)this.player.y=ny.y;
      }
      this.player.running=Boolean(running&&dist(before,this.player)>1e-8);
      if(this.player.running){this.player.stamina=Math.max(0,this.player.stamina-dt);this.nextRecoveryAt=Infinity;}
      else {
        if(wasRunning||(this.player.stamina<RULES.stamina&&!Number.isFinite(this.nextRecoveryAt)))this.nextRecoveryAt=this.seconds-dt+RULES.staminaRecoveryDelay;
        while(this.seconds+1e-8>=this.nextRecoveryAt&&this.player.stamina<RULES.stamina){this.player.stamina=Math.min(RULES.stamina,this.player.stamina+1);this.nextRecoveryAt+=RULES.staminaRecoveryInterval;}
      }
    }
    updateIndoorHome(){
      const p=this.player;
      if(p.indoorHome){const h=this.homes.get(p.indoorHome);if(!h||Math.abs(p.x-h.x)>5.25||p.y<h.y-6.25||p.y>h.y+.22)p.indoorHome=null;}
      if(!p.indoorHome){const h=this.getHome(Math.round(p.x/RULES.lotSpacing),Math.round(p.y/RULES.lotSpacing));if(Math.abs(p.x-h.x)<4.65&&p.y>h.y-5.65&&p.y<h.y-.35)p.indoorHome=`${h.cx},${h.cy}`;}
    }
    damagePlayer(amount){
      this.player.hp=Math.max(0,this.player.hp-amount);this.player.hurtUntil=this.seconds+1;
      if(this.player.hp===0)this.result='dead';
    }
    advanceClock(dt){
      if(this.result)return;
      const old=this.minutes;this.minutes+=dt/RULES.realSecondsPerMinute;
      if(this.minutes>=1740){this.minutes=1740;this.zombies=[];this.result=this.player.hp>0?'win':'dead';this.announce('05:00到了，剩余丧尸全部消失。');return;}
      if(this.minutes>=1320){
        if(old<1320)this.announce('22:00，丧尸开始来袭。守到05:00！');
        const elapsed=(this.minutes-1320)*RULES.realSecondsPerMinute;
        while(elapsed+1e-7>=this.nextWave*RULES.waveInterval){this.spawnWave();this.nextWave++;}
      }else{
        const hour=Math.floor(this.minutes/60);
        if(hour>this.lastVisitorHour){this.lastVisitorHour=hour;if(this.visitors.filter(v=>!v.recruited).length===0&&this.random()<.18){this.visitors.push({x:0,y:6,recruited:false,name:'来访幸存者'});this.announce('院门外有幸存者来访，可以按E交谈。');}}
      }
    }
    spawnWave(){
      for(let n=0;n<RULES.waveSize;n++){
        let p=null;
        for(let attempt=0;attempt<400;attempt++){
          const angle=this.random()*Math.PI*2,radius=RULES.spawnRadius;
          const candidate={x:this.player.x+Math.cos(angle)*radius,y:this.player.y+Math.sin(angle)*radius};
          const outside=!(candidate.x>=-5&&candidate.x<=5&&candidate.y>=-6&&candidate.y<=4);
          if(outside&&!this.obstacles(candidate,candidate,.25).length&&dist(candidate,this.player)>1.2){p=candidate;break;}
        }
        // 备用方向也保持距离玩家80米，并排除领地和障碍物。
        if(!p){for(let a=0;a<64;a++){const candidate={x:this.player.x+Math.cos(a*Math.PI/32)*RULES.spawnRadius,y:this.player.y+Math.sin(a*Math.PI/32)*RULES.spawnRadius};if(!(Math.abs(candidate.x)<=5&&candidate.y>=-6&&candidate.y<=4)&&!this.obstacles(candidate,candidate,.25).length){p=candidate;break;}}}
        if(!p)continue;
        this.zombies.push({...p,hp:3,id:this.spawned++,nextAttack:0,path:[],repathAt:0});
      }
      this.announce(`第${this.nextWave+1}批丧尸出现（6只）。`);
    }
    pathToPlayer(z){
      const start={x:Math.round(z.x),y:Math.round(z.y)},goal={x:Math.round(this.player.x),y:Math.round(this.player.y)};
      const key=p=>`${p.x},${p.y}`, startKey=key(start),heap=new Heap(),cost=new Map([[startKey,0]]),parents=new Map(),nodes=new Map([[startKey,start]]);
      heap.push({...start,f:dist(start,goal),g:0});let best=start,bestH=dist(start,goal),expanded=0;
      while(heap.length&&expanded++<2200){
        const cur=heap.pop(),curKey=key(cur);if(cur.g!==cost.get(curKey))continue;
        const h=dist(cur,goal);if(h<bestH){best=cur;bestH=h;}if(h<.1){best=cur;break;}
        for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++){
          if(!dx&&!dy)continue;const next={x:cur.x+dx,y:cur.y+dy};
          if(Math.abs(next.x-start.x)>125||Math.abs(next.y-start.y)>125)continue;
          const blockers=this.obstacles(cur,next,.24);if(blockers.some(o=>o.type==='wall'||o.type==='furniture'))continue;
          // 护栏可被破坏；门使用初版暂定血量，代价略高于护栏。
          const crossing=blockers.reduce((v,o)=>v+(o.type==='fence'?5:9),0);
          const g=cur.g+Math.hypot(dx,dy)+crossing,k=key(next);
          if(g<(cost.get(k)??Infinity)){cost.set(k,g);parents.set(k,curKey);nodes.set(k,next);heap.push({...next,g,f:g+dist(next,goal)});}
        }
      }
      const path=[];let k=key(best);while(k!==startKey&&parents.has(k)){path.push(nodes.get(k));k=parents.get(k);}return path.reverse();
    }
    damageZombie(z,amount){if(z.hp<=0)return;z.hp-=amount;if(z.hp<=0){this.kills++;}}
    updateDevices(){for(const d of this.devices){
      if(d.kind==='trap'){
        if(this.seconds<d.readyAt)continue;const z=this.zombies.find(z=>z.hp>0&&dist(z,d)<.6);
        if(z){this.damageZombie(z,3);d.readyAt=this.seconds+7;d.flashUntil=this.seconds+.3;}
      }else{
        const valid=z=>z.hp>0&&dist(z,d)<=RULES.bowRadius&&this.clearLine(d,z);
        if(!d.target||!valid(d.target))d.target=this.zombies.find(valid)||null;
        if(d.target&&this.seconds>=d.readyAt){this.damageZombie(d.target,1);d.readyAt=this.seconds+1;d.flashUntil=this.seconds+.15;d.shot={x:d.target.x,y:d.target.y};}
      }
    }}
    updateZombies(dt){for(const z of this.zombies){
      if(z.hp<=0)continue;
      if(dist(z,this.player)<=1&&this.clearLine(z,this.player)){
        if(this.seconds>=z.nextAttack){this.damagePlayer(RULES.zombieDamage);z.nextAttack=this.seconds+RULES.attackInterval;if(this.result)return;}continue;
      }
      if(this.seconds>=z.repathAt){z.path=this.pathToPlayer(z);z.repathAt=this.seconds+2+z.id%5*.15;}
      while(z.path.length&&dist(z,z.path[0])<.15)z.path.shift();
      const target=z.path[0]||this.player, distance=dist(z,target);if(!distance)continue;
      const step=Math.min(distance,RULES.zombieSpeed*dt),next={x:z.x+(target.x-z.x)/distance*step,y:z.y+(target.y-z.y)/distance*step};
      z.facing={x:target.x-z.x,y:target.y-z.y};
      const hits=this.obstacles(z,next,.24);
      if(!hits.length){z.x=next.x;z.y=next.y;}
      else{
        const fence=hits.find(o=>o.type==='fence'),obstacle=fence||hits.find(o=>o.type==='door');
        if(obstacle&&pointRect(z,obstacle)<=1&&this.seconds>=z.nextAttack){obstacle.hp=Math.max(0,obstacle.hp-3);z.nextAttack=this.seconds+2;if(!obstacle.hp){z.repathAt=0;this.announce(obstacle.type==='fence'?'一块护栏被丧尸破坏了。':'一扇门被丧尸破坏了。');}}
        else if(!obstacle)z.repathAt=Math.min(z.repathAt,this.seconds+.2);
      }
    }this.zombies=this.zombies.filter(z=>z.hp>0);}
    step(dt,input={}){
      if(this.result||dt<=0)return;
      this.seconds+=dt;this.updateDoors();this.movePlayer(dt,input);this.updateDoors();this.updateIndoorHome();this.advanceClock(dt);
      if(this.result)return;this.updateDevices();this.updateZombies(dt);
    }
    nearbyInteraction(){
      const choices=[];
      for(const home of this.nearbyHomes(this.player,10))for(const f of home.furniture)if(f.hp>0&&dist(f,this.player)<1.5)choices.push({type:'furniture',object:f,distance:dist(f,this.player)});
      for(const item of this.drops)if(dist(item,this.player)<1.5)choices.push({type:'drop',object:item,distance:dist(item,this.player)});
      for(const device of this.devices)if(dist(device,this.player)<1.5)choices.push({type:'device',object:device,distance:dist(device,this.player)});
      for(const visitor of this.visitors)if(!visitor.recruited&&dist(visitor,this.player)<1.8)choices.push({type:'visitor',object:visitor,distance:dist(visitor,this.player)});
      return choices.filter(c=>this.clearLine(this.player,c.object,c.object)).sort((a,b)=>a.distance-b.distance)[0]||null;
    }
    interact(target){
      if(!target)return false;
      if(target.type==='device')return this.dismantle(target.object);
      if(target.type==='furniture'){
        const f=target.object;if(f.hp<=0)return false;
        if(!this.add(f.material,1)){this.announce('背包已满，无法收集材料。');return false;}
        f.hp=0;this.announce(`拆除${f.name}，获得1份${NAMES[f.material]}。`);return true;
      }
      if(target.type==='drop'){
        const item=target.object;if(!this.drops.includes(item))return false;
        if(!this.add(item.kind,item.amount)){this.announce('背包已满。');return false;}
        this.drops.splice(this.drops.indexOf(item),1);this.announce(`拾取${item.amount}份${NAMES[item.kind]}。`);return true;
      }
      return false;
    }
    drop(){const s=this.inventory[this.selectedSlot];if(!s){this.announce('选中的背包格子是空的。');return false;}const kind=s.kind;this.removeFromSlot(this.selectedSlot,1);this.drops.push({kind,amount:1,x:this.player.x,y:this.player.y});this.announce(`丢下1份${NAMES[kind]}，靠近按E可以捡回。`);return true;}
    removeFromSlot(i,n){const s=this.inventory[i];if(s){s.amount-=n;if(s.amount<=0)this.inventory[i]=null;}}
    placementPoint(){return {x:this.player.x+this.player.facing.x*1.3,y:this.player.y+this.player.facing.y*1.3};}
    canPlace(kind,p){
      if(!RECIPES[kind])return '未知装置';
      for(const [material,n]of Object.entries(RECIPES[kind]))if(this.count(material)<n)return `${NAMES[material]}不足，需要${n}份`;
      if(this.obstacles(p,p,.4).length)return '这里被建筑或家具挡住了';
      if(this.devices.some(d=>dist(d,p)<.9))return '离已有装置太近';
      return null;
    }
    place(kind,p){const error=this.canPlace(kind,p);if(error){this.announce(error);return false;}for(const [material,n]of Object.entries(RECIPES[kind]))this.remove(material,n);this.devices.push({...p,kind,id:this.deviceId++,readyAt:0,target:null});this.announce(`${NAMES[kind]}已布置。`);return true;}
    dismantle(device){
      if(!this.devices.includes(device))return false;
      const before=this.inventory.map(s=>s?{...s}:null);
      for(const [material,amount]of Object.entries(RECIPES[device.kind])){
        if(!this.add(material,amount)){this.inventory=before;this.announce('背包空间不足，腾出空间后再拆除。');return false;}
      }
      this.devices.splice(this.devices.indexOf(device),1);this.announce(`已拆除${NAMES[device.kind]}，返还全部建造材料。`);return true;
    }
    trade(give,take){
      if(this.count(give)<3){this.announce(`需要3份${NAMES[give]}。`);return false;}
      const before=this.inventory.map(s=>s?{...s}:null);this.remove(give,3);
      if(!this.add(take,1)){this.inventory=before;this.announce('背包没有空间接收物资。');return false;}
      this.announce(`用3份${NAMES[give]}换取1份${NAMES[take]}。`);return true;
    }
  }
  const api={Game,RULES,RECIPES,NAMES,dist,pointRect,segmentHits};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.Survival=api;
})(typeof globalThis!=='undefined'?globalThis:this);
