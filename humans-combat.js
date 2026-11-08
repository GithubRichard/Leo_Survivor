/* One release per NPC action; four shotgun pellets settle as one attack per victim. */
(() => {
  const P=HumansGame.prototype,Base=Object.getPrototypeOf(P),S=Survival,H=HumansData,{dist}=S;
  const face=(a,b)=>{const n=dist(a,b)||1;return {x:(b.x-a.x)/n,y:(b.y-a.y)/n};};
  Object.assign(P,{
    humanEnemyVictim(z,range=this.scene==='parking'?12:z.kind==='sweeper'?22:16){
      if(!this.humanMode||!this.humans)return null;
      const old=z.humanVictimId==='player'?this.player:this.find(z.humanVictimId);
      if(this.seconds<(z.humanVictimAt||0)&&old?.hp>0&&!(old===this.player&&this.hidden))return old;
      const candidates=[...(!this.hidden?[this.player]:[]),...this.humanActiveActors()].filter(a=>a.hp>0&&dist(z,a)<=range&&this.clearVision(z,a,a)&&!(this.scene==='parking'&&this.isLit(a)));
      candidates.sort((a,b)=>dist(z,a)-dist(z,b)||String(a.id||'player').localeCompare(String(b.id||'player')));
      let target=candidates[0];if(target&&old&&candidates.includes(old)&&Math.abs(dist(z,target)-dist(z,old))<1e-8)target=old;
      z.humanVictimId=target?(target===this.player?'player':target.id):null;z.humanVictimAt=this.seconds+.5;return target||null;
    },
    enemyTarget(z){const target=this.humanEnemyVictim(z);return target||(Base.enemyTarget?Base.enemyTarget.call(this,z):this.player);},
    perceive(z){const target=this.humanEnemyVictim(z,12);if(target){z.lastSeen={x:target.x,y:target.y};return target;}return Base.perceive.call(this,z);},
    startHumanAttack(a,target){
      const w=a.kind==='starving_civilian'?{damage:1,range:1.1,windup:.3}:a.kind==='loyal_follower'?{damage:2.5,range:1.3,windup:.4}:H.weapons[a.weapon];
      if(this.seconds<(a.nextAttack||0)||dist(a,target)>w.range||!this.clearLine(a,target,target))return false;
      a.nextAttack=this.seconds+(a.kind==='starving_civilian'?1.5:2);a.facing=face(a,target);a.action={id:'human-attack:'+ ++this.humans.serial,target:target===this.player?'player':target.id,aim:{x:target.x,y:target.y},started:this.seconds,release:this.seconds+w.windup,until:this.seconds+w.windup+.35,released:false};a.lastCombat=this.seconds;return true;
    },
    updateHumanAttack(a){
      const action=a.action;if(!action)return;const target=action.target==='player'?this.player:this.find(action.target),w=a.kind==='starving_civilian'?{damage:1,range:1.1}:a.kind==='loyal_follower'?{damage:2.5,range:1.3}:H.weapons[a.weapon];
      if(!action.released&&this.seconds+1e-8>=action.release){
        action.released=true;a.lastCombat=this.seconds;
        if(target?.hp>0&&!(target===this.player&&this.hidden)&&this.clearVision(a,target,target)){action.aim={x:target.x,y:target.y};a.facing=face(a,target);}
        if(w.speed)this.releaseHumanShot(a,action,w);
        else if(target?.hp>0&&!(target===this.player&&this.hidden)&&dist(a,target)<=w.range&&this.clearLine(a,target,target)){
          if(target===this.player)this.damagePlayer(w.damage,a.kind==='bandit'?'bandit':'starving_civilian');
          else if(target.human)this.hurtHuman(target,w.damage,a.kind==='loyal_follower'?'loyal_follower':'human_npc',a.id);
          else this.damageZombie(target,w.damage,a.kind==='loyal_follower'?'loyal_follower':'human_npc',a.id);
        }
      }
      if(this.seconds>=action.until)a.action=null;
    },
    releaseHumanShot(a,action,w){
      const h=this.humans,f=face(a,action.aim),angles=w.pellets?[-12,-4,4,12]:[0],group=action.id;
      if(w.pellets)h.groups[group]={left:4,hits:{},owner:a.id,raidId:a.raidId};
      for(const degrees of angles){const angle=Math.atan2(f.y,f.x)+degrees*Math.PI/180;h.shots.push({id:'human-shot:'+ ++h.serial,group:w.pellets?group:null,x:a.x+f.x*.4,y:a.y+f.y*.4,vx:Math.cos(angle)*w.speed,vy:Math.sin(angle)*w.speed,speed:w.speed,range:w.range,damage:w.damage,owner:a.id,raidId:a.raidId,kind:w.pellets?'human_pellet':'human_bolt'});}
      this.sound?.(w.pellets?'gun':'bow',a);
    },
    updateHumanShots(dt){
      const h=this.humans;for(const shot of h.shots){
        if(shot.dead)continue;const travel=Math.min(shot.range,shot.speed*dt),from={x:shot.x,y:shot.y},to={x:shot.x+shot.vx/shot.speed*travel,y:shot.y+shot.vy/shot.speed*travel},targets=[this.player,...(h.follower?.hp>0&&!h.follower.pending&&h.follower.scene===this.humanScene()?[h.follower]:[]),...this.zombies.filter(z=>!z.human&&z.hp>0)];
        const hits=this.thermalCovers(from,to).map(o=>({o,t:this.thermalHitFraction(from,to,o),wall:true}));
        for(const o of targets){const t=S.boneCircleHit(from,to,o,o.radius||.24);if(Number.isFinite(t))hits.push({o,t});}hits.sort((a,b)=>a.t-b.t||Number(b.wall)-Number(a.wall));const hit=hits[0];
        if(hit){Object.assign(shot,{x:from.x+(to.x-from.x)*hit.t,y:from.y+(to.y-from.y)*hit.t});shot.dead=true;if(!hit.wall){const id=hit.o===this.player?'player':String(hit.o.id);if(shot.group){const g=h.groups[shot.group];if(g)g.hits[id]=(g.hits[id]||0)+shot.damage;}else this.applyHumanShot(hit.o,shot.damage,shot);}}
        else {Object.assign(shot,to);shot.range-=travel;if(shot.range<=1e-8)shot.dead=true;}
        if(shot.dead&&shot.group){const group=h.groups[shot.group];if(group&&--group.left===0){for(const [id,damage] of Object.entries(group.hits)){const target=id==='player'?this.player:this.find(id)||this.zombies.find(z=>String(z.id)===id);if(target?.hp>0)this.applyHumanShot(target,damage,shot);}delete h.groups[shot.group];}}
      }h.shots=h.shots.filter(s=>!s.dead);
    },
    updateHumanHazards(a,dt,fire=false){for(const [kind,damage] of [['acid_pool',1],...(fire?[['fire_pool',.5]]:[])]){const pool=this.zones.find(z=>z.kind===kind&&dist(z,a)<=z.radius&&this.clearLine(z,a)),key=kind+'Time';a[key]=pool?(a[key]||0)+dt:0;if(a[key]>=1){a[key]-=1;this.hurtHuman(a,damage,kind==='acid_pool'?'spitter':'molotov',pool?.actorId);}}},
    applyHumanShot(target,n,shot){if(target===this.player)this.damagePlayer(n,'bandit');else if(target.human)this.hurtHuman(target,n,'human_npc',shot.owner);else this.damageZombie(target,n,'human_npc',shot.owner);},
    summonHumanFollower(){const h=this.humans;if(!this.humanMode||!h?.unlocked||this.result||this.action)return false;if(h.follower?.hp>0){this.announce('随从仍存活，不能重复召唤。');return false;}if(h.cooldownUntil>this.seconds){this.announce('随从技能冷却中。');return false;}return this.beginAction('loyal_summon',.6);},
    updateAction(dt){
      const a=this.action;if(a?.type!=='loyal_summon'){if(a?.type==='camp_exchange'&&a.humanPriceKey){const q=this.campQuote(a.offer,a.batches,this.find(a.target));if(q.error||q.humanPriceKey!==a.humanPriceKey){this.cancelAction(q.error||'英雄状态或价格已变化，材料保留，请重新确认。');return;}}return Base.updateAction.call(this,dt);}
      if(dist(a.start,this.player)>.025){this.cancelAction('移动中断召唤。');return;}a.elapsed+=dt;if(a.elapsed+1e-8>=a.duration)this._humanSummonReady=a;
    },
    finishHumanSummon(){
      const a=this._humanSummonReady,h=this.humans;this._humanSummonReady=null;if(!a||this.action!==a||this.result||!h.unlocked||h.follower?.hp>0||h.cooldownUntil>this.seconds||dist(a.start,this.player)>.025)return;
      this.action=null;h.follower={id:'follower:'+ ++h.serial,human:true,type:'human',kind:'loyal_follower',faction:'player',hp:3,maxHP:3,w:.4,h:.4,weapon:'bare',nextAttack:this.seconds,path:[],rootUntil:0,lastCombat:-1e6,facing:{...this.player.facing},pending:true,scene:this.humanScene()};this.placeHumanFollower(1,2);this.autosaveRequested=true;this.sound?.('build');
    },
    transferHumanFollower(){const f=this.humans?.follower;if(!f||f.hp<=0)return;f.pending=true;f.scene=this.humanScene();f.action=null;f.path=[];this.placeHumanFollower(1,2);this.autosaveRequested=true;},
    placeHumanFollower(min=1,max=2){
      const f=this.humans?.follower;if(!f)return false;for(let i=0;i<32;i++){const angle=Math.atan2(-this.player.facing.y,-this.player.facing.x)+i*Math.PI/8,r=min+(max-min)*Math.floor(i/16),p={x:this.player.x+Math.cos(angle)*r,y:this.player.y+Math.sin(angle)*r};if(this.obstacles(p,p,.25).length||this.zombies.some(z=>z.hp>0&&dist(z,p)<.7)||this.humanActiveActors(false).some(a=>dist(a,p)<.7)||this.scene==='surface'&&this.armory?.worldIntegrated&&this.inArmory(p)!==this.inArmory())continue;Object.assign(f,p,{pending:false,scene:this.humanScene()});return true;}return false;
    },
    updateHumanFollower(dt){
      const f=this.humans.follower;if(!f||f.hp<=0)return;if(f.pending){this.placeHumanFollower(1,2);return;}if(f.scene!==this.humanScene()){this.transferHumanFollower();return;}
      this.updateHumanHazards(f,dt,true);if(f.hp<=0)return;
      if(f.action){this.updateHumanAttack(f);return;}
      const enemy=a=>a&&a.hp>0&&(a.human?(a.kind==='bandit'||a.hostile)&&!a.retreating:a.faction!=='player'&&!a.boneType&&!(a.kind==='lurker'&&a.state==='burrowed'));
      let target=this.find(f.targetId);if(!enemy(target)||dist(target,this.player)>12)target=null;
      if(!target)target=[...this.zombies.filter(z=>!z.human&&enemy(z)),...this.humanActiveActors(false).filter(enemy)].filter(a=>dist(a,this.player)<=10&&this.clearVision(f,a,a)).sort((a,b)=>dist(f,a)-dist(f,b))[0]||null;
      f.targetId=target?.id??null;
      if(target){f.idleSince=this.seconds;f.lastCombat=this.seconds;if(!this.startHumanAttack(f,target))this.moveHuman(f,target,3,dt);return;}
      if(dist(f,this.player)>1.5)this.moveHuman(f,this.player,3,dt);else f.idleSince=this.seconds;
      if(dist(f,this.player)>20&&this.seconds-(f.lastCombat||0)>=10&&this.seconds-(this._humanPlayerCombatAt||0)>=10)this.placeHumanFollower(2,3);
    }
  });
})();
