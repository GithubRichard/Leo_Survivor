/* Military enemies stay out of underground spawn/strength/light rules. */
(function(root){
  'use strict';const S=root.Survival,A=root.ArmoryData,{dist,pointRect}=S;
  const aim=(a,b)=>{const n=dist(a,b)||1;return {x:(b.x-a.x)/n,y:(b.y-a.y)/n};};
  Object.assign(S.Game.prototype,{
    moveArmoryEnemy(z,target,speed,dt){
      speed=this.enemySpeed(z.kind,speed);if(z.rootUntil>this.seconds)return;
      if(this.seconds>=(z.repathAt||0)&&this.pathBudget>0&&this.requestPath(z,target)){this.pathBudget--;z.repathAt=this.seconds+2;}
      z.path=z.path||[];while(z.path.length&&dist(z,z.path[0])<.15)z.path.shift();const p=z.path[0]||target,f=aim(z,p),length=Math.min(dist(z,p),speed*dt),next={x:z.x+f.x*length,y:z.y+f.y*length};z.facing=f;
      const blockers=this.obstacles(z,next,.24);if(!blockers.length){Object.assign(z,next);z.visualDistance=(z.visualDistance||0)+length;z.visualMoveAt=this.seconds;return;}
      const wall=blockers.find(o=>!o.indestructible);if(z.kind==='armory_blade_zombie'&&wall&&pointRect(z,wall)<1.4&&this.seconds>=(z.nextAttack||0)){z.nextAttack=this.seconds+1.8;z.armoryAction={kind:'blade',started:this.seconds,release:this.seconds+.5,until:this.seconds+.9,facing:aim(z,wall),target:wall.id,released:false};}
    },
    updateBlade(z,dt){
      const a=z.armoryAction;
      if(a){if(!a.released&&this.seconds>=a.release){a.released=true;const target=a.target==='player'?this.player:this.find(a.target);if(target?.hp>0&&!(target===this.player&&this.hidden)){const d=target.w?pointRect(z,target):dist(z,target),f=aim(z,target);if(d<=1.4&&f.x*a.facing.x+f.y*a.facing.y>=.5&&this.clearLine(z,target,target)){if(target===this.player)this.damagePlayer(4,'armory_blade_zombie');else this.damageBuilding(target,this.enemyDamage(4,z.kind));}}}if(this.seconds>=a.until)z.armoryAction=null;return;}
      if(this.hidden)return;
      if(dist(z,this.player)<=1.4&&this.clearLine(z,this.player)){if(this.seconds>=z.nextAttack){z.nextAttack=this.seconds+1.8;z.facing=aim(z,this.player);z.armoryAction={kind:'blade',started:this.seconds,release:this.seconds+.5,until:this.seconds+.9,facing:{...z.facing},target:'player',released:false};}return;}
      this.moveArmoryEnemy(z,this.player,2.2*(z.boostUntil>this.seconds?1.2:1),dt);
    },
    updateSweeper(z,dt){
      if(z.hp<=0||this.result)return;
      const visible=!this.hidden&&dist(z,this.player)<=22&&this.clearVision(z,this.player,this.player);
      if(visible){z.lastSeen={x:this.player.x,y:this.player.y};if(!z.noticed){z.noticed=true;z.engagedAt=this.seconds;z.rocketAt=this.seconds+6;z.sweepAt=this.seconds+3;}}
      if(!z.noticed)return;
      let a=z.action;
      if(a){
        if(visible&&a.kind!=='burst'){a.target={...z.lastSeen};z.facing=aim(z,a.target);}
        const delay=a.kind==='rocket'?4:a.kind==='sweep'?1:.5,total=a.kind==='rocket'?1:a.kind==='sweep'?10:3,release=a.started+delay+a.next*.12;
        if(a.next<total&&this.seconds+1e-8>=release){
          if(a.kind==='burst'&&a.next===0&&visible)a.locked={...z.lastSeen};const target=a.kind==='burst'?a.locked:a.target;
          if(target){const f=aim(z,target),state=a.kind==='rocket'?'rocket_fire':a.kind==='sweep'?'sweep_fire_'+['a','b','c'][a.next%3]:'rifle_fire_'+(a.next+1);z.facing=f;this.emitThermal(z,a.kind==='rocket'?'rocket_launcher':'assault_rifle',f,{state,damage:a.kind==='rocket'?6:1.5,radius:a.kind==='rocket'?.5:undefined,speed:a.kind==='rocket'?8:A.provisional.bossBulletSpeed,range:a.kind==='rocket'?22:18,group:a.group,groupWindow:a.kind==='sweep'?1.5:.35});if(a.kind==='rocket')z.rocketAt=this.seconds+10;}
          a.next++;if(a.next===total){a.recoverUntil=this.seconds+.8;if(a.kind==='sweep')z.sweepAt=this.seconds+12;}
        }
        if(a.next===total&&this.seconds>=a.recoverUntil){z.action=null;z.adjustUntil=this.seconds+1;}return;
      }
      if(this.seconds<(z.adjustUntil||0)){if(visible&&dist(z,this.player)>10)this.moveArmoryEnemy(z,this.player,1.8,dt);return;}
      if(!visible){if(z.lastSeen&&dist(z,z.lastSeen)>1&&pointRect(z.lastSeen,{...z.home,w:60,h:50})<1)this.moveArmoryEnemy(z,z.lastSeen,1.8,dt);return;}
      let kind=this.seconds>=z.rocketAt?'rocket':this.seconds>=z.sweepAt?'sweep':this.seconds>=z.nextAttack&&dist(z,this.player)<=18?'burst':null;
      if(kind){const group=`sweeper:${++this.ballisticSerial}`;z.nextAttack=this.seconds+2;z.action={kind,started:this.seconds,next:0,target:{...z.lastSeen},locked:{...z.lastSeen},group};z.facing=aim(z,z.lastSeen);}
      else if(dist(z,this.player)>14&&pointRect(this.player,{...z.home,w:60,h:50})<1)this.moveArmoryEnemy(z,this.player,1.8,dt);
    }
  });
  const original=S.Game.prototype.updateZombies;
  S.Game.prototype.updateZombies=function(dt){
    if(this.scene!=='armory')return original.call(this,dt);
    const special=this.zombies.filter(z=>['sweeper','armory_blade_zombie'].includes(z.kind)&&z.hp>0),roots=special.map(z=>z.rootUntil);
    for(const z of special)z.rootUntil=Infinity;
    try{original.call(this,dt);}finally{special.forEach((z,i)=>z.rootUntil=roots[i]);}
    for(const z of special){if(this.result)break;if(z.kind==='sweeper')this.updateSweeper(z,dt);else this.updateBlade(z,dt);}
  };
})(globalThis);
