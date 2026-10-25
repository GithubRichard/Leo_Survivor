/* Permanent character rules. Icon metadata does not define gameplay effects. */
(function(root){
  'use strict';
  const rows=[
    ['robust_constitution','健壮','体力上限+2；恢复间隔×0.8；正常首次恢复仍等2秒','frail_constitution','虚弱','体力上限−2；恢复速度不变'],
    ['swift_runner','迅捷','奔跑速度×1.1；步行、体力消耗不变','leg_ailment','腿疾','奔跑速度×0.9；步行不变'],
    ['vitality','生机','生命上限+3；满血开局','anemia','贫血','生命上限−3'],
    ['keen_sight','明察','有限个人视距、受照最远距离×1.2；地面白天仍不限','myopia','近视','有限视距×0.75；地面白天18米；不模糊界面'],
    ['efficient_metabolism','节能代谢','自然饱食消耗×0.8；技能消耗不变','hunger_prone','易饥症','自然饱食消耗×1.25；技能消耗不变'],
    ['dexterous_builder','巧手','建造、主动拆除、维修、装置改造耗时×0.8','stiff_joints','关节僵硬','建造、主动拆除、维修、装置改造耗时×1.25'],
    ['resource_scout','搜寻好手','搜索、采集、抽油耗时×0.8','migraine','偏头痛','搜索、采集、抽油耗时×1.25；无随机发作'],
    ['heavy_strike','强击','主动近战直接命中伤害+0.5','muscle_weakness','肌无力','主动近战直接命中伤害−0.5，最低0.1'],
    ['steady_aim','稳手','弓、手弩、散弹枪攻击周期及动作耗时×0.9','hand_tremor','手颤','弓、手弩、散弹枪攻击周期及动作耗时×1.15'],
    ['healing_affinity','康复','食物、医疗的生命恢复量×1.2；跳数和时长不变','slow_recovery','恢复迟缓','食物、医疗的生命恢复量×0.8；跳数和时长不变']
  ];
  const entries={};rows.forEach((r,i)=>{for(const [offset,type,prefix] of [[0,'talents','T'],[3,'diseases','D']])entries[r[offset]]={id:r[offset],name:r[offset+1],text:r[offset+2],type,code:prefix+String(i+1).padStart(2,'0'),excludes:r[offset?0:3]};});
  function validate(s){
    if(!s||!Array.isArray(s.talents)||!Array.isArray(s.diseases))return '角色选择格式无效';
    for(const type of ['talents','diseases']){const list=s[type];if(list.length>2)return '每类最多选择2项';if(new Set(list).size!==list.length)return '不能重复选择同一项';if(list.some(id=>entries[id]?.type!==type))return '存在未知角色特征';}
    for(const id of s.talents)if(s.diseases.includes(entries[id].excludes))return `【${entries[id].name}】不能与【${entries[entries[id].excludes].name}】同时选择`;
    if(s.talents.length!==s.diseases.length)return '天赋与疾病数量必须相等，才能开始';return '';
  }
  const empty=()=>({talents:[],diseases:[]});
  const normalize=s=>validate(s)?empty():{talents:[...s.talents],diseases:[...s.diseases]};
  function effects(s){
    const has=id=>!!s?.talents?.includes(id)||!!s?.diseases?.includes(id);
    const pair=(a,b,yes,no,base=1)=>has(a)?yes:has(b)?no:base;
    return {hp:pair('vitality','anemia',3,-3,0),stamina:pair('robust_constitution','frail_constitution',2,-2,0),recovery:has('robust_constitution')?.8:1,run:pair('swift_runner','leg_ailment',1.1,.9),sight:pair('keen_sight','myopia',1.2,.75),myopia:has('myopia'),metabolism:pair('efficient_metabolism','hunger_prone',.8,1.25),building:pair('dexterous_builder','stiff_joints',.8,1.25),search:pair('resource_scout','migraine',.8,1.25),melee:pair('heavy_strike','muscle_weakness',.5,-.5,0),ranged:pair('steady_aim','hand_tremor',.9,1.15),healing:pair('healing_affinity','slow_recovery',1.2,.8)};
  }
  const api={entries,validate,normalize,empty,effects};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.CharacterTraits=api;
})(typeof globalThis!=='undefined'?globalThis:this);
