/* Stable per-run rules. Gameplay seconds and the surface calendar are separate. */
(function(root){
  'use strict';
  const profiles={
    easy:{name:'简单',talents:4,diseaseMin:0,diseasePower:1,dayHour:45,nightHour:30,raid:.8,hp:.9,damage:.8,speed:.9,bossDamage:.85,bossSpeed:.9,resources:1,restock:3,residents:7,repair:3,reviveDays:3,shatterDays:3,weather:[40,28,20,8,3,1],badHours:[2,5],hazards:1},
    normal:{name:'普通',talents:2,diseaseMin:0,diseasePower:1,dayHour:45,nightHour:45,raid:1,hp:1,damage:1,speed:1,bossDamage:1,bossSpeed:1,resources:1,restock:0,residents:7,repair:0,reviveDays:3,shatterDays:3,weather:[30,25,25,12,6,2],badHours:[2,7],hazards:1},
    hard:{name:'困难',talents:2,diseaseMin:3,diseasePower:1,dayHour:45,nightHour:60,raid:1.2,hp:1,damage:1.15,speed:1.1,bossDamage:1.1,bossSpeed:1.05,resources:.8,restock:4,residents:4,repair:0,reviveDays:3,shatterDays:2,weather:[20,20,28,17,10,5],badHours:[3,8],hazards:2},
    apocalypse:{name:'天启',talents:1,diseaseMin:3,diseasePower:1.5,dayHour:36,nightHour:90,raid:1.5,hp:1.15,damage:1.3,speed:1.2,bossDamage:1.2,bossSpeed:1.1,resources:.65,restock:3,residents:3,repair:0,reviveDays:1,shatterDays:1,weather:[12,13,28,22,16,9],badHours:[4,10],hazards:2}
  };
  for(const p of Object.values(profiles)){Object.freeze(p.weather);Object.freeze(p.badHours);Object.freeze(p);}Object.freeze(profiles);
  const id=value=>Object.hasOwn(profiles,value)?value:'normal',profile=value=>profiles[id(value)];
  const minimum=(value,talents)=>Math.max(profile(value).diseaseMin,id(value)==='easy'?Math.max(0,talents-2):talents);
  const daySeconds=value=>{const p=profile(value);return 17*p.dayHour+7*p.nightHour;};
  const boss=kind=>['lurker','lurker_roar','skeleton','skeleton_bone','sweeper','sweeper_rocket'].includes(kind);
  function damage(n,source,value){const p=profile(value);return boss(source)?n*p.bossDamage:['normal','runner','brute','demolisher','spitter','screamer','lamp_smasher','armory_blade_zombie'].includes(source)?n*p.damage:n;}
  function gameMinutes(minutes,seconds,value){const p=profile(value);let current=minutes,left=Math.max(0,seconds);while(left>1e-9){const m=((current%1440)+1440)%1440,day=m>=300&&m<1320,end=day?1320:m<300?300:1740,rate=(day?p.dayHour:p.nightHour)/60,chunk=Math.min(left,(end-m)*rate);current+=chunk/rate;left-=chunk;}return current-minutes;}
  const api={version:1,profiles,id,profile,minimum,daySeconds,boss,damage,gameMinutes};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.DifficultyRules=api;
})(globalThis);
