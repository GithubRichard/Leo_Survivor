/* Independent persistent ground compound. Surface and underground state stay separate. */
(function(root){
  'use strict';const S=root.Survival,Base=S.Game,D=S.Expansion,A=root.ArmoryData,{dist,pointRect,segmentHits}=S,clone=x=>JSON.parse(JSON.stringify(x));
  class ArmoryGame extends Base{
    constructor(options={}){super(options);this.armory=null;this.armorySurface=null;}
    ensureArmory(){
      if(this.day<A.provisional.unlockDay||this.armory||this.scene!=='surface')return;
      let job=this._armoryPlacement;
      if(!job){const sites=[];for(let x=-10;x<=10;x++)for(let y=-10;y<=10;y++){const p={x:14+x*28,y:14+y*28,w:3,h:3},d=S.Camp.distanceFromTerritory(p);if(d>=180&&d<=260)sites.push(p);}for(let i=sites.length-1;i>0;i--){const j=Math.floor(this.random()*(i+1));[sites[i],sites[j]]=[sites[j],sites[i]];}job=this._armoryPlacement={sites,cursor:0};}
      if(job.route){this.advanceCampRoute(job.route,90);if(!job.route.done)return;if(job.route.path){const e=job.candidate;this.armory={version:1,entrance:{...e,id:'armory:entrance',kind:'armory_entry',type:'armory',hp:1},departureSign:{...e,id:'armory:departure-sign',kind:'armory_departure_sign',type:'armory',hp:1,indestructible:true},state:null,generated:false,objects:[],buildings:[],points:[],deadIds:[],bossDead:false,rewardClaimed:false};this._armoryPlacement=null;this.announce('军备库位置已公布，按M查看入口。');this.autosaveRequested=true;return;}job.route=null;}
      for(let i=0;i<2&&job.cursor<job.sites.length;i++){const p=job.sites[job.cursor++];if(this.obstacles(p,p,2).length||this.devices.some(d=>dist(d,p)<4)||this.drops.some(d=>dist(d,p)<3)||this.camp?.position&&pointRect(p,this.camp.position)<5||this.parking&&dist(p,this.parking.entrance)<10)continue;job.candidate=p;job.route=this.makeCampRoute({x:0,y:5},[p],true);return;}
      if(job.cursor>=job.sites.length){this._armoryPlacement=null;this._armoryRetry=this.seconds+15;if(!this._armoryWarned){this._armoryWarned=true;this.announce('军备库入口选址受阻，原出发路牌将在领地180—260米道路环带内重试，军备区南门仍在280—360米范围。');}}
    }
    createArmory(){
      const a=this.armory,L=root.ARMORY_ART.layout;a.generated=true;a.objects=[];a.buildings=[];a.points=[];
      const solid=(id,x,y,w,h,kind,extra={})=>{const o={id:'armory:'+id,type:'armory_solid',x,y,w,h,kind,hp:10,maxHP:10,...(kind==='fence'?{indestructible:true}:{}),...extra};a.objects.push(o);return o;};
      for(let i=0;i<200;i++){solid('fence:n:'+i,i+.5,0,1,.12,'fence');if(i<97||i>=103)solid('fence:s:'+i,i+.5,150,1,.12,'fence');}
      for(let i=0;i<150;i++){solid('fence:e:'+i,200,i+.5,.12,1,'fence');if(i<73||i>=77)solid('fence:w:'+i,0,i+.5,.12,1,'fence');}
      for(const entry of [...L.buildings,...L.tents]){
        const b={id:entry.id,x:entry.x,y:entry.z,w:entry.width,h:entry.depth,kind:entry.asset==='tent_layers'?'tent':'hangar',hp:10,maxHP:10};a.buildings.push(b);
        const doorWidth=b.kind==='tent'?2:4;
        for(const side of ['north','south','west','east']){const horizontal=['north','south'].includes(side),length=horizontal?b.w:b.h;for(let i=0;i<length;i++){const offset=i+.5-length/2;if(side==='south'&&Math.abs(offset)<doorWidth/2)continue;solid(b.id+':'+side+':'+i,b.x+(horizontal?offset:side==='west'?-b.w/2:b.w/2),b.y+(horizontal?side==='north'?-b.h/2:b.h/2:offset),horizontal?1:.12,horizontal?.12:1,'wall',{buildingId:b.id,shared:b.kind==='tent'?b.id:null,side});}}
        solid(b.id+':door',b.x,b.y+b.h/2,doorWidth,.12,'door',{buildingId:b.id,shared:b.kind==='tent'?b.id:null,open:false});
        if(b.kind==='tent'){b.lampRoll=this.random()<.3;b.lampClaimed=false;if(b.lampRoll)a.points.push({id:'armory:lamp:'+b.id,type:'armory',kind:'armory_lamp',x:b.x+2,y:b.y,hp:1,loot:{oil_lantern:1},opened:true,buildingId:b.id});}
      }
      for(const c of L.containers)solid(c.id,c.x,c.z,c.width,c.depth,c.asset,{indestructible:true,hp:1,maxHP:1,passable:c.asset.startsWith('container_')});
      for(const c of L.searchableCrates)a.points.push({id:'armory:'+c.id,x:c.x,y:c.z,type:'armory',kind:'armory_crate',category:c.type,buildingId:c.place,asset:c.asset,hp:1,opened:false,loot:clone(A.loot[c.type])});
      a.points.push({id:'armory:main',type:'armory',kind:'armory_exit',x:100,y:148,hp:1},{id:'armory:side',type:'armory',kind:'armory_exit',x:2,y:75,hp:1});
      const enemies=[];for(const [kind,count] of Object.entries(L.initialNormalEnemies)){if(!D.enemies[kind]||!Number.isInteger(count))continue;for(let i=0;i<count;i++){
        let p=null;for(let tries=0;tries<600;tries++){const q={x:8+this.random()*184,y:8+this.random()*134};if(dist(q,{x:100,y:147})<15||dist(q,{x:2,y:75})<12||a.objects.some(o=>!o.passable&&segmentHits(q,q,o,.5))||enemies.some(z=>dist(z,q)<2))continue;p=q;break;}
        if(!p){for(let x=8;x<195&&!p;x+=3)for(let y=8;y<140&&!p;y+=3){const q={x,y};if(dist(q,{x:100,y:147})>15&&!a.objects.some(o=>!o.passable&&segmentHits(q,q,o,.5))&&!enemies.some(z=>dist(z,q)<1.5))p=q;}}
        if(p){const d=D.enemies[kind];enemies.push({...p,id:100000+enemies.length,persistentId:`armory:enemy:${kind}:${i}`,kind,hp:this.enemyHP(kind,d.hp),maxHP:this.enemyHP(kind,d.hp),nextAttack:0,rootUntil:0,boostUntil:0,slowUntil:0,path:[],repathAt:0,rangedAt:0,screamAt:0});}
      }}
      const boss=this.makeSweeper();enemies.push(boss);a.boss=boss;a.residentRoster=clone(enemies);a.state={seconds:0,minutes:720,devices:[],zombies:enemies,drops:[],visitors:[],projectiles:[],zones:[],effects:[],spawned:57,deviceId:0,acidTime:0,fireTime:0};this.initializeArmoryBlueprints();
    }
    initializeArmoryBlueprints(){
      for(const o of this.armory?.points||[]){
        if(o.kind!=='armory_crate')continue;
        if(o.blueprintRollVersion===1)continue;
        o.tier=String(o.buildingId||'').startsWith('H')?'high':'low';
        o.blueprintRollVersion=1;o.blueprintId=null;o.blueprintLearned=false;delete o.knowledge;
        // Existing searched crates stay searched; migration only rolls unopened crates.
        if(!o.opened&&this.random()<A.blueprintDrops[o.tier].chance){const pool=A.blueprintDrops.pool;o.blueprintId=pool[Math.floor(this.random()*pool.length)];}
        this.autosaveRequested=true;
      }
    }
    makeSweeper(){return {id:'armory:sweeper',kind:'sweeper',x:150,y:67,hp:48,maxHP:48,home:{x:150,y:67},facing:{x:0,y:1},action:null,path:[],rootUntil:0,nextAttack:0,rocketAt:Infinity,sweepAt:Infinity,noticed:false};}
    switchArmory(){
      this.stopAutomaticFire?.();this.cancelBoneCharge();this.cancelAction();this.endStealth();this.playerAttack=null;this.player.fireVisual=null;this.playerLampVisual=null;this.playerSkillVisual=null;this.burstHits={};this.player.running=false;this.player.indoorHome=null;
      if(this.scene==='surface'){
        this.armorySurface={...this.captureScene(),position:{x:this.player.x,y:this.player.y}};if(!this.armory.generated)this.createArmory();const state=this.armory.state;this.shiftPersonalClock(state.seconds-this.seconds);Object.assign(this,state);this.armory.state=null;this.scene='armory';Object.assign(this.player,{x:100,y:146});this.armory.boss=this.zombies.find(z=>z.kind==='sweeper')||this.armory.boss;this.announce('军备库：地面时间暂停，两处出口始终可撤离；物资与驻守不会刷新。');
      }else if(this.scene==='armory'){
        if(!this.armory.bossDead){const boss=this.zombies.find(z=>z.kind==='sweeper');if(boss)Object.assign(boss,this.makeSweeper());}
        this.projectiles=[];this.zones=[];this.effects=[];this.zombies=this.zombies.filter(z=>!z.boneType);for(const z of this.zombies){z.windup=null;delete z.burningUntil;delete z.burnNext;}
        this.armory.state=this.captureScene();const state=this.armorySurface;this.shiftPersonalClock(state.seconds-this.seconds);Object.assign(this,state);Object.assign(this.player,state.position);this.scene='surface';this.armorySurface=null;this.updateIndoorHome();this.announce('返回地面，军备库物资与结构进度保留；存活扫荡者已恢复48生命。');
      }
      this._lights=null;this._nav=null;this._parkingCollision=null;this._pathJobs=new Map();this._pathQueue=[];this._flowCache=new Map();this._sceneJustChanged=true;this.navigationChanged();this.autosaveRequested=true;
    }
    advanceClock(dt){if(this.scene!=='armory')super.advanceClock(dt);}
    armoryNearbySolids(a,b,padding=0){
      let index=this._armoryIndex;if(!index||index.objects!==this.armory.objects){const cells=new Map();for(const o of this.armory.objects)for(let x=Math.floor((o.x-o.w/2)/4);x<=Math.floor((o.x+o.w/2)/4);x++)for(let y=Math.floor((o.y-o.h/2)/4);y<=Math.floor((o.y+o.h/2)/4);y++){const k=x+','+y;if(!cells.has(k))cells.set(k,[]);cells.get(k).push(o);}index=this._armoryIndex={objects:this.armory.objects,cells};}
      const found=new Set();for(let x=Math.floor((Math.min(a.x,b.x)-padding)/4);x<=Math.floor((Math.max(a.x,b.x)+padding)/4);x++)for(let y=Math.floor((Math.min(a.y,b.y)-padding)/4);y<=Math.floor((Math.max(a.y,b.y)+padding)/4);y++)for(const o of index.cells.get(x+','+y)||[])found.add(o);return [...found,...this.devices];
    }
    nearbyHomes(p,r){return this.scene==='armory'?[]:super.nearbyHomes(p,r);}
    movePlayer(dt,input){super.movePlayer(dt,input);if(this.scene==='armory'){this.player.x=Math.max(.3,Math.min(199.7,this.player.x));this.player.y=Math.max(.3,Math.min(149.7,this.player.y));}}
    updateIndoorHome(){if(this.scene!=='armory')return super.updateIndoorHome();this.player.indoorHome=this.armory.buildings.find(b=>b.hp>0&&Math.abs(this.player.x-b.x)<b.w/2&&Math.abs(this.player.y-b.y)<b.h/2)?.id||null;}
    updateDoors(){if(this.scene!=='armory')return super.updateDoors();for(const o of this.armory.objects)if(o.kind==='door'&&o.hp>0)o.open=pointRect(this.player,o)<2||this.zombies.some(z=>z.hp>0&&pointRect(z,o)<1.5)||(this.humanDoorActors?.()||[]).some(z=>pointRect(z,o)<1.5);}
    obstacles(a,b=a,padding=.22){if(this.scene!=='armory')return super.obstacles(a,b,padding);const out=this.armoryNearbySolids(a,b,padding).filter(o=>o.hp>0&&!(o.kind==='door'&&(o.open||this._armoryBossPlanning))&&!(o.shared&&this.armory.buildings.find(b=>b.id===o.shared)?.hp<=0)&&(!o.passable||this._thermalCoverCheck)&&!(o.type==='device'&&!this.blocking(o))&&segmentHits(a,b,o,padding));return this._armoryBossPlanning?out.map(o=>({...o,indestructible:true})):out;}
    *pathSearch(z,target){if(this.scene!=='armory'||z.kind!=='sweeper')return yield*super.pathSearch(z,target);const iterator=super.pathSearch(z,target);let result;do{this._armoryBossPlanning=true;try{result=iterator.next();}finally{this._armoryBossPlanning=false;}if(!result.done)yield;}while(!result.done);return result.value;}
    clearLine(a,b,ignore=null){if(this.scene!=='armory')return super.clearLine(a,b,ignore);return !this.armoryNearbySolids(a,b).some(o=>o!==ignore&&o.hp>0&&!(o.type==='device'&&!this.blocking(o))&&!(o.kind==='door'&&o.open)&&!(o.shared&&this.armory.buildings.find(b=>b.id===o.shared)?.hp<=0)&&segmentHits(a,b,o,0));}
    updateCombatBones(dt){const old=this._thermalCoverCheck;this._thermalCoverCheck=this.scene==='armory'||this.armoryWorldActive;try{return super.updateCombatBones(dt);}finally{this._thermalCoverCheck=old;}}
    blocksVision(o){return o.type==='armory_solid'?true:super.blocksVision(o);}
    visionObstacles(a,b,ignore=null){if(this.scene!=='armory')return super.visionObstacles(a,b,ignore);const old=this._thermalCoverCheck;this._thermalCoverCheck=true;try{return this.obstacles(a,b,0).filter(o=>o!==ignore&&this.blocksVision(o));}finally{this._thermalCoverCheck=old;}}
    canPlace(kind,p){if(this.scene!=='armory')return super.canPlace(kind,p);const d=D.builds[kind];if(!d||this.day<d.day)return '配方尚未开放';if(!p||!Number.isFinite(p.x)||!Number.isFinite(p.y)||dist(p,this.player)>2)return '请靠近放置点（2米内）';if(kind==='planter')return '园区不支持种植';if(p.x<2||p.x>198||p.y<2||p.y>148||Math.abs(p.x-100)<4||Math.abs(p.y-75)<4||this.armory.points.some(o=>dist(o,p)<2))return '请保留主路、两处出口及物资点通行';for(const [k,n] of Object.entries(d.cost))if(this.count(k)<n)return `${S.NAMES[k]}不足`;if(this.obstacles(p,p,.5).length||this.devices.some(o=>o.hp>0&&dist(p,o)<1)||dist(p,this.player)<.5||this.zombies.some(z=>z.hp>0&&dist(z,p)<.6))return '放置点被占用';if(!this.clearLine(this.player,p))return '不能隔着掩体放置';if(S.Parking.lamps[kind]?.fixed&&!this.stationNear('workbench'))return '建造灯具需要附近的工作台';return null;}
    canSee(p){if(this.scene!=='armory')return super.canSee(p);const limit=this.traitEffects.myopia?18:Infinity;return dist(p,this.player)<=limit&&this.clearVision(this.player,p,p);}
    find(id){return this.armory&&this.armory.entrance.id===id?this.armory.entrance:this.scene==='armory'?(this.armory.points.find(o=>o.id===id)||this.armory.objects.find(o=>o.id===id)||this.devices.find(o=>o.id===id)):super.find(id);}
    damageBuilding(o,n){if(o.kind==='fence'&&o.id?.startsWith('armory:fence:'))return;if(o.type!=='armory_solid')return super.damageBuilding(o,n);if(o.indestructible||o.hp<=0)return;if(o.shared){const b=this.armory.buildings.find(b=>b.id===o.shared);b.hp=Math.max(0,b.hp-n);for(const wall of this.armory.objects)if(wall.shared===o.shared)wall.hp=b.hp;}else o.hp=Math.max(0,o.hp-n);this.navigationChanged();this.autosaveRequested=true;}
    nearbyInteraction(){
      if(this.scene!=='armory'){const current=super.nearbyInteraction(),e=this.armory?.entrance;return this.scene==='surface'&&e&&dist(e,this.player)<1.8&&this.clearLine(this.player,e)&&(!current||dist(e,this.player)<current.distance)?{type:'armory',object:e,distance:dist(e,this.player)}:current;}
      const choices=this.armory.points.filter(o=>dist(o,this.player)<1.8&&this.clearLine(this.player,o,o)).map(o=>({type:'armory',object:o,distance:dist(o,this.player)}));for(const d of this.drops)if(dist(d,this.player)<1.5)choices.push({type:'drop',object:d,distance:dist(d,this.player)});for(const d of this.devices)if(d.hp>0&&dist(d,this.player)<1.8)choices.push({type:S.Parking.lamps[d.kind]?'lamp':'device',object:d,distance:dist(d,this.player)});return choices.sort((a,b)=>a.distance-b.distance)[0]||null;
    }
    interact(target){if(target?.type!=='armory')return super.interact(target);const o=target.object;if(this.result||this.action||!o||dist(this.player,o)>=1.8||!this.clearLine(this.player,o,o)||this.scene!==(o.kind==='armory_entry'?'surface':'armory'))return false;if(o.opened&&['armory_crate','armory_lamp'].includes(o.kind)){this.claimArmoryLoot(o);return true;}return this.beginAction('armory_action',o.kind==='armory_crate'?4:2,{target:o.id,operation:o.kind});}
    claimArmoryLoot(o){for(const [kind,n] of Object.entries(o.loot||{}))for(let i=0;i<n;i++){if(!this.add(kind,1))break;o.loot[kind]--;}if(o.kind==='armory_lamp'&&!Object.values(o.loot).some(n=>n>0)){const b=this.armory.buildings.find(b=>b.id===o.buildingId);if(b)b.lampClaimed=true;}this.autosaveRequested=true;this.announce(Object.values(o.loot||{}).some(n=>n>0)?'背包空间不足，剩余物资保留在原箱中。':'已领取全部物资。');}
    actionDuration(type,duration,data){return super.actionDuration(type,type==='armory_action'&&data.operation==='armory_crate'?duration*this.traitEffects.search:duration,data);}
    updateAction(dt){const a=this.action;if(a?.type!=='armory_action')return super.updateAction(dt);const o=this.find(a.target);if(!o||dist(this.player,o)>1.8||dist(this.player,a.start)>.025||!this.clearLine(this.player,o,o)){this.cancelAction('移动或遮挡中断了操作。');return;}a.elapsed+=dt;if(a.elapsed+1e-8>=a.duration)this._armoryReady=a;}
    finishArmoryAction(a){if(this.action!==a||this.result)return;const o=this.find(a.target);if(!o||dist(this.player,o)>1.8||!this.clearLine(this.player,o,o)){this.cancelAction('目标已不可达，操作已取消。');return;}this.action=null;
      if(['armory_entry','armory_exit'].includes(o.kind)){this.switchArmory();return;}
      if(o.kind==='armory_briefcase'){if(!this.armory.rewardClaimed||!this.firepower.unlocked){this.firepower.unlocked=true;this.armory.rewardClaimed=true;this.announce('已解锁火力全开；武器与弹药蓝图可搜索军备箱获得。');}this.autosaveRequested=true;return;}
      if(!o.opened){this.initializeArmoryBlueprints();o.opened=true;this.stats.searches++;if(o.blueprintId&&!o.blueprintLearned){const known=!!this.knowledge[o.blueprintId];this.knowledge[o.blueprintId]=true;o.blueprintLearned=true;this.announce(`${known?'发现已学会的':'找到并学会'}${A.blueprints[o.blueprintId]}。`);}this.audioEvents.push({kind:'container-open'});}
      this.claimArmoryLoot(o);
    }
    damageZombie(z,n,source='normal'){
      if(z.kind==='sweeper'){if(source!=='bone_skill'&&z.hp>0)this.effects.push({kind:'thermal_armor',x:z.x,y:z.y,started:this.seconds,until:this.seconds+.18});n=source==='bone_skill'?n:Math.max(0,n-.5);z.noticed=true;if(!this.hidden&&this.clearVision(z,this.player,this.player))z.lastSeen={x:this.player.x,y:this.player.y};if(!z.engagedAt){z.engagedAt=this.seconds;z.rocketAt=this.seconds+6;z.sweepAt=this.seconds+3;}}
      const alive=z.hp>0;super.damageZombie(z,n,source);
      if(alive&&z.hp<=0&&this.scene==='armory'){this.armory.deadIds.push(z.id);if(['sweeper','armory_blade_zombie'].includes(z.kind))this.effects.push({kind:'armory_death',x:z.x,y:z.y,enemyKind:z.kind,facing:z.facing,started:this.seconds,until:this.seconds+1.2});if(z.kind==='sweeper'){z.action=null;this.armory.bossDead=true;this.projectiles=this.projectiles.filter(p=>p.owner!=='enemy'||p.source!=='sweeper');let p={x:z.x,y:z.y};const free=q=>!this.armoryNearbySolids(q,q,.4).some(o=>o.hp>0&&segmentHits(q,q,o,.4));if(!free(p)){outer:for(let r=1;r<=12;r++)for(let i=0;i<24;i++){const q={x:z.x+Math.cos(i*Math.PI/12)*r,y:z.y+Math.sin(i*Math.PI/12)*r};if(free(q)){p=q;break outer;}}}if(!this.armory.points.some(o=>o.id==='armory:reward'))this.armory.points.push({id:'armory:reward',type:'armory',kind:'armory_briefcase',...p,hp:1});}this.autosaveRequested=true;}
    }
    step(dt,input={}){this._armoryReady=null;super.step(dt,input);if(this._armoryReady)this.finishArmoryAction(this._armoryReady);this._armoryReady=null;if(this.scene==='surface'&&!this.result&&this.seconds>=(this._armoryRetry||0))this.ensureArmory();}
    snapshot(){const d=super.snapshot();d.armory=clone(this.armory);if(this.scene==='armory')d.armory.state=null;d.armorySurface=clone(this.armorySurface);d.armoryPendingAction=this.action?.type==='armory_action'?clone(this.action):null;return d;}
    static restore(d){const g=Base.restore(d);Object.setPrototypeOf(g,ArmoryGame.prototype);g.armory=d.armory||null;g.armorySurface=d.armorySurface||null;g._armoryPlacement=null;g._armoryReady=null;g.initializeArmoryBlueprints();if(g.scene==='armory')g.armory.boss=g.zombies.find(z=>z.kind==='sweeper')||g.armory.boss;if(d.armoryPendingAction)g.announce('上次未完成的军备库操作已取消。');return g;}
  }
  S.Game=ArmoryGame;
})(globalThis);
