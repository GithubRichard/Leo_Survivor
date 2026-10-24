/* Parking rules v1.2 and 潜伏者Boss与潜伏技能规则 v1. Seconds are real seconds. */
(function(root){
  'use strict';
  const D=typeof module!=='undefined'&&module.exports?require('./expansion-data.js'):root.ExpansionData;
  const lamps={
    torch:{name:'火把',cost:{wood:2,cloth:1},radius:3,duration:180,hp:3,hand:true,throwable:true},
    flashlight:{name:'手电筒',cost:{iron:2,scrap:2,parts:1},radius:10,angle:70,duration:180,hp:12,hand:true,fuel:'battery'},
    oil_lantern:{name:'燃油提灯',cost:{iron:3,scrap:2,cloth:1},radius:4,duration:300,hp:12,hand:true,throwable:true,fuel:'fuel_oil'},
    headlamp:{name:'头灯',cost:{iron:2,scrap:3,parts:2,cloth:1},radius:6,angle:90,duration:180,hp:12,fuel:'battery'},
    fixed_oil_lamp:{name:'固定燃油灯',cost:{wood:2,iron:4,scrap:2},radius:6,duration:300,hp:18,fuel:'fuel_oil',fixed:true},
    generator_light:{name:'发电照明组',cost:{iron:8,scrap:6,parts:3,wire:2},radius:8,duration:180,hp:30,fuel:'fuel_oil',fixed:true}
  };
  Object.assign(D.items,{fuel_oil:['汽车燃油（0.25升）',10],battery:['电池',20],wire:['电线',20],fuse:['保险丝',20]});
  for(const [kind,d] of Object.entries(lamps)){
    if(d.fixed)D.builds[kind]={name:d.name,day:15,cost:d.cost,hp:d.hp,asset:kind,station:'workbench'};
    else {D.items[kind]=[d.name,1];D.crafts[kind]={name:d.name,cost:d.cost,amount:1,day:15,...(kind==='torch'?{}:{station:'workbench'})};}
  }
  const enemies={lamp_smasher:{name:'砸灯者',hp:8,speed:1.2,damage:2,building:2,interval:2,windup:0},lurker:{name:'潜伏者',hp:25,speed:2.5,damage:4.5,building:Infinity,interval:2,windup:.6}};
  const api={lamps,enemies,groundSight:24,baseSight:8,lightSight:16,exit:{x:0,y:3},width:48,height:60,
    initial:['normal','runner','normal','brute','spitter','normal','runner','normal','lamp_smasher','normal','brute','spitter','normal','runner','normal','demolisher','screamer','normal','brute','spitter','runner','normal','normal','lamp_smasher'],
    cycle:['spitter','demolisher','spitter','screamer','spitter','lamp_smasher'],
    chestPacks:[{weight:30,loot:{wood:6,iron:4,cloth:2}},{weight:20,loot:{bolt:12,shotgun_shell:6}},{weight:20,loot:{scrap:6,parts:2,wire:2}},{weight:20,loot:{fuel_oil:3,battery:2}},{weight:10,loot:{canned_food:3,clean_water:3,medkit:1}}]};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.ParkingData=api;
})(typeof globalThis!=='undefined'?globalThis:this);
