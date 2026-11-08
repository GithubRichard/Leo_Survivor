/* Apocalypse humans use final human values, independent of zombie difficulty multipliers. */
(() => {
  const weapons={bare:{damage:2,range:1.1,windup:.3},iron_axe:{damage:5,range:1.3,windup:.4},hand_crossbow:{damage:6,range:12,windup:.6,speed:12},shotgun:{damage:2.5,range:6,windup:.5,speed:18,pellets:4}};
  window.HumansData={weapons,starvingTimes:[330,570,810,1050],banditTimes:[360,540,720,900,1080,1260],waves:[['iron_axe','iron_axe','iron_axe','iron_axe','hand_crossbow','hand_crossbow'],[...Array(6).fill('iron_axe'),...Array(3).fill('hand_crossbow'),'shotgun'],[...Array(8).fill('iron_axe'),...Array(5).fill('hand_crossbow'),...Array(2).fill('shotgun')]],foodOrder:['canned_food','baked_potato','roast_meat','vegetable_soup','grain_porridge','meat_vegetable_stew','potato_meat_pie','jerky','potato','vegetable'],names:{starving_civilian:'饥民',bandit:'强盗',loyal_follower:'忠心随从'}};
})();
