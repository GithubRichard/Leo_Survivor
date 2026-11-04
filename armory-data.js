/* Dates and enemy bullet speed remain explicit provisional design parameters. */
(function(root){
  'use strict';const S=root.Survival,D=S.Expansion;
  const guns={
    pistol:{name:'手枪',damage:2,interval:.8,range:10,speed:14,windup:.12,recover:.2,ammo:'pistol_round',day:8,cost:{iron:6,scrap:2,parts:1}},
    smg:{name:'冲锋枪',damage:1,interval:.2,range:9,speed:14,windup:.15,recover:.2,ammo:'pistol_round',day:13,cost:{iron:9,scrap:5,parts:3}},
    assault_rifle:{name:'突击步枪',damage:1.5,interval:1.5,range:16,speed:12,windup:0,recover:.3,ammo:'rifle_round',day:1,knowledge:'blueprint_assault_rifle',cost:{iron:12,scrap:6,parts:4}},
    sniper_rifle:{name:'狙击步枪',damage:7,interval:2.8,range:22,speed:18,windup:.9,recover:.4,ammo:'sniper_round',day:1,knowledge:'blueprint_sniper_rifle',cost:{iron:14,scrap:6,parts:5,cloth:2}},
    rocket_launcher:{name:'火箭筒',damage:8,interval:5,range:18,speed:8,windup:.8,recover:.4,ammo:'rocket_round',radius:1.5,day:1,knowledge:'blueprint_rocket_launcher',cost:{iron:16,scrap:8,parts:5,wire:2}}
  };
  const ammo={pistol_round:{name:'手枪弹',amount:12,day:8,cost:{iron:1,gunpowder:1}},rifle_round:{name:'步枪弹',amount:6,day:1,knowledge:'blueprint_rifle_round',cost:{iron:1,gunpowder:1}},sniper_round:{name:'狙击弹',amount:4,day:1,knowledge:'blueprint_sniper_round',cost:{iron:2,gunpowder:2}},rocket_round:{name:'火箭弹',amount:1,day:1,knowledge:'blueprint_rocket_round',cost:{iron:3,gunpowder:3,alcohol:1}}};
  const blueprints={blueprint_assault_rifle:'突击步枪蓝图',blueprint_sniper_rifle:'狙击步枪蓝图',blueprint_rocket_launcher:'火箭筒蓝图',blueprint_rifle_round:'步枪弹配方',blueprint_sniper_round:'狙击弹配方',blueprint_rocket_round:'火箭弹配方'};
  // Initial tuning: one uniformly selected blueprint at most, higher chance in hangars.
  const blueprintDrops={low:{name:'低级军备箱',chance:.1},high:{name:'高级军备箱',chance:.3},pool:Object.keys(blueprints)};
  for(const [k,g] of Object.entries(guns)){D.weapons[k]={...g,stamina:0,station:'workbench'};S.NAMES[k]=g.name;}
  for(const [k,a] of Object.entries(ammo)){D.items[k]=[a.name,k==='rocket_round'?10:50];D.crafts[k]={...a,station:'workbench',gain:{[k]:a.amount}};S.NAMES[k]=a.name;}
  D.enemies.sweeper={name:'扫荡者',hp:48,speed:1.8,damage:1.5,building:1.5,interval:2};D.enemies.armory_blade_zombie={name:'军刀兵',hp:8,speed:2.2,damage:4,building:4,interval:1.8};
  S.NAMES.sweeper='扫荡者';S.NAMES.armory_blade_zombie='军刀兵';
  root.ArmoryData={guns,ammo,blueprints,blueprintDrops,isRocketShot:p=>p?.thermal===true&&p.weapon==='rocket_launcher'&&p.kind==='thermal_rocket',provisional:{unlockDay:17,bossBulletSpeed:1.5},hotWeapons:new Set(['shotgun',...Object.keys(guns)]),loot:{ammo:{iron:1,gunpowder:1,arrow:6,bolt:6,shotgun_shell:2,rifle_round:6,pistol_round:18,sniper_round:2},medical:{cloth:2,herb:1,alcohol:1,bandage:1},supplies:{canned_food:1,clean_water:2,jerky:1},equipment:{iron:3,scrap:2,parts:1},energy:{fuel_oil:2,battery:1,wire:1}}};
})(globalThis);
