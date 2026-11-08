/* Population slots and theft commit records survive dawn, travel and restore. */
(() => {
  const P=HumansGame.prototype,S=Survival,D=S.Expansion,H=HumansData,{dist,pointRect}=S,copy=x=>JSON.parse(JSON.stringify(x));
  Object.assign(P,{
    newHuman(kind,p,weapon='bare',raidId=null){const h=this.humans,a={id:'human:'+ ++h.serial,human:true,type:'human',kind,...p,w:.4,h:.4,hp:kind==='starving_civilian'?2:3,maxHP:kind==='starving_civilian'?2:3,weapon,home:{x:p.x,y:p.y},raidId,hostile:kind==='bandit',faction:kind==='bandit'?'enemy':'neutral',carry:[],knowledge:[],eatLeft:0,nextAttack:this.seconds+1,path:[],repathAt:0,rootUntil:0,lastCombat:-1e6,facing:{x:0,y:1},aiDebt:0};h.actors.push(a);this.autosaveRequested=true;return a;},
    humanSpawnCandidate(kind){
      for(let i=0;i<8;i++){
        let p;if(kind==='starving_civilian'){const home=this.getHome(-6+Math.floor(this.random()*13),-6+Math.floor(this.random()*13));if(home.own||home.armoryReserved||!['house','food_shop'].includes(home.kind))continue;p={x:home.x+(this.random()-.5)*7,y:home.y-1-this.random()*4};}
        else {const angle=this.random()*Math.PI*2,r=36+this.random()*165;p={x:Math.cos(angle)*r,y:Math.sin(angle)*r};}
        const d=S.Camp.distanceFromTerritory({...p,w:.5,h:.5});if(d<30||d>(kind==='starving_civilian'?180:200)||dist(p,this.player)<25||this.inArmory(p)||this.camp?.position&&pointRect(p,this.camp.position)<2||this.obstacles(p,p,.3).length||this.humans.actors.some(a=>a.hp>0&&dist(a,p)<1))continue;
        if(kind==='bandit'&&!this.outdoors(p))continue;return p;
      }return null;
    },
    updateHumanPopulation(){
      const h=this.humans,plan=h.plans[this.day],minute=this.minutes;
      for(const [day,p] of Object.entries(h.plans))if(Number(day)<this.day)for(const s of [...p.starving,...p.bandits])if(['pending','spawning'].includes(s.state)){s.state='blocked';this.autosaveRequested=true;}
      for(const s of plan.starving)if(s.state==='pending'&&minute>=1320){s.state='blocked';this.autosaveRequested=true;}
      for(const s of plan.bandits)if(s.state==='pending'&&minute>=s.at){s.state=!s.roll?'failed':h.raid?.active?'raid-skipped':h.actors.filter(a=>a.kind==='bandit'&&!a.raidId&&a.hp>0).length>=6?'cap-skipped':'spawning';this.autosaveRequested=true;}
      const ready=[...plan.starving.filter(s=>s.state==='pending'&&minute>=s.at&&minute<1320).map(slot=>({slot,kind:'starving_civilian'})),...plan.bandits.filter(s=>s.state==='spawning').map(slot=>({slot,kind:'bandit'}))];
      const task=this._humanSpawnJob;
      if(task){if(task.day!==this.day||!['pending','spawning'].includes(task.slot.state)){this._humanSpawnJob=null;return;}this.advanceCampRoute(task.route,48);if(task.route.done){this._humanSpawnJob=null;const alive=task.slot.state==='spawning'||task.kind==='starving_civilian'&&task.slot.state==='pending';if(task.kind==='bandit'&&(h.raid?.active||h.actors.filter(a=>a.kind==='bandit'&&!a.raidId&&a.hp>0).length>=6)){task.slot.state=h.raid?.active?'raid-skipped':'cap-skipped';this.autosaveRequested=true;return;}if(task.route.path&&alive&&!this.obstacles(task.p,task.p,.3).length&&dist(task.p,this.player)>=25){const r=this.random(),weapon=r<.4?'bare':r<.75?'iron_axe':r<.95?'hand_crossbow':'shotgun';this.newHuman(task.kind,task.p,task.kind==='bandit'?weapon:'bare');task.slot.state='spawned';}else if(task.kind==='bandit')task.slot.state='blocked';this.autosaveRequested=true;}return;}
      const work=ready.find(t=>this.seconds>=(t.slot.retryAt||0));if(!work)return;const p=this.humanSpawnCandidate(work.kind);
      if(!p){if(work.kind==='bandit')work.slot.state='blocked';else work.slot.retryAt=this.seconds+2;this.autosaveRequested=true;return;}
      this._humanSpawnJob={...work,day:this.day,p,route:this.makeCampRoute({x:0,y:5},[p],false)};work.slot.retryAt=this.seconds+2;
    },
    moveHuman(a,goal,speed,dt){
      if(a.rootUntil>this.seconds)return false;
      if(this.seconds>=(a.repathAt||0)&&this.pathBudget>0&&this.requestPath(a,goal)){a.repathAt=this.seconds+1.5;this.pathBudget--;}
      a.path=a.path||[];while(a.path.length&&dist(a,a.path[0])<.2)a.path.shift();const to=a.path[0]||goal,n=dist(a,to);if(n<.05)return true;
      const amount=Math.min(n,this.movementSpeed(speed,a)*dt),f={x:(to.x-a.x)/n,y:(to.y-a.y)/n},next={x:a.x+f.x*amount,y:a.y+f.y*amount};a.facing=f;
      if(a.kind==='home_helper'&&(Math.abs(next.x)>5||next.y< -6||next.y>4)||this.obstacles(a,next,.22).length){a.repathAt=Math.min(a.repathAt,this.seconds+.2);return false;}
      Object.assign(a,next);a.visualDistance=(a.visualDistance||0)+amount;a.visualMoveAt=this.seconds;return true;
    },
    humanContainerContents(o){
      if(!o||o.hp<=0||o.resourceDisabled)return [];
      if(o.kind==='storage_chest')return (o.storage||[]).filter(s=>s&&s.amount>0&&!['fuse','armory_west_keycard'].includes(s.kind)).map(copy);
      if(o.searched||!['misc','kitchen','supply','freezer'].includes(o.kind)||o.loot?.fuse)return [];
      return Object.entries(o.loot||{}).filter(([k,n])=>n>0&&k!=='fuse').map(([kind,amount])=>({kind,amount}));
    },
    humanContainers(a){
      const occupied=new Set(this.humans.actors.filter(o=>o!==a&&o.hp>0&&o.search).map(o=>o.search.id));
      return [...this.nearbyHomes(a,21).flatMap(h=>h.armoryReserved?[]:h.sites),...this.devices.filter(o=>o.kind==='storage_chest')].filter(o=>dist(o,a)<=20&&!occupied.has(o.id)&&this.humanContainerContents(o).length).sort((x,y)=>dist(a,x)-dist(a,y)||String(x.id).localeCompare(String(y.id)));
    },
    humanContainerPoint(a,o){
      const key=o.id+':'+Math.round(o.x)+','+Math.round(o.y);if(a.searchPoint?.key===key&&!this.obstacles(a.searchPoint,a.searchPoint,.25).length)return a.searchPoint;
      for(let i=0;i<16;i++){const angle=i*Math.PI/8,p={x:o.x+Math.cos(angle)*.95,y:o.y+Math.sin(angle)*.95};if(!this.obstacles(p,p,.24).length&&this.clearLine(p,o,o))return a.searchPoint={...p,key};}return null;
    },
    commitHumanTheft(a,o){
      const contents=this.humanContainerContents(o);if(!contents.length||pointRect(a,o)>1||!this.clearLine(a,o,o)||this.humans.actors.some(other=>other!==a&&other.hp>0&&other.search?.id===o.id&&String(other.id)<String(a.id)))return false;
      if(o.kind==='storage_chest'){o.storage=o.storage.map(s=>s&&!['fuse','armory_west_keycard'].includes(s.kind)?null:s);o.opened=true;}
      else {o.loot={};o.searched=true;o.opened=true;}
      a.carry.push(...contents);if(o.blueprintId&&!o.blueprintLearned&&!this.knowledge[o.blueprintId]){a.knowledge.push(o.blueprintId);o.blueprintLearned=true;}if(o.aedBlueprintFound&&!o.aedBlueprintChecked&&!this.knowledge.blueprint_emergency_aed)a.knowledge.push('blueprint_emergency_aed');o.aedBlueprintChecked=true;
      a.eatLeft=100;a.eating=null;for(const kind of H.foodOrder){const food=a.carry.find(s=>s.kind===kind&&s.amount>0);if(food){a.eating={...copy(food),amount:1};food.amount--;a.carry=a.carry.filter(s=>s.amount>0);break;}}
      a.search=null;a.containerId=null;a.path=[];this.autosaveRequested=true;return true;
    },
    humanShelter(a){
      if(a.shelter&&!this.obstacles(a.shelter,a.shelter,.25).length)return a.shelter;
      const homes=this.nearbyHomes(a,90).filter(h=>!h.armoryReserved&&h.kind==='house').sort((x,y)=>dist(a,x)-dist(a,y));
      for(const home of homes)for(const [dx,dy] of [[0,-2],[2,-2],[-2,-2],[0,-4]]){const p={x:home.x+dx,y:home.y+dy};if(!this.obstacles(p,p,.25).length)return a.shelter=p;}return a.home;
    },
    humanCombatTarget(a){
      const targets=[];const f=this.humans.follower;
      if(a.kind==='bandit'||a.hostile){if(!this.hidden&&this.player.hp>0)targets.push(this.player);if(f?.hp>0&&!f.pending&&f.scene===this.humanScene())targets.push(f);}
      const defending=this.zombies.find(z=>!z.human&&z.id===a.defendId&&z.hp>0);if(defending&&(this.seconds-(a.defendAt||0)<=5||dist(a,defending)<=10))targets.push(defending);else a.defendId=null;
      const visible=targets.filter(t=>dist(a,t)<=16&&this.clearVision(a,t,t)).sort((x,y)=>dist(a,x)-dist(a,y)||String(x.id||'player').localeCompare(String(y.id||'player'))),old=a.targetId==='player'?this.player:this.find(a.targetId);
      if(visible.length){const target=visible[0];a.targetId=target===this.player?'player':target.id;a.lastSeen={x:target.x,y:target.y};a.lostAt=null;return target;}
      if(old?.hp>0&&a.kind==='bandit'){a.lostAt=a.lostAt??this.seconds;if(!(dist(a,old)>24&&this.seconds-a.lostAt>=5))return {x:a.lastSeen?.x??old.x,y:a.lastSeen?.y??old.y,hp:0};}
      a.targetId=null;return null;
    },
    updateHumanActors(dt){
      const h=this.humans,night=this.minutes>=1320||this.minutes<300;let budget=8;
      for(const a of h.actors){if(a.hp<=0)continue;this.updateHumanHazards(a,dt);if(a.eatLeft>0){a.eatLeft=Math.max(0,a.eatLeft-(this._humanGameMinutes||0));if(a.eatLeft===0)a.eating=null;}a.aiDebt=(a.aiDebt||0)+dt;}
      const start=(this._humanAICursor||0)%Math.max(1,h.actors.length);
      for(let i=0;i<h.actors.length&&budget>0;i++){
        const a=h.actors[(start+i)%h.actors.length];if(a.hp<=0||a.retreating||dist(a,this.player)>45&&a.aiDebt<.5)continue;budget--;const elapsed=Math.min(.5,a.aiDebt);a.aiDebt-=elapsed;
        if(a.action){this.updateHumanAttack(a);continue;}
        const enemy=this.humanCombatTarget(a);if(enemy){a.search=null;if(enemy.hp>0&&this.startHumanAttack(a,enemy))continue;this.moveHuman(a,enemy,a.kind==='starving_civilian'?2:1,elapsed);continue;}
        if(a.kind==='starving_civilian'){
          if(night){a.search=null;a.containerId=null;this.moveHuman(a,this.humanShelter(a),2,elapsed);continue;}
          a.shelter=null;if(a.eatLeft>0){if(a.eating&&dist(a,this.player)<45)a.visualEating=true;continue;}a.visualEating=false;
          let o=a.containerId&&this.find(a.containerId);if(!o||!this.humanContainerContents(o).length){a.search=null;a.containerId=null;const choices=this.humanContainers(a);o=choices[0];if(o)a.containerId=o.id;}
          if(o){if(h.actors.some(other=>other!==a&&other.hp>0&&other.search?.id===o.id)){a.containerId=null;a.search=null;continue;}const p=this.humanContainerPoint(a,o);if(p){if(pointRect(a,o)<=1&&this.clearLine(a,o,o)){a.search=a.search||{id:o.id,elapsed:0};a.search.elapsed+=elapsed;if(a.search.elapsed+1e-8>=3)this.commitHumanTheft(a,o);}else{a.search=null;this.moveHuman(a,p,2,elapsed);}continue;}a.containerId=null;}
        }
        if(a.raidId&&h.raid?.active){const goal=!this.hidden&&this.player.hp>0?this.player:this.camp.position;this.moveHuman(a,goal,1,elapsed);continue;}
        if(!a.wander||this.seconds>=a.wander.until){const angle=this.random()*Math.PI*2,r=this.random()*10;a.wander={x:a.home.x+Math.cos(angle)*r,y:a.home.y+Math.sin(angle)*r,until:this.seconds+4+this.random()*4};}this.moveHuman(a,a.wander,a.kind==='starving_civilian'?2:1,elapsed);
      }
      this._humanAICursor=(start+8)%Math.max(1,h.actors.length);
    },
    updateHelperGuard(dt){
      const helper=this.visitors.find(v=>v.recruited);if(!helper||!this.helper)return;helper.human=true;helper.kind='home_helper';helper.path=helper.path||[];helper.repathAt=helper.repathAt||0;helper.hp=helper.hp||1;
      const inside=p=>Math.abs(p.x)<=5&&p.y>=-6&&p.y<=4,target=this.humans.actors.filter(a=>a.hp>0&&a.kind==='starving_civilian'&&inside(a)).sort((a,b)=>dist(a,helper)-dist(b,helper))[0];
      if(helper.humanAction){const a=helper.humanAction;if(!a.released&&this.seconds>=a.release){a.released=true;const t=this.find(a.target);if(t&&inside(t)&&dist(helper,t)<=1.3&&this.clearLine(helper,t,t))this.hurtHuman(t,2,'player');}if(this.seconds>=a.until)helper.humanAction=null;return;}if(!target)return;
      if(dist(helper,target)<=1.3&&this.clearLine(helper,target,target)){if(this.seconds>=(helper.guardAt||0)){helper.guardAt=this.seconds+2;helper.facing={x:target.x-helper.x,y:target.y-helper.y};helper.humanAction={target:target.id,started:this.seconds,release:this.seconds+.4,until:this.seconds+.8,released:false};}return;}
      this.moveHuman(helper,target,2,dt);
    }
  });
})();
