/* Fixed barter batches and commissions from 幸存者营地体系规则 v1. */
(function(root){
  'use strict';const offers={};
  const add=(id,npc,cost,gain,limit,day=14,tier=0,service=false)=>offers[id]={id,npc,cost,gain,limit,day,tier,service};
  add('W01','C01',{wood:2,iron:1},{wood_spear:1},1);add('W02','C01',{iron:3,wood:2},{iron_axe:1},1);add('W03','C01',{wood:3,cloth:2},{simple_bow:1},1);add('W04','C01',{iron:5,parts:2,wood:3},{hand_crossbow:1},1);add('W05','C01',{iron:8,scrap:3,parts:3},{shotgun:1},1,14,1);add('W06','C01',{wood:3},{arrow:24},3);add('W07','C01',{scrap:2,wood:1},{bolt:10},3);add('W08','C01',{scrap:2,gunpowder:1},{shotgun_shell:4},2);add('W09','C01',{scrap:1,alcohol:1},{molotov:1},2);
  add('F01','C02',{iron:2},{canned_food:1},3);add('F02','C02',{wood:2},{baked_potato:1},3);add('F03','C02',{wood:3},{grain_porridge:1},2);add('F04','C02',{iron:2,cloth:1},{meat_vegetable_stew:1},1);add('F05','C02',{iron:3,cloth:1},{potato_meat_pie:1},1);add('F06','C02',{wood:2},{clean_water:2},3);add('F07','C02',{wood:3},{jerky:1},2);
  add('M01','C03',{herb:1},{bandage:1},2);add('M02','C03',{alcohol:1,cloth:2},{medkit:1},1);add('M03','C03',{iron:3},{herb:2},2);add('M04','C03',{cloth:2,herb:1,clean_water:1},{},1,14,0,true);
  add('E01','C04',{iron:3,scrap:2},{parts:1},2);add('E02','C04',{scrap:4},{cloth:2},2);add('E03','C04',{iron:2,scrap:1},{wire:1},2,15);add('E04','C04',{iron:2,cloth:1},{fuel_oil:1},2,15);add('E05','C04',{iron:3,scrap:1},{battery:1},2,15);add('E06','C04',{iron:2,scrap:2,cloth:1},{oil_lantern:1},1,15);add('E07','C04',{iron:2,scrap:2,parts:2,cloth:1},{headlamp:1},1,15,1);
  add('A01','C05',{wood:5},{potato:2},2);add('A02','C05',{wood:5},{vegetable:2},2);add('A03','C05',{cloth:2},{grain:2},2);add('A04','C05',{iron:2},{raw_meat:1},1);add('A05','C05',{wood:3},{raw_water:4},2);
  add('R01','C06',{alcohol:2,parts:1},{fuel_oil:3},1);add('R02','C06',{parts:1,cloth:2},{battery:2},1);add('R03','C06',{iron:5,cloth:2},{gunpowder:3},1);add('R04','C06',{wire:2,iron:2},{canned_food:3},1);
  const quests={K01:{name:'修补宿舍',cost:{wood:12,stone:6},gain:{iron:3,bandage:1}},K02:{name:'食堂备菜',cost:{vegetable:4,clean_water:2},gain:{cloth:2,iron:1}},K03:{name:'医务备料',cost:{herb:3,alcohol:1},gain:{iron:3,clean_water:2}},K04:{name:'照明维修',cost:{fuel_oil:2,wire:2},gain:{parts:1,cloth:2},day:15},K05:{name:'补充箭库',cost:{bolt:20},gain:{herb:1,iron:1}},K06:{name:'修复炊具',cost:{scrap:6,iron:2},gain:{grain:4,cloth:2}}};
  const npcs={C00:{name:'许岚',role:'主理人',home:'dormitory',spot:'notice'},C01:{name:'老周',role:'武器商',home:'dormitory',spot:'weapon'},C02:{name:'林禾',role:'炊事员',home:'canteen',spot:'food'},C03:{name:'苏青',role:'医生',home:'clinic',spot:'medical'},C04:{name:'赵衡',role:'技工',home:'workshop',spot:'equipment'},C05:{name:'阿苗',role:'种植员',home:'dormitory',spot:'planting'},C06:{name:'阿洛',role:'流动商',home:'warehouse',spot:'cart'}};
  // Road-side adaptation of the delivery example: keep the existing 5 m roads.
  const nodes=[
    {id:'clinic',asset:'building_clinic',name:'医务室',x:-8,y:-5.1,w:2.6,h:3,building:true},
    {id:'workshop',asset:'building_workshop',name:'器材棚',x:-4.8,y:-5.1,w:2.6,h:3,building:true},
    {id:'canteen',asset:'building_canteen',name:'食堂',x:4.8,y:-5.1,w:2.6,h:3,building:true},
    {id:'dormitory',asset:'building_dormitory',name:'私人寝室',x:8,y:-5.1,w:2.6,h:3,building:true,private:true},
    {id:'warehouse',asset:'building_warehouse',name:'私人仓库',x:8,y:5.1,w:2.6,h:3,building:true,private:true},
    {id:'medical',asset:'stall_medical',npc:'C03',name:'药品摊',x:-8,y:-2.45,w:2,h:.6},
    {id:'equipment',asset:'stall_equipment',npc:'C04',name:'器材摊',x:-4.6,y:-2.45,w:2,h:.6},
    {id:'food',asset:'stall_food',npc:'C02',name:'食品摊',x:4.6,y:-2.45,w:2,h:.6},
    {id:'weapon',asset:'stall_weapon',npc:'C01',name:'武器摊',x:8,y:-2.45,w:2,h:.6},
    {id:'planting',asset:'stall_planting',npc:'C05',name:'种植摊',x:-5,y:4.1,w:2,h:.6},
    {id:'notice',asset:'camp_notice_board',name:'公告板',x:-8,y:5.1,w:1.6,h:.5},
    {id:'cart',asset:'traveler_cart',npc:'C06',name:'流动商推车',x:4.8,y:5.1,w:3,h:1.5},
    {id:'sign',asset:'camp_entrance_sign',name:'幸存者营地',x:-2.8,y:6.6,w:.4,h:.3}
  ];
  root.CampData={offers,quests,npcs,nodes,bounds:{w:22,h:14.4},publicDoorWidth:1.6,tier:r=>r>=80?3:r>=50?2:r>=20?1:0,tiers:['初识','熟悉','互信','盟友']};
})(globalThis);
