/* The evacuation state and its key item commit together in the run save. */
(() => {
  'use strict';
  const S=Survival,Base=S.Game;
  const pending=new Set(['intro','choice','yes','no','recall']);
  class EndingGame extends Base{
    get endingPending(){return pending.has(this.ending?.phase);}
    get hasEvacuationRadio(){return this.ending?.phase==='endless'&&this.ending.radio===1;}
    startEvacuation(zombie=null){
      if(this.ending||this.result||this.player.hp<=0||this.scene!=='surface')return false;
      this.ending={phase:'intro',radio:0,zombie:zombie?{kind:zombie.kind,facing:zombie.facing}:null};
      this.autosaveRequested=true;return true;
    }
    advanceClock(dt){
      if(this.scene==='surface'&&this.day===21&&!this.ending&&this.minutes+this.clockMinutes(dt)>=1740){
        this.updateZones(dt);
        if(this.result)return;
      }
      super.advanceClock(dt);
    }
    dawn(){
      const evacuation=this.day===21&&!this.ending&&this.scene==='surface';
      const last=evacuation?this.zombies.findLast(z=>z.hp>0&&!z.persistentId&&this.isNightRaider(z)):null;
      super.dawn();
      if(evacuation)this.startEvacuation(last);
    }
    step(dt,input){
      if(this.endingPending)return;
      if(this._legacyEvacuation&&this.scene==='surface'&&this.startEvacuation()){this._legacyEvacuation=false;return;}
      super.step(dt,input);
    }
    setEndingPhase(phase){this.ending.phase=phase;this.autosaveRequested=true;}
    awaitEvacuationChoice(){if(this.ending?.phase==='intro')this.setEndingPhase('choice');}
    chooseEvacuation(choice){
      if(this.ending?.phase!=='choice'||!['yes','no'].includes(choice)||this.result)return false;
      if(choice==='no')this.ending.radio=1;
      this.setEndingPhase(choice);return true;
    }
    requestEvacuation(){
      if(!this.hasEvacuationRadio||this.result||this.player.hp<=0||this.action||this.playerAttack||this.boneSkill?.charging)return false;
      this.ending.radio=0;this.ending.underground=this.scene==='parking';
      this.setEndingPhase('recall');return true;
    }
    finishEvacuation(){
      const phase=this.ending?.phase;
      if(phase==='no'){this.setEndingPhase('endless');this.announce('已进入无尽模式。对讲机已放入关键物品栏。');return true;}
      if(phase!=='yes'&&phase!=='recall')return false;
      const record={day:this.day,nights:Math.max(0,this.day-1),difficulty:this.difficulty,kills:this.kills,method:phase};
      this.ending.record=record;this.result='win';this.setEndingPhase('complete');return true;
    }
    snapshot(){const data=super.snapshot();if(this.ending)data.ending=this.ending;return data;}
    static restore(data){
      const game=Base.restore(data);Object.setPrototypeOf(game,EndingGame.prototype);
      game._legacyEvacuation=!game.ending&&!game.result&&game.day>=22&&!game.developerUsed;
      return game;
    }
  }
  S.Game=EndingGame;
})();
