/* Selection drafts stay in the UI until a valid character is confirmed. */
(() => {
  'use strict';
  const T=CharacterTraits,M=DifficultyRules;
  const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const number=n=>Number.isFinite(n)?String(Number(n.toFixed(2))):'不恢复';
  function icon(id){const src=window.TALENT_DISEASE_ART?.icons[id]?.projectFile;return src?`<img class="trait-icon" src="${esc(src)}" alt="" loading="lazy" decoding="async" width="64" height="64">`:'';}
  function traitText(e,difficulty){
    if(e.id==='myopia'&&M.profile(difficulty).diseasePower===1)return '有限地下视距×0.75；主世界晴天不限，大雾时缩小';
    if(e.type!=='diseases'||M.profile(difficulty).diseasePower===1)return e.text;
    return {frail_constitution:'体力上限−3',leg_ailment:'奔跑速度×0.85',anemia:'生命上限−4.5',myopia:'有限地下视距×0.625；主世界不限',hunger_prone:'自然饱食消耗×1.375',stiff_joints:'建筑动作耗时×1.375',migraine:'搜索、采集、抽油耗时×1.375',muscle_weakness:'主动近战伤害−0.75，最低0.1',hand_tremor:'远程攻击周期×1.225',slow_recovery:'生命恢复量×0.7'}[e.id]||e.text;
  }
  const chosen=s=>[...s.talents,...s.diseases];
  function conflict(s,id){const entry=T.entries[id],other=entry&&chosen(s).find(k=>k===entry.excludes);return other?`不能与已选${T.entries[other].type==='talents'?'天赋':'疾病'}【${T.entries[other].name}】同时选择`:'';}
  function toggle(s,id,difficulty='normal'){
    const e=T.entries[id];if(!e)return '未知选项';const list=s[e.type],i=list.indexOf(id);
    if(i>=0){list.splice(i,1);return '';}
    const reason=conflict(s,id);if(reason)return reason;
    if(e.type==='talents'&&list.length>=M.profile(difficulty).talents)return `本难度天赋最多选择${M.profile(difficulty).talents}项，请先取消一个已选项目`;
    list.push(id);return '';
  }
  function cards(s,type,readonly=false,difficulty='normal'){
    const list=readonly?s[type]:Object.keys(T.entries).filter(id=>T.entries[id].type===type);
    return list.map(id=>{const e=T.entries[id],selected=s[type].includes(id),reason=readonly?'':conflict(s,id),full=type==='talents'&&!selected&&s[type].length>=M.profile(difficulty).talents;
      const body=`${icon(id)}<span class="trait-copy"><strong>${esc(e.name)}${readonly?'':selected?'　✓':''}</strong><span>${esc(traitText(e,difficulty))}</span>${!readonly?`<small>${esc(reason||(full?'已达上限，先取消一项':`禁选：${T.entries[e.excludes].name}`))}</small>`:''}</span>`;
      return readonly?`<article class="trait-card">${body}</article>`:`<button type="button" class="trait-card ${selected?'selected':''} ${reason||full?'trait-unavailable':''}" data-trait="${id}" aria-pressed="${selected}" aria-label="${esc(e.name+'：'+traitText(e,difficulty)+(reason?'；'+reason:''))}">${body}</button>`;
    }).join('')||'<p>无</p>';
  }
  function attributes(s,game=null,difficulty=game?.difficulty||'normal'){
    const e=T.effects(s,difficulty),hp=game?game.maxHP:Math.max(1,12+e.hp),stamina=game?game.maxStamina:Math.max(1,10+e.stamina),interval=game?game.staminaRecoveryInterval:2*e.recovery,delay=game?game.staminaRecoveryDelay:2;
    const rows=[['生命上限',number(hp)],['体力上限',number(stamina)],['首次恢复等待',Number.isFinite(delay)?number(delay)+'秒':'不恢复'],['每恢复1体力',Number.isFinite(interval)?number(interval)+'秒':'饱食为0，不恢复'],['步行 / 奔跑',`2 / ${number(4*e.run)} 米/秒`],['主世界视野','晴天不限，大雾收缩'],['地下个人 / 受照最远',`${number(8*e.sight)} / ${number(16*e.sight)} 米`],['自然饱食消耗',number(4*e.metabolism)+' / 有效现实分钟'],['建筑 / 搜索耗时',`×${number(e.building)} / ×${number(e.search)}`],['近战伤害修正',`${e.melee>=0?'+':''}${number(e.melee)}`],['远程周期 / 治疗量',`×${number(e.ranged)} / ×${number(e.healing)}`]];
    return `<dl class="trait-attributes">${rows.map(([k,v])=>`<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl><p class="trait-note">饱食≤60：体力上限${number(Math.max(1,8+e.stamina))}、等待3秒、每${number(3*e.recovery)}秒回1；≤30：上限${number(Math.max(1,6+e.stamina))}、等待4秒、每${number(4*e.recovery)}秒回1。饱食0不回体，每12秒失去1血。料理体力加成在低饱食时暂停。</p><p class="trait-note">视距不改变真实照明与怪物畏光范围；潜伏技能基准速度3.4米/秒，地面室外再应用天气。特征永久生效，临时料理、天气和怒吼状态另行结算。</p>`;
  }
  function selection(draft,preview=false){
    const s=draft.traits,difficulty=draft.difficulty,p=M.profile(difficulty),min=M.minimum(difficulty,s.talents.length),error=T.validate(s,difficulty),title=preview?'确认你的幸存者':'选择天赋与疾病';
    const header=`<div class="eyebrow">开局准备 · ${p.name} · ${preview?'属性确认':'天赋与疾病'} · ${draft.developer?'开发者试玩':draft.startMode==='quick'?'快速试玩':'完整的一天'}</div><h2>${title}</h2><p>${esc(draft.name)} · 天赋${s.talents.length}/${p.talents}，疾病已选${s.diseases.length}，至少${min}（无上限）</p>`;
    const content=preview?`${attributes(s,null,difficulty)}<div class="trait-columns"><section><h3>本局天赋</h3>${cards(s,'talents',true,difficulty)}</section><section><h3>本局疾病</h3>${cards(s,'diseases',true,difficulty)}</section></div>`:`<p>${difficulty==='easy'?'前2项天赋不需要疾病，第3、4项各承担1项疾病。':p.diseaseMin?'必须选择至少3项疾病，即使不选天赋。':'每项天赋至少承担1项不冲突的疾病。'}疾病数量不限，同种只选一次，互斥保留。${p.diseasePower>1?'天启疾病负面幅度为标准的1.5倍。':''}</p><div class="trait-columns"><section><h3>天赋 ${s.talents.length}/${p.talents}</h3><div class="trait-grid">${cards(s,'talents',false,difficulty)}</div></section><section><h3>疾病已选${s.diseases.length}，至少${min}（不限）</h3><div class="trait-grid">${cards(s,'diseases',false,difficulty)}</div></section></div>`;
    return header+content+`<p class="trait-validation" role="status">${esc(error||'组合合法，可以继续')}</p><div class="overlay-actions trait-actions"><button data-character="back">上一步</button><button data-character="clear">清空选择</button><button data-character="${preview?'confirm':'preview'}" class="primary" ${error?'disabled':''}>${preview?'确认开始':'查看属性预览'}</button></div><small>Esc 返回上一步 · W/S 或 Tab 选择 · E 或 Enter 确认。确认开始才创建角色、写入存档。</small>`;
  }
  function details(game){return `<div class="character-details"><h3>${esc(game.player.name)} · 本局角色</h3><p>${M.profile(game.difficulty).name} · ${game.startMode==='legacy'?'旧存档（未记录开局模式）':game.startMode==='quick'?'快速试玩':'完整的一天'} · 当前饱食${number(game.player.hunger)} · 已计入当前料理的生命/体力上限与恢复间隔</p>${attributes(game.traits,game)}<div class="trait-columns"><section><h3>天赋</h3>${cards(game.traits,'talents',true,game.difficulty)}</section><section><h3>疾病</h3>${cards(game.traits,'diseases',true,game.difficulty)}</section></div></div>`;}
  window.CharacterUI={selection,details,toggle,conflict};
})();
