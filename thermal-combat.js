/* Weapon events run on simulation time, independently from sprite loops. */
(function(root){
  'use strict';const S=root.Survival,Base=S.Game,A=root.ArmoryData,D=S.Expansion,{dist,segmentHits}=S;
  const unit=f=>{const n=Math.hypot(f.x,f.y)||1;return {x:f.x/n,y:f.y/n};};
  const gun=k=>k==='shotgun'?{...D.weapons.shotgun,windup:.16,recover:.32,speed:18}:A.guns[k];
  class ThermalGame extends Base{
    constructor(options={}){super(options);this.knowledge={};this.firepower={unlocked:false,until:0,cooldown:0};this.ballisticSerial=0;this.burstHits={};this.fireHeld=false;}
    rangedAttackScale(kind){return A.hotWeapons.has(kind)?this.traitEffects.ranged:super.rangedAttackScale(kind);}
    craft(kind){const d=A.guns[kind]||A.ammo[kind];if(d?.knowledge&&!this.knowledge[d.knowledge]){this.announce('尚未学会对应蓝图或弹药配方。');return false;}return super.craft(kind);}
    equip(kind){if(this.player.weapon!==kind)this.stopAutomaticFire();if(kind==='pistol'&&this.count(kind)){this.player.weapon=kind;this.announce('已装备手枪，可与左手灯共持。');return true;}return super.equip(kind);}
    activateFirepower(){const s=this.firepower;if(!s.unlocked||this.result||this.action||this.playerAttack||this.boneSkill.charging||this.seconds<this.boneSkill.recoverUntil||this.seconds<s.cooldown)return false;this.endStealth();s.until=this.seconds+6;s.cooldown=this.seconds+30;this.firepowerStartup=this.seconds+.2;this.autosaveRequested=true;return true;}
    stopAutomaticFire(){this.fireHeld=false;if(this.playerAttack?.weapon==='smg'){this.attackAt=Math.max(this.attackAt,this.seconds+.2*this.playerAttack.scale);this.player.fireVisual={state:'stop',at:this.seconds,until:this.seconds+.2*this.playerAttack.scale};this.playerAttack=null;}}
    cancelAction(reason){this.stopAutomaticFire();return super.cancelAction(reason);}
    attack(){
      const k=this.player.weapon,w=gun(k);if(!w)return super.attack();
      if(this.action||this.playerAttack||this.boneSkill.charging||this.seconds<this.boneSkill.recoverUntil||this.seconds<this.attackAt||this.seconds<(this.firepowerStartup||0))return false;
      if(k!=='pistol'&&this.heldLightId){this.announce('双手武器需先放下手持灯。');return false;}
      if(!this.count(w.ammo)){this.announce('弹药不足。');return false;}
      this.endStealth();this.interruptBandage('攻击');const scale=this.rangedAttackScale(k),start=this.seconds;
      this.playerAttack={thermal:true,kind:'ranged',weapon:k,facing:unit(this.player.facing),startedAt:start,scale,next:0,releaseAt:start+w.windup*scale,endsAt:start+(w.windup+w.recover+(k==='assault_rifle'?.24:0))*scale,released:false};
      this.attackAt=start+w.interval*scale;if(k==='smg')this.fireHeld=true;return true;
    }
    movementSpeed(base,p=this.player){let speed=super.movementSpeed(base,p);if(p===this.player&&this.playerAttack?.thermal&&!this.playerAttack.released){if(this.playerAttack.weapon==='sniper_rifle')speed*=.5;else if(this.playerAttack.weapon==='smg')speed*=.75;}return speed;}
    movePlayer(dt,input){if(input.run&&['smg','sniper_rifle'].includes(this.playerAttack?.weapon)){if(this.playerAttack.weapon==='smg')this.stopAutomaticFire();else if(!this.playerAttack.released)this.playerAttack=null;}const before={x:this.player.x,y:this.player.y};super.movePlayer(dt,input);this._thermalMoving=dist(before,this.player)>1e-7;}
    damagePlayer(n,source,ground){const hit=super.damagePlayer(n,source,ground);if(hit&&this.playerAttack?.weapon==='sniper_rifle'&&!this.playerAttack.released)this.playerAttack=null;if(this.result)this.firepower.until=0;return hit;}
    muzzlePoint(actor,asset,state,facing){
      const dir=root.GameArt?.eightDirection(facing),id=`armory_${asset}_${dir}__${state}`,meta=root.ARMORY_ART?.frames[id],anchor=root.ARMORY_ART?.anchors[id];
      if(!meta||!anchor?.muzzle)return {x:actor.x+facing.x*.55,y:actor.y+facing.y*.55,z:1.05};
      const scale=(actor===this.player?50:56)/meta.bodyHeight/27,sx=(anchor.muzzle[0]-meta.pivot[0])*scale,sy=(anchor.muzzle[1]-meta.pivot[1])*scale+1.05;
      return {x:actor.x+(sx+2*sy)/2,y:actor.y+(2*sy-sx)/2,z:1.05};
    }
    emitThermal(actor,weapon,facing,options={}){
      const w=gun(weapon),enemy=actor!==this.player,damage=enemy?(options.damage??1.5):Math.max(0,w.damage+(this.seconds<this.firepower.until?1:0)-(this.weaknessUntil>this.seconds?.7:0)),asset=enemy?'sweeper':'player_'+weapon;
      const p=this.muzzlePoint(actor,asset,options.state||'fire',facing),rocket=weapon==='rocket_launcher',radius=rocket?(enemy?.5:1.5):undefined;
      const shot={...p,id:`ballistic:${++this.ballisticSerial}`,thermal:true,actorId:actor.id,kind:rocket?'thermal_rocket':'thermal_bullet',weapon,owner:enemy?'enemy':'player',source:enemy?'sweeper':'weapon',group:options.group,groupWindow:options.groupWindow||0,damage,radius,speed:options.speed||w?.speed||1.5,range:options.range||w?.range||18};
      shot.vx=facing.x*shot.speed;shot.vy=facing.y*shot.speed;
      const hits=this.thermalCovers(actor,p).map(o=>({o,t:this.thermalHitFraction(actor,p,o)})).sort((a,b)=>a.t-b.t),hit=hits[0];if(hit){const t=Math.max(0,hit.t-1e-4);shot.x=actor.x+(p.x-actor.x)*t;shot.y=actor.y+(p.y-actor.y)*t;this.thermalImpact(shot,hit.o);}else this.projectiles.push(shot);
      actor.fireVisual={state:options.state||'fire',at:this.seconds,until:this.seconds+.1};return shot;
    }
    updatePlayerAttack(){
      const a=this.playerAttack;if(!a?.thermal)return super.updatePlayerAttack();const w=gun(a.weapon);
      if(this.player.weapon!==a.weapon||this.result||a.weapon==='smg'&&!this.fireHeld){this.playerAttack=null;return;}
      if(this.seconds+1e-8>=a.releaseAt){
        if(!this.count(w.ammo)){this.playerAttack=null;this.stopAutomaticFire();return;}
        const f=a.weapon==='assault_rifle'?a.facing:unit(this.player.facing),pellets=a.weapon==='shotgun'?4:1;
        if(a.weapon==='smg'){const spread=(this.player.running||this._thermalMoving?8:4)*Math.PI/180,angle=Math.atan2(f.y,f.x)+(this.random()*2-1)*spread;f.x=Math.cos(angle);f.y=Math.sin(angle);}
        if(!this.remove(w.ammo,1))return;
        for(let i=0;i<pellets;i++){const angle=Math.atan2(f.y,f.x)+(pellets===4?(i-1.5)*.11:0),state=a.weapon==='assault_rifle'?'fire_'+(a.next+1):a.weapon==='smg'?'fire_'+(a.next%2?'b':'a'):'fire';this.emitThermal(this.player,a.weapon,{x:Math.cos(angle),y:Math.sin(angle)},{state});}
        a.released=true;a.next++;a.lastRelease=this.seconds;
        if(a.weapon==='smg'){a.releaseAt=this.seconds+.2*a.scale;a.endsAt=Infinity;a.released=false;}
        else if(a.weapon==='assault_rifle'&&a.next<3){a.releaseAt=a.startedAt+.12*a.next*a.scale;}
        else a.releaseAt=Infinity;
      }
      if(this.seconds+1e-8>=a.endsAt)this.playerAttack=null;
    }
    thermalCovers(a,b){const old=this._thermalCoverCheck;this._thermalCoverCheck=true;try{return this.obstacles(a,b,0);}finally{this._thermalCoverCheck=old;}}
    thermalHitFraction(a,b,o,padding=0){if(!segmentHits(a,b,o,padding))return Infinity;let lo=0,hi=1;for(let i=0;i<15;i++){const t=(lo+hi)/2,q={x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t};if(segmentHits(a,q,o,padding))hi=t;else lo=t;}return hi;}
    burstDamage(shot){
      const old=this.burstHits[shot.group],bypass=old&&this.seconds<=old.until&&!old.ids.includes(shot.id)&&old.ids.length<(shot.groupWindow>.4?10:3),protection=this.player.invulnerableUntil;
      if(bypass)this.player.invulnerableUntil=0;
      const hit=this.damagePlayer(shot.damage,shot.source);
      if(hit&&shot.group){const group=old&&this.seconds<=old.until?old:{until:this.seconds+shot.groupWindow,ids:[]};group.ids.push(shot.id);this.burstHits[shot.group]=group;}
      if(!hit&&bypass)this.player.invulnerableUntil=protection;
    }
    normalizeThermalShot(shot){if(!shot.thermal)return shot;if(shot.weapon==='rocket_launcher'){shot.kind='thermal_rocket';shot.radius=shot.owner==='enemy'?.5:1.5;}else{shot.kind='thermal_bullet';delete shot.radius;}return shot;}
    thermalImpact(shot,wall=null,targetHit=false){
      shot.dead=true;
      if(A.isRocketShot(shot)){
        // Resolve every line against intact cover before applying any damage.
        const basicVictims=shot.owner==='enemy'?[this.player,...this.devices,...this.zombies.filter(z=>z.hp>0&&z.faction==='player')]:[...this.zombies.filter(z=>z.hp>0),this.player,...this.devices];
        const victims=this.blastTargets?this.blastTargets(shot,basicVictims):basicVictims;
        const structures=[...this.nearbyHomes(shot,shot.radius+3).flatMap(h=>h.objects),...(this.armoryWorldActive?this.armory.objects:[])];
        const all=[...new Set([...victims,...structures])],hits=all.filter(o=>o.hp>0&&(o.w?S.pointRect(shot,o):dist(shot,o))<=shot.radius+1e-8&&!this.thermalCovers(shot,o).some(c=>c!==o));
        const structuresHit=new Set();for(const o of hits)if(o===this.player)this.damagePlayer(shot.damage,shot.owner==='enemy'?'sweeper_rocket':'rocket_self');else if(this.zombies.includes(o))this.damageZombie(o,shot.owner==='enemy'?this.enemyDamage(shot.damage,shot.source):shot.damage,shot.owner==='enemy'?shot.source:'weapon',shot.actorId);else {const id=o.shared||o.id;if(!structuresHit.has(id)){structuresHit.add(id);this.damageBuilding(o,shot.owner==='enemy'?this.enemyDamage(shot.damage,shot.source):shot.damage);}}
        this.effects.push({kind:'thermal_rocket_explosion',weapon:'rocket_launcher',projectileKind:'thermal_rocket',x:shot.x,y:shot.y,radius:shot.radius,enemy:shot.owner==='enemy',started:this.seconds,until:this.seconds+.5});
      }else {if(wall)this.damageBuilding(wall,shot.owner==='enemy'?this.enemyDamage(shot.damage,shot.source):shot.damage);if(wall||targetHit)this.effects.push({kind:'thermal_bullet_hit',x:shot.x,y:shot.y,z:.85,started:this.seconds,until:this.seconds+.12});}
    }
    updateProjectiles(dt){
      const thermal=this.projectiles.filter(p=>p.thermal);this.projectiles=this.projectiles.filter(p=>!p.thermal);
      const old=this._thermalCoverCheck;this._thermalCoverCheck=this.scene==='armory'||this.armoryWorldActive;try{super.updateProjectiles(dt);}finally{this._thermalCoverCheck=old;}
      if(this.scene==='armory'||this.armoryWorldActive)thermal.sort((a,b)=>Number(a.owner==='enemy')-Number(b.owner==='enemy'));
      for(const shot of thermal){
        this.normalizeThermalShot(shot);
        if(this.result)break;if((this.scene==='armory'||this.armoryWorldActive)&&this.armory.bossDead&&shot.owner==='enemy'&&shot.source==='sweeper')continue;
        const from={x:shot.x,y:shot.y},travel=Math.min(shot.range,shot.speed*dt),to={x:from.x+shot.vx/shot.speed*travel,y:from.y+shot.vy/shot.speed*travel};
        const targets=shot.owner==='enemy'?(this.enemyProjectileTargets?this.enemyProjectileTargets(shot):[this.player,...this.zombies.filter(z=>z.boneType==='player'&&z.hp>0)]):this.zombies.filter(z=>z.hp>0&&z.faction!=='player');
        const hits=this.thermalCovers(from,to).map(o=>({o,t:this.thermalHitFraction(from,to,o),wall:true}));
        for(const o of targets){const t=S.boneCircleHit(from,to,o,o.radius||.24);if(Number.isFinite(t))hits.push({o,t,wall:false});}
        hits.sort((a,b)=>a.t-b.t||Number(b.wall)-Number(a.wall));const hit=hits[0];
        if(hit){const t=Math.max(0,hit.t-1e-4/Math.max(.001,travel));shot.x=from.x+(to.x-from.x)*t;shot.y=from.y+(to.y-from.y)*t;if(!A.isRocketShot(shot)&&!hit.wall){if(hit.o===this.player)this.burstDamage(shot);else this.damageZombie(hit.o,shot.owner==='enemy'?this.enemyDamage(shot.damage,shot.source):shot.damage,shot.source);}this.thermalImpact(shot,hit.wall?hit.o:null,!hit.wall);}
        else {Object.assign(shot,to);shot.range-=travel;if(shot.range<=1e-8)this.thermalImpact(shot);}
        if(!shot.dead)this.projectiles.push(shot);
      }
      for(const [id,g] of Object.entries(this.burstHits))if(g.until<this.seconds)delete this.burstHits[id];
    }
    shiftPersonalClock(delta){super.shiftPersonalClock(delta);if(this.firepower){this.firepower.until+=delta;this.firepower.cooldown+=delta;}if(this.firepowerStartup)this.firepowerStartup+=delta;}
    step(dt,input={}){this._thermalMoving=!!(input.up||input.down||input.left||input.right||input.moveX||input.moveY);if(this.player.weapon==='smg'&&this.playerAttack?.weapon==='smg'&&!input.fireHeld)this.stopAutomaticFire();this.fireHeld=!!input.fireHeld;if(input.fireHeld&&this.player.weapon==='smg'&&!this.playerAttack)this.attack();super.step(dt,input);}
    snapshot(){const d=super.snapshot();Object.assign(d,{armoryBlueprintVersion:1,knowledge:this.knowledge,firepower:this.firepower,firepowerStartup:this.firepowerStartup||0,ballisticSerial:this.ballisticSerial,burstHits:this.burstHits});return d;}
    static restore(d){const g=Base.restore(d);Object.setPrototypeOf(g,ThermalGame.prototype);g.knowledge=d.knowledge||{};
      if(!d.armoryBlueprintVersion){if(g.knowledge.ammo_recipe_book){g.knowledge.blueprint_rifle_round=true;g.knowledge.blueprint_rocket_round=true;}if(g.knowledge.blueprint_sniper_rifle)g.knowledge.blueprint_sniper_round=true;}
      g.firepower=d.firepower||{unlocked:false,until:0,cooldown:0};g.firepowerStartup=d.firepowerStartup||0;g.ballisticSerial=d.ballisticSerial||0;g.burstHits=d.burstHits||{};g.fireHeld=false;g.stopAutomaticFire();const scenes=[g,g.surfaceState,g.armorySurface,g.armory?.state,g.parking?.state,...Object.values(g.parking?.floors||{}).map(f=>f.state)];for(const scene of new Set(scenes)){if(!scene)continue;for(const shot of scene.projectiles||[])g.normalizeThermalShot(shot);if(scene.effects)scene.effects=scene.effects.filter(f=>f.kind!=='thermal_explosion');}return g;}
  }
  S.Game=ThermalGame;
})(globalThis);
