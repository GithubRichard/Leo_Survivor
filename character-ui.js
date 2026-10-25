/* Selection drafts stay in the UI until a valid character is confirmed. */
(() => {
  'use strict';
  const T=CharacterTraits;
  const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const number=n=>Number.isFinite(n)?String(Number(n.toFixed(2))):'不恢复';
  function icon(id){const src=window.TALENT_DISEASE_ART?.icons[id]?.projectFile;return src?`<img class="trait-icon" src="${esc(src)}" alt="" loading="lazy" decoding="async" width="64" height="64">`:'';}
  const chosen=s=>[...s.talents,...s.diseases];
  function conflict(s,id){const entry=T.entries[id],other=entry&&chosen(s).find(k=>k===entry.excludes);return other?`不能与已选${T.entries[other].type==='talents'?'天赋':'疾病'}【${T.entries[other].name}】同时选择`:'';}
  function toggle(s,id){
    const e=T.entries[id];if(!e)return '未知选项';const list=s[e.type],i=list.indexOf(id);
    if(i>=0){list.splice(i,1);return '';}
    const reason=conflict(s,id);if(reason)return reason;
    if(list.length>=2)return `${e.type==='talents'?'天赋':'疾病'}最多选择2项，请先取消一个已选项目`;
    list.push(id);return '';
  }
  function cards(s,type,readonly=false){
    const list=readonly?s[type]:Object.keys(T.entries).filter(id=>T.entries[id].type===type);
    return list.map(id=>{const e=T.entries[id],selected=s[type].includes(id),reason=readonly?'':conflict(s,id),full=!selected&&s[type].length>=2;
      const body=`${icon(id)}<span class="trait-copy"><strong>${esc(e.name)}${readonly?'':selected?'　✓':''}</strong><span>${esc(e.text)}</span>${!readonly?`<small>${esc(reason||(full?'已达上限，先取消一项':`禁选：${T.entries[e.excludes].name}`))}</small>`:''}</span>`;
      return readonly?`<article class="trait-card">${body}</article>`:`<button type="button" class="trait-card ${selected?'selected':''} ${reason||full?'trait-unavailable':''}" data-trait="${id}" aria-pressed="${selected}" aria-label="${esc(e.name+'：'+e.text+(reason?'；'+reason:''))}">${body}</button>`;
    }).join('')||'<p>无</p>';
  }
  function attributes(s,game=null){
    const e=T.effects(s),hp=game?game.maxHP:12+e.hp,stamina=game?game.maxStamina:10+e.stamina,interval=game?game.staminaRecoveryInterval:2*e.recovery,delay=game?game.staminaRecoveryDelay:2;
    const rows=[['生命上限',number(hp)],['体力上限',number(stamina)],['首次恢复等待',Number.isFinite(delay)?number(delay)+'秒':'不恢复'],['每恢复1体力',Number.isFinite(interval)?number(interval)+'秒':'饱食为0，不恢复'],['步行 / 奔跑',`2 / ${number(4*e.run)} 米/秒`],['地面白天视距',e.myopia?'18米':'不限'],['地面夜间视距',number(24*e.sight)+'米'],['地下个人 / 受照最远',`${number(8*e.sight)} / ${number(16*e.sight)} 米`],['自然饱食消耗',number(3*e.metabolism)+' / 游戏小时'],['建筑 / 搜索耗时',`×${e.building} / ×${e.search}`],['近战伤害修正',`${e.melee>=0?'+':''}${e.melee}`],['远程周期 / 治疗量',`×${e.ranged} / ×${e.healing}`]];
    return `<dl class="trait-attributes">${rows.map(([k,v])=>`<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl><p class="trait-note">饱食≤60：体力上限${8+e.stamina}、等待3秒、每${number(3*e.recovery)}秒回1；≤30：上限${6+e.stamina}、等待4秒、每${number(4*e.recovery)}秒回1。饱食0不回体，每12秒失去1血。料理体力加成在低饱食时暂停。</p><p class="trait-note">视距不改变真实照明与怪物畏光范围；潜伏技能基准速度3.4米/秒，地面室外再应用天气。特征永久生效，临时料理、天气和怒吼状态另行结算。</p>`;
  }
  function selection(draft,preview=false){
    const s=draft.traits,error=T.validate(s),title=preview?'确认你的幸存者':'选择天赋与疾病';
    const header=`<div class="eyebrow">开局准备 · ${preview?'3 / 3':'2 / 3'} · ${draft.developer?'开发者试玩':draft.startMode==='quick'?'快速试玩':'完整的一天'}</div><h2>${title}</h2><p>${esc(draft.name)} · 天赋${s.talents.length}/2，疾病${s.diseases.length}/2</p>`;
    const content=preview?`${attributes(s)}<div class="trait-columns"><section><h3>本局天赋</h3>${cards(s,'talents',true)}</section><section><h3>本局疾病</h3>${cards(s,'diseases',true)}</section></div>`:`<p>每选1项天赋，需要承担1项不冲突的疾病，最多各2项。可不选。同一行的相反效果禁止组合，疾病可自由搭配。</p><div class="trait-columns"><section><h3>天赋 ${s.talents.length}/2</h3><div class="trait-grid">${cards(s,'talents')}</div></section><section><h3>疾病 ${s.diseases.length}/2</h3><div class="trait-grid">${cards(s,'diseases')}</div></section></div>`;
    return header+content+`<p class="trait-validation" role="status">${esc(error||'组合合法，可以继续')}</p><div class="overlay-actions trait-actions"><button data-character="back">上一步</button><button data-character="clear">无天赋开始</button><button data-character="${preview?'confirm':'preview'}" class="primary" ${error?'disabled':''}>${preview?'确认开始':'查看属性预览'}</button></div><small>Esc 返回上一步 · W/S 或 Tab 选择 · E 或 Enter 确认。确认开始才创建角色、写入存档。</small>`;
  }
  function details(game){return `<div class="character-details"><h3>${esc(game.player.name)} · 本局角色</h3><p>${game.startMode==='legacy'?'旧存档（未记录开局模式）':game.startMode==='quick'?'快速试玩':'完整的一天'} · 当前饱食${number(game.player.hunger)} · 已计入当前料理的生命/体力上限与恢复间隔</p>${attributes(game.traits,game)}<div class="trait-columns"><section><h3>天赋</h3>${cards(game.traits,'talents',true)}</section><section><h3>疾病</h3>${cards(game.traits,'diseases',true)}</section></div></div>`;}
  window.CharacterUI={selection,details,toggle,conflict};
})();
