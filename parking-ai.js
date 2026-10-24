/* Bounded parking navigation fields shared by enemies, plus the unique Boss state machine. */
(function(root){
  'use strict';const common=typeof module!=='undefined'&&module.exports;
  const S=common?require('./parking-lights.js'):root.Survival,P=S.Parking,D=S.Expansion,Base=S.ParkingBase;
  const {dist,pointRect,segmentHits}=S,key=S.parkingKey,steps=[[1,0],[-1,0],[0,1],[0,-1]];
  Object.assign(S.Game.prototype,{
    ParkingLampKind(kind){return !!P.lamps[kind];},
    enemyDef(kind){const own=P.enemies[kind];if(own)return own;const d=D.enemies[kind];return {...d,speed:Math.min(3.2,d.speed*1.2),damage:d.damage+1,building:d.building+1};},
    enemyAttackVisual(z,kind,target){
      if(target)z.facing={x:target.x-z.x,y:target.y-z.y};
      z.visualAttack={kind,releaseUntil:this.seconds+.15,until:this.seconds+.4,facing:{...(z.facing||{x:0,y:1})}};
    },
    enemyMovementVisual(z,from,retreat){
      const moved=dist(z,from);if(moved>.00001){z.visualDistance=(z.visualDistance||0)+moved;z.visualMoveAt=this.seconds;}
      if(retreat)z.visualRetreatUntil=this.seconds+.12;
    },
    crushBuilding(o){if(o.hp>0){this.parkingVisual('building_crush',o,.5,38);this.damageBuilding(o,o.hp);}},
    spawnUnderground(kind,p,source){
      const d=P.enemies[kind]||D.enemies[kind],z={...p,id:`underground:${this.spawned++}`,kind,hp:d.hp,maxHP:d.hp,nextAttack:0,rootUntil:0,boostUntil:0,rangedAt:0,screamAt:this.seconds+3,source,lastSeen:null,alerted:false};
      this.zombies.push(z);if(source==='regular')this.parking.generated++;return z;
    },
    legalSpawn(p){return !this.obstacles(p,p,.4).length&&dist(p,this.player)>=12&&dist(p,P.exit)>=6&&!this.canSee(p)&&!this.isLit(p)&&this.staticReachable(p);},
    spawnPoint(strict=true,region=[7,57]){
      for(let i=0;i<140;i++){const p={x:-22+this.random()*44,y:region[0]+this.random()*(region[1]-region[0])};if(strict?this.legalSpawn(p):!this.obstacles(p,p,.4).length&&dist(p,P.exit)>6)return p;}return null;
    },
    advanceClock(dt){
      if(this.scene!=='parking'){Base.prototype.advanceClock.call(this,dt);if(this.day>=15&&(!this.parking||!this.parking.entrance.axis)&&this.seconds>=(this._entryRetry||0))this.ensureParking();return;}
      const p=this.parking;p.elapsed=this.seconds;
      while(this.seconds+1e-8>=p.nextBatch*60){
        const batch=p.nextBatch++;p.planned+=6;p.pending.push('normal','normal','normal','runner','brute',P.cycle[(batch-1)%6]);
        let made=0;while(made<6&&p.pending.length){const point=this.spawnPoint();if(!point)break;this.spawnUnderground(p.pending.shift(),point,'regular');made++;}
        this.parkingCue(`地下第${batch}批：生成${made}/6只，待生成${p.pending.length}只。`);
      }
      if(p.initialPending?.length){const request=p.initialPending[0],point=this.spawnPoint(false,request.region);if(point){this.spawnUnderground(request.kind,point,'initial');p.initialPending.shift();}}
    },
    navGrid(){
      if(this._nav?.revision===(this._navigationRevision||0))return this._nav;
      this._flowCache=new Map();this._lightGrid=null;this._lastParkingFlows=new Map();
      return this._nav={revision:this._navigationRevision||0,nodes:new Map(),edges:new Map(),cursor:0,edgeCursor:0,ready:false};
    },
    advanceParkingNavigation(){
      const nav=this.navGrid();let budget=320;
      while(!nav.ready&&budget-->0){
        if(nav.cursor<47*59){const i=nav.cursor++,p={x:-23+Math.floor(i/59),y:1+i%59};if(!this.obstacles(p,p,.42).length)nav.nodes.set(key(p),p);}
        else{
          nav.keys=nav.keys||[...nav.nodes.keys()];if(nav.edgeCursor>=nav.keys.length){nav.ready=true;break;}
          const k=nav.keys[nav.edgeCursor++],p=nav.nodes.get(k),next=[];for(const [dx,dy] of steps){const n=nav.nodes.get(`${p.x+dx},${p.y+dy}`);if(n&&!this.obstacles(p,n,.4).length)next.push(key(n));}nav.edges.set(k,next);
        }
      }
      let work=768;
      const fields=[...this._flowCache.values()].filter(field=>!field.ready),offset=(this._parkingFlowCursor||0)%Math.max(1,fields.length);
      for(let i=0;i<fields.length;i++){
        const field=fields[(offset+i)%fields.length];
        let slice=Math.min(work,256);work-=slice;if(slice<=0)break;
        while(!field.ready&&field.cursor<field.queue.length&&slice-->0){
          const k=field.queue[field.cursor++],p=nav.nodes.get(k);
          for(const other of nav.edges.get(k)||[]){if(field.costs.has(other)||!field.retreat&&field.lit.has(other))continue;
            const q=nav.nodes.get(other),edge=k<other?k+'|'+other:other+'|'+k;
            if(!field.retreat){let blocked=field.edgeLight.get(edge);if(blocked===undefined){blocked=this.isLit({x:(p.x+q.x)/2,y:(p.y+q.y)/2},field.sources);field.edgeLight.set(edge,blocked);}if(blocked)continue;}
            field.costs.set(other,field.costs.get(k)+1);field.nextHop.set(other,p);field.queue.push(other);
          }
        }
        if(field.cursor>=field.queue.length){field.ready=true;this._lastParkingFlows.delete(field.role);this._lastParkingFlows.set(field.role,field);while(this._lastParkingFlows.size>16)this._lastParkingFlows.delete(this._lastParkingFlows.keys().next().value);}
      }
      this._parkingFlowCursor=offset+3;
    },
    nearestNode(p,nav=this.navGrid()){
      if(!nav.ready)return null;
      const center={x:Math.round(p.x),y:Math.round(p.y)},candidates=[];
      for(let dx=-2;dx<=2;dx++)for(let dy=-2;dy<=2;dy++){const n=nav.nodes.get(`${center.x+dx},${center.y+dy}`);if(n&&dist(n,p)<2.1)candidates.push(n);}
      return candidates.sort((a,b)=>dist(a,p)-dist(b,p)).find(n=>this.clearLine(p,n));
    },
    staticReachable(p){
      const nav=this.navGrid();if(!nav.ready)return false;if(!nav.reachable){const start=this.nearestNode(P.exit,nav),queue=start?[key(start)]:[],seen=new Set(queue);
        for(let i=0;i<queue.length;i++)for(const next of nav.edges.get(queue[i])||[])if(!seen.has(next)){seen.add(next);queue.push(next);}nav.reachable=seen;}
      const n=this.nearestNode(p,nav);return !!n&&nav.reachable.has(key(n));
    },
    parkingRouteSafe(candidate){
      const nav=this.navGrid(),start=this.nearestNode(P.exit,nav),queue=start?[key(start)]:[],seen=new Set(queue);
      if(!nav.ready)return false;
      for(let i=0;i<queue.length;i++){const p=nav.nodes.get(queue[i]);for(const next of nav.edges.get(queue[i])||[])if(!seen.has(next)&&!segmentHits(p,nav.nodes.get(next),candidate,.4)){seen.add(next);queue.push(next);}}
      // Only require routes which existed before this candidate, including each car's access point.
      if(!nav.reachable)this.staticReachable(P.exit);
      return this.parking.layer.points.every(p=>{const car=p.kind==='cargo'&&this.parking.layer.objects.find(o=>o.id===p.carId),n=this.nearestNode(car?{x:car.x-car.w/2-.5,y:car.y}:p,nav);return !n||!nav.reachable.has(key(n))||seen.has(key(n));});
    },
    lightGrid(){
      const nav=this.navGrid(),sources=this.lightSources(),stamp=sources.map(l=>`${l.lamp?.lampId||'exit'}:${Math.round(l.x*4)},${Math.round(l.y*4)}:${l.angle?Math.round(Math.atan2(l.facing.y,l.facing.x)*8):0}`).join('|');
      if(this._lightGrid?.stamp===stamp&&this._lightGrid.nav===nav)return this._lightGrid.lit;
      const lit=new Set();for(const [k,p] of nav.nodes)if(this.isLit(p,sources))lit.add(k);
      this._lightGrid={stamp,nav,lit,sources,edgeLight:new Map()};this._flowCache=new Map();return lit;
    },
    flowTo(target,retreat=false){
      const nav=this.navGrid();if(!nav.ready)return null;
      const lit=this.lightGrid(),cacheKey=retreat?'dark':key(target),role=retreat?'dark':target===this.player?'player':target.id||cacheKey;
      if(this._flowCache.has(cacheKey)){const f=this._flowCache.get(cacheKey);this._flowCache.delete(cacheKey);this._flowCache.set(cacheKey,f);return f.ready?f:this._lastParkingFlows.get(role)||f;}
      const costs=new Map(),queue=[],nextHop=new Map();
      if(retreat){for(const [k] of nav.nodes)if(!lit.has(k)){costs.set(k,0);queue.push(k);}}
      else{
        const goal=this.nearestNode(target,nav);
        if(goal&&!lit.has(key(goal))){const k=key(goal);costs.set(k,0);queue.push(k);}
        else {let nearest=Infinity;for(const [k,p] of nav.nodes)if(!lit.has(k))nearest=Math.min(nearest,dist(p,target));for(const [k,p] of nav.nodes)if(!lit.has(k)&&dist(p,target)<=nearest+.5){costs.set(k,0);queue.push(k);}}
      }
      const result={nav,costs,nextHop,queue,cursor:0,ready:!queue.length,retreat,role,lit,sources:this._lightGrid.sources,edgeLight:this._lightGrid.edgeLight};this._flowCache.set(cacheKey,result);
      while(this._flowCache.size>16)this._flowCache.delete(this._flowCache.keys().next().value);
      return this._lastParkingFlows.get(role)||result;
    },
    nearFree(p){for(let r=.5;r<=3;r+=.5)for(let i=0;i<12;i++){const q={x:p.x+Math.cos(i*Math.PI/6)*r,y:p.y+Math.sin(i*Math.PI/6)*r};if(!this.obstacles(q,q,.3).length&&this.clearLine(p,q))return q;}return null;},
    enemyMove(z,target,speed,dt,retreat=false,boss=false){
      const from={x:z.x,y:z.y};if(retreat)z.visualRetreatUntil=this.seconds+.12;
      let waypoint=target;
      const blocked=boss?this.obstacles(z,target,.4).some(o=>o.indestructible):!this.clearLine(z,target);
      let crossesLight=false;
      if(!boss){const n=Math.max(1,Math.ceil(dist(z,target)/.4));for(let i=1;i<=n;i++)if(this.isLit({x:z.x+(target.x-z.x)*i/n,y:z.y+(target.y-z.y)*i/n})){crossesLight=true;break;}}
      if(retreat||blocked||crossesLight){
        const field=this.flowTo(target,retreat);if(!field)return false;const node=this.nearestNode(z,field.nav);if(!node)return false;
        const nextHop=field.nextHop.get(key(node));if(retreat&&!nextHop&&!this.isLit(z))return false;
        waypoint=nextHop&&!this.obstacles(z,nextHop,.4).some(o=>!boss||o.indestructible)?nextHop:dist(z,node)>.08?node:null;
        if(!waypoint){if(retreat&&this.isLit(z)&&!this.isLit(node))waypoint=node;else return false;}
      }
      const distance=dist(z,waypoint);if(distance<.001)return false;
      const step=Math.min(distance,speed*dt),next={x:z.x+(waypoint.x-z.x)/distance*step,y:z.y+(waypoint.y-z.y)/distance*step};
      if(boss){
        const samples=Math.max(1,Math.ceil(step/.05));let last={x:z.x,y:z.y};
        for(let i=1;i<=samples;i++){
          const p={x:z.x+(next.x-z.x)*i/samples,y:z.y+(next.y-z.y)*i/samples};
          if(z.state==='burrowed'&&this.isLit(p)){Object.assign(z,last);this.revealBoss(z);return false;}
          if(z.state!=='burrowed'&&!retreat&&this.isLit(p))break;
          const hits=this.obstacles(last,p,.4);if(hits.some(o=>o.indestructible))break;
          for(const o of [...hits,...this.devices.filter(d=>d.hp>0&&segmentHits(last,p,{...d,w:d.w||.7,h:d.h||.7},.4))])if(!o.indestructible)this.crushBuilding(o);
          last=p;
        }
        if(dist(last,from)<.00001)return false;z.facing={x:last.x-z.x,y:last.y-z.y};Object.assign(z,last);this.enemyMovementVisual(z,from,retreat);return true;
      }
      if(this.obstacles(z,next,.24).length)return false;
      if(!retreat&&[next,{x:(z.x+next.x)/2,y:(z.y+next.y)/2}].some(p=>this.isLit(p)))return false;
      z.facing={x:waypoint.x-z.x,y:waypoint.y-z.y};Object.assign(z,next);this.enemyMovementVisual(z,from,retreat);return true;
    },
    perceive(z){
      if(!this.hidden&&dist(z,this.player)<=12&&this.clearLine(z,this.player)){
        z.lastSeen={x:this.player.x,y:this.player.y};if(!z.alerted){z.alerted=true;this.parkingCue(`${this.player.x<z.x?'东侧':'西侧'}发现${(P.enemies[z.kind]||D.enemies[z.kind]).name}！`);}return this.player;
      }
      if(this._gunSound?.until>this.seconds&&dist(z,this._gunSound)<=12)z.lastSeen={x:this._gunSound.x,y:this._gunSound.y};return z.lastSeen;
    },
    updateZombies(dt){
      if(this.scene!=='parking')return Base.prototype.updateZombies.call(this,dt);
      for(const z of [...this.zombies]){
        if(z.hp<=0||z.kind==='lurker')continue;const def=this.enemyDef(z.kind);
        if(this.isLit(z)){z.retreatUntil=this.seconds+.3;z.windup=null;this.enemyMove(z,z,def.speed,dt,true);continue;}if(z.retreatUntil>this.seconds){this.enemyMove(z,z,def.speed,dt,true);continue;}if(z.lightGraceUntil>this.seconds)continue;
        let target=this.perceive(z);
        if(z.kind==='lamp_smasher'){
          const lights=this.devices.filter(d=>P.lamps[d.kind]&&d.hp>0&&d.active&&d.energy>0&&dist(d,z)<=8&&this.clearLine(z,d,d)).sort((a,b)=>dist(a,z)-dist(b,z));if(lights.length)target=lights[0];
        }
        if(z.kind==='demolisher'){
          const device=this.devices.filter(d=>d.hp>0&&dist(d,z)<=6&&this.clearLine(z,d,d)).sort((a,b)=>dist(a,z)-dist(b,z))[0];if(device)target=device;
        }
        if(z.windup){
          if(this.seconds<z.windup.until)continue;const a=z.windup;z.windup=null;
          if(a.type==='scream'){
            for(const other of this.zombies)if(other!==z&&other.hp>0&&!['lurker','screamer'].includes(other.kind)&&dist(other,z)<=6)other.boostUntil=this.seconds+8;
            this.effects.push({kind:'scream_ring',x:z.x,y:z.y,radius:6,until:this.seconds+.8});continue;
          }
          const victim=a.target==='player'?(this.hidden?null:this.player):this.find(a.target);if(!victim||victim.hp<=0||!this.clearLine(z,victim,victim))continue;
          if(a.type==='ranged'){
            if(dist(z,victim)>a.range)continue;const n=dist(z,victim)||1;
            this.enemyAttackVisual(z,'throw',victim);
            this.projectiles.push({kind:z.kind==='lamp_smasher'?'stone_projectile':'acid_projectile',x:z.x,y:z.y,vx:(victim.x-z.x)/n*5,vy:(victim.y-z.y)/n*5,range:a.range,damage:z.kind==='lamp_smasher'?2:3,buildingDamage:2,lampDamage:z.kind==='lamp_smasher'?4:2,source:z.kind,owner:'enemy'});
          }else {this.enemyAttackVisual(z,'melee',victim);if((victim.type?pointRect(z,victim):dist(z,victim))<=1&&!this.isLit(victim)){if(victim===this.player)this.damagePlayer(def.damage,z.kind);else this.damageBuilding(victim,def.building);}}continue;
        }
        if(z.rootUntil>this.seconds)continue;
        if(z.kind==='screamer'&&this.seconds>=z.screamAt&&this.zombies.some(o=>o!==z&&o.hp>0&&!['lurker','screamer'].includes(o.kind)&&dist(o,z)<=6)){z.screamAt=this.seconds+20;z.windup={type:'scream',until:this.seconds+1.5};continue;}
        if(!target||dist(z,target)<.2)continue;
        const player=target===this.player,isObject=!!target.type,range=z.kind==='lamp_smasher'?8:7;
        if(['spitter','lamp_smasher'].includes(z.kind)&&this.seconds>=z.rangedAt&&this.seconds>=z.nextAttack&&dist(z,target)<=range&&dist(z,target)>1&&this.clearLine(z,target,target)&&(player||isObject)){
          z.facing={x:target.x-z.x,y:target.y-z.y};z.rangedAt=this.seconds+(z.kind==='lamp_smasher'?5:4);z.nextAttack=z.rangedAt;z.windup={type:'ranged',target:player?'player':target.id,range,until:this.seconds+1};this.parkingCue(`${def.name}准备远程攻击！`);continue;
        }
        if((player||isObject)&&(isObject?pointRect(z,target):dist(z,target))<=1&&this.clearLine(z,target,target)&&!this.isLit(target)){
          if(this.seconds>=z.nextAttack){z.nextAttack=this.seconds+def.interval;z.facing={x:target.x-z.x,y:target.y-z.y};if(def.windup)z.windup={type:'melee',target:player?'player':target.id,until:this.seconds+def.windup};else {this.enemyAttackVisual(z,'melee',target);if(player)this.damagePlayer(def.damage,z.kind);else this.damageBuilding(target,def.building);}}continue;
        }
        const moved=this.enemyMove(z,target,def.speed*(z.boostUntil>this.seconds?1.2:1)*(z.slowUntil>this.seconds?.7:1),dt);
        if(!moved){const block=this.obstacles(z,target,.24).filter(o=>!o.indestructible&&pointRect(z,o)<=1&&!this.isLit(o)).sort((a,b)=>pointRect(z,a)-pointRect(z,b))[0];if(block&&this.seconds>=z.nextAttack){this.damageBuilding(block,def.building);z.nextAttack=this.seconds+def.interval;}}
      }
    },
    damageZombie(z,n,source='normal'){
      if(z.kind==='lurker'&&z.state==='burrowed'&&source!=='molotov'){
        if(this.seconds>=(z.immuneFeedback||0)){z.immuneFeedback=this.seconds+1;this.parkingVisual('immune_hit',z,.4,30);this.announce('潜伏免疫：用灯光逼出，或使用燃烧瓶。');}return;
      }
      const wasAlive=z.hp>0;Base.prototype.damageZombie.call(this,z,n);
      if(wasAlive&&z.hp<=0&&['lurker','lamp_smasher'].includes(z.kind))this.effects.push({kind:'parking_corpse',enemyKind:z.kind,phase:z.phase,wasBurrowed:z.state==='burrowed',x:z.x,y:z.y,facing:{...(z.facing||{x:0,y:1})},until:this.seconds+8});
      if(z.kind==='lurker'&&z.hp<=0)this.killBoss(z);else if(z.kind==='lurker')this.bossPhase(z);
    },
    killBoss(z){
      const l=this.parking.layer;if(l.bossDead)return;l.bossDead=true;z.summonPending=[];z.summonNext=null;z.summonFlushDue=false;
      this.parkingVisual('lurker_death_fx',z,.6,38);
      const loot={wood:6,iron:6,scrap:4,cloth:2,fuel_oil:2,battery:1,wire:1},packs=P.chestPacks.map(p=>({...p})),selected=[];
      for(let i=0;i<2;i++){
        let r=this.random()*packs.reduce((s,p)=>s+p.weight,0),index=0;while(index<packs.length-1&&r>=packs[index].weight)r-=packs[index++].weight;
        const p=packs.splice(index,1)[0];selected.push(p.loot);for(const [k,n] of Object.entries(p.loot))loot[k]=(loot[k]||0)+n;
      }
      const p=this.obstacles(z,z,.25).length?this.nearFree(z)||{x:0,y:50}:{x:z.x,y:z.y};
      l.chest={...p,id:'parking:boss-chest',type:'parking',kind:'boss_chest',hp:1,indestructible:true,opened:false,loot,selectedPacks:selected};
      this.autosaveRequested=true;this.parkingCue('潜伏者已被击败！宝箱出现，普通怪物仍持续刷新。');
    },
    bossPhase(z){
      if(z.hp>8||z.hp<=0||z.phase==='cowering')return;z.phase='cowering';z.summonNext=this.seconds+10;
      if(z.lastRoar!==null){z.burrowDelay=9+this.random()*3;z.nextBurrow=z.lastRoar+z.burrowDelay;}
      this.parkingCue('潜伏者进入畏缩：速度提高、攻击降低，每10秒额外召唤3只！');
    },
    revealBoss(z){
      if(z.state!=='burrowed')return;z.state='stunned';z.stateUntil=this.seconds+2;z.windup=null;z.burrowWarning=null;
      this.parkingVisual('lurker_emerge',z,.4,32);
      this.parkingCue('灯光逼出潜伏者！眩晕2秒，随后蓄力怒吼。');
    },
    updateBoss(z,dt){
      if(z.hp<=0)return;this.bossPhase(z);
      if(dist(z,this.player)<=12&&!z.noticed){z.noticed=true;this.parkingCue('首层Boss：潜伏者。请用灯光逼出潜伏者！');}
      if(z.phase==='cowering'){
        if(this.seconds>=z.summonNext-1&&!z.summonWarned){z.summonWarned=true;this.parkingCue('地面裂痕扩大，1秒后召唤怪物！');}
        if(this.seconds+1e-8>=z.summonNext){z.summonNext+=10;z.summonWarned=false;z.summonPending.push('normal','normal','screamer');z.summonFlushDue=true;}
      }
      if(z.state==='burrowed'&&this.isLit(z)){this.revealBoss(z);return;}
      if(z.state==='stunned'){if(this.seconds+1e-8>=z.stateUntil){z.state='charging';z.stateUntil=this.seconds+1;this.parkingCue('潜伏者蓄力怒吼，离开2米范围或躲到掩体后！');}return;}
      if(z.state==='charging'){
        if(this.seconds+1e-8>=z.stateUntil){
          z.state='exposed';z.lastRoar=this.seconds;z.burrowDelay=z.phase==='cowering'?9+this.random()*3:15+this.random()*2;z.nextBurrow=this.seconds+z.burrowDelay;
          if(dist(z,this.player)<=2&&this.clearLine(z,this.player)&&this.damagePlayer(.5,'lurker_roar'))this.weaknessUntil=this.seconds+5;
          this.effects.push({kind:'boss_roar',x:z.x,y:z.y,radius:2,until:this.seconds+.6});
        }return;
      }
      if(z.state==='exposed'&&z.nextBurrow!==null&&this.seconds+1e-8>=z.nextBurrow-.6){
        if(this.isLit(z))z.burrowWarning=null;
        else {if(z.burrowWarning==null){z.burrowWarning=Math.max(this.seconds,z.nextBurrow-.6);this.parkingCue('潜伏者准备钻入地下！');}if(this.seconds+1e-8>=z.burrowWarning+.6){z.state='burrowed';z.windup=null;z.burrowWarning=null;}}
      }
      if(this.isLit(z)&&z.state!=='burrowed'){z.windup=null;this.enemyMove(z,z,z.phase==='cowering'?3:2.5,dt,true,true);return;}
      const target=this.perceive(z);if(!target)return;
      const goal=target.y<28?{x:0,y:50}:target;
      if(z.windup){
        if(this.seconds>=z.windup.until){z.windup=null;this.enemyAttackVisual(z,'melee');if(!this.hidden&&this.player.y>=28&&dist(z,this.player)<=1&&!this.isLit(this.player)&&this.clearLine(z,this.player))this.damagePlayer(z.phase==='cowering'?2.5:4.5,'lurker');}return;
      }
      if(z.rootUntil>this.seconds)return;
      if(target===this.player&&this.player.y>=28&&dist(z,this.player)<=1&&!this.isLit(this.player)&&this.seconds>=z.nextAttack){z.facing={x:target.x-z.x,y:target.y-z.y};z.nextAttack=this.seconds+2;z.windup={type:'boss_melee',until:this.seconds+.6};this.parkingCue('潜伏者地面隆起：攻击前摇！');return;}
      this.enemyMove(z,goal,z.phase==='cowering'?3:2.5,dt,false,true);
    },
    flushBossSummons(){
      const z=this.zombies.find(z=>z.kind==='lurker'&&z.hp>0&&z.summonFlushDue);if(!z)return;z.summonFlushDue=false;
      let made=0;while(made<3&&z.summonPending.length){const p=this.spawnPoint();if(!p)break;this.spawnUnderground(z.summonPending.shift(),p,'boss');made++;}
    },
    updateDevices(){
      if(this.scene==='parking'){
        const boss=this.zombies.find(z=>z.kind==='lurker'&&z.hp>0);
        if(boss){
          if(boss.state==='burrowed'&&this.isLit(boss))this.revealBoss(boss);
          if(!['stunned','charging'].includes(boss.state))for(const d of this.devices)if(d.hp>0&&pointRect(boss,{...d,w:d.w||.7,h:d.h||.7})<=.4)this.crushBuilding(d);
        }
      }Base.prototype.updateDevices.call(this);
    }
  });
  if(common)module.exports=S;
})(typeof globalThis!=='undefined'?globalThis:this);
