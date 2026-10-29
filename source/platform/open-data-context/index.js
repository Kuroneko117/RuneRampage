/* Native WeChat open-data domain. No friend identifiers, nicknames or avatars leave this domain. */
const canvas=wx.getSharedCanvas();canvas.width=640;canvas.height=960;const ctx=canvas.getContext('2d');
const KEYS={campaign:'rune_campaign_wave_v1',endless:'rune_endless_wave_v1'};
let mode='campaign',key=KEYS.campaign,entries=[],page=0,status='点击微信好友查看排行',self=null,ownWave=null,generation=0;
const avatars=new Map(),pendingScores=new Map(),writing=new Set();let oldRank=null,oldOwnWave=0,passed='';
const score=(list,k)=>{const item=(list||[]).find(x=>x.key===k),n=Number(item&&item.value);return Number.isFinite(n)?Math.max(0,Math.floor(n)):0;};
function text(value,x,y,size=30,color='#eeeae2',align='left'){ctx.fillStyle=color;ctx.font=size+'px sans-serif';ctx.textAlign=align;ctx.textBaseline='middle';ctx.fillText(String(value),x,y);}
function lines(value,x,y,width=26){const a=Array.from(value);for(let i=0;i<a.length;i+=width)text(a.slice(i,i+width).join(''),x,y+i/width*48,28,'#9ba4bb','center');}
function avatar(user,x,y){ctx.fillStyle='#2b354c';ctx.fillRect(x,y,56,56);const url=user.avatarUrl;if(!url||!/^https:\/\//.test(url))return;
 let image=avatars.get(url);if(!image){if(avatars.size>=32)avatars.delete(avatars.keys().next().value);image=wx.createImage();avatars.set(url,image);image.onload=draw;image.onerror=()=>{};image.src=url;}if(image.width&&image.height){try{ctx.drawImage(image,x,y,56,56);}catch{}}
}
function draw(){ctx.clearRect(0,0,canvas.width,canvas.height);ctx.save();ctx.scale(canvas.width/640,canvas.height/960);ctx.fillStyle='#171d30';ctx.fillRect(0,0,640,960);ctx.strokeStyle='#43506f';ctx.lineWidth=3;ctx.strokeRect(2,2,636,956);
 text(mode==='campaign'?'20 波挑战 · 好友排行':'无限模式 · 好友排行',320,48,32,'#71ebdd','center');text('排名 / 术士',30,106,26,'#9ba4bb');text('最高波次',604,106,26,'#9ba4bb','right');
 if(status){lines(status,320,320,18);}else if(!entries.length){lines('暂无同玩好友成绩。完成一局后邀请好友挑战。',320,320,18);}else {
  entries.slice(page*8,page*8+8).forEach((u,i)=>{const y=155+i*78,isSelf=!!self&&(u.openid===self.openId||u.openId===self.openId);if(isSelf){ctx.fillStyle='#263c4a';ctx.fillRect(14,y-9,612,74);}text(page*8+i+1,34,y+24,28,page*8+i<3?'#e7c16f':'#9ba4bb');avatar(u,92,y-3);text(Array.from(u.nickname||u.nickName||'微信术士').slice(0,10).join(''),166,y+24,28);text(u.wave,604,y+24,30,'#e7c16f','right');});
  text('第 '+(page+1)+' / '+Math.max(1,Math.ceil(entries.length/8))+' 页',320,815,25,'#9ba4bb','center');
 }
 ctx.fillStyle='#0a0e1b';ctx.fillRect(12,850,616,96);const rank=self?entries.findIndex(u=>u.openid===self.openId||u.openId===self.openId):-1;
 text((ownWave===null?'我的云纪录暂不可用':'我的云纪录  '+ownWave+' 波')+(rank>=0?'  /  第 '+(rank+1)+' 名':''),320,881,28,'#71ebdd','center');text(passed||'未取得好友资料时不展示昵称和名次',320,922,23,'#9ba4bb','center');ctx.restore();
}
function load(m){const ticket=++generation;mode=m.mode;key=KEYS[mode];page=0;ownWave=null;status='正在加载微信好友成绩…';draw();
 let remaining=3,friendFailure=false;const done=()=>{if(ticket!==generation)return;if(--remaining)return;if(!friendFailure){status='';if(self&&ownWave>0&&!entries.some(u=>u.openid===self.openId||u.openId===self.openId)){entries.push({openId:self.openId,nickname:self.nickName,avatarUrl:self.avatarUrl,wave:ownWave});entries.sort((a,b)=>b.wave-a.wave);}}const rank=self?entries.findIndex(u=>u.openid===self.openId||u.openId===self.openId):-1;if(rank>=0&&oldRank!==null&&rank<oldRank&&ownWave>oldOwnWave)passed='较上次查看超越 '+(oldRank-rank)+' 位好友';else passed=rank>=0?'当前位次以微信好友云成绩为准':'';oldRank=rank>=0?rank:null;oldOwnWave=ownWave;draw();};
 const timer=setTimeout(()=>{if(ticket===generation&&remaining){status='加载超时，请点刷新；个人纪录仍可使用。';generation++;draw();}},8000);
 try{
  wx.getUserCloudStorage({keyList:[key],success:r=>{if(ticket===generation)ownWave=score(r.KVDataList,key);},fail:()=>{if(ticket===generation)ownWave=null;},complete:done});
  wx.getUserInfo({openIdList:['selfOpenId'],lang:'zh_CN',success:r=>{if(ticket===generation)self=r.data&&r.data[0]||null;},fail:()=>{if(ticket===generation)self=null;},complete:done});
  wx.getFriendCloudStorage({keyList:[key],success:r=>{if(ticket!==generation)return;entries=(r.data||[]).map(u=>Object.assign({},u,{wave:score(u.KVDataList,key)})).filter(u=>u.wave>0).sort((a,b)=>b.wave-a.wave);},fail:()=>{if(ticket!==generation)return;friendFailure=true;entries=[];status='好友数据暂不可用。请检查授权或后台能力后刷新。';},complete:done});
 }catch{clearTimeout(timer);status='当前微信版本不支持好友排行，请更新微信。';draw();}
}
function publish(m){const k=KEYS[m.mode];if(!k)return;const wave=Math.max(0,Math.min(m.mode==='campaign'?20:100000,Math.floor(m.wave)||0));pendingScores.set(k,Math.max(pendingScores.get(k)||0,wave));if(writing.has(k))return;writing.add(k);
 const finish=()=>{writing.delete(k);if((pendingScores.get(k)||0)>wave)publish({mode:m.mode,wave:pendingScores.get(k)});};
 try{wx.getUserCloudStorage({keyList:[k],success:r=>{const best=Math.max(wave,score(r.KVDataList,k));wx.setUserCloudStorage({KVDataList:[{key:k,value:String(best)}],complete:finish});},fail:()=>{writing.delete(k);}});}catch{writing.delete(k);}
}
wx.onMessage(m=>{if(m.fromEngine){if(m.event==='viewport')draw();return;}if(m.type!=='rune:leaderboard')return;if(m.command==='publish'){publish(m);return;}if(m.command==='status'){generation++;if(KEYS[m.mode]&&mode!==m.mode){mode=m.mode;key=KEYS[mode];entries=[];ownWave=null;oldRank=null;oldOwnWave=0;passed='';}status=String(m.message||'').slice(0,100);draw();return;}if(m.command==='load'&&KEYS[m.mode]===m.key){if(mode!==m.mode){oldRank=null;passed='';}load(m);}else if(m.command==='page'&&!status){page=Math.max(0,Math.min(Math.ceil(entries.length/8)-1,page+(m.direction>0?1:-1)));draw();}});draw();
