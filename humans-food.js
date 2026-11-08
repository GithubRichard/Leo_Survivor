/* Store base seconds/progress: moving a totem never resets a meal or healing tick. */
(() => {
  const P=HumansGame.prototype,Base=Object.getPrototypeOf(P),D=Survival.Expansion;
  Object.assign(P,{
    initializeHumanFood(){
      if(!this.humans)return;const food=this.humans.food||(this.humans.food={});
      for(const [key,state] of [['main','mainBuff'],['tea','teaBuff']])if(this[state]&&!food[key])food[key]={type:this[state].type,remaining:Math.max(0,this[state].until-this.seconds)};
      if(this.foodRegen&&!food.regen)food.regen={left:this.foodRegen.left,progress:Math.max(0,30-(this.foodRegen.next-this.seconds))};
    },
    syncHumanFood(){
      if(!this.humanMode||!this.humans)return;this.initializeHumanFood();this.tickHumanFood(0);this.player.hp=Math.min(this.player.hp,this.maxHP);this.player.stamina=Math.min(this.player.stamina,this.maxStamina);this.syncStaminaRecovery();
    },
    tickHumanFood(dt){
      if(!this.humanMode||!this.humans)return;const food=this.humans.food,m=this.foodAmplitude;
      for(const [key,state] of [['main','mainBuff'],['tea','teaBuff']]){const f=food[key];if(!f)continue;f.remaining=Math.max(0,f.remaining-dt/m);if(f.remaining<=1e-8){delete food[key];this[state]=null;}else this[state]={...(this[state]||{}),type:f.type,until:this.seconds+f.remaining*m};}
      const regen=food.regen;if(regen){regen.progress+=dt/m;while(regen.progress+1e-8>=30&&regen.left>0){regen.progress-=30;regen.left--;this.healPlayer(m);}if(regen.left<=0){delete food.regen;this.foodRegen=null;}else this.foodRegen={left:regen.left,next:this.seconds+(30-regen.progress)*m};}
    },
    completeFood(kind){
      const before=this.count(kind);Base.completeFood.call(this,kind);if(!this.humanMode||!this.humans||this.count(kind)>=before)return;
      const f=this.humans.food,definition=D.foods[kind];if(definition.buff)f.main={type:this.mainBuff.type,remaining:360};if(definition.tea)f.tea={remaining:360};if(definition.regen)f.regen={left:this.foodRegen.left,progress:0};this.syncHumanFood();
    },
    updateVitals(dt){this.initializeHumanFood();this.tickHumanFood(dt);return Base.updateVitals.call(this,dt);}
  });
})();
