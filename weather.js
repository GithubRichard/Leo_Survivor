/* Surface-only weather and continuous crop growth; no wall-clock catch-up. */
(function(root){
  'use strict';const S=root.Survival,Base=S.Game,D=S.Expansion;
  const TYPES={sunny:{name:'晴天',speed:1.1,growth:1.25,weight:30},overcast:{name:'阴天',speed:1.05,growth:1,weight:25},rain:{name:'雨天',speed:.9,growth:1.5,weight:25},fog:{name:'大雾',speed:1,growth:1,weight:12},thunderstorm:{name:'雷暴雨',speed:.9,growth:1.5,weight:6},tornado:{name:'龙卷风',speed:1,growth:1,weight:2}};
  const tornadoIntervals={
    easy:{first:[12,20],repeat:[35,48]},
    normal:{first:[10,18],repeat:[30,42]},
    hard:{first:[5,9],repeat:[13,22]},
    apocalypse:{first:[3,6],repeat:[7,13]}
  };
  const DUST={name:'沙尘暴',speed:.75,growth:1,hunger:1.5,probability:.05,dehydration:15,minDuration:20,maxDuration:70,mapScale:.3};
  class WeatherGame extends Base{
    tornadoDelay(phase){
      const [min,max]=tornadoIntervals[this.difficulty][phase];
      return min+this.weatherRandom()*(max-min);
    }
    constructor(options={}){super(options);this.weather=this.makeWeather(true);}
    weatherRandom(){const w=this.weather;w.seed=(Math.imul(w.seed,1664525)+1013904223)>>>0;return w.seed/4294967296;}
    makeWeather(first=false){const w={seed:Math.floor(this.random()*4294967296)>>>0,day:this.day,schedule:[],index:0,elapsed:0,serial:0,hazards:[],flash:[],notified:-1,nextStrike:0,nextTornado:0};const old=this.weather;this.weather=w;w.schedule=this.weatherSchedule(first?'sunny':null,first,null);let hour=((this.minutes-300+1440)%1440)/60;while(w.index<w.schedule.length-1&&hour>=w.schedule[w.index].hours){hour-=w.schedule[w.index++].hours;}w.elapsed=hour*45;w.nextStrike=8+this.weatherRandom()*6;w.nextTornado=this.tornadoDelay('first');this.weather=old;return w;}
    weatherSchedule(previous,first,old,attempt=0){
      if(this.difficulty!=='normal')return this.difficultyWeatherSchedule(previous,first);
      const rand=()=>this.weatherRandom(),count=4+Math.floor(rand()*5),schedule=[];let hours=24,bad=false,last=previous;
      for(let i=0;i<count;i++){
        const left=count-i-1,min=Math.max(2,hours-left*7),max=Math.min(7,hours-left*2),duration=first&&i===0?3:min+Math.floor(rand()*(max-min+1));
        const choices=Object.entries(TYPES).filter(([k])=>k!==last&&(!bad||!['thunderstorm','tornado'].includes(k)));let kind='sunny';
        if(!(first&&i===0)){let roll=rand()*choices.reduce((n,[,v])=>n+v.weight,0);kind=choices.at(-1)[0];for(const [k,v] of choices){roll-=v.weight;if(roll<0){kind=k;break;}}}
        schedule.push({kind,hours:duration});hours-=duration;last=kind;if(['thunderstorm','tornado'].includes(kind))bad=true;
      }
      if(old&&JSON.stringify(schedule)===JSON.stringify(old)){if(attempt<4)return this.weatherSchedule(previous,false,old,attempt+1);schedule[0].kind=['sunny','overcast','rain','fog'].find(k=>k!==schedule[0].kind&&k!==previous&&k!==schedule[1]?.kind);}return schedule;
    }
    difficultyWeatherSchedule(previous,first){
      const p=this.difficultyRules,kinds=Object.keys(TYPES),bad=k=>!['sunny','overcast'].includes(k),hazard=k=>['thunderstorm','tornado'].includes(k),memo=new Map();
      const options=(slots,hours,last,used,opening)=>{
        const out=[];for(const k of kinds){if(opening?k!=='sunny':k===last)continue;if(hazard(k)&&used>=p.hazards)continue;
          const [min,max]=opening?[3,3]:bad(k)?p.badHours:[2,7];
          for(let n=min;n<=max;n++){if(n>hours)break;if(feasible(slots-1,hours-n,k,used+(hazard(k)?1:0),false))out.push({kind:k,hours:n});}
        }return out;
      };
      const feasible=(slots,hours,last,used,opening)=>{
        if(!slots)return hours===0;if(hours<slots*2||hours>slots*10)return false;
        const key=[slots,hours,last,used,opening].join(':');if(memo.has(key))return memo.get(key);memo.set(key,false);
        const ok=options(slots,hours,last,used,opening).length>0;memo.set(key,ok);return ok;
      };
      const counts=[4,5,6,7,8].filter(n=>feasible(n,24,previous,0,first));
      let slots=counts[Math.floor(this.weatherRandom()*counts.length)],hours=24,last=previous,used=0;const schedule=[];
      while(slots){const list=options(slots,hours,last,used,first&&schedule.length===0),available=kinds.filter(k=>list.some(o=>o.kind===k));let roll=this.weatherRandom()*available.reduce((n,k)=>n+p.weather[kinds.indexOf(k)],0),kind=available.at(-1);
        for(const k of available){roll-=p.weather[kinds.indexOf(k)];if(roll<0){kind=k;break;}}
        const durations=list.filter(o=>o.kind===kind),o=durations[Math.floor(this.weatherRandom()*durations.length)];schedule.push(o);hours-=o.hours;last=o.kind;used+=hazard(last)?1:0;slots--;
      }return schedule;
    }
    get dustStorm(){return this.scene==='surface'&&['hard','apocalypse'].includes(this.difficulty)?this.weather?.dustStorm??null:null;}
    get dustCurtain(){
      const storm=this.dustStorm;if(!storm)return 0;
      const t=Math.max(0,Math.min(1,((storm.age??4)-.85)/3.15));
      return t*t*(3-2*t);
    }
    canSelectWeather(kind){return Object.hasOwn(TYPES,kind)||kind==='duststorm'&&['hard','apocalypse'].includes(this.difficulty);}
    setDeveloperWeather(kind){
      if(!this.developer?.enabled||!this.developerUsed||this.scene!=='surface'||!this.canSelectWeather(kind))return false;
      const w=this.weather;
      if(kind==='duststorm'){
        w.dustPlan={day:this.day,at:null,done:true};
        this.startDustStorm();
      }else{
        w.dustStorm=null;
        w.schedule[w.index].kind=kind;
        w.notified=-1;
        this.resetWeatherHazards();
        this.announce(`开发测试：天气已切换为${TYPES[kind].name}。`);
        this.autosaveRequested=true;
      }
      return true;
    }
    get weatherHungerMultiplier(){return this.dustStorm?DUST.hunger:1;}
    weatherType(){return this.dustStorm?DUST:TYPES[this.weather?.schedule[this.weather.index]?.kind]||TYPES.sunny;}
    weatherKind(){return this.dustStorm?'duststorm':this.weather?.schedule[this.weather.index]?.kind||'sunny';}
    foodReadyAt(kind){return kind==='clean_water'&&this.dustStorm?0:super.foodReadyAt(kind);}
    completeFood(kind){
      const storm=kind==='clean_water'&&this.dustStorm,water=storm?this.count(kind):0;
      super.completeFood(kind);
      if(storm&&this.count(kind)<water){storm.waterLeft=DUST.dehydration;storm.waterResetAt=this.seconds;this.autosaveRequested=true;}
    }
    startDustStorm(){
      this.weather.dustStorm={remaining:DUST.minDuration+Math.floor(this.weatherRandom()*(DUST.maxDuration-DUST.minDuration+1)),waterLeft:DUST.dehydration,age:0};
      this.resetWeatherHazards();this.announce('沙尘暴来袭！失水：15秒内喝一瓶清水。');this.autosaveRequested=true;
    }
    updateDustStorm(dt){
      if(!['hard','apocalypse'].includes(this.difficulty))return;
      const w=this.weather;
      if(w.dustStorm){
        const storm=w.dustStorm,elapsed=Math.min(dt,storm.remaining);
        storm.age=Math.min(4,(storm.age??4)+elapsed);
        if(storm.waterResetAt!==this.seconds){
          if(storm.waterLeft<=elapsed+1e-8&&storm.waterLeft<storm.remaining-1e-8){
            this.stats.damage.dehydration=(this.stats.damage.dehydration||0)+this.player.hp;
            this.player.hp=0;this.checkPlayerDeath('dehydration');return;
          }
          storm.waterLeft=Math.max(0,storm.waterLeft-elapsed);
        }
        storm.remaining=Math.max(0,storm.remaining-dt);
        if(storm.remaining<=1e-8){w.dustStorm=null;this.announce('沙尘暴结束，失水状态解除。');this.autosaveRequested=true;}
        return;
      }
      if(w.dustPlan?.day!==this.day){
        const at=this.weatherRandom()<DUST.probability?480+Math.floor(this.weatherRandom()*781):null;
        w.dustPlan={day:this.day,at,done:at===null||at<this.minutes};this.autosaveRequested=true;
      }
      const plan=w.dustPlan;
      if(plan.done||this.minutes+this.clockMinutes(dt)<plan.at)return;
      plan.done=true;this.startDustStorm();
    }
    outdoors(p){
      if(this.scene!=='surface')return false;
      const h=this.getHome(Math.round(p.x/S.RULES.lotSpacing),Math.round(p.y/S.RULES.lotSpacing));
      return !(Math.abs(p.x-h.x)<5&&p.y>h.y-6&&p.y<h.y);
    }
    weatherSafe(p){
      if(!this.outdoors(p))return true;const e=this.parking?.entrance;if(!e)return false;
      return S.pointRect(p,e.axis==='x'?{x:e.x-3,y:e.y,w:6.8,h:5.8}:{x:e.x,y:e.y-3,w:5.8,h:6.8})<.5;
    }
    movementSpeed(base,p=this.player){let speed=p!==this.player&&p.kind&&!p.boneType?this.enemySpeed(p.kind,base):base;if(this.dustStorm){if(p===this.player)speed*=DUST.speed;}else if(this.outdoors(p))speed*=this.weatherType().speed;if(p===this.player&&this.boneSkill?.charging)speed*=.5;return Math.max(.5,speed);}
    fogVisibility(p){
      if(this.scene!=='surface'||this.weatherKind()!=='fog')return 1;
      const sight=this.traitEffects.sight,distance=S.dist(p,this.player);
      if(distance>=14*sight)return 0;
      const limit=(this.isLit(p)?14:10)*sight;
      return Math.max(0,Math.min(1,(limit-distance)/(limit*.35)));
    }
    get personalSight(){const original=super.personalSight;return this.dustStorm||this.scene==='surface'&&this.weatherKind()==='fog'?Math.min(original/this.traitEffects.sight,10)*this.traitEffects.sight:original;}
    get illuminatedSight(){return this.dustStorm||this.scene==='surface'&&this.weatherKind()==='fog'?14*this.traitEffects.sight:super.illuminatedSight;}
    canSee(p){if(this.scene==='surface'&&this.weatherKind()==='fog')return this.fogVisibility(p)>0&&this.clearVision(this.player,p,p);return super.canSee(p);}
    weatherPoint(min,max,radius){
      for(let i=0;i<32;i++){const a=this.weatherRandom()*Math.PI*2,r=min+this.weatherRandom()*(max-min),p={x:this.player.x+Math.cos(a)*r,y:this.player.y+Math.sin(a)*r};if(!this.weatherSafe(p)&&!this.obstacles(p,p,radius).length)return p;}return null;
    }
    resetWeatherHazards(){const w=this.weather;for(const h of w.hazards)if(h.type==='tornado'&&h.warning<=0)w.flash.push({...h,type:'tornado_end',life:.45});w.hazards=[];w.nextStrike=8+this.weatherRandom()*6;w.nextTornado=this.tornadoDelay('first');}
    advanceWeather(dt){
      if(this.scene!=='surface')return;const w=this.weather;
      this.updateDustStorm(dt);if(this.result)return;
      if(w.day!==this.day){const old=w.schedule;w.schedule=w.nextSchedule||this.weatherSchedule(old.at(-1).kind,false,old);w.nextSchedule=null;w.day=this.day;w.index=0;w.elapsed=Math.max(0,(this.minutes-300)*.75);w.notified=-1;this.resetWeatherHazards();}
      w.elapsed+=this.clockMinutes(dt)*.75;
      while(w.elapsed>=w.schedule[w.index].hours*45){if(w.index===w.schedule.length-1)break;w.elapsed-=w.schedule[w.index].hours*45;w.index++;this.resetWeatherHazards();if(!this.dustStorm)this.announce(`天气转为${this.weatherType().name}。`);}
      const remaining=w.schedule[w.index].hours*45-w.elapsed;if(remaining<=22.5&&w.index===w.schedule.length-1&&!w.nextSchedule)w.nextSchedule=this.weatherSchedule(w.schedule.at(-1).kind,false,w.schedule);
      const next=w.schedule[w.index+1]||w.nextSchedule?.[0];if(!this.dustStorm&&remaining<=22.5&&next&&w.notified!==w.index){w.notified=w.index;this.announce(`30游戏分钟后：${TYPES[next.kind].name}${['thunderstorm','tornado'].includes(next.kind)?'，请留意地面预警并进屋避险':''}。`);}
      const kind=this.weatherKind();
      if(kind==='thunderstorm'){w.nextStrike-=dt;if(w.nextStrike<=0){w.nextStrike=8+this.weatherRandom()*6;const p=this.weatherPoint(0,20,1.1);if(p){w.hazards.push({...p,id:`weather:${++w.serial}`,type:'lightning',remaining:1.2,radius:1.1});this.parkingCue('附近即将落雷，避开地面提示圈！');}}}
      if(kind==='tornado'&&!w.hazards.some(h=>h.type==='tornado')){w.nextTornado-=dt;if(w.nextTornado<=0){const p=this.weatherPoint(12,20,1.2);w.nextTornado=this.tornadoDelay('repeat');if(p){const a=this.weatherRandom()*Math.PI*2;w.hazards.push({...p,id:`weather:${++w.serial}`,type:'tornado',warning:3,life:15,radius:1.2,vx:Math.cos(a)*1.6,vy:Math.sin(a)*1.6,hits:[]});this.parkingCue('旋风正在形成，避开预警与风柱路线！');}}}
      for(const h of w.hazards){
        if(h.type==='lightning'){
          h.remaining-=dt;if(h.remaining>0)continue;
          if(S.dist(h,this.player)<=h.radius&&!this.weatherSafe(this.player))this.damagePlayer(3,'lightning');
          for(const z of this.zombies)if(z.hp>0&&S.dist(z,h)<=h.radius&&this.outdoors(z))this.damageZombie(z,3,'weather');
          for(const o of this.devices)if(o.hp>0&&!o.indestructible&&S.dist(o,h)<=h.radius&&this.outdoors(o))this.damageBuilding(o,4);
          for(const home of this.nearbyHomes(h,4))for(const o of home.objects)if(o.hp>0&&Number.isFinite(o.hp)&&!o.indestructible&&S.pointRect(h,o)<=h.radius&&this.outdoors(o))this.damageBuilding(o,4);
          w.flash.push({...h,life:.35});h.dead=true;
        }else{
          if(h.warning>0){h.warning-=dt;continue;}h.life-=dt;if(h.life<=0){w.flash.push({...h,type:'tornado_end',life:.45});h.dead=true;w.nextTornado=this.tornadoDelay('repeat');continue;}
          const p={x:h.x+h.vx*dt,y:h.y+h.vy*dt};
          if(this.weatherSafe(p)||this.obstacles(h,p,h.radius).length){w.flash.push({...h,type:'tornado_end',life:.45});h.dead=true;w.nextTornado=this.tornadoDelay('repeat');continue;}Object.assign(h,p);
          if(!h.hits.includes('player')&&!this.weatherSafe(this.player)&&S.dist(h,this.player)<=h.radius&&this.damagePlayer(2,'tornado')){
            h.hits.push('player');const slots=this.inventory.map((s,i)=>s?i:-1).filter(i=>i>=0);if(slots.length){const i=slots[Math.floor(this.weatherRandom()*slots.length)],s=this.inventory[i];this.inventory[i]=null;
              if(s.lampId){if(this.heldLightId===s.lampId)this.heldLightId=null;if(this.headLightId===s.lampId)this.headLightId=null;s.active=false;this._lights=null;}
              if(!this.count(this.player.weapon))this.player.weapon='fists';this.recordResource('spent',{[s.kind]:s.amount});this.announce(`龙卷风卷走${S.NAMES[s.kind]||s.kind} × ${s.amount}。`);
            }this.autosaveRequested=true;
          }
          for(const z of this.zombies)if(z.hp>0&&!h.hits.includes(z.id)&&this.outdoors(z)&&S.dist(z,h)<=h.radius){h.hits.push(z.id);this.damageZombie(z,2,'weather');}
        }
      }
      w.hazards=w.hazards.filter(h=>!h.dead);for(const f of w.flash)f.life-=dt;w.flash=w.flash.filter(f=>f.life>0);
    }
    updateProduction(dt){super.updateProduction(dt);if(this.scene==='parking')return;for(const o of this.devices)if(o.hp>0&&o.crop){const c=o.crop;if(!Number.isFinite(c.growth))c.growth=Math.min(48,(c.dawns||0)*24);c.growth=Math.min(48,c.growth+this.clockMinutes(dt)/60*(this.outdoors(o)?this.weatherType().growth:1));}}
    plant(o,kind){const ok=super.plant(o,kind);if(ok)o.crop={kind,growth:0};return ok;}
    harvest(o){if(!o.crop||(o.crop.growth??(o.crop.dawns||0)*24)<48)return false;if(this.pay({}, {[o.crop.kind]:3})){o.crop=null;return true;}return false;}
    advanceClock(dt){this.advanceWeather(dt);if(!this.result)super.advanceClock(dt);}
    snapshot(){const data=super.snapshot();data.weather=this.weather;return data;}
    static restore(data){
      const game=Base.restore(data);Object.setPrototypeOf(game,WeatherGame.prototype);
      const w=game.weather=data.weather||game.makeWeather(false);
      w.nextTornado=Number.isFinite(w.nextTornado)?Math.min(w.nextTornado,tornadoIntervals[game.difficulty].repeat[1]):game.tornadoDelay('first');
      for(const h of w.hazards)if(h.type==='lightning')h.remaining=1.2;
      return game;
    }
    switchScene(){const from=this.scene;super.switchScene();if(from==='parking'&&this.scene==='surface')for(const h of this.weather.hazards)if(h.type==='lightning')h.remaining=1.2;}
  }
  S.Game=WeatherGame;S.Weather={...TYPES,duststorm:DUST};S.TornadoIntervals=tornadoIntervals;
})(globalThis);
