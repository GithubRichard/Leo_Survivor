/* Rules from 数值与内容扩展方案 v1.1. Times are real seconds. */
(function(root){
  const items={
    stone:['石头',99],cloth:['布',20],scrap:['废料',99],parts:['零件',10],herb:['药草',20],alcohol:['酒精',20],gunpowder:['火药',20],raw_water:['原水',20],clean_water:['清水',20],
    potato:['土豆',20],vegetable:['蔬菜',20],raw_meat:['生肉',20],grain:['谷物',20],canned_food:['罐头',20],arrow:['箭',50],bolt:['弩箭',50],shotgun_shell:['散弹',50],bandage:['绷带',20],medkit:['急救包',20],molotov:['燃烧瓶',20],
    baked_potato:['烤土豆',20],roast_meat:['烤肉',20],vegetable_soup:['蔬菜汤',20],grain_porridge:['谷物粥',20],meat_vegetable_stew:['肉菜炖锅',20],potato_meat_pie:['土豆肉派',20],herb_tea:['药草茶',20],jerky:['肉干',20]
  };
  const siteNames={kitchen:'厨房储物处',misc:'杂物柜',supply:'补给箱',freezer:'冷柜',repair_shop:'维修铺物资箱',pharmacy:'药店物资柜',security_room:'保安室物资箱',stone_pile:'石堆',water_point:'公共水点',herb_bed:'花圃'};
  const weapons={
    fists:{name:'徒手',day:1,cost:{},damage:1,interval:1,range:1,stamina:0},
    wood_club:{name:'木棍',day:1,cost:{wood:2},damage:1,interval:.7,range:1.2,stamina:.5},
    wood_spear:{name:'木矛',day:1,cost:{wood:3,iron:1},damage:2,interval:1.2,range:2,stamina:1},
    iron_axe:{name:'铁斧',day:3,cost:{wood:3,iron:4},damage:3,interval:1.3,range:1.3,stamina:1.2,station:'workbench'},
    simple_bow:{name:'简易弓',day:3,cost:{wood:4,cloth:2},damage:2,interval:1.2,range:9,stamina:.4,ammo:'arrow',station:'workbench'},
    hand_crossbow:{name:'手弩',day:7,cost:{wood:4,iron:6,parts:2},damage:4,interval:2,range:12,stamina:0,ammo:'bolt',station:'workbench'},
    shotgun:{name:'散弹枪',day:12,cost:{iron:10,scrap:4,parts:3},damage:2,interval:2.2,range:6,stamina:0,ammo:'shotgun_shell',station:'workbench',pellets:4}
  };
  // Three visual poses; impact/release begins with the second pose.
  const attackAnimations={wood_club:.36,wood_spear:.39,iron_axe:.45,simple_bow:.45,hand_crossbow:.42,shotgun:.48,molotov:.48};
  const builds={
    trap:{name:'捕兽夹',day:1,cost:{iron:3},hp:6,asset:'bear_trap',ground:true},ballista:{name:'巨弩',day:1,cost:{wood:5},hp:18,asset:'ballista'},
    wood_fence:{name:'木围栏',day:1,cost:{wood:2},hp:12,asset:'wood_fence',w:1,h:.16},iron_fence:{name:'铁围栏',day:1,cost:{wood:1,iron:3},hp:24,asset:'iron_fence',w:1,h:.16},brick_wall:{name:'砖墙',day:1,cost:{stone:4,wood:1},hp:30,asset:'brick_wall',w:1,h:.24},
    spike_floor:{name:'木刺地板',day:1,cost:{wood:3},hp:9,asset:'spike_floor',ground:true},workbench:{name:'工作台',day:1,cost:{wood:4,iron:2},hp:18,asset:'workbench'},storage_chest:{name:'储物箱',day:1,cost:{wood:4},hp:18,asset:'storage_chest_closed'},
    drying_rack:{name:'晾晒架',day:5,cost:{wood:3,cloth:1},hp:9,asset:'drying_rack_empty'},grill:{name:'篝火烤架',day:1,cost:{wood:3,stone:2},hp:9,asset:'grill'},stove:{name:'简易炉灶',day:1,cost:{wood:2,iron:4,stone:3},hp:18,asset:'stove'},water_purifier:{name:'净水器',day:1,cost:{wood:3,cloth:2,stone:2},hp:18,asset:'water_purifier'},planter:{name:'菜箱',day:4,cost:{wood:4,stone:2},hp:12,asset:'planter_empty'}
  };
  const crafts={
    arrow:{name:'6支箭',cost:{wood:1},amount:6,day:3},bolt:{name:'10支弩箭',cost:{wood:1,iron:1},amount:10,day:7},shotgun_shell:{name:'4发散弹',cost:{iron:1,gunpowder:1},amount:4,day:12},
    bandage:{name:'绷带',cost:{cloth:2},amount:1,day:1},medkit:{name:'急救包',cost:{cloth:3,herb:2},amount:1,day:8},molotov:{name:'燃烧瓶',cost:{cloth:1,alcohol:1},amount:1,day:5},backpack_upgrade:{name:'背包扩至30格',cost:{cloth:4,scrap:2},amount:1,day:7}
  };
  const foods={
    potato:{hunger:8},vegetable:{hunger:8},canned_food:{hunger:25},clean_water:{hunger:0,stamina:2,water:true},
    baked_potato:{hunger:20,heal:1,buff:'stamina2',cost:{potato:1},time:6,day:1,station:'grill'},
    roast_meat:{hunger:28,heal:1,buff:'melee',cost:{raw_meat:1},time:8,day:1,station:'grill'},
    vegetable_soup:{hunger:24,buff:'health',regen:3,cost:{vegetable:1,clean_water:1},time:10,day:1,station:'stove'},
    grain_porridge:{hunger:30,buff:'recovery',cost:{grain:1,clean_water:1},time:10,day:1,station:'stove'},
    meat_vegetable_stew:{hunger:45,buff:'armor',regen:6,cost:{raw_meat:1,vegetable:1,clean_water:1},time:15,day:5,station:'stove'},
    potato_meat_pie:{hunger:55,heal:2,buff:'stamina4',cost:{potato:1,raw_meat:1,grain:1},time:18,day:10,station:'stove'},
    herb_tea:{hunger:0,stamina:3,tea:true,cost:{herb:1,clean_water:1},time:8,day:1,station:'stove'},
    jerky:{hunger:22,heal:1,cost:{raw_meat:1,wood:1},time:60,day:5,station:'drying_rack'}
  };
  const enemies={
    normal:{name:'普通丧尸',hp:3,speed:1.5,damage:3,building:3,interval:2,windup:0},runner:{name:'疾跑者',hp:2,speed:2.8,damage:2,building:1,interval:1.5,windup:0},brute:{name:'厚皮者',hp:12,speed:1,damage:3,building:6,interval:2.5,windup:.8},spitter:{name:'酸液者',hp:5,speed:1.2,damage:1,building:1,interval:2,windup:1},demolisher:{name:'拆墙者',hp:8,speed:1.3,damage:2,building:5,interval:2.5,windup:.6},screamer:{name:'尖啸者',hp:6,speed:1.3,damage:1,building:1,interval:2,windup:1.5}
  };
  const upgrades={
    trap:{day:5,cost:{iron:2,scrap:1},hp:12,level:1},ballista:{day:5,cost:{wood:4,iron:3,scrap:2},hp:30,level:1},repeating:{day:10,cost:{iron:5,scrap:3,parts:2},hp:36,level:2},door:{day:1,cost:{wood:3,iron:1},hp:18,level:1}
  };
  const trades=[{cost:{wood:3},gain:{iron:1}},{cost:{iron:1},gain:{clean_water:2}},{cost:{iron:1},gain:{canned_food:1}},{cost:{iron:2},gain:{cloth:2}},{cost:{iron:3},gain:{herb:2}}];
  const api={items,siteNames,weapons,attackAnimations,builds,crafts,foods,enemies,upgrades,trades};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.ExpansionData=api;
})(typeof globalThis!=='undefined'?globalThis:this);
