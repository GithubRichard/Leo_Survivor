/* Second-floor combat, role-specific bones, and an active-play revival clock. */
(function(root){
  'use strict';const S=root.Survival,Base=S.Game,D=S.Expansion,{dist,pointRect,segmentHits}=S;
  const floorKeys=['layer','elapsed','nextBatch','pending','planned','generated','explored','initialized','initialPending'];
  const emptyState=minutes=>({seconds:0,minutes,devices:[],zombies:[],drops:[],visitors:[],projectiles:[],zones:[],effects:[],spawned:0,deviceId:0,acidTime:0,fireTime:0});
  const facing=(a,b)=>{const n=dist(a,b);if(n<1e-8){const f=a.facing||{x:0,y:1},length=Math.hypot(f.x,f.y)||1;return {x:f.x/length,y:f.y/length};}return {x:(b.x-a.x)/n,y:(b.y-a.y)/n};};
  const front=(a,b,f)=>((b.x-a.x)*f.x+(b.y-a.y)*f.y)>=-1e-8;
  function circleHit(a,b,c,r){const dx=b.x-a.x,dy=b.y-a.y,x=a.x-c.x,y=a.y-c.y,A=dx*dx+dy*dy,C=x*x+y*y-r*r;if(C<=0)return 0;if(!A)return Infinity;const B=2*(x*dx+y*dy),q=B*B-4*A*C;if(q<0)return Infinity;const t=(-B-Math.sqrt(q))/(2*A);return t>=0&&t<=1?t:Infinity;}
  function wallHit(a,b,o,r){if(!segmentHits(a,b,o,r))return Infinity;let lo=0,hi=1;for(let i=0;i<12;i++){const t=(lo+hi)/2;if(segmentHits(a,{x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t},o,r))hi=t;else lo=t;}return hi;}
  D.enemies.skeleton={name:'骷髅',hp:26,speed:2.2,damage:3,building:3,interval:1.6};S.NAMES.skeleton='骷髅';
  class SkeletonGame extends Base{
    constructor(options={}){super(options);this.skeleton=null;this.boneSerial=0;this.boneSkill={unlocked:false,charging:false,cooldown:0,recoverUntil:0};}
    get secondFloor(){return this.scene==='parking'&&this.parking?.floor===2;}
    makeSkeleton(p={x:0,y:50}){return {...p,home:{x:0,y:50},id:'skeleton:boss',kind:'skeleton',hp:26,maxHP:26,rootUntil:0,boostUntil:0,noticed:false,facing:{x:0,y:-1},action:null,readyAt:this.seconds+3,nextAttack:0,throwAt:Infinity,sweepAt:Infinity,splitAt:0};}
    createSecondFloor(){
      const p=this.parking;if(p.floors?.[2]){this.ensureSecondFloorCars(p.floors[2]);return;}
      p.floors=p.floors||{};const layer={objects:p.layer.objects.filter(o=>['wall','column'].includes(o.kind)&&!o.id.startsWith('parking:store')).map(o=>({...o,id:'second:'+o.id})),cars:[],points:[{id:'skeleton:exit',kind:'exit',type:'parking',x:0,y:3,hp:1}],gateOpen:true,bossDead:false,nextUnlocked:false,chest:null};
      const state=emptyState(this.minutes);state.zombies=[{...this.makeSkeleton(),readyAt:3}];p.floors[2]={layer,state,elapsed:0,nextBatch:1,pending:[],planned:0,generated:0,explored:[],initialized:true,initialPending:[]};
      this.skeleton={id:'skeleton:boss',alive:true,cycle:0,permanent:false,remnant:null,rewards:[]};
      this.ensureSecondFloorCars(p.floors[2]);
    }
    ensureSecondFloorCars(floor){
      const layer=floor?.layer;if(!layer)return;
      // Pending bays are saved too: migration never buries existing occupants,
      // and filling a vacated bay must not refill cars that were already searched.
      const layout=layer.carLayout||(layer.carLayout={version:1,pending:Array.from({length:24},(_,i)=>i).filter(i=>!layer.objects.some(o=>o.id===`second:car:${i}`))});
      if(!layout.pending.length)return;
      const active=this.secondFloor&&layer===this.parking.layer,state=active?this:floor.state;
      const occupied=[...(state.devices||[]).filter(o=>o.hp>0),...(state.zombies||[]).filter(o=>o.hp>0),...(state.drops||[]),...layer.points.filter(o=>o.kind==='skeleton_chest')];
      if(active)occupied.push({...this.player,radius:2});
      if(this.skeleton?.remnant?.hp>0)occupied.push(this.skeleton.remnant);
      const fits=p=>{
        const box={...p,w:2.4,h:4.2};
        if(layer.objects.some(o=>o.hp>0&&Math.abs(o.x-p.x)<(o.w+box.w)/2+.3&&Math.abs(o.y-p.y)<(o.h+box.h)/2+.3))return false;
        return occupied.every(o=>o.w&&o.h?Math.abs(o.x-p.x)>=(o.w+box.w)/2+.4||Math.abs(o.y-p.y)>=(o.h+box.h)/2+.4:pointRect(o,box)>(o.radius||.7)+.4);
      };
      let added=false;const pending=[];
      for(const i of layout.pending){
        if(layer.objects.some(o=>o.id===`second:car:${i}`))continue;
        const base={x:[-19,-12,-5,4,12,19][i%6],y:[12,22,32,48][Math.floor(i/6)]};
        const p=[0,-.75,.75,-1.5,1.5].map(dy=>({x:base.x,y:base.y+dy})).find(fits);
        if(p)added=this.addParkingCar(layer,i,p,'second')||added;else pending.push(i);
      }
      layout.pending=pending;
      if(added){
        this.autosaveRequested=true;
        if(active){this._parkingCollision=null;this._nav=null;this._flowCache=new Map();this._pathJobs=new Map();this._pathQueue=[];this._lights=null;this.navigationChanged();}
      }
    }
    resetSkeletonOnExit(){
      if(!this.secondFloor)return;
      this.cancelBoneCharge();this.playerAttack=null;
      this.zombies=this.zombies.filter(z=>!z.boneType||z.boneType==='remnant');this._enemyBones=[];
      if(this.skeleton?.alive){const home=this.skeletonHomeSpot();this.zombies=this.zombies.filter(z=>z.kind!=='skeleton');this.zombies.push(this.makeSkeleton(home));this.parking.layer.bossDead=false;}
      this.effects=this.effects.filter(e=>!e.skeletonCombat);this.announce('离开二层：活骷髅恢复26血，战斗骨已清除；死亡遗骨、物品和消耗记录保留。');
    }
    changeFloor(target,transit=false){
      if(this.scene!=='parking'||![1,2].includes(target)||(this.parking.floor||1)===target)return false;
      const p=this.parking,current=p.floor||1;if(target===2&&!p.layer.nextUnlocked)return false;
      if(target===2)this.createSecondFloor();if(!p.floors?.[target])return false;
      const next=p.floors[target],arrival=this.floorArrival(next,target===2||transit?{x:0,y:3}:{x:-16,y:55},transit);if(!arrival){this.announce('目标入口附近被堵住，尚未切换楼层或重置Boss。');return false;}
      this.cancelBoneCharge();this.cancelAction();this.endStealth();if(current===2)this.resetSkeletonOnExit();this.playerAttack=null;this.playerLampVisual=null;this.playerSkillVisual=null;
      p.floors[current]={...Object.fromEntries(floorKeys.map(k=>[k,p[k]])),state:this.captureScene()};
      this.shiftPersonalClock(next.state.seconds-this.seconds);Object.assign(this,next.state);for(const k of floorKeys)p[k]=next[k];p.floor=target;
      Object.assign(this.player,arrival);this.player.indoorHome=null;this.player.running=false;
      this._nav=null;this._parkingCollision=null;this._lights=null;this._flowCache=new Map();this._pathJobs=new Map();this._pathQueue=[];this._exploreNext=0;this._gunSound=null;this.navigationChanged();this._sceneJustChanged=true;this.autosaveRequested=true;
      this.linkRemnant();if(target===2)this.announce('地下二层：骷髅26血；离层活Boss回血、战斗骨清空。死亡遗骨可摧毁以延后复活。');return true;
    }
    floorArrival(floor,p,transit){for(let i=0;i<129;i++){const r=i?Math.ceil(i/8)*.5:0,a=i*Math.PI/4,q={x:p.x+Math.cos(a)*r,y:p.y+Math.sin(a)*r};if(Math.abs(q.x)>=23.5||q.y<=.6||q.y>=59.4)continue;const blocked=[...floor.layer.objects,...floor.state.devices].some(o=>o.hp>0&&!(o.kind==='fuse_gate'&&floor.layer.gateOpen)&&!(o.type==='device'&&!this.blocking(o))&&segmentHits(q,q,o,.25));if(!blocked&&(transit||!floor.state.zombies.some(z=>z.hp>0&&!z.boneType&&dist(q,z)<.7)))return q;}return null;}
    switchScene(){this.cancelBoneCharge();if(this.secondFloor&&!this.changeFloor(1,true))return;super.switchScene();if(this.scene==='parking')this.parking.floor=1;}
    shiftPersonalClock(delta){super.shiftPersonalClock(delta);if(this.boneSkill){for(const k of ['cooldown','recoverUntil','startedAt','visualUntil'])if(Number.isFinite(this.boneSkill[k]))this.boneSkill[k]+=delta;}}
    find(id){return this.zombies.find(z=>z.boneType&&z.id===id)||(this._enemyBones||[]).find(z=>z.id===id&&z.hp>0)||super.find(id);}
    parkingInteract(o){
      if(o.kind==='next_floor'){if(!this.parking.layer.nextUnlocked){this.announce('打开潜伏者宝箱后才能进入二层。');return false;}return this.beginAction('floor_travel',2,{target:o.id,toFloor:2});}
      if(o.kind==='exit'&&this.secondFloor)return this.beginAction('floor_travel',2,{target:o.id,toFloor:1});
      if(o.kind==='skeleton_chest')return o.opened?this.takeParkingLoot(o):this.beginAction('skeleton_open',2,{target:o.id});
      return super.parkingInteract(o);
    }
    updateAction(dt){
      const a=this.action;if(!a||!['floor_travel','skeleton_open'].includes(a.type))return super.updateAction(dt);
      const o=this.find(a.target);if(!o||dist(a.start,this.player)>.025||dist(o,this.player)>2||!this.clearLine(this.player,o,o)){this.cancelAction('移动或遮挡中断了操作。');return;}
      a.elapsed+=dt;if(a.elapsed+1e-8<a.duration)return;this.action=null;
      if(a.type==='floor_travel'){this.changeFloor(a.toFloor);return;}
      if(!o.opened){o.opened=true;if(!this.boneSkill.unlocked){this.boneSkill.unlocked=true;this.announce('获得投掷技能：按住R蓄力，松开发出；每次成功发出耗1血，冷却15秒。');}this.autosaveRequested=true;}this.takeParkingLoot(o);
    }
    nearbyInteraction(){let current;const layer=this.secondFloor&&this.parking.layer;if(layer){const points=layer.points;try{layer.points=points.filter(o=>o.kind!=='skeleton_chest'||!o.opened||!this.boneSkill.unlocked||Object.values(o.loot).some(n=>n>0));current=super.nearbyInteraction();}finally{layer.points=points;}}else current=super.nearbyInteraction();const r=this.secondFloor&&this.skeleton?.remnant;if(r?.hp>0&&dist(r,this.player)<1.8&&this.canSee(r)&&(!current||dist(r,this.player)<current.distance))return {type:'bone_remnant',object:r,distance:dist(r,this.player)};return current;}
    canPlace(kind,p){const bone=this.zombies.find(z=>z.boneType&&z.hp>0&&dist(z,p)<(z.radius||.35)+.5);return bone?'骨头占地无法建造':super.canPlace(kind,p);}
    beginAction(type,duration,data={}){if(this.boneSkill?.charging)this.cancelBoneCharge();return super.beginAction(type,duration,data);}
    startBoneCharge(){
      const s=this.boneSkill;if(!s.unlocked){this.announce('打开骷髅首次宝箱后解锁投掷。');return false;}
      if(s.charging||this.action||this.playerAttack||this.result||this.player.hp<=1||this.seconds<s.cooldown||this.seconds<s.recoverUntil)return false;
      this.endStealth();s.charging=true;s.startedAt=this.seconds;this.player.running=false;this.interruptBandage('投掷蓄力');return true;
    }
    cancelBoneCharge(){if(this.boneSkill?.charging){this.boneSkill.charging=false;this.boneSkill.visual='cancel';this.boneSkill.visualUntil=this.seconds+.2;}}
    releaseBone(){
      const s=this.boneSkill;if(!s.charging)return false;const charge=Math.min(2,Math.max(0,this.seconds-s.startedAt));s.charging=false;
      if(this.result||this.player.hp<=1||this.seconds<s.cooldown)return false;
      const f=facing({x:0,y:0},this.player.facing);this.player.hp-=1;s.cooldown=this.seconds+15;s.recoverUntil=this.seconds+.4;s.visual='release';s.visualUntil=s.recoverUntil;
      this.zombies.push({id:`player-bone:${++this.boneSerial}`,kind:'combat_bone',type:'bone',boneType:'player',faction:'player',hp:20,maxHP:20,radius:1,w:2,h:2,x:this.player.x,y:this.player.y,stage:'flight',facing:f,range:5+2.5*charge,hits:[]});this.autosaveRequested=true;return true;
    }
    movePlayer(dt,input){if(this.boneSkill?.charging)input={...input,run:false};if(this.boneSkill?.recoverUntil>this.seconds)input={};super.movePlayer(dt,input);}
    damagePlayer(n,source,ground){const hit=super.damagePlayer(n,source,ground);if(hit)this.cancelBoneCharge();return hit;}
    attack(){if(this.boneSkill.charging||this.seconds<this.boneSkill.recoverUntil)return false;return super.attack();}
    toggleStealth(){if(this.boneSkill.charging||this.seconds<this.boneSkill.recoverUntil)return false;return super.toggleStealth();}
    updateZombies(dt){this._enemyBones=this.zombies.filter(z=>z.boneType==='player'&&z.hp>0);const specials=this.zombies.filter(z=>z.kind==='skeleton'||z.boneType);this.zombies=this.zombies.filter(z=>z.kind!=='skeleton'&&!z.boneType);super.updateZombies(dt);this.zombies.push(...specials.filter(z=>z.hp>0));}
    enemyBoneTarget(z){return (this._enemyBones||[]).filter(b=>b.hp>0&&dist(z,b)<=2.3&&this.clearLine(z,b)).sort((a,b)=>dist(z,a)-dist(z,b))[0];}
    enemyTarget(z){return this.enemyBoneTarget(z)||super.enemyTarget(z);}
    perceive(z){return this.enemyBoneTarget(z)||super.perceive(z);}
    damageBuilding(o,n){if(o.boneType)return this.damageZombie(o,n,'enemy');return super.damageBuilding(o,n);}
    firstBoneBetween(a,b){return this.zombies.filter(z=>z.boneType&&z.hp>0&&z.faction!=='player'&&z!==b).map(z=>({z,t:circleHit(a,b,z,z.radius||.2)})).filter(h=>h.t<1).sort((x,y)=>x.t-y.t)[0]?.z;}
    updateZones(dt){super.updateZones(dt);for(const b of this.zombies)if(b.boneType==='player'&&b.hp>0){if(this.zones.some(z=>z.kind==='acid_pool'&&dist(z,b)<=z.radius+b.radius&&this.clearLine(z,b))){b.acidTime=(b.acidTime||0)+dt;if(b.acidTime>=1){b.acidTime-=1;this.damageZombie(b,1,'acid_pool');}}else b.acidTime=0;}}
    damageZombie(z,n,source='normal'){
      if(z.hp<=0)return;
      if(z.boneType){z.hp=Math.max(0,z.hp-n);if(z.hp>0)return;z.stage='shattered';this.boneEffect(z,'shatter');
        if(z.boneType==='remnant'){const extra=this.difficultyRules.shatterDays*DifficultyRules.daySeconds(this.difficulty);z.destroyed=true;z.remaining=Math.max(0,z.remaining||0)+extra;this.skeleton.permanent=false;this.skeleton.remnant=z;this.skeleton.reform=0;this.skeleton.reformStarted=false;this.announce(`复活遗骨已摧毁：在剩余时间上追加${this.difficultyRules.shatterDays}天，倒计时继续；本轮不能重复延后。`);this.autosaveRequested=true;}
        const boss=this.zombies.find(b=>b.kind==='skeleton'&&b.hp>0);if(boss?.action?.boneId===z.id)this.cancelSkeletonAction(boss,true);return;
      }
      const alive=z.hp>0;super.damageZombie(z,n,source);if(z.kind==='skeleton'){z.hurtUntil=this.seconds+.2;if(alive&&z.hp<=0)this.killSkeleton(z);}
    }
    boneEffect(p,state){this.effects.push({kind:'skeleton_fx',state,boneType:p.boneType,facing:p.facing,x:p.x,y:p.y,startedAt:this.seconds,until:this.seconds+.45,skeletonCombat:state!=='death'});}
    newOrdinary(boss,mode){const b={id:`skeleton-bone:${++this.boneSerial}`,kind:'combat_bone',boneType:'ordinary',faction:'enemy',mode,hp:4,maxHP:4,x:boss.x,y:boss.y,w:.4,h:.4,radius:.2,stage:'held',bossId:boss.id};this.zombies.push(b);return b;}
    cancelSkeletonAction(boss,broken=false){
      const a=boss.action;if(!a)return;const b=this.zombies.find(z=>z.id===a.boneId&&z.hp>0);
      if(a.type==='throw'){boss.throwAt=this.seconds+6;if(b){b.stage='ground';b.x=boss.x;b.y=boss.y;b.landedAt=this.seconds;b.contactAt=this.seconds+.75;b.recallAt=this.seconds+10;b.radius=.35;}}
      if(a.type==='sweep'){boss.sweepAt=this.seconds+10;if(b)b.hp=0;}
      boss.action=broken?{type:'empty',started:this.seconds,until:this.seconds+.7,released:true,facing:a.facing}:null;
    }
    skeletonAction(boss,type,target){
      const f=facing(boss,target),windup={melee:.3,throw:2,sweep:1.5}[type],recover=type==='sweep'?.7:.5;
      const a={type,started:this.seconds,releaseAt:this.seconds+windup,until:this.seconds+windup+recover,facing:f,target:target===this.player?'player':target.id,aim:{x:target.x,y:target.y},released:false};
      boss.facing=f;boss.action=a;
      if(type==='melee')boss.nextAttack=this.seconds+1.6;
      else {boss.hp-=1;const bone=this.newOrdinary(boss,type);a.boneId=bone.id;boss.splitAt=this.seconds+2;}
    }
    updateSkeleton(boss,dt){
      if(this.isLit(boss)){this.cancelSkeletonAction(boss);this.enemyMove(boss,boss,2.2,dt,true);return;}
      const visible=!this.hidden&&dist(boss,this.player)<=12&&this.clearVision(boss,this.player);
      if(visible){boss.lastSeen={x:this.player.x,y:this.player.y};if(!boss.noticed){boss.noticed=true;boss.throwAt=this.seconds+3;boss.sweepAt=this.seconds+5;this.parkingCue('二层Boss：骷髅。拆出的骨头可以攻击摧毁。');}}
      if(boss.action){const a=boss.action,b=this.zombies.find(z=>z.id===a.boneId&&z.hp>0);
        if(b?.stage==='held'){b.x=boss.x+a.facing.x*.6;b.y=boss.y+a.facing.y*.6;}
        if(a.type==='throw'&&!a.released&&visible&&dist(boss,this.player)<=10)a.aim={x:this.player.x,y:this.player.y};
        if(!a.released&&this.seconds+1e-8>=a.releaseAt){a.released=true;
          const target=a.target==='player'?this.player:this.find(a.target);
          if(a.type==='melee'||a.type==='sweep'){
            const radius=a.type==='sweep'?2.6:1.3,victims=[target,...this.zombies.filter(z=>z.boneType==='player'&&z.hp>0)];for(const victim of victims)if((a.type!=='sweep'||b)&&victim?.hp>0&&!(victim===this.player&&this.hidden)&&!this.isLit(victim)&&(victim.type?pointRect(boss,victim):dist(boss,victim))<=radius&&front(boss,victim,a.facing)&&this.clearLine(boss,victim,victim)){if(victim===this.player)this.damagePlayer(3,'skeleton');else this.damageBuilding(victim,this.enemyDamage(3,'skeleton'));}
          }else if(a.type==='throw'&&b&&a.aim){Object.assign(b,{stage:'flight',facing:facing(boss,a.aim),range:Math.min(12,dist(boss,a.aim))});boss.throwAt=this.seconds+6;}
        }
        if(this.seconds>=a.until){if(a.type==='sweep'){if(b)b.hp=0;boss.sweepAt=this.seconds+10;}boss.action=null;}return;
      }
      if(!boss.noticed||boss.rootUntil>this.seconds||this.seconds<boss.readyAt)return;
      const target=visible?this.player:boss.lastSeen;if(!target)return;const distance=dist(boss,target),canAttack=visible&&!this.isLit(this.player);
      if(canAttack&&distance<=2.6&&boss.hp>1&&this.seconds>=boss.sweepAt&&this.seconds>=boss.splitAt){this.skeletonAction(boss,'sweep',this.player);return;}
      if(canAttack&&distance<=1.3&&this.seconds>=boss.nextAttack){this.skeletonAction(boss,'melee',this.player);return;}
      if(visible&&distance<=10&&boss.hp>1&&this.seconds>=boss.throwAt&&this.seconds>=boss.splitAt&&this.zombies.filter(z=>z.boneType==='ordinary'&&z.mode==='throw'&&z.hp>0).length<3){this.skeletonAction(boss,'throw',this.player);return;}
      if(distance>.3&&!this.enemyMove(boss,target,2.2,dt)){
        const block=this.obstacles(boss,target,.25).find(o=>!o.indestructible&&pointRect(boss,o)<=1.3&&!this.isLit(o));if(block&&this.seconds>=boss.nextAttack)this.skeletonAction(boss,'melee',block);
      }
    }
    killSkeleton(boss){
      const s=this.skeleton;if(!s?.alive)return;s.alive=false;boss.action=null;for(const b of this.zombies)if(b.boneType==='ordinary')b.hp=0;
      const id=`${s.id}:reward:${s.cycle}`,layer=this.parking.layer;layer.bossDead=true;
      const chestSpot=this.rewardSpot({x:boss.x-1.5,y:boss.y}),remnantSpot=this.rewardSpot({x:boss.x+1.5,y:boss.y},[chestSpot]);
      if(!s.rewards.includes(id)){s.rewards.push(id);const loot=s.cycle===0?{iron:8,wood:4,scrap:6,cloth:2,fuel_oil:4,battery:2,wire:2,parts:2,medkit:1}:{iron:3,scrap:2,fuel_oil:1};layer.points.push({...chestSpot,id,kind:'skeleton_chest',type:'parking',hp:1,indestructible:true,opened:false,loot,cycle:s.cycle});}
      s.remnant={...remnantSpot,id:`${s.id}:remnant:${s.cycle}`,kind:'combat_bone',boneType:'remnant',faction:'enemy',hp:20,maxHP:20,radius:.6,w:1.2,h:1.2,remaining:this.difficultyRules.reviveDays*DifficultyRules.daySeconds(this.difficulty),stage:'standing'};s.reform=0;s.reformStarted=false;this.zombies.push(s.remnant);this.boneEffect(boss,'death');this.autosaveRequested=true;this.parkingCue('骷髅倒下：宝箱与竖立复活遗骨分别出现。摧毁遗骨可延后复活，不能反复攻击同一堆碎骨追加时间。');
    }
    rewardSpot(p,reserved=[]){const clear=q=>Math.abs(q.x)<22&&q.y>6&&q.y<56&&!this.obstacles(q,q,.65).length&&dist(q,this.player)>1.1&&[...this.parking.layer.points,...reserved].every(o=>dist(q,o)>1.35);for(let i=0;i<129;i++){const r=i?Math.ceil(i/12)*.65:0,a=i*Math.PI/6,q={x:p.x+Math.cos(a)*r,y:p.y+Math.sin(a)*r};if(clear(q))return q;}return [...(this.navGrid().nodes?.values()||[])].find(clear)||this.freeBoneSpot(p)||{x:0,y:48};}
    skeletonHomeSpot(){const home={x:0,y:50},near=this.freeBoneSpot(home);if(near)return near;const nodes=[...(this.navGrid().nodes?.values()||[])].sort((a,b)=>dist(a,home)-dist(b,home)),old=this.zombies.find(z=>z.kind==='skeleton'&&z.hp>0);return nodes.find(p=>!this.obstacles(p,p,.65).length&&dist(p,this.player)>1.1)||(old?{x:old.x,y:old.y}:home);}
    freeBoneSpot(p){for(let i=0;i<65;i++){const r=i?Math.ceil(i/8)*.5:0,a=i*Math.PI/4,q={x:p.x+Math.cos(a)*r,y:p.y+Math.sin(a)*r};if(Math.abs(q.x)<22&&q.y>6&&q.y<56&&!this.obstacles(q,q,.65).length&&dist(q,this.player)>1.1)return q;}return null;}
    revivalHours(seconds){return seconds/DifficultyRules.daySeconds(this.difficulty)*24;}
    linkRemnant(){const s=this.skeleton,r=s?.remnant;if(!this.secondFloor||!r)return;this.zombies=this.zombies.filter(z=>z.boneType!=='remnant');if(r.hp>0)this.zombies.push(r);s.reform=r.remaining<=0?3:0;s.reformStarted=r.remaining<=0;}
    advanceRevival(dt){
      const s=this.skeleton,r=s?.remnant;if(!r||s.alive||s.permanent||r.hp<=0&&!r.destroyed)return;r.remaining=Math.max(0,r.remaining-dt);
      if(!this.secondFloor)return;if(r.remaining<=3&&!s.reformStarted){s.reformStarted=true;s.reform=Math.max(dt,r.remaining+dt);}
      if(s.reform>0){s.reform=Math.max(0,s.reform-dt);if(s.reform===0&&r.remaining===0){const p=this.freeBoneSpot(r);if(!p){s.reform=dt;return;}r.hp=0;s.remnant=null;s.alive=true;s.cycle++;this.parking.layer.bossDead=false;this.zombies=this.zombies.filter(z=>z.boneType!=='remnant');this.zombies.push(this.makeSkeleton(p));this.autosaveRequested=true;this.parkingCue('遗骨已重组为骷髅，新的战斗轮次开始。');}}
    }
    updateCombatBones(dt){
      const boss=this.secondFloor&&this.zombies.find(z=>z.kind==='skeleton'&&z.hp>0);
      for(const b of [...this.zombies]){if(!b.boneType||b.hp<=0||b.boneType==='remnant'||b.stage==='held')continue;
        if(b.stage==='ground'){
          if(this.seconds>=b.contactAt&&dist(b,this.player)<=.35&&this.clearLine(b,this.player)){this.damagePlayer(1,'skeleton_bone');b.contactAt=this.seconds+1;}
          if(this.seconds>=b.recallAt){if(!boss){b.hp=0;continue;}b.stage='return';}continue;
        }
        if(b.stage==='return'){
          if(!boss){b.hp=0;continue;}const n=dist(b,boss);if(n<=8*dt+.1){b.hp=0;if(!b.replied){b.replied=true;boss.hp=Math.min(26,boss.hp+1);boss.reconnectUntil=this.seconds+.35;this.boneEffect(boss,'reconnect');}}else{b.x+=(boss.x-b.x)/n*8*dt;b.y+=(boss.y-b.y)/n*8*dt;}continue;
        }
        if(b.stage!=='flight')continue;
        const player=b.boneType==='player',length=Math.min(b.range,(player?8:7)*dt),from={x:b.x,y:b.y},to={x:b.x+b.facing.x*length,y:b.y+b.facing.y*length};
        let stop=1,block=null;for(const o of this.obstacles(from,to,b.radius)){const t=wallHit(from,to,o,b.radius);if(t<stop){stop=t;block=o;}}
        if(player){const hits=this.zombies.filter(z=>z!==b&&z.hp>0&&z.faction!=='player'&&!b.hits.includes(String(z.id))).map(z=>({z,t:circleHit(from,to,z,1+(z.radius||.22))})).filter(h=>h.t<=stop).sort((a,c)=>a.t-c.t);
          for(const {z} of hits){if(b.hp<=0)break;b.hits.push(String(z.id));this.damageZombie(z,this.directDamage(4),'bone_skill');}
        }else{
          const targets=[this.player,...this.zombies.filter(z=>z.boneType==='player'&&z.hp>0)];let victim=null;
          for(const z of targets){const t=circleHit(from,to,z,.2+(z.radius||.22));if(t<stop){stop=t;victim=z;block=null;}}
          if(victim){if(victim===this.player)this.damagePlayer(3,'skeleton_bone');else this.damageZombie(victim,this.enemyDamage(3,'skeleton_bone'),'skeleton_bone');block=victim;}
        }
        b.x=from.x+(to.x-from.x)*stop;b.y=from.y+(to.y-from.y)*stop;b.range-=length*stop;
        if(!player&&block&&block!==this.player&&!block.boneType&&!block.indestructible)this.damageBuilding(block,this.enemyDamage(3,'skeleton_bone'));
        if(b.hp<=0||block||b.range<=.001){if(player){b.hp=0;this.boneEffect(b,'shatter');}else Object.assign(b,{stage:'ground',radius:.35,w:.7,h:.7,landedAt:this.seconds,contactAt:this.seconds+.75,recallAt:this.seconds+10});}
      }
      this.zombies=this.zombies.filter(z=>z.hp>0);
    }
    step(dt,input={}){if(this.result||dt<=0||this.parkingUnlockPending)return;super.step(dt,input);if(this.result)return;if(this.secondFloor&&this.parking.layer.carLayout?.pending.length){this._secondCarsRetry=(this._secondCarsRetry||0)+dt;if(this._secondCarsRetry>=1){this._secondCarsRetry=0;this.ensureSecondFloorCars({layer:this.parking.layer,state:this});}}if(!this._sceneJustChanged){this.updateCombatBones(dt);if(this.secondFloor){const boss=this.zombies.find(z=>z.kind==='skeleton'&&z.hp>0);if(boss)this.updateSkeleton(boss,dt);}}if(!this.result)this.advanceRevival(dt);}
    snapshot(){const data=super.snapshot();data.skeleton=this.skeleton;data.boneSkill={...this.boneSkill};data.boneSerial=this.boneSerial;data.worldSystemsVersion=1;data.remnantRulesVersion=2;return data;}
    static restore(data){
      const game=Base.restore(data);Object.setPrototypeOf(game,SkeletonGame.prototype);game.skeleton=data.skeleton||null;game.boneSerial=data.boneSerial||0;game.boneSkill={unlocked:false,charging:false,cooldown:0,recoverUntil:0,...data.boneSkill};game.boneSkill.charging=false;
      if(game.skeleton?.permanent&&data.remnantRulesVersion!==2){const s=game.skeleton;s.permanent=false;s.remnant={id:s.id+':legacy-remnant',kind:'combat_bone',boneType:'remnant',faction:'enemy',x:0,y:50,hp:0,maxHP:20,destroyed:true,stage:'shattered',remaining:game.difficultyRules.shatterDays*DifficultyRules.daySeconds(game.difficulty)};s.reform=0;s.reformStarted=false;}
      if(game.parking)game.parking.floor=game.parking.floor||1;game.linkRemnant();
      if(game.secondFloor)game.ensureSecondFloorCars({layer:game.parking.layer,state:game});else if(game.parking?.floors?.[2])game.ensureSecondFloorCars(game.parking.floors[2]);
      const boss=game.zombies.find(z=>z.kind==='skeleton');if(boss?.action&&!boss.action.released){const a=boss.action,delay={melee:.3,throw:2,sweep:1.5}[a.type];a.started=game.seconds;a.releaseAt=game.seconds+delay;a.until=a.releaseAt+(a.type==='sweep'?.7:.5);}
      for(const b of game.zombies)if(b.boneType==='ordinary'&&b.stage==='ground')b.contactAt=Math.max(b.contactAt||0,game.seconds+.75);return game;
    }
  }
  S.Game=SkeletonGame;S.boneCircleHit=circleHit;
})(globalThis);
