/* Seven surface days replenish residents; skeleton remnants keep their own clock. */
(function(root){
  'use strict';const S=root.Survival,Base=S.Game,D=S.Expansion,P=S.Parking,{dist,segmentHits}=S;
  const cycle=(day,period=7)=>Math.floor((day-1)/period);
  class ResidentRefreshGame extends Base{
    constructor(options={}){super(options);this.residentRefreshCycle=cycle(this.day,this.difficultyRules.residents);}
    surfaceResidents(){return this.scene==='parking'?this.surfaceState:this;}
    ensureResidentRoster(){
      const a=this.armory,host=this.surfaceResidents();if(!a?.worldIntegrated||a.residentRoster||!host)return;
      const roster=[];let serial=0;
      // Reconstruct only missing roster metadata in old saves, never the live population.
      for(const [kind,count] of Object.entries(root.ARMORY_ART.layout.initialNormalEnemies)){
        if(!D.enemies[kind]||!Number.isInteger(count))continue;
        for(let i=0;i<count;i++){
          const id=100000+serial++,persistentId=`armory:enemy:${kind}:${i}`,z=host.zombies.find(z=>z.persistentId===persistentId||z.id===id);
          roster.push({id,persistentId,kind,x:z?.x??a.origin.x+15+(serial%10)*17,y:z?.y??a.origin.y+15+Math.floor(serial/10)*20});
        }
      }
      const boss=host.zombies.find(z=>z.kind==='sweeper')||a.boss,home=boss?.home||{x:a.origin.x+150,y:a.origin.y+67};
      roster.push({id:'armory:sweeper',kind:'sweeper',...home,home:{...home}});a.residentRoster=roster;this.autosaveRequested=true;
    }
    queueResidentRefresh(){
      this.ensureResidentRoster();const a=this.armory,host=this.surfaceResidents();
      if(a?.worldIntegrated&&host){
        const alive=new Set(host.zombies.filter(z=>z.hp>0).map(z=>z.id));
        a.residentPending=(a.residentPending||[]).filter(z=>!alive.has(z.id));
        const queued=new Set(a.residentPending.map(z=>z.id));
        for(const z of a.residentRoster)if(!alive.has(z.id)&&!queued.has(z.id))a.residentPending.push({...z,refreshCycle:this.residentRefreshCycle,home:z.home?{...z.home}:undefined});
      }
      const p=this.parking;
      if(p?.initialized&&p.layer){
        // Surface time is paused underground; dawn therefore operates on parked floor states.
        const floors=[{number:p.floor||1,meta:p,state:p.state,layer:p.layer}];
        for(const [n,f] of Object.entries(p.floors||{}))if(Number(n)!==(p.floor||1))floors.push({number:Number(n),meta:f,state:f.state,layer:f.layer});
        for(const f of floors){
          if(f.number!==1||!f.meta.initialized||!f.state)continue;
          const pending=f.meta.initialPending||(f.meta.initialPending=[]),alive=f.state.zombies.filter(z=>z.hp>0);
          const counts={};for(const kind of P.initial)counts[kind]=(counts[kind]||0)+1;
          for(const [kind,count] of Object.entries(counts)){
            const existing=alive.filter(z=>z.kind===kind&&z.source==='initial').length+pending.filter(z=>z.kind===kind).length;
            for(let i=existing;i<count;i++)pending.push({kind,region:[7,57],weekly:true,refreshCycle:this.residentRefreshCycle});
          }
          if(!alive.some(z=>z.kind==='lurker')&&!pending.some(z=>z.kind==='lurker'))pending.push({kind:'lurker',region:[44,54],weekly:true,refreshCycle:this.residentRefreshCycle});
        }
      }
      this.autosaveRequested=true;
      this.announce(`每${this.difficultyRules.residents}天驻守补充：阵亡驻守与Boss进入待补队列，骷髅遗骨独立计时。`);
    }
    refillArmoryResidents(){
      const a=this.armory,host=this.surfaceResidents();if(!a?.worldIntegrated||!a.residentPending?.length||!host)return;
      const player=this.scene==='parking'?host.position:this.player;
      const blockers=[...a.objects.filter(o=>o.hp>0&&!o.passable&&!(o.kind==='door'&&o.open)),...host.devices.filter(o=>o.hp>0&&this.blocking(o))];
      const attempts=Math.min(2,a.residentPending.length);
      for(let i=0;i<attempts;i++){
        const template=a.residentPending.shift();if(host.zombies.some(z=>z.id===template.id&&z.hp>0))continue;
        let spot=null;const center={x:Math.max(a.bounds.x-a.bounds.w/2+2,Math.min(a.bounds.x+a.bounds.w/2-2,template.x)),y:Math.max(a.bounds.y-a.bounds.h/2+2,Math.min(a.bounds.y+a.bounds.h/2-2,template.y))};
        for(let n=0;n<100;n++){
          const r=n?Math.ceil(n/12):0,angle=n*Math.PI/6,q={x:center.x+Math.cos(angle)*r,y:center.y+Math.sin(angle)*r};
          if(Math.abs(q.x-a.bounds.x)>a.bounds.w/2-1||Math.abs(q.y-a.bounds.y)>a.bounds.h/2-1)continue;
          if(dist(q,player)<12||blockers.some(o=>segmentHits(q,q,o,.45))||host.zombies.some(z=>z.hp>0&&dist(q,z)<1.2))continue;
          spot=q;break;
        }
        if(!spot){a.residentPending.push(template);continue;}
        const now=host.seconds,def=D.enemies[template.kind];
        const z=template.kind==='sweeper'?{...this.makeSweeper(),...spot,home:{...(template.home||spot)}}:{...spot,id:template.id,persistentId:template.persistentId,kind:template.kind,hp:this.enemyHP(template.kind,def.hp),maxHP:this.enemyHP(template.kind,def.hp),nextAttack:now+1,rootUntil:0,boostUntil:0,slowUntil:0,path:[],repathAt:now,rangedAt:now+1,screamAt:now+3};
        z.refreshCycle=template.refreshCycle;host.zombies=host.zombies.filter(old=>old.id!==z.id);host.zombies.push(z);
        if(z.kind==='sweeper'){z.nextAttack=now+1;a.boss=z;a.bossDead=false;}
        a.deadIds=a.deadIds.filter(id=>id!==z.id);this.autosaveRequested=true;
      }
    }
    dawn(){super.dawn();this.advanceResidentCycle();}
    shiftPersonalClock(delta){super.shiftPersonalClock(delta);if(Number.isFinite(this._residentRefillAt))this._residentRefillAt+=delta;}
    advanceResidentCycle(){const current=cycle(this.day,this.difficultyRules.residents);if(current>(this.residentRefreshCycle??current)){this.residentRefreshCycle=current;this.queueResidentRefresh();}}
    step(dt,input={}){super.step(dt,input);if(this.result||dt<=0||this.parkingUnlockPending)return;this.advanceResidentCycle();this.ensureResidentRoster();if(this.seconds>=(this._residentRefillAt||0)){this._residentRefillAt=this.seconds+1;this.refillArmoryResidents();}}
    snapshot(){const d=super.snapshot();d.residentRefreshCycle=this.residentRefreshCycle;return d;}
    static restore(d){const g=Base.restore(d);Object.setPrototypeOf(g,ResidentRefreshGame.prototype);g.residentRefreshCycle=Number.isInteger(d.residentRefreshCycle)?d.residentRefreshCycle:cycle(g.day,g.difficultyRules.residents);g.ensureResidentRoster();return g;}
  }
  S.Game=ResidentRefreshGame;
})(globalThis);
