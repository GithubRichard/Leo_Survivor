/* Offline playlist. Playback is independent of the sound/voice switch. */
(() => {
  const tracks=[['morning-light','晨光'],['rain-window','雨窗'],['quiet-watch','静夜守望'],['night-siege','危夜围城 · 夜战']];
  const read=(k,f)=>{try{return localStorage.getItem(k)??f;}catch{return f;}},save=(k,v)=>{try{localStorage.setItem(k,String(v));}catch{}};
  let enabled=read('survivor-music-enabled','true')!=='false',volume=Number(read('survivor-music-volume','.22')),index=0,dayIndex=0,night=null,active=false,duck=false,unlocked=false,pending=false,blocked=false,errors=0,request=0;
  volume=Number.isFinite(volume)?Math.max(0,Math.min(1,volume)):.22;
  const audio=new Audio();audio.preload='none';audio.volume=0;audio.src=`audio/music/${tracks[0][0]}.wav?v=0.14.11`;
  const button=document.getElementById('music-toggle'),select=document.getElementById('music-track'),slider=document.getElementById('music-volume'),value=document.getElementById('music-volume-label');
  select.innerHTML=tracks.map(([id,title],i)=>`<option value="${i}">${title}</option>`).join('');slider.value=Math.round(volume*100);
  const wanted=()=>enabled&&active&&unlocked&&!document.hidden&&document.hasFocus();
  function pause(){if(pending||!audio.paused){request++;pending=false;}audio.pause();}
  function sync(){button.textContent=enabled?'音乐：开':'音乐：关';button.setAttribute('aria-pressed',String(enabled));select.value=index;select.disabled=night===true;select.title=night?'夜间自动播放危夜围城，可关闭音乐或调整音量':'白天轻音乐轮播，也可选曲';value.textContent=Math.round(volume*100)+'%';}
  function apply(){
    if(!wanted()){pause();return;}
    if(audio.paused&&!pending&&!blocked){pending=true;const id=++request;audio.play().then(()=>{if(id!==request)return;pending=false;errors=0;if(!wanted())pause();}).catch(error=>{if(id!==request)return;pending=false;blocked=error.name!=='AbortError';});}
  }
  function choose(i){index=i;pause();request++;audio.src=`audio/music/${tracks[index][0]}.wav?v=0.14.11`;blocked=false;sync();apply();}
  audio.addEventListener('ended',()=>choose(night?3:(index+1)%3));
  audio.addEventListener('error',()=>{if(++errors<tracks.length)choose(night?3:(index+1)%3);else{blocked=true;button.title='音乐文件加载失败，可重新打开音乐重试';}});
  button.addEventListener('click',()=>{enabled=!enabled;unlocked=true;blocked=false;errors=0;save('survivor-music-enabled',enabled);sync();apply();});
  select.addEventListener('change',()=>{if(night)return;unlocked=true;choose(Number(select.value));if(index<3)dayIndex=index;});
  slider.addEventListener('input',()=>{volume=Number(slider.value)/100;save('survivor-music-volume',volume);sync();});
  const unlock=()=>{unlocked=true;blocked=false;apply();};addEventListener('pointerdown',unlock,{passive:true});addEventListener('keydown',unlock,{passive:true});
  addEventListener('blur',()=>{active=false;pause();});document.addEventListener('visibilitychange',()=>{if(document.hidden){active=false;pause();}});
  function update(next,lower,dt,minutes=300){active=next;duck=lower;const m=((minutes%1440)+1440)%1440,isNight=m>=1320||m<300;if(night!==isNight){if(isNight&&index<3)dayIndex=index;night=isNight;errors=0;choose(night?3:dayIndex);}const target=wanted()?volume*(duck?.25:1):0;audio.volume+=(target-audio.volume)*(1-Math.exp(-Math.max(0,dt)*4));apply();}
  sync();window.GameMusic={update};
})();
