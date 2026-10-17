/* Rear walls precede indoor actors; front walls keep their own occlusion layer. */
(function(root){
  'use strict';
  const rear=h=>h.x+h.y-11.1,front=h=>h.x+h.y+.01;
  const contains=(h,o)=>Math.abs(o.x-h.x)<5&&o.y>h.y-6&&o.y<h.y;
  function actor(o,homes){
    let depth=o.x+o.y+.2;
    for(const h of homes){
      const x=o.x-h.x,y=o.y-h.y;
      if(contains(h,o))depth=Math.max(rear(h)+.1,Math.min(depth,front(h)-.06));
      else if((x>=-5.3&&x<=5.3&&y>=0&&y<=4.3)||(x>=5&&x<=6.5&&y>=-6&&y<0))depth=Math.max(depth,front(h)+.05);
      else if((x<=-5&&x>=-6.5&&y>=-6.3&&y<=0)||(y<=-6&&y>=-7.5&&Math.abs(x)<=5.3))depth=Math.min(depth,rear(h)-.1);
    }
    return depth;
  }
  const api={rear,front,contains,actor};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.SceneLayers=api;
})(typeof globalThis!=='undefined'?globalThis:this);
