/* Weather guide uses the same storm parameters as the simulation. */
(() => {
  'use strict';
  const guide=document.getElementById('weather-guide');
  const open=document.getElementById('open-weather-guide');
  const {Weather}=Survival,dust=Weather.duststorm;
  const profiles=Object.values(DifficultyRules.profiles);
  const tornadoTiming=Object.entries(Survival.TornadoIntervals).map(([id,{first,repeat}])=>`${DifficultyRules.profiles[id].name}首次 ${first.join('–')} 秒、再次 ${repeat.join('–')} 秒`).join('；');
  const percent=n=>Math.round(n*100)+'%';
  function schedule(kind,index){
    const hours=['sunny','overcast'].includes(kind)?'每段 2–7 游戏小时':`每段游戏时长 ${profiles.map(p=>`${p.name} ${p.badHours.join('–')} 小时`).join('、')}`;
    return `${hours}。抽取权重 ${profiles.map(p=>`${p.name} ${p.weather[index]}`).join('、')}。`;
  }
  const entries={
    sunny:[0,'第 1 天 05:00 起的首段固定晴天，持续 3 游戏小时。夜间的晴天表示晴朗夜空。'],
    overcast:[0,'云影只影响画面，视距照常。'],
    rain:[1,'雨滴为场景效果，视距照常。'],
    fog:[2,'生物和人类进入视距后逐渐清晰。基础视距最多 10 米，受照时最远可见 14 米。明察时分别为 12 米和 16.8 米，近视时为 7.5 米和 10.5 米。室内外均无视野豁免。远处的房屋、栅栏、物件和生物都会被雾遮住。'],
    thunderstorm:[4,'每 8–14 秒在玩家 20 米内随机选取室外落点。预警圈半径 1.1 米，预警持续 1.2 秒，随后对圈内玩家和地面生物造成 3 点基础伤害，对可破坏的室外建筑造成 4 点伤害。可离开预警圈或进屋避雷。'],
    tornado:[4,`生成间隔（再次计时从上一根风柱消散起算）：${tornadoTiming}。风柱在距玩家至少 12 米处预警 3 秒，随后以 1.6 米/秒移动，半径 1.2 米，持续 15 秒。每根风柱最多命中同一目标一次。玩家受到 2 点基础伤害，并随机失去背包里一个非空格的整组物品。遇障碍可提前消散，进屋可避险。`],
    duststorm:[5,'失水倒计时从风暴开始计算。喝完一瓶清水重置倒计时，超时直接死亡。进屋仍需补水，风暴结束解除失水。']
  };
  document.getElementById('weather-guide-list').innerHTML=Object.entries(entries).map(([kind,[danger,details]],index)=>{
    const type=Weather[kind],special=kind==='duststorm';
    const timing=special?`困难、天启专属，每天 ${percent(dust.probability)} 概率发生，持续 ${dust.minDuration}–${dust.maxDuration} 秒。`:schedule(kind,index);
    const effects=special?`地面移速 ${percent(dust.speed)}，自然饱食消耗 ${percent(dust.hunger)}。视野缩至大雾的基础范围，外围完全遮挡；地图可见宽高为原来的 ${percent(dust.mapScale)}。每 ${dust.dehydration} 秒须喝一瓶清水。`:`室外移速 ${percent(type.speed)}，室外作物生长 ${percent(type.growth)}。`;
    return `<article class="bestiary-entry"><h3>${WorldView.weatherIcon(kind)}${type.name}</h3><p class="weather-danger"><span aria-hidden="true">危险系数 ${'★'.repeat(danger)}${'☆'.repeat(5-danger)}</span><span class="weather-rating">${danger} / 5</span></p><p class="bestiary-description">${timing}</p><p class="bestiary-description">${effects} ${details}</p></article>`;
  }).join('');
  open.addEventListener('click',()=>{if(!guide.open)guide.showModal();});
  guide.addEventListener('close',()=>open.focus());
})();
